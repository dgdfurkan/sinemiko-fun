// Gizli kayıt: söyleyen kaydederken tahminci ya kulaklarını kapatır ya da kulaklık takıp müzik dinler.
// Kulaklık modunda müzik doğrudan kulaklığa, diğer sesler hoparlöre gider (Chrome, Edge).
// Kayıt her zaman bilgisayarın kendi mikrofonundan alınır; kulaklığın mikrofonu açılmaz.

import { html, toHTML } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/overlay.js';
import { segHTML, bindSeg, sliderHTML, bindSlider } from '../ui/controls.js';
import { ensureAudio, setBusVolume, canSplitOutput, routeMask, setOutput } from '../audio/engine.js';
import { setPreferredMic } from '../audio/recorder.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { optHTML, pSpan, popIn } from './common.js';

const PHONES_RE = /airpods|beats|headphone|headset|kulakl|earbud|buds|bluetooth|bose|sony|jbl|sennheiser|marshall|soundcore|jabra|b&o|beoplay|wh-|wf-|qc ?\d|harici/i;
const SPEAKER_RE = /hoparl|speaker|built-in|dahili|yerleşik|internal/i;
const BUILTIN_MIC_RE = /macbook|imac|mac mini|mac studio|built-in|dahili|yerleşik|internal|studio display/i;

