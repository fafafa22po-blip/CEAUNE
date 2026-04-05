import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Date, Time, Enum, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from database import Base


class HorarioSecundaria(Base):
    __tablename__ = "horario_secundaria"

    id = Column(Integer, primary_key=True, default=1)
    hora_ingreso_limite = Column(Time, nullable=False)
    hora_salida_inicio = Column(Time, nullable=False)
    hora_cierre_registro = Column(Time, nullable=False)


class Asistencia(Base):
    __tablename__ = "asistencia"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    auxiliar_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha = Column(Date, nullable=False, server_default=func.curdate())
    tipo = Column(Enum("ingreso", "salida", "ingreso_especial", "salida_especial"), nullable=False)
    hora = Column(DateTime, nullable=False, server_default=func.now())
    estado = Column(Enum("puntual", "tardanza", "falta", "especial"), nullable=False)
    observacion = Column(Text, nullable=True)
    correo_enviado = Column(Boolean, default=False)
    correo_enviado_at = Column(DateTime, nullable=True)
