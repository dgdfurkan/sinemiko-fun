// Kalp Tankları: iki minik tank, duvarlardan seken kalp mermileri. Sol sağ döner, ileri geri gider,
// Shift ateş eder. Mermi rakibe değerse tur senin; ama dikkat, seken mermi seni de vurabilir

import { html, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL, tag, roundRect } from './keyarena.js';
import { heartPath } from './arena.js';

const TR = 0.034;
const BR = 0.011;
const SPEED = 0.36;
const TURN = 3.2;
const BSPEED = 0.78;
const BOUNCES = 4;

// Duvar düzenleri: masa birimi (x 0..A, y 0..1); A ekran oranına göre ölçeklenir
const LAYOUTS = [
  (A) => [[A / 2 - 0.02, 0.18, 0.04, 0.24], [A / 2 - 0.02, 0.58, 0.04, 0.24], [A * 0.25, 0.47, A * 0.12, 0.04], [A * 0.63, 0.47, A * 0.12, 0.04]],
  (A) => [[A * 0.3, 0.2, 0.04, 0.6], [A * 0.68, 0.2, 0.04, 0.6], [A / 2 - 0.12, 0.48, 0.24, 0.04]],
  (A) => [[A * 0.2, 0.3, A * 0.15, 0.04], [A * 0.65, 0.66, A * 0.15, 0.04], [A / 2 - 0.02, 0, 0.04, 0.3], [A / 2 - 0.02, 0.7, 0.04, 0.3], [A * 0.35, 0.62, 0.04, 0.18], [A * 0.61, 0.2, 0.04, 0.18]],
];

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-tanks',
    cfg: { to: '5' },
    rules: [
      'Sağ ve sol tuşları tankını döndürür, yukarı ileri, aşağı geri götürür. Shift ateş eder.',
      'Kalp mermileri duvarlardan seker. Rakibe değen mermi turu kazandırır.',
      'Dikkat: seken mermi seni de vurabilir! İlk hedefe ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Tur Alan Kazanır', segHTML('to', [['3', '3'], ['5', '5'], ['7', '7']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-ates', 'point'],
    tie: 'Berabere!',
    mid: (cfg) => `${cfg.to} turda biter`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.to = Number(cfg.to);
  m.round = 0;
  m.shots = [0, 0];
  m.self = [0, 0];
  ctx.loop((dt) => draw(ctx, dt));
  await round(ctx, true);
}

async function round(ctx, first = false) {
  const { m } = ctx;
  if (m.over) return;
  m.round++;
  const A = ctx.W / ctx.H || 16 / 9;
  m.A = A;
  m.walls = pick(LAYOUTS)(A);
  m.bullets = [];
  m.running = false;
  m.t = [0, 1].map((side) => ({ i: ctx.playerAt(side), x: side === 0 ? 0.12 : A - 0.12, y: 0.5, a: side === 0 ? 0 : Math.PI, cool: 0, dead: false, tread: 0 }));
  scoreboard.setMid(`Tur ${m.round}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${first ? controlsHTML(ctx) : html`<div class="hud-card"><h2 class="t-big">Tur ${m.round}</h2></div>`}</div>
    <div class="hud-bottom"></div>`);
  await ctx.countdown(scene, { final: 'Ateş!', voice: first ? 'go-ates' : null });
  if (!ctx.life.alive || m.over) return;
  const top = scene.querySelector('.hud-top');
  if (top) top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  m.running = true;
}

const inWall = (m, x, y, r) => {
  if (x < r || y < r || x > m.A - r || y > 1 - r) return true;
  return m.walls.some(([wx, wy, ww, wh]) => x + r > wx && x - r < wx + ww && y + r > wy && y - r < wy + wh);
};

function draw(ctx, dt) {
  const { m, g, W, H, fx } = ctx;
  if (!m.t) return;
  if (m.running && dt > 0) {
    for (const tk of m.t) {
      if (tk.dead) continue;
      const inp = ctx.input(tk.i);
      tk.a += inp.x * TURN * dt;
      const sp = -inp.y * SPEED * dt;
      const nx = tk.x + Math.cos(tk.a) * sp;
      const ny = tk.y + Math.sin(tk.a) * sp;
      if (!inWall(m, nx, tk.y, TR)) tk.x = nx;
      if (!inWall(m, tk.x, ny, TR)) tk.y = ny;
      if (sp) tk.tread += Math.abs(sp) * 60;
      tk.cool = Math.max(0, tk.cool - dt);
      if (ctx.hit(tk.i, 'act') && tk.cool <= 0 && m.bullets.filter((b) => b.from === tk.i).length < 3) {
        tk.cool = 0.35;
        m.shots[tk.i]++;
        const bx = tk.x + Math.cos(tk.a) * (TR + BR + 0.008);
        const by = tk.y + Math.sin(tk.a) * (TR + BR + 0.008);
        if (!inWall(m, bx, by, BR)) {
          m.bullets.push({ from: tk.i, x: bx, y: by, vx: Math.cos(tk.a) * BSPEED, vy: Math.sin(tk.a) * BSPEED, life: 4, bounces: BOUNCES, safe: 0.12 });
          sfx.zap();
        }
      }
    }
    for (const b of m.bullets) {
      b.life -= dt;
      b.safe -= dt;
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const nx = b.x + (b.vx * dt) / steps;
        if (inWall(m, nx, b.y, BR)) {
          b.vx = -b.vx;
          b.bounces--;
          sfx.pop(0.6);
        } else b.x = nx;
        const ny = b.y + (b.vy * dt) / steps;
        if (inWall(m, b.x, ny, BR)) {
          b.vy = -b.vy;
          b.bounces--;
          sfx.pop(0.6);
        } else b.y = ny;
      }
      for (const tk of m.t) {
        if (tk.dead || (tk.i === b.from && b.safe > 0)) continue;
        if (Math.hypot(tk.x - b.x, tk.y - b.y) < TR + BR) {
          tk.dead = true;
          b.life = 0;
          if (tk.i === b.from) m.self[tk.i]++;
          fx.burst(tk.x * H, tk.y * H, { n: 34, colors: [PCOL[tk.i], '#ff5fa2', '#fff'], power: 520, shape: 'heart' });
          sfx.boom();
          ctx.shake(10);
        }
      }
    }
    m.bullets = m.bullets.filter((b) => b.life > 0 && b.bounces >= 0);
    const dead = m.t.filter((tk) => tk.dead);
    if (dead.length) endRound(ctx, dead);
  }
  g.fillStyle = '#fff6ea';
  g.fillRect(0, 0, W, H);
  for (const [x, y, w, h] of m.walls) {
    roundRect(g, x * H, y * H, w * H, h * H, 6);
    g.fillStyle = '#a98bff';
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  g.lineWidth = 6;
  g.strokeStyle = '#2a1636';
  g.strokeRect(3, 3, W - 6, H - 6);
  for (const b of m.bullets) {
    heartPath(g, b.x * H, b.y * H + BR * H * 0.2, BR * H * 1.3);
    g.fillStyle = PCOL[b.from];
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  for (const tk of m.t) {
    if (tk.dead) continue;
    const x = tk.x * H;
    const y = tk.y * H;
    const r = TR * H;
    g.save();
    g.translate(x, y);
    g.rotate(tk.a);
    roundRect(g, -r, -r * 0.85, r * 2, r * 1.7, r * 0.4);
    g.fillStyle = PCOL[tk.i];
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.fillStyle = '#2a1636';
    for (let k = -2; k <= 2; k++) {
      const off = ((tk.tread + k * 6) % 12) - 6;
      g.fillRect(off * r * 0.12, -r * 0.95, 2, r * 0.25);
      g.fillRect(off * r * 0.12, r * 0.7, 2, r * 0.25);
    }
    roundRect(g, 0, -r * 0.18, r * 1.4, r * 0.36, 4);
    g.fill();
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.stroke();
    g.restore();
    tag(g, x, y - r - 18, nameOf(tk.i), PCOL[tk.i], 13);
  }
  fx.draw(g, dt);
}

function endRound(ctx, dead) {
  const { m, fx, W, H } = ctx;
  m.running = false;
  if (dead.length === 2) {
    fx.text(W / 2, H * 0.3, 'İkiniz de vuruldunuz!', '#a99cb3', 30);
    ctx.life.timeout(() => round(ctx), 1800);
    return;
  }
  const w = m.t.find((tk) => !tk.dead).i;
  announcer.react('point');
  ctx.score(w, 1, W / 2, H * 0.3);
  fx.text(W / 2, H * 0.3, `${nameOf(w)} turu aldı!`, PCOL[w], 32);
  if (ctx.pts[w] >= m.to) {
    sfx.whistle();
    ctx.life.timeout(() => ctx.finish({ stats: [0, 1].map((i) => html`<span><b>${ctx.pts[i]}</b> tur</span><span><b>${m.shots[i]}</b> atış</span><span><b>${m.self[i]}</b> kendini vurdu</span>`) }), 1500);
    return;
  }
  ctx.life.timeout(() => round(ctx), 1800);
}
