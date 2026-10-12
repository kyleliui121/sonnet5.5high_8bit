// 用法: node tools/mshot.mjs out.png 844x390 "js代码" —— 手机视口截图 mobile.html
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
const [out, size = '844x390', code = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files', '--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(pathToFileURL('D:/work/sonnet_8bit/mobile.html').href);
await new Promise((r) => setTimeout(r, 1200));
if (code) await p.evaluate(`(async()=>{ ${code} })()`);
await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: out });
await b.close();
