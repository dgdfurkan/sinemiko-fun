// Anlat Bakalım: yasak kelimeleri kullanmadan anlat, süre bitene kadar ne kadar çok kart o kadar puan

import { html, toHTML, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { TABU_CARDS } from '../data/tabu.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, flipEl } from './common.js';

const RING = 2 * Math.PI * 44;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-tabu"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { turns: 2, seconds: '60', passes: '3', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Anlatan ekrandaki kelimeyi anlatır. Tahminci ekrana arkasını döner.',
        'Kartın altındaki yasak kelimeleri ve kelimenin kendisini söylemek yok.',
        'Bilinen her kart anlatana 1 puan. Yasak kelime söylenirse 1 puan gider.',
      ],
      options: html`
        ${optHTML('Kişi Başı Tur', stepperHTML('turns', cfg.turns))}
        ${optHTML('Tur Süresi', segHTML('seconds', [['60', '60 sn'], ['90', '90 sn']], cfg.seconds))}
        ${optHTML('Pas Hakkı', segHTML('passes', [['3', '3'], ['5', '5'], ['99', 'Sınırsız']], cfg.passes))}
        ${optHTML('İlk Anlatan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'play',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="turns"]'), { value: cfg.turns, min: 1, max: 4, onChange: (v) => { cfg.turns = v; } });
    const segs = ['seconds', 'passes', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  async function startGame() {
    g = { turn: 0, total: cfg.turns * 2, first: 0, deck: shuffle(TABU_CARDS), seconds: Number(cfg.seconds), passes: Number(cfg.passes), over: false };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Anlatıyor?' }) : Number(cfg.first);
    gear();
  }

  function drawCard() {
    if (!g.deck.length) g.deck = shuffle(TABU_CARDS);
    return g.deck.pop();
  }

  function gear() {
    const teller = (g.first + g.turn) % 2;
    const guesser = other(teller);
    scoreboard.setMid(`Tur ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(teller);
    const slot = (i) => (i === teller
      ? html`<div class="duo-slot">${avatar(i, { mood: 'laugh', pose: 'cheer' })}<span class="role-chip p${i}">Anlatıyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { mood: 'wow', pose: 'think' })}<span class="role-chip p${i}">Tahmin Ediyor</span></div>`);
    const scene = stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(teller)} Anlatıyor</h2>
      <p class="t-lead" data-in>${nameOf(guesser)} ekrana arkasını dönsün. Süre ${g.seconds} saniye, pas hakkı ${g.passes > 50 ? 'sınırsız' : g.passes}.</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('play')}Başla</button>`, {
      go: async () => {
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Anlat!' });
        if (stage.scene === scene) play(teller);
      },
    });
  }

  const cardInner = ([word, banned]) => html`
    <div class="tb-word">${word}</div>
    <div class="tb-banned">
      <span class="tb-label">Yasak</span>
      ${banned.map((b) => html`<span class="tb-ban">${b}</span>`)}
    </div>`;

  function play(teller) {
    const t = { done: false, got: 0, taboo: 0, passLeft: g.passes, log: [], card: drawCard() };
    const passLabel = () => (t.passLeft > 50 ? 'Pas' : `Pas (${t.passLeft})`);
    const scene = stage.show(html`
      <div class="wh-top" data-in>
        <div class="timer-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr-bg" cx="50" cy="50" r="44"/><circle class="tr-fg" cx="50" cy="50" r="44" style="stroke-dasharray:${RING};stroke-dashoffset:0"/></svg><span class="tr-num">${g.seconds}</span></div>
        <div class="wh-count"><span class="wh-got" data-net>0</span><span class="wh-lbl">puan</span></div>
      </div>
      <div class="tb-wrap" data-in><div class="tb-card card">${cardInner(t.card)}</div></div>
      <div class="row" data-in>
        <button class="btn btn--bad" data-act="taboo">${icon('x')}Yasak!<span class="pts">−1</span></button>
        <button class="btn" data-act="pass" data-pass>${icon('skip')}${passLabel()}</button>
        <button class="btn btn--good btn--big" data-act="got" data-primary>${icon('check')}Bildi!<span class="pts">+1</span></button>
      </div>
      <p class="key-hint" data-in><span class="key">Enter</span> bildi <span class="key">P</span> pas <span class="key">Y</span> yasak</p>`, {
      got: (b) => mark('got', b),
      taboo: (b) => mark('taboo', b),
      pass: (b) => mark('pass', b),
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat) return false;
        const map = { KeyP: 'pass', KeyY: 'taboo', KeyT: 'taboo' };
        const act = map[e.code];
        if (!act) return false;
        e.preventDefault();
        const b = scene.querySelector(`[data-act="${act}"]`);
        if (b && !b.disabled) b.click();
        return true;
      },
    });
    const card = scene.querySelector('.tb-card');
    const net = scene.querySelector('[data-net]');
    const passBtn = scene.querySelector('[data-pass]');

    function nextCard() {
      t.card = drawCard();
      const c = t.card;
      flipEl(card, () => { card.innerHTML = toHTML(cardInner(c)); });
    }

    function mark(kind, btn) {
      if (t.done) return;
      t.log.push([kind, t.card[0]]);
      if (kind === 'got') {
        t.got++;
        scoreboard.add(teller, 1, btn);
        sfx.success();
        const r = btn.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top, { count: 30, power: 10 });
      } else if (kind === 'taboo') {
        t.taboo++;
        scoreboard.add(teller, -1, btn);
        sfx.buzz();
        card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-14px) rotate(-2deg)' }, { transform: 'translateX(12px) rotate(2deg)' }, { transform: 'translateX(0)' }], { duration: 360 });
      } else {
        if (t.passLeft <= 0) return;
        t.passLeft--;
        sfx.boing();
        passBtn.innerHTML = toHTML(html`${icon('skip')}${passLabel()}`);
        passBtn.disabled = t.passLeft <= 0;
      }
      net.textContent = String(t.got - t.taboo);
      nextCard();
    }

    const fg = scene.querySelector('.tr-fg');
    const num = scene.querySelector('.tr-num');
    const ring = scene.querySelector('.timer-ring');
    const endAt = performance.now() + g.seconds * 1000;
    let lastSec = g.seconds;
    const timer = life.interval(() => {
      if (t.done) return;
      const left = Math.max(0, (endAt - performance.now()) / 1000);
      const sec = Math.ceil(left);
      fg.style.strokeDashoffset = String(RING * (1 - left / g.seconds));
      if (sec !== lastSec) {
        lastSec = sec;
        num.textContent = String(sec);
        if (sec <= 5 && sec > 0) sfx.tick(5 - sec);
        ring.classList.toggle('hurry', sec <= 10);
      }
      if (left <= 0) {
        t.done = true;
        clearInterval(timer);
        turnEnd(teller, t);
      }
    }, 100);
  }

  function turnEnd(teller, t) {
    sfx.whistle();
    const last = g.turn + 1 >= g.total;
    const icons = { got: 'check', taboo: 'x', pass: 'skip' };
    stage.show(html`
      <div class="big-blob" data-in>${avatar(teller, t.got > t.taboo ? { mood: 'laugh', eyes: 'happy', pose: 'cheer' } : { mood: 'sad', props: 'sweat' })}</div>
      <h2 class="t-title" data-in>Süre Bitti!</h2>
      <p class="big-stat" data-in><b>${t.got - t.taboo}</b> puan</p>
      <div class="tb-log" data-in>${t.log.map(([k, w]) => html`<span class="tb-chip ${k}">${icon(icons[k])}${w}</span>`)}</div>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Tur'}${icon('arrow')}</button>`, {
      next: () => {
        g.turn++;
        if (g.turn >= g.total) final();
        else gear();
      },
    });
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İkiniz de Usta Anlatıcı' } });
    const sub = fin.winner === -1 ? 'Anlatmakta ikiniz de çok iyisiniz.' : `En iyi anlatıcı ${nameOf(fin.winner)}.`;
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
