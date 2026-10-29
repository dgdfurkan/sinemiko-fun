// Sesle Uç: kuşun yüksekliği sesinin inceliğine bağlı. İnce ses yükseltir, kalın ses alçaltır,
// susunca süzülerek düşer. Kapılardan geçtikçe puan; duvara çarpınca tur biter. Sırayla oynanır

import { html, rand, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { sfx } from '../audio/sfx.js';
import { hzToMidi } from '../audio/listen.js';
import { voiceDuel, inked, PCOL, tag } from './voicearena.js';

export function mount(view, opts) {
  return voiceDuel(view, opts, {
    cls: 'game-voicefly',
    rules: [
      'Sırası gelen önce en kalın ve en ince sesini bir kez söyler; kuş senin sesine ayarlanır.',
      'Sonra kuş uçmaya başlar: ince ses kuşu yükseltir, kalın ses alçaltır, susarsan süzülerek düşer.',
      'Kapıların arasından geç. Duvara ya da yere çarpınca tur biter. En çok kapıdan geçen kazanır.',
    ],
    introText: (ctx, p) => (ctx.m.cal[p] ? 'Hazır olunca başla. "Ooo" ya da "mmm" diye ses çıkararak kuşu yönet.' : 'Önce kalın sesini, sonra ince sesini söyleyeceksin. Mikrofona yakın otur.'),
    setup: (ctx) => { ctx.m.cal = [null, null]; },
    turn,
    fmt: (v) => String(Math.round(v)),
    recordKey: 'voicefly',
  });
}

// Kalın ve ince ses ölçümü: perde kararlı olduğu anların medyanı
async function measure(ctx, sc, label, ms) {
  const { mic, life } = ctx;
  const got = [];
  const t0 = performance.now();
  sc.status.textContent = label;
  while (performance.now() - t0 < ms) {
    const { hz, clarity } = mic.pitch();
    if (hz && clarity > 0.75) got.push(hzToMidi(hz));
    await life.sleep(30);
  }
  got.sort((a, b) => a - b);
  return got.length > 6 ? got[Math.floor(got.length / 2)] : null;
}

async function turn(ctx, p) {
  const { mic, life, stage } = ctx;
  const sc = ctx.playScene(html`
    <div class="va-top"><p class="va-status t-big" data-status>Şşş...</p><p class="va-sub" data-sub></p></div>`);
  sc.status = sc.scene.querySelector('[data-status]');
  sc.sub = sc.scene.querySelector('[data-sub]');
  const gameScene = sc.scene;
  await ctx.hush(600);
  if (stage.scene !== gameScene) return null;
  let cal = ctx.m.cal[p];
  if (!cal) {
    sc.sub.textContent = 'Bir saniye boyunca rahat, kalın bir "ooo".';
    const lo = await measure(ctx, sc, 'Kalın Sesin', 1800);
    sc.sub.textContent = 'Şimdi rahat, ince bir "iii".';
    const hi = await measure(ctx, sc, 'İnce Sesin', 1800);
    if (stage.scene !== gameScene) return null;
    if (lo == null || hi == null || hi - lo < 3) {
      cal = { lo: (lo ?? 52) - 1, hi: (lo ?? 52) + 9 };
      sc.sub.textContent = 'Aralık dar çıktı, standart ayara geçtim.';
    } else cal = { lo: lo - 0.5, hi: hi + 0.5 };
    ctx.m.cal[p] = cal;
  }
  sc.status.textContent = 'Uç!';
  sc.sub.textContent = 'İnce ses: yukarı. Kalın ses: aşağı. Sessizlik: süzül.';
  sfx.go();
  const st = { y: 0.5, vy: 0, x: 0, gates: [], next: 0.6, passed: 0, over: false, trail: [], voiced: 0, t: 0, flap: 0 };
  ctx.st = st;
  return new Promise((resolve) => {
    sc.loop((dt) => {
      const { g, W, H } = sc;
      if (stage.scene !== gameScene) {
        resolve(null);
        return false;
      }
      if (!st.over) {
        st.t += dt;
        const speed = 0.16 + Math.min(0.12, st.t * 0.003);
        st.x += speed * dt;
        const { hz, clarity } = mic.pitch();
        if (hz && clarity > 0.7) {
          const m = hzToMidi(hz);
          const target = 1 - clamp((m - cal.lo) / (cal.hi - cal.lo), 0, 1);
          st.y += (target * 0.84 + 0.08 - st.y) * Math.min(1, dt * 6);
          st.vy = 0;
          st.voiced += dt;
          st.flap += dt * 14;
        } else {
          st.vy = Math.min(0.5, st.vy + 0.55 * dt);
          st.y += st.vy * dt;
        }
        if (st.x + 1.2 > st.next) {
          const gap = Math.max(0.24, 0.36 - st.passed * 0.008);
          st.gates.push({ x: st.next, c: rand(0.2 + gap / 2, 0.8 - gap / 2), gap, done: false });
          st.next += rand(0.5, 0.62);
        }
        for (const gt of st.gates) {
          const dx = gt.x - st.x;
          if (!gt.done && dx < -0.02) {
            gt.done = true;
            st.passed++;
            sfx.ding();
          }
          if (Math.abs(dx) < 0.035 && Math.abs(st.y - gt.c) > gt.gap / 2 - 0.02) st.over = 'hit';
        }
        if (st.y > 0.97) st.over = 'ground';
        if (st.over) {
          sfx.thud(1);
          sfx.boing();
          life.timeout(() => resolve({
            score: st.passed,
            title: st.passed >= 10 ? 'Kuş Gibi Uçtun!' : st.passed >= 4 ? 'Güzel Uçuş!' : 'Kısa Uçuş',
            big: st.passed,
            unit: 'kapı',
            detail: `${nameOf(p)} ${st.t.toFixed(1).replace('.', ',')} saniye havada kaldı.`,
          }), 1100);
        }
      }
      // Gökyüzü ve kapılar
      const bx = W * 0.25;
      const scale = W * 0.9;
      for (const gt of st.gates) {
        const x = bx + (gt.x - st.x) * scale;
        if (x < -80 || x > W + 80) continue;
        const top = (gt.c - gt.gap / 2) * H;
        const bot = (gt.c + gt.gap / 2) * H;
        g.fillStyle = '#2ed67a';
        g.strokeStyle = '#2a1636';
        g.lineWidth = 4;
        g.fillRect(x - 28, -10, 56, top + 10);
        g.strokeRect(x - 28, -10, 56, top + 10);
        g.fillRect(x - 28, bot, 56, H - bot + 10);
        g.strokeRect(x - 28, bot, 56, H - bot + 10);
        g.fillStyle = '#1fb862';
        g.fillRect(x - 34, top - 18, 68, 18);
        g.strokeRect(x - 34, top - 18, 68, 18);
        g.fillRect(x - 34, bot, 68, 18);
        g.strokeRect(x - 34, bot, 68, 18);
      }
      st.trail.push(st.y);
      if (st.trail.length > 40) st.trail.shift();
      g.beginPath();
      st.trail.forEach((y, k) => {
        const x = bx - (st.trail.length - k) * 4;
        if (k) g.lineTo(x, y * H);
        else g.moveTo(x, y * H);
      });
      g.lineWidth = 5;
      g.strokeStyle = `${PCOL[p]}88`;
      g.stroke();
      const by = st.y * H;
      const r = Math.min(W, H) * 0.035;
      g.beginPath();
      g.ellipse(bx, by, r * 1.2, r, 0, 0, Math.PI * 2);
      inked(g, PCOL[p], 3.5);
      g.beginPath();
      g.ellipse(bx - r * 0.4, by + r * 0.1, r * 0.6, r * (0.25 + 0.2 * Math.abs(Math.sin(st.flap))), -0.3, 0, Math.PI * 2);
      inked(g, '#fff', 2.5);
      g.beginPath();
      g.arc(bx + r * 0.5, by - r * 0.3, r * 0.28, 0, Math.PI * 2);
      inked(g, '#fff', 2);
      g.beginPath();
      g.arc(bx + r * 0.58, by - r * 0.3, r * 0.12, 0, Math.PI * 2);
      g.fillStyle = '#2a1636';
      g.fill();
      g.beginPath();
      g.moveTo(bx + r * 1.1, by);
      g.lineTo(bx + r * 1.7, by + r * 0.15);
      g.lineTo(bx + r * 1.1, by + r * 0.35);
      inked(g, '#ffcd3c', 2.5);
      tag(g, W / 2, 40, `${st.passed} kapı`, PCOL[p], 22);
      if (st.over) tag(g, W / 2, H / 2, st.over === 'ground' ? 'Yere Düştü!' : 'Çarptı!', '#ff4f62', 30);
      return true;
    });
  });
}
