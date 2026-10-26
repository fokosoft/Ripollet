// MI CASA: buscar una calle o una dirección (portales del Catastro) o tocar un edificio, y ver en una ficha todo lo
// que la maqueta sabe de él: agua en lluvias fuertes, año y certificados, potencial solar, ruido (zona acústica),
// vulnerabilidad de su barrio y a cuántos minutos a pie quedan la escuela, el CAP, el súper, la farmacia, el bus y un
// refugio climático; y a cuántos en coche, una base de emergencias.
import { crearGrafo, tiempos, nodoCercano, nodosDe } from './rutas.js';
import { celdaAnalizable } from './inundacion.js';
import { sectorEn, sectorProbable, recogidaDia, diaVisor } from './residuos.js';
import { calificacionEn, familiaMUC } from './planeamiento.js';

export const TEXTOS_MICASA = {
  es: {
    micasaBoton: "🏠 Mi casa", mcTitulo: "Mi casa", mcBuscar: "Calle y número, p. ej. «Balmes 12»",
    mcClic: "Busca una dirección o toca tu edificio en el mapa.", mcSinResultados: "No encuentro esa dirección.",
    mcCalle: "Calle", mcSinDireccion: "Edificio {0}", mcCompartir: "🔗 Compartir esta ficha",
    mcAgua: "🌊 Agua en lluvias fuertes", mcAguaNada: "Sin agua acumulada junto a la fachada ni a 120 mm/h.",
    mcAguaSi: "Hasta {0} cm junto a la fachada con {1} mm/h", mcSotano: " · tiene sótano o garaje (Catastro)",
    mcEdificio: "🏢 Edificio", mcAnio: "construido en {0}", mcViv: "{0} viviendas", mcCert: "certificados energéticos: {0}",
    mcSinCert: "sin certificados energéticos", mcSolar: "☀️ Cubierta", mcSolarTxt: "{0} kWh/m²·año de sol · podría producir ≈ {1} MWh/año ({2} kWp)",
    mcRuido: "🔊 Zona acústica", mcRuidoTxt: "{0}: objetivo {1} dB de día y {2} dB de noche", mcSinZona: "sin zona acústica asignada",
    mcBarrio: "👥 Barrio (sección censal {0})", mcBarrioTxt: "{0} vecinos · {1} % de 65 años o más · renta media {2} €/persona · índice de vulnerabilidad {3}/100",
    mcCerca: "🚶 A pie desde aquí", mcResiduos: "♻️ Recogida: sector {0} ({1})", mcHoy: "Hoy: {0}", mcPlan: "🏛 Planeamiento", mcCoche: "🚑 Emergencias en coche: {0} min ({1})",
    mcMin: "{0}: {1} min ({2})", mcLejos: "{0}: más de 30 min",
    mcCats: { educacion: "Escuela", salud: "Centro de salud", comida: "Comida", farmacia: "Farmacia", bus: "Parada de bus",
            refugio: "Refugio climático" },
    mcNota: "Datos de la maqueta: simulación física sin alcantarillado, Catastro, ICAEN, INE y OSM. Orientativo.",
  },
  ca: {
    micasaBoton: "🏠 La meva casa", mcTitulo: "La meva casa", mcBuscar: "Carrer i número, p. ex. «Balmes 12»",
    mcClic: "Cerca una adreça o toca el teu edifici al mapa.", mcSinResultados: "No trobo aquesta adreça.",
    mcCalle: "Carrer", mcSinDireccion: "Edifici {0}", mcCompartir: "🔗 Compartir aquesta fitxa",
    mcAgua: "🌊 Aigua en pluges fortes", mcAguaNada: "Sense aigua acumulada a tocar de la façana ni amb 120 mm/h.",
    mcAguaSi: "Fins a {0} cm a tocar de la façana amb {1} mm/h", mcSotano: " · té soterrani o garatge (Cadastre)",
    mcEdificio: "🏢 Edifici", mcAnio: "construït el {0}", mcViv: "{0} habitatges", mcCert: "certificats energètics: {0}",
    mcSinCert: "sense certificats energètics", mcSolar: "☀️ Coberta", mcSolarTxt: "{0} kWh/m²·any de sol · podria produir ≈ {1} MWh/any ({2} kWp)",
    mcRuido: "🔊 Zona acústica", mcRuidoTxt: "{0}: objectiu {1} dB de dia i {2} dB de nit", mcSinZona: "sense zona acústica assignada",
    mcBarrio: "👥 Barri (secció censal {0})", mcBarrioTxt: "{0} veïns · {1} % de 65 anys o més · renda mitjana {2} €/persona · índex de vulnerabilitat {3}/100",
    mcCerca: "🚶 A peu des d'aquí", mcResiduos: "♻️ Recollida: sector {0} ({1})", mcHoy: "Avui: {0}", mcPlan: "🏛 Planejament", mcCoche: "🚑 Emergències en cotxe: {0} min ({1})",
    mcMin: "{0}: {1} min ({2})", mcLejos: "{0}: més de 30 min",
    mcCats: { educacion: "Escola", salud: "Centre de salut", comida: "Menjar", farmacia: "Farmàcia", bus: "Parada de bus",
            refugio: "Refugi climàtic" },
    mcNota: "Dades de la maqueta: simulació física sense clavegueram, Cadastre, ICAEN, INE i OSM. Orientatiu.",
  },
};

