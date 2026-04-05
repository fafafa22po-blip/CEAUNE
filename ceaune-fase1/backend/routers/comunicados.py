from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from database import get_db
from core.dependencies import require_roles
from core.config import settings
from models.comunicado import Comunicado, ComunicadoDestinatario, ComunicadoRespuesta
from models.estudiante import Estudiante, ApoderadoEstudiante
from models.usuario import Usuario
from schemas.comunicado import (
    ComunicadoEnviar, ComunicadoEnviado,
    ComunicadoOut, ComunicadoDetalle,
    DestinatarioOut, RespuestaOut,
    ComunicadoApoderadoOut, RespuestaCreate,
)

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_out(c: Comunicado, db: Session) -> ComunicadoOut:
    dests = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id
    ).all()
    leidos = sum(1 for d in dests if d.leido_apoderado)
    resp_sin_leer = sum(
        db.query(ComunicadoRespuesta).filter(
            ComunicadoRespuesta.destinatario_id == d.id,
            ComunicadoRespuesta.leido_auxiliar == False,
        ).count()
        for d in dests
    )
    return ComunicadoOut(
        id=c.id, batch_id=c.batch_id, auxiliar_id=c.auxiliar_id,
        asunto=c.asunto, tipo_envio=c.tipo_envio, created_at=c.created_at,
        total_destinatarios=len(dests), leidos=leidos, respuestas_sin_leer=resp_sin_leer,
    )


