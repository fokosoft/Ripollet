// PLANEAMIENTO URBANÍSTICO: calificación del suelo de cada parcela según el Mapa urbanístic de Catalunya (MUC), con
// el nombre del planeamiento municipal. Agrupada por familias (residencial, industrial, parques, equipamientos,
// viario…) para leerla de un vistazo. Lo usan también «Nuevos proyectos» (qué calificación pisa) y «Mi casa».

export const TEXTOS_PLANEAMIENTO = {
  es: {
    planBoton: "🏛 Planeamiento", plTitulo: "Planeamiento urbanístico", plClic: "Toca el mapa para ver la calificación del suelo.",
    plFicha: "<b>{0}</b> · {1}<br>{2}", plSin: "Sin calificación en el mapa urbanístico.", plLista: "Calificaciones en la maqueta",
    plFila: "{0} {1}: {2} ha",
    plNota: "Mapa urbanístic de Catalunya (Generalitat), servicio de la Diputació de Barcelona, datos de enero de 2023. " +
      "Informativo: para cualquier trámite manda el planeamiento vigente publicado oficialmente.",
    familias: {
      R: ["Residencial", "Suelo urbano de viviendas: núcleo antiguo, ensanche, bloques o casas."],
      A: ["Actividad económica", "Industria, comercio y servicios."],
      M: ["Transformación", "Zonas que el plan prevé cambiar de uso (renovación urbana) o verde privado protegido."],
      D: ["Desarrollo (urbanizable)", "Suelo previsto para urbanizar en el futuro."],
      SV: ["Parques y jardines", "Sistema de espacios libres públicos: no edificable."],
      SE: ["Equipamientos", "Escuelas, centros de salud, deportivos y otros servicios públicos."],
      SX: ["Viario", "Calles, avenidas y pasajes: suelo público no edificable."],
      SS: ["Servicios técnicos", "Infraestructuras y su franja de protección."],
      SH: ["Hidrográfico", "Ríos, torrentes y su dominio público."],
      SF: ["Ferroviario", "Vías del tren y su protección."],
    },
  },
  ca: {
    planBoton: "🏛 Planejament", plTitulo: "Planejament urbanístic", plClic: "Toca el mapa per veure la qualificació del sòl.",
    plFicha: "<b>{0}</b> · {1}<br>{2}", plSin: "Sense qualificació al mapa urbanístic.", plLista: "Qualificacions a la maqueta",
    plFila: "{0} {1}: {2} ha",
    plNota: "Mapa urbanístic de Catalunya (Generalitat), servei de la Diputació de Barcelona, dades de gener de 2023. " +
      "Informatiu: per a qualsevol tràmit mana el planejament vigent publicat oficialment.",
    familias: {
      R: ["Residencial", "Sòl urbà d'habitatges: nucli antic, eixample, blocs o cases."],
      A: ["Activitat econòmica", "Indústria, comerç i serveis."],
      M: ["Transformació", "Zones que el pla preveu canviar d'ús (renovació urbana) o verd privat protegit."],
      D: ["Desenvolupament (urbanitzable)", "Sòl previst per urbanitzar en el futur."],
      SV: ["Parcs i jardins", "Sistema d'espais lliures públics: no edificable."],
      SE: ["Equipaments", "Escoles, centres de salut, esportius i altres serveis públics."],
      SX: ["Viari", "Carrers, avingudes i passatges: sòl públic no edificable."],
      SS: ["Serveis tècnics", "Infraestructures i la seva franja de protecció."],
      SH: ["Hidrogràfic", "Rius, torrents i el seu domini públic."],
      SF: ["Ferroviari", "Vies del tren i la seva protecció."],
    },
  },
};
const COLOR_FAM = { R: [240, 140, 60], A: [150, 80, 180], M: [230, 110, 160], D: [245, 200, 60], SV: [60, 170, 80],
                    SE: [60, 120, 210], SX: [150, 150, 155], SS: [40, 160, 160], SH: [80, 170, 230], SF: [90, 90, 100] };
/** Familia de un código MUC: SV, SE, SX… o la primera letra (R2 → R). */
export const familiaMUC = (codigo) => (codigo.startsWith("S") ? codigo.slice(0, 2) : codigo[0]);
/** Calificación en (x, z): { codigo, nombre } o null. */
export function calificacionEn(ctx, x, z) {
  const P = ctx.planeamiento4m, L = ctx.DATOS.planeamiento?.lista, { SIM } = ctx;
  if (!P || !L) return null;
  const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
  const k = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? P[j * SIM.nx + i] : 0;
  return k ? L[k - 1] : null;
}

const herramientaPlaneamiento = {
  id: "plan",
  textos: TEXTOS_PLANEAMIENTO,
  crear(ctx, div) {
    const { THREE, SIM, t, tx, numero, $ } = ctx;
    const P = ctx.planeamiento4m, L = ctx.DATOS.planeamiento?.lista;
    if (!P || !L) { div.innerHTML = `<b data-t="plTitulo"></b><p>—</p>`; return {}; }
    const capa = ctx.capa4m(), nx = SIM.nx;
    let elegida = 0;
    const area = new Float64Array(L.length + 1);
    for (let k = 0; k < P.length; k++) if (P[k]) area[P[k]] += SIM.celda ** 2;
    function pintar() {
      const C = capa.datos;
      C.fill(0);
      for (let k = 0; k < P.length; k++) {
        const q = P[k];
        if (!q) continue;
        const col = COLOR_FAM[familiaMUC(L[q - 1].codigo)] ?? [180, 180, 180], i = k % nx;
        const borde = (i > 0 && P[k - 1] !== q) || (i < nx - 1 && P[k + 1] !== q) || (k >= nx && P[k - nx] !== q) ||
                      (k < P.length - nx && P[k + nx] !== q);
        C.set(borde ? [40, 40, 50, 200] : [...col, q === elegida ? 210 : 120], k * 4);
      }
      capa.actualizar();
    }
    div.innerHTML = `<b data-t="plTitulo"></b><div class="leyenda" id="plLeyenda"></div>
      <p id="plFicha"></p><details><summary data-t="plLista"></summary><ul id="plLista" style="padding-left:18px"></ul></details>
      <p class="nota" data-t="plNota"></p>`;
    function ficha(c) {
      if (!c) { $("plFicha").textContent = elegida ? t("plSin") : t("plClic"); return; }
      const [fam, desc] = tx("familias")[familiaMUC(c.codigo)] ?? [c.codigo, ""];
      $("plFicha").innerHTML = t("plFicha", `${c.codigo} · ${c.nombre}`, fam, desc);
    }
    function rotulos() {
      const F = tx("familias");
      $("plLeyenda").innerHTML = Object.entries(COLOR_FAM).filter(([f]) => L.some((c) => familiaMUC(c.codigo) === f))
        .map(([f, col]) => `<span><i style="background:rgb(${col.join(",")})"></i>${F[f]?.[0] ?? f}</span>`).join("");
      $("plLista").innerHTML = L.map((c, q) => [c, area[q + 1]]).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1])
        .map(([c, a]) => `<li>${t("plFila", c.codigo, c.nombre, numero(a / 1e4, 1))}</li>`).join("");
      ficha(elegida ? L[elegida - 1] : null);
    }
    return {
      alMostrar() { capa.malla.visible = true; pintar(); rotulos(); },
      alOcultar() { capa.malla.visible = false; },
      alClic(x, z) {
        const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
        elegida = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? P[j * SIM.nx + i] : 0;
        ficha(elegida ? L[elegida - 1] : null); pintar();
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaPlaneamiento);
