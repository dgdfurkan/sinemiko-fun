// Yüz ifadeleri: MediaPipe ifade puanlarından (blendshape) 0 ile 1 arası değer.
// 1 ve üstü ifade tamam demektir.

const B = (p, k) => (p.blend && p.blend[k]) || 0;
const avg = (p, a, b) => (B(p, a) + B(p, b)) / 2;

export const smileOf = (p) => avg(p, 'mouthSmileLeft', 'mouthSmileRight');
export const blinkOf = (p) => avg(p, 'eyeBlinkLeft', 'eyeBlinkRight');
const browUp = (p) => (B(p, 'browInnerUp') + avg(p, 'browOuterUpLeft', 'browOuterUpRight')) / 2;

// Başın yana yatma açısı, iki gözün dış köşesinden
function rollDeg(p) {
  const a = p.lm[33];
  const b = p.lm[263];
  if (!a || !b) return 0;
  const ar = p.ar || 16 / 9;
  return (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x) * ar) * 180) / Math.PI;
}

export const EXPRS = [
  {
    id: 'wow', name: 'Şok Ol', tip: 'Ağzını aç, kaşlarını kaldır.',
    face: { eyes: 'wide', brows: 'up', mouth: 'o', extra: 'shock' },
    value: (p) => Math.min(B(p, 'jawOpen') / 0.4, browUp(p) / 0.35),
  },
  {
    id: 'wink', name: 'Göz Kırp', tip: 'Tek gözünü kapat, öbürü açık kalsın.',
    face: { eyes: 'wink', mouth: 'smirk' },
    value: (p) => {
      const l = B(p, 'eyeBlinkLeft');
      const r = B(p, 'eyeBlinkRight');
      return Math.min(Math.max(l, r) / 0.5, Math.abs(l - r) / 0.4);
    },
  },
  {
    id: 'kiss', name: 'Öpücük At', tip: 'Dudaklarını iyice büz.',
    face: { eyes: 'happy', mouth: 'kiss', extra: 'heart' },
    value: (p) => B(p, 'mouthPucker') / 0.6,
  },
  {
    id: 'smile', name: 'Kocaman Sırıt', tip: 'Kulaktan kulağa gülümse.',
    face: { eyes: 'happy', mouth: 'grin' },
    value: (p) => smileOf(p) / 0.65,
  },
  {
    id: 'angry', name: 'Kaşlarını Çat', tip: 'Kaşlarını iyice aşağı indir.',
    face: { eyes: 'open', brows: 'down', mouth: 'flat', extra: 'anger' },
    value: (p) => avg(p, 'browDownLeft', 'browDownRight') / 0.35,
  },
  {
    id: 'closed', name: 'Gözlerini Sık', tip: 'İki gözünü sımsıkı kapat.',
    face: { eyes: 'closed', mouth: 'flat' },
    value: (p) => Math.min(B(p, 'eyeBlinkLeft'), B(p, 'eyeBlinkRight')) / 0.55,
  },
  {
    id: 'side', name: 'Yan Gözle Bak', tip: 'Başını çevirmeden gözlerinle yana bak.',
    face: { eyes: 'side', mouth: 'smirk' },
    value: (p) => Math.max(avg(p, 'eyeLookOutLeft', 'eyeLookInRight'), avg(p, 'eyeLookInLeft', 'eyeLookOutRight')) / 0.45,
  },
  {
    id: 'brows', name: 'Kaşları Kaldır', tip: 'Ağzın kapalı, kaşlar tavana.',
    face: { eyes: 'open', brows: 'up', mouth: 'flat' },
    value: (p) => (browUp(p) / 0.5) * (B(p, 'jawOpen') < 0.25 ? 1 : 0.5),
  },
  {
    id: 'mside', name: 'Ağzını Yana Kaydır', tip: 'Ağzını bir yanağına doğru çek.',
    face: { eyes: 'open', mouth: 'side' },
    value: (p) => Math.max(B(p, 'mouthLeft'), B(p, 'mouthRight')) / 0.3,
  },
  {
    id: 'scream', name: 'Sessiz Çığlık', tip: 'Ağzını sonuna kadar aç ama ses çıkmasın!',
    face: { eyes: 'wide', brows: 'up', mouth: 'scream' },
    value: (p) => B(p, 'jawOpen') / 0.65,
  },
  {
    id: 'tilt', name: 'Kafanı Yatır', tip: 'Başını bir omzuna doğru eğ.',
    face: { eyes: 'open', mouth: 'smirk', tilt: true },
    value: (p) => rollDeg(p) / 20,
  },
];

export const exprById = (id) => EXPRS.find((e) => e.id === id);

/* ---------- Kart çizimi ---------- */

const S = 'stroke="#2a1636" stroke-linecap="round" stroke-linejoin="round"';

