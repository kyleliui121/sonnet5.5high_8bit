// 技能实体：星光弹 / 流星 + 统一的命中结算
import * as THREE from 'three';
import { makeStarGeo } from './fx.js';
import { RAINBOW, rand } from './util.js';

const starGeo = makeStarGeo(1);
const matCache = {};
const glow = (c) => (matCache[c] ||= new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));

export const BODY_H = 2.8;

/** 统一命中结算 */
export function applyHit(G, att, tgt, o) {
  if (tgt.dead || tgt.inv > 0 || G.state !== 'fight') return false;
  const dmg = Math.round(o.dmg * (att.dmgMul || 1));
  tgt.hp = Math.max(0, tgt.hp - dmg);
  tgt.stun = o.stun ?? 0.34;
  tgt.inv = tgt.stun + 0.28;
  tgt.kvx = (o.dx || 0) * o.kb; tgt.kvz = (o.dz || 0) * o.kb;
  if (o.up) { tgt.vy = o.up; tgt.y += 0.05; tgt.grounded = false; }
  tgt.act = null; tgt.buf = null;
  tgt.flash = 0.14;
  tgt.hurtT = 0;
  const cx = tgt.x, cy = tgt.y + 1.5, cz = tgt.z;
  G.fx.burst(cx, cy, cz, o.heavy ? 34 : 20, [att.def.starCol, 0xffffff, ...RAINBOW], { star: 0.4, min: 4, max: o.heavy ? 13 : 9, s0: 0.18, s1: o.heavy ? 0.5 : 0.4 });
  G.fx.ring(cx, cy, cz, 0.6, 14, { out: 9, rainbow: true, life: 0.28, size: 0.35 });
  G.hitstop(o.heavy ? 0.1 : 0.055);
  G.shake(o.heavy ? 1.0 : 0.55);
  G.floater(String(dmg), cx, cy + 1.4, cz, o.heavy ? '#ffe85a' : '#ffffff');
  G.sfx(o.heavy ? 'hitHeavy' : 'hit');
  if (tgt.hp <= 0) tgt.die(o.dx || 0, o.dz || 0);
  return true;
}

export class StarShot {
  constructor(G, owner, x, y, z, dx, dz) {
    this.G = G; this.owner = owner;
    this.x = x; this.y = y; this.z = z; this.dx = dx; this.dz = dz;
    this.speed = 22; this.age = 0; this.life = 1.15; this.dead = false;
    this.mesh = new THREE.Group();
    const outer = new THREE.Mesh(starGeo, glow(owner.def.starCol)); outer.scale.setScalar(1.7);
    const core = new THREE.Mesh(starGeo, glow(0xffffff)); core.scale.setScalar(0.9);
    this.mesh.add(outer, core); this.outer = outer; this.core = core; this.core.position.z = 0.05;
    this.mesh.position.set(x, y, z);
    G.scene.add(this.mesh);
    this.ci = 0;
  }
  update(dt) {
    const G = this.G, fx = G.fx;
    this.age += dt;
    const sx = this.x, sz = this.z;
    this.x += this.dx * this.speed * dt; this.z += this.dz * this.speed * dt;
    this.mesh.position.set(this.x, this.y + Math.sin(this.age * 20) * 0.08, this.z);
    this.mesh.quaternion.copy(G.camera.quaternion);
    this.outer.rotation.z += dt * 7; this.core.rotation.z -= dt * 5;
    // 彩虹螺旋拖尾 + 星尘
    const px = -this.dz, pz = this.dx;
    const steps = Math.max(1, Math.round((this.speed * dt) / 0.28));
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const bx = sx + (this.x - sx) * f, bz = sz + (this.z - sz) * f;
      for (let k = 0; k < 2; k++) {
        const ph = (this.age - dt * (1 - f)) * 24 + k * Math.PI;
        fx.emit({
          x: bx + px * Math.sin(ph) * 0.62, y: this.y + Math.cos(ph) * 0.62, z: bz + pz * Math.sin(ph) * 0.62,
          life: 0.55, size: 0.42, color: RAINBOW[(this.ci + k * 3) % 7],
        });
      }
      this.ci++;
    }
    if (Math.random() < 0.7) fx.emit({
      kind: 'star', x: this.x - this.dx * 0.8 + rand(-0.4, 0.4), y: this.y + rand(-0.5, 0.5), z: this.z - this.dz * 0.8 + rand(-0.4, 0.4),
      vx: rand(-1.5, 1.5), vy: rand(0.5, 2), vz: rand(-1.5, 1.5), life: rand(0.35, 0.7), size: rand(0.25, 0.5),
      color: Math.random() < 0.5 ? 0xffffff : this.owner.def.starCol, twinkle: true, spin: 6, grav: 1,
    });
    // 命中
    const foe = this.owner.foe;
    if (foe && !foe.dead) {
      const dx = foe.x - this.x, dz = foe.z - this.z;
      if (dx * dx + dz * dz < 1.15 * 1.15 && this.y + 0.5 > foe.y && this.y - 0.5 < foe.y + BODY_H) {
        applyHit(G, this.owner, foe, { dmg: 9, kb: 9, dx: this.dx, dz: this.dz, up: 0, stun: 0.34 });
        this.explode(true); return;
      }
    }
    if (G.world.inside(this.x, this.z, 0.15, true) || Math.abs(this.x) > 25 || Math.abs(this.z) > 25 || this.age > this.life) this.explode(false);
  }
  explode(hit) {
    if (this.dead) return;
    this.dead = true;
    const fx = this.G.fx;
    fx.burst(this.x, this.y, this.z, hit ? 16 : 26, [this.owner.def.starCol, 0xffffff, ...RAINBOW], { star: 0.45, min: 3, max: 9, floor: true });
    fx.ring(this.x, this.y, this.z, 0.4, 12, { out: 7, rainbow: true, life: 0.3, size: 0.38, dy: 0 });
    this.G.sfx('pop');
    this.G.scene.remove(this.mesh);
  }
  dispose() { if (!this.dead) { this.dead = true; this.G.scene.remove(this.mesh); } }
}

