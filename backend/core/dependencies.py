from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from database import SessionLocal
from core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    from models.usuario import Usuario

    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        rol_en_token: str = payload.get("rol")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()
    if not user:
        raise exc

    # Verificación dinámica: si el rol cambió en BD desde que se emitió el token, rechazar
    if user.rol != rol_en_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Permisos revocados, inicia sesión de nuevo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*roles: str):
    """Decorador de dependencia para verificar roles."""
    def checker(current_user=Depends(get_current_user)):
        if current_user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return current_user
    return checker
