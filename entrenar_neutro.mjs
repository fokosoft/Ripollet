// ENTRENA Y MIDE A NEUTRO con la verdad de la simulación física (datos_sim/, de obtener_verdad.mjs).
//   1. Zonas no vistas: aprende en la mitad oeste y se examina en la este, y al revés.
//   2. Intensidad no vista: aprende con 20, 40, 90 y 120 mm/h y se examina con 60.
//   Rival clásico: regresión logística multinomial con los mismos rasgos. Referencia: siempre «seco».
//   3. Memoria final: aprende con todo → neutro_memoria.json (va dentro del visor); medida → neutro_medicion.json.
// Uso: node entrenar_neutro.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { INTENSIDADES, ACCIONES, situacion, rasgosDe, celdaAnalizable, claseDeProfundidad, crearNeutro, aprender,
         decidir, memoriaCompacta, comparar } from "./js/inundacion.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const leer = (ruta, Tipo) => { const b = readFileSync(join(DIR, ruta)); return new Tipo(b.buffer, b.byteOffset, b.byteLength / Tipo.BYTES_PER_ELEMENT); };
const DATOS = JSON.parse(readFileSync(join(DIR, "datos_visor", "datos.json"), "utf8"));
const { nx, ny } = DATOS.sim;
const codigos = leer("datos_visor/codigos.bin", Uint8Array);
const rasgos = leer("datos_visor/rasgos.bin", Uint8Array);
const reales = INTENSIDADES.map((mmh) => leer(`datos_sim/verdad_${mmh}.bin`, Uint16Array));

// Ejemplos: una celda en un escenario
const ejemplos = [];
for (let ii = 0; ii < INTENSIDADES.length; ii++)
  for (let k = 0; k < codigos.length; k++)
    if (celdaAnalizable(codigos[k]))
      ejemplos.push({ k, ii, s: situacion(ii, codigos[k], rasgos[k]), real: claseDeProfundidad(reales[ii][k] / 100) });

function barajar(lista, semilla) {          // mulberry32: el mismo orden en cada ejecución
  let a = semilla >>> 0;
  const azar = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// ---- Neutro ----------------------------------------------------------------------------------------------------
function entrenarNeutro(entreno) {
  const neutro = crearNeutro();
  for (const e of barajar(entreno, 7)) aprender(neutro, e.s, ACCIONES[e.real]);
  const memo = new Map();
  return { neutro, predecir: (s) => { if (!memo.has(s)) memo.set(s, ACCIONES.indexOf(decidir(neutro, s).accion)); return memo.get(s); } };
}

// ---- Rival: regresión logística multinomial (one-hot de los 5 rasgos + sesgo), SGD ----------------------------
const TAMS = [5, 10, 6, 4, 4];  // intensidad, suelo (10 tipos de celda), cuenca, hondonada, pendiente
const OFF = TAMS.map((_, i) => TAMS.slice(0, i).reduce((a, b) => a + b, 0));
const NF = TAMS.reduce((a, b) => a + b, 0) + 1;
const indices = (s) => { const r = rasgosDe(s); return [r.intensidad, r.suelo, r.cuenca, r.hondonada, r.pendiente].map((v, i) => OFF[i] + v).concat(NF - 1); };
function entrenarLogistica(entreno) {
  const W = Array.from({ length: 3 }, () => new Float64Array(NF));
  const puntuar = (idx) => W.map((w) => idx.reduce((a, i) => a + w[i], 0));
  for (let epoca = 0; epoca < 4; epoca++) {
    const tasa = 0.05 / (1 + epoca);
    for (const e of barajar(entreno, 11 + epoca)) {
      const idx = indices(e.s), z = puntuar(idx), m = Math.max(...z);
      const p = z.map((v) => Math.exp(v - m)), sum = p.reduce((a, b) => a + b);
      for (let c = 0; c < 3; c++) {
        const g = p[c] / sum - (c === e.real ? 1 : 0);
        for (const i of idx) W[c][i] -= tasa * (g + 1e-6 * W[c][i]);
      }
    }
  }
  const memo = new Map();
  return { predecir: (s) => { if (!memo.has(s)) { const z = puntuar(indices(s)); memo.set(s, z.indexOf(Math.max(...z))); } return memo.get(s); } };
}

// ---- Medida ----------------------------------------------------------------------------------------------------
const resumen = (r) => ({ exactitud: r.exactitud, precision: r.precision, sensibilidad: r.sensibilidad, f1: r.f1 });
function evaluar(examen, modelos) {
  const real = Uint8Array.from(examen, (e) => e.real);
  const out = {};
  for (const [nombre, m] of Object.entries(modelos)) out[nombre] = Uint8Array.from(examen, (e) => m.predecir(e.s));
  return { real, out };
}

// 1) Zonas no vistas (dos mitades por turnos)
const oeste = (e) => e.k % nx < nx / 2;
let examenEspacial = [];
const predEspacial = { neutro: [], logistica: [], seco: [] };
for (const lado of [true, false]) {
  const entreno = ejemplos.filter((e) => oeste(e) === lado), examen = ejemplos.filter((e) => oeste(e) !== lado);
  const modelos = { neutro: entrenarNeutro(entreno), logistica: entrenarLogistica(entreno), seco: { predecir: () => 0 } };
  const { out } = evaluar(examen, modelos);
  examenEspacial = examenEspacial.concat(examen);
  for (const n in out) predEspacial[n] = predEspacial[n].concat(Array.from(out[n]));
  console.log(`mitad ${lado ? "oeste→este" : "este→oeste"}: ${entreno.length} ejemplos, ${modelos.neutro.neutro.neuronas.size} neuronas`);
}
const realEspacial = Uint8Array.from(examenEspacial, (e) => e.real);
const espacial = Object.fromEntries(Object.entries(predEspacial).map(([n, p]) => [n, resumen(comparar(Uint8Array.from(p), realEspacial))]));

// Intervalo del 95 % de la diferencia de F1 (Neutro − logística), remuestreando bloques de 100 m (25 × 25 celdas)
const bloque = (e) => Math.floor((e.k / nx | 0) / 25) * 1000 + Math.floor((e.k % nx) / 25);
const porBloque = new Map();
examenEspacial.forEach((e, n) => {
  const b = bloque(e);
  if (!porBloque.has(b)) porBloque.set(b, { neutro: [0, 0, 0], logistica: [0, 0, 0] });   // vp, fp, fn
  const c = porBloque.get(b);
  for (const m of ["neutro", "logistica"]) {
    const p = predEspacial[m][n];
    if (p === 2 && e.real === 2) c[m][0]++; else if (p === 2) c[m][1]++; else if (e.real === 2) c[m][2]++;
  }
});
const bloques = [...porBloque.values()];
const f1 = (v) => (2 * v[0]) / (2 * v[0] + v[1] + v[2] || 1);
let semilla = 123;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const difs = [];
for (let r = 0; r < 1000; r++) {
  const s = { neutro: [0, 0, 0], logistica: [0, 0, 0] };
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[Math.floor(azar() * bloques.length)];
    for (const m of ["neutro", "logistica"]) for (let q = 0; q < 3; q++) s[m][q] += b[m][q];
  }
  difs.push(f1(s.neutro) - f1(s.logistica));
}
difs.sort((a, b) => a - b);
espacial.diferenciaF1 = { media: espacial.neutro.f1 - espacial.logistica.f1, ic: [difs[25], difs[974]] };

