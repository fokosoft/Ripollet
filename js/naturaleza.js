// NATURALEZA: los seres vivos observados en la maqueta según GBIF (obtener_naturaleza.py: 3500 observaciones de
// iNaturalist, eBird, Ornitho, herbarios…). La herramienta los pinta por grupos, filtra por la época del año y dice
// qué se ha visto cerca del punto que se toca. Además, siempre en el mapa (de día), bandadas de pájaros animados
// sobrevuelan los sitios con más observaciones de aves: el río, los parques… (golondrinas y vencejos solo de abril a
// septiembre, como en la realidad).

export const TEXTOS_NATURALEZA = {
  es: {
    naturaBoton: "🐦 Naturaleza", naTitulo: "Naturaleza", naResumen: "<b>{0}</b> especies observadas en la zona · {1} observaciones.",
    naTodas: "Todo", naGrupos: { aves: "🐦 Aves", plantas: "🌿 Plantas", insectos: "🦋 Insectos", otros: "🦔 Otros" },
    naEpoca: "Solo lo visto en esta época del año ({0})", naTop: "Lo más observado", naCerca: "Visto a menos de 100 m de aquí",
    naNada: "Nada observado cerca de este punto.", naClic: "Toca el mapa para ver qué se ha observado cerca.",
    naVeces: "{0} obs.", naVerTodas: "Ver todas las especies",
    naMeses: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    naNota: "Observaciones de GBIF.org (iNaturalist, eBird, Ornitho y otras fuentes, de ciudadanos y científicos): " +
      "dicen dónde alguien vio y anotó cada especie, no todo lo que vive aquí. Los pájaros animados del mapa vuelan " +
      "sobre los sitios con más observaciones de aves.",
  },
  ca: {
    naturaBoton: "🐦 Natura", naTitulo: "Natura", naResumen: "<b>{0}</b> espècies observades a la zona · {1} observacions.",
    naTodas: "Tot", naGrupos: { aves: "🐦 Ocells", plantas: "🌿 Plantes", insectos: "🦋 Insectes", otros: "🦔 Altres" },
    naEpoca: "Només el que s'ha vist en aquesta època de l'any ({0})", naTop: "El més observat", naCerca: "Vist a menys de 100 m d'aquí",
    naNada: "No s'ha observat res a prop d'aquest punt.", naClic: "Toca el mapa per veure què s'ha observat a prop.",
    naVeces: "{0} obs.", naVerTodas: "Veure totes les espècies",
    naMeses: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
    naNota: "Observacions de GBIF.org (iNaturalist, eBird, Ornitho i altres fonts, de ciutadans i científics): diuen " +
      "on algú va veure i anotar cada espècie, no tot el que hi viu. Els ocells animats del mapa volen sobre els " +
      "llocs amb més observacions d'ocells.",
  },
};
const GRUPO = (g) => (g === "aves" || g === "plantas" || g === "insectos" ? g : "otros");
const COLOR = { aves: 0x2a6db0, plantas: 0x3e8a3a, insectos: 0xf08a3c, otros: 0x7a4b32 };
const MIGRATORIAS = /^(Hirundo|Delichon|Apus|Tachymarptis|Ptyonoprogne|Riparia)/;   // golondrinas y vencejos

