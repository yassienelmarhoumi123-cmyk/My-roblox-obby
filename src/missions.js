import * as T from 'three';
import { mesh } from './city.js';

export const missions = [
  { id: 'crime', name: 'Ärger im Park', label: 'VERBRECHEN', x: 9, z: 10, detail: 'Stoppe die drei Verdächtigen im Skyline Park.', xp: 150, type: 'fight' },
  { id: 'rescue', name: 'Über den Dächern', label: 'RETTUNG', x: 64, z: 0, roof: true, detail: 'Bring eine eingeschlossene Person vom Dach zum Skyline Park.', xp: 120, type: 'rescue' },
  { id: 'chase', name: 'Flucht Richtung Hafen', label: 'VERFOLGUNG', x: 32, z: -79, detail: 'Hol die flüchtende Drohne ein und stoppe sie mit einem Netzangriff.', xp: 150, type: 'chase' },
  { id: 'cache', name: 'Verlorene Technik', label: 'SUCHAUFTRAG', x: -171, z: -128, detail: 'Sammle drei Sender im Westviertel ein.', xp: 130, type: 'hunt' },
  { id: 'race', name: 'Lichter der Stadt', label: 'ZEITRENNEN', x: -64, z: 64, roof: true, detail: 'Durchfliege alle Kontrollpunkte in unter 42 Sekunden.', xp: 180, type: 'race' },
  { id: 'patrol', name: 'Nachtpatrouille', label: 'PATROUILLE', x: 256, z: -256, detail: 'Sichere den Park im Geschäftsviertel gegen vier Gegner.', xp: 160, type: 'fight' }
];

const enemyBox = new T.BoxGeometry();
const enemyHead = new T.SphereGeometry(.24, 10, 8);
const cyan = new T.MeshBasicMaterial({ color: 0x7cf5f0 });
const gold = new T.MeshBasicMaterial({ color: 0xffcb86 });
const violet = new T.MeshBasicMaterial({ color: 0xb690ff });
const metal = new T.MeshStandardMaterial({ color: 0x293049 });
const outline = new T.MeshStandardMaterial({ color: 0xbc5066 });
const halo = new T.TorusGeometry(2.35, .095, 7, 28);
const direction = new T.Vector3();
const v = (x, y, z) => new T.Vector3(x, y, z);

