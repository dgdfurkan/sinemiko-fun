// Reverse Play: söyle, ters çevir, taklit et, tersin tersinden kelimeyi bul

import { html, toHTML, Life, shuffle, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { judgeGuess, dative } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper, chipsHTML, bindChips } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { VoiceRecorder } from '../audio/recorder.js';
import { reverseBuffer, playClip, stopClip, isPlaying, downloadClips } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { CATEGORIES, DEFAULT_CATS } from '../data/reverse-words.js';
import {
  lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons,
  other, pSpan, flipEl, popIn, bumpEl, shakeEl,
} from './common.js';
import { songHelper } from './songhelp.js';
import { songByTitle } from './songfind.js';
import { micGate, clipCardHTML, wireClip as wireClipBase, miniPlayer, recordScene as recordSceneBase } from './mic.js';
import { secretRec } from './secret.js';

const MAX_SEC = 10;
const POINTS = { full: 3, close: 1, miss: 0 };
const HEADLINES = {
  full: ['Kulak Dediğin Böyle Olur!', 'Tam İsabet!', 'Resmen Çözdün!'],
  close: ['Az Kalsın!', 'Çok Yaklaştın!', 'Neredeyse!'],
  miss: ['Olmadı Ama Çok Komikti', 'Bu Neydi Şimdi?', 'Kulaklar Biraz Karıştı'],
};

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-reverse"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  // Şarkılar kategorisinde tur bitince şarkının tam hali ve sözleri dinlenebilir
  const helper = songHelper(view.querySelector('.game-reverse'), life);
  // Tahminci ya kulaklarını kapatır ya da kulaklıkta müzik dinler
  const sec = secretRec(view.querySelector('.game-reverse'), life);
  life.add(() => {
    rec.close();
    stopClip();
    music.duck('reverse', false);
    scoreboard.hide();
  });

  const cfg = { rounds: 6, cats: new Set(DEFAULT_CATS), first: 'random' };
  let g = null;
  let starting = false;

  // Ortak mikrofon parçalarını bu oyunun sahnesine bağla
  const wireClip = (scene, id, buffer) => wireClipBase(stage, scene, id, buffer);
  const recordScene = (opts) => recordSceneBase(stage, life, rec, { duckKey: 'reverse', maxSec: MAX_SEC, ...opts });

  /* ---------- Lobi ---------- */

  function lobby() {
    g = null;
    music.duck('reverse', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Söyleyen, kartta çıkan şeyi mikrofona söyler. Diğeri o sırada kulaklarını kapatır ya da kulaklıkta müzik dinler.',
        'Oyun kaydı tersine çevirir.',
        'Tahminci ters kaydı dinler ve duyduğunu aynen taklit eder.',
        'Taklit tekrar ters çevrilir. Ortaya çıkan sesten kelimeyi bulan puanı alır.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds), 'Roller her turda değişir.')}
        ${optHTML('Kategoriler', chipsHTML('cats', CATEGORIES.map((c) => [c.id, c.name]), cfg.cats))}
        ${optHTML('İlk Söyleyen', segHTML('first', FIRST_OPTIONS(), cfg.first))}
        ${sec.optionHTML()}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
      note: 'Tarayıcı mikrofon izni isteyecek. Kayıtlar yalnızca bu cihazda kalır.',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 2, max: 20, step: 2, onChange: (v) => { cfg.rounds = v; } });
    bindChips(scene.querySelector('[data-chips="cats"]'), { values: cfg.cats, onChange: (s) => { cfg.cats = s; } });
    const seg = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => seg.destroy());
    sec.bind(scene, stage);
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
    if (!(await sec.setup(stage))) {
      if (life.alive) lobby();
      return;
    }
    g = { round: 0, total: cfg.rounds, first: 0, deck: buildDeck(), archive: [], over: false, cur: null };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Söylüyor?' }) : Number(cfg.first);
    newRound();
  }

  function buildDeck() {
    const cats = CATEGORIES.filter((c) => cfg.cats.has(c.id));
    const cards = cats.flatMap((c) => c.items.map((it) => (Array.isArray(it) ? { text: it[0], hint: it[1], cat: c.name } : { text: it, hint: '', cat: c.name })));
    return shuffle(cards);
  }

  function drawCard() {
    if (!g.deck.length) g.deck = buildDeck();
    return g.deck.pop();
  }

  /* ---------- Tur akışı ---------- */

  function newRound() {
    helper.hide();
    const speaker = (g.first + g.round) % 2;
    g.cur = { speaker, guesser: other(speaker), word: drawCard(), a: null, aRev: null, b: null, bRev: null, listens: 0, guess: '', judged: false };
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    scoreboard.setActive(speaker);
    turnIntro();
  }

  function turnIntro() {
    music.duck('reverse', false);
    const { speaker: s, guesser: q } = g.cur;
    sec.turnScene(stage, { speaker: s, guesser: q, role: 'Söylüyor', title: html`${pSpan(s)} Söylüyor`, onNext: () => pickWord() });
  }

  const cardInner = (w) => html`<span class="wc-cat">${w.cat}</span><span class="wc-word">${w.text}</span>${w.hint ? html`<span class="wc-hint">${w.hint}</span>` : ''}`;
  const cardButtons = () => html`
    <button class="btn" data-act="shuffle">${icon('shuffle')}Başka Kart</button>
    <button class="btn" data-act="custom">${icon('pencil')}Kendim Yazacağım</button>
    <button class="btn btn--primary nudge" data-act="go" data-primary>${icon('mic')}Bununla Kaydet</button>`;
  const customButtons = () => html`
    <button class="btn" data-act="back">${icon('back')}Kartlara Dön</button>
    <button class="btn btn--primary nudge" data-act="go" data-primary>${icon('mic')}Bununla Kaydet</button>`;

  function pickWord() {
    const c = g.cur;
    let mode = 'card';
    let flipping = false;
    let dirty = false;
    const customInner = () => html`<span class="wc-cat">Kendi Kelimen</span><input class="field wc-input" maxlength="40" placeholder="Ne söyleyeceksin?" aria-label="Gizli kelime" autocomplete="off">`;
    const render = () => {
      card.innerHTML = toHTML(mode === 'custom' ? customInner() : cardInner(c.word));
      const input = card.querySelector('input');
      if (input) input.focus();
    };
    const setMode = (m) => {
      mode = m;
      row.innerHTML = toHTML(m === 'custom' ? customButtons() : cardButtons());
      popIn(row.children);
      swapCard();
    };
    const scene = stage.show(html`
      <p class="t-hand" data-in>${nameOf(c.speaker)}, gizli kelimen bu</p>
      <div class="word-wrap" data-in><div class="word-card card">${cardInner(c.word)}</div></div>
      <div class="row" data-in data-row>${cardButtons()}</div>`, {
      shuffle: () => {
        c.word = drawCard();
        swapCard();
      },
      custom: () => setMode('custom'),
      back: () => setMode('card'),
      go: () => {
        if (mode === 'custom') {
          const input = card.querySelector('input');
          const v = input ? input.value.replace(/\s+/g, ' ').trim() : '';
          if (!v) {
            if (input) {
              shakeEl(input);
              input.focus();
            }
            sfx.boing();
            return;
          }
          c.word = { text: v, hint: '', cat: 'Kendi Kelimen' };
        }
        recordA();
      },
    });
    const card = scene.querySelector('.word-card');
    const row = scene.querySelector('[data-row]');
    // Arka arkaya basılırsa son durum en sonda yeniden çizilir
    async function swapCard() {
      if (flipping) {
        dirty = true;
        return;
      }
      flipping = true;
      await flipEl(card, render);
      flipping = false;
      if (dirty && stage.scene === scene) {
        dirty = false;
        swapCard();
      }
    }
  }

  function recordA() {
    const c = g.cur;
    recordScene({
      who: c.speaker,
      heading: 'Şimdi Net Bir Sesle Söyle',
      extra: html`<div class="say-chip" data-in>${c.word.text}</div>`,
      onDone: (buf) => {
        c.a = buf;
        c.aRev = null;
        reviewA();
      },
    });
  }

  function reviewA() {
    const c = g.cur;
    let busy = false;
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Kaydın Hazır</h2>
      ${clipCardHTML('a', 'Senin Sesin', c.a, 'big')}
      <div class="row" data-in data-row>
        <button class="btn" data-act="redo">${icon('replay')}Tekrar Kaydet</button>
        <button class="btn btn--primary nudge" data-act="flip" data-primary>${icon('rewind')}Ters Çevir</button>
      </div>
      <p class="t-hand" data-in>${nameOf(c.guesser)} hâlâ duymuyor, değil mi?</p>`, {
      'play-a': () => { if (sec.mayPlay()) clip.play(); },
      redo: () => { if (!busy) recordA(); },
      flip: async () => {
        if (busy) return;
        busy = true;
        scene.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        stopClip();
        c.aRev = reverseBuffer(c.a);
        await flipEl(clip.card, () => clip.setBuffer(c.aRev, 'Ters Hali'), { sound: 'rewind' });
        if (stage.scene !== scene) return;
        scene.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        row.innerHTML = toHTML(html`
          <button class="btn" data-act="play-a" data-silent>${icon('play')}Ters Halini Dinle</button>
          <button class="btn btn--primary nudge" data-act="handoff" data-primary data-once>${dative(nameOf(c.guesser))} Geç${icon('arrow')}</button>`);
        popIn(row.children);
      },
      handoff: () => handoff(),
    });
    const clip = wireClip(scene, 'a', c.a);
    const row = scene.querySelector('[data-row]');
  }

  function handoff() {
    stopClip();
    const c = g.cur;
    music.duck('reverse', false);
    scoreboard.setActive(c.guesser);
    const h = sec.handoff(c.guesser);
    const scene = stage.show(html`
      <div class="big-blob" data-in>${avatar(c.guesser, sec.mode === 'phones' ? { props: 'phones', eyes: 'shut', mood: 'happy' } : { pose: 'ears', eyes: 'shut', mood: 'flat' })}</div>
      <h2 class="t-title" data-in>${h.title}</h2>
      <p class="t-lead" data-in>${h.lead}${nameOf(c.speaker)} sana ters bir kayıt bıraktı. Dikkatle dinle, sonra aynen taklit et.</p>
      <button class="btn btn--primary btn--big nudge" data-act="ready" data-primary data-once>${icon('phones')}Hazırım</button>`, {
      ready: async () => {
        music.duck('reverse', true);
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Dinle!' });
        if (stage.scene === scene) listen();
      },
    });
    const blob = scene.querySelector('.blob');
    life.timeout(() => {
      setBlob(blob, { pose: 'cheer', eyes: 'open', mood: 'wow' });
      react(blob, 'jump');
      sfx.boing();
    }, 800);
  }

  function listen() {
    const c = g.cur;
    if (!c.aRev) c.aRev = reverseBuffer(c.a);
    c.listens++;
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Ters Kayıt</h2>
      ${clipCardHTML('r', 'Ters Kayıt', c.aRev, 'big')}
      <p class="listen-count" data-in><b data-count>${c.listens}</b>. dinleyiş</p>
      <div class="row" data-in>
        <button class="btn" data-act="replay" data-silent>${icon('replay')}Tekrar Dinle</button>
        <button class="btn btn--primary nudge" data-act="next" data-primary data-once>${icon('mic')}Taklit Etmeye Hazırım</button>
      </div>`, {
      'play-r': () => hear(false),
      replay: () => hear(true),
      next: () => recordB(),
    });
    const clip = wireClip(scene, 'r', c.aRev);
    const count = scene.querySelector('[data-count]');
    function hear(force) {
      const starting = force || !clip.card.classList.contains('playing');
      if (starting) {
        c.listens++;
        count.textContent = String(c.listens);
        bumpEl(count);
      }
      clip.play(force);
    }
    life.timeout(() => { if (stage.scene === scene) clip.play(true); }, 300);
  }

  function recordB() {
    const c = g.cur;
    recordScene({
      who: c.guesser,
      heading: 'Duyduğunu Aynen Taklit Et',
      extra: html`<button class="btn btn--sm" data-act="hear" data-silent data-lock-rec data-in>${icon('play')}Ters Kaydı Tekrar Dinle</button>`,
      actions: {
        hear: () => {
          if (isPlaying()) {
            stopClip();
            return;
          }
          c.listens++;
          playClip(c.aRev);
        },
      },
      onDone: (buf) => {
        c.b = buf;
        c.bRev = null;
        reviewB();
      },
    });
  }

  function reviewB() {
    const c = g.cur;
    let busy = false;
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Taklidin Hazır</h2>
      ${clipCardHTML('b', 'Senin Taklidin', c.b, 'big')}
      <div class="row" data-in>
        <button class="btn" data-act="redo">${icon('replay')}Tekrar Kaydet</button>
        <button class="btn btn--primary nudge" data-act="flip" data-primary>${icon('rewind')}Tersine Çevir</button>
      </div>
      <p class="t-hand" data-in>Şimdi sihirli an geliyor</p>`, {
      'play-b': () => clip.play(),
      redo: () => { if (!busy) recordB(); },
      flip: async () => {
        if (busy) return;
        busy = true;
        scene.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        stopClip();
        c.bRev = reverseBuffer(c.b);
        await flipEl(clip.card, () => clip.setBuffer(c.bRev, 'Taklidinin Tersi'), { sound: 'rewind' });
        if (stage.scene === scene) decode();
      },
    });
    const clip = wireClip(scene, 'b', c.b);
  }

  function decode() {
    const c = g.cur;
    music.duck('reverse', true);
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Bakalım Ne Çıktı?</h2>
      ${clipCardHTML('d', 'Taklidinin Tersi', c.bRev, 'big decode')}
      <div class="guess-box" data-in><input class="field" data-guess maxlength="60" placeholder="${nameOf(c.speaker)} ne dedi? Tahminini yaz" aria-label="Tahmin" autocomplete="off"></div>
      <div class="row" data-in>
        <button class="btn" data-act="replay" data-silent>${icon('replay')}Tekrar Dinle</button>
        <button class="btn btn--primary nudge" data-act="guess" data-primary data-once>${icon('check')}Tahmin Et</button>
      </div>
      <p class="key-hint" data-in>Sesli söylediysen boş bırakıp geçebilirsin</p>`, {
      'play-d': () => clip.play(),
      replay: () => clip.play(true),
      guess: () => {
        c.guess = scene.querySelector('[data-guess]').value.replace(/\s+/g, ' ').trim();
        reveal();
      },
    });
    const clip = wireClip(scene, 'd', c.bRev);
    life.timeout(() => {
      if (stage.scene !== scene) return;
      clip.play(true);
      scene.querySelector('[data-guess]').focus({ preventScroll: true });
    }, 450);
  }

  async function reveal() {
    stopClip();
    const c = g.cur;
    const suggestion = c.guess ? judgeGuess(c.word.text, c.guess) : null;
    const sug = (k) => (suggestion === k ? 'suggest' : '');
    const scene = stage.show(html`
      <p class="t-hand" data-in>Doğru cevap</p>
      <div class="reveal-wrap" data-in>
        <div class="reveal-card card">
          <div class="rc-face rc-back">?</div>
          <div class="rc-face rc-front"><span class="wc-cat">${c.word.cat}</span><span class="wc-word">${c.word.text}</span></div>
        </div>
      </div>
      <p class="guess-line" data-in>${c.guess ? html`${nameOf(c.guesser)} tahmini: <b>${c.guess}</b>` : 'Tahmin sesli söylendi.'}</p>
      <div class="verdict-box pending" data-verdict>
        <p class="verdict-q">${nameOf(c.speaker)}, sence bildi mi?</p>
        <div class="row">
          <button class="btn btn--good ${sug('full')}" data-act="full">${icon('check')}Tam Bildi<span class="pts">+3</span></button>
          <button class="btn btn--meh ${sug('close')}" data-act="close">Yaklaştı<span class="pts">+1</span></button>
          <button class="btn btn--bad ${sug('miss')}" data-act="miss">${icon('x')}Bilemedi</button>
        </div>
        <button class="btn btn--sm" data-act="orig" data-silent>${icon('play')}Orijinal Kaydı Dinle</button>
      </div>`, {
      full: (t) => verdict('full', t),
      close: (t) => verdict('close', t),
      miss: (t) => verdict('miss', t),
      orig: () => (isPlaying() ? stopClip() : playClip(c.a)),
    });
    const wrap = scene.querySelector('.reveal-wrap');
    const card = scene.querySelector('.reveal-card');
    await life.sleep(450);
    if (stage.scene !== scene) return;
    wrap.classList.add('shaking');
    sfx.drumroll(1.3);
    await life.sleep(1300);
    if (stage.scene !== scene) return;
    wrap.classList.remove('shaking');
    card.classList.add('flipped');
    sfx.flip();
    const r = card.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 50, power: 12 });
    await life.sleep(650);
    if (stage.scene !== scene) return;
    playClip(c.a);
    scene.querySelector('[data-verdict]').classList.remove('pending');
  }

  function verdict(kind, btn) {
    const c = g.cur;
    if (c.judged) return;
    c.judged = true;
    stopClip();
    const bonus = kind === 'full' && c.listens <= 1;
    const pts = POINTS[kind] + (bonus ? 1 : 0);
    c.verdict = kind;
    c.pts = pts;
    g.archive.push({ ...c, round: g.round + 1 });
    const r = btn.getBoundingClientRect();
    if (kind === 'full') {
      sfx.success();
      burst(r.left + r.width / 2, r.top, { count: 90, power: 16 });
    } else if (kind === 'close') {
      sfx.heart();
      burst(r.left + r.width / 2, r.top, { count: 30, power: 9, shapes: ['heart', 'circle'] });
    } else {
      sfx.fail();
    }
    if (pts) scoreboard.add(c.guesser, pts, btn);
    recap(bonus);
  }

  function recap(bonus) {
    const c = g.cur;
    const last = g.round + 1 >= g.total;
    if (c.word.cat === 'Şarkılar') helper.show(songByTitle(c.word.text, c.word.hint));
    const mood = (i) => {
      if (i === c.guesser) {
        if (c.verdict === 'full') return { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'heart' };
        if (c.verdict === 'close') return { mood: 'smirk' };
        return { mood: 'sad', props: 'sweat' };
      }
      return c.verdict === 'miss' ? { mood: 'laugh', eyes: 'happy' } : { mood: 'happy', pose: 'cheer' };
    };
    const line = c.verdict === 'miss'
      ? 'Bu turda puan yok. Kayıtları dinleyip gülebilirsiniz.'
      : `${nameOf(c.guesser)} ${c.pts} puan kazandı.${bonus ? ' İlk dinleyişte bildiği için bir bonus puan da var.' : ''}`;
    const scene = stage.show(html`
      <div class="duo-stage" data-in>${[0, 1].map((i) => html`<div class="duo-slot">${avatar(i, mood(i))}</div>`)}</div>
      <h2 class="t-title" data-in>${pick(HEADLINES[c.verdict])}</h2>
      <p class="t-lead" data-in>${line}</p>
      <div class="mini-clips" data-in>
        <button class="mini-clip" data-act="mc" data-k="a" data-silent><span class="mc-ic">${icon('play')}</span>Orijinal<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-k="aRev" data-silent><span class="mc-ic">${icon('rewind')}</span>Ters Hali<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-k="b" data-silent><span class="mc-ic">${icon('mic')}</span>Taklit<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-k="bRev" data-silent><span class="mc-ic">${icon('sparkle')}</span>Taklidin Tersi<span class="mc-bar"></span></button>
      </div>
      <div class="row" data-in>
        <button class="btn" data-act="dl">${icon('download')}Bu Turu İndir</button>
        <button class="btn btn--primary nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sonraki Tur'}${icon('arrow')}</button>
      </div>`, {
      mc: (t) => play(t, c[t.dataset.k]),
      dl: () => downloadClips([c.a, c.aRev, c.b, c.bRev], `reverse-play-tur-${g.round + 1}.wav`),
      next: () => {
        stopClip();
        g.round++;
        if (g.round >= g.total) final();
        else newRound();
      },
    });
    const play = miniPlayer(scene);
    music.duck('reverse', false);
  }

  function final() {
    g.over = true;
    helper.hide();
    scoreboard.setActive(-1);
    const scores = scoreboard.scores;
    const fin = versusFinaleHTML(scores, { lines: { tie: 'Berabere! Kulaklar Eşit' } });
    const sub = fin.winner === -1
      ? 'İkiniz de aynı derecede iyi dinliyorsunuz.'
      : `Bu gecenin en iyi kulağı ${nameOf(fin.winner)}.`;
    const scene = stage.show(html`
      ${fin.html}
      <p class="t-lead" data-in>${sub}</p>
      <div class="archive card scroll" data-in>
        ${g.archive.map((a, i) => html`
          <div class="arc-row">
            <span class="arc-n">${a.round}</span>
            <span class="arc-main"><span class="arc-word">${a.word.text}</span><span class="arc-who">${nameOf(a.speaker)} söyledi, ${nameOf(a.guesser)} tahmin etti</span></span>
            <span class="arc-pts">+${a.pts}</span>
            <button class="mini-clip mini-clip--icon" data-act="pl" data-i="${i}" data-silent aria-label="Taklidin tersini dinle"><span class="mc-ic">${icon('play')}</span><span class="mc-bar"></span></button>
            <button class="ibtn" data-act="dl" data-i="${i}" aria-label="Turu indir">${icon('download')}</button>
          </div>`)}
      </div>
      ${finaleButtons()}`, {
      pl: (t) => play(t, g.archive[Number(t.dataset.i)].bRev),
      dl: (t) => {
        const a = g.archive[Number(t.dataset.i)];
        downloadClips([a.a, a.aRev, a.b, a.bRev], `reverse-play-tur-${a.round}.wav`);
      },
      home: () => navigate('#/'),
      again: () => startGame(),
    });
    const play = miniPlayer(scene);
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
