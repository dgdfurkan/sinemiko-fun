// Bomba!: kategori çıkar, bomba kimdeyse bir şey söyleyip karşıya atar, gizli fitil bitince patlar

import { html, toHTML, Life, shuffle, rand } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { genitive, locative } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { BOMB_CATEGORIES, FUSES } from '../data/bomb.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, popIn } from './common.js';

const KEYS = { KeyA: 0, KeyL: 1 };
const SPOT = ['17%', '83%'];

const BOMB_SVG = `
<svg class="bomb-svg" viewBox="0 0 170 170" aria-hidden="true">
  <path d="M110 52 C116 30 134 20 150 26" fill="none" stroke="#2a1636" stroke-width="11" stroke-linecap="round"/>
  <path d="M110 52 C116 30 134 20 150 26" fill="none" stroke="#c98f55" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 5"/>
  <rect x="92" y="40" width="30" height="24" rx="6" transform="rotate(38 107 52)" fill="#5b4a85" stroke="#2a1636" stroke-width="5"/>
  <circle cx="78" cy="104" r="58" fill="#3a2d5c" stroke="#2a1636" stroke-width="6"/>
  <ellipse cx="54" cy="79" rx="17" ry="9" transform="rotate(-38 54 79)" fill="#fff" opacity=".32"/>
  <g class="bomb-face">
    <ellipse cx="62" cy="104" rx="10" ry="12" fill="#fff"/>
    <ellipse cx="94" cy="104" rx="10" ry="12" fill="#fff"/>
    <circle class="bomb-pupil" cx="63" cy="107" r="5" fill="#2a1636"/>
    <circle class="bomb-pupil" cx="95" cy="107" r="5" fill="#2a1636"/>
    <path class="bomb-mouth calm" d="M68 128 Q78 136 88 128" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse class="bomb-mouth scared" cx="78" cy="131" rx="6" ry="7" fill="#fff"/>
    <path class="bomb-sweat" d="M118 78 C114 86 113 92 118 94 C123 95 125 90 121 84 Z" fill="#9fdcff" stroke="#2a1636" stroke-width="2.5"/>
  </g>
  <g class="bomb-spark"><path d="M150 12 L154 22 L164 26 L154 30 L150 40 L146 30 L136 26 L146 22 Z" fill="#ffcd3c" stroke="#ff8a3d" stroke-width="2.5"/></g>
</svg>`;

