// Çığlık Roketi: "3, 2, 1, Bağır!" dendiğinde üç saniye boyunca bağır ya da yüksek sesle "aaa" de.
// Sesin roketin yakıtı: ne kadar güçlü ve uzun bağırırsan roket o kadar yükselir

import { html, rand } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { voiceDuel, inked, PCOL, tag, roundRect } from './voicearena.js';

const BURN_MS = 3000;

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-rocket',
    rules: [
      'Sırası gelen geri sayımı bekler. "Bağır!" yazınca üç saniye boyunca var gücüyle "aaa" der.',
      'Ses roketin yakıtı: ne kadar güçlü ve kesintisiz bağırırsan roket o kadar yükselir.',
      'En yükseğe çıkan kazanır. Komşular uyuyorsa kısa bir tur yeter!',
    ],
    introText: () => 'Mikrofona çok yaklaşma, bir kol boyu uzakta dur. "Bağır!" yazınca üç saniye boyunca "aaa".',
    turn,
    fmt: (v) => `${Math.round(v)} m`,
    recordKey: 'rocket',
  });
}

async function turn(ctx, p) {
  const { mic, life, stage } = ctx;
  const sc = ctx.playScene(html`
    <div class="va-top"><p class="va-status t-big" data-status>Şşş...</p><p class="va-sub" data-sub></p></div>`);
  const status = sc.scene.querySelector('[data-status]');
  const sub = sc.scene.querySelector('[data-sub]');
  const gameScene = sc.scene;
  const st = { h: 0, v: 0, fuel: 0, burning: false, flame: 0, stars: Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 3, s: rand(1, 3) })), done: false };
  ctx.st = st;
  sc.loop((dt, t) => {
    if (!st.done || st.v > 0) {
      if (st.burning) st.v += st.flame * 160 * dt;
      st.v -= 60 * dt;
      if (st.h <= 0 && st.v < 0) st.v = 0;
      st.h = Math.max(0, st.h + st.v * dt);
    }
    draw(sc, st, p, t);
    return true;
  });
  await ctx.hush(700);
  for (const n of ['3', '2', '1']) {
    if (stage.scene !== gameScene) return null;
    status.textContent = n;
    sfx.tick(3 - Number(n));
    await life.sleep(650);
  }
  status.textContent = 'Bağır!';
  sub.textContent = '';
  sfx.go();
  st.burning = true;
  const noise = mic.noise || 0.004;
  const t0 = performance.now();
  let peak = 0;
  while (performance.now() - t0 < BURN_MS) {
    const lv = mic.level();
    peak = Math.max(peak, lv);
    // Sessizlik ateşlemez; bağırış güçlendikçe alev büyür, aşırı yüksek ses tavan yapar
    st.flame = Math.min(1.4, Math.max(0, (lv - noise * 3) * 9));
    sub.textContent = `${Math.round(st.h)} m`;
    await life.sleep(30);
  }
  st.burning = false;
  st.flame = 0;
  status.textContent = 'Süzülüyor...';
  while (st.v > 0 && stage.scene === gameScene) await life.sleep(60);
  if (stage.scene !== gameScene) return null;
  st.done = true;
  const height = Math.round(st.h);
  sfx.ding();
  if (height < 5) return { score: 0, title: 'Kalkamadı!', big: 0, unit: 'm', detail: 'Ses gelmedi. "Bağır!" yazınca yüksek sesle "aaa" de.' };
  return {
    score: height,
    title: height >= 1500 ? 'Uzaya Çıktı!' : height >= 600 ? 'Bulutların Üstünde!' : 'Güzel Kalkış!',
    big: height,
    unit: 'metre',
    detail: `En güçlü an: %${Math.min(100, Math.round(peak * 250))} ses.`,
  };
}

