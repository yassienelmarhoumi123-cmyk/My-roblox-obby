import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { buildCity } from '../src/city.js';
import { createPlayer } from '../src/player.js';
import { createMissions } from '../src/missions.js';

// The procedural textures don't participate in simulation.
const noOp = () => {};
globalThis.document = { createElement: () => ({ getContext: () => ({
  fillRect: noOp, beginPath: noOp, moveTo: noOp, lineTo: noOp, quadraticCurveTo: noOp, stroke: noOp
}) }) };

const world = new T.Scene();
const city = buildCity(world);
const v = (x, y, z) => new T.Vector3(x, y, z);
const step = 1 / 90;
function simulate(player, seconds, ...keys) {
  for (let i = 0; i < seconds * 90; i++) player.physics(step, new Set(keys), 1, false);
}

test('player starts on a roof, runs, jumps and lands without sinking through it', () => {
  const player = createPlayer(world, city, noOp);
  const start = player.pos.clone();
  simulate(player, .5, 'KeyW');
  assert.ok(player.pos.z < start.z - 2);
  player.jump(); simulate(player, .35);
  assert.ok(player.pos.y > start.y + 1.3 && !player.ground);
  simulate(player, 1);
  assert.ok(player.ground && Math.abs(player.pos.y - start.y) < .12);
});

test('both webs find distinct building anchors and transfer momentum', () => {
  const player = createPlayer(world, city, noOp);
  const start = player.pos.clone();
  assert.equal(player.attach(0), true);
  assert.equal(player.attach(1), true);
  assert.ok(player.ropes[0].p.distanceTo(player.ropes[1].p) >= 8);
  simulate(player, .85, 'KeyW');
  assert.ok(player.pos.distanceTo(start) > 4 && player.velocity.length() > 10);
  player.release(0); assert.ok(player.ropes[1] && !player.ropes[0]);
  player.jump();
  assert.ok(player.ropes.every(r => r === null));
});

test('running into a wall climbs to the roof; the follow camera stays out of the building', () => {
  const player = createPlayer(world, city, noOp);
  const building = city.near(0, 64)[0];
  player.pos.set(0, .31, 64 + building.d / 2 + 1.4);
  simulate(player, 1, 'KeyW');
  assert.ok(player.wall && player.pos.y > 5);
  for (let i = 0; i < 1200 && !(player.ground && player.pos.y >= building.h); i++) simulate(player, step, 'KeyW', 'ShiftLeft');
  assert.ok(player.pos.y >= building.h && player.ground);
  player.toggleCamera();
  assert.equal(player.cameraName, 'NAH');
  player.render(1, 1, false, 0);
  const {x,y,z} = player.camera.position;
  assert.ok(y > building.h || Math.abs(x) > building.w/2 || Math.abs(z-64) > building.d/2);
});

test('crime encounter rewards XP once and selects the next available mission', () => {
  const save = { done: [], xp: 0 };
  const missions = createMissions(world, city, save, { reward: n => { save.xp += n; }, carry: noOp, message: noOp, damage: noOp });
  const p = v(9,.31,8);
  missions.interact(p); assert.equal(missions.active?.id, 'crime');
  assert.equal(missions.attack('special', p, v(0,0,-1), 2), true);
  assert.equal(missions.attack('special', p, v(0,0,-1), 2), true);
  assert.deepEqual(save, { done: ['crime'], xp: 150 });
  missions.interact(p); assert.equal(missions.active, null);
  assert.equal(missions.guide(p).name, 'Über den Dächern');
});

test('rescue, chase, hunt and time trial each have a complete progression', () => {
  const saved = { done: [], xp: 0 }, carried = [];
  const missions = createMissions(world, city, saved, { reward: n => { saved.xp += n; }, carry: n => carried.push(n), message: noOp, damage: noOp });
  function begin(id) { missions.interact(missions.targets.find(m => m.id === id).p); assert.equal(missions.active.id, id); }
  begin('rescue'); missions.interact(v(0,.31,0)); assert.deepEqual(carried, [true,false]);
  begin('chase'); assert.ok(missions.attack('web', v(32,5,-88), v(0,0,-1), 2));
  begin('cache'); for (const p of [v(-170,1,-126),v(-160,1,-151),v(-216,1,-111)]) {
    assert.equal(city.near(p.x, p.z, 1).some(b => Math.abs(p.x-b.x) < b.w/2 && Math.abs(p.z-b.z) < b.d/2), false);
    missions.interact(p);
  }
  begin('race');
  for (let i = 0; i < 5; i++) missions.update(step, 1, missions.guide(v(0,0,0)).objective);
  assert.deepEqual(saved, { done: ['rescue','chase','cache','race'], xp: 580 });
});
