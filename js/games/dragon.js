// Marşmelov Kızart: ikiniz de minik ejderhasınız. Ağzını açınca ateş püskürür, önündeki marşmelov kızarır.
// Tam altın renginde bırakan kazanır; çok uzun üflersen alev alır, kömür olur. Her turda yeni marşmelov

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, jawOf, mouthOf, inked, roundRect, PCOL, tag, missingText, hideTop } from './arena.js';

const ROUND_SEC = 8;
const RATE = 0.36;
const FLARE = 1.6;

// Kızarma derecesi → renk: beyazdan altına, kahveye, kömüre
function toast(v) {
  const stops = [[0, [255, 252, 246]], [0.45, [255, 226, 160]], [0.8, [226, 150, 60]], [1, [150, 82, 34]], [1.3, [52, 32, 28]]];
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const [a, ca] = stops[k - 1];
      const [b, cb] = stops[k];
      const f = (v - a) / (b - a);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * f)).join(',')})`;
    }
  }
  return 'rgb(52,32,28)';
}

const grade = (v, burnt) => {
  if (burnt || v > 1.08) return { pts: 0, name: 'Kömür Oldu', color: '#3a2d5c' };
  if (v >= 0.7 && v <= 0.95) return { pts: 3, name: 'Tam Kıvamında', color: '#ffb347' };
  if (v >= 0.5) return { pts: 2, name: 'Güzel Kızarmış', color: '#ffcd3c' };
  if (v >= 0.25) return { pts: 1, name: 'Biraz Çiğ', color: '#ffe2a0' };
  return { pts: 0, name: 'Bembeyaz', color: '#e6dcd0' };
};

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-dragon',
    kind: 'face',
    noBig: true,
    cfg: { rounds: '5' },
    rules: [
      'İkiniz de minik birer ejderhasınız. Ağzını açınca ateş püskürür, önündeki marşmelov kızarır.',
      html`Tur sonunda <b>tam altın rengi</b> olan 3 puan alır. Uzun süre aralıksız üflersen alev alır, kömür olur.`,
      'Kısa kısa üfle, rengini izle. Her tur yeni bir marşmelov gelir.',
    ],
    options: (cfg) => optHTML('Tur', segHTML('rounds', [['3', '3'], ['5', '5'], ['7', '7']], cfg.rounds)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="rounds"]'), { value: cfg.rounds, onChange: (v) => { cfg.rounds = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Ejderhalar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-ates', 'burnt', 'perfect'],
    tie: 'Berabere! İkisi de Aynı Kıvamda',
    albumTitle: 'Marşmelov Kızart',
    mid: (cfg) => `Tur 1 / ${cfg.rounds}`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.rounds = Number(cfg.rounds);
  m.round = 0;
  m.base = [0.05, 0.05];
  m.fire = [false, false];
  m.mm = [null, null];
  m.flames = [[], []];
  m.perfect = [0, 0];
  m.burnt = [0, 0];
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Ejderhalar Hazır</h2><p class="hud-tip">Ağzını aç: ateş! Altın rengini yakala.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${ROUND_SEC}</b> sn</span></div>`);
  m.warn = scene.querySelector('[data-warn]');
  m.clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    m.warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      m.fire[i] = !!p && m.running && jawOf(p) > Math.max(0.3, m.base[i] + 0.22);
      if (p) m.mouth = m.mouth || [null, null];
      if (p) m.mouth[i] = mouthOf(p);
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  const base = await ctx.countdown(scene, { final: 'Ateş!', voice: 'go-ates', measure: (p) => ({ j: jawOf(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => clamp(b ? b.j : 0.05, 0, 0.3));
  hideTop(scene);
  startRound(ctx);
}

function startRound(ctx) {
  const { m } = ctx;
  m.round++;
  scoreboard.setMid(`Tur ${m.round} / ${m.rounds}`);
  m.mm = [0, 1].map(() => ({ v: 0, streak: 0, burnt: false, wob: rand(0, 6), smoke: 0 }));
  m.running = true;
  sfx.whoosh();
  m.clock = ctx.clock(m.clockEl, ROUND_SEC, { onEnd: () => endRound(ctx) });
}

// Marşmelovun ekrandaki yeri: ağzın önünde, partnere doğru
function spot(ctx, i) {
  const { cam, m } = ctx;
  const mo = m.mouth && m.mouth[i];
  const dir = cam.sideOf(i);
  const base = mo || { x: i === cam.leftIs ? 0.3 : 0.7, y: 0.6, w: 0.05 };
  // Ağzın önünde ve biraz aşağıda: yan yana oturanların marşmelovları ortada çakışmasın
  return { x: clamp(base.x + dir * Math.max(0.045, base.w * 1.1), 0.05, 0.95), y: clamp(base.y + 0.15, 0.2, 0.86), mx: base.x, my: base.y, w: base.w };
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  for (const i of [0, 1]) {
    const mm = m.mm[i];
    const sp = spot(ctx, i);
    const x = sp.x * W;
    const y = sp.y * H;
    const R = H * 0.05;
    // Ejderha boynuzları
    const p = players[i];
    if (p) {
      const b = p.box;
      for (const s of [-1, 1]) {
        const hx = (b.cx + s * b.w * 0.28) * W;
        const hy = b.y * H + 6;
        g.beginPath();
        g.moveTo(hx - 10, hy);
        g.quadraticCurveTo(hx + s * 6, hy - 40, hx + s * 16, hy - 46);
        g.quadraticCurveTo(hx + s * 4, hy - 20, hx + 10, hy);
        g.closePath();
        inked(g, PCOL[i], 3);
      }
    }
    if (mm) {
      if (m.running && dt > 0) {
        if (m.fire[i] && !mm.burnt) {
          mm.v += RATE * dt;
          mm.streak += dt;
          if (mm.streak > FLARE || mm.v > 1.3) {
            mm.burnt = true;
            mm.v = Math.max(mm.v, 1.25);
            sfx.boom();
            announcer.react('burnt');
            fx.burst(x, y, { n: 30, colors: ['#ff4f1f', '#ffcd3c', '#3a2d5c'], power: 420 });
            fx.text(x, y - 60, 'Alev Aldı!', '#ff4f1f', 22);
            ctx.shake(5);
          }
          if (Math.random() < 0.5) sfx.sizzle(0.12);
        } else {
          // Ağız kapanınca seri sıfırlanır, kalan sıcaklık biraz daha kızartır
          if (mm.streak > 0) mm.v += 0.03;
          mm.streak = 0;
        }
        if (m.fire[i]) {
          for (let k = 0; k < 3; k++) {
            m.flames[i].push({ x: sp.mx * W, y: sp.my * H, tx: x, ty: y, k: 0, s: rand(0.7, 1.3), o: rand(-14, 14) });
          }
        }
      }
      // Alevler
      const fl = m.flames[i];
      for (let k = fl.length - 1; k >= 0; k--) {
        const f = fl[k];
        f.k += dt * 3.2;
        if (f.k >= 1) {
          fl.splice(k, 1);
          continue;
        }
        const fx2 = f.x + (f.tx - f.x) * f.k;
        const fy2 = f.y + (f.ty - f.y) * f.k + f.o * Math.sin(f.k * 3);
        g.globalAlpha = 1 - f.k;
        g.beginPath();
        g.arc(fx2, fy2, (10 + 14 * f.k) * f.s, 0, Math.PI * 2);
        g.fillStyle = f.k < 0.35 ? '#ffe36b' : f.k < 0.7 ? '#ff9f1c' : '#ff4f1f';
        g.fill();
      }
      g.globalAlpha = 1;
      // Çubuk
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + cam.sideOf(i) * W * 0.02, y + H * 0.3);
      g.lineWidth = 8;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#c98b52';
      g.stroke();
      // Marşmelov
      const bob = Math.sin(t / 300 + mm.wob) * 2;
      roundRect(g, x - R * 0.85, y - R + bob, R * 1.7, R * 2, R * 0.6);
      inked(g, toast(mm.v), 3.5);
      g.fillStyle = '#ffffff55';
      g.fillRect(x - R * 0.5, y - R * 0.7 + bob, R * 0.35, R * 0.9);
      if (mm.burnt && Math.random() < 0.3) fx.burst(x, y - R, { n: 1, colors: ['#5a4a5a', '#7a6a7a'], power: 40, gravity: -120, size: [8, 14] });
      // Isı ölçeri: seri dolunca alev alır
      if (m.running && mm.streak > 0 && !mm.burnt) {
        const k = mm.streak / FLARE;
        g.beginPath();
        g.arc(x, y + bob, R * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        g.lineWidth = 6;
        g.strokeStyle = k > 0.7 ? '#ff4f1f' : '#ffcd3c';
        g.stroke();
      }
      if (!m.running && mm.grade) tag(g, x, y - R * 1.8, mm.grade.name, mm.grade.color === '#3a2d5c' ? '#3a2d5c' : PCOL[i], 18);
    }
    tag(g, sp.mx * W, Math.max(20, sp.my * H - H * 0.28), nameOf(i), PCOL[i], 14);
  }
  fx.draw(g, dt);
}

function endRound(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  m.fire = [false, false];
  for (const i of [0, 1]) {
    const mm = m.mm[i];
    const gr = grade(mm.v, mm.burnt);
    mm.grade = gr;
    if (gr.pts === 3) {
      m.perfect[i]++;
      ctx.shoot(i, 'Tam kıvamında!', { pad: 0.5 });
    }
    if (mm.burnt) m.burnt[i]++;
    const sp = spot(ctx, i);
    if (gr.pts) ctx.score(i, gr.pts, sp.x, sp.y);
  }
  const best = Math.max(m.mm[0].grade.pts, m.mm[1].grade.pts);
  if (best === 3) {
    sfx.success();
    announcer.react('perfect');
  } else sfx.ding();
  ctx.life.timeout(() => {
    if (m.over) return;
    if (m.round >= m.rounds) end(ctx);
    else startRound(ctx);
  }, 2400);
}

function end(ctx) {
  const { m } = ctx;
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.perfect[i]}</b> tam kıvam</span><span><b>${m.burnt[i]}</b> kömür</span>`),
    });
  }, 600);
}