export function createMissions(scene, city, save, events) {
  const targets = missions.map(m => {
    const roof = m.roof ? city.near(m.x, m.z)[0]?.h ?? 0 : .3;
    const p = v(m.x, roof + .4, m.z);
    const beacon = new T.Group(); beacon.position.copy(p); scene.add(beacon);
    mesh(beacon, halo, cyan, 0, .06, 0).rotation.x = Math.PI / 2;
    mesh(beacon, new T.OctahedronGeometry(.9), cyan, 0, 3.1, 0);
    return { ...m, p, beacon };
  });
  let active = null, selected = 'crime';
  const enemies = [], objects = [];
  let drop = null, drone = null;
  let nextEvent = 50;
  const done = target => save.done.includes(target.id);
  const current = () => targets.find(m => m.id === selected);
  function refresh() {
    for (const m of targets) m.beacon.visible = !active && !done(m);
  }
  function clear() {
    for (const o of objects) scene.remove(o.mesh);
    for (const enemy of enemies) scene.remove(enemy.body);
    objects.length = 0; enemies.length = 0; drop = null; drone = null; active = null; refresh();
  }
  function finish(text) {
    const { id, xp, name } = active;
    if (id !== 'event' && !save.done.includes(id)) save.done.push(id);
    events.reward(xp); clear(); events.message(text || `${name} abgeschlossen · +${xp} EP`);
    if (current() && done(current())) selected = targets.find(m => !done(m))?.id;
  }
  function object(p, geometry, material) {
    const shape = mesh(scene, geometry, material, p.x, p.y, p.z);
    const item = { p, mesh: shape }; objects.push(item); return item;
  }
  function spawnEnemy(x, z, i) {
    const body = new T.Group(); body.position.set(x, .3, z); scene.add(body);
    mesh(body, enemyBox, outline, 0, 1.05, 0, .66, .79, .44);
    mesh(body, enemyHead, metal, 0, 1.7, 0);
    const legs = [-1, 1].map(s => mesh(body, enemyBox, metal, s * .17, .37, 0, .24, .72, .28));
    const weapon = mesh(body, enemyBox, gold, .41, .93, -.18, .13, .13, .55);
    weapon.visible = i % 2 === 1;
    enemies.push({ body, weapon, legs, hp: i % 2 ? 55 : 38, stun: 0, cooldown: i * .35, index: i });
  }
  function start(m) {
    active = { ...m, elapsed: 0, stage: 0 }; selected = m.id; refresh();
    if (m.type === 'fight') {
      const count = m.id === 'patrol' ? 4 : m.id === 'event' ? 2 : 3;
      for (let i = 0; i < count; i++) spawnEnemy(m.x + i * 2 - 2, m.z - 5 - (i % 2) * 2, i);
    }
    if (m.type === 'hunt') {
      for (const p of [v(-170, 1.1, -126), v(-160, 1.1, -151), v(-216, 1.1, -111)]) object(p, new T.IcosahedronGeometry(.75), gold);
    }
    if (m.type === 'rescue') {
      drop = object(v(0, 2.4, 0), halo, cyan); drop.mesh.rotation.x = Math.PI / 2;
      events.carry(true);
    }
    if (m.type === 'race') {
      const height = m.p.y;
      for (const p of [v(-32, height + 6, 46), v(-32, height + 3, -4), v(-32, 67, -61), v(32, 58, -90), v(80, 46, -96)]) {
        const ring = object(p, new T.TorusGeometry(7, .29, 8, 32), cyan);
        ring.mesh.rotation.y = objects.length >= 4 ? Math.PI / 2 : 0;
        ring.mesh.visible = objects.length === 1;
      }
    }
    if (m.type === 'chase') {
      drone = object(v(32, 5, -90), new T.OctahedronGeometry(1.1), violet);
      mesh(drone.mesh, enemyBox, metal, 0, .05, 0, 2.8, .16, .3);
    }
    events.message(m.name + ' gestartet');
  }
  function interact(p) {
    if (active) {
      if (drop && p.distanceTo(drop.p) < 5) { events.carry(false); finish('Person in Sicherheit · +120 EP'); return; }
      const item = active.type === 'hunt' && objects.find(o => o.mesh.visible && p.distanceTo(o.p) < 4);
      if (item) { item.mesh.visible = false; if (++active.stage === objects.length) finish(); else events.message('Sender geborgen'); }
      return;
    }
    const m = targets.find(m => !done(m) && m.p.distanceTo(p) < 6);
    if (m) start(m);
    else events.message('Keine Interaktion in Reichweite');
  }
  function attack(kind, player, forward, power) {
    if (drone && kind === 'web' && player.distanceTo(drone.p) < 24) { finish(); return true; }
    let hit = false;
    for (const enemy of enemies) {
      direction.copy(enemy.body.position).sub(player);
      const dist = direction.length(), reach = kind === 'special' ? 9 : kind === 'web' ? 19 : kind === 'jump' ? 4.7 : 4;
      if (enemy.hp <= 0 || dist > reach || (kind !== 'special' && dist > 2.4 && direction.normalize().dot(forward) < -.2)) continue;
      enemy.hp -= kind === 'special' ? 49 : kind === 'kick' ? 25 : kind === 'jump' ? 31 : kind === 'web' ? 10 : 19 + power;
      enemy.stun = kind === 'web' ? 3.4 + power * .1 : .45;
      if (kind === 'web') enemy.weapon.visible = false;
      if (enemy.hp <= 0) enemy.body.visible = false;
      hit = true;
      if (kind === 'punch' || kind === 'kick') break;
    }
    if (enemies.length && enemies.every(e => e.hp <= 0)) finish();
    return hit;
  }
  function update(dt, time, player) {
    for (const target of targets) {
      target.beacon.children[1].rotation.y = time * 1.4;
      target.beacon.children[1].position.y = 3.1 + Math.sin(time * 3) * .34;
    }
    if (!active) {
      if (time > nextEvent && player.y < 8 && Math.hypot(player.x, player.z) < 22 && done(targets[0])) {
        nextEvent = time + 65;
        start({ id: 'event', name: 'Notruf im Park', type: 'fight', x: 6, z: -8, p: v(6, 0, -8), xp: 65 });
      }
      return;
    }
    active.elapsed += dt;
    for (const o of objects) if (o !== drop && active.type !== 'race') o.mesh.rotation.y += dt * 1.9;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      enemy.stun = Math.max(0, enemy.stun - dt); enemy.cooldown -= dt;
      const p = enemy.body.position;
      direction.set(player.x - p.x, 0, player.z - p.z);
      const dist = direction.length(); enemy.body.rotation.y = Math.atan2(-direction.x, -direction.z);
      if (!enemy.stun && player.y < 4) {
        if (dist > 2 && dist < 23) {
          p.addScaledVector(direction.normalize(), dt * (enemy.index % 2 ? 2.3 : 3.8));
          enemy.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 12 + i * Math.PI) * .5; });
        }
        if (dist < (enemy.weapon.visible ? 3.2 : 2.25) && enemy.cooldown <= 0) {
          enemy.cooldown = 1.27; events.damage(enemy.weapon.visible ? 16 : 10);
        }
      }
    }
    if (active.type === 'race') {
      const target = objects[active.stage];
      if (player.distanceTo(target.p) < 7.2) {
        target.mesh.visible = false;
        if (++active.stage === objects.length) { finish(); return; }
        objects[active.stage].mesh.visible = true;
      }
      if (active.elapsed > 42) { clear(); events.message('Zeit abgelaufen. Das Rennen kann erneut gestartet werden.'); }
    }
    if (drone) {
      const t = active.elapsed;
      drone.p.set(32 + Math.sin(t * .7) * 2, 4 + Math.sin(t * 2) * .9, -90 - Math.min(t, 22) * 11);
      drone.mesh.position.copy(drone.p);
      if (t > 28) { clear(); events.message('Die Drohne ist entkommen. Versuch es erneut.'); }
    }
  }
  function guide(player) {
    if (active) {
      const objective = drop?.p ?? drone?.p ?? (active.type === 'race' ? objects[active.stage]?.p : objects.find(o => o.mesh.visible)?.p) ?? enemies.find(e => e.hp > 0)?.body.position ?? active.p;
      const distance = Math.round(player.distanceTo(objective));
      let hint = active.detail;
      if (active.type === 'race') hint = `Tor ${active.stage + 1}/5 · ${Math.ceil(42 - active.elapsed)} s`;
      if (active.type === 'hunt') hint = distance < 4 ? 'E · Sender aufnehmen' : `${active.stage}/3 Sender geborgen`;
      if (active.type === 'fight') hint = `${enemies.filter(e => e.hp > 0).length} Gegner · X Schlag / V Tritt / R Netz`;
      if (drop) hint = distance < 5 ? 'E · Person absetzen' : 'Person zum Park bringen';
      if (drone) hint = distance < 24 ? 'R · Drohne mit einem Netz stoppen' : 'Drohne einholen';
      return { name: active.name, hint, distance, objective };
    }
    const m = current();
    if (!m || done(m)) return { name: 'Freie Erkundung', hint: 'Die Stadt steht dir offen.', distance: null };
    const distance = Math.round(m.p.distanceTo(player));
    return { name: m.name, hint: distance < 6 ? 'E · Mission starten' : m.detail, distance, objective: m.p };
  }
  refresh();
  return { update, interact, guide, attack, clear, targets, done, get active() { return active; },
    select(id) { if (!active) selected = id; } };
}
