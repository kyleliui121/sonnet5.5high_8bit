// 用法: node tools/mkicons.mjs —— 打包图标页并导出 PNG 到 assets/
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
execSync('node build.mjs --icons', { cwd: 'D:/work/sonnet_8bit', stdio: 'inherit' });
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: ['--allow-file-access-from-files', '--mute-audio'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(pathToFileURL('D:/work/sonnet_8bit/tools/iconmaker.html').href);
await new Promise((r) => setTimeout(r, 800));
const icons = await p.evaluate('window.__icons');
await p.screenshot({ path: 'D:/work/sonnet_8bit/shots/icons_preview.png' });
await b.close();
fs.mkdirSync('D:/work/sonnet_8bit/assets/icons', { recursive: true });
for (const [k, v] of Object.entries({ star: 'star', dash: 'dash', nova: 'nova', jump: 'jump' })) {
  fs.writeFileSync(`D:/work/sonnet_8bit/assets/icons/${v}.png`, Buffer.from(icons[k].split(',')[1], 'base64'));
}
fs.writeFileSync('D:/work/sonnet_8bit/assets/app-icon.png', Buffer.from(icons.app.split(',')[1], 'base64'));
console.log('icons exported');
