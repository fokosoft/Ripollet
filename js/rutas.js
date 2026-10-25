// RUTAS POR EL GRAFO DE CALLES (OSM): tiempos de llegada de los servicios de emergencia, con calles cortadas por una
// inundación simulada, y la «ciudad de 15 minutos»: a cuánto queda a pie cada edificio de escuelas, salud, comida,
// parques infantiles y servicios sociales. Sin tráfico ni semáforos y sin sentidos únicos: orientativo.
import { Monticulo } from './comun.js';

export const TEXTOS_RUTAS = {
  es: {
    emergBoton: "🚑 Emergencias", emTitulo: "Tiempos de llegada de emergencias",
    emDesde: "Desde", emTodos: "La más cercana de todas", emInundacion: "Calles inundadas",
    emSeca: "Sin lluvia", emEscenario: "Lluvia de {0} mm/h (simulación física)",
    emResumen: "Edificios a ≤ 3 min: <b>{0} %</b> · a ≤ 5 min: <b>{1} %</b> · el más lejano: {2} min.",
    emCortes: "Con {0} mm/h quedan cortados (más de 30 cm de agua) <b>{1}</b> tramos: {2} edificios tardan más y " +
      "{3} se quedan sin acceso en coche.",
    emSinFisica: "Ese escenario aún no se ha simulado.",
    emClic: "Clic en el mapa para ver cuánto se tarda en llegar a ese punto.",
    emPunto: "Hasta ese punto: {0}", emMin: "{0}: {1} min", emNoLlega: "{0}: no llega",
    emNota: "Coche a la velocidad de cada vía (OSM), sin tráfico, semáforos ni sentidos únicos, y 30 cm de agua como " +
      "límite para pasar. No hay parque de bomberos en la maqueta (el más cercano es el de Cerdanyola). Orientativo.",
    minutosBoton: "🚶 Ciudad de 15 minutos", miTitulo: "Ciudad de 15 minutos (a pie)",
    miVer: "Ver", miPeor: "La peor de todas", miRitmo: "Paso", miNormal: "4,5 km/h", miLento: "3 km/h (persona mayor)",
    miResumen: "Edificios con todo a ≤ 15 min: <b>{0} %</b>.", miCat: "{0}: el {1} % a ≤ 10 min",
    miClic: "Clic en un edificio para ver a cuánto le queda cada cosa.",
    miEdificio: "Desde ahí, a pie:", miFila: "{0}: {1} min ({2})",
    miNota: "Caminando por calles y caminos de OSM. Educación, salud, servicios sociales: equipamientos de OSM; " +
      "comida (súper, panadería, fruta, carne, mercado), farmacias y parques infantiles: comercios y lugares de OSM " +
      "dentro de la maqueta: lo que queda justo fuera no cuenta, y los bordes salen peor. Orientativo.",
    cats: { educacion: "Educación", salud: "Salud y farmacia", alimentacion: "Comida", juegos: "Parque infantil",
            social: "Servicios sociales" },
  },
  ca: {
    emergBoton: "🚑 Emergències", emTitulo: "Temps d'arribada d'emergències",
    emDesde: "Des de", emTodos: "La més propera de totes", emInundacion: "Carrers inundats",
    emSeca: "Sense pluja", emEscenario: "Pluja de {0} mm/h (simulació física)",
    emResumen: "Edificis a ≤ 3 min: <b>{0} %</b> · a ≤ 5 min: <b>{1} %</b> · el més llunyà: {2} min.",
    emCortes: "Amb {0} mm/h queden tallats (més de 30 cm d'aigua) <b>{1}</b> trams: {2} edificis triguen més i " +
      "{3} es queden sense accés en cotxe.",
    emSinFisica: "Aquest escenari encara no s'ha simulat.",
    emClic: "Clic al mapa per veure quant es triga a arribar a aquest punt.",
    emPunto: "Fins a aquest punt: {0}", emMin: "{0}: {1} min", emNoLlega: "{0}: no hi arriba",
    emNota: "Cotxe a la velocitat de cada via (OSM), sense trànsit, semàfors ni sentits únics, i 30 cm d'aigua com a " +
      "límit per passar. No hi ha parc de bombers a la maqueta (el més proper és el de Cerdanyola). Orientatiu.",
    minutosBoton: "🚶 Ciutat de 15 minuts", miTitulo: "Ciutat de 15 minuts (a peu)",
    miVer: "Veure", miPeor: "La pitjor de totes", miRitmo: "Pas", miNormal: "4,5 km/h", miLento: "3 km/h (persona gran)",
    miResumen: "Edificis amb tot a ≤ 15 min: <b>{0} %</b>.", miCat: "{0}: el {1} % a ≤ 10 min",
    miClic: "Clic en un edifici per veure a quant li queda cada cosa.",
    miEdificio: "Des d'aquí, a peu:", miFila: "{0}: {1} min ({2})",
    miNota: "Caminant per carrers i camins d'OSM. Educació, salut, serveis socials: equipaments d'OSM; menjar (súper, " +
      "forn, fruita, carn, mercat), farmàcies i parcs infantils: comerços i llocs d'OSM dins de la maqueta: el que " +
      "queda just a fora no hi compta, i les vores surten pitjor. Orientatiu.",
    cats: { educacion: "Educació", salud: "Salut i farmàcia", alimentacion: "Menjar", juegos: "Parc infantil",
            social: "Serveis socials" },
  },
};

