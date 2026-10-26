// RIPOLLET EN EL TIEMPO: la ortofoto de cada vuelo histórico (ICGC: 1946, 1956, 1977, 1986, 1994; IGN PNOA: 2004,
// 2012, 2018; obtener_historico.py) sobre el relieve de la maqueta, y de los edificios de hoy solo los que ya existían
// ese año según el Catastro (los demás se descartan en el shader: textura del año de cada celda de 4 m). Mientras se
// mira el pasado se esconde lo moderno (árboles, tráfico, farolas, mobiliario, toldos) y las sombras proyectadas
// (la foto ya trae las suyas). Las fotos se descargan al elegir cada año (≈ 200 KB cada una).

export const TEXTOS_HISTORIA = {
  es: {
    epocaBoton: "🕰 Ripollet en el tiempo", hiTitulo: "Ripollet en el tiempo", hiHoy: "Hoy", hiPlay: "▶ Ver crecer",
    hiPausa: "⏸ Pausa", hiEdificios: "Edificios 3D que ya existían ese año (Catastro)",
    hiCuenta: "<b>{0}</b> de {1} edificios de hoy ya existían en {2}.", hiCargando: "Cargando la foto de {0}…",
    hiError: "No se ha podido cargar la foto de {0}.", hiFuente: "Foto: {0}",
    hiNota: "Ortofotos históricas del ICGC (1946: vuelo americano serie A; 1956: serie B; 1977, 1986, 1994) y del " +
      "IGN (PNOA 2004, 2012, 2018). El año de cada edificio es el de construcción del Catastro: en edificios muy " +
      "reformados puede ser el de la reforma, y los que se derribaron no están.",
  },
  ca: {
    epocaBoton: "🕰 Ripollet en el temps", hiTitulo: "Ripollet en el temps", hiHoy: "Avui", hiPlay: "▶ Veure créixer",
    hiPausa: "⏸ Pausa", hiEdificios: "Edificis 3D que ja existien aquell any (Cadastre)",
    hiCuenta: "<b>{0}</b> de {1} edificis d'avui ja existien el {2}.", hiCargando: "Carregant la foto del {0}…",
    hiError: "No s'ha pogut carregar la foto del {0}.", hiFuente: "Foto: {0}",
    hiNota: "Ortofotos històriques de l'ICGC (1946: vol americà sèrie A; 1956: sèrie B; 1977, 1986, 1994) i de " +
      "l'IGN (PNOA 2004, 2012, 2018). L'any de cada edifici és el de construcció del Cadastre: en edificis molt " +
      "reformats pot ser el de la reforma, i els que es van enderrocar no hi són.",
  },
};
const VUELOS = [[1946, "ICGC"], [1956, "ICGC"], [1977, "ICGC"], [1986, "ICGC"], [1994, "ICGC"], [2004, "IGN · PNOA"],
                [2012, "IGN · PNOA"], [2018, "IGN · PNOA"]];
const EN_LINEA = "https://fokosoft.github.io/Ripollet/web/historico/";
// Lo que se queda a la vista con una foto antigua: terreno, edificios (filtrados por año) e hitos
const QUEDA = /^(suelo|tierra|muro_|tejado|azotea|piedra_casa|ladrillo|revoco|hueco|hierro|esfera|azulejo|agua)/;

