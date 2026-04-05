import uuid

from sqlalchemy import Column, Enum, ForeignKey, Integer, String, Text, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class HorarioArchivo(Base):
    """Un archivo (PDF o imagen) del horario semanal de clases por aula."""
    __tablename__ = "horarios_archivo"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nivel          = Column(Enum("inicial", "primaria", "secundaria"), nullable=False)
    grado          = Column(String(5),   nullable=False)
    seccion        = Column(String(5),   nullable=False)
    anio           = Column(Integer,     nullable=False)
    archivo_nombre = Column(String(200), nullable=False)
    archivo_url    = Column(Text,        nullable=False)   # Google Drive URL
    subido_por     = Column(String(36),  ForeignKey("usuarios.id"), nullable=True)
    created_at     = Column(TIMESTAMP,   server_default=func.now())

    __table_args__ = (
        # Un solo archivo por aula por año
        UniqueConstraint("nivel", "grado", "seccion", "anio", name="uq_horario_archivo_aula"),
    )
