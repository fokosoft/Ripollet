# COBERTURAS DEL SUELO (Mapa de cobertes del sòl de Catalunya 2024, ICGC, WMS «cobertes-sol»): de qué es el suelo que
# OSM no describe (el beige de la maqueta): vegetación, tierra, zona urbana pavimentada o edificada, agua.
# El WMS devuelve una imagen de colores de paleta: cada color distinto se identifica preguntando su clase con
# GetFeatureInfo y se resume en 5 grupos. Guarda datos_publicos/cobertes_2m.bin (Uint8, rejilla de 2 m de la maqueta:
# 0 sin dato · 1 urbano pavimentado o edificado · 2 vegetación baja (prados, jardines, cultivos) · 3 arbolado ·
# 4 suelo desnudo o en obras · 5 agua) y cobertes_clases.json.
# Uso (necesita Pillow): python obtener_cobertes.py
import io
import json
import math
import os
import re
import urllib.parse
import urllib.request
import numpy as np
from PIL import Image

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
WMS = "https://geoserveis.icgc.cat/servei/catalunya/cobertes-sol/wms"
CAPA = "cobertes_2024"
CARPETA = os.path.join(DIR, "datos_publicos")

with open(os.path.join(DIR, "datos_visor", "datos.json"), encoding="utf-8") as f:
    sim = json.load(f)["sim"]
nx, ny = sim["nx"] * 2, sim["ny"] * 2                       # rejilla de 2 m
lon_min, lon_max = LON0 + sim["x0"] / KX, LON0 + (sim["x0"] + nx * 2) / KX
lat_max, lat_min = LAT0 - sim["z0"] / KY, LAT0 - (sim["z0"] + ny * 2) / KY
base = {"SERVICE": "WMS", "VERSION": "1.1.1", "LAYERS": CAPA, "STYLES": "", "SRS": "EPSG:4326",
        "BBOX": f"{lon_min},{lat_min},{lon_max},{lat_max}", "WIDTH": nx, "HEIGHT": ny}
pedir = lambda p: urllib.request.urlopen(urllib.request.Request(WMS + "?" + urllib.parse.urlencode(p),
                                                                headers={"User-Agent": "maqueta-ripollet"}), timeout=300).read()
ruta_png = os.path.join(CARPETA, "cobertes", "cobertes_2024.png")
os.makedirs(os.path.dirname(ruta_png), exist_ok=True)
if not os.path.exists(ruta_png):
    with open(ruta_png, "wb") as f:
        f.write(pedir({**base, "REQUEST": "GetMap", "FORMAT": "image/png"}))
img = np.array(Image.open(ruta_png).convert("RGB"))
assert img.shape[:2] == (ny, nx), img.shape
codigo = (img[..., 0].astype(np.int32) << 16) | (img[..., 1].astype(np.int32) << 8) | img[..., 2]

# Cada color: su clase (GetFeatureInfo en un píxel de ese color)
clases = {}
for c in np.unique(codigo):
    j, i = np.argwhere(codigo == c)[len(np.argwhere(codigo == c)) // 2]
    t = pedir({**base, "REQUEST": "GetFeatureInfo", "QUERY_LAYERS": CAPA, "X": int(i), "Y": int(j),
               "INFO_FORMAT": "text/plain"}).decode("utf-8", "replace")
    m = re.search(r"class = '(.*)'\s*$", t, re.M)          # el nombre puede llevar apóstrofos («Cursos d'aigua»)
    clases[int(c)] = m.group(1) if m else ""


def grupo(nombre):
    n = nombre.lower()
    if not n:
        return 0
    if any(k in n for k in ("aigua", "rius", "llacs", "embassament", "basses", "cursos")):
        return 5
    if any(k in n for k in ("bosc", "arbr", "plantacions", "fruiters", "vinya", "oliver")):
        return 3
    if any(k in n for k in ("sòl nu", "sol nu", "obres", "extractives", "abocadors", "roquissar", "tarteres", "platges",
                            "transformació")):
        return 4
    if any(k in n for k in ("prats", "herbassar", "matollar", "conreu", "jardins", "parcs", "verd", "camps", "erm",
                            "vinyes", "humides", "horta")):
        return 2
    return 1          # urbà, industrial, vials, equipaments, zones esportives…


grupo_de = {c: grupo(n) for c, n in clases.items()}
salida = np.vectorize(grupo_de.get)(codigo).astype(np.uint8)
salida.tofile(os.path.join(CARPETA, "cobertes_2m.bin"))
with open(os.path.join(CARPETA, "cobertes_clases.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "ICGC, Mapa de cobertes del sòl de Catalunya 2024 (CC BY 4.0)",
               "clases": {clases[c]: grupo_de[c] for c in clases}}, f, ensure_ascii=False, indent=1)
cuenta = np.bincount(salida.ravel(), minlength=6) * 4 / 1e4
print("COBERTES:", {n: f"{h:.0f} ha" for n, h in zip(["sin dato", "urbano", "vegetación baja", "arbolado", "suelo desnudo", "agua"], cuenta)})
for n, g in sorted(((clases[c], grupo_de[c]) for c in clases), key=lambda q: q[1]):
    print(f"  {g} {n}")
