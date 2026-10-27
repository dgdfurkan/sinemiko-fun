// Prosedürel fon müziği: "chill" menü ve oyun teması, "party" fısıltı oyununun maske müziği

import { ensureAudio, getCtx, bus, noiseBuffer, pinkBuffer, mtof } from './engine.js';

/* ---------- Sesler ---------- */

function keys(ctx, dest, t, notes, dur, vel) {
  const relAt = t + dur;
  const decEnd = t + Math.min(0.32, dur * 0.85);
  const peak = 0.05 * vel;
  for (const m of notes) {
    const f = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.42, decEnd);
    g.gain.setTargetAtTime(0.0001, relAt, 0.14);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    o2.detune.value = 5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(dest);
    const end = relAt + 0.9;
    o1.start(t); o2.start(t);
    o1.stop(end); o2.stop(end);
  }
}

function bass(ctx, dest, t, m, dur, vel) {
  const f = mtof(m);
  const g = ctx.createGain();
  const peak = 0.2 * vel;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.min(0.2, dur * 0.8));
  g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = f;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  o.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(dest);
  const end = t + dur + 0.45;
  o.start(t); o2.start(t);
  o.stop(end); o2.stop(end);
}

function bell(ctx, dest, t, m, dur, vel) {
  const f = mtof(m);
  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = f * 3;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 0.9, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.25);
  mod.connect(mg);
  mg.connect(car.frequency);
  const g = ctx.createGain();
  const tail = Math.max(0.6, dur + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.065 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
  car.connect(g);
  g.connect(dest);
  const end = t + tail + 0.05;
  car.start(t); mod.start(t);
  car.stop(end); mod.stop(end);
}

function kick(ctx, dest, t, vel) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(122, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.32);
}

function noiseHit(ctx, dest, t, { type, freq, q = 0.7, vol, decay }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 1.2, decay + 0.05);
}

function snare(ctx, dest, t, vel) {
  noiseHit(ctx, dest, t, { type: 'bandpass', freq: 1800, q: 0.7, vol: 0.13 * vel, decay: 0.17 });
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.1);
}

const hat = (ctx, dest, t, vel, open = false) =>
  noiseHit(ctx, dest, t, { type: 'highpass', freq: 7200, q: 0.5, vol: (open ? 0.05 : 0.034) * vel, decay: open ? 0.14 : 0.05 });

function stab(ctx, dest, t, notes, dur, vel) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + dur + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  f.connect(g);
  g.connect(dest);
  for (const m of notes) {
    for (const det of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.15);
    }
  }
}

function blip(ctx, dest, t, m, dur, vol) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/* ---------- Şarkılar ---------- */

// Fa majör, IVmaj7 - V7 - iii7 - vi7 yürüyüşü ve çeşitlemesi
const CHILL_CHORDS = [
  [58, 62, 65, 69], [58, 60, 64, 67], [55, 57, 60, 64], [57, 60, 62, 65],
  [55, 58, 62, 65], [55, 57, 60, 64], [58, 62, 65, 69], [58, 60, 65, 67],
];
const CHILL_BASS = [46, 48, 45, 50, 43, 45, 46, 48];
const CHILL_KEYS = [[0, 7, 1], [7, 3, 0.55], [10, 6, 0.75]];
const CHILL_MELODY = [
  [[0, 81, 2], [2, 84, 2], [4, 86, 4], [10, 84, 2], [12, 81, 4]],
  [[0, 79, 2], [2, 81, 2], [4, 84, 6], [12, 79, 2], [14, 76, 2]],
  [[0, 76, 3], [4, 79, 2], [6, 81, 2], [8, 84, 4], [14, 81, 2]],
  [[0, 81, 4], [6, 77, 2], [8, 81, 2], [10, 79, 6]],
  [[0, 86, 2], [2, 84, 2], [4, 82, 2], [6, 81, 2], [8, 79, 4], [12, 74, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 81, 4], [10, 84, 2], [12, 88, 4]],
  [[0, 86, 3], [4, 84, 2], [6, 81, 2], [8, 77, 4], [12, 79, 2], [14, 81, 2]],
  [[0, 79, 4], [6, 77, 2], [8, 79, 8]],
].map((bar) => {
  const map = new Map();
  for (const [s, m, len] of bar) map.set(s, [m, len]);
  return map;
});
const SPARKLE = [77, 79, 81, 84, 86, 89, 91, 93];

