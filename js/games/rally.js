// Kafa Rallisi: herkesin kendi yolu ve arabası var. Başını sağa sola oynatarak sür, kalpleri topla, engellerden kaç.
// Yağ birikintisine girersen direksiyon bir süre ters döner

import { html, rand, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, heartPath, starPath, inked, PCOL, tag, roundRect, missingText } from './arena.js';

// Burnun ±0,07 kayması yolun bir kenarından öbürüne götürür
const GAIN = 12;
const ROAD = 0.34;
const CAR_Y = 0.8;
const KINDS = [
  { id: 'heart', pts: 1, w: 46 },
  { id: 'star', pts: 3, w: 8 },
  { id: 'cone', pts: -1, w: 30 },
  { id: 'oil', pts: 0, w: 12 },
];

function pickKind() {
  let r = Math.random() * KINDS.reduce((n, k) => n + k.w, 0);
  for (const k of KINDS) {
    r -= k.w;
    if (r <= 0) return k;
  }
  return KINDS[0];
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-rally',
    kind: 'face',
    cfg: { secs: '45' },
    rules: [
      'İkinizin de kendi yolu ve arabası var. Başını sağa sola oynatınca araban da gider.',
      html`Kalp <b>+1</b>, yıldız <b>+3</b>. Koniye çarparsan <b>-1</b> ve araban savrulur.`,
      'Yağ birikintisine dikkat: bir süre direksiyon ters döner! Süre bitince en çok puanı olan kazanır.',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Kemerler Bağlansın',
    waitTip: 'Yan yana oturun, kameraya düz bakın.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-gaz', 'gold', 'oil', 'timeup'],
    tie: 'Berabere! Aynı Anda Bitiş Çizgisinde',
    albumTitle: 'Kafa Rallisi',
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  const secs = Number(cfg.secs);
  Object.assign(m, {
    base: [0.3, 0.7], car: [0, 0], target: [0, 0], spin: [0, 0], oil: [0, 0], items: [], dist: 0,
    running: false, spawnAt: 0, t0: 0, stats: [[0, 0, 0], [0, 0, 0]],
  });
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="pop-clock" data-clock>${secs}</div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    const now = ctx.now();
    players.forEach((p, i) => {
      if (!p) return;
      const dir = m.oil[i] > now ? -1 : 1;
      m.target[i] = clamp((noseOf(p).x - m.base[i]) * GAIN * dir, -0.9, 0.9);
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  const base = await ctx.countdown(scene, { final: 'Gaz!', voice: 'go-gaz', measure: (p) => ({ x: noseOf(p).x }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => (b ? b.x : m.base[i]));
  m.running = true;
  m.t0 = ctx.now();
  ctx.clock(clockEl, secs, {
    onEnd: () => {
      m.running = false;
      sfx.whistle();
      announcer.say('timeup');
      ctx.life.timeout(() => ctx.finish({
        stats: m.stats.map((s) => html`<span><b>${s[0]}</b> kalp</span><span><b>${s[1]}</b> yıldız</span><span><b>${s[2]}</b> kaza</span>`),
      }), 1400);
    },
  });
}

// Yolun ortası (normalize x) ve yarı genişliği
function roadOf(ctx, i) {
  const [x0, x1] = ctx.half(i);
  return { cx: (x0 + x1) / 2, hw: ((x1 - x0) * ROAD * 2) / 2 * 0.98 };
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const now = ctx.now();
  const progress = m.running ? Math.min(1, (now - m.t0) / 1000 / Number(ctx.cfg.secs)) : 0;
  const speed = 0.38 + progress * 0.32;
  if (m.running) m.dist += speed * dt;
  if (m.running && now >= m.spawnAt) {
    const k = pickKind();
    const u = rand(-0.82, 0.82);
    for (const i of [0, 1]) m.items.push({ owner: i, kind: k.id, pts: k.pts, u, y: -0.08, hit: false });
    m.spawnAt = now + rand(560, 820) * (1 - progress * 0.35);
  }
  for (const i of [0, 1]) {
    const rd = roadOf(ctx, i);
    const x0 = (rd.cx - rd.hw) * W;
    const w = rd.hw * 2 * W;
    // Yol
    g.globalAlpha = 0.6;
    roundRect(g, x0, -10, w, H + 20, 18);
    g.fillStyle = '#3a2d5c';
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 6;
    g.strokeStyle = PCOL[i];
    g.strokeRect(x0, -10, w, H + 20);
    // Kesik orta çizgiler aşağı akar
    const dash = H * 0.12;
    const off = (m.dist * H * 1.6) % (dash * 2);
    g.fillStyle = '#ffffffcc';
    for (let y = -dash * 2 + off; y < H; y += dash * 2) g.fillRect(rd.cx * W - 4, y, 8, dash);
    // Araba yumuşakça hedefe kayar
    if (m.spin[i] > now) m.car[i] += Math.sin(now / 40) * 0.02;
    else m.car[i] += (m.target[i] - m.car[i]) * Math.min(1, dt * 12);
    m.car[i] = clamp(m.car[i], -0.85, 0.85);
  }
  // Nesneler
  for (let k = m.items.length - 1; k >= 0; k--) {
    const it = m.items[k];
    it.y += speed * dt;
    const rd = roadOf(ctx, it.owner);
    const x = (rd.cx + it.u * rd.hw) * W;
    const y = it.y * H;
    const s = H * 0.04;
    if (!it.hit && m.running && Math.abs(it.y - CAR_Y) < 0.06 && Math.abs(it.u - m.car[it.owner]) * rd.hw * W < s * 1.6) {
      it.hit = true;
      collect(ctx, it, x, y, now);
      m.items.splice(k, 1);
      continue;
    }
    if (it.y > 1.1) {
      m.items.splice(k, 1);
      continue;
    }
    drawThing(g, it.kind, x, y, s, t);
  }
  // Arabalar
  for (const i of [0, 1]) {
    const rd = roadOf(ctx, i);
    const x = (rd.cx + m.car[i] * rd.hw) * W;
    const y = CAR_Y * H;
    drawCar(g, x, y, H * 0.05, i, m, now, t);
  }
  fx.draw(g, dt);
}

function drawThing(g, kind, x, y, s, t) {
  if (kind === 'heart') {
    heartPath(g, x, y + s * 0.2, s * (1 + Math.sin(t / 150) * 0.06));
    inked(g, '#ff5fa2', 3.5);
  } else if (kind === 'star') {
    g.save();
    g.translate(x, y);
    g.rotate(t / 500);
    starPath(g, 0, 0, s * 1.1);
    inked(g, '#ffcd3c', 3.5);
    g.restore();
  } else if (kind === 'cone') {
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.7, y + s * 0.8);
    g.lineTo(x - s * 0.7, y + s * 0.8);
    g.closePath();
    inked(g, '#ff8a3d', 3.5);
    g.fillStyle = '#fff';
    g.fillRect(x - s * 0.38, y, s * 0.76, s * 0.22);
  } else {
    g.beginPath();
    g.ellipse(x, y, s * 1.3, s * 0.7, 0, 0, Math.PI * 2);
    inked(g, '#1d1530', 3);
    g.beginPath();
    g.ellipse(x - s * 0.3, y - s * 0.15, s * 0.4, s * 0.16, -0.3, 0, Math.PI * 2);
    g.fillStyle = '#7f6bff88';
    g.fill();
  }
}

function drawCar(g, x, y, s, i, m, now, t) {
  g.save();
  g.translate(x, y);
  const spin = m.spin[i] > now ? (now / 60) % (Math.PI * 2) : (m.target[i] - m.car[i]) * 0.8;
  g.rotate(spin);
  // Tekerlekler
  g.fillStyle = '#2a1636';
  for (const [wx, wy] of [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.65], [0.75, 0.65]]) {
    roundRect(g, wx * s - s * 0.18, wy * s - s * 0.3, s * 0.36, s * 0.6, 4);
    g.fill();
  }
  roundRect(g, -s * 0.7, -s * 1.05, s * 1.4, s * 2.1, s * 0.45);
  inked(g, PCOL[i], 4);
  roundRect(g, -s * 0.48, -s * 0.62, s * 0.96, s * 0.5, 6);
  inked(g, '#bfe6ff', 3);
  // Sürücünün kafası: Furkan topuzlu, Sinem gözlüklü
  g.beginPath();
  g.arc(0, s * 0.25, s * 0.34, 0, Math.PI * 2);
  inked(g, '#ffd2a8', 3);
  if (i === 0) {
    g.beginPath();
    g.arc(0, -s * 0.12, s * 0.16, 0, Math.PI * 2);
    inked(g, '#3b2a20', 2.5);
  } else {
    g.lineWidth = 2.5;
    g.strokeStyle = '#2a1636';
    for (const ex of [-0.13, 0.13]) {
      g.beginPath();
      g.arc(ex * s, s * 0.22, s * 0.1, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (m.oil[i] > now) {
    g.rotate(-spin);
    tag(g, 0, -s * 1.7, 'Ters!', '#7f6bff', 14);
  }
  g.restore();
  // Egzoz dumanı
  const k = (t / 200) % 1;
  g.globalAlpha = 0.5 * (1 - k);
  g.beginPath();
  g.arc(x + Math.sin(t / 90) * 3, y + s * 1.3 + k * s * 1.2, s * (0.15 + k * 0.3), 0, Math.PI * 2);
  g.fillStyle = '#fff';
  g.fill();
  g.globalAlpha = 1;
}

function collect(ctx, it, x, y, now) {
  const { m, fx, cam } = ctx;
  const i = it.owner;
  if (it.kind === 'heart') {
    m.stats[i][0]++;
    sfx.pop(1 + Math.random() * 0.4);
    fx.burst(x, y, { n: 10, colors: ['#ff5fa2', '#fff'], power: 240, shape: 'heart' });
    fx.text(x, y - 36, '+1', PCOL[i], 22);
  } else if (it.kind === 'star') {
    m.stats[i][1]++;
    sfx.sparkle();
    announcer.react('gold');
    fx.burst(x, y, { n: 22, colors: ['#ffcd3c', '#fff'], power: 380, shape: 'star' });
    fx.text(x, y - 36, '+3', PCOL[i], 26);
    ctx.shoot(i, 'Yıldız Yakaladı!', { pad: 0.5 });
  } else if (it.kind === 'cone') {
    m.stats[i][2]++;
    m.spin[i] = now + 900;
    sfx.boing();
    ctx.shake(6);
    fx.burst(x, y, { n: 14, colors: ['#ff8a3d', '#fff'], power: 300 });
    fx.text(x, y - 36, 'Kaza! -1', '#ff4f62', 22);
    ctx.shoot(i, 'Koniye Daldı!', { pad: 0.5 });
  } else {
    m.oil[i] = now + 2600;
    sfx.deflate();
    announcer.react('oil');
    fx.text(x, y - 36, 'Direksiyon Ters!', '#7f6bff', 20);
    ctx.shoot(i, 'Yağa Bastı!', { pad: 0.5 });
  }
  if (it.pts) ctx.score(i, it.pts, x / cam.W, y / cam.H, { quiet: true });
}
