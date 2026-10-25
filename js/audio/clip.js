// Ses kliplerini oluşturma, ters çevirme, çalma ve WAV olarak indirme

import { getCtx, bus } from './engine.js';
import { music } from './music.js';

export function makeBuffer(samples, sr) {
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, Math.max(1, samples.length), sr);
  buf.copyToChannel(samples, 0);
  return buf;
}

export function reverseBuffer(buffer) {
  const data = buffer.getChannelData(0).slice().reverse();
  return makeBuffer(data, buffer.sampleRate);
}

let current = null;

export function stopClip() {
  if (!current) return;
  const h = current;
  current = null;
  h.stopped = true;
  try { h.src.stop(); } catch { /* zaten durmuş */ }
  music.duck('clip', false);
  document.body.classList.remove('audio-focus');
}

export const isPlaying = () => !!current;

// Tek seferde tek klip çalar; onEnd(stopped) her durumda bir kez çağrılır
export function playClip(buffer, { onProgress, onEnd } = {}) {
  stopClip();
  const ctx = getCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(bus('clips'));
  const startAt = ctx.currentTime + 0.03;
  const handle = { src, stopped: false, ended: false };
  music.duck('clip', true);
  document.body.classList.add('audio-focus');
  src.onended = () => {
    if (handle.ended) return;
    handle.ended = true;
    if (current === handle) {
      current = null;
      music.duck('clip', false);
      document.body.classList.remove('audio-focus');
    }
    if (onProgress) onProgress(handle.stopped ? 0 : 1);
    if (onEnd) onEnd(handle.stopped);
  };
  src.start(startAt);
  current = handle;
  if (onProgress) {
    const loop = () => {
      if (handle.ended) return;
      const p = Math.min(1, Math.max(0, (ctx.currentTime - startAt) / buffer.duration));
      onProgress(p);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  return handle;
}

export function peaks(buffer, bars) {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / bars));
  const out = new Array(bars).fill(0);
  let max = 0;
  for (let b = 0; b < bars; b++) {
    let m = 0;
    const end = Math.min(data.length, (b + 1) * size);
    for (let i = b * size; i < end; i++) {
      const v = Math.abs(data[i]);
      if (v > m) m = v;
    }
    out[b] = m;
    if (m > max) max = m;
  }
  return out.map((v) => Math.sqrt(v / (max || 1)));
}

function encodeWav(samples, sr) {
  const bytes = 44 + samples.length * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

// Klipleri aralarında kısa sessizlikle art arda ekleyip indirir
export function downloadClips(buffers, filename, gap = 0.45) {
  const sr = buffers[0].sampleRate;
  const gapLen = Math.floor(gap * sr);
  const total = buffers.reduce((n, b) => n + b.length, 0) + gapLen * (buffers.length - 1);
  const out = new Float32Array(total);
  let o = 0;
  buffers.forEach((b, i) => {
    out.set(b.getChannelData(0), o);
    o += b.length + (i < buffers.length - 1 ? gapLen : 0);
  });
  const url = URL.createObjectURL(encodeWav(out, sr));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
