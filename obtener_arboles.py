# ÁRBOLES REALES a partir del LiDAR del ICGC (vuelo 2021–2023, 1 m): altura de la vegetación = modelo «terreno +
# edificios + vegetación» − modelo «terreno + edificios». En ese mapa de alturas de copas se busca la cima de cada
# árbol (máximo local), se reparte la copa entre cimas vecinas y sale cada árbol con su altura y su radio reales.
# En OSM solo hay 23 árboles mapeados en la zona: el resto de la maqueta los inventaba.
#
# El WMS del ICGC devuelve imágenes en grises autoescaladas (0–255 entre el mínimo y el máximo de cada petición) y
# GetFeatureInfo devuelve el valor real de un punto: con el más bajo y el más alto de cada tesela se pasa de gris a
# metros (comprobado: lineal, error < 4 cm). Unas 300 peticiones, una a una; todo queda en caché en datos_arboles/.
# Guarda datos_arboles/arboles_lidar.json y vegetacion_1m.bin (Uint8, altura en pasos de 0,2 m).
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_arboles.py
import json
import math
import os
import re
import struct
import time
import urllib.parse
import urllib.request
import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
WMS = "https://geoserveis.icgc.cat/servei/catalunya/elevacions-territorial/wms"
CAPAS = {"veg": "model-elevacions-terreny-edificis-vegetacio-catalunya-lidar-1m-2021-2023",
         "edif": "model-elevacions-terreny-edificis-catalunya-lidar-1m-2021-2023"}
CARPETA = os.path.join(DIR, "datos_arboles")
os.makedirs(os.path.join(CARPETA, "teselas"), exist_ok=True)

with open(os.path.join(DIR, "datos_visor", "datos.json"), encoding="utf-8") as f:
    sim = json.load(f)["sim"]
F = int(sim["celda"])
nx, ny = sim["nx"] * F, sim["ny"] * F                     # rejilla de 1 m (la de las aceras)
lon_min, lon_max = LON0 + sim["x0"] / KX, LON0 + (sim["x0"] + nx) / KX
lat_max, lat_min = LAT0 - sim["z0"] / KY, LAT0 - (sim["z0"] + ny) / KY
TX, TY = 6, 8


def pedir(params, intentos=4):
    url = WMS + "?" + urllib.parse.urlencode(params)
    for k in range(intentos):
        try:
            pet = urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"})
            return urllib.request.urlopen(pet, timeout=120).read()
        except OSError:
            if k == intentos - 1:
                raise
            time.sleep(3 * (k + 1))


def leer_tiff(datos):
    """TIFF sin comprimir, RGB de 8 bits por tiras (lo que da este WMS) → canal rojo (= gris)."""
    assert datos[:4] == b"II*\x00", "no es un TIFF little-endian"
    ifd = struct.unpack("<I", datos[4:8])[0]
    etiquetas = {}
    for e in range(struct.unpack("<H", datos[ifd:ifd + 2])[0]):
        t, tipo, n, v = struct.unpack("<HHII", datos[ifd + 2 + 12 * e: ifd + 14 + 12 * e])
        if t not in (256, 257, 259, 273, 277, 279) or tipo not in (3, 4):
            continue                       # solo hacen falta tamaño, compresión, canales y tiras
        tam = 2 if tipo == 3 else 4
        if n * tam > 4:
            fmt = "<" + ("H" if tipo == 3 else "I") * n
            etiquetas[t] = list(struct.unpack(fmt, datos[v:v + n * tam]))
        else:
            etiquetas[t] = [v & 0xFFFF if tipo == 3 else v]
    w, h, comp, spp = etiquetas[256][0], etiquetas[257][0], etiquetas[259][0], etiquetas[277][0]
    assert comp == 1, "TIFF comprimido"
    crudo = b"".join(datos[o:o + c] for o, c in zip(etiquetas[273], etiquetas[279]))
    return np.frombuffer(crudo, np.uint8)[:w * h * spp].reshape(h, w, spp)[..., 0]


