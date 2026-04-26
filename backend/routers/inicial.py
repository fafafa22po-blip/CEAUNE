"""
Router: QR Apoderado – Nivel Inicial
──────────────────────────────────────
Flujo exclusivo para nivel inicial donde el apoderado porta un único QR
que sirve para registrar asistencia Y recojo de su(s) hijo(s).

Prefijo del token: APO-XXXX  (distinto de CEAUNE- y RECOJO-)

Endpoints:
  POST /inicial/resolver-qr           → identifica al apoderado + hijos en inicial
  POST /inicial/previsualizar         → detecta qué acción registraría (igual que /asistencia/previsualizar)
  POST /inicial/escanear              → registra asistencia y/o recojo
  POST /inicial/admin/generar-qr/{id} → admin genera/regenera el QR del apoderado
  GET  /inicial/admin/{id}/qr.png     → admin descarga el PNG del QR
"""
from __future__ import annotations

from datetime import date, datetime, time as time_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db, require_roles
from core.tz import ahora as _ahora, hoy as _hoy
from models.asistencia import Asistencia, Horario
from models.estudiante import ApoderadoEstudiante, Estudiante
from models.recojo import PersonaAutorizada, RecojoLog
from models.usuario import Usuario
import base64

from services.qr_service import generar_qr_token_apoderado, generar_qr_png, generar_qr_solo_png

router = APIRouter()

ROLES_INICIAL = {"i-auxiliar", "admin"}


# ── helpers ──────────────────────────────────────────────────────────────────

def _hijos_inicial(apoderado_id: str, db: Session) -> list[Estudiante]:
    ids = [
        r[0]
        for r in db.query(ApoderadoEstudiante.estudiante_id)
        .filter(ApoderadoEstudiante.apoderado_id == apoderado_id)
        .all()
    ]
    if not ids:
        return []
    return (
        db.query(Estudiante)
        .filter(
            Estudiante.id.in_(ids),
            Estudiante.nivel == "inicial",
            Estudiante.activo == True,  # noqa: E712
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )


def _estado_hoy(estudiante: Estudiante, db: Session) -> dict:
    """Devuelve ingreso y salida del día para el alumno."""
    hoy = _hoy()
    registros = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id == estudiante.id, Asistencia.fecha == hoy)
        .all()
    )
    ingreso = next((r for r in registros if r.tipo in ("ingreso", "ingreso_especial")), None)
    salida  = next((r for r in registros if r.tipo in ("salida",  "salida_especial")),  None)

    recojo_log = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.estudiante_id == estudiante.id,
            RecojoLog.confirmado == True,  # noqa: E712
            RecojoLog.created_at >= datetime(hoy.year, hoy.month, hoy.day),
        )
        .first()
    )

    return {
        "tiene_ingreso":  ingreso is not None,
        "tiene_salida":   salida  is not None,
        "tiene_recojo":   recojo_log is not None,
        "hora_ingreso":   ingreso.hora.strftime("%H:%M") if ingreso  and ingreso.hora  else None,
        "hora_salida":    salida.hora.strftime("%H:%M")  if salida   and salida.hora   else None,
        "estado_asistencia": ingreso.estado if ingreso else "falta",
    }


def _acciones_disponibles(estado: dict) -> list[str]:
    """Devuelve qué acciones son posibles según el estado del día del alumno."""
    acciones = []
    if not estado["tiene_ingreso"]:
        acciones.append("ingreso")
    elif not estado["tiene_salida"]:
        acciones.append("salida")
    if estado["tiene_ingreso"] and not estado["tiene_recojo"]:
        acciones.append("recojo")
    return acciones


def _serializar_hijo(est: Estudiante, db: Session) -> dict:
    estado = _estado_hoy(est, db)
    return {
        "id":       est.id,
        "nombre":   est.nombre,
        "apellido": est.apellido,
        "grado":    est.grado,
        "seccion":  est.seccion,
        "foto_url": est.foto_url,
        "estado_hoy":          estado,
        "acciones_disponibles": _acciones_disponibles(estado),
    }


# ════════════════════════════════════════════════════════════════════════════
# POST /inicial/resolver-qr
# ════════════════════════════════════════════════════════════════════════════

