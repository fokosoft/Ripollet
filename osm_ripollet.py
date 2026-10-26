# Maqueta low-poly de Ripollet a partir de OpenStreetMap + relieve real del ICGC
# Uso: blender.exe --background --python osm_ripollet.py -- datos_osm/ripollet_pinetons.json
import bpy
import bmesh
import gzip
import json
import math
import os
import random
import re
import sys
import base64
import urllib.request
import numpy as np
from mathutils import Matrix, Vector

DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR)
import texturas_estilo as T                 # noqa: E402  (texturas generadas por código)

DATOS = sys.argv[sys.argv.index("--") + 1]
RELIEVE = os.path.join(DIR, "datos_relieve")
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635   # zona descargada
MARGEN = 5                                  # metros recortados en el borde
PLANTA = 3.0                                # metros por planta
PASO = 12.0                                 # metros entre puntos de la malla del terreno
EXAGERACION = 1.0                           # 1 = relieve real
LUGARES = [  # (nombre, lat, lon) para las etiquetas del visor
    ("Centre", 41.4965060, 2.1534198),
    ("Parc dels Pinetons", 41.5090604, 2.1527707),
    ("Bosc dels Pinetons", 41.5055897, 2.1603870),
    ("Polígon Pinetons", 41.5049176, 2.1490571),
    ("Rambla dels Pinetons", 41.5022970, 2.1585623),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574
LIM = ((ESTE - OESTE) / 2 * KX - MARGEN, (NORTE - SUR) / 2 * KY - MARGEN)   # semilados x, y


def a_metros(lon, lat):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


# ---------------------------------------------------------------- relieve (ICGC, MDT 5 m)
def teselas_relieve():
    """Descarga (con caché) las teselas Terrain-RGB del ICGC y devuelve una función
    elevación(lon, lat) en metros sobre el nivel del mar."""
    z, T = 14, 512
    n = 2 ** z * T

    def pixel(lon, lat):
        return ((lon + 180) / 360 * n,
                (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

    (x0, y0), (x1, y1) = pixel(OESTE, NORTE), pixel(ESTE, SUR)
    tx0, tx1, ty0, ty1 = int(x0 // T), int(x1 // T), int(y0 // T), int(y1 // T)
    mosaico = np.zeros(((ty1 - ty0 + 1) * T, (tx1 - tx0 + 1) * T))
    os.makedirs(RELIEVE, exist_ok=True)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            ruta = os.path.join(RELIEVE, f"icgc_{z}_{tx}_{ty}.png")
            if not os.path.exists(ruta):
                url = f"https://geoserveis.icgc.cat/servei/catalunya/contextmaps-terreny-5m-rgb/wmts/{z}/{tx}/{ty}.png"
                pet = urllib.request.Request(url, headers={"User-Agent": "prueba-blender-threejs"})
                datos = urllib.request.urlopen(pet, timeout=60).read()
                if datos[:2] == b"\x1f\x8b":            # el servidor la envía comprimida con gzip
                    datos = gzip.decompress(datos)
                with open(ruta, "wb") as f:
                    f.write(datos)
            im = bpy.data.images.load(ruta)
            im.colorspace_settings.name = "Non-Color"
            p = np.empty(T * T * 4, np.float32)
            im.pixels.foreach_get(p)
            rgb = np.round(p.reshape(T, T, 4)[::-1, :, :3] * 255)
            elev = -10000 + (rgb[..., 0] * 65536 + rgb[..., 1] * 256 + rgb[..., 2]) * 0.1
            mosaico[(ty - ty0) * T:(ty - ty0 + 1) * T, (tx - tx0) * T:(tx - tx0 + 1) * T] = elev
            bpy.data.images.remove(im)

    def elevacion(lon, lat):
        x, y = pixel(lon, lat)
        x, y = x - tx0 * T - 0.5, y - ty0 * T - 0.5
        i, j = int(x), int(y)
        fx, fy = x - i, y - j
        m = mosaico
        return ((m[j, i] * (1 - fx) + m[j, i + 1] * fx) * (1 - fy)
                + (m[j + 1, i] * (1 - fx) + m[j + 1, i + 1] * fx) * fy)
    return elevacion


elevacion = teselas_relieve()
NX, NY = math.ceil(2 * LIM[0] / PASO), math.ceil(2 * LIM[1] / PASO)
GX, GY = 2 * LIM[0] / NX, 2 * LIM[1] / NY
ALT = np.array([[elevacion(LON0 + (-LIM[0] + i * GX) / KX, LAT0 + (-LIM[1] + j * GY) / KY)
                 for i in range(NX + 1)] for j in range(NY + 1)])
ELEV_MIN, ELEV_MAX = ALT.min(), ALT.max()
ALT = (ALT - ELEV_MIN) * EXAGERACION       # z = 0 en el punto más bajo


def altura(x, y):
    """Altura del terreno en (x, y), interpolada en los mismos triángulos de la malla."""
    fx = (min(max(x, -LIM[0]), LIM[0]) + LIM[0]) / GX
    fy = (min(max(y, -LIM[1]), LIM[1]) + LIM[1]) / GY
    i, j = min(int(fx), NX - 1), min(int(fy), NY - 1)
    fx, fy = fx - i, fy - j
    h00, h10, h01, h11 = ALT[j, i], ALT[j, i + 1], ALT[j + 1, i], ALT[j + 1, i + 1]
    if fx + fy <= 1:
        return h00 + (h10 - h00) * fx + (h01 - h00) * fy
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fy)


# ---------------------------------------------------------------- datos OSM
with open(DATOS, encoding="utf-8") as f:
    elementos = json.load(f)["elements"]
# Aparcamientos, plazas y áreas de calle que no venían en la descarga principal (obtener_superficies.py)
RUTA_SUPERFICIES = os.path.join(DIR, "datos_osm", "superficies.json")
if os.path.exists(RUTA_SUPERFICIES):
    with open(RUTA_SUPERFICIES, encoding="utf-8") as f:
        vistos = {(e["type"], e["id"]) for e in elementos}
        elementos += [e for e in json.load(f)["elements"] if (e["type"], e["id"]) not in vistos]
nodos = {e["id"]: (e["lon"], e["lat"]) for e in elementos if e["type"] == "node"}
nodos_via = {e["id"]: e["nodes"] for e in elementos if e["type"] == "way"}
vias = [e for e in elementos if e["type"] == "way" and "tags" in e]
arboles_osm = [e for e in elementos if e["type"] == "node" and e.get("tags", {}).get("natural") == "tree"]


def unir_anillos(trozos):
    """Une las vías 'outer' de una relación en anillos cerrados."""
    pendientes = [list(t) for t in trozos if t]
    anillos = []
    while pendientes:
        anillo = pendientes.pop(0)
        while anillo[0] != anillo[-1]:
            for i, t in enumerate(pendientes):
                if t[0] == anillo[-1]:
                    anillo += t[1:]
                elif t[-1] == anillo[-1]:
                    anillo += t[::-1][1:]
                elif t[-1] == anillo[0]:
                    anillo = t + anillo[1:]
                elif t[0] == anillo[0]:
                    anillo = t[::-1] + anillo[1:]
                else:
                    continue
                pendientes.pop(i)
                break
            else:
                break                                   # anillo abierto: se descarta
        if len(anillo) > 3 and anillo[0] == anillo[-1]:
            anillos.append(anillo)
    return anillos


# Áreas = (id, etiquetas, lista de nodos cerrada): vías cerradas + relaciones multipolígono
areas = [(v["id"], v["tags"], v["nodes"]) for v in vias if v["nodes"][0] == v["nodes"][-1]]
for rel in (e for e in elementos if e["type"] == "relation" and "tags" in e):
    exteriores = [nodos_via.get(m["ref"]) for m in rel["members"]
                  if m["type"] == "way" and m.get("role") in ("outer", "")]
    areas += [(rel["id"], rel["tags"], anillo) for anillo in unir_anillos(exteriores)]


# ---------------------------------------------------------------- geometría 2D
def area_firmada(p):
    return 0.5 * sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p)))


def recortar_convexo(p, ventana):
    """Sutherland-Hodgman: recorta el polígono p con una ventana convexa antihoraria."""
    for k in range(len(ventana)):
        (ax, ay), (bx, by) = ventana[k - 1], ventana[k]
        lado = lambda q: (bx - ax) * (q[1] - ay) - (by - ay) * (q[0] - ax)
        salida = []
        for i in range(len(p)):
            a, b = p[i - 1], p[i]
            sa, sb = lado(a), lado(b)
            if sb >= 0:
                if sa < 0:
                    t = sa / (sa - sb)
                    salida.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
                salida.append(b)
            elif sa >= 0:
                t = sa / (sa - sb)
                salida.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
        p = salida
        if not p:
            break
    return p


RECTANGULO = [(-LIM[0], -LIM[1]), (LIM[0], -LIM[1]), (LIM[0], LIM[1]), (-LIM[0], LIM[1])]


