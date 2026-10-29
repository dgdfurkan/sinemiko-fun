// Bulut Zıplama: iki blob bulutlardan bulutlara kendiliğinden zıplıyor. Sağ sol tuşlarıyla yön ver,
// tepedeki bayrağa ilk varan kazanır. Yaylı bulut uçurur, çatlak bulut bir kez taşır; düşersen biraz geri gidersin

import { html, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL, tag, roundRect } from './keyarena.js';

const V0 = 2.7;
const GRAV = 4.4;
const VIEW = 1.7;

// Aynı tohumla iki şeride aynı bulutlar
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeClouds(goal) {
  const r = rng(Math.floor(Math.random() * 1e9));
  const out = [{ y: 0, x: 0.5, w: 1.2, kind: 'ground' }];
  let y = 0;
  while (y < goal + 1) {
    y += 0.3 + r() * 0.28 + Math.min(0.12, y * 0.003);
    const k = r();
    const kind = y < 2 ? 'normal' : k < 0.1 ? 'spring' : k < 0.22 ? 'break' : k < 0.36 ? 'move' : 'normal';
    out.push({ y, x: 0.15 + r() * 0.7, w: 0.26 - Math.min(0.08, y * 0.002), kind, ph: r() * 6 });
  }
  return out;
}

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-tower',
    cfg: { goal: '40' },
    rules: [
      'Bloblar kendiliğinden zıplar. Sola ve sağa giderek bir sonraki buluta kon.',
      'Yaylı bulut seni uçurur, çatlak bulut bir kez taşır, kayan bulut hareket eder.',
      'Düşersen biraz aşağıdan devam edersin. Tepedeki bayrağa ilk varan kazanır.',
    ],
    options: (cfg) => optHTML('Bayrak Yüksekliği', segHTML('goal', [['25', '25 m'], ['40', '40 m'], ['60', '60 m']], cfg.goal)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="goal"]'), { value: cfg.goal, onChange: (v) => { cfg.goal = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-zipla', 'crash'],
    tie: 'Berabere! Aynı Anda Vardınız',
    mid: (cfg) => `${cfg.goal} m`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.goal = Number(cfg.goal);
  m.clouds = makeClouds(m.goal);
  m.p = [0, 1].map((side) => ({ i: ctx.playerAt(side), side, x: 0.5, y: 0.02, vy: V0, cam: 0, best: 0, falls: 0, broken: new Set(), stun: 0, done: 0, face: 1 }));
  m.running = false;
  m.t = 0;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${controlsHTML(ctx, { act: false })}</div>
    <div class="hud-bottom"></div>`);
  ctx.loop((dt, t) => draw(ctx, dt, t));
  await ctx.countdown(scene, { final: 'Zıpla!', voice: 'go-zipla' });
  if (!ctx.life.alive || m.over) return;
  const top = scene.querySelector('.hud-top');
  if (top) top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  m.running = true;
}

const cloudX = (c, t) => (c.kind === 'move' ? 0.5 + Math.sin(t * 0.9 + c.ph) * 0.3 : c.x);

function update(ctx, p, dt) {
  const { m } = ctx;
  const inp = ctx.input(p.i);
  p.stun = Math.max(0, p.stun - dt);
  if (p.stun > 0) return;
  p.x += inp.x * 1.25 * dt;
  if (inp.x) p.face = Math.sign(inp.x);
  // Kenardan çıkınca öbür kenardan girer
  if (p.x < -0.05) p.x += 1.1;
  if (p.x > 1.05) p.x -= 1.1;
  const prevY = p.y;
  p.vy -= GRAV * dt;
  p.y += p.vy * dt;
  if (p.vy < 0) {
    for (let k = 0; k < m.clouds.length; k++) {
      const c = m.clouds[k];
      if (p.broken.has(k)) continue;
      if (prevY >= c.y && p.y <= c.y && Math.abs(p.x - cloudX(c, m.t)) < c.w / 2 + 0.03) {
        p.y = c.y;
        p.vy = c.kind === 'spring' ? V0 * 1.6 : V0;
        if (c.kind === 'spring') sfx.rise(0.4);
        else sfx.pop(0.7);
        if (c.kind === 'break') {
          p.broken.add(k);
          sfx.thud(0.5);
        }
        break;
      }
    }
  }
  p.best = Math.max(p.best, p.y);
  p.cam = Math.max(p.cam, p.y - VIEW * 0.4);
  if (p.y < p.cam - 0.15) {
    // Düştü: biraz aşağıdaki bir buluttan devam
    p.falls++;
    p.cam = Math.max(0, p.cam - 1.1);
    const c = m.clouds.filter((q, k) => q.y <= p.cam + 0.4 && !p.broken.has(k)).pop() || m.clouds[0];
    p.y = c.y + 0.02;
    p.x = cloudX(c, m.t);
    p.vy = V0;
    p.stun = 0.6;
    sfx.boing();
    announcer.react('crash');
  }
  if (p.y >= m.goal && !p.done) {
    p.done = m.t;
    finish(ctx, p);
  }
}

function draw(ctx, dt, t) {
  const { m, g, W, H, fx } = ctx;
  if (!m.p) return;
  if (m.running && dt > 0) {
    m.t += dt;
    for (const p of m.p) update(ctx, p, dt);
    for (const p of m.p) scoreboard.setText(p.i, `${Math.floor(p.best)} m`);
  }
  const cw = W / 2;
  for (const p of m.p) {
    const x0 = p.side * cw;
    const yOf = (y) => H - ((y - p.cam) / VIEW) * H;
    g.save();
    g.beginPath();
    g.rect(x0, 0, cw, H);
    g.clip();
    g.fillStyle = p.side ? '#ffe3ef' : '#e3f3ff';
    g.fillRect(x0, 0, cw, H);
    // Yükseklik çizgileri
    g.fillStyle = '#2a163622';
    g.font = '400 14px "Lilita One", sans-serif';
    for (let y = Math.ceil(p.cam / 5) * 5; y < p.cam + VIEW; y += 5) {
      g.fillRect(x0, yOf(y), cw, 2);
      g.fillText(`${y} m`, x0 + 10, yOf(y) - 6);
    }
    // Bayrak
    const fy = yOf(m.goal);
    if (fy > -40 && fy < H + 40) {
      g.fillStyle = '#2a1636';
      g.fillRect(x0 + cw / 2 - 3, fy - 70, 6, 70);
      g.beginPath();
      g.moveTo(x0 + cw / 2 + 3, fy - 70);
      g.lineTo(x0 + cw / 2 + 50, fy - 56);
      g.lineTo(x0 + cw / 2 + 3, fy - 42);
      g.fillStyle = '#ff5fa2';
      g.fill();
    }
    m.clouds.forEach((c, k) => {
      const y = yOf(c.y);
      if (y < -30 || y > H + 30 || p.broken.has(k)) return;
      const cx = x0 + cloudX(c, m.t) * cw;
      const w = c.w * cw;
      if (c.kind === 'ground') {
        g.fillStyle = '#8fe3b0';
        g.fillRect(x0, y, cw, H);
        return;
      }
      roundRect(g, cx - w / 2, y - 6, w, 20, 10);
      g.fillStyle = c.kind === 'break' ? '#e6dcd0' : '#fff';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#2a1636';
      g.stroke();
      if (c.kind === 'spring') {
        g.beginPath();
        g.moveTo(cx - 10, y - 6);
        for (let s = 0; s < 4; s++) g.lineTo(cx + (s % 2 ? 10 : -10), y - 10 - s * 5);
        g.lineWidth = 3;
        g.strokeStyle = '#ff4f62';
        g.stroke();
      }
      if (c.kind === 'break') {
        g.beginPath();
        g.moveTo(cx - 6, y - 6);
        g.lineTo(cx, y + 4);
        g.lineTo(cx - 4, y + 14);
        g.lineWidth = 2;
        g.strokeStyle = '#2a1636';
        g.stroke();
      }
    });
    // Blob
    const bx = x0 + p.x * cw;
    const by = yOf(p.y) - 16;
    const r = 16;
    const sq = clamp(1 + p.vy * 0.06, 0.8, 1.2);
    g.globalAlpha = p.stun > 0 && Math.sin(t / 50) > 0 ? 0.4 : 1;
    g.beginPath();
    g.ellipse(bx, by, r / sq, r * sq, 0, 0, Math.PI * 2);
    g.fillStyle = PCOL[p.i];
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.fillStyle = '#2a1636';
    g.beginPath();
    g.arc(bx + p.face * 5 - 5, by - 3, 2.6, 0, Math.PI * 2);
    g.arc(bx + p.face * 5 + 5, by - 3, 2.6, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.restore();
    tag(g, x0 + cw / 2, 30, `${nameOf(p.i)} · ${Math.floor(p.best)} / ${m.goal} m`, PCOL[p.i], 15);
  }
  g.fillStyle = '#2a1636';
  g.fillRect(W / 2 - 2, 0, 4, H);
  fx.draw(g, dt);
}

function finish(ctx, p) {
  const { m, fx, W, H } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.success();
  ctx.shake(6);
  fx.burst(p.side * (W / 2) + W / 4, H * 0.3, { n: 50, colors: [PCOL[p.i], '#ffcd3c', '#fff'], power: 640, shape: 'star' });
  ctx.pts = m.p.map(() => 0);
  ctx.pts[p.i] = 1;
  ctx.score(p.i, 0, W / 2, H / 2, { quiet: true });
  const labels = [0, 1].map((i) => `${Math.floor(m.p.find((x) => x.i === i).best)} m`);
  ctx.life.timeout(() => ctx.finish({
    labels,
    sub: `${nameOf(p.i)} bayrağa ${m.t.toFixed(1).replace('.', ',')} saniyede vardı.`,
    stats: [0, 1].map((i) => {
      const q = m.p.find((x) => x.i === i);
      return html`<span><b>${Math.floor(q.best)} m</b> yükseklik</span><span><b>${q.falls}</b> kez düştü</span>`;
    }),
  }), 1400);
}
