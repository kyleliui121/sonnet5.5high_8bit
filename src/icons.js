// 程序化像素图标：技能键 / 跳跃键 / App图标(Luna wink头像)
// 图标 = { size, rows:[string], pal:{ch:color} }，导出时按 scale 放大绘制
export function drawMap(ctx, icon, scale = 1) {
  const bad = icon.rows.filter((r) => r.length !== icon.size);
  if (bad.length) console.warn('icon rows bad:', icon.name, bad);
  icon.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const c = icon.pal[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
}
export function renderIcon(icon, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = icon.size * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawMap(g, icon, scale);
  return c;
}

// ---------- ★ 星光弹 ----------
export const ICON_STAR = {
  name: 'star', size: 16,
  pal: { k: '#8a5a00', y: '#ffd83a', l: '#fff3b0', w: '#ffffff' },
  rows: [
    '.............ww.',
    '......kk....ww..',
    '......kyk.......',
    '.....kyyyk......',
    '.....kyylk......',
    '.kkkkyyyyykkkk..',
    '..kyyyyyyyyyyk..',
    '..kyylyyyyyyyk..',
    '...kyyyyyyyyk...',
    '....kyyyyyyk....',
    '....kyyyyyyk....',
    '...kyyk..kyyk...',
    '...kyk....kyk...',
    '...kk......kk...',
    '................',
    '................',
  ],
};

// ---------- 🌈 彩虹冲刺：七色彩带 + 星头 ----------
export const ICON_DASH = {
  name: 'dash', size: 16,
  pal: { k: '#3a2a00', r: '#ff3b3b', o: '#ff9a2e', y: '#ffe83b', g: '#4cff5a', b: '#3bc8ff', p: '#c04bff', w: '#ffffff', s: '#ffd83a' },
  rows: [
    '................',
    '................',
    '..ww............',
    '...wwkkkkkkk....',
    '....krrrrrrss...',
    '.....kooooosss..',
    '.....kyyyyyssss.',
    '.....kgggggsss..',
    '.....kbbbbbss...',
    '.....kpppppk....',
    '.....kkkkkkk....',
    '.....ww.........',
    '......ww........',
    '................',
    '................',
    '................',
  ],
};

// ---------- ✦ 星坠新星：四角大星芒 + 小星 ----------
export const ICON_NOVA = {
  name: 'nova', size: 16,
  pal: { p: '#a83bd6', d: '#5a1a8a', w: '#ffffff', l: '#e8b0ff', y: '#ffd83a' },
  rows: [
    '.......dd.......',
    '.......pp.......',
    '.......pp.......',
    '..y....pp....y..',
    '.yyy...pp...yyy.',
    '..y...ppp....y..',
    '.......ww.......',
    '...d..wwww..d...',
    '.dppwwwwwwwwppd.',
    '.dppwwwwwwwwppd.',
    '...d..wwww..d...',
    '.......ww.......',
    '..y...ppp....y..',
    '.yyy...pp...yyy.',
    '..y....pp....y..',
    '.......pp.......',
  ],
};

// ---------- ▲ 跳跃 ----------
export const ICON_JUMP = {
  name: 'jump', size: 16,
  pal: { w: '#ffffff', s: '#2ea87e', k: '#06351f', l: '#d8fff0' },
  rows: [
    '................',
    '......kk........',
    '.....kwwk.......',
    '.....kwwk.......',
    '....kwwwwk......',
    '....kwwwwk......',
    '...kwwlllwk.....',
    '...kwllllwk.....',
    '..kwwllllwwk....',
    '..kwllllllwk....',
    '.kwwllllllwwk...',
    '.kwkllllllkwk...',
    '.kk........kk...',
    '................',
    '................',
    '................',
  ],
};

// ---------- App图标：Luna wink 头像（64px 代码绘制） ----------
export function paintAppIcon(scale = 8) {
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(scale, scale);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w, h); };
  // 背景：圆角深空渐变
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const rC = Math.round(24 + t * 60), gC = Math.round(22 + t * 30), bC = Math.round(80 + t * 70);
    R(0, y, S, 1, `rgb(${rC},${gC},${bC})`);
  }
  // 圆角透明
  g.clearRect(0, 0, 6, 3); g.clearRect(S - 6, 0, 6, 3); g.clearRect(0, 0, 3, 6); g.clearRect(S - 3, 0, 3, 6);
  g.clearRect(0, S - 3, 6, 3); g.clearRect(S - 6, S - 3, 6, 3); g.clearRect(0, S - 6, 3, 6); g.clearRect(S - 3, S - 6, 3, 6);
  // 背景小星星
  const stars = [[8, 10, '#ffffff'], [55, 8, '#ffe45a'], [50, 52, '#ffffff'], [6, 48, '#ff72d8'], [14, 26, '#ffffff'], [52, 30, '#ffe45a'], [30, 6, '#ffffff'], [44, 44, '#59c8ff']];
  stars.forEach(([x, y, col]) => { R(x, y, 2, 2, col); });
  // 猫耳
  R(10, 8, 12, 10, '#e9f1ff'); R(42, 8, 12, 10, '#e9f1ff');
  R(12, 6, 8, 6, '#e9f1ff'); R(44, 6, 8, 6, '#e9f1ff');
  R(14, 11, 5, 5, '#ffa6c8'); R(45, 11, 5, 5, '#ffa6c8');
  R(15, 12, 3, 3, '#ff7aa8'); R(46, 12, 3, 3, '#ff7aa8');
  // 头发
  R(8, 12, 48, 10, '#e9f1ff');
  R(8, 12, 48, 3, '#ffffff');
  R(8, 22, 6, 26, '#e9f1ff'); R(50, 22, 6, 26, '#e9f1ff');
  R(8, 40, 6, 8, '#b9cdf5'); R(50, 40, 6, 8, '#b9cdf5');
  // 脸
  R(14, 20, 36, 26, '#ffe0c4');
  R(14, 20, 36, 2, '#ffd0a8');
  // 刘海
  R(14, 20, 36, 6, '#e9f1ff');
  [[16, 26, 6], [24, 26, 8], [34, 26, 6], [42, 26, 6]].forEach(([x, y, w]) => R(x, y, w, 5, '#e9f1ff'));
  R(14, 20, 36, 2, '#ffffff');
  // 左眼（睁开，蓝色）
  R(19, 32, 9, 11, '#1a1426');
  R(20, 33, 7, 9, '#36c6ff');
  R(20, 33, 7, 3, '#9adcff');
  R(21, 34, 3, 3, '#ffffff');
  R(23, 36, 3, 5, '#1a5a9a');
  // 右眼（wink > 形）
  R(38, 33, 2, 2, '#1a1426');
  R(40, 35, 2, 2, '#1a1426');
  R(42, 37, 2, 2, '#1a1426');
  R(42, 39, 2, 2, '#1a1426');
  R(40, 41, 2, 2, '#1a1426');
  R(38, 43, 2, 2, '#1a1426');
  // 睫毛
  R(17, 32, 2, 2, '#1a1426'); R(37, 32, 2, 2, '#1a1426');
  // 腮红
  R(15, 40, 6, 3, '#ff8aa0'); R(43, 40, 6, 3, '#ff8aa0');
  // 微笑（张开）
  R(29, 42, 6, 4, '#7a2a3a');
  R(30, 43, 4, 2, '#ff8a8a');
  R(29, 42, 6, 1, '#5a1a2a');
  // 星星发夹（左侧）
  R(9, 26, 7, 2, '#ffd83a'); R(11, 24, 2, 7, '#ffd83a'); R(12, 27, 2, 2, '#fff3b0');
  // 围巾 + 肩
  R(14, 46, 36, 5, '#4fe0ff');
  R(14, 49, 36, 2, '#2aa8cc');
  R(10, 51, 44, 13, '#2b3f9a');
  R(10, 51, 44, 3, '#4663d6');
  R(29, 53, 6, 4, '#ffe45a');
  return c;
}
