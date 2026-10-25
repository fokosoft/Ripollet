# Neutro y el riesgo de inundación en Ripollet

Núcleo: copia sin tocar de `F:\Neutro\web\neutro\nucleo.js` (commit 400d383, SHA-256 3af4eb8e…), en `js/neutro_nucleo.js`.
Percepción y análisis: `js/inundacion.js`. Entrenamiento y medida: `entrenar_neutro.mjs`.

## Qué se mide

- **Verdad:** la simulación física del visor (tuberías virtuales, celdas de 4 m) con lluvia uniforme de 20, 40, 60, 90
  y 120 mm/h durante 1 hora + 30 min de escorrentía. Clase de cada celda por su profundidad máxima: seco (< 5 cm),
  charco (5–30 cm), inundado (≥ 30 cm). No cuentan edificios ni el cauce del río.
- **Situación de Neutro (5 rasgos):** intensidad, tipo de suelo, área que drena a la celda (6 clases), profundidad de
  hondonada (4) y pendiente (4). Acciones: seco / charco / inundado. Aprende con `repasar`: predice, y repasa con éxito lo
  que acertó y con fallo lo que no (más un acierto para la clase real).
- **Rival clásico:** regresión logística multinomial con los mismos rasgos (codificación one-hot), entrenada con SGD.
  Referencia trivial: decir siempre «seco».
- **Pruebas:** (1) zonas no vistas: aprende en la mitad oeste y se examina en la este, y al revés; (2) intensidad no
  vista: aprende con 20, 40, 90 y 120 mm/h y se examina con 60. Intervalo del 95 % por remuestreo de bloques de 100 m.

## Predicción (escrita antes de medir, 25 oct 2026)

1. Zonas no vistas: exactitud de Neutro ≥ 90 % (casi todo queda seco); F1 de «inundado» entre 0,45 y 0,70.
   Neutro y la logística a menos de 0,05 de F1; Neutro algo mejor en las hondonadas, porque guarda cada combinación
   (intensidad × hondonada × cuenca) y la logística solo suma efectos.
2. Intensidad no vista (60 mm/h): Neutro peor que la logística en F1 de «inundado» (entre 0,05 y 0,15 menos): el
   completado de patrones toma la situación más parecida (40 o 90 mm/h), no interpola; la logística sí.

## Quinta medición: puentes reales (25 oct 2026)

Cambia el mundo, no Neutro ni el rival: los 11 puentes de OSM se construyen como tablero elevado y **dejan de contar
como calzada** en la rejilla de la simulación (el agua del cauce pasa por debajo), y la calzada «de bordillo a
bordillo» ya no crece desde el eje de un puente. Plazas, aparcamientos, árboles del LiDAR y farolas no tocan la
simulación (las plazas ya eran suelo urbano sellado).

**Predicción (escrita antes de medir):** (a) la superficie inundada analizada a 60 mm/h cambia menos de un 5 %
(antes 1,64 ha), porque los puentes ocupan muy poca superficie; (b) los F1 de Neutro y de la logística se mueven menos
de 2 puntos respecto a la cuarta medición; (c) la diferencia Neutro − logística en zonas no vistas sigue entre −6 y
+2 puntos.

**Resultado** (simulación física rehecha con `obtener_verdad.mjs`, Neutro y logística reentrenados con
`entrenar_neutro.mjs`; 574 580 ejemplos, 1 460 neuronas):

| Prueba | Medida | Neutro | Logística | Siempre «seco» |
|---|---|---|---|---|
| Zonas no vistas | Exactitud | 97,0 % | 97,4 % | 95,9 % |
| | Precisión «inundado» | 68,2 % | 78,6 % | — |
| | Sensibilidad «inundado» | 59,1 % | 56,5 % | 0 % |
| | **F1 «inundado»** | **63,3 %** | **65,7 %** | 0 % |
| Intensidad no vista (60 mm/h) | Exactitud | 97,5 % | 97,7 % | 95,9 % |
| | Precisión «inundado» | 92,2 % | 96,8 % | — |
| | Sensibilidad «inundado» | 54,4 % | 59,1 % | 0 % |
| | **F1 «inundado»** | **68,5 %** | **73,4 %** | 0 % |

Diferencia de F1 en zonas no vistas: **−2,4 puntos (IC 95 %: −5,5 a +1,8)**, la misma que en la cuarta medición.

