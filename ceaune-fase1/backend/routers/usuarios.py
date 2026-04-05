from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from database import get_db
from core.dependencies import require_roles
from models.usuario import Usuario
from models.estudiante import Estudiante, ApoderadoEstudiante
from schemas.estudiante import ApoderadoConHijos, EstudianteResumen

router = APIRouter()


@router.get("/apoderados", response_model=list[ApoderadoConHijos])
def listar_apoderados(
    search: Optional[str] = Query(None, description="Buscar por nombre, apellido o DNI"),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "auxiliar")),
):
    q = db.query(Usuario).filter(Usuario.rol == "apoderado", Usuario.activo == True)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Usuario.nombre.ilike(term),
                Usuario.apellido.ilike(term),
                Usuario.dni.ilike(term),
            )
        )
    apoderados = q.order_by(Usuario.apellido, Usuario.nombre).all()

    result = []
    for apoderado in apoderados:
        rels = db.query(ApoderadoEstudiante).filter(
            ApoderadoEstudiante.apoderado_id == apoderado.id
        ).all()
        hijos = []
        for rel in rels:
            e = db.query(Estudiante).filter(
                Estudiante.id == rel.estudiante_id,
                Estudiante.activo == True,
            ).first()
            if e:
                hijos.append(EstudianteResumen.model_validate(e))
        result.append(ApoderadoConHijos(
            id=apoderado.id,
            dni=apoderado.dni,
            nombre=apoderado.nombre,
            apellido=apoderado.apellido,
            email=apoderado.email,
            telefono=apoderado.telefono,
            activo=apoderado.activo,
            hijos=hijos,
        ))
    return result
