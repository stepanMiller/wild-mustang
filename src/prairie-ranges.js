const TAU = Math.PI * 2;
const clamp = n => Math.min(1, Math.max(0, n));

// The three closed ranges start outside every playable camera position.
// Each buttress has a long shoulder and a short escarpment. The toes of the
// near hills overlap the skirts of the next range, including at the map corners.
const RANGES = [
  { toe: 163, crest: 224, base: 11, rise: 25, soil: 0x486e63, sun: 0x91a378 },
  { toe: 234, crest: 305, base: 23, rise: 41, soil: 0x546e84, sun: 0xb49d88 },
  { toe: 310, crest: 406, base: 39, rise: 57, soil: 0x74819b, sun: 0xcab9ae },
];

export function createPrairieRanges(THREE, random) {
  const vertices = [], colors = [];
  const color = new THREE.Color(), ice = new THREE.Color(0xf4e4cf).convertSRGBToLinear();
  const segments = 180;
  for (const [layer, range] of RANGES.entries()) {
    const shade = new THREE.Color(range.soil).convertSRGBToLinear();
    const light = new THREE.Color(range.sun).convertSRGBToLinear();
    // Five draws per summit retain the established seed sequence of the
    // foreground rocks and trees, whose positions are also camera obstacles.
    const summits = Array.from({ length: 10 }, (_, i) => ({
      bearing: (i + random() * .45) * TAU / 10,
      height: .36 + random() * .72,
      west: .18 + random() * .32, east: .16 + random() * .27,
      skew: (random() - .5) * .22,
    }));
    const rows = [];
    for (const t of [0, .38, .64, .84, 1]) {
      const row = [];
      for (let i = 0; i < segments; i++) {
        const a = i * TAU / segments;
        let relief = 0;
        for (const peak of summits) {
          const offset = a - peak.bearing - (1 - t) * peak.skew;
          const delta = Math.atan2(Math.sin(offset), Math.cos(offset));
          const flank = 1 - Math.abs(delta) / (delta < 0 ? peak.west : peak.east);
          relief = Math.max(relief, peak.height * Math.max(0, flank));
        }
        const spur = Math.sin(17 * a + layer * 2 + t * .6) + Math.sin(41 * a + layer) * .36;
        const radius = range.toe + (range.crest - range.toe) * t - 9 * spur * Math.sin(Math.PI * t);
        // A broad saddle behind the herd admits the late sun. A shallower
        // opening on the western fork keeps sky above the first valley vista.
        const eastPass = Math.exp(-((Math.sin((a + 1.27) * .5) / .20) ** 2));
        const valleyPass = Math.exp(-((Math.sin((a + 1.85) * .5) / .27) ** 2));
        const reliefScale = .88 - .38 * eastPass - .18 * valleyPass;
        const height = -7 + t * (7 + (range.base + range.rise * relief + 2.8 * spur) * reliefScale);
        row.push({ x: radius * Math.cos(a), y: height, z: radius * Math.sin(a), t, spur });
      }
      rows.push(row);
    }
    function facet(a, b, c) {
      const nx = (b.y-a.y)*(c.z-a.z) - (b.z-a.z)*(c.y-a.y);
      const nz = (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
      const ny = (b.z-a.z)*(c.x-a.x) - (b.x-a.x)*(c.z-a.z);
      const norm = Math.hypot(nx,ny,nz) || 1;
      // Bake orientation into the painted planes so the far range stays airy.
      const faceLight = clamp(.4 + (.8*nx + .42*ny - .42*nz) / norm * .68);
      for (const p of [a,b,c]) {
        color.copy(shade).lerp(light, faceLight * (.5 + p.t * .48));
        const snow = layer === 2 ? clamp((p.y - 64 + p.spur * 4) / 9) : 0;
        color.lerp(ice, snow * (.54 + faceLight * .42));
        vertices.push(p.x, p.y, p.z);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let j = 1; j < rows.length; j++) {
      for (let i = 0; i < segments; i++) {
        const k = (i + 1) % segments, lower = rows[j-1], upper = rows[j];
        facet(lower[i], lower[k], upper[i]);
        facet(lower[k], upper[k], upper[i]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
