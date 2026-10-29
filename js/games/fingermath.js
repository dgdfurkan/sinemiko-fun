// Parmak Hesabı: ekrana bir işlem gelir, cevabı parmaklarınla göster. İki elini birden kullanabilirsin.
// Doğru sayıyı ilk gösteren puanı alır. Sıfır için yumruk göster

import { html, randInt, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, PCOL, tag, missingText } from './arena.js';
import { fingers } from '../vision/hands.js';
import { divider, drawPlayerHands, handIdle } from './handkit.js';

const Q_SEC = 9;
const HOLD = 0.45;

function question(level) {
  for (;;) {
    const kind = pick(level < 3 ? ['+', '+', '-'] : ['+', '-', '×', '-', '+']);
    let a;
    let b;
    let ans;
    if (kind === '+') { a = randInt(0, 7); b = randInt(0, 10 - a); ans = a + b; }
    else if (kind === '-') { a = randInt(2, 15); b = randInt(0, a); ans = a - b; }
    else { a = randInt(1, 5); b = randInt(0, 2); ans = a * b; }
    if (ans <= 10) return { text: `${a} ${kind} ${b}`, ans };
  }
}

const countOf = (p, ar) => (p && p.hands ? p.hands.reduce((s, h) => s + fingers(h, ar).count, 0) : -1);

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-fingermath',
    kind: 'hand',
    cfg: { count: '10' },
    rules: [
      'Ekrana bir işlem gelir. Cevabı parmaklarınla göster: iki elini birden kullanabilirsin, sıfır için yumruk.',
      'Doğru sayıyı bir an tutan ilk kişi puanı alır.',
      'Herkes ellerini kendi yarısında tutsun; ortadaki çizgiyi geçmeyin.',
    ],
    options: (cfg) => optHTML('Soru Sayısı', segHTML('count', [['6', '6'], ['10', '10'], ['15', '15']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Elleri Göster',
    waitTip: 'Ellerinizi kameraya, herkes kendi yarısında gösterin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-hesap', 'point'],
    tie: 'Berabere! İki Matematikçi',
    albumTitle: 'Parmak Hesabı',
    mid: (cfg) => `Soru 1 / ${cfg.count}`,
    idle: handIdle,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.total = Number(cfg.count);
  m.k = -1;
  m.q = null;
  m.n = [-1, -1];
  m.hold = [0, 0];
  m.phase = 'wait';
  m.right = [0, 0];
  m.fast = [99, 99];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card fm-card"><p class="fm-q" data-q>?</p><p class="hud-tip" data-tip>Cevabı parmaklarınla göster.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${Q_SEC}</b> sn</span></div>`);
  m.qEl = scene.querySelector('[data-q]');
  m.tipEl = scene.querySelector('[data-tip]');
  m.clockEl = scene.querySelector('[data-clock]');
  const warn = scene.querySelector('[data-warn]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    players.forEach((p, i) => {
      const n = countOf(p, p ? p.ar : 1.78);
      if (n !== m.n[i]) m.hold[i] = 0;
      m.n[i] = n;
      if (m.phase === 'ask' && n === m.q.ans) {
        m.hold[i] += dt;
        if (m.hold[i] >= HOLD) win(ctx, i);
      }
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'Hesapla!', voice: 'go-hesap' });
  if (!ctx.life.alive || m.over) return;
  next(ctx);
}

function next(ctx) {
  const { m } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.total) {
    end(ctx);
    return;
  }
  m.q = question(m.k);
  m.hold = [0, 0];
  m.phase = 'ask';
  m.t0 = ctx.now();
  m.qEl.textContent = `${m.q.text} = ?`;
  m.tipEl.textContent = 'Cevabı parmaklarınla göster.';
  m.qEl.animate([{ transform: 'scale(.5) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  scoreboard.setMid(`Soru ${m.k + 1} / ${m.total}`);
  sfx.flip();
  m.clock = ctx.clock(m.clockEl, Q_SEC, { onEnd: () => timeout(ctx) });
}

function win(ctx, i) {
  const { m, cam, fx } = ctx;
  if (m.phase !== 'ask') return;
  m.phase = 'done';
  m.clock.stop();
  const secs = (ctx.now() - m.t0) / 1000;
  m.right[i]++;
  m.fast[i] = Math.min(m.fast[i], secs);
  m.qEl.textContent = `${m.q.text} = ${m.q.ans}`;
  m.tipEl.textContent = `${nameOf(i)} buldu! ${secs.toFixed(1).replace('.', ',')} saniye`;
  const [a, b] = ctx.half(i);
  const x = (a + b) / 2;
  ctx.score(i, 1, x, 0.5);
  sfx.success();
  announcer.react('point');
  fx.burst(x * cam.W, cam.H * 0.5, { n: 26, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 420, shape: 'star' });
  if (secs < 2.5) ctx.shoot(i, `${m.q.text} = ${m.q.ans}`, { pad: 0.3 });
  ctx.life.timeout(() => next(ctx), 1500);
}

function timeout(ctx) {
  const { m } = ctx;
  if (m.phase !== 'ask') return;
  m.phase = 'done';
  m.qEl.textContent = `${m.q.text} = ${m.q.ans}`;
  m.tipEl.textContent = 'Süre doldu, kimse bulamadı.';
  sfx.boing();
  ctx.life.timeout(() => next(ctx), 1500);
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  divider(g, cam.W, cam.H);
  drawPlayerHands(g, cam, players);
  for (const i of [0, 1]) {
    const [a, b] = ctx.half(i);
    const x = ((a + b) / 2) * cam.W;
    const n = m.n[i];
    const y = cam.H * 0.82;
    const ok = m.phase === 'ask' && m.q && n === m.q.ans;
    g.beginPath();
    g.arc(x, y, 40, 0, Math.PI * 2);
    g.fillStyle = ok ? '#2ed6a0' : '#fffcf6';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = PCOL[i];
    g.stroke();
    if (ok) {
      g.beginPath();
      g.arc(x, y, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.hold[i] / HOLD));
      g.lineWidth = 6;
      g.strokeStyle = '#2ed6a0';
      g.stroke();
    }
    g.font = '400 42px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a1636';
    g.fillText(n < 0 ? '?' : String(n), x, y + 2);
    tag(g, x, y - 62, nameOf(i), PCOL[i], 15);
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.phase = 'end';
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.right[i]}</b> doğru</span><span><b>${m.fast[i] < 99 ? m.fast[i].toFixed(1).replace('.', ',') : '-'}</b> sn en hızlı</span>`),
    });
  }, 600);
}
