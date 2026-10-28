// Kanatlı Kafa: iki kuş aynı gökyüzünde. Ağzını açınca (ya da kaşını kaldırınca) kuşun kanat çırpar

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { icon } from '../ui/icons.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { scoreboard } from '../ui/scoreboard.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { optHTML, pSpan } from './common.js';
import { camDuel, jawOf, browOf, blinkOf, inked, PCOL, tag, roundRect, hideTop } from './arena.js';
import { drawFaceFrame, meter } from './cam.js';

const CTRL = {
  mouth: { name: 'Ağız', tip: 'ağzını aç kapa', read: jawOf, delta: 0.2, min: 0.22 },
  brow: { name: 'Kaş', tip: 'kaşlarını kaldır', read: browOf, delta: 0.16, min: 0.2 },
  blink: { name: 'Göz', tip: 'gözlerini kırp', read: blinkOf, delta: 0.3, min: 0.45 },
};
const ROUND_MAX = 75;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-flappy',
    kind: 'face',
    cfg: { ctrl: 'mouth', bestOf: '3' },
    rules: [
      'İkinizin de bir kuşu var, aynı gökyüzünde uçuyorsunuz. Borulara çarpmadan geçin.',
      'Seçtiğin hareketi her yaptığında kuşun kanat çırpar ve yükselir. Yapmazsan düşer.',
      'Daha çok boru geçen turu alır. Kim daha uzun uçacak?',
    ],
    options: (cfg) => html`
      ${optHTML('Kanat Çırpma', segHTML('ctrl', [['mouth', 'Ağzını Aç'], ['brow', 'Kaş Kaldır'], ['blink', 'Göz Kırp']], cfg.ctrl), 'Ağız en kolayı, kaş en komiği.')}
      ${optHTML('Kaç Turda Biter', segHTML('bestOf', [['3', '3 Tur'], ['5', '5 Tur']], cfg.bestOf))}`,
    bind: (scene, cfg, stage) => {
      const a = bindSeg(scene.querySelector('[data-seg="ctrl"]'), { value: cfg.ctrl, onChange: (v) => { cfg.ctrl = v; } });
      const b = bindSeg(scene.querySelector('[data-seg="bestOf"]'), { value: cfg.bestOf, onChange: (v) => { cfg.bestOf = v; } });
      stage.own(() => { a.destroy(); b.destroy(); });
    },
    waitTitle: 'Kanatlar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-uc', 'crash'],
    tie: 'Berabere! Kanatlar Eşit',
    albumTitle: 'Kanatlı Kafa',
    mid: () => 'Tur 1',
    play: (ctx) => {
      ctx.m.round = 0;
      ctx.m.best = [0, 0];
      round(ctx);
    },
  });
}

async function round(ctx) {
  const { cam, cfg, m, fx } = ctx;
  const ctrl = CTRL[cfg.ctrl];
  const need = Math.ceil(Number(cfg.bestOf) / 2);
  m.birds = [0, 1].map((i) => ({ y: 0.4 + i * 0.12, vy: 0, alive: true, pipes: 0, flap: 0, armed: true, val: 0, dieT: 0, spin: 0, time: 0 }));
  m.pipes = [];
  m.running = false;
  m.started = 0;
  m.nextPipe = 0;
  m.base = [0.05, 0.05];
  fx.clear();
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Tur ${m.round + 1}</h2><p class="hud-tip">Kanat çırpmak için <b>${ctrl.tip}</b>.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => onFrame(ctx, players, warn);
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Uç!', voice: 'go-uc', measure: (p) => ({ v: ctrl.read(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => (b ? b.v : 0.05));
  hideTop(scene);
  m.running = true;
  m.started = performance.now();
  m.nextPipe = m.started + 1600;
  m.onEnd = () => endRound(ctx, need);
}

function onFrame(ctx, players, warn) {
  const { m, cfg } = ctx;
  const ctrl = CTRL[cfg.ctrl];
  const gone = [0, 1].filter((i) => !players[i] && m.birds[i].alive);
  warn.textContent = gone.length ? `${gone.length === 2 ? 'İkinizi de' : nameOf(gone[0])} göremiyorum!` : '';
  players.forEach((p, i) => {
    if (!p) return;
    const b = m.birds[i];
    const v = ctrl.read(p);
    b.val = v;
    const on = Math.max(ctrl.min, m.base[i] + ctrl.delta);
    // Yükselen kenar: hareket eşiği geçince bir kez çırpar, geri inince yeniden kurulur
    if (b.armed && v > on) {
      b.armed = false;
      flap(ctx, i);
    } else if (!b.armed && v < on - ctrl.delta * 0.45) {
      b.armed = true;
    }
  });
}

