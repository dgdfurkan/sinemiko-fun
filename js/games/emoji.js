// Emoji Avı: emojiler bir şeyi saklar, ilk basan cevap verir

import { html, toHTML, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { stepperHTML, bindStepper, chipsHTML, bindChips } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { EMOJI_CATS } from '../data/emoji.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, finaleButtons, other } from './common.js';

const BUZZ_KEYS = { KeyA: 0, KeyL: 1 };
const SECONDS = 30;

// "Aslan Kral" -> "A____ K___"
const hintOf = (answer) => answer.split(' ').map((w) => (w.length ? w[0] + '_'.repeat(Math.max(0, [...w].length - 1)) : w)).join(' ');
const splitEmoji = (s) => {
  if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return [...s];
};

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-emoji"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { count: 12, cats: new Set(['film', 'sarki', 'deyim']) };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Ekrana emojiler gelir. Bir film, şarkı, deyim ya da yemek saklıyorlar.',
        html`Bildiğini düşünen ilk basar. ${nameOf(0)} <span class="key">A</span>, ${nameOf(1)} <span class="key">L</span> tuşunu kullanır. Ekranda kendi tarafına dokunmak da olur.`,
        'Basan cevabı yüksek sesle söyler. Doğruysa 2 puan alır, yanlışsa rakibi 1 puan kazanır.',
      ],
      options: html`
        ${optHTML('Soru Sayısı', stepperHTML('count', cfg.count))}
        ${optHTML('Kategoriler', chipsHTML('cats', EMOJI_CATS.map((c) => [c.id, c.name]), cfg.cats))}`,
      start: 'Başla',
      startIcon: 'keyboard',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="count"]'), { value: cfg.count, min: 5, max: 25, onChange: (v) => { cfg.count = v; } });
    bindChips(scene.querySelector('[data-chips="cats"]'), { values: cfg.cats, onChange: (s) => { cfg.cats = s; } });
  }

  function startGame() {
    const pool = EMOJI_CATS.filter((c) => cfg.cats.has(c.id)).flatMap((c) => c.items.map(([e, a]) => ({ e, a, cat: c.name })));
    g = { deck: shuffle(pool).slice(0, Math.min(cfg.count, pool.length)), i: 0, over: false };
    scoreboard.show({ mode: 'versus', mid: `1 / ${g.deck.length}` });
    ready();
  }

  const half = (i) => html`
    <button class="buzz-half p${i} hit" data-act="buzz" data-p="${i}" data-silent aria-label="${nameOf(i)} bas">
      ${avatar(i, { mood: 'smirk' })}
      <span class="bh-name">${nameOf(i)}</span>
      <span class="key bh-key">${i ? 'L' : 'A'}</span>
    </button>`;

  function ready() {
    stage.show(html`
      <div class="buzz-arena">
        ${half(0)}
        <div class="buzz-center">
          <h2 class="t-title" data-in>Parmaklar Tuşlarda!</h2>
          <p class="t-lead" data-in>${nameOf(0)} <span class="key">A</span>, ${nameOf(1)} <span class="key">L</span>. Bildiğin an bas.</p>
          <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('play')}Başlat</button>
        </div>
        ${half(1)}
      </div>`, {
      go: async () => {
        const center = stage.scene.querySelector('.buzz-center');
        center.classList.add('counting-soft');
        await countdown(center, life, { final: 'Bas!' });
        puzzle();
      },
      buzz: (b) => {
        const svg = b.querySelector('.blob');
        react(svg, 'jump');
        sfx.buzzer(Number(b.dataset.p));
      },
    });
  }

  function puzzle() {
    const q = g.deck[g.i];
    const state = { phase: 'open', buzzer: -1, timer: 0 };
    scoreboard.setMid(`${g.i + 1} / ${g.deck.length}`);
    const emojis = splitEmoji(q.e);
    const scene = stage.show(html`
      <div class="buzz-arena">
        ${half(0)}
        <div class="buzz-center">
          <span class="wc-cat" data-in>${q.cat}</span>
          <div class="emoji-card card" data-in>
            <div class="emoji-row">${emojis.map((e, i) => html`<span class="em" style="--i:${i}">${e}</span>`)}</div>
            <div class="emoji-hint" data-hint></div>
          </div>
          <div class="time-bar" data-in><span class="tb-fill"></span></div>
          <div class="center-actions" data-actions></div>
        </div>
        ${half(1)}
      </div>`, {
      buzz: (b) => buzz(Number(b.dataset.p)),
      show: () => showAnswer(),
      right: (b) => judge(true, b),
      wrong: (b) => judge(false, b),
      next: () => {
        g.i++;
        if (g.i >= g.deck.length) final();
        else puzzle();
      },
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat) return false;
        if (e.code in BUZZ_KEYS) {
          e.preventDefault();
          buzz(BUZZ_KEYS[e.code]);
          return true;
        }
        return false;
      },
    });
    sfx.sparkle();
    const fill = scene.querySelector('.tb-fill');
    const hint = scene.querySelector('[data-hint]');
    const actions = scene.querySelector('[data-actions]');
    const start = performance.now();
    let hinted = false;
    state.timer = life.interval(() => {
      if (state.phase !== 'open') return;
      const t = (performance.now() - start) / 1000;
      fill.style.transform = `scaleX(${Math.max(0, 1 - t / SECONDS)})`;
      if (!hinted && t >= SECONDS / 2) {
        hinted = true;
        hint.textContent = hintOf(q.a);
        hint.classList.add('on');
        sfx.soft();
      }
      if (t >= SECONDS) timeUp();
    }, 100);

    function setActions(tpl) {
      actions.innerHTML = toHTML(tpl);
      [...actions.children].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(16px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 60, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' }));
    }

    function buzz(p) {
      if (state.phase !== 'open') return;
      state.phase = 'buzzed';
      state.buzzer = p;
      clearInterval(state.timer);
      sfx.buzzer(p);
      scene.querySelector('.buzz-arena').classList.add(`buzzed-${p}`);
      const svg = scene.querySelector(`.buzz-half.p${p} .blob`);
      setBlob(svg, { mood: 'wow', pose: 'cheer' });
      react(svg, 'jump');
      setActions(html`
        <p class="t-big"><span class="t-p${p + 1}">${nameOf(p)}</span>, söyle!</p>
        <button class="btn btn--primary nudge" data-act="show" data-primary>${icon('eyeOff')}Cevabı Göster</button>`);
    }

    function timeUp() {
      if (state.phase !== 'open') return;
      state.phase = 'done';
      clearInterval(state.timer);
      sfx.fail();
      reveal();
      setActions(html`
        <p class="t-lead">Süre doldu, kimse basmadı.</p>
        <button class="btn btn--primary nudge" data-act="next" data-primary data-once>${g.i + 1 >= g.deck.length ? 'Sonuçları Gör' : 'Sıradaki'}${icon('arrow')}</button>`);
    }

    function reveal() {
      const card = scene.querySelector('.emoji-card');
      hint.textContent = q.a;
      hint.classList.add('on', 'answer');
      card.classList.add('answered');
      sfx.flip();
    }

    function showAnswer() {
      if (state.phase !== 'buzzed') return;
      state.phase = 'judging';
      reveal();
      const p = state.buzzer;
      setActions(html`
        <p class="t-lead">${nameOf(p)} doğru mu söyledi?</p>
        <div class="row">
          <button class="btn btn--bad" data-act="wrong">${icon('x')}Yanlış<span class="pts">+1 ${nameOf(other(p))}</span></button>
          <button class="btn btn--good" data-act="right" data-primary>${icon('check')}Doğru<span class="pts">+2</span></button>
        </div>`);
    }

    function judge(ok, btn) {
      if (state.phase !== 'judging') return;
      state.phase = 'done';
      const p = state.buzzer;
      const winner = ok ? p : other(p);
      const pts = ok ? 2 : 1;
      scoreboard.add(winner, pts, btn);
      const r = btn.getBoundingClientRect();
      if (ok) {
        sfx.success();
        burst(r.left + r.width / 2, r.top, { count: 60, power: 13 });
      } else {
        sfx.fail();
      }
      setBlob(scene.querySelector(`.buzz-half.p${p} .blob`), ok ? { mood: 'laugh', eyes: 'happy', pose: 'cheer' } : { mood: 'sad', pose: 'rest', props: 'sweat' });
      setActions(html`
        <p class="t-lead">${ok ? `${nameOf(p)} bildi!` : `${nameOf(other(p))} 1 puan kaptı.`}</p>
        <button class="btn btn--primary nudge" data-act="next" data-primary data-once>${g.i + 1 >= g.deck.length ? 'Sonuçları Gör' : 'Sıradaki'}${icon('arrow')}</button>`);
    }
  }

  function final() {
    g.over = true;
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İki Emoji Ustası' } });
    const sub = fin.winner === -1 ? 'Emojileri ikiniz de aynı hızla çözüyorsunuz.' : `Emoji dilini en iyi ${nameOf(fin.winner)} konuşuyor.`;
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