**Frente a la predicción: cumplida en las tres partes.** (a) La superficie inundada analizada a 60 mm/h no cambia
(1,64 ha; a 90 mm/h, +0,1 %); en toda la maqueta solo 37 celdas cambian de profundidad a 60 mm/h (≤ 6 cm) y 1 cambia
de clase a 90 mm/h. (b) Los F1 se mueven menos de 0,1 puntos. (c) La diferencia sigue en −2,4. El cambio era pequeño
porque, con bordillos, la calzada de la simulación sale de la rejilla real y bajo los puentes ya mandaba el cauce: la
corrección es de coherencia, no de resultado. La comparación con la cartografía oficial no se ha repetido: con la misma
superficie inundada no puede cambiar.

## Cuarta medición: parcelas del Catastro y relieve fino (25 oct 2026)

Cambia el mundo, no Neutro ni el rival: (1) dentro de las parcelas con edificio, lo que no es edificio es **patio
privado** (desagua por la casa: 40 mm/h) con **muro** de 1 m hacia la vía pública, y no se analiza; (2) las parcelas
sin edificio que no son zona verde son **solares** de tierra (15 mm/h); (3) la simulación usa el **MDT de 5 m del
ICGC muestreado a 4 m** en vez de la malla visual de 12 m. Motivo: al comparar con la foto aérea de la zona del
Carrer del Puigmal y el Passatge del Celler, casi todas las manchas de agua estaban en patios y jardines, no en la
calle.

**Predicción (escrita antes de medir):** (a) la superficie inundada analizada baja al menos un 25 % a 60 mm/h
(antes 2,07 ha), porque desaparecen los patios; (b) en zonas no vistas, la diferencia de F1 Neutro − logística
queda entre −6 y +2 puntos; (c) los F1 de los dos bajan algo (entre 0 y −10 puntos), porque lo que queda es agua de
calle, más ligada al relieve fino, que los 5 rasgos describen peor que una hondonada entre edificios.

**Ajuste antes de medir a Neutro** (sin mirar sus resultados): la primera versión marcaba como patio todo el espacio
libre de cualquier parcela con edificio (55 ha, incluidos patios de escuela, explanadas de naves y bloques con jardín
abierto). Se restringió a parcelas recogidas: espacio libre ≤ 1 500 m² o edificios que cubren ≥ 40 % de la parcela
(20 ha de patio, 2 468 celdas de muro). Las parcelas sin edificio que no son zona verde (34 ha, incluidos campos de
las afueras) quedan como terreno de tierra.

**Resultados** (574 580 ejemplos: seco 550 829, charco 19 077, inundado 4 674; 1 460 neuronas):

| Prueba | Medida | Neutro | Logística | Siempre «seco» |
|---|---|---|---|---|
| Zonas no vistas | Exactitud | 97,0 % | 97,4 % | 95,9 % |
| | Precisión «inundado» | 68,2 % | 78,6 % | — |
| | Sensibilidad «inundado» | 59,2 % | 56,5 % | 0 % |
| | **F1 «inundado»** | **63,3 %** | **65,7 %** | 0 % |
| Intensidad no vista (60 mm/h) | Exactitud | 97,5 % | 97,7 % | 95,9 % |
| | Precisión «inundado» | 92,2 % | 96,8 % | — |
| | Sensibilidad «inundado» | 54,4 % | 59,1 % | 0 % |
| | **F1 «inundado»** | **68,5 %** | **73,4 %** | 0 % |

Diferencia de F1 en zonas no vistas: **−2,4 puntos (IC 95 %: −5,5 a +1,8)**.
Superficie inundada analizada (vía pública) con 60 mm/h: **1,64 ha** (antes 2,07 ha: −21 %).

**Frente a la predicción:**
- (a) **Fallada por poco:** la superficie baja un 21 %, no «al menos un 25 %». Los patios salen del análisis, pero el
  relieve fino de 4 m descubre más hondonadas en la vía pública (celdas de hondonada profunda: de 336 a 2 140).
- (b) **Cumplida:** −2,4 está entre −6 y +2.
- (c) **Cumplida:** Neutro igual (63,3 → 63,3), logística −0,9.

