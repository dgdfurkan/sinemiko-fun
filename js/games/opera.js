// Opera Düellosu: sesinin genişliği ölçülür. Önce inebildiğin en kalın sese in, sonra çıkabildiğin en ince sese çık.
// İkisinin arası kaç nota ise o kadar puan. Opera sanatçısı blob her notada biraz daha coşar

import { html, clamp } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { hzToMidi, noteName } from '../audio/listen.js';
import { voiceDuel, inked, PCOL, tag, roundRect } from './voicearena.js';

const PHASE_MS = 5000;
const HOLD_MS = 400;

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-opera',
    rules: [
      'Önce inebildiğin en kalın sese in ve bir an tut.',
      'Sonra çıkabildiğin en ince sese çık ve bir an tut. Bağırmak gerekmez, perde önemli.',
      'İki sesin arası kaç nota ise o kadar puan. Sesi daha geniş olan kazanır.',
    ],
    introText: () => 'Önce kalın, sonra ince. Her sesi en az yarım saniye tutmalısın ki sayılsın.',
    turn,
    fmt: (v) => `${Math.round(v)} nota`,
    recordKey: 'opera',
  });
}

// Bir yönde uç noktayı bulur: dir -1 en kalın, +1 en ince; kısa süre tutulan sesler sayılmaz
async function extreme(ctx, st, dir) {
  const { mic, life } = ctx;
  const t0 = performance.now();
  const buf = [];
  let best = null;
  let voicedAt = 0;
  while (performance.now() - t0 < PHASE_MS) {
    const now = performance.now();
    const { hz, clarity } = mic.pitch();
    if (hz && clarity > 0.78) {
      const m = hzToMidi(hz);
      buf.push({ m, t: now });
      st.live = m;
      voicedAt = now;
    } else if (now - voicedAt > 160) {
      // Kısa kesintiler sayılmaz; ses gerçekten bitince tutma sıfırlanır
      st.live = null;
      buf.length = 0;
    }
    while (buf.length && now - buf[0].t > HOLD_MS) buf.shift();
    if (buf.length > 6 && now - buf[0].t > HOLD_MS * 0.8) {
      const ms = buf.map((q) => q.m).sort((a, b) => a - b);
      const med = ms[Math.floor(ms.length / 2)];
      if (ms[ms.length - 1] - ms[0] < 1.2 && (best == null || (dir < 0 ? med < best : med > best))) {
        best = med;
        st.best[dir < 0 ? 0 : 1] = best;
        sfx.note(Math.round(med), 0.15, { vol: 0.05 });
      }
    }
    await life.sleep(25);
  }
  st.live = null;
  return best;
}

async function turn(ctx, p) {
  const { life, stage } = ctx;
  const sc = ctx.playScene(html`
    <div class="va-top"><p class="va-status t-big" data-status>Şşş...</p><p class="va-sub" data-sub></p></div>`);
  const status = sc.scene.querySelector('[data-status]');
  const sub = sc.scene.querySelector('[data-sub]');
  const gameScene = sc.scene;
  const st = { live: null, best: [null, null], phase: 'hush' };
  ctx.st = st;
  sc.loop((dt, t) => draw(sc, st, p, t));
  await ctx.hush(600);
  st.phase = 'low';
  status.textContent = 'En Kalın Sesin';
  sub.textContent = '"Ooo" diye aşağı in, en dipte tut.';
  sfx.go();
  const lo = await extreme(ctx, st, -1);
  if (stage.scene !== gameScene) return null;
  st.phase = 'high';
  status.textContent = 'En İnce Sesin';
  sub.textContent = '"İii" diye yukarı çık, en tepede tut.';
  sfx.go();
  const hi = await extreme(ctx, st, 1);
  if (stage.scene !== gameScene) return null;
  st.phase = 'done';
  if (lo == null || hi == null) return { score: 0, title: 'Ses Duymadım', big: 0, unit: 'nota', detail: 'Mikrofona yakın, sesini bir an sabit tutarak dene.' };
  const range = Math.max(0, Math.round(hi - lo));
  status.textContent = `${range} Nota!`;
  await life.sleep(900);
  return {
    score: range,
    title: range >= 24 ? 'Opera Yıldızı!' : range >= 15 ? 'Geniş Bir Ses!' : 'Güzel Deneme!',
    big: range,
    unit: 'nota',
    detail: `${noteName(lo)} notasından ${noteName(hi)} notasına, yaklaşık ${(range / 12).toFixed(1).replace('.', ',')} oktav.`,
  };
}

function draw(sc, st, p, t) {
  const { g, W, H } = sc;
  // Dikey nota merdiveni: 36 ile 84 arası (kalın erkek sesinden tiz kadın sesine)
  const lo = 36;
  const hi = 84;
  const x = W / 2;
  const top = H * 0.2;
  const bot = H * 0.92;
  const yOf = (m) => bot - ((clamp(m, lo, hi) - lo) / (hi - lo)) * (bot - top);
  for (let m = lo; m <= hi; m += 1) {
    const y = yOf(m);
    const c = m % 12 === 0;
    g.fillStyle = c ? '#2a163655' : '#2a163622';
    g.fillRect(x - (c ? 120 : 80), y - 1, c ? 240 : 160, c ? 3 : 2);
  }
  const [a, b] = st.best;
  if (a != null && b != null) {
    roundRect(g, x - 90, yOf(b), 180, yOf(a) - yOf(b), 18);
    g.fillStyle = `${PCOL[p]}55`;
    g.fill();
  }
  for (const v of st.best) {
    if (v == null) continue;
    tag(g, x + 170, yOf(v), noteName(v), PCOL[p], 16);
  }
  if (st.live != null) {
    const y = yOf(st.live);
    const s = 34 + Math.sin(t / 70) * 3;
    g.beginPath();
    g.ellipse(x, y, s, s * 0.9, 0, 0, Math.PI * 2);
    inked(g, PCOL[p], 4);
    g.beginPath();
    g.ellipse(x, y + s * 0.25, s * 0.3, s * 0.38, 0, 0, Math.PI * 2);
    g.fillStyle = '#2a1636';
    g.fill();
    g.beginPath();
    g.arc(x - s * 0.35, y - s * 0.25, s * 0.1, 0, Math.PI * 2);
    g.arc(x + s * 0.35, y - s * 0.25, s * 0.1, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 3; k++) {
      const nx = x + 70 + k * 26;
      const ny = y - 30 - ((t / 8 + k * 20) % 60);
      g.font = '400 26px sans-serif';
      g.fillText('♪', nx, ny);
    }
  }
  return true;
}
