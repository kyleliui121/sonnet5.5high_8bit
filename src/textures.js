// 程序化像素纹理：全部由 canvas 绘制，最近邻采样
import * as THREE from 'three';
import { rng } from './util.js';

const cache = {};

export function shade(hex, f) {
  let r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  r = Math.max(0, Math.min(255, r * f)); g = Math.max(0, Math.min(255, g * f)); b = Math.max(0, Math.min(255, b * f));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const px = (g, x, y, w, h, col) => { g.fillStyle = css(col); g.fillRect(x, y, w, h); };

export const T = {
  brick(base = 0xb5523b, mortar = 0x7a3a2c, seed = 1) {
    const k = `brick${base}${mortar}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      px(g, 0, 0, 16, 16, mortar);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let i = -1; i < 3; i++) {
          const x = i * 8 + off;
          px(g, x + 1, row * 4 + 1, 7, 3, shade(base, 0.88 + r() * 0.25));
        }
      }
    }));
  },
  plaster(base = 0xf3e6c8, seed = 2) {
    const k = `plaster${base}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      px(g, 0, 0, 16, 16, base);
      for (let i = 0; i < 26; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, 1, 1, shade(base, r() > 0.5 ? 0.9 : 1.06));
    }));
  },
  plank(base = 0x9a6a3c, seed = 3) {
    const k = `plank${base}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      for (let i = 0; i < 4; i++) {
        px(g, i * 4, 0, 4, 16, shade(base, 0.92 + r() * 0.16));
        px(g, i * 4 + 3, 0, 1, 16, shade(base, 0.62));
        px(g, i * 4 + 1, (r() * 14) | 0, 1, 2, shade(base, 0.75));
      }
    }));
  },
  stone(base = 0x9a9aa6, seed = 4) {
    const k = `stone${base}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      px(g, 0, 0, 16, 16, shade(base, 0.62));
      const rows = [[0, 5], [5, 6], [11, 5]];
      rows.forEach(([y, h], ri) => {
        let x = ri * 3;
        while (x < 16 + 6) {
          const w = 5 + ((r() * 4) | 0);
          px(g, x + 1, y + 1, w - 1, h - 1, shade(base, 0.9 + r() * 0.22));
          px(g, x + 1, y + 1, w - 1, 1, shade(base, 1.18));
          x += w;
        }
      });
    }));
  },
  roof(base = 0xc23b3b, seed = 5) {
    const k = `roof${base}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      px(g, 0, 0, 16, 16, shade(base, 0.5));
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 2 : 0;
        for (let i = -1; i < 4; i++) {
          const x = i * 4 + off;
          px(g, x, row * 4, 4, 3, shade(base, 0.92 + r() * 0.2));
          px(g, x, row * 4, 4, 1, shade(base, 1.22));
        }
      }
    }));
  },
  dirt(base = 0x7b5434, seed = 6) {
    const k = `dirt${base}`; if (cache[k]) return cache[k];
    const r = rng(seed);
    return (cache[k] = canvasTex(16, 16, (g) => {
      px(g, 0, 0, 16, 16, base);
      for (let i = 0; i < 60; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), 1, shade(base, 0.75 + r() * 0.5));
    }));
  },
  water() {
    if (cache.water) return cache.water;
    const r = rng(9);
    return (cache.water = canvasTex(32, 32, (g) => {
      px(g, 0, 0, 32, 32, 0x2a7fd6);
      for (let i = 0; i < 40; i++) {
        const x = (r() * 28) | 0, y = (r() * 32) | 0;
        px(g, x, y, 3 + ((r() * 3) | 0), 1, i % 3 ? 0x4aa0ee : 0x7fc6ff);
      }
      for (let i = 0; i < 20; i++) px(g, (r() * 32) | 0, (r() * 32) | 0, 2, 1, 0x1f66b8);
    }));
  },
  ground(size, ppu, draw) {
    return canvasTex(size * ppu, size * ppu, draw, false);
  },
  sky() {
    return canvasTex(2, 64, (g) => {
      const bands = [0x1b2a6b, 0x23398a, 0x2f4fae, 0x3e6ccb, 0x5589dc, 0x72a8ea, 0x93c4f2, 0xb5dcf6, 0xd6edf9, 0xf3f1d9, 0xffe6b0];
      const n = bands.length, h = 64 / n;
      bands.forEach((c, i) => px(g, 0, Math.floor(i * h), 2, Math.ceil(h) + 1, c));
    }, false);
  },
};
