"""
Router: Recojo Responsable
──────────────────────────
Roles:
  • apoderado      → solicitar / ver sus autorizados / revocar
  • admin          → gestionar solicitudes, activar, revocar, imprimir fotocheck
  • i-auxiliar /
    p-auxiliar /
    s-auxiliar /
    tutor          → escanear QR del fotocheck + ver log del día
"""
from __future__ import annotations

import base64
import io
from datetime import date, datetime, timedelta
from typing import Optional

from PIL import Image


from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db, require_roles
from models.asistencia import Asistencia
from models.dia_no_laborable import DiasNoLaborables
from models.estudiante import ApoderadoEstudiante, Estudiante
from models.recojo import PersonaAutorizada, RecojoLog
from models.usuario import Usuario
from services.qr_service import generar_qr_png, generar_qr_solo_png, generar_qr_token

router = APIRouter()

ROLES_ESCANEO = ["i-auxiliar", "p-auxiliar", "s-auxiliar", "tutor", "admin"]


# ── Helpers internos ────────────────────────────────────────────────────────

def _verificar_apoderado(user: Usuario):
    if user.rol != "apoderado" and not user.es_apoderado:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo apoderados")


def _mis_hijos_ids(apoderado_id: str, db: Session) -> list[str]:
    return [
        r[0]
        for r in db.query(ApoderadoEstudiante.estudiante_id)
        .filter(ApoderadoEstudiante.apoderado_id == apoderado_id)
        .all()
    ]


def _generar_fotocheck_png(persona: PersonaAutorizada, estudiante: Estudiante) -> bytes:
    """
    Genera el PNG del fotocheck usando exactamente el mismo código que
    los carnets de estudiantes (generar_qr_png de qr_service).
    Campos adaptados:
      nombre/apellido → nombre de la persona autorizada
      nivel           → 'RECOJO SEGURO'
      grado/seccion   → parentesco y datos del alumno
    """
    alumno = f"{estudiante.nombre} {estudiante.apellido}"
    vig = ""
    if persona.vigencia_hasta:
        vig = f"Vigencia: {persona.vigencia_hasta.strftime('%d/%m/%Y')}"

    return generar_qr_png(
        qr_token=persona.qr_token,
        nombre=persona.nombre,
        apellido=persona.apellido,
        nivel=f"Recojo Seguro  |  {persona.parentesco}",
        grado=alumno,
        seccion=vig,
    )



# ════════════════════════════════════════════════════════════════════════════
# APODERADO — gestión de sus personas autorizadas
# ════════════════════════════════════════════════════════════════════════════

@router.get("/mis-autorizados")
def mis_autorizados(
    estudiante_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista personas autorizadas de los hijos del apoderado."""
    _verificar_apoderado(current_user)
    ids_hijos = _mis_hijos_ids(current_user.id, db)
    if not ids_hijos:
        return []

    q = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.estudiante_id.in_(ids_hijos)
    )
    if estudiante_id:
        if estudiante_id not in ids_hijos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No es tu hijo")
        q = q.filter(PersonaAutorizada.estudiante_id == estudiante_id)

    personas = q.order_by(PersonaAutorizada.created_at.desc()).all()

    result = []
    for p in personas:
        est = db.query(Estudiante).filter(Estudiante.id == p.estudiante_id).first()
        result.append({
            "id":            p.id,
            "estudiante_id": p.estudiante_id,
            "estudiante":    {
                "nombre":   est.nombre   if est else "",
                "apellido": est.apellido if est else "",
                "grado":    est.grado    if est else "",
                "seccion":  est.seccion  if est else "",
            },
            "nombre":        p.nombre,
            "apellido":      p.apellido,
            "dni":           p.dni,
            "parentesco":    p.parentesco,
            "foto_url":      p.foto_url,
            "estado":        p.estado,
            "vigencia_hasta": p.vigencia_hasta.isoformat() if p.vigencia_hasta else None,
            "created_at":    p.created_at.isoformat() if p.created_at else None,
        })
    return result


@router.post("/solicitar", status_code=201)
def solicitar_autorizado(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Apoderado solicita autorizar a una persona para recoger a su hijo."""
    _verificar_apoderado(current_user)

    estudiante_id = body.get("estudiante_id")
    if not estudiante_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "estudiante_id requerido")

    ids_hijos = _mis_hijos_ids(current_user.id, db)
    if estudiante_id not in ids_hijos:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes relación con este estudiante")

    # Validar campos obligatorios
    nombre     = (body.get("nombre")     or "").strip()
    apellido   = (body.get("apellido")   or "").strip()
    dni        = (body.get("dni")        or "").strip()
    parentesco = (body.get("parentesco") or "").strip()

    if not all([nombre, apellido, dni, parentesco]):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "nombre, apellido, dni y parentesco son obligatorios",
        )

    # Procesar foto (base64 JPEG recortada a 600px/q82 — nítida en pantallas 2x-3x DPI)
    foto_url = None
    foto_raw = body.get("foto_url") or body.get("foto")
    if foto_raw and len(foto_raw) > 10_000_000:  # ~7.5MB imagen original → rechazar
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Foto demasiado grande (máx 7MB)")
    if foto_raw:
        try:
            # Puede llegar como "data:image/...;base64,XXXX" o solo el base64
            if "," in foto_raw:
                foto_b64 = foto_raw.split(",", 1)[1]
            else:
                foto_b64 = foto_raw
            img_data = base64.b64decode(foto_b64)
            img = Image.open(io.BytesIO(img_data)).convert("RGB")
            # Redimensionar: max 600px en lado mayor — nítido en móviles 2x/3x DPI
            MAX_PX = 600
            w, h = img.size
            if w > MAX_PX or h > MAX_PX:
                ratio = MAX_PX / max(w, h)
                img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=82, optimize=True)
            foto_url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass  # Foto inválida — se ignora, no bloquea la solicitud

    persona = PersonaAutorizada(
        estudiante_id=estudiante_id,
        apoderado_id=current_user.id,
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        parentesco=parentesco,
        foto_url=foto_url,
        estado="pendiente",
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)

    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()

    return {
        "id":       persona.id,
        "estado":   persona.estado,
        "mensaje":  (
            f"Solicitud registrada. Para activar el fotocheck, presenta a "
            f"{nombre} {apellido} en secretaría con su DNI original y realiza el pago correspondiente."
        ),
        "estudiante": {
            "nombre":   est.nombre   if est else "",
            "apellido": est.apellido if est else "",
        },
    }


