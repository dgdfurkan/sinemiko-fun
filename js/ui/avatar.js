// Furkan ve Sinem'in blob karakterleri: ruh hali, poz ve aksesuarla değişir

import { raw } from '../lib/dom.js';

export const PLAYER_COLORS = ['#4fb6ff', '#ff6fae'];

const BODY = 'M0,-48 C28,-48 46,-28 46,2 C46,32 28,48 0,48 C-28,48 -46,32 -46,2 C-46,-28 -28,-48 0,-48 Z';

// Furkan: açık kahve topuz, sakal
const FURKAN_BACK = `
  <circle class="ink" cx="14" cy="-54" r="10" fill="#9c6a3d"/>`;
const FURKAN_FRONT = `
  <path class="ink" d="M-39,8 C-37,33 -20,45 0,45 C20,45 37,33 39,8 C33,25 18,33 0,33 C-18,33 -33,25 -39,8 Z" fill="#9a6a40"/>`;
const FURKAN_HAIR = `
  <path class="ink" d="M-42,-12 C-44,-40 -22,-52 2,-51 C26,-50 44,-38 42,-12 C36,-25 24,-31 10,-30 C0,-29 -8,-25 -14,-20 C-22,-27 -34,-24 -42,-12 Z" fill="#b07a48"/>
  <path d="M8,-46 L19,-47" stroke="#2a1636" stroke-width="4" stroke-linecap="round"/>`;

// Sinem: koyu kahve dalgalı saç, yuvarlak gözlük, halka küpe
const SINEM_BACK = `
  <path class="ink" d="M-44,-22 C-58,-2 -54,22 -52,36 C-49,44 -41,43 -39,36 C-36,42 -28,42 -27,34 L27,34 C28,42 36,42 39,36 C41,43 49,44 52,36 C54,22 58,-2 44,-22 Z" fill="#4a2a20"/>`;
const SINEM_HAIR = `
  <path class="ink" d="M-45,-8 C-48,-40 -25,-53 0,-53 C25,-53 48,-40 45,-8 C41,-19 35,-24 27,-25 C22,-19 13,-21 9,-28 C3,-21 -8,-20 -14,-27 C-20,-21 -30,-21 -36,-24 C-40,-20 -43,-15 -45,-8 Z" fill="#4a2a20"/>`;
const SINEM_GLASSES = `
  <g class="b-glasses" fill="none" stroke="#2a1636" stroke-linecap="round">
    <circle cx="-16" cy="-4" r="12.5" stroke-width="3.4" fill="#ffffff26"/>
    <circle cx="16" cy="-4" r="12.5" stroke-width="3.4" fill="#ffffff26"/>
    <path d="M-3.5,-6 Q0,-9 3.5,-6 M-28.5,-6 L-41,-9 M28.5,-6 L41,-9" stroke-width="3.2"/>
  </g>
  <g fill="none">
    <circle cx="-46" cy="13" r="5.5" stroke="#2a1636" stroke-width="5.6"/>
    <circle cx="-46" cy="13" r="5.5" stroke="#ffcd3c" stroke-width="2.6"/>
    <circle cx="46" cy="13" r="5.5" stroke="#2a1636" stroke-width="5.6"/>
    <circle cx="46" cy="13" r="5.5" stroke="#ffcd3c" stroke-width="2.6"/>
  </g>`;

const FACE = `
  <ellipse class="b-cheek" cx="-27" cy="9" rx="6" ry="4"/>
  <ellipse class="b-cheek" cx="27" cy="9" rx="6" ry="4"/>`;

const EYES = `
  <g class="b-eyes">
    <ellipse class="b-white ink" cx="-16" cy="-4" rx="8.5" ry="10"/>
    <ellipse class="b-white ink" cx="16" cy="-4" rx="8.5" ry="10"/>
    <g class="b-pupils">
      <circle cx="-16" cy="-3" r="4.6"/>
      <circle cx="16" cy="-3" r="4.6"/>
      <circle class="b-shine-dot" cx="-14.4" cy="-5" r="1.5"/>
      <circle class="b-shine-dot" cx="17.6" cy="-5" r="1.5"/>
    </g>
  </g>
  <path class="b-shut" d="M-23,-3 Q-16,3 -9,-3 M9,-3 Q16,3 23,-3"/>
  <path class="b-happy" d="M-23,-1 Q-16,-10 -9,-1 M9,-1 Q16,-10 23,-1"/>`;

