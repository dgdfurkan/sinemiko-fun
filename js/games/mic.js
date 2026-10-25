// Mikrofonlu oyunların ortak parçaları: izin, kayıt sahnesi, klip kartı, küçük oynatıcı

import { html, toHTML } from '../lib/dom.js';
import { fmtSec } from '../lib/text.js';
import { icon } from '../ui/icons.js';
import { Waveform } from '../ui/waveform.js';
import { openSheet, toast } from '../ui/overlay.js';
import { cleanClip, micErrorText } from '../audio/recorder.js';
import { makeBuffer, playClip, stopClip } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { popIn } from './common.js';

// İzin penceresi açık kalırsa kullanıcıya nereye bakacağını söyle
export async function withPermissionHint(task) {
  const hint = setTimeout(() => toast('Tarayıcı mikrofon izni soruyor. Adres çubuğunun yanındaki pencereden izin ver.', { tone: 'pink', ms: 5000 }), 1200);
  try {
    return await task();
  } finally {
    clearTimeout(hint);
  }
}

export function micErrorSheet(err) {
  openSheet(html`
    <div class="sheet-ic">${icon('mic')}</div>
    <h2 class="t-big t-accent">Mikrofon Açılamadı</h2>
    <p class="t-lead">${micErrorText(err)}</p>
    <button class="btn btn--primary" data-act="ok" data-primary>Tamam</button>`, {
    actions: { ok: (t, e, close) => close() },
  });
}

// Oyun başında izni alır; sorun olursa açıklama gösterip false döner
export async function micGate(rec, life) {
  try {
    await withPermissionHint(() => rec.warmup());
    return life.alive;
  } catch (err) {
    if (life.alive) micErrorSheet(err);
    return false;
  }
}

/* ---------- Klip kartı ---------- */

export const clipCardHTML = (id, title, buffer, cls = '') => html`
  <div class="clip-card card ${cls}" data-clip="${id}" data-in>
    <button class="clip-play" data-act="play-${id}" data-silent aria-label="Dinle">${icon('play', 'i-play')}${icon('stop', 'i-stop')}</button>
    <div class="clip-body"><span class="clip-title">${title}</span><canvas class="clip-wave"></canvas></div>
    <span class="clip-dur">${fmtSec(buffer.duration)}</span>
  </div>`;

export function wireClip(stage, scene, id, buffer) {
  const card = scene.querySelector(`[data-clip="${id}"]`);
  const wf = new Waveform(card.querySelector('canvas'), { bars: 64 });
  wf.setBuffer(buffer);
  stage.own(() => wf.destroy());
  const ctl = {
    card,
    buffer,
    rate: 1,
    handle: null,
    play(force = false) {
      if (!force && card.classList.contains('playing')) {
        stopClip();
        return;
      }
      card.classList.add('playing');
      const h = playClip(ctl.buffer, {
        rate: ctl.rate,
        onProgress: (p) => { if (ctl.handle === h) wf.setProgress(p); },
        onEnd: () => {
          if (ctl.handle !== h) return;
          ctl.handle = null;
          card.classList.remove('playing');
          wf.setProgress(0);
        },
      });
      ctl.handle = h;
    },
    setBuffer(b, title) {
      ctl.buffer = b;
      wf.setBuffer(b);
      if (title) card.querySelector('.clip-title').textContent = title;
      card.querySelector('.clip-dur').textContent = fmtSec(b.duration / ctl.rate);
    },
    setRate(r, title) {
      ctl.rate = r;
      if (title) card.querySelector('.clip-title').textContent = title;
      card.querySelector('.clip-dur').textContent = fmtSec(ctl.buffer.duration / r);
    },
  };
  return ctl;
}

// Küçük oynatıcı düğmeleri: aynı anda tek klip çalar
export function miniPlayer(scene) {
  let current = null;
  const reset = (el) => {
    el.classList.remove('playing');
    el.style.setProperty('--p', '0');
  };
  return (el, buffer, rate = 1) => {
    const wasPlaying = el.classList.contains('playing');
    scene.querySelectorAll('.mini-clip.playing').forEach(reset);
    if (wasPlaying) {
      current = null;
      stopClip();
      return;
    }
    el.classList.add('playing');
    const h = playClip(buffer, {
      rate,
      onProgress: (p) => { if (current === h) el.style.setProperty('--p', p.toFixed(3)); },
      onEnd: () => { if (current === h) { current = null; reset(el); } },
    });
    current = h;
  };
}

