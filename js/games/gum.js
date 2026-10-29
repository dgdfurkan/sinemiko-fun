// Sakız Balonu: dudaklarını büzdükçe balon şişer, bırakınca o boyda kalır.
// Her balonun gizli bir patlama sınırı var: fazla şişirirsen yüzüne yapışır, o tur puan yok. Cesaret ve şans oyunu

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, puckerOf, mouthOf, PCOL, tag, missingText, hideTop } from './arena.js';

const ROUND_SEC = 9;
const GROW = 0.24;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-gum',
    kind: 'face',
    noBig: true,
    cfg: { rounds: '5' },
    rules: [
      'Dudaklarını büz: sakız balonun şişer. Dudaklarını bıraktığın an balon o boyda kalır.',
      html`Balon ne kadar büyükse o kadar puan, en fazla <b>10</b>. Ama her balonun gizli bir patlama sınırı var.`,
      'Sınırı geçersen balon yüzünde patlar, o tur puan yok. Ne zaman duracağını sen seç!',
    ],
    options: (cfg) => optHTML('Tur', segHTML('rounds', [['3', '3'], ['5', '5'], ['7', '7']], cfg.rounds)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="rounds"]'), { value: cfg.rounds, onChange: (v) => { cfg.rounds = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Sakızlar Ağızda',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-sakiz', 'pop-gum', 'safe'],
    tie: 'Berabere! Balonlar Eşit',
    albumTitle: 'Sakız Balonu',
    mid: (cfg) => `Tur 1 / ${cfg.rounds}`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.rounds = Number(cfg.rounds);
  m.round = 0;
  m.base = [0.1, 0.1];
  m.b = [null, null];
  m.pops = [0, 0];
  m.bestSize = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Sakızlar Ağızda</h2><p class="hud-tip">Büz, şişir, patlamadan bırak.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${ROUND_SEC}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  m.clockEl = scene.querySelector('[data-clock]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    if (!m.running) return;
    players.forEach((p, i) => {
      const b = m.b[i];
      if (!p || !b || (b.state !== 'blow' && b.state !== 'ready')) return;
      const on = Math.max(0.32, m.base[i] + 0.2);
      const puck = puckerOf(p) > on;
      if (puck) {
        b.state = 'blow';
        b.size += GROW * dt * (1 + b.size * 0.6);
        if (b.size >= b.limit) pop(ctx, i);
        else if (Math.random() < dt * 6) sfx.pop(0.5 + b.size);
      } else if (b.state === 'blow' && puckerOf(p) < on - 0.08) {
        keep(ctx, i);
      }
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Şişir!', voice: 'go-sakiz', measure: (p) => ({ v: puckerOf(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => clamp(b ? b.v : 0.1, 0, 0.4));
  hideTop(scene);
  startRound(ctx);
}

function startRound(ctx) {
  const { m } = ctx;
  m.round++;
  scoreboard.setMid(`Tur ${m.round} / ${m.rounds}`);
  // Sınır çoğu zaman cömert, arada bir erken patlar
  const limit = () => clamp(Math.random() < 0.2 ? rand(0.3, 0.55) : rand(0.55, 1.02), 0.3, 1);
  m.b = [0, 1].map(() => ({ size: 0, limit: limit(), state: 'ready', wob: rand(0, 6), splat: [] }));
  m.running = true;
  m.clock = ctx.clock(m.clockEl, ROUND_SEC, { onEnd: () => endRound(ctx) });
}

function keep(ctx, i) {
  const { m } = ctx;
  const b = m.b[i];
  b.state = 'kept';
  sfx.ding();
  if (m.b.every((x) => x.state === 'kept' || x.state === 'popped')) {
    m.clock.stop();
    ctx.life.timeout(() => endRound(ctx), 600);
  }
}

function pop(ctx, i) {
  const { m, cam, fx } = ctx;
  const b = m.b[i];
  b.state = 'popped';
  b.size = Math.min(b.size, 1);
  m.pops[i]++;
  const p = cam.players[i];
  sfx.splat();
  sfx.boom();
  announcer.react('pop-gum');
  ctx.shake(7);
  if (p) {
    const mo = mouthOf(p);
    fx.burst(mo.x * cam.W, mo.y * cam.H, { n: 34, colors: ['#ff8cc0', '#ff5fa2', '#ffd1e6'], power: 520 });
    // Yüze yapışan sakız lekeleri: yüz kutusuna göre
    for (let k = 0; k < 7; k++) b.splat.push({ u: rand(0.15, 0.85), v: rand(0.35, 0.95), r: rand(0.07, 0.15) });
    ctx.shoot(i, 'Yüzünde patladı!', {
      pad: 0.4,
      force: true,
      decorate: (og, map) => {
        const bx = p.box;
        for (const s of b.splat) {
          const [x, y] = map(bx.x + s.u * bx.w, bx.y + s.v * bx.h);
          const [x2] = map(bx.x + (s.u + s.r) * bx.w, bx.y);
          blob(og, x, y, Math.abs(x2 - x));
        }
      },
    });
  }
  if (m.b.every((x) => x.state === 'kept' || x.state === 'popped')) {
    m.clock.stop();
    ctx.life.timeout(() => endRound(ctx), 900);
  }
}

function blob(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const rr = r * (0.8 + 0.25 * Math.sin(k * 2.3));
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#ff8cc0ee';
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = '#c2457a';
  g.stroke();
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  players.forEach((p, i) => {
    const b = m.b[i];
    if (!p || !b) return;
    const mo = mouthOf(p);
    const fw = p.box.w * W;
    if (b.state === 'popped') {
      const bx = p.box;
      for (const s of b.splat) blob(g, (bx.x + s.u * bx.w) * W, (bx.y + s.v * bx.h) * H, s.r * bx.w * W);
    } else if (b.size > 0.01) {
      const r = fw * (0.08 + b.size * 0.62) * (1 + Math.sin(t / 110 + b.wob) * 0.025);
      const x = mo.x * W;
      const y = mo.y * H + r * 0.15;
      g.globalAlpha = 0.82;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      gr.addColorStop(0, '#ffe3f0');
      gr.addColorStop(1, '#ff7fb6');
      g.fillStyle = gr;
      g.fill();
      g.globalAlpha = 1;
      g.lineWidth = 3.5;
      g.strokeStyle = '#c2457a';
      g.stroke();
      g.beginPath();
      g.ellipse(x - r * 0.38, y - r * 0.4, r * 0.16, r * 0.26, -0.6, 0, Math.PI * 2);
      g.fillStyle = '#ffffffcc';
      g.fill();
      if (b.state === 'kept') tag(g, x, y + r + 20, `${Math.round(b.size * 10)} puan`, PCOL[i], 16);
    }
    tag(g, p.box.cx * W, Math.max(18, p.box.y * H - 22), nameOf(i), PCOL[i], 14);
  });
  fx.draw(g, dt);
}

function endRound(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  m.b.forEach((b, i) => {
    if (b.state === 'blow' || b.state === 'ready') b.state = 'kept';
    if (b.state === 'kept') {
      const pts = Math.round(b.size * 10);
      m.bestSize[i] = Math.max(m.bestSize[i], pts);
      const p = ctx.cam.players[i];
      if (pts > 0) ctx.score(i, pts, p ? p.box.cx : 0.5, p ? p.box.cy : 0.5);
      if (pts >= 8) ctx.shoot(i, `Dev balon: ${pts}`, { pad: 0.4 });
    }
  });
  if (m.b.some((b) => b.state === 'kept' && b.size > 0.7)) announcer.react('safe');
  ctx.life.timeout(() => {
    if (m.over) return;
    if (m.round >= m.rounds) end(ctx);
    else startRound(ctx);
  }, 2300);
}

function end(ctx) {
  const { m } = ctx;
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.bestSize[i]}</b> en büyük balon</span><span><b>${m.pops[i]}</b> kez patladı</span>`),
    });
  }, 600);
}
