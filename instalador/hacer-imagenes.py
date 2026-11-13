# Genera las imágenes del instalador a partir de las cuatro del dueño.
# Fuentes: /cursor/stores/bot/instalador-gfx/ (o la carpeta que se pase).
# Salida: instalador/gfx/  y vistas previas en el store si existe.
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


ANCHO = 496
ALTO = 279  # 496 * 9 / 16. La foto entra entera; si no es 16:9, sobra margen a los lados.


def contener(im, size, fondo=(246, 241, 255)):
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


def mockup(banner, titulo, lineas, botones, destino):
    W, H = 548, 620
    img = Image.new("RGB", (W, H), "#f6f1ff")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 36), fill="#3a1d6e")
    d.text((16, 8), "Instalar Profito", font=font(16, True), fill="white")
    d.text((W - 28, 6), "×", font=font(18, True), fill="white")
    x = (W - banner.width) // 2
    img.paste(banner, (x, 48))
    y = 48 + banner.height + 18
    d.text((26, y), titulo, font=font(24, True), fill="#2a1848")
    y += 36
    for linea in lineas:
        d.text((26, y), linea, font=font(16), fill="#3d3454")
        y += 26
    bx = W - 24
    for texto, fondo, tinta in reversed(botones):
        tw = 118
        bx -= tw + 10
        d.rounded_rectangle((bx, H - 58, bx + tw, H - 22), 8, fill=fondo)
        bb = d.textbbox((0, 0), texto, font=font(15, True))
        d.text((bx + (tw - (bb[2] - bb[0])) / 2, H - 50), texto, font=font(15, True), fill=tinta)
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, "PNG", optimize=True)


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

    verde = ("#7cdb3d", "#1a2a08")
    gris = ("#efeaf8", "#3a1d6e")
    mockup(banners[1], "Hola. Soy Profito.", [
        "Voy a poner tu granja en esta computadora.",
        "Pulsa Siguiente. Es fácil.",
        "No pide la contraseña de administrador.",
    ], [("Cancelar", *gris), ("Siguiente", *verde)], PREVIEW / "01-bienvenida.png")
    mockup(banners[2], "¿Dónde la guardo?", [
        "La dejo en tu carpeta. Así está bien.",
        "Si quieres otro sitio, pulsa Examinar.",
        "C:\\Users\\Tu\\AppData\\Local\\Profito",
    ], [("Atrás", *gris), ("Cancelar", *gris), ("Siguiente", *verde)], PREVIEW / "02-carpeta.png")
    mockup(banners[3], "Instalando tu granja", [
        "Espera un momentito.",
        "No cierres esta ventana.",
    ], [("Cancelar", *gris)], PREVIEW / "03-progreso.png")
    mockup(banners[4], "¡Listo!", [
        "Profito ya está en tu computadora.",
        "En el escritorio verás AI Profit.",
        "Ábrelo con doble clic.",
    ], [("Cerrar", *verde)], PREVIEW / "04-listo.png")
    print("ok", OUT)


if __name__ == "__main__":
    main()
