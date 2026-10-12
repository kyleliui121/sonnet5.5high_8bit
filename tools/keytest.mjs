import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files','--mute-audio'],
  defaultViewport: { width: 960, height: 540 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(pathToFileURL('D:/work/sonnet_8bit/index.html').href);
await new Promise(r=>setTimeout(r,1200));
const st = () => p.evaluate('(()=>{const g=window.__game;return {state:g.G.state,px:+g.player.x.toFixed(2),pz:+g.player.z.toFixed(2),py:+g.player.y.toFixed(2),act:g.player.act&&g.player.act.n,cd:g.player.cd,proj:g.G.projectiles.length,paused:g.game.paused,yaw:+g.cam.yaw.toFixed(2)}})()');
await p.keyboard.press('Enter'); await new Promise(r=>setTimeout(r,300));
console.log('after Enter:', JSON.stringify(await st()));
// W 按住
await p.keyboard.down('KeyW'); await new Promise(r=>setTimeout(r,900)); await p.keyboard.up('KeyW');
console.log('after W:', JSON.stringify(await st()));
// K 彩虹冲刺
await p.keyboard.press('KeyK'); await new Promise(r=>setTimeout(r,150));
console.log('after K:', JSON.stringify(await st()));
// J 星光弹
await new Promise(r=>setTimeout(r,900));
await p.keyboard.press('KeyJ'); await new Promise(r=>setTimeout(r,250));
console.log('after J:', JSON.stringify(await st()));
// Space
await p.keyboard.press('Space'); await new Promise(r=>setTimeout(r,150));
console.log('after Space:', JSON.stringify(await st()));
// Q 转镜头 / Tab / P
const y0 = (await st()).yaw; await p.keyboard.down('KeyQ'); await new Promise(r=>setTimeout(r,500)); await p.keyboard.up('KeyQ');
console.log('after Q yaw:', y0, '->', (await st()).yaw);
await p.keyboard.press('KeyP'); await new Promise(r=>setTimeout(r,150));
console.log('after P:', JSON.stringify(await st()));
await p.keyboard.press('KeyP'); await new Promise(r=>setTimeout(r,150));
// L 大招
await p.keyboard.press('KeyL'); await new Promise(r=>setTimeout(r,400));
console.log('after L:', JSON.stringify(await st()));
await b.close();
