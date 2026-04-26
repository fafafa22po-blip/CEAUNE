import uuid
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, HTTPException, Query,
    UploadFile, status,
)
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from models.comunicado import (
    Comunicado, ComunicadoDestinatario, ComunicadoRespuesta,
)
from models.estudiante import Estudiante
from models.usuario import Usuario
from schemas.comunicado import (
    BandejaPendientesResponse, BandejaRespuestasResponse, ComunicadoResponse,
    ComunicarRequest, DestinatarioResponse, PendienteItem,
    RespuestaInboxItem, RespuestaResponse,
)
from schemas.estudiante import EstudianteBasico

router = APIRouter()

ROLES_AUXILIAR = {"i-auxiliar", "p-auxiliar", "s-auxiliar", "admin", "directivo"}


# ---------------------------------------------------------------------------
# POST /comunicados/subir-adjunto
# ---------------------------------------------------------------------------

@router.post("/subir-adjunto")
async def subir_adjunto(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    """Sube un archivo a Google Drive y retorna la URL."""
    if current_user.rol not in ROLES_AUXILIAR and current_user.rol != "apoderado":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    contenido = await archivo.read()
    mime = archivo.content_type or "application/octet-stream"

    try:
        from services.drive_service import subir_archivo
        resultado = subir_archivo(contenido, archivo.filename, mime)
        return resultado
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


# ---------------------------------------------------------------------------
# POST /comunicados/enviar
# ---------------------------------------------------------------------------

@router.post("/enviar", response_model=ComunicadoResponse, status_code=201)
def enviar(
    data: ComunicarRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo los auxiliares pueden enviar comunicados")

    # Resolver lista de estudiantes destinatarios
    estudiantes = _resolver_destinatarios(data, current_user, db)
    if not estudiantes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No se encontraron destinatarios")

    batch_id = str(uuid.uuid4())

    comunicado = Comunicado(
        auxiliar_id=current_user.id,
        batch_id=batch_id,
        asunto=data.asunto,
        mensaje=data.mensaje,
        adjunto_nombre=data.adjunto_nombre,
        adjunto_drive_url=data.adjunto_drive_url,
        tipo_envio=data.tipo_envio,
    )
    db.add(comunicado)
    db.flush()  # para tener comunicado.id

    for est in estudiantes:
        db.add(ComunicadoDestinatario(
            comunicado_id=comunicado.id,
            estudiante_id=est.id,
            correo_enviado=False,
            leido_apoderado=False,
        ))

    db.commit()
    db.refresh(comunicado)

    # Notificar por correo y push en background
    try:
        from services.gmail_service import notificar_comunicado_bg
        notificar_comunicado_bg(comunicado.id)
    except Exception:
        pass
    try:
        from services.firebase_service import push_comunicado_bg
        push_comunicado_bg(comunicado.id)
    except Exception:
        pass

    total = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == comunicado.id
    ).count()

    return _enrich(comunicado, total, 0)


def _resolver_destinatarios(data: ComunicarRequest, user: Usuario, db: Session):
    """Devuelve lista de Estudiante según el tipo de envío."""
    q = db.query(Estudiante).filter(Estudiante.activo == True)

    # Restringir por nivel según rol:
    #   auxiliar → nivel fijo por rol
    #   directivo con nivel específico → solo su nivel
    #   directivo general (todos/formacion) → sin restricción
    #   admin → sin restricción
    nivel_forzado = None
    if user.rol == "directivo":
        if user.nivel in ("inicial", "primaria", "secundaria"):
            nivel_forzado = user.nivel
    elif user.rol != "admin":
        from routers.asistencia import NIVEL_POR_ROL
        nivel_forzado = NIVEL_POR_ROL.get(user.rol)

    if data.tipo_envio == "individual":
        if not data.estudiantes_ids:
            return []
        q = q.filter(Estudiante.id.in_(data.estudiantes_ids))
        if nivel_forzado:
            q = q.filter(Estudiante.nivel == nivel_forzado)

    elif data.tipo_envio == "aula":
        if nivel_forzado:
            q = q.filter(Estudiante.nivel == nivel_forzado)
        elif data.nivel:
            q = q.filter(Estudiante.nivel == data.nivel)
        if data.grado:
            q = q.filter(Estudiante.grado == data.grado)
        if data.seccion:
            q = q.filter(Estudiante.seccion == data.seccion)

    elif data.tipo_envio == "masivo":
        if nivel_forzado:
            q = q.filter(Estudiante.nivel == nivel_forzado)
        elif data.niveles:
            q = q.filter(Estudiante.nivel.in_(data.niveles))

    return q.all()


def _enrich(c: Comunicado, total: int, leidos: int) -> ComunicadoResponse:
    r = ComunicadoResponse.model_validate(c)
    r.total_destinatarios = total
    r.leidos = leidos
    return r


# ---------------------------------------------------------------------------
# GET /comunicados/bandeja
# ---------------------------------------------------------------------------

@router.get("/bandeja", response_model=List[ComunicadoResponse])
def bandeja(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    # Obtener IDs únicos por batch (un comunicado = un batch)
    offset = (pagina - 1) * por_pagina
    comunicados = (
        db.query(Comunicado)
        .filter(Comunicado.auxiliar_id == current_user.id)
        .order_by(Comunicado.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    result = []
    for c in comunicados:
        total = db.query(ComunicadoDestinatario).filter(
            ComunicadoDestinatario.comunicado_id == c.id
        ).count()
        leidos = db.query(ComunicadoDestinatario).filter(
            ComunicadoDestinatario.comunicado_id == c.id,
            ComunicadoDestinatario.leido_apoderado == True,
        ).count()
        result.append(_enrich(c, total, leidos))

    return result


# ---------------------------------------------------------------------------
# GET /comunicados/respuestas  — inbox plano de respuestas recibidas
# ---------------------------------------------------------------------------

@router.get("/respuestas", response_model=BandejaRespuestasResponse)
def bandeja_respuestas(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    solo_no_leidas: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Devuelve todas las respuestas de apoderados recibidas por el auxiliar,
    una por fila, ordenadas por fecha descendente."""
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    # Siempre calculamos el total de no leídas (para el badge)
    no_leidas = (
        db.query(ComunicadoRespuesta)
        .join(ComunicadoDestinatario,
              ComunicadoRespuesta.destinatario_id == ComunicadoDestinatario.id)
        .join(Comunicado,
              ComunicadoDestinatario.comunicado_id == Comunicado.id)
        .filter(
            Comunicado.auxiliar_id == current_user.id,
            ComunicadoRespuesta.leido_auxiliar == False,
        )
        .count()
    )

    q = (
        db.query(ComunicadoRespuesta, ComunicadoDestinatario, Comunicado)
        .join(ComunicadoDestinatario,
              ComunicadoRespuesta.destinatario_id == ComunicadoDestinatario.id)
        .join(Comunicado,
              ComunicadoDestinatario.comunicado_id == Comunicado.id)
        .filter(Comunicado.auxiliar_id == current_user.id)
    )

    if solo_no_leidas:
        q = q.filter(ComunicadoRespuesta.leido_auxiliar == False)

    total = q.count()
    offset = (pagina - 1) * por_pagina
    rows = (
        q.order_by(ComunicadoRespuesta.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    items = []
    for resp, dest, com in rows:
        est = db.query(Estudiante).filter(Estudiante.id == dest.estudiante_id).first()
        if not est:
            continue
        items.append(RespuestaInboxItem(
            id=resp.id,
            dest_id=dest.id,
            comunicado_id=com.id,
            asunto=com.asunto,
            mensaje_comunicado=com.mensaje,
            adjunto_comunicado_nombre=com.adjunto_nombre,
            adjunto_comunicado_url=com.adjunto_drive_url,
            mensaje=resp.mensaje,
            adjunto_nombre=resp.adjunto_nombre,
            adjunto_drive_url=resp.adjunto_drive_url,
            leido_auxiliar=resp.leido_auxiliar,
            leido_auxiliar_at=resp.leido_auxiliar_at,
            created_at=resp.created_at,
            estudiante=EstudianteBasico.model_validate(est),
        ))

    return BandejaRespuestasResponse(items=items, total=total, no_leidas=no_leidas)


# ---------------------------------------------------------------------------
# GET /comunicados/pendientes  — destinatarios que no han respondido
# ---------------------------------------------------------------------------

@router.get("/pendientes", response_model=BandejaPendientesResponse)
def bandeja_pendientes(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Destinatarios que recibieron un comunicado del auxiliar pero aún no han respondido."""
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    from sqlalchemy import exists

    # Subquery: dest_ids que tienen al menos una respuesta
    respondido = (
        db.query(ComunicadoRespuesta.destinatario_id)
        .distinct()
        .subquery()
    )

    q = (
        db.query(ComunicadoDestinatario, Comunicado)
        .join(Comunicado, ComunicadoDestinatario.comunicado_id == Comunicado.id)
        .filter(
            Comunicado.auxiliar_id == current_user.id,
            ComunicadoDestinatario.id.notin_(respondido),
        )
    )

    total = q.count()
    offset = (pagina - 1) * por_pagina
    rows = (
        q.order_by(Comunicado.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    items = []
    for dest, com in rows:
        est = db.query(Estudiante).filter(Estudiante.id == dest.estudiante_id).first()
        if not est:
            continue
        items.append(PendienteItem(
            dest_id=dest.id,
            comunicado_id=com.id,
            asunto=com.asunto,
            mensaje_comunicado=com.mensaje,
            created_at=com.created_at,
            leido_apoderado=dest.leido_apoderado,
            leido_apoderado_at=dest.leido_apoderado_at,
            estudiante=EstudianteBasico.model_validate(est),
        ))

    return BandejaPendientesResponse(items=items, total=total)


# ---------------------------------------------------------------------------
# GET /comunicados/{id}
# ---------------------------------------------------------------------------

@router.get("/{comunicado_id}", response_model=ComunicadoResponse)
def detalle(
    comunicado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    c = db.query(Comunicado).filter(Comunicado.id == comunicado_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    total = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id
    ).count()
    leidos = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id,
        ComunicadoDestinatario.leido_apoderado == True,
    ).count()
    return _enrich(c, total, leidos)


# ---------------------------------------------------------------------------
# GET /comunicados/{id}/destinatarios
# ---------------------------------------------------------------------------

@router.get("/{comunicado_id}/destinatarios", response_model=List[DestinatarioResponse])
def destinatarios(
    comunicado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    c = db.query(Comunicado).filter(Comunicado.id == comunicado_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    dests = (
        db.query(ComunicadoDestinatario)
        .filter(ComunicadoDestinatario.comunicado_id == comunicado_id)
        .all()
    )

    result = []
    for d in dests:
        est = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
        respuestas = (
            db.query(ComunicadoRespuesta)
            .filter(ComunicadoRespuesta.destinatario_id == d.id)
            .order_by(ComunicadoRespuesta.created_at.asc())
            .all()
        )
        result.append(DestinatarioResponse(
            id=d.id,
            estudiante=EstudianteBasico.model_validate(est),
            leido_apoderado=d.leido_apoderado,
            leido_apoderado_at=d.leido_apoderado_at,
            correo_enviado=d.correo_enviado,
            respuestas=[RespuestaResponse.model_validate(r) for r in respuestas],
        ))

    return result


# ---------------------------------------------------------------------------
# PUT /comunicados/destinatarios/{dest_id}/marcar-leido  (auxiliar)
# ---------------------------------------------------------------------------

@router.put("/destinatarios/{dest_id}/marcar-leido", status_code=204)
def marcar_leido_auxiliar(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Marca la respuesta del apoderado como leída por el auxiliar."""
    from datetime import datetime
    respuestas = (
        db.query(ComunicadoRespuesta)
        .filter(
            ComunicadoRespuesta.destinatario_id == dest_id,
            ComunicadoRespuesta.leido_auxiliar == False,
        )
        .all()
    )
    for r in respuestas:
        r.leido_auxiliar = True
        r.leido_auxiliar_at = datetime.now()
    db.commit()
