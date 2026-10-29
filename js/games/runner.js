// Kafa Koşusu: minik bloblar koşuyor. Başını kaldır ya da ağzını aç, zıplasın; başını indir, eğilsin.
// Yerdeki kutuların üstünden atla, uçan yarasaların altından geç. İkinizin önüne aynı engeller gelir

import { html, rand, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, jawOf, heartPath, inked, roundRect, PCOL, tag, missingText, hideTop } from './arena.js';

const GROUND = 0.88;
const GRAV = 3.4;
const JUMP = 1.45;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-runner',
    kind: 'face',
    cfg: { lives: '3' },
    rules: [
      'Herkesin kendi yolunda bir blobu var. Başını yukarı kaldır ya da ağzını aç: zıplar.',
      'Başını aşağı indir: eğilir. Kutuların üstünden atla, yarasaların altından geç.',
      'Çarpınca can gider. Canı en son biten ya da en uzağa koşan kazanır.',
    ],
    options: (cfg) => optHTML('Can', segHTML('lives', [['1', '1'], ['3', '3'], ['5', '5']], cfg.lives)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="lives"]'), { value: cfg.lives, onChange: (v) => { cfg.lives = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Koşucular Hazır',
    waitTip: 'Yan yana oturun; başınızı rahatça kaldırıp indirebileceğiniz kadar boşluk olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-kos', 'crash', 'gold'],
    tie: 'Berabere! Aynı Yere Kadar Koştunuz',
    albumTitle: 'Kafa Koşusu',
    mid: () => 'Koş!',
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  const lives = Number(cfg.lives);
  m.run = [0, 1].map(() => ({ y: 0, vy: 0, duck: false, lives, dist: 0, hurt: 0, alive: true, cleared: 0, coins: 0, up: false }));
  m.base = [0.45, 0.45];
  m.obs = [];
  m.speed = 0.42;
  m.next = 0;
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Koşucular Hazır</h2><p class="hud-tip">Başını kaldır: zıpla. Başını indir: eğil.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (!m.running) return;
    players.forEach((p, i) => {
      if (!p) return;
      const r = m.run[i];
      if (!r.alive) return;
      const dy = noseOf(p).y - m.base[i];
      const s = p.box.h || 0.3;
      // Eşikler yüz boyuna göre: kameraya yakın oturan da uzak oturan da aynı hareketle oynar
      const up = dy < -s * 0.12 || jawOf(p) > 0.42;
      if (up && !r.up && r.y <= 0.001) {
        r.vy = JUMP;
        sfx.rise(0.25);
      }
      r.up = up;
      r.duck = dy > s * 0.13 && r.y <= 0.02;
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  const base = await ctx.countdown(scene, { final: 'Koş!', voice: 'go-kos', measure: (p) => ({ y: noseOf(p).y }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => (b ? b.y : m.base[i]));
  hideTop(scene);
  m.running = true;
  m.t0 = ctx.now();
  m.next = 1.2;
}

// Engel konumu "uzaklık" cinsinden: iki şerit aynı engelleri aynı uzaklıkta görür
function spawn(m) {
  const r = Math.random();
  const kind = r < 0.5 ? 'box' : r < 0.82 ? 'bat' : 'coin';
  m.obs.push({ kind, at: m.far + 1.1, h: kind === 'box' ? pick([1, 1, 2]) : 1, wob: rand(0, 6) });
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const lane = W / 2;
  if (m.running && dt > 0) {
    const el = (ctx.now() - m.t0) / 1000;
    m.speed = Math.min(0.95, 0.42 + el * 0.011);
    m.far = Math.max(m.run[0].dist, m.run[1].dist);
    if (m.far >= m.next) {
      spawn(m);
      m.next = m.far + rand(0.55, 0.95) * (1 + m.speed * 0.4);
    }
    m.run.forEach((r, i) => {
      if (!r.alive) return;
      r.dist += m.speed * dt;
      r.vy -= GRAV * dt;
      r.y = Math.max(0, r.y + r.vy * dt);
      if (r.y === 0) r.vy = 0;
      r.hurt = Math.max(0, r.hurt - dt);
      for (const o of m.obs) {
        const dx = o.at - r.dist;
        if (o.done && o.done[i]) continue;
        if (dx < -0.06) {
          o.done = o.done || [false, false];
          o.done[i] = true;
          if (o.kind !== 'coin') r.cleared++;
          continue;
        }
        if (Math.abs(dx) > 0.045) continue;
        let hit = false;
        if (o.kind === 'box') hit = r.y < 0.075 * o.h;
        else if (o.kind === 'bat') hit = !r.duck && r.y < 0.2;
        else if (o.kind === 'coin' && r.y > 0.08) {
          o.done = o.done || [false, false];
          o.done[i] = true;
          r.coins++;
          sfx.ding();
          const px = laneX(ctx, i) + lane * 0.22;
          fx.text(px, GROUND * H - 140, '+2', PCOL[i], 20);
          continue;
        }
        if (hit && r.hurt <= 0) {
          o.done = o.done || [false, false];
          o.done[i] = true;
          r.lives--;
          r.hurt = 1.3;
          sfx.thud(1);
          announcer.react('crash');
          ctx.shake(6);
          const px = laneX(ctx, i) + lane * 0.22;
          fx.burst(px, GROUND * H - 40, { n: 16, colors: [PCOL[i], '#fff'], power: 300, shape: 'star' });
          if (r.lives <= 0) {
            r.alive = false;
            fx.text(px, GROUND * H - 120, 'Bitti!', '#ff4f62', 24);
            ctx.shoot(i, 'Tökezledi!', { pad: 0.45 });
          }
        }
      }
      ctx.pts[i] = Math.floor(r.dist * 10) + r.coins * 2;
      scoreboard.setText(i, `${Math.floor(r.dist * 10)} m`);
    });
    m.obs = m.obs.filter((o) => o.at > Math.min(m.run[0].dist, m.run[1].dist) - 0.3);
    // İkisi de çok iyiyse 90 saniyede biter
    if ((!m.run[0].alive && !m.run[1].alive) || el > 90) end(ctx);
  }
  for (const i of [0, 1]) drawLane(ctx, g, i, t);
  fx.draw(g, dt);
}

const laneX = (ctx, i) => ctx.half(i)[0] * ctx.cam.W;

function drawLane(ctx, g, i, t) {
  const { cam, m } = ctx;
  const W = cam.W;
  const H = cam.H;
  const x0 = laneX(ctx, i);
  const lw = W / 2;
  const r = m.run[i];
  const gy = GROUND * H;
  const scale = lw / 1.1;
  const px = x0 + lw * 0.22;
  g.save();
  g.beginPath();
  g.rect(x0 + 6, 0, lw - 12, H);
  g.clip();
  // Zemin
  g.fillStyle = '#ffd99455';
  g.fillRect(x0, gy, lw, H - gy);
  g.beginPath();
  g.moveTo(x0, gy);
  g.lineTo(x0 + lw, gy);
  g.lineWidth = 4;
  g.strokeStyle = '#2a1636';
  g.stroke();
  const off = (r.dist * scale) % 40;
  g.fillStyle = '#2a163655';
  for (let x = x0 - off; x < x0 + lw; x += 40) g.fillRect(x, gy + 10, 16, 4);
  // Engeller
  for (const o of m.obs) {
    if (o.done && o.done[i] && o.kind === 'coin') continue;
    const ox = px + (o.at - r.dist) * scale;
    if (ox < x0 - 60 || ox > x0 + lw + 60) continue;
    if (o.kind === 'box') {
      const bh = 0.075 * o.h * scale * 0.9;
      const bw = 0.07 * scale;
      roundRect(g, ox - bw / 2, gy - bh, bw, bh, 6);
      inked(g, '#ff9f1c', 3.5);
      g.beginPath();
      g.moveTo(ox - bw / 2 + 6, gy - bh + 6);
      g.lineTo(ox + bw / 2 - 6, gy - 6);
      g.moveTo(ox + bw / 2 - 6, gy - bh + 6);
      g.lineTo(ox - bw / 2 + 6, gy - 6);
      g.lineWidth = 2.5;
      g.stroke();
    } else if (o.kind === 'bat') {
      const by = gy - 0.15 * scale + Math.sin(t / 120 + o.wob) * 5;
      const s = 0.035 * scale;
      const flap = Math.sin(t / 60) * s * 0.5;
      g.beginPath();
      g.moveTo(ox, by);
      g.quadraticCurveTo(ox - s * 1.2, by - s - flap, ox - s * 2, by + flap * 0.3);
      g.quadraticCurveTo(ox - s, by, ox, by + s * 0.4);
      g.quadraticCurveTo(ox + s, by, ox + s * 2, by + flap * 0.3);
      g.quadraticCurveTo(ox + s * 1.2, by - s - flap, ox, by);
      inked(g, '#6b4fa8', 3);
      g.beginPath();
      g.arc(ox - s * 0.25, by + s * 0.05, 2.5, 0, Math.PI * 2);
      g.arc(ox + s * 0.25, by + s * 0.05, 2.5, 0, Math.PI * 2);
      g.fillStyle = '#ffcd3c';
      g.fill();
    } else {
      const cy = gy - 0.16 * scale + Math.sin(t / 200 + o.wob) * 4;
      heartPath(g, ox, cy, 0.03 * scale);
      inked(g, '#ffcd3c', 3);
    }
  }
  // Koşucu blob
  const s = 0.045 * scale;
  const y = gy - r.y * scale;
  const blink = r.hurt > 0 && Math.sin(t / 50) > 0;
  if (!blink) {
    g.save();
    g.translate(px, y);
    const squash = r.duck ? 0.55 : 1;
    const legs = r.y > 0 ? 0 : Math.sin(r.dist * 60) * s * 0.35;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.strokeStyle = '#2a1636';
    g.beginPath();
    g.moveTo(-s * 0.35, -s * 0.15);
    g.lineTo(-s * 0.35 + legs, 0);
    g.moveTo(s * 0.35, -s * 0.15);
    g.lineTo(s * 0.35 - legs, 0);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -s * squash - s * 0.1, s * (r.duck ? 1.25 : 1), s * squash, 0, 0, Math.PI * 2);
    inked(g, r.alive ? PCOL[i] : '#a99cb3', 3.5);
    g.beginPath();
    g.arc(s * 0.3, -s * squash * 1.2, s * 0.22, 0, Math.PI * 2);
    g.arc(s * 0.75, -s * squash * 1.2, s * 0.22, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.fillStyle = '#2a1636';
    g.beginPath();
    g.arc(s * 0.36, -s * squash * 1.2, s * 0.1, 0, Math.PI * 2);
    g.arc(s * 0.81, -s * squash * 1.2, s * 0.1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // Canlar ve ad
  for (let k = 0; k < r.lives; k++) {
    heartPath(g, x0 + 30 + k * 30, gy + 40, 11);
    inked(g, '#ff3d7f', 2.5);
  }
  g.restore();
  tag(g, px, y - s * 2.6, nameOf(i), PCOL[i], 14);
  if (!r.alive) tag(g, x0 + lw / 2, H * 0.5, 'Oyun Bitti', '#a99cb3', 24);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${Math.floor(m.run[i].dist * 10)} m</b> koştu</span><span><b>${m.run[i].cleared}</b> engel geçti</span><span><b>${m.run[i].coins}</b> kalp topladı</span>`),
    });
  }, 1200);
}
