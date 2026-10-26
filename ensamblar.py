# Ensambla el visor a partir de la plantilla, los módulos de js/ y los datos de datos_visor/:
#   ripollet.html  → un solo archivo (doble clic), con los datos comprimidos dentro
#   web/           → para publicar en un servidor: los datos van aparte y sin base64 (pesan un 25 % menos)
#   verdad.html    → la simulación física sola, para generar los datos con los que aprende Neutro
# Uso: python ensamblar.py   (o lo llama osm_ripollet.py al terminar). No necesita Blender.
import array
import base64
import json
import os
import re
import shutil
import zlib

DIR = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(DIR, "datos_visor")
BLOBS = ["codigos", "rasgos", "calles", "edificios", "terreno", "arboles", "aceras", "suelo4m",
         "techos2m", "acces1m", "grafo_nodos", "grafo_aristas", "solar2m"]
MODULOS = ["neutro_nucleo.js", "iconos.js", "logo.js", "datos.js", "simulacion.js", "inundacion.js", "comun.js",   # en este orden
           "sombra.js", "accesibilidad.js", "incendio.js", "solar.js", "rutas.js", "proyectos.js",
           "incidencias_ciudad.js", "vulnerabilidad.js", "rehabilitacion.js", "seguridad.js", "lugares.js", "transporte.js", "ambiente.js", "residuos.js", "planeamiento.js", "micasa.js", "agenda.js", "tiempo_real.js", "pixel.js", "trafico.js", "farolas.js", "mobiliario.js"]


def leer(ruta, modo="r"):
    with open(ruta, modo, **({} if "b" in modo else {"encoding": "utf-8"})) as f:
        return f.read()


def escribir(ruta, contenido):
    modo = "wb" if isinstance(contenido, bytes) else "w"
    with open(ruta, modo, **({} if modo == "wb" else {"encoding": "utf-8"})) as f:
        f.write(contenido)


def modulos():
    """Los módulos son ES modules (para Node y el navegador); dentro del visor van seguidos en un único script,
    así que se quitan sus import locales y la palabra export."""
    partes = []
    for m in MODULOS:
        if not os.path.exists(os.path.join(DIR, "js", m)):   # herramienta aún sin hacer
            continue
        codigo = leer(os.path.join(DIR, "js", m))
        codigo = re.sub(r"^import [^\n]*from '\./[^\n]*\n", "", codigo, flags=re.M)
        codigo = re.sub(r"^export (?=(const|let|function|class|async) )", "", codigo, flags=re.M)
        if m == "neutro_nucleo.js":   # Neutro es Apache 2.0: su aviso va con él también dentro de la app
            codigo = ("/*! Neutro — cerebro de neuronas de concepto. Copyright 2026 FOKO SOFT (Emilio Martinez).\n"
                      " *  Licencia Apache 2.0 (LICENSE-NEUTRO y NOTICE en https://github.com/fokosoft/Ripollet);\n"
                      " *  origen: https://github.com/fokosoft/PUBLIC-NEUTRO. Copia sin modificar. */\n" + codigo)
        partes.append(f"// ===== {m} =====\n{codigo}")
    return "\n".join(partes)


def opcional_json(nombre):
    ruta = os.path.join(DIR, nombre)
    return leer(ruta) if os.path.exists(ruta) else "null"


