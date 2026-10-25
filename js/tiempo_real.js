// TIEMPO REAL en el mapa: el sol está donde está ahora en Ripollet (día, noche, amanecer y ocaso, con su luz y sus
// sombras) y el tiempo es el de ahora (Open-Meteo, sin clave): nubes que apagan el sol, niebla, lluvia que se ve caer,
// temperatura y viento. Un deslizador mueve la hora para ver el día entero; «Ahora» vuelve al presente.
import { posicionSol } from './sombra.js';

export const TEXTOS_TIEMPO = {
  es: {
    trActivar: "🕐 Tiempo real", trDesactivar: "🕐 Quitar tiempo real", trAhora: "Ahora",
    trHora: "Hora: <b>{0}</b> {1}", trEnDirecto: "(en directo)", trSimulada: "(simulada)",
    trCargando: "consultando el tiempo…", trSinDatos: "sin datos del tiempo (¿sin internet?)",
    trViento: "💨 {0} km/h del {1}", trLluvia: "🌧 {0} mm", trNoche: "noche",
    trFuente: "Tiempo: Open-Meteo · actualizado a las {0}",
    trCielos: { 0: "despejado", 1: "poco nuboso", 2: "nubes y claros", 3: "cubierto", 45: "niebla", 51: "llovizna",
                61: "lluvia", 71: "nieve", 80: "chubascos", 95: "tormenta" },
    trRumbos: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
  ca: {
    trActivar: "🕐 Temps real", trDesactivar: "🕐 Treure temps real", trAhora: "Ara",
    trHora: "Hora: <b>{0}</b> {1}", trEnDirecto: "(en directe)", trSimulada: "(simulada)",
    trCargando: "consultant el temps…", trSinDatos: "sense dades del temps (sense internet?)",
    trViento: "💨 {0} km/h del {1}", trLluvia: "🌧 {0} mm", trNoche: "nit",
    trFuente: "Temps: Open-Meteo · actualitzat a les {0}",
    trCielos: { 0: "serè", 1: "poc ennuvolat", 2: "núvols i clarianes", 3: "cobert", 45: "boira", 51: "plugim",
                61: "pluja", 71: "neu", 80: "ruixats", 95: "tempesta" },
    trRumbos: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
};

const URL_TIEMPO = "https://api.open-meteo.com/v1/forecast?latitude=41.5025&longitude=2.1553" +
  "&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m" +
  "&wind_speed_unit=ms&timezone=Europe%2FMadrid";
const grupoCielo = (c) => (c <= 0 ? 0 : c <= 3 ? c : c < 50 ? 45 : c < 60 ? 51 : c < 70 ? 61 : c < 80 ? 71 : c < 95 ? 80 : 95);
const ICONO = { 0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 51: "🌦", 61: "🌧", 71: "❄️", 80: "🌦", 95: "⛈" };

/** Fecha y hora de reloj en Ripollet (Europe/Madrid), sea cual sea la zona del ordenador. */
function ahoraEnRipollet() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { fecha: new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12)), hora: +p.hour + +p.minute / 60 };
}
const horaTexto = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60 + 1e-6)).padStart(2, "0")}`;

export function crearTiempoReal(ctx, div) {
  const { THREE, scene, sol, cielo, dirSol, t, tx, numero, $ } = ctx;
  let activo = true, desfase = null;
  try { activo = localStorage.getItem("tiempoReal") !== "no"; } catch {}     // desfase: hora elegida con el deslizador (null = en directo)
  let clima = null, error = false, consultado = null, espera = 0, oscuridad = 0;

  div.innerHTML = `<div id="trTexto" style="margin-top:6px"></div>
    <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
      <input type="range" id="trHora" min="0" max="23.75" step="0.25" style="flex:1">
      <button id="trAhora"></button><button id="trBoton"></button></div>
    <div class="nota" id="trFuente" style="margin-top:2px"></div>`;

  // ---------------------------------------------------------------- lluvia que se ve caer (alrededor de la vista)
  const N = 5000, CAJA = 360, ALTO = 140;
  const pos = new Float32Array(N * 6), gota = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    const x = (Math.random() - 0.5) * CAJA, z = (Math.random() - 0.5) * CAJA, f = Math.random();
    for (let e = 0; e < 2; e++) { pos.set([x, 0, z], (k * 2 + e) * 3); gota.set([f, e], (k * 2 + e) * 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("gota", new THREE.BufferAttribute(gota, 2));
  const viento = { value: new THREE.Vector2() };
  const lluvia = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tiempo: ctx.tiempoGotas, alto: { value: ALTO }, viento,
                // Borde de la maqueta: fuera de él no llueve (no hay mapa debajo)
                borde: { value: new THREE.Vector4(ctx.SIM.x0, ctx.SIM.z0, ctx.SIM.x0 + ctx.SIM.nx * ctx.SIM.celda,
                                                  ctx.SIM.z0 + ctx.SIM.ny * ctx.SIM.celda) } },
    vertexShader: `
      attribute vec2 gota;
      uniform float tiempo, alto;
      uniform vec2 viento;
      uniform vec4 borde;
      varying float vA;
      void main() {
        float y = alto - mod(tiempo * 30.0 + gota.x * alto, alto);
        vec3 p = vec3(position.x + viento.x * (alto - y) * 0.03, y + gota.y * 4.0, position.z + viento.y * (alto - y) * 0.03);
        p.xz -= viento * gota.y * 0.12;                      // la gota se inclina con el viento
        vA = 1.0 - gota.y;
        vec4 mundo = modelMatrix * vec4(p, 1.0);
        if (mundo.x < borde.x || mundo.z < borde.y || mundo.x > borde.z || mundo.z > borde.w) vA = -1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vA; void main() { if (vA < 0.0) discard; gl_FragColor = vec4(0.8, 0.86, 0.94, 0.1 + 0.45 * vA); }`,
  }));
  Object.assign(lluvia, { frustumCulled: false, visible: false });
  scene.add(lluvia);

  // ---------------------------------------------------------------- luz y cielo
  const C = (h) => new THREE.Color(h);
  const NOCHE = { real: C(0x14214a), arte: C(0x24336e) }, DIA = { real: C(0xbfe0f5), arte: C(0x5f93dc) };
  const NIEBLA_DIA = { real: C(0xbfe0f5), arte: C(0x9cc0ec) }, GRIS = C(0x9aa6b2), OCASO = C(0xf2a46b);
  const LUZ_SOL = C(0xfff2dd), LUZ_OCASO = C(0xffb070), LUZ_LUNA = C(0x9fb8ff);

  function horaActual() {
    const a = ahoraEnRipollet();
    return desfase === null ? a : { fecha: a.fecha, hora: desfase };
  }

  /** Coloca el sol y pinta el cielo según la hora y el tiempo. Se llama al cambiar algo y cada 20 s. */
  function aplicar() {
    if (!activo) return;
    const arte = ctx.estiloArte() ? "arte" : "real";
    const base = { sol: arte === "arte" ? 2.0 : 2.4, cielo: arte === "arte" ? 2.2 : 1.6 };
    // Con la herramienta de sombra abierta, ella decide dónde está el sol: aquí solo luz de día
    const libre = ctx.solLibre();
    const { fecha, hora } = horaActual();
    const s = posicionSol(fecha, hora), sinE = Math.sin(s.elevacion);
    const dia = libre ? THREE.MathUtils.smoothstep(sinE, -0.1, 0.12) : 1;
    // Alumbrado: se enciende al anochecer (sol a ~3° sobre el horizonte) y del todo con la noche cerrada
    oscuridad = libre ? 1 - THREE.MathUtils.smoothstep(sinE, -0.08, 0.05) : 0;
    const ocaso = libre ? Math.exp(-((((s.elevacion * 180 / Math.PI) - 1) / 6) ** 2)) : 0;
    const vivo = desfase === null && clima;        // el tiempo de ahora solo vale para la hora de ahora
    const nubes = vivo ? clima.nubes / 100 : 0, cod = vivo ? grupoCielo(clima.codigo) : 0;
    const niebla = cod === 45 ? 1 : 0;

    if (libre) {
      if (sinE > -0.02) dirSol.set(Math.sin(s.azimut) * Math.cos(s.elevacion), Math.max(0.05, sinE),
                                   -Math.cos(s.azimut) * Math.cos(s.elevacion)).normalize();
      else dirSol.set(0.3, 1, 0.25).normalize();     // de noche, luz de luna desde arriba
      if (ctx.enMapa()) ctx.sombrasMapa();
    }
    const fondo = NOCHE[arte].clone().lerp(DIA[arte].clone().lerp(GRIS, Math.max(nubes * 0.75, niebla * 0.6)), dia)
      .lerp(OCASO, ocaso * 0.45 * (1 - nubes));
    scene.background.copy(fondo);
    scene.fog.color.copy(NOCHE[arte].clone().lerp(NIEBLA_DIA[arte].clone().lerp(GRIS, Math.max(nubes * 0.6, niebla)), dia));
    if (ctx.enMapa()) {
      const k = ctx.vista?.escala ?? 1;                // con el teleobjetivo de la maqueta, todo está más lejos
      scene.fog.near = (niebla ? 500 : cod >= 51 ? 1200 : 1800) * k;
      scene.fog.far = (niebla ? 1800 : cod >= 51 ? 3500 : 4500) * k;
    }
    const deDia = sinE > -0.02 || !libre;
    sol.intensity = deDia ? base.sol * Math.max(dia, 0.08) * (1 - 0.7 * nubes) * (1 - 0.5 * niebla) : base.sol * 0.22;
    sol.color.copy(deDia ? LUZ_SOL.clone().lerp(LUZ_OCASO, ocaso) : LUZ_LUNA);
    cielo.intensity = base.cielo * (0.45 + 0.55 * dia);
    cielo.color.copy(C(0x5a6fa8).lerp(C(0xffffff), dia));
    // Lluvia visible: solo con el tiempo de ahora y si está lloviendo
    const mm = vivo ? clima.lluvia : 0;
    lluvia.visible = mm > 0.05 || (vivo && cod >= 51 && cod !== 71);
    geo.setDrawRange(0, 2 * Math.round(N * THREE.MathUtils.clamp(Math.max(mm, 0.4) / 4, 0.15, 1)));
    if (vivo) {
      const a = clima.dirViento * Math.PI / 180;    // viene de ahí: sopla hacia el lado contrario
      viento.value.set(-Math.sin(a), Math.cos(a)).multiplyScalar(clima.viento);
    }
    rotulos();
  }

  function apagar() {
    oscuridad = 0;
    lluvia.visible = false;
    dirSol.set(-0.4, 1, 0.3).normalize();
    sol.color.copy(LUZ_SOL);
    cielo.color.set(0xffffff);
    if (ctx.enMapa()) { scene.fog.near = 1800 * (ctx.vista?.escala ?? 1); scene.fog.far = 4500 * (ctx.vista?.escala ?? 1); ctx.sombrasMapa(); }
    ctx.restaurarEstilo();
  }

  async function consultar() {
    try {
      const r = await fetch(URL_TIEMPO);
      if (!r.ok) throw new Error(r.status);
      const c = (await r.json()).current;
      clima = { temperatura: c.temperature_2m, lluvia: c.precipitation, codigo: c.weather_code, nubes: c.cloud_cover,
                viento: c.wind_speed_10m, dirViento: c.wind_direction_10m };
      consultado = horaTexto(ahoraEnRipollet().hora);
      error = false;
    } catch { error = true; }
    aplicar();
  }

  function rotulos() {
    const { hora } = horaActual();
    const partes = [t("trHora", horaTexto(hora), t(desfase === null ? "trEnDirecto" : "trSimulada"))];
    if (desfase === null && clima) {
      const cod = grupoCielo(clima.codigo), s = posicionSol(horaActual().fecha, hora);
      const icono = s.elevacion < 0 && cod <= 1 ? "🌙" : ICONO[cod];
      partes.push(`${icono} ${numero(clima.temperatura, 0)} °C, ${tx("trCielos")[cod]}`,
                  t("trViento", numero(clima.viento * 3.6, 0), tx("trRumbos")[Math.round(clima.dirViento / 45) % 8]));
      if (clima.lluvia > 0) partes.push(t("trLluvia", numero(clima.lluvia, 1)));
    } else if (desfase === null) partes.push(t(error ? "trSinDatos" : "trCargando"));
    $("trTexto").innerHTML = activo ? partes.join(" · ") : "";
    // Resumen corto en la barra de arriba: icono, hora y temperatura
    const chip = document.getElementById("chipTiempo");
    if (chip) {
      const cod = clima && desfase === null ? grupoCielo(clima.codigo) : null;
      const noche = posicionSol(horaActual().fecha, hora).elevacion < 0;
      const icono = cod === null ? (noche ? "🌙" : "☀️") : noche && cod <= 1 ? "🌙" : ICONO[cod];
      chip.textContent = `${icono} ${horaTexto(hora)}${clima && desfase === null ? ` · ${numero(clima.temperatura, 0)}°` : ""}`;
    }
    $("trHora").style.display = $("trAhora").style.display = activo ? "" : "none";
    $("trHora").value = String(hora);
    $("trAhora").textContent = t("trAhora");
    $("trAhora").disabled = desfase === null;
    $("trBoton").textContent = t(activo ? "trDesactivar" : "trActivar");
    $("trFuente").textContent = activo && consultado ? t("trFuente", consultado) : "";
  }

  $("trHora").oninput = () => { desfase = +$("trHora").value; aplicar(); api.alCambiarHora?.(); };
  $("trAhora").onclick = () => { desfase = null; aplicar(); api.alCambiarHora?.(); };
  $("trBoton").onclick = () => {
    activo = !activo;
    try { localStorage.setItem("tiempoReal", activo ? "si" : "no"); } catch {}
    if (activo) aplicar(); else { apagar(); rotulos(); }
  };
  consultar.ultima = Date.now();
  consultar();
  if (activo) aplicar(); else rotulos();

  const api = {
    aplicar,
    traducir: rotulos,
    hora: horaActual,              // la de ahora o la del deslizador (tráfico, gente)
    alCambiarHora: null,
    noche: () => oscuridad,        // 0 de día · 1 de noche (farolas)
    /** Viento de ahora para otras herramientas (incendio): { v en m/s, dir de donde viene en grados } o null. */
    clima: () => (activo && clima ? { viento: clima.viento, dirViento: clima.dirViento, lluvia: clima.lluvia } : null),
    cadaFrame(dt) {
      if (lluvia.visible) {
        const c = ctx.enMapa() ? ctx.controls.target : ctx.camera.position;
        lluvia.position.set(c.x, ctx.altura(c.x, c.z), c.z);
      }
      if (!activo) return;
      espera -= dt;
      if (espera > 0) return;
      espera = 20;                                   // el sol y el reloj, cada 20 s
      aplicar();
      if (desfase === null && Date.now() - (consultar.ultima ?? 0) > 10 * 60 * 1000) {   // el tiempo, cada 10 min
        consultar.ultima = Date.now();
        consultar();
      }
    },
  };
  return api;
}
