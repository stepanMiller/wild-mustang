// An equirectangular cloud painting, built once. Its red channel gives the
// light-to-shadow ramp and alpha gives the silhouette of each cloud bank.
function cloudPainting(THREE, random) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 48; i++) {
    const x = random() * canvas.width, y = 96 + random() * 29;
    const width = 22 + random() * 112, height = 1.2 + random() ** 2 * 7;
    const puffs = Array.from({ length: 6 }, (_, j) => ({
      center: (j + random()) / 6,
      height: .25 + random() * .75,
      spread: .05 + random() * .13,
    }));
    const edge = [];
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const dome = Math.max(...puffs.map(p => p.height * Math.exp(-(((t - p.center) / p.spread) ** 2))));
      edge.push([width * t, -height * dome * Math.sin(Math.PI * t) ** .55]);
    }
    for (const dx of [-canvas.width, 0, canvas.width]) {
      ctx.save();
      ctx.translate(x + dx, y);
      const tint = ctx.createLinearGradient(0, -height, 0, height * .12);
      tint.addColorStop(0, 'rgba(255,255,255,.92)');
      tint.addColorStop(.64, 'rgba(204,204,204,.82)');
      tint.addColorStop(1, 'rgba(103,103,103,.45)');
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (const [px, py] of edge) ctx.lineTo(px, py);
      ctx.bezierCurveTo(width * .65, height * .15, width * .31, height * .26, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function createPrairieSky(THREE, random) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() }, clouds: { value: cloudPainting(THREE, random) },
      drift: { value: 0 },
    },
    vertexShader: `
      varying vec3 direction;
      varying vec2 skyUv;
      void main() {
        skyUv = uv;
        direction = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      varying vec3 direction;
      varying vec2 skyUv;
      uniform vec3 zenith, horizon, sunDir;
      uniform float drift;
      uniform sampler2D clouds;
      void main() {
        vec3 ray = normalize(direction);
        float height = smoothstep(-.09, .34, ray.y);
        float sun = max(dot(ray, sunDir), 0.);
        vec3 sky = mix(horizon, zenith, sqrt(height));
        sky += vec3(.45,.21,.065) * pow(sun, 12.);
        sky += vec3(.85,.54,.21) * pow(sun, 260.);
        sky = mix(sky, vec3(2.8,2.1,1.2), smoothstep(.99965,.99983,sun));
        vec4 cloud = texture2D(clouds, vec2(skyUv.x + drift, skyUv.y));
        vec3 cloudBase = mix(zenith, horizon, .5) * .87;
        vec3 cloudLight = mix(vec3(1.06,.96,.84), vec3(1.45,1.05,.67), pow(sun, 5.));
        sky = mix(sky, mix(cloudBase, cloudLight, cloud.r), cloud.a);
        gl_FragColor = vec4(sky, 1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = 3;
  return sky;
}
