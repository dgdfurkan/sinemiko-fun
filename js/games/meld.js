// Aynı Kafa: üçe kadar sayıp aynı anda kelime söylenir, iki kelimeyi birleştiren ortak kelimede buluşulur

import { html, Life } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { norm } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { stepperHTML, bindStepper } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate, finaleButtons } from './common.js';

const RATINGS = [
  [3, 'Telepati', 'Aynı beyni paylaşıyorsunuz.'],
  [5, 'Aynı Kafa', 'Düşünceleriniz çabucak buluşuyor.'],
  [8, 'Yolu Uzun Ama Güzel', 'Biraz dolandınız ama buluştunuz.'],
  [Infinity, 'Maceracı Beyinler', 'Uzun bir yolculuktu, değdi.'],
];

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-meld"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { games: 3 };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Üçe kadar sayılır, ikiniz de aklınıza gelen ilk kelimeyi aynı anda söylersiniz.',
        'Sonra iki kelimeyi birleştiren yeni bir kelime düşünür, yine aynı anda söylersiniz. Örneğin “deniz” ve “ateş” için “güneş”.',
        'Aynı kelimeyi söyleyene kadar devam edersiniz. Ne kadar az denemede buluşursanız o kadar iyi.',
      ],
      options: html`${optHTML('Oyun Sayısı', stepperHTML('games', cfg.games), 'Her oyun aynı kelimede buluşunca biter.')}`,
      start: 'Başla',
      startIcon: 'sparkle',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="games"]'), { value: cfg.games, min: 1, max: 5, onChange: (v) => { cfg.games = v; } });
  }

  function startGame() {
    g = { game: 0, total: cfg.games, results: [], over: false };
    scoreboard.show({ mode: 'team', mid: `Oyun 1 / ${g.total}` });
    newMeld();
  }

  function newMeld() {
    g.chain = [];
    scoreboard.setMid(`Oyun ${g.game + 1} / ${g.total}`);
    attempt();
  }

  const chainHTML = (chain, small = false) => html`
    <div class="meld-chain ${small ? 'small' : ''}">
      ${chain.map(([a, b], i) => html`
        <div class="mc-row">
          <span class="mc-n">${i + 1}</span>
          <span class="mc-word p0">${a || '?'}</span>
          <span class="mc-plus">${icon('heart')}</span>
          <span class="mc-word p1">${b || '?'}</span>
        </div>`)}
    </div>`;

  function attempt() {
    const n = g.chain.length + 1;
    const prev = g.chain[g.chain.length - 1];
    const lead = n === 1
      ? 'Aklınıza gelen herhangi bir kelimeyi aynı anda söyleyin.'
      : prev && prev[0] && prev[1]
        ? html`<b>${prev[0]}</b> ile <b>${prev[1]}</b> kelimelerini birleştiren bir kelime düşünün.`
        : 'Az önce söylediğiniz iki kelimeyi birleştiren bir kelime düşünün.';
    const scene = stage.show(html`
      <div class="duo-stage small" data-in>
        <div class="duo-slot">${avatar(0, { mood: 'flat', pose: 'think' })}</div>
        <div class="duo-slot">${avatar(1, { mood: 'flat', pose: 'think' })}</div>
      </div>
      <h2 class="t-title" data-in>${n}. Deneme</h2>
      <p class="t-lead" data-in>${lead}</p>
      ${g.chain.length ? html`<div data-in>${chainHTML(g.chain.slice(-3), true)}</div>` : ''}
      <button class="btn btn--primary btn--big nudge" data-act="count" data-primary data-once>${icon('sparkle')}Hazırız, Say!</button>`, {
      count: async () => {
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Söyle!' });
        if (stage.scene === scene) answer(n);
      },
    });
  }

  function answer(n) {
    const scene = stage.show(html`
      <h2 class="t-title" data-in>Ne Dediniz?</h2>
      <p class="t-lead" data-in>İsterseniz yazın, zincirde görünsün. Boş da bırakabilirsiniz.</p>
      <div class="meld-inputs" data-in>
        <label class="meld-in p0">${avatar(0, { mood: 'wow' })}<input class="field" data-w="0" maxlength="24" placeholder="${nameOf(0)} ne dedi?" autocomplete="off" autofocus></label>
        <label class="meld-in p1">${avatar(1, { mood: 'wow' })}<input class="field" data-w="1" maxlength="24" placeholder="${nameOf(1)} ne dedi?" autocomplete="off"></label>
      </div>
      <div class="row" data-in>
        <button class="btn btn--sm" data-act="giveup">${icon('x')}Pes Ettik</button>
        <button class="btn btn--good" data-act="same">${icon('heart')}Aynı Kelime!</button>
        <button class="btn btn--primary nudge" data-act="diff" data-primary>${icon('arrow')}Farklı, Devam</button>
      </div>`, {
      same: () => done(true),
      diff: () => done(false),
      giveup: () => finishMeld(false),
    }, {
      onKey: (e, typing) => {
        // İlk kutuda Enter ikinci kutuya geçer
        if (e.key === 'Enter' && typing && e.target.dataset.w === '0') {
          e.preventDefault();
          scene.querySelector('[data-w="1"]').focus();
          return true;
        }
        return false;
      },
    });
    const inputs = [...scene.querySelectorAll('[data-w]')];
    const sameBtn = scene.querySelector('[data-act="same"]');
    const diffBtn = scene.querySelector('[data-act="diff"]');
    // İki kelime de yazıldıysa eşleşmeyi kendisi önerir
    const suggest = () => {
      const [a, b] = inputs.map((i) => norm(i.value));
      const both = a && b;
      const same = both && a === b;
      sameBtn.classList.toggle('suggest', !!same);
      sameBtn.toggleAttribute('data-primary', !!same);
      diffBtn.toggleAttribute('data-primary', !same);
      diffBtn.classList.toggle('nudge', !same);
    };
    inputs.forEach((i) => i.addEventListener('input', suggest));

    function done(same) {
      const words = inputs.map((i) => i.value.replace(/\s+/g, ' ').trim());
      g.chain.push(words);
      if (same) finishMeld(true);
      else {
        sfx.boing();
        attempt();
      }
    }
  }

  function finishMeld(success) {
    const tries = g.chain.length;
    g.results.push({ success, tries: success ? tries : null, chain: g.chain.slice() });
    const last = g.game + 1 >= g.total;
    const word = success ? (g.chain[tries - 1].find((w) => w) || '') : '';
    const scene = stage.show(html`
      <div class="duo-stage small" data-in>
        <div class="duo-slot">${avatar(0, success ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'heart' } : { mood: 'sad', props: 'sweat' })}</div>
        <div class="duo-slot">${avatar(1, success ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'heart' } : { mood: 'sad', props: 'sweat' })}</div>
      </div>
      <h2 class="t-title" data-in>${success ? 'Aynı Kafa!' : 'Bu Sefer Olmadı'}</h2>
      <p class="t-lead" data-in>${success ? `${tries}. denemede ${word ? `“${word}” kelimesinde ` : ''}buluştunuz.` : `${tries} deneme yaptınız. Bir dahakine!`}</p>
      ${g.chain.length ? html`<div data-in>${chainHTML(g.chain)}</div>` : ''}
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Yeni Oyun'}${icon('arrow')}</button>`, {
      next: () => {
        g.game++;
        if (g.game >= g.total) final();
        else newMeld();
      },
    });
    if (success) {
      sfx.fanfare();
      const t = scene.querySelector('.t-title');
      scoreboard.add('team', 1, t);
      const r = t.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 120, power: 16, shapes: ['heart', 'star', 'rect'] });
    } else {
      sfx.fail();
    }
  }

  function final() {
    g.over = true;
    const wins = g.results.filter((r) => r.success);
    const avg = wins.length ? wins.reduce((a, r) => a + r.tries, 0) / wins.length : Infinity;
    const best = wins.length ? Math.min(...wins.map((r) => r.tries)) : null;
    const [, title, sub] = RATINGS.find(([max]) => avg <= max);
    const record = best !== null && store.setBest('meldMin', -best);
    stage.show(html`
      <div class="duo-stage" data-in>
        <div class="duo-slot">${avatar(0, { mood: 'laugh', eyes: 'happy', pose: 'cheer' })}</div>
        <div class="duo-slot">${avatar(1, { mood: 'laugh', eyes: 'happy', pose: 'cheer' })}</div>
      </div>
      <p class="big-stat" data-in><b>${wins.length}</b> / ${g.total} buluşma</p>
      <h2 class="t-title" data-in>${wins.length ? title : 'Bir Dahakine'}</h2>
      <p class="t-lead" data-in>${wins.length ? `${sub} Ortalama ${avg.toFixed(1).replace('.', ',')} denemede buluştunuz.` : 'Bu sefer hiç buluşamadınız ama çok eğlenceliydi.'}${record ? ` Yeni rekor: ${best} deneme!` : ''}</p>
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
