// ACCESIBILIDAD DE LAS ACERAS: ancho entre bordillo y fachada (rejilla de 1 m de los bordillos del AMB) y pendiente
// (MDT del ICGC), frente a la Orden TMA/851/2021 (itinerario peatonal accesible: 1,80 m libres, pendiente ≤ 6 %).
// Y rutas accesibles: del punto que se marque a un equipamiento, evitando aceras estrechas y cuestas.
import { rejilla2m, caminosRejilla, celdaLibre } from './comun.js';

export const TEXTOS_ACCESIBILIDAD = {
  es: {
    accesBoton: "♿ Accesibilidad", acTitulo: "Accesibilidad de las aceras",
    acVer: "Ver", acAncho: "Ancho", acPendiente: "Pendiente", acPeor: "Lo peor de los dos",
    acAncho1: "≥ 3 m", acAncho2: "2–3 m", acAncho3: "< 2 m", acPend1: "≤ 6 %", acPend2: "6–8 %", acPend3: "> 8 %",
    acResumen: "Aceras: <b>{0} ha</b>. Con menos de 2 m entre bordillo y fachada: <b>{1} %</b>. Con más del 6 % de " +
      "pendiente: <b>{2} %</b> (más del 8 %: {3} %).",
    acCalles: "Calles con más acera estrecha (< 2 m)", acFila: "{0} % estrecha · {1} m²",
    acRuta: "Ruta accesible", acDestino: "Hasta", acMarcar: "📍 Marcar el origen en el mapa",
    acMarcando: "Clic en el mapa: punto de salida", acSinRuta: "No hay camino desde ese punto.",
    acResultado: "<b>{0} m</b>, unos <b>{1} min</b> a 0,8 m/s (silla de ruedas, persona mayor). Por acera estrecha: " +
      "{2} m · con pendiente > 6 %: {3} m · cruces de calzada: {4}.",
    acNota: "El ancho va de bordillo a fachada: farolas, alcorques, señales o terrazas lo reducen, así que el paso " +
      "libre real es menor. Pendiente del terreno con celdas de 4 m. No se ven escalones ni vados: orientativo.",
  },
  ca: {
    accesBoton: "♿ Accessibilitat", acTitulo: "Accessibilitat de les voreres",
    acVer: "Veure", acAncho: "Amplada", acPendiente: "Pendent", acPeor: "El pitjor dels dos",
    acAncho1: "≥ 3 m", acAncho2: "2–3 m", acAncho3: "< 2 m", acPend1: "≤ 6 %", acPend2: "6–8 %", acPend3: "> 8 %",
    acResumen: "Voreres: <b>{0} ha</b>. Amb menys de 2 m entre vorada i façana: <b>{1} %</b>. Amb més del 6 % de " +
      "pendent: <b>{2} %</b> (més del 8 %: {3} %).",
    acCalles: "Carrers amb més vorera estreta (< 2 m)", acFila: "{0} % estreta · {1} m²",
    acRuta: "Ruta accessible", acDestino: "Fins a", acMarcar: "📍 Marcar l'origen al mapa",
    acMarcando: "Clic al mapa: punt de sortida", acSinRuta: "No hi ha camí des d'aquest punt.",
    acResultado: "<b>{0} m</b>, uns <b>{1} min</b> a 0,8 m/s (cadira de rodes, persona gran). Per vorera estreta: " +
      "{2} m · amb pendent > 6 %: {3} m · encreuaments de calçada: {4}.",
    acNota: "L'amplada va de vorada a façana: fanals, escocells, senyals o terrasses la redueixen, així que el pas " +
      "lliure real és menor. Pendent del terreny amb cel·les de 4 m. No es veuen graons ni guals: orientatiu.",
  },
};

const VERDE = [46, 158, 84], AMARILLO = [245, 190, 30], ROJO = [214, 40, 57], RUTA = [156, 39, 176];

