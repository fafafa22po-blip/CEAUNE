from pydantic import BaseModel, EmailStr
from typing import Literal, Optional
from datetime import datetime


class UsuarioBase(BaseModel):
    dni: str
    nombre: str
    apellido: str
    email: EmailStr
    rol: Literal["apoderado", "auxiliar", "admin"]
    telefono: Optional[str] = None


class UsuarioCreate(UsuarioBase):
    password: str


class UsuarioOut(UsuarioBase):
    id: str
    activo: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    dni: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut
