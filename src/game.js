import * as T from 'three';
import { buildCity, CELL, EDGE } from './city.js';
import { createSky } from './sky.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { SUITS } from './hero.js';
import { createAudio } from './audio.js';
import { createSoftwareRenderer } from './software.js';
import './style.css';

const $ = id => document.getElementById(id);
const STORAGE = 'skyline-web-of-the-city-v1';
const clamp = T.MathUtils.clamp;
const labels = {
  pause: 'Pause', controls: 'Steuerung', settings: 'Einstellungen', suits: 'Anzüge', missions: 'Missionen',
};
const controls = [
  ['Bewegen', 'W A S D'], ['Springen / Lufttrick / Netzabsprung', 'LEERTASTE'], ['Sprinten / schneller klettern', 'SHIFT'],
  ['Netz befestigen / loslassen', 'LINKE / RECHTE MAUSTASTE HALTEN'], ['Umsehen', 'MITTLERE MAUSTASTE ZIEHEN / PFEILE'],
  ['Klettern', 'GEGEN EINE WAND LAUFEN'], ['Interagieren', 'E'], ['Schlagen / Luftangriff', 'X'], ['Treten', 'V'],
  ['Ausweichen', 'Q'], ['Netzangriff / Entwaffnen', 'R'], ['Spezialimpuls', 'F'], ['Kamera wechseln', 'C'], ['Missionen / Pause', 'M / ESC'],
];

function readSave() {
  const fallback = { xp: 0, done: [], suit: 0, volume: .55, graphics: 'low', cycle: true };
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE));
    if (!data || typeof data !== 'object') return fallback;
    return {
      xp: Number.isSafeInteger(data.xp) ? clamp(data.xp, 0, 100000) : 0,
      done: Array.isArray(data.done) ? data.done.filter(id => typeof id === 'string') : [],
      suit: Number.isInteger(data.suit) && SUITS[data.suit] ? data.suit : 0,
      volume: typeof data.volume === 'number' ? clamp(data.volume, 0, 1) : .55,
      graphics: data.graphics === 'low' ? 'low' : 'high', cycle: data.cycle !== false
    };
  } catch { return fallback; }
}

