// Surat Kopyası: biri tuhaf bir surat yapar, kamera çeker. Öbürü aynısını yapmaya çalışır.
// Kamera iki yüzün ifadesini karşılaştırır; ne kadar benzerse o kadar puan. Sonra sıra değişir

import { html, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, B, PCOL, tag, roundRect, missingText } from './arena.js';
import { drawFaceFrame, meter } from './cam.js';

const MAKE_SEC = 3.5;
const COPY_SEC = 4.5;
// Aynada kopyalarken sağ ve sol karışır: çiftler toplam ve fark olarak karşılaştırılır
const PAIRS = [
  ['eyeBlinkLeft', 'eyeBlinkRight', 1.2], ['eyeWideLeft', 'eyeWideRight', 1], ['browDownLeft', 'browDownRight', 1.2],
  ['browOuterUpLeft', 'browOuterUpRight', 1], ['mouthSmileLeft', 'mouthSmileRight', 1.1], ['mouthFrownLeft', 'mouthFrownRight', 1],
  ['cheekSquintLeft', 'cheekSquintRight', 0.8], ['noseSneerLeft', 'noseSneerRight', 1], ['mouthStretchLeft', 'mouthStretchRight', 0.8],
  ['mouthLeft', 'mouthRight', 1.1], ['mouthPressLeft', 'mouthPressRight', 0.6],
];
const SINGLE = [['jawOpen', 1.5], ['mouthPucker', 1.3], ['mouthFunnel', 1.1], ['browInnerUp', 1.1], ['mouthRollLower', 0.7], ['mouthShrugUpper', 0.6]];

function vec(p, base) {
  const v = [];
  const val = (k) => Math.max(0, B(p, k) - (base ? base[k] || 0 : 0));
  for (const [a, b, w] of PAIRS) {
    const x = val(a);
    const y = val(b);
    v.push((x + y) * 0.5 * w, Math.abs(x - y) * 0.8 * w);
  }
  for (const [k, w] of SINGLE) v.push(val(k) * w);
  return v;
}

const norm = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

