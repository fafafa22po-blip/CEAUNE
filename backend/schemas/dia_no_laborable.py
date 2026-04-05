from datetime import date, timedelta
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator


def _td_to_str(v: Any) -> str:
    """Convierte timedelta (devuelto por PyMySQL para columnas TIME) a 'HH:MM:SS'."""
    if isinstance(v, timedelta):
        total = int(v.total_seconds())
        h, rem = divmod(total, 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
    return str(v)


class DiasNoLaborablesCreate(BaseModel):
    fecha_inicio: date
    fecha_fin: Optional[date] = None          # None = solo un día
    tipo: str = "feriado"                     # feriado | vacacion | evento
    nivel: str = "todos"                      # todos | inicial | primaria | secundaria
    grado: Optional[str] = None
    seccion: Optional[str] = None
    descripcion: str                          # motivo visible
    notificar: bool = True                    # enviar push a apoderados


class DiasNoLaborablesResponse(BaseModel):
    id: str
    fecha: date
    tipo: str
    nivel: str
    grado: Optional[str] = None
    seccion: Optional[str] = None
    motivo: str
    created_by: Optional[str] = None

    model_config = {"from_attributes": True}


class HorarioUpdate(BaseModel):
    hora_ingreso_inicio: Optional[str] = None   # "HH:MM:SS"
    hora_ingreso_fin: Optional[str] = None
    hora_salida_inicio: Optional[str] = None
    hora_salida_fin: Optional[str] = None
    hora_cierre_faltas: Optional[str] = None


class HorarioResponse(BaseModel):
    id: str
    nivel: str
    hora_ingreso_inicio: str
    hora_ingreso_fin: str
    hora_salida_inicio: str
    hora_salida_fin: str
    hora_cierre_faltas: str

    model_config = {"from_attributes": True}

    @field_validator(
        "hora_ingreso_inicio", "hora_ingreso_fin",
        "hora_salida_inicio", "hora_salida_fin",
        "hora_cierre_faltas",
        mode="before",
    )
    @classmethod
    def normalizar_hora(cls, v: Any) -> str:
        return _td_to_str(v)


class HorarioExcepcionCreate(BaseModel):
    nivel: str                          # inicial | primaria | secundaria | todos
    fecha: date
    hora_ingreso_fin:   Optional[str] = None   # "HH:MM" — None = sin cambio
    hora_salida_inicio: Optional[str] = None
    hora_cierre_faltas: Optional[str] = None
    motivo: str


class HorarioExcepcionResponse(BaseModel):
    id: str
    nivel: str
    fecha: date
    hora_ingreso_fin:   Optional[str] = None
    hora_salida_inicio: Optional[str] = None
    hora_cierre_faltas: Optional[str] = None
    motivo: str
    created_by: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator(
        "hora_ingreso_fin", "hora_salida_inicio", "hora_cierre_faltas",
        mode="before",
    )
    @classmethod
    def norm(cls, v: Any) -> Optional[str]:
        return _td_to_str(v) if v is not None else None

    @field_validator("created_at", mode="before")
    @classmethod
    def fmt_ts(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


class ObservacionCreate(BaseModel):
    estudiante_id: str
    tipo: str           # academica | conductual | salud | logro | otro
    descripcion: str
    enviar_a_apoderado: bool = True


class ObservacionResponse(BaseModel):
    id: str
    tutor_id: str
    estudiante_id: str
    tipo: str
    descripcion: str
    enviar_a_apoderado: bool
    correo_enviado: bool
    created_at: str     # ISO string

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="before")
    @classmethod
    def serializar_fecha(cls, v: Any) -> str:
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


class ReuniónCreate(BaseModel):
    estudiante_ids: List[str]       # uno o varios estudiantes
    todos: bool = False             # True = agendar para todos los alumnos del aula
    titulo: str
    descripcion: Optional[str] = None
    fecha: date
    hora: str           # "HH:MM"
    modalidad: str = "presencial"   # presencial | virtual
    lugar: Optional[str] = None


class ReuniónEstadoUpdate(BaseModel):
    estado: str         # pendiente | confirmada | realizada | cancelada


class ReuniónResponse(BaseModel):
    id: str
    tutor_id: str
    estudiante_id: str
    nombre_estudiante: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    fecha: str
    hora: str
    modalidad: str
    lugar: Optional[str] = None
    estado: str
    notificado_apoderado: bool
    created_at: str

    model_config = {"from_attributes": True}

    @field_validator("fecha", mode="before")
    @classmethod
    def serializar_fecha_reunion(cls, v: Any) -> str:
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)

    @field_validator("hora", mode="before")
    @classmethod
    def serializar_hora(cls, v: Any) -> str:
        return _td_to_str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def serializar_created_at(cls, v: Any) -> str:
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)
