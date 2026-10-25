// Sesli oyunların içerikleri: mırıldanılacak şarkılar, tekerlemeler, yankı cümleleri

// Mırıldan Bakalım: [şarkı, ipucu, iTunes parça no (30 sn kesit), LRCLIB söz no]
// Söz no 0 ise söz bulunamadı, -1 ise parça sözsüz
export const HUM_CATS = [
  {
    id: 'tr',
    name: 'Türkçe Şarkılar',
    items: [
      ['Şımarık', 'Tarkan', 499332705, 36925554], ['Kuzu Kuzu', 'Tarkan', 499334149, 37121035], ['Dudu', 'Tarkan', 696699513, 37120776], ['Kış Güneşi', 'Tarkan', 499332123, 36943367], ['Hepsi Senin mi?', 'Tarkan', 499332030, 34659662],
      ['Gülümse', 'Sezen Aksu', 1834675504, 35893693], ['Hadi Bakalım', 'Sezen Aksu', 1834675496, 34328687], ['Firuze', 'Sezen Aksu', 1834674045, 37167114], ['Domates Biber Patlıcan', 'Barış Manço', 585138560, 0],
      ['Arkadaşım Eşek', 'Barış Manço', 996887010, 0], ['Gülpembe', 'Barış Manço', 590644607, 36834123], ['Dönence', 'Barış Manço', 590644598, 33378909], ['Bu Akşam', 'Duman', 1411707587, 36913817],
      ['Senden Daha Güzel', 'Duman', 400312675, 34681361], ['Cevapsız Sorular', 'maNga', 341307889, 35267278], ['Paramparça', 'Teoman', 1411727947, 31172770], ['Bir Derdim Var', 'Mor ve Ötesi', 860519783, 34622437],
      ['Çakkıdı', 'Kenan Doğulu', 1594074717, 34552656], ['Araba', 'Mustafa Sandal', 860233291, 35081785], ['Bangır Bangır', 'Gülşen', 988843335, 34542907], ['Düm Tek Tek', 'Hadise', 661236619, 37016050],
      ['Petrol', 'Ajda Pekkan', 587177250, 17040890], ['Bambaşka Biri', 'Ajda Pekkan', 613669625, 36883452], ['Holigan', 'Athena', 1411760183, 37802267], ['Resimdeki Gözyaşları', 'Cem Karaca', 1160815513, 37505841],
      ['Everyway That I Can', 'Sertab Erener', 803591109, 37153093], ['Uzun İnce Bir Yoldayım', 'Aşık Veysel', 497255588, 36734567], ["Üsküdar'a Gider İken", 'Türkü', 1301294882, 34109377],
      ['Çökertme', 'Türkü', 791283214, 34515515], ['Leylim Ley', 'Türkü', 1091549618, 37170037],
    ],
  },
  {
    id: 'yabanci',
    name: 'Yabancı Şarkılar',
    items: [
      ['Despacito', 'Luis Fonsi', 1447401620, 36856755], ['Bohemian Rhapsody', 'Queen', 6781027645, 36902193], ['We Will Rock You', 'Queen', 6781080597, 30296668], ['Gangnam Style', 'PSY', 1445144527, 23318338],
      ['Shape of You', 'Ed Sheeran', 1193701392, 36863082], ['Macarena', 'Los del Río', 255639186, 36958753], ['Waka Waka', 'Shakira', 888878529, 36893119], ['Happy', 'Pharrell Williams', 863835363, 37016974],
      ['Thriller', 'Michael Jackson', 269573303, 28655242], ['Billie Jean', 'Michael Jackson', 273048789, 36973034], ['Seven Nation Army', 'The White Stripes', 1543262843, 36954792],
      ['Blinding Lights', 'The Weeknd', 1499386265, 37015057], ['Bad Guy', 'Billie Eilish', 1450695739, 37019431], ['Umbrella', 'Rihanna', 1441154437, 36844453], ['Hello', 'Adele', 1051332387, 7136713],
      ['Imagine', 'John Lennon', 1436922357, 14678060], ['Let It Be', 'The Beatles', 1441164738, 37014528], ['Yellow Submarine', 'The Beatles', 1441164526, 16618224], ['Dancing Queen', 'ABBA', 1440820267, 25169518],
      ['Barbie Girl', 'Aqua', 1443758761, 37020144],
    ],
  },
  {
    id: 'film',
    name: 'Film ve Dizi Müzikleri',
    items: [
      ['Pembe Panter', 'Film müziği', 953536415, -1], ['Star Wars', 'Film müziği', 1487508913, -1], ['Harry Potter', 'Film müziği', 89285956, -1], ['Titanik', 'Film müziği', 1745576958, 36975441],
      ['Karayip Korsanları', 'Film müziği', 724369568, -1], ['Görevimiz Tehlike', 'Film müziği', 52324180, -1], ['Hababam Sınıfı', 'Film müziği', 838853810, -1],
      ['Kurtlar Vadisi', 'Dizi müziği', 6780743895, -1], ['Muhteşem Yüzyıl', 'Dizi müziği', 646983710, -1], ['Game of Thrones', 'Dizi müziği', 1440799057, -1],
      ['Tom ve Jerry', 'Çizgi film', 552649702, -1], ['Sünger Bob', 'Çizgi film', 283379766, 24230086], ['Pokémon', 'Çizgi film', 1317448793, 1199129], ['Şirinler', 'Çizgi film', 1657147037, -1],
      ['Temel Reis', 'Çizgi film', 308101323, 36522586],
    ],
  },
  {
    id: 'cocuk',
    name: 'Çocuk Şarkıları',
    items: [
      ['İyi ki Doğdun', 'Doğum günü şarkısı', 1512501504, 23614508], ['Jingle Bells', 'Yılbaşı şarkısı', 268951123, 12166987], ['Baby Shark', 'Çocuk şarkısı', 1264976429, 37238127],
      ['Daha Dün Annemizin', 'Çocuk şarkısı', 1642983878, 0], ['Bak Postacı Geliyor', 'Çocuk şarkısı', 1103944891, 0], ['Ali Baba’nın Çiftliği', 'Çocuk şarkısı', 1672106552, 12148629],
      ['Mini Mini Bir Kuş', 'Çocuk şarkısı', 1672106558, 28837334], ['Yağ Satarım Bal Satarım', 'Çocuk şarkısı', 799510939, 23755629],
    ],
  },
];

