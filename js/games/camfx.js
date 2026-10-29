// Kamera oyunlarında TikTok tarzı efektler: dev kafa, böcek göz, yüz takası, renk filtreleri,
// çıkartmalar (taç, kedi kulağı, palyaço burnu, güneş gözlüğü, kalpler) ve puan anında yakınlaşma.
// Takip ham kameradan yapılır; efektler yalnızca ekrana çizilir, oyunun ölçümünü bozmaz.
// Video karesi küçük bir tuvale kopyalanıp yumuşak kenarlı kesilir: ekran kartında ucuz, kare düşürmez.

import { store } from '../lib/store.js';
import { rand, pick, clamp } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { tag } from './cam.js';

const POOL = [
  { id: 'big', name: 'Dev Kafa Modu!', face: true, warp: true, ms: 6500, w: 3 },
  { id: 'eyes', name: 'Böcek Gözler!', face: true, ms: 6500, w: 3 },
  { id: 'swap', name: 'Yüz Takası!', face: true, two: true, ms: 7000, w: 3 },
  { id: 'noir', name: 'Siyah Beyaz Film', tint: 'grayscale(1) contrast(1.35) brightness(1.06)', ms: 7000, w: 2 },
  { id: 'rainbow', name: 'Gökkuşağı!', tint: 'hue', ms: 6500, w: 2 },
  { id: 'retro', name: 'Eski Fotoğraf', tint: 'sepia(.8) saturate(1.35) contrast(1.05)', ms: 7000, w: 1 },
  { id: 'pop', name: 'Renk Patlaması!', tint: 'saturate(2.4) contrast(1.15)', ms: 6500, w: 1 },
  { id: 'hearts', name: 'Aşk Modu', face: true, ms: 7000, w: 2 },
  { id: 'clown', name: 'Palyaço Burnu!', face: true, ms: 7000, w: 2 },
  { id: 'cat', name: 'Kedicik Modu', face: true, ms: 7000, w: 2 },
  { id: 'shades', name: 'Havalı Gözlükler', face: true, ms: 6500, w: 2 },
  { id: 'drama', name: 'Dramatik An', face: true, ms: 2800, w: 1 },
];

export const FX_NAME = Object.fromEntries(POOL.map((e) => [e.id, e.name]));

const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v ?? 1, b.v ?? 1) });

// Oyuncunun yüzü ekran pikselinde: merkez, boyut, eğiklik, gözler, burun, alın, ağız
export function faceGeo(p, kind, W, H) {
  if (!p || !p.lm) return null;
  const lm = p.lm;
  const P = (q) => ({ x: q.x * W, y: q.y * H });
  if (kind === 'face') {
    if (lm.length < 400) return null;
    const b = p.box;
    const e1 = P(lm[468] || mid(lm[33], lm[133]));
    const e2 = P(lm[473] || mid(lm[362], lm[263]));
    const eyeW = Math.hypot((lm[33].x - lm[133].x) * W, (lm[33].y - lm[133].y) * H) || b.w * W * 0.2;
    const w = b.w * W;
    const h = b.h * H;
    const rot = Math.atan2(e2.y - e1.y, e2.x - e1.x);
    const flip = Math.abs(rot) > Math.PI / 2;
    return {
      x: b.cx * W, y: b.cy * H, w, h, rot: flip ? rot - Math.sign(rot) * Math.PI : rot,
      eyes: [{ ...e1, r: eyeW * 0.62 }, { ...e2, r: eyeW * 0.62 }],
      nose: P(lm[1] || lm[4]), top: P(lm[10]), mouth: P(mid(lm[13], lm[14])),
    };
  }
  if (kind === 'pose') {
    const n = lm[0];
    if (!n || n.v < 0.5 || lm[2].v < 0.4 || lm[5].v < 0.4) return null;
    const e1 = P(lm[2]);
    const e2 = P(lm[5]);
    const dE = Math.hypot(e2.x - e1.x, e2.y - e1.y);
    const ears = lm[7].v > 0.45 && lm[8].v > 0.45 ? Math.hypot((lm[7].x - lm[8].x) * W, (lm[7].y - lm[8].y) * H) : 0;
    const w = Math.max(ears * 1.25, dE * 2.6);
    const h = w * 1.3;
    let rot = Math.atan2(e2.y - e1.y, e2.x - e1.x);
    if (Math.abs(rot) > Math.PI / 2) rot -= Math.sign(rot) * Math.PI;
    const nose = P(n);
    const cx = nose.x;
    const cy = nose.y - h * 0.06;
    return {
      x: cx, y: cy, w, h, rot,
      eyes: [{ ...e1, r: dE * 0.32 }, { ...e2, r: dE * 0.32 }],
      nose, top: { x: cx + Math.sin(rot) * h * 0.5, y: cy - Math.cos(rot) * h * 0.5 },
      mouth: P(mid(lm[9], lm[10])),
    };
  }
  return null;
}

