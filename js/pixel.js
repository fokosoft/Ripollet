// MAQUETA PÍXEL: la escena se dibuja a baja resolución y se amplía con píxeles nítidos, con paleta limitada
// (32 colores de diorama), tramado ordenado opcional y contornos donde cambia la profundidad, como un diorama de pixel art.
// La vista «maqueta» usa un teleobjetivo (casi isométrica) y gira de 90 en 90°. Además es más ligera: con píxeles
// de 4, la GPU dibuja 16 veces menos.

export const TEXTOS_PIXEL = {
  es: {
    vsTitulo: "🎛 Vista", vsPixel: "Píxel", vs3d: "3D", vsTam: "Tamaño del píxel: <b>{0}</b>", vsPaleta: "Paleta",
    vsTramado: "Tramado", vsContornos: "Contornos", vsMaqueta: "Maqueta", vsIzq: "⟲ Girar", vsDer: "Girar ⟳",
    vsCalidad: "Calidad", vsAlta: "Alta (con sombras)", vsLigera: "Ligera (PC modesto o móvil)",
  },
  ca: {
    vsTitulo: "🎛 Vista", vsPixel: "Píxel", vs3d: "3D", vsTam: "Mida del píxel: <b>{0}</b>", vsPaleta: "Paleta",
    vsTramado: "Tramat", vsContornos: "Contorns", vsMaqueta: "Maqueta", vsIzq: "⟲ Girar", vsDer: "Girar ⟳",
    vsCalidad: "Qualitat", vsAlta: "Alta (amb ombres)", vsLigera: "Lleugera (PC modest o mòbil)",
  },
};

// Paleta de diorama (sRGB): grises limpios, verdes de césped, tierras, tejas, asfalto, agua y acentos
const PALETA = ["ffffff", "f4f4f2", "d9dad6", "b0b3b8", "8a8f99", "5f6470", "3c404a", "23262d", "16181d",
  "f5ead0", "e3c9a0", "c9a27a", "a8744f", "7a4b32", "54301f",
  "8cc63f", "5aa63a", "3e8a3a", "2c6b30", "3fa7a0",
  "e05a4a", "b8322f", "7d1f24", "f29ab0", "f08a3c", "f2c14e", "f7e08a",
  "9fd3f0", "4ea3d8", "2a6db0", "1f3f74", "2e3138"];
const FOV_MAQUETA = 14;

