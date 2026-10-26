// AGENDA: los actos de la agenda de ripollet.cat en el mapa. web/agenda.json lo actualiza cada día una tarea de
// GitHub (obtener_agenda.py); si no se puede leer (archivo local), se usa la copia que va dentro del visor. Cada acto
// se sitúa por su lugar: equipamientos y lugares con nombre, direcciones del Catastro o el centro de la calle.

export const TEXTOS_AGENDA = {
  es: {
    agendaBoton: "📅 Agenda", agTitulo: "Agenda", agHoy: "Hoy", agSemana: "Próximos 7 días", agTodo: "Todo",
    agNinguno: "No hay actos en estas fechas.", agSinLugar: "lugar sin situar en el mapa", agMas: "Más información",
    agActualizado: "{0} actos de la agenda de ripollet.cat{1}.", agCopia: " (copia guardada: sin conexión con la actualizada)",
    agNota: "La agenda se actualiza cada día. El lugar de cada acto se sitúa automáticamente por su nombre o dirección: " +
      "puede fallar; manda la información de la propia agenda.",
  },
  ca: {
    agendaBoton: "📅 Agenda", agTitulo: "Agenda", agHoy: "Avui", agSemana: "Propers 7 dies", agTodo: "Tot",
    agNinguno: "No hi ha actes en aquestes dates.", agSinLugar: "lloc sense situar al mapa", agMas: "Més informació",
    agActualizado: "{0} actes de l'agenda de ripollet.cat{1}.", agCopia: " (còpia desada: sense connexió amb l'actualitzada)",
    agNota: "L'agenda s'actualitza cada dia. El lloc de cada acte se situa automàticament pel nom o l'adreça: pot fallar; " +
      "mana la informació de la mateixa agenda.",
  },
};
const VACIAS = new Set(["de", "del", "dels", "la", "les", "el", "els", "l", "d", "i", "a", "al", "ripollet", "carrer", "c",
                        "calle", "avinguda", "av", "placa", "plaza", "municipal", "parc", "sala", "espai"]);
const palabras = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ")
  .split(/\s+/).filter((w) => w.length > 1 && !VACIAS.has(w));
// Nombres de la agenda que no coinciden con los de OSM
const ALIAS = { "casal de joves": "cal teixell", "biblioteca municipal": "biblioteca publica ripollet" };

