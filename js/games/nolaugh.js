// Gülme Yasak: biri taş surat olur, öbürü onu güldürmeye çalışır. Kamera gülümsemeyi yakalar

import { html, Life, pick, clamp } from '../lib/dom.js';
import { nameOf, isDefaultName } from '../lib/store.js';
import { fmtSec } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { countdown } from '../ui/countdown.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { JESTER_IDEAS } from '../data/camera.js';
import { lobbyHTML, optHTML, celebrate, versusFinaleHTML, coinFlip, FIRST_OPTIONS, pSpan } from './common.js';
import { camShell, camController, camBoot, waitPlayers, drawFaceFrame, meter, PCOL, albumStripHTML, downloadAlbum } from './cam.js';
import { announcer } from '../audio/announcer.js';
import { smileOf } from '../vision/faces.js';

const CALIB_MS = 2200;
const LAUGH = 0.3;
const LAUGH_MIN = 0.42;
const LAUGH_HOLD = 0.25;

const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function mount(view, { game, navigate }) {
  const life = new Life();
  const shell = camShell(view, 'game-nolaugh');
  const stage = new Stage(shell.stageEl, life);
  const cam = camController(shell, life);
  life.add(() => scoreboard.hide());
  const cfg = { secs: '45', turns: '2', first: 'random' };
  let g = null;

  function lobby() {
    g = null;
    cam.draw = null;
    cam.onFrame = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Yan yana oturun. Sırası gelen taş surat olur; oyun önce onun ciddi yüzünü ölçer.',
        'Öbürü süre bitene kadar ne yaparsa yapsın onu güldürmeye çalışır. Dokunmak yasak, gerisi serbest!',
        'Kamera gülümsemeyi yakalarsa güldüren 1 puan alır. Taş surat dayanırsa puan onun. Fikir lazımsa Fikir Ver düğmesi var.',
      ],
      options: html`
        ${optHTML('Süre', segHTML('secs', [['30', '30 sn'], ['45', '45 sn'], ['60', '60 sn']], cfg.secs))}
        ${optHTML('Kişi Başı Tur', segHTML('turns', [['1', '1'], ['2', '2'], ['3', '3']], cfg.turns))}
        ${optHTML('İlk Taş Surat', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Kamerayı Aç',
      note: 'Görüntü cihazdan çıkmaz. Tarayıcı kamera izni isteyecek.',
    }), { start: () => boot() }, { className: 'has-lobby' });
    const segs = ['secs', 'turns', 'first'].map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
  }

  function boot() {
    camBoot(stage, life, cam, 'face', { onReady: () => ready(), onBack: () => lobby() });
  }

  function ready() {
    cam.onFrame = null;
    cam.draw = (gx, players) => players.forEach((p, i) => { if (p) drawFaceFrame(gx, cam, p, i); });
    waitPlayers(stage, life, cam, {
      title: 'Yüzler Kameraya',
      tip: 'Yan yana oturun, ikiniz de ekrana bakın.',
      onReady: () => play(),
    });
  }

  async function play() {
    const total = Number(cfg.turns) * 2;
    g = { turn: 0, total, album: [], over: false, first: 0 };
    announcer.preload(['turn-0-stone', 'turn-1-stone', 'turn-0-stage', 'turn-1-stage', 'letsgo', 'go-guldur', 'cd-3', 'cd-2', 'cd-1', 'laughed', 'stone']);
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${total}` });
    cam.draw = null;
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Taş Surat?' }) : Number(cfg.first);
    turn();
  }

  // Taş suratın gülmeden önceki yüzünü ölçer; bazı insanlar zaten hafif gülümser
  async function turn() {
    const stone = (g.first + g.turn) % 2;
    const jester = 1 - stone;
    scoreboard.setMid(`Tur ${g.turn + 1} / ${g.total}`);
    scoreboard.setActive(stone);
    const scene = stage.show(html`
      <div class="hud-top" data-in>
        <div class="hud-card">
          <h2 class="t-big">${pSpan(stone)} Taş Surat</h2>
          <p class="hud-tip" data-tip>Ciddi dur, yüzünü ölçüyorum...</p>
        </div>
      </div>`, {}, { className: 'hud' });
    const tip = scene.querySelector('[data-tip]');
    if (isDefaultName(stone)) announcer.say(`turn-${stone}-stone`);
    const samples = [];
    let since = 0;
    cam.draw = (gx, players) => players.forEach((p, i) => {
      if (p) drawFaceFrame(gx, cam, p, i, { label: i === stone ? 'Taş Surat' : 'Güldüren', color: i === stone ? PCOL[i] : '#b8a9c9' });
    });
    await new Promise((resolve) => {
      cam.onFrame = (players, now) => {
        const p = players[stone];
        if (!p) {
          tip.textContent = `${nameOf(stone)}, yüzünü göremiyorum!`;
          samples.length = 0;
          since = 0;
          return;
        }
        tip.textContent = 'Ciddi dur, yüzünü ölçüyorum...';
        if (!since) since = now;
        samples.push(smileOf(p));
        if (now - since >= CALIB_MS) {
          cam.onFrame = null;
          resolve();
        }
      };
    });
    if (!life.alive) return;
    const base = Math.min(0.45, median(samples));
    tip.textContent = `${nameOf(jester)}, sahne senin!`;
    announcer.turn(jester, 'stage');
    await life.sleep(1300);
    await countdown(scene, life, { final: 'Güldür!', voice: 'go-guldur' });
    run(stone, jester, base);
  }

  function run(stone, jester, base) {
    const secs = Number(cfg.secs);
    const st = { elapsed: 0, hold: 0, over: 0, done: false, last: 0 };
    const scene = stage.show(html`
      <div class="hud-top" data-in>
        <div class="nl-clock" data-clock>${secs}</div>
        <p class="hud-pill">${pSpan(jester)} güldürüyor</p>
      </div>
      <div class="hud-bottom" data-in>
        <div class="idea-card" data-idea hidden></div>
        <p class="hud-warn" data-warn></p>
        <button class="btn" data-act="idea" data-silent>${icon('sparkle')}Fikir Ver</button>
      </div>`, {
      idea: () => {
        const box = scene.querySelector('[data-idea]');
        box.hidden = false;
        box.textContent = pick(JESTER_IDEAS.filter((t) => t !== box.textContent));
        box.animate([{ transform: 'scale(.6) rotate(-4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        sfx.sparkle();
      },
    }, { className: 'hud' });
    const clock = scene.querySelector('[data-clock]');
    const warn = scene.querySelector('[data-warn]');
    let shown = secs;

    const finish = (laughed) => {
      if (st.done) return;
      st.done = true;
      cam.onFrame = null;
      const p = cam.players[stone];
      const img = p ? cam.snapshot(p.box, 0.5) : null;
      if (laughed) {
        sfx.buzzer();
        cam.flash();
        announcer.say('laughed');
      } else {
        sfx.whistle();
        announcer.say('stone');
      }
      const winner = laughed ? jester : stone;
      g.album.push({ img, cap: laughed ? 'Güldü!' : 'Taş Surat', by: nameOf(stone), color: PCOL[stone] });
      life.timeout(() => result(stone, jester, winner, laughed, st.elapsed, img), laughed ? 700 : 300);
    };

    cam.onFrame = (players, now) => {
      const dt = st.last ? Math.min(0.12, (now - st.last) / 1000) : 0;
      st.last = now;
      const p = players[stone];
      // Taş surat kadrajdan kaçarsa süre durur
      if (!p || !cam.visible(stone, 400)) {
        warn.textContent = `${nameOf(stone)} yüzünü göster! Süre durdu.`;
        clock.classList.add('paused');
        st.hold = 0;
        return;
      }
      warn.textContent = '';
      clock.classList.remove('paused');
      st.elapsed += dt;
      const s = smileOf(p);
      st.over = s - base;
      const laughing = st.over >= LAUGH && s >= LAUGH_MIN;
      st.hold = laughing ? st.hold + dt : Math.max(0, st.hold - dt * 2);
      const left = Math.max(0, secs - st.elapsed);
      const sec = Math.ceil(left);
      if (sec !== shown) {
        shown = sec;
        clock.textContent = String(sec);
        if (sec <= 5 && sec > 0) {
          sfx.tick(5 - sec);
          clock.classList.add('hurry');
        }
      }
      if (st.hold >= LAUGH_HOLD) finish(true);
      else if (left <= 0) finish(false);
    };

    cam.draw = (gx, players) => players.forEach((p, i) => {
      if (!p) return;
      if (i !== stone) {
        drawFaceFrame(gx, cam, p, i, { label: 'Güldüren', color: '#b8a9c9' });
        return;
      }
      const v = clamp(st.over / LAUGH, 0, 1);
      const danger = v > 0.6;
      drawFaceFrame(gx, cam, p, i, { label: danger ? 'Dayan!' : 'Taş Surat', glow: v, color: danger ? '#ff4f62' : PCOL[i] });
      meter(gx, cam, p, v, danger ? '#ff4f62' : PCOL[i], { label: 'Gülme Ölçer' });
    });
  }

  function result(stone, jester, winner, laughed, elapsed, img) {
    cam.draw = null;
    const last = g.turn + 1 >= g.total;
    const scene = stage.show(html`
      <div class="polaroid big nl-pol ${laughed ? '' : 'calm'}" data-in>
        ${img ? html`<img src="${img}" alt="${nameOf(stone)}">` : html`<div class="polaroid-empty">Fotoğraf yok</div>`}
        <span class="polaroid-cap">${laughed ? 'Yakalandın!' : 'Taş Gibi!'}</span>
        <span class="polaroid-by">${nameOf(stone)}, ${fmtSec(elapsed)} dayandı</span>
      </div>
      <h2 class="t-title" data-in>${laughed ? html`${pSpan(jester)} Güldürdü!` : html`${pSpan(stone)} Gülmedi!`}</h2>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki Tur'}${icon('arrow')}</button>`, {
      next: () => {
        g.turn++;
        if (g.turn >= g.total) final();
        else turn();
      },
    });
    const pol = scene.querySelector('.polaroid');
    const r = pol.getBoundingClientRect();
    scoreboard.add(winner, 1, pol);
    burst(r.left + r.width / 2, r.top + r.height / 3, { count: 60, power: 14, colors: [PCOL[winner], '#ffcd3c', '#fff'] });
    sfx.success();
  }

  function final() {
    g.over = true;
    cam.onFrame = null;
    cam.draw = null;
    scoreboard.setActive(-1);
    const { html: podium, winner } = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! Kimse Kimseden Komik Değil' } });
    announcer.winner(winner);
    const album = g.album.filter((a) => a.img);
    stage.show(html`
      ${podium}
      ${album.length ? albumStripHTML(album.slice(-12)) : ''}
      <div class="row" data-in>
        ${album.length ? html`<button class="btn" data-act="dl">${icon('download')}Gülme Albümü</button>` : ''}
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      dl: () => downloadAlbum('Gülme Yasak', album, 'sinemiko-gulme-yasak.jpg'),
      home: () => navigate('#/'),
      again: () => ready(),
    }, { className: 'cam-final' });
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
