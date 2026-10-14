// Keep the near plane out of terrain and the solid obstacle envelopes used by
// movement. This radius covers the 0.5 near plane at the landscape iPad FOV.
const CAMERA_RADIUS = 0.7;
const GROUND_CLEARANCE = 2;
const TERRAIN_STEP = 0.35;
const STOP_MARGIN = 0.08;
const MIN_VISIBLE_DISTANCE = 5.5;

export function followCameraPosition(player, yaw, pitch, distance, speed = 0) {
  const targetDistance = distance * (1 + Math.min(1, Math.max(0, speed / 12)) * 0.28);
  const horizontal = Math.cos(pitch) * targetDistance;
  return {
    x: player.x + Math.sin(yaw) * horizontal,
    y: player.y + 4.2 + Math.sin(pitch) * targetDistance,
    z: player.z + Math.cos(yaw) * horizontal,
  };
}

// First intersection of the view segment with an inflated vertical cylinder.
// Solve the horizontal interval exactly so thin tree trunks cannot fall
// between terrain samples. Obstacles' top values already include world Y.
function obstacleEntry(look, delta, obstacle) {
  const x = look.x - obstacle.x, z = look.z - obstacle.z;
  const radius = obstacle.r + CAMERA_RADIUS;
  const a = delta.x * delta.x + delta.z * delta.z;
  const c = x * x + z * z - radius * radius;
  let entry = 0, exit = 1;
  if (a > 1e-10) {
    const b = 2 * (x * delta.x + z * delta.z);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 1;
    const root = Math.sqrt(discriminant);
    entry = Math.max(0, (-b - root) / (2 * a));
    exit = Math.min(1, (-b + root) / (2 * a));
    if (entry > exit) return 1;
  } else if (c > 0) return 1;

  const top = obstacle.top + CAMERA_RADIUS;
  if (look.y + delta.y * entry <= top) return entry;
  if (delta.y < 0) {
    const crossing = (top - look.y) / delta.y;
    if (crossing <= exit) return Math.max(entry, crossing);
  }
  return 1;
}

/**
 * Shorten the camera boom before the first obstruction. Use this on both the
 * desired position and the interpolated position: safe endpoints alone do not
 * make a safe interpolated camera or a clear view across a ridge.
 * The arguments are plain world-space points; none are mutated.
 */
export function constrainCameraPosition(look, candidate, terrain, obstacles = []) {
  const endpoint = { ...candidate, y: Math.max(candidate.y, terrain(candidate.x, candidate.z) + GROUND_CLEARANCE) };
  const delta = { x: endpoint.x - look.x, y: endpoint.y - look.y, z: endpoint.z - look.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 1e-8) return endpoint;

  let limit = 1;
  for (const obstacle of obstacles) limit = Math.min(limit, obstacleEntry(look, delta, obstacle));

  const blocked = t => terrain(look.x + delta.x * t, look.z + delta.z * t) + CAMERA_RADIUS > look.y + delta.y * t;
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / TERRAIN_STEP));
  let previous = 0;
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(limit, i / steps);
    if (blocked(t)) {
      // Refine the first blocked sample instead of visibly snapping a whole
      // sampling step when orbiting or moving along a slope.
      let low = previous, high = t;
      for (let j = 0; j < 8; j++) {
        const middle = (low + high) / 2;
        if (blocked(middle)) high = middle; else low = middle;
      }
      limit = high;
      break;
    }
    previous = t;
    if (t >= limit) break;
  }

  const t = limit < 1 ? Math.max(0, limit - STOP_MARGIN / length) : 1;
  const position = { x: look.x + delta.x * t, y: look.y + delta.y * t, z: look.z + delta.z * t };
  position.y = Math.max(position.y, terrain(position.x, position.z) + GROUND_CLEARANCE);
  if (limit < 1) {
    // A tree close behind the horse can leave only a few centimetres of boom.
    // Lift the already-clear endpoint to keep the whole horse in frame instead
    // of putting the lens inside its model. Preserve the view azimuth so the
    // movement joystick still agrees with the image when the view rises.
    const horizontalSquared = (position.x - look.x) ** 2 + (position.z - look.z) ** 2;
    if (horizontalSquared < MIN_VISIBLE_DISTANCE ** 2) {
      position.y = Math.max(position.y, look.y + Math.sqrt(MIN_VISIBLE_DISTANCE ** 2 - horizontalSquared));
    }
  }
  return position;
}
