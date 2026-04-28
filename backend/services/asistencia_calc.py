"""
Servicio centralizado de cálculo de asistencia.

Todos los roles (apoderado, tutor, auxiliar) usan estas funciones
para garantizar lógica idéntica: días laborables, faltas implícitas
y porcentaje.

Reglas canónicas
----------------
- días_lab  : L-V excluyendo DiasNoLaborables del nivel/grado/sección.
- faltas implícitas:
    · mes actual             → siempre, incluyendo hoy (no registro = falta)
    · mes pasado con datos   → también (días sin registro = falta)
    · mes pasado sin datos   → NO (sistema no estaba activo ese mes)
    · mes futuro             → NO (no ha ocurrido)
- pct = round((dias_lab - faltas) / dias_lab * 100)  si dias_lab > 0
        100                                           si dias_lab == 0
"""

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.orm import Session

from core.tz import hoy as _hoy
from models.asistencia import Asistencia
from models.dia_no_laborable import DiasNoLaborables

_PRIORIDAD: dict[str, int] = {"tardanza": 3, "puntual": 2, "especial": 2, "falta": 1}


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _get_dias_no_lab(nivel: str, grado: str, seccion: str,
                     inicio: date, fin: date, db: Session) -> set:
    """Fechas no laborables que aplican a un nivel/grado/sección."""
    registros = db.query(DiasNoLaborables).filter(
        DiasNoLaborables.fecha >= inicio,
        DiasNoLaborables.fecha <= fin,
    ).all()
    dias: set = set()
    for r in registros:
        if r.nivel == "todos":
            dias.add(r.fecha)
        elif r.nivel == nivel:
            if r.grado is None or r.grado == grado:
                if r.seccion is None or r.seccion == seccion:
                    dias.add(r.fecha)
    return dias



def _rango_mes(mes: int, anio: int) -> tuple:
    """
    Devuelve (inicio, fin, hasta):
    - mes actual  → hasta = hoy
    - mes futuro  → hasta = inicio - 1  (vacío, pct=100)
    - mes pasado  → hasta = fin
    """
    hoy = _hoy()
    inicio = date(anio, mes, 1)
    fin = date(anio, mes, monthrange(anio, mes)[1])
    if mes == hoy.month and anio == hoy.year:
        hasta = hoy
    elif inicio > hoy:
        hasta = inicio - timedelta(days=1)
    else:
        hasta = fin
    return inicio, fin, hasta


def _contar_dias_lab(inicio: date, hasta: date, dias_no_lab: set) -> int:
    count = 0
    d = inicio
    while d <= hasta:
        if 1 <= d.isoweekday() <= 5 and d not in dias_no_lab:
            count += 1
        d += timedelta(days=1)
    return count


def _aplicar_faltas_implicitas(mapa: dict, inicio: date, hasta_impl: date,
                                dias_no_lab: set) -> None:
    """Rellena `mapa` con 'falta' para días L-V sin registro hasta hasta_impl."""
    d = inicio
    while d <= hasta_impl:
        if 1 <= d.isoweekday() <= 5 and d not in dias_no_lab and d not in mapa:
            mapa[d] = "falta"
        d += timedelta(days=1)


def _conteo(mapa: dict, dias_lab: int) -> dict:
    presentes = sum(1 for e in mapa.values() if e in ("puntual", "especial"))
    tardanzas = sum(1 for e in mapa.values() if e == "tardanza")
    asistidos = presentes + tardanzas
    faltas    = sum(1 for e in mapa.values() if e == "falta")
    pct       = round((dias_lab - faltas) / dias_lab * 100) if dias_lab > 0 else 100
    return {
        "pct":       pct,
        "presentes": presentes,
        "tardanzas": tardanzas,
        "asistidos": asistidos,
        "faltas":    faltas,
    }


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------

