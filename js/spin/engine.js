// Döndür Çiz motoru: çizimi parçalara böler, her parçaya diskte bir dönüş adımı bulur.
// Disk adım k'ya çevrilince o adımın kesikleri çizimdeki yerlerine oturur; hepsi bitince resim ortaya çıkar.
// Birimler milimetre; merkez diskin ortası, y aşağı (SVG ile aynı).

export const SIZES = {
  a4: { id: 'a4', name: 'A4', page: [210, 297], R: 97, rim: 12, slot: 2.2, gap: 1.8, label: 2.3, maxLen: 30 },
  a3: { id: 'a3', name: 'A3', page: [297, 420], R: 140, rim: 14, slot: 2.2, gap: 2.0, label: 2.6, maxLen: 38 },
};

// Sade çizimde ana hatlar, detaylıda saç bukleleri, kolye, sakal ve gözlük de var
export const LEVELS = { 1: { name: 'Sade', steps: 36 }, 2: { name: 'Detaylı', steps: 60 } };

const SAMPLE = 0.5;
const PIN = 2.2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function length(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = dist(a, b);
    let t = step - carry;
    while (t <= d) {
      out.push([a[0] + (b[0] - a[0]) * (t / d), a[1] + (b[1] - a[1]) * (t / d)]);
      t += step;
    }
    carry = d - (t - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.3) out.push(last);
  return out;
}

