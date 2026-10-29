// Boya Kapmaca: burnun bir fırça. Ekranı kendi renginle boya, rakibin boyasının üstünden geç.
// Süre bitince ekranın çoğunu kim boyadıysa o kazanır. Boya kovası etrafa sıçrar, dev fırça kısa süre kalınlaşır

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, inked, starPath, PCOL, tag, missingText, hideTop } from './arena.js';

const COLS = 64;
const ROWS = 36;
const GX = 5.2;
const GY = 6.2;
const BRUSH = 2.3;
const RGB = [[79, 182, 255], [255, 111, 174]];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-paint',
    kind: 'face',
    cfg: { secs: '40' },
    rules: [
      'Burnun bir fırça: başını oynattıkça ekranı kendi renginle boyarsın. Tüm ekran ikinizin.',
      'Rakibin boyasının üstünden geçersen orası senin olur. Kovaya dokunursan boya etrafa sıçrar, yıldız fırçanı kalınlaştırır.',
      html`Süre bitince ekranın <b>çoğunu</b> boyayan kazanır.`,
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['40', '40 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Fırçalar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-boya', 'gold', 'timeup'],
    tie: 'Berabere! Ekran İkiye Bölündü',
    albumTitle: 'Boya Kapmaca',
    mid: (cfg) => `${cfg.secs} sn`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.grid = new Int8Array(COLS * ROWS).fill(-1);
  m.count = [0, 0];
  m.cur = [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }];
  m.prev = [null, null];
  m.base = [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }];
  m.big = [0, 0];
  m.items = [];
  m.spawnAt = 0;
  m.pickups = [0, 0];
  m.running = false;
  // Boya katmanı: ızgara boyutunda küçük tuval, büyütülünce yumuşak boya lekesi gibi görünür
  m.layer = document.createElement('canvas');
  m.layer.width = COLS;
  m.layer.height = ROWS;
  m.lg = m.layer.getContext('2d');
  m.img = m.lg.createImageData(COLS, ROWS);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Fırçalar Hazır</h2><p class="hud-tip">Başını oynat, ekranı boya.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p) return;
      const n = noseOf(p);
      const cx = i === cam.leftIs ? 0.3 : 0.7;
      m.cur[i] = { x: clamp(cx + (n.x - m.base[i].x) * GX, 0.01, 0.99), y: clamp(0.5 + (n.y - m.base[i].y) * GY, 0.02, 0.98) };
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  const base = await ctx.countdown(scene, { final: 'Boya!', voice: 'go-boya', measure: (p) => { const n = noseOf(p); return { x: n.x, y: n.y }; } });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => b || m.base[i]);
  hideTop(scene);
  m.running = true;
  m.spawnAt = ctx.now() + 3000;
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

function paintAt(m, i, x, y, r) {
  const gx = x * COLS;
  const gy = y * ROWS;
  const R = Math.ceil(r);
  let changed = 0;
  for (let yy = Math.max(0, Math.floor(gy - R)); yy <= Math.min(ROWS - 1, Math.ceil(gy + R)); yy++) {
    for (let xx = Math.max(0, Math.floor(gx - R)); xx <= Math.min(COLS - 1, Math.ceil(gx + R)); xx++) {
      const dx = xx + 0.5 - gx;
      const dy = yy + 0.5 - gy;
      if (dx * dx + dy * dy > r * r) continue;
      const k = yy * COLS + xx;
      const was = m.grid[k];
      if (was === i) continue;
      if (was >= 0) m.count[was]--;
      m.grid[k] = i;
      m.count[i]++;
      const o = k * 4;
      m.img.data[o] = RGB[i][0];
      m.img.data[o + 1] = RGB[i][1];
      m.img.data[o + 2] = RGB[i][2];
      m.img.data[o + 3] = 150;
      changed++;
    }
  }
  return changed;
}

