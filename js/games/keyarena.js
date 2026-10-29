// Klavye düellolarının ortak iskeleti: aynı klavyede iki kişi. Solda oturan WASD ve Sol Shift,
// sağda oturan ok tuşları ve Sağ Shift kullanır. Oyun kumandası takılıysa o da çalışır.
// Lobi, geri sayım, tuval oyun alanı, duraklatma, final ekranı burada; her oyun yalnızca kuralını yazar.

import { html, Life } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { countdown } from '../ui/countdown.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { music } from '../audio/music.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML } from './common.js';
import { makeFx, tag, roundRect, PCOL } from './arena.js';

export { tag, roundRect, PCOL, makeFx };

const SEATS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], act: ['ShiftLeft', 'KeyF', 'KeyQ'], label: 'W A S D', actLabel: 'Sol Shift' },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], act: ['ShiftRight', 'Slash', 'Period'], label: 'Ok Tuşları', actLabel: 'Sağ Shift' },
];
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Period']);

export const keysHTML = (seat, { move = true, act = true } = {}) => html`<span class="kd-keys">${move ? html`<kbd>${SEATS[seat].label}</kbd>` : ''}${act ? html`<kbd>${SEATS[seat].actLabel}</kbd>` : ''}</span>`;

export function keyDuel(view, { game, navigate }, spec) {
  const life = new Life();
  view.innerHTML = `
    <section class="screen game game-key ${spec.cls}">
      <div class="key-wrap"><div class="key-card"><canvas class="key-canvas"></canvas></div></div>
      <div class="stage key-stage"></div>
    </section>`;
  const root = view.querySelector('.game-key');
  const card = root.querySelector('.key-card');
  const canvas = root.querySelector('.key-canvas');
  const g = canvas.getContext('2d');
  const stage = new Stage(root.querySelector('.key-stage'), life);
  const cfg = { seat: String(store.get('keySeat') ?? 0), ...(spec.cfg || {}) };
  const fx = makeFx();
  life.add(() => {
    scoreboard.hide();
    music.duck('keyduel', false);
  });

  // Tuval kartın boyutunda; çizim ekran pikseliyle yapılır
  let dpr = 1;
  const resize = () => {
    const r = card.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.W = r.width;
    ctx.H = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(card);
  life.add(() => ro.disconnect());

  // Tuş durumu ve basış olayları
  const held = new Set();
  const pressed = new Set();
  const onDown = (e) => {
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    if (ctx.m && !ctx.m.over && BLOCK.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (ctx.m && !ctx.m.over && ctx.live) togglePause();
      return;
    }
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
  };
  const onUp = (e) => held.delete(e.code);
  const onBlur = () => {
    held.clear();
    if (ctx.m && !ctx.m.over && ctx.live && !ctx.paused) togglePause();
  };
  life.on(window, 'keydown', onDown);
  life.on(window, 'keyup', onUp);
  life.on(window, 'blur', onBlur);

  // Oyun kumandası: ilk kumanda soldaki, ikincisi sağdaki oyuncu
  const padPrev = [false, false];
  const pad = (seat) => {
    const list = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const gp = list[seat];
    if (!gp) return null;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    const b = (k) => !!(gp.buttons[k] && gp.buttons[k].pressed);
    const act = b(0) || b(1) || b(2) || b(3) || b(5) || b(7);
    return {
      x: Math.abs(ax) > 0.25 ? ax : (b(15) ? 1 : 0) - (b(14) ? 1 : 0),
      y: Math.abs(ay) > 0.25 ? ay : (b(13) ? 1 : 0) - (b(12) ? 1 : 0),
      act,
    };
  };

  const any = (codes) => codes.some((c) => held.has(c));
  const tapped = (codes) => codes.some((c) => pressed.has(c));

  const ctx = {
    life, stage, cfg, fx, game, g, canvas, card, root,
    W: 0, H: 0,
    m: null,
    pts: [0, 0],
    live: false,
    paused: false,
    seatOf: (i) => (i === Number(cfg.seat) ? 0 : 1),
    playerAt: (seat) => (seat === 0 ? Number(cfg.seat) : 1 - Number(cfg.seat)),
    // Oyuncunun yön girdisi (-1..1) ve eylem tuşu
    input(i) {
      const s = SEATS[ctx.seatOf(i)];
      const p = pad(ctx.seatOf(i));
      let x = (any(s.right) ? 1 : 0) - (any(s.left) ? 1 : 0);
      let y = (any(s.down) ? 1 : 0) - (any(s.up) ? 1 : 0);
      let act = any(s.act);
      if (p) {
        if (!x) x = p.x;
        if (!y) y = p.y;
        act = act || p.act;
      }
      return { x, y, act };
    },
    // Bu karede yeni basılan tuş: 'act' | 'up' | 'down' | 'left' | 'right'
    hit(i, what = 'act') {
      const seat = ctx.seatOf(i);
      if (tapped(SEATS[seat][what])) return true;
      if (what === 'act') {
        const p = pad(seat);
        const was = padPrev[seat];
        return !!(p && p.act && !was);
      }
      return false;
    },
    seatKeys: (i) => SEATS[ctx.seatOf(i)],
    hud(tpl, actions = {}) {
      return stage.show(tpl, actions, { className: 'hud' });
    },
    // Oyun döngüsü: fn(dt, t). Duraklatılınca zaman akmaz
    loop(fn) {
      let last = performance.now();
      const stop = life.raf((t) => {
        const dt = Math.min(0.04, Math.max(0, (t - last) / 1000));
        last = t;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, ctx.W, ctx.H);
        try {
          fn(ctx.paused ? 0 : dt, t);
        } catch (err) {
          console.error(err);
          return false;
        }
        for (let s = 0; s < 2; s++) {
          const p = pad(s);
          padPrev[s] = !!(p && p.act);
        }
        pressed.clear();
        return !!ctx.m && !ctx.m.over;
      });
      return stop;
    },
    async countdown(scene, { final = 'Başla!', voice = null } = {}) {
      await countdown(scene, life, { final, voice });
      pressed.clear();
      ctx.live = true;
    },
    clock(el, secs, { onEnd } = {}) {
      let left = secs;
      let last = performance.now();
      let shown = secs;
      let stopped = false;
      const id = life.interval(() => {
        if (stopped) return;
        const now = performance.now();
        if (!ctx.paused) left = Math.max(0, left - (now - last) / 1000);
        last = now;
        const s = Math.ceil(left);
        if (s !== shown) {
          shown = s;
          el.textContent = String(s);
          scoreboard.setMid(`${s} sn`);
          if (s <= 5 && s > 0) {
            sfx.tick(5 - s);
            el.classList.add('hurry');
          }
        }
        if (left <= 0) {
          stopped = true;
          clearInterval(id);
          el.textContent = 'Süre!';
          scoreboard.setMid('Süre Doldu');
          if (onEnd) onEnd();
        }
      }, 100);
      return { stop: () => { stopped = true; clearInterval(id); }, left: () => left };
    },
    shake(px = 8) {
      card.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px * 0.6}px)` }, { transform: `translate(${px * 0.8}px,${-px * 0.6}px)` }, { transform: 'translate(0,0)' }], { duration: 300 });
    },
    // Tuval noktasından uçan puan rozeti
    score(i, pts, x = null, y = null, { quiet = false } = {}) {
      ctx.pts[i] += pts;
      let from = null;
      if (x != null) {
        from = {
          getBoundingClientRect: () => {
            const r = card.getBoundingClientRect();
            return { left: r.left + x, top: r.top + y, width: 0, height: 0 };
          },
        };
      }
      scoreboard.add(i, pts, from, { quiet });
    },
    finish({ stats = null, sub = '', labels = null } = {}) {
      if (!ctx.m || ctx.m.over) return;
      ctx.m.over = true;
      ctx.live = false;
      ctx.paused = false;
      music.duck('keyduel', false);
      fx.clear();
      const { html: podium, winner } = versusFinaleHTML(ctx.pts, { lines: { tie: spec.tie || 'Berabere!' }, labels });
      announcer.winner(winner);
      stage.show(html`
        ${podium}
        ${sub ? html`<p class="t-lead" data-in>${sub}</p>` : ''}
        ${stats ? html`<div class="pop-stats" data-in>${[0, 1].map((i) => html`
          <div class="pop-stat p${i}"><span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span>${stats[i]}</div>`)}</div>` : ''}
        <div class="row" data-in>
          <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
          <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
        </div>`, {
        home: () => navigate('#/'),
        again: () => begin(),
      }, { className: 'key-final' });
      root.classList.add('key-dim');
      celebrate();
    },
  };

  function togglePause() {
    if (ctx.paused) {
      ctx.paused = false;
      root.classList.remove('key-paused');
      const sheet = root.querySelector('.key-pause');
      if (sheet) sheet.remove();
      sfx.go();
      return;
    }
    ctx.paused = true;
    held.clear();
    root.classList.add('key-paused');
    sfx.soft();
    const box = document.createElement('div');
    box.className = 'key-pause';
    box.innerHTML = '<div class="kp-box"><b>Duraklatıldı</b><span>Devam etmek için Esc ya da P</span><div class="row"><button class="btn" type="button" data-kp="home">Oyundan Çık</button><button class="btn btn--primary" type="button" data-kp="go">Devam Et</button></div></div>';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kp]');
      if (!b) return;
      if (b.dataset.kp === 'go') togglePause();
      else navigate('#/');
    });
    root.append(box);
  }

  function lobby() {
    ctx.m = null;
    ctx.live = false;
    root.classList.add('key-dim');
    scoreboard.hide();
    const seatOpt = optHTML('Klavyede Solda Oturan', segHTML('seat', [['0', nameOf(0)], ['1', nameOf(1)]], cfg.seat), 'Solda oturan WASD ve Sol Shift, sağda oturan ok tuşları ve Sağ Shift kullanır.');
    const scene = stage.show(lobbyHTML({
      game,
      rules: spec.rules,
      options: html`${spec.options ? spec.options(cfg) : ''}${spec.noSeat ? '' : seatOpt}`,
      start: 'Başla',
      note: spec.note || 'Oyun kumandası takılıysa onunla da oynayabilirsiniz. Duraklatmak için Esc.',
    }), { start: () => begin() }, { className: 'has-lobby' });
    if (!spec.noSeat) {
      const s = bindSeg(scene.querySelector('[data-seg="seat"]'), { value: cfg.seat, onChange: (v) => { cfg.seat = v; store.set('keySeat', Number(v)); } });
      stage.own(() => s.destroy());
    }
    if (spec.bind) spec.bind(scene, cfg, stage);
  }

  function begin() {
    ctx.m = { over: false };
    ctx.pts = [0, 0];
    ctx.live = false;
    ctx.paused = false;
    fx.clear();
    held.clear();
    pressed.clear();
    root.classList.remove('key-dim');
    resize();
    scoreboard.show({ mode: 'versus', mid: spec.mid ? spec.mid(cfg) : '' });
    if (spec.voices) announcer.preload(spec.voices);
    if (spec.duck !== false) music.duck('keyduel', true);
    spec.play(ctx);
  }

  // Testler oyun durumunu buradan okur
  if (window.__sinemikoDuelHook) window.__sinemikoDuelHook(ctx);
  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!ctx.m && !ctx.m.over,
  };
}

// Oyun alanında iki oyuncunun hangi tuşları kullandığını gösteren kart
export function controlsHTML(ctx, { move = true, act = true, extra = '' } = {}) {
  return html`<div class="kd-legend">${[0, 1].map((i) => html`<span class="kd-who p${i}"><b class="${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</b>${keysHTML(ctx.seatOf(i), { move, act })}</span>`)}${extra}</div>`;
}
