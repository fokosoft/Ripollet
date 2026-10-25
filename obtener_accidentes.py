# ACCIDENTES DE TRÁFICO CON MUERTOS O HERIDOS GRAVES en Ripollet (Servei Català de Trànsit, dades obertes de la
# Generalitat, conjunto rmgc-ncpb). Los urbanos no traen ubicación (solo el municipio): sirven para la estadística,
# no para el mapa. Guarda datos_publicos/accidentes_ripollet.json. Solo biblioteca estándar.
# Uso: ..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_accidentes.py
import json
import os
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
CAMPOS = ["any", "dat", "zona", "via", "f_morts", "f_ferits_greus", "f_ferits_lleus", "f_vianants_implicades",
          "f_bicicletes_implicades", "f_motocicletes_implicades", "f_ciclomotors_implicades", "d_lluminositat",
          "d_tipus_accident", "d_subtipus_accident", "hor"]
consulta = {"$where": "upper(nommun)='RIPOLLET'", "$limit": 5000, "$order": "dat"}
url = "https://analisi.transparenciacatalunya.cat/resource/rmgc-ncpb.json?" + urllib.parse.urlencode(consulta)
datos = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "maqueta-ripollet"}),
                                          timeout=120).read())
salida = [{k: d.get(k) for k in CAMPOS if d.get(k) is not None} for d in datos]
with open(os.path.join(DIR, "datos_publicos", "accidentes_ripollet.json"), "w", encoding="utf-8") as f:
    json.dump({"fuente": "Servei Catala de Transit, accidents amb morts o ferits greus (dades obertes, rmgc-ncpb)",
               "accidentes": salida}, f, ensure_ascii=False)
print(f"ACCIDENTES GRAVES EN RIPOLLET: {len(salida)} ({salida[0]['any']}-{salida[-1]['any']}) · "
      f"urbanos {sum(a.get('zona') == 'Zona urbana' for a in salida)} · con peatones "
      f"{sum(int(a.get('f_vianants_implicades', 0)) > 0 for a in salida)} · muertos "
      f"{sum(int(a.get('f_morts', 0)) for a in salida)}")
