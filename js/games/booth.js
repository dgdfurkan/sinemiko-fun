// Fotoğraf Kabini: birlikte poz verirsiniz, ikiniz de istenen suratı yapınca deklanşör kendiliğinden çalışır.
// Sonunda kabin şeridi ve kolaj 8K olarak indirilir. Yarış yok, anı var.

import { html, raw, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { cannons } from '../fx/confetti.js';
import { lobbyHTML, optHTML, celebrate } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawFaceFrame, meter, PCOL, downloadAlbum } from './cam.js';
import { exprById, smileOf, faceSVG } from '../vision/faces.js';

const HOLD = 0.3;
const WAIT = 8;

const expr = (id) => exprById(id).value;
// pair: iki yüz birbirine yakın mı; free: serbest, geri sayımla çekilir
const SHOTS = {
  smile: { name: 'İkiniz De Gülümseyin', voice: 'booth-smile', face: { eyes: 'happy', mouth: 'grin' }, test: (p) => smileOf(p) / 0.5 },
  wow: { name: 'İkiniz De Şok Olun', voice: 'face-wow', face: exprById('wow').face, test: expr('wow') },
  kiss: { name: 'Kameraya Öpücük', voice: 'face-kiss', face: exprById('kiss').face, test: expr('kiss') },
  wink: { name: 'Göz Kırpın', voice: 'face-wink', face: exprById('wink').face, test: expr('wink') },
  angry: { name: 'En Kızgın Halimiz', voice: 'face-angry', face: exprById('angry').face, test: expr('angry') },
  tilt: { name: 'Kafaları Yatırın', voice: 'face-tilt', face: exprById('tilt').face, test: expr('tilt') },
  close: { name: 'Yanak Yanağa', voice: null, pair: true },
  free: { name: 'En Saçma Halimiz', voice: null, free: true },
};

