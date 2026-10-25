// Kamera oyunlarının ortak kabuğu: kamera kartı, çizim katmanı, yükleme ve oyuncu bekleme sahneleri

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { icon } from '../ui/icons.js';
import { PLAYER_COLORS } from '../ui/avatar.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { getTask, openCamera, closeCamera, camErrorText, Tracker } from '../vision/vision.js';

export const PCOL = PLAYER_COLORS;

export function camShell(view, cls) {
  view.innerHTML = `
    <section class="screen game game-cam ${cls}">
      <div class="cam-wrap"><div class="cam-card"><video class="cam-video" playsinline muted></video><canvas class="cam-overlay"></canvas><div class="cam-flash"></div></div></div>
      <div class="stage cam-stage"></div>
    </section>`;
  const root = view.querySelector('.game-cam');
  return {
    root,
    card: root.querySelector('.cam-card'),
    video: root.querySelector('.cam-video'),
    canvas: root.querySelector('.cam-overlay'),
    stageEl: root.querySelector('.cam-stage'),
  };
}

// Kamerayı ve modeli açar. Oyun mantığı cam.onFrame'de, çizim cam.draw'da çalışır
export function camController(shell, life) {
  const { root, card, video, canvas, stageEl } = shell;
  const g = canvas.getContext('2d');
  const cam = {
    players: [null, null],
    seen: [0, 0],
    tracker: null,
    stream: null,
    draw: null,
    onFrame: null,
    leftIs: 0,
    on: false,
    W: 0,
    H: 0,
  };
  let dpr = 1;
  const resize = () => {
    const r = card.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cam.W = r.width;
    cam.H = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(card);

  // HUD sahnelerinde görüntü net, diğer sahnelerde arkada bulanık durur
  const dimSync = () => {
    const cur = stageEl.lastElementChild;
    root.classList.toggle('cam-dim', !!cur && !cur.classList.contains('hud'));
  };
  const mo = new MutationObserver(dimSync);
  mo.observe(stageEl, { childList: true });

  let raf = 0;
  let lastT = performance.now();
  const loop = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cam.W, cam.H);
    if (cam.draw) {
      try {
        cam.draw(g, cam.players, dt, t);
      } catch (err) {
        console.error(err);
        cam.draw = null;
      }
    }
    raf = requestAnimationFrame(loop);
  };

  cam.start = async (kind, onProgress) => {
    if (cam.on) return true;
    let task;
    try {
      task = await getTask(kind, onProgress);
    } catch (err) {
      console.error(err);
      const e = new Error('model');
      e.name = 'model';
      throw e;
    }
    if (!life.alive) return false;
    cam.stream = await openCamera(video);
    if (!life.alive) {
      closeCamera(video, cam.stream);
      return false;
    }
    const ar = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    root.style.setProperty('--ar', ar.toFixed(4));
    root.classList.add('cam-on');
    cam.on = true;
    resize();
    dimSync();
    cam.tracker = new Tracker({
      task,
      kind,
      video,
      leftIs: cam.leftIs,
      onFrame: (players, now) => {
        cam.players = players;
        players.forEach((p, i) => { if (p) cam.seen[i] = now; });
        if (cam.onFrame) {
          try {
            cam.onFrame(players, now);
          } catch (err) {
            console.error(err);
          }
        }
      },
    });
    cam.tracker.start();
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    return true;
  };

  cam.setLeft = (i) => {
    cam.leftIs = i;
    if (cam.tracker) cam.tracker.leftIs = i;
  };

  // Partner hangi yönde: +1 sağda, -1 solda
  cam.sideOf = (i) => (i === cam.leftIs ? 1 : -1);

  cam.visible = (i, ms = 600) => performance.now() - cam.seen[i] < ms;

  // Normalize kamera koordinatı → ekran koordinatı (konfeti için)
  cam.client = (nx, ny) => {
    const r = card.getBoundingClientRect();
    return [r.left + nx * r.width, r.top + ny * r.height];
  };

  // Puan rozetinin uçacağı nokta; scoreboard.add bir öğe bekler
  cam.pointEl = (nx, ny) => ({
    getBoundingClientRect: () => {
      const [x, y] = cam.client(nx, ny);
      return { left: x, top: y, width: 0, height: 0 };
    },
  });

  cam.flash = () => {
    sfx.lock();
    card.querySelector('.cam-flash').animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  };

  // Oyuncunun yüzünden ya da gövdesinden aynalı, kare bir fotoğraf keser
  cam.snapshot = (box, pad = 0.35, size = 360) => {
    if (!box || !video.videoWidth) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const want = Math.max(box.w * vw, box.h * vh) * (1 + pad * 2);
    const s = Math.min(want, vw, vh);
    const cx = (1 - box.cx) * vw;
    const cy = box.cy * vh;
    const sx = Math.max(0, Math.min(vw - s, cx - s / 2));
    const sy = Math.max(0, Math.min(vh - s, cy - s / 2));
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const og = out.getContext('2d');
    og.translate(size, 0);
    og.scale(-1, 1);
    og.drawImage(video, sx, sy, s, s, 0, 0, size, size);
    return out.toDataURL('image/jpeg', 0.86);
  };

  life.add(() => {
    announcer.stop();
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
    if (cam.tracker) cam.tracker.stop();
    closeCamera(video, cam.stream);
    cam.on = false;
    root.classList.remove('cam-on', 'cam-dim');
  });
  return cam;
}

