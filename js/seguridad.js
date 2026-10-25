// SEGURIDAD VIAL: (1) los accidentes con muertos o heridos graves de Ripollet (Servei Català de Trànsit, dades
// obertes); los urbanos no traen ubicación, así que van como estadística. (2) Riesgo POTENCIAL junto a las escuelas
// con lo que ya calcula la maqueta: tráfico estimado, velocidad de la vía y aceras estrechas a menos de 250 m.
// (3) Puntos negros con datos propios: la Policia Local tiene la ubicación de sus atestados; se importan en CSV.
import { crearGrafo } from './rutas.js';
import { imdEstimada } from './trafico.js';
import { LAT0, LON0, KX, KY } from './incidencias_ciudad.js';

export const TEXTOS_SEGURIDAD = {
  es: {
    seguridadBoton: "🚸 Seguridad vial", svTitulo: "Seguridad vial",
    svOficial: "Accidentes graves en Ripollet ({0}–{1})",
    svResumen: "<b>{0}</b> accidentes con muertos o heridos graves: {1} en calle y {2} en carretera. <b>{3}</b> muertos y " +
      "{4} heridos graves. Con peatones: {5} · motos o ciclomotores: {6} · bicicletas: {7} · de noche: {8}.",
    svUrbano: "Calle", svCarretera: "Carretera",
    svSinUbicacion: "Los accidentes urbanos de estos datos no traen ubicación: no se pueden poner en el mapa.",
    svEscuelas: "Riesgo potencial junto a las escuelas (250 m)",
    svFilaEscuela: "{0} — junto a {1}: ≈ {2} veh/día, {3} km/h{4}", svEstrecha: ", acera estrecha {0} %",
    svPropios: "Puntos negros con datos propios",
    svPropiosTexto: "Importa los atestados de la Policia Local (CSV: latitud;longitud;fecha;gravedad;nota). Se quedan solo " +
      "en este navegador.",
    svImportar: "⬆ Importar CSV", svPlantilla: "⬇ Plantilla", svBorrar: "Borrar", svCargados: "{0} accidentes cargados.",
    svNinguno: "Aún no hay datos propios.", svError: "El archivo no tiene filas válidas (latitud;longitud…).",
    svCluster: "{0}: {1} accidentes{2}", svGraves: " ({0} graves)",
    svNota: "Riesgo potencial = tráfico estimado por tipo de vía × velocidad × aceras estrechas, cerca de escuelas: " +
      "señala dónde mirar, no dónde ha habido accidentes. Datos oficiales: Servei Català de Trànsit (rmgc-ncpb).",
  },
  ca: {
    seguridadBoton: "🚸 Seguretat viària", svTitulo: "Seguretat viària",
    svOficial: "Accidents greus a Ripollet ({0}–{1})",
    svResumen: "<b>{0}</b> accidents amb morts o ferits greus: {1} en carrer i {2} en carretera. <b>{3}</b> morts i " +
      "{4} ferits greus. Amb vianants: {5} · motos o ciclomotors: {6} · bicicletes: {7} · de nit: {8}.",
    svUrbano: "Carrer", svCarretera: "Carretera",
    svSinUbicacion: "Els accidents urbans d'aquestes dades no porten ubicació: no es poden posar al mapa.",
    svEscuelas: "Risc potencial a prop de les escoles (250 m)",
    svFilaEscuela: "{0} — a prop de {1}: ≈ {2} veh/dia, {3} km/h{4}", svEstrecha: ", vorera estreta {0} %",
    svPropios: "Punts negres amb dades pròpies",
    svPropiosTexto: "Importa els atestats de la Policia Local (CSV: latitud;longitud;data;gravetat;nota). Es queden només " +
      "en aquest navegador.",
    svImportar: "⬆ Importar CSV", svPlantilla: "⬇ Plantilla", svBorrar: "Esborrar", svCargados: "{0} accidents carregats.",
    svNinguno: "Encara no hi ha dades pròpies.", svError: "El fitxer no té files vàlides (latitud;longitud…).",
    svCluster: "{0}: {1} accidents{2}", svGraves: " ({0} greus)",
    svNota: "Risc potencial = trànsit estimat per tipus de via × velocitat × voreres estretes, a prop d'escoles: " +
      "assenyala on mirar, no on hi ha hagut accidents. Dades oficials: Servei Català de Trànsit (rmgc-ncpb).",
  },
};