Nota de medida: `obtener_oficial.py` contaba aún los patios como vía pública (salía 4,17 ha); se corrigió para usar
las mismas celdas que el visor. Solape con las zonas fluviales oficiales: 0 % con 20 y 60 mm/h, 0,2 % con 120 mm/h.

## Tercera medición: edificios del Catastro y calzadas reales (25 oct 2026)

Cambia el mundo, no Neutro ni el rival: edificios del Catastro (1 932 edificios, 7 996 partes, huellas más precisas,
más patios cerrados) y calzadas de bordillo a bordillo a partir de la cartografía 1:1000 del AMB, en vez de anchos
típicos por tipo de calle.

**Predicción (escrita antes de medir):** en zonas no vistas la logística sigue por delante de Neutro, con una
diferencia de F1 «inundado» entre −2 y −8 puntos; los F1 de los dos quedan a menos de 5 puntos de la segunda medición
(65,5 y 70,5 %), porque la percepción (5 rasgos) es la misma y lo que cambia es la geometría.

**Resultados** (633 845 ejemplos: seco 605 188, charco 22 428, inundado 6 229; 1 155 neuronas):

| Prueba | Medida | Neutro | Logística | Siempre «seco» |
|---|---|---|---|---|
| Zonas no vistas | Exactitud | 96,4 % | 96,9 % | 95,5 % |
| | Precisión «inundado» | 65,7 % | 68,5 % | — |
| | Sensibilidad «inundado» | 61,0 % | 64,9 % | 0 % |
| | **F1 «inundado»** | **63,3 %** | **66,6 %** | 0 % |
| Intensidad no vista (60 mm/h) | Exactitud | 97,1 % | 97,3 % | 95,6 % |
| | Precisión «inundado» | 76,8 % | 80,6 % | — |
| | Sensibilidad «inundado» | 61,7 % | 67,4 % | 0 % |
| | **F1 «inundado»** | **68,4 %** | **73,4 %** | 0 % |

Diferencia de F1 en zonas no vistas: **−3,4 puntos (IC 95 %: −5,7 a +2,0)**.

**Frente a la predicción: cumplida.** La diferencia cae en el rango previsto (−2 a −8) y los F1 se mueven menos de
5 puntos (Neutro −2,2; logística −3,9). Con el mundo más real la ventaja de la logística se reduce y deja de ser
significativa (el intervalo incluye el 0). Con 60 mm/h sin ver, la logística sigue mejor (+5 puntos).

Comparación con la cartografía oficial (repetida): sigue sin solape (0 %) con las zonas fluviales T10–T500.

## Resultados válidos (25 oct 2026, segunda medición)

La primera medición (abajo) tenía un fallo del modelo físico: los **patios interiores de manzana** rodeados de
edificios no tenían salida y la lluvia de los tejados los llenaba como piscinas. Se corrigió en la percepción del mundo
(208 recintos sin salida a la calle de ≤ 3 000 m² cuentan como edificio: el agua de los tejados va a la calle), se
regeneró la verdad y se volvió a medir sin cambiar nada de Neutro ni del rival. 629 225 ejemplos (seco 600 767, charco
21 806, inundado 6 652); memoria final de 1 180 neuronas.

| Prueba | Medida | Neutro | Logística | Siempre «seco» |
|---|---|---|---|---|
| Zonas no vistas | Exactitud | 96,7 % | 97,1 % | 95,5 % |
| | Precisión «inundado» | 73,9 % | 82,1 % | — |
| | Sensibilidad «inundado» | 58,7 % | 61,8 % | 0 % |
| | **F1 «inundado»** | **65,5 %** | **70,5 %** | 0 % |
| Intensidad no vista (60 mm/h) | Exactitud | 97,0 % | 97,4 % | 95,6 % |
| | Precisión «inundado» | 64,4 % | 87,1 % | — |
| | Sensibilidad «inundado» | 55,5 % | 65,4 % | 0 % |
| | **F1 «inundado»** | **59,6 %** | **74,7 %** | 0 % |

Diferencia de F1 Neutro − logística en zonas no vistas: **−5,1 puntos (IC 95 %: −8,0 a −2,8)**: la logística es
mejor, y la diferencia es significativa.

**Frente a la predicción:**
1. Zonas no vistas: F1 dentro del rango previsto (0,45–0,70), pero **fallada** la parte «a menos de 0,05 de la
   logística»: queda a 0,051 y por debajo, con un intervalo que excluye el empate.