function draw(sc, st, p, t) {
  const { g, W, H } = sc;
  // Gökyüzü yüksekliğe göre koyulaşır, yıldızlar çıkar
  const sky = Math.min(1, st.h / 2000);
  g.fillStyle = `rgba(42,22,54,${sky * 0.55})`;
  g.fillRect(0, 0, W, H);
  if (sky > 0.3) {
    for (const s of st.stars) {
      const y = ((s.y * H + st.h * 0.4) % (H * 1.2)) - H * 0.1;
      g.globalAlpha = sky;
      g.fillStyle = '#fff';
      g.fillRect(s.x * W, y, s.s, s.s);
    }
    g.globalAlpha = 1;
  }
  // Bulutlar aşağı akar
  for (let k = 0; k < 4; k++) {
    const y = ((k * 260 + st.h * 0.8) % (H + 300)) - 150;
    const x = ((k * 0.31 + 0.12) % 1) * W;
    g.globalAlpha = 0.8 * (1 - sky);
    g.beginPath();
    g.arc(x, y, 40, 0, Math.PI * 2);
    g.arc(x + 45, y + 10, 32, 0, Math.PI * 2);
    g.arc(x - 40, y + 12, 28, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.globalAlpha = 1;
  }
  // Yer: roket kalkınca aşağı kayar
  const gy = H * 0.86 + st.h * 1.5;
  if (gy < H + 40) {
    g.fillStyle = '#8fe3b0';
    g.fillRect(0, gy, W, H - gy + 40);
    g.lineWidth = 4;
    g.strokeStyle = '#2a1636';
    g.beginPath();
    g.moveTo(0, gy);
    g.lineTo(W, gy);
    g.stroke();
  }
  const rx = W / 2;
  const ry = Math.min(gy, H * 0.86) - 20 - Math.min(H * 0.35, st.h * 0.6);
  const s = Math.min(W, H) * 0.06;
  if (st.flame > 0.02) {
    const f = st.flame * (0.8 + 0.2 * Math.sin(t / 30));
    g.beginPath();
    g.moveTo(rx - s * 0.5, ry + s * 1.2);
    g.quadraticCurveTo(rx, ry + s * (1.4 + f * 2.6), rx + s * 0.5, ry + s * 1.2);
    inked(g, '#ffcd3c', 3);
    g.beginPath();
    g.moveTo(rx - s * 0.28, ry + s * 1.2);
    g.quadraticCurveTo(rx, ry + s * (1.3 + f * 1.6), rx + s * 0.28, ry + s * 1.2);
    g.fillStyle = '#ff4f1f';
    g.fill();
  }
  g.beginPath();
  g.moveTo(rx, ry - s * 1.6);
  g.quadraticCurveTo(rx + s * 0.8, ry - s * 0.8, rx + s * 0.6, ry + s * 1.2);
  g.lineTo(rx - s * 0.6, ry + s * 1.2);
  g.quadraticCurveTo(rx - s * 0.8, ry - s * 0.8, rx, ry - s * 1.6);
  inked(g, '#fffcf6', 4);
  g.beginPath();
  g.arc(rx, ry - s * 0.3, s * 0.32, 0, Math.PI * 2);
  inked(g, PCOL[p], 3);
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(rx + d * s * 0.55, ry + s * 0.5);
    g.lineTo(rx + d * s * 1.05, ry + s * 1.35);
    g.lineTo(rx + d * s * 0.55, ry + s * 1.2);
    inked(g, PCOL[p], 3);
  }
  roundRect(g, 24, H * 0.2, 26, H * 0.6, 13);
  g.fillStyle = '#fffcf6';
  g.fill();
  const fh = H * 0.6 * Math.min(1, st.flame / 1.4);
  roundRect(g, 24, H * 0.8 - fh, 26, fh, 13);
  g.fillStyle = st.flame > 1 ? '#ff4f1f' : '#ffcd3c';
  g.fill();
  roundRect(g, 24, H * 0.2, 26, H * 0.6, 13);
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.stroke();
  tag(g, W / 2, 46, `${Math.round(st.h)} m`, PCOL[p], 26);
}
