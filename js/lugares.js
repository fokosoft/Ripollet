// TIENDAS Y LUGARES DE INTERÉS (OpenStreetMap): buscador, filtros por categoría, «abierto ahora» con el horario de
// OSM (opening_hours) y la hora del tiempo real, iconos en el mapa y ficha con dirección, teléfono y web.
// La web de cada local la pone enlazar_webs.py (de OSM, de un archivo manual o, en las cadenas, la de la marca en
// Wikidata) y solo si se ha comprobado que funciona; la ficha invita al negocio a añadirla o corregirla en OSM.
// Los datos de OSM los mantienen voluntarios: lo que falta o está mal se puede corregir en openstreetmap.org.

export const TEXTOS_LUGARES = {
  es: {
    lugaresBoton: "🛍 Tiendas y lugares", luTitulo: "Tiendas y lugares de interés", luBuscar: "Buscar por nombre o tipo…",
    luAbierto: "Abierto ahora (solo los que tienen horario en OSM: {0})", luTodas: "Todas",
    luResultados: "{0} lugares", luMas: "… y {0} más (afina la búsqueda)", luAbiertoSi: "🟢 Abierto ahora",
    luAbiertoNo: "🔴 Cerrado ahora", luSinHorario: "Horario no indicado en OSM", luClic: "Clic en un icono o en la lista.",
    luNota: "Datos de OpenStreetMap (colaboradores de OSM, ODbL): si falta un comercio o un horario, se puede añadir en " +
      "openstreetmap.org y aparecerá al regenerar la maqueta.",
    luCats: { comida: "🛒 Comida", bares: "🍽 Bares y restaurantes", tiendas: "🛍 Tiendas", salud: "💊 Salud",
            servicios: "🏦 Servicios", cultura: "🎭 Cultura", deporte: "⚽ Deporte y parques", patrimonio: "🏛 Patrimonio",
            ciudad: "♻️ Fuentes, reciclaje, aseos" },
    luWeb: "🌐 Web", luWebMarca: "🌐 Web de la marca", luConWeb: "Solo los que tienen web ({0})", luOtra: "✕ Elegir otra",
    luEsTuyo: "¿Es tu negocio? Añade o corrige su web y su horario en OpenStreetMap",
    luTipos: { fountain: "Fuente", drinking_water: "Fuente de agua potable", charging_station: "Punto de recarga",
             recycling: "Contenedor de reciclaje", toilets: "Aseos públicos", atm: "Cajero", bank: "Banco",
             fuel: "Gasolinera", post_office: "Correos", bicycle_rental: "Alquiler de bicis", car_sharing: "Coche compartido" },
  },
  ca: {
    lugaresBoton: "🛍 Botigues i llocs", luTitulo: "Botigues i llocs d'interès", luBuscar: "Cercar per nom o tipus…",
    luAbierto: "Obert ara (només els que tenen horari a OSM: {0})", luTodas: "Totes",
    luResultados: "{0} llocs", luMas: "… i {0} més (afina la cerca)", luAbiertoSi: "🟢 Obert ara",
    luAbiertoNo: "🔴 Tancat ara", luSinHorario: "Horari no indicat a OSM", luClic: "Clic en una icona o a la llista.",
    luNota: "Dades d'OpenStreetMap (col·laboradors d'OSM, ODbL): si falta un comerç o un horari, es pot afegir a " +
      "openstreetmap.org i apareixerà en regenerar la maqueta.",
    luCats: { comida: "🛒 Menjar", bares: "🍽 Bars i restaurants", tiendas: "🛍 Botigues", salud: "💊 Salut",
            servicios: "🏦 Serveis", cultura: "🎭 Cultura", deporte: "⚽ Esport i parcs", patrimonio: "🏛 Patrimoni",
            ciudad: "♻️ Fonts, reciclatge, lavabos" },
    luWeb: "🌐 Web", luWebMarca: "🌐 Web de la marca", luConWeb: "Només els que tenen web ({0})", luOtra: "✕ Triar-ne una altra",
    luEsTuyo: "És el teu negoci? Afegeix o corregeix el seu web i l'horari a OpenStreetMap",
    luTipos: { fountain: "Font", drinking_water: "Font d'aigua potable", charging_station: "Punt de recàrrega",
             recycling: "Contenidor de reciclatge", toilets: "Lavabos públics", atm: "Caixer", bank: "Banc",
             fuel: "Benzinera", post_office: "Correus", bicycle_rental: "Lloguer de bicis", car_sharing: "Cotxe compartit" },
  },
};

const DIAS_OSM = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** ¿Abierto en (día 0–6, hora decimal)? Formatos habituales de opening_hours: «Mo-Fr 09:00-14:00,17:00-20:00;
 *  Sa 10:00-13:00», «24/7», «Mo-Su 08:00-22:00», «… off». Devuelve null si no se entiende. */
