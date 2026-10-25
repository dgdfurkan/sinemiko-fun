// Kim Daha?: kart açılır, üçe kadar sayılır, ikiniz de aynı anda birini gösterirsiniz

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { capFirst } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { stepperHTML, bindStepper, chipsHTML, bindChips } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { LIKELY_CATS } from '../data/likely.js';
import { lobbyHTML, optHTML, celebrate, finaleButtons, pSpan } from './common.js';

// "Kim film izlerken uyuyakalır?" -> "Film izlerken uyuyakalır"
const toTitle = (q) => capFirst(q.replace(/^Kim\s+/, '').replace(/\?$/, ''));

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-likely"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { count: 14, cats: new Set(['tatli', 'komik', 'gunluk']) };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Ekranda bir soru belirir: "Kim film izlerken uyuyakalır?" gibi.',
        'Üçe kadar sayılır. İkiniz de aynı anda o kişiyi parmağınızla gösterirsiniz.',
        'Kimin seçildiğini işaretleyin. Sonunda kimin hangi unvanı aldığını ve ne kadar anlaştığınızı görün.',
      ],
      options: html`
        ${optHTML('Soru Sayısı', stepperHTML('count', cfg.count), 'TikTok\'taki meşhur sürüm 14 soruluk.')}
        ${optHTML('Kategoriler', chipsHTML('cats', LIKELY_CATS.map((c) => [c.id, c.name]), cfg.cats))}`,
      start: 'Başla',
      startIcon: 'hand',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="count"]'), { value: cfg.count, min: 5, max: 30, onChange: (v) => { cfg.count = v; } });
    bindChips(scene.querySelector('[data-chips="cats"]'), { values: cfg.cats, onChange: (s) => { cfg.cats = s; } });
  }

  function startGame() {
    const pool = LIKELY_CATS.filter((c) => cfg.cats.has(c.id)).flatMap((c) => c.items);
    const deck = shuffle(pool).slice(0, Math.min(cfg.count, pool.length));
    g = { deck, i: 0, titles: [[], []], agree: 0, over: false };
    scoreboard.show({ mode: 'versus', mid: `1 / ${deck.length}` });
    card();
  }

  function card() {
    const q = g.deck[g.i];
    scoreboard.setMid(`${g.i + 1} / ${g.deck.length}`);
    const scene = stage.show(html`
      <div class="duo-stage small" data-in>
        <div class="duo-slot">${avatar(0, { mood: 'smirk' })}</div>
        <div class="duo-slot">${avatar(1, { mood: 'smirk' })}</div>
      </div>
      <div class="q-card card" data-in><span class="q-n">${g.i + 1}. soru</span><span class="q-text">${q}</span></div>
      <button class="btn btn--primary btn--big nudge" data-act="count" data-primary data-once>${icon('hand')}Hazırız, Say!</button>`, {
      count: async () => {
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Göster!' });
        if (stage.scene === scene) pick(q);
      },
    });
  }

  function pick(q) {
    stage.show(html`
      <p class="t-hand" data-in>${q}</p>
      <h2 class="t-title" data-in>Kimi Gösterdiniz?</h2>
      <div class="pick-row" data-in>
        <button class="pick-tile p0" data-act="who" data-who="0">${avatar(0, { mood: 'wow' })}<span class="pt-name">${nameOf(0)}</span><span class="key">1</span></button>
        <button class="pick-tile split" data-act="who" data-who="split"><span class="pt-split">${avatar(0, { pose: 'point-r', mood: 'smirk' })}${avatar(1, { pose: 'point-l', mood: 'smirk' })}</span><span class="pt-name">Farklı Kişiler</span><span class="key">2</span></button>
        <button class="pick-tile p1" data-act="who" data-who="1">${avatar(1, { mood: 'wow' })}<span class="pt-name">${nameOf(1)}</span><span class="key">3</span></button>
      </div>`, {
      who: (b) => result(q, b.dataset.who, b),
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat) return false;
        const map = { Digit1: '0', Digit2: 'split', Digit3: '1', Numpad1: '0', Numpad2: 'split', Numpad3: '1' };
        const who = map[e.code];
        if (!who) return false;
        e.preventDefault();
        const b = stage.scene.querySelector(`[data-who="${who}"]`);
        if (b) b.click();
        return true;
      },
    });
  }

  function result(q, who, btn) {
    if (g.answered === g.i) return;
    g.answered = g.i;
    const last = g.i + 1 >= g.deck.length;
    let body;
    if (who === 'split') {
      sfx.boing();
      body = html`
        <div class="duo-stage" data-in>
          <div class="duo-slot">${avatar(0, { pose: 'point-r', mood: 'smirk' })}</div>
          <div class="duo-slot">${avatar(1, { pose: 'point-l', mood: 'smirk' })}</div>
        </div>
        <h2 class="t-title" data-in>Anlaşamadınız!</h2>
        <p class="t-lead" data-in>"${q}" Bu konuyu biraz konuşmanız lazım.</p>`;
    } else {
      const i = Number(who);
      g.agree++;
      g.titles[i].push(toTitle(q));
      scoreboard.add(i, 1, btn);
      sfx.success();
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 60, power: 13 });
      body = html`
        <div class="big-blob" data-in>${avatar(i, { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'crown' })}</div>
        <h2 class="t-title" data-in>${pSpan(i)}!</h2>
        <p class="t-lead" data-in>İkiniz de aynı kişiyi gösterdiniz. Yeni unvan: <b>${toTitle(q)}</b></p>`;
    }
    stage.show(html`
      ${body}
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Soru'}${icon('arrow')}</button>`, {
      next: () => {
        g.i++;
        if (g.i >= g.deck.length) final();
        else card();
      },
    });
  }

  function final() {
    g.over = true;
    const total = g.deck.length;
    const pct = Math.round((g.agree / total) * 100);
    const col = (i) => html`
      <div class="titles-col p${i}">
        <div class="tc-head">${avatar(i, { mood: 'laugh', eyes: 'happy', props: g.titles[i].length >= g.titles[1 - i].length && g.titles[i].length ? 'crown' : '' })}<span class="tc-name">${nameOf(i)}</span><span class="tc-count">${g.titles[i].length}</span></div>
        <ul class="tc-list scroll">${g.titles[i].length ? g.titles[i].map((t) => html`<li>${t}</li>`) : html`<li class="empty">Bu oyunda unvan yok</li>`}</ul>
      </div>`;
    stage.show(html`
      <h2 class="t-title" data-in>Unvanlar Dağıtıldı!</h2>
      <p class="t-lead" data-in>${total} sorunun ${g.agree} tanesinde aynı kişiyi gösterdiniz. Uyumunuz <b>%${pct}</b>.</p>
      <div class="titles" data-in>${col(0)}${col(1)}</div>
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
