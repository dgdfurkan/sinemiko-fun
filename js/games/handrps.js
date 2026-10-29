// Klasik Taş Kağıt Makas: "Taş! Kağıt! Makas!" denir, son kelimede elini at. Kamera hakemlik yapar.
// Yumruk taş, açık el kağıt, iki parmak makas. İlk N eli alan kazanır

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, PCOL, tag, missingText } from './arena.js';
import { gesture } from '../vision/hands.js';
import { divider, drawPlayerHands, handIdle } from './handkit.js';

const THROW = { fist: 'tas', open: 'kagit', four: 'kagit', peace: 'makas', three: 'makas' };
const ICON = { tas: '✊', kagit: '✋', makas: '✌️' };
const NAME = { tas: 'Taş', kagit: 'Kağıt', makas: 'Makas' };
const BEATS = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
const ACC = { tas: 'Taşı', kagit: 'Kağıdı', makas: 'Makası' };

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-handrps',
    kind: 'hand',
    cfg: { to: '3' },
    rules: [
      '"Taş! Kağıt! Makas!" denir. Son kelimede elini at: yumruk taş, açık el kağıt, iki parmak makas.',
      'Kamera hakem: iki elin de aynı anda okunur. Erken ya da geç atan elde sayılmaz.',
      'İlk hedefe ulaşan kazanır.',
    ],
    options: (cfg) => optHTML('Kaç El Alan Kazanır', segHTML('to', [['3', '3'], ['5', '5'], ['7', '7']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Eller Hazır',
    waitTip: 'Bir elinizi kameraya, herkes kendi yarısında gösterin.',
    voices: ['rps-1', 'rps-2', 'rps-3', 'tie-rps', 'point'],
    tie: 'Berabere!',
    albumTitle: 'Taş Kağıt Makas',
    mid: (cfg) => `${cfg.to} elde biter`,
    idle: handIdle,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.to = Number(cfg.to);
  m.phase = 'idle';
  m.throws = [null, null];
  m.samples = [[], []];
  m.live = [null, null];
  m.rounds = 0;
  m.ties = 0;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big rps-chant" data-call>Hazır mısınız?</h2></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  m.callEl = scene.querySelector('[data-call]');
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      const gs = p && p.hands ? p.hands.map((h) => THROW[gesture(h, p.ar)]).filter(Boolean) : [];
      m.live[i] = gs[0] || null;
      if (m.phase === 'read') m.samples[i].push(gs[0] || null);
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  ctx.counted = true;
  round(ctx);
}

async function round(ctx) {
  const { m, life } = ctx;
  if (m.over) return;
  m.throws = [null, null];
  m.samples = [[], []];
  m.phase = 'chant';
  scoreboard.setMid(`El ${m.rounds + 1}`);
  await life.sleep(700);
  for (const [k, word] of [[1, 'Taş!'], [2, 'Kağıt!'], [3, 'Makas!']]) {
    if (m.over) return;
    m.callEl.textContent = word;
    m.callEl.animate([{ transform: 'scale(1.6)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    announcer.say(`rps-${k}`);
    sfx.tick(k);
    await life.sleep(620);
  }
  // Son kelimeden hemen sonra kısa okuma: çoğunluk kazanır
  m.phase = 'read';
  m.callEl.textContent = 'Göster!';
  await life.sleep(550);
  if (m.over) return;
  m.phase = 'judge';
  m.throws = m.samples.map((list) => {
    const c = {};
    for (const v of list) if (v) c[v] = (c[v] || 0) + 1;
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 2 ? best[0] : null;
  });
  judge(ctx);
}

function judge(ctx) {
  const { m, cam, fx } = ctx;
  const [a, b] = m.throws;
  if (!a || !b) {
    const who = !a && !b ? 'İkinizin de elini' : `${nameOf(a ? 1 : 0)} elini`;
    m.callEl.textContent = `${who} göremedim, tekrar!`;
    sfx.boing();
    ctx.life.timeout(() => round(ctx), 1700);
    return;
  }
  m.rounds++;
  if (a === b) {
    m.ties++;
    m.callEl.textContent = `İkiniz de ${NAME[a]}!`;
    announcer.react('tie-rps');
    sfx.boing();
    ctx.life.timeout(() => round(ctx), 1800);
    return;
  }
  const w = BEATS[a] === b ? 0 : 1;
  m.callEl.textContent = `${NAME[m.throws[w]]} ${ACC[m.throws[1 - w]]} yener!`;
  const [h0, h1] = ctx.half(w);
  const x = (h0 + h1) / 2;
  ctx.score(w, 1, x, 0.45);
  sfx.success();
  announcer.react('point');
  fx.burst(x * cam.W, cam.H * 0.45, { n: 26, colors: [PCOL[w], '#ffcd3c', '#fff'], power: 420, shape: 'star' });
  ctx.shoot(w, `${NAME[m.throws[w]]} kazandı`, { pad: 0.35 });
  if (ctx.pts[w] >= m.to) {
    m.phase = 'end';
    sfx.whistle();
    ctx.life.timeout(() => ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${ctx.pts[i]}</b> el</span>`),
      sub: `${m.rounds} el oynandı, ${m.ties} kez aynı şeyi attınız.`,
    }), 1600);
    return;
  }
  ctx.life.timeout(() => round(ctx), 2000);
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  divider(g, cam.W, cam.H);
  drawPlayerHands(g, cam, players);
  for (const i of [0, 1]) {
    const [a, b] = ctx.half(i);
    const x = ((a + b) / 2) * cam.W;
    const t = m.phase === 'judge' && m.throws[i] ? m.throws[i] : m.phase === 'read' ? null : m.live[i];
    if (m.phase === 'judge' && m.throws[i]) {
      g.font = '400 110px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ICON[m.throws[i]], x, cam.H * 0.5);
    }
    tag(g, x, cam.H - 40, t ? `${nameOf(i)} · ${NAME[t]}` : nameOf(i), PCOL[i], 16);
  }
  fx.draw(g, dt);
}