// "Varsayılan - AirPods Pro (Bluetooth)" → "AirPods Pro"
export function cleanLabel(l) {
  return String(l || '')
    .replace(/^(varsayılan|default|iletişim|communications)\s*-\s*/i, '')
    .replace(/\s*\((bluetooth|built-in|[0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i, '')
    .trim();
}

const isPhones = (d) => PHONES_RE.test(d.label);

export async function listDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return { outs: [], ins: [], defOut: '' };
  let all = [];
  try {
    all = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return { outs: [], ins: [], defOut: '' };
  }
  const real = (kind) => all.filter((d) => d.kind === kind && d.label && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d) => ({ id: d.deviceId, label: cleanLabel(d.label), raw: d.label }));
  const def = all.find((d) => d.kind === 'audiooutput' && d.deviceId === 'default');
  return { outs: real('audiooutput'), ins: real('audioinput'), defOut: def ? cleanLabel(def.label) : '' };
}

// Varsayılan çıkış kulaklıksa onu, değilse ilk kulaklığa benzeyen aygıtı seçer
export function guessPhones({ outs, defOut }) {
  const byDefault = outs.find((d) => d.label === defOut && isPhones(d));
  return byDefault || outs.find(isPhones) || null;
}
export const guessSpeaker = ({ outs }) => outs.find((d) => SPEAKER_RE.test(d.label) && !isPhones(d)) || outs.find((d) => !isPhones(d)) || null;
export const guessMic = ({ ins }) => ins.find((d) => BUILTIN_MIC_RE.test(d.label) && !isPhones(d)) || ins.find((d) => !isPhones(d)) || null;

export function secretRec(root, life) {
  const st = {
    mode: store.get('secretMode') === 'phones' ? 'phones' : 'ears',
    touched: false,
    devs: { outs: [], ins: [], defOut: '' },
    phones: null,
    speaker: null,
    mic: null,
    split: false,
    masking: false,
    who: -1,
    setupDone: false,
  };
  const pill = document.createElement('div');
  pill.className = 'secret-pill';
  pill.hidden = true;
  root.append(pill);

  const level = () => store.get('maskVol');
  const applyLevel = () => setBusVolume('mask', level() * 1.4, 0.15);

  async function refresh() {
    st.devs = await listDevices();
    const keep = (cur, list) => (cur && list.find((d) => d.id === cur.id)) || null;
    st.phones = keep(st.phones, st.devs.outs) || guessPhones(st.devs);
    st.speaker = keep(st.speaker, st.devs.outs) || guessSpeaker(st.devs);
    if (st.speaker && st.phones && st.speaker.id === st.phones.id) st.speaker = null;
    st.mic = keep(st.mic, st.devs.ins) || guessMic(st.devs);
    return st.devs;
  }

  const detected = () => {
    const d = st.devs;
    if (!d.outs.length) return null;
    const ph = guessPhones(d);
    return ph && (!d.defOut || d.defOut === ph.label) ? ph : null;
  };

  /* ---------- Lobi seçeneği ---------- */

  const noteText = () => {
    const ph = detected();
    if (ph) return `${ph.label} takılı görünüyor. Kulaklıkla oynayınca kulak kapatmaya gerek yok.`;
    return st.mode === 'phones'
      ? 'Tahmin eden kulaklık takar, söyleyen kaydederken ona müzik çalarız.'
      : 'Kulaklık takarsanız tahmin edenin kulağına müzik çalarız, kulak kapatmak gerekmez.';
  };

  const optionHTML = () => optHTML(
    'Duymasın Diye',
    segHTML('secret', [['ears', 'Kulak Kapatır'], ['phones', 'Kulaklık Takar']], st.mode),
    html`<span data-secret-note>${noteText()}</span>`,
  );

  // Kulaklık modunda izin sorulurken bile kulaklığın mikrofonu açılmasın
  const preferMic = () => setPreferredMic(st.mode === 'phones' && st.mic ? st.mic.id : null);

  function bind(scene, stage) {
    const note = scene.querySelector('[data-secret-note]');
    const optBox = note && note.closest('.opt');
    const seg = bindSeg(scene.querySelector('[data-seg="secret"]'), {
      value: st.mode,
      onChange: (v) => {
        st.mode = v;
        st.touched = true;
        store.set('secretMode', v);
        preferMic();
        if (note) note.textContent = noteText();
      },
    });
    const update = async () => {
      await refresh();
      if (stage.scene !== scene) return;
      const ph = detected();
      if (optBox) optBox.classList.toggle('secret-found', !!ph);
      // Kulaklık takılıysa seçenek kendiliğinden kulaklığa geçer; kullanıcı elle seçtiyse dokunulmaz
      if (ph && !st.touched && st.mode !== 'phones') {
        st.mode = 'phones';
        seg.set('phones');
        sfx.ding();
      }
      preferMic();
      if (note) note.textContent = noteText();
    };
    update();
    const md = navigator.mediaDevices;
    if (md && md.addEventListener) {
      md.addEventListener('devicechange', update);
      stage.own(() => md.removeEventListener('devicechange', update));
    }
    stage.own(() => seg.destroy());
  }

  /* ---------- Kurulum ---------- */

  const devListHTML = (name, list, cur, empty) => (list.length
    ? html`<div class="dev-list ctl" data-dev="${name}" role="radiogroup">${list.map((d) => html`
        <button type="button" class="dev ${cur && cur.id === d.id ? 'on' : ''}" role="radio" aria-checked="${String(!!cur && cur.id === d.id)}" data-id="${d.id}">
          <span class="dev-ic">${icon(name === 'mic' ? 'mic' : isPhones(d) ? 'phones' : 'volUp')}</span><span class="dev-name">${d.label}</span><span class="dev-check">${icon('check')}</span>
        </button>`)}</div>`
    : html`<p class="opt-note">${empty}</p>`);

  // Mikrofon izni alındıktan sonra aygıtları seçtirir. true: devam, false: lobiye dön
  function setup(stage) {
    if (st.mode !== 'phones') {
      setPreferredMic(null);
      setOutput('');
      return Promise.resolve(true);
    }
    // Tekrar oynarken seçimler korunur
    if (st.setupDone) return apply().then(() => true);
    return new Promise((resolve) => {
      let testing = '';
      let done = false;
      const finish = async (ok) => {
        if (done) return;
        done = true;
        stopTest();
        if (ok) {
          await apply();
          st.setupDone = true;
        } else {
          setOutput('');
        }
        resolve(ok);
      };
      const stopTest = () => {
        if (testing === 'phones') stopMusic();
        testing = '';
        scene.querySelectorAll('[data-test]').forEach((b) => b.classList.remove('on'));
      };
      const canSplit = () => canSplitOutput() && st.devs.outs.length > 1 && !!st.phones && !!st.speaker;
      const body = () => {
        const outs = st.devs.outs;
        const split = canSplit();
        const warn = !outs.length
          ? 'Bu tarayıcı ses çıkışlarını ayrı ayrı seçemiyor. Bütün sesler bilgisayarın şu anki çıkışından, yani kulaklıktan çalar. Tahmin sırası gelince kulaklığı tahmin edene verin.'
          : !st.phones
            ? 'Kulaklık görünmüyor. Kulaklık takılı değilse müzik hoparlörden çalar ve kayda girer.'
            : !canSplitOutput()
              ? 'Bu tarayıcı sesi ikiye bölemiyor; bütün sesler kulaklıktan çalar. Chrome ile açarsanız ortak sesler hoparlörden gelir.'
              : '';
        return html`
          <div class="secret-setup card" data-in>
            <div class="ss-head">
              <span class="ss-ic">${icon('phones')}</span>
              <div><h2 class="t-big">Kulaklık Ayarı</h2><p class="hud-tip">Tahmin eden kulaklık takar. Söyleyen kaydederken kulaklıkta müzik çalar, söyleneni duymaz.</p></div>
            </div>
            <div class="ss-grid"><div class="ss-col">
            ${outs.length ? html`
              <div class="ss-row"><span class="opt-label">Müzik Hangi Kulaklıkta</span>
                ${devListHTML('phones', outs, st.phones, '')}
                <button class="btn btn--sm" data-act="test" data-test="phones">${icon('play')}Kulaklığı Dene</button>
              </div>
              ${split ? html`<div class="ss-row"><span class="opt-label">Ortak Sesler Nereden</span>
                ${devListHTML('speaker', outs.filter((d) => !st.phones || d.id !== st.phones.id), st.speaker, '')}
                <button class="btn btn--sm" data-act="test" data-test="speaker">${icon('volUp')}Hoparlörü Dene</button>
              </div>` : ''}` : ''}
            </div><div class="ss-col">
            <div class="ss-row"><span class="opt-label">Kayıt Hangi Mikrofondan</span>
              ${devListHTML('mic', st.devs.ins, st.mic, 'Mikrofon listesi alınamadı, varsayılan mikrofon kullanılacak.')}
              <span class="opt-note">Bilgisayarın kendi mikrofonu en iyisi. Kulaklığın mikrofonu açılırsa müzik bozulur ve kayda girer.</span>
            </div>
            <div class="ss-row"><span class="opt-label">Müzik Sesi</span>
              <div class="vol-row">${sliderHTML('mask', level(), 'Kulaklık müziğinin sesi')}</div>
              <span class="opt-note">Kulağı acıtmayacak ama konuşmayı bastıracak kadar.</span>
            </div>
            </div></div>
            ${warn ? html`<p class="ss-warn">${icon('eyeOff')}<span>${warn}</span></p>` : ''}
            <div class="row">
              <button class="btn" data-act="back">${icon('back')}Geri</button>
              <button class="btn btn--primary nudge" data-act="ok" data-primary>${icon('check')}Hazırız</button>
            </div>
          </div>`;
      };
      const scene = stage.show(html`<div class="ss-host" data-host>${body()}</div>`, {
        test: (t) => {
          const kind = t.dataset.test;
          if (testing === kind) {
            stopTest();
            return;
          }
          stopTest();
          testing = kind;
          t.classList.add('on');
          if (kind === 'phones') {
            startMusic(true);
          } else {
            setOutput(st.speaker ? st.speaker.id : '').then(() => {
              sfx.fanfare();
              life.timeout(() => { if (testing === 'speaker') stopTest(); }, 1600);
            });
          }
        },
        back: () => finish(false),
        ok: () => finish(true),
      });
      stage.own(() => {
        stopTest();
        if (!done) {
          done = true;
          resolve(false);
        }
      });
      const wire = () => {
        scene.querySelectorAll('[data-dev]').forEach((list) => {
          list.addEventListener('click', (e) => {
            const b = e.target.closest('.dev');
            if (!b) return;
            const kind = list.dataset.dev;
            const pool = kind === 'mic' ? st.devs.ins : st.devs.outs;
            const d = pool.find((x) => x.id === b.dataset.id);
            if (!d) return;
            sfx.soft();
            stopTest();
            if (kind === 'phones') {
              st.phones = d;
              if (st.speaker && st.speaker.id === d.id) st.speaker = guessSpeaker({ outs: st.devs.outs.filter((x) => x.id !== d.id) });
              render();
              return;
            }
            if (kind === 'speaker') st.speaker = d;
            else st.mic = d;
            list.querySelectorAll('.dev').forEach((x) => {
              const on = x === b;
              x.classList.toggle('on', on);
              x.setAttribute('aria-checked', String(on));
            });
          });
        });
        const sl = scene.querySelector('[data-slider="mask"]');
        if (sl) {
          bindSlider(sl, {
            value: level(),
            onInput: (v) => {
              store.set('maskVol', v);
              if (testing === 'phones' || st.masking) applyLevel();
            },
          });
        }
      };
      const render = () => {
        const host = scene.querySelector('[data-host]');
        host.innerHTML = toHTML(body());
        wire();
      };
      wire();
      refresh().then(() => { if (stage.scene === scene && !done) render(); });
    });
  }

  // Seçimleri uygular: mikrofon tercihi, ana çıkış hoparlöre, maske kulaklığa
  async function apply() {
    setPreferredMic(st.mic ? st.mic.id : null);
    st.split = canSplitOutput() && !!st.phones && !!st.speaker && st.devs.outs.length > 1;
    if (st.split) await setOutput(st.speaker.id);
  }

  /* ---------- Müzik ---------- */

  async function startMusic(test = false) {
    ensureAudio();
    if (st.split || (test && canSplitOutput() && st.phones)) {
      const ok = await routeMask(st.phones.id);
      if (!ok) st.split = false;
    }
    applyLevel();
    music.play('party');
    if (!test) {
      st.masking = true;
      showPill();
    }
  }

  function stopMusic() {
    st.masking = false;
    setBusVolume('mask', 0, 0.3);
    music.play('chill');
    hidePill();
    // Maske yolu sesin tamamen kısılmasını bekleyip normale döner
    life.timeout(() => { if (!st.masking) routeMask(null); }, 500);
  }

  function showPill() {
    const who = st.who >= 0 ? nameOf(st.who) : 'Kulaklık';
    pill.innerHTML = toHTML(html`
      <span class="sp-eq"><i></i><i></i><i></i><i></i></span>
      <span class="sp-text"><b>${who}</b> müzikte, duymuyor</span>
      <button class="ibtn" data-sp="down" aria-label="Kulaklık müziğini kıs">${icon('volDown')}</button>
      <button class="ibtn" data-sp="up" aria-label="Kulaklık müziğini aç">${icon('volUp')}</button>`);
    pill.hidden = false;
    popIn([pill]);
  }
  function hidePill() {
    if (pill.hidden) return;
    const a = pill.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px) scale(.9)' }], { duration: 260, easing: 'ease-in' });
    a.finished.then(() => { if (!st.masking) pill.hidden = true; }, () => {});
  }
  pill.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sp]');
    if (!b) return;
    const v = Math.max(0.1, Math.min(1, level() + (b.dataset.sp === 'up' ? 0.1 : -0.1)));
    store.set('maskVol', v);
    applyLevel();
    sfx.soft();
  });

  /* ---------- Tur sahneleri ---------- */

  // Turun başı: kulak kapatma ya da kulaklık takma. role: söyleyenin rozeti ("Söylüyor")
  function turnScene(stage, { speaker, guesser, role, title, onNext }) {
    st.who = guesser;
    const phones = st.mode === 'phones';
    const slot = (i) => (i === speaker
      ? html`<div class="duo-slot">${avatar(i, { pose: 'mic', props: 'mic', mood: 'smirk' })}<span class="role-chip p${i}">${role}</span></div>`
      : phones
        ? html`<div class="duo-slot">${avatar(i, { props: 'phones', eyes: 'shut', mood: 'happy' })}<span class="role-chip p${i}">Müzikte</span></div>`
        : html`<div class="duo-slot">${avatar(i, { pose: 'ears', eyes: 'shut', mood: 'flat' })}<span class="role-chip p${i}">Duymuyor</span></div>`);
    if (!phones) {
      return stage.show(html`
        <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
        <h2 class="t-title" data-in>${title}</h2>
        <p class="t-lead" data-in>${nameOf(guesser)}, kulaklarını kapat ve ekrana bakma. Hazır olunca ${nameOf(speaker)} devam etsin.</p>
        <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${icon('arrow')}Kulaklar Kapalı, Devam</button>`, {
        next: () => onNext(),
      });
    }
    let playing = false;
    const scene = stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(guesser)} Kulaklığı Taksın</h2>
      <p class="t-lead" data-in data-lead>${nameOf(guesser)} kulaklığı taksın ve ekrana bakmasın. Müzik başlayınca ${nameOf(speaker)} rahatça kaydedebilir.</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary>${icon('music')}<span data-label>Müziği Başlat</span></button>`, {
      go: async (btn) => {
        if (!playing) {
          playing = true;
          btn.disabled = true;
          await startMusic();
          if (stage.scene !== scene) return;
          btn.disabled = false;
          scene.querySelector('[data-label]').textContent = 'Müzik Çalıyor, Devam';
          scene.querySelector('[data-lead]').textContent = `${nameOf(guesser)} müziği duyuyorsa başparmağını kaldırsın. Ses azsa sol alttan açabilirsin.`;
          popIn([btn]);
          return;
        }
        btn.disabled = true;
        onNext();
      },
    });
    return scene;
  }

  // Tahmin sırası: müzik durur. Sahne başlığı ve kısa açıklama döner
  function handoff(guesser) {
    const was = st.masking;
    if (was) {
      stopMusic();
      sfx.ding();
    }
    if (st.mode !== 'phones') return { title: html`${pSpan(guesser)}, Kulaklarını Aç!`, lead: '' };
    return st.split
      ? { title: html`${pSpan(guesser)}, Kulaklığı Çıkar!`, lead: 'Müzik bitti. Bundan sonraki sesler hoparlörden gelecek. ' }
      : { title: html`${pSpan(guesser)}, Müzik Bitti!`, lead: 'Kulaklık takılı kalsın, sesler kulaklıktan gelecek. ' };
  }

  // Tek çıkışlı kulaklık modunda söyleyenin kendi kaydı kulaklıktan çalar; tahminci duymasın diye çalınmaz
  function mayPlay() {
    if (st.mode === 'phones' && st.masking && !st.split) {
      toast(`Bu kayıt kulaklıktan çalardı, ${nameOf(st.who)} duyardı. Dalgaya bakarak kontrol edebilirsin.`, { tone: 'warn', ms: 3600 });
      return false;
    }
    return true;
  }

  life.add(() => {
    st.masking = false;
    setBusVolume('mask', 0, 0.1);
    routeMask(null);
    setOutput('');
    setPreferredMic(null);
    pill.remove();
  });

  return {
    get mode() { return st.mode; },
    get masking() { return st.masking; },
    optionHTML,
    bind,
    setup,
    turnScene,
    handoff,
    mayPlay,
    stopMusic: () => { if (st.masking) stopMusic(); },
  };
}
