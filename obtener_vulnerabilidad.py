# VULNERABILIDAD POR SECCIÓN CENSAL: contornos de las secciones de Ripollet (ICGC/Idescat, 1-1-2024) con la renta y
# los indicadores demográficos del Atlas de distribución de renta de los hogares del INE (tablas 30896 y 30904,
# provincia de Barcelona, último año). Índice de vulnerabilidad = media de tres rangos (0–100): % de 65 años o más,
# % de hogares de una persona y renta neta por persona (al revés: menos renta, más vulnerable). Sencillo a propósito:
# se puede explicar en una frase y comprobar con los datos.
# Descarga (si no están) a datos_publicos/ y guarda datos_publicos/secciones.json.
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_vulnerabilidad.py
import json
import math
import os
import struct
import urllib.request
import zipfile

DIR = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(DIR, "datos_publicos")
os.makedirs(CARPETA, exist_ok=True)
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
MUNICIPIO = "08180"                     # Ripollet (INE); el Idescat añade un dígito de control
FUENTES = {
    "secciones_2024.zip": "https://datacloud.icgc.cat/datacloud/bseccen_etrs89/shp/bseccenv10sh1f1_20240101_0.zip",
    "renta_30896.json": "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/30896?nult=1",
    "demografia_30904.json": "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/30904?nult=1",
}
for nombre, url in FUENTES.items():
    ruta = os.path.join(CARPETA, nombre)
    if not os.path.exists(ruta):
        print("Descargando", url)
        with open(ruta, "wb") as f:
            f.write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                           timeout=600).read())


# ---------------------------------------------------------------- UTM 31N (ETRS89) → latitud, longitud
def utm_a_geo(x, y, huso=31):
    a, f = 6378137.0, 1 / 298.257222101
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    k0 = 0.9996
    x -= 500000.0
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
         + (151 * e1 ** 3 / 96) * math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    n1 = a / math.sqrt(1 - e2 * math.sin(p) ** 2)
    t1, c1 = math.tan(p) ** 2, ep2 * math.cos(p) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(p) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = p - (n1 * math.tan(p) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                                         + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(p)
    return math.degrees(lat), (huso - 1) * 6 - 180 + 3 + math.degrees(lon)


def a_metros(lon, lat):
    return (lon - LON0) * KX, (lat - LAT0) * KY


# ---------------------------------------------------------------- contornos (shapefile dentro del zip)
z = zipfile.ZipFile(os.path.join(CARPETA, "secciones_2024.zip"))
base = [n[:-4] for n in z.namelist() if n.endswith(".shp")][0]
dbf, shp, shx = (z.read(base + e) for e in (".dbf", ".shp", ".shx"))
n, hl, rl = struct.unpack("<IHH", dbf[4:12])
campos = [(dbf[k:k + 11].split(b"\0")[0].decode(), dbf[k + 16]) for k in range(32, hl - 1, 32)]
secciones = {}
for r in range(n):
    rec, p, v = dbf[hl + r * rl: hl + (r + 1) * rl], 1, {}
    for nom, tam in campos:
        v[nom] = rec[p:p + tam].decode("latin-1").strip()
        p += tam
    if not v["MUNICIPI"].startswith(MUNICIPIO):
        continue
    off = struct.unpack(">I", shx[100 + 8 * r: 104 + 8 * r])[0] * 2
    tipo, = struct.unpack("<i", shp[off + 8: off + 12])
    assert tipo in (5, 15), f"tipo de forma {tipo}"
    npart, npt = struct.unpack("<ii", shp[off + 44: off + 52])
    partes = list(struct.unpack(f"<{npart}i", shp[off + 52: off + 52 + 4 * npart])) + [npt]
    xy = struct.unpack(f"<{2 * npt}d", shp[off + 52 + 4 * npart: off + 52 + 4 * npart + 16 * npt])
    anillos = []
    for a, b in zip(partes, partes[1:]):
        anillo = [a_metros(*utm_a_geo(xy[2 * q], xy[2 * q + 1])[::-1]) for q in range(a, b)]
        anillos.append([[round(x, 1), round(y, 1)] for x, y in anillo])
    secciones[v["DISTRICTE"] + v["SECCIO"]] = {"codigo": v["DISTRICTE"] + v["SECCIO"], "anillos": anillos}
print(f"Secciones de Ripollet: {len(secciones)}")


# ---------------------------------------------------------------- INE: renta e indicadores demográficos
def valores(ruta):
    """{codigo de sección: {indicador: valor}} del último año."""
    salida = {}
    for s in json.load(open(ruta, encoding="utf-8")):
        partes = s["Nombre"].split(". ")
        if not partes[0].startswith("Ripollet sec") or not s["Data"]:
            continue
        codigo = partes[0].split()[-1]
        indicador = partes[2] if "Dato base" in partes[1] else partes[1]
        salida.setdefault(codigo, {})[indicador.strip(" .")] = (s["Data"][0]["Valor"], s["Data"][0]["Anyo"])
    return salida


renta, demo = valores(os.path.join(CARPETA, "renta_30896.json")), valores(os.path.join(CARPETA, "demografia_30904.json"))
CLAVES = {"poblacion": ("Población", demo), "mayores": ("Porcentaje de población de 65 y más años", demo),
          "menores": ("Porcentaje de población menor de 18 años", demo), "edad": ("Edad media de la población", demo),
          "solos": ("Porcentaje de hogares unipersonales", demo), "hogar": ("Tamaño medio del hogar", demo),
          "renta": ("Renta neta media por persona", renta), "rentaHogar": ("Renta neta media por hogar", renta)}
anio = {}
for codigo, s in secciones.items():
    for clave, (indicador, fuente) in CLAVES.items():
        valor, a = fuente.get(codigo, {}).get(indicador, (None, None))
        s[clave] = valor
        if a:
            anio[clave] = a

# Índice: media de rangos (0 = la menos vulnerable de Ripollet, 100 = la más)
validas = [s for s in secciones.values() if None not in (s["mayores"], s["solos"], s["renta"])]


def rango(clave, invertir=False):
    orden = sorted(validas, key=lambda s: s[clave], reverse=invertir)
    return {s["codigo"]: 100 * k / max(1, len(orden) - 1) for k, s in enumerate(orden)}


r1, r2, r3 = rango("mayores"), rango("solos"), rango("renta", invertir=True)
for s in secciones.values():
    s["indice"] = round((r1[s["codigo"]] + r2[s["codigo"]] + r3[s["codigo"]]) / 3) if s["codigo"] in r1 else None

with open(os.path.join(CARPETA, "secciones.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Contornos: ICGC/Idescat, seccions censals 1-1-2024 (CC BY 4.0). Datos: INE, Atlas de "
                         "distribución de renta de los hogares, tablas 30896 y 30904",
               "anio": anio, "secciones": sorted(secciones.values(), key=lambda s: s["codigo"])}, f)
for s in sorted(secciones.values(), key=lambda s: -(s["indice"] or 0)):
    print(f"  {s['codigo']}: índice {s['indice']} · {s['poblacion']:.0f} hab · 65+ {s['mayores']} % · solos "
          f"{s['solos']} % · renta {s['renta']:.0f} €/persona")
print("Años:", anio)
