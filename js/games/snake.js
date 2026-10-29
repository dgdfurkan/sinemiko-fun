// Kafa Yılanı: yılanın burnunun gösterdiği yere süzülür. Kalpleri ye, uzun ol.
// Rakibin gövdesine kafa atarsan kalp dökersin. Altın kalp +3, kurt bombası -2

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, heartPath, inked, PCOL, tag, missingText, hideTop } from './arena.js';

const GX = 5.5;
const GY = 6.5;
const SPEED = 0.3;
const SEG = 0.022;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-snake',
    kind: 'face',
    cfg: { secs: '45' },
    rules: [
      'Yılanın burnunun gösterdiği yere süzülür. Başını çevirdiğin yöne döner.',
      html`Kalpleri ye, büyü. Altın kalp <b>+3</b>, bomba <b>-2</b>.`,
      'Rakibin gövdesine kafa atarsan kalp dökersin, o da toplayabilir. Süre bitince en çok kalp yiyen kazanır.',
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Yılanlar Uyanıyor',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-yilan', 'gold', 'crash', 'timeup'],
    tie: 'Berabere! Yılanlar Eşit',
    albumTitle: 'Kafa Yılanı',
    mid: (cfg) => `${cfg.secs} sn`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.base = [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }];
  m.aim = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
  m.snakes = [0, 1].map((i) => {
    const x = i === cam.leftIs ? 0.25 : 0.75;
    const body = [];
    for (let k = 0; k < 8; k++) body.push({ x: x, y: 0.55 + k * SEG });
    return { body, len: 8, dir: -Math.PI / 2, ghost: 0, eaten: 0, crashes: 0, tongue: 0 };
  });
  m.food = [];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Yılanlar Uyanıyor</h2><p class="hud-tip">Başını çevir, yılan o yöne gitsin.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p) return;
      const n = noseOf(p);
      const cx = i === cam.leftIs ? 0.3 : 0.7;
      m.aim[i] = { x: clamp(cx + (n.x - m.base[i].x) * GX, 0.02, 0.98), y: clamp(0.5 + (n.y - m.base[i].y) * GY, 0.04, 0.96) };
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  for (let k = 0; k < 6; k++) addFood(m);
  const base = await ctx.countdown(scene, { final: 'Kay!', voice: 'go-yilan', measure: (p) => { const n = noseOf(p); return { x: n.x, y: n.y }; } });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => b || m.base[i]);
  hideTop(scene);
  m.running = true;
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

