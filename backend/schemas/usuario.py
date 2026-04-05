from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    dni: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos


class UsuarioResponse(BaseModel):
    id: str
    dni: str
    nombre: str
    apellido: str
    email: str
    rol: str
    nivel: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    activo: bool
    es_apoderado: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UsuarioCreate(BaseModel):
    dni: str
    nombre: str
    apellido: str
    email: EmailStr
    password: str
    rol: str
    nivel: Optional[str] = None
    foto_url: Optional[str] = None


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[EmailStr] = None
    nivel: Optional[str] = None
    foto_url: Optional[str] = None
    activo: Optional[bool] = None


class PerfilUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    password_actual: str
    password_nuevo: str
