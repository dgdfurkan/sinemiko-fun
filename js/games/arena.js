// Kameralı düello oyunlarının ortak iskeleti: lobi, kamera, oyuncu bekleme, ölçümlü geri sayım,
// süre sayacı, tuval efektleri, final ekranı ve albüm. Her oyun yalnızca kendi kuralını yazar.

import { html, Life, rand, pick } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { lobbyHTML, celebrate, versusFinaleHTML } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, tag, PCOL, albumStripHTML, downloadAlbum, roundRect } from './cam.js';

export { PCOL, tag, roundRect, missingText };

const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/* ---------- Tuval efektleri ---------- */

export function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 1.05, y - s * 0.35, x - s * 0.55, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.05, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

export function starPath(g, x, y, r, n = 5, inner = 0.48) {
  g.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n;
    const rr = k % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

// Kalın konturlu dolu şekil: oyunun çizgi film görünümü
export function inked(g, fill, lw = 3.5) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = '#2a1636';
  g.stroke();
}

export function makeFx() {
  const bits = [];
  const texts = [];
  const rings = [];
  return {
    burst(x, y, { n = 16, colors = ['#ffcd3c', '#fff'], power = 320, gravity = 900, size = [4, 9], shape = 'circle', up = 0 } = {}) {
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n + rand(-0.3, 0.3);
        const v = rand(power * 0.45, power);
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 1, c: pick(colors), s: rand(size[0], size[1]), shape, gravity, rot: rand(0, 6) });
      }
    },
    text(x, y, text, color, size = 24) {
      texts.push({ x, y, text, c: color, s: size, life: 1 });
    },
    ring(x, y, color, r = 30) {
      rings.push({ x, y, c: color, r0: r, life: 1 });
    },
    clear() {
      bits.length = 0;
      texts.length = 0;
      rings.length = 0;
    },
    draw(g, dt) {
      for (let k = rings.length - 1; k >= 0; k--) {
        const r = rings[k];
        r.life -= dt * 2.2;
        if (r.life <= 0) {
          rings.splice(k, 1);
          continue;
        }
        g.globalAlpha = r.life;
        g.beginPath();
        g.arc(r.x, r.y, r.r0 * (1 + (1 - r.life) * 1.6), 0, Math.PI * 2);
        g.lineWidth = 6 * r.life + 1;
        g.strokeStyle = r.c;
        g.stroke();
      }
      for (let k = bits.length - 1; k >= 0; k--) {
        const p = bits[k];
        p.life -= dt * 1.7;
        if (p.life <= 0) {
          bits.splice(k, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.rot += dt * 6;
        g.globalAlpha = Math.min(1, p.life * 1.4);
        const s = p.s * (0.5 + p.life * 0.5);
        if (p.shape === 'heart') {
          heartPath(g, p.x, p.y, s * 1.3);
          g.fillStyle = p.c;
          g.fill();
        } else if (p.shape === 'star') {
          starPath(g, p.x, p.y, s * 1.4);
          g.fillStyle = p.c;
          g.fill();
        } else {
          g.beginPath();
          g.arc(p.x, p.y, s, 0, Math.PI * 2);
          g.fillStyle = p.c;
          g.fill();
        }
      }
      for (let k = texts.length - 1; k >= 0; k--) {
        const s = texts[k];
        s.life -= dt * 1.1;
        if (s.life <= 0) {
          texts.splice(k, 1);
          continue;
        }
        s.y -= 60 * dt;
        g.globalAlpha = Math.min(1, s.life * 2);
        tag(g, s.x, s.y, s.text, s.c, s.s * (1 + Math.max(0, s.life - 0.8) * 1.5));
      }
      g.globalAlpha = 1;
    },
  };
}

// Oyun başlayınca üstteki kart oyun alanını kapatmasın
export function hideTop(scene) {
  const top = scene.querySelector('.hud-top');
  if (!top) return;
  top.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-20px)' }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
}

/* ---------- Yüz noktaları (aynalı ekran düzlemi, 0-1) ---------- */

