# TIENDAS Y LUGARES DE INTERÉS de OpenStreetMap: comercios, bares y restaurantes, servicios, salud, cultura, deporte,
# patrimonio y turismo, con nombre, horario (opening_hours), dirección, teléfono y web si los tienen.
# Guarda datos_osm/lugares.json (compacto, solo lo que usa el visor). Uso:
#   ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_lugares.py
import json
import math
import os
import time
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
B = f"{SUR},{OESTE},{NORTE},{ESTE}"
AMENIDADES = ("restaurant|cafe|bar|pub|fast_food|ice_cream|pharmacy|clinic|doctors|dentist|hospital|veterinary|bank|atm|"
              "post_office|library|theatre|cinema|arts_centre|community_centre|social_centre|townhall|police|"
              "marketplace|place_of_worship|fuel|charging_station|bicycle_rental|car_sharing|recycling|toilets|"
              "drinking_water|fountain|bench_no|kindergarten_no")
CONSULTA = f"""[out:json][timeout:120];
( nwr["shop"]({B}); nwr["amenity"~"^({AMENIDADES})$"]({B}); nwr["tourism"]({B}); nwr["historic"]({B});
  nwr["leisure"~"^(sports_centre|fitness_centre|swimming_pool|stadium|playground|park)$"]["name"]({B});
  nwr["healthcare"]({B}); nwr["office"]["name"]({B}); nwr["craft"]["name"]({B}); );
out center tags;"""
SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


def categoria(t):
    a, s = t.get("amenity", ""), t.get("shop", "")
    if s in ("supermarket", "convenience", "bakery", "butcher", "greengrocer", "pastry", "deli", "seafood", "frozen_food",
             "confectionery", "beverages", "alcohol", "coffee", "tea", "cheese", "farm") or a == "marketplace":
        return "comida"
    if a in ("restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream"):
        return "bares"
    if a in ("pharmacy", "clinic", "doctors", "dentist", "hospital") or "healthcare" in t or s in ("optician", "chemist", "medical_supply"):
        return "salud"
    if a in ("library", "theatre", "cinema", "arts_centre", "community_centre", "social_centre") or t.get("tourism") in ("museum", "gallery"):
        return "cultura"
    if "historic" in t or a == "place_of_worship" or t.get("tourism") in ("attraction", "artwork", "viewpoint"):
        return "patrimonio"
    if t.get("leisure"):
        return "deporte"
    if a in ("bank", "atm", "post_office", "townhall", "police", "fuel", "charging_station", "bicycle_rental",
             "car_sharing", "veterinary") or "office" in t or s in ("hairdresser", "beauty", "laundry", "dry_cleaning",
             "copyshop", "travel_agency", "funeral_directors", "car_repair", "tailor", "massage", "tattoo"):
        return "servicios"
    if a in ("recycling", "toilets", "drinking_water", "fountain"):
        return "ciudad"
    if s or "craft" in t:
        return "tiendas"
    if t.get("tourism"):
        return "patrimonio"
    return None


for intento, url in enumerate(SERVIDORES * 2):
    try:
        pet = urllib.request.Request(url, data=urllib.parse.urlencode({"data": CONSULTA}).encode(),
                                     headers={"User-Agent": "maqueta-ripollet"})
        datos = json.loads(urllib.request.urlopen(pet, timeout=180).read())
        break
    except OSError as e:
        print(f"{url}: {e}; reintento")
        time.sleep(5 * (intento + 1))
else:
    raise SystemExit("Overpass no responde")

lugares, vistos = [], set()
for e in datos["elements"]:
    t = e.get("tags", {})
    c = categoria(t)
    lat, lon = (e.get("lat"), e.get("lon")) if "lat" in e else (e.get("center", {}).get("lat"), e.get("center", {}).get("lon"))
    if not c or lat is None:
        continue
    nombre = t.get("name") or t.get("brand")
    if not nombre and c not in ("ciudad", "servicios"):          # sin nombre solo valen fuentes, cajeros, reciclaje…
        continue
    clave = (nombre, round(lat, 4), round(lon, 4))
    if clave in vistos:
        continue
    vistos.add(clave)
    x, y = (lon - LON0) * KX, (lat - LAT0) * KY
    tipo = t.get("shop") or t.get("amenity") or t.get("tourism") or t.get("historic") or t.get("leisure") \
        or t.get("healthcare") or t.get("office") or t.get("craft") or ""
    calle = " ".join(v for v in (t.get("addr:street"), t.get("addr:housenumber")) if v)
    l = {"n": nombre or "", "c": c, "t": tipo, "x": round(x, 1), "z": round(-y, 1)}
    for k, v in (("h", t.get("opening_hours")), ("d", calle), ("tel", t.get("phone") or t.get("contact:phone")),
                 ("w", t.get("website") or t.get("contact:website")), ("tipo", t.get("recycling_type"))):
        if v:
            l[k] = v
    lugares.append(l)

with open(os.path.join(DIR, "datos_osm", "lugares.json"), "w", encoding="utf-8") as f:
    json.dump(lugares, f, ensure_ascii=False, separators=(",", ":"))
cuenta = {}
for l in lugares:
    cuenta[l["c"]] = cuenta.get(l["c"], 0) + 1
print(f"LUGARES: {len(lugares)} · con horario {sum('h' in l for l in lugares)} · {cuenta}")
