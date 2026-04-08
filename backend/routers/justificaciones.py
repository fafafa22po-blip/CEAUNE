from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from models.asistencia import Asistencia
from models.estudiante import Estudiante, ApoderadoEstudiante
from models.justificacion import Justificacion
from models.usuario import Usuario
from schemas.asistencia import AsistenciaResponse
from schemas.estudiante import EstudianteBasico
from schemas.justificacion import JustificacionResponse, RevisionRequest

router = APIRouter()

ROLES_REVISOR = {"i-auxiliar", "p-auxiliar", "s-auxiliar", "admin"}


def _enrich(j: Justificacion, db: Session) -> JustificacionResponse:
    """Enriquece una justificación con datos de asistencia y estudiante."""
    r = JustificacionResponse.model_validate(j)
    asistencia = db.query(Asistencia).filter(Asistencia.id == j.asistencia_id).first()
    if asistencia:
        r.asistencia = AsistenciaResponse.model_validate(asistencia)
        est = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
        if est:
            r.estudiante = EstudianteBasico.model_validate(est)
    return r


# ---------------------------------------------------------------------------
# POST /justificaciones/
# ---------------------------------------------------------------------------

@router.post("/", response_model=JustificacionResponse, status_code=201)
async def crear(
    asistencia_id: str = Form(...),
    motivo: str = Form(...),
    adjunto: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol != "apoderado":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo los apoderados pueden enviar justificaciones")

    # Verificar que la asistencia existe y es una falta o tardanza
    asistencia = db.query(Asistencia).filter(Asistencia.id == asistencia_id).first()
    if not asistencia:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro de asistencia no encontrado")
    if asistencia.estado not in ("falta", "tardanza"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Solo se pueden justificar faltas y tardanzas")

    # Verificar que el apoderado tiene relación con el estudiante
    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id,
        ApoderadoEstudiante.estudiante_id == asistencia.estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes relación con este estudiante")

    # Verificar que no haya justificación pendiente/aprobada para esta asistencia
    existente = db.query(Justificacion).filter(
        Justificacion.asistencia_id == asistencia_id,
        Justificacion.estado.in_(["pendiente", "aprobada"]),
    ).first()
    if existente:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una justificación para esta falta")

    # Subir adjunto a Google Drive si se proporcionó
    adjunto_nombre = None
    adjunto_drive_url = None
    if adjunto and adjunto.filename:
        contenido = await adjunto.read()
        mime = adjunto.content_type or "application/octet-stream"
        try:
            from services.drive_service import subir_archivo
            resultado = subir_archivo(contenido, adjunto.filename, mime)
            adjunto_nombre = resultado["nombre"]
            adjunto_drive_url = resultado["url"]
        except ValueError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
        except RuntimeError as e:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))

    just = Justificacion(
        asistencia_id=asistencia_id,
        apoderado_id=current_user.id,
        motivo=motivo,
        adjunto_nombre=adjunto_nombre,
        adjunto_drive_url=adjunto_drive_url,
        estado="pendiente",
    )
    db.add(just)
    db.commit()
    db.refresh(just)
    return _enrich(just, db)


# ---------------------------------------------------------------------------
# POST /justificaciones/por-fecha  (apoderado — cuando no hay registro previo)
# ---------------------------------------------------------------------------

