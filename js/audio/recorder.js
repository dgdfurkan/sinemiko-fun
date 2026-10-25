// Mikrofon kaydı: ham PCM toplar, sessizliği kırpar, sesi dengeler.
// Mikrofon yalnızca kayıt sırasında açık kalır. Açık kalırsa Bluetooth kulaklıklar
// düşük kaliteli telefon moduna geçer ve kayıtları dinlerken ses kesik kesik gelir.

import { ensureAudio, getCtx } from './engine.js';

const loadedContexts = new WeakSet();

async function loadWorklet(ctx) {
  if (loadedContexts.has(ctx)) return;
  await ctx.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
  loadedContexts.add(ctx);
}

// Tarayıcının ses işlemesi kapalı; gürültü bastırma heceleri keser, ters çalınca kesik duyulur
const CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
};

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

async function getStream() {
  const support = micSupport();
  if (support !== 'ok') {
    const e = new Error(support);
    e.name = support;
    throw e;
  }
  return navigator.mediaDevices.getUserMedia(CONSTRAINTS);
}

const stopStream = (stream) => {
  if (stream) stream.getTracks().forEach((t) => t.stop());
};

export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.src = null;
    this.node = null;
    this.sink = null;
    this.analyser = null;
    this.chunks = [];
    this.recording = false;
    this.legacy = false;
    this.pendingStop = null;
    this.session = 0;
  }

  get sampleRate() {
    return getCtx().sampleRate;
  }

  get active() {
    return this.recording;
  }

  // Oyun başında izni bir kez sor, mikrofonu hemen bırak
  async warmup() {
    const ctx = ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    const stream = await getStream();
    stopStream(stream);
    await this.ensureNode(ctx);
  }

  async ensureNode(ctx) {
    if (this.node) return;
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.5;
    this.levelBuf = new Float32Array(this.analyser.fftSize);
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
  }

  // Mikrofonu açar ve kayda başlar. Bu arada close() çağrılırsa false döner.
  async begin() {
    const my = ++this.session;
    this.release();
    const ctx = ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    await this.ensureNode(ctx);
    const stream = await getStream();
    if (my !== this.session) {
      stopStream(stream);
      return false;
    }
    this.stream = stream;
    this.src = ctx.createMediaStreamSource(stream);
    this.src.connect(this.analyser);
    this.src.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(ctx.destination);
    this.chunks = [];
    this.recording = true;
    if (!this.legacy) this.node.port.postMessage('start');
    return true;
  }

  // Kaydı bitirir, mikrofonu kapatır, ham örnekleri döner
  async end() {
    if (!this.recording) {
      this.release();
      return new Float32Array(0);
    }
    this.recording = false;
    let raw;
    if (this.legacy) {
      raw = this.collect();
    } else {
      raw = await new Promise((resolve) => {
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
    this.release();
    // Mikrofon açılırken oluşabilecek tıkırtıyı at
    const skip = Math.min(raw.length, Math.floor(this.sampleRate * 0.06));
    return raw.subarray(skip);
  }

  onMessage(data) {
    if (data === 'done') {
      const done = this.pendingStop;
      this.pendingStop = null;
      if (done) done(this.collect());
      return;
    }
    if (data instanceof Float32Array && this.recording) this.chunks.push(data);
    else if (data instanceof Float32Array && this.pendingStop) this.chunks.push(data);
  }

  level() {
    if (!this.analyser || !this.recording) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let sum = 0;
    for (let i = 0; i < this.levelBuf.length; i++) sum += this.levelBuf[i] * this.levelBuf[i];
    return Math.sqrt(sum / this.levelBuf.length);
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

  // Mikrofonu bırakır; worklet düğümü sonraki kayıt için kalır
  release() {
    try { this.src && this.src.disconnect(); } catch { /* bağlı değil */ }
    try { this.node && this.node.disconnect(); } catch { /* bağlı değil */ }
    try { this.sink && this.sink.disconnect(); } catch { /* bağlı değil */ }
    stopStream(this.stream);
    this.stream = null;
    this.src = null;
  }

  close() {
    this.session++;
    this.recording = false;
    if (this.pendingStop) {
      this.pendingStop(new Float32Array(0));
      this.pendingStop = null;
    }
    if (this.node && !this.legacy) this.node.port.postMessage('stop');
    this.release();
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
  if (peakRms < 0.004) return null;
  const thr = Math.max(0.003, peakRms * 0.08);
  const first = rms.findIndex((r) => r > thr);
  let last = rms.length - 1;
  while (last > first && rms[last] <= thr) last--;
  const start = Math.max(0, first * win - Math.floor(sr * 0.12));
  const end = Math.min(raw.length, (last + 1) * win + Math.floor(sr * 0.18));
  const out = raw.slice(start, end);
  // Ortalama kaymasını (DC) temizle, yoksa ters çalınca boğuk tık duyulur
  let mean = 0;
  for (let i = 0; i < out.length; i++) mean += out[i];
  mean /= out.length || 1;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] -= mean;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const gain = Math.min(0.89 / Math.max(peak, 1e-4), 10);
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  const fade = Math.min(Math.floor(sr * 0.015), Math.floor(out.length / 4));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] *= k;
    out[out.length - 1 - i] *= k;
  }
  return out;
}