def tesela(capa, tx, ty):
    """Metros (float32) de una tesela, con caché."""
    ruta = os.path.join(CARPETA, "teselas", f"{capa}_{tx}_{ty}.npy")
    if os.path.exists(ruta):
        return np.load(ruta)
    i0, i1 = tx * nx // TX, (tx + 1) * nx // TX
    j0, j1 = ty * ny // TY, (ty + 1) * ny // TY
    lo0, lo1 = lon_min + (lon_max - lon_min) * i0 / nx, lon_min + (lon_max - lon_min) * i1 / nx
    la1, la0 = lat_max - (lat_max - lat_min) * j0 / ny, lat_max - (lat_max - lat_min) * j1 / ny
    base = {"SERVICE": "WMS", "VERSION": "1.1.1", "LAYERS": CAPAS[capa], "STYLES": "", "SRS": "EPSG:4326",
            "BBOX": f"{lo0},{la0},{lo1},{la1}", "WIDTH": i1 - i0, "HEIGHT": j1 - j0}
    gris = leer_tiff(pedir({**base, "REQUEST": "GetMap", "FORMAT": "image/tiff"})).astype(np.float32)
    assert gris.shape == (j1 - j0, i1 - i0), (gris.shape, capa, tx, ty)

    def valor(j, i):
        t = pedir({**base, "REQUEST": "GetFeatureInfo", "QUERY_LAYERS": CAPAS[capa], "X": int(i), "Y": int(j),
                   "INFO_FORMAT": "text/plain"}).decode("utf-8", "replace")
        return float(re.search(r"value_0 = '([-0-9.eE]+)'", t).group(1))

    # Gris → metros con el punto más bajo y el más alto de la tesela, y un tercero para comprobar
    jb, ib = np.unravel_index(gris.argmin(), gris.shape)
    ja, ia = np.unravel_index(gris.argmax(), gris.shape)
    vb, va = valor(jb, ib), valor(ja, ia)
    if gris[ja, ia] == gris[jb, ib]:
        metros = np.full(gris.shape, vb, np.float32)
    else:
        a = (va - vb) / (gris[ja, ia] - gris[jb, ib])
        metros = (vb + a * (gris - gris[jb, ib])).astype(np.float32)
        jm, im = gris.shape[0] // 2, gris.shape[1] // 2
        error = abs(valor(jm, im) - metros[jm, im])
        assert error < max(0.6, 2 * abs(a)), f"calibración dudosa en {capa} {tx},{ty}: {error:.2f} m"
    np.save(ruta, metros)
    return metros


def mosaico(capa):
    m = np.zeros((ny, nx), np.float32)
    for ty in range(TY):
        for tx in range(TX):
            i0, i1 = tx * nx // TX, (tx + 1) * nx // TX
            j0, j1 = ty * ny // TY, (ty + 1) * ny // TY
            m[j0:j1, i0:i1] = tesela(capa, tx, ty)
        print(f"  {capa}: fila {ty + 1}/{TY}", flush=True)
    return m


def desplazar(a, dj, di, relleno):
    b = np.full_like(a, relleno)
    b[max(0, dj):a.shape[0] + min(0, dj), max(0, di):a.shape[1] + min(0, di)] = \
        a[max(0, -dj):a.shape[0] - max(0, dj), max(0, -di):a.shape[1] - max(0, di)]
    return b


def maximo_ventana(a, r):
    m = a.copy()
    for dj in range(-r, r + 1):
        for di in range(-r, r + 1):
            if (dj or di) and dj * dj + di * di <= r * r + r:
                m = np.maximum(m, desplazar(a, dj, di, -1))
    return m


