// Yalan Dedektörü: cevaplayana gizlice "doğruyu söyle" ya da "yalan söyle" görevi çıkar.
// Kamera göz kırpma, bakış kaçırma, dudak sıkma gibi işaretleri yalan makinesi gibi çizer; öbürü tahmin eder.
// TikTok'taki "Lying Challenge" akımının dedektörlü hali. Dedektör eğlence içindir, puanı tahmin belirler.

import { html, toHTML, Life, shuffle, clamp, rand } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';
import { announcer } from '../audio/announcer.js';
import { burst } from '../fx/confetti.js';
import { LIAR_QUESTIONS } from '../data/camera.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, coinFlip, FIRST_OPTIONS, pSpan, flipEl } from './common.js';
import { camShell, camController, camBoot, waitPlayers, missingText, drawFaceFrame, roundRect, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { blinkOf, smileOf } from '../vision/faces.js';

const LISTEN_SEC = 8;
const B = (p, k) => (p.blend && p.blend[k]) || 0;

// Anlık "stres" işareti: bakış kaçırma, dudak sıkma, kaş kaldırma, bastırılmış gülümseme, baş hareketi
function signal(p, prev) {
  const gaze = Math.max(
    (B(p, 'eyeLookOutLeft') + B(p, 'eyeLookInRight')) / 2,
    (B(p, 'eyeLookInLeft') + B(p, 'eyeLookOutRight')) / 2,
    (B(p, 'eyeLookDownLeft') + B(p, 'eyeLookDownRight')) / 2,
  );
  const press = (B(p, 'mouthPressLeft') + B(p, 'mouthPressRight')) / 2 + B(p, 'mouthRollLower') * 0.5;
  const brow = B(p, 'browInnerUp');
  const smile = smileOf(p);
  const move = prev ? Math.hypot(p.box.cx - prev.cx, p.box.cy - prev.cy) * 30 : 0;
  return clamp(gaze * 0.9 + press * 0.8 + brow * 0.5 + smile * 0.4 + move, 0, 1.6);
}

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-liar');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { turns: '3', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Yan yana oturun. Sırası gelen cevaplar, öbürü sorgular.',
        'Sorgulayan arkasını döner; cevaplayana gizlice “Doğruyu Söyle” ya da “Yalan Söyle” görevi çıkar.',
        'Soruyu yüksek sesle cevapla. Dedektör yüzünü okur, sorgulayan “Doğru mu, yalan mı?” der. Bilen puanı alır, kandıran da!',
      ],
      options: html`
        ${optHTML('Kişi Başı Soru', segHTML('turns', [['2', '2'], ['3', '3'], ['4', '4']], cfg.turns))}
        ${optHTML('İlk Cevaplayan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Kamerayı Aç',
      note: 'Dedektör eğlence içindir, gerçek bir yalan makinesi değildir.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const segs = ['turns', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  function boot() {
    camBoot(stage, life, cam, 'face', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Sorgu Odası',
      tip: 'Yan yana oturun, yüzleriniz kameraya baksın.',
      onReady: () => play(),
    });
  }

  async function play() {
    const total = Number(cfg.turns) * 2;
    g = { turn: 0, total, deck: shuffle(LIAR_QUESTIONS), album: [], over: false, first: 0 };
    scoreboard.show({ mode: 'versus', mid: `Soru 1 / ${total}` });
    announcer.preload(['liar-q', 'liar-caught', 'liar-fooled', 'liar-true']);
    cam.draw = null;
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Sorgulanıyor?' }) : Number(cfg.first);
    secret();
  }

  // Gizli görev: sorgulayan bakmıyorken cevaplayana gösterilir
  function secret() {
    const ans = (g.first + g.turn) % 2;
    const ask = 1 - ans;
    const lie = Math.random() < 0.5;
    if (!g.deck.length) g.deck = shuffle(LIAR_QUESTIONS);
    const q = g.deck.pop();
    scoreboard.setMid(`Soru ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(ans);
    cam.draw = null;
    const scene = stage.show(html`
      <h2 class="t-title" data-in>${pSpan(ans)} Sorgulanıyor</h2>
      <p class="t-lead" data-in>${nameOf(ask)}, arkanı dön ve ekrana bakma!</p>
      <div class="secret-card card" data-in data-card>
        <span class="sc-lock">${icon('lock')}</span>
        <b>Gizli Görev</b>
        <span>Yalnızca ${nameOf(ans)} baksın</span>
      </div>
      <button class="btn btn--primary btn--big nudge" data-act="show" data-primary data-once>${icon('eyeOff')}Görevi Göster</button>`, {
      show: async () => {
        const card = scene.querySelector('[data-card]');
        await flipEl(card, () => {
          card.classList.add(lie ? 'lie' : 'truth');
          card.innerHTML = toHTML(html`<b>${lie ? 'Yalan Söyle' : 'Doğruyu Söyle'}</b><span>${lie ? 'İnandırıcı ol, yüzün seni ele vermesin!' : 'Dürüst ol ama şüpheli görünebilirsin!'}</span>`);
        });
        if (stage.scene !== scene) return;
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = '<button class="btn btn--primary btn--big nudge" data-act="hide" data-primary data-once>Tamam, Gizle</button>';
        scene.querySelector('[data-act="show"]').replaceWith(row);
      },
      hide: async () => {
        const card = scene.querySelector('[data-card]');
        await flipEl(card, () => {
          card.className = 'secret-card card';
          card.innerHTML = toHTML(html`<span class="sc-lock">${icon('lock')}</span><b>Görev Gizlendi</b><span>${nameOf(ask)}, artık dönebilirsin!</span>`);
        });
        if (stage.scene !== scene) return;
        sfx.ding();
        life.timeout(() => { if (stage.scene === scene) interrogate(ans, ask, q, lie); }, 1400);
      },
    });
  }

  function interrogate(ans, ask, q, lie) {
    const trace = [];
    let peak = 0;
    let peakImg = null;
    let shotAt = 0;
    let prevBox = null;
    let blinkPrev = 0;
    let listening = false;
    let t0 = 0;
    const scene = stage.show(html`
      <div class="hud-top" data-in>
        <div class="hud-card liar-q">
          <span class="lq-who">${pSpan(ask)} soruyor</span>
          <h2 class="t-big">${q}</h2>
          <p class="hud-tip" data-tip>${nameOf(ans)}, yüksek sesle cevapla. Dedektör dinliyor...</p>
        </div>
      </div>
      <div class="hud-bottom" data-in>
        <p class="hud-warn" data-warn></p>
        <div class="row liar-vote" data-vote hidden>
          <button class="btn btn--good" data-act="vote" data-v="0">${icon('check')}Doğru</button>
          <button class="btn btn--bad" data-act="vote" data-v="1">${icon('x')}Yalan</button>
        </div>
      </div>`, {
      vote: (b) => {
        const said = b.dataset.v === '1';
        reveal(ans, ask, q, lie, said, trace, peakImg);
      },
    }, { className: 'hud' });
    const warn = scene.querySelector('[data-warn]');
    const tip = scene.querySelector('[data-tip]');
    sfx.whoosh();

    life.timeout(() => {
      if (stage.scene !== scene) return;
      listening = true;
      t0 = performance.now();
    }, 500);
    life.timeout(() => {
      if (stage.scene !== scene) return;
      listening = false;
      cam.onFrame = null;
      tip.textContent = `${nameOf(ask)}, karar senin!`;
      scene.querySelector('[data-vote]').hidden = false;
      announcer.say('liar-q');
      sfx.drumroll();
    }, 500 + LISTEN_SEC * 1000);

    cam.onFrame = (players, now) => {
      warn.textContent = missingText(cam, [ans]);
      if (!listening) return;
      const p = players[ans];
      if (!p) return;
      let v = signal(p, prevBox);
      prevBox = { cx: p.box.cx, cy: p.box.cy };
      // Göz kırpma anı grafikte iğne gibi sıçrar
      const bl = blinkOf(p);
      if (bl > 0.5 && blinkPrev <= 0.5) v += 0.6;
      blinkPrev = bl;
      v = clamp(v + rand(-0.04, 0.04), 0, 1.8);
      trace.push({ t: (now - t0) / 1000, v });
      // En gergin an fotoğraflanır; çekim pahalı olduğu için belirgin yeni zirvede ve en sık 0,7 saniyede bir
      if (v > peak + 0.08 && now - shotAt > 700) {
        peak = v;
        shotAt = now;
        peakImg = cam.snapshot(p.box, 0.45);
      } else if (v > peak) {
        peak = v;
      }
    };

    cam.draw = (gx, players) => {
      players.forEach((p, i) => {
        if (!p) return;
        drawFaceFrame(gx, cam, p, i, { label: i === ans ? 'Sorgulanan' : 'Sorgulayan', color: i === ans ? PCOL[i] : '#b8a9c9', glow: i === ans ? 0.4 : 0 });
      });
      drawPolygraph(gx, trace);
    };
  }

  // Yalan makinesi kâğıdı: kayan çizgi, ızgara ve iğne
  function drawPolygraph(gx, trace) {
    const W = Math.min(cam.W * 0.62, 620);
    const H = Math.min(cam.H * 0.2, 130);
    const x = (cam.W - W) / 2;
    const y = cam.H - H - 18;
    roundRect(gx, x, y, W, H, 16);
    gx.fillStyle = '#fffcf3ee';
    gx.fill();
    gx.lineWidth = 4;
    gx.strokeStyle = '#2a1636';
    gx.stroke();
    gx.save();
    roundRect(gx, x, y, W, H, 16);
    gx.clip();
    gx.strokeStyle = '#ff5fa233';
    gx.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      gx.beginPath();
      gx.moveTo(x + (W * k) / 8, y);
      gx.lineTo(x + (W * k) / 8, y + H);
      gx.stroke();
    }
    for (let k = 1; k < 4; k++) {
      gx.beginPath();
      gx.moveTo(x, y + (H * k) / 4);
      gx.lineTo(x + W, y + (H * k) / 4);
      gx.stroke();
    }
    if (trace.length > 1) {
      const span = LISTEN_SEC;
      gx.beginPath();
      trace.forEach((pt, k) => {
        const px = x + (pt.t / span) * W;
        const py = y + H * 0.82 - (pt.v / 1.8) * H * 0.7 + Math.sin(k * 1.7) * 3;
        if (k === 0) gx.moveTo(px, py);
        else gx.lineTo(px, py);
      });
      gx.lineWidth = 3;
      gx.strokeStyle = '#ff4f62';
      gx.lineJoin = 'round';
      gx.stroke();
    }
    gx.restore();
    gx.font = '400 15px "Lilita One", sans-serif';
    gx.fillStyle = '#2a1636';
    gx.textAlign = 'left';
    gx.textBaseline = 'top';
    gx.fillText('DEDEKTÖR', x + 12, y + 8);
  }

  function reveal(ans, ask, q, lie, said, trace, img) {
    cam.onFrame = null;
    cam.draw = null;
    const avg = trace.length ? trace.reduce((s, x) => s + x.v, 0) / trace.length : 0.4;
    const peak = trace.reduce((m, x) => Math.max(m, x.v), 0);
    const pct = clamp(Math.round(22 + avg * 70 + peak * 12 + rand(-6, 6)), 4, 97);
    const correct = said === lie;
    const winner = correct ? ask : ans;
    if (img) g.album.push({ img, cap: lie ? (correct ? 'Yalanı Yakalandı!' : 'Kandırdı!') : 'Doğruyu Söyledi', by: nameOf(ans), color: PCOL[ans] });
    const scene = stage.show(html`
      <div class="liar-reveal" data-in>
        <div class="polaroid nl-pol ${lie ? '' : 'calm'}">
          ${img ? html`<img src="${img}" alt="${nameOf(ans)}">` : html`<div class="polaroid-empty">Fotoğraf yok</div>`}
          <span class="polaroid-cap">${lie ? 'Yalan Söyledi!' : 'Doğruyu Söyledi'}</span>
          <span class="polaroid-by">${nameOf(ans)}</span>
        </div>
        <div class="liar-gauge card">
          <span class="lg-title">Dedektörün Kararı</span>
          <span class="lg-num">%${pct}</span>
          <span class="lg-say">${pct >= 50 ? 'yalan diyor' : 'doğru diyor'}</span>
          <span class="lg-bar"><i style="width:${pct}%"></i></span>
          <span class="lg-note">${(pct >= 50) === lie ? 'Dedektör de bildi!' : 'Dedektör yanıldı!'}</span>
        </div>
      </div>
      <h2 class="t-title" data-in>${correct ? html`${pSpan(ask)} Bildi!` : html`${pSpan(ans)} Kandırdı!`}</h2>
      <p class="t-lead" data-in>“${q}” ${nameOf(ask)} ${said ? 'yalan' : 'doğru'} dedi, gerçek ise ${lie ? 'yalandı' : 'doğruydu'}.</p>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>Devam${icon('arrow')}</button>`, {
      next: () => {
        g.turn++;
        if (g.turn >= g.total) final();
        else secret();
      },
    });
    const pol = scene.querySelector('.polaroid');
    const r = pol.getBoundingClientRect();
    scoreboard.add(winner, 1, pol);
    burst(r.left + r.width / 2, r.top + r.height / 3, { count: 50, power: 12, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
    announcer.say(correct ? (lie ? 'liar-caught' : 'liar-true') : 'liar-fooled');
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    scoreboard.setActive(-1);
    const { html: podium, winner } = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İkiniz De Usta Yalancı' } });
    const album = g.album.filter((a) => a.img);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album.slice(-10)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}8K Albüm İndir</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Yalan Dedektörü', album, 'sinemiko-yalan-dedektoru.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final' });
    celebrate();
    announcer.winner(winner);
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
