"""
Servicio de Push Notifications via Firebase Cloud Messaging.
Patrón idéntico a gmail_service.py: funciones síncronas + wrappers _bg con hilo daemon.
"""

MOTIVO_LABEL = {
    "marcha":                   "Marcha / Movilización",
    "juegos_deportivos":        "Juegos deportivos",
    "enfermedad":               "Enfermedad / Malestar",
    "permiso_apoderado":        "Permiso del apoderado",
    "actividad_institucional":  "Actividad institucional",
    "tardanza_justificada":     "Tardanza justificada",
    "otro":                     "Otro motivo",
}

import logging
import threading
from datetime import datetime
from typing import List, Optional

# Nombres de meses en español (Peru) — evita depender de locale del sistema
_MESES_ES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _fecha_es(d) -> str:
    """Formatea una fecha como '27 de marzo' en español, sin depender de locale."""
    return f"{d.day} de {_MESES_ES[d.month - 1]}"

from core.config import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def _init_firebase():
    """Inicializa Firebase Admin SDK una sola vez."""
    global _firebase_app
    if _firebase_app:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials

        path = settings.FIREBASE_CREDENTIALS_PATH
        if not path:
            logger.warning("[Firebase] FIREBASE_CREDENTIALS_PATH no configurado — push desactivado")
            return False

        cred = credentials.Certificate(path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("[Firebase] Inicializado correctamente")
        return True
    except Exception as exc:
        logger.error("[Firebase] Error al inicializar: %s", exc)
        return False


def _apoderado_tokens(estudiante_id: str, db) -> List[str]:
    """Obtiene FCM tokens únicos de los apoderados de un estudiante.

    Deduplica tokens porque varios apoderados pueden compartir dispositivo
    (mamá y papá en el mismo celular) y FCM no acepta tokens repetidos.
    """
    from models.dispositivo import DispositivoUsuario
    from models.estudiante import ApoderadoEstudiante

    rows = (
        db.query(DispositivoUsuario.fcm_token)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == DispositivoUsuario.usuario_id)
        .filter(
            ApoderadoEstudiante.estudiante_id == estudiante_id,
            DispositivoUsuario.activo == True,
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _enviar_push(tokens: List[str], titulo: str, cuerpo: str, data: Optional[dict] = None) -> int:
    """Envía push a múltiples tokens. Retorna cantidad enviada. Desactiva tokens inválidos."""
    if not tokens or not _init_firebase():
        return 0

    from firebase_admin import messaging
    from database import SessionLocal
    from models.dispositivo import DispositivoUsuario

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=titulo, body=cuerpo),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
    except Exception as exc:
        logger.error("[Firebase] Error al enviar: %s", exc)
        return 0

    # Limpiar tokens inválidos
    if response.failure_count > 0:
        db = SessionLocal()
        try:
            for i, send_response in enumerate(response.responses):
                if not send_response.success and send_response.exception:
                    code = getattr(send_response.exception, "code", "")
                    if code in ("NOT_FOUND", "UNREGISTERED", "INVALID_ARGUMENT"):
                        db.query(DispositivoUsuario).filter(
                            DispositivoUsuario.fcm_token == tokens[i]
                        ).update({"activo": False})
            db.commit()
        except Exception:
            pass
        finally:
            db.close()

    enviados = response.success_count
    if enviados:
        logger.info("[Firebase] %d/%d push enviados | %s", enviados, len(tokens), titulo[:50])
    return enviados


# ---------------------------------------------------------------------------
# Push: Asistencia (puntual / tardanza)
# ---------------------------------------------------------------------------

def push_asistencia(asistencia_id: str):
    """Envía push a apoderados cuando se registra asistencia."""
    from database import SessionLocal
    from models.asistencia import Asistencia
    from models.estudiante import Estudiante

    logger.info("[push_asistencia] Iniciando para asistencia_id=%s", asistencia_id)

    db = SessionLocal()
    try:
        asistencia = db.query(Asistencia).filter(Asistencia.id == asistencia_id).first()
        if not asistencia:
            logger.warning("[push_asistencia] Asistencia no encontrada: %s", asistencia_id)
            return

        estudiante = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
        if not estudiante:
            logger.warning("[push_asistencia] Estudiante no encontrado para asistencia %s", asistencia_id)
            return

        logger.info("[push_asistencia] Estudiante: %s %s (estado=%s)", estudiante.nombre, estudiante.apellido, asistencia.estado)

        tokens = _apoderado_tokens(estudiante.id, db)
        logger.info("[push_asistencia] Tokens encontrados: %d", len(tokens))

        if not tokens:
            logger.warning("[push_asistencia] SIN TOKENS — el apoderado no registró dispositivo")
            return

        nombre = estudiante.nombre.split()[0]  # solo primer nombre
        hora_str = asistencia.hora.strftime("%I:%M %p").lstrip("0").lower()
        nivel_grado = f"{estudiante.grado}° {estudiante.seccion} — {estudiante.nivel.capitalize()}"

        if asistencia.estado == "puntual":
            titulo = f"{nombre} llegó al colegio"
            cuerpo  = f"Ingresó a las {hora_str} puntualmente. {nivel_grado}"

        elif asistencia.estado == "tardanza":
            titulo = f"{nombre} llegó tarde"
            cuerpo  = f"Ingresó a las {hora_str} con tardanza. {nivel_grado}"

        elif asistencia.estado == "especial" and asistencia.tipo == "ingreso_especial":
            motivo  = MOTIVO_LABEL.get(asistencia.motivo_especial, "Ingreso con permiso") if asistencia.motivo_especial else "Ingreso con permiso especial"
            titulo  = f"{nombre} ingresó con permiso especial"
            cuerpo  = f"{motivo} · Hora: {hora_str}. {nivel_grado}"

        elif asistencia.estado == "especial" and asistencia.tipo == "salida_especial" and asistencia.motivo_especial:
            motivo  = MOTIVO_LABEL.get(asistencia.motivo_especial, "Salida especial")
            titulo  = f"{nombre} salió temprano del colegio"
            cuerpo  = f"{motivo} · Hora de salida: {hora_str}. {nivel_grado}"

        else:
            logger.info("[push_asistencia] tipo='%s' estado='%s' no requiere push", asistencia.tipo, asistencia.estado)
            return

        _enviar_push(tokens, titulo, cuerpo, {
            "tipo":         "asistencia",
            "estudiante_id": estudiante.id,
            "estado":       asistencia.estado,
            "tipo_registro": asistencia.tipo,
        })

    except Exception as exc:
        logger.error("[push_asistencia] %s: %s", asistencia_id, exc, exc_info=True)
    finally:
        db.close()


def push_asistencia_bg(asistencia_id: str):
    threading.Thread(target=push_asistencia, args=(asistencia_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Push: Falta
# ---------------------------------------------------------------------------

def push_faltas(nivel: str, fecha, db):
    """Envía push de falta a apoderados. Llamado desde scheduler."""
    from models.asistencia import Asistencia
    from models.estudiante import Estudiante

    faltas = (
        db.query(Asistencia)
        .join(Estudiante, Estudiante.id == Asistencia.estudiante_id)
        .filter(
            Asistencia.fecha == fecha,
            Asistencia.estado == "falta",
            Estudiante.nivel == nivel,
        )
        .all()
    )

    fecha_str = fecha.strftime("%d/%m/%Y")
    total = 0

    for asistencia in faltas:
        estudiante = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
        if not estudiante:
            continue

        tokens = _apoderado_tokens(estudiante.id, db)
        if not tokens:
            continue

        nombre = estudiante.nombre.split()[0]
        nivel_grado = f"{estudiante.grado}° {estudiante.seccion} — {estudiante.nivel.capitalize()}"
        enviados = _enviar_push(
            tokens,
            f"{nombre} no asistió hoy",
            f"Falta registrada el {fecha_str}. {nivel_grado}. Puede justificar desde la app.",
            {
                "tipo": "falta",
                "estudiante_id": estudiante.id,
                "asistencia_id": asistencia.id,
            },
        )
        total += enviados

    logger.info("[Push faltas %s] %s — %d push enviados", nivel, fecha, total)


# ---------------------------------------------------------------------------
# Push: Comunicado
# ---------------------------------------------------------------------------

def push_comunicado(comunicado_id: str):
    """Envía push a apoderados cuando se crea un comunicado."""
    from database import SessionLocal
    from models.comunicado import Comunicado, ComunicadoDestinatario
    from models.estudiante import Estudiante
    from models.usuario import Usuario

    db = SessionLocal()
    try:
        comunicado = db.query(Comunicado).filter(Comunicado.id == comunicado_id).first()
        if not comunicado:
            return

        auxiliar = db.query(Usuario).filter(Usuario.id == comunicado.auxiliar_id).first()
        remitente = auxiliar.nombre.split()[0] if auxiliar else "Auxiliar"

        destinatarios = (
            db.query(ComunicadoDestinatario)
            .filter(ComunicadoDestinatario.comunicado_id == comunicado_id)
            .all()
        )

        total = 0
        for dest in destinatarios:
            tokens = _apoderado_tokens(dest.estudiante_id, db)
            if tokens:
                total += _enviar_push(
                    tokens,
                    f"Nuevo comunicado: {comunicado.asunto}",
                    f"Enviado por {remitente}. Revise los detalles en la app.",
                    {
                        "tipo": "comunicado",
                        "comunicado_id": comunicado.id,
                    },
                )

        logger.info("[Push comunicado %s] %d push enviados", comunicado_id[:8], total)

    except Exception as exc:
        logger.error("[push_comunicado] %s: %s", comunicado_id, exc)
    finally:
        db.close()


def push_comunicado_bg(comunicado_id: str):
    threading.Thread(target=push_comunicado, args=(comunicado_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Push: Observación del tutor
# ---------------------------------------------------------------------------

def push_observacion(observacion_id: str):
    """Envía push al apoderado cuando el tutor registra una observación."""
    from database import SessionLocal
    from models.comunicado import ObservacionTutor
    from models.estudiante import Estudiante
    from models.usuario import Usuario

    db = SessionLocal()
    try:
        obs = db.query(ObservacionTutor).filter(ObservacionTutor.id == observacion_id).first()
        if not obs or not obs.enviar_a_apoderado:
            return

        estudiante = db.query(Estudiante).filter(Estudiante.id == obs.estudiante_id).first()
        if not estudiante:
            return

        tokens = _apoderado_tokens(estudiante.id, db)
        if not tokens:
            return

        tutor = db.query(Usuario).filter(Usuario.id == obs.tutor_id).first()
        tutor_nombre = tutor.nombre.split()[0] if tutor else "Tutor"
        nombre = estudiante.nombre.split()[0]

        tipo_label = {
            "academica": "Académica", "conductual": "Conductual",
            "salud": "Salud", "logro": "Logro destacado", "otro": "General",
        }.get(obs.tipo, obs.tipo.capitalize())

        _enviar_push(
            tokens,
            f"Observación de {nombre} — {tipo_label}",
            f"Registrada por el tutor {tutor_nombre}. Revise los detalles en la app.",
            {
                "tipo": "observacion",
                "estudiante_id": estudiante.id,
            },
        )

    except Exception as exc:
        logger.error("[push_observacion] %s: %s", observacion_id, exc)
    finally:
        db.close()


def push_observacion_bg(observacion_id: str):
    threading.Thread(target=push_observacion, args=(observacion_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Push: libreta disponible
# ---------------------------------------------------------------------------

def push_libreta(libreta_id: str):
    """Envía push al apoderado cuando el tutor sube una libreta de notas."""
    from database import SessionLocal
    from models.libreta import Libreta
    from models.estudiante import Estudiante

    db = SessionLocal()
    try:
        lib = db.query(Libreta).filter(Libreta.id == libreta_id).first()
        if not lib:
            return

        estudiante = db.query(Estudiante).filter(Estudiante.id == lib.estudiante_id).first()
        if not estudiante:
            return

        tokens = _apoderado_tokens(estudiante.id, db)
        if not tokens:
            return

        nombre = estudiante.nombre.split()[0]

        _enviar_push(
            tokens,
            f"Libreta de {nombre} disponible",
            f"Ya puedes ver la libreta del Bimestre {lib.bimestre} en la aplicación.",
            {
                "tipo":          "libreta",
                "estudiante_id": estudiante.id,
                "bimestre":      str(lib.bimestre),
                "anio":          str(lib.anio),
            },
        )

    except Exception as exc:
        logger.error("[push_libreta] %s: %s", libreta_id, exc)
    finally:
        db.close()


def push_libreta_bg(libreta_id: str):
    threading.Thread(target=push_libreta, args=(libreta_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Helpers de audiencia masiva
# ---------------------------------------------------------------------------

def _tokens_por_audiencia(nivel: Optional[str], grado: Optional[str], seccion: Optional[str], db) -> List[str]:
    """FCM tokens activos de apoderados filtrados por nivel/grado/sección.
    nivel='todos' o None = sin filtro de nivel.
    """
    from models.dispositivo import DispositivoUsuario
    from models.estudiante import Estudiante, ApoderadoEstudiante

    q = (
        db.query(DispositivoUsuario.fcm_token)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == DispositivoUsuario.usuario_id)
        .join(Estudiante, Estudiante.id == ApoderadoEstudiante.estudiante_id)
        .filter(DispositivoUsuario.activo == True)
    )
    if nivel and nivel != "todos":
        q = q.filter(Estudiante.nivel == nivel)
    if grado:
        q = q.filter(Estudiante.grado == grado)
    if seccion:
        q = q.filter(Estudiante.seccion == seccion)

    return [r[0] for r in q.distinct().all()]


# ---------------------------------------------------------------------------
# Push: Aviso de día no laborable (calendario)
# ---------------------------------------------------------------------------

def push_aviso_calendario(
    nivel: str,
    grado: Optional[str],
    seccion: Optional[str],
    fecha_inicio,
    fecha_fin,
    motivo: str,
    tipo: str,
):
    """Notifica a apoderados sobre días sin clases (feriado, vacación, evento)."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        tokens = _tokens_por_audiencia(nivel, grado, seccion, db)
        if not tokens:
            logger.info("[push_aviso_calendario] Sin tokens — nivel=%s grado=%s sec=%s", nivel, grado, seccion)
            return

        fecha_fin_real = fecha_fin or fecha_inicio
        if fecha_fin_real != fecha_inicio:
            fecha_str = f"{_fecha_es(fecha_inicio)} al {_fecha_es(fecha_fin_real)}"
        else:
            fecha_str = _fecha_es(fecha_inicio)

        audiencia = []
        if nivel == "todos":
            audiencia.append("Todos los niveles")
        else:
            audiencia.append(nivel.capitalize())
        if grado:
            audiencia.append(f"{grado}° grado")
            if seccion:
                audiencia.append(f'Sección "{seccion}"')

        tipo_labels = {"feriado": "Feriado", "vacacion": "Vacaciones", "evento": "Evento"}
        tipo_label = tipo_labels.get(tipo, "Aviso")

        titulo = f"Sin clases — {fecha_str}"
        cuerpo  = f"{motivo} ({tipo_label}) · {' · '.join(audiencia)}"

        _enviar_push(tokens, titulo, cuerpo, {
            "tipo":         "aviso_calendario",
            "tipo_dia":     tipo,
            "fecha_inicio": str(fecha_inicio),
            "fecha_fin":    str(fecha_fin_real),
        })
        logger.info("[push_aviso_calendario] %d tokens — %s — %s", len(tokens), tipo, motivo[:40])

    except Exception as exc:
        logger.error("[push_aviso_calendario] %s", exc, exc_info=True)
    finally:
        db.close()


def push_aviso_calendario_bg(
    nivel: str, grado: Optional[str], seccion: Optional[str],
    fecha_inicio, fecha_fin, motivo: str, tipo: str,
):
    threading.Thread(
        target=push_aviso_calendario,
        args=(nivel, grado, seccion, fecha_inicio, fecha_fin, motivo, tipo),
        daemon=True,
    ).start()


# ---------------------------------------------------------------------------
# Push: Aviso de excepción de horario
# ---------------------------------------------------------------------------

def push_aviso_horario(
    nivel: str,
    fecha,
    hora_ingreso_fin: Optional[str],
    hora_salida_inicio: Optional[str],
    hora_cierre_faltas: Optional[str],
    motivo: str,
):
    """Notifica a apoderados de un nivel sobre un cambio de horario para un día."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        tokens = _tokens_por_audiencia(nivel, None, None, db)
        if not tokens:
            logger.info("[push_aviso_horario] Sin tokens — nivel=%s", nivel)
            return

        def _fmt_hora(h: Optional[str]) -> Optional[str]:
            return h[:5] if h else None  # "HH:MM"

        fecha_str = _fecha_es(fecha)

        nivel_str = nivel.capitalize() if nivel != "todos" else "Todos los niveles"

        cambios = []
        if hora_ingreso_fin:
            cambios.append(f"ingreso hasta {_fmt_hora(hora_ingreso_fin)}")
        if hora_salida_inicio:
            cambios.append(f"salida desde {_fmt_hora(hora_salida_inicio)}")
        if hora_cierre_faltas:
            cambios.append(f"cierre de lista {_fmt_hora(hora_cierre_faltas)}")

        if not cambios:
            return

        titulo = f"Cambio de horario — {fecha_str}"
        cuerpo  = f"{nivel_str}: {', '.join(cambios)}. {motivo}"

        _enviar_push(tokens, titulo, cuerpo, {
            "tipo":  "aviso_horario",
            "nivel": nivel,
            "fecha": str(fecha),
        })
        logger.info("[push_aviso_horario] %d tokens — %s — %s", len(tokens), nivel, fecha_str)

    except Exception as exc:
        logger.error("[push_aviso_horario] %s", exc, exc_info=True)
    finally:
        db.close()


def push_aviso_horario_bg(
    nivel: str, fecha,
    hora_ingreso_fin: Optional[str],
    hora_salida_inicio: Optional[str],
    hora_cierre_faltas: Optional[str],
    motivo: str,
):
    threading.Thread(
        target=push_aviso_horario,
        args=(nivel, fecha, hora_ingreso_fin, hora_salida_inicio, hora_cierre_faltas, motivo),
        daemon=True,
    ).start()
