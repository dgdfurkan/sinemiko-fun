// Fısıltı Challenge: kulaklıkta yüksek müzik çalar, cümle dudaklardan okunur

import { html, toHTML, Life, shuffle } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper, sliderHTML, bindSlider } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { setBusVolume, ensureAudio } from '../audio/engine.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { PHRASES } from '../data/whisper.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, flipEl } from './common.js';

const RING = 2 * Math.PI * 44;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-whisper"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const cfg = { turns: 2, seconds: '60', first: 'random' };
  let g = null;
  let testing = false;

  const maskLevel = () => store.get('maskVol');
  const applyMask = () => setBusVolume('mask', maskLevel() * 1.4, 0.15);
  const startMask = () => {
    ensureAudio();
    applyMask();
    music.play('party');
  };
  const stopMask = () => {
    setBusVolume('mask', 0, 0.3);
    music.play('chill');
  };
  life.add(() => {
    stopMask();
    scoreboard.hide();
  });

  function lobby() {
    g = null;
    testing = false;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Biri kulaklığı takar ve ekrana arkasını döner. Kulaklıkta yüksek müzik çalar.',
        'Diğeri ekrandaki cümleyi yüzüne bakarak söyler.',
        'Kulaklıklı olan cümleyi dudaklardan okumaya çalışır. Süre bitene kadar bildikleri sayılır.',
      ],
      options: html`
        ${optHTML('Kişi Başı Tur', stepperHTML('turns', cfg.turns))}
        ${optHTML('Tur Süresi', segHTML('seconds', [['45', '45 sn'], ['60', '60 sn'], ['90', '90 sn']], cfg.seconds))}
        ${optHTML('İlk Kulaklık', segHTML('first', FIRST_OPTIONS(), cfg.first))}
        ${optHTML('Kulaklık Sesi', html`<div class="vol-row">${sliderHTML('mask', maskLevel(), 'Kulaklık sesi')}<button class="btn btn--sm" data-act="test">${icon('phones')}<span data-test-label>Sesi Dene</span></button></div>`, 'Kulağını acıtmayacak ama konuşmayı bastıracak kadar aç.')}`,
      start: 'Başla',
      startIcon: 'phones',
      note: 'Kulaklık bu bilgisayara takılı olmalı.',
    }), {
      start: () => startGame(),
      test: () => {
        testing = !testing;
        if (testing) startMask();
        else stopMask();
        scene.querySelector('[data-test-label]').textContent = testing ? 'Durdur' : 'Sesi Dene';
      },
    }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="turns"]'), { value: cfg.turns, min: 1, max: 5, onChange: (v) => { cfg.turns = v; } });
    const s1 = bindSeg(scene.querySelector('[data-seg="seconds"]'), { value: cfg.seconds, onChange: (v) => { cfg.seconds = v; } });
    const s2 = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    bindSlider(scene.querySelector('[data-slider="mask"]'), {
      value: maskLevel(),
      onInput: (v) => {
        store.set('maskVol', v);
        if (testing) applyMask();
      },
    });
    stage.own(() => { s1.destroy(); s2.destroy(); });
  }

  async function startGame() {
    if (testing) {
      testing = false;
      stopMask();
    }
    g = { turn: 0, total: cfg.turns * 2, first: 0, deck: shuffle(PHRASES), over: false, seconds: Number(cfg.seconds) };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'Kulaklık Kimde?' }) : Number(cfg.first);
    gear();
  }

  const fill = (p) => p.replace('{0}', nameOf(0)).replace('{1}', nameOf(1));
  function drawPhrase() {
    if (!g.deck.length) g.deck = shuffle(PHRASES);
    return fill(g.deck.pop());
  }

  function gear() {
    const wearer = (g.first + g.turn) % 2;
    const reader = other(wearer);
    scoreboard.setMid(`Tur ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(wearer);
    const slot = (i) => (i === wearer
      ? html`<div class="duo-slot">${avatar(i, { props: 'phones', mood: 'wow' })}<span class="role-chip p${i}">Kulaklıkta</span></div>`
      : html`<div class="duo-slot">${avatar(i, { mood: 'smirk', pose: 'think' })}<span class="role-chip p${i}">Okuyor</span></div>`);
    stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(wearer)} Kulaklığı Taksın</h2>
      <p class="t-lead" data-in>${nameOf(wearer)} ekrana arkasını dönsün. ${nameOf(reader)} cümleleri yüzüne bakarak söyleyecek. Süre ${g.seconds} saniye.</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('play')}Müziği Aç ve Başla</button>`, {
      go: async () => {
        startMask();
        stage.scene.classList.add('counting');
        await countdown(stage.scene, life, { final: 'Söyle!' });
        round(wearer);
      },
    });
  }

  function round(wearer) {
    const t = { got: 0, passed: 0, n: 1, left: g.seconds, phrase: drawPhrase(), done: false };
    const scene = stage.show(html`
      <div class="wh-top" data-in>
        <div class="timer-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr-bg" cx="50" cy="50" r="44"/><circle class="tr-fg" cx="50" cy="50" r="44" style="stroke-dasharray:${RING};stroke-dashoffset:0"/></svg>
          <span class="tr-num">${g.seconds}</span>
        </div>
        <div class="wh-count"><span class="wh-got">0</span><span class="wh-lbl">bildi</span></div>
      </div>
      <div class="phrase-wrap" data-in>
        <div class="phrase-card card"><span class="pc-n">1. cümle</span><span class="pc-text">${t.phrase}</span></div>
      </div>
      <div class="row" data-in>
        <button class="btn btn--bad" data-act="pass">${icon('skip')}Pas</button>
        <button class="btn btn--good btn--big" data-act="got" data-primary>${icon('check')}Bildi!</button>
      </div>
      <div class="vol-mini" data-in>
        <button class="ibtn" data-act="vdown" aria-label="Kulaklık sesini kıs">${icon('volDown')}</button>
        <span class="vm-lbl">Kulaklık Sesi</span>
        <button class="ibtn" data-act="vup" aria-label="Kulaklık sesini aç">${icon('volUp')}</button>
      </div>
      <p class="key-hint" data-in><span class="key">Enter</span> bildi <span class="key">P</span> pas</p>`, {
      got: (b) => {
        if (t.done) return;
        t.got++;
        scene.querySelector('.wh-got').textContent = String(t.got);
        scoreboard.add(wearer, 1, b);
        sfx.success();
        const r = b.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top, { count: 36, power: 11 });
        next();
      },
      pass: () => {
        if (t.done) return;
        t.passed++;
        sfx.boing();
        next();
      },
      vdown: () => nudgeVol(-0.1),
      vup: () => nudgeVol(0.1),
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat) return false;
        if (e.code === 'KeyP' || e.code === 'ArrowRight') {
          e.preventDefault();
          scene.querySelector('[data-act="pass"]').click();
          return true;
        }
        return false;
      },
    });
    const card = scene.querySelector('.phrase-card');
    const num = scene.querySelector('.tr-num');
    const fg = scene.querySelector('.tr-fg');
    const ringBox = scene.querySelector('.timer-ring');

    function nudgeVol(d) {
      const v = Math.min(1, Math.max(0, maskLevel() + d));
      store.set('maskVol', v);
      applyMask();
    }

    function next() {
      t.n++;
      t.phrase = drawPhrase();
      const n = t.n;
      const text = t.phrase;
      flipEl(card, () => {
        card.innerHTML = toHTML(html`<span class="pc-n">${n}. cümle</span><span class="pc-text">${text}</span>`);
      });
    }

    const end = performance.now() + g.seconds * 1000;
    let lastSec = g.seconds;
    const timer = life.interval(() => {
      if (t.done) return;
      const left = Math.max(0, (end - performance.now()) / 1000);
      const sec = Math.ceil(left);
      fg.style.strokeDashoffset = String(RING * (1 - left / g.seconds));
      if (sec !== lastSec) {
        lastSec = sec;
        num.textContent = String(sec);
        if (sec <= 5 && sec > 0) sfx.tick(5 - sec);
        ringBox.classList.toggle('hurry', sec <= 10);
      }
      if (left <= 0) {
        t.done = true;
        clearInterval(timer);
        turnEnd(wearer, t);
      }
    }, 100);
  }

  function turnEnd(wearer, t) {
    stopMask();
    sfx.whistle();
    const last = g.turn + 1 >= g.total;
    stage.show(html`
      <div class="big-blob" data-in>${avatar(wearer, t.got ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'phones' } : { mood: 'sad', props: 'phones sweat' })}</div>
      <h2 class="t-title" data-in>Süre Bitti!</h2>
      <p class="big-stat" data-in><b>${t.got}</b> cümle</p>
      <p class="t-lead" data-in>${nameOf(wearer)} kulaklığı çıkarabilir. ${t.passed ? `${t.passed} cümle pas geçildi.` : 'Hiç pas geçilmedi.'}</p>
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
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İkiniz de Dudak Okuyucu' } });
    const sub = fin.winner === -1 ? 'Dudak okumada ikiniz de aynı seviyedesiniz.' : `${nameOf(fin.winner)} dudakları okumada bir numara.`;
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
