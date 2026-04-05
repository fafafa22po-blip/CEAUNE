import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from models.dispositivo import DispositivoUsuario
from models.usuario import Usuario

logger = logging.getLogger(__name__)
router = APIRouter()


class TokenRequest(BaseModel):
    fcm_token: str
    plataforma: str = "android"


@router.post("/registrar-dispositivo", status_code=201)
def registrar_dispositivo(
    data: TokenRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra o reactiva un token FCM para el usuario autenticado."""
    logger.info("[registrar-dispositivo] usuario=%s token=%s...", current_user.dni, data.fcm_token[:20])

    # Buscar por (token + usuario) — permite que varios usuarios compartan dispositivo
    existente = db.query(DispositivoUsuario).filter(
        DispositivoUsuario.fcm_token == data.fcm_token,
        DispositivoUsuario.usuario_id == current_user.id,
    ).first()

    if existente:
        existente.plataforma = data.plataforma
        existente.activo = True
    else:
        db.add(DispositivoUsuario(
            usuario_id=current_user.id,
            fcm_token=data.fcm_token,
            plataforma=data.plataforma,
        ))

    db.commit()
    logger.info("[registrar-dispositivo] OK para %s", current_user.dni)
    return {"ok": True}


@router.delete("/desregistrar-dispositivo", status_code=204)
def desregistrar_dispositivo(
    data: TokenRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Desactiva un token FCM (logout desde un dispositivo específico)."""
    db.query(DispositivoUsuario).filter(
        DispositivoUsuario.fcm_token == data.fcm_token,
        DispositivoUsuario.usuario_id == current_user.id,
    ).update({"activo": False})
    db.commit()


# ---------------------------------------------------------------------------
# Debug remoto (temporal)
# ---------------------------------------------------------------------------

class DebugLog(BaseModel):
    paso: str
    detalle: str = ""

@router.post("/debug-log", status_code=200)
def debug_log(data: DebugLog, current_user: Usuario = Depends(get_current_user)):
    """Recibe logs de diagnóstico push desde el frontend."""
    logger.info("[push-debug] usuario=%s paso=%s detalle=%s", current_user.dni, data.paso, data.detalle)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Diagnóstico y test
# ---------------------------------------------------------------------------

@router.get("/debug")
def debug_push(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Muestra el estado de push del usuario actual."""
    dispositivos = db.query(DispositivoUsuario).filter(
        DispositivoUsuario.usuario_id == current_user.id,
    ).all()

    from services.firebase_service import _init_firebase
    firebase_ok = _init_firebase()

    return {
        "usuario": current_user.dni,
        "rol": current_user.rol,
        "firebase_inicializado": firebase_ok,
        "dispositivos": [
            {
                "id": d.id,
                "token": d.fcm_token[:20] + "...",
                "plataforma": d.plataforma,
                "activo": d.activo,
            }
            for d in dispositivos
        ],
        "total_tokens_activos": sum(1 for d in dispositivos if d.activo),
    }


@router.post("/test-push")
def test_push(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Envía una push de prueba al usuario actual."""
    tokens = (
        db.query(DispositivoUsuario.fcm_token)
        .filter(
            DispositivoUsuario.usuario_id == current_user.id,
            DispositivoUsuario.activo == True,
        )
        .all()
    )
    token_list = [t[0] for t in tokens]

    if not token_list:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No hay tokens registrados para {current_user.dni}. "
            "El apoderado debe iniciar sesión desde la APK primero.",
        )

    from services.firebase_service import _enviar_push
    enviados = _enviar_push(
        token_list,
        "CEAUNE — Notificaciones activas",
        "Las notificaciones push están funcionando correctamente en su dispositivo.",
        {"tipo": "test"},
    )

    return {
        "tokens_encontrados": len(token_list),
        "push_enviados": enviados,
        "mensaje": "Push enviado OK" if enviados > 0 else "Firebase no pudo enviar — revisa credenciales",
    }
