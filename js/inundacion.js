// NEUTRO Y EL RIESGO DE INUNDACIÓN. El núcleo de Neutro (neutro_nucleo.js, copia sin tocar de F:\Neutro\web\neutro)
// no sabe nada de agua: aquí va la PERCEPCIÓN, que convierte cada celda de 4 m en una situación, y el análisis de lo
// que decide (mapa de riesgo, puntos críticos, edificios y equipamientos afectados). Lo usan el visor y entrenar_neutro.mjs.
import { Nucleo } from './neutro_nucleo.js';

export const INTENSIDADES = [20, 40, 60, 90, 120];      // mm/h durante una hora (escenarios)
export const DURACION_LLUVIA = 3600;                    // s
export const DURACION_ESCORRENTIA = 1800;               // s de escorrentía después de la lluvia
export const ACCIONES = ['seco', 'charco', 'inundado']; // lo que decide Neutro; el reposo ("seco") primero
export const UMBRALES = [0.05, 0.30];                   // m de profundidad máxima: charco desde 5 cm, inundado desde 30 cm

export const claseDeProfundidad = (d) => (d < UMBRALES[0] ? 0 : d < UMBRALES[1] ? 1 : 2);

/** Ni los edificios (el agua de los tejados baja a la calle), ni el cauce del río (su caudal no se simula), ni los
 * patios privados y sus muros (desaguan por la casa: no son la vía pública). */
export const celdaAnalizable = (codigo) => codigo !== 1 && codigo !== 5 && codigo !== 7 && codigo !== 9;

/**
 * LA SITUACIÓN de una celda: "s" + 5 cifras en posiciones fijas — intensidad (0-4), suelo (código), área que le drena
 * (0-5), hondonada (0-3), pendiente (0-3). Las posiciones fijas permiten que el completado de patrones compare rasgo a
 * rasgo; la "s" evita que JavaScript reordene las claves numéricas al guardar la memoria.
 */
export function situacion(iIntensidad, codigo, rasgo) {
  return `s${iIntensidad}${codigo}${(rasgo >> 4) & 7}${(rasgo >> 2) & 3}${rasgo & 3}`;
}

export function rasgosDe(s) {
  return { intensidad: +s[1], suelo: +s[2], cuenca: +s[3], hondonada: +s[4], pendiente: +s[5] };
}

/** La percepción que el núcleo necesita: el CONCEPTO de cada situación (del detalle al concepto). */
export const percepcion = {
  nombrar(s) {
    const r = rasgosDe(s);
    if (r.hondonada >= 2) return 'hondonada';
    if (r.cuenca >= 4) return 'colector';
    if (r.suelo >= 2 && r.suelo <= 4) return 'zona verde';
    if (r.cuenca >= 2 && r.pendiente >= 1) return 'escorrentia';
    if (r.pendiente >= 3) return 'pendiente fuerte';
    return 'llano';
  },
  tranquila() { return false; },
};

export const crearNeutro = () => new Nucleo(percepcion, { acciones: ACCIONES, completar: true });

/**
 * Lo que decide Neutro y la neurona que lo decide: la EXCEPCIÓN DE ESTE LUGAR si la hay (incidencias reales), si no
 * la de la situación o, si no la vio nunca, la más parecida. `firma` = el lugar (bloque de 20 m, ver firmaDe).
 */
export function decidir(neutro, s, firma = '') {
  neutro.reiniciarEstadisticas();     // sin historial: aquí cada celda se decide por separado
  const [accion, neurona] = neutro.decidirSituacion(s, true, () => firma);
  return { accion, neurona, excepcion: neutro.excepciones.has(`${s}|${firma}`) };
}

/** La firma de lugar de una celda: su bloque de 5 × 5 celdas (20 m). */
export const firmaDe = (k, nx) => `${Math.floor((k % nx) / 5)},${Math.floor(Math.floor(k / nx) / 5)}`;

/**
 * APRENDER DE UNA INCIDENCIA REAL (los servicios municipales vieron agua aquí, con una lluvia de intensidad iIntensidad):
 *   - en este LUGAR, Neutro hace una EXCEPCIÓN (como las excepciones por lugar del núcleo): en las celdas de alrededor,
 *     con esa intensidad o más, decide al menos lo observado, sin cambiar lo que sabe del resto de la ciudad;
 *   - la neurona general de cada situación recibe además un repaso ligero (peso 1, frente a miles de simulaciones).
 * Devuelve cuántas celdas cambiaron de decisión en esa intensidad.
 */
