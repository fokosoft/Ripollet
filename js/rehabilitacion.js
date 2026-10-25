// REHABILITACIÓN ENERGÉTICA: dónde priorizar ayudas. Por edificio: año de construcción y viviendas (Catastro),
// certificados de eficiencia energética (ICAEN, por referencia catastral), vulnerabilidad de su sección censal
// (INE) y potencial solar de la cubierta (calculado en el visor). Prioridad 0–100 =
//   40 % antigüedad (antes de 1980 no había exigencias de aislamiento: NBE-CT-79) +
//   35 % parte de viviendas certificadas con E, F o G (si no hay certificados, lo esperable por su año) +
//   25 % índice de vulnerabilidad de su sección.

export const TEXTOS_REHABILITACION = {
  es: {
    rehabBoton: "🏚 Rehabilitación", rhTitulo: "Rehabilitación energética", rhVer: "Ver",
    rhPrioridad: "Prioridad", rhAnio: "Año de construcción", rhCert: "Certificado energético (emisiones)",
    rhResumen: "<b>{0}</b> edificios de viviendas; <b>{1}</b> son anteriores a 1980 ({2} viviendas). {3} certificados " +
      "en {4} edificios: el <b>{5} %</b> con E, F o G. {6} edificios con placas solares según sus certificados.",
    rhLista: "Los 15 con más prioridad", rhSinDir: "Edificio {0}",
    rhFila: "{0} · {1} viv. · prioridad {2}", rhFicha: "<b>{0}</b> · {1} · {2} viviendas · {3} · prioridad <b>{4}</b>" +
      " · potencial solar {5} kWp ({6} MWh/año)", rhSinAnio: "año desconocido", rhConstruido: "de {0}",
    rhCerts: "{0} certificados ({1} con E–G, mediana {2})", rhSinCerts: "sin certificados", rhClic: "Clic en un edificio.",
    rhPotencial: "Los 100 con más prioridad podrían poner {0} kWp de placas ({1} MWh/año).",
    rhNota: "Prioridad = 40 % antigüedad + 35 % parte de viviendas con E–G (o lo esperable por su año si no hay " +
      "certificados) + 25 % vulnerabilidad de la sección. Certificados: ICAEN (dades obertes), solo de las viviendas " +
      "que lo han pedido (venta, alquiler, ayudas). Catastro: año y viviendas. Orientativo, para priorizar visitas.",
    usos: ["", "residencial", "industrial", "equipamiento", "comercio", "oficinas", "agrícola"],
  },
  ca: {
    rehabBoton: "🏚 Rehabilitació", rhTitulo: "Rehabilitació energètica", rhVer: "Veure",
    rhPrioridad: "Prioritat", rhAnio: "Any de construcció", rhCert: "Certificat energètic (emissions)",
    rhResumen: "<b>{0}</b> edificis d'habitatges; <b>{1}</b> són anteriors a 1980 ({2} habitatges). {3} certificats " +
      "en {4} edificis: el <b>{5} %</b> amb E, F o G. {6} edificis amb plaques solars segons els seus certificats.",
    rhLista: "Els 15 amb més prioritat", rhSinDir: "Edifici {0}",
    rhFila: "{0} · {1} hab. · prioritat {2}", rhFicha: "<b>{0}</b> · {1} · {2} habitatges · {3} · prioritat <b>{4}</b>" +
      " · potencial solar {5} kWp ({6} MWh/any)", rhSinAnio: "any desconegut", rhConstruido: "de {0}",
    rhCerts: "{0} certificats ({1} amb E–G, mediana {2})", rhSinCerts: "sense certificats", rhClic: "Clic en un edifici.",
    rhPotencial: "Els 100 amb més prioritat podrien posar {0} kWp de plaques ({1} MWh/any).",
    rhNota: "Prioritat = 40 % antiguitat + 35 % part d'habitatges amb E–G (o l'esperable pel seu any si no hi ha " +
      "certificats) + 25 % vulnerabilitat de la secció. Certificats: ICAEN (dades obertes), només dels habitatges que " +
      "l'han demanat (venda, lloguer, ajuts). Cadastre: any i habitatges. Orientatiu, per prioritzar visites.",
    usos: ["", "residencial", "industrial", "equipament", "comerç", "oficines", "agrícola"],
  },
};

const LETRAS = " ABCDEFG";
const COLOR_LETRA = [[150, 150, 150], [0, 166, 81], [80, 184, 72], [191, 215, 48], [255, 242, 0], [253, 185, 19],
                     [243, 112, 33], [237, 28, 36]];
