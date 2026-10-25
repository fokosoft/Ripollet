# TRANSPORTE PÚBLICO: paradas, líneas, trazados y horarios de los autobuses que pasan por la maqueta, de dos GTFS
# públicos: AMB (urbanos y metropolitanos, ambmobilitat.cat/OpenData) y Generalitat (interurbanos, dades obertes
# bca2-b4i3). Para cada parada: líneas y salidas (minutos del día) de un martes, un sábado y un domingo de
# referencia (los próximos a la fecha de descarga). Ripollet no tiene estación de tren dentro de la maqueta.
# Guarda datos_publicos/transporte.json. Uso:
#   ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_transporte.py
import csv
import datetime
import io
import json
import math
import os
import urllib.request
import zipfile

DIR = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(DIR, "datos_publicos")
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
MARGEN = 0.002                                                      # trazados un poco más allá del borde
FEEDS = {"amb": "https://www.ambmobilitat.cat/OpenData/google_transit.zip",
         "interurbano": "https://analisi.transparenciacatalunya.cat/download/bca2-b4i3/application/zip"}
dentro = lambda lat, lon, m=0: SUR - m <= lat <= NORTE + m and OESTE - m <= lon <= ESTE + m
a_xz = lambda lat, lon: (round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KY, 1))

hoy = datetime.date.today()
DIAS = {}                                   # tipo de día → fecha de referencia
for nombre, dia_semana in (("laborable", 1), ("sabado", 5), ("domingo", 6)):
    d = hoy + datetime.timedelta(days=(dia_semana - hoy.weekday()) % 7 or 7)
    DIAS[nombre] = d


def tabla(z, nombre):
    if nombre not in z.namelist():
        return iter(())
    return csv.DictReader(io.TextIOWrapper(z.open(nombre), "utf-8-sig"))