2. Intensidad no vista: **cumplida** (Neutro 0,151 por debajo; se predijo entre 0,05 y 0,15, justo en el borde).

**Consecuencia para el visor:** el mapa que se enseña por defecto es el de la **simulación física** (precalculada para
los 5 escenarios). Neutro aporta la explicación de cada punto y su predicción queda como capa alternativa, con esta
medición a la vista. Ninguno de los dos números se ha ajustado mirando el examen.

## Comparación con la cartografía oficial (`obtener_oficial.py`)

Fuente: zonas inundables **fluviales** T10 / T100 / T500 (cartografía de la ACA en el SNCZI del Ministerio,
servicio WMS INSPIRE del IDEE `servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones`). No existe capa
oficial **pluvial** (lluvia sobre la ciudad) en ese servicio: solo fluvial y marina.

- Alineación comprobada: el 84 % de las celdas del cauce (OSM) cae en la zona T10 y el 90 % en la T500; la zona
  oficial queda a 20 m del cauce de mediana (percentil 95: 72 m).
- En la maqueta: T10 8,0 ha · T100 11,5 ha · T500 11,9 ha, **sin ningún edificio dentro**.
- Solape con lo que la simulación pluvial marca como inundado (≥ 30 cm): **0 %** con 20, 60 y 120 mm/h.

Lectura: el riesgo del río (oficial) está confinado al cauce del Ripoll y sus márgenes; los puntos de lluvia que
marca la simulación están en la trama urbana y no aparecen en ningún mapa oficial. Son riesgos distintos y
complementarios: la cartografía oficial **no valida ni contradice** los puntos de lluvia. Para validarlos hacen falta
observaciones reales (episodios de lluvia, avisos de los servicios municipales, imbornales que se saturan).

## Primera medición (con el fallo de los patios, se conserva como registro)

636 570 ejemplos (seco 604 104, charco 23 923, inundado 8 543). Memoria final: 1 195 neuronas (31 KB).

| Prueba | Medida | Neutro | Logística | Siempre «seco» |
|---|---|---|---|---|
| Zonas no vistas | Exactitud | 95,8 % | 96,3 % | 94,9 % |
| | Precisión «inundado» | 60,5 % | 63,1 % | — |
| | Sensibilidad «inundado» | 42,5 % | 47,7 % | 0 % |
| | **F1 «inundado»** | **49,9 %** | **54,3 %** | 0 % |
| Intensidad no vista (60 mm/h) | Exactitud | 96,5 % | 96,5 % | 95,0 % |
| | Precisión «inundado» | 59,4 % | 57,8 % | — |
| | Sensibilidad «inundado» | 56,8 % | 56,2 % | 0 % |
| | **F1 «inundado»** | **58,1 %** | **57,0 %** | 0 % |

Diferencia de F1 Neutro − logística en zonas no vistas: −4,4 puntos (IC 95 % por bloques de 100 m: −8,5 a +0,1).

**Frente a la predicción:**
1. Zonas no vistas: **cumplida en parte.** F1 dentro del rango (0,45–0,70) y a menos de 0,05 de la logística, pero
   Neutro queda por debajo (−4,4; el intervalo casi excluye el 0). Lo de «mejor en las hondonadas» no se midió aparte:
   queda sin comprobar.
2. Intensidad no vista: **fallada.** Se esperaba a Neutro claramente peor (el completado no interpola) y empata o
   gana por poco (+1,1). Probable motivo: la intensidad es la primera cifra de la situación y el completado a
   distancia 1 encuentra la misma celda-tipo con 40 o 90 mm/h, que se comportan casi igual que con 60.

**Lectura:** con estos 5 rasgos, Neutro y un modelo estadístico clásico aciertan parecido (la mitad de las celdas
inundadas, con un 60 % de precisión). El techo lo pone la percepción (5 rasgos en clases), no el núcleo. Lo que
Neutro aporta en el visor es la **explicación** de cada decisión (concepto, rasgos y lo que vio al aprender), que la
logística no da de forma tan directa.

**Ideas sin probar (no se ajustó nada mirando el examen):** rasgos más finos (distancia al edificio, curvatura,
área drenada impermeable en vez de total), umbral de «inundado» por escenario, y la versión con olvido
(`nucleo_juegos.js`), que aquí no debería aportar porque el mundo no cambia.