export const TWISTERS = [
  'Şu köşe yaz köşesi, şu köşe kış köşesi, ortada su şişesi.',
  'Bir berber bir berbere gel beraber bir berber dükkânı açalım demiş.',
  'Kartal kalkar dal sarkar, dal sarkar kartal kalkar.',
  'Şemsi Paşa pasajında sesi büzüşesiceler.',
  'Kırk küp, kırkının da kulpu kırık küp.',
  'Üç tunç tas has hoş su.',
  'Bu yoğurdu sarımsaklasak da mı saklasak, sarımsaklamasak da mı saklasak?',
  'Al bu takatukaları takatukacıya götür.',
  'Çekoslovakyalılaştıramadıklarımızdanmısınız?',
  'Pijamalı hasta yağız şoföre çabucak güvendi.',
  'Muvaffakiyetsizleştiricileştiriveremeyebileceklerimizdenmişsinizcesine.',
  'Sinem şeker şişesini şimşek gibi şişirdi.',
  'Furkan fırında fıstıklı fıstıksız fındık fırlattı.',
  'Şirin şemsiyeli şoför şaşkın şaşkın şaşırdı.',
  'Kırmızı kurdeleli kırk kedi kırık kirpiğini kırptı.',
  'Pazartesi pastacı pasta pişirdi, pastacının pastası pişmedi.',
  'Tıpış tıpış tavşan tepside tost taşıdı.',
  'Dört deli dörder dörder dört dut ağacına tırmandı.',
  'Saksıdaki sarı sardunyalar sessizce sarardı.',
  'Balcı balı bala bulamış, bala bulaşan bal balcıyı bulamış.',
  'Kör kurbağa kuru kuyuda kurşun kalemle kurdele kurdu.',
  'Mavi minibüs minik mandalinaları mandal mandal mandalladı.',
  'Lale Leyla’ya lale, Leyla Lale’ye leylak verdi.',
  'Çatalcalı çatalcı çatal çatal çatal sattı.',
];

export const ECHO_LINES = [
  'Bugün hava parçalı bulutlu, akşam saatlerinde hafif yağmur bekleniyor.',
  'Sabah kahvaltısında peynir, zeytin, domates ve sıcacık simit vardı.',
  'Pazar günü sahilde uzun bir yürüyüş yapıp dondurma yedik.',
  'Kedim her sabah tam altıda yüzüme patisiyle dokunup beni uyandırıyor.',
  'Bu akşam film mi izleyelim, yoksa dışarı çıkıp yemek mi yiyelim?',
  'Market listesinde süt, yumurta, ekmek ve iki paket makarna var.',
  'Yaz tatilinde denize girip kumsalda kitap okumayı çok seviyorum.',
  'Trafik ışığı yeşile dönünce bütün arabalar aynı anda kornaya bastı.',
  'Ünlü şef mutfakta muhteşem bir çikolatalı pasta hazırladı.',
  'Uzay mekiği gece yarısı fırlatıldı ve milyonlarca kişi canlı izledi.',
  'Kütüphanedeki yaşlı adam bana çok ilginç bir masal anlattı.',
  'Bisikletimin zinciri koptu, eve kadar itmek zorunda kaldım.',
  'Doğum günü partisinde herkes şarkı söyledi ve pastayı birlikte kestik.',
  'Hava tahmini yarın kar yağacağını söylüyor, sıkı giyinmek lazım.',
  'Yeni aldığım ayakkabılar biraz dar geldi, yarın değiştireceğim.',
  'Akşam yemeğinde mantı yaptık, üzerine bol sarımsaklı yoğurt döktük.',
  'Telefonumun şarjı bitince haritayı göremedim ve yolumu kaybettim.',
  'Orman yürüyüşünde bir sincap, iki kirpi ve bir sürü kelebek gördük.',
  'Komşumuzun papağanı her sabah günaydın diyerek bütün apartmanı uyandırıyor.',
  'Sinema salonunda patlamış mısır yerken filmin sonunu tahmin etmeye çalıştık.',
];
