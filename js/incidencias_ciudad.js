// INCIDENCIAS CIUDADANAS: baches, farolas, aceras rotas, imbornales atascados… se marcan con un clic, se guardan en el
// navegador y se exportan en CSV (para una hoja de cálculo) o JSON (para volver a importarlas o pasarlas a otro
// sistema), con calle, coordenadas GPS, fecha y estado.

export const TEXTOS_INCIDENCIAS_CIUDAD = {
  es: {
    incidBoton: "📋 Incidencias", icTitulo: "Incidencias en la vía pública",
    icTipo: "Tipo", icNota: "Nota (opcional)", icMarcar: "📍 Marcar en el mapa", icMarcando: "Clic donde está",
    icFiltro: "Mostrar", icTodas: "Todas", icAbiertas: "Sin resolver",
    icResumen: "{0} incidencias · {1} sin resolver.", icVacio: "Todavía no hay incidencias.",
    icCsv: "⬇ CSV", icJson: "⬇ JSON", icImportar: "⬆ Importar JSON", icImportadas: "{0} incidencias importadas.",
    icError: "El archivo no tiene incidencias válidas.", icBorrar: "✕",
    icNotaPie: "Se guardan solo en este navegador: expórtalas para compartirlas. Coordenadas WGS84 aproximadas (±2 m).",
    icTipos: { bache: "🕳 Bache", farola: "💡 Farola apagada", acera: "🚧 Acera rota", imbornal: "🌊 Imbornal atascado",
             arbol: "🌳 Árbol o poda", limpieza: "🗑 Limpieza", mobiliario: "🪑 Mobiliario urbano",
             senal: "🚦 Señal o semáforo", barrera: "♿ Barrera de accesibilidad", otro: "❓ Otro" },
    icEstados: { abierta: "Abierta", curso: "En curso", resuelta: "Resuelta" },
    icColumnas: ["id", "tipo", "estado", "fecha", "calle", "latitud", "longitud", "x", "z", "nota"],
  },
  ca: {
    incidBoton: "📋 Incidències", icTitulo: "Incidències a la via pública",
    icTipo: "Tipus", icNota: "Nota (opcional)", icMarcar: "📍 Marcar al mapa", icMarcando: "Clic on és",
    icFiltro: "Mostrar", icTodas: "Totes", icAbiertas: "Sense resoldre",
    icResumen: "{0} incidències · {1} sense resoldre.", icVacio: "Encara no hi ha incidències.",
    icCsv: "⬇ CSV", icJson: "⬇ JSON", icImportar: "⬆ Importar JSON", icImportadas: "{0} incidències importades.",
    icError: "El fitxer no té incidències vàlides.", icBorrar: "✕",
    icNotaPie: "Es desen només en aquest navegador: exporta-les per compartir-les. Coordenades WGS84 aproximades (±2 m).",
    icTipos: { bache: "🕳 Sot", farola: "💡 Fanal apagat", acera: "🚧 Vorera trencada", imbornal: "🌊 Embornal embussat",
             arbol: "🌳 Arbre o poda", limpieza: "🗑 Neteja", mobiliario: "🪑 Mobiliari urbà",
             senal: "🚦 Senyal o semàfor", barrera: "♿ Barrera d'accessibilitat", otro: "❓ Altres" },
    icEstados: { abierta: "Oberta", curso: "En curs", resuelta: "Resolta" },
    icColumnas: ["id", "tipus", "estat", "data", "carrer", "latitud", "longitud", "x", "z", "nota"],
  },
};

const CLAVE = "ripollet-incidencias-ciudad";
const ESTADOS = ["abierta", "curso", "resuelta"];
const COLOR_ESTADO = { abierta: "#d62839", curso: "#f4a261", resuelta: "#2e9e54" };
// Igual que osm_ripollet.py: proyección equirrectangular en el centro de la maqueta
export const LAT0 = (41.4935 + 41.5115) / 2, LON0 = (2.1470 + 2.1635) / 2;
export const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;

