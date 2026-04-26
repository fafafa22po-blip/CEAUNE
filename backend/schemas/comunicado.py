from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from core.sanitize import TextoLimpio, TextoLimpioOpcional
from schemas.estudiante import EstudianteBasico


class RespuestaResponse(BaseModel):
    id: str
    mensaje: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None
    leido_auxiliar: bool
    leido_auxiliar_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DestinatarioResponse(BaseModel):
    id: str
    estudiante: EstudianteBasico
    leido_apoderado: bool
    leido_apoderado_at: Optional[datetime] = None
    correo_enviado: bool
    respuestas: List[RespuestaResponse] = []

    model_config = {"from_attributes": True}


class ComunicadoResponse(BaseModel):
    id: str
    auxiliar_id: str
    batch_id: str
    asunto: str
    mensaje: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None
    tipo_envio: str
    tipo: str = "normal"
    cargo_emisor: Optional[str] = None
    created_at: datetime
    total_destinatarios: Optional[int] = None
    leidos: Optional[int] = None

    model_config = {"from_attributes": True}


class ComunicarRequest(BaseModel):
    tipo_envio: str
    estudiantes_ids: List[str] = []
    nivel: Optional[str] = None
    grado: Optional[str] = None
    seccion: Optional[str] = None
    niveles: Optional[List[str]] = None
    asunto: TextoLimpio
    mensaje: TextoLimpio
    adjunto_nombre: TextoLimpioOpcional = None
    adjunto_drive_url: Optional[str] = None


class ResponderRequest(BaseModel):
    mensaje: TextoLimpio
    adjunto_nombre: TextoLimpioOpcional = None
    adjunto_drive_url: Optional[str] = None


class RespuestaInboxItem(BaseModel):
    id: str
    dest_id: str
    comunicado_id: str
    asunto: str
    mensaje_comunicado: str
    adjunto_comunicado_nombre: Optional[str] = None
    adjunto_comunicado_url: Optional[str] = None
    mensaje: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None
    leido_auxiliar: bool
    leido_auxiliar_at: Optional[datetime] = None
    created_at: datetime
    estudiante: EstudianteBasico

    model_config = {"from_attributes": True}


class BandejaRespuestasResponse(BaseModel):
    items: List[RespuestaInboxItem]
    total: int
    no_leidas: int


class PendienteItem(BaseModel):
    dest_id: str
    comunicado_id: str
    asunto: str
    mensaje_comunicado: str
    created_at: datetime
    leido_apoderado: bool
    leido_apoderado_at: Optional[datetime] = None
    estudiante: EstudianteBasico

    model_config = {"from_attributes": True}


class BandejaPendientesResponse(BaseModel):
    items: List[PendienteItem]
    total: int
