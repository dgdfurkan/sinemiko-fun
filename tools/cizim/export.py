import json, math, numpy as np
from lib import *

def rdp(pts, eps):
    pts = np.asarray(pts)
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab) or 1e-9
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(d.argmax())
    if d[i] > eps:
        return np.concatenate([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.array([a, b])
CX, CY, R = 1065, 880, 470
FACE_PARTS = {'lid', 'pupil', 'brow', 'nose', 'mouth', 'lipLow', 'lidlow', 'dimple', 'stubble', 'beardL', 'beardR'}
S = []
# Sinem'in burnu ve ağzı ile ikisinin burun, ağız ve alt dudak çizgileri elle çizildi (hand.py); yüz ağından gelenler atılır
HAND = {'nose', 'nostrilL', 'nostrilR', 'noseside', 'mouth', 'lipLow'}
for f in ('auto.json', 'features.json', 'hand.json'):
    S += [s for s in json.load(open(f))['strokes'] if not (f == 'features.json' and s['part'] in HAND)]
fc = [np.mean([p[:2] for p in FACES[i]], 0) for i in range(2)]
out = []
for s in S:
    p = np.array(s['pts'], np.float64)
    if not s['dot']:
        p = resample(p, 1.0)
        p = rdp(p, 0.35) if len(p) > 2 else p
        closed = s['closed'] or (len(p) > 10 and math.dist(p[0], p[-1]) < 4)
    else:
        closed = False
    who = s['who']
    if who != 'bg' and s['part'].startswith('edge'):
        m = p.mean(0); who = 'sinem' if math.dist(m, fc[0]) < math.dist(m, fc[1]) else 'furkan'
    q = (p - [CX, CY]) / R
    out.append({'w': who[0], 'p': s['part'], 'l': s['level'], 'c': int(closed), 'd': int(s['dot']), 'f': int(s['part'] in FACE_PARTS),
                'pts': [round(v, 4) for xy in q for v in xy]})
tot = sum(arclen(np.array(o['pts']).reshape(-1, 2)) for o in out)
print(len(out), 'strokes; length in radii', round(tot, 2), '; level1', round(sum(arclen(np.array(o['pts']).reshape(-1, 2)) for o in out if o['l'] == 1), 2))
json.dump({'name': 'biz', 'strokes': out}, open('biz.json', 'w'), separators=(',', ':'))
