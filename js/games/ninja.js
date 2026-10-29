// Dilim Dilim: kendi yarına fırlayan meyveleri elini hızlıca savurarak kes. Bombaya dokunma!

import { html, rand, pick } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, handsOf, inked, PCOL, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';

const FRUITS = [
  { id: 'karpuz', rind: '#2ed67a', flesh: '#ff4f62', seed: '#2a1636', r: 1.15 },
  { id: 'portakal', rind: '#ff9f1c', flesh: '#ffcd3c', seed: '#fff3c4', r: 0.9 },
  { id: 'elma', rind: '#e8241f', flesh: '#fff3d6', seed: '#6b3b1f', r: 0.92 },
  { id: 'kivi', rind: '#8a6a3a', flesh: '#9be15d', seed: '#2a1636', r: 0.82 },
  { id: 'erik', rind: '#8a4dff', flesh: '#ffd27a', seed: '#6b3b1f', r: 0.78 },
];
const MIN_SPEED = 1.1;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-ninja',
    kind: 'pose',
    cfg: { secs: '45' },
    rules: [
      'Herkesin yarısına aşağıdan meyveler fırlar. Elini hızlıca savurup meyvenin içinden geçir: dilim dilim!',
      html`Meyve <b>+1</b>, altın meyve <b>+3</b>. Bombayı kesersen <b>-3</b>!`,
      'Tek savuruşta birkaç meyve kesersen kombo bonusu. Yavaş dokunuş kesmez, hızlı ol!',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Bıçaklar Hazır',
    waitTip: 'Belinizden yukarısı görünsün, ellerinizi rahatça savurabilin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-kes', 'gold', 'bomb', 'timeup'],
    tie: 'Berabere! Aynı Keskinlikte',
    albumTitle: 'Dilim Dilim',
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  const secs = Number(cfg.secs);
  Object.assign(m, {
    fruits: [], halves: [], blades: [[], []], prev: [[null, null], [null, null]], lastT: 0,
    running: false, spawnAt: 0, t0: 0, stats: [[0, 0, 0], [0, 0, 0]], combo: [[], []], bestCombo: [0, 0],
  });
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="pop-clock" data-clock>${secs}</div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  // El hareketleri kesik çizgilere çevrilir: her karede bir önceki konumdan bugüne
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = m.lastT ? Math.max(0.016, (now - m.lastT) / 1000) : 0.033;
    m.lastT = now;
    players.forEach((p, i) => {
      if (!p) {
        m.prev[i] = [null, null];
        return;
      }
      const sw = Math.hypot((p.lm[11].x - p.lm[12].x) * cam.W, (p.lm[11].y - p.lm[12].y) * cam.H) || 80;
      const hs = handsOf(p, cam.W, cam.H);
      hs.forEach((h, k) => {
        const o = m.prev[i][k];
        if (h && o) {
          const speed = Math.hypot(h.x - o.x, h.y - o.y) / sw / dt;
          if (speed > MIN_SPEED) m.blades[i].push({ x1: o.x, y1: o.y, x2: h.x, y2: h.y, t: now, used: false });
        }
        m.prev[i][k] = h;
      });
      while (m.blades[i].length && now - m.blades[i][0].t > 220) m.blades[i].shift();
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Kes!', voice: 'go-kes' });
  if (!ctx.life.alive || m.over) return;
  m.running = true;
  m.t0 = ctx.now();
  ctx.clock(clockEl, secs, {
    onEnd: () => {
      m.running = false;
      sfx.whistle();
      announcer.say('timeup');
      ctx.life.timeout(() => ctx.finish({
        stats: [0, 1].map((i) => html`<span><b>${m.stats[i][0]}</b> meyve</span><span><b>${m.stats[i][1]}</b> altın</span><span><b>${m.stats[i][2]}</b> bomba</span><span>En iyi kombo <b>${m.bestCombo[i]}</b></span>`),
      }), 1400);
    },
  });
}

function spawn(ctx, progress) {
  const { m } = ctx;
  const roll = Math.random();
  const kind = roll < 0.09 ? 'gold' : roll < 0.09 + 0.1 + progress * 0.08 ? 'bomb' : 'fruit';
  const f = pick(FRUITS);
  const u = rand(0.22, 0.78);
  const vx = rand(-0.12, 0.12);
  const vy = -rand(1.25, 1.45);
  const spin = rand(-4, 4);
  // Aynı meyve iki yarıda da aynı yoldan fırlar
  for (const i of [0, 1]) {
    const [x0, x1] = ctx.half(i);
    m.fruits.push({ owner: i, kind, f, x: x0 + (x1 - x0) * u, y: 1.08, vx, vy, rot: 0, spin });
  }
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const R = H * 0.055;
  const now = ctx.now();
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { alpha: 0.4, label: '', trail: false }); });
  if (m.running) {
    const progress = Math.min(1, (now - m.t0) / 1000 / Number(ctx.cfg.secs));
    if (now >= m.spawnAt) {
      spawn(ctx, progress);
      if (Math.random() < 0.25 + progress * 0.3) ctx.life.timeout(() => m.running && spawn(ctx, progress), 220);
      m.spawnAt = now + rand(850, 1250) * (1 - progress * 0.3);
    }
  }
  // Bıçak izleri
  m.blades.forEach((list, i) => {
    g.lineCap = 'round';
    for (const b of list) {
      const a = 1 - (now - b.t) / 220;
      if (a <= 0) continue;
      g.globalAlpha = a;
      g.beginPath();
      g.moveTo(b.x1, b.y1);
      g.lineTo(b.x2, b.y2);
      g.lineWidth = 14 * a + 2;
      g.strokeStyle = PCOL[i];
      g.stroke();
      g.lineWidth = 5 * a + 1;
      g.strokeStyle = '#fff';
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  // Meyveler
  for (let k = m.fruits.length - 1; k >= 0; k--) {
    const f = m.fruits[k];
    f.vy += 1.1 * dt;
    f.x += (f.vx * dt * H) / W;
    f.y += f.vy * dt;
    f.rot += f.spin * dt;
    const x = f.x * W;
    const y = f.y * H;
    const r = R * (f.kind === 'fruit' ? f.f.r : 1);
    let cut = null;
    if (m.running) {
      for (const b of m.blades[f.owner]) {
        if (segDist(x, y, b.x1, b.y1, b.x2, b.y2) < r + 6) {
          cut = b;
          break;
        }
      }
    }
    if (cut) {
      slice(ctx, f, x, y, r, cut, now);
      m.fruits.splice(k, 1);
      continue;
    }
    if (f.y > 1.2 && f.vy > 0) {
      m.fruits.splice(k, 1);
      continue;
    }
    drawFruit(g, f, x, y, r, t);
  }
  // Kesilmiş yarımlar
  for (let k = m.halves.length - 1; k >= 0; k--) {
    const h = m.halves[k];
    h.vy += 1.4 * dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.rot += h.spin * dt;
    if (h.y > 1.3) {
      m.halves.splice(k, 1);
      continue;
    }
    drawHalf(g, h, h.x * W, h.y * H, h.r);
  }
  fx.draw(g, dt);
}

const segDist = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
  return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
};

function drawFruit(g, f, x, y, r, t) {
  g.save();
  g.translate(x, y);
  g.rotate(f.rot);
  if (f.kind === 'bomb') {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    inked(g, '#3a2d5c', 4);
    g.beginPath();
    g.moveTo(r * 0.5, -r * 0.8);
    g.quadraticCurveTo(r * 0.9, -r * 1.3, r * 1.15, -r * 1.1);
    g.lineWidth = 5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.beginPath();
    g.arc(r * 1.17, -r * 1.12, r * (0.16 + 0.06 * Math.sin(t / 60)), 0, Math.PI * 2);
    g.fillStyle = '#ffcd3c';
    g.fill();
    g.fillStyle = '#fff';
    g.font = `400 ${Math.round(r * 0.75)}px "Lilita One", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('-3', 0, 2);
  } else {
    const gold = f.kind === 'gold';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    inked(g, gold ? '#ffcd3c' : f.f.rind, 4);
    if (f.f.id === 'karpuz' && !gold) {
      g.lineWidth = r * 0.12;
      g.strokeStyle = '#1fa860';
      for (const a of [-0.6, 0, 0.6]) {
        g.beginPath();
        g.ellipse(0, 0, r * Math.abs(Math.cos(a)) * 0.9 + 1, r * 0.95, 0, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      }
    }
    g.beginPath();
    g.ellipse(-r * 0.35, -r * 0.38, r * 0.2, r * 0.3, -0.6, 0, Math.PI * 2);
    g.fillStyle = '#ffffff88';
    g.fill();
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.4, -r * 1.45, r * 0.7, -r * 1.2);
    g.lineWidth = 4;
    g.strokeStyle = '#2ed67a';
    g.stroke();
    if (gold) {
      g.fillStyle = '#2a1636';
      g.font = `400 ${Math.round(r * 0.75)}px "Lilita One", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('+3', 0, 2);
    }
  }
  g.restore();
}

