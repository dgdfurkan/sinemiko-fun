// Öpücük Savaşı: dudaklarını büz, bırakınca karşıya öpücük uçar. Değdiği yerde ruj izi kalır.
// Uzun büzersen kocaman öpücük gider. Başını oynatıp kaçabilir, aynı anda öpücük atıp havada çarpıştırabilirsin

import { html, rand, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, puckerOf, mouthOf, heartPath, inked, PCOL, missingText, hideTop } from './arena.js';
import { drawFaceFrame } from './cam.js';

const BIG_AT = 0.7;
const LIPS = ['#e8336d', '#d61f5b', '#ff4f8b'];

// Ruj izi: iki dudak, ortada çizgi
export function lips(g, x, y, s, rot, color, alpha = 0.9) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = alpha;
  g.beginPath();
  g.moveTo(-s, 0);
  g.bezierCurveTo(-s * 0.7, -s * 0.62, -s * 0.25, -s * 0.62, 0, -s * 0.28);
  g.bezierCurveTo(s * 0.25, -s * 0.62, s * 0.7, -s * 0.62, s, 0);
  g.bezierCurveTo(s * 0.6, s * 0.75, -s * 0.6, s * 0.75, -s, 0);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.85, 0.02 * s);
  g.quadraticCurveTo(0, s * 0.16, s * 0.85, 0.02 * s);
  g.lineWidth = Math.max(1.5, s * 0.1);
  g.strokeStyle = '#7a0f35';
  g.stroke();
  g.restore();
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-kiss',
    kind: 'face',
    cfg: { to: '7' },
    rules: [
      'Dudaklarını büz, sonra bırak: partnerine bir öpücük uçar. Ne kadar uzun büzersen o kadar büyük gider.',
      html`Yüzüne değen öpücük ruj izi bırakır. Küçük öpücük <b>+1</b>, kocaman öpücük <b>+2</b>.`,
      'Başını oynatıp kaç ya da sen de öpücük at: havada çarpışan öpücükler birbirini yok eder.',
    ],
    options: (cfg) => optHTML('Kaç Puanda Biter', segHTML('to', [['5', '5 Puan'], ['7', '7 Puan'], ['10', '10 Puan']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Dudaklar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-opucuk', 'kiss-hit', 'kiss-clash'],
    tie: 'Berabere! Öpücükler Eşit',
    albumTitle: 'Öpücük Haritası',
    mid: (cfg) => `${cfg.to} puanda biter`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.to = Number(cfg.to);
  m.base = [0.1, 0.1];
  m.charge = [0, 0];
  m.puck = [false, false];
  m.cool = [0, 0];
  m.shots = [];
  m.marks = [[], []];
  m.sent = [0, 0];
  m.hits = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Dudaklar Büzülsün</h2><p class="hud-tip">Büz, bekle, bırak: öpücük uçar.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    if (m.running) players.forEach((p, i) => { if (p) aim(ctx, p, i, dt, now); });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Öp!', voice: 'go-opucuk', measure: (p) => ({ v: puckerOf(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => clamp(b ? b.v : 0.1, 0, 0.45));
  hideTop(scene);
  m.running = true;
}

// Büzme eşiği kişiye göre: düz yüzündeki değerin belirgin üstü
function aim(ctx, p, i, dt, now) {
  const { m } = ctx;
  const v = puckerOf(p);
  const on = Math.max(0.38, m.base[i] + 0.25);
  if (!m.puck[i] && v > on) {
    m.puck[i] = true;
    m.charge[i] = 0;
  } else if (m.puck[i] && v < on - 0.1) {
    m.puck[i] = false;
    if (m.charge[i] >= 0.1 && now >= m.cool[i]) fire(ctx, p, i, m.charge[i] >= BIG_AT);
    m.charge[i] = 0;
  }
  if (m.puck[i]) m.charge[i] += dt;
}

function fire(ctx, p, i, big) {
  const { m, cam } = ctx;
  const mo = mouthOf(p);
  const dir = cam.sideOf(i);
  m.cool[i] = performance.now() + 350;
  m.sent[i]++;
  m.shots.push({ from: i, x: mo.x, y: mo.y, vx: dir * (big ? 0.5 : 0.66), big, t0: performance.now(), wob: rand(0, 6), dead: false });
  if (big) sfx.whoosh();
  else sfx.pop(1.5);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  // Yüzler ve üstlerindeki ruj izleri
  players.forEach((p, i) => {
    if (!p) return;
    const ch = m.charge[i];
    drawFaceFrame(g, cam, p, i, { glow: m.puck[i] ? clamp(ch / BIG_AT, 0.3, 1) : 0.15 });
    const b = p.box;
    for (const mk of m.marks[i]) lips(g, (b.x + mk.u * b.w) * W, (b.y + mk.v * b.h) * H, mk.s * b.w * W, mk.rot, mk.c);
    if (m.puck[i]) {
      // Dolan öpücük: dudakların önünde büyüyen kalp
      const mo = mouthOf(p);
      const s = (0.012 + clamp(ch / BIG_AT, 0, 1) * 0.022) * H * (1 + 0.08 * Math.sin(t / 70));
      heartPath(g, mo.x * W + cam.sideOf(i) * 30, mo.y * H, s);
      inked(g, ch >= BIG_AT ? '#ff2d6f' : '#ff8cc0', 3);
    }
  });
  // Uçan öpücükler
  for (const s of m.shots) {
    if (s.dead) continue;
    s.x += s.vx * dt;
    const age = (performance.now() - s.t0) / 1000;
    const y = s.y + Math.sin(age * 9 + s.wob) * 0.012;
    const size = (s.big ? 0.06 : 0.034) * H;
    // Hedef yüz
    const target = 1 - s.from;
    const p = players[target];
    if (p && m.running) {
      const b = p.box;
      const inX = s.x > b.x + b.w * 0.08 && s.x < b.x + b.w * 0.92;
      const inY = y > b.y + b.h * 0.05 && y < b.y + b.h * 0.98;
      if (inX && inY) {
        land(ctx, s, p, target, y);
        continue;
      }
    }
    if (s.x < -0.1 || s.x > 1.1) {
      s.dead = true;
      continue;
    }
    heartPath(g, s.x * W, y * H, size);
    inked(g, s.big ? '#ff2d6f' : '#ff6fae', 3.5);
    g.globalAlpha = 0.35;
    heartPath(g, (s.x - s.vx * 0.05) * W, y * H, size * 0.8);
    g.fillStyle = '#ffc6dd';
    g.fill();
    g.globalAlpha = 1;
  }
  // Havada çarpışma: karşı yönlü iki öpücük üst üste gelirse ikisi de patlar
  for (const a of m.shots) {
    if (a.dead || a.from !== 0) continue;
    for (const b of m.shots) {
      if (b.dead || b.from !== 1) continue;
      const ya = a.y;
      const yb = b.y;
      if (Math.abs(a.x - b.x) < 0.035 && Math.abs(ya - yb) < (a.big || b.big ? 0.09 : 0.06)) {
        a.dead = true;
        b.dead = true;
        const x = ((a.x + b.x) / 2) * W;
        const y = ((ya + yb) / 2) * H;
        sfx.sparkle();
        announcer.react('kiss-clash');
        fx.burst(x, y, { n: 26, colors: ['#ff5fa2', '#ffc6dd', '#fff'], power: 380, shape: 'heart' });
        fx.text(x, y - 40, 'Öpücükler Çarpıştı!', '#ff5fa2', 20);
      }
    }
  }
  m.shots = m.shots.filter((s) => !s.dead);
  fx.draw(g, dt);
}

function land(ctx, s, p, target, y) {
  const { m, cam, fx } = ctx;
  s.dead = true;
  const b = p.box;
  const pts = s.big ? 2 : 1;
  m.hits[s.from]++;
  // İz, yüzün içinde değdiği yere; sınırdan biraz içeri çekilir
  const u = clamp((s.x - b.x) / b.w, 0.18, 0.82);
  const v = clamp((y - b.y) / b.h, 0.2, 0.85);
  if (m.marks[target].length > 24) m.marks[target].shift();
  m.marks[target].push({ u, v, s: s.big ? 0.2 : 0.13, rot: rand(-0.6, 0.6), c: LIPS[Math.floor(Math.random() * LIPS.length)] });
  const x = (b.x + u * b.w) * cam.W;
  const yy = (b.y + v * b.h) * cam.H;
  sfx.heart();
  if (s.big) {
    sfx.success();
    ctx.shake(5);
  }
  announcer.react('kiss-hit');
  fx.burst(x, yy, { n: s.big ? 24 : 14, colors: ['#ff5fa2', '#ff2d6f', '#fff'], power: s.big ? 360 : 240, shape: 'heart' });
  fx.text(x, yy - 50, s.big ? 'Kocaman Öpücük! +2' : 'Muck! +1', PCOL[s.from], s.big ? 22 : 20);
  ctx.score(s.from, pts, x / cam.W, yy / cam.H, { quiet: true });
  if (ctx.pts[s.from] >= m.to) end(ctx);
}

function end(ctx) {
  const { m, cam } = ctx;
  if (!m.running) return;
  m.running = false;
  scoreboard.setMid('Bitti');
  sfx.whistle();
  // Final albümü: ruj izli yüzler
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => {
      const marks = m.marks[i].slice();
      ctx.shoot(i, marks.length ? `${marks.length} Ruj İzi` : 'Tertemiz Kaçtı', {
        pad: 0.4,
        force: true,
        decorate: (og, map) => {
          const p = cam.players[i];
          if (!p) return;
          const b = p.box;
          for (const mk of marks) {
            const [x, y] = map(b.x + mk.u * b.w, b.y + mk.v * b.h);
            const [x2] = map(b.x + mk.u * b.w + mk.s * b.w, b.y);
            lips(og, x, y, Math.abs(x2 - x), mk.rot, mk.c, 0.88);
          }
        },
      });
    });
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.sent[i]}</b> öpücük attı</span><span><b>${m.hits[i]}</b> isabet</span><span><b>${m.marks[i].length}</b> ruj izi aldı</span>`),
    });
  }, 1200);
}
