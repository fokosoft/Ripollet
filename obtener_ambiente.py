# RUIDO: el mapa de capacidad acústica (zonificación) de la Generalitat (WFS del Hipermapa, capa
# ATMOSFERA_MCA_ZONES_ACUSTICA): zonas de sensibilidad alta, moderada y baja con su uso (A4 residencial, B1 mixto,
# C2 industrial…) y los objetivos de calidad del Decret 176/2009 (anexo A). El servicio viene como contornos cerrados
# (MultiLineString): cada anillo es una zona. Guarda datos_publicos/zonas_acusticas.json. La calidad del aire no se
# descarga aquí: el visor la consulta en directo (Open-Meteo y la XVPCA de la Generalitat).
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_ambiente.py
import json
import math
import os
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
# Objetivos de calidad acústica (dB(A), Ld / Le / Ln), Decret 176/2009, anexo A; por uso y, si no, por sensibilidad
OBJETIVOS_USO = {"A1": (50, 50, 40), "A2": (55, 55, 45), "A3": (57, 57, 47), "A4": (60, 60, 50), "B1": (65, 65, 55),
                 "B2": (65, 65, 55), "B3": (65, 65, 55), "C1": (68, 68, 58), "C2": (70, 70, 60)}
OBJETIVOS_ZONA = {"Alta": (60, 60, 50), "Moderada": (65, 65, 55), "Baixa": (70, 70, 60)}

consulta = {"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": "ATMOSFERA:ATMOSFERA_MCA_ZONES_ACUSTICA",
            "SRSNAME": "EPSG:4326", "BBOX": f"{SUR - 0.003},{OESTE - 0.003},{NORTE + 0.003},{ESTE + 0.003},urn:ogc:def:crs:EPSG::4326",
            "OUTPUTFORMAT": "application/json", "COUNT": 5000}
# El servicio filtra por User-Agent: nos identificamos como lo que somos
pet = urllib.request.Request("https://sig.gencat.cat/ows/wfs?" + urllib.parse.urlencode(consulta),
                             headers={"User-Agent": "maqueta-ripollet"})
datos = json.loads(urllib.request.urlopen(pet, timeout=180).read())
zonas = []
for f in datos["features"]:
    p, g = f["properties"], f["geometry"]
    lineas = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
    usos, zona = p.get("USOS", ""), p.get("ZONES", "")
    ld, le, ln = OBJETIVOS_USO.get(usos, OBJETIVOS_ZONA.get(zona, (None, None, None)))
    anillos = []
    for linea in lineas:
        if len(linea) < 4 or linea[0] != linea[-1]:
            continue                              # solo contornos cerrados
        anillos.append([[round((lon - LON0) * KX, 1), round((lat - LAT0) * KY, 1)] for lon, lat in linea])
    if anillos:
        zonas.append({"municipio": p.get("MUNICIPI"), "zona": zona, "usos": usos, "ld": ld, "le": le, "ln": ln, "anillos": anillos})
with open(os.path.join(DIR, "datos_publicos", "zonas_acusticas.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Generalitat de Catalunya, mapa de capacitat acústica (Hipermapa, ATMOSFERA_MCA_ZONES_ACUSTICA); "
                         "objectius: Decret 176/2009, annex A", "zonas": zonas}, f, ensure_ascii=False)
print(f"ZONAS ACÚSTICAS: {len(zonas)} grupos ({sum(len(z['anillos']) for z in zonas)} contornos) · usos "
      f"{sorted({z['usos'] for z in zonas})}")
