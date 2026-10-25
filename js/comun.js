// PIEZAS COMUNES de las herramientas: la rejilla de 2 m (tipo de suelo y calle de cada celda) y un montículo
// binario para los caminos más cortos (Dijkstra) sobre esa rejilla o sobre el grafo de calles.

let rejilla = null;
/** Rejilla de 2 m (la mitad de la de aceras): tipo 0 otro · 1 acera · 2 calzada · 3 edificio · 4 plaza o parque;
 *  calle más cercana y código de la simulación. Se calcula una vez y la comparten todas las herramientas. */
export function rejilla2m(D, SIM, S1) {
  if (rejilla) return rejilla;
  const nx = S1.nx / 2, ny = S1.ny / 2, n = nx * ny;
  const tipo = new Uint8Array(n), calle = new Uint16Array(n), codigo = new Uint8Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, c4 = (j >> 1) * SIM.nx + (i >> 1);
      let a = 0, c = 0;
      for (let q = 0; q < 4; q++) {
        const v = D.suelo1m[(2 * j + (q >> 1)) * S1.nx + 2 * i + (q & 1)];
        a += v === 1; c += v === 2;
      }
      codigo[k] = D.codigos[c4];
      tipo[k] = D.techos2m[k] > 0 ? 3 : a >= 2 ? 1 : c >= 2 ? 2 : (codigo[k] === 0 || codigo[k] === 2) ? 4 : 0;
      calle[k] = D.calles[c4];
    }
  const paso = 2;
  rejilla = {
    nx, ny, n, paso, tipo, calle, codigo,
    x: (k) => SIM.x0 + ((k % nx) + 0.5) * paso,
    z: (k) => SIM.z0 + (Math.floor(k / nx) + 0.5) * paso,
    celda(x, z) {
      const i = Math.floor((x - SIM.x0) / paso), j = Math.floor((z - SIM.z0) / paso);
      return i >= 0 && j >= 0 && i < nx && j < ny ? j * nx + i : -1;
    },
  };
  return rejilla;
}

let relieve = null;
/** Superficie de 2 m: suelo (relieve fino) y lo que tapa el sol (suelo o cubierta, lo más alto). Compartida. */
export function relieve2m(D, SIM, S1, altura) {
  if (relieve) return relieve;
  const nx = S1.nx / 2, ny = S1.ny / 2, suelo = new Float32Array(nx * ny), ocluye = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      suelo[k] = altura(SIM.x0 + (i + 0.5) * 2, SIM.z0 + (j + 0.5) * 2) + D.suelo4m[(j >> 1) * SIM.nx + (i >> 1)] * 0.02;
      const techo = D.techos2m[k] * 0.5;
      ocluye[k] = techo > 0 ? Math.max(techo, suelo[k]) : suelo[k];
    }
  relieve = { suelo, ocluye };
  return relieve;
}

/** Montículo binario de mínimos (clave numérica, valor entero), sin objetos por elemento. */
export class Monticulo {
  constructor() { this.claves = []; this.valores = []; }
  get length() { return this.claves.length; }
  push(clave, valor) {
    const C = this.claves, V = this.valores;
    let i = C.length;
    C.push(clave); V.push(valor);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (C[p] <= clave) break;
      C[i] = C[p]; V[i] = V[p]; i = p;
    }
    C[i] = clave; V[i] = valor;
  }
  pop() {      // devuelve el valor de menor clave; la clave queda en this.ultimaClave
    const C = this.claves, V = this.valores, valor = V[0];
    this.ultimaClave = C[0];
    const clave = C.pop(), v = V.pop();
    if (C.length) {
      let i = 0;
      for (;;) {
        let h = 2 * i + 1;
        if (h >= C.length) break;
        if (h + 1 < C.length && C[h + 1] < C[h]) h++;
        if (C[h] >= clave) break;
        C[i] = C[h]; V[i] = V[h]; i = h;
      }
      C[i] = clave; V[i] = v;
    }
    return valor;
  }
}

/** Dijkstra en la rejilla de 2 m con 8 vecinos. coste(k) = coste por metro de la celda (Infinity: no se pasa).
 *  Para en `destino` si se da; devuelve las distancias (Float64) y el predecesor de cada celda (Int32). */
export function caminosRejilla(R, origenes, coste, destino = -1, limite = Infinity) {
  const { nx, ny, n, paso } = R;
  const dist = new Float64Array(n).fill(Infinity), previo = new Int32Array(n).fill(-1);
  const m = new Monticulo();
  for (const o of origenes) { dist[o] = 0; m.push(0, o); }
  const VEC = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2],
               [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (m.length) {
    const k = m.pop(), d = m.ultimaClave;
    if (d > dist[k]) continue;
    if (k === destino || d > limite) break;
    const i = k % nx, j = (k - i) / nx, ck = coste(k);
    for (const [di, dj, f] of VEC) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const v = jj * nx + ii, cv = coste(v);
      if (cv === Infinity) continue;
      const nd = d + f * paso * (ck + cv) / 2;
      if (nd < dist[v]) { dist[v] = nd; previo[v] = k; m.push(nd, v); }
    }
  }
  return { dist, previo };
}

/** Celda transitable más cercana a (x, z), buscando en anillos de hasta 60 m. */
export function celdaLibre(R, x, z, transitable) {
  const k0 = R.celda(x, z);
  if (k0 < 0) return -1;
  const i0 = k0 % R.nx, j0 = (k0 - i0) / R.nx;
  for (let r = 0; r <= 30; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di, j = j0 + dj;
        if (i >= 0 && j >= 0 && i < R.nx && j < R.ny && transitable(j * R.nx + i)) return j * R.nx + i;
      }
  return -1;
}