function createChill(ctx, out) {
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 6800;
  warm.Q.value = 0.3;
  master.connect(warm);
  warm.connect(out);

  const keysBus = ctx.createBiquadFilter();
  keysBus.type = 'lowpass';
  keysBus.frequency.value = 2400;
  keysBus.Q.value = 0.4;
  keysBus.connect(master);

  const bassBus = ctx.createBiquadFilter();
  bassBus.type = 'lowpass';
  bassBus.frequency.value = 820;
  bassBus.connect(master);

  const bellBus = ctx.createGain();
  bellBus.connect(master);
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = (60 / 88) * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const dlp = ctx.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2800;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bellBus.connect(delay);
  delay.connect(dlp);
  dlp.connect(fb);
  fb.connect(delay);
  dlp.connect(wet);
  wet.connect(master);

  const drums = ctx.createGain();
  drums.gain.value = 0.9;
  drums.connect(master);

  return {
    bpm: 88,
    swing: 0.16,
    bars: 8,
    level: 1.3,
    master,
    step(t, s, bar, loop, sd) {
      const chord = CHILL_CHORDS[bar];
      const root = CHILL_BASS[bar];
      for (const [st, len, vel] of CHILL_KEYS) if (s === st) keys(ctx, keysBus, t, chord, len * sd, vel);

      if (s === 0) bass(ctx, bassBus, t, root, 5 * sd, 1);
      else if (s === 7) bass(ctx, bassBus, t, root, sd, 0.55);
      else if (s === 8) bass(ctx, bassBus, t, root + 7, 4 * sd, 0.85);
      else if (s === 14) bass(ctx, bassBus, t, root + 12, 2 * sd, 0.5);

      const full = loop > 0 || bar >= 4;
      if (full) {
        if (s === 0 || s === 10) kick(ctx, drums, t, 1);
        else if (s === 7) kick(ctx, drums, t, 0.45);
        if (s === 4 || s === 12) snare(ctx, drums, t, 1);
      }
      if (s % 2 === 0) hat(ctx, drums, t, s % 4 === 0 ? 0.8 : 0.5);
      else if (s === 15) hat(ctx, drums, t, 0.3);

      if (loop % 3 !== 0) {
        const note = CHILL_MELODY[bar].get(s);
        if (note) bell(ctx, bellBus, t, note[0], note[1] * sd, 0.9);
      } else if (loop > 0 && s % 8 === 4 && Math.random() < 0.4) {
        bell(ctx, bellBus, t, SPARKLE[Math.floor(Math.random() * SPARKLE.length)], 2 * sd, 0.45);
      }
    },
    dispose() {
      master.disconnect();
      fb.disconnect();
    },
  };
}

// La minör, vi - IV - I - V; enerjik, orta frekansları dolduran maske müziği
const PARTY_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
const PARTY_BASS = [45, 41, 48, 43];

