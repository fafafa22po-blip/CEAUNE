"""
Utilidades de timezone para CEAUNE.
Siempre usar estas funciones en lugar de datetime.now() / date.today()
para garantizar que se usa la hora de Lima (America/Lima, UTC-5).
"""

from datetime import datetime, date
from zoneinfo import ZoneInfo

LIMA = ZoneInfo("America/Lima")


def ahora() -> datetime:
    """datetime actual en hora Lima, sin info de zona (compatible con MySQL)."""
    return datetime.now(LIMA).replace(tzinfo=None)


def hoy() -> date:
    """date actual en hora Lima."""
    return datetime.now(LIMA).date()
