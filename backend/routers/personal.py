"""
Router: Personal (tutor / auxiliares)
──────────────────────────────────────
Bandeja de avisos internos enviados por el directivo.

Endpoints:
  GET  /personal/avisos              → listar avisos recibidos
  GET  /personal/avisos/sin-leer     → contador de no leídos
  PUT  /personal/avisos/{id}/leer    → marcar uno como leído
  PUT  /personal/avisos/todos-leidos → marcar todos como leídos
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.dependencies import get_db, require_roles
from models.aviso import AvisoDirectivo
from models.usuario import Usuario

router = APIRouter()

ROLES_PERSONAL = ("tutor", "i-auxiliar", "p-auxiliar", "s-auxiliar")

CARGO_DIRECTIVO = {
    "inicial":    "Directora de Inicial",
    "primaria":   "Subdirector de Primaria",
    "secundaria": "Subdirector de Secundaria",
    "formacion":  "Subdir. Form. General",
    "todos":      "Director del CEAUNE",
}


# ── GET /personal/avisos ──────────────────────────────────────────────────────

@router.get("/avisos")
def mis_avisos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*ROLES_PERSONAL)),
):
    rows = (
        db.query(AvisoDirectivo, Usuario)
        .join(Usuario, AvisoDirectivo.emisor_id == Usuario.id)
        .filter(AvisoDirectivo.receptor_id == current_user.id)
        .order_by(AvisoDirectivo.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id":           a.id,
            "mensaje":      a.mensaje,
            "leido":        a.leido,
            "leido_at":     a.leido_at,
            "created_at":   a.created_at,
            "emisor":       f"{e.nombre} {e.apellido}",
            "cargo_emisor": CARGO_DIRECTIVO.get(e.nivel or "todos", "Directivo"),
        }
        for a, e in rows
    ]


# ── GET /personal/avisos/sin-leer ─────────────────────────────────────────────

@router.get("/avisos/sin-leer")
def avisos_sin_leer(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*ROLES_PERSONAL)),
):
    count = (
        db.query(func.count(AvisoDirectivo.id))
        .filter(
            AvisoDirectivo.receptor_id == current_user.id,
            AvisoDirectivo.leido == False,  # noqa: E712
        )
        .scalar()
    ) or 0
    return {"sin_leer": count}


# ── PUT /personal/avisos/{id}/leer ────────────────────────────────────────────

@router.put("/avisos/{aviso_id}/leer")
def marcar_leido(
    aviso_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*ROLES_PERSONAL)),
):
    aviso = db.query(AvisoDirectivo).filter(
        AvisoDirectivo.id == aviso_id,
        AvisoDirectivo.receptor_id == current_user.id,
    ).first()
    if not aviso:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aviso no encontrado")
    if not aviso.leido:
        aviso.leido    = True
        aviso.leido_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


# ── PUT /personal/avisos/todos-leidos ─────────────────────────────────────────

@router.put("/avisos/todos-leidos")
def marcar_todos_leidos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*ROLES_PERSONAL)),
):
    db.query(AvisoDirectivo).filter(
        AvisoDirectivo.receptor_id == current_user.id,
        AvisoDirectivo.leido == False,  # noqa: E712
    ).update({"leido": True, "leido_at": datetime.utcnow()})
    db.commit()
    return {"ok": True}
