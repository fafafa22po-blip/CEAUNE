"""
Router del tutor de aula.
Acceso a su aula, estudiantes con asistencia del día y registro de observaciones.
"""
import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta
from io import BytesIO
from typing import List, Optional

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from models.audit_log import AuditLog
from models.asistencia import Asistencia
from models.comunicado import (
    Comunicado, ComunicadoDestinatario, ComunicadoRespuesta, ObservacionTutor,
)
from models.estudiante import ApoderadoEstudiante, Estudiante
from models.libreta import Libreta
from models.usuario import TutorAula, Usuario
from schemas.comunicado import (
    BandejaRespuestasResponse, ComunicadoResponse,
    DestinatarioResponse, RespuestaInboxItem, RespuestaResponse,
)
from schemas.dia_no_laborable import ObservacionCreate, ObservacionResponse
from schemas.estudiante import EstudianteBasico

router = APIRouter()


def _verificar_tutor(current_user: Usuario) -> None:
    if current_user.rol != "tutor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo tutores")


def _get_tutor_aula(tutor_id: str, db: Session) -> TutorAula:
    vinculo = db.query(TutorAula).filter(TutorAula.tutor_id == tutor_id).first()
    if not vinculo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No tienes un aula asignada")
    return vinculo


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula
# ---------------------------------------------------------------------------

@router.get("/mi-aula")
def mi_aula(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)
    return {
        "nivel": vinculo.nivel,
        "grado": vinculo.grado,
        "seccion": vinculo.seccion,
    }


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/estudiantes  — lista con asistencia de hoy
# ---------------------------------------------------------------------------

@router.get("/mi-aula/estudiantes")
def estudiantes_aula(
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = fecha or date.today()

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )

    ids = [e.id for e in estudiantes]
    todas_hoy = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.fecha == hoy,
        )
        .order_by(Asistencia.hora.asc())
        .all()
    )

    # Agrupar por estudiante
    por_est: dict = {e.id: [] for e in estudiantes}
    for a in todas_hoy:
        if a.estudiante_id in por_est:
            por_est[a.estudiante_id].append(a)

    result = []
    for est in estudiantes:
        asistencias_hoy = por_est[est.id]

        registros = [
            {
                "id": a.id,
                "tipo": a.tipo,
                "estado": a.estado,
                "hora": a.hora.isoformat() if a.hora else None,
                "observacion": a.observacion,
            }
            for a in asistencias_hoy
        ]

        ingreso = next(
            (a for a in asistencias_hoy if a.tipo in ("ingreso", "ingreso_especial")),
            None,
        )
        if ingreso:
            estado_dia = ingreso.estado  # puntual | tardanza | especial
        else:
            estado_dia = "falta"

        result.append({
            "id": est.id,
            "nombre": est.nombre,
            "apellido": est.apellido,
            "dni": est.dni,
            "estado_dia": estado_dia,
            "registros_hoy": registros,
        })

    return {"fecha": hoy.isoformat(), "estudiantes": result}


# ---------------------------------------------------------------------------
# POST /tutor/observaciones
# ---------------------------------------------------------------------------

