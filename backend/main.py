import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import settings
from routers import auth, asistencia, estudiantes, admin, comunicados, justificaciones, apoderado, tutor, notificaciones, reportes, recojo, inicial, anuncios, login_fotos, directivo, personal

limiter = Limiter(key_func=get_remote_address)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

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
    logger.info("[Config] GMAIL_CLIENT_SECRET=%s", "OK" if settings.GMAIL_CLIENT_SECRET else "VACIO")
    logger.info("[Config] GMAIL_REFRESH_TOKEN=%s", "OK" if settings.GMAIL_REFRESH_TOKEN else "VACIO")
    logger.info("[Config] DRIVE_FOLDER_ID=%s", settings.DRIVE_FOLDER_ID or "VACIO (sube al raíz)")
    logger.info("[Config] FIREBASE_JSON=%s", "OK" if settings.FIREBASE_CREDENTIALS_JSON else "VACIO")
    # Auto-crear tablas nuevas (dispositivos_usuario, etc.)
    from database import Base, engine
    import models.dispositivo     # noqa: F401
    import models.reunion         # noqa: F401
    import models.horario_curso   # noqa: F401
    import models.horario_archivo # noqa: F401
    import models.libreta         # noqa: F401
    import models.recojo          # noqa: F401
    import models.refresh_token   # noqa: F401
    import models.audit_log       # noqa: F401
    import models.anuncio         # noqa: F401
    import models.login_foto      # noqa: F401
    import models.aviso           # noqa: F401
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
        "ALTER TABLE usuarios ADD COLUMN qr_token_inicial VARCHAR(100) UNIQUE NULL",
        # Recojo seguro — confirmación explícita + snapshot foto (capa 1 y 6)
        "ALTER TABLE recojo_logs ADD COLUMN confirmado TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE recojo_logs ADD COLUMN confirmado_at TIMESTAMP NULL",
        "ALTER TABLE recojo_logs ADD COLUMN foto_snapshot LONGTEXT NULL",
        # Reporte de irregularidad por apoderado
        "ALTER TABLE recojo_logs ADD COLUMN reportado TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE recojo_logs ADD COLUMN reportado_motivo TEXT NULL",
        "ALTER TABLE recojo_logs ADD COLUMN reportado_at TIMESTAMP NULL",
        # Fix: foto_url truncada — TEXT (64KB) → MEDIUMTEXT (16MB) para base64 JPEG
        "ALTER TABLE personas_autorizadas MODIFY COLUMN foto_url MEDIUMTEXT NULL",
        "ALTER TABLE recojo_logs MODIFY COLUMN foto_snapshot MEDIUMTEXT NULL",
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


_is_prod = settings.ENVIRONMENT == "production"

app = FastAPI(
    title="CEAUNE Asistencia API",
    version="1.0.0",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "https://ceaune.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
app.include_router(recojo.router,         prefix="/recojo",         tags=["Recojo"])
app.include_router(inicial.router,        prefix="/inicial",        tags=["Inicial"])
app.include_router(anuncios.router,       prefix="/anuncios",       tags=["Anuncios"])
app.include_router(login_fotos.router,    prefix="/login-fotos",    tags=["LoginFotos"])
app.include_router(directivo.router,      prefix="/directivo",      tags=["Directivo"])
app.include_router(personal.router,       prefix="/personal",        tags=["Personal"])


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


@app.get("/health/google", include_in_schema=False)
def health_google():
    if _is_prod:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    resultado = {
        "GMAIL_CLIENT_ID": "OK" if settings.GMAIL_CLIENT_ID else "VACIO",
        "GMAIL_CLIENT_SECRET": "OK" if settings.GMAIL_CLIENT_SECRET else "VACIO",
        "GMAIL_REFRESH_TOKEN": "OK" if settings.GMAIL_REFRESH_TOKEN else "VACIO",
        "DRIVE_FOLDER_ID": settings.DRIVE_FOLDER_ID or "(sin carpeta, se sube al raíz)",
        "gmail_token_test": None,
        "drive_token_test": None,
    }
    try:
        from services.gmail_service import _get_service as gmail_svc
        gmail_svc()
        resultado["gmail_token_test"] = "OK"
    except Exception as e:
        resultado["gmail_token_test"] = f"ERROR: {e}"

    try:
        from services.drive_service import _get_service as drive_svc
        drive_svc()
        resultado["drive_token_test"] = "OK"
    except Exception as e:
        resultado["drive_token_test"] = f"ERROR: {e}"

    return resultado
