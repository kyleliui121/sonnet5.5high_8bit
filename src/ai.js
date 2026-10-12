// 电脑控制：接近 / 绕圈 / 后撤 / 选技能 / 躲弹 / 跳过冲击环 / 避开流星
import { rand, clamp } from './util.js';
import { RADIUS } from './fighter.js';

export const DIFFS = {
  easy:   { name: '简单', react: 0.5, err: 0.32, lead: 0.0, dodge: 0.18, novaDodge: 0.25, aggr: 0.45, dmg: 0.75, speed: 0.88 },
  normal: { name: '普通', react: 0.28, err: 0.14, lead: 0.55, dodge: 0.45, novaDodge: 0.65, aggr: 0.75, dmg: 1.0, speed: 0.97 },
  hard:   { name: '困难', react: 0.14, err: 0.05, lead: 0.9, dodge: 0.75, novaDodge: 0.95, aggr: 1.0, dmg: 1.12, speed: 1.04 },
};

export class AI {
  constructor(f, G, diff = 'normal') {
    this.f = f; this.G = G; this.setDiff(diff);
    this.reset();
  }
  setDiff(d) {
    this.diff = DIFFS[d]; this.f.dmgMul = this.diff.dmg; this.f.speedMul = this.diff.speed;
  }
  reset() {
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = rand(1, 2.5);
    this.nextAtk = rand(0.8, 1.6); this.dodgeT = 0; this.dodgeVec = null; this.seen = new WeakSet();
    this.err = 0; this.pref = rand(7, 10); this.novaJumped = false; this.thinkT = 0; this.stuckT = 0;
    this.f.aimYaw = () => this.aim();
  }
  aim() {
    const f = this.f, p = f.foe, d = Math.hypot(p.x - f.x, p.z - f.z);
    const tt = (d / 22) * this.diff.lead;
    const tx = p.x + (p.vx + p.kvx) * tt, tz = p.z + (p.vz + p.kvz) * tt;
    return Math.atan2(tx - f.x, tz - f.z) + this.err;
  }
  steer(ang) {
    const f = this.f, w = this.G.world;
    const ok = (a) => {
      const x = f.x + Math.sin(a) * 2.6, z = f.z + Math.cos(a) * 2.6;
      return !w.inside(x, z, 1.0) && Math.abs(x) < 23.6 && Math.abs(z) < 23.6;
    };
    if (ok(ang)) return ang;
    for (let k = 1; k <= 6; k++) for (const s of [this.strafe, -this.strafe]) { const a = ang + s * k * 0.42; if (ok(a)) return a; }
    return ang;
  }

  think(dt) {
    const f = this.f, G = this.G, w = G.world, p = f.foe, D = this.diff;
    const inp = { mx: 0, mz: 0, jump: false, a1: false, a2: false, a3: false };
    if (!p || f.dead || p.dead) return inp;
    const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz) || 0.01;
    const toward = Math.atan2(dx, dz);
    this.nextAtk -= dt; this.strafeT -= dt; this.dodgeT -= dt; this.thinkT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = rand(1.2, 3); this.pref = rand(6.5, 10.5); }

    // ---- 移动意图 ----
    let ang = toward;
    const clear0 = !w.blocked(f.x, f.z, p.x, p.z, 0.45, true);
    if (!clear0 && d > 3) ang = toward + this.strafe * 0.5;
    else if (d > this.pref + 3) ang = toward;
    else if (d < this.pref - 3.5) ang = toward + Math.PI + this.strafe * 0.5;        // 后撤
    else ang = toward + this.strafe * (Math.PI / 2 - clamp((this.pref - d) * 0.08, -0.4, 0.4));
    // 边缘回归
    const edge = Math.max(Math.abs(f.x), Math.abs(f.z));
    if (edge > 21.5) ang = Math.atan2(-f.x, -f.z) + this.strafe * 0.4;
    ang = this.steer(ang);
    let mx = Math.sin(ang), mz = Math.cos(ang);
    // 攻击中/硬直不规划
    // ---- 躲避：玩家的星光弹 ----
    if (this.dodgeT > 0 && this.dodgeVec) { mx = this.dodgeVec[0]; mz = this.dodgeVec[1]; }
    for (const pr of G.projectiles) {
      if (pr.owner === f || pr.dead || this.seen.has(pr)) continue;
      const rx = f.x - pr.x, rz = f.z - pr.z, along = rx * pr.dx + rz * pr.dz;
      if (along <= 0 || along > 14) continue;
      const lat = rx * -pr.dz + rz * pr.dx;
      if (Math.abs(lat) > 1.9) continue;
      // 反应延迟后才决定
      pr.seenT = (pr.seenT || 0) + dt;
      if (pr.seenT < D.react * 0.6) continue;
      this.seen.add(pr);
      if (Math.random() < D.dodge) {
        if (along < 5 && f.grounded && f.canAct() && Math.random() < 0.5) inp.jump = true;
        else { const sg = lat >= 0 ? 1 : -1; this.dodgeT = 0.4; this.dodgeVec = [-pr.dz * sg, pr.dx * sg]; mx = this.dodgeVec[0]; mz = this.dodgeVec[1]; }
      }
    }
    // ---- 跳过冲击环 ----
    const pa = p.act;
    if (pa && pa.n === 3 && pa.blasted && f.grounded && !this.novaJumped && pa.ringR > d - 5.5 && pa.ringR < d + 0.5) {
      this.novaJumped = true;
      if (Math.random() < D.novaDodge) inp.jump = true;
    }
    if (!pa || pa.n !== 3) this.novaJumped = false;
    // ---- 避开流星预警 ----
    for (const fl of G.fallers) {
      if (fl.owner === f || fl.dead || fl.state !== 1) continue;
      const ddx = f.x - fl.x, ddz = f.z - fl.z, dd = Math.hypot(ddx, ddz);
      if (dd < 3.0 && Math.random() < D.dodge + 0.3) { mx = ddx / (dd || 1); mz = ddz / (dd || 1); }
    }

    // ---- 攻击决策 ----
    if (f.canAct() && this.nextAtk <= 0 && f.stun <= 0) {
      const clear = !w.blocked(f.x, f.z, p.x, p.z, 0.45, true);
      const r = Math.random();
      const wantA = r < D.aggr;
      if (wantA) {
        if (f.cd[3] <= 0 && d < 9 && (p.stun <= 0 || d < 5) && Math.random() < 0.55) this.fire(inp, 3);
        else if (f.cd[2] <= 0 && d > 4.5 && d < 13 && clear && Math.random() < 0.6) this.fire(inp, 2);
        else if (f.cd[1] <= 0 && d < 22 && clear) this.fire(inp, 1);
      }
      this.nextAtk = rand(0.25, 0.9) / Math.max(0.4, D.aggr);
    }
    // 偶尔跳跃
    if (f.grounded && Math.random() < dt * 0.15 && !f.act) inp.jump = true;

    // 攻击期间保持意图为 0（由 Fighter 自身减速）
    inp.mx = mx; inp.mz = mz;
    // 冲刺方向沿 input => 朝玩家：把移动意图在冲刺瞬间设为朝向玩家
    if (inp.a2) { inp.mx = Math.sin(toward); inp.mz = Math.cos(toward); }
    return inp;
  }
  fire(inp, n) {
    inp['a' + n] = true;
    const D = this.diff;
    this.err = (Math.random() - 0.5) * 2 * D.err;
  }
}
