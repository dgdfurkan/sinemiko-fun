// Duvardan Geç: üstüne doğru bir duvar geliyor, ortasında bir poz şeklinde delik var.
// Duvar sana ulaşmadan o pozu ver; delikten geçersen puan, geçemezsen duvar suratına çarpar

import { html, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, roundRect, PCOL, tag, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';
import { body, poseById, poseVec, figVec, similarity } from '../vision/poses.js';

const IDS = ['up', 'y', 't', 'left', 'right', 'head', 'heart', 'muscle', 'leanl', 'leanr', 'dab'];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-wall',
    kind: 'pose',
    cfg: { count: '8' },
    rules: [
      'Önünüze birer duvar geliyor. Duvarın ortasında bir poz şeklinde delik var.',
      'Duvar size ulaşmadan aynı pozu verin. Tam uyarsa +2, az farkla sığarsan +1.',
      'Sığmazsan duvar suratına çarpar! Duvarlar gittikçe hızlanır.',
    ],
    options: (cfg) => optHTML('Duvar Sayısı', segHTML('count', [['6', '6'], ['8', '8'], ['12', '12']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Duvarlar Geliyor',
    waitTip: 'Yan yana oturun, başınız, omuzlarınız ve kollarınız görünsün.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-duvar', 'bonk', 'safe'],
    tie: 'Berabere! İkiniz de Lastik Gibi',
    albumTitle: 'Duvardan Geç',
    mid: (cfg) => `Duvar 1 / ${cfg.count}`,
    play,
  });
}

// Duvar dokusu: tuğlalar ve poz şeklinde saydam delik. Her duvar için bir kez çizilir
function wallTexture(fig, color) {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 360, 420);
  g.strokeStyle = '#2a163666';
  g.lineWidth = 3;
  for (let r = 0; r < 14; r++) {
    const y = r * 30;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(360, y);
    g.stroke();
    for (let x = (r % 2) * 30; x < 360; x += 60) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 30);
      g.stroke();
    }
  }
  // Delik: kalın çizgili çöp adam, kenarı koyu
  const k = 3.2;
  const ox = 180 - 50 * k;
  const oy = 40;
  const P = (p) => [ox + p[0] * k, oy + p[1] * k];
  const bones = [['ls', 'rs'], ['ls', 'le'], ['le', 'lw'], ['rs', 're'], ['re', 'rw'], ['ls', 'lh'], ['rs', 'rh'], ['lh', 'rh']];
  const shape = (w) => {
    g.beginPath();
    for (const [a, b] of bones) {
      const [x1, y1] = P(fig[a]);
      const [x2, y2] = P(fig[b]);
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
    const [nx, ny] = P(fig.n);
    g.beginPath();
    g.arc(nx, ny, 15 * k * 0.9 + (w - 46) / 2, 0, Math.PI * 2);
    g.fill();
    // Gövde
    g.beginPath();
    const pts = ['ls', 'rs', 'rh', 'lh'].map((q) => P(fig[q]));
    g.moveTo(...pts[0]);
    pts.slice(1).forEach((q) => g.lineTo(...q));
    g.closePath();
    g.fill();
    g.stroke();
  };
  g.strokeStyle = '#2a1636';
  g.fillStyle = '#2a1636';
  shape(58);
  g.globalCompositeOperation = 'destination-out';
  shape(46);
  g.globalCompositeOperation = 'source-over';
  return c;
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  const ids = [];
  while (ids.length < Number(cfg.count)) ids.push(...shuffle(IDS.slice()));
  m.list = ids.slice(0, Number(cfg.count)).map((id) => poseById(id));
  m.k = -1;
  m.walls = [null, null];
  m.cur = [null, null];
  m.res = [null, null];
  m.pass = [0, 0];
  m.bonk = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big" data-name>Duvarlar Geliyor</h2><p class="hud-tip">Duvardaki deliğin şeklini al.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  m.nameEl = scene.querySelector('[data-name]');
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      m.cur[i] = p ? body(p.lm, p.ar) : null;
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'Geliyor!', voice: 'go-duvar' });
  if (!ctx.life.alive || m.over) return;
  m.running = true;
  next(ctx);
}

