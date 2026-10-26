# Análisis que el visor usa además de la lluvia: accesibilidad de las aceras, grafo de calles (emergencias y
# ciudad de 15 minutos), potencial solar de las cubiertas y servicios de proximidad. Lo llama osm_ripollet.py.
# Todo con numpy vectorizado y rejillas de 1–2 m: segundos y poca memoria (el PC es modesto).
import json
import math
import numpy as np


# ---------------------------------------------------------------- accesibilidad de las aceras
def _erosion4(m):
    n = m.copy()
    n[1:] &= m[:-1]; n[:-1] &= m[1:]; n[:, 1:] &= m[:, :-1]; n[:, :-1] &= m[:, 1:]
    return n


def _dilatacion4(m):
    n = m.copy()
    n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
    return n


def accesibilidad(aceras_1m, suelo_celda, celda):
    """Por píxel de acera (1 m): clase de ANCHO en los bits 0-1 (1: ≥ 3 m · 2: 2–3 m · 3: < 2 m, por debajo de los
    1,80 m libres que pide la normativa de accesibilidad) y clase de PENDIENTE en los bits 2-3 (1: ≤ 6 % · 2: 6–8 % ·
    3: > 8 %). 0 = no es acera. El ancho sale de aperturas morfológicas sobre la máscara de 1 m: ±1 m."""
    A = aceras_1m == 1
    ancho3 = _dilatacion4(_erosion4(A)) & A                      # sobrevive a quitar 1 m por cada lado
    e2 = A.copy()                                                # bloque de 2 × 2 entero dentro de la acera
    e2[:-1] &= A[1:]; e2[:, :-1] &= A[:, 1:]; e2[:-1, :-1] &= A[1:, 1:]
    ancho2 = e2.copy()
    ancho2[1:] |= e2[:-1]; ancho2[:, 1:] |= e2[:, :-1]; ancho2[1:, 1:] |= e2[:-1, :-1]
    ancho2 &= A
    clase_ancho = np.where(ancho3, 1, np.where(ancho2, 2, 3))
    gz, gx = np.gradient(suelo_celda, celda)                     # relieve fino de 4 m (sin edificios)
    F = int(celda)
    pendiente = (np.hypot(gx, gz) * 100).repeat(F, 0).repeat(F, 1)
    clase_pend = np.where(pendiente <= 6, 1, np.where(pendiente <= 8, 2, 3))
    return np.where(A, clase_ancho | (clase_pend << 2), 0).astype(np.uint8)


# ---------------------------------------------------------------- grafo de calles
VELOCIDAD = {   # km/h para un vehículo de emergencia en circulación normal (0 = no pasa en coche)
    "motorway": 80, "motorway_link": 50, "trunk": 60, "trunk_link": 40, "primary": 50, "primary_link": 40,
    "secondary": 40, "secondary_link": 30, "tertiary": 40, "tertiary_link": 30, "unclassified": 30,
    "residential": 30, "living_street": 20, "service": 20,
}
SIN_PEATONES = {"motorway", "motorway_link", "trunk", "trunk_link"}
# Límite legal si OSM no lo dice (km/h). En ciudad (RD 970/2020): 30 en calles de un carril por sentido y 50 con dos
# o más; las vías rápidas, lo habitual en la zona (la C-58 lleva maxspeed en OSM).
LIMITE_TIPO = {"motorway": 120, "motorway_link": 60, "trunk": 80, "trunk_link": 50, "living_street": 20, "service": 20}


def limite_legal(t):
    """Velocidad máxima permitida (km/h) de una vía de coches: la de OSM o la general según tipo y carriles."""
    try:
        return int(float(t.get("maxspeed", "").split()[0]))
    except (ValueError, IndexError):
        pass
    tipo = t.get("highway")
    if tipo in LIMITE_TIPO:
        return LIMITE_TIPO[tipo]
    try:
        carriles = int(t.get("lanes", "0"))
    except ValueError:
        carriles = 0
    por_sentido = carriles if t.get("oneway") == "yes" else carriles // 2
    return 50 if por_sentido >= 2 else 30


