import sys, cv2
x0, y0, w, h, s = map(int, sys.argv[1:6]); out = sys.argv[6]; step = int(sys.argv[7]) if len(sys.argv) > 7 else 20
im = cv2.imread('photo.jpg')[y0:y0+h, x0:x0+w]
im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
for x in range((x0 // step + 1) * step, x0 + w, step):
    X = (x - x0) * s; big = x % (step * 5) == 0
    cv2.line(im, (X, 0), (X, im.shape[0]), (0, 255, 255) if big else (0, 200, 0), 1)
    if big: cv2.putText(im, str(x), (X + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1)
for y in range((y0 // step + 1) * step, y0 + h, step):
    Y = (y - y0) * s; big = y % (step * 5) == 0
    cv2.line(im, (0, Y), (im.shape[1], Y), (0, 255, 255) if big else (0, 200, 0), 1)
    if big: cv2.putText(im, str(y), (2, Y - 3), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1)
cv2.imwrite(out, im)
