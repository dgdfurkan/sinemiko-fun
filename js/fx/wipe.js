// Ekran geçişi: tıklanan noktadan büyüyen iki renkli daire

const root = () => document.getElementById('wipe');
let origin = { x: 0, y: 0 };

function radius(x, y) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 20;
}

export async function cover({ x = window.innerWidth / 2, y = window.innerHeight / 2, a = '#ff5fa2', b = '#ffcd3c' } = {}) {
  const w = root();
  origin = { x, y };
  w.style.setProperty('--wipe-a', a);
  w.style.setProperty('--wipe-b', b);
  w.classList.add('on');
  const R = radius(x, y);
  const [la, lb] = w.children;
  const from = `circle(0px at ${x}px ${y}px)`;
  const to = `circle(${R}px at ${x}px ${y}px)`;
  const opts = { duration: 430, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
  la.getAnimations().forEach((an) => an.cancel());
  lb.getAnimations().forEach((an) => an.cancel());
  const p1 = la.animate([{ clipPath: from }, { clipPath: to }], opts).finished;
  const p2 = lb.animate([{ clipPath: from }, { clipPath: to }], { ...opts, delay: 110 }).finished;
  await Promise.all([p1, p2]).catch(() => {});
}

export async function reveal() {
  const w = root();
  // Yeni ekran hazır; açılırken tıklamaları engelleme
  w.classList.remove('on');
  const [la, lb] = w.children;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const R = radius(cx, cy);
  const opts = { duration: 480, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
  const big = `circle(${R}px at ${cx}px ${cy}px)`;
  const small = `circle(0px at ${cx}px ${cy}px)`;
  const p1 = lb.animate([{ clipPath: big }, { clipPath: small }], opts).finished;
  const p2 = la.animate([{ clipPath: big }, { clipPath: small }], { ...opts, delay: 90 }).finished;
  await Promise.all([p1, p2]).catch(() => {});
}

export const lastOrigin = () => origin;
