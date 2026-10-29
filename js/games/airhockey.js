// Masa Hokeyi: aynı klavyede iki tokmak. Solda oturan WASD, sağda oturan ok tuşları.
// Pulu rakibin kalesine sok; ilk N gole ulaşan kazanır. Eylem tuşu basılı tutulunca tokmak hızlanır

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL } from './keyarena.js';
import { newHockey, moveMallet, stepHockey, servePuck, drawTable, drawPuck, drawMallet } from './hockeykit.js';

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-airhockey',
    cfg: { to: '5' },
    rules: [
      'Solda oturan WASD ile, sağda oturan ok tuşlarıyla tokmağını kendi yarısında gezdirir.',
      'Pulu rakibin kalesine sok. Shift basılıyken tokmak hızlanır, vuruşun sertleşir.',
      'İlk hedefe ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç Golde Biter', segHTML('to', [['3', '3 Gol'], ['5', '5 Gol'], ['7', '7 Gol']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-hokey', 'gol'],
    mid: (cfg) => `${cfg.to} golde biter`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.to = Number(cfg.to);
  m.h = newHockey(ctx.W / ctx.H || 16 / 9);
  m.running = false;
  m.hits = [0, 0];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${controlsHTML(ctx)}</div>
    <div class="hud-bottom"></div>`);
  ctx.loop((dt) => draw(ctx, dt));
  await ctx.countdown(scene, { final: 'Vur!', voice: 'go-hokey' });
  if (!ctx.life.alive || m.over) return;
  m.running = true;
  servePuck(m.h, Math.random() < 0.5 ? 0 : 1);
}

function draw(ctx, dt) {
  const { m, g, H, fx } = ctx;
  const h = m.h;
  h.A = ctx.W / H;
  for (const side of [0, 1]) {
    const i = ctx.playerAt(side);
    const inp = ctx.input(i);
    const mm = h.mallets[side];
    const fast = inp.act ? 1.7 : 1.1;
    const n = Math.hypot(inp.x, inp.y) || 1;
    moveMallet(h, side, side, mm.X + (inp.x / n) * fast, mm.Y + (inp.y / n) * fast, dt, (inp.x || inp.y) ? fast : 0.0001);
    if (!inp.x && !inp.y) {
      mm.vx = 0;
      mm.vy = 0;
    }
  }
  if (m.running && dt > 0) {
    const goal = stepHockey(h, dt, {
      onHit: (side, sp) => {
        m.hits[ctx.playerAt(side)]++;
        sfx.thud(Math.min(1.4, sp / 1.6));
        fx.ring(h.puck.X * H, h.puck.Y * H, PCOL[ctx.playerAt(side)], 26);
      },
      onWall: () => sfx.pop(0.8),
    });
    if (goal >= 0) score(ctx, goal);
  }
  drawTable(g, h, H, { glass: false, goalColors: [PCOL[ctx.playerAt(0)], PCOL[ctx.playerAt(1)]] });
  drawPuck(g, h, H);
  for (const side of [0, 1]) drawMallet(g, h.mallets[side], H, PCOL[ctx.playerAt(side)], nameOf(ctx.playerAt(side)).slice(0, 1));
  fx.draw(g, dt);
}

function score(ctx, side) {
  const { m, fx, W, H } = ctx;
  const i = ctx.playerAt(side);
  sfx.boom();
  sfx.success();
  announcer.react('gol');
  ctx.shake(10);
  fx.burst(side === 1 ? 30 : W - 30, H / 2, { n: 40, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 620, shape: 'star' });
  fx.text(W / 2, H * 0.4, `GOL! ${nameOf(i)}`, PCOL[i], 36);
  ctx.score(i, 1, W / 2, H * 0.4);
  if (ctx.pts[i] >= m.to) {
    m.running = false;
    scoreboard.setMid('Bitti');
    sfx.whistle();
    ctx.life.timeout(() => ctx.finish({ stats: [0, 1].map((k) => html`<span><b>${ctx.pts[k]}</b> gol</span><span><b>${m.hits[k]}</b> vuruş</span>`) }), 1300);
    return;
  }
  m.running = false;
  m.h.puck.vx = 0;
  m.h.puck.vy = 0;
  m.h.puck.X = -10;
  ctx.life.timeout(() => {
    if (m.over) return;
    m.running = true;
    servePuck(m.h, side === 1 ? 0 : 1);
    sfx.whoosh();
  }, 1300);
}