const herramientaIncidencias = {
  id: "incid",
  textos: TEXTOS_INCIDENCIAS_CIUDAD,
  crear(ctx, div) {
    const { THREE, D, SIM, altura, t, tx, $ } = ctx;
    let lista = [], marcando = false, aviso = "";
    try { lista = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch {}
    const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch {} };
    const grupo = new THREE.Group();
    grupo.visible = false;
    ctx.scene.add(grupo);

    div.innerHTML = `<b data-t="icTitulo"></b>
      <label><span data-t="icTipo"></span> <select id="icTipo"></select></label>
      <label><span data-t="icNota"></span><br><input id="icNota" maxlength="200" style="width:100%"></label>
      <div class="botones"><button id="icMarcar"></button></div>
      <p id="icResumen"></p>
      <label><span data-t="icFiltro"></span> <select id="icFiltro"></select></label>
      <ul id="icLista" style="padding-left:0;list-style:none"></ul>
      <div class="botones"><button id="icCsv" data-t="icCsv"></button><button id="icJson" data-t="icJson"></button>
        <button id="icImportar" data-t="icImportar"></button></div>
      <input type="file" id="icArchivo" accept=".json,application/json" style="display:none">
      <p id="icAviso"></p>
      <p class="nota" data-t="icNotaPie"></p>`;

    const calleEn = (x, z) => {
      const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
      const id = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? D.calles[j * SIM.nx + i] : 0;
      return id ? ctx.DATOS.calles[id - 1] : "";
    };
    const gps = (x, z) => ({ lat: +(LAT0 + -z / KY).toFixed(6), lon: +(LON0 + x / KX).toFixed(6) });

    function marcas() {
      grupo.clear();
      for (const inc of visibles()) {
        const d = document.createElement("div");
        d.className = "etiqueta";
        d.style.borderLeft = `4px solid ${COLOR_ESTADO[inc.estado]}`;
        d.textContent = (tx("icTipos")[inc.tipo] ?? "❓").split(" ")[0];
        const o = new ctx.CSS2DObject(d);
        o.position.set(inc.x, altura(inc.x, inc.z) + 4, inc.z);
        grupo.add(o);
      }
    }
    const visibles = () => {
      const f = $("icFiltro").value || "todas";
      return lista.filter((i) => f === "todas" || (f === "abiertas" ? i.estado !== "resuelta" : i.tipo === f));
    };

    function rotulos() {
      const tipos = tx("icTipos"), estados = tx("icEstados");
      const tipo = $("icTipo").value || "bache", filtro = $("icFiltro").value || "todas";
      $("icTipo").innerHTML = Object.entries(tipos).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
      $("icFiltro").innerHTML = `<option value="todas">${t("icTodas")}</option><option value="abiertas">${t("icAbiertas")}</option>`
        + Object.entries(tipos).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
      $("icTipo").value = tipo; $("icFiltro").value = filtro;
      $("icMarcar").textContent = t(marcando ? "icMarcando" : "icMarcar");
      $("icMarcar").classList.toggle("principal", marcando);
      $("icResumen").textContent = lista.length
        ? t("icResumen", lista.length, lista.filter((i) => i.estado !== "resuelta").length) : t("icVacio");
      $("icLista").replaceChildren(...visibles().slice().reverse().map((inc) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        li.style.margin = "4px 0";
        // Texto escapado: las incidencias importadas vienen de un archivo de fuera
        const esc = (x) => String(x ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
        li.innerHTML = `<span style="color:${COLOR_ESTADO[inc.estado]}">●</span> ${esc(tipos[inc.tipo] ?? inc.tipo)} · `
          + `${esc(inc.calle) || "—"} · ${esc(String(inc.fecha ?? "").slice(0, 10))}${inc.nota ? " · " + esc(inc.nota) : ""} `;
        li.onclick = () => ctx.volarA(new THREE.Vector3(inc.x, 0, inc.z), 0.4);
        const estado = document.createElement("button");
        estado.textContent = estados[inc.estado];
        estado.onclick = (e) => {
          e.stopPropagation();
          inc.estado = ESTADOS[(ESTADOS.indexOf(inc.estado) + 1) % 3];
          cambio();
        };
        const borrar = document.createElement("button");
        borrar.textContent = t("icBorrar");
        borrar.onclick = (e) => { e.stopPropagation(); lista.splice(lista.indexOf(inc), 1); cambio(); };
        li.append(estado, " ", borrar);
        return li;
      }));
      $("icAviso").textContent = aviso;
      marcas();
    }
    const cambio = () => { guardar(); rotulos(); };

    function descargar(nombre, contenido, tipo) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    const fecha = () => new Date().toISOString().slice(0, 10);
    $("icCsv").onclick = () => {
      const tipos = tx("icTipos"), estados = tx("icEstados");
      const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const filas = [tx("icColumnas").join(";"), ...lista.map((i) => [i.id, tipos[i.tipo]?.replace(/^\S+ /, "") ?? i.tipo,
        estados[i.estado], i.fecha, i.calle, i.lat, i.lon, i.x, i.z, i.nota].map(celda).join(";"))];
      // BOM para que Excel lea bien los acentos; punto y coma, como lo espera en español y catalán
      descargar(`incidencias_ripollet_${fecha()}.csv`, "﻿" + filas.join("\r\n"), "text/csv;charset=utf-8");
    };
    $("icJson").onclick = () => descargar(`incidencias_ripollet_${fecha()}.json`,
      JSON.stringify({ tipo: "incidencias-ripollet", version: 1, incidencias: lista }, null, 1), "application/json");
    $("icImportar").onclick = () => $("icArchivo").click();
    $("icArchivo").onchange = async () => {
      const f = $("icArchivo").files[0];
      $("icArchivo").value = "";
      if (!f) return;
      let nuevas = [];
      try {
        const j = JSON.parse(await f.text());
        nuevas = (Array.isArray(j) ? j : j.incidencias || []).filter((i) =>
          i && typeof i.id === "string" && Number.isFinite(i.x) && Number.isFinite(i.z) && ESTADOS.includes(i.estado));
      } catch {}
      if (!nuevas.length) { aviso = t("icError"); return rotulos(); }
      const ids = new Map(lista.map((i) => [i.id, i]));
      for (const i of nuevas) ids.set(i.id, { ...ids.get(i.id), ...i });   // la importada manda
      lista = [...ids.values()];
      aviso = t("icImportadas", nuevas.length);
      cambio();
    };
    $("icMarcar").onclick = () => { marcando = !marcando; rotulos(); };
    $("icFiltro").onchange = rotulos;
    rotulos();

    return {
      alMostrar() { grupo.visible = true; rotulos(); },
      alOcultar() { grupo.visible = false; marcando = false; },
      alClic(x, z) {
        if (!marcando) return;
        marcando = false;
        aviso = "";
        lista.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, tipo: $("icTipo").value,
                     estado: "abierta", fecha: new Date().toISOString(), calle: calleEn(x, z), ...gps(x, z),
                     x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, nota: $("icNota").value.trim() });
        $("icNota").value = "";
        cambio();
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaIncidencias);
