// Oyunların ortak parçaları: lobi, yazı tura, final ekranı, kutlama

import { html } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar, setBlob } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../audio/sfx.js';
import { cannons, rain, burst } from '../fx/confetti.js';
import { artFor } from '../screens/art.js';

export const other = (i) => 1 - i;
export const pName = (i) => nameOf(i);
export const pSpan = (i) => html`<span class="t-p${i + 1}">${nameOf(i)}</span>`;

export function lobbyHTML({ game, rules, options, start = 'Başla', startIcon = 'play', note = '' }) {
  return html`
    <div class="lobby">
      <div class="lobby-intro" data-in>
        <div class="lobby-art">${artFor(game.id)}</div>
        <h1 class="t-title t-accent">${game.title}</h1>
        <ol class="rules">${rules.map((r, i) => html`<li><span class="rule-n">${i + 1}</span><span>${r}</span></li>`)}</ol>
      </div>
      <div class="lobby-panel card" data-in>
        ${options}
        <button class="btn btn--primary btn--big nudge" data-act="start" data-primary>${icon(startIcon)}${start}</button>
        ${note ? html`<p class="opt-note">${note}</p>` : ''}
      </div>
    </div>`;
}

export const optHTML = (label, control, note = '') => html`
  <div class="opt"><span class="opt-label">${label}</span>${control}${note ? html`<span class="opt-note">${note}</span>` : ''}</div>`;

export const FIRST_OPTIONS = () => [['0', nameOf(0)], ['1', nameOf(1)], ['random', 'Yazı Tura']];

// Kim başlayacak: yazı tura atar, sonucu sahnede gösterir
export async function coinFlip(stage, life, { title = 'Kim Başlıyor?' } = {}) {
  const result = Math.random() < 0.5 ? 0 : 1;
  const scene = stage.show(html`
    <h2 class="t-title" data-in>${title}</h2>
    <div class="coin-wrap" data-in>
      <div class="coin">
        <div class="coin-face f0">${avatar(0, { mood: 'wow' })}</div>
        <div class="coin-face f1">${avatar(1, { mood: 'wow' })}</div>
      </div>
    </div>
    <p class="t-big coin-result" data-in>&nbsp;</p>`);
  const coin = scene.querySelector('.coin');
  await life.sleep(500);
  sfx.whoosh();
  const turns = 6 + result * 0.5;
  const anim = coin.animate(
    [
      { transform: 'translateY(0) rotateY(0deg)' },
      { transform: `translateY(-120px) rotateY(${turns * 180}deg)`, offset: 0.5 },
      { transform: `translateY(0) rotateY(${turns * 360}deg)` },
    ],
    { duration: 1700, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
  );
  const ticker = life.interval(() => sfx.wheelTick(), 110);
  await anim.finished.catch(() => {});
  clearInterval(ticker);
  if (!life.alive) return result;
  sfx.success();
  const winner = coin.querySelector(`.f${result} .blob`);
  setBlob(winner, { mood: 'laugh', eyes: 'happy' });
  const out = scene.querySelector('.coin-result');
  out.innerHTML = '';
  out.append(Object.assign(document.createElement('span'), { className: `t-p${result + 1}`, textContent: nameOf(result) }), ' başlıyor!');
  out.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  const r = coin.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { count: 40, power: 10 });
  await life.sleep(1300);
  return result;
}

export function celebrate() {
  sfx.fanfare();
  cannons();
  rain({ duration: 2600 });
}

// İki oyunculu final: kazanan taçlı ve büyük, berabere ise ikisi de taçlı
// labels verilirse kürsüde puan yerine bu yazılar görünür (ör. süre, nota)
export function versusFinaleHTML(scores, { lines = {}, labels = null } = {}) {
  const [a, b] = scores;
  const winner = a === b ? -1 : a > b ? 0 : 1;
  const pod = (i) => {
    const win = winner === -1 || winner === i;
    return html`<div class="pod p${i} ${winner === i ? 'win' : ''}">
      ${avatar(i, win ? { mood: 'laugh', eyes: 'happy', pose: 'cheer', props: 'crown' } : { mood: 'smirk', props: 'sweat' })}
      <span class="pod-score">${labels ? labels[i] : scores[i]}</span>
      <span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span>
    </div>`;
  };
  const title = winner === -1 ? (lines.tie || 'Berabere!') : html`${pSpan(winner)} Kazandı!`;
  return { winner, html: html`<div class="podium" data-in>${pod(0)}${pod(1)}</div><h1 class="t-title" data-in>${title}</h1>` };
}

export function finaleButtons() {
  return html`<div class="row" data-in>
    <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
    <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
  </div>`;
}

/* ---------- Küçük hareket yardımcıları ---------- */

// Kartı yan çevirip içeriğini değiştirir, sonra geri döndürür
export async function flipEl(node, swap, { sound = 'flip' } = {}) {
  if (sound === 'rewind') sfx.rewind();
  else sfx.flip();
  const a = node.animate([{ transform: 'perspective(900px) rotateY(0)' }, { transform: 'perspective(900px) rotateY(90deg) scale(.95)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
  await a.finished.catch(() => {});
  swap();
  const b = node.animate([{ transform: 'perspective(900px) rotateY(-90deg) scale(.95)' }, { transform: 'perspective(900px) rotateY(0)' }], { duration: 560, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  a.cancel();
  await b.finished.catch(() => {});
}

export function popIn(nodes) {
  [...nodes].forEach((n, i) => n.animate(
    [{ opacity: 0, transform: 'translateY(16px) scale(.85)' }, { opacity: 1, transform: 'none' }],
    { duration: 480, delay: i * 70, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' },
  ));
}

export function bumpEl(node) {
  node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

export function shakeEl(node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}
