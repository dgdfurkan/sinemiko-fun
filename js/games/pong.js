// Kafa Tenisi: herkesin kendi tarafında bir raketi var, raketi başını yukarı aşağı oynatarak yönetirsin.
// Top rakete çarptığı anda ağzın açıksa smaç: top ateş gibi hızlanır

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, jawOf, noseOf, inked, PCOL, tag, roundRect, hideTop, missingText } from './arena.js';

// Başın küçük bir yukarı aşağı hareketi raketi baştan sona götürür
const GAIN = 4.4;
const PAD_H = 0.25;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-pong',
    kind: 'face',
    cfg: { to: '5' },
    rules: [
      'Soldaki oyuncu sol raketi, sağdaki sağ raketi yönetir. Raket başınla birlikte yukarı aşağı gider.',
      'Topu kaçırırsan sayı rakibe yazılır. Top her vuruşta biraz daha hızlanır.',
      'Top rakete çarparken ağzını kocaman açarsan smaç! Top ateş gibi gider.',
    ],
    options: (cfg) => optHTML('Kaç Sayıda Biter', segHTML('to', [['3', '3 Sayı'], ['5', '5 Sayı'], ['7', '7 Sayı']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Raketler Hazır',
    waitTip: 'Yan yana oturun. Başınızı biraz oynatınca raket de oynar.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-servis', 'point', 'smash'],
    tie: 'Berabere!',
    albumTitle: 'Kafa Tenisi',
    mid: (cfg) => `${cfg.to} sayıda biter`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.to = Number(cfg.to);
  m.pad = [0.5, 0.5];
  m.base = [0.45, 0.45];
  m.ball = null;
  m.rally = 0;
  m.longest = 0;
  m.smashes = [0, 0];
  m.trail = [];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Başınla Oyna</h2><p class="hud-tip">Düz bakın, ortanızı ölçüyorum.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p) return;
      const side = i === cam.leftIs ? 0 : 1;
      m.pad[side + 2] = clamp(0.5 + (noseOf(p).y - m.base[i]) * GAIN, PAD_H / 2, 1 - PAD_H / 2);
      m.jaw = m.jaw || [0, 0];
      m.jaw[i] = jawOf(p);
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Servis!', voice: 'go-servis', measure: (p) => ({ y: noseOf(p).y }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => (b ? b.y : 0.45));
  hideTop(scene);
  serve(ctx, Math.random() < 0.5 ? 0 : 1);
}

// Top kaybedenin tarafına doğru yavaşça başlar
function serve(ctx, toSide) {
  const { m } = ctx;
  m.rally = 0;
  m.ball = null;
  m.trail = [];
  ctx.life.timeout(() => {
    if (m.over) return;
    const ang = rand(-0.45, 0.45);
    const sp = 0.42;
    m.ball = { x: 0.5, y: 0.5, vx: (toSide === 0 ? -1 : 1) * Math.cos(ang) * sp, vy: Math.sin(ang) * sp, fire: 0, last: -1 };
    sfx.whoosh();
  }, 900);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const AR = W / H;
  // Raketler hedefe yumuşakça gider
  for (const side of [0, 1]) {
    const target = m.pad[side + 2] ?? 0.5;
    m.pad[side] += (target - m.pad[side]) * Math.min(1, dt * 18);
  }
  // Saha: orta çizgi
  g.save();
  g.setLineDash([14, 14]);
  g.beginPath();
  g.moveTo(W / 2, 10);
  g.lineTo(W / 2, H - 10);
  g.lineWidth = 5;
  g.strokeStyle = '#ffffff99';
  g.stroke();
  g.restore();
  // Top fiziği; x birimi genişlik, y birimi yükseklik
  const b = m.ball;
  const r = 0.028;
  const px = [0.045, 0.955];
  const pw = 0.02;
  if (b) {
    const steps = Math.ceil(dt / 0.008);
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      b.x += b.vx * h;
      b.y += (b.vy * h) * AR;
      if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); sfx.soft(); }
      if (b.y > 1 - r) { b.y = 1 - r; b.vy = -Math.abs(b.vy); sfx.soft(); }
      for (const side of [0, 1]) {
        const dir = side === 0 ? -1 : 1;
        const facing = side === 0 ? b.vx < 0 : b.vx > 0;
        const edge = px[side] - dir * pw / 2;
        const reached = side === 0 ? b.x - r / AR <= edge : b.x + r / AR >= edge;
        if (facing && reached && b.x * dir < px[side] * dir + 0.01) {
          const off = (b.y - m.pad[side]) / (PAD_H / 2 + r);
          if (Math.abs(off) <= 1) hit(ctx, side, off);
        }
      }
      if (b.x < -0.04 || b.x > 1.04) {
        point(ctx, b.x < 0 ? 1 : 0);
        break;
      }
    }
  }
  // Raketler
  for (const side of [0, 1]) {
    const who = side === 0 ? cam.leftIs : 1 - cam.leftIs;
    const x = px[side] * W;
    const y = m.pad[side] * H;
    const hh = PAD_H * H;
    roundRect(g, x - pw * W / 2, y - hh / 2, pw * W, hh, pw * W / 2);
    inked(g, PCOL[who], 4);
    const open = m.jaw && m.jaw[who] > 0.3;
    if (open) {
      g.globalAlpha = 0.35 + 0.2 * Math.sin(t / 60);
      roundRect(g, x - pw * W, y - hh / 2 - 8, pw * W * 2, hh + 16, pw * W);
      g.fillStyle = '#ff8a3d';
      g.fill();
      g.globalAlpha = 1;
    }
    tag(g, x + (side === 0 ? 46 : -46), y, nameOf(who), PCOL[who], 15);
  }
  // Top ve izi
  if (b) {
    m.trail.push({ x: b.x * W, y: b.y * H });
    if (m.trail.length > 14) m.trail.shift();
    m.trail.forEach((q, k) => {
      const a = k / m.trail.length;
      g.globalAlpha = a * 0.5;
      g.beginPath();
      g.arc(q.x, q.y, r * H * (0.4 + a * 0.6), 0, Math.PI * 2);
      g.fillStyle = b.fire ? '#ff8a3d' : '#fff';
      g.fill();
    });
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(b.x * W, b.y * H, r * H, 0, Math.PI * 2);
    inked(g, b.fire ? '#ffcd3c' : '#d4f24a', 4);
    g.beginPath();
    g.arc(b.x * W, b.y * H, r * H * 0.62, 0.4, 2.6);
    g.lineWidth = 3;
    g.strokeStyle = '#ffffffcc';
    g.stroke();
    if (b.fire) fx.burst(b.x * W, b.y * H, { n: 1, colors: ['#ff8a3d', '#ffcd3c'], power: 60, gravity: -200, size: [4, 8] });
  }
  if (m.rally >= 3) tag(g, W / 2, 36, `${m.rally} vuruş`, '#2a1636', 16);
  fx.draw(g, dt);
}

