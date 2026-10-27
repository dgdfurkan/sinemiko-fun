// İlk açılış filmi, yaklaşık 46 saniye: gece, gün doğumu ve buluşma, oyun montajı, gün batımı ve havai fişekler, logo.
// Yalnızca transform ve opacity canlandırılır; sahnesi biten katman gizlenir, ekran kartında boşuna katman kalmaz.
// Görüntü performance.now ile, ses AudioContext ile ilerler; sekme gizlenince ikisi birlikte durur, dönünce kaldığı yerden sürer.

import { html, toHTML } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar, setBlob } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { logoHTML } from '../screens/home.js';
import { artFor } from '../screens/art.js';
import { gameById } from '../games/registry.js';
import { cannons } from '../fx/confetti.js';
import { getCtx } from '../audio/engine.js';
import { createScore, LENGTH } from './score.js';

const W = 1600;
const H = 900;
const SPRING = 'cubic-bezier(.34, 1.56, .64, 1)';
const OUT = 'cubic-bezier(.22, 1, .36, 1)';
const INOUT = 'cubic-bezier(.65, 0, .35, 1)';
const IN = 'cubic-bezier(.55, 0, .8, .2)';

// Karakter kutusu 190 birim genişlikte; ayak çizgisi kutunun tepesinden 182 birim aşağıda
const CW = 190;
const FOOT = 182;
const F_HOME = [380, 612];
const S_HOME = [1220, 612];
const F_MEET = [718, 662];
const S_MEET = [882, 662];
const F_LOGO = [300, 655];
const S_LOGO = [1300, 655];
const COLORS = ['#ff5fa2', '#ffcd3c', '#4fb6ff', '#2ed6a0', '#a98bff', '#ff8a3d'];
const MONTAGE = [
  ['reverse', 270, 325, -6], ['hum', 620, 308, 4], ['pose', 980, 325, -3], ['booth', 1330, 312, 5],
  ['popper', 270, 622, 4], ['bomb', 620, 636, -5], ['draw', 980, 622, 3], ['wavelength', 1330, 636, -4],
];

const HILLS_BACK = 'M-60 600 C 180 520, 420 545, 640 590 S 1080 515, 1300 555 S 1560 600, 1680 575 L1680 2400 L-60 2400 Z';
const HILLS_FRONT = 'M-60 700 C 110 650, 250 606, 380 607 C 520 609, 630 668, 800 670 C 970 668, 1080 609, 1220 607 C 1350 606, 1490 650, 1660 700 L1660 2400 L-60 2400 Z';
const HEART = 'M50 88 C20 66 4 50 4 30 C4 14 16 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C84 4 96 14 96 30 C96 50 80 66 50 88 Z';
const CLOUD = 'M30 70 C8 70 4 46 22 40 C20 18 48 10 60 26 C68 8 100 8 106 30 C126 26 140 44 130 58 C140 70 128 80 116 76 L34 76 C32 74 31 72 30 70 Z';

function charHTML(i, [x, y]) {
  return html`
    <div class="in-char in-char-${i}" style="left:${x - CW / 2}px;top:${y - FOOT}px">
      <div class="in-clip"><div class="in-body">${avatar(i, { mood: 'happy', pose: 'rest' })}</div></div>
    </div>`;
}

