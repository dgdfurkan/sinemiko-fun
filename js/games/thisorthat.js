// Bu mu O mu?: iki oyuncu aynı klavyede gizlice seçer, sonra seçimler açılır

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { questionParticle } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { stepperHTML, bindStepper } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { PAIRS, MATCH_TITLES } from '../data/thisorthat.js';
import { lobbyHTML, optHTML, celebrate, finaleButtons } from './common.js';

const KEYS = [
  { KeyA: 0, KeyD: 1 },
  { ArrowLeft: 0, ArrowRight: 1, KeyJ: 0, KeyL: 1 },
];
const KEY_LABELS = [['A', 'D'], ['←', '→']];

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-tot"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { count: 12 };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Ekranda iki seçenek belirir. İkiniz de aynı anda, birbirinize göstermeden seçersiniz.',
        html`${nameOf(0)} <span class="key">A</span> ve <span class="key">D</span>, ${nameOf(1)} <span class="key">←</span> ve <span class="key">→</span> tuşlarını kullanır.`,
        'İkiniz de seçince cevaplar açılır. Aynı şeyi seçtiğiniz her soru takıma puan getirir.',
      ],
      options: html`${optHTML('Soru Sayısı', stepperHTML('count', cfg.count))}`,
      start: 'Başla',
      startIcon: 'keyboard',
      note: 'Dokunmatik ekranda her oyuncunun kendi tarafındaki düğmeleri de çalışır.',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="count"]'), { value: cfg.count, min: 5, max: 30, onChange: (v) => { cfg.count = v; } });
  }

  function startGame() {
    g = { deck: shuffle(PAIRS).slice(0, cfg.count), i: 0, matches: 0, over: false };
    scoreboard.show({ mode: 'team', mid: `1 / ${g.deck.length}` });
    choose();
  }

  function choose() {
    const [a, b] = g.deck[g.i];
    const picks = [null, null];
    let revealed = false;
    let revealTimer = 0;
    scoreboard.setMid(`${g.i + 1} / ${g.deck.length}`);
    const panel = (i) => html`
      <div class="tot-p p${i}" data-p="${i}">
        ${avatar(i, { mood: 'flat', pose: 'think' })}
        <div class="tot-p-info">
          <span class="tot-name">${nameOf(i)}</span>
          <span class="tot-status">Seçiyor</span>
        </div>
        <div class="tot-keys">
          <button class="key tot-k" data-act="pick" data-p="${i}" data-side="0" aria-label="${nameOf(i)} sol seçenek">${KEY_LABELS[i][0]}</button>
          <button class="key tot-k" data-act="pick" data-p="${i}" data-side="1" aria-label="${nameOf(i)} sağ seçenek">${KEY_LABELS[i][1]}</button>
        </div>
      </div>`;
    const scene = stage.show(html`
      <p class="t-hand" data-in>${g.i + 1}. soru</p>
      <div class="tot-split" data-in>
        <div class="tot-opt l"><span>${a}</span></div>
        <div class="tot-mid">${questionParticle(a)}</div>
        <div class="tot-opt r"><span>${b}</span></div>
      </div>
      <div class="tot-players" data-in>${panel(0)}${panel(1)}</div>`, {
      pick: (btn) => choosePick(Number(btn.dataset.p), Number(btn.dataset.side)),
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat) return false;
        for (let p = 0; p < 2; p++) {
          if (e.code in KEYS[p]) {
            e.preventDefault();
            choosePick(p, KEYS[p][e.code]);
            const k = scene.querySelector(`.tot-k[data-p="${p}"][data-side="${KEYS[p][e.code]}"]`);
            if (k) {
              k.classList.add('pressed');
              life.timeout(() => k.classList.remove('pressed'), 140);
            }
            return true;
          }
        }
        return false;
      },
    });

    function choosePick(p, side) {
      if (revealed) return;
      const first = picks[p] === null;
      picks[p] = side;
      const box = scene.querySelector(`.tot-p[data-p="${p}"]`);
      box.classList.add('locked');
      box.querySelector('.tot-status').textContent = 'Seçti';
      if (first) sfx.lock();
      box.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      if (picks[0] !== null && picks[1] !== null) {
        clearTimeout(revealTimer);
        // Son anda fikir değiştirmek için kısa bir pay
        revealTimer = life.timeout(() => reveal([a, b], picks.slice()), 650);
        revealed = false;
      }
    }

    function reveal(opts, final) {
      if (revealed || stage.scene !== scene) return;
      revealed = true;
      const match = final[0] === final[1];
      if (match) g.matches++;
      const last = g.i + 1 >= g.deck.length;
      const side = (s) => html`
        <div class="tot-opt ${s ? 'r' : 'l'} ${final.includes(s) ? 'chosen' : 'empty'}">
          <span>${opts[s]}</span>
          <div class="tot-who">${[0, 1].filter((p) => final[p] === s).map((p) => avatar(p, { mood: match ? 'laugh' : 'smirk', eyes: match ? 'happy' : 'open', pose: match ? 'cheer' : 'rest' }))}</div>
        </div>`;
      const s2 = stage.show(html`
        <p class="t-hand" data-in>${g.i + 1}. soru</p>
        <div class="tot-split revealed" data-in>${side(0)}<div class="tot-mid">${match ? icon('heart') : questionParticle(opts[0])}</div>${side(1)}</div>
        <h2 class="t-title" data-in>${match ? 'Aynı Kafa!' : 'Zıt Kutuplar!'}</h2>
        <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Soru'}${icon('arrow')}</button>`, {
        next: () => {
          g.i++;
          if (g.i >= g.deck.length) final_();
          else choose();
        },
      });
      if (match) {
        sfx.success();
        const mid = s2.querySelector('.tot-mid');
        scoreboard.add('team', 1, mid);
        const r = mid.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { count: 70, power: 14, shapes: ['heart', 'star', 'rect'] });
      } else {
        sfx.boing();
      }
    }
  }

  function final_() {
    g.over = true;
    const total = g.deck.length;
    const ratio = g.matches / total;
    const pct = Math.round(ratio * 100);
    const [, title, sub] = MATCH_TITLES.find(([min]) => ratio >= min);
    const record = store.setBest('thisorthat', pct);
    stage.show(html`
      <div class="duo-stage" data-in>
        <div class="duo-slot">${avatar(0, { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: ratio >= 0.7 ? 'heart' : '' })}</div>
        <div class="duo-slot">${avatar(1, { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: ratio >= 0.7 ? 'heart' : '' })}</div>
      </div>
      <p class="big-stat" data-in><b>%${pct}</b> uyum</p>
      <h2 class="t-title" data-in>${title}</h2>
      <p class="t-lead" data-in>${sub} ${total} sorunun ${g.matches} tanesinde aynı şeyi seçtiniz.${record ? ' Bu yeni rekorunuz!' : ''}</p>
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
