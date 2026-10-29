// Yumak Yarışı: iki kedi yavrusu, arkalarında açılan yün ipliği. Yön tuşlarıyla dön,
// kimsenin ipliğine ve duvara çarpma. Önce çarpan turu kaybeder. Shift ile bir kez ipliğin üstünden zıplarsın

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL, tag, roundRect } from './keyarena.js';

const COLS = 64;
const ROWS = 36;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-yarn',
    cfg: { to: '3' },
    rules: [
      'İki kedi yavrusu koşuyor, arkalarında yün ipliği açılıyor. Yön tuşlarıyla dönersin.',
      'Duvara, kendi ipliğine ya da partnerinin ipliğine çarpan turu kaybeder.',
      'Her turda bir kez Shift ile ipliğin üstünden zıplayabilirsin. İlk hedefe ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Tur Alan Kazanır', segHTML('to', [['2', '2'], ['3', '3'], ['5', '5']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-kos', 'crash', 'point'],
    tie: 'Berabere! Yumaklar Eşit',
    mid: (cfg) => `${cfg.to} turda biter`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.to = Number(cfg.to);
  m.round = 0;
  m.cells = 0;
  ctx.loop((dt) => draw(ctx, dt));
  await round(ctx, true);
}

async function round(ctx, first = false) {
  const { m } = ctx;
  if (m.over) return;
  m.round++;
  m.grid = new Int8Array(COLS * ROWS).fill(-1);
  m.running = false;
  m.acc = 0;
  m.speed = 11;
  m.k = [0, 1].map((side) => {
    const i = ctx.playerAt(side);
    const x = side === 0 ? 12 : COLS - 13;
    return { i, x, y: Math.floor(ROWS / 2), dir: side === 0 ? 'right' : 'left', next: side === 0 ? 'right' : 'left', dead: false, jump: 1, air: 0, trail: [[x, Math.floor(ROWS / 2)]] };
  });
  scoreboard.setMid(`Tur ${m.round}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${first ? controlsHTML(ctx) : html`<div class="hud-card"><h2 class="t-big">Tur ${m.round}</h2></div>`}</div>
    <div class="hud-bottom"></div>`);
  await ctx.countdown(scene, { final: 'Koş!', voice: first ? 'go-kos' : null });
  if (!ctx.life.alive || m.over) return;
  const top = scene.querySelector('.hud-top');
  if (top) top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  m.running = true;
}

function draw(ctx, dt) {
  const { m, g, W, H, fx } = ctx;
  if (!m.k) return;
  const cw = W / COLS;
  const ch = H / ROWS;
  if (m.running && dt > 0) {
    // Yön: ters yöne dönülmez; bir sonraki adımda uygulanır
    for (const k of m.k) {
      for (const d of ['up', 'down', 'left', 'right']) {
        if (ctx.hit(k.i, d)) {
          const [dx, dy] = DIRS[d];
          const [cx, cy] = DIRS[k.dir];
          if (dx !== -cx || dy !== -cy) k.next = d;
        }
      }
      if (ctx.hit(k.i, 'act') && k.jump > 0 && !k.air) {
        k.jump--;
        k.air = 3;
        sfx.rise(0.3);
      }
    }
    m.speed = Math.min(20, m.speed + dt * 0.35);
    m.acc += dt * m.speed;
    while (m.acc >= 1 && m.running) {
      m.acc -= 1;
      step(ctx);
    }
  }
  // Zemin ve ızgara noktaları
  roundRect(g, 0, 0, W, H, 0);
  g.fillStyle = '#fff6ea';
  g.fill();
  g.fillStyle = '#2a163614';
  for (let x = 0; x < COLS; x += 2) for (let y = 0; y < ROWS; y += 2) g.fillRect(x * cw + cw / 2 - 1, y * ch + ch / 2 - 1, 2, 2);
  // İplikler
  for (const k of m.k) {
    g.beginPath();
    k.trail.forEach(([x, y], n) => {
      const px = x * cw + cw / 2;
      const py = y * ch + ch / 2;
      if (n) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.min(cw, ch) * 0.8 + 4;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.lineWidth = Math.min(cw, ch) * 0.8;
    g.strokeStyle = PCOL[k.i];
    g.stroke();
    g.setLineDash([4, 6]);
    g.lineWidth = 2;
    g.strokeStyle = '#ffffff99';
    g.stroke();
    g.setLineDash([]);
  }
  // Kedi kafaları
  for (const k of m.k) {
    const px = k.x * cw + cw / 2;
    const py = k.y * ch + ch / 2 - (k.air ? ch * 0.8 : 0);
    const r = Math.min(cw, ch) * 1.25;
    g.save();
    g.translate(px, py);
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(d * r * 0.3, -r * 0.6);
      g.lineTo(d * r * 0.85, -r * 1.15);
      g.lineTo(d * r * 0.95, -r * 0.3);
      g.closePath();
      g.fillStyle = PCOL[k.i];
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#2a1636';
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = k.dead ? '#a99cb3' : PCOL[k.i];
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    const [dx, dy] = DIRS[k.dir];
    for (const e of [-1, 1]) {
      g.beginPath();
      g.arc(dx * r * 0.3 + e * r * 0.35 * (dy ? 1 : 0.6), dy * r * 0.3 - r * 0.1 + (dx ? e * r * 0.12 : 0), r * 0.16, 0, Math.PI * 2);
      g.fillStyle = '#2a1636';
      g.fill();
    }
    g.restore();
    if (!m.running && !k.dead) tag(g, px, py - r * 2, nameOf(k.i), PCOL[k.i], 14);
    if (k.jump > 0 && m.running) {
      g.beginPath();
      g.arc(px, py + r * 1.6, 4, 0, Math.PI * 2);
      g.fillStyle = '#ffcd3c';
      g.fill();
    }
  }
  fx.draw(g, dt);
}

function step(ctx) {
  const { m } = ctx;
  const moves = m.k.map((k) => {
    k.dir = k.next;
    const [dx, dy] = DIRS[k.dir];
    return [k.x + dx, k.y + dy];
  });
  const crash = [false, false];
  m.k.forEach((k, n) => {
    const [x, y] = moves[n];
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) crash[n] = true;
    else if (!k.air && m.grid[y * COLS + x] >= 0) crash[n] = true;
  });
  // Kafa kafaya
  if (moves[0][0] === moves[1][0] && moves[0][1] === moves[1][1]) {
    crash[0] = true;
    crash[1] = true;
  }
  m.k.forEach((k, n) => {
    if (crash[n]) return;
    const [x, y] = moves[n];
    if (!k.air) m.grid[k.y * COLS + k.x] = k.i;
    k.x = x;
    k.y = y;
    if (k.air) k.air--;
    k.trail.push([x, y]);
  });
  if (crash[0] || crash[1]) endRound(ctx, crash);
}

function endRound(ctx, crash) {
  const { m, fx, W, H } = ctx;
  m.running = false;
  const cw = W / COLS;
  const ch = H / ROWS;
  m.k.forEach((k, n) => {
    if (!crash[n]) return;
    k.dead = true;
    fx.burst(k.x * cw, k.y * ch, { n: 26, colors: [PCOL[k.i], '#fff', '#ffcd3c'], power: 420, shape: 'star' });
  });
  sfx.thud(1.3);
  sfx.boing();
  ctx.shake(8);
  announcer.react('crash');
  const alive = m.k.filter((k, n) => !crash[n]);
  if (alive.length === 1) {
    const w = alive[0].i;
    ctx.score(w, 1, W / 2, H / 2);
    fx.text(W / 2, H * 0.4, `${nameOf(w)} turu aldı!`, PCOL[w], 32);
    if (ctx.pts[w] >= m.to) {
      sfx.whistle();
      ctx.life.timeout(() => ctx.finish({ stats: [0, 1].map((i) => html`<span><b>${ctx.pts[i]}</b> tur</span>`) }), 1500);
      return;
    }
  } else fx.text(W / 2, H * 0.4, 'İkiniz de çarptınız!', '#a99cb3', 30);
  ctx.life.timeout(() => round(ctx), 1800);
}
