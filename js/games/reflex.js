// Hızlı El: işaret yeşile dönünce ilk basan kazanır, erken basan kaybeder

import { html, toHTML, Life, rand, pick } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, finaleButtons, other, popIn } from './common.js';

const KEYS = { KeyA: 0, KeyL: 1 };
const DECOYS = ['🍌', '🐸', '🤡', '🍕', '🦄', '🐙', '🌶️', '🧦'];
const NOBODY_MS = 3000;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-reflex"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { target: '5', mode: 'klasik' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        html`Parmaklar tuşlarda: ${nameOf(0)} <span class="key">A</span>, ${nameOf(1)} <span class="key">L</span>. Dokunmatik ekranda kendi tarafına dokun.`,
        'Ortadaki daire yeşile dönüp “Bas!” yazınca ilk basan turu alır.',
        'Yeşilden önce basan turu rakibine kaptırır. Tuzaklı modda sahte işaretler de çıkar.',
      ],
      options: html`
        ${optHTML('Kazanma Puanı', segHTML('target', [['3', '3'], ['5', '5'], ['7', '7']], cfg.target))}
        ${optHTML('Mod', segHTML('mode', [['klasik', 'Klasik'], ['tuzak', 'Tuzaklı']], cfg.mode), 'Tuzaklı modda muz, kurbağa gibi işaretlere sakın basma.')}`,
      start: 'Başla',
      startIcon: 'keyboard',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    const segs = [
      bindSeg(scene.querySelector('[data-seg="target"]'), { value: cfg.target, onChange: (v) => { cfg.target = v; } }),
      bindSeg(scene.querySelector('[data-seg="mode"]'), { value: cfg.mode, onChange: (v) => { cfg.mode = v; } }),
    ];
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  function startGame() {
    g = { target: Number(cfg.target), trap: cfg.mode === 'tuzak', round: 0, times: [[], []], early: [0, 0], over: false };
    scoreboard.show({ mode: 'versus', mid: `İlk ${g.target} puan` });
    arena();
  }

  const half = (i) => html`
    <button class="buzz-half reflex-half p${i}" data-p="${i}" aria-label="${nameOf(i)} bas">
      ${avatar(i, { mood: 'smirk' })}
      <span class="bh-name">${nameOf(i)}</span>
      <span class="key bh-key">${i ? 'L' : 'A'}</span>
      <span class="rx-time" data-time></span>
    </button>`;

  function arena() {
    const scene = stage.show(html`
      <div class="buzz-arena reflex-arena">
        ${half(0)}
        <div class="buzz-center">
          <div class="sig" data-sig data-in><span class="sig-txt">Hazır mısınız?</span></div>
          <p class="t-lead rx-status" data-status data-in>Parmaklarınızı tuşlara koyun.</p>
          <div class="center-actions" data-actions data-in>
            <button class="btn btn--primary btn--big nudge" data-act="go" data-primary>${icon('play')}Başla</button>
          </div>
        </div>
        ${half(1)}
      </div>`, {
      go: () => startRound(),
      end: () => final(),
    }, {
      onKey: (e, typing) => {
        if (typing || !(e.code in KEYS)) return false;
        e.preventDefault();
        if (!e.repeat) hit(KEYS[e.code], e.timeStamp);
        return true;
      },
    });
    const sig = scene.querySelector('[data-sig]');
    const sigTxt = sig.querySelector('.sig-txt');
    const status = scene.querySelector('[data-status]');
    const actions = scene.querySelector('[data-actions]');
    const halves = [...scene.querySelectorAll('.reflex-half')];
    const times = halves.map((h) => h.querySelector('[data-time]'));
    // Tıklama bırakınca gelir; süreyi doğru ölçmek için basıldığı an yakala
    halves.forEach((h, i) => life.on(h, 'pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      hit(i, e.timeStamp);
    }));

    let r = null;

    function setSig(state, text) {
      sig.className = `sig ${state}`;
      sigTxt.textContent = text;
    }

    function startRound() {
      g.round++;
      r = { state: 'wait', goAt: 0, timers: [] };
      actions.innerHTML = '';
      times.forEach((t) => { t.textContent = ''; t.className = 'rx-time'; });
      halves.forEach((h) => h.classList.remove('won', 'lost'));
      halves.forEach((h) => setBlob(h.querySelector('.blob'), { mood: 'smirk', eyes: 'open', pose: 'rest', props: '' }));
      setSig('wait', 'Bekle...');
      status.textContent = `${g.round}. tur. Yeşili bekle.`;
      sfx.soft();
      const delay = rand(1600, 4600);
      if (g.trap) {
        const count = Math.random() < 0.35 ? 0 : Math.random() < 0.6 ? 1 : 2;
        let at = rand(700, 1300);
        for (let k = 0; k < count && at + 900 < delay; k++) {
          const start = at;
          r.timers.push(life.timeout(() => {
            if (r.state !== 'wait') return;
            r.state = 'decoy';
            setSig('decoy', pick(DECOYS));
            sfx.boing();
          }, start));
          r.timers.push(life.timeout(() => {
            if (r.state !== 'decoy') return;
            r.state = 'wait';
            setSig('wait', 'Bekle...');
          }, start + 650));
          at += rand(1000, 1500);
        }
      }
      r.timers.push(life.timeout(() => {
        if (r.state !== 'wait' && r.state !== 'decoy') return;
        // İşaret boyandıktan hemen sonra süreyi başlat
        requestAnimationFrame(() => {
          if (!r || (r.state !== 'wait' && r.state !== 'decoy')) return;
          r.state = 'go';
          setSig('go', 'Bas!');
          sfx.signal();
          r.goAt = performance.now();
          r.timers.push(life.timeout(() => { if (r.state === 'go') nobody(); }, NOBODY_MS));
        });
      }, Math.max(delay, g.trap ? 2400 : delay)));
    }

    function clearTimers() {
      r.timers.forEach((id) => clearTimeout(id));
      r.timers = [];
    }

    function hit(p, stamp) {
      if (!r || r.state === 'done') return;
      if (r.state === 'wait' || r.state === 'decoy') {
        const decoy = r.state === 'decoy';
        r.state = 'done';
        clearTimers();
        g.early[p]++;
        sfx.error();
        setSig('early', decoy ? 'Tuzak!' : 'Erken!');
        times[p].textContent = decoy ? 'Tuzağa bastın' : 'Erken bastın';
        times[p].classList.add('bad');
        halves[p].classList.add('lost');
        setBlob(halves[p].querySelector('.blob'), { mood: 'sad', props: 'sweat' });
        finish(other(p), `${nameOf(p)} ${decoy ? 'tuzağa düştü' : 'erken bastı'}. Tur ${nameOf(other(p))} için.`);
        return;
      }
      if (r.state !== 'go') return;
      r.state = 'done';
      clearTimers();
      const ms = Math.max(1, Math.round((stamp || performance.now()) - r.goAt));
      g.times[p].push(ms);
      sfx.success();
      setSig('win', `${ms} ms`);
      times[p].textContent = `${ms} ms`;
      times[p].classList.add('good');
      const hr = halves[p].getBoundingClientRect();
      burst(hr.left + hr.width / 2, hr.top + hr.height * 0.4, { count: 60, power: 13 });
      finish(p, `${nameOf(p)} ${ms} milisaniyede bastı!`);
    }

    function nobody() {
      r.state = 'done';
      clearTimers();
      sfx.boing();
      setSig('wait', 'Zzz...');
      status.textContent = 'İkiniz de uyudunuz. Bu tur kimseye yok.';
      showNext(false);
    }

    function finish(winner, text) {
      halves[winner].classList.add('won');
      setBlob(halves[winner].querySelector('.blob'), { mood: 'laugh', eyes: 'happy', pose: 'cheer' });
      react(halves[winner].querySelector('.blob'), 'jump');
      scoreboard.add(winner, 1, sig);
      status.textContent = text;
      showNext(scoreboard.scores[winner] >= g.target);
    }

    function showNext(done) {
      actions.innerHTML = toHTML(html`<button class="btn btn--primary nudge" data-act="${done ? 'end' : 'go'}" data-primary data-once>${done ? 'Sonuçları Gör' : 'Sonraki Tur'}${icon('arrow')}</button>`);
      popIn(actions.children);
    }
  }

  function final() {
    g.over = true;
    const fin = versusFinaleHTML(scoreboard.scores);
    const stat = (i) => {
      const t = g.times[i];
      const best = t.length ? Math.min(...t) : null;
      const avg = t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : null;
      return html`<div class="rx-stat p${i}">
        <span class="rs-name">${nameOf(i)}</span>
        <span class="rs-row">En hızlı <b>${best ? `${best} ms` : 'Yok'}</b></span>
        <span class="rs-row">Ortalama <b>${avg ? `${avg} ms` : 'Yok'}</b></span>
        <span class="rs-row">Erken basış <b>${g.early[i]}</b></span>
      </div>`;
    };
    const allBest = Math.min(...g.times[0], ...g.times[1]);
    const record = Number.isFinite(allBest) && store.setBest('reflexMin', -allBest);
    stage.show(html`
      ${fin.html}
      <div class="rx-stats" data-in>${stat(0)}${stat(1)}</div>
      ${record ? html`<p class="t-lead" data-in>Yeni rekor: ${allBest} ms!</p>` : ''}
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
