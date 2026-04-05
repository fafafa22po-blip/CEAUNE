from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from schemas.asistencia import AsistenciaResponse
from schemas.estudiante import EstudianteBasico


class JustificacionCreate(BaseModel):
    asistencia_id: str
    motivo: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None


class JustificacionResponse(BaseModel):
    id: str
    asistencia_id: str
    apoderado_id: str
    motivo: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None
    estado: str                             # pendiente | aprobada | rechazada
    revisado_por: Optional[str] = None
    revisado_at: Optional[datetime] = None
    observacion_revision: Optional[str] = None
    created_at: datetime
    # Datos relacionados (enriquecidos)
    asistencia: Optional[AsistenciaResponse] = None
    estudiante: Optional[EstudianteBasico] = None

    model_config = {"from_attributes": True}


class RevisionRequest(BaseModel):
    observacion: Optional[str] = None      # obligatorio al rechazar
