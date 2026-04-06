import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import auth, asistencia, estudiantes, admin, comunicados, justificaciones, apoderado, tutor, notificaciones, reportes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    logger.info("[Config] GMAIL_CLIENT_ID=%s", "OK" if settings.GMAIL_CLIENT_ID else "VACIO")
    logger.info("[Config] GMAIL_REFRESH_TOKEN=%s", "OK" if settings.GMAIL_REFRESH_TOKEN else "VACIO")
    logger.info("[Config] FIREBASE_JSON=%s", "OK" if settings.FIREBASE_CREDENTIALS_JSON else "VACIO")
    # Auto-crear tablas nuevas (dispositivos_usuario, etc.)
    from database import Base, engine
    import models.dispositivo    # noqa: F401
    import models.reunion        # noqa: F401
    import models.horario_curso   # noqa: F401
    import models.horario_archivo # noqa: F401
    import models.libreta         # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Migración incremental: agrega columnas si no existen
    from sqlalchemy import text
    _nuevas_cols = [
        "ALTER TABLE estudiantes ADD COLUMN motivo_desactivacion VARCHAR(50) NULL",
        "ALTER TABLE estudiantes ADD COLUMN desactivado_en TIMESTAMP NULL",
        "ALTER TABLE estudiantes ADD COLUMN desactivado_por VARCHAR(36) NULL",
        # Salud y necesidades especiales
        "ALTER TABLE estudiantes ADD COLUMN discapacidad VARCHAR(30) NULL",
        "ALTER TABLE estudiantes ADD COLUMN discapacidad_detalle TEXT NULL",
        "ALTER TABLE estudiantes ADD COLUMN requiere_adaptacion TINYINT(1) NULL",
        "ALTER TABLE estudiantes ADD COLUMN dispositivos_apoyo TEXT NULL",
        "ALTER TABLE estudiantes ADD COLUMN tiene_alergias TINYINT(1) NULL",
        "ALTER TABLE estudiantes ADD COLUMN alergias_detalle TEXT NULL",
        "ALTER TABLE estudiantes ADD COLUMN condicion_medica TEXT NULL",
        "ALTER TABLE estudiantes ADD COLUMN medicacion_escolar TEXT NULL",
        "ALTER TABLE estudiantes ADD COLUMN protocolo_emergencia TEXT NULL",
        "ALTER TABLE usuarios ADD COLUMN es_apoderado TINYINT(1) NOT NULL DEFAULT 0",
    ]
    with engine.connect() as _conn:
        for _sql in _nuevas_cols:
            try:
                _conn.execute(text(_sql))
                _conn.commit()
            except Exception:
                pass  # La columna ya existe

    from services.scheduler import init_scheduler
    init_scheduler()
    logger.info("Backend CEAUNE listo.")
    yield
    # ── Shutdown ─────────────────────────────────────────────
    from services.scheduler import scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Detenido.")


app = FastAPI(
    title="CEAUNE Asistencia API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "https://ceaune.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/auth",       tags=["Auth"])
app.include_router(asistencia.router, prefix="/asistencia", tags=["Asistencia"])
app.include_router(estudiantes.router, prefix="/estudiantes", tags=["Estudiantes"])
app.include_router(admin.router,          prefix="/admin",          tags=["Admin"])
app.include_router(reportes.router,       prefix="/admin/reportes", tags=["Reportes"])
app.include_router(comunicados.router,    prefix="/comunicados",    tags=["Comunicados"])
app.include_router(justificaciones.router,prefix="/justificaciones",tags=["Justificaciones"])
app.include_router(apoderado.router,      prefix="/apoderado",      tags=["Apoderado"])
app.include_router(tutor.router,          prefix="/tutor",          tags=["Tutor"])
app.include_router(notificaciones.router, prefix="/notificaciones", tags=["Notificaciones"])


# ── Versión APK ──────────────────────────────────────────────────────────────
# Cuando generes una nueva APK: sube el número de version_minima y pon el link
# de Google Drive en url_apk (clic derecho → Obtener enlace → "Cualquier persona")
APK_VERSION_MINIMA = "1.0"
APK_URL = "https://drive.google.com/uc?export=download&id=REEMPLAZA_CON_TU_ID"
APK_MENSAJE = "Hay una nueva versión de CEAUNE ASISTENCIA disponible con mejoras importantes."

@app.get("/version")
def version():
    return {
        "version_minima": APK_VERSION_MINIMA,
        "url_apk": APK_URL,
        "mensaje": APK_MENSAJE,
    }


@app.get("/health")
def health():
    from services.scheduler import scheduler
    jobs = [
        {"id": j.id, "next_run": str(j.next_run_time)}
        for j in scheduler.get_jobs()
    ]
    return {"status": "ok", "env": settings.ENVIRONMENT, "scheduler_jobs": jobs}
