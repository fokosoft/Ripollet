// NÚCLEO DE NEUTRO en JavaScript: el mismo cerebro de neuronas de concepto que nucleo_neutro.py (y que las versiones en
// C# y C++), para que corra en el navegador o en Node: miles de mentes a la vez sin servidor.
//
// Sigue la especificación del núcleo al pie de la letra y tiene que decidir EXACTAMENTE lo mismo que Python: pruebas/vectores.mjs lo
// comprueba con las partidas reales grabadas (cada acción, cada lección y la memoria final). Detalles que importan:
//   - Python `max` se queda con el PRIMERO de los empatados, en el orden en que recorre
//   - Python `round` redondea al PAR en los empates (round(2.5) = 2)
//   - los diccionarios recuerdan el orden de inserción (aquí: Map, y objetos con claves de texto)
// Lo experimental de Python (recortar, traer_conceptos) no está: entra cuando pase a la especificación.

export const DISTANCIA_COMPLETADO = 2;
export const CAMBIOS_CONFLICTO = 3;
export const MAX_AGOTADO = 2;
export const TOLERANCIA_LUGAR = 48;
export const UMBRAL_MIEDO = 1;        // (un fracaso de lleno basta para temer: aprender de una vez)
export const EXTINCION_MIEDO = 0.9;   // (cada vez que la acción temida sale bien, el miedo baja un 10 %)
export const PESO_DECEPCION = 0.3;    // (decepción) lo que cuenta como fallo una recompensa esperada que no llega
export const UMBRAL_HOMEOSTASIS = 0.04;   // (homeostasis) cambio del impulso entre dos decisiones que se siente como bueno o malo
export const TRAMO_META = 0.2;   // (metas) cada tramo cubierto de una meta sostenida es un logro que se siente

/**
 * LOS PARÁMETROS DEL NÚCLEO, con los valores de la especificación (los de arriba, más el reparto de la culpa).
 * Neutro Lab puede cambiarlos para experimentar (`opciones.parametros`); sin tocarlos, decide EXACTAMENTE igual (lo
 * comprueban los vectores cruzados). Lo que se ajuste es experimental: si un valor nuevo se adopta, pasa a la
 * especificación y a los gemelos (Python, C#, C++, Neutro8) con sus pruebas. Solo existe en JavaScript.
 */
export const PARAMETROS = Object.freeze({
  distanciaCompletado: DISTANCIA_COMPLETADO, cambiosConflicto: CAMBIOS_CONFLICTO, maxAgotado: MAX_AGOTADO,
  toleranciaLugar: TOLERANCIA_LUGAR, umbralMiedo: UMBRAL_MIEDO, extincionMiedo: EXTINCION_MIEDO,
  pesoDecepcion: PESO_DECEPCION, umbralHomeostasis: UMBRAL_HOMEOSTASIS, tramoMeta: TRAMO_META,
  ventanaCulpa: 60,        // ticks activos hacia atrás donde se buscan culpables (× 1 + agotado del callejón)
  recenciaCulpa: 20,       // sin callejón, solo culpables vistos en los últimos 20 ticks activos
  culpables: 4,            // a cuántas situaciones llega la culpa
  decaimientoCulpa: 0.5,   // la culpa de la i-ésima: decaimiento^i
});

/** El primero con la clave mayor, como `max(iterable, key=...)` de Python. */
function maxPorClave(lista, clave) {
  let mejor, valorMejor = -Infinity, primero = true;
  for (const x of lista) {
    const v = clave(x);
    if (primero || v > valorMejor) { mejor = x; valorMejor = v; primero = false; }
  }
  return mejor;
}

