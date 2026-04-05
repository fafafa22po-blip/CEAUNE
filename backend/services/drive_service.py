"""
Google Drive Service — CEAUNE Asistencia
Sube adjuntos (certificados, documentos) a Google Drive.
Usa las mismas credenciales OAuth2 que gmail_service.
"""

import io
import logging
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from core.config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/gmail.send",
]

# Tipos MIME permitidos para adjuntos
MIME_PERMITIDOS = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",  # Tipo genérico para archivos de cualquier formato
}

MAX_SIZE_MB = 10


def _get_service():
    if not settings.GMAIL_CLIENT_ID or not settings.GMAIL_REFRESH_TOKEN:
        raise RuntimeError("Credenciales Google no configuradas en .env")

    creds = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def subir_archivo(
    contenido: bytes,
    nombre: str,
    mime_type: str,
    carpeta_id: Optional[str] = None,
) -> dict:
    """
    Sube un archivo a Google Drive.
    Retorna {"nombre": str, "url": str, "file_id": str}
    """
    if mime_type not in MIME_PERMITIDOS:
        raise ValueError(f"Tipo de archivo no permitido: {mime_type}")

    if len(contenido) > MAX_SIZE_MB * 1024 * 1024:
        raise ValueError(f"El archivo supera {MAX_SIZE_MB} MB")

    carpeta = carpeta_id or settings.DRIVE_FOLDER_ID or None

    metadata = {"name": nombre}
    if carpeta:
        metadata["parents"] = [carpeta]

    media = MediaIoBaseUpload(io.BytesIO(contenido), mimetype=mime_type, resumable=False)

    svc = _get_service()
    archivo = (
        svc.files()
        .create(body=metadata, media_body=media, fields="id,name,webViewLink")
        .execute()
    )

    # Hacer público (lectura) para que los apoderados puedan ver el enlace
    svc.permissions().create(
        fileId=archivo["id"],
        body={"role": "reader", "type": "anyone"},
    ).execute()

    url = archivo.get("webViewLink", f"https://drive.google.com/file/d/{archivo['id']}/view")
    logger.info("Archivo subido a Drive: %s → %s", nombre, url)

    return {
        "nombre": archivo["name"],
        "url": url,
        "file_id": archivo["id"],
    }


def eliminar_archivo(file_id: str) -> bool:
    """Elimina un archivo de Drive. Retorna True si fue exitoso."""
    try:
        _get_service().files().delete(fileId=file_id).execute()
        logger.info("Archivo eliminado de Drive: %s", file_id)
        return True
    except Exception as exc:
        logger.warning("No se pudo eliminar archivo %s: %s", file_id, exc)
        return False
