"""
Router: Directivos
──────────────────
Panel de supervisión de auxiliares y tutores, circulares oficiales
y avisos internos al personal.

Endpoints:
  GET  /directivo/supervision                              → resumen del personal con stats por nivel
  GET  /directivo/supervision/auxiliar/{id}                → detalle auxiliar
  GET  /directivo/supervision/tutor/{id}                   → detalle tutor (mejorado)
  GET  /directivo/supervision/personal/{id}/comunicados    → comunicados paginados
  GET  /directivo/supervision/justificaciones              → justificaciones por nivel
  POST /directivo/avisar/{usuario_id}                      → enviar aviso (persiste + push)
  GET  /directivo/avisos-enviados                          → historial de avisos enviados
  POST /directivo/circular                                 → enviar circular oficial
  GET  /directivo/circulares                               → historial de circulares
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from core.dependencies import get_db, require_roles
from core.tz import hoy as _hoy
from models.asistencia import Asistencia
from models.aviso import AvisoDirectivo
from models.comunicado import Comunicado, ComunicadoDestinatario
from models.estudiante import Estudiante
from models.justificacion import Justificacion
from models.recojo import RecojoLog, PersonaAutorizada
from models.reunion import ReunionTutor
from models.usuario import TutorAula, Usuario

router = APIRouter()

CARGO_DIRECTIVO = {
    "inicial":    "Directora de Inicial",
    "primaria":   "Subdirector de Primaria",
    "secundaria": "Subdirector de Secundaria",
    "formacion":  "Subdir. Form. General",
    "todos":      "Director del CEAUNE",
}

ROL_POR_NIVEL = {
    "inicial":    "i-auxiliar",
    "primaria":   "p-auxiliar",
    "secundaria": "s-auxiliar",
}


def _niveles(user: Usuario) -> list[str]:
    if not user.nivel or user.nivel in ("todos", "formacion"):
        return ["inicial", "primaria", "secundaria"]
    return [user.nivel]


# ── GET /directivo/supervision ────────────────────────────────────────────────

@router.get("/supervision")
def supervision(
    fecha: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    try:
        hoy = date.fromisoformat(fecha) if fecha else _hoy()
    except ValueError:
        hoy = _hoy()
    lunes = hoy - timedelta(days=hoy.weekday())
    niveles = _niveles(current_user)

    # ── Stats de asistencia por nivel ─────────────────────────────────────────
    niveles_stats = {}
    for nivel in niveles:
        total_alumnos = (
            db.query(func.count(Estudiante.id))
            .filter(Estudiante.nivel == nivel, Estudiante.activo == True)
            .scalar()
        ) or 0

        # IDs de alumnos de ese nivel
        ids_nivel = [
            r.id for r in
            db.query(Estudiante.id).filter(Estudiante.nivel == nivel, Estudiante.activo == True).all()
        ]

        presentes  = 0
        tardanzas  = 0
        if ids_nivel:
            presentes = (
                db.query(func.count(func.distinct(Asistencia.estudiante_id)))
                .filter(
                    Asistencia.estudiante_id.in_(ids_nivel),
                    Asistencia.fecha == hoy,
                    Asistencia.tipo == "ingreso",
                )
                .scalar()
            ) or 0
            tardanzas = (
                db.query(func.count(func.distinct(Asistencia.estudiante_id)))
                .filter(
                    Asistencia.estudiante_id.in_(ids_nivel),
                    Asistencia.fecha == hoy,
                    Asistencia.tipo == "ingreso",
                    Asistencia.estado == "tardanza",
                )
                .scalar()
            ) or 0

        pct = round(presentes / total_alumnos * 100) if total_alumnos > 0 else 0
        niveles_stats[nivel] = {
            "total":     total_alumnos,
            "presentes": presentes,
            "ausentes":  total_alumnos - presentes,
            "tardanzas": tardanzas,
            "pct":       pct,
        }

    # ── Auxiliares ────────────────────────────────────────────────────────────
    roles_aux = [ROL_POR_NIVEL[n] for n in niveles if n in ROL_POR_NIVEL]
    auxiliares = (
        db.query(Usuario)
        .filter(Usuario.rol.in_(roles_aux), Usuario.activo == True)
        .all()
    )

    escaneos = (
        db.query(
            Asistencia.auxiliar_id,
            func.count(Asistencia.id).label("total"),
            func.min(Asistencia.hora).label("primer_escaneo"),
        )
        .filter(
            Asistencia.fecha == hoy,
            Asistencia.tipo == "ingreso",
            Asistencia.auxiliar_id.isnot(None),
        )
        .group_by(Asistencia.auxiliar_id)
        .all()
    )
    escaneos_map = {r.auxiliar_id: r for r in escaneos}

    pend_rows = (
        db.query(Estudiante.nivel, func.count(Justificacion.id).label("total"))
        .join(Asistencia, Justificacion.asistencia_id == Asistencia.id)
        .join(Estudiante, Asistencia.estudiante_id == Estudiante.id)
        .filter(
            Justificacion.estado == "pendiente",
            Estudiante.nivel.in_(niveles),
        )
        .group_by(Estudiante.nivel)
        .all()
    )
    pend_por_nivel = {r.nivel: r.total for r in pend_rows}

    resultado_auxiliares = []
    for aux in auxiliares:
        scan = escaneos_map.get(aux.id)
        resultado_auxiliares.append({
            "id":               aux.id,
            "nombre":           aux.nombre,
            "apellido":         aux.apellido,
            "nivel":            aux.nivel,
            "escaneos_hoy":     scan.total if scan else 0,
            "primer_escaneo":   scan.primer_escaneo.strftime("%H:%M") if scan and scan.primer_escaneo else None,
            "justif_pendientes": pend_por_nivel.get(aux.nivel, 0),
        })

    # ── Tutores ───────────────────────────────────────────────────────────────
    tutores_aulas = (
        db.query(Usuario, TutorAula)
        .join(TutorAula, TutorAula.tutor_id == Usuario.id)
        .filter(Usuario.activo == True, TutorAula.nivel.in_(niveles))
        .all()
    )
    tutor_ids = [u.id for u, _ in tutores_aulas]

    comun_rows = (
        db.query(Comunicado.auxiliar_id, func.count(Comunicado.id).label("total"))
        .filter(
            Comunicado.auxiliar_id.in_(tutor_ids),
            func.date(Comunicado.created_at) >= lunes,
        )
        .group_by(Comunicado.auxiliar_id)
        .all()
    )
    comun_map = {r.auxiliar_id: r.total for r in comun_rows}

    reunion_rows = (
        db.query(ReunionTutor.tutor_id, func.count(ReunionTutor.id).label("total"))
        .filter(
            ReunionTutor.tutor_id.in_(tutor_ids),
            ReunionTutor.fecha >= lunes,
            ReunionTutor.estado.in_(["pendiente", "confirmada"]),
        )
        .group_by(ReunionTutor.tutor_id)
        .all()
    )
    reunion_map = {r.tutor_id: r.total for r in reunion_rows}

    resultado_tutores = []
    for tutor, aula in tutores_aulas:
        resultado_tutores.append({
            "id":                tutor.id,
            "nombre":            tutor.nombre,
            "apellido":          tutor.apellido,
            "nivel":             aula.nivel,
            "grado":             aula.grado,
            "seccion":           aula.seccion,
            "comunicados_semana": comun_map.get(tutor.id, 0),
            "reuniones_semana":  reunion_map.get(tutor.id, 0),
        })

    # ── Resumen global ────────────────────────────────────────────────────────
    total_escaneados  = sum(a["escaneos_hoy"] for a in resultado_auxiliares)
    aux_activos_hoy   = sum(1 for a in resultado_auxiliares if a["escaneos_hoy"] > 0)
    total_pend_justif = sum(pend_por_nivel.values())

    total_alumnos_inst = sum(n["total"]     for n in niveles_stats.values())
    presentes_inst     = sum(n["presentes"] for n in niveles_stats.values())
    pct_inst = round(presentes_inst / total_alumnos_inst * 100) if total_alumnos_inst > 0 else 0

    # ── Recojo seguro (solo inicial) ──────────────────────────────────────────
    recojo_hoy = None
    if "inicial" in niveles:
        ids_inicial = [
            r.id for r in
            db.query(Estudiante.id).filter(Estudiante.nivel == "inicial", Estudiante.activo == True).all()
        ]
        total_recojo = 0
        if ids_inicial:
            total_recojo = (
                db.query(func.count(RecojoLog.id))
                .filter(
                    RecojoLog.estudiante_id.in_(ids_inicial),
                    RecojoLog.confirmado == True,
                    func.date(RecojoLog.created_at) == hoy,
                )
                .scalar()
            ) or 0
        recojo_hoy = {
            "confirmados": total_recojo,
            "total_alumnos": niveles_stats.get("inicial", {}).get("total", 0),
        }

    return {
        "resumen": {
            "aux_activos_hoy":    aux_activos_hoy,
            "total_auxiliares":   len(resultado_auxiliares),
            "total_escaneados":   total_escaneados,
            "justif_pendientes":  total_pend_justif,
            "pct_asistencia_inst": pct_inst,
            "presentes_inst":     presentes_inst,
            "total_alumnos_inst": total_alumnos_inst,
        },
        "niveles_stats": niveles_stats,
        "auxiliares":    resultado_auxiliares,
        "tutores":       resultado_tutores,
        "recojo_hoy":    recojo_hoy,
        "fecha":         hoy.isoformat(),
    }


# ── GET /directivo/supervision/auxiliar/{auxiliar_id} ─────────────────────────

@router.get("/supervision/auxiliar/{auxiliar_id}")
def detalle_auxiliar(
    auxiliar_id: str,
    fecha_ref: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    aux = db.query(Usuario).filter(Usuario.id == auxiliar_id, Usuario.activo == True).first()
    if not aux:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Auxiliar no encontrado")

    niveles = _niveles(current_user)
    if aux.nivel not in niveles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a este auxiliar")

    try:
        hoy = date.fromisoformat(fecha_ref) if fecha_ref else _hoy()
    except ValueError:
        hoy = _hoy()

    # Historial últimos 7 días
    historial = []
    for i in range(6, -1, -1):
        fecha = hoy - timedelta(days=i)
        total = (
            db.query(func.count(Asistencia.id))
            .filter(
                Asistencia.auxiliar_id == auxiliar_id,
                Asistencia.fecha == fecha,
                Asistencia.tipo == "ingreso",
            )
            .scalar()
        ) or 0
        historial.append({"fecha": fecha.isoformat(), "escaneos": total})

    hoy_rows = (
        db.query(Asistencia.hora, Asistencia.estado)
        .filter(
            Asistencia.auxiliar_id == auxiliar_id,
            Asistencia.fecha == hoy,
            Asistencia.tipo == "ingreso",
        )
        .order_by(Asistencia.hora)
        .all()
    )
    primer_scan  = hoy_rows[0].hora.strftime("%H:%M")  if hoy_rows else None
    ultimo_scan  = hoy_rows[-1].hora.strftime("%H:%M") if hoy_rows else None
    tardanzas_hoy = sum(1 for r in hoy_rows if r.estado == "tardanza")

    rows = (
        db.query(Justificacion, Asistencia, Estudiante)
        .join(Asistencia, Justificacion.asistencia_id == Asistencia.id)
        .join(Estudiante, Asistencia.estudiante_id == Estudiante.id)
        .filter(
            Justificacion.estado == "pendiente",
            Estudiante.nivel == aux.nivel,
        )
        .order_by(Justificacion.created_at.desc())
        .limit(8)
        .all()
    )

    comunicados = (
        db.query(Comunicado)
        .filter(Comunicado.auxiliar_id == auxiliar_id)
        .order_by(Comunicado.created_at.desc())
        .limit(5)
        .all()
    )
    comuns_data = []
    for c in comunicados:
        total = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(ComunicadoDestinatario.comunicado_id == c.id)
            .scalar()
        ) or 0
        leidos = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(
                ComunicadoDestinatario.comunicado_id == c.id,
                ComunicadoDestinatario.leido_apoderado == True,
            )
            .scalar()
        ) or 0
        comuns_data.append({
            "id":         c.id,
            "asunto":     c.asunto,
            "created_at": c.created_at,
            "total":      total,
            "leidos":     leidos,
            "pct":        round(leidos / total * 100) if total > 0 else 0,
        })

    # Avisos enviados por este directivo a este auxiliar
    avisos_enviados = (
        db.query(AvisoDirectivo)
        .filter(
            AvisoDirectivo.emisor_id == current_user.id,
            AvisoDirectivo.receptor_id == auxiliar_id,
        )
        .order_by(AvisoDirectivo.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "historial_7dias": historial,
        "hoy": {
            "total":          len(hoy_rows),
            "tardanzas":      tardanzas_hoy,
            "puntuales":      len(hoy_rows) - tardanzas_hoy,
            "primer_escaneo": primer_scan,
            "ultimo_escaneo": ultimo_scan,
        },
        "justificaciones": [
            {
                "id":         j.id,
                "estudiante": f"{e.nombre} {e.apellido}",
                "grado":      e.grado,
                "seccion":    e.seccion,
                "motivo":     j.motivo[:60] if j.motivo else "",
                "fecha":      a.fecha.isoformat(),
            }
            for j, a, e in rows
        ],
        "ultimos_comunicados": comuns_data,
        "avisos_enviados": [
            {
                "id":         av.id,
                "mensaje":    av.mensaje,
                "leido":      av.leido,
                "created_at": av.created_at,
            }
            for av in avisos_enviados
        ],
    }


# ── GET /directivo/supervision/tutor/{tutor_id} ───────────────────────────────

@router.get("/supervision/tutor/{tutor_id}")
def detalle_tutor(
    tutor_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    tutor = db.query(Usuario).filter(Usuario.id == tutor_id, Usuario.activo == True).first()
    if not tutor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tutor no encontrado")

    niveles = _niveles(current_user)
    aula = (
        db.query(TutorAula)
        .filter(TutorAula.tutor_id == tutor_id, TutorAula.nivel.in_(niveles))
        .first()
    )
    if not aula:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a este tutor")

    hoy   = _hoy()
    lunes = hoy - timedelta(days=hoy.weekday())

    # Alumnos del aula
    est_ids = [
        r.id
        for r in db.query(Estudiante.id)
        .filter(
            Estudiante.nivel   == aula.nivel,
            Estudiante.grado   == aula.grado,
            Estudiante.seccion == aula.seccion,
            Estudiante.activo  == True,
        )
        .all()
    ]
    total_est = len(est_ids)
    presentes = 0
    if est_ids:
        presentes = (
            db.query(func.count(Asistencia.id))
            .filter(
                Asistencia.estudiante_id.in_(est_ids),
                Asistencia.fecha == hoy,
                Asistencia.tipo  == "ingreso",
            )
            .scalar()
        ) or 0

    # Últimos comunicados
    comunicados = (
        db.query(Comunicado)
        .filter(Comunicado.auxiliar_id == tutor_id)
        .order_by(Comunicado.created_at.desc())
        .limit(5)
        .all()
    )
    comuns_data = []
    total_comun_leidos = 0
    total_comun_dest   = 0
    for c in comunicados:
        total_d = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(ComunicadoDestinatario.comunicado_id == c.id)
            .scalar()
        ) or 0
        leidos_d = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(
                ComunicadoDestinatario.comunicado_id == c.id,
                ComunicadoDestinatario.leido_apoderado == True,
            )
            .scalar()
        ) or 0
        total_comun_dest   += total_d
        total_comun_leidos += leidos_d
        comuns_data.append({
            "id":         c.id,
            "asunto":     c.asunto,
            "created_at": c.created_at,
            "total":      total_d,
            "leidos":     leidos_d,
            "pct":        round(leidos_d / total_d * 100) if total_d > 0 else 0,
        })

    pct_lectura_promedio = round(total_comun_leidos / total_comun_dest * 100) if total_comun_dest > 0 else 0

    # Comunicados por día de la semana actual (Lun-Dom)
    comuns_semana = (
        db.query(
            func.date(Comunicado.created_at).label("dia"),
            func.count(Comunicado.id).label("total"),
        )
        .filter(
            Comunicado.auxiliar_id == tutor_id,
            func.date(Comunicado.created_at) >= lunes,
        )
        .group_by(func.date(Comunicado.created_at))
        .all()
    )
    comuns_por_dia_map = {str(r.dia): r.total for r in comuns_semana}
    comuns_por_dia = []
    for i in range(5):  # Lun–Vie
        d = lunes + timedelta(days=i)
        comuns_por_dia.append({
            "fecha": d.isoformat(),
            "total": comuns_por_dia_map.get(d.isoformat(), 0),
        })

    # Total comunicados enviados esta semana
    comuns_semana_total = (
        db.query(func.count(Comunicado.id))
        .filter(
            Comunicado.auxiliar_id == tutor_id,
            func.date(Comunicado.created_at) >= lunes,
        )
        .scalar()
    ) or 0

    # Familias que nunca han abierto ningún comunicado de este tutor
    # (estudiantes del aula con 0 lecturas en todos los comunicados del tutor)
    familias_inactivas = 0
    if est_ids:
        # Estudiantes del aula que tienen al menos un comunicado del tutor
        ids_con_dest = [
            r.estudiante_id
            for r in db.query(ComunicadoDestinatario.estudiante_id)
            .join(Comunicado, ComunicadoDestinatario.comunicado_id == Comunicado.id)
            .filter(
                Comunicado.auxiliar_id == tutor_id,
                ComunicadoDestinatario.estudiante_id.in_(est_ids),
            )
            .distinct()
            .all()
        ]
        # De esos, los que NUNCA leyeron
        ids_nunca_leidos = set()
        for est_id in ids_con_dest:
            leyo = (
                db.query(func.count(ComunicadoDestinatario.id))
                .join(Comunicado, ComunicadoDestinatario.comunicado_id == Comunicado.id)
                .filter(
                    Comunicado.auxiliar_id == tutor_id,
                    ComunicadoDestinatario.estudiante_id == est_id,
                    ComunicadoDestinatario.leido_apoderado == True,
                )
                .scalar()
            ) or 0
            if leyo == 0:
                ids_nunca_leidos.add(est_id)
        familias_inactivas = len(ids_nunca_leidos)

    # Alumnos en riesgo: 3+ ausencias sin justificación aprobada esta semana
    alumnos_riesgo = []
    if est_ids:
        dias_semana = [lunes + timedelta(days=i) for i in range(hoy.weekday() + 1)]
        for est_id in est_ids:
            ausencias = 0
            for dia in dias_semana:
                ingreso = (
                    db.query(func.count(Asistencia.id))
                    .filter(
                        Asistencia.estudiante_id == est_id,
                        Asistencia.fecha == dia,
                        Asistencia.tipo == "ingreso",
                    )
                    .scalar()
                ) or 0
                if ingreso == 0:
                    ausencias += 1
            if ausencias >= 3:
                est = db.query(Estudiante).filter(Estudiante.id == est_id).first()
                if est:
                    alumnos_riesgo.append({
                        "id":       est.id,
                        "nombre":   f"{est.nombre} {est.apellido}",
                        "ausencias_semana": ausencias,
                    })

    # Reuniones de esta semana
    reuniones = (
        db.query(ReunionTutor, Estudiante)
        .join(Estudiante, ReunionTutor.estudiante_id == Estudiante.id)
        .filter(
            ReunionTutor.tutor_id == tutor_id,
            ReunionTutor.fecha >= lunes,
            ReunionTutor.estado.in_(["pendiente", "confirmada"]),
        )
        .order_by(ReunionTutor.fecha, ReunionTutor.hora)
        .limit(10)
        .all()
    )

    # Avisos enviados por este directivo a este tutor
    avisos_enviados = (
        db.query(AvisoDirectivo)
        .filter(
            AvisoDirectivo.emisor_id == current_user.id,
            AvisoDirectivo.receptor_id == tutor_id,
        )
        .order_by(AvisoDirectivo.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "aula": {
            "nivel":   aula.nivel,
            "grado":   aula.grado,
            "seccion": aula.seccion,
        },
        "aula_hoy": {
            "total":    total_est,
            "presentes": presentes,
            "ausentes":  total_est - presentes,
            "pct":       round(presentes / total_est * 100) if total_est > 0 else 0,
        },
        "comunicacion": {
            "semana_total":       comuns_semana_total,
            "pct_lectura":        pct_lectura_promedio,
            "familias_inactivas": familias_inactivas,
            "por_dia":            comuns_por_dia,
        },
        "ultimos_comunicados": comuns_data,
        "alumnos_riesgo":      alumnos_riesgo,
        "reuniones_semana": [
            {
                "id":         r.id,
                "titulo":     r.titulo,
                "fecha":      r.fecha.isoformat(),
                "hora":       r.hora.strftime("%H:%M"),
                "estado":     r.estado,
                "estudiante": f"{e.nombre} {e.apellido}",
            }
            for r, e in reuniones
        ],
        "avisos_enviados": [
            {
                "id":         av.id,
                "mensaje":    av.mensaje,
                "leido":      av.leido,
                "created_at": av.created_at,
            }
            for av in avisos_enviados
        ],
    }


# ── POST /directivo/avisar/{usuario_id} ───────────────────────────────────────

@router.post("/avisar/{usuario_id}", status_code=200)
def enviar_aviso(
    usuario_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    personal = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.activo == True).first()
    if not personal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    niveles = _niveles(current_user)
    if personal.nivel not in niveles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso")

    mensaje = (data.get("mensaje") or "").strip()
    if not mensaje or len(mensaje) > 300:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Mensaje requerido (máx 300 caracteres)",
        )

    # Persistir el aviso en BD
    aviso = AvisoDirectivo(
        emisor_id   = current_user.id,
        receptor_id = usuario_id,
        mensaje     = mensaje,
    )
    db.add(aviso)
    db.commit()
    db.refresh(aviso)

    cargo = CARGO_DIRECTIVO.get(current_user.nivel or "todos", "Directivo")

    # Push notification
    try:
        from models.dispositivo import DispositivoUsuario
        from services.firebase_service import _enviar_push

        tokens = [
            r.fcm_token
            for r in db.query(DispositivoUsuario).filter(
                DispositivoUsuario.usuario_id == usuario_id,
                DispositivoUsuario.activo == True,
            ).all()
        ]
        if tokens:
            _enviar_push(tokens, f"Aviso — {cargo}", mensaje, {"tipo": "aviso_directivo"})
    except Exception:
        pass

    return {
        "ok":         True,
        "aviso_id":   aviso.id,
        "created_at": aviso.created_at,
    }


# ── GET /directivo/avisos-enviados ───────────────────────────────────────────

@router.get("/avisos-enviados")
def avisos_enviados(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    rows = (
        db.query(AvisoDirectivo, Usuario)
        .join(Usuario, AvisoDirectivo.receptor_id == Usuario.id)
        .filter(AvisoDirectivo.emisor_id == current_user.id)
        .order_by(AvisoDirectivo.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id":         av.id,
            "mensaje":    av.mensaje,
            "leido":      av.leido,
            "leido_at":   av.leido_at,
            "created_at": av.created_at,
            "receptor":   f"{u.nombre} {u.apellido}",
            "receptor_rol": u.rol,
        }
        for av, u in rows
    ]


# ── GET /directivo/supervision/personal/{persona_id}/comunicados ──────────────

@router.get("/supervision/personal/{persona_id}/comunicados")
def comunicados_personal(
    persona_id:   str,
    pagina:       int = Query(1, ge=1),
    por_pagina:   int = Query(10, le=50),
    q:            str = Query(""),
    fecha_exacta: str | None = Query(None),   # YYYY-MM-DD  → filtra ese día
    mes:          int | None = Query(None),   # 1-12        → filtra ese mes
    anio:         int | None = Query(None),   # 2024, 2025…
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    persona = db.query(Usuario).filter(Usuario.id == persona_id, Usuario.activo == True).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    niveles = _niveles(current_user)
    if persona.nivel not in niveles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso")

    base = db.query(Comunicado).filter(Comunicado.auxiliar_id == persona_id)

    if q.strip():
        base = base.filter(Comunicado.asunto.ilike(f"%{q.strip()}%"))

    if fecha_exacta:
        try:
            d = date.fromisoformat(fecha_exacta)
            base = base.filter(func.date(Comunicado.created_at) == d)
        except ValueError:
            pass
    elif mes and anio:
        import calendar
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        base = base.filter(
            func.date(Comunicado.created_at) >= date(anio, mes, 1),
            func.date(Comunicado.created_at) <= date(anio, mes, ultimo_dia),
        )

    total        = base.count()
    comunicados  = (
        base.order_by(Comunicado.created_at.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )

    items = []
    for c in comunicados:
        total_dest = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(ComunicadoDestinatario.comunicado_id == c.id)
            .scalar()
        ) or 0
        leidos = (
            db.query(func.count(ComunicadoDestinatario.id))
            .filter(
                ComunicadoDestinatario.comunicado_id == c.id,
                ComunicadoDestinatario.leido_apoderado == True,
            )
            .scalar()
        ) or 0
        items.append({
            "id":         c.id,
            "asunto":     c.asunto,
            "mensaje":    c.mensaje[:150] if c.mensaje else "",
            "created_at": c.created_at,
            "total":      total_dest,
            "leidos":     leidos,
            "pct":        round(leidos / total_dest * 100) if total_dest > 0 else 0,
        })

    return {
        "total":         total,
        "pagina":        pagina,
        "total_paginas": max(1, (total + por_pagina - 1) // por_pagina),
        "items":         items,
    }


# ── GET /directivo/supervision/justificaciones ────────────────────────────────

@router.get("/supervision/justificaciones")
def justificaciones_nivel(
    nivel:      str = Query(...),
    estado:     str = Query("pendiente"),
    pagina:     int = Query(1, ge=1),
    por_pagina: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    niveles = _niveles(current_user)
    if nivel not in niveles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a este nivel")
    if estado not in ("pendiente", "aprobada", "rechazada"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Estado inválido")

    base = (
        db.query(Justificacion, Asistencia, Estudiante)
        .join(Asistencia, Justificacion.asistencia_id == Asistencia.id)
        .join(Estudiante, Asistencia.estudiante_id == Estudiante.id)
        .filter(
            Justificacion.estado == estado,
            Estudiante.nivel     == nivel,
        )
    )

    total = base.count()
    orden = Justificacion.created_at.asc() if estado == "pendiente" else Justificacion.created_at.desc()
    rows  = (
        base.order_by(orden)
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )

    return {
        "total":         total,
        "pagina":        pagina,
        "total_paginas": max(1, (total + por_pagina - 1) // por_pagina),
        "items": [
            {
                "id":               j.id,
                "estudiante":       f"{e.nombre} {e.apellido}",
                "grado":            e.grado,
                "seccion":          e.seccion,
                "motivo":           j.motivo,
                "estado":           j.estado,
                "fecha":            a.fecha.isoformat(),
                "created_at":       j.created_at,
                "adjunto_nombre":   j.adjunto_nombre,
                "adjunto_drive_url": j.adjunto_drive_url,
            }
            for j, a, e in rows
        ],
    }


# ── POST /directivo/circular ──────────────────────────────────────────────────

@router.post("/circular", status_code=201)
def enviar_circular(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    asunto  = (data.get("asunto") or "").strip()
    mensaje = (data.get("mensaje") or "").strip()
    if not asunto or not mensaje:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Asunto y mensaje son requeridos",
        )
    if len(asunto) > 200:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Asunto muy largo")
    if len(mensaje) > 3000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Mensaje muy largo")

    cargo   = CARGO_DIRECTIVO.get(current_user.nivel or "todos", "Directivo")
    niveles = _niveles(current_user)

    estudiantes = (
        db.query(Estudiante)
        .filter(Estudiante.activo == True, Estudiante.nivel.in_(niveles))
        .all()
    )
    if not estudiantes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No hay estudiantes en este nivel",
        )

    batch_id   = str(uuid.uuid4())
    comunicado = Comunicado(
        auxiliar_id=current_user.id,
        batch_id=batch_id,
        asunto=asunto,
        mensaje=mensaje,
        adjunto_nombre=data.get("adjunto_nombre"),
        adjunto_drive_url=data.get("adjunto_drive_url"),
        tipo_envio="masivo",
        tipo="circular",
        cargo_emisor=cargo,
    )
    db.add(comunicado)
    db.flush()

    for est in estudiantes:
        db.add(ComunicadoDestinatario(
            comunicado_id=comunicado.id,
            estudiante_id=est.id,
            correo_enviado=False,
            leido_apoderado=False,
        ))

    db.commit()
    db.refresh(comunicado)

    try:
        from services.gmail_service import notificar_comunicado_bg
        notificar_comunicado_bg(comunicado.id)
    except Exception:
        pass
    try:
        from services.firebase_service import push_comunicado_bg
        push_comunicado_bg(comunicado.id)
    except Exception:
        pass

    total = (
        db.query(ComunicadoDestinatario)
        .filter(ComunicadoDestinatario.comunicado_id == comunicado.id)
        .count()
    )
    return {
        "id":                comunicado.id,
        "asunto":            comunicado.asunto,
        "mensaje":           comunicado.mensaje,
        "cargo_emisor":      comunicado.cargo_emisor,
        "tipo":              comunicado.tipo,
        "total_destinatarios": total,
        "created_at":        comunicado.created_at,
    }


# ── GET /directivo/circulares ─────────────────────────────────────────────────

@router.get("/circulares")
def mis_circulares(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("directivo")),
):
    circulares = (
        db.query(Comunicado)
        .filter(
            Comunicado.auxiliar_id == current_user.id,
            Comunicado.tipo == "circular",
        )
        .order_by(Comunicado.created_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for c in circulares:
        total = (
            db.query(ComunicadoDestinatario)
            .filter(ComunicadoDestinatario.comunicado_id == c.id)
            .count()
        )
        leidos = (
            db.query(ComunicadoDestinatario)
            .filter(
                ComunicadoDestinatario.comunicado_id == c.id,
                ComunicadoDestinatario.leido_apoderado == True,
            )
            .count()
        )
        result.append({
            "id":                c.id,
            "asunto":            c.asunto,
            "mensaje":           c.mensaje,
            "cargo_emisor":      c.cargo_emisor,
            "adjunto_nombre":    c.adjunto_nombre,
            "adjunto_drive_url": c.adjunto_drive_url,
            "created_at":        c.created_at,
            "total_destinatarios": total,
            "leidos":            leidos,
        })

    return result
