// Kâğıt sürümü: disk sayfası, çizim kâğıdı ve lazer ya da Cricut için kesim dosyası.
// Her şey milimetre ölçüsünde SVG; tarayıcıdan %100 ölçekle yazdırılınca gerçek boyutta çıkar.

import { rotate } from './engine.js';
import { slotOutline } from './outline.js';

const f2 = (v) => (Math.round(v * 100) / 100).toString();
const pathOf = (pts) => `M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}`;
const polyOf = (pts) => `${pathOf(pts)}Z`;
const FONT = "font-family=\"Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif\" font-weight=\"600\"";
// 6 ile 9 ters dönünce karışmasın diye altı çizilir
const num = (n) => (n === 6 || n === 9 ? `${n}.` : String(n));

export function diskMarks(disk, cfg, { color = '#2a1636' } = {}) {
  const { R, label } = cfg;
  const K = cfg.steps;
  let out = '';
  for (const s of disk.steps) {
    const a = -s.angle;
    const t1 = rotate([0, -R + 0.8], a);
    const t2 = rotate([0, -R + 4.2], a);
    const n = rotate([0, -R + 8.2], a);
    out += `<line x1="${f2(t1[0])}" y1="${f2(t1[1])}" x2="${f2(t2[0])}" y2="${f2(t2[1])}" stroke="${color}" stroke-width=".35" stroke-linecap="round"/>`;
    out += `<text x="${f2(n[0])}" y="${f2(n[1])}" font-size="${K > 40 ? 3.4 : 4}" ${FONT} fill="${color}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f2(a)} ${f2(n[0])} ${f2(n[1])})">${num(s.k + 1)}</text>`;
  }
  for (const p of disk.pieces) {
    const a = -disk.steps[p.step].angle;
    const [x, y] = p.label;
    out += `<text x="${f2(x)}" y="${f2(y)}" font-size="${label}" ${FONT} fill="${color}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f2(a)} ${f2(x)} ${f2(y)})">${num(p.step + 1)}</text>`;
  }
  return out;
}

function diskSVG(disk, cfg, index, count) {
  const { R, slot } = cfg;
  // Kesik iki kat çizilir: koyu geniş çizginin üstüne açık renk; arada kalan ince kenar kesim çizgisidir
  const lines = disk.pieces.filter((p) => !p.dot).map((p) => `<path d="${pathOf(p.disk)}"/>`).join('');
  const dots = (r, fill) => disk.pieces.filter((p) => p.dot).map((p) => `<circle cx="${f2(p.disk[0][0])}" cy="${f2(p.disk[0][1])}" r="${r}" fill="${fill}"/>`).join('');
  return `
    <circle r="${R}" fill="#fff" stroke="#2a1636" stroke-width=".3" stroke-dasharray="2 1.2"/>
    <g fill="none" stroke="#2a1636" stroke-width="${slot + 0.32}" stroke-linecap="round" stroke-linejoin="round">${lines}</g>
    ${dots(slot / 2 + 0.16, '#2a1636')}
    <g fill="none" stroke="#e4dde9" stroke-width="${slot}" stroke-linecap="round" stroke-linejoin="round">${lines}</g>
    ${dots(slot / 2, '#e4dde9')}
    <circle r="${R - cfg.rim}" fill="none" stroke="#2a1636" stroke-width=".15" stroke-opacity=".35"/>
    ${diskMarks(disk, cfg)}
    <circle r="1.6" fill="#e4dde9" stroke="#2a1636" stroke-width=".25"/>
    <path d="M-3 0H3M0 -3V3" stroke="#2a1636" stroke-width=".2"/>
    ${count > 1 ? `<text y="${-R + cfg.rim + 6}" font-size="3.4" ${FONT} fill="#2a1636" text-anchor="middle">Disk ${index + 1}</text>` : ''}`;
}

const STEPS_TEXT = (cfg, count) => [
  ['Bas', `Bu sayfayı kalın kartona (250-300 g), çizim kâğıdını normal kâğıda bas. Ölçek %100 olmalı: aşağıdaki çizgi tam 5 cm çıkmalı.`],
  ['Kes', `Kesikli dış çizgiyi ve gri kesikleri maket bıçağıyla kes ya da kesim dosyasını (SVG) lazer kesime veya Cricut'a ver. Ortadaki deliği aç.`],
  ['Tak', `Diski çizim kâğıdındaki daireye oturt, ortadan ayaklı raptiyeyle tuttur. Disk rahatça dönmeli.`],
  ['Çiz', `Kenardaki 1'i kâğıttaki BAŞLA okuna getir, yanında 1 yazan bütün kesiklerin içinden ince uçlu kalemle geç. Sonra 2, 3 diye son numaraya kadar sırayla devam et.${count > 1 ? ' Bir disk bitince sıradakini tak, yine 1\'den başla.' : ''}`],
  ['Kaldır', 'Son adımdan sonra diski kaldırın.'],
];

