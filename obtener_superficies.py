# SUPERFICIES PAVIMENTADAS de OSM que no venían en la descarga principal: aparcamientos, plazas y áreas de calle
# (area:highway). Se guardan aparte en datos_osm/superficies.json y osm_ripollet.py las añade si están.
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_superficies.py
import json
import os
import time
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
B = f"{SUR},{OESTE},{NORTE},{ESTE}"
CONSULTA = f"""[out:json][timeout:90];
( way["amenity"="parking"]({B}); relation["amenity"="parking"]({B});
  way["place"="square"]({B}); way["area:highway"]({B}); way["landuse"="railway"]({B}); );
out body; >; out skel qt;"""
SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

for intento, url in enumerate(SERVIDORES * 2):
    try:
        pet = urllib.request.Request(url, data=urllib.parse.urlencode({"data": CONSULTA}).encode(),
                                     headers={"User-Agent": "maqueta-ripollet"})
        datos = json.loads(urllib.request.urlopen(pet, timeout=120).read())
        break
    except OSError as e:
        print(f"{url}: {e}; reintento")
        time.sleep(5 * (intento + 1))
else:
    raise SystemExit("Overpass no responde")
with open(os.path.join(DIR, "datos_osm", "superficies.json"), "w", encoding="utf-8") as f:
    json.dump(datos, f)
cuenta = {}
for e in datos["elements"]:
    t = e.get("tags", {})
    clave = t.get("amenity") or t.get("place") or ("area:highway=" + t["area:highway"] if "area:highway" in t else t.get("landuse"))
    if clave:
        cuenta[clave] = cuenta.get(clave, 0) + 1
print("SUPERFICIES:", cuenta)