const EYES = {
  open: '<ellipse cx="36" cy="46" rx="7" ry="9" fill="#fff" STROKE stroke-width="3"/><ellipse cx="64" cy="46" rx="7" ry="9" fill="#fff" STROKE stroke-width="3"/><circle cx="36" cy="48" r="3.8" fill="#2a1636"/><circle cx="64" cy="48" r="3.8" fill="#2a1636"/>',
  wide: '<ellipse cx="36" cy="45" rx="9" ry="11.5" fill="#fff" STROKE stroke-width="3"/><ellipse cx="64" cy="45" rx="9" ry="11.5" fill="#fff" STROKE stroke-width="3"/><circle cx="36" cy="46" r="3" fill="#2a1636"/><circle cx="64" cy="46" r="3" fill="#2a1636"/>',
  closed: '<path d="M29 40l11 6-11 6M71 40l-11 6 11 6" fill="none" STROKE stroke-width="3.6"/>',
  wink: '<ellipse cx="36" cy="46" rx="7" ry="9" fill="#fff" STROKE stroke-width="3"/><circle cx="36" cy="48" r="3.8" fill="#2a1636"/><path d="M56 47q8-8 16 0" fill="none" STROKE stroke-width="3.6"/>',
  side: '<ellipse cx="36" cy="46" rx="8" ry="8" fill="#fff" STROKE stroke-width="3"/><ellipse cx="64" cy="46" rx="8" ry="8" fill="#fff" STROKE stroke-width="3"/><circle cx="40.5" cy="47" r="3.8" fill="#2a1636"/><circle cx="68.5" cy="47" r="3.8" fill="#2a1636"/><path d="M27 41h18M55 41h18" STROKE stroke-width="3.2"/>',
  happy: '<path d="M28 49q8-9 16 0M56 49q8-9 16 0" fill="none" STROKE stroke-width="3.6"/>',
};
const BROWS = {
  up: '<path d="M27 29q9-8 18 0M55 29q9-8 18 0" fill="none" STROKE stroke-width="3.6"/>',
  down: '<path d="M27 31l17 7M73 31l-17 7" fill="none" STROKE stroke-width="4.2"/>',
};
const MOUTHS = {
  o: '<ellipse cx="50" cy="75" rx="8" ry="10" fill="#2a1636"/>',
  scream: '<ellipse cx="50" cy="76" rx="11" ry="15" fill="#2a1636"/><ellipse cx="50" cy="84" rx="7" ry="5" fill="#ff7a8f"/>',
  kiss: '<path d="M47 66q7 2.5 0 6q7 2.5 0 6" fill="none" STROKE stroke-width="3.6"/>',
  grin: '<path d="M30 64q20 4 40 0q-3 22-20 22t-20-22z" fill="#fff" STROKE stroke-width="3.2"/><path d="M32 70h36" STROKE stroke-width="2.4"/>',
  flat: '<path d="M40 74h20" STROKE stroke-width="3.6"/>',
  smirk: '<path d="M40 73q12 6 22-4" fill="none" STROKE stroke-width="3.6"/>',
  side: '<path d="M58 74q6-1 10-5" fill="none" STROKE stroke-width="4"/><path d="M52 75q3 .6 6-1" fill="none" STROKE stroke-width="3"/>',
};
const EXTRA = {
  heart: '<path class="fx-heart" d="M84 26c-3-5-10-3-9 2 1 4 9 9 9 9s8-5 9-9c1-5-6-7-9-2z" fill="#ff5fa2" STROKE stroke-width="2.4"/>',
  anger: '<path class="fx-anger" d="M78 14l4 6M86 12l-2 7M90 20l-6 2M76 22l6 1" STROKE stroke-width="3" stroke="#ff4f62"/>',
  shock: '<path class="fx-shock" d="M12 22l6 5M8 34h7M88 22l-6 5M92 34h-7" STROKE stroke-width="3"/>',
};

export function faceSVG(face, color = '#ffd23f', cls = '') {
  const fill = (s) => (s || '').replaceAll('STROKE', S);
  const blush = face.eyes === 'happy' || face.mouth === 'kiss' ? '<ellipse cx="28" cy="62" rx="6" ry="4" fill="#ff8fab" opacity=".75"/><ellipse cx="72" cy="62" rx="6" ry="4" fill="#ff8fab" opacity=".75"/>' : '';
  return `<svg class="face-fig ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <g ${face.tilt ? 'transform="rotate(-20 50 54)"' : ''}>
      <circle cx="50" cy="54" r="40" fill="${color}" ${S} stroke-width="4"/>
      ${blush}${fill(EYES[face.eyes])}${fill(BROWS[face.brows])}${fill(MOUTHS[face.mouth])}
    </g>
    ${fill(EXTRA[face.extra])}
  </svg>`;
}
