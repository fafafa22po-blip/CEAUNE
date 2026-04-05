from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class AulaInput(BaseModel):
    grado: str
    seccion: str


class ComunicadoEnviar(BaseModel):
    tipo_envio:    Literal["individual", "aula", "masivo"]
    asunto:        str
    mensaje:       str
    # Individual
    estudiante_ids: Optional[list[str]] = None
    # Aula
    grado:   Optional[str] = None
    seccion: Optional[str] = None
    # Masivo
    aulas: Optional[list[AulaInput]] = None
    # Adjunto (Google Drive — pendiente de implementar)
    adjunto_nombre:    Optional[str] = None
    adjunto_drive_url: Optional[str] = None


class ComunicadoEnviado(BaseModel):
    batch_id:            str
    total_destinatarios: int
    correos_enviados:    int


class RespuestaOut(BaseModel):
    id:               str
    destinatario_id:  str
    mensaje:          str
    adjunto_nombre:   Optional[str]
    adjunto_drive_url: Optional[str]
    leido_auxiliar:   bool
    leido_auxiliar_at: Optional[datetime]
    created_at:       datetime

    model_config = {"from_attributes": True}


class DestinatarioOut(BaseModel):
    id:                 str
    estudiante_id:      str
    estudiante_nombre:  str
    estudiante_apellido: str
    estudiante_grado:   str
    estudiante_seccion: str
    leido_apoderado:    bool
    leido_apoderado_at: Optional[datetime]
    correo_enviado:     bool
    correo_enviado_at:  Optional[datetime]
    tiene_respuesta:    bool

    model_config = {"from_attributes": True}


class ComunicadoOut(BaseModel):
    id:                  str
    batch_id:            str
    auxiliar_id:         str
    asunto:              str
    tipo_envio:          str
    created_at:          datetime
    total_destinatarios: int
    leidos:              int
    respuestas_sin_leer: int

    model_config = {"from_attributes": True}


class ComunicadoDetalle(BaseModel):
    id:               str
    batch_id:         str
    asunto:           str
    mensaje:          str
    adjunto_nombre:   Optional[str]
    adjunto_drive_url: Optional[str]
    tipo_envio:       str
    created_at:       datetime
    destinatarios:    list[DestinatarioOut]
    respuestas:       list[RespuestaOut]


class ComunicadoApoderadoOut(BaseModel):
    destinatario_id:    str
    comunicado_id:      str
    asunto:             str
    mensaje:            str
    adjunto_nombre:     Optional[str]
    adjunto_drive_url:  Optional[str]
    tipo_envio:         str
    created_at:         datetime
    leido_apoderado:    bool
    leido_apoderado_at: Optional[datetime]
    estudiante_nombre:  str
    estudiante_apellido: str
    tiene_respuesta_mia: bool


class RespuestaCreate(BaseModel):
    mensaje:           str
    adjunto_nombre:    Optional[str] = None
    adjunto_drive_url: Optional[str] = None
