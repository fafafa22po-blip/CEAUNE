import uuid

from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id = Column(String(36), nullable=False, index=True)
    usuario_rol = Column(String(20), nullable=False)
    accion = Column(String(50), nullable=False)       # "ver_ficha_medica", etc.
    recurso_id = Column(String(36), nullable=True)    # ID del estudiante consultado
    ip = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
