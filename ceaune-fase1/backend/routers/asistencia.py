from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import date, datetime, timedelta
import uuid
import logging

logger = logging.getLogger(__name__)

from database import get_db
from core.dependencies import get_current_user, require_roles
from models.asistencia import Asistencia, HorarioSecundaria
from models.estudiante import Estudiante
from schemas.asistencia import EscanearRequest, AsistenciaOut, ResumenDia

router = APIRouter()


# ─── Helpers ────────────────────────────────────────────────────────────────

def detectar_estado(hora_escaneo: datetime, tipo: str, horario: HorarioSecundaria):
    """Retorna (tipo_registro, estado) según la hora y el horario configurado."""
    t = hora_escaneo.time()
    if tipo == "ingreso":
        if t <= horario.hora_ingreso_limite:
            return ("ingreso", "puntual")
        else:
            return ("ingreso_especial", "tardanza")
    else:  # salida
        if t >= horario.hora_salida_inicio:
            return ("salida", "especial")
        else:
            return ("salida_especial", "especial")


def build_out(a: Asistencia, e: Estudiante) -> AsistenciaOut:
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


def get_horario(db: Session) -> HorarioSecundaria:
    horario = db.query(HorarioSecundaria).filter(HorarioSecundaria.id == 1).first()
    if not horario:
        raise HTTPException(status_code=500, detail="Horario no configurado en BD")
    return horario


# ─── POST /asistencia/escanear ───────────────────────────────────────────────

