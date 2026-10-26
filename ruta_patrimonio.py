# RUTA DE PATRIMONIO: un paseo por el casco antiguo de Ripollet con las paradas del inventario «Mapes de Patrimoni
# Cultural» (Diputació de Barcelona; obtener_patrimonio.py). Para cada parada: nombre, año, posición en la maqueta,
# el texto de la ficha resumido (las primeras frases de la descripción y de la historia, en catalán, como en la ficha)
# y el enlace. Empieza en el Molí d'en Rata; el orden es el paseo más corto (vecino más cercano + 2-opt).
#   python ruta_patrimonio.py   → datos_visor/ruta_patrimonio.bin (blob «rutaPatrimonio»)
import json
import math
import os
import re

DIR = os.path.dirname(os.path.abspath(__file__))
PARADAS = [   # (id de la ficha, por qué es una parada)
    "moli-den-rata", "sequia-monar", "can-buxo", "rellotge-de-sol-a-can-buxo", "xemeneia-del-moli-den-calvet",
    "moli-den-masachs-moli-den-ginestar", "placa-den-clos", "cal-roda-ca-lhortego", "torre-de-laigua",
    "esglesia-de-sant-esteve-de-ripollet", "campanar-de-lesglesia-parroquial", "jutjat-de-pau",
    "casa-del-c-calvari-46", "cal-dr-figarola", "moli-de-vent-0", "teatre-auditori-municipal", "cal-magi-2",
    "torre-de-largentera",
]
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574


def resumen(texto, maximo=360):
    """Las primeras frases completas hasta `maximo` caracteres (sin referencias bibliográficas entre corchetes)."""
    texto = re.sub(r"\s*\[[^\]]*\]", "", texto or "").replace("Descarrega PDF", "").strip()
    frases, salida = re.split(r"(?<=[.!?])\s+", texto), ""
    for f in frases:
        if len(salida) + len(f) > maximo and salida:
            break
        salida += (" " if salida else "") + f
    return salida[:maximo + 80]


fichas = {e["url"].rsplit("/", 1)[1]: e for e in
          json.load(open(os.path.join(DIR, "datos_publicos", "patrimonio.json"), encoding="utf-8"))["elementos"]}
ruta = []
for clave in PARADAS:
    e = fichas[clave]
    ruta.append({"n": e["nombre"], "a": e["any"] or (f"s. {e['siglo']}" if e["siglo"] else ""),
                 "x": round((e["lon"] - LON0) * KX, 1), "z": round(-(e["lat"] - LAT0) * KY, 1),
                 "d": resumen(e["descripcion"]), "h": resumen(e["historia"], 260), "u": e["url"]})
# Orden de paseo: desde la primera, cada vez la parada más cercana que falta
orden = [ruta.pop(0)]
while ruta:
    sig = min(ruta, key=lambda q: math.hypot(q["x"] - orden[-1]["x"], q["z"] - orden[-1]["z"]))
    ruta.remove(sig)
    orden.append(sig)
# Mejora 2-opt (deshace los cruces del recorrido, con el principio fijo)
d = lambda p, q: math.hypot(p["x"] - q["x"], p["z"] - q["z"])
mejora = True
while mejora:
    mejora = False
    for i in range(1, len(orden) - 1):
        for j in range(i + 1, len(orden)):
            fin = orden[j + 1] if j + 1 < len(orden) else None
            antes = d(orden[i - 1], orden[i]) + (d(orden[j], fin) if fin else 0)
            despues = d(orden[i - 1], orden[j]) + (d(orden[i], fin) if fin else 0)
            if despues < antes - 0.01:
                orden[i:j + 1] = orden[i:j + 1][::-1]
                mejora = True
ruta = orden
largo = sum(math.hypot(b["x"] - a["x"], b["z"] - a["z"]) for a, b in zip(ruta, ruta[1:]))
# YACIMIENTOS ARQUEOLÓGICOS del inventario: los de dentro de la maqueta con su marca, y los de justo fuera (a menos
# de 1 km del borde) en la lista, con la dirección en la que quedan
yacimientos = []
for e in fichas.values():
    if "Jaciment" not in (e["tipologia"] or ""):
        continue
    x, z = round((e["lon"] - LON0) * KX, 1), round(-(e["lat"] - LAT0) * KY, 1)
    LX, LZ = (ESTE - OESTE) / 2 * KX - 5, (NORTE - SUR) / 2 * KY - 5
    fuera = max(abs(x) - LX, abs(z) - LZ, 0)
    if fuera > 1000:
        continue
    yacimientos.append({"n": e["nombre"], "e": " · ".join(e["epoca"] or []), "a": e["any"] or e["siglo"] or "",
                        "x": x, "z": z, "dentro": fuera == 0, "d": resumen(e["descripcion"], 420),
                        "h": resumen(e["historia"], 300), "u": e["url"]})
salida = os.path.join(DIR, "datos_visor", "ruta_patrimonio.bin")
with open(salida, "wb") as f:
    f.write(json.dumps({"fuente": "Mapes de Patrimoni Cultural (Diputació de Barcelona)", "paradas": ruta, "yacimientos": yacimientos},
                       ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
print(f"YACIMIENTOS: {len(yacimientos)} ({sum(y['dentro'] for y in yacimientos)} dentro de la maqueta)")
print(f"RUTA DE PATRIMONIO: {len(ruta)} paradas, ~{largo / 1000:.1f} km en línea recta entre ellas · "
      f"{os.path.getsize(salida) / 1024:.1f} KB")