export const B = (p, k) => (p && p.blend && p.blend[k]) || 0;
export const jawOf = (p) => B(p, 'jawOpen');
export const browOf = (p) => (B(p, 'browInnerUp') + (B(p, 'browOuterUpLeft') + B(p, 'browOuterUpRight')) / 2) / 2;
export const puckerOf = (p) => Math.max(B(p, 'mouthPucker'), B(p, 'mouthFunnel') * 0.9);
export const blinkOf = (p) => (B(p, 'eyeBlinkLeft') + B(p, 'eyeBlinkRight')) / 2;
export const smileOf = (p) => (B(p, 'mouthSmileLeft') + B(p, 'mouthSmileRight')) / 2;
export const noseOf = (p) => p.lm[1] || p.lm[4] || { x: p.box.cx, y: p.box.cy };
export function mouthOf(p) {
  const a = p.lm[13];
  const b = p.lm[14];
  const l = p.lm[61];
  const r = p.lm[291];
  if (!a || !b) return { x: p.box.cx, y: p.box.y + p.box.h * 0.78, w: p.box.w * 0.35 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: l && r ? Math.abs(r.x - l.x) : p.box.w * 0.35 };
}

/* ---------- Vücut ---------- */

// Avucun ortası (ekran pikseli); parmaklar görünmezse bilekten dirsek yönünde biraz ileri
export function handsOf(p, W, H) {
  const out = [];
  for (const [w, e, pinky, index] of [[15, 13, 17, 19], [16, 14, 18, 20]]) {
    const a = p.lm[w];
    const b = p.lm[e];
    if (!a || a.v < 0.35) {
      out.push(null);
      continue;
    }
    const f1 = p.lm[pinky];
    const f2 = p.lm[index];
    if (f1 && f2 && f1.v > 0.35 && f2.v > 0.35) {
      out.push({ x: ((a.x + f1.x + f2.x) / 3) * W, y: ((a.y + f1.y + f2.y) / 3) * H });
      continue;
    }
    const k = b && b.v > 0.3 ? 0.3 : 0;
    out.push({ x: (a.x + (a.x - b.x) * k) * W, y: (a.y + (a.y - b.y) * k) * H });
  }
  return out;
}

export const shoulderPx = (p, W, H) => Math.hypot((p.lm[11].x - p.lm[12].x) * W, (p.lm[11].y - p.lm[12].y) * H);

/* ---------- İskelet ---------- */

