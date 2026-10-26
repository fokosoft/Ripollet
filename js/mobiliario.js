// MOBILIARIO URBANO Y CUBIERTAS CON DATOS REALES (sin pesar en el GLB: instancias en la GPU)
//   · Contenedores en su sitio exacto (mapa de «Ripollet Aporta»): una fila de cinco (resto, envases, papel, vidrio y
//     orgánica) alineada con la calle más cercana, y los buzones de textil sanitario.
//   · Marquesinas en las paradas de autobús (AMB y Generalitat): techo, respaldo de vidrio y banco, con el respaldo
//     del lado contrario a la calzada.
//   · Placas solares en los edificios cuyo certificado energético (ICAEN) dice que tienen fotovoltaica: filas
//     inclinadas mirando al sur, en la azotea o en el faldón sur del tejado.
import { crearGrafo } from './rutas.js';

const CONTENEDORES = [0x5f6470, 0xf2c14e, 0x2a6db0, 0x3e8a3a, 0x7a4b32];   // resto, envases, papel, vidrio, orgánica

export function crearMobiliario(ctx) {
  const { THREE, scene, D, SIM, altura } = ctx;
  const G = crearGrafo(D);
  const grupo = new THREE.Group();
  scene.add(grupo);

  /** El tramo de calle de coches más cercano: su dirección (unitaria), el punto más cercano y la distancia. */
  function calleCerca(x, z) {
    let mejor = Infinity, dir = [1, 0], pie = [x, z];
    for (let e = 0; e < G.na; e++) {
      if (!G.vel[e]) continue;
      const a = G.A[3 * e], b = G.A[3 * e + 1], dx = G.x[b] - G.x[a], dz = G.z[b] - G.z[a], l2 = dx * dx + dz * dz || 1;
      const t = THREE.MathUtils.clamp(((x - G.x[a]) * dx + (z - G.z[a]) * dz) / l2, 0, 1);
      const px = G.x[a] + t * dx, pz = G.z[a] + t * dz, d = Math.hypot(x - px, z - pz);
      if (d < mejor) { mejor = d; const l = Math.sqrt(l2); dir = [dx / l, dz / l]; pie = [px, pz]; }
    }
    return { dir, pie, d: mejor };
  }
  const giroDe = (dir) => Math.atan2(-dir[1], dir[0]);           // el eje x local sigue la calle
  // Solo lo que cae dentro de la maqueta (los datos cubren todo el municipio)
  const enMaqueta = (x, z) => Math.abs(x) < D.terreno.lx - 2 && Math.abs(z) < D.terreno.ly - 2;

  /** Una malla instanciada con una lista de [posición, giro y, escala] y colores opcionales. */
  function instancias(geo, mat, lista, colores) {
    if (!lista.length) return null;
    const malla = new THREE.InstancedMesh(geo, mat, lista.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), arriba = new THREE.Vector3(0, 1, 0);
    lista.forEach(([p, giro, esc], i) => {
      malla.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(arriba, giro), esc ?? new THREE.Vector3(1, 1, 1)));
      if (colores) malla.setColorAt(i, new THREE.Color(colores[i]));
    });
    malla.castShadow = malla.receiveShadow = true;
    grupo.add(malla);
    return malla;
  }
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });

  // ---------------------------------------------------------------- contenedores
  {
    const lista = [], colores = [];
    for (const p of ctx.residuos?.puntos ?? []) {
      if (!enMaqueta(...p.pos)) continue;
      const [x, z] = p.pos, { dir } = calleCerca(x, z), giro = giroDe(dir), y = altura(x, z);
      const tipos = p.tipo === "contenedor" ? CONTENEDORES : p.tipo === "textil" ? [0xf08a3c] : [];
      tipos.forEach((c, k) => {
        const s = (k - (tipos.length - 1) / 2) * 1.45;
        lista.push([new THREE.Vector3(x + dir[0] * s, y, z + dir[1] * s), giro]);
        colores.push(c);
      });
    }
    instancias(new THREE.BoxGeometry(1.3, 1.45, 1.1).translate(0, 0.72, 0), material(0xffffff), lista, colores);
  }

  // ---------------------------------------------------------------- marquesinas
  {
    const techos = [], vidrios = [], postes = [], bancos = [];
    for (const p of ctx.transporte?.paradas ?? []) {
      if (!enMaqueta(p.x, p.z)) continue;
      const { dir, pie } = calleCerca(p.x, p.z), giro = giroDe(dir), y = altura(p.x, p.z);
      // fuera de la calzada: el respaldo, del lado contrario a la calle
      let nx = p.x - pie[0], nz = p.z - pie[1];
      const l = Math.hypot(nx, nz) || 1;
      nx /= l; nz /= l;
      const c = new THREE.Vector3(p.x, y, p.z), atras = (d) => c.clone().add(new THREE.Vector3(nx * d, 0, nz * d));
      techos.push([atras(0).setY(y + 2.55), giro]);
      vidrios.push([atras(0.7).setY(y + 1.25), giro]);
      bancos.push([atras(0.45).setY(y + 0.45), giro]);
      for (const s of [-1.75, 1.75]) postes.push([atras(0.7).add(new THREE.Vector3(dir[0] * s, 0, dir[1] * s)).setY(y + 1.3), giro]);
    }
    instancias(new THREE.BoxGeometry(3.8, 0.12, 1.7), material(0x3c404a), techos);
    instancias(new THREE.BoxGeometry(3.5, 2.0, 0.05), material(0x9fd3f0, { transparent: true, opacity: 0.45, roughness: 0.2 }), vidrios);
    instancias(new THREE.BoxGeometry(0.1, 2.6, 0.1), material(0x3c404a), postes);
    instancias(new THREE.BoxGeometry(2.2, 0.1, 0.45), material(0x8a8f99), bancos);
  }

  // ---------------------------------------------------------------- placas solares
  {
    const R = ctx.rehab, E = D.edificios, T = D.techos2m, nx = SIM.nx, ny = SIM.ny, nx2 = nx * 2;
    const lista = [], porEdificio = new Map();
    if (R && E && T) {
      const tejadoDe = (b) => (R[(b - 1) * 5 + 4] >> 7) & 1;          // 1 = cubierta inclinada (casa)
      const conPlacas = (b) => b > 0 && (R[(b - 1) * 5 + 4] >> 3) & 1;
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const k = j * nx + i, b = E[k];
          if (!conPlacas(b)) continue;
          const dentro = E[k - 1] === b && E[k + 1] === b && E[k - nx] === b && E[k + nx] === b;
          const inclinado = tejadoDe(b);
          // azotea: filas alternas por dentro · tejado: la fila del borde sur (z crece hacia el sur)
          const sitio = inclinado ? E[k - 1] === b && E[k + 1] === b && E[k + nx] !== b : dentro && j % 2 === 0;
          if (!sitio || (porEdificio.get(b) ?? 0) >= 16) continue;
          let techo = 0;
          for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) techo = Math.max(techo, T[(2 * j + dj) * nx2 + 2 * i + di] * 0.5);
          if (!techo) continue;
          const x = SIM.x0 + (i + 0.5) * SIM.celda, z = SIM.z0 + (j + 0.5) * SIM.celda;
          for (const s of [-1.0, 1.0]) lista.push([new THREE.Vector3(x + s, techo + (inclinado ? 0.55 : 0.4), z), 0]);
          porEdificio.set(b, (porEdificio.get(b) ?? 0) + 2);
        }
      }
    }
    // Placa de 1,7 × 1,0 m inclinada 25° hacia el sur (+z)
    const geo = new THREE.BoxGeometry(1.0, 0.05, 1.7).rotateX(-0.44);
    instancias(geo, material(0x1d3557, { roughness: 0.35, metalness: 0.3 }), lista);
    ctx.alPlacas?.(lista.length, porEdificio.size);
  }
  return { grupo };
}
