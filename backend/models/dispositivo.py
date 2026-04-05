import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class DispositivoUsuario(Base):
    __tablename__ = "dispositivos_usuario"
    __table_args__ = (
        UniqueConstraint("fcm_token", "usuario_id", name="uq_token_usuario"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    fcm_token = Column(String(500), nullable=False)
    plataforma = Column(String(20), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
