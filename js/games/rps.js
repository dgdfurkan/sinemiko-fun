// Taş Kağıt Makas, vücutla: Taş eller başta, Kağıt eller havada, Makas kollar çapraz.
// "Taş! Kağıt! Makas!" bitince ikiniz de pozunuzu verirsiniz, kamera hakemlik eder

import { html, raw } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { optHTML } from './common.js';
import { camDuel, inked, PCOL, tag, missingText } from './arena.js';
import { drawSkeleton } from './cam.js';
import { body, poseById, figSVG } from '../vision/poses.js';

export const THROWS = {
  tas: { name: 'Taş', pose: 'head', beats: 'makas', tip: 'Eller başa' },
  kagit: { name: 'Kağıt', pose: 'up', beats: 'tas', tip: 'Eller havaya' },
  makas: { name: 'Makas', pose: 'cross', beats: 'kagit', tip: 'Kollar çapraz' },
};

// Önce kollar çapraz, sonra eller başta, en son eller havada: birbirine en az karışan sıra
export function classify(b) {
  if (!b) return null;
  if (poseById('cross').test(b)) return 'makas';
  if (poseById('head').test(b)) return 'tas';
  if (poseById('up').test(b)) return 'kagit';
  return null;
}

// Simgeler: taş, kağıt, makas
export function throwIcon(g, kind, x, y, s, t = 0) {
  g.save();
  g.translate(x, y);
  if (kind === 'tas') {
    g.beginPath();
    g.moveTo(-s, s * 0.3);
    g.bezierCurveTo(-s * 1.05, -s * 0.5, -s * 0.3, -s * 0.95, s * 0.2, -s * 0.8);
    g.bezierCurveTo(s * 0.9, -s * 0.7, s * 1.1, 0, s * 0.85, s * 0.55);
    g.bezierCurveTo(s * 0.4, s * 0.85, -s * 0.6, s * 0.85, -s, s * 0.3);
    inked(g, '#a99cb3', 4);
    g.beginPath();
    g.moveTo(-s * 0.3, -s * 0.3); g.lineTo(s * 0.05, -s * 0.05);
    g.lineWidth = 3;
    g.strokeStyle = '#6d5f7d';
    g.stroke();
  } else if (kind === 'kagit') {
    g.rotate(Math.sin(t / 300) * 0.06);
    g.beginPath();
    g.rect(-s * 0.72, -s * 0.95, s * 1.44, s * 1.9);
    inked(g, '#fffcf6', 4);
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      g.moveTo(-s * 0.45, -s * 0.5 + k * s * 0.38);
      g.lineTo(s * 0.45, -s * 0.5 + k * s * 0.38);
    }
    g.lineWidth = 3;
    g.strokeStyle = '#9fdcff';
    g.stroke();
  } else {
    const open = 0.35 + Math.sin(t / 160) * 0.12;
    for (const sgn of [-1, 1]) {
      g.save();
      g.rotate(sgn * open);
      g.beginPath();
      g.moveTo(-s * 0.08, 0);
      g.lineTo(s * 0.08, 0);
      g.lineTo(s * 0.04, -s * 1.1);
      g.lineTo(-s * 0.02, -s * 1.1);
      g.closePath();
      inked(g, '#d6e4f0', 3);
      g.beginPath();
      g.arc(0, s * 0.42, s * 0.3, 0, Math.PI * 2);
      inked(g, sgn < 0 ? '#ff5fa2' : '#4fb6ff', 4);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, s * 0.09, 0, Math.PI * 2);
    g.fillStyle = '#2a1636';
    g.fill();
  }
  g.restore();
}

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-rps',
    kind: 'pose',
    cfg: { to: '3' },
    rules: [
      html`<b>Taş</b> eller başa, <b>Kağıt</b> eller havaya, <b>Makas</b> kollar çapraz.`,
      '"Taş! Kağıt! Makas!" bitince ikiniz de seçtiğiniz pozu verin. Kamera kimin ne attığını görür.',
      'Taş makası, makas kâğıdı, kâğıt taşı yener. Poz veremeyen turu kaybeder.',
    ],
    options: (cfg) => optHTML('Kaç Galibiyet', segHTML('to', [['3', '3 Galibiyet'], ['5', '5 Galibiyet']], cfg.to)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="to"]'), { value: cfg.to, onChange: (v) => { cfg.to = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Eller Hazır',
    waitTip: 'Belinizden yukarısı görünsün, kollarınız rahat aşağıda.',
    voices: ['rps-1', 'rps-2', 'rps-3', 'yay-1', 'yay-3', 'tie-rps'],
    tie: 'Berabere! Eller Eşit',
    albumTitle: 'Taş Kağıt Makas',
    mid: (cfg) => `${cfg.to} galibiyet`,
    play: (ctx) => {
      Object.assign(ctx.m, { round: 0, counts: [{ tas: 0, kagit: 0, makas: 0 }, { tas: 0, kagit: 0, makas: 0 }] });
      round(ctx);
    },
  });
}

const legendHTML = () => html`
  <div class="rps-legend">${Object.entries(THROWS).map(([id, th]) => html`
    <div class="rps-card" data-k="${id}"><span class="rps-fig">${raw(figSVG(poseById(th.pose).fig))}</span><b>${th.name}</b><span>${th.tip}</span></div>`)}
  </div>`;

