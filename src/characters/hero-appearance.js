// Veter's markings are painted into the original skinned surface. Cutting the
// triangles at the edges of each marking keeps a crisp coat pattern without a
// floating decal, another draw call or a separate animation rig.
const DARK = 0x171411;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function interpolate(a, b, t) {
  const mix = (key) => a[key].map((value, i) => value + (b[key][i] - value) * t);
  const weights = new Map();
  for (const [vertex, factor] of [[a, 1 - t], [b, t]]) {
    vertex.joints.forEach((joint, i) => weights.set(joint, (weights.get(joint) || 0) + vertex.weights[i] * factor));
  }
  const ranked = [...weights].filter(([, weight]) => weight > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const total = ranked.reduce((sum, [, weight]) => sum + weight, 0);
  while (ranked.length < 4) ranked.push([0, 0]);
  return { position: mix('position'), normal: mix('normal'), color: mix('color'),
    joints: ranked.map(([joint]) => joint), weights: ranked.map(([, weight]) => weight / total) };
}

function clip(polygon, plane, inside) {
  const result = [];
  const distance = (vertex) => plane[0] * vertex.position[0] + plane[1] * vertex.position[1]
    + plane[2] * vertex.position[2] + plane[3];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = distance(a), db = distance(b);
    const keepA = inside ? da >= 0 : da <= 0;
    const keepB = inside ? db >= 0 : db <= 0;
    if (keepA) result.push(a);
    if (keepA !== keepB) result.push(interpolate(a, b, da / (da - db)));
  }
  return result;
}

function appendPolygon(output, polygon, color) {
  for (let i = 1; i < polygon.length - 1; i++) {
    for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
      output.position.push(...vertex.position);
      output.normal.push(...vertex.normal);
      output.color.push(...(color || vertex.color));
      output.skinIndex.push(...vertex.joints);
      output.skinWeight.push(...vertex.weights);
    }
  }
}

function paintRegion(THREE, geometry, planes, eligible, color) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const attributes = source.attributes;
  const output = { position: [], normal: [], color: [], skinIndex: [], skinWeight: [] };
  let painted = 0;
  const read = (attribute, index) => Array.from({ length: attribute.itemSize }, (_, component) =>
    attribute.array[index * attribute.itemSize + component]);
  for (let i = 0; i < attributes.position.count; i += 3) {
    let polygon = [0, 1, 2].map((offset) => ({
      position: read(attributes.position, i + offset), normal: read(attributes.normal, i + offset),
      color: read(attributes.color, i + offset), joints: read(attributes.skinIndex, i + offset),
      weights: read(attributes.skinWeight, i + offset),
    }));
    if (!eligible(polygon)) { appendPolygon(output, polygon); continue; }
    for (const plane of planes) {
      appendPolygon(output, clip(polygon, plane, false));
      polygon = clip(polygon, plane, true);
      if (polygon.length < 3) break;
    }
    if (polygon.length >= 3) {
      appendPolygon(output, polygon, color);
      painted += polygon.length - 2;
    }
  }
  const result = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(output)) {
    result.setAttribute(name, name === 'skinIndex' ? new THREE.Uint16BufferAttribute(values, 4)
      : new THREE.Float32BufferAttribute(values, name === 'skinWeight' ? 4 : 3));
  }
  result.userData.paintedTriangles = painted;
  if (source !== geometry) source.dispose();
  geometry.dispose();
  return result;
}

/** A tapered lock follows the real forehead, with the same skin weights at
 * every edge. This avoids long coarse hair faces cutting through the curved
 * forehead during animation. Anatomical left is +X in the source skeleton. */
export function createHeroForelock(THREE, sourceParts) {
  const output = { position: [], normal: [], color: [], skinIndex: [], skinWeight: [] };
  const outline = [[-.10, 4.53], [.10, 4.53], [.24, 4.04], [.20, 3.98]];
  const planes = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length], dx = b[0] - a[0], dy = b[1] - a[1];
    return [dy, -dx, 0, dx * a[1] - dy * a[0]];
  });
  planes.push([0, 0, 1, -2.65]);
  const hair = new THREE.Color(0x241c1a).convertSRGBToLinear().toArray();
  const read = (attribute, index) => Array.from({ length: attribute.itemSize }, (_, component) =>
    attribute.array[index * attribute.itemSize + component]);
  for (const mesh of sourceParts) {
    if (!['Main', 'Main_Dark', 'Main_Light', 'Veter_Blaze'].includes(mesh.material.name)) continue;
    const a = mesh.geometry.attributes, indices = mesh.geometry.index;
    for (let i = 0; i < indices.count; i += 3) {
      let polygon = [0, 1, 2].map(offset => {
        const index = indices.getX(i + offset);
        return { position: read(a.position, index), normal: read(a.normal, index), color: hair,
          joints: read(a.skinIndex, index), weights: read(a.skinWeight, index) };
      });
      if (polygon.every(v => v.position[1] < 3.7) || polygon.reduce((sum, v) => sum + v.normal[2], 0) < .3) continue;
      for (const plane of planes) {
        polygon = clip(polygon, plane, true);
        if (polygon.length < 3) break;
      }
      // The slight thickness gives the lock a real silhouette. Because both
      // sides use matching weights, it remains seated on the face in every clip.
      polygon = polygon.map(v => {
        // A shared offset keeps neighbouring flat-shaded facets joined; their
        // individual face normals would otherwise open tiny cracks at each edge.
        return { ...v, position: [v.position[0], v.position[1], v.position[2] + .035] };
      });
      appendPolygon(output, polygon);
    }
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(output)) {
    geometry.setAttribute(name, name === 'skinIndex' ? new THREE.Uint16BufferAttribute(values, 4)
      : new THREE.Float32BufferAttribute(values, name === 'skinWeight' ? 4 : 3));
  }
  return geometry;
}

