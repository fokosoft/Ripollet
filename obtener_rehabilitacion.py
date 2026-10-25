# REHABILITACIÓN ENERGÉTICA: datos públicos por edificio para priorizar ayudas.
#   - Catastro (INSPIRE BU, Building): año de construcción, uso y número de viviendas de cada edificio.
#   - ICAEN (Generalitat, dades obertes, conjunto j6ii-t3w2): certificados de eficiencia energética de Ripollet
#     (calificación de emisiones y de consumo, placas solares), que traen la referencia catastral.
# Guarda datos_publicos/catastro_edificios.json y certificados_ripollet.json. Solo biblioteca estándar.
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_rehabilitacion.py
import json
import os
import re
import time
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(DIR, "datos_publicos")
CACHE = os.path.join(DIR, "datos_catastro", "teselas")
os.makedirs(CACHE, exist_ok=True)
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
PASO = 0.002
WFS_BU = ("https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature"
          "&typeNames=BU:Building&srsName=EPSG::4326&bbox={s},{o},{n},{e}")


def pedir(url, intentos=4):
    for k in range(intentos):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                          timeout=180).read()
        except OSError:
            if k == intentos - 1:
                raise
            time.sleep(4 * (k + 1))


# ---------------------------------------------------------------- Catastro: edificios
EDIFICIO = re.compile(r'<bu-ext2d:Building gml:id="([^"]+)".*?</bu-ext2d:Building>', re.S)
edificios = {}
s = SUR
while s < NORTE - 1e-9:
    o = OESTE
    while o < ESTE - 1e-9:
        ruta = os.path.join(CACHE, f"bu_{s:.4f}_{o:.4f}.xml")
        if not os.path.exists(ruta):
            with open(ruta, "wb") as f:
                f.write(pedir(WFS_BU.format(s=s, o=o, n=min(s + PASO, NORTE), e=min(o + PASO, ESTE))))
        with open(ruta, encoding="iso-8859-1") as f:
            xml = f.read()
        for m in EDIFICIO.finditer(xml):
            ref, bloque = m.group(1).split(".")[-1], m.group(0)
            anio = re.search(r"<bu-core2d:beginning>(\d{4})", bloque)
            uso = re.search(r"<bu-ext2d:currentUse>([^<]+)<", bloque)
            viv = re.search(r"<bu-ext2d:numberOfDwellings>(\d+)<", bloque)
            sup = re.search(r'<bu-ext2d:value uom="m2">(\d+)<', bloque)
            edificios[ref] = {"anio": int(anio.group(1)) if anio else None,
                              "uso": uso.group(1).split("_", 1)[-1] if uso else None,
                              "viviendas": int(viv.group(1)) if viv else 0, "m2": int(sup.group(1)) if sup else None}
        o += PASO
    s += PASO
    print(f"  Catastro: {len(edificios)} edificios", flush=True)
with open(os.path.join(CARPETA, "catastro_edificios.json"), "w", encoding="utf-8") as f:
    json.dump(edificios, f)

# ---------------------------------------------------------------- ICAEN: certificados energéticos de Ripollet
CAMPOS = ["referencia_cadastral", "adre_a", "numero", "qualificacio_d_emissions", "qualificaci_de_consum_d", "emissions_de_co2",
          "energia_prim_ria_no_renovable", "us_edifici", "solar_fotovoltaica", "solar_termica", "data_entrada",
          "motiu_de_la_certificacio"]
certificados, desde = [], 0
while True:
    consulta = {"$select": ",".join(CAMPOS), "$where": "codi_poblacio='08180'", "$limit": 20000, "$offset": desde,
                "$order": "num_cas"}
    lote = json.loads(pedir("https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json?" +
                            urllib.parse.urlencode(consulta)))
    certificados += lote
    if len(lote) < 20000:
        break
    desde += 20000
with open(os.path.join(CARPETA, "certificados_ripollet.json"), "w", encoding="utf-8") as f:
    json.dump(certificados, f)
anios = [e["anio"] for e in edificios.values() if e["anio"]]
print(f"CATASTRO: {len(edificios)} edificios ({sum(a < 1980 for a in anios)} de antes de 1980) · "
      f"ICAEN: {len(certificados)} certificados en Ripollet")
