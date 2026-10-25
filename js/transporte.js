// TRANSPORTE PÚBLICO: los autobuses que pasan por la maqueta (GTFS de la AMB y de la Generalitat): trazado de cada
// línea, paradas con sus próximos buses según la hora (la del tiempo real) y cobertura: a cuántos minutos a pie
// queda cada edificio de una parada, y de una parada «frecuente» (4 buses o más por hora a primera hora).
import { crearGrafo, tiempos, nodoCercano, nodosDe, centrosEdificios } from './rutas.js';

export const TEXTOS_TRANSPORTE = {
  es: {
    transporteBoton: "🚌 Transporte público", tpTitulo: "Autobuses", tpVer: "Cubiertas",
    tpCualquiera: "Minutos a pie a una parada", tpFrecuente: "Minutos a pie a una parada frecuente (≥ 4 buses/h)",
    tpNada: "Sin colorear",
    tpResumen: "{0} paradas y {1} líneas. Viviendas a 5 min o menos a pie de una parada: <b>{2} %</b>; de una parada " +
      "frecuente: <b>{3} %</b>.",
    tpLineas: "Líneas (clic para resaltar)", tpParada: "<b>{0}</b> · {1} buses en la próxima hora",
    tpProximos: "Próximos ({0}):", tpNinguno: "No pasa ningún bus en las próximas 2 horas.", tpEnMin: "en {0} min",
    tpClic: "Clic en una parada 🚏 para ver los próximos buses.",
    tpDias: { laborable: "laborable", sabado: "sábado", domingo: "domingo y festivo" },
    tpNota: "Horarios de un {0} de referencia ({1}) de los GTFS de la AMB y de la Generalitat (autobuses interurbanos); " +
      "los festivos entre semana no se distinguen. Ripollet no tiene estación de tren dentro de la maqueta. Caminando " +
      "por calles de OSM a 4,5 km/h.",
  },
  ca: {
    transporteBoton: "🚌 Transport públic", tpTitulo: "Autobusos", tpVer: "Cobertes",
    tpCualquiera: "Minuts a peu a una parada", tpFrecuente: "Minuts a peu a una parada freqüent (≥ 4 busos/h)",
    tpNada: "Sense pintar",
    tpResumen: "{0} parades i {1} línies. Habitatges a 5 min o menys a peu d'una parada: <b>{2} %</b>; d'una parada " +
      "freqüent: <b>{3} %</b>.",
    tpLineas: "Línies (clic per ressaltar)", tpParada: "<b>{0}</b> · {1} busos en la propera hora",
    tpProximos: "Propers ({0}):", tpNinguno: "No passa cap bus en les properes 2 hores.", tpEnMin: "en {0} min",
    tpClic: "Clic en una parada 🚏 per veure els propers busos.",
    tpDias: { laborable: "feiner", sabado: "dissabte", domingo: "diumenge i festiu" },
    tpNota: "Horaris d'un {0} de referència ({1}) dels GTFS de l'AMB i de la Generalitat (autobusos interurbans); els " +
      "festius entre setmana no es distingeixen. Ripollet no té estació de tren dins de la maqueta. Caminant per " +
      "carrers d'OSM a 4,5 km/h.",
  },
};

const ESCALA_TP = [[3, [46, 158, 84]], [5, [160, 200, 60]], [10, [245, 190, 30]], [Infinity, [214, 40, 57]]];
const PIE = 1.25;                       // m/s

