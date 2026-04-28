"""
Router del apoderado.
Acceso a asistencias de sus hijos, comunicados, justificaciones y timeline.
"""
from datetime import date, datetime, timedelta
from typing import List, Optional
import calendar as cal_module

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from core.tz import hoy as _hoy
from models.asistencia import Asistencia
from models.comunicado import (
    Comunicado, ComunicadoDestinatario, ComunicadoRespuesta, ObservacionTutor,
)
from models.estudiante import ApoderadoEstudiante, Estudiante
from models.justificacion import Justificacion
from models.libreta import Libreta
from models.usuario import TutorAula, Usuario
from schemas.asistencia import AsistenciaResponse
from schemas.comunicado import DestinatarioResponse, ResponderRequest, RespuestaResponse
from schemas.estudiante import EstudianteBasico
from schemas.justificacion import JustificacionCreate, JustificacionResponse, RevisionRequest

router = APIRouter()


def _verificar_apoderado(current_user: Usuario):
    if current_user.rol != "apoderado" and not current_user.es_apoderado:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo apoderados")


def _mis_hijos(apoderado_id: str, db: Session) -> List[Estudiante]:
    ids = [
        r[0] for r in db.query(ApoderadoEstudiante.estudiante_id)
        .filter(ApoderadoEstudiante.apoderado_id == apoderado_id)
        .all()
    ]
    if not ids:
        return []
    return db.query(Estudiante).filter(Estudiante.id.in_(ids), Estudiante.activo == True).all()


def _verificar_hijo(apoderado_id: str, estudiante_id: str, db: Session) -> Estudiante:
    vinculo = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.apoderado_id == apoderado_id,
        ApoderadoEstudiante.estudiante_id == estudiante_id,
    ).first()
    if not vinculo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes relación con este estudiante")
    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    return est


# Mapa nivel → rol del auxiliar responsable
_NIVEL_ROL_AUX = {
    "inicial":    "i-auxiliar",
    "primaria":   "p-auxiliar",
    "secundaria": "s-auxiliar",
}


# ---------------------------------------------------------------------------
# GET /apoderado/mis-hijos
# ---------------------------------------------------------------------------

