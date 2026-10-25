// INCENDIO FORESTAL EN PINETONS: la franja de protección de 25 m alrededor de las urbanizaciones que tocan el bosque
// (Llei 5/2003 i Decret 123/2005 de la Generalitat) y una propagación del fuego por autómata celular según
// Alexandridis et al. (2008, Applied Mathematics and Computation 204): vegetación, densidad, viento y pendiente.
// Celdas de 4 m (las de la simulación de lluvia). No es un pronóstico: muestra hacia dónde va y qué alcanza.

export const TEXTOS_INCENDIO = {
  es: {
    incendioBoton: "🔥 Incendio forestal", inTitulo: "Incendio forestal en Pinetons",
    inFranja: "Franja de protección de 25 m",
    inFranjaTexto: "<b>{0}</b> edificios tienen alguna parte a menos de 25 m de una masa forestal de más de 1 ha " +
      "(en rojo). Equipamientos dentro: {1}. Franja fuera del bosque: {2} ha.",
    inNinguno: "ninguno",
    inSimular: "Simular un incendio", inViento: "Viento del", inVelocidad: "Velocidad: <b>{0} m/s</b> ({1} km/h)",
    inVientoAhora: "Empieza con el viento de ahora (tiempo real).",
    inPrender: "🔥 Prender (clic en el bosque)", inPrendiendo: "Clic en una zona con vegetación",
    inVeces: "🎲 Repetir 30 veces", inParar: "⏹ Parar",
    inEstado: "Paso {0} · quemado {1} ha · edificios con el fuego a ≤ 25 m: {2}",
    inProb: "En 30 incendios desde ese punto se queman de media <b>{0} ha</b>. <b>{1}</b> edificios tienen el fuego a " +
      "25 m o menos alguna vez (en granate, más oscuro cuantas más veces); el más expuesto, en {2} de cada 10.",
    inCalculando: "Simulando… {0}/30", inLeyArde: "Ardiendo", inLeyQuemado: "Quemado", inLeyFranja: "Franja 25 m",
    inLeyProb: "Probabilidad de quemarse",
    inNota: "Modelo de Alexandridis (2008) con sus coeficientes: no se ha calibrado en Ripollet. Vegetación según " +
      "OSM (bosque, matorral, césped, solares); las calles y los edificios no arden. Un paso es una celda de 4 m de " +
      "avance como mucho: no da tiempos reales. Orientativo, para ver hacia dónde iría y qué casas toca.",
    inRumbos: ["norte", "nordeste", "este", "sudeste", "sur", "sudoeste", "oeste", "noroeste"],
  },
  ca: {
    incendioBoton: "🔥 Incendi forestal", inTitulo: "Incendi forestal als Pinetons",
    inFranja: "Franja de protecció de 25 m",
    inFranjaTexto: "<b>{0}</b> edificis tenen alguna part a menys de 25 m d'una massa forestal de més d'1 ha " +
      "(en vermell). Equipaments a dins: {1}. Franja fora del bosc: {2} ha.",
    inNinguno: "cap",
    inSimular: "Simular un incendi", inViento: "Vent del", inVelocidad: "Velocitat: <b>{0} m/s</b> ({1} km/h)",
    inVientoAhora: "Comença amb el vent d'ara (temps real).",
    inPrender: "🔥 Encendre (clic al bosc)", inPrendiendo: "Clic en una zona amb vegetació",
    inVeces: "🎲 Repetir 30 vegades", inParar: "⏹ Aturar",
    inEstado: "Pas {0} · cremat {1} ha · edificis amb el foc a ≤ 25 m: {2}",
    inProb: "En 30 incendis des d'aquest punt es cremen de mitjana <b>{0} ha</b>. <b>{1}</b> edificis tenen el foc a " +
      "25 m o menys alguna vegada (en granat, més fosc com més vegades); el més exposat, en {2} de cada 10.",
    inCalculando: "Simulant… {0}/30", inLeyArde: "Cremant", inLeyQuemado: "Cremat", inLeyFranja: "Franja 25 m",
    inLeyProb: "Probabilitat de cremar-se",
    inNota: "Model d'Alexandridis (2008) amb els seus coeficients: no s'ha calibrat a Ripollet. Vegetació segons " +
      "OSM (bosc, matoll, gespa, solars); els carrers i els edificis no cremen. Un pas és una cel·la de 4 m d'avanç " +
      "com a màxim: no dona temps reals. Orientatiu, per veure cap on aniria i quines cases toca.",
    inRumbos: ["nord", "nord-est", "est", "sud-est", "sud", "sud-oest", "oest", "nord-oest"],
  },
};

