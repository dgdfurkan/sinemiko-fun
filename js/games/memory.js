// Hafıza Dansı: ekranda bir poz dizisi gösterilir, sonra ikiniz aynı anda ezberden yaparsınız.
// Her tur dizi bir hamle uzar. İlk şaşıran kaybeder

import { html, raw, toHTML, pick } from '../lib/dom.js';
import { scoreboard } from '../ui/scoreboard.js';
import { getCtx, bus, mtof } from '../audio/engine.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { camDuel, inked, PCOL, tag, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';
import { body, poseById, figSVG } from '../vision/poses.js';

const MOVES = {
  up: { name: 'Eller Havaya', color: '#ffcd3c', note: 72 },
  left: { name: 'Sol El', color: '#4fb6ff', note: 76 },
  right: { name: 'Sağ El', color: '#ff5fa2', note: 79 },
  head: { name: 'Eller Başa', color: '#2ed6a0', note: 67 },
  cross: { name: 'Kollar Çapraz', color: '#a98bff', note: 84 },
};
const ORDER = ['cross', 'head', 'up', 'left', 'right'];
const START = 3;
const MAX = 12;
const HOLD = 300;
const WRONG = 800;
const STEP_MS = 5000;

function classify(b) {
  if (!b) return null;
  for (const id of ORDER) if (poseById(id).test(b)) return id;
  return null;
}

// Her hamlenin kendi notası; Simon gibi
function note(id, dur = 0.32) {
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  for (const [mul, vol] of [[1, 0.16], [2, 0.05]]) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(MOVES[id].note) * mul;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus('sfx'));
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-memory',
    kind: 'pose',
    cfg: {},
    rules: [
      'Ekranda bir poz dizisi gösterilir: eller havaya, sol el, sağ el, eller başa, kollar çapraz.',
      'Dizi bitince ikiniz de aynı anda, ezberden, sırayla yaparsınız. Her pozu kısa bir an tut.',
      'Her tur dizi bir hamle uzar. Her doğru hamle bir puan. İlk şaşıran oyunu bitirir!',
    ],
    options: () => '',
    waitTitle: 'Dans Pisti Hazır',
    waitTip: 'Belinizden yukarısı görünsün, kollarınız rahat aşağıda.',
    voices: ['memory-watch', 'memory-go', 'yay-1', 'yay-2', 'yay-4', 'nope'],
    tie: 'Berabere! Hafızalar Eşit',
    albumTitle: 'Hafıza Dansı',
    mid: () => `${START} hamle`,
    play: (ctx) => {
      Object.assign(ctx.m, { len: START, seq: [] });
      for (let k = 0; k < START; k++) grow(ctx.m);
      showSeq(ctx);
    },
  });
}

function grow(m) {
  const last = m.seq[m.seq.length - 1];
  m.seq.push(pick(Object.keys(MOVES).filter((k) => k !== last)));
}

const cardHTML = (id) => html`
  <div class="mem-card" style="--c:${MOVES[id].color}">${raw(figSVG(poseById(id).fig, MOVES[id].color))}<b>${MOVES[id].name}</b></div>`;

