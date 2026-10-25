# FAROLAS REALES: los puntos de luz del alumbrado público (códigos ENE_06_PT y ENE_06_PT_C) de la cartografía
# topográfica 1:1000 del AMB (servicio WMS del ICGC). En OSM no hay ninguna farola mapeada en la zona.
# Mismo truco que obtener_bordillos.py: un estilo SLD con filtro dibuja solo esos códigos (a 0,25 m/píxel, la capa
# solo se dibuja a escala de detalle); cada símbolo es una mancha de pocos píxeles y su centro es la farola.
# Guarda datos_catastro/farolas.json ([x este, y norte] en metros de la maqueta).
# Uso: ..\blender-5.2.3-windows-x64\blender.exe --background --python obtener_farolas.py
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
CODIGOS = ["ENE_06_PT", "ENE_06_PT_C"]
FILTRO = "".join(f"<ogc:PropertyIsEqualTo><ogc:PropertyName>CAS</ogc:PropertyName><ogc:Literal>{c}</ogc:Literal>"
                 "</ogc:PropertyIsEqualTo>" for c in CODIGOS)
SLD = ('<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">'
       '<NamedLayer><Name>V22AMB_PN</Name><UserStyle><FeatureTypeStyle><Rule><ogc:Filter><ogc:Or>' + FILTRO +
       '</ogc:Or></ogc:Filter><PointSymbolizer><Graphic><Mark><WellKnownName>square</WellKnownName><Fill>'
       '<CssParameter name="fill">#000000</CssParameter></Fill></Mark><Size>3</Size></Graphic></PointSymbolizer>'
       '</Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>')

with open(os.path.join(DIR, "datos_visor", "datos.json"), encoding="utf-8") as f:
    sim = json.load(f)["sim"]
F = int(sim["celda"])
nx, ny = sim["nx"] * F, sim["ny"] * F                     # rejilla de 1 m
lon_min, lon_max = LON0 + sim["x0"] / KX, LON0 + (sim["x0"] + nx) / KX
lat_max, lat_min = LAT0 - sim["z0"] / KY, LAT0 - (sim["z0"] + ny) / KY

carpeta = os.path.join(DIR, "datos_catastro", "farolas")
os.makedirs(carpeta, exist_ok=True)
SUB = 4                                                   # 0,25 m por píxel
TX, TY = 6, 8
farolas = []
for ty in range(TY):
    for tx in range(TX):
        i0, i1 = tx * nx // TX, (tx + 1) * nx // TX
        j0, j1 = ty * ny // TY, (ty + 1) * ny // TY
        lo0, lo1 = lon_min + (lon_max - lon_min) * i0 / nx, lon_min + (lon_max - lon_min) * i1 / nx
        la1, la0 = lat_max - (lat_max - lat_min) * j0 / ny, lat_max - (lat_max - lat_min) * j1 / ny
        ruta = os.path.join(carpeta, f"f_{tx}_{ty}.png")
        if not os.path.exists(ruta):
            params = {"SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap", "LAYERS": "V22AMB_PN", "STYLES": "",
                      "SRS": "EPSG:4326", "BBOX": f"{lo0},{la0},{lo1},{la1}", "WIDTH": (i1 - i0) * SUB,
                      "HEIGHT": (j1 - j0) * SUB, "FORMAT": "image/png", "TRANSPARENT": "TRUE", "SLD_BODY": SLD}
            pet = urllib.request.Request(WMS + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "maqueta-ripollet"})
            with open(ruta, "wb") as f:
                f.write(urllib.request.urlopen(pet, timeout=300).read())
        im = bpy.data.images.load(ruta)
        im.colorspace_settings.name = "Non-Color"
        w, h = im.size
        assert (w, h) == ((i1 - i0) * SUB, (j1 - j0) * SUB), f"tesela {tx},{ty}: {w}x{h}"
        px = np.empty(w * h * 4, np.float32)
        im.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)[::-1]                    # fila 0 = norte
        marca = (px[..., :3].max(axis=2) < 0.5) & (px[..., 3] > 0.5)
        bpy.data.images.remove(im)
        # Manchas (8-conexas): el centro de cada una es una farola
        visto = np.zeros_like(marca)
        for j, i in zip(*np.nonzero(marca)):
            if visto[j, i]:
                continue
            pila, puntos = [(j, i)], []
            visto[j, i] = True
            while pila:
                a, b = pila.pop()
                puntos.append((a, b))
                for da in (-1, 0, 1):
                    for db in (-1, 0, 1):
                        c, d = a + da, b + db
                        if 0 <= c < h and 0 <= d < w and marca[c, d] and not visto[c, d]:
                            visto[c, d] = True
                            pila.append((c, d))
            cj, ci = np.mean(puntos, axis=0)
            x = sim["x0"] + i0 + (ci + 0.5) / SUB
            z = sim["z0"] + j0 + (cj + 0.5) / SUB
            farolas.append([round(x, 1), round(-z, 1)])
    print(f"  fila {ty + 1}/{TY}: {len(farolas)} farolas", flush=True)

with open(os.path.join(os.path.dirname(carpeta), "farolas.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "AMB, cartografia topografica 1:1000 (ICGC, WMS icc_ct1m, codis " + ", ".join(CODIGOS) + ")",
               "farolas": farolas}, f)
print(f"FAROLAS: {len(farolas)}")