const USOS_ZONA = { A2: "sanitario o docente", A4: "residencial", B1: "residencial y actividades", B2: "residencial y tráfico",
                    C1: "ocio", C2: "industrial" };
const PIE_MC = 1.25;
/** Para buscar: minúsculas, sin acentos ni prefijos («Carrer de», «Avinguda»…). */
const normalizar = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`.,]/g, " ")
  .replace(/\b(carrer|calle|c|avinguda|avenida|av|avda|passeig|paseo|pg|placa|plaza|pl|rambla|ronda|cami|camino|passatge|pasaje|ptge|carretera|ctra|travessera|de|del|dels|la|les|el|els|d|l)\b/g, " ")
  .replace(/\s+/g, " ").trim();

const herramientaMicasa = {
  id: "micasa",
  textos: TEXTOS_MICASA,
  crear(ctx, div) {
    const { THREE, D, SIM, t, tx, numero, $ } = ctx;
    const P = ctx.direcciones ?? [];             // [calle, número, x, z, edificio]
    const calles = ctx.DATOS.calles;
    const nEd = ctx.DATOS.edificios;

    // Centro de cada calle (celdas de calzada con esa calle más cercana) y de cada edificio
    const sc = calles.map(() => [0, 0, 0]), se = new Float64Array((nEd + 1) * 3);
    for (let k = 0; k < SIM.nx * SIM.ny; k++) {
      const i = k % SIM.nx, x = SIM.x0 + (i + 0.5) * SIM.celda, z = SIM.z0 + ((k - i) / SIM.nx + 0.5) * SIM.celda;
      const id = D.calles[k], e = D.edificios[k];
      if (id && D.codigos[k] === 6) { sc[id - 1][0] += x; sc[id - 1][1] += z; sc[id - 1][2]++; }
      if (e) { se[e * 3] += x; se[e * 3 + 1] += z; se[e * 3 + 2]++; }
    }
    const centroEd = (e) => (se[e * 3 + 2] ? [se[e * 3] / se[e * 3 + 2], se[e * 3 + 1] / se[e * 3 + 2]] : null);
    const normCalles = calles.map(normalizar);
    const portalesDe = new Map();
    for (const p of P) if (p[4]) portalesDe.set(p[4], [...(portalesDe.get(p[4]) ?? []), p]);

    // ---------------------------------------------------------------- búsqueda
    function buscar(q) {
      const nq = normalizar(q), num = (nq.match(/\b(\d+[a-z]?)\b/) || [])[1];
      const texto = nq.replace(/\b\d+[a-z]?\b/g, "").trim();
      if (!texto) return [];
      const r = [];
      calles.forEach((c, id) => {
        if (!normCalles[id].includes(texto)) return;
        const portales = P.filter((p) => p[0] === id + 1);
        if (num) {
          const exacto = portales.filter((p) => p[1].toLowerCase() === num);
          for (const p of exacto.length ? exacto : []) r.push({ txt: `${c} ${p[1]}`, x: p[2], z: p[3], e: p[4] });
          if (!exacto.length && portales.length) {        // el número más cercano
            const n = parseInt(num, 10), p = portales.reduce((a, b) => (Math.abs(parseInt(b[1], 10) - n) < Math.abs(parseInt(a[1], 10) - n) ? b : a));
            r.push({ txt: `${c} ${p[1]}`, x: p[2], z: p[3], e: p[4] });
          }
        } else if (sc[id][2]) r.push({ txt: c, x: sc[id][0] / sc[id][2], z: sc[id][1] / sc[id][2], e: 0, calle: true });
      });
      const vistos = new Set();       // una fila por dirección (hay portales repetidos)
      return r.filter((x) => !vistos.has(x.txt) && vistos.add(x.txt)).slice(0, 8);
    }

    // ---------------------------------------------------------------- cálculos de la ficha
    const G = crearGrafo(D), nodoPie = nodosDe(G, (e) => G.pie[e]), nodoCoche = nodosDe(G, (e) => G.vel[e] > 0);
    const REFUGIO = /bibliot|c[ií]vic|casal|centre de dia|centre obert/i;
    const destinos = {
      educacion: ctx.DATOS.equipamientos.filter((e) => e.tipo === "educacion"),
      salud: ctx.DATOS.equipamientos.filter((e) => e.tipo === "salud"),
      comida: (ctx.lugaresOsm ?? []).filter((l) => l.c === "comida").map((l) => ({ nombre: l.n || l.t, x: l.x, z: l.z })),
      farmacia: (ctx.lugaresOsm ?? []).filter((l) => l.t === "pharmacy").map((l) => ({ nombre: l.n, x: l.x, z: l.z })),
      bus: (ctx.transporte?.paradas ?? []).map((p) => ({ nombre: p.n, x: p.x, z: p.z })),
      refugio: ctx.DATOS.equipamientos.filter((e) => e.tipo === "social" && REFUGIO.test(e.nombre)),
    };
    for (const lista of Object.values(destinos)) for (const d of lista) d.nodo = nodoCercano(G, d.x, d.z, nodoPie).nodo;
    const bases = ctx.DATOS.equipamientos.filter((e) => e.tipo === "emergencia")
      .map((e) => ({ ...e, nodo: nodoCercano(G, e.x, e.z, nodoCoche).nodo }));
    function agua(e) {
      const res = [];
      for (const mmh of [60, 120]) {
        const q = ctx.INTENSIDADES.indexOf(mmh), F = ctx.FISICA[q];
        if (!F) continue;
        let maxima = 0;
        for (let k = 0; k < SIM.nx * SIM.ny; k++) {
          if (D.edificios[k] !== e) continue;
          const i = k % SIM.nx;
          for (const v of [k - 1, k + 1, k - SIM.nx, k + SIM.nx]) {
            // Solo vía pública, como el panel de riesgo (fuera patios privados, muros, río y edificios)
            if (v < 0 || v >= F.length || (v % SIM.nx === 0 && i === SIM.nx - 1) || D.edificios[v] || !celdaAnalizable(D.codigos[v])) continue;
            maxima = Math.max(maxima, F[v] * 2);
          }
        }
        res.push([mmh, maxima]);
      }
      return res;
    }

    let elegido = 0;
    function ficha(e) {
      elegido = e;
      pintarTecho();
      if (!e) { $("mcFicha").innerHTML = ""; return; }
      const c = centroEd(e);
      const porta = portalesDe.get(e) ?? [];
      const nombre = porta.length
        ? [...new Set(porta.map((p) => calles[p[0] - 1]))].map((cn) => `${cn} ${porta.filter((p) => calles[p[0] - 1] === cn).map((p) => p[1]).join(", ")}`).join(" · ")
        : t("mcSinDireccion", e);
      const filas = [`<b style="font-size:16px">${nombre}</b>`];
      // Agua
      const ag = agua(e).filter(([, cm]) => cm >= 5);
      const sot = ctx.SOTANOS?.[e - 1] ? t("mcSotano") : "";
      filas.push(`<b>${t("mcAgua")}</b><br>` + (ag.length ? ag.map(([m, cm]) => t("mcAguaSi", numero(cm), m)).join("<br>") + sot
                                                           : t("mcAguaNada") + sot));
      // Edificio
      if (ctx.rehab) {
        const R = (q) => ctx.rehab[(e - 1) * 5 + q], letra = " ABCDEFG"[R(4) & 7];
        const partes = [];
        if (R(0)) partes.push(t("mcAnio", R(0)));
        if (R(1)) partes.push(t("mcViv", R(1)));
        partes.push(R(2) ? t("mcCert", `${R(2)} (mediana ${letra})`) : t("mcSinCert"));
        filas.push(`<b>${t("mcEdificio")}</b><br>${partes.join(" · ")}`);
      }
      // Cubierta
      const kwp = ctx.DATOS.solar?.kwp?.[e - 1], kwh = ctx.DATOS.solar?.kwh?.[e - 1];
      if (kwp) filas.push(`<b>${t("mcSolar")}</b><br>${t("mcSolarTxt", numero(kwh / Math.max(kwp, 0.01) / 0.8 * 1, 0), numero(kwh / 1000, 1), numero(kwp, 1))}`);
      // Zona acústica y barrio (de la celda del centro)
      if (c) {
        const k = Math.floor((c[1] - SIM.z0) / SIM.celda) * SIM.nx + Math.floor((c[0] - SIM.x0) / SIM.celda);
        const za = ctx.acustica4m && ctx.DATOS.zonasAcusticas?.lista?.[ctx.acustica4m[k] - 1];
        filas.push(`<b>${t("mcRuido")}</b><br>` + (za ? t("mcRuidoTxt", USOS_ZONA[za.usos] ?? za.usos, za.ld, za.ln) : t("mcSinZona")));
        const s = ctx.secciones4m && ctx.DATOS.secciones?.lista?.[ctx.secciones4m[k] - 1];
        if (s) filas.push(`<b>${t("mcBarrio", s.codigo)}</b><br>${t("mcBarrioTxt", numero(s.poblacion), numero(s.mayores, 1), numero(s.renta), s.indice)}`);
        // Recogida de residuos y planeamiento
        const sec = sectorEn(ctx, c[0], c[1]);
        if (sec) filas.push(`<b>${t("mcResiduos", sec, ctx.residuos.calendarios[sec].nombre)}</b>` +
          `${sectorProbable(ctx, c[0], c[1]) ? t("reProbable") : ""}<br>${t("mcHoy", recogidaDia(ctx, sec, diaVisor(ctx)))}`);
        const cal = calificacionEn(ctx, c[0], c[1]);
        if (cal) filas.push(`<b>${t("mcPlan")}</b><br>${cal.codigo} · ${cal.nombre} (${(tx("familias")[familiaMUC(cal.codigo)] ?? [""])[0]})`);
        // A pie y en coche
        const o = nodoCercano(G, c[0], c[1], nodoPie), { t: T } = tiempos(G, [o.nodo], (a) => (G.pie[a] ? G.largo[a] / PIE_MC : Infinity));
        const cats = tx("mcCats"), lineas = [];
        for (const [cat, lista] of Object.entries(destinos)) {
          if (!lista.length) continue;
          const mejor = lista.reduce((a, b) => (T[b.nodo] < T[a.nodo] ? b : a));
          const min = (T[mejor.nodo] + o.distancia / PIE_MC) / 60;
          lineas.push(min > 30 || !Number.isFinite(min) ? t("mcLejos", cats[cat]) : t("mcMin", cats[cat], Math.max(1, Math.round(min)), mejor.nombre || "—"));
        }
        filas.push(`<b>${t("mcCerca")}</b><br>${lineas.join("<br>")}`);
        const oc = nodoCercano(G, c[0], c[1], nodoCoche);
        const { t: TC } = tiempos(G, [oc.nodo], (a) => (G.vel[a] ? G.largo[a] / (G.vel[a] / 3.6) : Infinity));
        const base = bases.reduce((a, b) => (TC[b.nodo] < TC[a.nodo] ? b : a), bases[0]);
        if (base && Number.isFinite(TC[base.nodo])) filas.push(t("mcCoche", numero((TC[base.nodo] + 10 + oc.distancia / 4) / 60, 1), base.nombre));
        ctx.volarA(new THREE.Vector3(c[0], 0, c[1]), 0.35);
      }
      filas.push(`<button id="mcCompartir">${t("mcCompartir")}</button>`, `<span class="nota">${t("mcNota")}</span>`);
      $("mcFicha").innerHTML = filas.map((f) => `<p style="margin:8px 0">${f}</p>`).join("");
      $("mcCompartir").onclick = () => ctx.compartir({ casa: e });
    }
    function pintarTecho() {
      const T = ctx.capaTechos;
      T.datos.fill(0);
      if (elegido)
        for (let j = 0; j < T.ny; j++)
          for (let i = 0; i < T.nx; i++) {
            const k = j * T.nx + i;
            if (D.techos2m[k] && D.edificios[(j >> 1) * SIM.nx + (i >> 1)] === elegido) T.datos.set([255, 210, 63, 255], k * 4);
          }
      T.actualizar();
    }

    // ---------------------------------------------------------------- panel
    div.innerHTML = `<b data-t="mcTitulo"></b>
      <input id="mcBuscar" type="search" autocomplete="off" style="width:100%;margin-top:8px;font-size:16px;padding:6px 8px">
      <ul id="mcResultados" style="list-style:none;padding:0;margin:4px 0"></ul>
      <p id="mcAyuda" class="nota"></p><div id="mcFicha"></div>`;
    function resultados() {
      const q = $("mcBuscar").value.trim(), r = q.length >= 2 ? buscar(q) : [];
      $("mcResultados").replaceChildren(...r.map((x) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        Object.assign(li.style, { padding: "8px 6px", borderBottom: "1px solid rgba(128,128,128,.25)", cursor: "pointer" });
        li.textContent = `${x.calle ? "🛣" : "🏠"} ${x.txt}`;
        li.onclick = () => {
          $("mcResultados").replaceChildren();
          $("mcBuscar").value = x.txt;
          if (x.e) ficha(x.e); else { ficha(0); ctx.volarA(new THREE.Vector3(x.x, 0, x.z), 0.6); }
        };
        return li;
      }));
      $("mcAyuda").textContent = q.length >= 2 && !r.length ? t("mcSinResultados") : elegido ? "" : t("mcClic");
    }
    $("mcBuscar").oninput = resultados;
    $("mcBuscar").onkeydown = (ev) => { if (ev.key === "Enter") $("mcResultados").firstChild?.click(); };
    function rotulos() { $("mcBuscar").placeholder = t("mcBuscar"); resultados(); if (elegido) ficha(elegido); }

    return {
      alMostrar() { ctx.capaTechos.ver(true); rotulos(); pintarTecho(); },
      alOcultar() { ctx.capaTechos.ver(false); },
      alClic(x, z, ev) {
        const p = ctx.impacto(ev) ?? { x, z };
        const e = ctx.edificioEn(p.x, p.z);
        if (e) { $("mcBuscar").value = ""; $("mcResultados").replaceChildren(); ficha(e); $("mcAyuda").textContent = ""; }
      },
      enlace: () => (elegido ? { casa: elegido } : {}),
      restaurar(params) { const e = +params.get("casa"); if (e > 0 && e <= nEd) ficha(e); },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaMicasa);
