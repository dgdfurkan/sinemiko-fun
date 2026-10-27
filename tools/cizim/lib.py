import json, math, numpy as np, cv2
d = json.load(open('landmarks.json'))
W, H = d['W'], d['H']
FACES = d['faces']  # 0 Sinem (solda), 1 Furkan
NAMES = ['bg', 'hair', 'body', 'face', 'clothes', 'other']

def labels():
    conf = np.stack([cv2.GaussianBlur(cv2.imread(f'm_{n}.png', 0).astype(np.float32), (0, 0), 4) for n in NAMES])
    lab = conf.argmax(0).astype(np.uint8)
    for k in range(1, 6):
        m = (lab == k).astype(np.uint8)
        n, cc, st, _ = cv2.connectedComponentsWithStats(m, 8)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < 3000:
                lab[cc == i] = 0
    return lab

def resample(pts, step=2.0):
    a = np.asarray(pts, np.float64)
    if len(a) < 2: return a
    seg = np.hypot(*np.diff(a, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < step: return a[[0, -1]]
    t = np.linspace(0, s[-1], max(2, int(s[-1] / step) + 1))
    return np.stack([np.interp(t, s, a[:, 0]), np.interp(t, s, a[:, 1])], 1)

def smooth(pts, sigma, closed=False):
    a = np.asarray(pts, np.float64)
    if len(a) < 4 or sigma <= 0: return a
    sigma = min(sigma, (len(a) - 1) / 6.5)
    if sigma < .5: return a
    k = int(sigma * 3) * 2 + 1
    g = cv2.getGaussianKernel(k, sigma).ravel()
    if closed:
        ext = np.concatenate([a[-k:], a, a[:k]])
    else:
        # uçları yansıtarak uzat: uçlar yerinde kalır, kıvrım kaybolmaz
        head = 2 * a[0] - a[1:k + 1][::-1]
        tail = 2 * a[-1] - a[-k - 1:-1][::-1]
        ext = np.concatenate([head, a, tail])
    out = np.stack([np.convolve(ext[:, i], g, 'same') for i in range(2)], 1)[k:-k]
    return out

def catmull(pts, n=8, closed=False):
    p = np.asarray(pts, np.float64)
    if len(p) < 3: return resample(p, 1.5)
    if closed: P = np.concatenate([p[-1:], p, p[:2]])
    else: P = np.concatenate([2 * p[:1] - p[1:2], p, 2 * p[-1:] - p[-2:-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2] if not closed else P[1])
    return np.array(out)

def trace_edges(e):
    """İnce kenar piksellerini sıralı yollara çevirir."""
    ys, xs = np.nonzero(e)
    pix = set(zip(xs.tolist(), ys.tolist()))
    nb = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    def neigh(p):
        return [(p[0] + dx, p[1] + dy) for dx, dy in nb if (p[0] + dx, p[1] + dy) in pix]
    paths, seen = [], set()
    ends = [p for p in pix if len(neigh(p)) == 1]
    for start in ends + list(pix):
        if start in seen: continue
        path = [start]; seen.add(start); cur = start
        while True:
            nx = [q for q in neigh(cur) if q not in seen]
            if not nx: break
            # düz devam edeni seç
            if len(path) > 2:
                dx, dy = cur[0] - path[-3][0], cur[1] - path[-3][1]
                nx.sort(key=lambda q: -((q[0] - cur[0]) * dx + (q[1] - cur[1]) * dy))
            cur = nx[0]; seen.add(cur); path.append(cur)
        paths.append(np.array(path, np.float64))
    return paths

def canny(gray, lo, hi, d=9, sc=40):
    g = cv2.bilateralFilter(gray, d, sc, d)
    return cv2.Canny(g, lo, hi)

def arclen(p):
    p = np.asarray(p); return float(np.hypot(*np.diff(p, axis=0).T).sum()) if len(p) > 1 else 0.0