/* ---------- Kayıt sahnesi ---------- */

// Büyük mikrofon düğmeli kayıt sahnesi. Boşluk tuşu başlatır ve bitirir.
// onDone(buffer, raw) temizlenmiş kaydı verir; ses gelmezse sahnede kalır.
export function recordScene(stage, life, rec, {
  who, heading, extra = '', actions = {}, onDone, maxSec = 10, duckKey = 'mic', hint = 'tuşuyla da başlatıp bitirebilirsin',
}) {
  music.duck(duckKey, true);
  stopClip();
  let state = 'idle';
  let startAt = 0;
  let stopLoop = null;
  const levels = new Array(48).fill(0.03);
  const scene = stage.show(html`
    <h2 class="t-big" data-in>${heading}</h2>
    ${extra}
    <div class="mic-wrap p${who}" data-in>
      <span class="mic-halo"></span>
      <button class="mic" data-act="mic" data-silent aria-label="Kayda başla">
        ${icon('mic', 'i-mic')}${icon('stop', 'i-stop')}
        <span class="mic-label">Kayda Başla</span>
      </button>
    </div>
    <div class="rec-meter" data-in><span class="rec-dot"></span><canvas class="live-wave"></canvas><span class="rec-time">0,0 sn</span></div>
    <p class="key-hint" data-in><span class="key">Boşluk</span> ${hint}</p>`,
  { ...actions, mic: () => toggle() },
  {
    onKey: (e, typing) => {
      if (e.code !== 'Space' || typing) return false;
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!e.repeat) toggle();
      return true;
    },
  });
  const wrap = scene.querySelector('.mic-wrap');
  const label = scene.querySelector('.mic-label');
  const time = scene.querySelector('.rec-time');
  const wf = new Waveform(scene.querySelector('.live-wave'), { bars: 48 });
  wf.setValues(levels);
  wf.setProgress(1);
  stage.own(() => {
    wf.destroy();
    if (stopLoop) stopLoop();
    document.body.classList.remove('audio-focus');
    if (state === 'opening' || state === 'rec') rec.close();
  });
  const lock = (on) => scene.querySelectorAll('[data-lock-rec]').forEach((b) => { b.disabled = on; });
  const reset = () => {
    state = 'idle';
    scene.classList.remove('is-busy', 'is-rec', 'is-opening');
    label.textContent = 'Kayda Başla';
    time.textContent = '0,0 sn';
    wrap.style.setProperty('--lvl', '0');
    lock(false);
  };

  async function toggle() {
    if (state === 'idle') {
      state = 'opening';
      stopClip();
      lock(true);
      scene.classList.add('is-opening');
      label.textContent = 'Hazırlanıyor';
      let ok = false;
      try {
        ok = await withPermissionHint(() => rec.begin());
      } catch (err) {
        if (!life.alive || stage.scene !== scene) return;
        reset();
        micErrorSheet(err);
        return;
      }
      if (!ok || !life.alive || stage.scene !== scene) {
        rec.close();
        return;
      }
      state = 'rec';
      startAt = performance.now();
      scene.classList.remove('is-opening');
      scene.classList.add('is-rec');
      document.body.classList.add('audio-focus');
      label.textContent = 'Bitir';
      let shown = '';
      let frame = 0;
      stopLoop = life.raf(() => {
        const sec = (performance.now() - startAt) / 1000;
        if (sec >= maxSec) {
          toggle();
          return false;
        }
        const lv = rec.level();
        wrap.style.setProperty('--lvl', Math.min(1, lv * 6).toFixed(3));
        // Dalga çizimi saniyede 30 kare yeter
        if (frame++ % 2 === 0) {
          levels.push(Math.min(1, lv * 7 + 0.03));
          levels.shift();
          wf.setValues(levels);
        }
        const txt = `${fmtSec(Math.min(sec, maxSec))} / ${maxSec} sn`;
        if (txt !== shown) {
          shown = txt;
          time.textContent = txt;
        }
        return true;
      });
    } else if (state === 'rec') {
      state = 'busy';
      if (stopLoop) {
        stopLoop();
        stopLoop = null;
      }
      document.body.classList.remove('audio-focus');
      scene.classList.remove('is-rec');
      scene.classList.add('is-busy');
      label.textContent = 'Hazırlanıyor';
      wrap.style.setProperty('--lvl', '0');
      const raw = await rec.end();
      if (!life.alive || stage.scene !== scene) return;
      const clean = cleanClip(raw, rec.sampleRate);
      if (!clean) {
        reset();
        sfx.boing();
        toast('Ses duyamadım. Mikrofona biraz daha yakın konuşup tekrar dene.', { tone: 'warn' });
        return;
      }
      onDone(makeBuffer(clean, rec.sampleRate), raw);
    }
  }
  return scene;
}

