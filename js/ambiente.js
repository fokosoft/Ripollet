// RUIDO Y CALIDAD DEL AIRE.
// Ruido: (1) zonificación acústica oficial (mapa de capacidad acústica de la Generalitat) con sus objetivos
// (Decret 176/2009); (2) ruido del tráfico ESTIMADO con un modelo sencillo: cada tramo emite según su tráfico por hora
// (estimado por tipo de vía, el mismo del tráfico del visor) y su velocidad, se atenúa con la distancia como una
// fuente lineal y pierde 10 dB si un edificio tapa; (3) edificios cuya fachada supera el objetivo de su zona.
// No sustituye a un mapa de ruido medido o calculado con un modelo oficial (CNOSSOS): sirve para ver dónde mirar.
// Aire: en directo, el modelo europeo CAMS (Open-Meteo) para Ripollet y las estaciones de la XVPCA más cercanas.
import { crearGrafo } from './rutas.js';
import { imdEstimada, LABORABLE } from './trafico.js';

export const TEXTOS_AMBIENTE = {
  es: {
    ambienteBoton: "🔊 Ruido y aire", amTitulo: "Ruido y calidad del aire", amVer: "Ver",
    amLd: "Ruido de tráfico de día (Ld, estimado)", amLn: "Ruido de tráfico de noche (Ln, estimado)",
    amZonas: "Zonas acústicas (objetivos oficiales)", amSupera: "Superación del objetivo de noche",
    amCalculando: "Calculando el ruido… {0} %", amEncima: "Por encima del objetivo de noche de su zona",
    amResumen: "Edificios con la fachada por encima del objetivo de su zona: <b>{0}</b> de día y <b>{1}</b> de noche " +
      "({2} viviendas de noche).", amCalles: "Calles con más edificios por encima de noche",
    amFila: "{0}: {1} edificios ({2} viv.)", amZona: "Zona {0} ({1}): objetivo {2} dB de día, {3} dB de noche",
    amPunto: "Aquí: ≈ {0} dB de día y {1} dB de noche (estimado).", amClic: "Clic en el mapa para ver el ruido de un punto.",
    amAire: "Aire ahora", amAireModelo: "Modelo CAMS para Ripollet (Open-Meteo): índice europeo <b>{0}</b> ({1}) · PM2,5 " +
      "{2} · PM10 {3} · NO₂ {4} · O₃ {5} µg/m³", amEstaciones: "Estaciones de la Generalitat más cercanas (último dato)",
    amEstacion: "{0} ({1} km): {2}", amSinAire: "Sin datos del aire (¿sin internet?).", amCargando: "consultando…",
    amOms: "Guía OMS 2021 (24 h): PM2,5 15 · PM10 45 · NO₂ 25 µg/m³.",
    amIndices: ["bueno", "razonable", "moderado", "malo", "muy malo", "extremadamente malo"],
    amNota: "Ruido estimado: emisión ≈ 40 + 10·log(vehículos/h) + 25·log(velocidad/50) dB a 10 m, atenuación de fuente " +
      "lineal y −10 dB si tapa un edificio; tráfico estimado por tipo de vía. Orientativo: el mapa estratégico oficial " +
      "no cubre Ripollet. Zonas: mapa de capacidad acústica (Generalitat). La estación de Ripollet cerró en 1999.",
  },
  ca: {
    ambienteBoton: "🔊 Soroll i aire", amTitulo: "Soroll i qualitat de l'aire", amVer: "Veure",
    amLd: "Soroll de trànsit de dia (Ld, estimat)", amLn: "Soroll de trànsit de nit (Ln, estimat)",
    amZonas: "Zones acústiques (objectius oficials)", amSupera: "Superació de l'objectiu de nit",
    amCalculando: "Calculant el soroll… {0} %", amEncima: "Per sobre de l'objectiu de nit de la seva zona",
    amResumen: "Edificis amb la façana per sobre de l'objectiu de la seva zona: <b>{0}</b> de dia i <b>{1}</b> de nit " +
      "({2} habitatges de nit).", amCalles: "Carrers amb més edificis per sobre de nit",
    amFila: "{0}: {1} edificis ({2} hab.)", amZona: "Zona {0} ({1}): objectiu {2} dB de dia, {3} dB de nit",
    amPunto: "Aquí: ≈ {0} dB de dia i {1} dB de nit (estimat).", amClic: "Clic al mapa per veure el soroll d'un punt.",
    amAire: "Aire ara", amAireModelo: "Model CAMS per a Ripollet (Open-Meteo): índex europeu <b>{0}</b> ({1}) · PM2,5 " +
      "{2} · PM10 {3} · NO₂ {4} · O₃ {5} µg/m³", amEstaciones: "Estacions de la Generalitat més properes (última dada)",
    amEstacion: "{0} ({1} km): {2}", amSinAire: "Sense dades de l'aire (sense internet?).", amCargando: "consultant…",
    amOms: "Guia OMS 2021 (24 h): PM2,5 15 · PM10 45 · NO₂ 25 µg/m³.",
    amIndices: ["bo", "raonable", "moderat", "dolent", "molt dolent", "extremadament dolent"],
    amNota: "Soroll estimat: emissió ≈ 40 + 10·log(vehicles/h) + 25·log(velocitat/50) dB a 10 m, atenuació de font " +
      "lineal i −10 dB si tapa un edifici; trànsit estimat per tipus de via. Orientatiu: el mapa estratègic oficial no " +
      "cobreix Ripollet. Zones: mapa de capacitat acústica (Generalitat). L'estació de Ripollet va tancar el 1999.",
  },
};