const BOOM_SVG = `
<svg class="boom-svg" viewBox="0 0 260 220" aria-hidden="true">
  <path d="M130 6 L152 58 L206 26 L190 82 L252 92 L198 120 L240 170 L178 156 L170 214 L132 168 L94 214 L86 156 L22 172 L64 122 L8 92 L70 82 L52 24 L108 58 Z" fill="#ffcd3c" stroke="#2a1636" stroke-width="7" stroke-linejoin="round"/>
  <path d="M130 46 L144 80 L180 62 L170 96 L210 104 L174 122 L198 152 L160 142 L152 178 L130 148 L106 178 L100 142 L62 152 L86 122 L50 104 L90 96 L80 62 L116 80 Z" fill="#ff8a3d"/>
  <text x="130" y="128" text-anchor="middle" class="boom-txt">Bum!</text>
</svg>`;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-bomb"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { target: '5', fuse: 'normal', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Ekranda bir kategori çıkar. Bomba kimdeyse o kategoriden bir şey söyler.',
        html`Söyleyince kendi tuşuna basıp bombayı karşıya atar. ${nameOf(0)} <span class="key">A</span>, ${nameOf(1)} <span class="key">L</span> kullanır.`,
        'Fitilin ne zaman biteceği belli değil. Bomba kimin elinde patlarsa rakibi puanı alır.',
        'Tekrar eden ya da takılan bombayı atamaz, bomba elinde kalır.',
      ],
      options: html`
        ${optHTML('Kazanma Puanı', segHTML('target', [['3', '3'], ['5', '5'], ['7', '7']], cfg.target))}
        ${optHTML('Fitil', segHTML('fuse', [['kisa', 'Kısa'], ['normal', 'Normal'], ['uzun', 'Uzun']], cfg.fuse))}
        ${optHTML('İlk Başlayan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'play',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    const segs = [
      bindSeg(scene.querySelector('[data-seg="target"]'), { value: cfg.target, onChange: (v) => { cfg.target = v; } }),
      bindSeg(scene.querySelector('[data-seg="fuse"]'), { value: cfg.fuse, onChange: (v) => { cfg.fuse = v; } }),
      bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } }),
    ];
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  async function startGame() {
    g = { target: Number(cfg.target), deck: shuffle(BOMB_CATEGORIES), round: 0, over: false, holder: 0 };
    scoreboard.show({ mode: 'versus', mid: `İlk ${g.target} puan` });
    g.holder = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'Bomba Kimde Başlıyor?' }) : Number(cfg.first);
    round();
  }

  function drawCategory() {
    if (!g.deck.length) g.deck = shuffle(BOMB_CATEGORIES);
    return g.deck.pop();
  }

  const half = (i) => html`
    <button class="buzz-half bomb-half p${i}" data-act="pass" data-p="${i}" data-silent aria-label="${nameOf(i)} bombayı atar">
      ${avatar(i, { mood: 'smirk' })}
      <span class="bh-name">${nameOf(i)}</span>
      <span class="key bh-key">${i ? 'L' : 'A'}</span>
      <span class="bh-hold">Bomba sende!</span>
    </button>`;

  function round() {
    g.round++;
    const r = { category: drawCategory(), holder: g.holder, state: 'ready', passes: 0, fuse: 0, start: 0 };
    scoreboard.setActive(r.holder);
    const scene = stage.show(html`
      <div class="buzz-arena bomb-arena">
        ${half(0)}
        <div class="buzz-center bomb-center">
          <span class="wc-cat" data-in>Kategori</span>
          <div class="bomb-cat card" data-in>${r.category}</div>
          <p class="bomb-status t-lead" data-in data-status>Bomba önce ${locative(nameOf(r.holder))}.</p>
          <div class="center-actions" data-actions data-in>
            <button class="btn btn--primary btn--big nudge" data-act="light" data-primary>${icon('sparkle')}Fitili Yak</button>
          </div>
        </div>
        ${half(1)}
        <div class="bomb" style="--bx:${SPOT[r.holder]}"><div class="bomb-hop"><div class="bomb-inner">${{ __html: BOMB_SVG }}</div></div></div>
      </div>`, {
      light: () => light(),
      pass: (b) => pass(Number(b.dataset.p)),
      next: () => {
        if (scoreboard.scores.some((s) => s >= g.target)) final();
        else round();
      },
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat || !(e.code in KEYS)) return false;
        e.preventDefault();
        pass(KEYS[e.code]);
        return true;
      },
    });
    const arena = scene.querySelector('.bomb-arena');
    const bomb = scene.querySelector('.bomb');
    const hop = scene.querySelector('.bomb-hop');
    const inner = scene.querySelector('.bomb-inner');
    const status = scene.querySelector('[data-status]');
    const actions = scene.querySelector('[data-actions]');
    const halves = [...scene.querySelectorAll('.bomb-half')];
    const markHolder = () => halves.forEach((h, i) => h.classList.toggle('holding', i === r.holder));
    markHolder();

    function light() {
      if (r.state !== 'ready') return;
      r.state = 'lit';
      const [a, b] = FUSES[cfg.fuse] || FUSES.normal;
      r.fuse = rand(a, b) * 1000;
      r.start = performance.now();
      arena.classList.add('lit');
      actions.innerHTML = '';
      status.textContent = 'Fitil yandı! Söyle ve at.';
      sfx.go();
      tick();
    }

    function tick() {
      if (r.state !== 'lit' || stage.scene !== scene) return;
      const elapsed = performance.now() - r.start;
      const p = Math.min(1, elapsed / r.fuse);
      if (elapsed >= r.fuse) {
        explode();
        return;
      }
      sfx.bombTick(p);
      if (Math.random() < 0.6) sfx.fuse();
      inner.style.setProperty('--sk', `${(0.5 - p * 0.42).toFixed(3)}s`);
      arena.classList.toggle('panic', p > 0.6);
      // Sona yaklaştıkça tik sıklaşır
      const wait = Math.max(110, 620 - p * 520);
      life.timeout(tick, Math.min(wait, r.fuse - elapsed + 5));
    }

    function pass(p) {
      if (r.state !== 'lit') {
        if (r.state === 'ready') react(halves[p].querySelector('.blob'), 'wiggle');
        return;
      }
      if (p !== r.holder) {
        halves[p].animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 });
        return;
      }
      r.holder = other(p);
      r.passes++;
      sfx.pass();
      bomb.style.setProperty('--bx', SPOT[r.holder]);
      hop.classList.remove('hopping');
      void hop.offsetWidth;
      hop.classList.add('hopping');
      markHolder();
      scoreboard.setActive(r.holder);
      react(halves[r.holder].querySelector('.blob'), 'jump');
      status.textContent = `${r.passes}. atış. Bomba şimdi ${locative(nameOf(r.holder))}!`;
    }

    function explode() {
      r.state = 'boom';
      const loser = r.holder;
      const winner = other(loser);
      g.holder = loser;
      sfx.boom();
      arena.classList.remove('lit', 'panic');
      arena.classList.add('boom');
      inner.innerHTML = BOOM_SVG;
      const br = bomb.getBoundingClientRect();
      burst(br.left + br.width / 2, br.top + br.height / 2, { count: 120, power: 20, colors: ['#ffcd3c', '#ff8a3d', '#ff4f62', '#2a1636', '#5b4a85'], shapes: ['star', 'rect', 'circle'] });
      setBlob(halves[loser].querySelector('.blob'), { mood: 'wow', eyes: 'open', props: 'sweat', pose: 'ears' });
      setBlob(halves[winner].querySelector('.blob'), { mood: 'laugh', eyes: 'happy', pose: 'cheer' });
      scoreboard.add(winner, 1, bomb);
      const done = scoreboard.scores[winner] >= g.target;
      status.innerHTML = toHTML(html`Bomba <span class="t-p${loser + 1}">${genitive(nameOf(loser))}</span> elinde patladı!`);
      actions.innerHTML = toHTML(html`<button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${done ? 'Sonuçları Gör' : 'Sonraki Kategori'}${icon('arrow')}</button>`);
      popIn(actions.children);
    }
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores);
    const sub = fin.winner === -1 ? 'İkiniz de bombayı çok iyi attınız.' : `Bomba en çok ${genitive(nameOf(other(fin.winner)))} elinde patladı.`;
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
