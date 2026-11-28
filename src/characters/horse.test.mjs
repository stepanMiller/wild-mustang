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

test('neck counter-turn follows travel heading when slope quaternions fold the actor Euler yaw', async () => {
  const flat = await loadCast(), slope = await loadCast();
  const up = new THREE.Vector3(0, 1, 0), normal = new THREE.Vector3(.25, 1, -.2).normalize();
  try {
    for (const heading of [2.8, 3, 3.2, 3.4]) {
      flat.horse.rotation.y = heading;
      flat.horse.userData.travelHeading = heading;
      slope.horse.quaternion.setFromUnitVectors(up, normal).multiply(new THREE.Quaternion().setFromAxisAngle(up, heading));
      slope.horse.userData.travelHeading = heading;
      flat.cast.update(.02, { speed: 2.2, grounded: true });
      slope.cast.update(.02, { speed: 2.2, grounded: true });
      const flatNeck = flat.cast.horses[0].rig.getObjectByName('Neck3').quaternion;
      const slopeNeck = slope.cast.horses[0].rig.getObjectByName('Neck3').quaternion;
      assert.ok(1 - Math.abs(flatNeck.dot(slopeNeck)) < 1e-9, 'Slope must not reverse the character glance');
    }
  } finally {
    flat.cast.dispose(); slope.cast.dispose();
  }
});

test('foal and parent reactions stay independent while a freed foal rests upright beside grazing herd', async () => {
  const { cast, foal } = await loadCast();
  const baby = cast.horses.find(entry => entry.actor === foal);
  const parent = cast.horses.find(entry => entry.actor.userData.familyRole === 'parent');
  const others = cast.horses.filter(entry => entry.actor.userData.familyRole === 'member');
  try {
    cast.update(.02, { speed: 0, grounded: true, phase: 'quests', foalFreed: true,
      gesture: 'graze', foalGesture: 'sniff', parentGesture: 'sniff', herdGesture: 'graze' });
    assert.equal(cast.horses[0].state, 'Eating');
    assert.equal(baby.state, 'Idle_Headlow');
    assert.equal(parent.state, 'Idle_Headlow');
    assert.ok(others.length > 0);
    assert.ok(others.every(entry => entry.state === 'Eating'));
    cast.update(.02, { speed: 0, grounded: true, phase: 'quests', foalFreed: true, herdGesture: 'graze' });
    assert.equal(baby.state, 'Idle', 'A freed foal does not retain its worried head-low idle');
    assert.equal(parent.state, 'Eating');
    assert.ok(others.every(entry => entry.state === 'Eating'));
    cast.update(.02, { speed: 0, grounded: true, phase: 'quests', foalFreed: false, herdGesture: 'graze' });
    assert.equal(baby.state, 'Idle_Headlow', 'The unreleased foal retains its existing worried pose');
  } finally { cast.dispose(); }
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

test('Veter has an unspotted coat, a left forelock below the eye and surface-bound dark markings', async () => {
  const { cast } = await loadCast();
  try {
    const hero = cast.horses[0];
    const skin = hero.rig.getObjectByName('HorseSkin');
    const { position, color, skinIndex, skinWeight } = skin.geometry.attributes;
    const dark = new THREE.Color(0x171411).convertSRGBToLinear();
    const hair = new THREE.Color(0x241c1a).convertSRGBToLinear();
    const head = skin.skeleton.bones.findIndex(bone => bone.name === 'Head');
    let stripe = 0, muzzle = 0, eyeHighlights = 0, lowLeftForelock = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const r = color.getX(i), g = color.getY(i), b = color.getZ(i);
      if (r > .6 && g > .6 && b > .5) {
        eyeHighlights++;
        assert.ok(Math.abs(x) > .2 && y > 4.1 && y < 4.2 && z > 2.8 && z < 3,
          'Only the eye whites can remain pale; the facial blaze must match the coat');
      }
      if (Math.abs(r - dark.r) < 1e-6 && Math.abs(g - dark.g) < 1e-6 && Math.abs(b - dark.b) < 1e-6) {
        if (z < 1.36) {
          stripe++;
          assert.ok(Math.abs(x) < .14 && y > 2.25 && z >= -1.751, 'Stripe stays on the top centre of the back');
        } else {
          muzzle++;
          assert.ok(z >= 3.099 && y + .38 * z >= 4.829 && y + .38 * z <= 4.881,
            'Muzzle marking remains a narrow line around the nose');
        }
      }
      if (y < 4.1 && y > 3.9 && z > 2.93 && z < 3.35 && x > .16 && Math.abs(r - hair.r) < 1e-6) {
        lowLeftForelock++;
        assert.equal(skinIndex.getX(i), head);
        assert.ok(skinWeight.getX(i) > .65, 'The lowered lock follows the forehead with the source head weights');
      }
      const sum = skinWeight.getX(i) + skinWeight.getY(i) + skinWeight.getZ(i) + skinWeight.getW(i);
      assert.ok(Math.abs(sum - 1) < 1e-5, 'Cut marking surfaces retain normalized skin weights');
    }
    assert.ok(eyeHighlights > 0 && stripe > 30 && muzzle > 20 && lowLeftForelock > 5);
    const originalBlaze = [];
    gltf.scene.traverse(node => { if (node.material?.name === 'Veter_Blaze') originalBlaze.push(node); });
    assert.ok(originalBlaze[0].material.color.r > .8, 'Runtime changes do not alter the shared GLB materials');
    assert.ok(cast.horses[2].rig.getObjectByName('HorseSkin').geometry.index,
      'Other horses keep their source geometry, including their normal forelocks');
  } finally { cast.dispose(); }
});
