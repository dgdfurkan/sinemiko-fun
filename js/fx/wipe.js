// Ekran geçişi: tıklanan noktadan büyüyen iki renkli daire.
// Daireler transform ile büyür; ekran kartı bunu yeniden çizmeden yapar, geçişte kasma olmaz.

const root = () => document.getElementById('wipe');
const BASE = 400;
let origin = { x: 0, y: 0 };

function radius(x, y) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 20;
}

const at = (x, y, s) => `translate(${x}px, ${y}px) scale(${s})`;

export async function cover({ x = window.innerWidth / 2, y = window.innerHeight / 2, a = '#ff5fa2', b = '#ffcd3c' } = {}) {
  const w = root();
  origin = { x, y };
  w.style.setProperty('--wipe-a', a);
  w.style.setProperty('--wipe-b', b);
  w.classList.add('on');
  // Geçiş boyunca arka plan hareketi durur; ekran kartı yalnızca perdeyi çizer
  document.body.classList.add('wiping');
  const s = radius(x, y) / BASE;
  const [la, lb] = w.children;
  const opts = { duration: 520, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
  la.getAnimations().forEach((an) => an.cancel());
  lb.getAnimations().forEach((an) => an.cancel());
  const p1 = la.animate([{ transform: at(x, y, 0) }, { transform: at(x, y, s) }], opts).finished;
  const p2 = lb.animate([{ transform: at(x, y, 0) }, { transform: at(x, y, s) }], { ...opts, delay: 110 }).finished;
  await Promise.all([p1, p2]).catch(() => {});
}

export async function reveal() {
  const w = root();
  // Yeni ekran hazır; açılırken tıklamaları engelleme
  w.classList.remove('on');
  const [la, lb] = w.children;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const s = radius(cx, cy) / BASE;
  const opts = { duration: 560, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
  const p1 = lb.animate([{ transform: at(cx, cy, s) }, { transform: at(cx, cy, 0) }], opts).finished;
  const p2 = la.animate([{ transform: at(cx, cy, s) }, { transform: at(cx, cy, 0) }], { ...opts, delay: 90 }).finished;
  await Promise.all([p1, p2]).catch(() => {});
  document.body.classList.remove('wiping');
}

export const lastOrigin = () => origin;
