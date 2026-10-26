// Surat Yap: kartta çıkan ifadeyi ilk yapan kazanır; her surat albüme girer

import { html, raw, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawFaceFrame, meter, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { announcer } from '../audio/announcer.js';
import { EXPRS, faceSVG } from '../vision/faces.js';

const HOLD = 0.4;
const WINDOW = 7;

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-faces');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { rounds: '8' };
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
        'Ekranda bir surat çıkar: şaşkın, öpücük, göz kırpma... Aynısını yapıp tutan ilk kişi 2, ikinci 1 puan alır.',
        'Oyun her denemenin fotoğrafını çeker. Sonunda Surat Albümü sizi bekliyor!',
      ],
      options: optHTML('Tur', segHTML('rounds', [['5', '5'], ['8', '8'], ['11', '11']], cfg.rounds)),
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
      tip: 'Yan yana oturun, ikiniz de ekrana bakın.',
      onReady: () => play(),
    });
  }

  async function play() {
    const total = Number(cfg.rounds);
    const deck = shuffle(EXPRS);
    g = { round: 0, total, album: [], over: false };
    announcer.preload(['go-surat', 'cd-3', 'cd-2', 'cd-1', 'miss', ...EXPRS.map((e) => `face-${e.id}`)]);
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${total}` });
    const scene = stage.show(html`<div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Yüz Kaslarını Isıtın</h2><p class="hud-tip">Kartı görünce suratı yapın ve tutun!</p></div></div>`, {}, { className: 'hud' });
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    await countdown(scene, life, { final: 'Surat!', voice: 'go-surat' });
    while (g.round < total) {
      if (!deck.length) deck.push(...shuffle(EXPRS));
      scoreboard.setMid(`Tur ${g.round + 1} / ${total}`);
      await round(deck.pop());
      if (!life.alive) return;
      g.round++;
    }
    final();
  }

  function round(expr) {
    return new Promise((resolve) => {
      const st = [0, 1].map(() => ({ v: 0, hold: 0, done: false, pts: 0, t: 0 }));
      let order = 0;
      let last = 0;
      let started = false;
      let ended = false;
      const scene = stage.show(html`
        <div class="hud-top" data-in>
          <div class="pose-cue face-cue">
            <div class="cue-fig">${raw(faceSVG(expr.face))}</div>
            <span class="cue-name">${expr.name}</span>
            <span class="cue-tip">${expr.tip}</span>
            <div class="cue-time"><span data-time></span></div>
          </div>
        </div>
        <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
      const timeBar = scene.querySelector('[data-time]');
      const warn = scene.querySelector('[data-warn]');
      sfx.whoosh();
      announcer.say(`face-${expr.id}`);

      const shoot = (i, cap) => {
        const p = cam.players[i];
        const img = p ? cam.snapshot(p.box, 0.45) : null;
        if (img) g.album.push({ img, cap, by: nameOf(i), color: PCOL[i] });
        return !!img;
      };

      const end = () => {
        if (ended) return;
        ended = true;
        cam.onFrame = null;
        timeBar.getAnimations().forEach((a) => a.pause());
        // Yetişemeyenin de o anki hali albüme girer
        [0, 1].forEach((i) => { if (!st[i].done) shoot(i, `${expr.name}?`); });
        if (!st[0].done && !st[1].done) {
          sfx.boing();
          announcer.say('miss');
        }
        life.timeout(() => { if (stage.scene === scene) resolve(); }, 1400);
      };

      life.timeout(() => {
        if (stage.scene !== scene) return;
        started = true;
        timeBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: WINDOW * 1000, easing: 'linear', fill: 'forwards' });
        life.timeout(() => { if (stage.scene === scene) end(); }, WINDOW * 1000);
      }, 600);

      cam.onFrame = (players, now) => {
        const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
        last = now;
        warn.textContent = missingText(cam);
        const fresh = [];
        [0, 1].forEach((i) => {
          const s = st[i];
          const p = players[i];
          s.v = p ? expr.value(p) : 0;
          if (!started || ended || s.done) return;
          s.hold = s.v >= 1 ? s.hold + dt : Math.max(0, s.hold - dt * 1.5);
          if (s.hold >= HOLD) fresh.push(i);
        });
        if (!fresh.length) return;
        const pts = order === 0 ? 2 : 1;
        if (pts === 2) announcer.cheer();
        fresh.forEach((i) => {
          const s = st[i];
          s.done = true;
          s.pts = pts;
          s.t = now;
          const p = players[i];
          sfx.success();
          if (p) {
            const [cx, cy] = cam.client(p.box.cx, p.box.cy);
            burst(cx, cy, { count: 46, power: 12, colors: [PCOL[i], '#ffcd3c', '#fff'] });
            scoreboard.add(i, pts, cam.pointEl(p.box.cx, p.box.y));
          } else {
            scoreboard.add(i, pts);
          }
          if (shoot(i, expr.name)) cam.flash();
        });
        order += fresh.length;
        if (st[0].done && st[1].done) end();
      };

      cam.draw = (gx, players, dt, t) => {
        players.forEach((p, i) => {
          if (!p) return;
          const s = st[i];
          const pop = s.done ? 1 + Math.max(0, 0.3 - (t - s.t) / 1000) : 1;
          drawFaceFrame(gx, cam, p, i, { glow: s.done ? pop : 0, label: s.done ? `${nameOf(i)} +${s.pts}` : nameOf(i) });
          meter(gx, cam, p, s.done ? 1 : s.v, PCOL[i]);
        });
      };
    });
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const { html: podium, winner } = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İkiniz de Surat Ustası' } });
    announcer.winner(winner);
    const album = g.album.slice(0, 24);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album.slice(-12)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Surat Albümü', album, 'sinemiko-surat-albumu.jpg'),
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