export function abiertoAhora(horario, dia, hora) {
  if (!horario) return null;
  if (horario.trim() === "24/7") return true;
  let resultado = false, entendido = false;
  for (const regla of horario.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/.exec(regla);
    if (!m) continue;
    let dias = new Set(m[1] ? [] : [0, 1, 2, 3, 4, 5, 6]);
    for (const tramo of (m[1] || "").split(",").filter(Boolean)) {
      const [a, b] = tramo.split("-").map((d) => DIAS_OSM.indexOf(d));
      if (a < 0) continue;
      for (let d = a; ; d = (d + 1) % 7) { dias.add(d); if (b === undefined || d === b) break; }
    }
    const resto = m[2].trim();
    if (/^(off|closed)$/i.test(resto)) { if (dias.has(dia)) resultado = false; entendido = true; continue; }
    const horas = [...resto.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
    if (!horas.length) continue;
    entendido = true;
    if (!dias.has(dia)) continue;
    resultado = horas.some(([, h1, m1, h2, m2]) => {
      const a = +h1 + m1 / 60, b = +h2 + m2 / 60;
      return b > a ? hora >= a && hora < b : hora >= a || hora < b;     // pasado medianoche
    });
  }
  return entendido ? resultado : null;
}

const herramientaLugares = {
  id: "lugares",
  textos: TEXTOS_LUGARES,
  crear(ctx, div) {
    const { THREE, t, tx, numero, $ } = ctx;
    const L = ctx.lugaresOsm ?? [];
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);
    const ICONO = Object.fromEntries(Object.entries(TEXTOS_LUGARES.es.luCats).map(([k, v]) => [k, v.split(" ")[0]]));
    // Un icono por lugar (CSS, solo con el panel abierto); clic → ficha
    const marcas = L.map((l, k) => {
      const d = document.createElement("div");
      d.className = "marca";
      Object.assign(d.style, { background: "#fff", color: "#1d2230", border: "2px solid #1d2230", width: "22px", height: "22px",
                               fontSize: "12px" });
      d.textContent = ICONO[l.c] ?? "📍";
      d.title = l.n;
      d.onclick = () => elegir(k);
      const o = new ctx.CSS2DObject(d);
      o.position.set(l.x, ctx.altura(l.x, l.z) + 6, l.z);
      grupo.add(o);
      return o;
    });

    // La ficha, arriba del todo: al elegir una tienda se ve sin bajar (en el móvil, la ventana es corta)
    div.innerHTML = `<b data-t="luTitulo"></b>
      <p id="luFicha" style="margin-top:4px"></p>
      <input id="luBuscar" type="text" style="width:100%;margin-top:8px">
      <div class="botones" id="luCats"></div>
      <label><input type="checkbox" id="luAbierto"> <span id="luAbiertoT"></span></label>
      <label><input type="checkbox" id="luConWeb"> <span id="luConWebT"></span></label>
      <p class="nota" id="luCuenta"></p><ul id="luLista" style="padding-left:0;list-style:none"></ul>
      <p class="nota" data-t="luNota"></p>`;
    let categoria = null, elegido = -1;
    const ahora = () => { const { fecha, hora } = ctx.hora(); return [fecha.getUTCDay(), hora]; };
    const nombre = (l) => l.n || tx("luTipos")[l.t] || l.t;      // sin nombre en OSM: el tipo, traducido
    const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

    function filtrados() {
      const q = $("luBuscar").value.trim().toLowerCase(), [dia, hora] = ahora(), soloAbiertos = $("luAbierto").checked;
      const c = ctx.controls.target;
      return L.map((l, k) => k).filter((k) => {
        const l = L[k];
        if (categoria && l.c !== categoria) return false;
        if (q && !(`${l.n} ${l.t} ${l.d ?? ""}`.toLowerCase().includes(q))) return false;
        if (soloAbiertos && abiertoAhora(l.h, dia, hora) !== true) return false;
        if ($("luConWeb").checked && !l.web) return false;
        return true;
      }).sort((a, b) => ((L[a].x - c.x) ** 2 + (L[a].z - c.z) ** 2) - ((L[b].x - c.x) ** 2 + (L[b].z - c.z) ** 2));
    }

    function elegir(k) {
      elegido = k;
      const l = L[k], [dia, hora] = ahora(), ab = abiertoAhora(l.h, dia, hora);
      const enlace = (url, txt) => `<a href="${esc(url)}" target="_blank" rel="noopener nofollow">${txt}</a>`;
      const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
      const web = l.web ? `<br>${enlace(l.web, `${t(l.wf === "marca" ? "luWebMarca" : "luWeb")}: ${esc(dominio(l.web))}`)}` : "";
      const redes = [l.ig && enlace(l.ig, "Instagram"), l.fb && enlace(l.fb, "Facebook")].filter(Boolean).join(" · ");
      const tel = l.tel ? `<br>📞 <a href="tel:${esc(l.tel.replace(/[^+\d]/g, ""))}">${esc(l.tel)}</a>` : "";
      // Comercios con nombre: enlace para que el propio negocio complete sus datos en OSM (llegan al regenerar)
      const tuyo = l.o && l.n && ["tiendas", "comida", "bares", "salud", "servicios"].includes(l.c)
        ? `<br><small>${enlace(`https://www.openstreetmap.org/edit?${l.o.replace("/", "=")}`, t("luEsTuyo"))}</small>` : "";
      $("luFicha").innerHTML = `<b>${esc(nombre(l))}</b> · ${esc(tx("luCats")[l.c] ?? l.c)} · <small>${esc(l.t)}</small>` +
        (l.d ? `<br>📍 ${esc(l.d)}` : "") + tel + web + (redes ? `<br>${redes}` : "") +
        `<br>${l.h ? `${ab === true ? t("luAbiertoSi") : ab === false ? t("luAbiertoNo") : ""} <small>${esc(l.h)}</small>` : t("luSinHorario")}` +
        tuyo + `<br><button id="luOtra" style="margin-top:8px">${t("luOtra")}</button>`;
      $("luOtra").onclick = () => soltar(true);
      div.scrollTop = 0;
      div.classList.remove("mini");               // (si la hoja estaba plegada en el móvil, se abre)
      ctx.volarA(new THREE.Vector3(l.x, 0, l.z), 0.3);
      for (const [q, o] of marcas.entries()) o.element.style.outline = q === k ? "3px solid #e0703a" : "";
    }

    // En el mapa, solo los 60 iconos más cercanos a donde se mira (cientos de iconos HTML pesan en un móvil);
    // la lista y el buscador tienen todos
    const MAX_ICONOS = 60;
    let ultimoCentro = null, espera = 0;
    function iconosCercanos(f = filtrados()) {
      const visibles = new Set(f.slice(0, MAX_ICONOS));
      if (elegido >= 0) visibles.add(elegido);
      marcas.forEach((o, k) => { o.visible = visibles.has(k); });
      ultimoCentro = ctx.controls.target.clone();
    }
    function actualizar() {
      const f = filtrados();
      iconosCercanos(f);
      $("luCuenta").textContent = t("luResultados", numero(f.length));
      const primeros = f.slice(0, 40);
      $("luLista").replaceChildren(...primeros.map((k) => {
        const l = L[k], li = document.createElement("li");
        li.dataset.x = 1;
        li.style.margin = "3px 0";
        li.textContent = `${ICONO[l.c] ?? "📍"} ${nombre(l)}${l.d ? " · " + l.d : ""}`;
        li.onclick = () => elegir(k);
        return li;
      }), ...(f.length > 40 ? [Object.assign(document.createElement("li"), { textContent: t("luMas", f.length - 40) })] : []));
    }

    /** Deja de marcar la tienda elegida; con «todo», también la búsqueda y los filtros (al cerrar la ventana). */
    function soltar(todo) {
      elegido = -1;
      for (const o of marcas) o.element.style.outline = "";
      $("luFicha").textContent = t("luClic");
      if (todo) {
        $("luBuscar").value = "";
        $("luAbierto").checked = $("luConWeb").checked = false;
        categoria = null;
        rotulos();
      }
      actualizar();
    }
    function rotulos() {
      $("luBuscar").placeholder = t("luBuscar");
      $("luAbiertoT").textContent = t("luAbierto", L.filter((l) => l.h).length);
      $("luConWebT").textContent = t("luConWeb", L.filter((l) => l.web).length);
      const cats = tx("luCats");
      $("luCats").replaceChildren(...[[null, t("luTodas")], ...Object.entries(cats)].map(([k, txt]) => {
        const b = document.createElement("button");
        b.textContent = txt;
        b.classList.toggle("principal", categoria === k);
        b.onclick = () => { categoria = k; rotulos(); actualizar(); };
        return b;
      }));
      if (elegido >= 0) elegir(elegido); else $("luFicha").textContent = t("luClic");
    }
    $("luBuscar").oninput = actualizar;
    $("luAbierto").onchange = $("luConWeb").onchange = actualizar;

    return {
      alMostrar() { grupo.visible = true; rotulos(); actualizar(); },
      alOcultar() { grupo.visible = false; soltar(true); },
      cadaFrame(dt) {
        if (!grupo.visible || (espera -= dt) > 0) return;
        espera = 0.5;
        if (ultimoCentro && ultimoCentro.distanceTo(ctx.controls.target) > 30) iconosCercanos();
      },
      alClic(x, z) {        // el lugar más cercano al clic, a menos de 25 m
        let mejor = -1, dm = 25 * 25;
        for (const k of filtrados()) { const d = (L[k].x - x) ** 2 + (L[k].z - z) ** 2; if (d < dm) { dm = d; mejor = k; } }
        if (mejor >= 0) elegir(mejor);
      },
      traducir() { rotulos(); actualizar(); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaLugares);
