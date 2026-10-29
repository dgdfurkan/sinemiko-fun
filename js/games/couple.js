// Kalp Kuralım: rekabet yok, takım var. Ekrana ikinizin birlikte yapacağı poz gelir:
// çak bir beşlik, kafa kafaya, kollarla kocaman kalp... Ne kadar hızlı yaparsanız o kadar puan, her poz albüme

import { html, shuffle } from '../lib/dom.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, missingText } from './arena.js';
import { drawSkeleton, ring } from './cam.js';
import { body, poseById } from '../vision/poses.js';

const POSE_SEC = 9;
const HOLD = 0.7;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inner = (b, toRight) => {
  const ws = [b.lw, b.rw].filter((w) => w.v > 0.35);
  if (!ws.length) return null;
  return ws.reduce((a, w) => ((toRight ? w.x > a.x : w.x < a.x) ? w : a));
};

// L soldaki, R sağdaki kişinin vücudu (poses.body)
const COUPLE = [
  {
    id: 'five', name: 'Çak Bir Beşlik', emoji: '🙌', tip: 'İç ellerinizi kaldırıp ortada birleştirin.',
    test: (L, R, sw) => {
      const a = inner(L, true);
      const b = inner(R, false);
      return a && b && dist(a, b) < 0.75 * sw && a.y < L.my && b.y < R.my;
    },
  },
  {
    id: 'heads', name: 'Kafa Kafaya', emoji: '💞', tip: 'Başlarınızı birbirine yaslayın.',
    test: (L, R, sw) => dist(L.n, R.n) < 0.95 * sw,
  },
  {
    id: 'bigheart', name: 'Kocaman Kalp', emoji: '❤️', tip: 'İç kollarınızı başınızın üstünden uzatıp ellerinizi birleştirin.',
    test: (L, R, sw) => {
      const a = inner(L, true);
      const b = inner(R, false);
      return a && b && dist(a, b) < 0.9 * sw && a.y < L.n.y - 0.15 * sw && b.y < R.n.y - 0.15 * sw;
    },
  },
  {
    id: 'up', name: 'Hep Birlikte Eller Havaya', emoji: '🙆', tip: 'İkiniz de iki elinizi havaya kaldırın.',
    test: (L, R) => poseById('up').test(L, 1) && poseById('up').test(R, -1),
  },
  {
    id: 'point', name: 'Birbirinizi Gösterin', emoji: '👉👈', tip: 'Kolunuzu uzatıp partnerinizi gösterin.',
    test: (L, R) => poseById('point').test(L, 1) && poseById('point').test(R, -1),
  },
  {
    id: 'vee', name: 'Dış Kollar Yukarı', emoji: '✨', tip: 'Soldaki sol kolunu, sağdaki sağ kolunu kaldırsın: kocaman bir V.',
    test: (L, R) => poseById('left').test(L, 1) && poseById('right').test(R, -1),
  },
  {
    id: 'muscle', name: 'Güçlü Çift', emoji: '💪', tip: 'İkiniz de pazınızı gösterin.',
    test: (L, R) => poseById('muscle').test(L, 1) && poseById('muscle').test(R, -1),
  },
  {
    id: 'think', name: 'Düşünür Çift', emoji: '🤔', tip: 'İkiniz de elinizi çenenize koyun.',
    test: (L, R) => poseById('think').test(L, 1) && poseById('think').test(R, -1),
  },
  {
    id: 'hide', name: 'Ce-ee!', emoji: '🙈', tip: 'İkiniz de yüzünüzü ellerinizle kapatın.',
    test: (L, R) => poseById('hide').test(L, 1) && poseById('hide').test(R, -1),
  },
  {
    id: 'cross', name: 'Kollar Çapraz', emoji: '🙅', tip: 'İkiniz de kollarınızı göğsünüzde çaprazlayın.',
    test: (L, R) => poseById('cross').test(L, 1) && poseById('cross').test(R, -1),
  },
];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-couple',
    kind: 'pose',
    cfg: { count: '8' },
    rules: [
      'Bu sefer rakip değil takımsınız. Ekrana ikinizin birlikte yapacağı bir poz gelir.',
      'Pozu birlikte yapıp bir an tutun. Ne kadar hızlı yaparsanız o kadar puan.',
      'Her başarılı poz albüme girer. Finalde en tatlı çift fotoğraflarınız çıkar.',
    ],
    options: (cfg) => optHTML('Poz Sayısı', segHTML('count', [['5', '5'], ['8', '8'], ['10', '10']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Takım Hazır',
    waitTip: 'Yan yana oturun; başınız, omuzlarınız ve kollarınız görünsün.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-takim', 'yay-1', 'yay-2', 'yay-3'],
    tie: 'Harika Takım!',
    coop: true,
    albumTitle: 'Kalp Kuralım',
    mid: () => 'Takım',
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.list = shuffle(COUPLE.slice()).slice(0, Number(cfg.count));
  m.k = -1;
  m.hold = 0;
  m.phase = 'wait';
  m.done = 0;
  m.times = [];
  const scene = ctx.hud(html`
    <div class="hud-top" data-in><div class="hud-card cp-card"><span class="cp-emoji" data-emoji>💞</span><div><h2 class="t-big" data-name>Takım Hazır</h2><p class="hud-tip" data-tip>Birlikte poz verin.</p></div></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${POSE_SEC}</b> sn</span></div>`);
  m.nameEl = scene.querySelector('[data-name]');
  m.tipEl = scene.querySelector('[data-tip]');
  m.emojiEl = scene.querySelector('[data-emoji]');
  m.clockEl = scene.querySelector('[data-clock]');
  const warn = scene.querySelector('[data-warn]');
  let last = 0;
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    const dt = last ? Math.min(0.15, (now - last) / 1000) : 0;
    last = now;
    if (m.phase !== 'pose') return;
    const pl = players[cam.leftIs];
    const pr = players[1 - cam.leftIs];
    let ok = false;
    if (pl && pr) {
      const L = body(pl.lm, pl.ar);
      const R = body(pr.lm, pr.ar);
      if (L && R) ok = !!m.list[m.k].test(L, R, (L.sw + R.sw) / 2);
    }
    m.ok = ok;
    m.hold = ok ? m.hold + dt : Math.max(0, m.hold - dt * 2);
    if (m.hold >= HOLD) success(ctx);
  };
  cam.draw = (g, players, dt) => draw(ctx, g, players, dt);
  await ctx.countdown(scene, { final: 'Takım!', voice: 'go-takim' });
  if (!ctx.life.alive || m.over) return;
  next(ctx);
}