function init() {
  const canvas = $('view'), frame = $('game'), menu = $('menu');
  const scene = new T.Scene(), updateSky = createSky(scene), city = buildCity(scene), audio = createAudio();
  const player = createPlayer(scene, city, audio.effect);
  const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
  const renderer = gl ? new T.WebGLRenderer({ canvas, context: gl }) : createSoftwareRenderer(canvas, city, player);
  if (gl) {
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
  }
  const camera = player.camera;
  const save = readSave();
  const keys = new Set(), aim = new T.Vector2(), markerVector = new T.Vector3(), eyeDirection = new T.Vector3();
  const map = $('map').getContext('2d');
  const ui = Object.fromEntries(['level','healthText','healthBar','xpBar','xpText','combo','missionName','missionHint','missionDistance','waypoint','clock','speed','cameraMode','toast','webL','webR','special','tip'].map(id => [id, $(id)]));
  const step = 1 / 90;
  let playing = false, health = 100, carrying = false, time = 0, previous = 0, accum = 0;
  let messageUntil = 0, shake = 0, combo = 0, comboUntil = 0, cooldown = 0, attackWait = 0, lastDamage = -10, hudTick = 0;
  let dragging = false, touchLook = null, lookX = 0, lookY = 0, tipUntil = 0;
  const level = () => Math.min(8, 1 + Math.floor(save.xp / 120));
  function persist() { try { localStorage.setItem(STORAGE, JSON.stringify(save)); } catch {} }
  function message(text) { ui.toast.textContent = text; messageUntil = time + 3.1; }
  function reward(xp) {
    const old = level(); save.xp += xp; health = Math.min(100, health + 30); persist(); audio.effect('reward');
    if (level() > old) tipUntil = time + 7;
  }
  function damage(amount) {
    if (player.dodging || time - lastDamage < .45) return;
    lastDamage = time; health -= amount; shake = .72; audio.effect('danger');
    if (health <= 0) {
      missions.clear(); player.reset(); carrying = false; health = 100; combo = 0;
      message('Zurück am letzten sicheren Punkt. Die Mission kann erneut gestartet werden.');
    }
  }
  const missions = createMissions(scene, city, save, { reward, damage, message, carry: value => { carrying = value; } });
  if (SUITS[save.suit].level > level()) save.suit = 0;
  player.setSuit(save.suit); audio.volume(save.volume);
  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, save.graphics === 'low' ? 1 : 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();
  }
  function graphics() { renderer.shadowMap.enabled = save.graphics === 'high'; resize(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  graphics();

  function clearInputs() {
    keys.clear(); player.release(0); player.release(1); dragging = false; touchLook = null;
  }
  function start() {
    audio.open(); playing = true; $('start').hidden = true; $('hud').hidden = false;
    frame.classList.add('playing'); tipUntil = time + 15; closePanel(); canvas.focus();
  }
  function home() {
    playing = false; $('start').hidden = false; $('hud').hidden = true;
    frame.classList.remove('playing'); closePanel();
  }
  function closePanel() { if (menu.open) menu.close(); }
  function button(text, sub, action, disabled = false) {
    const b = document.createElement('button'), title = document.createElement('strong');
    title.textContent = text; b.append(title); b.disabled = disabled;
    if (sub) { const small = document.createElement('small'); small.textContent = sub; b.append(small); }
    b.addEventListener('click', action); return b;
  }
  function openPanel(name) {
    if (!labels[name]) return;
    audio.open(); clearInputs();
    const content = $('panelContent');
    $('panelTitle').textContent = labels[name];
    content.replaceChildren(); content.className = ['pause', 'missions', 'suits'].includes(name) ? 'panel-menu' : '';
    if (name === 'pause') {
      content.append(button('Weiterspielen', '', closePanel), button('Missionen', 'Ziele wählen und markieren', () => openPanel('missions')),
        button('Anzüge', 'Anzug wechseln und neue Designs freischalten', () => openPanel('suits')),
        button('Einstellungen', '', () => openPanel('settings')), button('Steuerung', '', () => openPanel('controls')),
        button('Hauptmenü', 'Der Fortschritt bleibt gespeichert.', home));
    }
    if (name === 'controls') {
      for (const [action, key] of controls) {
        const line = document.createElement('div'), caption = document.createElement('kbd');
        line.className = 'control-row'; caption.textContent = key; line.append(action, caption); content.append(line);
      }
    }
    if (name === 'settings') {
      content.innerHTML = '<label class="setting">Lautstärke <output id="volumeRead"></output><input aria-label="Lautstärke" id="volume" type="range" min="0" max="100"></label><label class="setting">Schatten und Auflösung <select id="graphics"><option value="high">Hoch</option><option value="low">Leistung</option></select></label><label class="setting">Tag-Nacht-Wechsel <input id="cycle" type="checkbox"></label>';
      const volume = $('volume'), value = $('volumeRead');
      volume.value = Math.round(save.volume * 100); value.value = volume.value + '%';
      volume.addEventListener('input', () => { save.volume = +volume.value / 100; value.value = volume.value + '%'; audio.volume(save.volume); persist(); });
      $('graphics').value = save.graphics;
      $('graphics').addEventListener('change', e => { save.graphics = e.target.value; graphics(); persist(); });
      $('cycle').checked = save.cycle;
      $('cycle').addEventListener('change', e => { save.cycle = e.target.checked; persist(); });
    }
    if (name === 'suits') {
      for (const [i, suit] of SUITS.entries()) {
        const unlocked = level() >= suit.level;
        const b = button(suit.name + (save.suit === i ? ' · Aktiv' : ''), unlocked ? 'Anlegen' : `Freischaltung auf Level ${suit.level}`, () => {
          save.suit = i; player.setSuit(i); persist(); openPanel('suits');
        }, !unlocked || save.suit === i);
        b.style.borderLeft = '4px solid #' + suit.primary.toString(16).padStart(6, '0'); content.append(b);
      }
    }
    if (name === 'missions') {
      for (const m of missions.targets) {
        const complete = missions.done(m);
        content.append(button(`${m.name} · ${complete ? 'Erledigt' : m.label}`, m.detail, () => {
          missions.select(m.id); closePanel(); message('Ziel markiert: ' + m.name);
        }, complete || !!missions.active));
      }
      if (missions.active) content.append(button('Aktuelle Mission abbrechen', 'Du kannst sie später erneut starten.', () => {
        missions.clear(); carrying = false; closePanel(); message('Mission abgebrochen');
      }));
    }
    if (!menu.open) menu.showModal();
  }
  $('play').addEventListener('click', start);
  $('closePanel').addEventListener('click', closePanel);
  document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.panel)));
  function strike(kind) {
    if (attackWait > 0 || (kind === 'special' && cooldown > 0)) return;
    if (kind === 'special') { cooldown = Math.max(4, 11 - level()); shake = .65; audio.effect('special'); }
    if (kind === 'web') audio.effect('web');
    attackWait = kind === 'web' || kind === 'special' ? .38 : .26;
    if (kind === 'punch' && !player.ground) kind = 'jump';
    if (kind === 'punch' && combo >= 2 && level() >= 3) kind = 'kick';
    player.attack(kind);
    if (missions.attack(kind, player.pos, player.facing, level() * 2)) {
      combo++; comboUntil = time + 2.5; audio.effect('hit'); shake = Math.max(shake, .25);
    }
  }
  function action(code) {
    if (code === 'Space') player.jump();
    if (code === 'KeyE') missions.interact(player.pos);
    if (code === 'KeyQ') player.evade();
    if (code === 'KeyF') strike('special');
    if (code === 'KeyX') strike('punch');
    if (code === 'KeyV') strike('kick');
    if (code === 'KeyR') strike('web');
    if (code === 'KeyC') player.toggleCamera();
    if (code === 'KeyM') openPanel('missions');
  }
  document.addEventListener('keydown', e => {
    if (!playing || menu.open) return;
    if (e.code === 'Escape') { e.preventDefault(); openPanel('pause'); return; }
    if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) action(e.code);
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  const canPlay = () => playing && !menu.open;
  function web(index, target = null) {
    if (!player.attach(index, target)) message('Kein hoher Anker in Reichweite · näher an ein Gebäude springen');
  }
  canvas.tabIndex = -1;
  canvas.addEventListener('contextmenu', e => { if (playing) e.preventDefault(); });
  canvas.addEventListener('pointerdown', e => {
    if (!canPlay() || (e.pointerType !== 'touch' && e.button !== 1)) return;
    e.preventDefault(); canvas.focus(); canvas.setPointerCapture(e.pointerId);
    dragging = true; touchLook = e.pointerId; lookX = e.clientX; lookY = e.clientY;
  });
  // Mouse down/up are emitted for each button, even when both are held.
  canvas.addEventListener('mousedown', e => {
    if (!canPlay() || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault(); canvas.focus();
    const rect = canvas.getBoundingClientRect();
    aim.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    web(e.button === 2 ? 1 : 0, aim);
  });
  window.addEventListener('mouseup', e => { if (e.button === 0 || e.button === 2) player.release(e.button === 2 ? 1 : 0); });
  canvas.addEventListener('pointermove', e => {
    if (canPlay() && dragging && touchLook === e.pointerId) {
      player.turn(e.clientX - lookX, e.clientY - lookY); lookX = e.clientX; lookY = e.clientY;
    }
  });
  canvas.addEventListener('pointerup', e => { if (touchLook === e.pointerId) { dragging = false; touchLook = null; } });
  canvas.addEventListener('pointercancel', clearInputs);
  window.addEventListener('blur', clearInputs);
  document.querySelectorAll('.touch button').forEach(b => {
    b.addEventListener('pointerdown', e => {
      if (!canPlay()) return;
      e.preventDefault(); b.setPointerCapture(e.pointerId);
      if (b.dataset.web !== undefined) web(Number(b.dataset.web));
      else { keys.add(b.dataset.key); action(b.dataset.key); }
    });
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(kind, () => {
      if (b.dataset.web !== undefined) player.release(Number(b.dataset.web)); else keys.delete(b.dataset.key);
    });
  });

  function drawMap(objective) {
    const p = player.pos, span = 150, scale = 160 / span;
    const x = w => (w - p.x) * scale + 80, y = w => (w - p.z) * scale + 80;
    map.fillStyle = '#111624'; map.fillRect(0, 0, 160, 160);
    map.fillStyle = '#263243';
    for (let i = -6; i <= 6; i++) {
      map.fillRect(x((i + .5) * CELL - 4), 0, 8 * scale, 160);
      map.fillRect(0, y((i + .5) * CELL - 4), 160, 8 * scale);
    }
    map.fillStyle = '#344d66'; map.fillRect(x(EDGE), 0, 160, 160);
    map.fillStyle = '#575265';
    for (const b of city.near(p.x, p.z, 105)) map.fillRect(x(b.x - b.w / 2), y(b.z - b.d / 2), b.w * scale, b.d * scale);
    for (const target of missions.targets) {
      if (missions.done(target)) continue;
      map.fillStyle = '#d7ba94'; map.fillRect(x(target.x) - 2, y(target.z) - 2, 4, 4);
    }
    if (objective) {
      map.save(); map.translate(clamp(x(objective.x), 7, 153), clamp(y(objective.z), 7, 153)); map.rotate(Math.PI / 4);
      map.fillStyle = '#96f4ed'; map.fillRect(-4, -4, 8, 8); map.restore();
    }
    map.save(); map.translate(80, 80); map.rotate(Math.atan2(player.facing.x, -player.facing.z));
    map.fillStyle = '#ff5874'; map.beginPath(); map.moveTo(0, -8); map.lineTo(5, 5); map.lineTo(0, 2); map.lineTo(-5, 5); map.fill(); map.restore();
  }
  function updateHUD(speed, guide) {
    ui.level.textContent = `LEVEL ${String(level()).padStart(2, '0')}`;
    ui.healthText.textContent = `${health} / 100`; ui.healthBar.value = health;
    ui.xpText.textContent = level() === 8 ? `${save.xp} EP · MAX` : `${save.xp % 120} / 120 EP`;
    ui.xpBar.value = level() === 8 ? 120 : save.xp % 120; ui.combo.textContent = combo > 1 ? `×${combo}` : '';
    ui.speed.textContent = String(Math.round(speed * 3.6)).padStart(3, '0'); ui.cameraMode.textContent = player.cameraName;
    ui.webL.classList.toggle('on', !!player.ropes[0]); ui.webR.classList.toggle('on', !!player.ropes[1]);
    ui.special.classList.toggle('on', cooldown <= 0); ui.special.lastElementChild.textContent = cooldown > 0 ? `${Math.ceil(cooldown)}s` : 'IMPULS';
    ui.missionName.textContent = guide.name; ui.missionHint.textContent = guide.hint;
    ui.missionDistance.textContent = guide.distance === null ? '' : `${guide.distance} m · M für Übersicht`;
    const t = (6 * 60 + (save.cycle ? Math.floor(time / 108 * 1440) : 0)) % 1440;
    ui.clock.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    ui.tip.hidden = time > tipUntil && !player.wall;
    ui.tip.textContent = player.wall ? 'W halten: klettern · SPACE: von der Wand abspringen' : 'WASD bewegen · SPACE springen · MAUS halten zum Schwingen';
    if (messageUntil < time) ui.toast.textContent = '';
    drawMap(guide.objective);
  }
  function waypoint(guide) {
    if (!guide.objective) { ui.waypoint.hidden = true; return; }
    markerVector.copy(guide.objective); markerVector.y += 3.7;
    camera.getWorldDirection(eyeDirection);
    const front = eyeDirection.dot(markerVector.clone().sub(camera.position)) > 0;
    markerVector.project(camera);
    ui.waypoint.hidden = !front || Math.abs(markerVector.x) > .94 || Math.abs(markerVector.y) > .91;
    if (!ui.waypoint.hidden) {
      ui.waypoint.style.left = `${(markerVector.x * .5 + .5) * 100}%`;
      ui.waypoint.style.top = `${(.5 - markerVector.y * .5) * 100}%`;
      ui.waypoint.lastElementChild.textContent = `${guide.distance} m`;
    }
  }
  function loop(now) {
    const dt = Math.min(.055, (now - (previous || now)) / 1000);
    previous = now;
    const running = canPlay();
    if (running || !playing) time += dt;
    if (running) {
      accum += dt;
      while (accum >= step) {
        player.physics(step, keys, level(), carrying); missions.update(step, time, player.pos); accum -= step;
      }
      cooldown = Math.max(0, cooldown - dt); attackWait = Math.max(0, attackWait - dt);
      if (comboUntil < time) combo = 0;
      shake = Math.max(0, shake - dt * 2);
    } else accum = 0;
    player.render(dt, time, !playing, shake);
    const day = updateSky(time, player.pos, camera.position, save.cycle);
    city.update(playing && !running ? 0 : dt, time, day);
    const speed = player.velocity.length();
    audio.update(speed, player.pos.y, !running);
    if (running) {
      const guide = missions.guide(player.pos);
      if (time >= hudTick) { updateHUD(speed, guide); hudTick = time + .095; }
      waypoint(guide);
    }
    renderer.render(scene, camera, day);
    requestAnimationFrame(loop);
  }
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); clearInputs(); home(); $('boot').hidden = false; $('boot').textContent = 'Die 3D-Grafik wurde unterbrochen. Lade die Seite neu.';
    $('play').disabled = true;
  });
  document.querySelectorAll('#play, #start [data-panel]').forEach(b => { b.disabled = false; });
  $('boot').hidden = true;
  requestAnimationFrame(loop);
}
try { init(); }
catch (error) {
  console.error(error);
  $('boot').textContent = 'Die 3D-Welt konnte nicht geladen werden. Prüfe, ob die Grafik im Browser verfügbar ist, und lade die Seite neu.';
}
