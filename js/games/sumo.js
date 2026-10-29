// Sumo Bloblar: yuvarlak minderde iki tombul blob. Yön tuşlarıyla it, Shift ile atıl.
// Rakibi minderden düşüren turu alır. Minder zamanla küçülür; ilk N turu alan kazanır

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL, tag } from './keyarena.js';

const ACC = 1.5;
const FRICTION = 1.6;
const R = 0.075;
const DASH = 1.25;

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-sumo',
    cfg: { to: '3' },
    rules: [
      'Yuvarlak minderde iki tombul blob. Yön tuşlarıyla hareket edip rakibini it.',
      'Shift ile ileri atılırsın: güçlü bir itiş ama sonra kısa süre yorulursun.',
      'Minderden düşen turu kaybeder. Minder zamanla küçülür. İlk hedefe ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Tur Alan Kazanır', segHTML('to', [['2', '2'], ['3', '3'], ['5', '5']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-it', 'point'],
    tie: 'Berabere!',
    mid: (cfg) => `${cfg.to} turda biter`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.to = Number(cfg.to);
  m.round = 0;
  m.pushes = [0, 0];
  ctx.loop((dt) => draw(ctx, dt));
  await round(ctx, true);
}

async function round(ctx, first = false) {
  const { m } = ctx;
  if (m.over) return;
  m.round++;
  m.running = false;
  m.ring = 0.42;
  m.t = 0;
  m.b = [0, 1].map((side) => ({ i: ctx.playerAt(side), x: side === 0 ? -0.2 : 0.2, y: 0, vx: 0, vy: 0, cool: 0, dash: 0, out: false, face: side === 0 ? 1 : -1 }));
  scoreboard.setMid(`Tur ${m.round}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${first ? controlsHTML(ctx) : html`<div class="hud-card"><h2 class="t-big">Tur ${m.round}</h2></div>`}</div>
    <div class="hud-bottom"></div>`);
  await ctx.countdown(scene, { final: 'İt!', voice: first ? 'go-it' : null });
  if (!ctx.life.alive || m.over) return;
  const top = scene.querySelector('.hud-top');
  if (top) top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  m.running = true;
}

function draw(ctx, dt) {
  const { m, g, W, H, fx } = ctx;
  if (!m.b) return;
  const S = H * 0.95;
  const cx = W / 2;
  const cy = H / 2;
  if (m.running && dt > 0) {
    m.t += dt;
    if (m.t > 12) m.ring = Math.max(0.24, m.ring - dt * 0.008);
    for (const b of m.b) {
      const inp = ctx.input(b.i);
      b.cool = Math.max(0, b.cool - dt);
      b.dash = Math.max(0, b.dash - dt);
      const tired = b.cool > 0.6 ? 0.45 : 1;
      b.vx += inp.x * ACC * tired * dt;
      b.vy += inp.y * ACC * tired * dt;
      if (inp.x) b.face = Math.sign(inp.x);
      if (ctx.hit(b.i, 'act') && b.cool <= 0) {
        const o = m.b.find((q) => q !== b);
        let dx = inp.x;
        let dy = inp.y;
        if (!dx && !dy) {
          dx = o.x - b.x;
          dy = o.y - b.y;
        }
        const n = Math.hypot(dx, dy) || 1;
        b.vx += (dx / n) * DASH;
        b.vy += (dy / n) * DASH;
        b.cool = 1.2;
        b.dash = 0.25;
        sfx.whoosh();
        fx.text(cx + b.x * S, cy + b.y * S - R * S * 1.6, 'Hıyaa!', PCOL[b.i], 18);
      }
      const f = Math.max(0, 1 - FRICTION * dt);
      b.vx *= f;
      b.vy *= f;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // Çarpışma: kütleler eşit, hızlar normal boyunca değişir
    const [a, b] = m.b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < R * 2 && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      const over = R * 2 - d;
      a.x -= (nx * over) / 2;
      a.y -= (ny * over) / 2;
      b.x += (nx * over) / 2;
      b.y += (ny * over) / 2;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const k = rel * 1.35;
        a.vx -= k * nx;
        a.vy -= k * ny;
        b.vx += k * nx;
        b.vy += k * ny;
        if (rel > 0.25) {
          sfx.thud(Math.min(1.4, rel));
          if (a.dash > 0) m.pushes[a.i]++;
          if (b.dash > 0) m.pushes[b.i]++;
          fx.burst(cx + (a.x + nx * R) * S, cy + (a.y + ny * R) * S, { n: 10, colors: ['#fff', '#ffcd3c'], power: 240 });
        }
      }
    }
    for (const q of m.b) {
      if (Math.hypot(q.x, q.y) > m.ring + R * 0.35) q.out = true;
    }
    if (m.b.some((q) => q.out)) endRound(ctx);
  }
  // Minder
  g.beginPath();
  g.arc(cx, cy, (m.ring + R * 0.6) * S, 0, Math.PI * 2);
  g.fillStyle = '#e8c58f';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, m.ring * S, 0, Math.PI * 2);
  g.fillStyle = '#f6dfb3';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, m.ring * S - 10, 0, Math.PI * 2);
  g.lineWidth = 4;
  g.strokeStyle = '#ffffffaa';
  g.stroke();
  g.fillStyle = '#2a163655';
  g.fillRect(cx - 0.1 * S, cy - 3, 0.04 * S, 6);
  g.fillRect(cx + 0.06 * S, cy - 3, 0.04 * S, 6);
  for (const b of m.b) {
    const x = cx + b.x * S;
    const y = cy + b.y * S;
    const r = R * S * (b.out ? 0.8 : 1);
    const squash = 1 + Math.min(0.15, Math.hypot(b.vx, b.vy) * 0.1);
    g.save();
    g.translate(x, y);
    g.globalAlpha = b.out ? 0.6 : 1;
    g.beginPath();
    g.ellipse(0, r * 0.15, r * squash, r / squash, 0, 0, Math.PI * 2);
    g.fillStyle = PCOL[b.i];
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#2a1636';
    g.stroke();
    // Kuşak
    g.fillStyle = b.i ? '#ffcd3c' : '#ff5fa2';
    g.fillRect(-r * squash, r * 0.35, r * 2 * squash, r * 0.22);
    const e = b.face * r * 0.15;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(e + s * r * 0.3, -r * 0.1, r * 0.13, 0, Math.PI * 2);
      g.fillStyle = '#2a1636';
      g.fill();
      g.beginPath();
      g.moveTo(e + s * r * 0.48, -r * 0.42);
      g.lineTo(e + s * r * 0.14, -r * 0.3);
      g.lineWidth = 3.5;
      g.stroke();
    }
    if (b.cool > 0) {
      g.beginPath();
      g.arc(0, 0, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.cool / 1.2));
      g.lineWidth = 4;
      g.strokeStyle = '#ffffffcc';
      g.stroke();
    }
    g.restore();
    tag(g, x, y - r - 22, nameOf(b.i), PCOL[b.i], 14);
  }
  fx.draw(g, dt);
}

function endRound(ctx) {
  const { m, fx, W, H } = ctx;
  m.running = false;
  const out = m.b.filter((q) => q.out);
  sfx.boom();
  ctx.shake(10);
  if (out.length === 2) {
    fx.text(W / 2, H * 0.3, 'İkiniz de düştünüz!', '#a99cb3', 30);
    ctx.life.timeout(() => round(ctx), 1800);
    return;
  }
  const w = m.b.find((q) => !q.out).i;
  announcer.react('point');
  ctx.score(w, 1, W / 2, H * 0.3);
  fx.text(W / 2, H * 0.3, `${nameOf(w)} itti!`, PCOL[w], 34);
  if (ctx.pts[w] >= m.to) {
    sfx.whistle();
    ctx.life.timeout(() => ctx.finish({ stats: [0, 1].map((i) => html`<span><b>${ctx.pts[i]}</b> tur</span><span><b>${m.pushes[i]}</b> atılış isabeti</span>`) }), 1500);
    return;
  }
  ctx.life.timeout(() => round(ctx), 1800);
}
