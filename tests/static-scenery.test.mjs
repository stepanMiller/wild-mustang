import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticScenery } from '../src/static-scenery.js';

function surfaces(scene) {
  scene.updateMatrixWorld(true);
  const records = [];
  scene.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh) return;
    const geometry = object.geometry, attributes = geometry.attributes;
    const count = geometry.index?.count ?? attributes.position.count;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    for (let offset = 0; offset < count; offset += 3) {
      const triangle = [];
      for (let corner = 0; corner < 3; corner++) {
        const index = geometry.index ? geometry.index.getX(offset + corner) : offset + corner;
        const point = new THREE.Vector3().fromBufferAttribute(attributes.position, index).applyMatrix4(object.matrixWorld);
        const normal = new THREE.Vector3().fromBufferAttribute(attributes.normal, index).applyNormalMatrix(normalMatrix);
        const vertex = [...point.toArray(), ...normal.toArray(), attributes.uv.getX(index), attributes.uv.getY(index)];
        if (attributes.color) vertex.push(attributes.color.getX(index), attributes.color.getY(index), attributes.color.getZ(index));
        triangle.push(vertex.map(value => Math.round(value * 10000) / 10000));
      }
      records.push(JSON.stringify([object.material.uuid, triangle]));
    }
  });
  return records.sort();
}

test('nested, scaled scenery keeps the same world triangle surfaces, UVs, vertex colours and shared material', () => {
  const scene = new THREE.Scene(), root = new THREE.Group();
  root.position.set(8, 2, 6); root.rotation.set(.1, .3, -.08); scene.add(root);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i++) colors[i] = (i % 7) / 7;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const first = new THREE.Mesh(geometry, material), second = new THREE.Mesh(geometry, material);
  first.position.set(2, 1, 1); first.scale.set(.7, 1.8, 1.2); first.rotation.y = .4;
  second.position.set(5, 0, 3); second.scale.set(1.4, .9, .8); second.rotation.set(.2, -.5, .1);
  root.add(first, second);
  const before = surfaces(scene), positions = geometry.attributes.position.array.slice(), normals = geometry.attributes.normal.array.slice();
  let geometryDisposed = false, materialDisposed = false;
  geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  material.addEventListener('dispose', () => { materialDisposed = true; });
  const result = batchStaticScenery(THREE, scene, [root, first]);
  assert.equal(result.drawCallsBefore, 2, 'Overlapping root selections must not duplicate geometry');
  assert.equal(result.drawCallsAfter, 1);
  assert.equal(result.meshes[0].material, material);
  assert.deepEqual(surfaces(scene), before);
  assert.deepEqual(geometry.attributes.position.array, positions);
  assert.deepEqual(geometry.attributes.normal.array, normals);
  assert.equal(geometryDisposed, false);
  assert.equal(materialDisposed, false);
});

test('tiles retain local culling and reduce a dense static group without adding triangles', () => {
  const scene = new THREE.Scene(), material = new THREE.MeshLambertMaterial(), geometry = new THREE.SphereGeometry(1, 8, 6);
  const roots = [];
  for (const base of [0, 48]) for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(base + 2 + i % 4 * 3, 0, 2 + Math.floor(i / 4) * 3);
    roots.push(mesh); scene.add(mesh);
  }
  const before = surfaces(scene), triangles = 32 * geometry.index.count / 3;
  const result = batchStaticScenery(THREE, scene, roots);
  assert.equal(result.drawCallsBefore, 32);
  assert.equal(result.drawCallsAfter, 2, 'Separate 48 m tiles remain separate batches');
  assert.equal(result.triangleCount, triangles);
  assert.deepEqual(surfaces(scene), before);
  const frustum = new THREE.Frustum(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 24),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 24), new THREE.Plane(new THREE.Vector3(0, 1, 0), 24),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 24), new THREE.Plane(new THREE.Vector3(0, 0, 1), 24),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 24));
  scene.updateMatrixWorld(true);
  assert.equal(result.meshes.filter(mesh => frustum.intersectsObject(mesh)).length, 1);
});

test('hidden, transparent and instanced scenery remains under its original owner', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), opaque = new THREE.MeshLambertMaterial();
  const hiddenRoot = new THREE.Group(); hiddenRoot.visible = false;
  const hidden = new THREE.Mesh(geometry, opaque); hiddenRoot.add(hidden); scene.add(hiddenRoot);
  const transparent = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ transparent: true, opacity: .4 }));
  const instanced = new THREE.InstancedMesh(geometry, opaque, 2);
  scene.add(transparent, instanced);
  const result = batchStaticScenery(THREE, scene, [hiddenRoot, transparent, instanced]);
  assert.equal(result.drawCallsBefore, 0);
  assert.equal(result.meshes.length, 0);
  assert.equal(hidden.parent, hiddenRoot);
  assert.equal(transparent.parent, scene);
  assert.equal(instanced.parent, scene);
});
