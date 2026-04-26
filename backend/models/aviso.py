import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class AvisoDirectivo(Base):
    __tablename__ = "avisos_directivo"

    id         = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emisor_id  = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    receptor_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    mensaje    = Column(Text, nullable=False)
    leido      = Column(Boolean, default=False)
    leido_at   = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
