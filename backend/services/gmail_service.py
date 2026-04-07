"""
Gmail Service — CEAUNE Asistencia
Envía correos usando Gmail API v1 con OAuth2 (refresh token).

Plantillas implementadas:
  1. puntual          ✅ [Nombre] llegó al colegio · [hora]
  2. tardanza         ⚠️  [Nombre] llegó tarde · [hora] ([X] min de retraso)
  3. ingreso_especial 🟣 [Nombre] ingresó con permiso especial · [motivo]
  4. salida_especial  🟠 [Nombre] salió temprano · [motivo]
  5. falta            ❌ [Nombre] no asistió hoy · [fecha]  + link justificar
  6. reporte          📊 Resumen semanal de asistencia
  7. comunicado       📌 Nuevo comunicado · [asunto]  (sin el cuerpo completo)
  8. observacion      📝 Observación del tutor sobre [Nombre]
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

import base64
import logging
import threading
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from core.config import settings
from core.tz import ahora as _ahora

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# ---------------------------------------------------------------------------
# Core: autenticación y envío
# ---------------------------------------------------------------------------

def _get_service():
    """Construye el servicio Gmail con el refresh token del .env."""
    if not settings.GMAIL_CLIENT_ID:
        raise RuntimeError("GMAIL_CLIENT_ID no configurado en variables de entorno")
    if not settings.GMAIL_CLIENT_SECRET:
        raise RuntimeError("GMAIL_CLIENT_SECRET no configurado en variables de entorno")
    if not settings.GMAIL_REFRESH_TOKEN:
        raise RuntimeError("GMAIL_REFRESH_TOKEN no configurado en variables de entorno")

    creds = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        scopes=SCOPES,
    )
    try:
        creds.refresh(Request())
    except Exception as exc:
        raise RuntimeError(f"Error al refrescar token Gmail (token expirado o inválido): {exc}") from exc
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _send(to: str, subject: str, html: str) -> bool:
    """Envía un correo HTML. Retorna True si fue exitoso."""
    if not to:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"]    = settings.GMAIL_FROM
        msg["To"]      = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html", "utf-8"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
        _get_service().users().messages().send(
            userId="me", body={"raw": raw}
        ).execute()
        logger.info("Correo enviado a %s | %s", to, subject)
        return True

    except HttpError as exc:
        logger.error("Gmail API error → %s: %s", to, exc)
        return False
    except Exception as exc:
        logger.error("Error inesperado → %s: %s", to, exc)
        return False


def _send_many(recipients: List[str], subject: str, html: str) -> int:
    """Envía el mismo correo a varios destinatarios. Retorna cantidad enviada."""
    return sum(_send(email, subject, html) for email in recipients if email)


# ---------------------------------------------------------------------------
# HTML base con identidad CEAUNE
# ---------------------------------------------------------------------------

def _html(content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:Arial,Helvetica,sans-serif;background:#f0f2f5;color:#222}}
  .wrap{{max-width:560px;margin:24px auto;background:#fff;border-radius:10px;
         overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}}
  .hdr{{background:#0a1f3d;padding:22px 28px}}
  .hdr h1{{color:#c9a227;font-size:20px;font-weight:700;letter-spacing:.5px}}
  .hdr p{{color:#ffffffaa;font-size:13px;margin-top:4px}}
  .bdy{{padding:28px}}
  .bdy p{{font-size:15px;line-height:1.65;color:#333;margin-bottom:12px}}
  .badge{{display:inline-block;padding:5px 14px;border-radius:20px;
          font-weight:700;font-size:13px;letter-spacing:.3px}}
  .ok  {{background:#e8f5e9;color:#1b5e20}}
  .warn{{background:#fff8e1;color:#e65100}}
  .err {{background:#fce4ec;color:#b71c1c}}
  .card{{border-left:4px solid #c9a227;background:#fafafa;
         padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0}}
  .card strong{{display:block;font-size:22px;color:#0a1f3d;margin-bottom:2px}}
  .card span{{font-size:13px;color:#666}}
  table.sum{{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}}
  table.sum td{{padding:9px 12px;border-bottom:1px solid #eee}}
  table.sum td:last-child{{text-align:right;font-weight:700;color:#0a1f3d}}
  .btn{{display:inline-block;margin-top:18px;padding:11px 26px;
        background:#0a1f3d;color:#c9a227!important;border-radius:7px;
        text-decoration:none;font-weight:700;font-size:14px}}
  .ftr{{background:#f5f5f5;padding:14px 28px;font-size:12px;color:#999;
        border-top:1px solid #eee;line-height:1.5}}
  .ftr a{{color:#0a1f3d}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>🏫 CEAUNE</h1>
    <p>Sistema de Asistencia Escolar</p>
  </div>
  <div class="bdy">
    {content}
  </div>
  <div class="ftr">
    Mensaje automático del Sistema de Asistencia CEAUNE.<br>
    <a href="{settings.FRONTEND_URL}">{settings.FRONTEND_URL}</a>
  </div>
</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Helper: apoderados de un estudiante
# ---------------------------------------------------------------------------

def _apoderado_emails(estudiante_id: str, db) -> List[str]:
    from models.estudiante import ApoderadoEstudiante
    from models.usuario import Usuario
    rows = (
        db.query(Usuario.email)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == Usuario.id)
        .filter(
            ApoderadoEstudiante.estudiante_id == estudiante_id,
            Usuario.activo == True,
        )
        .all()
    )
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Plantilla 1 & 2 — Puntual / Tardanza  (desde /escanear)
# ---------------------------------------------------------------------------

def notificar_asistencia(asistencia_id: str):
    """
    Envía correo de ingreso (puntual o tardanza) al apoderado.
    Actualiza correo_enviado en la BD.
    Pensado para ejecutarse en un hilo background.
    """
    from database import SessionLocal
    from models.asistencia import Asistencia, Horario
    from models.estudiante import Estudiante

    db = SessionLocal()
    try:
        asistencia = db.query(Asistencia).filter(Asistencia.id == asistencia_id).first()
        if not asistencia or asistencia.correo_enviado:
            return

        estudiante = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
        if not estudiante:
            return

        emails = _apoderado_emails(estudiante.id, db)
        if not emails:
            logger.warning("Sin apoderado vinculado para %s %s", estudiante.nombre, estudiante.apellido)
            return

        nombre = f"{estudiante.nombre} {estudiante.apellido}"
        hora_str = asistencia.hora.strftime("%I:%M %p")
        fecha_str = asistencia.fecha.strftime("%d/%m/%Y")

        if asistencia.estado == "puntual":
            subject = f"✅ {nombre} llegó al colegio · {hora_str}"
            content = f"""