function flap(ctx, i) {
  const { m, cam, fx } = ctx;
  const b = m.birds[i];
  if (!b.alive || !m.running) return;
  b.vy = -0.62;
  b.flap = 1;
  sfx.pop(1.2 + i * 0.2);
  fx.burst(cam.W * birdX(i), cam.H * b.y + 10, { n: 4, colors: ['#ffffff'], power: 120, gravity: 300, size: [3, 5] });
}

const birdX = (i) => 0.26 + i * 0.07;

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over || !m.birds) return;
  const W = cam.W;
  const H = cam.H;
  const now = performance.now();
  const speed = 0.25 + Math.min(0.12, (m.running ? (now - m.started) / 1000 : 0) * 0.0025);
  const gapH = Math.max(0.26, 0.36 - (m.running ? (now - m.started) / 1000 : 0) * 0.0015);
  const pw = 0.08;
  // Yüzler arka planda, hafif çerçeveli; yanlarında kontrol ölçeri
  players.forEach((p, i) => {
    if (!p) return;
    drawFaceFrame(g, cam, p, i, { glow: m.birds[i].flap, label: '' });
    const ctrl = CTRL[ctx.cfg.ctrl];
    const on = Math.max(ctrl.min, m.base[i] + ctrl.delta);
    meter(g, cam, p, clamp(m.birds[i].val / (on * 1.3), 0, 1), PCOL[i], { mark: 1 / 1.3, label: '' });
  });
  // Borular
  if (m.running && now >= m.nextPipe) {
    const gy = rand(0.22 + gapH / 2, 0.86 - gapH / 2);
    m.pipes.push({ x: 1.05, gy, gapH, passed: [false, false] });
    m.nextPipe = now + 1700 - Math.min(500, (now - m.started) * 0.006);
  }
  for (let k = m.pipes.length - 1; k >= 0; k--) {
    const pp = m.pipes[k];
    if (m.running) pp.x -= speed * dt;
    if (pp.x < -pw * 2) {
      m.pipes.splice(k, 1);
      continue;
    }
    const x = pp.x * W;
    const top = (pp.gy - pp.gapH / 2) * H;
    const bot = (pp.gy + pp.gapH / 2) * H;
    g.globalAlpha = 0.92;
    for (const [y0, y1, capY] of [[-10, top, top - 22], [bot, H + 10, bot]]) {
      roundRect(g, x, y0, pw * W, y1 - y0, 10);
      inked(g, '#2ed67a', 4);
      roundRect(g, x - 8, capY, pw * W + 16, 22, 8);
      inked(g, '#1fb862', 4);
    }
    g.globalAlpha = 1;
  }
  // Kuşlar
  m.birds.forEach((b, i) => {
    const bx = birdX(i);
    if (m.running && b.alive) {
      b.vy += 1.75 * dt;
      b.y += b.vy * dt;
      b.time = (now - m.started) / 1000;
      const r = 0.035;
      let hit = b.y > 0.97 || b.y < -0.05;
      for (const pp of m.pipes) {
        if (bx + r * 0.6 > pp.x && bx - r * 0.6 < pp.x + pw) {
          if (b.y - r < pp.gy - pp.gapH / 2 || b.y + r > pp.gy + pp.gapH / 2) hit = true;
        }
        if (!pp.passed[i] && pp.x + pw < bx) {
          pp.passed[i] = true;
          b.pipes++;
          sfx.ding();
          fx.text(bx * W, b.y * H - 46, String(b.pipes), PCOL[i], 22);
        }
      }
      if (b.time > ROUND_MAX) hit = false;
      if (hit) crash(ctx, i);
    } else if (!b.alive) {
      b.vy += 2.2 * dt;
      b.y = Math.min(1.1, b.y + b.vy * dt);
      b.spin += dt * 9;
    } else {
      b.y += Math.sin(t / 260 + i) * 0.0006;
    }
    b.flap = Math.max(0, b.flap - dt * 3);
    drawBird(g, bx * W, b.y * H, H * 0.04, i, b, t);
  });
  fx.draw(g, dt);
  if (m.running && (m.birds.every((b) => !b.alive) || (now - m.started) / 1000 > ROUND_MAX)) {
    m.running = false;
    ctx.life.timeout(() => m.onEnd && m.onEnd(), 1300);
  }
}