function hit(ctx, side, off) {
  const { m, cam, fx } = ctx;
  const b = m.ball;
  const who = side === 0 ? cam.leftIs : 1 - cam.leftIs;
  if (b.last === side) return;
  b.last = side;
  m.rally++;
  m.longest = Math.max(m.longest, m.rally);
  const speed = Math.min(1.15, Math.hypot(b.vx, b.vy) * 1.07);
  const smash = m.jaw && m.jaw[who] > 0.3;
  const ang = off * 0.95;
  const sp = smash ? Math.min(1.5, speed * 1.4) : speed;
  b.vx = (side === 0 ? 1 : -1) * Math.cos(ang) * sp;
  b.vy = Math.sin(ang) * sp;
  b.fire = smash ? 1 : 0;
  const x = (side === 0 ? 0.06 : 0.94) * cam.W;
  const y = b.y * cam.H;
  fx.ring(x, y, PCOL[who], 26);
  if (smash) {
    m.smashes[who]++;
    sfx.boom();
    announcer.react('smash');
    ctx.shake(6);
    fx.text(x + (side === 0 ? 60 : -60), y - 30, 'Smaç!', '#ff8a3d', 24);
    fx.burst(x, y, { n: 18, colors: ['#ff8a3d', '#ffcd3c', '#fff'], power: 360 });
    ctx.shoot(who, 'Smaç!', { pad: 0.5 });
  } else {
    sfx.pop(1.3);
    fx.burst(x, y, { n: 8, colors: [PCOL[who], '#fff'], power: 220 });
  }
}

function point(ctx, side) {
  const { m, cam, fx } = ctx;
  const who = side === 0 ? cam.leftIs : 1 - cam.leftIs;
  const loserSide = 1 - side;
  m.ball = null;
  sfx.success();
  announcer.react('point');
  const x = (side === 0 ? 0.25 : 0.75) * cam.W;
  fx.text(x, cam.H * 0.4, 'Sayı!', PCOL[who], 30);
  fx.burst(x, cam.H * 0.4, { n: 26, colors: [PCOL[who], '#ffcd3c', '#fff'], power: 380, shape: 'star' });
  ctx.score(who, 1, side === 0 ? 0.25 : 0.75, 0.4);
  if (ctx.pts[who] >= m.to) {
    scoreboard.setMid('Maç Bitti');
    ctx.life.timeout(() => ctx.finish({
      sub: `En uzun ralli ${m.longest} vuruş.`,
      stats: m.smashes.map((n) => html`<span><b>${n}</b> smaç</span>`),
    }), 1500);
    return;
  }
  serve(ctx, loserSide);
}