/* ---------- Ortak sahneler ---------- */

// Model ve kamera yüklenirken gösterilen sahne; hata olursa tekrar dene düğmesi çıkar
export async function camBoot(stage, life, cam, kind, { onReady, onBack }) {
  if (cam.on) {
    onReady();
    return;
  }
  const scene = stage.show(html`
    <div class="cam-boot card" data-in>
      <div class="cb-lens"><span></span></div>
      <h2 class="t-big t-accent">Kamera Hazırlanıyor</h2>
      <p class="t-lead" data-status>Hareket tanıma yükleniyor. İlk açılışta birkaç saniye sürebilir.</p>
      <div class="cb-bar"><span data-bar></span></div>
      <p class="opt-note">Görüntü bu cihazdan çıkmaz, hiçbir yere kaydedilmez.</p>
    </div>`);
  const bar = scene.querySelector('[data-bar]');
  const status = scene.querySelector('[data-status]');
  try {
    const ok = await cam.start(kind, (p) => { bar.style.width = `${Math.round(p * 100)}%`; });
    if (!ok || !life.alive) return;
    status.textContent = 'Kamera açılıyor...';
    bar.style.width = '100%';
    onReady();
  } catch (err) {
    if (!life.alive) return;
    sfx.error();
    stage.show(html`
      <div class="cam-boot card" data-in>
        <div class="cb-lens off"><span></span></div>
        <h2 class="t-big t-accent">Kamera Açılamadı</h2>
        <p class="t-lead">${camErrorText(err)}</p>
        <div class="row">
          <button class="btn" data-act="back">${icon('back')}Geri Dön</button>
          <button class="btn btn--primary" data-act="retry" data-primary>${icon('replay')}Tekrar Dene</button>
        </div>
      </div>`, {
      back: () => onBack(),
      retry: () => camBoot(stage, life, cam, kind, { onReady, onBack }),
    });
  }
}

// İki oyuncu kadrajda görünene kadar bekler; kimin solda durduğu buradan değişir
// İkisi de 2,5 saniye görünür kalırsa kendiliğinden başlar; klavyeye dönmek gerekmez
const AUTO_MS = 2500;

export function waitPlayers(stage, life, cam, { title = 'Kadraja Geçin', tip = '', onReady }) {
  const badge = (i) => html`<span class="cam-badge p${i}" data-b="${i}"><span class="cbd-dot"></span><span class="cbd-name">${nameOf(i)}</span><b>Görünmüyor</b></span>`;
  const sideText = () => `${nameOf(cam.leftIs)} solda, ${nameOf(1 - cam.leftIs)} sağda.`;
  const scene = stage.show(html`
    <div class="hud-top" data-in>
      <div class="hud-card">
        <h2 class="t-big">${title}</h2>
        <p class="hud-tip"><b data-side>${sideText()}</b> ${tip}</p>
        <div class="cam-badges">${badge(0)}${badge(1)}</div>
      </div>
    </div>
    <div class="hud-bottom" data-in>
      <button class="btn" data-act="swap">${icon('shuffle')}Yer Değiştir</button>
      <button class="btn btn--primary btn--big cam-ready" data-act="ready" data-primary data-once disabled><span class="cr-fill"></span>${icon('check')}Hazırız</button>
    </div>`, {
    swap: () => {
      cam.setLeft(1 - cam.leftIs);
      scene.querySelector('[data-side]').textContent = sideText();
    },
    ready: () => go(),
  }, { className: 'hud' });
  const btn = scene.querySelector('[data-act="ready"]');
  const badges = [...scene.querySelectorAll('[data-b]')];
  const shown = [null, null];
  let since = 0;
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    // "Hadi bakalım!" bitmeden geri sayım başlamasın
    announcer.say('letsgo');
    life.timeout(() => { if (stage.scene === scene) onReady(); }, 900);
  };
  const tick = () => {
    if (stage.scene !== scene || gone) return;
    const ok = [0, 1].map((i) => cam.visible(i));
    badges.forEach((b, i) => {
      if (shown[i] === ok[i]) return;
      shown[i] = ok[i];
      b.classList.toggle('on', ok[i]);
      b.querySelector('b').textContent = ok[i] ? 'Hazır' : 'Görünmüyor';
      if (ok[i]) sfx.pop();
    });
    const both = ok[0] && ok[1];
    const now = performance.now();
    if (both && btn.disabled) {
      btn.disabled = false;
      btn.classList.add('nudge');
      since = now;
      sfx.ding();
      announcer.react('ready');
    } else if (!both && !btn.disabled) {
      btn.disabled = true;
      btn.classList.remove('nudge');
    }
    const p = both ? Math.min(1, (now - since) / AUTO_MS) : 0;
    btn.style.setProperty('--p', p.toFixed(3));
    if (p >= 1) {
      btn.disabled = true;
      sfx.go();
      go();
    }
  };
  const id = life.interval(tick, 100);
  stage.own(() => clearInterval(id));
  return scene;
}