@router.get("/estado-hoy")
def estado_hoy_apoderado(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Para el apoderado: estado del día de cada hijo.
    Devuelve ingreso y recojo (si ocurrieron hoy).
    """
    _verificar_apoderado(current_user)
    hoy = date.today()
    ids_hijos = _mis_hijos_ids(current_user.id, db)
    if not ids_hijos:
        return []

    resultado = []
    for est_id in ids_hijos:
        est = db.query(Estudiante).filter(Estudiante.id == est_id).first()
        if not est or not est.activo:
            continue

        # Ingreso hoy
        ingreso = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == est_id,
                Asistencia.fecha == hoy,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            )
            .order_by(Asistencia.hora.asc())
            .first()
        )

        # Recojo confirmado hoy
        log = (
            db.query(RecojoLog)
            .filter(
                RecojoLog.estudiante_id == est_id,
                RecojoLog.confirmado == True,          # noqa: E712
                RecojoLog.created_at >= datetime(hoy.year, hoy.month, hoy.day),
            )
            .first()
        )

        responsable_hoy = None
        if log:
            p = db.query(PersonaAutorizada).filter(
                PersonaAutorizada.id == log.persona_autorizada_id
            ).first()
            responsable_hoy = {
                "nombre":        p.nombre       if p else "",
                "apellido":      p.apellido     if p else "",
                "parentesco":    p.parentesco   if p else "",
                "foto_snapshot": log.foto_snapshot,
                "hora":          log.confirmado_at.strftime("%H:%M") if log.confirmado_at else "",
                "log_id":        log.id,
                "reportado":     log.reportado,
            }

        resultado.append({
            "estudiante": {
                "id":       est.id,
                "nombre":   est.nombre,
                "apellido": est.apellido,
                "nivel":    est.nivel,
                "grado":    est.grado,
                "seccion":  est.seccion,
                "foto_url": est.foto_url,
            },
            "ingreso": {
                "hora":   ingreso.hora.strftime("%H:%M") if ingreso and ingreso.hora else None,
                "estado": ingreso.estado if ingreso else None,
            } if ingreso else None,
            "recojo": responsable_hoy,
        })
    return resultado


@router.get("/historial")
def historial_apoderado(
    limite: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Historial de recojos confirmados de los hijos del apoderado."""
    _verificar_apoderado(current_user)
    ids_hijos = _mis_hijos_ids(current_user.id, db)
    if not ids_hijos:
        return []

    logs = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.estudiante_id.in_(ids_hijos),
            RecojoLog.confirmado == True,              # noqa: E712
        )
        .order_by(RecojoLog.confirmado_at.desc())
        .limit(limite)
        .all()
    )

    resultado = []
    for log in logs:
        est = db.query(Estudiante).filter(Estudiante.id == log.estudiante_id).first()
        p   = db.query(PersonaAutorizada).filter(
            PersonaAutorizada.id == log.persona_autorizada_id
        ).first()
        resultado.append({
            "id":    log.id,
            "fecha": log.confirmado_at.strftime("%d/%m/%Y") if log.confirmado_at else "",
            "hora":  log.confirmado_at.strftime("%H:%M")    if log.confirmado_at else "",
            "reportado": log.reportado,
            "estudiante": {
                "nombre":   est.nombre    if est else "",
                "apellido": est.apellido  if est else "",
                "nivel":    est.nivel     if est else "",
                "grado":    est.grado     if est else "",
                "seccion":  est.seccion   if est else "",
                "foto_url": est.foto_url  if est else None,
            },
            "responsable": {
                "nombre":        p.nombre      if p else "",
                "apellido":      p.apellido    if p else "",
                "parentesco":    p.parentesco  if p else "",
                "foto_snapshot": log.foto_snapshot,
            },
        })
    return resultado


