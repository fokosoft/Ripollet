// RECOGIDA DE RESIDUOS («Ripollet Aporta»): sector de cada punto, qué toca sacar hoy y esta semana (puerta a puerta
// en Centre y Pinetons, contenedores en Can Mas-Maragall y Tiana-Pont Vell), y dónde están los contenedores, las
// áreas de emergencia y los buzones de textil sanitario. Datos del mapa y los calendarios publicados del servicio.

export const TEXTOS_RESIDUOS = {
  es: {
    residuosBoton: "♻️ Recogida de residuos", reTitulo: "Recogida de residuos",
    reClic: "Toca el mapa (o tu casa) para ver tu sector y qué toca sacar.", reFuera: "Ese punto no está en ningún sector.",
    reSector: "<b>Sector {0}: {1}</b>", reProbable: " <small>(probable: el mapa del servicio no cubre este punto; confírmalo en ripollet.cat)</small>", reHoy: "<b>Hoy ({0})</b>: {1}", reManana: "Mañana ({0}): {1}",
    rePuerta: "sacar {0} delante del portal, de 21 a 22 h", reNada: "no hay recogida puerta a puerta",
    reContTodo: "todo va al contenedor, cualquier día de 6 a 23 h ({0} con la tarjeta)",
    reCont: "Contenedores (6–23 h): {0}", reTarjeta: " (con tarjeta)", reSemana: "Toda la semana",
    reCerca: "Lo más cercano", reDist: "{0}: {1} m ({2})", reAreaDias: "{0}, {1} h",
    reLeyContenedor: "Contenedor", reLeyArea: "Área de emergencia", reLeyTextil: "Buzón de textil sanitario",
    reNota: "Mapa de sectores y calendarios de «Ripollet Aporta» (noviembre de 2023): si han cambiado, manda el servicio. " +
      "Las áreas de emergencia son solo para necesidades puntuales (máximo 3 veces por semana).",
    reDias: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
    reFr: { envasos: "envases", paper: "papel y cartón", rebuig: "resto", organica: "orgánica", vidre: "vidrio", textil: "textil sanitario" },
  },
  ca: {
    residuosBoton: "♻️ Recollida de residus", reTitulo: "Recollida de residus",
    reClic: "Toca el mapa (o casa teva) per veure el teu sector i què toca treure.", reFuera: "Aquest punt no és a cap sector.",
    reSector: "<b>Sector {0}: {1}</b>", reProbable: " <small>(probable: el mapa del servei no cobreix aquest punt; confirma-ho a ripollet.cat)</small>", reHoy: "<b>Avui ({0})</b>: {1}", reManana: "Demà ({0}): {1}",
    rePuerta: "treure {0} davant del portal, de 21 a 22 h", reNada: "no hi ha recollida porta a porta",
    reContTodo: "tot va al contenidor, qualsevol dia de 6 a 23 h ({0} amb la targeta)",
    reCont: "Contenidors (6–23 h): {0}", reTarjeta: " (amb targeta)", reSemana: "Tota la setmana",
    reCerca: "El més proper", reDist: "{0}: {1} m ({2})", reAreaDias: "{0}, {1} h",
    reLeyContenedor: "Contenidor", reLeyArea: "Àrea d'emergència", reLeyTextil: "Bústia de tèxtil sanitari",
    reNota: "Mapa de sectors i calendaris de «Ripollet Aporta» (novembre de 2023): si han canviat, mana el servei. " +
      "Les àrees d'emergència són només per a necessitats puntuals (màxim 3 vegades per setmana).",
    reDias: ["dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte", "diumenge"],
    reFr: { envasos: "envasos", paper: "paper i cartró", rebuig: "rebuig", organica: "orgànica", vidre: "vidre", textil: "tèxtil sanitari" },
  },
};
const CON_TARJETA = new Set(["organica", "textil", "rebuig"]);
const COLOR_SECTOR = [null, [224, 112, 58], [46, 120, 200], [46, 158, 84], [160, 90, 180]];

/** Sector (1–4) en (x, z) según la rejilla de 4 m, o 0. */
export function sectorEn(ctx, x, z) {
  const S = ctx.sectores4m, { SIM } = ctx;
  if (!S) return 0;
  const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
  const s = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? S[j * SIM.nx + i] : 0;
  return s > 4 ? s - 4 : s;        // 5–8: hueco del mapa, sector más cercano (probable)
}
/** ¿El sector de (x, z) es deducido (hueco del mapa del servicio)? */
export function sectorProbable(ctx, x, z) {
  const S = ctx.sectores4m, { SIM } = ctx;
  const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
  return !!S && i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny && S[j * SIM.nx + i] > 4;
}
/** Texto de la recogida de un día (0 = lunes) en un sector. */
export function recogidaDia(ctx, sector, dia) {
  const { t, tx } = ctx, cal = ctx.residuos?.calendarios?.[sector], fr = tx("reFr");
  if (!cal) return "";
  const puerta = cal.puerta[dia];
  const lista = (l) => l.map((f) => fr[f]).join(" + ");
  if (!Object.keys(cal.puerta).length)
    return t("reContTodo", lista(cal.contenedor.filter((f) => CON_TARJETA.has(f))));
  return puerta ? t("rePuerta", lista(puerta)) : t("reNada");
}
/** Día de la semana (0 = lunes) de la hora que muestra el visor. */
export const diaVisor = (ctx) => (ctx.hora().fecha.getUTCDay() + 6) % 7;

