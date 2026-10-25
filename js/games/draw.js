// Çiz Bakalım: biri gizli kelimeyi çizer, diğeri tahmin eder; çizimler galeride birikir

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { Sketch } from '../ui/sketch.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { DRAW_WORDS, DRAW_COLORS, DRAW_SIZES } from '../data/draw.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, finaleButtons, other, pSpan } from './common.js';

const RING = 2 * Math.PI * 44;
const TITLES = [
  [0.7, 'Usta Ressamlar', 'Çizimleriniz müzelik.'],
  [0.45, 'Yetenekli Çiftsiniz', 'Çoğu çizim anında anlaşıldı.'],
  [0.2, 'Modern Sanat', 'Herkes anlamasa da çok sanatsaldı.'],
  [0, 'Çöp Adam Ustaları', 'Önemli olan eğlenmek, değil mi?'],
];

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-draw"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { turns: 6, level: 'karisik', seconds: '60', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Çizecek olan gizli kelimeye bakar. Diğeri o sırada ekrana bakmaz.',
        'Süre başlayınca kelimeyi çizer. Harf, rakam ve işaret yazmak yasak.',
        'Tahminci yüksek sesle tahmin eder. Ne kadar hızlı bilinirse takım o kadar çok puan alır.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('turns', cfg.turns), 'Roller her turda değişir.')}
        ${optHTML('Zorluk', segHTML('level', [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor'], ['karisik', 'Karışık']], cfg.level))}
        ${optHTML('Süre', segHTML('seconds', [['60', '60 sn'], ['90', '90 sn']], cfg.seconds))}
        ${optHTML('İlk Çizen', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'pencil',
      note: 'Fareyle, dokunmatik ekranla ya da kalemle çizebilirsin.',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="turns"]'), { value: cfg.turns, min: 2, max: 12, step: 2, onChange: (v) => { cfg.turns = v; } });
    const segs = ['level', 'seconds', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  function buildDeck() {
    const lv = cfg.level;
    const words = lv === 'karisik' ? [...DRAW_WORDS.kolay, ...DRAW_WORDS.orta, ...DRAW_WORDS.zor] : DRAW_WORDS[lv];
    return shuffle(words);
  }

  async function startGame() {
    g = { turn: 0, total: cfg.turns, first: 0, deck: buildDeck(), seconds: Number(cfg.seconds), gallery: [], guessed: 0, over: false };
    scoreboard.show({ mode: 'team', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Çiziyor?' }) : Number(cfg.first);
    peek();
  }

  function drawWord() {
    if (!g.deck.length) g.deck = buildDeck();
    return g.deck.pop();
  }

  function peek() {
    const drawer = (g.first + g.turn) % 2;
    const guesser = other(drawer);
    g.cur = { drawer, guesser, word: drawWord() };
    scoreboard.setMid(`Tur ${g.turn + 1} / ${g.total}`);
    const slot = (i) => (i === drawer
      ? html`<div class="duo-slot">${avatar(i, { mood: 'smirk', pose: 'think' })}<span class="role-chip p${i}">Çiziyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { eyes: 'shut', mood: 'flat', pose: 'ears' })}<span class="role-chip p${i}">Bakmıyor</span></div>`);
    stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(drawer)} Çiziyor</h2>
      <p class="t-lead" data-in>${nameOf(guesser)}, gözlerini kapat. Kelime sadece ${nameOf(drawer)} için.</p>
      <button class="btn btn--primary btn--big nudge" data-act="show" data-primary data-once>${icon('eyeOff')}${nameOf(guesser)} Bakmıyor, Göster</button>`, {
      show: () => wordCard(),
    });
  }

  function wordCard() {
    const c = g.cur;
    const scene = stage.show(html`
      <p class="t-hand" data-in>Sadece ${nameOf(c.drawer)} baksın</p>
      <div class="word-wrap" data-in><div class="word-card card"><span class="wc-cat">Çizeceğin Kelime</span><span class="wc-word">${c.word}</span></div></div>
      <p class="t-lead" data-in>Aklında tut. Başlayınca ${nameOf(c.guesser)} ekrana bakabilir.</p>
      <div class="row" data-in>
        <button class="btn" data-act="swap">${icon('shuffle')}Başka Kelime</button>
        <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('pencil')}Hazırım, Başla</button>
      </div>`, {
      swap: () => {
        c.word = drawWord();
        sfx.flip();
        const w = scene.querySelector('.wc-word');
        w.textContent = c.word;
        w.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      },
      go: async () => {
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Çiz!' });
        if (stage.scene === scene) board();
      },
    });
  }

  function board() {
    const c = g.cur;
    const t = { done: false, left: g.seconds };
    const swatches = DRAW_COLORS.map((col, i) => html`<button class="sw ${i === 0 ? 'on' : ''}" data-act="color" data-c="${col}" style="--sw:${col}" aria-label="Renk ${i + 1}"></button>`);
    const sizes = DRAW_SIZES.map((s, i) => html`<button class="sz ${i === 1 ? 'on' : ''}" data-act="size" data-s="${s}" aria-label="Kalınlık ${i + 1}"><span style="--d:${Math.max(6, s * 1.1)}px"></span></button>`);
    const scene = stage.show(html`
      <div class="draw-layout">
        <div class="draw-top" data-in>
          <div class="timer-ring small"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr-bg" cx="50" cy="50" r="44"/><circle class="tr-fg" cx="50" cy="50" r="44" style="stroke-dasharray:${RING};stroke-dashoffset:0"/></svg><span class="tr-num">${g.seconds}</span></div>
          <p class="t-hand draw-who">${nameOf(c.drawer)} çiziyor, ${nameOf(c.guesser)} tahmin ediyor</p>
          <button class="btn btn--sm peek-btn" data-peek>${icon('eyeOff')}<span data-peek-label>Basılı Tut: Kelime</span></button>
        </div>
        <div class="draw-tools card" data-in>
          <div class="tool-group">${swatches}</div>
          <div class="tool-sep"></div>
          <div class="tool-group">${sizes}</div>
          <div class="tool-sep"></div>
          <div class="tool-group tools">
            <button class="tool-btn" data-act="eraser" aria-label="Silgi" title="Silgi">${icon('eraser')}</button>
            <button class="tool-btn" data-act="undo" aria-label="Geri al" title="Geri al">${icon('back')}</button>
            <button class="tool-btn" data-act="clear" aria-label="Temizle" title="Temizle">${icon('trash')}</button>
          </div>
        </div>
        <div class="draw-paper card" data-in><canvas class="draw-canvas hit"></canvas></div>
        <div class="draw-actions" data-in>
          <button class="btn btn--bad" data-act="giveup">${icon('skip')}Pas</button>
          <button class="btn btn--good btn--big" data-act="got" data-primary>${icon('check')}Bildi!</button>
        </div>
      </div>`, {
      color: (b) => {
        sketch.erase = false;
        sketch.color = b.dataset.c;
        scene.querySelectorAll('.sw, [data-act="eraser"]').forEach((x) => x.classList.toggle('on', x === b));
      },
      size: (b) => {
        sketch.size = Number(b.dataset.s);
        scene.querySelectorAll('.sz').forEach((x) => x.classList.toggle('on', x === b));
      },
      eraser: (b) => {
        sketch.erase = true;
        scene.querySelectorAll('.sw, [data-act="eraser"]').forEach((x) => x.classList.toggle('on', x === b));
      },
      undo: () => sketch.undo(),
      clear: () => sketch.clear(),
      got: () => end(true),
      giveup: () => end(false),
    });
    const sketch = new Sketch(scene.querySelector('.draw-canvas'));
    stage.own(() => sketch.destroy());

    const peekBtn = scene.querySelector('[data-peek]');
    const peekLabel = scene.querySelector('[data-peek-label]');
    const showWord = (on) => { peekLabel.textContent = on ? c.word : 'Basılı Tut: Kelime'; peekBtn.classList.toggle('peeking', on); };
    life.on(peekBtn, 'pointerdown', (e) => { e.preventDefault(); peekBtn.setPointerCapture(e.pointerId); showWord(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => life.on(peekBtn, ev, () => showWord(false)));

    const fg = scene.querySelector('.tr-fg');
    const num = scene.querySelector('.tr-num');
    const ring = scene.querySelector('.timer-ring');
    const endAt = performance.now() + g.seconds * 1000;
    let lastSec = g.seconds;
    const timer = life.interval(() => {
      if (t.done) return;
      t.left = Math.max(0, (endAt - performance.now()) / 1000);
      const sec = Math.ceil(t.left);
      fg.style.strokeDashoffset = String(RING * (1 - t.left / g.seconds));
      if (sec !== lastSec) {
        lastSec = sec;
        num.textContent = String(sec);
        if (sec <= 5 && sec > 0) sfx.tick(5 - sec);
        ring.classList.toggle('hurry', sec <= 10);
      }
      if (t.left <= 0) end(false, true);
    }, 100);

    function end(ok, timeUp = false) {
      if (t.done) return;
      t.done = true;
      clearInterval(timer);
      sketch.enabled = false;
      const pts = ok ? 1 + Math.floor((3 * t.left) / g.seconds) : 0;
      const img = sketch.empty ? null : sketch.snapshot(560);
      g.gallery.push({ word: c.word, drawer: c.drawer, pts, img });
      if (ok) g.guessed++;
      result(pts, timeUp, img);
    }
  }

  function result(pts, timeUp, img) {
    const c = g.cur;
    const last = g.turn + 1 >= g.total;
    const title = pts ? (pts >= 3 ? 'Şimşek Gibi!' : 'Bildi!') : timeUp ? 'Süre Doldu!' : 'Pas Geçildi';
    const scene = stage.show(html`
      <div class="polaroid big ${pts ? '' : 'miss'}" data-in>
        ${img ? html`<img src="${img}" alt="${c.word} çizimi">` : html`<div class="polaroid-empty">Boş tuval</div>`}
        <span class="polaroid-cap">${c.word}</span>
      </div>
      <h2 class="t-title" data-in>${title}</h2>
      <p class="t-lead" data-in>${pts ? `Takım ${pts} puan kazandı.` : `Kelime “${c.word}” idi.`}</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Galeriyi Gör' : 'Sıradaki Tur'}${icon('arrow')}</button>`, {
      next: () => {
        g.turn++;
        if (g.turn >= g.total) final();
        else peek();
      },
    });
    if (pts) {
      sfx.success();
      const card = scene.querySelector('.polaroid');
      scoreboard.add('team', pts, card);
      const r = card.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 3, { count: 70, power: 14 });
    } else {
      sfx.fail();
    }
  }

  function final() {
    g.over = true;
    const score = scoreboard.team;
    const max = g.total * 4;
    const ratio = score / max;
    const [, title, sub] = TITLES.find(([min]) => ratio >= min);
    const record = store.setBest('draw', score);
    stage.show(html`
      <h2 class="t-title" data-in>${title}</h2>
      <p class="t-lead" data-in>${sub} ${g.total} çizimin ${g.guessed} tanesi bilindi, takım ${score} puan topladı.${record ? ' Yeni rekor!' : ''}</p>
      <div class="gallery scroll" data-in>
        ${g.gallery.map((d, i) => html`
          <div class="polaroid" style="--r:${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg">
            ${d.img ? html`<img src="${d.img}" alt="${d.word} çizimi">` : html`<div class="polaroid-empty">Boş</div>`}
            <span class="polaroid-cap">${d.word}</span>
            <span class="polaroid-by name-p${d.drawer + 1}">${nameOf(d.drawer)}${d.pts ? ` +${d.pts}` : ''}</span>
            ${d.img ? html`<button class="ibtn polaroid-dl" data-act="dl" data-i="${i}" aria-label="Çizimi indir">${icon('download')}</button>` : ''}
          </div>`)}
      </div>
      ${finaleButtons()}`, {
      dl: (b) => {
        const d = g.gallery[Number(b.dataset.i)];
        const a = document.createElement('a');
        a.href = d.img;
        a.download = `ciz-bakalim-${d.word.toLocaleLowerCase('tr').replace(/\s+/g, '-')}.png`;
        document.body.append(a);
        a.click();
        a.remove();
      },
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
