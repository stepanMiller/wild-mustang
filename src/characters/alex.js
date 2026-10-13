/**
 * Alex, original Wild Mustang art. No downloaded or generated third-party asset.
 * Smooth, deliberately authored bind-pose geometry, an 18-joint skeleton, and
 * AnimationMixer clips replace the former box mannequin without changing the
 * gameplay-owned parent transform or the legacy userData animation handles.
 */
export const ALEX_CLIP_NAMES = Object.freeze(['Idle', 'Walk', 'Run', 'Wave', 'OfferApple', 'Pet']);

export function attachAlex({ THREE, alex }) {
  if (!THREE?.SkinnedMesh || !alex?.isObject3D) throw new TypeError('attachAlex needs THREE and the Alex group');
  const root = new THREE.Group();
  root.name = 'AlexOriginalRig';
  const originalChildren = alex.children.map(child => ({ child, visible: child.visible }));
  const bones = [], byName = {}, bind = {};
  const palette = {
    skin: 0xe0ac82, cheek: 0xe7a38a, shirt: 0xf2e4c8, vest: 0x8a5a32,
    leather: 0x60402b, pants: 0xa8945f, scarf: 0xb2402e, hair: 0x33231a,
    eye: 0x30221a, white: 0xfff4df, apple: 0xc84932, leaf: 0x759752,
  };
  function bone(name, parent, x, y, z = 0) {
    const item = new THREE.Bone(); item.name = name; item.position.set(x, y, z);
    (parent || root).add(item); byName[name] = item; bones.push(item); return item;
  }
  const origin = bone('AlexRoot', null, 0, 0);
  const hips = bone('AlexHips', origin, 0, .85);
  const spine = bone('AlexSpine', hips, 0, .24);
  const chest = bone('AlexChest', spine, 0, .275);
  const neck = bone('AlexNeck', chest, 0, .14);
  bone('AlexHead', neck, 0, .14);
  for (const [side, s] of [['Left', -1], ['Right', 1]]) {
    const shoulder = bone(`Alex${side}Arm`, chest, s * .267, .018);
    const elbow = bone(`Alex${side}Forearm`, shoulder, 0, -.252);
    bone(`Alex${side}Hand`, elbow, 0, -.22, .008);
    const leg = bone(`Alex${side}Leg`, hips, s * .125, -.02);
    const knee = bone(`Alex${side}Knee`, leg, 0, -.40);
    bone(`Alex${side}Foot`, knee, 0, -.315, .016);
  }
  root.updateMatrixWorld(true);
  bones.forEach((item, index) => {
    bind[item.name] = { index, position: item.getWorldPosition(new THREE.Vector3()) };
  });
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  const buckets = { body: [], eyes: [], apple: [] };
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .87, metalness: 0, skinning: true }),
    eyes: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .25, metalness: 0, skinning: true }),
    apple: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .53, metalness: 0, skinning: true }),
  };
  const v = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  function fixed(name) { return () => [[bind[name].index, 1]]; }
  function blend(a, b, lower, upper) {
    return point => {
      const weightA = THREE.MathUtils.clamp((point.y - lower) / (upper - lower), 0, 1);
      return [[bind[a].index, weightA], [bind[b].index, 1 - weightA]];
    };
  }
  const torsoWeight = point => {
    if (point.y > 1.25) return [[bind.AlexChest.index, 1]];
    if (point.y > .97) return blend('AlexChest', 'AlexSpine', 1.03, 1.27)(point);
    return blend('AlexSpine', 'AlexHips', .87, 1.04)(point);
  };

  function add(geometry, color, position, scale, weight, bucket = 'body', rotation) {
    q.setFromEuler(new THREE.Euler(...(rotation || [0, 0, 0])));
    matrix.compose(new THREE.Vector3(...position), q, new THREE.Vector3(...(scale || [1, 1, 1])));
    geometry.applyMatrix4(matrix);
    // Indexed primitive geometries have coincident vertices with distinct normals.
    // Keep them indexed until merging, so hard seams and curved normals survive.
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    const rgb = new THREE.Color(color).convertSRGBToLinear();
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(geometry.attributes.position, i);
      const influence = weight(v);
      influence.forEach(([index, value], channel) => {
        indices[i * 4 + channel] = index; weights[i * 4 + channel] = value;
      });
      colors.set([rgb.r, rgb.g, rgb.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    buckets[bucket].push(geometry);
  }
  function ellipsoid(color, position, scale, weight, bucket = 'body', rotation, detail = 14) {
    add(new THREE.SphereGeometry(1, detail, 10), color, position, scale, weight, bucket, rotation);
  }
  function cylinder(color, start, end, radiusTop, radiusBottom, weight, bucket = 'body', sides = 10) {
    const from = new THREE.Vector3(...start), to = new THREE.Vector3(...end);
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), sides, 3);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    matrix.compose(from.add(to).multiplyScalar(.5), q, one); geometry.applyMatrix4(matrix);
    add(geometry, color, [0, 0, 0], null, weight, bucket);
  }
  function cloth(sections, color, weight, startAngle = 0, arc = Math.PI * 2, offset = [0, 0, 0]) {
    const positions = [], indices = [], sides = 20;
    sections.forEach(([height, width, depth]) => {
      for (let i = 0; i <= sides; i++) {
        const angle = startAngle + i / sides * arc;
        positions.push(Math.sin(angle) * width + offset[0], height + offset[1], Math.cos(angle) * depth + offset[2]);
      }
    });
    for (let r = 0; r < sections.length - 1; r++) {
      for (let i = 0; i < sides; i++) {
        const a = r * (sides + 1) + i, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    add(geometry, color, [0, 0, 0], null, weight);
  }
  function triangle(points, color, weight) {
    const geometry = new THREE.BufferGeometry();
    // A slim closed wedge reads as fabric without requiring a double-sided draw.
    const positions = [...points.flat(), ...points.map(([x, y, z]) => [x, y, z - .015]).flat()];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
    geometry.computeVertexNormals(); add(geometry, color, [0, 0, 0], null, weight);
  }

  // A fitted ivory shirt, curved open waistcoat, satchel and folded red scarf
  // retain Alex's established colours while giving him a readable silhouette.
  cloth([[.86, .17, .105], [.96, .195, .12], [1.18, .226, .133], [1.335, .238, .122], [1.425, .145, .086]], palette.shirt, torsoWeight);
  cloth([[.94, .205, .131], [1.00, .217, .142], [1.20, .238, .148], [1.35, .24, .139], [1.40, .153, .105]], palette.vest, torsoWeight, .36, Math.PI * 2 - .72);
  triangle([[-.083, 1.37, .135], [-.036, 1.18, .154], [-.155, 1.295, .153]], 0xa87543, torsoWeight);
  triangle([[.083, 1.37, .135], [.15, 1.295, .153], [.033, 1.18, .154]], 0xa87543, torsoWeight);
  ellipsoid(palette.pants, [0, .86, 0], [.19, .115, .12], fixed('AlexHips'));
  add(new THREE.TorusGeometry(.17, .018, 6, 20), palette.leather, [0, .91, 0], [1, .75, 1], fixed('AlexHips'), 'body', [Math.PI / 2, 0, 0]);
  ellipsoid(0xcda267, [0, .91, .126], [.034, .029, .009], fixed('AlexHips'));
  cylinder(palette.skin, [0, 1.45, 0], [0, 1.61, 0], .076, .076, fixed('AlexNeck'));
  add(new THREE.TorusGeometry(.103, .035, 7, 18), palette.scarf, [0, 1.463, .015], [1.2, 1, .86], fixed('AlexNeck'), 'body', [Math.PI / 2, 0, 0]);
  ellipsoid(0xc75842, [.038, 1.435, .11], [.055, .043, .032], fixed('AlexChest'));
  triangle([[.018, 1.43, .139], [.099, 1.425, .13], [.062, 1.205, .152]], palette.scarf, torsoWeight);
  triangle([[.024, 1.422, .14], [-.064, 1.417, .141], [-.043, 1.279, .152]], 0xc4513b, torsoWeight);
  cylinder(palette.leather, [-.165, 1.39, .122], [.255, 1.00, .136], .016, .016, torsoWeight, 'body', 8);
  ellipsoid(palette.vest, [.24, .998, .048], [.112, .127, .068], fixed('AlexHips'));
  ellipsoid(0xa06c40, [.25, 1.07, .102], [.106, .072, .022], fixed('AlexHips'));
  ellipsoid(0xd4ad6e, [.25, 1.027, .127], [.012, .012, .006], fixed('AlexHips'), 'body', null, 8);

  for (const [side, s] of [['Left', -1], ['Right', 1]]) {
    const arm = `Alex${side}Arm`, forearm = `Alex${side}Forearm`, hand = `Alex${side}Hand`;
    const leg = `Alex${side}Leg`, knee = `Alex${side}Knee`, foot = `Alex${side}Foot`;
    const armSkin = blend(arm, forearm, 1.10, 1.21);
    ellipsoid(palette.shirt, [s * .259, 1.356, 0], [.093, .105, .10], fixed(arm));
    cylinder(palette.shirt, [s * .267, 1.19, 0], [s * .267, 1.367, 0], .086, .069, armSkin);
    ellipsoid(0xe5d7b9, [s * .267, 1.188, 0], [.075, .04, .075], armSkin);
    cylinder(palette.skin, [s * .267, .915, .009], [s * .267, 1.19, 0], .059, .047, armSkin);
    ellipsoid(palette.skin, [s * .269, .882, .014], [.062, .083, .049], fixed(hand));
    ellipsoid(palette.skin, [s * .22, .898, .037], [.023, .038, .028], fixed(hand));
    const legSkin = blend(leg, knee, .395, .52);
    cloth([[.18, .07, .071], [.25, .074, .079], [.40, .08, .083], [.49, .087, .09], [.65, .098, .10], [.83, .104, .108]], palette.pants, legSkin, 0, Math.PI * 2, [s * .125, 0, .007]);
    ellipsoid(palette.leather, [s * .125, .131, .014], [.088, .119, .101], fixed(foot));
    ellipsoid(palette.leather, [s * .125, .079, .077], [.092, .076, .158], fixed(foot));
    ellipsoid(0x423025, [s * .125, .026, .076], [.094, .027, .16], fixed(foot));
    ellipsoid(0x9b7647, [s * .125, .208, .042], [.086, .021, .092], fixed(foot));
  }

  const headWeight = fixed('AlexHead');
  ellipsoid(palette.skin, [0, 1.723, .008], [.216, .226, .198], headWeight, 'body', null, 20);
  for (const s of [-1, 1]) {
    ellipsoid(palette.skin, [s * .211, 1.721, -.001], [.041, .058, .025], headWeight);
    ellipsoid(0xc78e70, [s * .232, 1.724, .01], [.013, .03, .009], headWeight, 'body', null, 8);
    ellipsoid(palette.cheek, [s * .127, 1.67, .16], [.035, .02, .006], headWeight, 'body', null, 10);
    ellipsoid(palette.white, [s * .078, 1.741, .186], [.047, .037, .019], headWeight, 'eyes');
    ellipsoid(palette.eye, [s * .078, 1.74, .202], [.025, .028, .010], headWeight, 'eyes');
    ellipsoid(0xffffff, [s * .078 - .006, 1.752, .213], [.007, .007, .004], headWeight, 'eyes', null, 8);
    cylinder(palette.hair, [s * .043, 1.803, .184], [s * .113, 1.80, .185], .01, .012, headWeight, 'body', 6);
    for (let i = 0; i < 3; i++) {
      ellipsoid(0xa97451, [s * (.105 + i * .015), 1.694 - (i % 2) * .008, .183 - i * .003], [.0035, .0035, .002], headWeight, 'body', null, 6);
    }
  }
  ellipsoid(palette.skin, [0, 1.70, .203], [.032, .045, .027], headWeight);
  add(new THREE.TorusGeometry(.037, .0065, 5, 14, Math.PI), 0x925844, [0, 1.653, .204], [1, .72, 1], headWeight, 'body', [0, 0, Math.PI]);
  // The shaped hairline is higher at the forehead and lower behind the ears.
  // Its cap is slightly outside the head, including the crown, so no scalp
  // pokes through between the authored locks.
  const cap = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, 1);
  const capPosition = cap.attributes.position;
  for (let i = 0; i < capPosition.count; i++) {
    const oldTheta = Math.acos(THREE.MathUtils.clamp(capPosition.getY(i), -1, 1));
    const phi = Math.atan2(capPosition.getZ(i), -capPosition.getX(i));
    const front = Math.sin(phi);
    const theta = oldTheta * (1.68 - Math.max(0, front) * .43 + Math.max(0, -front) * .2);
    capPosition.setXYZ(i, -Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  }
  cap.computeVertexNormals();
  add(cap, palette.hair, [0, 1.747, -.006], [.235, .219, .221], headWeight);
  ellipsoid(palette.hair, [-.069, 1.838, .136], [.136, .074, .076], headWeight, 'body', [0, .12, -.22], 16);
  ellipsoid(0x493026, [.095, 1.885, .092], [.085, .061, .088], headWeight, 'body', [0, 0, .22]);
  ellipsoid(palette.hair, [-.144, 1.84, .036], [.09, .09, .119], headWeight, 'body', [0, 0, -.15]);
  ellipsoid(palette.hair, [.178, 1.77, -.024], [.039, .088, .087], headWeight);

  // The apple is attached by skin weights to the palm. It only appears when
  // offered; no parented static prop floats away during arm animation.
  const appleWeight = fixed('AlexRightHand');
  ellipsoid(palette.apple, [.273, .891, .076], [.064, .065, .061], appleWeight, 'apple');
  ellipsoid(0xdc6750, [.247, .91, .122], [.016, .025, .004], appleWeight, 'apple', null, 8);
  cylinder(palette.leather, [.272, .95, .076], [.274, .976, .079], .007, .007, appleWeight, 'apple', 6);
  ellipsoid(palette.leaf, [.293, .965, .082], [.027, .007, .012], appleWeight, 'apple', [0, 0, .32], 8);

  function merge(parts) {
    const geometry = new THREE.BufferGeometry();
    const attributes = ['position', 'normal', 'color', 'skinIndex', 'skinWeight'];
    for (const name of attributes) {
      const size = parts[0].attributes[name].itemSize;
      const length = parts.reduce((total, part) => total + part.attributes[name].array.length, 0);
      const data = name === 'skinIndex' ? new Uint16Array(length) : new Float32Array(length);
      let offset = 0;
      parts.forEach(part => { data.set(part.attributes[name].array, offset); offset += part.attributes[name].array.length; });
      geometry.setAttribute(name, new THREE.BufferAttribute(data, size));
    }
    const indices = []; let vertices = 0;
    parts.forEach(part => {
      const source = part.index?.array || Array.from({ length: part.attributes.position.count }, (_, index) => index);
      for (const index of source) indices.push(index + vertices);
      vertices += part.attributes.position.count; part.dispose();
    });
    geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
  const meshes = {};
  for (const bucket of Object.keys(buckets)) {
    const mesh = new THREE.SkinnedMesh(merge(buckets[bucket]), materials[bucket]);
    mesh.name = `Alex_${bucket}`; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false; root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); meshes[bucket] = mesh;
  }

  function clip(name, duration, sampler) {
    const times = Array.from({ length: 17 }, (_, index) => index / 16 * duration);
    const tracks = [];
    const samples = times.map(time => sampler(time / duration * Math.PI * 2));
    const names = new Set(samples.flatMap(sample => Object.keys(sample)));
    for (const boneName of names) {
      const rotations = [];
      samples.forEach(sample => {
        q.setFromEuler(new THREE.Euler(...(sample[boneName] || [0, 0, 0])));
        rotations.push(q.x, q.y, q.z, q.w);
      });
      tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, rotations));
    }
    return new THREE.AnimationClip(name, duration, tracks);
  }
  function rest(t) {
    return {
      AlexSpine: [Math.sin(t) * .012, 0, 0], AlexChest: [Math.sin(t) * -.009, 0, 0],
      AlexHead: [.018 + Math.sin(t) * .012, Math.sin(t) * .025, 0],
      AlexLeftArm: [0, 0, -.065], AlexRightArm: [0, 0, .065],
      AlexLeftForearm: [-.055, 0, 0], AlexRightForearm: [-.055, 0, 0],
      AlexLeftHand: [0, 0, 0], AlexRightHand: [0, 0, 0],
      AlexLeftLeg: [0, 0, 0], AlexRightLeg: [0, 0, 0],
      AlexLeftKnee: [0, 0, 0], AlexRightKnee: [0, 0, 0],
      AlexLeftFoot: [0, 0, 0], AlexRightFoot: [0, 0, 0],
    };
  }
  function gait(t, running) {
    const pose = rest(t); const amplitude = running ? .85 : .48;
    pose.AlexSpine = [running ? .105 : .035, 0, Math.sin(t) * .022];
    pose.AlexChest = [0, Math.sin(t) * .04, 0]; pose.AlexHead = [-.03, 0, 0];
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
      const swing = Math.sin(t) * sign;
      pose[`Alex${side}Leg`] = [-swing * amplitude, 0, 0];
      pose[`Alex${side}Knee`] = [Math.max(0, swing) * (running ? 1.18 : .62) + (running ? .13 : 0), 0, 0];
      pose[`Alex${side}Foot`] = [-Math.max(0, swing) * .22, 0, 0];
      pose[`Alex${side}Arm`] = [swing * (running ? .62 : .31), 0, side === 'Left' ? -.08 : .08];
      pose[`Alex${side}Forearm`] = [running ? -.65 : -.18, 0, 0];
    }
    return pose;
  }
  const clips = [
    clip('Idle', 3.4, rest), clip('Walk', 1.05, t => gait(t, false)), clip('Run', .66, t => gait(t, true)),
    clip('Wave', 2.25, t => ({ ...rest(t), AlexHead: [-.03, -.08, -.05], AlexRightArm: [-.15, 0, 2.35], AlexRightForearm: [0, 0, .4 + Math.sin(t * 2) * .32] })),
    clip('OfferApple', 3.0, t => ({ ...rest(t), AlexHead: [.025, -.10, -.025], AlexRightArm: [-1.03 + Math.sin(t) * .025, 0, .14], AlexRightForearm: [-.48, -.10, 0], AlexRightHand: [.14, 0, 0] })),
    clip('Pet', 2.4, t => ({ ...rest(t), AlexHead: [-.06, -.10, -.055], AlexRightArm: [-1.18 + Math.sin(t * 2) * .065, 0, .17], AlexRightForearm: [-.56 + Math.sin(t * 2) * .08, 0, 0], AlexRightHand: [.27, 0, 0] })),
  ];
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(clips.map(item => [item.name, mixer.clipAction(item)]));
  let activeName = 'Idle', elapsed = 0, disposed = false;
  const retiring = [];
  actions.Idle.play(); meshes.apple.visible = false;
  const lastPosition = alex.position.clone();
  const status = Object.freeze({ ready: true, kind: 'original-skinned', license: 'original', animations: ALEX_CLIP_NAMES, drawCalls: 3, bones: bones.length });
  root.userData = { character: 'Alex', originalArt: true, clips: ALEX_CLIP_NAMES, status };
  originalChildren.forEach(({ child }) => { child.visible = false; });
  alex.add(root);

  function update(dt, state = {}) {
    if (disposed) return;
    dt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), .1); elapsed += dt;
    const measuredSpeed = dt > 0 ? alex.position.distanceTo(lastPosition) / dt : 0;
    lastPosition.copy(alex.position);
    const speed = Math.max(0, Number.isFinite(state.speed) ? state.speed : measuredSpeed);
    const gesture = String(state.gesture || '').toLowerCase();
    let desired = speed > 4.6 ? 'Run' : speed > .16 ? 'Walk' : 'Idle';
    if (['apple', 'offer', 'offerapple'].includes(gesture) || (state.phase === 'meet' && alex._offered)) desired = 'OfferApple';
    else if (gesture === 'pet') desired = 'Pet';
    else if (gesture === 'wave' || ['reunion', 'ending', 'finale'].includes(state.phase)) desired = 'Wave';
    if (desired !== activeName) {
      const previous = actions[activeName], next = actions[desired];
      previous.fadeOut(.24); retiring.push({ action: previous, deadline: elapsed + .26 });
      next.reset().setEffectiveWeight(1).fadeIn(.24).play(); activeName = desired;
    }
    for (let i = retiring.length - 1; i >= 0; i--) {
      if (elapsed >= retiring[i].deadline) {
        if (retiring[i].action !== actions[activeName]) retiring[i].action.stop();
        retiring.splice(i, 1);
      }
    }
    actions.Walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 2.4, .7, 1.8));
    actions.Run.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 6, .75, 1.6));
    meshes.apple.visible = desired === 'OfferApple';
    mixer.update(dt); root.updateMatrixWorld(true);
    root.userData.animation = activeName;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    mixer.stopAllAction(); mixer.uncacheRoot(root); alex.remove(root);
    originalChildren.forEach(({ child, visible }) => { child.visible = visible; });
    Object.values(meshes).forEach(mesh => mesh.geometry.dispose());
    Object.values(materials).forEach(material => material.dispose()); skeleton.dispose?.();
  }
  return { root, status, update, dispose };
}