/** Bandadas de pájaros sobre los sitios con más observaciones de aves (siempre en el mapa, de día). */
export function crearPajaros(ctx, N) {
  const { THREE, scene, D } = ctx;
  if (!N) return { cadaFrame() {} };
  const mes = new Date().getMonth() + 1, verano = mes >= 4 && mes <= 9;
  // Casillas de 120 m con más observaciones de aves (sin contar golondrinas fuera de temporada)
  const casillas = new Map();
  for (const [s, x, z] of N.obs) {
    const e = N.especies[s];
    if (e.g !== "aves" || (!verano && MIGRATORIAS.test(e.c))) continue;
    if (Math.abs(x) > D.terreno.lx - 60 || Math.abs(z) > D.terreno.ly - 60) continue;
    const k = `${Math.floor(x / 120)},${Math.floor(z / 120)}`, c = casillas.get(k) ?? { n: 0, x: 0, z: 0 };
    c.n++; c.x += x; c.z += z;
    casillas.set(k, c);
  }
  const centros = [...casillas.values()].sort((a, b) => b.n - a.n).slice(0, 7).map((c) => ({ x: c.x / c.n, z: c.z / c.n }));
  // Un ala = un triángulo; cada pájaro, dos alas que baten
  const ala = new THREE.BufferGeometry();
  ala.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.35, 0, 0, 0.45, 1.3, 0, 0.05], 3));
  ala.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0x23262d, side: THREE.DoubleSide });
  const POR_BANDADA = 7, n = centros.length * POR_BANDADA;
  const izq = new THREE.InstancedMesh(ala, mat, n), dcha = new THREE.InstancedMesh(ala, mat, n);
  const grupo = new THREE.Group();
  grupo.add(izq, dcha);
  for (const m of [izq, dcha]) m.frustumCulled = false;
  scene.add(grupo);
  const pajaros = [];
  centros.forEach((c, b) => {
    const radio = 30 + 25 * ((b * 37) % 7) / 7, alto = 22 + (b % 3) * 7, sentido = b % 2 ? 1 : -1;
    for (let k = 0; k < POR_BANDADA; k++)
      pajaros.push({ c, radio: radio + (k % 3) * 4, alto: alto + ((k * 7) % 5), fase: k * 0.16, sentido,
                     vel: 0.11 + 0.02 * (b % 3), aleteo: 9 + (k % 4), dx: ((k * 13) % 7) - 3 });
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), esc = new THREE.Vector3(2.2, 2.2, 2.2);    // un poco mayores que de verdad: se ven
  let t = 0;
  return {
    grupo,
    cadaFrame(dt) {
      grupo.visible = ctx.enMapa() && (ctx.noche?.() ?? 0) < 0.5;
      if (!grupo.visible) return;
      t += dt;
      pajaros.forEach((b, i) => {
        const a = b.sentido * t * b.vel + b.fase;
        const x = b.c.x + Math.cos(a) * b.radio + b.dx, z = b.c.z + Math.sin(a) * b.radio;
        p.set(x, ctx.altura(b.c.x, b.c.z) + b.alto + Math.sin(t * 0.7 + i) * 1.5, z);
        const rumbo = Math.atan2(-Math.sin(a) * b.sentido, Math.cos(a) * b.sentido) + Math.PI / 2;   // tangente
        const batir = Math.sin(t * b.aleteo + i) * 0.55;
        for (const [malla, lado] of [[izq, -1], [dcha, 1]]) {
          q.setFromEuler(e.set(0, rumbo, 0));
          qa.setFromEuler(e.set(0, lado < 0 ? Math.PI : 0, lado * batir));
          malla.setMatrixAt(i, m4.compose(p, q.clone().multiply(qa), esc));
        }
      });
      izq.instanceMatrix.needsUpdate = dcha.instanceMatrix.needsUpdate = true;
    },
  };
}

