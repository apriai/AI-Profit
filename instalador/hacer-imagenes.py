# Genera las imágenes del instalador a partir de las cuatro del dueño.
# Fuentes: /cursor/stores/bot/instalador-gfx/ (o la carpeta que se pase).
# Salida: instalador/gfx/  y vistas previas en el store si existe.
# La foto es la protagonista: 720x405 (16:9), de borde a borde. El texto cabe
# en una franja oscura de 72 px debajo. No se recorta arriba ni abajo.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/cursor/stores/bot/instalador-gfx")
OUT = ROOT / "instalador" / "gfx"
PREVIEW = SRC / "preview"

FILES = {
    1: "1-escenario.png",
    2: "2-multitud-islas.jpg",
    3: "3-granja-cerca.jpg",
    4: "4-isla-granja.jpg",
}

ANCHO = 720
ALTO = 405  # 720 * 9 / 16. La foto entra entera.
FRANJA = 72
TITULO = 32

NOCHE = (22, 14, 48)
CLARO = (244, 241, 255)
VERDE = (124, 219, 61)
VERDE_TEXTO = (16, 32, 8)


def contener(im, size, fondo=NOCHE):
    """Escala la foto para que se vea completa. No recorta arriba ni abajo."""
    tw, th = size
    sw, sh = im.size
    scale = min(tw / sw, th / sh)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    lienzo = Image.new("RGB", size, fondo)
    lienzo.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return lienzo


def save_bmp(im, path):
    im.convert("RGB").save(path, "BMP")


def font(size, bold=False):
    candidatos = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for c in candidatos:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def boton_bmp(texto, path, w=132, h=36):
    """Pastilla verde. El BMP lleva el fondo noche alrededor: así se ve redonda sobre la franja."""
    im = Image.new("RGB", (w, h), NOCHE)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((1, 1, w - 2, h - 2), radius=h // 2, fill=VERDE)
    f = font(15, True)
    bb = d.textbbox((0, 0), texto, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((w - tw) / 2, (h - th) / 2 - 2), texto, font=f, fill=VERDE_TEXTO)
    save_bmp(im, path)


def mockup(path, frase, imagen, boton=None, barra=False):
    """Ventana: barra de título, foto 16:9 de borde a borde y una franja oscura."""
    W = ANCHO
    H = TITULO + ALTO + FRANJA
    im = Image.new("RGB", (W, H), NOCHE)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, TITULO), fill=(14, 8, 32))
    d.text((14, 7), "AI Profit", font=font(14, True), fill=CLARO)
    foto = Image.open(imagen).convert("RGB")
    if foto.size != (ANCHO, ALTO):
        raise SystemExit(f"{imagen.name} es {foto.size}, se esperaba {ANCHO}x{ALTO}")
    im.paste(foto, (0, TITULO))
    y0 = TITULO + ALTO
    d.rectangle((0, y0, W, H), fill=NOCHE)
    f = font(16, True)
    bb = d.textbbox((0, 0), frase, font=f)
    th = bb[3] - bb[1]
    d.text((22, y0 + (FRANJA - th) / 2 - 1), frase, font=f, fill=CLARO)
    if barra:
        bx, bw, bh = 200, W - 224, 16
        by = y0 + (FRANJA - bh) // 2
        d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8, fill=(42, 28, 78))
        d.rounded_rectangle((bx, by, bx + int(bw * 0.62), by + bh), radius=8, fill=VERDE)
    if boton:
        bw, bh = 132, 36
        bx, by = W - bw - 18, y0 + (FRANJA - bh) // 2
        d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=bh // 2, fill=VERDE)
        fb = font(15, True)
        bb = d.textbbox((0, 0), boton, font=fb)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        d.text((bx + (bw - tw) / 2, by + (bh - th) / 2 - 2), boton, font=fb, fill=VERDE_TEXTO)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
    print("preview", path.name, im.size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fotos = {i: Image.open(SRC / name).convert("RGB") for i, name in FILES.items()}
    for i, im in fotos.items():
        ancho = 1400 if im.width > 1400 else im.width
        alto = int(round(im.height * ancho / im.width))
        chica = im.resize((ancho, alto), Image.Resampling.LANCZOS)
        chica.save(OUT / (Path(FILES[i]).stem + ".jpg"), "JPEG", quality=84, optimize=True)

    marco = (ANCHO, ALTO)
    banners = {i: contener(fotos[i], marco) for i in fotos}
    save_bmp(banners[1], OUT / "p1-bienvenida.bmp")
    save_bmp(banners[2], OUT / "p2-carpeta.bmp")
    save_bmp(banners[3], OUT / "p3-progreso.bmp")
    save_bmp(banners[4], OUT / "p4-listo.bmp")
    boton_bmp("Instalar", OUT / "btn-instalar.bmp")
    boton_bmp("Abrir", OUT / "btn-abrir.bmp")

    if PREVIEW.exists():
        for vieja in PREVIEW.glob("*.png"):
            vieja.unlink()
    # Tres pantallas. La 2 ocupa el progreso (la pantalla de carpeta ya no existe).
    # La 3 se queda en gfx y no se muestra: alternarla al copiar archivos parpadea.
    mockup(PREVIEW / "01-bienvenida.png", "Instalar AI Profit", OUT / "p1-bienvenida.bmp", boton="Instalar")
    mockup(PREVIEW / "02-instalando.png", "Instalando…", OUT / "p2-carpeta.bmp", barra=True)
    mockup(PREVIEW / "03-listo.png", "¡Listo!", OUT / "p4-listo.bmp", boton="Abrir")
    print("ok", OUT)


if __name__ == "__main__":
    main()
