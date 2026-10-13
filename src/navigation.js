// Screen-clockwise angle: the follow camera sits behind its forward vector.
export function directionAngle(playerX, playerZ, targetX, targetZ, cameraYaw) {
  return cameraYaw + Math.PI - Math.atan2(targetX-playerX, targetZ-playerZ);
}

// Returning to a route must avoid both submerged sections and world obstacles.
// Include the exact nearest projection and nearby samples, rather than sending
// a player back to the checkpoint just saved by opening the pause menu.
export function nearestSafeTrailPoint(route, x, z, isSafe = () => true) {
  let best = null, distance = Infinity;
  const consider = (px, pz) => {
    const d = Math.hypot(px-x, pz-z);
    if (d < distance && isSafe(px, pz)) { best = [px, pz]; distance = d; }
  };
  for (let i = 1; i < route.length; i++) {
    const a = route[i-1], b = route[i];
    const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx, dz);
    if (!length) { consider(...a); continue; }
    const t = Math.max(0, Math.min(1, ((x-a[0])*dx+(z-a[1])*dz)/(length*length)));
    consider(a[0]+t*dx, a[1]+t*dz);
    const steps = Math.ceil(length/2);
    for (let j = 0; j <= steps; j++) consider(a[0]+dx*j/steps, a[1]+dz*j/steps);
  }
  if (route.length === 1) consider(...route[0]);
  return best;
}
