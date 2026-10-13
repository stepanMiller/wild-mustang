// Screen-clockwise angle: the follow camera sits behind its forward vector.
export function directionAngle(playerX, playerZ, targetX, targetZ, cameraYaw) {
  return cameraYaw + Math.PI - Math.atan2(targetX-playerX, targetZ-playerZ);
}
