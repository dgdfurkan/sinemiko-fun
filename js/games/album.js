// Anı albümü: kamera oyunlarının fotoğraflarından 8K kolaj ve fotoğraf kabini şeridi çizer.
// Çizimler vektörel olarak tam çözünürlükte yapılır; yazılar ve süsler 8K'da da keskin kalır.

import { nameOf } from '../lib/store.js';
import { toast } from '../ui/overlay.js';

const INK = '#2a1636';
const PAPER = '#fff3e2';

function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

const loadImg = (src) => new Promise((resolve) => {
  if (!src) {
    resolve(null);
    return;
  }
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = () => resolve(null);
  im.src = src;
});

function heart(g, x, y, s, fill) {
  g.save();
  g.translate(x, y);
  g.scale(s / 24, s / 24);
  g.beginPath();
  g.moveTo(12, 21);
  g.bezierCurveTo(12, 21, 3, 15.4, 3, 9.3);
  g.bezierCurveTo(3, 6, 5.6, 3.6, 8.6, 3.6);
  g.bezierCurveTo(10.3, 3.6, 11.4, 4.4, 12, 5.4);
  g.bezierCurveTo(12.6, 4.4, 13.7, 3.6, 15.4, 3.6);
  g.bezierCurveTo(18.4, 3.6, 21, 6, 21, 9.3);
  g.bezierCurveTo(21, 15.4, 12, 21, 12, 21);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.stroke();
  g.restore();
}

function star(g, x, y, r, fill) {
  g.save();
  g.translate(x, y);
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const d = k % 2 ? r * 0.45 : r;
    g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = r * 0.14;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}

// Kâğıt zemin, renk lekeleri ve noktalı desen
function paper(g, W, H, u) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  for (const [cx, cy, r, c] of [[0.12, 0.1, 0.5, '#ff8fc055'], [0.9, 0.92, 0.55, '#ffd96a66'], [0.88, 0.08, 0.3, '#9fdcff44'], [0.06, 0.95, 0.35, '#a6e35a33']]) {
    const gr = g.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r * Math.max(W, H));
    gr.addColorStop(0, c);
    gr.addColorStop(1, '#fff3e200');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  g.fillStyle = '#2a16360d';
  const step = 30 * u;
  for (let y = step / 2, row = 0; y < H; y += step, row++) {
    for (let x = step / 2 + (row % 2) * (step / 2); x < W; x += step) {
      g.beginPath();
      g.arc(x, y, 2.6 * u, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function title(g, text, x, y, u, size = 96) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `400 ${size * u}px "Lilita One", sans-serif`;
  g.lineJoin = 'round';
  g.lineWidth = size * 0.22 * u;
  g.strokeStyle = INK;
  g.strokeText(text, x, y);
  g.fillStyle = '#ff5fa2';
  g.fillText(text, x, y);
}

function dateLine() {
  return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Polaroid: beyaz çerçeve, kare (geniş kadrajda 4:3) fotoğraf, el yazısı alt yazı, renkli isim
function polaroid(g, it, img, x, y, w, rot, u, ph = 1) {
  const pad = w * 0.055;
  const pw = w - pad * 2;
  const phH = pw * ph;
  const h = pad + phH + w * 0.22;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(rot);
  g.translate(-w / 2, -h / 2);
  g.fillStyle = INK;
  rr(g, 0, w * 0.03, w, h, w * 0.05);
  g.fill();
  g.fillStyle = '#fff';
  rr(g, 0, 0, w, h, w * 0.05);
  g.fill();
  g.lineWidth = w * 0.016;
  g.strokeStyle = INK;
  g.stroke();
  if (img) {
    // Çerçeveye ortadan kırp
    let sw = img.width;
    let sh = img.width * ph;
    if (sh > img.height) {
      sh = img.height;
      sw = img.height / ph;
    }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, pad, pad, pw, phH);
  } else {
    g.fillStyle = '#efe4d6';
    g.fillRect(pad, pad, pw, phH);
  }
  g.lineWidth = w * 0.006;
  g.strokeStyle = '#2a16362a';
  g.strokeRect(pad, pad, pw, phH);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `700 ${w * 0.115}px Caveat, cursive`;
  g.fillText(it.cap || '', w / 2, pad + phH + (h - pad - phH) * 0.42, w - pad * 2);
  g.fillStyle = it.color || INK;
  g.font = `600 ${w * 0.058}px Fredoka, sans-serif`;
  g.fillText(it.by || '', w / 2, pad + phH + (h - pad - phH) * 0.78, w - pad * 2);
  g.restore();
}

// En büyük polaroidi verecek satır ve sütun sayısını bulur
function fit(n, AW, AH, gap, ratio = 1.22) {
  let best = { w: 0, cols: 1, rows: n };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((AW - (cols - 1) * gap) / cols, (AH - (rows - 1) * gap) / (rows * ratio));
    if (w > best.w) best = { w, cols, rows };
  }
  return best;
}

export async function renderAlbum(name, items, W = 7680, H = 4320) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const u = W / 1920;
  paper(g, W, H, u);
  title(g, name, W / 2, 118 * u, u);
  g.font = `700 ${46 * u}px Caveat, cursive`;
  g.fillStyle = INK;
  g.fillText(`${nameOf(0)} & ${nameOf(1)} · ${dateLine()}`, W / 2, 205 * u);
  heart(g, W / 2 - 520 * u, 92 * u, 64 * u, '#ff5fa2');
  star(g, W / 2 + 540 * u, 110 * u, 34 * u, '#ffcd3c');
  const imgs = await Promise.all(items.map((it) => loadImg(it.img)));
  // Hepsi geniş kadrajsa (fotoğraf kabini) 4:3 çerçeve; yüzler kenardan kesilmesin
  const ph = imgs.length && imgs.every((im) => !im || im.width / im.height > 1.3) ? 0.75 : 1;
  const top = 270 * u;
  const side = 70 * u;
  const bottom = 90 * u;
  const gap = 44 * u;
  const pr = 0.055 + (1 - 0.11) * ph + 0.22;
  const { w, cols, rows } = fit(items.length, W - side * 2, H - top - bottom, gap, pr);
  const h = w * pr;
  const gw = cols * w + (cols - 1) * gap;
  const gh = rows * h + (rows - 1) * gap;
  const x0 = (W - gw) / 2;
  const y0 = top + (H - top - bottom - gh) / 2;
  items.forEach((it, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    // Son satır eksikse ortalanır
    const inRow = row === rows - 1 ? items.length - row * cols : cols;
    const rowX = x0 + ((cols - inRow) * (w + gap)) / 2;
    polaroid(g, it, imgs[k], rowX + col * (w + gap), y0 + row * (h + gap), w, ((((k * 7) % 5) - 2) * 0.014), u, ph);
  });
  g.textAlign = 'right';
  g.font = `400 ${30 * u}px "Lilita One", sans-serif`;
  g.fillStyle = '#2a163666';
  g.fillText('Sinemiko Fun', W - 40 * u, H - 40 * u);
  return c;
}

