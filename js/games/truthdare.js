// Doğruluk mu Cesaret mi?: çark çevrilir, çıkan görev yapılır

import { html, Life, shuffle, rand } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { TRUTHS, DARES, MIMICS, SWEETS } from '../data/truthdare.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, popIn } from './common.js';

const SLICES = [
  { k: 'truth', label: 'Doğruluk', color: '#ff4f62' },
  { k: 'dare', label: 'Cesaret', color: '#ffcd3c' },
  { k: 'mimic', label: 'Taklit', color: '#4fb6ff' },
  { k: 'truth', label: 'Doğruluk', color: '#2ed6a0' },
  { k: 'dare', label: 'Cesaret', color: '#ff8a3d' },
  { k: 'sweet', label: 'Tatlı Görev', color: '#ff6fae' },
  { k: 'choose', label: 'Sen Seç', color: '#a98bff' },
  { k: 'joker', label: 'Joker', color: '#a6e35a' },
];
const SEG = 360 / SLICES.length;
const KIND_TITLES = { truth: 'Doğruluk', dare: 'Cesaret', mimic: 'Taklit', sweet: 'Tatlı Görev', choose: 'Sen Seç', joker: 'Joker' };

function wheelSVG() {
  const R = 190;
  const C = 200;
  const parts = SLICES.map((s, i) => {
    const a0 = ((i * SEG - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
    const x0 = C + Math.cos(a0) * R;
    const y0 = C + Math.sin(a0) * R;
    const x1 = C + Math.cos(a1) * R;
    const y1 = C + Math.sin(a1) * R;
    const mid = i * SEG + SEG / 2;
    return `<path d="M${C},${C} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${s.color}" stroke="#2a1636" stroke-width="4"/>
      <g transform="rotate(${mid} ${C} ${C})"><text x="${C}" y="${C - R + 102}" text-anchor="middle" class="wheel-txt" transform="rotate(90 ${C} ${C - R + 95})">${s.label}</text></g>`;
  }).join('');
  const dots = Array.from({ length: SLICES.length }, (_, i) => {
    const a = ((i * SEG - 90) * Math.PI) / 180;
    return `<circle cx="${(C + Math.cos(a) * (R - 10)).toFixed(1)}" cy="${(C + Math.sin(a) * (R - 10)).toFixed(1)}" r="5" fill="#fff" stroke="#2a1636" stroke-width="2.5"/>`;
  }).join('');
  return `<svg class="wheel" viewBox="0 0 400 400" aria-hidden="true">
    <circle cx="200" cy="200" r="196" fill="#2a1636"/>
    <g class="wheel-rot">${parts}${dots}</g>
    <circle cx="200" cy="200" r="36" fill="#fffcf6" stroke="#2a1636" stroke-width="5"/>
    <circle cx="200" cy="200" r="12" fill="#ff4f62" stroke="#2a1636" stroke-width="4"/>
  </svg>`;
}

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-td"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { rounds: 10, level: '1', first: 'random' };
  let g = null;
  let rotation = 0;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Sırası gelen çarkı çevirir. Çıkan kartı okur ve yapar.',
        'Yapılan her görev 1 puan getirir. Joker bedava puandır.',
        'Herkesin oyun boyunca bir pas hakkı var. Pas geçen puan alamaz.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds), 'Sıra her turda değişir.')}
        ${optHTML('Seviye', segHTML('level', [['0', 'Tatlı'], ['1', 'Eğlenceli'], ['2', 'Cesur']], cfg.level))}
        ${optHTML('İlk Çeviren', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'spin',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 4, max: 30, step: 2, onChange: (v) => { cfg.rounds = v; } });
    const s1 = bindSeg(scene.querySelector('[data-seg="level"]'), { value: cfg.level, onChange: (v) => { cfg.level = v; } });
    const s2 = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => { s1.destroy(); s2.destroy(); });
  }

  function deckOf(list, level) {
    return shuffle(list.filter(([lv]) => lv <= level).map(([, t]) => t));
  }

  async function startGame() {
    const level = Number(cfg.level);
    g = {
      round: 0, total: cfg.rounds, first: 0, over: false, passes: [1, 1],
      decks: { truth: deckOf(TRUTHS, level), dare: deckOf(DARES, level), mimic: shuffle(MIMICS), sweet: shuffle(SWEETS) },
      level,
    };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Çeviriyor?' }) : Number(cfg.first);
    spin();
  }

  function draw(kind) {
    const d = g.decks[kind];
    if (!d.length) {
      const src = { truth: deckOf(TRUTHS, g.level), dare: deckOf(DARES, g.level), mimic: shuffle(MIMICS), sweet: shuffle(SWEETS) };
      g.decks[kind] = src[kind];
    }
    return g.decks[kind].pop();
  }

  function spin() {
    const p = (g.first + g.round) % 2;
    let spinning = false;
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    scoreboard.setActive(p);
    const scene = stage.show(html`
      <h2 class="t-title" data-in>${pSpan(p)} Çeviriyor</h2>
      <div class="wheel-box" data-in>
        <div class="wheel-pointer"><svg viewBox="0 0 40 50" aria-hidden="true"><path d="M4 4h32L20 46z" fill="#2a1636"/><path d="M10 9h20L20 34z" fill="#fff"/></svg></div>
        <button class="wheel-btn hit" data-act="spin" data-silent aria-label="Çarkı çevir">${{ __html: wheelSVG() }}</button>
      </div>
      <button class="btn btn--primary btn--big nudge" data-act="spin" data-primary>${icon('spin')}Çarkı Çevir</button>`, {
      spin: () => go(),
    }, {
      onKey: (e, typing) => {
        if (typing || e.code !== 'Space') return false;
        e.preventDefault();
        if (!e.repeat) go();
        return true;
      },
    });
    const rot = scene.querySelector('.wheel-rot');
    const pointer = scene.querySelector('.wheel-pointer');
    rot.style.transform = `rotate(${rotation}deg)`;

    function go() {
      if (spinning) return;
      spinning = true;
      scene.querySelectorAll('[data-act="spin"]').forEach((b) => { b.disabled = true; });
      sfx.whoosh();
      const idx = Math.floor(Math.random() * SLICES.length);
      const jitter = rand(-SEG * 0.35, SEG * 0.35);
      const want = (360 - (idx * SEG + SEG / 2 + jitter) + 360) % 360;
      const from = rotation;
      const delta = (want - (from % 360) + 360) % 360;
      const to = from + 360 * 5 + delta;
      const dur = 4300;
      const t0 = performance.now();
      let lastSeg = Math.floor((((360 - (from % 360)) % 360)) / SEG);
      life.raf((now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - t, 4);
        rotation = from + (to - from) * e;
        rot.style.transform = `rotate(${rotation}deg)`;
        const seg = Math.floor((((360 - (rotation % 360)) % 360)) / SEG);
        if (seg !== lastSeg) {
          lastSeg = seg;
          sfx.wheelTick();
          pointer.classList.remove('flick');
          void pointer.offsetWidth;
          pointer.classList.add('flick');
        }
        if (t >= 1) {
          rotation = to % 360;
          rot.style.transform = `rotate(${rotation}deg)`;
          life.timeout(() => land(p, SLICES[idx]), 350);
          return false;
        }
        return true;
      });
    }
  }

  function land(p, slice) {
    sfx.ding();
    if (slice.k === 'joker') return showJoker(p);
    if (slice.k === 'choose') return showChoose(p);
    showCard(p, slice.k, draw(slice.k));
  }

  function cardHTML(p, kind, text) {
    const color = SLICES.find((s) => s.k === kind)?.color || '#ff4f62';
    return html`
      <div class="td-card card" style="--tc:${color}" data-in>
        <span class="td-kind">${KIND_TITLES[kind]}</span>
        <p class="td-text">${text}</p>
      </div>`;
  }

  function doneButtons(p) {
    const canPass = g.passes[p] > 0;
    return html`
      <div class="row" data-in>
        <button class="btn btn--bad" data-act="pass" ${canPass ? '' : 'disabled'}>${icon('skip')}${canPass ? 'Pas Geç' : 'Pas Hakkı Bitti'}</button>
        <button class="btn btn--good btn--big nudge" data-act="done" data-primary>${icon('check')}Yaptı!<span class="pts">+1</span></button>
      </div>`;
  }

  function showCard(p, kind, text) {
    stage.show(html`
      <div class="td-head" data-in>${avatar(p, { mood: 'wow', pose: kind === 'mimic' ? 'cheer' : 'think' })}<span class="t-big">${pSpan(p)}</span></div>
      ${cardHTML(p, kind, text)}
      ${doneButtons(p)}`, {
      done: (b) => finish(p, true, b),
      pass: (b) => finish(p, false, b),
    });
  }

  function showChoose(p) {
    const o = other(p);
    const scene = stage.show(html`
      <div class="td-head" data-in>${avatar(o, { mood: 'smirk', pose: 'think' })}<span class="t-big">${pSpan(o)} Seçiyor</span></div>
      <p class="t-lead" data-in>${nameOf(p)} için ne olsun?</p>
      <div class="row" data-in>
        <button class="btn btn--big" data-act="pick" data-k="truth">Doğruluk</button>
        <button class="btn btn--big btn--primary" data-act="pick" data-k="dare">Cesaret</button>
      </div>`, {
      pick: (b) => showCard(p, b.dataset.k, draw(b.dataset.k)),
    });
    popIn(scene.querySelectorAll('.btn'));
  }

  function showJoker(p) {
    stage.show(html`
      <div class="big-blob" data-in>${avatar(p, { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'crown' })}</div>
      <h2 class="t-title" data-in>Joker!</h2>
      <p class="t-lead" data-in>${nameOf(p)} bu turu bedavaya geçiyor ve 1 puan kazanıyor.</p>
      <button class="btn btn--primary btn--big nudge" data-act="done" data-primary data-once>${icon('star')}Puanı Al</button>`, {
      done: (b) => finish(p, true, b),
    });
    sfx.fanfare();
  }

  function finish(p, did, btn) {
    if (g.lock === g.round) return;
    g.lock = g.round;
    if (did) {
      scoreboard.add(p, 1, btn);
      sfx.success();
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, { count: 50, power: 12, shapes: ['heart', 'star', 'rect'] });
    } else {
      g.passes[p]--;
      sfx.boing();
    }
    g.round++;
    life.timeout(() => {
      if (g.round >= g.total) final();
      else spin();
    }, did ? 700 : 350);
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İkiniz de Cesursunuz' } });
    const sub = fin.winner === -1 ? 'Hiçbiriniz geri adım atmadı.' : `Bu gecenin en cesuru ${nameOf(fin.winner)}.`;
    stage.show(html`
      ${fin.html}
      <p class="t-lead" data-in>${sub}</p>
      ${finaleButtons()}`, {
      home: () => navigate('#/'),
      again: () => startGame(),
    });
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
