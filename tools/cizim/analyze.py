import json, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision as V
import os
M = os.environ.get('MODELS', 'models') + '/'
img = mp.Image.create_from_file('photo.jpg')
H, W = img.height, img.width
fl = V.FaceLandmarker.create_from_options(V.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=M+'face_landmarker.task'), num_faces=2))
r = fl.detect(img)
faces = [[(p.x*W, p.y*H, p.z*W) for p in f] for f in r.face_landmarks]
faces.sort(key=lambda f: f[1][0])
print('faces', len(faces), [round(f[1][0]) for f in faces])
seg = V.ImageSegmenter.create_from_options(V.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path=M+'multiclass.tflite'), output_category_mask=True, output_confidence_masks=True))
s = seg.segment(img)
cm = s.category_mask.numpy_view()
print('cats', np.unique(cm))
names = ['bg','hair','body','face','clothes','other']
for i, n in enumerate(names):
    conf = s.confidence_masks[i].numpy_view()
    cv2.imwrite(f'm_{n}.png', (np.clip(conf,0,1)*255).astype(np.uint8))
json.dump({'W': W, 'H': H, 'faces': faces}, open('landmarks.json','w'))
