// Görüntü tanıma ayrı bir iş parçacığında çalışır: kare buraya gelir, sonuç sayılar olarak döner.
// Ana iş parçacığı model beklerken donmaz; animasyonlar ve düğmeler akıcı kalır.
// Klasik worker: MediaPipe wasm yükleyicisini importScripts ile getirir, modül worker'da bu çalışmaz.

let tasks = [];
let kind = 'pose';
let blendNames = null;
// Vücut için kare ikiye bölünür; parçaların ortadaki örtüşmesi izleyiciden gelir, gelmezse bu kadar
const OVERLAP = 0.06;

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

// MediaPipe bilgi satırlarını console.error ile basar; worker'da da susturulur, hata gibi görünmesin
for (const k of ['error', 'warn', 'log', 'info']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => {
    if (typeof a[0] === 'string' && /^(INFO:|[IW]\d{4} \d)/.test(a[0])) return;
    orig(...a);
  };
}

async function init({ lib, model, kind: k, opts }) {
  kind = k;
  // jsDelivr .cjs dosyasını JavaScript türüyle sunmuyor; importScripts reddeder. Metin olarak alıp çalıştırılır
  const code = await (await fetch(`${lib}/vision_bundle.cjs`)).text();
  self.exports = {};
  (0, eval)(code);
  const { FilesetResolver, PoseLandmarker, FaceLandmarker, HandLandmarker } = self.exports;
  const fileset = await FilesetResolver.forVisionTasks(`${lib}/wasm`);
  const buf = new Uint8Array(model);
  const Cls = kind === 'face' ? FaceLandmarker : kind === 'hand' ? HandLandmarker : PoseLandmarker;
  const make = (delegate, o) => Cls.createFromOptions(fileset, { baseOptions: { modelAssetBuffer: buf.slice(), delegate }, runningMode: 'VIDEO', ...o });
  // İki ayrı model: kadrajın iki yarısı için, her biri tek kişi (ya da tek yüz) arar.
  // Tek modelle iki kişi aranınca yan yana duranlar karışıyor, video modunda da ikinci yüz hiç aranmıyordu.
  // Ellerde her yarıda o kişinin iki eli aranır
  const one = kind === 'face' ? { ...opts, numFaces: 1 } : kind === 'hand' ? { ...opts, numHands: 2 } : { ...opts, numPoses: 1 };
  const plan = [one, one];
  let delegate = 'GPU';
  try {
    tasks = [];
    for (const o of plan) tasks.push(await make('GPU', o));
  } catch {
    delegate = 'CPU';
    tasks = [];
    for (const o of plan) tasks.push(await make('CPU', o));
  }
  return delegate;
}

// Noktalar düz bir Float32Array'e paketlenir: x, y, z, görünürlük. x0, kw: parçanın tam karedeki yeri
function pack(list, x0 = 0, kw = 1) {
  const out = new Float32Array(list.length * 4);
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    out[i * 4] = x0 + p.x * kw;
    out[i * 4 + 1] = p.y;
    out[i * 4 + 2] = p.z;
    out[i * 4 + 3] = p.visibility ?? 1;
  }
  return out;
}

// Karanlık odada model yüzü ve eli kaçırır. Kare ara ara küçültülüp ortalama parlaklığı ölçülür;
// karanlıksa modele giden kare aydınlatılır (kare üstüne kendisi eklenerek, her tarayıcıda çalışır)
let light = 0.5;
let gain = 1;
let frameNo = 0;
let probe = null;
let boost = null;

function measure(bitmap) {
  if (typeof OffscreenCanvas === 'undefined') return;
  if (!probe) probe = new OffscreenCanvas(32, 18).getContext('2d', { willReadFrequently: true });
  probe.drawImage(bitmap, 0, 0, 32, 18);
  const d = probe.getImageData(0, 0, 32, 18).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  light = sum / (d.length / 4) / 255;
  const want = light < 0.34 ? Math.min(2.4, 0.4 / Math.max(0.05, light)) : 1;
  gain += 0.5 * (want - gain);
  if (gain < 1.08) gain = 1;
}

function brighten(bitmap) {
  const W = bitmap.width;
  const H = bitmap.height;
  if (!boost || boost.canvas.width !== W || boost.canvas.height !== H) boost = new OffscreenCanvas(W, H).getContext('2d');
  boost.globalCompositeOperation = 'source-over';
  boost.globalAlpha = 1;
  boost.drawImage(bitmap, 0, 0);
  boost.globalCompositeOperation = 'lighter';
  let left = gain - 1;
  while (left > 0.01) {
    boost.globalAlpha = Math.min(1, left);
    boost.drawImage(bitmap, 0, 0);
    left -= 1;
  }
  return boost.canvas;
}

async function detect({ bitmap, ts, id, split }) {
  const t0 = performance.now();
  const people = [];
  const transfer = [];
  try {
    const W = bitmap.width;
    const H = bitmap.height;
    if (frameNo++ % 15 === 0) {
      try {
        measure(bitmap);
      } catch {
        gain = 1;
      }
    }
    const src = gain > 1 ? brighten(bitmap) : bitmap;
    const s = Math.min(0.75, Math.max(0.25, split ? split.s : 0.5));
    const ov = split ? split.ov : OVERLAP;
    const parts = [[0, Math.min(1, s + ov)], [Math.max(0, s - ov), 1]];
    for (let k = 0; k < 2; k++) {
      const [a, b] = parts[k];
      const sx = Math.round(a * W);
      const sw = Math.round(b * W) - sx;
      const crop = await createImageBitmap(src, sx, 0, sw, H);
      const res = tasks[k].detectForVideo(crop, ts);
      crop.close();
      if (kind === 'face') {
        (res.faceLandmarks || []).forEach((lm, i) => {
          const cats = res.faceBlendshapes && res.faceBlendshapes[i] ? res.faceBlendshapes[i].categories : [];
          if (!blendNames && cats.length) blendNames = cats.map((c) => c.categoryName);
          const blend = new Float32Array(cats.map((c) => c.score));
          const pts = pack(lm, sx / W, sw / W);
          people.push({ pts, blend, part: k });
          transfer.push(pts.buffer, blend.buffer);
        });
      } else {
        (res.landmarks || []).forEach((lm, i) => {
          const pts = pack(lm, sx / W, sw / W);
          const hs = kind === 'hand' && res.handedness && res.handedness[i] && res.handedness[i][0];
          people.push({ pts, part: k, score: hs ? hs.score : 1 });
          transfer.push(pts.buffer);
        });
      }
    }
  } catch (err) {
    bitmap.close();
    post({ type: 'result', id, people: [], ms: 0, error: String(err && err.message) });
    return;
  }
  bitmap.close();
  post({ type: 'result', id, people, blendNames, light, gain, ms: performance.now() - t0 }, transfer);
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      const delegate = await init(m);
      post({ type: 'ready', delegate });
    } catch (err) {
      post({ type: 'error', message: String(err && err.message) });
    }
  } else if (m.type === 'frame') {
    if (!tasks.length) {
      m.bitmap.close();
      post({ type: 'result', id: m.id, people: [], ms: 0 });
      return;
    }
    await detect(m);
  }
};