export function aprenderDeIncidencia(neutro, inc, sim, codigos, rasgos, radio = 12) {
  const { nx, ny, celda } = sim, r = Math.ceil(radio / celda);
  const ci = Math.floor((inc.x - sim.x0) / celda), cj = Math.floor((inc.z - sim.z0) / celda);
  const real = ACCIONES[inc.gravedad];
  let cambios = 0;
  for (let j = cj - r; j <= cj + r; j++)
    for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || i >= nx || j < 0 || j >= ny || (i - ci) ** 2 + (j - cj) ** 2 > r * r) continue;
      const k = j * nx + i;
      if (!celdaAnalizable(codigos[k])) continue;
      const firma = firmaDe(k, nx);
      for (let ii = inc.intensidad; ii < INTENSIDADES.length; ii++) {
        const s = situacion(ii, codigos[k], rasgos[k]);
        const antes = decidir(neutro, s, firma).accion;
        if (ii === inc.intensidad) {          // repaso ligero de lo general (una vez por celda)
          if (antes === real) neutro.repasar([[s, real]], true);
          else { neutro.repasar([[s, antes]], false); neutro.repasar([[s, real]], true); }
        }
        const clave = `${s}|${firma}`;
        if (!neutro.excepciones.has(clave)) {
          const general = neutro.neuronas.get(s);
          neutro.excepciones.set(clave, { concepto: percepcion.nombrar(s), accion: antes, incidencias: [],
            fallos: Object.fromEntries(ACCIONES.map((a) => [a, 0])), aciertos: { ...(general?.aciertos || {}) } });
        }
        const ex = neutro.excepciones.get(clave);
        if (!ex.incidencias.includes(inc.id)) ex.incidencias.push(inc.id);
        if (ACCIONES.indexOf(real) > ACCIONES.indexOf(ex.accion)) ex.accion = real;   // al menos lo observado
        if (ii === inc.intensidad && ex.accion !== antes) cambios++;
      }
    }
  return cambios;
}

/** Aprender de una celda: Neutro predice y luego repasa sabiendo lo que pasó de verdad en la simulación. */
export function aprender(neutro, s, real) {
  const { accion } = decidir(neutro, s);
  if (accion === real) neutro.repasar([[s, accion]], true);
  else {
    neutro.repasar([[s, accion]], false);
    neutro.repasar([[s, real]], true);
  }
  return accion;
}

// ---- memoria compacta (lo que viaja dentro del visor) ---------------------------------------------------------
const r2 = (x) => Math.round(x * 100) / 100;

export function memoriaCompacta(neutro) {
  const n = {};
  for (const [s, neurona] of neutro.neuronas) {
    const a = neurona.aciertos || {};
    n[s] = [ACCIONES.indexOf(neurona.accion), ...ACCIONES.map((x) => r2(a[x] || 0)),
            ...ACCIONES.map((x) => r2(neurona.fallos[x] || 0))];
  }
  return n;
}

export function cargarMemoria(neutro, compacta) {
  const neuronas = {};
  for (const [s, v] of Object.entries(compacta)) {
    neuronas[s] = {
      concepto: percepcion.nombrar(s), accion: ACCIONES[v[0]],
      aciertos: Object.fromEntries(ACCIONES.map((x, i) => [x, v[1 + i]])),
      fallos: Object.fromEntries(ACCIONES.map((x, i) => [x, v[4 + i]])),
    };
  }
  neutro.cargarObjeto({ neuronas });
}

// ---- análisis del mapa -----------------------------------------------------------------------------------------

/** Mapa de riesgo: clase (0 seco, 1 charco, 2 inundado) de cada celda; 255 = no se analiza. */
export function predecirMapa(neutro, iIntensidad, codigos, rasgos, nx) {
  const mapa = new Uint8Array(codigos.length).fill(255), memo = new Map();
  const hayExcepciones = neutro.excepciones.size > 0;
  for (let k = 0; k < codigos.length; k++) {
    if (!celdaAnalizable(codigos[k])) continue;
    const s = situacion(iIntensidad, codigos[k], rasgos[k]);
    if (hayExcepciones) {                       // primero la excepción de este lugar, si la hay
      const ex = neutro.excepciones.get(`${s}|${firmaDe(k, nx)}`);
      if (ex) { mapa[k] = ACCIONES.indexOf(ex.accion); continue; }
    }
    let c = memo.get(s);
    if (c === undefined) { c = ACCIONES.indexOf(decidir(neutro, s).accion); memo.set(s, c); }
    mapa[k] = c;
  }
  return mapa;
}

/** Celdas a menos de `radio` m de un punto (para medidas e incidencias). */
export function celdasEnCirculo(sim, x, z, radio) {
  const { nx, ny, celda } = sim, r = radio / celda;
  const ci = (x - sim.x0) / celda - 0.5, cj = (z - sim.z0) / celda - 0.5, celdas = [];
  for (let j = Math.max(0, Math.floor(cj - r)); j <= Math.min(ny - 1, Math.ceil(cj + r)); j++)
    for (let i = Math.max(0, Math.floor(ci - r)); i <= Math.min(nx - 1, Math.ceil(ci + r)); i++)
      if ((i - ci) ** 2 + (j - cj) ** 2 <= r * r) celdas.push(j * nx + i);
  return celdas;
}

