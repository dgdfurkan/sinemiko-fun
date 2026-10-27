# Döndür Çiz portresi

Fotoğraftan, şablona uygun tek kalınlıkta çizgi portre çıkarır ve `js/spin/biz.js` dosyasını yazar.
Fotoğraf, yüz noktaları ve maskeler `work/` içinde kalır; repoya yalnızca son çizgiler girer. Fotoğraf hiçbir servise gönderilmez, her şey bu bilgisayarda çalışır.

1. `python3 -m venv .venv && .venv/bin/pip install mediapipe opencv-python-headless numpy`
2. `work/models/` içine MediaPipe `face_landmarker.task` ve `selfie_multiclass_256x256.tflite`
3. `cd work`, fotoğrafı `photo.jpg` olarak koy, `MODELS=models ../.venv/bin/python ../analyze.py`
4. Sırayla `art.py` (bölge sınırları), `features.py` (göz, kaş), `chains.py` (gözlük, yaka gibi kenar zincirleri), `hand.py` (elle yerleştirilen burun, ağız, bukle, kolye, sakal), `export.py`
5. `render.py auto.json,features.json,hand.json r.png photo` ile fotoğrafın üstünde kontrol et
6. `node ../seeds.mjs`: her kâğıt boyutu ve detay için tek diske sığan tohumu bulur, `js/spin/biz.js` dosyasını yazar

`hand.py` ve `chains.py` içindeki koordinatlar bu fotoğrafa özeldir; yeni fotoğrafta `grid.py` ile ızgaralı yakın çekim alıp yeniden yerleştirilir.
