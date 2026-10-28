// Kovboy Düellosu: eller aşağıda bekle, "Ateş!" deyince elini ilk kaldıran vurur.
// Erken kaldıran yanar; "Ateş... böceği!" gibi sahte komutlara dikkat

import { html, rand, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { optHTML } from './common.js';
import { camDuel, inked, PCOL, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';
import { body, handsDown, handRaised } from '../vision/poses.js';

const FAKES = [
  ['Ateş... Böceği!', 'fake-1'],
  ['Ateşli Bakış!', 'fake-2'],
  ['At... Lıkarınca!', 'fake-3'],
];
const HAT = [['#8a5a36', '#5d3a20'], ['#d97aa0', '#b04f78']];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-cowboy',
    kind: 'pose',
    cfg: { bestOf: '5' },
    rules: [
      'İkiniz de ellerinizi aşağıya, masaya koyun ve bekleyin. Gerilim tırmanır...',
      'Sunucu "Ateş!" dediği anda elini havaya kaldır. İlk kaldıran vurur, şapka uçar!',
      'Erken kaldıran yanar. "Ateş... böceği!" gibi sahte komutlarda kıpırdamak yok.',
    ],
    options: (cfg) => optHTML('Kaç Düello', segHTML('bestOf', [['3', '3 Düello'], ['5', '5 Düello'], ['7', '7 Düello']], cfg.bestOf), 'Yarısından fazlasını alan kazanır.'),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="bestOf"]'), { value: cfg.bestOf, onChange: (v) => { cfg.bestOf = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Kasabaya Hoş Geldiniz',
    waitTip: 'Belinizden yukarısı görünsün. Şapkalarınızı ben veriyorum.',
    voices: ['cowboy-ready', 'cowboy-fire', 'fake-1', 'fake-2', 'fake-3', 'early', 'yay-1'],
    tie: 'Berabere! İki Silah da Aynı Hızda',
    albumTitle: 'Kovboy Düellosu',
    mid: () => 'Düello 1',
    idle: (ctx, g, players) => drawHats(ctx, g, players),
    play: (ctx) => {
      Object.assign(ctx.m, { round: 0, best: [null, null], fouls: [0, 0], fly: [null, null] });
      duel(ctx);
    },
  });
}

// Şapka: başın üstünde, kulaklar arası genişliğe göre
function hatOf(ctx, p) {
  const { cam } = ctx;
  const lm = p.lm;
  const n = lm[0];
  const e1 = lm[7];
  const e2 = lm[8];
  const sw = Math.hypot((lm[11].x - lm[12].x) * cam.W, (lm[11].y - lm[12].y) * cam.H);
  const ew = e1 && e2 && e1.v > 0.4 && e2.v > 0.4 ? Math.hypot((e1.x - e2.x) * cam.W, (e1.y - e2.y) * cam.H) : sw * 0.45;
  const w = Math.max(sw * 0.75, ew * 2.1);
  return { x: n.x * cam.W, y: n.y * cam.H - ew * 1.05, w };
}

function hat(g, x, y, w, i, rot = 0) {
  const [c1, c2] = HAT[i];
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(-w * 0.28, 0);
  g.bezierCurveTo(-w * 0.3, -w * 0.5, -w * 0.1, -w * 0.44, 0, -w * 0.36);
  g.bezierCurveTo(w * 0.1, -w * 0.44, w * 0.3, -w * 0.5, w * 0.28, 0);
  g.closePath();
  inked(g, c1, 4);
  g.beginPath();
  g.rect(-w * 0.28, -w * 0.1, w * 0.56, w * 0.08);
  g.fillStyle = PCOL[i];
  g.fill();
  g.beginPath();
  g.moveTo(-w * 0.55, -w * 0.02);
  g.quadraticCurveTo(-w * 0.62, -w * 0.16, -w * 0.48, -w * 0.1);
  g.quadraticCurveTo(0, w * 0.1, w * 0.48, -w * 0.1);
  g.quadraticCurveTo(w * 0.62, -w * 0.16, w * 0.55, -w * 0.02);
  g.quadraticCurveTo(0, w * 0.2, -w * 0.55, -w * 0.02);
  inked(g, c2, 4);
  g.restore();
}

function drawHats(ctx, g, players) {
  const m = ctx.m;
  players.forEach((p, i) => {
    if (!p || !p.lm[0] || p.lm[0].v < 0.4) return;
    drawSkeleton(g, ctx.cam, p, i, { alpha: 0.75, label: '' });
    const h = hatOf(ctx, p);
    const fly = m && m.fly && m.fly[i];
    if (fly) {
      const s = (performance.now() - fly.t0) / 1000;
      hat(g, h.x + fly.vx * s, h.y + fly.vy * s + 900 * s * s, h.w, i, fly.rot * s);
    } else {
      hat(g, h.x, h.y, h.w, i);
    }
  });
}

