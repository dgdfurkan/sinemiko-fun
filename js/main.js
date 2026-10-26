// Uygulama girişi: arka plan, üst çubuk, açılış ve ekranlar arası yönlendirme

import { html, toHTML } from './lib/dom.js';
import { store } from './lib/store.js';
import { ensureAudio, setBusVolume } from './audio/engine.js';
import { music } from './audio/music.js';
import { sfx } from './audio/sfx.js';
import { stopClip } from './audio/clip.js';
import { icon, bubbleIcon } from './ui/icons.js';
import { initScoreboard, scoreboard } from './ui/scoreboard.js';
import { confirmSheet, toast, sheetOpen } from './ui/overlay.js';
import { initBackdrop } from './fx/backdrop.js';
import { initConfetti, burst } from './fx/confetti.js';
import { initBubbles, setBubbles } from './fx/bubbles.js';
import { initLook } from './fx/look.js';
import { cover, reveal } from './fx/wipe.js';
import { mountSplash } from './screens/splash.js';
import { mountHome } from './screens/home.js';
import { openSettings } from './screens/settings.js';
import { GAMES, gameById } from './games/registry.js';

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
let entered = false;
let current = null;
let pendingOrigin = null;
let routing = Promise.resolve();

/* ---------- Ses düzeyleri ---------- */

function applyVolumes() {
  setBusVolume('music', store.get('musicOn') ? store.get('musicVol') * 0.9 : 0, 0.4);
  setBusVolume('sfx', store.get('sfxVol'), 0.1);
  setBusVolume('clips', 1, 0.05);
}

/* ---------- Üst çubuk ---------- */

function renderTopbar() {
  topbar.innerHTML = toHTML(html`
    <div class="tb-left">
      <button class="brand-mini" id="btn-home" aria-label="Oyunlara dön"><span class="bm-icon">${icon('home')}</span><span class="bm-text">Sinemiko Fun</span></button>
    </div>
    <div class="scoreboard hidden" id="scoreboard"></div>
    <div class="tb-right">
      <div class="pop-count" id="pop-count" title="Patlatılan baloncuk">${bubbleIcon}<span id="pop-num">${store.get('popped')}</span></div>
      <button class="ibtn" id="btn-music" aria-label="Müzik">${icon('music')}</button>
      <button class="ibtn" id="btn-settings" aria-label="Ayarlar">${icon('sliders')}</button>
      <button class="ibtn" id="btn-full" aria-label="Tam ekran">${icon('full')}</button>
    </div>`);
  initScoreboard(document.getElementById('scoreboard'));
  document.getElementById('btn-home').addEventListener('click', () => { sfx.click(); goHome(); });
  document.getElementById('btn-music').addEventListener('click', () => { sfx.click(); store.set('musicOn', !store.get('musicOn')); });
  document.getElementById('btn-settings').addEventListener('click', () => { sfx.click(); openSettings(); });
  const full = document.getElementById('btn-full');
  if (!canFullscreen()) full.hidden = true;
  full.addEventListener('click', () => { sfx.click(); toggleFullscreen(); });
  syncMusicButton();
}

function syncMusicButton() {
  const b = document.getElementById('btn-music');
  if (!b) return;
  const on = store.get('musicOn');
  b.classList.toggle('off', !on);
  b.innerHTML = toHTML(icon(on ? 'music' : 'musicOff'));
  b.setAttribute('aria-label', on ? 'Müziği kapat' : 'Müziği aç');
}

/* ---------- Tam ekran ---------- */

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
function canFullscreen() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}
function toggleFullscreen() {
  if (fsElement()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  const d = document.documentElement;
  const req = d.requestFullscreen || d.webkitRequestFullscreen;
  const p = req.call(d, { navigationUI: 'hide' });
  if (p && p.catch) p.catch(() => toast('Tarayıcı tam ekrana izin vermedi.', { tone: 'warn' }));
}
function syncFullButton() {
  const b = document.getElementById('btn-full');
  if (!b) return;
  const on = !!fsElement();
  b.innerHTML = toHTML(icon(on ? 'fullExit' : 'full'));
  b.setAttribute('aria-label', on ? 'Tam ekrandan çık' : 'Tam ekran');
}
document.addEventListener('fullscreenchange', syncFullButton);
document.addEventListener('webkitfullscreenchange', syncFullButton);

/* ---------- Baloncuk sayacı ---------- */

const MILESTONES = {
  10: '10 baloncuk! Isınma turu tamam.',
  50: '50 baloncuk! Parmaklar hızlanıyor.',
  100: '100 baloncuk! Resmen baloncuk avcısısınız.',
  250: '250 baloncuk! Bu iş ciddiye bindi.',
  500: '500 baloncuk! Efsane seviyesi.',
  1000: '1000 baloncuk! Bunu kimse beklemiyordu.',
};

function onPop(points) {
  const before = store.get('popped');
  const after = before + points;
  store.set('popped', after);
  const n = document.getElementById('pop-num');
  const box = document.getElementById('pop-count');
  if (n) n.textContent = String(after);
  if (box) {
    box.classList.remove('bump');
    void box.offsetWidth;
    box.classList.add('bump');
  }
  for (const m of Object.keys(MILESTONES).map(Number)) {
    if (before < m && after >= m) {
      toast(MILESTONES[m], { tone: 'good' });
      sfx.fanfare();
      burst(window.innerWidth / 2, window.innerHeight * 0.2, { count: 60, power: 12 });
    }
  }
}

/* ---------- Yönlendirme ---------- */

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const m = h.match(/^oyun\/([a-z]+)$/);
  if (m && gameById(m[1])) return { key: `game:${m[1]}`, game: gameById(m[1]) };
  return { key: 'home', game: null };
}