paradas, lineas = {}, {}
for feed, url in FEEDS.items():
    ruta = os.path.join(CARPETA, f"gtfs_{feed}.zip")
    if not os.path.exists(ruta):
        print("Descargando", url)
        with open(ruta, "wb") as f:
            f.write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                           timeout=900).read())
    z = zipfile.ZipFile(ruta)
    # Servicios activos en cada día de referencia
    activos = {d: set() for d in DIAS}
    for c in tabla(z, "calendar.txt"):
        ini, fin = (datetime.datetime.strptime(c[k], "%Y%m%d").date() for k in ("start_date", "end_date"))
        for d, fecha in DIAS.items():
            if ini <= fecha <= fin and c[["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][fecha.weekday()]] == "1":
                activos[d].add(c["service_id"])
    for c in tabla(z, "calendar_dates.txt"):
        fecha = datetime.datetime.strptime(c["date"], "%Y%m%d").date()
        for d, f in DIAS.items():
            if f == fecha:
                (activos[d].add if c["exception_type"] == "1" else activos[d].discard)(c["service_id"])
    mias = {}
    for s in tabla(z, "stops.txt"):
        lat, lon = float(s["stop_lat"]), float(s["stop_lon"])
        if dentro(lat, lon):
            mias[s["stop_id"]] = f"{feed}:{s['stop_id']}"
            x, zz = a_xz(lat, lon)
            paradas[mias[s["stop_id"]]] = {"n": s["stop_name"], "x": x, "z": zz, "lineas": set(),
                                           "salidas": {d: [] for d in DIAS}}
    rutas = {r["route_id"]: r for r in tabla(z, "routes.txt")}
    viajes = {v["trip_id"]: v for v in tabla(z, "trips.txt")}
    usados, forma_de = set(), {}
    for st in tabla(z, "stop_times.txt"):
        p = mias.get(st["stop_id"])
        if not p:
            continue
        v = viajes.get(st["trip_id"])
        if not v:
            continue
        r = rutas[v["route_id"]]
        ref = r.get("route_short_name") or r.get("route_long_name") or v["route_id"]
        clave = f"{feed}:{v['route_id']}"
        paradas[p]["lineas"].add(clave)
        if clave not in lineas:
            lineas[clave] = {"ref": ref, "nombre": r.get("route_long_name", ""), "color": "#" + (r.get("route_color") or "2f6fb0"),
                             "operador": feed, "formas": {}}
        if v.get("shape_id"):
            lineas[clave]["formas"][v["shape_id"]] = lineas[clave]["formas"].get(v["shape_id"], 0) + 1
            usados.add(v["shape_id"])
        hora = st.get("departure_time") or st.get("arrival_time")
        if hora:
            h, m, _ = (int(q) for q in hora.split(":"))
            for d in DIAS:
                if v["service_id"] in activos[d]:
                    paradas[p]["salidas"][d].append([h * 60 + m, clave])
    # Trazados: la forma más usada de cada sentido de la línea, recortada a la zona (con margen)
    puntos = {}
    for sh in tabla(z, "shapes.txt"):
        if sh["shape_id"] in usados:
            puntos.setdefault(sh["shape_id"], []).append((int(sh["shape_pt_sequence"]), float(sh["shape_pt_lat"]), float(sh["shape_pt_lon"])))
    for clave, l in lineas.items():
        if l["operador"] != feed:
            continue
        trazos = []
        for sid, _ in sorted(l["formas"].items(), key=lambda q: -q[1])[:2]:
            tramo = [a_xz(la, lo) for _, la, lo in sorted(puntos.get(sid, [])) if dentro(la, lo, MARGEN)]
            # Simplificado: un punto cada 8 m como mucho
            simple = []
            for p in tramo:
                if not simple or math.hypot(p[0] - simple[-1][0], p[1] - simple[-1][1]) >= 8:
                    simple.append(p)
            if len(simple) > 1:
                trazos.append(simple)
        l["trazos"] = trazos
        del l["formas"]
    print(f"  {feed}: {len(mias)} paradas en la maqueta", flush=True)

# Nombres: el GTFS interurbano usa códigos internos (L0119) y pone el número de la línea entre paréntesis en el nombre
# largo: «(e4) Barcelona - Ripollet» → e4. Sin color propio, uno distinto por línea.
import re
COLORES = ["#d62839", "#2f6fb0", "#2e9e54", "#e0a030", "#6b4c9a", "#e0703a", "#1f9aa0", "#c75b8a", "#7a8a1f",
           "#8c5a3c", "#3a62d8", "#b8322f", "#4c9a6b"]
for q, l in enumerate(sorted(lineas.values(), key=lambda l: l["ref"])):
    m = re.match(r"^\(([^)]+)\)\s*(.*)$", l["nombre"])
    if m and re.fullmatch(r"L\d+", l["ref"]):
        l["ref"], l["nombre"] = m.group(1), m.group(2)
    if l["color"] in ("#2f6fb0", "#"):
        l["color"] = COLORES[q % len(COLORES)]

# Salida compacta: líneas en lista e índice en las paradas
claves = sorted(lineas, key=lambda k: (lineas[k]["operador"], lineas[k]["ref"]))
indice = {k: q for q, k in enumerate(claves)}
salida_paradas = []
for p in paradas.values():
    if not p["lineas"]:
        continue
    salida_paradas.append({"n": p["n"], "x": p["x"], "z": p["z"], "l": sorted(indice[k] for k in p["lineas"]),
                           "s": {d: sorted([m, indice[k]] for m, k in v) for d, v in p["salidas"].items()}})
with open(os.path.join(CARPETA, "transporte.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "AMB (GTFS ambmobilitat.cat/OpenData) i Generalitat (GTFS autobusos interurbans, bca2-b4i3)",
               "dias": {d: f.isoformat() for d, f in DIAS.items()},
               "lineas": [{k: v for k, v in lineas[c].items()} for c in claves], "paradas": salida_paradas},
              f, ensure_ascii=False, separators=(",", ":"))
lab = sum(len(p["s"]["laborable"]) for p in salida_paradas)
print(f"TRANSPORTE: {len(salida_paradas)} paradas con servicio · {len(claves)} líneas ({', '.join(lineas[c]['ref'] for c in claves)}) · "
      f"{lab} paso(s) de bus por las paradas un laborable")