async function round(ctx) {
  const { cam, cfg, m, fx, life } = ctx;
  const to = Number(cfg.to);
  m.state = 'chant';
  m.votes = [{}, {}];
  m.result = null;
  fx.clear();
  scoreboard.setMid(`Tur ${m.round + 1}`);
  const scene = ctx.hud(html`
    <div class="hud-top" data-in>${legendHTML()}</div>
    <div class="rps-chant" data-chant></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`);
  const chant = scene.querySelector('[data-chant]');
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players) => {
    warn.textContent = missingText(cam);
    if (m.state !== 'look') return;
    players.forEach((p, i) => {
      const k = p ? classify(body(p.lm, p.ar)) : null;
      if (k) m.votes[i][k] = (m.votes[i][k] || 0) + 1;
    });
  };
  cam.draw = (g, players, dt, t) => {
    players.forEach((p, i) => {
      if (!p) return;
      const k = m.state === 'look' ? classify(body(p.lm, p.ar)) : null;
      drawSkeleton(g, cam, p, i, { glow: k ? 0.8 : 0, label: '' });
      const n = p.lm[0];
      const res = m.result;
      if (res && res.pick[i]) {
        const s = cam.H * 0.08;
        const x = n.x * cam.W;
        const y = Math.max(s * 1.6, n.y * cam.H - cam.H * 0.25);
        throwIcon(g, res.pick[i], x, y, s * (res.win === i ? 1.25 + Math.sin(t / 120) * 0.06 : 0.9), t);
        tag(g, x, y + s * 1.55, THROWS[res.pick[i]].name, PCOL[i], 16);
      } else if (k) {
        tag(g, n.x * cam.W, n.y * cam.H - cam.H * 0.2, THROWS[k].name, PCOL[i], 18);
      }
    });
    fx.draw(g, dt);
  };
  await life.sleep(700);
  const beats = [['Taş!', 'rps-1'], ['Kağıt!', 'rps-2'], ['Makas!', 'rps-3']];
  for (const [text, voice] of beats) {
    if (m.over) return;
    chant.textContent = text;
    chant.animate([{ transform: 'scale(2.2) rotate(-6deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1.3)' });
    announcer.say(voice);
    sfx.tick(2);
    await life.sleep(640);
  }
  chant.textContent = 'Göster!';
  sfx.go();
  // Poz verme payı: yarım saniye, sonra bir saniye boyunca oylar toplanır
  await life.sleep(450);
  m.state = 'look';
  await life.sleep(1000);
  m.state = 'show';
  chant.textContent = '';
  const pick = m.votes.map((v) => {
    const best = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 3 ? best[0] : null;
  });
  judge(ctx, scene, pick, to);
}

function judge(ctx, scene, pick, to) {
  const { cam, m, fx, life } = ctx;
  let win;
  if (!pick[0] && !pick[1]) win = -2;
  else if (!pick[0]) win = 1;
  else if (!pick[1]) win = 0;
  else if (pick[0] === pick[1]) win = -1;
  else win = THROWS[pick[0]].beats === pick[1] ? 0 : 1;
  m.result = { pick, win };
  pick.forEach((k, i) => { if (k) m.counts[i][k]++; });
  const chant = scene.querySelector('[data-chant]');
  if (win === -2) {
    chant.textContent = 'Kimse Poz Vermedi!';
    sfx.boing();
    life.timeout(() => { if (!m.over) round(ctx); }, 1700);
    return;
  }
  if (win === -1) {
    chant.textContent = 'Aynı! Tekrar';
    sfx.boing();
    announcer.say('tie-rps');
    life.timeout(() => { if (!m.over) round(ctx); }, 2000);
    return;
  }
  m.round++;
  const loser = 1 - win;
  chant.textContent = pick[loser] ? `${THROWS[pick[win]].name} Yener!` : `${nameOf(loser)} Poz Vermedi!`;
  chant.classList.add(`p${win}`);
  sfx.success();
  announcer.cheer();
  const p = cam.players[win];
  if (p) fx.burst(p.lm[0].x * cam.W, p.lm[0].y * cam.H - cam.H * 0.25, { n: 30, colors: [PCOL[win], '#ffcd3c', '#fff'], power: 420, shape: 'star' });
  ctx.shoot(win, `${THROWS[pick[win]].name} Kazandı`, { pad: 0.12, force: true });
  ctx.score(win, 1, chant);
  const r = chant.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { count: 30, power: 10, colors: [PCOL[win], '#ffcd3c'] });
  life.timeout(() => {
    if (m.over) return;
    if (ctx.pts[0] >= to || ctx.pts[1] >= to) {
      const fav = (i) => {
        const e = Object.entries(m.counts[i]).sort((a, b) => b[1] - a[1])[0];
        return e && e[1] ? THROWS[e[0]].name : 'yok';
      };
      ctx.finish({ stats: [0, 1].map((i) => html`<span>En sevdiği <b>${fav(i)}</b></span><span><b>${m.counts[i].tas}</b> taş, <b>${m.counts[i].kagit}</b> kağıt, <b>${m.counts[i].makas}</b> makas</span>`) });
    } else {
      round(ctx);
    }
  }, 2600);
}