// ---------------------------------------------------------------- grafo
let grafo = null;
export function crearGrafo(D) {
  if (grafo) return grafo;
  const N = D.grafo.nodos, A = D.grafo.aristas, nn = N.length / 2, na = A.length / 3;
  const x = new Float32Array(nn), z = new Float32Array(nn);
  for (let q = 0; q < nn; q++) { x[q] = N[2 * q] / 10; z[q] = N[2 * q + 1] / 10; }
  // Lista de adyacencia compacta (CSR): cada arista en los dos sentidos
  const grado = new Uint32Array(nn + 1);
  for (let e = 0; e < na; e++) { grado[A[3 * e]]++; grado[A[3 * e + 1]]++; }
  const inicio = new Uint32Array(nn + 1);
  for (let q = 0; q < nn; q++) inicio[q + 1] = inicio[q] + grado[q];
  const vecino = new Uint32Array(2 * na), arista = new Uint32Array(2 * na), lleno = inicio.slice(0, nn);
  for (let e = 0; e < na; e++) {
    const a = A[3 * e], b = A[3 * e + 1];
    vecino[lleno[a]] = b; arista[lleno[a]++] = e;
    vecino[lleno[b]] = a; arista[lleno[b]++] = e;
  }
  const largo = new Float32Array(na), vel = new Uint8Array(na), pie = new Uint8Array(na);
  for (let e = 0; e < na; e++) {
    const a = A[3 * e], b = A[3 * e + 1];
    largo[e] = Math.hypot(x[a] - x[b], z[a] - z[b]);
    vel[e] = A[3 * e + 2] & 127; pie[e] = A[3 * e + 2] >> 7;
  }
  grafo = { nn, na, x, z, inicio, vecino, arista, largo, vel, pie, A };
  return grafo;
}

/** Dijkstra multiorigen. segundos(e) = tiempo de la arista (Infinity: no se pasa). Devuelve tiempo y previo. */
export function tiempos(G, origenes, segundos) {
  const t = new Float64Array(G.nn).fill(Infinity), previo = new Int32Array(G.nn).fill(-1);
  const m = new Monticulo();
  for (const o of origenes) { t[o] = 0; m.push(0, o); }
  while (m.length) {
    const a = m.pop(), d = m.ultimaClave;
    if (d > t[a]) continue;
    for (let p = G.inicio[a]; p < G.inicio[a + 1]; p++) {
      const s = segundos(G.arista[p]);
      if (s === Infinity) continue;
      const b = G.vecino[p], nd = d + s;
      if (nd < t[b]) { t[b] = nd; previo[b] = a; m.push(nd, b); }
    }
  }
  return { t, previo };
}

