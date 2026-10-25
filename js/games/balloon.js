// Balon Şişir: tek nefeste "aaa" diye ses çıkardıkça balon şişer; en uzun tutan kazanır

import { html, Life } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { fmtSec } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { toast } from '../ui/overlay.js';
import { avatar, PLAYER_COLORS } from '../ui/avatar.js';
import { VoiceRecorder } from '../audio/recorder.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst, cannons } from '../fx/confetti.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, finaleButtons, pSpan } from './common.js';
import { micGate, withPermissionHint, micErrorSheet } from './mic.js';

const CALIB_MS = 900;
const WAIT_MS = 6000;
const GAP_MS = 450;
const MAX_SEC = 40;

const balloonSVG = (i) => html`
  <svg class="balloon-svg" viewBox="0 0 140 200" aria-hidden="true" style="--bc:${PLAYER_COLORS[i]}">
    <path d="M70 146 C62 160 78 172 66 196" stroke="#2a1636" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M62 142 L78 142 L70 152 Z" fill="var(--bc)" stroke="#2a1636" stroke-width="4" stroke-linejoin="round"/>
    <path d="M70 6 C112 6 132 40 130 78 C128 116 100 142 70 142 C40 142 12 116 10 78 C8 40 28 6 70 6 Z" fill="var(--bc)" stroke="#2a1636" stroke-width="5.5"/>
    <ellipse cx="44" cy="40" rx="11" ry="20" transform="rotate(24 44 40)" fill="#fff" opacity=".42"/>
    <g class="bl-face">
      <ellipse cx="54" cy="76" rx="7" ry="9" fill="#fff" stroke="#2a1636" stroke-width="3"/>
      <ellipse cx="86" cy="76" rx="7" ry="9" fill="#fff" stroke="#2a1636" stroke-width="3"/>
      <circle cx="55" cy="78" r="3.6" fill="#2a1636"/><circle cx="87" cy="78" r="3.6" fill="#2a1636"/>
      <ellipse class="bl-mouth" cx="70" cy="100" rx="7" ry="8" fill="#2a1636"/>
    </g>
  </svg>`;

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-balloon"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  life.add(() => {
    rec.close();
    music.duck('balloon', false);
    scoreboard.hide();
  });
  const cfg = { tries: '2', first: 'random' };
  let g = null;
  let starting = false;

  function lobby() {
    g = null;
    music.duck('balloon', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Sırası gelen derin bir nefes alır, kısa bir sessizlikten sonra tek nefeste “aaa” diye ses çıkarır.',
        'Ses sürdükçe balon şişer. Ses kesildiği an balon uçup gider.',
        'Herkesin en uzun denemesi sayılır. Daha uzun tutan kazanır. 40 saniyeyi geçen balonu patlatır!',
      ],
      options: html`
        ${optHTML('Kişi Başı Deneme', segHTML('tries', [['1', '1'], ['2', '2'], ['3', '3']], cfg.tries))}
        ${optHTML('İlk Şişiren', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    const segs = ['tries', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
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
    g = { turn: 0, total: Number(cfg.tries) * 2, first: 0, best: [0, 0], over: false };
    scoreboard.show({ mode: 'versus', mid: `Deneme 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Şişiriyor?' }) : Number(cfg.first);
    intro();
  }

  function intro() {
    const p = (g.first + g.turn) % 2;
    scoreboard.setMid(`Deneme ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(p);
    music.duck('balloon', false);
    stage.show(html`
      <div class="balloon-box small" data-in>${balloonSVG(p)}</div>
      <h2 class="t-title" data-in>${pSpan(p)} Balonu Şişiriyor</h2>
      <p class="t-lead" data-in>Derin nefes al. Başla’ya basınca bir an sessiz kal, sonra tek nefeste uzun bir “aaa” çek.${g.best[p] ? ` Şu ana kadar en iyisi ${fmtSec(g.best[p])}.` : ''}</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('mic')}Başla</button>`, {
      go: () => blow(p),
    });
  }

  function blow(p) {
    const s = { state: 'opening', thr: 0.012, start: 0, last: 0, waitUntil: 0, ambient: [], sec: 0 };
    music.duck('balloon', true);
    const scene = stage.show(html`
      <p class="bl-status t-big" data-in data-status>Hazırlanıyor</p>
      <div class="balloon-stage" data-in>
        <div class="balloon-box" data-balloon style="--s:.42;--w:0">${balloonSVG(p)}</div>
      </div>
      <p class="bl-time" data-in><b data-time>0,0</b> sn</p>`);
    const status = scene.querySelector('[data-status]');
    const box = scene.querySelector('[data-balloon]');
    const time = scene.querySelector('[data-time]');
    let stopLoop = null;
    stage.own(() => {
      if (stopLoop) stopLoop();
      document.body.classList.remove('audio-focus');
      if (s.state !== 'done') rec.close();
    });

    (async () => {
      let ok = false;
      try {
        ok = await withPermissionHint(() => rec.begin());
      } catch (err) {
        if (life.alive && stage.scene === scene) {
          micErrorSheet(err);
          intro();
        }
        return;
      }
      if (!ok || !life.alive || stage.scene !== scene) {
        rec.close();
        return;
      }
      document.body.classList.add('audio-focus');
      s.state = 'calib';
      status.textContent = 'Şşş, sessiz...';
      const calibEnd = performance.now() + CALIB_MS;
      let shown = '';
      stopLoop = life.raf(() => {
        const now = performance.now();
        const lv = rec.level();
        if (s.state === 'calib') {
          s.ambient.push(lv);
          if (now >= calibEnd) {
            const sorted = s.ambient.slice().sort((a, b) => a - b);
            const amb = sorted[Math.floor(sorted.length * 0.8)] || 0;
            // Ortam gürültüsünün belirgin üstü ses sayılır
            s.thr = Math.max(0.014, amb * 3 + 0.006);
            s.state = 'wait';
            s.waitUntil = now + WAIT_MS;
            status.textContent = 'Şimdi aaa!';
            status.classList.add('go');
            sfx.soft();
          }
          return true;
        }
        const voiced = lv > s.thr;
        if (s.state === 'wait') {
          if (voiced) {
            s.state = 'sing';
            s.start = now;
            s.last = now;
            status.textContent = 'Devam, devam!';
          } else if (now > s.waitUntil) {
            finish(false);
            return false;
          }
          return true;
        }
        if (s.state === 'sing') {
          if (voiced) s.last = now;
          s.sec = (s.last - s.start) / 1000;
          // Başta hızlı, sonra yavaş şişer; uzun nefeste de ekrana sığar
          const grow = 1 - Math.exp(-s.sec / 9);
          box.style.setProperty('--s', (0.42 + grow * 0.7).toFixed(3));
          box.style.setProperty('--w', Math.min(1, lv * 8).toFixed(3));
          const txt = fmtSec(s.sec).replace(' sn', '');
          if (txt !== shown) {
            shown = txt;
            time.textContent = txt;
          }
          if (s.sec >= MAX_SEC) {
            finish(true, true);
            return false;
          }
          if (now - s.last > GAP_MS) {
            finish(true);
            return false;
          }
        }
        return true;
      });
    })();

    async function finish(sang, popped = false) {
      if (s.state === 'done') return;
      s.state = 'done';
      document.body.classList.remove('audio-focus');
      await rec.end();
      if (!life.alive || stage.scene !== scene) return;
      if (!sang) {
        sfx.boing();
        toast('Ses gelmedi. Mikrofona biraz daha yakın, daha yüksek sesle dene.', { tone: 'warn' });
        music.duck('balloon', false);
        intro();
        return;
      }
      const sec = s.sec;
      status.classList.remove('go');
      if (popped) {
        status.textContent = 'Patladı!';
        sfx.boom();
        const r = box.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { count: 160, power: 22, colors: [PLAYER_COLORS[p], '#ffcd3c', '#fff'] });
        const sc = box.style.getPropertyValue('--s') || '1';
        await box.animate([{ transform: `scale(${sc})` }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.catch(() => {});
      } else {
        status.textContent = 'Pıfff!';
        sfx.deflate();
        await box.animate([
          { transform: `scale(${box.style.getPropertyValue('--s')}) translate(0, 0) rotate(0)` },
          { transform: 'scale(.5) translate(-120px, -160px) rotate(-120deg)', offset: 0.3 },
          { transform: 'scale(.35) translate(160px, -260px) rotate(140deg)', offset: 0.6 },
          { transform: 'scale(.15) translate(-60px, -700px) rotate(400deg)', opacity: 0 },
        ], { duration: 1150, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      }
      if (!life.alive || stage.scene !== scene) return;
      result(p, sec, popped);
    }
  }

  function result(p, sec, popped) {
    music.duck('balloon', false);
    const record = sec > g.best[p];
    if (record) {
      g.best[p] = sec;
      scoreboard.setText(p, fmtSec(sec).replace(' sn', ''));
    }
    const allTime = store.setBest('balloon', Math.round(sec * 10));
    const last = g.turn + 1 >= g.total;
    stage.show(html`
      <h2 class="t-title" data-in>${popped ? 'Balon Patladı!' : sec >= 20 ? 'Ciğerlere Sağlık!' : sec >= 10 ? 'Güzel Nefes!' : 'Pıfff!'}</h2>
      <p class="big-stat" data-in><b>${fmtSec(sec).replace(' sn', '')}</b> saniye</p>
      <p class="t-lead" data-in>${nameOf(p)} için ${record ? 'yeni en iyi deneme.' : `en iyisi hâlâ ${fmtSec(g.best[p])}.`}${allTime ? ' Bu tarayıcıdaki en uzun nefes rekoru!' : ''}</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Deneme'}${icon('arrow')}</button>`, {
      next: () => {
        g.turn++;
        if (g.turn >= g.total) final();
        else intro();
      },
    });
    if (record || popped) sfx.success();
    if (allTime) cannons();
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const [a, b] = g.best;
    const winner = Math.abs(a - b) < 0.05 ? -1 : a > b ? 0 : 1;
    const big = (i) => html`<div class="final-balloon ${winner === i ? 'win' : ''}">
      <div class="balloon-box" style="--s:${(0.42 + (1 - Math.exp(-g.best[i] / 9)) * 0.7).toFixed(3)};--w:0">${balloonSVG(i)}</div>
      ${avatar(i, winner === -1 || winner === i ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: winner === i ? 'crown' : '' } : { mood: 'smirk', props: 'sweat' })}
      <span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)} ${fmtSec(g.best[i])}</span>
    </div>`;
    stage.show(html`
      <div class="final-balloons" data-in>${big(0)}${big(1)}</div>
      <h1 class="t-title" data-in>${winner === -1 ? 'Berabere! Ciğerler Eşit' : html`${pSpan(winner)} Kazandı!`}</h1>
      <p class="t-lead" data-in>${winner === -1 ? 'İkiniz de aynı sürede tuttunuz.' : `En uzun nefes ${nameOf(winner)} tarafından, ${fmtSec(g.best[winner])}.`}</p>
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
