import * as THREE from 'three';
import { createRenderer, CamCtrl } from './render.js';
import { buildWorld } from './world.js';
import { FX } from './fx.js';
import { Fighter, DEFS, CD_MAX } from './fighter.js';
import { AI, DIFFS } from './ai.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import * as Audio from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const R = createRenderer(canvas);
const scene = new THREE.Scene();
const world = buildWorld(scene);
const fx = new FX(scene);
const cam = new CamCtrl(R.camera, world);
const hud = new HUD();
fx.camQuat = R.camera.quaternion;

const G = {
  scene, world, fx, state: 'title', projectiles: [], fallers: [], vfx: [], events: [], camera: R.camera,
  hitstopT: 0, flashV: 0, flashCol: [1, 1, 1], slow: 0,
  sfx: Audio.sfx,
  shake(v) { cam.shake = Math.min(1.4, Math.max(cam.shake, v)); },
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); },
  flash(v, col = [1, 1, 1]) { this.flashV = v; this.flashCol = col; },
  floater(text, x, y, z, color) { hud.floater(text, x, y, z, color, R.camera); },
  after(delay, fn) { this.events.push({ t: delay, fn }); },
};

const player = new Fighter(G, DEFS.luna, true);
const enemy = new Fighter(G, DEFS.ember, false);
player.foe = enemy; enemy.foe = player;
const ai = new AI(enemy, G, 'normal');
hud.setNames(player, enemy);

const SPAWN = { p: [0, 11.5], e: [0, -11] };
const NEED = 2, ROUND_TIME = 60;
const game = { diff: 'normal', round: 1, wins: [0, 0], timer: ROUND_TIME, stateT: 0, paused: false, introStep: 0 };
window.__game = { G, game, player, enemy, cam, ai, R, scene };

function clearEntities() {
  G.projectiles.forEach((p) => p.dispose()); G.projectiles.length = 0;
  G.fallers.forEach((p) => p.dispose()); G.fallers.length = 0;
  G.vfx.forEach((p) => p.dispose()); G.vfx.length = 0;
  G.events.length = 0; fx.clear();
}
function startRound() {
  clearEntities();
  player.reset(SPAWN.p[0], SPAWN.p[1], Math.PI); enemy.reset(SPAWN.e[0], SPAWN.e[1], 0);
  ai.reset(); hud.resetBars();
  cam.yaw = 0; cam.manualT = 0; cam.lock = true; cam.focus.set(player.x, 2, player.z);
  game.timer = ROUND_TIME; G.state = 'intro'; game.stateT = 0; game.introStep = 0; G.slow = 0;
  hud.setPips(game.wins[0], game.wins[1], NEED);
  hud.setRound(`ROUND ${game.round} · ${DIFFS[game.diff].name}`);
  hud.setTimer(ROUND_TIME);
  hud.banner(`ROUND ${game.round}`, '#ffe45a', 1.1);
  hud.hint('');
}
function newMatch() {
  game.round = 1; game.wins = [0, 0];
  hud.screen('title', false); hud.screen('result', false);
  startRound();
}
function endRound(winner) { // 0 玩家 1 电脑 -1 平
  G.state = 'ko'; game.stateT = 0;
  if (winner >= 0) game.wins[winner]++;
  hud.setPips(game.wins[0], game.wins[1], NEED);
  const timeUp = !player.dead && !enemy.dead;
  hud.banner(timeUp ? 'TIME UP' : 'K.O.!', timeUp ? '#59c8ff' : '#ff4a4a', 2, false, true);
  const w = winner === 0 ? player : winner === 1 ? enemy : null;
  G.after(1.0, () => { if (w && !w.dead) w.winPose = true; if (w) Audio.sfx(winner === 0 ? 'win' : 'lose'); });
  G.slow = 0.35; G.after(0.6, () => (G.slow = 0));
}
function afterRound() {
  if (game.wins[0] >= NEED || game.wins[1] >= NEED) {
    G.state = 'result';
    const win = game.wins[0] >= NEED;
    $('resT').textContent = win ? 'YOU WIN!' : 'YOU LOSE...';
    $('resS').textContent = win ? '星光与彩虹属于你！' : '再接再厉，换个走位试试？';
    hud.screen('result', true); hud.clearBanner();
  } else { game.round++; startRound(); }
}
function toTitle() {
  G.state = 'title'; hud.screen('result', false); hud.screen('title', true); hud.clearBanner(); clearEntities();
  player.reset(-3, 6, 0.6); enemy.reset(3, 4, -0.6); cam.focus.set(0, 2, 5);
}