@router.get("/mis-hijos", response_model=List[EstudianteBasico])
def mis_hijos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    return _mis_hijos(current_user.id, db)


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/contactos  — tutor de aula + auxiliar del nivel
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/contactos")
def contactos_hijo(
    estudiante_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    est = _verificar_hijo(current_user.id, estudiante_id, db)

    anio_actual = _hoy().year

    # Tutor asignado al aula del estudiante
    tutor_info = None
    aula = db.query(TutorAula).filter(
        TutorAula.nivel   == est.nivel,
        TutorAula.grado   == est.grado,
        TutorAula.seccion == est.seccion,
        TutorAula.anio    == anio_actual,
    ).first()
    if aula:
        tutor = db.query(Usuario).filter(
            Usuario.id     == aula.tutor_id,
            Usuario.activo == True,
        ).first()
        if tutor:
            tutor_info = {
                "nombre":   tutor.nombre,
                "apellido": tutor.apellido,
                "telefono": tutor.telefono,
            }

    # Auxiliar responsable del nivel del estudiante
    aux_info = None
    rol_aux = _NIVEL_ROL_AUX.get(est.nivel)
    if rol_aux:
        auxiliar = db.query(Usuario).filter(
            Usuario.rol    == rol_aux,
            Usuario.activo == True,
        ).first()
        if auxiliar:
            aux_info = {
                "nombre":   auxiliar.nombre,
                "apellido": auxiliar.apellido,
                "telefono": auxiliar.telefono,
            }

    return {"tutor": tutor_info, "auxiliar": aux_info}


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/asistencias
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/asistencias", response_model=List[AsistenciaResponse])
def asistencias_hijo(
    estudiante_id: str,
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    _verificar_hijo(current_user.id, estudiante_id, db)

    q = db.query(Asistencia).filter(Asistencia.estudiante_id == estudiante_id)
    if fecha_inicio:
        q = q.filter(Asistencia.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Asistencia.fecha <= fecha_fin)

    return q.order_by(Asistencia.fecha.desc(), Asistencia.hora.desc()).all()


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/resumen-mes
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/resumen-mes")
def resumen_mes(
    estudiante_id: str,
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    est = _verificar_hijo(current_user.id, estudiante_id, db)

    hoy  = _hoy()
    anio = anio or hoy.year
    mes  = mes  or hoy.month

    from services.asistencia_calc import calcular_resumen_mes
    return calcular_resumen_mes(estudiante_id, est.nivel, est.grado, est.seccion, mes, anio, db)


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/dias-no-laborables
# Fechas no laborables del mes para mostrar en el calendario
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/dias-no-laborables")
def dias_no_laborables_hijo(
    estudiante_id: str,
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    est = _verificar_hijo(current_user.id, estudiante_id, db)

    hoy  = _hoy()
    anio = anio or hoy.year
    mes  = mes  or hoy.month

    inicio = date(anio, mes, 1)
    fin    = date(anio, mes, cal_module.monthrange(anio, mes)[1])

    from models.dia_no_laborable import DiasNoLaborables
    registros = db.query(DiasNoLaborables).filter(
        DiasNoLaborables.fecha >= inicio,
        DiasNoLaborables.fecha <= fin,
    ).all()

    result = []
    for r in registros:
        aplica = False
        if r.nivel == "todos":
            aplica = True
        elif r.nivel == est.nivel:
            if r.grado is None or r.grado == est.grado:
                if r.seccion is None or r.seccion == est.seccion:
                    aplica = True
        if aplica:
            result.append({
                "fecha":  r.fecha.isoformat(),
                "tipo":   r.tipo,
                "motivo": r.motivo,
            })

    return result


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/timeline  — vista unificada cronológica
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/timeline")
def timeline_hijo(
    estudiante_id: str,
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),   # asistencia|comunicado|observacion|justificacion
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    _verificar_hijo(current_user.id, estudiante_id, db)

    hoy = _hoy()
    anio = anio or hoy.year
    mes = mes or hoy.month

    eventos = []

    # Asistencias
    if not tipo or tipo == "asistencia":
        asistencias = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == estudiante_id,
                Asistencia.fecha >= date(anio, mes, 1),
                Asistencia.fecha <= _ultimo_dia(anio, mes),
            )
            .all()
        )
        for a in asistencias:
            eventos.append({
                "tipo": "asistencia",
                "fecha": a.fecha.isoformat(),
                "hora": a.hora.isoformat() if a.hora else None,
                "estado": a.estado,
                "detalle": {"tipo_registro": a.tipo, "observacion": a.observacion},
                "id": a.id,
            })

    # Comunicados (destinatarios de los hijos del apoderado)
    if not tipo or tipo == "comunicado":
        dests = (
            db.query(ComunicadoDestinatario)
            .join(Comunicado, Comunicado.id == ComunicadoDestinatario.comunicado_id)
            .filter(
                ComunicadoDestinatario.estudiante_id == estudiante_id,
                Comunicado.created_at >= datetime(anio, mes, 1),
                Comunicado.created_at <= datetime(_ultimo_dia(anio, mes).year,
                                                  _ultimo_dia(anio, mes).month,
                                                  _ultimo_dia(anio, mes).day, 23, 59, 59),
            )
            .all()
        )
        for d in dests:
            com = db.query(Comunicado).filter(Comunicado.id == d.comunicado_id).first()
            if com:
                eventos.append({
                    "tipo": "comunicado",
                    "fecha": com.created_at.date().isoformat(),
                    "hora": com.created_at.isoformat(),
                    "estado": "leido" if d.leido_apoderado else "no_leido",
                    "detalle": {"asunto": com.asunto, "dest_id": d.id},
                    "id": d.id,
                })

    # Observaciones del tutor
    if not tipo or tipo == "observacion":
        obs_list = (
            db.query(ObservacionTutor)
            .filter(
                ObservacionTutor.estudiante_id == estudiante_id,
                ObservacionTutor.enviar_a_apoderado == True,
                ObservacionTutor.created_at >= datetime(anio, mes, 1),
            )
            .all()
        )
        for obs in obs_list:
            eventos.append({
                "tipo": "observacion",
                "fecha": obs.created_at.date().isoformat(),
                "hora": obs.created_at.isoformat(),
                "estado": obs.tipo,
                "detalle": {"tipo": obs.tipo, "descripcion": obs.descripcion},
                "id": obs.id,
            })

    # Justificaciones
    if not tipo or tipo == "justificacion":
        justs = (
            db.query(Justificacion)
            .join(Asistencia, Asistencia.id == Justificacion.asistencia_id)
            .filter(
                Asistencia.estudiante_id == estudiante_id,
                Justificacion.created_at >= datetime(anio, mes, 1),
            )
            .all()
        )
        for j in justs:
            eventos.append({
                "tipo": "justificacion",
                "fecha": j.created_at.date().isoformat(),
                "hora": j.created_at.isoformat(),
                "estado": j.estado,
                "detalle": {
                    "motivo": j.motivo,
                    "observacion_revision": j.observacion_revision,
                },
                "id": j.id,
            })

    eventos.sort(key=lambda x: x["hora"] or "", reverse=True)
    return eventos


def _ultimo_dia(anio: int, mes: int) -> date:
    import calendar
    ultimo = calendar.monthrange(anio, mes)[1]
    return date(anio, mes, ultimo)


# ---------------------------------------------------------------------------
# GET /apoderado/comunicados
# ---------------------------------------------------------------------------

@router.get("/comunicados")
def mis_comunicados(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)

    hijos = _mis_hijos(current_user.id, db)
    if not hijos:
        return []

    ids_hijos = [h.id for h in hijos]
    offset = (pagina - 1) * por_pagina

    dests = (
        db.query(ComunicadoDestinatario)
        .join(Comunicado, Comunicado.id == ComunicadoDestinatario.comunicado_id)
        .filter(ComunicadoDestinatario.estudiante_id.in_(ids_hijos))
        .order_by(Comunicado.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    result = []
    for d in dests:
        com = db.query(Comunicado).filter(Comunicado.id == d.comunicado_id).first()
        est = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
        if com and est:
            result.append({
                "dest_id": d.id,
                "comunicado_id": com.id,
                "asunto": com.asunto,
                "tipo_envio": com.tipo_envio,
                "adjunto_nombre": com.adjunto_nombre,
                "leido": d.leido_apoderado,
                "created_at": com.created_at.isoformat(),
                "estudiante": EstudianteBasico.model_validate(est).model_dump(),
            })
    return result


# ---------------------------------------------------------------------------
# GET /apoderado/comunicados/{dest_id}  — detalle + marca como leído
# ---------------------------------------------------------------------------

@router.get("/comunicados/{dest_id}")
def leer_comunicado(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)

    dest = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.id == dest_id
    ).first()
    if not dest:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    # Verificar que es hijo del apoderado
    _verificar_hijo(current_user.id, dest.estudiante_id, db)

    # Marcar como leído
    if not dest.leido_apoderado:
        dest.leido_apoderado = True
        dest.leido_apoderado_at = datetime.now()
        db.commit()

    com = db.query(Comunicado).filter(Comunicado.id == dest.comunicado_id).first()
    respuestas = (
        db.query(ComunicadoRespuesta)
        .filter(ComunicadoRespuesta.destinatario_id == dest_id)
        .order_by(ComunicadoRespuesta.created_at.asc())
        .all()
    )

    return {
        "dest_id": dest_id,
        "asunto": com.asunto,
        "mensaje": com.mensaje,
        "adjunto_nombre": com.adjunto_nombre,
        "adjunto_drive_url": com.adjunto_drive_url,
        "created_at": com.created_at.isoformat(),
        "leido_apoderado": dest.leido_apoderado,
        "respuestas": [RespuestaResponse.model_validate(r).model_dump() for r in respuestas],
    }


# ---------------------------------------------------------------------------
# POST /apoderado/comunicados/{dest_id}/responder
# ---------------------------------------------------------------------------

@router.post("/comunicados/{dest_id}/responder", status_code=201)
def responder(
    dest_id: str,
    data: ResponderRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)

    dest = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.id == dest_id
    ).first()
    if not dest:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    _verificar_hijo(current_user.id, dest.estudiante_id, db)

    respuesta = ComunicadoRespuesta(
        destinatario_id=dest_id,
        mensaje=data.mensaje,
        adjunto_nombre=data.adjunto_nombre,
        adjunto_drive_url=data.adjunto_drive_url,
        leido_auxiliar=False,
    )
    db.add(respuesta)
    db.commit()
    db.refresh(respuesta)
    return RespuestaResponse.model_validate(respuesta)


# ---------------------------------------------------------------------------
# GET /apoderado/justificaciones
# ---------------------------------------------------------------------------

@router.get("/justificaciones", response_model=List[JustificacionResponse])
def mis_justificaciones(
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)

    q = db.query(Justificacion).filter(Justificacion.apoderado_id == current_user.id)
    if estado:
        q = q.filter(Justificacion.estado == estado)

    justificaciones = q.order_by(Justificacion.created_at.desc()).all()

    result = []
    for j in justificaciones:
        r = JustificacionResponse.model_validate(j)
        asistencia = db.query(Asistencia).filter(Asistencia.id == j.asistencia_id).first()
        if asistencia:
            r.asistencia = AsistenciaResponse.model_validate(asistencia)
            est = db.query(Estudiante).filter(Estudiante.id == asistencia.estudiante_id).first()
            if est:
                r.estudiante = EstudianteBasico.model_validate(est)
        result.append(r)

    return result


# ---------------------------------------------------------------------------
# POST /apoderado/subir-adjunto  (para justificaciones y respuestas)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/horario
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/horario")
def horario_hijo(
    estudiante_id: str,
    anio: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve el horario semanal de clases del estudiante (agrupa por nivel+grado+sección+año)."""
    _verificar_apoderado(current_user)
    estudiante = _verificar_hijo(str(current_user.id), estudiante_id, db)
    year = anio or _hoy().year

    from models.horario_curso import HorarioCurso
    periodos = (
        db.query(HorarioCurso)
        .filter(
            HorarioCurso.nivel   == estudiante.nivel,
            HorarioCurso.grado   == estudiante.grado,
            HorarioCurso.seccion == estudiante.seccion,
            HorarioCurso.anio    == year,
        )
        .order_by(HorarioCurso.dia_semana, HorarioCurso.hora_inicio)
        .all()
    )

    return [
        {
            "id":             str(p.id),
            "dia_semana":     p.dia_semana,
            "hora_inicio":    p.hora_inicio,
            "hora_fin":       p.hora_fin,
            "curso_nombre":   p.curso_nombre,
            "docente_nombre": p.docente_nombre,
        }
        for p in periodos
    ]


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/horario-archivo
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/horario-archivo")
def horario_archivo_hijo(
    estudiante_id: str,
    anio: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve el archivo (PDF/imagen) del horario de clases del estudiante."""
    _verificar_apoderado(current_user)
    estudiante = _verificar_hijo(str(current_user.id), estudiante_id, db)
    year = anio or _hoy().year

    from models.horario_archivo import HorarioArchivo
    h = db.query(HorarioArchivo).filter(
        HorarioArchivo.nivel   == estudiante.nivel,
        HorarioArchivo.grado   == estudiante.grado,
        HorarioArchivo.seccion == estudiante.seccion,
        HorarioArchivo.anio    == year,
    ).first()

    if not h:
        return None

    return {
        "id":             str(h.id),
        "archivo_nombre": h.archivo_nombre,
        "archivo_url":    h.archivo_url,
        "created_at":     h.created_at.isoformat() if h.created_at else None,
    }


# ---------------------------------------------------------------------------
# GET /apoderado/hijo/{id}/libretas
# ---------------------------------------------------------------------------

@router.get("/hijo/{estudiante_id}/libretas")
def libretas_hijo(
    estudiante_id: str,
    anio: int = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    _verificar_hijo(current_user.id, estudiante_id, db)

    libretas = (
        db.query(Libreta)
        .filter(Libreta.estudiante_id == estudiante_id, Libreta.anio == anio)
        .order_by(Libreta.bimestre)
        .all()
    )

    return [
        {
            "id":             l.id,
            "bimestre":       l.bimestre,
            "anio":           l.anio,
            "archivo_nombre": l.archivo_nombre,
            "archivo_url":    l.archivo_url,
            "subido_en":      l.subido_en.isoformat() if l.subido_en else None,
        }
        for l in libretas
    ]


# ---------------------------------------------------------------------------
# POST /apoderado/subir-adjunto
async def subir_adjunto(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_apoderado(current_user)
    contenido = await archivo.read()
    mime = archivo.content_type or "application/octet-stream"
    try:
        from services.drive_service import subir_archivo
        return subir_archivo(contenido, archivo.filename, mime)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
