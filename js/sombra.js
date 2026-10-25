// SOMBRA Y CALOR: sol y sombra en las aceras para un día y una hora, horas de sol del día, escuelas y calles con
// menos sombra, posibles refugios climáticos y «¿y si plantamos árboles?». Rejilla de 2 m: edificios del Catastro,
// relieve fino y copas de los árboles de OSM. Cielo despejado: es un cálculo geométrico, orientativo.
import { rejilla2m, relieve2m } from './comun.js';

const LAT = 41.5025, LON = 2.15525;           // centro de la maqueta
const PASO = 2;                               // m por celda
const ALCANCE = 60;                           // celdas (120 m): más lejos, una sombra casi no cambia el resultado

export const TEXTOS_SOMBRA = {
  es: {
    sombraBoton: "🌳 Sombra y calor", sbTitulo: "Sombra y calor", sbFecha: "Día", sbHora: "Hora: <b>{0}</b>",
    sbModoAhora: "Sol y sombra a esa hora", sbModoHoras: "Horas de sol del día (7–21 h)",
    sbSol: "Sol a {0}° de altura, desde el {1}", sbNoche: "El sol está bajo el horizonte",
    sbCalculando: "Calculando sombras… {0} %",
    sbResumenAhora: "<b>{0} %</b> de las aceras en sombra · plazas y parques: {1} %",
    sbResumenHoras: "Las aceras reciben de media <b>{0} h</b> de sol; el {1} % más de 8 h",
    sbEscuelas: "Escuelas: aceras a menos de 100 m", sbCalles: "Calles con menos sombra en la acera",
    sbFilaAhora: "{0} % en sombra", sbFilaHoras: "{0} h de sol",
    sbRefugios: "Posibles refugios climáticos",
    sbRefugiosTexto: "Equipamientos públicos cubiertos (biblioteca, centros cívicos, casales, centro de día). El " +
      "<b>{0} %</b> de los edificios está a menos de 300 m en línea recta (≈ 5 min a pie) de alguno.",
    sbVerLejos: "Marcar en rojo los edificios a más de 300 m",
    sbPlantar: "🌱 ¿Y si plantamos árboles?", sbPlantando: "Clic en el mapa para plantar · aquí para terminar",
    sbQuitar: "Quitar los nuevos", sbEfecto: "Acera de {0}: {1} → <b>{2}</b> ({3} árboles nuevos)",
    sbSombra: "Sombra", sbSolL: "Sol", sbHorasL: "h de sol",
    sbNota: "Sombras de los edificios (Catastro), el relieve (ICGC) y las copas de los árboles (OSM), con cielo " +
      "despejado. Los árboles que no están en OSM no cuentan. Orientativo.",
    sbRumbos: ["norte", "nordeste", "este", "sudeste", "sur", "sudoeste", "oeste", "noroeste"],
  },
  ca: {
    sombraBoton: "🌳 Ombra i calor", sbTitulo: "Ombra i calor", sbFecha: "Dia", sbHora: "Hora: <b>{0}</b>",
    sbModoAhora: "Sol i ombra a aquesta hora", sbModoHoras: "Hores de sol del dia (7–21 h)",
    sbSol: "Sol a {0}° d'altura, des del {1}", sbNoche: "El sol és sota l'horitzó",
    sbCalculando: "Calculant ombres… {0} %",
    sbResumenAhora: "<b>{0} %</b> de les voreres a l'ombra · places i parcs: {1} %",
    sbResumenHoras: "Les voreres reben de mitjana <b>{0} h</b> de sol; el {1} % més de 8 h",
    sbEscuelas: "Escoles: voreres a menys de 100 m", sbCalles: "Carrers amb menys ombra a la vorera",
    sbFilaAhora: "{0} % a l'ombra", sbFilaHoras: "{0} h de sol",
    sbRefugios: "Possibles refugis climàtics",
    sbRefugiosTexto: "Equipaments públics coberts (biblioteca, centres cívics, casals, centre de dia). El " +
      "<b>{0} %</b> dels edificis és a menys de 300 m en línia recta (≈ 5 min a peu) d'algun.",
    sbVerLejos: "Marcar en vermell els edificis a més de 300 m",
    sbPlantar: "🌱 I si hi plantem arbres?", sbPlantando: "Clic al mapa per plantar · aquí per acabar",
    sbQuitar: "Treure els nous", sbEfecto: "Vorera de {0}: {1} → <b>{2}</b> ({3} arbres nous)",
    sbSombra: "Ombra", sbSolL: "Sol", sbHorasL: "h de sol",
    sbNota: "Ombres dels edificis (Cadastre), el relleu (ICGC) i les capçades dels arbres (OSM), amb cel serè. " +
      "Els arbres que no són a OSM no hi compten. Orientatiu.",
    sbRumbos: ["nord", "nord-est", "est", "sud-est", "sud", "sud-oest", "oest", "nord-oest"],
  },
};

