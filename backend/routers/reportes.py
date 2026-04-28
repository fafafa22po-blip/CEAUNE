"""
Reportes de asistencia para el admin.
Endpoints JSON: /mensual  /alumno/{id}  /aula
Endpoints PDF:  /mensual/pdf  /alumno/{id}/pdf  /aula/pdf
Se registran en main.py bajo el prefijo /admin/reportes.
"""
from datetime import date
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from core.dependencies import get_db, require_roles
from core.tz import hoy as _hoy
from models.asistencia import Asistencia
from models.estudiante import Estudiante
from models.usuario import Usuario

_ROLES_REPORTE = ("admin", "i-auxiliar", "p-auxiliar", "s-auxiliar")
_ROL_TO_NIVEL  = {"i-auxiliar": "inicial", "p-auxiliar": "primaria", "s-auxiliar": "secundaria"}


def _nivel_efectivo(current_user: Usuario, nivel_param: Optional[str]) -> Optional[str]:
    """Devuelve el nivel a filtrar: para auxiliares ignora el parámetro y usa su nivel fijo."""
    if current_user.rol in _ROL_TO_NIVEL:
        return _ROL_TO_NIVEL[current_user.rol]
    return nivel_param or None

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

_MESES_ES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]
_NIVEL_LABEL = {"inicial": "Inicial", "primaria": "Primaria", "secundaria": "Secundaria"}


def _safe(text) -> str:
    """Sanitiza texto para Helvetica (Latin-1) de reportlab."""
    if not text:
        return ""
    text = str(text)
    for src, dst in {
        "\u2014": "-", "\u2013": "-",
        "\u201c": '"', "\u201d": '"',
        "\u2018": "'", "\u2019": "'",
        "\u2026": "...", "\u00b7": ".", "\u2022": "-",
        "\u00ab": '"', "\u00bb": '"',
    }.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


# ─── Helpers de datos (servicio canónico) ─────────────────────────────────────

def _resumen_canonico(
    estudiante_id: str, nivel: str, grado: str, seccion: str,
    fecha_inicio: date, fecha_fin: date, db: Session,
) -> dict:
    """
    Calcula el resumen usando el servicio canónico mes a mes.
    Los números coinciden exactamente con lo que ven apoderado, tutor y auxiliar:
    faltas implícitas incluidas, denominador = días laborables del mes completo.
    """
    from services.asistencia_calc import calcular_resumen_mes

    presentes = tardanzas = faltas = asistidos = dias_lab = 0
    mes = date(fecha_inicio.year, fecha_inicio.month, 1)
    while mes <= fecha_fin:
        r = calcular_resumen_mes(
            estudiante_id, nivel, grado, seccion,
            mes.month, mes.year, db,
        )
        presentes += r["presentes"]
        tardanzas += r["tardanzas"]
        faltas    += r["faltas"]
        asistidos += r["asistidos"]
        dias_lab  += r["dias_lab"]
        # avanzar al siguiente mes
        siguiente_mes = mes.month % 12 + 1
        siguiente_anio = mes.year + (1 if mes.month == 12 else 0)
        mes = date(siguiente_anio, siguiente_mes, 1)

    pct = round((dias_lab - faltas) / dias_lab * 100, 1) if dias_lab > 0 else 100.0
    return {
        "total_dias":            dias_lab,
        "puntual":               presentes,
        "tardanza":              tardanzas,
        "falta":                 faltas,
        "asistencias":           asistidos,
        "porcentaje_asistencia": pct,
    }