/** Nodo más cercano a (x, z) de los que cumplen `vale` (fuerza bruta: unos miles de nodos). */
export function nodoCercano(G, x, z, vale) {
  let mejor = -1, dm = Infinity;
  for (let q = 0; q < G.nn; q++) {
    if (!vale[q]) continue;
    const d = (G.x[q] - x) ** 2 + (G.z[q] - z) ** 2;
    if (d < dm) { dm = d; mejor = q; }
  }
  return { nodo: mejor, distancia: Math.sqrt(dm) };
}
/** Nodos de la mayor red conexa por las aristas que cumplen `usa` (los trozos sueltos, como un vial privado o
 *  una calle cortada por el borde de la maqueta, no llevan a ninguna parte). */
export function nodosDe(G, usa) {
  const comp = new Int32Array(G.nn).fill(-1), tam = [];
  for (let s = 0; s < G.nn; s++) {
    if (comp[s] >= 0) continue;
    const pila = [s], c = tam.length;
    comp[s] = c;
    let n = 0;
    while (pila.length) {
      const a = pila.pop();
      n++;
      for (let p = G.inicio[a]; p < G.inicio[a + 1]; p++) {
        const b = G.vecino[p];
        if (comp[b] < 0 && usa(G.arista[p])) { comp[b] = c; pila.push(b); }
      }
    }
    tam.push(n);
  }
  const mayor = tam.indexOf(Math.max(...tam));
  return Uint8Array.from(comp, (c) => (c === mayor ? 1 : 0));
}

/** Centro y celdas de cada edificio (rejilla de 4 m). */
export function centrosEdificios(D, SIM, nEd) {
  const sx = new Float64Array(nEd + 1), sz = new Float64Array(nEd + 1), c = new Uint32Array(nEd + 1);
  for (let j = 0; j < SIM.ny; j++)
    for (let i = 0; i < SIM.nx; i++) {
      const b = D.edificios[j * SIM.nx + i];
      if (!b) continue;
      sx[b] += SIM.x0 + (i + 0.5) * SIM.celda; sz[b] += SIM.z0 + (j + 0.5) * SIM.celda; c[b]++;
    }
  const lista = [];
  for (let b = 1; b <= nEd; b++) if (c[b]) lista.push({ b, x: sx[b] / c[b], z: sz[b] / c[b] });
  return lista;
}

/** Pinta las cubiertas de cada edificio con color(b) (o nada si devuelve null). */
function pintarCubiertas(ctx, color) {
  const { D, SIM } = ctx, T = ctx.capaTechos;
  T.datos.fill(0);
  for (let j = 0; j < T.ny; j++)
    for (let i = 0; i < T.nx; i++) {
      const k = j * T.nx + i;
      if (!D.techos2m[k]) continue;
      const c = color(D.edificios[(j >> 1) * SIM.nx + (i >> 1)]);
      if (c) T.datos.set(c, k * 4);
    }
  T.actualizar();
}

const ESCALA_MIN = [[3, [46, 158, 84]], [5, [160, 200, 60]], [8, [245, 190, 30]], [12, [240, 120, 30]], [Infinity, [214, 40, 57]]];
const colorMin = (min, escala = ESCALA_MIN) => (min === Infinity ? [90, 90, 90] : escala.find(([m]) => min <= m)[1]);

