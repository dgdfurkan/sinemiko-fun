// Balon Voleybolu: ortada file var, balonu ellerinle karşıya vur. Kendi tarafında yere düşerse sayı rakibe

import { html, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, handsOf, inked, PCOL, tag, missingText, hideTop } from './arena.js';
import { drawSkeleton } from './cam.js';

const NET_TOP = 0.52;
const GRAV = 0.42;
const R = 0.075;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-volley',
    kind: 'pose',
    cfg: { to: '5' },
    rules: [
      'Ortada bir file var. Balon kendi tarafına gelince elinle vurup karşıya gönder.',
      'Balon senin tarafında yere değerse sayı rakibine yazılır. Fileye çarpan balon geri seker.',
      'Elini hızlı savurursan balon da hızlı gider. Sakin ol, balon yavaş düşer!',
    ],
    options: (cfg) => optHTML('Kaç Sayıda Biter', segHTML('to', [['3', '3 Sayı'], ['5', '5 Sayı'], ['7', '7 Sayı']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Eller Fileye',
    waitTip: 'Belinizden yukarısı görünsün, ellerinizi rahatça kaldırabilin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-servis', 'point', 'yay-2'],
    tie: 'Berabere!',
    albumTitle: 'Balon Voleybolu',
    mid: (cfg) => `${cfg.to} sayıda biter`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  Object.assign(m, { to: Number(cfg.to), ball: null, hands: [[], []], prevHands: [[], []], lastT: 0, cool: [0, 0], touches: [0, 0], rally: 0, longest: 0, last: -1 });
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Balon Geliyor</h2><p class="hud-tip">Ellerinle karşıya vur.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = m.lastT ? Math.max(0.016, (now - m.lastT) / 1000) : 0.033;
    m.lastT = now;
    players.forEach((p, i) => {
      const hs = p ? handsOf(p, cam.W, cam.H) : [null, null];
      m.hands[i] = hs.map((h, k) => {
        if (!h) return null;
        const o = m.prevHands[i][k];
        return { x: h.x, y: h.y, vx: o ? (h.x - o.x) / dt : 0, vy: o ? (h.y - o.y) / dt : 0 };
      });
      m.prevHands[i] = hs;
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Servis!', voice: 'go-servis' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  serve(ctx, Math.random() < 0.5 ? 0 : 1);
}

// Balon servis atanın tarafında, yukarıdan yavaşça iner
function serve(ctx, who) {
  const { m } = ctx;
  m.ball = null;
  m.rally = 0;
  m.last = -1;
  ctx.life.timeout(() => {
    if (m.over) return;
    const [x0, x1] = ctx.half(who);
    m.ball = { x: (x0 + x1) / 2, y: 0.08, vx: 0, vy: 0.05, spin: 0, color: PCOL[who] };
    sfx.whoosh();
  }, 1000);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const AR = W / H;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { alpha: 0.45, label: '', trail: false }); });
  // Kum ve file
  g.fillStyle = '#ffd99488';
  g.fillRect(0, H * 0.965, W, H * 0.035);
  g.beginPath();
  g.moveTo(W / 2, NET_TOP * H);
  g.lineTo(W / 2, H);
  g.lineWidth = 9;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.lineWidth = 4;
  g.strokeStyle = '#fff';
  g.stroke();
  g.save();
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.strokeStyle = '#fff';
  for (let k = 0; k < 6; k++) {
    const yy = (NET_TOP + (k / 6) * (1 - NET_TOP)) * H;
    g.beginPath();
    g.moveTo(W / 2 - 22, yy);
    g.lineTo(W / 2 + 22, yy);
    g.stroke();
  }
  g.restore();
  g.beginPath();
  g.rect(W / 2 - 26, NET_TOP * H - 8, 52, 14);
  inked(g, '#fffcf6', 3);
  // Eller
  m.hands.forEach((hs, i) => hs.forEach((h) => {
    if (!h) return;
    g.beginPath();
    g.arc(h.x, h.y, 18, 0, Math.PI * 2);
    inked(g, PCOL[i], 4);
  }));
  const b = m.ball;
  if (b) {
    const steps = Math.ceil(dt / 0.008);
    for (let s = 0; s < steps; s++) step(ctx, b, dt / steps, W, H, AR);
    if (m.ball) drawBalloon(g, b.x * W, b.y * H, R * H, b, t);
  }
  if (m.rally >= 4) tag(g, W / 2, NET_TOP * H - 40, `${m.rally} vuruş`, '#2a1636', 15);
  fx.draw(g, dt);
}

