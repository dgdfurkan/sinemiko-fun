// Halat Çekme: kollarını ne kadar hızlı çekip sallarsan halat o kadar senin tarafına gelir.
// Kalpli bayrağı kendi çizgine getiren turu alır

import { html, clamp, rand } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { optHTML } from './common.js';
import { camDuel, heartPath, inked, PCOL, tag, roundRect, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';

const WIN_X = 0.34;
const ROPE_Y = 0.84;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-tug',
    kind: 'pose',
    cfg: { bestOf: '3' },
    rules: [
      'Aranızda bir halat var, ortasında kalpli bir bayrak. Kollarını hızlı hızlı çekip sallayınca halat sana gelir.',
      'Ne kadar hızlı ve büyük hareket edersen o kadar güçlü çekersin. Durursan halat kayar!',
      'Bayrağı kendi çizgine getiren turu alır. Süre biterse bayrak kimin tarafındaysa o kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Tur', segHTML('bestOf', [['1', 'Tek Tur'], ['3', '3 Tur'], ['5', '5 Tur']], cfg.bestOf)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="bestOf"]'), { value: cfg.bestOf, onChange: (v) => { cfg.bestOf = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Halatı Kavrayın',
    waitTip: 'Belinizden yukarısı görünsün, kollarınızı rahatça sallayabilin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'tug-go', 'yay-2', 'yay-3', 'timeup'],
    tie: 'Berabere! Halat Ortada Kaldı',
    albumTitle: 'Halat Çekme',
    mid: () => 'Tur 1',
    play: (ctx) => {
      Object.assign(ctx.m, { round: 0, peak: [0, 0] });
      round(ctx);
    },
  });
}

