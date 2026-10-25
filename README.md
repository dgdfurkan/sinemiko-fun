# Sinemiko Fun

Furkan ile Sinem'in oyun gecesi için hazırlanmış, tarayıcıda çalışan çift oyunları. Tam ekranda oynamak için tasarlandı.

## Oyunlar

| Oyun | Nasıl Oynanır | Gerekenler |
| --- | --- | --- |
| Poz Ver! | Ekranda çıkan pozu ilk yapıp tutan kazanır. Sinemiko Diyor Ki modunda tuzak kartlar da gelir. | Kamera |
| Baloncuk Avı | Aşağıdan yükselen baloncukları ellerinle patlatırsın. Altın +3, bomba -3. | Kamera |
| Kopya Kedi | Biri garip bir poz uydurup donar, öbürü hayalet iskelete bakıp aynısını yapmaya çalışır. | Kamera |
| Surat Yap | Kartta çıkan ifadeyi (şok, öpücük, göz kırpma...) ilk yapan kazanır. Sonunda Surat Albümü indirilebilir. | Kamera |
| Gülme Yasak | Biri taş surat olur, öbürü güldürmeye çalışır. Kamera gülümsemeyi yakalar. | Kamera |
| Bakışma Düellosu | İlk göz kırpan kaybeder. İstenirse gülmek de yasak. | Kamera |
| Reverse Play | Biri kelimeyi söyler, kayıt ters çevrilir. Diğeri ters kaydı taklit eder, taklit tekrar ters çevrilir ve kelime tahmin edilir. | Mikrofon |
| Fısıltı Challenge | Kulaklıkta yüksek müzik çalar, cümle dudaklardan okunur. | Kulaklık |
| Kim Daha? | Soru çıkar, üçe kadar sayılır, ikiniz de aynı anda birini gösterirsiniz. | |
| Bu mu O mu? | İkiniz aynı klavyede gizlice seçersiniz, cevaplar aynı anda açılır. | Klavye |
| Dalga Boyu | Biri ipucu verir, diğeri kapalı kadranda ibreyi hedefe çevirir. | |
| Emoji Avı | Emojiler bir film, şarkı ya da deyim saklar. İlk basan cevaplar. | Klavye |
| Doğruluk mu Cesaret mi? | Çark döner, çıkan görev yapılır. | |
| Bomba! | Kategoriden bir şey söyleyip bombayı karşıya atarsın. Gizli fitil kimde biterse o kaybeder. | Klavye |
| Hızlı El | Daire yeşile dönünce ilk basan kazanır, erken basan turu kaybeder. Tuzaklı mod var. | Klavye |
| Çiz Bakalım | Gizli kelimeyi çizersin, partnerin tahmin eder. Çizimler galeride birikir, indirilebilir. | |
| Anlat Bakalım | Yasak kelimeleri kullanmadan anlatırsın. Süre bitene kadar kaç kart bilinirse. | |
| Ne Kadar Tanıyorsun? | Biri cevabını gizlice seçer, diğeri tahmin eder. | |
| Aynı Kafa | Aynı anda kelime söylenir, iki kelimeyi birleştiren ortak kelimede buluşana kadar devam edilir. | |
| Sincap Sesi | Kayıt önce süper hızlı sincap sesiyle çalar, bilinemezse sincap, dev ve normal sese doğru kolaylaşır. | Mikrofon |
| Mırıldan Bakalım | Şarkı sözsüz mırıldanılır, partner tahmin eder. Hatırlamazsan sağdaki düğmelerle 30 saniyelik kesiti dinler, sözlere bakarsın. Zor modda mırıltı tersten çalar. | Mikrofon |
| Tekerleme Düellosu | Aynı tekerlemeyi ikiniz de söylersiniz, oyun süreyi ölçer, hatasız en hızlı kazanır. | Mikrofon |
| Yankı Tuzağı | Kulaklıkta kendi sesini gecikmeli duyarken metni takılmadan okumaya çalışırsın. | Mikrofon, kulaklık |
| Balon Şişir | Tek nefeste "aaa" dedikçe balon şişer, en uzun tutan kazanır. | Mikrofon |

## Kısayollar

- `F` tam ekran
- `M` müziği aç ya da kapat
- `Enter` sahnedeki ana düğme
- `Boşluk` Reverse Play'de kaydı başlatır ve bitirir

## Yerelde Çalıştırma

Derleme adımı yok. Mikrofon ve kamera yalnızca güvenli bağlantıda açıldığı için dosyayı doğrudan açmak yerine yerel bir sunucu kullan:

```bash
python3 -m http.server 5177
```

Sonra tarayıcıda `http://localhost:5177` adresini aç.

## Notlar

- Müzik ve ses efektleri Web Audio ile anında üretilir, ses dosyası yoktur.
- Kayıtlar yalnızca tarayıcıda kalır, hiçbir sunucuya gönderilmez. Reverse Play'de turu WAV olarak indirebilirsin.
- Kamera oyunları yüz ve vücut takibi için MediaPipe kullanır. Model ilk açılışta indirilir, görüntü tarayıcıda işlenir ve hiçbir yere gönderilmez. Kamera yalnızca oyun ekranı açıkken çalışır.
- Kamera oyunlarında oyuncular solda ve sağda durarak ayırt edilir.
- Kamera oyunlarının sunucu sesi Gemini TTS ile önceden seslendirildi (`audio/voice/`). Metinler ve sahne tarifi `tools/voice-lines.json` içinde; yeniden üretmek için `python3 tools/seslendir.py`. Ayarlar'dan Sesli Sunucu kapatılabilir.
- Mırıldan Bakalım'daki kesitler Apple'ın resmi 30 saniyelik önizlemelerinden, sözler LRCLIB'den (yoksa lyrics.ovh) oyun sırasında çekilir; depoda şarkı ya da söz saklanmaz.
- Mikrofon yalnızca kayıt sırasında açık kalır. Bluetooth kulaklıklar böylece kayıt dinlerken kaliteli moda döner.
- İsimler, ses ayarları ve patlatılan baloncuk sayısı tarayıcıda saklanır.
