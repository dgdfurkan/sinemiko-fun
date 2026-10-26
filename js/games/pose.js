// Poz Ver!: kartta çıkan pozu ilk yapan kazanır. Sinemiko Diyor Ki modunda tuzak kartlar da gelir

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
import { camShell, camController, camBoot, waitPlayers, missingText, drawSkeleton, ring, tag, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { announcer } from '../audio/announcer.js';
import { POSES, body, figSVG } from '../vision/poses.js';

const HOLD = 0.5;
const TRAP_SEC = 3.6;

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-pose');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { rounds: '10', mode: 'sinemiko' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Kameranın karşısına yan yana geçin. Kollarınız ve beliniz görünecek kadar geri çekilin.',
        'Ekranda bir poz çıkar. Pozu yapıp yarım saniye tutan ilk kişi 2, ikinci 1 puan alır.',
        html`Sinemiko Diyor Ki modunda kartta <b>“Sinemiko Diyor Ki”</b> yazmıyorsa sakın yapma! Kanan 1 puan kaybeder, kanmayan 1 puan kazanır.`,
      ],
      options: html`
        ${optHTML('Mod', segHTML('mode', [['sinemiko', 'Sinemiko Diyor Ki'], ['klasik', 'Klasik']], cfg.mode))}
        ${optHTML('Tur', segHTML('rounds', [['6', '6'], ['10', '10'], ['14', '14']], cfg.rounds))}`,
      start: 'Kamerayı Aç',
      startIcon: 'play',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const segs = ['mode', 'rounds'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  function boot() {
    camBoot(stage, life, cam, 'pose', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawSkeleton(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Yan Yana Geçin',
      tip: 'Kollarınızı açınca ekrana sığacak kadar geri çekilin.',
      onReady: () => play(),
    });
  }

  async function play() {
    const total = Number(cfg.rounds);
    let deck = [];
    const next = (prev) => {
      if (!deck.length) deck = shuffle(POSES);
      let p = deck.pop();
      if (prev && p.id === prev.id) {
        deck.unshift(p);
        p = deck.pop();
      }
      return p;
    };
    g = { round: 0, total, album: [], over: false, lastTrap: false };
    announcer.preload(['sinemiko', 'go-poz', 'cd-3', 'cd-2', 'cd-1', 'trap', 'safe', 'miss', ...POSES.map((p) => `pose-${p.id}`)]);
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${total}` });
    const scene = stage.show(html`<div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Isınma Hareketleri</h2><p class="hud-tip">Kartı görünce pozu yapın ve tutun!</p></div></div>`, {}, { className: 'hud' });
    await countdown(scene, life, { final: 'Poz!', voice: 'go-poz' });
    let prev = null;
    while (g.round < total) {
      const pose = next(prev);
      prev = pose;
      // Tuzak kart: ilk turda yok, art arda da gelmez
      const trap = cfg.mode === 'sinemiko' && g.round > 0 && !g.lastTrap && Math.random() < 0.3;
      g.lastTrap = trap;
      scoreboard.setMid(`Tur ${g.round + 1} / ${total}`);
      await round(pose, trap);
      if (!life.alive) return;
      g.round++;
    }
    final();
  }

  function round(pose, trap) {
    return new Promise((resolve) => {
      const simon = cfg.mode === 'sinemiko';
      const windowSec = trap ? TRAP_SEC : Math.max(3.4, 6 - g.round * 0.2);
      const st = [0, 1].map(() => ({ hold: 0, done: false, pts: 0, label: '', t: 0 }));
      let started = 0;
      let last = 0;
      let order = 0;
      let ended = false;
      const scene = stage.show(html`
        <div class="hud-top" data-in>
          <div class="pose-cue ${simon ? 'simon' : ''}">
            ${simon ? html`<span class="cue-say ${trap ? 'none' : ''}">${trap ? 'Hazır mısın...' : 'Sinemiko Diyor Ki'}</span>` : ''}
            <div class="cue-fig">${raw(figSVG(pose.fig, '#ffcd3c'))}</div>
            <span class="cue-name">${pose.name}</span>
            <div class="cue-time"><span data-time></span></div>
          </div>
        </div>
        <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
      const timeBar = scene.querySelector('[data-time]');
      const warn = scene.querySelector('[data-warn]');
      sfx.whoosh();
      if (simon && !trap) announcer.say('sinemiko', `pose-${pose.id}`);
      else announcer.say(`pose-${pose.id}`);

      const finishPlayer = (i, now, pts, label) => {
        const s = st[i];
        s.done = true;
        s.pts = pts;
        s.label = label;
        s.t = now;
        const p = cam.players[i];
        const head = p ? p.lm[0] : { x: i === cam.leftIs ? 0.3 : 0.7, y: 0.3 };
        const [cx, cy] = cam.client(head.x, head.y);
        if (pts > 0) {
          sfx.success();
          burst(cx, cy, { count: 50, power: 12, colors: [PCOL[i], '#ffcd3c', '#fff'] });
          if (pts === 2) announcer.cheer();
        } else {
          sfx.fail();
          announcer.say('trap');
        }
        scoreboard.add(i, pts, cam.pointEl(head.x, head.y));
        if (p && (pts > 0 || trap)) {
          const img = cam.snapshot(p.box, 0.12);
          if (img) {
            cam.flash();
            g.album.push({ img, cap: trap ? 'Tuzağa Düştü!' : pose.name, by: nameOf(i), color: PCOL[i] });
          }
        }
      };

      const end = () => {
        if (ended) return;
        ended = true;
        cam.onFrame = null;
        if (trap) {
          if (!st[0].done || !st[1].done) announcer.react('safe');
          [0, 1].forEach((i) => {
            if (st[i].done) return;
            st[i].done = true;
            st[i].pts = 1;
            st[i].label = 'Kanmadı!';
            const p = cam.players[i];
            const head = p ? p.lm[0] : { x: i === cam.leftIs ? 0.3 : 0.7, y: 0.3 };
            scoreboard.add(i, 1, cam.pointEl(head.x, head.y));
          });
          sfx.sparkle();
        } else if (!st[0].done && !st[1].done) {
          sfx.boing();
          announcer.say('miss');
        }
        [0, 1].forEach((i) => { if (!st[i].done) st[i].label = 'Yetişemedi'; });
        timeBar.getAnimations().forEach((a) => a.pause());
        life.timeout(() => {
          if (stage.scene === scene) resolve();
        }, 1500);
      };

      // Kart yerine oturana kadar kısa bir an bekler
      life.timeout(() => {
        if (stage.scene !== scene) return;
        started = performance.now();
        timeBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: windowSec * 1000, easing: 'linear', fill: 'forwards' });
        life.timeout(() => { if (stage.scene === scene) end(); }, windowSec * 1000);
      }, 650);

      cam.onFrame = (players, now) => {
        const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
        last = now;
        warn.textContent = missingText(cam);
        if (!started || ended) return;
        const fresh = [];
        [0, 1].forEach((i) => {
          const s = st[i];
          if (s.done) return;
          const p = players[i];
          const b = p && body(p.lm, p.ar);
          const ok = !!b && pose.test(b, cam.sideOf(i));
          s.hold = ok ? s.hold + dt : Math.max(0, s.hold - dt * 1.5);
          if (s.hold >= HOLD) fresh.push(i);
        });
        if (!fresh.length) return;
        if (trap) {
          fresh.forEach((i) => finishPlayer(i, now, -1, 'Tuzak!'));
          if (st[0].done && st[1].done) end();
          return;
        }
        // Aynı karede bitirenler aynı puanı alır
        const pts = order === 0 ? 2 : 1;
        fresh.forEach((i) => finishPlayer(i, now, pts, order === 0 ? 'Birinci!' : 'İkinci'));
        order += fresh.length;
        if (st[0].done && st[1].done) end();
      };

      cam.draw = (gx, players, dt, t) => {
        players.forEach((p, i) => {
          if (!p) return;
          const s = st[i];
          const lm = p.lm;
          const glow = s.done && s.pts > 0 ? 1 : 0;
          drawSkeleton(gx, cam, p, i, { label: '', glow, color: s.done && s.pts < 0 ? '#ff4f62' : PCOL[i] });
          if (lm[0].v < 0.4) return;
          const x = lm[0].x * cam.W;
          const y = lm[0].y * cam.H;
          const sw = Math.hypot((lm[11].x - lm[12].x) * cam.W, (lm[11].y - lm[12].y) * cam.H);
          const r = Math.max(26, sw * 0.42);
          if (!s.done) ring(gx, x, y, r, s.hold / HOLD, PCOL[i]);
          const pop = s.done ? 1 + Math.max(0, 0.35 - (t - s.t) / 1000) : 1;
          const text = s.done ? `${s.label}${s.pts ? ` ${s.pts > 0 ? '+' : ''}${s.pts}` : ''}` : (ended ? s.label : nameOf(i));
          tag(gx, x, Math.max(24, y - r - 28), text, s.done ? (s.pts > 0 ? PCOL[i] : '#ff4f62') : PCOL[i], 18 * pop);
        });
      };
    });
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const scores = scoreboard.scores;
    const { html: podium, winner } = versusFinaleHTML(scores, { lines: { tie: 'Berabere! İkiniz de Poz Ustası' } });
    announcer.winner(winner);
    const album = g.album.slice(-12);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Poz Albümü', album, 'sinemiko-poz-albumu.jpg'),
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
