from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from core.tz import ahora as _ahora, hoy as _hoy
from models.asistencia import Asistencia, Horario
from models.dia_no_laborable import DiasNoLaborables
from models.estudiante import Estudiante
from models.usuario import Usuario
from schemas.asistencia import (
    AsistenciaResponse,
    EscanearRequest,
    EscaneoResult,
    ManualRequest,
    PreviewRequest,
    PreviewResult,
    RegistroDia,
    ResumenHoy,
)
from schemas.estudiante import EstudianteBasico

router = APIRouter()

# Roles que pueden escanear
ROLES_AUXILIAR = {"i-auxiliar", "p-auxiliar", "s-auxiliar", "admin"}
NIVEL_POR_ROL = {
    "i-auxiliar": "inicial",
    "p-auxiliar": "primaria",
    "s-auxiliar": "secundaria",
}


# ---------------------------------------------------------------------------
# Funciones de lógica de negocio
# ---------------------------------------------------------------------------

def _parse_time(t) -> time:
    """Convierte string 'HH:MM:SS' o timedelta a datetime.time."""
    if isinstance(t, time):
        return t
    if hasattr(t, "total_seconds"):          # timedelta (PyMySQL devuelve esto para TIME)
        secs = int(t.total_seconds())
        return time(secs // 3600, (secs % 3600) // 60, secs % 60)
    return datetime.strptime(str(t), "%H:%M:%S").time()


def es_dia_laborable(fecha: date, db: Session) -> bool:
    """Verdadero si la fecha es lunes-viernes y no está en dias_no_laborables."""
    if fecha.weekday() >= 5:        # sábado=5, domingo=6 — siempre bloqueado
        return False
    from core.config import settings
    if settings.ENVIRONMENT == "development":
        return True  # En desarrollo solo se omite el check de DNL, nunca el de fin de semana
    no_lab = db.query(DiasNoLaborables).filter(
        DiasNoLaborables.fecha == fecha
    ).first()
    return no_lab is None


# ---------------------------------------------------------------------------
# Horario efectivo (base + excepción por fecha)
# ---------------------------------------------------------------------------

def _to_str(t) -> str:
    """Convierte timedelta, time o string a 'HH:MM:SS'."""
    if hasattr(t, "total_seconds"):          # timedelta
        s = int(t.total_seconds())
        return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"
    if isinstance(t, time):
        return t.strftime("%H:%M:%S")
    return str(t)


@dataclass
class HorarioEfectivo:
    hora_ingreso_inicio: str
    hora_ingreso_fin: str
    hora_salida_inicio: str
    hora_salida_fin: str
    hora_cierre_faltas: str
    tiene_excepcion: bool = False
    motivo_excepcion: str = ""


def get_horario_efectivo(nivel: str, fecha: date, db: Session) -> Optional[HorarioEfectivo]:
    """
    Devuelve el horario vigente para `nivel` en `fecha`.
    Si existe una excepción ese día para el nivel (o 'todos'), aplica sus overrides.
    El registro específico de nivel tiene prioridad sobre 'todos'.
    """
    from models.horario_excepcion import HorarioExcepcion

    horario = db.query(Horario).filter(Horario.nivel == nivel).first()
    if not horario:
        return None

    # Busca excepción: primero nivel específico, luego 'todos'
    excepcion = (
        db.query(HorarioExcepcion)
        .filter(
            HorarioExcepcion.fecha == fecha,
            or_(HorarioExcepcion.nivel == nivel, HorarioExcepcion.nivel == "todos"),
        )
        .order_by((HorarioExcepcion.nivel == "todos").asc())   # especifico primero
        .first()
    )

    efe = HorarioEfectivo(
        hora_ingreso_inicio=_to_str(horario.hora_ingreso_inicio),
        hora_ingreso_fin=_to_str(horario.hora_ingreso_fin),
        hora_salida_inicio=_to_str(horario.hora_salida_inicio),
        hora_salida_fin=_to_str(horario.hora_salida_fin),
        hora_cierre_faltas=_to_str(horario.hora_cierre_faltas),
    )

    if excepcion:
        efe.tiene_excepcion = True
        efe.motivo_excepcion = excepcion.motivo
        if excepcion.hora_ingreso_fin:
            efe.hora_ingreso_fin = _to_str(excepcion.hora_ingreso_fin)
        if excepcion.hora_salida_inicio:
            efe.hora_salida_inicio = _to_str(excepcion.hora_salida_inicio)
        if excepcion.hora_cierre_faltas:
            efe.hora_cierre_faltas = _to_str(excepcion.hora_cierre_faltas)

    return efe


MOTIVO_LABEL = {
    "marcha":                   "Marcha / Movilización",
    "juegos_deportivos":        "Juegos deportivos",
    "enfermedad":               "Enfermedad / Malestar",
    "permiso_apoderado":        "Permiso del apoderado",
    "actividad_institucional":  "Actividad institucional",
    "tardanza_justificada":     "Tardanza justificada",
    "otro":                     "Otro motivo",
}

TIPOS_SOLICITADOS_VALIDOS = {"ingreso", "salida", "ingreso_especial", "salida_especial"}


def detectar_estado(hora_escaneo: time, horario: Horario, tipo_solicitado: str):
    """
    Devuelve (tipo_registro, estado) según hora, horario y tipo solicitado.

    Especiales explícitos (el auxiliar lo elige manualmente):
      ingreso_especial  → ('ingreso_especial', 'especial')   — permiso, actividad, etc.
      salida_especial   → ('salida_especial',  'especial')   — marcha, deportes, salud, etc.

    Automáticos (detección por hora):
      ingreso puntual:   hora <= hora_ingreso_fin   → ('ingreso',          'puntual')
      ingreso tardanza:  hora >  hora_ingreso_fin   → ('ingreso_especial', 'tardanza')
      salida normal:     hora >= hora_salida_inicio → ('salida',           'especial')
      salida anticipada: hora <  hora_salida_inicio → ('salida_especial',  'especial')
    """
    # Especiales explícitos: el auxiliar ya decidió el tipo antes de escanear
    if tipo_solicitado == "ingreso_especial":
        return "ingreso_especial", "especial"
    if tipo_solicitado == "salida_especial":
        return "salida_especial", "especial"

    # Modos normales: detección automática por hora
    h_ingreso_fin = _parse_time(horario.hora_ingreso_fin)
    h_salida_ini  = _parse_time(horario.hora_salida_inicio)

    if tipo_solicitado == "ingreso":
        if hora_escaneo <= h_ingreso_fin:
            return "ingreso", "puntual"
        else:
            return "ingreso_especial", "tardanza"
    else:  # salida
        if hora_escaneo >= h_salida_ini:
            return "salida", "especial"
        else:
            return "salida_especial", "especial"


def _nivel_del_usuario(usuario: Usuario) -> Optional[str]:
    return NIVEL_POR_ROL.get(usuario.rol)


# ---------------------------------------------------------------------------
# POST /asistencia/previsualizar  — detecta qué acción se registraría sin guardar
# ---------------------------------------------------------------------------

@router.post("/previsualizar", response_model=PreviewResult)
def previsualizar_escaneo(
    data: PreviewRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos para escanear")

    estudiante = (
        db.query(Estudiante)
        .filter(Estudiante.qr_token == data.qr_token, Estudiante.activo == True)
        .first()
    )
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR no reconocido o estudiante inactivo")

    if current_user.rol != "admin":
        nivel_permitido = NIVEL_POR_ROL[current_user.rol]
        if estudiante.nivel != nivel_permitido:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Este estudiante pertenece a {estudiante.nivel}, tú gestionas {nivel_permitido}",
            )

    fecha_hoy = _hoy()
    ahora     = _ahora()

    if not es_dia_laborable(fecha_hoy, db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hoy no es un día laborable")

    horario = get_horario_efectivo(estudiante.nivel, fecha_hoy, db)
    if not horario:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"No hay horario configurado para nivel '{estudiante.nivel}'",
        )

    hora_actual   = ahora.time()
    h_ingreso_fin = _parse_time(horario.hora_ingreso_fin)
    h_salida_ini  = _parse_time(horario.hora_salida_inicio)

    registros_hoy = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id == estudiante.id, Asistencia.fecha == fecha_hoy)
        .order_by(Asistencia.hora.desc())
        .all()
    )

    ingreso_hoy = next((r for r in registros_hoy if r.tipo in ("ingreso", "ingreso_especial")), None)
    salida_hoy  = next((r for r in registros_hoy if r.tipo in ("salida", "salida_especial")),  None)
    est         = EstudianteBasico.model_validate(estudiante)

    # Caso 1: sin ingreso → registrar ingreso
    if not ingreso_hoy:
        if hora_actual <= h_ingreso_fin:
            return PreviewResult(
                estudiante=est, tipo_a_enviar="ingreso", estado_previsto="puntual",
                requiere_motivo=False, requiere_observacion=False, motivo_auto=None,
                label="INGRESO PUNTUAL", sublabel="Llegó a tiempo",
            )
        return PreviewResult(
            estudiante=est, tipo_a_enviar="ingreso", estado_previsto="tardanza",
            requiere_motivo=False, requiere_observacion=True, motivo_auto=None,
            label="TARDANZA", sublabel="Llegó después de la hora límite — ingresa el motivo",
        )

    # Caso 2: última salida fue especial → alumno regresa (ingreso_especial automático)
    if salida_hoy and salida_hoy.tipo == "salida_especial":
        motivo     = salida_hoy.motivo_especial or "otro"
        motivo_str = MOTIVO_LABEL.get(motivo, "salida especial")
        return PreviewResult(
            estudiante=est, tipo_a_enviar="ingreso_especial", estado_previsto="especial",
            requiere_motivo=False, requiere_observacion=False, motivo_auto=motivo,
            label="REGRESO", sublabel=f"Retorna al colegio · {motivo_str}",
        )

    # Caso 3: tiene ingreso sin salida → registrar salida
    if ingreso_hoy and not salida_hoy:
        if hora_actual >= h_salida_ini:
            return PreviewResult(
                estudiante=est, tipo_a_enviar="salida", estado_previsto="especial",
                requiere_motivo=False, requiere_observacion=False, motivo_auto=None,
                label="SALIDA", sublabel="Salida en horario regular",
            )
        return PreviewResult(
            estudiante=est, tipo_a_enviar="salida_especial", estado_previsto="especial",
            requiere_motivo=True, requiere_observacion=False, motivo_auto=None,
            label="SALIDA ANTICIPADA", sublabel="Sale antes del horario — selecciona el motivo",
        )

    # Caso 4: ya tiene ingreso y salida normal
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "Este estudiante ya tiene ingreso y salida registrados hoy",
    )


