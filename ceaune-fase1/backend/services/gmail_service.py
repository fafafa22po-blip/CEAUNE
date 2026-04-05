"""
Gmail API — Servicio de notificaciones de asistencia CEAUNE
Usa OAuth2 con refresh_token (no requiere interacción del usuario en producción).

Cuando GMAIL_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN están vacíos en .env,
las funciones retornan False silenciosamente sin romper el flujo.
"""

import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

from core.config import settings

logger = logging.getLogger(__name__)


# ─── Build Gmail service ──────────────────────────────────────────────────────

def _get_gmail_service():
    """Retorna el servicio autenticado de Gmail o None si faltan credenciales."""
    if not all([settings.GMAIL_CLIENT_ID, settings.GMAIL_CLIENT_SECRET, settings.GMAIL_REFRESH_TOKEN]):
        return None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.GMAIL_REFRESH_TOKEN,
            client_id=settings.GMAIL_CLIENT_ID,
            client_secret=settings.GMAIL_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
        )
        return build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error(f"[Gmail] Error construyendo servicio: {e}")
        return None


def _enviar(destinatario: str, asunto: str, html: str) -> bool:
    """Envía un correo HTML. Retorna True si fue exitoso."""
    service = _get_gmail_service()
    if service is None:
        logger.warning("[Gmail] Credenciales no configuradas — correo no enviado")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"]    = settings.GMAIL_FROM
        msg["To"]      = destinatario
        msg.attach(MIMEText(html, "html", "utf-8"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        logger.info(f"[Gmail] Correo enviado a {destinatario} — {asunto}")
        return True
    except Exception as e:
        logger.error(f"[Gmail] Error enviando a {destinatario}: {e}")
        return False


# ─── Plantillas HTML ──────────────────────────────────────────────────────────

def _base_html(contenido: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8">
<style>
  body      {{ font-family: Arial, sans-serif; background:#f4f6f8; margin:0; padding:0; }}
  .wrapper  {{ max-width:520px; margin:30px auto; }}
  .header   {{ background:#0a1f3d; padding:24px 32px; border-radius:8px 8px 0 0; text-align:center; }}
  .header h1{{ color:#c9a227; margin:0; font-size:22px; letter-spacing:1px; }}
  .header p {{ color:#ccd6e0; margin:4px 0 0; font-size:13px; }}
  .body     {{ background:#ffffff; padding:28px 32px; border:1px solid #dde3ea; }}
  .body p   {{ color:#333; line-height:1.6; margin:0 0 12px; }}
  .badge    {{ display:inline-block; padding:6px 18px; border-radius:20px;
               font-weight:bold; font-size:15px; margin:8px 0 16px; }}
  .puntual  {{ background:#d4edda; color:#155724; }}
  .tardanza {{ background:#fff3cd; color:#856404; }}
  .falta    {{ background:#f8d7da; color:#721c24; }}
  .data-row {{ background:#f0f4f8; border-radius:6px; padding:12px 16px; margin:16px 0; }}
  .data-row span{{ display:block; font-size:13px; color:#555; }}
  .data-row strong{{ font-size:15px; color:#0a1f3d; }}
  .footer   {{ background:#0a1f3d; padding:14px 32px; border-radius:0 0 8px 8px;
               text-align:center; }}
  .footer p {{ color:#8899aa; font-size:12px; margin:0; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>CEAUNE</h1>
    <p>Sistema de Asistencia — Secundaria</p>
  </div>
  <div class="body">
    {contenido}
  </div>
  <div class="footer">
    <p>Colegio de Aplicación UNE — Mensaje automático, no responder</p>
  </div>
</div>
</body>
</html>
"""


def _html_puntual(nombre: str, apellido: str, hora: str, fecha: str,
                  grado: str, seccion: str) -> str:
    return _base_html(f"""
<p>Estimado/a apoderado/a,</p>
<p>Le informamos que su hijo/a:</p>
<div class="data-row">
  <strong>{nombre} {apellido}</strong>
  <span>{grado} &lsquo;{seccion}&rsquo; &mdash; Secundaria CEAUNE</span>
</div>
<p>registró <span class="badge puntual">✅ Ingreso Puntual</span></p>
<p>el día <strong>{fecha}</strong> a las <strong>{hora}</strong>.</p>
<p style="color:#666;font-size:13px;">Gracias por su compromiso con la puntualidad.</p>
""")


def _html_tardanza(nombre: str, apellido: str, hora: str, fecha: str,
                   minutos: int, grado: str, seccion: str) -> str:
    return _base_html(f"""
<p>Estimado/a apoderado/a,</p>
<p>Le informamos que su hijo/a:</p>
<div class="data-row">
  <strong>{nombre} {apellido}</strong>
  <span>{grado} &lsquo;{seccion}&rsquo; &mdash; Secundaria CEAUNE</span>
</div>
<p>registró <span class="badge tardanza">⚠️ Tardanza</span></p>
<p>el día <strong>{fecha}</strong> a las <strong>{hora}</strong>
   ({minutos} minuto(s) de retraso).</p>
<p style="color:#666;font-size:13px;">
  Le pedimos tomar las medidas necesarias para garantizar la puntualidad.
  Si tiene alguna consulta, comuníquese con la secretaría del colegio.
</p>
""")


def _html_falta(nombre: str, apellido: str, fecha: str,
                grado: str, seccion: str) -> str:
    return _base_html(f"""
<p>Estimado/a apoderado/a,</p>
<p>Le informamos que su hijo/a:</p>
<div class="data-row">
  <strong>{nombre} {apellido}</strong>
  <span>{grado} &lsquo;{seccion}&rsquo; &mdash; Secundaria CEAUNE</span>
</div>
<p>registró <span class="badge falta">❌ Falta</span></p>
<p>el día <strong>{fecha}</strong> no registró asistencia al colegio.</p>
<p style="color:#666;font-size:13px;">
  Si esto es un error o la inasistencia fue justificada, comuníquese con
  secretaría a la brevedad posible.
</p>
""")


# ─── Funciones públicas ───────────────────────────────────────────────────────

def enviar_correo_puntual(destinatario: str, nombre: str, apellido: str,
                          hora: str, fecha: str, grado: str, seccion: str) -> bool:
    asunto = f"✅ {nombre} llegó al colegio — {hora}"
    return _enviar(destinatario, asunto, _html_puntual(nombre, apellido, hora, fecha, grado, seccion))


def enviar_correo_tardanza(destinatario: str, nombre: str, apellido: str,
                           hora: str, fecha: str, minutos_retraso: int,
                           grado: str, seccion: str) -> bool:
    asunto = f"⚠️ {nombre} llegó tarde — {hora}"
    return _enviar(destinatario, asunto, _html_tardanza(nombre, apellido, hora, fecha, minutos_retraso, grado, seccion))


def enviar_correo_falta(destinatario: str, nombre: str, apellido: str,
                        fecha: str, grado: str, seccion: str) -> bool:
    asunto = f"❌ {nombre} no asistió hoy — {fecha}"
    return _enviar(destinatario, asunto, _html_falta(nombre, apellido, fecha, grado, seccion))


def enviar_correo_por_estado(db, registro, estudiante) -> bool:
    """
    Dispatcher llamado desde el router de asistencia al escanear.
    Busca el email del apoderado y despacha la plantilla correcta.
    """
    from models.estudiante import ApoderadoEstudiante
    from models.usuario import Usuario

    # Buscar apoderados del estudiante
    relaciones = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.estudiante_id == estudiante.id
    ).all()

    if not relaciones:
        logger.info(f"[Gmail] Estudiante {estudiante.id} sin apoderado registrado")
        return False

    hora_str  = registro.hora.strftime("%H:%M")
    fecha_str = registro.fecha.strftime("%d/%m/%Y")
    enviado   = False

    for rel in relaciones:
        apoderado = db.query(Usuario).filter(Usuario.id == rel.apoderado_id).first()
        if not apoderado or not apoderado.email:
            continue

        if registro.estado == "puntual":
            ok = enviar_correo_puntual(
                apoderado.email, estudiante.nombre, estudiante.apellido,
                hora_str, fecha_str, estudiante.grado, estudiante.seccion,
            )
        elif registro.estado == "tardanza":
            from models.asistencia import HorarioSecundaria
            horario = db.query(HorarioSecundaria).filter_by(id=1).first()
            limite  = horario.hora_ingreso_limite if horario else None
            if limite:
                minutos = (registro.hora.hour * 60 + registro.hora.minute) - (limite.hour * 60 + limite.minute)
            else:
                minutos = 0
            ok = enviar_correo_tardanza(
                apoderado.email, estudiante.nombre, estudiante.apellido,
                hora_str, fecha_str, minutos, estudiante.grado, estudiante.seccion,
            )
        else:
            continue  # salidas no generan correo

        if ok:
            enviado = True

    # Marcar correo como enviado en el registro
    if enviado:
        from datetime import datetime
        registro.correo_enviado    = True
        registro.correo_enviado_at = datetime.now()
        db.commit()

    return enviado


# ─── Notificación de comunicado ───────────────────────────────────────────────

def enviar_notificacion_comunicado(
    destinatario: str,
    nombre_apoderado: str,
    asunto: str,
    frontend_url: str,
) -> bool:
    html = _base_html(f"""
<p>Estimado/a <strong>{nombre_apoderado}</strong>,</p>
<p>El auxiliar de secundaria del <strong>CEAUNE</strong> le ha enviado un comunicado:</p>
<div class="data-row">
  <span>Asunto del comunicado</span>
  <strong>{asunto}</strong>
</div>
<p>Para leerlo y responder, ingrese al sistema con su DNI:</p>
<div style="text-align:center;margin:20px 0;">
  <a href="{frontend_url}" style="
    display:inline-block;background:#c9a227;color:#fff;
    padding:12px 28px;border-radius:8px;font-weight:bold;
    text-decoration:none;font-size:15px;">
    Leer comunicado
  </a>
</div>
<p style="color:#666;font-size:13px;">
  Si no puede hacer clic en el botón, copie este enlace en su navegador:<br>
  <span style="color:#0a1f3d;">{frontend_url}</span>
</p>
""")
    asunto_correo = f"📌 Nuevo comunicado del CEAUNE: {asunto}"
    return _enviar(destinatario, asunto_correo, html)
