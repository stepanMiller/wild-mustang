import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { attachAlex } from './alex.js';

const MODEL_URL = (import.meta.env?.BASE_URL || '/') + 'assets/characters/horse.glb';
const BASE_HEIGHT = 4.1;
const COATS = [0xa96836, 0xd0a377, 0x835338, 0xb77741, 0xc4ad88];

function visibleInScene(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function coatColor(THREE, color) {
  return new THREE.Color(color).convertSRGBToLinear();
}

function skinMaterials(THREE, root, coat, role) {
  const main = coatColor(THREE, coat);
  const parts = [];
  root.traverse((mesh) => { if (mesh.isSkinnedMesh) parts.push(mesh); });
  const geometries = parts.map((mesh) => {
    const geometry = mesh.geometry.clone();
    const name = mesh.material.name;
    const color = mesh.material.color.clone();
    if (name === 'Main') color.copy(main);
    if (name === 'Main_Light') color.copy(main).multiplyScalar(1.16);
    if (name === 'Main_Dark') color.copy(main).multiplyScalar(0.66);
    if (name === 'Hair') color.copy(coatColor(THREE, role === 'foal' ? 0x423027 : 0x241c1a));
    if (name === 'Hooves') color.copy(coatColor(THREE, 0x332b25));
    if (name === 'Eye_White') color.copy(coatColor(THREE, 0xebe3d2));
    if (name === 'Veter_Blaze') color.copy(role === 'hero' ? coatColor(THREE, 0xffefd0) : main);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  if (!parts.length) throw new Error('The character model has no skinned mesh.');
  const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
  geometries.forEach((part) => part.dispose());
  if (!geometry) throw new Error('The character mesh could not be combined.');
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true,
    roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const merged = new THREE.SkinnedMesh(geometry, material);
  merged.name = 'HorseSkin';
  merged.bind(parts[0].skeleton, parts[0].bindMatrix);
  merged.frustumCulled = false;
  const parent = parts[0].parent;
  parts.forEach((part) => part.parent.remove(part));
  parent.add(merged);
  return merged;
}

function buildHorse(THREE, actor, gltf, role, index) {
  const previous = actor.children.slice();
  const visual = new THREE.Group();
  visual.name = `rigged-${role}-${index}`;
  const rig = SkeletonUtils.clone(gltf.scene);
  rig.name = 'QuaterniusHorse';
  skinMaterials(THREE, rig, role === 'foal' ? 0xd8ac77 : role === 'herd' && index === 2 ? 0xc6b28b : COATS[index % COATS.length], role);
  if (role === 'herd' && index === 2) visual.scale.setScalar(1.08);
  const bounds = new THREE.Box3().setFromObject(rig);
  const size = bounds.getSize(new THREE.Vector3());
  const ratio = BASE_HEIGHT / size.y;
  rig.scale.setScalar(ratio);
  rig.position.y = -bounds.min.y * ratio;
  visual.add(rig);

  // A foal has a shorter neck, larger head and compact trunk, not only a smaller
  // parent group. Clip scale channels are removed below to retain this anatomy.
  if (role === 'foal') {
    rig.getObjectByName('Head')?.scale.multiplyScalar(1.17);
    const neck = rig.getObjectByName('Neck2');
    if (neck) neck.scale.y *= 0.84;
    const body = rig.getObjectByName('Torso');
    if (body) body.scale.y *= 0.93;
  }
  const mixer = new THREE.AnimationMixer(rig);
  const actions = {};
  for (const source of gltf.animations) {
    const clip = source.clone();
    if (role === 'foal') clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.scale'));
    actions[source.name] = mixer.clipAction(clip);
  }
  let current = null;
  const retiring = [];
  let state = null;
  let elapsed = index * 2.71;
  let lastGrounded = true;
  let airborneTime = 0;
  let blendBack = null;
  const lastPosition = actor.position.clone();
  const neck = rig.getObjectByName('Neck3');
  const turnQuaternion = new THREE.Quaternion();
  const turnAxis = new THREE.Vector3(0, 0, 1);
  let lastHeading = actor.userData.travelHeading ?? actor.rotation.y;
  let smoothTurn = 0;

  function play(name, fade = 0.22, once = false) {
    const next = actions[name] || actions.Idle;
    if (current === next && !once) return;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (current && current !== next) {
      current.crossFadeTo(next, fade, true);
      retiring.push({ action: current, deadline: elapsed + fade + 0.02 });
    }
    else next.fadeIn(fade);
    current = next;
    state = name;
  }

  play(role === 'herd' ? 'Eating' : 'Idle');
  mixer.update(index * 0.137);
  actor.add(visual);
  // Fallback skeleton and userData stay intact for existing quest/animation code.
  previous.forEach((child) => { child.visible = false; });
  actor.userData.riggedVisual = visual;
  actor.userData.characterKind = role;
  if (role === 'herd') actor.userData.familyRole = index === 2 ? 'parent' : 'member';

  return {
    actor, root: visual, rig, mixer, actions,
    get state() { return state; },
    update(dt, input = {}) {
      if (!(dt > 0) || !Number.isFinite(dt)) return;
      dt = Math.min(dt, 0.1);
      const distance = lastPosition.distanceTo(actor.position);
      let speed = input.speed ?? (distance < 20 ? distance / dt : 0);
      lastPosition.copy(actor.position);
      if (!visibleInScene(actor)) return;
      speed = Math.max(0, Number.isFinite(speed) ? speed : 0);
      elapsed += dt;
      const grounded = input.grounded !== false;
      if (lastGrounded && !grounded) {
        airborneTime = 0;
        const clip = speed > 3 ? 'Gallop_Jump' : 'Jump_toIdle';
        play(clip, 0.1, true);
      }
      if (!grounded) {
        airborneTime += dt;
        // Gameplay owns trajectory. Animation owns the tucked legs; slow at its
        // apex if the physical jump is longer than the authored clip.
        current.timeScale = airborneTime < 0.22 ? 1.25 : 0.45;
      } else {
        if (!lastGrounded) blendBack = elapsed + 0.18;
        const gesturing = input.gesture === 'graze' || input.gesture === 'sniff';
        let desired = speed < 0.18 ? (gesturing ? 'Eating' : 'Idle')
          : speed < 3.8 ? 'Walk' : speed < 7.8 ? 'Trot' : 'Gallop';
        if (role === 'herd' && speed < 0.18) desired = 'Eating';
        if (role === 'foal' && speed < 0.18 && input.phase === 'quests') desired = 'Idle_Headlow';
        if (speed < 0.18 && !gesturing && role === 'hero' && Math.floor(elapsed / 9) % 3 === 2) desired = 'Idle_2';
        if (!blendBack || elapsed > blendBack || lastGrounded) {
          if (state !== desired || current.loop === THREE.LoopOnce) play(desired);
          if (speed > 0.18) {
            const reference = desired === 'Gallop' ? 10 : desired === 'Trot' ? 6 : 2.6;
            current.timeScale = Math.max(0.65, Math.min(1.5, speed / reference));
          }
        }
      }
      lastGrounded = grounded;
      mixer.update(dt);
      for (let i = retiring.length - 1; i >= 0; i--) {
        if (elapsed < retiring[i].deadline) continue;
        if (retiring[i].action !== current) retiring[i].action.stop();
        retiring.splice(i, 1);
      }
      // Fine neck counter-turn adds a readable glance without turning the entire
      // visual away from the gameplay heading. Animation poses are reapplied first.
      const heading = actor.userData.travelHeading ?? actor.rotation.y;
      let deltaHeading = heading - lastHeading;
      deltaHeading = Math.atan2(Math.sin(deltaHeading), Math.cos(deltaHeading));
      lastHeading = heading;
      smoothTurn += (Math.max(-0.16, Math.min(0.16, deltaHeading / dt * 0.045)) - smoothTurn) * Math.min(1, dt * 7);
      if (neck && grounded && speed > 0.2) {
        turnQuaternion.setFromAxisAngle(turnAxis, smoothTurn);
        neck.quaternion.multiply(turnQuaternion);
      }
      // Source Idle already includes ears, breath and tail; no rigid whole-body bob.
      actor.userData.animationState = state;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(rig);
      actor.remove(visual);
      previous.forEach((child) => { child.visible = true; });
      rig.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.skeleton?.dispose?.();
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
      });
      delete actor.userData.riggedVisual;
    }
  };
}

/**
 * Add final cast visuals without changing existing quest-owned groups.
 * ready resolves to status even on load failure; fallback remains playable.
 * update should be called after movement/procedural animation and before render.
 */
export function attachCharacters({ THREE, horse, foal, herd, alex, onReady, assetUrl = MODEL_URL }) {
  const horses = [];
  const status = { horse: 'loading', foal: 'loading', herd: 'loading', alex: 'fallback', error: null };
  let human = null;
  if (alex) {
    try { human = attachAlex({ THREE, alex }); status.alex = human.status?.ready ? 'rigged' : 'fallback'; }
    catch (error) { status.alex = 'fallback'; status.error = String(error); }
  }
  let disposed = false;
  const ready = new Promise((resolve) => {
    new GLTFLoader().load(assetUrl, (gltf) => {
      if (!disposed) {
        try {
          if (horse) horses.push(buildHorse(THREE, horse, gltf, 'hero', 0));
          if (foal) horses.push(buildHorse(THREE, foal, gltf, 'foal', 1));
          const members = Array.isArray(herd) ? herd : herd?.children.slice() || [];
          members.forEach((actor, index) => horses.push(buildHorse(THREE, actor, gltf, 'herd', index + 2)));
          status.horse = horse ? 'rigged' : 'absent';
          status.foal = foal ? 'rigged' : 'absent';
          status.herd = members.length ? 'rigged' : 'absent';
        } catch (error) {
          horses.forEach((entry) => entry.dispose());
          horses.length = 0;
          status.horse = status.foal = status.herd = 'fallback';
          status.error = String(error);
        }
      }
      onReady?.(status);
      resolve(status);
    }, undefined, (error) => {
      status.horse = status.foal = status.herd = 'fallback';
      status.error = String(error?.message || 'Character asset could not be loaded.');
      onReady?.(status);
      resolve(status);
    });
  });
  return {
    ready, status, horses, alex: human,
    update(dt, input = {}) {
      horses.forEach((entry) => entry.update(dt, entry.actor === horse ? input : { phase: input.phase,
        gesture: input.herdGesture, grounded: true }));
      human?.update(dt, { phase: input.phase, gesture: input.alexGesture });
    },
    dispose() {
      disposed = true;
      horses.forEach((entry) => entry.dispose());
      human?.dispose();
    }
  };
}
