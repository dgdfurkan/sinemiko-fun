// Burunla Çiz: ikinizin önünde aynı şekil belirir. Burnunla noktaları sırayla topla, şekli ilk bitiren turu alır

import { html, pick, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { icon } from '../ui/icons.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { optHTML, pSpan } from './common.js';
import { camDuel, noseOf, inked, PCOL, tag, roundRect, hideTop, missingText } from './arena.js';

const ROUND_SEC = 40;
const DOTS = 46;
// Burnun küçük bir hareketi alanın tamamını gezer
const GAIN_X = 6.4;
const GAIN_Y = 7;

/* ---------- Şekiller: 0-1 karesinde nokta listeleri ---------- */

const range = (n, f) => Array.from({ length: n }, (_, k) => f(k / (n - 1)));
const poly = (pts) => pts;
const SHAPES = {
  zigzag: { name: 'Şimşek', tier: 0, pts: poly([[0.18, 0.12], [0.62, 0.12], [0.38, 0.46], [0.74, 0.46], [0.26, 0.9]]) },
  wave: { name: 'Dalga', tier: 0, pts: range(40, (t) => [0.08 + t * 0.84, 0.5 + Math.sin(t * Math.PI * 3) * 0.26]) },
  heart: {
    name: 'Kalp',
    tier: 1,
    pts: range(60, (t) => {
      const a = Math.PI + t * Math.PI * 2;
      const x = 16 * Math.sin(a) ** 3;
      const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      return [0.5 + x / 38, 0.46 - y / 38];
    }),
  },
  house: { name: 'Ev', tier: 1, pts: poly([[0.2, 0.9], [0.2, 0.46], [0.5, 0.14], [0.8, 0.46], [0.8, 0.9], [0.2, 0.9]]) },
  star: {
    name: 'Yıldız',
    tier: 2,
    pts: range(11, (t) => {
      const k = Math.round(t * 10);
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 0.17 : 0.42;
      return [0.5 + Math.cos(a) * r, 0.53 + Math.sin(a) * r];
    }),
  },
  infinity: {
    name: 'Sonsuzluk',
    tier: 2,
    pts: range(70, (t) => {
      const a = t * Math.PI * 2;
      const d = 1 + Math.sin(a) ** 2;
      return [0.5 + (0.42 * Math.cos(a)) / d, 0.5 + (0.42 * Math.sin(a) * Math.cos(a)) / d];
    }),
  },
  spiral: { name: 'Salyangoz', tier: 3, pts: range(70, (t) => [0.5 + Math.cos(t * Math.PI * 5) * (0.04 + t * 0.38), 0.5 + Math.sin(t * Math.PI * 5) * (0.04 + t * 0.38)]) },
  ess: {
    name: 'S Harfi',
    tier: 3,
    pts: [...range(30, (t) => [0.5 + Math.cos(-0.25 * Math.PI - t * 1.25 * Math.PI) * 0.26, 0.3 + Math.sin(-0.25 * Math.PI - t * 1.25 * Math.PI) * -0.2]), ...range(30, (t) => [0.5 + Math.cos(-0.5 * Math.PI + t * 1.25 * Math.PI) * 0.26, 0.7 + Math.sin(-0.5 * Math.PI + t * 1.25 * Math.PI) * 0.2]).slice(1)],
  },
};

// Çizgiyi eşit aralıklı noktalara böler
function resample(pts, n) {
  const seg = [];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    seg.push(l);
    total += l;
  }
  const out = [];
  for (let j = 0; j < n; j++) {
    let d = (total * j) / (n - 1);
    let k = 0;
    while (k < seg.length - 1 && d > seg[k]) {
      d -= seg[k];
      k++;
    }
    const f = seg[k] ? clamp(d / seg[k], 0, 1) : 0;
    out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  }
  return out;
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-nose',
    kind: 'face',
    cfg: { rounds: '3' },
    rules: [
      'İkinizin önünde aynı şekil belirir. Burnun bir kalem gibi: başını oynattıkça imleç de oynar.',
      'Noktaları baştan sona sırayla topla. Ufak hareketler yeter, başını çok çevirme.',
      'Şekli ilk bitiren turu alır. Süre biterse daha çok ilerleyen kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Şekil', segHTML('rounds', [['3', '3 Şekil'], ['5', '5 Şekil']], cfg.rounds), 'Şekiller giderek zorlaşır.'),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="rounds"]'), { value: cfg.rounds, onChange: (v) => { cfg.rounds = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Burunlar Hazır',
    waitTip: 'Yan yana oturun, kameraya düz bakın.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-ciz', 'yay-1', 'yay-2'],
    tie: 'Berabere! Burunlar Eşit Usta',
    albumTitle: 'Burunla Çiz',
    mid: () => 'Şekil 1',
    play: (ctx) => {
      ctx.m.round = 0;
      ctx.m.used = new Set();
      ctx.m.times = [[], []];
      round(ctx);
    },
  });
}