async function showSeq(ctx) {
  const { cam, m, life, fx } = ctx;
  m.state = 'show';
  fx.clear();
  scoreboard.setMid(`${m.seq.length} hamle`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">İyi İzleyin!</h2><p class="hud-tip">${m.seq.length} hamlelik dizi geliyor.</p></div></div>
    <div class="mem-stage" data-show></div>
    <div class="hud-bottom"><div class="mem-dots" data-dots>${m.seq.map(() => html`<i></i>`)}</div><p class="hud-warn" data-warn></p></div>`);
  const host = scene.querySelector('[data-show]');
  const dots = [...scene.querySelectorAll('[data-dots] i')];
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = () => { warn.textContent = missingText(cam); };
  cam.draw = (g, players, dt) => {
    players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { alpha: 0.5, label: '' }); });
    fx.draw(g, dt);
  };
  announcer.say('memory-watch');
  await life.sleep(1300);
  // Diziler uzadıkça hamleler biraz hızlanır
  const on = Math.max(560, 900 - m.seq.length * 30);
  for (let k = 0; k < m.seq.length; k++) {
    if (m.over) return;
    const id = m.seq[k];
    host.innerHTML = toHTML(cardHTML(id));
    host.firstElementChild.animate([{ transform: 'scale(.3) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1.3)' });
    dots[k].style.background = MOVES[id].color;
    dots[k].classList.add('on');
    note(id, 0.45);
    await life.sleep(on);
    host.innerHTML = '';
    dots[k].style.background = '';
    await life.sleep(200);
  }
  if (m.over) return;
  play(ctx, scene);
}

function play(ctx, scene) {
  const { cam, m, fx, life } = ctx;
  m.state = 'do';
  const card = scene.querySelector('.hud-card');
  card.innerHTML = '<h2 class="t-big">Sıra Sizde!</h2><p class="hud-tip">Diziyi sırayla yapın, her pozu bir an tutun.</p>';
  card.animate([{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  announcer.say('memory-go');
  sfx.go();
  const t0 = performance.now();
  m.ps = [0, 1].map(() => ({ k: 0, stepAt: t0, cur: null, since: 0, done: false, fail: false, flash: 0 }));
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      const s = m.ps[i];
      if (s.done || s.fail) return;
      const id = p ? classify(body(p.lm, p.ar)) : null;
      if (id !== s.cur) {
        s.cur = id;
        s.since = now;
      }
      const target = m.seq[s.k];
      const prev = s.k ? m.seq[s.k - 1] : null;
      if (id === target && now - s.since >= HOLD) {
        s.k++;
        s.stepAt = now;
        s.flash = now;
        s.cur = null;
        note(target);
        if (p) fx.burst(p.lm[0].x * cam.W, p.lm[0].y * cam.H - cam.H * 0.2, { n: 10, colors: [MOVES[target].color, '#fff'], power: 260, shape: 'star' });
        if (s.k >= m.seq.length) {
          s.done = true;
          sfx.success();
          announcer.cheer();
        }
      } else if (id && id !== target && id !== prev && now - s.since >= WRONG) {
        fail(ctx, i, `Yanlış! ${MOVES[target].name} olacaktı`);
      } else if (now - s.stepAt > STEP_MS) {
        fail(ctx, i, 'Süre Doldu!');
      }
    });
    if (m.ps.every((s) => s.done || s.fail) && m.state === 'do') {
      m.state = 'judge';
      life.timeout(() => judge(ctx), 900);
    }
  };
  cam.draw = (g, players, dt, t) => {
    players.forEach((p, i) => {
      if (!p) return;
      const s = m.ps[i];
      drawSkeleton(g, cam, p, i, { alpha: 0.85, label: '', glow: s.done ? 1 : 0 });
      // Başın üstünde ilerleme: yapılanlar renkli, sıradaki yanıp söner, hedef gizli
      const n = p.lm[0];
      const r = 9;
      const gap = 24;
      const w = (m.seq.length - 1) * gap;
      const x0 = n.x * cam.W - w / 2;
      const y = Math.max(30, n.y * cam.H - cam.H * 0.26);
      m.seq.forEach((id, k) => {
        g.beginPath();
        g.arc(x0 + k * gap, y, k === s.k && !s.done && !s.fail ? r + 2 + Math.sin(t / 120) * 2 : r, 0, Math.PI * 2);
        if (k < s.k) inked(g, MOVES[id].color, 3);
        else if (s.fail && k === s.k) inked(g, '#ff4f62', 3);
        else inked(g, '#ffffffaa', 3);
      });
      const label = s.done ? 'Tamam!' : s.fail ? 'Şaşırdı!' : `${s.k} / ${m.seq.length}`;
      tag(g, n.x * cam.W, y - 32, label, s.fail ? '#ff4f62' : PCOL[i], 16);
    });
    fx.draw(g, dt);
  };
}

function fail(ctx, i, why) {
  const { m, cam, fx } = ctx;
  const s = m.ps[i];
  s.fail = true;
  sfx.buzzer(i);
  announcer.react('nope');
  const p = cam.players[i];
  if (p) fx.text(p.lm[0].x * cam.W, p.lm[0].y * cam.H - cam.H * 0.33, why, '#ff4f62', 18);
  ctx.shoot(i, 'Şaşırdı!', { pad: 0.12, force: true });
}

function judge(ctx) {
  const { m, cam } = ctx;
  if (m.over) return;
  cam.onFrame = null;
  // Doğru yapılan her hamle bir puan
  m.ps.forEach((s, i) => { if (s.k) ctx.score(i, s.k, 0.5, 0.3, { quiet: true }); });
  const anyFail = m.ps.some((s) => s.fail);
  if (anyFail || m.seq.length >= MAX) {
    const both = m.ps.every((s) => s.done);
    const longest = m.ps.some((s) => s.done) ? m.seq.length : m.seq.length - 1;
    const sub = both ? `${MAX} hamlelik diziyi ikiniz de yaptınız. Efsane!`
      : longest >= START ? `En uzun dizi ${longest} hamle.` : 'İlk dizi biraz zor geldi, bir daha deneyin!';
    ctx.life.timeout(() => ctx.finish({ sub }), 1200);
    return;
  }
  sfx.fanfare();
  grow(m);
  ctx.life.timeout(() => showSeq(ctx), 1200);
}
