// The managed preview can disable GPU contexts. Project the same scene onto a
// 2D canvas in that case; gameplay, geometry and camera remain in world space.
import * as T from 'three';
import { CELL, EDGE, random } from './city.js';

const boxCorners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const faces = [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2]];
const faceLight = [.87, .73, .78, 1.02, 1.12];
const sphere = new T.SphereGeometry(1, 8, 6);
const cache = new WeakMap();
const textures = new WeakMap();
const matColor = m => m?.color?.getHex() ?? 0x45445b;
const bright = (hex, k) => `rgb(${Math.min(255, (hex >> 16) * k | 0)},${Math.min(255, ((hex >> 8) & 255) * k | 0)},${Math.min(255, (hex & 255) * k | 0)})`;
const pos = new T.Vector3();
const objMatrix = new T.Matrix4();
const view = new T.Matrix4();
const clipDepth = .25;

function triangles(geometry) {
  if (geometry.type === 'SphereGeometry') geometry = sphere;
  if (cache.has(geometry)) return cache.get(geometry);
  const attribute = geometry.attributes.position, index = geometry.index;
  const points = Array.from({ length: attribute.count }, (_, i) => [attribute.getX(i), attribute.getY(i), attribute.getZ(i)]);
  const out = [];
  for (let i = 0; i + 2 < (index?.count ?? points.length); i += 3) {
    out.push([index ? index.getX(i) : i, index ? index.getX(i + 1) : i + 1, index ? index.getX(i + 2) : i + 2]);
  }
  const data = { points, out }; cache.set(geometry, data); return data;
}

