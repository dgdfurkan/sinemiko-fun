import json, math, numpy as np
from lib import *
CX, CY, R = 1065, 880, 470
strokes = []
def add(pts, who, part, level=1, closed=False, dot=False, n=6):
    p = np.asarray(pts, np.float64)
    if not dot and len(p) >= 3: p = catmull(p, n, closed)
    strokes.append({'who': who, 'part': part, 'level': level, 'closed': closed, 'dot': dot, 'pts': p.round(1).tolist()})
def L(f, idx): return np.array([f[i][:2] for i in idx])
def mid(f, a, b, t=.5): return (1 - t) * np.array(f[a][:2]) + t * np.array(f[b][:2])
def sub(p, a, b):
    """Eğrinin a..b oranlı kısmı"""
    p = resample(p, 1.0); n = len(p)
    return p[int(a * (n - 1)):int(b * (n - 1)) + 1]

for fi, who in ((0, 'sinem'), (1, 'furkan')):
    f = FACES[fi]
    # Üst kapak: kirpik çizgisi, dış köşede hafif kalkış
    for upper, lower, iris, outer in (([33, 246, 161, 160, 159, 158, 157, 173, 133], [33, 7, 163, 144, 145, 153, 154, 155, 133], 468, 0),
                                      ([263, 466, 388, 387, 386, 385, 384, 398, 362], [263, 249, 390, 373, 374, 380, 381, 382, 362], 473, 0)):
        up = catmull(L(f, upper), 6)
        add(up, who, 'lid', 1, n=1)
        lo = catmull(L(f, lower), 6)
        add(sub(lo, .3, .85) + [0, 2], who, 'lidlow', 2, n=1)
        add([f[iris][:2]], who, 'pupil', 1, dot=True)
    # Kaş: üst ve alt sınırın orta çizgisi
    for top, bot in (([70, 63, 105, 66, 107], [46, 53, 52, 65, 55]), ([300, 293, 334, 296, 336], [276, 283, 282, 295, 285])):
        c = (L(f, top) + L(f, bot)) / 2
        add(c, who, 'brow', 1)
    # Burun: alt kavis ve gölge tarafında kısa yan çizgi
    add(L(f, [98, 97, 2, 326, 327]), who, 'nose', 1)
    add(L(f, [48, 64, 98]), who, 'nostrilL', 1)
    add(L(f, [278, 294, 327]), who, 'nostrilR', 1)
    add(L(f, [196, 174, 236, 198]), who, 'noseside', 2)
    # Ağız: dudak birleşim çizgisi ve alt dudak
    add(L(f, [61, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 291]), who, 'mouth', 1)
    add(L(f, [91, 181, 84, 17, 314, 405, 321]), who, 'lipLow', 2)
json.dump({'circle': [CX, CY, R], 'strokes': strokes}, open('features.json', 'w'))
print(len(strokes))
