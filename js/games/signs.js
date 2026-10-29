// El İşareti Yarışı: ekrana bir el işareti gelir (✌️ 👍 🤘 👌 ...). Elinle aynısını ilk yapan puanı alır

import { html, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, PCOL, tag, missingText } from './arena.js';
import { gesture, GESTURES } from '../vision/hands.js';
import { divider, drawPlayerHands, handIdle } from './handkit.js';

const POOL = ['fist', 'open', 'peace', 'thumb', 'rock', 'ok', 'point', 'call', 'love'];
const Q_SEC = 7;
const HOLD = 0.35;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-signs',
    kind: 'hand',
    cfg: { count: '12' },
    rules: [
      'Ekrana bir el işareti gelir: zafer, süper, rock, tamam, ara beni...',
      'Elinle aynı işareti yapıp bir an tutan ilk kişi puanı alır.',
      'Herkes ellerini kendi yarısında tutsun.',
    ],
    options: (cfg) => optHTML('Kaç İşaret', segHTML('count', [['8', '8'], ['12', '12'], ['16', '16']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Elleri Göster',
    waitTip: 'Ellerinizi kameraya, herkes kendi yarısında gösterin.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-isaret', 'point'],
    tie: 'Berabere! Eller Konuştu',
    albumTitle: 'El İşareti Yarışı',
    mid: (cfg) => `1 / ${cfg.count}`,
    idle: handIdle,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  const list = [];
  while (list.length < Number(cfg.count)) {
    const s = shuffle(POOL.slice());
    if (list.length && s[0] === list[list.length - 1]) s.push(s.shift());
    list.push(...s);
  }
  m.list = list.slice(0, Number(cfg.count));
  m.k = -1;
  m.g = [null, null];
  m.hold = [0, 0];
  m.phase = 'wait';
  m.wins = [0, 0];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card sg-card"><span class="sg-emoji" data-emoji>✋</span><div><h2 class="t-big" data-name>Hazır</h2><p class="hud-tip" data-tip>Aynı işareti ilk yapan kazanır.</p></div></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${Q_SEC}</b> sn</span></div>`);
  m.emojiEl = scene.querySelector('[data-emoji]');
  m.nameEl = scene.querySelector('[data-name]');
  m.tipEl = scene.querySelector('[data-tip]');
  m.clockEl = scene.querySelector('[data-clock]');
  const warn = scene.querySelector('[data-warn]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    players.forEach((p, i) => {
      const gs = p && p.hands ? p.hands.map((h) => gesture(h, p.ar)) : [];
      const want = m.list[m.k];
      const hit = m.phase === 'ask' && gs.includes(want);
      m.g[i] = hit ? want : gs.find(Boolean) || null;
      m.hold[i] = hit ? m.hold[i] + dt : 0;
      if (hit && m.hold[i] >= HOLD) win(ctx, i);
    });
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'Göster!', voice: 'go-isaret' });
  if (!ctx.life.alive || m.over) return;
  next(ctx);
}

function next(ctx) {
  const { m } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.list.length) {
    end(ctx);
    return;
  }
  const id = m.list[m.k];
  m.hold = [0, 0];
  m.phase = 'ask';
  m.emojiEl.textContent = GESTURES[id].emoji;
  m.nameEl.textContent = GESTURES[id].name;
  m.tipEl.textContent = 'Aynısını yap!';
  m.emojiEl.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.3) rotate(10deg)' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  scoreboard.setMid(`${m.k + 1} / ${m.list.length}`);
  sfx.flip();
  m.clock = ctx.clock(m.clockEl, Q_SEC, { onEnd: () => timeout(ctx) });
}

function win(ctx, i) {
  const { m, cam, fx } = ctx;
  if (m.phase !== 'ask') return;
  m.phase = 'done';
  m.clock.stop();
  m.wins[i]++;
  m.tipEl.textContent = `${nameOf(i)} ilk yaptı!`;
  const [a, b] = ctx.half(i);
  const x = (a + b) / 2;
  ctx.score(i, 1, x, 0.5);
  sfx.success();
  announcer.react('point');
  fx.burst(x * cam.W, cam.H * 0.45, { n: 24, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 400, shape: 'star' });
  fx.text(x * cam.W, cam.H * 0.38, GESTURES[m.list[m.k]].emoji, PCOL[i], 34);
  ctx.shoot(i, GESTURES[m.list[m.k]].name, { pad: 0.35 });
  ctx.life.timeout(() => next(ctx), 1300);
}

function timeout(ctx) {
  const { m } = ctx;
  if (m.phase !== 'ask') return;
  m.phase = 'done';
  m.tipEl.textContent = 'Süre doldu!';
  sfx.boing();
  ctx.life.timeout(() => next(ctx), 1200);
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  divider(g, cam.W, cam.H);
  drawPlayerHands(g, cam, players);
  for (const i of [0, 1]) {
    const [a, b] = ctx.half(i);
    const x = ((a + b) / 2) * cam.W;
    const gid = m.g[i];
    const label = gid ? `${GESTURES[gid].emoji} ${GESTURES[gid].name}` : nameOf(i);
    tag(g, x, cam.H - 44, label, gid && gid === m.list[m.k] ? '#2ed6a0' : PCOL[i], 18);
  }
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.phase = 'end';
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.wins[i]}</b> işaret ilk</span>`),
    });
  }, 600);
}