@router.post("/observaciones", response_model=ObservacionResponse, status_code=201)
def crear_observacion(
    data: ObservacionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)

    vinculo = _get_tutor_aula(current_user.id, db)
    est = db.query(Estudiante).filter(Estudiante.id == data.estudiante_id).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    if (
        est.nivel != vinculo.nivel
        or est.grado != vinculo.grado
        or est.seccion != vinculo.seccion
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El estudiante no es de tu aula")

    TIPOS_VALIDOS = {"academica", "conductual", "salud", "logro", "otro"}
    if data.tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Tipo debe ser uno de: {', '.join(sorted(TIPOS_VALIDOS))}",
        )

    obs = ObservacionTutor(
        tutor_id=current_user.id,
        estudiante_id=data.estudiante_id,
        tipo=data.tipo,
        descripcion=data.descripcion,
        enviar_a_apoderado=data.enviar_a_apoderado,
        correo_enviado=False,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    if data.enviar_a_apoderado:
        try:
            from services.gmail_service import notificar_observacion_bg
            notificar_observacion_bg(obs.id)
        except Exception:
            pass
        try:
            from services.firebase_service import push_observacion_bg
            push_observacion_bg(obs.id)
        except Exception:
            pass

    return ObservacionResponse.model_validate(obs)


# ---------------------------------------------------------------------------
# GET /tutor/observaciones
# ---------------------------------------------------------------------------

@router.get("/observaciones", response_model=List[ObservacionResponse])
def listar_observaciones(
    estudiante_id: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)

    offset = (pagina - 1) * por_pagina
    q = db.query(ObservacionTutor).filter(ObservacionTutor.tutor_id == current_user.id)
    if estudiante_id:
        q = q.filter(ObservacionTutor.estudiante_id == estudiante_id)
    if tipo:
        q = q.filter(ObservacionTutor.tipo == tipo)

    obs_list = (
        q.order_by(ObservacionTutor.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    return [ObservacionResponse.model_validate(obs) for obs in obs_list]


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/historial  — grilla de asistencia últimos N días
# ---------------------------------------------------------------------------

@router.get("/mi-aula/historial")
def historial_aula(
    dias: int = Query(14, ge=5, le=60),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = date.today()
    fecha_inicio = hoy - timedelta(days=dias - 1)

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )

    ids = [e.id for e in estudiantes]
    asistencias = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.fecha >= fecha_inicio,
            Asistencia.fecha <= hoy,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        )
        .all()
    )

    _PRIO = {"tardanza": 3, "presente": 2, "falta": 1}

    mapa = {}
    for a in asistencias:
        f = a.fecha.isoformat()
        est_map = mapa.setdefault(a.estudiante_id, {})
        if a.estado == "tardanza":
            estado_mapped = "tardanza"
        elif a.estado == "falta":
            estado_mapped = "falta"
        else:
            estado_mapped = "presente"
        if _PRIO.get(estado_mapped, 0) > _PRIO.get(est_map.get(f), 0):
            est_map[f] = estado_mapped

    # Fechas L-V excluyendo DNL (misma lógica que el resto de roles)
    from services.asistencia_calc import get_fechas_laborables
    fechas = get_fechas_laborables(
        vinculo.nivel, vinculo.grado, vinculo.seccion, fecha_inicio, hoy, db
    )

    result = []
    for est in estudiantes:
        dias_est = {f: mapa.get(est.id, {}).get(f, "falta") for f in fechas}
        result.append({
            "id":       est.id,
            "nombre":   est.nombre,
            "apellido": est.apellido,
            "dias":     dias_est,
        })

    return {"fechas": fechas, "estudiantes": result}


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/estadisticas  — resumen mensual por alumno
# ---------------------------------------------------------------------------

@router.get("/mi-aula/estadisticas")
def estadisticas_aula(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = date.today()
    mes_actual  = mes  or hoy.month
    anio_actual = anio or hoy.year

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )

    from services.asistencia_calc import calcular_resumen_mes_aula
    batch = calcular_resumen_mes_aula(
        estudiantes, vinculo.nivel, vinculo.grado, vinculo.seccion,
        mes_actual, anio_actual, db,
    )

    result = []
    for est in estudiantes:
        r = batch["por_alumno"].get(est.id, {
            "pct": 100, "presentes": 0, "tardanzas": 0, "asistidos": 0, "faltas": 0,
        })
        result.append({
            "id":              est.id,
            "nombre":          est.nombre,
            "apellido":        est.apellido,
            "presentes":       r["presentes"],
            "tardanzas":       r["tardanzas"],
            "faltas":          r["faltas"],
            "dias_laborables": batch["dias_lab"],
            "porcentaje":      r["pct"],
        })

    # Días laborables transcurridos hasta hoy (para calcular riesgo real)
    from services.asistencia_calc import get_fechas_laborables
    hoy_r = date.today()
    inicio_r = date(mes_actual, 1, 1).replace(year=anio_actual)
    hasta_r  = min(date(anio_actual, mes_actual, monthrange(anio_actual, mes_actual)[1]), hoy_r)
    dias_transcurridos = len(get_fechas_laborables(vinculo.nivel, vinculo.grado, vinculo.seccion, inicio_r, hasta_r, db))

    return {
        "mes":                mes_actual,
        "anio":               anio_actual,
        "dias_laborables":    batch["dias_lab"],
        "dias_transcurridos": dias_transcurridos,
        "estudiantes":        sorted(result, key=lambda x: x["porcentaje"]),
    }


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/estadisticas-pdf  — PDF del resumen mensual del aula
# ---------------------------------------------------------------------------

@router.get("/mi-aula/estadisticas-pdf")
def estadisticas_pdf(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = date.today()
    mes_q  = mes  or hoy.month
    anio_q = anio or hoy.year

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )

    from services.asistencia_calc import calcular_resumen_mes_aula
    batch = calcular_resumen_mes_aula(
        estudiantes, vinculo.nivel, vinculo.grado, vinculo.seccion,
        mes_q, anio_q, db,
    )
    dias_lab = batch["dias_lab"]

    result = []
    for est in estudiantes:
        r = batch["por_alumno"].get(est.id, {
            "pct": 100, "presentes": 0, "tardanzas": 0, "asistidos": 0, "faltas": 0,
        })
        result.append({
            "nombre":          est.nombre,
            "apellido":        est.apellido,
            "presentes":       r["presentes"],
            "tardanzas":       r["tardanzas"],
            "faltas":          r["faltas"],
            "dias_laborables": dias_lab,
            "porcentaje":      r["pct"],
        })

    # Ordenar alfabéticamente para el PDF
    result.sort(key=lambda x: (x["apellido"], x["nombre"]))

    pdf_bytes = _generar_pdf_estadisticas_aula(
        tutor=current_user,
        vinculo=vinculo,
        mes_q=mes_q,
        anio_q=anio_q,
        dias_lab=dias_lab,
        estudiantes=result,
        generado=hoy,
    )

    nombre_mes = _MESES_ES[mes_q - 1]
    nombre = f"Asistencia_{vinculo.grado}{vinculo.seccion}_{nombre_mes}{anio_q}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


def _generar_pdf_estadisticas_aula(
    *,
    tutor,
    vinculo,
    mes_q: int,
    anio_q: int,
    dias_lab: int,
    estudiantes: list,
    generado: date,
) -> bytes:
    from io import BytesIO as _BytesIO
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import HRFlowable, SimpleDocTemplate, Spacer, Table, TableStyle
    from reportlab.platypus import Paragraph as P

    # ── Colores ───────────────────────────────────────────────────────────
    MARINO  = HexColor("#0a1f3d")
    DORADO  = HexColor("#c9a227")
    C_GREEN = HexColor("#16a34a")
    C_AMBER = HexColor("#d97706")
    C_RED   = HexColor("#dc2626")
    C_LGRAY = HexColor("#f1f5f9")
    C_MGRAY = HexColor("#64748b")
    C_BORD  = HexColor("#e2e8f0")
    BG_GREEN = HexColor("#f0fdf4")
    BG_AMBER = HexColor("#fffbeb")
    BG_RED   = HexColor("#fef2f2")

    def _pct_color(p):
        if p >= 90: return C_GREEN
        if p >= 75: return C_AMBER
        return C_RED

    def _pct_bg(p):
        if p >= 90: return BG_GREEN
        if p >= 75: return BG_AMBER
        return BG_RED

    def _ps(name, **kw):
        defaults = dict(fontName="Helvetica", fontSize=9,
                        textColor=HexColor("#1e293b"), leading=13)
        defaults.update(kw)
        return ParagraphStyle(name, **defaults)

    S_BODY    = _ps("body")
    S_SECTION = _ps("section", fontName="Helvetica-Bold", fontSize=8,
                    textColor=MARINO, leading=11, spaceAfter=3)
    S_FOOTER  = _ps("footer",  fontSize=7, textColor=C_MGRAY,
                    alignment=TA_CENTER, leading=10)
    S_WHITE_B = _ps("whiteb",  fontName="Helvetica-Bold", fontSize=8,
                    textColor=white, leading=11)
    S_WHITE_S = _ps("whites",  fontSize=7.5, textColor=white, leading=11)

    import base64
    from reportlab.platypus import Image as RLImage

    # Cargar logo
    _logo_path = Path(__file__).parent.parent / "logo_b64.txt"
    try:
        from reportlab.lib.utils import ImageReader
        _logo_b64   = _logo_path.read_text().strip()
        _logo_bytes = base64.b64decode(_logo_b64)
        _iw, _ih    = ImageReader(BytesIO(_logo_bytes)).getSize()
        _target_h   = 1.8 * cm
        _target_w   = _target_h * (_iw / _ih)
        _logo_img   = RLImage(BytesIO(_logo_bytes), width=_target_w, height=_target_h)
    except Exception:
        _logo_img = None

    buf = _BytesIO()
    W, _ = A4
    margin   = 1.8 * cm
    usable_w = W - 2 * margin

    nivel_label = {
        "inicial": "Inicial", "primaria": "Primaria", "secundaria": "Secundaria",
    }.get(vinculo.nivel, vinculo.nivel.capitalize())
    mes_label   = _MESES_ES[mes_q - 1]
    tutor_str   = _safe(f"{tutor.nombre} {tutor.apellido}")
    aula_str    = _safe(f"{nivel_label}  |  {vinculo.grado}.deg Grado  Secc. {vinculo.seccion}")

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=1.2 * cm, bottomMargin=1.8 * cm,
        title=_safe(f"Asistencia {vinculo.grado}{vinculo.seccion} {mes_label} {anio_q}"),
    )
    story = []

    # ── 1. ENCABEZADO ─────────────────────────────────────────────────────
    _logo_cell = _logo_img if _logo_img else P(
        "CEAUNE", _ps("logo", fontName="Helvetica-Bold", fontSize=16, textColor=DORADO, leading=20)
    )
    hdr = Table([[
        _logo_cell,
        P(
            "<font size='8' color='#c9a227'><b>UNIVERSIDAD NACIONAL DE EDUCACIÓN ENRIQUE GUZMÁN Y VALLE</b></font><br/>"
            "<font size='12'><b>COLEGIO EXPERIMENTAL DE APLICACIÓN</b></font><br/>"
            "<font size='7'>I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED</font><br/>"
            "<font size='7'>Modelo Educativo: Jornada Escolar Completa con Formación Técnica</font>",
            _ps("inst", fontName="Helvetica-Bold", fontSize=12,
                 textColor=white, leading=14, alignment=TA_CENTER),
        ),
        P(
            f"Generado el<br/><b>{generado.strftime('%d/%m/%Y')}</b>",
            _ps("hdate", fontSize=8, textColor=HexColor("#93c5fd"),
                 leading=12, alignment=TA_RIGHT),
        ),
    ]], colWidths=[3.5 * cm, usable_w - 7 * cm, 3.5 * cm])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), MARINO),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (0,  -1), 14),
        ("RIGHTPADDING",  (-1, 0), (-1, -1), 14),
    ]))
    sub = Table([[
        P("RESUMEN DE ASISTENCIA MENSUAL",
          _ps("sub", fontName="Helvetica-Bold", fontSize=10,
               textColor=MARINO, leading=13, alignment=TA_CENTER)),
    ]], colWidths=[usable_w])
    sub.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DORADO),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    story.append(hdr)
    story.append(sub)
    story.append(Spacer(1, 0.45 * cm))

    # ── 2. INFO DE AULA ───────────────────────────────────────────────────
    info_t = Table([[
        P(f"<b>Aula:</b>  {aula_str}",      _ps("info1", fontSize=9, leading=12)),
        P(f"<b>Tutor:</b>  {tutor_str}",    _ps("info2", fontSize=9, leading=12, alignment=TA_CENTER)),
        P(f"<b>Periodo:</b>  {mes_label} {anio_q}",
          _ps("info3", fontSize=9, leading=12, alignment=TA_RIGHT)),
    ]], colWidths=[usable_w / 3] * 3)
    info_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_LGRAY),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(info_t)
    story.append(Spacer(1, 0.35 * cm))

    # ── 3. KPIs ───────────────────────────────────────────────────────────
    total     = len(estudiantes)
    promedio  = round(sum(e["porcentaje"] for e in estudiantes) / total, 1) if total else 0
    en_riesgo = sum(1 for e in estudiantes if e["porcentaje"] < 75)
    sin_faltas = sum(1 for e in estudiantes if e["faltas"] == 0)

    def _kpi_cell(valor, etiqueta, color):
        return [
            P(str(valor), _ps(f"kpiv{valor}", fontName="Helvetica-Bold", fontSize=22,
                               textColor=color, leading=26, alignment=TA_CENTER)),
            P(etiqueta,   _ps(f"kpil{valor}", fontSize=8, textColor=C_MGRAY,
                               leading=10, alignment=TA_CENTER)),
        ]

    kpi_t = Table([
        [
            Table([_kpi_cell(f"{promedio}%",  "Promedio del aula",  _pct_color(promedio))],
                  colWidths=[usable_w / 4]),
            Table([_kpi_cell(total,            "Total alumnos",      MARINO)],
                  colWidths=[usable_w / 4]),
            Table([_kpi_cell(en_riesgo,        "En riesgo (<75%)",
                              C_RED if en_riesgo else C_MGRAY)],
                  colWidths=[usable_w / 4]),
            Table([_kpi_cell(sin_faltas,       "Sin faltas",
                              C_GREEN if sin_faltas else C_MGRAY)],
                  colWidths=[usable_w / 4]),
        ]
    ], colWidths=[usable_w / 4] * 4)
    kpi_t.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(kpi_t)
    story.append(Spacer(1, 0.4 * cm))

    # ── 4. TABLA DE ESTUDIANTES ───────────────────────────────────────────
    story.append(P("DETALLE POR ESTUDIANTE", S_SECTION))

    col_n  = usable_w * 0.38   # Apellido, Nombre
    col_p  = usable_w * 0.12   # Presentes
    col_t  = usable_w * 0.12   # Tardanzas
    col_f  = usable_w * 0.12   # Faltas
    col_d  = usable_w * 0.13   # Días hab.
    col_pc = usable_w * 0.13   # %

    rows = [[
        P("Apellido, Nombre",   S_WHITE_B),
        P("Presentes",          S_WHITE_B),
        P("Tardanzas",          S_WHITE_B),
        P("Faltas",             S_WHITE_B),
        P("Dias hab.",          S_WHITE_B),
        P("%",                  S_WHITE_B),
    ]]
    row_bgs = [MARINO]

    for i, est in enumerate(estudiantes):
        pct  = est["porcentaje"]
        c    = _pct_color(pct)
        bg   = _pct_bg(pct) if pct < 90 else (C_LGRAY if i % 2 == 0 else white)
        rows.append([
            P(_safe(f"{est['apellido']}, {est['nombre']}"),
              _ps(f"rn{i}", fontSize=8, leading=11)),
            P(str(est["presentes"]),
              _ps(f"rp{i}", fontSize=8, leading=11, alignment=TA_CENTER)),
            P(str(est["tardanzas"]) if est["tardanzas"] else "-",
              _ps(f"rt{i}", fontSize=8, leading=11, alignment=TA_CENTER,
                   textColor=C_AMBER if est["tardanzas"] else C_MGRAY)),
            P(str(est["faltas"]) if est["faltas"] else "-",
              _ps(f"rf{i}", fontSize=8, leading=11, alignment=TA_CENTER,
                   textColor=C_RED if est["faltas"] else C_MGRAY)),
            P(str(est["dias_laborables"]),
              _ps(f"rd{i}", fontSize=8, leading=11, alignment=TA_CENTER,
                   textColor=C_MGRAY)),
            P(f"{pct}%",
              _ps(f"rpc{i}", fontName="Helvetica-Bold", fontSize=8, leading=11,
                   alignment=TA_CENTER, textColor=c)),
        ])
        row_bgs.append(bg)

    tbl = Table(rows, colWidths=[col_n, col_p, col_t, col_f, col_d, col_pc],
                repeatRows=1)
    ts  = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), MARINO),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, C_BORD),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
    ])
    for idx, bg in enumerate(row_bgs):
        ts.add("BACKGROUND", (0, idx), (-1, idx), bg)
    tbl.setStyle(ts)
    story.append(tbl)
    story.append(Spacer(1, 0.4 * cm))

    # ── 5. LEYENDA ────────────────────────────────────────────────────────
    leyenda_t = Table([[
        P("LEYENDA:", _ps("ley0", fontName="Helvetica-Bold", fontSize=7.5,
                           textColor=MARINO, leading=10)),
        P("Verde = Excelente (>= 90%)", _ps("ley1", fontSize=7.5,
                                              textColor=C_GREEN, leading=10)),
        P("Amarillo = Atencion (75-89%)", _ps("ley2", fontSize=7.5,
                                               textColor=C_AMBER, leading=10)),
        P("Rojo = En riesgo (< 75%)", _ps("ley3", fontSize=7.5,
                                           textColor=C_RED, leading=10)),
        P(f"Dias hab. del mes: {dias_lab}", _ps("ley4", fontSize=7.5,
                                                  textColor=C_MGRAY, leading=10)),
    ]], colWidths=[2.5 * cm, 3.8 * cm, 4.0 * cm, 3.5 * cm, usable_w - 13.8 * cm])
    leyenda_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_LGRAY),
        ("BOX",           (0, 0), (-1, -1), 0.3, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(leyenda_t)
    story.append(Spacer(1, 0.3 * cm))

    # ── 6. PIE ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=C_BORD))
    story.append(Spacer(1, 0.15 * cm))
    story.append(P(
        f"CEAUNE - Sistema de Seguimiento Estudiantil  |  "
        f"Documento generado el {generado.strftime('%d/%m/%Y')}  |  "
        f"Tutor: {tutor_str}",
        S_FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/apoderados  — todos los alumnos con sus apoderados
# ---------------------------------------------------------------------------

@router.get("/mi-aula/apoderados")
def apoderados_aula(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )

    result = []
    for est in estudiantes:
        apoderados = (
            db.query(Usuario)
            .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == Usuario.id)
            .filter(ApoderadoEstudiante.estudiante_id == est.id, Usuario.activo == True)
            .all()
        )
        result.append({
            "id": est.id,
            "nombre": est.nombre,
            "apellido": est.apellido,
            "apoderados": [
                {"id": a.id, "nombre": f"{a.nombre} {a.apellido}", "telefono": a.telefono}
                for a in apoderados
            ],
        })
    return result


# ---------------------------------------------------------------------------
# GET /tutor/estudiante/{estudiante_id}/seguimiento  — timeline mensual
# ---------------------------------------------------------------------------

@router.get("/estudiante/{estudiante_id}/seguimiento")
def seguimiento_estudiante(
    estudiante_id: str,
    mes:  Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    est = db.query(Estudiante).filter(
        Estudiante.id == estudiante_id, Estudiante.activo == True
    ).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    if est.nivel != vinculo.nivel or est.grado != vinculo.grado or est.seccion != vinculo.seccion:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El estudiante no es de tu aula")

    hoy    = date.today()
    mes_q  = mes  or hoy.month
    anio_q = anio or hoy.year
    inicio = date(anio_q, mes_q, 1)
    fin    = date(anio_q, mes_q, monthrange(anio_q, mes_q)[1])
    hasta  = min(fin, hoy)

    # días laborables del período
    dias_lab = [
        inicio + timedelta(days=i)
        for i in range((hasta - inicio).days + 1)
        if (inicio + timedelta(days=i)).weekday() < 5
    ]

    # asistencias del período (solo ingreso)
    asistencias = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            Asistencia.fecha >= inicio,
            Asistencia.fecha <= hasta,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        )
        .all()
    )

    # mapa fecha → mejor registro del día
    mapa_asist = {}
    for a in asistencias:
        f = a.fecha
        if f not in mapa_asist or a.estado == "tardanza":
            mapa_asist[f] = a

    # estadísticas mensuales — servicio centralizado (misma lógica que la lista)
    from services.asistencia_calc import calcular_resumen_mes
    _calc       = calcular_resumen_mes(estudiante_id, est.nivel, est.grado, est.seccion, mes_q, anio_q, db)
    n_presentes = _calc["presentes"]
    n_tardanzas = _calc["tardanzas"]
    n_faltas    = _calc["faltas"]
    pct         = _calc["pct"]

    # construir eventos
    eventos = []

    for d in dias_lab:
        if d in mapa_asist:
            a = mapa_asist[d]
            if a.estado == "tardanza":
                eventos.append({
                    "id": a.id, "tipo": "tardanza",
                    "fecha": d.isoformat(),
                    "hora":  a.hora.isoformat() if a.hora else None,
                    "detalle": {"observacion": a.observacion},
                })
        elif d <= hoy:
            eventos.append({
                "id": f"falta-{d.isoformat()}", "tipo": "falta",
                "fecha": d.isoformat(), "hora": None, "detalle": {},
            })

    # observaciones del tutor para este alumno en el período
    obs_fin = datetime(anio_q, mes_q, monthrange(anio_q, mes_q)[1], 23, 59, 59)
    obs_list = (
        db.query(ObservacionTutor)
        .filter(
            ObservacionTutor.estudiante_id == estudiante_id,
            ObservacionTutor.created_at >= datetime(anio_q, mes_q, 1),
            ObservacionTutor.created_at <= obs_fin,
        )
        .all()
    )
    for obs in obs_list:
        eventos.append({
            "id": obs.id, "tipo": "observacion",
            "fecha": obs.created_at.date().isoformat(),
            "hora":  obs.created_at.isoformat(),
            "detalle": {
                "subtipo": obs.tipo,
                "descripcion": obs.descripcion,
                "enviado_apoderado": obs.enviar_a_apoderado,
            },
        })

    # justificaciones del período
    from models.justificacion import Justificacion
    justs = (
        db.query(Justificacion)
        .join(Asistencia, Asistencia.id == Justificacion.asistencia_id)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            Asistencia.fecha >= inicio,
            Asistencia.fecha <= hasta,
        )
        .all()
    )
    for j in justs:
        eventos.append({
            "id": j.id, "tipo": "justificacion",
            "fecha": j.created_at.date().isoformat(),
            "hora":  j.created_at.isoformat(),
            "detalle": {
                "estado": j.estado,
                "motivo": j.motivo,
                "observacion_revision": j.observacion_revision,
            },
        })

    eventos.sort(key=lambda x: (x["fecha"], x["hora"] or ""), reverse=True)

    apoderados = (
        db.query(Usuario)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == Usuario.id)
        .filter(ApoderadoEstudiante.estudiante_id == estudiante_id, Usuario.activo == True)
        .all()
    )

    return {
        "estudiante": {
            "id": est.id, "nombre": est.nombre,
            "apellido": est.apellido, "dni": est.dni,
        },
        "estadisticas": {
            "presentes": n_presentes, "tardanzas": n_tardanzas,
            "faltas": n_faltas, "dias_laborables": _calc["dias_lab"], "porcentaje": pct,
        },
        "apoderados": [
            {"id": a.id, "nombre": f"{a.nombre} {a.apellido}", "telefono": a.telefono}
            for a in apoderados
        ],
        "eventos": eventos,
    }


