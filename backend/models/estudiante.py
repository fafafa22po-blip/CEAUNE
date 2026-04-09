import uuid

from sqlalchemy import Boolean, Column, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Estudiante(Base):
    __tablename__ = "estudiantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dni = Column(String(8), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    sexo = Column(String(1), nullable=True)  # 'M' | 'F'
    nivel = Column(Enum("inicial", "primaria", "secundaria"), nullable=False)
    grado = Column(String(10), nullable=False)
    seccion = Column(String(20), nullable=False)
    qr_token = Column(String(100), unique=True, nullable=False)
    foto_url = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    # Campos de desactivación (nullable — solo se rellenan al desactivar)
    motivo_desactivacion = Column(String(50), nullable=True)
    desactivado_en = Column(TIMESTAMP, nullable=True)
    desactivado_por = Column(String(36), nullable=True)  # admin user id

    # Salud y necesidades especiales (todos opcionales)
    atencion_medica      = Column(Enum('ESSALUD', 'MINSA', 'SIS', 'NINGUNO', 'OTRO'), nullable=True)
    tiene_alergias       = Column(Boolean, nullable=True)
    alergias_detalle     = Column(Text, nullable=True)
    condicion_mental_nee = Column(Text, nullable=True)
    contacto_emergencia  = Column(Text, nullable=True)


class ApoderadoEstudiante(Base):
    __tablename__ = "apoderados_estudiantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    apoderado_id = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False)