/* ---------- Video parçası ---------- */

function work(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d');
}

// Aynalı ekrandaki (cx, cy) çevresindeki bölgeyi yumuşak kenarlı elips olarak kopyalar
function cutout(g, video, W, H, cx, cy, rw, rh, feather = 0.72) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !W) return false;
  const kx = vw / W;
  const ky = vh / H;
  const c = g.canvas;
  const ow = c.width;
  const oh = c.height;
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, ow, oh);
  g.save();
  g.translate(ow, 0);
  g.scale(-1, 1);
  try {
    g.drawImage(video, (W - (cx + rw)) * kx, (cy - rh) * ky, rw * 2 * kx, rh * 2 * ky, 0, 0, ow, oh);
  } catch {
    g.restore();
    return false;
  }
  g.restore();
  g.globalCompositeOperation = 'destination-in';
  g.save();
  g.translate(ow / 2, oh / 2);
  g.scale(ow / 2, oh / 2);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, '#000');
  gr.addColorStop(feather, '#000');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
  g.globalCompositeOperation = 'source-over';
  return true;
}

function blit(g, src, x, y, w, h, rot = 0, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(src.canvas, -w / 2, -h / 2, w, h);
  g.restore();
}

/* ---------- Çıkartmalar ---------- */

function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 1.05, y - s * 0.35, x - s * 0.55, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.05, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

function ink(g, fill, lw = 3) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = '#2a1636';
  g.stroke();
}

export function drawCrown(g, f, t, k = 1) {
  const s = f.w * 0.42 * k;
  g.save();
  g.translate(f.top.x, f.top.y - s * 0.35 + Math.sin(t / 260) * 3);
  g.rotate(f.rot);
  g.beginPath();
  g.moveTo(-s, s * 0.3);
  g.lineTo(-s * 1.05, -s * 0.55);
  g.lineTo(-s * 0.5, -s * 0.05);
  g.lineTo(0, -s * 0.8);
  g.lineTo(s * 0.5, -s * 0.05);
  g.lineTo(s * 1.05, -s * 0.55);
  g.lineTo(s, s * 0.3);
  g.closePath();
  ink(g, '#ffcd3c', 3.5);
  for (const [x, c] of [[-0.5, '#ff5fa2'], [0, '#4fb6ff'], [0.5, '#2ed6a0']]) {
    g.beginPath();
    g.arc(x * s, s * 0.08, s * 0.12, 0, Math.PI * 2);
    ink(g, c, 2.5);
  }
  g.restore();
}

function drawCat(g, f, t) {
  const s = f.w * 0.26;
  g.save();
  g.translate(f.x, f.y);
  g.rotate(f.rot);
  const top = -f.h * 0.5;
  for (const dir of [-1, 1]) {
    const wig = Math.sin(t / 300 + dir) * 0.06;
    g.save();
    g.translate(dir * f.w * 0.3, top + s * 0.2);
    g.rotate(dir * (0.25 + wig));
    g.beginPath();
    g.moveTo(-s * 0.6, s * 0.3);
    g.lineTo(0, -s * 1.1);
    g.lineTo(s * 0.6, s * 0.3);
    g.closePath();
    ink(g, '#fffcf6', 3.5);
    g.beginPath();
    g.moveTo(-s * 0.32, s * 0.15);
    g.lineTo(0, -s * 0.65);
    g.lineTo(s * 0.32, s * 0.15);
    g.closePath();
    g.fillStyle = '#ff9ec7';
    g.fill();
    g.restore();
  }
  g.restore();
  // Burun ve bıyıklar
  const n = f.nose;
  g.save();
  g.translate(n.x, n.y);
  g.rotate(f.rot);
  g.beginPath();
  g.ellipse(0, 0, f.w * 0.05, f.w * 0.036, 0, 0, Math.PI * 2);
  ink(g, '#ff7fae', 2.5);
  g.lineCap = 'round';
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  for (const dir of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(dir * f.w * 0.09, f.w * 0.03 + k * f.w * 0.03);
      g.lineTo(dir * f.w * 0.32, f.w * 0.01 + k * f.w * 0.07);
      g.stroke();
    }
  }
  g.restore();
}