function nextShape(m, total) {
  const tier = Math.min(3, Math.floor((m.round / Math.max(1, total - 1)) * 3.2));
  const pool = Object.keys(SHAPES).filter((k) => SHAPES[k].tier === tier && !m.used.has(k));
  const id = pick(pool.length ? pool : Object.keys(SHAPES).filter((k) => !m.used.has(k)));
  m.used.add(id);
  return id;
}

async function round(ctx) {
  const { cam, cfg, m, fx } = ctx;
  const total = Number(cfg.rounds);
  const id = nextShape(m, total);
  const shape = SHAPES[id];
  m.shape = { id, name: shape.name, dots: resample(shape.pts, DOTS) };
  m.prog = [0, 0];
  m.cur = [null, null];
  m.base = [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }];
  m.done = [0, 0];
  m.running = false;
  m.trails = [[], []];
  m.areaOf = (i) => areaOf(ctx, i);
  fx.clear();
  scoreboard.setMid(`Şekil ${m.round + 1}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">${shape.name}</h2><p class="hud-tip">Düz bakın, burnunuzu ölçüyorum.</p></div></div>
    <div class="hud-bottom"><div class="pop-clock" data-clock hidden>${ROUND_SEC}</div><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p) return;
      const n = noseOf(p);
      const area = areaOf(ctx, i);
      const x = area.cx + (n.x - m.base[i].x) * GAIN_X * area.s;
      const y = area.cy + (n.y - m.base[i].y) * GAIN_Y * area.sy;
      m.cur[i] = { x: clamp(x, area.x0 - 0.02, area.x0 + area.s + 0.02), y: clamp(y, area.y0 - 0.04, area.y0 + area.sy + 0.04) };
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  const base = await ctx.countdown(scene, { final: 'Çiz!', voice: 'go-ciz', measure: (p) => { const n = noseOf(p); return { x: n.x, y: n.y }; } });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => b || m.base[i]);
  hideTop(scene);
  clockEl.hidden = false;
  m.running = true;
  m.t0 = performance.now();
  m.timer = ctx.clock(clockEl, ROUND_SEC, { onEnd: () => endRound(ctx) });
}

// Oyuncunun çizim alanı (normalize, kare): kendi yarısının ortasında
function areaOf(ctx, i) {
  const { cam } = ctx;
  const [x0, x1] = ctx.half(i);
  const sH = 0.62;
  const s = Math.min((x1 - x0) * 0.82, (sH * cam.H) / cam.W);
  const cx = (x0 + x1) / 2;
  const cy = 0.52;
  // Kare alan; x genişlik, y yükseklik biriminde
  return { cx, cy, s, x0: cx - s / 2, y0: cy - (s * cam.W) / cam.H / 2, sy: (s * cam.W) / cam.H };
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over || !m.shape) return;
  const W = cam.W;
  const H = cam.H;
  for (const i of [0, 1]) {
    const a = areaOf(ctx, i);
    const P = ([u, v]) => [(a.x0 + u * a.s) * W, (a.y0 + v * a.sy) * H];
    // Alanın arka planı
    roundRect(g, a.x0 * W - 14, a.y0 * H - 14, a.s * W + 28, a.sy * H + 28, 24);
    g.fillStyle = '#fffcf666';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = PCOL[i];
    g.stroke();
    const dots = m.shape.dots;
    const k = m.prog[i];
    // Toplanan kısım kalın renkli çizgi
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (k > 1) {
      g.beginPath();
      dots.slice(0, k).forEach((d, j) => { const [x, y] = P(d); if (j) g.lineTo(x, y); else g.moveTo(x, y); });
      g.lineWidth = 12;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.lineWidth = 7;
      g.strokeStyle = PCOL[i];
      g.stroke();
    }
    // Kalan noktalar
    for (let j = k; j < dots.length; j++) {
      const [x, y] = P(dots[j]);
      const next = j === k;
      g.beginPath();
      g.arc(x, y, next ? 9 + Math.sin(t / 120) * 2 : 4.5, 0, Math.PI * 2);
      if (next) inked(g, '#ffcd3c', 3);
      else {
        g.fillStyle = '#2a163699';
        g.fill();
      }
    }
    if (k === 0) {
      const [x, y] = P(dots[0]);
      tag(g, x, y - 28, 'Başla', PCOL[i], 13);
    }
    // İmleç: burun
    const c = m.cur[i];
    if (c) {
      const x = c.x * W;
      const y = c.y * H;
      m.trails[i].push({ x, y, t });
      while (m.trails[i].length && t - m.trails[i][0].t > 300) m.trails[i].shift();
      m.trails[i].forEach((q) => {
        const l = 1 - (t - q.t) / 300;
        g.globalAlpha = l * 0.4;
        g.beginPath();
        g.arc(q.x, q.y, 4 + l * 6, 0, Math.PI * 2);
        g.fillStyle = PCOL[i];
        g.fill();
      });
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(x, y, 13, 0, Math.PI * 2);
      inked(g, PCOL[i], 4);
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      if (m.running && !m.done[i]) advance(ctx, i, a, P, x, y);
    }
    const pct = Math.round((m.prog[i] / dots.length) * 100);
    tag(g, a.cx * W, a.y0 * H + a.sy * H + 34, m.done[i] ? 'Bitti!' : `${nameOf(i)} %${pct}`, PCOL[i], 16);
  }
  fx.draw(g, dt);
}

// İmleç sıradaki noktaya (ya da birkaç ilerisine) değerse ilerler
function advance(ctx, i, a, P, x, y) {
  const { m, fx } = ctx;
  const dots = m.shape.dots;
  const tol = a.s * ctx.cam.W * 0.085;
  let got = -1;
  for (let j = m.prog[i]; j < Math.min(dots.length, m.prog[i] + 4); j++) {
    const [dx, dy] = P(dots[j]);
    if (Math.hypot(dx - x, dy - y) < tol) got = j;
  }
  if (got < 0) return;
  m.prog[i] = got + 1;
  if (m.prog[i] % 6 === 0) sfx.pop(0.9 + (m.prog[i] / dots.length) * 0.8);
  if (m.prog[i] >= dots.length) {
    m.done[i] = performance.now();
    m.times[i].push((m.done[i] - m.t0) / 1000);
    sfx.success();
    fx.burst(x, y, { n: 30, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 420, shape: 'star' });
    fx.text(x, y - 40, 'Bitti!', PCOL[i], 26);
    ctx.shoot(i, `${m.shape.name} Ustası`, { pad: 0.5 });
    if (m.done[0] && m.done[1]) endRound(ctx);
    else if (!m.finishT) {
      announcer.cheer();
      // İlk bitiren kazanır; öbürüne tamamlaması için kısa bir süre tanınır, sonra tur kapanır
      m.finishT = ctx.life.timeout(() => endRound(ctx), 1800);
    }
  }
}

function endRound(ctx) {
  const { m, stage, cam } = ctx;
  if (!m.running || m.over) return;
  m.running = false;
  if (m.timer) m.timer.stop();
  if (m.finishT) clearTimeout(m.finishT);
  m.finishT = 0;
  cam.onFrame = null;
  const dots = m.shape.dots.length;
  let winner = -1;
  if (m.done[0] || m.done[1]) winner = m.done[0] && (!m.done[1] || m.done[0] < m.done[1]) ? 0 : 1;
  else if (m.prog[0] !== m.prog[1]) winner = m.prog[0] > m.prog[1] ? 0 : 1;
  m.round++;
  const total = Number(ctx.cfg.rounds);
  const line = (i) => (m.done[i] ? `${((m.done[i] - m.t0) / 1000).toFixed(1).replace('.', ',')} sn` : `%${Math.round((m.prog[i] / dots) * 100)}`);
  const scene = stage.show(html`
    <h2 class="t-title" data-in>${winner === -1 ? 'Berabere!' : html`${pSpan(winner)} ${m.shape.name} Turunu Aldı!`}</h2>
    <div class="pop-stats" data-in>${[0, 1].map((i) => html`
      <div class="pop-stat p${i}"><span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span><span><b>${line(i)}</b></span></div>`)}</div>
    <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${m.round >= total ? 'Sonuçları Gör' : 'Sonraki Şekil'}${icon('arrow')}</button>`, {
    next: () => {
      if (m.round >= total) {
        const best = (i) => (m.times[i].length ? `${Math.min(...m.times[i]).toFixed(1).replace('.', ',')} sn` : 'yok');
        ctx.finish({ stats: [0, 1].map((i) => html`<span><b>${m.times[i].length}</b> şekil bitirdi</span><span>En hızlı <b>${best(i)}</b></span>`) });
      } else {
        round(ctx);
      }
    },
  });
  if (winner >= 0) {
    const t = scene.querySelector('.t-title');
    ctx.score(winner, 1, t);
    const r = t.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 12, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }
}