// ================================================================ emergencias
const herramientaEmergencias = {
  id: "emerg",
  textos: TEXTOS_RUTAS,
  crear(ctx, div) {
    const { THREE, D, SIM, t, numero, $ } = ctx;
    const G = crearGrafo(D);
    const nodoCoche = nodosDe(G, (e) => G.vel[e] > 0);
    const ACCESO = 15 / 3.6;               // del nodo a la puerta, a 15 km/h
    const bases = ctx.DATOS.equipamientos.filter((e) => e.tipo === "emergencia")
      .map((e) => ({ ...e, ...nodoCercano(G, e.x, e.z, nodoCoche) }));
    const edificios = centrosEdificios(D, SIM, ctx.DATOS.edificios)
      .map((e) => ({ ...e, ...nodoCercano(G, e.x, e.z, nodoCoche) }));
    const capa = ctx.capa4m();

    // Aristas cortadas por el agua de un escenario: algún punto del tramo (cada 4 m) con más de 30 cm
    function cortadas(fisica) {
      const c = new Uint8Array(G.na);
      if (!fisica) return c;
      for (let e = 0; e < G.na; e++) {
        const a = G.A[3 * e], b = G.A[3 * e + 1], pasos = Math.max(1, Math.ceil(G.largo[e] / 4));
        for (let s = 0; s <= pasos; s++) {
          const x = G.x[a] + (G.x[b] - G.x[a]) * s / pasos, z = G.z[a] + (G.z[b] - G.z[a]) * s / pasos;
          const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
          if (i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny && fisica[j * SIM.nx + i] * 0.02 > 0.3) { c[e] = 1; break; }
        }
      }
      return c;
    }
    const segundosCon = (corte) => (e) => (G.vel[e] && !corte[e] ? G.largo[e] / (G.vel[e] / 3.6) : Infinity);
    const calcular = (origenes, corte) => tiempos(G, origenes, segundosCon(corte));
    const minutosEdificio = (T, e) => (T[e.nodo] + e.distancia / ACCESO + 10) / 60;   // +10 s de salida

    div.innerHTML = `<b data-t="emTitulo"></b>
      <label><span data-t="emDesde"></span> <select id="emDesde"></select></label>
      <label><span data-t="emInundacion"></span> <select id="emLluvia"></select></label>
      <div class="leyenda" id="emLeyenda"></div>
      <p id="emResumen"></p><p id="emCortes"></p><p id="emPunto"></p>
      <p class="nota" data-t="emNota"></p>`;

    let estado = null, punto = null;
    function actualizar() {
      const desde = $("emDesde").value, q = +$("emLluvia").value;
      const origenes = desde === "todas" ? bases.map((b) => b.nodo) : [bases[+desde].nodo];
      const fisica = q >= 0 ? ctx.FISICA[q] : null;
      const corte = cortadas(fisica);
      const seco = calcular(origenes, new Uint8Array(G.na)), mojado = fisica ? calcular(origenes, corte) : seco;
      const min = new Map(edificios.map((e) => [e.b, minutosEdificio(mojado.t, e)]));
      estado = { q, fisica, corte, seco, mojado, min, origenes };
      // Calles: color por tiempo; cortadas en negro azulado
      const C = capa.datos;
      C.fill(0);
      for (let e = 0; e < G.na; e++) {
        if (!G.vel[e]) continue;
        const a = G.A[3 * e], b = G.A[3 * e + 1], pasos = Math.max(1, Math.ceil(G.largo[e] / 2));
        const color = corte[e] ? [20, 40, 120] : colorMin(Math.max(mojado.t[a], mojado.t[b]) / 60);
        for (let s = 0; s <= pasos; s++) {
          const x = G.x[a] + (G.x[b] - G.x[a]) * s / pasos, z = G.z[a] + (G.z[b] - G.z[a]) * s / pasos;
          const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
          if (i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny) C.set([...color, 230], (j * SIM.nx + i) * 4);
        }
      }
      capa.actualizar();
      pintarCubiertas(ctx, (b) => (min.has(b) ? [...colorMin(min.get(b)), 210] : null));
      rotulos();
      if (punto) tiempoPunto(punto.x, punto.z);
    }

    function tiempoPunto(x, z) {
      punto = { x, z };
      const { nodo, distancia } = nodoCercano(G, x, z, nodoCoche);
      const filas = bases.map((b) => {
        const r = calcular([b.nodo], estado.corte).t[nodo];
        return r === Infinity ? t("emNoLlega", b.nombre) : t("emMin", b.nombre, numero((r + distancia / ACCESO + 10) / 60, 1));
      });
      $("emPunto").innerHTML = t("emPunto", "<br>" + filas.join("<br>"));
    }

    function rotulos() {
      const desde = $("emDesde").value || "todas", lluvia = $("emLluvia").value || "-1";
      $("emDesde").innerHTML = `<option value="todas">${t("emTodos")}</option>`
        + bases.map((b, q) => `<option value="${q}">${b.nombre}</option>`).join("");
      $("emLluvia").innerHTML = `<option value="-1">${t("emSeca")}</option>`
        + ctx.INTENSIDADES.map((mmh, q) => `<option value="${q}">${t("emEscenario", mmh)}</option>`).join("");
      $("emDesde").value = desde; $("emLluvia").value = lluvia;
      $("emLeyenda").innerHTML = ESCALA_MIN.map(([m, c], q) => `<span><i style="background:rgb(${c.join(",")})"></i>${
        m === Infinity ? "> " + ESCALA_MIN[q - 1][0] : "≤ " + m} min</span>`).join("");
      if (!estado) return;
      const v = [...estado.min.values()], fin = v.filter((m) => m < Infinity);
      $("emResumen").innerHTML = t("emResumen", Math.round(100 * v.filter((m) => m <= 3).length / v.length),
        Math.round(100 * v.filter((m) => m <= 5).length / v.length), numero(Math.max(...fin), 1));
      if (estado.q >= 0 && !estado.fisica) $("emCortes").textContent = t("emSinFisica");
      else if (estado.fisica) {
        let peor = 0, sin = 0;
        for (const e of edificios) {
          const antes = minutosEdificio(estado.seco.t, e), ahora = estado.min.get(e.b);
          if (ahora === Infinity && antes < Infinity) sin++;
          else if (ahora > antes + 0.25) peor++;
        }
        $("emCortes").innerHTML = t("emCortes", ctx.INTENSIDADES[estado.q], estado.corte.reduce((a, b) => a + b, 0), numero(peor), numero(sin));
      } else $("emCortes").textContent = "";
      if (!punto) $("emPunto").textContent = t("emClic");
    }

    rotulos();
    $("emDesde").onchange = actualizar;
    $("emLluvia").onchange = actualizar;
    return {
      alMostrar() { capa.malla.visible = true; ctx.capaTechos.ver(true); actualizar(); },
      alOcultar() { capa.malla.visible = false; ctx.capaTechos.ver(false); },
      alClic(x, z) { if (estado) tiempoPunto(x, z); },
      traducir() { rotulos(); if (punto && estado) tiempoPunto(punto.x, punto.z); },
    };
  },
};