function setTheme(name) {
  document.body.dataset.theme = name;
  document.body.classList.toggle('at-home', name === 'home');
}

export function navigate(hash, origin = null) {
  pendingOrigin = origin;
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function goHome() {
  if (current && current.inst && current.inst.inProgress && current.inst.inProgress()) {
    const ok = await confirmSheet({ title: 'Oyundan Çıkılsın mı?', text: 'Bu oyundaki skorlar silinecek.', ok: 'Çık', cancel: 'Devam Et' });
    if (!ok) return;
  }
  navigate('#/');
}

function route() {
  routing = routing.then(doRoute).catch((err) => console.error(err));
  return routing;
}

async function doRoute() {
  if (!entered) return;
  const target = parseHash();
  if (current && current.key === target.key) return;
  const g = target.game;
  const origin = pendingOrigin || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  pendingOrigin = null;
  sfx.whoosh();
  await cover({ ...origin, a: g ? g.color : '#ff5fa2', b: g ? g.color2 : '#ffcd3c' });

  if (current && current.inst) {
    try { current.inst.unmount(); } catch (err) { console.error(err); }
  }
  current = null;
  stopClip();
  scoreboard.hide();
  view.innerHTML = '';

  if (g) {
    try {
      const mod = await g.load();
      setTheme(g.theme);
      current = { key: target.key, inst: mod.mount(view, { game: g, navigate, goHome }) };
    } catch (err) {
      console.error(err);
      toast('Oyun yüklenemedi. Bağlantını kontrol edip tekrar dene.', { tone: 'warn' });
      setTheme('home');
      history.replaceState(null, '', '#/');
      current = { key: 'home', inst: mountHome(view, { navigate }) };
    }
  } else {
    setTheme('home');
    current = { key: 'home', inst: mountHome(view, { navigate }) };
  }
  window.dispatchEvent(new Event('sf:scene'));
  // Yeni ekranın stil, yerleşim ve çizimi perde kapalıyken biter; perde açılırken tarayıcı yalnızca perdeyle uğraşır
  await nextFrames(2);
  await reveal();
}

const nextFrames = (n) => new Promise((resolve) => {
  const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
});

window.addEventListener('hashchange', () => route());

/* ---------- Klavye kısayolları ---------- */

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'KeyF' && entered) {
    e.preventDefault();
    toggleFullscreen();
  } else if (e.code === 'KeyM' && entered && !sheetOpen()) {
    store.set('musicOn', !store.get('musicOn'));
  }
});

/* ---------- Başlangıç ---------- */

store.subscribe((key) => {
  if (key === 'musicOn' || key === 'musicVol' || key === 'sfxVol') applyVolumes();
  if (key === 'musicOn') syncMusicButton();
  if (key === 'bubbles') setBubbles(store.get('bubbles'));
  if (key === 'names') {
    const names = store.get('names');
    document.querySelectorAll('.duo-p').forEach((b) => {
      const i = Number(b.dataset.who);
      b.querySelector('.duo-name').textContent = names[i];
      b.setAttribute('aria-label', names[i]);
    });
    document.querySelectorAll('.sb-p[data-p]').forEach((p) => {
      p.querySelector('.sb-name').textContent = names[Number(p.dataset.p)];
    });
  }
});

function start() {
  initBackdrop();
  initConfetti(document.getElementById('confetti'));
  initBubbles(document.getElementById('bubbles'), { onPop });
  setBubbles(store.get('bubbles'));
  initLook();
  renderTopbar();
  document.body.classList.add('at-splash');

  mountSplash(view, async (btn) => {
    const ctx = ensureAudio();
    if (ctx) {
      applyVolumes();
      music.play('chill');
      sfx.go();
    }
    const r = btn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 70, power: 15 });
    entered = true;
    pendingOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    document.body.classList.remove('at-splash');
    await route();
    // Oyun modüllerini arka planda hazırla; ilk açılış beklemesin
    setTimeout(() => GAMES.forEach((g) => g.load().catch(() => {})), 1200);
  });
}

start();
