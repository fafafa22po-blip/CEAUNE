import re
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, field_validator, model_validator

MOTIVOS_DESACTIVACION = Literal[
    "retiro_voluntario",
    "traslado",
    "egreso",
    "disciplinario",
    "otro",
]


def _norm_grado(v: str) -> str:
    """Elimina sufijos ordinales: '5to' → '5', '1er' → '1', '2do' → '2'"""
    return re.sub(r'(?i)(er|ro|do|to|vo|mo|th|st|nd)$', '', v.strip()).strip()


def _norm_seccion(v: str) -> str:
    return v.strip()


class EstudianteBasico(BaseModel):
    id: str
    dni: str
    nombre: str
    apellido: str
    sexo: Optional[str] = None
    nivel: str
    grado: str
    seccion: str
    foto_url: Optional[str] = None
    # Salud y necesidades especiales
    atencion_medica:      Optional[str]  = None
    tiene_alergias:       Optional[bool] = None
    alergias_detalle:     Optional[str]  = None
    condicion_mental_nee: Optional[str]  = None
    contacto_emergencia:  Optional[str]  = None

    model_config = {"from_attributes": True}


class EstudianteResponse(EstudianteBasico):
    qr_token: str
    activo: bool
    created_at: datetime
    motivo_desactivacion: Optional[str] = None
    desactivado_en: Optional[datetime] = None
    desactivado_por: Optional[str] = None


class DesactivarRequest(BaseModel):
    motivo: MOTIVOS_DESACTIVACION


class ReactivarRequest(BaseModel):
    nivel: str
    grado: str
    seccion: str

    @field_validator("grado")
    @classmethod
    def normalizar_grado(cls, v: str) -> str:
        return _norm_grado(v)

    @field_validator("seccion")
    @classmethod
    def normalizar_seccion(cls, v: str) -> str:
        return _norm_seccion(v)


class EstudianteCreate(BaseModel):
    dni: str
    nombre: str
    apellido: str
    sexo: Optional[str] = None
    nivel: str
    grado: str
    seccion: str
    foto_url: Optional[str] = None
    # Salud y necesidades especiales
    atencion_medica:      Optional[str]  = None
    tiene_alergias:       Optional[bool] = None
    alergias_detalle:     Optional[str]  = None
    condicion_mental_nee: Optional[str]  = None
    contacto_emergencia:  Optional[str]  = None

    @model_validator(mode="before")
    @classmethod
    def _vacios_a_none(cls, data: Any) -> Any:
        """Convierte strings vacíos a None en campos opcionales para evitar
        errores ENUM de MySQL cuando el formulario se envía sin rellenar."""
        if isinstance(data, dict):
            for campo in ("sexo", "foto_url", "atencion_medica",
                          "alergias_detalle", "condicion_mental_nee", "contacto_emergencia"):
                if data.get(campo) == "":
                    data[campo] = None
        return data

    @field_validator("grado")
    @classmethod
    def normalizar_grado(cls, v: str) -> str:
        return _norm_grado(v)

    @field_validator("seccion")
    @classmethod
    def normalizar_seccion(cls, v: str) -> str:
        return _norm_seccion(v)


class EstudianteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    sexo: Optional[str] = None
    nivel: Optional[str] = None
    grado: Optional[str] = None
    seccion: Optional[str] = None
    foto_url: Optional[str] = None
    activo: Optional[bool] = None
    # Salud y necesidades especiales
    atencion_medica:      Optional[str]  = None
    tiene_alergias:       Optional[bool] = None
    alergias_detalle:     Optional[str]  = None
    condicion_mental_nee: Optional[str]  = None
    contacto_emergencia:  Optional[str]  = None

    @model_validator(mode="before")
    @classmethod
    def _vacios_a_none(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for campo in ("sexo", "foto_url", "atencion_medica",
                          "alergias_detalle", "condicion_mental_nee", "contacto_emergencia"):
                if data.get(campo) == "":
                    data[campo] = None
        return data

    @field_validator("grado")
    @classmethod
    def normalizar_grado(cls, v: Optional[str]) -> Optional[str]:
        return _norm_grado(v) if v is not None else v

    @field_validator("seccion")
    @classmethod
    def normalizar_seccion(cls, v: Optional[str]) -> Optional[str]:
        return _norm_seccion(v) if v is not None else v
