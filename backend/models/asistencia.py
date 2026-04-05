import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Index, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Asistencia(Base):
    __tablename__ = "asistencia"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    auxiliar_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha = Column(Date, nullable=False)
    tipo = Column(
        Enum("ingreso", "salida", "ingreso_especial", "salida_especial"),
        nullable=False,
    )
    hora = Column(DateTime, nullable=False, default=func.now())
    estado = Column(
        Enum("puntual", "tardanza", "falta", "especial"),
        nullable=False,
    )
    motivo_especial = Column(
        Enum(
            "marcha",
            "juegos_deportivos",
            "enfermedad",
            "permiso_apoderado",
            "actividad_institucional",
            "tardanza_justificada",
            "otro",
        ),
        nullable=True,
    )
    observacion = Column(Text, nullable=True)
    correo_enviado = Column(Boolean, default=False)
    correo_enviado_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_fecha", "fecha"),
        Index("idx_est_fecha", "estudiante_id", "fecha"),
    )


class Horario(Base):
    __tablename__ = "horarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nivel = Column(Enum("inicial", "primaria", "secundaria"), unique=True, nullable=False)
    hora_ingreso_inicio = Column(String(8), nullable=False)
    hora_ingreso_fin = Column(String(8), nullable=False)
    hora_salida_inicio = Column(String(8), nullable=False)
    hora_salida_fin = Column(String(8), nullable=False)
    hora_cierre_faltas = Column(String(8), nullable=False)
