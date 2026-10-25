// Mırıldan Bakalım: şarkı sözsüz mırıldanılır, partner tahmin eder; zor modda mırıltı ters çalar

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
import { reverseBuffer, stopClip } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { HUM_CATS } from '../data/voice.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, shakeEl } from './common.js';
import { micGate, clipCardHTML, wireClip, miniPlayer, recordScene, pickCardScene } from './mic.js';
import { songHelper } from './songhelp.js';

const MAX_TRIES = 3;
const initials = (t) => t.split(' ').map((w) => (w ? `${w[0]}${'_'.repeat(Math.max(0, [...w].length - 1))}` : w)).join(' ');

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-hum"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  // Mırıldanan şarkıyı hatırlamazsa kesit ve sözlere bakabilir; tahminci görmez
  const helper = songHelper(view.querySelector('.game-hum'), life);
  life.add(() => {
    rec.close();
    stopClip();
    music.duck('hum', false);
    scoreboard.hide();
  });
  const cfg = { rounds: 6, cats: new Set(['tr', 'yabanci', 'film', 'cocuk']), mode: 'normal', first: 'random' };
  let g = null;
  let starting = false;

  function lobby() {
    g = null;
    helper.hide();
    music.duck('hum', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Mırıldanan, karttaki şarkıyı sözsüz olarak mikrofona mırıldanır. Diğeri o sırada duymaz.',
        'Tahminci kaydı dinleyip şarkıyı bulmaya çalışır. İpucu almak ve yanlış tahmin puanı düşürür.',
        'Zor modda mırıltı tersten çalar. Bakalım şarkı tersten de tanınıyor mu?',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds), 'Roller her turda değişir.')}
        ${optHTML('Şarkılar', chipsHTML('cats', HUM_CATS.map((c) => [c.id, c.name]), cfg.cats))}
        ${optHTML('Mod', segHTML('mode', [['normal', 'Normal'], ['ters', 'Ters (Zor)']], cfg.mode))}
        ${optHTML('İlk Mırıldanan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 2, max: 20, step: 2, onChange: (v) => { cfg.rounds = v; } });
    bindChips(scene.querySelector('[data-chips="cats"]'), { values: cfg.cats, onChange: (s) => { cfg.cats = s; } });
    const segs = ['mode', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((x) => x.destroy()));
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
    g = { round: 0, total: cfg.rounds, first: 0, deck: buildDeck(), hard: cfg.mode === 'ters', over: false };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Mırıldanıyor?' }) : Number(cfg.first);
    newRound();
  }

  function buildDeck() {
    const cats = HUM_CATS.filter((c) => cfg.cats.has(c.id));
    return shuffle(cats.flatMap((c) => c.items.map(([text, hint, it, lr]) => ({ text, hint, it, lr, cat: c.name }))));
  }

  function drawCard() {
    if (!g.deck.length) g.deck = buildDeck();
    return g.deck.pop();
  }

  function newRound() {
    const singer = (g.first + g.round) % 2;
    g.cur = { singer, guesser: other(singer), song: drawCard(), clip: null, play: null, hints: 0, wrongs: 0, judged: false };
    helper.hide();
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    scoreboard.setActive(singer);
    music.duck('hum', false);
    const q = g.cur.guesser;
    const slot = (i) => (i === singer
      ? html`<div class="duo-slot">${avatar(i, { pose: 'mic', props: 'mic', mood: 'happy', eyes: 'happy' })}<span class="role-chip p${i}">Mırıldanıyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { pose: 'ears', eyes: 'shut', mood: 'flat' })}<span class="role-chip p${i}">Duymuyor</span></div>`);
    stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(singer)} Mırıldanıyor</h2>
      <p class="t-lead" data-in>${nameOf(q)}, kulaklarını kapat ve ekrana bakma.</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${icon('arrow')}Kulaklar Kapalı, Devam</button>`, {
      next: () => pickSong(),
    });
  }

  function pickSong() {
    const c = g.cur;
    helper.show(c.song);
    pickCardScene(stage, {
      hand: `${nameOf(c.singer)}, bu şarkıyı mırıldanacaksın`,
      item: c.song,
      draw: () => drawCard(),
      allowCustom: true,
      customCat: 'Kendi Şarkın',
      customPlaceholder: 'Hangi şarkı?',
      goLabel: 'Mırıldanmaya Geç',
      onChange: (it) => helper.show(it),
      onGo: (it) => {
        c.song = it;
        record();
      },
    });
  }

  function record() {
    const c = g.cur;
    helper.show(c.song);
    helper.setRecording(false);
    recordScene(stage, life, rec, {
      who: c.singer,
      heading: 'Sözsüz Mırıldan',
      extra: html`<div class="say-chip" data-in>${c.song.text}</div><p class="t-hand" data-in>Mmm, na na ya da la la. Şarkı sözü söylemek yok!</p>`,
      duckKey: 'hum',
      maxSec: 15,
      onState: (st) => helper.setRecording(st === 'rec'),
      onDone: (buf) => {
        c.clip = buf;
        c.play = g.hard ? reverseBuffer(buf) : buf;
        review();
      },
    });
  }

  function review() {
    const c = g.cur;
    helper.setRecording(false);
    const scene = stage.show(html`
      <h2 class="t-big" data-in>Mırıltın Hazır</h2>
      ${clipCardHTML('a', 'Senin Mırıltın', c.clip, 'big')}
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
    helper.hide();
    const c = g.cur;
    scoreboard.setActive(c.guesser);
    music.duck('hum', false);
    const scene = stage.show(html`
      <div class="big-blob" data-in>${avatar(c.guesser, { pose: 'ears', eyes: 'shut', mood: 'flat' })}</div>
      <h2 class="t-title" data-in>${pSpan(c.guesser)}, Kulaklarını Aç!</h2>
      <p class="t-lead" data-in>${g.hard ? 'Mırıltı tersten geliyor. Kolay gelsin!' : `${nameOf(c.singer)} bir şarkı mırıldandı. Bakalım tanıyacak mısın?`}</p>
      <button class="btn btn--primary btn--big nudge" data-act="ready" data-primary data-once>${icon('phones')}Hazırım</button>`, {
      ready: async () => {
        music.duck('hum', true);
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

  const pointsNow = () => Math.max(1, 3 - g.cur.hints - g.cur.wrongs);

  function guess() {
    const c = g.cur;
    // Kendi yazılan şarkıda sanatçı yok; tek ipucu ilk harfler olur
    const hasArtist = !!c.song.hint;
    const maxHints = hasArtist ? 2 : 1;
    const hintRows = [];
    if (hasArtist && c.hints >= 1) hintRows.push(html`<span class="hint-chip">${icon('star')}${c.song.hint}</span>`);
    if (c.hints >= maxHints) hintRows.push(html`<span class="hint-chip mono">${initials(c.song.text)}</span>`);
    const scene = stage.show(html`
      <p class="hum-pts" data-in>Şu an <b>${pointsNow()}</b> puanlık</p>
      ${clipCardHTML('h', g.hard ? 'Ters Mırıltı' : 'Mırıltı', c.play, 'big')}
      ${hintRows.length ? html`<div class="hint-row" data-in>${hintRows}</div>` : ''}
      <div class="guess-box" data-in><input class="field" data-guess maxlength="60" placeholder="Hangi şarkı?" aria-label="Tahmin" autocomplete="off"></div>
      <div class="row" data-in>
        <button class="btn" data-act="replay" data-silent>${icon('replay')}Tekrar Dinle</button>
        ${c.hints < maxHints ? html`<button class="btn btn--meh" data-act="hint">${icon('sparkle')}${hasArtist && c.hints === 0 ? 'Sanatçı' : 'İlk Harfler'}<span class="pts">−1</span></button>` : ''}
        <button class="btn btn--primary nudge" data-act="guess" data-primary>${icon('check')}Tahmin Et</button>
      </div>`, {
      'play-h': () => clip.play(),
      replay: () => clip.play(true),
      hint: () => {
        c.hints++;
        sfx.sparkle();
        guess();
      },
      guess: () => submit(scene.querySelector('[data-guess]').value.replace(/\s+/g, ' ').trim()),
    });
    const clip = wireClip(stage, scene, 'h', c.play);
    life.timeout(() => {
      if (stage.scene !== scene) return;
      if (c.hints === 0 && c.wrongs === 0) clip.play(true);
      scene.querySelector('[data-guess]').focus({ preventScroll: true });
    }, 350);
  }

  function submit(text) {
    const c = g.cur;
    stopClip();
    if (text && judgeGuess(c.song.text, text) === 'full') {
      right();
      return;
    }
    stage.show(html`
      <div class="qz-head" data-in>${avatar(c.singer, { mood: 'smirk', pose: 'think' })}<p class="t-hand">${nameOf(c.singer)}, sence doğru mu?</p></div>
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
    c.pts = pointsNow();
    recap(true);
  }

  function wrong(btn) {
    const c = g.cur;
    c.wrongs++;
    if (c.wrongs >= MAX_TRIES) {
      c.judged = true;
      c.pts = 0;
      recap(false);
      return;
    }
    sfx.fail();
    shakeEl(btn);
    toast(`Olmadı! ${MAX_TRIES - c.wrongs} tahmin hakkın kaldı.`, { tone: 'warn', ms: 1800 });
    life.timeout(() => { if (g && g.cur === c) guess(); }, 700);
  }

  function recap(ok) {
    const c = g.cur;
    music.duck('hum', false);
    // Artık herkes biliyor: orijinalini dinleyip mırıltıyla karşılaştırabilirsiniz
    helper.show(c.song);
    helper.setRecording(false);
    const lastRound = g.round + 1 >= g.total;
    const rev = g.hard ? c.play : reverseBuffer(c.clip);
    const scene = stage.show(html`
      <div class="word-wrap" data-in><div class="word-card card"><span class="wc-cat">${c.song.cat}</span><span class="wc-word">${c.song.text}</span>${c.song.hint ? html`<span class="wc-hint">${c.song.hint}</span>` : ''}</div></div>
      <h2 class="t-title" data-in>${ok ? pick(['Kulağın Müzikli!', 'Bildin!', 'Şarkı Senin!']) : 'Bu Şarkı Zordu'}</h2>
      <p class="t-lead" data-in>${ok ? `${nameOf(c.guesser)} ${c.pts} puan aldı.` : 'Bu turda puan yok. Mırıltıyı bir daha dinleyin, gülmek serbest.'}</p>
      <div class="mini-clips three" data-in>
        <button class="mini-clip" data-act="mc" data-k="n" data-silent><span class="mc-ic">${icon('play')}</span>Mırıltı<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-k="r" data-silent><span class="mc-ic">${icon('rewind')}</span>Tersten<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-k="s" data-silent><span class="mc-ic">${icon('sparkle')}</span>Sincap<span class="mc-bar"></span></button>
      </div>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${lastRound ? 'Sonuçları Gör' : 'Sonraki Tur'}${icon('arrow')}</button>`, {
      mc: (b) => {
        const k = b.dataset.k;
        play(b, k === 'r' ? rev : c.clip, k === 's' ? 1.8 : 1);
      },
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
    helper.hide();
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İki Müzik Kulağı' } });
    const sub = fin.winner === -1 ? 'Mırıltıları ikiniz de aynı hızla çözdünüz.' : `En iyi müzik kulağı ${nameOf(fin.winner)}.`;
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
