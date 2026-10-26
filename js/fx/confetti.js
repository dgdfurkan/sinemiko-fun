// Tuval üzerinde konfeti: dikdörtgen, daire, kalp ve yıldız parçaları

import { rand, pick } from '../lib/dom.js';

const COLORS = ['#ff5fa2', '#4fb6ff', '#ffcd3c', '#2ed6a0', '#a98bff', '#ff8a3d'];
let canvas = null;
let g = null;
let parts = [];
let raf = 0;
let W = 0;
let H = 0;
let dpr = 1;
let last = 0;
const MAX_PARTS = 650;

// Konfeti küçük parçalar; 1,5 kat çözünürlük yeterince keskin ve tam ekran tuvalin yükünü yarıya indirir
function resize() {
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}

export function initConfetti(el) {
  canvas = el;
  g = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function heart(s) {
  g.beginPath();
  g.moveTo(0, s * 0.35);
  g.bezierCurveTo(-s, -s * 0.3, -s * 0.45, -s, 0, -s * 0.45);
  g.bezierCurveTo(s * 0.45, -s, s, -s * 0.3, 0, s * 0.35);
  g.closePath();
}

function star(s) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.45 : s;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

// Fizik zamana bağlı: 60 ya da 120 Hz ekranda aynı hızda, takılan karede de ileri sarmaz
function loop(t) {
  const k = last ? Math.min(3, (t - last) / (1000 / 60)) : 1;
  last = t;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#2a1636';
  g.lineWidth = 1.6;
  const next = [];
  for (const p of parts) {
    p.life += k;
    const drag = p.drag ** k;
    p.vx *= drag;
    p.vy = p.vy * drag + p.gravity * k;
    p.x += (p.vx + Math.sin(p.life * p.wobbleSpeed) * p.wobble) * k;
    p.y += p.vy * k;
    p.rot += p.vr * k;
    if (p.life >= p.ttl || p.y >= H + 40) continue;
    next.push(p);
    const fade = p.life > p.ttl - 30 ? Math.max(0, (p.ttl - p.life) / 30) : 1;
    // save/restore yerine tek dönüşüm: yüzlerce parçada belirgin hız farkı
    const c = Math.cos(p.rot) * dpr;
    const sn = Math.sin(p.rot) * dpr;
    g.setTransform(c, sn, -sn, c, p.x * dpr, p.y * dpr);
    g.globalAlpha = fade;
    g.fillStyle = p.color;
    if (p.shape === 'rect') {
      const h = (p.size / 2) * Math.cos(p.life * p.flip);
      g.fillRect(-p.size / 2, -h / 2, p.size, h);
    } else if (p.shape === 'circle') {
      g.beginPath();
      g.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
      g.fill();
    } else if (p.shape === 'heart') {
      heart(p.size * 0.75);
      g.fill();
      g.stroke();
    } else {
      star(p.size * 0.65);
      g.fill();
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  parts = next;
  if (parts.length) raf = requestAnimationFrame(loop);
  else {
    raf = 0;
    last = 0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function start() {
  if (!raf) {
    last = 0;
    raf = requestAnimationFrame(loop);
  }
}

function make(x, y, vx, vy, o) {
  return {
    x, y, vx, vy,
    rot: rand(0, Math.PI * 2),
    vr: rand(-0.25, 0.25),
    size: rand(o.size[0], o.size[1]),
    color: pick(o.colors),
    shape: pick(o.shapes),
    gravity: o.gravity,
    drag: 0.985,
    wobble: rand(0, 1.2),
    wobbleSpeed: rand(0.05, 0.15),
    flip: rand(0.08, 0.2),
    life: 0,
    ttl: rand(o.ttl[0], o.ttl[1]),
  };
}

export function burst(x, y, opts = {}) {
  if (!g) return;
  const o = {
    count: 80, power: 12, spread: Math.PI * 2, angle: -Math.PI / 2,
    colors: COLORS, shapes: ['rect', 'rect', 'circle', 'heart', 'star'],
    gravity: 0.3, size: [7, 13], ttl: [70, 130], ...opts,
  };
  for (let i = 0; i < o.count; i++) {
    const a = o.angle + rand(-o.spread / 2, o.spread / 2);
    const v = rand(o.power * 0.35, o.power);
    parts.push(make(x, y, Math.cos(a) * v, Math.sin(a) * v, o));
  }
  if (parts.length > MAX_PARTS) parts.splice(0, parts.length - MAX_PARTS);
  start();
}

// Ekranın tepesinden yağmur gibi döker
export function rain({ duration = 2400, perFrame = 3, colors = COLORS, shapes = ['rect', 'circle', 'heart', 'star'] } = {}) {
  if (!g) return;
  const o = { colors, shapes, gravity: 0.12, size: [8, 14], ttl: [240, 360] };
  const end = performance.now() + duration;
  const drip = () => {
    for (let i = 0; i < perFrame && parts.length < MAX_PARTS; i++) parts.push(make(rand(0, W), rand(-60, -10), rand(-1.5, 1.5), rand(1, 4), o));
    start();
    if (performance.now() < end) requestAnimationFrame(drip);
  };
  drip();
}

// İki yandan çapraz top atışı (kazanma anı)
export function cannons() {
  burst(0, H * 0.75, { angle: -Math.PI / 3.2, spread: 0.7, power: 26, count: 90 });
  burst(W, H * 0.75, { angle: -Math.PI + Math.PI / 3.2, spread: 0.7, power: 26, count: 90 });
}