<p>Estimado apoderado,</p>
<p><strong>{nombre}</strong> ingresó al colegio correctamente.</p>
<div class="card">
  <strong>{hora_str}</strong>
  <span>{fecha_str} — {estudiante.nivel.capitalize()} {estudiante.grado} "{estudiante.seccion}"</span>
</div>
<span class="badge ok">✅ Puntual</span>
"""

        elif asistencia.estado == "tardanza":
            horario = db.query(Horario).filter(Horario.nivel == estudiante.nivel).first()
            min_retraso = ""
            if horario:
                from routers.asistencia import _parse_time
                h_fin   = _parse_time(horario.hora_ingreso_fin)
                limite  = datetime.combine(asistencia.fecha, h_fin)
                retraso = int((asistencia.hora - limite).total_seconds() // 60)
                min_retraso = f" ({retraso} min de retraso)"

            obs = f"<p><em>Observación: {asistencia.observacion}</em></p>" if asistencia.observacion else ""
            subject = f"⚠️ {nombre} llegó tarde · {hora_str}{min_retraso}"
            content = f"""
<p>Estimado apoderado,</p>
<p><strong>{nombre}</strong> llegó tarde al colegio hoy.</p>
<div class="card">
  <strong>{hora_str}</strong>
  <span>{fecha_str}{min_retraso}</span>
</div>
<span class="badge warn">⚠️ Tardanza</span>
{obs}
"""

        elif asistencia.estado == "especial" and asistencia.tipo == "ingreso_especial":
            motivo_txt = MOTIVO_LABEL.get(asistencia.motivo_especial, "Permiso especial") if asistencia.motivo_especial else "Permiso especial"
            obs        = f"<p><em>Observación: {asistencia.observacion}</em></p>" if asistencia.observacion else ""
            subject    = f"🟣 {nombre} ingresó con permiso especial · {hora_str}"
            content    = f"""
<p>Estimado apoderado,</p>
<p><strong>{nombre}</strong> fue registrado/a con un <strong>ingreso especial</strong> hoy.</p>
<div class="card">
  <strong>{hora_str}</strong>
  <span>{fecha_str} — {estudiante.nivel.capitalize()} {estudiante.grado} "{estudiante.seccion}"</span>
