// Arka plandaki el çizimi desen ve kâğıt dokusu

const DOODLES = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <g fill="none" stroke="#2a1636" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".085">
    <path d="M18 36q9-12 18 0t18 0t18 0"/>
    <path d="M160 26l5 11 12 1.5-9 8 2.5 12-10.5-6-10.5 6 2.5-12-9-8 12-1.5z"/>
    <path d="M78 132c-7-9-21-3-14 9l14 14 14-14c7-12-7-18-14-9z"/>
    <circle cx="196" cy="150" r="10"/>
    <path d="M128 206v16M120 214h16"/>
    <path d="M30 196q8-8 16 0t16 0"/>
    <path d="M206 92l8 8M214 92l-8 8"/>
    <path d="M110 70a12 12 0 1 1 12 12"/>
  </g>
  <g fill="#2a1636" opacity=".07">
    <circle cx="118" cy="22" r="3.5"/><circle cx="222" cy="210" r="3"/><circle cx="20" cy="112" r="3"/><circle cx="160" cy="112" r="2.5"/>
  </g>
</svg>`;

const GRAIN = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .09  0 0 0 0 .21  0 0 0 .55 0"/></filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>`;

const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`;

export function initBackdrop() {
  document.getElementById('pattern').style.backgroundImage = url(DOODLES);
  document.getElementById('grain').style.backgroundImage = url(GRAIN);
}
