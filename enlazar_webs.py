# WEBS DE LAS TIENDAS: a cada lugar de datos_osm/lugares.json (obtener_lugares.py) se le busca su web y se comprueba que
# funciona antes de enseñarla. Fuentes, por este orden:
#   1. datos_publicos/webs_manual.json: correcciones y altas a mano (p. ej., un comercio que pide salir con su web).
#      Clave = la referencia de OSM («node/123») o el nombre exacto del local.
#   2. OpenStreetMap: website / contact:website / url del propio local.
#   3. Wikidata: la web oficial (P856) de la marca (brand:wikidata), para las cadenas: «web de la marca».
# Verificación (como una persona que entra en la portada, nada más): se respeta robots.txt, una visita a la portada por
# web y una cada 1,5 s, siguiendo redirecciones. Estados: ok · bloquea (403/429: la web existe pero rechaza visitas
# automáticas: se enseña) · caida (no existe el dominio, no responde, 404/5xx) · aparcada (página del registrador o
# de venta del dominio). Solo se enseñan «ok» y «bloquea». Cada web se vuelve a comprobar a los 30 días.
# Sale: datos_osm/lugares.json con «web», «wf» (fuente) y «we» (estado) en cada lugar, y datos_publicos/webs/informe.json
# con las webs caídas (para corregirlas en OSM) y los locales sin web. Después: osm_ripollet.py y ensamblar.py.
#   python enlazar_webs.py
import datetime
import json
import os
import re
import time
import urllib.parse
import urllib.request
import urllib.robotparser

DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_LUGARES = os.path.join(DIR, "datos_osm", "lugares.json")
RUTA_MANUAL = os.path.join(DIR, "datos_publicos", "webs_manual.json")
CACHE_DIR = os.path.join(DIR, "datos_publicos", "webs")
RUTA_CACHE = os.path.join(CACHE_DIR, "verificacion.json")
UA = "Mozilla/5.0 (compatible; maqueta-ripollet/1.0; una visita a la portada; https://fokosoft.github.io/Ripollet/)"
HOY = datetime.date.today()
APARCADO = re.compile(r"courtesy\.nominalia|sedoparking|parkingcrew|bodis\.com|afternic|dan\.com/buy|domain (?:is )?for sale|"
                      r"este dominio (?:ha sido registrado|est[aá] a la venta)|dominio registrado (?:por|con)|"
                      r"p[aá]gina de cortes[ií]a|this domain (?:is|may be) for sale", re.I)
os.makedirs(CACHE_DIR, exist_ok=True)


def normalizar(w):
    """Una web de OSM («www.x.com», «http://x.com/inicio; http://y.com») → URL con esquema, la primera si hay varias."""
    if not w:
        return None
    w = w.split(";")[0].strip()
    if not re.match(r"^https?://", w, re.I):
        w = "https://" + w
    try:
        u = urllib.parse.urlsplit(w)
        return urllib.parse.urlunsplit((u.scheme.lower(), u.netloc.lower(), u.path or "/", u.query, "")) if u.netloc else None
    except ValueError:
        return None


def red_social(v, base):
    """contact:instagram / contact:facebook: el usuario o la URL → URL."""
    if not v:
        return None
    v = v.strip()
    return v if v.startswith("http") else f"{base}{v.lstrip('@')}"


def webs_de_marcas(ids):
    """Web oficial (P856) de cada marca de Wikidata, en lotes de 50."""
    webs = {}
    ids = sorted(ids)
    for i in range(0, len(ids), 50):
        url = ("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids="
               + "|".join(ids[i:i + 50]))
        datos = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60))
        for q, ent in datos.get("entities", {}).items():
            # Una marca puede tener una web por país o idioma: la de España / en castellano o catalán, si la hay
            mejor = (-1, None)
            for c in ent.get("claims", {}).get("P856", []):
                v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if not v or c.get("rank") == "deprecated":
                    continue
                cal = lambda p: {s.get("datavalue", {}).get("value", {}).get("id") for s in c.get("qualifiers", {}).get(p, [])}
                host = urllib.parse.urlsplit(v).netloc
                nota = (3 * bool(cal("P407") & {"Q1321", "Q7026"}) + 3 * ("Q29" in cal("P1001"))
                        + 2 * bool(re.search(r"\.(es|cat)$", host)) + (c.get("rank") == "preferred")
                        - 2 * bool(re.search(r"\.(de|fr|it|pt|nl|be|at|co\.uk|us)$", host)))
                if nota > mejor[0]:
                    mejor = (nota, v)
            if mejor[1]:
                webs[q] = mejor[1]
    return webs


