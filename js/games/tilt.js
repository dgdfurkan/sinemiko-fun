// Kafa Kafaya: iki seçenek çıkar, ikiniz de aynı anda kafanızı seçtiğiniz tarafa yatırırsınız.
// TikTok'taki "This or That" kafa yatırma filtresinin çiftlere uyarlanmış hali: aynı seçen uyum puanı kazanır.

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst, cannons } from '../fx/confetti.js';
import { PAIRS } from '../data/thisorthat.js';
import { lobbyHTML, optHTML, celebrate } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawFaceFrame, tag, PCOL, albumStripHTML, downloadAlbum } from './cam.js';

const TILT = 15;
const HOLD = 0.45;
const WINDOW = 9;

// Ekranda sağa yatık (sağ göz aşağıda) artı, sola yatık eksi derece
function rollOf(p) {
  const a = p.lm[33];
  const b = p.lm[263];
  if (!a || !b) return 0;
  const ar = p.ar || 16 / 9;
  const [l, r] = a.x < b.x ? [a, b] : [b, a];
  return (Math.atan2(r.y - l.y, (r.x - l.x) * ar) * 180) / Math.PI;
}

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-tilt');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { rounds: '10' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Yan yana oturun, yüzleriniz kameraya baksın.',
        'Ekranda iki seçenek çıkar. Soldakini seçen kafasını sola, sağdakini seçen sağa yatırır. İkiniz aynı anda, konuşmadan!',
        'Aynı tarafı seçerseniz uyum puanı kazanırsınız. Sonunda uyumunuz yüzde kaç, görelim.',
      ],
      options: optHTML('Soru', segHTML('rounds', [['6', '6'], ['10', '10'], ['15', '15']], cfg.rounds)),
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const seg = bindSeg(scene.querySelector('[data-seg="rounds"]'), { value: cfg.rounds, onChange: (v) => { cfg.rounds = v; } });
    stage.own(() => seg.destroy());
  }

  function boot() {
    camBoot(stage, life, cam, 'face', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Yüzler Kameraya',
      tip: 'Yan yana oturun, kafanızı rahatça yatırabileceğiniz kadar yer olsun.',
      onReady: () => play(),
    });
  }

  async function play() {
    const total = Number(cfg.rounds);
    g = { round: 0, total, deck: shuffle(PAIRS), matches: 0, answered: 0, album: [], over: false };
    scoreboard.show({ mode: 'team', mid: `Soru 1 / ${total}` });
    announcer.preload(['tilt-go', 'match', 'mismatch', 'cd-3', 'cd-2', 'cd-1', 'letsgo']);
    const scene = stage.show(html`<div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Kafalar Isınsın</h2><p class="hud-tip">Seçeneği görünce kafanı o tarafa yatır ve tut.</p></div></div>`, {}, { className: 'hud' });
    await countdown(scene, life, { final: 'Başla!', voice: 'letsgo' });
    while (g.round < total) {
      if (!g.deck.length) g.deck = shuffle(PAIRS);
      scoreboard.setMid(`Soru ${g.round + 1} / ${total}`);
      await round(g.deck.pop());
      if (!life.alive) return;
      g.round++;
    }
    final();
  }

  function round([a, b]) {
    return new Promise((resolve) => {
      const st = [0, 1].map(() => ({ roll: 0, side: 0, hold: 0, pick: 0 }));
      let started = false;
      let ended = false;
      let last = 0;
      const scene = stage.show(html`
        <div class="tilt-cards" data-in>
          <div class="tilt-opt l" data-side="-1"><span class="to-arrow">${icon('back')}</span><b>${a}</b></div>
          <span class="tilt-or">ya da</span>
          <div class="tilt-opt r" data-side="1"><b>${b}</b><span class="to-arrow">${icon('arrow')}</span></div>
        </div>
        <div class="hud-bottom">
          <div class="cue-time tilt-time"><span data-time></span></div>
          <p class="hud-warn" data-warn></p>
        </div>`, {}, { className: 'hud' });
      const timeBar = scene.querySelector('[data-time]');
      const warn = scene.querySelector('[data-warn]');
      if (g.round === 0) announcer.say('tilt-go');
      sfx.whoosh();

      const end = () => {
        if (ended) return;
        ended = true;
        cam.onFrame = null;
        timeBar.getAnimations().forEach((x) => x.pause());
        const [p0, p1] = st.map((s) => s.pick);
        const both = p0 && p1;
        const match = both && p0 === p1;
        if (both) g.answered++;
        const choice = (s) => (s === -1 ? a : s === 1 ? b : '');
        // İki kafa birden yana yatıkken çekilen kare albüme girer
        const img = cam.frameShot();
        if (img) {
          cam.flash();
          g.album.push({ img, cap: match ? choice(p0) : both ? `${choice(p0)} mi ${choice(p1)} mı?` : 'Kararsız!', by: match ? 'Aynı Kafa' : 'Ters Köşe', color: match ? '#22b38a' : '#ff4f62' });
        }
        if (match) {
          g.matches++;
          scoreboard.add('team', 1, scene.querySelector(`.tilt-opt[data-side="${p0}"]`));
          sfx.success();
          announcer.say('match');
          const card = scene.querySelector(`.tilt-opt[data-side="${p0}"]`);
          card.classList.add('win');
          const r = card.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 11, shapes: ['heart'], colors: ['#ff5fa2', '#ff8fc0', '#ffcd3c'] });
        } else {
          sfx.boing();
          if (both) announcer.say('mismatch');
        }
        warn.textContent = match ? 'Aynı kafa!' : both ? 'Ters köşe!' : 'Biriniz karar veremedi.';
        life.timeout(() => { if (stage.scene === scene) resolve(); }, 1800);
      };

      life.timeout(() => {
        if (stage.scene !== scene) return;
        started = true;
        timeBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: WINDOW * 1000, easing: 'linear', fill: 'forwards' });
        life.timeout(() => { if (stage.scene === scene) end(); }, WINDOW * 1000);
      }, 700);

      cam.onFrame = (players, now) => {
        const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
        last = now;
        if (!ended) warn.textContent = missingText(cam);
        if (!started || ended) return;
        [0, 1].forEach((i) => {
          const s = st[i];
          const p = players[i];
          s.roll = p ? rollOf(p) : 0;
          if (s.pick) return;
          const side = s.roll > TILT ? 1 : s.roll < -TILT ? -1 : 0;
          if (side && side === s.side) s.hold += dt;
          else s.hold = 0;
          s.side = side;
          if (s.hold >= HOLD) {
            s.pick = side;
            sfx.lock();
          }
        });
        if (st[0].pick && st[1].pick) end();
      };

      cam.draw = (gx, players) => players.forEach((p, i) => {
        if (!p) return;
        const s = st[i];
        const label = s.pick ? (ended ? (s.pick === -1 ? a : b) : 'Seçti!') : s.side ? '...' : nameOf(i);
        drawFaceFrame(gx, cam, p, i, { label, glow: s.pick ? 1 : s.hold / HOLD });
        // Yatma yönünü gösteren ok
        const bx = p.box;
        const y = (bx.y + bx.h) * cam.H + 26;
        const x = bx.cx * cam.W;
        if (s.side || s.pick) tag(gx, x + (s.pick || s.side) * 40, Math.min(cam.H - 24, y), (s.pick || s.side) === -1 ? '◀' : '▶', PCOL[i], 20);
      });
    });
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const pct = g.total ? Math.round((g.matches / g.total) * 100) : 0;
    const line = pct >= 80 ? 'Siz resmen tek beyinsiniz!' : pct >= 60 ? 'Çok uyumlusunuz, az kaldı tek beyin olmaya.' : pct >= 40 ? 'Zıt kutuplar birbirini çeker.' : 'Hiç aynı düşünmüyorsunuz ama işte aşk bu!';
    const album = g.album.filter((x) => x.img);
    stage.show(html`
      <div class="match-meter" data-in>
        <span class="mm-num">%${pct}</span>
        <span class="mm-label">Uyum</span>
      </div>
      <h1 class="t-title" data-in>${line}</h1>
      <p class="t-lead" data-in>${g.total} sorunun ${g.matches} tanesinde aynı tarafa yattınız.</p>
      ${album.length ? albumStripHTML(album.slice(-10)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Kafa Kafaya', album, 'sinemiko-kafa-kafaya.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final' });
    celebrate();
    if (pct >= 60) cannons();
    announcer.say(pct >= 60 ? 'match' : 'mismatch');
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
