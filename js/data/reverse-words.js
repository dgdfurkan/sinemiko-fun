// Reverse Play kelime kartları. Dizi elemanı [metin, ipucu] ise ipucu kartın altında görünür.

export const CATEGORIES = [
  {
    id: 'unlu',
    name: 'Ünlüler',
    items: [
      'Şebnem Ferah', 'Tarkan', 'Sezen Aksu', 'Barış Manço', 'Cem Yılmaz', 'Kemal Sunal', 'Ajda Pekkan', 'Hadise',
      'Kenan Doğulu', 'Haluk Levent', 'Mabel Matiz', 'Sertab Erener', 'Zeki Müren', 'Müslüm Gürses', 'İbrahim Tatlıses',
      'Ata Demirer', 'Şahan Gökbakar', 'Beyazıt Öztürk', 'Acun Ilıcalı', 'Kıvanç Tatlıtuğ', 'Hande Erçel', 'Burak Özçivit',
      'Tuba Büyüküstün', 'Demet Akalın', 'Gülşen', 'Mustafa Sandal', 'Murat Boz', 'Edis', 'Zeynep Bastık', 'Teoman',
      'Yıldız Tilbe', 'Bergen', 'Ferdi Tayfur', 'Cem Karaca', 'Neşet Ertaş', 'Aleyna Tilki', 'Ezhel', 'Ceza',
      'Sagopa Kajmer', 'Okan Bayülgen', 'Fazıl Say', 'Arda Güler', 'Naim Süleymanoğlu', 'Hidayet Türkoğlu',
      'Lionel Messi', 'Cristiano Ronaldo', 'Shakira', 'Beyoncé', 'Taylor Swift', 'Michael Jackson', 'Freddie Mercury',
      'Leonardo DiCaprio', 'Brad Pitt', 'Lady Gaga', 'Rihanna', 'Ed Sheeran', 'Billie Eilish', 'Albert Einstein',
      'Elvis Presley', 'Bruno Mars', 'Nasreddin Hoca', 'Keloğlan', 'Temel Reis', 'Sünger Bob', 'Pikachu',
      'Mickey Mouse', 'Pembe Panter', 'Şirinler',
    ],
  },
  {
    id: 'sarki',
    name: 'Şarkılar',
    items: [
      ['Şımarık', 'Tarkan'], ['Kuzu Kuzu', 'Tarkan'], ['Dudu', 'Tarkan'], ['Hepsi Senin mi?', 'Tarkan'], ['Kış Güneşi', 'Tarkan'],
      ['Ölürüm Sana', 'Tarkan'], ['Gülümse', 'Sezen Aksu'], ['Hadi Bakalım', 'Sezen Aksu'], ['Firuze', 'Sezen Aksu'],
      ['Domates Biber Patlıcan', 'Barış Manço'], ['Arkadaşım Eşek', 'Barış Manço'], ['Gülpembe', 'Barış Manço'],
      ['Dönence', 'Barış Manço'], ['Bu Akşam', 'Duman'], ['Senden Daha Güzel', 'Duman'], ['Cevapsız Sorular', 'maNga'],
      ['Dünyanın Sonuna Doğmuşum', 'maNga'], ['Paramparça', 'Teoman'], ['Bir Derdim Var', 'Mor ve Ötesi'],
      ['Cambaz', 'Mor ve Ötesi'], ['Resimdeki Gözyaşları', 'Cem Karaca'], ['Çakkıdı', 'Kenan Doğulu'],
      ['Araba', 'Mustafa Sandal'], ['Aşkın Olayım', 'Simge'], ['Bangır Bangır', 'Gülşen'], ['Bambaşka Biri', 'Ajda Pekkan'],
      ['Superstar', 'Ajda Pekkan'], ['Düm Tek Tek', 'Hadise'], ['Everyway That I Can', 'Sertab Erener'], ['Holigan', 'Athena'],
      ['Uzun İnce Bir Yoldayım', 'Aşık Veysel'], ['Kara Toprak', 'Aşık Veysel'], ["Üsküdar'a Gider İken", 'Türkü'],
      ["Ankara'nın Bağları", 'Türkü'], ['Gesi Bağları', 'Türkü'], ['Çökertme', 'Türkü'], ['Leylim Ley', 'Türkü'],
      ['Despacito', 'Luis Fonsi'], ['Bohemian Rhapsody', 'Queen'], ['Baby Shark', 'Çocuk şarkısı'], ['Gangnam Style', 'PSY'],
      ['Shape of You', 'Ed Sheeran'], ['Thriller', 'Michael Jackson'], ['Hello', 'Adele'], ['Bad Guy', 'Billie Eilish'],
      ['Umbrella', 'Rihanna'], ['Toxic', 'Britney Spears'], ['Blinding Lights', 'The Weeknd'], ['Waka Waka', 'Shakira'],
      ['Macarena', 'Los del Río'], ['Jingle Bells', 'Yılbaşı şarkısı'], ['Happy Birthday', 'Doğum günü şarkısı'],
    ],
  },
  {
    id: 'film',
    name: 'Film ve Dizi',
    items: [
      'Titanik', 'Yüzüklerin Efendisi', 'Harry Potter', 'Matrix', 'Aslan Kral', 'Karlar Ülkesi', 'Hababam Sınıfı', 'Gora',
      'Babam ve Oğlum', 'Eşkıya', 'Vizontele', 'Yahşi Batı', 'Arog', 'Recep İvedik', 'Kurtlar Vadisi', 'Leyla ile Mecnun',
      'Avrupa Yakası', 'Behzat Ç.', 'Muhteşem Yüzyıl', 'Ezel', 'Aşk-ı Memnu', 'Kardeş Payı', 'Sihirli Annem',
      'Çocuklar Duymasın', 'Yaprak Dökümü', 'Breaking Bad', 'Friends', 'Game of Thrones', 'Stranger Things',
      'La Casa de Papel', 'Squid Game', 'Wednesday', 'Sherlock', 'Prison Break', 'The Office', 'Shrek', 'Toy Story',
      'Ratatuy', 'Kayıp Balık Nemo', 'Buz Devri', 'Minyonlar', 'Kung Fu Panda', 'Star Wars', 'Avatar', 'Jurassic Park',
      'Esaretin Bedeli', 'Forrest Gump', 'Başlangıç', 'Yıldızlararası', 'Joker', 'Barbie', 'Oppenheimer', 'Örümcek Adam',
      'Batman', 'Süpermen', 'Karayip Korsanları', 'Hayalet Avcıları', 'Geleceğe Dönüş',
    ],
  },
  {
    id: 'yemek',
    name: 'Yemekler',
    items: [
      'Lahmacun', 'İskender', 'Mantı', 'Karnıyarık', 'İmam Bayıldı', 'Hünkâr Beğendi', 'Kuzu Tandır', 'Çiğ Köfte', 'Menemen',
      'Sucuklu Yumurta', 'Baklava', 'Künefe', 'Sütlaç', 'Aşure', 'Kokoreç', 'Midye Dolma', 'Kumpir', 'Pide', 'Su Böreği',
      'Simit', 'Gözleme', 'Mercimek Çorbası', 'Ayran', 'Şalgam', 'Tavuk Döner', 'Pizza', 'Hamburger', 'Sushi', 'Spagetti',
      'Profiterol', 'Tiramisu', 'Cheesecake', 'Waffle', 'Musakka', 'Yaprak Sarma', 'Kısır', 'Ezogelin', 'Testi Kebabı',
      'Adana Kebap', 'Hamsi Tava', 'Çılbır', 'Kazandibi', 'Tavuk Göğsü', 'Lokum', 'Pişmaniye', 'Cezerye', 'Islak Hamburger',
      'Patates Kızartması', 'Kuru Fasulye', 'Pilav',
    ],
  },
  {
    id: 'yer',
    name: 'Şehir ve Ülke',
    items: [
      'İstanbul', 'Ankara', 'İzmir', 'Eskişehir', 'Trabzon', 'Gaziantep', 'Kapadokya', 'Bodrum', 'Antalya', 'Mardin', 'Rize',
      'Kastamonu', 'Çanakkale', 'Paris', 'Roma', 'Barselona', 'Amsterdam', 'Tokyo', 'New York', 'Londra', 'Venedik', 'Prag',
      'Viyana', 'Budapeşte', 'Kopenhag', 'Rio de Janeiro', 'Kahire', 'Dubai', 'Seul', 'Bangkok', 'Meksika', 'Arjantin',
      'Norveç', 'Finlandiya', 'İzlanda', 'Madagaskar', 'Avustralya', 'Kanada', 'Japonya', 'Portekiz', 'Yunanistan',
    ],
  },
  {
    id: 'hayvan',
    name: 'Hayvanlar',
    items: [
      'Zürafa', 'Su Aygırı', 'Kanguru', 'Penguen', 'Ornitorenk', 'Bukalemun', 'Ahtapot', 'Flamingo', 'Kirpi', 'Sincap',
      'Tembel Hayvan', 'Panda', 'Koala', 'Yunus', 'Denizatı', 'Timsah', 'Papağan', 'Baykuş', 'Kaplumbağa', 'Gergedan',
      'Çita', 'Leopar', 'Deve', 'Lama', 'Alpaka', 'Tavus Kuşu', 'Hamster', 'Kelebek', 'Uğur Böceği', 'Ateş Böceği',
    ],
  },
  {
    id: 'gunluk',
    name: 'Gündelik Sözler',
    items: [
      'Çay demledim', 'Kapıyı kapat', 'Çok acıktım', 'Hadi gidelim', 'Bugün ne yesek', 'Kumanda nerede', 'Uykum geldi',
      'Bana bir su getir', 'Bulaşıkları kim yıkayacak', 'Faturayı ödedin mi', 'Kargo geldi', 'Film açalım mı', 'Yine mi pizza',
      'Telefonum nerede', 'Anahtarları unuttum', 'Işığı kapat', 'Beş dakika daha', 'Saat kaç oldu', 'Çok yoruldum',
      'Dışarısı çok soğuk', 'Pazar kahvaltısı', 'Çamaşırları as', 'Klimayı kıs', 'Şarj aletim nerede',
    ],
  },
  {
    id: 'ask',
    name: 'Bize Özel',
    items: [
      'Seni seviyorum', 'Sinemiko', 'Aşkım benim', 'Canım benim', 'Bir tanem', 'Günaydın güzelim', 'İyi geceler aşkım',
      'Beni özledin mi', 'Sarılalım mı', 'Sen benim her şeyimsin', 'Hep yanımda kal', 'Tatlım', 'Prensesim', 'Yakışıklım',
      'Kahveni ben yaparım', 'Film gecesi yapalım', 'Bugün çok güzelsin', 'Ellerin çok soğuk', 'Sana bayılıyorum',
      'Bir öpücük ver',
    ],
  },
  {
    id: 'tekerleme',
    name: 'Tekerlemeler',
    items: [
      ['Şu köşe yaz köşesi', 'Zor'], ['Bir berber bir berbere', 'Zor'], ['Kartal kalkar dal sarkar', 'Zor'],
      ['Şemsi Paşa pasajı', 'Zor'], ["Çatalca'da çatal kaşık", 'Zor'], ['Al bu takatukaları', 'Zor'],
      ['Kırk küp kırkının da kulpu kırık', 'Çok zor'], ['Üç tunç tas has hoş su', 'Çok zor'],
      ['Pijamalı hasta yağız şoföre çabucak güvendi', 'Çok zor'], ['Bu yoğurdu sarımsaklasak da mı saklasak', 'Çok zor'],
    ],
  },
];

export const DEFAULT_CATS = ['unlu', 'sarki', 'film', 'yemek', 'ask'];
