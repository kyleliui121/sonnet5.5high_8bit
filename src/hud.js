// HTML HUD（960x540 逻辑坐标）
import * as THREE from 'three';
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.g = [100, 100]; this.bannerT = 0;
    this.vec = new THREE.Vector3();
  }
  setNames(f1, f2) {
    $('n1').innerHTML = `<span style="color:${f1.def.hud}">${f1.def.name}</span><small>${f1.def.cn}</small>`;
    $('n2').innerHTML = `<small>${f2.def.cn}</small><span style="color:${f2.def.hud}">${f2.def.name}</span>`;
  }
  setPips(w1, w2, need = 2) {
    const mk = (n) => Array.from({ length: need }, (_, i) => `<span class="pip ${i < n ? 'on' : ''}"></span>`).join('');
    $('pips1').innerHTML = mk(w1); $('pips2').innerHTML = mk(w2);
  }
  setRound(txt) { $('round').textContent = txt; }
  setTimer(t) { $('timer').textContent = String(Math.max(0, Math.ceil(t))); }
  update(dt, f1, f2, cdMax) {
    [f1, f2].forEach((f, i) => {
      const p = (f.hp / f.maxHp) * 100;
      this.g[i] = Math.max(p, this.g[i] - dt * 35);
      const fill = $('f' + (i + 1)), gh = $('g' + (i + 1));
      fill.style.width = p + '%'; gh.style.width = this.g[i] + '%';
      fill.style.background = p > 50 ? '#5cff6a' : p > 25 ? '#ffd83a' : '#ff4a4a';
    });
    for (const k of [1, 2, 3]) {
      const el = $('sk' + k), cd = f1.cd[k];
      el.querySelector('.cd').style.height = (cd / cdMax[k]) * 100 + '%';
      el.querySelector('.cdt').textContent = cd > 0 ? cd.toFixed(1) : '';
      el.classList.toggle('ready', cd <= 0);
    }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0 && !this.keep) this.clearBanner(); }
  }
  resetBars() { this.g = [100, 100]; }
  banner(text, color = '#fff', sec = 1.2, small = false, keep = false) {
    const b = $('banner');
    b.className = 'txt' + (small ? ' sub' : '');
    b.style.color = color; b.textContent = text;
    void b.offsetWidth; b.classList.add('show'); b.style.opacity = 1;
    this.bannerT = sec; this.keep = keep;
  }
  clearBanner() { const b = $('banner'); b.classList.remove('show'); b.style.opacity = 0; this.bannerT = 0; }
  hint(t) { $('hint').textContent = t; }
  floater(text, x, y, z, color, camera) {
    this.vec.set(x, y, z).project(camera);
    if (this.vec.z > 1) return;
    const d = document.createElement('div');
    d.textContent = text; d.style.color = color;
    d.style.left = (this.vec.x * 0.5 + 0.5) * 960 + 'px'; d.style.top = (-this.vec.y * 0.5 + 0.5) * 540 + 'px';
    $('floaters').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  flash(v, col) { const f = $('flash'); f.style.background = col; f.style.opacity = v; }
  screen(id, show) { $(id).classList.toggle('hide', !show); }
  setDiff(txt) { $('diffTxt').textContent = txt; }
}
