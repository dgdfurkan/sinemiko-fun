// Kopya Kedi: biri bir poz uydurup donar, öbürü aynısını yapmaya çalışır. Hayalet iskelet yol gösterir

import { html, Life } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, coinFlip, FIRST_OPTIONS, pSpan } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawSkeleton, tag, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { announcer } from '../audio/announcer.js';
import { body, poseVec, similarity } from '../vision/poses.js';

const COPY_SEC = 7;
const GOAL = 0.8;
const HOLD = 0.45;

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-mirror');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { turns: '3', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Kameranın karşısına yan yana geçin; kollarınız ekrana sığsın.',
        'Sırası gelen geri sayım bitene kadar en garip pozunu uydurur ve donar. Oyun pozu fotoğraflar.',
        'Öbürü 7 saniye içinde aynı pozu yapmaya çalışır. Ekrandaki hayalet iskelet yol gösterir. Ne kadar hızlı kopyalarsa o kadar puan!',
      ],
      options: html`
        ${optHTML('Kişi Başı Poz', segHTML('turns', [['2', '2'], ['3', '3'], ['4', '4']], cfg.turns))}
        ${optHTML('İlk Poz Veren', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const segs = ['turns', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
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
    const total = Number(cfg.turns) * 2;
    g = { turn: 0, total, album: [], over: false, first: 0 };
    announcer.preload(['turn-0-poz', 'turn-1-poz', 'turn-0-kopya', 'turn-1-kopya', 'go-pozver', 'go-kopyala', 'go-dondur', 'cd-3', 'cd-2', 'cd-1', 'copied', 'nope']);
    scoreboard.show({ mode: 'versus', mid: `Poz 1 / ${total}` });
    cam.draw = null;
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Poz Veriyor?' }) : Number(cfg.first);
    while (g.turn < total) {
      const leader = (g.first + g.turn) % 2;
      scoreboard.setMid(`Poz ${g.turn + 1} / ${total}`);
      scoreboard.setActive(leader);
      const target = await strike(leader);
      if (!life.alive) return;
      await copy(1 - leader, target);
      if (!life.alive) return;
      g.turn++;
    }
    final();
  }

  // Lider poz uydurur; geri sayım bitince pozu ve fotoğrafı alınır
  async function strike(leader) {
    for (;;) {
      const scene = stage.show(html`
        <div class="hud-top" data-in>
          <div class="hud-card">
            <h2 class="t-big">${pSpan(leader)} Poz Uyduruyor</h2>
            <p class="hud-tip">Ne kadar garip, o kadar iyi! Sıfırda donup kal.</p>
          </div>
        </div>
        <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
      const warn = scene.querySelector('[data-warn]');
      cam.onFrame = () => { warn.textContent = missingText(cam, [leader]); };
      cam.draw = (gx, players) => players.forEach((p, i) => {
        if (p) drawSkeleton(gx, cam, p, i, { alpha: i === leader ? 1 : 0.35, glow: i === leader ? 0.5 : 0, label: i === leader ? 'Poz Ver!' : nameOf(i) });
      });
      announcer.turn(leader, 'poz');
      await life.sleep(900);
      await countdown(scene, life, { from: 3, final: 'Dondur!', step: 900, voice: 'go-dondur' });
      const p = cam.players[leader];
      const b = p && body(p.lm, p.ar);
      if (b && b.arms) {
        cam.flash();
        return { vec: poseVec(b), img: cam.snapshot(p.box, 0.12), leader };
      }
      // Kare kare güncellenen uyarı bu mesajı silmesin
      cam.onFrame = null;
      sfx.boing();
      warn.textContent = `${nameOf(leader)} tam görünmedi. Kolların ekrana sığsın, tekrar!`;
      await life.sleep(1600);
    }
  }

  function copy(copier, target) {
    return new Promise((resolve) => {
      const st = { sim: 0, best: 0, hold: 0, done: false, ok: false, t: 0, label: '' };
      let last = 0;
      let start = 0;
      const scene = stage.show(html`
        <div class="hud-top" data-in>
          <div class="hud-card mirror-card">
            <div class="mc-photo">${target.img ? html`<img src="${target.img}" alt="Kopyalanacak poz">` : ''}</div>
            <div class="mc-text">
              <h2 class="t-big">${pSpan(copier)} Kopyalıyor</h2>
              <div class="mc-sim"><span>%</span><b data-sim>0</b></div>
            </div>
            <div class="cue-time"><span data-time></span></div>
          </div>
        </div>
        <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
      const simEl = scene.querySelector('[data-sim]');
      const warn = scene.querySelector('[data-warn]');
      const timeBar = scene.querySelector('[data-time]');
      announcer.turn(copier, 'kopya');
      sfx.whoosh();
      let shown = -1;

      const end = (ok, now) => {
        if (st.done) return;
        st.done = true;
        st.ok = ok;
        st.t = now;
        cam.onFrame = null;
        timeBar.getAnimations().forEach((a) => a.pause());
        const p = cam.players[copier];
        const head = p ? p.lm[0] : { x: copier === cam.leftIs ? 0.3 : 0.7, y: 0.3 };
        let pts = 0;
        if (ok) {
          const sec = (now - start) / 1000;
          pts = sec <= 2.5 ? 3 : sec <= 4.5 ? 2 : 1;
          st.label = `Kopyaladı! +${pts}`;
          sfx.success();
          announcer.say('copied');
          const [cx, cy] = cam.client(head.x, head.y);
          burst(cx, cy, { count: 60, power: 13, colors: [PCOL[copier], '#ffcd3c', '#fff'] });
          scoreboard.add(copier, pts, cam.pointEl(head.x, head.y));
        } else {
          st.label = `En iyi %${Math.round(st.best * 100)}`;
          sfx.fail();
          announcer.say('nope');
        }
        const img = p ? cam.snapshot(p.box, 0.12) : null;
        if (ok && img) cam.flash();
        if (target.img) g.album.push({ img: target.img, cap: 'Orijinal', by: nameOf(target.leader), color: PCOL[target.leader] });
        if (img) g.album.push({ img, cap: ok ? `Kopya %${Math.round(st.best * 100)}` : 'Olmadı', by: nameOf(copier), color: PCOL[copier] });
        life.timeout(() => { if (stage.scene === scene) resolve(); }, 1900);
      };

      life.timeout(() => {
        if (stage.scene !== scene) return;
        start = performance.now();
        timeBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: COPY_SEC * 1000, easing: 'linear', fill: 'forwards' });
        life.timeout(() => { if (stage.scene === scene) end(false, performance.now()); }, COPY_SEC * 1000);
      }, 500);

      cam.onFrame = (players, now) => {
        const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
        last = now;
        warn.textContent = missingText(cam, [copier]);
        const p = players[copier];
        const b = p && body(p.lm, p.ar);
        st.sim = b ? similarity(target.vec, poseVec(b)) : 0;
        const pct = Math.round(st.sim * 100);
        if (pct !== shown) {
          shown = pct;
          simEl.textContent = String(pct);
          simEl.parentElement.classList.toggle('hot', st.sim >= GOAL);
        }
        if (!start || st.done) return;
        st.best = Math.max(st.best, st.sim);
        st.hold = st.sim >= GOAL ? st.hold + dt : Math.max(0, st.hold - dt * 1.5);
        if (st.hold >= HOLD) end(true, now);
      };

      cam.draw = (gx, players, dt, t) => {
        players.forEach((p, i) => {
          if (!p) return;
          if (i !== copier) {
            drawSkeleton(gx, cam, p, i, { alpha: 0.35 });
            return;
          }
          const b = body(p.lm, p.ar);
          if (b && !st.done) drawGhost(gx, target.vec, b, st.sim);
          drawSkeleton(gx, cam, p, i, { label: '', glow: st.ok ? 1 : st.sim >= GOAL ? 0.6 : 0 });
          if (p.lm[0].v > 0.4) {
            const x = p.lm[0].x * cam.W;
            const y = p.lm[0].y * cam.H;
            const sw = b ? b.sw * cam.H : 80;
            const pop = st.done ? 1 + Math.max(0, 0.35 - (t - st.t) / 1000) : 1;
            const text = st.done ? st.label : `%${Math.round(st.sim * 100)}`;
            tag(gx, x, Math.max(24, y - Math.max(50, sw * 0.7)), text, st.done && !st.ok ? '#ff4f62' : PCOL[i], 18 * pop);
          }
        });
      };
    });
  }

  // Hedef pozu kopyalayanın omuzlarına oturtulmuş yarı saydam bir hayalet olarak çizer
  function drawGhost(gx, vec, b, sim) {
    const H = cam.H;
    const S = b.sw * H;
    const ls = [b.ls.x * H, b.ls.y * H];
    const rs = [b.rs.x * H, b.rs.y * H];
    const seg = (from, a, len) => [from[0] + Math.cos(a) * len * S, from[1] + Math.sin(a) * len * S];
    const le = seg(ls, vec.a[0], vec.len[0]);
    const lw = seg(le, vec.a[1], vec.len[1]);
    const re = seg(rs, vec.a[2], vec.len[2]);
    const rw = seg(re, vec.a[3], vec.len[3]);
    const mid = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2];
    const head = [mid[0] + vec.head.x * S, mid[1] + vec.head.y * S];
    const lines = [[ls, le], [le, lw], [rs, re], [re, rw], [ls, rs]];
    const w = Math.max(10, S * 0.13);
    gx.save();
    gx.lineCap = 'round';
    gx.globalAlpha = 0.85;
    gx.setLineDash([w * 0.2, w * 1.6]);
    gx.lineWidth = w + 8;
    gx.strokeStyle = '#2a1636';
    gx.beginPath();
    for (const [a, c] of lines) {
      gx.moveTo(a[0], a[1]);
      gx.lineTo(c[0], c[1]);
    }
    gx.stroke();
    gx.setLineDash([]);
    gx.globalAlpha = 0.5 + 0.3 * sim;
    gx.lineWidth = w;
    gx.strokeStyle = '#ffffff';
    gx.stroke();
    gx.beginPath();
    gx.arc(head[0], head[1], S * 0.28, 0, Math.PI * 2);
    gx.fillStyle = '#ffffff';
    gx.fill();
    gx.globalAlpha = 0.85;
    gx.lineWidth = 4;
    gx.strokeStyle = '#2a1636';
    gx.stroke();
    for (const h of [lw, rw]) {
      gx.beginPath();
      gx.arc(h[0], h[1], w * 0.9, 0, Math.PI * 2);
      gx.fillStyle = '#ffcd3c';
      gx.fill();
      gx.stroke();
    }
    gx.restore();
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    scoreboard.setActive(-1);
    const { html: podium, winner } = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! Tıpatıp Aynısınız' } });
    announcer.winner(winner);
    const album = g.album.slice(-12);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}Kopya Albümü</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Kopya Kedi', album, 'sinemiko-kopya-kedi.jpg'),
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
