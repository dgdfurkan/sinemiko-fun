// Kamera ile yüz ve vücut takibi: MediaPipe yalnızca kamera oyunu açılınca yüklenir.
// Görüntü cihazdan çıkmaz; modeller tarayıcıda, mümkünse ayrı bir iş parçacığında çalışır.

const VER = '0.10.14';
const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  // "full" model kalkan kolu, kısmen kadraj dışındaki eli ve yan yana iki kişiyi "lite"tan çok daha iyi bulur
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};
// Eşikler biraz düşük: kadraja zor sığan, yarısı görünen kişi de bulunsun; titreşimi süzgeç alır
const OPTS = {
  face: { numFaces: 2, outputFaceBlendshapes: true, minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4, minTrackingConfidence: 0.4 },
  pose: { numPoses: 2, minPoseDetectionConfidence: 0.35, minPosePresenceConfidence: 0.35, minTrackingConfidence: 0.35 },
  hand: { numHands: 4, minHandDetectionConfidence: 0.45, minHandPresenceConfidence: 0.45, minTrackingConfidence: 0.4 },
};
// Modele giden kare: 1280x720 hem doğru hem hızlı; tam çözünürlük yalnızca fotoğraflar için
const INFER_W = 1280;

let libPromise = null;
const enginePromises = {};

// MediaPipe kendi bilgi satırlarını console.error ile basar; bunlar hata değil
let quiet = false;
function quietLogs() {
  if (quiet) return;
  quiet = true;
  for (const k of ['error', 'warn']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => {
      if (typeof a[0] === 'string' && /^(INFO:|[IW]\d{4} \d)/.test(a[0])) return;
      orig(...a);
    };
  }
}

function loadLib() {
  quietLogs();
  if (!libPromise) {
    libPromise = (async () => {
      const lib = await import(`${LIB}/vision_bundle.mjs`);
      const fileset = await lib.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
      return { lib, fileset };
    })();
    libPromise.catch(() => { libPromise = null; });
  }
  return libPromise;
}

