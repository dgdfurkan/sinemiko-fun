import json, sys, cv2, numpy as np
from lib import FACES
fi = int(sys.argv[1]); x0, y0, w, h = map(int, sys.argv[2].split(',')); s = 3
im = cv2.imread('photo.jpg')[y0:y0+h, x0:x0+w]
im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
f = FACES[fi]
for i in [61, 78, 13, 14, 308, 291, 0, 17, 84, 314, 98, 97, 2, 326, 327, 64, 294, 1, 4, 5, 129, 358, 48, 278, 33, 133, 263, 362, 468, 473, 159, 386]:
    x, y = (f[i][0] - x0) * s, (f[i][1] - y0) * s
    cv2.circle(im, (int(x), int(y)), 3, (0, 255, 0), -1)
    cv2.putText(im, str(i), (int(x) + 4, int(y) - 3), cv2.FONT_HERSHEY_SIMPLEX, .38, (0, 0, 255), 1)
cv2.imwrite(f'lm{fi}.jpg', im)
