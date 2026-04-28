from datetime import date
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.dependencies import get_current_user, get_db, require_roles
from core.tz import hoy as _hoy
from models.anuncio import Anuncio
from models.usuario import Usuario

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class AnuncioCreate(BaseModel):
    titulo:       Optional[str] = None
    imagen_url:   str
    imagen_nombre: Optional[str] = None
    nivel:        str = "todos"
    fecha_inicio: date
    fecha_fin:    date


class AnuncioOut(BaseModel):
    id:            str
    titulo:        Optional[str]
    imagen_url:    str
    nivel:         str
    fecha_inicio:  date
    fecha_fin:     date
    activo:        bool
    created_at:    str

    class Config:
        from_attributes = True


# ── Subir imagen a Drive ─────────────────────────────────────────────────────

@router.post("/subir-imagen")
async def subir_imagen(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(require_roles("admin")),
):
    contenido = await archivo.read()
    mime = archivo.content_type or "image/jpeg"
    try:
        from services.drive_service import subir_archivo
        resultado = subir_archivo(contenido, archivo.filename, mime)
        file_id = resultado.get("file_id", "")
        return {"url": file_id, "nombre": resultado.get("nombre", archivo.filename)}
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))


# ── Crear anuncio ────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def crear_anuncio(
    data: AnuncioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    if data.nivel not in ("todos", "inicial", "primaria", "secundaria"):
        raise HTTPException(400, "Nivel inválido")
    if data.fecha_fin < data.fecha_inicio:
        raise HTTPException(400, "La fecha de fin debe ser posterior al inicio")

    anuncio = Anuncio(
        id            = str(uuid.uuid4()),
        titulo        = data.titulo,
        imagen_url    = data.imagen_url,
        imagen_nombre = data.imagen_nombre,
        nivel         = data.nivel,
        fecha_inicio  = data.fecha_inicio,
        fecha_fin     = data.fecha_fin,
        activo        = True,
        autor_id      = current_user.id,
    )
    db.add(anuncio)
    db.commit()
    db.refresh(anuncio)
    return _fmt(anuncio)


# ── Listar todos (admin) ─────────────────────────────────────────────────────

@router.get("/admin")
def listar_anuncios_admin(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    items = db.query(Anuncio).order_by(Anuncio.created_at.desc()).all()
    return [_fmt(a) for a in items]


# ── Listar activos (apoderado) ───────────────────────────────────────────────

@router.get("/activos")
def listar_activos(
    nivel: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    hoy = _hoy()
    q = db.query(Anuncio).filter(
        Anuncio.activo == True,
        Anuncio.fecha_inicio <= hoy,
        Anuncio.fecha_fin >= hoy,
    )
    if nivel:
        q = q.filter(Anuncio.nivel.in_(["todos", nivel]))
    return [_fmt(a) for a in q.order_by(Anuncio.created_at.desc()).all()]


# ── Activar / desactivar ─────────────────────────────────────────────────────

@router.patch("/{anuncio_id}/toggle")
def toggle_anuncio(
    anuncio_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    a = db.query(Anuncio).filter(Anuncio.id == anuncio_id).first()
    if not a:
        raise HTTPException(404, "Anuncio no encontrado")
    a.activo = not a.activo
    db.commit()
    return _fmt(a)


# ── Eliminar ─────────────────────────────────────────────────────────────────

@router.delete("/{anuncio_id}", status_code=204)
def eliminar_anuncio(
    anuncio_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    a = db.query(Anuncio).filter(Anuncio.id == anuncio_id).first()
    if not a:
        raise HTTPException(404, "Anuncio no encontrado")
    db.delete(a)
    db.commit()


# ── Proxy imagen (sirve la imagen desde Drive sin exponer URLs de Drive) ──────

def _file_id_from_url(url: str) -> str:
    """Extrae el file_id de cualquier formato de URL de Drive, o devuelve el valor tal cual."""
    if not url:
        return ""
    m = re.search(r'lh3\.googleusercontent\.com/d/([^/?]+)', url)
    if m: return m.group(1)
    m = re.search(r'[?&]id=([^&]+)', url)
    if m: return m.group(1)
    m = re.search(r'/file/d/([^/]+)', url)
    if m: return m.group(1)
    return url  # ya es un file_id


@router.get("/imagen/{anuncio_id}")
def imagen_anuncio(anuncio_id: str, db: Session = Depends(get_db)):
    a = db.query(Anuncio).filter(Anuncio.id == anuncio_id).first()
    if not a:
        raise HTTPException(404, "Anuncio no encontrado")
    file_id = _file_id_from_url(a.imagen_url)
    if not file_id:
        raise HTTPException(404, "Sin imagen")
    try:
        from services.drive_service import descargar_archivo
        content, mime = descargar_archivo(file_id)
    except Exception as e:
        raise HTTPException(500, str(e))
    return Response(
        content=content,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ── Helper ───────────────────────────────────────────────────────────────────

def _fmt(a: Anuncio) -> dict:
    return {
        "id":           a.id,
        "titulo":       a.titulo,
        "imagen_url":   a.imagen_url,
        "nivel":        a.nivel,
        "fecha_inicio": str(a.fecha_inicio),
        "fecha_fin":    str(a.fecha_fin),
        "activo":       a.activo,
        "created_at":   str(a.created_at),
    }