// Diskin dışına ya da raptiye deliğine taşan kısımları keser
function clip(pts, rMin, rMax) {
  const runs = [];
  let cur = [];
  for (const p of pts) {
    const r = Math.hypot(p[0], p[1]);
    if (r >= rMin && r <= rMax) cur.push(p);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

function turning(pts, a = 0, b = pts.length - 1) {
  let t = 0;
  const k = 4;
  for (let i = a + k; i <= b - k; i += k) {
    const u = [pts[i][0] - pts[i - k][0], pts[i][1] - pts[i - k][1]];
    const v = [pts[i + k][0] - pts[i][0], pts[i + k][1] - pts[i][1]];
    t += Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
  }
  return (t * 180) / Math.PI;
}

// Bölme noktası: ortaya yakın ve mümkünse köşede; köşede bölünen çizgi elde daha rahat çizilir
function splitIndex(pts, lo = 0.3, hi = 0.7) {
  const n = pts.length;
  let best = Math.floor(n / 2);
  let bestScore = -Infinity;
  const k = Math.max(2, Math.round(1.5 / SAMPLE));
  for (let i = Math.max(k, Math.floor(n * lo)); i <= Math.min(n - 1 - k, Math.ceil(n * hi)); i++) {
    const u = [pts[i][0] - pts[i - k][0], pts[i][1] - pts[i - k][1]];
    const v = [pts[i + k][0] - pts[i][0], pts[i + k][1] - pts[i][1]];
    const turn = Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
    const score = turn * 2 - Math.abs(i / n - 0.5);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// Parçanın kendine fazla yaklaştığı yer: kâğıtta ince dil ya da kopan ada bırakır
function selfNear(pts, near) {
  const n = pts.length;
  const skip = Math.ceil((near * 1.7) / SAMPLE);
  let worst = null;
  for (let i = 0; i < n; i += 2) {
    for (let j = i + skip; j < n; j += 2) {
      const d = dist(pts[i], pts[j]);
      if (d < near && (!worst || d < worst.d)) worst = { i, j, d };
    }
  }
  return worst;
}

function cut(pts, cfg) {
  const out = [];
  const queue = [pts];
  const near = cfg.slot + cfg.gap;
  while (queue.length) {
    const p = queue.pop();
    const L = (p.length - 1) * SAMPLE;
    if (L < 1.2) { out.push(p); continue; }
    let at = -1;
    const sn = selfNear(p, near);
    if (sn) at = Math.round((sn.i + sn.j) / 2);
    else if (L > cfg.maxLen) at = splitIndex(p);
    else if (turning(p) > 250) at = splitIndex(p, 0.35, 0.65);
    if (at <= 1 || at >= p.length - 2) { out.push(p); continue; }
    queue.push(p.slice(0, at + 1), p.slice(at));
  }
  return out;
}

export function makePieces(art, cfg) {
  const rDraw = cfg.R - cfg.rim - cfg.slot / 2 - 0.8;
  const rMin = PIN + cfg.gap + cfg.slot / 2;
  const pieces = [];
  for (const s of art.strokes) {
    if (s.l > cfg.level) continue;
    const raw = [];
    for (let i = 0; i < s.pts.length; i += 2) raw.push([s.pts[i] * rDraw, s.pts[i + 1] * rDraw]);
    const meta = { who: s.w, part: s.p, face: !!s.f };
    if (s.d) {
      const r = Math.hypot(raw[0][0], raw[0][1]);
      if (r >= rMin && r <= rDraw) pieces.push({ ...meta, dot: true, pts: [raw[0]] });
      continue;
    }
    let pts = resample(raw, SAMPLE);
    if (s.c) {
      // Kapalı şekil en az iki yaya ayrılır, yoksa ortası kâğıttan düşer
      const L = length(pts);
      const n = Math.max(2, Math.ceil(L / cfg.maxLen));
      const per = Math.ceil(pts.length / n);
      const closedPts = pts.concat([pts[0]]);
      for (let k = 0; k < n; k++) {
        const seg = closedPts.slice(k * per, Math.min(closedPts.length, (k + 1) * per + 1));
        for (const r of clip(seg, rMin, rDraw)) for (const c of cut(r, cfg)) pieces.push({ ...meta, pts: c });
      }
      continue;
    }
    for (const r of clip(pts, rMin, rDraw)) for (const c of cut(r, cfg)) pieces.push({ ...meta, pts: c });
  }
  return pieces
    .map((p) => (p.dot || length(p.pts) >= 1.2 ? p : { ...p, dot: true, pts: [p.pts[Math.floor(p.pts.length / 2)]] }))
    .filter((p) => p.dot || p.pts.length > 1);
}

/* ---------- Yerleştirme ---------- */

// Adım k'nın disk dönüşü (derece, SVG yönünde): disk saat yönünün tersine çevrilir, sayılar saat yönünde artar
export const stepAngle = (k, K) => -((k + 0.5) * 360) / K;

export function rotate(p, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function tryPack(pieces, cfg, seed, { faceFirst = false, leftovers = false } = {}) {
  const R = cfg.R;
  const cell = 0.35;
  const N = Math.ceil((2 * R) / cell) + 2;
  const forb = new Uint8Array(N * N);
  const near = new Uint8Array(N * N);
  const K = cfg.steps;
  const rand = rng(seed);
  const discOf = (reach) => {
    const out = [];
    const rr = Math.ceil(reach);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= reach * reach) out.push(dy * N + dx);
    return out;
  };
  const disc = discOf((cfg.slot + cfg.gap) / cell);
  const ring = discOf((cfg.slot + cfg.gap + 1.4) / cell);
  const idx = (p) => Math.round((p[1] + R) / cell) * N + Math.round((p[0] + R) / cell);
  const cos = [];
  const sin = [];
  for (let k = 0; k < K; k++) {
    // Kesik diskte -açı kadar döndürülmüş durur; disk +açıya çevrilince yerine oturur
    const a = (-stepAngle(k, K) * Math.PI) / 180;
    cos.push(Math.cos(a));
    sin.push(Math.sin(a));
  }
  const at = (p, k) => [p[0] * cos[k] - p[1] * sin[k], p[0] * sin[k] + p[1] * cos[k]];
  // Her kesiğin yanında adım numarası durur: numara kesiklere ve başka numaralara değmez
  const lr = cfg.label * 0.62 + 0.1;
  const slotToLabel = cfg.slot / 2 + lr + 0.3;
  const SL = new Uint8Array(N * N);
  const LS = new Uint8Array(N * N);
  const LL = new Uint8Array(N * N);
  const discSL = discOf(slotToLabel / cell);
  const discLL = discOf((2 * lr + 0.2) / cell);
  const rLab = R - cfg.rim - lr - 0.4;
  const rPin = PIN + lr + 1;
  const findLabel = (pts, k) => {
    const n = pts.length;
    const off = slotToLabel + 0.2;
    const cands = [];
    if (n === 1) {
      for (const o of [off, off + 1.4]) for (let a = 0; a < 12; a++) cands.push([pts[0][0] + Math.cos((a * Math.PI) / 6) * o, pts[0][1] + Math.sin((a * Math.PI) / 6) * o]);
    } else {
      // Önce başlangıcın yanı (çizime oradan başlanır), sonra uç, sonra boyunca
      const at6 = Math.max(1, Math.round(5 / SAMPLE));
      const order = [0, n - 1];
      for (let i = at6; i < n - 1; i += at6) order.push(i);
      for (const o of [off, off + 1.4]) {
        for (const i of order) {
          const a = pts[Math.max(0, i - 3)];
          const b = pts[Math.min(n - 1, i + 3)];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
          const p = pts[i];
          if (i === 0) cands.push([p[0] - t[0] * o, p[1] - t[1] * o]);
          if (i === n - 1) cands.push([p[0] + t[0] * o, p[1] + t[1] * o]);
          cands.push([p[0] - t[1] * o, p[1] + t[0] * o], [p[0] + t[1] * o, p[1] - t[0] * o]);
        }
      }
    }
    for (const c of cands) {
      const d = at(c, k);
      const r = Math.hypot(d[0], d[1]);
      if (r > rLab || r < rPin) continue;
      const ci = idx(d);
      if (SL[ci] || LL[ci]) continue;
      let ok = true;
      for (let i = 0; i < n && ok; i++) if (Math.hypot(c[0] - pts[i][0], c[1] - pts[i][1]) < slotToLabel) ok = false;
      if (ok) return d;
    }
    return null;
  };
  // Uygunsa parçanın komşulara ne kadar yaslandığını ve numaranın yerini döndürür; sıkı yerleşim diskte yer açar
  const fit = (pts, k) => {
    let hug = 0;
    for (let i = 0; i < pts.length; i++) {
      const c = idx(at(pts[i], k));
      if (forb[c] || LS[c]) return null;
      hug += near[c];
    }
    const label = findLabel(pts, k);
    return label ? { hug: hug / pts.length, label } : null;
  };
  const stamp = (pts, k, label) => {
    for (let i = 0; i < pts.length; i++) {
      const c = idx(at(pts[i], k));
      for (const o of disc) forb[c + o] = 1;
      for (const o of ring) near[c + o] = 1;
      for (const o of discSL) SL[c + o] = 1;
    }
    const c = idx(label);
    for (const o of discSL) LS[c + o] = 1;
    for (const o of discLL) LL[c + o] = 1;
  };
  const count = new Array(K).fill(0);
  const placed = [];
  const rest = [];
  // Önce en kalabalık halkadaki parçalar yerleşir: dönüş yarıçapı değiştirmez, sıkışan halka orasıdır
  const band = new Float64Array(Math.ceil(R / 5) + 1);
  const rOf = (p) => p.pts.reduce((s, q) => s + Math.hypot(q[0], q[1]), 0) / p.pts.length;
  for (const p of pieces) for (const q of p.pts) band[Math.floor(Math.hypot(q[0], q[1]) / 5)] += SAMPLE * (cfg.slot + cfg.gap);
  for (let b = 0; b < band.length; b++) band[b] /= Math.PI * (((b + 1) * 5) ** 2 - (b * 5) ** 2);
  const jitter = 0.02 + (seed % 7) * 0.03;
  const queue = pieces.map((p) => {
    const rMean = rOf(p);
    const L = p.dot ? cfg.slot : length(p.pts) + cfg.slot;
    const crowd = band[Math.floor(rMean / 5)] || 0;
    return { ...p, hard: L / (2 * Math.PI * Math.max(rMean, 6)) + crowd * 1.5 + rand() * jitter + (faceFirst && p.face ? 10 : 0) };
  }).sort((a, b) => b.hard - a.hard);
  let splits = 0;
  while (queue.length) {
    const p = queue.shift();
    const options = [];
    for (let k = 0; k < K; k++) {
      const f = fit(p.pts, k);
      if (f) options.push([k, f]);
    }
    if (!options.length) {
      const L = p.dot ? 0 : length(p.pts);
      if (L >= cfg.maxLen * 0.5 && splits < pieces.length) {
        const i = splitIndex(p.pts);
        queue.unshift({ ...p, pts: p.pts.slice(0, i + 1) }, { ...p, pts: p.pts.slice(i) });
        splits++;
        continue;
      }
      if (!leftovers) return { ok: false, placed, failed: p };
      rest.push(p);
      continue;
    }
    const avg = placed.length / K;
    let best = options[0];
    let bestScore = -Infinity;
    for (const o of options) {
      const [k, { hug }] = o;
      let score = hug * 2.2 - (count[k] - avg) * 0.9 + rand() * 1.2;
      // Yüz çizgileri sona kalır: resim en son kimin olduğunu söyler
      if (p.face) score += (k / K) * 4;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    stamp(p.pts, best[0], best[1].label);
    count[best[0]]++;
    placed.push({ ...p, step: best[0], label: best[1].label });
  }
  // Sığmayanlar küçük parçalara bölünüp boşluklara yerleştirilir
  const left = [];
  const squeeze = rest.slice();
  while (squeeze.length) {
    const p = squeeze.shift();
    let bestK = -1;
    let bestFit = null;
    for (let k = 0; k < K; k++) {
      const f = fit(p.pts, k);
      if (f && (!bestFit || f.hug > bestFit.hug)) { bestFit = f; bestK = k; }
    }
    if (bestK >= 0) {
      stamp(p.pts, bestK, bestFit.label);
      count[bestK]++;
      placed.push({ ...p, step: bestK, label: bestFit.label });
    } else if (!p.dot && length(p.pts) >= 3.5) {
      const i = splitIndex(p.pts);
      squeeze.unshift({ ...p, pts: p.pts.slice(0, i + 1) }, { ...p, pts: p.pts.slice(i) });
    } else left.push(p);
  }
  return { ok: !left.length, placed, rest: left, splits };
}

function finishDisk(placed, K) {
  const pieces = placed.map((p) => ({
    step: p.step,
    dot: !!p.dot,
    who: p.who,
    part: p.part,
    face: p.face,
    world: p.pts,
    disk: p.pts.map((q) => rotate(q, -stepAngle(p.step, K))),
    label: p.label,
  }));
  // Adım içinde çizim sırası soldan sağa
  pieces.sort((a, b) => a.step - b.step || a.world[0][0] - b.world[0][0]);
  pieces.forEach((p, i) => { p.id = i; });
  const steps = Array.from({ length: K }, (_, k) => ({ k, angle: stepAngle(k, K), pieces: pieces.filter((p) => p.step === k).map((p) => p.id) }));
  return { pieces, steps };
}

// Çizim tek diske sığmazsa birden çok diske bölünür. Yüzlerin olduğu disk en sona kalır.
export function buildSet(art, opts) {
  const cfg = { level: 2, steps: 36, seed: 7, ...opts };
  const pieces = makePieces(art, cfg);
  for (let attempt = 0; attempt < (opts.tries || 10); attempt++) {
    const seed = cfg.seed + attempt * 101;
    const res = tryPack(pieces, cfg, seed, { leftovers: true });
    if (res.ok) return { cfg: { ...cfg, seed }, disks: [finishDisk(res.placed, cfg.steps)], splits: res.splits };
  }
  const disks = [];
  let rest = pieces;
  for (let d = 0; rest.length && d < 4; d++) {
    let best = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = tryPack(rest, cfg, cfg.seed + d * 977 + attempt * 101, { faceFirst: d === 0, leftovers: true });
      if (!best || res.rest.length < best.rest.length) best = res;
      if (!res.rest.length) break;
    }
    disks.unshift(finishDisk(best.placed, cfg.steps));
    rest = best.rest;
  }
  return { cfg, disks, splits: 0, failed: rest.length };
}
