import { expect } from '@playwright/test';

// Chrome's input protocol produces browser touch/pointer events, including
// simultaneous contacts. No synthetic DOM dispatch or game state mutation is
// used. Safari hardware and a child's independent navigation remain manual QA.
export class BrowserTouches {
  constructor(session) { this.session = session; this.contacts = new Map(); }
  static async create(page) { return new BrowserTouches(await page.context().newCDPSession(page)); }
  async send(type) {
    await this.session.send('Input.dispatchTouchEvent', {
      type, touchPoints: [...this.contacts].map(([id, p]) => ({ id, ...p, radiusX: 8, radiusY: 8, force: 1 })),
    });
  }
  async down(id, x, y) { this.contacts.set(id, { x, y }); await this.send('touchStart'); }
  async move(id, x, y) {
    if (!this.contacts.has(id)) throw new Error(`Touch ${id} was not started`);
    this.contacts.set(id, { x, y }); await this.send('touchMove');
  }
  async up(id) {
    if (this.contacts.size !== 1 || !this.contacts.has(id)) {
      throw new Error('CDP touchEnd ends a touch sequence; use release() for simultaneous contacts');
    }
    this.contacts.delete(id); await this.send('touchEnd');
  }
  async release() {
    if (!this.contacts.size) return;
    this.contacts.clear(); await this.send('touchCancel');
  }
}

// The localhost diagnostics are strictly observations. This helper never calls
// teleport, setInput, save, interact, cameraLook or finishCinematic.
export async function observeRoute(page) {
  return page.evaluate(() => {
    const api = window.__WILD_MUSTANG_TEST__;
    const current = api.snapshot(), target = api.target(), objects = api.objects();
    // Older QA snapshots omit partial non-foal interactions. The game's own
    // persisted checkpoint is a read-only fallback, never a injected save.
    if (current.questSteps === undefined) {
      try { current.questSteps = JSON.parse(localStorage.getItem('veter-save'))?.checkpoint?.questSteps; } catch {}
    }
    const rotation = document.querySelector('#directionArrow').style.transform;
    const screenAngle = Number(rotation.match(/rotate\(([-\d.e+]+)rad\)/)?.[1]);
    const yaw = current.camera?.yaw ?? (target
      ? screenAngle - Math.PI + Math.atan2(target[0] - current.position.x, target[1] - current.position.z)
      : null);
    return { current, target, quest: objects.quests[current.quest], objects, yaw };
  });
}

export async function touchGeometry(page) {
  const joy = await page.locator('#joyBase').boundingBox();
  return {
    x: joy.x + joy.width / 2, y: joy.y + joy.height / 2, radius: joy.width * .45,
    cameraX: page.viewportSize().width * .72, cameraY: page.viewportSize().height * .5,
  };
}

// Navigation automation may read visible obstacle geometry, but it still moves
// through every metre with the public joystick. This small grid search chooses
// local walking detours; it cannot award progress or bypass river physics.
export function visibleDetour(from, to, obstacles, terrainSafe = () => true, { clearance = 1.5, gridStep = .5 } = {}) {
  const safe = ([x, z]) => terrainSafe([x, z]) && !obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + clearance);
  const segmentSafe = (a, b) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let distance = 0; distance <= length; distance += .5) {
      const t = length ? distance / length : 0;
      if (!terrainSafe([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
    }
    return terrainSafe(b) && obstacles.every(o => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.z - a[1]) * dz) / length2)) : 0;
    const radius = o.r + clearance, initial = Math.hypot(o.x - a[0], o.z - a[1]);
    if (initial < radius && (a[0] - o.x) * dx + (a[1] - o.z) * dz >= 0) return true;
    return Math.hypot(o.x - a[0] - t * dx, o.z - a[1] - t * dz) >= radius;
    });
  };
  if (segmentSafe(from, to)) return [to];
  const bounds = [Math.floor(Math.min(from[0], to[0]) - 12), Math.ceil(Math.max(from[0], to[0]) + 12),
    Math.floor(Math.min(from[1], to[1]) - 12), Math.ceil(Math.max(from[1], to[1]) + 12)];
  const key = p => `${p[0]},${p[1]}`;
  const first = from.map(value => Math.round(value / gridStep) * gridStep);
  const open = [{ p: first, g: 0, f: Math.hypot(first[0] - to[0], first[1] - to[1]) }];
  const costs = new Map([[key(first), 0]]), parents = new Map();
  let end;
  while (open.length) {
    open.sort((a, b) => b.f - a.f);
    const node = open.pop(), d = Math.hypot(node.p[0] - to[0], node.p[1] - to[1]);
    if (d <= 1.5 && safe(node.p)) { end = node.p; break; }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const next = [node.p[0] + dx * gridStep, node.p[1] + dz * gridStep];
      if (next[0] < bounds[0] || next[0] > bounds[1] || next[1] < bounds[2] || next[1] > bounds[3] || !safe(next) || !segmentSafe(node.p, next)) continue;
      const g = node.g + Math.hypot(dx, dz) * gridStep, id = key(next);
      if (g >= (costs.get(id) ?? Infinity)) continue;
      costs.set(id, g); parents.set(id, node.p);
      open.push({ p: next, g, f: g + Math.hypot(next[0] - to[0], next[1] - to[1]) });
    }
  }
  if (!end) throw new Error(`No walking detour around observed obstacles: ${from} -> ${to}`);
  const path = [end];
  while (parents.has(key(path[0]))) path.unshift(parents.get(key(path[0])));
  const simplified = [];
  let anchor = from;
  for (let i = 1; i < path.length;) {
    let next = i;
    for (let j = i + 1; j < path.length && segmentSafe(anchor, path[j]); j++) next = j;
    if (!segmentSafe(anchor, path[next])) throw new Error(`Unsafe walking detour edge: ${anchor} -> ${path[next]}`);
    simplified.push(path[next]); anchor = path[next]; i = next + 1;
  }
  if (safe(to) && segmentSafe(anchor, to)) simplified.push(to);
  if (key(simplified.at(-1) || end) !== key(to)) {
    console.log(`Trail waypoint ${to} is near a visible collider; approach ${simplified.at(-1) || end} with normal touch movement`);
  }
  return simplified.length ? simplified : [end];
}