# ---------------------------------------------------------------- altura de la vegetación
print("Descargando el LiDAR del ICGC (con caché)…")
veg = np.clip(mosaico("veg") - mosaico("edif"), 0, 45)
liso = sum(desplazar(veg, dj, di, 0) for dj in (-1, 0, 1) for di in (-1, 0, 1)) / 9   # quita ruido de 1 píxel
with open(os.path.join(CARPETA, "vegetacion_1m.bin"), "wb") as f:
    f.write(np.clip(np.round(veg / 0.2), 0, 255).astype(np.uint8).tobytes())

# ---------------------------------------------------------------- cimas: máximos locales (ventana mayor si es alto)
ALTO_MIN = 3.0                    # menos de 3 m: arbusto o seto
cima = (liso >= ALTO_MIN) & (((liso >= maximo_ventana(liso, 2)) & (liso < 8)) |
                             ((liso >= maximo_ventana(liso, 3)) & (liso >= 8)))
js, is_ = np.nonzero(cima)
# Mesetas: varias cimas pegadas con la misma altura → una
orden = np.argsort(-liso[js, is_])
etiqueta = np.zeros((ny, nx), np.int32)
cimas = []
for k in orden:
    j, i = js[k], is_[k]
    if etiqueta[max(0, j - 2):j + 3, max(0, i - 2):i + 3].any():
        continue
    cimas.append((j, i))
    etiqueta[j, i] = len(cimas)
print(f"Cimas: {len(cimas)}")

# ---------------------------------------------------------------- copas: cada píxel de copa, a la cima más cercana
copa = veg >= 2.0
for _ in range(8):                # hasta 8 m de radio
    for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        vecino = desplazar(etiqueta, dj, di, 0)
        libre = (etiqueta == 0) & copa & (vecino > 0)
        etiqueta[libre] = vecino[libre]
area = np.bincount(etiqueta.ravel(), minlength=len(cimas) + 1)

a_xy = lambda j, i: (sim["x0"] + i + 0.5, -(sim["z0"] + j + 0.5))   # (x este, y norte) de osm_ripollet
arboles = []
for n, (j, i) in enumerate(cimas, 1):
    if area[n] < 4:                # menos de 4 m² de copa: farola, cable, antena… no es un árbol
        continue
    x, y = a_xy(j, i)
    radio = float(np.clip(math.sqrt(area[n] / math.pi), 1.0, 9.0))
    arboles.append([round(x, 1), round(y, 1), round(float(veg[j, i]), 1), round(radio, 1)])

# ---------------------------------------------------------------- arbustos y setos: 0,8–3 m fuera de las copas
bajo = (liso >= 0.8) & (liso < ALTO_MIN) & (etiqueta == 0)
B = 3                              # un arbusto por bloque de 3 × 3 m con al menos 4 m² de vegetación baja
hb, wb = ny // B, nx // B
bloques = bajo[:hb * B, :wb * B].reshape(hb, B, wb, B)
cuenta = bloques.sum(axis=(1, 3))
alto_b = (liso[:hb * B, :wb * B] * bajo[:hb * B, :wb * B]).reshape(hb, B, wb, B).sum(axis=(1, 3)) / np.maximum(cuenta, 1)
arbustos = []
for bj, bi in zip(*np.nonzero(cuenta >= 4)):
    x, y = a_xy(bj * B + 1, bi * B + 1)
    arbustos.append([round(x, 1), round(y, 1), round(float(alto_b[bj, bi]), 1), round(min(2.0, 0.6 + 0.12 * cuenta[bj, bi]), 1)])

with open(os.path.join(CARPETA, "arboles_lidar.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "ICGC, LiDAR territorial 2021-2023 (1 m): MDS con vegetación − MDS sin vegetación",
               "campos": ["x", "y", "altura_m", "radio_copa_m"], "arboles": arboles, "arbustos": arbustos}, f)
alturas = np.array([a[2] for a in arboles])
print(f"ÁRBOLES (LiDAR): {len(arboles)} · altura media {alturas.mean():.1f} m (máx {alturas.max():.1f}) · "
      f"arbustos {len(arbustos)} · copa de 2 m o más sobre {copa.sum() / 1e4:.1f} ha")
