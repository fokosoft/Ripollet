// TRÁFICO Y GENTE: coches por el grafo de calles y peatones por aceras y caminos, en la cantidad que toca a cada
// hora. No hay aforos públicos de las calles de Ripollet: la intensidad media diaria (IMD) se estima por tipo de vía
// y se reparte con la curva horaria típica de un día laborable o festivo. Si se tienen aforos reales, se ponen en
// AFOROS (nombre de la calle → vehículos/día) y mandan sobre la estimación.
// Gráficos mínimos: una caja por coche y un palito por persona, todos con instancias (2 llamadas a la GPU).
import { crearGrafo } from './rutas.js';

export const TEXTOS_TRAFICO = {
  es: {
    tfActivo: "🚗 {0} coches · 🚶 {1} personas ahora", tfApagado: "🚗 Tráfico y gente", tfQuitar: "Quitar",
    tfPoner: "Mostrar", tfVolumen: "≈ {0} vehículos/día por las calles de la maqueta (estimado por tipo de vía{1})",
    tfConAforos: "; {0} calles con aforo real",
  },
  ca: {
    tfActivo: "🚗 {0} cotxes · 🚶 {1} persones ara", tfApagado: "🚗 Trànsit i gent", tfQuitar: "Treure",
    tfPoner: "Mostrar", tfVolumen: "≈ {0} vehicles/dia pels carrers de la maqueta (estimat per tipus de via{1})",
    tfConAforos: "; {0} carrers amb aforament real",
  },
};

// Aforos reales (vehículos/día, los dos sentidos) por nombre de calle, tal como sale en el visor. Vacío: no hay
// datos públicos. Ejemplo: { "Rambla de Sant Jordi": 9500 }
const AFOROS = {};
// IMD estimada según la velocidad de la vía (que sale de su tipo en OSM): autopista, vía rápida, principal…
const IMD_POR_VELOCIDAD = { 80: 60000, 60: 25000, 50: 12000, 40: 5000, 30: 900, 20: 150 };
/** Vehículos/día de un tramo: el aforo real de su calle si lo hay; si no, el estimado por su tipo (velocidad). */
export function imdEstimada(vel, nombre) {
  if (nombre && AFOROS[nombre]) return AFOROS[nombre];
  if (IMD_POR_VELOCIDAD[vel] !== undefined) return IMD_POR_VELOCIDAD[vel];
  const v = Object.keys(IMD_POR_VELOCIDAD).map(Number).reduce((p, q) => (Math.abs(q - vel) < Math.abs(p - vel) ? q : p));
  return IMD_POR_VELOCIDAD[v];
}
// % del tráfico diario en cada hora (curvas típicas urbanas, laborable y fin de semana)
export const LABORABLE = [0.9, 0.5, 0.4, 0.4, 0.6, 1.5, 3.8, 6.4, 7.0, 6.0, 5.6, 5.7, 6.0, 6.2, 6.0, 5.8, 6.1, 6.8, 7.0, 6.2, 4.6, 3.2, 2.3, 1.6];
const FESTIVO = [1.6, 1.1, 0.8, 0.6, 0.6, 0.8, 1.4, 2.4, 3.6, 5.0, 6.2, 6.8, 7.0, 6.8, 6.0, 5.6, 5.8, 6.2, 6.4, 6.0, 5.0, 3.8, 2.8, 2.0];
// Peatones: fuera de casa por la calle a la vez, para toda la maqueta, según la hora (orden de magnitud)
const PEATONES = [10, 5, 3, 2, 2, 5, 20, 70, 110, 120, 140, 160, 170, 150, 120, 120, 150, 190, 220, 210, 160, 100, 50, 20];
const MAX_COCHES = 1500, MAX_PERSONAS = 600;
const COLORES = [0xd64545, 0xf4f4f2, 0x2b2d33, 0x9aa3ad, 0x2f6fb0, 0xe0a030, 0x3e8a3a, 0xb8322f, 0xdcdcdc, 0x5a6470];
const ROPA = [0x2f6fb0, 0xd64545, 0x3e8a3a, 0xe0a030, 0x6b4c9a, 0x2b2d33, 0xf2f2f2, 0xc75b8a];