/** Alter only a cloned hero primitive, never the source asset or another horse. */
export function shapeHeroPrimitive(THREE, geometry, materialName) {
  if (materialName === 'Hair') {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i), z = positions.getZ(i);
      if (y < 4.3 || z < 2.64) continue;
      const tip = clamp((z - 2.64) / .33, 0, 1);
      positions.setY(i, y - .045 * tip);
      positions.setZ(i, z - .11 * tip);
    }
    geometry.computeVertexNormals();
  }
  const dark = new THREE.Color(DARK).convertSRGBToLinear().toArray();
  if (materialName === 'Main') {
    geometry = paintRegion(THREE, geometry, [
      [0, 0, 1, 1.75], [0, 0, -1, 1.35],
      [1, 0, -.065, .18], [-1, 0, -.065, .18],
      [1, 0, .035, .10], [-1, 0, .035, .10],
    ], (triangle) => triangle.every((v) => v.position[1] > 2.25)
      && triangle.reduce((sum, v) => sum + v.normal[1], 0) > 1.1, dark);
    geometry.userData.marking = 'dorsal-stripe';
  }
  if (['Main', 'Main_Dark', 'Muzzle'].includes(materialName)) {
    const stripeCount = geometry.userData.paintedTriangles || 0;
    geometry = paintRegion(THREE, geometry, [
      [0, 0, 1, -3.10], [0, 1, .38, -4.83], [0, -1, -.38, 4.88],
    ], () => true, dark);
    geometry.userData.dorsalTriangles = stripeCount;
    geometry.userData.muzzleTriangles = geometry.userData.paintedTriangles;
  }
  // One consistent layout lets the existing adapter merge all parts to a single
  // skinned draw call, including primitives which did not need a painted region.
  const indices = geometry.attributes.skinIndex;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices.array, 4));
  if (geometry.index) {
    const expanded = geometry.toNonIndexed();
    expanded.userData = { ...geometry.userData };
    geometry.dispose();
    return expanded;
  }
  return geometry;
}

/** Match the emergency procedural art to Veter's new silhouette and markings. */
export function decorateHeroFallback(THREE, horse) {
  const { head, neck, body } = horse.userData;
  if (!head || horse.userData.heroAppearance) return;
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x241c1a).convertSRGBToLinear() });
  // The old blaze is the only pale mesh near the centre of the upper muzzle.
  for (const child of head.children) {
    if (child.isMesh && Math.abs(child.position.x) < .02 && Math.abs(child.position.y - .2) < .02
        && Math.abs(child.position.z - .4) < .02) child.material = body.material;
  }
  for (const child of neck.children) {
    if (child.isMesh && Math.abs(child.position.y - 1.62) < .02 && Math.abs(child.position.z - .72) < .02) {
      child.visible = false;
    }
  }
  const lock = new THREE.Mesh(new THREE.ConeGeometry(.12, .60, 5), dark);
  lock.name = 'VeterLeftForelock';
  lock.position.set(.13, .18, .39);
  lock.rotation.z = Math.PI + .29;
  lock.rotation.x = -.22;
  head.add(lock);
  const muzzleLine = new THREE.Mesh(new THREE.TorusGeometry(.19, .018, 4, 20), dark);
  muzzleLine.name = 'VeterMuzzleLine';
  muzzleLine.position.set(0, -.16, .88);
  muzzleLine.scale.set(1, .65, 1);
  head.add(muzzleLine);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.19, -1.70), new THREE.Vector3(0, 2.45, -.95),
    new THREE.Vector3(0, 2.515, 0), new THREE.Vector3(0, 2.48, .65), new THREE.Vector3(0, 2.30, 1.12),
  ]);
  const stripe = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .055, 4, false), dark);
  stripe.name = 'VeterDorsalStripe';
  horse.add(stripe);
  horse.userData.heroAppearance = 'left-forelock-dark-markings';
}
