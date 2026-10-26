// Kıpırdama!: ikiniz de donarsınız, ilk kıpırdayan turu kaybeder. Sonunda kaybedene ceza çıkar.
// TikTok'taki "If You Move" akımının kameralı hali: hareketi kamera ölçer, kimse itiraz edemez.

import { html, Life, pick, shuffle, clamp } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { fmtSec } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { PENALTIES } from '../data/camera.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, pSpan, flipEl } from './common.js';
import { camShell, camController, camBoot, waitPlayers, drawSkeleton, ring, tag, PCOL, albumStripHTML, downloadAlbum } from './cam.js';

// Burun, omuzlar, dirsekler, bilekler, kalçalar
const KEYS = [0, 11, 12, 13, 14, 15, 16, 23, 24];
const SETTLE_MS = 600;
const LIMIT = 0.16;
const HOLD = 0.22;
const GONE_MS = 1200;
const MAX_SEC = 60;
const TEASES = ['freeze-1', 'freeze-2', 'freeze-3', 'freeze-4', 'freeze-5', 'freeze-6', 'freeze-7'];

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-freeze');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { bestOf: '3' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Kameranın karşısına yan yana geçin, belinizden yukarısı görünsün.',
        '“Donun!” denince heykel olun. Sunucu sizi güldürüp kıpırdatmaya çalışacak.',
        'Kamera ilk kıpırdayanı yakalar, tur öbürüne yazılır. Oyunun sonunda kaybeden, kazananın cezasını çeker!',
      ],
      options: optHTML('Kaç Turda Biter', segHTML('bestOf', [['3', '3 Tur'], ['5', '5 Tur'], ['7', '7 Tur']], cfg.bestOf), 'Turların yarısından fazlasını alan kazanır.'),
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const seg = bindSeg(scene.querySelector('[data-seg="bestOf"]'), { value: cfg.bestOf, onChange: (v) => { cfg.bestOf = v; } });
    stage.own(() => seg.destroy());
  }

  function boot() {
    camBoot(stage, life, cam, 'pose', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawSkeleton(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Yan Yana Geçin',
      tip: 'Belinizden yukarısı ekranda görünsün.',
      onReady: () => play(),
    });
  }

  function play() {
    const bestOf = Number(cfg.bestOf);
    g = { round: 0, need: Math.ceil(bestOf / 2), bestOf, album: [], over: false };
    scoreboard.show({ mode: 'versus', mid: 'Tur 1' });
    announcer.preload(['freeze-go', 'moved', 'penalty', 'cd-3', 'cd-2', 'cd-1', ...TEASES]);
    round();
  }

  // Oyuncunun kilit noktaları, en boy oranı düzeltilmiş ve omuz genişliğine bölünmüş
  function points(p) {
    const lm = p.lm;
    const ar = p.ar || 16 / 9;
    const sw = Math.hypot((lm[11].x - lm[12].x) * ar, lm[11].y - lm[12].y) || 0.1;
    return { sw, pts: KEYS.map((k) => ({ x: lm[k].x * ar, y: lm[k].y, v: lm[k].v })) };
  }

  // Donma anındaki duruşa göre ortalama yer değiştirme (omuz genişliği cinsinden)
  function drift(ref, cur) {
    let sum = 0;
    let n = 0;
    cur.pts.forEach((q, k) => {
      const r = ref.pts[k];
      if (!r || r.v < 0.5 || q.v < 0.5) return;
      sum += Math.hypot(q.x - r.x, q.y - r.y);
      n++;
    });
    return n ? sum / n / ref.sw : 0;
  }

  async function round() {
    scoreboard.setMid(`Tur ${g.round + 1}`);
    const st = [0, 1].map(() => ({ ref: null, samples: [], d: 0, hold: 0 }));
    let phase = 'count';
    let t0 = 0;
    let last = 0;
    let nextTease = 0;
    let teases = shuffle(TEASES);
    const scene = stage.show(html`
      <div class="hud-top" data-in><div class="nl-clock stare-clock" data-clock>Hazır</div></div>
      <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
    const clock = scene.querySelector('[data-clock]');
    const warn = scene.querySelector('[data-warn]');
    let shown = '';

    const lose = (who, why, now) => {
      if (phase === 'done') return;
      phase = 'done';
      cam.onFrame = null;
      const sec = Math.max(0, (now - t0) / 1000);
      if (who === -1) {
        sfx.boing();
        warn.textContent = 'İkiniz aynı anda kıpırdadınız! Tur tekrar.';
        life.timeout(() => { if (stage.scene === scene) round(); }, 1700);
        return;
      }
      const p = cam.players[who];
      const img = p ? cam.snapshot(p.box, 0.1) : null;
      cam.flash();
      sfx.buzzer();
      announcer.say('moved');
      g.album.push({ img, cap: why === 'gone' ? 'Kaçtı!' : 'Kıpırdadı!', by: nameOf(who), color: PCOL[who] });
      life.timeout(() => result(who, why, sec, img), 700);
    };

    cam.onFrame = (players, now) => {
      const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
      last = now;
      if (phase === 'count') return;
      if (phase === 'settle') {
        // Donduktan sonraki ilk anlarda duruş kaydedilir; ortalaması referans olur
        players.forEach((p, i) => { if (p) st[i].samples.push(points(p)); });
        if (now - t0 >= SETTLE_MS) {
          st.forEach((s) => {
            if (!s.samples.length) return;
            const avg = s.samples[0].pts.map((_, k) => {
              const xs = s.samples.map((x) => x.pts[k]);
              return { x: xs.reduce((a, q) => a + q.x, 0) / xs.length, y: xs.reduce((a, q) => a + q.y, 0) / xs.length, v: Math.min(...xs.map((q) => q.v)) };
            });
            s.ref = { sw: s.samples.reduce((a, x) => a + x.sw, 0) / s.samples.length, pts: avg };
          });
          phase = 'freeze';
          t0 = now;
          nextTease = now + 3500;
        }
        return;
      }
      if (phase !== 'freeze') return;
      const txt = fmtSec((now - t0) / 1000).replace(' sn', '');
      if (txt !== shown) {
        shown = txt;
        clock.textContent = txt;
      }
      if (now >= nextTease) {
        if (!teases.length) teases = shuffle(TEASES);
        announcer.say(teases.pop());
        nextTease = now + 4200 + Math.random() * 2500;
      }
      const bad = [];
      [0, 1].forEach((i) => {
        const p = players[i];
        const s = st[i];
        if (!p || !s.ref) {
          if (!cam.visible(i, GONE_MS)) bad.push([i, 'gone']);
          return;
        }
        // Kısa titremeler sayılmaz: hareket bir süre sürmeli
        const d = drift(s.ref, points(p));
        s.d = s.d * 0.6 + d * 0.4;
        s.hold = s.d > LIMIT ? s.hold + dt : Math.max(0, s.hold - dt * 2);
        if (s.hold >= HOLD) bad.push([i, 'move']);
      });
      warn.textContent = [0, 1].some((i) => !players[i]) ? 'Kadrajdan çıkmak da kıpırdamak sayılır!' : '';
      if (bad.length === 2) lose(-1, '', now);
      else if (bad.length === 1) lose(bad[0][0], bad[0][1], now);
      else if ((now - t0) / 1000 >= MAX_SEC) {
        phase = 'done';
        cam.onFrame = null;
        tie();
      }
    };

    cam.draw = (gx, players) => players.forEach((p, i) => {
      if (!p) return;
      const s = st[i];
      const danger = clamp(s.d / LIMIT, 0, 1);
      const color = danger > 0.7 ? '#ff4f62' : PCOL[i];
      drawSkeleton(gx, cam, p, i, { label: '', color, glow: phase === 'freeze' ? 0.3 + danger * 0.7 : 0 });
      const lm = p.lm;
      if (lm[0].v < 0.4) return;
      const x = lm[0].x * cam.W;
      const y = lm[0].y * cam.H;
      const sw = Math.hypot((lm[11].x - lm[12].x) * cam.W, (lm[11].y - lm[12].y) * cam.H);
      const r = Math.max(26, sw * 0.42);
      if (phase === 'freeze') ring(gx, x, y, r, danger, color);
      tag(gx, x, Math.max(24, y - r - 28), phase === 'freeze' ? (danger > 0.7 ? 'Dikkat!' : 'Heykel') : nameOf(i), color);
    });

    await life.sleep(700);
    if (stage.scene !== scene) return;
    await countdown(scene, life, { final: 'Donun!', voice: 'freeze-go' });
    if (stage.scene !== scene) return;
    phase = 'settle';
    t0 = performance.now();
    clock.textContent = '0,0';
  }

  function result(loser, why, sec, img) {
    cam.draw = null;
    const winner = 1 - loser;
    const scene = stage.show(html`
      <div class="polaroid big nl-pol" data-in>
        ${img ? html`<img src="${img}" alt="${nameOf(loser)}">` : html`<div class="polaroid-empty">Kadrajda yoktu</div>`}
        <span class="polaroid-cap">${why === 'gone' ? 'Kaçtı!' : 'Kıpırdadı!'}</span>
        <span class="polaroid-by">${nameOf(loser)}, ${fmtSec(sec)} dayandı</span>
      </div>
      <h2 class="t-title" data-in>${pSpan(winner)} Turu Aldı!</h2>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>Devam${icon('arrow')}</button>`, {
      next: () => advance(),
    });
    const pol = scene.querySelector('.polaroid');
    const r = pol.getBoundingClientRect();
    scoreboard.add(winner, 1, pol);
    burst(r.left + r.width / 2, r.top + r.height / 3, { count: 50, power: 13, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }

  function tie() {
    cam.draw = null;
    sfx.sparkle();
    stage.show(html`
      <h2 class="t-title" data-in>İkiniz De Heykel!</h2>
      <p class="t-lead" data-in>Bir dakika boyunca kimse kıpırdamadı. Tur kimseye yazılmadı.</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>Devam${icon('arrow')}</button>`, {
      next: () => advance(),
    });
  }

  function advance() {
    g.round++;
    const sc = scoreboard.scores;
    if (sc[0] >= g.need || sc[1] >= g.need || g.round >= g.bestOf + 2) final();
    else round();
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const scores = scoreboard.scores;
    const { html: podium, winner } = versusFinaleHTML(scores, { lines: { tie: 'Berabere! İki Heykel' } });
    const loser = winner === -1 ? -1 : 1 - winner;
    const album = g.album.filter((a) => a.img);
    let penalty = pick(PENALTIES);
    const scene = stage.show(html`
      ${podium}
      ${loser >= 0 ? html`<div class="penalty card" data-in>
        <span class="pen-who">${pSpan(loser)} İçin Ceza</span>
        <p class="pen-text" data-pen>${penalty}</p>
        <button class="btn btn--sm" data-act="reroll" data-silent>${icon('dice')}Başka Ceza</button>
      </div>` : ''}
      ${album.length ? albumStripHTML(album.slice(-10)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      reroll: async (b) => {
        b.disabled = true;
        const card = scene.querySelector('.penalty');
        await flipEl(card, () => {
          penalty = pick(PENALTIES.filter((x) => x !== penalty));
          scene.querySelector('[data-pen]').textContent = penalty;
        });
        b.disabled = false;
      },
      dl: () => downloadAlbum('Kıpırdama!', album, 'sinemiko-kipirdama.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final' });
    celebrate();
    if (loser >= 0) life.timeout(() => announcer.say('penalty'), 1600);
    else announcer.winner(-1);
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