const herramientaAgenda = {
  id: "agenda",
  textos: TEXTOS_AGENDA,
  crear(ctx, div) {
    const { THREE, D, SIM, t, numero, $ } = ctx;
    // Candidatos con nombre y posición
    const cand = [];
    for (const e of ctx.DATOS.equipamientos) cand.push({ n: e.nombre, x: e.x, z: e.z });
    for (const l of ctx.lugaresOsm ?? []) if (l.n) cand.push({ n: l.n, x: l.x, z: l.z });
    for (const l of ctx.DATOS.lugares) cand.push({ n: l.nombre, x: l.pos[0], z: l.pos[2] });
    {   // centro de cada calle (celdas de calzada)
      const sc = ctx.DATOS.calles.map(() => [0, 0, 0]);
      for (let k = 0; k < SIM.nx * SIM.ny; k++) {
        const id = D.calles[k];
        if (!id || D.codigos[k] !== 6) continue;
        const i = k % SIM.nx;
        sc[id - 1][0] += SIM.x0 + (i + 0.5) * SIM.celda; sc[id - 1][1] += SIM.z0 + ((k - i) / SIM.nx + 0.5) * SIM.celda; sc[id - 1][2]++;
      }
      ctx.DATOS.calles.forEach((c, q) => { if (sc[q][2]) cand.push({ n: c, x: sc[q][0] / sc[q][2], z: sc[q][1] / sc[q][2], calle: true }); });
    }
    for (const c of cand) c.w = new Set(palabras(c.n));
    /** Posición de un lugar: el candidato con más palabras en común (todas las del candidato, si es corto). */
    function situar(lugar) {
      let texto = lugar.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      for (const [a, b] of Object.entries(ALIAS)) if (texto.includes(a)) texto = b;
      const w = palabras(texto);
      if (!w.length) return null;
      let mejor = null, nota = 0;
      for (const c of cand) {
        const comunes = w.filter((p) => c.w.has(p)).length;
        if (!comunes) continue;
        const s = comunes / Math.max(c.w.size, w.length) + (c.calle ? 0 : 0.05);
        if (s > nota) { nota = s; mejor = c; }
      }
      return nota >= 0.5 ? mejor : null;
    }

    let actos = [], copia = false, filtro = "semana", elegido = -1;
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);
    const marcas = [];
    async function cargar() {
      for (const url of ["agenda.json", "web/agenda.json"]) {
        try {
          const r = await fetch(url, { cache: "no-cache" });
          if (r.ok) { actos = (await r.json()).actos; copia = false; break; }
        } catch {}
      }
      if (!actos.length && ctx.agendaLocal) { actos = ctx.agendaLocal.actos; copia = true; }
      for (const a of actos) {
        const p = situar(a.lugar || "");
        a.pos = p ? [p.x, p.z] : null;
        if (!p) continue;
        const d = document.createElement("div");
        d.className = "marca";
        Object.assign(d.style, { background: "#fff", color: "#1d2230", border: "2px solid #b83232", width: "22px", height: "22px", fontSize: "12px" });
        d.textContent = "📅";
        d.title = a.titulo;
        const o = new ctx.CSS2DObject(d);
        o.position.set(p.x, ctx.altura(p.x, p.z) + 7, p.z);
        grupo.add(o);
        marcas.push([a, o]);
      }
      lista();
    }
    const fechaAc = (a) => new Date(a.inicio);
    const lengua = () => (ctx.idioma() === "ca" ? "ca-ES" : "es-ES");
    function visibles() {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const fin = new Date(hoy.getTime() + (filtro === "hoy" ? 1 : 7) * 864e5);
      return actos.filter((a) => {
        const ini = fechaAc(a), acaba = a.fin ? new Date(a.fin) : ini;
        return filtro === "todo" || (acaba >= hoy && ini < fin);
      });
    }
    function lista() {
      const v = visibles(), set = new Set(v);
      for (const [a, o] of marcas) o.visible = set.has(a);
      for (const b of div.querySelectorAll("[data-filtro]")) b.classList.toggle("principal", b.dataset.filtro === filtro);
      $("agEstado").textContent = t("agActualizado", actos.length, copia ? t("agCopia") : "");
      if (!v.length) { $("agLista").innerHTML = `<li>${t("agNinguno")}</li>`; return; }
      const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
      $("agLista").replaceChildren(...v.map((a) => {
        const li = document.createElement("li"), ini = fechaAc(a);
        li.style.margin = "6px 0";
        li.dataset.x = 1;
        const cuando = ini.toLocaleString(lengua(), { weekday: "short", day: "numeric", month: "short",
                                                       ...(ini.getHours() || ini.getMinutes() ? { hour: "2-digit", minute: "2-digit" } : {}) });
        li.innerHTML = `<b>${esc(a.titulo)}</b><br><small>${esc(cuando)} · ${esc(a.lugar || "—")}${a.pos ? "" : ` (${t("agSinLugar")})`}` +
          ` · <a href="${esc(a.url)}" target="_blank" rel="noopener">${t("agMas")}</a></small>`;
        li.onclick = (e) => { if (e.target.tagName !== "A" && a.pos) ctx.volarA(new THREE.Vector3(a.pos[0], 0, a.pos[1]), 0.4); };
        return li;
      }));
    }
    div.innerHTML = `<b data-t="agTitulo"></b>
      <div class="botones"><button data-filtro="hoy" data-t="agHoy"></button><button data-filtro="semana" data-t="agSemana"></button>
        <button data-filtro="todo" data-t="agTodo"></button></div>
      <ul id="agLista" style="list-style:none;padding:0;margin:6px 0"></ul>
      <p class="nota" id="agEstado"></p><p class="nota" data-t="agNota"></p>`;
    for (const b of div.querySelectorAll("[data-filtro]")) b.onclick = () => { filtro = b.dataset.filtro; lista(); };
    let cargado = false;
    return {
      alMostrar() { grupo.visible = true; if (!cargado) { cargado = true; cargar(); } else lista(); },
      alOcultar() { grupo.visible = false; },
      traducir() { if (cargado) lista(); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaAgenda);