// Alexandridis et al. (2008): p = ph (1 + pveg)(1 + pden) pw ps
const PH = 0.58, C1 = 0.045, C2 = 0.131, A_PENDIENTE = 0.078;
//                 código: 0 urb 1 edif 2 césped 3 bosque 4 matorral 5 agua 6 calzada 7 patio 8 solar 9 muro
const VEG = [null, null, -0.3, 0.4, 0, null, null, null, -0.3, null];   // null: no arde
const DEN = [0, 0, -0.4, 0.3, 0, 0, 0, 0, 0, 0];
const FORESTAL = (c) => c === 3 || c === 4;

const herramientaIncendio = {
  id: "incendio",
  textos: TEXTOS_INCENDIO,
  crear(ctx, div) {
    const { THREE, D, SIM, altura, t, tx, numero, $ } = ctx;
    const { nx, ny, celda } = SIM, n = nx * ny;
    const capa = ctx.capa4m();
    const cota = new Float32Array(n);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        cota[j * nx + i] = altura(SIM.x0 + (i + 0.5) * celda, SIM.z0 + (j + 0.5) * celda) + D.suelo4m[j * nx + i] * 0.02;
    const arde = (k) => VEG[D.codigos[k]] !== null;
    const VECINOS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    // ---------------------------------------------------------------- franja de 25 m
    // Masas forestales de más de 1 ha (componentes conexas) y distancia a ellas por BFS en anillos de 4 m
    const masa = new Uint8Array(n);
    {
      const visto = new Uint8Array(n), cola = new Int32Array(n);
      for (let s = 0; s < n; s++) {
        if (visto[s] || !FORESTAL(D.codigos[s])) continue;
        let a = 0, b = 0;
        cola[b++] = s; visto[s] = 1;
        while (a < b) {
          const k = cola[a++], i = k % nx, j = (k - i) / nx;
          for (const [di, dj] of VECINOS.slice(0, 4)) {
            const ii = i + di, jj = j + dj, v = jj * nx + ii;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || visto[v] || !FORESTAL(D.codigos[v])) continue;
            visto[v] = 1; cola[b++] = v;
          }
        }
        if (b * celda * celda >= 10000) for (let q = 0; q < b; q++) masa[cola[q]] = 1;
      }
    }
    const distancia = new Float32Array(n).fill(Infinity);
    {
      let frente = [];
      for (let k = 0; k < n; k++) if (masa[k]) { distancia[k] = 0; frente.push(k); }
      for (let anillo = 1; anillo * celda <= 25 && frente.length; anillo++) {
        const siguiente = [];
        for (const k of frente) {
          const i = k % nx, j = (k - i) / nx;
          for (const [di, dj] of VECINOS) {
            const ii = i + di, jj = j + dj, v = jj * nx + ii;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || distancia[v] <= anillo * celda) continue;
            const d = distancia[k] + celda * Math.hypot(di, dj);
            if (d < distancia[v] && d <= 25) { distancia[v] = d; siguiente.push(v); }
          }
        }
        frente = siguiente;
      }
    }
    const enFranja = new Uint8Array(ctx.DATOS.edificios + 1);
    let celdasFranja = 0;
    for (let k = 0; k < n; k++) {
      if (distancia[k] === Infinity || masa[k]) continue;
      celdasFranja++;
      if (D.edificios[k]) enFranja[D.edificios[k]] = 1;
    }
    const edificiosFranja = enFranja.reduce((a, b) => a + b, 0);
    const distanciaEn = (x, z) => {
      const i = Math.floor((x - SIM.x0) / celda), j = Math.floor((z - SIM.z0) / celda);
      return i >= 0 && j >= 0 && i < nx && j < ny ? distancia[j * nx + i] : Infinity;
    };
    const equipFranja = ctx.DATOS.equipamientos.filter((e) => distanciaEn(e.x, e.z) <= 25);

    // ---------------------------------------------------------------- autómata celular
    let viento = { dir: 7, v: 8 };         // viene del noroeste (mestral), 8 m/s; o el de ahora (tiempo real)
    const ahora = ctx.clima?.();
    if (ahora) viento = { dir: Math.round(ahora.dirViento / 45) % 8, v: Math.min(20, Math.round(ahora.viento)) };
    function probabilidades() {            // p de cada celda hacia cada vecino: se recalcula al cambiar el viento
      const hacia = ((viento.dir * 45 + 180) % 360) * Math.PI / 180;      // el viento sopla hacia aquí
      const wx = Math.sin(hacia), wz = -Math.cos(hacia);
      return VECINOS.map(([di, dj]) => {
        const l = Math.hypot(di, dj), cosT = (di * wx + dj * wz) / l;
        return { pw: Math.exp(C1 * viento.v) * Math.exp(viento.v * C2 * (cosT - 1)), l: l * celda };
      });
    }
    /** Un incendio desde `inicio`; estado: 0 sin arder · 1 ardiendo · 2 quemado. Devuelve un paso por llamada. */
    function crearIncendio(inicio, azar = Math.random) {
      const estado = new Uint8Array(n), P = probabilidades();
      let frente = [inicio];
      estado[inicio] = 1;
      return {
        estado,
        get activo() { return frente.length > 0; },
        paso() {
          const nuevo = [];
          for (const k of frente) {
            const i = k % nx, j = (k - i) / nx;
            for (let q = 0; q < 8; q++) {
              const ii = i + VECINOS[q][0], jj = j + VECINOS[q][1], v = jj * nx + ii;
              if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || estado[v] || !arde(v)) continue;
              const c = D.codigos[v];
              const ps = Math.exp(A_PENDIENTE * Math.atan((cota[v] - cota[k]) / P[q].l) * 180 / Math.PI);
              if (azar() < PH * (1 + VEG[c]) * (1 + DEN[c]) * P[q].pw * ps) { estado[v] = 1; nuevo.push(v); }
            }
            estado[k] = 2;
          }
          frente = nuevo;
        },
      };
    }
    /** Edificios con alguna celda a 25 m o menos de una celda quemada (la distancia de la franja: calor y pavesas).
     *  Basta con mirar alrededor del borde de lo quemado. */
    const DISCO = [];
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) if (Math.hypot(di, dj) * celda <= 25) DISCO.push([di, dj]);
    function expuestos(estado, conjunto = new Set()) {
      for (let k = 0; k < n; k++) {
        if (!estado[k]) continue;
        const i = k % nx, j = (k - i) / nx;
        if (i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && estado[k - 1] && estado[k + 1] && estado[k - nx] && estado[k + nx]) continue;
        for (const [di, dj] of DISCO) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const b = D.edificios[jj * nx + ii];
          if (b) conjunto.add(b);
        }
      }
      return conjunto;
    }

    // ---------------------------------------------------------------- panel y pintura
    div.innerHTML = `<b data-t="inTitulo"></b>
      <p><b data-t="inFranja"></b><br><span id="inFranjaT"></span></p>
      <p><b data-t="inSimular"></b></p>
      <label><span data-t="inViento"></span> <select id="inDir"></select></label>
      <label><span id="inVelT"></span><br><input type="range" id="inVel" min="0" max="20" step="1" value="${viento.v}" style="width:100%"></label>
      <div class="nota" id="inAhora"></div>
      <div class="botones"><button id="inPrender"></button><button id="inVeces" data-t="inVeces"></button>
        <button id="inParar" data-t="inParar"></button></div>
      <div class="leyenda" id="inLeyenda"></div>
      <p id="inEstado"></p>
      <p class="nota" data-t="inNota"></p>`;

    let prendiendo = false, incendio = null, ultimoInicio = -1, acumulado = 0, numPaso = 0, prob = null, version = 0;
    let textoEstado = null;               // [clave, ...args] para retraducir

    const FRANJA = [255, 170, 60, 120], ARDE = [255, 90, 0, 240], QUEMADO = [45, 35, 35, 220];
    function pintar() {
      const C = capa.datos;
      C.fill(0);
      for (let k = 0; k < n; k++) if (distancia[k] !== Infinity && !masa[k] && !D.edificios[k]) C.set(FRANJA, k * 4);
      if (prob)
        for (let k = 0; k < n; k++) {
          if (!prob[k]) continue;
          const f = prob[k] / 30;
          C.set([255, Math.round(220 * (1 - f)), 40, Math.round(90 + 150 * f)], k * 4);
        }
      else if (incendio)
        for (let k = 0; k < n; k++) if (incendio.estado[k]) C.set(incendio.estado[k] === 1 ? ARDE : QUEMADO, k * 4);
      capa.actualizar();
      // Cubiertas: en la franja (rojo) y expuestas en la simulación (granate)
      const T = ctx.capaTechos, E = incendio && !prob ? expuestos(incendio.estado) : null;
      T.datos.fill(0);
      for (let j = 0; j < T.ny; j++)
        for (let i = 0; i < T.nx; i++) {
          const k = j * T.nx + i;
          if (!D.techos2m[k]) continue;
          const b = D.edificios[(j >> 1) * nx + (i >> 1)];
          if (E?.has(b)) T.datos.set([120, 0, 40, 230], k * 4);
          else if (enFranja[b]) T.datos.set([230, 57, 70, 200], k * 4);
        }
      T.actualizar();
    }

    function rotulos() {
      const sel = $("inDir"), valor = viento.dir;
      sel.innerHTML = tx("inRumbos").map((r, q) => `<option value="${q}">${r}</option>`).join("");
      sel.value = String(valor);
      $("inVelT").innerHTML = t("inVelocidad", viento.v, Math.round(viento.v * 3.6));
      $("inAhora").textContent = ahora ? t("inVientoAhora") : "";
      $("inFranjaT").innerHTML = t("inFranjaTexto", numero(edificiosFranja),
        equipFranja.length ? equipFranja.map((e) => e.nombre).join(", ") : t("inNinguno"),
        numero(celdasFranja * celda * celda / 1e4, 1));
      $("inPrender").textContent = t(prendiendo ? "inPrendiendo" : "inPrender");
      $("inPrender").classList.toggle("principal", prendiendo);
      const caja = (c, k) => `<span><i style="background:rgb(${c.slice(0, 3).join(",")})"></i>${t(k)}</span>`;
      $("inLeyenda").innerHTML = caja(FRANJA, "inLeyFranja") + caja(ARDE, "inLeyArde") + caja(QUEMADO, "inLeyQuemado")
        + `<span><i style="background:linear-gradient(90deg,rgb(255,220,40),rgb(255,0,40))"></i>${t("inLeyProb")}</span>`;
      if (textoEstado) $("inEstado").innerHTML = t(...textoEstado);
    }
    const estadoTexto = (...a) => { textoEstado = a; $("inEstado").innerHTML = t(...a); };

    function celdaQueArde(x, z) {
      const i0 = Math.floor((x - SIM.x0) / celda), j0 = Math.floor((z - SIM.z0) / celda);
      for (let r = 0; r <= 8; r++)
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) {
            const i = i0 + di, j = j0 + dj;
            if (i >= 0 && j >= 0 && i < nx && j < ny && arde(j * nx + i)) return j * nx + i;
          }
      return -1;
    }

    function prender(k) {
      version++;
      ultimoInicio = k;
      prob = null;
      incendio = crearIncendio(k);
      numPaso = 0;
      acumulado = 0;
    }

    async function repetir() {
      if (ultimoInicio < 0) return;
      const mio = ++version;
      incendio = null;
      prob = new Uint8Array(n);
      const veces = new Map();
      let area = 0;
      for (let r = 0; r < 30; r++) {
        estadoTexto("inCalculando", r + 1);
        const f = crearIncendio(ultimoInicio);
        while (f.activo) f.paso();
        for (let k = 0; k < n; k++) if (f.estado[k]) { prob[k]++; area++; }
        for (const b of expuestos(f.estado)) veces.set(b, (veces.get(b) ?? 0) + 1);
        await new Promise((r) => setTimeout(r));
        if (mio !== version) return;
      }
      const maximo = Math.max(0, ...veces.values());
      estadoTexto("inProb", numero(area / 30 * celda * celda / 1e4, 1), numero(veces.size), Math.round(maximo / 3));
      // Las cubiertas expuestas: granate según cuántas veces
      pintar();
      const T = ctx.capaTechos;
      for (let j = 0; j < T.ny; j++)
        for (let i = 0; i < T.nx; i++) {
          const k = j * T.nx + i, b = D.edificios[(j >> 1) * nx + (i >> 1)];
          if (D.techos2m[k] && veces.has(b)) T.datos.set([120, 0, 40, Math.round(100 + 130 * veces.get(b) / 30)], k * 4);
        }
      T.actualizar();
    }

    $("inDir").onchange = () => { viento.dir = +$("inDir").value; };
    $("inVel").oninput = () => { viento.v = +$("inVel").value; rotulos(); };
    $("inPrender").onclick = () => { prendiendo = !prendiendo; rotulos(); };
    $("inVeces").onclick = repetir;
    $("inParar").onclick = () => { version++; incendio = null; prob = null; textoEstado = null; $("inEstado").textContent = ""; pintar(); };

    return {
      alMostrar() {
        capa.malla.visible = true;
        ctx.capaTechos.ver(true);
        rotulos();
        pintar();
      },
      alOcultar() {
        capa.malla.visible = false;
        ctx.capaTechos.ver(false);
        prendiendo = false;
        version++;
        incendio = null;
      },
      alClic(x, z) {
        if (!prendiendo) return;
        const k = celdaQueArde(x, z);
        if (k < 0) return;
        prendiendo = false;
        rotulos();
        prender(k);
      },
      cadaFrame(dt) {
        if (!incendio || !incendio.activo) return;
        acumulado += dt;
        if (acumulado < 0.06) return;
        acumulado = 0;
        incendio.paso();
        numPaso++;
        if (numPaso % 2 === 0 || !incendio.activo) {
          let q = 0;
          for (let k = 0; k < n; k++) q += incendio.estado[k] > 0;
          pintar();
          estadoTexto("inEstado", numPaso, numero(q * celda * celda / 1e4, 2), numero(expuestos(incendio.estado).size));
        }
      },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaIncendio);
