import json, sys, numpy as np, cv2
files = sys.argv[1].split(','); out = sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'plain'
crop = list(map(int, sys.argv[4].split(','))) if len(sys.argv) > 4 else None
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
S = []
for f in files:
    j = json.load(open(f)); S += j['strokes']; CX, CY, R = j['circle']
x0, y0, x1, y1 = crop or (CX - R, CY - R, CX + R, CY + R)
im = cv2.imread('photo.jpg')
pad = cv2.copyMakeBorder(im, 600, 600, 600, 600, cv2.BORDER_CONSTANT, value=(255, 255, 255))
base = pad[y0 + 600:y1 + 600, x0 + 600:x1 + 600].copy()
if mode == 'photo': base = cv2.addWeighted(base, .45, np.full_like(base, 255), .55, 0)
else: base[:] = 255
base = cv2.resize(base, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
COL = {'sinem': (120, 40, 200), 'furkan': (160, 70, 20), 'bg': (60, 140, 60)}
for s in S:
    p = ((np.array(s['pts']) - [x0, y0]) * scale)
    c = COL.get(s['who'], (40, 30, 50)) if mode == 'photo' else (40, 30, 50)
    if s.get('dot'):
        cv2.circle(base, tuple(np.round(p[0]).astype(int)), max(2, int(3 * scale)), c, -1, cv2.LINE_AA)
    else:
        cv2.polylines(base, [np.round(p * 4).astype(np.int32)], s['closed'], c, max(1, int(round(2.2 * scale))), cv2.LINE_AA, shift=2)
cv2.circle(base, (int((CX - x0) * scale), int((CY - y0) * scale)), int(R * scale), (210, 170, 230), 1, cv2.LINE_AA)
cv2.imwrite(out, base)
