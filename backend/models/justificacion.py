import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Justificacion(Base):
    __tablename__ = "justificaciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asistencia_id = Column(String(36), ForeignKey("asistencia.id"), nullable=False)
    apoderado_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    motivo = Column(Text, nullable=False)
    adjunto_nombre = Column(String(200), nullable=True)
    adjunto_drive_url = Column(Text, nullable=True)
    estado = Column(Enum("pendiente", "aprobada", "rechazada"), default="pendiente")
    revisado_por = Column(String(36), nullable=True)
    revisado_at = Column(DateTime, nullable=True)
    observacion_revision = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
