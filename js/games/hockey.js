// Burun Hokeyi: tokmağın burnunu takip eder. Pulu rakibin kalesine sok, kendi kaleni koru.
// Herkes kendi yarısında oynar; ilk N gole ulaşan kazanır

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, PCOL, missingText, hideTop } from './arena.js';
import { newHockey, moveMallet, stepHockey, servePuck, drawTable, drawPuck, drawMallet } from './hockeykit.js';

const GX = 4.2;
const GY = 5.5;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-hockey',
    kind: 'face',
    cfg: { to: '5' },
    rules: [
      'Tokmağın burnunu takip eder: başını oynattıkça kendi yarında gezer.',
      'Pula vurup rakibin kalesine sok. Kendi kaleni koru; hızlı vurursan pul da hızlı gider.',
      'İlk gole ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Golde Biter', segHTML('to', [['3', '3 Gol'], ['5', '5 Gol'], ['7', '7 Gol']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Masa Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-hokey', 'gol', 'point'],
    tie: 'Berabere!',
    albumTitle: 'Burun Hokeyi',
    mid: (cfg) => `${cfg.to} golde biter`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.to = Number(cfg.to);
  m.base = [{ x: 0.3, y: 0.45 }, { x: 0.7, y: 0.45 }];
  m.target = [null, null];
  m.h = null;
  m.hits = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Masa Hazır</h2><p class="hud-tip">Başınla tokmağı yönet, pulu karşıya vur.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (!m.h) return;
    const A = m.h.A;
    players.forEach((p, i) => {
      if (!p) return;
      const n = noseOf(p);
      const side = i === cam.leftIs ? 0 : 1;
      const cx = side === 0 ? A * 0.22 : A * 0.78;
      m.target[i] = { X: cx + (n.x - m.base[i].x) * GX * A, Y: 0.5 + (n.y - m.base[i].y) * GY };
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  m.h = newHockey(cam.W / cam.H);
  const base = await ctx.countdown(scene, { final: 'Vur!', voice: 'go-hokey', measure: (p) => { const n = noseOf(p); return { x: n.x, y: n.y }; } });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b, i) => b || m.base[i]);
  hideTop(scene);
  m.running = true;
  servePuck(m.h, Math.random() < 0.5 ? 0 : 1);
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over || !m.h) return;
  const H = cam.H;
  const h = m.h;
  h.A = cam.W / cam.H;
  // Sol tokmak soldaki oyuncunun
  const owner = (side) => (side === 0 ? cam.leftIs : 1 - cam.leftIs);
  for (const side of [0, 1]) {
    const i = owner(side);
    const tg = m.target[i];
    if (tg && cam.visible(i, 700)) moveMallet(h, side, side, tg.X, tg.Y, dt);
    else moveMallet(h, side, side, h.mallets[side].X, h.mallets[side].Y, dt);
  }
  if (m.running && dt > 0) {
    const goal = stepHockey(h, dt, {
      onHit: (side, sp) => {
        const i = owner(side);
        m.hits[i]++;
        sfx.thud(Math.min(1.4, sp / 1.6));
        fx.ring(h.puck.X * H, h.puck.Y * H, PCOL[i], 26);
        if (sp > 2.2) ctx.shake(4);
      },
      onWall: () => sfx.pop(0.8),
    });
    if (goal >= 0) scoreGoal(ctx, owner(goal), goal);
  }
  drawTable(g, h, H, { goalColors: [PCOL[owner(0)], PCOL[owner(1)]] });
  drawPuck(g, h, H);
  for (const side of [0, 1]) drawMallet(g, h.mallets[side], H, PCOL[owner(side)], nameOf(owner(side)).slice(0, 1));
  fx.draw(g, dt);
}

function scoreGoal(ctx, i, side) {
  const { m, cam, fx } = ctx;
  const h = m.h;
  const x = side === 1 ? 0.06 : 0.94;
  sfx.boom();
  sfx.success();
  announcer.react('gol');
  ctx.shake(10);
  fx.burst(x * cam.W, cam.H / 2, { n: 40, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 620, shape: 'star' });
  fx.text(cam.W / 2, cam.H * 0.4, `GOL! ${nameOf(i)}`, PCOL[i], 34);
  ctx.score(i, 1, x, 0.5);
  ctx.shoot(i, 'Gol attı!', { pad: 0.4 });
  if (ctx.pts[i] >= m.to) {
    end(ctx);
    return;
  }
  m.running = false;
  h.puck.vx = 0;
  h.puck.vy = 0;
  h.puck.X = -10;
  ctx.life.timeout(() => {
    if (m.over) return;
    m.running = true;
    servePuck(h, side === 1 ? 0 : 1);
    sfx.whoosh();
  }, 1400);
}

function end(ctx) {
  const { m } = ctx;
  m.running = false;
  scoreboard.setMid('Bitti');
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${ctx.pts[i]}</b> gol</span><span><b>${m.hits[i]}</b> vuruş</span>`),
    });
  }, 1300);
}