// Benzerlik 0-1: yön (kosinüs) ve şiddet birlikte
function similar(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na < 0.05) return nb < 0.15 ? 0.6 : 0.2;
  let dot = 0;
  for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
  const cos = dot / (na * nb || 1);
  const mag = Math.min(na, nb) / Math.max(na, nb);
  return clamp(Math.pow(Math.max(0, cos), 1.4) * (0.55 + 0.45 * mag), 0, 1);
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-copyface',
    kind: 'face',
    cfg: { rounds: '3' },
    rules: [
      'Sırası gelen en tuhaf suratını yapar, kamera fotoğrafını çeker.',
      'Öbürü fotoğrafa bakıp aynı suratı yapmaya çalışır. Kamera ne kadar benzediğini ölçer: %100 benzerlik 10 puan.',
      'Sonra sıra değişir. Kopyalaması zor surat yapmak da bir stratejidir!',
    ],
    options: (cfg) => optHTML('Kişi Başı Tur', segHTML('rounds', [['2', '2'], ['3', '3'], ['5', '5']], cfg.rounds)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="rounds"]'), { value: cfg.rounds, onChange: (v) => { cfg.rounds = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Suratlar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük ve aydınlık olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-surat', 'go-kopyala', 'copied'],
    tie: 'Berabere! İkiniz de Usta Taklitçi',
    albumTitle: 'Surat Kopyası',
    mid: (cfg) => `Tur 1 / ${Number(cfg.rounds) * 2}`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.total = Number(cfg.rounds) * 2;
  m.turn = 0;
  m.base = [{}, {}];
  m.phase = 'calib';
  m.sim = 0;
  m.best = 0;
  m.shots = [null, null];
  m.log = [[], []];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big" data-title>Önce Düz Bakın</h2><p class="hud-tip" data-tip>Kamera ikinizin de normal yüzünü ölçüyor.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill" data-pill hidden><b data-clock>0</b> sn</span></div>`);
  m.title = scene.querySelector('[data-title]');
  m.tip = scene.querySelector('[data-tip]');
  m.pill = scene.querySelector('[data-pill]');
  m.clockEl = scene.querySelector('[data-clock]');
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (m.phase !== 'copy') return;
    const L = m.leader;
    const c = 1 - L;
    const p = players[c];
    if (!p || !m.target) return;
    m.sim = similar(m.target, vec(p, m.base[c]));
    if (m.sim > m.best) {
      m.best = m.sim;
      m.bestAt = performance.now();
    }
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  // Düz yüz ölçümü: her ifadenin kişiye özel taban değeri
  const base = await ctx.countdown(scene, {
    final: 'Başla!',
    measure: (p) => {
      const o = {};
      for (const [a, b] of PAIRS) { o[a] = B(p, a); o[b] = B(p, b); }
      for (const [k] of SINGLE) o[k] = B(p, k);
      return o;
    },
  });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => b || {});
  nextTurn(ctx);
}

function nextTurn(ctx) {
  const { m, cam } = ctx;
  if (m.over) return;
  if (m.turn >= m.total) {
    end(ctx);
    return;
  }
  m.leader = m.turn % 2 === 0 ? cam.leftIs : 1 - cam.leftIs;
  m.target = null;
  m.shots = [null, null];
  m.best = 0;
  m.sim = 0;
  m.phase = 'make';
  scoreboard.setMid(`Tur ${m.turn + 1} / ${m.total}`);
  scoreboard.setActive(m.leader);
  m.title.textContent = `${nameOf(m.leader)} Surat Yapıyor`;
  m.tip.textContent = `${nameOf(1 - m.leader)}, bakma! Kopyalaması zor bir surat olsun.`;
  m.pill.hidden = false;
  announcer.say('go-surat');
  const samples = [];
  const prev = cam.onFrame;
  const sampler = (players, now) => {
    prev(players, now);
    const p = players[m.leader];
    if (p && m.phase === 'make' && m.left < 0.8) samples.push(vec(p, m.base[m.leader]));
  };
  cam.onFrame = sampler;
  m.left = MAKE_SEC;
  ctx.clock(m.clockEl, MAKE_SEC, {
    onTick: (left) => { m.left = left; },
    onEnd: () => {
      cam.onFrame = prev;
      if (m.over) return;
      const p = cam.players[m.leader];
      // Son anların ortalaması: yüz bir an kaysa da hedef bozulmasın
      if (samples.length) m.target = samples[0].map((_, k) => samples.reduce((s, v) => s + v[k], 0) / samples.length);
      else m.target = p ? vec(p, m.base[m.leader]) : null;
      cam.flash();
      m.shots[m.leader] = p ? cam.grab(p.box, 0.3, 420) : null;
      if (p) ctx.shoot(m.leader, `${nameOf(m.leader)} böyle yaptı`, { pad: 0.35, force: true });
      if (!m.target || norm(m.target) < 0.12) {
        m.tip.textContent = 'Bu surat fazla sade! Kopyalaması kolay olacak.';
      }
      ctx.life.timeout(() => copyPhase(ctx), 900);
    },
  });
}

function copyPhase(ctx) {
  const { m, cam } = ctx;
  if (m.over) return;
  const c = 1 - m.leader;
  m.phase = 'copy';
  m.best = 0;
  scoreboard.setActive(c);
  m.title.textContent = `${nameOf(c)} Kopyalasın!`;
  m.tip.textContent = 'Fotoğraftaki suratın aynısını yap.';
  announcer.say('go-kopyala');
  sfx.go();
  ctx.clock(m.clockEl, COPY_SEC, {
    onEnd: () => {
      if (m.over) return;
      m.phase = 'show';
      const p = cam.players[c];
      m.shots[c] = p ? cam.grab(p.box, 0.3, 420) : null;
      if (p) ctx.shoot(c, `%${Math.round(m.best * 100)} benzer`, { pad: 0.35, force: true });
      const pct = Math.round(m.best * 100);
      const pts = Math.round(m.best * 10);
      m.log[c].push(pct);
      m.title.textContent = `%${pct} Benzerlik`;
      m.tip.textContent = pct >= 80 ? 'Neredeyse ikiz!' : pct >= 55 ? 'Fena değil!' : 'Hiç benzemedi!';
      if (pts) ctx.score(c, pts, 0.5, 0.45);
      if (pct >= 80) {
        sfx.success();
        announcer.react('copied');
      } else sfx.ding();
      ctx.life.timeout(() => {
        m.turn++;
        nextTurn(ctx);
      }, 2800);
    },
  });
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  players.forEach((p, i) => {
    if (!p) return;
    const active = (m.phase === 'make' && i === m.leader) || (m.phase === 'copy' && i !== m.leader);
    drawFaceFrame(g, cam, p, i, { glow: active ? 0.5 + 0.3 * Math.sin(t / 150) : 0 });
    if (m.phase === 'copy' && i !== m.leader) meter(g, cam, p, m.sim, PCOL[i], { label: `%${Math.round(m.sim * 100)}` });
  });
  // Lider fotoğrafı ortada polaroid; sonuçta iki fotoğraf yan yana
  const shots = m.phase === 'show' ? [m.shots[m.leader], m.shots[1 - m.leader]] : m.phase === 'copy' ? [m.shots[m.leader]] : [];
  const s = Math.min(H * 0.34, W * 0.2);
  shots.forEach((c, k) => {
    if (!c) return;
    const n = shots.length;
    const x = W / 2 + (k - (n - 1) / 2) * (s + 30) - s / 2;
    const y = H * 0.12;
    g.save();
    g.translate(x + s / 2, y + s / 2);
    g.rotate((k ? 1 : -1) * 0.04);
    roundRect(g, -s / 2 - 10, -s / 2 - 10, s + 20, s + 46, 10);
    g.fillStyle = '#fffcf6';
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    g.drawImage(c, -s / 2, -s / 2, s, s);
    const who = k === 0 ? m.leader : 1 - m.leader;
    tag(g, 0, s / 2 + 18, k === 0 ? `${nameOf(who)}` : `${nameOf(who)} kopyası`, PCOL[who], 15);
    g.restore();
  });
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.phase = 'end';
  scoreboard.setActive(-1);
  sfx.whistle();
  ctx.life.timeout(() => {
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.log[i].length ? Math.max(...m.log[i]) : 0}%</b> en iyi kopya</span><span>${m.log[i].map((x) => `%${x}`).join(' · ')}</span>`),
    });
  }, 600);
}
