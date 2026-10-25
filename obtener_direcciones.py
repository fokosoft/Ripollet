# DIRECCIONES (portales) del Catastro, servicio INSPIRE AD: posición de la entrada, número y referencia catastral del
# edificio. El servicio no da el nombre de la calle (solo un código por municipio): osm_ripollet.py se lo pone por
# votación con la calle de OSM más cercana a sus portales. Guarda datos_catastro/direcciones.json.
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_direcciones.py
import json
import os
import re
import time
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635          # los mismos que osm_ripollet.py
PASO = 0.002
WFS = ("https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx?service=WFS&version=2.0.0&request=GetFeature"
       "&typeNames=AD:Address&srsName=EPSG::4326&bbox={s},{o},{n},{e}")
CACHE = os.path.join(DIR, "datos_catastro", "teselas")
os.makedirs(CACHE, exist_ok=True)
DIRECCION = re.compile(r'<ad:Address gml:id="ES\.SDGC\.AD\.(\d+)\.(\d+)\.(\d+)\.([^.]+)\.([0-9A-Z]{14})[^"]*".*?'
                       r'<gml:pos>([-0-9.]+) ([-0-9.]+)</gml:pos>.*?</ad:Address>', re.S)

direcciones, vistas = [], set()
s = SUR
while s < NORTE - 1e-9:
    o = OESTE
    while o < ESTE - 1e-9:
        ruta = os.path.join(CACHE, f"ad_{s:.4f}_{o:.4f}.xml")
        if not os.path.exists(ruta):
            url = WFS.format(s=s, o=o, n=min(s + PASO, NORTE), e=min(o + PASO, ESTE))
            for intento in range(4):
                try:
                    datos = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                                   timeout=180).read()
                    break
                except OSError:
                    time.sleep(4 * (intento + 1))
            else:
                raise RuntimeError(f"No se pudo descargar la tesela {s},{o}")
            with open(ruta, "wb") as f:
                f.write(datos)
        with open(ruta, encoding="iso-8859-1") as f:
            xml = f.read()
        for m in DIRECCION.finditer(xml):
            prov, muni, via, numero, ref, lat, lon = m.groups()
            clave = (via, numero, ref)
            if clave in vistas:
                continue
            vistas.add(clave)
            direcciones.append({"via": int(via), "n": numero.lstrip("0") or numero, "ref": ref,
                                "lat": float(lat), "lon": float(lon), "muni": muni})
        o += PASO
    s += PASO
    print(f"  direcciones: {len(direcciones)}", flush=True)
with open(os.path.join(DIR, "datos_catastro", "direcciones.json"), "w", encoding="utf-8") as f:
    json.dump(direcciones, f)
print(f"DIRECCIONES: {len(direcciones)} portales · {len({(d['muni'], d['via']) for d in direcciones})} calles (códigos)")