// ================================================================ ciudad de 15 minutos
const CATEGORIAS = ["educacion", "salud", "alimentacion", "juegos", "social"];
const ESCALA_PIE = [[5, [46, 158, 84]], [10, [160, 200, 60]], [15, [245, 190, 30]], [Infinity, [214, 40, 57]]];

const herramientaMinutos = {
  id: "minutos",
  textos: { es: {}, ca: {} },          // ya van en TEXTOS_RUTAS (emergencias)
  crear(ctx, div) {
    const { THREE, D, SIM, t, tx, numero, $ } = ctx;
    const G = crearGrafo(D);
    const nodoPie = nodosDe(G, (e) => G.pie[e]);
    const lugares = Object.fromEntries(CATEGORIAS.map((c) => [c, []]));
    for (const e of ctx.DATOS.equipamientos) if (lugares[e.tipo]) lugares[e.tipo].push(e);
    for (const s of ctx.DATOS.servicios) lugares[s.tipo === "farmacia" ? "salud" : s.tipo]?.push(s);
    for (const c of CATEGORIAS) for (const l of lugares[c]) Object.assign(l, nodoCercano(G, l.x, l.z, nodoPie));
    const edificios = centrosEdificios(D, SIM, ctx.DATOS.edificios).map((e) => ({ ...e, ...nodoCercano(G, e.x, e.z, nodoPie) }));
    const porId = new Map(edificios.map((e) => [e.b, e]));

    div.innerHTML = `<b data-t="miTitulo"></b>
      <label><span data-t="miVer"></span> <select id="miVer"></select></label>
      <label><span data-t="miRitmo"></span> <select id="miRitmo"><option value="1.25" data-t="miNormal"></option>
        <option value="0.83" data-t="miLento"></option></select></label>
      <div class="leyenda" id="miLeyenda"></div>
      <p id="miResumen"></p><ul id="miCats"></ul><p id="miEdificio"></p>
      <p class="nota" data-t="miNota"></p>`;

    let res = null, elegido = 0;
    function actualizar() {
      const v = +$("miRitmo").value;
      // Por categoría: tiempo en cada nodo y cuál es el lugar más cercano (el origen de su camino)
      res = {};
      for (const c of CATEGORIAS) {
        const L = lugares[c].filter((l) => l.nodo >= 0);
        const { t: T, previo } = tiempos(G, L.map((l) => l.nodo), (e) => (G.pie[e] ? G.largo[e] / v : Infinity));
        const raiz = (q) => { while (previo[q] >= 0) q = previo[q]; return q; };
        const nombreDe = new Map(L.map((l) => [l.nodo, l.nombre]));
        const min = new Map();
        for (const e of edificios) {
          const s = T[e.nodo] + e.distancia / v;
          min.set(e.b, { m: s / 60, nombre: T[e.nodo] < Infinity ? nombreDe.get(raiz(e.nodo)) || "—" : "—" });
        }
        res[c] = min;
      }
      pintar();
      rotulos();
    }
    const peor = (b) => Math.max(...CATEGORIAS.map((c) => res[c].get(b).m));
    function pintar() {
      const ver = $("miVer").value || "peor";
      pintarCubiertas(ctx, (b) => {
        if (!porId.has(b)) return null;
        const m = ver === "peor" ? peor(b) : res[ver].get(b).m;
        return [...colorMin(m, ESCALA_PIE), b === elegido ? 255 : 210];
      });
    }
    function rotulos() {
      const ver = $("miVer").value || "peor", cats = tx("cats");
      $("miVer").innerHTML = `<option value="peor">${t("miPeor")}</option>`
        + CATEGORIAS.map((c) => `<option value="${c}">${cats[c]}</option>`).join("");
      $("miVer").value = ver;
      $("miLeyenda").innerHTML = ESCALA_PIE.map(([m, c], q) => `<span><i style="background:rgb(${c.join(",")})"></i>${
        m === Infinity ? "> " + ESCALA_PIE[q - 1][0] : "≤ " + m} min</span>`).join("");
      if (!res) return;
      $("miResumen").innerHTML = t("miResumen", Math.round(100 * edificios.filter((e) => peor(e.b) <= 15).length / edificios.length));
      $("miCats").innerHTML = CATEGORIAS.map((c) => `<li>${t("miCat", cats[c],
        Math.round(100 * edificios.filter((e) => res[c].get(e.b).m <= 10).length / edificios.length))}</li>`).join("");
      $("miEdificio").innerHTML = elegido && porId.has(elegido)
        ? t("miEdificio") + "<br>" + CATEGORIAS.map((c) => {
          const r = res[c].get(elegido);
          return t("miFila", cats[c], r.m === Infinity ? "—" : numero(r.m, 0), r.nombre);
        }).join("<br>")
        : t("miClic");
    }
    rotulos();
    $("miVer").onchange = pintar;
    $("miRitmo").onchange = actualizar;
    return {
      alMostrar() { ctx.capaTechos.ver(true); if (!res) actualizar(); else pintar(); },
      alOcultar() { ctx.capaTechos.ver(false); },
      alClic(x, z, e) {
        const p = ctx.impacto(e) ?? { x, z };
        elegido = ctx.edificioEn(p.x, p.z);
        if (res) { pintar(); rotulos(); }
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaEmergencias, herramientaMinutos);
