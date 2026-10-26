# LOGO: el escudo de Ripollet en píxel (logoripollet.png, 1254×1254, 1 MB, con una rejilla irregular de 11–19 px)
# → un sprite de verdad, ligero y nítido, para la barra del visor y el favicon (js/logo.js, en base64).
# Cada celda de la rejilla nueva toma el color DOMINANTE de su trozo del dibujo (no la media, que emborronaría los
# bordes) y el blanco de fuera se vuelve transparente rellenando desde el borde (el blanco de dentro del escudo,
# rodeado por el contorno negro, se queda). Se guarda un PNG de 64 px de ancho y otro cuadrado para el favicon.
#   blender --background --factory-startup --python logo_pixel.py -- logoripollet.png
import base64
import os
import sys

import bpy
import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
entrada = sys.argv[sys.argv.index("--") + 1]
im = bpy.data.images.load(os.path.abspath(entrada))
W, H = im.size
rgb = np.array(im.pixels[:], np.float32).reshape(H, W, im.channels)[::-1, :, :3]      # fila 0 arriba
blanco = rgb.min(axis=2) > 0.93
ys, xs = np.where(~blanco)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1

ANCHO = 64
celda = (x1 - x0) / ANCHO
ALTO = round((y1 - y0) / celda)
q = np.round(rgb * 15).astype(np.int32)                       # 4 bits por canal para contar colores
clave = q[..., 0] * 256 + q[..., 1] * 16 + q[..., 2]
sprite = np.zeros((ALTO, ANCHO, 4), np.float32)
fondo = np.zeros((ALTO, ANCHO), bool)
for j in range(ALTO):
    for i in range(ANCHO):
        a, b = int(y0 + j * celda), int(y0 + (j + 1) * celda)
        c, d = int(x0 + i * celda), int(x0 + (i + 1) * celda)
        # el centro de la celda (sin el borde, donde la rejilla original no cuadra)
        m = max(1, int(celda * 0.2))
        trozo = clave[a + m:b - m, c + m:d - m].ravel()
        dominante = np.bincount(trozo).argmax()
        # el color del grupo (4 bits por canal): pocos colores planos, PNG pequeño
        col = np.array([dominante // 256, dominante // 16 % 16, dominante % 16], np.float32) / 15
        sprite[j, i, :3] = col
        sprite[j, i, 3] = 1
        fondo[j, i] = col.min() > 0.9
# Blanco de fuera → transparente: relleno desde el borde por celdas blancas
fuera = np.zeros_like(fondo)
fuera[0, :], fuera[-1, :], fuera[:, 0], fuera[:, -1] = fondo[0, :], fondo[-1, :], fondo[:, 0], fondo[:, -1]
while True:
    v = fuera.copy()
    v[1:] |= fuera[:-1]; v[:-1] |= fuera[1:]; v[:, 1:] |= fuera[:, :-1]; v[:, :-1] |= fuera[:, 1:]
    v &= fondo
    if (v == fuera).all():
        break
    fuera = v
sprite[fuera, 3] = 0
# Filas y columnas vacías fuera
llenas = sprite[..., 3] > 0
f, c = np.where(llenas.any(axis=1))[0], np.where(llenas.any(axis=0))[0]
sprite = sprite[f[0]:f[-1] + 1, c[0]:c[-1] + 1]


def guardar_png(arr, ruta):
    h, w = arr.shape[:2]
    img = bpy.data.images.new("logo", w, h, alpha=True)
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())
    img.filepath_raw = ruta
    img.file_format = "PNG"
    bpy.context.scene.render.image_settings.compression = 100
    img.save()
    return open(ruta, "rb").read()


tmp = os.path.join(DIR, "datos_visor")
os.makedirs(tmp, exist_ok=True)
logo = guardar_png(sprite, os.path.join(tmp, "logo.png"))
h, w = sprite.shape[:2]
# Favicon: solo el escudo (sin la corona, que a 16 px lo dejaría diminuto), centrado en un cuadrado
vacias = np.where(~(sprite[..., 3] > 0).any(axis=1))[0]
escudo = sprite[vacias[0] + 1:] if len(vacias) else sprite
escudo = escudo[np.where((escudo[..., 3] > 0).any(axis=1))[0][0]:]
eh, ew = escudo.shape[:2]
n = max(eh, ew)
cuadro = np.zeros((n, n, 4), np.float32)
cuadro[(n - eh) // 2:(n - eh) // 2 + eh, (n - ew) // 2:(n - ew) // 2 + ew] = escudo
favicon = guardar_png(cuadro, os.path.join(tmp, "favicon.png"))
with open(os.path.join(DIR, "js", "logo.js"), "w", encoding="utf-8") as f:
    f.write("// LOGO: el escudo de Ripollet en píxel (generado por logo_pixel.py, no editar a mano)\n"
            f"export const LOGO_PNG = \"data:image/png;base64,{base64.b64encode(logo).decode()}\";\n"
            f"export const LOGO_TAM = [{w}, {h}];\n"
            "// Favicon (cuadrado)\n"
            "{\n"
            "  const enlace = document.querySelector(\"link[rel=icon]\") ?? document.head.appendChild(document.createElement(\"link\"));\n"
            "  enlace.rel = \"icon\";\n"
            f"  enlace.href = \"data:image/png;base64,{base64.b64encode(favicon).decode()}\";\n"
            "}\n")
print(f"LOGO: {w}×{h} px, {len(logo) / 1024:.1f} KB · favicon {n}×{n}, {len(favicon) / 1024:.1f} KB")
