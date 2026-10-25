# Descarga del Catastro (servicios INSPIRE, WFS) para la zona de la maqueta:
#   - PARTES DE EDIFICIO (BU): huella, plantas sobre rasante y bajo rasante (sótanos, garajes) → edificios.json
#   - PARCELAS (CP): contorno de cada parcela → parcelas.json (patios privados, solares sin edificar)
# Uso: python obtener_catastro.py   (solo biblioteca estándar; las teselas quedan en caché)
import json
import os
import re
import time
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
PASO = 0.002                                                       # teselas de unos 220 × 170 m
WFS = {"bp": "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature"
              "&typeNames=BU:BuildingPart&srsName=EPSG::4326&bbox={s},{o},{n},{e}",
       "cp": "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=WFS&version=2.0.0&request=GetFeature"
              "&typeNames=CP:CadastralParcel&srsName=EPSG::4326&bbox={s},{o},{n},{e}"}
CACHE = os.path.join(DIR, "datos_catastro", "teselas")
os.makedirs(CACHE, exist_ok=True)


def tesela(s, o, n, e, capa="bp"):
    ruta = os.path.join(CACHE, f"{capa}_{s:.4f}_{o:.4f}.xml")
    if not os.path.exists(ruta):
        pet = urllib.request.Request(WFS[capa].format(s=s, o=o, n=n, e=e), headers={"User-Agent": "prueba-blender-threejs"})
        for intento in range(3):
            try:
                datos = urllib.request.urlopen(pet, timeout=120).read()
                break
            except OSError:
                time.sleep(3 * (intento + 1))
        else:
            raise RuntimeError(f"No se pudo descargar la tesela {s},{o}")
        with open(ruta, "wb") as f:
            f.write(datos)
    with open(ruta, encoding="iso-8859-1") as f:
        return f.read()


PARTE = re.compile(r'<bu-ext2d:BuildingPart gml:id="([^"]+)".*?</bu-ext2d:BuildingPart>', re.S)
partes = {}
s = SUR
while s < NORTE - 1e-9:
    o = OESTE
    while o < ESTE - 1e-9:
        xml = tesela(s, o, min(s + PASO, NORTE), min(o + PASO, ESTE))
        for m in PARTE.finditer(xml):
            pid, bloque = m.group(1), m.group(0)
            if pid in partes:
                continue
            arriba = re.search(r"numberOfFloorsAboveGround>(\d+)<", bloque)
            abajo = re.search(r"numberOfFloorsBelowGround>(\d+)<", bloque)
            # Solo el anillo exterior (el primero); los patios interiores ya los resuelve la simulación
            exterior = re.search(r"<gml:exterior>.*?<gml:posList[^>]*>([^<]+)</gml:posList>", bloque, re.S)
            if not exterior:
                continue
            v = [float(x) for x in exterior.group(1).split()]
            anillo = [[round(v[i], 7), round(v[i + 1], 7)] for i in range(0, len(v) - 1, 2)]   # [lat, lon]
            partes[pid] = {"ref": pid.split(".")[-1].split("_")[0], "plantas": int(arriba.group(1)) if arriba else 0,
                           "sotanos": int(abajo.group(1)) if abajo else 0, "anillo": anillo}
        o += PASO
    s += PASO

with open(os.path.join(DIR, "datos_catastro", "edificios.json"), "w", encoding="utf-8") as f:
    json.dump(list(partes.values()), f, separators=(",", ":"))
refs = {p["ref"] for p in partes.values()}
con_sotano = {p["ref"] for p in partes.values() if p["sotanos"] > 0}
print(f"Partes: {len(partes)} · edificios (referencias catastrales): {len(refs)} · con sótano: {len(con_sotano)}")
print("Plantas:", sorted({p["plantas"] for p in partes.values()}))

# PARCELAS: la referencia catastral es la misma que la de sus edificios
PARCELA = re.compile(r"<cp:CadastralParcel gml:id=\"[^\"]+\".*?</cp:CadastralParcel>", re.S)
parcelas = {}
s = SUR
while s < NORTE - 1e-9:
    o = OESTE
    while o < ESTE - 1e-9:
        xml = tesela(s, o, min(s + PASO, NORTE), min(o + PASO, ESTE), "cp")
        for m in PARCELA.finditer(xml):
            bloque = m.group(0)
            ref = re.search(r"<cp:nationalCadastralReference>([^<]+)<", bloque)
            exterior = re.search(r"<gml:exterior>.*?<gml:posList[^>]*>([^<]+)</gml:posList>", bloque, re.S)
            if not ref or not exterior or ref.group(1) in parcelas:
                continue
            v = [float(x) for x in exterior.group(1).split()]
            parcelas[ref.group(1)] = [[round(v[i], 7), round(v[i + 1], 7)] for i in range(0, len(v) - 1, 2)]
        o += PASO
    s += PASO
with open(os.path.join(DIR, "datos_catastro", "parcelas.json"), "w", encoding="utf-8") as f:
    json.dump([{"ref": r, "anillo": a} for r, a in parcelas.items()], f, separators=(",", ":"))
print(f"Parcelas: {len(parcelas)} · con edificio: {len(refs & set(parcelas))} · sin edificio: {len(set(parcelas) - refs)}")