function drawClown(g, f, t) {
  const r = f.w * 0.1 * (1 + Math.sin(t / 140) * 0.05);
  g.beginPath();
  g.arc(f.nose.x, f.nose.y, r, 0, Math.PI * 2);
  ink(g, '#ff2d3f', 3.5);
  g.beginPath();
  g.arc(f.nose.x - r * 0.35, f.nose.y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  g.fillStyle = '#ffffffbb';
  g.fill();
  // Yanaklar
  g.save();
  g.translate(f.x, f.y);
  g.rotate(f.rot);
  g.globalAlpha = 0.5;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(dir * f.w * 0.3, f.h * 0.12, f.w * 0.11, f.w * 0.07, 0, 0, Math.PI * 2);
    g.fillStyle = '#ff4f7a';
    g.fill();
  }
  g.restore();
}

function drawShades(g, f, k) {
  const [a, b] = f.eyes;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const drop = (1 - ease(k)) * (cy + span);
  g.save();
  g.translate(cx, cy - drop);
  g.rotate(f.rot);
  const lw = span * 0.62;
  const lh = span * 0.36;
  g.fillStyle = '#16121c';
  g.fillRect(-span * 0.5 - lw * 0.5, -lh * 0.5, span + lw, lh * 0.32);
  for (const dir of [-1, 1]) {
    const x = dir * span * 0.5;
    g.beginPath();
    g.moveTo(x - lw / 2, -lh / 2);
    g.lineTo(x + lw / 2, -lh / 2);
    g.lineTo(x + lw / 2, lh * 0.15);
    g.quadraticCurveTo(x + lw / 2, lh / 2, x, lh / 2);
    g.quadraticCurveTo(x - lw / 2, lh / 2, x - lw / 2, lh * 0.15);
    g.closePath();
    g.fillStyle = '#16121c';
    g.fill();
    g.fillStyle = '#ffffffcc';
    g.fillRect(x - lw * 0.32, -lh * 0.3, lw * 0.16, lh * 0.16);
    g.fillRect(x - lw * 0.14, -lh * 0.3, lw * 0.08, lh * 0.16);
  }
  g.restore();
}

function drawHearts(g, f, t, n = 6) {
  const R = f.w * 0.72;
  for (let k = 0; k < n; k++) {
    const a = t / 700 + (k * Math.PI * 2) / n;
    const x = f.x + Math.cos(a) * R;
    const y = f.top.y + f.h * 0.05 + Math.sin(a) * R * 0.28;
    const front = Math.sin(a) > 0;
    heart(g, x, y, f.w * (front ? 0.14 : 0.1));
    ink(g, front ? '#ff3d7f' : '#ff8cc0', 2.5);
  }
  // Pembe yanaklar
  g.save();
  g.translate(f.x, f.y);
  g.rotate(f.rot);
  g.globalAlpha = 0.35;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(dir * f.w * 0.28, f.h * 0.12, f.w * 0.1, f.w * 0.06, 0, 0, Math.PI * 2);
    g.fillStyle = '#ff5f8f';
    g.fill();
  }
  g.restore();
}

/* ---------- Efekt yöneticisi ---------- */