def grafo(vias, nodos, a_metros, LIM, ANCHOS, PEATONALES):
    """Nodos (x, z de three.js en dm, Int16) y aristas (a, b, velocidad | a pie << 7 | límite legal / 10 << 8; Uint16;
    velocidad = la de un vehículo de emergencia, límite = el permitido a los demás). Sin sentidos únicos:
    emergencias y peatones los pueden ignorar. Entra todo tramo con algún extremo dentro de la maqueta (+50 m)."""
    indice, puntos, aristas = {}, [], []
    dentro = lambda x, y: abs(x) <= LIM[0] + 50 and abs(y) <= LIM[1] + 50

    def nodo(n):
        if n not in indice:
            x, y = a_metros(*nodos[n])
            indice[n] = len(puntos)
            puntos.append((round(x * 10), round(-y * 10)))
        return indice[n]

    for via in vias:
        t = via["tags"]
        tipo = t.get("highway")
        if (tipo not in ANCHOS and tipo not in VELOCIDAD) or t.get("area") == "yes":
            continue
        velocidad = VELOCIDAD.get(tipo, 0) if (tipo not in PEATONALES or tipo == "living_street") else 0
        a_pie = tipo not in SIN_PEATONES
        if not velocidad and not a_pie:
            continue
        limite = min(15, max(1, limite_legal(t) // 10)) if velocidad else 0    # en decenas, hacia abajo
        ns = [n for n in via["nodes"] if n in nodos]
        for a, b in zip(ns, ns[1:]):
            if dentro(*a_metros(*nodos[a])) or dentro(*a_metros(*nodos[b])):
                aristas.append((nodo(a), nodo(b), velocidad | (128 if a_pie else 0) | (limite << 8)))
    assert len(puntos) < 65536, "demasiados nodos para Uint16"
    return np.array(puntos, np.int16), np.array(aristas, np.uint16)


# ---------------------------------------------------------------- potencial solar
GHI = 1550          # kWh/m²·año en horizontal (orden de magnitud del área de Barcelona; orientativo)
DIRECTA = 0.65      # parte directa (la que se pierde en sombra); el resto, difusa


def _sombra(dsm, azimut, elevacion, paso, distancia_max):
    """Celdas en sombra para un sol (azimut desde el norte, horario): alguna celda hacia el sol tapa el rayo."""
    ny, nx = dsm.shape
    di, dj = math.sin(azimut), -math.cos(azimut)                  # columnas al este, filas al sur
    tan_e = math.tan(elevacion)
    alcance = min(distancia_max, (float(dsm.max()) - float(dsm.min())) / tan_e)
    sombra = np.zeros(dsm.shape, bool)
    vistos = set()
    for k in range(1, int(alcance / paso) + 2):
        oi, oj = round(k * di), round(k * dj)
        if (oi, oj) in vistos:
            continue
        vistos.add((oi, oj))
        j0, j1 = max(0, -oj), ny - max(0, oj)
        i0, i1 = max(0, -oi), nx - max(0, oi)
        if j1 <= j0 or i1 <= i0:
            break
        vecino = dsm[j0 + oj:j1 + oj, i0 + oi:i1 + oi]
        sombra[j0:j1, i0:i1] |= vecino > dsm[j0:j1, i0:i1] + math.hypot(oi, oj) * paso * tan_e + 0.3
    return sombra


def potencial_solar(techo_1m, edif_2m, suelo_celda, es_casa, latitud, vegetacion_1m=None):
    """Irradiación anual de cada cubierta (rejilla de 2 m) con las sombras de los vecinos, del relieve y, si se da,
    de los árboles (altura de la vegetación del LiDAR, 1 m), el día 15 de cada mes, hora a hora; y por edificio,
    potencia (kWp) y producción (kWh/año) orientativas."""
    ny, nx = edif_2m.shape
    techo = techo_1m.reshape(ny, 2, nx, 2).max(axis=(1, 3))
    suelo = suelo_celda.repeat(2, 0).repeat(2, 1)[:ny, :nx]
    dsm = np.maximum(suelo, techo).astype(np.float32)
    if vegetacion_1m is not None:
        dsm = np.maximum(dsm, suelo + vegetacion_1m.reshape(ny, 2, nx, 2).max(axis=(1, 3)))
    cubierta = edif_2m > 0
    phi = math.radians(latitud)
    luz, peso_total = np.zeros(dsm.shape, np.float32), 0.0
    for mes in range(12):
        dia = 15 + 30.44 * mes
        decl = math.radians(23.44) * math.sin(2 * math.pi * (284 + dia) / 365)
        for hora in np.arange(5.5, 19.0, 1.0):                   # hora solar
            h = math.radians(15 * (hora - 12))
            sin_e = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(h)
            if sin_e < math.sin(math.radians(5)):
                continue
            azimut = math.atan2(math.sin(h), math.cos(h) * math.sin(phi) - math.tan(decl) * math.cos(phi)) + math.pi
            peso = sin_e * 0.7 ** ((1 / sin_e) ** 0.678)         # radiación directa en horizontal (cielo claro)
            luz += peso * ~_sombra(dsm, azimut, math.asin(sin_e), 2.0, 150.0)
            peso_total += peso
    irradiacion = GHI * ((1 - DIRECTA) + DIRECTA * luz / peso_total)
    ids = edif_2m[cubierta] - 1
    n = len(es_casa)
    celdas = np.bincount(ids, minlength=n)
    media = np.bincount(ids, irradiacion[cubierta], minlength=n) / np.maximum(celdas, 1)
    util = np.where(np.array(es_casa), 0.4, 0.6)                 # parte aprovechable: faldón al sur / azotea
    kwp = celdas * 4.0 * util * 0.2                              # ≈ 200 Wp por m² de panel
    kwh = kwp * media * 0.8                                      # rendimiento del sistema
    print(f"SOLAR: {len(ids)} celdas de cubierta · irradiación media "
          f"{irradiacion[cubierta].mean():.0f} kWh/m²·año · total {kwh.sum() / 1e6:.1f} GWh/año")
    # Mapa para colorear cubiertas: en decenas de kWh/m², redondeado a pasos de 50 (comprime mucho mejor)
    return {"mapa": np.where(cubierta, np.clip(np.round(irradiacion / 50) * 5, 0, 255), 0).astype(np.uint8),
            "kwp": [round(float(v), 1) for v in kwp], "kwh": [int(v) for v in kwh],
            "supuestos": {"ghi": GHI, "directa": DIRECTA, "wpm2": 200, "rendimiento": 0.8,
                          "util_azotea": 0.6, "util_tejado": 0.4}}


# ---------------------------------------------------------------- servicios de proximidad
TIPO_SERVICIO = {"supermarket": "alimentacion", "convenience": "alimentacion", "bakery": "alimentacion",
                 "greengrocer": "alimentacion", "butcher": "alimentacion", "marketplace": "alimentacion",
                 "pharmacy": "farmacia", "playground": "juegos"}


def servicios(ruta, a_metros, LIM):
    try:
        with open(ruta, encoding="utf-8") as f:
            elementos = json.load(f)["elements"]
    except (OSError, ValueError):
        return []
    lista = []
    for e in elementos:
        t = e.get("tags", {})
        tipo = TIPO_SERVICIO.get(t.get("shop") or t.get("amenity") or t.get("leisure"))
        lat, lon = (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
        x, y = a_metros(lon, lat)
        if tipo and abs(x) < LIM[0] and abs(y) < LIM[1]:
            lista.append({"nombre": t.get("name", ""), "tipo": tipo, "x": round(x, 1), "z": round(-y, 1)})
    return lista