def _registros_canonicos(est: Estudiante, fecha_inicio: date, fecha_fin: date, db: Session) -> list:
    """
    Construye la lista de registros diarios usando el servicio canónico.
    Incluye faltas implícitas (días sin registro = falta).
    Solo devuelve hora para tardanzas (único tipo con dato útil en la BD).
    """
    from services.asistencia_calc import calcular_resumen_mes

    estados_total: dict = {}
    mes_iter = date(fecha_inicio.year, fecha_inicio.month, 1)
    while mes_iter <= fecha_fin:
        r_mes = calcular_resumen_mes(
            est.id, est.nivel, est.grado, est.seccion,
            mes_iter.month, mes_iter.year, db,
        )
        for fecha_iso, estado in r_mes["estados"].items():
            d = date.fromisoformat(fecha_iso)
            if fecha_inicio <= d <= fecha_fin:
                estados_total[d] = estado
        sig_mes  = mes_iter.month % 12 + 1
        sig_anio = mes_iter.year + (1 if mes_iter.month == 12 else 0)
        mes_iter = date(sig_anio, sig_mes, 1)

    tardanza_hora: dict = {}
    for a in (
        db.query(Asistencia)
        .filter(
            Asistencia.estudiante_id == est.id,
            Asistencia.fecha >= fecha_inicio,
            Asistencia.fecha <= fecha_fin,
            Asistencia.tipo.in_(["ingreso", "ingreso_especial"]),
            Asistencia.estado == "tardanza",
        )
        .all()
    ):
        tardanza_hora[a.fecha] = a.hora.strftime("%H:%M") if a.hora else "—"

    return [
        {
            "fecha":  d.isoformat(),
            "estado": estados_total[d],
            "hora":   tardanza_hora.get(d, "—"),
        }
        for d in sorted(estados_total)
    ]


def _fila_resumen(est: Estudiante, fecha_inicio: date, fecha_fin: date, db: Session) -> dict:
    res = _resumen_canonico(est.id, est.nivel, est.grado, est.seccion,
                             fecha_inicio, fecha_fin, db)
    return {
        "nombre":                f"{est.nombre} {est.apellido}",
        "nivel":                 est.nivel,
        "grado":                 est.grado,
        "seccion":               est.seccion,
        "total_dias":            res["total_dias"],
        "puntual":               res["puntual"],
        "tardanza":              res["tardanza"],
        "falta":                 res["falta"],
        "porcentaje_asistencia": res["porcentaje_asistencia"],
    }


# ─── Generador PDF: tabla multi-alumno (mensual / aula) ───────────────────────

def _cargar_logo():
    """Carga el logo del colegio desde base64 y retorna un RLImage con proporción correcta."""
    import base64
    from io import BytesIO
    from pathlib import Path
    from reportlab.lib.units import cm
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.utils import ImageReader

    _logo_path = Path(__file__).parent.parent / "logo_b64.txt"
    try:
        _logo_b64   = _logo_path.read_text().strip()
        _logo_bytes = base64.b64decode(_logo_b64)
        _iw, _ih    = ImageReader(BytesIO(_logo_bytes)).getSize()
        _target_h   = 1.8 * cm
        _target_w   = _target_h * (_iw / _ih)
        return RLImage(BytesIO(_logo_bytes), width=_target_w, height=_target_h)
    except Exception:
        return None


