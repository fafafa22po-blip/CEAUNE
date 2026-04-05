from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from schemas.estudiante import EstudianteBasico


class EscanearRequest(BaseModel):
    qr_token: str
    # "ingreso" | "salida" | "ingreso_especial" | "salida_especial"
    tipo_solicitado: str
    motivo_especial: Optional[str] = None   # Requerido para ingreso/salida especial
    observacion: Optional[str] = None
    forzar: bool = False                    # True = sobreescribir duplicado


class AsistenciaResponse(BaseModel):
    id: str
    estudiante_id: str
    auxiliar_id: Optional[str] = None
    fecha: date
    tipo: str
    hora: datetime
    estado: str
    motivo_especial: Optional[str] = None
    observacion: Optional[str] = None
    correo_enviado: bool

    model_config = {"from_attributes": True}


class EscaneoResult(BaseModel):
    asistencia: AsistenciaResponse
    estudiante: EstudianteBasico
    mensaje: str
    fue_sobreescrito: bool = False
    tardanzas_mes: int = 0
    faltas_mes: int = 0


class RegistroDia(BaseModel):
    estudiante: EstudianteBasico
    ingreso: Optional[AsistenciaResponse] = None
    salida: Optional[AsistenciaResponse] = None
    # puntual | tardanza | falta | especial
    estado_dia: str
    tardanzas_mes: int = 0
    faltas_mes: int = 0


class ResumenHoy(BaseModel):
    fecha: date
    nivel: Optional[str]
    total_estudiantes: int
    puntuales: int
    tardanzas: int
    faltas: int
    con_salida: int


class ManualRequest(BaseModel):
    estudiante_id: str
    tipo: str                           # ingreso | salida | ingreso_especial | salida_especial
    estado: str                         # puntual | tardanza | falta | especial
    motivo_especial: Optional[str] = None
    hora: Optional[datetime] = None
    observacion: Optional[str] = None
    fecha: Optional[date] = None


class PreviewRequest(BaseModel):
    qr_token: str


class PreviewResult(BaseModel):
    estudiante: EstudianteBasico
    tipo_a_enviar: str           # ingreso | salida | ingreso_especial | salida_especial
    estado_previsto: str         # puntual | tardanza | especial
    requiere_motivo: bool        # salida_especial → usuario elige motivo
    requiere_observacion: bool   # tardanza → usuario escribe motivo libre
    motivo_auto: Optional[str] = None   # ingreso_especial: heredado de salida_especial
    label: str                   # texto grande del header del modal
    sublabel: str                # descripción secundaria
