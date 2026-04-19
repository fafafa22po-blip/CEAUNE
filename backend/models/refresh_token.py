import uuid

from sqlalchemy import Boolean, Column, String, TIMESTAMP
from sqlalchemy.sql import func

from database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 del token
    expires_at = Column(TIMESTAMP, nullable=False)
    revocado = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
