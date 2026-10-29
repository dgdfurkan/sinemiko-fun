// Uçan Kahramanlar: pelerinli bloblar gökyüzünde uçuyor. Gövdeni sağa sola yatırarak yön ver,
// kollarını kanat gibi iki yana açınca hızlanırsın. Yıldızları topla, şimşekli bulutlardan kaç

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, inked, starPath, PCOL, tag, missingText, hideTop } from './arena.js';

const HERO_Y = 0.74;

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-hero',
    kind: 'pose',
    cfg: { secs: '45' },
    rules: [
      'Herkesin kendi gökyüzünde pelerinli bir kahramanı var. Gövdeni sola ya da sağa yatır: o yöne uçar.',
      'Kollarını kanat gibi iki yana aç: hızlanırsın, yıldızlar iki katı puan verir.',
      html`Yıldız <b>+1</b>, altın halka <b>+3</b>. Şimşekli buluta çarparsan <b>-2</b> ve bir an sersemlersin.`,
    ],
    options: (cfg) => optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="secs"]'), { value: cfg.secs, onChange: (v) => { cfg.secs = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Pelerinler Hazır',
    waitTip: 'Yan yana oturun, başınız, omuzlarınız ve kollarınız görünsün.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-uc', 'gold', 'crash', 'timeup'],
    tie: 'Berabere! İki Kahraman',
    albumTitle: 'Uçan Kahramanlar',
    mid: (cfg) => `${cfg.secs} sn`,
    play,
  });
}

function leanOf(p) {
  const lm = p.lm;
  const ar = p.ar || 16 / 9;
  const sw = Math.hypot((lm[11].x - lm[12].x) * ar, lm[11].y - lm[12].y) || 0.1;
  const mx = (lm[11].x + lm[12].x) / 2;
  return ((lm[0].x - mx) * ar) / sw * 0.8 - (lm[11].y - lm[12].y) / sw;
}

function wingsOf(p) {
  const lm = p.lm;
  const ar = p.ar || 16 / 9;
  const sw = Math.hypot((lm[11].x - lm[12].x) * ar, lm[11].y - lm[12].y) || 0.1;
  if (lm[15].v < 0.3 || lm[16].v < 0.3) return false;
  const span = Math.abs(lm[15].x - lm[16].x) * ar / sw;
  const high = Math.max(lm[15].y, lm[16].y) < Math.max(lm[11].y, lm[12].y) + 0.7 * sw;
  return span > 2.3 && high;
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.hero = [0, 1].map(() => ({ x: 0.5, tx: 0.5, boost: false, stun: 0, stars: 0, rings: 0, hitCloud: 0, cape: 0 }));
  m.base = [0, 0];
  m.things = [];
  m.scroll = 0;
  m.next = 0.3;
  m.running = false;
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card"><h2 class="t-big">Pelerinler Hazır</h2><p class="hud-tip">Gövdeni yatır: yön ver. Kollarını aç: hızlan.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${cfg.secs}</b> sn</span></div>`);
  const warn = scene.querySelector('[data-warn]');
  const clockEl = scene.querySelector('[data-clock]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p || p.lm[11].v < 0.4 || p.lm[12].v < 0.4) return;
      const h = m.hero[i];
      h.tx = clamp(0.5 + (leanOf(p) - m.base[i]) * 1.15, 0.08, 0.92);
      h.boost = wingsOf(p);
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, dt, t);
  const base = await ctx.countdown(scene, { final: 'Uç!', voice: 'go-uc', measure: (p) => ({ l: leanOf(p) }) });
  if (!ctx.life.alive || m.over) return;
  m.base = base.map((b) => clamp(b ? b.l : 0, -0.4, 0.4));
  hideTop(scene);
  m.running = true;
  ctx.clock(clockEl, Number(cfg.secs), { onEnd: () => end(ctx) });
}

// Engeller iki şeritte aynı yerde: "u" şerit içindeki konum (0-1), "at" kaydırma mesafesi
function spawn(m) {
  const r = Math.random();
  const kind = r < 0.55 ? 'star' : r < 0.68 ? 'ring' : 'cloud';
  m.things.push({ kind, u: rand(0.12, 0.88), at: m.scroll + 1.15, got: [false, false], wob: rand(0, 6) });
}