// 2) Intensidad no vista (60 mm/h)
const i60 = INTENSIDADES.indexOf(60);
const entreno60 = ejemplos.filter((e) => e.ii !== i60), examen60 = ejemplos.filter((e) => e.ii === i60);
const modelos60 = { neutro: entrenarNeutro(entreno60), logistica: entrenarLogistica(entreno60), seco: { predecir: () => 0 } };
const ev60 = evaluar(examen60, modelos60);
const intensidad = Object.fromEntries(Object.entries(ev60.out).map(([n, p]) => [n, resumen(comparar(p, ev60.real))]));

// 3) Memoria final con todo
const final = entrenarNeutro(ejemplos);
writeFileSync(join(DIR, "neutro_memoria.json"), JSON.stringify(memoriaCompacta(final.neutro)));

const medicion = {
  fecha: new Date().toISOString().slice(0, 10),
  prediccion: {
    es: "zonas no vistas: exactitud ≥ 90 % y F1 «inundado» 0,45–0,70, a menos de 0,05 de la logística; intensidad no vista: Neutro entre 0,05 y 0,15 de F1 por debajo de la logística (el completado no interpola).",
    ca: "zones no vistes: exactitud ≥ 90 % i F1 «inundat» 0,45–0,70, a menys de 0,05 de la logística; intensitat no vista: Neutro entre 0,05 i 0,15 de F1 per sota de la logística (la completació no interpola).",
  },
  espacial, intensidad, neuronas: final.neutro.neuronas.size, ejemplos: ejemplos.length,
};
writeFileSync(join(DIR, "neutro_medicion.json"), JSON.stringify(medicion));

const pc = (x) => (x * 100).toFixed(1).padStart(5) + " %";
const tabla = (titulo, r) => {
  console.log(`\n${titulo}\n                 exactitud  precisión  sensibil.   F1 inund.`);
  for (const n of ["neutro", "logistica", "seco"]) console.log(`  ${n.padEnd(12)} ${pc(r[n].exactitud)}  ${pc(r[n].precision)}  ${pc(r[n].sensibilidad)}  ${pc(r[n].f1)}`);
};
tabla("ZONAS NO VISTAS", espacial);
console.log(`  diferencia F1 Neutro − logística: ${(espacial.diferenciaF1.media * 100).toFixed(1)} puntos (IC 95 %: ${(difs[25] * 100).toFixed(1)} a ${(difs[974] * 100).toFixed(1)})`);
tabla("INTENSIDAD NO VISTA (60 mm/h)", intensidad);
const dist = [0, 0, 0];
for (const e of ejemplos) dist[e.real]++;
console.log(`\nejemplos ${ejemplos.length} (seco ${dist[0]}, charco ${dist[1]}, inundado ${dist[2]}) · neuronas finales ${final.neutro.neuronas.size}`);