export function camDuel(view, { game, navigate }, spec) {
  const life = new Life();
  const shell = camShell(view, spec.cls);
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  const cfg = { ...(spec.cfg || {}) };
  const fx = makeFx();
  life.add(() => scoreboard.hide());
  cam.look.allowBig = !spec.noBig;

  const ctx = {
    life, stage, cam, shell, cfg, fx, game,
    m: null,
    album: [],
    // Puanlar burada hemen güncellenir; tabela rozet uçtuktan sonra yazar
    pts: [0, 0],
    // Oyun saati: oyun duraklayınca durur. Doğma zamanları ve süreler buna göre hesaplanır
    pausedMs: 0,
    pauseAt: 0,
    now: () => (cam.paused ? ctx.pauseAt : performance.now()) - ctx.pausedMs,
    // Oyuncunun kadrajda kendi yarısı: [x0, x1] (0-1)
    half: (i) => (i === cam.leftIs ? [0, 0.5] : [0.5, 1]),
    // Oyuncunun yüzünden ya da vücudundan albüme fotoğraf; aynı kişiden en fazla saniyede bir
    shoot(i, cap, { pad = 0.35, decorate = null, force = false } = {}) {
      const p = cam.players[i];
      if (!p) return null;
      const now = performance.now();
      ctx.lastShot = ctx.lastShot || [0, 0];
      if (!force && now - ctx.lastShot[i] < 1200) return null;
      // Oyun sırasında yalnızca tuvale kopyalanır; JPEG'e çevirme finalde
      const canvas = cam.grab(p.box, pad, 960, decorate);
      if (!canvas) return null;
      ctx.lastShot[i] = now;
      ctx.album.push({ canvas, img: '', cap, by: nameOf(i), color: PCOL[i] });
      if (ctx.album.length > 12) ctx.album.shift();
      return canvas;
    },
    hud(tpl, actions = {}) {
      return stage.show(tpl, actions, { className: 'hud' });
    },
    // Geri sayım; bu sırada iki oyuncunun da düz duruşu ölçülür (medyan)
    async countdown(scene, { final = 'Başla!', voice = null, measure = null } = {}) {
      const samples = [[], []];
      const prevFrame = cam.onFrame;
      if (measure) {
        cam.onFrame = (players, now) => {
          players.forEach((p, i) => { if (p) samples[i].push(measure(p)); });
          if (prevFrame) prevFrame(players, now);
        };
      }
      await countdown(scene, life, { final, voice });
      ctx.counted = true;
      if (measure) cam.onFrame = prevFrame;
      if (!measure) return null;
      return samples.map((list) => {
        if (!list.length) return null;
        const out = {};
        for (const key of Object.keys(list[0])) out[key] = median(list.map((o) => o[key]));
        return out;
      });
    },
    // Süre sayacı: clock öğesini günceller, son 5 saniyede tıklar
    // Oyun duraklatılınca (biri kadrajdan çıkınca) süre de durur
    clock(el, secs, { onEnd, onTick } = {}) {
      let last = performance.now();
      let left = secs;
      let shown = secs;
      let stopped = false;
      const id = life.interval(() => {
        if (stopped) return;
        const now = performance.now();
        if (!cam.paused) left = Math.max(0, left - (now - last) / 1000);
        last = now;
        const s = Math.ceil(left);
        if (onTick) onTick(left);
        if (s !== shown) {
          shown = s;
          el.textContent = String(s);
          scoreboard.setMid(`${s} sn`);
          if (s <= 5 && s > 0) {
            sfx.tick(5 - s);
            el.classList.add('hurry');
            el.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          }
        }
        if (left <= 0) {
          stopped = true;
          clearInterval(id);
          el.textContent = 'Süre!';
          scoreboard.setMid('Süre Doldu');
          if (onEnd) onEnd();
        }
      }, 100);
      return { stop: () => { stopped = true; clearInterval(id); }, elapsed: () => secs - left, left: () => left };
    },
    shake(px = 10) {
      shell.card.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px * 0.6}px)` }, { transform: `translate(${px * 0.8}px,${-px * 0.6}px)` }, { transform: 'translate(0,0)' }], { duration: 320 });
    },
    // Puan ve uçan rozet; nx, ny rozetin çıktığı yer (0-1) ya da nx bir sayfa öğesi
    score(i, pts, nx, ny, { quiet = false } = {}) {
      ctx.pts[i] += pts;
      // Puan anında kısa yakınlaşma, öndekinin başında taç
      const now = performance.now();
      if (pts > 0 && now - (ctx.lastPunch || 0) > 1500) {
        ctx.lastPunch = now;
        cam.look.punch(i, pts >= 2 ? 1.1 : 1.06);
      }
      // Başın üstünü kullanan oyunlarda taç oyunu kapatmasın
      if (!spec.noBig) cam.look.crown = ctx.pts[0] === ctx.pts[1] ? -1 : ctx.pts[0] > ctx.pts[1] ? 0 : 1;
      const from = nx == null ? null : typeof nx === 'object' ? nx : cam.pointEl(nx, ny);
      scoreboard.add(i, pts, from, { quiet });
    },
    // Maç biter: podyum, istatistik, albüm
    finish({ stats = null, sub = '' } = {}) {
      if (!ctx.m || ctx.m.over) return;
      ctx.m.over = true;
      cam.onFrame = null;
      cam.draw = null;
      setPaused(false);
      cam.look.crown = -1;
      fx.clear();
      const { html: podium, winner } = versusFinaleHTML(ctx.pts, { lines: { tie: spec.tie || 'Berabere!' } });
      if (spec.coop) announcer.cheer();
      else announcer.winner(winner);
      const album = ctx.album;
      album.forEach((a) => {
        if (!a.img && a.canvas) a.img = a.canvas.toDataURL('image/jpeg', 0.9);
        a.canvas = null;
      });
      stage.show(html`
        ${podium}
        ${sub ? html`<p class="t-lead" data-in>${sub}</p>` : ''}
        ${stats ? html`<div class="pop-stats" data-in>${[0, 1].map((i) => html`
          <div class="pop-stat p${i}"><span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span>${stats[i]}</div>`)}</div>` : ''}
        ${album.length ? albumStripHTML(album) : ''}
        <div class="row" data-in>
          ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
          <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
          <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
        </div>`, {
        dl: () => downloadAlbum(spec.albumTitle || game.title, album, spec.albumFile || `sinemiko-${game.id}.jpg`),
        home: () => navigate('#/'),
        again: () => ready(),
      }, { className: 'cam-final' });
      celebrate();
    },
  };

  /* Biri kadrajdan çıkınca oyun durur: süre işlemez, hareketler sayılmaz.
     Geri gelince kısa bir an sonra kaldığı yerden devam eder. Takip bir türlü tutmazsa "Böyle Devam Et" */
  const lostEl = shell.lost;
  let lostSince = [0, 0];
  let backSince = 0;
  function setPaused(on, who = []) {
    if (cam.paused === on && !on) return;
    if (on && !cam.paused) ctx.pauseAt = performance.now();
    if (!on && cam.paused) ctx.pausedMs += performance.now() - ctx.pauseAt;
    cam.paused = on;
    if (!on) {
      lostEl.hidden = true;
      return;
    }
    const names = who.map((i) => nameOf(i));
    const title = who.length === 2 ? 'İkinizi de göremiyorum!' : `${names[0]} görünmüyor!`;
    lostEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'cl-box';
    const h = document.createElement('b');
    h.textContent = title;
    const tip = document.createElement('span');
    tip.textContent = lostTip(who);
    const sub = document.createElement('small');
    sub.textContent = 'Oyun durdu, görününce kaldığı yerden devam eder.';
    const skip = document.createElement('button');
    skip.className = 'btn';
    skip.type = 'button';
    skip.textContent = 'Böyle Devam Et';
    skip.addEventListener('click', () => {
      ctx.noPause = true;
      setPaused(false);
    });
    box.append(h, tip, sub, skip);
    lostEl.append(box);
    lostEl.hidden = false;
    sfx.boing();
  }
  function lostTip(who) {
    if (cam.light() < 0.17) return 'Ortam karanlık: ışığı açın, kamera sizi daha iyi görür.';
    const i = who[0];
    const lp = cam.tracker && cam.tracker.lastPos ? cam.tracker.lastPos[i] : null;
    const x = lp ? 1 - lp.cx : 0.5;
    if (spec.kind === 'hand') return 'Ellerinizi kameraya, kendi yarınızda gösterin.';
    if (x < 0.14) return `${nameOf(i)}, biraz ortaya doğru kay.`;
    if (x > 0.86) return `${nameOf(i)}, biraz ortaya doğru kay.`;
    if (spec.kind === 'pose') return 'Başınız ve omuzlarınız kadrajda olsun; biraz geri yaslanın.';
    return 'Yüzünüz kameraya dönük olsun; saç ya da el yüzü kapatmasın.';
  }
  const guard = () => {
    const active = ctx.m && !ctx.m.over && ctx.counted && !ctx.noPause && stage.scene && stage.scene.classList.contains('hud');
    if (!active) {
      if (cam.paused) setPaused(false);
      lostSince = [0, 0];
      return;
    }
    const now = performance.now();
    const limit = spec.kind === 'hand' ? 3500 : 1500;
    const gone = [0, 1].filter((i) => {
      if (cam.visible(i, 350)) {
        lostSince[i] = 0;
        return false;
      }
      if (!lostSince[i]) lostSince[i] = now;
      return now - lostSince[i] > (cam.paused ? 0 : limit - 350);
    });
    if (!cam.paused && gone.length) {
      setPaused(true, gone);
      backSince = 0;
    } else if (cam.paused) {
      const back = [0, 1].every((i) => cam.visible(i, 250));
      if (!back) backSince = 0;
      else if (!backSince) backSince = now;
      else if (now - backSince > 700) {
        setPaused(false);
        sfx.go();
        fx.text(cam.W / 2, cam.H * 0.3, 'Devam!', '#2ed6a0', 34);
      }
    }
  };
  life.interval(guard, 120);
  life.add(() => { cam.paused = false; });

  function lobby() {
    ctx.m = null;
    ctx.counted = false;
    ctx.noPause = false;
    cam.look.crown = -1;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: spec.rules,
      options: spec.options ? spec.options(cfg) : '',
      start: 'Kamerayı Aç',
      note: spec.note || 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    if (spec.bind) spec.bind(scene, cfg, stage);
  }

  function boot() {
    camBoot(stage, life, cam, spec.kind, { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    ctx.m = null;
    ctx.counted = false;
    ctx.noPause = false;
    cam.look.crown = -1;
    setPaused(false);
    ctx.album = [];
    fx.clear();
    cam.onFrame = null;
    cam.draw = spec.idle ? (g, players, dt, t) => spec.idle(ctx, g, players, dt, t) : null;
    waitPlayers(stage, life, cam, {
      title: spec.waitTitle || 'Kadraja Geçin',
      tip: spec.waitTip || '',
      onReady: () => {
        ctx.m = { over: false };
        ctx.pts = [0, 0];
        scoreboard.show({ mode: 'versus', mid: spec.mid ? spec.mid(cfg) : '' });
        if (spec.voices) announcer.preload(spec.voices);
        spec.play(ctx);
      },
    });
  }

  // Testler oyun durumunu buradan okur
  if (window.__sinemikoDuelHook) window.__sinemikoDuelHook(ctx);
  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!ctx.m && !ctx.m.over,
  };
}
