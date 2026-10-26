// NUEVOS PROYECTOS: colocar un edificio (planta rectangular, plantas, giro) y ver qué cambia: la sombra que echa
// sobre calles, plazas y vecinos a lo largo del día, qué pasa con la lluvia en ese suelo y con qué choca.
import { rejilla2m, relieve2m } from './comun.js';
import { posicionSol } from './sombra.js';
import { calificacionEn, familiaMUC } from './planeamiento.js';

export const TEXTOS_PROYECTOS = {
  es: {
    proyBoton: "🏗 Nuevos proyectos", prTitulo: "Probar un edificio nuevo",
    prAncho: "Ancho: <b>{0} m</b>", prFondo: "Fondo: <b>{0} m</b>", prPlantas: "Plantas: <b>{0}</b> ({1} m)",
    prGiro: "Giro: <b>{0}°</b>", prColocar: "📍 Colocar (clic en el mapa)", prColocando: "Clic donde va el edificio",
    prQuitar: "Quitar", prLista: "Proyecto {0}: {1} × {2} m, {3} plantas",
    prDia: "Sombra el día", prDias: ["21 de diciembre", "21 de marzo", "21 de junio"], prHora: "Hora: <b>{0}</b>",
    prSombra: "<b>Sombra nueva</b> el {0}: {1} m² de calle, acera y plaza a las {2}; en todo el día (8–18 h), " +
      "{3} m²·h. Cubiertas vecinas que pierden sol a esa hora: {4}.",
    prLluvia: "<b>Lluvia</b>: la huella ({0} m²) pasa a ser cubierta: con {1} mm/h escurren {2} m³ más en una hora " +
      "(antes se infiltraban). Agua simulada en ese suelo: {3}.",
    prSeco: "seco en todos los escenarios", prAgua: "{0} mm/h → {1} cm",
    prChoques: "<b>Choques</b>: {0}", prPlan: "<b>Planeamiento</b>: pisa {0}.", prPlanAviso: " ⚠️ Parte cae en suelo público no edificable ({0}).", prNada: "ninguno; el edificio más cercano está a {0} m.",
    prConEdificios: "pisa {0} m² de edificios existentes", prCalzada: "{0} m² de calzada", prAcera: "{0} m² de acera",
    prArboles: "{0} árboles de OSM", prCerca: "el edificio más cercano está a {0} m",
    prNota: "Sombra geométrica con cielo despejado; lluvia con la infiltración de cada suelo y los escenarios ya " +
      "simulados (no se vuelve a simular con el edificio). El coche ya choca con él. Orientativo.",
  },
  ca: {
    proyBoton: "🏗 Nous projectes", prTitulo: "Provar un edifici nou",
    prAncho: "Amplada: <b>{0} m</b>", prFondo: "Fons: <b>{0} m</b>", prPlantas: "Plantes: <b>{0}</b> ({1} m)",
    prGiro: "Gir: <b>{0}°</b>", prColocar: "📍 Col·locar (clic al mapa)", prColocando: "Clic on va l'edifici",
    prQuitar: "Treure", prLista: "Projecte {0}: {1} × {2} m, {3} plantes",
    prDia: "Ombra el dia", prDias: ["21 de desembre", "21 de març", "21 de juny"], prHora: "Hora: <b>{0}</b>",
    prSombra: "<b>Ombra nova</b> el {0}: {1} m² de carrer, vorera i plaça a les {2}; en tot el dia (8–18 h), " +
      "{3} m²·h. Cobertes veïnes que perden sol a aquesta hora: {4}.",
    prLluvia: "<b>Pluja</b>: la petjada ({0} m²) passa a ser coberta: amb {1} mm/h escolen {2} m³ més en una hora " +
      "(abans s'infiltraven). Aigua simulada en aquest sòl: {3}.",
    prSeco: "sec en tots els escenaris", prAgua: "{0} mm/h → {1} cm",
    prChoques: "<b>Xocs</b>: {0}", prPlan: "<b>Planejament</b>: trepitja {0}.", prPlanAviso: " ⚠️ Una part cau en sòl públic no edificable ({0}).", prNada: "cap; l'edifici més proper és a {0} m.",
    prConEdificios: "trepitja {0} m² d'edificis existents", prCalzada: "{0} m² de calçada", prAcera: "{0} m² de vorera",
    prArboles: "{0} arbres d'OSM", prCerca: "l'edifici més proper és a {0} m",
    prNota: "Ombra geomètrica amb cel serè; pluja amb la infiltració de cada sòl i els escenaris ja simulats (no es " +
      "torna a simular amb l'edifici). El cotxe ja hi xoca. Orientatiu.",
  },
};