function next(ctx) {
  const { m } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.list.length) {
    end(ctx);
    return;
  }
  const pose = m.list[m.k];
  m.hold = 0;
  m.phase = 'pose';
  m.t0 = ctx.now();
  m.nameEl.textContent = pose.name;
  m.tipEl.textContent = pose.tip;
  m.emojiEl.textContent = pose.emoji;
  m.emojiEl.animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.2) rotate(8deg)' }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  scoreboard.setMid(`Poz ${m.k + 1} / ${m.list.length}`);
  sfx.flip();
  m.clock = ctx.clock(m.clockEl, POSE_SEC, { onEnd: () => fail(ctx) });
}

function success(ctx) {
  const { m, cam, fx } = ctx;
  if (m.phase !== 'pose') return;
  m.phase = 'done';
  m.clock.stop();
  const secs = (ctx.now() - m.t0) / 1000;
  m.times.push(secs);
  m.done++;
  const pts = secs < 3 ? 3 : secs < 6 ? 2 : 1;
  [0, 1].forEach((i) => ctx.score(i, pts, 0.5, 0.4, { quiet: i === 1 }));
  sfx.success();
  announcer.cheer();
  cam.flash();
  // İkisini birden içine alan kare fotoğraf
  const a = cam.players[0];
  const b = cam.players[1];
  if (a && b) {
    const x0 = Math.min(a.box.x, b.box.x);
    const y0 = Math.min(a.box.y, b.box.y);
    const x1 = Math.max(a.box.x + a.box.w, b.box.x + b.box.w);
    const y1 = Math.max(a.box.y + a.box.h, b.box.y + b.box.h);
    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    const canvas = cam.grab(box, 0.05, 960);
    if (canvas) {
      ctx.album.push({ canvas, img: '', cap: m.list[m.k].name, by: 'İkimiz', color: '#ff5fa2' });
      if (ctx.album.length > 12) ctx.album.shift();
    }
  }
  fx.burst(cam.W / 2, cam.H * 0.4, { n: 40, colors: ['#ff5fa2', '#ffcd3c', '#fff', '#4fb6ff'], power: 560, shape: 'heart' });
  fx.text(cam.W / 2, cam.H * 0.32, pts === 3 ? 'Mükemmel Uyum! +3' : pts === 2 ? 'Süper! +2' : 'Oldu! +1', '#ff5fa2', 30);
  ctx.life.timeout(() => next(ctx), 1800);
}

function fail(ctx) {
  const { m, cam, fx } = ctx;
  if (m.phase !== 'pose') return;
  m.phase = 'done';
  sfx.boing();
  fx.text(cam.W / 2, cam.H * 0.35, 'Bu sefer olmadı', '#a99cb3', 26);
  ctx.life.timeout(() => next(ctx), 1500);
}

function draw(ctx, g, players, dt) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  players.forEach((p, i) => { if (p) drawSkeleton(g, cam, p, i, { glow: m.ok ? 0.8 : 0 }); });
  if (m.phase === 'pose') ring(g, cam.W / 2, cam.H * 0.52, 46, m.hold / HOLD, m.ok ? '#2ed6a0' : '#ff5fa2');
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.phase = 'end';
  sfx.whistle();
  const avg = m.times.length ? m.times.reduce((s, x) => s + x, 0) / m.times.length : 0;
  ctx.life.timeout(() => {
    ctx.finish({
      sub: `${m.list.length} pozun ${m.done} tanesini birlikte yaptınız${m.done ? `, ortalama ${avg.toFixed(1).replace('.', ',')} saniyede` : ''}.`,
    });
  }, 600);
}