# ---------------------------------------------------------------------------
# POST /asistencia/escanear
# ---------------------------------------------------------------------------

@router.post("/escanear", response_model=EscaneoResult)
def escanear(
    data: EscanearRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permisos para escanear")

    if data.tipo_solicitado not in TIPOS_SOLICITADOS_VALIDOS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "tipo_solicitado debe ser 'ingreso', 'salida', 'ingreso_especial' o 'salida_especial'",
        )

    # Buscar estudiante por QR token
    estudiante = (
        db.query(Estudiante)
        .filter(Estudiante.qr_token == data.qr_token, Estudiante.activo == True)
        .first()
    )
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR no reconocido o estudiante inactivo")

    # Verificar nivel del auxiliar
    if current_user.rol != "admin":
        nivel_permitido = NIVEL_POR_ROL[current_user.rol]
        if estudiante.nivel != nivel_permitido:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Este estudiante pertenece a {estudiante.nivel}, tú gestionas {nivel_permitido}",
            )

    # Fecha y hora actuales
    ahora = _ahora()
    fecha_hoy = ahora.date()
    hora_actual = ahora.time()

    if not es_dia_laborable(fecha_hoy, db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hoy no es un día laborable")

    # Obtener horario efectivo (base + posible excepción del día)
    horario = get_horario_efectivo(estudiante.nivel, fecha_hoy, db)
    if not horario:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"No hay horario configurado para nivel '{estudiante.nivel}'",
        )

    # Detectar tipo y estado
    tipo_registro, estado = detectar_estado(hora_actual, horario, data.tipo_solicitado)

    # 1) Verificar duplicado PRIMERO (antes de pedir obs) para dar la alerta correcta
    #
    # Caso especial: ingreso_especial tras salida_especial = regreso del alumno → permitir siempre
    if data.tipo_solicitado == "ingreso_especial":
        salida_esp_previa = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == estudiante.id,
                Asistencia.fecha == fecha_hoy,
                Asistencia.tipo == "salida_especial",
            )
            .first()
        )
        registro_previo = None if salida_esp_previa else (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == estudiante.id,
                Asistencia.fecha == fecha_hoy,
                Asistencia.tipo.in_(("ingreso", "ingreso_especial")),
            )
            .first()
        )
    else:
        tipos_grupo = (
            ("ingreso", "ingreso_especial")
            if data.tipo_solicitado == "ingreso"
            else ("salida", "salida_especial")
        )
        registro_previo = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id == estudiante.id,
                Asistencia.fecha == fecha_hoy,
                Asistencia.tipo.in_(tipos_grupo),
            )
            .first()
        )

    if registro_previo and not data.forzar:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "detail": "Ya existe un registro para este estudiante hoy",
                "registro_previo": {
                    "id": registro_previo.id,
                    "tipo": registro_previo.tipo,
                    "hora": registro_previo.hora.isoformat(),
                    "estado": registro_previo.estado,
                },
            },
        )

    # 2) Validaciones según tipo
    if data.tipo_solicitado in ("ingreso_especial", "salida_especial"):
        # Especial explícito: requiere motivo del catálogo
        if not data.motivo_especial:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "El motivo es obligatorio para ingresos y salidas especiales",
            )
        if data.motivo_especial not in MOTIVO_LABEL:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Motivo inválido. Valores permitidos: {', '.join(MOTIVO_LABEL.keys())}",
            )
    elif estado == "tardanza":
        # Tardanza auto-detectada: requiere observación libre
        if not data.observacion:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "La observación es obligatoria para tardanzas",
            )

    fue_sobreescrito = False
    if registro_previo:
        db.delete(registro_previo)
        db.flush()
        fue_sobreescrito = True

    # Crear registro de asistencia
    nuevo = Asistencia(
        estudiante_id=estudiante.id,
        auxiliar_id=current_user.id,
        fecha=fecha_hoy,
        tipo=tipo_registro,
        hora=ahora,
        estado=estado,
        motivo_especial=data.motivo_especial if data.tipo_solicitado in ("ingreso_especial", "salida_especial") else None,
        observacion=data.observacion,
        correo_enviado=False,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    # Notificar por correo y push en background:
    #   - Ingresos de cualquier tipo (puntual, tardanza, especial)
    #   - Salidas especiales con motivo explícito (marcha, deportes, enfermedad, etc.)
    notificar = (
        (nuevo.tipo in ("ingreso", "ingreso_especial") and nuevo.estado in ("puntual", "tardanza", "especial"))
        or (nuevo.tipo == "salida_especial" and nuevo.motivo_especial is not None)
    )
    if notificar:
        try:
            from services.gmail_service import notificar_asistencia_bg
            notificar_asistencia_bg(nuevo.id)
        except Exception:
            pass  # el correo nunca bloquea la respuesta
        try:
            from services.firebase_service import push_asistencia_bg
            import logging
            logging.getLogger(__name__).info("[escanear] Llamando push_asistencia_bg(%s)", nuevo.id)
            push_asistencia_bg(nuevo.id)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("[escanear] Error al llamar push_asistencia_bg: %s", exc)

    # Contar tardanzas y faltas del mes (solo lunes-viernes)
    inicio_mes = fecha_hoy.replace(day=1)
    tardanzas_mes = db.query(func.count(func.distinct(Asistencia.fecha))).filter(
        Asistencia.estudiante_id == estudiante.id,
        Asistencia.estado == "tardanza",
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio_mes,
        Asistencia.fecha <= fecha_hoy,
        func.dayofweek(Asistencia.fecha).between(2, 6),
    ).scalar() or 0

    faltas_mes = db.query(func.count(func.distinct(Asistencia.fecha))).filter(
        Asistencia.estudiante_id == estudiante.id,
        Asistencia.estado == "falta",
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio_mes,
        Asistencia.fecha <= fecha_hoy,
        func.dayofweek(Asistencia.fecha).between(2, 6),
    ).scalar() or 0

    estado_label = {"puntual": "Puntual", "tardanza": "Tardanza", "especial": "Registrado"}
    nombre_completo = f"{estudiante.nombre} {estudiante.apellido}"
    motivo_str = f" · {MOTIVO_LABEL[nuevo.motivo_especial]}" if nuevo.motivo_especial else ""
    mensaje = f"{estado_label.get(estado, estado)} — {nombre_completo} ({tipo_registro.replace('_', ' ')}{motivo_str})"

    return EscaneoResult(
        asistencia=AsistenciaResponse.model_validate(nuevo),
        estudiante=EstudianteBasico.model_validate(estudiante),
        mensaje=mensaje,
        fue_sobreescrito=fue_sobreescrito,
        tardanzas_mes=tardanzas_mes,
        faltas_mes=faltas_mes,
    )


# ---------------------------------------------------------------------------
# GET /asistencia/hoy
# ---------------------------------------------------------------------------

@router.get("/hoy", response_model=List[RegistroDia])
def hoy(
    nivel: Optional[str] = Query(None, description="inicial | primaria | secundaria"),
    grado: Optional[str] = Query(None),
    seccion: Optional[str] = Query(None),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if fecha is None:
        fecha = _hoy()

    # Auxiliares sólo ven su nivel
    if current_user.rol in NIVEL_POR_ROL and nivel is None:
        nivel = NIVEL_POR_ROL[current_user.rol]

    # Tutores ven su nivel (se completa en TAREA tutor)
    q = db.query(Estudiante).filter(Estudiante.activo == True)
    if nivel:
        q = q.filter(Estudiante.nivel == nivel)
    if grado:
        q = q.filter(Estudiante.grado == grado)
    if seccion:
        q = q.filter(Estudiante.seccion == seccion)

    estudiantes = q.order_by(Estudiante.apellido, Estudiante.nombre).all()
    if not estudiantes:
        return []

    ids = [e.id for e in estudiantes]
    asistencias = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id.in_(ids), Asistencia.fecha == fecha)
        .all()
    )

    # Indexar por estudiante_id
    map_ingreso: dict = {}
    map_salida: dict = {}
    for a in asistencias:
        if a.tipo in ("ingreso", "ingreso_especial"):
            map_ingreso[a.estudiante_id] = a
        elif a.tipo in ("salida", "salida_especial"):
            map_salida[a.estudiante_id] = a

    # Batch: tardanzas y faltas del mes para todos los estudiantes (2 queries)
    inicio_mes = fecha.replace(day=1)
    tardanzas_batch = dict(
        db.query(Asistencia.estudiante_id, func.count(func.distinct(Asistencia.fecha)))
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.estado == "tardanza",
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            Asistencia.fecha >= inicio_mes,
            Asistencia.fecha <= fecha,
            func.dayofweek(Asistencia.fecha).between(2, 6),
        )
        .group_by(Asistencia.estudiante_id)
        .all()
    )
    # Faltas del mes: solo registros explícitos estado='falta' (creados por el scheduler).
    # Para hoy: si no hay ningún ingreso aún, se suma +1 al construir el resultado.
    faltas_batch = dict(
        db.query(Asistencia.estudiante_id, func.count(func.distinct(Asistencia.fecha)))
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.estado == "falta",
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            Asistencia.fecha >= inicio_mes,
            Asistencia.fecha <= fecha,
            func.dayofweek(Asistencia.fecha).between(2, 6),
        )
        .group_by(Asistencia.estudiante_id)
        .all()
    )

    result = []
    for est in estudiantes:
        ingreso = map_ingreso.get(est.id)
        salida = map_salida.get(est.id)

        if ingreso:
            estado_dia = ingreso.estado           # puntual | tardanza | especial
        else:
            estado_dia = "falta"

        result.append(
            RegistroDia(
                estudiante=EstudianteBasico.model_validate(est),
                ingreso=AsistenciaResponse.model_validate(ingreso) if ingreso else None,
                salida=AsistenciaResponse.model_validate(salida) if salida else None,
                estado_dia=estado_dia,
                tardanzas_mes=tardanzas_batch.get(est.id, 0),
                faltas_mes=faltas_batch.get(est.id, 0) + (
                    1 if fecha == _hoy() and ingreso is None else 0
                ),
            )
        )

    return result


