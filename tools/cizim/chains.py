import json, sys, numpy as np, cv2
from lib import *
im = cv2.imread('photo.jpg'); gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
ROIS = {
  'glasses': (870, 610, 1120, 720, 30, 90, 25),
  'collar':  (1080, 940, 1430, 1120, 30, 90, 30),
  'sun':     (1090, 1150, 1200, 1360, 30, 90, 25),
  'ear':     (1300, 720, 1360, 860, 20, 60, 15),
  'split':   (1040, 950, 1130, 1350, 15, 50, 40),
  'fhair':   (1080, 500, 1360, 720, 40, 120, 30),
  'shair':   (690, 610, 1150, 1100, 40, 120, 40),
  'neck':    (800, 990, 1020, 1160, 25, 80, 15),
}
out = {}
for name, (x0, y0, x1, y1, lo, hi, minlen) in ROIS.items():
    e = canny(gray[y0:y1, x0:x1], lo, hi)
    paths = trace_edges(e)
    res = []
    for p in paths:
        p = p + [x0, y0]
        if arclen(p) < minlen: continue
        p = smooth(resample(p, 2.0), 2.0)
        res.append(p.round(1).tolist())
    out[name] = res
    # önizleme: numaralı zincirler
    s = 3 if (x1 - x0) < 300 else 2
    base = cv2.resize(im[y0:y1, x0:x1], None, fx=s, fy=s)
    base = cv2.addWeighted(base, .45, np.full_like(base, 255), .55, 0)
    rng = np.random.default_rng(1)
    for i, p in enumerate(res):
        c = tuple(int(v) for v in rng.integers(0, 200, 3))
        q = ((np.array(p) - [x0, y0]) * s).astype(np.int32)
        cv2.polylines(base, [q], False, c, 2, cv2.LINE_AA)
        cv2.putText(base, str(i), tuple(q[len(q) // 2] + [3, -3]), cv2.FONT_HERSHEY_SIMPLEX, .45, c, 1)
    cv2.imwrite(f'c_{name}.png', base)
    print(name, len(res))
json.dump(out, open('chains.json', 'w'))