</div>
<span class="badge ok" style="background:#ede9fe;color:#5b21b6">🟣 Ingreso especial</span>
<p style="margin-top:14px;background:#f5f3ff;border-radius:6px;padding:12px 14px;color:#5b21b6;font-weight:600">
  Motivo: {motivo_txt}
</p>
{obs}
"""

        elif asistencia.estado == "especial" and asistencia.tipo == "salida_especial" and asistencia.motivo_especial:
            motivo_txt = MOTIVO_LABEL.get(asistencia.motivo_especial, "Salida especial")
            obs        = f"<p><em>Observación: {asistencia.observacion}</em></p>" if asistencia.observacion else ""
            subject    = f"🟠 {nombre} salió temprano del colegio · {hora_str}"
            content    = f"""
<p>Estimado apoderado,</p>
<p><strong>{nombre}</strong> registró una <strong>salida especial anticipada</strong> hoy.</p>
<div class="card">
  <strong>{hora_str}</strong>
  <span>{fecha_str} — {estudiante.nivel.capitalize()} {estudiante.grado} "{estudiante.seccion}"</span>
</div>
<span class="badge warn" style="background:#fff7ed;color:#c2410c">🟠 Salida especial</span>
<p style="margin-top:14px;background:#fff7ed;border-radius:6px;padding:12px 14px;color:#c2410c;font-weight:600">
  Motivo: {motivo_txt}
</p>
{obs}
"""

        else:
            return  # salidas normales y otros casos no generan notificación

        html = _html(content)
        enviado = _send_many(emails, subject, html)

        if enviado:
            asistencia.correo_enviado = True
            asistencia.correo_enviado_at = _ahora()
            db.commit()

    except Exception as exc:
        logger.error("[notificar_asistencia] %s: %s", asistencia_id, exc)
    finally:
        db.close()


def notificar_asistencia_bg(asistencia_id: str):
    """Lanza notificar_asistencia en un hilo daemon (no bloquea la respuesta HTTP)."""
    threading.Thread(target=notificar_asistencia, args=(asistencia_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Plantilla 3 — Falta  (desde scheduler)
# ---------------------------------------------------------------------------

def enviar_correos_faltas(nivel: str, fecha: date, db):
    """
    Envía correo de falta a los apoderados de los estudiantes que no asistieron.
    Llamado por el scheduler después de registrar las faltas automáticas.
    """
    from models.asistencia import Asistencia
    from models.estudiante import Estudiante

    faltas = (
        db.query(Asistencia)
        .join(Estudiante, Estudiante.id == Asistencia.estudiante_id)
        .filter(
            Asistencia.fecha == fecha,
            Asistencia.estado == "falta",
            Asistencia.correo_enviado == False,
            Estudiante.nivel == nivel,
        )
        .all()
    )

    if not faltas:
        return

    fecha_str = fecha.strftime("%d/%m/%Y")
    total_enviados = 0

    for asistencia in faltas:
        estudiante = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
        if not estudiante:
            continue

        emails = _apoderado_emails(estudiante.id, db)
        if not emails:
            continue

        nombre = f"{estudiante.nombre} {estudiante.apellido}"
        justificar_url = f"{settings.FRONTEND_URL}/apoderado/justificar?asistencia_id={asistencia.id}"

        subject = f"❌ {nombre} no asistió hoy · {fecha_str}"
        content = f"""
<p>Estimado apoderado,</p>
<p><strong>{nombre}</strong> no registró asistencia en el colegio hoy.</p>
<div class="card">
  <strong>{fecha_str}</strong>
  <span>{estudiante.nivel.capitalize()} {estudiante.grado} "{estudiante.seccion}"</span>
