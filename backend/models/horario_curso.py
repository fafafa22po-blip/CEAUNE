import uuid

from sqlalchemy import Column, Enum, Index, Integer, String, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class HorarioCurso(Base):
    """Horario semanal de clases por aula (nivel + grado + sección + año)."""
    __tablename__ = "horarios_curso"

    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nivel         = Column(Enum("inicial", "primaria", "secundaria"), nullable=False)
    grado         = Column(String(5),   nullable=False)
    seccion       = Column(String(5),   nullable=False)
    anio          = Column(Integer,     nullable=False)
    dia_semana    = Column(Integer,     nullable=False)   # 1=Lunes … 5=Viernes
    hora_inicio   = Column(String(5),   nullable=False)   # "07:30"
    hora_fin      = Column(String(5),   nullable=False)   # "08:15"
    curso_nombre  = Column(String(100), nullable=False)
    docente_nombre= Column(String(200), nullable=True)
    created_at    = Column(TIMESTAMP,   server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "nivel", "grado", "seccion", "anio", "dia_semana", "hora_inicio",
            name="uq_horario_periodo",
        ),
        Index("idx_horario_aula", "nivel", "grado", "seccion", "anio"),
    )