const MOUTH = `
  <g class="b-mouth">
    <path class="m-smile m-line" d="M-9,14 Q0,23 9,14"/>
    <g class="m-laugh"><path class="m-fill" d="M-11,12 Q0,31 11,12 Z"/><path class="m-tongue" d="M-5.5,21.5 Q0,27 5.5,21.5 Q0,18.5 -5.5,21.5 Z"/></g>
    <ellipse class="m-wow m-fill" cx="0" cy="18" rx="5" ry="6.5"/>
    <path class="m-sad m-line" d="M-8,21 Q0,13 8,21"/>
    <path class="m-flat m-line" d="M-7,17.5 L7,17.5"/>
    <path class="m-smirk m-line" d="M-8,16 Q2,22 10,12"/>
  </g>`;

const PROPS = `
  <g class="b-prop p-phones">
    <path d="M-44,-4 C-46,-68 46,-68 44,-4" fill="none" stroke="#2a1636" stroke-width="10" stroke-linecap="round"/>
    <path d="M-44,-4 C-46,-68 46,-68 44,-4" fill="none" stroke="#2ed6a0" stroke-width="4.5" stroke-linecap="round"/>
    <rect class="ink" x="-55" y="-20" width="15" height="28" rx="7" fill="#2ed6a0"/>
    <rect class="ink" x="40" y="-20" width="15" height="28" rx="7" fill="#2ed6a0"/>
  </g>
  <g class="b-prop p-mic">
    <path d="M18,20 L27,34" stroke="#2a1636" stroke-width="7" stroke-linecap="round"/>
    <circle class="ink" cx="16" cy="16" r="8" fill="#d8d0e6"/>
    <path d="M11,13 L21,13 M10,17 L22,17" stroke="#2a1636" stroke-width="1.6" stroke-linecap="round"/>
  </g>
  <g class="b-prop p-crown">
    <path class="ink" d="M-17,-50 L-19,-69 L-8,-60 L0,-74 L8,-60 L19,-69 L17,-50 Z" fill="#ffcd3c"/>
    <circle cx="0" cy="-58" r="3" fill="#ff5fa2" stroke="#2a1636" stroke-width="2"/>
  </g>
  <g class="b-prop p-heart">
    <path class="ink" d="M40,-40 C40,-50 30,-52 28,-44 C26,-52 16,-50 16,-40 C16,-32 28,-26 28,-26 C28,-26 40,-32 40,-40 Z" fill="#ff5fa2"/>
  </g>
  <g class="b-prop p-sweat">
    <path class="ink" d="M-34,-36 C-38,-30 -40,-26 -36,-23 C-32,-21 -29,-25 -31,-29 Z" fill="#9fdcff"/>
  </g>`;

let uid = 0;

export function avatar(i, { mood = 'happy', pose = 'rest', eyes = 'open', props = '', cls = '' } = {}) {
  const c = PLAYER_COLORS[i];
  const p1 = i === 0;
  const delay = `--bd:${(-(uid * 0.37) % 2.8).toFixed(2)}s;--bk:${(-(uid++ * 1.13) % 5.2).toFixed(2)}s`;
  return raw(`<svg class="blob blob-p${i} ${cls}" data-mood="${mood}" data-pose="${pose}" data-eyes="${eyes}" data-prop="${props}" viewBox="0 0 140 150" style="${delay}" aria-hidden="true">
  <g transform="translate(70 84)">
    <ellipse class="b-shadow" cx="0" cy="52" rx="34" ry="6"/>
    <g class="b-bob">
      ${p1 ? FURKAN_BACK : SINEM_BACK}
      <g class="b-body">
        <path class="ink" d="${BODY}" fill="${c}"/>
        <ellipse class="b-shine" cx="-21" cy="-27" rx="10" ry="5.5" transform="rotate(-32 -21 -27)"/>
      </g>
      ${FACE}
      ${p1 ? FURKAN_FRONT : ''}
      ${p1 ? FURKAN_HAIR : SINEM_HAIR}
      ${EYES}
      ${p1 ? '' : SINEM_GLASSES}
      ${MOUTH}
      ${PROPS}
      <g class="b-hand b-hand-l"><circle class="ink" r="9.5" fill="${c}"/></g>
      <g class="b-hand b-hand-r"><circle class="ink" r="9.5" fill="${c}"/></g>
    </g>
  </g>
</svg>`);
}

export function setBlob(svg, { mood, pose, eyes, props } = {}) {
  if (!svg) return;
  if (mood !== undefined) svg.dataset.mood = mood;
  if (pose !== undefined) svg.dataset.pose = pose;
  if (eyes !== undefined) svg.dataset.eyes = eyes;
  if (props !== undefined) svg.dataset.prop = props;
}

// Tek seferlik tepki animasyonu: jump, wiggle
export function react(svg, kind = 'jump') {
  if (!svg) return;
  svg.classList.remove('jump', 'wiggle');
  void svg.getBoundingClientRect();
  svg.classList.add(kind);
  setTimeout(() => svg.classList.remove(kind), 750);
}
