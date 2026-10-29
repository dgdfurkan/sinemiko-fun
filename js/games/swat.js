// Sinek Şaplak: kendi tarafında vızıldayan sinekleri iki elinle şaplatarak yakala.
// Ellerini sineğin olduğu yerde birleştir: şap! Altın sinek +3, arıya dokunursan sokar: -2

import { html, rand, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, handsOf, shoulderPx, inked, PCOL, missingText, hideTop } from './arena.js';
import { drawSkeleton } from './cam.js';

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-swat',
    kind: 'pose',
    cfg: { secs: '40' },
    rules: [
      'Kendi tarafında sinekler vızıldıyor. İki elini sineğin olduğu yerde birleştir: şap!',
      html`Sinek <b>+1</b>, altın sinek <b>+3</b>. Arıyı şaplatırsan sokar: <b>-2</b>.`,
      'Süre bitince en çok sinek yakalayan kazanır.',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['40', '40 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Sinekler Geliyor',
    waitTip: 'Yan yana oturun, belinizden yukarısı ve kollarınız görünsün.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-sap', 'gold', 'bee', 'timeup'],
    tie: 'Berabere! Sinekler Eşit Dağıldı',
    albumTitle: 'Sinek Şaplak',
    mid: (cfg) => `${cfg.secs} sn`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.flies = [];
  m.apart = [0, 0];
  m.cool = [0, 0];
  m.got = [0, 0];
  m.stung = [0, 0];
  m.claps = [0, 0];
  m.marks = [];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Sinekler Geliyor</h2><p class="hud-tip">Ellerini sineğin üstünde birleştir.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (!m.running) return;
    const now = ctx.now();
    players.forEach((p, i) => {
      if (!p) return;
      const [a, b] = handsOf(p, cam.W, cam.H);
      if (!a || !b) return;
      const sw = shoulderPx(p, cam.W, cam.H) || cam.W * 0.1;
      const d = Math.hypot(a.x - b.x, a.y - b.y) / sw;
      if (d > 0.85) m.apart[i] = now;
      // Ayrı duran eller kısa sürede birleşti: alkış
      if (d < 0.42 && now - m.apart[i] < 450 && now > m.cool[i]) {
        m.cool[i] = now + 320;
        clap(ctx, i, (a.x + b.x) / 2, (a.y + b.y) / 2, sw);
      }
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Şap!', voice: 'go-sap' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.running = true;
  for (const i of [0, 1]) for (let k = 0; k < 3; k++) spawn(ctx, i);
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

function spawn(ctx, i) {
  const { m } = ctx;
  const [x0, x1] = ctx.half(i);
  const r = Math.random();
  const kind = r < 0.12 ? 'gold' : r < 0.3 ? 'bee' : 'fly';
  m.flies.push({ owner: i, kind, x: rand(x0 + 0.06, x1 - 0.06), y: rand(0.2, 0.7), a: rand(0, 6), sp: kind === 'gold' ? 0.32 : 0.2, t0: ctx.now(), wob: rand(0, 6) });
}

function clap(ctx, i, x, y, sw) {
  const { m, cam, fx } = ctx;
  m.claps[i]++;
  sfx.clap();
  fx.ring(x, y, PCOL[i], 24);
  const hit = m.flies.filter((f) => f.owner === i && !f.dead && Math.hypot(f.x * cam.W - x, f.y * cam.H - y) < sw * 0.75);
  for (const f of hit) {
    f.dead = true;
    if (f.kind === 'bee') {
      m.stung[i]++;
      sfx.buzz();
      announcer.react('bee');
      ctx.shake(6);
      fx.text(x, y - 40, 'Arı soktu! -2', '#ff4f62', 22);
      if (ctx.pts[i] > 0) ctx.score(i, -Math.min(2, ctx.pts[i]), x / cam.W, y / cam.H, { quiet: true });
    } else {
      const pts = f.kind === 'gold' ? 3 : 1;
      m.got[i] += 1;
      sfx.splat();
      if (pts === 3) {
        sfx.sparkle();
        announcer.react('gold');
      }
      fx.burst(x, y, { n: pts === 3 ? 24 : 12, colors: pts === 3 ? ['#ffcd3c', '#fff'] : [PCOL[i], '#fff'], power: 320, shape: pts === 3 ? 'star' : 'circle' });
      fx.text(x, y - 40, pts === 3 ? 'Altın! +3' : 'Şap! +1', PCOL[i], 22);
      ctx.score(i, pts, x / cam.W, y / cam.H, { quiet: true });
      m.marks.push({ x, y, t: ctx.now() });
    }
    ctx.life.timeout(() => m.running && spawn(ctx, i), 700);
  }
}

function drawFly(g, f, x, y, s, t) {
  const flap = Math.sin(t / 25 + f.wob);
  // Kanatlar
  g.globalAlpha = 0.7;
  for (const d of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + d * s * 0.5, y - s * 0.6, s * 0.55, s * (0.3 + 0.15 * flap), d * 0.5, 0, Math.PI * 2);
    g.fillStyle = '#e8f4ff';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  g.globalAlpha = 1;
  g.beginPath();
  g.ellipse(x, y, s * 0.75, s * 0.55, 0, 0, Math.PI * 2);
  if (f.kind === 'bee') {
    inked(g, '#ffcd3c', 2.5);
    g.save();
    g.clip();
    g.fillStyle = '#2a1636';
    g.fillRect(x - s * 0.2, y - s, s * 0.22, s * 2);
    g.fillRect(x + s * 0.25, y - s, s * 0.22, s * 2);
    g.restore();
  } else inked(g, f.kind === 'gold' ? '#ffcd3c' : '#3a2d5c', 2.5);
  g.beginPath();
  g.arc(x - s * 0.45, y - s * 0.15, s * 0.22, 0, Math.PI * 2);
  g.fillStyle = f.kind === 'fly' ? '#ff4f62' : '#2a1636';
  g.fill();
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { trail: true }); });
  // Şaplanan yerde kısa süre leke
  const now = ctx.now();
  m.marks = m.marks.filter((k) => now - k.t < 900);
  for (const k of m.marks) {
    g.globalAlpha = 1 - (now - k.t) / 900;
    g.beginPath();
    g.arc(k.x, k.y, 10, 0, Math.PI * 2);
    g.fillStyle = '#3a2d5c';
    g.fill();
  }
  g.globalAlpha = 1;
  for (const f of m.flies) {
    if (f.dead) continue;
    if (m.running && dt > 0) {
      const [x0, x1] = ctx.half(f.owner);
      f.a += rand(-3, 3) * dt;
      f.x += Math.cos(f.a) * f.sp * dt * 0.6;
      f.y += Math.sin(f.a) * f.sp * dt;
      if (f.x < x0 + 0.04 || f.x > x1 - 0.04) f.a = Math.PI - f.a;
      if (f.y < 0.12 || f.y > 0.78) f.a = -f.a;
      f.x = clamp(f.x, x0 + 0.04, x1 - 0.04);
      f.y = clamp(f.y, 0.12, 0.78);
      if (Math.random() < dt * 0.6) sfx.fuse();
    }
    drawFly(g, f, f.x * W, f.y * H + Math.sin(t / 90 + f.wob) * 3, H * (f.kind === 'gold' ? 0.032 : 0.026), t);
  }
  m.flies = m.flies.filter((f) => !f.dead);
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.got[i]} sinek`, { pad: 0.2, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.got[i]}</b> sinek</span><span><b>${m.claps[i]}</b> şaplak</span><span><b>${m.stung[i]}</b> arı sokması</span>`),
    });
  }, 1200);
}