@router.post("/resolver-qr")
def resolver_qr(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Paso 1: el auxiliar escanea el QR del apoderado de inicial.
    Devuelve el perfil del apoderado y la lista de hijos en inicial
    con sus acciones disponibles para hoy.
    """
    if current_user.rol not in ROLES_INICIAL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo auxiliar de inicial o admin")

    qr_token = (body.get("qr_token") or "").strip()
    if not qr_token:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "qr_token requerido")

    if not qr_token.startswith("APO-"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Este QR no corresponde a un apoderado de inicial. "
            "Para alumnos de primaria o secundaria usa el flujo estándar.",
        )

    apoderado = db.query(Usuario).filter(
        Usuario.qr_token_inicial == qr_token,
        Usuario.activo == True,  # noqa: E712
    ).first()

    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR de apoderado no reconocido o inactivo")

    hijos = _hijos_inicial(apoderado.id, db)
    if not hijos:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"El apoderado {apoderado.nombre} {apoderado.apellido} no tiene "
            "alumnos activos en nivel inicial.",
        )

    hijos_data = [_serializar_hijo(h, db) for h in hijos]

    return {
        "apoderado": {
            "id":       apoderado.id,
            "nombre":   apoderado.nombre,
            "apellido": apoderado.apellido,
            "dni":      apoderado.dni,
            "telefono": apoderado.telefono,
            "foto_url": apoderado.foto_url,
        },
        "hijos":              hijos_data,
        "seleccion_requerida": len(hijos) > 1,
    }


# ════════════════════════════════════════════════════════════════════════════
# POST /inicial/previsualizar
# ════════════════════════════════════════════════════════════════════════════

@router.post("/previsualizar")
def previsualizar_inicial(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Detecta qué acción se registraría para un alumno de inicial sin guardar nada.
    Devuelve la misma estructura que /asistencia/previsualizar más el campo `puede_recojo`.
    """
    if current_user.rol not in ROLES_INICIAL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo auxiliar de inicial o admin")

    qr_token      = (body.get("qr_token")      or "").strip()
    estudiante_id = (body.get("estudiante_id") or "").strip()

    if not qr_token or not estudiante_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "qr_token y estudiante_id requeridos")

    apoderado = db.query(Usuario).filter(
        Usuario.qr_token_inicial == qr_token,
        Usuario.activo == True,  # noqa: E712
    ).first()
    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR de apoderado no reconocido")

    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id  == apoderado.id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Este alumno no está vinculado al apoderado")

    estudiante = db.query(Estudiante).filter(
        Estudiante.id     == estudiante_id,
        Estudiante.activo == True,  # noqa: E712
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")
    if estudiante.nivel != "inicial":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Este flujo es exclusivo para nivel inicial")

    from routers.asistencia import es_dia_laborable, get_horario_efectivo, _parse_time, MOTIVO_LABEL as _ML

    fecha_hoy = _hoy()
    ahora     = _ahora()

    if not es_dia_laborable(fecha_hoy, db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hoy no es un día laborable")

    horario = get_horario_efectivo("inicial", fecha_hoy, db)
    if not horario:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No hay horario configurado para nivel inicial",
        )

    hora_actual   = ahora.time()
    h_ingreso_fin = _parse_time(horario.hora_ingreso_fin)
    h_salida_ini  = _parse_time(horario.hora_salida_inicio)

    registros = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id == estudiante.id, Asistencia.fecha == fecha_hoy)
        .all()
    )
    ingreso_hoy = next((r for r in registros if r.tipo in ("ingreso", "ingreso_especial")), None)
    salida_hoy  = next((r for r in registros if r.tipo in ("salida",  "salida_especial")),  None)

    recojo_hoy = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.estudiante_id == estudiante.id,
            RecojoLog.confirmado    == True,  # noqa: E712
            RecojoLog.created_at    >= datetime(fecha_hoy.year, fecha_hoy.month, fecha_hoy.day),
        )
        .first()
    )
    puede_recojo = ingreso_hoy is not None and recojo_hoy is None

    est = {
        "id": estudiante.id, "nombre": estudiante.nombre, "apellido": estudiante.apellido,
        "nivel": estudiante.nivel, "grado": estudiante.grado,
        "seccion": estudiante.seccion, "foto_url": estudiante.foto_url,
    }

    def _resp(tipo_asist, estado, req_obs, req_mot, label, sublabel, motivo_auto=None, tiene=True):
        return {
            "estudiante": est,
            "tipo_asistencia": tipo_asist, "estado_previsto": estado,
            "requiere_observacion": req_obs, "requiere_motivo": req_mot,
            "motivo_auto": motivo_auto, "label": label, "sublabel": sublabel,
            "tiene_asistencia": tiene, "puede_recojo": puede_recojo,
        }

    if not ingreso_hoy:
        if hora_actual <= h_ingreso_fin:
            return _resp("ingreso", "puntual", False, False, "INGRESO PUNTUAL", "Llegó a tiempo")
        return _resp("ingreso", "tardanza", False, False, "TARDANZA",
                     "Llegó después de la hora límite")

    if salida_hoy and salida_hoy.tipo == "salida_especial":
        motivo = salida_hoy.motivo_especial or "otro"
        return _resp("ingreso_especial", "especial", False, False,
                     "REGRESO", f"Retorna al colegio · {_ML.get(motivo, 'salida especial')}",
                     motivo_auto=motivo)

    if ingreso_hoy and not salida_hoy:
        if hora_actual >= h_salida_ini:
            return _resp("salida", "especial", False, False, "SALIDA", "Salida en horario regular")
        return _resp("salida_especial", "especial", False, True, "SALIDA ANTICIPADA",
                     "Sale antes del horario — selecciona el motivo")

    # ingreso y salida ya completos
    if not puede_recojo:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{estudiante.nombre} ya tiene ingreso, salida y recojo registrados hoy",
        )
    return _resp(None, None, False, False, "RECOJO",
                 "Ingreso y salida ya registrados", tiene=False)