def recortar_segmento(a, b):
    """Liang-Barsky: devuelve el tramo del segmento dentro del rectángulo o None."""
    t0, t1 = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] + LIM[0]), (dx, LIM[0] - a[0]), (-dy, a[1] + LIM[1]), (dy, LIM[1] - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return None
    return (a[0] + t0 * dx, a[1] + t0 * dy), (a[0] + t1 * dx, a[1] + t1 * dy)


def poligono_limpio(ids_nodo):
    p = [a_metros(*nodos[n]) for n in ids_nodo[:-1] if n in nodos]
    if len(p) < 3:
        return None
    if area_firmada(p) < 0:
        p = p[::-1]                                     # siempre antihorario
    p = recortar_convexo(p, RECTANGULO)
    if len(p) < 3 or abs(area_firmada(p)) < 2:
        return None
    return p


def punto_en_poligono(x, y, p):
    dentro = False
    for i in range(len(p)):
        (x1, y1), (x2, y2) = p[i - 1], p[i]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dentro = not dentro
    return dentro


# ---------------------------------------------------------------- materiales y mallas
# material: (color, patrón de textura o None, modo de UV, metros por repetición)
#   modo "planar": UV = posición x, y del mundo · "tejado": UV sobre el plano de cada faldón
#   modo "explicita": la UV se calcula al crear la cara (fachadas, calzada, laterales)
MATERIALES = {
    "tejado": ((0.75, 0.33, 0.20), "tejas", "tejado", 2),
    "azotea": ((0.66, 0.64, 0.62), "azotea", "planar", 4),
    "calzada": (None, "calzada", "explicita", None),
    "peatonal": ((0.84, 0.80, 0.72), "panot", "planar", 2),
    "cesped": ((0.45, 0.70, 0.35), "cesped", "planar", 6),
    "bosque": ((0.36, 0.56, 0.30), "bosque", "planar", 6),
    "matorral": ((0.62, 0.65, 0.40), "matorral", "planar", 6),
    "pista": ((0.35, 0.62, 0.42), "pista", "planar", 8),
    "agua": ((0.36, 0.64, 0.90), "agua", "planar", 16),
    "suelo": ((0.90, 0.87, 0.80), "suelo", "planar", 12),
    "tierra": ((0.50, 0.36, 0.24), "estratos", "explicita", None),
    "tronco": ((0.40, 0.26, 0.15), None, None, None),
    "copa": ((0.30, 0.58, 0.28), None, None, None),
    "copa_clara": ((0.50, 0.70, 0.30), None, None, None),
    "copa_pino": ((0.18, 0.42, 0.24), None, None, None),
    "arbusto": ((0.48, 0.58, 0.30), None, None, None),
    "puente": ((0.74, 0.72, 0.68), None, None, None),      # hormigón: tablero, barandillas y pilas
    "aparcamiento": ((0.32, 0.32, 0.34), None, None, None),  # asfalto liso, sin líneas de carril
}
COLOR_MURO = {
    "crema": (0.93, 0.86, 0.70), "melocoton": (0.95, 0.73, 0.55), "blanco": (0.95, 0.94, 0.90),
    "ocre": (0.86, 0.66, 0.38), "rosa": (0.90, 0.64, 0.60), "gris": (0.78, 0.78, 0.80),
    "nave": (0.62, 0.68, 0.74),
}
FACHADA = {"piso": (3.2, 3.0), "casa": (3.0, 3.0), "nave": (4.0, 4.0)}   # metros por repetición (ancho, alto)
MUROS_CASA = ["crema", "melocoton", "blanco", "ocre", "rosa"]
MALLAS = {}
PAREDES_QUITADAS = [0]


def muro(color, estilo):
    """Material de pared: color + estilo de fachada (piso, casa o nave)."""
    nombre = f"muro_{color}_{estilo}"
    MATERIALES.setdefault(nombre, (COLOR_MURO[color], estilo, "explicita", None))
    return nombre


def malla(nombre):
    if nombre not in MALLAS:
        MALLAS[nombre] = bmesh.new()
        MALLAS[nombre].loops.layers.uv.new("UVMap")
    return MALLAS[nombre]


def cara(nombre, verts, uvs=None):
    bm = malla(nombre)
    f = bm.faces.new([bm.verts.new(v) for v in verts])
    if uvs:
        capa = bm.loops.layers.uv.active
        for l, uv in zip(f.loops, uvs):
            l[capa].uv = uv
    return f


def prisma(muro, techo, p, z0, z1, tejado=0.0, ocultas=()):
    """Paredes + techo de un polígono antihorario; tejado > 0 = tejado a cuatro aguas.
    La fachada se repite en metros reales y la última planta coincide con lo alto del muro.
    `ocultas`: índices de las paredes que no se ven (las tapa otra parte del edificio) y no se dibujan."""
    ancho, alto = FACHADA[muro.rsplit("_", 1)[1]]
    s = 0.0
    for i in range(len(p)):
        (x1, y1), (x2, y2) = p[i - 1], p[i]
        L = math.hypot(x2 - x1, y2 - y1)
        u0, u1, v0 = s / ancho, (s + L) / ancho, (z0 - z1) / alto
        if i in ocultas:
            PAREDES_QUITADAS[0] += 1
        else:
            cara(muro, [(x1, y1, z0), (x2, y2, z0), (x2, y2, z1), (x1, y1, z1)],
                 [(u0, v0), (u1, v0), (u1, 0), (u0, 0)])
        s += L
    f = cara(techo, [(x, y, z1) for x, y in p])
    if tejado > 0:
        ancho = math.sqrt(abs(area_firmada(p)))
        bmesh.ops.inset_individual(MALLAS[techo], faces=[f], thickness=min(1.6, ancho * 0.28),
                                   depth=tejado, use_even_offset=True)


def drapear(nombre, p, separacion):
    """Pega un polígono al terreno: lo trocea por los triángulos de la malla del suelo."""
    xs, ys = [x for x, _ in p], [y for _, y in p]
    i0 = max(0, int((min(xs) + LIM[0]) / GX))
    i1 = min(NX - 1, int((max(xs) + LIM[0]) / GX))
    j0 = max(0, int((min(ys) + LIM[1]) / GY))
    j1 = min(NY - 1, int((max(ys) + LIM[1]) / GY))
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            x0, y0 = -LIM[0] + i * GX, -LIM[1] + j * GY
            x1, y1 = x0 + GX, y0 + GY
            for tri in (((x0, y0), (x1, y0), (x0, y1)), ((x1, y0), (x1, y1), (x0, y1))):
                trozo = recortar_convexo(p, tri)
                if len(trozo) >= 3 and abs(area_firmada(trozo)) > 0.01:
                    cara(nombre, [(x, y, altura(x, y) + separacion) for x, y in trozo])


# ---------------------------------------------------------------- datos para la simulación de lluvia
# Cuadrícula de celdas de 4 m con el tipo de suelo (decide infiltración y obstáculos en el visor)
CELDA_SIM = 4.0
SIM_URBANO, SIM_EDIFICIO, SIM_CESPED, SIM_BOSQUE, SIM_MATORRAL, SIM_AGUA, SIM_CALZADA = range(7)
SIM_PATIO, SIM_SOLAR, SIM_MURO = 7, 8, 9    # parcelas del Catastro: patio privado, solar sin edificar, muro de parcela
SIM_ZONAS, SIM_CINTAS, SIM_EDIFICIOS = [], [], []
# Por tipo de celda (lo usa también el visor): altura extra del lecho (m) y lo que se lleva el suelo (mm/h).
# Edificio: muro de 3 m · cauce del río −0,5 m · calzada bajo el bordillo −0,15 m · muro de parcela +1 m.
# Patio privado: su propio desagüe (sumideros a la casa y tierra de jardín) · solar: tierra sin pavimentar.
LECHO = [0, 3, 0, 0, 0, -0.5, -0.15, 0, 0, 1.0]
INFILTRACION = [3, 0, 25, 40, 30, 0, 0, 40, 15, 0]
CALLES_CON_NOMBRE = []                       # (puntos, nombre) para nombrar los puntos críticos
SNX, SNY = math.ceil(2 * LIM[0] / CELDA_SIM), math.ceil(2 * LIM[1] / CELDA_SIM)
N1X, N1Y = SNX * int(CELDA_SIM), SNY * int(CELDA_SIM)   # rejilla fina de 1 m (bordillos, aceras)
EDIF_1M = np.zeros((N1Y, N1X), bool)        # edificios a 1 m
TECHO_1M = np.zeros((N1Y, N1X), np.float32) # altura absoluta de la cubierta (m, ejes del modelo): sombras
EDIF_2M = np.zeros((N1Y // 2, N1X // 2), np.int32)   # índice de edificio + 1 a 2 m: potencial solar
ES_CASA = []                                 # por edificio: cubierta inclinada (casa) o azotea


def rasterizar(p, valor, matriz, celda, maximo=False):
    """Pinta un polígono (ejes de Blender) en una rejilla [fila según z de three.js = -y, columna según x].
    Con `maximo`, cada celda se queda con el mayor valor (alturas de cubierta de partes que se tocan)."""
    alto_m, ancho_m = matriz.shape
    pz = [(x, -y) for x, y in p]
    zs = [z for _, z in pz]
    j0 = max(0, int((min(zs) + LIM[1]) / celda))
    j1 = min(alto_m - 1, int((max(zs) + LIM[1]) / celda))
    for j in range(j0, j1 + 1):
        zc = -LIM[1] + (j + 0.5) * celda
        cortes = sorted(xa + (zc - za) * (xb - xa) / (zb - za)
                        for (xa, za), (xb, zb) in zip(pz, pz[1:] + pz[:1]) if (za > zc) != (zb > zc))
        for a, b in zip(cortes[::2], cortes[1::2]):
            i0 = max(0, math.ceil((a + LIM[0]) / celda - 0.5))
            i1 = min(ancho_m - 1, math.floor((b + LIM[0]) / celda - 0.5))
            if i1 >= i0:
                if maximo:
                    matriz[j, i0:i1 + 1] = np.maximum(matriz[j, i0:i1 + 1], valor)
                else:
                    matriz[j, i0:i1 + 1] = valor


def dilatar(m, pasos):
    """Crece una máscara booleana `pasos` celdas en vecindad de 4."""
    m = m.copy()
    for _ in range(pasos):
        n = m.copy()
        n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        m = n
    return m

# ---------------------------------------------------------------- terreno y base
bm = malla("suelo")
v = [[bm.verts.new((-LIM[0] + i * GX, -LIM[1] + j * GY, ALT[j, i])) for i in range(NX + 1)]
     for j in range(NY + 1)]
for j in range(NY):
    for i in range(NX):
        bm.faces.new((v[j][i], v[j][i + 1], v[j + 1][i]))
        bm.faces.new((v[j][i + 1], v[j + 1][i + 1], v[j + 1][i]))

FONDO = -10
borde = ([(-LIM[0] + i * GX, -LIM[1]) for i in range(NX)] + [(LIM[0], -LIM[1] + j * GY) for j in range(NY)]
         + [(LIM[0] - i * GX, LIM[1]) for i in range(NX)] + [(-LIM[0], LIM[1] - j * GY) for j in range(NY)])
s = 0.0
for k in range(len(borde)):
    (xa, ya), (xb, yb) = borde[k - 1], borde[k]
    L = math.hypot(xb - xa, yb - ya)
    za, zb = altura(xa, ya), altura(xb, yb)
    cara("tierra", [(xa, ya, FONDO), (xb, yb, FONDO), (xb, yb, zb), (xa, ya, za)],
         [(s / 8, FONDO / 8), ((s + L) / 8, FONDO / 8), ((s + L) / 8, zb / 8), (s / 8, za / 8)])
    s += L
cara("tierra", [(x, y, FONDO) for x, y in reversed(RECTANGULO)],
     [(x / 8, y / 8) for x, y in reversed(RECTANGULO)])

# ---------------------------------------------------------------- edificios
ALTURAS = {  # tipo: (plantas mín, plantas máx)
    "house": (1, 3), "apartments": (4, 8), "residential": (3, 6), "yes": (2, 4),
    "industrial": (2, 3), "commercial": (2, 3), "retail": (1, 2), "school": (2, 3),
    "public": (3, 4), "office": (3, 5), "shed": (1, 1), "garage": (1, 1),
    "garages": (1, 1), "roof": (1, 1), "church": (4, 4), "chapel": (3, 3),
}
RUTA_CATASTRO = os.path.join(DIR, "datos_catastro", "edificios.json")
REFS_CON_EDIFICIO = set()
n_edificios = 0
sotanos_edificio = []   # 1 si el edificio tiene sótano o garaje (Catastro), por índice de edificio
REF_EDIFICIO = []

# Edificios de OSM: dan el TIPO (casa, nave, iglesia…) a las partes del Catastro que caen dentro
edificios_osm, rejilla_osm = [], {}
for id_osm, t, ids_nodo in areas:
    if t.get("building"):
        p = poligono_limpio(ids_nodo)
        if p:
            xs, ys = [x for x, _ in p], [y for _, y in p]
            k = len(edificios_osm)
            edificios_osm.append((p, t, id_osm))
            for cx in range(int(min(xs) // 50), int(max(xs) // 50) + 1):
                for cy in range(int(min(ys) // 50), int(max(ys) // 50) + 1):
                    rejilla_osm.setdefault((cx, cy), []).append(k)


def osm_en(x, y):
    for k in rejilla_osm.get((int(x // 50), int(y // 50)), []):
        p, t, id_osm = edificios_osm[k]
        if punto_en_poligono(x, y, p):
            return t, id_osm
    return {}, None


def simplificar(p, tolerancia=0.15, minimo=0.3):
    """Quita vértices casi alineados (a menos de `tolerancia` m de la recta de sus vecinos) y aristas diminutas.
    Cada vértice se decide con sus vecinos: dos partes que comparten un tramo recto lo simplifican igual."""
    cambio = True
    while cambio and len(p) > 3:
        cambio = False
        for i in range(len(p)):
            (ax, ay), (bx, by), (cx, cy) = p[i - 1], p[i], p[(i + 1) % len(p)]
            L = math.hypot(cx - ax, cy - ay)
            d = abs((cx - ax) * (ay - by) - (ax - bx) * (cy - ay)) / L if L > 1e-9 else 0
            if d < tolerancia or math.hypot(bx - ax, by - ay) < minimo:
                del p[i]
                cambio = True
                break
    return p


def dibujar_edificio(partes, tipo, id_osm, semilla, sotano=0, ref=None):
    """Un edificio = una o varias partes (polígono, altura) con la misma base y el mismo color: así las paredes
    que comparten dos partes de igual altura coinciden y se pueden quitar (no se ven y pesan)."""
    global n_edificios
    rnd = random.Random(semilla)
    area = sum(abs(area_firmada(p)) for p, _ in partes)
    alto_max = max(a for _, a in partes)
    casa = False
    if tipo in ("industrial", "shed", "garage", "garages", "roof"):
        pared, techo = muro("nave" if tipo == "industrial" else "gris", "nave"), "azotea"
    elif tipo in ("house", "church", "chapel") or (area < 150 and alto_max < 10):
        pared, techo, casa = muro(rnd.choice(MUROS_CASA), "casa"), "tejado", True
    else:
        pared, techo = muro(rnd.choice(MUROS_CASA + ["gris"]), "piso"), "azotea"
    # En pendiente: la base se hunde por el lado bajo y la altura cuenta desde el lado alto (del edificio entero)
    suelos = [altura(x, y) for p, _ in partes for x, y in p]
    z0, zt = min(suelos) - 1.0, max(suelos)
    indice = n_edificios
    # Pared tapada: la misma arista, recorrida al revés, en otra parte igual de alta o más
    clave = lambda a, b: (round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2))
    aristas = {}
    for p, alto in partes:
        for i in range(len(p)):
            k = clave(p[i - 1], p[i])
            aristas[k] = max(aristas.get(k, 0), alto)
    for p, alto in partes:
        tejado = min(2.5, math.sqrt(abs(area_firmada(p))) * 0.22) if casa else 0
        ocultas = {i for i in range(len(p)) if aristas.get(clave(p[i], p[i - 1]), -1) >= alto}
        prisma(pared, techo, p, z0, zt + alto, tejado, ocultas)
        SIM_EDIFICIOS.append((p, indice))
        rasterizar(p, True, EDIF_1M, 1.0)
        rasterizar(p, zt + alto, TECHO_1M, 1.0, maximo=True)
        rasterizar(p, indice + 1, EDIF_2M, 2.0)
    if tipo == "church":  # campanario
        p = max(partes, key=lambda q: abs(area_firmada(q[0])))[0]
        cx, cy = sum(x for x, _ in p) / len(p), sum(y for _, y in p) / len(p)
        torre = [(cx - 2.5, cy - 2.5), (cx + 2.5, cy - 2.5), (cx + 2.5, cy + 2.5), (cx - 2.5, cy + 2.5)]
        prisma(pared, "tejado", torre, zt + alto_max, zt + alto_max + 12, tejado=5)
    sotanos_edificio.append(sotano)
    REF_EDIFICIO.append(ref)        # referencia catastral (cruce con el año y los certificados)
    ES_CASA.append(casa)
    n_edificios += 1


def valores_en(p, matriz, celda=1.0):
    """Valores de las celdas cuyo centro cae dentro del polígono (mismo barrido que rasterizar)."""
    alto_m, ancho_m = matriz.shape
    pz = [(x, -y) for x, y in p]
    zs = [z for _, z in pz]
    trozos = []
    for j in range(max(0, int((min(zs) + LIM[1]) / celda)), min(alto_m - 1, int((max(zs) + LIM[1]) / celda)) + 1):
        zc = -LIM[1] + (j + 0.5) * celda
        cortes = sorted(xa + (zc - za) * (xb - xa) / (zb - za)
                        for (xa, za), (xb, zb) in zip(pz, pz[1:] + pz[:1]) if (za > zc) != (zb > zc))
        for a, b in zip(cortes[::2], cortes[1::2]):
            i0 = max(0, math.ceil((a + LIM[0]) / celda - 0.5))
            i1 = min(ancho_m - 1, math.floor((b + LIM[0]) / celda - 0.5))
            if i1 >= i0:
                trozos.append(matriz[j, i0:i1 + 1])
    return np.concatenate(trozos) if trozos else np.zeros(0, np.float32)


# ALTURAS MEDIDAS: modelo de superficie del LiDAR del ICGC (terreno + edificios, 1 m; las teselas que bajó
# obtener_arboles.py). Cubierta de cada parte = mediana de las celdas de dentro; si hay pocas celdas o sale menos de
# 2,5 m sobre el suelo, se queda la del Catastro (plantas × 3 m).
DSM_EDIF = None
_teselas = os.path.join(DIR, "datos_arboles", "teselas")
if all(os.path.exists(os.path.join(_teselas, f"edif_{tx}_{ty}.npy")) for tx in range(6) for ty in range(8)):
    DSM_EDIF = np.zeros((N1Y, N1X), np.float32)
    for ty in range(8):
        for tx in range(6):
            DSM_EDIF[ty * N1Y // 8:(ty + 1) * N1Y // 8, tx * N1X // 6:(tx + 1) * N1X // 6] = \
                np.load(os.path.join(_teselas, f"edif_{tx}_{ty}.npy"))
    DSM_EDIF -= ELEV_MIN                     # misma referencia que altura()
ALTURAS_LIDAR = [0, 0, []]                   # partes con LiDAR, partes con el Catastro, diferencias


def alto_parte(p, plantas):
    catastro = 4 + (plantas - 1) * PLANTA + 0.6
    if DSM_EDIF is None:
        return catastro
    v = valores_en(p, DSM_EDIF)
    if len(v) < 6:
        ALTURAS_LIDAR[1] += 1
        return catastro
    suelo = max(altura(x, y) for x, y in p)
    medido = float(np.median(v)) - suelo
    if not 2.5 <= medido <= 80:
        ALTURAS_LIDAR[1] += 1
        return catastro
    ALTURAS_LIDAR[0] += 1
    ALTURAS_LIDAR[2].append(medido - catastro)
    return medido


if os.path.exists(RUTA_CATASTRO):
    # CATASTRO: cada parte con su altura medida con LiDAR (o sus plantas reales: planta baja de 4 m, las demás de
    # 3 m) y sus sótanos
    import zlib
    with open(RUTA_CATASTRO, encoding="utf-8") as f:
        grupos = {}
        for parte in json.load(f):
            if parte["plantas"] < 1:                    # partes solo bajo rasante (sótanos bajo patios, etc.)
                continue
            p = simplificar([a_metros(lon, lat) for lat, lon in parte["anillo"][:-1]])
            if len(p) < 3:
                continue
            if area_firmada(p) < 0:
                p = p[::-1]
            p = recortar_convexo(p, RECTANGULO)
            if len(p) < 3 or abs(area_firmada(p)) < 2:
                continue
            g = grupos.setdefault(parte["ref"], {"partes": [], "sotano": 0})
            g["partes"].append((p, alto_parte(p, parte["plantas"])))
            g["sotano"] = max(g["sotano"], 1 if parte["sotanos"] > 0 else 0)
    REFS_CON_EDIFICIO.update(grupos)
    if ALTURAS_LIDAR[2]:
        d = np.array(ALTURAS_LIDAR[2])
        print(f"ALTURAS LiDAR: {ALTURAS_LIDAR[0]} partes medidas, {ALTURAS_LIDAR[1]} con el Catastro · diferencia con "
              f"plantas×3 m: mediana {np.median(d):+.1f} m, |dif| > 3 m en {100 * (np.abs(d) > 3).mean():.0f} %")
    for ref, g in grupos.items():
        mayor = max(g["partes"], key=lambda q: abs(area_firmada(q[0])))[0]
        t, id_osm = osm_en(sum(x for x, _ in mayor) / len(mayor), sum(y for _, y in mayor) / len(mayor))
        dibujar_edificio(g["partes"], t.get("building", "yes"), id_osm, zlib.crc32(ref.encode()), g["sotano"], ref)
else:
    # Sin Catastro: los edificios de OSM con alturas estimadas por tipo
    for p, t, id_osm in edificios_osm:
        tipo = t["building"]
        rnd = random.Random(id_osm)
        area = abs(area_firmada(p))
        alto = None
        if "height" in t:
            try:
                alto = float(t["height"].split()[0])
            except ValueError:
                pass
        if alto is None and t.get("building:levels", "").isdigit():
            alto = int(t["building:levels"]) * PLANTA + 1
        if alto is None:
            lo, hi = ALTURAS.get(tipo, (2, 3))
            if tipo == "yes" and area > 400:
                lo, hi = 4, 6
            alto = rnd.randint(lo, hi) * PLANTA + rnd.uniform(0.3, 1.0)
        dibujar_edificio([(p, alto)], tipo, id_osm, id_osm)

# ---------------------------------------------------------------- calles
ANCHOS = {
    "motorway": 16, "trunk": 12, "primary": 10, "secondary": 9, "secondary_link": 6,
    "tertiary": 8, "tertiary_link": 6, "residential": 6, "unclassified": 6, "living_street": 5,
    "service": 4, "pedestrian": 6, "footway": 2.2, "cycleway": 2.2, "steps": 2.2,
    "path": 1.8, "track": 3,
}
PEATONALES = {"pedestrian", "footway", "cycleway", "steps", "path", "track", "living_street"}


def cinta(nombre, puntos, ancho, separacion, anchos=None):
    """Cinta pegada al terreno: tramos cortos para seguir la pendiente y un octógono en cada nodo para rellenar las
    uniones. `anchos`: el ancho de cada tramo (medido de bordillo a bordillo), o el mismo `ancho` para todos."""
    z = lambda x, y: altura(x, y) + separacion
    s = 0.0                                             # metros recorridos: la UV v sigue la calle
    for i in range(len(puntos) - 1):
        r = (anchos[i] if anchos else ancho) / 2
        tramo = recortar_segmento(puntos[i], puntos[i + 1])
        if not tramo:
            continue
        (xa, ya), (xb, yb) = tramo
        L = math.hypot(xb - xa, yb - ya)
        if L < 0.01:
            continue
        nx, ny = -(yb - ya) / L * r, (xb - xa) / L * r
        trozos = max(1, math.ceil(L / PASO))
        for k in range(trozos):
            x1, y1 = xa + (xb - xa) * k / trozos, ya + (yb - ya) * k / trozos
            x2, y2 = xa + (xb - xa) * (k + 1) / trozos, ya + (yb - ya) * (k + 1) / trozos
            v1, v2 = (s + L * k / trozos) / 8, (s + L * (k + 1) / trozos) / 8
            cara(nombre, [(x1 - nx, y1 - ny, z(x1 - nx, y1 - ny)), (x2 - nx, y2 - ny, z(x2 - nx, y2 - ny)),
                          (x2 + nx, y2 + ny, z(x2 + nx, y2 + ny)), (x1 + nx, y1 + ny, z(x1 + nx, y1 + ny))],
                 [(0, v1), (0, v2), (1, v2), (1, v1)])
        s += L
        for x, y in ((xa, ya), (xb, yb)):
            octo = [(x + r * math.cos(a), y + r * math.sin(a)) for a in (k * math.pi / 3 for k in range(6))]
            # Las uniones toman una franja de asfalto sin líneas pintadas
            cara(nombre, [(px, py, z(px, py)) for px, py in octo], [(0.25, py / 8) for _, py in octo])


def es_puente(t):
    return t.get("bridge") not in (None, "no") or t.get("man_made") == "bridge"


PUENTES = []   # para el visor: [{"p": [[x, z, altura del tablero], …], "ancho": m}] en ejes de three.js


def puente(nombre, puntos, ancho):
    """PUENTE: tablero recto entre los dos estribos (la altura del terreno en los extremos, interpolada a lo largo),
    nunca por debajo del terreno; losa de 0,9 m, barandillas de 1 m a los lados y pilas cada ~18 m donde queda hueco
    debajo. El agua de la simulación pasa por debajo (no entra en SIM_CINTAS)."""
    tramos = [t for t in (recortar_segmento(a, b) for a, b in zip(puntos, puntos[1:])) if t]
    if not tramos:
        return
    pts = [tramos[0][0]] + [b for _, b in tramos]
    s = [0.0]
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        s.append(s[-1] + math.hypot(xb - xa, yb - ya))
    total = s[-1] or 1.0
    h0, h1 = altura(*pts[0]) + 0.3, altura(*pts[-1]) + 0.3
    deck = lambda d: h0 + (h1 - h0) * d / total
    r, LOSA, BARANDA = ancho / 2, 0.9, 1.0
    PUENTES.append({"p": [[round(x, 1), round(-y, 1), round(max(deck(d), altura(x, y) + 0.3), 2)]
                          for (x, y), d in zip(pts, s)], "ancho": round(ancho, 1)})
    for (xa, ya), (xb, yb), sa, sb in zip(pts, pts[1:], s, s[1:]):
        L = sb - sa
        if L < 0.01:
            continue
        ux, uy = (xb - xa) / L, (yb - ya) / L
        nx, ny = -uy * r, ux * r
        trozos = max(1, math.ceil(L / 4))
        for k in range(trozos):
            d1, d2 = sa + L * k / trozos, sa + L * (k + 1) / trozos
            x1, y1, x2, y2 = xa + ux * (d1 - sa), ya + uy * (d1 - sa), xa + ux * (d2 - sa), ya + uy * (d2 - sa)
            z1 = max(deck(d1), altura(x1, y1) + 0.3)
            z2 = max(deck(d2), altura(x2, y2) + 0.3)
            # Tablero (con la textura de la calle) y su cara de abajo
            cara(nombre, [(x1 - nx, y1 - ny, z1), (x2 - nx, y2 - ny, z2), (x2 + nx, y2 + ny, z2), (x1 + nx, y1 + ny, z1)],
                 [(0, d1 / 8), (0, d2 / 8), (1, d2 / 8), (1, d1 / 8)])
            cara("puente", [(x1 + nx, y1 + ny, z1 - LOSA), (x2 + nx, y2 + ny, z2 - LOSA),
                            (x2 - nx, y2 - ny, z2 - LOSA), (x1 - nx, y1 - ny, z1 - LOSA)])
            for lado in (1, -1):
                bx1, by1, bx2, by2 = x1 + lado * nx, y1 + lado * ny, x2 + lado * nx, y2 + lado * ny
                # Canto de la losa y barandilla (un muro bajo: cara de fuera, cara de dentro y remate)
                cara("puente", [(bx1, by1, z1 - LOSA), (bx2, by2, z2 - LOSA), (bx2, by2, z2 + BARANDA), (bx1, by1, z1 + BARANDA)])
                gx, gy = lado * nx / r * 0.25, lado * ny / r * 0.25      # 25 cm de grueso, hacia dentro
                ix1, iy1, ix2, iy2 = bx1 - gx, by1 - gy, bx2 - gx, by2 - gy
                cara("puente", [(ix1, iy1, z1), (ix2, iy2, z2), (ix2, iy2, z2 + BARANDA), (ix1, iy1, z1 + BARANDA)])
                cara("puente", [(bx1, by1, z1 + BARANDA), (bx2, by2, z2 + BARANDA), (ix2, iy2, z2 + BARANDA), (ix1, iy1, z1 + BARANDA)])
        # Pilas: donde el tablero queda a más de 2,5 m del suelo, cada ~18 m
        for k in range(1, max(2, round(L / 18))):
            d = sa + L * k / max(2, round(L / 18))
            px, py = xa + ux * (d - sa), ya + uy * (d - sa)
            suelo, z = altura(px, py), deck(d) - LOSA
            if z - suelo < 2.5:
                continue
            a, b = 0.6, r * 0.7                       # media pila: 1,2 m en el sentido del puente, 70 % del ancho
            esq = [(px + ux * a * i - nx / r * b * j, py + uy * a * i - ny / r * b * j) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            for (ax, ay), (cx, cy) in zip(esq, esq[1:] + esq[:1]):
                cara("puente", [(ax, ay, suelo - 1), (cx, cy, suelo - 1), (cx, cy, z), (ax, ay, z)])


def celda_1m(x, y):
    """Píxel (fila, columna) de la rejilla de 1 m para un punto en ejes de Blender, o None si cae fuera."""
    i, j = int(x + LIM[0]), int(-y + LIM[1])
    return (j, i) if 0 <= i < N1X and 0 <= j < N1Y else None


def calzada_real():
    """CALZADA DE BORDILLO A BORDILLO (rejilla de 1 m): desde el eje de cada calle de coches (OSM) la calzada crece
    hasta topar con un bordillo (cartografía 1:1000 del AMB) o una fachada, con un tope de medio ancho típico + 2 m
    para que no se escape por los vados ni por las calles sin bordillo dibujado."""
    ruta = os.path.join(DIR, "datos_catastro", "bordillos.bin")
    if not os.path.exists(ruta):
        return None, None
    bordillo = np.frombuffer(open(ruta, "rb").read(), np.uint8).reshape(N1Y, N1X).astype(bool)
    presupuesto = np.full((N1Y, N1X), -1.0, np.float32)
    for via in vias:
        t = via["tags"]
        if (t.get("highway") in ANCHOS and t["highway"] not in PEATONALES and t.get("area") != "yes"
                and not es_puente(t)):
            puntos = [a_metros(*nodos[n]) for n in via["nodes"] if n in nodos]
            for (xa, ya), (xb, yb) in zip(puntos, puntos[1:]):
                pasos = max(1, int(math.hypot(xb - xa, yb - ya) * 2))
                for q in range(pasos + 1):
                    c = celda_1m(xa + (xb - xa) * q / pasos, ya + (yb - ya) * q / pasos)
                    if c:
                        presupuesto[c] = max(presupuesto[c], ANCHOS[t["highway"]] / 2 + 2)
    pasable = ~bordillo & ~EDIF_1M
    B = presupuesto
    for _ in range(int(B.max()) + 2):                # cada paso: 1 m más lejos del eje
        N = np.full_like(B, -1.0)
        N[1:] = np.maximum(N[1:], B[:-1]); N[:-1] = np.maximum(N[:-1], B[1:])
        N[:, 1:] = np.maximum(N[:, 1:], B[:, :-1]); N[:, :-1] = np.maximum(N[:, :-1], B[:, 1:])
        N -= 1
        N[~pasable] = -1
        nuevo = np.maximum(B, N)
        if np.array_equal(nuevo, B):
            break
        B = nuevo
    return B >= 0, bordillo


def ancho_medido(xa, ya, xb, yb, ancho_osm):
    """Ancho de la calzada real en el centro del tramo (perpendicular al eje); el de OSM si no se puede medir."""
    if CALZADA_1M is None:
        return ancho_osm
    L = math.hypot(xb - xa, yb - ya)
    if L < 0.5:
        return ancho_osm
    xm, ym, nx, ny = (xa + xb) / 2, (ya + yb) / 2, -(yb - ya) / L, (xb - xa) / L
    total = 0.0
    for lado in (1, -1):
        d = 0.0
        while d < 15:
            c = celda_1m(xm + lado * nx * (d + 0.5), ym + lado * ny * (d + 0.5))
            if not c or not CALZADA_1M[c]:
                break
            d += 0.5
        total += d
    return min(max(total, 3.0), ancho_osm * 1.8) if total >= 2 else ancho_osm


CALZADA_1M, BORDILLO_1M = calzada_real()
x_centro, y_centro = a_metros(2.1534198, 41.4965060)
salida = (float("inf"), None)    # (distancia al centro, punto y rumbo) sobre una calle
for via in vias:
    t = via["tags"]
    puntos = [a_metros(*nodos[n]) for n in via["nodes"] if n in nodos]
    if "highway" in t and t.get("area") != "yes" and t["highway"] in ANCHOS:
        tipo = t["highway"]
        peatonal = tipo in PEATONALES
        if tipo in ("secondary", "tertiary", "residential"):
            for (x1, y1), (x2, y2) in zip(puntos, puntos[1:]):
                xm, ym = (x1 + x2) / 2, (y1 + y2) / 2
                d = math.hypot(xm - x_centro, ym - y_centro)
                if d < salida[0] and math.hypot(x2 - x1, y2 - y1) > 15:
                    # rumbo en three.js: ángulo de (dx, dz) con dz = -dy
                    salida = (d, {"pos": [round(xm, 1), round(-ym, 1)],
                                  "rumbo": round(math.atan2(x2 - x1, -(y2 - y1)), 3)})
        if es_puente(t):
            # Ancho del puente: el de OSM si lo dice; si no, el típico del tipo de calle (+1 m de aceras si es de coches)
            try:
                ancho = float(t.get("width", "").replace(",", ".").split()[0])
            except (ValueError, IndexError):
                ancho = ANCHOS[tipo] + (0 if peatonal else 3)
            puente("peatonal" if peatonal else "calzada", puntos, ancho)
            if t.get("name"):
                CALLES_CON_NOMBRE.append((puntos, t["name"]))
            continue
        anchos = None if peatonal else [ancho_medido(*a, *b, ANCHOS[tipo]) for a, b in zip(puntos, puntos[1:])]
        cinta("peatonal" if peatonal else "calzada", puntos, ANCHOS[tipo], 0.4 if peatonal else 0.3, anchos)
        if not peatonal:
            SIM_CINTAS.append((puntos, ANCHOS[tipo], SIM_CALZADA))
        if t.get("name"):
            CALLES_CON_NOMBRE.append((puntos, t["name"]))
    elif "waterway" in t:
        cinta("agua", puntos, 14 if t["waterway"] == "river" else 3, 0.2)
        SIM_CINTAS.append((puntos, 14 if t["waterway"] == "river" else 3, SIM_AGUA))

# ---------------------------------------------------------------- zonas verdes, agua y vegetación
# zona: (material del suelo, tipo de planta, m² por planta, máximo de plantas)
VEGETACION = {
    "bosque": ("bosque", "pino", 45, 1500),
    "parque": ("cesped", "mixto", 140, 300),
    "matorral": ("matorral", "arbusto", 150, 400),
}
rnd = random.Random(42)
# Árboles REALES del LiDAR del ICGC (obtener_arboles.py) si están; si no, los 23 de OSM y relleno al azar en zonas
RUTA_LIDAR = os.path.join(DIR, "datos_arboles", "arboles_lidar.json")
LIDAR = None
if os.path.exists(RUTA_LIDAR):
    with open(RUTA_LIDAR, encoding="utf-8") as f:
        LIDAR = json.load(f)
plantas = [] if LIDAR else [(*a_metros(e["lon"], e["lat"]), "mixto") for e in arboles_osm]
BOSQUES = []    # polígonos de bosque: allí los árboles del LiDAR son pinos
for id_osm, t, ids_nodo in areas:
    if "building" in t:
        continue
    if (t.get("landuse") == "forest" or t.get("natural") == "wood"
            or "Pinetons" in t.get("name", "")):
        zona = "bosque"
    elif t.get("natural") == "scrub":
        zona = "matorral"
    elif t.get("leisure") in ("park", "garden") or t.get("landuse") in (
            "grass", "park", "recreation_ground", "meadow", "village_green"):
        zona = "parque"
    elif t.get("leisure") in ("pitch", "playground"):
        zona = "pista"
    elif t.get("natural") == "water":
        zona = "agua"
    elif (t.get("highway") == "pedestrian" or t.get("place") == "square" or t.get("amenity") == "marketplace"
          or t.get("area:highway") in ("pedestrian", "footway", "traffic_island")):
        zona = "plaza"                # pavimento de hormigón, el mismo material que los puentes
    elif t.get("amenity") == "parking":
        zona = "aparcamiento"
    else:
        continue
    p = poligono_limpio(ids_nodo)
    if not p:
        continue
    suelo = VEGETACION[zona][0] if zona in VEGETACION else {"plaza": "puente"}.get(zona, zona)
    # Separación ligeramente distinta por zona para que las que se solapan no parpadeen
    drapear(suelo, p, {"pista": 0.15, "agua": 0.12, "plaza": 0.1, "aparcamiento": 0.1}.get(zona, 0.06) + 0.008 * (id_osm % 5))
    if zona in ("plaza", "aparcamiento"):
        continue                      # suelo urbano sellado: para la simulación no cambia nada
    SIM_ZONAS.append((p, {"bosque": SIM_BOSQUE, "matorral": SIM_MATORRAL, "agua": SIM_AGUA}.get(zona, SIM_CESPED)))
    if zona == "bosque":
        BOSQUES.append(p)
    if zona in VEGETACION and not LIDAR:
        _, planta, m2, maximo = VEGETACION[zona]
        xs, ys = [x for x, _ in p], [y for _, y in p]
        n = min(maximo, int(abs(area_firmada(p)) / m2))
        for _ in range(n * 4):
            if n <= 0:
                break
            x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
            if punto_en_poligono(x, y, p):
                plantas.append((x, y, planta))
                n -= 1


# Los árboles NO van en el GLB: el visor los dibuja con instancias (una geometría por tipo, repetida en la GPU)
# a partir de una lista compacta. Aquí se crean solo para el .blend y las vistas previas.
TIPOS_ARBOL = ["pino", "cono_copa", "cono_copa_clara", "bola_copa", "bola_copa_clara", "arbusto"]
MALLAS_ARBOL = {"tronco", "copa", "copa_clara", "copa_pino", "arbusto"}
arboles = []   # (x_dm, z_dm de three.js, tipo, radio_cm, alto_cm)


def cono(nombre, x, y, z, radio, alto, lados=6):
    bmesh.ops.create_cone(malla(nombre), cap_ends=False, segments=lados, radius1=radio, radius2=0,
                          depth=alto, matrix=Matrix.Translation((x, y, z + alto / 2)))


def bola(nombre, x, y, z, radio):
    bmesh.ops.create_icosphere(malla(nombre), subdivisions=1, radius=radio,
                               matrix=Matrix.Translation((x, y, z)))


def tronco(x, y, z, alto):
    bmesh.ops.create_cone(malla("tronco"), cap_ends=False, segments=3, radius1=0.3, radius2=0.22,
                          depth=alto + 0.5, matrix=Matrix.Translation((x, y, z + alto / 2 - 0.25)))


if LIDAR:
    for x, y, h, r in LIDAR["arboles"]:
        if h > 2.6 * r and h > 8 and not any(punto_en_poligono(x, y, b) for b in BOSQUES):
            planta = "esbelto"            # ciprés, chopo, palmera…: más alto que ancho
        else:
            planta = "pino" if any(punto_en_poligono(x, y, b) for b in BOSQUES) else "frondoso"
        plantas.append((x, y, planta, h, r))
    # Vegetación baja (0,8–3 m) solo dentro de zonas verdes de OSM: en la ciudad, el LiDAR da también bordes de
    # edificios, toldos o coches. Máximo 5 000 (los más altos) para no pesar.
    verdes = [(p, min(x for x, _ in p), max(x for x, _ in p), min(y for _, y in p), max(y for _, y in p))
              for p, c in SIM_ZONAS if c in (SIM_CESPED, SIM_BOSQUE, SIM_MATORRAL)]
    en_verde = lambda x, y: any(a <= x <= b and c <= y <= d and punto_en_poligono(x, y, p) for p, a, b, c, d in verdes)
    bajos = sorted((a for a in LIDAR["arbustos"] if en_verde(a[0], a[1])), key=lambda a: -a[2])[:5000]
    plantas += [(x, y, "arbusto", h, r) for x, y, h, r in bajos]
    print(f"ÁRBOLES REALES (LiDAR ICGC): {len(LIDAR['arboles'])} y {len(bajos)} arbustos en zonas verdes")

for x, y, planta, *medidas in plantas:
    if abs(x) > LIM[0] - 2 or abs(y) > LIM[1] - 2:
        continue
    z = altura(x, y)
    if medidas:
        # Medidas reales: alto = altura TOTAL del árbol; la copa ocupa la parte de arriba
        h, r = medidas
        if planta == "arbusto":
            bola("arbusto", x, y, z + h / 2, r)
            tipo = "arbusto"
        elif planta == "pino":
            tronco(x, y, z, h * 0.4)
            cono("copa_pino", x, y, z + h * 0.4, r, h * 0.6, lados=5)
            tipo = "pino"
        else:
            copa = "copa" if rnd.random() < 0.7 else "copa_clara"
            alto_copa = h * 0.75 if planta == "esbelto" else min(2 * r, h * 0.7)
            tronco(x, y, z, h - alto_copa)
            if planta == "esbelto":
                cono(copa, x, y, z + h - alto_copa, r, alto_copa)
                tipo = "cono_" + copa
            else:
                bola(copa, x, y, z + h - alto_copa / 2, r)
                tipo = "bola_" + copa
        arboles.append((round(x * 10), round(-y * 10), TIPOS_ARBOL.index(tipo), round(r * 100), round(h * 100)))
        continue
    if planta == "pino":
        alto, radio = rnd.uniform(5, 9), rnd.uniform(1.4, 2.2)
        tronco(x, y, z, 2.0)
        cono("copa_pino", x, y, z + 1.6, radio, alto, lados=5)
        tipo = "pino"
    elif planta == "arbusto":
        radio = rnd.uniform(0.8, 1.4)
        alto = radio
        bola("arbusto", x, y, z + 0.5, radio)
        tipo = "arbusto"
    else:
        tronco(x, y, z, 1.6)
        copa = "copa" if rnd.random() < 0.65 else "copa_clara"
        radio = rnd.uniform(1.6, 2.6)
        if rnd.random() < 0.5:
            alto = rnd.uniform(3.5, 6)
            cono(copa, x, y, z + 1.4, radio, alto)
            tipo = "cono_" + copa
        else:
            alto = radio
            bola(copa, x, y, z + 1.6 + radio, radio)
            tipo = "bola_" + copa
    arboles.append((round(x * 10), round(-y * 10), TIPOS_ARBOL.index(tipo), round(radio * 100), round(alto * 100)))

# ---------------------------------------------------------------- objetos Blender
def uv_proyectadas(bm, modo, escala):
    """UV en metros del mundo: planas (x, y) o sobre el plano de cada faldón del tejado,
    con las filas de tejas paralelas al alero."""
    capa = bm.loops.layers.uv.active
    bm.normal_update()
    for f in bm.faces:
        n = f.normal
        if modo == "tejado" and abs(n.z) < 0.98:
            t = Vector((n.y, -n.x, 0)).normalized()     # horizontal, a lo largo del alero
            b = t.cross(n)                              # pendiente arriba
            for l in f.loops:
                l[capa].uv = (l.vert.co.dot(t) / escala, l.vert.co.dot(b) / escala)
        else:
            for l in f.loops:
                l[capa].uv = (l.vert.co.x / escala, l.vert.co.y / escala)


def imagen_textura(nombre, patron, color):
    rgb = T.textura(patron, color)
    alto, ancho = rgb.shape[:2]
    im = bpy.data.images.new("tex_" + nombre, ancho, alto)
    rgba = np.concatenate([rgb, np.ones((alto, ancho, 1))], axis=2)[::-1]   # Blender: fila 0 abajo
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.pack()
    return im


for nombre, bm in MALLAS.items():
    if not bm.faces:
        continue
    color, patron, modo, escala = MATERIALES[nombre]
    if modo in ("planar", "tejado"):
        uv_proyectadas(bm, modo, escala)
    # Vértices compartidos (la UV va por esquina, así que no se pierde): el GLB pesa mucho menos
    if nombre not in MALLAS_ARBOL:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.005)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.2 if nombre == "agua" else 0.95
    if patron:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = imagen_textura(nombre, patron, color)
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.diffuse_color = (*(color or (0.35, 0.35, 0.38)), 1)
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        mat.diffuse_color = (*color, 1)
    me.materials.append(mat)
    obj = bpy.data.objects.new(nombre, me)
    scene.collection.objects.link(obj)

SALIDA_DATOS = os.path.join(DIR, "datos_visor")
os.makedirs(SALIDA_DATOS, exist_ok=True)
glb = os.path.join(SALIDA_DATOS, "ripollet.glb")
for o in scene.objects:                                 # se exporta todo menos los árboles
    o.select_set(o.type == "MESH" and o.name not in MALLAS_ARBOL)
opciones = dict(filepath=glb, export_format="GLB", export_yup=True, use_selection=True,
                export_normals=False,                           # sombreado plano: three.js lo calcula
                export_image_format="JPEG",                     # texturas ligeras
                export_draco_mesh_compression_enable=True,      # comprime la malla (DRACOLoader)
                export_draco_mesh_compression_level=10)
if "export_image_quality" in bpy.ops.export_scene.gltf.get_rna_type().properties.keys():
    opciones["export_image_quality"] = 85
bpy.ops.export_scene.gltf(**opciones)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DIR, "ripollet.blend"))

# ---------------------------------------------------------------- vista previa
cam = bpy.data.objects.new("Camara", bpy.data.cameras.new("Camara"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.clip_start, cam.data.clip_end = 1, 8000
cam.location = (1100, -1500, 1500)
cam.rotation_euler = (-cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.display.shading.show_shadows = True
scene.render.resolution_x, scene.render.resolution_y = 1200, 900
scene.render.filepath = os.path.join(DIR, "preview_ripollet.png")
bpy.ops.render.render(write_still=True)
cam.location = (-500, -1300, 260)                     # vista baja desde el sur, para ver el relieve
cam.rotation_euler = (Vector((0, 200, 40)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = os.path.join(DIR, "preview_relieve.png")
bpy.ops.render.render(write_still=True)
# A pie de calle, en la salida del coche (three.js x, z  ->  Blender x, -z)
sx, sy = salida[1]["pos"][0], -salida[1]["pos"][1]
dx, dy = math.sin(salida[1]["rumbo"]), -math.cos(salida[1]["rumbo"])
cam.data.clip_start = 0.1
cam.location = (sx - dx * 8, sy - dy * 8, altura(sx, sy) + 3)
cam.rotation_euler = (Vector((sx + dx * 40, sy + dy * 40, altura(sx, sy) + 4)) - cam.location) \
    .to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = os.path.join(DIR, "preview_calle.png")
bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- cuadrícula de la simulación
SNX, SNY = math.ceil(2 * LIM[0] / CELDA_SIM), math.ceil(2 * LIM[1] / CELDA_SIM)
codigos = np.full((SNY, SNX), SIM_URBANO, np.uint8)   # [fila j según z de three.js, columna i según x]
id_edificio = np.zeros((SNY, SNX), np.uint16)         # 0 = ninguno; k + 1 = edificio k


def rellenar(p, valor, matriz=codigos):
    """Pinta un polígono (ejes de Blender) en la cuadrícula, fila a fila (z de three.js = -y)."""
    pz = [(x, -y) for x, y in p]
    zs = [z for _, z in pz]
    j0 = max(0, int((min(zs) + LIM[1]) / CELDA_SIM))
    j1 = min(SNY - 1, int((max(zs) + LIM[1]) / CELDA_SIM))
    for j in range(j0, j1 + 1):
        zc = -LIM[1] + (j + 0.5) * CELDA_SIM
        cortes = sorted(xa + (zc - za) * (xb - xa) / (zb - za)
                        for (xa, za), (xb, zb) in zip(pz, pz[1:] + pz[:1]) if (za > zc) != (zb > zc))
        for a, b in zip(cortes[::2], cortes[1::2]):
            i0 = max(0, math.ceil((a + LIM[0]) / CELDA_SIM - 0.5))
            i1 = min(SNX - 1, math.floor((b + LIM[0]) / CELDA_SIM - 0.5))
            if i1 >= i0:
                matriz[j, i0:i1 + 1] = valor


def celdas_cerca(xa, za, xb, zb, r):
    """Ventana de la cuadrícula alrededor de un tramo y la distancia de cada celda al tramo (o None)."""
    i0 = max(0, int((min(xa, xb) - r + LIM[0]) / CELDA_SIM))
    i1 = min(SNX - 1, int((max(xa, xb) + r + LIM[0]) / CELDA_SIM))
    j0 = max(0, int((min(za, zb) - r + LIM[1]) / CELDA_SIM))
    j1 = min(SNY - 1, int((max(za, zb) + r + LIM[1]) / CELDA_SIM))
    if i1 < i0 or j1 < j0:
        return None
    X, Z = np.meshgrid(-LIM[0] + (np.arange(i0, i1 + 1) + 0.5) * CELDA_SIM,
                       -LIM[1] + (np.arange(j0, j1 + 1) + 0.5) * CELDA_SIM)
    dx, dz = xb - xa, zb - za
    t = np.clip(((X - xa) * dx + (Z - za) * dz) / (dx * dx + dz * dz or 1), 0, 1)
    return (slice(j0, j1 + 1), slice(i0, i1 + 1)), np.hypot(X - (xa + t * dx), Z - (za + t * dz))


def rellenar_cinta(puntos, ancho, codigo):
    """Pinta las celdas a menos de medio ancho de cada tramo."""
    for (xa, ya), (xb, yb) in zip(puntos, puntos[1:]):
        cerca = celdas_cerca(xa, -ya, xb, -yb, ancho / 2 + CELDA_SIM * 0.35)
        if cerca:
            ventana, d = cerca
            codigos[ventana][d <= ancho / 2 + CELDA_SIM * 0.35] = codigo


for p, codigo in SIM_ZONAS:                 # orden de prioridad: zonas < calles y río < edificios
    rellenar(p, codigo)
for puntos, ancho, codigo in SIM_CINTAS:
    # Con bordillos, la calzada sale de la calzada real (abajo); si no, del ancho típico de cada calle
    if codigo != SIM_CALZADA or CALZADA_1M is None:
        rellenar_cinta(puntos, ancho, codigo)
if CALZADA_1M is not None:
    F = int(CELDA_SIM)
    fraccion = CALZADA_1M.reshape(SNY, F, SNX, F).mean(axis=(1, 3))
    codigos[(fraccion >= 0.5) & (codigos != SIM_AGUA)] = SIM_CALZADA
for p, k in SIM_EDIFICIOS:
    rellenar(p, SIM_EDIFICIO)
    rellenar(p, k + 1, id_edificio)


def cerrar_patios(area_max=3000):
    """Los PATIOS INTERIORES de manzana (recintos sin salida a la calle, en vecindad de 4 como el agua de la
    simulación) cuentan como edificio: si no, la lluvia de los tejados los llenaría como piscinas, cuando en la
    realidad sale por bajantes y desagües. Devuelve cuántos se cerraron."""
    libre = (~np.isin(codigos, (SIM_EDIFICIO, SIM_PATIO, SIM_MURO))).ravel().tolist()
    visto = [False] * len(libre)
    cerrados = 0
    for k0 in range(len(libre)):
        if not libre[k0] or visto[k0]:
            continue
        pila, comp, borde = [k0], [], False
        visto[k0] = True
        while pila:
            k = pila.pop()
            comp.append(k)
            j, i = divmod(k, SNX)
            if i in (0, SNX - 1) or j in (0, SNY - 1):
                borde = True
            for n in (k - 1 if i > 0 else -1, k + 1 if i < SNX - 1 else -1, k - SNX, k + SNX):
                if 0 <= n < len(libre) and libre[n] and not visto[n]:
                    visto[n] = True
                    pila.append(n)
        if not borde and len(comp) * CELDA_SIM ** 2 <= area_max:
            codigos.ravel()[comp] = SIM_EDIFICIO
            cerrados += 1
    return cerrados


def aplicar_parcelas():
    """PARCELAS DEL CATASTRO. Dentro de una parcela con edificio, lo que no es edificio es un PATIO o jardín privado:
    tiene vallas o muros hacia la calle y desagua por la casa, así que el agua de la calle no entra y la suya se va.
    Una parcela sin edificio que no es zona verde es un SOLAR de tierra. Devuelve (patios, solares, muros) en celdas."""
    ruta = os.path.join(DIR, "datos_catastro", "parcelas.json")
    if not os.path.exists(ruta):
        return 0, 0, 0
    id_parcela = np.zeros((SNY, SNX), np.int32)
    con_edificio = [False]
    with open(ruta, encoding="utf-8") as f:
        for k, parcela in enumerate(json.load(f), start=1):
            p = [a_metros(lon, lat) for lat, lon in parcela["anillo"][:-1]]
            if len(p) < 3:
                con_edificio.append(False)
                continue
            if area_firmada(p) < 0:
                p = p[::-1]
            rasterizar(p, k, id_parcela, CELDA_SIM)
            con_edificio.append(parcela["ref"] in REFS_CON_EDIFICIO)
    con_edificio = np.array(con_edificio)
    abierto = np.isin(codigos, (SIM_URBANO, SIM_CESPED, SIM_BOSQUE, SIM_MATORRAL))
    # Solo es patio si es un espacio privado y recogido: poco espacio libre (≤ 1 500 m²) o edificios que cubren al
    # menos el 40 % de la parcela. Las parcelas grandes y abiertas (patios de escuela, explanadas de naves, bloques
    # con jardín abierto) siguen como espacio abierto, sin muro.
    n = len(con_edificio)
    libre_parcela = np.bincount(id_parcela[abierto], minlength=n)
    edif_parcela = np.bincount(id_parcela[codigos == SIM_EDIFICIO], minlength=n)
    recogida = con_edificio & ((libre_parcela * CELDA_SIM ** 2 <= 1500)
                               | (edif_parcela >= 0.4 * (edif_parcela + libre_parcela)))
    recogida[0] = False
    patio = recogida[id_parcela] & abierto
    solar = (id_parcela > 0) & ~con_edificio[id_parcela] & (codigos == SIM_URBANO)
    codigos[patio] = SIM_PATIO
    codigos[solar] = SIM_SOLAR
    # Muro: celda de patio que toca la vía pública (vecindad de 4, fuera de toda parcela y no edificio)
    publico = (id_parcela == 0) & (codigos != SIM_EDIFICIO)
    toca = np.zeros_like(publico)
    toca[1:] |= publico[:-1]; toca[:-1] |= publico[1:]; toca[:, 1:] |= publico[:, :-1]; toca[:, :-1] |= publico[:, 1:]
    muro = (codigos == SIM_PATIO) & toca
    codigos[muro] = SIM_MURO
    return int((codigos == SIM_PATIO).sum()), int(solar.sum()), int(muro.sum())


parcelas_cuenta = aplicar_parcelas()
patios_cerrados = cerrar_patios()

# ---------------------------------------------------------------- análisis hidrológico (rasgos de cada celda)
# El lecho es el mismo que usa la simulación del visor: terreno + muro de edificios, cauce y bordillo.
XC = -LIM[0] + (np.arange(SNX) + 0.5) * CELDA_SIM
ZC = -LIM[1] + (np.arange(SNY) + 0.5) * CELDA_SIM
# Relieve FINO para la simulación: el MDT de 5 m del ICGC muestreado en cada celda de 4 m (la malla visual es de
# 12 m y suaviza bombeos y desniveles). Al visor va la diferencia con la malla visual, en pasos de 2 cm.
suelo_visual = np.array([[altura(x, -z) for x in XC] for z in ZC])
suelo_celda = np.array([[(elevacion(LON0 + x / KX, LAT0 - z / KY) - ELEV_MIN) * EXAGERACION for x in XC] for z in ZC])
diferencia_suelo = np.clip(np.round((suelo_celda - suelo_visual) / 0.02), -127, 127).astype(np.int8)
suelo_celda = suelo_visual + diferencia_suelo * 0.02           # exactamente lo que reconstruye el visor
lecho = suelo_celda + np.array(LECHO)[codigos]


def relleno_y_drenaje(B):
    """Priority-flood (Barnes et al. 2014) con salida libre por el borde: rellena las hondonadas y da a cada celda
    la celda hacia la que drena. Devuelve la profundidad de hondonada (m) y el área que drena a cada celda (m²)."""
    import heapq
    ny, nx = B.shape
    Bl = B.ravel().tolist()
    F = Bl[:]
    padre = [-1] * (nx * ny)
    visto = [False] * (nx * ny)
    cola = []
    for j in range(ny):
        for i in range(nx):
            if j in (0, ny - 1) or i in (0, nx - 1):
                k = j * nx + i
                visto[k] = True
                heapq.heappush(cola, (F[k], k))
    orden = []
    vecinos = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while cola:
        h, k = heapq.heappop(cola)
        orden.append(k)
        j, i = divmod(k, nx)
        for dj, di in vecinos:
            jj, ii = j + dj, i + di
            if 0 <= jj < ny and 0 <= ii < nx:
                n = jj * nx + ii
                if not visto[n]:
                    visto[n] = True
                    F[n] = max(Bl[n], h + 1e-4)    # pendiente mínima en los llanos para que drenen
                    padre[n] = k
                    heapq.heappush(cola, (F[n], n))
    area = [CELDA_SIM * CELDA_SIM] * (nx * ny)
    for k in reversed(orden):                      # de arriba abajo: cada celda pasa su área a la de abajo
        if padre[k] >= 0:
            area[padre[k]] += area[k]
    return (np.array(F) - np.array(Bl)).reshape(ny, nx), np.array(area).reshape(ny, nx)


hondonada, cuenca = relleno_y_drenaje(lecho)
gz, gx = np.gradient(suelo_celda, CELDA_SIM)
pendiente = np.hypot(gx, gz) * 100                                       # %
clase_pend = np.digitize(pendiente, [1, 4, 10]).astype(np.uint8)          # 0 plana · 1 suave · 2 media · 3 fuerte
clase_hond = np.digitize(hondonada, [0.05, 0.3, 1.0]).astype(np.uint8)    # 0 no · 1 leve · 2 marcada · 3 profunda
clase_cuen = np.digitize(cuenca, [500, 5000, 20000, 100000, 500000]).astype(np.uint8)   # m² que drenan aquí
rasgos = clase_pend | (clase_hond << 2) | (clase_cuen << 4)               # un byte por celda

# ---------------------------------------------------------------- calle más cercana (para nombrar puntos)
nombres_calle = sorted({n for _, n in CALLES_CON_NOMBRE})
id_calle = np.zeros((SNY, SNX), np.uint16)
dist_calle = np.full((SNY, SNX), 35.0)                                    # más lejos de 35 m: sin nombre
for puntos, nombre in CALLES_CON_NOMBRE:
    k = nombres_calle.index(nombre) + 1
    for (xa, ya), (xb, yb) in zip(puntos, puntos[1:]):
        cerca = celdas_cerca(xa, -ya, xb, -yb, 35.0)
        if cerca:
            ventana, d = cerca
            mejor = d < dist_calle[ventana]
            dist_calle[ventana][mejor] = d[mejor]
            id_calle[ventana][mejor] = k

# ---------------------------------------------------------------- equipamientos
CATEGORIA = {"school": "educacion", "kindergarten": "educacion", "college": "educacion",
             "clinic": "salud", "doctors": "salud", "hospital": "salud",
             "social_facility": "social", "community_centre": "social", "library": "social",
             "fire_station": "emergencia", "police": "emergencia"}
equipamientos = []
ruta_eq = os.path.join(DIR, "datos_osm", "equipamientos.json")
if os.path.exists(ruta_eq):
    with open(ruta_eq, encoding="utf-8") as f:
        for e in json.load(f)["elements"]:
            t = e.get("tags", {})
            lat, lon = (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
            x, y = a_metros(lon, lat)
            cat = "salud" if t.get("social_facility") == "nursing_home" else CATEGORIA.get(t.get("amenity"))
            if cat and t.get("name") and abs(x) < LIM[0] and abs(y) < LIM[1]:
                equipamientos.append({"nombre": t["name"], "tipo": cat, "x": round(x, 1), "z": round(-y, 1)})

# ---------------------------------------------------------------- datos del visor (binarios, se comprimen al ensamblar)
def guardar(nombre, array):
    with open(os.path.join(SALIDA_DATOS, nombre + ".bin"), "wb") as f:
        f.write(np.ascontiguousarray(array).tobytes())


guardar("codigos", codigos)
guardar("rasgos", rasgos)
guardar("calles", id_calle)
guardar("edificios", id_edificio)
guardar("terreno", np.round(ALT * 100).astype(np.uint16))                 # cm
guardar("sotanos", np.array(sotanos_edificio, np.uint8))                 # por edificio (índice de id_edificio − 1)
guardar("suelo4m", diferencia_suelo)                                     # relieve fino − malla visual (2 cm)


# ACERAS Y CALZADA a 1 m para pintarlas en el suelo del visor: 0 nada · 1 acera · 2 calzada.
# Acera = junto a la calzada real (≤ 6 m) y junto a un bordillo (≤ 4 m), fuera de edificios, zonas verdes y agua.
# Los edificios (3) van en la misma máscara: el coche choca contra ella (pesa mucho menos que las huellas)
aceras_1m = np.zeros((N1Y, N1X), np.uint8)
if CALZADA_1M is not None:
    F = int(CELDA_SIM)
    verde_o_agua = np.isin(codigos, (SIM_CESPED, SIM_BOSQUE, SIM_MATORRAL, SIM_AGUA)).repeat(F, 0).repeat(F, 1)
    acera = dilatar(CALZADA_1M, 6) & dilatar(BORDILLO_1M, 4) & ~CALZADA_1M & ~EDIF_1M & ~verde_o_agua
    aceras_1m[acera] = 1
    aceras_1m[CALZADA_1M] = 2
aceras_1m[EDIF_1M] = 3
# Debajo de un puente no se pinta calzada ni acera en el suelo (se ve el río o lo que haya): el tablero va encima
for b in PUENTES:
    for (xa, za, _), (xb, zb, _) in zip(b["p"], b["p"][1:]):
        L = math.hypot(xb - xa, zb - za) or 1
        for q in range(int(L * 2) + 1):
            for w in np.arange(-b["ancho"] / 2, b["ancho"] / 2 + 0.01, 0.5):
                x = xa + (xb - xa) * q / (L * 2) - (zb - za) / L * w
                z = za + (zb - za) * q / (L * 2) + (xb - xa) / L * w
                i, j = int(x + LIM[0]), int(z + LIM[1])
                if 0 <= i < N1X and 0 <= j < N1Y and aceras_1m[j, i] != 3:
                    aceras_1m[j, i] = 0
guardar("aceras", aceras_1m)


def arboles_en_su_sitio(lista):
    """El LiDAR da la CIMA de la copa, y en los árboles de acera la copa se inclina hacia la calzada: el tronco
    quedaría en medio de la calle. Un árbol que cae en calzada o en un edificio se lleva a la acera más cercana
    (o, si no hay, a suelo libre) a 8 m como mucho; si no hay sitio, se quita."""
    anillos = sorted(((di, dj) for dj in range(-8, 9) for di in range(-8, 9) if di * di + dj * dj <= 64),
                     key=lambda d: d[0] ** 2 + d[1] ** 2)
    salida, movidos, quitados = [], 0, 0
    COPAS.clear()
    for a in lista:
        i, j = int(a[0] / 10 + LIM[0]), int(a[1] / 10 + LIM[1])
        if not (0 <= i < N1X and 0 <= j < N1Y) or aceras_1m[j, i] in (0, 1):
            salida.append(a)
            COPAS.append((0, 0))
            continue
        if TIPOS_ARBOL[a[2]] == "arbusto":
            quitados += 1
            continue
        sitio = None
        for buscado in (1, 0):        # primero acera, después cualquier suelo libre
            for di, dj in anillos:
                ii, jj = i + di, j + dj
                if 0 <= ii < N1X and 0 <= jj < N1Y and aceras_1m[jj, ii] == buscado:
                    sitio = (ii, jj)
                    break
            if sitio:
                break
        if sitio is None:
            quitados += 1
            continue
        movidos += 1
        nuevo = (round((sitio[0] + 0.5 - LIM[0]) * 10), round((sitio[1] + 0.5 - LIM[1]) * 10))
        salida.append((*nuevo, *a[2:]))
        # La copa se queda donde la vio el LiDAR (sobre la calzada): el tronco se inclina hacia ella
        COPAS.append((max(-127, min(127, a[0] - nuevo[0])), max(-127, min(127, a[1] - nuevo[1]))))
    print(f"ÁRBOLES: {movidos} llevados de la calzada a la acera, {quitados} quitados (sin sitio cerca)")
    return salida


COPAS = []    # por árbol: desplazamiento de la copa respecto al tronco (x, z en dm)
arboles = arboles_en_su_sitio(arboles)
guardar("arboles", np.array(arboles, np.int16))
guardar("copas", np.array(COPAS, np.int8))


def farolas_reales():
    """FAROLAS de la cartografía 1:1000 del AMB (obtener_farolas.py): (x dm, z dm, tipo) con tipo 0 = de columna,
    1 = de fachada (el punto cae dentro de un edificio: se pega a la pared más cercana). Las que caen en la calzada
    por el desajuste de ~1 m con el bordillo pasan a la acera si la hay a ≤ 3 m (si no, mediana: se quedan)."""
    ruta = os.path.join(DIR, "datos_catastro", "farolas.json")
    if not os.path.exists(ruta):
        return None
    with open(ruta, encoding="utf-8") as f:
        puntos = json.load(f)["farolas"]
    cerca = sorted(((di, dj) for dj in range(-3, 4) for di in range(-3, 4) if di * di + dj * dj <= 9),
                   key=lambda d: d[0] ** 2 + d[1] ** 2)
    salida, fachada = [], 0
    for x, y in puntos:
        z = -y
        i, j = int(x + LIM[0]), int(z + LIM[1])
        if not (0 <= i < N1X and 0 <= j < N1Y):
            continue
        tipo, v = 0, aceras_1m[j, i]
        if v in (2, 3):
            buscado = (0, 1) if v == 3 else (1,)
            sitio = next(((i + di, j + dj) for di, dj in cerca if 0 <= i + di < N1X and 0 <= j + dj < N1Y
                          and aceras_1m[j + dj, i + di] in buscado), None)
            if v == 3:
                tipo, fachada = 1, fachada + 1
            if sitio:
                # De fachada: justo en el borde del edificio (medio metro hacia la calle desde el píxel libre)
                x, z = sitio[0] + 0.5 - LIM[0], sitio[1] + 0.5 - LIM[1]
        salida.append((round(x * 10), round(z * 10), tipo))
    print(f"FAROLAS (AMB 1:1000): {len(salida)} · de fachada {fachada}")
    return salida


FAROLAS = farolas_reales()
if FAROLAS:
    guardar("farolas", np.array(FAROLAS, np.int16))

# SECCIONES CENSALES con renta e indicadores del INE (obtener_vulnerabilidad.py): número de sección en cada celda de
# 4 m (0 = fuera de Ripollet) y los datos de cada una en datos.json. Las grandes primero: una sección rodeada por
# otra queda encima.
SECCIONES = None
RUTA_SECCIONES = os.path.join(DIR, "datos_publicos", "secciones.json")
if os.path.exists(RUTA_SECCIONES):
    with open(RUTA_SECCIONES, encoding="utf-8") as f:
        SECCIONES = json.load(f)
    id_seccion = np.zeros((SNY, SNX), np.uint8)
    anillos = [(abs(area_firmada(a)), k, a) for k, s in enumerate(SECCIONES["secciones"], 1) for a in s["anillos"]]
    for _, k, a in sorted(anillos, key=lambda t: -t[0]):
        rasterizar([tuple(p) for p in a], k, id_seccion, CELDA_SIM)
    guardar("secciones", id_seccion)
    print(f"SECCIONES CENSALES: {len(SECCIONES['secciones'])} · {np.count_nonzero(id_seccion) * CELDA_SIM ** 2 / 1e4:.0f} ha "
          f"de la maqueta dentro de Ripollet")

# LUGARES DE INTERÉS (obtener_lugares.py): los de dentro de la maqueta, como JSON comprimido aparte (blob «lugares»)
RUTA_LUGARES = os.path.join(DIR, "datos_osm", "lugares.json")
if os.path.exists(RUTA_LUGARES):
    with open(RUTA_LUGARES, encoding="utf-8") as f:
        dentro = [l for l in json.load(f) if abs(l["x"]) < LIM[0] and abs(l["z"]) < LIM[1]
                  and l.get("t") != "townhall" and not re.search(r"ajuntament|ayuntamiento", l.get("n", ""), re.I)]
    with open(os.path.join(SALIDA_DATOS, "lugares.bin"), "wb") as f:
        f.write(json.dumps(dentro, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(f"LUGARES DE INTERÉS: {len(dentro)}")

# ZONAS ACÚSTICAS (obtener_ambiente.py): zona de capacidad acústica de cada celda de 4 m (0 = sin zona); los contornos
# grandes primero, para que los que están dentro de otro queden encima
ZONAS_ACUSTICAS = None
RUTA_ACUSTICA = os.path.join(DIR, "datos_publicos", "zonas_acusticas.json")
if os.path.exists(RUTA_ACUSTICA):
    with open(RUTA_ACUSTICA, encoding="utf-8") as f:
        ZA = json.load(f)
    id_acustica = np.zeros((SNY, SNX), np.uint8)
    contornos = [(abs(area_firmada(a)), k, a) for k, z in enumerate(ZA["zonas"], 1) for a in z["anillos"]]
    for _, k, a in sorted(contornos, key=lambda c: -c[0]):
        rasterizar([tuple(p) for p in a], k, id_acustica, CELDA_SIM)
    guardar("acustica", id_acustica)
    ZONAS_ACUSTICAS = {"fuente": ZA["fuente"], "lista": [{k: v for k, v in z.items() if k != "anillos"} for z in ZA["zonas"]]}
    print(f"ZONAS ACÚSTICAS: {np.count_nonzero(id_acustica) * CELDA_SIM ** 2 / 1e4:.0f} ha con zona")

# DIRECCIONES (obtener_direcciones.py): cada portal del Catastro con su número, su edificio y el nombre de su calle.
# El Catastro da la calle como código: se le pone el nombre de la calle de OSM más cercana a la mayoría de sus portales.
RUTA_DIR = os.path.join(DIR, "datos_catastro", "direcciones.json")
if os.path.exists(RUTA_DIR):
    with open(RUTA_DIR, encoding="utf-8") as f:
        portales = json.load(f)
    ref_a_ed = {r: k + 1 for k, r in enumerate(REF_EDIFICIO) if r}
    votos, salida_dir = {}, []
    for d in portales:
        x, y = a_metros(d["lon"], d["lat"])
        i, j = int((x + LIM[0]) / CELDA_SIM), int((-y + LIM[1]) / CELDA_SIM)
        if not (0 <= i < SNX and 0 <= j < SNY):
            continue
        d["x"], d["z"], d["calle_osm"] = round(x, 1), round(-y, 1), int(id_calle[j, i])
        clave = (d["muni"], d["via"])
        if d["calle_osm"]:
            votos.setdefault(clave, {}).setdefault(d["calle_osm"], 0)
            votos[clave][d["calle_osm"]] += 1
        salida_dir.append(d)
    nombre_via = {k: max(v, key=v.get) for k, v in votos.items()}
    lista = [[nombre_via[(d["muni"], d["via"])], d["n"], d["x"], d["z"], ref_a_ed.get(d["ref"], 0)]
             for d in salida_dir if (d["muni"], d["via"]) in nombre_via]
    with open(os.path.join(SALIDA_DATOS, "direcciones.bin"), "wb") as f:
        f.write(json.dumps(lista, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(f"DIRECCIONES: {len(lista)} portales con calle · {sum(1 for q in lista if q[4])} con su edificio")

# RECOGIDA DE RESIDUOS (obtener_residuos.py): sector de cada celda de 4 m y puntos y calendarios (blob «residuos»)
RUTA_RESIDUOS = os.path.join(DIR, "datos_publicos", "residuos.json")
if os.path.exists(RUTA_RESIDUOS):
    with open(RUTA_RESIDUOS, encoding="utf-8") as f:
        RES = json.load(f)
    id_sector = np.zeros((SNY, SNX), np.uint8)
    for s_ in sorted(RES["sectores"], key=lambda s_: -abs(area_firmada([(x, -z) for x, z in s_["anillo"]]))):
        rasterizar([(x, -z) for x, z in s_["anillo"]], s_["sector"], id_sector, CELDA_SIM)
    # El mapa del servicio deja huecos entre sectores (p. ej. alrededor de la calle Balmes): dentro de Ripollet, cada
    # celda de un hueco toma el sector más cercano a 200 m o menos, marcado como «probable» (sector + 4)
    if SECCIONES is not None:
        crece = id_sector.copy()
        for _ in range(50):
            n_ = crece.copy()
            for d0, d1 in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                vecino = np.roll(crece, (d0, d1), axis=(0, 1))
                n_ = np.where((n_ == 0) & (vecino > 0), vecino, n_)
            crece = n_
        hueco = (id_sector == 0) & (crece > 0) & (id_seccion > 0)
        id_sector[hueco] = crece[hueco] + 4
        print(f"RESIDUOS: {hueco.sum() * CELDA_SIM ** 2 / 1e4:.0f} ha de huecos con sector probable")
    guardar("sectores", id_sector)
    with open(os.path.join(SALIDA_DATOS, "residuos.bin"), "wb") as f:
        f.write(json.dumps({k: RES[k] for k in ("fuente", "calendarios", "puntos")}, ensure_ascii=False,
                           separators=(",", ":")).encode("utf-8"))
    print(f"RESIDUOS: {np.count_nonzero(id_sector) * CELDA_SIM ** 2 / 1e4:.0f} ha con sector · {len(RES['puntos'])} puntos")

# PLANEAMIENTO (obtener_planeamiento.py): calificación MUC de cada celda de 4 m (índice en la lista de datos.json)
PLANEAMIENTO = None
RUTA_PLAN = os.path.join(DIR, "datos_publicos", "planeamiento.json")
if os.path.exists(RUTA_PLAN):
    with open(RUTA_PLAN, encoding="utf-8") as f:
        PL = json.load(f)
    claves = sorted({(z["codigo"], z["nombre"]) for z in PL["zonas"]})
    indice_q = {c: k + 1 for k, c in enumerate(claves)}
    id_plan = np.zeros((SNY, SNX), np.uint16)
    contornos = [(abs(area_firmada(a)), indice_q[(z["codigo"], z["nombre"])], a) for z in PL["zonas"] for a in z["anillos"]]
    for _, k, a in sorted(contornos, key=lambda c: -c[0]):   # los grandes primero; los agujeros los tapan los de dentro
        rasterizar([tuple(p) for p in a], k, id_plan, CELDA_SIM)
    guardar("planeamiento", id_plan)
    PLANEAMIENTO = {"fuente": PL["fuente"], "lista": [{"codigo": c, "nombre": n} for c, n in claves]}
    print(f"PLANEAMIENTO: {len(claves)} calificaciones · {np.count_nonzero(id_plan) * CELDA_SIM ** 2 / 1e4:.0f} ha")

# COBERTURAS DEL SUELO (obtener_cobertes.py): rejilla de 2 m, para pintar el suelo que OSM no describe
RUTA_COBERTES = os.path.join(DIR, "datos_publicos", "cobertes_2m.bin")
if os.path.exists(RUTA_COBERTES):
    import shutil
    shutil.copyfile(RUTA_COBERTES, os.path.join(SALIDA_DATOS, "cobertes.bin"))

# TRANSPORTE PÚBLICO (obtener_transporte.py): paradas, líneas y horarios, como JSON comprimido (blob «transporte»)
RUTA_TRANSPORTE = os.path.join(DIR, "datos_publicos", "transporte.json")
if os.path.exists(RUTA_TRANSPORTE):
    with open(RUTA_TRANSPORTE, "rb") as f:
        with open(os.path.join(SALIDA_DATOS, "transporte.bin"), "wb") as g:
            g.write(f.read())

# REHABILITACIÓN: por edificio, año y viviendas (Catastro) y certificados energéticos (ICAEN) por referencia
# catastral (los 14 primeros caracteres = el edificio). Blob «rehab» (Uint16 × 5 por edificio): año, viviendas,
# certificados, certificados E–G, letra mediana (1 = A … 7 = G, 0 = ninguno) + 8 × placas FV + 16 × uso.
USOS = ["", "residential", "industrial", "publicServices", "retail", "office", "agriculture"]
DIRECCIONES = {}
RUTA_CAT, RUTA_CERT = (os.path.join(DIR, "datos_publicos", n) for n in ("catastro_edificios.json", "certificados_ripollet.json"))
if os.path.exists(RUTA_CAT):
    with open(RUTA_CAT, encoding="utf-8") as f:
        CAT = json.load(f)
    certs = {}
    if os.path.exists(RUTA_CERT):
        with open(RUTA_CERT, encoding="utf-8") as f:
            for c in json.load(f):
                if c.get("referencia_cadastral"):
                    certs.setdefault(c["referencia_cadastral"][:14], []).append(c)
    rehab = np.zeros((len(REF_EDIFICIO), 5), np.uint16)
    for k, ref in enumerate(REF_EDIFICIO):
        e = CAT.get(ref or "", {})
        lista = certs.get(ref or "", [])
        letras = sorted("ABCDEFG".index(c["qualificacio_d_emissions"]) + 1 for c in lista
                        if c.get("qualificacio_d_emissions") in tuple("ABCDEFG"))
        uso = re.sub(r"^(\d+_)+", "", e.get("uso") or "")
        pv = any(c.get("solar_fotovoltaica") == "SI" for c in lista)
        rehab[k] = (e.get("anio") or 0, e.get("viviendas") or 0, len(letras), sum(l >= 5 for l in letras),
                    (letras[len(letras) // 2] if letras else 0) + 8 * pv + 16 * (USOS.index(uso) if uso in USOS else 0))
        if lista and lista[0].get("adre_a"):
            DIRECCIONES[k + 1] = f"{lista[0]['adre_a']} {lista[0].get('numero', '')}".strip()
    guardar("rehab", rehab)
    print(f"REHABILITACIÓN: {int((rehab[:, 0] > 0).sum())} edificios con año · {int((rehab[:, 2] > 0).sum())} con "
          f"certificado · {int(((rehab[:, 0] > 0) & (rehab[:, 0] < 1980)).sum())} anteriores a 1980")

# Más análisis: sombras (cubiertas a 1 m), accesibilidad de aceras, grafo de calles, potencial solar, servicios
import funciones_datos as FD                # noqa: E402
# Cubiertas a 2 m (suficiente para las sombras), en pasos de 0,5 m
guardar("techos2m", np.clip(np.round(TECHO_1M.reshape(N1Y // 2, 2, N1X // 2, 2).max(axis=(1, 3)) / 0.5), 0, 255)
        .astype(np.uint8))
guardar("acces1m", FD.accesibilidad(aceras_1m, suelo_celda, CELDA_SIM))
nodos_g, aristas_g = FD.grafo(vias, nodos, a_metros, LIM, ANCHOS, PEATONALES)
guardar("grafo_nodos", nodos_g)
guardar("grafo_aristas", aristas_g)
RUTA_VEG = os.path.join(DIR, "datos_arboles", "vegetacion_1m.bin")
VEG_1M = (np.fromfile(RUTA_VEG, np.uint8).reshape(N1Y, N1X) * 0.2) if os.path.exists(RUTA_VEG) else None
solar = FD.potencial_solar(TECHO_1M, EDIF_2M, suelo_celda, ES_CASA, LAT0, VEG_1M)
guardar("solar2m", solar["mapa"])
servicios = FD.servicios(os.path.join(DIR, "datos_osm", "comercios.json"), a_metros, LIM)

lugares = []
for nombre, lat, lon in LUGARES:
    x, y = a_metros(lon, lat)
    lugares.append({"nombre": nombre, "pos": [round(x, 1), round(altura(x, y) + 25, 1), round(-y, 1)]})
datos = {
    "lugares": lugares, "salida": salida[1], "equipamientos": equipamientos, "calles": nombres_calle,
    "terreno": {"lx": LIM[0], "ly": LIM[1], "gx": GX, "gy": GY, "nx": NX, "ny": NY},
    "sim": {"nx": SNX, "ny": SNY, "celda": CELDA_SIM, "x0": -LIM[0], "z0": -LIM[1], "lecho": LECHO,
            "infiltracion": INFILTRACION},
    "edificios": n_edificios, "arboles": len(arboles), "tiposArbol": TIPOS_ARBOL,
    "arbolesReales": bool(LIDAR),
    "puentes": PUENTES,
    "zonasAcusticas": ZONAS_ACUSTICAS,
    "planeamiento": PLANEAMIENTO,
    "accidentes": (json.load(open(os.path.join(DIR, "datos_publicos", "accidentes_ripollet.json"), encoding="utf-8"))
                   if os.path.exists(os.path.join(DIR, "datos_publicos", "accidentes_ripollet.json")) else None),
    "direcciones": DIRECCIONES,     # índice de edificio → dirección (de los certificados energéticos)
    "secciones": ({"fuente": SECCIONES["fuente"], "anio": SECCIONES["anio"],
                   "lista": [{k: v for k, v in s.items() if k != "anillos"} for s in SECCIONES["secciones"]]}
                  if SECCIONES else None),             # tableros: el coche, el tráfico y la gente pasan por encima   # alto = altura total medida (LiDAR); si no, alto de la copa inventada
    "fuenteEdificios": "catastro" if os.path.exists(RUTA_CATASTRO) else "osm",
    "aceras": {"nx": N1X, "ny": N1Y, "celda": 1.0},
    "solar": {k: v for k, v in solar.items() if k != "mapa"},   # por edificio: kWp y kWh/año; supuestos
    "servicios": servicios,                                     # comercios, farmacias, mercado, parques infantiles
}
with open(os.path.join(SALIDA_DATOS, "datos.json"), "w", encoding="utf-8") as f:
    json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))

import ensamblar                            # noqa: E402  (genera ripollet.html y la carpeta web/)
ensamblar.construir()

caras = sum(len(o.data.polygons) for o in scene.objects if o.type == "MESH" and o.name not in MALLAS_ARBOL)
print(f"EDIFICIOS: {n_edificios}  ARBOLES: {len(arboles)}  CARAS (sin árboles): {caras}  "
      f"TAMAÑO: {2 * LIM[0]:.0f} x {2 * LIM[1]:.0f} m  RELIEVE: {ELEV_MIN:.0f}-{ELEV_MAX:.0f} m")
print(f"SIMULACION: {SNX} x {SNY} celdas  tipos: {np.bincount(codigos.ravel(), minlength=10).tolist()}")
print(f"HIDROLOGIA: hondonadas {np.bincount(clase_hond.ravel(), minlength=4).tolist()}  "
      f"cuencas {np.bincount(clase_cuen.ravel(), minlength=6).tolist()}  calles con nombre {len(nombres_calle)}  "
      f"equipamientos {len(equipamientos)}  patios cerrados {patios_cerrados}")
print(f"PARCELAS: patio {parcelas_cuenta[0]} · solar {parcelas_cuenta[1]} · muro {parcelas_cuenta[2]} celdas · "
      f"relieve fino: diferencia con la malla visual {np.abs(diferencia_suelo).mean() * 2:.1f} cm de media")
print(f"CATASTRO: {n_edificios} edificios, {len(SIM_EDIFICIOS)} partes, {sum(sotanos_edificio)} con sótano · "
      f"paredes interiores quitadas {PAREDES_QUITADAS[0]}")
if CALZADA_1M is not None:
    print(f"ACERAS: calzada {int((aceras_1m == 2).sum()) / 1e4:.1f} ha · aceras {int((aceras_1m == 1).sum()) / 1e4:.1f} ha")
print(f"OK -> {glb} ({os.path.getsize(glb)} bytes)")
