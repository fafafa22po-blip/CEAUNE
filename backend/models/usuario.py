import uuid

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dni = Column(String(12), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(
        Enum("apoderado", "tutor", "i-auxiliar", "p-auxiliar", "s-auxiliar", "admin"),
        nullable=False,
    )
    nivel = Column(
        Enum("inicial", "primaria", "secundaria", "todos"),
        nullable=True,
    )
    telefono = Column(String(15), nullable=True)
    foto_url = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    es_apoderado = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TutorAula(Base):
    __tablename__ = "tutores_aulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tutor_id = Column(String(36), ForeignKey("usuarios.id"), unique=True, nullable=False)
    nivel = Column(Enum("inicial", "primaria", "secundaria"), nullable=False)
    grado = Column(String(10), nullable=False)
    seccion = Column(String(5), nullable=False)
    anio = Column(Integer, nullable=False)
