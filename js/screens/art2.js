// 11. turda eklenen oyunların kart çizimleri; üzerine gelince ya da vitrinde canlanırlar

const I = 'stroke="#2a1636" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"';
const T = 'stroke="#2a1636" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const eyes = (x, y, d = 9) => `<circle cx="${x - d}" cy="${y}" r="3.4" fill="#2a1636"/><circle cx="${x + d}" cy="${y}" r="3.4" fill="#2a1636"/>`;
const heart = (x, y, s, fill, cls = '') => `<path class="${cls}" d="M${x} ${y + s * 0.35}C${x - s * 1.05} ${y - s * 0.35} ${x - s * 0.55} ${y - s * 1.05} ${x} ${y - s * 0.45}C${x + s * 0.55} ${y - s * 1.05} ${x + s * 1.05} ${y - s * 0.35} ${x} ${y + s * 0.35}Z" fill="${fill}" ${T}/>`;
const star = (x, y, r, fill, cls = '') => {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.48 : r;
    d += `${k ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `<path class="${cls}" d="${d}Z" fill="${fill}" ${T}/>`;
};
// Basit el: avuç ve parmaklar; open: açık parmak sayısı
const hand = (x, y, fill, fingers = [1, 1, 1, 1], thumb = 1, cls = '') => {
  const f = fingers.map((on, k) => {
    const fx = x - 13 + k * 9;
    return on ? `<rect x="${fx - 4}" y="${y - 34}" width="8" height="26" rx="4" fill="${fill}" ${T}/>` : `<rect x="${fx - 4}" y="${y - 14}" width="8" height="10" rx="4" fill="${fill}" ${T}/>`;
  }).join('');
  const th = thumb ? `<rect x="${x - 30}" y="${y - 6}" width="18" height="8" rx="4" transform="rotate(-30 ${x - 21} ${y - 2})" fill="${fill}" ${T}/>` : '';
  return `<g class="${cls}">${f}${th}<rect x="${x - 19}" y="${y - 12}" width="38" height="30" rx="12" fill="${fill}" ${T}/></g>`;
};

export const ART2 = {
  couple: `
  <svg class="art art-couple" viewBox="0 0 200 150" aria-hidden="true">
    <path class="art-carm" d="M78 92C60 40 100 30 100 58C100 30 140 40 122 92" fill="none" stroke="#2a1636" stroke-width="13" stroke-linecap="round"/>
    <path class="art-carm" d="M78 92C60 40 100 30 100 58C100 30 140 40 122 92" fill="none" stroke="#ff5f8f" stroke-width="7" stroke-linecap="round"/>
    <circle cx="70" cy="112" r="26" fill="#4fb6ff" ${I}/>${eyes(70, 108, 8)}<path d="M63 120q7 6 14 0" fill="none" ${T}/>
    <circle cx="130" cy="112" r="26" fill="#ff6fae" ${I}/>${eyes(130, 108, 8)}<path d="M123 120q7 6 14 0" fill="none" ${T}/>
    ${heart(100, 30, 12, '#ffcd3c', 'art-cbeat')}
  </svg>`,

  paint: `
  <svg class="art art-paint" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="22" y="14" width="156" height="104" rx="14" fill="#fffcf6" ${I}/>
    <path class="art-splat s1" d="M40 40q20-14 40 0t30 20q-10 24-40 18t-30-38z" fill="#4fb6ff"/>
    <path class="art-splat s2" d="M110 70q24-18 48 0t8 30q-20 14-44 4t-12-34z" fill="#ff6fae"/>
    <path class="art-trail" d="M44 96q30-40 60-10t60-30" fill="none" stroke="#4fb6ff" stroke-width="9" stroke-linecap="round"/>
    <g class="art-brushy"><circle cx="100" cy="128" r="17" fill="#ffd23f" ${I}/>${eyes(100, 124, 6)}<ellipse cx="100" cy="132" rx="5" ry="4" fill="#ff6fae" ${T}/></g>
  </svg>`,

  snowball: `
  <svg class="art art-snowball" viewBox="0 0 200 150" aria-hidden="true">
    <circle cx="44" cy="104" r="26" fill="#4fb6ff" ${I}/>${eyes(44, 100, 8)}
    <circle cx="156" cy="100" r="26" fill="#ff6fae" ${I}/>${eyes(156, 96, 8)}
    <path class="art-snowsplat" d="M146 86q8-10 16-2q10-4 10 8q-4 10-14 8q-14 2-12-14z" fill="#fbfdff" ${T}/>
    <g class="art-snow"><circle cx="70" cy="70" r="12" fill="#fbfdff" ${I}/><circle cx="74" cy="73" r="4" fill="#d6e6f5"/></g>
    <path d="M60 50q40-40 86 20" fill="none" stroke="#2a163655" stroke-width="3" stroke-dasharray="6 8"/>
  </svg>`,

  dragon: `
  <svg class="art art-dragon" viewBox="0 0 200 150" aria-hidden="true">
    <path d="M40 74l-6-20 14 10zM64 70l4-20 8 16z" fill="#ff7a1a" ${T}/>
    <circle cx="56" cy="92" r="28" fill="#2ed67a" ${I}/>${eyes(52, 86, 8)}
    <ellipse cx="72" cy="100" rx="8" ry="7" fill="#2a1636"/>
    <g class="art-flame"><path d="M80 98q20-16 44-6q-10 4-6 10q-18 10-38-4z" fill="#ffcd3c" ${T}/><path d="M86 98q12-8 24-4q-12 8-24 4z" fill="#ff4f1f"/></g>
    <path d="M150 84l14 56" ${I}/><path d="M150 84l14 56" stroke="#c98b52" stroke-width="2.5"/>
    <rect class="art-mallow" x="132" y="66" width="34" height="38" rx="12" fill="#ffe2a0" ${I}/>
  </svg>`,

  gum: `
  <svg class="art art-gum" viewBox="0 0 200 150" aria-hidden="true">
    <circle cx="70" cy="80" r="40" fill="#ffd23f" ${I}/>${eyes(66, 70, 12)}
    <g class="art-bubble"><circle cx="118" cy="92" r="30" fill="#ff8cc0" ${I}/><ellipse cx="108" cy="80" rx="7" ry="11" transform="rotate(-30 108 80)" fill="#fff" opacity=".7"/></g>
    <ellipse cx="94" cy="94" rx="6" ry="5" fill="#ff5fa2" ${T}/>
  </svg>`,

  copyface: `
  <svg class="art art-copyface" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-cf f1"><circle cx="58" cy="80" r="36" fill="#9b5cff" ${I}/><circle cx="46" cy="72" r="8" fill="#fff" ${T}/><circle cx="70" cy="72" r="8" fill="#fff" ${T}/><circle cx="46" cy="72" r="3.4" fill="#2a1636"/><circle cx="70" cy="72" r="3.4" fill="#2a1636"/><ellipse cx="58" cy="96" rx="10" ry="8" fill="#2a1636"/><path d="M52 98q6 12 12 0" fill="#ff5f8f"/></g>
    <g class="art-cf f2"><circle cx="142" cy="80" r="36" fill="#ffcd3c" ${I}/><circle cx="130" cy="72" r="8" fill="#fff" ${T}/><circle cx="154" cy="72" r="8" fill="#fff" ${T}/><circle cx="130" cy="72" r="3.4" fill="#2a1636"/><circle cx="154" cy="72" r="3.4" fill="#2a1636"/><ellipse cx="142" cy="96" rx="10" ry="8" fill="#2a1636"/><path d="M136 98q6 12 12 0" fill="#ff5f8f"/></g>
    <path d="M92 40q8-8 16 0" fill="none" ${T}/><text x="100" y="36" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="18" fill="#2a1636">%92</text>
  </svg>`,

  hockey: `
  <svg class="art art-hockey" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="14" y="20" width="172" height="110" rx="16" fill="#e8fbff" ${I}/>
    <path d="M100 20v110" stroke="#2a163655" stroke-width="3"/><circle cx="100" cy="75" r="18" fill="none" stroke="#2a163655" stroke-width="3"/>
    <rect x="14" y="56" width="8" height="38" fill="#4fb6ff" ${T}/><rect x="178" y="56" width="8" height="38" fill="#ff6fae" ${T}/>
    <g class="art-mal1"><circle cx="46" cy="75" r="16" fill="#4fb6ff" ${I}/><circle cx="46" cy="70" r="5" fill="#2a1636"/></g>
    <g class="art-mal2"><circle cx="154" cy="75" r="16" fill="#ff6fae" ${I}/><circle cx="154" cy="70" r="5" fill="#2a1636"/></g>
    <g class="art-hpuck"><circle cx="100" cy="75" r="10" fill="#3a2d5c" ${I}/></g>
  </svg>`,

  snake: `
  <svg class="art art-snake" viewBox="0 0 200 150" aria-hidden="true">
    <path class="art-sbody" d="M30 120q30-60 60-20t60-30" fill="none" stroke="#2a1636" stroke-width="22" stroke-linecap="round"/>
    <path class="art-sbody" d="M30 120q30-60 60-20t60-30" fill="none" stroke="#2fbf71" stroke-width="15" stroke-linecap="round"/>
    <g class="art-shead"><ellipse cx="152" cy="68" rx="18" ry="15" fill="#2fbf71" ${I}/><circle cx="156" cy="62" r="4" fill="#fff" ${T}/><circle cx="156" cy="74" r="4" fill="#fff" ${T}/><path d="M170 68h12l4-4M182 68l4 4" stroke="#ff3d5c" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    ${heart(176, 32, 12, '#ff5fa2', 'art-shrt')}
  </svg>`,

  juggle: `
  <svg class="art art-juggle" viewBox="0 0 200 150" aria-hidden="true">
    <circle cx="100" cy="112" r="34" fill="#ff9f1c" ${I}/>${eyes(100, 108, 11)}<path d="M90 124q10 8 20 0" fill="none" ${T}/>
    <g class="art-jball"><circle cx="100" cy="40" r="17" fill="#fffcf6" ${I}/><circle cx="100" cy="40" r="5" fill="#4fb6ff"/><circle cx="90" cy="32" r="4" fill="#4fb6ff"/><circle cx="110" cy="32" r="4" fill="#4fb6ff"/><circle cx="92" cy="50" r="4" fill="#4fb6ff"/><circle cx="108" cy="50" r="4" fill="#4fb6ff"/></g>
    ${star(160, 36, 12, '#ffcd3c', 'art-twinkle')}
  </svg>`,

  runner: `
  <svg class="art art-runner" viewBox="0 0 200 150" aria-hidden="true">
    <path d="M0 126h200" ${I}/><path class="art-ground" d="M10 136h20M60 136h20M110 136h20M160 136h20" stroke="#2a163655" stroke-width="4"/>
    <g class="art-box"><rect x="120" y="98" width="28" height="28" rx="5" fill="#ff9f1c" ${I}/><path d="M124 102l20 20M144 102l-20 20" ${T}/></g>
    <g class="art-jump"><circle cx="70" cy="104" r="20" fill="#6cbf2f" ${I}/><circle cx="76" cy="98" r="3.4" fill="#2a1636"/><circle cx="86" cy="98" r="3.4" fill="#2a1636"/></g>
    <path class="art-bat" d="M150 46q-10-12-22-4q8 0 10 8q4-6 12-4q8-2 12 4q2-8 10-8q-12-8-22 4z" fill="#6b4fa8" ${T}/>
  </svg>`,

  nodquiz: `
  <svg class="art art-nodquiz" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="30" y="14" width="140" height="40" rx="14" fill="#fffcf6" ${I}/>
    <path d="M48 28h104M48 40h70" stroke="#2a163655" stroke-width="5" stroke-linecap="round"/>
    <g class="art-nod"><circle cx="100" cy="104" r="30" fill="#4f7cff" ${I}/>${eyes(100, 100, 10)}<path d="M92 114q8 6 16 0" fill="none" ${T}/></g>
    <g class="art-yes"><circle cx="40" cy="104" r="16" fill="#2ed6a0" ${I}/><path d="M32 104l6 6 11-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
    <g class="art-no"><circle cx="160" cy="104" r="16" fill="#ff4f62" ${I}/><path d="M153 97l14 14M167 97l-14 14" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
  </svg>`,

  swat: `
  <svg class="art art-swat" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-fly"><ellipse cx="100" cy="70" rx="12" ry="9" fill="#3a2d5c" ${T}/><ellipse cx="94" cy="58" rx="9" ry="6" fill="#e8f4ff" ${T}/><ellipse cx="106" cy="58" rx="9" ry="6" fill="#e8f4ff" ${T}/><circle cx="92" cy="68" r="3" fill="#ff4f62"/></g>
    <g class="art-palm l"><rect x="30" y="50" width="34" height="50" rx="16" fill="#ffd2a8" ${I}/></g>
    <g class="art-palm r"><rect x="136" y="50" width="34" height="50" rx="16" fill="#ffd2a8" ${I}/></g>
    <path class="art-whap" d="M100 30v-12M76 40l-8-8M124 40l8-8" ${I}/>
  </svg>`,

  beat: `
  <svg class="art art-beat" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="44" y="10" width="44" height="130" rx="16" fill="#ffffff88" ${T}/><rect x="112" y="10" width="44" height="130" rx="16" fill="#ffffff88" ${T}/>
    <circle cx="66" cy="116" r="17" fill="none" ${I}/><circle cx="134" cy="116" r="17" fill="none" ${I}/>
    <g class="art-bn n1"><circle cx="66" cy="40" r="15" fill="#4fb6ff" ${I}/><path d="M66 48V32M59 39l7-7 7 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g>
    <g class="art-bn n2"><circle cx="134" cy="40" r="15" fill="#ff4fd8" ${I}/><path d="M134 48V32M127 39l7-7 7 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g>
  </svg>`,

  hero: `
  <svg class="art art-hero" viewBox="0 0 200 150" aria-hidden="true">
    ${star(40, 34, 11, '#ffcd3c', 'art-twinkle')}${star(160, 56, 9, '#ffcd3c', 'art-twinkle t2')}
    <g class="art-flyer">
      <path d="M86 80q-24 30-6 56q16-14 40-14q-4-26-14-42z" fill="#ff4f62" ${I}/>
      <circle cx="100" cy="74" r="26" fill="#4fb6ff" ${I}/>
      <rect x="80" y="64" width="40" height="10" rx="5" fill="#2a1636"/>
      <circle cx="91" cy="69" r="3" fill="#fff"/><circle cx="109" cy="69" r="3" fill="#fff"/>
    </g>
    <path class="art-speed" d="M60 20v20M140 100v20M30 90v14" stroke="#2a163655" stroke-width="4" stroke-linecap="round"/>
  </svg>`,

  wall: `
  <svg class="art art-wall" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-brick">
      <rect x="40" y="16" width="120" height="122" rx="8" fill="#ffb0cf" ${I}/>
      <path d="M40 46h120M40 76h120M40 106h120M70 16v30M130 16v30M100 46v30M70 76v30M130 76v30M100 106v32" stroke="#2a163644" stroke-width="3"/>
      <path d="M100 40v40M100 50l-26-14M100 50l26-14M100 80l-14 40M100 80l14 40" stroke="#2a1636" stroke-width="20" stroke-linecap="round"/>
      <circle cx="100" cy="34" r="13" fill="#2a1636"/>
      <path d="M100 40v40M100 50l-26-14M100 50l26-14M100 80l-14 40M100 80l14 40" stroke="#fff6ea" stroke-width="12" stroke-linecap="round"/>
      <circle cx="100" cy="34" r="8" fill="#fff6ea"/>
    </g>
  </svg>`,

  fingermath: `
  <svg class="art art-fingermath" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="30" y="14" width="140" height="48" rx="16" fill="#fffcf6" ${I}/>
    <text x="100" y="50" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="34" fill="#2a1636">2 + 3</text>
    ${hand(100, 116, '#ffd2a8', [1, 1, 1, 1], 1, 'art-wave')}
  </svg>`,

  signs: `
  <svg class="art art-signs" viewBox="0 0 200 150" aria-hidden="true">
    <circle cx="100" cy="74" r="56" fill="#ffe2a3" ${I}/>
    ${hand(100, 100, '#ffd2a8', [1, 1, 0, 0], 0, 'art-wave')}
    ${star(160, 30, 10, '#ff5fa2', 'art-twinkle')}${star(36, 120, 8, '#4fb6ff', 'art-twinkle t2')}
  </svg>`,

  fingergun: `
  <svg class="art art-fingergun" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-gun"><rect x="30" y="88" width="46" height="36" rx="14" fill="#ffd2a8" ${I}/><rect x="60" y="88" width="56" height="14" rx="7" fill="#ffd2a8" ${I}/><rect x="46" y="66" width="12" height="28" rx="6" fill="#ffd2a8" ${I}/></g>
    <path class="art-pew" d="M124 92h22M128 82l14-6M128 102l14 6" ${I}/>
    <g class="art-pop"><ellipse cx="160" cy="54" rx="20" ry="24" fill="#ff5a7a" ${I}/><path d="M160 78q4 10-2 20" fill="none" ${T}/></g>
  </svg>`,

  butterfly: `
  <svg class="art art-butterfly" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-bfly">
      <g class="art-wingl"><ellipse cx="82" cy="58" rx="26" ry="22" fill="#b07cff" ${I}/><ellipse cx="86" cy="94" rx="18" ry="16" fill="#ff8cc0" ${I}/></g>
      <g class="art-wingr"><ellipse cx="118" cy="58" rx="26" ry="22" fill="#b07cff" ${I}/><ellipse cx="114" cy="94" rx="18" ry="16" fill="#ff8cc0" ${I}/></g>
      <ellipse cx="100" cy="76" rx="6" ry="30" fill="#3a2d5c" ${I}/>
      <path d="M98 46q-8-14-16-14M102 46q8-14 16-14" fill="none" ${T}/>
    </g>
    <g class="art-pinch"><circle cx="160" cy="124" r="9" fill="#ffd2a8" ${T}/><circle cx="178" cy="112" r="9" fill="#ffd2a8" ${T}/></g>
  </svg>`,

  handrps: `
  <svg class="art art-handrps" viewBox="0 0 200 150" aria-hidden="true">
    ${hand(40, 104, '#ffd2a8', [0, 0, 0, 0], 0, 'art-rps-i r1')}
    ${hand(100, 104, '#ffd2a8', [1, 1, 1, 1], 1, 'art-rps-i r2')}
    ${hand(160, 104, '#ffd2a8', [1, 1, 0, 0], 0, 'art-rps-i r3')}
  </svg>`,

  voicefly: `
  <svg class="art art-voicefly" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="140" y="-6" width="30" height="50" rx="6" fill="#2ed67a" ${I}/><rect x="140" y="104" width="30" height="52" rx="6" fill="#2ed67a" ${I}/>
    <g class="art-bird b1"><ellipse cx="80" cy="74" rx="22" ry="18" fill="#36b5ff" ${I}/><ellipse class="art-wing" cx="72" cy="78" rx="12" ry="7" fill="#fff" ${T}/><circle cx="88" cy="68" r="5" fill="#fff" ${T}/><circle cx="90" cy="68" r="2.4" fill="#2a1636"/><path d="M100 74l12 3-12 4z" fill="#ffcd3c" ${T}/></g>
    <path class="art-wave2" d="M24 60q8 14 0 28M36 52q14 22 0 44" fill="none" ${I}/>
  </svg>`,

  notematch: `
  <svg class="art art-notematch" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="24" y="84" width="152" height="46" rx="20" fill="#fffcf6" ${I}/>
    <path d="M100 90v34" stroke="#2ed6a0" stroke-width="6" stroke-linecap="round"/>
    <circle class="art-tuner" cx="100" cy="107" r="13" fill="#ff8a3d" ${I}/>
    <g class="art-noteup"><path d="M70 60V24l30-6v34" fill="none" ${I}/><circle cx="64" cy="60" r="9" fill="#a98bff" ${I}/><circle cx="94" cy="52" r="9" fill="#a98bff" ${I}/></g>
    <path d="M140 30v26" ${I}/><circle cx="134" cy="56" r="8" fill="#ff8a3d" ${I}/>
  </svg>`,

  clap: `
  <svg class="art art-clap" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-palm l"><rect x="56" y="46" width="36" height="60" rx="17" fill="#ffd2a8" ${I}/></g>
    <g class="art-palm r"><rect x="108" y="46" width="36" height="60" rx="17" fill="#ffd2a8" ${I}/></g>
    <path class="art-whap" d="M100 34v-14M78 40l-8-10M122 40l8-10M100 118v14" ${I}/>
    <g class="art-dots"><circle cx="40" cy="132" r="7" fill="#ffcd3c" ${T}/><circle cx="64" cy="132" r="7" fill="#ffcd3c" ${T}/><circle cx="136" cy="132" r="7" fill="#ff5fa2" ${T}/><circle cx="160" cy="132" r="7" fill="#ffcd3c" ${T}/></g>
  </svg>`,

  opera: `
  <svg class="art art-opera" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-singer"><circle cx="86" cy="92" r="40" fill="#d94fa0" ${I}/><path d="M68 80q6-6 12 0M92 80q6-6 12 0" fill="none" ${T}/><ellipse cx="86" cy="106" rx="11" ry="14" fill="#2a1636"/></g>
    <g class="art-noteup"><path d="M146 66V34" ${I}/><circle cx="140" cy="66" r="8" fill="#ffcd3c" ${I}/></g>
    <g class="art-noteup t2"><path d="M170 46V18" ${I}/><circle cx="164" cy="46" r="7" fill="#ffcd3c" ${I}/></g>
  </svg>`,

  rocket: `
  <svg class="art art-rocket" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-rkt">
      <g class="art-flame"><path d="M88 112q12 34 24 0z" fill="#ffcd3c" ${T}/><path d="M94 112q6 18 12 0z" fill="#ff4f1f"/></g>
      <path d="M100 14q26 22 20 98h-40q-6-76 20-98z" fill="#fffcf6" ${I}/>
      <circle cx="100" cy="58" r="11" fill="#4fb6ff" ${I}/>
      <path d="M80 86l-16 26h18zM120 86l16 26h-18z" fill="#ff4f1f" ${I}/>
    </g>
    <path class="art-speed" d="M50 30v24M150 50v24M40 90v18" stroke="#2a163655" stroke-width="4" stroke-linecap="round"/>
  </svg>`,

  sleepycat: `
  <svg class="art art-sleepycat" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="24" y="106" width="152" height="30" rx="15" fill="#c9b6ff" ${I}/>
    <ellipse cx="112" cy="100" rx="52" ry="26" fill="#ffb36b" ${I}/>
    <path d="M56 70l4-22 12 14zM84 64l10-20 4 20z" fill="#ffb36b" ${T}/>
    <ellipse cx="74" cy="86" rx="30" ry="24" fill="#ffb36b" ${I}/>
    <path d="M60 86q5 4 10 0M78 86q5 4 10 0" fill="none" ${T}/><ellipse cx="74" cy="96" rx="3" ry="2" fill="#ff7fae"/>
    <text class="art-z z1" x="120" y="52" font-family="Lilita One, sans-serif" font-size="22" fill="#7a5cff">z</text>
    <text class="art-z z2" x="138" y="36" font-family="Lilita One, sans-serif" font-size="28" fill="#7a5cff">z</text>
  </svg>`,

  airhockey: `
  <svg class="art art-airhockey" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="14" y="16" width="172" height="96" rx="16" fill="#e8fbff" ${I}/>
    <path d="M100 16v96" stroke="#2a163655" stroke-width="3"/>
    <g class="art-mal1"><circle cx="44" cy="64" r="14" fill="#19b7c8" ${I}/></g>
    <g class="art-mal2"><circle cx="156" cy="64" r="14" fill="#ff5fa2" ${I}/></g>
    <g class="art-hpuck"><circle cx="100" cy="64" r="9" fill="#3a2d5c" ${I}/></g>
    <g><rect x="30" y="122" width="22" height="20" rx="5" fill="#fff" ${T}/><text x="41" y="137" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="13" fill="#2a1636">W</text></g>
    <g><rect x="148" y="122" width="22" height="20" rx="5" fill="#fff" ${T}/><text x="159" y="137" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="13" fill="#2a1636">↑</text></g>
  </svg>`,

  yarn: `
  <svg class="art art-yarn" viewBox="0 0 200 150" aria-hidden="true">
    <path class="art-thread t1" d="M20 120V40h70v50h40" fill="none" stroke="#2a1636" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="art-thread t1" d="M20 120V40h70v50h40" fill="none" stroke="#ff6fae" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="art-thread t2" d="M180 30v80h-50" fill="none" stroke="#2a1636" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="art-thread t2" d="M180 30v80h-50" fill="none" stroke="#4fb6ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="130" cy="90" r="13" fill="#ff6fae" ${I}/><path d="M122 80l-4-10 10 4zM138 80l4-10-10 4z" fill="#ff6fae" ${T}/>
    <circle cx="130" cy="110" r="13" fill="#4fb6ff" ${I}/>
  </svg>`,

  sumo: `
  <svg class="art art-sumo" viewBox="0 0 200 150" aria-hidden="true">
    <ellipse cx="100" cy="112" rx="88" ry="30" fill="#f6dfb3" ${I}/>
    <g class="art-push p1"><circle cx="70" cy="88" r="30" fill="#4fb6ff" ${I}/><rect x="40" y="96" width="60" height="9" fill="#ff5fa2"/><path d="M68 72l12 4M82 72l-4 0" ${T}/>${eyes(74, 82, 7)}</g>
    <g class="art-push p2"><circle cx="130" cy="88" r="30" fill="#ff6fae" ${I}/><rect x="100" y="96" width="60" height="9" fill="#ffcd3c"/>${eyes(126, 82, 7)}</g>
  </svg>`,

  tower: `
  <svg class="art art-tower" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="30" y="118" width="60" height="14" rx="7" fill="#fff" ${I}/>
    <rect x="96" y="84" width="60" height="14" rx="7" fill="#fff" ${I}/>
    <rect x="44" y="48" width="60" height="14" rx="7" fill="#fff" ${I}/>
    <path d="M150 14v40" ${I}/><path d="M150 14l26 8-26 8z" fill="#ff5fa2" ${T}/>
    <g class="art-hop"><circle cx="126" cy="70" r="13" fill="#7ec8ff" ${I}/><circle cx="122" cy="68" r="2.4" fill="#2a1636"/><circle cx="130" cy="68" r="2.4" fill="#2a1636"/></g>
  </svg>`,

  tanks: `
  <svg class="art art-tanks" viewBox="0 0 200 150" aria-hidden="true">
    <rect x="90" y="30" width="16" height="90" rx="6" fill="#a98bff" ${I}/>
    <g class="art-tank t1"><rect x="20" y="86" width="44" height="34" rx="10" fill="#4fb6ff" ${I}/><rect x="42" y="98" width="30" height="10" rx="4" fill="#2a1636"/><circle cx="42" cy="103" r="9" fill="#fff" ${T}/></g>
    <g class="art-tank t2"><rect x="136" y="30" width="44" height="34" rx="10" fill="#ff5fa2" ${I}/><rect x="128" y="42" width="30" height="10" rx="4" fill="#2a1636"/><circle cx="158" cy="47" r="9" fill="#fff" ${T}/></g>
    <g class="art-hbullet">${heart(70, 70, 9, '#ff5fa2')}</g>
  </svg>`,

  micro: `
  <svg class="art art-micro" viewBox="0 0 200 150" aria-hidden="true">
    <g class="art-mtile m1"><rect x="20" y="20" width="50" height="50" rx="12" fill="#2ed67a" ${I}/><text x="45" y="54" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="24" fill="#fff" stroke="#2a1636" stroke-width="1">!</text></g>
    <g class="art-mtile m2"><rect x="76" y="20" width="50" height="50" rx="12" fill="#ffcd3c" ${I}/><text x="101" y="54" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="24" fill="#2a1636">3</text></g>
    <g class="art-mtile m3"><rect x="132" y="20" width="50" height="50" rx="12" fill="#ff5fa2" ${I}/><text x="157" y="54" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="22" fill="#fff">←</text></g>
    <g class="art-mtile m4"><rect x="48" y="80" width="50" height="50" rx="12" fill="#4fb6ff" ${I}/>${heart(73, 108, 11, '#ff3d7f')}</g>
    <g class="art-mtile m5"><rect x="104" y="80" width="50" height="50" rx="12" fill="#a98bff" ${I}/><text x="129" y="114" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="20" fill="#fff">42</text></g>
  </svg>`,
};
