// 角色：体素模型、动画、物理、三种技能
import * as THREE from 'three';
import { box } from './voxel.js';
import { RAINBOW, rand, angDiff, clamp } from './util.js';
import { StarShot, Faller, NovaRing, applyHit, BODY_H } from './skills.js';

export const RADIUS = 0.7;
const GRAV = 36, JUMP_V = 13, SPEED = 9.2;

export const DEFS = {
  luna: {
    id: 'luna', name: 'LUNA', cn: '月见', title: '星光猫耳少年',
    starCol: 0xffe45a, hud: '#59c8ff',
    skin: 0xffe0c4, hair: 0xe9f1ff, hair2: 0xb9cdf5, top: 0x2b3f9a, top2: 0x4663d6, pants: 0x1b2466, boots: 0xf2f6ff,
    scarf: 0x4fe0ff, eye: 0x36c6ff, accent: 0xffe45a,
  },
  ember: {
    id: 'ember', name: 'EMBER', cn: '炎狐', title: '烈焰狐耳少女',
    starCol: 0xff72d8, hud: '#ff8a4a',
    skin: 0xf6c9a0, hair: 0xc8312b, hair2: 0x8a1f27, top: 0xe5502d, top2: 0xff8a3d, pants: 0x3a2638, boots: 0x25202c,
    scarf: 0xffd35a, eye: 0xffc22e, accent: 0xff72d8,
  },
};

