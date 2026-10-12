// 图标预览 + 导出页入口（esbuild 打包给 tools/iconmaker.html 用）
import { ICON_STAR, ICON_DASH, ICON_NOVA, ICON_JUMP, renderIcon, paintAppIcon } from './icons.js';

const defs = [
  ['star', ICON_STAR, 12],
  ['dash', ICON_DASH, 12],
  ['nova', ICON_NOVA, 12],
  ['jump', ICON_JUMP, 12],
];
const out = {};
const wrap = document.getElementById('wrap');
for (const [name, icon, s] of defs) {
  const c = renderIcon(icon, s);
  const d = document.createElement('div');
  d.innerHTML = `<p>${name}</p>`;
  d.prepend(c); wrap.appendChild(d);
  out[name] = renderIcon(icon, 6).toDataURL('image/png');
}
const app = paintAppIcon(4);
const d = document.createElement('div');
d.innerHTML = '<p>app-icon</p>';
d.prepend(app); wrap.appendChild(d);
out.app = paintAppIcon(8).toDataURL('image/png');
window.__icons = out;
