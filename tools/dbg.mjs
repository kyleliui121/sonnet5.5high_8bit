// 用法: node tools/dbg.mjs out.png "js代码(可用 await)"  —— 在页面里执行后截图
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
const [out, code = ''] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files', '--mute-audio'], defaultViewport: { width: 960, height: 540 } });
const p = await b.newPage();
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(pathToFileURL('D:/work/sonnet_8bit/index.html').href);
await new Promise((r) => setTimeout(r, 800));
const r = await p.evaluate(`(async()=>{ ${code} })()`);
await p.evaluate('window.__game && (window.__game.game.paused = true)');
if (r !== undefined) console.log('result', JSON.stringify(r));
await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: out });
await b.close();
