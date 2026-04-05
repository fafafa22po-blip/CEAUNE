from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from database import engine, Base
from routers import auth, asistencia, estudiantes, apoderado, comunicados, usuarios


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    from services.scheduler import start_scheduler
    start_scheduler()
    yield
    # Shutdown


app = FastAPI(
    title="CEAUNE Asistencia API",
    description="Sistema de control de asistencia — Secundaria CEAUNE",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(asistencia.router, prefix="/asistencia", tags=["asistencia"])
app.include_router(estudiantes.router, prefix="/estudiantes", tags=["estudiantes"])
app.include_router(apoderado.router, prefix="/apoderado", tags=["apoderado"])
app.include_router(comunicados.router, prefix="/comunicados", tags=["comunicados"])
app.include_router(usuarios.router,   prefix="/usuarios",   tags=["usuarios"])


@app.get("/")
def root():
    return {"status": "ok", "app": "CEAUNE Asistencia API v1.0"}