function buildModel(def) {
  const mats = [];
  const m = (hex) => { const mt = new THREE.MeshLambertMaterial({ color: hex, emissive: 0x000000 }); mats.push(mt); return mt; };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = { root, body };
  const isLuna = def.id === 'luna';
  const bw = isLuna ? 1.12 : 1.28;

  // 腿
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.32, 0.95, 0); body.add(leg);
    box(leg, m(def.pants), 0, -0.95, 0, 0.52, 0.95, 0.56);
    box(leg, m(def.boots), 0, -0.95, 0.03, 0.58, 0.42, 0.66);
    box(leg, m(def.accent), 0, -0.6, 0.03, 0.6, 0.1, 0.68);
    parts[s < 0 ? 'legL' : 'legR'] = leg;
  }
  // 躯干
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso); parts.torso = torso;
  box(torso, m(def.top), 0, 0, 0, bw, 1.0, 0.7);
  box(torso, m(def.top2), 0, 0.0, 0.01, bw + 0.06, 0.24, 0.74);          // 下摆
  box(torso, m(0x15152b), 0, 0.28, 0.01, bw + 0.08, 0.12, 0.74);          // 腰带
  box(torso, m(def.accent), 0, 0.26, 0.38, 0.22, 0.2, 0.06);
  if (isLuna) { // 星星徽章
    const g = m(0xffe45a);
    box(torso, g, 0, 0.55, 0.36, 0.5, 0.14, 0.06); box(torso, g, 0, 0.4, 0.36, 0.14, 0.5, 0.06);
    box(torso, m(0xffffff), 0, 0.6, 0.4, 0.14, 0.14, 0.04);
    // 兜帽
    box(torso, m(def.top2), 0, 0.88, -0.32, bw - 0.1, 0.3, 0.3);
  } else { // 毛领 + 肩甲
    box(torso, m(0xfff0dc), 0, 0.88, 0, bw + 0.2, 0.28, 0.9);
    for (const s of [-1, 1]) box(torso, m(0xffc23a), s * (bw / 2 + 0.28), 0.62, 0, 0.5, 0.3, 0.6);
    box(torso, m(0x2a1520), 0, 0.5, 0.37, 0.18, 0.5, 0.05); box(torso, m(0xffc23a), 0, 0.4, 0.4, 0.4, 0.1, 0.05);
  }
  // 围巾
  box(torso, m(def.scarf), 0, 0.94, 0, bw + 0.14, 0.3, 0.84);
  const scarfTail = new THREE.Group(); scarfTail.position.set(isLuna ? -0.3 : 0.35, 0.9, -0.44); torso.add(scarfTail); parts.scarfTail = scarfTail;
  box(scarfTail, m(def.scarf), 0, -0.9, -0.05, 0.42, 1.0, 0.16);
  box(scarfTail, m(shadeC(def.scarf, 0.8)), 0, -0.9, -0.05, 0.42, 0.18, 0.18);
  // 手臂
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * (bw / 2 + 0.28), 0.9, 0); torso.add(arm);
    box(arm, m(def.top), 0, -0.62, 0, 0.42, 0.72, 0.46);
    box(arm, m(def.top2), 0, -0.64, 0, 0.46, 0.16, 0.5);
    box(arm, m(def.skin), 0, -0.95, 0, 0.36, 0.34, 0.4);
    box(arm, m(isLuna ? 0xf2f6ff : 0x2a1520), 0, -0.75, 0, 0.44, 0.2, 0.48);
    parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  // 头
  const head = new THREE.Group(); head.position.y = 1.0; torso.add(head); parts.head = head;
  const hs = 1.22;
  box(head, m(def.skin), 0, 0, 0, hs, 1.0, hs);
  box(head, m(def.hair), 0, 0.85, 0, hs + 0.14, 0.34, hs + 0.14);                // 头顶
  box(head, m(def.hair), 0, 0.3, -0.62, hs + 0.14, 0.9, 0.3);                    // 后发
  for (const s of [-1, 1]) box(head, m(def.hair), s * (hs / 2 + 0.02), 0.2, 0.0, 0.2, 0.95, hs + 0.1); // 鬓发
  // 刘海
  const bang = m(def.hair);
  [-0.42, -0.14, 0.14, 0.42].forEach((x, i) => box(head, bang, x, 0.66 - (i % 2) * 0.16, hs / 2 + 0.04, 0.3, 0.3 + (i % 2) * 0.16, 0.14));
  box(head, m(def.hair2), 0, 0.66, hs / 2 + 0.06, 0.12, 0.34, 0.1);
  // 眼睛 / 嘴 / 腮红
  for (const s of [-1, 1]) {
    box(head, m(0x1a1426), s * 0.3, 0.2, hs / 2 + 0.03, 0.22, 0.34, 0.06);
    box(head, m(def.eye), s * 0.3, 0.24, hs / 2 + 0.06, 0.16, 0.24, 0.05);
    box(head, m(0xffffff), s * 0.3 + 0.03, 0.38, hs / 2 + 0.08, 0.07, 0.08, 0.04);
    box(head, m(0xff8aa0), s * 0.46, 0.0, hs / 2 + 0.03, 0.2, 0.1, 0.05);
  }
  box(head, m(0x7a2a3a), 0, 0.02, hs / 2 + 0.04, 0.14, 0.08, 0.05);
  // 耳朵
  const earG = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.46, 0.95, -0.05); head.add(ear);
    if (isLuna) { // 猫耳
      box(ear, m(def.hair), 0, 0, 0, 0.44, 0.38, 0.34); box(ear, m(def.hair), s * 0.02, 0.38, 0, 0.28, 0.3, 0.28);
      box(ear, m(0xffa6c8), 0, 0.02, 0.15, 0.24, 0.3, 0.06);
    } else { // 狐耳（更大，黑尖）
      box(ear, m(def.hair), 0, 0, 0, 0.5, 0.5, 0.36); box(ear, m(def.hair), s * 0.02, 0.5, 0, 0.36, 0.4, 0.3);
      box(ear, m(0x2a1520), s * 0.03, 0.9, 0, 0.2, 0.26, 0.2);
      box(ear, m(0xffe6d0), 0, 0.04, 0.17, 0.28, 0.5, 0.06);
      ear.rotation.z = -s * 0.12;
    }
    earG.push(ear);
  }
  parts.ears = earG;
  if (isLuna) { // 星星发夹
    const g = m(0xffe45a);
    box(head, g, -0.45, 0.62, hs / 2 + 0.1, 0.4, 0.12, 0.06); box(head, g, -0.45, 0.48, hs / 2 + 0.1, 0.12, 0.4, 0.06);
  } else { // 护目镜
    box(head, m(0x6a4a2a), 0, 0.85 + 0.2, hs / 2 - 0.1, hs + 0.2, 0.2, 0.2);
    for (const s of [-1, 1]) { box(head, m(0xffc23a), s * 0.35, 1.0, hs / 2 + 0.05, 0.4, 0.3, 0.12); box(head, m(0xaef0ff), s * 0.35, 1.03, hs / 2 + 0.1, 0.26, 0.2, 0.06); }
    // 尖发
    [-0.5, 0, 0.5].forEach((x, i) => box(head, m(def.hair), x, 1.18 + (i === 1 ? 0.18 : 0), -0.2, 0.3, 0.35, 0.4));
    // 脸颊胡须
    for (const s of [-1, 1]) { box(head, m(0x6a2a1a), s * 0.58, 0.02, hs / 2 + 0.02, 0.04, 0.05, 0.06); }
  }
  // 尾巴
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.4); torso.add(tail); parts.tail = tail;
  if (isLuna) {
    box(tail, m(def.hair), 0, 0, -0.2, 0.28, 0.28, 0.6);
    box(tail, m(def.hair), 0, 0.28, -0.6, 0.28, 0.6, 0.28);
    box(tail, m(def.hair2), 0, 0.88, -0.6, 0.28, 0.4, 0.28);
    box(tail, m(0xffe45a), 0, 1.28, -0.6, 0.3, 0.14, 0.3);
  } else {
    box(tail, m(def.top2), 0, 0, -0.35, 0.6, 0.6, 0.7);
    box(tail, m(def.top2), 0, 0.2, -0.95, 0.76, 0.76, 0.6);
    box(tail, m(def.top2), 0, 0.6, -1.5, 0.76, 0.8, 0.6);
    box(tail, m(0xfff0dc), 0, 1.15, -1.8, 0.6, 0.6, 0.55);
    box(tail, m(0xff4a2a), 0, 0.15, -0.9, 0.2, 0.7, 0.62);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return { root, parts, mats };
}
function shadeC(hex, f) {
  const r = Math.min(255, ((hex >> 16) & 255) * f), g = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

const COOLDOWN = { 1: 0.55, 2: 3.2, 3: 8.5 };
export const CD_MAX = COOLDOWN;

export class Fighter {
  constructor(G, def, isPlayer) {
    this.G = G; this.def = def; this.isPlayer = isPlayer;
    const mdl = buildModel(def);
    this.model = mdl; this.parts = mdl.parts; this.mats = mdl.mats;
    G.scene.add(mdl.root);
    this.maxHp = 100; this.dmgMul = 1; this.speedMul = 1;
    this.pose = { aL: 0, aR: 0, aLz: 0, aRz: 0, lL: 0, lR: 0, lean: 0, spin: 0, headX: 0, headY: 0, rollZ: 0, crouch: 0, tail: 0 };
    this.reset(0, 0, 0);
  }
  reset(x, z, yaw) {
    this.x = x; this.y = 0; this.z = z; this.vx = 0; this.vz = 0; this.vy = 0; this.kvx = 0; this.kvz = 0;
    this.yaw = yaw; this.hp = this.maxHp; this.dead = false; this.winPose = false;
    this.stun = 0; this.inv = 0; this.flash = 0; this.act = null; this.buf = null; this.jumpBuf = 0;
    this.cd = { 1: 0, 2: 0, 3: 0 }; this.grounded = true; this.t = Math.random() * 10; this.walkPh = 0; this.speedNow = 0;
    this.hurtT = 0; this.koT = 0; this.lastDash = 0;
    this.model.root.visible = true;
    this.model.root.position.set(x, 0, z);
  }
  get foe() { return this._foe; }
  set foe(f) { this._foe = f; }
  get cx() { return this.x; }

  die(dx, dz) {
    this.dead = true; this.koT = 0; this.act = null;
    this.kvx = dx * 8; this.kvz = dz * 8; this.vy = 8; this.grounded = false;
    this.G.sfx('ko');
  }

  yawToFoe() { const f = this.foe; return f ? Math.atan2(f.x - this.x, f.z - this.z) : this.yaw; }
  fwd() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }

  canAct() { return !this.act && this.stun <= 0 && !this.dead; }

  tryStart(n, inp) {
    if (this.cd[n] > 0) return false;
    this.cd[n] = COOLDOWN[n];
    const G = this.G, foe = this.foe;
    if (foe) this.yaw = this.aimYaw ? this.aimYaw() : this.yawToFoe();
    if (n === 1) { this.act = { n, t: 0, dur: 0.44, fired: false }; G.sfx('cast'); }
    if (n === 2) {
      let dx = inp.mx, dz = inp.mz;
      if (Math.hypot(dx, dz) < 0.3) { const y = this.yawToFoe(); dx = Math.sin(y); dz = Math.cos(y); }
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      this.yaw = Math.atan2(dx, dz);
      this.act = { n, t: 0, dur: 0.42, dx, dz, hit: false, trail: 0, wind: 0.07 };
      G.sfx('dash');
    }
    if (n === 3) { this.act = { n, t: 0, dur: 1.4, wind: 0.7, blasted: false, ringR: 0, hit: false }; G.sfx('charge'); this.vy = 0; }
    return true;
  }

  update(dt, inp) {
    const G = this.G, world = G.world, fx = G.fx, foe = this.foe;
    this.t += dt;
    for (const k of [1, 2, 3]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.buf) { this.buf.t -= dt; if (this.buf.t <= 0) this.buf = null; }
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.hurtT += dt;

    let mx = 0, mz = 0, speedMul = 1, gravOn = true;

    if (this.dead) {
      this.koT += dt;
    } else if (this.winPose) {
      // 胜利动作
    } else {
      if (inp.a1) this.buf = { n: 1, t: 0.22 }; if (inp.a2) this.buf = { n: 2, t: 0.22 }; if (inp.a3) this.buf = { n: 3, t: 0.22 };
      if (inp.jump) this.jumpBuf = 0.14;
      if (this.stun > 0) this.stun -= dt;
      else {
        if (this.canAct() && this.buf) { const n = this.buf.n; if (this.tryStart(n, inp)) this.buf = null; else if (this.cd[n] > 0.3) this.buf = null; }
        if (this.act) { const r = this.updateAct(dt, inp); speedMul = r.speed; gravOn = r.grav; }
        else {
          mx = inp.mx; mz = inp.mz;
          if (this.jumpBuf > 0 && this.grounded) { this.vy = JUMP_V; this.grounded = false; this.jumpBuf = 0; G.sfx('jump'); fx.burst(this.x, 0.2, this.z, 8, [0xffffff, 0xffe45a], { min: 2, max: 4, life0: 0.2, life1: 0.4, grav: 2 }); }
        }
      }
    }

    // ---- 移动 ----
    const sp = SPEED * this.speedMul * speedMul;
    const tvx = mx * sp, tvz = mz * sp;
    const ac = this.grounded ? 70 : 28;
    const k = Math.min(1, ac * dt / Math.max(sp, 1));
    if (!(this.act && this.act.n === 2 && this.act.t > this.act.wind)) {
      this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    }
    let ex = this.vx + this.kvx, ez = this.vz + this.kvz;
    if (this.act && this.act.n === 2 && this.act.t > this.act.wind && !this.act.done) { ex = this.act.dx * 30; ez = this.act.dz * 30; this.vx = ex; this.vz = ez; }
    this.kvx *= Math.exp(-5.5 * dt); this.kvz *= Math.exp(-5.5 * dt);
    this.x += ex * dt; this.z += ez * dt;
    if (gravOn) this.vy -= GRAV * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; if (this.vy < 0) { if (!this.grounded && this.vy < -8) fx.burst(this.x, 0.2, this.z, 6, [0xffffff], { min: 2, max: 3, life0: 0.15, life1: 0.3, grav: 0 }); this.vy = 0; } this.grounded = true; } else this.grounded = false;
    this.hitWall = false;
    world.resolve(this, RADIUS);
    if (foe && !foe.dead && !this.dead) { // 角色互斥
      const dx = this.x - foe.x, dz = this.z - foe.z, d = Math.hypot(dx, dz), mn = RADIUS * 1.7;
      if (d < mn && Math.abs(this.y - foe.y) < 2.2) {
        const p = (mn - d) / 2, nx = d > 0.01 ? dx / d : 1, nz = d > 0.01 ? dz / d : 0;
        this.x += nx * p; this.z += nz * p; foe.x -= nx * p; foe.z -= nz * p;
        world.resolve(foe, RADIUS);
      }
    }
    this.speedNow = Math.hypot(this.vx, this.vz);

    // ---- 朝向 ----
    if (!this.dead && !this.winPose && !(this.act && (this.act.n === 2 || this.act.fixedYaw))) {
      let target = this.yaw;
      if (foe && !foe.dead) target = this.yawToFoe();
      else if (this.speedNow > 1) target = Math.atan2(this.vx, this.vz);
      if (this.stun <= 0) this.yaw += angDiff(this.yaw, target) * (1 - Math.exp(-16 * dt));
    }
    this.animate(dt);
  }

  updateAct(dt, inp) {
    const a = this.act, G = this.G, fx = G.fx;
    a.t += dt;
    const out = { speed: 0.3, grav: true };
    if (a.n === 1) {
      out.speed = 0.35;
      if (!a.fired && a.t >= 0.13) {
        a.fired = true;
        const y = this.aimYaw ? this.aimYaw() : this.yawToFoe();
        this.yaw = y;
        const dx = Math.sin(y), dz = Math.cos(y);
        G.projectiles.push(new StarShot(G, this, this.x + dx * 1.2, this.y + 1.4, this.z + dz * 1.2, dx, dz));
        fx.burst(this.x + dx * 1.3, this.y + 1.5, this.z + dz * 1.3, 14, [this.def.starCol, 0xffffff, ...RAINBOW], { star: 0.5, min: 2, max: 7 });
        G.sfx('shoot');
      }
      if (a.t >= a.dur) this.act = null;
    } else if (a.n === 2) {
      out.speed = 0;
      if (a.t < a.wind) { /* 起手 */ }
      else if (!a.done) {
        // 彩虹带：垂直于前进方向，7色并排
        const px = -a.dz, pz = a.dx;
        a.trail -= dt;
        if (a.trail <= 0) {
          a.trail = 0.012;
          for (let i = 0; i < 7; i++) {
            const o = (i - 3) * 0.42;
            fx.emit({ x: this.x + px * o, y: this.y + 0.9 + Math.sin(a.t * 24) * 0.2, z: this.z + pz * o, life: 0.9, size: 0.55, color: RAINBOW[i], shrink: true, vy: 0.2 });
          }
          fx.emit({ kind: 'star', x: this.x + rand(-1, 1), y: this.y + rand(0.2, 2.4), z: this.z + rand(-1, 1), vx: -a.dx * 2, vz: -a.dz * 2, life: rand(0.4, 0.8), size: rand(0.3, 0.6), color: Math.random() < 0.5 ? 0xffffff : this.def.starCol, twinkle: true, spin: 7 });
        }
        const foe = this.foe;
        if (foe && !a.hit && !foe.dead) {
          const dx = foe.x - this.x, dz = foe.z - this.z;
          if (dx * dx + dz * dz < 1.9 * 1.9 && Math.abs(foe.y - this.y) < 2.2) {
            a.hit = true;
            const d = Math.hypot(dx, dz) || 1;
            // 击退方向 = 冲刺方向
            const ok = applyHit(G, this, foe, { dmg: 14, kb: 17, dx: a.dx, dz: a.dz, up: 4, stun: 0.5, heavy: true });
            if (ok) { a.done = true; a.t = Math.max(a.t, a.dur - 0.12); this.vx = this.vz = 0; this.kvx = this.kvz = 0; }
          }
        }
        if (this.hitWall) { a.done = true; a.t = Math.max(a.t, a.dur - 0.1); fx.burst(this.x, 1.2, this.z, 14, [0xffffff, ...RAINBOW], { star: 0.4 }); }
      }
      if (a.t >= a.dur) {
        fx.burst(this.x, 1.2, this.z, 18, [this.def.starCol, 0xffffff, ...RAINBOW], { star: 0.5, min: 3, max: 8 });
        this.vx = a.dx * 4; this.vz = a.dz * 4; this.act = null;
      }
    } else if (a.n === 3) {
      out.speed = 0; a.fixedYaw = true;
      if (a.t < a.wind) { // 蓄力：悬浮 + 星光汇聚
        out.grav = false;
        this.y += (2.2 - this.y) * Math.min(1, 7 * dt); this.vy = 0; this.grounded = false;
        const p = a.t / a.wind;
        a.spinA = (a.spinA || 0) + dt * (6 + p * 22);
        this.yaw = a.spinA;
        for (let i = 0; i < 3; i++) {
          const ang = Math.random() * Math.PI * 2, r = 4.5 * (1 - p * 0.3) + rand(0, 1.5);
          fx.emit({
            kind: Math.random() < 0.5 ? 'star' : 'cube', x: this.x + Math.cos(ang) * r, y: this.y + 1.4 + rand(-1.5, 1.5), z: this.z + Math.sin(ang) * r,
            vx: -Math.cos(ang) * r * 2.6 - Math.sin(ang) * 3, vz: -Math.sin(ang) * r * 2.6 + Math.cos(ang) * 3, vy: rand(-1, 1),
            life: 0.45, size: rand(0.3, 0.6), color: RAINBOW[(Math.random() * 7) | 0], twinkle: true, spin: 6,
          });
        }
        // 地面光环
        fx.ring(this.x, 0.15, this.z, 1.6 + p * 1.8, 8, { rainbow: true, shift: (this.t * 20) | 0, life: 0.14, size: 0.3, off: this.t * 6 });
      } else {
        if (!a.blasted) {
          a.blasted = true; a.ringR = 1.2; this.yaw = this.yawToFoe();
          G.vfx.push(new NovaRing(G, this.x, this.z)); G.flash(0.5, [1, 1, 0.85]); G.shake(1.1); G.sfx('nova');
          fx.burst(this.x, this.y + 1.4, this.z, 60, [this.def.starCol, 0xffffff, ...RAINBOW], { star: 0.6, min: 5, max: 16, s0: 0.25, s1: 0.6, life1: 1.1 });
          // 流星雨
          const R = 9.5, foe = this.foe;
          for (let i = 0; i < 15; i++) {
            const base = foe ? Math.atan2(foe.z - this.z, foe.x - this.x) : 0;
            const ang = base + (Math.random() - 0.5) * 2 * 1.9, r = Math.sqrt(Math.random()) * R;
            G.fallers.push(new Faller(G, this, this.x + Math.cos(ang) * r, this.z + Math.sin(ang) * r, 0.25 + i * 0.07 + Math.random() * 0.15));
          }
          if (foe) for (let i = 0; i < 2; i++) G.fallers.push(new Faller(G, this, foe.x + rand(-1.5, 1.5), foe.z + rand(-1.5, 1.5), 0.55 + i * 0.42));
        }
        out.grav = true;
        a.ringR += 19 * dt;
        const R = a.ringR;
        if (R < 11.5) {
          const n = Math.min(120, 20 + (R * 9) | 0);
          for (let k = 0; k < 3; k++) fx.ring(this.x, 0.35 + k * 0.45, this.z, R - k * 0.7, n, { rainbow: true, shift: k * 2 + ((this.t * 14) | 0), life: 0.35, size: 0.5 - k * 0.08, out: 1.5, star: k === 0 ? 9 : 0, twinkle: true, off: k });
          fx.ring(this.x, 1.8, this.z, R - 0.3, 20, { color: 0xffffff, life: 0.2, size: 0.4 });
          const foe = this.foe;
          if (foe && !a.hit && !foe.dead) {
            const dx = foe.x - this.x, dz = foe.z - this.z, d = Math.hypot(dx, dz);
            if (d <= R + 0.6 && foe.y < 1.15) {
              a.hit = true;
              applyHit(G, this, foe, { dmg: 18, kb: 18, dx: dx / (d || 1), dz: dz / (d || 1), up: 9, stun: 0.65, heavy: true });
            }
          }
        }
        if (a.t >= a.dur) this.act = null;
      }
    }
    return out;
  }

  // ---------- 动画 ----------
  animate(dt) {
    const P = this.pose, pt = this.parts, a = this.act, t = this.t;
    let T = { aL: 0, aR: 0, aLz: 0, aRz: 0, lL: 0, lR: 0, lean: 0, spin: 0, headX: 0, crouch: 0, tail: Math.sin(t * 3) * 0.2, rollZ: 0, aLs: 0 };
    let kRate = 22;
    const moving = this.speedNow > 1.2 && this.grounded;
    if (moving) {
      this.walkPh += dt * (6 + this.speedNow * 0.9);
      const s = Math.sin(this.walkPh), amp = clamp(this.speedNow / 9, 0.3, 1.1);
      T.lL = -s * 0.95 * amp; T.lR = s * 0.95 * amp; T.aL = s * 0.85 * amp; T.aR = -s * 0.85 * amp;
      T.lean = 0.1 * amp; T.tail = Math.sin(this.walkPh * 0.5) * 0.35; T.crouch = Math.abs(Math.cos(this.walkPh)) * -0.0;
    } else if (this.grounded) {
      T.aLz = 0.08 + Math.sin(t * 2) * 0.03; T.aRz = -T.aLz; T.crouch = Math.sin(t * 2.4) * 0.03;
    }
    if (!this.grounded && !a && !this.dead) { // 空中
      T.lL = -0.5; T.lR = 0.4; T.aLz = 0.9; T.aRz = -0.9; T.aL = -0.2; T.aR = -0.2; T.lean = this.vy > 0 ? -0.05 : 0.12;
    }
    if (a) {
      if (a.n === 1) {
        const f = a.t < 0.13;
        if (f) { T.aL = 0.7; T.aR = 0.7; T.lean = -0.18; T.aLz = 0.3; T.aRz = -0.3; }
        else { T.aL = -1.55; T.aR = -1.55; T.aLz = 0.12; T.aRz = -0.12; T.lean = 0.14; T.headX = -0.1; }
        T.lL = -0.35; T.lR = 0.4; kRate = 30;
      } else if (a.n === 2) {
        T.lean = 0.85; T.aL = 1.5; T.aR = 1.5; T.aLz = 0.25; T.aRz = -0.25; T.lL = -1.0; T.lR = 1.1; T.headX = -0.5; T.tail = 0.6; kRate = 30;
        if (a.t < a.wind) { T.lean = -0.3; T.aL = 0.5; T.aR = 0.5; }
      } else if (a.n === 3) {
        if (a.t < a.wind) { T.aL = -3.0; T.aR = -3.0; T.aLz = 0.35; T.aRz = -0.35; T.headX = -0.45; T.lL = 0.35; T.lR = -0.35; T.lean = -0.1; }
        else { const p = Math.min(1, (a.t - a.wind) / 0.5); T.aL = -0.4 - p * 0.2; T.aR = T.aL; T.aLz = 1.5; T.aRz = -1.5; T.lean = -0.15 + p * 0.25; T.headX = -0.2; T.lL = -0.2; T.lR = 0.2; }
        kRate = 14;
      }
    }
    if (this.stun > 0 && !this.dead) { T.lean = -0.55; T.aL = -0.7; T.aR = -0.5; T.aLz = 0.8; T.aRz = -0.8; T.headX = 0.4; T.lL = -0.3; T.lR = 0.5; kRate = 30; }
    if (this.dead) { T.lean = -1.5; T.aLz = 1.0; T.aRz = -1.0; T.aL = -0.3; T.aR = -0.1; T.lL = -0.1; T.lR = 0.2; T.headX = 0.2; kRate = this.grounded ? 12 : 6; }
    if (this.winPose) { const b = Math.abs(Math.sin(t * 6)); T.aL = -2.9 + b * 0.4; T.aR = -2.9 + b * 0.4; T.aLz = 0.5; T.aRz = -0.5; T.tail = Math.sin(t * 8) * 0.5; T.lean = -0.05; }

    const k = 1 - Math.exp(-kRate * dt);
    for (const key in T) P[key] = (P[key] ?? 0) + (T[key] - (P[key] ?? 0)) * k;

    pt.legL.rotation.x = P.lL; pt.legR.rotation.x = P.lR;
    pt.armL.rotation.x = P.aL; pt.armR.rotation.x = P.aR; pt.armL.rotation.z = P.aLz; pt.armR.rotation.z = P.aRz;
    pt.head.rotation.x = P.headX;
    pt.body.rotation.x = P.lean;
    pt.tail.rotation.x = P.tail * 0.6; pt.tail.rotation.y = Math.sin(t * 2.2) * 0.3 + P.tail * 0.5;
    pt.scarfTail.rotation.x = 0.35 + Math.sin(t * 5) * 0.12 + this.speedNow * 0.03 + (a && a.n === 2 ? 0.8 : 0);
    pt.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 7 + i) * 0.05 + (this.stun > 0 ? 0.5 : 0); });
    pt.torso.position.y = 0.95 + P.crouch;

    const r = this.model.root;
    r.position.set(this.x, this.y + (this.dead && this.grounded ? 0.35 : 0), this.z);
    r.rotation.y = this.yaw;
    // 受击闪白
    const fl = this.flash > 0 ? 1 : 0;
    const inv = this.inv > 0 && this.stun <= 0 ? (Math.sin(t * 40) > 0 ? 0.35 : 0) : 0;
    for (const mt of this.mats) mt.emissive.setScalar(Math.max(fl, inv));
  }
}