/** 星坠新星的流星：先在地面显示预警圈，再坠落爆炸 */
export class Faller {
  constructor(G, owner, x, z, delay) {
    this.G = G; this.owner = owner; this.x = x; this.z = z; this.delay = delay; this.tele = 0.55;
    this.y = 28; this.state = 0; this.dead = false; this.t = 0;
    this.mesh = new THREE.Group();
    const o = new THREE.Mesh(starGeo, glow(owner.def.starCol)); o.scale.setScalar(1.5);
    const c = new THREE.Mesh(starGeo, glow(0xffffff)); c.scale.setScalar(0.8);
    this.mesh.add(o, c); this.o = o; this.c = c;
    this.mesh.visible = false; G.scene.add(this.mesh);
    this.ci = (Math.random() * 7) | 0;
  }
  update(dt) {
    const G = this.G, fx = G.fx;
    this.t += dt;
    if (this.state === 0) {
      this.delay -= dt;
      if (this.delay <= 0) { this.state = 1; this.mesh.visible = true; }
      return;
    }
    if (this.state === 1) { // 预警 + 坠落
      this.tele -= dt;
      this.y = Math.max(0.5, 28 * Math.max(0, this.tele / 0.55) ** 1.6);
      // 地面预警圈
      if (Math.random() < 0.9) fx.ring(this.x, 0.15, this.z, 1.7, 10, { color: RAINBOW[this.ci++ % 7], life: 0.12, size: 0.28, off: Math.random() * 6 });
      this.mesh.position.set(this.x, this.y + 0.6, this.z);
      this.mesh.quaternion.copy(G.camera.quaternion); this.o.rotation.z += dt * 6; this.c.rotation.z -= dt * 4;
      for (let k = 0; k < 3; k++) fx.emit({
        x: this.x + rand(-0.4, 0.4), y: this.y + 0.6 + k * 0.9 + rand(0, 0.6), z: this.z + rand(-0.4, 0.4),
        life: 0.42, size: 0.35, color: RAINBOW[(this.ci + k) % 7],
      });
      if (this.tele <= 0) this.impact();
    }
  }
  impact() {
    const G = this.G, fx = G.fx;
    this.dead = true; G.scene.remove(this.mesh);
    fx.burst(this.x, 0.8, this.z, 30, [this.owner.def.starCol, 0xffffff, ...RAINBOW], { star: 0.4, min: 4, max: 11, up: 4, floor: true });
    for (let i = 0; i < 3; i++) fx.ring(this.x, 0.3 + i * 0.2, this.z, 0.5 + i * 0.4, 16, { out: 6 - i, rainbow: true, shift: i * 2, life: 0.35, size: 0.4 });
    G.sfx('pop'); G.shake(0.25);
    const foe = this.owner.foe;
    if (foe && !foe.dead && foe.y < 2.0) {
      const dx = foe.x - this.x, dz = foe.z - this.z, d = Math.hypot(dx, dz);
      if (d < 1.9) applyHit(G, this.owner, foe, { dmg: 6, kb: 8, dx: d > 0.01 ? dx / d : 0, dz: d > 0.01 ? dz / d : 1, up: 5, stun: 0.4 });
    }
  }
  dispose() { this.dead = true; this.G.scene.remove(this.mesh); }
}

/** 星坠新星的彩虹冲击环（扁平七色环网格，随半径扩张并淡出） */
export class NovaRing {
  constructor(G, x, z) {
    this.G = G; this.dead = false; this.age = 0; this.x = x; this.z = z;
    this.g = new THREE.Group(); this.g.position.set(x, 0.25, z);
    this.mats = [];
    RAINBOW.forEach((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      const r = new THREE.Mesh(new THREE.RingGeometry(0.6 + i * 0.055, 0.6 + (i + 1) * 0.055, 64), m);
      r.rotation.x = -Math.PI / 2; r.position.y = i * 0.02; this.g.add(r); this.mats.push(m);
    });
    this.g.scale.setScalar(1.2);
    G.scene.add(this.g);
  }
  update(dt) {
    this.age += dt;
    const R = 1.2 + this.age * 19;
    this.g.scale.setScalar(R);
    const o = Math.max(0, 1 - this.age / 0.6);
    this.mats.forEach((m) => (m.opacity = o));
    if (this.age > 0.6) this.dispose();
  }
  dispose() { if (this.dead) return; this.dead = true; this.G.scene.remove(this.g); }
}
