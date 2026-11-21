import * as T from 'three';

export const CELL = 64, RADIUS = 6, EDGE = 416, ROAD = 17;
export const clamp = T.MathUtils.clamp;
export const random = (x, z, salt = 0) => {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 59.2) * 43758.5453;
  return n - Math.floor(n);
};

const box = new T.BoxGeometry();
const standard = (color, extra = {}) => new T.MeshStandardMaterial({ color, ...extra });
const flat = color => new T.MeshBasicMaterial({ color });
export const mesh = (parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m);
  return m;
};

function facade(style) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = ['#596278', '#4d6376', '#6f5c61', '#60657a'][style]; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 16) {
    g.fillStyle = '#181c32'; g.fillRect(0, y + 14, 128, 2);
    for (let x = 0; x < 128; x += 16) {
      const n = random(x, y, style);
      g.fillStyle = '#20263e'; g.fillRect(x + 2, y + 1, 12, 12);
      g.fillStyle = n > .76 ? (n > .91 ? '#fac285' : '#bdb9a5') : '#36485d';
      g.fillRect(x + 3, y + 2, 10, 9);
      g.fillStyle = n > .76 ? '#ffe0ad' : '#637c92'; g.fillRect(x + 3, y + 2, 10, 2);
      g.fillStyle = '#4b5264'; g.fillRect(x + 7, y + 2, 1, 9);
    }
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function buildCity(scene) {
  const rows = new Map(), buildings = [], cars = [], walkers = [];
  const concrete = standard(0x6c6c78), curb = standard(0x8e8790), roof = standard(0x353b50);
  const lane = standard(0x998c7a), cross = standard(0xb7afb2), asphalt = standard(0x343443);
  const leaves = standard(0x30615b), trunk = standard(0x544557), grass = standard(0x3d6258);
  const metal = standard(0x474f68), amber = flat(0xffcc8c), cyan = flat(0x94e8ed);
  const treeGeometry = new T.IcosahedronGeometry(1, 0);
  const faces = Array.from({ length: 4 }, (_, i) => {
    const tex = facade(i);
    return standard(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffcfa1, emissiveIntensity: .15, roughness: .55 });
  });
  function batch(mat, x, y, z, w, h, d, geo = box) {
    if (!rows.has(mat)) rows.set(mat, new Map());
    const parts = rows.get(mat);
    if (!parts.has(geo)) parts.set(geo, []);
    parts.get(geo).push([x, y, z, w, h, d]);
  }
  const parks = new Set(['0,0', '-3,-2', '2,3', '4,-4', '-4,3', '5,1']);
  const grid = new Map();
  const near = (x, z, radius = 0) => {
    const list = [];
    for (let ix = Math.round((x - radius) / CELL); ix <= Math.round((x + radius) / CELL); ix++) {
      for (let iz = Math.round((z - radius) / CELL); iz <= Math.round((z + radius) / CELL); iz++) {
        const b = grid.get(`${ix},${iz}`); if (b) list.push(b);
      }
    }
    return list;
  };
  const island = mesh(scene, box, asphalt, 0, -.6, 0, EDGE * 2, 1.2, EDGE * 2);
  island.receiveShadow = true;
  for (let i = -RADIUS; i <= RADIUS; i++) {
    for (let j = -RADIUS; j <= RADIUS; j++) {
      const x = i * CELL, z = j * CELL, key = `${i},${j}`;
      batch(concrete, x, .12, z, 47, .24, 47);
      batch(curb, x, .045, z, 47.4, .09, 47.4);
      if (parks.has(key)) {
        batch(grass, x, .23, z, 41, .17, 41);
        batch(concrete, x, .33, z, 4.3, .08, 41);
        batch(concrete, x, .33, z, 41, .08, 4.3);
        for (const a of [-1, 1]) for (const b of [-1, 1]) {
          for (let n = 0; n < 3; n++) {
            const tx = x + a * (7 + random(i, j, n + a) * 10), tz = z + b * (7 + n * 5);
            batch(trunk, tx, 1.55, tz, .45, 2.8, .45);
            batch(leaves, tx, 4, tz, 3.1, 3.8, 3.1, treeGeometry);
          }
          batch(metal, x + a * 17, .65, z + b * 3.5, 3.1, .65, .8);
        }
        if (key === '0,0') {
          batch(roof, x, .48, z, 9, .3, 9);
          batch(cyan, x, .65, z, 7.8, .09, 7.8);
          batch(roof, x, 1.05, z, 1.15, .9, 1.15);
        }
      } else {
        const central = 1 - Math.min(1, Math.hypot(i, j) / 8);
        const w = 24 + random(i, j, 1) * 17, d = 25 + random(i, j, 2) * 16;
        const h = Math.round(18 + random(i, j, 3) ** 1.5 * (60 + central * 98));
        const tower = { x, z, w, d, h, id: key };
        buildings.push(tower); grid.set(key, tower);
        const f = faces[Math.floor(random(i, j, 4) * faces.length)];
        batch(f, x, h / 2, z, w, h, d);
        batch(roof, x, h - .25, z, w + .6, .7, d + .6);
        batch(roof, x + w * .24, h + 1.3, z - d * .22, w * .27, 2.6, d * .29);
        if (h > 83) {
          batch(metal, x, h + 5, z, .52, 10, .52);
          batch(amber, x, h + 10, z, .83, .45, .83);
        }
        if ((i + j) % 3 === 0) {
          batch(metal, x, 2, z + d / 2 + .7, 8, 3.7, 1.5);
          batch(i % 2 ? cyan : amber, x, 3.4, z + d / 2 + 1.5, 6.7, .32, .13);
        }
      }
      for (const [dx, dz] of [[-21,-21],[21,21]]) {
        batch(metal, x + dx, 2.7, z + dz, .25, 5, .25);
        batch(metal, x + dx, 5.2, z + dz * .95, .32, .18, 2);
        batch(amber, x + dx, 5.06, z + dz * .93, .36, .13, .71);
      }
      if (i === RADIUS || j === RADIUS) continue;
      const gx = x + CELL / 2, gz = z + CELL / 2;
      for (let k = -3; k <= 3; k++) {
        batch(cross, gx + k * 1.9, .008, gz - 10, .82, .016, 2.5);
        batch(cross, gx - 10, .008, gz + k * 1.9, 2.5, .016, .82);
        batch(cross, gx + k * 1.9, .008, gz + 10, .82, .016, 2.5);
        batch(cross, gx + 10, .008, gz + k * 1.9, 2.5, .016, .82);
      }
      for (const t of [-19, -26, -34, -42, -49]) {
        batch(lane, gx, .009, gz + t, .15, .018, 3.2);
        batch(lane, gx + t, .009, gz, 3.2, .018, .15);
      }
      if (!((i + j) % 2)) {
        batch(metal, gx + 9, 2.1, gz + 9, .23, 4.2, .23);
        batch(metal, gx + 9, 4.1, gz + 9, .67, 1.25, .53);
        batch(amber, gx + 9, 4.28, gz + 8.71, .23, .25, .03);
      }
    }
  }
  // Riverside promenade, bridge and metro entrances.
  batch(concrete, 407, .3, 0, 15, .6, 824);
  batch(metal, 413.5, .95, 0, .2, .7, 824);
  batch(asphalt, 490, 3, -32, 159, .8, 16);
  for (const x of [444, 537]) {
    for (const z of [-40, -24]) batch(metal, x, 14, z, 2.5, 26, 2.5);
    batch(metal, x, 25, -32, 2.5, 2, 18);
  }
  for (let x = 421; x < 563; x += 4) for (const z of [-40, -24]) {
    const h = 3 + 20 * Math.max(Math.exp(-Math.abs(x - 444) / 16), Math.exp(-Math.abs(x - 537) / 16));
    batch(metal, x, 3 + h / 2, z, .24, h, .24);
  }
  for (const [x, z] of [[22,19], [106,-82], [-149,109]]) {
    batch(roof, x, .46, z, 3.5, .7, 6);
    batch(metal, x - 1.8, 1, z, .17, 1.8, 6);
    batch(metal, x + 1.8, 1, z, .17, 1.8, 6);
    batch(cyan, x, 1.9, z + 2.8, 3.7, .34, .25);
  }
  const matrix = new T.Matrix4();
  for (const [mat, geos] of rows) for (const [geo, values] of geos) {
    const group = new T.InstancedMesh(geo, mat, values.length);
    values.forEach(([x, y, z, w, h, d], i) => {
      matrix.makeScale(w, h, d); matrix.setPosition(x, y, z); group.setMatrixAt(i, matrix);
    });
    group.receiveShadow = true; group.castShadow = faces.includes(mat); scene.add(group);
  }
  for (let i = 0; i < 65; i++) {
    const car = new T.Group(), color = [0x993e50, 0x889db6, 0xb69a78, 0x2c475d, 0x513963][i % 5];
    const truck = i % 7 === 0;
    mesh(car, box, standard(color), 0, .69, 0, 2, .75, truck ? 4.8 : 3.8);
    mesh(car, box, standard(0x425977), 0, 1.2, truck ? .4 : .1, 1.7, truck ? 1.16 : .61, truck ? 3 : 2);
    for (const s of [-1, 1]) {
      mesh(car, box, amber, .65 * s, .73, -1.91, .35, .16, .05);
      for (const z of [-1.15, 1.15]) mesh(car, box, roof, s * .95, .38, z, .28, .64, .64);
    }
    const laneIndex = i % 22, order = Math.floor(i / 22);
    car.rotation.y = laneIndex >= 11 ? -Math.PI / 2 : 0;
    const p = -397 + order * 250 + random(laneIndex, 0) * 95;
    const road = ((laneIndex % 11) - 5) * 64 + 32 + (laneIndex >= 11 ? 3 : -3);
    scene.add(car); cars.push({ car, road, p, horizontal: laneIndex >= 11, speed: 10 + random(laneIndex, 0, 5) * 5 });
  }
  const personHead = new T.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 55; i++) {
    const person = new T.Group();
    mesh(person, personHead, standard(0xbaa18d), 0, 1.53, 0, .19, .23, .19);
    mesh(person, box, standard([0xb35565, 0x4b8699, 0xb69b63, 0x8078a9][i % 4]), 0, 1.01, 0, .41, .65, .29);
    const legs = [-1, 1].map(s => mesh(person, box, roof, s * .13, .39, 0, .15, .7, .17));
    scene.add(person); walkers.push({ person, legs, x: (i % 11 - 5) * 64 + 21, z: (Math.floor(i / 11) * 128 - 256) + random(i, 0) * 44, phase: random(i, 0, 3) * 6.28 });
  }

  const water = mesh(scene, new T.PlaneGeometry(485, 1250), new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, daylight: { value: 1 } },
    vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 p;uniform float time,daylight;void main(){
      float wave=sin(p.x*.45+sin(p.y*.19+time*.8)+time)*sin(p.y*.38-time*.66);
      float streak=pow(max(0.,sin(p.y*.16+p.x*.052+time*.4)*.6+wave*.4),5.);
      vec3 color=mix(vec3(.035,.06,.13),vec3(.18,.32,.41),daylight)+streak*vec3(.34,.21,.18)*daylight;
      gl_FragColor=vec4(color,1.);}`
  }), 658, -.25, 0);
  water.rotation.x = -Math.PI / 2;

  function update(dt, time, daylight) {
    water.material.uniforms.time.value = time;
    water.material.uniforms.daylight.value = daylight;
    for (const row of cars) {
      const { car, road, horizontal, speed } = row;
      const next = row.p + speed * dt;
      const intersection = Math.floor((row.p + 32) / 64) * 64 + 32;
      const stop = intersection - 11;
      const light = (time + Math.round(((horizontal ? intersection : road) - 32) / 64) * 1.7 + Math.round(((horizontal ? road : -intersection) - 32) / 64) * 1.7 + 32) % 16;
      const go = horizontal ? light > 9 && light < 15 : light < 7;
      const blocked = cars.some(other => other !== row && other.horizontal === horizontal && other.road === road && other.p > row.p && other.p - next < 7);
      if (!blocked) row.p = !go && row.p <= stop && next > stop ? stop : next;
      if (row.p > 413) row.p = -413;
      car.position.set(horizontal ? row.p : road, .04, horizontal ? road : -row.p);
    }
    for (const { person, legs, x, z, phase } of walkers) {
      const walk = Math.sin(time * .19 + phase);
      person.position.set(x, .24, z + walk * 18);
      person.rotation.y = Math.cos(time * .19 + phase) > 0 ? Math.PI : 0;
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 9 + phase + i * Math.PI) * .45; });
    }
  }
  return { buildings, near, update };
}
