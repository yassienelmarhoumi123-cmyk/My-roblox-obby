import * as T from 'three';
import { mesh } from './city.js';

const sphere = new T.SphereGeometry(1, 20, 14);
const suitMaterial = color => new T.MeshStandardMaterial({ color, roughness: .64, metalness: .13 });
export const SUITS = [
  { name: 'Klassisch', level: 1, primary: 0xf63e51, secondary: 0x234b86, mask: 0x401e3e },
  { name: 'Mitternacht', level: 2, primary: 0x212a50, secondary: 0x0f1429, mask: 0xb6becd },
  { name: 'Neon', level: 3, primary: 0xe13d76, secondary: 0x272140, mask: 0x401535 },
  { name: 'Sonnenbrand', level: 4, primary: 0xf58b46, secondary: 0x49253e, mask: 0x41233b }
];

function pattern(suit) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + suit.primary.toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#' + suit.mask.toString(16).padStart(6, '0');
  g.globalAlpha = .65; g.lineWidth = 1.8;
  for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 10; y < 128; y += 13) for (let x = 0; x < 256; x += 16) {
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 8, x + 16, y); g.stroke();
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

export function createHero(scene) {
  const root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root);
  const red = suitMaterial(SUITS[0].primary), blue = suitMaterial(SUITS[0].secondary);
  const webbed = suitMaterial(0xffffff), black = suitMaterial(0x111429);
  const white = new T.MeshBasicMaterial({ color: 0xfff1e8 });
  const textures = SUITS.map(pattern);
  mesh(body, sphere, blue, 0, 1.05, 0, .27, .32, .19);
  mesh(body, sphere, webbed, 0, 1.43, 0, .375, .4, .225);
  mesh(body, sphere, black, 0, 1.73, 0, .135, .13, .125);
  const head = new T.Group(); head.position.y = 1.93; body.add(head);
  mesh(head, sphere, webbed, 0, 0, 0, .207, .261, .212);

  const eye = new T.Shape();
  eye.moveTo(0, -.035); eye.quadraticCurveTo(.048, .077, .14, .085);
  eye.quadraticCurveTo(.128, -.035, .061, -.065); eye.quadraticCurveTo(.019, -.075, 0, -.035);
  const patch = new T.ShapeGeometry(eye, 9);
  const eyeFrame = new T.MeshBasicMaterial({ color: 0x111424, side: T.DoubleSide });
  white.side = T.DoubleSide;
  for (const s of [-1, 1]) {
    mesh(head, patch, eyeFrame, s * .022, .019, -.208, s, 1.12, 1).rotation.y = -s * .40;
    mesh(head, patch, white, s * .031, .019, -.212, s * .76, .79, 1).rotation.y = -s * .41;
  }
  function logo(z, color) {
    const material = new T.LineBasicMaterial({ color });
    mesh(body, sphere, suitMaterial(color), 0, 1.45, z, .052, .11, .025);
    const points = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = 1.52 - i * .052;
      points.push(new T.Vector3(0, y, z), new T.Vector3(.088 * s, y + .046 - i * .027, z * .97));
      points.push(new T.Vector3(.088 * s, y + .046 - i * .027, z * .97), new T.Vector3(.14 * s, y + .081 - i * .052, z * .91));
    }
    body.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points), material));
  }
  logo(-.226, 0x141629); logo(.226, 0xfbe8e4);
  function limb(x, y, upper, lower, width, arm) {
    const pivot = new T.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    mesh(pivot, sphere, arm ? red : blue, 0, -upper / 2, 0, width, upper * .64, width);
    const joint = new T.Group(); joint.position.y = -upper; pivot.add(joint);
    mesh(joint, sphere, webbed, 0, -lower / 2, 0, width * .83, lower * .65, width * .83);
    const end = mesh(joint, sphere, red, 0, -lower, arm ? 0 : -.084, width * .88, width * .8, arm ? width : width * 1.55);
    return { pivot, joint, end };
  }
  const arms = [-1, 1].map(s => limb(s * .331, 1.59, .35, .33, .121, true));
  const legs = [-1, 1].map(s => limb(s * .16, .98, .47, .47, .146, false));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  function setSuit(index) {
    const suit = SUITS[index];
    red.color.set(suit.primary); blue.color.set(suit.secondary);
    webbed.map = textures[index]; webbed.needsUpdate = true;
  }
  function animate(time, dt, mode, speed, webs, attack, roll) {
    const run = Math.sin(time * (6 + speed * .71)), move = Math.min(1, speed / 5);
    const a = 1 - Math.exp(-dt * 13);
    const blend = (o, axis, v) => { o.rotation[axis] = T.MathUtils.lerp(o.rotation[axis], v, a); };
    blend(body, 'x', mode === 'air' ? -.2 : mode === 'ground' ? -.11 * move : .08);
    body.rotation.z = roll;
    if (attack) body.rotation.y = Math.sin(attack.progress * Math.PI) * (attack.kind === 'kick' ? -.95 : .72);
    else blend(body, 'y', 0);
    body.position.y = mode === 'ground' ? Math.abs(run) * .08 * move + Math.sin(time * 3) * .023 : 0;
    head.rotation.x = mode === 'air' ? -.15 : Math.sin(time * 2.7) * .04;
    for (let i = 0; i < 2; i++) {
      const sign = i * 2 - 1, arm = arms[i], leg = legs[i];
      const climbing = mode === 'climb', flying = mode === 'air';
      let armX = climbing ? -2.1 + sign * run * .6 : flying ? (webs[i] ? -2.57 : -1 + sign * .45) : -run * sign * move * .72;
      let legX = climbing ? -.5 + run * sign * .47 : flying ? -.42 + sign * .19 : run * sign * move * .85;
      if (attack?.kind === 'kick' && i === 1) legX = -1.9 * Math.sin(attack.progress * Math.PI);
      if (attack && attack.kind !== 'kick' && i === 1) armX = -1.8 * Math.sin(attack.progress * Math.PI);
      blend(arm.pivot, 'x', armX); blend(arm.pivot, 'z', sign * (flying ? .46 : climbing ? .36 : .14));
      blend(arm.joint, 'x', flying ? -.28 : -.37 - move * .19);
      blend(leg.pivot, 'x', legX); blend(leg.pivot, 'z', sign * (flying ? .19 : .03));
      blend(leg.joint, 'x', flying ? .79 + sign * .25 : climbing ? .85 : Math.max(0, -run * sign) * move * .74);
    }
  }
  setSuit(0);
  return { root, wrists: arms.map(arm => arm.end), animate, setSuit };
}
