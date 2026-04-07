"""
APScheduler — Jobs automáticos del sistema CEAUNE.

Jobs configurados:
  - faltas_inicial    → diario a hora_cierre_faltas de nivel inicial
  - faltas_primaria   → diario a hora_cierre_faltas de nivel primaria
  - faltas_secundaria → diario a hora_cierre_faltas de nivel secundaria
  - reporte_semanal   → viernes 18:00

REGLA CRÍTICA: todos los jobs verifican es_dia_laborable() antes de ejecutarse.
"""

import logging
from datetime import date, datetime, timedelta, time

from core.tz import ahora as _ahora, hoy as _hoy

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

TIMEZONE = "America/Lima"

scheduler = BackgroundScheduler(timezone=TIMEZONE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_hora(valor) -> time:
    """Convierte timedelta (PyMySQL) o string 'HH:MM:SS' a datetime.time."""
    if isinstance(valor, time):
        return valor
    if hasattr(valor, "total_seconds"):       # timedelta
        s = int(valor.total_seconds())
        return time(s // 3600, (s % 3600) // 60, s % 60)
    return datetime.strptime(str(valor), "%H:%M:%S").time()


def _get_db():
    from database import SessionLocal
    return SessionLocal()


def _es_dia_laborable(fecha: date, db) -> bool:
    from routers.asistencia import es_dia_laborable
    return es_dia_laborable(fecha, db)


# ---------------------------------------------------------------------------
# JOB 1 — Faltas automáticas por nivel
# ---------------------------------------------------------------------------

def registrar_faltas_nivel(nivel: str):
    """
    Registra estado='falta' para los estudiantes de `nivel` que no tienen
    ningún registro de ingreso en el día de hoy.
    Se ejecuta diariamente a la hora_cierre_faltas del horario BASE.
    Respeta excepciones: si la excepción define un cierre más tarde, espera.
    """
    db = _get_db()
    try:
        from models.asistencia import Asistencia
        from models.estudiante import Estudiante

        hoy = _hoy()

        if not _es_dia_laborable(hoy, db):
            logger.info("[Faltas %s] %s no es día laborable — omitido", nivel, hoy)
            return

        # Verificar horario efectivo: si hay excepción con cierre más tarde, aún no es hora
        try:
            from routers.asistencia import get_horario_efectivo
            horario_efe = get_horario_efectivo(nivel, hoy, db)
            if horario_efe and horario_efe.tiene_excepcion and horario_efe.hora_cierre_faltas:
                h_cierre_efe = _parse_hora(horario_efe.hora_cierre_faltas)
                if _ahora().time() < h_cierre_efe:
                    logger.info(
                        "[Faltas %s] Excepción activa — cierre efectivo %s aún no alcanzado, omitido",
                        nivel, horario_efe.hora_cierre_faltas,
                    )
                    return
        except Exception as exc:
            logger.warning("[Faltas %s] No se pudo verificar excepción: %s", nivel, exc)

        estudiantes = (
            db.query(Estudiante)
            .filter(Estudiante.nivel == nivel, Estudiante.activo == True)
            .all()
        )
        if not estudiantes:
            logger.info("[Faltas %s] Sin estudiantes activos", nivel)
            return

        ids_todos = [e.id for e in estudiantes]

        # IDs que ya tienen ingreso registrado hoy
        ids_con_ingreso = {
            row[0]
            for row in db.query(Asistencia.estudiante_id)
            .filter(
                Asistencia.fecha == hoy,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
                Asistencia.estudiante_id.in_(ids_todos),
            )
            .all()
        }

        ahora = _ahora()
        faltas_nuevas = 0

        for est in estudiantes:
            if est.id not in ids_con_ingreso:
                db.add(
                    Asistencia(
                        estudiante_id=est.id,
                        auxiliar_id=None,
                        fecha=hoy,
                        tipo="ingreso",
                        hora=ahora,
                        estado="falta",
                        correo_enviado=False,
                    )
                )
                faltas_nuevas += 1

        db.commit()
        logger.info(
            "[Faltas %s] %s — %d/%d faltas registradas",
            nivel, hoy, faltas_nuevas, len(estudiantes),
        )

        # Notificar por correo (se activa en TAREA 7)
        if faltas_nuevas:
            _notificar_faltas(nivel, hoy, db)

    except Exception as exc:
        logger.error("[Faltas %s] Error: %s", nivel, exc, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _notificar_faltas(nivel: str, fecha: date, db):
    """Envía correos y push de falta."""
    try:
        from services.firebase_service import push_faltas
        push_faltas(nivel, fecha, db)
    except Exception as exc:
        logger.warning("[Faltas %s] Error al enviar push: %s", nivel, exc)
    try:
        from services.gmail_service import enviar_correos_faltas
        enviar_correos_faltas(nivel, fecha, db)
    except Exception as exc:
        logger.warning("[Faltas %s] Error al enviar correos: %s", nivel, exc)


# ---------------------------------------------------------------------------
# JOB 2 — Reporte semanal (viernes 18:00)
# ---------------------------------------------------------------------------

def generar_reportes_semanales():
    """
    Genera un ReporteSemanal por estudiante para la semana que acaba hoy (viernes).
    Si ya existen reportes para esta semana, no los duplica.
    """
    db = _get_db()
    try:
        from models.asistencia import Asistencia
        from models.comunicado import ComunicadoDestinatario
        from models.dia_no_laborable import ReporteSemanal
        from models.estudiante import Estudiante

        hoy = _hoy()

        # Calcular lunes y viernes de la semana actual
        dias_desde_lunes = hoy.weekday()          # 0=lun … 4=vie
        semana_inicio = hoy - timedelta(days=dias_desde_lunes)
        semana_fin = hoy

        # Evitar duplicados
        ya_existe = (
            db.query(ReporteSemanal)
            .filter(ReporteSemanal.semana_inicio == semana_inicio)
            .first()
        )
        if ya_existe:
            logger.info("[Reporte] Semana %s ya procesada — omitido", semana_inicio)
            return

        # Días laborables de la semana
        dias_laborables = sum(
            1
            for i in range(5)
            if _es_dia_laborable(semana_inicio + timedelta(days=i), db)
        )

        estudiantes = (
            db.query(Estudiante).filter(Estudiante.activo == True).all()
        )

        for est in estudiantes:
            ingresos = (
                db.query(Asistencia)
                .filter(
                    Asistencia.estudiante_id == est.id,
                    Asistencia.fecha >= semana_inicio,
                    Asistencia.fecha <= semana_fin,
                    Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
                )
                .all()
            )

            dias_asistio = sum(1 for a in ingresos if a.estado in ("puntual", "tardanza", "especial"))
            tardanzas    = sum(1 for a in ingresos if a.estado == "tardanza")
            # faltas = días que debía asistir pero no asistió (incluye días sin registro)
            faltas       = max(0, dias_laborables - dias_asistio)

            comunicados_pendientes = (
                db.query(ComunicadoDestinatario)
                .filter(
                    ComunicadoDestinatario.estudiante_id == est.id,
                    ComunicadoDestinatario.leido_apoderado == False,
                )
                .count()
            )

            db.add(
                ReporteSemanal(
                    estudiante_id=est.id,
                    semana_inicio=semana_inicio,
                    semana_fin=semana_fin,
                    dias_asistio=dias_asistio,
                    dias_laborables=dias_laborables,
                    tardanzas=tardanzas,
                    faltas=faltas,
                    comunicados_pendientes=comunicados_pendientes,
                    correo_enviado=False,
                )
            )

        db.commit()
        logger.info(
            "[Reporte] Semana %s–%s: %d reportes generados (%d días laborables)",
            semana_inicio, semana_fin, len(estudiantes), dias_laborables,
        )

        # Enviar correos (se activa en TAREA 7)
        _notificar_reportes(semana_inicio, semana_fin, db)

    except Exception as exc:
        logger.error("[Reporte semanal] Error: %s", exc, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _notificar_reportes(semana_inicio: date, semana_fin: date, db):
    """Envía reportes semanales via gmail_service."""
    try:
        from services.gmail_service import enviar_reportes_semanales
        enviar_reportes_semanales(semana_inicio, semana_fin, db)
    except Exception as exc:
        logger.warning("[Reporte] Error al enviar correos: %s", exc)


# ---------------------------------------------------------------------------
# Inicialización
# ---------------------------------------------------------------------------

def init_scheduler():
    """
    Lee los horarios de la BD, programa los jobs de faltas por nivel
    y el reporte semanal, y arranca el scheduler.
    """
    if scheduler.running:
        logger.warning("[Scheduler] Ya estaba corriendo, omitiendo init")
        return

    db = _get_db()
    try:
        from models.asistencia import Horario

        horarios = db.query(Horario).all()

        for h in horarios:
            t = _parse_hora(h.hora_cierre_faltas)
            scheduler.add_job(
                registrar_faltas_nivel,
                trigger=CronTrigger(
                    hour=t.hour, minute=t.minute, timezone=TIMEZONE
                ),
                args=[h.nivel],
                id=f"faltas_{h.nivel}",
                replace_existing=True,
                misfire_grace_time=300,   # 5 min de tolerancia
            )
            logger.info(
                "[Scheduler] faltas_%s → diario %02d:%02d %s",
                h.nivel, t.hour, t.minute, TIMEZONE,
            )

    except Exception as exc:
        logger.error("[Scheduler] Error al leer horarios: %s", exc)
    finally:
        db.close()

    # Reporte semanal: viernes 18:00
    scheduler.add_job(
        generar_reportes_semanales,
        trigger=CronTrigger(day_of_week="fri", hour=18, minute=0, timezone=TIMEZONE),
        id="reporte_semanal",
        replace_existing=True,
        misfire_grace_time=1800,   # 30 min de tolerancia
    )
    logger.info("[Scheduler] reporte_semanal → viernes 18:00 %s", TIMEZONE)

    scheduler.start()
    logger.info("[Scheduler] Iniciado. Jobs activos: %d", len(scheduler.get_jobs()))
