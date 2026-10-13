import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachCharacters } from './characters.js';

const buffer = await readFile(new URL('../../public/assets/characters/horse.glb', import.meta.url));
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, '', resolve, reject));

function actor(scale = 1) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  root.userData.existingQuestHandle = { preserved: true };
  return root;
}

async function loadCast(input = {}, reject = false) {
  const originalXHR = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class {
    constructor() { this.listeners = {}; this.status = reject ? 404 : 200; this.response = arrayBuffer.slice(0); }
    open() {}
    setRequestHeader() {}
    overrideMimeType() {}
    addEventListener(type, handler) { this.listeners[type] = handler; }
    send() { queueMicrotask(() => this.listeners.load.call(this, { type: 'load', target: this })); }
  };
  const horse = actor(), foal = actor(.52), herd = new THREE.Group(), alex = actor();
  for (let i = 0; i < 4; i++) herd.add(actor(.9));
  const cast = attachCharacters({ THREE, horse, foal, herd, alex, assetUrl: 'https://wild-mustang.test/horse.glb', ...input });
  try { await cast.ready; }
  finally { globalThis.XMLHttpRequest = originalXHR; }
  return { cast, horse, foal, herd, alex };
}

test('local horse is a genuine 50-joint skinned GLB with playable peaceful clips', () => {
  assert.ok(buffer.length < 800_000, `Expected compact GLB, got ${buffer.length}`);
  const meshes = [];
  gltf.scene.traverse((node) => { if (node.isSkinnedMesh) meshes.push(node); });
  assert.equal(meshes.length, 9);
  assert.equal(meshes[0].skeleton.bones.length, 50);
  const names = gltf.animations.map((clip) => clip.name);
  for (const name of ['Idle', 'Walk', 'Trot', 'Gallop', 'Gallop_Jump', 'Jump_toIdle', 'Eating']) assert.ok(names.includes(name));
  assert.equal(names.some((name) => /attack|death|hitreact/i.test(name)), false);
  for (const clip of gltf.animations) {
    assert.ok(clip.duration > 0);
    assert.ok(clip.tracks.length > 50);
    for (const track of clip.tracks) {
      assert.ok([...track.values, ...track.times].every(Number.isFinite), `Invalid ${clip.name}/${track.name}`);
    }
  }
});

test('cast uses independent rigs and one skinned draw call per horse, retains quest handles', async () => {
  const { cast, horse, foal, alex } = await loadCast();
  assert.deepEqual(cast.status, { horse: 'rigged', foal: 'rigged', herd: 'rigged', alex: 'rigged', error: null });
  assert.equal(cast.horses.length, 6);
  assert.ok(horse.userData.existingQuestHandle.preserved);
  assert.equal(horse.children[0].visible, false);
  assert.equal(alex.children[0].visible, false);
  const heroSkin = cast.horses[0].rig.getObjectByName('HorseSkin');
  const foalSkin = cast.horses[1].rig.getObjectByName('HorseSkin');
  assert.notEqual(heroSkin.skeleton, foalSkin.skeleton);
  assert.notEqual(heroSkin.skeleton.bones[0], foalSkin.skeleton.bones[0]);
  let count = 0;
  cast.horses[0].rig.traverse((node) => { if (node.isSkinnedMesh) count++; });
  assert.equal(count, 1);
  const foalHead = cast.horses[1].rig.getObjectByName('Head');
  const headScale = foalHead.scale.x;
  cast.update(.016, { speed: 2, grounded: true });
  assert.equal(foalHead.scale.x, headScale);
  assert.ok(foalHead.scale.x > 1.15);
  assert.equal(foal.scale.x, .52);
  cast.dispose();
  assert.equal(horse.children.length, 1);
  assert.equal(horse.children[0].visible, true);
  assert.equal(alex.children[0].visible, true);
});

test('speed and airborne state drive distinct clips; controls own jump height', async () => {
  const { cast } = await loadCast();
  const hero = cast.horses[0];
  for (const [speed, state] of [[0, 'Idle'], [2.2, 'Walk'], [5.4, 'Trot'], [10, 'Gallop']]) {
    cast.update(.02, { speed, grounded: true });
    assert.equal(hero.state, state);
  }
  cast.update(.02, { speed: 10, grounded: false });
  assert.equal(hero.state, 'Gallop_Jump');
  const root = hero.rig.getObjectByName('Body');
  for (let i = 0; i < 30; i++) {
    cast.update(.02, { speed: 10, grounded: false });
    assert.ok(root.position.y < 1.1, 'Authored jump must not double physical height');
  }
  cast.update(.02, { speed: 0, grounded: true });
  for (let i = 0; i < 30; i++) cast.update(.02, { speed: 0, grounded: true });
  assert.equal(hero.state, 'Idle');
  cast.dispose();
});

test('missing GLB resolves a fallback state without hiding the playable horses', async () => {
  const { cast, horse, foal } = await loadCast({}, true);
  assert.equal(cast.status.horse, 'fallback');
  assert.equal(cast.status.foal, 'fallback');
  assert.equal(horse.children[0].visible, true);
  assert.equal(foal.children[0].visible, true);
  assert.equal(cast.horses.length, 0);
  assert.ok(cast.status.error);
  cast.update(.02, { speed: 4 });
  cast.dispose();
});
