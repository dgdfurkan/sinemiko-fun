// Mikrofon kaydı: ham PCM toplar, sessizliği kırpar, sesi dengeler

import { ensureAudio, getCtx } from './engine.js';

const loadedContexts = new WeakSet();

async function loadWorklet(ctx) {
  if (loadedContexts.has(ctx)) return;
  await ctx.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
  loadedContexts.add(ctx);
}

export function micSupport() {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
  return 'ok';
}

export function micErrorText(err) {
  const name = err && err.name;
  if (name === 'insecure') return 'Mikrofon yalnızca güvenli bağlantıda açılır. Oyunu https adresinden ya da localhost üzerinden aç.';
  if (name === 'unsupported') return 'Bu tarayıcı mikrofon kaydını desteklemiyor. Chrome, Edge ya da Safari ile dene.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesine tıkla, mikrofona izin ver ve tekrar dene.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Bağlı bir mikrofon bulunamadı. Kulaklık ya da mikrofon takıp tekrar dene.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Mikrofonu başka bir uygulama kullanıyor olabilir. Onu kapatıp tekrar dene.';
  return 'Mikrofon açılamadı. Sayfayı yenileyip tekrar dene.';
}

export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.node = null;
    this.chunks = [];
    this.recording = false;
    this.legacy = false;
    this.pendingStop = null;
  }

  get ready() {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live');
  }

  get sampleRate() {
    return getCtx().sampleRate;
  }

  async open() {
    if (this.ready) return;
    this.close();
    const support = micSupport();
    if (support !== 'ok') {
      const e = new Error(support);
      e.name = support;
      throw e;
    }
    const ctx = ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.5;
    this.levelBuf = new Float32Array(this.analyser.fftSize);
    this.src.connect(this.analyser);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    try {
      if (!ctx.audioWorklet) throw new Error('no worklet');
      await loadWorklet(ctx);
      this.node = new AudioWorkletNode(ctx, 'sinemiko-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      this.node.port.onmessage = (e) => this.onMessage(e.data);
      this.legacy = false;
    } catch {
      // Eski tarayıcılar için yedek yol
      this.node = ctx.createScriptProcessor(4096, 1, 1);
      this.node.onaudioprocess = (e) => {
        if (this.recording) this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      this.legacy = true;
    }
    this.src.connect(this.node);
    this.node.connect(this.sink);
  }

  onMessage(data) {
    if (data === 'done') {
      const done = this.pendingStop;
      this.pendingStop = null;
      if (done) done(this.collect());
      return;
    }
    if (data instanceof Float32Array) this.chunks.push(data);
  }

  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let sum = 0;
    for (let i = 0; i < this.levelBuf.length; i++) sum += this.levelBuf[i] * this.levelBuf[i];
    return Math.sqrt(sum / this.levelBuf.length);
  }

  start() {
    this.chunks = [];
    this.recording = true;
    if (!this.legacy) this.node.port.postMessage('start');
  }

  stop() {
    this.recording = false;
    if (this.legacy) return Promise.resolve(this.collect());
    return new Promise((resolve) => {
      this.pendingStop = resolve;
      this.node.port.postMessage('stop');
      // Worklet cevap vermezse elde olanla devam et
      setTimeout(() => {
        if (this.pendingStop === resolve) {
          this.pendingStop = null;
          resolve(this.collect());
        }
      }, 800);
    });
  }

  collect() {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    this.chunks = [];
    return out;
  }

  close() {
    this.recording = false;
    if (this.pendingStop) {
      this.pendingStop(new Float32Array(0));
      this.pendingStop = null;
    }
    try { this.src && this.src.disconnect(); } catch { /* bağlı değil */ }
    try { this.node && this.node.disconnect(); } catch { /* bağlı değil */ }
    try { this.sink && this.sink.disconnect(); } catch { /* bağlı değil */ }
    if (this.node && this.node.port) this.node.port.onmessage = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.node = null;
    this.src = null;
    this.sink = null;
    this.analyser = null;
  }
}

// Baştaki ve sondaki sessizliği at, tepe değeri dengele, uçlara yumuşak geçiş koy
export function cleanClip(raw, sr) {
  const win = Math.max(1, Math.floor(sr * 0.01));
  if (!raw || raw.length < win * 8) return null;
  const rms = [];
  let peakRms = 0;
  for (let i = 0; i + win <= raw.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += raw[j] * raw[j];
    const r = Math.sqrt(s / win);
    rms.push(r);
    if (r > peakRms) peakRms = r;
  }
  if (peakRms < 0.006) return null;
  const thr = Math.max(0.004, peakRms * 0.09);
  let first = rms.findIndex((r) => r > thr);
  let last = rms.length - 1;
  while (last > first && rms[last] <= thr) last--;
  const start = Math.max(0, first * win - Math.floor(sr * 0.1));
  const end = Math.min(raw.length, (last + 1) * win + Math.floor(sr * 0.16));
  const out = raw.slice(start, end);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = Math.min(0.9 / Math.max(peak, 1e-4), 12);
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  const fade = Math.min(Math.floor(sr * 0.012), Math.floor(out.length / 4));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] *= k;
    out[out.length - 1 - i] *= k;
  }
  return out;
}
