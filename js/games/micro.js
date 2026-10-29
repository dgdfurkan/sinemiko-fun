// Mikro Kapışma: art arda gelen birkaç saniyelik minik oyunlar. Ekrana tek kelime çıkar: "Bas!", "Dur!", "Yakala!"...
// Herkes kendi tuşlarıyla oynar; her mini oyunu kazanan puanı alır. Oyunlar gittikçe hızlanır

import { html, rand, randInt, pick, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { keyDuel, controlsHTML, PCOL, tag, roundRect } from './keyarena.js';
import { inked, heartPath } from './arena.js';

const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const COLORS = [['Kırmızı', '#ff4f62'], ['Mavi', '#4fb6ff'], ['Yeşil', '#2ed67a'], ['Sarı', '#ffcd3c'], ['Mor', '#a98bff']];

// Her mini oyun: ad, açıklama, süre, kurulum, adım (girdi), çizim, kazananlar
const GAMES = [
  {
    id: 'react', name: 'Bas!', tip: 'Ekran yeşil olunca ilk sen bas. Erken basan kaybeder.', secs: 5,
    setup: (s) => { s.goAt = rand(1.2, 3.2); s.win = []; s.lose = []; },
    step: (s, ctx, t) => {
      for (const i of [0, 1]) {
        if (!ctx.hit(i, 'act') || s.win.length || s.lose.includes(i)) continue;
        if (t < s.goAt) {
          s.lose.push(i);
          sfx.buzz();
        } else s.win.push(i);
      }
      if (s.lose.length === 2) return true;
      if (s.lose.length === 1 && !s.win.length) {
        s.win = [1 - s.lose[0]];
        return true;
      }
      return s.win.length > 0;
    },
    draw: (s, g, W, H, t) => {
      const go = t >= s.goAt;
      roundRect(g, W * 0.3, H * 0.3, W * 0.4, H * 0.4, 30);
      inked(g, go ? '#2ed67a' : '#ff4f62', 5);
      tag(g, W / 2, H / 2, go ? 'ŞİMDİ!' : 'Bekle...', go ? '#2ed67a' : '#ff4f62', 34);
    },
    winners: (s) => s.win,
  },
  {
    id: 'mash', name: 'Bas Bas Bas!', tip: 'Shift tuşuna olabildiğince hızlı bas.', secs: 3.5,
    setup: (s) => { s.n = [0, 0]; },
    step: (s, ctx) => {
      for (const i of [0, 1]) if (ctx.hit(i, 'act')) { s.n[i]++; sfx.pop(0.5 + s.n[i] * 0.02); }
      return false;
    },
    draw: (s, g, W, H, t, ctx) => {
      for (const i of [0, 1]) {
        const x = ctx.seatX(i);
        const r = 40 + Math.min(120, s.n[i] * 4);
        g.beginPath();
        g.ellipse(x, H * 0.55, r * 0.85, r, 0, 0, Math.PI * 2);
        inked(g, PCOL[i], 4);
        tag(g, x, H * 0.55, String(s.n[i]), PCOL[i], 26);
      }
    },
    winners: (s) => (s.n[0] === s.n[1] ? [] : [s.n[0] > s.n[1] ? 0 : 1]),
  },
  {
    id: 'timer', name: 'Tam 3 Saniye!', tip: 'Sayaç kaybolunca kafandan say, tam 3 saniyede bas.', secs: 6.5,
    setup: (s) => { s.at = [null, null]; },
    step: (s, ctx, t) => {
      for (const i of [0, 1]) if (s.at[i] == null && t > 0.2 && ctx.hit(i, 'act')) { s.at[i] = t; sfx.lock(); }
      return s.at[0] != null && s.at[1] != null;
    },
    draw: (s, g, W, H, t, ctx) => {
      tag(g, W / 2, H * 0.4, t < 1.2 ? t.toFixed(1).replace('.', ',') : '?', '#7a5cff', 40);
      for (const i of [0, 1]) if (s.at[i] != null) tag(g, ctx.seatX(i), H * 0.7, s.done ? `${s.at[i].toFixed(2).replace('.', ',')} sn` : 'Bastı!', PCOL[i], 22);
    },
    winners: (s) => {
      const d = s.at.map((v) => (v == null ? 99 : Math.abs(v - 3)));
      if (d[0] === 99 && d[1] === 99) return [];
      return d[0] === d[1] ? [] : [d[0] < d[1] ? 0 : 1];
    },
  },
  {
    id: 'arrows', name: 'Diz Bakalım!', tip: 'Oklar ne gösteriyorsa sırayla bas. Yanlışta baştan.', secs: 6,
    setup: (s) => { s.seq = Array.from({ length: 5 }, () => pick(['up', 'down', 'left', 'right'])); s.k = [0, 0]; s.win = []; },
    step: (s, ctx) => {
      for (const i of [0, 1]) {
        for (const d of ['up', 'down', 'left', 'right']) {
          if (!ctx.hit(i, d) || s.k[i] >= s.seq.length) continue;
          if (d === s.seq[s.k[i]]) { s.k[i]++; sfx.pop(1); } else { s.k[i] = 0; sfx.buzz(); }
          if (s.k[i] >= s.seq.length && !s.win.length) s.win.push(i);
        }
      }
      return s.win.length > 0;
    },
    draw: (s, g, W, H, t, ctx) => {
      for (const i of [0, 1]) {
        const x0 = ctx.seatX(i) - 2 * 56;
        s.seq.forEach((d, k) => {
          const x = x0 + k * 56;
          roundRect(g, x - 24, H * 0.5 - 24, 48, 48, 12);
          inked(g, k < s.k[i] ? PCOL[i] : '#fffcf6', 3);
          g.font = '400 30px "Lilita One", sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = '#2a1636';
          g.fillText(ARROWS[d], x, H * 0.5 + 2);
        });
      }
    },
    winners: (s) => s.win,
  },
  {
    id: 'stroop', name: 'Rengini Seç!', tip: 'Yazının anlamına değil rengine bak. Sol ya da sağ okla seç.', secs: 5,
    setup: (s) => {
      const [a, b] = shuffle(COLORS.slice());
      s.word = a[0];
      s.ink = b;
      s.opts = shuffle([b, pick(COLORS.filter((c) => c !== b))]);
      s.pick = [null, null];
      s.win = [];
    },
    step: (s, ctx) => {
      for (const i of [0, 1]) {
        if (s.pick[i] != null) continue;
        const k = ctx.hit(i, 'left') ? 0 : ctx.hit(i, 'right') ? 1 : -1;
        if (k < 0) continue;
        s.pick[i] = k;
        if (s.opts[k] === s.ink && !s.win.length) s.win.push(i);
        else if (s.opts[k] !== s.ink) sfx.buzz();
      }
      return s.win.length > 0 || (s.pick[0] != null && s.pick[1] != null);
    },
    draw: (s, g, W, H, t, ctx) => {
      g.font = '400 70px "Lilita One", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = '#2a1636';
      g.strokeText(s.word.toUpperCase(), W / 2, H * 0.36);
      g.fillStyle = s.ink[1];
      g.fillText(s.word.toUpperCase(), W / 2, H * 0.36);
      for (const i of [0, 1]) {
        s.opts.forEach((o, k) => {
          const x = ctx.seatX(i) + (k ? 60 : -60);
          roundRect(g, x - 44, H * 0.62 - 26, 88, 52, 16);
          inked(g, s.pick[i] === k ? o[1] : '#fffcf6', 3);
          g.font = '400 17px "Lilita One", sans-serif';
          g.fillStyle = '#2a1636';
          g.fillText(`${k ? '→' : '←'} ${o[0]}`, x, H * 0.62 + 1);
        });
      }
    },
    winners: (s) => s.win,
  },
  {
    id: 'catch', name: 'Yakala!', tip: 'Sağ sol oklarla sepeti kaydır, düşen kalbi yakala.', secs: 4,
    setup: (s) => { s.b = [0.5, 0.5]; s.h = { x: rand(0.15, 0.85), y: -0.05 }; s.got = [false, false]; s.done2 = [false, false]; },
    step: (s, ctx, t, dt) => {
      for (const i of [0, 1]) {
        const inp = ctx.input(i);
        s.b[i] = Math.max(0.08, Math.min(0.92, s.b[i] + inp.x * 1.3 * dt));
      }
      s.h.y += dt * 0.42;
      if (s.h.y > 0.85 && !s.done2[0]) {
        for (const i of [0, 1]) {
          s.done2[i] = true;
          s.got[i] = Math.abs(s.b[i] - s.h.x) < 0.12;
          if (s.got[i]) sfx.ding();
        }
        return true;
      }
      return false;
    },
    draw: (s, g, W, H, t, ctx) => {
      for (const i of [0, 1]) {
        const x0 = ctx.seatX(i) - W / 4;
        heartPath(g, x0 + s.h.x * (W / 2), s.h.y * H, 22);
        inked(g, '#ff3d7f', 3);
        roundRect(g, x0 + s.b[i] * (W / 2) - 50, H * 0.85, 100, 26, 10);
        inked(g, PCOL[i], 3.5);
      }
      g.fillStyle = '#2a1636';
      g.fillRect(W / 2 - 2, 0, 4, H);
    },
    winners: (s) => [0, 1].filter((i) => s.got[i]),
  },
  {
    id: 'stop', name: 'Ortada Dur!', tip: 'Gidip gelen işaret tam ortaya gelince Shift.', secs: 5,
    setup: (s) => { s.at = [null, null]; s.sp = rand(2.2, 3); },
    step: (s, ctx, t) => {
      for (const i of [0, 1]) if (s.at[i] == null && ctx.hit(i, 'act')) { s.at[i] = Math.sin(t * s.sp); sfx.lock(); }
      return s.at[0] != null && s.at[1] != null;
    },
    draw: (s, g, W, H, t, ctx) => {
      for (const i of [0, 1]) {
        const cx = ctx.seatX(i);
        const w = W * 0.36;
        roundRect(g, cx - w / 2, H * 0.5 - 14, w, 28, 14);
        inked(g, '#fffcf6', 3);
        g.fillStyle = '#2ed67a';
        g.fillRect(cx - 8, H * 0.5 - 14, 16, 28);
        const v = s.at[i] != null ? s.at[i] : Math.sin(t * s.sp);
        g.beginPath();
        g.arc(cx + v * (w / 2 - 14), H * 0.5, 18, 0, Math.PI * 2);
        inked(g, PCOL[i], 3.5);
      }
    },
    winners: (s) => {
      const d = s.at.map((v) => (v == null ? 9 : Math.abs(v)));
      if (d[0] === 9 && d[1] === 9) return [];
      return Math.abs(d[0] - d[1]) < 0.01 ? [0, 1] : [d[0] < d[1] ? 0 : 1];
    },
  },
  {
    id: 'bigger', name: 'Hangisi Büyük?', tip: 'Büyük sayı soldaysa sol, sağdaysa sağ ok. İlk doğru bilen alır.', secs: 4,
    setup: (s) => {
      const a = randInt(12, 98);
      let b = randInt(12, 98);
      if (b === a) b = a + 1;
      s.n = [a, b];
      s.ans = a > b ? 0 : 1;
      s.pick = [null, null];
      s.win = [];
    },
    step: (s, ctx) => {
      for (const i of [0, 1]) {
        if (s.pick[i] != null) continue;
        const k = ctx.hit(i, 'left') ? 0 : ctx.hit(i, 'right') ? 1 : -1;
        if (k < 0) continue;
        s.pick[i] = k;
        if (k === s.ans && !s.win.length) s.win.push(i);
        else if (k !== s.ans) sfx.buzz();
      }
      return s.win.length > 0 || (s.pick[0] != null && s.pick[1] != null);
    },
    draw: (s, g, W, H) => {
      s.n.forEach((v, k) => {
        const x = W / 2 + (k ? 1 : -1) * W * 0.16;
        roundRect(g, x - 80, H * 0.5 - 60, 160, 120, 26);
        inked(g, '#fffcf6', 4);
        g.font = '400 64px "Lilita One", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#2a1636';
        g.fillText(String(v), x, H * 0.5 + 4);
      });
    },
    winners: (s) => s.win,
  },
];

export function mount(view, opts) {
  return keyDuel(view, opts, {
    cls: 'game-micro',
    cfg: { count: '12' },
    rules: [
      'Art arda birkaç saniyelik minik oyunlar gelir. Ekrandaki kısa komuta bak ve hemen oyna.',
      'Herkes kendi tuşlarıyla: solda oturan WASD ve Sol Shift, sağda oturan ok tuşları ve Sağ Shift.',
      'Her mini oyunu kazanan 1 puan alır. Oyunlar gittikçe hızlanır!',
    ],
    options: (cfg) => optHTML('Kaç Mini Oyun', segHTML('count', [['8', '8'], ['12', '12'], ['16', '16']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    voices: ['cd-3', 'cd-2', 'cd-1', 'letsgo', 'point'],
    tie: 'Berabere! İkiniz de Şimşek',
    mid: (cfg) => `1 / ${cfg.count}`,
    play,
  });
}

async function play(ctx) {
  const { m, cfg } = ctx;
  m.total = Number(cfg.count);
  const list = [];
  while (list.length < m.total) {
    const s = shuffle(GAMES.slice());
    if (list.length && s[0] === list[list.length - 1]) s.push(s.shift());
    list.push(...s);
  }
  m.list = list.slice(0, m.total);
  m.k = -1;
  m.cur = null;
  m.wins = [0, 0];
  ctx.seatX = (i) => (ctx.seatOf(i) === 0 ? ctx.W * 0.25 : ctx.W * 0.75);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${controlsHTML(ctx)}</div>
    <div class="hud-bottom"><p class="mc-tip" data-tip></p></div>`);
  m.tipEl = scene.querySelector('[data-tip]');
  ctx.loop((dt, t) => draw(ctx, dt, t));
  await ctx.countdown(scene, { final: 'Hadi!', voice: 'letsgo' });
  if (!ctx.life.alive || m.over) return;
  const top = scene.querySelector('.hud-top');
  if (top) top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  next(ctx);
}

function next(ctx) {
  const { m } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.total) {
    sfx.whistle();
    ctx.life.timeout(() => ctx.finish({ stats: [0, 1].map((i) => html`<span><b>${m.wins[i]}</b> mini oyun</span>`) }), 600);
    return;
  }
  const game = m.list[m.k];
  // Her oyunda biraz daha hızlı
  const speed = 1 + m.k * 0.03;
  m.cur = { game, s: { speed }, t: 0, phase: 'intro', introLeft: 1.1 / speed, left: game.secs / speed };
  game.setup(m.cur.s);
  m.tipEl.textContent = game.tip;
  scoreboard.setMid(`${m.k + 1} / ${m.total}`);
  sfx.whoosh();
}

function draw(ctx, dt, t) {
  const { m, g, W, H, fx } = ctx;
  g.fillStyle = '#fff6ea';
  g.fillRect(0, 0, W, H);
  const c = m.cur;
  if (!c) return;
  if (c.phase === 'intro') {
    c.introLeft -= dt;
    const k = Math.min(1, (1.1 - c.introLeft) * 4);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(0.5 + k * 0.5, 0.5 + k * 0.5);
    tag(g, 0, 0, c.game.name, '#7a5cff', 54);
    g.restore();
    if (c.introLeft <= 0) {
      c.phase = 'play';
      sfx.go();
    }
    return;
  }
  if (c.phase === 'play' && dt > 0) {
    c.t += dt * c.s.speed;
    c.left -= dt;
    const done = c.game.step(c.s, ctx, c.t, dt * c.s.speed);
    if (done || c.left <= 0) resolve(ctx);
  }
  c.game.draw(c.s, g, W, H, c.t, ctx);
  // Süre çubuğu
  if (c.phase === 'play') {
    const k = Math.max(0, c.left / (c.game.secs / c.s.speed));
    g.fillStyle = '#2a163622';
    g.fillRect(0, H - 10, W, 10);
    g.fillStyle = k < 0.3 ? '#ff4f62' : '#7a5cff';
    g.fillRect(0, H - 10, W * k, 10);
  }
  if (c.phase === 'result') {
    for (const i of [0, 1]) {
      const won = c.wins.includes(i);
      tag(g, ctx.seatX(i), H * 0.18, won ? `${nameOf(i)} +1` : nameOf(i), won ? PCOL[i] : '#a99cb3', won ? 26 : 18);
    }
  }
  fx.draw(g, dt);
}

function resolve(ctx) {
  const { m, fx, W, H } = ctx;
  const c = m.cur;
  c.phase = 'result';
  c.s.done = true;
  c.wins = c.game.winners(c.s);
  for (const i of c.wins) {
    m.wins[i]++;
    ctx.score(i, 1, ctx.seatX(i), H * 0.2);
    fx.burst(ctx.seatX(i), H * 0.25, { n: 24, colors: [PCOL[i], '#ffcd3c', '#fff'], power: 420, shape: 'star' });
  }
  if (c.wins.length) {
    sfx.success();
    if (c.wins.length === 1) announcer.react('point');
  } else {
    sfx.boing();
    fx.text(W / 2, H * 0.25, 'Kimse alamadı!', '#a99cb3', 26);
  }
  ctx.life.timeout(() => next(ctx), 1500);
}