/** Clases a partir de profundidades máximas (la simulación), con las mismas celdas excluidas. */
export function clasesDeProfundidad(maxima, codigos) {
  return Uint8Array.from(maxima, (d, k) => (celdaAnalizable(codigos[k]) ? claseDeProfundidad(d) : 255));
}

/** PUNTOS CRÍTICOS: manchas de celdas "inundado" (vecindad de 8) de al menos `minCeldas`, de mayor a menor. */
export function puntosCriticos(mapa, sim, calles, minCeldas = 6) {
  const { nx, ny } = sim, visto = new Uint8Array(mapa.length), puntos = [];
  for (let k0 = 0; k0 < mapa.length; k0++) {
    if (mapa[k0] !== 2 || visto[k0]) continue;
    const pila = [k0], celdas = [];
    visto[k0] = 1;
    while (pila.length) {
      const k = pila.pop(), j = Math.floor(k / nx), i = k - j * nx;
      celdas.push(k);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const jj = j + dj, ii = i + di, n = jj * nx + ii;
          if (jj >= 0 && jj < ny && ii >= 0 && ii < nx && mapa[n] === 2 && !visto[n]) { visto[n] = 1; pila.push(n); }
        }
    }
    if (celdas.length < minCeldas) continue;
    let si = 0, sj = 0;
    const votos = new Map();
    for (const k of celdas) {
      const j = Math.floor(k / nx);
      si += k - j * nx; sj += j;
      if (calles[k]) votos.set(calles[k], (votos.get(calles[k]) || 0) + 1);
    }
    const ci = si / celdas.length, cj = sj / celdas.length;
    // la celda de la mancha más cercana a su centro (el centro puede caer fuera si la mancha es alargada)
    let centro = celdas[0], dmin = Infinity;
    for (const k of celdas) {
      const j = Math.floor(k / nx), d = (k - j * nx - ci) ** 2 + (j - cj) ** 2;
      if (d < dmin) { dmin = d; centro = k; }
    }
    const calle = [...votos].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    const j = Math.floor(centro / nx), i = centro - j * nx;
    puntos.push({ celdas: celdas.length, area: celdas.length * sim.celda ** 2, celda: centro, calle,
                  x: sim.x0 + (i + 0.5) * sim.celda, z: sim.z0 + (j + 0.5) * sim.celda });
  }
  return puntos.sort((a, b) => b.celdas - a.celdas);
}

/** Edificios con alguna celda vecina (vecindad de 4) de la clase pedida o peor. */
export function edificiosAfectados(mapa, sim, idEdificio, clase = 2) {
  const { nx, ny } = sim, afectados = new Set();
  for (let k = 0; k < mapa.length; k++) {
    if (mapa[k] === 255 || mapa[k] < clase) continue;
    const j = Math.floor(k / nx), i = k - j * nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && ii < nx && jj >= 0 && jj < ny && idEdificio[jj * nx + ii]) afectados.add(idEdificio[jj * nx + ii]);
    }
  }
  return afectados;
}

/** Peor clase en un radio alrededor de cada equipamiento: si su acceso queda con agua. */
export function equipamientosAfectados(mapa, sim, equipamientos, radio = 16) {
  const { nx, ny, celda } = sim, r = Math.ceil(radio / celda);
  return equipamientos.map((e) => {
    const ci = Math.floor((e.x - sim.x0) / celda), cj = Math.floor((e.z - sim.z0) / celda);
    let peor = 0;
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++)
        if (i >= 0 && i < nx && j >= 0 && j < ny && mapa[j * nx + i] !== 255) peor = Math.max(peor, mapa[j * nx + i]);
    return { ...e, clase: peor };
  });
}

/** Comparación de dos mapas de clases (las celdas 255 no cuentan). */
export function comparar(prediccion, real) {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let n = 0, bien = 0;
  for (let k = 0; k < real.length; k++) {
    if (real[k] === 255 || prediccion[k] === 255) continue;
    m[real[k]][prediccion[k]]++;
    n++;
    if (real[k] === prediccion[k]) bien++;
  }
  const vp = m[2][2], fp = m[0][2] + m[1][2], fn = m[2][0] + m[2][1];
  const precision = vp / (vp + fp || 1), sensibilidad = vp / (vp + fn || 1);
  return { n, exactitud: bien / (n || 1), matriz: m, precision, sensibilidad,
           f1: (2 * precision * sensibilidad) / (precision + sensibilidad || 1) };
}
