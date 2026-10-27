// Kesik konturları: lazer ya da kesim makinesi kesiğin kalınlığını değil dış çizgisini keser.
// Her kesik, merkez çizgisinden yarım kesik genişliği uzaklıktaki eğri olarak çıkarılır (yürüyen kareler).

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const n = Math.hypot(dx, dy) || 1e-9;
    let worst = -1;
    let wd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dx * (pts[i][1] - ay) - dy * (pts[i][0] - ax)) / n;
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function slotOutline(pts, width, res = 0.05, tries = 3) {
  const r = width / 2;
  if (pts.length === 1) {
    const [cx, cy] = pts[0];
    return Array.from({ length: 40 }, (_, i) => [cx + r * Math.cos((i / 40) * Math.PI * 2), cy + r * Math.sin((i / 40) * Math.PI * 2)]);
  }
  const P = resample(pts, res * 3);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of P) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const pad = r + res * 3;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const W = Math.ceil((x1 - x0) / res) + 1;
  const H = Math.ceil((y1 - y0) / res) + 1;
  // Alan: r - en yakın merkez noktasına uzaklık; sıfır çizgisi kesiğin kenarı
  const f = new Float32Array(W * H).fill(-r);
  const rc = Math.ceil(r / res) + 1;
  for (const [px, py] of P) {
    const cx = (px - x0) / res;
    const cy = (py - y0) / res;
    const gx0 = Math.max(0, Math.floor(cx - rc));
    const gx1 = Math.min(W - 1, Math.ceil(cx + rc));
    const gy0 = Math.max(0, Math.floor(cy - rc));
    const gy1 = Math.min(H - 1, Math.ceil(cy + rc));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const v = r - Math.hypot(gx - cx, gy - cy) * res;
        const i = gy * W + gx;
        if (v > f[i]) f[i] = v;
      }
    }
  }
  // Yürüyen kareler: kenar parçaları, sonra halkaya dizilir
  const key = (x, y) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
  const next = new Map();
  const lerp = (a, b) => a / (a - b);
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = f[y * W + x];
      const b = f[y * W + x + 1];
      const c = f[(y + 1) * W + x + 1];
      const d = f[(y + 1) * W + x];
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = [x + lerp(a, b), y];
      const Rr = [x + 1, y + lerp(b, c)];
      const B = [x + lerp(d, c), y + 1];
      const L = [x, y + lerp(a, d)];
      // İçerisi solda kalacak yönde parçalar
      const segs = {
        1: [[L, B]], 2: [[B, Rr]], 3: [[L, Rr]], 4: [[Rr, T]], 5: [[L, B], [Rr, T]], 6: [[B, T]], 7: [[L, T]],
        8: [[T, L]], 9: [[T, B]], 10: [[T, L], [B, Rr]], 11: [[T, Rr]], 12: [[Rr, L]], 13: [[Rr, B]], 14: [[B, L]],
      }[code];
      for (const [p, q] of segs) next.set(key(...p), q);
    }
  }
  let best = [];
  let closed = false;
  const seen = new Set();
  for (const [k0] of next) {
    if (seen.has(k0)) continue;
    const loop = [];
    let k = k0;
    while (k && !seen.has(k)) {
      seen.add(k);
      const q = next.get(k);
      if (!q) break;
      loop.push(q);
      k = key(...q);
    }
    if (loop.length > best.length) { best = loop; closed = k === k0; }
  }
  // Halka kapanmadıysa ızgara biraz kaydırılıp yeniden denenir
  if (!closed && tries > 1) return slotOutline(pts, width, res * 0.83, tries - 1);
  const poly = best.map(([gx, gy]) => [x0 + gx * res, y0 + gy * res]);
  // Kapalı halka iki yarıda sadeleşir: uçları aynı noktaysa sadeleştirme her şeyi siler
  let far = 0;
  for (let i = 1; i < poly.length; i++) if (Math.hypot(poly[i][0] - poly[0][0], poly[i][1] - poly[0][1]) > Math.hypot(poly[far][0] - poly[0][0], poly[far][1] - poly[0][1])) far = i;
  const a = simplify(poly.slice(0, far + 1), 0.012);
  const b = simplify(poly.slice(far).concat([poly[0]]), 0.012);
  return a.concat(b.slice(1, -1));
}