async function round(ctx) {
  const { cam, cfg, m, fx } = ctx;
  const need = Math.ceil(Number(cfg.bestOf) / 2);
  Object.assign(m, { r: 0, pw: [0, 0], prev: [null, null], running: false, t0: 0, lastT: 0, drops: [] });
  fx.clear();
  scoreboard.setMid(`Tur ${m.round + 1}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="pop-clock" data-clock>30</div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = m.lastT ? Math.min(0.15, (now - m.lastT) / 1000) : 0;
    m.lastT = now;
    players.forEach((p, i) => {
      if (!p) {
        m.prev[i] = null;
        return;
      }
      const lm = p.lm;
      const ar = p.ar || 16 / 9;
      const sw = Math.hypot((lm[11].x - lm[12].x) * ar, lm[11].y - lm[12].y) || 0.1;
      const cur = [15, 16, 13, 14].map((k) => (lm[k].v > 0.35 ? { x: lm[k].x * ar, y: lm[k].y } : null));
      let e = 0;
      if (m.prev[i] && dt > 0) {
        cur.forEach((q, k) => {
          const o = m.prev[i][k];
          if (!q || !o) return;
          // Bilekler tam, dirsekler yarım sayılır; takip sıçramaları kırpılır
          e += Math.min(0.7, Math.hypot(q.x - o.x, q.y - o.y) / sw) * (k < 2 ? 1 : 0.5);
        });
        const rate = e / dt;
        const a = 1 - Math.exp(-dt / 0.35);
        m.pw[i] += (rate - m.pw[i]) * a;
      }
      m.prev[i] = cur;
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Çekin!', voice: 'tug-go' });
  if (!ctx.life.alive || m.over) return;
  m.running = true;
  m.t0 = ctx.now();
  m.clock = ctx.clock(clockEl, 30, { onEnd: () => end(ctx, need) });
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const L = cam.leftIs;
  const R = 1 - L;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { alpha: 0.7, label: '', glow: clamp(m.pw[i] / 12, 0, 1) }); });
  if (m.running) {
    const el = (ctx.now() - m.t0) / 1000;
    const k = 0.045 + Math.min(0.05, el * 0.002);
    m.r = clamp(m.r + (m.pw[R] - m.pw[L]) * k * dt, -1.05, 1.05);
    if (Math.abs(m.r) >= 1) end(ctx, Math.ceil(Number(ctx.cfg.bestOf) / 2));
    for (const i of [0, 1]) m.peak[i] = Math.max(m.peak[i], m.pw[i]);
  }
  // Zemin çizgileri: orta çamur ve iki bitiş çizgisi
  const y = ROPE_Y * H;
  g.beginPath();
  g.ellipse(W / 2, y + 18, W * 0.07, 16, 0, 0, Math.PI * 2);
  inked(g, '#8a5a36aa', 3);
  for (const [side, who] of [[-1, L], [1, R]]) {
    const x = W / 2 + side * WIN_X * W;
    g.save();
    g.setLineDash([12, 10]);
    g.beginPath();
    g.moveTo(x, y - H * 0.16);
    g.lineTo(x, y + H * 0.12);
    g.lineWidth = 6;
    g.strokeStyle = PCOL[who];
    g.stroke();
    g.restore();
    tag(g, x, y - H * 0.19, nameOf(who), PCOL[who], 15);
  }
  // Halat: sallanan, çizgili
  const fx0 = W / 2 + m.r * WIN_X * W;
  const amp = 4 + clamp((m.pw[0] + m.pw[1]) / 20, 0, 1) * 10;
  const pts = [];
  for (let k = 0; k <= 40; k++) {
    const x = (k / 40) * W;
    pts.push([x, y + Math.sin(k * 0.9 + t / 70) * amp * Math.sin((k / 40) * Math.PI)]);
  }
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach(([x, yy], k) => (k ? g.lineTo(x, yy) : g.moveTo(x, yy)));
  g.lineWidth = 20;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.lineWidth = 13;
  g.strokeStyle = '#d9a35f';
  g.stroke();
  g.save();
  g.setLineDash([6, 10]);
  g.lineDashOffset = -m.r * 300;
  g.lineWidth = 13;
  g.strokeStyle = '#a8742f';
  g.stroke();
  g.restore();
  // Kalpli bayrak
  const fy = y + Math.sin(t / 70) * amp * 0.6;
  g.beginPath();
  g.moveTo(fx0, fy);
  g.lineTo(fx0, fy - H * 0.13);
  g.lineWidth = 5;
  g.strokeStyle = '#2a1636';
  g.stroke();
  const wave = Math.sin(t / 120) * 6;
  heartPath(g, fx0 + 26, fy - H * 0.1 + wave * 0.3, H * 0.035);
  inked(g, '#ff5fa2', 3.5);
  // Güç çubukları
  for (const [side, who] of [[-1, L], [1, R]]) {
    const bw = W * 0.22;
    const bx = W / 2 + side * W * 0.25 - bw / 2;
    const by = H * 0.94;
    const v = clamp(m.pw[who] / 12, 0, 1);
    roundRect(g, bx, by, bw, 14, 7);
    g.fillStyle = '#fffcf6';
    g.fill();
    if (v > 0.02) {
      roundRect(g, bx, by, bw * v, 14, 7);
      g.fillStyle = PCOL[who];
      g.fill();
    }
    roundRect(g, bx, by, bw, 14, 7);
    g.lineWidth = 3;
    g.strokeStyle = '#2a1636';
    g.stroke();
    // Ter damlaları
    const p = players[who];
    if (m.running && p && v > 0.55 && Math.random() < dt * 6) {
      const n = p.lm[0];
      fx.burst(n.x * W + rand(-30, 30), n.y * H - 30, { n: 1, colors: ['#9fdcff'], power: 120, gravity: 600, size: [5, 7] });
    }
  }
  fx.draw(g, dt);
}

function end(ctx, need) {
  const { m, life, cam } = ctx;
  if (!m.running || m.over) return;
  m.running = false;
  if (m.clock) m.clock.stop();
  cam.onFrame = null;
  const L = cam.leftIs;
  const R = 1 - L;
  const winner = Math.abs(m.r) < 0.05 ? -1 : m.r > 0 ? R : L;
  m.round++;
  sfx.whistle();
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">${winner === -1 ? 'Berabere!' : html`<span class="t-p${winner + 1}">${nameOf(winner)}</span> Çekti Aldı!`}</h2><p class="hud-tip">${winner === -1 ? 'Halat tam ortada kaldı.' : 'Halat onun tarafında.'}</p></div></div>`);
  if (winner >= 0) {
    const card = scene.querySelector('.hud-card');
    ctx.score(winner, 1, card);
    announcer.cheer();
    ctx.shoot(winner, 'Halatı Kaptı!', { pad: 0.1, force: true });
    const r = card.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 12, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }
  life.timeout(() => {
    if (m.over) return;
    if (ctx.pts[0] >= need || ctx.pts[1] >= need || m.round >= Number(ctx.cfg.bestOf)) {
      ctx.finish({ stats: m.peak.map((v) => html`<span>En güçlü an <b>${Math.round(v * 10)}</b> güç</span>`) });
    } else {
      round(ctx);
    }
  }, 2600);
}