# ---------------------------------------------------------------------------
# GET /asistencia/hoy/resumen
# ---------------------------------------------------------------------------

@router.get("/hoy/resumen", response_model=ResumenHoy)
def resumen_hoy(
    nivel: Optional[str] = Query(None),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if fecha is None:
        fecha = _hoy()
    if current_user.rol in NIVEL_POR_ROL and nivel is None:
        nivel = NIVEL_POR_ROL[current_user.rol]

    registros = hoy(nivel=nivel, grado=None, seccion=None, fecha=fecha, db=db, current_user=current_user)

    conteo = {"puntual": 0, "tardanza": 0, "falta": 0}
    con_salida = 0
    for r in registros:
        conteo[r.estado_dia] = conteo.get(r.estado_dia, 0) + 1
        if r.salida:
            con_salida += 1

    return ResumenHoy(
        fecha=fecha,
        nivel=nivel,
        total_estudiantes=len(registros),
        puntuales=conteo.get("puntual", 0),
        tardanzas=conteo.get("tardanza", 0),
        faltas=conteo.get("falta", 0),
        con_salida=con_salida,
    )


# ---------------------------------------------------------------------------
# GET /asistencia/estudiante/{id}
# ---------------------------------------------------------------------------

@router.get("/estudiante/{estudiante_id}", response_model=List[AsistenciaResponse])
def historial_estudiante(
    estudiante_id: str,
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    estudiante = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")

    q = db.query(Asistencia).filter(Asistencia.estudiante_id == estudiante_id)
    if fecha_inicio:
        q = q.filter(Asistencia.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Asistencia.fecha <= fecha_fin)

    return q.order_by(Asistencia.fecha.desc(), Asistencia.hora.desc()).all()


# ---------------------------------------------------------------------------
# GET /asistencia/estudiante/{id}/resumen-mes
# Resumen canónico del mes para auxiliar/tutor/admin (mismo servicio que apoderado)
# ---------------------------------------------------------------------------

@router.get("/estudiante/{estudiante_id}/resumen-mes")
def resumen_mes_estudiante(
    estudiante_id: str,
    mes:  Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")

    hoy  = _hoy()
    mes  = mes  or hoy.month
    anio = anio or hoy.year

    from services.asistencia_calc import calcular_resumen_mes
    return calcular_resumen_mes(estudiante_id, est.nivel, est.grado, est.seccion, mes, anio, db)


# ---------------------------------------------------------------------------
# GET /asistencia/perfil-qr/{qr_token}  — inspección por QR sin registrar
# ---------------------------------------------------------------------------

def _build_perfil(estudiante: Estudiante, db: Session):
    """Construye el perfil de inspección de un alumno (sin efectos secundarios)."""
    from models.estudiante import ApoderadoEstudiante
    from models.usuario import Usuario as UsuarioModel

    fecha_hoy = _hoy()
    inicio_mes = fecha_hoy.replace(day=1)

    tardanzas_mes = db.query(func.count(func.distinct(Asistencia.fecha))).filter(
        Asistencia.estudiante_id == estudiante.id,
        Asistencia.estado == "tardanza",
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio_mes,
        func.dayofweek(Asistencia.fecha).between(2, 6),
    ).scalar() or 0

    faltas_mes = db.query(func.count(func.distinct(Asistencia.fecha))).filter(
        Asistencia.estudiante_id == estudiante.id,
        Asistencia.estado == "falta",
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio_mes,
        func.dayofweek(Asistencia.fecha).between(2, 6),
    ).scalar() or 0

    ultimas = (
        db.query(Asistencia)
        .filter(Asistencia.estudiante_id == estudiante.id)
        .order_by(Asistencia.fecha.desc(), Asistencia.hora.desc())
        .limit(20)
        .all()
    )

    vinculos = db.query(ApoderadoEstudiante).filter(
        ApoderadoEstudiante.estudiante_id == estudiante.id
    ).all()
    apoderados = []
    for v in vinculos:
        apo = db.query(UsuarioModel).filter(UsuarioModel.id == v.apoderado_id).first()
        if apo:
            apoderados.append({
                "id": apo.id, "nombre": apo.nombre, "apellido": apo.apellido,
                "email": apo.email, "telefono": apo.telefono,
            })

    return {
        "estudiante": EstudianteBasico.model_validate(estudiante),
        "tardanzas_mes": tardanzas_mes,
        "faltas_mes": faltas_mes,
        "ultimas_asistencias": [AsistenciaResponse.model_validate(a) for a in ultimas],
        "apoderados": apoderados,
    }


@router.get("/perfil-qr/{qr_token}")
def perfil_por_qr(
    qr_token: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    estudiante = db.query(Estudiante).filter(
        Estudiante.qr_token == qr_token, Estudiante.activo == True
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR no reconocido o alumno inactivo")

    if current_user.rol != "admin":
        nivel_permitido = NIVEL_POR_ROL[current_user.rol]
        if estudiante.nivel != nivel_permitido:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Este alumno no pertenece a tu nivel")

    return _build_perfil(estudiante, db)


@router.get("/perfil-alumno/{estudiante_id}")
def perfil_por_id(
    estudiante_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    estudiante = db.query(Estudiante).filter(
        Estudiante.id == estudiante_id, Estudiante.activo == True
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")

    if current_user.rol != "admin":
        nivel_permitido = NIVEL_POR_ROL[current_user.rol]
        if estudiante.nivel != nivel_permitido:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Este alumno no pertenece a tu nivel")

    return _build_perfil(estudiante, db)


# ---------------------------------------------------------------------------
# POST /asistencia/manual  (para el auxiliar: registrar casos sin QR)
# ---------------------------------------------------------------------------

@router.post("/manual", response_model=AsistenciaResponse, status_code=status.HTTP_201_CREATED)
def manual(
    data: ManualRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permisos")

    estudiante = db.query(Estudiante).filter(
        Estudiante.id == data.estudiante_id, Estudiante.activo == True
    ).first()
    if not estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")

    if data.tipo in ("ingreso_especial", "salida_especial"):
        if not data.motivo_especial:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "El motivo es obligatorio para registros especiales",
            )
        if data.motivo_especial not in MOTIVO_LABEL:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Motivo inválido. Valores permitidos: {', '.join(MOTIVO_LABEL.keys())}",
            )

    fecha = data.fecha or _hoy()
    hora  = data.hora or _ahora()

    nuevo = Asistencia(
        estudiante_id=data.estudiante_id,
        auxiliar_id=current_user.id,
        fecha=fecha,
        tipo=data.tipo,
        hora=hora,
        estado=data.estado,
        motivo_especial=data.motivo_especial if data.tipo in ("ingreso_especial", "salida_especial") else None,
        observacion=data.observacion,
        correo_enviado=False,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# ---------------------------------------------------------------------------
# GET /asistencia/horario-hoy  — horario efectivo del día para el auxiliar
# ---------------------------------------------------------------------------

@router.get("/horario-hoy")
def horario_hoy(
    nivel: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Devuelve el horario vigente para hoy (base + excepción si la hay).
    Usado por el frontend del auxiliar para mostrar alerta de horario modificado.
    """
    if current_user.rol not in ROLES_AUXILIAR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permisos")

    nivel_uso = nivel or NIVEL_POR_ROL.get(current_user.rol)
    if not nivel_uso and current_user.rol == "admin":
        nivel_uso = nivel
    if not nivel_uso:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Especifica el nivel")

    horario = get_horario_efectivo(nivel_uso, _hoy(), db)
    if not horario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sin horario configurado")

    return {
        "nivel":               nivel_uso,
        "hora_ingreso_fin":    horario.hora_ingreso_fin,
        "hora_salida_inicio":  horario.hora_salida_inicio,
        "hora_cierre_faltas":  horario.hora_cierre_faltas,
        "tiene_excepcion":     horario.tiene_excepcion,
        "motivo_excepcion":    horario.motivo_excepcion,
    }