export async function followVisibleTrail(page, touches, point, options = {}) {
  const { current, objects } = await observeRoute(page);
  const from = [current.position.x, current.position.z];
  const detour = objects.obstacles ? visibleDetour(from, point, objects.obstacles, touches.terrainSafe) : [point];
  if (detour.length > 1) console.log(`Visible walking detour ${from} -> ${point}: ${JSON.stringify(detour)}`);
  for (let i = 0; i < detour.length; i++) {
    await walkTrailPoint(page, touches, detour[i], { ...options, tolerance: .25 });
  }
}

export async function walkTrailPoint(page, touches, point, { tolerance = 2, timeout = 240_000, jumpOnBlock = false } = {}) {
  const geometry = await touchGeometry(page), start = await observeRoute(page);
  const distance = current => Math.hypot(point[0] - current.position.x, point[1] - current.position.z);
  if (distance(start.current) <= tolerance) return;
  await touches.down(1, geometry.x, geometry.y);
  let best = distance(start.current), lastProgress = Date.now(), samples = [];
  let jumpAttempt = null;
  const began = Date.now();
  let nextReport = began + 15_000;
  try {
    while (Date.now() - began < timeout) {
      const { current, objects, yaw } = await observeRoute(page);
      const d = distance(current);
      if (d <= tolerance || ['cine', 'done'].includes(current.phase)) return;
      if (jumpAttempt) jumpAttempt.peakRise = Math.max(jumpAttempt.peakRise, current.position.y - jumpAttempt.startY);
      if (Date.now() >= nextReport) {
        console.log(`Trail walking to ${point}: distance=${d.toFixed(1)} position=${current.position.x.toFixed(1)},${current.position.z.toFixed(1)} speed=${current.speed.toFixed(1)}`);
        nextReport = Date.now() + 15_000;
      }
      if (d < best - .2) { best = d; lastProgress = Date.now(); }
      samples.push({ x: current.position.x, z: current.position.z, speed: current.speed, d });
      if (samples.length > 10) samples.shift();
      if (Date.now() - lastProgress > 35_000) {
        throw new Error(`Natural trail movement stalled towards ${point}: ${JSON.stringify({ samples, jumpAttempt })}`);
      }
      if (jumpOnBlock && !jumpAttempt && Date.now() - lastProgress > 5_000 && current.grounded && current.speed < .5) {
        const jump = await page.locator('#btnJump').boundingBox();
        jumpAttempt = { startY: current.position.y, peakRise: 0, speed: current.speed, trust: current.trust, position: current.position };
        await touches.down(3, jump.x + jump.width / 2, jump.y + jump.height / 2);
        // CDP ends the whole sequence on touchEnd. Keep this one-shot jump
        // contact held alongside the joystick until the segment finishes.
        console.log(`Blocked trail recovery: real jump-button at ${JSON.stringify(jumpAttempt)}`);
      }
      expect(current.paused, 'Route unexpectedly paused').toBe(false);
      expect(Number.isFinite(yaw), 'Camera yaw observable from public guidance').toBe(true);
      const heading = Math.atan2(point[0] - current.position.x, point[1] - current.position.z);
      const relative = heading - yaw - Math.PI;
      // Walk gently into interactions; trot on the authored trail. Turning and
      // all acceleration/obstacle/water behavior remain the real game's physics.
      const turning = current.heading === undefined ? 0 : Math.abs(Math.atan2(Math.sin(heading - current.heading), Math.cos(heading - current.heading)));
      const nearObstacle = objects.obstacles?.some(o => Math.hypot(current.position.x - o.x, current.position.z - o.z) - o.r < 3);
      const deflection = turning > .45 ? .15 : d < 5 || nearObstacle ? .28 : .80;
      await touches.move(1,
        geometry.x - Math.sin(relative) * geometry.radius * deflection,
        geometry.y - Math.cos(relative) * geometry.radius * deflection);
      await page.waitForTimeout(250);
    }
    throw new Error(`Timed out walking to ${point}; last observation: ${JSON.stringify(await observeRoute(page))}`);
  } finally {
    if (touches.contacts.size === 1) await touches.up(1);
    else await touches.release();
  }
}

export async function touchAction(page, label) {
  const button = page.locator('#btnAct');
  await expect(button).toHaveClass(/on/, { timeout: 45_000 });
  if (label) await expect(button).toHaveText(label);
  await expect(button).toBeEnabled({ timeout: 45_000 });
  await button.tap();
}
