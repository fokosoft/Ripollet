// FAROLAS: las del alumbrado público real (cartografía 1:1000 del AMB, obtener_farolas.py), de columna o de fachada.
// De noche la luminaria brilla y deja un charco de luz cálida en el suelo. Sin luces de verdad (cada una costaría
// mucho a la GPU): instancias de un poste, una luminaria y un disco con degradado que se suma a la imagen.

export function crearFarolas(ctx, datos) {
  const { THREE, scene } = ctx;
  if (!datos || !datos.length) return { cadaFrame() {} };
  const n = datos.length / 3, ALTO = 6, ALTO_PARED = 4.5;
  const columnas = [];
  for (let k = 0; k < n; k++) if (datos[k * 3 + 2] === 0) columnas.push(k);

  const geoPoste = new THREE.CylinderGeometry(0.07, 0.11, ALTO, 5);
  geoPoste.translate(0, ALTO / 2, 0);
  const geoLuz = new THREE.BoxGeometry(0.32, 0.16, 0.7);
  const postes = new THREE.InstancedMesh(geoPoste, new THREE.MeshStandardMaterial({ color: 0x3b3f46, flatShading: true }), columnas.length);
  const matLuz = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, emissive: 0xffc46b, emissiveIntensity: 0, flatShading: true });
  const luces = new THREE.InstancedMesh(geoLuz, matLuz, n);

  // Charco de luz: disco de 18 m con degradado; se suma (blending aditivo) y su fuerza depende de la noche
  const intensidad = { value: 0 };
  const charcos = new THREE.InstancedMesh(new THREE.PlaneGeometry(18, 18).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { intensidad },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float intensidad; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float f = pow(clamp(1.0 - d, 0.0, 1.0), 1.8) * intensidad;
        if (f < 0.004) discard;
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * f * 0.55, 1.0);
      }`,
  }), n);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), uno = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let c = 0;
  for (let k = 0; k < n; k++) {
    const x = datos[k * 3] / 10, z = datos[k * 3 + 1] / 10, pared = datos[k * 3 + 2] === 1;
    const y = ctx.altura(x, z);
    // Orientación al azar pero fija (no se sabe hacia dónde mira cada brazo)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((k * 2654435761) % 360) * Math.PI / 180);
    if (!pared) postes.setMatrixAt(c++, m.compose(p.set(x, y, z), q, uno));
    luces.setMatrixAt(k, m.compose(p.set(x, y + (pared ? ALTO_PARED : ALTO), z), q, uno));
    charcos.setMatrixAt(k, m.compose(p.set(x, y + 0.45, z), new THREE.Quaternion(), uno));
  }
  postes.castShadow = true;
  for (const o of [postes, luces, charcos]) { o.instanceMatrix.needsUpdate = true; scene.add(o); }
  charcos.frustumCulled = false;
  charcos.renderOrder = 3;
  charcos.visible = false;

  let ultima = -1;
  return {
    total: n,
    cadaFrame() {
      const noche = ctx.noche();
      if (Math.abs(noche - ultima) < 0.01) return;
      ultima = noche;
      matLuz.emissiveIntensity = 2.5 * noche;
      intensidad.value = noche;
      charcos.visible = noche > 0.01;
    },
  };
}
