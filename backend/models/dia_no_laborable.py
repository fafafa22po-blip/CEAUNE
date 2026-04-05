import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class DiasNoLaborables(Base):
    __tablename__ = "dias_no_laborables"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fecha = Column(Date, unique=True, nullable=False)
    tipo = Column(String(20), nullable=False, default="feriado")   # feriado | vacacion | evento
    nivel = Column(String(20), nullable=False, default="todos")    # todos | inicial | primaria | secundaria
    grado = Column(String(5), nullable=True)
    seccion = Column(String(2), nullable=True)
    motivo = Column(String(200), nullable=False)
    created_by = Column(String(36), ForeignKey("usuarios.id"), nullable=True)


class ReporteSemanal(Base):
    __tablename__ = "reportes_semanales"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    semana_inicio = Column(Date, nullable=False)
    semana_fin = Column(Date, nullable=False)
    dias_asistio = Column(Integer, default=0)
    dias_laborables = Column(Integer, default=0)
    tardanzas = Column(Integer, default=0)
    faltas = Column(Integer, default=0)
    comunicados_pendientes = Column(Integer, default=0)
    correo_enviado = Column(Boolean, default=False)
    correo_enviado_at = Column(DateTime, nullable=True)