function plan(n) {
  const mid = shuffle(['wow', 'kiss', 'wink', 'angry', 'tilt', 'free']).slice(0, n - 2);
  return ['smile', ...mid, 'close'];
}

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-booth');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  const cfg = { shots: '4' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Yan yana, yanak yanağa oturun; ikinizin de yüzü görünsün.',
        'Ekranda bir surat çıkar. İkiniz de o suratı yapınca deklanşör kendiliğinden çalışır. Olmazsa geri sayımla çeker.',
        'Sonunda fotoğraf kabini şeridiniz ve kolajınız hazır: 8K olarak indirip saklayın.',
      ],
      options: optHTML('Kare Sayısı', segHTML('shots', [['4', '4 Kare'], ['6', '6 Kare']], cfg.shots)),
      start: 'Kamerayı Aç',
      note: 'Fotoğraflar yalnızca bu cihazda, siz indirene kadar kimse görmez.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const seg = bindSeg(scene.querySelector('[data-seg="shots"]'), { value: cfg.shots, onChange: (v) => { cfg.shots = v; } });
    stage.own(() => seg.destroy());
  }

  function boot() {
    camBoot(stage, life, cam, 'face', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Kabine Hoş Geldiniz',
      tip: 'Yan yana oturun, ikiniz de kameraya bakın.',
      onReady: () => play(),
    });
  }

  async function play() {
    g = { list: plan(Number(cfg.shots)), k: 0, photos: [], over: false };
    announcer.preload(['booth-smile', 'booth-go', 'booth-done', 'cd-3', 'cd-2', 'cd-1', 'face-wow', 'face-kiss', 'face-wink', 'face-angry', 'face-tilt']);
    while (g.k < g.list.length) {
      await shot(g.list[g.k]);
      if (!life.alive) return;
      g.k++;
    }
    final();
  }

  function shot(id) {
    const def = SHOTS[id];
    return new Promise((resolve) => {
      const st = [0, 1].map(() => ({ v: 0, hold: 0 }));
      let pairHold = 0;
      let last = 0;
      let done = false;
      let started = false;
      const art = def.pair ? html`<span class="booth-art">${icon('heart')}</span>` : def.free ? html`<span class="booth-art">${icon('sparkle')}</span>` : raw(faceSVG(def.face));
      const scene = stage.show(html`
        <div class="hud-top" data-in>
          <div class="pose-cue face-cue booth-cue">
            <span class="cue-say">Kare ${g.k + 1} / ${g.list.length}</span>
            <div class="cue-fig">${art}</div>
            <span class="cue-name">${def.name}</span>
            <span class="cue-tip">${def.free ? 'Geri sayımla çekiyorum!' : 'İkiniz de yapınca kendim çekeceğim.'}</span>
            <div class="cue-time"><span data-time></span></div>
          </div>
        </div>
        <div class="hud-bottom"><p class="hud-warn" data-warn></p></div>`, {}, { className: 'hud' });
      const timeBar = scene.querySelector('[data-time]');
      const warn = scene.querySelector('[data-warn]');
      if (def.voice) announcer.say(def.voice);
      sfx.whoosh();

      const snap = async (viaCount) => {
        if (done) return;
        done = true;
        cam.onFrame = null;
        timeBar.getAnimations().forEach((a) => a.pause());
        if (viaCount) await countdown(scene, life, { final: 'Çek!', voice: 'booth-go', step: 650 });
        else announcer.say('booth-go');
        if (stage.scene !== scene) return;
        const img = cam.frameShot();
        cam.flash();
        if (img) g.photos.push({ img, cap: def.name, by: `${nameOf(0)} & ${nameOf(1)}`, color: '#ff5fa2' });
        // Çekilen kare köşede bir an görünür
        if (img) {
          const thumb = document.createElement('img');
          thumb.className = 'booth-thumb';
          thumb.src = img;
          thumb.alt = '';
          scene.append(thumb);
          thumb.animate([{ transform: 'scale(1.6) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1) rotate(3deg)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
        sfx.success();
        life.timeout(() => { if (stage.scene === scene) resolve(); }, 1500);
      };

      life.timeout(() => {
        if (stage.scene !== scene) return;
        started = true;
        timeBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: WAIT * 1000, easing: 'linear', fill: 'forwards' });
        if (def.free) snap(true);
        else life.timeout(() => { if (stage.scene === scene) snap(true); }, WAIT * 1000);
      }, 900);

      cam.onFrame = (players, now) => {
        const dt = last ? Math.min(0.12, (now - last) / 1000) : 0;
        last = now;
        warn.textContent = missingText(cam);
        if (!started || done || def.free) return;
        const [a, b] = players;
        if (def.pair) {
          // Yüz merkezleri arasındaki uzaklık, yüz genişliklerinin ortalamasına göre
          const close = a && b && Math.hypot((a.box.cx - b.box.cx) * (a.ar || 1.78), a.box.cy - b.box.cy) < ((a.box.w + b.box.w) / 2) * (a.ar || 1.78) * 1.45;
          pairHold = close ? pairHold + dt : Math.max(0, pairHold - dt * 2);
          st.forEach((s) => { s.v = close ? 1 : 0.4; });
          if (pairHold >= HOLD) snap(false);
          return;
        }
        players.forEach((p, i) => {
          const s = st[i];
          s.v = p ? def.test(p) : 0;
          s.hold = s.v >= 1 ? s.hold + dt : Math.max(0, s.hold - dt * 2);
        });
        if (st[0].hold >= HOLD && st[1].hold >= HOLD) snap(false);
      };

      cam.draw = (gx, players) => players.forEach((p, i) => {
        if (!p) return;
        const s = st[i];
        drawFaceFrame(gx, cam, p, i, { glow: Math.min(1, s.v) });
        if (!def.free) meter(gx, cam, p, s.v, PCOL[i]);
      });
    });
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    const photos = g.photos;
    stage.show(html`
      <h1 class="t-title" data-in>Kabin Şeridiniz Hazır!</h1>
      <div class="booth-strip" data-in>
        <span class="bs-title">Sinemiko Kabini</span>
        ${photos.map((ph, k) => html`<figure style="--r:${(k % 2 ? 1 : -1) * 0.6}deg"><img src="${ph.img}" alt="${ph.cap}"><figcaption>${ph.cap}</figcaption></figure>`)}
      </div>
      <div class="row" data-in>
        <button class="btn btn--primary" data-act="strip">${icon('download')}8K Şerit İndir</button>
        <button class="btn" data-act="grid">${icon('download')}8K Kolaj İndir</button>
      </div>
      <div class="row" data-in>
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn nudge" data-act="again">${icon('replay')}Yeniden Çekelim</button>
      </div>`, {
      strip: () => downloadAlbum('Sinemiko Kabini', photos, 'sinemiko-kabin-seridi.jpg', { strip: true }),
      grid: () => downloadAlbum('Bizim Anılar', photos, 'sinemiko-kabin-kolaji.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final booth-final' });
    celebrate();
    cannons();
    announcer.say('booth-done');
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
