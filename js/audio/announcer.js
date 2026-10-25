// Oyun sunucusu: Gemini TTS ile önceden seslendirilmiş duygulu komutlar (tools/seslendir.py).
// Dosyalar audio/voice/<id>.mp3; ilk istekte indirilip bir kez çözülür.

import { ensureAudio, bus } from './engine.js';
import { store, isDefaultName } from '../lib/store.js';

const buffers = new Map();
let current = null;
let token = 0;
let busyUntil = 0;

function load(id) {
  if (!buffers.has(id)) {
    const p = (async () => {
      const ctx = ensureAudio();
      if (!ctx) return null;
      const res = await fetch(new URL(`../../audio/voice/${id}.mp3`, import.meta.url));
      if (!res.ok) throw new Error(`ses ${id} ${res.status}`);
      return ctx.decodeAudioData(await res.arrayBuffer());
    })();
    buffers.set(id, p);
    p.catch(() => buffers.delete(id));
  }
  return buffers.get(id).catch(() => null);
}

function playBuf(buf) {
  const ctx = ensureAudio();
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1.15;
    src.connect(g).connect(bus('sfx'));
    current = src;
    busyUntil = performance.now() + buf.duration * 1000;
    src.onended = () => {
      if (current === src) current = null;
      resolve();
    };
    src.start();
  });
}

const CHEERS = ['yay-1', 'yay-2', 'yay-3', 'yay-4'];

export const announcer = {
  preload(ids) {
    if (!store.get('voiceOn')) return;
    ids.forEach((id) => load(id));
  },
  // Satırları sırayla okur; yeni bir komut gelince eskisi hemen susar
  async say(...ids) {
    const my = ++token;
    this.stop();
    if (!store.get('voiceOn')) return;
    // Dosya yüklenirken de meşgul sayılır; tezahürat araya girip komutu kesmesin
    busyUntil = performance.now() + 1200;
    for (const id of ids.flat().filter(Boolean)) {
      const buf = await load(id);
      if (my !== token) return;
      if (buf) await playBuf(buf);
      if (my !== token) return;
    }
  },
  // Konuşma sürüyorsa araya girmez; tezahürat gibi ikincil sesler için
  react(id) {
    if (performance.now() < busyUntil) return;
    this.say(id);
  },
  cheer() {
    this.react(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  },
  // Varsayılan isimler kayıtlı; isim değiştiyse isimsiz satır okunur
  turn(i, kind) {
    const generic = { poz: 'go-pozver', kopya: 'go-kopyala', stage: 'letsgo' };
    this.say(isDefaultName(i) ? `turn-${i}-${kind}` : generic[kind]);
  },
  winner(i) {
    if (i === -1) this.say('tie');
    else this.say(isDefaultName(i) ? `win-${i}` : 'win-any');
  },
  stop() {
    busyUntil = 0;
    if (current) {
      try {
        current.stop();
      } catch {
        // Zaten bitmiş olabilir
      }
      current = null;
    }
  },
};
