// 实例化粒子：方块(像素碎屑/彩虹拖尾) + 星芒(星光)
import * as THREE from 'three';
import { RAINBOW, rand } from './util.js';

const MAX_CUBE = 5000, MAX_STAR = 900;

export function makeStarGeo(s = 1) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 ? 0.2 : 0.5) * s, a = Math.PI / 2 + (i * Math.PI) / 5;
    i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12 * s, bevelEnabled: false });
  g.translate(0, 0, -0.06 * s);
  return g;
}

const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();

class Pool {
  constructor(geo, max, scene) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), max);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, tmpC.set(0xffffff));
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
  }
  add(p) { if (this.list.length < this.max) this.list.push(p); }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor && p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
    }
    const m = this.mesh;
    m.count = L.length;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      const t = p.age / p.life;
      let s = p.size * (p.shrink ? 1 - t * t : 1);
      if (p.twinkle) s *= 0.65 + 0.35 * Math.sin(p.age * 38 + p.ph);
      if (p.grow) s = p.size * (0.3 + t * 1.2) * (1 - t * t);
      dummy.position.set(p.x, p.y, p.z);
      if (this.fx && this.billboard && this.fx.camQuat) { dummy.quaternion.copy(this.fx.camQuat); dummy.rotateZ(p.rx); }
      else dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.setScalar(Math.max(s, 0.001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      // 颜色渐变到白(亮部)或保持
      tmpC.setRGB(p.r, p.g, p.b);
      m.setColorAt(i, tmpC);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  clear() { this.list.length = 0; }
}

export class FX {
  constructor(scene) {
    this.cubes = new Pool(new THREE.BoxGeometry(1, 1, 1), MAX_CUBE, scene);
    this.stars = new Pool(makeStarGeo(1), MAX_STAR, scene);
    this.stars.fx = this; this.stars.billboard = true; this.camQuat = null;
  }
  clear() { this.cubes.clear(); this.stars.clear(); }
  update(dt) { this.cubes.update(dt); this.stars.update(dt); }

  /** 通用发射。kind: 'cube' | 'star' */
  emit(o) {
    tmpC.set(o.color ?? 0xffffff);
    const p = {
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life ?? 0.5, age: 0, size: o.size ?? 0.3, grav: o.grav || 0, drag: o.drag || 0,
      shrink: o.shrink !== false, twinkle: !!o.twinkle, grow: !!o.grow, floor: !!o.floor,
      spin: o.spin ?? 0, rx: Math.random() * 6, ry: Math.random() * 6, ph: Math.random() * 6,
      r: tmpC.r, g: tmpC.g, b: tmpC.b,
    };
    (o.kind === 'star' ? this.stars : this.cubes).add(p);
  }

  /** 球形迸发 */
  burst(x, y, z, n, colors, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.6;
      const sp = rand(o.min ?? 3, o.max ?? 9);
      const c = colors[(Math.random() * colors.length) | 0];
      this.emit({
        kind: o.star && Math.random() < o.star ? 'star' : 'cube', x, y, z,
        vx: Math.cos(a) * sp * Math.cos(e), vy: Math.sin(e) * sp + (o.up || 0), vz: Math.sin(a) * sp * Math.cos(e),
        life: rand(o.life0 ?? 0.35, o.life1 ?? 0.8), size: rand(o.s0 ?? 0.2, o.s1 ?? 0.45), grav: o.grav ?? 9, drag: o.drag ?? 1.2,
        color: c, twinkle: true, spin: rand(-8, 8), floor: o.floor,
      });
    }
  }

  /** 彩虹彩带切片：沿 (nx,nz) 垂直方向或竖直叠放 七条纹 */
  rainbowSlice(x, y, z, size = 0.42, life = 0.7, spread = 0.38, jitter = 0.02) {
    for (let i = 0; i < 7; i++) {
      this.emit({
        x: x + rand(-jitter, jitter), y: y + (3 - i) * spread, z: z + rand(-jitter, jitter),
        life: life * rand(0.9, 1.1), size, color: RAINBOW[i], shrink: true, vy: 0.3,
      });
    }
  }

  /** 水平彩虹环（每帧调用以形成扩散环） */
  ring(x, y, z, r, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (o.off || 0);
      const col = o.rainbow ? RAINBOW[(i + (o.shift || 0)) % 7] : (o.color ?? 0xffffff);
      this.emit({
        kind: o.star && i % o.star === 0 ? 'star' : 'cube',
        x: x + Math.cos(a) * r, y: y + (o.dy || 0), z: z + Math.sin(a) * r,
        vx: Math.cos(a) * (o.out || 0), vz: Math.sin(a) * (o.out || 0), vy: o.up || 0,
        life: o.life ?? 0.4, size: o.size ?? 0.4, color: col, twinkle: !!o.twinkle,
      });
    }
  }
}