def _encabezado_institucional(logo_img, titulo_doc: str, fecha_str: str,
                               usable_w, _ps, MARINO, DORADO, white):
    """Construye el bloque de encabezado institucional estándar (logo + membrete + banda)."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.platypus import Table, TableStyle, Spacer
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph as P

    _logo_cell = logo_img if logo_img else P(
        "CEAUNE", _ps("logo_fb", fontName="Helvetica-Bold", fontSize=16,
                       textColor=DORADO, leading=20)
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
            f"Generado el<br/><b>{fecha_str}</b>",
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
        P(titulo_doc,
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

    return hdr, sub


def _pdf_tabla(titulo: str, subtitulo: str, stats: dict,
               registros: list, generado: date, con_nivel: bool) -> bytes:
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    from reportlab.platypus import Paragraph as P

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

    def _ps(name, **kw):
        d = dict(fontName="Helvetica", fontSize=9,
                 textColor=HexColor("#1e293b"), leading=13)
        d.update(kw)
        return ParagraphStyle(name, **d)

    S_BODY   = _ps("body")
    S_LABEL  = _ps("label", fontSize=7.5, textColor=C_MGRAY, leading=10)
    S_BOLD   = _ps("bold",  fontName="Helvetica-Bold")
    S_SECTION= _ps("sect",  fontName="Helvetica-Bold", fontSize=8,
                   textColor=MARINO, leading=11, spaceAfter=3)
    S_FOOTER = _ps("foot",  fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=10)
    S_WHITE_B= _ps("whiteb",fontName="Helvetica-Bold", fontSize=8, textColor=white, leading=11)
    S_TH     = _ps("th",    fontName="Helvetica-Bold", fontSize=7.5, textColor=white,
                   alignment=TA_CENTER, leading=10)
    S_TD_C   = _ps("tdc",   fontSize=8, alignment=TA_CENTER, leading=11)
    S_TD_L   = _ps("tdl",   fontSize=8, leading=11)

    buf  = BytesIO()
    page = landscape(A4) if len(registros) > 20 else A4
    W, _ = page
    margin   = 1.8 * cm
    usable_w = W - 2 * margin

    doc = SimpleDocTemplate(
        buf, pagesize=page,
        leftMargin=margin, rightMargin=margin,
        topMargin=1.2 * cm, bottomMargin=1.8 * cm,
        title=_safe(titulo),
    )
    story = []

    # ── Encabezado institucional ──
    _logo = _cargar_logo()
    _hdr, _sub = _encabezado_institucional(
        _logo, _safe(titulo), generado.strftime('%d/%m/%Y'),
        usable_w, _ps, MARINO, DORADO, white,
    )
    story.append(_hdr)
    story.append(_sub)
    story.append(Spacer(1, 0.35 * cm))

    # ── Subtítulo / período ──
    story.append(P(_safe(subtitulo), _ps("sub2", fontSize=9, textColor=C_MGRAY, leading=13)))
    story.append(Spacer(1, 0.35 * cm))

    # ── Stats chips ──
    story.append(P("RESUMEN GENERAL", S_SECTION))
    chip_labels = [
        (str(stats["total_alumnos"]), "Alumnos",  HexColor("#eff6ff"), HexColor("#1d4ed8")),
        (str(stats["puntual"]),       "Puntual",  HexColor("#f0fdf4"), C_GREEN),
        (str(stats["tardanza"]),      "Tardanza", HexColor("#fffbeb"), C_AMBER),
        (str(stats["falta"]),         "Falta",    HexColor("#fef2f2"), C_RED),
    ]
    chip_w = usable_w / len(chip_labels)
    chips = Table(
        [[P(v, _ps(f"cv{i}", fontName="Helvetica-Bold", fontSize=15,
                   textColor=tc, alignment=TA_CENTER, leading=18))
          for i, (v, _, _, tc) in enumerate(chip_labels)],
         [P(l, _ps(f"cl{i}", fontSize=7, textColor=C_MGRAY,
                   alignment=TA_CENTER, leading=9))
          for i, (_, l, _, _) in enumerate(chip_labels)]],
        colWidths=[chip_w] * len(chip_labels),
    )
    ts_chips = TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])
    for i, (_, _, bg, _) in enumerate(chip_labels):
        ts_chips.add("BACKGROUND", (i, 0), (i, -1), bg)
    chips.setStyle(ts_chips)
    story.append(chips)
    story.append(Spacer(1, 0.45 * cm))

    # ── Tabla de alumnos ──
    story.append(P("DETALLE POR ALUMNO", S_SECTION))

    cols_h = ["Alumno"]
    if con_nivel:
        cols_h.append("Nivel")
    cols_h += ["Grado", "Puntual", "Tardanza", "Falta", "% Asistencia"]

    # Anchos de columna
    if con_nivel:
        col_w = [usable_w * 0.35, usable_w * 0.10,
                 usable_w * 0.09, usable_w * 0.10,
                 usable_w * 0.10, usable_w * 0.10,
                 usable_w * 0.16]
    else:
        col_w = [usable_w * 0.40, usable_w * 0.10,
                 usable_w * 0.12, usable_w * 0.12,
                 usable_w * 0.12, usable_w * 0.14]

    rows_t = [[P(h, S_TH) for h in cols_h]]
    row_bgs = [MARINO]

    for i, r in enumerate(registros):
        pct = r["porcentaje_asistencia"]
        c_p = _pct_color(pct)
        row = [P(_safe(r["nombre"]), S_TD_L)]
        if con_nivel:
            row.append(P(_safe(_NIVEL_LABEL.get(r["nivel"], r["nivel"])), S_TD_C))
        row += [
            P(f"{r['grado']}° {r['seccion']}", S_TD_C),
            P(str(r["puntual"]),   _ps(f"p{i}", fontSize=8, textColor=C_GREEN, alignment=TA_CENTER, fontName="Helvetica-Bold", leading=11)),
            P(str(r["tardanza"]),  _ps(f"t{i}", fontSize=8, textColor=C_AMBER, alignment=TA_CENTER, fontName="Helvetica-Bold", leading=11)),
            P(str(r["falta"]),     _ps(f"f{i}", fontSize=8, textColor=C_RED,   alignment=TA_CENTER, fontName="Helvetica-Bold", leading=11)),
            P(f"{pct}%",           _ps(f"c{i}", fontSize=8, textColor=c_p,     alignment=TA_CENTER, fontName="Helvetica-Bold", leading=11)),
        ]
        rows_t.append(row)
        row_bgs.append(CREMA if i % 2 == 0 else white)

    tbl = Table(rows_t, colWidths=col_w)
    ts  = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  MARINO),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
    ])
    for i, bg in enumerate(row_bgs[1:], 1):
        ts.add("BACKGROUND", (0, i), (-1, i), bg)
    tbl.setStyle(ts)
    story.append(tbl)

    # ── Pie de página ──
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=C_BORD))
    story.append(Spacer(1, 0.15 * cm))
    story.append(P(
        f"CEAUNE - Reporte de Asistencia  |  "
        f"Documento generado el {generado.strftime('%d/%m/%Y')}",
        S_FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()


# ─── Generador PDF: alumno individual ─────────────────────────────────────────

def _pdf_alumno(est: Estudiante, stats: dict, registros: list, generado: date) -> bytes:
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    from reportlab.platypus import Paragraph as P

    MARINO  = HexColor("#0a1f3d")
    DORADO  = HexColor("#c9a227")
    CREMA   = HexColor("#f8f7f4")
    C_GREEN = HexColor("#16a34a")
    C_AMBER = HexColor("#d97706")
    C_RED   = HexColor("#dc2626")
    C_MGRAY = HexColor("#64748b")
    C_BORD  = HexColor("#e2e8f0")

    def _pct_color(p):
        if p >= 90: return C_GREEN
        if p >= 75: return C_AMBER
        return C_RED

    def _ps(name, **kw):
        d = dict(fontName="Helvetica", fontSize=9,
                 textColor=HexColor("#1e293b"), leading=13)
        d.update(kw)
        return ParagraphStyle(name, **d)

    S_BODY   = _ps("body")
    S_LABEL  = _ps("label", fontSize=7.5, textColor=C_MGRAY, leading=10)
    S_BOLD   = _ps("bold",  fontName="Helvetica-Bold")
    S_SECTION= _ps("sect",  fontName="Helvetica-Bold", fontSize=8,
                   textColor=MARINO, leading=11, spaceAfter=3)
    S_FOOTER = _ps("foot",  fontSize=7, textColor=C_MGRAY, alignment=TA_CENTER, leading=10)
    S_WHITE_B= _ps("whiteb",fontName="Helvetica-Bold", fontSize=8, textColor=white, leading=11)

    buf  = BytesIO()
    W, _ = A4
    margin   = 1.8 * cm
    usable_w = W - 2 * margin

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=1.2 * cm, bottomMargin=1.8 * cm,
        title=_safe(f"Reporte - {est.apellido}, {est.nombre}"),
    )
    story = []

    # ── Encabezado institucional ──
    _logo = _cargar_logo()
    _hdr, _sub = _encabezado_institucional(
        _logo, "REPORTE INDIVIDUAL DE ASISTENCIA", generado.strftime('%d/%m/%Y'),
        usable_w, _ps, MARINO, DORADO, white,
    )
    story.append(_hdr)
    story.append(_sub)
    story.append(Spacer(1, 0.45 * cm))

    # ── Datos del alumno ──
    story.append(P("DATOS DEL ALUMNO", S_SECTION))
    nivel_label = _NIVEL_LABEL.get(est.nivel, est.nivel.capitalize())
    info = Table([
        [P("Apellidos y Nombres", S_LABEL), P("DNI", S_LABEL),
         P("Grado y Seccion", S_LABEL)],
        [P(_safe(f"{est.nombre} {est.apellido}"), S_BOLD),
         P(_safe(est.dni or "S/D"), S_BOLD),
         P(_safe(f"{est.grado} grado - Sec. {est.seccion} - {nivel_label}"), S_BOLD)],
    ], colWidths=[usable_w * 0.46, usable_w * 0.20, usable_w * 0.34])
    info.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), CREMA),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, 0),  9),
    ]))
    story.append(info)
    story.append(Spacer(1, 0.45 * cm))

    # ── Stats ──
    story.append(P("RESUMEN DE ASISTENCIA", S_SECTION))
    pct   = stats["porcentaje_asistencia"]
    c_pct = _pct_color(pct)

    chip_labels = [
        (str(stats["puntual"]),   "Puntual",  HexColor("#f0fdf4"), C_GREEN),
        (str(stats["tardanza"]),  "Tardanza", HexColor("#fffbeb"), C_AMBER),
        (str(stats["falta"]),     "Falta",    HexColor("#fef2f2"), C_RED),
        (str(stats["total_dias"]),"Dias reg.", HexColor("#f8fafc"), MARINO),
    ]
    chip_w = (usable_w - 3.5 * cm) / len(chip_labels)
    chips_rows = [
        [P(v, _ps(f"cv{i}", fontName="Helvetica-Bold", fontSize=15,
                  textColor=tc, alignment=TA_CENTER, leading=18))
         for i, (v, _, _, tc) in enumerate(chip_labels)],
        [P(l, _ps(f"cl{i}", fontSize=7, textColor=C_MGRAY,
                  alignment=TA_CENTER, leading=9))
         for i, (_, l, _, _) in enumerate(chip_labels)],
    ]
    chips = Table(chips_rows, colWidths=[chip_w] * len(chip_labels))
    ts_c  = TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])
    for i, (_, _, bg, _) in enumerate(chip_labels):
        ts_c.add("BACKGROUND", (i, 0), (i, -1), bg)
    chips.setStyle(ts_c)

    attend = Table([[
        P(f"{pct}%", _ps("pct", fontName="Helvetica-Bold", fontSize=26,
                          textColor=c_pct, alignment=TA_CENTER, leading=30)),
        chips,
    ]], colWidths=[3.5 * cm, usable_w - 3.5 * cm])
    attend.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), HexColor("#f8fafc")),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
        ("LINEBEFORE",    (1, 0), (1, -1),  0.5, C_BORD),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (0,  -1), 10),
        ("LEFTPADDING",   (1, 0), (1,  -1), 10),
        ("RIGHTPADDING",  (1, 0), (1,  -1), 10),
    ]))
    story.append(attend)
    story.append(Spacer(1, 0.45 * cm))

    # ── Detalle de incidencias (solo faltas y tardanzas) ──
    incidencias = [r for r in registros if r["estado"] in ("falta", "tardanza")]

    story.append(P(
        f"INCIDENCIAS DEL PERÍODO  "
        f"<font size='7' color='#64748b'>({len(incidencias)} registros — "
        f"días puntuales no se listan)</font>",
        S_SECTION,
    ))

    if not incidencias:
        story.append(P(
            "Sin faltas ni tardanzas en el período seleccionado.",
            _ps("ok", fontSize=9, textColor=C_GREEN, leading=13),
        ))
    else:
        _estado_color = {"tardanza": C_AMBER, "falta": C_RED}
        rows_t = [[
            P("Fecha",  S_WHITE_B),
            P("Estado", S_WHITE_B),
            P("Hora",   S_WHITE_B),
        ]]
        for i, r in enumerate(incidencias):
            c = _estado_color.get(r["estado"], C_MGRAY)
            rows_t.append([
                P(_safe(r["fecha"]), _ps(f"fd{i}", fontSize=8, leading=11)),
                P(_safe(r["estado"].capitalize()),
                  _ps(f"fe{i}", fontSize=8, fontName="Helvetica-Bold", textColor=c, leading=11)),
                P(_safe(r.get("hora", "—")),
                  _ps(f"fh{i}", fontSize=8, alignment=TA_CENTER, leading=11)),
            ])

        col_w = [usable_w * 0.40, usable_w * 0.35, usable_w * 0.25]
        tbl = Table(rows_t, colWidths=col_w, repeatRows=1)
        ts  = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  MARINO),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_BORD),
            ("INNERGRID",     (0, 0), (-1, -1), 0.25, C_BORD),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [CREMA, white]),
        ])
        tbl.setStyle(ts)
        story.append(tbl)

    # ── Pie ──
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=C_BORD))
    story.append(Spacer(1, 0.15 * cm))
    story.append(P(
        f"CEAUNE - Reporte Individual de Asistencia  |  "
        f"Documento generado el {generado.strftime('%d/%m/%Y')}",
        S_FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()


# ─── Endpoints JSON ────────────────────────────────────────────────────────────

@router.get("/mensual")
def reporte_mensual(
    fecha_inicio: date = Query(...),
    fecha_fin:    date = Query(...),
    nivel:        Optional[str] = Query(None),
    db:           Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")
    nivel = _nivel_efectivo(current_user, nivel)
    q = db.query(Estudiante).filter(Estudiante.activo == True)
    if nivel:
        q = q.filter(Estudiante.nivel == nivel)
    estudiantes = q.order_by(Estudiante.apellido, Estudiante.nombre).all()
    registros = [_fila_resumen(est, fecha_inicio, fecha_fin, db) for est in estudiantes]
    return {
        "estadisticas": {
            "total_alumnos": len(registros),
            "puntual":       sum(r["puntual"]  for r in registros),
            "tardanza":      sum(r["tardanza"] for r in registros),
            "falta":         sum(r["falta"]    for r in registros),
        },
        "registros": registros,
    }


@router.get("/alumno/{estudiante_id}")
def reporte_alumno(
    estudiante_id: str,
    fecha_inicio:  date = Query(...),
    fecha_fin:     date = Query(...),
    db:            Session = Depends(get_db),
    current_user:  Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado")
    nivel_fijo = _ROL_TO_NIVEL.get(current_user.rol)
    if nivel_fijo and est.nivel != nivel_fijo:
        raise HTTPException(403, "Solo puedes consultar alumnos de tu nivel")
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")
    res = _resumen_canonico(est.id, est.nivel, est.grado, est.seccion,
                             fecha_inicio, fecha_fin, db)
    return {
        "alumno": {
            "nombre": f"{est.nombre} {est.apellido}",
            "nivel": est.nivel, "grado": est.grado, "seccion": est.seccion,
        },
        "estadisticas": {
            "total_dias":            res["total_dias"],
            "puntual":               res["puntual"],
            "tardanza":              res["tardanza"],
            "falta":                 res["falta"],
            "porcentaje_asistencia": res["porcentaje_asistencia"],
        },
        "registros": _registros_canonicos(est, fecha_inicio, fecha_fin, db),
    }


@router.get("/aula")
def reporte_aula(
    grado:        str = Query(...),
    seccion:      str = Query(...),
    fecha_inicio: date = Query(...),
    fecha_fin:    date = Query(...),
    nivel:        Optional[str] = Query(None),
    db:           Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")
    nivel = _nivel_efectivo(current_user, nivel)
    q = db.query(Estudiante).filter(
        Estudiante.activo  == True,
        Estudiante.grado   == grado,
        Estudiante.seccion == seccion.strip().upper(),
    )
    if nivel:
        q = q.filter(Estudiante.nivel == nivel)
    estudiantes = q.order_by(Estudiante.apellido, Estudiante.nombre).all()
    registros = [_fila_resumen(est, fecha_inicio, fecha_fin, db) for est in estudiantes]
    return {
        "estadisticas": {
            "total_alumnos": len(registros),
            "puntual":       sum(r["puntual"]  for r in registros),
            "tardanza":      sum(r["tardanza"] for r in registros),
            "falta":         sum(r["falta"]    for r in registros),
        },
        "registros": registros,
    }


# ─── Endpoints PDF ─────────────────────────────────────────────────────────────

@router.get("/mensual/pdf")
@limiter.limit("10/minute")
def reporte_mensual_pdf(
    request: Request,
    fecha_inicio: date = Query(...),
    fecha_fin:    date = Query(...),
    nivel:        Optional[str] = Query(None),
    db:           Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")
    nivel = _nivel_efectivo(current_user, nivel)
    q = db.query(Estudiante).filter(Estudiante.activo == True)
    if nivel:
        q = q.filter(Estudiante.nivel == nivel)
    estudiantes = q.order_by(Estudiante.apellido, Estudiante.nombre).all()
    registros = [_fila_resumen(est, fecha_inicio, fecha_fin, db) for est in estudiantes]
    stats = {
        "total_alumnos": len(registros),
        "puntual":       sum(r["puntual"]  for r in registros),
        "tardanza":      sum(r["tardanza"] for r in registros),
        "falta":         sum(r["falta"]    for r in registros),
    }
    nivel_txt = f" - {_NIVEL_LABEL.get(nivel, nivel)}" if nivel else ""
    titulo    = f"Reporte Mensual de Asistencia{nivel_txt}"
    subtitulo = f"Periodo: {fecha_inicio.strftime('%d/%m/%Y')} al {fecha_fin.strftime('%d/%m/%Y')}"

    pdf = _pdf_tabla(titulo, subtitulo, stats, registros, _hoy(), con_nivel=True)
    nombre = f"Reporte_Mensual_{fecha_inicio}_{fecha_fin}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@router.get("/aula/pdf")
@limiter.limit("10/minute")
def reporte_aula_pdf(
    request: Request,
    grado:        str = Query(...),
    seccion:      str = Query(...),
    fecha_inicio: date = Query(...),
    fecha_fin:    date = Query(...),
    nivel:        Optional[str] = Query(None),
    db:           Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")
    nivel = _nivel_efectivo(current_user, nivel)
    q = db.query(Estudiante).filter(
        Estudiante.activo  == True,
        Estudiante.grado   == grado,
        Estudiante.seccion == seccion.strip().upper(),
    )
    if nivel:
        q = q.filter(Estudiante.nivel == nivel)
    estudiantes = q.order_by(Estudiante.apellido, Estudiante.nombre).all()
    registros = [_fila_resumen(est, fecha_inicio, fecha_fin, db) for est in estudiantes]
    stats = {
        "total_alumnos": len(registros),
        "puntual":       sum(r["puntual"]  for r in registros),
        "tardanza":      sum(r["tardanza"] for r in registros),
        "falta":         sum(r["falta"]    for r in registros),
    }
    nivel_txt = f" - {_NIVEL_LABEL.get(nivel, nivel)}" if nivel else ""
    titulo    = f"Reporte de Aula {grado}{seccion.upper()}{nivel_txt}"
    subtitulo = f"Periodo: {fecha_inicio.strftime('%d/%m/%Y')} al {fecha_fin.strftime('%d/%m/%Y')}"

    pdf = _pdf_tabla(titulo, subtitulo, stats, registros, _hoy(), con_nivel=False)
    nombre = f"Reporte_Aula_{grado}{seccion.upper()}_{fecha_inicio}_{fecha_fin}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@router.get("/alumno/{estudiante_id}/pdf")
@limiter.limit("10/minute")
def reporte_alumno_pdf(
    request: Request,
    estudiante_id: str,
    fecha_inicio:  date = Query(...),
    fecha_fin:     date = Query(...),
    db:            Session = Depends(get_db),
    current_user:  Usuario = Depends(require_roles(*_ROLES_REPORTE)),
):
    est = db.query(Estudiante).filter(Estudiante.id == estudiante_id).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado")
    nivel_fijo = _ROL_TO_NIVEL.get(current_user.rol)
    if nivel_fijo and est.nivel != nivel_fijo:
        raise HTTPException(403, "Solo puedes consultar alumnos de tu nivel")
    if fecha_fin < fecha_inicio:
        raise HTTPException(400, "fecha_fin debe ser >= fecha_inicio")

    res      = _resumen_canonico(est.id, est.nivel, est.grado, est.seccion,
                                  fecha_inicio, fecha_fin, db)
    registros = _registros_canonicos(est, fecha_inicio, fecha_fin, db)

    pdf = _pdf_alumno(est, res, registros, _hoy())
    nombre = f"Reporte_{est.apellido}_{est.nombre}_{fecha_inicio}_{fecha_fin}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