function sunset(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#ff8a3d55');
  gr.addColorStop(0.5, '#ffcd3c11');
  gr.addColorStop(1, '#a8582055');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

function tumbleweed(g, x, y, r, t) {
  g.save();
  g.translate(x, y);
  g.rotate(t / 160);
  g.lineWidth = 3;
  g.strokeStyle = '#8a5a36';
  for (let k = 0; k < 7; k++) {
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.45, (k * Math.PI) / 7, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

async function duel(ctx) {
  const { cam, cfg, m, fx, life } = ctx;
  const need = Math.ceil(Number(cfg.bestOf) / 2);
  m.fly = [null, null];
  m.state = 'arm';
  m.sig = 0;
  m.drew = [0, 0];
  m.early = -1;
  m.weed = -0.2;
  fx.clear();
  scoreboard.setMid(`Düello ${m.round + 1}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big" data-title>Eller Aşağıda</h2><p class="hud-tip" data-tip>Ellerinizi masaya koyun, kıpırdamayın.</p></div></div>
    <div class="cowboy-call" data-call></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const title = scene.querySelector('[data-title]');
  const tip = scene.querySelector('[data-tip]');
  const call = scene.querySelector('[data-call]');
  const warn = scene.querySelector('[data-warn]');
  const showCall = (text, real) => {
    call.textContent = text;
    call.className = `cowboy-call on ${real ? 'real' : 'fake'}`;
    call.animate([{ transform: 'scale(2.4) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1.3)' });
  };
  let downSince = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const bs = players.map((p) => (p ? body(p.lm, p.ar) : null));
    if (m.state === 'arm') {
      const ok = bs.every((b) => b && handsDown(b));
      // Kimin hazır olmadığını söyle
      const up = [0, 1].filter((i) => bs[i] && !handsDown(bs[i]));
      const want = up.length ? `${up.map((i) => nameOf(i)).join(' ve ')}, ellerini indir!` : 'Ellerinizi masaya koyun, kıpırdamayın.';
      if (tip.textContent !== want) tip.textContent = want;
      if (ok) {
        if (!downSince) downSince = now;
        if (now - downSince > 700) startTension();
      } else {
        downSince = 0;
      }
      return;
    }
    if (m.state === 'tension') {
      bs.forEach((b, i) => {
        if (b && handRaised(b) && m.early < 0) {
          m.early = i;
          foul(ctx, i, scene, need);
        }
      });
      return;
    }
    if (m.state === 'fire') {
      bs.forEach((b, i) => {
        if (b && !m.drew[i] && handRaised(b)) m.drew[i] = now;
      });
      if (m.drew[0] || m.drew[1]) resolve(ctx, scene, need);
      else if (now - m.sig > 3500) {
        m.state = 'done';
        title.textContent = 'Kimse Çekmedi!';
        sfx.boing();
        life.timeout(() => { if (!m.over) duel(ctx); }, 1600);
      }
    }
  };
  cam.draw = (g, players, dt, t) => {
    if (m.state === 'tension' || m.state === 'fire') sunset(g, cam.W, cam.H);
    if (m.state === 'tension') {
      m.weed += dt * 0.16;
      tumbleweed(g, ((m.weed % 1.4) - 0.2) * cam.W, cam.H * 0.88, cam.H * 0.05, t);
    }
    drawHats(ctx, g, players);
    fx.draw(g, dt);
  };

  // Gerilim: rastgele bekleme, belki bir iki sahte komut, sonra gerçek "Ateş!"
  async function startTension() {
    if (m.state !== 'arm') return;
    m.state = 'tension';
    title.textContent = 'Bekleyin...';
    tip.textContent = '"Ateş!" deyince elini kaldır. Sahte komuta kanma!';
    sfx.western();
    announcer.say('cowboy-ready');
    const fakes = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
    const plan = [];
    let at = rand(2600, 3600);
    for (let k = 0; k < fakes; k++) {
      plan.push(['fake', at]);
      at += rand(1500, 2400);
    }
    plan.push(['fire', at + rand(400, 1800)]);
    const t0 = performance.now();
    const used = new Set();
    for (const [kind, ms] of plan) {
      await life.sleep(Math.max(0, ms - (performance.now() - t0)));
      if (m.state !== 'tension' || m.over) return;
      if (kind === 'fake') {
        let f = pick(FAKES);
        while (used.has(f[0]) && used.size < FAKES.length) f = pick(FAKES);
        used.add(f[0]);
        showCall(f[0], false);
        announcer.say(f[1]);
        sfx.boing();
        life.timeout(() => { if (call.classList.contains('fake')) call.className = 'cowboy-call'; }, 1100);
      } else {
        m.state = 'fire';
        m.sig = performance.now();
        showCall('Ateş!', true);
        announcer.say('cowboy-fire');
        sfx.bang();
        ctx.shake(5);
      }
    }
  }
}

function foul(ctx, i, scene, need) {
  const { m } = ctx;
  m.state = 'done';
  m.fouls[i]++;
  const call = scene.querySelector('[data-call]');
  call.textContent = `${nameOf(i)} Erken Çekti!`;
  call.className = 'cowboy-call on fake';
  sfx.buzzer(i);
  announcer.say('early');
  ctx.shoot(i, 'Erken Çekti!', { pad: 0.15, force: true });
  roundOver(ctx, 1 - i, null, need);
}

function resolve(ctx, scene, need) {
  const { m, cam, fx, life } = ctx;
  if (m.state !== 'fire') return;
  m.state = 'wait';
  // İkincinin kaldırması bir sonraki karede de gelebilir; kısa bekleyip karşılaştır
  life.timeout(() => {
    const [a, b] = m.drew;
    let w;
    if (a && b && Math.abs(a - b) < 35) w = -1;
    else if (a && (!b || a < b)) w = 0;
    else w = 1;
    m.state = 'done';
    if (w === -1) {
      const call = scene.querySelector('[data-call]');
      call.textContent = 'Aynı Anda! Tekrar';
      sfx.boing();
      life.timeout(() => { if (!m.over) duel(ctx); }, 1600);
      return;
    }
    const ms = m.drew[w] - m.sig;
    m.best[w] = m.best[w] == null ? ms : Math.min(m.best[w], ms);
    const p = cam.players[w];
    if (p) {
      for (const k of [15, 16]) {
        const q = p.lm[k];
        if (q.v > 0.3) fx.burst(q.x * cam.W, q.y * cam.H, { n: 18, colors: ['#ffcd3c', '#ff8a3d', '#fff'], power: 380, shape: 'star' });
      }
    }
    ctx.shoot(w, `${(ms / 1000).toFixed(2).replace('.', ',')} sn`, { pad: 0.15, force: true });
    roundOver(ctx, w, ms, need);
  }, 90);
}

function roundOver(ctx, winner, ms, need) {
  const { m, cam, fx, life, stage } = ctx;
  const loser = 1 - winner;
  m.fly[loser] = { t0: performance.now(), vx: cam.sideOf(winner) * -260, vy: -520, rot: cam.sideOf(winner) * -9 };
  sfx.bang();
  const lp = cam.players[loser];
  if (lp) {
    const n = lp.lm[0];
    fx.burst(n.x * cam.W, n.y * cam.H - 60, { n: 14, colors: ['#fff', '#ffcd3c'], power: 300, shape: 'star' });
    fx.text(n.x * cam.W, n.y * cam.H - 120, 'Vuruldu!', '#ff4f62', 22);
  }
  m.round++;
  const card = stage.scene.querySelector('.hud-card');
  if (card) {
    card.innerHTML = '';
    const h = document.createElement('h2');
    h.className = 't-big';
    h.innerHTML = `<span class="t-p${winner + 1}"></span> Vurdu!`;
    h.firstChild.textContent = nameOf(winner);
    const tip = document.createElement('p');
    tip.className = 'hud-tip';
    tip.textContent = ms == null ? 'Rakibi erken çektiği için.' : `Tepki: ${(ms / 1000).toFixed(2).replace('.', ',')} saniye`;
    card.append(h, tip);
  }
  ctx.score(winner, 1, card || null);
  const r = card ? card.getBoundingClientRect() : null;
  if (r) burst(r.left + r.width / 2, r.top + r.height / 2, { count: 36, power: 11, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
  life.timeout(() => {
    if (m.over) return;
    if (ctx.pts[0] >= need || ctx.pts[1] >= need || m.round >= Number(ctx.cfg.bestOf)) {
      const fmt = (v) => (v == null ? 'yok' : `${(v / 1000).toFixed(2).replace('.', ',')} sn`);
      ctx.finish({ stats: [0, 1].map((i) => html`<span>En hızlı <b>${fmt(m.best[i])}</b></span><span><b>${m.fouls[i]}</b> erken çekiş</span>`) });
    } else {
      duel(ctx);
    }
  }, 2800);
}
