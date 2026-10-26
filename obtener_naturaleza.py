# NATURALEZA: observaciones de seres vivos dentro de la maqueta, de GBIF (Global Biodiversity Information Facility,
# api.gbif.org; reúne iNaturalist, eBird, Ornitho, herbarios…): especie, grupo, mes, punto y origen. Para las
# especies con más observaciones, su nombre común en castellano y en catalán (los de GBIF; si no hay, el científico).
# Caché en datos_publicos/naturaleza/.
#   python obtener_naturaleza.py   → datos_visor/naturaleza.bin (blob «naturaleza»)
import collections
import json
import math
import os
import time
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(DIR, "datos_publicos", "naturaleza")
os.makedirs(CACHE, exist_ok=True)
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
GRUPOS = {"Aves": "aves", "Magnoliopsida": "plantas", "Liliopsida": "plantas", "Pinopsida": "plantas",
          "Polypodiopsida": "plantas", "Insecta": "insectos", "Arachnida": "otros_inv", "Gastropoda": "otros_inv",
          "Mammalia": "mamiferos", "Squamata": "reptiles", "Reptilia": "reptiles", "Amphibia": "anfibios",
          "Actinopterygii": "peces", "Agaricomycetes": "hongos", "Lecanoromycetes": "hongos"}


def pedir(url, archivo):
    destino = os.path.join(CACHE, archivo)
    if not os.path.exists(destino):
        datos = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                       timeout=90).read()
        open(destino, "wb").write(datos)
        time.sleep(0.3)
    return json.load(open(destino, encoding="utf-8"))


obs = []
for pagina in range(0, 40):
    url = ("https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode({
        "decimalLatitude": f"{SUR},{NORTE}", "decimalLongitude": f"{OESTE},{ESTE}", "hasCoordinate": "true",
        "hasGeospatialIssue": "false", "limit": 300, "offset": pagina * 300}))
    r = pedir(url, f"pagina_{pagina}.json")
    for o in r["results"]:
        if not o.get("speciesKey") or o.get("coordinateUncertaintyInMeters", 0) > 1000:
            continue
        obs.append(o)
    if r.get("endOfRecords"):
        break
print(f"NATURALEZA: {len(obs)} observaciones con especie")

por_especie = collections.Counter(o["speciesKey"] for o in obs)
especies = {}
for clave, n in por_especie.most_common():
    o = next(x for x in obs if x["speciesKey"] == clave)
    especies[clave] = {"c": o.get("species"), "g": GRUPOS.get(o.get("class"), GRUPOS.get(o.get("order"), "otros")), "n": n}
# Nombre común (castellano y catalán) de las 150 especies más vistas y de todos los vertebrados no aves (pocos y
# de los más buscados: zorro, jabalí, erizo, lagartos…)
RAROS = ("mamiferos", "reptiles", "anfibios", "peces")
for clave in [k for k, _ in por_especie.most_common(150)] + [k for k in especies if especies[k]["g"] in RAROS]:
    nombres = pedir(f"https://api.gbif.org/v1/species/{clave}/vernacularNames?limit=200", f"nombres_{clave}.json")
    for idioma, k in (("spa", "es"), ("cat", "ca")):
        cands = [v["vernacularName"] for v in nombres["results"] if v.get("language") == idioma]
        if cands:
            especies[clave][k] = collections.Counter(c.strip().capitalize() for c in cands).most_common(1)[0][0]
ids = {clave: i for i, clave in enumerate(especies)}
lista = [especies[k] for k in especies]
puntos = []
for o in obs:
    x = (o["decimalLongitude"] - LON0) * KX
    z = -(o["decimalLatitude"] - LAT0) * KY
    puntos.append([ids[o["speciesKey"]], round(x), round(z), o.get("month") or 0, o.get("year") or 0])
salida = os.path.join(DIR, "datos_visor", "naturaleza.bin")
with open(salida, "wb") as f:
    f.write(json.dumps({"fuente": "GBIF.org", "especies": lista, "obs": puntos},
                       ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
grupos = collections.Counter(e["g"] for e in lista)
print(f"NATURALEZA: {len(lista)} especies {dict(grupos)} · con nombre en castellano "
      f"{sum('es' in e for e in lista)} · {os.path.getsize(salida) / 1024:.0f} KB")
