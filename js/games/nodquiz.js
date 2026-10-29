// Kafa Salla: ekranda bir cümle çıkar. Doğruysa başını yukarı aşağı salla, yanlışsa sağa sola çevir.
// İlk doğru cevaplayan 2, ikinci doğru cevaplayan 1 puan alır; yanlış cevap 1 puan götürür

import { html, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { scoreboard } from '../ui/scoreboard.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { optHTML } from './common.js';
import { camDuel, noseOf, PCOL, tag, missingText } from './arena.js';
import { drawFaceFrame } from './cam.js';

const ANSWER_SEC = 7;
const WIN_MS = 1100;

// [cümle, doğru mu, kısa açıklama]
const FACTS = [
  ['Ahtapotun üç kalbi vardır.', true, 'Evet, iki kalp solungaçlara, biri vücuda kan pompalar.'],
  ['Penguenler Kuzey Kutbu\'nda yaşar.', false, 'Penguenler güney yarımkürede yaşar.'],
  ['Yunuslar uyurken beyinlerinin yarısı uyanık kalır.', true, 'Böylece nefes almayı unutmazlar.'],
  ['Zürafanın dili koyu mor renklidir.', true, 'Koyu, morumsu bir dilleri vardır.'],
  ['Ay kendi ışığını üretir.', false, 'Ay, Güneş\'in ışığını yansıtır.'],
  ['Venüs, Güneş Sistemi\'nin en sıcak gezegenidir.', true, 'Kalın atmosferi ısıyı hapseder.'],
  ['Kutup ayılarının derisi siyahtır.', true, 'Tüyleri beyaz görünür, derileri siyahtır.'],
  ['İnsan vücudunun en büyük organı deridir.', true, 'Evet, deri.'],
  ['Kelebekler tadı ayaklarıyla alır.', true, 'Ayaklarındaki tat alıcılarla.'],
  ['Develer hörgüçlerinde su depolar.', false, 'Hörgüçte yağ depolanır.'],
  ['Japonya\'nın başkenti Kyoto\'dur.', false, 'Başkent Tokyo.'],
  ['Türkiye\'nin en yüksek dağı Ağrı Dağı\'dır.', true, 'Yaklaşık 5137 metre.'],
  ['Mona Lisa tablosu Paris\'teki Louvre Müzesi\'ndedir.', true, 'Evet, Louvre\'da.'],
  ['Bir haftada 168 saat vardır.', true, '7 çarpı 24 eder 168.'],
  ['Örümcekler böcektir.', false, 'Örümcekler böcek değil, örümceğimsilerdir.'],
  ['Köpekbalıkları memelidir.', false, 'Köpekbalıkları balıktır.'],
  ['Yarasalar memelidir.', true, 'Uçabilen tek memeliler.'],
  ['Çikolata köpekler için zararlıdır.', true, 'İçindeki teobromin köpeklere dokunur.'],
  ['Altın suya atılınca yüzer.', false, 'Altın sudan çok daha yoğundur, batar.'],
  ['Satrançta at L şeklinde hareket eder.', true, 'İki kare bir yöne, bir kare yana.'],
  ['Bir futbol maçının normal süresi 80 dakikadır.', false, 'Normal süre 90 dakika.'],
  ['İstanbul, Türkiye\'nin başkentidir.', false, 'Başkent Ankara.'],
  ['Koalalar bir ayı türüdür.', false, 'Koalalar keseli hayvanlardır.'],
  ['Flamingolar pembe rengini yedikleri besinlerden alır.', true, 'Karides ve alglerdeki boyalardan.'],
  ['Kediler tatlı tadı alamaz.', true, 'Tatlıyı algılayan tat alıcıları çalışmaz.'],
  ['Avokado bir meyvedir.', true, 'Botanik olarak meyvedir.'],
  ['Domates botanik olarak bir sebzedir.', false, 'Botanikte domates bir meyvedir.'],
  ['Arılar dans ederek yön tarif eder.', true, 'Sallanma dansıyla çiçeklerin yerini anlatırlar.'],
  ['Filler zıplayamaz.', true, 'Fil, zıplayamayan hayvanlardandır.'],
  ['Ses boşlukta yayılmaz.', true, 'Ses yayılmak için havaya ya da başka bir ortama ihtiyaç duyar.'],
  ['Ses ışıktan daha hızlıdır.', false, 'Işık çok daha hızlıdır; önce şimşeği görürsün.'],
  ['Plüton hâlâ resmi olarak dokuzuncu gezegendir.', false, '2006\'dan beri cüce gezegen sayılıyor.'],
  ['Kırmızı ile sarı karışınca turuncu olur.', true, 'Evet, turuncu.'],
  ['Bir düzine 10 tanedir.', false, 'Bir düzine 12 tanedir.'],
  ['Satürn\'ün halkaları vardır.', true, 'Buz ve kaya parçalarından.'],
  ['Mars\'a Kızıl Gezegen denir.', true, 'Yüzeyindeki demir oksit yüzünden.'],
  ['Kangurular geri geri kolayca yürüyebilir.', false, 'Kuyrukları ve bacakları buna pek izin vermez.'],
  ['Bal, iyi saklanırsa yıllarca bozulmaz.', true, 'Çok az su içerir, mikrop barınamaz.'],
  ['Sahra, dünyanın en büyük sıcak çölüdür.', true, 'Evet, en büyük sıcak çöl.'],
  ['Gökkuşağında geleneksel olarak yedi renk sayılır.', true, 'Kırmızıdan mora yedi renk.'],
  ['Kar tanelerinin çoğu altı kollu olur.', true, 'Buz kristali altıgen yapıdadır.'],
  ['Everest, deniz seviyesinden en yüksek dağdır.', true, 'Yaklaşık 8849 metre.'],
  ['İnsan kalbi dakikada ortalama 300 kez atar.', false, 'Dinlenirken dakikada 60 ile 100 arası.'],
  ['Ahtapotların kanı mavidir.', true, 'Kanlarındaki bakır yüzünden.'],
  ['Timsahlar dillerini dışarı çıkaramaz.', true, 'Dilleri ağız tabanına bağlıdır.'],
  ['Bukalemunlar renklerini yalnızca saklanmak için değiştirir.', false, 'Ruh hali ve sıcaklık da renklerini değiştirir.'],
];

export function mount(view, opts) {
  return camDuel(view, opts, {
    cls: 'game-nodquiz',
    kind: 'face',
    cfg: { count: '10' },
    rules: [
      'Ekrana bir cümle gelir. Doğru diyorsan başını yukarı aşağı salla, yanlış diyorsan sağa sola çevir.',
      html`İlk doğru cevaplayan <b>+2</b>, ikinci doğru cevaplayan <b>+1</b>. Yanlış cevap <b>-1</b>.`,
      'Acele et ama dikkatli ol: kafayı bir kere salladın mı cevap kilitlenir.',
    ],
    options: (cfg) => optHTML('Soru Sayısı', segHTML('count', [['6', '6'], ['10', '10'], ['15', '15']], cfg.count)),
    bind: (scene, cfg, stage) => {
      const s = bindSeg(scene.querySelector('[data-seg="count"]'), { value: cfg.count, onChange: (v) => { cfg.count = v; } });
      stage.own(() => s.destroy());
    },
    waitTitle: 'Kafalar Hazır',
    waitTip: 'Yan yana oturun, yüzleriniz kameraya dönük olsun.',
    voices: ['cd-3', 'cd-2', 'cd-1', 'go-salla', 'dogru', 'yanlis'],
    tie: 'Berabere! İkiniz de Bilgin',
    albumTitle: 'Kafa Salla',
    mid: (cfg) => `Soru 1 / ${cfg.count}`,
    play,
  });
}

async function play(ctx) {
  const { cam, cfg, m } = ctx;
  m.list = shuffle(FACTS.slice()).slice(0, Number(cfg.count));
  m.k = -1;
  m.hist = [[], []];
  m.ans = [null, null];
  m.order = [];
  m.right = [0, 0];
  m.phase = 'wait';
  const scene = ctx.hud(html`
    <div class="hud-top nq-top" data-in><div class="hud-card nq-card"><p class="nq-q t-big" data-q>Hazır mısınız?</p><p class="hud-tip" data-tip>Doğru: başını salla. Yanlış: sağa sola çevir.</p></div></div>
    <div class="hud-bottom"><p class="hud-warn" data-warn></p><span class="hud-pill"><b data-clock>${ANSWER_SEC}</b> sn</span></div>`);
  m.qEl = scene.querySelector('[data-q]');
  m.tipEl = scene.querySelector('[data-tip]');
  m.clockEl = scene.querySelector('[data-clock]');
  const warn = scene.querySelector('[data-warn]');
  cam.onFrame = (players, now) => {
    warn.textContent = missingText(cam);
    players.forEach((p, i) => {
      if (!p) return;
      const n = noseOf(p);
      const h = m.hist[i];
      h.push({ x: n.x / (p.box.w || 0.2), y: n.y / (p.box.h || 0.3), t: now });
      while (h.length && now - h[0].t > WIN_MS) h.shift();
      if (m.phase === 'ask' && m.ans[i] === null) {
        const g = gestureOf(h);
        if (g !== null) answer(ctx, i, g);
      }
    });
  };
  cam.draw = (g, players, dt, t) => draw(ctx, g, players, dt, t);
  await ctx.countdown(scene, { final: 'Salla!', voice: 'go-salla' });
  if (!ctx.life.alive || m.over) return;
  next(ctx);
}

// Son bir saniyedeki burun hareketi: dikey salınım evet, yatay salınım hayır
function gestureOf(h) {
  if (h.length < 8) return null;
  const range = (k) => Math.max(...h.map((q) => q[k])) - Math.min(...h.map((q) => q[k]));
  const turns = (k) => {
    let n = 0;
    let dir = 0;
    for (let j = 2; j < h.length; j++) {
      const d = h[j][k] - h[j - 2][k];
      if (Math.abs(d) < 0.012) continue;
      const s = Math.sign(d);
      if (dir && s !== dir) n++;
      dir = s;
    }
    return n;
  };
  const rx = range('x');
  const ry = range('y');
  if (ry > 0.07 && ry > rx * 1.4 && turns('y') >= 2) return true;
  if (rx > 0.09 && rx > ry * 1.4 && turns('x') >= 2) return false;
  return null;
}

function next(ctx) {
  const { m } = ctx;
  if (m.over) return;
  m.k++;
  if (m.k >= m.list.length) {
    end(ctx);
    return;
  }
  const [q] = m.list[m.k];
  m.ans = [null, null];
  m.order = [];
  m.hist = [[], []];
  m.phase = 'ask';
  m.qEl.textContent = q;
  m.qEl.classList.remove('nq-true', 'nq-false');
  m.tipEl.textContent = 'Doğru: başını salla. Yanlış: sağa sola çevir.';
  m.qEl.animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  scoreboard.setMid(`Soru ${m.k + 1} / ${m.list.length}`);
  sfx.flip();
  m.clock = ctx.clock(m.clockEl, ANSWER_SEC, { onEnd: () => reveal(ctx) });
}

function answer(ctx, i, yes) {
  const { m } = ctx;
  m.ans[i] = yes;
  m.order.push(i);
  sfx.lock();
  if (m.ans[0] !== null && m.ans[1] !== null) {
    m.clock.stop();
    ctx.life.timeout(() => reveal(ctx), 500);
  }
}

function reveal(ctx) {
  const { m, cam, fx } = ctx;
  if (m.phase !== 'ask') return;
  m.phase = 'reveal';
  const [, truth, why] = m.list[m.k];
  m.qEl.classList.add(truth ? 'nq-true' : 'nq-false');
  m.tipEl.textContent = `${truth ? 'Doğru!' : 'Yanlış!'} ${why}`;
  announcer.say(truth ? 'dogru' : 'yanlis');
  let firstRight = true;
  for (const i of m.order) {
    const p = cam.players[i];
    const x = p ? p.box.cx : 0.5;
    const y = p ? p.box.y : 0.3;
    if (m.ans[i] === truth) {
      const pts = firstRight ? 2 : 1;
      firstRight = false;
      m.right[i]++;
      ctx.score(i, pts, x, y);
      fx.burst(x * cam.W, y * cam.H, { n: 18, colors: [PCOL[i], '#2ed6a0', '#fff'], power: 340, shape: 'star' });
    } else {
      if (ctx.pts[i] > 0) ctx.score(i, -1, x, y, { quiet: true });
      fx.text(x * cam.W, y * cam.H - 30, '-1', '#ff4f62', 22);
      sfx.fail();
    }
  }
  if (m.order.length) sfx.success();
  ctx.life.timeout(() => next(ctx), 3200);
}

function draw(ctx, g, players, dt, t) {
  const { cam, m, fx } = ctx;
  if (!m || m.over) return;
  players.forEach((p, i) => {
    if (!p) return;
    const a = m.ans[i];
    drawFaceFrame(g, cam, p, i, { glow: a === null && m.phase === 'ask' ? 0.2 + 0.2 * Math.sin(t / 200) : 0.6 });
    if (a !== null) {
      const x = p.box.cx * cam.W;
      const y = (p.box.y + p.box.h) * cam.H + 30;
      const right = m.phase === 'reveal' ? a === m.list[m.k][1] : null;
      const color = right === null ? PCOL[i] : right ? '#2ed6a0' : '#ff4f62';
      tag(g, x, Math.min(cam.H - 30, y), a ? 'Doğru dedi' : 'Yanlış dedi', color, 18);
    }
  });
  fx.draw(g, dt);
}

function end(ctx) {
  const { m } = ctx;
  m.phase = 'end';
  sfx.whistle();
  ctx.life.timeout(() => {
    [0, 1].forEach((i) => ctx.shoot(i, `${m.right[i]} doğru`, { pad: 0.4, force: true }));
    ctx.finish({
      stats: [0, 1].map((i) => html`<span><b>${m.right[i]}</b> doğru cevap</span>`),
      sub: `${m.list.length} soru soruldu. ${nameOf(0)} ve ${nameOf(1)} artık biraz daha bilgili.`,
    });
  }, 600);
}
