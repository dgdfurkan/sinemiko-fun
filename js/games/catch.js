// Ağzına At: tepeden şekerler yağar, ağzını açıp yakala. Altın kalp +3, acı biber -2

import { html, rand, clamp } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, jawOf, mouthOf, heartPath, inked, PCOL, missingText } from './arena.js';
import { drawFaceFrame } from './cam.js';

const KINDS = [
  { id: 'candy', pts: 1, w: 34 },
  { id: 'berry', pts: 1, w: 26 },
  { id: 'lokum', pts: 1, w: 22 },
  { id: 'gold', pts: 3, w: 8 },
  { id: 'pepper', pts: -2, w: 12 },
];
const CANDY = ['#ff5fa2', '#4fb6ff', '#2ed6a0', '#a98bff', '#ff8a3d'];

function pickKind(progress) {
  const list = KINDS.map((k) => ({ ...k, w: k.id === 'pepper' ? k.w + progress * 10 : k.w }));
  let r = Math.random() * list.reduce((n, k) => n + k.w, 0);
  for (const k of list) {
    r -= k.w;
    if (r <= 0) return k;
  }
  return list[0];
}

// Yiyecek çizimleri; x, y merkez, r yarıçap
function drawItem(g, it, x, y, r, t) {
  g.save();
  g.translate(x, y);
  g.rotate(it.rot + Math.sin(t / 300 + it.seed) * 0.25);
  if (it.kind === 'candy') {
    g.beginPath();
    g.moveTo(-r * 0.7, 0); g.lineTo(-r * 1.45, -r * 0.6); g.lineTo(-r * 1.45, r * 0.6); g.closePath();
    g.moveTo(r * 0.7, 0); g.lineTo(r * 1.45, -r * 0.6); g.lineTo(r * 1.45, r * 0.6); g.closePath();
    inked(g, it.color, 3);
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    inked(g, it.color, 3.5);
    g.beginPath();
    g.arc(0, 0, r * 0.82, -0.9, 0.4);
    g.lineWidth = r * 0.22;
    g.strokeStyle = '#ffffffcc';
    g.stroke();
  } else if (it.kind === 'berry') {
    g.beginPath();
    g.moveTo(0, r * 1.05);
    g.bezierCurveTo(-r * 1.25, r * 0.1, -r * 0.95, -r * 0.8, 0, -r * 0.62);
    g.bezierCurveTo(r * 0.95, -r * 0.8, r * 1.25, r * 0.1, 0, r * 1.05);
    inked(g, '#ff3b5c', 3.5);
    g.fillStyle = '#ffe08a';
    for (const [sx, sy] of [[-0.35, -0.15], [0.3, -0.2], [0, 0.2], [-0.25, 0.45], [0.28, 0.4]]) {
      g.beginPath();
      g.ellipse(sx * r, sy * r, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(-r * 0.55, -r * 0.62); g.lineTo(0, -r * 0.95); g.lineTo(r * 0.55, -r * 0.62); g.lineTo(0, -r * 0.5); g.closePath();
    inked(g, '#2ed67a', 3);
  } else if (it.kind === 'lokum') {
    g.beginPath();
    if (g.roundRect) g.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.45);
    else g.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    inked(g, '#ffb0cf', 3.5);
    g.fillStyle = '#ffffffdd';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.arc(Math.cos(k * 2.4) * r * 0.5, Math.sin(k * 1.7) * r * 0.5, r * 0.08, 0, Math.PI * 2);
      g.fill();
    }
  } else if (it.kind === 'gold') {
    heartPath(g, 0, r * 0.15, r * 1.15);
    inked(g, '#ffcd3c', 3.5);
    g.fillStyle = '#2a1636';
    g.font = `400 ${Math.round(r * 0.75)}px "Lilita One", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+3', 0, r * 0.05);
  } else {
    g.beginPath();
    g.moveTo(-r * 0.25, -r * 0.7);
    g.bezierCurveTo(r * 0.9, -r * 0.7, r * 0.7, r * 0.6, -r * 0.2, r * 1.2);
    g.bezierCurveTo(r * 0.1, r * 0.2, -r * 0.7, -r * 0.1, -r * 0.25, -r * 0.7);
    inked(g, '#e8241f', 3.5);
    g.beginPath();
    g.moveTo(-r * 0.25, -r * 0.7); g.quadraticCurveTo(-r * 0.3, -r * 1.15, r * 0.15, -r * 1.25);
    g.lineWidth = r * 0.2;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.lineWidth = r * 0.1;
    g.strokeStyle = '#2ed67a';
    g.stroke();
  }
  g.restore();
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-catch',
    kind: 'face',
    noBig: true,
    cfg: { secs: '45' },
    rules: [
      'Yan yana oturun. Ekranın iki yarısına aynı anda yiyecekler yağar, herkes kendi yarısını toplar.',
      'Başını yiyeceğin altına getir ve ağzını kocaman aç. Ağzın kapalıysa yiyecek kafandan seker.',
      html`Şeker <b>+1</b>, altın kalp <b>+3</b>, acı biber <b>-2</b>! Süre bitince en tok olan kazanır.`,
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Ağızlar Hazır mı?',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-ye', 'spicy', 'gold', 'timeup'],
    tie: 'Berabere! İkiniz de Aynı Tok',
    albumTitle: 'Ağzına At',
    play,
  });
}

async function play(ctx) {
  const { cam, cfg } = ctx;
  const secs = Number(cfg.secs);
  const m = Object.assign(ctx.m, {
    items: [], running: false, t0: 0, spawnAt: 0, open: [false, false], base: [0.05, 0.05],
    stats: [[0, 0, 0], [0, 0, 0]], hot: [0, 0], combo: [0, 0],
  });
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="pop-clock" data-clock>${secs}</div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = () => { warn.textContent = missingText(cam); };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Ye!', voice: 'go-ye', measure: (p) => ({ jaw: jawOf(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => clamp(b ? b.jaw : 0.05, 0, 0.3));
  m.running = true;
  m.t0 = ctx.now();
  ctx.clock(clockEl, secs, {
    onEnd: () => {
      m.running = false;
      sfx.whistle();
      announcer.say('timeup');
      ctx.life.timeout(() => ctx.finish({
        stats: m.stats.map((s) => html`<span><b>${s[0]}</b> lokma</span><span><b>${s[1]}</b> altın</span><span><b>${s[2]}</b> acı biber</span>`),
      }), 1400);
    },
  });
}

function spawn(ctx, progress) {
  const { cam, m } = ctx;
  const kind = pickKind(progress);
  const u = rand(0.18, 0.82);
  const speed = cam.H / rand(2.9 - progress * 0.9, 3.5 - progress * 1.1);
  const seed = rand(0, 6);
  const color = CANDY[Math.floor(Math.random() * CANDY.length)];
  // İki yarıya da aynı yiyecek aynı anda düşer; adil olsun
  for (const i of [0, 1]) {
    const [x0, x1] = ctx.half(i);
    m.items.push({ owner: i, kind: kind.id, pts: kind.pts, x: (x0 + (x1 - x0) * u) * cam.W, y: -cam.H * 0.08, vx: 0, vy: speed, rot: rand(-0.4, 0.4), seed, color, bounced: 0 });
  }
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const r = H * 0.045;
  if (m.running) {
    const progress = Math.min(1, (ctx.now() - m.t0) / 1000 / Number(ctx.cfg.secs));
    if (ctx.now() >= m.spawnAt) {
      spawn(ctx, progress);
      m.spawnAt = ctx.now() + rand(900, 1300) * (1 - progress * 0.35);
    }
  }
  // Ağızlar
  const mouths = [0, 1].map((i) => {
    const p = players[i];
    if (!p) return null;
    const mo = mouthOf(p);
    const jaw = jawOf(p);
    const on = Math.max(0.2, m.base[i] + 0.16);
    m.open[i] = m.open[i] ? jaw > on - 0.07 : jaw > on;
    return { x: mo.x * W, y: mo.y * H, w: mo.w * W, open: m.open[i], amt: clamp((jaw - m.base[i]) / 0.35, 0, 1), box: p.box };
  });
  players.forEach((p, i) => {
    if (!p) return;
    const hot = m.hot[i] > t;
    drawFaceFrame(g, cam, p, i, { glow: mouths[i].open ? 0.8 : 0.2, color: hot ? '#e8241f' : PCOL[i] });
    const mo = mouths[i];
    // Ağız halkası: açıldıkça büyür
    g.beginPath();
    g.arc(mo.x, mo.y, mo.w * (0.45 + mo.amt * 0.5), 0, Math.PI * 2);
    g.lineWidth = mo.open ? 6 : 3;
    g.strokeStyle = mo.open ? PCOL[i] : '#ffffff88';
    g.stroke();
    if (hot) {
      // Acı biber: kulaklardan buhar
      const b = p.box;
      for (const side of [-1, 1]) {
        const ex = (b.cx + side * b.w * 0.55) * W;
        const ey = (b.y + b.h * 0.45) * H;
        for (let k = 0; k < 3; k++) {
          const ph = ((t / 380 + k / 3) % 1);
          g.globalAlpha = 1 - ph;
          g.beginPath();
          g.arc(ex + side * ph * 30, ey - ph * 50, 6 + ph * 14, 0, Math.PI * 2);
          g.fillStyle = '#ffffff';
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  });
  // Yiyecekler
  for (let k = m.items.length - 1; k >= 0; k--) {
    const it = m.items[k];
    it.vy += (it.bounced ? H * 1.6 : 0) * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    const mo = mouths[it.owner];
    let eaten = false;
    if (m.running && mo) {
      const d = Math.hypot(it.x - mo.x, it.y - mo.y);
      if (mo.open && d < r + mo.w * 0.6) eaten = true;
      else if (!mo.open && !it.bounced && it.vy > 0) {
        // Kapalı ağız ya da kafa: yiyecek kafadan seker
        const b = mo.box;
        const bx = b.cx * W;
        const by = (b.y + b.h * 0.45) * H;
        if (Math.abs(it.x - bx) < b.w * W * 0.45 && Math.abs(it.y - by) < b.h * H * 0.5) {
          it.bounced = 1;
          it.vy = -H * 0.75;
          it.vx = (it.x < bx ? -1 : 1) * W * rand(0.12, 0.25);
          sfx.boing();
          fx.text(it.x, it.y - 20, 'Bonk!', '#a99cb3', 18);
        }
      }
    }
    if (eaten) {
      eat(ctx, it, mo, t);
      m.items.splice(k, 1);
      continue;
    }
    if (it.y > H + r * 2) {
      if (it.pts > 0) m.combo[it.owner] = 0;
      m.items.splice(k, 1);
      continue;
    }
    drawItem(g, it, it.x, it.y, r, t);
  }
  fx.draw(g, dt);
}

function eat(ctx, it, mo, t) {
  const { cam, m, fx } = ctx;
  const i = it.owner;
  const W = cam.W;
  const H = cam.H;
  let pts = it.pts;
  if (it.kind === 'pepper') {
    m.stats[i][2]++;
    m.combo[i] = 0;
    m.hot[i] = t + 1600;
    sfx.buzzer(i);
    announcer.react('spicy');
    ctx.shake(8);
    fx.burst(mo.x, mo.y, { n: 18, colors: ['#e8241f', '#ff8a3d', '#ffcd3c'], power: 380 });
    fx.text(mo.x, mo.y - 50, 'Acı! -2', '#e8241f', 26);
    ctx.shoot(i, 'Acı Biber!', { pad: 0.5 });
  } else {
    m.combo[i]++;
    if (it.kind === 'gold') {
      m.stats[i][1]++;
      sfx.sparkle();
      announcer.react('gold');
      fx.burst(mo.x, mo.y, { n: 22, colors: ['#ffcd3c', '#fff'], power: 420, shape: 'star' });
      ctx.shoot(i, 'Altın Lokma!', { pad: 0.5 });
    } else {
      m.stats[i][0]++;
      sfx.pop(0.9 + Math.random() * 0.4);
      fx.burst(mo.x, mo.y, { n: 12, colors: [it.kind === 'candy' ? it.color : it.kind === 'berry' ? '#ff3b5c' : '#ffb0cf', '#fff'], power: 260 });
    }
    // Arka arkaya beş lokma: kombo bonusu
    if (m.combo[i] > 0 && m.combo[i] % 5 === 0) {
      pts += 1;
      sfx.warm(0.9);
      fx.text(mo.x, mo.y - 80, `${m.combo[i]} Kombo! +1`, PCOL[i], 22);
    }
    fx.text(mo.x, mo.y - 40, `${pts > 0 ? '+' : ''}${pts}`, PCOL[i], 24);
  }
  fx.ring(mo.x, mo.y, PCOL[i], mo.w * 0.5);
  ctx.score(i, pts, mo.x / W, mo.y / H, { quiet: true });
}
