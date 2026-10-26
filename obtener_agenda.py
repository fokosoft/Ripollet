# AGENDA de ripollet.cat: los actos del RSS de la agenda, con fechas y dirección leídas de los datos estructurados
# (schema.org/Event) de cada página. El navegador no puede leer esa web directamente (no permite CORS), así que este
# script guarda web/agenda.json y una tarea de GitHub lo ejecuta cada día (.github/workflows/agenda.yml).
# El visor sitúa cada acto en el mapa con sus calles, portales y equipamientos. Solo biblioteca estándar.
# Uso: python obtener_agenda.py
import html
import json
import os
import re
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
RSS = "https://www.ripollet.cat/actualitat/agenda/agenda/RSS"
pedir = lambda url: urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                           timeout=60).read().decode("utf-8", "replace")

enlaces = list(dict.fromkeys(re.findall(r'<item rdf:about="([^"]+)"', pedir(RSS))))
actos = []
for url in enlaces:
    try:
        s = pedir(url)
    except OSError:
        continue
    prop = lambda p: next((html.unescape(m).strip() for m in re.findall(rf'itemprop="{p}"[^>]*>([^<]*)<', s) if m.strip()), "")
    actos.append({"titulo": prop("name") or prop("summary"), "inicio": prop("startDate"), "fin": prop("endDate"),
                  "lugar": prop("address") or prop("location"), "descripcion": prop("description")[:160], "url": url})
actos = [a for a in actos if a["titulo"] and a["inicio"]]
actos.sort(key=lambda a: a["inicio"])
os.makedirs(os.path.join(DIR, "web"), exist_ok=True)
with open(os.path.join(DIR, "web", "agenda.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Agenda de ripollet.cat", "actos": actos}, f, ensure_ascii=False, indent=0)
print(f"AGENDA: {len(actos)} actos ({sum(bool(a['lugar']) for a in actos)} con lugar)")
