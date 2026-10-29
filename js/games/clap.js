// Alkış Ritmi: önce ritmi dinle, sonra aynısını alkışla. Alkışların arasındaki boşluklar
// ritimle ne kadar örtüşürse o kadar puan. Her turda üç ritim, giderek zorlaşır

import { html, pick } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { voiceDuel, inked, PCOL, tag } from './voicearena.js';

const BEAT = 0.42;
// Vuruş zamanları (vuruş cinsinden); kolaydan zora
const PATTERNS = [
  [[0, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 0.5, 1, 2, 3]],
  [[0, 1, 1.5, 2, 3], [0, 0.5, 1.5, 2, 3], [0, 1, 1.5, 2.5, 3]],
  [[0, 0.5, 1, 1.5, 2.5, 3], [0, 0.75, 1.5, 2, 2.5, 3.5], [0, 0.5, 1.5, 2, 2.75, 3.5]],
];

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-clap',
    rules: [
      'Önce ritmi dinle: noktalar yanıp söner. Sonra aynı ritmi ellerinle alkışla.',
      'İlk alkışın ritmin başı sayılır; aradaki boşluklar ne kadar doğruysa o kadar puan.',
      'Her turda üç ritim, giderek zorlaşır. Toplam puanı yüksek olan kazanır.',
    ],
    introText: () => 'Sessiz bir ortamda, mikrofona yakın alkışla. Önce ritmi dinle, "Sıra sende!" yazınca alkışla.',
    turn,
    scoring: 'sum',
    fmt: (v) => String(Math.round(v)),
  });
}

async function turn(ctx, p) {
  const { mic, life, stage } = ctx;
  const sc = ctx.playScene(html`
    <div class="va-top"><p class="va-status t-big" data-status>Şşş...</p><p class="va-sub" data-sub></p></div>`);
  const status = sc.scene.querySelector('[data-status]');
  const sub = sc.scene.querySelector('[data-sub]');
  const gameScene = sc.scene;
  const st = { pat: [], lit: -1, claps: [], phase: 'hush', score: null };
  ctx.st = st;
  sc.loop((dt, t) => draw(sc, st, p, t));
  await ctx.hush(700);
  let total = 0;
  const scores = [];
  for (let r = 0; r < 3; r++) {
    if (stage.scene !== gameScene) return null;
    st.pat = pick(PATTERNS[r]);
    st.claps = [];
    st.score = null;
    st.phase = 'listen';
    status.textContent = `${r + 1}. Ritim`;
    sub.textContent = 'Dinle...';
    await life.sleep(500);
    st.pat.forEach((b, k) => {
      sfx.clap(b * BEAT);
      life.timeout(() => { st.lit = k; }, b * BEAT * 1000);
    });
    await life.sleep(st.pat[st.pat.length - 1] * BEAT * 1000 + 600);
    st.lit = -1;
    st.phase = 'go';
    status.textContent = 'Sıra Sende!';
    sub.textContent = 'Aynı ritmi alkışla.';
    sfx.soft();
    // Alkışlar: ilk alkıştan sonra ritim süresi kadar dinlenir
    const tStart = performance.now();
    let first = 0;
    const span = st.pat[st.pat.length - 1] * BEAT * 1000;
    while (performance.now() - tStart < 6000) {
      const now = performance.now();
      if (mic.onset(130)) {
        if (!first) first = now;
        st.claps.push((now - first) / 1000);
        sfx.pop(0.6);
      }
      if (first && now - first > span + 900) break;
      await life.sleep(10);
    }
    if (stage.scene !== gameScene) return null;
    const s = grade(st.pat.map((b) => b * BEAT), st.claps);
    st.score = s;
    scores.push(s);
    total += s;
    st.phase = 'result';
    status.textContent = s >= 85 ? 'Tam Ritim!' : s >= 60 ? 'Güzel!' : st.claps.length ? 'Ritim Kaçtı' : 'Alkış Duymadım';
    sub.textContent = `+${s}`;
    if (s >= 85) sfx.success();
    else if (s > 0) sfx.ding();
    else sfx.boing();
    await life.sleep(1300);
  }
  return {
    score: total,
    title: total >= 240 ? 'Davulcu Gibisin!' : total >= 150 ? 'İyi Ritim!' : 'Bir Daha Dene!',
    big: total,
    unit: 'puan',
    detail: scores.map((s, k) => `${k + 1}. ritim ${s}`).join(' · '),
  };
}

// Puan 0-100: alkış sayısı tutuyor mu, her alkış beklenen anda mı
function grade(want, got) {
  if (!got.length) return 0;
  let err = 0;
  const used = new Set();
  for (const w of want) {
    let best = -1;
    let bd = 1;
    got.forEach((g, k) => {
      if (used.has(k)) return;
      const d = Math.abs(g - w);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best >= 0 && bd < 0.3) {
      used.add(best);
      err += bd / 0.3;
    } else err += 1.4;
  }
  const extra = got.length - used.size;
  err += extra * 0.8;
  return Math.max(0, Math.round(100 * (1 - err / want.length)));
}

function draw(sc, st, p, t) {
  const { g, W, H } = sc;
  const n = st.pat.length;
  const span = n ? st.pat[n - 1] : 1;
  const x0 = W * 0.18;
  const x1 = W * 0.82;
  const y = H * 0.55;
  g.beginPath();
  g.moveTo(x0 - 30, y);
  g.lineTo(x1 + 30, y);
  g.lineWidth = 6;
  g.strokeStyle = '#2a163633';
  g.stroke();
  st.pat.forEach((b, k) => {
    const x = x0 + (b / span) * (x1 - x0);
    const lit = st.lit === k;
    g.beginPath();
    g.arc(x, y, lit ? 34 : 24, 0, Math.PI * 2);
    inked(g, lit ? '#ffcd3c' : '#fffcf6', 4);
  });
  // Senin alkışların: ilk alkış ritmin başına hizalanır
  st.claps.forEach((c) => {
    const x = x0 + ((c / BEAT) / span) * (x1 - x0);
    if (x > x1 + 120) return;
    g.beginPath();
    g.arc(x, y + 70, 16, 0, Math.PI * 2);
    inked(g, PCOL[p], 3);
  });
  if (st.phase === 'go') {
    const k = 0.5 + 0.5 * Math.sin(t / 120);
    tag(g, W / 2, H * 0.82, '👏 Alkışla!', PCOL[p], 24 + k * 4);
  }
  return true;
}
