// POTENCIAL SOLAR DE LAS CUBIERTAS: irradiación anual de cada cubierta con las sombras de los vecinos y del relieve
// (funciones_datos.py: el día 15 de cada mes, hora a hora, rejilla de 2 m) y, por edificio, potencia y producción
// orientativas. Clic en un tejado para ver el suyo.

export const TEXTOS_SOLAR = {
  es: {
    solarBoton: "☀️ Solar en cubiertas", soTitulo: "Potencial solar de las cubiertas",
    soResumen: "Si se aprovechara la parte útil de todas las cubiertas: <b>{0} MWp</b> y unos <b>{1} GWh/año</b>, el " +
      "consumo de ≈ {2} hogares.",
    soLeyenda: "kWh/m²·año", soClic: "Clic en un tejado para ver su potencial.",
    soEdificio: "<b>Edificio {0}</b>: cubierta ≈ {1} m² · irradiación media {2} kWh/m²·año · <b>{3} kWp</b> · " +
      "<b>{4} kWh/año</b> (≈ {5} hogares).",
    soSinEdificio: "Ahí no hay ningún edificio.", soCorto: "Edificio {0}",
    soEquip: "Cubiertas de los equipamientos (según OSM)", soMejores: "Las 10 cubiertas con más producción",
    soFila: "{0} kWp · {1} MWh/año",
    soNota: "Supuestos: {0} kWh/m²·año en horizontal; se aprovecha el {1} % de una azotea y el {2} % de un tejado " +
      "inclinado; {3} Wp por m² de panel; rendimiento del sistema {4} %; un hogar consume 3 500 kWh/año. No se " +
      "ven chimeneas, antenas ni la estructura. Orientativo: para priorizar estudios, no para dimensionar.",
  },
  ca: {
    solarBoton: "☀️ Solar a les cobertes", soTitulo: "Potencial solar de les cobertes",
    soResumen: "Si s'aprofités la part útil de totes les cobertes: <b>{0} MWp</b> i uns <b>{1} GWh/any</b>, el " +
      "consum de ≈ {2} llars.",
    soLeyenda: "kWh/m²·any", soClic: "Clic en una teulada per veure'n el potencial.",
    soEdificio: "<b>Edifici {0}</b>: coberta ≈ {1} m² · irradiació mitjana {2} kWh/m²·any · <b>{3} kWp</b> · " +
      "<b>{4} kWh/any</b> (≈ {5} llars).",
    soSinEdificio: "Aquí no hi ha cap edifici.", soCorto: "Edifici {0}",
    soEquip: "Cobertes dels equipaments (segons OSM)", soMejores: "Les 10 cobertes amb més producció",
    soFila: "{0} kWp · {1} MWh/any",
    soNota: "Supòsits: {0} kWh/m²·any en horitzontal; s'aprofita el {1} % d'un terrat i el {2} % d'una teulada " +
      "inclinada; {3} Wp per m² de panell; rendiment del sistema {4} %; una llar consumeix 3.500 kWh/any. No es " +
      "veuen xemeneies, antenes ni l'estructura. Orientatiu: per prioritzar estudis, no per dimensionar.",
  },
};

const HOGAR = 3500;   // kWh/año de un hogar (orden de magnitud en España)
const RAMPA = [[900, [70, 40, 140]], [1150, [40, 110, 200]], [1300, [60, 190, 120]], [1420, [250, 210, 50]],
               [1520, [255, 120, 30]]];
const colorDe = (v) => {
  for (let r = 1; r < RAMPA.length; r++)
    if (v <= RAMPA[r][0]) {
      const [a, ca] = RAMPA[r - 1], [b, cb] = RAMPA[r], f = Math.max(0, (v - a) / (b - a));
      return ca.map((x, q) => Math.round(x + (cb[q] - x) * f));
    }
  return RAMPA[RAMPA.length - 1][1];
};

