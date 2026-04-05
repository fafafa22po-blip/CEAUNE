from typing import List, Optional

from pydantic import BaseModel, field_validator


class HorarioPeriodo(BaseModel):
    dia_semana:    int            # 1=Lunes … 5=Viernes
    hora_inicio:   str            # "07:30"
    hora_fin:      str            # "08:15"
    curso_nombre:  str
    docente_nombre: Optional[str] = None

    @field_validator("dia_semana")
    @classmethod
    def validar_dia(cls, v: int) -> int:
        if v not in range(1, 6):
            raise ValueError("dia_semana debe estar entre 1 (Lunes) y 5 (Viernes)")
        return v


class HorarioCursoBulk(BaseModel):
    """Payload para cargar/reemplazar el horario completo de un aula."""
    nivel:   str
    grado:   str
    seccion: str
    anio:    int
    periodos: List[HorarioPeriodo]


class HorarioCursoResponse(HorarioPeriodo):
    id:      str
    nivel:   str
    grado:   str
    seccion: str
    anio:    int

    model_config = {"from_attributes": True}