function pageDisk(disk, cfg, index, count) {
  const [W, H] = cfg.page;
  const m = (W - 2 * cfg.R) / 2;
  const cy = m + cfg.R;
  const tx = 16;
  let ty = cy + cfg.R + 14;
  const lines = STEPS_TEXT(cfg, count).map(([h, t], i) => {
    const words = t.split(' ');
    const rows = [];
    let row = '';
    const maxChars = Math.floor((W - 2 * tx - 18) / 1.85);
    for (const w of words) {
      if ((row + ' ' + w).trim().length > maxChars) { rows.push(row.trim()); row = w; } else row += ' ' + w;
    }
    rows.push(row.trim());
    const block = `<text x="${tx}" y="${ty}" font-size="4.2" ${FONT} fill="#2a1636">${i + 1}. ${h}</text>`
      + rows.map((r, j) => `<text x="${tx + 18}" y="${ty + j * 5}" font-size="3.4" font-family="Fredoka, Arial, sans-serif" fill="#2a1636">${r}</text>`).join('');
    ty += Math.max(1, rows.length) * 5 + 3;
    return block;
  }).join('');
  return `<svg class="bp-page" xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
    <g transform="translate(${W / 2} ${cy})">${diskSVG(disk, cfg, index, count)}</g>
    ${lines}
    <g transform="translate(${tx} ${H - 14})"><path d="M0 0H50M0 -2V2M50 -2V2" stroke="#2a1636" stroke-width=".35"/><text x="54" y="1.2" font-size="3.2" font-family="Fredoka, Arial, sans-serif" fill="#2a1636">5 cm</text></g>
    <text x="${W - tx}" y="${H - 12.8}" font-size="3.2" ${FONT} fill="#2a1636" fill-opacity=".55" text-anchor="end">Sinemiko · Döndür Çiz</text>
  </svg>`;
}

function pagePaper(cfg) {
  const [W, H] = cfg.page;
  const top = 22;
  const cy = top + cfg.R;
  const R = cfg.R;
  return `<svg class="bp-page" xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
    <g transform="translate(${W / 2} ${cy})">
      <circle r="${R}" fill="none" stroke="#2a1636" stroke-opacity=".28" stroke-width=".3" stroke-dasharray="1.2 2"/>
      <path d="M-3.4 ${-R - 6.4}L3.4 ${-R - 6.4}L0 ${-R - 0.6}Z" fill="#2a1636"/>
      <text y="${-R - 9}" font-size="4.4" ${FONT} fill="#2a1636" text-anchor="middle">BAŞLA</text>
      <path d="M-2.5 0H2.5M0 -2.5V2.5" stroke="#2a1636" stroke-opacity=".45" stroke-width=".25"/>
    </g>
    <text x="${W / 2}" y="${H - 16}" font-size="3.4" font-family="Fredoka, Arial, sans-serif" fill="#2a1636" fill-opacity=".5" text-anchor="middle">Tarih: ...... / ...... / ............</text>
  </svg>`;
}

// Yazdırma sayfaları: önce diskler, en sonda çizim kâğıdı
export function printPages(set) {
  const { cfg, disks } = set;
  return disks.map((d, i) => pageDisk(d, cfg, i, disks.length)).join('') + pagePaper(cfg);
}

// Kesim dosyası: kırmızı çizgiler kesilir, siyahlar yazılır ya da kazınır
export function cutFile(set, index = 0) {
  const { cfg } = set;
  const disk = set.disks[index];
  const { R, slot } = cfg;
  const size = 2 * R + 10;
  const outlines = disk.pieces.map((p) => `<path d="${polyOf(slotOutline(p.disk, slot))}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sinemiko · Döndür Çiz · ${cfg.name} disk${set.disks.length > 1 ? ` ${index + 1}/${set.disks.length}` : ''}. Ölçü milimetre. Kırmızı: kes, siyah: yaz ya da kazı. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${size}mm" height="${size}mm" viewBox="${-size / 2} ${-size / 2} ${size} ${size}">
  <g id="kes" fill="none" stroke="#ff0000" stroke-width=".1">
    <circle r="${R}"/>
    <circle r="1.6"/>
    ${outlines}
  </g>
  <g id="yaz">${diskMarks(disk, cfg, { color: '#000000' })}</g>
</svg>`;
}
