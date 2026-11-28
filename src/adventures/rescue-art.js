import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { crownGeometry } from '../prairie-plants.js';
import { RESCUE_LAYOUT } from './rescue-state.js';

/** Original low-poly frontier art. Geometry is batched by articulated part. */
export function createRescueArt(THREE, hAt) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, metalness: 0 });
  const owned = new Set([material]);
  const colors = new Map();
  const color = hex => {
    if (!colors.has(hex)) colors.set(hex, new THREE.Color(hex).convertSRGBToLinear());
    return colors.get(hex);
  };
  const transform = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  function piece(bucket, geometry, hex, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    transform.compose(new THREE.Vector3(...p), quaternion, new THREE.Vector3(...scale));
    geometry.applyMatrix4(transform);
    const rgb = color(hex), values = new Float32Array(geometry.attributes.position.count * 3);
    const originalColors = geometry.attributes.color;
    for (let i = 0; i < values.length; i += 3) values.set(originalColors
      ? [rgb.r * originalColors.getX(i / 3), rgb.g * originalColors.getY(i / 3), rgb.b * originalColors.getZ(i / 3)]
      : [rgb.r, rgb.g, rgb.b], i);
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
    bucket.push(geometry);
  }
  const ellipsoid = (b, c, p, scale, rot = [0, 0, 0]) =>
    piece(b, new THREE.SphereGeometry(1, 12, 9), c, p, scale, rot);
  const box = (b, c, p, scale, rot = [0, 0, 0]) =>
    piece(b, new THREE.BoxGeometry(1, 1, 1), c, p, scale, rot);
  const cylinder = (b, c, p, top, bottom, height, rot = [0, 0, 0], sides = 10) =>
    piece(b, new THREE.CylinderGeometry(top, bottom, height, sides), c, p, [1, 1, 1], rot);
  const torus = (b, c, p, radius, tube, rot = [0, 0, 0], scale = [1, 1, 1]) =>
    piece(b, new THREE.TorusGeometry(radius, tube, 5, 20), c, p, scale, rot);
  function beam(bucket, hex, a, b, width) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), vector = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(width, width * 1.04, vector.length(), 7);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize())));
    piece(bucket, geometry, hex, start.add(end).multiplyScalar(.5).toArray());
  }
  function finish(bucket, name) {
    // Authored crowns are non-indexed while the mechanical primitives are
    // indexed. Normalise only the mixed batch before combining it.
    if (bucket.some(item => !item.index) && bucket.some(item => item.index)) {
      for (let i = 0; i < bucket.length; i++) if (bucket[i].index) {
        const old = bucket[i]; bucket[i] = old.toNonIndexed(); old.dispose();
      }
    }
    const geometry = BufferGeometryUtils.mergeBufferGeometries(bucket, false);
    bucket.forEach(item => item.dispose());
    if (!geometry) throw new Error(`Could not build frontier art: ${name}`);
    owned.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    return mesh;
  }

  function revolver(bucket, x, y, z, side = 1) {
    // Recognisable period silhouette: tapered barrel, six-shot cylinder, frame,
    // curved walnut grip and leather holster. Decorative only, no combat logic.
    ellipsoid(bucket, 0x65432d, [x, y - .08, z], [.115, .25, .09], [0, 0, -.16 * side]);
    box(bucket, 0x444c51, [x, y + .19, z + .015], [.13, .19, .115], [0, 0, -.12 * side]);
    cylinder(bucket, 0x9ba1a2, [x, y + .26, z + .025], .07, .07, .15, [Math.PI / 2, 0, 0]);
    cylinder(bucket, 0x667179, [x, y + .08, z + .025], .033, .04, .31, [0, 0, -.08 * side]);
    box(bucket, 0x4b2b1b, [x + side * .04, y + .37, z - .045], [.11, .22, .09], [0, 0, -.35 * side]);
    torus(bucket, 0xb2a181, [x, y + .15, z + .08], .07, .013, [0, 0, 0], [1, .75, 1]);
  }

  function person(captain = false, mounted = false) {
    const root = new THREE.Group(); root.name = captain ? 'FrontierCaptain' : 'FrontierCavalry';
    const body = [], headParts = [];
    const coat = captain ? 0x263f50 : 0x3e5368, trim = 0xcfaa56, leather = 0x62452e;
    // Torso is shaped from three overlapping volumes, with a flared coat skirt.
    ellipsoid(body, coat, [0, .6, 0], [.36, .48, .22]);
    cylinder(body, coat, [0, .19, 0], .30, .39, .39, [0, 0, 0], 14);
    ellipsoid(body, 0x22333f, [0, .97, .025], [.21, .12, .18]);
    cylinder(body, 0xdbad88, [0, 1.06, .03], .095, .11, .20);
    box(body, leather, [0, .34, .03], [.69, .09, .43]);
    box(body, trim, [0, .35, .26], [.13, .1, .025]);
    for (let i = 0; i < 4; i++) ellipsoid(body, trim, [.025, .48 + i * .125, .223], [.025, .025, .012]);
    ellipsoid(body, trim, [-.31, .91, .015], [.12, .045, .22]);
    ellipsoid(body, trim, [.31, .91, .015], [.12, .045, .22]);
    if (captain) {
      box(body, 0xe2bf68, [-.16, .75, .23], [.16, .026, .024]);
      box(body, 0xe2bf68, [-.16, .71, .23], [.16, .026, .024]);
    }
    if (mounted) {
      for (const side of [-1, 1]) {
        beam(body, 0xb9ad8d, [side * .17, .12, 0], [side * .58, -.28, .20], .15);
        beam(body, 0xb9ad8d, [side * .58, -.28, .20], [side * .58, -.84, .16], .12);
        ellipsoid(body, 0x41352a, [side * .58, -.89, .26], [.15, .17, .26]);
        torus(body, 0xa69a78, [side * .59, -.84, .19], .20, .025, [0, Math.PI / 2, 0], [1, 1.35, 1]);
      }
    } else {
      for (const side of [-1, 1]) {
        beam(body, 0x9c9c85, [side * .17, .07, 0], [side * .20, -.67, 0], .14);
        ellipsoid(body, 0x3e352d, [side * .20, -.75, .09], [.16, .25, .26]);
      }
    }
    revolver(body, .37, .27, .06);
    root.add(finish(body, captain ? 'OfficerUniformAndRevolver' : 'RiderUniformAndRevolver'));

    const head = new THREE.Group(); head.position.set(0, 1.26, .035); root.add(head);
    ellipsoid(headParts, 0xd4a17d, [0, 0, 0], [.23, .28, .23]);
    ellipsoid(headParts, 0x573b28, [0, .13, -.04], [.24, .19, .22]);
    for (const side of [-1, 1]) {
      ellipsoid(headParts, 0xc99270, [side * .23, -.015, 0], [.045, .075, .045]);
      ellipsoid(headParts, 0xede2cb, [side * .08, .015, .213], [.039, .032, .018]);
      ellipsoid(headParts, 0x252b29, [side * .08, .015, .226], [.018, .024, .012]);
      box(headParts, 0x66432c, [side * .08, .085, .22], [.078, .018, .018], [0, 0, side * -.08]);
    }
    ellipsoid(headParts, 0xc89674, [0, -.025, .24], [.044, .06, .046]);
    if (captain) for (const side of [-1, 1])
      ellipsoid(headParts, 0x674b35, [side * .046, -.094, .223], [.064, .026, .027], [0, 0, side * -.12]);
    else box(headParts, 0x95674f, [0, -.13, .205], [.075, .014, .016]);
    cylinder(headParts, captain ? 0xb6a073 : 0xa49578, [0, .23, 0], .40, .43, .055, [0, 0, -.08], 20);
    cylinder(headParts, captain ? 0xbdab84 : 0xa69779, [0, .39, -.015], .215, .255, .30, [0, 0, -.08], 16);
    cylinder(headParts, 0x493b2d, [0, .28, -.01], .257, .26, .065, [0, 0, -.08], 16);
    ellipsoid(headParts, trim, [0, .29, .251], [.047, .055, .016]);
    head.add(finish(headParts, 'FaceAndWesternHat'));

    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * .34, .86, 0); root.add(pivot);
      const parts = [];
      beam(parts, coat, [0, 0, 0], [side * .065, -.31, .025], .11);
      beam(parts, coat, [side * .065, -.31, .025], [side * .05, -.55, .15], .088);
      cylinder(parts, trim, [side * .05, -.49, .12], .092, .092, .07, [.4, 0, 0]);
      ellipsoid(parts, 0xd4a17d, [side * .05, -.60, .18], [.083, .10, .08]);
      pivot.add(finish(parts, side < 0 ? 'LeftArm' : 'RightArm'));
      const hand = new THREE.Object3D(); hand.position.set(side * .05, -.6, .18); pivot.add(hand);
      arms.push({ pivot, hand });
    }
    root.scale.setScalar(captain ? 1.13 : 1.04);
    root.userData = { arms, head, mounted };
    return {
      group: root, hand: arms[1].hand,
      update(elapsed, speed = 0, gesture = 'idle') {
        head.rotation.y = Math.sin(elapsed * .43) * .10;
        head.rotation.z = Math.sin(elapsed * .31) * .025;
        arms[0].pivot.rotation.x = mounted ? -.65 : Math.sin(elapsed * 1.3) * .06;
        arms[1].pivot.rotation.x = gesture === 'command' ? -2.0 : gesture === 'swing' ? -2.55 : gesture === 'throw' ? -1.62 : mounted ? -.70 : -.06;
        arms[1].pivot.rotation.z = gesture === 'swing' ? -.25 + Math.sin(elapsed * 8) * .16 : gesture === 'command' ? -.30 : -.07;
        root.rotation.z = mounted ? Math.sin(elapsed * (speed > 3 ? 7 : 2)) * Math.min(.025, .005 + speed * .003) : 0;
      },
    };
  }

  function saddle() {
    const parts = [];
    ellipsoid(parts, 0x6e442e, [0, 2.35, -.20], [.66, .15, .73]);
    ellipsoid(parts, 0x825635, [0, 2.51, -.56], [.55, .22, .16]);
    ellipsoid(parts, 0x825635, [0, 2.48, .30], [.51, .18, .14]);
    cylinder(parts, 0x68412a, [0, 2.66, .30], .08, .06, .20);
    ellipsoid(parts, 0xb49a66, [0, 2.76, .30], [.12, .04, .10]);
    for (const side of [-1, 1]) {
      box(parts, 0x856f4a, [side * .56, 2.18, -.48], [.26, .50, .40]);
      box(parts, 0xab8b5d, [side * .57, 2.36, -.48], [.29, .12, .43]);
    }
    for (let i = 0; i < 3; i++) torus(parts, 0xc8af79, [.69 + i * .028, 2.4, .17], .27, .025, [0, Math.PI / 2, 0]);
    return finish(parts, 'LeatherSaddleAndCoiledLasso');
  }

  function camp() {
    const root = new THREE.Group(), parts = [], gateParts = [], collisions = [];
    root.name = 'FrontierCamp';
    function post(x, z) {
      const y = hAt(x, z);
      cylinder(parts, 0x705339, [x, y + 1.18, z], .13, .20, 2.45, [0, 0, .025]);
      ellipsoid(parts, 0x9d8058, [x, y + 2.39, z], [.18, .08, .18]);
    }
    function fence(a, b) {
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]), count = Math.ceil(length / 3.5);
      for (let i = 0; i <= count; i++) post(a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count);
      for (const height of [.78, 1.64]) beam(parts, 0x9b7950,
        [a[0], hAt(...a) + height, a[1]], [b[0], hAt(...b) + height, b[1]], .115);
      for (let i = 0; i <= Math.ceil(length / 1.6); i++) {
        const t = i / Math.ceil(length / 1.6), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        collisions.push({ x, z, r: .82, top: hAt(x, z) + 2.3, active: false });
      }
    }
    fence([53, 0], [69, 0]); fence([53, 0], [53, 15]); fence([69, 0], [69, 15]);
    fence([53, 15], [56.7, 15]); fence([65.3, 15], [69, 15]);
    const gate = new THREE.Group(); gate.position.set(56.7, hAt(56.7, 15), 15); root.add(gate);
    for (const y of [.72, 1.65]) box(gateParts, 0xa78457, [4.3, y, 0], [8.6, .22, .19]);
    for (const x of [.1, 4.3, 8.5]) box(gateParts, 0x805e3b, [x, 1.18, 0], [.22, 1.6, .24]);
    beam(gateParts, 0x8a663f, [0, .55, .05], [8.6, 1.8, .05], .09);
    box(gateParts, 0x454c47, [8.15, 1.5, .17], [1.0, .12, .14]);
    gate.add(finish(gateParts, 'SwingingCorralGate'));
    const gateCollision = { x: 61, z: 15, r: 3.9, top: hAt(61, 15) + 2.3, active: false };
    collisions.push(gateCollision);

    // Canvas A-frame tents with open doorways and visible support ropes.
    for (const [x, z, turn] of [[44, 4, -.12], [44, -8, .20]]) {
      const y = hAt(x, z), p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = turn;
      const tent = [], geometry = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI);
      // Three-sided prism, rotated so its ridge follows the depth of the tent.
      piece(tent, geometry, 0xcbb98d, [0, 1.3, 0], [4.1, 7, 2.6], [Math.PI / 2, 0, 0]);
      const tentMesh = finish(tent, 'CanvasTent'); p.add(tentMesh);
      // Dark inset and rolled canvas flap make the entrance read from the trail.
      const door = [];
      box(door, 0x5c5541, [0, 1.3, 3.53], [1.5, 2.6, .035]);
      cylinder(door, 0xe0cda0, [0, 2.68, 3.62], .15, .15, 1.8, [0, 0, Math.PI / 2]);
      beam(door, 0x7b6543, [0, .1, 3.64], [0, 4.03, 3.64], .07);
      p.add(finish(door, 'TentEntrance')); root.add(p);
      for (const side of [-1, 1]) {
        beam(parts, 0xc7b485, [x + side * 3.5, y + .10, z + 4.5], [x + side * 2.8, y + 1.0, z + 3.1], .035);
      }
      collisions.push({ x, z, r: 4.8, top: y + 4.1, active: false });
    }
    // Barrels, oat sacks and a small lantern supply visual scale and purpose.
    for (let i = 0; i < 3; i++) {
      const x = 72 + i % 2 * 1.5, z = 5 + Math.floor(i / 2) * 1.7, y = hAt(x, z);
      cylinder(parts, 0x9b784d, [x, y + .65, z], .56, .54, 1.28, [0, 0, .035 * i], 12);
      for (const dy of [.20, 1.05]) cylinder(parts, 0x4f544e, [x, y + dy, z], .58, .58, .065, [0, 0, 0], 12);
      ellipsoid(parts, 0xbca777, [x + .25, y + 1.43, z + .12], [.58, .25, .54]);
    }
    for (let i = 0; i < 4; i++) {
      const x = 47 + i % 2 * 1.1, z = 19 + Math.floor(i / 2) * .8, y = hAt(x, z);
      ellipsoid(parts, 0xbbad82, [x, y + .45, z], [.63, .5, .48], [0, 0, (i - 2) * .11]);
    }
    const flag = new THREE.Group(); flag.position.set(50, hAt(50, 5), 5);
    const flagParts = [];
    cylinder(flagParts, 0x685641, [0, 3.6, 0], .06, .1, 7.2);
    ellipsoid(flagParts, 0xd5ae5e, [0, 7.25, 0], [.14, .18, .14]);
    flag.add(finish(flagParts, 'CampFlagpole'));
    const clothGeometry = new THREE.PlaneGeometry(2.8, 1.35, 8, 3);
    const flagMaterial = new THREE.MeshStandardMaterial({ color: color(0x314e65), side: THREE.DoubleSide, roughness: 1 });
    owned.add(clothGeometry); owned.add(flagMaterial);
    const cloth = new THREE.Mesh(clothGeometry, flagMaterial); cloth.position.set(1.4, 6.35, 0); flag.add(cloth);
    const flagTrim = [];
    box(flagTrim, 0xd0ad62, [1.4, 5.68, 0], [2.8, .06, .045]);
    flag.add(finish(flagTrim, 'CompanyPennantTrim')); root.add(flag);
    root.add(finish(parts, 'CorralAndCampSupplies'));
    return { group: root, gate, gateCollision, obstacles: collisions,
      update(elapsed, gateOpen, dt) {
        const desired = gateOpen ? -Math.PI * .52 : 0;
        gate.rotation.y += (desired - gate.rotation.y) * Math.min(1, dt * 3);
        const positions = clothGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(elapsed * 2.8 + positions.getX(i) * 1.8) * .11 * (positions.getX(i) + 1.4));
        positions.needsUpdate = true;
        gateCollision.active = root.visible && !gateOpen;
      },
    };
  }

  function refuge() {
    const group = new THREE.Group(), pieces = []; group.name = 'FreeHerdMeadow';
    for (const [x, z, scale] of [[94, 72, 1.2], [81, 78, .9]]) {
      const y = hAt(x, z);
      cylinder(pieces, 0x826b4d, [x, y + 3.0 * scale, z], .30 * scale, .59 * scale, 6 * scale, [0, 0, .10]);
      for (let i = 0; i < 6; i++) {
        const angle = i * 2.4, reach = 1.5 * scale;
        beam(pieces, 0x826b4d, [x, y + 3.4 * scale, z],
          [x + Math.cos(angle) * reach, y + 5.0 * scale, z + Math.sin(angle) * reach], .13 * scale);
        piece(pieces, crownGeometry(), [0x7b9154, 0x8c9e5b, 0xa1ad67][i % 3],
          [x + Math.cos(angle) * reach, y + (5.25 + i % 2 * .4) * scale, z + Math.sin(angle) * reach],
          [2.0 * scale, 1.5 * scale, 1.7 * scale], [.1, angle, .12]);
      }
    }
    for (let i = 0; i < 30; i++) {
      const angle = i * 2.4, radius = 3.8 + (i % 7) * .85;
      const x = 85 + Math.cos(angle) * radius, z = 68 + Math.sin(angle) * radius, y = hAt(x, z);
      beam(pieces, 0x718349, [x, y, z], [x, y + .42, z], .018);
      ellipsoid(pieces, i % 4 ? 0xdac57a : 0x9986a1, [x, y + .45, z], [.13, .06, .13]);
    }
    group.add(finish(pieces, 'ShelteringCottonwoodsAndFlowers'));
    const route = RESCUE_LAYOUT.escape;
    const curve = new THREE.CatmullRomCurve3(route.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const vertices = [], indices = [];
    for (let i = 0; i <= 80; i++) {
      const p = curve.getPoint(i / 80), tangent = curve.getTangent(i / 80);
      for (const side of [-1, 1]) {
        const x = p.x + tangent.z * side * 1.3, z = p.z - tangent.x * side * 1.3;
        vertices.push(x, hAt(x, z) + .045, z);
      }
      if (i < 80) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); owned.add(geometry);
    const pathMaterial = new THREE.MeshLambertMaterial({ color: color(0xc7b079), transparent: true, opacity: .28, depthWrite: false }); owned.add(pathMaterial);
    const trail = new THREE.Mesh(geometry, pathMaterial); trail.name = 'FreedomTrail'; group.add(trail);
    return group;
  }

  function rope() {
    const sections = 24, sides = 6, radius = .055;
    const positions = new Float32Array((sections + 1) * sides * 3), indices = [];
    for (let i = 0; i < sections; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices); owned.add(geometry);
    const ropeMaterial = new THREE.MeshLambertMaterial({ color: color(0xd4b77c) }); owned.add(ropeMaterial);
    const mesh = new THREE.Mesh(geometry, ropeMaterial); mesh.frustumCulled = false; mesh.name = 'MovingLasso';
    const loopGeometry = new THREE.TorusGeometry(.65, .055, 6, 24); owned.add(loopGeometry);
    const loop = new THREE.Mesh(loopGeometry, ropeMaterial); loop.name = 'LassoLoop';
    const group = new THREE.Group(); group.add(mesh, loop); group.visible = false;
    const normal = new THREE.Vector3(), tangent = new THREE.Vector3(), binormal = new THREE.Vector3(), p = new THREE.Vector3();
    return { group, loop,
      draw(from, to, sag = .35, horizontal = false, loopScale = 1, heading = 0) {
        group.visible = true;
        tangent.copy(to).sub(from).normalize(); normal.crossVectors(tangent, new THREE.Vector3(0, 1, 0));
        if (normal.lengthSq() < .001) normal.set(1, 0, 0); normal.normalize(); binormal.crossVectors(tangent, normal).normalize();
        for (let i = 0; i <= sections; i++) {
          const t = i / sections; p.copy(from).lerp(to, t); p.y -= Math.sin(Math.PI * t) * sag;
          for (let j = 0; j < sides; j++) {
            const angle = j / sides * Math.PI * 2, offset = (i * sides + j) * 3;
            positions[offset] = p.x + (normal.x * Math.cos(angle) + binormal.x * Math.sin(angle)) * radius;
            positions[offset + 1] = p.y + (normal.y * Math.cos(angle) + binormal.y * Math.sin(angle)) * radius;
            positions[offset + 2] = p.z + (normal.z * Math.cos(angle) + binormal.z * Math.sin(angle)) * radius;
          }
        }
        geometry.attributes.position.needsUpdate = true; geometry.computeVertexNormals();
        loop.position.copy(to); loop.rotation.set(horizontal ? Math.PI / 2 : 0, horizontal ? 0 : heading, 0);
        loop.scale.set(loopScale, horizontal ? loopScale : loopScale * 1.3, loopScale);
      },
    };
  }

  return { person, saddle, camp, refuge, rope,
    dispose() { owned.forEach(item => item.dispose()); owned.clear(); },
  };
}