export function makeLook(cam, shell) {
  const { video, root, card } = shell;
  const works = [work(300, 340), work(300, 340)];
  const eyeWork = work(140, 140);
  const look = {
    auto: false,
    manual: false,
    allowBig: true,
    active: null,
    crown: -1,
    nextAt: 0,
    banner: null,
    lastHue: 0,
  };
  const enabled = () => store.get('camFx') !== false;

  function faces(players) {
    return players.map((p) => faceGeo(p, cam.kind, cam.W, cam.H));
  }

  function setTint(css) {
    video.style.filter = css || '';
  }

  function stop() {
    if (!look.active) return;
    look.active = null;
    setTint('');
  }

  // Rastgele efekt: oyuncuların yüzü görünüyorsa yüz efektleri de seçilebilir
  function startRandom(now, players) {
    const fs = faces(players);
    const nFaces = fs.filter(Boolean).length;
    const pool = POOL.filter((e) => (!e.face || nFaces > 0) && (!e.two || nFaces === 2) && (e.id !== 'big' || look.allowBig) && (!look.last || e.id !== look.last));
    if (!pool.length) return;
    let r = Math.random() * pool.reduce((s, e) => s + e.w, 0);
    let fx = pool[0];
    for (const e of pool) {
      r -= e.w;
      if (r <= 0) {
        fx = e;
        break;
      }
    }
    start(fx.id, now, players);
  }

  function start(id, now = performance.now(), players = cam.players) {
    const fx = POOL.find((e) => e.id === id);
    if (!fx) return;
    stop();
    look.last = id;
    look.active = { ...fx, t0: now, until: now + fx.ms, who: -1 };
    look.banner = { text: fx.name, t0: now };
    if (fx.tint && fx.tint !== 'hue') setTint(fx.tint);
    if (id === 'drama') {
      const fs = faces(players);
      const order = [0, 1].filter((i) => fs[i]);
      const who = look.crown >= 0 && fs[look.crown] ? look.crown : pick(order);
      look.active.who = who;
      const f = fs[who];
      if (f) zoomTo(f.x, f.y, 1.28, 2600, true);
      sfx.dramatic();
    } else {
      sfx.scratch();
      setTimeout(() => sfx.sparkle(), 120);
    }
  }

  function zoomTo(x, y, s, ms, hold = false) {
    card.style.transformOrigin = `${(x / cam.W) * 100}% ${(y / cam.H) * 100}%`;
    const frames = hold
      ? [{ transform: 'scale(1)' }, { transform: `scale(${s})`, offset: 0.3 }, { transform: `scale(${s})`, offset: 0.82 }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(1)' }, { transform: `scale(${s})`, offset: 0.25 }, { transform: 'scale(1)' }];
    card.animate(frames, { duration: ms, easing: 'cubic-bezier(.3,.8,.3,1)' });
  }

  // Puan anı: kısa yakınlaşma
  look.punch = (i, s = 1.07) => {
    if (!enabled()) return;
    const p = cam.players[i];
    if (!p || !p.box) return;
    zoomTo(p.box.cx * cam.W, p.box.cy * cam.H, s, 480);
  };

  look.trigger = (id) => {
    if (!enabled()) return;
    start(id);
    look.nextAt = performance.now() + rand(12000, 18000);
  };

  look.setAuto = (on) => {
    if (on === look.auto) return;
    look.auto = on;
    if (on) look.nextAt = performance.now() + rand(9000, 14000);
    else stop();
  };

  look.reset = () => {
    stop();
    look.crown = -1;
    look.banner = null;
    look.last = null;
    look.allowBig = true;
  };

  look.toggle = () => {
    const on = !enabled();
    store.set('camFx', on);
    if (!on) stop();
    else look.nextAt = performance.now() + 2500;
    return on;
  };

  // Video ile oyun çizimi arasına: yüz değişimleri
  look.under = (g, players, dt, t) => {
    const now = performance.now();
    if (look.active && now > look.active.until) stop();
    if (!look.active && look.auto && !look.manual && enabled() && now > look.nextAt && !cam.paused) {
      startRandom(now, players);
      look.nextAt = now + (look.active ? look.active.ms : 0) + rand(10000, 17000);
    }
    drawUnder(g, players, t);
  };

  function drawUnder(g, players, t) {
    const now = performance.now();
    const a = look.active;
    if (!a) return;
    const k = Math.min(ease((now - a.t0) / 500), ease((a.until - now) / 400));
    if (a.id === 'rainbow') {
      const hue = Math.round(((now - a.t0) / 12) % 360 / 15) * 15;
      if (hue !== look.lastHue) {
        look.lastHue = hue;
        setTint(`hue-rotate(${hue}deg) saturate(1.6)`);
      }
      return;
    }
    if (!a.face || a.id === 'hearts' || a.id === 'clown' || a.id === 'cat' || a.id === 'shades' || a.id === 'drama') return;
    const fs = faces(players);
    if (a.id === 'big') {
      fs.forEach((f, i) => {
        if (!f) return;
        const rw = f.w * 0.66;
        const rh = f.h * 0.72;
        if (!cutout(works[i], video, cam.W, cam.H, f.x, f.y - f.h * 0.04, rw, rh)) return;
        const s = 1 + 0.72 * k + Math.sin(t / 220 + i) * 0.04 * k;
        blit(g, works[i], f.x, f.y - f.h * 0.04 - f.h * 0.16 * k, rw * 2 * s, rh * 2 * s);
      });
    } else if (a.id === 'eyes') {
      fs.forEach((f) => {
        if (!f) return;
        for (const e of f.eyes) {
          const r = Math.max(12, e.r * 1.9);
          if (!cutout(eyeWork, video, cam.W, cam.H, e.x, e.y, r, r, 0.62)) continue;
          const s = 1 + 1.5 * k + Math.sin(t / 90) * 0.1 * k;
          blit(g, eyeWork, e.x, e.y, r * 2 * s, r * 2 * s);
        }
      });
    } else if (a.id === 'swap') {
      if (!fs[0] || !fs[1]) return;
      const ok = fs.map((f, i) => cutout(works[i], video, cam.W, cam.H, f.x, f.y, f.w * 0.56, f.h * 0.62, 0.68));
      if (!ok[0] || !ok[1]) return;
      for (let i = 0; i < 2; i++) {
        const dst = fs[1 - i];
        const src = fs[i];
        blit(g, works[i], dst.x, dst.y, dst.w * 1.12, dst.h * 1.24, dst.rot - src.rot, k);
      }
    }
  }

  function drawStickers(g, players, t) {
    const now = performance.now();
    const a = look.active;
    if (!a || !a.face) return;
    const fs = faces(players);
    const k = Math.min(ease((now - a.t0) / 500), ease((a.until - now) / 400));
    fs.forEach((f) => {
      if (!f) return;
      g.save();
      g.globalAlpha = Math.max(0.01, k);
      if (a.id === 'hearts') drawHearts(g, f, t);
      else if (a.id === 'clown') drawClown(g, f, t);
      else if (a.id === 'cat') drawCat(g, f, t);
      else if (a.id === 'shades') drawShades(g, f, (now - a.t0) / 700);
      g.restore();
    });
  }

  // Fotoğraf kabini: efekt sürekli kalır, otomatik efekt gelmez
  look.hold = (id) => {
    look.manual = true;
    if (!id || !enabled()) {
      stop();
      return;
    }
    start(id);
    look.active.until = Infinity;
    look.nextAt = Infinity;
  };
  look.release = () => {
    look.manual = false;
    stop();
    look.nextAt = performance.now() + rand(9000, 14000);
  };
  // Fotoğrafın üstüne: aynı efekt, başlıksız
  look.paint = (g, players, t) => {
    if (!enabled()) return;
    drawUnder(g, players, t);
    drawStickers(g, players, t);
  };

  // Oyun çiziminin üstüne: çıkartmalar, taç, başlık
  look.over = (g, players, dt, t) => {
    const now = performance.now();
    const a = look.active;
    drawStickers(g, players, t);
    const fs = look.crown >= 0 ? faces(players) : null;
    if (a && a.id === 'noir') {
      // Film greni ve köşe karartması
      const gr = g.createRadialGradient(cam.W / 2, cam.H / 2, cam.H * 0.35, cam.W / 2, cam.H / 2, cam.W * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = gr;
      g.fillRect(0, 0, cam.W, cam.H);
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let k = 0; k < 3; k++) g.fillRect(Math.random() * cam.W, 0, 1.5, cam.H);
    }
    if (a && a.id === 'drama') {
      const gr = g.createRadialGradient(cam.W / 2, cam.H / 2, cam.H * 0.2, cam.W / 2, cam.H / 2, cam.W * 0.6);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(30,0,20,.6)');
      g.fillStyle = gr;
      g.fillRect(0, 0, cam.W, cam.H);
    }
    if (look.crown >= 0 && fs && fs[look.crown] && enabled()) drawCrown(g, fs[look.crown], t);
    const b = look.banner;
    if (b) {
      const age = now - b.t0;
      if (age > 2200) look.banner = null;
      else {
        const s = age < 350 ? 0.4 + 0.75 * ease(age / 350) : 1.15 - 0.15 * ease((age - 350) / 300);
        g.save();
        g.globalAlpha = age > 1800 ? 1 - (age - 1800) / 400 : 1;
        g.translate(cam.W / 2, Math.max(34, cam.H * 0.09));
        g.scale(s, s);
        g.rotate(Math.sin(age / 120) * 0.03);
        tag(g, 0, 0, `✨ ${b.text}`, '#7a5cff', 30);
        g.restore();
      }
    }
  };

  // Oyun dışı sahnelerde ve kapanışta filtre kalmasın
  look.dispose = () => {
    stop();
    root.classList.remove('look-on');
  };
  return look;
}