const herramientaNaturaleza = {
  id: "natura",
  textos: TEXTOS_NATURALEZA,
  crear(ctx, div) {
    const { THREE, t, tx, numero, $ } = ctx;
    const N = ctx.naturaleza;
    if (!N) { div.innerHTML = `<b data-t="naTitulo"></b><p>—</p>`; return {}; }
    const E = N.especies, O = N.obs.filter(([, x, z]) => Math.abs(x) < ctx.D.terreno.lx && Math.abs(z) < ctx.D.terreno.ly);
    const nombre = (e) => e[ctx.idioma()] ?? e.es ?? e.c;
    const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
    const mesHoy = new Date().getMonth() + 1;
    let grupo = "todas", soloEpoca = false, especie = -1, punto = null;
    const vale = ([s, , , mes]) => (grupo === "todas" || GRUPO(E[s].g) === grupo) && (especie < 0 || s === especie)
      && (!soloEpoca || !mes || Math.min(Math.abs(mes - mesHoy), 12 - Math.abs(mes - mesHoy)) <= 1);

    // Puntos: una bolita por observación, del color de su grupo
    const malla = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), O.length);
    malla.frustumCulled = false;
    malla.visible = false;
    ctx.scene.add(malla);
    const m4 = new THREE.Matrix4(), color = new THREE.Color();
    function pintar() {
      let n = 0;
      for (const o of O) {
        if (!vale(o)) continue;
        const [s, x, z] = o;
        malla.setMatrixAt(n, m4.makeTranslation(x + ((s * 7) % 5) - 2, ctx.altura(x, z) + 2.5, z + ((s * 3) % 5) - 2));
        malla.setColorAt(n++, color.setHex(COLOR[GRUPO(E[s].g)]));
      }
      malla.count = n;
      malla.instanceMatrix.needsUpdate = true;
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    }

    div.innerHTML = `<b data-t="naTitulo"></b><p id="naResumen"></p>
      <div class="botones" id="naGrupos"></div>
      <label><input type="checkbox" id="naEpoca"> <span id="naEpocaT"></span></label>
      <p id="naCercaT" style="margin-top:10px"></p>
      <p class="subtitulo" id="naTopT"></p><ol id="naTop" style="margin:4px 0 0;padding-left:22px"></ol>
      <div class="botones" id="naVerTodasCaja" hidden><button id="naVerTodas"></button></div>
      <p class="nota" data-t="naNota"></p>`;
    const fila = ([s, n]) => `<li data-x="1" data-s="${s}">${esc(nombre(E[s]))} <small><i>${esc(E[s].c)}</i> · ${t("naVeces", n)}</small></li>`;
    function contar(lista) {
      const c = new Map();
      for (const o of lista) if (vale(o)) c.set(o[0], (c.get(o[0]) ?? 0) + 1);
      return [...c.entries()].sort((a, b) => b[1] - a[1]);
    }
    function rotulos() {
      const visibles = O.filter(vale);
      $("naResumen").innerHTML = t("naResumen", numero(new Set(visibles.map((o) => o[0])).size), numero(visibles.length));
      $("naGrupos").innerHTML = [["todas", t("naTodas")], ...Object.entries(tx("naGrupos"))]
        .map(([g, txt]) => `<button data-g="${g}" class="${g === grupo ? "principal" : ""}">${txt}</button>`).join("");
      for (const b of $("naGrupos").children) b.onclick = () => { grupo = b.dataset.g; especie = -1; rotulos(); };
      $("naEpocaT").textContent = t("naEpoca", tx("naMeses")[mesHoy - 1]);
      $("naEpoca").checked = soloEpoca;
      $("naTopT").textContent = t("naTop");
      $("naTop").innerHTML = contar(O).slice(0, 12).map(fila).join("");
      $("naVerTodasCaja").hidden = especie < 0;
      $("naVerTodas").textContent = t("naVerTodas");
      cerca();
      for (const li of div.querySelectorAll("li[data-s]")) {
        li.onclick = () => { especie = +li.dataset.s === especie ? -1 : +li.dataset.s; rotulos(); };
        li.style.fontWeight = +li.dataset.s === especie ? "700" : "";
      }
      pintar();
    }
    function cerca() {
      if (!punto) { $("naCercaT").textContent = t("naClic"); return; }
      const lista = contar(O.filter(([, x, z]) => Math.hypot(x - punto[0], z - punto[1]) < 100)).slice(0, 8);
      $("naCercaT").innerHTML = lista.length ? `<b>${t("naCerca")}</b><ol style="margin:4px 0 0;padding-left:22px">${lista.map(fila).join("")}</ol>`
        : t("naNada");
    }
    $("naEpoca").onchange = () => { soloEpoca = $("naEpoca").checked; rotulos(); };
    $("naVerTodas").onclick = () => { especie = -1; rotulos(); };
    return {
      alMostrar() { malla.visible = true; rotulos(); },
      alOcultar() { malla.visible = false; },
      alClic(x, z) { punto = [x, z]; rotulos(); },
      traducir: rotulos,
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaNaturaleza);
