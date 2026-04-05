import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Libreta(Base):
    """Libreta de notas por alumno y bimestre, almacenada en Google Drive."""
    __tablename__ = "libretas"

    id               = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    estudiante_id    = Column(String(36), ForeignKey("estudiantes.id"), nullable=False, index=True)
    tutor_id         = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    bimestre         = Column(Integer, nullable=False)        # 1, 2, 3 o 4
    anio             = Column(Integer, nullable=False)
    archivo_nombre   = Column(String(200), nullable=False)
    archivo_url      = Column(Text, nullable=False)           # URL pública Google Drive
    archivo_drive_id = Column(String(200), nullable=True)    # Para eliminar de Drive
    archivo_tipo     = Column(String(100), nullable=True)    # MIME type
    subido_en        = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