const herramientaSolar = {
  id: "solar",
  textos: TEXTOS_SOLAR,
  crear(ctx, div) {
    const { THREE, D, SIM, t, numero, $ } = ctx;
    const S = ctx.DATOS.solar, T = ctx.capaTechos;
    const sup = S.supuestos;
    const kwpTotal = S.kwp.reduce((a, b) => a + b, 0), kwhTotal = S.kwh.reduce((a, b) => a + b, 0);

    // Por edificio: celdas de cubierta (2 m) e irradiación media, desde el mapa
    const nEd = ctx.DATOS.edificios, celdas = new Uint32Array(nEd + 1), suma = new Float64Array(nEd + 1);
    const cx = new Float64Array(nEd + 1), cz = new Float64Array(nEd + 1);
    for (let j = 0; j < T.ny; j++)
      for (let i = 0; i < T.nx; i++) {
        const k = j * T.nx + i, v = D.solar2m[k];
        if (!v) continue;
        const b = D.edificios[(j >> 1) * SIM.nx + (i >> 1)];
        if (!b) continue;
        celdas[b]++; suma[b] += v * 10;
        cx[b] += SIM.x0 + (i + 0.5) * 2; cz[b] += SIM.z0 + (j + 0.5) * 2;
      }
    const pintar = (resaltado = 0) => {
      T.datos.fill(0);
      for (let k = 0; k < T.nx * T.ny; k++) {
        const v = D.solar2m[k];
        if (!v) continue;
        const i = k % T.nx, j = (k - i) / T.nx, b = D.edificios[(j >> 1) * SIM.nx + (i >> 1)];
        T.datos.set(b && b === resaltado ? [255, 255, 255, 255] : [...colorDe(v * 10), 235], k * 4);
      }
      T.actualizar();
    };

    /** Edificio en (x, z) o, si no hay, el más cercano a menos de 12 m (equipamientos con el punto en la acera). */
    function edificioCerca(x, z) {
      for (let r = 0; r <= 12; r += 4)
        for (let a = 0; a < (r ? 8 : 1); a++) {
          const b = ctx.edificioEn(x + r * Math.cos(a * Math.PI / 4), z + r * Math.sin(a * Math.PI / 4));
          if (b) return b;
        }
      return 0;
    }
    // Un edificio puede tener varios equipamientos: una fila por edificio
    const porEdificio = new Map();
    for (const e of ctx.DATOS.equipamientos) {
      const b = edificioCerca(e.x, e.z);
      if (b && S.kwh[b - 1] > 0) porEdificio.set(b, [...(porEdificio.get(b) ?? []), e.nombre]);
    }
    const equip = [...porEdificio].map(([b, nombres]) => ({ b, nombre: nombres.join(" / ") }))
      .sort((a, b) => S.kwh[b.b - 1] - S.kwh[a.b - 1]);
    const mejores = S.kwh.map((v, q) => q + 1).filter((b) => celdas[b]).sort((a, b) => S.kwh[b - 1] - S.kwh[a - 1]).slice(0, 10);

    div.innerHTML = `<b data-t="soTitulo"></b>
      <p id="soResumen"></p>
      <div class="leyenda" id="soLeyenda"></div>
      <p id="soEdificio"></p>
      <details open><summary data-t="soEquip"></summary><ol id="soEquip"></ol></details>
      <details><summary data-t="soMejores"></summary><ol id="soMejores"></ol></details>
      <p class="nota" id="soNota"></p>`;

    let elegido = 0;
    const textoEdificio = (b) => {
      if (!b) return t("soSinEdificio");
      const m2 = celdas[b] * 4;
      return t("soEdificio", b, numero(m2), numero(celdas[b] ? suma[b] / celdas[b] : 0), numero(S.kwp[b - 1], 1),
               numero(S.kwh[b - 1]), numero(S.kwh[b - 1] / HOGAR, 1));
    };
    function fila(lista, texto, b) {
      const li = document.createElement("li");
      li.textContent = texto;
      li.dataset.x = 1;
      li.onclick = () => {
        elegido = b;
        pintar(b);
        $("soEdificio").innerHTML = textoEdificio(b);
        ctx.volarA(new THREE.Vector3(cx[b] / celdas[b], 0, cz[b] / celdas[b]), 0.5);
      };
      lista.appendChild(li);
    }
    function rotulos() {
      $("soResumen").innerHTML = t("soResumen", numero(kwpTotal / 1000, 1), numero(kwhTotal / 1e6, 1), numero(Math.round(kwhTotal / HOGAR / 100) * 100));
      $("soLeyenda").innerHTML = RAMPA.map(([v, c]) => `<span><i style="background:rgb(${c.join(",")})"></i>${numero(v)}</span>`).join("")
        + ` ${t("soLeyenda")}`;
      $("soEdificio").innerHTML = elegido ? textoEdificio(elegido) : t("soClic");
      const filaTxt = (b) => t("soFila", numero(S.kwp[b - 1], 1), numero(S.kwh[b - 1] / 1000, 1));
      $("soEquip").innerHTML = "";
      for (const { nombre, b } of equip) fila($("soEquip"), `${nombre} · ${filaTxt(b)}`, b);
      $("soMejores").innerHTML = "";
      for (const b of mejores) fila($("soMejores"), `${t("soCorto", b)} · ${filaTxt(b)}`, b);
      $("soNota").innerHTML = t("soNota", numero(sup.ghi), Math.round(sup.util_azotea * 100), Math.round(sup.util_tejado * 100),
                                sup.wpm2, Math.round(sup.rendimiento * 100));
    }

    return {
      alMostrar() { T.ver(true); pintar(elegido); rotulos(); },
      alOcultar() { T.ver(false); },
      alClic(x, z, e) {
        // Lo primero que toca el rayo (el tejado o la fachada), no el suelo de detrás
        const p = ctx.impacto(e) ?? { x, z };
        elegido = edificioCerca(p.x, p.z);
        pintar(elegido);
        $("soEdificio").innerHTML = textoEdificio(elegido);
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaSolar);