// ---- 标题画面小头像 ----
function portrait(id, def) {
  const c = $(id).getContext('2d'), h = (n) => '#' + n.toString(16).padStart(6, '0');
  const r = (x, y, w, hh, col) => { c.fillStyle = h(col); c.fillRect(x, y, w, hh); };
  c.clearRect(0, 0, 48, 48);
  r(10, 12, 28, 26, def.skin); r(8, 8, 32, 8, def.hair); r(8, 12, 4, 22, def.hair); r(36, 12, 4, 22, def.hair);
  r(12, 14, 6, 6, def.hair); r(20, 14, 8, 4, def.hair); r(30, 14, 6, 6, def.hair);
  r(4, 0, 8, 10, def.hair); r(36, 0, 8, 10, def.hair); r(6, 4, 4, 5, 0xffa6c8); r(38, 4, 4, 5, 0xffa6c8);
  r(15, 24, 6, 8, 0x1a1426); r(27, 24, 6, 8, 0x1a1426); r(16, 25, 4, 6, def.eye); r(28, 25, 4, 6, def.eye);
  r(17, 25, 2, 2, 0xffffff); r(29, 25, 2, 2, 0xffffff);
  r(11, 33, 5, 2, 0xff8aa0); r(32, 33, 5, 2, 0xff8aa0); r(22, 35, 4, 2, 0x7a2a3a);
  r(8, 40, 32, 8, def.top); r(8, 38, 32, 4, def.scarf);
}
portrait('cv1', DEFS.luna); portrait('cv2', DEFS.ember);
hud.setDiff(DIFFS[game.diff].name);

// ---- 输入 ----
function playerInput() {
  const inp = { mx: 0, mz: 0, jump: false, a1: false, a2: false, a3: false };
  if (G.state !== 'fight') return inp;
  if (game.force) { const f = game.force; game.force = null; return { ...inp, ...f }; }
  const iy = (Input.held('KeyW', 'ArrowUp') ? 1 : 0) - (Input.held('KeyS', 'ArrowDown') ? 1 : 0);
  const ix = (Input.held('KeyD') ? 1 : 0) - (Input.held('KeyA') ? 1 : 0);
  const l = Math.hypot(ix, iy);
  if (l > 0) {
    const [fx_, fz_] = cam.fwd, [rx, rz] = cam.right;
    inp.mx = (fx_ * iy + rx * ix) / l; inp.mz = (fz_ * iy + rz * ix) / l;
  }
  inp.jump = Input.take('Space'); inp.a1 = Input.take('KeyJ'); inp.a2 = Input.take('KeyK'); inp.a3 = Input.take('KeyL');
  return inp;
}

function handleGlobalKeys() {
  if (Input.hit('KeyM')) Audio.toggleMute();
  if (G.state === 'title') {
    for (const [k, d] of [['Digit1', 'easy'], ['Digit2', 'normal'], ['Digit3', 'hard']]) {
      if (Input.hit(k)) { game.diff = d; ai.setDiff(d); hud.setDiff(DIFFS[d].name); Audio.initAudio(); Audio.sfx('ui'); }
    }
    if (Input.hit('Enter')) { Audio.initAudio(); Audio.sfx('ui'); newMatch(); }
  } else if (G.state === 'result') {
    if (Input.hit('Enter')) { Audio.sfx('ui'); newMatch(); }
    if (Input.hit('Escape')) toTitle();
  } else {
    if (Input.hit('KeyP', 'Escape')) { game.paused = !game.paused; hud.screen('pause', game.paused); }
    if (Input.hit('Tab')) { cam.lock = !cam.lock; hud.hint(cam.lock ? '视角锁定：开' : '视角锁定：关'); setTimeout(() => hud.hint(''), 1200); }
  }
}