# ---------------------------------------------------------------------------
# GET /tutor/estudiante/{estudiante_id}/ficha  — detalle del alumno
# ---------------------------------------------------------------------------

@router.get("/estudiante/{estudiante_id}/ficha")
def ficha_estudiante(
    estudiante_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id, Estudiante.activo == True).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    if est.nivel != vinculo.nivel or est.grado != vinculo.grado or est.seccion != vinculo.seccion:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El estudiante no es de tu aula")

    db.add(AuditLog(
        usuario_id=current_user.id,
        usuario_rol=current_user.rol,
        accion="ver_ficha_medica",
        recurso_id=estudiante_id,
        ip=request.client.host if request.client else None,
    ))
    db.commit()

    hoy = date.today()
    inicio_mes = date(hoy.year, hoy.month, 1)

    asistencias = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            Asistencia.fecha >= inicio_mes,
            Asistencia.fecha <= hoy,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        )
        .all()
    )

    mapa_dias = {}
    for a in asistencias:
        f = a.fecha.isoformat()
        if f not in mapa_dias or a.estado == "tardanza":
            mapa_dias[f] = "tardanza" if a.estado == "tardanza" else "presente"

    fechas = []
    d = inicio_mes
    while d <= hoy:
        if d.weekday() < 5:
            f = d.isoformat()
            fechas.append({"fecha": f, "estado": mapa_dias.get(f, "falta")})
        d += timedelta(days=1)

    obs_recientes = (
        db.query(ObservacionTutor)
        .filter(ObservacionTutor.tutor_id == current_user.id, ObservacionTutor.estudiante_id == estudiante_id)
        .order_by(ObservacionTutor.created_at.desc())
        .limit(5)
        .all()
    )

    apoderados = (
        db.query(Usuario)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == Usuario.id)
        .filter(ApoderadoEstudiante.estudiante_id == estudiante_id, Usuario.activo == True)
        .all()
    )

    return {
        "estudiante": {
            "id": est.id, "nombre": est.nombre, "apellido": est.apellido,
            "dni": est.dni, "grado": est.grado, "seccion": est.seccion,
            # Salud y necesidades especiales
            "atencion_medica":      est.atencion_medica,
            "tiene_alergias":       est.tiene_alergias,
            "alergias_detalle":     est.alergias_detalle,
            "condicion_mental_nee": est.condicion_mental_nee,
            "contacto_emergencia":  est.contacto_emergencia,
        },
        "asistencia_30dias": fechas,
        "observaciones_recientes": [
            {"tipo": o.tipo, "descripcion": o.descripcion, "fecha": o.created_at.date().isoformat()}
            for o in obs_recientes
        ],
        "apoderados": [
            {"id": a.id, "nombre": f"{a.nombre} {a.apellido}", "telefono": a.telefono}
            for a in apoderados
        ],
    }