@router.post("/escanear", response_model=AsistenciaOut, status_code=status.HTTP_201_CREATED)
def escanear(
    data: EscanearRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    if not data.qr_token and not data.dni:
        raise HTTPException(status_code=400, detail="Debe enviar qr_token o dni")

    # Buscar estudiante
    if data.qr_token:
        estudiante = db.query(Estudiante).filter(
            Estudiante.qr_token == data.qr_token,
            Estudiante.activo == True,
        ).first()
    else:
        estudiante = db.query(Estudiante).filter(
            Estudiante.dni == data.dni,
            Estudiante.activo == True,
        ).first()

    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado o inactivo")

    hoy = date.today()
    ahora = datetime.now()

    # Prevenir doble ingreso en el mismo día
    if data.tipo == "ingreso":
        ya_tiene = db.query(Asistencia).filter(
            Asistencia.estudiante_id == estudiante.id,
            Asistencia.fecha == hoy,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        ).first()
        if ya_tiene:
            raise HTTPException(
                status_code=409,
                detail=f"{estudiante.nombre} ya registró ingreso hoy a las {ya_tiene.hora.strftime('%H:%M')}",
            )

    # Detectar estado
    horario = get_horario(db)
    tipo_registro, estado = detectar_estado(ahora, data.tipo, horario)

    # Agregar observación automática si es tardanza
    observacion = data.observacion
    if estado == "tardanza" and not observacion:
        limite = horario.hora_ingreso_limite
        minutos = int((ahora.hour * 60 + ahora.minute) - (limite.hour * 60 + limite.minute))
        observacion = f"Llegó {minutos} minuto(s) tarde"

    # Crear registro
    registro = Asistencia(
        id=str(uuid.uuid4()),
        estudiante_id=estudiante.id,
        auxiliar_id=current_user.id,
        fecha=hoy,
        tipo=tipo_registro,
        hora=ahora,
        estado=estado,
        observacion=observacion,
        correo_enviado=False,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)

    # Enviar correo al apoderado
    try:
        from services.gmail_service import enviar_correo_por_estado
        enviar_correo_por_estado(db, registro, estudiante)
    except Exception as exc:
        logger.error(f"[Gmail] Error al enviar correo para {estudiante.nombre}: {exc}", exc_info=True)

    return build_out(registro, estudiante)


# ─── GET /asistencia/hoy ─────────────────────────────────────────────────────

@router.get("/hoy", response_model=ResumenDia)
def resumen_hoy(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    hoy = date.today()

    total = db.query(func.count(Estudiante.id)).filter(Estudiante.activo == True).scalar()

    # IDs de estudiantes con ingreso hoy (puntual o tardanza)
    con_ingreso = db.query(Asistencia.estudiante_id).filter(
        Asistencia.fecha == hoy,
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
    ).distinct().subquery()

    puntuales = db.query(func.count(Asistencia.id)).filter(
        Asistencia.fecha == hoy,
        Asistencia.estado == "puntual",
        Asistencia.tipo == "ingreso",
    ).scalar()

    tardanzas = db.query(func.count(Asistencia.id)).filter(
        Asistencia.fecha == hoy,
        Asistencia.estado == "tardanza",
    ).scalar()

    faltas = db.query(func.count(Asistencia.id)).filter(
        Asistencia.fecha == hoy,
        Asistencia.estado == "falta",
    ).scalar()

    presentes = db.query(func.count()).select_from(con_ingreso).scalar()

    salieron = db.query(func.count(Asistencia.estudiante_id.distinct())).filter(
        Asistencia.fecha == hoy,
        Asistencia.tipo.in_(["salida", "salida_especial"]),
    ).scalar()

    return ResumenDia(
        fecha=hoy,
        total_estudiantes=total,
        presentes=presentes,
        puntuales=puntuales,
        tardanzas=tardanzas,
        faltas=faltas,
        salieron=salieron,
    )


# ─── GET /asistencia/hoy/lista ───────────────────────────────────────────────

@router.get("/hoy/lista", response_model=list[AsistenciaOut])
def lista_hoy(
    estado: Optional[str] = Query(None, description="puntual|tardanza|falta|especial"),
    grado: Optional[str] = Query(None, description="1ro|2do|3ro|4to|5to"),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    hoy = date.today()

    q = (
        db.query(Asistencia, Estudiante)
        .join(Estudiante, Asistencia.estudiante_id == Estudiante.id)
        .filter(Asistencia.fecha == hoy)
    )

    if estado:
        q = q.filter(Asistencia.estado == estado)
    if grado:
        q = q.filter(Estudiante.grado == grado)

    q = q.order_by(Asistencia.hora.desc())

    return [build_out(a, e) for a, e in q.all()]


# ─── GET /asistencia/estudiante/{id} ─────────────────────────────────────────

@router.get("/estudiante/{estudiante_id}", response_model=list[AsistenciaOut])
def historial_estudiante(
    estudiante_id: str,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    estudiante = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    registros = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id == estudiante_id)
        .order_by(Asistencia.hora.desc())
        .limit(limit)
        .all()
    )

    return [build_out(r, estudiante) for r in registros]


# ─── GET /asistencia/estudiante/{id}/mes ─────────────────────────────────────

@router.get("/estudiante/{estudiante_id}/mes")
def resumen_mes(
    estudiante_id: str,
    mes: Optional[int] = Query(default=None, ge=1, le=12),
    anio: Optional[int] = Query(default=None, ge=2020),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    estudiante = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    hoy = date.today()
    mes = mes or hoy.month
    anio = anio or hoy.year

    registros = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            func.month(Asistencia.fecha) == mes,
            func.year(Asistencia.fecha) == anio,
        )
        .order_by(Asistencia.fecha)
        .all()
    )

    puntuales  = sum(1 for r in registros if r.estado == "puntual")
    tardanzas  = sum(1 for r in registros if r.estado == "tardanza")
    faltas     = sum(1 for r in registros if r.estado == "falta")
    dias_asist = len({r.fecha for r in registros if r.estado != "falta"})

    return {
        "estudiante_id": estudiante_id,
        "nombre": f"{estudiante.nombre} {estudiante.apellido}",
        "grado": estudiante.grado,
        "seccion": estudiante.seccion,
        "mes": mes,
        "anio": anio,
        "dias_asistidos": dias_asist,
        "puntuales": puntuales,
        "tardanzas": tardanzas,
        "faltas": faltas,
        "registros": [build_out(r, estudiante) for r in registros],
    }


# ─── GET /asistencia/semana ───────────────────────────────────────────────────

@router.get("/semana")
def resumen_semana(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("auxiliar", "admin")),
):
    """Resumen diario de los últimos 7 días para el gráfico de barras."""
    hoy = date.today()
    resultado = []

    for i in range(6, -1, -1):
        d = hoy - timedelta(days=i)

        puntuales = db.query(func.count(Asistencia.id)).filter(
            Asistencia.fecha == d, Asistencia.estado == "puntual"
        ).scalar() or 0

        tardanzas = db.query(func.count(Asistencia.id)).filter(
            Asistencia.fecha == d, Asistencia.estado == "tardanza"
        ).scalar() or 0

        faltas = db.query(func.count(Asistencia.id)).filter(
            Asistencia.fecha == d, Asistencia.estado == "falta"
        ).scalar() or 0

        resultado.append({
            "fecha": d.isoformat(),
            "dia": d.strftime("%a").capitalize(),
            "puntuales": puntuales,
            "tardanzas": tardanzas,
            "faltas": faltas,
            "total": puntuales + tardanzas + faltas,
        })

    return resultado


# ─── GET /asistencia/top-tardanzas ───────────────────────────────────────────

@router.get("/top-tardanzas")
def top_tardanzas(
    mes: Optional[int] = Query(default=None, ge=1, le=12),
    anio: Optional[int] = Query(default=None, ge=2020),
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    """Top N estudiantes con más tardanzas en el mes."""
    hoy = date.today()
    mes  = mes  or hoy.month
    anio = anio or hoy.year

    rows = (
        db.query(
            Estudiante,
            func.count(Asistencia.id).label("tardanzas"),
        )
        .join(Asistencia, Asistencia.estudiante_id == Estudiante.id)
        .filter(
            Asistencia.estado == "tardanza",
            func.month(Asistencia.fecha) == mes,
            func.year(Asistencia.fecha) == anio,
        )
        .group_by(Estudiante.id)
        .order_by(func.count(Asistencia.id).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "estudiante_id": e.id,
            "nombre": e.nombre,
            "apellido": e.apellido,
            "grado": e.grado,
            "seccion": e.seccion,
            "tardanzas": t,
        }
        for e, t in rows
    ]