def fisica():
    """Profundidad máxima simulada de cada escenario (datos_sim/verdad_<mm/h>.bin, Uint16 en cm) en pasos de 2 cm,
    un byte por celda (hasta 5,1 m): casi todo es 0 y se comprime muchísimo."""
    salida = {}
    for nombre in sorted(os.listdir(os.path.join(DIR, "datos_sim")) if os.path.isdir(os.path.join(DIR, "datos_sim")) else []):
        m = re.fullmatch(r"verdad_(\d+)\.bin", nombre)
        if m:
            cm = array.array("H")
            cm.frombytes(leer(os.path.join(DIR, "datos_sim", nombre), "rb"))
            salida["fisica_" + m.group(1)] = bytes(min(255, (v + 1) // 2) for v in cm)
    return salida


def construir():
    datos = leer(os.path.join(DATOS, "datos.json"))
    comprimidos = {b: zlib.compress(leer(os.path.join(DATOS, b + ".bin"), "rb"), 9) for b in BLOBS}
    comprimidos.update({b: zlib.compress(v, 9) for b, v in fisica().items()})
    for opcional in ("oficial", "sotanos", "farolas", "secciones", "rehab", "lugares", "transporte", "acustica", "direcciones", "copas", "cobertes", "sectores", "residuos", "planeamiento"):   # zonas inundables oficiales, sótanos (Catastro), farolas (AMB)
        if os.path.exists(os.path.join(DATOS, opcional + ".bin")):
            comprimidos[opcional] = zlib.compress(leer(os.path.join(DATOS, opcional + ".bin"), "rb"), 9)
    memoria = opcional_json("neutro_memoria.json")       # lo que aprendió Neutro (entrenar_neutro.mjs)
    medicion = opcional_json("neutro_medicion.json")     # cómo se midió, frente a qué rival
    codigo_modulos = modulos()

    # Agenda: copia de web/agenda.json dentro del visor, por si no se puede leer la actualizada (archivo local)
    agenda = opcional_json(os.path.join("web", "agenda.json"))

    def visor(blobs, glb):
        return (leer(os.path.join(DIR, "visor_ripollet.html"))
                .replace("/*__MODULOS__*/", codigo_modulos)
                .replace("__DATOS__", datos)
                .replace("__BLOBS__", blobs)
                .replace("__GLB__", glb)
                .replace("__MEMORIA__", memoria)
                .replace("__MEDICION__", medicion)
                .replace("__AGENDA__", agenda))

    # 1) Un solo archivo
    b64 = {b: base64.b64encode(c).decode() for b, c in comprimidos.items()}
    glb = base64.b64encode(leer(os.path.join(DATOS, "ripollet.glb"), "rb")).decode()
    escribir(os.path.join(DIR, "ripollet.html"),
             visor(json.dumps(b64), "data:model/gltf-binary;base64," + glb))

    # 2) Carpeta web (los .z se piden con fetch)
    web = os.path.join(DIR, "web")
    os.makedirs(os.path.join(web, "datos"), exist_ok=True)
    for viejo in os.listdir(os.path.join(web, "datos")):            # datos que ya no se usan
        if viejo[:-2] not in comprimidos:
            os.remove(os.path.join(web, "datos", viejo))
    for b, c in comprimidos.items():
        escribir(os.path.join(web, "datos", b + ".z"), c)
    shutil.copyfile(os.path.join(DATOS, "ripollet.glb"), os.path.join(web, "ripollet.glb"))
    escribir(os.path.join(web, "index.html"), visor("null", "ripollet.glb"))

    # 3) Página de la simulación sola (para entrenar a Neutro)
    escribir(os.path.join(DIR, "verdad.html"),
             leer(os.path.join(DIR, "verdad_plantilla.html"))
             .replace("/*__MODULOS__*/", codigo_modulos).replace("__DATOS__", datos)
             .replace("__BLOBS__", json.dumps(b64)))

    tam = lambda r: os.path.getsize(r) / 1024
    total_web = sum(tam(os.path.join(r, f)) for r, _, fs in os.walk(web) for f in fs)
    print(f"ENSAMBLADO: ripollet.html {tam(os.path.join(DIR, 'ripollet.html')):.0f} KB · web/ {total_web:.0f} KB "
          f"(datos comprimidos {sum(len(c) for c in comprimidos.values()) / 1024:.0f} KB, "
          f"GLB {tam(os.path.join(DATOS, 'ripollet.glb')):.0f} KB) · Neutro: {'sí' if memoria != 'null' else 'aún no'}")


if __name__ == "__main__":
    construir()
