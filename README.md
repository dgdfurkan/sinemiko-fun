# Sinemiko Fun

Furkan ile Sinem'in oyun gecesi için hazırlanmış, tarayıcıda çalışan çift oyunları. Tam ekranda oynamak için tasarlandı.

## Oyunlar

| Oyun | Nasıl Oynanır | Gerekenler |
| --- | --- | --- |
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

## Kısayollar

- `F` tam ekran
- `M` müziği aç ya da kapat
- `Enter` sahnedeki ana düğme
- `Boşluk` Reverse Play'de kaydı başlatır ve bitirir

## Yerelde Çalıştırma

Derleme adımı yok. Mikrofon yalnızca güvenli bağlantıda açıldığı için dosyayı doğrudan açmak yerine yerel bir sunucu kullan:

```bash
python3 -m http.server 5177
```

Sonra tarayıcıda `http://localhost:5177` adresini aç.

## Notlar

- Müzik ve ses efektleri Web Audio ile anında üretilir, ses dosyası yoktur.
- Kayıtlar yalnızca tarayıcıda kalır, hiçbir sunucuya gönderilmez. Reverse Play'de turu WAV olarak indirebilirsin.
- Mikrofon yalnızca kayıt sırasında açık kalır. Bluetooth kulaklıklar böylece kayıt dinlerken kaliteli moda döner.
- İsimler, ses ayarları ve patlatılan baloncuk sayısı tarayıcıda saklanır.
