from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class EstudianteBase(BaseModel):
    dni: str
    nombre: str
    apellido: str
    grado: str
    seccion: str


class ApoderadoInput(BaseModel):
    dni: str
    nombre: str
    apellido: str
    email: EmailStr
    telefono: Optional[str] = None


class EstudianteCreate(EstudianteBase):
    apoderado: Optional[ApoderadoInput] = None


class EstudianteOut(EstudianteBase):
    id: str
    qr_token: str
    activo: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EstudianteCreado(BaseModel):
    estudiante: EstudianteOut
    apoderado_creado: bool
    apoderado_existente: bool
    password_temporal: Optional[str] = None


class EstudianteResumen(BaseModel):
    id: str
    nombre: str
    apellido: str
    grado: str
    seccion: str

    model_config = {"from_attributes": True}


# ── Apoderado como aparece en la ficha de un estudiante ──────────────────────
class ApoderadoResumen(BaseModel):
    id: str
    dni: str
    nombre: str
    apellido: str
    email: str
    telefono: Optional[str] = None
    activo: bool

    model_config = {"from_attributes": True}


# ── Apoderado con lista de hijos (para admin) ─────────────────────────────────
class ApoderadoConHijos(BaseModel):
    id: str
    dni: str
    nombre: str
    apellido: str
    email: str
    telefono: Optional[str] = None
    activo: bool
    hijos: list[EstudianteResumen]
