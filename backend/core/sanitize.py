import re
from typing import Annotated, Optional

from pydantic import BeforeValidator


def _limpiar(v):
    if not isinstance(v, str):
        return v
    # Eliminar tags HTML
    v = re.sub(r'<[^>]+>', '', v)
    # Eliminar caracteres de control (no printables excepto \n y \t)
    v = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', v)
    return v.strip()


def _limpiar_opcional(v):
    return _limpiar(v) if v else v


# Tipos listos para usar en schemas Pydantic v2
TextoLimpio = Annotated[str, BeforeValidator(_limpiar)]
TextoLimpioOpcional = Annotated[Optional[str], BeforeValidator(_limpiar_opcional)]
