# Dibuja el icono de Profito (cara verde) a cada tamaño, desde la geometría,
# no agrandando el PNG de 192. Escribe el .ico y los PNG que usa la página.
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
TAMANOS_ICO = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)


def maestro(tam=1024):
    # Una sola pintura grande. Cada tamaño del .ico sale de aquí, hacia abajo.
    im = Image.new('RGBA', (tam, tam), (0, 0, 0, 0))
    px = im.load()
    c = (tam - 1) / 2
    radio = tam * 0.46
    luz = (0.35, -0.55, 0.76)
    ln = (luz[0] ** 2 + luz[1] ** 2 + luz[2] ** 2) ** 0.5
    luz = tuple(v / ln for v in luz)
    for y in range(tam):
        for x in range(tam):
            cobertura = 0
            rojo = verde = azul = 0.0
            for sy in (0.25, 0.75):
                for sx in (0.25, 0.75):
                    dx = (x + sx - c) / radio
                    dy = (y + sy - c) / radio
                    rr = dx * dx + dy * dy
                    if rr >= 1:
                        continue
                    cobertura += 1
                    nz = (1 - rr) ** 0.5
                    ndot = max(0.0, dx * luz[0] + dy * luz[1] + nz * luz[2])
                    spec = ndot ** 40
                    r = 168 + 70 * ndot + 40 * spec
                    g = 196 + 50 * ndot + 20 * spec
                    b = 10 + 40 * ndot + 80 * spec
                    borde = max(0.0, (rr - 0.86) / 0.14)
                    r = r * (1 - 0.35 * borde) + 40 * borde
                    g = g * (1 - 0.25 * borde) + 70 * borde
                    b = b * (1 - 0.2 * borde)
                    rojo += r
                    verde += g
                    azul += b
            if not cobertura:
                continue
            px[x, y] = (int(rojo / cobertura), int(verde / cobertura), int(azul / cobertura), int(255 * cobertura / 4))
    d = ImageDraw.Draw(im)
    ancho = tam * 0.105
    alto = tam * 0.20
    radio_ojo = ancho / 2
    sep = tam * 0.075
    cy = tam * 0.44
    cx = tam / 2
    for signo in (-1, 1):
        ox = cx + signo * (sep + ancho / 2)
        box = [ox - ancho / 2, cy - alto / 2, ox + ancho / 2, cy + alto / 2]
        d.rounded_rectangle(box, radius=radio_ojo, fill=(28, 32, 36, 255))
    return im


def a_tamano(base, tam):
    if base.size[0] == tam:
        return base.copy()
    return base.resize((tam, tam), Image.Resampling.LANCZOS)


def png_bytes(im):
    buf = BytesIO()
    im.save(buf, format='PNG')
    return buf.getvalue()


def escribir_ico(ruta, imagenes):
    blob = bytearray()
    blob += struct.pack('<HHH', 0, 1, len(imagenes))
    offset = 6 + 16 * len(imagenes)
    partes = []
    for tam, im in imagenes:
        raw = png_bytes(im)
        partes.append(raw)
        dim = 0 if tam >= 256 else tam
        blob += struct.pack('<BBBBHHII', dim, dim, 0, 0, 1, 32, len(raw), offset)
        offset += len(raw)
    for raw in partes:
        blob += raw
    ruta.write_bytes(blob)


def main():
    base = maestro(1024)
    base.save(AQUI / 'profito-icon-1024.png')
    por_tam = {tam: a_tamano(base, tam) for tam in TAMANOS_ICO}
    por_tam[512] = a_tamano(base, 512)
    por_tam[192] = a_tamano(base, 192)
    por_tam[180] = a_tamano(base, 180)
    por_tam[512].save(AQUI / 'favicon-512.png')
    por_tam[192].save(AQUI / 'favicon-192.png')
    por_tam[180].save(AQUI / 'apple-touch-icon.png')
    imagenes = [(tam, por_tam[tam]) for tam in TAMANOS_ICO]
    escribir_ico(AQUI / 'profito.ico', imagenes)
    escribir_ico(AQUI / 'abrir-granja-icon.ico', imagenes)
    print('listo', len(TAMANOS_ICO), 'tamaños')


if __name__ == '__main__':
    main()
