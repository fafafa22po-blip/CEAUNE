import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.dependencies import get_current_user, get_db
from core.security import create_access_token, get_password_hash, verify_password
from models.usuario import Usuario, TutorAula
from schemas.usuario import LoginRequest, PasswordChange, PerfilUpdate, Token, UsuarioResponse

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # Buscar por DNI exacto primero, luego con prefijo CE (personal institucional)
    user = db.query(Usuario).filter(
        Usuario.dni == data.dni,
        Usuario.activo == True,
    ).first()

    # Si no encontró y el DNI no empieza con CE, probar CE+DNI (auxiliares/tutores/admin)
    if not user and not data.dni.upper().startswith("CE"):
        user = db.query(Usuario).filter(
            Usuario.dni == f"CE{data.dni}",
            Usuario.activo == True,
        ).first()

    if not user:
        log.warning("Login fallido: DNI '%s' no encontrado o inactivo", data.dni)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    if not verify_password(data.password, user.password_hash):
        log.warning("Login fallido: contraseña incorrecta para DNI '%s'", data.dni)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    expire_seconds = settings.JWT_EXPIRE_HOURS * 3600
    token = create_access_token(
        data={"sub": user.id, "rol": user.rol, "es_apoderado": bool(user.es_apoderado)},
        expires_delta=timedelta(seconds=expire_seconds),
    )
    return Token(access_token=token, token_type="bearer", expires_in=expire_seconds)


@router.get("/me", response_model=UsuarioResponse)
def me(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    # Para tutores, poblar nivel desde tutores_aulas si no está en usuarios
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado por otro usuario",
            )
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta",
        )
    current_user.password_hash = get_password_hash(data.password_nuevo)
    db.commit()
