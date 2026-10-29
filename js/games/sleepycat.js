// Kedi Uyuyor: gizli kelimeyi partnerine fısıldayarak anlat ama ekrandaki kedi uyanmasın.
// Mikrofon sesini dinler; fazla yüksek konuşursan kedi uyanır, tur yanar. Ne kadar sessiz anlatırsan o kadar puan

import { html, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../audio/sfx.js';
import { voiceDuel, inked, tag, roundRect } from './voicearena.js';
import { pSpan } from './common.js';

const WHISPER_MS = 9000;
const WORDS = [
  'Penguen', 'Dondurma', 'Gökkuşağı', 'Şemsiye', 'Kaplumbağa', 'Pamuk Şeker', 'Uçurtma', 'Ayakkabı', 'Patlamış Mısır', 'Zürafa',
  'Deniz Feneri', 'Bisiklet', 'Kurabiye', 'Kar Tanesi', 'Ahtapot', 'Balon', 'Yastık', 'Çikolata', 'Kelebek', 'Çaydanlık',
  'Lunapark', 'Mısır', 'Karpuz', 'Kanepe', 'Sincap', 'Trambolin', 'Yıldız', 'Gözlük', 'Pizza', 'Gitar',
  'Kirpi', 'Limon', 'Muz', 'Tavşan', 'Bulut', 'Çilek', 'Saksı', 'Aspirin', 'Dinozor', 'Kumsal',
  'Hamak', 'Bal Arısı', 'Hamburger', 'Sakız', 'Pijama', 'Yorgan', 'Kahve', 'Termos', 'Fotoğraf', 'Ayna',
  'Vapur', 'Simit', 'Martı', 'Çorap', 'Kaktüs', 'Çaylak', 'Tarçın', 'Robot', 'Kamp Ateşi', 'Uzay Gemisi',
];

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-sleepycat',
    rules: [
      'Anlatacak kişi gizli kelimeye bakar; partneri bakmaz.',
      'Sonra kelimeyi partnerinin kulağına fısıldar. Ekrandaki kedi uyuyor: ses yükselirse uyanır ve tur yanar!',
      'Partner doğru bilirse anlatan puan alır: ne kadar sessiz anlattıysa o kadar, en fazla 3.',
    ],
    introText: (ctx, p) => html`${pSpan(1 - p)} gözlerini kapatsın. ${nameOf(p)} gizli kelimeye bakacak, sonra kulağına fısıldayacak.`,
    turn,
    scoring: 'sum',
    fmt: (v) => String(Math.round(v)),
  });
}

async function turn(ctx, p) {
  const { mic, life, stage } = ctx;
  const g2 = 1 - p;
  const word = pick(WORDS);
  // Kelime yalnızca anlatana gösterilir
  await new Promise((resolve) => {
    stage.show(html`
      <div class="sc-card card" data-in>
        <p class="t-lead">${nameOf(g2)} bakmıyor mu?</p>
        <button class="btn btn--primary btn--big" data-act="show" data-primary data-once>${icon('lock')}Kelimeyi Göster</button>
      </div>`, { show: () => resolve() });
  });
  await new Promise((resolve) => {
    stage.show(html`
      <div class="sc-card card" data-in>
        <p class="t-lead">Gizli kelime</p>
        <p class="sc-word">${word}</p>
        <button class="btn btn--primary btn--big" data-act="go" data-primary data-once>${icon('check')}Ezberledim</button>
      </div>`, { go: () => resolve() });
  });
  const sc = ctx.playScene(html`
    <div class="va-top"><p class="va-status t-big" data-status>Şşş...</p><p class="va-sub" data-sub>Kedi uyuyor.</p></div>
    <div class="va-bottom"><button class="btn btn--primary" data-act="done" data-once>${icon('check')}Fısıldadım</button></div>`, {
    done: () => { st.stop = true; },
  });
  const status = sc.scene.querySelector('[data-status]');
  const sub = sc.scene.querySelector('[data-sub]');
  const gameScene = sc.scene;
  const st = { lv: 0, peak: 0, awake: 0, stop: false, zz: 0, quiet: 0.016, mid: 0.03, wake: 0.06 };
  ctx.st = st;
  sc.loop((dt, t) => draw(sc, st, t));
  await ctx.hush(700);
  if (stage.scene !== gameScene) return null;
  const n = mic.noise || 0.004;
  st.quiet = Math.max(0.016, n * 3);
  st.mid = Math.max(0.03, n * 6);
  st.wake = Math.max(0.06, n * 11);
  status.textContent = 'Fısılda!';
  sub.textContent = `${nameOf(g2)}, kulağını yaklaştır.`;
  sfx.soft();
  const t0 = performance.now();
  // Fısıltının ilk anındaki hışırtı sayılmasın: kısa ortalama
  let avg = 0;
  while (performance.now() - t0 < WHISPER_MS && !st.stop) {
    const lv = mic.level();
    avg += (lv - avg) * 0.35;
    st.lv = avg;
    st.peak = Math.max(st.peak, avg);
    if (avg > st.wake) {
      st.awake = performance.now();
      break;
    }
    await life.sleep(30);
  }
  if (stage.scene !== gameScene) return null;
  if (st.awake) {
    status.textContent = 'Kedi Uyandı!';
    sub.textContent = 'Çok yüksek sesle konuştun.';
    sfx.error();
    sfx.boing();
    await life.sleep(1800);
    return { score: 0, title: 'Kedi Uyandı!', big: 0, unit: 'puan', detail: `Kelime "${word}" idi. Bir dahaki sefere daha sessiz.` };
  }
  sfx.ding();
  const ok = await new Promise((resolve) => {
    stage.show(html`
      <div class="sc-card card" data-in>
        <p class="t-lead">${nameOf(g2)}, tahminini söyle!</p>
        <p class="sc-word">${word}</p>
        <div class="row">
          <button class="btn" data-act="no" data-once>${icon('x')}Bilemedi</button>
          <button class="btn btn--primary" data-act="yes" data-primary data-once>${icon('check')}Doğru Bildi</button>
        </div>
      </div>`, { yes: () => resolve(true), no: () => resolve(false) });
  });
  if (!ok) return { score: 0, title: 'Bilemedi', big: 0, unit: 'puan', detail: `Kelime "${word}" idi.` };
  const pts = st.peak < st.quiet ? 3 : st.peak < st.mid ? 2 : 1;
  return {
    score: pts,
    title: pts === 3 ? 'Fısıltı Ustası!' : pts === 2 ? 'Sessiz ve Derinden' : 'Kedi Kıl Payı Uyanmadı',
    big: pts,
    unit: 'puan',
    detail: `"${word}" kelimesini ${nameOf(g2)} bildi.`,
  };
}