function drawHalf(g, h, x, y, r) {
  g.save();
  g.translate(x, y);
  g.rotate(h.rot);
  g.beginPath();
  g.arc(0, 0, r, h.side ? 0 : Math.PI, h.side ? Math.PI : Math.PI * 2);
  g.closePath();
  inked(g, h.rind, 3.5);
  g.beginPath();
  g.arc(0, 0, r * 0.8, h.side ? 0 : Math.PI, h.side ? Math.PI : Math.PI * 2);
  g.closePath();
  g.fillStyle = h.flesh;
  g.fill();
  g.fillStyle = h.seed;
  for (const sx of [-0.4, 0, 0.4]) {
    g.beginPath();
    g.ellipse(sx * r, (h.side ? 1 : -1) * r * 0.35, r * 0.06, r * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function slice(ctx, f, x, y, r, blade, now) {
  const { m, cam, fx } = ctx;
  const i = f.owner;
  const W = cam.W;
  const H = cam.H;
  if (f.kind === 'bomb') {
    m.stats[i][2]++;
    sfx.boom();
    announcer.react('bomb');
    ctx.shake(12);
    fx.burst(x, y, { n: 30, colors: ['#ff8a3d', '#ffcd3c', '#2a1636'], power: 520 });
    fx.text(x, y - 50, 'Bomba! -3', '#ff4f62', 26);
    ctx.shoot(i, 'Bombayı Kesti!', { pad: 0.1 });
    ctx.score(i, -3, x / W, y / H, { quiet: true });
    m.combo[i] = [];
    return;
  }
  const gold = f.kind === 'gold';
  const pts = gold ? 3 : 1;
  m.stats[i][gold ? 1 : 0]++;
  sfx.slash();
  if (gold) {
    sfx.sparkle();
    announcer.react('gold');
    ctx.shoot(i, 'Altın Meyve!', { pad: 0.1 });
  } else {
    sfx.pop(0.7 + Math.random() * 0.3);
  }
  // Kesik yönüne dik iki yarım
  const ang = Math.atan2(blade.y2 - blade.y1, blade.x2 - blade.x1);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const rind = gold ? '#ffcd3c' : f.f.rind;
  for (const side of [0, 1]) {
    const s = side ? 1 : -1;
    m.halves.push({ x: x / W, y: y / H, vx: nx * s * 0.18, vy: ny * s * 0.3 - 0.3, rot: ang, spin: s * 3, r, side, rind, flesh: f.f.flesh, seed: f.f.seed });
  }
  fx.burst(x, y, { n: 14, colors: [f.f.flesh, f.f.flesh, '#fff'], power: 300 });
  // Kombo: yarım saniye içinde kesilenler
  const list = m.combo[i].filter((c) => now - c < 450);
  list.push(now);
  m.combo[i] = list;
  let bonus = 0;
  if (list.length >= 3) {
    bonus = list.length - 2;
    m.bestCombo[i] = Math.max(m.bestCombo[i], list.length);
    fx.text(x, y - 80, `${list.length} Kombo! +${bonus}`, '#ffcd3c', 22);
    sfx.warm(Math.min(1, list.length / 6));
  }
  fx.text(x, y - 40, `+${pts}`, PCOL[i], 22);
  ctx.score(i, pts + bonus, x / W, y / H, { quiet: true });
}
