/** Versioned, renderer-independent checkpoint for the optional herd adventure. */
export const RESCUE_LAYOUT = Object.freeze({
  spawn: [56, 36], watch: [61, 32], gate: [61, 15], refuge: [85, 68],
  captain: [51, 14],
  wild: [[72, 32], [80, 35], [85, 27]],
  fleeing: [[81, 40], [88, 42], [91, 34]],
  guards: [[58, 22], [64, 22]],
  stalls: [[57, 9], [61, 8], [65, 10]],
  escape: [[61, 21], [70, 30], [78, 48], [85, 68]],
  route: [[56, 36], [61, 20], [61, 15], [61, 21], [70, 30], [78, 48], [85, 68]],
});

const STAGES = new Set(['watch', 'roundup', 'captive', 'escape', 'complete']);
const HORSE_STATES = new Set(['grazing', 'fleeing', 'caught', 'corral', 'following', 'safe']);
const GUARD_MODES = new Set(['waiting', 'approach', 'swing', 'throw', 'escort', 'return']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const inWorld = value => finite(value) && Math.abs(value) <= 105;
const index = (value, max, min = 0) => Number.isInteger(value) && value >= min && value <= max;
const time = value => finite(value) && value >= 0 && value <= 1e8;
const position = raw => raw && inWorld(raw.x) && inWorld(raw.z) && finite(raw.heading);

export function createRescueSave() {
  return {
    version: 1, stage: 'watch', elapsed: 0, stageTime: 0, gateOpen: true,
    horses: RESCUE_LAYOUT.wild.map(([x, z], id) => ({
      id, state: 'grazing', x, z, heading: -.45 + id * .55, guard: -1, routeIndex: 0,
    })),
    guards: RESCUE_LAYOUT.guards.map(([x, z], id) => ({
      id, x, z, heading: .25, mode: 'waiting', target: -1, clock: 0, routeIndex: 0,
    })),
  };
}

export function validateRescueSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      (raw.version != null && raw.version !== 1) || !STAGES.has(raw.stage) ||
      !time(raw.elapsed) || !time(raw.stageTime) || typeof raw.gateOpen !== 'boolean' ||
      !Array.isArray(raw.horses) || raw.horses.length !== 3 ||
      !Array.isArray(raw.guards) || raw.guards.length !== 2) return null;
  const horses = [], guards = [];
  for (let i = 0; i < 3; i++) {
    const h = raw.horses[i];
    if (!position(h) || h.id !== i || !HORSE_STATES.has(h.state) ||
        !index(h.guard, 1, -1) || !index(h.routeIndex, ['following', 'safe'].includes(h.state) ? 1 : 0)) return null;
    horses.push({ id: i, state: h.state, x: h.x, z: h.z, heading: h.heading,
      guard: h.guard, routeIndex: h.routeIndex });
  }
  for (let i = 0; i < 2; i++) {
    const g = raw.guards[i];
    if (!position(g) || (g.id != null && g.id !== i) || !GUARD_MODES.has(g.mode) ||
        !index(g.target, 2, -1) || !index(g.routeIndex, g.mode === 'escort' ? 3 : g.mode === 'return' ? 2 : 0) || !time(g.clock)) return null;
    if (['approach', 'swing', 'throw', 'escort'].includes(g.mode) && g.target < 0) return null;
    if (['waiting', 'return'].includes(g.mode) && g.target !== -1) return null;
    guards.push({ id: i, x: g.x, z: g.z, heading: g.heading,
      mode: g.mode, target: g.target, clock: g.clock, routeIndex: g.routeIndex });
  }
  for (const h of horses) {
    if (h.state === 'caught' && (h.guard < 0 || guards[h.guard].mode !== 'escort' ||
        guards[h.guard].target !== h.id)) return null;
    if (['corral', 'following', 'safe'].includes(h.state) && h.guard !== -1) return null;
    if (h.guard >= 0 && guards[h.guard].target !== h.id) return null;
    if (h.state === 'safe' && h.routeIndex !== 1) return null;
  }
  const assigned = new Set();
  for (const g of guards) {
    if (g.target < 0) continue;
    if (assigned.has(g.target)) return null;
    assigned.add(g.target);
    const h = horses[g.target];
    if (h.guard !== g.id) return null;
    if (g.mode === 'escort' && h.state !== 'caught') return null;
    if (g.mode === 'approach' && !['grazing', 'fleeing'].includes(h.state)) return null;
    if (['swing', 'throw'].includes(g.mode) && h.state !== 'fleeing') return null;
  }
  if (raw.stage !== 'roundup' && guards.some(g => g.mode !== 'waiting')) return null;
  if (raw.stage === 'roundup' && (!raw.gateOpen || horses.some(h => !['grazing', 'fleeing', 'caught', 'corral'].includes(h.state)))) return null;
  if (raw.stage === 'captive' && (raw.gateOpen || horses.some(h => h.state !== 'corral'))) return null;
  if (raw.stage === 'complete' && (!raw.gateOpen || horses.some(h => h.state !== 'safe'))) return null;
  if (raw.stage === 'escape' && (!raw.gateOpen || horses.some(h => !['following', 'safe'].includes(h.state)))) return null;
  if (raw.stage === 'watch' && (!raw.gateOpen || horses.some(h => h.state !== 'grazing'))) return null;
  if (raw.player != null && !position(raw.player)) return null;
  const result = { version: 1, stage: raw.stage, elapsed: raw.elapsed,
    stageTime: raw.stageTime, gateOpen: raw.gateOpen, horses, guards };
  if (raw.player) result.player = { x: raw.player.x, z: raw.player.z, heading: raw.player.heading };
  if (time(raw.playTime)) result.playTime = raw.playTime;
  return result;
}