function buildDOM() {
  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Sinemiko Fun açılış filmi');
  const flies = Array.from({ length: 14 }, (_, i) => {
    const x = 80 + ((i * 113) % 1440);
    const y = 430 + ((i * 71) % 330);
    return html`<i class="in-fly" style="left:${x}px;top:${y}px"></i>`;
  });
  const cards = MONTAGE.map(([id, x, y]) => {
    const g = gameById(id);
    return html`
      <div class="in-card" style="left:${x - 125}px;top:${y - 130}px">
        <div class="in-card-in" style="--gc:${g.card}">
          <span class="in-card-art">${artFor(id)}</span>
          <span class="in-card-name">${g.title}</span>
        </div>
      </div>`;
  });
  root.innerHTML = toHTML(html`
    <div class="in-view">
      <div class="in-zoom">
        <div class="in-world">
          <div class="in-sky in-sky-night"></div>
          <div class="in-sky in-sky-dusk off"></div>
          <div class="in-sky in-sky-dawn off"></div>
          <div class="in-sky in-sky-day off"></div>
          <canvas class="in-stars in-stars-a"></canvas>
          <canvas class="in-stars in-stars-b"></canvas>
          <div class="in-moon"><i class="in-moon-glow"></i><svg viewBox="0 0 130 130"><path d="M78 8 A58 58 0 1 0 122 92 A48 48 0 1 1 78 8 Z"/></svg></div>
          <div class="in-sunglow off"></div>
          <div class="in-sun off"><i class="in-rays"></i><i class="in-sun-disc"></i><i class="in-sun-dusk"></i></div>
          <div class="in-clouds off">
            <svg class="in-cloud" style="left:150px;top:120px;width:250px" viewBox="0 0 140 84"><path d="${CLOUD}"/></svg>
            <svg class="in-cloud" style="left:930px;top:200px;width:190px" viewBox="0 0 140 84"><path d="${CLOUD}"/></svg>
            <svg class="in-cloud" style="left:1300px;top:100px;width:220px" viewBox="0 0 140 84"><path d="${CLOUD}"/></svg>
          </div>
          <div class="in-birds off">${[0, 1, 2].map((i) => html`<svg class="in-bird" style="left:${i * 46}px;top:${(i % 2) * 26}px" viewBox="0 0 40 20"><path d="M2 6 Q11 0 20 10 Q29 0 38 6"/></svg>`)}</div>
          <div class="in-shoot off"><i><b></b></i></div>
          <div class="in-fx in-fx-sky"></div>
          <div class="in-dim off"></div>
          <div class="in-rays2 off"></div>
          <svg class="in-hills in-hills-night" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="hb" d="${HILLS_BACK}"/><path class="hf" d="${HILLS_FRONT}"/></svg>
          <svg class="in-hills in-hills-day off" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="hb" d="${HILLS_BACK}"/><path class="hf" d="${HILLS_FRONT}"/></svg>
          <div class="in-flies">${flies}</div>
          <span class="in-tag" style="left:${F_HOME[0]}px">${nameOf(0)}</span>
          <span class="in-tag" style="left:${S_HOME[0]}px">${nameOf(1)}</span>
          ${charHTML(0, F_HOME)}
          ${charHTML(1, S_HOME)}
          <svg class="in-heart off" viewBox="0 0 100 92"><path d="${HEART}"/></svg>
          <div class="in-fx in-fx-front"></div>
        </div>
        <div class="in-wash off"></div>
        <div class="in-cards off">${cards}
          <div class="in-mchar in-mchar-0">${avatar(0, { mood: 'laugh', pose: 'cheer', eyes: 'happy' })}</div>
          <div class="in-mchar in-mchar-1">${avatar(1, { mood: 'laugh', pose: 'cheer', eyes: 'happy' })}</div>
        </div>
        <div class="in-logo"></div>
        <p class="in-sub off">${nameOf(0)} & ${nameOf(1)} oyun gecesi</p>
        <div class="in-title"></div>
        <div class="in-flash off"></div>
      </div>
    </div>
    <div class="in-vig"></div>
    <div class="in-bar in-bar-top"></div>
    <div class="in-bar in-bar-bot"><i class="in-progress"></i></div>
    <div class="in-black"></div>
    <button class="in-skip" type="button">İntroyu atla ${icon('skip')}</button>`);
  return root;
}

// Rastgele ama her açılışta aynı yıldızlar
function drawStars(canvas, seed, count, ext, res) {
  const w = W;
  const h = 640 + ext;
  canvas.style.height = `${h}px`;
  canvas.style.top = `${-ext}px`;
  canvas.width = Math.round(w * res);
  canvas.height = Math.round(h * res);
  const g = canvas.getContext('2d');
  g.setTransform(res, 0, 0, res, 0, 0);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rnd() < 0.08 ? 2.4 + rnd() * 1.4 : 0.8 + rnd() * 1.3;
    g.globalAlpha = 0.45 + rnd() * 0.55;
    g.fillStyle = rnd() < 0.15 ? '#ffe9a8' : '#ffffff';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (r > 2.3) {
      g.globalAlpha = 0.35;
      g.fillRect(x - r * 3, y - 0.5, r * 6, 1);
      g.fillRect(x - 0.5, y - r * 3, 1, r * 6);
    }
  }
}

// Stil dosyası ve yazı tipleri hazır olmadan film başlamaz; ilk karede yedek yazı tipi görünmesin
let ready = null;
export function prepareIntro() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    const done = () => {
      const fonts = document.fonts
        ? Promise.all(['700 80px Caveat', '400 80px "Lilita One"', '600 16px Fredoka'].map((f) => document.fonts.load(f))).catch(() => {})
        : Promise.resolve();
      Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(resolve);
    };
    let l = document.querySelector('link[data-intro]');
    if (l && l.sheet) { done(); return; }
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/intro.css';
      l.dataset.intro = '1';
      document.head.append(l);
    }
    l.addEventListener('load', done, { once: true });
    l.addEventListener('error', done, { once: true });
  });
  return ready;
}

