# Ripollet: maqueta 3D, riesgo de inundación y herramientas urbanas

Visor web (three.js) de Ripollet, del centro a Pinetons, generado con Blender a partir de OpenStreetMap, el Catastro y
el relieve del ICGC, con una simulación de lluvia en la GPU, Neutro explicando los puntos críticos y veintiuna
herramientas con datos públicos. En castellano y catalán.

**Abrir en línea:** https://fokosoft.github.io/Ripollet/ (GitHub Pages, desde la carpeta `web/`).

Una aplicación de **[FOKO SOFT](https://github.com/fokosoft)**: proyecto independiente y no oficial, sin encargo ni aval
de ninguna administración pública. En el visor, **«Créditos, ayuda y fuentes»** (en ⚙️ Ajustes, o pulsando «FOKO SOFT»
en la línea de atribución) explica cómo se usa y de dónde sale cada dato, en castellano y catalán.

## Qué abrir

| Archivo | Para qué |
|---|---|
| `ripollet.html` | Todo en un archivo (3,1 MB): doble clic y funciona (necesita internet para three.js) |
| `web/` | Para publicar en un servidor (2,6 MB): `index.html`, `ripollet.glb` y `datos/*.z`; `index.html` de la raíz lleva aquí |
| `ripollet.html?arte` | Abre directamente en estilo artístico |
| `INFORME_NEUTRO.md` | Cómo se midió Neutro, frente a qué rival, y la comparación con la cartografía oficial |

## Dos modos: vecino y técnico

- **Modo vecino** (por defecto): pensado para quien solo quiere saber cosas de su casa y su barrio. Buscador de
  dirección en Explorar, la pestaña **Mi casa** en lugar de Riesgo (el agua en lluvias fuertes sale en la ficha de
  la casa) y siete herramientas: Mi casa, Recogida de residuos, Agenda, Tiendas y lugares, Transporte público,
  Sombra y calor e Incidencias. Las notas de método quedan plegadas tras «ℹ️ ¿Cómo se calcula?» y el recorrido
  guiado tiene 8 pasos (incluye recogida y agenda).
- **Modo técnico**: todo (panel de riesgo y lluvia, vulnerabilidad, planeamiento, rehabilitación, seguridad vial,
  ruido, incendio, solar, proyectos…). Se activa en ⚙️ Ajustes (se recuerda en el navegador) o con
  `?modo=tecnico`; los enlaces compartidos desde el modo técnico lo llevan, y un enlace `?h=` a una herramienta
  técnica cambia de modo solo.

## Qué hace el panel de riesgo

- **Mapa** de cada escenario (20–120 mm/h durante 1 h): simulación física, predicción de Neutro o «con las medidas».
- **Puntos críticos, edificios y equipamientos afectados**, con la explicación de Neutro al hacer clic.
- **🛠 ¿Y si…? Probar medidas:** depósito / parque inundable (rebaja el terreno: almacena), pavimento permeable y
  más imbornales (se llevan agua en mm/h) y la capacidad del alcantarillado en las calzadas. «Simular antes y
  después» compara el mismo escenario: superficie, edificios y equipamientos, y pinta en verde lo que deja de
  inundarse y en naranja lo que empeora.
- **📍 Incidencias reales:** se marcan con clic (qué se vio, lluvia del episodio, fecha, nota), se guardan en el
  navegador y se comparten con Exportar / Importar (JSON). El visor dice en cuántas la simulación ve agua, y Neutro
  aprende de cada una con una **excepción por lugar** (bloques de 20 m) más un repaso ligero de lo general: corrige
  ese sitio sin cambiar lo que sabe del resto. Aún no hay incidencias reales: no hay medida de cuánto mejora.
- **Informe imprimible** con todo lo anterior, y capa de **zonas inundables oficiales** del río.

## Maqueta píxel (vista por defecto)

Estética de diorama de pixel art: la escena se dibuja a baja resolución y se amplía con píxeles nítidos, con una
paleta de 32 colores, contornos donde cambia la profundidad y tramado opcional; vista de teleobjetivo casi
isométrica que gira de 90 en 90°, fondo claro sin bruma e interfaz clara con letra de píxel (Silkscreen, Google
Fonts). En «🎛 Vista»: Píxel / 3D, Maqueta, Girar, tamaño del píxel (2–8), Paleta, Tramado y Contornos; se recuerda
en el navegador. Combina con el estilo realista o el artístico y con el coche. Además aligera la GPU (con píxel 4
dibuja 16 veces menos). `?real` abre la vista 3D clásica.

## Diseño: «maqueta de papel y tinta»

La interfaz se dibuja con la misma paleta de 32 colores que la maqueta píxel, para que mapa y botones sean una sola
pieza: tinta (`#16181d`) para bordes y texto, papel (`#fbfbf8`) para los paneles, **teja** (`#b8322f`, los tejados de
Ripollet) como acento, y verde, agua y sol del mapa para lo demás. Piezas de diorama: bordes de 2 px, esquinas rectas,
sombras duras y botones que se hunden al pulsar; los títulos de los paneles son barras de ventana con letra de píxel
(Silkscreen) y la maqueta se apoya en una mesa con rejilla de puntos. Con la vista 3D, el mismo diseño en versión
nocturna (acento sol). Todo con variables CSS (`--p-fondo`, `--acento`…) en un solo sitio.

**Logo**: un escudo propio en píxel inspirado en el de Ripollet (torre, árboles y el río; `logoapp.png`). `logo_pixel.py` (con Blender) pasa el dibujo original (1 MB, rejilla
irregular) a un sprite de 64×81 de colores planos con el fondo transparente (2,9 KB) y un favicon de 64×64 solo con
el escudo (2,5 KB), en `js/logo.js`.

**Iconos de píxel propios** (32, de 16×16) en vez de emojis, que cambian de aspecto en cada sistema:
`iconos_pixel.py` los guarda dibujados en texto y genera `js/iconos.js` (un sprite SVG de 17 KB, unos 4 KB comprimido;
el favicon es el escudo). El contorno toma el color del texto, así el mismo icono sirve en botones claros y oscuros.
Accesibilidad comprobada con axe-core (0 fallos en los tres modos).

## Detalles del modelo con datos reales

- **Hitos modelados a mano** (`hitos_ripollet.py`) según su ficha del inventario «Mapes de Patrimoni Cultural» de la
  Diputació de Barcelona y con la altura del LiDAR: el campanario modernista de Sant Esteve (1892, 25 m), la iglesia
  en piedra, el Molí d'en Rata (1825), la chimenea hexagonal del Molí d'en Calvet (28 m) y el molino de viento de 1870.
- **Pasos de cebra** en los 39 pasos de peatones de OSM, solo sobre la calzada real; **toldos** en 197 bajos de
  tiendas, bares y restaurantes de OSM, en la pared que da a la calle.
- **Mobiliario** (`js/mobiliario.js`, instancias, no pesa en el GLB): los contenedores en su sitio real (Ripollet
  Aporta), marquesinas en las paradas de autobús y **placas solares** en los 73 edificios cuyo certificado energético
  dice que tienen fotovoltaica.
- **Estación del año**: las copas de hoja ancha cambian de color con la fecha (otoño, invierno sin hoja, flor en
  primavera); de noche, una de cada tres **ventanas** se enciende.
- **Lluvia real**: si en la última hora han caído 0,5 mm o más en Ripollet (Open-Meteo), Explorar lo avisa y el panel
  de lluvia la simula sobre toda la maqueta, desde seco, para ver dónde se acumula el agua ahora.
- **Ruta de patrimonio** (herramienta, también en modo vecino): 18 paradas del inventario por el casco antiguo, por
  calles a pie (3,1 km), con la ficha de cada una. `obtener_patrimonio.py` baja el inventario (168 fichas) y
  `ruta_patrimonio.py` elige y ordena las paradas.

## Ripollet en el tiempo

Herramienta con un deslizador de años: la ortofoto de cada vuelo sobre el relieve (ICGC: 1946, 1956, 1977, 1986,
1994; IGN PNOA: 2004, 2012, 2018) y, de los edificios de hoy, solo los que ya existían según su año de construcción
del Catastro (494 en 1946, 1243 en 1986, 1882 en 2018). «Ver crecer» pasa los años solo. Con una foto antigua se
esconde lo moderno (árboles, tráfico, farolas, mobiliario) y las sombras proyectadas. `obtener_historico.py` recorta
cada vuelo al rectángulo de la maqueta a 2 m/píxel (≈ 200 KB por foto, 1,5 MB en total en `web/historico/`); cada
una se descarga solo al elegir su año (`ripollet.html` en local las toma de la web publicada).

## Naturaleza y arqueología

- **Naturaleza** (herramienta, también en modo vecino): 3545 observaciones de GBIF.org (iNaturalist, eBird, Ornitho…)
  dentro de la maqueta, 464 especies con su nombre en castellano y catalán: por grupos (aves, plantas, insectos, otros),
  solo lo visto en esta época del año, lo que se ha observado a menos de 100 m del punto tocado y lo más observado.
  En el mapa, de día, **bandadas de pájaros animados** sobrevuelan los sitios con más observaciones de aves (el río,
  los parques). `obtener_naturaleza.py` → blob «naturaleza» (98 KB sin comprimir).
- **Yacimientos arqueológicos** (en la herramienta de patrimonio): los 6 del inventario de la Diputació de Barcelona,
  3 con su marca en la maqueta (poblados de la Edad del Bronce de los Pinetons y de la carretera de Santiga) y 3 justo
  fuera (necrópolis neolítica de la Bòbila Padró, villa romana de Can Tiana, Mas Duran).

## Webs de las tiendas

`enlazar_webs.py` busca la web de cada local de `datos_osm/lugares.json` y solo la enseña si funciona:

1. **Fuentes**, por orden: `datos_publicos/webs_manual.json` (altas y correcciones a mano, por referencia de OSM o
   nombre) → OpenStreetMap (`website`, `contact:website`, `url`) → Wikidata, la web oficial de la marca para las
   cadenas (`brand:wikidata`, P856; prefiere la de España o en castellano o catalán).
2. **Verificación** como una visita normal: respeta `robots.txt`, una sola visita a la portada cada 1,5 s y se repite
   a los 30 días. Se descartan las caídas (dominio inexistente, 404/5xx) y las aparcadas (página del registrador).
3. **Informe** en `datos_publicos/webs/informe.json` (no se publica): webs que fallan, para corregirlas en OSM, y locales
   sin web.

En la ficha de la tienda: la web («Web» o «Web de la marca»), Instagram y Facebook si los hay, el teléfono para llamar
con un toque, el filtro «Solo los que tienen web» y, en los comercios, **«¿Es tu negocio?»**, que abre el editor de
OpenStreetMap en ese local para que el propio negocio añada su web y su horario (aparecen al regenerar). Hoy: 52 de
422 lugares con web verificada (13 de OSM y 36 de cadenas; 3 descartadas). Para refrescar:
`obtener_lugares.py --nuevo` → `enlazar_webs.py` → `osm_ripollet.py` → `ensamblar.py`.

## Coche y sonido de ambiente

**Coche (🚗 Conducir)**: nunca pasa del límite legal de la calle por la que va, que se ve en una señal junto al
velocímetro. Límite: el `maxspeed` de OSM (200 vías) o, si no lo tiene, el general en ciudad (RD 970/2020): 30 km/h
con un carril por sentido, 50 con dos o más, 20 en calles de prioridad peatonal y viales de servicio; la C-58, 120.
Fuera de las calles, 20 km/h. Al entrar en una calle más lenta frena suave hasta su límite; en los cruces cuenta la
calle que va en la dirección del coche. Shift acelera más, pero sin pasar del límite. Los coches del tráfico tampoco
lo pasan. El límite va en el grafo de calles (bits 8–11 de cada tramo), sin datos nuevos.

**Sonido de ambiente** (⚙️ Ajustes): pájaros de primavera en bucle, apagado por defecto y descargado solo al
activarlo; sube y baja suave, se calla de noche y con la pestaña oculta, y se recuerda en el navegador. Grabación
«spring birds loop with low cut new jersey LOOPED AND CLEANED» de
[steaq en Freesound](https://freesound.org/people/steaq/sounds/548383/) (CC0). `comprimir_ambiente.py` (con Blender)
la pasa de 23 MB en WAV estéreo a `web/ambiente.ogg` (Opus mono 24 kbps, 314 KB) y `web/ambiente.mp3` (MP3 40 kbps,
586 KB, para navegadores sin Opus): ganancia normalizada (la grabación está muy baja), sin perder la banda de 2–8 kHz
donde está casi todo el canto, y el bucle sigue durando 120,000 s exactos.

## Tráfico y gente (activado por defecto)

Coches que circulan por el grafo de calles y peatones por aceras y caminos, en la cantidad que toca a la hora del
tiempo real (o del deslizador): curva horaria típica de laborable o de fin de semana, menos gente si llueve. No hay
aforos públicos de las calles de Ripollet: la intensidad media diaria se **estima por tipo de vía** (de 150
vehículos/día en una calle de servicio a 60 000 en la autopista) y se muestra la media por calle (≈ 3 100
vehículos/día). Si se tienen aforos reales, se ponen en `AFOROS` de `js/trafico.js` (nombre de calle →
vehículos/día) y mandan sobre la estimación. Gráficos mínimos: una caja por coche y un palito por persona, con
instancias (2 llamadas a la GPU para todo); hasta 1 500 coches y 600 personas.

## Tiempo real (activado por defecto)

En el mapa y conduciendo, el sol está donde está ahora en Ripollet (hora de Madrid, con su horario de verano): luz,
sombras, amanecer, ocaso y noche. El tiempo actual llega de Open-Meteo (gratis, sin clave; solo se envían las
coordenadas de Ripollet) cada 10 minutos: temperatura, cielo, viento y lluvia; las nubes apagan el sol, la niebla
acerca la bruma y si llueve se ve caer, inclinada con el viento. Un deslizador mueve la hora para ver el día entero
(«Ahora» vuelve al presente) y «Quitar tiempo real» vuelve al cielo fijo (se recuerda). La herramienta de incendio
empieza con el viento de ahora. Sin internet, solo funciona el reloj y el sol.

## Herramientas (botones bajo el título; cada una se prepara al abrirla por primera vez)

| Herramienta | Qué hace | Datos |
|---|---|---|
| 🌳 Sombra y calor | Sol y sombra en aceras, plazas y calzada para un día y una hora (la luz 3D se mueve igual), u horas de sol del día; escuelas y calles con menos sombra; posibles refugios climáticos y edificios a más de 300 m de uno; «¿y si plantamos árboles?» con el antes y el después | Cubiertas del Catastro (2 m), MDT del ICGC, copas de los árboles de OSM; sol según la NOAA con horario de verano |
| ♿ Accesibilidad | Ancho de acera (≥ 3, 2–3, < 2 m entre bordillo y fachada) y pendiente (≤ 6, 6–8, > 8 %) frente a la Orden TMA/851/2021; calles con más acera estrecha; ruta en silla de ruedas desde un clic hasta cualquier equipamiento (largo, minutos, tramos estrechos o en cuesta, cruces) | Bordillos del AMB (1 m), MDT |
| 🔥 Incendio forestal | Franja de protección de 25 m alrededor de las masas forestales de más de 1 ha (edificios y equipamientos dentro); fuego por autómata celular de Alexandridis et al. (2008) con viento y pendiente, animado o repetido 30 veces (probabilidad de quemarse y edificios con el fuego a ≤ 25 m) | Usos del suelo de OSM (4 m), MDT |
| ☀️ Solar en cubiertas | Mapa de irradiación anual de cada cubierta con las sombras de vecinos y relieve; kWp y kWh/año por edificio (clic en un tejado) y de los equipamientos | Calculado en `funciones_datos.py` (día 15 de cada mes, hora a hora) |
| 🚑 Emergencias | Minutos de llegada desde Policia Municipal, Protecció Civil y Policia Nacional a cada edificio y calle, o a un punto; con un escenario de lluvia, las calles con más de 30 cm de agua se cortan y se cuentan los edificios que tardan más o quedan sin acceso | Grafo de calles de OSM, simulación física |
| 🚶 Ciudad de 15 minutos | A cuántos minutos a pie (4,5 o 3 km/h) queda cada edificio de educación, salud y farmacia, comida, parque infantil y servicios sociales; clic en un edificio para el detalle | Grafo de calles, equipamientos y comercios de OSM |
| 🏗 Nuevos proyectos | Colocar edificios (ancho, fondo, plantas, giro): sombra nueva sobre el espacio público y los vecinos (21 dic / mar / jun), escorrentía que añade y agua simulada en ese suelo, y choques (edificios, calzada, acera, árboles, distancia al más cercano). El coche choca con ellos | Todo lo anterior |
| 📋 Incidencias | Baches, farolas, aceras, imbornales, árboles, limpieza, mobiliario, señales, barreras: se marcan con clic, con estado (abierta, en curso, resuelta), y se exportan en CSV (Excel, con calle y GPS) o JSON, que se puede volver a importar | Se guardan en el navegador |

| 👥 Vulnerabilidad | Las 20 secciones censales de Ripollet coloreadas por índice de vulnerabilidad (media de rangos: % de 65+, % de hogares de una persona y renta baja), renta, % de mayores o de hogares solos; ficha de cada sección y avisos cruzados: edificios con agua a 60 mm/h (y con sótano), % de edificios a más de 300 m de un refugio climático, personas de 65+ estimadas | INE, Atlas de distribución de renta de los hogares (tablas 30896 y 30904); contornos ICGC/Idescat 1-1-2024 (CC BY 4.0) |
| 🏚 Rehabilitación | Cubiertas por prioridad de rehabilitación energética (40 % antigüedad, 35 % viviendas con certificado E–G, 25 % vulnerabilidad de la sección), por año de construcción o por letra del certificado; los 15 más prioritarios con dirección, y lo que podrían producir sus placas | Catastro (INSPIRE BU: año, uso, viviendas), ICAEN (certificados por referencia catastral, dades obertes j6ii-t3w2), potencial solar del visor |
| 🚸 Seguridad vial | Los 62 accidentes con muertos o heridos graves de 2010–2023 por año (calle o carretera, peatones, motos, de noche); tramos con más riesgo potencial a menos de 250 m de cada escuela (tráfico estimado × velocidad × aceras estrechas); puntos negros con datos propios: CSV de la Policia Local (latitud;longitud;fecha;gravedad;nota) agrupado en celdas de 40 m | Servei Català de Trànsit (dades obertes rmgc-ncpb): los urbanos no traen ubicación, por eso van como estadística |
| 🛍 Tiendas y lugares | 423 comercios, bares, servicios, salud, cultura, deporte, patrimonio y fuentes/reciclaje: buscador, categorías, «abierto ahora» (horario de OSM con la hora del tiempo real), iconos en el mapa y ficha con dirección, teléfono y web | OpenStreetMap; solo 19 tienen horario: se puede completar en openstreetmap.org |

| 🚌 Transporte público | Las 13 líneas de autobús que pasan por la maqueta (CV2, CV4, 620, 621, 648, 685, 690, B4, B5, LB1, N61, N62, e4) con su trazado y color; 27 paradas con los próximos buses según el día y la hora del tiempo real; cubiertas por minutos a pie hasta una parada o hasta una parada frecuente (≥ 4 buses/h a primera hora): el 95 % de las viviendas tiene parada a ≤ 5 min y el 89 % parada frecuente | GTFS de la AMB y GTFS de autobuses interurbanos de la Generalitat (bca2-b4i3); días de referencia: martes, sábado y domingo siguientes a la descarga |

| 🔊 Ruido y aire | Ruido de tráfico ESTIMADO de día (Ld) y de noche (Ln) a 8 m (emisión según el tráfico estimado y la velocidad, fuente lineal, −10 dB tras un edificio); zonas de capacidad acústica oficiales y sus objetivos; edificios cuya fachada los supera (106 de día, 208 de noche) y calles con más; aire en directo: modelo CAMS (Open-Meteo) para Ripollet y último dato de las 4 estaciones XVPCA más cercanas, con la guía OMS 2021 | Mapa de capacitat acústica (Generalitat, WFS del Hipermapa) y objetivos del Decret 176/2009; XVPCA (dades obertes tasf-thgu); Open-Meteo Air Quality. El mapa estratégico de ruido oficial no cubre Ripollet y su estación de aire cerró en 1999 |

| 🏠 Mi casa | Buscar una calle o una dirección (calle y número) o tocar un edificio, y ver su ficha: agua junto a la fachada a 60 y 120 mm/h (y si tiene sótano), año, viviendas y certificados, potencial solar, zona acústica, barrio (sección censal) y minutos a pie hasta escuela, centro de salud, comida, farmacia, parada de bus y refugio climático, y en coche desde la base de emergencias más cercana | Portales del Catastro (INSPIRE AD, 1 811 con calle): el Catastro da la calle como código y se le pone el nombre de la calle de OSM más cercana a la mayoría de sus portales |

**Recorrido guiado** («▶ Recorrido guiado» en Explorar, o `?recorrido` en la dirección): 9 paradas con texto
(vista general, centro, punto más crítico de inundación, escuela con menos sombra, cubierta con más potencial solar,
vulnerabilidad, autobuses, una ficha de Mi casa y Ripollet de noche), manual o automático cada 11 s.
**Compartir** (🔗 en la barra): copia un enlace con la vista exacta y la herramienta abierta (y su estado, p. ej. la
casa elegida): `?h=micasa&casa=156&ir=33,904&cam=63,77,91`. En el móvil abre el menú de compartir del sistema.

| ♻️ Recogida de residuos | Los 4 sectores del servicio «Ripollet Aporta» y qué toca sacar hoy, mañana y cada día (puerta a puerta en Centre y Pinetons de 21 a 22 h; contenedores en Can Mas–Maragall y Tiana–Pont Vell), 108 contenedores, 5 áreas de emergencia con sus horarios y 20 buzones de textil sanitario; el más cercano a cada punto. También en «Mi casa» | Mapa público del servicio (Google My Maps, KML, nov. 2023) y calendarios de ripollet.cat (imágenes transcritas). El mapa deja huecos entre sectores: dentro de Ripollet se asigna el sector más cercano a ≤ 200 m y se marca como «probable» (81 ha) |
| 🏛 Planeamiento | Calificación del suelo de cada parcela (25 calificaciones: residencial, actividad económica, transformación, urbanizable, parques, equipamientos, viario…), con su explicación. «Nuevos proyectos» dice qué calificación pisa un edificio nuevo y avisa si cae en suelo público no edificable; «Mi casa» la muestra | Mapa urbanístic de Catalunya (Generalitat), servicio CARTOBASE/MUC de la Diputació de Barcelona, enero de 2023 |
| 📅 Agenda | Los actos de la agenda de ripollet.cat (hoy, próximos 7 días o todo) en una lista y en el mapa, situados por el nombre del lugar o su dirección | `obtener_agenda.py` → `web/agenda.json`, que una tarea de GitHub (`.github/workflows/agenda.yml`) actualiza cada día: el navegador no puede leer ripollet.cat directamente (no permite CORS). Dentro del visor va una copia por si no hay conexión |

Todas son orientativas y lo dicen en su nota: sirven para priorizar y para conversar, no sustituyen un proyecto técnico.

## Cómo se genera (de cero)

```
# 0. Datos reales opcionales (si no están, se usan los de OSM): edificios del Catastro (plantas y sótanos) y
#    bordillos de la cartografía 1:1000 del AMB (ICGC). Se guardan en caché en datos_catastro/.
python obtener_catastro.py
..\blender-5.2.3-windows-x64\blender.exe --background --python obtener_bordillos.py
#    Árboles reales: LiDAR del ICGC (≈ 300 peticiones la primera vez, luego caché en datos_arboles/)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_arboles.py
#    Farolas reales: puntos de luz (ENE_06_PT) de la cartografía 1:1000 del AMB (caché en datos_catastro/farolas/)
..\blender-5.2.3-windows-x64\blender.exe --background --python obtener_farolas.py
#    Datos públicos de las herramientas sociales (guardan en datos_publicos/ y datos_osm/):
#    secciones censales + renta y edad (ICGC/Idescat, INE), año y viviendas (Catastro) + certificados energéticos
#    (ICAEN), accidentes graves (Servei Català de Trànsit), tiendas y lugares (OSM)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_vulnerabilidad.py
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_rehabilitacion.py
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_accidentes.py
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_lugares.py
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_transporte.py   # GTFS AMB + Generalitat (≈ 35 MB)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_ambiente.py     # zonas acústicas (Generalitat)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_direcciones.py  # portales del Catastro
#    Coberturas del suelo (ICGC) para el suelo que OSM no describe
python obtener_cobertes.py
#    Recogida de residuos, planeamiento y agenda
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_residuos.py
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_planeamiento.py
python obtener_agenda.py
#    Aparcamientos y plazas de OSM que no vienen en la descarga principal (datos_osm/superficies.json)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I obtener_superficies.py
# 1. Maqueta, datos del visor y ensamblado (≈ 1 min). Descarga y guarda en caché el relieve del ICGC.
..\blender-5.2.3-windows-x64\blender.exe --background --python osm_ripollet.py -- datos_osm\ripollet_pinetons.json
# 2. Verdad física: los 5 escenarios de lluvia en la GPU, con Chrome sin ventana (≈ 2 min)
node obtener_verdad.mjs
# 3. Neutro: aprende, se mide frente a la regresión logística y guarda su memoria (≈ 10 s)
node entrenar_neutro.mjs
# 4. Zonas inundables oficiales del río (ACA, vía IDEE) y comparación
..\blender-5.2.3-windows-x64\blender.exe --background --python obtener_oficial.py
# 5. Volver a ensamblar con todo (segundos; también tras cambiar la plantilla o los módulos js/)
..\blender-5.2.3-windows-x64\5.2\python\bin\python.exe -I ensamblar.py
```

## Piezas

| Archivo | Qué hace |
|---|---|
| `osm_ripollet.py` | Blender: edificios, calles, zonas, árboles, texturas, relieve; cuadrícula de 4 m (tipos de suelo, patios cerrados, hondonadas, área drenada, pendiente, calle más cercana, edificio) y equipamientos |
| `texturas_estilo.py` | Texturas generadas por código (fachadas, tejas, asfalto, panot…) |
| `ensamblar.py` | Une plantilla + módulos + datos comprimidos → `ripollet.html`, `web/`, `verdad.html` |
| `visor_ripollet.html` | Plantilla del visor: mapa, coche, estilo artístico, lluvia, panel de riesgo, informe, idiomas |
| `js/simulacion.js` | Agua en la GPU (tuberías virtuales, celdas de 4 m) |
| `js/inundacion.js` | Percepción de Neutro, mapa de riesgo, puntos críticos, afectados, métricas |
| `js/neutro_nucleo.js` | **Copia sin tocar** del núcleo de [Neutro](https://github.com/fokosoft/PUBLIC-NEUTRO) (Apache 2.0, commit 400d383) |
| `js/datos.js` | Carga de los binarios comprimidos y altura del terreno |
| `funciones_datos.py` | Datos de las herramientas: accesibilidad de las aceras, grafo de calles, potencial solar, servicios |
| `js/comun.js` | Rejilla de 2 m compartida, montículo y caminos más cortos |
| `js/farolas.js` | 3 190 farolas reales del AMB (columna o fachada); de noche, luminaria encendida y charco de luz en el suelo (instancias, sin luces reales) |
| `js/trafico.js` | Coches y peatones con instancias; volumen estimado por tipo de vía y hora, o aforos reales |
| `js/pixel.js` | Maqueta píxel: render a baja resolución, paleta, contornos, tramado, vista maqueta y giros |
| `js/tiempo_real.js` | Sol y tiempo de ahora en el mapa (Open-Meteo), lluvia visible, deslizador de hora |
| `js/sombra.js`, `js/accesibilidad.js`, `js/incendio.js`, `js/solar.js`, `js/rutas.js` (emergencias y 15 minutos), `js/proyectos.js`, `js/incidencias_ciudad.js` | Una herramienta cada uno: se apuntan en `globalThis.HERRAMIENTAS` y el visor les da paneles, capas (1 m sobre el suelo, 2 m sobre las cubiertas, 4 m propia) y clics |

## Compartir y accesibilidad

- **Vista previa al compartir:** etiquetas Open Graph y Twitter con la imagen `web/vista_previa.jpg` (1200×630,
  79 KB). Las redes leen la página sin ejecutar JavaScript, así que la vista previa es la misma para cualquier enlace
  (aunque lleve una herramienta o una casa).
- **Accesibilidad:** auditada con axe-core (WCAG 2.0/2.1 A y AA) en los dos temas y en las secciones principales: sin
  fallos. Nombres accesibles en los botones de solo símbolo y en el mapa, descripción del mapa para lectores de
  pantalla, foco visible, el foco va al panel que se abre, Escape cierra paneles, flechas mueven el mapa con el foco en
  él, asas de las hojas con teclado, botones de al menos 40 px en el móvil, vuelos sin animación si el sistema pide
  menos movimiento y contraste corregido (botones principales más oscuros).

## Rendimiento (medido el 25 oct 2026)

Chrome sin ventana en el PC de desarrollo (Ryzen 5 3550H, 1280×800; techo de esa medida: 60 fps), versión `web/`
servida por HTTP, 9 s de reposo antes de cada medida. El «móvil» es una pantalla de 390×844 (×3) con la CPU 4 veces
más lenta, pero con la GPU del PC: un móvil real de gama media irá algo peor.

| | Calidad alta | Calidad ligera |
|---|---|---|
| Escritorio, 3D | 30–36 fps | 36–45 fps |
| Escritorio, píxel | 36–39 fps | — |
| Móvil, píxel | 32–40 fps | 35–60 fps |

Carga: 2,5–3 s en escritorio y 5–7 s en el móvil simulado (red local), con 75–85 MB de memoria JS. **Calidad**
(en «🎛 Vista»): «ligera» quita las sombras proyectadas y dibuja a resolución 1:1; viene por defecto en pantallas
táctiles. En el mapa, la herramienta de tiendas solo dibuja los 60 iconos más cercanos a donde se mira.

## Sin parpadeos (medido el 26 oct 2026)

Medida: la escena se dibuja 8 veces moviendo la cámara una cienmilésima de la distancia y se cuentan los píxeles que
cambian de color (solo cambian donde dos superficies se pelean por la profundidad). Abrir con `?depurar` deja la
escena en `VISOR` para repetirla desde la consola.

| Vista | Antes | Ahora |
|---|---|---|
| 3D de lejos (2,2 km) | 1,47 % | 0,01 % |
| 3D media (450 m) | 0,024 % | 0,009 % |
| Maqueta píxel (6,5 km) | 1,28 % | 0,03 % |

- **Plano cercano dinámico**: lo más lejos posible (la caja del modelo o el 2 % de la distancia); con 1 m fijo, la
  profundidad no distinguía capas a 6–40 cm de distancia vista desde 2 km.
- **Capas planas a alturas distintas**: zonas a pasos de 1,2 cm, calles por categoría (la mayor encima) y las uniones
  por debajo de las cintas, para que las líneas pintadas no se peleen con el asfalto liso.
- **Aceras y pasos de OSM** (`footway=sidewalk/crossing`) no se dibujan donde hay bordillos del AMB: el suelo ya pinta
  la acera real, y la cinta de OSM iba desplazada encima del carril.
- **Texturas que no chisporrotean**: mipmaps en la rejilla de aceras, grano del asfalto y la tierra que se apaga
  cuando es menor que un píxel, coberturas suavizadas entre celdas de 2 m y `normalBias` en las sombras (sin rayas que
  bailan con el sol bajo).
- **Vista píxel encajada**: la cámara se mueve a saltos de un píxel grande y la imagen se desplaza el resto; al
  arrastrar el mapa, los píxeles que cambian pasan del 15–18 % al 0–6 % (lo que queda es la perspectiva).

## Peso (optimizado)

Árboles con instancias en vez de geometría, vértices compartidos y sin normales (sombreado plano en la GPU), Draco
nivel 10, texturas JPEG, paredes tapadas entre partes del Catastro sin dibujar (≈ 10 000), huellas simplificadas
(vértices casi alineados fuera) y datos binarios comprimidos (deflate nativo del navegador). Los choques del coche
usan la misma rejilla de 1 m que las aceras, en vez de los polígonos de los edificios.

| | Con edificios de OSM | Con Catastro y bordillos |
|---|---|---|
| GLB | 0,70 MB | 1,06 MB |
| Datos comprimidos | 0,25 MB | 0,66 MB (con los de las herramientas) |
| Versión web total | 1,13 MB | 2,02 MB |
| `ripollet.html` (un archivo) | 1,45 MB | 2,58 MB |

Las herramientas añaden 0,33 MB de datos (cubiertas a 2 m, accesibilidad a 1 m, grafo, mapa solar cuantizado a
pasos de 50 kWh/m²) y ≈ 0,1 MB de código. Lo pesado (sombras, fuego, caminos) se calcula en el navegador al abrir
cada herramienta, no se descarga.

## Datos reales y lo que falta

| Dato | Fuente | Cómo |
|---|---|---|
| Edificios: huella, plantas, sótanos | Catastro, servicio INSPIRE BU (WFS) | `obtener_catastro.py`: 1 932 edificios, 7 990 partes, 420 con sótano |
| Bordillos → calzada real y aceras | Cartografía topográfica 1:1000 del AMB, WMS del ICGC | `obtener_bordillos.py`: un estilo SLD con filtro dibuja solo el código `COM_17LS_LN` (vorada) a 0,25 m/píxel |
| Parcelas: patios privados y terreno sin edificar | Catastro, servicio INSPIRE CP (WFS) | `obtener_catastro.py`: 2 096 parcelas. Patio privado = espacio libre de una parcela recogida (≤ 1 500 m² libres o ≥ 40 % edificada): muro de 1 m hacia la calle, desagüe propio, fuera del análisis. Parcela sin edificio = tierra (15 mm/h) |
| Árboles: posición, altura y copa | ICGC, LiDAR territorial 2021–2023 (1 m), WMS «elevacions-territorial» | `obtener_arboles.py`: altura de la vegetación = modelo con vegetación − modelo sin vegetación (las imágenes llegan en grises autoescalados: cada tesela se calibra a metros con GetFeatureInfo en su punto más bajo y más alto, error < 4 cm). Cimas = máximos locales; la copa de cada cima, por cercanía. **8 090 árboles** (media 7,6 m) con su altura y radio; arbustos (0,8–3 m) solo en zonas verdes de OSM. En OSM solo hay 23 árboles mapeados. Pinos en el bosque; «esbeltos» (cipreses, chopos) si son mucho más altos que anchos; la especie no se sabe. También dan sombra en la herramienta de sombra y en el cálculo solar |
| Altura de cada edificio | ICGC, LiDAR 2021–2023, modelo «terreno + edificios» (1 m), las mismas teselas que los árboles | `osm_ripollet.py`: cubierta = mediana de las celdas de cada parte del Catastro; 7 014 partes medidas (976 con pocas celdas o valores raros se quedan con plantas × 3 m). Mediana de la diferencia con la estimación: −0,1 m; el 21 % difiere más de 3 m |
| Suelo sin datos de OSM | ICGC, Mapa de cobertes del sòl 2024 (WMS «cobertes-sol») | `obtener_cobertes.py` (necesita Pillow): cada color de la imagen se identifica con GetFeatureInfo y se agrupa en urbano, vegetación baja, arbolado, suelo desnudo y agua; colorea el suelo base (no cambia la simulación) |
| Relieve | ICGC, MDT 5 m | `osm_ripollet.py`: malla visual de 12 m; la simulación usa el MDT muestreado a 4 m |
| Zonas inundables del río | ACA en el SNCZI (MITECO), servicio IDEE | `obtener_oficial.py` |
| **Alcantarillado** | **No es público** (ni Catastro, ni ICGC, ni OSM) | Habría que pedirlo a quien gestiona la red |

## Datos y licencias

Código: licencia MIT (`LICENSE`), salvo **Neutro** (`js/neutro_nucleo.js`, también dentro de `ripollet.html` y
`web/`): © 2026 FOKO SOFT (Emilio Martinez), **licencia Apache 2.0** (`LICENSE-NEUTRO` y `NOTICE`), copia sin
modificar de [PUBLIC-NEUTRO](https://github.com/fokosoft/PUBLIC-NEUTRO). Los datos conservan sus licencias:
© colaboradores de OpenStreetMap (ODbL) · tiempo: Open-Meteo (CC BY 4.0) · ICGC (MDT 5 m, cartografía 1:1000 del AMB) · Dirección General del
Catastro · zonas inundables: ACA / SNCZI (MITECO), servicio IDEE · INE (Atlas de renta) · Idescat/ICGC (secciones
censales, CC BY 4.0) · Generalitat de Catalunya, dades obertes (ICAEN, Servei Català de Trànsit, XVPCA, autobuses
interurbanos, mapa de capacitat acústica) · AMB (GTFS) · Open-Meteo (calidad del aire, CC BY 4.0) · sonido de ambiente: steaq en Freesound (CC0).

En el repositorio no van los archivos de Blender, las cachés de descarga (teselas del Catastro, del LiDAR y del AMB,
GTFS, tablas brutas del INE) ni los certificados energéticos por vivienda: se regeneran con los `obtener_*.py`.
Resultado orientativo: no incluye alcantarillado ni el caudal del río (ver limitaciones en el visor).
