// Tek AudioContext ve ses yolları: music, mask, sfx, clips

let ctx = null;
let limiter = null;
const buses = {};
let noise = null;
let pink = null;

export const getCtx = () => ctx;
export const bus = (name) => buses[name];
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // 'balanced' daha büyük tampon kullanır; yoğun anda ses kesilmesini önler
    ctx = new AC({ latencyHint: 'balanced' });
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    for (const name of ['music', 'mask', 'sfx']) {
      const g = ctx.createGain();
      g.connect(limiter);
      buses[name] = g;
    }
    // Ses kayıtları sıkıştırıcıya girmez; zaten dengelenmiş durumda, sıkıştırma pompalama yapar
    buses.clips = ctx.createGain();
    buses.clips.connect(ctx.destination);
    buses.mask.gain.value = 0;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setBusVolume(name, value, seconds = 0.2) {
  if (!ctx || !buses[name]) return;
  const g = buses[name].gain;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.setTargetAtTime(value, now, Math.max(0.01, seconds / 3));
}

export function noiseBuffer() {
  if (!noise) {
    const len = Math.floor(ctx.sampleRate * 1.5);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

// Paul Kellet yöntemiyle pembe gürültü (fısıltı oyununda sesi maskelemek için)
export function pinkBuffer() {
  if (!pink) {
    const len = Math.floor(ctx.sampleRate * 4);
    pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return pink;
}

/* ---------- Çıkış seçimi (kulaklık modu) ---------- */

// Maske müziği ayrı bir aygıta, geri kalan her şey başka bir aygıta gidebilir mi (Chrome, Edge)
export const canSplitOutput = () => {
  const AC = window.AudioContext;
  return !!(AC && AC.prototype.setSinkId) && typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
};

let maskEl = null;
let maskDest = null;

// sinkId verilirse maske yolu bir ses öğesi üzerinden o aygıta akar; null ise normal çıkışa döner
export async function routeMask(sinkId) {
  const c = ensureAudio();
  if (!c) return false;
  if (sinkId == null) {
    if (!maskEl) return true;
    try { buses.mask.disconnect(); } catch { /* bağlı değil */ }
    buses.mask.connect(limiter);
    maskEl.pause();
    maskEl.srcObject = null;
    maskEl = null;
    return true;
  }
  if (!maskDest) maskDest = c.createMediaStreamDestination();
  if (!maskEl) {
    try { buses.mask.disconnect(); } catch { /* bağlı değil */ }
    buses.mask.connect(maskDest);
    maskEl = new Audio();
    maskEl.srcObject = maskDest.stream;
  }
  try {
    await maskEl.setSinkId(sinkId);
    await maskEl.play();
    return true;
  } catch (err) {
    console.warn(err);
    await routeMask(null);
    return false;
  }
}

// Ana çıkış (efektler, kayıtlar, müzik); boş dize sistemin varsayılanı
export async function setOutput(sinkId) {
  const c = ensureAudio();
  if (!c || !c.setSinkId) return false;
  try {
    if ((c.sinkId || '') !== (sinkId || '')) await c.setSinkId(sinkId || '');
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

// Sekme gizlenince sesi dondur, dönünce devam et
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});
