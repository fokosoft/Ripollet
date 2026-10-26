# PATRIMONIO: el inventario de Ripollet de «Mapes de Patrimoni Cultural» (Oficina de Patrimoni Cultural, Diputació de
# Barcelona), https://patrimonicultural.diba.cat/municipi/ripollet/elements. Para cada ficha: nombre, ámbito
# (inmueble, mueble, natural…), tipología, época, año, autoría, dirección, coordenadas, la descripción (resumida) y el
# enlace a la ficha. Caché en datos_publicos/patrimonio/ (una petición por ficha la primera vez, con pausa).
#   python obtener_patrimonio.py   → datos_publicos/patrimonio.json
import html
import json
import os
import re
import time
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(DIR, "datos_publicos", "patrimonio")
BASE = "https://patrimonicultural.diba.cat"
os.makedirs(CACHE, exist_ok=True)


def pedir(ruta, archivo):
    destino = os.path.join(CACHE, archivo)
    if os.path.exists(destino):
        return open(destino, encoding="utf-8").read()
    pet = urllib.request.Request(BASE + ruta, headers={"User-Agent": "maqueta-ripollet"})
    texto = urllib.request.urlopen(pet, timeout=60).read().decode("utf-8")
    open(destino, "w", encoding="utf-8").write(texto)
    time.sleep(0.5)
    return texto


def texto_plano(s):
    s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    s = html.unescape(re.sub(r"<[^>]+>", "\n", s))
    return [l.strip() for l in s.split("\n") if l.strip()]


def campo(lineas, etiqueta, varias=False):
    """El valor que sigue a una etiqueta de la ficha («Latitud:», «Tipologia»…), hasta la siguiente etiqueta."""
    if etiqueta not in lineas:
        return None
    i = lineas.index(etiqueta) + 1
    if not varias:
        return lineas[i] if i < len(lineas) else None
    vals = []
    while i < len(lineas) and not lineas[i].endswith(":") and lineas[i] not in ETIQUETAS:
        vals.append(lineas[i])
        i += 1
    return vals


ETIQUETAS = {"Classificació", "Número de fitxa", "Àmbit:", "Tipologia", "Estil / època:", "Segle", "Any",
             "Autoria de l'element:", "Estat de conservació", "Protecció", "Accés", "Ús actual:", "Titularitat",
             "Titular:", "Fitxes associades:", "Autoria de la fitxa", "Descripció", "Observacions:", "Història",
             "Bibliografia", "Número inventari Generalitat i altres inventaris"}

enlaces = []
for pagina in range(0, 12):
    s = pedir(f"/municipi/ripollet/elements?page={pagina}", f"llista_{pagina}.html")
    nuevos = [e for e in dict.fromkeys(re.findall(r'href="(/element/[^"]+)"', s)) if e not in enlaces]
    if not nuevos:
        break
    enlaces += nuevos
print(f"PATRIMONIO: {len(enlaces)} fichas en el inventario de Ripollet")

elementos = []
for ruta in enlaces:
    l = texto_plano(pedir(ruta, ruta.rsplit("/", 1)[1] + ".html"))
    try:
        lat, lon = float(campo(l, "Latitud:")), float(campo(l, "Longitud:"))
    except (TypeError, ValueError):
        lat = lon = None
    titulo = next((x for x in l if x.endswith("| Mapes de Patrimoni Cultural")), "")
    nombre = titulo.split(". Ripollet")[0].split(" | ")[0].strip()
    desc = " ".join(campo(l, "Descripció", True) or [])
    hist = " ".join(campo(l, "Història", True) or [])
    elementos.append({
        "nombre": nombre, "url": BASE + ruta, "lat": lat, "lon": lon,
        "ambito": campo(l, "Àmbit:"), "tipologia": campo(l, "Tipologia"),
        "epoca": [e for e in (campo(l, "Estil / època:", True) or [])], "siglo": campo(l, "Segle"), "any": campo(l, "Any"),
        "autoria": campo(l, "Autoria de l'element:"), "lugar": campo(l, "Emplaçament"),
        "descripcion": desc, "historia": hist,
    })
salida = os.path.join(DIR, "datos_publicos", "patrimonio.json")
json.dump({"fuente": "Mapes de Patrimoni Cultural, Oficina de Patrimoni Cultural (Diputació de Barcelona)",
           "elementos": elementos}, open(salida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(e["ambito"] for e in elementos), "con coordenadas:", sum(e["lat"] is not None for e in elementos))
