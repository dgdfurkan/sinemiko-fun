// Ne Kadar Tanıyorsun?: biri kendi cevabını gizlice seçer, diğeri tahmin eder

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { genitive } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { QUIZ, QUIZ_TITLES } from '../data/quiz.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan } from './common.js';

const fill = (q, i) => q.replace('{G}', genitive(nameOf(i))).replace('{N}', nameOf(i));
const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-quiz"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { per: 5, first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Soru birinizle ilgili. O kişi kendi cevabını gizlice seçer, diğeri o sırada bakmaz.',
        'Sonra diğeri, partnerinin ne seçtiğini tahmin eder.',
        'Doğru tahmin 1 puan. Sonunda kimin partnerini daha iyi tanıdığı belli olur.',
      ],
      options: html`
        ${optHTML('Kişi Başı Soru', stepperHTML('per', cfg.per))}
        ${optHTML('İlk Soru Kimin Hakkında', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'heart',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="per"]'), { value: cfg.per, min: 3, max: 10, onChange: (v) => { cfg.per = v; } });
    const seg = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => seg.destroy());
  }

  async function startGame() {
    g = { i: 0, total: cfg.per * 2, first: 0, deck: shuffle(QUIZ), matches: 0, over: false };
    scoreboard.show({ mode: 'versus', mid: `1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Soru Kimin Hakkında?' }) : Number(cfg.first);
    secret();
  }

  const options = (opts, act) => html`
    <div class="qz-opts">
      ${opts.map((o, k) => html`<button class="qz-opt" data-act="${act}" data-k="${k}"><span class="key">${k + 1}</span><span class="qz-txt">${o}</span></button>`)}
    </div>`;

  const digitKey = (scene, act) => (e, typing) => {
    if (typing || e.repeat || !(e.code in DIGITS)) return false;
    e.preventDefault();
    const b = scene().querySelector(`[data-act="${act}"][data-k="${DIGITS[e.code]}"]`);
    if (b) b.click();
    return true;
  };

  function secret() {
    if (!g.deck.length) g.deck = shuffle(QUIZ);
    const [q, opts] = g.deck.pop();
    const subject = (g.first + g.i) % 2;
    const guesser = other(subject);
    g.cur = { q, opts, subject, guesser, pick: -1, guess: -1 };
    scoreboard.setMid(`${g.i + 1} / ${g.total}`);
    scoreboard.setActive(subject);
    stage.show(html`
      <div class="qz-head" data-in>${avatar(subject, { mood: 'smirk', pose: 'think' })}<p class="t-hand">${nameOf(guesser)} baksın istemiyoruz. Sadece ${nameOf(subject)} seçsin.</p></div>
      <h2 class="qz-q" data-in>${fill(q, subject)}</h2>
      <div data-in>${options(opts, 'pick')}</div>`, {
      pick: (b) => {
        g.cur.pick = Number(b.dataset.k);
        sfx.lock();
        handoff();
      },
    }, { onKey: digitKey(() => stage.scene, 'pick') });
  }

  function handoff() {
    const c = g.cur;
    scoreboard.setActive(c.guesser);
    const scene = stage.show(html`
      <div class="qz-head" data-in>${avatar(c.guesser, { mood: 'wow', pose: 'cheer' })}<p class="t-hand">${nameOf(c.subject)} seçti. ${nameOf(c.guesser)}, şimdi sıra sende!</p></div>
      <h2 class="qz-q" data-in>${fill(c.q, c.subject)}</h2>
      <div data-in>${options(c.opts, 'guess')}</div>`, {
      guess: (b) => {
        c.guess = Number(b.dataset.k);
        reveal();
      },
    }, { onKey: digitKey(() => stage.scene, 'guess') });
    // Seçim tıklaması yanlışlıkla tahmine dönüşmesin diye kısa bir bekleme
    const btns = scene.querySelectorAll('[data-act="guess"]');
    btns.forEach((b) => { b.disabled = true; });
    life.timeout(() => btns.forEach((b) => { b.disabled = false; }), 900);
  }

  function reveal() {
    const c = g.cur;
    const match = c.pick === c.guess;
    if (match) g.matches++;
    const last = g.i + 1 >= g.total;
    const scene = stage.show(html`
      <h2 class="qz-q" data-in>${fill(c.q, c.subject)}</h2>
      <div class="qz-opts revealed" data-in>
        ${c.opts.map((o, k) => html`
          <div class="qz-opt ${k === c.pick ? 'is-pick' : ''} ${k === c.guess ? 'is-guess' : ''}">
            <span class="qz-txt">${o}</span>
            <span class="qz-badges">
              ${k === c.pick ? html`<span class="qz-badge p${c.subject}">${avatar(c.subject, { mood: 'happy' })}</span>` : ''}
              ${k === c.guess ? html`<span class="qz-badge p${c.guesser}">${avatar(c.guesser, { mood: match ? 'laugh' : 'wow' })}</span>` : ''}
            </span>
          </div>`)}
      </div>
      <h2 class="t-title" data-in>${match ? html`${pSpan(c.guesser)} Bildi!` : 'Tanışalım mı?'}</h2>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Soru'}${icon('arrow')}</button>`, {
      next: () => {
        g.i++;
        if (g.i >= g.total) final();
        else secret();
      },
    });
    if (match) {
      sfx.success();
      const hit = scene.querySelector('.is-pick');
      scoreboard.add(c.guesser, 1, hit);
      const r = hit.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 60, power: 12, shapes: ['heart', 'star', 'rect'] });
    } else {
      sfx.boing();
    }
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const ratio = g.matches / g.total;
    const [, title, sub] = QUIZ_TITLES.find(([min]) => ratio >= min);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! Birbirinizi Eşit Tanıyorsunuz' } });
    stage.show(html`
      ${fin.html}
      <p class="t-lead" data-in><b>${title}.</b> ${sub} ${g.total} sorunun ${g.matches} tanesini bildiniz.</p>
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
