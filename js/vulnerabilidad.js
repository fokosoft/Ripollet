// VULNERABILIDAD POR SECCIÓN CENSAL: renta y población del INE (Atlas de distribución de renta de los hogares) sobre
// los contornos del ICGC/Idescat, cruzados con lo que ya calcula el visor: edificios con agua en una lluvia fuerte,
// sótanos y distancia a un posible refugio climático. Para decidir dónde mirar primero: servicios sociales, avisos
// de calor o de lluvia, ayudas. Son medias por sección (1 300–3 000 vecinos): no dicen nada de ninguna persona.
import { clasesDeProfundidad, edificiosAfectados } from './inundacion.js';

export const TEXTOS_VULNERABILIDAD = {
  es: {
    vulnerBoton: "👥 Vulnerabilidad", vuTitulo: "Vulnerabilidad por sección censal", vuVer: "Ver",
    vuIndice: "Índice de vulnerabilidad", vuRenta: "Renta neta por persona", vuMayores: "% de 65 años o más",
    vuSolos: "% de hogares de una persona", vuPoblacion: "Población",
    vuExplica: "Índice 0–100 dentro de Ripollet: media de tres posiciones (más mayores, más hogares de una persona y " +
      "menos renta, más alto). 100 = la sección más vulnerable de las {0}.",
    vuLista: "Secciones, de más a menos", vuSeccion: "Sección {0}",
    vuFila: "{0} hab. · {1}", vuAgua: "🌊 {0} edificios con agua a {1} mm/h{2}", vuSotanos: " ({0} con sótano)",
    vuLejos: "☀️ {0} % de edificios a más de 300 m de un refugio", vuMayoresN: "≈ {0} personas de 65+",
    vuFicha: "<b>Sección {0}</b> · {1} habitantes · edad media {2} · {3} % de 65+ · {4} % menores de 18 · {5} % " +
      "hogares de una persona · renta neta {6} €/persona ({7} €/hogar) · índice <b>{8}</b>",
    vuSinDatos: "No hay datos de secciones (obtener_vulnerabilidad.py).", vuClic: "Clic en el mapa para ver una sección.",
    vuNota: "INE, Atlas de distribución de renta de los hogares ({0}); contornos ICGC/Idescat (CC BY 4.0). Medias por " +
      "sección: orientan, no identifican a nadie. El agua es la de la simulación física (sin alcantarillado).",
  },
  ca: {
    vulnerBoton: "👥 Vulnerabilitat", vuTitulo: "Vulnerabilitat per secció censal", vuVer: "Veure",
    vuIndice: "Índex de vulnerabilitat", vuRenta: "Renda neta per persona", vuMayores: "% de 65 anys o més",
    vuSolos: "% de llars d'una persona", vuPoblacion: "Població",
    vuExplica: "Índex 0–100 dins de Ripollet: mitjana de tres posicions (més gent gran, més llars d'una persona i " +
      "menys renda, més alt). 100 = la secció més vulnerable de les {0}.",
    vuLista: "Seccions, de més a menys", vuSeccion: "Secció {0}",
    vuFila: "{0} hab. · {1}", vuAgua: "🌊 {0} edificis amb aigua a {1} mm/h{2}", vuSotanos: " ({0} amb soterrani)",
    vuLejos: "☀️ {0} % d'edificis a més de 300 m d'un refugi", vuMayoresN: "≈ {0} persones de 65+",
    vuFicha: "<b>Secció {0}</b> · {1} habitants · edat mitjana {2} · {3} % de 65+ · {4} % menors de 18 · {5} % " +
      "llars d'una persona · renda neta {6} €/persona ({7} €/llar) · índex <b>{8}</b>",
    vuSinDatos: "No hi ha dades de seccions (obtener_vulnerabilidad.py).", vuClic: "Clic al mapa per veure una secció.",
    vuNota: "INE, Atles de distribució de renda de les llars ({0}); contorns ICGC/Idescat (CC BY 4.0). Mitjanes per " +
      "secció: orienten, no identifiquen ningú. L'aigua és la de la simulació física (sense clavegueram).",
  },
};

const INDICADORES_VU = { indice: ["vuIndice", true], renta: ["vuRenta", false], mayores: ["vuMayores", true],
                      solos: ["vuSolos", true], poblacion: ["vuPoblacion", true] };    // [texto, ¿alto = peor?]