// Yarış sırasında oyunculardan biri kadrajdan çıkarsa gösterilen uyarı
export function missingText(cam, who = [0, 1]) {
  const gone = who.filter((i) => !cam.visible(i, 900));
  if (!gone.length) return '';
  if (gone.length === 2) return 'İkinizi de göremiyorum!';
  return `${nameOf(gone[0])} görünmüyor!`;
}

/* ---------- Çizim yardımcıları ---------- */

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

export function tag(g, cx, cy, text, color, size = 18) {
  g.font = `400 ${size}px "Lilita One", sans-serif`;
  const tw = g.measureText(text).width;
  const w = tw + size * 1.3;
  const h = size * 1.7;
  roundRect(g, cx - w / 2, cy - h / 2, w, h, h / 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.24;
  g.strokeText(text, cx, cy + 1);
  g.fillText(text, cx, cy + 1);
}

// Yüzün çevresine köşeli çerçeve ve isim etiketi
export function drawFaceFrame(g, cam, p, i, { label = nameOf(i), glow = 0, color = PCOL[i] } = {}) {
  const b = p.box;
  const x = b.x * cam.W;
  const y = b.y * cam.H;
  const w = b.w * cam.W;
  const h = b.h * cam.H;
  const k = Math.min(w, h) * 0.28;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (glow) {
    g.shadowColor = color;
    g.shadowBlur = 34 * glow;
  }
  for (const [lw, col] of [[11, '#2a1636'], [6, color]]) {
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.beginPath();
    g.moveTo(x, y + k); g.lineTo(x, y); g.lineTo(x + k, y);
    g.moveTo(x + w - k, y); g.lineTo(x + w, y); g.lineTo(x + w, y + k);
    g.moveTo(x + w, y + h - k); g.lineTo(x + w, y + h); g.lineTo(x + w - k, y + h);
    g.moveTo(x + k, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - k);
    g.stroke();
  }
  g.shadowBlur = 0;
  if (label) tag(g, x + w / 2, Math.max(18, y - 22), label, color);
}

// Yüzün altında 0-1 arası dolan ölçer; mark eşik çizgisini gösterir
export function meter(g, cam, p, value, color, { mark = 1, label = '' } = {}) {
  const b = p.box;
  const w = Math.max(110, b.w * cam.W * 0.95);
  const x = b.cx * cam.W - w / 2;
  const y = Math.min(cam.H - 60, (b.y + b.h) * cam.H + 16);
  const h = 18;
  roundRect(g, x, y, w, h, 9);
  g.fillStyle = '#fffcf6';
  g.fill();
  const fill = Math.max(0, Math.min(1, value));
  if (fill > 0.02) {
    roundRect(g, x, y, w * fill, h, 9);
    g.fillStyle = color;
    g.fill();
  }
  roundRect(g, x, y, w, h, 9);
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.stroke();
  if (mark < 1) {
    g.beginPath();
    g.moveTo(x + w * mark, y - 5);
    g.lineTo(x + w * mark, y + h + 5);
    g.lineWidth = 4;
    g.stroke();
  }
  if (label) tag(g, b.cx * cam.W, y + h + 22, label, color, 15);
}

// Oyuncunun başının çevresinde dolan halka (pozu tutma süresi)
export function ring(g, x, y, r, value, color) {
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.lineWidth = 12;
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.lineWidth = 6;
  g.strokeStyle = '#ffffffaa';
  g.stroke();
  if (value > 0.01) {
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, value));
    g.lineWidth = 7;
    g.strokeStyle = color;
    g.stroke();
  }
}

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