const CLAVE_ACC = "ripollet-accidentes";
const FACTOR_VEL = { 20: 0.25, 30: 0.4, 40: 0.7, 50: 1, 60: 1.2, 80: 1.4 };

const herramientaSeguridad = {
  id: "seguridad",
  textos: TEXTOS_SEGURIDAD,
  crear(ctx, div) {
    const { THREE, D, SIM, S1, t, numero, $ } = ctx;
    const A = ctx.DATOS.accidentes?.accidentes ?? [];
    const capa = ctx.capa4m();
    const n4 = (v) => +(v ?? 0);

    // ---------------------------------------------------------------- (2) riesgo potencial junto a las escuelas
    const G = crearGrafo(D);
    const escuelas = ctx.DATOS.equipamientos.filter((e) => e.tipo === "educacion");
    const dentro = (x, z) => x > SIM.x0 && z > SIM.z0 && x < SIM.x0 + SIM.nx * SIM.celda && z < SIM.z0 + SIM.ny * SIM.celda;
    const estrecha = (x, z) => {         // parte de acera de menos de 2 m en 8 m a la redonda (rejilla de 1 m)
      let c = 0, e = 0;
      for (let dj = -8; dj <= 8; dj += 2)
        for (let di = -8; di <= 8; di += 2) {
          const i = Math.floor(x + di - SIM.x0), j = Math.floor(z + dj - SIM.z0);
          if (i < 0 || j < 0 || i >= S1.nx || j >= S1.ny) continue;
          const v = D.acces1m[j * S1.nx + i];
          if (v) { c++; e += (v & 3) === 3; }
        }
      return c ? e / c : 0;
    };
    const tramos = [];
    for (let e = 0; e < G.na; e++) {
      // Autopistas y vías rápidas fuera: no se cruzan a pie (pesan en ruido y aire, no en el camino a la escuela)
      if (!G.vel[e] || G.vel[e] >= 60) continue;
      const a = G.A[3 * e], b = G.A[3 * e + 1], x = (G.x[a] + G.x[b]) / 2, z = (G.z[a] + G.z[b]) / 2;
      if (!dentro(x, z)) continue;
      let cerca = null, dm = 250 * 250;
      for (const s of escuelas) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < dm) { dm = d; cerca = s; } }
      if (!cerca) continue;
      const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
      const id = D.calles[j * SIM.nx + i], nombre = id ? ctx.DATOS.calles[id - 1] : null;
      const imd = imdEstimada(G.vel[e], nombre), est = estrecha(x, z);
      const riesgo = Math.log10(Math.max(imd, 10)) * (FACTOR_VEL[G.vel[e]] ?? 0.7) * (1 + est) * (1 - Math.sqrt(dm) / 500);
      tramos.push({ e, x, z, nombre, escuela: cerca, imd, vel: G.vel[e], est, riesgo });
    }
    const maxRiesgo = Math.max(...tramos.map((q) => q.riesgo), 1);
    // Un renglón por calle y escuela: el tramo de más riesgo
    const porCalle = new Map();
    for (const q of tramos) {
      if (!q.nombre) continue;
      const k = q.nombre + "|" + q.escuela.nombre;
      if (!porCalle.has(k) || porCalle.get(k).riesgo < q.riesgo) porCalle.set(k, q);
    }
    const peores = [...porCalle.values()].sort((a, b) => b.riesgo - a.riesgo).slice(0, 12);

    // ---------------------------------------------------------------- (3) datos propios (CSV)
    let propios = [];
    try { propios = JSON.parse(localStorage.getItem(CLAVE_ACC)) || []; } catch {}
    const geoAxz = (lat, lon) => ({ x: (lon - LON0) * KX, z: -(lat - LAT0) * KY });
    const pines = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 6).translate(0, 3, 0),
                                          new THREE.MeshStandardMaterial({ color: 0xd62839, emissive: 0x550000 }), 2000);
    pines.count = 0;
    pines.visible = false;
    ctx.scene.add(pines);
    function grupos() {       // agrupa en celdas de 40 m: los sitios que más se repiten
      const g = new Map();
      for (const a of propios) {
        const k = `${Math.floor(a.x / 40)},${Math.floor(a.z / 40)}`;
        const c = g.get(k) ?? { n: 0, graves: 0, x: 0, z: 0 };
        c.n++; c.graves += /greu|grave|mort|muert/i.test(a.gravedad ?? "") ? 1 : 0; c.x += a.x; c.z += a.z;
        g.set(k, c);
      }
      return [...g.values()].map((c) => ({ ...c, x: c.x / c.n, z: c.z / c.n })).filter((c) => c.n >= 2)
        .sort((a, b) => b.n - a.n).slice(0, 10);
    }

    // ---------------------------------------------------------------- panel
    div.innerHTML = `<b data-t="svTitulo"></b>
      <p><b id="svOficialT"></b></p><div id="svGrafica" style="display:flex;align-items:flex-end;gap:2px;height:60px"></div>
      <div class="leyenda" id="svLeyenda"></div><p id="svResumen"></p><p class="nota" data-t="svSinUbicacion"></p>
      <details open><summary data-t="svEscuelas"></summary><ol id="svEscuelas"></ol></details>
      <details><summary data-t="svPropios"></summary><p class="nota" data-t="svPropiosTexto"></p>
        <div class="botones"><button id="svImportar" data-t="svImportar"></button><button id="svPlantilla" data-t="svPlantilla"></button>
        <button id="svBorrar" data-t="svBorrar"></button></div>
        <input type="file" id="svArchivo" accept=".csv,text/csv" style="display:none">
        <p id="svEstado"></p><ol id="svGrupos"></ol></details>
      <p class="nota" data-t="svNota"></p>`;
    const URB = [214, 40, 57], CAR = [70, 110, 200];

    function pintar() {
      const C = capa.datos;
      C.fill(0);
      for (const q of tramos) {      // tramos cerca de escuelas, de amarillo a rojo
        const f = q.riesgo / maxRiesgo, a = G.A[3 * q.e], b = G.A[3 * q.e + 1], pasos = Math.max(1, Math.ceil(G.largo[q.e] / 2));
        const c = [255, Math.round(220 * (1 - f)), 40, Math.round(90 + 150 * f)];
        for (let s = 0; s <= pasos; s++) {
          const i = Math.floor((G.x[a] + (G.x[b] - G.x[a]) * s / pasos - SIM.x0) / SIM.celda);
          const j = Math.floor((G.z[a] + (G.z[b] - G.z[a]) * s / pasos - SIM.z0) / SIM.celda);
          if (i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny) C.set(c, (j * SIM.nx + i) * 4);
        }
      }
      // Datos propios: mancha de densidad (radio ~30 m) en morado
      for (const p of propios) {
        const ci = Math.floor((p.x - SIM.x0) / SIM.celda), cj = Math.floor((p.z - SIM.z0) / SIM.celda);
        for (let dj = -7; dj <= 7; dj++)
          for (let di = -7; di <= 7; di++) {
            const i = ci + di, j = cj + dj, d = Math.hypot(di, dj) / 7;
            if (d > 1 || i < 0 || j < 0 || i >= SIM.nx || j >= SIM.ny) continue;
            const k = (j * SIM.nx + i) * 4;
            C[k] = 150; C[k + 1] = 40; C[k + 2] = 190; C[k + 3] = Math.min(240, C[k + 3] + Math.round(60 * (1 - d)));
          }
      }
      capa.actualizar();
      const m = new THREE.Matrix4();
      propios.slice(0, 2000).forEach((p, k) => pines.setMatrixAt(k, m.makeTranslation(p.x, ctx.altura(p.x, p.z), p.z)));
      pines.count = Math.min(2000, propios.length);
      pines.instanceMatrix.needsUpdate = true;
    }

    function rotulos() {
      if (A.length) {
        const anios = A.map((a) => +a.any), a0 = Math.min(...anios), a1 = Math.max(...anios);
        $("svOficialT").textContent = t("svOficial", a0, a1);
        const porAnio = [];
        for (let y = a0; y <= a1; y++) porAnio.push([y, A.filter((a) => +a.any === y)]);
        const maxN = Math.max(...porAnio.map(([, l]) => l.length), 1);
        $("svGrafica").innerHTML = porAnio.map(([y, l]) => {
          const u = l.filter((a) => a.zona === "Zona urbana").length, c = l.length - u;
          return `<div title="${y}: ${l.length}" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
            <div style="height:${100 * c / maxN}%;background:rgb(${CAR})"></div><div style="height:${100 * u / maxN}%;background:rgb(${URB})"></div>
            <small style="font-size:8px;text-align:center">${String(y).slice(2)}</small></div>`;
        }).join("");
        const caja = (c, k) => `<span><i style="background:rgb(${c})"></i>${t(k)}</span>`;
        $("svLeyenda").innerHTML = caja(URB, "svUrbano") + caja(CAR, "svCarretera");
        const sum = (k) => A.reduce((s, a) => s + n4(a[k]), 0), con = (k) => A.filter((a) => n4(a[k]) > 0).length;
        $("svResumen").innerHTML = t("svResumen", A.length, A.filter((a) => a.zona === "Zona urbana").length,
          A.filter((a) => a.zona !== "Zona urbana").length, sum("f_morts"), sum("f_ferits_greus"), con("f_vianants_implicades"),
          A.filter((a) => n4(a.f_motocicletes_implicades) + n4(a.f_ciclomotors_implicades) > 0).length,
          con("f_bicicletes_implicades"), A.filter((a) => /nit/i.test(a.d_lluminositat ?? "")).length);
      }
      $("svEscuelas").replaceChildren(...peores.map((q) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        li.textContent = t("svFilaEscuela", q.nombre, q.escuela.nombre, numero(q.imd), q.vel,
                           q.est > 0.05 ? t("svEstrecha", Math.round(100 * q.est)) : "");
        li.onclick = () => ctx.volarA(new THREE.Vector3(q.x, 0, q.z), 0.5);
        return li;
      }));
      $("svEstado").textContent = propios.length ? t("svCargados", numero(propios.length)) : t("svNinguno");
      $("svGrupos").replaceChildren(...grupos().map((c) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        const i = Math.floor((c.x - SIM.x0) / SIM.celda), j = Math.floor((c.z - SIM.z0) / SIM.celda);
        const calle = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? ctx.nombreCalle(D.calles[j * SIM.nx + i]) : "—";
        li.textContent = t("svCluster", calle, c.n, c.graves ? t("svGraves", c.graves) : "");
        li.onclick = () => ctx.volarA(new THREE.Vector3(c.x, 0, c.z), 0.4);
        return li;
      }));
    }

    $("svPlantilla").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿latitud;longitud;fecha;gravedad;nota\r\n41.4965;2.1534;2025-03-14;leve;ejemplo\r\n"],
                                            { type: "text/csv;charset=utf-8" }));
      a.download = "accidentes_plantilla.csv";
      a.click();
    };
    $("svImportar").onclick = () => $("svArchivo").click();
    $("svArchivo").onchange = async () => {
      const f = $("svArchivo").files[0];
      $("svArchivo").value = "";
      if (!f) return;
      const lineas = (await f.text()).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
      const sep = lineas[0].includes(";") ? ";" : ",";
      const cab = lineas[0].toLowerCase().split(sep).map((c) => c.trim());
      const col = (...n) => cab.findIndex((c) => n.includes(c));
      const iLat = col("latitud", "lat", "latitude"), iLon = col("longitud", "lon", "lng", "longitude");
      const iF = col("fecha", "data", "date"), iG = col("gravedad", "gravetat", "severity"), iN = col("nota", "notes");
      const nuevos = [];
      for (const l of lineas.slice(1)) {
        const c = l.split(sep), lat = parseFloat((c[iLat] ?? "").replace(",", ".")), lon = parseFloat((c[iLon] ?? "").replace(",", "."));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        nuevos.push({ ...geoAxz(lat, lon), fecha: c[iF] ?? "", gravedad: c[iG] ?? "", nota: c[iN] ?? "" });
      }
      if (!nuevos.length) { $("svEstado").textContent = t("svError"); return; }
      propios = nuevos.filter((p) => dentro(p.x, p.z));
      try { localStorage.setItem(CLAVE_ACC, JSON.stringify(propios)); } catch {}
      rotulos(); pintar();
    };
    $("svBorrar").onclick = () => {
      propios = [];
      try { localStorage.removeItem(CLAVE_ACC); } catch {}
      rotulos(); pintar();
    };

    return {
      alMostrar() { capa.malla.visible = pines.visible = true; rotulos(); pintar(); },
      alOcultar() { capa.malla.visible = pines.visible = false; },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaSeguridad);
