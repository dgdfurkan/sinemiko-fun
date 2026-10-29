// Ritim Kolları: müziğin vuruşunda yukarıdan notalar düşer. Nota çizgiye gelince o taraftaki kolunu kaldır.
// İkisi birden gelirse iki kolunu birden. Zamanlaman ne kadar iyiyse o kadar puan; ikiniz aynı şarkıda yarışırsınız

import { html, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, inked, roundRect, PCOL, tag, missingText, hideTop } from './arena.js';
import { drawSkeleton } from './cam.js';

const LEAD = 1700;
const EARLY = 270;
const LATE = 230;
const PERFECT = 120;
const HIT_Y = 0.78;
const SPEEDS = { slow: 92, mid: 108, fast: 124 };
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-beat',
    kind: 'pose',
    cfg: { speed: 'mid' },
    rules: [
      'Müzik başlayınca iki sütunda notalar düşer: soldaki sol kolun, sağdaki sağ kolun.',
      'Nota alttaki çizgiye geldiği an o kolunu yukarı kaldır, sonra indir. İkisi birden gelirse iki kolunu.',
      html`Tam zamanında <b>+2</b>, biraz erken ya da geç <b>+1</b>. Seri yaptıkça bonus gelir.`,
    ],
    options: (cfg) => optHTML('Hız', segHTML('speed', [['slow', 'Yavaş'], ['mid', 'Orta'], ['fast', 'Hızlı']], cfg.speed)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="speed"]'), { value: cfg.speed, onChange: (v) => { cfg.speed = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Sahne Sizin',
    waitTip: 'Yan yana oturun; kollarınızı rahatça kaldırabileceğiniz kadar aralık bırakın.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-dans', 'combo'],
    tie: 'Berabere! Aynı Ritimde',
    albumTitle: 'Ritim Kolları',
    mid: () => 'Müzik',
    play,
  });
}

