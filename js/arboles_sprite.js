// ÁRBOLES RECORTABLES para la vista maqueta: cada árbol es un dibujo de pixel art plano (2 triángulos) que mira
// siempre de frente a la cámara, como en los juegos isométricos clásicos, en vez de una copa de 20–80
// caras. Los dibujos (copa redonda, copa clara, ciprés, pino y arbusto) se pintan al arrancar en un lienzo de 160×48
// píxeles (sin descargar nada). Las copas van en grises y toman el color de cada árbol (el de la estación); el tronco
// conserva su marrón. Dan sombra (la silueta recortada) y reciben la luz del sol y la de la noche.

const CELDA = [32, 48];                       // píxeles de cada dibujo en el lienzo
const TIPOS = ["bola_copa", "bola_copa_clara", "cono_copa", "pino", "arbusto"];
// Parte del dibujo (de abajo arriba) que ocupa el tronco: para que la copa del recortable quede a su altura real
export const TRONCO_SPRITE = { bola_copa: 0.3, bola_copa_clara: 0.3, cono_copa: 0.12, pino: 0.16, arbusto: 0 };

/** Lienzo con los cinco dibujos: copas en escala de grises (se tiñen) y tronco marrón (no se tiñe). */
function pintarAtlas() {
  const [W, H] = CELDA, lienzo = document.createElement("canvas");
  lienzo.width = W * TIPOS.length; lienzo.height = H;
  const g = lienzo.getContext("2d");
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const gris = (v) => `rgb(${v},${v},${v})`;
  const azar = (i, j, s) => { const v = Math.sin(i * 12.99 + j * 78.23 + s * 37.7) * 43758.55; return v - Math.floor(v); };
  // Copa: la forma dice si un píxel está dentro; sombreado con luz desde arriba a la izquierda, contorno oscuro y
  // motas de hojas
  function copa(ox, forma, semilla) {
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        if (!forma(i, j)) continue;
        const borde = !forma(i - 1, j) || !forma(i + 1, j) || !forma(i, j - 1) || !forma(i, j + 1);
        const luz = 1 - (i / W) * 0.45 - (j / H) * 0.55;
        let v = 120 + 120 * luz + (azar(i >> 1, j >> 1, semilla) - 0.5) * 40;
        if (azar(i, j, semilla + 9) > 0.86) v += 28;                   // brillos de hojas
        px(ox + i, j, gris(Math.round(borde ? 70 : Math.max(90, Math.min(250, v)))));
      }
  }
  function tronco(ox, ancho, desde) {
    const x0 = Math.round(W / 2 - ancho / 2);
    for (let j = desde; j < H; j++)
      for (let i = x0; i < x0 + ancho; i++) px(ox + i, j, i === x0 ? "rgb(70,44,26)" : i === x0 + ancho - 1 ? "rgb(84,54,32)" : "rgb(112,74,44)");
  }
  const dentro = (fn) => (i, j) => i >= 0 && j >= 0 && i < W && j < H && fn(i, j);
  // 0 · copa redonda (plátanos, almeces…): dos lóbulos y uno arriba
  tronco(0, 4, 30);
  copa(0, dentro((i, j) => (i - 16) ** 2 / 196 + (j - 19) ** 2 / 225 < 1 || (i - 10) ** 2 + (j - 24) ** 2 < 70 || (i - 22) ** 2 + (j - 23) ** 2 < 70), 1);
  // 1 · copa clara: más abierta, irregular
  tronco(W, 4, 31);
  copa(W, dentro((i, j) => (i - 16) ** 2 / 225 + (j - 20) ** 2 / 196 < 1 && azar(i >> 2, j >> 2, 3) > 0.12), 2);
  // 2 · ciprés: huso estrecho
  tronco(2 * W, 2, 42);
  copa(2 * W, dentro((i, j) => j < 43 && Math.abs(i - 16) < 7 * Math.sin(Math.PI * Math.min(1, (j + 2) / 45)) + 0.5), 3);
  // 3 · pino: pisos de ramas en triángulo
  tronco(3 * W, 3, 36);
  copa(3 * W, dentro((i, j) => j < 41 && [[2, 16], [12, 29], [22, 41]].some(([a, b]) => j >= a && j <= b && Math.abs(i - 16) <= (j - a) * 0.75 + 1)), 4);
  // 4 · arbusto: mata baja, sin tronco
  copa(4 * W, dentro((i, j) => (i - 16) ** 2 / 225 + (j - 34) ** 2 / 169 < 1 && j < 47), 5);
  return lienzo;
}

