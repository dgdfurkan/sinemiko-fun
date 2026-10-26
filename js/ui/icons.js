// Çizgi ikonlar; renk currentColor'dan gelir

import { raw } from '../lib/dom.js';

const P = {
  mic: '<rect x="8.5" y="2.8" width="7" height="11.5" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.2M8.5 21.2h7"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.8v4.6h4.6"/>',
  shuffle: '<path d="M3.5 7h3.2c4.3 0 6.3 10 10.6 10h3.2"/><path d="M3.5 17h3.2c1.8 0 3-1.6 4-3.5M13.4 10.4c1-1.9 2.3-3.4 4-3.4h3.1"/><path d="M18 4.2 20.6 7 18 9.8M18 14.2l2.6 2.8-2.6 2.8"/>',
  pencil: '<path d="M4 20l4.2-1L19.4 7.8a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8z"/><path d="M14.5 6.3l3.2 3.2"/>',
  check: '<path d="M5 12.5l4.6 4.5L19 7.2"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  arrow: '<path d="M5 12h13.5M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
  home: '<path d="M4 11.2 12 4l8 7.2V20h-5.2v-5.6H9.2V20H4z"/>',
  music: '<path d="M9 17.5V6.2l10-2.2v11.4"/><circle cx="6.6" cy="17.6" r="2.6"/><circle cx="16.6" cy="15.6" r="2.6"/>',
  musicOff: '<path d="M9 17.5V6.2l10-2.2v11.4"/><circle cx="6.6" cy="17.6" r="2.6"/><circle cx="16.6" cy="15.6" r="2.6"/><path d="M3.5 3.5l17 17"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  fullExit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  phones: '<path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/><rect x="3" y="13.5" width="4.5" height="7" rx="2"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="2"/>',
  keyboard: '<rect x="2.8" y="6" width="18.4" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
  download: '<path d="M12 4v11M7 10.2l5 5 5-5M5 20h14"/>',
  rewind: '<path d="M11 6.5 4.5 12l6.5 5.5zM19.5 6.5 13 12l6.5 5.5z" fill="currentColor"/>',
  heart: '<path d="M12 20.5s-7.8-5-7.8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.7c0 5.6-7.8 10.6-7.8 10.6z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.6" cy="8.6" r=".9" fill="currentColor"/><circle cx="15.4" cy="15.4" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  volUp: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11"/>',
  volDown: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
  eyeOff: '<path d="M3.5 12s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4l16 16"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  skip: '<path d="M5 6.5l7 5.5-7 5.5zM12.5 6.5l7 5.5-7 5.5z"/>',
  spin: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5v4.2h-4.2"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5c-2.4 0-3.8-1-5.2-2.8l-2.2-3a1.6 1.6 0 0 1 2.5-2l1.4 1.6"/>',
  eraser: '<path d="M8.5 19.5h11M4.8 14.6l8.7-8.7a2 2 0 0 1 2.8 0l2.8 2.8a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-1.4.6H8.6a2 2 0 0 1-1.4-.6l-2.4-2.4a1.5 1.5 0 0 1 0-2.1z"/><path d="M10 9.4l5.6 5.6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/><path d="M10.2 11v6M13.8 11v6"/>',
  pause: '<rect x="6.3" y="5" width="4.2" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4.2" height="14" rx="1.3" fill="currentColor"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2l5 5"/>',
  lyrics: '<path d="M6.5 3.5h8.2l3.8 3.8V20a.6.6 0 0 1-.6.6H6.5a.6.6 0 0 1-.6-.6V4.1a.6.6 0 0 1 .6-.6z"/><path d="M14.5 3.7V7.5h3.8M8.8 11h6.6M8.8 14.3h6.6M8.8 17.6h4"/>',
  cam: '<path d="M3.8 8.6a2 2 0 0 1 2-2h2.4L9.9 4h4.2l1.7 2.6h2.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2z"/><circle cx="12" cy="13.2" r="3.6"/>',
  sparkle: '<path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z"/><path d="M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z"/>',
};

export function icon(name, cls = '') {
  return raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

// Üst çubuktaki baloncuk sayacı için küçük baloncuk
export const bubbleIcon = raw(`<svg class="pc-bubble" viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="12.5" fill="#d9f1ff" stroke="#2a1636" stroke-width="2.6"/>
  <path d="M9.5 13.5a7 7 0 0 1 5-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <circle cx="21" cy="21" r="2" fill="#fff"/>
</svg>`);