/** Hora oficial de España peninsular: +2 del último domingo de marzo al último de octubre, +1 el resto. */
function husoHorario(fecha) {
  const y = fecha.getUTCFullYear();
  const ultimoDomingo = (mes) => { const d = new Date(Date.UTC(y, mes + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
  const m = fecha.getUTCMonth(), dia = fecha.getUTCDate();
  if (m > 2 && m < 9) return 2;
  if (m === 2) return dia >= ultimoDomingo(2) ? 2 : 1;
  if (m === 9) return dia < ultimoDomingo(9) ? 2 : 1;
  return 1;
}

/** Posición del sol (aproximación de la NOAA): elevación y azimut (desde el norte, horario), en radianes. */
export function posicionSol(fecha, horaLocal, lat = LAT, lon = LON) {
  const huso = husoHorario(fecha);
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 1);
  const dia = Math.floor((fecha.getTime() - inicio) / 864e5) + 1;
  const g = (2 * Math.PI / 365) * (dia - 1 + (horaLocal - huso - 12) / 24);
  const ecTiempo = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
                             - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
             + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = horaLocal * 60 + ecTiempo + 4 * lon - 60 * huso;
  const h = ((tst / 4) - 180) * Math.PI / 180, phi = lat * Math.PI / 180;
  const sinE = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(h);
  const azimut = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  return { elevacion: Math.asin(sinE), azimut };
}

const herramientaSombra = {
  id: "sombra",
  textos: TEXTOS_SOMBRA,
  crear(ctx, div) {
    const { THREE, D, SIM, S1, altura, t, tx, numero, $ } = ctx;
    const nx = S1.nx / 2, ny = S1.ny / 2, n = nx * ny;

    // ---------------------------------------------------------------- rejillas de 2 m
    const { tipo, calle } = rejilla2m(D, SIM, S1);   // 0 nada · 1 acera · 2 calzada · 3 edificio · 4 plaza o parque
    const { suelo } = relieve2m(D, SIM, S1, altura), ocluye = relieve2m(D, SIM, S1, altura).ocluye.slice();
    const copa = new Uint8Array(n);        // bajo una copa: sombra mientras haya sol
    const plantarCopa = (x, z, r, cima, base = ocluye) => {
      const ci = (x - SIM.x0) / PASO, cj = (z - SIM.z0) / PASO, rc = r / PASO;
      for (let j = Math.floor(cj - rc); j <= Math.ceil(cj + rc); j++)
        for (let i = Math.floor(ci - rc); i <= Math.ceil(ci + rc); i++) {
          if (i < 0 || j < 0 || i >= nx || j >= ny || (i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > rc * rc) continue;
          base[j * nx + i] = Math.max(base[j * nx + i], cima);
          copa[j * nx + i] = 1;
        }
    };
    {
      const A = D.arboles;
      for (let k = 0; k < A.length / 5; k++) {
        const x = A[k * 5] / 10, z = A[k * 5 + 1] / 10, tipoA = ctx.DATOS.tiposArbol[A[k * 5 + 2]];
        const r = A[k * 5 + 3] / 100, alto = A[k * 5 + 4] / 100, y = altura(x, z);
        if (tipoA === "arbusto") continue;
        const cima = ctx.DATOS.arbolesReales ? y + alto                    // altura total medida (LiDAR)
          : tipoA === "pino" || tipoA.startsWith("cono") ? y + 1.5 + alto : y + 1.6 + 2 * r;
        plantarCopa(x, z, Math.max(r, 1), cima);
      }
    }
    let maxOcluye = 0;
    for (let k = 0; k < n; k++) if (ocluye[k] > maxOcluye) maxOcluye = ocluye[k];
    const receptores = [];
    for (let k = 0; k < n; k++) if (tipo[k] === 1 || tipo[k] === 2 || tipo[k] === 4) receptores.push(k);
    const RECEPTORES = Uint32Array.from(receptores);

    // ---------------------------------------------------------------- sombra de un sol
    /** Marca con 1 las celdas receptoras al sol (Uint8 por celda). Por trozos, para no congelar la página. */
    async function soleadas(sol, salida, cancelado) {
      const di = Math.sin(sol.azimut), dj = -Math.cos(sol.azimut), subida = Math.tan(sol.elevacion) * PASO;
      const offI = new Int32Array(ALCANCE + 1), offJ = new Int32Array(ALCANCE + 1);
      for (let s = 1; s <= ALCANCE; s++) { offI[s] = Math.round(s * di); offJ[s] = Math.round(s * dj); }
      const TROZO = 40000;
      for (let a = 0; a < RECEPTORES.length; a += TROZO) {
        for (let r = a; r < Math.min(a + TROZO, RECEPTORES.length); r++) {
          const k = RECEPTORES[r];
          if (copa[k]) { salida[k] = 0; continue; }
          const i = k % nx, j = (k - i) / nx, h0 = suelo[k] + 0.5;
          const pasos = Math.min(ALCANCE, Math.ceil((maxOcluye - h0) / subida));
          let luz = 1;
          for (let s = 1; s <= pasos; s++) {
            const ii = i + offI[s], jj = j + offJ[s];
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) break;
            if (ocluye[jj * nx + ii] > h0 + s * subida) { luz = 0; break; }
          }
          salida[k] = luz;
        }
        await new Promise((r) => setTimeout(r));
        if (cancelado()) return false;
      }
      return true;
    }

    // ---------------------------------------------------------------- panel
    const anio = new Date().getFullYear();
    div.innerHTML = `<b data-t="sbTitulo"></b>
      <label><span data-t="sbFecha"></span> <input type="date" id="sbFecha" value="${anio}-07-15"></label>
      <label><span id="sbHoraT"></span><br><input type="range" id="sbHora" min="6" max="21.5" step="0.25" value="17" style="width:100%"></label>
      <div id="sbSolT" class="nota"></div>
      <label><input type="radio" name="sbModo" value="ahora" checked> <span data-t="sbModoAhora"></span></label>
      <label><input type="radio" name="sbModo" value="horas"> <span data-t="sbModoHoras"></span></label>
      <div class="leyenda" id="sbLeyenda"></div>
      <p id="sbResumen"></p>
      <details open><summary data-t="sbEscuelas"></summary><ol id="sbEscuelas"></ol></details>
      <details><summary data-t="sbCalles"></summary><ol id="sbCalles"></ol></details>
      <details><summary data-t="sbRefugios"></summary><p id="sbRefugiosT"></p>
        <label><input type="checkbox" id="sbLejos"> <span data-t="sbVerLejos"></span></label><ul id="sbRefugios"></ul></details>
      <div class="botones"><button id="sbPlantar"></button><button id="sbQuitar" data-t="sbQuitar"></button></div>
      <p id="sbEfecto"></p>
      <p class="nota" data-t="sbNota"></p>`;

    const fecha = () => new Date($("sbFecha").value + "T12:00:00Z");
    const hora = () => +$("sbHora").value;
    const modo = () => div.querySelector("input[name=sbModo]:checked").value;
    const reloj = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
    let abierto = false, plantando = false, version = 0, ultimo = null;   // ultimo: resultado mostrado
    const nuevos = [];                     // árboles plantados: { x, z }
    const grupoNuevos = new THREE.Group();
    grupoNuevos.visible = false;
    ctx.scene.add(grupoNuevos);

    // Luz del sol de la escena: la misma que el cálculo (las sombras 3D cuadran con el mapa)
    function moverSol() {
      const s = posicionSol(fecha(), hora());
      if (s.elevacion <= 0) { $("sbSolT").textContent = t("sbNoche"); return; }
      const R = Math.hypot(D.terreno.lx, D.terreno.ly);
      const dir = new THREE.Vector3(Math.sin(s.azimut) * Math.cos(s.elevacion), Math.sin(s.elevacion),
                                    -Math.cos(s.azimut) * Math.cos(s.elevacion));
      ctx.sol.target.position.set(0, 0, 0);
      ctx.sol.position.copy(dir.multiplyScalar(R));
      ctx.sol.shadow.camera.far = 3 * R;
      ctx.sol.shadow.camera.updateProjectionMatrix();
      const rumbo = tx("sbRumbos")[Math.round(s.azimut / (Math.PI / 4)) % 8];
      $("sbSolT").textContent = t("sbSol", Math.round(s.elevacion * 180 / Math.PI), rumbo);
    }

    // Colores (sRGB) de la capa de 1 m
    const SOMBRA = [59, 91, 219], SOL = [255, 183, 3];
    const RAMPA = [[0, [44, 79, 158]], [3, [63, 167, 196]], [6, [155, 211, 106]], [9, [255, 210, 63]], [12, [232, 89, 12]]];
    const colorHoras = (h) => {
      for (let r = 1; r < RAMPA.length; r++)
        if (h <= RAMPA[r][0]) {
          const [h0, c0] = RAMPA[r - 1], [h1, c1] = RAMPA[r], f = (h - h0) / (h1 - h0);
          return c0.map((v, q) => v + (c1[q] - v) * f);
        }
      return RAMPA[RAMPA.length - 1][1];
    };

    function leyenda() {
      const caja = (c, txt) => `<span><i style="background:rgb(${c.join(",")})"></i>${txt}</span>`;
      $("sbLeyenda").innerHTML = modo() === "ahora" ? caja(SOMBRA, t("sbSombra")) + caja(SOL, t("sbSolL"))
        : RAMPA.map(([h, c]) => caja(c.map(Math.round), `${h}${h === 12 ? "+" : ""} ${t("sbHorasL")}`)).join("");
    }

    /** valor por celda: 0/1 (al sol) en modo «ahora», horas de sol en modo «horas». */
    function pintar(valor, esHoras) {
      const C = ctx.capa1m.datos;
      C.fill(0);
      for (const k of RECEPTORES) {
        const v = valor[k];
        const c = esHoras ? colorHoras(v) : v ? SOL : SOMBRA;
        const alfa = (tipo[k] === 1 ? 0.75 : tipo[k] === 4 ? 0.55 : 0.3) * 255;
        const i = k % nx, j = (k - i) / nx;
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const p = ((2 * j + dj) * S1.nx + 2 * i + di) * 4;
          if (D.suelo1m[p / 4] === 3) continue;
          C[p] = c[0]; C[p + 1] = c[1]; C[p + 2] = c[2]; C[p + 3] = alfa;
        }
      }
      ctx.capa1m.actualizar();
    }

    /** Calcula el modo elegido; devuelve { valor, esHoras } o null si se canceló. */
    async function calcular() {
      const mio = ++version, cancelado = () => mio !== version, esHoras = modo() === "horas";
      const valor = new Float32Array(n), luz = new Uint8Array(n);
      const soles = esHoras ? Array.from({ length: 14 }, (_, q) => posicionSol(fecha(), 7.5 + q))
                            : [posicionSol(fecha(), hora())];
      const conSol = soles.filter((s) => s.elevacion > 0.05);    // > 3°: antes, la luz apenas calienta
      for (const [q, s] of conSol.entries()) {
        $("sbResumen").textContent = t("sbCalculando", Math.round(100 * q / conSol.length));
        if (!(await soleadas(s, luz, cancelado))) return null;
        for (const k of RECEPTORES) valor[k] += luz[k];
      }
      return { valor, esHoras, hayDia: conSol.length > 0 };
    }

    // Estadísticas de un resultado
    const media = (r, filtro) => {
      let s = 0, c = 0;
      for (const k of RECEPTORES) if (filtro(k)) { s += r.valor[k]; c++; }
      return c ? s / c : 0;
    };
    const enRadio = (x, z, radio) => (k) => {
      if (tipo[k] !== 1) return false;
      const i = k % nx, j = (k - i) / nx;
      return (SIM.x0 + (i + 0.5) * PASO - x) ** 2 + (SIM.z0 + (j + 0.5) * PASO - z) ** 2 < radio * radio;
    };
    const textoFila = (r, m) => (r.esHoras ? t("sbFilaHoras", numero(m, 1)) : t("sbFilaAhora", Math.round(100 * (1 - m))));

    function listas(r) {
      if (!r.hayDia) { $("sbResumen").textContent = t("sbNoche"); return; }
      if (r.esHoras) {
        let mas8 = 0, c = 0;
        for (const k of RECEPTORES) if (tipo[k] === 1) { c++; mas8 += r.valor[k] > 8; }
        $("sbResumen").innerHTML = t("sbResumenHoras", numero(media(r, (k) => tipo[k] === 1), 1), Math.round(100 * mas8 / c));
      } else
        $("sbResumen").innerHTML = t("sbResumenAhora", Math.round(100 * (1 - media(r, (k) => tipo[k] === 1))),
                                     Math.round(100 * (1 - media(r, (k) => tipo[k] === 4))));
      // Escuelas: las de menos sombra (o más horas de sol) primero
      const escuelas = ctx.DATOS.equipamientos.filter((e) => e.tipo === "educacion")
        .map((e) => ({ e, m: media(r, enRadio(e.x, e.z, 100)) })).sort((a, b) => b.m - a.m);
      $("sbEscuelas").innerHTML = "";
      for (const { e, m } of escuelas) fila($("sbEscuelas"), `${e.nombre} · ${textoFila(r, m)}`, e.x, e.z);
      // Calles: suma por calle de las celdas de acera (≥ 200 m² de acera)
      const suma = new Map();
      for (const k of RECEPTORES) {
        if (tipo[k] !== 1 || !calle[k]) continue;
        const s = suma.get(calle[k]) ?? { v: 0, c: 0, x: 0, z: 0 };
        const i = k % nx, j = (k - i) / nx;
        s.v += r.valor[k]; s.c++; s.x += SIM.x0 + (i + 0.5) * PASO; s.z += SIM.z0 + (j + 0.5) * PASO;
        suma.set(calle[k], s);
      }
      const calles = [...suma].filter(([, s]) => s.c * PASO * PASO >= 200)
        .map(([id, s]) => ({ id, m: s.v / s.c, x: s.x / s.c, z: s.z / s.c })).sort((a, b) => b.m - a.m).slice(0, 12);
      $("sbCalles").innerHTML = "";
      for (const c of calles) fila($("sbCalles"), `${ctx.nombreCalle(c.id)} · ${textoFila(r, c.m)}`, c.x, c.z);
    }
    function fila(lista, texto, x, z) {
      const li = document.createElement("li");
      li.textContent = texto;
      li.dataset.x = x;
      li.onclick = () => ctx.volarA(new THREE.Vector3(x, 0, z), 0.6);
      lista.appendChild(li);
    }

    async function actualizar() {
      leyenda();
      moverSol();
      const r = await calcular();
      if (!r || !abierto) return;
      ultimo = r;
      pintar(r.valor, r.esHoras);
      listas(r);
    }

    // ---------------------------------------------------------------- refugios climáticos
    const REFUGIO = /bibliot|c[ií]vic|casal|centre de dia|centre obert/i;
    const refugios = ctx.DATOS.equipamientos.filter((e) => e.tipo === "social" && REFUGIO.test(e.nombre));
    const centro = new Float64Array(ctx.DATOS.edificios * 3);           // suma x, suma z, celdas
    for (let j = 0; j < SIM.ny; j++)
      for (let i = 0; i < SIM.nx; i++) {
        const id = D.edificios[j * SIM.nx + i];
        if (!id) continue;
        centro[(id - 1) * 3] += SIM.x0 + (i + 0.5) * SIM.celda;
        centro[(id - 1) * 3 + 1] += SIM.z0 + (j + 0.5) * SIM.celda;
        centro[(id - 1) * 3 + 2]++;
      }
    const lejos = new Uint8Array(ctx.DATOS.edificios + 1);
    let conEdificio = 0, cerca = 0;
    for (let b = 0; b < ctx.DATOS.edificios; b++) {
      const c = centro[b * 3 + 2];
      if (!c) continue;
      const x = centro[b * 3] / c, z = centro[b * 3 + 1] / c;
      conEdificio++;
      if (refugios.some((e) => (e.x - x) ** 2 + (e.z - z) ** 2 < 300 * 300)) cerca++;
      else lejos[b + 1] = 1;
    }
    const marcas = new THREE.Group();
    marcas.visible = false;
    ctx.scene.add(marcas);
    for (const e of refugios) {
      const d = document.createElement("div");
      d.className = "etiqueta";
      d.textContent = "❄️ " + e.nombre;
      const o = new ctx.CSS2DObject(d);
      o.position.set(e.x, altura(e.x, e.z) + 12, e.z);
      marcas.add(o);
    }
    function pintarLejos() {
      const C = ctx.capaTechos.datos;
      C.fill(0);
      if ($("sbLejos").checked)
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++) {
            const k = j * nx + i;
            if (!D.techos2m[k] || !lejos[D.edificios[(j >> 1) * SIM.nx + (i >> 1)]]) continue;
            C.set([230, 57, 70, 200], k * 4);
          }
      ctx.capaTechos.actualizar();
      ctx.capaTechos.ver($("sbLejos").checked);
    }
    $("sbLejos").onchange = pintarLejos;

    // ---------------------------------------------------------------- ¿y si plantamos árboles?
    const geoCopa = new THREE.IcosahedronGeometry(3, 1), geoTronco = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5);
    const matCopa = new THREE.MeshStandardMaterial({ color: 0x3fae5a, flatShading: true });
    const matTronco = new THREE.MeshStandardMaterial({ color: 0x7a4e2d, flatShading: true });
    $("sbPlantar").onclick = () => { plantando = !plantando; rotulos(); };
    $("sbQuitar").onclick = () => {
      if (!nuevos.length) return;
      // Se rehace la rejilla de oclusión sin los árboles nuevos: se vuelven a plantar solo los de OSM
      nuevos.length = 0;
      grupoNuevos.clear();
      $("sbEfecto").textContent = "";
      quitarNuevos();
      actualizar();
    };
    const ocluyeBase = ocluye.slice(), copaBase = copa.slice();
    const quitarNuevos = () => { ocluye.set(ocluyeBase); copa.set(copaBase); };

    async function plantar(x, z) {
      const y = altura(x, z);
      nuevos.push({ x, z });
      const tronco = new THREE.Mesh(geoTronco, matTronco), c = new THREE.Mesh(geoCopa, matCopa);
      tronco.position.set(x, y + 1.2, z);
      c.position.set(x, y + 1.6 + 3, z);
      tronco.castShadow = c.castShadow = true;
      grupoNuevos.add(tronco, c);
      const antes = ultimo;
      plantarCopa(x, z, 3, y + 1.6 + 6);
      maxOcluye = Math.max(maxOcluye, y + 7.6);
      await actualizar();
      if (!antes || !ultimo || antes.esHoras !== ultimo.esHoras) return;
      // Efecto en la acera de esa calle (o en 50 m a la redonda si no hay calle)
      const id = D.calles[Math.floor((z - SIM.z0) / SIM.celda) * SIM.nx + Math.floor((x - SIM.x0) / SIM.celda)];
      const filtro = (k) => tipo[k] === 1 && (id ? calle[k] === id : enRadio(x, z, 50)(k));
      $("sbEfecto").innerHTML = t("sbEfecto", id ? ctx.nombreCalle(id) : "50 m", textoFila(antes, media(antes, filtro)),
                                  textoFila(ultimo, media(ultimo, filtro)), nuevos.length);
    }

    function rotulos() {
      $("sbHoraT").innerHTML = t("sbHora", reloj(hora()));
      $("sbPlantar").textContent = t(plantando ? "sbPlantando" : "sbPlantar");
      $("sbPlantar").classList.toggle("principal", plantando);
      $("sbRefugiosT").innerHTML = t("sbRefugiosTexto", Math.round(100 * cerca / conEdificio));
      $("sbRefugios").innerHTML = "";
      for (const e of refugios) fila($("sbRefugios"), e.nombre, e.x, e.z);
      leyenda();
    }

    $("sbHora").oninput = () => { rotulos(); moverSol(); };
    $("sbHora").onchange = actualizar;
    $("sbFecha").onchange = actualizar;
    for (const r of div.querySelectorAll("input[name=sbModo]")) r.onchange = actualizar;

    return {
      alMostrar() {
        abierto = true;
        grupoNuevos.visible = marcas.visible = true;
        ctx.capa1m.ver(true);
        rotulos();
        pintarLejos();
        actualizar();
      },
      alOcultar() {
        abierto = false;
        version++;                          // cancela un cálculo a medias
        plantando = false;
        grupoNuevos.visible = marcas.visible = false;
        ctx.capa1m.ver(false);
        ctx.capaTechos.ver(false);
        ctx.sombrasMapa();
      },
      alClic(x, z) { if (plantando) plantar(x, z); },
      traducir() { rotulos(); moverSol(); if (ultimo) listas(ultimo); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaSombra);