# ════════════════════════════════════════════════════════════════════════════
# POST /inicial/escanear
# ════════════════════════════════════════════════════════════════════════════

@router.post("/escanear")
def escanear_apoderado_inicial(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Paso 2: el auxiliar confirma la acción para un hijo específico.

    body:
      qr_token      str  — token del apoderado (APO-...)
      estudiante_id str  — id del alumno (ya seleccionado)
      accion        str  — "asistencia" | "recojo" | "ambos"
      tipo_asistencia str — "ingreso" | "salida" | "ingreso_especial" | "salida_especial"
      motivo_especial str — solo para tipos especiales
      observacion   str  — opcional
    """
    if current_user.rol not in ROLES_INICIAL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo auxiliar de inicial o admin")

    qr_token      = (body.get("qr_token")       or "").strip()
    estudiante_id = (body.get("estudiante_id")   or "").strip()
    accion        = (body.get("accion")          or "").strip()
    tipo_asist    = (body.get("tipo_asistencia") or "ingreso").strip()
    motivo_esp    = (body.get("motivo_especial") or "").strip() or None
    observacion   = (body.get("observacion")     or "").strip() or None

    if not qr_token or not estudiante_id or accion not in ("asistencia", "recojo", "ambos"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Se requiere qr_token, estudiante_id y accion (asistencia | recojo | ambos)",
        )

    # Verificar apoderado
    apoderado = db.query(Usuario).filter(
        Usuario.qr_token_inicial == qr_token,
        Usuario.activo == True,  # noqa: E712
    ).first()
    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR de apoderado no reconocido")

    # Verificar que el alumno pertenece al apoderado y es de inicial
    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id  == apoderado.id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Este alumno no está vinculado al apoderado")

    estudiante = db.query(Estudiante).filter(
        Estudiante.id == estudiante_id,
        Estudiante.activo == True,  # noqa: E712
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado o inactivo")
    if estudiante.nivel != "inicial":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Este flujo es exclusivo para nivel inicial")

    resultado: dict = {}

    # ── Registrar ASISTENCIA ─────────────────────────────────────────────────
    if accion in ("asistencia", "ambos"):
        resultado["asistencia"] = _registrar_asistencia(
            estudiante, current_user, tipo_asist, motivo_esp, observacion, db
        )

    # ── Registrar RECOJO ─────────────────────────────────────────────────────
    if accion in ("recojo", "ambos"):
        resultado["recojo"] = _registrar_recojo(
            estudiante, apoderado, current_user, db
        )

    resultado["mensaje"] = _mensaje_resultado(resultado, estudiante)
    return resultado


# ── Lógica interna: asistencia ───────────────────────────────────────────────

_MOTIVO_LABEL = {
    "marcha":                  "Marcha / Movilización",
    "juegos_deportivos":       "Juegos deportivos",
    "enfermedad":              "Enfermedad / Malestar",
    "permiso_apoderado":       "Permiso del apoderado",
    "actividad_institucional": "Actividad institucional",
    "tardanza_justificada":    "Tardanza justificada",
    "otro":                    "Otro motivo",
}


def _registrar_asistencia(
    estudiante: Estudiante,
    operador: Usuario,
    tipo_solicitado: str,
    motivo_especial: Optional[str],
    observacion: Optional[str],
    db: Session,
) -> dict:
    from routers.asistencia import (
        es_dia_laborable, get_horario_efectivo,
        detectar_estado, _parse_time, MOTIVO_LABEL,
    )

    ahora     = _ahora()
    fecha_hoy = ahora.date()
    hora_actual = ahora.time()

    if not es_dia_laborable(fecha_hoy, db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hoy no es un día laborable")

    horario = get_horario_efectivo("inicial", fecha_hoy, db)
    if not horario:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No hay horario configurado para nivel inicial",
        )

    if tipo_solicitado not in ("ingreso", "salida", "ingreso_especial", "salida_especial"):
        tipo_solicitado = "ingreso"

    # Validar especiales
    if tipo_solicitado in ("ingreso_especial", "salida_especial"):
        if not motivo_especial:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "El motivo es obligatorio para registros especiales",
            )
        if motivo_especial not in MOTIVO_LABEL:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Motivo inválido. Valores permitidos: {', '.join(MOTIVO_LABEL.keys())}",
            )

    tipo_registro, estado = detectar_estado(hora_actual, horario, tipo_solicitado)

    # Verificar duplicado
    tipos_grupo = (
        ("ingreso", "ingreso_especial")
        if tipo_solicitado in ("ingreso", "ingreso_especial")
        else ("salida", "salida_especial")
    )
    registro_previo = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante.id,
            Asistencia.fecha == fecha_hoy,
            Asistencia.tipo.in_(tipos_grupo),
        )
        .first()
    )
    if registro_previo:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Ya existe un registro de {registro_previo.tipo} para este alumno hoy "
            f"(a las {registro_previo.hora.strftime('%H:%M') if registro_previo.hora else '?'})",
        )

    nuevo = Asistencia(
        estudiante_id=estudiante.id,
        auxiliar_id=operador.id,
        fecha=fecha_hoy,
        tipo=tipo_registro,
        hora=ahora,
        estado=estado,
        motivo_especial=motivo_especial if tipo_solicitado in ("ingreso_especial", "salida_especial") else None,
        observacion=observacion,
        correo_enviado=False,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    # Notificaciones (no bloquean)
    try:
        from services.gmail_service import notificar_asistencia_bg
        notificar_asistencia_bg(nuevo.id)
    except Exception:
        pass
    try:
        from services.firebase_service import push_asistencia_bg
        push_asistencia_bg(nuevo.id)
    except Exception:
        pass

    return {
        "tipo":   tipo_registro,
        "estado": estado,
        "hora":   ahora.strftime("%H:%M"),
    }


# ── Lógica interna: recojo ───────────────────────────────────────────────────

def _registrar_recojo(
    estudiante: Estudiante,
    apoderado: Usuario,
    operador: Usuario,
    db: Session,
) -> dict:
    hoy = _hoy()
    inicio_hoy = datetime(hoy.year, hoy.month, hoy.day)

    # ¿Ya fue recogido hoy?
    log_existente = (
        db.query(RecojoLog)
        .filter(
            RecojoLog.estudiante_id == estudiante.id,
            RecojoLog.confirmado == True,  # noqa: E712
            RecojoLog.created_at >= inicio_hoy,
        )
        .first()
    )
    if log_existente:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Este alumno ya fue recogido hoy a las "
            f"{log_existente.confirmado_at.strftime('%H:%M') if log_existente.confirmado_at else '?'}",
        )

    # Buscar PersonaAutorizada activa del apoderado para este alumno
    persona_aut = (
        db.query(PersonaAutorizada)
        .filter(
            PersonaAutorizada.apoderado_id  == apoderado.id,
            PersonaAutorizada.estudiante_id == estudiante.id,
            PersonaAutorizada.estado        == "activo",
        )
        .first()
    )

    ahora = _ahora()

    if persona_aut:
        # Usar el fotocheck existente como persona autorizada
        log = RecojoLog(
            persona_autorizada_id=persona_aut.id,
            estudiante_id=estudiante.id,
            escaneado_por=operador.id,
            confirmado=True,
            confirmado_at=ahora,
            foto_snapshot=persona_aut.foto_url,
        )
    else:
        # El propio apoderado recoge a su hijo (sin fotocheck separado).
        # Creamos un registro temporal de PersonaAutorizada con estado "activo"
        # para mantener la integridad referencial del log.
        persona_tmp = PersonaAutorizada(
            estudiante_id=estudiante.id,
            apoderado_id=apoderado.id,
            nombre=apoderado.nombre,
            apellido=apoderado.apellido,
            dni=apoderado.dni,
            parentesco="apoderado",
            foto_url=apoderado.foto_url,
            estado="activo",
            pago_confirmado=False,
        )
        db.add(persona_tmp)
        db.flush()

        log = RecojoLog(
            persona_autorizada_id=persona_tmp.id,
            estudiante_id=estudiante.id,
            escaneado_por=operador.id,
            confirmado=True,
            confirmado_at=ahora,
            foto_snapshot=apoderado.foto_url,
        )

    db.add(log)

    # Registrar salida en asistencia
    salida_previa = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante.id,
            Asistencia.fecha == hoy,
            Asistencia.tipo.in_(["salida", "salida_especial"]),
        )
        .first()
    )
    if not salida_previa:
        db.add(Asistencia(
            estudiante_id=estudiante.id,
            auxiliar_id=operador.id,
            fecha=hoy,
            tipo="salida",
            hora=ahora,
            estado="especial",
            observacion=f"Recogido por apoderado {apoderado.nombre} {apoderado.apellido} · DNI: {apoderado.dni}",
            correo_enviado=False,
        ))

    db.commit()

    return {
        "confirmado_at": ahora.strftime("%H:%M"),
        "recogido_por":  f"{apoderado.nombre} {apoderado.apellido}",
        "parentesco":    "apoderado",
    }


def _mensaje_resultado(resultado: dict, estudiante: Estudiante) -> str:
    nombre = f"{estudiante.nombre} {estudiante.apellido}"
    partes = []
    if "asistencia" in resultado:
        a = resultado["asistencia"]
        partes.append(f"{a['tipo'].replace('_', ' ')} {a['estado']} a las {a['hora']}")
    if "recojo" in resultado:
        r = resultado["recojo"]
        partes.append(f"recojo confirmado a las {r['confirmado_at']}")
    return f"{nombre}: {' · '.join(partes)}"


# ════════════════════════════════════════════════════════════════════════════
# ADMIN — generar QR para apoderado de inicial
# ════════════════════════════════════════════════════════════════════════════

@router.post("/admin/generar-qr/{apoderado_id}", status_code=200)
def admin_generar_qr_apoderado(
    apoderado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """
    Admin genera (o regenera) el QR inicial para un apoderado.
    Solo lo permite si el apoderado tiene al menos un hijo activo en inicial.
    """
    apoderado = db.query(Usuario).filter(Usuario.id == apoderado_id).first()
    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Apoderado no encontrado")

    hijos = _hijos_inicial(apoderado_id, db)
    if not hijos:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Este apoderado no tiene hijos activos en nivel inicial",
        )

    # Generar o regenerar el token
    apoderado.qr_token_inicial = generar_qr_token_apoderado()
    db.commit()
    db.refresh(apoderado)

    return {
        "ok":              True,
        "qr_token":        apoderado.qr_token_inicial,
        "apoderado":       f"{apoderado.nombre} {apoderado.apellido}",
        "hijos_inicial":   [f"{h.nombre} {h.apellido} ({h.grado} {h.seccion})" for h in hijos],
    }


@router.get("/admin/{apoderado_id}/qr.png")
def admin_qr_png(
    apoderado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Descarga el PNG del QR del apoderado para imprimir/compartir."""
    apoderado = db.query(Usuario).filter(Usuario.id == apoderado_id).first()
    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Apoderado no encontrado")
    if not apoderado.qr_token_inicial:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Este apoderado aún no tiene QR generado. Usa POST /inicial/admin/generar-qr/{id}",
        )

    hijos = _hijos_inicial(apoderado_id, db)
    hijos_str = " · ".join(f"{h.nombre} {h.apellido}" for h in hijos) or ""

    png_bytes = generar_qr_png(
        qr_token=apoderado.qr_token_inicial,
        nombre=apoderado.nombre,
        apellido=apoderado.apellido,
        nivel="Apoderado Inicial",
        grado=hijos_str,
        seccion="",
    )

    nombre_archivo = (
        f"qr_apoderado_{apoderado.nombre}_{apoderado.apellido}.png"
        .replace(" ", "_")
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


@router.get("/admin/{apoderado_id}/qr-solo")
def admin_qr_solo(
    apoderado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    """Retorna solo el QR limpio del apoderado (sin decoraciones) como base64."""
    apoderado = db.query(Usuario).filter(Usuario.id == apoderado_id).first()
    if not apoderado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Apoderado no encontrado")
    if not apoderado.qr_token_inicial:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin QR generado")

    png_bytes = generar_qr_solo_png(apoderado.qr_token_inicial)
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return {"imagen_base64": f"data:image/png;base64,{b64}"}