# ---------------------------------------------------------------------------
# Helper: generación de PDF con reportlab
# ---------------------------------------------------------------------------

_MESES_ES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]
_DIAS_ES = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"]


def _safe(text) -> str:
    """Sanitiza texto para la fuente Helvetica (Latin-1) de reportlab.
    Reemplaza caracteres Unicode que no existen en Latin-1 para evitar
    UnicodeEncodeError durante la generación del PDF.
    """
    if not text:
        return ""
    text = str(text)
    reemplazos = {
        "\u2014": "-", "\u2013": "-",          # em dash / en dash
        "\u201c": '"', "\u201d": '"',           # comillas tipograficas dobles
        "\u2018": "'", "\u2019": "'",           # comillas tipograficas simples
        "\u2026": "...",                         # elipsis
        "\u00b7": ".",                           # punto medio
        "\u2022": "-",                           # bullet
        "\u00ab": '"', "\u00bb": '"',           # guillemets
    }
    for src, dst in reemplazos.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _generar_pdf_reporte(
    *,
    estudiante,
    tutor,
    vinculo,
    mes_q: int,
    anio_q: int,
    stats: dict,
    eventos: list,
    apoderados: list,
    generado: date,
) -> bytes:
    import base64
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, Image as RLImage, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    from reportlab.platypus import Paragraph as P

    # Cargar logo desde base64 respetando la proporción original
    _logo_path = Path(__file__).parent.parent / "logo_b64.txt"
    try:
        from reportlab.lib.utils import ImageReader
        _logo_b64   = _logo_path.read_text().strip()
        _logo_bytes = base64.b64decode(_logo_b64)
        _iw, _ih    = ImageReader(BytesIO(_logo_bytes)).getSize()
        _target_h   = 1.8 * cm
        _target_w   = _target_h * (_iw / _ih)
        _logo_img   = RLImage(BytesIO(_logo_bytes), width=_target_w, height=_target_h)
    except Exception:
        _logo_img = None

    # ── Colores de marca ──────────────────────────────────────────────────
    MARINO  = HexColor("#0a1f3d")
    DORADO  = HexColor("#c9a227")
    CREMA   = HexColor("#f8f7f4")
    C_GREEN = HexColor("#16a34a")
    C_AMBER = HexColor("#d97706")
    C_RED   = HexColor("#dc2626")
    C_LGRAY = HexColor("#f1f5f9")
    C_MGRAY = HexColor("#64748b")
    C_BORD  = HexColor("#e2e8f0")

    def _pct_color(p):
        if p >= 90: return C_GREEN
        if p >= 75: return C_AMBER
        return C_RED

    def _pct_bar_color(p):
        if p >= 90: return HexColor("#22c55e")
        if p >= 75: return HexColor("#f59e0b")
        return HexColor("#ef4444")

    # ── Estilos de párrafo ────────────────────────────────────────────────
    def _ps(name, **kw):
        defaults = dict(fontName="Helvetica", fontSize=9,
                        textColor=HexColor("#1e293b"), leading=13)
        defaults.update(kw)
        return ParagraphStyle(name, **defaults)

    S_BODY    = _ps("body_r")
    S_LABEL   = _ps("label_r",   fontSize=7.5, textColor=C_MGRAY, leading=10)
    S_BOLD    = _ps("bold_r",    fontName="Helvetica-Bold")
    S_SECTION = _ps("section_r", fontName="Helvetica-Bold", fontSize=8,
                    textColor=MARINO, leading=11, spaceAfter=3)
    S_FOOTER  = _ps("footer_r",  fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=10)
    S_WHITE_B = _ps("whiteb_r",  fontName="Helvetica-Bold", fontSize=8, textColor=white, leading=11)

    # ── Documento ─────────────────────────────────────────────────────────
    buf = BytesIO()
    W, _ = A4
    margin   = 1.8 * cm
    usable_w = W - 2 * margin

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=1.2 * cm, bottomMargin=1.8 * cm,
        title=_safe(f"Reporte - {estudiante.apellido}, {estudiante.nombre}"),
    )
    story = []

    # ── 1. ENCABEZADO ─────────────────────────────────────────────────────
    nivel_label = {
        "i-auxiliar": "Inicial", "p-auxiliar": "Primaria", "s-auxiliar": "Secundaria",
    }.get(vinculo.nivel, vinculo.nivel.capitalize())

    _logo_cell = _logo_img if _logo_img else P(
        "CEAUNE", _ps("logo_r", fontName="Helvetica-Bold", fontSize=16, textColor=DORADO, leading=20)
    )

    # Fila principal: logo | datos institucionales | fecha
    hdr = Table([[
        _logo_cell,
        P(
            "<font size='8' color='#c9a227'><b>UNIVERSIDAD NACIONAL DE EDUCACIÓN ENRIQUE GUZMÁN Y VALLE</b></font><br/>"
            "<font size='12'><b>COLEGIO EXPERIMENTAL DE APLICACIÓN</b></font><br/>"
            "<font size='7'>I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED</font><br/>"
            "<font size='7'>Modelo Educativo: Jornada Escolar Completa con Formación Técnica</font>",
            _ps("inst_r", fontName="Helvetica-Bold", fontSize=12,
                 textColor=white, leading=14, alignment=TA_CENTER),
        ),
        P(
            f"Generado el<br/><b>{generado.strftime('%d/%m/%Y')}</b>",
            _ps("hdate_r", fontSize=8, textColor=HexColor("#93c5fd"),
                 leading=12, alignment=TA_RIGHT),
        ),
    ]], colWidths=[3.5 * cm, usable_w - 7 * cm, 3.5 * cm])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), MARINO),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (0,  -1), 14),
        ("RIGHTPADDING",  (-1, 0), (-1, -1), 14),
    ]))

    # Banda dorada con el título del documento
    sub = Table([[
        P("REPORTE DE SEGUIMIENTO ESTUDIANTIL",
          _ps("sub_r", fontName="Helvetica-Bold", fontSize=10,
               textColor=MARINO, leading=13, alignment=TA_CENTER)),
    ]], colWidths=[usable_w])
    sub.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DORADO),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))

    story.append(hdr)
    story.append(sub)
    story.append(Spacer(1, 0.45 * cm))

    # ── 2. DATOS DEL ALUMNO ───────────────────────────────────────────────
    story.append(P("DATOS DEL ALUMNO", S_SECTION))

    # Sin em-dash ni comillas tipograficas (no estan en Latin-1)
    grado_str  = _safe(f"{vinculo.grado} grado - Sec. {vinculo.seccion} - {nivel_label}")
    mes_nombre = _MESES_ES[mes_q - 1]
    alumno_str = _safe(f"{estudiante.apellido}, {estudiante.nombre}")
    dni_str    = _safe(estudiante.dni or "S/D")
    tutor_str  = _safe(f"{tutor.nombre} {tutor.apellido}")

    info = Table([
        [P("Apellidos y Nombres", S_LABEL), P("DNI", S_LABEL),    P("Grado y Seccion", S_LABEL)],
        [P(alumno_str, S_BOLD),             P(dni_str, S_BOLD),    P(grado_str, S_BOLD)],
        [P("Tutor de Aula", S_LABEL),       P("Periodo", S_LABEL), P("", S_LABEL)],
        [P(tutor_str, S_BOLD),              P(f"{mes_nombre} {anio_q}", S_BOLD), P("", S_BOLD)],
    ], colWidths=[usable_w * 0.46, usable_w * 0.2, usable_w * 0.34])
    info.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, -1), CREMA),
        ("TOPPADDING",     (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 3),
        ("LEFTPADDING",    (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",   (0, 0), (-1, -1), 10),
        ("BOX",            (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",      (0, 0), (-1, -1), 0.25, C_BORD),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CREMA, white, CREMA, white]),
        ("TOPPADDING",     (0, 0), (-1, 0),  9),
        ("TOPPADDING",     (0, 2), (-1, 2),  8),
    ]))
    story.append(info)
    story.append(Spacer(1, 0.45 * cm))

    # ── 3. RESUMEN DE ASISTENCIA ──────────────────────────────────────────
    story.append(P("RESUMEN DE ASISTENCIA", S_SECTION))

    pct  = stats["porcentaje"]
    c_pct = _pct_color(pct)
    c_bar = _pct_bar_color(pct)
    # 3.5 cm columna pct  +  20 pt padding izq/der de la celda derecha en attend
    bar_w = usable_w - 3.5 * cm - 20

    # Barra de progreso con dos celdas coloreadas
    if 0 < pct < 100:
        bar_t = Table(
            [[P("", S_BODY), P("", S_BODY)]],
            colWidths=[bar_w * pct / 100, bar_w * (1 - pct / 100)],
            rowHeights=[0.32 * cm],
        )
        bar_t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, -1), c_bar),
            ("BACKGROUND",    (1, 0), (1, -1), C_LGRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))
    else:
        fill_c = c_bar if pct >= 100 else C_LGRAY
        bar_t = Table([[P("", S_BODY)]], colWidths=[bar_w], rowHeights=[0.32 * cm])
        bar_t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), fill_c),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

    # 4 chips de estadisticas
    chip_w = bar_w / 4
    chips = Table([
        [
            P(str(stats["presentes"]), _ps("cv0", fontName="Helvetica-Bold", fontSize=15, textColor=C_GREEN, alignment=TA_CENTER, leading=18)),
            P(str(stats["tardanzas"]), _ps("cv1", fontName="Helvetica-Bold", fontSize=15, textColor=C_AMBER, alignment=TA_CENTER, leading=18)),
            P(str(stats["faltas"]),    _ps("cv2", fontName="Helvetica-Bold", fontSize=15, textColor=C_RED,   alignment=TA_CENTER, leading=18)),
            P(str(stats["dias_lab"]),  _ps("cv3", fontName="Helvetica-Bold", fontSize=15, textColor=MARINO,  alignment=TA_CENTER, leading=18)),
        ], [
            P("Presentes",    _ps("cl0", fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=9)),
            P("Tardanzas",    _ps("cl1", fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=9)),
            P("Faltas",       _ps("cl2", fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=9)),
            P("Dias habiles", _ps("cl3", fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=9)),
        ],
    ], colWidths=[chip_w] * 4)
    chips.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1), HexColor("#f0fdf4")),
        ("BACKGROUND",    (1, 0), (1, -1), HexColor("#fffbeb")),
        ("BACKGROUND",    (2, 0), (2, -1), HexColor("#fef2f2")),
        ("BACKGROUND",    (3, 0), (3, -1), HexColor("#f8fafc")),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    right_inner = Table([[bar_t], [chips]], colWidths=[bar_w])
    right_inner.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))

    attend = Table([[
        P(f"{pct}%", _ps("pct_r", fontName="Helvetica-Bold", fontSize=26,
                          textColor=c_pct, alignment=TA_CENTER, leading=30)),
        right_inner,
    ]], colWidths=[3.5 * cm, usable_w - 3.5 * cm])
    attend.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), HexColor("#f8fafc")),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("LINEBEFORE",    (1, 0), (1, -1), 0.5, C_BORD),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (0,  -1), 10),
        ("LEFTPADDING",   (1, 0), (1,  -1), 10),
        ("RIGHTPADDING",  (1, 0), (1,  -1), 10),
    ]))
    story.append(attend)
    story.append(Spacer(1, 0.45 * cm))

    # ── 4. HISTORIAL DE EVENTOS ───────────────────────────────────────────
    story.append(P("HISTORIAL DE EVENTOS", S_SECTION))

    TIPO_CFG = {
        "falta":         ("Falta",         C_RED,   HexColor("#fef2f2")),
        "tardanza":      ("Tardanza",       C_AMBER, HexColor("#fffbeb")),
        "observacion":   ("Observacion",    MARINO,  HexColor("#eff6ff")),
        "justificacion": ("Justificacion",  C_GREEN, HexColor("#f0fdf4")),
    }

    if not eventos:
        story.append(P("Sin incidencias registradas en este periodo.", S_BODY))
    else:
        col_f = 1.9 * cm
        col_t = 2.6 * cm
        col_d = usable_w - col_f - col_t

        ev_rows = [[
            P("Fecha",   S_WHITE_B),
            P("Tipo",    S_WHITE_B),
            P("Detalle", S_WHITE_B),
        ]]
        row_bgs = [MARINO]

        for ev in eventos:
            tipo = ev["tipo"]
            label, txt_c, row_bg = TIPO_CFG.get(tipo, ("-", C_MGRAY, white))

            d = ev["fecha"]
            fecha_str = f"{_DIAS_ES[d.weekday()]} {d.strftime('%d/%m')}"

            tipo_display = label
            if tipo == "observacion" and ev.get("subtipo"):
                tipo_display = f"{label}<br/><font size='7'>{_safe(ev['subtipo'])}</font>"
            elif tipo == "justificacion" and ev.get("estado"):
                tipo_display = f"{label}<br/><font size='7'>({_safe(ev['estado'])})</font>"

            detalle = _safe(ev.get("detalle", "") or "")
            if len(detalle) > 130:
                detalle = detalle[:127] + "..."

            ev_rows.append([
                P(fecha_str,    _ps(f"efd{id(ev)}", fontName="Helvetica-Bold",
                                     fontSize=8, textColor=txt_c, leading=11)),
                P(tipo_display, _ps(f"ety{id(ev)}", fontName="Helvetica-Bold",
                                     fontSize=8, textColor=txt_c, leading=11)),
                P(detalle,      _ps(f"edt{id(ev)}", fontSize=8,
                                     textColor=HexColor("#334155"), leading=11)),
            ])
            row_bgs.append(row_bg)

        ev_t = Table(ev_rows, colWidths=[col_f, col_t, col_d], repeatRows=1)
        ts = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), MARINO),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
            ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
        ])
        for i, bg in enumerate(row_bgs[1:], 1):
            ts.add("BACKGROUND", (0, i), (-1, i), bg)
        ev_t.setStyle(ts)
        story.append(ev_t)

    story.append(Spacer(1, 0.45 * cm))

    # ── 5. APODERADOS ─────────────────────────────────────────────────────
    if apoderados:
        story.append(P("APODERADOS / RESPONSABLES", S_SECTION))
        ap_rows = [[P("Nombre completo", S_WHITE_B), P("Telefono", S_WHITE_B)]]
        for ap in apoderados:
            ap_rows.append([
                P(_safe(f"{ap.nombre} {ap.apellido}"), S_BODY),
                P(_safe(ap.telefono or "S/N"), S_BODY),
            ])
        ap_t = Table(ap_rows, colWidths=[usable_w * 0.62, usable_w * 0.38])
        ap_t.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0), (-1, 0), MARINO),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f0fdf4"), white]),
            ("TOPPADDING",     (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 6),
            ("LEFTPADDING",    (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 10),
            ("BOX",            (0, 0), (-1, -1), 0.5, C_BORD),
            ("INNERGRID",      (0, 0), (-1, -1), 0.25, C_BORD),
        ]))
        story.append(ap_t)
        story.append(Spacer(1, 0.45 * cm))

    # ── 6. AREA DE FIRMA ──────────────────────────────────────────────────
    sig_t = Table([[
        P(f"_________________________<br/>"
          f"<font size='8' color='#64748b'>Firma y sello del Tutor<br/>"
          f"{_safe(tutor_str)}</font>",
          _ps("sig_r", alignment=TA_CENTER, fontSize=9, leading=14)),
    ]], colWidths=[usable_w])
    sig_t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_t)

    # ── 8. PIE DE PAGINA ──────────────────────────────────────────────────
    story.append(Spacer(1, 0.25 * cm))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=C_BORD))
    story.append(Spacer(1, 0.15 * cm))
    story.append(P(
        f"CEAUNE - Sistema de Seguimiento Estudiantil  |  "
        f"Documento generado el {generado.strftime('%d/%m/%Y')}",
        S_FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# GET /tutor/estudiante/{estudiante_id}/reporte-pdf
# ---------------------------------------------------------------------------

@router.get("/estudiante/{estudiante_id}/reporte-pdf")
def reporte_pdf_estudiante(
    estudiante_id: str,
    mes:  Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    est = db.query(Estudiante).filter(
        Estudiante.id == estudiante_id, Estudiante.activo == True
    ).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    if est.nivel != vinculo.nivel or est.grado != vinculo.grado or est.seccion != vinculo.seccion:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El estudiante no es de tu aula")

    hoy    = date.today()
    mes_q  = mes  or hoy.month
    anio_q = anio or hoy.year
    inicio = date(anio_q, mes_q, 1)
    fin    = date(anio_q, mes_q, monthrange(anio_q, mes_q)[1])
    hasta  = min(fin, hoy)

    # estadísticas — servicio centralizado (misma lógica que la lista)
    from services.asistencia_calc import calcular_resumen_mes
    _calc       = calcular_resumen_mes(estudiante_id, est.nivel, est.grado, est.seccion, mes_q, anio_q, db)
    n_presentes = _calc["presentes"]
    n_tardanzas = _calc["tardanzas"]
    n_faltas    = _calc["faltas"]
    pct         = _calc["pct"]

    # El historial del PDF solo incluye observaciones y justificaciones
    # (las faltas/tardanzas ya están resumidas en los chips de estadística)
    eventos_pdf = []

    obs_fin = datetime(anio_q, mes_q, monthrange(anio_q, mes_q)[1], 23, 59, 59)
    obs_list = (
        db.query(ObservacionTutor)
        .filter(
            ObservacionTutor.estudiante_id == estudiante_id,
            ObservacionTutor.created_at >= datetime(anio_q, mes_q, 1),
            ObservacionTutor.created_at <= obs_fin,
        )
        .order_by(ObservacionTutor.created_at)
        .all()
    )
    _subtipo_label = {
        "academica": "Académica", "conductual": "Conductual",
        "salud": "Salud", "logro": "Logro", "otro": "Otro",
    }
    for obs in obs_list:
        eventos_pdf.append({
            "tipo": "observacion",
            "fecha": obs.created_at.date(),
            "subtipo": _subtipo_label.get(obs.tipo, obs.tipo.capitalize()),
            "detalle": obs.descripcion or "",
        })

    from models.justificacion import Justificacion
    justs = (
        db.query(Justificacion)
        .join(Asistencia, Asistencia.id == Justificacion.asistencia_id)
        .filter(
            Asistencia.estudiante_id == estudiante_id,
            Asistencia.fecha >= inicio,
            Asistencia.fecha <= hasta,
        )
        .all()
    )
    _estado_label = {"pendiente": "Pendiente", "aprobada": "Aprobada", "rechazada": "Rechazada"}
    for j in justs:
        eventos_pdf.append({
            "tipo": "justificacion",
            "fecha": j.created_at.date(),
            "estado": _estado_label.get(j.estado, j.estado.capitalize()),
            "detalle": j.motivo or "",
        })

    eventos_pdf.sort(key=lambda x: x["fecha"])

    apoderados = (
        db.query(Usuario)
        .join(ApoderadoEstudiante, ApoderadoEstudiante.apoderado_id == Usuario.id)
        .filter(ApoderadoEstudiante.estudiante_id == estudiante_id, Usuario.activo == True)
        .all()
    )

    pdf_bytes = _generar_pdf_reporte(
        estudiante=est,
        tutor=current_user,
        vinculo=vinculo,
        mes_q=mes_q,
        anio_q=anio_q,
        stats={
            "presentes": n_presentes, "tardanzas": n_tardanzas,
            "faltas": n_faltas, "dias_lab": _calc["dias_lab"], "porcentaje": pct,
        },
        eventos=eventos_pdf,
        apoderados=apoderados,
        generado=hoy,
    )

    nombre = f"Reporte_{est.apellido}_{est.nombre}_{mes_q:02d}{anio_q}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


# ---------------------------------------------------------------------------
# GET /tutor/alertas  — alertas inteligentes del dashboard
# ---------------------------------------------------------------------------

@router.get("/alertas")
def alertas_tutor(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Detecta patrones accionables para el tutor:
    - Alumnos con 3+ faltas consecutivas
    - Alumnos que bajaron más de 10pp respecto al mes anterior
    - Día de la semana con más faltas históricas
    """
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = date.today()
    alertas = []

    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        )
        .order_by(Estudiante.apellido, Estudiante.nombre)
        .all()
    )
    ids = [e.id for e in estudiantes]
    nombre_map = {e.id: f"{e.apellido}, {e.nombre}" for e in estudiantes}

    if not ids:
        return alertas

    # ── 1) Faltas consecutivas (últimos 10 días laborables) ──────────────
    dias_check = 10
    fecha_desde = hoy - timedelta(days=dias_check * 2)  # holgura fines de semana
    asistencias_recientes = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.fecha >= fecha_desde,
            Asistencia.fecha <= hoy,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
        )
        .all()
    )

    # Mapa: est_id → set de fechas con ingreso
    ingreso_map = {}
    for a in asistencias_recientes:
        if a.estado != "falta":
            ingreso_map.setdefault(a.estudiante_id, set()).add(a.fecha)

    # Últimos N días laborables
    dias_lab_recientes = []
    d = hoy
    while len(dias_lab_recientes) < dias_check:
        if d.weekday() < 5:
            dias_lab_recientes.append(d)
        d -= timedelta(days=1)
    dias_lab_recientes.reverse()

    for est in estudiantes:
        fechas_ingreso = ingreso_map.get(est.id, set())
        streak = 0
        for dia in reversed(dias_lab_recientes):
            if dia not in fechas_ingreso:
                streak += 1
            else:
                break
        if streak >= 3:
            alertas.append({
                "tipo": "faltas_consecutivas",
                "icono": "alert-triangle",
                "color": "red",
                "titulo": f"{nombre_map[est.id]} lleva {streak} días sin asistir",
                "detalle": f"No se ha registrado ingreso en los últimos {streak} días laborables.",
                "estudiante_id": est.id,
            })

    # ── 2) Bajada significativa vs mes anterior ──────────────────────────
    mes_actual = hoy.month
    anio_actual = hoy.year
    if mes_actual == 1:
        mes_ant, anio_ant = 12, anio_actual - 1
    else:
        mes_ant, anio_ant = mes_actual - 1, anio_actual

    inicio_ant = date(anio_ant, mes_ant, 1)
    fin_ant = date(anio_ant, mes_ant, monthrange(anio_ant, mes_ant)[1])
    inicio_act = date(anio_actual, mes_actual, 1)

    dias_lab_ant = sum(
        1 for i in range((fin_ant - inicio_ant).days + 1)
        if (inicio_ant + timedelta(days=i)).weekday() < 5
    )
    dias_lab_act = sum(
        1 for i in range((hoy - inicio_act).days + 1)
        if (inicio_act + timedelta(days=i)).weekday() < 5
    )

    if dias_lab_ant > 0 and dias_lab_act >= 5:
        asist_ant = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id.in_(ids),
                Asistencia.fecha >= inicio_ant,
                Asistencia.fecha <= fin_ant,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
                Asistencia.estado != "falta",
            )
            .all()
        )
        asist_act = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id.in_(ids),
                Asistencia.fecha >= inicio_act,
                Asistencia.fecha <= hoy,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
                Asistencia.estado != "falta",
            )
            .all()
        )

        cnt_ant = {}
        for a in asist_ant:
            cnt_ant[a.estudiante_id] = cnt_ant.get(a.estudiante_id, 0) + 1
        cnt_act = {}
        for a in asist_act:
            cnt_act[a.estudiante_id] = cnt_act.get(a.estudiante_id, 0) + 1

        for est_id in ids:
            pct_ant = round(cnt_ant.get(est_id, 0) / dias_lab_ant * 100, 1)
            pct_act = round(cnt_act.get(est_id, 0) / dias_lab_act * 100, 1)
            delta = pct_act - pct_ant
            if delta <= -10:
                alertas.append({
                    "tipo": "bajada_porcentaje",
                    "icono": "trending-down",
                    "color": "amber",
                    "titulo": f"{nombre_map[est_id]} bajó {abs(delta):.0f}pp este mes",
                    "detalle": f"Pasó de {pct_ant:.0f}% a {pct_act:.0f}% de asistencia.",
                    "estudiante_id": est_id,
                })

    # ── 3) Día de la semana con más faltas (últimos 30 días) ─────────────
    fecha_30 = hoy - timedelta(days=30)
    faltas_30 = (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id.in_(ids),
            Asistencia.fecha >= fecha_30,
            Asistencia.fecha <= hoy,
            Asistencia.estado == "falta",
        )
        .all()
    )
    if faltas_30:
        conteo_dia = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
        for a in faltas_30:
            wd = a.fecha.weekday()
            if wd < 5:
                conteo_dia[wd] = conteo_dia.get(wd, 0) + 1

        peor_dia = max(conteo_dia, key=conteo_dia.get)
        nombres_dia = {0: "lunes", 1: "martes", 2: "miércoles", 3: "jueves", 4: "viernes"}
        if conteo_dia[peor_dia] > 0 and hoy.weekday() == peor_dia:
            alertas.append({
                "tipo": "dia_critico",
                "icono": "calendar",
                "color": "blue",
                "titulo": f"Hoy es {nombres_dia[peor_dia]}: el día con más faltas",
                "detalle": f"{conteo_dia[peor_dia]} faltas acumuladas los {nombres_dia[peor_dia]} en los últimos 30 días.",
                "estudiante_id": None,
            })

    return alertas


# ---------------------------------------------------------------------------
# GET /tutor/mi-aula/comparativa  — comparativa mes actual vs anterior
# ---------------------------------------------------------------------------

@router.get("/mi-aula/comparativa")
def comparativa_mensual(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Devuelve KPIs del mes actual y el delta vs el mes anterior:
    - pct_asistencia, delta_pct
    - en_riesgo, delta_riesgo
    - faltas_total, delta_faltas
    """
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    hoy = date.today()
    mes_act = mes or hoy.month
    anio_act = anio or hoy.year

    if mes_act == 1:
        mes_ant, anio_ant = 12, anio_act - 1
    else:
        mes_ant, anio_ant = mes_act - 1, anio_act

    def _calcular_stats(m, a):
        inicio = date(a, m, 1)
        fin = date(a, m, monthrange(a, m)[1])
        hasta = min(fin, hoy)
        if hasta < inicio:
            return None

        dias_lab = sum(
            1 for i in range((hasta - inicio).days + 1)
            if (inicio + timedelta(days=i)).weekday() < 5
        )
        if dias_lab == 0:
            return None

        estudiantes = (
            db.query(Estudiante)
            .filter(
                Estudiante.nivel == vinculo.nivel,
                Estudiante.grado == vinculo.grado,
                Estudiante.seccion == vinculo.seccion,
                Estudiante.activo == True,
            )
            .all()
        )
        ids = [e.id for e in estudiantes]
        if not ids:
            return None

        asistencias = (
            db.query(Asistencia)
            .filter(
                Asistencia.estudiante_id.in_(ids),
                Asistencia.fecha >= inicio,
                Asistencia.fecha <= hasta,
                Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
                Asistencia.estado != "falta",
            )
            .all()
        )

        por_alumno = {}
        visto = set()
        for a in asistencias:
            key = (a.estudiante_id, a.fecha)
            if key in visto:
                continue
            visto.add(key)
            por_alumno[a.estudiante_id] = por_alumno.get(a.estudiante_id, 0) + 1

        pcts = []
        faltas_total = 0
        en_riesgo = 0
        for est_id in ids:
            asistidos = por_alumno.get(est_id, 0)
            pct = round(asistidos / dias_lab * 100, 1) if dias_lab else 0
            pcts.append(pct)
            faltas_total += max(0, dias_lab - asistidos)
            if pct < 75:
                en_riesgo += 1

        pct_promedio = round(sum(pcts) / len(pcts), 1) if pcts else 0
        return {
            "pct_asistencia": pct_promedio,
            "en_riesgo": en_riesgo,
            "faltas_total": faltas_total,
        }

    actual = _calcular_stats(mes_act, anio_act)
    anterior = _calcular_stats(mes_ant, anio_ant)

    if not actual:
        return {
            "pct_asistencia": 0, "delta_pct": 0,
            "en_riesgo": 0, "delta_riesgo": 0,
            "faltas_total": 0, "delta_faltas": 0,
        }

    delta_pct = round(actual["pct_asistencia"] - (anterior["pct_asistencia"] if anterior else 0), 1) if anterior else 0
    delta_riesgo = actual["en_riesgo"] - (anterior["en_riesgo"] if anterior else 0) if anterior else 0
    delta_faltas = actual["faltas_total"] - (anterior["faltas_total"] if anterior else 0) if anterior else 0

    return {
        "pct_asistencia": actual["pct_asistencia"],
        "delta_pct": delta_pct,
        "en_riesgo": actual["en_riesgo"],
        "delta_riesgo": delta_riesgo,
        "faltas_total": actual["faltas_total"],
        "delta_faltas": delta_faltas,
    }


# ──────────────────────────────────────────────────────────────────────────────
# REUNIONES
# ──────────────────────────────────────────────────────────────────────────────
from models.reunion import ReunionTutor
from schemas.dia_no_laborable import ReuniónCreate, ReuniónEstadoUpdate, ReuniónResponse


@router.get("/reuniones", response_model=List[ReuniónResponse])
def listar_reuniones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    # Estudiantes del aula para enriquecer nombres
    estudiantes = (
        db.query(Estudiante)
        .filter(
            Estudiante.nivel   == vinculo.nivel,
            Estudiante.grado   == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo  == True,
        )
        .all()
    )
    nombre_map = {e.id: f"{e.apellido}, {e.nombre}" for e in estudiantes}

    reuniones = (
        db.query(ReunionTutor)
        .filter(ReunionTutor.tutor_id == current_user.id)
        .order_by(ReunionTutor.fecha.desc(), ReunionTutor.hora.desc())
        .all()
    )

    result = []
    for r in reuniones:
        d = ReuniónResponse.model_validate(r)
        d.nombre_estudiante = nombre_map.get(r.estudiante_id, "—")
        result.append(d)
    return result


@router.post("/reuniones", status_code=201)
def crear_reunion(
    body: ReuniónCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    from datetime import time as time_type
    h, m = map(int, body.hora.split(":"))

    # Resolver lista de estudiantes
    if body.todos:
        vinculo = _get_tutor_aula(current_user.id, db)
        ids = [
            e.id for e in db.query(Estudiante).filter(
                Estudiante.nivel   == vinculo.nivel,
                Estudiante.grado   == vinculo.grado,
                Estudiante.seccion == vinculo.seccion,
                Estudiante.activo  == True,
            ).all()
        ]
    else:
        ids = body.estudiante_ids

    if not ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No hay alumnos seleccionados")

    creadas = 0
    for est_id in ids:
        est = db.query(Estudiante).filter(Estudiante.id == est_id).first()
        if not est:
            continue
        reunion = ReunionTutor(
            tutor_id      = current_user.id,
            estudiante_id = est_id,
            titulo        = body.titulo,
            descripcion   = body.descripcion,
            fecha         = body.fecha,
            hora          = time_type(h, m),
            modalidad     = body.modalidad,
            lugar         = body.lugar,
            estado        = "pendiente",
        )
        db.add(reunion)
        creadas += 1

    db.commit()
    return {"creadas": creadas}


@router.patch("/reuniones/{reunion_id}", response_model=ReuniónResponse)
def actualizar_estado_reunion(
    reunion_id: str,
    body: ReuniónEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    reunion = db.query(ReunionTutor).filter(
        ReunionTutor.id       == reunion_id,
        ReunionTutor.tutor_id == current_user.id,
    ).first()
    if not reunion:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reunión no encontrada")
    estados_validos = {"pendiente", "confirmada", "realizada", "cancelada"}
    if body.estado not in estados_validos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Estado inválido")
    reunion.estado = body.estado
    db.commit()
    db.refresh(reunion)
    est = db.query(Estudiante).filter(Estudiante.id == reunion.estudiante_id).first()
    resp = ReuniónResponse.model_validate(reunion)
    resp.nombre_estudiante = f"{est.apellido}, {est.nombre}" if est else "—"
    return resp


@router.delete("/reuniones/{reunion_id}", status_code=204)
def eliminar_reunion(
    reunion_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    reunion = db.query(ReunionTutor).filter(
        ReunionTutor.id       == reunion_id,
        ReunionTutor.tutor_id == current_user.id,
    ).first()
    if not reunion:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reunión no encontrada")
    db.delete(reunion)
    db.commit()


# ---------------------------------------------------------------------------
# LIBRETAS
# ---------------------------------------------------------------------------

@router.get("/libretas")
def listar_libretas(
    bimestre: int = Query(..., ge=1, le=4),
    anio: int = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    estudiante_ids = [
        r[0] for r in db.query(Estudiante.id).filter(
            Estudiante.nivel == vinculo.nivel,
            Estudiante.grado == vinculo.grado,
            Estudiante.seccion == vinculo.seccion,
            Estudiante.activo == True,
        ).all()
    ]

    libretas = db.query(Libreta).filter(
        Libreta.estudiante_id.in_(estudiante_ids),
        Libreta.bimestre == bimestre,
        Libreta.anio == anio,
    ).all()

    return [
        {
            "id":             l.id,
            "estudiante_id":  l.estudiante_id,
            "bimestre":       l.bimestre,
            "anio":           l.anio,
            "archivo_nombre": l.archivo_nombre,
            "archivo_url":    l.archivo_url,
            "subido_en":      l.subido_en.isoformat() if l.subido_en else None,
        }
        for l in libretas
    ]


@router.post("/libretas", status_code=201)
async def subir_libreta(
    estudiante_id: str = Form(...),
    bimestre: int = Form(..., ge=1, le=4),
    anio: int = Form(...),
    notificar: bool = Form(False),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    est = db.query(Estudiante).filter(
        Estudiante.id == estudiante_id,
        Estudiante.nivel == vinculo.nivel,
        Estudiante.grado == vinculo.grado,
        Estudiante.seccion == vinculo.seccion,
        Estudiante.activo == True,
    ).first()
    if not est:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado en tu aula")

    contenido = await archivo.read()
    mime_type = archivo.content_type or "application/octet-stream"

    MIME_CONOCIDOS = {
        "application/pdf", "image/jpeg", "image/png", "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if mime_type not in MIME_CONOCIDOS:
        mime_type = "application/octet-stream"

    sufijo = Path(archivo.filename).suffix if archivo.filename else ""
    nombre_archivo = f"Libreta_{est.apellido}_{est.nombre}_B{bimestre}_{anio}{sufijo}"

    try:
        from services.drive_service import eliminar_archivo, subir_archivo
        resultado = subir_archivo(contenido, nombre_archivo, mime_type)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    existente = db.query(Libreta).filter(
        Libreta.estudiante_id == estudiante_id,
        Libreta.bimestre == bimestre,
        Libreta.anio == anio,
    ).first()

    if existente:
        if existente.archivo_drive_id:
            from services.drive_service import eliminar_archivo
            eliminar_archivo(existente.archivo_drive_id)
        existente.archivo_nombre   = resultado["nombre"]
        existente.archivo_url      = resultado["url"]
        existente.archivo_drive_id = resultado["file_id"]
        existente.archivo_tipo     = mime_type
        existente.tutor_id         = current_user.id
    else:
        db.add(Libreta(
            estudiante_id    = estudiante_id,
            tutor_id         = current_user.id,
            bimestre         = bimestre,
            anio             = anio,
            archivo_nombre   = resultado["nombre"],
            archivo_url      = resultado["url"],
            archivo_drive_id = resultado["file_id"],
            archivo_tipo     = mime_type,
        ))

    db.commit()

    if notificar:
        libreta_guardada = db.query(Libreta).filter(
            Libreta.estudiante_id == estudiante_id,
            Libreta.bimestre == bimestre,
            Libreta.anio == anio,
        ).first()
        if libreta_guardada:
            try:
                from services.gmail_service import notificar_libreta_bg
                notificar_libreta_bg(libreta_guardada.id)
            except Exception:
                pass
            try:
                from services.firebase_service import push_libreta_bg
                push_libreta_bg(libreta_guardada.id)
            except Exception:
                pass

    return {"ok": True, "url": resultado["url"]}


@router.delete("/libretas/{libreta_id}", status_code=204)
def eliminar_libreta(
    libreta_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    libreta = db.query(Libreta).filter(Libreta.id == libreta_id).first()
    if not libreta:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Libreta no encontrada")

    est = db.query(Estudiante).filter(
        Estudiante.id == libreta.estudiante_id,
        Estudiante.nivel == vinculo.nivel,
        Estudiante.grado == vinculo.grado,
        Estudiante.seccion == vinculo.seccion,
    ).first()
    if not est:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta libreta")

    if libreta.archivo_drive_id:
        from services.drive_service import eliminar_archivo
        eliminar_archivo(libreta.archivo_drive_id)

    db.delete(libreta)
    db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# COMUNICADOS DEL TUTOR
# Solo puede enviar a su propio aula (nivel + grado + sección de TutorAula).
# Reutiliza las tablas Comunicado / ComunicadoDestinatario / ComunicadoRespuesta
# guardando el tutor_id en la columna auxiliar_id (FK a usuarios, válida para
# cualquier rol).
# ──────────────────────────────────────────────────────────────────────────────

class TutorComunicarRequest(BaseModel):
    tipo_envio: str                  # "individual" | "aula"
    estudiantes_ids: List[str] = []  # solo para tipo_envio == "individual"
    asunto: str
    mensaje: str
    adjunto_nombre: Optional[str] = None
    adjunto_drive_url: Optional[str] = None


def _enrich_com(c: Comunicado, total: int, leidos: int) -> ComunicadoResponse:
    r = ComunicadoResponse.model_validate(c)
    r.total_destinatarios = total
    r.leidos = leidos
    return r


@router.post("/comunicados/subir-adjunto")
async def tutor_subir_adjunto(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    """Sube un archivo a Google Drive y retorna la URL (igual que auxiliar)."""
    _verificar_tutor(current_user)
    contenido = await archivo.read()
    mime = archivo.content_type or "application/octet-stream"
    try:
        from services.drive_service import subir_archivo
        resultado = subir_archivo(contenido, archivo.filename, mime)
        return resultado
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


@router.post("/comunicados/enviar", response_model=ComunicadoResponse, status_code=201)
def tutor_enviar_comunicado(
    data: TutorComunicarRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Envía un comunicado a estudiantes del propio aula del tutor."""
    _verificar_tutor(current_user)
    vinculo = _get_tutor_aula(current_user.id, db)

    if data.tipo_envio not in ("individual", "aula"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "tipo_envio debe ser 'individual' o 'aula'",
        )

    # Siempre filtrar por el aula del tutor — nunca puede salirse de ella
    q = db.query(Estudiante).filter(
        Estudiante.nivel == vinculo.nivel,
        Estudiante.grado == vinculo.grado,
        Estudiante.seccion == vinculo.seccion,
        Estudiante.activo == True,
    )

    if data.tipo_envio == "individual":
        if not data.estudiantes_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Seleccione al menos un destinatario",
            )
        q = q.filter(Estudiante.id.in_(data.estudiantes_ids))

    estudiantes = q.all()
    if not estudiantes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No se encontraron destinatarios en tu aula",
        )

    batch_id = str(uuid.uuid4())
    comunicado = Comunicado(
        auxiliar_id=current_user.id,
        batch_id=batch_id,
        asunto=data.asunto,
        mensaje=data.mensaje,
        adjunto_nombre=data.adjunto_nombre,
        adjunto_drive_url=data.adjunto_drive_url,
        tipo_envio=data.tipo_envio,
    )
    db.add(comunicado)
    db.flush()

    for est in estudiantes:
        db.add(ComunicadoDestinatario(
            comunicado_id=comunicado.id,
            estudiante_id=est.id,
            correo_enviado=False,
            leido_apoderado=False,
        ))

    db.commit()
    db.refresh(comunicado)

    # Notificar por email y push (background daemon threads)
    try:
        from services.gmail_service import notificar_comunicado_bg
        notificar_comunicado_bg(comunicado.id)
    except Exception:
        pass
    try:
        from services.firebase_service import push_comunicado_bg
        push_comunicado_bg(comunicado.id)
    except Exception:
        pass

    total = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == comunicado.id
    ).count()
    return _enrich_com(comunicado, total, 0)


@router.get("/comunicados/bandeja", response_model=List[ComunicadoResponse])
def tutor_bandeja(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)

    offset = (pagina - 1) * por_pagina
    comunicados = (
        db.query(Comunicado)
        .filter(Comunicado.auxiliar_id == current_user.id)
        .order_by(Comunicado.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    result = []
    for c in comunicados:
        total = db.query(ComunicadoDestinatario).filter(
            ComunicadoDestinatario.comunicado_id == c.id
        ).count()
        leidos = db.query(ComunicadoDestinatario).filter(
            ComunicadoDestinatario.comunicado_id == c.id,
            ComunicadoDestinatario.leido_apoderado == True,
        ).count()
        result.append(_enrich_com(c, total, leidos))

    return result


@router.get("/comunicados/respuestas", response_model=BandejaRespuestasResponse)
def tutor_bandeja_respuestas(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, le=100),
    solo_no_leidas: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Respuestas individuales recibidas por el tutor."""
    _verificar_tutor(current_user)

    no_leidas = (
        db.query(ComunicadoRespuesta)
        .join(ComunicadoDestinatario,
              ComunicadoRespuesta.destinatario_id == ComunicadoDestinatario.id)
        .join(Comunicado,
              ComunicadoDestinatario.comunicado_id == Comunicado.id)
        .filter(
            Comunicado.auxiliar_id == current_user.id,
            ComunicadoRespuesta.leido_auxiliar == False,
        )
        .count()
    )

    q = (
        db.query(ComunicadoRespuesta, ComunicadoDestinatario, Comunicado)
        .join(ComunicadoDestinatario,
              ComunicadoRespuesta.destinatario_id == ComunicadoDestinatario.id)
        .join(Comunicado,
              ComunicadoDestinatario.comunicado_id == Comunicado.id)
        .filter(Comunicado.auxiliar_id == current_user.id)
    )

    if solo_no_leidas:
        q = q.filter(ComunicadoRespuesta.leido_auxiliar == False)

    total = q.count()
    offset = (pagina - 1) * por_pagina
    rows = (
        q.order_by(ComunicadoRespuesta.created_at.desc())
        .offset(offset)
        .limit(por_pagina)
        .all()
    )

    items = []
    for resp, dest, com in rows:
        est = db.query(Estudiante).filter(Estudiante.id == dest.estudiante_id).first()
        if not est:
            continue
        items.append(RespuestaInboxItem(
            id=resp.id,
            dest_id=dest.id,
            comunicado_id=com.id,
            asunto=com.asunto,
            mensaje_comunicado=com.mensaje,
            adjunto_comunicado_nombre=com.adjunto_nombre,
            adjunto_comunicado_url=com.adjunto_drive_url,
            mensaje=resp.mensaje,
            adjunto_nombre=resp.adjunto_nombre,
            adjunto_drive_url=resp.adjunto_drive_url,
            leido_auxiliar=resp.leido_auxiliar,
            leido_auxiliar_at=resp.leido_auxiliar_at,
            created_at=resp.created_at,
            estudiante=EstudianteBasico.model_validate(est),
        ))

    return BandejaRespuestasResponse(items=items, total=total, no_leidas=no_leidas)


@router.get("/comunicados/{comunicado_id}/destinatarios", response_model=List[DestinatarioResponse])
def tutor_destinatarios(
    comunicado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    c = db.query(Comunicado).filter(
        Comunicado.id == comunicado_id,
        Comunicado.auxiliar_id == current_user.id,
    ).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    dests = (
        db.query(ComunicadoDestinatario)
        .filter(ComunicadoDestinatario.comunicado_id == comunicado_id)
        .all()
    )

    result = []
    for d in dests:
        est = db.query(Estudiante).filter(Estudiante.id == d.estudiante_id).first()
        respuestas = (
            db.query(ComunicadoRespuesta)
            .filter(ComunicadoRespuesta.destinatario_id == d.id)
            .order_by(ComunicadoRespuesta.created_at.asc())
            .all()
        )
        result.append(DestinatarioResponse(
            id=d.id,
            estudiante=EstudianteBasico.model_validate(est),
            leido_apoderado=d.leido_apoderado,
            leido_apoderado_at=d.leido_apoderado_at,
            correo_enviado=d.correo_enviado,
            respuestas=[RespuestaResponse.model_validate(r) for r in respuestas],
        ))

    return result


@router.get("/comunicados/{comunicado_id}", response_model=ComunicadoResponse)
def tutor_detalle_comunicado(
    comunicado_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verificar_tutor(current_user)
    c = db.query(Comunicado).filter(
        Comunicado.id == comunicado_id,
        Comunicado.auxiliar_id == current_user.id,
    ).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comunicado no encontrado")

    total = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id
    ).count()
    leidos = db.query(ComunicadoDestinatario).filter(
        ComunicadoDestinatario.comunicado_id == c.id,
        ComunicadoDestinatario.leido_apoderado == True,
    ).count()
    return _enrich_com(c, total, leidos)


@router.put("/comunicados/destinatarios/{dest_id}/marcar-leido", status_code=204)
def tutor_marcar_leido(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Marca todas las respuestas de un destinatario como leídas por el tutor."""
    _verificar_tutor(current_user)
    respuestas = (
        db.query(ComunicadoRespuesta)
        .filter(
            ComunicadoRespuesta.destinatario_id == dest_id,
            ComunicadoRespuesta.leido_auxiliar == False,
        )
        .all()
    )
    for r in respuestas:
        r.leido_auxiliar = True
        r.leido_auxiliar_at = datetime.now()
    db.commit()
