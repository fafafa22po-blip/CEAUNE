import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class Comunicado(Base):
    __tablename__ = "comunicados"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    auxiliar_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    batch_id = Column(String(36), nullable=False)
    asunto = Column(String(200), nullable=False)
    mensaje = Column(Text, nullable=False)
    adjunto_nombre = Column(String(200), nullable=True)
    adjunto_drive_url = Column(Text, nullable=True)
    tipo_envio = Column(Enum("individual", "aula", "masivo"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class ComunicadoDestinatario(Base):
    __tablename__ = "comunicado_destinatarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    comunicado_id = Column(
        String(36), ForeignKey("comunicados.id", ondelete="CASCADE"), nullable=False
    )
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    leido_apoderado = Column(Boolean, default=False)
    leido_apoderado_at = Column(DateTime, nullable=True)
    correo_enviado = Column(Boolean, default=False)


class ComunicadoRespuesta(Base):
    __tablename__ = "comunicado_respuestas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    destinatario_id = Column(
        String(36), ForeignKey("comunicado_destinatarios.id"), nullable=False
    )
    mensaje = Column(Text, nullable=False)
    adjunto_nombre = Column(String(200), nullable=True)
    adjunto_drive_url = Column(Text, nullable=True)
    leido_auxiliar = Column(Boolean, default=False)
    leido_auxiliar_at = Column(DateTime, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class ObservacionTutor(Base):
    __tablename__ = "observaciones_tutor"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tutor_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    estudiante_id = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    tipo = Column(
        Enum("academica", "conductual", "salud", "logro", "otro"), nullable=False
    )
    descripcion = Column(Text, nullable=False)
    enviar_a_apoderado = Column(Boolean, default=True)
    correo_enviado = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
