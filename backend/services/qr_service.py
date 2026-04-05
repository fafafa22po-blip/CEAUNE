import io
import uuid

import qrcode
import qrcode.constants
from PIL import Image, ImageDraw, ImageFont

# Colores corporativos CEAUNE
COLOR_MARINO = "#0a1f3d"
COLOR_DORADO = "#c9a227"
COLOR_BLANCO = "#ffffff"


def generar_qr_token() -> str:
    """Genera un token único para el QR del estudiante."""
    return f"CEAUNE-{uuid.uuid4().hex[:16].upper()}"


def generar_qr_solo_png(qr_token: str) -> bytes:
    """
    Genera solo el código QR limpio sin decoraciones (para carnets).
    Retorna los bytes del PNG.
    """
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=COLOR_MARINO, back_color=COLOR_BLANCO).convert("RGB")
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def generar_qr_png(
    qr_token: str,
    nombre: str = "",
    apellido: str = "",
    nivel: str = "",
    grado: str = "",
    seccion: str = "",
) -> bytes:
    """
    Genera una imagen PNG con el código QR del estudiante.
    Incluye nombre, nivel, grado y sección debajo del QR.
    Retorna los bytes del PNG.
    """
    # --- Generar el QR ---
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=3,
    )
    qr.add_data(qr_token)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color=COLOR_MARINO, back_color=COLOR_BLANCO).convert("RGB")
    qr_w, qr_h = qr_img.size

    # --- Crear lienzo con margen para el texto ---
    padding = 20
    text_area_h = 90
    canvas_w = qr_w + padding * 2
    canvas_h = qr_h + text_area_h + padding * 2

    canvas = Image.new("RGB", (canvas_w, canvas_h), COLOR_BLANCO)

    # Franja superior dorada
    top_bar = Image.new("RGB", (canvas_w, 14), COLOR_DORADO)
    canvas.paste(top_bar, (0, 0))

    # Pegar QR centrado
    qr_x = (canvas_w - qr_w) // 2
    canvas.paste(qr_img, (qr_x, padding + 10))

    # --- Texto con PIL ---
    draw = ImageDraw.Draw(canvas)

    # Intentar usar una fuente del sistema; si no, usar la default de PIL
    try:
        font_name  = ImageFont.truetype("arial.ttf", 22)
        font_small = ImageFont.truetype("arial.ttf", 16)
        font_token = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font_name  = ImageFont.load_default()
        font_small = font_name
        font_token = font_name

    y_text = qr_h + padding + 18

    # Nombre completo
    nombre_completo = f"{nombre} {apellido}".strip()
    _draw_centered(draw, canvas_w, y_text, nombre_completo, font_name, COLOR_MARINO)

    # Nivel / Grado / Sección
    y_text += 28
    info = f"{nivel.capitalize()}  |  {grado}  {seccion}".strip(" |")
    _draw_centered(draw, canvas_w, y_text, info, font_small, "#555555")

    # Token (pequeño, para referencia)
    y_text += 24
    _draw_centered(draw, canvas_w, y_text, qr_token, font_token, "#aaaaaa")

    # Franja inferior dorada
    bottom_bar = Image.new("RGB", (canvas_w, 8), COLOR_DORADO)
    canvas.paste(bottom_bar, (0, canvas_h - 8))

    # --- Exportar como bytes PNG ---
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _draw_centered(draw: ImageDraw.Draw, canvas_w: int, y: int, text: str, font, color: str):
    """Dibuja texto centrado horizontalmente."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = (canvas_w - text_w) // 2
    draw.text((x, y), text, fill=color, font=font)
