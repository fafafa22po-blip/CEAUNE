import uuid
from sqlalchemy import Column, String, Text, TIMESTAMP
from sqlalchemy.sql import func
from database import Base


class LoginFoto(Base):
    __tablename__ = "login_fotos"

    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    imagen_url    = Column(Text, nullable=False)
    imagen_nombre = Column(String(200), nullable=True)
    created_at    = Column(TIMESTAMP, server_default=func.now())