def verificar(url):
    """Una visita a la portada (si robots.txt lo permite) → estado y URL final."""
    origen = "{0.scheme}://{0.netloc}".format(urllib.parse.urlsplit(url))
    robots = urllib.robotparser.RobotFileParser()
    try:                                                # (RobotFileParser.read() no tiene tiempo máximo)
        texto = urllib.request.urlopen(urllib.request.Request(origen + "/robots.txt", headers={"User-Agent": UA}),
                                       timeout=8).read(200_000).decode("utf-8", "replace")
        robots.parse(texto.splitlines())
        if not robots.can_fetch(UA, url):
            return {"estado": "bloquea", "nota": "robots.txt no permite visitas automáticas"}
    except Exception:
        pass                                            # sin robots.txt legible: se permite
    for intento in (url, url.replace("https://", "http://", 1)):
        try:
            r = urllib.request.urlopen(urllib.request.Request(intento, headers={"User-Agent": UA,
                                       "Accept-Language": "ca,es;q=0.9"}), timeout=15)
            html = r.read(300_000).decode("utf-8", "replace")
            m = APARCADO.search(html)
            if m:
                return {"estado": "aparcada", "nota": m.group(0), "final": r.geturl()}
            return {"estado": "ok", "final": r.geturl()}
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 429, 503):
                return {"estado": "bloquea", "nota": f"HTTP {e.code}"}
            return {"estado": "caida", "nota": f"HTTP {e.code}"}
        except Exception as e:                          # DNS, conexión, certificado…: se prueba sin HTTPS
            nota = str(getattr(e, "reason", e))[:120]
    return {"estado": "caida", "nota": nota}


lugares = json.load(open(RUTA_LUGARES, encoding="utf-8"))
manual = json.load(open(RUTA_MANUAL, encoding="utf-8")).get("webs", {}) if os.path.exists(RUTA_MANUAL) else {}
marcas = webs_de_marcas({l["bw"] for l in lugares if l.get("bw")})
cache = json.load(open(RUTA_CACHE, encoding="utf-8")) if os.path.exists(RUTA_CACHE) else {}

# 1) La web de cada lugar y su fuente
for l in lugares:
    for k in ("web", "wf", "we"):
        l.pop(k, None)
    candidatas = [(manual.get(l.get("o")) or manual.get(l["n"]), "manual"), (l.get("w"), "osm"),
                  (marcas.get(l.get("bw")), "marca")]
    for w, fuente in candidatas:
        url = normalizar(w)
        if url:
            l["web"], l["wf"] = url, fuente
            break
    for clave, base in (("ig", "https://www.instagram.com/"), ("fb", "https://www.facebook.com/")):
        if l.get(clave):
            l[clave] = red_social(l[clave], base)

# 2) Verificación (cada web una vez; las comprobadas hace menos de 30 días, de la caché)
por_verificar = sorted({l["web"] for l in lugares if l.get("web")})
nuevas = 0
for url in por_verificar:
    c = cache.get(url)
    if c and (HOY - datetime.date.fromisoformat(c["fecha"])).days < 30:
        continue
    cache[url] = {**verificar(url), "fecha": HOY.isoformat()}
    nuevas += 1
    time.sleep(1.5)
json.dump(cache, open(RUTA_CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 3) Solo las que funcionan; la redirección a otra web se respeta (la final es la buena)
for l in lugares:
    if not l.get("web"):
        continue
    v = cache[l["web"]]
    l["we"] = v["estado"]
    if v["estado"] in ("caida", "aparcada"):
        l.pop("web"), l.pop("wf")
    elif v.get("final") and urllib.parse.urlsplit(v["final"]).netloc != urllib.parse.urlsplit(l["web"]).netloc:
        l["web"] = v["final"]
    l.pop("w", None)
json.dump(lugares, open(RUTA_LUGARES, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# 4) Informe: webs que hay que corregir en OSM y locales sin web (comercio, bares, salud y servicios con nombre)
comercios = [l for l in lugares if l["c"] in ("tiendas", "comida", "bares", "salud", "servicios") and l["n"]]
informe = {
    "fecha": HOY.isoformat(),
    "con_web": sum(1 for l in comercios if l.get("web")),
    "comercios": len(comercios),
    "por_fuente": {f: sum(1 for l in comercios if l.get("wf") == f) for f in ("manual", "osm", "marca")},
    "webs_que_fallan": [{"n": l["n"], "o": l["o"], "estado": l["we"], "nota": cache.get(normalizar(l.get("w")) or "", {}).get("nota")}
                        for l in lugares if l.get("we") in ("caida", "aparcada")],
    "sin_web": [{"n": l["n"], "o": l["o"], "c": l["c"], "d": l.get("d")} for l in comercios if not l.get("web")],
}
json.dump(informe, open(os.path.join(CACHE_DIR, "informe.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"WEBS: {informe['con_web']} de {informe['comercios']} comercios con web verificada {informe['por_fuente']} · "
      f"{len(informe['webs_que_fallan'])} fallan · {nuevas} comprobadas ahora")
