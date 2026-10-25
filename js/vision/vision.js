// Kamera ile yüz ve vücut takibi: MediaPipe yalnızca kamera oyunu açılınca yüklenir.
// Görüntü cihazdan çıkmaz; modeller tarayıcıda çalışır.

const VER = '0.10.14';
const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

let libPromise = null;
const taskPromises = {};

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

// kind: 'face' en fazla iki yüz ve ifade puanları, 'pose' en fazla iki kişinin iskeleti
export function getTask(kind, onProgress = () => {}) {
  const mock = window.__sinemikoVisionMock;
  if (mock) return Promise.resolve(mock(kind));
  if (!taskPromises[kind]) {
    taskPromises[kind] = (async () => {
      onProgress(0.03);
      const [{ lib, fileset }, buf] = await Promise.all([
        loadLib(),
        fetchModel(MODELS[kind], (p) => onProgress(0.05 + p * 0.85)),
      ]);
      const make = (delegate) => (kind === 'face'
        ? lib.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: buf.slice(), delegate },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        : lib.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: buf.slice(), delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }));
      let task;
      try {
        task = await make('GPU');
      } catch {
        // Ekran kartı kullanılamazsa işlemciyle devam et
        task = await make('CPU');
      }
      onProgress(1);
      return task;
    })();
    taskPromises[kind].catch(() => { delete taskPromises[kind]; });
  }
  return taskPromises[kind];
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
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
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

/* ---------- Takip döngüsü ---------- */

const mirror = (lm) => lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z, v: p.visibility ?? 1 }));

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

// Kadraj aynalı gösterilir; soldaki kişi solda görünür. leftIs: solda duran oyuncu (0 ya da 1)
export class Tracker {
  constructor({ task, kind, video, onFrame, leftIs = 0, fps = 30 }) {
    this.task = task;
    this.kind = kind;
    this.video = video;
    this.onFrame = onFrame;
    this.leftIs = leftIs;
    this.minGap = 1000 / fps;
    this.running = false;
    this.last = 0;
    this.lastTs = 0;
    this.players = [null, null];
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.step();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  step() {
    const v = this.video;
    const now = performance.now();
    if (!v.videoWidth || v.readyState < 2 || now - this.last < this.minGap) return;
    this.last = now;
    // MediaPipe zaman damgasının sürekli artmasını ister
    const ts = Math.max(now, this.lastTs + 1);
    this.lastTs = ts;
    let res;
    try {
      res = this.task.detectForVideo(v, ts);
    } catch (err) {
      console.error(err);
      return;
    }
    const people = [];
    // Normalize koordinatlarda x ve y farklı ölçekte; kurallar en boy oranıyla düzeltir
    const ar = v.videoWidth / v.videoHeight;
    if (this.kind === 'face') {
      (res.faceLandmarks || []).forEach((lm, i) => {
        const m = mirror(lm);
        const blend = {};
        const cats = res.faceBlendshapes && res.faceBlendshapes[i] ? res.faceBlendshapes[i].categories : [];
        for (const c of cats) blend[c.categoryName] = c.score;
        people.push({ lm: m, box: boxOf(m), blend, ar });
      });
    } else {
      (res.landmarks || []).forEach((lm) => {
        const m = mirror(lm);
        const torso = [m[0], m[11], m[12]];
        const seen = m.filter((p) => p.v > 0.4);
        const b = boxOf(seen.length > 4 ? seen : m);
        people.push({ lm: m, box: b, ar, cx: (torso[0].x + torso[1].x + torso[2].x) / 3 });
      });
    }
    people.forEach((p) => { if (p.cx === undefined) p.cx = p.box.cx; });
    people.sort((a, b) => a.cx - b.cx);
    const slots = [null, null];
    if (people.length >= 2) {
      slots[this.leftIs] = people[0];
      slots[1 - this.leftIs] = people[people.length - 1];
    } else if (people.length === 1) {
      const side = people[0].cx < 0.5 ? this.leftIs : 1 - this.leftIs;
      slots[side] = people[0];
    }
    this.players = slots;
    this.onFrame(slots, now);
  }
}