/** lista: [{ tipo, x, y (suelo), z, ancho, alto, color }] → { grupo, actualizar(camara) } */
export function crearArbolesSprite(ctx, lista) {
  const { THREE, scene } = ctx;
  const tex = new THREE.CanvasTexture(pintarAtlas());
  Object.assign(tex, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false,
                       colorSpace: THREE.SRGBColorSpace });
  const uDer = { value: new THREE.Vector3(1, 0, 0) }, uArr = { value: new THREE.Vector3(0, 1, 0) };
  // El dibujo queda de frente a la cámara (plano perpendicular a la vista, con la base en el suelo), como los sprites
  // isométricos: con la cámara mirando desde arriba, uno solo vertical se vería aplastado. La matriz de la instancia
  // solo lleva posición y escala: el desplazamiento der·x·ancho + arr·y·alto se escribe como «transformed»
  // = (o.x/ancho, o.y/alto, o.z/ancho) para que instanceMatrix lo lleve a su sitio (luz, niebla y sombras incluidas).
  const GIRO = ["#include <begin_vertex>", `
    vec3 desplArbol = uDerArbol * position.x + uArrArbol * position.y;
    vec3 transformed = vec3(desplArbol.x, desplArbol.y, desplArbol.z);`];
  const NORMAL = ["#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);"];   // luz de arriba
  const prepara = (s) => {
    s.uniforms.uDerArbol = uDer; s.uniforms.uArrArbol = uArr;
    s.vertexShader = "uniform vec3 uDerArbol, uArrArbol;\n" + s.vertexShader.replace(...GIRO).replace(...NORMAL);
  };
  const material = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  material.onBeforeCompile = (s) => {
    prepara(s);
    // Solo se tiñe la copa (gris en el dibujo); el tronco (marrón) se queda como está
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `
      #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
        if (abs(sampledDiffuseColor.r - sampledDiffuseColor.b) < 0.03) diffuseColor.rgb *= vColor;
      #endif`);
  };
  material.customProgramCacheKey = () => "arbol-recortable";
  const sombra = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  sombra.onBeforeCompile = prepara;
  sombra.customProgramCacheKey = () => "arbol-recortable-sombra";

  const grupo = new THREE.Group();
  grupo.visible = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), e = new THREE.Vector3();
  TIPOS.forEach((tipo, t) => {
    const suyos = lista.filter((a) => a.tipo === tipo);
    if (!suyos.length) return;
    // Plano de 1 × 1 con la base en el suelo y la UV de su dibujo en el lienzo
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (t + uv.getX(i)) / TIPOS.length);
    const malla = new THREE.InstancedMesh(geo, material, suyos.length);
    suyos.forEach((a, i) => {
      malla.setMatrixAt(i, m4.compose(p.set(a.x, a.y, a.z), q, e.set(a.ancho, a.alto, a.ancho)));
      malla.setColorAt(i, a.color);
    });
    malla.customDepthMaterial = sombra;
    malla.castShadow = malla.receiveShadow = true;
    malla.frustumCulled = false;
    grupo.add(malla);
  });
  scene.add(grupo);
  return {
    grupo,
    actualizar(camara) {
      uDer.value.setFromMatrixColumn(camara.matrixWorld, 0);
      uArr.value.setFromMatrixColumn(camara.matrixWorld, 1);
      // (la escala de la instancia es ancho/alto/ancho: la componente vertical de «arriba» se mide en altos)
    },
  };
}
