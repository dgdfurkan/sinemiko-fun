// Sincap Sesi: kayıt önce süper hızlı sincap sesiyle çalar, bilinemezse adım adım normale yaklaşır

import { html, Life, shuffle, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { judgeGuess, dative } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper, chipsHTML, bindChips } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { toast } from '../ui/overlay.js';
import { VoiceRecorder } from '../audio/recorder.js';
import { stopClip } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { CATEGORIES, DEFAULT_CATS } from '../data/reverse-words.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, shakeEl } from './common.js';
import { micGate, clipCardHTML, wireClip, miniPlayer, recordScene, pickCardScene } from './mic.js';

export const LEVELS = [
  { rate: 2.3, name: 'Süper Sincap', pts: 4 },
  { rate: 1.7, name: 'Sincap', pts: 3 },
  { rate: 0.58, name: 'Dev', pts: 2 },
  { rate: 1, name: 'Normal', pts: 1 },
];

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-chipmunk"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  life.add(() => {
    rec.close();
    stopClip();
    music.duck('chipmunk', false);
    scoreboard.hide();
  });
  const cfg = { rounds: 6, cats: new Set(DEFAULT_CATS), first: 'random' };
  let g = null;
  let starting = false;

  function lobby() {
    g = null;
    music.duck('chipmunk', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Söyleyen kartı mikrofona normal sesiyle söyler. Diğeri o sırada duymaz.',
        'Tahminci kaydı önce süper hızlı sincap sesiyle dinler. Bilirse 4 puan.',
        'Bilemezse ses sincap, sonra dev sesi, en son normal olur. Her adımda puan azalır.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds), 'Roller her turda değişir.')}
        ${optHTML('Kategoriler', chipsHTML('cats', CATEGORIES.map((c) => [c.id, c.name]), cfg.cats))}
        ${optHTML('İlk Söyleyen', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
      note: 'Kayıtlar yalnızca bu cihazda kalır.',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 2, max: 20, step: 2, onChange: (v) => { cfg.rounds = v; } });
    bindChips(scene.querySelector('[data-chips="cats"]'), { values: cfg.cats, onChange: (s) => { cfg.cats = s; } });
    const seg = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => seg.destroy());
  }

  async function startGame() {
    if (starting) return;
    starting = true;
    const btn = stage.scene.querySelector('[data-act="start"], [data-act="again"]');
    if (btn) btn.disabled = true;
    const ok = await micGate(rec, life);
    starting = false;
    if (!ok) {
      if (life.alive && btn) btn.disabled = false;
      return;
    }
    g = { round: 0, total: cfg.rounds, first: 0, deck: buildDeck(), over: false };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Söylüyor?' }) : Number(cfg.first);
    newRound();
  }

  function buildDeck() {
    const cats = CATEGORIES.filter((c) => cfg.cats.has(c.id));
    return shuffle(cats.flatMap((c) => c.items.map((it) => (Array.isArray(it) ? { text: it[0], hint: it[1], cat: c.name } : { text: it, hint: '', cat: c.name }))));
  }

  function drawCard() {
    if (!g.deck.length) g.deck = buildDeck();
    return g.deck.pop();
  }

  function newRound() {
    const speaker = (g.first + g.round) % 2;
    g.cur = { speaker, guesser: other(speaker), word: drawCard(), clip: null, level: 0, judged: false };
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    scoreboard.setActive(speaker);
    music.duck('chipmunk', false);
    const { guesser: q } = g.cur;
    const slot = (i) => (i === speaker
      ? html`<div class="duo-slot">${avatar(i, { pose: 'mic', props: 'mic', mood: 'smirk' })}<span class="role-chip p${i}">Söylüyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { pose: 'ears', eyes: 'shut', mood: 'flat' })}<span class="role-chip p${i}">Duymuyor</span></div>`);
    stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(speaker)} Söylüyor</h2>
      <p class="t-lead" data-in>${nameOf(q)}, kulaklarını kapat ve ekrana bakma.</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${icon('arrow')}Kulaklar Kapalı, Devam</button>`, {
      next: () => pickWord(),
    });
  }

  function pickWord() {
    const c = g.cur;
    pickCardScene(stage, {
      hand: `${nameOf(c.speaker)}, gizli kelimen bu`,
      item: c.word,
      draw: () => drawCard(),
      onGo: (it) => {
        c.word = it;
        record();
      },
    });
  }

  function record() {
    const c = g.cur;
    recordScene(stage, life, rec, {
      who: c.speaker,
      heading: 'Normal Sesinle Net Söyle',
      extra: html`<div class="say-chip" data-in>${c.word.text}</div>`,
      duckKey: 'chipmunk',
      onDone: (buf) => {
        c.clip = buf;
        review();
      },
    });
  }

  function review() {
    const c = g.cur;
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Kaydın Hazır</h2>
      ${clipCardHTML('a', 'Senin Sesin', c.clip, 'big')}
      <div class="row" data-in>
        <button class="btn" data-act="redo">${icon('replay')}Tekrar Kaydet</button>
        <button class="btn btn--primary nudge" data-act="handoff" data-primary data-once>${dative(nameOf(c.guesser))} Geç${icon('arrow')}</button>
      </div>`, {
      'play-a': () => clip.play(),
      redo: () => record(),
      handoff: () => handoff(),
    });
    const clip = wireClip(stage, scene, 'a', c.clip);
  }

  function handoff() {
    stopClip();
    const c = g.cur;
    scoreboard.setActive(c.guesser);
    music.duck('chipmunk', false);
    const scene = stage.show(html`
      <div class="big-blob" data-in>${avatar(c.guesser, { pose: 'ears', eyes: 'shut', mood: 'flat' })}</div>
      <h2 class="t-title" data-in>${pSpan(c.guesser)}, Kulaklarını Aç!</h2>
      <p class="t-lead" data-in>Önce süper sincap sesi geliyor. İlk dinleyişte bilirsen 4 puan.</p>
      <button class="btn btn--primary btn--big nudge" data-act="ready" data-primary data-once>${icon('phones')}Hazırım</button>`, {
      ready: async () => {
        music.duck('chipmunk', true);
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Dinle!' });
        if (stage.scene === scene) guess();
      },
    });
    const blob = scene.querySelector('.blob');
    life.timeout(() => {
      setBlob(blob, { pose: 'cheer', eyes: 'open', mood: 'wow' });
      react(blob, 'jump');
      sfx.boing();
    }, 800);
  }

  const track = (lv) => html`
    <div class="lvl-track" data-in>
      ${LEVELS.map((L, i) => html`<span class="lvl ${i < lv ? 'past' : ''} ${i === lv ? 'now' : ''}"><b>${L.pts}</b>${L.name}</span>`)}
    </div>`;

  function guess() {
    const c = g.cur;
    const L = LEVELS[c.level];
    const last = c.level >= LEVELS.length - 1;
    const scene = stage.show(html`
      ${track(c.level)}
      ${clipCardHTML('s', `${L.name} Sesi`, c.clip, 'big')}
      <div class="guess-box" data-in><input class="field" data-guess maxlength="60" placeholder="${nameOf(c.speaker)} ne dedi? Tahminini yaz" aria-label="Tahmin" autocomplete="off"></div>
      <div class="row" data-in>
        <button class="btn" data-act="replay" data-silent>${icon('replay')}Tekrar Dinle</button>
        ${last ? '' : html`<button class="btn btn--meh" data-act="easier">${icon('skip')}Kolaylaştır<span class="pts">−1</span></button>`}
        <button class="btn btn--primary nudge" data-act="guess" data-primary>${icon('check')}Tahmin Et</button>
      </div>`, {
      'play-s': () => clip.play(),
      replay: () => clip.play(true),
      easier: () => {
        c.level++;
        sfx.rewind();
        guess();
      },
      guess: () => submit(scene.querySelector('[data-guess]').value.replace(/\s+/g, ' ').trim()),
    });
    const clip = wireClip(stage, scene, 's', c.clip);
    clip.setRate(L.rate);
    life.timeout(() => {
      if (stage.scene !== scene) return;
      clip.play(true);
      scene.querySelector('[data-guess]').focus({ preventScroll: true });
    }, 350);
  }

  function submit(text) {
    const c = g.cur;
    stopClip();
    if (text && judgeGuess(c.word.text, text) === 'full') {
      right();
      return;
    }
    // Yazılan tahmin tam tutmadıysa söyleyen karar verir; kelime ekrana gelmez
    stage.show(html`
      <div class="qz-head" data-in>${avatar(c.speaker, { mood: 'smirk', pose: 'think' })}<p class="t-hand">${nameOf(c.speaker)}, sence doğru mu?</p></div>
      <h2 class="t-title" data-in>${text ? `“${text}”` : 'Sesli Tahmin'}</h2>
      <p class="t-lead" data-in>${text ? `${nameOf(c.guesser)} böyle tahmin etti.` : `${nameOf(c.guesser)} tahminini yüksek sesle söylesin.`}</p>
      <div class="row" data-in>
        <button class="btn btn--bad" data-act="no" data-once>${icon('x')}Yanlış</button>
        <button class="btn btn--good" data-act="yes" data-once>${icon('check')}Doğru</button>
      </div>`, {
      yes: () => right(),
      no: (b) => wrong(b),
    });
  }

  function right() {
    const c = g.cur;
    if (c.judged) return;
    c.judged = true;
    c.pts = LEVELS[c.level].pts;
    recap(true);
  }

  function wrong(btn) {
    const c = g.cur;
    if (c.level >= LEVELS.length - 1) {
      c.judged = true;
      c.pts = 0;
      recap(false);
      return;
    }
    sfx.fail();
    shakeEl(btn);
    toast('Olmadı! Ses biraz kolaylaşıyor.', { tone: 'warn', ms: 1800 });
    c.level++;
    life.timeout(() => { if (g && g.cur === c) guess(); }, 700);
  }

  function recap(ok) {
    const c = g.cur;
    music.duck('chipmunk', false);
    const lastRound = g.round + 1 >= g.total;
    const scene = stage.show(html`
      <div class="word-wrap" data-in><div class="word-card card"><span class="wc-cat">${c.word.cat}</span><span class="wc-word">${c.word.text}</span></div></div>
      <h2 class="t-title" data-in>${ok ? pick(['Sincap Kulağı!', 'Bildin!', 'Harika!']) : 'Bu Sefer Olmadı'}</h2>
      <p class="t-lead" data-in>${ok ? `${nameOf(c.guesser)} ${LEVELS[c.level].name.toLocaleLowerCase('tr')} seviyesinde bildi ve ${c.pts} puan aldı.` : 'Normal seste bile bilinemedi. Puan yok.'}</p>
      <div class="mini-clips" data-in>
        ${LEVELS.map((L, i) => html`<button class="mini-clip" data-act="mc" data-i="${i}" data-silent><span class="mc-ic">${icon('play')}</span>${L.name}<span class="mc-bar"></span></button>`)}
      </div>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${lastRound ? 'Sonuçları Gör' : 'Sonraki Tur'}${icon('arrow')}</button>`, {
      mc: (b) => play(b, c.clip, LEVELS[Number(b.dataset.i)].rate),
      next: () => {
        stopClip();
        g.round++;
        if (g.round >= g.total) final();
        else newRound();
      },
    });
    const play = miniPlayer(scene);
    if (ok) {
      sfx.success();
      const card = scene.querySelector('.word-card');
      scoreboard.add(c.guesser, c.pts, card);
      const r = card.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 80, power: 14 });
    } else {
      sfx.fail();
    }
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İki Sincap Kulağı' } });
    const sub = fin.winner === -1 ? 'İkiniz de sincapça biliyorsunuz.' : `En iyi sincap kulağı ${nameOf(fin.winner)}.`;
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
