# Descarga las zonas inundables OFICIALES (fluviales, periodos de retorno de 10, 100 y 500 años: cartografía de la
# ACA publicada en el SNCZI del Ministerio, servicio INSPIRE del IDEE) con la misma rejilla de 4 m de la simulación,
# las guarda para el visor y las compara con lo que marca la simulación pluvial.
# Uso: blender.exe --background --python obtener_oficial.py
import bpy
import json
import math
import os
import urllib.request
import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
WMS = "https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones"
CAPAS = [("T500", "NZ.Flood.FluvialT500", 1), ("T100", "NZ.Flood.FluvialT100", 2), ("T10", "NZ.Flood.FluvialT10", 3)]

with open(os.path.join(DIR, "datos_visor", "datos.json"), encoding="utf-8") as f:
    sim = json.load(f)["sim"]
nx, ny, c = sim["nx"], sim["ny"], sim["celda"]
# La rejilla es equirrectangular (x ∝ longitud, z ∝ −latitud): en CRS:84 cada píxel cae justo en una celda
lon_min, lon_max = LON0 + sim["x0"] / KX, LON0 + (sim["x0"] + nx * c) / KX
lat_max, lat_min = LAT0 - sim["z0"] / KY, LAT0 - (sim["z0"] + ny * c) / KY

carpeta = os.path.join(DIR, "datos_oficial")
os.makedirs(carpeta, exist_ok=True)
oficial = np.zeros((ny, nx), np.uint8)       # 0 fuera · 1 T500 · 2 T100 · 3 T10 (la más frecuente manda)
for nombre, capa, valor in CAPAS:
    ruta = os.path.join(carpeta, f"fluvial_{nombre}.png")
    if not os.path.exists(ruta):
        url = (f"{WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS={capa}&STYLES=&CRS=CRS:84"
               f"&BBOX={lon_min},{lat_min},{lon_max},{lat_max}&WIDTH={nx}&HEIGHT={ny}&FORMAT=image/png&TRANSPARENT=TRUE")
        pet = urllib.request.Request(url, headers={"User-Agent": "prueba-blender-threejs"})
        with open(ruta, "wb") as f:
            f.write(urllib.request.urlopen(pet, timeout=120).read())
    im = bpy.data.images.load(ruta)
    w, h = im.size
    px = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    alfa = px.reshape(h, w, 4)[::-1, :, 3]                       # fila 0 = norte = j 0 de la rejilla
    assert (w, h) == (nx, ny), f"{nombre}: {w}x{h} en vez de {nx}x{ny}"
    oficial[alfa > 0.1] = valor
    print(f"{nombre}: {int((alfa > 0.1).sum() * c * c / 1e4 * 100) / 100} ha en la maqueta")

with open(os.path.join(DIR, "datos_visor", "oficial.bin"), "wb") as f:
    f.write(oficial.tobytes())

# Comparación con la simulación pluvial (las celdas que no se analizan no cuentan)
codigos = np.frombuffer(open(os.path.join(DIR, "datos_visor", "codigos.bin"), "rb").read(), np.uint8).reshape(ny, nx)
analizable = ~np.isin(codigos, (1, 5, 7, 9))      # como celdaAnalizable: sin edificios, cauce, patios ni muros
comparacion = {}
for mmh in (20, 60, 120):
    prof = np.frombuffer(open(os.path.join(DIR, "datos_sim", f"verdad_{mmh}.bin"), "rb").read(), np.uint16).reshape(ny, nx) / 100
    inund = (prof >= 0.3) & analizable
    fila = {"pluvial_ha": round(float(inund.sum() * c * c / 1e4), 2)}
    for nombre, _, valor in CAPAS:
        zona = (oficial >= valor) & analizable
        fila[nombre] = {"oficial_ha": round(float(zona.sum() * c * c / 1e4), 2),
                        "pluvial_dentro_pct": round(float(100 * (inund & zona).sum() / max(1, inund.sum())), 1),
                        "oficial_mojada_pct": round(float(100 * (inund & zona).sum() / max(1, zona.sum())), 1)}
    comparacion[mmh] = fila
    print(mmh, "mm/h:", fila)
with open(os.path.join(carpeta, "comparacion.json"), "w", encoding="utf-8") as f:
    json.dump(comparacion, f, ensure_ascii=False, indent=1)