// Şarkı: ısınma, yoğunlaşma, final. Notalar vuruş numarasıyla
function chart(beats) {
  const out = [];
  for (let b = 4; b < beats; b++) {
    const phase = b / beats;
    const every = phase < 0.25 ? 2 : 1;
    if (b % every) continue;
    if (phase > 0.25 && phase < 0.85 && b % 8 === 7) continue;
    let kind = pick(['L', 'R']);
    if (b % 4 === 0 && phase > 0.35 && Math.random() < 0.45) kind = 'B';
    out.push({ beat: b, kind });
    // Arada yarım vuruş: sonlara doğru
    if (phase > 0.6 && b % 4 === 2 && Math.random() < 0.5) out.push({ beat: b + 0.5, kind: kind === 'L' ? 'R' : 'L' });
  }
  return out;
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.bpm = SPEEDS[cfg.speed] || 108;
  m.beatMs = 60000 / m.bpm;
  m.beats = 64;
  m.notes = chart(m.beats).map((n) => ({ ...n, t: n.beat * m.beatMs, got: [null, null], arms: [[false, false], [false, false]] }));
  m.up = [[false, false], [false, false]];
  m.combo = [0, 0];
  m.bestCombo = [0, 0];
  m.perf = [0, 0];
  m.hit = [0, 0];
  m.flash = [[0, 0], [0, 0]];
  m.sched = -1;
  m.t0 = 0;
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Sahne Sizin</h2><p class="hud-tip">Nota çizgiye gelince o kolunu kaldır.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (!m.running) return;
    const now = ctx.now() - m.t0;
    players.forEach((p, i) => {
      if (!p) return;
      const lm = p.lm;
      const ar = p.ar || 16 / 9;
      const sw = Math.hypot((lm[11].x - lm[12].x) * ar, lm[11].y - lm[12].y) || 0.1;
      // Ekranın solunda görünen kol 0, sağındaki 1
      [[11, 13, 15], [12, 14, 16]].forEach(([s, e, w], k) => {
        const wr = lm[w];
        const el = lm[e];
        const raised = (wr.v > 0.3 && wr.y < lm[s].y - 0.3 * sw) || (el.v > 0.3 && el.y < lm[s].y - 0.25 * sw && wr.v < 0.3);
        const lowered = !(wr.v > 0.3) || wr.y > lm[s].y + 0.05 * sw;
        if (raised && !m.up[i][k]) {
          m.up[i][k] = true;
          onset(ctx, i, k, now);
        } else if (lowered && m.up[i][k]) m.up[i][k] = false;
      });
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'Dans!', voice: 'go-dans' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.t0 = ctx.now() + 400;
  m.running = true;
}

function onset(ctx, i, k, now) {
  const { m, cam, fx } = ctx;
  m.flash[i][k] = performance.now();
  const want = k === 0 ? 'L' : 'R';
  const n = m.notes.find((q) => !q.got[i] && (q.kind === want || q.kind === 'B') && !q.arms[i][k] && now > q.t - EARLY && now < q.t + LATE);
  if (!n) {
    if (m.combo[i] > 2) fx.text(laneX(ctx, i, k), HIT_Y * cam.H - 60, 'Boşa!', '#a99cb3', 16);
    m.combo[i] = 0;
    return;
  }
  n.arms[i][k] = true;
  if (n.kind === 'B' && !(n.arms[i][0] && n.arms[i][1])) return;
  const off = Math.abs(now - n.t);
  const perfect = off < PERFECT;
  n.got[i] = perfect ? 'perfect' : 'good';
  m.hit[i]++;
  m.combo[i]++;
  m.bestCombo[i] = Math.max(m.bestCombo[i], m.combo[i]);
  let pts = perfect ? 2 : 1;
  if (perfect) m.perf[i]++;
  if (m.combo[i] > 0 && m.combo[i] % 10 === 0) {
    pts += 3;
    announcer.react('combo');
    fx.text(cam.W * (ctx.half(i)[0] + 0.25), cam.H * 0.4, `${m.combo[i]} Seri! +3`, PCOL[i], 26);
    sfx.success();
  }
  const x = n.kind === 'B' ? (laneX(ctx, i, 0) + laneX(ctx, i, 1)) / 2 : laneX(ctx, i, k);
  const y = HIT_Y * cam.H;
  fx.burst(x, y, { n: perfect ? 18 : 10, colors: [PCOL[i], '#ffcd3c', '#fff'], power: perfect ? 340 : 220, shape: perfect ? 'star' : 'circle' });
  fx.text(x, y - 50, perfect ? 'Harika!' : 'İyi', perfect ? '#ffcd3c' : PCOL[i], perfect ? 22 : 18);
  ctx.score(i, pts, x / cam.W, y / cam.H, { quiet: true });
}

const laneX = (ctx, i, k) => {
  const [a, b] = ctx.half(i);
  return (a + (b - a) * (k === 0 ? 0.3 : 0.7)) * ctx.cam.W;
};

// Müzik: vuruşlar biraz önceden ses motoruna kurulur, görüntüyle aynı anda çalar
function schedule(ctx, now) {
  const { m } = ctx;
  while (m.sched + 1 < m.beats + 4 && (m.sched + 1) * m.beatMs < now + 160) {
    m.sched++;
    const b = m.sched;
    const when = Math.max(0, (b * m.beatMs - now) / 1000);
    if (b >= m.beats) continue;
    sfx.kick(when);
    sfx.hat(when + m.beatMs / 2000);
    if (b % 2 === 1) sfx.clap(when);
    const note = m.notes.find((q) => Math.floor(q.beat) === b);
    if (note) sfx.note(SCALE[(b * 3 + (note.kind === 'R' ? 2 : 0)) % SCALE.length], m.beatMs / 1000 * 0.8, { when, vol: 0.09 });
  }
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const H = cam.H;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { trail: false, alpha: 0.75 }); });
  const now = m.running ? ctx.now() - m.t0 : -LEAD;
  if (m.running && dt > 0) {
    schedule(ctx, now);
    for (const n of m.notes) {
      for (const i of [0, 1]) {
        if (!n.got[i] && now > n.t + LATE) {
          n.got[i] = 'miss';
          if (m.combo[i] > 3) fx.text(n.kind === 'B' ? (laneX(ctx, i, 0) + laneX(ctx, i, 1)) / 2 : laneX(ctx, i, n.kind === 'L' ? 0 : 1), HIT_Y * H - 40, 'Kaçtı', '#a99cb3', 16);
          m.combo[i] = 0;
        }
      }
    }
    if (now > m.beats * m.beatMs + 600) end(ctx);
  }
  for (const i of [0, 1]) {
    // Şeritler ve çizgi
    for (const k of [0, 1]) {
      const x = laneX(ctx, i, k);
      g.fillStyle = '#ffffff2a';
      roundRect(g, x - 34, 0, 68, H, 16);
      g.fill();
      const lit = performance.now() - m.flash[i][k] < 200;
      g.beginPath();
      g.arc(x, HIT_Y * H, 30, 0, Math.PI * 2);
      g.lineWidth = lit ? 8 : 5;
      g.strokeStyle = lit ? '#ffcd3c' : '#ffffffcc';
      g.stroke();
      g.lineWidth = 2.5;
      g.strokeStyle = '#2a1636';
      g.stroke();
    }
    tag(g, (laneX(ctx, i, 0) + laneX(ctx, i, 1)) / 2, HIT_Y * H + 56, m.combo[i] > 1 ? `${nameOf(i)} · ${m.combo[i]} seri` : nameOf(i), PCOL[i], 15);
  }
  // Notalar
  for (const n of m.notes) {
    const dtn = n.t - now;
    if (dtn > LEAD || dtn < -LATE - 200) continue;
    const y = (HIT_Y - (dtn / LEAD) * HIT_Y) * H;
    for (const i of [0, 1]) {
      if (n.got[i] && n.got[i] !== 'miss') continue;
      const lanes = n.kind === 'B' ? [0, 1] : [n.kind === 'L' ? 0 : 1];
      g.globalAlpha = n.got[i] === 'miss' ? 0.35 : 1;
      for (const k of lanes) {
        if (n.arms[i][k]) continue;
        const x = laneX(ctx, i, k);
        g.beginPath();
        g.arc(x, y, 24, 0, Math.PI * 2);
        inked(g, n.kind === 'B' ? '#a98bff' : PCOL[i], 3.5);
        g.beginPath();
        g.moveTo(x, y + 11);
        g.lineTo(x, y - 10);
        g.moveTo(x - 8, y - 2);
        g.lineTo(x, y - 11);
        g.lineTo(x + 8, y - 2);
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.strokeStyle = '#fff';
        g.stroke();
      }
      if (n.kind === 'B' && !n.arms[i][0] && !n.arms[i][1]) {
        g.beginPath();
        g.moveTo(laneX(ctx, i, 0) + 24, y);
        g.lineTo(laneX(ctx, i, 1) - 24, y);
        g.lineWidth = 5;
        g.strokeStyle = '#a98bff';
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  if (m.running) {
    const left = Math.max(0, Math.ceil((m.beats * m.beatMs - now) / 1000));
    scoreboard.setMid(`${left} sn`);
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.cheer();
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.bestCombo[i]} seri`, { pad: 0.2, force: true }));
    const total = m.notes.length;
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.hit[i]}/${total}</b> nota</span><span><b>${m.perf[i]}</b> harika</span><span><b>${m.bestCombo[i]}</b> en uzun seri</span>`),
    });
  }, 900);
}
