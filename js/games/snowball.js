// Kartopu Savaşı: elini partnerine doğru hızla savur, kartopu uçsun. Yüzüne gelen kartopunu
// elini yüzünün önüne kaldırıp savuştur. İsabet eden kar yüzde kalır; ilk N isabete ulaşan kazanır

import { html, rand, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, handsOf, shoulderPx, PCOL, missingText, hideTop } from './arena.js';
import { drawSkeleton } from './cam.js';

const FLIGHT = 0.75;
const THROW_V = 3.4;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-snowball',
    kind: 'pose',
    cfg: { to: '7' },
    rules: [
      'Elini partnerine doğru hızla savur: kartopu ona doğru uçar.',
      'Kartopu gelirken elini yüzünün önüne kaldır, savuştur. Yüzüne isabet eden kartopu 1 puan.',
      'İlk hedefe ulaşan kazanır. Finalde karlı yüzlerinizin fotoğrafı çıkar.',
    ],
    options: (cfg) => optHTML('Kaç İsabette Biter', segHTML('to', [['5', '5'], ['7', '7'], ['10', '10']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Kartopları Hazır',
    waitTip: 'Yan yana oturun, belinizden yukarısı ve kollarınız görünsün.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-kartopu', 'snow-hit', 'snow-block'],
    tie: 'Berabere! İkiniz de Kardan Adam',
    albumTitle: 'Kartopu Savaşı',
    mid: (cfg) => `${cfg.to} isabette biter`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.to = Number(cfg.to);
  m.prev = [[null, null], [null, null]];
  m.vel = [[0, 0], [0, 0]];
  m.cool = [0, 0];
  m.balls = [];
  m.snow = [[], []];
  m.thrown = [0, 0];
  m.blocks = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Kartopları Hazır</h2><p class="hud-tip">Elini ona doğru savur. Gelirken yüzünü koru.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    if (!m.running || !dt) return;
    players.forEach((p, i) => {
      if (!p) return;
      const W = cam.W;
      const H = cam.H;
      const sw = shoulderPx(p, W, H) || W * 0.1;
      const hands = handsOf(p, W, H);
      const dir = cam.sideOf(i);
      hands.forEach((h, k) => {
        const o = m.prev[i][k];
        m.prev[i][k] = h;
        if (!h || !o) return;
        const vx = ((h.x - o.x) / dt / sw) * dir;
        m.vel[i][k] = vx;
        // Partnere doğru hızlı savurma ve el omuz hizasının altına düşmemiş
        const sy = Math.min(p.lm[11].y, p.lm[12].y) * H;
        if (vx > THROW_V && h.y < sy + sw * 1.2 && ctx.now() > m.cool[i]) throwBall(ctx, i, h);
      });
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'At!', voice: 'go-kartopu' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.running = true;
}

// Partnerin başının o anki yeri
function headOf(ctx, i) {
  const p = ctx.cam.players[i];
  if (!p || p.lm[0].v < 0.4) return null;
  return { x: p.lm[0].x * ctx.cam.W, y: p.lm[0].y * ctx.cam.H, sw: shoulderPx(p, ctx.cam.W, ctx.cam.H) };
}

function throwBall(ctx, i, h) {
  const { m } = ctx;
  const target = headOf(ctx, 1 - i);
  if (!target) return;
  m.cool[i] = ctx.now() + 650;
  m.thrown[i]++;
  m.balls.push({ from: i, x0: h.x, y0: h.y, tx: target.x, ty: target.y, k: 0, spin: rand(0, 6) });
  sfx.whoosh();
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const H = cam.H;
  players.forEach((p, i) => {
    if (!p) return;
    drawSkeleton(g, cam, p, i, { trail: true });
    // Yüzdeki kar lekeleri, başa göre
    const hd = headOf(ctx, i);
    if (!hd) return;
    for (const s of m.snow[i]) snowBlob(g, hd.x + s.u * hd.sw, hd.y + s.v * hd.sw, s.r * hd.sw, s.seed);
  });
  for (const b of m.balls) {
    if (b.dead) continue;
    b.k += dt / FLIGHT;
    // Uçarken hedef kişinin başını hafifçe takip eder; kaçan kurtulabilir
    const hd = headOf(ctx, 1 - b.from);
    if (hd && b.k < 0.6) {
      b.tx += (hd.x - b.tx) * Math.min(1, dt * 2);
      b.ty += (hd.y - b.ty) * Math.min(1, dt * 2);
    }
    const k = Math.min(1, b.k);
    const x = b.x0 + (b.tx - b.x0) * k;
    const y = b.y0 + (b.ty - b.y0) * k - Math.sin(k * Math.PI) * H * 0.18;
    const r = H * (0.03 + 0.012 * Math.sin(k * Math.PI));
    if (b.k >= 1) {
      b.dead = true;
      impact(ctx, b, x, y);
      continue;
    }
    g.save();
    g.translate(x, y);
    g.rotate(b.spin + k * 8);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = '#fbfdff';
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.fillStyle = '#d6e6f5';
    g.beginPath();
    g.arc(r * 0.3, r * 0.25, r * 0.35, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  m.balls = m.balls.filter((b) => !b.dead);
  fx.draw(g, dt);
}

function snowBlob(g, x, y, r, seed) {
  g.beginPath();
  for (let k = 0; k <= 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const rr = r * (0.75 + 0.3 * Math.sin(seed + k * 2.1));
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#fbfdffee';
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = '#9fc2e0';
  g.stroke();
}

function impact(ctx, b, x, y) {
  const { m, cam, fx } = ctx;
  const i = 1 - b.from;
  const p = cam.players[i];
  const hd = headOf(ctx, i);
  if (!p || !hd || !m.running) {
    fx.burst(x, y, { n: 12, colors: ['#fff', '#d6e6f5'], power: 200 });
    return;
  }
  // Savuşturma: ellerden biri yüzün önünde
  const hands = handsOf(p, cam.W, cam.H).filter(Boolean);
  const blocked = hands.some((h) => Math.hypot(h.x - hd.x, h.y - hd.y) < hd.sw * 0.85);
  const near = Math.hypot(x - hd.x, y - hd.y) < hd.sw * 0.9;
  if (blocked) {
    m.blocks[i]++;
    sfx.thud(0.7);
    announcer.react('snow-block');
    fx.burst(x, y, { n: 22, colors: ['#fff', '#d6e6f5', PCOL[i]], power: 360 });
    fx.text(x, y - 40, 'Savuşturdu!', PCOL[i], 22);
    return;
  }
  if (!near) {
    fx.burst(x, y, { n: 12, colors: ['#fff', '#d6e6f5'], power: 200 });
    fx.text(x, y - 30, 'Iska!', '#a99cb3', 18);
    return;
  }
  // İsabet: kar yüze yapışır
  if (m.snow[i].length > 10) m.snow[i].shift();
  m.snow[i].push({ u: clamp((x - hd.x) / hd.sw, -0.35, 0.35), v: clamp((y - hd.y) / hd.sw, -0.45, 0.35), r: rand(0.16, 0.24), seed: rand(0, 6) });
  sfx.splat();
  announcer.react('snow-hit');
  ctx.shake(5);
  fx.burst(x, y, { n: 26, colors: ['#fff', '#d6e6f5', '#bcd8f0'], power: 420 });
  fx.text(x, y - 46, 'Pof! +1', PCOL[b.from], 22);
  ctx.score(b.from, 1, x / cam.W, y / cam.H, { quiet: true });
  if (ctx.pts[b.from] >= m.to) end(ctx);
}

function end(ctx) {
  const { m, cam } = ctx;
  if (!m.running) return;
  m.running = false;
  scoreboard.setMid('Bitti');
  sfx.whistle();
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => {
      const snow = m.snow[i].slice();
      const p = cam.players[i];
      ctx.shoot(i, snow.length ? `${snow.length} kartopu yedi` : 'Tertemiz kaldı', {
        pad: 0.25,
        force: true,
        decorate: (og, map) => {
          if (!p || p.lm[0].v < 0.4) return;
          const sw = Math.hypot(p.lm[11].x - p.lm[12].x, (p.lm[11].y - p.lm[12].y) / (p.ar || 1.78));
          for (const s of snow) {
            const [x, y] = map(p.lm[0].x + s.u * sw, p.lm[0].y + (s.v * sw) * (p.ar || 1.78));
            const [x2] = map(p.lm[0].x + (s.u + s.r) * sw, p.lm[0].y);
            snowBlob(og, x, y, Math.abs(x2 - x), s.seed);
          }
        },
      });
    });
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.thrown[i]}</b> kartopu attı</span><span><b>${ctx.pts[i]}</b> isabet</span><span><b>${m.blocks[i]}</b> savuşturma</span>`),
    });
  }, 1200);
}
