// Kafa Sektirme: herkesin başının üstünde bir top. Kafanla sektir, yere düşürme.
// Her sektirme +1, yıldızın içinden geçen top +2, 5'li seri bonus verir. Süre bitince en çok sektiren kazanır

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, inked, starPath, PCOL, tag, missingText, hideTop } from './arena.js';

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-juggle',
    kind: 'face',
    noBig: true,
    cfg: { secs: '45' },
    rules: [
      'Başının üstüne top düşer. Kafanla vurup havada tut; başını yukarı iterek vurursan daha yükseğe çıkar.',
      html`Her sektirme <b>+1</b>. Top yıldızın içinden geçerse <b>+2</b>. Beşli seriye bonus.`,
      'Top yere düşerse seri sıfırlanır, yeni top gelir. Süre bitince en çok sektiren kazanır.',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Kafalar Hazır',
    waitTip: 'Yan yana oturun; başınızın üstünde biraz boşluk kalsın.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-sektir', 'gold', 'miss', 'timeup'],
    tie: 'Berabere! Kafalar Eşit',
    albumTitle: 'Kafa Sektirme',
    mid: (cfg) => `${cfg.secs} sn`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.balls = [null, null];
  m.head = [null, null];
  m.hv = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  m.streak = [0, 0];
  m.best = [0, 0];
  m.drops = [0, 0];
  m.stars = [null, null];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Kafalar Hazır</h2><p class="hud-tip">Topun altına gir, başınla yukarı it.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.2, (now - last) / 1000) : 0;
    last = now;
    players.forEach((p, i) => {
      if (!p) return;
      const b = p.box;
      const h = { x: b.cx * cam.W, y: (b.y + b.h * 0.22) * cam.H, r: b.w * cam.W * 0.5 };
      const prev = m.head[i];
      if (prev && dt > 0) {
        const k = 0.5;
        m.hv[i].x += k * ((h.x - prev.x) / dt - m.hv[i].x);
        m.hv[i].y += k * ((h.y - prev.y) / dt - m.hv[i].y);
      }
      m.head[i] = h;
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  await ctx.countdown(scene, { final: 'Sektir!', voice: 'go-sektir' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.running = true;
  [0, 1].forEach((i) => {
    drop(ctx, i, 0);
    newStar(ctx, i);
  });
  const secs = Number(cfg.secs);
  ctx.clock(clockEl, secs, { onEnd: () => end(ctx), onTick: (left) => { ctx.clockFrac = 1 - left / secs; } });
}

// Oyuncunun yarısının ekran pikseli sınırları
const halfPx = (ctx, i) => ctx.half(i).map((v) => v * ctx.cam.W);

function drop(ctx, i, delay = 900) {
  const { m, cam } = ctx;
  m.balls[i] = null;
  ctx.life.timeout(() => {
    if (!m.running) return;
    const [x0, x1] = halfPx(ctx, i);
    const hx = m.head[i] ? m.head[i].x : (x0 + x1) / 2;
    m.balls[i] = { x: clamp(hx + rand(-30, 30), x0 + 40, x1 - 40), y: -cam.H * 0.05, vx: rand(-40, 40), vy: cam.H * 0.15, spin: 0, rot: 0, cool: 0 };
    sfx.whoosh();
  }, delay);
}

function newStar(ctx, i) {
  const { m, cam } = ctx;
  const [x0, x1] = halfPx(ctx, i);
  m.stars[i] = { x: rand(x0 + 60, x1 - 60), y: rand(cam.H * 0.12, cam.H * 0.35), t0: ctx.now() };
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const R = H * 0.048;
  // Orta çizgi
  g.save();
  g.setLineDash([10, 12]);
  g.beginPath();
  g.moveTo(W / 2, 0);
  g.lineTo(W / 2, H);
  g.lineWidth = 4;
  g.strokeStyle = '#ffffff88';
  g.stroke();
  g.restore();
  for (const i of [0, 1]) {
    const [x0, x1] = halfPx(ctx, i);
    const b = m.balls[i];
    const st = m.stars[i];
    if (st) {
      const s = H * 0.035 * (1 + Math.sin(t / 180) * 0.1);
      starPath(g, st.x, st.y, s);
      inked(g, '#ffcd3c', 3);
    }
    if (!b) continue;
    if (m.running && dt > 0) {
      const grav = H * (1.15 + 0.35 * Math.min(1, (ctx.clockFrac || 0)));
      b.vy += grav * dt;
      b.vx *= 1 - 0.4 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.x < x0 + R) { b.x = x0 + R; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x > x1 - R) { b.x = x1 - R; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < R && b.vy < 0) { b.y = R; b.vy = Math.abs(b.vy) * 0.4; }
      b.cool = Math.max(0, b.cool - dt);
      const h = m.head[i];
      if (h && cam.visible(i, 400) && b.cool <= 0) {
        const dx = b.x - h.x;
        const dy = b.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d < h.r + R && dy < h.r * 0.35 && b.vy > -H * 0.2) {
          // Kafadan sekme: normal yönünde yansır, başın yukarı itişi topa geçer
          const nx = dx / (d || 1);
          const ny = Math.min(-0.55, dy / (d || 1));
          const push = Math.max(0, -m.hv[i].y);
          const up = clamp(H * 1.05 + push * 0.55, H * 1.05, H * 1.75);
          b.vx = clamp(nx * H * 0.6 + m.hv[i].x * 0.35, -H * 0.55, H * 0.55);
          b.vy = ny * up;
          b.spin = nx * 8;
          b.cool = 0.25;
          b.y = h.y + ny * (h.r + R + 2);
          bounce(ctx, i, b);
        }
      }
      if (st && Math.hypot(b.x - st.x, b.y - st.y) < R + H * 0.035) {
        m.stars[i] = null;
        sfx.sparkle();
        announcer.react('gold');
        fx.burst(st.x, st.y, { n: 18, colors: ['#ffcd3c', '#fff'], shape: 'star', power: 360 });
        fx.text(st.x, st.y - 34, 'Yıldız! +2', PCOL[i], 20);
        ctx.score(i, 2, st.x / W, st.y / H, { quiet: true });
        ctx.life.timeout(() => m.running && newStar(ctx, i), 1200);
      }
      if (b.y > H + R) {
        m.drops[i]++;
        m.streak[i] = 0;
        sfx.boing();
        announcer.react('miss');
        fx.text(b.x, H - 50, 'Düştü!', '#ff4f62', 22);
        drop(ctx, i);
        continue;
      }
    }
    // Top: beyaz futbol topu, oyuncu renginde desen
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.rot);
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    inked(g, '#fffcf6', 3.5);
    g.fillStyle = PCOL[i];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, R * 0.26, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Seri sayacı topun yanında
    if (m.streak[i] >= 2) tag(g, b.x, b.y - R - 22, `${m.streak[i]} seri`, PCOL[i], 15);
  }
  // Baş halkası: kafanın vurduğu yer
  for (const i of [0, 1]) {
    const h = m.head[i];
    if (!h || !cam.visible(i, 600)) continue;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(h.x, h.y, h.r, Math.PI * 1.1, Math.PI * 1.9);
    g.lineWidth = 6;
    g.strokeStyle = PCOL[i];
    g.stroke();
    g.globalAlpha = 1;
    tag(g, h.x, h.y - h.r - 16, nameOf(i), PCOL[i], 14);
  }
  fx.draw(g, dt);
}

function bounce(ctx, i, b) {
  const { m, fx } = ctx;
  m.streak[i]++;
  m.best[i] = Math.max(m.best[i], m.streak[i]);
  sfx.pop(1.3);
  let pts = 1;
  if (m.streak[i] % 5 === 0) {
    pts += 2;
    sfx.success();
    announcer.cheer();
    fx.text(b.x, b.y - 60, `${m.streak[i]}'li Seri! +3`, PCOL[i], 22);
  }
  fx.burst(b.x, b.y + 20, { n: 8, colors: [PCOL[i], '#fff'], power: 200 });
  ctx.score(i, pts, b.x / ctx.cam.W, b.y / ctx.cam.H, { quiet: true });
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  m.balls = [null, null];
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `En uzun seri ${m.best[i]}`, { pad: 0.45, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.best[i]}</b> en uzun seri</span><span><b>${m.drops[i]}</b> kez düşürdü</span>`),
    });
  }, 1200);
}