function next(ctx) {
  const { m, cam } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.list.length) {
    end(ctx);
    return;
  }
  const pose = m.list[m.k];
  // Duvar süresi: 5 saniyeden 3 saniyeye iner
  m.dur = Math.max(3, 5 - m.k * 0.3);
  m.t0 = ctx.now();
  m.res = [null, null];
  m.walls = [0, 1].map((i) => wallTexture(pose.fig, i === cam.leftIs ? '#8fc9ff' : '#ffb0cf'));
  m.nameEl.textContent = pose.name;
  scoreboard.setMid(`Duvar ${m.k + 1} / ${m.list.length}`);
  sfx.rise(0.8);
}

function judge(ctx) {
  const { m, cam, fx } = ctx;
  const pose = m.list[m.k];
  for (const i of [0, 1]) {
    const b = m.cur[i];
    const side = cam.sideOf(i);
    let ok = false;
    let sim = 0;
    if (b) {
      ok = pose.test(b, side);
      sim = similarity(figVec(pose.fig), poseVec(b));
    }
    const p = cam.players[i];
    const x = p ? p.box.cx : ctx.half(i)[0] + 0.25;
    const y = 0.4;
    if (ok || sim > 0.82) {
      m.res[i] = 'pass';
      m.pass[i]++;
      ctx.score(i, 2, x, y);
      fx.burst(x * cam.W, y * cam.H, { n: 22, colors: [PCOL[i], '#2ed6a0', '#fff'], power: 380, shape: 'star' });
      fx.text(x * cam.W, y * cam.H - 40, 'Geçti! +2', PCOL[i], 24);
      ctx.shoot(i, `${pose.name}: geçti`, { pad: 0.15 });
    } else if (sim > 0.66) {
      m.res[i] = 'close';
      m.pass[i]++;
      ctx.score(i, 1, x, y);
      fx.text(x * cam.W, y * cam.H - 40, 'Sıyrıldı! +1', PCOL[i], 22);
    } else {
      m.res[i] = 'bonk';
      m.bonk[i]++;
      fx.burst(x * cam.W, y * cam.H, { n: 26, colors: ['#c98b52', '#8a5a36', '#fff'], power: 460 });
      fx.text(x * cam.W, y * cam.H - 40, 'Bonk!', '#ff4f62', 30);
      ctx.shoot(i, 'Duvara çarptı!', { pad: 0.15 });
    }
  }
  if (m.res.includes('bonk')) {
    sfx.thud(1.4);
    sfx.boing();
    ctx.shake(10);
    announcer.react('bonk');
  } else {
    sfx.success();
    announcer.react('safe');
  }
  ctx.life.timeout(() => next(ctx), 1700);
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { trail: false }); });
  if (m.running && m.k >= 0 && m.k < m.list.length) {
    const el = (ctx.now() - m.t0) / 1000;
    const k = Math.min(1, el / m.dur);
    if (k >= 1 && !m.res[0] && !m.res[1]) {
      m.res = ['wait', 'wait'];
      judge(ctx);
    }
    const judged = m.res[0] && m.res[0] !== 'wait';
    for (const i of [0, 1]) {
      const [a, b] = ctx.half(i);
      const cx = ((a + b) / 2) * W;
      // Perspektif: uzaktan küçük ve soluk gelir, yaklaşınca kadrajı doldurur
      const s = 0.25 + 0.85 * k * k;
      const wh = H * 0.98 * s;
      const ww = wh * (360 / 420);
      const res = m.res[i];
      let alpha = 0.25 + 0.6 * k;
      let dy = 0;
      if (judged) {
        const after = (ctx.now() - m.t0) / 1000 - m.dur;
        alpha = Math.max(0, 0.85 - after * 1.2);
        if (res === 'bonk') dy = Math.sin(after * 30) * 8;
      }
      if (alpha <= 0) continue;
      g.save();
      g.globalAlpha = alpha;
      g.drawImage(m.walls[i], cx - ww / 2, H * 0.52 - wh / 2 + dy, ww, wh);
      g.lineWidth = 4;
      g.strokeStyle = '#2a1636';
      roundRect(g, cx - ww / 2, H * 0.52 - wh / 2 + dy, ww, wh, 10);
      g.stroke();
      g.restore();
      if (!judged) {
        const left = Math.max(0, m.dur - el);
        tag(g, cx, Math.max(30, H * 0.52 - wh / 2 - 24), `${nameOf(i)} · ${left.toFixed(1).replace('.', ',')}`, PCOL[i], 15);
      }
    }
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.running = false;
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.pass[i]}</b> duvardan geçti</span><span><b>${m.bonk[i]}</b> bonk</span>`),
    });
  }, 600);
}