async function fetchModel(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`model ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total && onProgress) onProgress(Math.min(1, loaded / total));
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/* ---------- Motorlar: aynı arayüz, iki yer ---------- */

// Sonuç her durumda aynı biçimde döner: { people: [{ lm: [{x, y, z, v}], blend }] }, aynalanmamış
function fromTask(kind, res) {
  const people = [];
  if (kind === 'face') {
    (res.faceLandmarks || []).forEach((lm, i) => {
      const blend = {};
      const cats = res.faceBlendshapes && res.faceBlendshapes[i] ? res.faceBlendshapes[i].categories : [];
      for (const c of cats) blend[c.categoryName] = c.score;
      people.push({ lm: lm.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 1 })), blend });
    });
  } else {
    (res.landmarks || []).forEach((lm, i) => {
      const hs = kind === 'hand' && res.handedness && res.handedness[i] && res.handedness[i][0];
      people.push({ lm: lm.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 1 })), score: hs ? hs.score : 1 });
    });
  }
  return { people };
}

// Kare ikiye bölünür, parçalar ortada bu kadar örtüşür (aradaki boşluğa göre değişir)
const OVERLAP = 0.06;

// Test sahtesi tek parça çalışır; gerçek motorlar kareyi iki parçaya böler
function mockEngine(kind, task) {
  return {
    mode: 'mock',
    detect: (video, ts) => Promise.resolve(fromTask(kind, task.detectForVideo(video, ts))),
    close: () => {},
  };
}

function mainEngine(kind, tasks) {
  return {
    mode: 'main',
    async detect(video, ts, split) {
      const W = video.videoWidth;
      const H = video.videoHeight;
      const s = Math.min(0.75, Math.max(0.25, split ? split.s : 0.5));
      const ov = split ? split.ov : OVERLAP;
      const people = [];
      const parts = [[0, Math.min(1, s + ov)], [Math.max(0, s - ov), 1]];
      for (let k = 0; k < 2; k++) {
        const [a, b] = parts[k];
        const sx = Math.round(a * W);
        const sw = Math.round(b * W) - sx;
        const crop = await createImageBitmap(video, sx, 0, sw, H);
        const res = fromTask(kind, tasks[k].detectForVideo(crop, ts));
        crop.close();
        res.people.forEach((d) => {
          d.lm.forEach((q) => { q.x = sx / W + q.x * (sw / W); });
          d.part = k;
          people.push(d);
        });
      }
      return { people };
    },
    close: () => {},
  };
}

async function createMainTasks(kind, buf) {
  const { lib, fileset } = await loadLib();
  const Cls = kind === 'face' ? lib.FaceLandmarker : kind === 'hand' ? lib.HandLandmarker : lib.PoseLandmarker;
  const one = kind === 'face' ? { ...OPTS.face, numFaces: 1 } : kind === 'hand' ? { ...OPTS.hand, numHands: 2 } : { ...OPTS.pose, numPoses: 1 };
  const plan = [one, one];
  const make = (delegate, o) => Cls.createFromOptions(fileset, { baseOptions: { modelAssetBuffer: buf.slice(), delegate }, runningMode: 'VIDEO', ...o });
  const out = [];
  try {
    for (const o of plan) out.push(await make('GPU', o));
  } catch {
    // Ekran kartı kullanılamazsa işlemciyle devam et
    out.length = 0;
    for (const o of plan) out.push(await make('CPU', o));
  }
  return out;
}

async function frameBitmap(video) {
  const w = Math.min(INFER_W, video.videoWidth);
  const h = Math.round((w / video.videoWidth) * video.videoHeight);
  try {
    return await createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });
  } catch {
    // Boyut seçeneğini tanımayan tarayıcılar
    return createImageBitmap(video);
  }
}

function workerEngine(kind, buf) {
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = new Worker(new URL('./worker.js', import.meta.url));
    } catch (err) {
      reject(err);
      return;
    }
    const pending = new Map();
    let seq = 0;
    let names = null;
    const fail = (err) => {
      clearTimeout(timer);
      w.terminate();
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error('worker timeout')), 25000);
    const unpack = (m) => ({
      people: m.people.map((d) => {
        const lm = [];
        for (let i = 0; i < d.pts.length; i += 4) lm.push({ x: d.pts[i], y: d.pts[i + 1], z: d.pts[i + 2], v: d.pts[i + 3] });
        let blend;
        if (d.blend && names) {
          blend = {};
          names.forEach((n, k) => { blend[n] = d.blend[k]; });
        }
        return { lm, blend, part: d.part, score: d.score };
      }),
      ms: m.ms,
      light: m.light,
      gain: m.gain,
    });
    const engine = {
      mode: 'worker',
      async detect(video, ts, split) {
        const bitmap = await frameBitmap(video);
        const id = ++seq;
        return new Promise((res) => {
          pending.set(id, res);
          w.postMessage({ type: 'frame', bitmap, ts, id, split }, [bitmap]);
        });
      },
      close: () => w.terminate(),
    };
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') {
        clearTimeout(timer);
        engine.delegate = m.delegate;
        resolve(engine);
      } else if (m.type === 'error') {
        fail(new Error(m.message));
      } else if (m.type === 'result') {
        if (m.blendNames) names = m.blendNames;
        const cb = pending.get(m.id);
        pending.delete(m.id);
        if (cb) cb(unpack(m));
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      fail(new Error(e.message || 'worker'));
    };
    // Model kopyası gönderilir; worker açılmazsa aynı model ana iş parçacığında kullanılır
    const copy = buf.slice();
    w.postMessage({ type: 'init', lib: LIB, model: copy.buffer, kind, opts: OPTS[kind] }, [copy.buffer]);
  });
}

// kind: 'face' en fazla iki yüz ve ifade puanları, 'pose' en fazla iki kişinin iskeleti, 'hand' iki kişinin elleri
export function getTask(kind, onProgress = () => {}) {
  const mock = window.__sinemikoVisionMock;
  if (mock) return Promise.resolve(mockEngine(kind, mock(kind)));
  if (!enginePromises[kind]) {
    enginePromises[kind] = (async () => {
      quietLogs();
      onProgress(0.03);
      const buf = await fetchModel(MODELS[kind], (p) => onProgress(0.05 + p * 0.85));
      let engine;
      try {
        if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined' || window.__sinemikoNoWorker) throw new Error('no worker');
        engine = await workerEngine(kind, buf);
      } catch (err) {
        console.warn('Görüntü tanıma ayrı iş parçacığında açılamadı, ana iş parçacığında çalışacak.', err && err.message);
        engine = mainEngine(kind, await createMainTasks(kind, buf));
        engine.why = String(err && err.message);
      }
      onProgress(1);
      return engine;
    })();
    enginePromises[kind].catch(() => { delete enginePromises[kind]; });
  }
  return enginePromises[kind];
}

/* ---------- Kamera ---------- */

export function camErrorText(err) {
  const name = err && err.name;
  if (!window.isSecureContext) return 'Kamera yalnızca güvenli bağlantıda açılır. Oyunu https adresinden ya da localhost üzerinden aç.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Kamera izni verilmedi. Adres çubuğundaki kilit simgesine tıkla, kameraya izin ver ve tekrar dene.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Bağlı bir kamera bulunamadı.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Kamerayı başka bir uygulama kullanıyor olabilir. Onu kapatıp tekrar dene.';
  if (name === 'model') return 'Görüntü tanıma modeli indirilemedi. İnternet bağlantını kontrol edip tekrar dene.';
  return 'Kamera açılamadı. Sayfayı yenileyip tekrar dene.';
}

export async function openCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('unsupported');
    e.name = 'NotFoundError';
    throw e;
  }
  // Mümkün olan en geniş kadraj: 16:9 ve yüksek çözünürlük; iki kişi yan yana sığsın
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } },
    audio: false,
  });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (!video.videoWidth) {
    await new Promise((resolve) => {
      const done = () => { video.removeEventListener('loadeddata', done); resolve(); };
      video.addEventListener('loadeddata', done);
      setTimeout(done, 3000);
    });
  }
  return stream;
}

export function closeCamera(video, stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (video) video.srcObject = null;
}

/* ---------- Titreşim süzgeci ---------- */

// One Euro: yavaşken güçlü süzer (titreme gider), hızlanınca açılır (gecikme olmaz)
function smoother(n, minCutoff, beta) {
  const x = new Float32Array(n);
  const dx = new Float32Array(n);
  let t = 0;
  let init = false;
  const alpha = (dt, cutoff) => {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (1 + r);
  };
  return (vals, now) => {
    if (!init) {
      for (let i = 0; i < n; i++) x[i] = vals[i];
      t = now;
      init = true;
      return x;
    }
    const dt = Math.min(0.25, Math.max(0.004, (now - t) / 1000));
    t = now;
    const ad = alpha(dt, 1);
    for (let i = 0; i < n; i++) {
      const d = (vals[i] - x[i]) / dt;
      dx[i] += ad * (d - dx[i]);
      x[i] += alpha(dt, minCutoff + beta * Math.abs(dx[i])) * (vals[i] - x[i]);
    }
    return x;
  };
}

/* ---------- Takip döngüsü ---------- */

function boxOf(lm) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of lm) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const SMOOTH = { pose: [1.4, 6], face: [1.6, 4], hand: [2.2, 8] };
// Model bir iki kare kişiyi kaçırınca oyuncu hemen kaybolmaz; son hali kısa süre tutulur, oyunlar titremez
const HOLD_MS = 320;

// Kadraj aynalı gösterilir; soldaki kişi solda görünür. leftIs: solda duran oyuncu (0 ya da 1).
// Kare yalnızca kamera yeni görüntü verince ve önceki sonuç gelmişse modele gider: kuyruk birikmez.
export class Tracker {
  constructor({ task, kind, video, onFrame, leftIs = 0 }) {
    this.engine = task;
    this.kind = kind;
    this.video = video;
    this.onFrame = onFrame;
    this._left = leftIs;
    this.running = false;
    this.busy = false;
    this.lastTs = 0;
    this.players = [null, null];
    this.lastPos = [null, null];
    this.lastSeen = [0, 0];
    this.filters = [null, null];
    this.blends = [null, null];
    this.vis = [null, null];
    this.stats = { frames: 0, ms: 0, worst: 0 };
    this.cut = null;
    this.sent = null;
    this.searchK = 0;
  }

  get leftIs() {
    return this._left;
  }

  // Yer değişince geçmiş ve süzgeçler sıfırlanır; eski kişinin hareketi yenisine karışmasın
  set leftIs(v) {
    if (v === this._left) return;
    this._left = v;
    this.filters = [null, null];
    this.lastPos = [null, null];
    this.cut = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.vfc && this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.vfc);
    cancelAnimationFrame(this.raf);
    this.vfc = 0;
  }

  schedule() {
    if (!this.running) return;
    const v = this.video;
    if (v.requestVideoFrameCallback) {
      this.vfc = v.requestVideoFrameCallback(() => {
        this.tick();
        this.schedule();
      });
    } else {
      this.raf = requestAnimationFrame(() => {
        this.tick();
        this.schedule();
      });
    }
  }

  tick() {
    const v = this.video;
    if (this.busy || !v.videoWidth || v.readyState < 2) return;
    const now = performance.now();
    // Yedek döngüde kamera hızını aşmamak için
    if (!v.requestVideoFrameCallback && now - this.lastTick < 30) return;
    this.lastTick = now;
    // MediaPipe zaman damgasının sürekli artmasını ister
    const ts = Math.max(now, this.lastTs + 1);
    this.lastTs = ts;
    this.busy = true;
    let settled = false;
    const done = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      this.busy = false;
      if (!this.running || !res) return;
      const ms = performance.now() - now;
      this.stats.frames++;
      this.stats.ms += ms;
      this.stats.worst = Math.max(this.stats.worst, ms);
      if (typeof res.light === 'number') {
        this.light = res.light;
        this.gain = res.gain || 1;
      }
      if (this.kind === 'hand') this.processHands(res.people || [], performance.now());
      else this.process(res.people || [], performance.now());
    };
    // Sonuç gelmezse kare bırakılır, döngü kilitlenmez
    const guard = setTimeout(() => done(null), 1500);
    const split = this.split();
    this.sent = split;
    this.engine.detect(v, ts, split).then(done, (err) => {
      console.error(err);
      done(null);
    });
  }

  // Yan yana duran iki kişi tek karede aranınca model ikisini karıştırıp ortada tek bir kişi sanar.
  // Bu yüzden kare, iki omuz arasındaki boşluktan ikiye bölünür ve her parçada bir kişi aranır.
  // Çizgi kameranın aynasız koordinatındadır; örtüşme aradaki boşluk kadar büyür.
  // İkisi birden görünmüyorsa çizgi birkaç olası yeri sırayla dener.
  split() {
    // Ellerde kadraj ortadan bölünür: herkes ellerini kendi yarısında tutar, ortadaki çizgi ekranda görünür
    if (this.kind === 'hand') return { s: 0.5, ov: 0.08 };
    const now = performance.now();
    const L = this.lastPos[this._left];
    const R = this.lastPos[1 - this._left];
    const both = L && R && now - this.lastSeen[this._left] < 900 && now - this.lastSeen[1 - this._left] < 900;
    if (both && L.x1 < R.x0 + 0.04) {
      const gap = R.x0 - L.x1;
      const target = { s: 1 - (L.x1 + R.x0) / 2, ov: Math.min(0.12, Math.max(0.035, 0.03 + gap * 0.35)) };
      // Çizgi yavaş kayar; parça aniden yer değiştirirse model takip ettiği kişiyi kaybeder
      this.cut = this.cut ? { s: this.cut.s + 0.25 * (target.s - this.cut.s), ov: this.cut.ov + 0.25 * (target.ov - this.cut.ov) } : target;
      return this.cut;
    }
    if (this.cut && now - Math.min(this.lastSeen[0], this.lastSeen[1]) < 1600) return this.cut;
    const tries = [0.5, 0.44, 0.56, 0.38, 0.62];
    this.searchK++;
    return { s: tries[Math.floor(this.searchK / 6) % tries.length], ov: OVERLAP };
  }

  process(raw, now) {
    const v = this.video;
    const ar = v.videoWidth / v.videoHeight;
    let dets = raw.map((d) => {
      const lm = d.lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z, v: p.v }));
      let cx;
      let cy;
      if (this.kind === 'pose') {
        const t = [lm[0], lm[11], lm[12]];
        cx = (t[0].x + t[1].x + t[2].x) / 3;
        cy = (t[0].y + t[1].y + t[2].y) / 3;
      } else {
        const b = boxOf(lm);
        cx = b.cx;
        cy = b.cy;
      }
      const score = d.lm.reduce((s, q) => s + q.v, 0) / d.lm.length;
      return { lm, blend: d.blend, cx, cy, score, part: d.part };
    });
    // Parçasının kendi yarısında durmayan bulgu öbür kişiye aittir, atılır
    const sp = this.sent;
    if (sp) dets = dets.filter((d) => d.part === undefined || (d.part === 0 ? 1 - d.cx < sp.s + sp.ov * 0.5 : 1 - d.cx > sp.s - sp.ov * 0.5));
    // Ortada duran tek kişi iki parçada da bulunur: aynı kişiyse görünürlüğü yüksek olan kalır
    if (dets.length === 2 && Math.abs(dets[0].cx - dets[1].cx) < 0.07 && Math.abs(dets[0].cy - dets[1].cy) < 0.08) {
      dets = [dets[0].score >= dets[1].score ? dets[0] : dets[1]];
    }
    const slots = this.assign(dets, now);
    const out = [null, null];
    for (let i = 0; i < 2; i++) {
      const d = slots[i];
      if (!d) {
        if (now - this.lastSeen[i] > 450) {
          this.filters[i] = null;
          this.blends[i] = null;
          this.vis[i] = null;
        }
        // Kısa kayıpta son hal tutulur
        const prev = this.players[i];
        if (prev && now - this.lastSeen[i] < HOLD_MS) out[i] = prev.held ? prev : { ...prev, held: true };
        continue;
      }
      const n = d.lm.length;
      if (!this.filters[i]) {
        const [mc, beta] = SMOOTH[this.kind];
        this.filters[i] = smoother(n * 2, mc, beta);
        this.vis[i] = new Float32Array(n).fill(-1);
      }
      const flat = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        flat[k * 2] = d.lm[k].x;
        flat[k * 2 + 1] = d.lm[k].y;
      }
      const s = this.filters[i](flat, now);
      const vis = this.vis[i];
      const lm = new Array(n);
      for (let k = 0; k < n; k++) {
        vis[k] = vis[k] < 0 ? d.lm[k].v : vis[k] + 0.5 * (d.lm[k].v - vis[k]);
        lm[k] = { x: s[k * 2], y: s[k * 2 + 1], z: d.lm[k].z, v: vis[k] };
      }
      const p = { lm, ar };
      if (this.kind === 'face') {
        // İfadeler hafif süzülür: göz kırpma gibi kısa hareketler kaybolmasın
        const prev = this.blends[i];
        const blend = {};
        for (const key in d.blend) blend[key] = prev && prev[key] !== undefined ? prev[key] + 0.65 * (d.blend[key] - prev[key]) : d.blend[key];
        this.blends[i] = blend;
        p.blend = blend;
        p.box = boxOf(lm);
        p.cx = p.box.cx;
      } else {
        const seen = lm.filter((q) => q.v > 0.4 && q.x > -0.05 && q.x < 1.05 && q.y > -0.05 && q.y < 1.05);
        p.box = boxOf(seen.length > 4 ? seen : lm);
        p.cx = (lm[0].x + lm[11].x + lm[12].x) / 3;
      }
      out[i] = p;
      this.lastSeen[i] = now;
      // Omuzların ekrandaki en sol ve en sağ noktası: bölme çizgisi aradaki boşluğa konur
      const sh = this.kind === 'pose' ? [d.lm[11].x, d.lm[12].x] : [d.lm[234].x, d.lm[454].x];
      this.lastPos[i] = { cx: d.cx, cy: d.cy, x0: Math.min(...sh), x1: Math.max(...sh) };
    }
    this.players = out;
    this.onFrame(out, now);
  }

  // Eller: her el kadrajın hangi yarısındaysa o yarıdaki oyuncunundur. Aynı el iki parçada bulunursa biri atılır.
  // Her oyuncunun en fazla iki eli; eller bir önceki karedeki en yakın eliyle eşlenip süzülür
  processHands(raw, now) {
    const v = this.video;
    const ar = v.videoWidth / v.videoHeight;
    let hands = raw.map((d) => {
      const lm = d.lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z, v: 1 }));
      const b = boxOf(lm);
      return { lm, cx: b.cx, cy: b.cy, size: Math.hypot((lm[0].x - lm[9].x) * ar, lm[0].y - lm[9].y), score: d.score || 1 };
    });
    hands.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const h of hands) {
      if (!kept.some((k) => Math.hypot(k.lm[0].x - h.lm[0].x, k.lm[0].y - h.lm[0].y) < 0.05 && Math.hypot(k.cx - h.cx, k.cy - h.cy) < 0.06)) kept.push(h);
    }
    hands = kept;
    if (!this.handF) this.handF = [[], []];
    const out = [null, null];
    for (let i = 0; i < 2; i++) {
      const left = i === this._left;
      const mine = hands.filter((h) => (left ? h.cx < 0.5 : h.cx >= 0.5)).slice(0, 2);
      const prevF = this.handF[i].filter((f) => now - f.t < 450);
      const nextF = [];
      const list = mine.map((h) => {
        let best = null;
        let bd = 0.2;
        for (const f of prevF) {
          if (nextF.includes(f)) continue;
          const dd = Math.hypot(f.cx - h.cx, f.cy - h.cy);
          if (dd < bd) {
            bd = dd;
            best = f;
          }
        }
        if (!best) {
          const [mc, beta] = SMOOTH.hand;
          best = { f: smoother(42, mc, beta) };
        }
        const flat = new Float32Array(42);
        for (let k = 0; k < 21; k++) {
          flat[k * 2] = h.lm[k].x;
          flat[k * 2 + 1] = h.lm[k].y;
        }
        const s = best.f(flat, now);
        const lm = h.lm.map((q, k) => ({ x: s[k * 2], y: s[k * 2 + 1], z: q.z, v: 1 }));
        best.cx = h.cx;
        best.cy = h.cy;
        best.t = now;
        nextF.push(best);
        const b = boxOf(lm);
        return { lm, box: b, cx: b.cx, cy: b.cy, size: h.size };
      });
      // Bu karede bulunmayan el kısa süre tutulur
      for (const f of prevF) if (!nextF.includes(f) && now - f.t < 200) nextF.push(f);
      this.handF[i] = nextF;
      if (list.length) {
        list.sort((a, b) => a.cx - b.cx);
        const all = list.flatMap((h) => h.lm);
        const box = boxOf(all);
        out[i] = { hands: list, lm: list[0].lm, box, cx: box.cx, ar };
        this.lastSeen[i] = now;
      } else {
        const prev = this.players[i];
        if (prev && now - this.lastSeen[i] < HOLD_MS) out[i] = prev.held ? prev : { ...prev, held: true };
      }
    }
    this.players = out;
    this.onFrame(out, now);
  }

  // İki kişi görünüyorsa soldaki solda; biri görünmüyorsa kalan kişi son bilinen yerine en yakın olana gider.
  // Böylece biri kadrajdan çıkınca öbürü onun yerine geçmez.
  assign(dets, now) {
    const slots = [null, null];
    if (!dets.length) return slots;
    const L = this._left;
    const R = 1 - L;
    if (dets.length >= 2) {
      const s = dets.slice().sort((a, b) => a.cx - b.cx);
      slots[L] = s[0];
      slots[R] = s[s.length - 1];
      return slots;
    }
    const d = dets[0];
    const recent = [0, 1].filter((i) => this.lastPos[i] && now - this.lastSeen[i] < 2500);
    let slot;
    if (recent.length === 2) {
      slot = Math.abs(d.cx - this.lastPos[0].cx) <= Math.abs(d.cx - this.lastPos[1].cx) ? 0 : 1;
    } else if (recent.length === 1) {
      const i = recent[0];
      const near = Math.abs(d.cx - this.lastPos[i].cx) < 0.18;
      slot = near ? i : 1 - i;
      // Kalan kişi yanlış tarafta duruyorsa yine yan bilgisi kazanır
      if (!near && ((slot === L && d.cx > this.lastPos[i].cx) || (slot === R && d.cx < this.lastPos[i].cx))) slot = i;
    } else {
      slot = d.cx < 0.5 ? L : R;
    }
    slots[slot] = d;
    return slots;
  }
}
