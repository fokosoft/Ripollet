# PLANEAMIENTO URBANÍSTICO: calificaciones del suelo del Mapa urbanístic de Catalunya (MUC) en la zona de la maqueta,
# del servicio ArcGIS de la Diputació de Barcelona (CARTOBASE/MUC, capa «MUC Qualificació»; datos de enero de 2023).
# Cada polígono: código MUC (R2, SV, SE…) y nombre de la calificación en el planeamiento municipal.
# Guarda datos_publicos/planeamiento.json. Solo biblioteca estándar. Uso:
#   ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_planeamiento.py
import json
import math
import os
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
URL = "https://gissrv.diba.cat/arcgis/rest/services/CARTOBASE/MUC/MapServer/1/query?"
consulta = {"where": "1=1", "geometry": f"{OESTE},{SUR},{ESTE},{NORTE}", "geometryType": "esriGeometryEnvelope",
            "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects",
            "outFields": "C_QUAL_MUC,D_QUAL_AJT,CODI_INE", "returnGeometry": "true", "f": "json"}
datos = json.loads(urllib.request.urlopen(urllib.request.Request(URL + urllib.parse.urlencode(consulta),
                                                                 headers={"User-Agent": "maqueta-ripollet"}), timeout=300).read())
zonas = []
for f in datos["features"]:
    a = f["attributes"]
    anillos = [[[round((lon - LON0) * KX, 1), round((lat - LAT0) * KY, 1)] for lon, lat in r] for r in f["geometry"]["rings"]]
    zonas.append({"codigo": (a["C_QUAL_MUC"] or "").strip(), "nombre": (a["D_QUAL_AJT"] or "").strip(),
                  "municipio": a["CODI_INE"], "anillos": anillos})
with open(os.path.join(DIR, "datos_publicos", "planeamiento.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Mapa urbanístic de Catalunya (Generalitat), servei CARTOBASE/MUC de la Diputació de Barcelona, gener 2023",
               "zonas": zonas}, f, ensure_ascii=False, separators=(",", ":"))
print(f"PLANEAMIENTO: {len(zonas)} polígonos · {len({z['codigo'] for z in zonas})} códigos")