const herramientaAccesibilidad = {
  id: "acces",
  textos: TEXTOS_ACCESIBILIDAD,
  crear(ctx, div) {
    const { THREE, D, SIM, S1, t, numero, $ } = ctx;
    const R = rejilla2m(D, SIM, S1);
    const A = D.acces1m;
    const ancho1 = (p) => A[p] & 3, pend1 = (p) => (A[p] >> 2) & 3;

    // Clases por celda de 2 m: el mejor ancho (por donde se puede pasar) y la peor pendiente de sus 4 píxeles
    const ancho = new Uint8Array(R.n), pend = new Uint8Array(R.n);
    for (let k = 0; k < R.n; k++) {
      if (R.tipo[k] !== 1) continue;
      const i = k % R.nx, j = (k - i) / R.nx;
      let a = 9, p = 0;
      for (let q = 0; q < 4; q++) {
        const px = (2 * j + (q >> 1)) * S1.nx + 2 * i + (q & 1);
        if (!A[px]) continue;
        a = Math.min(a, ancho1(px)); p = Math.max(p, pend1(px));
      }
      if (a < 9) { ancho[k] = a; pend[k] = p; }
    }

    // Estadísticas (sobre los píxeles de 1 m)
    let total = 0, estrecha = 0, pend6 = 0, pend8 = 0;
    for (let p = 0; p < A.length; p++) {
      if (!A[p]) continue;
      total++; estrecha += ancho1(p) === 3; pend6 += pend1(p) >= 2; pend8 += pend1(p) === 3;
    }
    const porCalle = new Map();
    for (let k = 0; k < R.n; k++) {
      if (!ancho[k] || !R.calle[k]) continue;
      const s = porCalle.get(R.calle[k]) ?? { c: 0, e: 0, x: 0, z: 0 };
      s.c++; s.e += ancho[k] === 3; s.x += R.x(k); s.z += R.z(k);
      porCalle.set(R.calle[k], s);
    }
    const peoresCalles = [...porCalle].filter(([, s]) => s.c * 4 >= 200)
      .map(([id, s]) => ({ id, f: s.e / s.c, m2: s.c * 4, x: s.x / s.c, z: s.z / s.c }))
      .sort((a, b) => b.f - a.f).slice(0, 12);

    // ---------------------------------------------------------------- panel
    const destinos = [...ctx.DATOS.equipamientos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    div.innerHTML = `<b data-t="acTitulo"></b>
      <div><span data-t="acVer"></span>:
        <label style="display:inline"><input type="radio" name="acVer" value="ancho" checked> <span data-t="acAncho"></span></label>
        <label style="display:inline"><input type="radio" name="acVer" value="pend"> <span data-t="acPendiente"></span></label>
        <label style="display:inline"><input type="radio" name="acVer" value="peor"> <span data-t="acPeor"></span></label></div>
      <div class="leyenda" id="acLeyenda"></div>
      <p id="acResumen"></p>
      <details><summary data-t="acCalles"></summary><ol id="acCalles"></ol></details>
      <p><b data-t="acRuta"></b></p>
      <label><span data-t="acDestino"></span>
        <select id="acDestino" style="max-width:100%">${destinos.map((e, q) => `<option value="${q}">${e.nombre}</option>`).join("")}</select></label>
      <div class="botones"><button id="acMarcar"></button></div>
      <p id="acResultado"></p>
      <p class="nota" data-t="acNota"></p>`;
    $("acDestino").value = String(destinos.findIndex((e) => /Atenci. Prim.ria Pinetons/.test(e.nombre)));

    let marcando = false, ruta = null, medidas = null, arbol = null;     // ruta: celdas de 2 m
    const vista = () => div.querySelector("input[name=acVer]:checked").value;

    function pintar() {
      const C = ctx.capa1m.datos, v = vista();
      C.fill(0);
      for (let p = 0; p < A.length; p++) {
        if (!A[p]) continue;
        const a = ancho1(p), s = pend1(p);
        const clase = v === "ancho" ? a : v === "pend" ? s : Math.max(a, s);
        C.set([...[VERDE, AMARILLO, ROJO][clase - 1], 215], p * 4);
      }
      if (ruta)
        for (const k of ruta) {
          const i = k % R.nx, j = (k - i) / R.nx;
          for (let dj = -1; dj <= 2; dj++)
            for (let di = -1; di <= 2; di++) {
              const ii = 2 * i + di, jj = 2 * j + dj;
              if (ii >= 0 && jj >= 0 && ii < S1.nx && jj < S1.ny) C.set([...RUTA, 255], (jj * S1.nx + ii) * 4);
            }
        }
      ctx.capa1m.actualizar();
    }

    // Coste por metro para una silla de ruedas: acera ancha y llana 1; estrecha o en cuesta, mucho más;
    // la calzada se cruza pero no se recorre; edificios, patios privados, muros y río no se pasan (los puentes sí:
    // tienen acera o calzada encima).
    function coste(k) {
      const tp = R.tipo[k], cod = R.codigo[k];
      if (tp === 1) return [1, 1, 1.1, 2.5][ancho[k]] * [1, 1, 1.6, 4][pend[k]];
      if (tp === 2) return 4;
      if (tp === 3 || cod === 5 || cod === 7 || cod === 9) return Infinity;
      if (tp === 4) return 1.3;
      return 3;
    }

    function calcularRuta(x, z) {
      const e = destinos[+$("acDestino").value];
      ruta = medidas = null;
      // Árbol de caminos desde el destino (uno por equipamiento, se guarda): el origen se engancha a la celda
      // alcanzable más cercana al clic, así un clic en un patio cerrado o en un tejado sigue dando ruta.
      if (!arbol || arbol.e !== e) {
        const d = celdaLibre(R, e.x, e.z, (k) => R.tipo[k] === 1 || R.tipo[k] === 2 || R.tipo[k] === 4);
        arbol = d < 0 ? { e, dist: null } : { e, ...caminosRejilla(R, [d], coste) };
      }
      const o = arbol.dist ? celdaLibre(R, x, z, (k) => arbol.dist[k] < Infinity) : -1;
      if (o < 0) { $("acResultado").textContent = t("acSinRuta"); return pintar(); }
      ruta = [];
      for (let k = o; k >= 0; k = arbol.previo[k]) ruta.push(k);
      // Medidas de la ruta: largo real, tramos estrechos o en cuesta, cruces (entradas en la calzada)
      let largo = 0, estrecho = 0, cuesta = 0, cruces = 0;
      for (let q = 1; q < ruta.length; q++) {
        const a = ruta[q - 1], b = ruta[q];
        const l = Math.hypot(R.x(a) - R.x(b), R.z(a) - R.z(b));
        largo += l;
        if (R.tipo[b] === 1 && ancho[b] === 3) estrecho += l;
        if (R.tipo[b] === 1 && pend[b] >= 2) cuesta += l;
        if (R.tipo[b] === 2 && R.tipo[a] !== 2) cruces++;
      }
      medidas = [largo, estrecho, cuesta, cruces];
      rotulos();
      pintar();
    }

    function rotulos() {
      const v = vista(), caja = (c, txt) => `<span><i style="background:rgb(${c.join(",")})"></i>${t(txt)}</span>`;
      const nombres = v === "pend" ? ["acPend1", "acPend2", "acPend3"] : ["acAncho1", "acAncho2", "acAncho3"];
      $("acLeyenda").innerHTML = [VERDE, AMARILLO, ROJO].map((c, q) => caja(c, nombres[q])).join("")
        + (v === "peor" ? " · " + ["acPend1", "acPend2", "acPend3"].map((x) => t(x)).join(" / ") : "");
      $("acResumen").innerHTML = t("acResumen", numero(total / 1e4, 1), Math.round(100 * estrecha / total),
                                   Math.round(100 * pend6 / total), Math.round(100 * pend8 / total));
      $("acCalles").innerHTML = "";
      for (const c of peoresCalles) {
        const li = document.createElement("li");
        li.textContent = `${ctx.nombreCalle(c.id)} · ${t("acFila", Math.round(100 * c.f), numero(c.m2))}`;
        li.dataset.x = c.x;
        li.onclick = () => ctx.volarA(new THREE.Vector3(c.x, 0, c.z), 0.5);
        $("acCalles").appendChild(li);
      }
      if (medidas) {
        const [largo, estrecho, cuesta, cruces] = medidas;
        $("acResultado").innerHTML = t("acResultado", numero(Math.round(largo / 10) * 10), numero(Math.ceil(largo / 0.8 / 60)),
                                       numero(Math.round(estrecho)), numero(Math.round(cuesta)), cruces);
      }
      $("acMarcar").textContent = t(marcando ? "acMarcando" : "acMarcar");
      $("acMarcar").classList.toggle("principal", marcando);
    }

    for (const r of div.querySelectorAll("input[name=acVer]")) r.onchange = () => { rotulos(); pintar(); };
    $("acMarcar").onclick = () => { marcando = !marcando; rotulos(); };
    $("acDestino").onchange = () => { ruta = medidas = null; $("acResultado").textContent = ""; pintar(); };

    return {
      alMostrar() { ctx.capa1m.ver(true); rotulos(); pintar(); },
      alOcultar() { ctx.capa1m.ver(false); marcando = false; },
      alClic(x, z) {
        if (!marcando) return;
        marcando = false;
        rotulos();
        calcularRuta(x, z);
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaAccesibilidad);
