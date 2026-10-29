// Parmak Tabancası: işaret parmağın namlu, başparmağın tetik. Nişan alıp başparmağını indir: piu!
// Kendi tarafındaki balonları vur. Altın balon +3; kalpli balonu vurursan -2, onu sevgiline bırak

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, heartPath, inked, PCOL, tag, missingText, hideTop } from './arena.js';
import { fingers } from '../vision/hands.js';
import { divider, drawPlayerHands, handIdle } from './handkit.js';

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-fingergun',
    kind: 'hand',
    cfg: { secs: '40' },
    rules: [
      'Elini tabanca yap: işaret parmağın ileri, başparmağın yukarıda. Nişangah parmağının ucunda.',
      'Başparmağını indir: ateş! Kendi tarafındaki balonları vur.',
      html`Balon <b>+1</b>, altın balon <b>+3</b>. Kalpli balonu vurursan <b>-2</b>.`,
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['40', '40 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Tabancalar Hazır',
    waitTip: 'Ellerinizi kameraya, herkes kendi yarısında gösterin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-ates', 'gold', 'timeup'],
    tie: 'Berabere! İki Keskin Nişancı',
    albumTitle: 'Parmak Tabancası',
    mid: (cfg) => `${cfg.secs} sn`,
    idle: handIdle,
    play,
  });
}

// Nişangah: parmak ucu, parmak yönünde biraz ileri. Tetik: başparmak açık mı
function aimOf(h, ar) {
  const { ext } = fingers(h, ar);
  const tip = h.lm[8];
  const base = h.lm[5];
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  return { x: tip.x + dx * 1.2, y: tip.y + dy * 1.2, armed: ext[1] && !ext[2] && !ext[3], thumb: ext[0] };
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.aim = [null, null];
  m.cocked = [false, false];
  m.cool = [0, 0];
  m.balloons = [];
  m.shots = [0, 0];
  m.hits = [0, 0];
  m.oops = [0, 0];
  m.bang = [];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Tabancalar Hazır</h2><p class="hud-tip">Parmağınla nişan al, başparmağını indir.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p || !p.hands) {
        m.aim[i] = null;
        return;
      }
      // Tabanca yapan el; yoksa ilk el
      const aims = p.hands.map((h) => aimOf(h, p.ar));
      const a = aims.find((q) => q.armed) || null;
      m.aim[i] = a;
      if (!a) return;
      if (a.thumb) m.cocked[i] = true;
      else if (m.cocked[i] && m.running) {
        m.cocked[i] = false;
        if (ctx.now() > m.cool[i]) fire(ctx, i, a);
      }
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Ateş!', voice: 'go-ates' });
  if (!ctx.life.alive || m.over) return;
  hideTop(scene);
  m.running = true;
  for (const i of [0, 1]) for (let k = 0; k < 4; k++) spawn(ctx, i);
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

function spawn(ctx, i) {
  const { m } = ctx;
  const [a, b] = ctx.half(i);
  const r = Math.random();
  const kind = r < 0.12 ? 'gold' : r < 0.3 ? 'heart' : 'red';
  m.balloons.push({ owner: i, kind, x: rand(a + 0.06, b - 0.06), y: rand(0.75, 1.05), vy: -rand(0.05, 0.09), wob: rand(0, 6), c: ['#ff5a7a', '#4fb6ff', '#2ed6a0', '#a98bff'][Math.floor(rand(0, 4))] });
}

