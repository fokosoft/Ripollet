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
           "incidencias_ciudad.js", "vulnerabilidad.js", "rehabilitacion.js", "seguridad.js", "lugares.js", "transporte.js", "ambiente.js", "residuos.js", "planeamiento.js", "micasa.js", "agenda.js", "patrimonio.js", "historia.js", "naturaleza.js", "tiempo_real.js", "pixel.js", "trafico.js", "farolas.js", "mobiliario.js"]


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


# SEGURIDAD: los textos de los datos vienen de fuentes que puede editar cualquiera (nombres de OpenStreetMap) o que no
# controlamos (Catastro, GTFS, Ripollet Aporta, Diputació, GBIF, la agenda). El visor los pinta con innerHTML y los
# lleva escritos dentro de su <script>: un «<» o un «>» podrían colar HTML o cerrar el script. Un nombre real no los
# necesita: se cambian por «‹» y «›» en todo texto de los datos, al ensamblar.
def limpiar(o):
    if isinstance(o, str):
        return o.replace("<", "\u2039").replace(">", "\u203a")
    if isinstance(o, list):
        return [limpiar(v) for v in o]
    if isinstance(o, dict):
        return {limpiar(k): limpiar(v) for k, v in o.items()}
    return o


def json_limpio(texto):
    return json.dumps(limpiar(json.loads(texto)), ensure_ascii=False, separators=(",", ":"))


def blob_limpio(datos):
    """Los blobs que son JSON (lugares, transporte, residuos, patrimonio, naturaleza, direcciones), limpios."""
    if datos[:1] not in (b"{", b"["):
        return datos
    try:
        return json_limpio(datos.decode("utf-8")).encode("utf-8")
    except (UnicodeDecodeError, ValueError):
        return datos


def con_csp(html):
    """Política de seguridad de contenido: solo se ejecutan los scripts del propio visor (por su huella SHA-256) y los
    de la CDN de three.js; aunque algo se colara en la página, el navegador no lo ejecutaría."""
    import hashlib
    huellas = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode() + "'"
                       for s in re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S))
    politica = ("default-src 'self'; "
                f"script-src {huellas} https://cdn.jsdelivr.net 'wasm-unsafe-eval'; worker-src 'self' blob:; "
                "style-src 'self' 'unsafe-inline'; font-src 'self' data:; "
                "img-src 'self' data: blob: https://fokosoft.github.io; media-src 'self' https://fokosoft.github.io; "
                "connect-src 'self' data: blob: https://cdn.jsdelivr.net https://api.open-meteo.com "
                "https://air-quality-api.open-meteo.com https://analisi.transparenciacatalunya.cat https://fokosoft.github.io; "
                "object-src 'none'; base-uri 'none'; form-action 'none'")
    return html.replace("<meta charset=\"utf-8\">",
                        f'<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="{politica}">', 1)


def construir():
    datos = json_limpio(leer(os.path.join(DATOS, "datos.json")))
    comprimidos = {b: zlib.compress(blob_limpio(leer(os.path.join(DATOS, b + ".bin"), "rb")), 9) for b in BLOBS}
    comprimidos.update({b: zlib.compress(v, 9) for b, v in fisica().items()})
    for opcional in ("oficial", "sotanos", "farolas", "secciones", "rehab", "lugares", "transporte", "acustica", "direcciones", "copas", "cobertes", "sectores", "residuos", "planeamiento", "ruta_patrimonio", "naturaleza"):   # zonas inundables oficiales, sótanos (Catastro), farolas (AMB)
        if os.path.exists(os.path.join(DATOS, opcional + ".bin")):
            comprimidos[opcional] = zlib.compress(blob_limpio(leer(os.path.join(DATOS, opcional + ".bin"), "rb")), 9)
    memoria = opcional_json("neutro_memoria.json")       # lo que aprendió Neutro (entrenar_neutro.mjs)
    medicion = opcional_json("neutro_medicion.json")     # cómo se midió, frente a qué rival
    codigo_modulos = modulos()

    # Agenda: copia de web/agenda.json dentro del visor, por si no se puede leer la actualizada (archivo local)
    agenda = opcional_json(os.path.join("web", "agenda.json"))
    agenda = json_limpio(agenda) if agenda != "null" else agenda

    # Letra Silkscreen (fuentes/, SIL OFL) en la propia página: sin peticiones a Google Fonts (la IP del visitante
    # no sale a terceros) y sin parpadeo de letra al cargar. Solo el subconjunto latino (castellano y catalán): 16 KB.
    fuentes = "".join(
        f"@font-face {{ font-family: 'Silkscreen'; font-style: normal; font-weight: {p}; font-display: swap; "
        f"src: url(data:font/woff2;base64,{base64.b64encode(leer(os.path.join(DIR, 'fuentes', f'silkscreen-{p}.woff2'), 'rb')).decode()}) "
        f"format('woff2'); }}\n  " for p in (400, 700))

    def visor(blobs, glb):
        return con_csp(leer(os.path.join(DIR, "visor_ripollet.html"))
                .replace("/*__FUENTES__*/", fuentes)
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


def comprobar_sintaxis():
    """El visor entero como módulo, con `node --check` (si hay Node): un error de sintaxis (una comilla o un salto de
    línea dentro de una cadena) deja la web en blanco, así que se avisa al ensamblar en vez de al publicar."""
    import re
    import subprocess
    import tempfile
    codigo = max(re.findall(r'<script type="module">(.*?)</script>', leer(os.path.join(DIR, "ripollet.html")), re.S), key=len)
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as f:
        f.write(codigo)
    try:
        r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        print("SINTAXIS: sin Node, no se comprueba")
        return
    finally:
        os.remove(f.name)
    if r.returncode:
        raise SystemExit("SINTAXIS: ERROR en el visor ensamblado, no publicar:\n" + r.stderr[-1500:])
    print("SINTAXIS: correcta")


if __name__ == "__main__":
    construir()
    comprobar_sintaxis()