function addFood(m, x = rand(0.06, 0.94), y = rand(0.1, 0.92), kind = null) {
  const r = Math.random();
  m.food.push({ x, y, kind: kind || (r < 0.1 ? 'gold' : r < 0.2 ? 'bomb' : 'heart'), t0: performance.now(), wob: rand(0, 6) });
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const AR = W / H;
  const now = ctx.now();
  if (m.running && dt > 0) {
    m.snakes.forEach((s, i) => {
      const head = s.body[0];
      // Kafa hedefe doğru döner; dönüş hızı sınırlı, kıvrılarak gider
      const want = Math.atan2(m.aim[i].y - head.y, (m.aim[i].x - head.x) * AR);
      const near = Math.hypot((m.aim[i].x - head.x) * AR, m.aim[i].y - head.y) < 0.03;
      let d = want - s.dir;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (!near) s.dir += clamp(d, -4.2 * dt, 4.2 * dt);
      const sp = SPEED * (cam.visible(i, 600) ? 1 : 0.35);
      let nx = head.x + (Math.cos(s.dir) * sp * dt) / AR;
      let ny = head.y + Math.sin(s.dir) * sp * dt;
      // Kenardan sekip içeri döner
      if (nx < 0.01 || nx > 0.99) { s.dir = Math.PI - s.dir; nx = clamp(nx, 0.01, 0.99); }
      if (ny < 0.03 || ny > 0.97) { s.dir = -s.dir; ny = clamp(ny, 0.03, 0.97); }
      s.travel = (s.travel || 0) + Math.hypot((nx - head.x) * AR, ny - head.y);
      head.x = nx;
      head.y = ny;
      // Gövde başı izler: her parça öncekine sabit aralıkla bağlı
      for (let k = 1; k < s.body.length; k++) {
        const a = s.body[k - 1];
        const b = s.body[k];
        const dx = (b.x - a.x) * AR;
        const dy = b.y - a.y;
        const dd = Math.hypot(dx, dy) || 1e-6;
        if (dd > SEG) {
          b.x = a.x + ((dx / dd) * SEG) / AR;
          b.y = a.y + (dy / dd) * SEG;
        }
      }
      while (s.body.length < s.len) s.body.push({ ...s.body[s.body.length - 1] });
      while (s.body.length > s.len) s.body.pop();
      // Yemek
      for (const f of m.food) {
        if (f.dead) continue;
        if (Math.hypot((f.x - head.x) * AR, f.y - head.y) < 0.045) {
          f.dead = true;
          eat(ctx, i, f);
        }
      }
      // Rakibin gövdesine çarpma
      const o = m.snakes[1 - i];
      if (now > s.ghost && now > o.ghost) {
        for (let k = 2; k < o.body.length; k++) {
          const b = o.body[k];
          if (Math.hypot((b.x - head.x) * AR, b.y - head.y) < 0.024) {
            crash(ctx, i);
            break;
          }
        }
      }
      s.tongue = Math.max(0, s.tongue - dt);
    });
    m.food = m.food.filter((f) => !f.dead);
    while (m.food.filter((f) => f.kind !== 'bomb').length < 6) addFood(m);
  }
  // Yemekler
  for (const f of m.food) {
    const x = f.x * W;
    const y = f.y * H + Math.sin(t / 260 + f.wob) * 3;
    const s = H * (f.kind === 'gold' ? 0.03 : 0.024);
    if (f.kind === 'bomb') {
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      inked(g, '#3a2d5c', 3);
      g.beginPath();
      g.moveTo(x + s * 0.5, y - s * 0.8);
      g.quadraticCurveTo(x + s, y - s * 1.6, x + s * 1.4, y - s * 1.2);
      g.lineWidth = 3;
      g.strokeStyle = '#2a1636';
      g.stroke();
      if (Math.sin(t / 60) > 0) {
        g.beginPath();
        g.arc(x + s * 1.4, y - s * 1.2, 4, 0, Math.PI * 2);
        g.fillStyle = '#ffcd3c';
        g.fill();
      }
    } else {
      heartPath(g, x, y + s * 0.2, s * 1.15);
      inked(g, f.kind === 'gold' ? '#ffcd3c' : '#ff5fa2', 3);
    }
  }
  // Yılanlar
  m.snakes.forEach((s, i) => {
    const ghost = now < s.ghost;
    const r = H * 0.022;
    g.globalAlpha = ghost ? 0.45 + 0.3 * Math.sin(t / 60) : 1;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    s.body.forEach((b, k) => (k ? g.lineTo(b.x * W, b.y * H) : g.moveTo(b.x * W, b.y * H)));
    g.lineWidth = r * 2 + 7;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.lineWidth = r * 2;
    g.strokeStyle = PCOL[i];
    g.stroke();
    // Benekler
    g.fillStyle = '#ffffff66';
    for (let k = 3; k < s.body.length; k += 3) {
      g.beginPath();
      g.arc(s.body[k].x * W, s.body[k].y * H, r * 0.35, 0, Math.PI * 2);
      g.fill();
    }
    const h = s.body[0];
    const hx = h.x * W;
    const hy = h.y * H;
    g.save();
    g.translate(hx, hy);
    g.rotate(s.dir);
    if (Math.sin(t / 140 + i) > 0.6 || s.tongue > 0) {
      g.beginPath();
      g.moveTo(r, 0);
      g.lineTo(r * 2.1, 0);
      g.lineTo(r * 2.5, -r * 0.35);
      g.moveTo(r * 2.1, 0);
      g.lineTo(r * 2.5, r * 0.35);
      g.lineWidth = 3;
      g.strokeStyle = '#ff3d5c';
      g.stroke();
    }
    g.beginPath();
    g.ellipse(0, 0, r * 1.45, r * 1.2, 0, 0, Math.PI * 2);
    inked(g, PCOL[i], 3.5);
    for (const sy of [-1, 1]) {
      g.beginPath();
      g.arc(r * 0.45, sy * r * 0.55, r * 0.42, 0, Math.PI * 2);
      inked(g, '#fff', 2.5);
      g.beginPath();
      g.arc(r * 0.6, sy * r * 0.55, r * 0.2, 0, Math.PI * 2);
      g.fillStyle = '#2a1636';
      g.fill();
    }
    if (i === 1) {
      // Sinem'in yılanında küçük bir fiyonk
      g.beginPath();
      g.moveTo(-r * 0.6, 0);
      g.lineTo(-r * 1.4, -r * 0.7);
      g.lineTo(-r * 1.4, r * 0.7);
      g.closePath();
      inked(g, '#ffcd3c', 2.5);
    }
    g.restore();
    g.globalAlpha = 1;
    tag(g, hx, hy - r * 2.6, nameOf(i), PCOL[i], 14);
    // Hedef noktası
    if (m.running) {
      const a = m.aim[i];
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(a.x * W, a.y * H, 9, 0, Math.PI * 2);
      g.lineWidth = 3;
      g.strokeStyle = PCOL[i];
      g.stroke();
      g.globalAlpha = 1;
    }
  });
  fx.draw(g, dt);
}

