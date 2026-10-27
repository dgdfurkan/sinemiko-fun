import fs from 'node:fs';
import { buildSet, SIZES, LEVELS } from '../../js/spin/engine.js';
// Çalışma klasöründen: node ../seeds.mjs
const art = JSON.parse(fs.readFileSync('biz.json', 'utf8'));
const seeds = {};
for (const size of ['a3', 'a4']) for (const level of [1, 2]) {
  let best = null;
  for (let seed = 1; seed <= 80; seed += 1) {
    const S = buildSet(art, { ...SIZES[size], level, steps: LEVELS[level].steps, seed, tries: 1 });
    const n = S.disks.length;
    const total = S.disks.reduce((t, d) => t + d.pieces.length, 0);
    if (!best || n < best.n || (n === best.n && total < best.total)) best = { seed, n, total, pieces: S.disks.map((d) => d.pieces.length).join('+') };
  }
  seeds[`${size}-${level}`] = best.seed;
  console.log(size, level, best);
}
const strokes = art.strokes;
const js = `// Furkan ile Sinem'in Anıtkabir fotoğrafından çizilen portre. Koordinatlar disk yarıçapına göre (-1..1).
// tools/cizim içindeki adımlarla üretildi; fotoğraf ve yüz verisi repoda yok.
// w: kişi (s, f), p: parça, l: detay düzeyi, c: kapalı, d: nokta, f: yüz çizgisi
export const BIZ = ${JSON.stringify({ name: 'biz', strokes })};

// Her boyut ve detay için tek denemede tek diske (ya da en az diske) sığan tohum
export const SEEDS = ${JSON.stringify(seeds)};
`;
fs.writeFileSync(new URL('../../js/spin/biz.js', import.meta.url), js);