function spawn(ctx) {
  const { m } = ctx;
  const kind = Math.random() < 0.55 ? 'bucket' : 'star';
  m.items.push({ kind, x: rand(0.12, 0.88), y: rand(0.18, 0.85), t0: ctx.now(), life: 7000 });
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  if (m.running) {
    const now = ctx.now();
    if (now >= m.spawnAt && m.items.length < 3) {
      spawn(ctx);
      m.spawnAt = now + rand(3500, 5500);
    }
    let dirty = false;
    for (const i of [0, 1]) {
      if (!cam.visible(i, 500)) {
        m.prev[i] = null;
        continue;
      }
      const c = m.cur[i];
      const r = BRUSH * (now < m.big[i] ? 2 : 1);
      const p0 = m.prev[i] || c;
      // Hızlı harekette boşluk kalmasın: yol boyunca aralıklı boya
      const steps = Math.max(1, Math.ceil(Math.hypot((c.x - p0.x) * COLS, (c.y - p0.y) * ROWS) / (r * 0.6)));
      for (let s = 1; s <= steps; s++) {
        const k = s / steps;
        if (paintAt(m, i, p0.x + (c.x - p0.x) * k, p0.y + (c.y - p0.y) * k, r)) dirty = true;
      }
      m.prev[i] = { ...c };
      for (const it of m.items) {
        if (it.dead) continue;
        if (Math.hypot((it.x - c.x) * W, (it.y - c.y) * H) < H * 0.06) {
          it.dead = true;
          m.pickups[i]++;
          if (it.kind === 'bucket') {
            paintAt(m, i, it.x, it.y, 7.5);
            dirty = true;
            sfx.splat();
            fx.burst(it.x * W, it.y * H, { n: 30, colors: [PCOL[i], '#fff'], power: 520 });
            fx.text(it.x * W, it.y * H - 40, 'Sıçradı!', PCOL[i], 22);
            ctx.shake(5);
          } else {
            m.big[i] = now + 5000;
            sfx.sparkle();
            fx.burst(it.x * W, it.y * H, { n: 18, colors: ['#ffcd3c', '#fff'], shape: 'star', power: 380 });
            fx.text(it.x * W, it.y * H - 40, 'Dev Fırça!', PCOL[i], 22);
            announcer.react('gold');
          }
        }
      }
    }
    m.items = m.items.filter((it) => !it.dead && now - it.t0 < it.life);
    if (dirty) {
      m.lg.putImageData(m.img, 0, 0);
      const tot = COLS * ROWS;
      [0, 1].forEach((i) => scoreboard.setText(i, `%${Math.round((m.count[i] / tot) * 100)}`));
    }
  }
  // Boya katmanı yumuşak büyütülür
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(m.layer, 0, 0, W, H);
  g.restore();
  // Kova ve yıldızlar
  const now = ctx.now();
  for (const it of m.items) {
    const age = (now - it.t0) / it.life;
    const bob = Math.sin(t / 200 + it.x * 9) * 4;
    const s = H * 0.035 * (age > 0.85 ? 1 - (age - 0.85) / 0.15 : Math.min(1, age * 8));
    if (s <= 0) continue;
    const x = it.x * W;
    const y = it.y * H + bob;
    if (it.kind === 'bucket') {
      g.beginPath();
      g.moveTo(x - s, y - s * 0.7);
      g.lineTo(x + s, y - s * 0.7);
      g.lineTo(x + s * 0.75, y + s);
      g.lineTo(x - s * 0.75, y + s);
      g.closePath();
      inked(g, '#ffcd3c', 3);
      g.beginPath();
      g.ellipse(x, y - s * 0.7, s, s * 0.3, 0, 0, Math.PI * 2);
      inked(g, '#a98bff', 3);
    } else {
      starPath(g, x, y, s * 1.2);
      inked(g, '#ffcd3c', 3);
    }
  }
  // Fırçalar
  for (const i of [0, 1]) {
    if (!cam.visible(i, 800)) continue;
    const c = m.cur[i];
    const big = now < m.big[i];
    const r = (BRUSH / ROWS) * H * (big ? 2 : 1);
    g.beginPath();
    g.arc(c.x * W, c.y * H, r, 0, Math.PI * 2);
    g.fillStyle = PCOL[i];
    g.globalAlpha = 0.85;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 4;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.beginPath();
    g.arc(c.x * W - r * 0.3, c.y * H - r * 0.3, r * 0.22, 0, Math.PI * 2);
    g.fillStyle = '#ffffffaa';
    g.fill();
    tag(g, c.x * W, c.y * H - r - 18, nameOf(i), PCOL[i], 15);
  }
  // Üstte yüzde çubuğu
  const tot = COLS * ROWS;
  const a = m.count[0] / tot;
  const b = m.count[1] / tot;
  const bw = Math.min(520, W * 0.5);
  const bx = W / 2 - bw / 2;
  const by = 14;
  g.fillStyle = '#fffcf6';
  g.fillRect(bx, by, bw, 16);
  g.fillStyle = PCOL[0];
  g.fillRect(bx, by, bw * a, 16);
  g.fillStyle = PCOL[1];
  g.fillRect(bx + bw * (1 - b), by, bw * b, 16);
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.strokeRect(bx, by, bw, 16);
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  const tot = COLS * ROWS;
  const pct = m.count.map((c) => Math.round((c / tot) * 100));
  ctx.pts = pct.slice();
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `%${pct[i]} boyadı`, { pad: 0.4, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>%${pct[i]}</b> ekran</span><span><b>${m.pickups[i]}</b> kova ve yıldız</span>`),
      sub: pct[0] + pct[1] < 100 ? `Ekranın %${100 - pct[0] - pct[1]} kadarı boş kaldı.` : 'Ekranın tamamı boyandı!',
    });
  }, 1300);
}
