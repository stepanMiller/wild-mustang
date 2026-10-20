import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Batch explicitly selected, opaque scenery after its original construction.
 * The caller keeps all collision/camera envelopes and random draws unchanged.
 * Original geometry and materials can be shared elsewhere and are never disposed.
 */
export function batchStaticScenery(THREE, scene, roots, { tileSize = 48 } = {}) {
  if (!(tileSize > 0) || !Number.isFinite(tileSize)) throw new RangeError('Scenery tile size must be positive.');
  scene.updateMatrixWorld(true);
  const sceneInverse = scene.matrixWorld.clone().invert();
  const candidates = new Set();
  for (const root of roots) root?.traverse?.(object => {
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || !object.geometry?.isBufferGeometry) return;
    if (!object.material || Array.isArray(object.material) || object.material.transparent || !object.material.visible) return;
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
    const geometry = object.geometry;
    if (Object.values(geometry.morphAttributes).some(attributes => attributes.length)) return;
    if (Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute)) return;
    const count = geometry.index?.count ?? geometry.attributes.position?.count;
    if (!count || geometry.drawRange.start !== 0 || geometry.drawRange.count < count) return;
    candidates.add(object);
  });

  const buckets = new Map(), worldPosition = new THREE.Vector3();
  let triangleCount = 0;
  for (const object of candidates) {
    object.getWorldPosition(worldPosition);
    const geometry = object.geometry;
    triangleCount += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    const attributes = Object.keys(geometry.attributes).sort().map(name => {
      const attribute = geometry.attributes[name];
      return [name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name].join(':');
    }).join('|');
    const key = [object.material.uuid, Math.floor(worldPosition.x / tileSize), Math.floor(worldPosition.z / tileSize),
      Boolean(geometry.index), attributes, object.layers.mask, object.renderOrder, object.castShadow, object.receiveShadow].join(';');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  }

  // Build every merged geometry before detaching any source object.
  const prepared = [];
  try {
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const copies = [];
      let geometry;
      try {
        for (const object of objects) {
          const transform = new THREE.Matrix4().multiplyMatrices(sceneInverse, object.matrixWorld);
          copies.push(object.geometry.clone().applyMatrix4(transform));
        }
        geometry = BufferGeometryUtils.mergeBufferGeometries(copies, false);
        if (!geometry) throw new Error('Static scenery geometry could not be combined.');
        geometry.computeBoundingSphere();
      } finally { copies.forEach(copy => copy.dispose()); }
      const first = objects[0], mesh = new THREE.Mesh(geometry, first.material);
      // Three sorts opaque objects by their origin. Keep the tile's origin at
      // its real centre while retaining the original world-space surfaces.
      const center = geometry.boundingSphere.center.clone();
      geometry.translate(-center.x, -center.y, -center.z);
      mesh.position.copy(center);
      mesh.name = 'static-scenery-tile';
      mesh.layers.mask = first.layers.mask;
      mesh.renderOrder = first.renderOrder;
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      prepared.push({ mesh, objects });
    }
  } catch (error) {
    prepared.forEach(({ mesh }) => mesh.geometry.dispose());
    throw error;
  }

  let removed = 0;
  const meshes = [];
  for (const { mesh, objects } of prepared) {
    for (const object of objects) { object.parent?.remove(object); removed++; }
    scene.add(mesh); meshes.push(mesh);
  }
  return { meshes, drawCallsBefore: candidates.size, drawCallsAfter: candidates.size - removed + meshes.length, triangleCount };
}
