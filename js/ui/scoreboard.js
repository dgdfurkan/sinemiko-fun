// Üst çubuktaki skor tabelası; puanlar sahneden uçarak gelir

import { html, toHTML } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar } from './avatar.js';
import { sfx } from '../audio/sfx.js';

let root = null;
let scores = [0, 0];
let team = 0;
let mode = 'none';

export function initScoreboard(el) {
  root = el;
  root.classList.add('hidden');
}

function bump(node) {
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

export const scoreboard = {
  // mode: 'versus' iki oyuncu, 'team' ortak puan
  show({ mode: m = 'versus', mid = '', active = -1 } = {}) {
    mode = m;
    scores = [0, 0];
    team = 0;
    if (mode === 'team') {
      root.innerHTML = toHTML(html`
        <div class="sb-p sb-team p0">${avatar(0, { mood: 'happy' })}${avatar(1, { mood: 'happy' })}<span class="sb-name">Takım</span><span class="sb-score" data-score="team">0</span></div>
        <span class="sb-mid" data-mid>${mid}</span>`);
    } else {
      root.innerHTML = toHTML(html`
        <div class="sb-p p0" data-p="0">${avatar(0, { mood: 'happy' })}<span class="sb-name">${nameOf(0)}</span><span class="sb-score" data-score="0">0</span></div>
        <span class="sb-mid" data-mid>${mid}</span>
        <div class="sb-p p1" data-p="1">${avatar(1, { mood: 'happy' })}<span class="sb-name">${nameOf(1)}</span><span class="sb-score" data-score="1">0</span></div>`);
    }
    const midEl = root.querySelector('[data-mid]');
    midEl.hidden = !mid;
    this.setActive(active);
    root.classList.remove('hidden');
  },
  hide() {
    if (root) root.classList.add('hidden');
    mode = 'none';
  },
  setMid(text) {
    const m = root && root.querySelector('[data-mid]');
    if (!m) return;
    m.textContent = text;
    m.hidden = !text;
  },
  setActive(i) {
    if (!root) return;
    root.querySelectorAll('.sb-p[data-p]').forEach((p) => p.classList.toggle('active', Number(p.dataset.p) === i));
  },
  get(i) {
    return i === 'team' ? team : scores[i];
  },
  get scores() {
    return scores.slice();
  },
  get team() {
    return team;
  },
  // Puan yerine serbest bir değer gösterir (örneğin en iyi süre)
  setText(i, text) {
    const target = root && root.querySelector(`[data-score="${i}"]`);
    if (!target || target.textContent === text) return;
    target.textContent = text;
    bump(target.closest('.sb-p'));
  },
  // Puanı ekler; from verilirse "+3" rozeti o noktadan tabelaya uçar. quiet: sık puanlarda zil çalmaz
  add(i, pts, from, { quiet = false } = {}) {
    if (!root || !pts) return Promise.resolve();
    if (i === 'team') team += pts;
    else scores[i] += pts;
    const target = root.querySelector(`[data-score="${i}"]`);
    const pill = target && target.closest('.sb-p');
    const finish = () => {
      if (!target) return;
      target.textContent = String(i === 'team' ? team : scores[i]);
      bump(pill);
      if (!quiet) sfx.ding();
    };
    if (!from || !target) {
      finish();
      return Promise.resolve();
    }
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const chip = document.createElement('div');
    chip.className = 'score-fly';
    chip.textContent = `${pts > 0 ? '+' : ''}${pts}`;
    document.body.append(chip);
    const w = chip.offsetWidth;
    const h = chip.offsetHeight;
    const x0 = a.left + a.width / 2 - w / 2;
    const y0 = a.top + a.height / 2 - h / 2;
    const x1 = b.left + b.width / 2 - w / 2;
    const y1 = b.top + b.height / 2 - h / 2;
    const midX = (x0 + x1) / 2;
    const midY = Math.min(y0, y1) - 120;
    const anim = chip.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 30}px) scale(1.25)`, opacity: 1, offset: 0.22 },
        { transform: `translate(${midX}px, ${midY}px) scale(1.05)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x1}px, ${y1}px) scale(.55)`, opacity: 0.9 },
      ],
      { duration: 900, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' },
    );
    return anim.finished.then(
      () => { chip.remove(); finish(); },
      () => { chip.remove(); finish(); },
    );
  },
};
