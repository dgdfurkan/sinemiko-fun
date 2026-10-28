// Sentezlenmiş ses efektleri; dosya yüklemeden çalışır

import { getCtx, bus, noiseBuffer, mtof } from './engine.js';

const live = () => {
  const c = getCtx();
  return c && c.state === 'running' ? c : null;
};

function tone(c, { type = 'sine', f, f2, t = c.currentTime, dur = 0.12, vol = 0.2, attack = 0.004, dest = bus('sfx') }) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
  return o;
}

function hiss(c, { t = c.currentTime, dur = 0.2, vol = 0.1, type = 'bandpass', f = 1500, f2, q = 0.8, attack = 0.004 }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, t);
  if (f2) filt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(bus('sfx'));
  src.start(t, Math.random() * 1.1, dur + 0.05);
}

const notes = (c, list, { type = 'triangle', gap = 0.075, dur = 0.26, vol = 0.12, start = 0 } = {}) =>
  list.forEach((m, i) => tone(c, { type, f: mtof(m), t: c.currentTime + start + i * gap, dur, vol }));

export const sfx = {
  click() {
    const c = live(); if (!c) return;
    tone(c, { type: 'triangle', f: 920, f2: 640, dur: 0.07, vol: 0.11 });
  },
  soft() {
    const c = live(); if (!c) return;
    tone(c, { type: 'sine', f: 660, f2: 880, dur: 0.08, vol: 0.07 });
  },
  pop(size = 1) {
    const c = live(); if (!c) return;
    const base = (700 + Math.random() * 500) / Math.max(0.6, size);
    tone(c, { type: 'sine', f: base, f2: base * 0.42, dur: 0.075, vol: 0.26, attack: 0.002 });
    tone(c, { type: 'sine', f: base * 2.1, f2: base, dur: 0.04, vol: 0.06, attack: 0.001 });
    hiss(c, { dur: 0.03, vol: 0.06, type: 'highpass', f: 3200 });
  },
  whoosh() {
    const c = live(); if (!c) return;
    hiss(c, { dur: 0.42, vol: 0.13, f: 380, f2: 2800, q: 0.9, attack: 0.12 });
  },
  success() {
    const c = live(); if (!c) return;
    notes(c, [72, 76, 79, 84], { gap: 0.07, dur: 0.3, vol: 0.12 });
    notes(c, [96, 100], { type: 'sine', gap: 0.05, dur: 0.25, vol: 0.04, start: 0.28 });
  },
  fanfare() {
    const c = live(); if (!c) return;
    notes(c, [67, 72, 76, 79, 84], { gap: 0.09, dur: 0.32, vol: 0.12 });
    [72, 76, 79, 84].forEach((m) => tone(c, { type: 'triangle', f: mtof(m), t: c.currentTime + 0.5, dur: 0.9, vol: 0.06 }));
    hiss(c, { t: c.currentTime + 0.5, dur: 1, vol: 0.05, type: 'highpass', f: 6000 });
  },
  fail() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    tone(c, { type: 'triangle', f: 392, f2: 370, t, dur: 0.24, vol: 0.13 });
    tone(c, { type: 'triangle', f: 330, f2: 262, t: t + 0.26, dur: 0.5, vol: 0.13 });
  },
  boing() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    const o = tone(c, { type: 'sine', f: 180, t, dur: 0.45, vol: 0.18 });
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(420, t + 0.08);
    o.frequency.linearRampToValueAtTime(240, t + 0.2);
    o.frequency.linearRampToValueAtTime(330, t + 0.3);
  },
  // Hedefe yaklaştıkça incelen kısa ses; level 0-1
  warm(level = 0.5) {
    const c = live(); if (!c) return;
    tone(c, { type: 'sine', f: 480 + level * 760, f2: 520 + level * 820, dur: 0.07, vol: 0.055 });
  },
  tick(n = 1) {
    const c = live(); if (!c) return;
    tone(c, { type: 'triangle', f: 900 + n * 60, dur: 0.06, vol: 0.13 });
    tone(c, { type: 'sine', f: 150, f2: 70, dur: 0.12, vol: 0.18 });
  },
  go() {
    const c = live(); if (!c) return;
    [72, 76, 79].forEach((m) => tone(c, { type: 'triangle', f: mtof(m), dur: 0.4, vol: 0.09 }));
    hiss(c, { dur: 0.35, vol: 0.1, f: 600, f2: 4000, attack: 0.02 });
  },
  buzz() {
    const c = live(); if (!c) return;
    tone(c, { type: 'square', f: 150, dur: 0.32, vol: 0.08 });
    tone(c, { type: 'square', f: 157, dur: 0.32, vol: 0.08 });
  },
  buzzer(side = 0) {
    const c = live(); if (!c) return;
    const base = side === 0 ? 523 : 659;
    tone(c, { type: 'square', f: base, dur: 0.12, vol: 0.07 });
    tone(c, { type: 'square', f: base * 1.5, t: c.currentTime + 0.1, dur: 0.18, vol: 0.07 });
  },
  ding() {
    const c = live(); if (!c) return;
    tone(c, { type: 'sine', f: 1568, dur: 0.6, vol: 0.1 });
    tone(c, { type: 'sine', f: 2350, dur: 0.4, vol: 0.04 });
  },
  wheelTick() {
    const c = live(); if (!c) return;
    tone(c, { type: 'square', f: 2400, dur: 0.018, vol: 0.045, attack: 0.001 });
  },
  rewind() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.32);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.62);
    const lfo = c.createOscillator();
    lfo.frequency.value = 26;
    const lg = c.createGain();
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);
    o.connect(f);
    f.connect(g);
    g.connect(bus('sfx'));
    o.start(t); lfo.start(t);
    o.stop(t + 0.7); lfo.stop(t + 0.7);
  },
  sparkle() {
    const c = live(); if (!c) return;
    for (let i = 0; i < 6; i++) {
      tone(c, { type: 'sine', f: 1800 + Math.random() * 2400, t: c.currentTime + i * 0.045, dur: 0.18, vol: 0.05 });
    }
  },
  flip() {
    const c = live(); if (!c) return;
    hiss(c, { dur: 0.12, vol: 0.12, f: 2600, f2: 900, q: 1 });
  },
  heart() {
    const c = live(); if (!c) return;
    notes(c, [79, 84], { type: 'sine', gap: 0.1, dur: 0.3, vol: 0.1 });
  },
  lock() {
    const c = live(); if (!c) return;
    tone(c, { type: 'triangle', f: 1300, dur: 0.04, vol: 0.12 });
    tone(c, { type: 'triangle', f: 1700, t: c.currentTime + 0.06, dur: 0.05, vol: 0.12 });
  },
  whistle() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    const o = tone(c, { type: 'sine', f: 2100, t, dur: 0.7, vol: 0.12 });
    const lfo = c.createOscillator();
    lfo.frequency.value = 38;
    const lg = c.createGain();
    lg.gain.value = 90;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.72);
  },
  boom() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    tone(c, { type: 'sine', f: 130, f2: 28, t, dur: 1, vol: 0.55, attack: 0.002 });
    hiss(c, { t, dur: 1.3, vol: 0.38, type: 'lowpass', f: 2600, f2: 180, q: 0.4, attack: 0.002 });
    hiss(c, { t: t + 0.02, dur: 0.45, vol: 0.22, type: 'bandpass', f: 900, q: 0.5, attack: 0.002 });
  },
  // Oyuncak tabanca: kısa çatlama ve küçük gümbürtü
  bang() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    hiss(c, { t, dur: 0.16, vol: 0.5, type: 'highpass', f: 1800, q: 0.5, attack: 0.001 });
    hiss(c, { t, dur: 0.5, vol: 0.3, type: 'lowpass', f: 1400, f2: 160, q: 0.5, attack: 0.002 });
    tone(c, { type: 'sine', f: 180, f2: 45, t, dur: 0.35, vol: 0.4, attack: 0.002 });
  },
  // Kesme: hızlı süzülen hışırtı
  slash() {
    const c = live(); if (!c) return;
    hiss(c, { dur: 0.16, vol: 0.2, type: 'bandpass', f: 2400, f2: 6000, q: 1.4, attack: 0.005 });
  },
  // Vahşi Batı ıslığı: dört notalık kısa motif
  western() {
    const c = live(); if (!c) return;
    [[76, 0], [81, 0.28], [79, 0.7], [74, 0.98]].forEach(([m, d]) => tone(c, { type: 'sine', f: mtof(m), t: c.currentTime + d, dur: 0.42, vol: 0.09, attack: 0.04 }));
  },
  fuse() {
    const c = live(); if (!c) return;
    hiss(c, { dur: 0.05 + Math.random() * 0.05, vol: 0.035, type: 'highpass', f: 3500 + Math.random() * 3000, attack: 0.002 });
  },
  bombTick(p = 0) {
    const c = live(); if (!c) return;
    tone(c, { type: 'square', f: 1100 + p * 500, dur: 0.035, vol: 0.06, attack: 0.001 });
    tone(c, { type: 'sine', f: 220, f2: 140, dur: 0.06, vol: 0.12 });
  },
  signal() {
    const c = live(); if (!c) return;
    [988, 1319, 1976].forEach((f, i) => tone(c, { type: 'triangle', f, t: c.currentTime + i * 0.012, dur: 0.32, vol: 0.12 }));
  },
  error() {
    const c = live(); if (!c) return;
    tone(c, { type: 'square', f: 240, f2: 110, dur: 0.38, vol: 0.09 });
    tone(c, { type: 'square', f: 246, f2: 113, dur: 0.38, vol: 0.06 });
  },
  pass() {
    const c = live(); if (!c) return;
    hiss(c, { dur: 0.22, vol: 0.12, f: 900, f2: 3200, q: 1.1, attack: 0.03 });
    tone(c, { type: 'sine', f: 500, f2: 900, dur: 0.12, vol: 0.06 });
  },
  deflate() {
    const c = live(); if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 1.1);
    const lfo = c.createOscillator();
    lfo.frequency.value = 18;
    const lg = c.createGain();
    lg.gain.value = 220;
    lfo.connect(lg);
    lg.connect(f.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    src.connect(f);
    f.connect(g);
    g.connect(bus('sfx'));
    src.start(t, 0, 1.2);
    lfo.start(t);
    lfo.stop(t + 1.2);
  },
  // Davul gürlemesi; süre saniye cinsinden
  drumroll(dur = 1.3) {
    const c = live(); if (!c) return;
    const t0 = c.currentTime;
    let t = t0;
    let i = 0;
    while (t < t0 + dur) {
      const p = (t - t0) / dur;
      hiss(c, { t, dur: 0.06, vol: 0.04 + p * 0.12, f: 1700, q: 0.6, attack: 0.002 });
      t += 0.075 - p * 0.04 + (i++ % 2 ? 0.004 : 0);
    }
    hiss(c, { t: t0 + dur, dur: 1.1, vol: 0.14, type: 'highpass', f: 5200, attack: 0.003 });
    tone(c, { type: 'sine', f: 110, f2: 50, t: t0 + dur, dur: 0.35, vol: 0.3 });
  },
};
