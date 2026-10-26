// Şarkı bulucu: ad, sanatçı ya da aklında kalan bir sözden şarkıyı bulur.
// Hazır liste ve iTunes her zaman aranır. Ayarlar'da Gemini anahtarı varsa Google aramasıyla
// yarım hatırlanan sözden de bulur ve şarkının YouTube kaydını getirir. Anahtar yalnızca bu tarayıcıda durur.

import { store } from '../lib/store.js';
import { HUM_CATS } from '../data/voice.js';
import { getJSON, GENERIC, ytField } from './songhelp.js';

const MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
let goodModel = null;

const norm = (s) => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const keyOf = (t, a) => `${norm(t).join(' ')}|${norm(a)[0] || ''}`;

export const hasGemini = () => !!store.get('geminiKey');

function fromLibrary(query) {
  const q = new Set(norm(query));
  if (!q.size) return [];
  const out = [];
  for (const c of HUM_CATS) {
    for (const [text, hint, it, lr, syn, yt] of c.items) {
      const words = new Set([...norm(text), ...norm(hint)]);
      let hit = 0;
      q.forEach((w) => { if ([...words].some((x) => x.startsWith(w) || w.startsWith(x))) hit++; });
      const score = hit / q.size;
      if (score >= 0.6) out.push({ score, song: { text, hint, it, lr, syn, ...ytField(yt), cat: c.name, src: 'Hazır Liste' } });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.song);
}

async function fromITunes(query) {
  const d = await getJSON(`https://itunes.apple.com/search?${new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: '8', country: 'TR' })}`, 2);
  return ((d && d.results) || []).map((r) => ({ text: r.trackName, hint: r.artistName, it: r.trackId, art: r.artworkUrl100, src: 'iTunes' }));
}

const ytId = (url) => {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
};

// Gemini'nin verdiği adres gerçekten var mı, gömülebilir mi: YouTube oEmbed söyler
async function validYouTube(id) {
  if (!id) return false;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url: `https://www.youtube.com/watch?v=${id}`, format: 'json' })}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function askGemini(prompt) {
  const key = store.get('geminiKey');
  if (!key) return null;
  const order = goodModel ? [goodModel, ...MODELS.filter((m) => m !== goodModel)] : MODELS;
  for (const model of order) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
      });
    } catch {
      continue;
    }
    // Model bu anahtara kapalıysa ya da kota dolduysa sıradakine geçer
    if (res.status === 404 || res.status === 429 || res.status === 503) continue;
    if (res.status === 400 || res.status === 403) throw new Error('anahtar');
    if (!res.ok) continue;
    goodModel = model;
    const d = await res.json();
    const text = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map((p) => p.text || '').join('');
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch {
      return null;
    }
  }
  return null;
}

async function fromGemini(query) {
  const res = await askGemini(`Kullanıcı mırıldanmak için bir şarkı arıyor. Yazdığı şey: "${query}"
Bu bir şarkı adı, sanatçı adı ya da tam hatırlanmayan bir söz parçası olabilir. Google'da ara ve şarkıyı bul.
Yalnızca JSON döndür: {"sarkilar":[{"ad":"şarkının adı","sanatci":"sanatçı","youtube":"https://www.youtube.com/watch?v=..."}]}
En olası 1 ile 3 şarkıyı yaz, en olası önce. youtube alanına şarkının resmi klibinin ya da resmi ses kaydının adresini yaz; emin değilsen boş bırak.`);
  const list = (res && Array.isArray(res.sarkilar) ? res.sarkilar : []).filter((x) => x && x.ad).slice(0, 3);
  return Promise.all(list.map(async (x) => {
    const id = ytId(x.youtube);
    const ok = await validYouTube(id);
    return { text: String(x.ad).trim(), hint: String(x.sanatci || '').trim(), yt: ok ? [id] : [], src: 'Gemini' };
  }));
}

// Seçilen şarkının YouTube kaydı yoksa Gemini'den ister (anahtar varsa)
export async function findYouTube(song) {
  if (!hasGemini()) return [];
  const artist = song.hint && !GENERIC.test(song.hint) ? song.hint : '';
  const res = await askGemini(`"${artist ? `${artist} - ` : ''}${song.text}" şarkısının YouTube'daki resmi klibini ya da resmi ses kaydını Google'da ara.
Yalnızca JSON döndür: {"youtube":["adres1","adres2"]}. Canlı performans, cover ya da karaoke olmasın; emin değilsen boş liste döndür.`);
  const ids = [...new Set(((res && res.youtube) || []).map(ytId).filter(Boolean))].slice(0, 3);
  const ok = await Promise.all(ids.map(validYouTube));
  return ids.filter((_, k) => ok[k]);
}

// Başka oyunlardaki şarkı adlarını hazır listedeki kayıtla eşleştirir (YouTube ve zamanlı söz bilgisiyle)
export function songByTitle(title, hint = '') {
  const want = norm(title).join(' ');
  for (const c of HUM_CATS) {
    for (const [text, h, it, lr, syn, yt] of c.items) {
      if (norm(text).join(' ') === want) return { text, hint: h, it, lr, syn, ...ytField(yt), cat: c.name };
    }
  }
  return { text: title, hint, cat: 'Şarkı' };
}

export async function findSongs(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return { songs: [], usedGemini: false, geminiError: false };
  const tasks = [
    Promise.resolve(fromLibrary(q)),
    fromITunes(q).catch(() => []),
  ];
  let geminiError = false;
  if (hasGemini()) tasks.unshift(fromGemini(q).catch((err) => { geminiError = err && err.message === 'anahtar' ? 'anahtar' : true; return []; }));
  const groups = await Promise.all(tasks);
  const seen = new Set();
  const songs = [];
  for (const s of groups.flat()) {
    const k = keyOf(s.text, s.hint);
    if (seen.has(k)) continue;
    seen.add(k);
    songs.push(s);
  }
  return { songs: songs.slice(0, 7), usedGemini: hasGemini(), geminiError };
}
