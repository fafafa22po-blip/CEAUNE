import uuid

from sqlalchemy import Column, Date, Enum, ForeignKey, Index, String, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class HorarioExcepcion(Base):
    __tablename__ = "horarios_excepcion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nivel = Column(
        Enum("inicial", "primaria", "secundaria", "todos"),
        nullable=False,
    )
    fecha = Column(Date, nullable=False)
    hora_ingreso_fin   = Column(String(8), nullable=True)   # NULL = usar horario base
    hora_salida_inicio = Column(String(8), nullable=True)
    hora_cierre_faltas = Column(String(8), nullable=True)
    motivo = Column(String(200), nullable=False)
    created_by = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        Index("idx_excepcion_fecha", "fecha"),
    )
