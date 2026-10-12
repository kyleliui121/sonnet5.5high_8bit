// WebAudio 合成：8-bit 音效 + 简易 BGM
let ctx = null, master = null, sfxBus = null, musBus = null, muted = false, noiseBuf = null, musicOn = false, step = 0, nextT = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.gain.value = 0.16; musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; }

function tone(type, f0, f1, dur, vol = 0.3, delay = 0, bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, f0 = 3000, f1 = 300, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'cast': tone('square', 500, 900, 0.1, 0.12); break;
    case 'shoot': tone('square', 1200, 400, 0.18, 0.2); tone('triangle', 880, 1760, 0.2, 0.2, 0.02); [0, 0.05, 0.1].forEach((d, i) => tone('square', 1320 + i * 330, 1320 + i * 330, 0.06, 0.08, d)); break;
    case 'pop': tone('square', 900, 200, 0.14, 0.18); noise(0.12, 0.15, 5000, 800); break;
    case 'dash': noise(0.4, 0.28, 6000, 400); tone('sawtooth', 200, 1000, 0.35, 0.14); [0, 0.06, 0.12, 0.18, 0.24, 0.3].forEach((d, i) => tone('square', 523 * [1, 1.25, 1.5, 1.875, 2, 2.5][i], 523 * [1, 1.25, 1.5, 1.875, 2, 2.5][i], 0.07, 0.1, d)); break;
    case 'charge': tone('sawtooth', 120, 1400, 0.7, 0.16); tone('triangle', 240, 2200, 0.7, 0.12); break;
    case 'nova': noise(0.8, 0.5, 8000, 100); tone('square', 880, 55, 0.7, 0.3); [0, 0.07, 0.14, 0.21, 0.28].forEach((d, i) => tone('triangle', 659 * 2 ** (i / 3), 659 * 2 ** (i / 3), 0.25, 0.2, d)); break;
    case 'hit': noise(0.12, 0.35, 4000, 400); tone('square', 300, 80, 0.12, 0.25); break;
    case 'hitHeavy': noise(0.3, 0.55, 5000, 150); tone('square', 220, 40, 0.3, 0.35); tone('sawtooth', 110, 30, 0.35, 0.3); break;
    case 'jump': tone('square', 300, 700, 0.12, 0.12); break;
    case 'ko': noise(0.6, 0.4, 3000, 100); tone('sawtooth', 600, 40, 0.8, 0.3); break;
    case 'ui': tone('square', 700, 1000, 0.07, 0.15); break;
    case 'fight': [0, 0.09, 0.18].forEach((d, i) => tone('square', [523, 659, 988][i], [523, 659, 988][i], 0.15, 0.2, d)); break;
    case 'win': [0, 0.12, 0.24, 0.36, 0.5].forEach((d, i) => tone('square', [523, 659, 784, 1047, 1319][i], [523, 659, 784, 1047, 1319][i], 0.2, 0.2, d)); break;
    case 'lose': [0, 0.2, 0.4].forEach((d, i) => tone('triangle', [392, 330, 262][i], [392, 330, 262][i] * 0.95, 0.3, 0.25, d)); break;
  }
}

// ---- BGM：A 小调琶音 + 低音 ----
const LEAD = [69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79, 65, 69, 72, 69, 65, 69, 72, 77, 67, 71, 74, 79, 76, 74, 71, 67];
const BASS = [45, 45, 52, 45, 43, 43, 50, 43, 41, 41, 48, 41, 43, 43, 50, 43];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
function startMusic() {
  if (musicOn) return; musicOn = true; nextT = ctx.currentTime + 0.1;
  setInterval(() => {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.25) {
      const t = nextT - ctx.currentTime, dur = 0.14;
      const l = mtof(LEAD[step % LEAD.length]);
      tone('square', l, l, dur * 0.9, 0.35, t, musBus);
      if (step % 2 === 0) { const b = mtof(BASS[(step / 2) % BASS.length]); tone('triangle', b, b, dur * 1.8, 0.8, t, musBus); }
      if (step % 4 === 2) noise(0.05, 0.12, 9000, 3000, t);
      step++; nextT += dur;
    }
  }, 60);
}
