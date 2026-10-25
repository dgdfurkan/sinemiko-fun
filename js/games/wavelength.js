// Dalga Boyu: ipucu veren hedefi görür, tahminci kapalı kadranda ibreyi çevirir

import { html, Life, shuffle, rand, clamp } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { SPECTRA, WAVE_TITLES } from '../data/wavelength.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, finaleButtons, other, pSpan } from './common.js';

const CX = 220;
const CY = 228;
const R = 200;
const BAND = 5;
const BANDS = [[-12.5, -7.5, 2], [-7.5, -2.5, 3], [-2.5, 2.5, 4], [2.5, 7.5, 3], [7.5, 12.5, 2]];
const BAND_COLORS = { 2: '#ffcd3c', 3: '#ff8a3d', 4: '#ff5fa2' };

// 0 sol uç, 100 sağ uç
const angleOf = (v) => Math.PI - (v / 100) * Math.PI;
const pt = (v, r) => [CX + Math.cos(angleOf(v)) * r, CY - Math.sin(angleOf(v)) * r];

function wedge(v1, v2, r) {
  const a = clamp(v1, 0, 100);
  const b = clamp(v2, 0, 100);
  if (b <= a) return '';
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(b, r);
  return `M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

export function scoreFor(target, needle) {
  const d = Math.abs(target - needle);
  if (d <= BAND / 2) return 4;
  if (d <= BAND * 1.5) return 3;
  if (d <= BAND * 2.5) return 2;
  return 0;
}

function dialHTML(target, spectrum) {
  const wedges = BANDS.map(([a, b, p]) => `<path d="${wedge(target + a, target + b, R - 6)}" fill="${BAND_COLORS[p]}" stroke="#2a1636" stroke-width="2.5"/>`).join('');
  const labels = BANDS.map(([a, b, p]) => {
    const mid = target + (a + b) / 2;
    if (mid < 1 || mid > 99) return '';
    const [x, y] = pt(mid, R - 34);
    return `<text x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}" text-anchor="middle" class="dial-pts">${p}</text>`;
  }).join('');
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const v = i * 5;
    const [x1, y1] = pt(v, R + 4);
    const [x2, y2] = pt(v, R + (i % 2 ? 12 : 18));
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  return html`
    <div class="dial-wrap">
      <svg class="dial hit" viewBox="0 0 440 252" tabindex="0" role="slider" aria-label="İbre" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
        <defs><clipPath id="dial-clip"><rect x="0" y="0" width="440" height="${CY}"/></clipPath></defs>
        <g class="dial-ticks" stroke="#2a1636" stroke-width="3" stroke-linecap="round">${raw(ticks)}</g>
        <path d="M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY} Z" fill="#fffcf6" stroke="#2a1636" stroke-width="4"/>
        <g clip-path="url(#dial-clip)">
          <g class="dial-target">${raw(wedges)}${raw(labels)}</g>
          <g class="dial-lid">
            <path d="M${CX - R - 2},${CY} A${R + 2},${R + 2} 0 0 1 ${CX + R + 2},${CY} Z" style="fill:var(--accent)" stroke="#2a1636" stroke-width="4"/>
            <path d="M${CX - R + 30},${CY} A${R - 30},${R - 30} 0 0 1 ${CX + R - 30},${CY}" fill="none" stroke="#ffffff66" stroke-width="10" stroke-dasharray="2 22" stroke-linecap="round"/>
            <text x="${CX}" y="${CY - 70}" text-anchor="middle" class="dial-q">?</text>
          </g>
        </g>
        <g class="dial-needle" style="transform-origin:${CX}px ${CY}px">
          <line x1="${CX}" y1="${CY}" x2="${CX + R - 14}" y2="${CY}" stroke="#2a1636" stroke-width="10" stroke-linecap="round"/>
          <line x1="${CX}" y1="${CY}" x2="${CX + R - 16}" y2="${CY}" stroke="#ff4f62" stroke-width="4.5" stroke-linecap="round"/>
        </g>
        <circle cx="${CX}" cy="${CY}" r="18" fill="#ff4f62" stroke="#2a1636" stroke-width="4"/>
        <line x1="${CX - R - 12}" y1="${CY}" x2="${CX + R + 12}" y2="${CY}" stroke="#2a1636" stroke-width="5" stroke-linecap="round"/>
      </svg>
      <div class="spectrum">
        <span class="sp-end l">${icon('back')}${spectrum[0]}</span>
        <span class="sp-end r">${spectrum[1]}${icon('arrow')}</span>
      </div>
    </div>`;
}

