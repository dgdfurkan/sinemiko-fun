// Baloncuk Avı: aşağıdan yükselen baloncukları ellerinle patlat. Altın +3, bomba -3

import { html, Life, rand, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, finaleButtons } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawSkeleton, tag, PCOL } from './cam.js';

const TINTS = ['#9fdcff', '#ffc2dc', '#c6f28e', '#ffe08a', '#d6c4ff', '#9ff0d6'];
const PTS = { normal: 1, gold: 3, bomb: -3 };

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-popper');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { secs: '45' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Kameranın karşısına yan yana geçin; elleriniz ekranda görünsün.',
        'Aşağıdan baloncuklar yükselir. Elinle dokunduğun baloncuk patlar ve puanı sana yazılır.',
        html`Altın baloncuk <b>+3</b>, bomba <b>-3</b>! Süre bitince en çok puanı olan kazanır.`,
      ],
      options: optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const seg = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
    stage.own(() => seg.destroy());
  }

  function boot() {
    camBoot(stage, life, cam, 'pose', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawSkeleton(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Elleri Hazırlayın',
      tip: 'Kollarınızı açınca ekrana sığacak kadar geri çekilin.',
      onReady: () => play(),
    });
  }

  // Elin ucu: bilekten dirsek yönünde biraz ileri; avuç içinin ortasına denk gelir
  function handsOf(p) {
    const out = [];
    for (const [w, e] of [[15, 13], [16, 14]]) {
      const a = p.lm[w];
      const b = p.lm[e];
      if (a.v < 0.35) continue;
      const k = b.v > 0.3 ? 0.3 : 0;
      out.push([(a.x + (a.x - b.x) * k) * cam.W, (a.y + (a.y - b.y) * k) * cam.H]);
    }
    return out;
  }

  async function play() {
    const secs = Number(cfg.secs);
    g = { over: false, bubbles: [], bits: [], texts: [], stats: [[0, 0, 0], [0, 0, 0]], spawnAt: 0, t0: 0, left: secs, running: false };
    scoreboard.show({ mode: 'versus', mid: `${secs} sn` });
    const scene = stage.show(html`
      <div class="hud-top" data-in><div class="pop-clock" data-clock>${secs}</div></div>
      <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
    const clock = scene.querySelector('[data-clock]');
    const warn = scene.querySelector('[data-warn]');
    cam.draw = (gx, players, dt, t) => drawWorld(gx, players, dt, t);
    cam.onFrame = () => { warn.textContent = missingText(cam); };
    await countdown(scene, life, { final: 'Patlat!' });
    g.running = true;
    g.t0 = performance.now();
    g.spawnAt = 0;
    let shown = secs;
    const timer = life.interval(() => {
      const left = Math.max(0, secs - (performance.now() - g.t0) / 1000);
      g.left = left;
      const s = Math.ceil(left);
      if (s !== shown) {
        shown = s;
        clock.textContent = String(s);
        scoreboard.setMid(`${s} sn`);
        if (s <= 5 && s > 0) {
          sfx.tick(5 - s);
          clock.classList.add('hurry');
          clock.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
      }
      if (left <= 0) {
        clearInterval(timer);
        g.running = false;
        sfx.whistle();
        clock.textContent = 'Süre!';
        scoreboard.setMid('Süre Doldu');
        life.timeout(() => final(), 1400);
      }
    }, 100);
  }

  function spawn(progress) {
    const r = cam.H * rand(0.055, 0.085);
    const roll = Math.random();
    const type = roll < 0.1 ? 'gold' : roll < 0.1 + 0.08 + progress * 0.1 ? 'bomb' : 'normal';
    g.bubbles.push({
      x: rand(r + 10, cam.W - r - 10),
      y: cam.H + r,
      r,
      vy: -cam.H / rand(4.6 - progress * 1.6, 5.6 - progress * 1.8),
      wob: rand(0, Math.PI * 2),
      type,
      tint: pick(TINTS),
    });
  }

  function popBubble(b, who) {
    const pts = PTS[b.type];
    g.stats[who][b.type === 'gold' ? 1 : b.type === 'bomb' ? 2 : 0]++;
    if (b.type === 'bomb') {
      sfx.boom();
      shell.card.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(8px,-6px)' }, { transform: 'translate(0,0)' }], { duration: 320 });
    } else if (b.type === 'gold') {
      sfx.sparkle();
    } else {
      sfx.pop(0.8 + Math.random() * 0.5);
    }
    scoreboard.add(who, pts, null, { quiet: true });
    const n = b.type === 'bomb' ? 22 : 14;
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n + rand(-0.2, 0.2);
      const v = rand(160, 420) * (b.type === 'bomb' ? 1.4 : 1);
      g.bits.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: b.type === 'bomb' ? pick(['#ff8a3d', '#ffcd3c', '#2a1636']) : b.type === 'gold' ? '#ffcd3c' : b.tint, s: rand(4, 9) });
    }
    g.texts.push({ x: b.x, y: b.y, text: `${pts > 0 ? '+' : ''}${pts}`, c: pts > 0 ? PCOL[who] : '#ff4f62', life: 1 });
  }

  function drawBubble(gx, b, t) {
    const x = b.x + Math.sin(t / 380 + b.wob) * b.r * 0.12;
    const { y, r } = b;
    gx.lineWidth = 4;
    gx.strokeStyle = '#2a1636';
    if (b.type === 'bomb') {
      gx.beginPath();
      gx.moveTo(x + r * 0.5, y - r * 0.75);
      gx.quadraticCurveTo(x + r * 0.9, y - r * 1.3, x + r * 1.2, y - r * 1.15);
      gx.lineWidth = 5;
      gx.stroke();
      gx.beginPath();
      gx.arc(x + r * 1.22, y - r * 1.18, r * (0.16 + 0.06 * Math.sin(t / 60)), 0, Math.PI * 2);
      gx.fillStyle = '#ffcd3c';
      gx.fill();
      gx.beginPath();
      gx.arc(x, y, r, 0, Math.PI * 2);
      gx.fillStyle = '#3a2d5c';
      gx.fill();
      gx.lineWidth = 4;
      gx.stroke();
      gx.fillStyle = '#fff';
      gx.font = `400 ${Math.round(r * 0.8)}px "Lilita One", sans-serif`;
      gx.textAlign = 'center';
      gx.textBaseline = 'middle';
      gx.fillText('-3', x, y + 2);
      return;
    }
    gx.beginPath();
    gx.arc(x, y, r, 0, Math.PI * 2);
    gx.fillStyle = b.type === 'gold' ? '#ffcd3c' : `${b.tint}cc`;
    gx.fill();
    gx.stroke();
    gx.beginPath();
    gx.arc(x, y, r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
    gx.strokeStyle = '#ffffff';
    gx.lineWidth = Math.max(3, r * 0.14);
    gx.lineCap = 'round';
    gx.stroke();
    gx.beginPath();
    gx.arc(x + r * 0.42, y + r * 0.38, r * 0.1, 0, Math.PI * 2);
    gx.fillStyle = '#fff';
    gx.fill();
    if (b.type === 'gold') {
      gx.fillStyle = '#2a1636';
      gx.font = `400 ${Math.round(r * 0.8)}px "Lilita One", sans-serif`;
      gx.textAlign = 'center';
      gx.textBaseline = 'middle';
      gx.fillText('+3', x, y + 2);
    }
  }

  function drawWorld(gx, players, dt, t) {
    if (!g) return;
    const hands = [0, 1].map((i) => (players[i] ? handsOf(players[i]) : []));
    if (g.running) {
      const progress = Math.min(1, (performance.now() - g.t0) / 1000 / Number(cfg.secs));
      if (t >= g.spawnAt) {
        spawn(progress);
        g.spawnAt = t + rand(520, 760) * (1 - progress * 0.45);
      }
    }
    // Baloncuklar
    for (let k = g.bubbles.length - 1; k >= 0; k--) {
      const b = g.bubbles[k];
      b.y += b.vy * dt;
      let hit = -1;
      if (g.running) {
        for (const i of [0, 1]) {
          for (const [hx, hy] of hands[i]) {
            if (Math.hypot(hx - b.x, hy - b.y) < b.r + 16) hit = i;
          }
        }
      }
      if (hit >= 0) {
        popBubble(b, hit);
        g.bubbles.splice(k, 1);
      } else if (b.y < -b.r * 2) {
        g.bubbles.splice(k, 1);
      } else {
        drawBubble(gx, b, t);
      }
    }
    // Patlama parçaları
    for (let k = g.bits.length - 1; k >= 0; k--) {
      const p = g.bits[k];
      p.life -= dt * 1.8;
      if (p.life <= 0) {
        g.bits.splice(k, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
      gx.globalAlpha = Math.max(0, p.life);
      gx.beginPath();
      gx.arc(p.x, p.y, p.s * p.life, 0, Math.PI * 2);
      gx.fillStyle = p.c;
      gx.fill();
    }
    gx.globalAlpha = 1;
    // Oyuncular: silik iskelet, belirgin eller
    players.forEach((p, i) => { if (p) drawSkeleton(gx, cam, p, i, { alpha: 0.45 }); });
    hands.forEach((hs, i) => hs.forEach(([x, y]) => {
      gx.beginPath();
      gx.arc(x, y, 17, 0, Math.PI * 2);
      gx.fillStyle = PCOL[i];
      gx.fill();
      gx.lineWidth = 4;
      gx.strokeStyle = '#fff';
      gx.stroke();
      gx.beginPath();
      gx.arc(x, y, 21, 0, Math.PI * 2);
      gx.lineWidth = 3;
      gx.strokeStyle = '#2a1636';
      gx.stroke();
    }));
    // Uçan puanlar
    for (let k = g.texts.length - 1; k >= 0; k--) {
      const s = g.texts[k];
      s.life -= dt * 1.2;
      if (s.life <= 0) {
        g.texts.splice(k, 1);
        continue;
      }
      s.y -= 70 * dt;
      gx.globalAlpha = Math.min(1, s.life * 2);
      tag(gx, s.x, s.y, s.text, s.c, 22);
    }
    gx.globalAlpha = 1;
  }

  function final() {
    if (!g || g.over) return;
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const scores = scoreboard.scores;
    const { html: podium } = versusFinaleHTML(scores, { lines: { tie: 'Berabere! Baloncuklar Eşit Paylaşıldı' } });
    const stat = (i) => html`
      <div class="pop-stat p${i}">
        <span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span>
        <span><b>${g.stats[i][0]}</b> baloncuk</span>
        <span><b>${g.stats[i][1]}</b> altın</span>
        <span><b>${g.stats[i][2]}</b> bomba</span>
      </div>`;
    stage.show(html`
      ${podium}
      <div class="pop-stats" data-in>${stat(0)}${stat(1)}</div>
      ${finaleButtons()}`, {
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
