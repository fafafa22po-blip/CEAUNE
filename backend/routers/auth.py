import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

limiter = Limiter(key_func=get_remote_address)

from core.config import settings
from core.dependencies import get_current_user, get_db
from core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
    generar_refresh_token,
    hash_refresh_token,
    refresh_token_expiry,
)
from models.refresh_token import RefreshToken
from models.usuario import Usuario, TutorAula
from schemas.usuario import LoginRequest, PasswordChange, PerfilUpdate, RefreshRequest, Token, UsuarioResponse

router = APIRouter()
log = logging.getLogger(__name__)


def _crear_tokens(user: Usuario, db: Session) -> Token:
    """Crea access + refresh token para un usuario y persiste el refresh en BD."""
    access_token = create_access_token(
        data={"sub": user.id, "rol": user.rol, "es_apoderado": bool(user.es_apoderado)},
    )
    raw_refresh = generar_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=refresh_token_expiry(),
    ))
    db.commit()
    return Token(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(
        Usuario.dni == data.dni,
        Usuario.activo == True,
    ).first()

    if not user and not data.dni.upper().startswith("CE"):
        user = db.query(Usuario).filter(
            Usuario.dni == f"CE{data.dni}",
            Usuario.activo == True,
        ).first()

    if not user:
        log.warning("Login fallido: DNI no encontrado o inactivo")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    if not verify_password(data.password, user.password_hash):
        log.warning("Login fallido: contraseña incorrecta")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    return _crear_tokens(user, db)


@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")
def refresh(request: Request, data: RefreshRequest, db: Session = Depends(get_db)):
    """Emite un nuevo access token usando el refresh token."""
    token_hash = hash_refresh_token(data.refresh_token)
    ahora = datetime.now(timezone.utc)

    registro = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revocado == False,
    ).first()

    if not registro or registro.expires_at.replace(tzinfo=timezone.utc) < ahora:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión expirada, inicia sesión de nuevo")

    user = db.query(Usuario).filter(Usuario.id == registro.user_id, Usuario.activo == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")

    # Rotar: revocar el anterior y emitir uno nuevo en la misma transacción
    registro.revocado = True
    raw_refresh = generar_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=refresh_token_expiry(),
    ))
    db.commit()

    access_token = create_access_token(
        data={"sub": user.id, "rol": user.rol, "es_apoderado": bool(user.es_apoderado)},
    )
    return Token(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=204)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    """Revoca el refresh token (logout real)."""
    token_hash = hash_refresh_token(data.refresh_token)
    registro = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if registro:
        registro.revocado = True
        db.commit()


@router.get("/me", response_model=UsuarioResponse)
def me(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.rol == "tutor" and not current_user.nivel:
        aula = db.query(TutorAula).filter(TutorAula.tutor_id == current_user.id).first()
        if aula:
            current_user.nivel = aula.nivel
            db.commit()
    return current_user


@router.put("/perfil", response_model=UsuarioResponse)
def actualizar_perfil(
    data: PerfilUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.nombre is not None:
        current_user.nombre = data.nombre
    if data.apellido is not None:
        current_user.apellido = data.apellido
    if data.email is not None:
        existente = db.query(Usuario).filter(
            Usuario.email == data.email,
            Usuario.id != current_user.id,
        ).first()
        if existente:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado por otro usuario")
        current_user.email = data.email
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/cambiar-password", status_code=204)
def cambiar_password(
    data: PasswordChange,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.password_actual, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta")
    current_user.password_hash = get_password_hash(data.password_nuevo)
    # Revocar todos los refresh tokens del usuario al cambiar contraseña
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revocado == False,
    ).update({"revocado": True})
    db.commit()
