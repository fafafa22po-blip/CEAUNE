import uuid
from sqlalchemy import Boolean, Column, Date, Enum, String, Text, TIMESTAMP
from sqlalchemy.sql import func
from database import Base


class Anuncio(Base):
    __tablename__ = "anuncios"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    titulo         = Column(String(200), nullable=True)
    imagen_url     = Column(Text, nullable=False)
    imagen_nombre  = Column(String(200), nullable=True)
    nivel          = Column(Enum("todos", "inicial", "primaria", "secundaria"), nullable=False, default="todos")
    fecha_inicio   = Column(Date, nullable=False)
    fecha_fin      = Column(Date, nullable=False)
    activo         = Column(Boolean, default=True, nullable=False)
    autor_id       = Column(String(36), nullable=True)
    created_at     = Column(TIMESTAMP, server_default=func.now())