def calcular_resumen_mes(estudiante_id: str, nivel: str, grado: str, seccion: str,
                         mes: int, anio: int, db: Session) -> dict:
    """
    Resumen de asistencia de UN estudiante para un mes.
    Incluye el campo `estados` (dict fecha→estado) para el calendario.

    dias_lab usa `fin` (mes completo) como denominador para que el porcentaje
    empiece en 100% y baje con cada falta, sin colapsar a 0% al inicio del mes.
    """
    hoy = _hoy()
    inicio, fin, hasta = _rango_mes(mes, anio)

    dias_no_lab = _get_dias_no_lab(nivel, grado, seccion, inicio, fin, db)
    dias_lab    = _contar_dias_lab(inicio, fin, dias_no_lab)

    if dias_lab == 0:
        return {
            "pct": 100, "dias_lab": 0, "dias_no_lab": len(dias_no_lab),
            "presentes": 0, "tardanzas": 0, "asistidos": 0, "faltas": 0, "estados": {},
        }

    asistencias = db.query(Asistencia).filter(
        Asistencia.estudiante_id == estudiante_id,
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio,
        Asistencia.fecha <= hasta,
    ).all()

    mapa: dict = {}
    for a in asistencias:
        if a.fecha.isoweekday() > 5 or a.fecha in dias_no_lab:
            continue
        if _PRIORIDAD.get(a.estado, 0) > _PRIORIDAD.get(mapa.get(a.fecha), 0):
            mapa[a.fecha] = a.estado

    # Faltas implícitas: día sin registro = falta, siempre, incluido hoy
    es_mes_actual = (mes == hoy.month and anio == hoy.year)
    if es_mes_actual or asistencias:
        _aplicar_faltas_implicitas(mapa, inicio, hasta, dias_no_lab)

    totales = _conteo(mapa, dias_lab)
    return {
        **totales,
        "dias_lab":    dias_lab,
        "dias_no_lab": len(dias_no_lab),
        "estados":     {d.isoformat(): estado for d, estado in mapa.items()},
    }


def calcular_resumen_mes_aula(estudiantes: list, nivel: str, grado: str, seccion: str,
                              mes: int, anio: int, db: Session) -> dict:
    """
    Resumen batch para el tutor: una sola consulta de DNL + asistencias.
    Todos los estudiantes deben ser del mismo nivel/grado/sección.

    Retorna:
        {
          "dias_lab":   int,
          "dias_no_lab": int,
          "por_alumno": { estudiante_id: {pct, presentes, tardanzas, asistidos, faltas} }
        }
    """
    if not estudiantes:
        return {"dias_lab": 0, "dias_no_lab": 0, "por_alumno": {}}

    hoy = _hoy()
    inicio, fin, hasta = _rango_mes(mes, anio)

    dias_no_lab = _get_dias_no_lab(nivel, grado, seccion, inicio, fin, db)
    dias_lab    = _contar_dias_lab(inicio, fin, dias_no_lab)

    es_mes_actual = (mes == hoy.month and anio == hoy.year)

    ids = [e.id for e in estudiantes]
    todas = db.query(Asistencia).filter(
        Asistencia.estudiante_id.in_(ids),
        Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        Asistencia.fecha >= inicio,
        Asistencia.fecha <= hasta,
    ).all()

    por_est: dict = {e.id: [] for e in estudiantes}
    for a in todas:
        if a.estudiante_id in por_est:
            por_est[a.estudiante_id].append(a)

    por_alumno: dict = {}
    for est in estudiantes:
        asistencias = por_est[est.id]

        mapa: dict = {}
        for a in asistencias:
            if a.fecha.isoweekday() > 5 or a.fecha in dias_no_lab:
                continue
            if _PRIORIDAD.get(a.estado, 0) > _PRIORIDAD.get(mapa.get(a.fecha), 0):
                mapa[a.fecha] = a.estado

        if dias_lab > 0 and (es_mes_actual or asistencias):
            _aplicar_faltas_implicitas(mapa, inicio, hasta, dias_no_lab)

        por_alumno[est.id] = _conteo(mapa, dias_lab)

    return {"dias_lab": dias_lab, "dias_no_lab": len(dias_no_lab), "por_alumno": por_alumno}


def get_fechas_laborables(nivel: str, grado: str, seccion: str,
                          fecha_inicio: date, fecha_fin: date, db: Session) -> list:
    """
    Lista de fechas L-V (strings ISO) en el rango dado, excluyendo DNL.
    Útil para el historial del tutor.
    """
    dias_no_lab = _get_dias_no_lab(nivel, grado, seccion, fecha_inicio, fecha_fin, db)
    fechas = []
    d = fecha_inicio
    while d <= fecha_fin:
        if 1 <= d.isoweekday() <= 5 and d not in dias_no_lab:
            fechas.append(d.isoformat())
        d += timedelta(days=1)
    return fechas
