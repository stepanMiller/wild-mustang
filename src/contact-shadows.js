/** Contact and directional penumbra share one instanced draw on all presets. */
export function createContactShadows(THREE, scene, actors, hAt, normalAt, sun) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(35,38,45,.35)');
  gradient.addColorStop(.52, 'rgba(35,38,45,.23)');
  gradient.addColorStop(1, 'rgba(35,38,45,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const shadows = new THREE.InstancedMesh(geometry, material, actors.length * 2);
  shadows.frustumCulled = false;
  shadows.renderOrder = 2;
  scene.add(shadows);
  const pose = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const light = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    update() {
      light.subVectors(sun.position, sun.target.position).normalize();
      actors.forEach(({ actor, width, length }, index) => {
        const slot = index * 2;
        for (let node = actor; node; node = node.parent) {
          if (!node.visible) {
            shadows.setMatrixAt(slot, hidden);
            shadows.setMatrixAt(slot + 1, hidden);
            return;
          }
        }
        const { x, z } = actor.position;
        const ground = hAt(x, z);
        const height = Math.max(0, actor.position.y - ground);
        const normal = normalAt(x, z);
        pose.position.set(x, ground + .055, z);
        pose.quaternion.setFromUnitVectors(up, normal);
        pose.rotateY(actor.userData.travelHeading ?? actor.rotation.y);

        // Contact contracts as the hooves leave the ground.
        const contact = Math.max(0, 1 - height * .85);
        pose.scale.set(width * .76 * contact, 1, length * .92 * contact);
        pose.updateMatrix();
        shadows.setMatrixAt(slot, pose.matrix);

        // Project the body toward the local terrain plane along the sunlight.
        // Bound the footprint at grazing angles and over convex hilltops.
        const reach = Math.min(length * .76, (.3 * length + height) / Math.max(.25, normal.dot(light)));
        const dx = -light.x * reach, dz = -light.z * reach;
        pose.position.x += dx;
        pose.position.z += dz;
        pose.position.y -= (normal.x * dx + normal.z * dz) / normal.y;
        pose.scale.set(width * 1.18, 1, length * 1.13);
        pose.updateMatrix();
        shadows.setMatrixAt(slot + 1, pose.matrix);
      });
      shadows.instanceMatrix.needsUpdate = true;
    },
  };
}