export function crearPixelado(ctx, div) {
  const { THREE, renderer, scene, camera, controls, t, $ } = ctx;
  const leer = (k, d) => { try { const v = localStorage.getItem("pixel." + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem("pixel." + k, JSON.stringify(v)); } catch {} };
  const parametros = new URLSearchParams(location.search);
  const op = {
    activo: parametros.has("real") || parametros.has("arte") ? false : leer("activo", true),
    tam: leer("tam", 4), paleta: leer("paleta", true), tramado: leer("tramado", false), contornos: leer("contornos", true),
    maqueta: parametros.has("real") ? false : leer("maqueta", true),
    // Ligera: sin sombras proyectadas (lo más caro) y resolución 1:1; por defecto en pantallas táctiles
    calidad: leer("calidad", matchMedia("(pointer: coarse)").matches ? "ligera" : "alta"),
  };

  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
                                                 depthTexture: new THREE.DepthTexture(1, 1) });
  const fondoClaro = new THREE.Color(0xeef0f4);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uTam: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 1 }, uFar: { value: 1e4 }, uPaleta: { value: 1 }, uTramado: { value: 0 }, uContornos: { value: 1 },
      uFondo: { value: new THREE.Color() }, uDesp: { value: new THREE.Vector2() }, uRejilla: { value: 1 }, uPal: { value: PALETA.map((h) => new THREE.Color("#" + h).convertLinearToSRGB()) },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tColor, tDepth;
      uniform vec2 uTam, uDesp;
      uniform float uNear, uFar, uPaleta, uTramado, uContornos, uRejilla;
      uniform vec3 uFondo;
      uniform vec3 uPal[32];
      varying vec2 vUv;
      float lineal(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      vec3 aSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float bayer(vec2 p) {
        int i = int(mod(p.x, 4.0)) + 4 * int(mod(p.y, 4.0));
        float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        return m[i] / 16.0 - 0.47;
      }
      void main() {
        vec2 uv = vUv + uDesp;                        // el resto del encaje al píxel (ver render)
        float d0 = texture2D(tDepth, uv).r;
        vec3 c = d0 >= 0.99999 ? uFondo : aSRGB(texture2D(tColor, uv).rgb);
        // Fondo: la mesa del diorama, con una rejilla de puntos fija a la pantalla (vUv: no tiembla al encajar)
        if (d0 >= 0.99999 && uRejilla > 0.5) {
          vec2 q = mod(floor(vUv * uTam), 6.0);
          if (q.x < 0.5 && q.y < 0.5) c = mix(c, vec3(0.09, 0.1, 0.13), 0.13);
        }
        // Contorno: este píxel está delante de un vecino bastante más lejano (borde de un objeto o de la maqueta)
        float borde = 0.0;
        if (uContornos > 0.5 && d0 < 0.99999) {
          float l0 = lineal(d0), umbral = max(0.8, l0 * 0.012);
          vec2 p = 1.0 / uTam;
          for (int k = 0; k < 4; k++) {
            vec2 o = k == 0 ? vec2(p.x, 0.0) : k == 1 ? vec2(-p.x, 0.0) : k == 2 ? vec2(0.0, p.y) : vec2(0.0, -p.y);
            float d = texture2D(tDepth, uv + o).r;
            if ((d >= 0.99999 ? 1e9 : lineal(d)) - l0 > umbral) borde = 1.0;
          }
        }
        if (uPaleta > 0.5 && d0 < 0.99999) {
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = clamp(mix(vec3(lum), c, 1.15), 0.0, 1.0);                 // un poco más de color, como el pixel art
          if (uTramado > 0.5) c += bayer(floor(uv * uTam)) * 0.09;
          vec3 mejor = uPal[0]; float dm = 1e9;
          for (int q = 0; q < 32; q++) {
            vec3 e = c - uPal[q];
            float dd = dot(e * e, vec3(2.0, 4.0, 3.0));
            if (dd < dm) { dm = dd; mejor = uPal[q]; }
          }
          c = mejor;
        }
        c = mix(c, vec3(0.09, 0.08, 0.15), borde * 0.75);
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const derecha = new THREE.Vector3(), arriba = new THREE.Vector3(), guardada = new THREE.Vector3();
  const escenaQuad = new THREE.Scene(), camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  escenaQuad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function render() {
    const w = Math.max(1, Math.floor(innerWidth / op.tam)), h = Math.max(1, Math.floor(innerHeight / op.tam));
    if (rt.width !== w || rt.height !== h) { rt.setSize(w, h); mat.uniforms.uTam.value.set(w, h); }
    const U = mat.uniforms;
    U.uNear.value = camera.near; U.uFar.value = camera.far;
    U.uRejilla.value = +ctx.enMapa();       // la mesa solo en el mapa (conduciendo, el fondo es el cielo)
    U.uPaleta.value = +op.paleta; U.uTramado.value = +op.tramado; U.uContornos.value = +op.contornos;
    // Fondo claro como en un diorama; de noche, el del cielo aclarado
    U.uFondo.value.copy(scene.background).lerp(fondoClaro, 0.7).convertLinearToSRGB();
    // Sin bruma: el diorama se ve limpio de punta a punta (solo cambian números, no hay que recompilar)
    const niebla = scene.fog, cerca = niebla?.near, lejos = niebla?.far;
    if (niebla) { niebla.near = 1e7; niebla.far = 2e7; }
    // ENCAJE AL PÍXEL: la cámara se mueve a saltos de un píxel grande (lo que mide un píxel a la distancia del punto
    // que se mira) y la imagen final se desplaza el resto. Al arrastrar el mapa, cada cosa sigue en sus mismos
    // píxeles en vez de «bailar» (bordes, ventanas y líneas que cambian de forma en cada fotograma).
    // Solo en el mapa: conduciendo, la cámara gira sin parar y va pegada al coche, y el punto del mapa se queda lejos
    // (a cientos de metros): los saltos serían de metros y la cámara iría a trompicones.
    const tamPix = 2 * camera.position.distanceTo(controls.target) * Math.tan(camera.fov * Math.PI / 360) / h;
    derecha.setFromMatrixColumn(camera.matrixWorld, 0); arriba.setFromMatrixColumn(camera.matrixWorld, 1);
    const encajar = ctx.enMapa();
    const pd = camera.position.dot(derecha) / tamPix, pa = camera.position.dot(arriba) / tamPix;
    const fd = encajar ? pd - Math.round(pd) : 0, fa = encajar ? pa - Math.round(pa) : 0;
    guardada.copy(camera.position);
    camera.position.addScaledVector(derecha, -fd * tamPix).addScaledVector(arriba, -fa * tamPix);
    camera.updateMatrixWorld();
    U.uDesp.value.set(fd / w, fa / h);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    camera.position.copy(guardada);
    camera.updateMatrixWorld();
    if (niebla) { niebla.near = cerca; niebla.far = lejos; }
    renderer.setRenderTarget(null);
    renderer.render(escenaQuad, camQuad);
  }

  // ---------------------------------------------------------------- vista maqueta (teleobjetivo) y giros
  const K = Math.tan((40 / 2) * Math.PI / 180) / Math.tan((FOV_MAQUETA / 2) * Math.PI / 180);
  let enMaqueta = false, giro = null;
  function ponerMaqueta(si) {
    if (si === enMaqueta || !ctx.enMapa()) return;
    enMaqueta = si;
    const f = si ? K : 1 / K;
    camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);
    camera.fov = si ? FOV_MAQUETA : 40;
    camera.near = si ? 20 : 1;
    camera.far = si ? 40000 : 10000;
    camera.updateProjectionMatrix();
    controls.minDistance *= f;
    controls.maxDistance *= f;
    ctx.vista.escala = si ? K : 1;
    ctx.scene.fog.near *= f;
    ctx.scene.fog.far *= f;
  }
  function girar(signo) { if (!giro) giro = { hecho: 0, total: signo * Math.PI / 2 }; }

  // ---------------------------------------------------------------- panel
  div.innerHTML = `<summary data-t="vsTitulo"></summary>
    <div class="botones"><button id="vsPixel" data-t="vsPixel"></button><button id="vs3d" data-t="vs3d"></button>
      <button id="vsMaqueta" data-t="vsMaqueta"></button><button id="vsIzq" data-t="vsIzq"></button>
      <button id="vsDer" data-t="vsDer"></button></div>
    <label style="display:block;margin-top:6px"><span id="vsTamT"></span>
      <input type="range" id="vsTam" min="2" max="8" step="1" value="${op.tam}"></label>
    <label><input type="checkbox" id="vsPaleta"> <span data-t="vsPaleta"></span></label>
    <label><input type="checkbox" id="vsTramado"> <span data-t="vsTramado"></span></label>
    <label><input type="checkbox" id="vsContornos"> <span data-t="vsContornos"></span></label>
    <label style="display:block;margin-top:6px"><span data-t="vsCalidad"></span> <select id="vsCalidad"></select></label>`;
  function rotulos() {
    $("vsPixel").classList.toggle("principal", op.activo);
    $("vs3d").classList.toggle("principal", !op.activo);
    $("vsMaqueta").classList.toggle("principal", enMaqueta);
    $("vsTamT").innerHTML = t("vsTam", op.tam);
    for (const k of ["paleta", "tramado", "contornos"]) {
      const c = $("vs" + k[0].toUpperCase() + k.slice(1));
      c.checked = op[k];
      c.disabled = !op.activo;
    }
    $("vsTam").disabled = !op.activo;
    document.body.classList.toggle("claro", op.activo);
    $("vsCalidad").innerHTML = `<option value="alta">${t("vsAlta")}</option><option value="ligera">${t("vsLigera")}</option>`;
    $("vsCalidad").value = op.calidad;
  }
  const cambiar = (k, v) => { op[k] = v; guardar(k, v); rotulos(); };
  $("vsPixel").onclick = () => cambiar("activo", true);
  $("vs3d").onclick = () => cambiar("activo", false);
  $("vsMaqueta").onclick = () => { ponerMaqueta(!enMaqueta); cambiar("maqueta", enMaqueta); };
  $("vsIzq").onclick = () => girar(1);
  $("vsDer").onclick = () => girar(-1);
  $("vsTam").oninput = () => cambiar("tam", +$("vsTam").value);
  for (const k of ["paleta", "tramado", "contornos"])
    $("vs" + k[0].toUpperCase() + k.slice(1)).onchange = (e) => cambiar(k, e.target.checked);
  function aplicarCalidad() {
    ctx.sol.castShadow = op.calidad === "alta";
    renderer.setPixelRatio(op.calidad === "alta" ? Math.min(devicePixelRatio, 2) : 1);
    renderer.setSize(innerWidth, innerHeight);
  }
  $("vsCalidad").onchange = () => { cambiar("calidad", $("vsCalidad").value); aplicarCalidad(); };
  aplicarCalidad();
  if (op.maqueta) ponerMaqueta(true);
  rotulos();

  return {
    get activo() { return op.activo; },
    render,
    traducir: rotulos,
    /** El coche pone su propia cámara: al entrar se deja la maqueta (sin tocar nada) y al salir se recupera. */
    alEntrarCoche() { if (enMaqueta) { enMaqueta = false; ctx.vista.escala = 1; controls.minDistance /= K; controls.maxDistance /= K; } },
    alSalirCoche() { if (op.maqueta) ponerMaqueta(true); rotulos(); },
    cadaFrame(dt) {
      if (!giro) return;
      const paso = Math.sign(giro.total) * Math.min(Math.abs(giro.total - giro.hecho), dt * Math.PI);   // 90° en 0,5 s
      giro.hecho += paso;
      camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), paso).add(controls.target);
      camera.lookAt(controls.target);
      if (Math.abs(giro.total - giro.hecho) < 1e-6) giro = null;
    },
  };
}
