import * as T from 'three';
import { clamp, EDGE } from './city.js';
import { createHero } from './hero.js';

const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const MAX_WEB = 95;
export function createPlayer(scene, city, sound) {
  const hero = createHero(scene);
  const spawn = city.near(0, 64)[0];
  const pos = v(0, spawn.h + .1, 55), velocity = v(), facing = v(0, 0, -1);
  const camera = new T.PerspectiveCamera(55, 1, .1, 1350);
  const ropes = [null, null], lines = ropes.map((_, i) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3));
    const line = new T.Line(geometry, new T.LineBasicMaterial({ color: i ? 0x93efff : 0xffffff, fog: false }));
    line.visible = false; line.frustumCulled = false; scene.add(line); return line;
  });
  const right = v(1, 0, 0), forward = v(0, 0, -1), movement = v(), radial = v(), previous = v(), wrist = v(), sample = v(), desired = v(), look = v();
  let yaw = 0, pitch = .34, close = false, ground = true, wall = null, flip = 0, dodge = 0, footsteps = 0, attack = null;
  let checkpoint = pos.clone();
  const inside = (b, x, z, radius = 0) => Math.abs(b.x - x) < b.w / 2 + radius && Math.abs(b.z - z) < b.d / 2 + radius;
  const occupied = (p, padding = .1) => city.near(p.x, p.z, 3).some(b => p.y > 0 && p.y < b.h + padding && inside(b, p.x, p.z, padding));
  const turn = (dx, dy) => { yaw -= dx * .004; pitch = clamp(pitch + dy * .0035, -.28, .65); };
  function start() {
    camera.position.set(3, pos.y + 4.3, pos.z + 10);
    camera.lookAt(pos.x, pos.y + 1.25, pos.z - 2);
  }
  function roofAnchor(index, aim) {
    if (aim) {
      const ray = new T.Raycaster();
      ray.setFromCamera(aim, camera);
      let nearest = null, distance = MAX_WEB;
      for (const b of city.near(pos.x, pos.z, MAX_WEB)) {
        const bounds = new T.Box3(v(b.x - b.w / 2, 0, b.z - b.d / 2), v(b.x + b.w / 2, b.h, b.z + b.d / 2));
        const hit = ray.ray.intersectBox(bounds, v());
        if (hit && hit.y > pos.y + 2 && hit.distanceTo(pos) < distance && (!ropes[1 - index] || hit.distanceTo(ropes[1 - index].p) > 4)) {
          nearest = hit; distance = hit.distanceTo(pos);
        }
      }
      if (nearest) return nearest;
    }
    let best = null, score = -Infinity;
    for (const b of city.near(pos.x, pos.z, MAX_WEB)) {
      if (b.h < pos.y + 5 || (inside(b, pos.x, pos.z, 2) && pos.y < b.h)) continue;
      const x = clamp(pos.x, b.x - b.w / 2 + 1, b.x + b.w / 2 - 1);
      const z = clamp(pos.z, b.z - b.d / 2 + 1, b.z + b.d / 2 - 1);
      const p = v(x, b.h + .12, z), dx = x - pos.x, dz = z - pos.z, horizontal = Math.hypot(dx, dz);
      const dist = pos.distanceTo(p);
      if (horizontal < 5 || dist > MAX_WEB || (ropes[1 - index] && p.distanceTo(ropes[1 - index].p) < 8)) continue;
      const alignment = (dx * forward.x + dz * forward.z) / horizontal;
      const side = (dx * right.x + dz * right.z) / horizontal;
      const value = alignment * 20 + side * (index ? 8 : -8) - dist * .37 + Math.min(p.y - pos.y, 32) * .42;
      if (value > score) { score = value; best = p; }
    }
    return best;
  }
  function attach(index, aim) {
    if (ropes[index]) return true;
    const p = roofAnchor(index, aim);
    if (!p) return false;
    const length = p.distanceTo(sample.copy(pos).add(v(0, 1.1, 0)));
    ropes[index] = { p, length: length * .98, minimum: Math.max(7, length * .43) };
    if (ground) { velocity.y = 7.8; ground = false; }
    wall = null; sound('web');
    return true;
  }
  function release(index) { ropes[index] = null; }
  function reset() {
    pos.copy(checkpoint); velocity.set(0, 0, 0); ground = true; wall = null;
    release(0); release(1); start();
  }
  function jump() {
    if (ground) { velocity.y = 9.8; ground = false; sound('jump'); }
    else if (wall) {
      velocity.addScaledVector(facing, -8); velocity.y = 10; wall = null; pos.addScaledVector(facing, -.8);
      sound('jump');
    } else if (ropes.some(Boolean)) {
      release(0); release(1); velocity.y += 4; flip = .63; sound('jump');
    } else if (!flip) flip = .63;
  }
  function evade() {
    if (dodge > 0) return;
    dodge = .5;
    velocity.addScaledVector(movement.lengthSq() > .1 ? movement : right, 12);
    if (!ground) flip = .63;
    sound('jump');
  }
  function collide(wantsClimb) {
    ground = false; wall = null;
    if (pos.y < .31) {
      if (velocity.y < -5) sound('land');
      pos.y = .31; velocity.y = Math.max(0, velocity.y); ground = true;
    }
    for (const b of city.near(pos.x, pos.z, 3)) {
      if (!inside(b, pos.x, pos.z, .43) || pos.y >= b.h + .04) continue;
      if (previous.y >= b.h - .12 && velocity.y <= 0) {
        if (velocity.y < -5) sound('land');
        pos.y = b.h + .04; velocity.y = 0; ground = true; continue;
      }
      const x = pos.x - b.x, z = pos.z - b.z;
      const overlapX = b.w / 2 + .43 - Math.abs(x), overlapZ = b.d / 2 + .43 - Math.abs(z);
      if (overlapX < overlapZ) {
        const s = Math.sign(x) || 1;
        pos.x = b.x + s * (b.w / 2 + .431);
        if (velocity.x * s < 0) velocity.x = 0;
        if (wantsClimb && movement.x * s < -.15) wall = { x: -s, z: 0 };
      } else {
        const s = Math.sign(z) || 1;
        pos.z = b.z + s * (b.d / 2 + .431);
        if (velocity.z * s < 0) velocity.z = 0;
        if (wantsClimb && movement.z * s < -.15) wall = { x: 0, z: -s };
      }
      if (wall && pos.y > b.h - .55) {
        pos.y = b.h + .11;
        pos.x += wall.x * .61; pos.z += wall.z * .61;
        ground = true; wall = null;
      }
    }
    if (ground && velocity.lengthSq() < 5) checkpoint.copy(pos);
  }
  function physics(dt, keys, level, carrying) {
    dodge = Math.max(0, dodge - dt); flip = Math.max(0, flip - dt);
    if (attack) { attack.progress += dt * 3.25; if (attack.progress > 1) attack = null; }
    if (keys.has('ArrowLeft')) turn(-dt * 440, 0);
    if (keys.has('ArrowRight')) turn(dt * 440, 0);
    if (keys.has('ArrowUp')) turn(0, -dt * 260);
    if (keys.has('ArrowDown')) turn(0, dt * 260);
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    movement.set(0, 0, 0);
    if (keys.has('KeyW')) movement.add(forward);
    if (keys.has('KeyS')) movement.sub(forward);
    if (keys.has('KeyD')) movement.add(right);
    if (keys.has('KeyA')) movement.sub(right);
    movement.normalize();
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'), tethered = ropes.some(Boolean);
    const speed = (sprint ? 12 : 6.3) * (carrying ? .72 : 1);
    if (ground && !tethered && dodge <= 0) {
      const rate = 1 - Math.exp(-dt * 19);
      velocity.x = T.MathUtils.lerp(velocity.x, movement.x * speed, rate);
      velocity.z = T.MathUtils.lerp(velocity.z, movement.z * speed, rate);
    } else {
      if (tethered) velocity.addScaledVector(movement, (11 + level) * dt);
      else velocity.addScaledVector(movement, (6 + level) * dt);
      const drag = Math.exp(-dt * (tethered ? .11 : .25));
      velocity.x *= drag; velocity.z *= drag;
    }
    velocity.y -= dt * 22;
    if (wall && !tethered && movement.dot(facing) > .3) {
      velocity.x += wall.x * dt * 25; velocity.z += wall.z * dt * 25;
      velocity.y = sprint ? 10.3 : 6.8;
    }
    for (const rope of ropes) if (rope) {
      rope.length = Math.max(rope.minimum, rope.length - dt * (5.2 + level * .8));
      radial.copy(pos).sub(rope.p); radial.y += 1.1;
      const dist = radial.length();
      if (dist > rope.length) {
        radial.multiplyScalar(1 / dist);
        const outward = velocity.dot(radial);
        const tensile = clamp((dist - rope.length) * 29 + Math.max(0, outward) * 7.8, 0, 108);
        velocity.addScaledVector(radial, -tensile * dt);
      }
    }
    velocity.clampLength(0, carrying ? 28 : 39 + level * 4);
    previous.copy(pos); pos.addScaledVector(velocity, dt);
    const onBridge = Math.abs(pos.z + 32) < 7.4 && pos.x >= 410 && pos.x < 566;
    pos.x = clamp(pos.x, -EDGE + 1, onBridge ? 565 : EDGE - 1);
    pos.z = clamp(pos.z, -EDGE + 1, EDGE - 1); pos.y = Math.min(191, pos.y);
    if (onBridge && pos.y < 3.40) { pos.y = 3.40; velocity.y = 0; ground = true; }
    else collide(!tethered && movement.lengthSq() > .1);
    if (wall) facing.set(wall.x, 0, wall.z);
    else if (movement.lengthSq() > .1) facing.lerp(movement, 1 - Math.exp(-dt * 18)).normalize();
    else if (!ground && Math.hypot(velocity.x, velocity.z) > 2.5) {
      sample.set(velocity.x, 0, velocity.z).normalize(); facing.lerp(sample, dt * 5).normalize();
    }
    if (ground && movement.lengthSq() > .1) {
      footsteps += dt * speed;
      if (footsteps > 2.15) { footsteps = 0; sound('step'); }
    }
  }
  function render(dt, time, menu, cameraShake) {
    const speed = Math.hypot(velocity.x, velocity.z);
    hero.root.position.copy(pos);
    const targetYaw = Math.atan2(-facing.x, -facing.z) + (menu ? 2.94 : 0);
    const delta = Math.atan2(Math.sin(targetYaw - hero.root.rotation.y), Math.cos(targetYaw - hero.root.rotation.y));
    hero.root.rotation.y += delta * (1 - Math.exp(-dt * 15));
    const roll = flip ? ((.63 - flip) / .63) * 6.283185 : !ground && !wall ? clamp(velocity.dot(right) * -.029, -.55, .55) : 0;
    hero.animate(time, dt, menu || ground && !wall ? 'ground' : wall ? 'climb' : 'air', speed, ropes, attack, roll);
    hero.root.updateWorldMatrix(true, true);
    ropes.forEach((rope, i) => {
      const line = lines[i]; line.visible = !!rope;
      if (!rope) return;
      hero.wrists[i].getWorldPosition(wrist);
      const a = line.geometry.attributes.position, slack = Math.max(0, rope.length - wrist.distanceTo(rope.p));
      a.setXYZ(0, wrist.x, wrist.y, wrist.z);
      a.setXYZ(1, (wrist.x + rope.p.x) / 2, (wrist.y + rope.p.y) / 2 - Math.min(3.5, slack * .32), (wrist.z + rope.p.z) / 2);
      a.setXYZ(2, rope.p.x, rope.p.y, rope.p.z); a.needsUpdate = true;
    });
    if (menu) {
      desired.set(pos.x + 2.3 + Math.sin(time * .2) * .24, pos.y + 2.23, pos.z + 4.35);
      look.set(pos.x - 2.2, pos.y + 1.16, pos.z - 1.8);
    } else {
      const zoom = (close ? 4.1 : 7.1) + speed * (close ? .038 : .067);
      look.copy(pos); look.y += 1.35;
      sample.set(Math.sin(yaw), 0, Math.cos(yaw));
      desired.copy(look).addScaledVector(sample, Math.cos(pitch) * zoom);
      desired.y += .62 + Math.sin(pitch) * zoom;
      for (let i = 1; i <= 18; i++) {
        sample.copy(look).lerp(desired, i / 18);
        if (occupied(sample, .36)) { desired.lerp(look, 1 - Math.max(.04, (i - 1) / 18)); break; }
      }
      if (cameraShake > 0) desired.y += Math.sin(time * 57) * cameraShake * .19;
    }
    camera.position.lerp(desired, 1 - Math.exp(-dt * (menu ? 3.5 : 12)));
    if (!menu && occupied(camera.position, .3)) camera.position.copy(desired);
    camera.lookAt(look);
    camera.fov = T.MathUtils.lerp(camera.fov, (close ? 52 : 57) + Math.min(12, speed * .29), 1 - Math.exp(-dt * 8));
    camera.updateProjectionMatrix();
  }
  start();
  return { pos, velocity, facing, camera, avatar: hero.root, ropes, attach, release, jump, evade, physics, render, reset, turn,
    setSuit: hero.setSuit, get ground() { return ground; }, get wall() { return wall; }, get dodging() { return dodge > 0; },
    get cameraName() { return close ? 'NAH' : 'THIRD PERSON'; },
    toggleCamera() { close = !close; }, attack(kind) { attack = { kind, progress: 0 }; } };
}