// ---- 逻辑步进 ----
function step(dt) {
  game.stateT += dt;
  world.update(dt, performance.now() / 1000, fx);
  if (G.state === 'intro') {
    if (game.introStep === 0 && game.stateT > 0.9) { game.introStep = 1; hud.banner('FIGHT!', '#ff5a5a', 0.8); Audio.sfx('fight'); }
    if (game.stateT > 1.25) G.state = 'fight';
  } else if (G.state === 'fight') {
    game.timer -= dt; hud.setTimer(game.timer);
    if (player.dead || enemy.dead) endRound(player.dead && enemy.dead ? -1 : player.dead ? 1 : 0);
    else if (game.timer <= 0) endRound(player.hp === enemy.hp ? -1 : player.hp > enemy.hp ? 0 : 1);
  } else if (G.state === 'ko') {
    if (game.stateT > 3.4) afterRound();
  }
  for (let i = G.events.length - 1; i >= 0; i--) { const e = G.events[i]; e.t -= dt; if (e.t <= 0) { G.events.splice(i, 1); e.fn(); } }

  const pin = playerInput();
  const ein = G.state === 'fight' ? ai.think(dt) : { mx: 0, mz: 0 };
  player.update(dt, pin); enemy.update(dt, ein);
  for (let i = G.projectiles.length - 1; i >= 0; i--) { const p = G.projectiles[i]; p.update(dt); if (p.dead) G.projectiles.splice(i, 1); }
  for (let i = G.fallers.length - 1; i >= 0; i--) { const p = G.fallers[i]; p.update(dt); if (p.dead) G.fallers.splice(i, 1); }
  for (let i = G.vfx.length - 1; i >= 0; i--) { const p = G.vfx[i]; p.update(dt); if (p.dead) G.vfx.splice(i, 1); }
  fx.update(dt);
}

// ---- 主循环 ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  handleGlobalKeys();
  let dt = raw;
  if (!game.paused) {
    if (G.hitstopT > 0) { G.hitstopT -= raw; dt = 0; } else if (G.slow) dt = raw * G.slow;
    if (dt > 0) step(dt); else world.update(0, performance.now() / 1000, fx);
    hud.update(raw, player, enemy, CD_MAX);

    const menu = G.state === 'title' || G.state === 'result';
    if (menu) cam.yaw += 0.18 * raw;
    const camRot = (Input.held('KeyE', 'ArrowRight') ? 1 : 0) - (Input.held('KeyQ', 'ArrowLeft') ? 1 : 0);
    cam.update(raw, player, menu ? null : enemy, menu ? 0 : camRot);
    G.flashV = Math.max(0, G.flashV - 2.2 * raw);
    R.setFlash(G.flashV, G.flashCol);
  }
  R.render(scene);
  Input.endFrame();
}

// 调试：确定性推进（截图测试用）
window.__game.advance = (sec, force) => {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    if (force && i === 0) game.force = force;
    if (G.hitstopT > 0) { G.hitstopT -= 1 / 60; world.update(0, 0, fx); } else step(G.slow ? (1 / 60) * G.slow : 1 / 60);
    hud.update(1 / 60, player, enemy, CD_MAX);
    cam.update(1 / 60, player, enemy, 0);
    G.flashV = Math.max(0, G.flashV - 2.2 / 60);
  }
};
window.__game.start = newMatch;
toTitle();
hud.setPips(0, 0, NEED);
requestAnimationFrame(frame);
