# RECOGIDA DE RESIDUOS «Ripollet Aporta»: sectores, contenedores, áreas de emergencia y buzones de textil sanitario
# del mapa público del servicio (Google My Maps, exportado en KML) y los calendarios por sector de ripollet.cat
# (publicados como imágenes; transcritos aquí a mano: si cambian, hay que actualizarlos). Guarda
# datos_publicos/residuos.json. Solo biblioteca estándar. Uso:
#   ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_residuos.py
import html
import json
import math
import os
import re
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
KML = "https://www.google.com/maps/d/kml?mid=1Sd5a96EL23V8tTjNVVixxsnzUEiuJDA&forcekml=1"
ruta_kml = os.path.join(DIR, "datos_publicos", "aporta", "ripollet_aporta.kml")
os.makedirs(os.path.dirname(ruta_kml), exist_ok=True)
if not os.path.exists(ruta_kml):
    with open(ruta_kml, "wb") as f:
        f.write(urllib.request.urlopen(urllib.request.Request(KML, headers={"User-Agent": "maqueta-ripollet"}), timeout=120).read())
kml = open(ruta_kml, encoding="utf-8").read()
xz = lambda lon, lat: [round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KY, 1)]

# Calendarios (0 = lunes … 6 = domingo). Puerta a puerta de 21 a 22 h; contenedores de 6 a 23 h.
CALENDARIOS = {
    1: {"nombre": "Centre", "puerta": {1: ["envasos", "paper"], 3: ["envasos", "rebuig"], 6: ["envasos", "paper"]},
        "contenedor": ["vidre", "organica", "textil"]},
    2: {"nombre": "Can Mas i Maragall", "puerta": {}, "contenedor": ["rebuig", "organica", "envasos", "vidre", "paper"]},
    3: {"nombre": "Pinetons", "puerta": {0: ["envasos", "paper"], 2: ["envasos", "rebuig"], 4: ["envasos", "paper"]},
        "contenedor": ["vidre", "organica", "textil"]},
    4: {"nombre": "Tiana - Pont Vell", "puerta": {}, "contenedor": ["rebuig", "organica", "envasos", "vidre", "paper"]},
}
# Áreas de emergencia: días y horario (ripollet.cat, «Àrees d'emergència»)
HORARIO_AREA = {"Molí": ([0, 1, 2, 3, 4, 5, 6], "8-22"), "Barber": ([1, 3], "14-20"), "Salvador Espriu": ([0, 2, 4], "14-20"),
                "Institut": ([0, 2, 4], "14-20"), "Pinetons": ([1, 3], "14-20")}

sectores, puntos = [], []
for carpeta in re.finditer(r"<Folder>\s*<name>([\s\S]*?)</name>([\s\S]*?)</Folder>", kml):
    nombre_c = html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", carpeta.group(1))).strip()
    for pm in re.finditer(r"<Placemark>([\s\S]*?)</Placemark>", carpeta.group(2)):
        p = pm.group(1)
        nombre = html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", re.search(r"<name>([\s\S]*?)</name>", p).group(1))).strip()
        coords = [[float(v) for v in c.split(",")[:2]] for c in re.search(r"<coordinates>([\s\S]*?)</coordinates>", p).group(1).split()]
        if "<Polygon" in p:
            num = int(re.search(r"Sector (\d)", nombre_c).group(1))
            sectores.append({"sector": num, "anillo": [xz(lo, la) for lo, la in coords]})
        else:
            tipo = ("area" if "emerg" in nombre_c.lower() else "textil" if "textil" in nombre_c.lower() else "contenedor")
            q = {"tipo": tipo, "nombre": re.sub(r"^\d+\.\s*", "", nombre), "pos": xz(*coords[0])}
            if tipo == "area":
                for clave, (dias, horas) in HORARIO_AREA.items():
                    if clave.lower() in nombre.lower():
                        q["dias"], q["horas"] = dias, horas
            puntos.append(q)
with open(os.path.join(DIR, "datos_publicos", "residuos.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Ripollet Aporta: mapa de sectors i calendaris de recollida (novembre de 2023)",
               "calendarios": CALENDARIOS, "sectores": sectores, "puntos": puntos}, f, ensure_ascii=False, separators=(",", ":"))
print(f"RESIDUOS: {len(sectores)} polígonos de sector · " +
      " · ".join(f"{t}: {sum(p['tipo'] == t for p in puntos)}" for t in ("contenedor", "area", "textil")))