export function crearTrafico(ctx, div) {
  const { THREE, D, SIM, S1, altura, t, numero, $ } = ctx;
  const G = crearGrafo(D);     // de rutas.js (misma red de calles)
  const enX = (x, z) => Math.floor((x - SIM.x0) / SIM.celda), enZ = (z) => Math.floor((z - SIM.z0) / SIM.celda);
  const calleDe = (x, z) => {
    const i = enX(x, z), j = enZ(z);
    return i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? D.calles[j * SIM.nx + i] : 0;
  };

  // Solo los tramos que están enteros encima de la maqueta (el grafo llega hasta 50 m fuera): en el borde, media vuelta
  const X0 = SIM.x0 + 2, X1 = SIM.x0 + SIM.nx * SIM.celda - 2, Z0 = SIM.z0 + 2, Z1 = SIM.z0 + SIM.ny * SIM.celda - 2;
  const dentro = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
  const enMapa = Uint8Array.from({ length: G.na }, (_, e) =>
    dentro(G.x[G.A[3 * e]], G.z[G.A[3 * e]]) && dentro(G.x[G.A[3 * e + 1]], G.z[G.A[3 * e + 1]]) ? 1 : 0);
  const usaCoche = (e) => G.vel[e] > 0 && enMapa[e] === 1;

  // ---------------------------------------------------------------- IMD de cada tramo
  const imd = new Float32Array(G.na);
  let conAforo = 0, total = 0;
  const nombresConAforo = new Set();
  for (let e = 0; e < G.na; e++) {
    if (!usaCoche(e)) continue;
    const a = G.A[3 * e], b = G.A[3 * e + 1], id = calleDe((G.x[a] + G.x[b]) / 2, (G.z[a] + G.z[b]) / 2);
    const nombre = id ? ctx.DATOS.calles[id - 1] : null;
    if (nombre && AFOROS[nombre]) nombresConAforo.add(nombre);
    imd[e] = imdEstimada(G.vel[e], nombre);
    total += imd[e] * G.largo[e];
  }
  conAforo = nombresConAforo.size;
  // «Vehículos/día por las calles»: veh·km/día entre la longitud de la red (una media ponderada por longitud)
  const largoRed = G.largo.reduce((s, l, e) => s + (usaCoche(e) ? l : 0), 0);
  const imdMedia = total / largoRed;

  // Coches que hay a la vez en cada tramo a una hora: q (veh/h) × largo / velocidad real (60 % del límite)
  // m/s: el 60 % de la de emergencia, y nunca más que el límite legal de la calle
  const velReal = (e) => Math.min(G.vel[e] * 0.6, G.limite[e] || 99) / 3.6;
  function esperados(pct) {
    const v = new Float32Array(G.na);
    for (let e = 0; e < G.na; e++) if (usaCoche(e)) v[e] = imd[e] * pct / 100 / 3600 * G.largo[e] / velReal(e);
    return v;
  }

  // ---------------------------------------------------------------- mallas (instancias)
  const geoCoche = new THREE.BoxGeometry(1.8, 1.4, 4.2);
  geoCoche.translate(0, 0.7, 0);
  const coches = new THREE.InstancedMesh(geoCoche, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), MAX_COCHES);
  const geoPersona = new THREE.BoxGeometry(0.45, 1.7, 0.35);
  geoPersona.translate(0, 0.85, 0);
  const personas = new THREE.InstancedMesh(geoPersona, new THREE.MeshStandardMaterial({ flatShading: true }), MAX_PERSONAS);
  for (const m of [coches, personas]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    ctx.scene.add(m);
  }
  const color = new THREE.Color();
  for (let k = 0; k < MAX_COCHES; k++) coches.setColorAt(k, color.set(COLORES[k % COLORES.length]));
  for (let k = 0; k < MAX_PERSONAS; k++) personas.setColorAt(k, color.set(ROPA[(k * 7) % ROPA.length]));

  // ---------------------------------------------------------------- coches: siguen el grafo
  const lista = [];            // { e, desde (nodo de salida), s (m recorridos), v }
  const vecinosCoche = (n) => {
    const r = [];
    for (let p = G.inicio[n]; p < G.inicio[n + 1]; p++) if (usaCoche(G.arista[p])) r.push(p);
    return r;
  };
  let pesos = null, sumaPesos = 0;
  function tramoAlAzar() {     // proporcional a los coches esperados en cada tramo
    let r = Math.random() * sumaPesos;
    for (let e = 0; e < G.na; e++) if ((r -= pesos[e]) <= 0) return e;
    return 0;
  }
  function nuevoCoche() {
    const e = tramoAlAzar(), desde = Math.random() < 0.5 ? G.A[3 * e] : G.A[3 * e + 1];
    return { e, desde, s: Math.random() * G.largo[e], v: velReal(e) * (0.8 + 0.4 * Math.random()) };
  }
  function siguiente(c) {
    const llega = c.desde === G.A[3 * c.e] ? G.A[3 * c.e + 1] : G.A[3 * c.e];
    const opciones = vecinosCoche(llega).filter((p) => G.arista[p] !== c.e);
    if (!opciones.length) { c.desde = llega; c.s = 0; return; }        // calle sin salida: media vuelta
    // Gira hacia donde va más tráfico (las vías grandes se llevan más coches)
    let r = Math.random() * opciones.reduce((s, p) => s + imd[G.arista[p]], 0);
    let p = opciones[0];
    for (const q of opciones) if ((r -= imd[G.arista[q]]) <= 0) { p = q; break; }
    c.e = G.arista[p]; c.desde = llega; c.s = 0; c.v = velReal(c.e) * (0.8 + 0.4 * Math.random());
  }

  // ---------------------------------------------------------------- personas: por tramos a pie, en la acera
  const tramosPie = [], pesoPie = [];
  {
    const cerca = (x, z) => ctx.DATOS.servicios.concat(ctx.DATOS.equipamientos)
      .some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 120 * 120);
    for (let e = 0; e < G.na; e++) {
      if (!G.pie[e] || G.vel[e] >= 60 || !enMapa[e]) continue;
      const a = G.A[3 * e], b = G.A[3 * e + 1];
      tramosPie.push(e);
      pesoPie.push(G.largo[e] * (G.vel[e] ? 1 : 2.5) * (cerca((G.x[a] + G.x[b]) / 2, (G.z[a] + G.z[b]) / 2) ? 2.5 : 1));
    }
  }
  const sumaPie = pesoPie.reduce((a, b) => a + b, 0);
  const gente = [];            // { e, ida, s, v, lado }
  /** Distancia al eje donde empieza la acera (sondeando la rejilla de 1 m), o 0 en caminos peatonales. */
  function ladoAcera(e, signo) {
    if (!G.vel[e]) return 0;
    const a = G.A[3 * e], b = G.A[3 * e + 1], l = G.largo[e] || 1;
    const nx = -(G.z[b] - G.z[a]) / l, nz = (G.x[b] - G.x[a]) / l, mx = (G.x[a] + G.x[b]) / 2, mz = (G.z[a] + G.z[b]) / 2;
    for (let d = 2; d <= 14; d++) {
      const i = Math.floor(mx + nx * d * signo - SIM.x0), j = Math.floor(mz + nz * d * signo - SIM.z0);
      if (i >= 0 && j >= 0 && i < S1.nx && j < S1.ny && D.suelo1m[j * S1.nx + i] === 1) return d + 0.8;
    }
    return 4;
  }
  function nuevaPersona() {
    let r = Math.random() * sumaPie, q = 0;
    while (q < tramosPie.length - 1 && (r -= pesoPie[q]) > 0) q++;
    const e = tramosPie[q], signo = Math.random() < 0.5 ? 1 : -1;
    return { e, ida: Math.random() < 0.5, s: Math.random() * G.largo[e], v: 1.1 + Math.random() * 0.5,
             lado: signo * ladoAcera(e, signo) };
  }

  // ---------------------------------------------------------------- cuántos, según la hora
  let activo = true, objetivoCoches = 0, objetivoGente = 0;
  try { activo = localStorage.getItem("trafico") !== "no"; } catch {}
  function recalcular() {
    const { fecha, hora } = ctx.hora();
    const festivo = fecha.getUTCDay() === 0 || fecha.getUTCDay() === 6;
    const curva = festivo ? FESTIVO : LABORABLE, suma = curva.reduce((a, b) => a + b, 0);
    const h0 = Math.floor(hora) % 24, f = hora - Math.floor(hora);
    const pct = 100 * (curva[h0] * (1 - f) + curva[(h0 + 1) % 24] * f) / suma;
    pesos = esperados(pct);
    sumaPesos = pesos.reduce((a, b) => a + b, 0);
    objetivoCoches = Math.min(MAX_COCHES, Math.round(sumaPesos));
    const lluvia = ctx.clima?.()?.lluvia > 0.1 ? 0.4 : 1;              // con lluvia, menos gente por la calle
    objetivoGente = Math.min(MAX_PERSONAS, Math.round((PEATONES[h0] * (1 - f) + PEATONES[(h0 + 1) % 24] * f) * (festivo ? 0.8 : 1) * lluvia));
    rotulos();
  }

  // ---------------------------------------------------------------- panel
  div.innerHTML = `<div style="display:flex;gap:6px;align-items:center;margin-top:6px">
    <span id="tfTexto" style="flex:1"></span><button id="tfBoton"></button></div>
    <div class="nota" id="tfNota" style="margin-top:2px"></div>`;
  function rotulos() {
    $("tfTexto").innerHTML = activo ? t("tfActivo", numero(objetivoCoches), numero(objetivoGente)) : t("tfApagado");
    $("tfBoton").textContent = t(activo ? "tfQuitar" : "tfPoner");
    $("tfNota").textContent = activo ? t("tfVolumen", numero(Math.round(imdMedia / 100) * 100),
                                         conAforo ? t("tfConAforos", conAforo) : "") : "";
  }
  $("tfBoton").onclick = () => {
    activo = !activo;
    try { localStorage.setItem("trafico", activo ? "si" : "no"); } catch {}
    if (!activo) { lista.length = gente.length = 0; coches.count = personas.count = 0; }
    rotulos();
  };

  // ---------------------------------------------------------------- cada fotograma
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), arriba = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), escala = new THREE.Vector3(1, 1, 1), nada = new THREE.Vector3(0, 0, 0);
  let espera = 0;
  recalcular();
  return {
    traducir: rotulos,
    recalcular,
    cadaFrame(dt) {
      if (!activo) return;
      espera -= dt;
      if (espera <= 0) { espera = 15; recalcular(); }
      // Ajuste suave al número que toca: unos pocos por fotograma
      for (let k = 0; k < 20 && lista.length < objetivoCoches; k++) lista.push(nuevoCoche());
      if (lista.length > objetivoCoches) lista.length = Math.max(objetivoCoches, lista.length - 10);
      for (let k = 0; k < 10 && gente.length < objetivoGente; k++) gente.push(nuevaPersona());
      if (gente.length > objetivoGente) gente.length = Math.max(objetivoGente, gente.length - 5);

      for (let k = 0; k < lista.length; k++) {
        const c = lista[k];
        c.s += c.v * dt;
        while (c.s >= G.largo[c.e]) { c.s -= G.largo[c.e]; siguiente(c); }
        const a = c.desde, b = c.desde === G.A[3 * c.e] ? G.A[3 * c.e + 1] : G.A[3 * c.e], l = G.largo[c.e] || 1;
        const dx = (G.x[b] - G.x[a]) / l, dz = (G.z[b] - G.z[a]) / l;
        // Por la derecha: 1,8 m a un lado del eje (más en las vías rápidas)
        const lado = G.vel[c.e] >= 60 ? 4 : 1.8;
        p.set(G.x[a] + dx * c.s - dz * lado, 0, G.z[a] + dz * c.s + dx * lado);
        p.y = altura(p.x, p.z) + 0.05;
        q.setFromAxisAngle(arriba, Math.atan2(dx, dz));
        // Sin choques con el coche que conduces: los que quedan encima no se dibujan
        const mio = ctx.cochePropio?.();
        const tapa = (mio && (mio.x - p.x) ** 2 + (mio.z - p.z) ** 2 < 36) || !dentro(p.x, p.z);
        coches.setMatrixAt(k, m.compose(p, q, tapa ? nada : escala));
      }
      coches.count = lista.length;
      coches.instanceMatrix.needsUpdate = true;

      for (let k = 0; k < gente.length; k++) {
        const g = gente[k], l = G.largo[g.e] || 1;
        g.s += g.v * dt;
        if (g.s >= l) { Object.assign(g, nuevaPersona(), { s: 0 }); }          // llega al final: aparece en otro sitio
        const a = g.ida ? G.A[3 * g.e] : G.A[3 * g.e + 1], b = g.ida ? G.A[3 * g.e + 1] : G.A[3 * g.e];
        const dx = (G.x[b] - G.x[a]) / l, dz = (G.z[b] - G.z[a]) / l, lado = g.ida ? g.lado : -g.lado;
        p.set(G.x[a] + dx * g.s - dz * lado, 0, G.z[a] + dz * g.s + dx * lado);
        p.y = altura(p.x, p.z) + 0.15 + Math.abs(Math.sin(g.s * 3)) * 0.06;  // un leve rebote al andar
        q.setFromAxisAngle(arriba, Math.atan2(dx, dz));
        personas.setMatrixAt(k, m.compose(p, q, dentro(p.x, p.z) ? escala : nada));     // la acera, fuera del mapa: no
      }
      personas.count = gente.length;
      personas.instanceMatrix.needsUpdate = true;
    },
  };
}