@router.get("/calendario-mes")
def calendario_mes_apoderado(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020, le=2099),
    estudiante_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Para el apoderado: estado de recojo por día laborable del mes.
    Estados: recogido | pendiente | sin_recojo | no_asistio
    """
    _verificar_apoderado(current_user)
    ids_hijos = _mis_hijos_ids(current_user.id, db)
    if not ids_hijos:
        return {"estados": {}, "detalle": {}, "dias_no_lab": {}}

    if estudiante_id:
        if estudiante_id not in ids_hijos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No es tu hijo")
        ids_consulta = [estudiante_id]
    else:
        ids_consulta = ids_hijos[:1]  # primer hijo si no se especifica

    inicio = date(anio, mes, 1)
    fin    = date(anio + 1, 1, 1) - timedelta(days=1) if mes == 12 else date(anio, mes + 1, 1) - timedelta(days=1)
    hoy    = date.today()

    # Días no laborables del mes
    dnl_rows = db.query(DiasNoLaborables).filter(
        DiasNoLaborables.fecha >= inicio,
        DiasNoLaborables.fecha <= fin,
    ).all()
    dias_no_lab = {str(d.fecha): d.motivo for d in dnl_rows}

    # Ingresos del mes (presencia)
    ingresos = db.query(Asistencia).filter(
        Asistencia.estudiante_id.in_(ids_consulta),
        Asistencia.fecha >= inicio,
        Asistencia.fecha <= fin,
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
    ).all()
    asistio_set = {(str(a.fecha), a.estudiante_id) for a in ingresos}

    # Recojos confirmados del mes
    mes_inicio_dt = datetime(anio, mes, 1)
    mes_fin_dt    = datetime(anio + 1, 1, 1) if mes == 12 else datetime(anio, mes + 1, 1)
    logs = db.query(RecojoLog).filter(
        RecojoLog.estudiante_id.in_(ids_consulta),
        RecojoLog.confirmado == True,          # noqa: E712
        RecojoLog.confirmado_at >= mes_inicio_dt,
        RecojoLog.confirmado_at <  mes_fin_dt,
    ).all()

    log_map: dict[tuple, RecojoLog] = {}
    for log in logs:
        if log.confirmado_at:
            key = (log.confirmado_at.strftime("%Y-%m-%d"), log.estudiante_id)
            if key not in log_map:
                log_map[key] = log

    estados: dict[str, str] = {}
    detalle: dict[str, dict] = {}

    est_id = ids_consulta[0]
    d = inicio
    while d <= fin:
        if d.weekday() < 5:  # L-V
            dstr = str(d)
            if dstr not in dias_no_lab and d <= hoy:
                key = (dstr, est_id)
                if key in log_map:
                    log = log_map[key]
                    p   = db.query(PersonaAutorizada).filter(
                        PersonaAutorizada.id == log.persona_autorizada_id
                    ).first()
                    estados[dstr] = "recogido"
                    detalle[dstr] = {
                        "hora":          log.confirmado_at.strftime("%H:%M") if log.confirmado_at else "",
                        "nombre":        p.nombre      if p else "",
                        "apellido":      p.apellido    if p else "",
                        "parentesco":    p.parentesco  if p else "",
                        "foto_snapshot": log.foto_snapshot,
                        "reportado":     log.reportado,
                        "log_id":        log.id,
                    }
                elif (dstr, est_id) in asistio_set:
                    estados[dstr] = "pendiente" if d == hoy else "sin_recojo"
                else:
                    estados[dstr] = "no_asistio"
        d += timedelta(days=1)

    return {"estados": estados, "detalle": detalle, "dias_no_lab": dias_no_lab}


@router.post("/reportar/{log_id}", status_code=200)
def reportar_irregularidad(
    log_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Apoderado reporta un recojo sospechoso. Queda marcado para revisión del admin."""
    _verificar_apoderado(current_user)
    ids_hijos = _mis_hijos_ids(current_user.id, db)

    log = db.query(RecojoLog).filter(RecojoLog.id == log_id).first()
    if not log:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")
    if log.estudiante_id not in ids_hijos:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No corresponde a tu hijo")

    log.reportado        = True
    log.reportado_motivo = (body.get("motivo") or "").strip() or "Sin motivo especificado"
    log.reportado_at     = datetime.now()
    db.commit()
    return {"ok": True, "mensaje": "Reporte enviado al administrador del colegio."}