const herramientaResiduos = {
  id: "residuos",
  textos: TEXTOS_RESIDUOS,
  crear(ctx, div) {
    const { THREE, SIM, t, tx, numero, $ } = ctx;
    const R = ctx.residuos, S = ctx.sectores4m;
    if (!R || !S) { div.innerHTML = `<b data-t="reTitulo"></b><p>—</p>`; return {}; }
    const capa = ctx.capa4m();
    {   // sectores: color suave y borde
      const C = capa.datos, nx = SIM.nx;
      for (let k = 0; k < S.length; k++) {
        const s = S[k] > 4 ? S[k] - 4 : S[k], probable = S[k] > 4;
        if (!s) continue;
        const igual = (v) => (v > 4 ? v - 4 : v) === s, i = k % nx;
        const borde = (i > 0 && !igual(S[k - 1])) || (i < nx - 1 && !igual(S[k + 1])) ||
          (k >= nx && !igual(S[k - nx])) || (k < S.length - nx && !igual(S[k + nx]));
        C.set(borde ? [...COLOR_SECTOR[s].map((c) => c * 0.6), 230] : [...COLOR_SECTOR[s], probable ? 25 : 60], k * 4);
      }
      capa.actualizar();
    }
    // Contenedores con instancias (pequeños, baratos); áreas y buzones con icono
    const P = R.puntos, cont = P.filter((p) => p.tipo === "contenedor");
    const mallas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 1.1).translate(0, 0.7, 0),
                                           new THREE.MeshStandardMaterial({ color: 0x8a5a2b, flatShading: true }), cont.length);
    const m = new THREE.Matrix4();
    cont.forEach((p, k) => mallas.setMatrixAt(k, m.makeTranslation(p.pos[0], ctx.altura(p.pos[0], p.pos[1]), p.pos[1])));
    const grupo = new THREE.Group();
    grupo.add(mallas);
    for (const p of P.filter((p) => p.tipo !== "contenedor")) {
      const d = document.createElement("div");
      d.className = "marca";
      Object.assign(d.style, { background: p.tipo === "area" ? "#2e9e54" : "#f08a3c", color: "#fff", width: "22px", height: "22px", fontSize: "12px" });
      d.textContent = p.tipo === "area" ? "♻" : "T";
      d.title = p.nombre;
      const o = new ctx.CSS2DObject(d);
      o.position.set(p.pos[0], ctx.altura(p.pos[0], p.pos[1]) + 5, p.pos[1]);
      grupo.add(o);
    }
    grupo.visible = false;
    ctx.scene.add(grupo);

    div.innerHTML = `<b data-t="reTitulo"></b>
      <div class="leyenda" id="reLeyenda"></div><p id="reFicha"></p>
      <p class="nota" data-t="reNota"></p>`;
    let punto = null;
    function ficha() {
      if (!punto) { $("reFicha").textContent = t("reClic"); return; }
      const [x, z] = punto, s = sectorEn(ctx, x, z);
      if (!s) { $("reFicha").textContent = t("reFuera"); return; }
      const cal = R.calendarios[s], dias = tx("reDias"), hoy = diaVisor(ctx), fr = tx("reFr");
      const filas = [t("reSector", s, cal.nombre) + (sectorProbable(ctx, x, z) ? t("reProbable") : ""), t("reHoy", dias[hoy], recogidaDia(ctx, s, hoy)),
                     t("reManana", dias[(hoy + 1) % 7], recogidaDia(ctx, s, (hoy + 1) % 7))];
      if (Object.keys(cal.puerta).length) {
        filas.push(t("reCont", cal.contenedor.map((f) => fr[f] + (CON_TARJETA.has(f) ? t("reTarjeta") : "")).join(", ")));
        filas.push(`<details><summary>${t("reSemana")}</summary>${dias.map((d, q) => `${d}: ${recogidaDia(ctx, s, q)}`).join("<br>")}</details>`);
      }
      const cerca = [];
      for (const [tipo, ley] of [["contenedor", "reLeyContenedor"], ["area", "reLeyArea"], ["textil", "reLeyTextil"]]) {
        const l = P.filter((p) => p.tipo === tipo);
        if (!l.length) continue;
        const p = l.reduce((a, b) => (Math.hypot(b.pos[0] - x, b.pos[1] - z) < Math.hypot(a.pos[0] - x, a.pos[1] - z) ? b : a));
        const extra = p.dias ? t("reAreaDias", p.dias.map((d) => dias[d].slice(0, 3)).join("·"), p.horas) : p.nombre;
        cerca.push(t("reDist", t(ley), numero(Math.round(Math.hypot(p.pos[0] - x, p.pos[1] - z) / 10) * 10), extra));
      }
      filas.push(`<b>${t("reCerca")}</b><br>${cerca.join("<br>")}`);
      $("reFicha").innerHTML = filas.join("<br>");
    }
    function rotulos() {
      const caja = (c, txt) => `<span><i style="background:rgb(${c.join(",")})"></i>${txt}</span>`;
      $("reLeyenda").innerHTML = [1, 2, 3, 4].map((s) => caja(COLOR_SECTOR[s], `${s}. ${R.calendarios[s].nombre}`)).join("") +
        caja([138, 90, 43], t("reLeyContenedor")) + caja([46, 158, 84], t("reLeyArea")) + caja([240, 138, 60], t("reLeyTextil"));
      ficha();
    }
    return {
      alMostrar() { capa.malla.visible = grupo.visible = true; rotulos(); },
      alOcultar() { capa.malla.visible = grupo.visible = false; },
      alClic(x, z) { punto = [x, z]; ficha(); },
      enlace: () => (punto ? { punto: punto.map(Math.round).join(",") } : {}),
      restaurar(params) { const p = params.get("punto")?.split(",").map(Number); if (p?.length === 2) { punto = p; ficha(); } },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaResiduos);
