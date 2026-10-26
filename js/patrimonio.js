// RUTA DE PATRIMONIO: un paseo por el casco antiguo con 18 paradas del inventario «Mapes de Patrimoni Cultural»
// (Diputació de Barcelona; ruta_patrimonio.py): la ruta dibujada por calles y caminos a pie (el grafo de rutas.js),
// las paradas numeradas en el mapa y un modo paseo que vuela de una a otra con su ficha (descripción e historia
// resumidas, en catalán como en el inventario, y el enlace a la ficha completa).
import { crearGrafo, tiempos, nodoCercano, nodosDe } from './rutas.js';

export const TEXTOS_PATRIMONIO = {
  es: {
    patriBoton: "🏛 Ruta de patrimonio", paTitulo: "Ruta de patrimonio",
    paResumen: "{0} paradas por el casco antiguo · {1} km a pie · unos {2} min sin contar las paradas.",
    paEmpezar: "▶ Empezar el paseo", paParada: "Parada {0} de {1}", paAnterior: "◀ Anterior", paSiguiente: "Siguiente ▶",
    paFicha: "Ficha completa", paHistoria: "Historia", paIdioma: "Texto de la ficha del inventario (en catalán).",
    paNota: "Paradas y textos: inventario «Mapes de Patrimoni Cultural» de la Diputació de Barcelona. La ruta va por " +
      "calles y caminos a pie y es la más corta entre las paradas; algunos elementos son de propiedad privada: se ven " +
      "desde la calle.",
  },
  ca: {
    patriBoton: "🏛 Ruta del patrimoni", paTitulo: "Ruta del patrimoni",
    paResumen: "{0} parades pel nucli antic · {1} km a peu · uns {2} min sense comptar les parades.",
    paEmpezar: "▶ Començar el passeig", paParada: "Parada {0} de {1}", paAnterior: "◀ Anterior", paSiguiente: "Següent ▶",
    paFicha: "Fitxa completa", paHistoria: "Història", paIdioma: "Text de la fitxa de l'inventari.",
    paNota: "Parades i textos: inventari «Mapes de Patrimoni Cultural» de la Diputació de Barcelona. La ruta va per " +
      "carrers i camins a peu i és la més curta entre les parades; alguns elements són de propietat privada: es veuen " +
      "des del carrer.",
  },
};
const VEL_PIE = 1.2;                         // m/s

