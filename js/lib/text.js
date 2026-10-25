// Türkçe metin karşılaştırma ve küçük biçim yardımcıları

const MAP = { ı: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function norm(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ışğçöüâîû]/g, (c) => MAP[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const x = norm(a).replace(/ /g, '');
  const y = norm(b).replace(/ /g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - lev(x, y) / Math.max(x.length, y.length);
}

// 'full' | 'close' | 'miss'
export function judgeGuess(answer, guess) {
  if (!norm(guess)) return 'miss';
  const sim = similarity(answer, guess);
  if (sim >= 0.8) return 'full';
  const words = norm(answer).split(' ').filter((w) => w.length > 2);
  const guessWords = norm(guess).split(' ').filter((w) => w.length > 2);
  const partial = words.some((w) => guessWords.some((g) => similarity(w, g) >= 0.78));
  if (sim >= 0.5 || partial) return 'close';
  return 'miss';
}

export const upperTr = (s) => String(s).toLocaleUpperCase('tr');
export const capFirst = (s) => (s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s);

// Türkçe iyelik ve yönelme ekleri için son ünlü uyumu
const VOWELS = 'aeıioöuüAEIİOÖUÜ';
function lastVowel(word) {
  for (let i = word.length - 1; i >= 0; i--) if (VOWELS.includes(word[i])) return word[i].toLocaleLowerCase('tr');
  return 'e';
}
const endsWithVowel = (w) => VOWELS.includes(w[w.length - 1]);

// Furkan'ın, Sinem'in
export function genitive(name) {
  const v = lastVowel(name);
  const map = { a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' };
  const suf = map[v] || 'in';
  return `${name}'${endsWithVowel(name) ? 'n' : ''}${suf}`;
}

// Furkan'a, Sinem'e
export function dative(name) {
  const v = lastVowel(name);
  const suf = 'aıou'.includes(v) ? 'a' : 'e';
  return `${name}'${endsWithVowel(name) ? 'y' : ''}${suf}`;
}

// Furkan'ı, Sinem'i
export function accusative(name) {
  const v = lastVowel(name);
  const map = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' };
  return `${name}'${endsWithVowel(name) ? 'y' : ''}${map[v] || 'i'}`;
}

export const fmtSec = (s) => `${(Math.round(s * 10) / 10).toFixed(1).replace('.', ',')} sn`;

// Soru eki: "Rap mı", "Deniz mi", "Kumsal mı", "Gül mü"
export function questionParticle(word) {
  const v = lastVowel(String(word));
  return { a: 'mı', ı: 'mı', e: 'mi', i: 'mi', o: 'mu', u: 'mu', ö: 'mü', ü: 'mü' }[v] || 'mi';
}
