// Gizli sayfa: Döndür Çiz. Adres çubuğuna #/biz yazınca açılır, sitenin hiçbir yerinden bağlantı verilmez.
// Disk sürüklenerek çevrilir, numarası BAŞLA'ya gelen kesiklerin içinden kalemle geçilir; adımlar bitince resim ortaya çıkar.
// Yazdır kâğıt sürümünü (disk, çizim kâğıdı) verir, kesim dosyası lazer ve Cricut içindir.

import { html, raw, toHTML, Life, clamp, reducedMotion } from '../lib/dom.js';
import { icon } from '../ui/icons.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { openSheet, toast, confirmSheet } from '../ui/overlay.js';
import { sfx } from '../audio/sfx.js';
import { cannons, burst } from '../fx/confetti.js';
import { buildSet, SIZES, LEVELS, rotate } from '../spin/engine.js';
import { BIZ, SEEDS } from '../spin/biz.js';
import { printPages, cutFile } from '../spin/print.js';

const KEY = 'sinemiko-fun/biz';
const TOP = 15;
const INK = '#3a3142';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Gizli sekmede kayıt tutulamaz; ilerleme yalnızca bu oturumda kalır
  }
}

function ensureCSS() {
  if (document.querySelector('link[data-biz]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'css/biz.css';
  l.dataset.biz = '1';
  document.head.append(l);
}

const norm = (a) => ((a % 360) + 540) % 360 - 180;
const ease = (t) => 1 - (1 - t) ** 3;
const pathOf = (pts) => `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}`;

// Gerçek kalem kesiğin tam ortasından geçmez: her çizgi biraz kayar, el çizimi gibi durur
function jittered(p) {
  if (p.dot) return p.world;
  let h = (p.id + 1) * 2654435761;
  const rnd = () => {
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h >>> 0) % 1000) / 1000 - 0.5;
  };
  const off = rnd() * 0.5;
  const wob = rnd() * 0.25;
  const n = p.world.length;
  return p.world.map((q, i) => {
    const a = p.world[Math.max(0, i - 2)];
    const b = p.world[Math.min(n - 1, i + 2)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = off + wob * Math.sin((i / n) * Math.PI * 2);
    return [q[0] - ((b[1] - a[1]) / len) * k, q[1] + ((b[0] - a[0]) / len) * k];
  });
}

// Çizerken ve bitince farklı düğmeler
const playActions = (done) => (done
  ? html`
    <button class="btn btn--primary" data-act="png">${icon('download')}Resmi İndir</button>
    <button class="btn" data-act="again">${icon('replay')}Diski Geri Tak</button>`
  : html`
    <button class="btn btn--primary" data-act="turn">${icon('spin')}Sıradaki Adıma Çevir</button>
    <button class="btn" data-act="draw">${icon('pencil')}Bu Adımı Çiz</button>
    <button class="btn" data-act="peek">${icon('hand')}Diski Kaldır</button>
    <button class="btn" data-act="auto">${icon('play')}Kendiliğinden Çiz</button>`);

export function mount(view) {
  const life = new Life();
  ensureCSS();
  const saved = loadSaved();
  saved.progress = saved.progress || {};
  let size = saved.size === 'a4' ? 'a4' : 'a3';
  let level = saved.level === 1 ? 1 : 2;

  view.innerHTML = toHTML(html`
    <section class="biz">
      <div class="biz-deskwrap">
        <div class="biz-stage hit" aria-label="Döndür Çiz diski">
          <svg class="biz-paper" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="biz-disk-shadow"></div>
          <div class="biz-lift">
            <div class="biz-disk"><canvas></canvas><svg class="biz-hl" xmlns="http://www.w3.org/2000/svg"></svg></div>
          </div>
          <div class="biz-pin"></div>
          <div class="biz-finale" hidden>
            <h2 class="biz-finale-title">İşte Biz!</h2>
            <p class="biz-finale-sub">Anıtkabir'deki fotoğrafımızdan, adım adım.</p>
          </div>
        </div>
      </div>
      <aside class="biz-panel card">
        <header class="biz-head">
          <h1 class="biz-title">Döndür Çiz</h1>
          <p class="biz-lead">Diski çevir, numarası gelen kesiklerin içinden kalemle geç. Sonunda resim kendini gösterecek.</p>
        </header>
        <div class="biz-step">
          <div class="biz-step-badge"><span class="biz-step-k">1</span><span class="biz-step-of">/ 60</span></div>
          <div class="biz-step-body">
            <p class="biz-step-text"></p>
            <div class="biz-step-dots"></div>
          </div>
        </div>
        <div class="biz-progress"><span class="biz-bar"><i></i></span><span class="biz-count"></span></div>
        <div class="biz-actions biz-actions--play"></div>
        <div class="biz-settings">
          <div class="biz-opt"><span>Kâğıt</span>${segHTML('size', [['a4', 'A4'], ['a3', 'A3']], size)}</div>
          <div class="biz-opt"><span>Çizim</span>${segHTML('level', [['1', 'Sade'], ['2', 'Detaylı']], String(level))}</div>
          <p class="biz-spec"></p>
        </div>
        <div class="biz-actions biz-actions--paper">
          <button class="btn btn--ink" data-act="print">${icon('download')}Yazdır ve Kes</button>
          <button class="btn" data-act="howto">${icon('lyrics')}Nasıl Yapılır?</button>
          <button class="btn biz-reset" data-act="reset">${icon('eraser')}Baştan Başla</button>
        </div>
      </aside>
    </section>`);

  const root = view.querySelector('.biz');
  const stage = root.querySelector('.biz-stage');
  const paper = root.querySelector('.biz-paper');
  const lift = root.querySelector('.biz-lift');
  const diskEl = root.querySelector('.biz-disk');
  const canvas = diskEl.querySelector('canvas');
  const hl = root.querySelector('.biz-hl');
  const shadow = root.querySelector('.biz-disk-shadow');
  const pin = root.querySelector('.biz-pin');
  const finale = root.querySelector('.biz-finale');
  const stepK = root.querySelector('.biz-step-k');
  const stepOf = root.querySelector('.biz-step-of');
  const stepText = root.querySelector('.biz-step-text');
  const stepDots = root.querySelector('.biz-step-dots');
  const bar = root.querySelector('.biz-bar i');
  const countEl = root.querySelector('.biz-count');
  const spec = root.querySelector('.biz-spec');
  const btn = (a) => root.querySelector(`[data-act="${a}"]`);

  let set = null;
  let cfg = null;
  let disk = null;
  let diskIdx = 0;
  let angle = 0;
  let scale = 1;
  let V = 0;
  let done = new Set();
  const cover = new Map();
  const inkEls = new Map();
  let inkG = null;
  let autoplay = false;
  let busy = false;
  let finished = false;
  let lastTick = null;
  let lastHL = '';

  const confKey = () => `${size}-${level}`;
  const pKey = (p) => `${diskIdx}:${p.id}`;
  const isDone = (p) => done.has(pKey(p));
  const total = () => set.disks.reduce((t, d) => t + d.pieces.length, 0);
  const doneCount = () => done.size;

  function save() {
    saved.size = size;
    saved.level = level;
    saved.progress[confKey()] = { done: [...done], disk: diskIdx };
    persist(saved);
  }

  /* ---------- Kurulum ---------- */

  function build() {
    const base = SIZES[size];
    set = buildSet(BIZ, { ...base, level, steps: LEVELS[level].steps, seed: SEEDS[confKey()] || 7 });
    cfg = set.cfg;
    V = cfg.R + 4;
    const prog = saved.progress[confKey()] || {};
    done = new Set(Array.isArray(prog.done) ? prog.done : []);
    diskIdx = clamp(Number(prog.disk) || 0, 0, set.disks.length - 1);
    // Bitmiş disk varsa sıradakine geç
    while (diskIdx < set.disks.length - 1 && set.disks[diskIdx].pieces.every((p) => done.has(`${diskIdx}:${p.id}`))) diskIdx++;
    disk = set.disks[diskIdx];
    cover.clear();
    finished = false;
    setActions(false);
    finale.hidden = true;
    stage.classList.remove('is-finished');
    lift.classList.remove('gone', 'peek');
    spec.textContent = `${base.name} · ${LEVELS[level].name}: ${total()} kesik, ${cfg.steps} adım${set.disks.length > 1 ? `, ${set.disks.length} disk` : ''}. Disk çapı ${Math.round(cfg.R * 2 / 10)} cm.`;
    buildPaper();
    layout();
    angle = 0;
    applyAngle();
    update();
    // Daha önce bitirilmişse resim doğrudan gösterilir
    if (nextStep() < 0 && diskIdx === set.disks.length - 1) finish(true);
  }

  function buildPaper() {
    const R = cfg.R;
    paper.setAttribute('viewBox', `${-V} ${-V - TOP} ${2 * V} ${2 * V + TOP}`);
    paper.innerHTML = `
      <defs>
        <filter id="biz-pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale=".45" xChannelSelector="R" yChannelSelector="G" result="d"/>
          <feComposite in="d" in2="n" operator="arithmetic" k1="0" k2="1" k3="-.18" k4="0"/>
        </filter>
      </defs>
      <circle class="biz-guide" r="${R}"/>
      <path class="biz-cross" d="M-2.6 0H2.6M0 -2.6V2.6"/>
      <g class="biz-ink" fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round"></g>
      <g class="biz-start">
        <path d="M-3.6 ${-R - 6.6}L3.6 ${-R - 6.6}L0 ${-R - 0.8}Z"/>
        <text y="${-R - 9.2}" text-anchor="middle">BAŞLA</text>
      </g>`;
    inkG = paper.querySelector('.biz-ink');
    inkG.style.strokeWidth = '0.62';
    inkEls.clear();
    // Önceki disklerin ve bu diskin bitmiş çizgileri
    set.disks.forEach((d, di) => {
      for (const p of d.pieces) if (done.has(`${di}:${p.id}`)) addInk(p, di, true);
    });
  }

  function addInk(p, di = diskIdx, full = true) {
    const key = `${di}:${p.id}`;
    let el = inkEls.get(key);
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', p.dot ? 'circle' : 'path');
      inkG.append(el);
      inkEls.set(key, el);
    }
    if (p.dot) {
      el.setAttribute('cx', p.world[0][0]);
      el.setAttribute('cy', p.world[0][1]);
      el.setAttribute('r', full ? 0.85 : 0);
      el.setAttribute('fill', INK);
      el.setAttribute('stroke', 'none');
    } else if (full) {
      el.setAttribute('d', pathOf(jittered(p)));
    }
    return el;
  }

  function layout() {
    const wrap = stage.parentElement;
    const cs = getComputedStyle(wrap);
    const availW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // Dar ekranda kâğıt tüm genişliği alır, panel altına iner ve sayfa kayar
    const narrow = matchMedia('(max-width: 1000px)').matches;
    const availH = narrow ? Infinity : wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const ratio = (2 * V) / (2 * V + TOP);
    const w = Math.max(240, Math.min(availW, availH * ratio));
    stage.style.width = `${w}px`;
    stage.style.height = `${w / ratio}px`;
    scale = w / (2 * V);
    const d = cfg.R * 2 * scale;
    const left = (V - cfg.R) * scale;
    const top = (TOP + V - cfg.R) * scale;
    for (const e of [lift, shadow]) {
      e.style.width = `${d}px`;
      e.style.height = `${d}px`;
      e.style.left = `${left}px`;
      e.style.top = `${top}px`;
    }
    const pinD = Math.max(12, 5.6 * scale);
    pin.style.width = `${pinD}px`;
    pin.style.height = `${pinD}px`;
    pin.style.left = `${V * scale - pinD / 2}px`;
    pin.style.top = `${(TOP + V) * scale - pinD / 2}px`;
    drawDisk();
  }

  /* ---------- Disk çizimi ---------- */

  function drawDisk() {
    const R = cfg.R;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(R * 2 * scale * dpr);
    canvas.width = px;
    canvas.height = px;
    const g = canvas.getContext('2d');
    const k = px / (2 * R);
    g.setTransform(k, 0, 0, k, px / 2, px / 2);
    g.clearRect(-R, -R, 2 * R, 2 * R);
    const grad = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#fdf8ef');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const trace = (p) => {
      g.beginPath();
      g.moveTo(p.disk[0][0], p.disk[0][1]);
      for (let i = 1; i < p.disk.length; i++) g.lineTo(p.disk[i][0], p.disk[i][1]);
    };
    const hole = (p, w) => {
      if (p.dot) {
        g.beginPath();
        g.arc(p.disk[0][0], p.disk[0][1], w / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        trace(p);
        g.lineWidth = w;
        g.stroke();
      }
    };
    // Kesik kenarı: kartonun kalınlığı gibi ince koyu çizgi
    g.strokeStyle = 'rgba(42,22,54,.62)';
    g.fillStyle = 'rgba(42,22,54,.62)';
    for (const p of disk.pieces) hole(p, cfg.slot + 0.6);
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = '#000';
    g.fillStyle = '#000';
    for (const p of disk.pieces) hole(p, cfg.slot);
    g.beginPath();
    g.arc(0, 0, 1.7, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // Kenar halkası, çentikler ve numaralar
    g.strokeStyle = 'rgba(42,22,54,.22)';
    g.lineWidth = 0.25;
    g.beginPath();
    g.arc(0, 0, R - cfg.rim, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#2a1636';
    g.strokeStyle = '#2a1636';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = (txt, x, y, a, fs) => {
      g.save();
      g.translate(x, y);
      g.rotate((a * Math.PI) / 180);
      g.font = `600 ${fs}px Fredoka, sans-serif`;
      g.fillText(txt, 0, fs * 0.04);
      if (txt === '6' || txt === '9') g.fillRect(-fs * 0.24, fs * 0.42, fs * 0.48, fs * 0.09);
      g.restore();
    };
    for (const s of disk.steps) {
      const a = -s.angle;
      const t1 = rotate([0, -R + 0.8], a);
      const t2 = rotate([0, -R + 4.2], a);
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(t1[0], t1[1]);
      g.lineTo(t2[0], t2[1]);
      g.stroke();
      const n = rotate([0, -R + 8.2], a);
      label(String(s.k + 1), n[0], n[1], a, cfg.steps > 40 ? 3.4 : 4);
    }
    for (const p of disk.pieces) label(String(p.step + 1), p.label[0], p.label[1], -disk.steps[p.step].angle, cfg.label);
    g.lineWidth = 0.5;
    g.beginPath();
    g.arc(0, 0, R - 0.25, 0, Math.PI * 2);
    g.stroke();
    hl.setAttribute('viewBox', `${-R} ${-R} ${2 * R} ${2 * R}`);
    lastHL = '';
    update();
  }

  /* ---------- Durum ---------- */

  const stepPieces = (k) => disk.steps[k].pieces.map((id) => disk.pieces[id]);
  const stepDone = (k) => stepPieces(k).every(isDone);
  const nextStep = () => {
    for (let k = 0; k < cfg.steps; k++) if (!stepDone(k)) return k;
    return -1;
  };
  const alignedStep = () => {
    for (let k = 0; k < cfg.steps; k++) if (Math.abs(norm(angle - disk.steps[k].angle)) < 0.75) return k;
    return -1;
  };

  function applyAngle() {
    diskEl.style.transform = `rotate(${angle}deg)`;
    const tick = Math.floor(norm(angle) / (360 / cfg.steps));
    if (lastTick !== null && tick !== lastTick) sfx.wheelTick();
    lastTick = tick;
  }

  function update() {
    if (!disk) return;
    const a = alignedStep();
    const nx = nextStep();
    const focus = a >= 0 ? a : nx;
    // Vurgu: hizalı adımın kesikleri, değilse sıradaki adımın kenar numarası
    const sig = `${a}|${nx}|${focus >= 0 ? stepPieces(focus).filter(isDone).length : 0}`;
    if (sig !== lastHL) {
      lastHL = sig;
      let s = '';
      if (a >= 0) {
        const open = stepPieces(a).filter((p) => !isDone(p));
        s += `<defs><mask id="biz-hm" maskUnits="userSpaceOnUse" x="${-cfg.R}" y="${-cfg.R}" width="${2 * cfg.R}" height="${2 * cfg.R}"><rect x="${-cfg.R}" y="${-cfg.R}" width="${2 * cfg.R}" height="${2 * cfg.R}" fill="#fff"/>`;
        s += open.map((p) => (p.dot ? `<circle cx="${p.disk[0][0]}" cy="${p.disk[0][1]}" r="${cfg.slot / 2}" fill="#000"/>` : `<path d="${pathOf(p.disk)}" stroke="#000" stroke-width="${cfg.slot}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)).join('');
        s += '</mask></defs><g mask="url(#biz-hm)">';
        s += open.map((p) => (p.dot ? `<circle class="biz-hl-slot" cx="${p.disk[0][0]}" cy="${p.disk[0][1]}" r="${cfg.slot / 2 + 1}"/>` : `<path class="biz-hl-slot" d="${pathOf(p.disk)}" stroke-width="${cfg.slot + 2}"/>`)).join('');
        s += '</g>';
      }
      if (nx >= 0 && a !== nx) {
        const t = rotate([0, -cfg.R + 8.2], -disk.steps[nx].angle);
        s += `<circle class="biz-hl-tick" cx="${t[0]}" cy="${t[1]}" r="3.6"/>`;
      }
      hl.innerHTML = s;
      stage.classList.toggle('is-aligned', a >= 0);
    }
    // Panel
    const k = focus >= 0 ? focus : cfg.steps - 1;
    stepK.textContent = String(k + 1);
    stepOf.textContent = `/ ${cfg.steps}`;
    const pieces = stepPieces(k);
    const left = pieces.filter((p) => !isDone(p)).length;
    let text;
    if (finished) text = 'Bitti! Resmi indirebilir ya da diski geri takıp baştan çizebilirsiniz.';
    else if (nx < 0 && diskIdx < set.disks.length - 1) text = `Bu disk bitti. Disk ${diskIdx + 2} takılıyor.`;
    else if (a < 0) text = `Diski çevir: kenardaki ${k + 1} numarasını BAŞLA okuna getir.`;
    else if (left === 0) text = nx >= 0 ? `${a + 1}. adım tamam. Sıradaki: ${nx + 1}.` : 'Son adım da tamam!';
    else text = `${a + 1} yazan ${pieces.length === 1 ? 'kesiğin' : `${pieces.length} kesiğin`} içinden kalemle geç${left < pieces.length ? `, ${left} tane kaldı` : ''}.`;
    stepText.textContent = text;
    stepDots.innerHTML = pieces.map((p) => `<i class="${isDone(p) ? 'on' : ''}"></i>`).join('');
    const n = doneCount();
    bar.style.transform = `scaleX(${n / total()})`;
    countEl.textContent = `${n} / ${total()} çizgi${set.disks.length > 1 ? ` · Disk ${diskIdx + 1}/${set.disks.length}` : ''}`;
    if (btn('draw')) btn('draw').disabled = a < 0 || left === 0 || finished;
    if (btn('turn')) btn('turn').disabled = nx < 0 || finished;
    if (btn('auto')) btn('auto').innerHTML = toHTML(autoplay ? html`${icon('pause')}Durdur` : html`${icon('play')}Kendiliğinden Çiz`);
  }

  /* ---------- Döndürme ---------- */

  let anim = null;
  function animateTo(target, ms = 520) {
    if (anim) anim();
    const from = angle;
    const delta = norm(target - from);
    const t0 = performance.now();
    return new Promise((resolve) => {
      if (reducedMotion() || Math.abs(delta) < 0.01) {
        angle = from + delta;
        applyAngle();
        update();
        resolve();
        return;
      }
      anim = life.raf((t) => {
        const u = Math.min(1, (t - t0) / ms);
        angle = from + delta * ease(u);
        applyAngle();
        if (u >= 1) {
          anim = null;
          update();
          resolve();
          return false;
        }
        return true;
      });
    });
  }

  const world = (e) => {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left) / scale - V, (e.clientY - r.top) / scale - V - TOP];
  };
  const deg = (p) => (Math.atan2(p[1], p[0]) * 180) / Math.PI;

  // Kesik üstünde mi: en yakın örnek noktası
  function nearest(p, w) {
    let best = Infinity;
    let at = 0;
    for (let i = 0; i < p.world.length; i++) {
      const d = Math.hypot(p.world[i][0] - w[0], p.world[i][1] - w[1]);
      if (d < best) { best = d; at = i; }
    }
    return { d: best, i: at };
  }

  let drag = null;
  life.on(stage, 'pointerdown', (e) => {
    if (busy || finished || e.button > 0) return;
    if (autoplay) stopAuto();
    const w = world(e);
    if (Math.hypot(w[0], w[1]) > cfg.R + 2) return;
    const a = alignedStep();
    if (a >= 0) {
      const reach = Math.max(cfg.slot / 2 + 1.6, 10 / scale);
      const hit = stepPieces(a).filter((p) => !isDone(p)).map((p) => ({ p, ...nearest(p, w) })).filter((h) => h.d < reach).sort((x, y) => x.d - y.d)[0];
      if (hit) {
        drag = { type: 'trace', last: w, step: a };
        traceAt(w, a);
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('is-tracing');
        e.preventDefault();
        return;
      }
    }
    if (anim) { anim(); anim = null; }
    drag = { type: 'rot', a0: deg(w), ang0: angle };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-turning');
    e.preventDefault();
  });
  life.on(stage, 'pointermove', (e) => {
    if (!drag) return;
    const w = world(e);
    if (drag.type === 'rot') {
      let next = drag.ang0 + norm(deg(w) - drag.a0);
      // Mıknatıs: adıma çok yaklaşınca yapışır
      for (const s of disk.steps) {
        if (Math.abs(norm(next - s.angle)) < 1.1) { next = s.angle + Math.round((next - s.angle) / 360) * 360; break; }
      }
      angle = next;
      applyAngle();
      update();
    } else {
      // Hızlı harekette aradaki noktalar da sayılır
      const [x0, y0] = drag.last;
      const n = Math.max(1, Math.ceil(Math.hypot(w[0] - x0, w[1] - y0) / 0.5));
      for (let i = 1; i <= n; i++) traceAt([x0 + ((w[0] - x0) * i) / n, y0 + ((w[1] - y0) * i) / n], drag.step);
      drag.last = w;
    }
  });
  const endDrag = () => {
    if (!drag) return;
    const was = drag;
    drag = null;
    stage.classList.remove('is-turning', 'is-tracing');
    if (was.type === 'rot') {
      let best = null;
      for (const s of disk.steps) {
        const d = Math.abs(norm(angle - s.angle));
        if (d < 3 && (!best || d < best.d)) best = { d, a: s.angle };
      }
      if (best) animateTo(best.a, 200).then(() => sfx.soft());
    }
  };
  life.on(stage, 'pointerup', endDrag);
  life.on(stage, 'pointercancel', endDrag);

  /* ---------- Çizme ---------- */

  function traceAt(w, k) {
    const reach = Math.max(cfg.slot / 2 + 1.6, 10 / scale);
    for (const p of stepPieces(k)) {
      if (isDone(p)) continue;
      const { d, i } = nearest(p, w);
      if (d > reach) continue;
      if (p.dot) { finishPiece(p); continue; }
      let c = cover.get(p.id);
      if (!c) { c = new Uint8Array(p.world.length); cover.set(p.id, c); }
      for (let j = Math.max(0, i - 3); j <= Math.min(c.length - 1, i + 3); j++) c[j] = 1;
      const frac = c.reduce((s, v) => s + v, 0) / c.length;
      if (frac >= 0.9) finishPiece(p);
      else drawPartial(p, c);
    }
  }

  function drawPartial(p, c) {
    const el = addInk(p, diskIdx, false);
    const pts = jittered(p);
    let d = '';
    let run = false;
    for (let i = 0; i < c.length; i++) {
      if (c[i]) {
        d += `${run ? 'L' : 'M'}${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
        run = true;
      } else run = false;
    }
    el.setAttribute('d', d);
  }

  function finishPiece(p, quiet = false) {
    if (isDone(p)) return;
    done.add(pKey(p));
    cover.delete(p.id);
    addInk(p, diskIdx, true);
    if (!quiet) sfx.pop(0.5);
    const k = p.step;
    if (stepDone(k) && !quiet) {
      sfx.success();
      const r = stage.getBoundingClientRect();
      burst(r.left + V * scale, r.top + (TOP - 4) * scale, { count: 16, power: 7, angle: -Math.PI / 2, spread: Math.PI });
    }
    save();
    update();
    checkDisk();
  }

  // Bir adımın çizgileri kalem gibi sırayla çizilir
  async function autoDraw(k, speed = 1) {
    const list = stepPieces(k).filter((p) => !isDone(p));
    for (const p of list) {
      if (!life.alive) return;
      if (p.dot) {
        finishPiece(p, true);
        sfx.soft();
        await life.sleep(110 / speed);
        continue;
      }
      const el = addInk(p, diskIdx, true);
      const len = el.getTotalLength ? el.getTotalLength() : 50;
      const ms = clamp(len * 22, 260, 900) / speed;
      if (!reducedMotion()) {
        await el.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], { duration: ms, easing: 'ease-in-out' }).finished.catch(() => {});
      }
      sfx.soft();
      finishPiece(p, true);
    }
    if (list.length) sfx.success();
  }

  async function checkDisk() {
    if (nextStep() >= 0) return;
    if (diskIdx < set.disks.length - 1) {
      busy = true;
      await life.sleep(500);
      lift.classList.add('gone');
      sfx.whoosh();
      await life.sleep(650);
      diskIdx++;
      disk = set.disks[diskIdx];
      save();
      angle = 0;
      applyAngle();
      drawDisk();
      lift.classList.remove('gone');
      lift.classList.add('enter');
      await life.sleep(700);
      lift.classList.remove('enter');
      toast(`Disk ${diskIdx + 1} takıldı. Kenardaki 1'den devam.`);
      busy = false;
      update();
      return;
    }
    finish();
  }

  async function finish(quiet = false) {
    if (finished) return;
    finished = true;
    autoplay = false;
    busy = true;
    update();
    if (!quiet) {
      await life.sleep(450);
      sfx.whoosh();
    }
    lift.classList.add('gone');
    stage.classList.add('is-finished');
    inkG.setAttribute('filter', 'url(#biz-pencil)');
    if (!quiet) await life.sleep(700);
    finale.hidden = false;
    if (!quiet) {
      sfx.fanfare();
      cannons();
    }
    busy = false;
    setActions(true);
    update();
  }

  /* ---------- Düğmeler ---------- */

  async function turnNext() {
    const nx = nextStep();
    if (nx < 0) return;
    sfx.click();
    await animateTo(disk.steps[nx].angle, 620);
    sfx.soft();
  }

  async function runAuto() {
    autoplay = true;
    update();
    while (autoplay && life.alive && !finished) {
      const nx = nextStep();
      if (nx < 0) break;
      if (alignedStep() !== nx) {
        await animateTo(disk.steps[nx].angle, 420);
        await life.sleep(120);
      }
      if (!autoplay) break;
      await autoDraw(nx, 2.2);
      await life.sleep(220);
      while (busy && life.alive) await life.sleep(100);
    }
    autoplay = false;
    update();
  }
  function stopAuto() {
    autoplay = false;
    update();
  }

  const peekOn = () => { if (!finished) { lift.classList.add('peek'); sfx.whoosh(); } };
  const peekOff = () => lift.classList.remove('peek');

  life.on(root, 'click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'turn') { stopAuto(); turnNext(); }
    else if (act === 'draw') {
      stopAuto();
      const a = alignedStep();
      if (a >= 0) { busy = true; await autoDraw(a); busy = false; update(); }
    } else if (act === 'auto') { if (autoplay) stopAuto(); else runAuto(); }
    else if (act === 'print') { sfx.click(); openPrint(); }
    else if (act === 'howto') { sfx.click(); openHowto(); }
    else if (act === 'reset') {
      const ok = await confirmSheet({ title: 'Baştan Başlansın mı?', text: 'Bu boyuttaki bütün çizgiler silinir.', ok: 'Sil ve Başla' });
      if (ok) { done.clear(); diskIdx = 0; save(); build(); }
    } else if (act === 'png') downloadPNG();
    else if (act === 'again') {
      sfx.click();
      done.clear();
      diskIdx = 0;
      save();
      build();
    }
  });

  function setActions(done) {
    root.querySelector('.biz-actions--play').innerHTML = toHTML(playActions(done));
    const b = btn('peek');
    if (!b) return;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); peekOn(); });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, peekOff);
    b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); peekOn(); } });
    b.addEventListener('keyup', peekOff);
  }

  life.on(window, 'keydown', (e) => {
    if ((e.target.closest && e.target.closest('input, textarea')) || finished || busy) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = 360 / cfg.steps;
      const cur = Math.round(-angle / step - 0.5);
      const k = ((cur + (e.key === 'ArrowRight' ? 1 : -1)) % cfg.steps + cfg.steps) % cfg.steps;
      animateTo(disk.steps[k].angle, 300).then(() => sfx.soft());
    }
  });

  // Önce eski ayarın ilerlemesi kaydedilir, sonra yeni ayar kendi ilerlemesiyle açılır
  const switchTo = (fn) => { save(); fn(); build(); save(); };
  bindSeg(root.querySelector('[data-seg="size"]'), { value: size, onChange: (v) => switchTo(() => { size = v; }) });
  bindSeg(root.querySelector('[data-seg="level"]'), { value: String(level), onChange: (v) => switchTo(() => { level = Number(v); }) });

  /* ---------- Yazdırma ---------- */

  function openPrint() {
    const pages = printPages(set);
    const thumbs = pages.replace(/ width="[\d.]+mm" height="[\d.]+mm"/g, '');
    openSheet(html`
      <h2 class="t-big t-accent">Kâğıt Sürümü</h2>
      <p class="biz-print-lead">${set.disks.length > 1 ? `${set.disks.length} disk sayfası` : 'Disk sayfası'} ve çizim kâğıdı ${SIZES[size].name} boyutunda çıkar. Yazdırırken ölçek <b>%100</b> (gerçek boyut) olsun, sayfaya sığdır kapalı kalsın.</p>
      <div class="biz-thumbs">${raw(thumbs)}</div>
      <ul class="biz-print-tips">
        <li><b>Disk:</b> 250-300 g karton. Gri kesikler kesilecek yerler.</li>
        <li><b>Lazer ya da Cricut:</b> kesim dosyasını ver, kırmızı çizgiler kesilir.</li>
        <li><b>Çizim kâğıdı:</b> normal kâğıt; birkaç tane basarsanız tekrar tekrar çizebilirsiniz.</li>
      </ul>
      <div class="biz-sheet-actions">
        <button class="btn btn--primary" data-act="doprint" data-primary>${icon('download')}Yazdır</button>
        ${set.disks.map((d, i) => html`<button class="btn" data-act="cut" data-i="${i}">${icon('download')}Kesim Dosyası${set.disks.length > 1 ? ` ${i + 1}` : ''} (SVG)</button>`)}
      </div>`, {
      wide: true,
      actions: {
        doprint: (t, ev, close) => { close(); setTimeout(doPrint, 260); },
        cut: (t) => downloadCut(Number(t.dataset.i)),
      },
    });
  }

  async function doPrint() {
    const host = document.createElement('div');
    host.className = 'biz-print';
    host.innerHTML = printPages(set);
    document.body.append(host);
    const st = document.createElement('style');
    st.textContent = `@page { size: ${cfg.page[0]}mm ${cfg.page[1]}mm; margin: 0; }`;
    document.head.append(st);
    document.body.classList.add('biz-printing');
    try { await document.fonts.ready; } catch { /* yazı tipi beklenmeden de basılır */ }
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      host.remove();
      st.remove();
      document.body.classList.remove('biz-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    life.add(cleanup);
    window.print();
  }

  function saveBlob(blob, file) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadCut(i) {
    toast('Kesim dosyası hazırlanıyor...', { ms: 1600 });
    await new Promise((r) => setTimeout(r, 60));
    const svg = cutFile(set, i);
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `dondur-ciz-${size}${set.disks.length > 1 ? `-disk${i + 1}` : ''}-kesim.svg`);
  }

  async function downloadPNG() {
    sfx.click();
    const S = 4096;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf1';
    g.fillRect(0, 0, S, S);
    const k = S / (2 * (cfg.R - cfg.rim + 6));
    g.setTransform(k, 0, 0, k, S / 2, S / 2 - 6 * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    set.disks.forEach((d) => {
      for (const p of d.pieces) {
        const pts = jittered(p);
        if (p.dot) {
          g.fillStyle = INK;
          g.beginPath();
          g.arc(pts[0][0], pts[0][1], 0.85, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        for (const [w, a] of [[1.2, 0.18], [0.62, 0.9]]) {
          g.strokeStyle = INK;
          g.globalAlpha = a;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(58,49,66,.7)';
    g.font = `700 ${S * 0.03}px Caveat, cursive`;
    g.textAlign = 'right';
    g.fillText('Anıtkabir · Biz', S * 0.95, S * 0.965);
    c.toBlob((b) => b && saveBlob(b, 'biz-dondur-ciz.png'), 'image/png');
  }

  function openHowto() {
    openSheet(html`
      <h2 class="t-big t-accent">Nasıl Yapılır?</h2>
      <ol class="biz-howto">
        <li><b>Yazdır.</b> Diski kalın kartona, çizim kâğıdını normal kâğıda bas. Ölçek %100.</li>
        <li><b>Kes.</b> Diskin dış çizgisini ve gri kesikleri maket bıçağıyla kes ya da kesim dosyasını lazer kesime veya Cricut'a ver.</li>
        <li><b>Tak.</b> Diski kâğıttaki kesikli daireye oturt, ortadan ayaklı raptiyeyle tuttur.</li>
        <li><b>Çiz.</b> Kenardaki 1'i BAŞLA okuna getir, yanında 1 yazan bütün kesiklerin içinden ince uçlu kalemle geç. Sonra 2, 3...</li>
        <li><b>Kaldır.</b> Son adımdan sonra diski kaldırın, sürpriz orada.</li>
      </ol>
      <p class="biz-print-lead">Dijitalde de aynısı: diski parmağınla ya da fareyle çevir, kesiklerin içinden çiz. Ok tuşları adım adım çevirir.</p>`);
  }

  // Stil dosyası geç yüklenebilir, pencere de değişebilir: alan her değiştiğinde kâğıt yeniden ölçülür
  let resizeT = 0;
  let lastSize = '';
  const ro = new ResizeObserver(() => {
    const wrap = stage.parentElement;
    const sig = `${wrap.clientWidth}x${wrap.clientHeight}`;
    if (sig === lastSize) return;
    lastSize = sig;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (cfg && life.alive) layout(); }, 60);
  });
  ro.observe(stage.parentElement);
  life.add(() => { ro.disconnect(); clearTimeout(resizeT); });

  // Yazı tipi gelmeden disk çizilirse numaralar yedek yazı tipiyle kalır
  build();
  document.fonts?.load('600 16px Fredoka').then(() => { if (life.alive && cfg) drawDisk(); }).catch(() => {});

  return {
    unmount: () => {
      autoplay = false;
      life.dispose();
    },
  };
}