</div>
<span class="badge err">❌ Falta</span>
<p style="margin-top:16px">Si esta ausencia tiene justificación, puede registrarla desde el sistema:</p>
<a class="btn" href="{justificar_url}">Justificar inasistencia</a>
"""
        html = _html(content)
        enviado = _send_many(emails, subject, html)

        if enviado:
            asistencia.correo_enviado = True
            asistencia.correo_enviado_at = _ahora()
            total_enviados += 1

    if total_enviados:
        db.commit()

    logger.info("[Faltas %s] %s — %d correos de falta enviados", nivel, fecha, total_enviados)


# ---------------------------------------------------------------------------
# Plantilla 4 — Reporte semanal  (desde scheduler)
# ---------------------------------------------------------------------------

def enviar_reportes_semanales(semana_inicio: date, semana_fin: date, db):
    """
    Envía el resumen semanal a los apoderados de cada estudiante.
    """
    from models.dia_no_laborable import ReporteSemanal
    from models.estudiante import Estudiante

    reportes = (
        db.query(ReporteSemanal)
        .filter(
            ReporteSemanal.semana_inicio == semana_inicio,
            ReporteSemanal.correo_enviado == False,
        )
        .all()
    )

    if not reportes:
        return

    ini_str = semana_inicio.strftime("%d/%m/%Y")
    fin_str  = semana_fin.strftime("%d/%m/%Y")
    total_enviados = 0

    for reporte in reportes:
        estudiante = db.query(Estudiante).filter(Estudiante.id == reporte.estudiante_id).first()
        if not estudiante:
            continue

        emails = _apoderado_emails(estudiante.id, db)
        if not emails:
            continue

        nombre = f"{estudiante.nombre} {estudiante.apellido}"
        pct = round(reporte.dias_asistio / reporte.dias_laborables * 100) if reporte.dias_laborables else 0
        pendientes_txt = (
            f"<tr><td>Comunicados pendientes</td><td>⚠️ {reporte.comunicados_pendientes}</td></tr>"
            if reporte.comunicados_pendientes else ""
        )

        subject = f"📊 Reporte semanal de {nombre} · {ini_str} al {fin_str}"
        content = f"""
<p>Estimado apoderado,</p>
<p>Le presentamos el resumen de asistencia de <strong>{nombre}</strong>
correspondiente a la semana del <strong>{ini_str}</strong> al <strong>{fin_str}</strong>.</p>
<table class="sum">
  <tr><td>Días laborables</td><td>{reporte.dias_laborables}</td></tr>
  <tr><td>Días asistidos</td><td>{reporte.dias_asistio} ({pct}%)</td></tr>
  <tr><td>Tardanzas</td><td>{"⚠️ " if reporte.tardanzas else ""}{reporte.tardanzas}</td></tr>
  <tr><td>Faltas</td><td>{"❌ " if reporte.faltas else "✅ "}{reporte.faltas}</td></tr>
  {pendientes_txt}
</table>
<a class="btn" href="{settings.FRONTEND_URL}/apoderado/asistencias">Ver historial completo</a>
"""
        html = _html(content)
        enviado = _send_many(emails, subject, html)

        if enviado:
            reporte.correo_enviado = True
            reporte.correo_enviado_at = _ahora()
            total_enviados += 1

    if total_enviados:
        db.commit()

    logger.info("[Reporte] Semana %s — %d correos enviados", semana_inicio, total_enviados)


# ---------------------------------------------------------------------------
# Plantilla 5 — Comunicado  (desde routers/comunicados)
# ---------------------------------------------------------------------------

def notificar_comunicado(comunicado_id: str):
    """
    Envía notificación a los apoderados de cada estudiante destinatario.
    NO incluye el cuerpo del comunicado (sólo el asunto + link).
    """
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
        remitente = f"{auxiliar.nombre} {auxiliar.apellido}" if auxiliar else "Auxiliar"

        destinatarios = (
            db.query(ComunicadoDestinatario)
            .filter(
                ComunicadoDestinatario.comunicado_id == comunicado_id,
                ComunicadoDestinatario.correo_enviado == False,
            )
            .all()
        )

        total_enviados = 0
        for dest in destinatarios:
            estudiante = db.query(Estudiante).filter(Estudiante.id == dest.estudiante_id).first()
            if not estudiante:
                continue

            emails = _apoderado_emails(estudiante.id, db)
            if not emails:
                continue

            nombre = f"{estudiante.nombre} {estudiante.apellido}"
            link = f"{settings.FRONTEND_URL}/apoderado/comunicados"

            subject = f"📌 Nuevo comunicado · {comunicado.asunto}"
            content = f"""
<p>Estimado apoderado,</p>
<p>Tiene un nuevo comunicado del colegio dirigido a <strong>{nombre}</strong>.</p>
<div class="card">
  <strong>{comunicado.asunto}</strong>
  <span>Enviado por: {remitente}</span>