export function playIntro({ onHandoff = () => {}, onEnd = () => {} } = {}) {
  const root = buildDOM();
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const E = {
    view: $('.in-view'), zoom: $('.in-zoom'), world: $('.in-world'),
    night: $('.in-sky-night'), dusk: $('.in-sky-dusk'), dawn: $('.in-sky-dawn'), day: $('.in-sky-day'),
    starsA: $('.in-stars-a'), starsB: $('.in-stars-b'), moon: $('.in-moon'),
    sunglow: $('.in-sunglow'), sun: $('.in-sun'), rays: $('.in-rays'), sunDusk: $('.in-sun-dusk'),
    clouds: $('.in-clouds'), birds: $('.in-birds'), shoot: $('.in-shoot'),
    fxSky: $('.in-fx-sky'), fxFront: $('.in-fx-front'),
    hillsNight: $('.in-hills-night'), hillsDay: $('.in-hills-day'), flies: $('.in-flies'),
    tags: $$('.in-tag'), chars: $$('.in-char'), heart: $('.in-heart'), dim: $('.in-dim'), rays2: $('.in-rays2'),
    wash: $('.in-wash'), cardsBox: $('.in-cards'), cards: $$('.in-card'), mchars: $$('.in-mchar'),
    logo: $('.in-logo'), sub: $('.in-sub'), title: $('.in-title'), flash: $('.in-flash'),
    vig: $('.in-vig'), barTop: $('.in-bar-top'), barBot: $('.in-bar-bot'), progress: $('.in-progress'),
    black: $('.in-black'), skip: $('.in-skip'),
  };
  const blob = (i) => E.chars[i].querySelector('svg');

  /* ---------- Ölçek ---------- */

  // Film 1600x900 birimlik sahnede çekilir; ekranı doldurur, en az 1000 birim genişlik her zaman görünür
  let scale = 1;
  let visW = W;
  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scale = Math.min(Math.max(vw / W, vh / H), vw / 1000);
    E.view.style.transform = `translate(-50%, -50%) scale(${scale})`;
    const ext = Math.max(0, Math.ceil((vh / scale - H) / 2) + 4);
    root.style.setProperty('--ext', `${ext}px`);
    // Dikey ekranda sahnenin yalnızca ortası görünür; yazılar o genişliğe sığacak kadar küçülür
    visW = Math.min(W, vw / scale);
    root.style.setProperty('--fit', Math.min(1, (visW - 90) / 1250).toFixed(3));
    const res = Math.min(scale * Math.min(2, window.devicePixelRatio || 1), 2400 / W);
    drawStars(E.starsA, 7, 260, ext, res);
    drawStars(E.starsB, 91, 200, ext, res);
  }
  layout();
  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(layout, 80);
  };
  window.addEventListener('resize', onResize);

  /* ---------- Yardımcılar ---------- */

  // Geç kalan ipucu animasyonu negatif gecikmeyle başlatır; görüntü sesle aynı yerde kalır
  let late = 0;
  const A = (el, frames, ms, { delay = 0, easing = 'linear', fill = 'both', iterations = 1, direction = 'normal' } = {}) => {
    if (!el) return null;
    return el.animate(frames, { duration: ms, delay: delay - late * 1000, easing, fill, iterations, direction });
  };
  const show = (...els) => els.forEach((el) => el.classList.remove('off'));
  const hide = (...els) => els.forEach((el) => {
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    el.classList.add('off');
  });
  const fade = (el, from, to, ms, opts = {}) => A(el, [{ opacity: from }, { opacity: to }], ms, { easing: 'ease-in-out', ...opts });

  function title(text, { style = 'night', hold = 2400, size = 1, top = 128 } = {}) {
    const t = document.createElement('div');
    t.className = `in-t in-t--${style}`;
    t.style.top = `${top}px`;
    t.style.setProperty('--s', size);
    t.innerHTML = toHTML(text.split(' ').map((w) => html`<span class="w">${w}</span> `));
    E.title.append(t);
    const words = [...t.children];
    words.forEach((w, i) => A(w, [
      { opacity: 0, transform: 'translateY(26px) rotate(-5deg) scale(.92)' },
      { opacity: 1, transform: 'none' },
    ], 520, { delay: i * 85, easing: SPRING }));
    A(t, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-18px)' }], 460, { delay: hold, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => t.remove(), () => {});
  }

  function sparkles(box, x, y, n = 10, color = '#ffcd3c', dist = 120) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'in-spark';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--c', i % 2 ? '#fff' : color);
      box.append(s);
      const a = (i / n) * Math.PI * 2 + 0.3;
      const d = dist * (0.7 + (i % 3) * 0.18);
      A(s, [
        { opacity: 1, transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)' },
        { opacity: 1, transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.7}px), calc(-50% + ${Math.sin(a) * d * 0.7}px)) scale(1) rotate(90deg)`, offset: 0.6 },
        { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.4) rotate(160deg)` },
      ], 820, { easing: OUT, fill: 'forwards' }).finished.then(() => s.remove(), () => s.remove());
    }
  }

  function firework(x, y, color, size = 1, box = E.fxSky) {
    const fw = document.createElement('div');
    fw.className = 'in-fw';
    fw.style.left = `${x}px`;
    fw.style.top = `${y}px`;
    fw.style.setProperty('--c', color);
    const dots = (n, cls) => Array.from({ length: n }, (_, i) => `<i style="transform:rotate(${(i / n) * 360}deg) translateX(${cls === 'o' ? 120 : 70}px)"></i>`).join('');
    fw.innerHTML = `<i class="in-fw-trail"></i><i class="in-fw-flash"></i><div class="in-fw-ring o">${dots(16, 'o')}</div><div class="in-fw-ring n">${dots(10, 'n')}</div>`;
    box.append(fw);
    const [trail, flash, outer, inner] = fw.children;
    const rise = 660 - y;
    A(trail, [{ opacity: 0, transform: `translateY(${rise}px) scaleY(.6)` }, { opacity: 1, transform: `translateY(${rise * 0.3}px) scaleY(1.2)`, offset: 0.5 }, { opacity: 0, transform: 'translateY(0) scaleY(.4)' }], 420, { easing: OUT });
    A(flash, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' }, { opacity: 0.9, transform: 'translate(-50%, -50%) scale(1)', offset: 0.25 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.4)' }], 700, { delay: 420, easing: OUT });
    A(outer, [{ opacity: 1, transform: `scale(${0.12 * size})` }, { opacity: 1, transform: `scale(${0.95 * size})`, offset: 0.55 }, { opacity: 0, transform: `scale(${1.08 * size}) translateY(14px)` }], 1150, { delay: 420, easing: OUT });
    A(inner, [{ opacity: 1, transform: `scale(${0.1 * size}) rotate(18deg)` }, { opacity: 1, transform: `scale(${0.9 * size}) rotate(18deg)`, offset: 0.5 }, { opacity: 0, transform: `scale(${1.05 * size}) rotate(18deg) translateY(10px)` }], 1000, { delay: 470, easing: OUT });
    setTimeout(() => fw.remove(), 2400);
  }

  // Zıplayarak yürüme: her zıplama bir vuruş. Noktalar sahne koordinatı, kayma karakterin ilk yerine göre
  function hopPath([x0, y0], [x1, y1], hops, [ox, oy], height = 78) {
    const frames = [];
    for (let k = 0; k <= hops; k++) {
      const px = x0 + ((x1 - x0) * k) / hops - ox;
      const py = y0 + ((y1 - y0) * k) / hops - oy;
      frames.push({ transform: `translate(${px}px, ${py}px)`, offset: k / hops, easing: 'cubic-bezier(.2,.7,.4,1)' });
      if (k < hops) {
        const mx = x0 + ((x1 - x0) * (k + 0.5)) / hops - ox;
        const my = y0 + ((y1 - y0) * (k + 0.5)) / hops - oy - height;
        frames.push({ transform: `translate(${mx}px, ${my}px)`, offset: (k + 0.5) / hops, easing: 'cubic-bezier(.6,0,.8,.3)' });
      }
    }
    return frames;
  }
  const squash = (el, times, gap) => A(el, Array.from({ length: times * 2 + 1 }, (_, i) => ({
    transform: i % 2 ? 'scale(.96, 1.06)' : (i === 0 || i === times * 2 ? 'none' : 'scale(1.08, .9)'),
    offset: i / (times * 2),
  })), times * gap);

  /* ---------- Zaman çizelgesi ---------- */

  const [furkan, sinem] = E.chars;
  function startFlies() {
    $$('.in-fly').forEach((f, i) => {
      const dx = ((i * 37) % 90) - 45;
      const dy = ((i * 53) % 70) - 35;
      A(f, [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }], 2600 + (i % 5) * 700, { iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', delay: -i * 300 });
      A(f, [{ opacity: 0 }, { opacity: 1 }], 900 + (i % 4) * 300, { iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', delay: 1000 + i * 140 });
    });
  }
  const body = (i) => E.chars[i].querySelector('.in-body');
  const cues = [];
  const at = (t, fn) => cues.push([t, fn]);

  // Gece
  at(0, () => {
    fade(E.black, 1, 0, 1700, { delay: 150 });
    A(E.progress, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], LENGTH * 1000);
    A(E.barTop, [{ transform: 'translateY(-100%)' }, { transform: 'none' }], 1400, { easing: OUT });
    A(E.barBot, [{ transform: 'translateY(100%)' }, { transform: 'none' }], 1400, { easing: OUT });
    fade(E.starsA, 0, 1, 2600, { delay: 200 });
    fade(E.starsB, 0, 0.7, 2600, { delay: 700 });
    A(E.moon, [
      { opacity: 0, transform: 'translate(170px, 380px)' },
      { opacity: 1, transform: 'translate(60px, 120px)', offset: 0.55 },
      { opacity: 1, transform: 'none' },
    ], 4600, { delay: 300, easing: OUT });
    A(E.world, [{ transform: 'scale(1.07)' }, { transform: 'none' }], 9600, { easing: OUT });
    startFlies();
  });
  at(2.6, () => {
    A(E.starsA, [{ opacity: 1 }, { opacity: 0.45 }], 1700, { iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    A(E.starsB, [{ opacity: 0.7 }, { opacity: 1 }], 2300, { iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  });
  at(1.0, () => title('Bir gece, iki ayrı tepede...', { hold: 2400 }));
  at(3.0, () => A(body(0), [{ transform: 'translateY(210px)' }, { transform: 'translateY(-14px)', offset: 0.7 }, { transform: 'none' }], 760, { easing: OUT }));
  at(3.5, () => A(body(1), [{ transform: 'translateY(210px)' }, { transform: 'translateY(-14px)', offset: 0.7 }, { transform: 'none' }], 760, { easing: OUT }));
  at(3.9, () => E.tags.forEach((t, i) => A(t, [{ opacity: 0, transform: 'translate(-50%, 16px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], 600, { delay: i * 260, easing: OUT })));
  at(4.6, () => title('aynı yıldızlara bakan iki kişi vardı.', { hold: 3100 }));
  at(6.0, () => {
    show(E.shoot);
    A(E.shoot.firstElementChild, [
      { opacity: 0, transform: 'translate(0, 0)' },
      { opacity: 1, transform: 'translate(-260px, 110px)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-900px, 380px)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-1100px, 465px)' },
    ], 1000, { easing: 'cubic-bezier(.3,.1,.6,1)' });
  });
  at(6.3, () => { setBlob(blob(0), { mood: 'wow' }); setBlob(blob(1), { mood: 'wow' }); sparkles(E.fxSky, 360, 470, 9, '#fff3c4', 110); });
  at(7.6, () => { setBlob(blob(0), { mood: 'happy' }); setBlob(blob(1), { mood: 'happy' }); });

  // Gün doğumu
  at(8.2, () => {
    show(E.dawn);
    fade(E.dawn, 0, 1, 2600);
    fade(E.starsA, 1, 0, 1800, { delay: 200 });
    fade(E.starsB, 1, 0, 1800);
    A(E.moon, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(220px, 300px)' }], 2600, { easing: IN });
    fade(E.flies, 1, 0, 1400);
    E.tags.forEach((t) => A(t, [{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 10px)' }], 600));
  });
  at(9.6, () => {
    show(E.sun, E.sunglow, E.hillsDay);
    A(E.sun, [{ transform: 'translateY(470px)' }, { transform: 'none' }], 3600, { easing: OUT });
    A(E.rays, [{ transform: 'translate(-50%, -50%) rotate(0deg)' }, { transform: 'translate(-50%, -50%) rotate(360deg)' }], 48000, { iterations: Infinity });
    fade(E.sunglow, 0, 1, 3200);
    fade(E.hillsDay, 0, 1, 4000);
    fade(E.vig, 1, 0.3, 3000);
    A(E.world, [{ transform: 'none' }, { transform: 'scale(1.03)' }], 9000, { easing: 'ease-in-out' });
  });
  at(10.4, () => {
    hide(E.night, E.starsA, E.starsB, E.moon, E.flies);
    title('Sonra güneş doğdu', { style: 'day', hold: 2200 });
  });
  at(11.2, () => { show(E.day); fade(E.day, 0, 1, 2400); });
  at(12.0, () => {
    show(E.clouds);
    $$('.in-cloud').forEach((c, i) => A(c, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: `translateX(${120 + i * 40}px)` }], 9000, { easing: 'linear' }));
  });
  at(12.6, () => {
    show(E.birds);
    A(E.birds, [{ transform: 'translate(-200px, 330px)' }, { transform: 'translate(1750px, 120px)' }], 5200, { easing: 'linear' });
    $$('.in-bird').forEach((b, i) => A(b, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.35)' }], 260, { iterations: Infinity, direction: 'alternate', delay: i * 90, easing: 'ease-in-out' }));
  });
  at(13.6, () => {
    hide(E.dawn, E.hillsNight);
    E.chars.forEach((c) => c.classList.add('free'));
  });
  at(13.8, () => {
    A(furkan, hopPath(F_HOME, F_MEET, 4, F_HOME), 2400);
    A(sinem, hopPath(S_HOME, S_MEET, 4, S_HOME), 2400);
    squash(body(0), 4, 600);
    squash(body(1), 4, 600);
  });
  at(16.2, () => {
    E.chars.forEach((c, i) => setBlob(blob(i), { mood: 'laugh', eyes: 'happy', pose: 'cheer' }));
    show(E.heart);
    A(E.heart, [
      { opacity: 0, transform: 'translate(-50%, 30px) scale(.1) rotate(-18deg)' },
      { opacity: 1, transform: 'translate(-50%, -10px) scale(1.25) rotate(6deg)', offset: 0.45 },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1)' },
    ], 700, { easing: SPRING });
    sparkles(E.fxFront, 800, 430, 12, '#ff5fa2', 150);
  });
  at(16.6, () => title('ve yolları tam ortada kesişti.', { style: 'day', hold: 1900 }));
  at(17.0, () => A(E.heart, [{ transform: 'translate(-50%, 0) scale(1)' }, { transform: 'translate(-50%, -8px) scale(1.12)' }], 300, { iterations: 4, direction: 'alternate', easing: 'ease-in-out', fill: 'none' }));
  at(18.2, () => A(E.heart, [{ opacity: 1, transform: 'translate(-50%, 0) scale(1)' }, { opacity: 0, transform: 'translate(-50%, -90px) scale(.7)' }], 700, { easing: IN }));

  // Montaj
  at(18.85, () => {
    show(E.wash);
    A(E.wash, [{ transform: 'translateX(110%) skewX(-12deg)' }, { transform: 'translateX(0) skewX(0deg)' }], 380, { easing: 'cubic-bezier(.7,0,.3,1)' });
  });
  at(19.2, () => {
    hide(E.world);
    show(E.cardsBox, E.flash);
    fade(E.flash, 0.65, 0, 380);
  });
  E.cards.forEach((card, k) => at(19.2 + k * 0.6 - 0.32, () => {
    const [, , , tilt] = MONTAGE[k];
    const fromX = (k % 2 ? 1 : -1) * (900 + (k % 3) * 120);
    const fromY = (k < 4 ? -1 : 1) * 260;
    A(card, [
      { opacity: 0, transform: `translate(${fromX}px, ${fromY}px) rotate(${(k % 2 ? 1 : -1) * 50}deg) scale(.6)` },
      { opacity: 1, transform: `translate(0, 0) rotate(${tilt}deg) scale(1)` },
    ], 560, { easing: SPRING });
  }));
  at(19.4, () => title('Şarkılar mırıldandılar,', { style: 'pop', hold: 1350, top: 84 }));
  at(21.2, () => title('kameraya poz verdiler,', { style: 'pop', hold: 1350, top: 84 }));
  at(23.0, () => title('gülmekten kırıldılar.', { style: 'pop', hold: 2500, top: 84 }));
  at(24.0, () => E.mchars.forEach((m, i) => A(m, [{ transform: 'translateY(420px)' }, { transform: 'translateY(-30px)', offset: 0.7 }, { transform: 'none' }], 620, { delay: i * 90, easing: OUT })));
  [24.0, 24.6, 25.2, 25.8].forEach((b) => at(b, () => E.cards.forEach((c, k) => A(c.firstElementChild, [{ transform: 'none' }, { transform: 'scale(1.07)', offset: 0.3 }, { transform: 'none' }], 300, { delay: k * 22, easing: 'ease-out', fill: 'none' }))));
  at(26.4, () => {
    E.cards.forEach((card, k) => {
      const [, x, y, tilt] = MONTAGE[k];
      const dx = (x - 800) * 2.2;
      const dy = (y - 450) * 2.6;
      A(card, [
        { opacity: 1, transform: `translate(0, 0) rotate(${tilt}deg) scale(1)` },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(${tilt * 9}deg) scale(.7)` },
      ], 520, { delay: k * 25, easing: IN });
    });
    E.mchars.forEach((m) => A(m, [{ transform: 'none' }, { transform: 'translateY(-40px)', offset: 0.3 }, { transform: 'translateY(460px)' }], 600, { easing: IN }));
    // Dünya, perdenin arkasında gün batımına hazırlanır
    show(E.world, E.dusk, E.hillsNight);
    hide(E.day, E.clouds, E.birds, E.heart);
    E.chars.forEach((c, i) => {
      c.getAnimations().forEach((a) => a.cancel());
      const [hx, hy] = i ? S_HOME : F_HOME;
      const [mx, my] = i ? S_MEET : F_MEET;
      c.style.transform = `translate(${mx - hx}px, ${my - hy}px)`;
      setBlob(blob(i), { mood: 'happy', eyes: 'open', pose: 'rest' });
    });
    E.sunDusk.style.opacity = '1';
    A(E.world, [{ transform: 'scale(1.03)' }, { transform: 'scale(1.03)' }], 10);
  });
  at(27.0, () => {
    A(E.wash, [{ transform: 'translateX(0)' }, { transform: 'translateX(-112%) skewX(12deg)' }], 420, { easing: 'cubic-bezier(.7,0,.3,1)' });
    A(E.sun, [{ transform: 'translateY(60px)' }, { transform: 'translateY(520px)' }], 4800, { easing: 'ease-in' });
    fade(E.rays, 1, 0, 2000);
    A(E.sunglow, [{ opacity: 1 }, { opacity: 0 }], 4400, { easing: 'ease-in' });
    A(E.hillsDay, [{ opacity: 1 }, { opacity: 0 }], 3600, { delay: 600, easing: 'ease-in-out' });
    fade(E.vig, 0.3, 0.85, 4000);
  });
  at(27.5, () => hide(E.wash, E.cardsBox));

  // Gece geri döner, havai fişekler
  at(29.6, () => {
    show(E.night, E.starsA, E.starsB, E.moon, E.flies);
    fade(E.dusk, 1, 0, 2400);
    fade(E.starsA, 0, 1, 2400, { delay: 400 });
    fade(E.starsB, 0, 0.7, 2400, { delay: 800 });
    fade(E.flies, 0, 1, 1600, { delay: 600 });
    startFlies();
    A(E.moon, [{ opacity: 0, transform: 'translate(-1000px, 360px)' }, { opacity: 1, transform: 'translate(-820px, 30px)' }], 3800, { easing: OUT });
  });
  at(30.0, () => title('Gece oldu ama oyun bitmedi.', { hold: 3200 }));
  at(31.2, () => E.chars.forEach((c, i) => setBlob(blob(i), { mood: 'laugh', eyes: 'happy', pose: 'cheer' })));
  at(32.0, () => {
    hide(E.dusk, E.hillsDay, E.sun, E.sunglow);
    A(E.starsA, [{ opacity: 1 }, { opacity: 0.45 }], 1700, { iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  });
  const FIREWORKS = [[31.2, 330, 250, 0], [31.8, 1270, 215, 1], [32.4, 560, 330, 2], [33.6, 800, 190, 3], [34.2, 1060, 300, 4], [36.4, 300, 220, 1], [37.0, 1300, 240, 0], [37.6, 640, 150, 2], [38.8, 1000, 160, 4], [40.0, 420, 320, 5]];
  // Logodan sonrakiler karartmanın üstünde patlar
  for (const [t, x, y, c] of FIREWORKS) at(t - 0.42, () => firework(x, y, COLORS[c], t > 36 ? 1.15 : 1, t > 36 ? E.fxFront : E.fxSky));
  at(34.8, () => {
    A(E.world, [{ transform: 'scale(1.03)' }, { transform: 'scale(1.1)' }], 1200, { easing: 'ease-in' });
    // Logonun iki yanı; dar ekranda görünür alanın içine çekilir
    const edge = Math.max(0, (W - visW) / 2 + 110 - F_LOGO[0]);
    E.chars.forEach((c, i) => {
      c.style.transform = '';
      const to = i ? [S_LOGO[0] - edge, S_LOGO[1]] : [F_LOGO[0] + edge, F_LOGO[1]];
      A(c, hopPath(i ? S_MEET : F_MEET, to, 2, i ? S_HOME : F_HOME, 90), 1150, { delay: 50 });
    });
  });

  // Logo
  at(36.0, () => {
    show(E.flash, E.dim, E.rays2, E.sub);
    fade(E.flash, 1, 0, 700, { easing: 'ease-out' });
    fade(E.dim, 0, 1, 500);
    A(E.world, [{ transform: 'scale(1.1)' }, { transform: 'scale(1.02)' }], 1600, { easing: OUT });
    A(E.rays2, [{ opacity: 0, transform: 'translate(-50%, -50%) rotate(0deg) scale(.6)' }, { opacity: 1, transform: 'translate(-50%, -50%) rotate(40deg) scale(1)' }], 1600, { easing: OUT });
    E.logo.innerHTML = toHTML(logoHTML('logo--intro'));
    A(E.logo, [{ transform: 'scale(1.35)' }, { transform: 'none' }], 900, { easing: OUT });
  });
  at(36.1, () => cannons());
  at(37.6, () => {
    A(E.rays2, [{ transform: 'translate(-50%, -50%) rotate(40deg)' }, { transform: 'translate(-50%, -50%) rotate(400deg)' }], 36000, { iterations: Infinity });
    A(E.sub, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], 700, { easing: OUT });
  });
  at(39.6, () => title('Hazır mısınız?', { style: 'pop', hold: 1300, top: 628, size: 0.9 }));
  at(41.2, () => {
    title('Başlıyoruz!', { style: 'pop', hold: 1500, top: 628, size: 1.05 });
    sparkles(E.fxFront, 800, 680, 12, '#ffcd3c', 170);
  });

  // Sinematik geçiş: şeritler açılır, kamera logoya dalar, site belirir
  at(42.6, () => {
    A(E.barTop, [{ transform: 'none' }, { transform: 'translateY(-100%)' }], 900, { easing: INOUT });
    A(E.barBot, [{ transform: 'none' }, { transform: 'translateY(100%)' }], 900, { easing: INOUT });
    E.skip.classList.add('is-gone');
  });
  at(43.4, () => handoff());
  at(43.6, () => {
    A(E.zoom, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.55)', opacity: 0 }], 2000, { easing: IN });
    fade(E.vig, 0.85, 0, 1400);
    A(root, [{ backgroundColor: 'rgba(11, 10, 31, 1)' }, { backgroundColor: 'rgba(11, 10, 31, 0)' }], 1700, { easing: IN });
  });
  at(45.7, () => end());
  cues.sort((a, b) => a[0] - b[0]);

  /* ---------- Saat ---------- */

  const ctx = getCtx();
  const score = ctx && ctx.state !== 'closed' ? createScore(ctx) : null;
  const LEAD = 0.06;
  const startPerf = performance.now() + LEAD * 1000;
  if (score) score.start(ctx.currentTime + LEAD);
  let pausedAt = 0;
  let pausedTotal = 0;
  const clock = () => ((pausedAt || performance.now()) - startPerf - pausedTotal) / 1000;
  let ci = 0;
  let raf = 0;
  let ended = false;
  let handed = false;
  const frame = () => {
    if (ended) return;
    const c = clock();
    while (ci < cues.length && cues[ci][0] <= c) {
      const [t, fn] = cues[ci++];
      late = Math.max(0, c - t);
      try { fn(); } catch (err) { console.error(err); }
      late = 0;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // Ses ayrı ve sık bir zamanlayıcıyla kurulur; çizim yavaşlasa da müzik aksamaz
  const pump = score ? setInterval(() => { if (!pausedAt) score.pump(clock()); }, 50) : 0;
  if (score) score.pump(0);

  const onVisibility = () => {
    if (ended) return;
    if (document.hidden && !pausedAt) {
      pausedAt = performance.now();
      root.getAnimations({ subtree: true }).forEach((a) => a.pause());
    } else if (!document.hidden && pausedAt) {
      pausedTotal += performance.now() - pausedAt;
      pausedAt = 0;
      root.getAnimations({ subtree: true }).forEach((a) => a.play());
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Atla düğmesi bir buçuk saniye sonra silik olarak belirir
  const skipT = setTimeout(() => E.skip.classList.add('is-shown'), 1600);

  function handoff() {
    if (handed) return;
    handed = true;
    try { onHandoff(); } catch (err) { console.error(err); }
  }

  function end() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    clearInterval(pump);
    clearTimeout(resizeT);
    clearTimeout(skipT);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (score) score.fade(0.4);
    handoff();
    root.remove();
    onEnd();
  }

  let skipping = false;
  function skip() {
    if (skipping || ended) return;
    skipping = true;
    cancelAnimationFrame(raf);
    ci = cues.length;
    if (score) score.fade(0.6);
    handoff();
    root.style.pointerEvents = 'none';
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished.then(end, end);
  }
  E.skip.addEventListener('click', skip);

  return { skip };
}
