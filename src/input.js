// 键盘输入：按住状态 + 本帧按下边沿 + 战斗按键锁存（防止命中停顿/掉帧时丢键）
const down = new Set(), pressed = new Set(), latch = new Map();
const norm = (e) => e.code;
window.addEventListener('keydown', (e) => {
  const k = norm(e);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
  if (!down.has(k)) { pressed.add(k); latch.set(k, performance.now()); }
  down.add(k);
});
window.addEventListener('keyup', (e) => down.delete(norm(e)));
window.addEventListener('blur', () => down.clear());
export const Input = {
  held: (...k) => k.some((x) => down.has(x)),
  hit: (...k) => k.some((x) => pressed.has(x)),
  /** 取走一次锁存的按下事件（250ms 内有效） */
  take(...k) {
    let r = false;
    for (const x of k) { const t = latch.get(x); if (t !== undefined) { latch.delete(x); if (performance.now() - t < 250) r = true; } }
    return r;
  },
  clearLatch() { latch.clear(); },
  endFrame() { pressed.clear(); },
};
