import uuid

from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.sql import func

from database import Base


class PersonaAutorizada(Base):
    __tablename__ = "personas_autorizadas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Alumno que recogen
    estudiante_id = Column(
        String(36), ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False
    )
    # Apoderado titular que hizo la solicitud
    apoderado_id = Column(
        String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    # Datos de la persona autorizada
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    dni = Column(String(12), nullable=False)
    parentesco = Column(String(50), nullable=False)   # madre, padre, tio, abuelo, otro…
    foto_url = Column(MEDIUMTEXT, nullable=True)        # base64 JPEG — solo se ve al escanear (MEDIUMTEXT = 16 MB)

    # QR exclusivo del fotocheck — se genera cuando admin activa
    qr_token = Column(String(100), unique=True, nullable=True)

    # Estado del ciclo de vida
    estado = Column(
        Enum("pendiente", "activo", "revocado"),
        default="pendiente",
        nullable=False,
    )

    # Gestión admin
    pago_confirmado = Column(Boolean, default=False)
    precio_fotocheck = Column(String(10), nullable=True)   # ej. "5.00"
    observacion_admin = Column(Text, nullable=True)
    fotocheck_emitido_at = Column(TIMESTAMP, nullable=True)
    vigencia_hasta = Column(Date, nullable=True)           # 31/12 del año escolar

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class RecojoLog(Base):
    """Registro de cada recojo validado por el auxiliar/tutor."""
    __tablename__ = "recojo_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_autorizada_id = Column(
        String(36), ForeignKey("personas_autorizadas.id"), nullable=False
    )
    estudiante_id = Column(
        String(36), ForeignKey("estudiantes.id"), nullable=False
    )
    escaneado_por = Column(
        String(36), ForeignKey("usuarios.id"), nullable=True
    )
    observacion = Column(Text, nullable=True)

    # ── Reporte de irregularidad por apoderado ──────────────────────────────
    reportado          = Column(Boolean, default=False, nullable=False)
    reportado_motivo   = Column(Text, nullable=True)
    reportado_at       = Column(TIMESTAMP, nullable=True)

    # ── Seguridad: confirmación explícita del auxiliar ──────────────────────
    # El log se crea al escanear pero solo se activa cuando el auxiliar
    # presiona "Confirmar entrega" tras verificar visualmente a la persona.
    confirmado     = Column(Boolean, default=False, nullable=False)
    confirmado_at  = Column(TIMESTAMP, nullable=True)

    # Capa 6: foto del responsable en el momento exacto de la confirmación.
    # Inmutable — no se puede editar después de creado.
    foto_snapshot  = Column(MEDIUMTEXT, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