/* ---------- Kart seçme sahnesi ---------- */

const cardInner = (it) => html`<span class="wc-cat">${it.cat}</span><span class="wc-word">${it.text}</span>${it.hint ? html`<span class="wc-hint">${it.hint}</span>` : ''}`;

// Gizli kartı gösterir; "Başka Kart" ve isteğe bağlı "Kendim Yazacağım" ile değiştirilebilir
export function pickCardScene(stage, {
  hand, item, draw, onGo, goLabel = 'Bununla Kaydet', allowCustom = true,
  customCat = 'Kendi Kelimen', customPlaceholder = 'Ne söyleyeceksin?',
}) {
  let cur = item;
  let mode = 'card';
  let flipping = false;
  let dirty = false;
  const cardButtons = () => html`
    <button class="btn" data-act="shuffle">${icon('shuffle')}Başka Kart</button>
    ${allowCustom ? html`<button class="btn" data-act="custom">${icon('pencil')}Kendim Yazacağım</button>` : ''}
    <button class="btn btn--primary nudge" data-act="go" data-primary>${icon('mic')}${goLabel}</button>`;
  const customButtons = () => html`
    <button class="btn" data-act="back">${icon('back')}Kartlara Dön</button>
    <button class="btn btn--primary nudge" data-act="go" data-primary>${icon('mic')}${goLabel}</button>`;
  const customInner = () => html`<span class="wc-cat">${customCat}</span><input class="field wc-input" maxlength="40" placeholder="${customPlaceholder}" aria-label="${customCat}" autocomplete="off">`;
  const render = () => {
    card.innerHTML = toHTML(mode === 'custom' ? customInner() : cardInner(cur));
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
    <p class="t-hand" data-in>${hand}</p>
    <div class="word-wrap" data-in><div class="word-card card">${cardInner(cur)}</div></div>
    <div class="row" data-in data-row>${cardButtons()}</div>`, {
    shuffle: () => {
      cur = draw();
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
            input.classList.remove('shake');
            void input.offsetWidth;
            input.classList.add('shake');
            input.focus();
          }
          sfx.boing();
          return;
        }
        cur = { text: v, hint: '', cat: customCat };
      }
      onGo(cur);
    },
  });
  const card = scene.querySelector('.word-card');
  const row = scene.querySelector('[data-row]');
  async function swapCard() {
    if (flipping) {
      dirty = true;
      return;
    }
    flipping = true;
    sfx.flip();
    const a = card.animate([{ transform: 'perspective(900px) rotateY(0)' }, { transform: 'perspective(900px) rotateY(90deg) scale(.95)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    await a.finished.catch(() => {});
    render();
    const b = card.animate([{ transform: 'perspective(900px) rotateY(-90deg) scale(.95)' }, { transform: 'perspective(900px) rotateY(0)' }], { duration: 560, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    a.cancel();
    await b.finished.catch(() => {});
    flipping = false;
    if (dirty && stage.scene === scene) {
      dirty = false;
      swapCard();
    }
  }
  return scene;
}
