// Sesle oynanan oyunlar için canlı mikrofon: ses düzeyi, perde (Hz) ve alkış.
// Mikrofon yalnızca tur boyunca açık kalır; kulaklık takılıysa bilgisayarın kendi mikrofonu seçilir
// (Bluetooth kulaklığın mikrofonu açılınca kulaklık telefon moduna düşüyor)

import { ensureAudio } from './engine.js';
import { openMicStream, setPreferredMic } from './recorder.js';
import { listDevices, guessMic, guessPhones } from '../games/secret.js';

const N = 2048;

export async function preferBuiltInMic() {
  try {
    const devs = await listDevices();
    if (guessPhones(devs)) {
      const mic = guessMic(devs);
      if (mic) setPreferredMic(mic.id);
    }
  } catch {
    // Aygıt listesi yoksa varsayılan mikrofon
  }
}

export class Listener {
  constructor() {
    this.stream = null;
    this.src = null;
    this.an = null;
    this.sink = null;
    this.buf = new Float32Array(N);
    this.half = new Float32Array(N / 2);
    this.diff = new Float32Array(N / 4);
    this.on = false;
    this.noise = 0.004;
    this.env = 0;
    this.lastOnset = 0;
    this.session = 0;
  }

  get rate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  async open() {
    const my = ++this.session;
    this.close(false);
    const ctx = ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    this.ctx = ctx;
    await preferBuiltInMic();
    const stream = await openMicStream();
    if (my !== this.session) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.stream = stream;
    this.an = ctx.createAnalyser();
    this.an.fftSize = N;
    this.an.smoothingTimeConstant = 0;
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.src = ctx.createMediaStreamSource(stream);
    this.src.connect(this.an);
    // Çizgeye bağlı kalsın diye sessiz çıkış
    this.an.connect(this.sink);
    this.sink.connect(ctx.destination);
    this.on = true;
    this.frameAt = -1;
    return true;
  }

  close(bump = true) {
    if (bump) this.session++;
    this.on = false;
    try {
      if (this.src) this.src.disconnect();
      if (this.an) this.an.disconnect();
      if (this.sink) this.sink.disconnect();
    } catch {
      // Zaten kopuk
    }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.src = null;
    this.an = null;
    this.sink = null;
  }

  // Aynı karede birden çok ölçüm aynı veriyi kullanır
  read() {
    if (!this.an) return null;
    const now = performance.now();
    if (now - this.frameAt > 8) {
      this.an.getFloatTimeDomainData(this.buf);
      this.frameAt = now;
    }
    return this.buf;
  }

  level() {
    const b = this.read();
    if (!b) return 0;
    let s = 0;
    for (let i = 0; i < N; i++) s += b[i] * b[i];
    return Math.sqrt(s / N);
  }

  peak() {
    const b = this.read();
    if (!b) return 0;
    let m = 0;
    for (let i = N - 1024; i < N; i++) {
      const v = Math.abs(b[i]);
      if (v > m) m = v;
    }
    return m;
  }

  // Ortam gürültüsü: sessizken ölçülür, eşikler buna göre ayarlanır
  calibrate(lv) {
    this.noise = Math.max(0.002, Math.min(0.05, lv));
  }

  // YIN yöntemi, yarıya indirilmiş örneklerle: 70-1100 Hz arası insan sesi.
  // { hz, clarity } döner; ses yoksa ya da perde belirsizse hz 0
  pitch() {
    const b = this.read();
    if (!b) return { hz: 0, clarity: 0 };
    const h = this.half;
    let rms = 0;
    for (let i = 0; i < N / 2; i++) {
      const v = (b[i * 2] + b[i * 2 + 1]) * 0.5;
      h[i] = v;
      rms += v * v;
    }
    rms = Math.sqrt(rms / (N / 2));
    if (rms < Math.max(0.008, this.noise * 2.2)) return { hz: 0, clarity: 0, rms };
    const sr = this.rate / 2;
    const minT = Math.floor(sr / 1100);
    const maxT = Math.min(N / 4 - 1, Math.ceil(sr / 70));
    const W = N / 2 - maxT;
    const d = this.diff;
    d[0] = 1;
    let run = 0;
    let best = -1;
    for (let t = 1; t <= maxT; t++) {
      let s = 0;
      for (let j = 0; j < W; j++) {
        const x = h[j] - h[j + t];
        s += x * x;
      }
      run += s;
      d[t] = run ? (s * t) / run : 1;
      if (t > minT && best < 0 && d[t] < 0.18) {
        // Çukurun dibini bul
        let k = t;
        while (k + 1 <= maxT) {
          let s2 = 0;
          for (let j = 0; j < W; j++) {
            const x = h[j] - h[j + k + 1];
            s2 += x * x;
          }
          const nd = ((s2) * (k + 1)) / (run + s2);
          if (nd >= d[k]) break;
          run += s2;
          k++;
          d[k] = nd;
        }
        best = k;
        break;
      }
    }
    if (best < 0) return { hz: 0, clarity: 0, rms };
    // Parabolik ara değer
    const a = d[best - 1] ?? d[best];
    const c = d[best + 1] ?? d[best];
    const den = a + c - 2 * d[best];
    const shift = den ? (a - c) / (2 * den) : 0;
    const T = best + Math.max(-1, Math.min(1, shift));
    return { hz: sr / T, clarity: 1 - d[best], rms };
  }

  // Alkış ve vuruş: ani tepe. Son tetiklemeden bu yana en az gap ms geçmeli
  onset(gap = 140) {
    const p = this.peak();
    const now = performance.now();
    const thr = Math.max(0.12, this.noise * 9, this.env * 2.6);
    const hit = p > thr && now - this.lastOnset > gap;
    this.env += (p - this.env) * (p > this.env ? 0.5 : 0.08);
    if (hit) this.lastOnset = now;
    return hit ? p : 0;
  }
}

// Hz → MIDI nota (ondalıklı)
export const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
export const NOTE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const noteName = (m) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12];
