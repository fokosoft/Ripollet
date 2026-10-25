// SIMULACIÓN DE LLUVIA EN LA GPU (modelo de "tuberías virtuales"): cada celda de 4 m intercambia agua con sus
// 4 vecinas según la diferencia de altura de la superficie del agua (lecho + lámina). Usa THREE y
// GPUComputationRenderer del script que la incluye.

// mm/h por tipo de celda (por defecto; los datos traen la tabla buena en sim.infiltracion):
// urbano, edificio, césped, bosque, matorral, agua, calzada, patio privado, solar, muro de parcela
export const INFILTRACION = [3, 0, 25, 40, 30, 0, 0, 40, 15, 0];
export const DT_SIM = 0.25;                             // segundos simulados por paso
export const MAX_NUBES = 8;

/** `sueloFino`: relieve de 4 m − malla visual, en pasos de 2 cm (Int8), o null. */
export function crearSimulacion(renderer, sim, codigos, altura, sueloFino = null) {
  const { nx, ny, celda } = sim;
  const n = nx * ny;
  const baseLecho = new Float32Array(n), baseSalida = new Float32Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, c = codigos[k];
      baseLecho[k] = altura(sim.x0 + (i + 0.5) * celda, sim.z0 + (j + 0.5) * celda)
                   + (sueloFino ? sueloFino[k] * 0.02 : 0) + sim.lecho[c];
      baseSalida[k] = (sim.infiltracion ?? INFILTRACION)[c] / 3.6e6;     // m/s
    }
  const datosLecho = new Float32Array(n * 4);
  const texLecho = new THREE.DataTexture(datosLecho, nx, ny, THREE.RGBAFormat, THREE.FloatType);

  /**
   * MEDIDAS Y ALCANTARILLADO: `bajar` (m que se rebaja el lecho: depósitos, parques inundables) y `desague`
   * (m/s extra que se lleva el agua: pavimento permeable, imbornales) por celda, o null; `alcantarillado` (mm/h que
   * tragan las calzadas: la red de imbornales). Sin nada, es el terreno tal cual.
   */
  function aplicar(bajar = null, desague = null, alcantarillado = 0) {
    const red = alcantarillado / 3.6e6;
    for (let k = 0; k < n; k++) {
      datosLecho[k * 4] = baseLecho[k] - (bajar ? bajar[k] : 0);
      datosLecho[k * 4 + 1] = baseSalida[k] + (desague ? desague[k] : 0) + (codigos[k] === 6 ? red : 0);
    }
    texLecho.needsUpdate = true;
  }
  aplicar();

  const gpu = new GPUComputationRenderer(nx, ny, renderer);
  const mediaFlotante = !renderer.extensions.has("EXT_color_buffer_float");
  if (mediaFlotante) gpu.setDataType(THREE.HalfFloatType);

  const CABECERA = `
    uniform sampler2D texturaAgua;    // r = profundidad (m), g = velocidad (m/s), b = profundidad máxima
    uniform sampler2D texturaFlujo;   // caudal hacia -x, +x, -z, +z (m³/s)
    uniform sampler2D tLecho;         // r = altura del lecho (m), g = infiltración (m/s)
    uniform float dt;
    uniform float celda;
  `;
  const comunes = () => ({ texturaAgua: { value: null }, texturaFlujo: { value: null }, tLecho: { value: texLecho },
                           dt: { value: DT_SIM }, celda: { value: celda } });

  const matFlujo = gpu.createShaderMaterial(CABECERA + `
    float superficie(vec2 uv) { return texture2D(tLecho, uv).r + texture2D(texturaAgua, uv).r; }
    void main() {
      vec2 px = 1.0 / resolution.xy;
      vec2 uv = gl_FragCoord.xy * px;
      float b = texture2D(tLecho, uv).r;
      float d = texture2D(texturaAgua, uv).r;
      // Vecinos -x, +x, -z, +z; fuera de la maqueta el agua sale libremente
      float hI = gl_FragCoord.x < 1.0 ? b : superficie(uv - vec2(px.x, 0.0));
      float hD = gl_FragCoord.x > resolution.x - 1.0 ? b : superficie(uv + vec2(px.x, 0.0));
      float hA = gl_FragCoord.y < 1.0 ? b : superficie(uv - vec2(0.0, px.y));
      float hB = gl_FragCoord.y > resolution.y - 1.0 ? b : superficie(uv + vec2(0.0, px.y));
      vec4 f = texture2D(texturaFlujo, uv);
      f = max(vec4(0.0), f * 0.998 + dt * 9.81 * celda * ((b + d) - vec4(hI, hD, hA, hB)));
      // Nunca sale más agua de la que hay en la celda
      float sale = f.x + f.y + f.z + f.w;
      float k = sale > 0.0 ? min(1.0, d * celda * celda / (sale * dt)) : 0.0;
      gl_FragColor = f * k;
    }`, comunes());

  const nubesGPU = Array.from({ length: MAX_NUBES }, () => new THREE.Vector4());
  const matAgua = gpu.createShaderMaterial(CABECERA + `
    uniform vec2 origen;
    uniform vec4 nubes[${MAX_NUBES}];   // x, z, radio (m), intensidad (mm/h)
    uniform int nNubes;
    uniform float lluviaGlobal;        // mm/h sobre toda la maqueta (escenarios de riesgo)
    void main() {
      vec2 px = 1.0 / resolution.xy;
      vec2 uv = gl_FragCoord.xy * px;
      vec4 a = texture2D(texturaAgua, uv);
      vec4 f = texture2D(texturaFlujo, uv);
      float fI = gl_FragCoord.x < 1.0 ? 0.0 : texture2D(texturaFlujo, uv - vec2(px.x, 0.0)).y;
      float fD = gl_FragCoord.x > resolution.x - 1.0 ? 0.0 : texture2D(texturaFlujo, uv + vec2(px.x, 0.0)).x;
      float fA = gl_FragCoord.y < 1.0 ? 0.0 : texture2D(texturaFlujo, uv - vec2(0.0, px.y)).w;
      float fB = gl_FragCoord.y > resolution.y - 1.0 ? 0.0 : texture2D(texturaFlujo, uv + vec2(0.0, px.y)).z;
      float d = a.r + dt * (fI + fD + fA + fB - (f.x + f.y + f.z + f.w)) / (celda * celda);
      // Lluvia (tormentas con borde suave + lluvia general) e infiltración según el suelo
      vec2 pos = origen + gl_FragCoord.xy * celda;
      float lluvia = lluviaGlobal;
      for (int k = 0; k < ${MAX_NUBES}; k++) {
        if (k >= nNubes) break;
        lluvia += nubes[k].w * (1.0 - smoothstep(nubes[k].z * 0.75, nubes[k].z, distance(pos, nubes[k].xy)));
      }
      d = max(0.0, d + dt * lluvia / 3.6e6 - dt * texture2D(tLecho, uv).g);
      // Velocidad media del agua, para pintar la espuma
      float qx = 0.5 * (fI - f.x + f.y - fD), qz = 0.5 * (fA - f.z + f.w - fB);
      float v = length(vec2(qx, qz)) / (celda * max(0.5 * (a.r + d), 0.02));
      gl_FragColor = vec4(d, v, max(a.b, d), 1.0);
    }`, { ...comunes(), origen: { value: new THREE.Vector2(sim.x0, sim.z0) }, nubes: { value: nubesGPU },
          nNubes: { value: 0 }, lluviaGlobal: { value: 0 } });

  const rtAgua = [gpu.createRenderTarget(), gpu.createRenderTarget()];
  const rtFlujo = [gpu.createRenderTarget(), gpu.createRenderTarget()];
  let iAgua = 0, iFlujo = 0;

  function paso() {
    matFlujo.uniforms.texturaAgua.value = rtAgua[iAgua].texture;
    matFlujo.uniforms.texturaFlujo.value = rtFlujo[iFlujo].texture;
    gpu.doRenderTarget(matFlujo, rtFlujo[1 - iFlujo]);
    iFlujo = 1 - iFlujo;
    matAgua.uniforms.texturaAgua.value = rtAgua[iAgua].texture;
    matAgua.uniforms.texturaFlujo.value = rtFlujo[iFlujo].texture;
    gpu.doRenderTarget(matAgua, rtAgua[1 - iAgua]);
    iAgua = 1 - iAgua;
  }

  function secar() {
    const cero = gpu.createTexture();
    for (const rt of [...rtAgua, ...rtFlujo]) gpu.renderTexture(cero, rt);
    cero.dispose();
  }
  secar();

  /** Lee de la GPU la profundidad actual y la máxima alcanzada de cada celda (m). */
  function leer() {
    const n = nx * ny, rt = rtAgua[iAgua];
    let px;
    if (mediaFlotante) {
      const h = new Uint16Array(n * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, nx, ny, h);
      px = Float32Array.from(h, THREE.DataUtils.fromHalfFloat);
    } else {
      px = new Float32Array(n * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, nx, ny, px);
    }
    const actual = new Float32Array(n), maxima = new Float32Array(n);
    for (let k = 0; k < n; k++) { actual[k] = px[k * 4]; maxima[k] = px[k * 4 + 2]; }
    return { actual, maxima };
  }

  return {
    paso, secar, leer, aplicar,
    textura: () => rtAgua[iAgua].texture,
    fijarNubes(lista) {
      lista.forEach((t, k) => nubesGPU[k].set(t.x, t.z, t.radio, t.intensidad));
      matAgua.uniforms.nNubes.value = lista.length;
    },
    set lluviaGlobal(mmh) { matAgua.uniforms.lluviaGlobal.value = mmh; },
    get lluviaGlobal() { return matAgua.uniforms.lluviaGlobal.value; },
  };
}