@router.delete("/autorizado/{persona_id}", status_code=204)
def revocar_mi_autorizado(
    persona_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Apoderado revoca a una persona autorizada que él solicitó."""
    _verificar_apoderado(current_user)

    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == persona_id,
        PersonaAutorizada.apoderado_id == current_user.id,
    ).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado o no te pertenece")

    persona.estado = "revocado"
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# ADMIN — gestión completa
# ════════════════════════════════════════════════════════════════════════════

@router.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Contadores rápidos por estado para el dashboard admin."""
    from sqlalchemy import func
    rows = (
        db.query(PersonaAutorizada.estado, func.count(PersonaAutorizada.id))
        .group_by(PersonaAutorizada.estado)
        .all()
    )
    counts = {estado: n for estado, n in rows}
    return {
        "pendiente": counts.get("pendiente", 0),
        "activo":    counts.get("activo",    0),
        "revocado":  counts.get("revocado",  0),
    }


@router.get("/admin/solicitudes")
def admin_solicitudes(
    estado:  Optional[str] = Query(None),   # pendiente | activo | revocado
    nivel:   Optional[str] = Query(None),
    grado:   Optional[str] = Query(None),
    seccion: Optional[str] = Query(None),
    q:       Optional[str] = Query(None),   # buscar nombre/apellido/dni
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Admin: lista todas las solicitudes de personas autorizadas."""
    query = db.query(PersonaAutorizada)

    if estado:
        query = query.filter(PersonaAutorizada.estado == estado)
    if q:
        like = f"%{q}%"
        query = query.filter(
            PersonaAutorizada.nombre.ilike(like)
            | PersonaAutorizada.apellido.ilike(like)
            | PersonaAutorizada.dni.ilike(like)
        )

    personas = query.order_by(PersonaAutorizada.created_at.desc()).all()

    result = []
    for p in personas:
        est = db.query(Estudiante).filter(Estudiante.id == p.estudiante_id).first()
        apo = db.query(Usuario).filter(Usuario.id == p.apoderado_id).first()

        # Filtrar por nivel / grado / sección del estudiante
        if nivel   and est and est.nivel   != nivel:   continue
        if grado   and est and est.grado   != grado:   continue
        if seccion and est and est.seccion != seccion: continue

        result.append({
            "id":            p.id,
            "nombre":        p.nombre,
            "apellido":      p.apellido,
            "dni":           p.dni,
            "parentesco":    p.parentesco,
            "foto_url":      p.foto_url,
            "estado":        p.estado,
            "pago_confirmado": p.pago_confirmado,
            "precio_fotocheck": p.precio_fotocheck,
            "observacion_admin": p.observacion_admin,
            "qr_token":      p.qr_token,
            "vigencia_hasta": p.vigencia_hasta.isoformat() if p.vigencia_hasta else None,
            "fotocheck_emitido_at": (
                p.fotocheck_emitido_at.isoformat() if p.fotocheck_emitido_at else None
            ),
            "created_at":    p.created_at.isoformat() if p.created_at else None,
            "estudiante": {
                "id":       est.id      if est else "",
                "nombre":   est.nombre  if est else "",
                "apellido": est.apellido if est else "",
                "grado":    est.grado   if est else "",
                "seccion":  est.seccion if est else "",
                "nivel":    est.nivel   if est else "",
                "foto_url": est.foto_url if est else None,
            },
            "apoderado": {
                "nombre":   apo.nombre   if apo else "",
                "apellido": apo.apellido if apo else "",
                "telefono": apo.telefono if apo else "",
            },
        })
    return result


@router.get("/admin/{persona_id}/qr-solo")
def admin_qr_solo(
    persona_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Retorna solo el QR (sin decoraciones) de una persona autorizada activa, en base64."""
    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == persona_id
    ).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")
    if persona.estado != "activo" or not persona.qr_token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fotocheck no activo o sin QR")

    png_bytes = generar_qr_solo_png(persona.qr_token)
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return {"imagen_base64": f"data:image/png;base64,{b64}"}


@router.put("/admin/{persona_id}/activar")
def admin_activar(
    persona_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Admin activa la solicitud: genera QR, registra pago y fija vigencia."""
    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == persona_id
    ).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")
    if persona.estado == "activo":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ya está activo")

    # Generar QR único para el fotocheck (prefijo distinto al de estudiantes)
    qr = f"RECOJO-{persona_id[:8].upper()}-{generar_qr_token()[7:]}"
    persona.qr_token = qr
    persona.estado = "activo"
    persona.pago_confirmado = True
    persona.precio_fotocheck = str(body.get("precio", "5.00"))
    persona.observacion_admin = body.get("observacion") or persona.observacion_admin

    # Vigencia: hasta 31/12 del año actual por defecto
    anio = date.today().year
    persona.vigencia_hasta = body.get("vigencia_hasta") or date(anio, 12, 31)
    persona.fotocheck_emitido_at = datetime.now()

    db.commit()
    db.refresh(persona)
    return {"ok": True, "qr_token": persona.qr_token, "estado": persona.estado}


@router.put("/admin/{persona_id}/revocar")
def admin_revocar(
    persona_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Admin revoca un fotocheck activo o cancela una solicitud pendiente."""
    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == persona_id
    ).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")

    persona.estado = "revocado"
    persona.observacion_admin = body.get("motivo") or persona.observacion_admin
    db.commit()
    return {"ok": True}


@router.get("/admin/{persona_id}/fotocheck.png")
def admin_fotocheck_png(
    persona_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Genera y retorna el PNG del fotocheck listo para imprimir."""
    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == persona_id
    ).first()
    if not persona:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")
    if persona.estado != "activo" or not persona.qr_token:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El fotocheck aún no está activo o no tiene QR generado",
        )

    estudiante = db.query(Estudiante).filter(
        Estudiante.id == persona.estudiante_id
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")

    png_bytes = _generar_fotocheck_png(persona, estudiante)

    nombre_archivo = (
        f"fotocheck_{persona.nombre}_{persona.apellido}_{persona.dni}.png"
        .replace(" ", "_")
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"'
        },
    )


@router.get("/admin/panel-apoderados")
def admin_panel_apoderados(
    nivel:   Optional[str] = Query(None),
    grado:   Optional[str] = Query(None),
    seccion: Optional[str] = Query(None),
    q:       Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """
    Panel principal: todos los alumnos activos con sus apoderados vinculados
    y el estado de fotocheck de cada uno. Reemplaza la vista de 'tabs' anterior.
    """
    estudq = db.query(Estudiante).filter(Estudiante.activo == True)
    if nivel:   estudq = estudq.filter(Estudiante.nivel == nivel)
    if grado:   estudq = estudq.filter(Estudiante.grado == grado)
    if seccion: estudq = estudq.filter(Estudiante.seccion == seccion)

    estudiantes = estudq.order_by(
        Estudiante.nivel, Estudiante.grado, Estudiante.seccion, Estudiante.apellido
    ).all()

    result = []
    for est in estudiantes:
        vinculos = db.query(ApoderadoEstudiante).filter(
            ApoderadoEstudiante.estudiante_id == est.id
        ).all()

        apoderados_data = []
        for v in vinculos:
            apo = db.query(Usuario).filter(Usuario.id == v.apoderado_id).first()
            if not apo:
                continue

            pa = (
                db.query(PersonaAutorizada)
                .filter(
                    PersonaAutorizada.apoderado_id == apo.id,
                    PersonaAutorizada.estudiante_id == est.id,
                )
                .order_by(PersonaAutorizada.created_at.desc())
                .first()
            )

            apoderados_data.append({
                "usuario_id": apo.id,
                "nombre":     apo.nombre,
                "apellido":   apo.apellido,
                "dni":        apo.dni,
                "telefono":   apo.telefono,
                "foto_url":   apo.foto_url,
                "fotocheck":  {
                    "id":                   pa.id,
                    "estado":               pa.estado,
                    "parentesco":           pa.parentesco,
                    "qr_token":             pa.qr_token,
                    "vigencia_hasta":       pa.vigencia_hasta.isoformat() if pa.vigencia_hasta else None,
                    "precio_fotocheck":     pa.precio_fotocheck,
                    "fotocheck_emitido_at": pa.fotocheck_emitido_at.isoformat() if pa.fotocheck_emitido_at else None,
                } if pa else None,
            })

        # Filtro de texto: alumno o algún apoderado coincide
        if q:
            qlow = q.lower()
            match_est = qlow in est.nombre.lower() or qlow in est.apellido.lower()
            match_apo = any(
                qlow in a["nombre"].lower() or
                qlow in a["apellido"].lower() or
                qlow in (a["dni"] or "")
                for a in apoderados_data
            )
            if not match_est and not match_apo:
                continue

        result.append({
            "id":         est.id,
            "nombre":     est.nombre,
            "apellido":   est.apellido,
            "grado":      est.grado,
            "seccion":    est.seccion,
            "nivel":      est.nivel,
            "foto_url":   est.foto_url,
            "apoderados": apoderados_data,
        })

    return result


@router.post("/admin/activar-directo")
def admin_activar_directo(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """
    Admin activa directamente el fotocheck de un apoderado registrado,
    sin que el apoderado haya enviado una solicitud previa.
    Usa los datos del perfil del apoderado (foto, nombre, apellido, dni).
    """
    apoderado_id  = body.get("apoderado_id")
    estudiante_id = body.get("estudiante_id")
    parentesco    = body.get("parentesco", "padre")
    precio        = str(body.get("precio", "5.00"))
    observacion   = body.get("observacion") or ""

    if not apoderado_id or not estudiante_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Faltan datos requeridos")

    apo = db.query(Usuario).filter(Usuario.id == apoderado_id).first()
    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not apo or not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario o estudiante no encontrado")

    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == apoderado_id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El apoderado no está vinculado a este alumno")

    pa = (
        db.query(PersonaAutorizada)
        .filter(
            PersonaAutorizada.apoderado_id == apoderado_id,
            PersonaAutorizada.estudiante_id == estudiante_id,
        )
        .order_by(PersonaAutorizada.created_at.desc())
        .first()
    )

    if pa and pa.estado == "activo":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ya tiene fotocheck activo")

    if not pa:
        pa = PersonaAutorizada(
            estudiante_id = estudiante_id,
            apoderado_id  = apoderado_id,
            nombre        = apo.nombre,
            apellido      = apo.apellido,
            dni           = apo.dni,
            parentesco    = parentesco,
            foto_url      = apo.foto_url,
        )
        db.add(pa)
        db.flush()
    else:
        # Reactivar: actualiza datos del perfil
        pa.nombre     = apo.nombre
        pa.apellido   = apo.apellido
        pa.dni        = apo.dni
        pa.parentesco = parentesco
        pa.foto_url   = apo.foto_url

    pa.estado            = "activo"
    pa.pago_confirmado   = True
    pa.precio_fotocheck  = precio
    pa.observacion_admin = observacion

    anio = date.today().year
    pa.vigencia_hasta       = date(anio, 12, 31)
    pa.fotocheck_emitido_at = datetime.now()
    pa.qr_token = f"RECOJO-{pa.id[:8].upper()}-{generar_qr_token()[7:]}"

    db.commit()
    db.refresh(pa)
    return {"ok": True, "persona_id": pa.id, "qr_token": pa.qr_token}


# ════════════════════════════════════════════════════════════════════════════
# ESCANEO — auxiliar / tutor valida el fotocheck en la puerta
# ════════════════════════════════════════════════════════════════════════════

@router.post("/buscar-dni")
def buscar_por_dni(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Alternativa al escaneo QR: busca un responsable por su DNI.
    Útil cuando el QR del fotocheck no escanea correctamente.
    Retorna la misma estructura que /escanear.
    """
    if current_user.rol not in ROLES_ESCANEO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    dni = (body.get("dni") or "").strip()
    if not dni:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "DNI requerido")

    # Buscar persona por DNI — priorizar activos
    todas = db.query(PersonaAutorizada).filter(PersonaAutorizada.dni == dni).all()
    if not todas:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No se encontró ningún responsable registrado con DNI {dni}.",
        )
    persona = next((p for p in todas if p.estado == "activo"), todas[0])

    # A partir de aquí reutiliza exactamente la misma lógica que /escanear
    # usando el qr_token de la persona encontrada
    body_proxy = {"qr_token": persona.qr_token or ""}
    return escanear_fotocheck.__wrapped__(body_proxy, db, current_user) \
        if hasattr(escanear_fotocheck, "__wrapped__") \
        else _logica_escaneo(persona, db, current_user)