export function createSoftwareRenderer(canvas, city, player) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw Error('Kein 3D- oder 2D-Zeichenkontext verfügbar');
  let width, height, ratio = 1, focal, brightness, time = 0, eye;
  const chunks = [], geometryPos = new T.Vector3();
  let staticScene = null;
  function resize(w, h) {
    const scale = Math.min(ratio, 1280 / w, 800 / h);
    width = canvas.width = Math.max(1, Math.round(w * scale));
    height = canvas.height = Math.max(1, Math.round(h * scale));
  }
  function cameraPoint(x, y, z, m = view.elements) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], -(m[2] * x + m[6] * y + m[10] * z + m[14])];
  }
  function project(a) { return [width * .5 + a[0] * focal / a[2], height * .5 - a[1] * focal / a[2]]; }
  function clipped(points) {
    const output = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (a[2] >= clipDepth) output.push(a);
      if ((a[2] >= clipDepth) !== (b[2] >= clipDepth)) {
        const t = (clipDepth - a[2]) / (b[2] - a[2]);
        output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, clipDepth]);
      }
    }
    return output.map(project);
  }
  function shape(out, color, border) {
    if (out.length < 3 || out.every(p => p[0] < 0) || out.every(p => p[0] > width) || out.every(p => p[1] < 0) || out.every(p => p[1] > height)) return false;
    ctx.beginPath(); ctx.moveTo(...out[0]);
    for (let i = 1; i < out.length; i++) ctx.lineTo(...out[i]);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = .65; ctx.stroke(); }
    return true;
  }
  function surface(x, y, z, w, d, col) {
    shape(clipped([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]].map(p => cameraPoint(...p))), col);
  }
  function box(x, y, z, w, h, d, hex, windows = false) {
    const c = boxCorners.map(a => cameraPoint(x + a[0]*w/2, y + a[1]*h/2, z + a[2]*d/2));
    const visible = [eye.z < z-d/2, eye.z > z+d/2, eye.x < x-w/2, eye.x > x+w/2, eye.y > y+h/2];
    for (let i = 0; i < faces.length; i++) {
      if (!visible[i]) continue;
      const ids = faces[i];
      const distance = c.reduce((sum, p) => sum + p[2], 0) / 8;
      const haze = Math.min(.64, Math.max(0, (distance - 70) / 800));
      const shade = bright(hex, faceLight[i] * brightness);
      if (!shape(clipped(ids.map(index => c[index])), shade, windows ? shade : null)) continue;
      if (!windows || i === 4) continue;
      const cols = distance < 170 ? 8 : 5, floors = Math.min(30, Math.max(3, Math.floor(h / (distance < 220 ? 5 : 9))));
      const dx = i < 2 ? w : d;
      if (distance > 550) continue;
      for (let row = 0; row < floors; row++) for (let col = 0; col < cols; col++) {
        const fx = (col + .5) * dx / cols - dx / 2, fy = y - h / 2 + (row + .5) * h / floors;
        const half = dx / cols * .33, dh = h / floors * .29;
        const quad = i < 2
          ? [[x+fx-half,fy-dh,z+(i ? 1 : -1)*d/2],[x+fx+half,fy-dh,z+(i ? 1 : -1)*d/2],[x+fx+half,fy+dh,z+(i ? 1 : -1)*d/2],[x+fx-half,fy+dh,z+(i ? 1 : -1)*d/2]]
          : [[x+(i === 3 ? 1 : -1)*w/2,fy-dh,z+fx-half],[x+(i === 3 ? 1 : -1)*w/2,fy-dh,z+fx+half],[x+(i === 3 ? 1 : -1)*w/2,fy+dh,z+fx+half],[x+(i === 3 ? 1 : -1)*w/2,fy+dh,z+fx-half]];
        const lit = random(x + col, z + row + i * 11, 1) > .77;
        shape(clipped(quad.map(p => cameraPoint(...p))), bright(lit ? 0xf0be87 : 0x304663, (lit ? .99 : brightness) * (1 - haze * .4)));
      }
    }
  }
  function backgrounds(day, camera) {
    const horizon = project(cameraPoint(eye.x + Math.sin(camera.rotation.y) * -250, eye.y, eye.z - Math.cos(camera.rotation.y) * 250))[1];
    const end = Math.max(height * .24, Math.min(height, horizon));
    const gradient = ctx.createLinearGradient(0, 0, 0, end || height);
    gradient.addColorStop(0, bright(0x384c75, .34 + .66 * day));
    gradient.addColorStop(.69, bright(0x9b6c8a, .38 + .63 * day));
    gradient.addColorStop(1, bright(0xf0a68c, .38 + .62 * day));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const sunX = width * (.76 + Math.sin(camera.rotation.y) * .4), sunY = end * .46;
    const sun = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, height * .26);
    sun.addColorStop(0, day > .3 ? '#ffbd92bf' : '#a6b9ef65'); sun.addColorStop(1, '#ffbd9200');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);
    ctx.beginPath(); ctx.arc(sunX, sunY, Math.max(6, height * .025), 0, Math.PI * 2); ctx.fillStyle = day > .3 ? '#ffe0ad' : '#dce3ff'; ctx.fill();
    for (let i = 0; i < 8; i++) {
      const x = ((random(i, 3) * 1.33 + time * .005 + camera.rotation.y * .15) % 1.33 - .1) * width;
      ctx.beginPath(); ctx.ellipse(x, end * (.2 + random(i, 4) * .68), 35 + random(i, 5) * width * .12, 2 + random(i, 6) * height * .012, 0, 0, Math.PI * 2);
      ctx.fillStyle = day > .3 ? '#ffe0c724' : '#a6b9ef17'; ctx.fill();
    }
  }
  function readInstances(scene) {
    staticScene = scene;
    for (const o of scene.children) if (o.isInstancedMesh && !o.material.map) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, objMatrix);
        const m = objMatrix.elements;
        chunks.push({ x:m[12], y:m[13], z:m[14], w:m[0], h:m[5], d:m[10], color:matColor(o.material), type:o.geometry.type });
      }
    }
  }
  function drawMesh(o) {
    const geom = o.geometry;
    objMatrix.multiplyMatrices(view, o.matrixWorld);
    const m = objMatrix.elements;
    const { points, out } = triangles(geom);
    const v = points.map(p => cameraPoint(...p, m));
    let color = matColor(o.material);
    if (o.material.map?.image) {
      const map = o.material.map;
      if (!textures.has(map)) {
        const a = map.image.getContext('2d').getImageData(1, 1, 1, 1).data;
        textures.set(map, (a[0] << 16) | (a[1] << 8) | a[2]);
      }
      color = textures.get(map);
    }
    const polys = [];
    for (const idx of out) {
      const pts = idx.map(i => v[i]);
      if (pts.every(p => p[2] <= clipDepth)) continue;
      const projected = clipped(pts);
      if (projected.length < 3) continue;
      const [a, b, c] = projected;
      const area = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if (area >= 0 && o.material.side !== T.DoubleSide) continue;
      polys.push({ projected, dist:(pts[0][2]+pts[1][2]+pts[2][2])/3, shade: .76 + .28 * random(idx[0], idx[1] >> 2, 1) });
    }
    polys.sort((a,b) => b.dist - a.dist);
    for (const p of polys) {
      const col = bright(color, p.shade * (o.material.isMeshBasicMaterial ? 1.15 : brightness * 1.12));
      shape(p.projected, col, col);
    }
  }
  function drawLine(o) {
    objMatrix.multiplyMatrices(view, o.matrixWorld);
    const attribute = o.geometry.attributes.position, points = [];
    for (let i = 0; i < attribute.count; i++) {
      geometryPos.fromBufferAttribute(attribute, i);
      points.push(cameraPoint(geometryPos.x, geometryPos.y, geometryPos.z, objMatrix.elements));
    }
    ctx.strokeStyle = bright(matColor(o.material), 1.1);
    ctx.lineWidth = o.isLineSegments ? 1.1 : 1.55;
    for (let i = 0; i < points.length - 1; i += o.isLineSegments ? 2 : 1) {
      if (points[i][2] <= clipDepth || points[i+1][2] <= clipDepth) continue;
      ctx.beginPath(); ctx.moveTo(...project(points[i])); ctx.lineTo(...project(points[i+1])); ctx.stroke();
    }
  }
  function drawObject(o) {
    if (!o.visible) return;
    if (o.isMesh) drawMesh(o);
    if (o.isLine) drawLine(o);
    const ordered = o.children.map(child => {
      pos.setFromMatrixPosition(child.matrixWorld);
      return [child, cameraPoint(pos.x, pos.y, pos.z)[2]];
    }).sort((a,b) => b[1] - a[1]);
    for (const [child] of ordered) drawObject(child);
  }
  function render(scene, camera, day) {
    if (staticScene !== scene) readInstances(scene);
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    view.copy(camera.matrixWorldInverse); eye = camera.position;
    focal = height * .5 / Math.tan(camera.fov * Math.PI / 360);
    brightness = .62 + day * .54; time += 1/60;
    backgrounds(day, camera);
    surface(0, -.03, 0, EDGE*2, EDGE*2, bright(0x363847, brightness));
    surface(658, -.25, 0, 484, 1250, bright(0x455779, brightness));
    const ground = [], drawn = [];
    for (const p of chunks) {
      const dist = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (p.y < .35 && p.h <= .64) {
        if (dist < 220) ground.push(p);
      } else if (dist < (p.w > 40 || p.d > 40 ? 490 : 113)) {
        if (cameraPoint(p.x, p.y, p.z)[2] > -12) drawn.push({ p, dist });
      }
    }
    ground.sort((a,b) => a.y - b.y);
    for (const p of ground) surface(p.x, p.y + p.h/2, p.z, p.w, p.d, bright(p.color, brightness));
    for (const b of city.buildings) {
      const dist = Math.hypot(b.x - eye.x, b.z - eye.z);
      if (dist < 750 && cameraPoint(b.x,b.h/2,b.z)[2] > -36) drawn.push({ b, dist });
    }
    for (const o of scene.children) {
      if (o === player.avatar || o.isLine || !o.visible || o.isInstancedMesh || (!o.isGroup && !o.isLine && !o.isMesh)) continue;
      if (o.isMesh && !['TorusGeometry','IcosahedronGeometry','OctahedronGeometry'].includes(o.geometry.type)) continue;
      const dist = o.isLine ? player.pos.distanceTo(eye) + .6 : o.position.distanceTo(eye);
      if (dist < (o.isGroup && o.children.length > 3 ? 115 : 190)) drawn.push({ o, dist });
    }
    drawn.sort((a,b) => b.dist - a.dist);
    for (const { b, p, o } of drawn) {
      if (b) {
        const col = [0x666582,0x567287,0x746174,0x7c7189][Math.floor(random(b.x,b.z,1)*4)];
        box(b.x,b.h/2,b.z,b.w,b.h,b.d,col,true);
        box(b.x,b.h-.18,b.z,b.w+.6,.55,b.d+.6,0x777189);
        if (b.h > 82) box(b.x,b.h+5,b.z,.5,10,.5,0xd18f90);
      } else if (p) {
        if (p.type === 'IcosahedronGeometry') {
          const a = cameraPoint(p.x,p.y,p.z);
          if (a[2] > clipDepth) {
            const [x,y] = project(a), w = p.w * focal / a[2], h = p.h * focal / a[2];
            shape([[x-w*.6,y],[x-w*.39,y-h*.66],[x+w*.26,y-h*.91],[x+w*.61,y-h*.18],[x+w*.35,y+h*.5],[x-w*.33,y+h*.57]], bright(p.color,brightness));
          }
        } else box(p.x,p.y,p.z,p.w,p.h,p.d,p.color);
      } else drawObject(o);
    }
    for (const o of scene.children) if (o.isLine && o.visible) drawLine(o);
    drawObject(player.avatar);
  }
  return { render, setPixelRatio(v) { ratio = v; }, setSize: resize, shadowMap: {} };
}
