#!/usr/bin/env node
// 用本机 Edge (puppeteer-core, headless) 打开 index.html，模拟按键后截图。
//
// 用法:
//   node tools/shot.mjs <out.png> [等待毫秒=1500] [按键序列]
//
// 按键序列 (逗号分隔):
//   Enter              普通键 = 按下并立即释放
//   wait:800           等待 800ms
//   hold:KeyW:600      按住 KeyW 600ms 后释放
//
// 页面 console 的 error/warn 与 pageerror 会以 [console] 前缀打印到 stdout。

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');
const VIEWPORT = { width: 960, height: 540 };
const LAUNCH_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--allow-file-access-from-files', // 便于 file:// 下加载本地资源
  '--mute-audio',
];

function usage(msg) {
  if (msg) process.stderr.write(`错误: ${msg}\n`);
  process.stderr.write(
    '用法: node tools/shot.mjs <out.png> [等待毫秒=1500] [按键序列]\n' +
      '例:   node tools/shot.mjs shots/a.png 2000 "Enter,wait:800,hold:KeyW:600,KeyJ"\n',
  );
  process.exit(2);
}

function logLine(msg) {
  process.stdout.write(`[console] ${msg}\n`);
}

/** 解析 "Enter,wait:800,hold:KeyW:600" -> [{type, ...}] */
function parseSequence(raw) {
  if (!raw) return [];
  const steps = [];
  for (const tokenRaw of raw.split(',')) {
    const token = tokenRaw.trim();
    if (!token) continue;
    if (token.startsWith('wait:')) {
      const ms = Number(token.slice(5));
      if (!Number.isFinite(ms) || ms < 0) throw new Error(`无法解析 wait 步骤: "${token}"`);
      steps.push({ type: 'wait', ms });
      continue;
    }
    if (token.startsWith('hold:')) {
      const parts = token.split(':');
      if (parts.length < 3) throw new Error(`hold 格式应为 hold:Key:ms, 收到: "${token}"`);
      const key = parts[1].trim();
      const ms = Number(parts[2]);
      if (!key) throw new Error(`hold 缺少按键名: "${token}"`);
      if (!Number.isFinite(ms) || ms < 0) throw new Error(`hold 时长非法: "${token}"`);
      steps.push({ type: 'hold', key, ms });
      continue;
    }
    steps.push({ type: 'press', key: token });
  }
  return steps;
}

async function runSequence(page, steps) {
  for (const step of steps) {
    if (step.type === 'wait') {
      await sleep(step.ms);
      continue;
    }
    if (step.type === 'hold') {
      try {
        await page.keyboard.down(step.key);
        await sleep(step.ms);
      } finally {
        await page.keyboard.up(step.key).catch(() => {});
      }
      continue;
    }
    try {
      await page.keyboard.press(step.key);
    } catch (err) {
      logLine(`[warn] 按键失败 ${step.key}: ${err.message}`);
    }
  }
}

async function main() {
  const [, , outArg, waitArg, seqArg] = process.argv;
  if (!outArg) usage('缺少输出路径 <out.png>');

  const outPath = path.resolve(process.cwd(), outArg);
  const waitMs = waitArg === undefined ? 1500 : Number(waitArg);
  if (!Number.isFinite(waitMs) || waitMs < 0) usage(`等待毫秒非法: "${waitArg}"`);

  let steps;
  try {
    steps = parseSequence(seqArg);
  } catch (err) {
    usage(err.message);
  }

  if (!fs.existsSync(EDGE_PATH)) {
    process.stderr.write(`错误: 找不到 Edge: ${EDGE_PATH}\n`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const url = pathToFileURL(INDEX_HTML).href;
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: VIEWPORT,
    args: LAUNCH_ARGS,
  });

  let exitCode = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warn' && type !== 'warning') return;
      const loc = msg.location();
      const where = loc && loc.url ? ` (${loc.url}:${loc.lineNumber ?? 0})` : '';
      logLine(`[${type}] ${msg.text()}${where}`);
    });
    page.on('pageerror', (err) => {
      logLine(`[pageerror] ${err && err.stack ? err.stack : String(err)}`);
    });

    logLine(`[info] 打开 ${url}`);
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    } catch (err) {
      // index.html 可能尚不存在: 提示但不中断
      logLine(`[error] 页面加载失败: ${err.message}`);
    }

    await page.bringToFront().catch(() => {});

    if (waitMs > 0) await sleep(waitMs);
    await runSequence(page, steps);

    // 让渲染/输入循环有机会跑完最后一帧
    await sleep(120);

    await page.screenshot({ path: outPath });
    logLine(`[info] 截图已保存: ${outPath}`);
  } catch (err) {
    process.stderr.write(`错误: ${err && err.stack ? err.stack : String(err)}\n`);
    exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }

  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(`错误: ${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});
