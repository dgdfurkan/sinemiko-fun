// Sesli oyunların içerikleri: mırıldanılacak şarkılar, tekerlemeler, yankı cümleleri

// Mırıldan Bakalım: [şarkı, ipucu, iTunes no (yedek 30 sn kesit), LRCLIB söz no, LRCLIB zamanlı söz no, YouTube]
// Söz no 0 ise söz bulunamadı, -1 ise parça sözsüz.
// YouTube "e:" ile başlıyorsa sitede gömülü çalabilen kayıtlar (gerçek oynatıcıda denendi),
// "w:" ile başlıyorsa gömülmeye kapalı; şarkı YouTube penceresinde açılır. Zamanlı söz varsa süresi o kayıtla tutar.
export const HUM_CATS = [
  {
    id: 'tr',
    name: 'Türkçe Şarkılar',
    items: [
      ['Şımarık', 'Tarkan', 499332705, 36925554, 36925554, 'e:OG4ggvY_8p0,tNxOK5ruSYU,6dQHNtU9HPQ'], ['Kuzu Kuzu', 'Tarkan', 499334149, 37121035, 34691043, 'e:NAHRpEqgcL4,b6jn5Zg6YhY,C3-zNp_KSmA'], ['Dudu', 'Tarkan', 696699513, 37120776, 0, 'e:FtCHL-d5WGA,bKWGeEY1oKk,W49GQ0wu7t8'], ['Kış Güneşi', 'Tarkan', 499332123, 36943367, 2050655, 'e:KDgDneaJI1o,t0gqx2tYE68'], ['Hepsi Senin mi?', 'Tarkan', 499332030, 34659662, 34659662, 'e:GB5J_2jWxMQ,pfwaWWa4Dag,h-jvl5Yo184'],
      ['Gülümse', 'Sezen Aksu', 1834675504, 35893693, 35738049, 'w:qgfLk8Uksxo'], ['Hadi Bakalım', 'Sezen Aksu', 1834675496, 34328687, 34328687, 'w:ckTU-2zjz8k'], ['Firuze', 'Sezen Aksu', 1834674045, 37167114, 37618257, 'w:tA598nLajOc'], ['Domates Biber Patlıcan', 'Barış Manço', 585138560, 0, 5594869, 'w:KkNyfRVaoSw'],
      ['Arkadaşım Eşek', 'Barış Manço', 996887010, 0, 0, 'e:o8W4LXM_mxs'], ['Gülpembe', 'Barış Manço', 590644607, 36834123, 36834123, 'w:uQzQ4epiS6Q'], ['Dönence', 'Barış Manço', 590644598, 33378909, 33378909, 'w:DZNrH2M8K7Y'], ['Bu Akşam', 'Duman', 1411707587, 36913817, 36913817, 'e:76kJGsgkftk'],
      ['Senden Daha Güzel', 'Duman', 400312675, 34681361, 34681361, 'e:ePYoGoDjycg'], ['Cevapsız Sorular', 'maNga', 341307889, 35267278, 35267278, 'e:Bz_lHNCp9R4,Jt7gDXhdwp0,dcKnoH_726I'], ['Paramparça', 'Teoman', 1411727947, 31172770, 35269706, 'e:zAg3FdRQ0B8'], ['Bir Derdim Var', 'Mor ve Ötesi', 860519783, 34622437, 34682536, 'e:7RW8n4iXZbA,KFe-UUyIyQY,ycQVvuCbZVU'],
      ['Çakkıdı', 'Kenan Doğulu', 1594074717, 34552656, 2711232, 'e:1gc1MqsNrcY,QmoY4g2X9fc,DAS1b7_8Qsg'], ['Araba', 'Mustafa Sandal', 860233291, 35081785, 35081785, 'w:v1KcIVLdPas'], ['Bangır Bangır', 'Gülşen', 988843335, 34542907, 34542907, 'e:icZ-OlVSvb4,w9KiDbHBPn4,Xc0igwHRMv4'], ['Düm Tek Tek', 'Hadise', 661236619, 37016050, 37016050, 'e:kyIKSzPO3mU'],
      ['Petrol', 'Ajda Pekkan', 587177250, 17040890, 17040890, 'w:5ctz_MbRPzs'], ['Bambaşka Biri', 'Ajda Pekkan', 613669625, 36883452, 35320714, 'w:-MGGxqIgFr4'], ['Holigan', 'Athena', 1411760183, 37802267, 37802267, 'w:birgqdzUAQE'], ['Resimdeki Gözyaşları', 'Cem Karaca', 1160815513, 37505841, 37505841, 'e:vwhhBGI_PFQ,ZtH5UO8M78w'],
      ['Everyway That I Can', 'Sertab Erener', 803591109, 37153093, 37153093, 'w:bRAjf9rFA58'], ['Uzun İnce Bir Yoldayım', 'Aşık Veysel', 497255588, 36734567, 36734567, 'w:W8tIjp2N63g'], ["Üsküdar'a Gider İken", 'Türkü', 1301294882, 34109377, 14751120, 'w:CWOrDXnnmOc'],
      ['Çökertme', 'Türkü', 791283214, 34515515, 36384147, 'w:xAgBZ-fa4MI'], ['Leylim Ley', 'Türkü', 1091549618, 37170037, 37294017, 'w:k2NO2prCAXQ'],
    ],
  },
  {
    id: 'yabanci',
    name: 'Yabancı Şarkılar',
    items: [
      ['Despacito', 'Luis Fonsi', 1447401620, 36856755, 37084584, 'w:t3IyUATcAbE'], ['Bohemian Rhapsody', 'Queen', 6781027645, 36902193, 37174882, 'w:xG16sdjLtc0'], ['We Will Rock You', 'Queen', 6781080597, 30296668, 30296668, 'w:QenM-0c_Cec'], ['Gangnam Style', 'PSY', 1445144527, 23318338, 23318338, 'w:CVxMTl6cUSE'],
      ['Shape of You', 'Ed Sheeran', 1193701392, 36863082, 37035845, 'w:_dK2tDK9grQ'], ['Macarena', 'Los del Río', 255639186, 36958753, 36958753, 'e:feqwA-vN3Qs'], ['Waka Waka', 'Shakira', 888878529, 36893119, 36893119, 'w:pRpeEdMmmQ0'], ['Happy', 'Pharrell Williams', 863835363, 37016974, 37016974, 'e:XQG89cwhmJU'],
      ['Thriller', 'Michael Jackson', 269573303, 28655242, 28655242, 'w:sO4vI8P88NM'], ['Billie Jean', 'Michael Jackson', 273048789, 36973034, 36973034, 'e:LfyVxAw2Jw4'], ['Seven Nation Army', 'The White Stripes', 1543262843, 36954792, 36954792, 'w:KcZ73FRFLzY'],
      ['Blinding Lights', 'The Weeknd', 1499386265, 37015057, 37015057, 'e:ttx8nQirwcY'], ['Bad Guy', 'Billie Eilish', 1450695739, 37019431, 37019431, 'w:ayxYgDgBD3g'], ['Umbrella', 'Rihanna', 1441154437, 36844453, 36844453, 'w:EPtrQpx9VDw'], ['Hello', 'Adele', 1051332387, 7136713, 7136713, 'w:T1tl66trXTQ'],
      ['Imagine', 'John Lennon', 1436922357, 14678060, 14678060, 'e:m6xN_9Fti2s'], ['Let It Be', 'The Beatles', 1441164738, 37014528, 37014528, 'w:CGj85pVzRJs'], ['Yellow Submarine', 'The Beatles', 1441164526, 16618224, 16618224, 'w:j_JaDDcyIIU'], ['Dancing Queen', 'ABBA', 1440820267, 25169518, 25169518, 'w:xFrGuyw1V8s'],
      ['Barbie Girl', 'Aqua', 1443758761, 37020144, 37020144, 'w:eLXXFVNFKww'],
    ],
  },
  {
    id: 'film',
    name: 'Film ve Dizi Müzikleri',
    items: [
      ['Pembe Panter', 'Film müziği', 953536415, -1, 0, 'e:oe_uqv5GNNw,3Lxqjzik-8w,CXaYr2o-YeY'], ['Star Wars', 'Film müziği', 1487508913, -1, 0, 'e:lTYI9nsj1iw'], ['Harry Potter', 'Film müziği', 89285956, -1, 0, 'e:QrTrmnpTNwY,QGzWpl-r6ec,xjMnoXqvtPQ'], ['Titanik', 'Film müziği', 1745576958, 36975441, 36975441, 'w:9bFHsd3o1w0'],
      ['Karayip Korsanları', 'Film müziği', 724369568, -1, 0, 'w:dFBBKfw59kA'], ['Görevimiz Tehlike', 'Film müziği', 52324180, -1, 0, 'w:9O5v-IQPwnY'], ['Hababam Sınıfı', 'Film müziği', 838853810, -1, 0, 'e:VCkVyDNZek8,hxzWSVhSl6I'],
      ['Kurtlar Vadisi', 'Dizi müziği', 6780743895, -1, 0, 'e:buVhk7c8cVQ,xLjUd5UOIHY,ASdJHaKSTB8'], ['Muhteşem Yüzyıl', 'Dizi müziği', 646983710, -1, 0, 'e:rmElg9c_xuw,trtSj_loyow,M47u5tg-kU8'], ['Game of Thrones', 'Dizi müziği', 1440799057, -1, 0, 'e:TZE9gVF1QbA,s7L2PVdrb_8'],
      ['Tom ve Jerry', 'Çizgi film', 552649702, -1, 0, 'e:3cu0KOzunpI,-4zHM7LYlWo,zeAlFwuP7Vw'], ['Sünger Bob', 'Çizgi film', 283379766, 24230086, 35313695, 'e:ncfsLasd87c,XE8UpIZqTZs,8zHnIQvoBbQ'], ['Pokémon', 'Çizgi film', 1317448793, 1199129, 35715167, 'e:JHnk5LyVNME,jqxZ5pzr21Q,iaQkl_zLVuA'], ['Şirinler', 'Çizgi film', 1657147037, -1, 0, 'e:t-9uWbuJjBo,ic3-fd1iIIA,gGjIYT3JoiE'],
      ['Temel Reis', 'Çizgi film', 308101323, 36522586, 0, 'w:Kl9uYHkvc0M'],
    ],
  },
  {
    id: 'cocuk',
    name: 'Çocuk Şarkıları',
    items: [
      ['İyi ki Doğdun', 'Doğum günü şarkısı', 1512501504, 23614508, 0, 'e:JsCVNa0VUZk,yb5tMpnKAxc,kKXoDRBi-dg'], ['Jingle Bells', 'Yılbaşı şarkısı', 268951123, 12166987, 36967714, 'e:4YBGRGBj7_w'], ['Baby Shark', 'Çocuk şarkısı', 1264976429, 37238127, 37238127, 'w:XqZsoesa55w'],
      ['Daha Dün Annemizin', 'Çocuk şarkısı', 1642983878, 0, 0, 'e:mmIgrNIYi24,CEAJRa01xBQ,V9pz8XmLYms'], ['Bak Postacı Geliyor', 'Çocuk şarkısı', 1103944891, 0, 14026912, 'e:F82SHNB55tU,5dCo1IKzJR4'], ['Ali Baba’nın Çiftliği', 'Çocuk şarkısı', 1672106552, 12148629, 0, 'e:3HzvJh4L_JI,ZmnYOoKXlbg,LM43PcWPXsI'],
      ['Mini Mini Bir Kuş', 'Çocuk şarkısı', 1672106558, 28837334, 28837334, 'e:63aEMkcCxcI,Zcr3dng_HYE'], ['Yağ Satarım Bal Satarım', 'Çocuk şarkısı', 799510939, 23755629, 23755629, 'e:IZehSmunvcA'],
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
