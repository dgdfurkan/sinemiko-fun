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

  bomb: `
  <svg class="art art-bomb" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-bomb-body">
      <path d="M118 50 C124 30 142 20 160 26" fill="none" stroke="#2a1636" stroke-width="11" stroke-linecap="round"/>
      <path d="M118 50 C124 30 142 20 160 26" fill="none" stroke="#c98f55" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 5"/>
      <rect x="100" y="40" width="28" height="22" rx="6" transform="rotate(38 114 51)" fill="#7a68ad" ${I}/>
      <circle cx="88" cy="96" r="46" fill="#5b4a85" ${I}/>
      <ellipse cx="70" cy="76" rx="13" ry="7" transform="rotate(-38 70 76)" fill="#fff" opacity=".35"/>
      <ellipse cx="74" cy="96" rx="8" ry="10" fill="#fff"/><ellipse cx="100" cy="96" rx="8" ry="10" fill="#fff"/>
      <circle cx="75" cy="99" r="4" fill="#2a1636"/><circle cx="101" cy="99" r="4" fill="#2a1636"/>
      <ellipse cx="88" cy="118" rx="5" ry="6" fill="#fff"/>
    </g>
    <g class="art-spark"><path d="M160 10 L164 20 L174 24 L164 28 L160 38 L156 28 L146 24 L156 20 Z" fill="#ffcd3c" stroke="#ff8a3d" stroke-width="2.5"/></g>
  </svg>`,

  reflex: `
  <svg class="art art-reflex" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-watch">
      <rect x="86" y="8" width="28" height="16" rx="5" fill="#fff" ${I}/>
      <circle cx="100" cy="82" r="56" fill="#fff" ${I}/>
      <circle cx="100" cy="82" r="43" fill="#ecfbd6"/>
      <g class="art-hand" style="transform-origin:100px 82px"><path d="M100 82 L100 48" ${I} stroke-width="6"/></g>
      <circle cx="100" cy="82" r="8" fill="#ff4f62" ${I}/>
    </g>
    <path class="art-bolt" d="M156 18 L132 66 L150 66 L136 112 L178 54 L158 54 L172 18 Z" fill="#ffcd3c" ${I}/>
  </svg>`,

  draw: `
  <svg class="art art-draw" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="18" y="14" width="164" height="122" rx="14" fill="#fff" ${I}/>
    <path class="art-scribble" d="M40 102 C58 46 80 124 100 70 S140 38 152 92" fill="none" stroke="#ff4f62" stroke-width="7" stroke-linecap="round"/>
    <circle cx="52" cy="44" r="10" fill="#ffcd3c" ${I} stroke-width="3"/>
    <g class="art-pencil"><g transform="translate(150 86) rotate(32)">
      <rect x="-9" y="-62" width="18" height="54" fill="#ffcd3c" ${I}/>
      <rect x="-9" y="-72" width="18" height="12" rx="3" fill="#ff8fab" ${I}/>
      <path d="M-9 -8 L0 12 L9 -8 Z" fill="#ffd9b8" ${I}/>
    </g></g>
  </svg>`,

  tabu: `
  <svg class="art art-tabu" viewBox="0 0 200 150" aria-hidden="true">
    <path d="M34 26 h112 a20 20 0 0 1 20 20 v50 a20 20 0 0 1 -20 20 h-66 l-28 24 v-24 h-18 a20 20 0 0 1 -20 -20 v-50 a20 20 0 0 1 20 -20 z" fill="#fff" ${I}/>
    <g class="art-dots"><circle cx="64" cy="71" r="8" fill="#2a1636"/><circle cx="90" cy="71" r="8" fill="#2a1636"/><circle cx="116" cy="71" r="8" fill="#2a1636"/></g>
    <g class="art-ban"><circle cx="160" cy="40" r="26" fill="#fff" stroke="#2a1636" stroke-width="10"/><circle cx="160" cy="40" r="26" fill="none" stroke="#ff4f62" stroke-width="6"/><path d="M142 22 L178 58" stroke="#2a1636" stroke-width="10" stroke-linecap="round"/><path d="M142 22 L178 58" stroke="#ff4f62" stroke-width="5" stroke-linecap="round"/></g>
  </svg>`,

  quiz: `
  <svg class="art art-quiz" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-h1"><path d="M70 112 C26 84 34 40 70 62 C106 40 114 84 70 112 Z" fill="#4fb6ff" ${I}/></g>
    <g class="art-h2"><path d="M130 112 C86 84 94 40 130 62 C166 40 174 84 130 112 Z" fill="#ff6fae" ${I}/></g>
    <g class="art-qm"><circle cx="100" cy="36" r="24" fill="#ffcd3c" ${I}/><path d="M91 30a9 9 0 1 1 12 8c-2 1-3 3-3 5v2" fill="none" ${I} stroke-width="5"/><circle cx="100" cy="51" r="3.2" fill="#2a1636"/></g>
  </svg>`,

  meld: `
  <svg class="art art-meld" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-b1"><circle cx="56" cy="86" r="32" fill="#4fb6ff" ${I}/><circle cx="30" cy="128" r="8" fill="#4fb6ff" ${I}/></g>
    <g class="art-b2"><circle cx="144" cy="86" r="32" fill="#ff6fae" ${I}/><circle cx="170" cy="128" r="8" fill="#ff6fae" ${I}/></g>
    <g class="art-bulb">
      <path d="M100 18 a26 26 0 0 1 16 46 v10 h-32 v-10 a26 26 0 0 1 16 -46 z" fill="#ffcd3c" ${I}/>
      <rect x="86" y="76" width="28" height="12" rx="4" fill="#fff" ${I}/>
      <path d="M100 6 v-0 M64 30 l-8 -6 M136 30 l8 -6" ${I}/>
    </g>
  </svg>`,

  pose: `
  <svg class="art art-pose" viewBox="0 0 200 150" aria-hidden="true">
    <path d="M30 34V20h16M170 34V20h-16M30 118v14h16M170 118v14h-16" fill="none" ${I} stroke-width="5"/>
    <circle class="art-rec" cx="48" cy="40" r="5.5" fill="#ff4f62"/>
    <g class="art-fig">
      <path d="M93 104l-6 30M107 104l6 30" ${I} stroke-width="12"/>
      <path d="M93 104l-6 30M107 104l6 30" stroke="#ffcd3c" stroke-width="6" stroke-linecap="round"/>
      <path d="M88 72h24l-3 34H91z" fill="#ffcd3c" ${I} stroke-width="4"/>
      <g class="art-arm-l"><path d="M89 74L74 54L64 34" fill="none" ${I} stroke-width="12"/><path d="M89 74L74 54L64 34" fill="none" stroke="#ffcd3c" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="34" r="6" fill="#fff" ${I} stroke-width="3.5"/></g>
      <g class="art-arm-r"><path d="M111 74L126 54L136 34" fill="none" ${I} stroke-width="12"/><path d="M111 74L126 54L136 34" fill="none" stroke="#ffcd3c" stroke-width="6" stroke-linecap="round"/><circle cx="136" cy="34" r="6" fill="#fff" ${I} stroke-width="3.5"/></g>
      <circle cx="100" cy="54" r="14" fill="#ffcd3c" ${I} stroke-width="4"/>
      <circle cx="95" cy="52" r="2.4" fill="#2a1636"/><circle cx="105" cy="52" r="2.4" fill="#2a1636"/>
      <path d="M94 58q6 5 12 0" fill="none" ${I} stroke-width="3"/>
    </g>
    <g class="art-badge"><path d="M160 54l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#fff" ${I} stroke-width="3"/></g>
  </svg>`,

  popper: `
  <svg class="art art-popper" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-bub b1"><circle cx="56" cy="98" r="22" fill="#ffc2dc" ${I}/><path d="M44 90a14 14 0 0 1 8-8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>
    <g class="art-bub b2"><circle cx="94" cy="56" r="17" fill="#c6f28e" ${I}/><path d="M85 50a10 10 0 0 1 6-6" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></g>
    <g class="art-bub b3"><circle cx="150" cy="42" r="19" fill="#ffcd3c" ${I}/><text x="150" y="49" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="19" fill="#2a1636">+3</text></g>
    <g class="art-pop"><path d="M124 92l-10-8M132 84l-2-13M140 92l11-6M122 102l-12 2" ${I} stroke-width="4.5"/></g>
    <g class="art-glove"><circle cx="140" cy="110" r="17" fill="#4fb6ff" stroke="#fff" stroke-width="5"/><circle cx="140" cy="110" r="21" fill="none" ${I} stroke-width="3.5"/></g>
  </svg>`,

  mirror: `
  <svg class="art art-mirror" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-cat c1">
      <path d="M50 102l-4 32M62 102l4 32" ${I} stroke-width="11"/>
      <path d="M44 72h24l-3 32H47z" fill="#ff6fae" ${I} stroke-width="4"/>
      <path d="M45 74L30 62L22 70M67 74L80 54L92 46" fill="none" ${I} stroke-width="11"/>
      <path d="M45 74L30 62L22 70M67 74L80 54L92 46" fill="none" stroke="#ff6fae" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M44 46l3-14 9 9M68 46l-3-14-9 9" fill="#ff6fae" ${I} stroke-width="3.5"/>
      <circle cx="56" cy="54" r="14" fill="#ff6fae" ${I} stroke-width="4"/>
      <circle cx="51" cy="53" r="2.3" fill="#2a1636"/><circle cx="61" cy="53" r="2.3" fill="#2a1636"/><path d="M53 59l3 2 3-2" fill="none" ${I} stroke-width="2.5"/>
    </g>
    <g class="art-cat c2">
      <path d="M138 102l-4 32M150 102l4 32" ${I} stroke-width="11"/>
      <path d="M132 72h24l-3 32h-18z" fill="#fff" ${I} stroke-width="4" stroke-dasharray="7 6"/>
      <path d="M133 74L118 62L110 70M155 74L168 54L180 46" fill="none" ${I} stroke-width="11"/>
      <path d="M133 74L118 62L110 70M155 74L168 54L180 46" fill="none" stroke="#4fb6ff" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M132 46l3-14 9 9M156 46l-3-14-9 9" fill="#4fb6ff" ${I} stroke-width="3.5"/>
      <circle cx="144" cy="54" r="14" fill="#4fb6ff" ${I} stroke-width="4"/>
      <circle cx="139" cy="53" r="2.3" fill="#2a1636"/><circle cx="149" cy="53" r="2.3" fill="#2a1636"/><path d="M141 59l3 2 3-2" fill="none" ${I} stroke-width="2.5"/>
    </g>
    <path class="art-eq" d="M92 92h16M92 102h16" ${I} stroke-width="5"/>
  </svg>`,

  faces: `
  <svg class="art art-faces" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-pol">
      <rect x="52" y="14" width="96" height="118" rx="8" fill="#fff" ${I}/>
      <rect x="62" y="24" width="76" height="76" rx="4" fill="#ffe7b0" stroke="#2a1636" stroke-width="2.5"/>
      <g class="art-face-in">
        <circle cx="100" cy="64" r="28" fill="#ffd23f" ${I} stroke-width="4"/>
        <ellipse cx="90" cy="58" rx="5" ry="6.5" fill="#fff" ${I} stroke-width="2.6"/><circle cx="90" cy="60" r="2.6" fill="#2a1636"/>
        <path d="M104 59q6-6 12 0" fill="none" ${I} stroke-width="3"/>
        <path d="M97 72q5 2 0 4.5q5 2 0 4.5" fill="none" ${I} stroke-width="3"/>
        <ellipse cx="84" cy="70" rx="4.5" ry="3" fill="#ff8fab"/><ellipse cx="116" cy="70" rx="4.5" ry="3" fill="#ff8fab"/>
      </g>
      <text x="100" y="122" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="19" fill="#2a1636">öpücük!</text>
    </g>
    <g class="art-flash"><path d="M168 30l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2z" fill="#ffcd3c" ${I} stroke-width="3"/></g>
    <path class="art-heart-f" d="M36 56c-4-7-14-4-12 3 1 6 12 12 12 12s11-6 12-12c2-7-8-10-12-3z" fill="#ff5fa2" ${I} stroke-width="3"/>
  </svg>`,

  nolaugh: `
  <svg class="art art-nolaugh" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-stone">
      <circle cx="84" cy="66" r="44" fill="#ffd23f" ${I}/>
      <path d="M62 54h14M92 54h14" ${I} stroke-width="4.5"/>
      <circle cx="69" cy="62" r="3.6" fill="#2a1636"/><circle cx="99" cy="62" r="3.6" fill="#2a1636"/>
      <path d="M70 86q14 4 28 0" fill="none" ${I} stroke-width="4.5"/>
      <path d="M118 44c-4 7-5 11 0 13 5 1 7-4 3-10z" fill="#9fdcff" ${I} stroke-width="2.5"/>
    </g>
    <g class="art-feather">
      <path d="M150 40c18 6 26 30 14 52-14-2-26-24-14-52z" fill="#fff" ${I} stroke-width="3.5"/>
      <path d="M150 40c4 18 8 36 14 52M158 92l-6 18" fill="none" ${I} stroke-width="3"/>
    </g>
    <rect x="44" y="122" width="84" height="14" rx="7" fill="#fff" ${I} stroke-width="3.5"/>
    <rect class="art-meter" x="46" y="124" width="62" height="10" rx="5" fill="#ff4f62"/>
  </svg>`,

  stare: `
  <svg class="art art-stare" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-eye e1">
      <circle cx="64" cy="74" r="34" fill="#fff" ${I}/>
      <path d="M44 64l6 4M42 82l7-2M82 92l-5-5" stroke="#ff6f7f" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="72" cy="76" r="14" fill="#4b6bff" ${I} stroke-width="3.5"/><circle cx="74" cy="76" r="6.5" fill="#2a1636"/><circle cx="69" cy="71" r="3" fill="#fff"/>
      <path class="art-lid" d="M30 74a34 34 0 0 1 68 0z" fill="#ffd2a8" ${I} stroke-width="4"/>
      <path d="M32 30l40 10" ${I} stroke-width="6"/>
    </g>
    <g class="art-eye e2">
      <circle cx="136" cy="74" r="34" fill="#fff" ${I}/>
      <path d="M156 64l-6 4M158 82l-7-2M118 92l5-5" stroke="#ff6f7f" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="128" cy="76" r="14" fill="#ff6fae" ${I} stroke-width="3.5"/><circle cx="126" cy="76" r="6.5" fill="#2a1636"/><circle cx="123" cy="71" r="3" fill="#fff"/>
      <path class="art-lid" d="M102 74a34 34 0 0 1 68 0z" fill="#ffd2a8" ${I} stroke-width="4"/>
      <path d="M168 30l-40 10" ${I} stroke-width="6"/>
    </g>
    <path class="art-zap" d="M100 112l-8 12h10l-6 14" fill="none" stroke="#ffcd3c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  chipmunk: `
  <svg class="art art-chip" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-chip-face">
      <circle cx="62" cy="42" r="16" fill="#b97a45" ${I}/><circle cx="62" cy="42" r="7" fill="#ffb3c8"/>
      <circle cx="138" cy="42" r="16" fill="#b97a45" ${I}/><circle cx="138" cy="42" r="7" fill="#ffb3c8"/>
      <ellipse cx="100" cy="82" rx="54" ry="50" fill="#c98a52" ${I}/>
      <ellipse cx="72" cy="98" rx="20" ry="16" fill="#f2cfa6"/><ellipse cx="128" cy="98" rx="20" ry="16" fill="#f2cfa6"/>
      <ellipse cx="80" cy="72" rx="8" ry="10" fill="#fff" ${I} stroke-width="3"/><ellipse cx="120" cy="72" rx="8" ry="10" fill="#fff" ${I} stroke-width="3"/>
      <circle cx="81" cy="74" r="4.5" fill="#2a1636"/><circle cx="121" cy="74" r="4.5" fill="#2a1636"/>
      <ellipse cx="100" cy="88" rx="7" ry="5" fill="#2a1636"/>
      <rect x="92" y="98" width="16" height="16" rx="3" fill="#fff" ${I} stroke-width="3"/><path d="M100 98v16" stroke="#2a1636" stroke-width="3"/>
    </g>
    <g class="art-speed"><path d="M14 64h28M8 82h30M16 100h22" ${I} stroke-width="5"/></g>
    <g class="art-note n1"><path d="M166 40V18l14-3v18" fill="none" ${I}/><circle cx="162" cy="41" r="6" fill="#2a1636"/><circle cx="176" cy="35" r="6" fill="#2a1636"/></g>
  </svg>`,

  hum: `
  <svg class="art art-hum" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-hum-face">
      <circle cx="86" cy="80" r="52" fill="#ffcd3c" ${I}/>
      <path d="M62 70q8-8 16 0M94 70q8-8 16 0" fill="none" ${I}/>
      <path d="M70 100q8 6 16 0t16 0" fill="none" ${I}/>
      <ellipse cx="58" cy="88" rx="7" ry="5" fill="#ff8fab" opacity=".7"/><ellipse cx="114" cy="88" rx="7" ry="5" fill="#ff8fab" opacity=".7"/>
    </g>
    <g class="art-note n1"><path d="M150 52V28l16-4v22" fill="none" ${I}/><circle cx="146" cy="53" r="6.5" fill="#2a1636"/><circle cx="162" cy="47" r="6.5" fill="#2a1636"/></g>
    <g class="art-note n2"><path d="M176 96V76" fill="none" ${I}/><circle cx="171" cy="97" r="6" fill="#2a1636"/><path d="M176 76l10 4" ${I}/></g>
    <path class="art-wave" d="M140 120q8-10 16 0t16 0t16 0" fill="none" stroke="#2a1636" stroke-width="4" stroke-linecap="round"/>
  </svg>`,

  twister: `
  <svg class="art art-twist" viewBox="0 0 200 150" aria-hidden="true">
    <ellipse cx="74" cy="72" rx="58" ry="46" fill="#fff" ${I}/>
    <path d="M38 64 Q74 44 110 64 Q74 112 38 64 Z" fill="#2a1636"/>
    <g class="art-tongue"><path d="M92 82 C122 88 150 70 150 50 C150 32 128 30 124 46 C120 60 140 62 142 50" fill="none" stroke="#2a1636" stroke-width="17" stroke-linecap="round"/><path d="M92 82 C122 88 150 70 150 50 C150 32 128 30 124 46 C120 60 140 62 142 50" fill="none" stroke="#ff7a8f" stroke-width="10" stroke-linecap="round"/></g>
    <g class="art-stars"><path d="M168 98l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#ffcd3c" ${I} stroke-width="3"/></g>
  </svg>`,

  echo: `
  <svg class="art art-echo" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-echo-ph">
      <path d="M40 92V74a40 40 0 0 1 80 0v18" fill="none" stroke="#2a1636" stroke-width="13" stroke-linecap="round"/>
      <path d="M40 92V74a40 40 0 0 1 80 0v18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <rect x="26" y="80" width="26" height="40" rx="11" fill="#2ed6a0" ${I}/>
      <rect x="108" y="80" width="26" height="40" rx="11" fill="#2ed6a0" ${I}/>
    </g>
    <g class="art-arc a1"><path d="M146 62a22 22 0 0 1 0 40" fill="none" ${I} stroke-width="5"/></g>
    <g class="art-arc a2"><path d="M160 50a40 40 0 0 1 0 64" fill="none" ${I} stroke-width="5"/></g>
    <g class="art-arc a3"><path d="M174 38a58 58 0 0 1 0 88" fill="none" ${I} stroke-width="5"/></g>
  </svg>`,

  balloon: `
  <svg class="art art-balloon" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-bal">
      <path d="M100 118 C94 128 106 136 98 148" stroke="#2a1636" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M93 114 L107 114 L100 122 Z" fill="#ff5a7a" ${I} stroke-width="3.5"/>
      <path d="M100 8 C134 8 150 34 148 62 C146 92 124 114 100 114 C76 114 54 92 52 62 C50 34 66 8 100 8 Z" fill="#ff5a7a" ${I}/>
      <ellipse cx="80" cy="34" rx="9" ry="16" transform="rotate(24 80 34)" fill="#fff" opacity=".45"/>
      <ellipse cx="88" cy="62" rx="6" ry="8" fill="#fff" ${I} stroke-width="3"/><ellipse cx="112" cy="62" rx="6" ry="8" fill="#fff" ${I} stroke-width="3"/>
      <circle cx="89" cy="64" r="3" fill="#2a1636"/><circle cx="113" cy="64" r="3" fill="#2a1636"/>
      <ellipse cx="100" cy="82" rx="6" ry="7" fill="#2a1636"/>
    </g>
    <g class="art-puff"><path d="M30 116q10-8 20 0M24 98q12-10 24 0M156 110q10-8 20 0" fill="none" ${I} stroke-width="4"/></g>
  </svg>`,
};

const likelyArt = () => html`<span class="art art-duo">${avatar(0, { pose: 'point-r', mood: 'smirk' })}<span class="lq">?</span>${avatar(1, { pose: 'point-l', mood: 'smirk' })}</span>`;

export const artFor = (id) => (id === 'likely' ? likelyArt() : raw(ART[id] || ''));