function draw(sc, st, t) {
  const { g, W, H } = sc;
  const cx = W / 2;
  const cy = H * 0.58;
  const s = Math.min(W, H) * 0.16;
  const awake = !!st.awake;
  // Yastık
  roundRect(g, cx - s * 1.6, cy + s * 0.35, s * 3.2, s * 0.7, s * 0.35);
  inked(g, '#c9b6ff', 4);
  // Kedi gövdesi ve kuyruk
  g.beginPath();
  g.ellipse(cx + s * 0.2, cy + s * 0.15, s * 1.05, s * 0.55, 0, 0, Math.PI * 2);
  inked(g, '#ffb36b', 4);
  g.beginPath();
  g.moveTo(cx + s * 1.1, cy + s * 0.3);
  g.quadraticCurveTo(cx + s * 1.7, cy - s * 0.2 + Math.sin(t / 400) * 6, cx + s * 1.4, cy - s * 0.5);
  g.lineWidth = s * 0.2;
  g.lineCap = 'round';
  g.strokeStyle = '#2a1636';
  g.stroke();
  g.lineWidth = s * 0.13;
  g.strokeStyle = '#ffb36b';
  g.stroke();
  // Kafa
  const hy = cy - s * 0.15 - (awake ? s * 0.25 : 0);
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx - s * 0.75 + d * s * 0.3, hy - s * 0.3);
    g.lineTo(cx - s * 0.75 + d * s * 0.45, hy - s * 0.85);
    g.lineTo(cx - s * 0.75 + d * s * 0.05, hy - s * 0.45);
    inked(g, '#ffb36b', 3.5);
  }
  g.beginPath();
  g.ellipse(cx - s * 0.75, hy, s * 0.6, s * 0.5, 0, 0, Math.PI * 2);
  inked(g, '#ffb36b', 4);
  g.lineWidth = 3.5;
  g.strokeStyle = '#2a1636';
  if (awake) {
    for (const d of [-1, 1]) {
      g.beginPath();
      g.arc(cx - s * 0.75 + d * s * 0.22, hy - s * 0.05, s * 0.13, 0, Math.PI * 2);
      inked(g, '#fff', 3);
      g.beginPath();
      g.arc(cx - s * 0.75 + d * s * 0.22, hy - s * 0.05, s * 0.06, 0, Math.PI * 2);
      g.fillStyle = '#2a1636';
      g.fill();
    }
    tag(g, cx - s * 0.75, hy - s * 1.2, 'MİYAV!', '#ff4f62', 26);
  } else {
    for (const d of [-1, 1]) {
      g.beginPath();
      g.arc(cx - s * 0.75 + d * s * 0.22, hy - s * 0.05, s * 0.11, 0.2, Math.PI - 0.2);
      g.stroke();
    }
    // Uyku harfleri
    for (let k = 0; k < 3; k++) {
      const a = ((t / 1400 + k / 3) % 1);
      g.globalAlpha = 1 - a;
      g.font = `400 ${Math.round(s * (0.22 + k * 0.06))}px "Lilita One", sans-serif`;
      g.fillStyle = '#7a5cff';
      g.fillText('z', cx - s * 0.3 + a * s * 0.6 + k * 10, hy - s * 0.6 - a * s);
    }
    g.globalAlpha = 1;
  }
  g.beginPath();
  g.ellipse(cx - s * 0.75, hy + s * 0.15, s * 0.07, s * 0.05, 0, 0, Math.PI * 2);
  g.fillStyle = '#ff7fae';
  g.fill();
  // Ses ölçer: yeşil sessiz, sarı dikkat, kırmızı uyandırır
  const mw = Math.min(W * 0.6, 520);
  const mx = cx - mw / 2;
  const my = H * 0.88;
  roundRect(g, mx, my, mw, 22, 11);
  g.fillStyle = '#fffcf6';
  g.fill();
  const k = Math.min(1, st.lv / st.wake);
  roundRect(g, mx, my, mw * k, 22, 11);
  g.fillStyle = st.lv < st.quiet ? '#2ed6a0' : st.lv < st.mid ? '#ffcd3c' : '#ff4f62';
  g.fill();
  roundRect(g, mx, my, mw, 22, 11);
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.stroke();
  for (const v of [st.quiet, st.mid]) {
    const x = mx + mw * Math.min(1, v / st.wake);
    g.beginPath();
    g.moveTo(x, my - 4);
    g.lineTo(x, my + 26);
    g.stroke();
  }
  return true;
}