</div>
<p>Para leer el mensaje completo y responder, ingrese al sistema:</p>
<a class="btn" href="{link}">Ver comunicado</a>
"""
            html = _html(content)
            if _send_many(emails, subject, html):
                dest.correo_enviado = True
                total_enviados += 1

        if total_enviados:
            db.commit()

        logger.info("[Comunicado %s] %d correos enviados", comunicado_id[:8], total_enviados)

    except Exception as exc:
        logger.error("[notificar_comunicado] %s: %s", comunicado_id, exc)
    finally:
        db.close()


def notificar_comunicado_bg(comunicado_id: str):
    threading.Thread(target=notificar_comunicado, args=(comunicado_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Plantilla 6 — Observación tutor  (desde routers/tutor)
# ---------------------------------------------------------------------------

def notificar_observacion(observacion_id: str):
    """
    Envía la observación del tutor al apoderado (si enviar_a_apoderado=True).
    """
    from database import SessionLocal
    from models.comunicado import ObservacionTutor
    from models.estudiante import Estudiante
    from models.usuario import Usuario

    db = SessionLocal()
    try:
        obs = db.query(ObservacionTutor).filter(ObservacionTutor.id == observacion_id).first()
        if not obs or not obs.enviar_a_apoderado or obs.correo_enviado:
            return

        estudiante = db.query(Estudiante).filter(Estudiante.id == obs.estudiante_id).first()
        tutor = db.query(Usuario).filter(Usuario.id == obs.tutor_id).first()
        if not estudiante:
            return

        emails = _apoderado_emails(estudiante.id, db)
        if not emails:
            return

        nombre = f"{estudiante.nombre} {estudiante.apellido}"
        tutor_nombre = f"{tutor.nombre} {tutor.apellido}" if tutor else "Tutor"
        tipo_label = {
            "academica": "Académica", "conductual": "Conductual",
            "salud": "Salud", "logro": "Logro", "otro": "General",
        }.get(obs.tipo, obs.tipo.capitalize())

        subject = f"📝 Observación del tutor sobre {nombre}"
        content = f"""
<p>Estimado apoderado,</p>
<p>El tutor de <strong>{nombre}</strong> ha registrado una observación.</p>
<div class="card">
  <strong>{tipo_label}</strong>
  <span>Por: {tutor_nombre} · {obs.created_at.strftime("%d/%m/%Y")}</span>
</div>
<p style="background:#f9f9f9;border-radius:6px;padding:14px;font-style:italic;color:#444">
  "{obs.descripcion}"
</p>
<a class="btn" href="{settings.FRONTEND_URL}/apoderado/comunicados">Ver en el sistema</a>
"""
        html = _html(content)
        if _send_many(emails, subject, html):
            obs.correo_enviado = True
            db.commit()

    except Exception as exc:
        logger.error("[notificar_observacion] %s: %s", observacion_id, exc)
    finally:
        db.close()


def notificar_observacion_bg(observacion_id: str):
    threading.Thread(target=notificar_observacion, args=(observacion_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Notificación de libreta disponible
# ---------------------------------------------------------------------------

def notificar_libreta(libreta_id: str):
    from database import SessionLocal
    from models.libreta import Libreta
    from models.estudiante import Estudiante
    db = SessionLocal()
    try:
        lib = db.query(Libreta).filter(Libreta.id == libreta_id).first()
        if not lib:
            return
        est = db.query(Estudiante).filter(Estudiante.id == lib.estudiante_id).first()
        if not est:
            return
        emails = _apoderado_emails(lib.estudiante_id, db)
        if not emails:
            return
        nombre_est = f"{est.nombre} {est.apellido}"
        html = _html(f"""
<p>Estimado/a apoderado/a,</p>
<p>Le informamos que la <strong>libreta de notas del Bimestre {lib.bimestre}</strong>
de <strong>{nombre_est}</strong> ya está disponible en el sistema CEAUNE.</p>
<div class="card">
  <strong>Bimestre {lib.bimestre} &middot; {lib.anio}</strong>
  <span>{nombre_est}</span>
</div>
<p>Ingrese a la aplicación para ver y descargar la libreta de su hijo/a.</p>
""")
        _send_many(emails, f"Libreta Bimestre {lib.bimestre} disponible — {nombre_est}", html)
    except Exception as exc:
        logger.warning("Error enviando notificación libreta %s: %s", libreta_id, exc)
    finally:
        db.close()


def notificar_libreta_bg(libreta_id: str):
    threading.Thread(target=notificar_libreta, args=(libreta_id,), daemon=True).start()
