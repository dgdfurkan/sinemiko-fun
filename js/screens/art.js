// Ana menü kartlarındaki çizimler; üzerine gelince canlanırlar

import { html, raw } from '../lib/dom.js';
import { avatar } from '../ui/avatar.js';

const I = 'stroke="#2a1636" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"';

const reel = (cx) => `
  <g class="art-reel" style="transform-origin:${cx}px 66px">
    <circle cx="${cx}" cy="66" r="15" fill="#fff" ${I}/>
    <circle cx="${cx}" cy="66" r="5" fill="#2a1636"/>
    <path d="M${cx} 52v6M${cx} 74v6M${cx - 14} 66h6M${cx + 8} 66h6" ${I} stroke-width="3.5"/>
  </g>`;

export const ART = {
  reverse: `
  <svg class="art art-reverse" viewBox="0 0 240 170" aria-hidden="true">
    <g class="art-float">
      <rect x="22" y="22" width="196" height="122" rx="16" fill="#fff6ea" ${I}/>
      <rect x="42" y="36" width="156" height="52" rx="10" fill="#ffd0e4" ${I}/>
      <rect x="70" y="54" width="100" height="24" rx="12" fill="#2a1636"/>
      ${reel(94)}${reel(146)}
      <path d="M62 144l12-28h92l12 28" fill="#ffb0d2" ${I}/>
      <circle cx="40" cy="132" r="4" fill="#2a1636"/><circle cx="200" cy="132" r="4" fill="#2a1636"/>
      <text x="120" y="108" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="21" fill="#2a1636">ters kaset</text>
    </g>
    <g class="art-badge">
      <circle cx="206" cy="30" r="24" fill="#ffcd3c" ${I}/>
      <path d="M204 20l-11 10 11 10zM218 20l-11 10 11 10z" fill="#2a1636"/>
    </g>
  </svg>`,

  whisper: `
  <svg class="art art-whisper" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-float">
      <path d="M46 100V78a54 54 0 0 1 108 0v22" fill="none" stroke="#2a1636" stroke-width="16" stroke-linecap="round"/>
      <path d="M46 100V78a54 54 0 0 1 108 0v22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
      <rect x="28" y="84" width="34" height="52" rx="15" fill="#fff" ${I}/>
      <rect x="138" y="84" width="34" height="52" rx="15" fill="#fff" ${I}/>
      <rect x="36" y="94" width="18" height="32" rx="8" fill="#2ed6a0"/>
      <rect x="146" y="94" width="18" height="32" rx="8" fill="#2ed6a0"/>
    </g>
    <g class="art-note n1"><path d="M88 46V20l18-4v24" fill="none" ${I}/><circle cx="83" cy="47" r="7" fill="#2a1636"/><circle cx="101" cy="41" r="7" fill="#2a1636"/></g>
    <g class="art-note n2"><path d="M122 64V44l14-3" fill="none" ${I}/><circle cx="117" cy="65" r="6" fill="#2a1636"/></g>
  </svg>`,

  thisorthat: `
  <svg class="art art-tot" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-half-l"><path d="M100 18a57 57 0 0 0 0 114z" fill="#4fb6ff" ${I}/><path d="M66 62l-12 13 12 13" fill="none" ${I} stroke="#fff"/></g>
    <g class="art-half-r"><path d="M100 18a57 57 0 0 1 0 114z" fill="#ff6fae" ${I}/><path d="M134 62l12 13-12 13" fill="none" ${I} stroke="#fff"/></g>
    <g class="art-vs"><circle cx="100" cy="75" r="22" fill="#ffcd3c" ${I}/><text x="100" y="84" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="24" fill="#2a1636">mu</text></g>
  </svg>`,

  wavelength: `
  <svg class="art art-wave" viewBox="0 0 200 150" aria-hidden="true">
    <path d="M18 128a82 82 0 0 1 164 0z" fill="#fff6ea" ${I}/>
    <path d="M100 128 L128 52 A82 82 0 0 1 148 62 Z" fill="#ffcd3c"/>
    <path d="M100 128 L138 56 A82 82 0 0 1 143 59 Z" fill="#ff5fa2"/>
    <path d="M18 128a82 82 0 0 1 164 0z" fill="none" ${I}/>
    <g class="art-needle" style="transform-origin:100px 128px"><path d="M100 128 L100 58" ${I} stroke-width="6"/></g>
    <circle cx="100" cy="128" r="10" fill="#ff5fa2" ${I}/>
    <path d="M10 128h180" ${I}/>
  </svg>`,

  emoji: `
  <svg class="art art-emoji" viewBox="0 0 220 150" aria-hidden="true">
    <g class="art-face">
      <circle cx="78" cy="68" r="46" fill="#ffcd3c" ${I}/>
      <path d="M56 58c0-8 12-8 12 0M88 58c0-8 12-8 12 0" fill="none" ${I}/>
      <path d="M58 80q20 22 40 0z" fill="#2a1636" ${I}/>
      <path d="M102 34c0-7 9-7 9 0 0 6-9 11-9 11s-9-5-9-11c0-7 9-7 9 0z" fill="#ff5fa2" ${I} stroke-width="3"/>
    </g>
    <g class="art-buzzer">
      <rect x="140" y="104" width="64" height="26" rx="8" fill="#fff" ${I}/>
      <g class="art-dome"><path d="M148 106a24 24 0 0 1 48 0z" fill="#ff4f62" ${I}/><path d="M158 94a14 14 0 0 1 10-6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
    </g>
  </svg>`,

  truthdare: `
  <svg class="art art-wheel" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-spin" style="transform-origin:100px 80px">
      <circle cx="100" cy="80" r="60" fill="#fff" ${I}/>
      <path d="M100 80 L100 20 A60 60 0 0 1 152 50 Z" fill="#ff4f62"/>
      <path d="M100 80 L152 50 A60 60 0 0 1 152 110 Z" fill="#ffcd3c"/>
      <path d="M100 80 L152 110 A60 60 0 0 1 100 140 Z" fill="#4fb6ff"/>
      <path d="M100 80 L100 140 A60 60 0 0 1 48 110 Z" fill="#2ed6a0"/>
      <path d="M100 80 L48 110 A60 60 0 0 1 48 50 Z" fill="#a98bff"/>
      <path d="M100 80 L48 50 A60 60 0 0 1 100 20 Z" fill="#ff8a3d"/>
      <circle cx="100" cy="80" r="60" fill="none" ${I}/>
      <path d="M100 20v120M48 50l104 60M48 110l104-60" ${I} stroke-width="3"/>
      <circle cx="100" cy="80" r="11" fill="#fff" ${I}/>
    </g>
    <path d="M90 6h20l-10 18z" fill="#2a1636" ${I}/>
  </svg>`,
};

const likelyArt = () => html`<span class="art art-duo">${avatar(0, { pose: 'point-r', mood: 'smirk' })}<span class="lq">?</span>${avatar(1, { pose: 'point-l', mood: 'smirk' })}</span>`;

export const artFor = (id) => (id === 'likely' ? likelyArt() : raw(ART[id] || ''));
