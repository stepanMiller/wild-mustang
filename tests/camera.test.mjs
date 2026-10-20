import test from 'node:test';
import assert from 'node:assert/strict';
import { followCameraPosition, constrainCameraPosition } from '../src/camera.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const flat = () => 0;

test('a fresh camera pose follows the new chapter position and heading', () => {
  const player = { x: -61, y: 17, z: -40 };
  const position = followCameraPosition(player, Math.PI, 0.22, 9.5);
  close(position.x, player.x);
  close(position.z, player.z - Math.cos(0.22) * 9.5);
  close(position.y, player.y + 4.2 + Math.sin(0.22) * 9.5);
  // Recreating the pose is independent of the previous chapter camera.
  assert.deepEqual(position, followCameraPosition(player, Math.PI, 0.22, 9.5));
});

test('an unobstructed view preserves the camera distance including gallop framing', () => {
  const look = { x: 0, y: 2.4, z: 0 };
  const position = followCameraPosition({ x: 0, y: 0, z: 0 }, 0.8, 0.22, 9.5, 12);
  assert.deepEqual(constrainCameraPosition(look, position, flat), position);
  close(Math.hypot(position.x, position.z), Math.cos(0.22) * 9.5 * 1.28);
});

test('a ridge between two safe endpoints shortens the view before terrain', () => {
  const terrain = x => 7 * Math.exp(-((x - 5) ** 2) / 0.5);
  const look = { x: 0, y: 2.4, z: 0 };
  const position = constrainCameraPosition(look, { x: 10, y: 4.2, z: 0 }, terrain);
  assert.ok(position.x > 2 && position.x < 5);
  assert.ok(position.y >= terrain(position.x, position.z) + 2);
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    assert.ok(look.y + (position.y - look.y) * t >= terrain(position.x * t, 0) + 0.7);
  }
});

test('the actual interpolated camera is raised above terrain after a descent', () => {
  const look = { x: 0, y: 12.4, z: 0 };
  const terrain = x => x > 4 ? 11 : 10;
  const position = constrainCameraPosition(look, { x: 6, y: 8, z: 0 }, terrain);
  assert.ok(position.y >= terrain(position.x, position.z) + 2);
});

test('solid obstacles stop the camera near plane before the trunk or rock', () => {
  const look = { x: 0, y: 2.4, z: 0 };
  const obstacle = { x: 5, z: 0, r: 0.05, top: 8 };
  const position = constrainCameraPosition(look, { x: 10, y: 4.2, z: 0 }, flat, [obstacle]);
  assert.ok(position.x < obstacle.x - obstacle.r - 0.7);
  assert.ok(position.x > 4);
});

test('a tree close behind the horse keeps the model in frame with a clear elevated view', () => {
  const look = { x: 0, y: 2.4, z: 0 };
  const obstacle = { x: 1.8, z: 0, r: 0.9, top: 3.5 };
  const position = constrainCameraPosition(look, { x: 9.5, y: 6.3, z: 0 }, flat, [obstacle]);
  assert.ok(position.x >= 0 && position.x < obstacle.x - obstacle.r - 0.7);
  assert.ok(position.y > 7);
  assert.ok(Math.hypot(position.x, position.y - look.y, position.z) >= 5.5 - 1e-8);
  // Every view point remains before the inflated trunk, even after elevation.
  for (let i = 1; i <= 100; i++) {
    const x = position.x * i / 100;
    assert.ok(Math.abs(x - obstacle.x) > obstacle.r + 0.7);
  }
});

test('a ridge beginning near the horse cannot push the camera inside its model', () => {
  const terrain = x => x > 0.4 ? 5 : 0;
  const look = { x: 0, y: 2.4, z: 0 };
  const position = constrainCameraPosition(look, { x: 9.5, y: 4.2, z: 0 }, terrain);
  assert.ok(position.x < 0.4);
  assert.ok(Math.hypot(position.x, position.y - look.y, position.z) >= 5.5 - 1e-8);
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    assert.ok(look.y + (position.y - look.y) * t > terrain(position.x * t, 0) + 0.7);
  }
});

test('the camera may pass above or beside an obstacle without zooming in', () => {
  const look = { x: 0, y: 2.4, z: 0 };
  const candidate = { x: 10, y: 4.2, z: 0 };
  assert.deepEqual(constrainCameraPosition(look, candidate, flat, [{ x: 5, z: 0, r: 1, top: 1 }]), candidate);
  assert.deepEqual(constrainCameraPosition(look, candidate, flat, [{ x: 5, z: 4, r: 1, top: 8 }]), candidate);
});

test('descending view detects an obstacle top after entering its horizontal radius', () => {
  const look = { x: 0, y: 10, z: 0 };
  const candidate = { x: 10, y: 2, z: 0 };
  const obstacle = { x: 7, z: 0, r: 2, top: 4 };
  const position = constrainCameraPosition(look, candidate, flat, [obstacle]);
  assert.ok(position.x > 4 && position.x < 7);
  assert.ok(position.y > obstacle.top + 0.7);
});

test('camera constraints preserve caller state and finite positions', () => {
  const look = { x: 1, y: 2.4, z: 1 }, candidate = { x: 1, y: 1, z: 1 };
  const position = constrainCameraPosition(look, candidate, flat);
  assert.deepEqual(look, { x: 1, y: 2.4, z: 1 });
  assert.deepEqual(candidate, { x: 1, y: 1, z: 1 });
  assert.deepEqual(position, { x: 1, y: 2, z: 1 });
});
