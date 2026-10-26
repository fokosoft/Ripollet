# RIPOLLET EN EL TIEMPO: ortofotos históricas recortadas justo al rectángulo de la maqueta, a 2 m por píxel:
#   · ICGC (orto-territorial, WMS): vuelos de 1946 (vuelo americano, serie A), 1956 (serie B), 1977, 1986 y 1994
#   · IGN (PNOA histórico, WMS): 2004, 2012 y 2018
# Se comprobó qué capa tiene imagen en Ripollet (las de varios años solo cubren el municipio con uno de ellos).
# En EPSG:4326 el píxel es lineal en longitud y latitud, como las coordenadas de la maqueta (a_metros): la imagen
# encaja sin reproyectar. Sale en web/historico/AAAA.jpg (solo se descargan al abrir la herramienta en el visor).
# Con Blender, además se recomprimen (JPEG calidad 72; los de blanco y negro, en un canal):
#   blender --background --factory-startup --python obtener_historico.py
import math
import os
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
SUR, OESTE, NORTE, ESTE = 41.4935, 2.1470, 41.5115, 2.1635      # como osm_ripollet.py
MARGEN = 5
LAT0, LON0 = (SUR + NORTE) / 2, (OESTE + ESTE) / 2
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
LIM = ((ESTE - OESTE) / 2 * KX - MARGEN, (NORTE - SUR) / 2 * KY - MARGEN)
BBOX = f"{LON0 - LIM[0] / KX:.7f},{LAT0 - LIM[1] / KY:.7f},{LON0 + LIM[0] / KX:.7f},{LAT0 + LIM[1] / KY:.7f}"
ANCHO, ALTO = round(2 * LIM[0] / 2), round(2 * LIM[1] / 2)

ICGC = "https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms"
IGN = "https://www.ign.es/wms/pnoa-historico"
VUELOS = {
    1946: (ICGC, "ortofoto_1m_blanc_i_negre_1946"), 1956: (ICGC, "ortofoto_50cm_blanc_i_negre_1956"),
    1977: (ICGC, "ortofoto_25cm_blanc_i_negre_1977"), 1986: (ICGC, "ortofoto_50cm_blanc_i_negre_1986"),
    1994: (ICGC, "ortofoto_50cm_blanc_i_negre_1994"), 2004: (IGN, "PNOA2004"), 2012: (IGN, "PNOA2012"),
    2018: (IGN, "PNOA2018"),
}
salida = os.path.join(DIR, "web", "historico")
os.makedirs(salida, exist_ok=True)
total = 0
for ano, (servicio, capa) in VUELOS.items():
    ruta = os.path.join(salida, f"{ano}.jpg")
    if not os.path.exists(ruta):
        url = (f"{servicio}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={capa}&STYLES=&SRS=EPSG:4326"
               f"&BBOX={BBOX}&WIDTH={ANCHO}&HEIGHT={ALTO}&FORMAT=image/jpeg")
        datos = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                       timeout=120).read()
        assert datos[:2] == b"\xff\xd8", f"{ano}: el servicio no devolvió una imagen"
        open(ruta, "wb").write(datos)
        try:
            import bpy
            im = bpy.data.images.load(ruta)
            ajustes = bpy.context.scene.render.image_settings
            ajustes.file_format, ajustes.quality = "JPEG", 72
            ajustes.color_mode = "BW" if servicio == ICGC else "RGB"
            im.save_render(ruta)
        except ImportError:
            pass
    total += os.path.getsize(ruta)
    print(f"HISTÓRICO {ano}: {os.path.getsize(ruta) / 1024:.0f} KB")
print(f"HISTÓRICO: {len(VUELOS)} vuelos, {ANCHO}×{ALTO} px, {total / 1024:.0f} KB en total")