const herramientaPatrimonio = {
  id: "patri",
  textos: TEXTOS_PATRIMONIO,
  crear(ctx, div) {
    const { THREE, D, t, numero, $ } = ctx;
    const R = ctx.rutaPatrimonio?.paradas;
    if (!R?.length) { div.innerHTML = `<b data-t="paTitulo"></b><p>—</p>`; return {}; }
    const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

    // ---------------------------------------------------------------- la ruta por las calles (a pie)
    const G = crearGrafo(D), aPie = (e) => G.pie[e];
    const validos = nodosDe(G, aPie);
    const nodos = R.map((p) => nodoCercano(G, p.x, p.z, validos).nodo);
    const tramos = [];                        // por tramo: lista de [x, z]
    let metros = 0;
    for (let k = 0; k + 1 < R.length; k++) {
      const { previo } = tiempos(G, [nodos[k]], (e) => (aPie(e) ? G.largo[e] : Infinity));
      const camino = [];
      for (let q = nodos[k + 1]; q >= 0; q = previo[q]) { camino.push([G.x[q], G.z[q]]); if (q === nodos[k]) break; }
      camino.reverse();
      camino.unshift([R[k].x, R[k].z]);
      camino.push([R[k + 1].x, R[k + 1].z]);
      for (let i = 1; i < camino.length; i++) metros += Math.hypot(camino[i][0] - camino[i - 1][0], camino[i][1] - camino[i - 1][1]);
      tramos.push(camino);
    }
    // Línea de puntos: un disco cada 3 m sobre el suelo (instancias), del color teja de la interfaz
    const puntos = [];
    for (const c of tramos)
      for (let i = 1; i < c.length; i++) {
        const [xa, za] = c[i - 1], [xb, zb] = c[i], L = Math.hypot(xb - xa, zb - za);
        for (let s = 0; s < L; s += 3) puntos.push([xa + (xb - xa) * s / L, za + (zb - za) * s / L]);
      }
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);
    const discos = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 8),
                                           new THREE.MeshBasicMaterial({ color: 0xb8322f }), puntos.length);
    const m = new THREE.Matrix4();
    puntos.forEach(([x, z], i) => discos.setMatrixAt(i, m.makeTranslation(x, ctx.altura(x, z) + 0.55, z)));
    grupo.add(discos);
    // Paradas numeradas
    const marcas = R.map((p, i) => {
      const d = document.createElement("div");
      d.className = "marca";
      Object.assign(d.style, { background: "#b8322f", width: "26px", height: "26px", fontSize: "12px" });
      d.textContent = i + 1;
      d.title = p.n;
      d.onclick = () => ir(i);
      const o = new ctx.CSS2DObject(d);
      o.position.set(p.x, ctx.altura(p.x, p.z) + 6, p.z);
      grupo.add(o);
      return d;
    });

    // ---------------------------------------------------------------- panel
    div.innerHTML = `<b data-t="paTitulo"></b>
      <p id="paResumen"></p>
      <div class="botones"><button id="paEmpezar" class="principal"></button></div>
      <div id="paFichaCaja" hidden><p class="subtitulo" id="paNumero"></p><h3 id="paNombre" style="margin:2px 0 4px;font-size:16px"></h3>
        <p id="paTexto" style="margin:4px 0"></p><details><summary data-t="paHistoria"></summary><p id="paHist"></p></details>
        <p style="font-size:12px;margin:6px 0"><a id="paEnlace" target="_blank" rel="noopener"></a> · <span data-t="paIdioma"></span></p>
        <div class="botones"><button id="paAnterior"></button><button id="paSiguiente" class="principal"></button></div></div>
      <ol id="paLista" style="margin:10px 0 0;padding-left:22px"></ol>
      <p class="nota" data-t="paNota"></p>`;
    let actual = -1;
    function ir(i) {
      actual = Math.max(0, Math.min(R.length - 1, i));
      const p = R[actual];
      ctx.volarA(new THREE.Vector3(p.x, 0, p.z), 0.28);
      $("paFichaCaja").hidden = false;
      $("paNumero").textContent = t("paParada", actual + 1, R.length);
      $("paNombre").textContent = p.n + (p.a ? ` (${p.a})` : "");
      $("paTexto").textContent = p.d;
      $("paHist").textContent = p.h || "—";
      Object.assign($("paEnlace"), { href: p.u, textContent: t("paFicha") });
      $("paAnterior").disabled = actual === 0;
      $("paSiguiente").disabled = actual === R.length - 1;
      marcas.forEach((d, k) => { d.style.background = k === actual ? "#16181d" : "#b8322f"; d.style.transform = k === actual ? "scale(1.25)" : ""; });
      for (const [k, li] of [...$("paLista").children].entries()) li.style.fontWeight = k === actual ? "700" : "";
    }
    function rotulos() {
      $("paResumen").textContent = t("paResumen", R.length, numero(metros / 1000, 1), Math.round(metros / VEL_PIE / 60));
      $("paEmpezar").textContent = t("paEmpezar");
      $("paAnterior").textContent = t("paAnterior");
      $("paSiguiente").textContent = t("paSiguiente");
      $("paLista").replaceChildren(...R.map((p, i) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        li.innerHTML = `${esc(p.n)} <small>${esc(p.a)}</small>`;
        li.onclick = () => ir(i);
        return li;
      }));
      if (actual >= 0) ir(actual);
    }
    $("paEmpezar").onclick = () => ir(0);
    $("paAnterior").onclick = () => ir(actual - 1);
    $("paSiguiente").onclick = () => ir(actual + 1);
    return {
      alMostrar() { grupo.visible = true; rotulos(); },
      alOcultar() { grupo.visible = false; },
      traducir: rotulos,
      enlace: () => (actual >= 0 ? { parada: actual + 1 } : {}),
      restaurar(params) { const n = +params.get("parada"); if (n >= 1) ir(n - 1); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaPatrimonio);
