# 星彩沙盘格斗 · Starlight Brawl

像素比特风 · 伪3D第三人称 · 1v1 格斗（玩家 LUNA vs 电脑 EMBER，三局两胜）

## 运行
直接双击 `index.html`（已打包 `dist/game.js`，无需服务器）。
修改源码后：`node build.mjs`（或 `node build.mjs --watch`）重新打包。

## 操作
| 键 | 作用 |
|---|---|
| WASD | 移动（相对镜头） |
| Space | 跳跃 |
| J | 星光弹：自动瞄准，星星 + 彩虹螺旋拖尾（跳起可躲） |
| K | 彩虹冲刺：七色彩带，撞击击飞 |
| L | 星坠新星：蓄力悬浮 → 彩虹冲击环 + 流星雨（**跳起可躲冲击环**，注意地面预警圈） |
| Q/E 或 ←/→ | 转动镜头 |
| Tab | 切换视角锁定（默认自动朝向对手） |
| P/Esc 暂停 · M 静音 · 标题界面 1/2/3 选难度 |

## 调试
`node tools/shot.mjs out.png 1500 "Enter,wait:800,KeyJ"` 无头 Edge 截图；
`node tools/dbg.mjs out.png "__game.start(); __game.advance(3,{a1:true})"` 确定性推进游戏后截图。
