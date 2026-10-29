// Kelebek Avı: başparmağınla işaret parmağını kelebeğin üstünde birleştir: yakaladın!
// Altın kelebek +3, arıyı tutarsan sokar -2. Süre bitince en çok kelebek yakalayan kazanır

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, inked, PCOL, tag, missingText, hideTop } from './arena.js';
import { pinchOf, pinchPoint } from '../vision/hands.js';
import { divider, drawPlayerHands, handIdle } from './handkit.js';

const WING = ['#ff8cc0', '#9fd8ff', '#ffcd3c', '#b9a3ff', '#8fe3b0'];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-butterfly',
    kind: 'hand',
    cfg: { secs: '40' },
    rules: [
      'Kendi tarafında kelebekler uçuşuyor. Başparmağınla işaret parmağını kelebeğin üstünde birleştir: yakaladın!',
      html`Kelebek <b>+1</b>, altın kelebek <b>+3</b>. Arıyı tutarsan sokar: <b>-2</b>.`,
      'Herkes ellerini kendi yarısında tutsun. Süre bitince en çok yakalayan kazanır.',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['40', '40 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Bahçe Hazır',
    waitTip: 'Ellerinizi kameraya, herkes kendi yarısında gösterin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-yakala', 'gold', 'bee', 'timeup'],
    tie: 'Berabere! Bahçe İkinizin',
    albumTitle: 'Kelebek Avı',
    mid: (cfg) => `${cfg.secs} sn`,
    idle: handIdle,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.bugs = [];
  m.pinch = [[false, false], [false, false]];
  m.ptr = [[], []];
  m.got = [0, 0];
  m.stung = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Bahçe Hazır</h2><p class="hud-tip">Kelebeğin üstünde parmaklarını birleştir.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      m.ptr[i] = [];
      if (!p || !p.hands) return;
      p.hands.forEach((h, k) => {
        const v = pinchOf(h, p.ar);
        const pt = pinchPoint(h);
        m.ptr[i].push({ ...pt, closed: v < 0.32 });
        // Açık parmaklar kapanınca tutma
        if (v > 0.55) m.pinch[i][k] = false;
        else if (v < 0.3 && !m.pinch[i][k]) {
          m.pinch[i][k] = true;
          if (m.running) grab(ctx, i, pt);
        }
      });
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Yakala!', voice: 'go-yakala' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.running = true;
  for (const i of [0, 1]) for (let k = 0; k < 4; k++) spawn(ctx, i);
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

function spawn(ctx, i) {
  const { m } = ctx;
  const [a, b] = ctx.half(i);
  const r = Math.random();
  const kind = r < 0.12 ? 'gold' : r < 0.28 ? 'bee' : 'fly';
  m.bugs.push({ owner: i, kind, x: rand(a + 0.07, b - 0.07), y: rand(0.15, 0.75), a: rand(0, 6), sp: rand(0.07, 0.12), wob: rand(0, 6), c: WING[Math.floor(rand(0, WING.length))] });
}

function grab(ctx, i, pt) {
  const { m, cam, fx } = ctx;
  const x = pt.x * cam.W;
  const y = pt.y * cam.H;
  const b = m.bugs.find((q) => q.owner === i && !q.dead && Math.hypot(q.x * cam.W - x, q.y * cam.H - y) < cam.H * 0.065);
  if (!b) return;
  b.dead = true;
  if (b.kind === 'bee') {
    m.stung[i]++;
    sfx.buzz();
    announcer.react('bee');
    ctx.shake(5);
    fx.text(x, y - 40, 'Ay! -2', '#ff4f62', 22);
    if (ctx.pts[i] > 0) ctx.score(i, -Math.min(2, ctx.pts[i]), x / cam.W, y / cam.H, { quiet: true });
  } else {
    const pts = b.kind === 'gold' ? 3 : 1;
    m.got[i]++;
    sfx.sparkle();
    if (pts === 3) announcer.react('gold');
    fx.burst(x, y, { n: 16, colors: [b.kind === 'gold' ? '#ffcd3c' : b.c, '#fff'], power: 260, shape: 'heart' });
    fx.text(x, y - 40, `+${pts}`, PCOL[i], 22);
    ctx.score(i, pts, x / cam.W, y / cam.H, { quiet: true });
  }
  ctx.life.timeout(() => m.running && spawn(ctx, i), 600);
}

function drawBug(g, b, x, y, s, t) {
  const flap = Math.abs(Math.sin(t / 90 + b.wob));
  if (b.kind === 'bee') {
    g.globalAlpha = 0.7;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + d * s * 0.4, y - s * 0.6, s * 0.5, s * 0.3 * (0.5 + flap), d * 0.4, 0, Math.PI * 2);
      g.fillStyle = '#e8f4ff';
      g.fill();
    }
    g.globalAlpha = 1;
    g.beginPath();
    g.ellipse(x, y, s * 0.8, s * 0.55, 0, 0, Math.PI * 2);
    inked(g, '#ffcd3c', 2.5);
    g.fillStyle = '#2a1636';
    g.fillRect(x - s * 0.15, y - s * 0.5, s * 0.2, s);
    g.fillRect(x + s * 0.3, y - s * 0.45, s * 0.18, s * 0.9);
    return;
  }
  const c = b.kind === 'gold' ? '#ffcd3c' : b.c;
  for (const d of [-1, 1]) {
    g.save();
    g.translate(x, y);
    g.scale(d * (0.35 + 0.65 * flap), 1);
    g.beginPath();
    g.ellipse(s * 0.7, -s * 0.35, s * 0.75, s * 0.6, 0.4, 0, Math.PI * 2);
    inked(g, c, 2.5);
    g.beginPath();
    g.ellipse(s * 0.55, s * 0.45, s * 0.5, s * 0.4, -0.4, 0, Math.PI * 2);
    inked(g, c, 2.5);
    g.restore();
  }
  g.beginPath();
  g.ellipse(x, y, s * 0.16, s * 0.75, 0, 0, Math.PI * 2);
  inked(g, '#3a2d5c', 2);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  divider(g, W, H);
  for (const b of m.bugs) {
    if (b.dead) continue;
    if (m.running && dt > 0) {
      const [x0, x1] = ctx.half(b.owner);
      b.a += rand(-2.5, 2.5) * dt;
      b.x += Math.cos(b.a) * b.sp * dt;
      b.y += Math.sin(b.a) * b.sp * dt * 1.4;
      if (b.x < x0 + 0.05 || b.x > x1 - 0.05) b.a = Math.PI - b.a;
      if (b.y < 0.12 || b.y > 0.82) b.a = -b.a;
      b.x = clamp(b.x, x0 + 0.05, x1 - 0.05);
      b.y = clamp(b.y, 0.12, 0.82);
    }
    drawBug(g, b, b.x * W, b.y * H + Math.sin(t / 300 + b.wob) * 4, H * 0.032, t);
  }
  m.bugs = m.bugs.filter((b) => !b.dead);
  drawPlayerHands(g, cam, players, { alpha: 0.75 });
  for (const i of [0, 1]) {
    for (const p of m.ptr[i]) {
      g.beginPath();
      g.arc(p.x * W, p.y * H, p.closed ? 10 : 16, 0, Math.PI * 2);
      g.lineWidth = 4;
      g.strokeStyle = p.closed ? '#ffcd3c' : PCOL[i];
      g.stroke();
    }
    const [a, b] = ctx.half(i);
    tag(g, ((a + b) / 2) * W, H - 36, `${nameOf(i)}: ${m.got[i]} kelebek`, PCOL[i], 15);
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.got[i]} kelebek`, { pad: 0.3, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.got[i]}</b> kelebek</span><span><b>${m.stung[i]}</b> arı sokması</span>`),
    });
  }, 1200);
}