const herramientaHistoria = {
  id: "epoca",
  textos: TEXTOS_HISTORIA,
  crear(ctx, div) {
    const { THREE, D, SIM, scene, t, numero, $ } = ctx;
    const R = ctx.rehab, nEd = R ? R.length / 5 : 0;

    // ---------------------------------------------------------------- año de construcción de cada celda de 4 m
    const datos = ctx.anoEdificios.textura.image.data;
    if (R) {
      const cod = (b) => { const a = R[(b - 1) * 5]; return a ? Math.max(1, Math.min(254, a - 1800)) : 0; };
      for (let k = 0; k < datos.length; k++) datos[k] = D.edificios[k] ? cod(D.edificios[k]) : 0;
      // Las paredes caen en el borde: las celdas vacías junto a un edificio toman su año (el mayor de los vecinos)
      const copia = datos.slice(), nx = SIM.nx;
      for (let k = 0; k < datos.length; k++) {
        if (copia[k]) continue;
        let m = 0;
        for (const d of [-1, 1, -nx, nx, -nx - 1, -nx + 1, nx - 1, nx + 1]) m = Math.max(m, copia[k + d] ?? 0);
        datos[k] = m;
      }
      ctx.anoEdificios.textura.needsUpdate = true;
    }

    // ---------------------------------------------------------------- la foto sobre el relieve
    const L0 = D.terreno.lx, L1 = D.terreno.ly;
    const matFoto = new THREE.ShaderMaterial({
      uniforms: { tFoto: { value: null }, uL: { value: new THREE.Vector2(L0, L1) } },
      vertexShader: `varying vec2 vUv;
        uniform vec2 uL;
        void main() {
          vUv = vec2((position.x + uL.x) / (2.0 * uL.x), 1.0 - (position.z + uL.y) / (2.0 * uL.y));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 1.0, 0.0), 1.0);
        }`,
      fragmentShader: `uniform sampler2D tFoto; varying vec2 vUv;
        void main() { gl_FragColor = vec4(texture2D(tFoto, vUv).rgb, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const foto = new THREE.Mesh(ctx.geoCeldas, matFoto);
    Object.assign(foto, { frustumCulled: false, visible: false });
    scene.add(foto);
    const cache = new Map();
    function cargar(ano) {
      if (!cache.has(ano)) {
        // Junto a la página (web/), desde la raíz del repositorio (ripollet.html) o, con file://, de la web publicada
        const urls = location.protocol === "file:" ? [EN_LINEA] : ["historico/", "web/historico/", EN_LINEA];
        cache.set(ano, (async () => {
          for (const base of urls) {
            try {
              const tex = await new THREE.TextureLoader().setCrossOrigin("anonymous").loadAsync(`${base}${ano}.jpg`);
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
              return tex;
            } catch {}
          }
          throw new Error("sin foto");
        })());
      }
      return cache.get(ano);
    }

    // ---------------------------------------------------------------- esconder lo moderno
    let escondidos = null, sombra = true;
    function pasado(si) {
      if (si && !escondidos) {
        escondidos = [];
        const raizGlb = ctx.mallasModelo.find((o) => !o.isInstancedMesh)?.parent;
        for (const o of scene.children) {
          if (o === foto || o.isLight || o.isCSS2DObject || !o.visible || o === raizGlb || o.type === "Object3D") continue;
          o.visible = false; escondidos.push(o);
        }
        for (const o of raizGlb?.children ?? [])
          if (o.visible && !QUEDA.test(o.material?.name ?? "")) { o.visible = false; escondidos.push(o); }
        sombra = ctx.sol.castShadow;
        ctx.sol.castShadow = false;
      } else if (!si && escondidos) {
        for (const o of escondidos) o.visible = true;
        escondidos = null;
        ctx.sol.castShadow = sombra;
      }
      foto.visible = si;
    }

    // ---------------------------------------------------------------- panel
    div.innerHTML = `<b data-t="hiTitulo"></b>
      <div id="hiAno" style="font:700 40px/1 var(--pixel);margin:8px 0 2px;color:var(--acento)"></div>
      <div id="hiFoto" style="margin-top:2px;font-size:12px;opacity:.85"></div>
      <input type="range" id="hiSlider" min="0" max="${VUELOS.length}" step="1" value="0" style="margin-top:8px">
      <div id="hiMarcas" style="display:flex;justify-content:space-between;font-size:10px;opacity:.75"></div>
      <div class="botones"><button id="hiPlay" class="principal"></button></div>
      <label><input type="checkbox" id="hiEdif" checked> <span data-t="hiEdificios"></span></label>
      <p id="hiCuenta"></p>
      <p class="nota" data-t="hiNota"></p>`;
    let indice = 0, reproduciendo = null, abierto = false;
    async function poner(i) {
      indice = i;
      $("hiSlider").value = i;
      const hoy = i >= VUELOS.length, ano = hoy ? 0 : VUELOS[i][0];
      $("hiAno").textContent = hoy ? t("hiHoy") : ano;
      ctx.anoEdificios.ano.value = !hoy && $("hiEdif").checked ? ano : 0;
      ctx.anoEdificios.todos.value = !hoy && !$("hiEdif").checked ? 1 : 0;
      cuenta(ano);
      if (hoy || !abierto) { pasado(false); $("hiFoto").textContent = ""; return; }
      pasado(true);
      $("hiFoto").textContent = t("hiCargando", ano);
      try {
        const tex = await cargar(ano);
        if (indice !== i || !abierto) return;
        matFoto.uniforms.tFoto.value = tex;
        $("hiFoto").textContent = t("hiFuente", VUELOS[i][1]);
      } catch { if (indice === i) $("hiFoto").textContent = t("hiError", ano); }
    }
    function cuenta(ano) {
      if (!R || !ano) { $("hiCuenta").innerHTML = ""; return; }
      let n = 0;
      for (let b = 0; b < nEd; b++) if (R[b * 5] && R[b * 5] <= ano) n++;
      $("hiCuenta").innerHTML = t("hiCuenta", numero(n), numero(nEd), ano);
    }
    function rotulos() {
      $("hiPlay").textContent = t(reproduciendo ? "hiPausa" : "hiPlay");
      $("hiMarcas").innerHTML = [...VUELOS.map(([a]) => `'${String(a).slice(2)}`), t("hiHoy")].map((s) => `<span>${s}</span>`).join("");
      $("hiSlider").setAttribute("aria-label", t("hiTitulo"));
      poner(indice);
    }
    $("hiSlider").oninput = () => { parar(); poner(+$("hiSlider").value); };
    $("hiEdif").onchange = () => poner(indice);
    function parar() { clearInterval(reproduciendo); reproduciendo = null; $("hiPlay").textContent = t("hiPlay"); }
    $("hiPlay").onclick = () => {
      if (reproduciendo) return parar();
      VUELOS.forEach(([a]) => cargar(a).catch(() => {}));          // precarga
      poner(0);
      reproduciendo = setInterval(() => { if (indice >= VUELOS.length) parar(); else poner(indice + 1); }, 2200);
      $("hiPlay").textContent = t("hiPausa");
    };
    return {
      alMostrar() { abierto = true; rotulos(); },
      alOcultar() {
        abierto = false; parar(); pasado(false);
        ctx.anoEdificios.ano.value = 0; ctx.anoEdificios.todos.value = 0;
      },
      traducir: rotulos,
      enlace: () => ({ ano: indice < VUELOS.length ? VUELOS[indice][0] : "hoy" }),
      restaurar(params) { const a = +params.get("ano"); const i = VUELOS.findIndex(([v]) => v === a); if (i >= 0) poner(i); },
    };
  },
};
(globalThis.HERRAMIENTAS ??= []).push(herramientaHistoria);
