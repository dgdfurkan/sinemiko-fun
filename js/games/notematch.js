// Notayı Tut: bir nota çalar, sen aynı notayı "aaa" diye söylersin. Ne kadar tutturursan o kadar puan.
// Oktav önemli değil: kalın sesle de ince sesle de aynı nota sayılır. Her turda beş nota

import { html, randInt, clamp } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { hzToMidi, noteName } from '../audio/listen.js';
import { voiceDuel, inked, PCOL, tag, roundRect } from './voicearena.js';

const NOTES = 5;
const LISTEN_MS = 4500;
const STABLE_MS = 650;

// Hedefe göre en yakın oktavdaki sapma, yarım ses cinsinden
const offset = (m, target) => {
  let d = (m - target) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
};

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-notematch',
    rules: [
      'Bir nota çalar. Duyduğun notayı "aaa" diye söyle ve bir an sabit tut.',
      'Ne kadar tutturursan o kadar puan: tam isabet 100. Kalın ya da ince söylemen fark etmez.',
      'Her turda beş nota. Toplam puanı yüksek olan kazanır.',
    ],
    introText: () => 'Notayı dinle, sonra aynı notayı söyle. Ekrandaki ibre çizgiye ne kadar yakınsa o kadar iyi.',
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
  const st = { target: 60, live: null, k: 0, phase: 'hush', results: [], hold: 0, lockAt: 0 };
  ctx.st = st;
  sc.loop((dt, t) => draw(sc, st, p, t));
  await ctx.hush(600);
  let total = 0;
  for (let k = 0; k < NOTES; k++) {
    if (stage.scene !== gameScene) return null;
    st.k = k;
    st.target = randInt(57, 69);
    st.phase = 'play';
    st.live = null;
    status.textContent = `${k + 1}. Nota: ${noteName(st.target)}`;
    sub.textContent = 'Dinle...';
    sfx.note(st.target, 1.2, { vol: 0.2 });
    await life.sleep(1350);
    st.phase = 'sing';
    sub.textContent = 'Şimdi sen söyle!';
    const t0 = performance.now();
    const buf = [];
    let got = null;
    while (performance.now() - t0 < LISTEN_MS) {
      const { hz, clarity } = mic.pitch();
      const now = performance.now();
      if (hz && clarity > 0.8) {
        const m = hzToMidi(hz);
        buf.push({ m, t: now });
        st.live = m;
      } else st.live = null;
      while (buf.length && now - buf[0].t > STABLE_MS) buf.shift();
      // Son anlarda perde sabitse ölçüm alınır
      if (buf.length > 10 && now - buf[0].t > STABLE_MS * 0.85) {
        const ms = buf.map((q) => offset(q.m, st.target));
        const mean = ms.reduce((s, x) => s + x, 0) / ms.length;
        const sd = Math.sqrt(ms.reduce((s, x) => s + (x - mean) * (x - mean), 0) / ms.length);
        if (sd < 0.45) {
          got = mean;
          break;
        }
      }
      await life.sleep(25);
    }
    if (stage.scene !== gameScene) return null;
    const pts = got == null ? 0 : Math.max(0, Math.round(100 - Math.abs(got) * 85));
    total += pts;
    st.results.push({ off: got, pts });
    st.phase = 'result';
    status.textContent = got == null ? 'Duyamadım' : pts >= 85 ? 'Tam İsabet!' : pts >= 55 ? 'Çok Yakın!' : got > 0 ? 'Biraz Tiz' : 'Biraz Pes';
    sub.textContent = `+${pts}`;
    if (pts >= 85) sfx.success();
    else if (pts > 0) sfx.ding();
    else sfx.boing();
    await life.sleep(1100);
  }
  return {
    score: total,
    title: total >= 400 ? 'Kulağın Mükemmel!' : total >= 250 ? 'Güzel Kulak!' : 'Bir Dahakine!',
    big: total,
    unit: 'puan',
    detail: st.results.map((r, k) => `${k + 1}. nota ${r.pts}`).join(' · '),
  };
}

function draw(sc, st, p, t) {
  const { g, W, H } = sc;
  // Akort göstergesi: ortadaki çizgi hedef nota, ibre senin sesin (bir yarım ses yukarı ve aşağı)
  const cx = W / 2;
  const cy = H * 0.6;
  const w = Math.min(W * 0.7, 700);
  const h = 120;
  roundRect(g, cx - w / 2, cy - h / 2, w, h, 26);
  inked(g, '#fffcf6', 4);
  for (let k = -4; k <= 4; k++) {
    const x = cx + (k / 4) * (w / 2 - 30);
    g.beginPath();
    g.moveTo(x, cy - (k ? 18 : 40));
    g.lineTo(x, cy + (k ? 18 : 40));
    g.lineWidth = k ? 3 : 6;
    g.strokeStyle = k ? '#2a163655' : '#2ed6a0';
    g.stroke();
  }
  if (st.phase === 'sing' && st.live != null) {
    const off = clamp(offset(st.live, st.target), -1, 1);
    const x = cx + off * (w / 2 - 30);
    g.beginPath();
    g.arc(x, cy, 26 + Math.sin(t / 80) * 2, 0, Math.PI * 2);
    inked(g, Math.abs(off) < 0.15 ? '#2ed6a0' : PCOL[p], 4);
  }
  if (st.phase === 'play') {
    for (let k = 0; k < 3; k++) {
      const r = 30 + ((t / 8 + k * 40) % 120);
      g.globalAlpha = 1 - (r - 30) / 120;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.lineWidth = 4;
      g.strokeStyle = PCOL[p];
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  tag(g, cx - w / 2 + 50, cy + h / 2 + 30, 'Pes', '#a99cb3', 16);
  tag(g, cx + w / 2 - 50, cy + h / 2 + 30, 'Tiz', '#a99cb3', 16);
  // Notaların sonuçları
  for (let k = 0; k < NOTES; k++) {
    const r = st.results[k];
    const x = cx + (k - 2) * 70;
    const y = H * 0.85;
    g.beginPath();
    g.arc(x, y, 24, 0, Math.PI * 2);
    inked(g, r ? (r.pts >= 85 ? '#2ed6a0' : r.pts >= 55 ? '#ffcd3c' : r.pts > 0 ? '#ff9f1c' : '#e6dcd0') : k === st.k ? PCOL[p] : '#fff', 3);
    g.font = '400 18px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a1636';
    g.fillText(r ? String(r.pts) : String(k + 1), x, y + 1);
  }
  return true;
}