@router.post("/por-fecha", response_model=JustificacionResponse, status_code=201)
async def crear_por_fecha(
    estudiante_id: str = Form(...),
    fecha: date = Form(...),
    motivo: str = Form(...),
    adjunto: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Justifica una falta por fecha.
    Si no existe un registro de asistencia para ese día, lo crea con estado='falta'.
    """
    from datetime import date as date_class

    if current_user.rol != "apoderado":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo los apoderados pueden enviar justificaciones")

    if fecha > date_class.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No puedes justificar fechas futuras")

    # Verificar vínculo apoderado-estudiante
    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes relación con este estudiante")

    # Buscar si ya existe un registro de ingreso para esa fecha
    asistencia = db.query(Asistencia).filter(
        Asistencia.estudiante_id == estudiante_id,
        Asistencia.fecha == fecha,
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
    ).first()

    if asistencia:
        if asistencia.estado not in ("falta", "tardanza"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"El estudiante sí asistió ese día ({asistencia.estado})",
            )
    else:
        # Crear el registro de falta
        asistencia = Asistencia(
            estudiante_id=estudiante_id,
            auxiliar_id=None,
            fecha=fecha,
            tipo="ingreso",
            hora=datetime(fecha.year, fecha.month, fecha.day, 0, 0, 0),
            estado="falta",
            correo_enviado=False,
        )
        db.add(asistencia)
        db.flush()

    # Verificar que no haya justificación pendiente/aprobada para esta asistencia
    existente = db.query(Justificacion).filter(
        Justificacion.asistencia_id == asistencia.id,
        Justificacion.estado.in_(["pendiente", "aprobada"]),
    ).first()
    if existente:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una justificación para esta falta")

    # Subir adjunto a Google Drive si se proporcionó
    adjunto_nombre = None
    adjunto_drive_url = None
    if adjunto and adjunto.filename:
        contenido = await adjunto.read()
        mime = adjunto.content_type or "application/octet-stream"
        try:
            from services.drive_service import subir_archivo
            resultado = subir_archivo(contenido, adjunto.filename, mime)
            adjunto_nombre = resultado["nombre"]
            adjunto_drive_url = resultado["url"]
        except ValueError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
        except RuntimeError as e:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))

    just = Justificacion(
        asistencia_id=asistencia.id,
        apoderado_id=current_user.id,
        motivo=motivo,
        adjunto_nombre=adjunto_nombre,
        adjunto_drive_url=adjunto_drive_url,
        estado="pendiente",
    )
    db.add(just)
    db.commit()
    db.refresh(just)
    return _enrich(just, db)


# ---------------------------------------------------------------------------
# GET /justificaciones/pendientes  (auxiliar)
# ---------------------------------------------------------------------------

@router.get("/pendientes", response_model=List[JustificacionResponse])
def pendientes(
    estado: Optional[str] = Query("pendiente"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_REVISOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    offset = (pagina - 1) * por_pagina

    # Filtrar por nivel del auxiliar
    q = (
        db.query(Justificacion)
        .join(Asistencia, Asistencia.id == Justificacion.asistencia_id)
        .join(Estudiante, Estudiante.id == Asistencia.estudiante_id)
        .filter(Justificacion.estado == estado)
    )

    if current_user.rol != "admin":
        from routers.asistencia import NIVEL_POR_ROL
        nivel = NIVEL_POR_ROL.get(current_user.rol)
        if nivel:
            q = q.filter(Estudiante.nivel == nivel)

    justificaciones = (
        q.order_by(Justificacion.created_at.asc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    return [_enrich(j, db) for j in justificaciones]


# ---------------------------------------------------------------------------
# GET /justificaciones/   (todas, con filtros)
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[JustificacionResponse])
def listar(
    estado: Optional[str] = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_REVISOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    offset = (pagina - 1) * por_pagina
    q = (
        db.query(Justificacion)
        .join(Asistencia, Asistencia.id == Justificacion.asistencia_id)
        .join(Estudiante, Estudiante.id == Asistencia.estudiante_id)
    )

    if current_user.rol != "admin":
        from routers.asistencia import NIVEL_POR_ROL
        nivel = NIVEL_POR_ROL.get(current_user.rol)
        if nivel:
            q = q.filter(Estudiante.nivel == nivel)

    if estado:
        q = q.filter(Justificacion.estado == estado)

    justificaciones = (
        q.order_by(Justificacion.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )
    return [_enrich(j, db) for j in justificaciones]


# ---------------------------------------------------------------------------
# PUT /justificaciones/{id}/aprobar
# ---------------------------------------------------------------------------

@router.put("/{justificacion_id}/aprobar", response_model=JustificacionResponse)
def aprobar(
    justificacion_id: str,
    data: RevisionRequest = RevisionRequest(),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_REVISOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    just = db.query(Justificacion).filter(Justificacion.id == justificacion_id).first()
    if not just:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Justificación no encontrada")
    if just.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya fue {just.estado}")

    just.estado = "aprobada"
    just.revisado_por = current_user.id
    just.revisado_at = datetime.now()
    just.observacion_revision = data.observacion
    db.commit()
    db.refresh(just)
    return _enrich(just, db)


# ---------------------------------------------------------------------------
# PUT /justificaciones/{id}/rechazar
# ---------------------------------------------------------------------------

@router.put("/{justificacion_id}/rechazar", response_model=JustificacionResponse)
def rechazar(
    justificacion_id: str,
    data: RevisionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_REVISOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    if not data.observacion:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El motivo de rechazo es obligatorio",
        )

    just = db.query(Justificacion).filter(Justificacion.id == justificacion_id).first()
    if not just:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Justificación no encontrada")
    if just.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya fue {just.estado}")

    just.estado = "rechazada"
    just.revisado_por = current_user.id
    just.revisado_at = datetime.now()
    just.observacion_revision = data.observacion
    db.commit()
    db.refresh(just)
    return _enrich(just, db)