def _logica_escaneo(persona: "PersonaAutorizada", db: Session, current_user):
    """Núcleo compartido entre /escanear y /buscar-dni."""
    estudiante = db.query(Estudiante).filter(Estudiante.id == persona.estudiante_id).first()

    autorizado = persona.estado == "activo"
    vencido = False
    if autorizado and persona.vigencia_hasta:
        if date.today() > persona.vigencia_hasta:
            autorizado = False
            vencido = True

    hoy = date.today()
    log_confirmado_hoy = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.estudiante_id == persona.estudiante_id,
            RecojoLog.confirmado == True,              # noqa: E712
            RecojoLog.created_at >= datetime(hoy.year, hoy.month, hoy.day),
        )
        .first()
    )
    ya_recogido    = log_confirmado_hoy is not None
    recogido_a_las = None
    recogido_por   = None
    if ya_recogido:
        autorizado = False
        if log_confirmado_hoy.confirmado_at:
            recogido_a_las = log_confirmado_hoy.confirmado_at.strftime("%H:%M")
        persona_previa = db.query(PersonaAutorizada).filter(
            PersonaAutorizada.id == log_confirmado_hoy.persona_autorizada_id
        ).first()
        if persona_previa:
            recogido_por = {
                "nombre":        persona_previa.nombre,
                "apellido":      persona_previa.apellido,
                "parentesco":    persona_previa.parentesco,
                "foto_snapshot": log_confirmado_hoy.foto_snapshot,
            }

    alumno_presente     = False
    alumno_hora_ingreso = None
    if estudiante:
        ingreso_hoy = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == estudiante.id,
                Asistencia.fecha == hoy,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            )
            .order_by(Asistencia.hora.asc())
            .first()
        )
        if ingreso_hoy:
            alumno_presente     = True
            alumno_hora_ingreso = ingreso_hoy.hora.strftime("%H:%M") if ingreso_hoy.hora else None

    log_id = None
    if autorizado:
        log = RecojoLog(
            persona_autorizada_id=persona.id,
            estudiante_id=persona.estudiante_id,
            escaneado_por=current_user.id,
            confirmado=False,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        log_id = log.id

    return {
        "autorizado":          autorizado,
        "estado":              persona.estado,
        "vencido":             vencido,
        "ya_recogido":         ya_recogido,
        "recogido_a_las":      recogido_a_las,
        "recogido_por":        recogido_por,
        "alumno_presente":     alumno_presente,
        "alumno_hora_ingreso": alumno_hora_ingreso,
        "log_id":              log_id,
        "persona": {
            "id":             persona.id,
            "nombre":         persona.nombre,
            "apellido":       persona.apellido,
            "dni":            persona.dni,
            "parentesco":     persona.parentesco,
            "foto_url":       persona.foto_url,
            "vigencia_hasta": persona.vigencia_hasta.isoformat() if persona.vigencia_hasta else None,
        },
        "estudiante": {
            "id":       estudiante.id       if estudiante else "",
            "nombre":   estudiante.nombre   if estudiante else "",
            "apellido": estudiante.apellido if estudiante else "",
            "grado":    estudiante.grado    if estudiante else "",
            "seccion":  estudiante.seccion  if estudiante else "",
            "nivel":    estudiante.nivel    if estudiante else "",
            "foto_url": estudiante.foto_url if estudiante else None,
        } if estudiante else None,
    }


@router.post("/escanear")
def escanear_fotocheck(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    El auxiliar escanea el QR del fotocheck físico.

    Flujo de seguridad:
      1. Verifica que el token sea válido y esté activo.
      2. Verifica vigencia.
      3. Capa 1: bloquea si el alumno ya fue recogido hoy (log confirmado).
      4. Consulta asistencia del alumno para saber si está presente.
      5. Crea un log NO confirmado — el auxiliar debe presionar "Confirmar entrega".

    La confirmación real ocurre en POST /recojo/confirmar/{log_id}.
    """
    if current_user.rol not in ROLES_ESCANEO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso para escanear recojos")

    qr_token = (body.get("qr_token") or "").strip()
    if not qr_token:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "qr_token requerido")

    # ── 1. Buscar persona por token ──────────────────────────────────────────
    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.qr_token == qr_token
    ).first()

    if not persona:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "QR no reconocido. Verifica que sea un fotocheck de recojo válido.",
        )

    return _logica_escaneo(persona, db, current_user)


@router.post("/confirmar/{log_id}")
def confirmar_entrega(
    log_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    El auxiliar confirma visualmente la identidad y presiona 'Confirmar entrega'.

    Acciones:
      - Marca el log como confirmado + guarda foto_snapshot (capa 6).
      - Crea un registro de salida en asistencia vinculando el recojo.
        Se usa tipo="salida" (no salida_especial) porque el recojo es la
        salida definitiva del alumno — no hay regreso posterior.
    """
    if current_user.rol not in ROLES_ESCANEO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    log = db.query(RecojoLog).filter(RecojoLog.id == log_id).first()
    if not log:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log no encontrado")
    if log.confirmado:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esta entrega ya fue confirmada")

    persona = db.query(PersonaAutorizada).filter(
        PersonaAutorizada.id == log.persona_autorizada_id
    ).first()
    estudiante = db.query(Estudiante).filter(
        Estudiante.id == log.estudiante_id
    ).first()

    ahora = datetime.now()

    # ── Marcar log como confirmado (capa 6: foto inmutable del momento) ──────
    log.confirmado    = True
    log.confirmado_at = ahora
    log.foto_snapshot = persona.foto_url if persona else None

    # ── Registrar salida en asistencia ───────────────────────────────────────
    if estudiante:
        observacion_recojo = (
            f"Recogido por {persona.nombre} {persona.apellido} "
            f"({persona.parentesco}) · DNI: {persona.dni}"
            if persona else "Recojo confirmado"
        )
        registro_salida = Asistencia(
            estudiante_id=estudiante.id,
            auxiliar_id=current_user.id,
            fecha=ahora.date(),
            tipo="salida",
            hora=ahora,
            estado="especial",
            motivo_especial=None,
            observacion=observacion_recojo,
            correo_enviado=False,
        )
        db.add(registro_salida)

    db.commit()

    return {
        "ok":           True,
        "confirmado_at": ahora.strftime("%H:%M"),
        "mensaje": (
            f"Entrega confirmada a las {ahora.strftime('%H:%M')}. "
            "Registro guardado en asistencia."
        ),
    }


NIVEL_POR_ROL = {
    "i-auxiliar": "inicial",
    "p-auxiliar": "primaria",
    "s-auxiliar": "secundaria",
}


@router.get("/resumen-hoy")
def resumen_hoy(
    nivel: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Resumen del día de recojo para el auxiliar/admin.
    Devuelve: contadores (presentes / recogidos / pendientes) + listas detalladas.
    """
    if current_user.rol not in ROLES_ESCANEO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    # Determinar nivel según rol (el admin puede pasar ?nivel=)
    nivel_filtro = nivel or NIVEL_POR_ROL.get(current_user.rol)

    hoy = date.today()
    inicio_hoy = datetime(hoy.year, hoy.month, hoy.day)

    # ── 1. Alumnos con ingreso hoy ───────────────────────────────────────────
    ingresos_hoy = (
        db.query(Asistencia)
        .filter(
            Asistencia.fecha == hoy,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        )
        .all()
    )
    ids_con_ingreso = {a.estudiante_id for a in ingresos_hoy}
    mapa_hora_ingreso = {a.estudiante_id: a.hora for a in ingresos_hoy}

    # Obtener estudiantes filtrados por nivel
    q_est = db.query(Estudiante).filter(
        Estudiante.id.in_(ids_con_ingreso),
        Estudiante.activo == True,                # noqa: E712
    )
    if nivel_filtro:
        q_est = q_est.filter(Estudiante.nivel == nivel_filtro)
    estudiantes_presentes = {e.id: e for e in q_est.all()}

    # ── 2. Recojos confirmados hoy ───────────────────────────────────────────
    logs_confirmados = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.confirmado == True,          # noqa: E712
            RecojoLog.created_at >= inicio_hoy,
        )
        .order_by(RecojoLog.confirmado_at.desc())
        .all()
    )
    ids_recogidos = {l.estudiante_id for l in logs_confirmados}

    # ── 3. Calcular pendientes ───────────────────────────────────────────────
    ids_pendientes = set(estudiantes_presentes.keys()) - ids_recogidos

    # ── 4. Construir lista recogidos ─────────────────────────────────────────
    lista_recogidos = []
    for log in logs_confirmados:
        est = estudiantes_presentes.get(log.estudiante_id)
        if not est and nivel_filtro:
            # El alumno recogido puede no estar en `estudiantes_presentes`
            # si fue recogido desde otro nivel — buscarlo de todos modos
            est = db.query(Estudiante).filter(Estudiante.id == log.estudiante_id).first()
            if est and est.nivel != nivel_filtro:
                continue  # Filtrar por nivel
        persona = db.query(PersonaAutorizada).filter(
            PersonaAutorizada.id == log.persona_autorizada_id
        ).first()
        lista_recogidos.append({
            "hora":       log.confirmado_at.strftime("%H:%M") if log.confirmado_at else "",
            "estudiante": {
                "nombre":   est.nombre    if est else "",
                "apellido": est.apellido  if est else "",
                "grado":    est.grado     if est else "",
                "seccion":  est.seccion   if est else "",
                "nivel":    est.nivel     if est else "",
                "foto_url": est.foto_url  if est else None,
            },
            "responsable": {
                "nombre":       persona.nombre       if persona else "",
                "apellido":     persona.apellido     if persona else "",
                "parentesco":   persona.parentesco   if persona else "",
                "foto_snapshot": log.foto_snapshot,
            },
        })

    # ── 5. Construir lista pendientes ────────────────────────────────────────
    lista_pendientes = []
    for est_id in ids_pendientes:
        est = estudiantes_presentes[est_id]
        hora_ing = mapa_hora_ingreso.get(est_id)
        lista_pendientes.append({
            "hora_ingreso": hora_ing.strftime("%H:%M") if hora_ing else "",
            "estudiante": {
                "id":       est.id,
                "nombre":   est.nombre,
                "apellido": est.apellido,
                "grado":    est.grado,
                "seccion":  est.seccion,
                "nivel":    est.nivel,
                "foto_url": est.foto_url,
            },
        })
    # Ordenar pendientes por hora de ingreso ascendente
    lista_pendientes.sort(key=lambda x: x["hora_ingreso"])

    return {
        "nivel":            nivel_filtro or "todos",
        "fecha":            hoy.isoformat(),
        "total_presentes":  len(estudiantes_presentes),
        "total_recogidos":  len(ids_recogidos & set(estudiantes_presentes.keys())),
        "total_pendientes": len(ids_pendientes),
        "recogidos":        lista_recogidos,
        "pendientes":       lista_pendientes,
    }


@router.get("/logs-hoy")
def logs_hoy(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registros de recojo del día de hoy — para el auxiliar."""
    if current_user.rol not in ROLES_ESCANEO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    hoy = date.today()
    logs = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.confirmado == True,              # noqa: E712
            RecojoLog.created_at >= datetime(hoy.year, hoy.month, hoy.day),
        )
        .order_by(RecojoLog.confirmado_at.desc())
        .all()
    )

    result = []
    for log in logs:
        p = db.query(PersonaAutorizada).filter(
            PersonaAutorizada.id == log.persona_autorizada_id
        ).first()
        est = db.query(Estudiante).filter(Estudiante.id == log.estudiante_id).first()
        result.append({
            "id":         log.id,
            "hora":       log.confirmado_at.strftime("%H:%M") if log.confirmado_at else "",
            "persona":    f"{p.nombre} {p.apellido}" if p else "",
            "parentesco": p.parentesco if p else "",
            "estudiante": f"{est.nombre} {est.apellido}" if est else "",
            "grado":      f"{est.grado} {est.seccion}" if est else "",
        })
    return result
