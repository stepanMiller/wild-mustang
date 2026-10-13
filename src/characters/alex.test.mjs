import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { attachAlex, ALEX_CLIP_NAMES } from './alex.js';

const THREE = createRequire(import.meta.url)('three');

function fixture() {
  const alex = new THREE.Group();
  const fallback = new THREE.Group();
  fallback.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  alex.add(fallback); alex.userData = { arms: [new THREE.Group(), new THREE.Group()], legs: [] };
  return { alex, fallback, legacy: alex.userData, animator: attachAlex({ THREE, alex }) };
}

test('Alex uses an original bounded weighted skeleton while retaining gameplay handles', () => {
  const { alex, animator, fallback, legacy } = fixture();
  assert.equal(alex.userData, legacy);
  assert.equal(fallback.visible, false);
  assert.deepEqual(animator.status.animations, ['Idle', 'Walk', 'Run', 'Wave', 'OfferApple', 'Pet']);
  const meshes = animator.root.children.filter(child => child.isSkinnedMesh);
  assert.equal(meshes.length, 3);
  const body = meshes.find(mesh => mesh.name === 'Alex_body');
  assert.equal(body.skeleton.bones.length, 18);
  assert.ok(body.geometry.boundingBox.min.y >= -.002, 'feet stay on terrain in the bind pose');
  assert.ok(body.geometry.boundingBox.max.y <= 1.97, 'child silhouette retains established scale');
  assert.ok(body.geometry.attributes.position.count < 15000, 'mesh stays within mobile budget');
  for (const mesh of meshes) {
    const weights = mesh.geometry.attributes.skinWeight;
    const indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) {
      assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < .00001);
      assert.ok(indices.getX(i) < mesh.skeleton.bones.length);
      assert.ok(indices.getY(i) < mesh.skeleton.bones.length);
    }
  }
  animator.dispose();
});

test('mixer plays real joint animation, switches gestures and never moves the gameplay parent', () => {
  const { alex, animator } = fixture();
  alex.position.set(4, 1, -3); alex.rotation.y = .6;
  const transform = alex.matrix.clone();
  const body = animator.root.children.find(mesh => mesh.name === 'Alex_body');
  const leg = body.skeleton.bones.find(item => item.name === 'AlexLeftLeg');
  for (let i = 0; i < 15; i++) animator.update(.04, { speed: 2.5 });
  assert.equal(animator.root.userData.animation, 'Walk');
  assert.ok(Math.abs(leg.quaternion.x) > .03, 'leg moves through the skeletal animation track');
  for (const name of ALEX_CLIP_NAMES) {
    const state = name === 'Idle' ? { speed: 0 } : name === 'Walk' ? { speed: 2 } : name === 'Run' ? { speed: 7 } : { speed: 0, gesture: name };
    for (let i = 0; i < 20; i++) animator.update(.03, state);
    assert.equal(animator.root.userData.animation, name);
    for (const bone of body.skeleton.bones) assert.ok(bone.quaternion.toArray().every(Number.isFinite));
  }
  assert.deepEqual(alex.position.toArray(), [4, 1, -3]);
  assert.equal(alex.rotation.y, .6);
  assert.deepEqual(alex.matrix.elements, transform.elements);
  animator.dispose();
});

test('offer follows the hand, speed can be inferred, and disposal restores the fallback', () => {
  const { alex, animator, fallback } = fixture();
  const apple = animator.root.children.find(mesh => mesh.name === 'Alex_apple');
  alex._offered = true; animator.update(.02, { phase: 'meet', speed: 0 });
  assert.equal(apple.visible, true);
  assert.equal(animator.root.userData.animation, 'OfferApple');
  for (let i = 0; i < 20; i++) animator.update(.03, { phase: 'meet', speed: 0 });
  apple.skeleton.update();
  const vertexIndex = 0;
  const input = new THREE.Vector3().fromBufferAttribute(apple.geometry.attributes.position, vertexIndex);
  const animated = apple.boneTransform(vertexIndex, input.clone());
  assert.ok(input.distanceTo(animated) > .15, 'apple is deformed by the palm bone');
  alex.position.x += .05; animator.update(.02, { phase: 'follow' });
  assert.equal(animator.root.userData.animation, 'Walk');
  assert.equal(apple.visible, false);
  animator.dispose(); animator.dispose();
  assert.equal(fallback.visible, true);
  assert.equal(animator.root.parent, null);
  animator.update(.02, { gesture: 'Wave' });
});
