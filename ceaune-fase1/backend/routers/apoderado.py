from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date

from database import get_db
from core.dependencies import require_roles
from models.estudiante import Estudiante, ApoderadoEstudiante
from models.asistencia import Asistencia
from schemas.estudiante import EstudianteResumen
from schemas.asistencia import AsistenciaOut

router = APIRouter()


def _verificar_hijo(db: Session, apoderado_id: str, estudiante_id: str) -> Estudiante:
    """Verifica que el estudiante pertenece al apoderado. Lanza 403 si no."""
    rel = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == apoderado_id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not rel:
        raise HTTPException(status_code=403, detail="No tienes acceso a este estudiante")
    e = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    return e


def _build_out(a: Asistencia, e: Estudiante) -> AsistenciaOut:
    return AsistenciaOut(
        id=a.id,
        estudiante_id=a.estudiante_id,
        estudiante_nombre=e.nombre,
        estudiante_apellido=e.apellido,
        estudiante_grado=e.grado,
        estudiante_seccion=e.seccion,
        auxiliar_id=a.auxiliar_id,
        fecha=a.fecha,
        tipo=a.tipo,
        hora=a.hora,
        estado=a.estado,
        observacion=a.observacion,
        correo_enviado=a.correo_enviado,
        correo_enviado_at=a.correo_enviado_at,
    )


# ─── GET /apoderado/mis-hijos ─────────────────────────────────────────────────

@router.get("/mis-hijos", response_model=list[EstudianteResumen])
def mis_hijos(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    relaciones = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id
    ).all()

    estudiantes = []
    for rel in relaciones:
        e = db.query(Estudiante).filter(
            Estudiante.id == rel.estudiante_id,
            Estudiante.activo == True,
        ).first()
        if e:
            estudiantes.append(e)

    return estudiantes


# ─── GET /apoderado/hijo/{id}/asistencias ────────────────────────────────────

@router.get("/hijo/{estudiante_id}/asistencias", response_model=list[AsistenciaOut])
def asistencias_hijo(
    estudiante_id: str,
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None, ge=2020),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    e = _verificar_hijo(db, current_user.id, estudiante_id)

    hoy  = date.today()
    mes  = mes  or hoy.month
    anio = anio or hoy.year

    registros = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            func.month(Asistencia.fecha) == mes,
            func.year(Asistencia.fecha)  == anio,
        )
        .order_by(Asistencia.fecha.desc(), Asistencia.hora.desc())
        .all()
    )

    return [_build_out(r, e) for r in registros]


# ─── GET /apoderado/hijo/{id}/resumen-mes ────────────────────────────────────

@router.get("/hijo/{estudiante_id}/resumen-mes")
def resumen_mes_hijo(
    estudiante_id: str,
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None, ge=2020),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    e = _verificar_hijo(db, current_user.id, estudiante_id)

    hoy  = date.today()
    mes  = mes  or hoy.month
    anio = anio or hoy.year

    registros = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            func.month(Asistencia.fecha) == mes,
            func.year(Asistencia.fecha)  == anio,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial", "falta"]),
        )
        .all()
    )

    puntuales  = sum(1 for r in registros if r.estado == "puntual")
    tardanzas  = sum(1 for r in registros if r.estado == "tardanza")
    faltas     = sum(1 for r in registros if r.estado == "falta")
    dias_total = puntuales + tardanzas + faltas
    pct        = round((puntuales + tardanzas) / dias_total * 100) if dias_total else 0

    return {
        "mes": mes,
        "anio": anio,
        "dias_registrados": dias_total,
        "puntuales": puntuales,
        "tardanzas": tardanzas,
        "faltas": faltas,
        "porcentaje_asistencia": pct,
    }
