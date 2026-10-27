// İntronun müziği ve efektleri: hepsi Web Audio ile üretilir, dosya yüklenmez.
// Olaylar saniye cinsinden zaman çizelgesine yazılır; küçük bir ileri bakışla sırayla kurulur, görüntüyle aynı saate bağlıdır.
// Fa majör, dakikada 100 vuruş: bir vuruş 0,6 saniye, bir ölçü 2,4 saniye.

import { bus, noiseBuffer, mtof } from '../audio/engine.js';

export const BEAT = 0.6;
export const LENGTH = 46;

// Akorlar MIDI numarasıyla
const CH = {
  Fmaj7: [53, 57, 60, 64], Dm7: [50, 57, 60, 65], Bbmaj7: [46, 53, 57, 62], Csus: [48, 53, 55, 60], C: [48, 52, 55, 60],
  F: [53, 57, 60, 65], CE: [52, 55, 60, 64], Am: [45, 52, 57, 60], Bb: [46, 53, 58, 62], Fhi: [41, 53, 57, 60, 65, 69],
};

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function createScore(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(bus('sfx'));
  const dry = ctx.createGain();
  dry.gain.value = 0.9;
  dry.connect(master);
  const rev = ctx.createConvolver();
  rev.buffer = impulse(ctx, 2.8, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.42;
  rev.connect(wet);
  wet.connect(master);

  const out = (node, send = 0.3) => {
    node.connect(dry);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(rev);
    }
  };

  /* ---------- Çalgılar ---------- */

  function osc(type, f, t, end) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end);
    return o;
  }
  function gainEnv(t, attack, peak, hold, release) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  // Yumuşak yaylı halı: iki hafif akortsuz testere, açılan süzgeç
  function pad(t, notes, dur, { vol = 0.035, bright = 1100, attack = 1.2, release = 1.6, send = 0.55 } = {}) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.6;
    f.frequency.setValueAtTime(bright * 0.35, t);
    f.frequency.linearRampToValueAtTime(bright, t + attack + 0.4);
    const g = gainEnv(t, attack, vol, Math.max(0, dur - attack), release);
    f.connect(g);
    out(g, send);
    const end = t + dur + release + 0.1;
    for (const m of notes) {
      for (const det of [-7, 7]) {
        const o = osc('sawtooth', mtof(m), t, end);
        o.detune.value = det;
        o.connect(f);
      }
    }
  }

  // Müzik kutusu: saf tını ve bir çan harmoniği
  function box(t, m, vol = 0.07, send = 0.6) {
    const f = mtof(m);
    const g = gainEnv(t, 0.004, vol, 0, 1.6);
    out(g, send);
    osc('sine', f, t, t + 1.7).connect(g);
    const g2 = gainEnv(t, 0.002, vol * 0.35, 0, 0.5);
    out(g2, send);
    osc('sine', f * 3.01, t, t + 0.6).connect(g2);
  }

  function chime(t, m, vol = 0.06, send = 0.7) {
    const f = mtof(m);
    for (const [mul, v, d] of [[1, 1, 2.6], [2.76, 0.4, 1.4], [5.4, 0.18, 0.7]]) {
      const g = gainEnv(t, 0.003, vol * v, 0, d);
      out(g, send);
      osc('sine', f * mul, t, t + d + 0.05).connect(g);
    }
  }

  function pluck(t, m, vol = 0.06, dur = 0.32, send = 0.3) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = gainEnv(t, 0.004, vol, 0, dur);
    f.connect(g);
    out(g, send);
    osc('triangle', mtof(m), t, t + dur + 0.05).connect(f);
  }

  function bass(t, m, dur, vol = 0.12) {
    const g = gainEnv(t, 0.01, vol, Math.max(0, dur - 0.25), 0.25);
    out(g, 0);
    osc('sine', mtof(m), t, t + dur + 0.05).connect(g);
    const g2 = gainEnv(t, 0.01, vol * 0.3, Math.max(0, dur - 0.25), 0.2);
    out(g2, 0);
    osc('triangle', mtof(m + 12), t, t + dur + 0.05).connect(g2);
  }

  function noise(t, dur, { type = 'bandpass', f = 1500, f2 = 0, q = 0.8, vol = 0.1, attack = 0.004, send = 0.2 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f, t);
    if (f2) filt.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = gainEnv(t, attack, vol, 0, Math.max(0.01, dur - attack));
    src.connect(filt);
    filt.connect(g);
    out(g, send);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function kick(t, vol = 0.5) {
    const g = gainEnv(t, 0.002, vol, 0, 0.32);
    out(g, 0);
    const o = osc('sine', 150, t, t + 0.36);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    o.connect(g);
  }
  const clap = (t, vol = 0.11) => {
    noise(t, 0.16, { f: 1700, q: 0.9, vol, send: 0.35 });
    noise(t + 0.012, 0.12, { f: 2100, q: 1.2, vol: vol * 0.6, send: 0.2 });
  };
  const hat = (t, vol = 0.03, open = false) => noise(t, open ? 0.2 : 0.05, { type: 'highpass', f: 7600, q: 0.5, vol, send: 0.05 });
  const shaker = (t, vol = 0.02) => noise(t, 0.08, { type: 'highpass', f: 5200, q: 0.7, vol, attack: 0.03, send: 0.1 });

  const whoosh = (t, dur = 0.45, vol = 0.08, up = true) => noise(t, dur, { f: up ? 500 : 3500, f2: up ? 4200 : 400, q: 1.4, vol, attack: dur * 0.6, send: 0.3 });
  function riser(t, dur, vol = 0.06) {
    noise(t, dur, { type: 'highpass', f: 300, f2: 6000, q: 0.6, vol, attack: dur * 0.92, send: 0.4 });
    const g = gainEnv(t, dur * 0.92, vol * 0.35, 0, dur * 0.08 + 0.05);
    out(g, 0.4);
    const o = osc('sawtooth', 110, t, t + dur + 0.1);
    o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    o.connect(f);
    f.connect(g);
  }
  function boom(t, vol = 0.45) {
    const g = gainEnv(t, 0.004, vol, 0, 2.4);
    out(g, 0.2);
    const o = osc('sine', 62, t, t + 2.5);
    o.frequency.exponentialRampToValueAtTime(34, t + 1.6);
    o.connect(g);
  }
  const crash = (t, vol = 0.07, dur = 2.4) => noise(t, dur, { type: 'highpass', f: 4200, q: 0.4, vol, send: 0.5 });
  function reverseCymbal(t, dur, vol = 0.06) {
    noise(t, dur, { type: 'highpass', f: 3000, f2: 8000, q: 0.4, vol, attack: dur - 0.02, send: 0.4 });
  }

  function cricket(t) {
    for (let i = 0; i < 3; i++) {
      const g = gainEnv(t + i * 0.075, 0.006, 0.012, 0.02, 0.025);
      out(g, 0.3);
      osc('sine', 4300 + Math.random() * 300, t + i * 0.075, t + i * 0.075 + 0.07).connect(g);
    }
  }
  function bird(t) {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.14;
      const g = gainEnv(s, 0.01, 0.025, 0.03, 0.05);
      out(g, 0.5);
      const o = osc('sine', 2600, s, s + 0.12);
      o.frequency.exponentialRampToValueAtTime(3900, s + 0.05);
      o.frequency.exponentialRampToValueAtTime(3000, s + 0.1);
      o.connect(g);
    }
  }
  function boing(t, m) {
    const g = gainEnv(t, 0.003, 0.09, 0, 0.3);
    out(g, 0.25);
    const o = osc('sine', mtof(m) * 0.75, t, t + 0.35);
    o.frequency.exponentialRampToValueAtTime(mtof(m) * 1.3, t + 0.12);
    o.connect(g);
  }
  function pop(t, vol = 0.12) {
    const g = gainEnv(t, 0.002, vol, 0, 0.09);
    out(g, 0.2);
    const o = osc('sine', 900, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.08);
    o.connect(g);
  }
  function sparkle(t, n = 6, base = 84) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    for (let i = 0; i < n; i++) chime(t + i * 0.055 + Math.random() * 0.02, base + scale[(i * 3) % scale.length], 0.022, 0.8);
  }
  function firework(t, vol = 0.22) {
    // Yükselen ıslık, patlama, çıtırtılar
    const lg = gainEnv(t - 0.42, 0.05, 0.018, 0.3, 0.05);
    out(lg, 0.3);
    const lo = osc('sine', 700, t - 0.42, t);
    lo.frequency.exponentialRampToValueAtTime(1900, t - 0.02);
    lo.connect(lg);
    const g = gainEnv(t, 0.003, vol, 0, 0.6);
    out(g, 0.45);
    const o = osc('sine', 110, t, t + 0.65);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    o.connect(g);
    noise(t, 0.7, { type: 'lowpass', f: 1600, q: 0.5, vol: vol * 0.5, send: 0.5 });
    for (let i = 0; i < 12; i++) noise(t + 0.18 + Math.random() * 0.75, 0.025, { type: 'highpass', f: 3500, q: 0.6, vol: 0.03 + Math.random() * 0.03, send: 0.3 });
  }
  function drumroll(t, dur) {
    let s = t;
    let gap = 0.12;
    while (s < t + dur) {
      const p = (s - t) / dur;
      noise(s, 0.07, { f: 1900, q: 0.8, vol: 0.02 + p * 0.07, send: 0.25 });
      s += gap;
      gap = Math.max(0.035, gap * 0.93);
    }
  }
  const chord = (t, notes, fn) => notes.forEach((m, i) => fn(t, m, i));

  /* ---------- Zaman çizelgesi ---------- */

  const ev = [];
  const at = (t, fn) => ev.push([t, fn]);

  // Gece: rüzgâr, cırcır böcekleri, yumuşak halı, müzik kutusu
  at(0, (t) => noise(t, 10, { type: 'lowpass', f: 420, q: 0.3, vol: 0.02, attack: 3, send: 0.1 }));
  for (const c of [1.0, 2.3, 3.1, 4.6, 5.5, 7.2, 8.1]) at(c, cricket);
  at(0.2, (t) => pad(t, CH.Fmaj7, 2.4, { bright: 900 }));
  at(2.4, (t) => pad(t, CH.Dm7, 2.4, { bright: 900 }));
  at(4.8, (t) => pad(t, CH.Bbmaj7, 2.4, { bright: 950 }));
  at(7.2, (t) => pad(t, CH.Csus, 1.2, { bright: 1000 }));
  at(8.4, (t) => pad(t, CH.C, 1.4, { bright: 1100, release: 1.2 }));
  at(0.8, (t) => chime(t, 89, 0.03));
  for (const [t, m] of [[1.2, 81], [1.8, 79], [2.4, 77], [3.6, 81], [4.2, 84], [4.8, 86], [6.6, 84], [7.2, 81], [7.8, 79], [8.4, 77]]) at(t, (s) => box(s, m));
  at(5.9, (t) => whoosh(t, 1.0, 0.05, false));
  at(6.25, (t) => sparkle(t, 7, 86));
  at(8.2, (t) => riser(t, 1.4, 0.035));

  // Gün doğumu: halı açılır, arpej, kuşlar, zıplamalar, buluşma
  at(9.6, (t) => { pad(t, CH.F, 2.4, { vol: 0.04, bright: 1700, attack: 0.8 }); chime(t, 77, 0.05); bass(t, 41, 2.3, 0.1); });
  at(12.0, (t) => { pad(t, CH.CE, 2.4, { vol: 0.04, bright: 1900, attack: 0.6 }); bass(t, 40, 2.3, 0.1); });
  at(14.4, (t) => { pad(t, CH.Dm7, 2.4, { vol: 0.04, bright: 2000, attack: 0.6 }); bass(t, 38, 2.3, 0.1); });
  at(16.8, (t) => { pad(t, CH.Bb, 1.2, { vol: 0.04, bright: 2100, attack: 0.4 }); bass(t, 34, 1.15, 0.1); });
  at(18.0, (t) => { pad(t, CH.C, 1.2, { vol: 0.042, bright: 2300, attack: 0.3, release: 0.9 }); bass(t, 36, 1.1, 0.1); });
  const arps = [[9.6, [65, 69, 72, 77]], [12.0, [64, 67, 72, 76]], [14.4, [62, 65, 69, 74]], [16.8, [62, 65, 70, 74]], [18.0, [64, 67, 72, 76]]];
  for (const [t0, tones] of arps) {
    const n = t0 >= 16.8 ? 4 : 8;
    for (let i = 0; i < n; i++) at(t0 + i * BEAT / 2, (t) => pluck(t, tones[[0, 1, 2, 3, 2, 1, 2, 3][i]], 0.045));
  }
  for (const b of [12.6, 13.3, 15.3, 17.1]) at(b, bird);
  [13.8, 14.4, 15.0, 15.6].forEach((t, i) => at(t, (s) => { boing(s, 72 + [0, 2, 4, 5][i]); boing(s + 0.01, 79 + [0, 2, 4, 5][i]); }));
  at(16.2, (t) => { pop(t, 0.16); chord(t + 0.05, [77, 81, 84, 89], (s, m, i) => chime(s + i * 0.08, m, 0.05)); sparkle(t + 0.35, 6, 89); });
  at(18.0, (t) => riser(t, 1.2, 0.06));
  at(18.85, (t) => whoosh(t, 0.4, 0.1, true));

  // Montaj: davul, bas, akor vuruşları, her kart bir vuruşta
  const montage = [[19.2, 'F', 41], [21.6, 'Am', 45], [24.0, 'Bb', 46], [26.4, 'C', 48]];
  for (const [t0, name, root] of montage) {
    for (let b = 0; b < 4; b++) {
      const s = t0 + b * BEAT;
      if (t0 === 26.4 && b > 1) break;
      if (b === 0 || b === 2) at(s, (t) => kick(t, 0.42));
      if (b === 1 || b === 3) at(s, (t) => clap(t));
      at(s, (t) => hat(t));
      at(s + BEAT / 2, (t) => hat(t, 0.025, b === 3));
      at(s, (t) => bass(t, root - 12 + (b % 2 ? 12 : 0), BEAT * 0.45, 0.13));
      at(s + BEAT / 2, (t) => bass(t, root - 12 + 7, BEAT * 0.3, 0.08));
    }
    at(t0, (t) => chord(t, CH[name], (s, m) => pluck(s, m + 12, 0.035, 0.4)));
    at(t0 + BEAT * 1.5, (t) => chord(t, CH[name], (s, m) => pluck(s, m + 12, 0.03, 0.3)));
  }
  [72, 74, 76, 77, 79, 81, 84, 86].forEach((m, k) => at(19.2 + k * BEAT, (t) => { whoosh(t - 0.18, 0.28, 0.05); pluck(t, m, 0.06, 0.5, 0.4); }));
  at(24.0, (t) => { boing(t, 74); boing(t + 0.02, 81); });
  for (const b of [24.0, 24.6, 25.2, 25.8]) at(b, (t) => pop(t, 0.06));
  at(25.2, (t) => riser(t, 1.2, 0.05));
  at(26.4, (t) => { whoosh(t, 0.6, 0.1, false); crash(t, 0.05, 1.6); kick(t, 0.5); });
  at(27.0, (t) => whoosh(t, 0.45, 0.07, true));
  at(27.4, (t) => reverseCymbal(t, 1.4, 0.045));

  // Gün batımı ve havai fişekler
  at(28.8, (t) => { pad(t, CH.Dm7, 2.4, { vol: 0.04, bright: 1500 }); bass(t, 38, 2.3, 0.09); });
  at(31.2, (t) => { pad(t, CH.Bbmaj7, 2.4, { vol: 0.04, bright: 1500 }); bass(t, 34, 2.3, 0.09); });
  at(33.6, (t) => { pad(t, CH.C, 2.4, { vol: 0.042, bright: 1700 }); bass(t, 36, 2.3, 0.09); });
  for (let b = 0; b < 10; b++) {
    const s = 30.0 + b * BEAT;
    if (b % 2 === 0) at(s, (t) => kick(t, 0.28));
    at(s, (t) => shaker(t));
    at(s + BEAT / 2, (t) => shaker(t, 0.014));
  }
  for (const [t, m] of [[29.4, 81], [30.0, 84], [30.6, 86], [31.8, 84], [32.4, 81], [33.0, 79], [34.2, 77]]) at(t, (s) => box(s, m, 0.06));
  for (const c of [29.2, 31.0, 33.1]) at(c, cricket);
  for (const f of [31.2, 31.8, 32.4, 33.6, 34.2]) at(f, (t) => firework(t));
  at(34.8, (t) => { drumroll(t, 1.2); riser(t, 1.2, 0.05); });

  // Logo: büyük vuruş, çan arpeji, uzun akor
  at(36.0, (t) => {
    kick(t, 0.6);
    boom(t);
    crash(t, 0.09, 3);
    pad(t, CH.Fhi, 5.6, { vol: 0.045, bright: 3000, attack: 0.05, release: 2.2, send: 0.6 });
    chord(t, [65, 69, 72, 77], (s, m) => pluck(s, m, 0.05, 0.9, 0.5));
    bass(t, 29, 2.2, 0.16);
  });
  at(36.3, (t) => chord(t, [77, 81, 84, 89, 93], (s, m, i) => chime(s + i * 0.09, m, 0.045)));
  for (const f of [36.4, 37.0, 37.6, 38.8, 40.0]) at(f, (t) => firework(t, 0.14));
  for (let i = 0; i < 16; i++) at(36.6 + i * BEAT / 2, (t) => pluck(t, [77, 81, 84, 81][i % 4] + (i >= 8 ? 2 : 0) - (i >= 12 ? 2 : 0), 0.03, 0.3, 0.45));
  for (let b = 0; b < 8; b++) {
    const s = 36.6 + b * BEAT;
    if (b % 2 === 0) at(s, (t) => kick(t, 0.22));
    at(s + BEAT / 2, (t) => hat(t, 0.018));
  }
  at(39.6, (t) => chime(t, 84, 0.06));
  at(41.2, (t) => { whoosh(t - 0.2, 0.4, 0.07); chime(t, 89, 0.06); sparkle(t + 0.1, 5, 89); });
  at(41.6, (t) => pad(t, CH.Bbmaj7, 2.0, { vol: 0.035, bright: 2200, attack: 0.6 }));
  at(42.4, (t) => reverseCymbal(t, 1.2, 0.05));
  at(43.6, (t) => {
    chord(t, [65, 69, 72, 77, 81], (s, m, i) => chime(s + i * 0.03, m, 0.04));
    pad(t, CH.F, 1.6, { vol: 0.04, bright: 2400, attack: 0.05, release: 1.8 });
    bass(t, 41, 1.6, 0.1);
  });

  ev.sort((a, b) => a[0] - b[0]);

  let t0 = 0;
  let next = 0;
  let stopped = false;
  return {
    // t: başlangıç anı (AudioContext saati)
    start(t) {
      t0 = t;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.85, t + 0.6);
    },
    // Görüntü saatine göre önümüzdeki 0,4 saniyelik olayları kur
    pump(sec) {
      if (stopped) return;
      while (next < ev.length && ev[next][0] <= sec + 0.4) {
        const [time, fn] = ev[next++];
        if (time < sec - 0.25) continue;
        try { fn(t0 + time); } catch (err) { console.error(err); }
      }
    },
    fade(seconds = 0.5) {
      stopped = true;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      setTimeout(() => { try { master.disconnect(); } catch { /* zaten kopmuş */ } }, (seconds + 3.5) * 1000);
    },
  };
}