function step(ctx, b, h, W, H, AR) {
  const { m, cam, fx } = ctx;
  // Hava direnci ve yavaş yerçekimi: balon süzülür
  b.vy += GRAV * h;
  b.vx *= 1 - 0.35 * h;
  b.vy *= 1 - 0.35 * h;
  b.x += (b.vx * h) / AR;
  b.y += b.vy * h;
  b.spin += b.vx * h * 6;
  const rx = R / AR;
  if (b.x < rx) { b.x = rx; b.vx = Math.abs(b.vx) * 0.7; }
  if (b.x > 1 - rx) { b.x = 1 - rx; b.vx = -Math.abs(b.vx) * 0.7; }
  if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.5; }
  // File: alttan geçemez, üstünden seker
  if (b.y + R > NET_TOP && Math.abs(b.x - 0.5) < rx + 0.006) {
    if (b.y < NET_TOP + R * 0.4 && b.vy > 0) b.vy = -Math.abs(b.vy) * 0.6;
    else {
      b.x = 0.5 + Math.sign(b.x - 0.5 || 1) * (rx + 0.007);
      b.vx = Math.sign(b.x - 0.5) * Math.abs(b.vx) * 0.6;
    }
  }
  // El vuruşu: yalnızca kendi tarafında; el hızının bir kısmı balona geçer
  const now = performance.now();
  for (const i of [0, 1]) {
    if (now < m.cool[i]) continue;
    const [x0, x1] = ctx.half(i);
    for (const hd of m.hands[i]) {
      if (!hd) continue;
      const hx = hd.x / W;
      const hy = hd.y / H;
      if (hx < x0 - 0.02 || hx > x1 + 0.02) continue;
      const dx = (b.x - hx) * AR;
      const dy = b.y - hy;
      const d = Math.hypot(dx, dy);
      if (d > R + 0.03) continue;
      const toward = Math.sign(0.5 - (x0 + x1) / 2);
      const hvx = clamp(hd.vx / H, -3, 3);
      const hvy = clamp(hd.vy / H, -3, 3);
      b.vx = clamp(toward * 0.42 + hvx * 0.45 + (dx / (d || 1)) * 0.25, -1.6, 1.6);
      b.vy = clamp(-0.62 + Math.min(0, hvy) * 0.35 + (dy / (d || 1)) * 0.15, -1.5, 0.3);
      // Balon karşıya gitmeli: vuruş kendi tarafına doğruysa hafifçe çevrilir
      if (Math.sign(b.vx) !== toward) b.vx = toward * Math.max(0.25, Math.abs(b.vx) * 0.5);
      b.color = PCOL[i];
      m.cool[i] = now + 260;
      m.touches[i]++;
      if (m.last !== i) {
        m.rally++;
        m.longest = Math.max(m.longest, m.rally);
      }
      m.last = i;
      sfx.pop(0.75);
      fx.ring(b.x * W, b.y * H, PCOL[i], R * H);
      fx.burst(hd.x, hd.y, { n: 6, colors: [PCOL[i], '#fff'], power: 200 });
      break;
    }
  }
  // Yere düştü
  if (b.y + R >= 0.985) {
    const side = b.x < 0.5 ? 'L' : 'R';
    const loser = side === 'L' ? cam.leftIs : 1 - cam.leftIs;
    point(ctx, 1 - loser, b.x, b.y);
  }
}

function drawBalloon(g, x, y, r, b, t) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(b.spin) * 0.25);
  g.beginPath();
  g.moveTo(0, r * 1.02);
  g.quadraticCurveTo(r * 0.3 * Math.sin(t / 200), r * 1.6, 0, r * 1.95);
  g.lineWidth = 2.5;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.beginPath();
  g.ellipse(0, 0, r * 0.9, r, 0, 0, Math.PI * 2);
  inked(g, b.color, 4);
  g.beginPath();
  g.moveTo(-r * 0.12, r * 0.98); g.lineTo(r * 0.12, r * 0.98); g.lineTo(0, r * 1.12); g.closePath();
  inked(g, b.color, 2.5);
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.4, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2);
  g.fillStyle = '#ffffffaa';
  g.fill();
  g.restore();
}

function point(ctx, who, bx, by) {
  const { m, cam, fx } = ctx;
  m.ball = null;
  sfx.success();
  announcer.react('point');
  const x = bx * cam.W;
  const y = by * cam.H;
  fx.burst(x, y, { n: 26, colors: ['#ffd994', '#fff', PCOL[who]], power: 360, gravity: 800 });
  fx.text(x, y - 60, 'Sayı!', PCOL[who], 28);
  ctx.score(who, 1, bx, by);
  ctx.shoot(who, 'Sayı Aldı!', { pad: 0.1 });
  if (ctx.pts[who] >= m.to) {
    scoreboard.setMid('Maç Bitti');
    ctx.life.timeout(() => ctx.finish({
      sub: `En uzun ralli ${m.longest} vuruş.`,
      stats: m.touches.map((n) => html`<span><b>${n}</b> dokunuş</span>`),
    }), 1500);
    return;
  }
  serve(ctx, 1 - who);
}