const herramientaTransporte = {
  id: "transporte",
  textos: TEXTOS_TRANSPORTE,
  crear(ctx, div) {
    const { THREE, D, SIM, t, tx, numero, $ } = ctx;
    const T = ctx.transporte;
    if (!T) { div.innerHTML = `<b data-t="tpTitulo"></b><p>—</p>`; return {}; }
    const tipoDia = () => { const d = ctx.hora().fecha.getUTCDay(); return d === 0 ? "domingo" : d === 6 ? "sabado" : "laborable"; };
    const reloj = (m) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, "0")}`;

    // ---------------------------------------------------------------- trazados (cintas de 2,5 m) y paradas
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);
    const dentroMapa = (x, z) => x > SIM.x0 + 2 && z > SIM.z0 + 2 && x < SIM.x0 + SIM.nx * SIM.celda - 2 && z < SIM.z0 + SIM.ny * SIM.celda - 2;
    const cintas = T.lineas.map((l, q) => {
      const pos = [];
      const desvio = (q - T.lineas.length / 2) * 0.45;      // separa un poco las líneas que van juntas
      for (const tr of l.trazos ?? [])
        for (let k = 0; k < tr.length - 1; k++) {
          const [x1, z1] = tr[k], [x2, z2] = tr[k + 1], L = Math.hypot(x2 - x1, z2 - z1) || 1;
          if (!dentroMapa(x1, z1) || !dentroMapa(x2, z2)) continue;          // nada fuera de la maqueta
          const nx = -(z2 - z1) / L, nz = (x2 - x1) / L, a = desvio - 1.2, b = desvio + 1.2;
          const y1 = ctx.altura(x1, z1) + 1.2, y2 = ctx.altura(x2, z2) + 1.2;
          pos.push(x1 + nx * a, y1, z1 + nz * a, x2 + nx * a, y2, z2 + nz * a, x2 + nx * b, y2, z2 + nz * b,
                   x1 + nx * a, y1, z1 + nz * a, x2 + nx * b, y2, z2 + nz * b, x1 + nx * b, y1, z1 + nz * b);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: l.color, side: THREE.DoubleSide, transparent: true,
                                                                  opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -3 }));
      m.renderOrder = 2;
      grupo.add(m);
      return m;
    });
    let parada = -1, linea = -1;
    T.paradas.forEach((p, q) => {
      const d = document.createElement("div");
      d.className = "marca";
      Object.assign(d.style, { background: "#fff", color: "#1d2230", border: "2px solid #1d2230", width: "22px", height: "22px", fontSize: "12px" });
      d.textContent = "🚏";
      d.title = p.n;
      d.onclick = () => elegir(q);
      const o = new ctx.CSS2DObject(d);
      o.position.set(p.x, ctx.altura(p.x, p.z) + 5, p.z);
      grupo.add(o);
    });

    // ---------------------------------------------------------------- cobertura a pie
    const G = crearGrafo(D), nodoPie = nodosDe(G, (e) => G.pie[e]);
    const porHora = (p, h) => p.s.laborable.filter(([m]) => m >= h * 60 && m < (h + 1) * 60).length;
    const frecuentes = T.paradas.filter((p) => porHora(p, 8) >= 4 || porHora(p, 7) >= 4);
    const minutos = (lista) => {
      const { t: tt } = tiempos(G, lista.map((p) => nodoCercano(G, p.x, p.z, nodoPie).nodo), (e) => (G.pie[e] ? G.largo[e] / PIE : Infinity));
      const r = new Map();
      for (const e of centrosEdificios(D, SIM, ctx.DATOS.edificios)) {
        const { nodo, distancia } = nodoCercano(G, e.x, e.z, nodoPie);
        r.set(e.b, (tt[nodo] + distancia / PIE) / 60);
      }
      return r;
    };
    const aCualquiera = minutos(T.paradas), aFrecuente = frecuentes.length ? minutos(frecuentes) : new Map();
    const viviendas = (b) => (ctx.rehab ? ctx.rehab[(b - 1) * 5 + 1] : 1);
    const pct = (mapa) => {
      let tot = 0, ok = 0;
      for (const [b, m] of aCualquiera) { const v = viviendas(b); tot += v; if ((mapa.get(b) ?? Infinity) <= 5) ok += v; }
      return Math.round(100 * ok / Math.max(1, tot));
    };
    const resumen = [pct(aCualquiera), pct(aFrecuente)];

    div.innerHTML = `<b data-t="tpTitulo"></b>
      <label><span data-t="tpVer"></span> <select id="tpVer"></select></label>
      <div class="leyenda" id="tpLeyenda"></div>
      <p id="tpResumen"></p><p id="tpParada"></p>
      <details open><summary data-t="tpLineas"></summary><div class="botones" id="tpLineas"></div></details>
      <p class="nota" id="tpNota"></p>`;
    const ver = () => $("tpVer").value || "cualquiera";

    function pintar() {
      const v = ver(), C = ctx.capaTechos;
      C.datos.fill(0);
      if (v !== "nada") {
        const mapa = v === "frecuente" ? aFrecuente : aCualquiera;
        for (let j = 0; j < C.ny; j++)
          for (let i = 0; i < C.nx; i++) {
            const k = j * C.nx + i;
            if (!D.techos2m[k]) continue;
            const b = D.edificios[(j >> 1) * SIM.nx + (i >> 1)];
            if (!b || !mapa.has(b) && v !== "frecuente") continue;
            const m = mapa.get(b) ?? Infinity;
            C.datos.set([...ESCALA_TP.find(([lim]) => m <= lim)[1], 210], k * 4);
          }
      }
      C.actualizar();
      C.ver(v !== "nada");
      cintas.forEach((c, q) => { c.material.opacity = linea < 0 || linea === q ? 0.85 : 0.12; });
    }

    function elegir(q, volar = true) {
      parada = q;
      const p = T.paradas[q], dia = tipoDia(), { hora } = ctx.hora(), ahora = Math.floor(hora * 60);
      const prox = p.s[dia].filter(([m]) => m >= ahora && m < ahora + 120);
      const chip = (l) => `<span style="background:${T.lineas[l].color};color:#fff;border-radius:3px;padding:0 4px">${T.lineas[l].ref}</span>`;
      $("tpParada").innerHTML = t("tpParada", p.n, prox.filter(([m]) => m < ahora + 60).length) + " " + p.l.map(chip).join(" ") +
        "<br>" + (prox.length ? t("tpProximos", tx("tpDias")[dia]) + "<br>" +
          prox.slice(0, 6).map(([m, l]) => `${chip(l)} ${reloj(m)} · ${t("tpEnMin", m - ahora)}`).join("<br>") : t("tpNinguno"));
      if (volar) ctx.volarA(new THREE.Vector3(p.x, 0, p.z), 0.3);
    }

    function rotulos() {
      const v = ver();
      $("tpVer").innerHTML = [["cualquiera", "tpCualquiera"], ["frecuente", "tpFrecuente"], ["nada", "tpNada"]]
        .map(([k, txt]) => `<option value="${k}">${t(txt)}</option>`).join("");
      $("tpVer").value = v;
      $("tpLeyenda").innerHTML = ESCALA_TP.map(([m, c], q) => `<span><i style="background:rgb(${c.join(",")})"></i>${
        m === Infinity ? "> " + ESCALA_TP[q - 1][0] : "≤ " + m} min</span>`).join("");
      $("tpResumen").innerHTML = t("tpResumen", T.paradas.length, T.lineas.length, resumen[0], resumen[1]);
      $("tpLineas").replaceChildren(...T.lineas.map((l, q) => {
        const b = document.createElement("button");
        b.textContent = l.ref;
        b.title = l.nombre;
        Object.assign(b.style, { background: l.color, color: "#fff", border: "0", outline: linea === q ? "2px solid #000" : "" });
        b.onclick = () => { linea = linea === q ? -1 : q; rotulos(); pintar(); };
        return b;
      }));
      const d = tipoDia();
      $("tpNota").textContent = t("tpNota", tx("tpDias")[d], T.dias?.[d] ?? "");
      if (parada >= 0) elegir(parada, false); else $("tpParada").textContent = t("tpClic");
    }
    $("tpVer").onchange = pintar;

    return {
      alMostrar() { grupo.visible = true; rotulos(); pintar(); },
      alOcultar() { grupo.visible = false; ctx.capaTechos.ver(false); },
      alClic(x, z) {        // la parada más cercana al clic, a menos de 30 m
        let mejor = -1, dm = 30 * 30;
        T.paradas.forEach((p, q) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < dm) { dm = d; mejor = q; } });
        if (mejor >= 0) elegir(mejor);
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaTransporte);