function createParty(ctx, out) {
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(out);
  const drums = ctx.createGain();
  drums.gain.value = 1.3;
  drums.connect(master);
  const synth = ctx.createGain();
  synth.gain.value = 1.1;
  synth.connect(master);
  const bassBus = ctx.createBiquadFilter();
  bassBus.type = 'lowpass';
  bassBus.frequency.value = 1100;
  bassBus.connect(master);

  // Sürekli pembe gürültü yatağı, konuşma frekanslarını örter
  const bed = ctx.createBufferSource();
  bed.buffer = pinkBuffer();
  bed.loop = true;
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'bandpass';
  bedFilter.frequency.value = 1300;
  bedFilter.Q.value = 0.35;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.55;
  bed.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(master);
  bed.start();

  return {
    bpm: 124,
    swing: 0,
    bars: 4,
    level: 1,
    master,
    step(t, s, bar, loop, sd) {
      const chord = PARTY_CHORDS[bar];
      const root = PARTY_BASS[bar];
      if (s % 4 === 0) kick(ctx, drums, t, 1);
      if (s === 4 || s === 12) snare(ctx, drums, t, 1.4);
      if (s % 4 === 2) hat(ctx, drums, t, 1.2, true);
      else hat(ctx, drums, t, 0.6);
      if (s % 4 === 2) bass(ctx, bassBus, t, root + 12, 2 * sd, 1);
      else if (s % 4 === 0) bass(ctx, bassBus, t, root, sd, 0.7);
      if (s === 0 || s === 3 || s === 6 || s === 10) stab(ctx, synth, t, chord, 2 * sd, 1);
      blip(ctx, synth, t, chord[s % 3] + 24, sd * 0.8, 0.022);
    },
    dispose() {
      try { bed.stop(); } catch { /* zaten durmuş */ }
      master.disconnect();
    },
  };
}

/* ---------- Zamanlayıcı ---------- */

let song = null;
let timer = 0;
let nextTime = 0;
let stepIdx = 0;
let duckNode = null;
let paused = false;
let pauseTimer = 0;
const duckReasons = new Set();

function ensureGraph(ctx) {
  if (duckNode) return;
  duckNode = ctx.createGain();
  duckNode.gain.value = duckReasons.size ? 0.0001 : 1;
  duckNode.connect(bus('music'));
}

function tick() {
  const ctx = getCtx();
  if (!ctx || !song || paused) return;
  const sd = 60 / song.bpm / 4;
  if (nextTime < ctx.currentTime - 0.3) nextTime = ctx.currentTime + 0.06;
  while (nextTime < ctx.currentTime + 0.15) {
    const s = stepIdx % 16;
    const barAbs = Math.floor(stepIdx / 16);
    const t = nextTime + (s % 2 ? song.swing * sd : 0);
    try {
      song.step(t, s, barAbs % song.bars, Math.floor(barAbs / song.bars), sd);
    } catch (err) {
      console.error(err);
    }
    stepIdx++;
    nextTime += sd;
  }
}

export const music = {
  current() {
    return song ? song.name : null;
  },
  play(name = 'chill') {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (song && song.name === name) return;
    this.stop();
    ensureGraph(ctx);
    song = name === 'party' ? createParty(ctx, bus('mask')) : createChill(ctx, duckNode);
    song.name = name;
    stepIdx = 0;
    nextTime = ctx.currentTime + 0.08;
    paused = name === 'chill' && duckReasons.size > 0;
    const g = song.master.gain;
    g.setValueAtTime(0.0001, ctx.currentTime);
    g.exponentialRampToValueAtTime(song.level, ctx.currentTime + 0.7);
    clearInterval(timer);
    timer = setInterval(tick, 25);
    tick();
  },
  stop() {
    if (!song) return;
    const ctx = getCtx();
    const old = song;
    song = null;
    clearInterval(timer);
    timer = 0;
    const now = ctx.currentTime;
    const g = old.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.setTargetAtTime(0.0001, now, 0.08);
    setTimeout(() => old.dispose(), 900);
  },
  // Kayıt ve dinleme sırasında müziği kıs; birden çok sebep aynı anda olabilir
  duck(reason, on) {
    if (on) duckReasons.add(reason);
    else duckReasons.delete(reason);
    const ctx = getCtx();
    if (!ctx || !duckNode) return;
    const g = duckNode.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.setTargetAtTime(duckReasons.size ? 0.0001 : 1, now, duckReasons.size ? 0.04 : 0.3);
    // Kısıkken nota üretmeyi tamamen durdur; kayıt ve dinleme sırasında ses motoru boş kalsın
    clearTimeout(pauseTimer);
    if (duckReasons.size) {
      pauseTimer = setTimeout(() => { if (song && song.name === 'chill' && duckReasons.size) paused = true; }, 300);
    } else if (paused) {
      paused = false;
      nextTime = ctx.currentTime + 0.05;
    }
  },
  get name() {
    return song ? song.name : null;
  },
};
