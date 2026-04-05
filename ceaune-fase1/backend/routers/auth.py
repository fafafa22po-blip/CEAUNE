from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.usuario import Usuario
from schemas.usuario import LoginRequest, TokenResponse, UsuarioOut
from core.security import verify_password, create_access_token
from core.dependencies import get_current_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.dni == data.dni, Usuario.activo == True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="DNI o contraseña incorrectos",
        )
    token = create_access_token({"sub": user.id, "rol": user.rol})
    return TokenResponse(access_token=token, usuario=UsuarioOut.model_validate(user))


@router.get("/me", response_model=UsuarioOut)
def me(current_user: Usuario = Depends(get_current_user)):
    return UsuarioOut.model_validate(current_user)