const RADIO = 150;          // m alrededor del proyecto donde se mira la sombra
const DIAS = ["12-21", "03-21", "06-21"];

const herramientaProyectos = {
  id: "proy",
  textos: TEXTOS_PROYECTOS,
  crear(ctx, div) {
    const { THREE, D, SIM, S1, altura, t, tx, numero, $ } = ctx;
    const R = rejilla2m(D, SIM, S1), { suelo, ocluye: base } = relieve2m(D, SIM, S1, altura);
    const { nx, ny } = R;
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);
    const material = new THREE.MeshStandardMaterial({ color: 0xf4a261, emissive: 0x552200, emissiveIntensity: 0.25, flatShading: true });
    const proyectos = [];   // { n, x, z, ancho, fondo, plantas, giro, malla, huella1m: [[p, valorOriginal]] }
    let colocando = false, elegido = null, contador = 0;

    div.innerHTML = `<b data-t="prTitulo"></b>
      <label><span id="prAnchoT"></span><input type="range" id="prAncho" min="6" max="80" value="20" style="width:100%"></label>
      <label><span id="prFondoT"></span><input type="range" id="prFondo" min="6" max="80" value="14" style="width:100%"></label>
      <label><span id="prPlantasT"></span><input type="range" id="prPlantas" min="1" max="16" value="5" style="width:100%"></label>
      <label><span id="prGiroT"></span><input type="range" id="prGiro" min="0" max="175" step="5" value="0" style="width:100%"></label>
      <div class="botones"><button id="prColocar"></button></div>
      <ul id="prLista"></ul>
      <label><span data-t="prDia"></span> <select id="prDia"></select></label>
      <label><span id="prHoraT"></span><input type="range" id="prHora" min="8" max="18" step="1" value="12" style="width:100%"></label>
      <p id="prSombra"></p><p id="prLluvia"></p><p id="prChoques"></p><p id="prPlan"></p>
      <p class="nota" data-t="prNota"></p>`;
    const val = (id) => +$(id).value;
    const altoDe = (plantas) => 4 + (plantas - 1) * 3 + 0.6;   // como los del Catastro en la maqueta

    /** ¿(x, z) dentro de la planta del proyecto? */
    const dentro = (p, x, z) => {
      const c = Math.cos(p.giro), s = Math.sin(p.giro), dx = x - p.x, dz = z - p.z;
      return Math.abs(dx * c - dz * s) <= p.ancho / 2 && Math.abs(dx * s + dz * c) <= p.fondo / 2;
    };
    const radioDe = (p) => Math.hypot(p.ancho, p.fondo) / 2;

    function construir(p) {
      if (p.malla) grupo.remove(p.malla);
      for (const [q, v] of p.huella1m ?? []) D.suelo1m[q] = v;          // deshace la huella anterior
      const y = altura(p.x, p.z);
      p.alto = altoDe(p.plantas);
      p.cota = y + p.alto;
      p.malla = new THREE.Mesh(new THREE.BoxGeometry(p.ancho, p.alto + 2, p.fondo), material);
      p.malla.position.set(p.x, y - 1 + (p.alto + 2) / 2, p.z);
      p.malla.rotation.y = p.giro;
      p.malla.castShadow = p.malla.receiveShadow = true;
      grupo.add(p.malla);
      // Huella de 1 m: lo que había (para los choques y para deshacer) y 3 = edificio, para que el coche choque
      p.huella1m = [];
      const r = radioDe(p);
      for (let j = Math.floor(p.z - r - SIM.z0); j <= Math.ceil(p.z + r - SIM.z0); j++)
        for (let i = Math.floor(p.x - r - SIM.x0); i <= Math.ceil(p.x + r - SIM.x0); i++) {
          if (i < 0 || j < 0 || i >= S1.nx || j >= S1.ny || !dentro(p, SIM.x0 + i + 0.5, SIM.z0 + j + 0.5)) continue;
          const q = j * S1.nx + i;
          p.huella1m.push([q, D.suelo1m[q]]);
          D.suelo1m[q] = 3;
        }
    }

    // ---------------------------------------------------------------- sombra nueva (rejilla de 2 m, zona cercana)
    function soleadas(sol, ocl, i0, i1, j0, j1, salida) {
      const di = Math.sin(sol.azimut), dj = -Math.cos(sol.azimut), subida = Math.tan(sol.elevacion) * 2;
      const pasosMax = Math.ceil(80 / 2);
      for (let j = j0; j < j1; j++)
        for (let i = i0; i < i1; i++) {
          const k = j * nx + i, h0 = (R.tipo[k] === 3 ? ocl[k] : suelo[k]) + 0.5;
          let luz = 1;
          for (let s = 1; s <= pasosMax; s++) {
            const ii = i + Math.round(s * di), jj = j + Math.round(s * dj);
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) break;
            if (ocl[jj * nx + ii] > h0 + s * subida) { luz = 0; break; }
          }
          salida[k] = luz;
        }
    }
    function analizarSombra(p) {
      const ocl = base.slice();
      for (const q of proyectos) {             // todos los proyectos tapan
        const r = radioDe(q);
        for (let j = Math.floor((q.z - r - SIM.z0) / 2); j <= Math.ceil((q.z + r - SIM.z0) / 2); j++)
          for (let i = Math.floor((q.x - r - SIM.x0) / 2); i <= Math.ceil((q.x + r - SIM.x0) / 2); i++)
            if (i >= 0 && j >= 0 && i < nx && j < ny && dentro(q, R.x(j * nx + i), R.z(j * nx + i)))
              ocl[j * nx + i] = Math.max(ocl[j * nx + i], q.cota);
      }
      const i0 = Math.max(0, Math.floor((p.x - RADIO - SIM.x0) / 2)), i1 = Math.min(nx, Math.ceil((p.x + RADIO - SIM.x0) / 2));
      const j0 = Math.max(0, Math.floor((p.z - RADIO - SIM.z0) / 2)), j1 = Math.min(ny, Math.ceil((p.z + RADIO - SIM.z0) / 2));
      const fecha = new Date(`${new Date().getFullYear()}-${DIAS[val("prDia")]}T12:00:00Z`);
      const antes = new Uint8Array(R.n), despues = new Uint8Array(R.n), nueva = new Uint8Array(R.n);
      let m2h = 0, m2hora = 0;
      const techosHora = new Set();
      for (let h = 8; h <= 18; h++) {
        const sol = posicionSol(fecha, h);
        if (sol.elevacion <= 0.03) continue;
        soleadas(sol, base, i0, i1, j0, j1, antes);
        soleadas(sol, ocl, i0, i1, j0, j1, despues);
        for (let j = j0; j < j1; j++)
          for (let i = i0; i < i1; i++) {
            const k = j * nx + i;
            if (!antes[k] || despues[k] || dentro(p, R.x(k), R.z(k))) continue;
            const publico = R.tipo[k] === 1 || R.tipo[k] === 2 || R.tipo[k] === 4;
            if (publico) m2h += 4;
            if (h === val("prHora")) {
              nueva[k] = 1;
              if (publico) m2hora += 4;
              if (R.tipo[k] === 3) techosHora.add(D.edificios[(j >> 1) * SIM.nx + (i >> 1)]);
            }
          }
      }
      // Pinta la sombra nueva en la capa de 1 m (morado)
      const C = ctx.capa1m.datos;
      C.fill(0);
      for (let k = 0; k < R.n; k++) {
        if (!nueva[k]) continue;
        const i = k % nx, j = (k - i) / nx;
        for (let q = 0; q < 4; q++) C.set([123, 44, 191, 200], ((2 * j + (q >> 1)) * S1.nx + 2 * i + (q & 1)) * 4);
      }
      ctx.capa1m.actualizar();
      techosHora.delete(0);
      return [tx("prDias")[val("prDia")], numero(m2hora), `${val("prHora")}:00`, numero(m2h), numero(techosHora.size)];
    }

    // ---------------------------------------------------------------- lluvia y choques
    function analizarLluvia(p) {
      const I = 60;                              // mm/h de referencia (el escenario central)
      let area = 0, extra = 0;
      const agua = ctx.INTENSIDADES.map(() => 0);
      for (let j = 0; j < SIM.ny; j++) {
        const z = SIM.z0 + (j + 0.5) * SIM.celda;
        if (Math.abs(z - p.z) > radioDe(p) + 4) continue;
        for (let i = 0; i < SIM.nx; i++) {
          const x = SIM.x0 + (i + 0.5) * SIM.celda;
          if (Math.abs(x - p.x) > radioDe(p) + 4 || !dentro(p, x, z)) continue;
          const k = j * SIM.nx + i, a = SIM.celda ** 2;
          area += a;
          extra += a * Math.min(I, SIM.infiltracion[D.codigos[k]] ?? 0) / 1000;
          ctx.INTENSIDADES.forEach((_, q) => { if (ctx.FISICA[q]) agua[q] = Math.max(agua[q], ctx.FISICA[q][k] * 2); });
        }
      }
      const conAgua = agua.map((cm, q) => (cm >= 2 ? t("prAgua", ctx.INTENSIDADES[q], cm) : null)).filter(Boolean);
      return [numero(area), I, numero(extra, 1), conAgua.length ? conAgua.join(", ") : t("prSeco")];
    }
    function analizarChoques(p) {
      let ed = 0, cal = 0, ace = 0;
      for (const [, v] of p.huella1m) { ed += v === 3; cal += v === 2; ace += v === 1; }
      let arboles = 0;
      const A = D.arboles;
      for (let k = 0; k < A.length / 5; k++) if (dentro(p, A[k * 5] / 10, A[k * 5 + 1] / 10)) arboles++;
      // Edificio existente más cercano: distancia de cada píxel de edificio (hasta 40 m) al rectángulo del proyecto
      let cerca = Infinity;
      const propios = new Set(p.huella1m.map(([q]) => q)), r = radioDe(p) + 40;
      const c = Math.cos(p.giro), s = Math.sin(p.giro);
      for (let j = Math.max(0, Math.floor(p.z - r - SIM.z0)); j < Math.min(S1.ny, Math.ceil(p.z + r - SIM.z0)); j++)
        for (let i = Math.max(0, Math.floor(p.x - r - SIM.x0)); i < Math.min(S1.nx, Math.ceil(p.x + r - SIM.x0)); i++) {
          const q = j * S1.nx + i;
          if (D.suelo1m[q] !== 3 || propios.has(q)) continue;
          const dx = SIM.x0 + i + 0.5 - p.x, dz = SIM.z0 + j + 0.5 - p.z;
          const d = Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - p.ancho / 2), Math.max(0, Math.abs(dx * s + dz * c) - p.fondo / 2));
          if (d < cerca) cerca = d;
        }
      const partes = [];
      if (ed) partes.push(t("prConEdificios", numero(ed)));
      if (cal) partes.push(t("prCalzada", numero(cal)));
      if (ace) partes.push(t("prAcera", numero(ace)));
      if (arboles) partes.push(t("prArboles", arboles));
      const dist = cerca === Infinity ? "> 40" : numero(cerca, 0);
      return partes.length ? partes.join(" · ") + " · " + t("prCerca", dist) : t("prNada", dist);
    }

    function analizar() {
      if (!elegido) { $("prSombra").textContent = $("prLluvia").textContent = $("prChoques").textContent = $("prPlan").textContent = ""; return; }
      $("prSombra").innerHTML = t("prSombra", ...analizarSombra(elegido));
      $("prLluvia").innerHTML = t("prLluvia", ...analizarLluvia(elegido));
      $("prChoques").innerHTML = t("prChoques", analizarChoques(elegido));
      // Planeamiento bajo la huella: calificaciones y su parte; aviso si pisa parques, viario o ríos
      const cuenta = new Map();
      for (const [q] of elegido.huella1m) {
        const i = q % S1.nx, j = (q - i) / S1.nx, c = calificacionEn(ctx, SIM.x0 + i + 0.5, SIM.z0 + j + 0.5);
        const k = c ? `${c.codigo} (${c.nombre})` : "—";
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
      }
      const total = elegido.huella1m.length || 1, partes = [...cuenta].sort((a, b) => b[1] - a[1]);
      const prohibido = partes.filter(([k]) => ["SV", "SX", "SH", "SF"].includes(familiaMUC(k)));
      $("prPlan").innerHTML = ctx.planeamiento4m ? t("prPlan", partes.map(([k, n]) => `${k} ${Math.round(100 * n / total)} %`).join(", ")) +
        (prohibido.length ? t("prPlanAviso", prohibido.map(([k]) => k.split(" ")[0]).join(", ")) : "") : "";
    }

    function rotulos() {
      $("prAnchoT").innerHTML = t("prAncho", val("prAncho"));
      $("prFondoT").innerHTML = t("prFondo", val("prFondo"));
      $("prPlantasT").innerHTML = t("prPlantas", val("prPlantas"), numero(altoDe(val("prPlantas")), 1));
      $("prGiroT").innerHTML = t("prGiro", val("prGiro"));
      $("prHoraT").innerHTML = t("prHora", `${val("prHora")}:00`);
      $("prColocar").textContent = t(colocando ? "prColocando" : "prColocar");
      $("prColocar").classList.toggle("principal", colocando);
      const dia = $("prDia").value || "0";
      $("prDia").innerHTML = tx("prDias").map((d, q) => `<option value="${q}">${d}</option>`).join("");
      $("prDia").value = dia;
      $("prLista").innerHTML = "";
      for (const p of proyectos) {
        const li = document.createElement("li");
        li.innerHTML = `${p === elegido ? "<b>" : ""}${t("prLista", p.n, p.ancho, p.fondo, p.plantas)}${p === elegido ? "</b>" : ""} `;
        li.dataset.x = 1;
        li.onclick = () => { elegir(p); };
        const b = document.createElement("button");
        b.textContent = t("prQuitar");
        b.onclick = (ev) => {
          ev.stopPropagation();
          for (const [q, v] of p.huella1m) D.suelo1m[q] = v;
          grupo.remove(p.malla);
          proyectos.splice(proyectos.indexOf(p), 1);
          elegido = proyectos.at(-1) ?? null;
          rotulos(); analizar();
        };
        li.appendChild(b);
        $("prLista").appendChild(li);
      }
    }
    function elegir(p) {
      elegido = p;
      for (const id of ["prAncho", "prFondo", "prPlantas"]) $(id).value = p[{ prAncho: "ancho", prFondo: "fondo", prPlantas: "plantas" }[id]];
      $("prGiro").value = Math.round(p.giro * 180 / Math.PI);
      rotulos(); analizar();
    }
    // Los deslizadores cambian el proyecto elegido
    for (const id of ["prAncho", "prFondo", "prPlantas", "prGiro"]) {
      $(id).oninput = () => {
        rotulos();
        if (!elegido) return;
        Object.assign(elegido, { ancho: val("prAncho"), fondo: val("prFondo"), plantas: val("prPlantas"), giro: val("prGiro") * Math.PI / 180 });
        construir(elegido);
      };
      $(id).onchange = () => { rotulos(); analizar(); };
    }
    $("prHora").oninput = rotulos;
    $("prHora").onchange = analizar;
    $("prDia").onchange = analizar;
    $("prColocar").onclick = () => { colocando = !colocando; rotulos(); };
    rotulos();

    return {
      alMostrar() { grupo.visible = true; ctx.capa1m.ver(true); rotulos(); analizar(); },
      alOcultar() { grupo.visible = true; ctx.capa1m.ver(false); colocando = false; },   // el edificio se sigue viendo
      alClic(x, z) {
        if (!colocando) return;
        colocando = false;
        const p = { n: ++contador, x, z, ancho: val("prAncho"), fondo: val("prFondo"), plantas: val("prPlantas"),
                    giro: val("prGiro") * Math.PI / 180 };
        proyectos.push(p);
        construir(p);
        elegir(p);
      },
      traducir() { rotulos(); analizar(); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaProyectos);
