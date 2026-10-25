// Bakışma Düellosu: ilk göz kırpan kaybeder. İstenirse gülmek de yasak

import { html, Life, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { fmtSec } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, switchHTML, bindSwitch } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, pSpan } from './common.js';
import { camShell, camController, camBoot, waitPlayers, drawFaceFrame, meter, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { blinkOf, smileOf } from '../vision/faces.js';

const CALIB_MS = 1600;
const GONE_MS = 1200;
const LAUGH = 0.32;
const LAUGH_MIN = 0.42;
const LAUGH_HOLD = 0.25;

const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const WHY = { blink: 'Göz Kırptı!', laugh: 'Güldü!', gone: 'Kaçtı!' };

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-stare');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { bestOf: '3', laugh: true };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Yan yana oturun ve ikiniz de ekrana, birbirinizin gözlerine bakın.',
        'Geri sayım bitince gözler açık kalır. İlk göz kırpanı kamera yakalar ve tur biter.',
        'Gülmek yasak açıksa gülümseyen de kaybeder. Kadrajdan kaçmak da yasak!',
      ],
      options: html`
        ${optHTML('Kaç Turda Biter', segHTML('bestOf', [['3', '3 Tur'], ['5', '5 Tur'], ['7', '7 Tur']], cfg.bestOf), 'Turların yarısından fazlasını alan kazanır.')}
        ${optHTML('Gülmek de Yasak', switchHTML('laugh', cfg.laugh, 'Gülmek de yasak'))}`,
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Gözlük gözü takip etmeyi zorlaştırabilir.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const seg = bindSeg(scene.querySelector('[data-seg="bestOf"]'), { value: cfg.bestOf, onChange: (v) => { cfg.bestOf = v; } });
    bindSwitch(scene.querySelector('[data-switch="laugh"]'), { value: cfg.laugh, onChange: (v) => { cfg.laugh = v; } });
    stage.own(() => seg.destroy());
  }

  function boot() {
    camBoot(stage, life, cam, 'face', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Göz Göze',
      tip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
      onReady: () => play(),
    });
  }

  function play() {
    const bestOf = Number(cfg.bestOf);
    g = { round: 0, need: Math.ceil(bestOf / 2), bestOf, album: [], over: false };
    scoreboard.show({ mode: 'versus', mid: `Tur 1` });
    round();
  }

  // İkisinin de açık gözdeki değerini ölçer; dar gözlü biri haksız yere kaybetmesin
  async function round() {
    scoreboard.setMid(`Tur ${g.round + 1}`);
    const scene = stage.show(html`
      <div class="hud-top" data-in>
        <div class="hud-card">
          <h2 class="t-big">Gözler Açık</h2>
          <p class="hud-tip" data-tip>Kameraya bakın, gözlerinizi ölçüyorum...</p>
        </div>
      </div>`, {}, { className: 'hud' });
    const tip = scene.querySelector('[data-tip]');
    const samples = [[[], []], [[], []]];
    let since = 0;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    await new Promise((resolve) => {
      cam.onFrame = (players, now) => {
        if (!players[0] || !players[1]) {
          tip.textContent = `${!players[0] && !players[1] ? 'İkinizi de' : nameOf(players[0] ? 1 : 0)} göremiyorum!`;
          since = 0;
          samples.forEach((s) => { s[0].length = 0; s[1].length = 0; });
          return;
        }
        tip.textContent = 'Kameraya bakın, gözlerinizi ölçüyorum...';
        if (!since) since = now;
        players.forEach((p, i) => {
          samples[i][0].push(blinkOf(p));
          samples[i][1].push(smileOf(p));
        });
        if (now - since >= CALIB_MS) {
          cam.onFrame = null;
          resolve();
        }
      };
    });
    if (!life.alive) return;
    const base = samples.map(([b, s]) => ({
      blink: clamp(median(b) + 0.3, 0.45, 0.78),
      smile: Math.min(0.45, median(s)),
    }));
    tip.textContent = 'Göz kırpmak yasak!';
    await countdown(scene, life, { final: 'Bakış!' });
    duel(base);
  }

  function duel(base) {
    const st = [0, 1].map(() => ({ bc: 0, lh: 0, blink: 0, over: 0 }));
    let t0 = 0;
    let last = 0;
    let done = false;
    const scene = stage.show(html`
      <div class="hud-top" data-in><div class="nl-clock stare-clock" data-clock>0,0</div></div>
      <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
    const clock = scene.querySelector('[data-clock]');
    const warn = scene.querySelector('[data-warn]');
    let shown = '';

    const lose = (who, why, now) => {
      if (done) return;
      done = true;
      cam.onFrame = null;
      const sec = (now - t0) / 1000;
      if (who === -1) {
        sfx.boing();
        warn.textContent = 'Aynı anda! Tur tekrar.';
        life.timeout(() => { if (stage.scene === scene) round(); }, 1600);
        return;
      }
      const p = cam.players[who];
      const img = p ? cam.snapshot(p.box, 0.5) : null;
      cam.flash();
      sfx.buzzer();
      g.album.push({ img, cap: WHY[why], by: nameOf(who), color: PCOL[who] });
      life.timeout(() => result(who, why, sec, img), 650);
    };

    cam.onFrame = (players, now) => {
      if (!t0) t0 = now;
      const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
      last = now;
      const txt = fmtSec((now - t0) / 1000).replace(' sn', '');
      if (txt !== shown) {
        shown = txt;
        clock.textContent = txt;
      }
      const bad = [];
      [0, 1].forEach((i) => {
        const p = players[i];
        const s = st[i];
        if (!p) {
          if (!cam.visible(i, GONE_MS)) bad.push([i, 'gone']);
          return;
        }
        s.blink = blinkOf(p);
        s.bc = s.blink >= base[i].blink ? s.bc + 1 : 0;
        // Yavaş cihazda kırpma tek kareye düşebilir; çok net kapanan göz tek karede de sayılır
        if (s.bc >= 2 || s.blink >= Math.max(0.72, base[i].blink + 0.15)) {
          bad.push([i, 'blink']);
          return;
        }
        if (cfg.laugh) {
          const sm = smileOf(p);
          s.over = sm - base[i].smile;
          s.lh = s.over >= LAUGH && sm >= LAUGH_MIN ? s.lh + dt : Math.max(0, s.lh - dt * 2);
          if (s.lh >= LAUGH_HOLD) bad.push([i, 'laugh']);
        }
      });
      warn.textContent = [0, 1].some((i) => !players[i]) ? 'Kadrajdan kaçmak yasak!' : '';
      if (bad.length === 2) lose(-1, '', now);
      else if (bad.length === 1) lose(bad[0][0], bad[0][1], now);
    };

    cam.draw = (gx, players) => players.forEach((p, i) => {
      if (!p) return;
      const s = st[i];
      const eye = clamp(s.blink / base[i].blink, 0, 1);
      drawFaceFrame(gx, cam, p, i, { glow: 0.4 + eye * 0.6, color: eye > 0.75 ? '#ff4f62' : PCOL[i] });
      meter(gx, cam, p, eye, eye > 0.75 ? '#ff4f62' : PCOL[i], { label: cfg.laugh && s.over / LAUGH > 0.6 ? 'Gülme!' : 'Göz' });
    });
  }

  function result(loser, why, sec, img) {
    cam.draw = null;
    const winner = 1 - loser;
    const scene = stage.show(html`
      <div class="polaroid big nl-pol" data-in>
        ${img ? html`<img src="${img}" alt="${nameOf(loser)}">` : html`<div class="polaroid-empty">Kadrajda yoktu</div>`}
        <span class="polaroid-cap">${WHY[why]}</span>
        <span class="polaroid-by">${nameOf(loser)}, ${fmtSec(sec)} sonra</span>
      </div>
      <h2 class="t-title" data-in>${pSpan(winner)} Turu Aldı!</h2>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>Devam${icon('arrow')}</button>`, {
      next: () => {
        g.round++;
        const sc = scoreboard.scores;
        if (sc[0] >= g.need || sc[1] >= g.need || g.round >= g.bestOf) final();
        else round();
      },
    });
    const pol = scene.querySelector('.polaroid');
    const r = pol.getBoundingClientRect();
    scoreboard.add(winner, 1, pol);
    burst(r.left + r.width / 2, r.top + r.height / 3, { count: 50, power: 13, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const { html: podium } = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! Gözler Eşit Güçlü' } });
    const album = g.album.filter((a) => a.img);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album.slice(-12)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}Kırpma Anları</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Bakışma Düellosu', album, 'sinemiko-bakisma.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final' });
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
