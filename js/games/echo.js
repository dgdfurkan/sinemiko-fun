// Yankı Tuzağı: kulaklıkta kendi sesini gecikmeli duyarken metni takılmadan okumaya çalış

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper, switchHTML, bindSwitch } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { toast } from '../ui/overlay.js';
import { VoiceRecorder, cleanClip } from '../audio/recorder.js';
import { makeBuffer, stopClip } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { ECHO_LINES, TWISTERS } from '../data/voice.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan, shakeEl } from './common.js';
import { micGate, withPermissionHint, micErrorSheet, miniPlayer } from './mic.js';

const RING = 2 * Math.PI * 44;
const SECONDS = 30;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-echo"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  life.add(() => {
    rec.close();
    stopClip();
    music.duck('echo', false);
    scoreboard.hide();
  });
  const cfg = { delay: '0.25', text: 'karisik', turns: 2, phones: false, first: 'random' };
  let g = null;
  let starting = false;
  let testing = 0;

  function lobby() {
    g = null;
    music.duck('echo', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Okuyan kulaklığı takar. Mikrofon açılınca kendi sesini biraz gecikmeli duyar.',
        'Ekrandaki metni yüksek sesle, takılmadan okumaya çalışır. Söylemesi kolay, yapması zor!',
        'Diğeri her takılmada “Takıldı” düğmesine basar. Bitirene 5 puan, her takılma 1 puan götürür.',
      ],
      options: html`
        ${optHTML('Gecikme', segHTML('delay', [['0.18', 'Hafif'], ['0.25', 'Orta'], ['0.35', 'Zalim']], cfg.delay))}
        ${optHTML('Metin', segHTML('text', [['cumle', 'Cümle'], ['tekerleme', 'Tekerleme'], ['karisik', 'Karışık']], cfg.text))}
        ${optHTML('Kişi Başı Tur', stepperHTML('turns', cfg.turns))}
        ${optHTML('İlk Okuyan', segHTML('first', FIRST_OPTIONS(), cfg.first))}
        <div class="phones-row">
          <span class="opt-label">Kulaklık Takılı</span>
          ${switchHTML('phones', cfg.phones, 'Kulaklık takılı')}
          <button class="btn btn--sm" data-act="test">${icon('phones')}<span data-test-label>Sesi Dene</span></button>
        </div>
        <p class="opt-note">Kulaklıksız oynama. Hoparlörden gelen gecikmeli ses mikrofona geri döner ve uğultu yapar.</p>`,
      start: 'Başla',
      startIcon: 'phones',
    }), {
      start: () => startGame(),
      test: () => testSound(),
    }, { className: 'has-lobby' });
    const segs = ['delay', 'text', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    bindStepper(scene.querySelector('[data-stepper="turns"]'), { value: cfg.turns, min: 1, max: 3, onChange: (v) => { cfg.turns = v; } });
    bindSwitch(scene.querySelector('[data-switch="phones"]'), { value: cfg.phones, onChange: (v) => { cfg.phones = v; } });
    stage.own(() => {
      segs.forEach((s) => s.destroy());
      if (testing) stopTest();
    });

    function stopTest() {
      clearTimeout(testing);
      testing = 0;
      rec.close();
      music.duck('echo', false);
      const l = scene.querySelector('[data-test-label]');
      if (l) l.textContent = 'Sesi Dene';
    }

    async function testSound() {
      if (testing) {
        stopTest();
        return;
      }
      if (!cfg.phones) {
        shakeEl(scene.querySelector('.phones-row'));
        toast('Önce kulaklığı tak ve anahtarı aç.', { tone: 'warn' });
        return;
      }
      music.duck('echo', true);
      testing = -1;
      scene.querySelector('[data-test-label]').textContent = 'Durdur';
      try {
        const ok = await withPermissionHint(() => rec.begin({ monitor: Number(cfg.delay) }));
        if (!ok || !life.alive || testing !== -1) return;
        toast('Bir şeyler söyle, sesini gecikmeli duyacaksın.', { tone: 'good' });
        testing = setTimeout(() => stopTest(), 6000);
      } catch (err) {
        stopTest();
        micErrorSheet(err);
      }
    }
  }

  async function startGame() {
    if (starting) return;
    if (!cfg.phones) {
      const row = stage.scene.querySelector('.phones-row');
      if (row) shakeEl(row);
      sfx.boing();
      toast('Bu oyun kulaklıkla oynanır. Kulaklığı takıp anahtarı aç.', { tone: 'warn' });
      return;
    }
    starting = true;
    const btn = stage.scene.querySelector('[data-act="start"], [data-act="again"]');
    if (btn) btn.disabled = true;
    rec.close();
    const ok = await micGate(rec, life);
    starting = false;
    if (!ok) {
      if (life.alive && btn) btn.disabled = false;
      return;
    }
    const pool = cfg.text === 'cumle' ? ECHO_LINES : cfg.text === 'tekerleme' ? TWISTERS : [...ECHO_LINES, ...TWISTERS];
    g = { turn: 0, total: cfg.turns * 2, first: 0, deck: shuffle(pool), pool, delay: Number(cfg.delay), over: false };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Okuyor?' }) : Number(cfg.first);
    gear();
  }

  function gear() {
    const reader = (g.first + g.turn) % 2;
    const judgeP = other(reader);
    if (!g.deck.length) g.deck = shuffle(g.pool);
    g.cur = { reader, judgeP, text: g.deck.pop(), slips: 0, done: false };
    scoreboard.setMid(`Tur ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(reader);
    music.duck('echo', false);
    const slot = (i) => (i === reader
      ? html`<div class="duo-slot">${avatar(i, { props: 'phones', mood: 'wow', pose: 'mic' })}<span class="role-chip p${i}">Okuyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { mood: 'smirk', pose: 'think' })}<span class="role-chip p${i}">Hakem</span></div>`);
    const scene = stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(reader)} Okuyor</h2>
      <p class="t-lead" data-in>Kulaklığı tak. Kendi sesini gecikmeli duyacaksın, aldırma ve takılmadan oku. ${nameOf(judgeP)} hakem.</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('play')}Başla</button>`, {
      go: async () => {
        scene.classList.add('counting');
        await countdown(scene, life, { final: 'Oku!' });
        if (stage.scene === scene) read();
      },
    });
  }

  function read() {
    const c = g.cur;
    music.duck('echo', true);
    const scene = stage.show(html`
      <div class="wh-top" data-in>
        <div class="timer-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr-bg" cx="50" cy="50" r="44"/><circle class="tr-fg" cx="50" cy="50" r="44" style="stroke-dasharray:${RING};stroke-dashoffset:0"/></svg><span class="tr-num">${SECONDS}</span></div>
        <div class="wh-count"><span class="wh-got" data-slips>0</span><span class="wh-lbl">takılma</span></div>
      </div>
      <div class="phrase-wrap" data-in><div class="phrase-card card echo-card"><span class="pc-n" data-state>Mikrofon açılıyor</span><span class="pc-text">${c.text}</span></div></div>
      <div class="row" data-in>
        <button class="btn btn--bad btn--big" data-act="slip" disabled>${icon('x')}Takıldı!</button>
        <button class="btn btn--good btn--big" data-act="finish" data-primary disabled>${icon('check')}Bitirdi!</button>
      </div>
      <p class="key-hint" data-in><span class="key">T</span> takıldı <span class="key">Enter</span> bitirdi</p>`, {
      slip: () => {
        if (c.done) return;
        c.slips++;
        slips.textContent = String(c.slips);
        sfx.buzz();
        card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px) rotate(-1deg)' }, { transform: 'translateX(10px) rotate(1deg)' }, { transform: 'translateX(0)' }], { duration: 320 });
      },
      finish: () => end(true),
    }, {
      onKey: (e, typing) => {
        if (typing || e.repeat || e.code !== 'KeyT') return false;
        e.preventDefault();
        const b = scene.querySelector('[data-act="slip"]');
        if (b && !b.disabled) b.click();
        return true;
      },
    });
    const card = scene.querySelector('.echo-card');
    const slips = scene.querySelector('[data-slips]');
    const state = scene.querySelector('[data-state]');
    const fg = scene.querySelector('.tr-fg');
    const num = scene.querySelector('.tr-num');
    const ring = scene.querySelector('.timer-ring');
    let timer = 0;
    stage.own(() => {
      clearInterval(timer);
      document.body.classList.remove('audio-focus');
      if (!c.done) rec.close();
    });

    (async () => {
      let ok = false;
      try {
        ok = await withPermissionHint(() => rec.begin({ monitor: g.delay }));
      } catch (err) {
        if (life.alive && stage.scene === scene) micErrorSheet(err);
        return;
      }
      if (!ok || !life.alive || stage.scene !== scene) {
        rec.close();
        return;
      }
      document.body.classList.add('audio-focus');
      state.textContent = 'Şimdi oku!';
      card.classList.add('live');
      scene.querySelectorAll('[data-act="slip"], [data-act="finish"]').forEach((b) => { b.disabled = false; });
      const endAt = performance.now() + SECONDS * 1000;
      let lastSec = SECONDS;
      timer = life.interval(() => {
        if (c.done) return;
        const left = Math.max(0, (endAt - performance.now()) / 1000);
        const sec = Math.ceil(left);
        fg.style.strokeDashoffset = String(RING * (1 - left / SECONDS));
        if (sec !== lastSec) {
          lastSec = sec;
          num.textContent = String(sec);
          ring.classList.toggle('hurry', sec <= 8);
        }
        if (left <= 0) end(false);
      }, 100);
    })();

    async function end(finished) {
      if (c.done) return;
      c.done = true;
      clearInterval(timer);
      document.body.classList.remove('audio-focus');
      const raw = await rec.end();
      if (!life.alive || stage.scene !== scene) return;
      const clean = cleanClip(raw, rec.sampleRate);
      c.clip = clean ? makeBuffer(clean, rec.sampleRate) : null;
      c.finished = finished;
      c.pts = finished ? Math.max(1, 5 - c.slips) : 0;
      result();
    }
  }

  function result() {
    const c = g.cur;
    music.duck('echo', false);
    const last = g.turn + 1 >= g.total;
    const title = !c.finished ? 'Süre Bitti!' : c.slips === 0 ? 'Kusursuz!' : c.slips <= 2 ? 'Fena Değil!' : 'Dil Dolaştı!';
    const scene = stage.show(html`
      <div class="big-blob" data-in>${avatar(c.reader, c.pts >= 4 ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'phones' } : { mood: c.pts ? 'smirk' : 'sad', props: 'phones sweat' })}</div>
      <h2 class="t-title" data-in>${title}</h2>
      <p class="big-stat" data-in><b>${c.pts}</b> puan</p>
      <p class="t-lead" data-in>${c.slips} kez takıldı.${c.finished ? '' : ' Metin süre bitmeden tamamlanamadı.'}</p>
      ${c.clip ? html`<div class="mini-clips two" data-in>
        <button class="mini-clip" data-act="mc" data-r="1" data-silent><span class="mc-ic">${icon('play')}</span>Kendini Dinle<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-r="1.8" data-silent><span class="mc-ic">${icon('sparkle')}</span>Sincap Hızında<span class="mc-bar"></span></button>
      </div>` : ''}
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Tur'}${icon('arrow')}</button>`, {
      mc: (b) => play(b, c.clip, Number(b.dataset.r)),
      next: () => {
        stopClip();
        g.turn++;
        if (g.turn >= g.total) final();
        else gear();
      },
    });
    const play = miniPlayer(scene);
    if (c.pts) {
      sfx.success();
      const el = scene.querySelector('.big-stat');
      scoreboard.add(c.reader, c.pts, el);
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40 + c.pts * 15, power: 12 });
    } else {
      sfx.fail();
    }
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İki Sağlam Dil' } });
    const sub = fin.winner === -1 ? 'Yankı ikinizi de aynı derecede zorladı.' : `Yankıya en iyi direnen ${nameOf(fin.winner)}.`;
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