def _build_destinatario(d: ComunicadoDestinatario, db: Session) -> DestinatarioOut:
    e = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
    tiene = db.query(ComunicadoRespuesta).filter(
        ComunicadoRespuesta.destinatario_id == d.id
    ).count() > 0
    return DestinatarioOut(
        id=d.id, estudiante_id=d.estudiante_id,
        estudiante_nombre=e.nombre if e else "—",
        estudiante_apellido=e.apellido if e else "—",
        estudiante_grado=e.grado if e else "—",
        estudiante_seccion=e.seccion if e else "—",
        leido_apoderado=d.leido_apoderado, leido_apoderado_at=d.leido_apoderado_at,
        correo_enviado=d.correo_enviado, correo_enviado_at=d.correo_enviado_at,
        tiene_respuesta=tiene,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# RUTAS AUXILIAR / ADMIN  (rutas específicas ANTES que las de parámetro)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/enviar", response_model=ComunicadoEnviado, status_code=201)
def enviar(
    data: ComunicadoEnviar,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    estudiantes: list[Estudiante] = []

    if data.tipo_envio == "individual":
        if not data.estudiante_ids:
            raise HTTPException(400, "Debe seleccionar al menos un estudiante")
        for eid in data.estudiante_ids:
            e = db.query(Estudiante).filter(Estudiante.id == eid, Estudiante.activo == True).first()
            if e:
                estudiantes.append(e)

    elif data.tipo_envio == "aula":
        if not data.grado or not data.seccion:
            raise HTTPException(400, "Debe indicar grado y sección")
        estudiantes = db.query(Estudiante).filter(
            Estudiante.grado == data.grado,
            Estudiante.seccion == data.seccion,
            Estudiante.activo == True,
        ).all()

    elif data.tipo_envio == "masivo":
        if not data.aulas:
            raise HTTPException(400, "Debe seleccionar al menos un aula")
        seen = set()
        for aula in data.aulas:
            for e in db.query(Estudiante).filter(
                Estudiante.grado == aula.grado,
                Estudiante.seccion == aula.seccion,
                Estudiante.activo == True,
            ).all():
                if e.id not in seen:
                    estudiantes.append(e)
                    seen.add(e.id)

    if not estudiantes:
        raise HTTPException(400, "No se encontraron alumnos para los destinatarios seleccionados")

    batch_id = str(uuid.uuid4())
    comunicado = Comunicado(
        id=str(uuid.uuid4()), auxiliar_id=current_user.id, batch_id=batch_id,
        asunto=data.asunto, mensaje=data.mensaje,
        adjunto_nombre=data.adjunto_nombre, adjunto_drive_url=data.adjunto_drive_url,
        tipo_envio=data.tipo_envio,
    )
    db.add(comunicado)
    db.flush()

    dest_pairs: list[tuple] = []
    for e in estudiantes:
        d = ComunicadoDestinatario(
            id=str(uuid.uuid4()), comunicado_id=comunicado.id, estudiante_id=e.id,
        )
        db.add(d)
        dest_pairs.append((d, e))
    db.flush()

    from services.gmail_service import enviar_notificacion_comunicado
    emails_enviados: set = set()
    correos_ok = 0

    for dest, estudiante in dest_pairs:
        for rel in db.query(ApoderadoEstudiante).filter(
            ApoderadoEstudiante.estudiante_id == estudiante.id
        ).all():
            apoderado = db.query(Usuario).filter(Usuario.id == rel.apoderado_id).first()
            if not apoderado or not apoderado.email:
                continue
            if apoderado.email in emails_enviados:
                dest.correo_enviado = True
                dest.correo_enviado_at = datetime.now()
                continue
            ok = enviar_notificacion_comunicado(
                destinatario=apoderado.email,
                nombre_apoderado=f"{apoderado.nombre} {apoderado.apellido}",
                asunto=data.asunto,
                frontend_url=settings.FRONTEND_URL,
            )
            if ok:
                emails_enviados.add(apoderado.email)
                correos_ok += 1
                dest.correo_enviado = True
                dest.correo_enviado_at = datetime.now()

    db.commit()
    return ComunicadoEnviado(
        batch_id=batch_id,
        total_destinatarios=len(estudiantes),
        correos_enviados=correos_ok,
    )


@router.get("/bandeja", response_model=list[ComunicadoOut])
def bandeja(
    skip:  int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    q = db.query(Comunicado)
    if current_user.rol == "auxiliar":
        q = q.filter(Comunicado.auxiliar_id == current_user.id)
    return [_build_out(c, db) for c in q.order_by(Comunicado.created_at.desc()).offset(skip).limit(limit).all()]


# ═══════════════════════════════════════════════════════════════════════════════
# RUTAS APODERADO  (específicas, antes de /{comunicado_id})
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/apoderado/lista", response_model=list[ComunicadoApoderadoOut])
def lista_apoderado(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    relaciones = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id
    ).all()
    hijo_ids = {r.estudiante_id for r in relaciones}
    if not hijo_ids:
        return []

    result = []
    for d in db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.estudiante_id.in_(hijo_ids)
    ).all():
        c = db.query(Comunicado).filter(Comunicado.id == d.comunicado_id).first()
        e = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
        if not c or not e:
            continue
        tiene_resp = db.query(ComunicadoRespuesta).filter(
            ComunicadoRespuesta.destinatario_id == d.id
        ).count() > 0
        result.append(ComunicadoApoderadoOut(
            destinatario_id=d.id, comunicado_id=c.id,
            asunto=c.asunto, mensaje=c.mensaje,
            adjunto_nombre=c.adjunto_nombre, adjunto_drive_url=c.adjunto_drive_url,
            tipo_envio=c.tipo_envio, created_at=c.created_at,
            leido_apoderado=d.leido_apoderado, leido_apoderado_at=d.leido_apoderado_at,
            estudiante_nombre=e.nombre, estudiante_apellido=e.apellido,
            tiene_respuesta_mia=tiene_resp,
        ))

    result.sort(key=lambda x: x.created_at, reverse=True)
    return result


@router.post("/apoderado/{destinatario_id}/responder", status_code=201)
def responder_apoderado(
    destinatario_id: str,
    data: RespuestaCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    d = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.id == destinatario_id
    ).first()
    if not d:
        raise HTTPException(404, "Comunicado no encontrado")
    if not db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id,
        ApoderadoEstudiante.estudiante_id == d.estudiante_id,
    ).first():
        raise HTTPException(403, "No tienes acceso a este comunicado")

    db.add(ComunicadoRespuesta(
        id=str(uuid.uuid4()), destinatario_id=destinatario_id,
        mensaje=data.mensaje, adjunto_nombre=data.adjunto_nombre,
        adjunto_drive_url=data.adjunto_drive_url,
    ))
    db.commit()
    return {"ok": True}


@router.get("/apoderado/{destinatario_id}", response_model=ComunicadoApoderadoOut)
def leer_apoderado(
    destinatario_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("apoderado")),
):
    d = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.id == destinatario_id
    ).first()
    if not d:
        raise HTTPException(404, "Comunicado no encontrado")
    if not db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == current_user.id,
        ApoderadoEstudiante.estudiante_id == d.estudiante_id,
    ).first():
        raise HTTPException(403, "No tienes acceso a este comunicado")

    if not d.leido_apoderado:
        d.leido_apoderado = True
        d.leido_apoderado_at = datetime.now()
        db.commit()

    c = db.query(Comunicado).filter(Comunicado.id == d.comunicado_id).first()
    e = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
    tiene_resp = db.query(ComunicadoRespuesta).filter(
        ComunicadoRespuesta.destinatario_id == d.id
    ).count() > 0

    return ComunicadoApoderadoOut(
        destinatario_id=d.id, comunicado_id=c.id,
        asunto=c.asunto, mensaje=c.mensaje,
        adjunto_nombre=c.adjunto_nombre, adjunto_drive_url=c.adjunto_drive_url,
        tipo_envio=c.tipo_envio, created_at=c.created_at,
        leido_apoderado=d.leido_apoderado, leido_apoderado_at=d.leido_apoderado_at,
        estudiante_nombre=e.nombre, estudiante_apellido=e.apellido,
        tiene_respuesta_mia=tiene_resp,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# RUTAS CON PARÁMETRO  (al final para no capturar rutas específicas)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{comunicado_id}", response_model=ComunicadoDetalle)
def detalle(
    comunicado_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    c = db.query(Comunicado).filter(Comunicado.id == comunicado_id).first()
    if not c:
        raise HTTPException(404, "Comunicado no encontrado")
    if current_user.rol == "auxiliar" and c.auxiliar_id != current_user.id:
        raise HTTPException(403, "No tienes acceso a este comunicado")

    dests_db = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id
    ).all()

    respuestas = []
    for d in dests_db:
        for r in db.query(ComunicadoRespuesta).filter(
            ComunicadoRespuesta.destinatario_id == d.id
        ).order_by(ComunicadoRespuesta.created_at).all():
            respuestas.append(RespuestaOut(
                id=r.id, destinatario_id=r.destinatario_id,
                mensaje=r.mensaje, adjunto_nombre=r.adjunto_nombre,
                adjunto_drive_url=r.adjunto_drive_url,
                leido_auxiliar=r.leido_auxiliar, leido_auxiliar_at=r.leido_auxiliar_at,
                created_at=r.created_at,
            ))

    return ComunicadoDetalle(
        id=c.id, batch_id=c.batch_id, asunto=c.asunto, mensaje=c.mensaje,
        adjunto_nombre=c.adjunto_nombre, adjunto_drive_url=c.adjunto_drive_url,
        tipo_envio=c.tipo_envio, created_at=c.created_at,
        destinatarios=[_build_destinatario(d, db) for d in dests_db],
        respuestas=respuestas,
    )


@router.patch("/{comunicado_id}/respuestas/{respuesta_id}/leida")
def marcar_respuesta_leida(
    comunicado_id: str,
    respuesta_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    r = db.query(ComunicadoRespuesta).filter(ComunicadoRespuesta.id == respuesta_id).first()
    if not r:
        raise HTTPException(404, "Respuesta no encontrada")
    r.leido_auxiliar = True
    r.leido_auxiliar_at = datetime.now()
    db.commit()
    return {"ok": True}