const RAMPA_VU = [[46, 158, 84], [160, 200, 60], [245, 190, 30], [240, 120, 30], [214, 40, 57]];
const colorVu = (f) => {
  const x = Math.min(0.999, Math.max(0, f)) * (RAMPA_VU.length - 1), i = Math.floor(x), t = x - i;
  return RAMPA_VU[i].map((c, q) => Math.round(c + (RAMPA_VU[i + 1][q] - c) * t));
};

const herramientaVulnerabilidad = {
  id: "vulner",
  textos: TEXTOS_VULNERABILIDAD,
  crear(ctx, div) {
    const { THREE, D, SIM, t, numero, $ } = ctx;
    const S = ctx.DATOS.secciones?.lista, rejilla = ctx.secciones4m;
    if (!S || !rejilla) { div.innerHTML = `<b data-t="vuTitulo"></b><p data-t="vuSinDatos"></p>`; return {}; }
    const n = SIM.nx * SIM.ny, capa = ctx.capa4m();

    // Edificios: sección (la de su primera celda) y centro
    const nEd = ctx.DATOS.edificios, secEd = new Uint8Array(nEd + 1), cx = new Float64Array(nEd + 1),
          cz = new Float64Array(nEd + 1), cc = new Uint32Array(nEd + 1);
    const centro = S.map(() => ({ x: 0, z: 0, c: 0 }));
    for (let k = 0; k < n; k++) {
      const i = k % SIM.nx, j = (k - i) / SIM.nx, x = SIM.x0 + (i + 0.5) * SIM.celda, z = SIM.z0 + (j + 0.5) * SIM.celda;
      const s = rejilla[k], b = D.edificios[k];
      if (s) { centro[s - 1].x += x; centro[s - 1].z += z; centro[s - 1].c++; }
      if (b) { if (!secEd[b]) secEd[b] = s; cx[b] += x; cz[b] += z; cc[b]++; }
    }
    // Cruces: agua a 60 mm/h (simulación física), sótanos, distancia a un refugio climático
    const iEsc = ctx.INTENSIDADES.indexOf(60), mmh = ctx.INTENSIDADES[iEsc];
    const inundados = ctx.FISICA[iEsc]
      ? edificiosAfectados(clasesDeProfundidad(Float32Array.from(ctx.FISICA[iEsc], (v) => v * 0.02), D.codigos), SIM, D.edificios)
      : new Set();
    const REFUGIO = /bibliot|c[ií]vic|casal|centre de dia|centre obert/i;
    const refugios = ctx.DATOS.equipamientos.filter((e) => e.tipo === "social" && REFUGIO.test(e.nombre));
    const cruce = S.map(() => ({ edificios: 0, agua: 0, sotanos: 0, lejos: 0 }));
    for (let b = 1; b <= nEd; b++) {
      if (!secEd[b] || !cc[b]) continue;
      const c = cruce[secEd[b] - 1], x = cx[b] / cc[b], z = cz[b] / cc[b];
      c.edificios++;
      if (inundados.has(b)) { c.agua++; if (ctx.SOTANOS?.[b - 1]) c.sotanos++; }
      if (!refugios.some((e) => (e.x - x) ** 2 + (e.z - z) ** 2 < 300 * 300)) c.lejos++;
    }

    // Etiquetas en el centro de cada sección (solo con el panel abierto)
    const etiquetas = new THREE.Group();
    etiquetas.visible = false;
    ctx.scene.add(etiquetas);
    const rotulosMapa = [];
    S.forEach((s, q) => {
      if (!centro[q].c) return;
      const d = document.createElement("div");
      d.className = "etiqueta";
      const o = new ctx.CSS2DObject(d);
      const x = centro[q].x / centro[q].c, z = centro[q].z / centro[q].c;
      o.position.set(x, ctx.altura(x, z) + 25, z);
      etiquetas.add(o);
      rotulosMapa.push({ d, q });
    });

    div.innerHTML = `<b data-t="vuTitulo"></b>
      <label><span data-t="vuVer"></span> <select id="vuVer"></select></label>
      <div class="leyenda" id="vuLeyenda"></div>
      <p class="nota" id="vuExplica"></p>
      <p id="vuFicha"></p>
      <details open><summary data-t="vuLista"></summary><ol id="vuLista"></ol></details>
      <p class="nota" id="vuNota"></p>`;
    let elegida = -1;
    const ver = () => $("vuVer").value || "indice";

    function pintar() {
      const clave = ver(), [, altoPeor] = INDICADORES_VU[clave];
      const vals = S.map((s) => s[clave]).filter((v) => v != null), lo = Math.min(...vals), hi = Math.max(...vals);
      const f = (v) => (v == null ? null : altoPeor ? (v - lo) / (hi - lo || 1) : (hi - v) / (hi - lo || 1));
      const C = capa.datos;
      C.fill(0);
      for (let k = 0; k < n; k++) {
        const s = rejilla[k];
        if (!s) continue;
        const v = f(S[s - 1][clave]);
        if (v == null) continue;
        const i = k % SIM.nx;
        const borde = (i > 0 && rejilla[k - 1] !== s) || (i < SIM.nx - 1 && rejilla[k + 1] !== s) ||
                      (k >= SIM.nx && rejilla[k - SIM.nx] !== s) || (k < n - SIM.nx && rejilla[k + SIM.nx] !== s);
        const c = colorVu(v);
        C.set(borde ? [30, 30, 40, 220] : [...c, s - 1 === elegida ? 170 : 105], k * 4);
      }
      capa.actualizar();
      for (const { d, q } of rotulosMapa) {
        const v = S[q][clave];
        d.textContent = `${S[q].codigo} · ${v == null ? "—" : clave === "renta" ? numero(v) + " €" : numero(v, clave === "indice" || clave === "poblacion" ? 0 : 1)}`;
      }
    }

    function ficha(q) {
      const s = S[q];
      $("vuFicha").innerHTML = t("vuFicha", s.codigo, numero(s.poblacion), numero(s.edad, 1), numero(s.mayores, 1),
        numero(s.menores, 1), numero(s.solos, 1), numero(s.renta), numero(s.rentaHogar), s.indice);
    }

    function rotulos() {
      const v = ver();
      $("vuVer").innerHTML = Object.entries(INDICADORES_VU).map(([k, [txt]]) => `<option value="${k}">${t(txt)}</option>`).join("");
      $("vuVer").value = v;
      $("vuLeyenda").innerHTML = `<span><i style="background:linear-gradient(90deg,${RAMPA_VU.map((c) => `rgb(${c})`).join(",")});width:80px"></i></span>`;
      $("vuExplica").textContent = t("vuExplica", S.length);
      $("vuNota").textContent = t("vuNota", ctx.DATOS.secciones.anio?.renta ?? "");
      const [, altoPeor] = INDICADORES_VU[v];
      const orden = S.map((s, q) => q).filter((q) => S[q][v] != null)
        .sort((a, b) => (altoPeor ? S[b][v] - S[a][v] : S[a][v] - S[b][v]));
      $("vuLista").replaceChildren(...orden.map((q) => {
        const s = S[q], c = cruce[q], li = document.createElement("li");
        li.dataset.x = 1;
        const valor = v === "renta" ? `${numero(s.renta)} €` : v === "indice" ? `${t("vuIndice").toLowerCase()} ${s.indice}`
          : numero(s[v], v === "poblacion" ? 0 : 1);
        const avisos = [t("vuMayoresN", numero(Math.round(s.poblacion * s.mayores / 100 / 10) * 10))];
        if (c.agua) avisos.push(t("vuAgua", c.agua, mmh, c.sotanos ? t("vuSotanos", c.sotanos) : ""));
        if (c.edificios && c.lejos / c.edificios > 0.25) avisos.push(t("vuLejos", Math.round(100 * c.lejos / c.edificios)));
        li.innerHTML = `<b>${t("vuSeccion", s.codigo)}</b> · ${t("vuFila", numero(s.poblacion), valor)}<br><small>${avisos.join(" · ")}</small>`;
        li.onclick = () => {
          elegida = q; ficha(q); pintar();
          if (centro[q].c) ctx.volarA(new THREE.Vector3(centro[q].x / centro[q].c, 0, centro[q].z / centro[q].c), 1.2);
        };
        return li;
      }));
      if (elegida >= 0) ficha(elegida); else $("vuFicha").textContent = t("vuClic");
    }
    $("vuVer").onchange = () => { rotulos(); pintar(); };

    return {
      alMostrar() { capa.malla.visible = etiquetas.visible = true; rotulos(); pintar(); },
      alOcultar() { capa.malla.visible = etiquetas.visible = false; },
      alClic(x, z) {
        const i = Math.floor((x - SIM.x0) / SIM.celda), j = Math.floor((z - SIM.z0) / SIM.celda);
        const s = i >= 0 && j >= 0 && i < SIM.nx && j < SIM.ny ? rejilla[j * SIM.nx + i] : 0;
        if (!s) return;
        elegida = s - 1; ficha(elegida); pintar();
      },
      traducir() { rotulos(); pintar(); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaVulnerabilidad);
