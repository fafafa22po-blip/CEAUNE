import uuid

from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, String, Text, Time, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class ReunionTutor(Base):
    __tablename__ = "reuniones_tutor"

    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tutor_id      = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False)
    titulo        = Column(String(200), nullable=False)
    descripcion   = Column(Text, nullable=True)
    fecha         = Column(Date, nullable=False)
    hora          = Column(Time, nullable=False)
    modalidad     = Column(Enum("presencial", "virtual"), nullable=False, default="presencial")
    lugar         = Column(String(200), nullable=True)   # sala fisica o link
    estado        = Column(
        Enum("pendiente", "confirmada", "realizada", "cancelada"),
        nullable=False,
        default="pendiente",
    )
    notificado_apoderado = Column(Boolean, default=False)
    created_at    = Column(TIMESTAMP, server_default=func.now())