function raw(s) {
  return { __html: s };
}

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-wave"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  life.add(() => scoreboard.hide());
  const cfg = { rounds: 8, first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'İpucu veren, kadranın üstündeki gizli hedefi görür. Diğeri o sırada bakmaz.',
        'Hedef kapanınca ipucu veren tek bir ipucu söyler. Örneğin “Soğuk ile Sıcak” arasında “Çorba”.',
        'Tahminci ibreyi çevirir ve kilitler. Hedefin ortasına ne kadar yakınsa takım o kadar puan alır.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds), 'Roller her turda değişir.')}
        ${optHTML('İlk İpucu Veren', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Başla',
      startIcon: 'play',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 4, max: 16, step: 2, onChange: (v) => { cfg.rounds = v; } });
    const seg = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => seg.destroy());
  }

  async function startGame() {
    g = { round: 0, total: cfg.rounds, first: 0, deck: shuffle(SPECTRA), over: false, results: [] };
    scoreboard.show({ mode: 'team', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk İpucu Kimden?' }) : Number(cfg.first);
    newRound();
  }

  function newRound() {
    const giver = (g.first + g.round) % 2;
    if (!g.deck.length) g.deck = shuffle(SPECTRA);
    g.cur = { giver, guesser: other(giver), spectrum: g.deck.pop(), target: Math.round(rand(10, 90) * 2) / 2, needle: 50 };
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    peek();
  }

  function peek() {
    const { giver, guesser } = g.cur;
    const slot = (i) => (i === giver
      ? html`<div class="duo-slot">${avatar(i, { mood: 'smirk', pose: 'think' })}<span class="role-chip p${i}">İpucu Veriyor</span></div>`
      : html`<div class="duo-slot">${avatar(i, { eyes: 'shut', mood: 'flat', pose: 'ears' })}<span class="role-chip p${i}">Bakmıyor</span></div>`);
    stage.show(html`
      <div class="duo-stage" data-in>${slot(0)}${slot(1)}</div>
      <h2 class="t-title" data-in>${pSpan(giver)} İpucu Veriyor</h2>
      <p class="t-lead" data-in>${nameOf(guesser)}, gözlerini kapat ya da arkanı dön. Hedef birazdan görünecek.</p>
      <button class="btn btn--primary btn--big nudge" data-act="show" data-primary data-once>${icon('eyeOff')}${nameOf(guesser)} Bakmıyor, Göster</button>`, {
      show: () => target(),
    });
  }

  function setNeedle(scene, v, animate = false) {
    const n = scene.querySelector('.dial-needle');
    n.style.transition = animate ? 'transform .9s cubic-bezier(.34,1.56,.64,1)' : 'transform .08s linear';
    n.style.transform = `rotate(${-(180 - v * 1.8)}deg)`;
    const svg = scene.querySelector('.dial');
    svg.setAttribute('aria-valuenow', String(Math.round(v)));
  }

  function target() {
    const c = g.cur;
    const scene = stage.show(html`
      <p class="t-hand" data-in>Sadece ${nameOf(c.giver)} baksın</p>
      <div class="dial-box open" data-in>${dialHTML(c.target, c.spectrum)}</div>
      <p class="t-lead" data-in>Hedefi gördün mü? Kapattıktan sonra tek bir ipucu söyle.</p>
      <button class="btn btn--primary btn--big nudge" data-act="hide" data-primary data-once>${icon('lock')}Hedefi Kapat</button>`, {
      hide: async () => {
        const box = scene.querySelector('.dial-box');
        box.classList.remove('open');
        sfx.rewind();
        await life.sleep(750);
        if (stage.scene === scene) guess();
      },
    });
    setNeedle(scene, 50);
    sfx.sparkle();
  }

  function guess() {
    const c = g.cur;
    let dragging = false;
    const scene = stage.show(html`
      <p class="t-hand" data-in>${nameOf(c.giver)} ipucunu söylesin, ${nameOf(c.guesser)} ibreyi çevirsin</p>
      <div class="dial-box" data-in>${dialHTML(c.target, c.spectrum)}</div>
      <p class="key-hint" data-in>İbreyi sürükle ya da <span class="key">←</span> <span class="key">→</span> tuşlarını kullan</p>
      <button class="btn btn--primary btn--big nudge" data-act="lock" data-primary data-once>${icon('lock')}Kilitle</button>`, {
      lock: () => reveal(),
    }, {
      onKey: (e, typing) => {
        if (typing) return false;
        const d = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
        if (!d) return false;
        e.preventDefault();
        move(c.needle + d * (e.shiftKey ? 5 : 1));
        return true;
      },
    });
    const svg = scene.querySelector('.dial');
    setNeedle(scene, c.needle);
    let lastTick = Math.round(c.needle / 5);
    function move(v) {
      c.needle = clamp(v, 0, 100);
      setNeedle(scene, c.needle);
      const tick = Math.round(c.needle / 5);
      if (tick !== lastTick) {
        lastTick = tick;
        sfx.wheelTick();
      }
    }
    function fromEvent(e) {
      const r = svg.getBoundingClientRect();
      const sx = r.width / 440;
      const sy = r.height / 252;
      const x = (e.clientX - r.left) / sx - CX;
      const y = CY - (e.clientY - r.top) / sy;
      let a = Math.atan2(Math.max(y, 0), x);
      if (y < 0) a = x < 0 ? Math.PI : 0;
      return ((Math.PI - a) / Math.PI) * 100;
    }
    life.on(svg, 'pointerdown', (e) => {
      dragging = true;
      svg.setPointerCapture(e.pointerId);
      move(fromEvent(e));
    });
    life.on(svg, 'pointermove', (e) => { if (dragging) move(fromEvent(e)); });
    const end = () => { dragging = false; };
    life.on(svg, 'pointerup', end);
    life.on(svg, 'pointercancel', end);
  }

  async function reveal() {
    const c = g.cur;
    const pts = scoreFor(c.target, c.needle);
    c.pts = pts;
    g.results.push(pts);
    const last = g.round + 1 >= g.total;
    const words = { 4: 'Tam Hedef!', 3: 'Çok Yakın!', 2: 'Fena Değil!', 0: 'Iska!' };
    const scene = stage.show(html`
      <p class="t-hand" data-in>${c.spectrum[0]} ile ${c.spectrum[1]} arası</p>
      <div class="dial-box" data-in>${dialHTML(c.target, c.spectrum)}</div>
      <div class="reveal-result pending" data-res>
        <h2 class="t-title">${words[pts]}</h2>
        <p class="t-lead">${pts ? `Takım ${pts} puan kazandı.` : 'Bu turda puan yok.'}</p>
        <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Tur'}${icon('arrow')}</button>
      </div>`, {
      next: () => {
        g.round++;
        if (g.round >= g.total) final();
        else newRound();
      },
    });
    setNeedle(scene, c.needle);
    sfx.drumroll(0.9);
    await life.sleep(950);
    if (stage.scene !== scene) return;
    scene.querySelector('.dial-box').classList.add('open');
    await life.sleep(800);
    if (stage.scene !== scene) return;
    const res = scene.querySelector('[data-res]');
    res.classList.remove('pending');
    const box = scene.querySelector('.dial-box');
    const r = box.getBoundingClientRect();
    if (pts === 4) {
      sfx.fanfare();
      burst(r.left + r.width / 2, r.top + r.height * 0.6, { count: 110, power: 17 });
    } else if (pts) {
      sfx.success();
      burst(r.left + r.width / 2, r.top + r.height * 0.6, { count: 40, power: 11 });
    } else {
      sfx.fail();
    }
    if (pts) scoreboard.add('team', pts, box);
  }

  function final() {
    g.over = true;
    const score = scoreboard.team;
    const max = g.total * 4;
    const ratio = score / max;
    const [, title, sub] = WAVE_TITLES.find(([min]) => ratio >= min);
    const record = store.setBest('wavelength', score);
    stage.show(html`
      <div class="duo-stage" data-in>
        <div class="duo-slot">${avatar(0, { mood: 'laugh', eyes: 'happy', pose: 'cheer' })}</div>
        <div class="duo-slot">${avatar(1, { mood: 'laugh', eyes: 'happy', pose: 'cheer' })}</div>
      </div>
      <p class="big-stat" data-in><b>${score}</b> / ${max} puan</p>
      <h2 class="t-title" data-in>${title}</h2>
      <p class="t-lead" data-in>${sub}${record ? ' Bu yeni rekorunuz!' : ''}</p>
      <div class="wave-dots" data-in>${g.results.map((p) => html`<span class="wd p${p}">${p}</span>`)}</div>
      ${finaleButtons()}`, {
      home: () => navigate('#/'),
      again: () => startGame(),
    });
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
