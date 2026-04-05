import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum, ForeignKey, Index
from sqlalchemy.sql import func
from database import Base


class Comunicado(Base):
    __tablename__ = "comunicados"

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    auxiliar_id     = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    batch_id        = Column(String(36), nullable=False)
    asunto          = Column(String(200), nullable=False)
    mensaje         = Column(Text, nullable=False)
    adjunto_nombre  = Column(String(200), nullable=True)
    adjunto_drive_url = Column(Text, nullable=True)
    tipo_envio      = Column(Enum("individual", "aula", "masivo"), nullable=False)
    created_at      = Column(DateTime, server_default=func.now())


class ComunicadoDestinatario(Base):
    __tablename__ = "comunicado_destinatarios"

    id                 = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    comunicado_id      = Column(String(36), ForeignKey("comunicados.id", ondelete="CASCADE"), nullable=False)
    estudiante_id      = Column(String(36), ForeignKey("estudiantes.id"), nullable=False)
    leido_apoderado    = Column(Boolean, default=False)
    leido_apoderado_at = Column(DateTime, nullable=True)
    correo_enviado     = Column(Boolean, default=False)
    correo_enviado_at  = Column(DateTime, nullable=True)


class ComunicadoRespuesta(Base):
    __tablename__ = "comunicado_respuestas"

    id               = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    destinatario_id  = Column(String(36), ForeignKey("comunicado_destinatarios.id", ondelete="CASCADE"), nullable=False)
    mensaje          = Column(Text, nullable=False)
    adjunto_nombre   = Column(String(200), nullable=True)
    adjunto_drive_url = Column(Text, nullable=True)
    leido_auxiliar   = Column(Boolean, default=False)
    leido_auxiliar_at = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