// Sevimli iskelet: kalın kontur, oyuncu renginde kemikler, ellerde beyaz top
export function drawSkeleton(g, cam, p, i, { glow = 0, label = nameOf(i), color = PCOL[i], alpha = 1 } = {}) {
  const lm = p.lm;
  const P = (k) => [lm[k].x * cam.W, lm[k].y * cam.H];
  const sw = Math.hypot((lm[11].x - lm[12].x) * cam.W, (lm[11].y - lm[12].y) * cam.H);
  const thick = Math.max(6, Math.min(16, sw * 0.09));
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (glow) {
    g.shadowColor = color;
    g.shadowBlur = 30 * glow;
  }
  for (const [lw, col] of [[thick + 7, '#2a1636'], [thick, color]]) {
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.beginPath();
    for (const [a, b] of BONES) {
      if (lm[a].v < 0.4 || lm[b].v < 0.4) continue;
      const [x1, y1] = P(a);
      const [x2, y2] = P(b);
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.stroke();
  }
  g.shadowBlur = 0;
  for (const k of [15, 16]) {
    if (lm[k].v < 0.4) continue;
    const [x, y] = P(k);
    g.beginPath();
    g.arc(x, y, thick * 0.95, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = '#2a1636';
    g.stroke();
  }
  g.restore();
  if (label && lm[0].v > 0.4) {
    const [x, y] = P(0);
    tag(g, x, Math.max(20, y - Math.max(46, sw * 0.62)), label, color);
  }
}

/* ---------- Albüm ---------- */

// Fotoğraflardan indirilebilir bir anı kolajı yapar
export async function albumImage(title, items) {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(items.length))));
  const rows = Math.ceil(items.length / cols);
  const cw = 300;
  const ch = 360;
  const gap = 36;
  const W = cols * cw + (cols + 1) * gap;
  const H = 170 + rows * ch + (rows + 1) * gap;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff3e2';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a16360f';
  for (let y = 12, r = 0; y < H; y += 28, r++) for (let x = 12 + (r % 2) * 14; x < W; x += 28) g.fillRect(x, y, 4, 4);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '400 72px "Lilita One", sans-serif';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#2a1636';
  g.strokeText(title, W / 2, 92);
  g.fillStyle = '#ff5fa2';
  g.fillText(title, W / 2, 92);
  const imgs = await Promise.all(items.map((it) => new Promise((resolve) => {
    if (!it.img) {
      resolve(null);
      return;
    }
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = it.img;
  })));
  items.forEach((it, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const x = gap + col * (cw + gap);
    const y = 170 + gap + row * (ch + gap);
    g.save();
    g.translate(x + cw / 2, y + ch / 2);
    g.rotate((((k * 7) % 5) - 2) * 0.012);
    g.translate(-cw / 2, -ch / 2);
    g.fillStyle = '#2a1636';
    roundRect(g, 0, 8, cw, ch, 14);
    g.fill();
    g.fillStyle = '#fff';
    roundRect(g, 0, 0, cw, ch, 14);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#2a1636';
    g.stroke();
    if (imgs[k]) g.drawImage(imgs[k], 14, 14, cw - 28, cw - 28);
    else {
      g.fillStyle = '#efe4d6';
      g.fillRect(14, 14, cw - 28, cw - 28);
    }
    g.fillStyle = '#2a1636';
    g.font = '700 34px Caveat, cursive';
    g.fillText(it.cap, cw / 2, cw + 8);
    g.fillStyle = it.color || '#2a1636';
    g.font = '600 18px Fredoka, sans-serif';
    g.fillText(it.by || '', cw / 2, cw + 38);
    g.restore();
  });
  return c.toDataURL('image/jpeg', 0.9);
}

export function downloadURL(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

/* ---------- Final ekranı albümü ---------- */

export const albumStripHTML = (items) => html`
  <div class="cam-album" data-in>${items.map((it, k) => html`
    <figure class="polaroid cam-pol" style="--r:${(k % 2 ? 1 : -1) * (1 + (k % 3))}deg">
      <img src="${it.img}" alt="${it.cap}">
      <figcaption class="polaroid-cap">${it.cap}</figcaption>
      <span class="polaroid-by" style="color:${it.color}">${it.by}</span>
    </figure>`)}
  </div>`;

export async function downloadAlbum(title, items, file) {
  const url = await albumImage(title, items);
  downloadURL(url, file);
}
