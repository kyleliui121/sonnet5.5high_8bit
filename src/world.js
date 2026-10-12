// 沙盘地图：悬浮小岛 + 完整建筑（城堡/民居/风车/瞭望塔/集市/喷泉）+ 树木/路灯/围栏
import * as THREE from 'three';
import { T, shade, css } from './textures.js';
import { box, colMat, glowMat, texMat } from './voxel.js';
import { rng, RAINBOW } from './util.js';

export const HALF = 26;          // 岛半宽
export const BOUND = 24.2;       // 可活动范围

export function buildWorld(scene) {
  const colliders = [];
  const smokes = [];
  const animated = { blades: [], flags: [], clouds: [], water: null, glints: [] };
  const R = rng(77);

  // ---------- 碰撞辅助 ----------
  function addCollider(g, cx, cz, w, d, pad = 0) {
    // 局部盒 -> 世界 AABB（rot 为 90° 倍数）
    const rot = g.rotation.y, c = Math.cos(rot), s = Math.sin(rot);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = cx + sx * (w / 2 + pad), lz = cz + sz * (d / 2 + pad);
      const wx = g.position.x + lx * c + lz * s, wz = g.position.z - lx * s + lz * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
    }
    const col = { x0, x1, z0, z1 }; colliders.push(col); return col;
  }
  const toWorld = (g, lx, ly, lz) => {
    const rot = g.rotation.y, c = Math.cos(rot), s = Math.sin(rot);
    return { x: g.position.x + lx * c + lz * s, y: ly, z: g.position.z - lx * s + lz * c };
  };
  function group(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }

  // ---------- 材质 ----------
  const M = {
    wood: texMat(T.plank(0x7a4f2c)), woodL: texMat(T.plank(0xa97b48)), woodD: texMat(T.plank(0x57391f)),
    stone: texMat(T.stone(0x9a9aa8)), stoneD: texMat(T.stone(0x77778a)), stoneW: texMat(T.stone(0xc8c4b4)),
    glass: colMat(0x9fe3ff, { emissive: 0x2c6c92 }), dark: colMat(0x241818),
    gold: glowMat(0xffd54a),
  };

  // ---------- 灯光与天空 ----------
  scene.background = T.sky();
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x77906a, 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.position.set(-26, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 5; sc.far = 120;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // ---------- 地面（程序化像素贴图） ----------
  const PPU = 8;
  const plazaR = 9.5;
  const paths = [ // 道路：[x0,z0,x1,z1,宽]
    [0, -9, 0, -16.2, 3.2], [-9, -4, -14.2, -4, 2.6], [9, 6, 14.8, 6, 2.6], [-9, 13, -14, 13, 2.6], [9, -11, 14, -11, 2.4],
    [8, 14, 17, 18, 2.2],
  ];
  const groundTex = T.ground(HALF * 2, PPU, (g, W) => {
    const r = rng(5);
    const P = (x, z) => [(x + HALF) * PPU, (z + HALF) * PPU];
    const px = (x, y, w, h, c) => { g.fillStyle = css(c); g.fillRect(x, y, w, h); };
    // 草地
    px(0, 0, W, W, 0x5cb24c);
    for (let i = 0; i < 9000; i++) {
      const x = (r() * W) | 0, y = (r() * W) | 0;
      px(x, y, 1, 1, [0x4fa341, 0x66bf55, 0x57ab48, 0x73c95e][(r() * 4) | 0]);
    }
    for (let i = 0; i < 700; i++) { // 草丛
      const x = (r() * W) | 0, y = (r() * W) | 0;
      px(x, y, 1, 2, 0x3f8f37); px(x + 2, y + 1, 1, 2, 0x3f8f37);
    }
    // 深浅草地大色块
    for (let i = 0; i < 70; i++) {
      const x = (r() * W) | 0, y = (r() * W) | 0, w = 12 + ((r() * 30) | 0), h = 6 + ((r() * 14) | 0);
      g.globalAlpha = 0.16; px(x, y, w, h, r() > 0.5 ? 0x3c8a3a : 0x86d96a); g.globalAlpha = 1;
    }
    // 道路（泥土）
    for (const [x0, z0, x1, z1, w] of paths) {
      const [ax, ay] = P(x0, z0), [bx, by] = P(x1, z1);
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let i = 0; i <= n; i++) {
        const t = i / n, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t, hw = (w * PPU) / 2;
        for (let k = 0; k < 14; k++) {
          const ox = (r() - 0.5) * 2 * hw, oy = (r() - 0.5) * 2 * hw;
          const rr = Math.abs(bx - ax) > Math.abs(by - ay) ? [cx, cy + oy] : [cx + ox, cy];
          px(Math.floor(rr[0]), Math.floor(rr[1]), 2, 2, [0xd1ab6c, 0xc79f5f, 0xdbb87a][(r() * 3) | 0]);
        }
      }
    }
    // 岛边沙滩
    const sand = 1.6 * PPU;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, W - 1 - y);
      if (d < sand + ((x * 7 + y * 13) % 5 === 0 ? 1 : 0)) px(x, y, 1, 1, [0xe9d391, 0xdfc67f, 0xf1dd9f][((x + y * 3) % 7) % 3]);
    }
    // 中央广场（圆形鹅卵石）
    const [cx, cy] = P(0, 0);
    for (let y = -plazaR * PPU; y <= plazaR * PPU; y += 4) for (let x = -plazaR * PPU; x <= plazaR * PPU; x += 4) {
      const d = Math.hypot(x, y) / PPU;
      if (d > plazaR) continue;
      const ring = d > 6.6 && d < 7.3 || d > 3.2 && d < 3.7;
      const base = ring ? 0x8a7aa8 : [0xbab5a8, 0xc7c2b5, 0xada89c][(((x + y) >> 2) + 100) % 3];
      px(cx + x, cy + y, 4, 4, base);
      px(cx + x, cy + y + 3, 4, 1, shade(base, 0.8)); px(cx + x + 3, cy + y, 1, 4, shade(base, 0.8));
    }
    // 花
    const cols = [0xffffff, 0xffe85a, 0xff8ab8, 0xff5a5a, 0xb08aff];
    for (let i = 0; i < 260; i++) {
      const x = HALF + (r() - 0.5) * 2 * (HALF - 3), z = HALF + (r() - 0.5) * 2 * (HALF - 3);
      if (Math.hypot(x - HALF, z - HALF) < plazaR + 0.5) continue;
      const X = (x * PPU) | 0, Y = (z * PPU) | 0, c = cols[(r() * 5) | 0];
      px(X, Y, 1, 1, c); px(X + 1, Y, 1, 1, c); px(X, Y + 1, 1, 1, 0x2f7a32);
    }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // 悬崖
  const cliff = box(scene, texMat(T.dirt(0x80583a)), 0, -3.3, 0, HALF * 2, 3.3, HALF * 2, { cast: false });
  cliff.position.y = -3.3 / 2 - 0.02;
  box(scene, texMat(T.stone(0x6b6f80)), 0, -6.3, 0, HALF * 2 - 4, 3, HALF * 2 - 4, { cast: false });
  box(scene, texMat(T.dirt(0x5a3d28)), 0, -8.3, 0, HALF * 2 - 12, 2, HALF * 2 - 12, { cast: false });
  // 水
  const wt = T.water(); wt.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), new THREE.MeshBasicMaterial({ map: wt }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.2; scene.add(water);
  animated.water = wt;
  // 岸边浪花
  const foam = glowMat(0xe8f8ff);
  for (let i = 0; i < 4; i++) {
    const a = i % 2 === 0;
    const m = box(scene, foam, a ? 0 : (i === 1 ? 1 : -1) * (HALF + 0.35), -2.22, a ? (i === 0 ? 1 : -1) * (HALF + 0.35) : 0,
      a ? HALF * 2 + 1.4 : 0.5, 0.05, a ? 0.5 : HALF * 2 + 1.4, { cast: false, receive: false });
    animated.glints.push(m);
  }

  // ---------- 建筑 ----------
  function win(g, cx, cy, cz, axis, sgn, trim, flowers = false) {
    const w = new THREE.Group();
    w.position.set(cx, cy, cz);
    w.rotation.y = axis === 'z' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.add(w);
    box(w, colMat(shade(trim, 0.8)), 0, -0.1, 0.02, 1.7, 1.7, 0.16);
    box(w, M.glass, 0, 0.05, 0.1, 1.3, 1.3, 0.12);
    box(w, colMat(shade(trim, 0.8)), 0, 0.05, 0.17, 0.12, 1.3, 0.1);
    box(w, colMat(shade(trim, 0.8)), 0, 0.64, 0.17, 1.3, 0.12, 0.1);
    box(w, M.stoneW, 0, -0.25, 0.1, 2.0, 0.16, 0.4);
    box(w, colMat(trim), -1.12, -0.05, 0.12, 0.5, 1.6, 0.14);
    box(w, colMat(trim), 1.12, -0.05, 0.12, 0.5, 1.6, 0.14);
    if (flowers) {
      box(w, M.woodD, 0, -0.78, 0.4, 1.8, 0.38, 0.4);
      [-0.6, -0.2, 0.2, 0.6].forEach((x, i) => box(w, glowMat([0xff5a8a, 0xffe85a, 0xff7a4a, 0xffffff][i]), x, -0.4, 0.4, 0.3, 0.3, 0.3));
    }
    return w;
  }

  function house(o) {
    const g = group(o.x, o.z, o.rot || 0);
    const { w, d, h } = o;
    const wall = texMat(o.wall), roofM = texMat(T.roof(o.roofCol));
    const y0 = 0.6;
    box(g, M.stone, 0, 0, 0, w + 0.5, y0, d + 0.5);
    box(g, wall, 0, y0, 0, w, h, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.wood, sx * w / 2, y0, sz * d / 2, 0.5, h, 0.5);
    for (const sz of [-1, 1]) {
      box(g, M.wood, 0, y0 + h - 0.45, sz * (d / 2 + 0.02), w, 0.45, 0.14);
      box(g, M.wood, 0, y0 + h * 0.45, sz * (d / 2 + 0.02), w, 0.25, 0.12);
    }
    for (const sx of [-1, 1]) box(g, M.wood, sx * (w / 2 + 0.02), y0 + h - 0.45, 0, 0.14, 0.45, d);
    // 门
    const dz = d / 2;
    box(g, colMat(0x4b2f18), 0, y0, dz + 0.04, 2.2, 3.2, 0.2);
    box(g, colMat(o.door), 0, y0, dz + 0.14, 1.8, 2.9, 0.14);
    box(g, colMat(shade(o.door, 0.7)), 0, y0 + 1.4, dz + 0.24, 1.8, 0.14, 0.06);
    box(g, M.gold, 0.55, y0 + 1.3, dz + 0.26, 0.2, 0.2, 0.1);
    box(g, M.stoneW, 0, 0, dz + 0.9, 3.0, 0.3, 1.2);
    // 窗
    const wx = w / 2 - 1.5;
    win(g, -wx, y0 + 2.0, dz + 0.02, 'z', 1, o.trim, true);
    win(g, wx, y0 + 2.0, dz + 0.02, 'z', 1, o.trim, true);
    win(g, 0, y0 + 2.0, -dz - 0.02, 'z', -1, o.trim);
    win(g, w / 2 + 0.02, y0 + 2.0, 0, 'x', 1, o.trim);
    win(g, -w / 2 - 0.02, y0 + 2.0, 0, 'x', -1, o.trim);
    // 屋顶（阶梯式山墙）
    const lh = 0.6, stepX = 0.62, roofLen = d + 0.6;
    let rw = w + 1.6, y = y0 + h, layers = 0;
    while (rw > 0.6) {
      box(g, roofM, 0, y, 0, rw, lh, roofLen);
      if (rw - 1.0 > 0.4) for (const sz of [-1, 1]) box(g, wall, 0, y, sz * (d / 2 + 0.16), rw - 1.1, lh - 0.02, 0.18);
      y += lh; rw -= stepX * 2; layers++;
    }
    box(g, colMat(shade(o.roofCol, 0.7)), 0, y, 0, 0.8, 0.3, roofLen + 0.2);
    const peak = y + 0.3;
    if (o.chimney) {
      const cx = w * 0.27, cz = -d * 0.18;
      box(g, texMat(T.brick(0x9b4a38, 0x6b3328)), cx, y0 + h, cz, 1.2, peak - (y0 + h) + 0.9, 1.2);
      box(g, M.stoneD, cx, peak + 0.9, cz, 1.5, 0.3, 1.5);
      smokes.push(toWorld(g, cx, peak + 1.3, cz));
    }
    if (o.sign) { // 招牌
      box(g, M.woodD, -w / 2 - 0.9, 3.2, dz - 0.6, 0.18, 0.18, 1.6);
      box(g, M.woodD, -w / 2 - 0.9, 4.4, dz - 0.6, 0.18, 1.3, 0.18);
      box(g, colMat(0xe9c46a), -w / 2 - 0.9, 2.2, dz, 0.2, 1.2, 1.5);
    }
    addCollider(g, 0, 0, w + 0.6, d + 0.6).h = h + 4.2;
    return g;
  }

  function pyramid(g, mat, cx, y, cz, w, d, lh, step, capMat) {
    let x = w, z = d, yy = y;
    while (x > 0.5 && z > 0.5) { box(g, mat, cx, yy, cz, x, lh, z); yy += lh; x -= step * 2; z -= step * 2; }
    return yy;
  }

  function castle(o) {
    const g = group(o.x, o.z, o.rot || 0);
    const kw = 9.5, kd = 7, kh = 9, tw = 4.0, th = 13;
    box(g, M.stoneD, 0, 0, 0, kw + 0.6, 0.8, kd + 0.6);
    box(g, M.stone, 0, 0.8, 0, kw, kh, kd);
    // 城垛
    const merlons = (len, axis, fix, y, step = 1.7) => {
      for (let t = -len / 2 + 0.5; t <= len / 2 - 0.4; t += step) {
        if (axis === 'x') box(g, M.stoneW, t, y, fix, 0.9, 1.0, 0.7); else box(g, M.stoneW, fix, y, t, 0.7, 1.0, 0.9);
      }
    };
    box(g, M.stoneW, 0, 0.8 + kh, 0, kw + 0.3, 0.4, kd + 0.3);
    merlons(kw, 'x', kd / 2 + 0.05, 0.8 + kh + 0.4); merlons(kw, 'x', -kd / 2 - 0.05, 0.8 + kh + 0.4);
    // 中央小塔楼
    box(g, M.stone, 0, 0.8 + kh + 0.4, 0, 3.4, 3.4, 3.2);
    const ty = pyramid(g, texMat(T.roof(0x3b6fd6)), 0, 0.8 + kh + 3.8, 0, 4.6, 4.4, 0.6, 0.5);
    box(g, M.woodD, 0, ty, 0, 0.14, 2.2, 0.14);
    const flag = box(g, glowMat(0xff4a6a), 0.7, ty + 1.2, 0, 1.4, 0.9, 0.1); animated.flags.push(flag);
    win(g, 0, 0.8 + kh + 2.4, 1.6 + 0.02, 'z', 1, 0xc9a24a);
    // 四角塔
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tx = sx * kw / 2, tz = sz * kd / 2 * 1.0;
      box(g, M.stoneD, tx, 0, tz, tw + 0.5, 0.8, tw + 0.5);
      box(g, M.stone, tx, 0.8, tz, tw, th, tw);
      box(g, M.stoneW, tx, 0.8 + th, tz, tw + 0.9, 0.7, tw + 0.9);
      box(g, M.stoneD, tx, 0.8 + th - 4.5, tz, tw + 0.2, 0.3, tw + 0.2);
      const topy = pyramid(g, texMat(T.roof(0xc23b3b)), tx, 0.8 + th + 0.7, tz, tw + 1.2, tw + 1.2, 0.65, 0.5);
      box(g, M.woodD, tx, topy, tz, 0.14, 2.0, 0.14);
      const fl = box(g, glowMat([0xffd54a, 0xff4a6a, 0x4adfff, 0x9aff6a][(sx + 1) + (sz + 1) / 2]), tx + 0.7, topy + 1.2, tz, 1.4, 0.8, 0.1);
      animated.flags.push(fl);
      // 箭窗
      for (const [ax, sg] of [['z', sz], ['x', sx]]) {
        const ox = ax === 'z' ? tx : tx + sg * (tw / 2 + 0.02), oz = ax === 'z' ? tz + sg * (tw / 2 + 0.02) : tz;
        const w = new THREE.Group(); w.position.set(ox, 9.5, oz); g.add(w);
        w.rotation.y = ax === 'z' ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2);
        box(w, M.dark, 0, -0.9, 0, 0.5, 1.8, 0.2); box(w, M.glass, 0, -0.9, 0.05, 0.3, 1.5, 0.2);
      }
    }
    // 大门（前面 +z）
    const fz = kd / 2;
    box(g, M.stoneW, 0, 0.8, fz + 0.1, 4.0, 4.9, 0.3);
    box(g, M.dark, 0, 0.8, fz + 0.2, 3.0, 3.9, 0.3);
    box(g, M.dark, 0, 4.7, fz + 0.2, 2.2, 0.5, 0.3);
    box(g, M.woodD, -0.78, 0.8, fz + 0.32, 1.45, 3.9, 0.2); box(g, M.woodD, 0.78, 0.8, fz + 0.32, 1.45, 3.9, 0.2);
    for (const yy of [1.5, 3.2]) box(g, colMat(0x2d2d38), 0, yy, fz + 0.45, 3.0, 0.25, 0.08);
    box(g, M.gold, -0.3, 2.6, fz + 0.45, 0.25, 0.25, 0.1); box(g, M.gold, 0.3, 2.6, fz + 0.45, 0.25, 0.25, 0.1);
    box(g, M.stoneW, 0, 0, fz + 1.7, 4.8, 0.3, 2.2); box(g, M.stoneW, 0, 0, fz + 2.4, 5.8, 0.15, 1.2);
    // 挂旗
    for (const sx of [-1, 1]) {
      box(g, colMat(0xc22d4a), sx * 3.5, 4.6, fz + 0.15, 1.3, 4.0, 0.1);
      box(g, M.gold, sx * 3.5, 4.6, fz + 0.2, 0.6, 0.6, 0.06);
      box(g, M.gold, sx * 3.5, 4.4, fz + 0.2, 0.3, 1.4, 0.06);
    }
    // 窗
    for (const sx of [-1, 1]) win(g, sx * 3.7, 7.2 + 0.2, fz + 0.02, 'z', 1, 0xc9a24a);
    win(g, -1.1, 7.2, fz + 0.02, 'z', 1, 0xc9a24a); win(g, 1.1, 7.2, fz + 0.02, 'z', 1, 0xc9a24a);
    // 侧翼城墙
    for (const sx of [-1, 1]) {
      const wl = 6.5, cx = sx * (kw / 2 + tw / 2 + wl / 2 - 0.5);
      box(g, M.stone, cx, 0, 0, wl, 5.5, 1.8);
      box(g, M.stoneW, cx, 5.5, 0, wl, 0.3, 2.2);
      merlons(wl, 'x', 0.9 + 0.05, 5.8, 1.6); merlons(wl, 'x', -0.9 - 0.05, 5.8, 1.6);
      for (let k = 0; k < 2; k++) { const w = new THREE.Group(); w.position.set(cx - 1.5 + k * 3, 3.2, 0.92); g.add(w); box(w, M.dark, 0, 0, 0, 0.5, 1.5, 0.15); }
    }
    addCollider(g, 0, 0, kw + tw + 0.8, kd + tw + 0.8).h = 16;
    for (const sx of [-1, 1]) addCollider(g, sx * (kw / 2 + tw / 2 + 2.75), 0, 6.5, 2.4).h = 6.5;
    return g;
  }

  function windmill(o) {
    const g = group(o.x, o.z, o.rot || 0);
    box(g, M.stoneD, 0, 0, 0, 7, 1.0, 7);
    const sizes = [5.4, 5.0, 4.6, 4.2, 3.8, 3.4];
    const plaster = texMat(T.plaster(0xf0e6d2)), bk = texMat(T.brick(0xc7694c, 0x7a3a2c));
    let y = 1.0;
    sizes.forEach((s, i) => { box(g, i % 3 === 2 ? bk : plaster, 0, y, 0, s, 1.9, s); y += 1.9; });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.woodD, sx * 2.0, 1.0, sz * 2.0, 0.4, y - 1.0, 0.4);
    box(g, M.wood, 0, y, 0, 4.2, 0.4, 4.2);
    const top = pyramid(g, texMat(T.roof(0x3f5fb0)), 0, y + 0.4, 0, 4.8, 4.8, 0.55, 0.45);
    box(g, M.woodD, 0, top, 0, 0.14, 1.0, 0.14);
    // 门窗
    const dz = 2.7;
    box(g, colMat(0x4b2f18), 0, 1.0, dz, 1.9, 3.0, 0.2); box(g, colMat(0x9a4f2c), 0, 1.0, dz + 0.1, 1.5, 2.7, 0.14);
    win(g, 2.52, 4.0, 0, 'x', 1, 0xa97b48); win(g, -2.52, 4.0, 0, 'x', -1, 0xa97b48);
    win(g, 0, 4.0, 2.52, 'z', 1, 0xa97b48);
    // 风车叶（朝前 +z）
    const hub = new THREE.Group(); hub.position.set(0, 8.4, 3.0); g.add(hub);
    box(g, M.woodD, 0, 7.9, 2.5, 0.7, 0.9, 1.2);
    box(hub, M.woodD, 0, -0.35, 0, 0.9, 0.7, 0.9);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; hub.add(arm);
      box(arm, M.woodL, 0, 0.3, 0.05, 0.4, 7.4, 0.3);
      box(arm, colMat(0xf4efe3), 0.95, 2.2, 0.0, 1.5, 4.8, 0.14);
      for (let r = 0; r < 4; r++) box(arm, M.wood, 0.95, 2.2 + r * 1.2 - 0.0, 0.1, 1.5, 0.1, 0.1);
    }
    animated.blades.push(hub);
    addCollider(g, 0, 0, 7.4, 7.4).h = 14;
    return g;
  }

  function watchtower(o) {
    const g = group(o.x, o.z, o.rot || 0);
    box(g, M.stoneD, 0, 0, 0, 4.6, 0.6, 4.6);
    const base = texMat(T.stone(0xa8a090));
    box(g, base, 0, 0.6, 0, 3.8, 6.4, 3.8);
    box(g, M.wood, 0, 7.0, 0, 5.0, 0.4, 5.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.woodD, sx * 2.2, 7.4, sz * 2.2, 0.35, 2.8, 0.35);
    for (const s of [-1, 1]) {
      box(g, M.wood, 0, 7.4, s * 2.35, 4.6, 0.8, 0.2); box(g, M.wood, s * 2.35, 7.4, 0, 0.2, 0.8, 4.6);
    }
    const rm = texMat(T.roof(0x2f9a6a));
    const top = pyramid(g, rm, 0, 10.2, 0, 6.2, 6.2, 0.6, 0.5);
    box(g, M.woodD, 0, top, 0, 0.14, 1.6, 0.14);
    const fl = box(g, glowMat(0xffd54a), 0.7, top + 0.9, 0, 1.4, 0.8, 0.1); animated.flags.push(fl);
    box(g, M.dark, 0, 0.6, 1.92, 1.6, 2.6, 0.2); box(g, M.woodD, 0, 0.6, 2.0, 1.3, 2.4, 0.12);
    win(g, 0, 4.8, 1.92, 'z', 1, 0x77778a);
    win(g, 1.92, 4.8, 0, 'x', 1, 0x77778a); win(g, -1.92, 4.8, 0, 'x', -1, 0x77778a);
    // 梯子
    for (let k = 0; k < 7; k++) box(g, M.woodL, 2.0, 0.8 + k * 1.0, -0.8, 0.12, 0.12, 1.2);
    box(g, M.woodL, 2.0, 0.6, -1.4, 0.12, 7, 0.12); box(g, M.woodL, 2.0, 0.6, -0.2, 0.12, 7, 0.12);
    addCollider(g, 0, 0, 5.0, 5.0).h = 12;
    return g;
  }

  function stall(o) {
    const g = group(o.x, o.z, o.rot || 0);
    const w = 4.4, d = 2.4;
    for (const sx of [-1, 1]) {
      box(g, M.wood, sx * w / 2, 0, -d / 2, 0.3, 3.6, 0.3); box(g, M.wood, sx * w / 2, 0, d / 2, 0.3, 3.0, 0.3);
    }
    box(g, M.woodL, 0, 0, 0.2, w - 0.4, 1.2, 1.2);
    box(g, M.woodD, 0, 1.2, 0.2, w - 0.2, 0.2, 1.4);
    // 条纹顶棚（前低后高）
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 - 0.2 + ((w + 0.4) / n) * (i + 0.5);
      box(g, colMat(i % 2 ? 0xffffff : o.color), x, 3.55, 0, (w + 0.4) / n, 0.25, d + 0.9);
      box(g, colMat(i % 2 ? 0xffffff : o.color), x, 3.0, d / 2 + 0.5, (w + 0.4) / n, 0.7, 0.2);
    }
    // 商品
    const goods = o.goods || [0xff4a4a, 0xffb02e, 0x7aff5a];
    for (let i = 0; i < 6; i++) {
      box(g, glowMat(goods[i % 3]), -1.6 + i * 0.64, 1.4, 0.2 + ((i % 2) - 0.5) * 0.4, 0.45, 0.45, 0.45);
    }
    box(g, M.woodD, w / 2 + 0.9, 0, 0, 1.1, 1.1, 1.1); box(g, M.woodD, w / 2 + 0.9, 1.1, 0.1, 0.8, 0.8, 0.8);
    addCollider(g, 0.4, 0.2, w + 1.6, 2.8).h = 3.8;
    return g;
  }

  function fountain(x, z) {
    const g = group(x, z);
    box(g, M.stoneW, 0, 0, 0, 5.6, 0.5, 5.6);
    box(g, M.stone, 0, 0.5, 0, 5.2, 0.7, 5.2);
    const water = box(g, colMat(0x4ab8ff, { emissive: 0x1a5a9a }), 0, 1.0, 0, 4.4, 0.35, 4.4, { cast: false });
    animated.glints.push(water);
    box(g, M.stoneW, 0, 0.5, 0, 1.3, 2.6, 1.3);
    box(g, M.stone, 0, 3.0, 0, 2.6, 0.4, 2.6);
    box(g, colMat(0x4ab8ff, { emissive: 0x1a5a9a }), 0, 3.4, 0, 2.2, 0.2, 2.2, { cast: false });
    box(g, M.stoneW, 0, 3.4, 0, 0.7, 1.2, 0.7);
    const star = box(g, glowMat(0xffe85a), 0, 4.7, 0, 0.8, 0.8, 0.8);
    animated.blades.push({ star, isStar: true });
    { const c = addCollider(g, 0, 0, 5.8, 5.8); c.low = true; c.h = 4.8; }
    smokes.push({ x, y: 4, z, water: true });
  }

  function tree(x, z, kind = 0, s = 1) {
    const g = group(x, z);
    const leaf = [0x3f9e45, 0x4cae4c, 0x2f8a46, 0x58b950][(R() * 4) | 0];
    if (kind === 0) { // 圆冠
      box(g, M.woodD, 0, 0, 0, 0.8 * s, 2.6 * s, 0.8 * s);
      box(g, colMat(leaf), 0, 2.4 * s, 0, 3.8 * s, 1.3 * s, 3.8 * s);
      box(g, colMat(shade(leaf, 1.1)), 0, 3.7 * s, 0, 3.0 * s, 1.1 * s, 3.0 * s);
      box(g, colMat(shade(leaf, 1.2)), 0, 4.8 * s, 0, 1.8 * s, 0.9 * s, 1.8 * s);
      box(g, colMat(shade(leaf, 0.9)), 1.7 * s, 2.7 * s, 0.6 * s, 1.6 * s, 1.1 * s, 1.6 * s);
    } else { // 松树
      const pine = 0x2a7a4a;
      box(g, M.woodD, 0, 0, 0, 0.7 * s, 1.6 * s, 0.7 * s);
      [[3.8, 0], [3.0, 1], [2.2, 2], [1.4, 3]].forEach(([w, i]) => box(g, colMat(shade(pine, 1 + i * 0.1)), 0, (1.4 + i * 1.15) * s, 0, w * s, 1.25 * s, w * s));
      box(g, M.gold, 0, 5.9 * s, 0, 0.5 * s, 0.5 * s, 0.5 * s);
    }
    colliders.push({ x0: x - 0.7, x1: x + 0.7, z0: z - 0.7, z1: z + 0.7, h: 5.5 * s });
  }
  function bush(x, z) {
    const g = group(x, z);
    const c = colMat([0x3f9e45, 0x4cae4c][(R() * 2) | 0]);
    box(g, c, 0, 0, 0, 1.6, 1.1, 1.6);
    box(g, colMat(0x58b950), 0.2, 1.0, 0, 1.0, 0.5, 1.0);
    [0xff5a8a, 0xffe85a, 0xffffff].forEach((cc, i) => box(g, glowMat(cc), -0.8 + 0.15, 0.4 + i * 0.3, 0.5 - i * 0.5, 0.25, 0.25, 0.25));
  }
  function lamp(x, z) {
    const g = group(x, z);
    box(g, M.stoneD, 0, 0, 0, 0.9, 0.5, 0.9);
    box(g, colMat(0x333344), 0, 0.5, 0, 0.3, 3.6, 0.3);
    box(g, colMat(0x333344), 0, 4.0, 0, 1.1, 0.2, 1.1);
    box(g, glowMat(0xfff0a0), 0, 4.2, 0, 0.8, 0.9, 0.8, { cast: false });
    box(g, colMat(0x333344), 0, 5.1, 0, 1.1, 0.2, 1.1);
    colliders.push({ x0: x - 0.45, x1: x + 0.45, z0: z - 0.45, z1: z + 0.45, h: 5.2 });
  }
  function crates(x, z, rot = 0) {
    const g = group(x, z, rot);
    box(g, M.woodL, 0, 0, 0, 1.5, 1.5, 1.5); box(g, M.woodL, 1.6, 0, 0.3, 1.3, 1.3, 1.3);
    box(g, M.woodL, 0.3, 1.5, 0, 1.1, 1.1, 1.1);
    const b = box(g, M.woodD, -1.4, 0, 0.8, 1.0, 1.4, 1.0); box(g, colMat(0x888890), -1.4, 0.3, 0.8, 1.1, 0.12, 1.1); box(g, colMat(0x888890), -1.4, 1.0, 0.8, 1.1, 0.12, 1.1);
    { const c = addCollider(g, 0.2, 0.4, 4.4, 2.2); c.low = true; c.h = 2.6; }
  }
  function rock(x, z, s = 1) {
    const g = group(x, z, R() * 3);
    const c = colMat(0x8d8d99);
    box(g, c, 0, 0, 0, 2 * s, 1.1 * s, 1.7 * s); box(g, colMat(0xa6a6b2), 0.2, 1.0 * s, 0, 1.2 * s, 0.7 * s, 1.0 * s);
    colliders.push({ x0: x - 1 * s, x1: x + 1 * s, z0: z - 0.9 * s, z1: z + 0.9 * s, low: true, h: 2 });
  }
  function fenceLine(x0, z0, x1, z1) {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 2.2);
    const dx = (x1 - x0) / n, dz = (z1 - z0) / n, ang = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) {
      const g = group(x0 + dx * i, z0 + dz * i, ang);
      box(g, M.woodL, 0, 0, 0, 0.3, 1.5, 0.3);
      if (i < n) { g.rotation.y = ang + Math.PI / 2; box(g, M.wood, 1.1, 0.55, 0, 2.2, 0.2, 0.14); box(g, M.wood, 1.1, 1.0, 0, 2.2, 0.2, 0.14); }
    }
  }

  // ---------- 布局 ----------
  castle({ x: 0, z: -21.2 });
  house({ x: -18.5, z: -4, rot: Math.PI / 2, w: 8, d: 6.4, h: 3.8, wall: T.plaster(0xf3e6c8), roofCol: 0xc23b3b, door: 0x9a4f2c, trim: 0x6b4a2c, chimney: true });
  house({ x: 19.2, z: 6, rot: -Math.PI / 2, w: 8, d: 6.4, h: 4.0, wall: T.plaster(0xcfe4f2), roofCol: 0x3b6fd6, door: 0x2f7a8a, trim: 0x4a5a7a, chimney: true });
  house({ x: -18, z: 14.5, rot: Math.PI / 2, w: 9, d: 7, h: 4.2, wall: T.brick(0xc7694c, 0x8a5a48), roofCol: 0x6a3fa8, door: 0x5b3a1e, trim: 0x57391f, chimney: true, sign: true });
  windmill({ x: 19.5, z: -12, rot: -Math.PI / 2 });
  watchtower({ x: 19, z: 19.5, rot: -Math.PI / 2 });
  stall({ x: -6, z: 20.5, rot: Math.PI, color: 0xe24a4a });
  stall({ x: 4.6, z: 21, rot: Math.PI, color: 0x3ba0e2, goods: [0xffe85a, 0xff8ab8, 0xb08aff] });
  fountain(0, 0);
  crates(-12.5, 7.5, 0.4); crates(13, -2.2, -0.5);
  rock(-10, -13, 1.1); rock(12.5, 14, 0.9); rock(-22, 3, 0.8);
  for (const [x, z] of [[-6.6, -6.6], [6.6, -6.6], [-6.6, 6.6], [6.6, 6.6]]) lamp(x, z);
  const treeSpots = [[-22, -12, 0], [-23.5, -20, 1], [-14, -14, 1], [14, -18, 0], [23, -20, 1], [-22.5, 8, 0], [-11, 22, 1], [10, 23, 0],
    [23, 12, 1], [24, -3, 0], [-23, 21, 1], [14, 10.5, 1], [-13, -7.5, 0], [12, -7, 1], [8, 17, 0], [-9, 15, 1], [22.5, 25 - 3, 0], [-5, -14.5, 1], [6, -14, 0]];
  treeSpots.forEach(([x, z, k]) => tree(x, z, k, 0.9 + R() * 0.4));
  for (let i = 0; i < 18; i++) {
    const x = (R() - 0.5) * 2 * 22.5, z = (R() - 0.5) * 2 * 22.5;
    if (Math.hypot(x, z) < 11) continue;
    if (colliders.some((c) => x > c.x0 - 1.8 && x < c.x1 + 1.8 && z > c.z0 - 1.8 && z < c.z1 + 1.8)) continue;
    bush(x, z);
  }
  const fz = HALF - 0.6;
  fenceLine(-fz, fz, fz, fz); fenceLine(-fz, -fz, -fz, fz); fenceLine(fz, -fz, fz, fz);
  fenceLine(-fz, -fz, -6, -fz); fenceLine(6, -fz, fz, -fz);

  // 装饰：浮云 + 远处小岛
  const cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    const n = 3 + ((R() * 3) | 0);
    for (let k = 0; k < n; k++) box(c, cloudM, k * 2.2 - n, 0, (R() - 0.5) * 1.5, 3 + R() * 2.5, 1.2 + R() * 0.9, 2.2 + R() * 1.5, { cast: false, receive: false });
    const a = R() * Math.PI * 2, rr = 55 + R() * 55;
    c.position.set(Math.cos(a) * rr, 16 + R() * 20, Math.sin(a) * rr);
    scene.add(c); animated.clouds.push(c);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4, rr = 62 + R() * 30;
    const g = group(Math.cos(a) * rr, Math.sin(a) * rr);
    const s = 5 + R() * 6;
    box(g, colMat(0x5cb24c), 0, -2.2, 0, s, 2.2, s, { cast: false, receive: false });
    box(g, texMat(T.dirt(0x80583a)), 0, -4.5, 0, s - 1, 2.3, s - 1, { cast: false, receive: false });
    box(g, M.woodD, 0, 0, 0, 0.7, 2.4, 0.7, { cast: false }); box(g, colMat(0x3f9e45), 0, 2, 0, 3.4, 2.4, 3.4, { cast: false });
  }

  // ---------- 查询 ----------
  const api = {
    scene, colliders, bound: BOUND,
    /** 圆 vs AABB 推出，同时限制在岛内 */
    resolve(o, r) {
      for (let it = 0; it < 2; it++) for (const c of colliders) {
        const nx = Math.max(c.x0, Math.min(o.x, c.x1)), nz = Math.max(c.z0, Math.min(o.z, c.z1));
        let dx = o.x - nx, dz = o.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2); o.x = nx + (dx / d) * r; o.z = nz + (dz / d) * r; }
          else { // 中心在盒内：沿最小穿透轴推出
            const l = o.x - c.x0, rr = c.x1 - o.x, t = o.z - c.z0, b = c.z1 - o.z, m = Math.min(l, rr, t, b);
            if (m === l) o.x = c.x0 - r; else if (m === rr) o.x = c.x1 + r; else if (m === t) o.z = c.z0 - r; else o.z = c.z1 + r;
          }
          o.hitWall = true;
        }
      }
      o.x = Math.max(-BOUND, Math.min(BOUND, o.x)); o.z = Math.max(-BOUND, Math.min(BOUND, o.z));
    },
    inside(x, z, pad = 0, proj = false) { return colliders.some((c) => !(proj && c.low) && x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad); },
    /** 射线(水平)到最近 AABB(膨胀 pad) 的距离，未命中返回 maxT */
    rayClip(ox, oz, dx, dz, maxT, pad = 0, proj = false, cam = null) {
      let best = maxT;
      for (const c of colliders) {
        if (proj && c.low) continue;
        let t0 = 0, t1 = best;
        for (const [o, d, lo, hi] of [[ox, dx, c.x0 - pad, c.x1 + pad], [oz, dz, c.z0 - pad, c.z1 + pad]]) {
          if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { t1 = -1; break; } }
          else {
            let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
            t0 = Math.max(t0, a); t1 = Math.min(t1, b);
            if (t0 > t1) { t1 = -1; break; }
          }
        }
        if (t1 >= 0 && t0 <= t1 && t0 > 0 && t0 < best) {
          if (cam && ((c.h ?? 99) < 7 || (c.h ?? 99) + 0.8 < cam.y0 + cam.slope * t0)) continue;
          best = t0;
        }
      }
      return Math.max(0.1, best - 0.2);
    },
    blocked(ax, az, bx, bz, pad = 0.5, proj = false) {
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
      if (l < 0.01) return false;
      return this.rayClip(ax, az, dx / l, dz / l, l, pad, proj) < l - 0.35;
    },
    update(dt, t, fx) {
      for (const h of animated.blades) {
        if (h.isStar) { h.star.rotation.y += dt * 2; h.star.rotation.x += dt * 1.2; h.star.position.y = 4.7 + Math.sin(t * 2) * 0.15; }
        else h.rotation.z -= dt * 0.9;
      }
      animated.flags.forEach((f, i) => { f.scale.x = 1 + Math.sin(t * 5 + i) * 0.12; f.rotation.y = Math.sin(t * 4 + i) * 0.25; });
      animated.water.offset.x = (t * 0.02) % 1; animated.water.offset.y = (t * 0.012) % 1;
      animated.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + (i % 3) * 0.2); if (c.position.x > 120) c.position.x = -120; });
      // 烟 & 喷泉
      if (Math.random() < dt * 6) for (const s of smokes) {
        if (s.water) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * 6.28;
            fx.emit({ x: s.x, y: s.y + 0.5, z: s.z, vx: Math.cos(a) * 1.2, vy: 5.5 + Math.random() * 2, vz: Math.sin(a) * 1.2, life: 0.9, size: 0.22, color: 0xbfe8ff, grav: 11, shrink: false });
          }
        } else fx.emit({ x: s.x, y: s.y, z: s.z, vx: 0.5 + Math.random() * 0.4, vy: 1.6, vz: 0.1, life: 2.2, size: 0.55, color: 0xe8e8f0, grav: -0.1, grow: true });
      }
    },
  };
  return api;
}