// Fotoğraf kabini şeridi: 1:3 dikey, fotoğraflar alt alta (8K yüksekliğinde)
export async function renderStrip(name, items, W = 2560, H = 7680) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const u = W / 640;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  paper(g, W, H, u * 0.6);
  title(g, name, W / 2, 80 * u, u, 54);
  g.font = `700 ${28 * u}px Caveat, cursive`;
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.fillText(`${nameOf(0)} & ${nameOf(1)} · ${dateLine()}`, W / 2, 135 * u);
  const imgs = await Promise.all(items.map((it) => loadImg(it.img)));
  const n = Math.max(1, items.length);
  const pad = 34 * u;
  const top = 175 * u;
  const bottom = 90 * u;
  const gap = 26 * u;
  const pw = W - pad * 2;
  const ph = Math.min(pw * 0.75, (H - top - bottom - gap * (n - 1)) / n);
  items.forEach((it, k) => {
    const y = top + k * (ph + gap);
    g.fillStyle = INK;
    rr(g, pad - 6 * u, y - 6 * u, pw + 12 * u, ph + 12 * u, 18 * u);
    g.fill();
    const img = imgs[k];
    if (img) {
      g.save();
      rr(g, pad, y, pw, ph, 14 * u);
      g.clip();
      const r = pw / ph;
      let sw = img.width;
      let sh = img.width / r;
      if (sh > img.height) {
        sh = img.height;
        sw = img.height * r;
      }
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, pad, y, pw, ph);
      g.restore();
    }
    // Fotoğrafın köşesine alt yazı etiketi
    if (it.cap) {
      g.font = `400 ${26 * u}px "Lilita One", sans-serif`;
      const tw = g.measureText(it.cap).width + 34 * u;
      const tx = pad + 18 * u;
      const ty = y + ph - 58 * u;
      g.fillStyle = '#ffcd3c';
      rr(g, tx, ty, tw, 44 * u, 22 * u);
      g.fill();
      g.lineWidth = 4 * u;
      g.strokeStyle = INK;
      g.stroke();
      g.fillStyle = INK;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(it.cap, tx + 17 * u, ty + 23 * u);
    }
  });
  heart(g, W - 80 * u, H - 70 * u, 46 * u, '#ff5fa2');
  g.textAlign = 'left';
  g.font = `400 ${22 * u}px "Lilita One", sans-serif`;
  g.fillStyle = '#2a163666';
  g.fillText('Sinemiko Fun', 30 * u, H - 44 * u);
  return c;
}

const toBlob = (c) => new Promise((resolve) => {
  try {
    c.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  } catch {
    resolve(null);
  }
});

function save(blob, file) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// 8K dener; tarayıcı o boyutta tuval açamazsa 4K'ya iner
export async function downloadAlbum(name, items, file, { strip = false } = {}) {
  toast('8K albüm hazırlanıyor...', { ms: 2200 });
  await new Promise((r) => setTimeout(r, 60));
  const sizes = strip ? [[2560, 7680], [1280, 3840]] : [[7680, 4320], [3840, 2160]];
  for (const [w, h] of sizes) {
    const c = strip ? await renderStrip(name, items, w, h) : await renderAlbum(name, items, w, h);
    const blob = c && (await toBlob(c));
    if (c) {
      c.width = 0;
      c.height = 0;
    }
    if (blob && blob.size > 1000) {
      save(blob, file.replace(/\.jpg$/, w >= 7680 || h >= 7680 ? '-8k.jpg' : '-4k.jpg'));
      return true;
    }
  }
  toast('Albüm hazırlanamadı. Tarayıcı bu boyutta resim yapamadı.', { tone: 'warn' });
  return false;
}
