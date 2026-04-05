import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class Estudiante(Base):
    __tablename__ = "estudiantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dni = Column(String(8), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    grado = Column(String(10), nullable=False)
    seccion = Column(String(5), nullable=False)
    qr_token = Column(String(100), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class ApoderadoEstudiante(Base):
    __tablename__ = "apoderados_estudiantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    apoderado_id = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("apoderado_id", "estudiante_id", name="uq_apoderado_estudiante"),
    )
