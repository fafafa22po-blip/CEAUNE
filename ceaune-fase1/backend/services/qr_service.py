import io
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Colores CEAUNE
NAVY  = (10, 31, 61)      # #0a1f3d
GOLD  = (201, 162, 39)    # #c9a227
WHITE = (255, 255, 255)
LIGHT = (240, 244, 248)   # fondo gris muy claro


def _load_font(size: int) -> ImageFont.ImageFont:
    """Carga Liberation Sans si está disponible, si no usa la fuente por defecto."""
    candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def generar_qr_bytes(qr_token: str) -> bytes:
    """Genera solo el QR (PNG) con colores CEAUNE. Usado para escaneo."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_token)
    qr.make(fit=True)
    img = qr.make_image(fill_color=NAVY, back_color=WHITE)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.read()


def generar_qr_card_bytes(
    qr_token: str,
    nombre: str,
    apellido: str,
    grado: str,
    seccion: str,
    dni: str,
) -> bytes:
    """
    Genera una tarjeta de identificación completa con:
    - Header CEAUNE
    - QR code centrado
    - Nombre, grado/sección y DNI del alumno
    """
    CARD_W = 400
    PAD    = 20
    HEADER_H = 60
    FOOTER_H = 90

    # 1. Generar QR
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=3,
    )
    qr.add_data(qr_token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=NAVY, back_color=WHITE).convert("RGB")
    qr_size = qr_img.size[0]

    CARD_H = HEADER_H + PAD + qr_size + PAD + FOOTER_H

    # 2. Canvas
    card = Image.new("RGB", (CARD_W, CARD_H), LIGHT)
    draw = ImageDraw.Draw(card)

    # 3. Header navy
    draw.rectangle([0, 0, CARD_W, HEADER_H], fill=NAVY)

    font_title  = _load_font(20)
    font_sub    = _load_font(13)
    font_name   = _load_font(18)
    font_small  = _load_font(13)

    # Título en el header
    title = "CEAUNE"
    subtitle = "Carnet de Asistencia"
    try:
        tw = draw.textlength(title, font=font_title)
        sw = draw.textlength(subtitle, font=font_sub)
    except AttributeError:
        tw, sw = 80, 120  # fallback para PIL antiguo

    draw.text(((CARD_W - tw) / 2, 8),  title,    font=font_title, fill=GOLD)
    draw.text(((CARD_W - sw) / 2, 35), subtitle, font=font_sub,   fill=WHITE)

    # 4. QR centrado
    qr_x = (CARD_W - qr_size) // 2
    qr_y = HEADER_H + PAD
    card.paste(qr_img, (qr_x, qr_y))

    # Borde dorado alrededor del QR
    draw.rectangle(
        [qr_x - 3, qr_y - 3, qr_x + qr_size + 3, qr_y + qr_size + 3],
        outline=GOLD, width=3,
    )

    # 5. Footer con datos del alumno
    footer_y = qr_y + qr_size + PAD
    draw.rectangle([0, footer_y - PAD // 2, CARD_W, CARD_H], fill=NAVY)

    full_name = f"{nombre} {apellido}"
    grade_txt = f"{grado} '{seccion}'  ·  Secundaria"
    dni_txt   = f"DNI: {dni}"

    try:
        nw = draw.textlength(full_name, font=font_name)
        gw = draw.textlength(grade_txt, font=font_small)
        dw = draw.textlength(dni_txt,   font=font_small)
    except AttributeError:
        nw, gw, dw = 160, 140, 100

    draw.text(((CARD_W - nw) / 2, footer_y),      full_name, font=font_name,  fill=GOLD)
    draw.text(((CARD_W - gw) / 2, footer_y + 28), grade_txt, font=font_small, fill=WHITE)
    draw.text(((CARD_W - dw) / 2, footer_y + 50), dni_txt,   font=font_small, fill=LIGHT)

    # 6. Serializar
    buffer = io.BytesIO()
    card.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer.read()
