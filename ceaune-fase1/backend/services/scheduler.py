"""
APScheduler — Jobs automáticos CEAUNE

Job principal:
  Cada día hábil a las 15:00 (America/Lima):
  1. Obtiene todos los estudiantes activos
  2. Filtra los que NO tienen ingreso registrado hoy
  3. Crea registro de asistencia con estado="falta"
  4. Envía correo al apoderado de cada uno
"""

import logging
import uuid
from datetime import date, datetime

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="America/Lima")


def registrar_faltas_automaticas():
    """Job diario a las 15:00 — registra faltas para alumnos sin ingreso."""
    logger.info("[Scheduler] Iniciando registro automático de faltas...")

    # Importamos aquí para evitar dependencia circular en el startup
    from database import SessionLocal
    from models.estudiante import Estudiante, ApoderadoEstudiante
    from models.asistencia import Asistencia, HorarioSecundaria
    from models.usuario import Usuario
    from services.gmail_service import enviar_correo_falta

    db = SessionLocal()
    hoy = date.today()
    ahora = datetime.now()

    try:
        # 1. Estudiantes activos
        estudiantes = db.query(Estudiante).filter(Estudiante.activo == True).all()

        # 2. IDs que YA tienen ingreso hoy
        con_ingreso = {
            row.estudiante_id
            for row in db.query(Asistencia.estudiante_id).filter(
                Asistencia.fecha == hoy,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            ).all()
        }

        # 3. IDs que YA tienen falta registrada hoy (evitar duplicados si el job corre varias veces)
        con_falta = {
            row.estudiante_id
            for row in db.query(Asistencia.estudiante_id).filter(
                Asistencia.fecha == hoy,
                Asistencia.estado == "falta",
            ).all()
        }

        faltas_creadas = 0
        correos_enviados = 0

        for est in estudiantes:
            if est.id in con_ingreso or est.id in con_falta:
                continue

            # Crear registro de falta
            registro = Asistencia(
                id=str(uuid.uuid4()),
                estudiante_id=est.id,
                auxiliar_id=None,
                fecha=hoy,
                tipo="ingreso",
                hora=ahora,
                estado="falta",
                observacion="Falta registrada automáticamente a las 15:00",
                correo_enviado=False,
            )
            db.add(registro)
            db.flush()
            faltas_creadas += 1

            # Enviar correo al apoderado
            relaciones = db.query(ApoderadoEstudiante).filter(
                ApoderadoEstudiante.estudiante_id == est.id
            ).all()

            fecha_str = hoy.strftime("%d/%m/%Y")
            for rel in relaciones:
                apoderado = db.query(Usuario).filter(Usuario.id == rel.apoderado_id).first()
                if not apoderado or not apoderado.email:
                    continue
                ok = enviar_correo_falta(
                    apoderado.email,
                    est.nombre, est.apellido,
                    fecha_str, est.grado, est.seccion,
                )
                if ok:
                    registro.correo_enviado    = True
                    registro.correo_enviado_at = ahora
                    correos_enviados += 1

        db.commit()
        logger.info(
            f"[Scheduler] Faltas: {faltas_creadas} registradas, "
            f"{correos_enviados} correos enviados."
        )

    except Exception as e:
        db.rollback()
        logger.error(f"[Scheduler] Error en registro de faltas: {e}")
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(
        registrar_faltas_automaticas,
        trigger="cron",
        hour=15,
        minute=0,
        day_of_week="mon-fri",
        id="faltas_automaticas",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] APScheduler iniciado — faltas automáticas a las 15:00 L-V")
