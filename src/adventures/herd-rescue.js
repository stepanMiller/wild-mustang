import { attachCharacters } from '../characters/characters.js';
import { createRescueArt } from './rescue-art.js';
import { createRescueSave, validateRescueSave, RESCUE_LAYOUT } from './rescue-state.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - (Array.isArray(b) ? b[0] : b.x), a.z - (Array.isArray(b) ? b[1] : b.z));
const copy = value => JSON.parse(JSON.stringify(value));

/** Small, deterministic story system. The caller owns input, UI and persistence. */
export function createHerdRescue({ THREE, scene, hAt, normalAt, makeHorse, onEvent = () => {}, loadModels = true }) {
  const group = new THREE.Group(); group.name = 'HerdRescueAdventure'; group.visible = false; scene.add(group);
  const art = createRescueArt(THREE, hAt), camp = art.camp(), meadow = art.refuge();
  group.add(camp.group, meadow);
  const captain = art.person(true, false);
  captain.group.position.set(RESCUE_LAYOUT.captain[0], hAt(...RESCUE_LAYOUT.captain) + 1.04, RESCUE_LAYOUT.captain[1]);
  captain.group.rotation.y = .9; group.add(captain.group);
  const horses = RESCUE_LAYOUT.wild.map((_, i) => {
    const actor = makeHorse(.86 + i * .025); actor.name = `RescueWildHorse${i}`; group.add(actor); return actor;
  });
  const mounted = RESCUE_LAYOUT.guards.map((_, i) => {
    const actor = makeHorse(.88); actor.name = `CavalryMount${i}`;
    const rider = art.person(false, true), saddle = art.saddle(), rope = art.rope();
    saddle.scale.setScalar(.88); group.add(actor, rider.group, saddle, rope.group);
    return { actor, rider, saddle, rope, speed: 0 };
  });
  const actors = [...horses, ...mounted.map(item => item.actor)];
  const shadowPositions = [], shadowStrength = [], shadowIndices = [], shadowSides = 20;
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < shadowSides; i++) {
    const angle = i / shadowSides * Math.PI * 2, radius = [0, .65, 1][ring];
    shadowPositions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    shadowStrength.push([1, .72, 0][ring]);
    if (ring < 2) {
      const a = ring * shadowSides + i, b = ring * shadowSides + (i + 1) % shadowSides;
      shadowIndices.push(a, b, a + shadowSides, b, b + shadowSides, a + shadowSides);
    }
  }
  const shadowGeo = new THREE.BufferGeometry();
  shadowGeo.setAttribute('position', new THREE.Float32BufferAttribute(shadowPositions, 3));
  shadowGeo.setAttribute('shade', new THREE.Float32BufferAttribute(shadowStrength, 1)); shadowGeo.setIndex(shadowIndices);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x243329, side: THREE.DoubleSide, transparent: true, opacity: .22, depthWrite: false });
  shadowMat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float shade; varying float vShade;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvShade=shade;');
    shader.fragmentShader = 'varying float vShade;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vShade;');
  };
  const shadows = actors.map(actor => {
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.scale.set(1.1, 1, 2.0);
    shadow.name = 'RescueContactShadow'; group.add(shadow); return { actor, shadow };
  });
  const captainShadow = new THREE.Mesh(shadowGeo, shadowMat); captainShadow.scale.set(.6, 1, .5);
  group.add(captainShadow); shadows.push({ actor: captain.group, shadow: captainShadow });
  const up = new THREE.Vector3(0, 1, 0), slope = new THREE.Quaternion(), yaw = new THREE.Quaternion();
  const hand = new THREE.Vector3(), end = new THREE.Vector3();
  let state = createRescueSave(), active = false, cast = null, ready = Promise.resolve(), lastPlayer = { x: 56, z: 36 };
  const ropes = [{ visible: false }, { visible: false }];
  const obstacles = camp.obstacles;

  function emit(type, detail = {}) { onEvent({ type, stage: state.stage, ...detail }); }
  function progress(detail = {}) { emit('progress', detail); }
  function dialog(who, text) { emit('dialog', { who, text }); }
  function stage(next) { state.stage = next; state.stageTime = 0; progress(); }
  function changeGuard(g, mode) { g.mode = mode; g.clock = 0; g.routeIndex = 0; }
  function move(actor, goal, speed, dt) {
    const dx = goal[0] - actor.x, dz = goal[1] - actor.z, length = Math.hypot(dx, dz);
    if (length > .025) {
      const amount = Math.min(length, speed * dt);
      actor.x += dx / length * amount; actor.z += dz / length * amount;
      const desired = Math.atan2(dx, dz), angle = Math.atan2(Math.sin(desired - actor.heading), Math.cos(desired - actor.heading));
      actor.heading += angle * Math.min(1, dt * 9);
    }
    return length < .38;
  }
  function applyActor(actor, data) {
    actor.position.set(data.x, hAt(data.x, data.z), data.z);
    yaw.setFromAxisAngle(up, data.heading);
    if (normalAt) { slope.setFromUnitVectors(up, normalAt(data.x, data.z)); actor.quaternion.copy(slope).multiply(yaw); }
    else actor.quaternion.copy(yaw);
    actor.userData.travelHeading = data.heading;
  }
  function escortRoute(horse, guard) {
    const lane = guard.id ? 1.5 : -1.5, stall = RESCUE_LAYOUT.stalls[horse.id];
    return [[73 + lane, 24], [61 + lane, 20], [61 + lane, 12], [stall[0], stall[1] - 4.2]];
  }
  function returnRoute(guard) {
    const lane = guard.id ? 1.5 : -1.5;
    return [[61 + lane, 12], [61 + lane, 22], [guard.id ? 67 : 55, 24]];
  }
  function updateRoundup(dt) {
    for (const g of state.guards) {
      g.clock += dt;
      if (g.mode === 'waiting') {
        const target = state.horses.find(h => ['grazing', 'fleeing'].includes(h.state) && h.guard === -1);
        if (target) { g.target = target.id; target.guard = g.id; changeGuard(g, 'approach'); progress(); }
      }
      const h = state.horses[g.target];
      if (g.mode === 'approach' && h) {
        if (distance(g, h) < 12) h.state = 'fleeing';
        if (h.state === 'fleeing') move(h, RESCUE_LAYOUT.fleeing[h.id], 1.85, dt);
        move(g, [h.x, h.z], 5.1, dt);
        if (distance(g, h) < 5.2) { changeGuard(g, 'swing'); progress(); }
      } else if (g.mode === 'swing' && h) {
        move(h, RESCUE_LAYOUT.fleeing[h.id], .65, dt);
        g.heading = Math.atan2(h.x - g.x, h.z - g.z);
        if (g.clock >= 1.35) { changeGuard(g, 'throw'); progress(); }
      } else if (g.mode === 'throw' && h) {
        move(h, RESCUE_LAYOUT.fleeing[h.id], .40, dt);
        if (g.clock >= .85) {
          if (distance(g, h) > 8.5) changeGuard(g, 'approach');
          else { h.state = 'caught'; changeGuard(g, 'escort'); progress({ horse: h.id, captured: true }); }
        }
      } else if (g.mode === 'escort' && h) {
        const route = escortRoute(h, g), goal = route[Math.min(g.routeIndex, route.length - 1)];
        const stall = RESCUE_LAYOUT.stalls[h.id];
        if (distance(g, h) < 7.5 && move(g, goal, 3.6, dt) && g.routeIndex < route.length - 1) g.routeIndex++;
        const follow = g.routeIndex === route.length - 1 && distance(g, goal) < 4.5 ? stall
          : [g.x - Math.sin(g.heading) * 4.2, g.z - Math.cos(g.heading) * 4.2];
        move(h, follow, distance(h, follow) > 6 ? 5.0 : 3.8, dt);
        if (g.routeIndex === route.length - 1 && distance(g, goal) < .7 && distance(h, stall) < .9) {
          h.state = 'corral'; h.guard = -1; h.routeIndex = 0;
          changeGuard(g, 'return'); g.target = -1;
          progress({ horse: h.id, penned: true });
        }
      } else if (g.mode === 'return') {
        const route = returnRoute(g), goal = route[Math.min(g.routeIndex, route.length - 1)];
        if (move(g, goal, 4.2, dt)) {
          if (g.routeIndex < route.length - 1) g.routeIndex++;
          else { changeGuard(g, 'waiting'); g.target = -1; progress(); }
        }
      }
    }
    if (state.horses.every(h => h.state === 'corral') && state.guards.every(g => g.mode === 'waiting')) {
      state.gateOpen = false; stage('captive');
      dialog('Ветер', 'Табун в загоне. Я найду засов и открою ворота.');
    }
  }

  const routeLengths = [], route = RESCUE_LAYOUT.escape;
  let routeLength = 0;
  for (let i = 1; i < route.length; i++) {
    const length = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    routeLengths.push(length); routeLength += length;
  }
  function routeProgress(player) {
    let nearest = Infinity, result = 0, walked = 0;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((player.x - a[0]) * dx + (player.z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      const dist = Math.hypot(player.x - a[0] - t * dx, player.z - a[1] - t * dz);
      if (dist < nearest) { nearest = dist; result = walked + t * routeLengths[i - 1]; }
      walked += routeLengths[i - 1];
    }
    return result;
  }
  function routePoint(progress, side) {
    let remaining = clamp(progress, 0, routeLength);
    for (let i = 1; i < route.length; i++) {
      const length = routeLengths[i - 1];
      if (remaining <= length || i === route.length - 1) {
        const a = route[i - 1], b = route[i], t = remaining / length;
        return [a[0] + (b[0] - a[0]) * t + (b[1] - a[1]) / length * side,
          a[1] + (b[1] - a[1]) * t - (b[0] - a[0]) / length * side];
      }
      remaining -= length;
    }
    return RESCUE_LAYOUT.refuge;
  }
  function updateEscape(dt, player) {
    const lead = routeProgress(player);
    for (const h of state.horses) {
      if (h.state === 'safe') continue;
      if (h.routeIndex === 0) {
        // Every horse exits through the open gateway before joining the trail.
        const lane = (h.id - 1) * 1.15;
        if (move(h, [61 + lane, 20.5], 3.8, dt)) h.routeIndex = 1;
      } else {
        const ownProgress = routeProgress(h), goalProgress = Math.max(0, lead - 3 - h.id * 2);
        // A succession of close trail points prevents corner-cutting and keeps
        // a distant player from pulling a horse through the corral fence.
        const chase = clamp(goalProgress, ownProgress - 5, ownProgress + 6);
        const goal = routePoint(chase, (h.id - 1) * .85);
        move(h, goal, distance(h, goal) > 5 ? 5.1 : 3.6, dt);
        if (distance(h, RESCUE_LAYOUT.refuge) < 10 && distance(player, RESCUE_LAYOUT.refuge) < 9) {
          h.state = 'safe'; progress({ horse: h.id, safe: true });
        }
      }
    }
    if (state.horses.every(h => h.state === 'safe')) {
      stage('complete'); dialog('Ветер', 'Вы свободны! Теперь эта поляна станет вашим домом.'); emit('complete');
    }
  }

  function drawRopes() {
    group.updateMatrixWorld(true);
    mounted.forEach((unit, i) => {
      const guard = state.guards[i], horse = state.horses[guard.target];
      unit.rope.group.visible = false; ropes[i] = { visible: false };
      if (!horse || !['swing', 'throw', 'escort'].includes(guard.mode)) return;
      unit.rider.hand.getWorldPosition(hand);
      const catchPoint = new THREE.Vector3(horse.x + Math.sin(horse.heading) * 1.25,
        hAt(horse.x, horse.z) + 2.35, horse.z + Math.cos(horse.heading) * 1.25);
      const angle = guard.clock * 8;
      end.set(hand.x + Math.cos(angle) * .75, hand.y + .7, hand.z + Math.sin(angle) * .75);
      if (guard.mode === 'throw') {
        const amount = clamp(guard.clock / .85, 0, 1);
        end.copy(hand).lerp(catchPoint, amount); end.y += Math.sin(amount * Math.PI) * 2.1;
      } else if (guard.mode === 'escort') end.copy(catchPoint);
      unit.rope.draw(hand, end, guard.mode === 'escort' ? .45 : .14, guard.mode !== 'escort', guard.mode === 'escort' ? .73 : 1, horse.heading);
      ropes[i] = { visible: true, from: { x: hand.x, y: hand.y, z: hand.z },
        to: { x: end.x, y: end.y, z: end.z }, horse: horse.id, mode: guard.mode };
    });
  }
  function updateVisuals(dt) {
    state.horses.forEach((h, i) => applyActor(horses[i], h));
    state.guards.forEach((g, i) => {
      const unit = mounted[i], old = unit.actor.position;
      unit.speed = dt > 0 ? Math.hypot(old.x - g.x, old.z - g.z) / dt : 0;
      applyActor(unit.actor, g);
      unit.saddle.position.copy(unit.actor.position); unit.saddle.quaternion.copy(unit.actor.quaternion);
      unit.rider.group.position.set(g.x, hAt(g.x, g.z) + 2.34 + Math.sin(state.elapsed * 7) * Math.min(.04, unit.speed * .006), g.z);
      unit.rider.group.rotation.y = g.heading;
      unit.rider.update(state.elapsed, unit.speed, g.mode);
    });
    captain.update(state.elapsed, 0, (state.stage === 'watch' && state.stageTime > .8) || (state.stage === 'roundup' && state.stageTime < 3) ? 'command' : 'idle');
    camp.update(state.elapsed, state.gateOpen, dt || 1);
    for (const { actor, shadow } of shadows) {
      shadow.position.set(actor.position.x, hAt(actor.position.x, actor.position.z) + .06, actor.position.z);
      if (normalAt) shadow.quaternion.setFromUnitVectors(up, normalAt(actor.position.x, actor.position.z));
      else shadow.quaternion.identity();
      yaw.setFromAxisAngle(up, actor.userData.travelHeading || actor.rotation.y || 0); shadow.quaternion.multiply(yaw);
    }
    if (cast) cast.update(dt, { phase: 'quests', foalFreed: true, herdGesture: 'graze' });
    // The authored rig is preferred. Keep fallback horses animated if it cannot load.
    actors.forEach((actor, i) => {
      if (actor.userData.riggedVisual || !actor.userData.legs) return;
      const record = i < 3 ? state.horses[i] : state.guards[i - 3];
      const moving = i < 3 ? ['fleeing', 'caught', 'following'].includes(record.state) : ['approach', 'escort', 'return'].includes(record.mode);
      actor.userData.legs.forEach((leg, n) => { leg.hip.rotation.x = moving ? Math.sin(state.elapsed * 6 + n * Math.PI) * .34 : 0; });
    });
    drawRopes();
  }

  function start(saved) {
    state = validateRescueSave(saved) || createRescueSave(); active = true; group.visible = true;
    obstacles.forEach(item => { item.active = true; });
    if (loadModels && !cast) {
      cast = attachCharacters({ THREE, herd: actors }); ready = cast.ready;
    }
    updateVisuals(0);
    const point = state.player || { x: RESCUE_LAYOUT.spawn[0], z: RESCUE_LAYOUT.spawn[1], heading: .9 };
    lastPlayer = { x: point.x, z: point.z };
    return { x: point.x, z: point.z, heading: point.heading, stage: state.stage };
  }
  function stop() {
    active = false; group.visible = false; obstacles.forEach(item => { item.active = false; });
  }
  function action(player) {
    // The fence collider keeps Veter's centre five metres from the gate. Leave
    // room for the normal stopping glide so the touch action stays available.
    if (!active || state.stage !== 'captive' || distance(player, RESCUE_LAYOUT.gate) > 6.8) return null;
    return { label: 'Открыть загон', fn() {
      if (!active || state.stage !== 'captive') return;
      state.gateOpen = true;
      state.horses.forEach(h => { h.state = 'following'; h.routeIndex = 0; h.guard = -1; });
      state.guards.forEach(g => { g.target = -1; changeGuard(g, 'waiting'); });
      stage('escape'); camp.gateCollision.active = false;
      dialog('Ветер', 'Ворота открыты. За мной, к большой поляне!');
    } };
  }
  function target() {
    if (!active) return null;
    if (state.stage === 'watch' || state.stage === 'roundup') return RESCUE_LAYOUT.watch.slice();
    if (state.stage === 'captive') return RESCUE_LAYOUT.gate.slice();
    if (state.stage === 'escape') {
      const progress = routeProgress(lastPlayer);
      let walked = 0;
      for (let i = 0; i < route.length - 1; i++) {
        walked += routeLengths[i];
        if (progress < walked - 5) return route[i + 1].slice();
      }
      return RESCUE_LAYOUT.refuge.slice();
    }
    return null;
  }
  function snapshot() {
    return { ...copy(state), capturedCount: state.horses.filter(h => ['caught', 'corral', 'following', 'safe'].includes(h.state)).length,
      safeCount: state.horses.filter(h => h.state === 'safe').length, complete: state.stage === 'complete', ropes: copy(ropes) };
  }
  function tracker() {
    const captured = state.horses.filter(h => h.state === 'corral').length;
    return {
      watch: { title: 'У лагеря кавалеристов', subtitle: 'Посмотри: капитан заметил диких лошадей.' },
      roundup: { title: 'Отряд ловит табун', subtitle: `Лошадей в загоне: ${captured} из 3. Держись рядом и наблюдай за лассо.` },
      captive: { title: 'Открой загон', subtitle: 'Подойди к большим воротам и толкни засов.' },
      escape: { title: 'Выведи табун на волю', subtitle: 'Иди по светлой тропе к большой поляне. Лошади следуют за тобой.' },
      complete: { title: 'Табун снова свободен', subtitle: 'Три лошади на воле. Можно погулять рядом или повторить приключение.' },
    }[state.stage];
  }
  return {
    group, start, stop, action, target, snapshot, tracker, actors, obstacles, cameraObstacles: obstacles,
    get ready() { return ready; },
    isComplete: () => state.stage === 'complete',
    update(dt, player) {
      if (!active || !(dt > 0) || !Number.isFinite(dt)) return;
      dt = Math.min(dt, .1); lastPlayer = { x: player.x, z: player.z };
      state.elapsed += dt; state.stageTime += dt;
      if (state.stage === 'watch' && state.stageTime >= 3.5 && distance(player, RESCUE_LAYOUT.watch) < 40) {
        stage('roundup'); dialog('Капитан', 'Отряд, за мной! Отведём этих лошадей в загон.');
      }
      if (state.stage === 'roundup') updateRoundup(dt);
      else if (state.stage === 'escape') updateEscape(dt, player);
      updateVisuals(dt);
    },
    dispose() { stop(); cast?.dispose(); group.parent?.remove(group); shadowGeo.dispose(); shadowMat.dispose(); art.dispose(); },
  };
}
