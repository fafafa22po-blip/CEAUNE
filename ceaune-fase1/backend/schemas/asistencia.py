from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, date


class EscanearRequest(BaseModel):
    qr_token: Optional[str] = None
    dni: Optional[str] = None
    tipo: Literal["ingreso", "salida"] = "ingreso"
    observacion: Optional[str] = None


class AsistenciaOut(BaseModel):
    id: str
    estudiante_id: str
    estudiante_nombre: str
    estudiante_apellido: str
    estudiante_grado: str
    estudiante_seccion: str
    auxiliar_id: Optional[str]
    fecha: date
    tipo: str
    hora: datetime
    estado: str
    observacion: Optional[str]
    correo_enviado: bool
    correo_enviado_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ResumenDia(BaseModel):
    fecha: date
    total_estudiantes: int
    presentes: int
    puntuales: int
    tardanzas: int
    faltas: int
    salieron: int