/** `round` de Python: al par en los empates. */
function redondearPython(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export class Nucleo {
  /**
   * @param percepcion  { nombrar(situacion) → concepto, tranquila(situacion) → bool }
   * @param opciones    { acciones, completar, separar, instintos (tabla), modoInstintos ("antes"|"despues"|false),
   *                      prudencia (tabla), generalizar, porConcepto, parametros (ver PARAMETROS) }
   */
  constructor(percepcion, opciones = {}) {
    this.percepcion = percepcion;
    if (opciones.parametros) this._p = { ...PARAMETROS, ...opciones.parametros };
    this.acciones = [...(opciones.acciones || ['avanzar'])];
    this.reposo = this.acciones[0];
    this.completar = !!opciones.completar;
    this.separar = !!opciones.separar;
    this.tablaInstintos = opciones.instintos || {};
    this.instintos = opciones.modoInstintos || false;
    this.prudencia = opciones.prudencia || {};
    this.generalizar = !!opciones.generalizar;
    // APRENDER POR CONCEPTO (el miedo, LeDoux; la invariancia, Quian Quiroga): un fracaso enseña también al concepto
    // entero; la acción que le falló queda vetada en todas sus situaciones, hasta que salga bien unas cuantas veces
    this.porConcepto = !!opciones.porConcepto;
    this.miedos = new Map();         // concepto → {acción: fallos}
    this._impulso = null;            // (homeostasis) el impulso de la última vez
    this.meta = null;                // (metas) {nombre, tramos}: la meta sostenida activa
    this._votos = null;
    this.neuronas = new Map();       // situación → neurona
    this.excepciones = new Map();    // "situación|lugar" → neurona
    this.callejones = [];
    this.reiniciarEstadisticas();
  }

  /** Los parámetros en uso (los de la especificación si no se cambiaron; también en cerebros guardados antes de existir). */
  get p() { return this._p || PARAMETROS; }

  reiniciarEstadisticas() {
    this.ticks = 0;
    this.evaluaciones = 0;
    this.disparos = 0;
    this.historial = [];             // [situación, activo, acción, firma, excepción]
    this._ultimaSituacion = null;
    this._ultimaDecision = [this.reposo, null, '', false];
  }

  // ---- decidir ------------------------------------------------------------------------------------------------

  /** ACTIVACIÓN DISPERSA. `lugar` es una función que da la firma del sitio. Devuelve [acción, neurona o null]. */
  decidirSituacion(situacion, activo, lugar) {
    this.ticks++;
    let accion, neurona, firma, excepcion;
    if (!activo) [accion, neurona, firma, excepcion] = [this.reposo, null, '', false];
    else if (situacion === this._ultimaSituacion) [accion, neurona, firma, excepcion] = this._ultimaDecision;
    else {
      this.evaluaciones++;
      firma = lugar();
      neurona = this.excepciones.get(`${situacion}|${firma}`) || null;
      excepcion = neurona !== null;
      if (!excepcion) {
        neurona = this.neuronas.get(situacion) || null;
        if (neurona === null && this.completar) neurona = this._completar(situacion);
      }
      accion = neurona ? neurona.accion : this.reposo;
      if (neurona === null && this.generalizar) {
        const general = this._respuestaDelConcepto(this.percepcion.nombrar(situacion));
        if (general) accion = general;
      }
      if (neurona === null && this.instintos === 'antes') {
        const preferidas = (this.tablaInstintos[this.percepcion.nombrar(situacion)] || []).filter((a) => this.acciones.includes(a));
        if (preferidas.length) accion = preferidas[0];
      }
      if (this.porConcepto && !excepcion) accion = this._vetoDelConcepto(neurona ? neurona.concepto : this.percepcion.nombrar(situacion), accion);
      this._ultimaDecision = [accion, neurona, firma, excepcion];
    }
    this._ultimaSituacion = activo ? situacion : null;
    if (accion !== this.reposo) this.disparos++;
    this.historial.push([situacion, activo, accion, firma, excepcion]);
    return [accion, neurona];
  }

  /**
   * EL VETO DEL CONCEPTO: si la acción le ha fallado a este concepto (en cualquiera de sus situaciones) al menos
   * UMBRAL_MIEDO, se hace la que menos le ha fallado (ante empate, la primera del orden: la prudencia primero).
   */
  _vetoDelConcepto(concepto, accion) {
    const miedo = this.miedos.get(concepto);
    if (!miedo || (miedo[accion] || 0) < this.p.umbralMiedo) return accion;
    let orden = this.acciones;
    if (concepto in this.prudencia) {
      const primeras = this.prudencia[concepto];
      orden = [...primeras, ...this.acciones.filter((a) => !primeras.includes(a))];
    }
    return maxPorClave(orden, (a) => -(miedo[a] || 0));
  }

  _completar(situacion) {
    const concepto = this.percepcion.nombrar(situacion);
    let mejor = null, distanciaMejor = this.p.distanciaCompletado + 1;
    for (const [otra, neurona] of this.neuronas) {
      if (neurona.concepto !== concepto) continue;
      let distancia = 0;
      const n = Math.min(situacion.length, otra.length);   // (zip de Python: hasta la más corta)
      for (let i = 0; i < n; i++) if (situacion[i] !== otra[i]) distancia++;
      if (distancia < distanciaMejor) { mejor = neurona; distanciaMejor = distancia; }
    }
    return mejor;
  }

  _elegir(neurona) {
    const aciertos = neurona.aciertos || {};
    let orden = this.acciones;
    const concepto = neurona.concepto;
    if (this.instintos && concepto in this.tablaInstintos) {
      const preferidas = this.tablaInstintos[concepto].filter((a) => this.acciones.includes(a));
      orden = [this.reposo, ...preferidas, ...this.acciones.filter((a) => !preferidas.includes(a) && a !== this.reposo)];
    }
    if (this.generalizar) {
      const votos = this._votosDelConcepto(concepto);
      const preferidas = this.acciones.filter((a) => a !== this.reposo && votos[a]).sort((a, b) => votos[b] - votos[a]);
      orden = [this.reposo, ...preferidas, ...orden.filter((a) => !preferidas.includes(a) && a !== this.reposo)];
    }
    if (concepto in this.prudencia) {
      const primeras = this.prudencia[concepto];
      orden = [this.reposo, ...primeras, ...this.acciones.filter((a) => a !== this.reposo && !primeras.includes(a))];
    }
    return maxPorClave(orden, (a) => ((aciertos[a] || 0) + 1) / ((aciertos[a] || 0) + (neurona.fallos[a] || 0) + 2));
  }

  // ---- instinto aprendido (generalizar) ------------------------------------------------------------------------

  _leccion(aprender) {
    this._votos = null;
    this._votosDelConcepto(null);
    const resultado = aprender();
    this._votos = null;
    return resultado;
  }

  _votosDelConcepto(concepto) {
    if (this._votos === null) {
      this._votos = new Map();
      if (this.generalizar) {
        for (const neurona of this.neuronas.values()) {
          if (!this._votos.has(neurona.concepto)) this._votos.set(neurona.concepto, {});
          const votos = this._votos.get(neurona.concepto);
          votos[neurona.accion] = (votos[neurona.accion] || 0) + 1;
        }
      }
    }
    return this._votos.get(concepto) || {};
  }

  _respuestaDelConcepto(concepto) {
    const votos = this._votosDelConcepto(concepto);
    const claves = Object.keys(votos);
    if (!claves.length) return null;
    const accion = maxPorClave(claves, (a) => votos[a]);
    const total = claves.reduce((s, a) => s + votos[a], 0);
    if (accion !== this.reposo && this.acciones.includes(accion) && votos[accion] >= 3 && 2 * votos[accion] > total) return accion;
    return null;
  }

  _nueva(situacion, accion = null, concepto = null) {
    const fallos = {};
    for (const a of this.acciones) fallos[a] = 0;
    return { concepto: concepto !== null ? concepto : this.percepcion.nombrar(situacion), fallos,
             accion: accion !== null ? accion : this.reposo };
  }

  descartar(n) {
    if (n > 0) this.historial.splice(Math.max(0, this.historial.length - n));
  }

  // ---- aprender de lo que sale bien ---------------------------------------------------------------------------

  consolidar(margen = 20) { return this._leccion(() => this._consolidar(margen)); }

  _consolidar(margen) {
    const finales = new Set();
    let activos = 0;
    for (let i = this.historial.length - 1; i >= 0; i--) {
      const [situacion, activo] = this.historial[i];
      if (activo) {
        activos++;
        if (activos > margen) break;
        finales.add(situacion);
      }
    }
    const vistas = new Set();
    activos = 0;
    for (let i = this.historial.length - 1; i >= 0; i--) {
      const [situacion, activo, accion, firma, excepcion] = this.historial[i];
      if (!activo) continue;
      activos++;
      if (activos <= margen || finales.has(situacion) || this.percepcion.tranquila(situacion)) continue;
      const [memoria, clave] = excepcion ? [this.excepciones, `${situacion}|${firma}`] : [this.neuronas, situacion];
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      if (!memoria.has(clave)) memoria.set(clave, this._nueva(situacion));
      const neurona = memoria.get(clave);
      if (!neurona.aciertos) neurona.aciertos = {};
      neurona.aciertos[accion] = (neurona.aciertos[accion] || 0) + 1;
      neurona.accion = this._elegir(neurona);
      if (this.porConcepto) { const miedo = this.miedos.get(neurona.concepto); if (miedo && miedo[accion]) miedo[accion] *= this.p.extincionMiedo; }
    }
  }

  proteger() { return this._leccion(() => this._proteger()); }

  _proteger() {
    const protegidas = new Set();
    for (const [situacion, activo, accion, , excepcion] of this.historial) {
      if (!activo || excepcion || this.percepcion.tranquila(situacion) || protegidas.has(situacion)) continue;
      if (!this.neuronas.has(situacion)) this.neuronas.set(situacion, this._nueva(situacion, accion));
      const neurona = this.neuronas.get(situacion);
      if (neurona.accion === accion) { neurona.protegida = true; protegidas.add(situacion); }
    }
    return protegidas.size;
  }

  // ---- la recompensa interna (homeostasis) -------------------------------------------------------------------

  /**
   * RECOMPENSA HOMEOSTÁTICA (Keramati y Gutkin 2014): la recompensa es cuánto ha bajado el impulso del cuerpo desde la
   * última vez; solo los cambios bruscos cuentan (1 bueno, -1 malo, 0 nada). Quien juega aplica la lección.
   */
  sentir(impulso, umbral = this.p.umbralHomeostasis) {
    const previo = this._impulso; this._impulso = impulso;
    if (previo === null) return 0;
    const r = previo - impulso;
    if (r >= umbral) return 1;
    if (r <= -umbral) return -1;
    return 0;
  }

  // ---- las metas sostenidas ----------------------------------------------------------------------------------

  /** META SOSTENIDA (O'Reilly y Frank 2006): mientras está activa, el progreso hacia ella cuenta. */
  fijarMeta(nombre) { if (this.meta === null || this.meta.nombre !== nombre) this.meta = { nombre, tramos: 0 }; }

  soltarMeta() { this.meta = null; }

  /** PROGRESO POR TRAMOS (Botvinick 2009): cada tramo nuevo de TRAMO_META devuelve 1; si se pierde terreno, se recuenta. */
  avanzarMeta(fraccion) {
    if (this.meta === null) return 0;
    const tramos = Math.floor(Math.min(1, Math.max(0, fraccion)) / this.p.tramoMeta + 1e-9);
    if (tramos > this.meta.tramos) { this.meta.tramos = tramos; return 1; }
    if (tramos < this.meta.tramos) this.meta.tramos = tramos;
    return 0;
  }

  // ---- la decepción (error de predicción) --------------------------------------------------------------------

  decepcionar(peso = this.p.pesoDecepcion) { return this._leccion(() => this._decepcionar(peso)); }

  /**
   * ERROR DE PREDICCIÓN (la dopamina, Schultz): si la última decisión activa usó una acción que en esa situación ya había
   * salido bien (tiene aciertos) y esta vez no ha dado nada, cuenta como un fallo pequeño. Sin expectativa no hay decepción.
   */
  _decepcionar(peso) {
    for (let k = this.historial.length - 1; k >= 0; k--) {
      const [situacion, activo, accion, firma, excepcion] = this.historial[k];
      if (!activo) continue;
      const [memoria, clave] = excepcion ? [this.excepciones, `${situacion}|${firma}`] : [this.neuronas, situacion];
      const neurona = memoria.get(clave);
      if (!neurona || !((neurona.aciertos || {})[accion] > 0)) return null;
      neurona.fallos[accion] = (neurona.fallos[accion] || 0) + peso;
      neurona.accion = this._elegir(neurona);
      return neurona.accion;
    }
    return null;
  }

  // ---- el repaso durante el sueño (replay) --------------------------------------------------------------------

  repasar(entradas, exito, peso = 1) { return this._leccion(() => this._repasar(entradas, exito, peso)); }

  /**
   * REPASO (la reactivación del hipocampo durante el sueño, Wilson y McNaughton): unas decisiones de hace tiempo
   * (situación, acción) se repasan sabiendo cómo acabó aquello: si salió bien, aciertos; si salió mal, fallos. Une causas
   * y efectos separados por meses. Lo que sale bien apaga además el miedo del concepto (extinción). Devuelve cuántas
   * neuronas cambiaron de acción.
   */
  _repasar(entradas, exito, peso) {
    let cambiadas = 0;
    for (const [situacion, accion] of entradas) {
      if (!this.acciones.includes(accion) || this.percepcion.tranquila(situacion)) continue;
      if (!this.neuronas.has(situacion)) this.neuronas.set(situacion, this._nueva(situacion));
      const neurona = this.neuronas.get(situacion);
      const antes = neurona.accion;
      if (exito) {
        if (!neurona.aciertos) neurona.aciertos = {}; neurona.aciertos[accion] = (neurona.aciertos[accion] || 0) + peso;
        // (EXTINCIÓN POR ÉXITO: lo que sale bien al repasarlo —también el alivio— apaga el miedo del concepto, en proporción al peso)
        if (this.porConcepto) { const miedo = this.miedos.get(neurona.concepto); if (miedo && miedo[accion]) miedo[accion] *= this.p.extincionMiedo ** peso; }
      } else neurona.fallos[accion] = (neurona.fallos[accion] || 0) + peso;
      neurona.accion = this._elegir(neurona);
      if (neurona.accion !== antes) cambiadas++;
    }
    return cambiadas;
  }

  // ---- aprender de los fracasos -------------------------------------------------------------------------------

  aprenderDeFracaso(lugar = null) { return this._leccion(() => this._aprenderDeFracaso(lugar)); }

  _aprenderDeFracaso(lugar) {
    const callejon = lugar !== null ? this._callejon(lugar) : null;
    const ventana = this.p.ventanaCulpa * (1 + (callejon ? callejon.agotado : 0));
    const culpables = new Map(), recencia = new Map(), contexto = new Map();
    let i = 0;
    for (let k = this.historial.length - 1; k >= 0; k--) {
      const [situacion, activo, accion, firma, excepcion] = this.historial[k];
      if (!activo) continue;
      if (i >= ventana) break;
      if (!this.percepcion.tranquila(situacion) && !culpables.has(situacion)) {
        culpables.set(situacion, accion); recencia.set(situacion, i); contexto.set(situacion, [firma, excepcion]);
      }
      i++;
    }
    let orden = [...culpables.keys()];
    const retroceso = callejon ? this._retrocesoEnCallejon(callejon, orden, culpables, contexto) : 0;
    if (callejon && orden.length && retroceso >= orden.length) {
      const agotado = callejon.agotado + 1;
      callejon.retroceso = 0; callejon.pruebas = new Map(); callejon.agotado = agotado > this.p.maxAgotado ? 0 : agotado;
      return null;
    }
    orden = retroceso === 0 ? orden.filter((s) => recencia.get(s) < this.p.recenciaCulpa) : orden.slice(retroceso);

    orden.slice(0, this.p.culpables).forEach((situacion, j) => {
      let [firma, excepcion] = contexto.get(situacion);
      const general = this.neuronas.get(situacion);
      if (!excepcion && general && (general.protegida || (this.separar && general.conflicto))) {
        excepcion = true;
        const clave = `${situacion}|${firma}`;
        if (!this.excepciones.has(clave)) this.excepciones.set(clave, this._nueva(situacion, general.accion, general.concepto));
      }
      const [memoria, clave] = excepcion ? [this.excepciones, `${situacion}|${firma}`] : [this.neuronas, situacion];
      if (!memoria.has(clave)) memoria.set(clave, this._nueva(situacion));
      const neurona = memoria.get(clave);
      const antes = neurona.accion;
      const culpada = culpables.get(situacion);
      neurona.fallos[culpada] = (neurona.fallos[culpada] || 0) + this.p.decaimientoCulpa ** j;
      if (this.porConcepto) {
        if (!this.miedos.has(neurona.concepto)) this.miedos.set(neurona.concepto, {});
        const miedo = this.miedos.get(neurona.concepto);
        miedo[culpada] = (miedo[culpada] || 0) + this.p.decaimientoCulpa ** j;
      }
      neurona.accion = this._elegir(neurona);
      if (this.separar && !excepcion && lugar !== null && neurona.accion !== antes) {
        if (!neurona.sitios_cambio) neurona.sitios_cambio = [];
        neurona.sitios_cambio.push(redondearPython(lugar / this.p.toleranciaLugar));
        if (neurona.sitios_cambio.length >= this.p.cambiosConflicto && new Set(neurona.sitios_cambio).size >= 2) neurona.conflicto = true;
      }
    });

    if (!orden.length) return null;
    const principal = orden[0];
    return [this.neuronas.get(principal).concepto, principal, this.neuronas.get(principal).accion, retroceso];
  }

  _callejon(lugar) {
    let callejon = this.callejones.find((c) => Math.abs(c.lugar - lugar) <= this.p.toleranciaLugar);
    if (!callejon) {
      callejon = { lugar, retroceso: 0, pruebas: new Map(), agotado: 0 };
      this.callejones.push(callejon);
    }
    return callejon;
  }

  agotado(lugar) { return this._callejon(lugar).agotado; }

  _retrocesoEnCallejon(callejon, orden, culpables, contexto) {
    const lugar = callejon.lugar;
    for (const situacion of orden) {
      if (!callejon.pruebas.has(situacion)) callejon.pruebas.set(situacion, {});
      const pruebas = callejon.pruebas.get(situacion);
      const a = culpables.get(situacion);
      pruebas[a] = Math.max(a in pruebas ? pruebas[a] : lugar, lugar);
    }
    while (callejon.retroceso < orden.length) {
      const situacion = orden[callejon.retroceso];
      const pruebas = callejon.pruebas.get(situacion);
      if (!this.acciones.every((a) => a in pruebas)) break;
      const mejor = maxPorClave(this.acciones, (a) => pruebas[a]);
      const fallos = {};
      for (const a of this.acciones) fallos[a] = a === mejor ? 0 : 0.01;
      this.excepciones.set(`${situacion}|${contexto.get(situacion)[0]}`,
                           { concepto: this.percepcion.nombrar(situacion), fallos, accion: mejor });
      callejon.retroceso++;
    }
    return callejon.retroceso;
  }

  // ---- memoria ------------------------------------------------------------------------------------------------

  /** Lo que se guarda en disco: el mismo formato que Python ({neuronas, excepciones}). */
  aObjeto() {
    return { neuronas: Object.fromEntries(this.neuronas), excepciones: Object.fromEntries(this.excepciones) };
  }

  cargarObjeto(datos) {
    this.neuronas = new Map(Object.entries(datos.neuronas || {}));
    this.excepciones = new Map(Object.entries(datos.excepciones || {}));
  }
}

/** La percepción de plataformas (percepcion_plataformas.py): solo lo que el núcleo le pregunta. */
export class PercepcionPlataformas {
  constructor(alcance = 4, mirarArriba = false) {
    this.alcance = alcance;
    this.mirarArriba = mirarArriba;
    this.patronTranquilo = ['.'.repeat(alcance), '.'.repeat(alcance), 'S'.repeat(alcance)];
  }

  tranquila(patron) {
    const partes = patron.split('/');
    for (let i = 0; i < 3; i++) if (partes[i] !== this.patronTranquilo[i]) return false;
    return (!this.mirarArriba || !partes[3].includes('E')) && !partes[partes.length - 1].includes('E');
  }

  nombrar(patron) {
    const [, frente, piso] = patron.split('/');
    if (patron.includes('E')) return 'Peligro en trayectoria';
    if (patron.includes('e')) return 'Enemigo alejándose';
    if (frente.includes('S')) return 'Obstáculo al frente';
    if (piso.includes('.')) return 'Vacío adelante';
    return 'Otro';
  }
}