const RAMPA_DB = [[50, [46, 158, 84]], [55, [155, 211, 106]], [60, [242, 227, 76]], [65, [244, 162, 58]],
                  [70, [232, 89, 12]], [75, [201, 42, 42]], [Infinity, [123, 31, 162]]];
const colorDb = (db) => RAMPA_DB.find(([l]) => db < l)[1];
const COLOR_ZONA = { Alta: [46, 158, 84], Moderada: [245, 190, 30], Baixa: [214, 40, 57] };
const ESTACIONES = [["08252006", "Barberà del Vallès", 41.512684, 2.1253984], ["08125002", "Montcada i Reixac", 41.48197, 2.1882975],
                    ["08260010", "Santa Perpètua de Mogoda", 41.526722, 2.1838], ["08125013", "Montcada (Can Sant Joan)", 41.469826, 2.1842353]];

const herramientaAmbiente = {
  id: "ambiente",
  textos: TEXTOS_AMBIENTE,
  crear(ctx, div) {
    const { THREE, D, SIM, t, tx, numero, $ } = ctx;
    const ZA = ctx.DATOS.zonasAcusticas?.lista ?? [], Z4 = ctx.acustica4m;
    const capa = ctx.capa4m();
    const nx = SIM.nx, ny = SIM.ny, n = nx * ny, c = SIM.celda;
    const ld = new Float32Array(n).fill(NaN), lnoche = new Float32Array(n).fill(NaN);
    let listo = false;

    // ---------------------------------------------------------------- fuentes: tramos de coche dentro de la maqueta
    const G = crearGrafo(D);
    const suma = LABORABLE.reduce((a, b) => a + b, 0);
    const pDia = LABORABLE.slice(7, 21).reduce((a, b) => a + b, 0) / 14 / suma;
    const pNoche = [23, 0, 1, 2, 3, 4, 5, 6].reduce((a, h) => a + LABORABLE[h], 0) / 8 / suma;
    const dentro = (x, z) => x > SIM.x0 && z > SIM.z0 && x < SIM.x0 + nx * c && z < SIM.z0 + ny * c;
    const fuentes = [];        // trozos de ≤ 16 m: x1 z1 x2 z2, nivel a 10 m de día y de noche
    for (let e = 0; e < G.na; e++) {
      if (!G.vel[e]) continue;
      const a = G.A[3 * e], b = G.A[3 * e + 1];
      if (!dentro(G.x[a], G.z[a]) || !dentro(G.x[b], G.z[b])) continue;
      const xm = (G.x[a] + G.x[b]) / 2, zm = (G.z[a] + G.z[b]) / 2;
      const i = Math.floor((xm - SIM.x0) / c), j = Math.floor((zm - SIM.z0) / c), id = D.calles[j * nx + i];
      const imd = imdEstimada(G.vel[e], id ? ctx.DATOS.calles[id - 1] : null);
      const corr = 25 * Math.log10(Math.max(G.vel[e], 20) / 50);
      const l10d = 40 + 10 * Math.log10(Math.max(imd * pDia, 0.5)) + corr, l10n = 40 + 10 * Math.log10(Math.max(imd * pNoche, 0.2)) + corr;
      const trozos = Math.max(1, Math.ceil(G.largo[e] / 16));
      for (let k = 0; k < trozos; k++)
        fuentes.push([G.x[a] + (G.x[b] - G.x[a]) * k / trozos, G.z[a] + (G.z[b] - G.z[a]) * k / trozos,
                      G.x[a] + (G.x[b] - G.x[a]) * (k + 1) / trozos, G.z[a] + (G.z[b] - G.z[a]) * (k + 1) / trozos, l10d, l10n]);
    }
    // Cubos de 64 m para buscar solo las fuentes cercanas (150 m)
    const CUBO = 64, cx = Math.ceil(nx * c / CUBO), cz = Math.ceil(ny * c / CUBO), cubos = Array.from({ length: cx * cz }, () => []);
    fuentes.forEach((f, q) => {
      const i = Math.floor(((f[0] + f[2]) / 2 - SIM.x0) / CUBO), j = Math.floor(((f[1] + f[3]) / 2 - SIM.z0) / CUBO);
      if (i >= 0 && j >= 0 && i < cx && j < cz) cubos[j * cx + i].push(q);
    });
    const edificio = (x, z) => {
      const i = Math.floor((x - SIM.x0) / c), j = Math.floor((z - SIM.z0) / c);
      return i >= 0 && j >= 0 && i < nx && j < ny ? D.edificios[j * nx + i] : 0;
    };

    /** Ld y Ln en (x, z): suma de energía de los trozos a ≤ 150 m (fuente lineal finita + pantalla de edificios). */
    function nivel(x, z, propio) {
      let ed = 0, en = 0;
      const ci = Math.floor((x - SIM.x0) / CUBO), cj = Math.floor((z - SIM.z0) / CUBO);
      for (let dj = -3; dj <= 3; dj++)
        for (let di = -3; di <= 3; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= cx || j >= cz) continue;
          for (const q of cubos[j * cx + i]) {
            const [x1, z1, x2, z2, l10d, l10n] = fuentes[q];
            const ax = x1 - x, az = z1 - z, bx = x2 - x, bz = z2 - z;
            const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
            const tt = Math.max(0, Math.min(1, -(ax * dx + az * dz) / l2));
            const px = ax + dx * tt, pz = az + dz * tt, d = Math.max(Math.hypot(px, pz), 5);
            if (d > 150) continue;
            const ang = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));      // ángulo que abarca el trozo
            let g = (ang / Math.PI) * (10 / d);
            if (g < 1e-4) continue;
            // Pantalla: algún edificio (que no sea el propio) entre el punto y el trozo
            for (let s = 6; s < d - 3; s += 6) {
              const b = edificio(x + px * s / d, z + pz * s / d);
              if (b && b !== propio) { g *= 0.1; break; }
            }
            ed += g * 10 ** (l10d / 10); en += g * 10 ** (l10n / 10);
          }
        }
      return [ed > 0 ? 10 * Math.log10(ed) : 30, en > 0 ? 10 * Math.log10(en) : 25];
    }

    // Mapa a 8 m (una celda de cada 2 × 2) y fachadas: cada edificio, el máximo de las celdas libres que lo tocan
    const nEd = ctx.DATOS.edificios, fachadaD = new Float32Array(nEd + 1), fachadaN = new Float32Array(nEd + 1);
    async function calcular() {
      const filas = Math.ceil(ny / 2);
      for (let jj = 0; jj < filas; jj++) {
        for (let ii = 0; ii < Math.ceil(nx / 2); ii++) {
          const i = 2 * ii, j = 2 * jj, k = j * nx + i;
          if (D.edificios[k]) continue;
          const [a, b] = nivel(SIM.x0 + (i + 1) * c, SIM.z0 + (j + 1) * c, 0);
          for (const q of [k, k + 1, k + nx, k + nx + 1]) if (q < n && !D.edificios[q]) { ld[q] = a; lnoche[q] = b; }
          // Edificios vecinos (a ≤ 1 celda): esta es su fachada
          for (let dj = -1; dj <= 2; dj++)
            for (let di = -1; di <= 2; di++) {
              const ia = i + di, ja = j + dj;
              if (ia < 0 || ja < 0 || ia >= nx || ja >= ny) continue;
              const e = D.edificios[ja * nx + ia];
              if (e) { fachadaD[e] = Math.max(fachadaD[e], a); fachadaN[e] = Math.max(fachadaN[e], b); }
            }
        }
        if (jj % 12 === 0) {
          $("amEstado").textContent = t("amCalculando", Math.round(100 * jj / filas));
          await new Promise((r) => setTimeout(r));
        }
      }
      listo = true;
      $("amEstado").textContent = "";
      resumen();
      pintar();
    }

    // Objetivo de cada edificio: el de la zona de su primera celda
    const zonaEd = new Uint8Array(nEd + 1), celdaEd = new Int32Array(nEd + 1).fill(-1);
    for (let k = 0; k < n; k++) {
      const e = D.edificios[k];
      if (!e || celdaEd[e] >= 0) continue;
      celdaEd[e] = k;
      if (Z4) zonaEd[e] = Z4[k];
    }
    const viviendas = (e) => (ctx.rehab ? ctx.rehab[(e - 1) * 5 + 1] : 0);
    let peores = [], cuenta = [0, 0, 0];
    function resumen() {
      const porCalle = new Map();
      cuenta = [0, 0, 0];
      for (let e = 1; e <= nEd; e++) {
        const z = ZA[zonaEd[e] - 1];
        if (!z || !fachadaD[e]) continue;
        if (fachadaD[e] > z.ld) cuenta[0]++;
        if (fachadaN[e] > z.ln) {
          cuenta[1]++; cuenta[2] += viviendas(e);
          const k = celdaEd[e], id = k >= 0 ? D.calles[k] : 0;      // la calle de la celda del edificio
          const s = porCalle.get(id) ?? { n: 0, v: 0, k };
          s.n++; s.v += viviendas(e); porCalle.set(id, s);
        }
      }
      peores = [...porCalle].filter(([id]) => id).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
      rotulos();
    }

    // ---------------------------------------------------------------- pintura
    const ver = () => $("amVer").value || "ln";
    function pintar() {
      const C = capa.datos, v = ver();
      C.fill(0);
      for (let k = 0; k < n; k++) {
        if (v === "zonas") {
          const z = Z4 && ZA[Z4[k] - 1];
          if (z) C.set([...COLOR_ZONA[z.zona] ?? [150, 150, 150], 110], k * 4);
          continue;
        }
        if (!listo || Number.isNaN(ld[k])) continue;
        if (v === "supera") {
          const z = Z4 && ZA[Z4[k] - 1];
          const exceso = z ? lnoche[k] - z.ln : NaN;
          if (exceso > 0) C.set([214, 40, 57, Math.round(80 + 15 * Math.min(10, exceso))], k * 4);
        } else C.set([...colorDb(v === "ld" ? ld[k] : lnoche[k]), 150], k * 4);
      }
      capa.actualizar();
      // Cubiertas de los edificios por encima del objetivo (de noche) en granate
      const T = ctx.capaTechos;
      T.datos.fill(0);
      if (listo && v !== "zonas")
        for (let j = 0; j < T.ny; j++)
          for (let i = 0; i < T.nx; i++) {
            const k = j * T.nx + i;
            if (!D.techos2m[k]) continue;
            const e = D.edificios[(j >> 1) * nx + (i >> 1)], z = ZA[zonaEd[e] - 1];
            if (z && fachadaN[e] > z.ln) T.datos.set([120, 0, 40, 200], k * 4);
          }
      T.actualizar();
    }

    // ---------------------------------------------------------------- aire (en directo)
    let aire = null, estaciones = null, errorAire = false;
    async function consultarAire() {
      try {
        const r = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=41.5025&longitude=2.1553" +
          "&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=Europe%2FMadrid");
        aire = (await r.json()).current;
      } catch { errorAire = true; }
      try {
        const desde = new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10);
        const q = new URLSearchParams({ $where: `codi_eoi in(${ESTACIONES.map((e) => `'${e[0]}'`).join(",")}) AND data>='${desde}' ` +
          `AND contaminant in('NO2','PM10','O3')`, $limit: "500", $order: "data DESC" });
        const filas = await (await fetch("https://analisi.transparenciacatalunya.cat/resource/tasf-thgu.json?" + q)).json();
        estaciones = ESTACIONES.map(([codi, nombre, la, lo]) => {
          const ultimo = {};
          for (const f of filas.filter((f) => f.codi_eoi === codi)) {
            if (ultimo[f.contaminant]) continue;
            for (let h = 24; h >= 1; h--) {
              const v = f["h" + String(h).padStart(2, "0")];
              if (v !== undefined && v !== "") { ultimo[f.contaminant] = [+v, `${f.data.slice(8, 10)}/${f.data.slice(5, 7)} ${h}h`]; break; }
            }
          }
          return { nombre, km: Math.hypot((la - 41.5025) * 110.574, (lo - 2.15525) * 83.4), ultimo };
        });
      } catch { errorAire = true; }
      rotulos();
    }

    // ---------------------------------------------------------------- panel
    div.innerHTML = `<b data-t="amTitulo"></b>
      <label><span data-t="amVer"></span> <select id="amVer"></select></label>
      <div class="leyenda" id="amLeyenda"></div><p class="nota" id="amEstado"></p>
      <p id="amResumen"></p><p id="amPunto"></p>
      <details><summary data-t="amCalles"></summary><ol id="amCalles"></ol></details>
      <p><b data-t="amAire"></b></p><p id="amAire"></p><p id="amEstaciones" class="nota"></p><p class="nota" data-t="amOms"></p>
      <p class="nota" data-t="amNota"></p>`;
    function rotulos() {
      const v = ver();
      $("amVer").innerHTML = [["ln", "amLn"], ["ld", "amLd"], ["supera", "amSupera"], ["zonas", "amZonas"]]
        .map(([k, x]) => `<option value="${k}">${t(x)}</option>`).join("");
      $("amVer").value = v;
      const caja = (col, txt) => `<span><i style="background:rgb(${col.join(",")})"></i>${txt}</span>`;
      $("amLeyenda").innerHTML = v === "zonas"
        ? Object.entries(COLOR_ZONA).map(([z, col]) => caja(col, { Alta: "A (60/50)", Moderada: "B (65/55)", Baixa: "C (70/60)" }[z])).join("")
        : v === "supera" ? caja([214, 40, 57], t("amEncima"))
        : RAMPA_DB.map(([l, col], q) => caja(col, l === Infinity ? `≥ ${RAMPA_DB[q - 1][0]}` : `< ${l}`)).join("") + " dB(A)";
      if (listo) $("amResumen").innerHTML = t("amResumen", numero(cuenta[0]), numero(cuenta[1]), numero(cuenta[2]));
      $("amCalles").replaceChildren(...peores.map(([id, s]) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        li.textContent = t("amFila", ctx.nombreCalle(id), s.n, s.v);
        const i = s.k % nx, j = (s.k - i) / nx;
        li.onclick = () => ctx.volarA(new THREE.Vector3(SIM.x0 + (i + 0.5) * c, 0, SIM.z0 + (j + 0.5) * c), 0.45);
        return li;
      }));
      if (!$("amPunto").innerHTML) $("amPunto").textContent = t("amClic");
      const idx = (a) => tx("amIndices")[a < 20 ? 0 : a < 40 ? 1 : a < 60 ? 2 : a < 80 ? 3 : a < 100 ? 4 : 5];
      $("amAire").innerHTML = aire ? t("amAireModelo", Math.round(aire.european_aqi), idx(aire.european_aqi), numero(aire.pm2_5, 0),
        numero(aire.pm10, 0), numero(aire.nitrogen_dioxide, 0), numero(aire.ozone, 0)) : t(errorAire ? "amSinAire" : "amCargando");
      $("amEstaciones").innerHTML = estaciones ? `${t("amEstaciones")}:<br>` + estaciones.map((e) => t("amEstacion", e.nombre,
        numero(e.km, 1), Object.entries(e.ultimo).map(([k, [val, cuando]]) => `${k.replace("NO2", "NO₂").replace("O3", "O₃")} ${val} µg/m³ (${cuando})`)
          .join(" · ") || "—")).join("<br>") : "";
    }
    $("amVer").onchange = () => { rotulos(); pintar(); };

    let empezado = false;
    return {
      alMostrar() {
        capa.malla.visible = true;
        ctx.capaTechos.ver(true);
        rotulos();
        pintar();
        if (!empezado) { empezado = true; calcular(); consultarAire(); }
      },
      alOcultar() { capa.malla.visible = false; ctx.capaTechos.ver(false); },
      alClic(x, z) {
        const [a, b] = nivel(x, z, edificio(x, z));
        const i = Math.floor((x - SIM.x0) / c), j = Math.floor((z - SIM.z0) / c);
        const zona = Z4 && i >= 0 && j >= 0 && i < nx && j < ny ? ZA[Z4[j * nx + i] - 1] : null;
        $("amPunto").innerHTML = t("amPunto", Math.round(a), Math.round(b)) +
          (zona ? "<br>" + t("amZona", zona.usos, zona.zona, zona.ld, zona.ln) : "");
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaAmbiente);
