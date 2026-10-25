# Descarga los BORDILLOS (vorades, código COM_17LS_LN) de la cartografía topográfica 1:1000 del AMB (servicio WMS del
# ICGC), dibujados a 1 m por píxel y alineados con la rejilla de la simulación (4 × 4 píxeles por celda).
# Truco: un estilo SLD con filtro por código hace que el servidor dibuje solo los bordillos.
# Guarda datos_catastro/bordillos.bin (Uint8, 1 = bordillo). Uso: blender.exe --background --python obtener_bordillos.py
import bpy
import json
import math
import os
import urllib.parse
import urllib.request
import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
WMS = "https://geoserveis.icgc.cat/icc_ct1m/wms/service"
SLD = ('<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">'
       '<NamedLayer><Name>V22AMB_LN</Name><UserStyle><FeatureTypeStyle><Rule><ogc:Filter><ogc:PropertyIsEqualTo>'
       '<ogc:PropertyName>CAS</ogc:PropertyName><ogc:Literal>COM_17LS_LN</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>'
       '<LineSymbolizer><Stroke><CssParameter name="stroke">#000000</CssParameter><CssParameter name="stroke-width">1'
       '</CssParameter></Stroke></LineSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>')

with open(os.path.join(DIR, "datos_visor", "datos.json"), encoding="utf-8") as f:
    sim = json.load(f)["sim"]
FACTOR = int(sim["celda"])                      # píxeles de 1 m por celda
nx, ny = sim["nx"] * FACTOR, sim["ny"] * FACTOR
lon_min, lon_max = LON0 + sim["x0"] / KX, LON0 + (sim["x0"] + sim["nx"] * sim["celda"]) / KX
lat_max, lat_min = LAT0 - sim["z0"] / KY, LAT0 - (sim["z0"] + sim["ny"] * sim["celda"]) / KY

carpeta = os.path.join(DIR, "datos_catastro", "bordillos")
os.makedirs(carpeta, exist_ok=True)
# La capa solo se dibuja a escala detallada (≈ 1:1500 o más): se pide a 0,25 m/píxel, en teselas, y se reduce a 1 m
SUB = 4                                         # subpíxeles por metro
TX, TY = 4, 8                                   # teselas en x y en z
bordillo = np.zeros((ny, nx), np.uint8)
for ty in range(TY):
    for tx in range(TX):
        i0, i1 = tx * nx // TX, (tx + 1) * nx // TX
        j0, j1 = ty * ny // TY, (ty + 1) * ny // TY
        lo0, lo1 = lon_min + (lon_max - lon_min) * i0 / nx, lon_min + (lon_max - lon_min) * i1 / nx
        la1, la0 = lat_max - (lat_max - lat_min) * j0 / ny, lat_max - (lat_max - lat_min) * j1 / ny
        ruta = os.path.join(carpeta, f"b_{tx}_{ty}.png")
        if not os.path.exists(ruta):
            params = {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": "V22AMB_LN", "STYLES": "",
                      "CRS": "EPSG:4326", "BBOX": f"{la0},{lo0},{la1},{lo1}", "WIDTH": (i1 - i0) * SUB,
                      "HEIGHT": (j1 - j0) * SUB, "FORMAT": "image/png", "SLD_BODY": SLD}
            pet = urllib.request.Request(WMS + "?" + urllib.parse.urlencode(params),
                                         headers={"User-Agent": "prueba-blender-threejs"})
            with open(ruta, "wb") as f:
                f.write(urllib.request.urlopen(pet, timeout=300).read())
        im = bpy.data.images.load(ruta)
        w, h = im.size
        assert (w, h) == ((i1 - i0) * SUB, (j1 - j0) * SUB), f"tesela {tx},{ty}: {w}x{h}"
        px = np.empty(w * h * 4, np.float32)
        im.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)[::-1]          # fila 0 = norte = j 0 de la rejilla
        trazo = (px[..., :3].min(axis=2) < 0.7) & (px[..., 3] > 0.3)
        # 1 m de rejilla = bloque de 4 × 4 subpíxeles: hay bordillo si lo cruza algún trazo
        bordillo[j0:j1, i0:i1] = trazo.reshape(j1 - j0, SUB, i1 - i0, SUB).any(axis=(1, 3))
        bpy.data.images.remove(im)
carpeta = os.path.dirname(carpeta)
with open(os.path.join(carpeta, "bordillos.bin"), "wb") as f:
    f.write(bordillo.tobytes())
print(f"BORDILLOS: {nx}x{ny} px de 1 m · {int(bordillo.sum())} m de bordillo dibujados")