function eat(ctx, i, f) {
  const { m, cam, fx } = ctx;
  const s = m.snakes[i];
  const x = f.x * cam.W;
  const y = f.y * cam.H;
  s.tongue = 0.3;
  if (f.kind === 'bomb') {
    s.len = Math.max(6, s.len - 4);
    sfx.boom();
    ctx.shake(8);
    fx.burst(x, y, { n: 26, colors: ['#ffcd3c', '#ff4f62', '#3a2d5c'], power: 480 });
    fx.text(x, y - 40, 'Bum! -2', '#ff4f62', 22);
    ctx.score(i, -Math.min(2, ctx.pts[i]), f.x, f.y, { quiet: true });
    return;
  }
  const pts = f.kind === 'gold' ? 3 : 1;
  s.len += pts * 2;
  s.eaten += pts;
  sfx.chomp();
  if (f.kind === 'gold') {
    sfx.sparkle();
    announcer.react('gold');
  }
  fx.burst(x, y, { n: 12, colors: [PCOL[i], '#fff', '#ff5fa2'], shape: 'heart', power: 260 });
  fx.text(x, y - 36, `+${pts}`, PCOL[i], 20);
  ctx.score(i, pts, f.x, f.y, { quiet: true });
}

function crash(ctx, i) {
  const { m, cam, fx } = ctx;
  const s = m.snakes[i];
  const h = s.body[0];
  s.ghost = ctx.now() + 1800;
  s.crashes++;
  const lose = Math.min(3, ctx.pts[i]);
  if (lose > 0) ctx.score(i, -lose, h.x, h.y, { quiet: true });
  s.len = Math.max(6, s.len - 6);
  // Dökülen kalpler etrafa saçılır
  for (let k = 0; k < Math.max(2, lose); k++) addFood(m, clamp(h.x + rand(-0.08, 0.08), 0.05, 0.95), clamp(h.y + rand(-0.1, 0.1), 0.08, 0.92), 'heart');
  s.dir += Math.PI;
  sfx.thud(1);
  announcer.react('crash');
  ctx.shake(6);
  fx.burst(h.x * cam.W, h.y * cam.H, { n: 20, colors: [PCOL[i], '#fff'], power: 380, shape: 'star' });
  fx.text(h.x * cam.W, h.y * cam.H - 40, lose ? `Çarptı! -${lose}` : 'Çarptı!', '#ff4f62', 22);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.snakes[i].eaten} kalp`, { pad: 0.4, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.snakes[i].eaten}</b> kalp yedi</span><span><b>${m.snakes[i].crashes}</b> kez çarptı</span><span><b>${m.snakes[i].len}</b> boy</span>`),
    });
  }, 1200);
}
