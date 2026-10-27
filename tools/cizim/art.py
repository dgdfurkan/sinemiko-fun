import json, math, sys, numpy as np, cv2
from lib import *

CX, CY, R = 1065, 880, 470
lab = labels()
strokes = []
def add(pts, who, part, level=1, closed=False, sigma=0, dot=False):
    p = np.asarray(pts, np.float64)
    if sigma: p = smooth(resample(p, 2.0), sigma, closed)
    strokes.append({'who': who, 'part': part, 'level': level, 'closed': closed, 'dot': dot, 'pts': p.round(1).tolist()})

def who_at(x, y):
    return 'sinem' if x < 1085 else 'furkan'

# ---------- 1. Bölge sınırları ----------
PRI = {3: 5, 1: 4, 2: 3, 4: 2, 5: 6}
PAIRS = {(1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (3, 1), (3, 2), (2, 4), (1, 4), (1, 2), (5, 4), (5, 2), (5, 1), (5, 3), (3, 4)}
SIG = {1: 2.2, 2: 5, 3: 3.5, 4: 6, 5: 5}
def olabel(p, nrm):
    for dd in (6, 10, 14):
        x, y = int(round(p[0] + nrm[0] * dd)), int(round(p[1] + nrm[1] * dd))
        if not (0 <= x < W and 0 <= y < H): return -1
        if lab[y, x] != lab[int(p[1]), int(p[0])] or dd == 14: return int(lab[y, x])
    return 0
for k in range(1, 6):
    m = (lab == k).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        c = c[:, 0, :].astype(np.float64)
        if len(c) < 80: continue
        sm = smooth(resample(np.vstack([c, c[:1]]), 2.0), SIG[k], closed=True)
        n = len(sm)
        keep = []
        for i in range(n):
            t = sm[(i + 2) % n] - sm[(i - 2) % n]
            nrm = np.array([t[1], -t[0]]) / (np.hypot(*t) or 1)
            q = sm[i] + nrm * 4
            if 0 <= int(q[1]) < H and 0 <= int(q[0]) < W and m[int(q[1]), int(q[0])]: nrm = -nrm
            o = olabel(sm[i], nrm)
            edge = sm[i][0] < 6 or sm[i][1] < 6 or sm[i][0] > W - 7 or sm[i][1] > H - 7
            ok = (not edge) and o >= 0 and (k, o) in PAIRS and (o == 0 or PRI[k] > PRI.get(o, 0)) and math.dist(sm[i], (CX, CY)) < R + 30
            keep.append(ok)
        # dairesel diziyi tutulmayan bir noktadan başlat
        if all(keep): runs = [sm]
        else:
            s0 = keep.index(False)
            order = list(range(s0, n)) + list(range(0, s0))
            runs, run = [], []
            for i in order:
                if keep[i]: run.append(sm[i])
                elif run: runs.append(np.array(run)); run = []
            if run: runs.append(np.array(run))
        for r in runs:
            if arclen(r) > 30:
                add(r, who_at(*r[len(r) // 2]), f'edge{k}', 1)

json.dump({'circle': [CX, CY, R], 'strokes': strokes}, open('auto.json', 'w'))
print('auto strokes', len(strokes), round(sum(arclen(s['pts']) for s in strokes)))
