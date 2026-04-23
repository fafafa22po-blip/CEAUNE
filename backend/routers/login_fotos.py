import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from core.dependencies import get_db, require_roles
from models.login_foto import LoginFoto
from models.usuario import Usuario

router = APIRouter()


# ── Listar fotos (público — usado por la pantalla de login) ───────────────────

@router.get("/")
def listar_fotos(db: Session = Depends(get_db)):
    fotos = db.query(LoginFoto).order_by(LoginFoto.created_at).all()
    return [{"id": f.id} for f in fotos]


# ── Proxy imagen (público) ────────────────────────────────────────────────────

@router.get("/imagen/{foto_id}")
def imagen_foto(foto_id: str, db: Session = Depends(get_db)):
    f = db.query(LoginFoto).filter(LoginFoto.id == foto_id).first()
    if not f:
        raise HTTPException(404, "Foto no encontrada")
    file_id = _file_id_from_url(f.imagen_url)
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


# ── Subir foto (solo admin) ───────────────────────────────────────────────────

@router.post("/subir", status_code=201)
async def subir_foto(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    if not archivo.content_type or not archivo.content_type.startswith("image/"):
        raise HTTPException(400, "Solo se permiten imágenes")
    contenido = await archivo.read()
    if len(contenido) > 10 * 1024 * 1024:
        raise HTTPException(400, "La imagen no puede superar 10 MB")
    try:
        from services.drive_service import subir_archivo
        resultado = subir_archivo(contenido, archivo.filename, archivo.content_type)
        file_id = resultado.get("file_id", "")
    except Exception as e:
        raise HTTPException(500, str(e))

    foto = LoginFoto(
        id=str(uuid.uuid4()),
        imagen_url=file_id,
        imagen_nombre=resultado.get("nombre", archivo.filename),
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return {"id": foto.id}


# ── Eliminar foto (solo admin) ────────────────────────────────────────────────

@router.delete("/{foto_id}", status_code=204)
def eliminar_foto(
    foto_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles("admin")),
):
    f = db.query(LoginFoto).filter(LoginFoto.id == foto_id).first()
    if not f:
        raise HTTPException(404, "Foto no encontrada")
    db.delete(f)
    db.commit()


# ── Helper ────────────────────────────────────────────────────────────────────

def _file_id_from_url(url: str) -> str:
    if not url:
        return ""
    m = re.search(r'lh3\.googleusercontent\.com/d/([^/?]+)', url)
    if m: return m.group(1)
    m = re.search(r'[?&]id=([^&]+)', url)
    if m: return m.group(1)
    m = re.search(r'/file/d/([^/]+)', url)
    if m: return m.group(1)
    return url
