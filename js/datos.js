// DATOS DEL VISOR: los binarios de datos_visor/ llegan comprimidos (deflate) dentro del HTML (BLOBS, en base64)
// o como archivos .z junto a la página (versión web). El navegador los descomprime de forma nativa.

/** Un binario comprimido → TypedArray del tipo pedido. */
export async function cargarBinario(nombre, Tipo, blobs) {
  let comprimido;
  if (blobs) comprimido = Uint8Array.from(atob(blobs[nombre]), (c) => c.charCodeAt(0));
  else comprimido = new Uint8Array(await (await fetch(`datos/${nombre}.z`)).arrayBuffer());
  const flujo = new Blob([comprimido]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Tipo(await new Response(flujo).arrayBuffer());
}

/** Carga todo lo que el visor necesita y lo deja listo para usar. */
export async function cargarDatos(datos, blobs) {
  const [codigos, rasgos, calles, edificios, terrenoCm, arboles, suelo1m, suelo4m,
         techos2m, acces1m, grafoNodos, grafoAristas, solar2m] = await Promise.all([
    cargarBinario("codigos", Uint8Array, blobs), cargarBinario("rasgos", Uint8Array, blobs),
    cargarBinario("calles", Uint16Array, blobs), cargarBinario("edificios", Uint16Array, blobs),
    cargarBinario("terreno", Uint16Array, blobs), cargarBinario("arboles", Int16Array, blobs),
    cargarBinario("aceras", Uint8Array, blobs), cargarBinario("suelo4m", Int8Array, blobs),
    cargarBinario("techos2m", Uint8Array, blobs), cargarBinario("acces1m", Uint8Array, blobs),
    cargarBinario("grafo_nodos", Int16Array, blobs), cargarBinario("grafo_aristas", Uint16Array, blobs),
    cargarBinario("solar2m", Uint8Array, blobs),
  ]);
  const terreno = { ...datos.terreno, h: Float32Array.from(terrenoCm, (v) => v / 100) };
  // suelo1m: rejilla de 1 m con 0 nada · 1 acera · 2 calzada · 3 edificio (choques del coche y aceras pintadas)
  // suelo4m: relieve fino de la simulación (MDT del ICGC a 4 m) − malla visual, en pasos de 2 cm
  // techos2m: altura absoluta de las cubiertas (2 m, pasos de 0,5 m) · acces1m: ancho | pendiente << 2 de las aceras
  // grafo: nodos (x, z en dm) y aristas (a, b, km/h | a pie << 7) · solar2m: kWh/m²·año de las cubiertas / 10
  return { codigos, rasgos, calles, edificios, terreno, arboles, suelo1m, suelo4m, techos2m, acces1m,
           grafo: { nodos: grafoNodos, aristas: grafoAristas }, solar2m };
}

/** Altura del terreno en (x, z) de three.js, con los mismos triángulos que la malla del suelo. */
export function crearAltura(T) {
  return function altura(x, z) {
    const y = -z;
    let fx = (Math.min(Math.max(x, -T.lx), T.lx) + T.lx) / T.gx;
    let fy = (Math.min(Math.max(y, -T.ly), T.ly) + T.ly) / T.gy;
    const i = Math.min(Math.floor(fx), T.nx - 1), j = Math.min(Math.floor(fy), T.ny - 1);
    fx -= i; fy -= j;
    const h = (a, b) => T.h[(j + b) * (T.nx + 1) + i + a];
    if (fx + fy <= 1) return h(0, 0) + (h(1, 0) - h(0, 0)) * fx + (h(0, 1) - h(0, 0)) * fy;
    return h(1, 1) + (h(0, 1) - h(1, 1)) * (1 - fx) + (h(1, 0) - h(1, 1)) * (1 - fy);
  };
}