function draw(ctx, g, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  const W = cam.W;
  const H = cam.H;
  const lw = W / 2;
  if (m.running && dt > 0) {
    m.scroll += 0.42 * dt;
    if (m.scroll >= m.next) {
      spawn(m);
      m.next = m.scroll + rand(0.16, 0.3);
    }
  }
  for (const i of [0, 1]) {
    const x0 = ctx.half(i)[0] * W;
    const h = m.hero[i];
    if (m.running && dt > 0) {
      const sp = h.stun > 0 ? 0.6 : 3.2;
      h.x += (h.tx - h.x) * Math.min(1, dt * sp);
      h.stun = Math.max(0, h.stun - dt);
      h.cape += dt * (h.boost ? 18 : 10);
      // Hızlanınca kendi şeridi ileri akar; kazanç iki katı
      for (const o of m.things) {
        if (o.got[i]) continue;
        const dy = o.at - m.scroll - (1 - HERO_Y);
        if (Math.abs(dy) < 0.05 && Math.abs(o.u - h.x) < 0.11) {
          o.got[i] = true;
          collect(ctx, i, o, x0 + o.u * lw, HERO_Y * H);
        }
      }
    }
    g.save();
    g.beginPath();
    g.rect(x0 + 4, 0, lw - 8, H);
    g.clip();
    g.fillStyle = i === 0 ? '#9fd8ff33' : '#ffc6dd33';
    g.fillRect(x0, 0, lw, H);
    // Hız çizgileri
    g.strokeStyle = '#ffffff66';
    g.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const yy = ((k / 6 + m.scroll * (h.boost ? 2.4 : 1.4)) % 1) * H;
      const xx = x0 + ((k * 0.37 + 0.1) % 1) * lw;
      g.beginPath();
      g.moveTo(xx, yy);
      g.lineTo(xx, yy + 40);
      g.stroke();
    }
    for (const o of m.things) {
      if (o.got[i] && o.kind !== 'cloud') continue;
      const y = (1 - (o.at - m.scroll)) * H;
      if (y < -60 || y > H + 60) continue;
      const x = x0 + o.u * lw;
      const s = H * 0.04;
      if (o.kind === 'star') {
        starPath(g, x, y, s * (1 + Math.sin(t / 150 + o.wob) * 0.1));
        inked(g, '#ffcd3c', 3);
      } else if (o.kind === 'ring') {
        g.beginPath();
        g.ellipse(x, y, s * 1.5, s * 0.8, 0, 0, Math.PI * 2);
        g.lineWidth = 10;
        g.strokeStyle = '#2a1636';
        g.stroke();
        g.lineWidth = 6;
        g.strokeStyle = '#ffcd3c';
        g.stroke();
      } else {
        g.globalAlpha = o.got[i] ? 0.4 : 1;
        for (const [dx, dy, r] of [[-1, 0.2, 0.9], [0, -0.2, 1.15], [1, 0.2, 0.9]]) {
          g.beginPath();
          g.arc(x + dx * s * 1.1, y + dy * s, s * r, 0, Math.PI * 2);
          inked(g, '#7d7a92', 3);
        }
        g.beginPath();
        g.moveTo(x, y + s * 0.6);
        g.lineTo(x - s * 0.35, y + s * 1.4);
        g.lineTo(x + s * 0.1, y + s * 1.3);
        g.lineTo(x - s * 0.2, y + s * 2.1);
        g.lineWidth = 4;
        g.strokeStyle = '#ffcd3c';
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    // Kahraman
    const hx = x0 + h.x * lw;
    const hy = HERO_Y * H + Math.sin(t / 200 + i) * 4;
    const s = H * 0.045;
    const blink = h.stun > 0 && Math.sin(t / 50) > 0;
    if (!blink) {
      g.beginPath();
      g.moveTo(hx - s * 0.6, hy - s * 0.2);
      g.quadraticCurveTo(hx - s * 1.2 + Math.sin(h.cape) * 6, hy + s * 1.6, hx, hy + s * 1.9 + Math.sin(h.cape * 1.3) * 5);
      g.quadraticCurveTo(hx + s * 1.2 + Math.sin(h.cape) * 6, hy + s * 1.6, hx + s * 0.6, hy - s * 0.2);
      g.closePath();
      inked(g, '#ff4f62', 3);
      g.beginPath();
      g.arc(hx, hy, s, 0, Math.PI * 2);
      inked(g, PCOL[i], 3.5);
      g.fillStyle = '#2a1636';
      g.fillRect(hx - s * 0.75, hy - s * 0.35, s * 1.5, s * 0.32);
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(hx - s * 0.35, hy - s * 0.2, s * 0.13, 0, Math.PI * 2);
      g.arc(hx + s * 0.35, hy - s * 0.2, s * 0.13, 0, Math.PI * 2);
      g.fill();
      if (h.boost) {
        g.globalAlpha = 0.6;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(hx - s * 0.5 + k * s * 0.5, hy + s * 2.2);
          g.lineTo(hx - s * 0.5 + k * s * 0.5, hy + s * 3.2);
          g.lineWidth = 3;
          g.strokeStyle = '#ffcd3c';
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
    g.restore();
    tag(g, hx, hy - s * 2, h.boost ? `${nameOf(i)} · Hız!` : nameOf(i), PCOL[i], 14);
  }
  // Orta çizgi
  g.fillStyle = '#2a1636';
  g.fillRect(W / 2 - 2, 0, 4, H);
  m.things = m.things.filter((o) => o.at > m.scroll - 0.2);
  fx.draw(g, dt);
}

function collect(ctx, i, o, x, y) {
  const { m, fx } = ctx;
  const h = m.hero[i];
  const mult = h.boost ? 2 : 1;
  if (o.kind === 'cloud') {
    if (h.stun > 0) return;
    h.stun = 1;
    h.hitCloud++;
    sfx.zap();
    announcer.react('crash');
    ctx.shake(6);
    fx.text(x, y - 50, 'Çat! -2', '#ff4f62', 22);
    if (ctx.pts[i] > 0) ctx.score(i, -Math.min(2, ctx.pts[i]), x / ctx.cam.W, y / ctx.cam.H, { quiet: true });
    return;
  }
  const pts = (o.kind === 'ring' ? 3 : 1) * mult;
  if (o.kind === 'ring') {
    h.rings++;
    sfx.sparkle();
    announcer.react('gold');
  } else {
    h.stars++;
    sfx.ding();
  }
  fx.burst(x, y, { n: o.kind === 'ring' ? 22 : 12, colors: ['#ffcd3c', '#fff', PCOL[i]], shape: 'star', power: 300 });
  fx.text(x, y - 50, `+${pts}`, PCOL[i], 20);
  ctx.score(i, pts, x / ctx.cam.W, y / ctx.cam.H, { quiet: true });
}

function end(ctx) {
  const { m } = ctx;
  if (!m.running) return;
  m.running = false;
  sfx.whistle();
  announcer.say('timeup');
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.hero[i].stars} yıldız`, { pad: 0.2, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.hero[i].stars}</b> yıldız</span><span><b>${m.hero[i].rings}</b> altın halka</span><span><b>${m.hero[i].hitCloud}</b> bulut çarpması</span>`),
    });
  }, 1200);
}