function fire(ctx, i, a) {
  const { m, cam, fx } = ctx;
  m.cool[i] = ctx.now() + 300;
  m.shots[i]++;
  const x = a.x * cam.W;
  const y = a.y * cam.H;
  sfx.zap();
  m.bang.push({ x, y, t: ctx.now(), i });
  const hit = m.balloons.find((b) => b.owner === i && !b.dead && Math.hypot(b.x * cam.W - x, b.y * cam.H - y) < cam.H * 0.07);
  if (!hit) return;
  hit.dead = true;
  if (hit.kind === 'heart') {
    m.oops[i]++;
    sfx.fail();
    fx.text(x, y - 40, 'Kalbi vurdun! -2', '#ff4f62', 22);
    if (ctx.pts[i] > 0) ctx.score(i, -Math.min(2, ctx.pts[i]), x / cam.W, y / cam.H, { quiet: true });
  } else {
    const pts = hit.kind === 'gold' ? 3 : 1;
    m.hits[i]++;
    sfx.pop(1.4);
    if (pts === 3) {
      sfx.sparkle();
      announcer.react('gold');
    }
    fx.burst(x, y, { n: 18, colors: [hit.kind === 'gold' ? '#ffcd3c' : hit.c, '#fff'], power: 360 });
    fx.text(x, y - 40, `+${pts}`, PCOL[i], 22);
    ctx.score(i, pts, x / cam.W, y / cam.H, { quiet: true });
  }
  ctx.life.timeout(() => m.running && spawn(ctx, i), 500);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  divider(g, W, H);
  for (const b of m.balloons) {
    if (b.dead) continue;
    if (m.running && dt > 0) {
      b.y += b.vy * dt;
      if (b.y < -0.12) {
        b.dead = true;
        ctx.life.timeout(() => m.running && spawn(ctx, b.owner), 200);
        continue;
      }
    }
    const x = (b.x + Math.sin(t / 600 + b.wob) * 0.01) * W;
    const y = b.y * H;
    const r = H * 0.045;
    g.beginPath();
    g.moveTo(x, y + r);
    g.quadraticCurveTo(x + 6, y + r * 1.6, x - 4, y + r * 2.4);
    g.lineWidth = 2.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.beginPath();
    g.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
    inked(g, b.kind === 'gold' ? '#ffcd3c' : b.kind === 'heart' ? '#fffcf6' : b.c, 3);
    if (b.kind === 'heart') {
      heartPath(g, x, y + r * 0.15, r * 0.55);
      g.fillStyle = '#ff3d7f';
      g.fill();
    }
    g.beginPath();
    g.ellipse(x - r * 0.3, y - r * 0.4, r * 0.15, r * 0.25, -0.5, 0, Math.PI * 2);
    g.fillStyle = '#ffffff99';
    g.fill();
  }
  m.balloons = m.balloons.filter((b) => !b.dead);
  drawPlayerHands(g, cam, players, { alpha: 0.8 });
  // Nişangahlar
  for (const i of [0, 1]) {
    const a = m.aim[i];
    if (!a) continue;
    const x = clamp(a.x, 0, 1) * W;
    const y = clamp(a.y, 0, 1) * H;
    g.beginPath();
    g.arc(x, y, 18, 0, Math.PI * 2);
    g.moveTo(x - 28, y);
    g.lineTo(x - 8, y);
    g.moveTo(x + 8, y);
    g.lineTo(x + 28, y);
    g.moveTo(x, y - 28);
    g.lineTo(x, y - 8);
    g.moveTo(x, y + 8);
    g.lineTo(x, y + 28);
    g.lineWidth = 6;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = m.cocked[i] ? PCOL[i] : '#fff';
    g.stroke();
    tag(g, x, y - 44, m.cocked[i] ? nameOf(i) : `${nameOf(i)}: başparmak yukarı`, PCOL[i], 13);
  }
  const now = ctx.now();
  m.bang = m.bang.filter((b) => now - b.t < 250);
  for (const b of m.bang) {
    const k = (now - b.t) / 250;
    g.globalAlpha = 1 - k;
    g.beginPath();
    g.arc(b.x, b.y, 14 + k * 30, 0, Math.PI * 2);
    g.lineWidth = 5;
    g.strokeStyle = '#ffcd3c';
    g.stroke();
    g.globalAlpha = 1;
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.hits[i]} isabet`, { pad: 0.3, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.hits[i]}</b> isabet</span><span><b>${m.shots[i]}</b> atış</span><span><b>${m.oops[i]}</b> kalp vurdu</span>`),
    });
  }, 1200);
}