const RAMPA_RH = [[46, 158, 84], [160, 200, 60], [245, 190, 30], [240, 120, 30], [214, 40, 57]];
const colorRh = (f) => {
  const x = Math.min(0.999, Math.max(0, f)) * (RAMPA_RH.length - 1), i = Math.floor(x), t = x - i;
  return RAMPA_RH[i].map((c, q) => Math.round(c + (RAMPA_RH[i + 1][q] - c) * t));
};
const colorAnio = (a) => (!a ? [150, 150, 150] : a < 1940 ? [150, 30, 40] : a < 1960 ? [214, 40, 57] : a < 1980 ? [240, 120, 30]
                          : a < 2007 ? [245, 190, 30] : [46, 158, 84]);

const herramientaRehabilitacion = {
  id: "rehab",
  textos: TEXTOS_REHABILITACION,
  crear(ctx, div) {
    const { THREE, D, SIM, t, tx, numero, $ } = ctx;
    const R = ctx.rehab, nEd = ctx.DATOS.edificios, T = ctx.capaTechos;
    if (!R) { div.innerHTML = `<b data-t="rhTitulo"></b><p>—</p>`; return {}; }
    const campo = (b, q) => R[(b - 1) * 5 + q];
    const anio = (b) => campo(b, 0), viv = (b) => campo(b, 1), nCert = (b) => campo(b, 2), malos = (b) => campo(b, 3);
    const letra = (b) => campo(b, 4) & 7, pv = (b) => (campo(b, 4) >> 3) & 1, uso = (b) => campo(b, 4) >> 4;
    const vivienda = (b) => uso(b) === 1 || (uso(b) === 0 && viv(b) > 0);

    // Sección de cada edificio (para el factor social) y centro (para volar)
    const secEd = new Uint8Array(nEd + 1), sx = new Float64Array(nEd + 1), sz = new Float64Array(nEd + 1), sc = new Uint32Array(nEd + 1);
    for (let k = 0; k < SIM.nx * SIM.ny; k++) {
      const b = D.edificios[k];
      if (!b) continue;
      if (!secEd[b] && ctx.secciones4m) secEd[b] = ctx.secciones4m[k];
      const i = k % SIM.nx;
      sx[b] += SIM.x0 + (i + 0.5) * SIM.celda; sz[b] += SIM.z0 + ((k - i) / SIM.nx + 0.5) * SIM.celda; sc[b]++;
    }
    const indiceSeccion = (b) => (secEd[b] ? ctx.DATOS.secciones?.lista?.[secEd[b] - 1]?.indice ?? 50 : 50) / 100;
    const prioridad = new Float32Array(nEd + 1);
    for (let b = 1; b <= nEd; b++) {
      if (!vivienda(b)) continue;
      const a = anio(b);
      const fEdad = !a ? 0.5 : a < 1960 ? 1 : a < 1980 ? 0.85 : a < 2007 ? 0.4 : 0.05;
      const fCert = nCert(b) ? malos(b) / nCert(b) : !a ? 0.6 : a < 1980 ? 0.8 : a < 2007 ? 0.5 : 0.1;
      prioridad[b] = Math.round(100 * (0.4 * fEdad + 0.35 * fCert + 0.25 * indiceSeccion(b)));
    }
    const viviendas = [...Array(nEd).keys()].map((k) => k + 1).filter(vivienda);
    // A igual prioridad, primero los que tienen más viviendas (una ayuda llega a más gente)
    const orden = viviendas.slice().sort((a, b) => prioridad[b] - prioridad[a] || viv(b) - viv(a));
    // Las direcciones de los certificados vienen a veces en mayúsculas: «Carrer MONTCADA» → «Carrer Montcada»
    const bonita = (s) => s.replace(/\p{Lu}{2,}/gu, (w) => w[0] + w.slice(1).toLowerCase());
    const nombre = (b) => (ctx.DATOS.direcciones?.[b] ? bonita(ctx.DATOS.direcciones[b]) : t("rhSinDir", b));

    div.innerHTML = `<b data-t="rhTitulo"></b>
      <label><span data-t="rhVer"></span> <select id="rhVer"></select></label>
      <div class="leyenda" id="rhLeyenda"></div>
      <p id="rhResumen"></p><p id="rhFicha"></p><p class="nota" id="rhPotencial"></p>
      <details open><summary data-t="rhLista"></summary><ol id="rhLista"></ol></details>
      <p class="nota" data-t="rhNota"></p>`;
    let elegido = 0;
    const ver = () => $("rhVer").value || "prioridad";

    function pintar() {
      const v = ver();
      T.datos.fill(0);
      for (let j = 0; j < T.ny; j++)
        for (let i = 0; i < T.nx; i++) {
          const k = j * T.nx + i;
          if (!D.techos2m[k]) continue;
          const b = D.edificios[(j >> 1) * SIM.nx + (i >> 1)];
          if (!b) continue;
          let c;
          if (b === elegido) c = [255, 255, 255];
          else if (v === "anio") c = colorAnio(anio(b));
          else if (v === "cert") c = COLOR_LETRA[letra(b)];
          else c = vivienda(b) ? colorRh(prioridad[b] / 100) : null;
          if (c) T.datos.set([...c, 230], k * 4);
        }
      T.actualizar();
    }

    function ficha(b) {
      if (!b) { $("rhFicha").textContent = t("rhClic"); return; }
      const certs = nCert(b) ? t("rhCerts", nCert(b), malos(b), LETRAS[letra(b)]) : t("rhSinCerts");
      $("rhFicha").innerHTML = t("rhFicha", nombre(b), anio(b) ? t("rhConstruido", anio(b)) : t("rhSinAnio"), viv(b),
        `${tx("usos")[uso(b)] || "—"} · ${certs}`, vivienda(b) ? prioridad[b] : "—",
        numero(ctx.DATOS.solar?.kwp?.[b - 1] ?? 0, 1), numero((ctx.DATOS.solar?.kwh?.[b - 1] ?? 0) / 1000, 1));
    }

    function rotulos() {
      const v = ver();
      $("rhVer").innerHTML = [["prioridad", "rhPrioridad"], ["anio", "rhAnio"], ["cert", "rhCert"]]
        .map(([k, txt]) => `<option value="${k}">${t(txt)}</option>`).join("");
      $("rhVer").value = v;
      const caja = (c, txt) => `<span><i style="background:rgb(${c.join(",")})"></i>${txt}</span>`;
      $("rhLeyenda").innerHTML = v === "cert" ? COLOR_LETRA.map((c, q) => caja(c, q ? LETRAS[q] : "—")).join("")
        : v === "anio" ? [[1930, "<1940"], [1950, "1940–59"], [1970, "1960–79"], [1990, "1980–2006"], [2010, "2007+"]]
          .map(([a, txt]) => caja(colorAnio(a), txt)).join("")
        : `<span><i style="background:linear-gradient(90deg,${RAMPA_RH.map((c) => `rgb(${c})`).join(",")});width:80px"></i>0–100</span>`;
      const antiguos = viviendas.filter((b) => anio(b) && anio(b) < 1980);
      const conCert = viviendas.filter((b) => nCert(b));
      const totalCert = conCert.reduce((s, b) => s + nCert(b), 0), totalMalos = conCert.reduce((s, b) => s + malos(b), 0);
      $("rhResumen").innerHTML = t("rhResumen", numero(viviendas.length), numero(antiguos.length),
        numero(antiguos.reduce((s, b) => s + viv(b), 0)), numero(totalCert), numero(conCert.length),
        Math.round(100 * totalMalos / Math.max(1, totalCert)), numero(viviendas.filter((b) => pv(b)).length));
      const top = orden.slice(0, 100);
      $("rhPotencial").textContent = t("rhPotencial", numero(top.reduce((s, b) => s + (ctx.DATOS.solar?.kwp?.[b - 1] ?? 0), 0)),
        numero(top.reduce((s, b) => s + (ctx.DATOS.solar?.kwh?.[b - 1] ?? 0), 0) / 1000));
      $("rhLista").replaceChildren(...orden.slice(0, 15).map((b) => {
        const li = document.createElement("li");
        li.dataset.x = 1;
        li.textContent = t("rhFila", nombre(b), viv(b), prioridad[b]) + (anio(b) ? ` · ${anio(b)}` : "");
        li.onclick = () => {
          elegido = b; ficha(b); pintar();
          if (sc[b]) ctx.volarA(new THREE.Vector3(sx[b] / sc[b], 0, sz[b] / sc[b]), 0.45);
        };
        return li;
      }));
      ficha(elegido);
    }
    $("rhVer").onchange = () => { rotulos(); pintar(); };

    return {
      alMostrar() { T.ver(true); rotulos(); pintar(); },
      alOcultar() { T.ver(false); },
      alClic(x, z, e) {
        const p = ctx.impacto(e) ?? { x, z };
        elegido = ctx.edificioEn(p.x, p.z);
        ficha(elegido); pintar();
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaRehabilitacion);