function drawBird(g, x, y, r, i, b, t) {
  g.save();
  g.translate(x, y);
  g.rotate(b.alive ? clamp(b.vy * 0.9, -0.5, 0.9) : b.spin);
  g.beginPath();
  g.ellipse(0, 0, r * 1.15, r, 0, 0, Math.PI * 2);
  inked(g, PCOL[i], 4);
  // Kanat
  const wing = b.flap > 0 ? -0.9 * b.flap : Math.sin(t / 140) * 0.25;
  g.save();
  g.translate(-r * 0.2, r * 0.1);
  g.rotate(wing);
  g.beginPath();
  g.ellipse(-r * 0.35, 0, r * 0.62, r * 0.36, -0.3, 0, Math.PI * 2);
  inked(g, '#ffffff', 3);
  g.restore();
  // Göz ve gaga
  g.beginPath();
  g.arc(r * 0.45, -r * 0.3, r * 0.3, 0, Math.PI * 2);
  inked(g, '#fff', 2.5);
  if (b.alive) {
    g.beginPath();
    g.arc(r * 0.55, -r * 0.3, r * 0.13, 0, Math.PI * 2);
    g.fillStyle = '#2a1636';
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(r * 0.35, -r * 0.42); g.lineTo(r * 0.62, -r * 0.18);
    g.moveTo(r * 0.62, -r * 0.42); g.lineTo(r * 0.35, -r * 0.18);
    g.lineWidth = 3;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  g.beginPath();
  g.moveTo(r * 0.95, -r * 0.05); g.lineTo(r * 1.55, r * 0.12); g.lineTo(r * 0.95, r * 0.32); g.closePath();
  inked(g, '#ffcd3c', 3);
  // Furkan topuzlu, Sinem gözlüklü kuş
  if (i === 0) {
    g.beginPath();
    g.arc(-r * 0.1, -r * 1.05, r * 0.32, 0, Math.PI * 2);
    inked(g, '#3b2a20', 3);
  } else {
    g.beginPath();
    g.arc(r * 0.45, -r * 0.3, r * 0.38, 0, Math.PI * 2);
    g.lineWidth = 3;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  g.restore();
  tag(g, x, y - r * 2.1, nameOf(i), PCOL[i], 14);
}

function crash(ctx, i) {
  const { m, cam, fx } = ctx;
  const b = m.birds[i];
  b.alive = false;
  b.vy = -0.3;
  sfx.boing();
  announcer.react('crash');
  ctx.shake(7);
  fx.burst(cam.W * birdX(i), cam.H * b.y, { n: 16, colors: [PCOL[i], '#fff'], power: 300, gravity: 500, shape: 'heart' });
  fx.text(cam.W * birdX(i), cam.H * b.y - 50, 'Düştü!', '#ff4f62', 24);
  ctx.shoot(i, `${b.pipes} Boruda Düştü`, { pad: 0.5 });
}

function endRound(ctx, need) {
  const { m, stage, cam } = ctx;
  if (m.over) return;
  cam.onFrame = null;
  const [a, b] = m.birds;
  let winner = -1;
  if (a.pipes !== b.pipes) winner = a.pipes > b.pipes ? 0 : 1;
  else if (Math.abs(a.time - b.time) > 0.3) winner = a.time > b.time ? 0 : 1;
  m.birds.forEach((bd, i) => { m.best[i] = Math.max(m.best[i], bd.pipes); });
  m.round++;
  const scene = stage.show(html`
    <h2 class="t-title" data-in>${winner === -1 ? 'Berabere Uçtunuz!' : html`${pSpan(winner)} Turu Aldı!`}</h2>
    <div class="pop-stats" data-in>${[0, 1].map((i) => html`
      <div class="pop-stat p${i}"><span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span><span><b>${m.birds[i].pipes}</b> boru</span><span><b>${m.birds[i].time.toFixed(1).replace('.', ',')}</b> sn uçtu</span></div>`)}</div>
    <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>Devam${icon('arrow')}</button>`, {
    next: () => {
      const pts = ctx.pts;
      if (pts[0] >= need || pts[1] >= need || m.round >= Number(ctx.cfg.bestOf)) {
        ctx.finish({ stats: m.best.map((v) => html`<span>En iyi <b>${v}</b> boru</span>`) });
      } else {
        scoreboard.setMid(`Tur ${m.round + 1}`);
        round(ctx);
      }
    },
  });
  if (winner >= 0) {
    const t = scene.querySelector('.t-title');
    ctx.score(winner, 1, t);
    const r = t.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 12, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }
}
