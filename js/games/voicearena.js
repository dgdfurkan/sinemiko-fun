// Sesle oynanan sıralı düellolar: lobi, mikrofon izni, yazı tura, sıra tanıtımı, canlı tur,
// tur sonucu ve final. Mikrofon yalnızca tur boyunca açık; her tur başında ortam gürültüsü ölçülür.

import { html, Life } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { Stage } from '../ui/stage.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { toast } from '../ui/overlay.js';
import { avatar } from '../ui/avatar.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { announcer } from '../audio/announcer.js';
import { Listener } from '../audio/listen.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, pSpan } from './common.js';
import { withPermissionHint, micErrorSheet } from './mic.js';
import { makeFx, tag, roundRect, PCOL, inked, heartPath, starPath } from './arena.js';

export { tag, roundRect, PCOL, makeFx, inked, heartPath, starPath };

export function voiceDuel(view, { game, navigate }, spec) {
  const life = new Life();
  view.innerHTML = `<section class="screen game game-voice ${spec.cls}"><div class="stage"></div></section>`;
  const root = view.querySelector('.game-voice');
  const stage = new Stage(root.querySelector('.stage'), life);
  const mic = new Listener();
  const cfg = { turns: '2', first: 'random', ...(spec.cfg || {}) };
  const fx = makeFx();
  life.add(() => {
    mic.close();
    music.duck('voiceduel', false);
    document.body.classList.remove('audio-focus');
    scoreboard.hide();
  });
  const better = (a, b) => (spec.lower ? a < b : a > b);
  const fmt = (v) => (spec.fmt ? spec.fmt(v) : String(Math.round(v)));

  const ctx = {
    life, stage, cfg, mic, fx, game,
    m: null,
    // Oyun alanı: sahnenin tamamını kaplayan tuval ve üstündeki yazılar
    playScene(tpl, actions = {}) {
      const scene = stage.show(html`<div class="va-play"><canvas class="va-canvas"></canvas></div>${tpl}`, actions, { className: 'va-scene' });
      const canvas = scene.querySelector('.va-canvas');
      const g = canvas.getContext('2d');
      const out = { scene, g, W: 0, H: 0, dpr: 1 };
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        out.dpr = Math.min(2, window.devicePixelRatio || 1);
        out.W = r.width;
        out.H = r.height;
        canvas.width = Math.max(1, Math.round(r.width * out.dpr));
        canvas.height = Math.max(1, Math.round(r.height * out.dpr));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      stage.own(() => ro.disconnect());
      // Çizim döngüsü: fn(dt, t) false dönerse durur
      out.loop = (fn) => {
        let last = performance.now();
        const stop = life.raf((t) => {
          if (stage.scene !== scene) return false;
          const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
          last = t;
          g.setTransform(out.dpr, 0, 0, out.dpr, 0, 0);
          g.clearRect(0, 0, out.W, out.H);
          try {
            return fn(dt, t) !== false;
          } catch (err) {
            console.error(err);
            return false;
          }
        });
        stage.own(stop);
        return stop;
      };
      return out;
    },
    // Ortam gürültüsü ölçümü: bu sırada sessiz kalınır
    async hush(ms = 700) {
      const list = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        list.push(mic.level());
        await life.sleep(30);
      }
      list.sort((a, b) => a - b);
      mic.calibrate(list[Math.floor(list.length * 0.8)] || 0.004);
    },
  };

  function lobby() {
    ctx.m = null;
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: spec.rules,
      options: html`
        ${spec.options ? spec.options(cfg) : ''}
        ${spec.fixedTurns ? '' : optHTML('Kişi Başı Tur', segHTML('turns', [['1', '1'], ['2', '2'], ['3', '3']], cfg.turns))}
        ${optHTML('İlk Başlayan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
      note: spec.note || 'Ses bu cihazdan çıkmaz, hiçbir yere kaydedilmez.',
    }), { start: () => start() }, { className: 'has-lobby' });
    const keys = ['first', ...(spec.fixedTurns ? [] : ['turns'])];
    const segs = keys.map((k) => bindSeg(scene.querySelector(`[data-seg="${k}"]`), { value: cfg[k], onChange: (v) => { cfg[k] = v; } }));
    stage.own(() => segs.forEach((s) => s.destroy()));
    if (spec.bind) spec.bind(scene, cfg, stage);
  }

  let starting = false;
  async function start() {
    if (starting) return;
    starting = true;
    const btn = stage.scene.querySelector('[data-act="start"], [data-act="again"]');
    if (btn) btn.disabled = true;
    try {
      await withPermissionHint(() => mic.open());
      mic.close();
    } catch (err) {
      starting = false;
      if (btn) btn.disabled = false;
      if (life.alive) micErrorSheet(err);
      return;
    }
    starting = false;
    if (!life.alive) return;
    const per = spec.fixedTurns || Number(cfg.turns);
    ctx.m = { over: false, turn: 0, total: per * 2, first: 0, best: [null, null], sum: [0, 0], log: [[], []] };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${ctx.m.total}` });
    [0, 1].forEach((i) => scoreboard.setText(i, '-'));
    ctx.m.first = cfg.first === 'random' ? await coinFlip(stage, life) : Number(cfg.first);
    if (spec.setup) spec.setup(ctx);
    intro();
  }

  function who() {
    return (ctx.m.first + ctx.m.turn) % 2;
  }

  function intro() {
    const p = who();
    const m = ctx.m;
    scoreboard.setMid(`Tur ${m.turn + 1} / ${m.total}`);
    scoreboard.setActive(p);
    music.duck('voiceduel', false);
    stage.show(html`
      <div class="va-intro-av" data-in>${avatar(p, { mood: 'wow', pose: 'cheer' })}</div>
      <h2 class="t-title" data-in>${pSpan(p)} Sırada</h2>
      <p class="t-lead" data-in>${spec.introText ? spec.introText(ctx, p) : ''}</p>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('mic')}Hazırım</button>`, {
      go: () => run(p),
    });
  }

  async function run(p) {
    music.duck('voiceduel', true);
    let ok = false;
    try {
      ok = await withPermissionHint(() => mic.open());
    } catch (err) {
      if (life.alive) {
        micErrorSheet(err);
        intro();
      }
      return;
    }
    if (!ok || !life.alive) return;
    document.body.classList.add('audio-focus');
    let res = null;
    try {
      res = await spec.turn(ctx, p, Math.floor(ctx.m.turn / 2));
    } catch (err) {
      console.error(err);
    }
    mic.close();
    document.body.classList.remove('audio-focus');
    if (!life.alive) return;
    if (!res) {
      toast('Ses gelmedi. Mikrofona biraz daha yakın dene.', { tone: 'warn' });
      intro();
      return;
    }
    result(p, res);
  }

  function result(p, res) {
    const m = ctx.m;
    music.duck('voiceduel', false);
    m.log[p].push(res.score);
    m.sum[p] += res.score;
    const record = m.best[p] == null || better(res.score, m.best[p]);
    if (record) m.best[p] = res.score;
    const shown = spec.scoring === 'sum' ? m.sum[p] : m.best[p];
    scoreboard.setText(p, fmt(shown));
    const allTime = spec.recordKey && !spec.lower ? store.setBest(spec.recordKey, Math.round(res.score)) : false;
    const last = m.turn + 1 >= m.total;
    stage.show(html`
      <h2 class="t-title" data-in>${res.title || 'Tur Bitti'}</h2>
      <p class="big-stat" data-in><b>${res.big ?? fmt(res.score)}</b> ${res.unit || ''}</p>
      ${res.detail ? html`<p class="t-lead" data-in>${res.detail}</p>` : ''}
      ${allTime ? html`<p class="t-lead t-accent" data-in>Bu tarayıcıdaki rekor!</p>` : ''}
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sıradaki'}${icon('arrow')}</button>`, {
      next: () => {
        m.turn++;
        if (m.turn >= m.total) final();
        else intro();
      },
    });
    if (record) sfx.success();
  }

  function final() {
    const m = ctx.m;
    m.over = true;
    scoreboard.setActive(-1);
    const val = (i) => (spec.scoring === 'sum' ? m.sum[i] : m.best[i] ?? 0);
    const a = val(0);
    const b = val(1);
    const eq = spec.equal ? spec.equal(a, b) : Math.abs(a - b) < 1e-6;
    const rank = eq ? [0, 0] : better(a, b) ? [1, 0] : [0, 1];
    const { html: podium, winner } = versusFinaleHTML(rank, { lines: { tie: spec.tie || 'Berabere!' }, labels: [fmt(a), fmt(b)] });
    announcer.winner(winner);
    stage.show(html`
      ${podium}
      <div class="pop-stats" data-in>${[0, 1].map((i) => html`
        <div class="pop-stat p${i}"><span class="duo-name ${i ? 'name-p2' : 'name-p1'}">${nameOf(i)}</span><span><b>${fmt(val(i))}</b> ${spec.scoring === 'sum' ? 'toplam' : 'en iyi'}</span><span>${m.log[i].map(fmt).join(' · ')}</span></div>`)}</div>
      <div class="row" data-in>
        <button class="btn" data-act="home">${icon('home')}Oyunlara Dön</button>
        <button class="btn btn--primary nudge" data-act="again" data-primary>${icon('replay')}Tekrar Oyna</button>
      </div>`, {
      home: () => navigate('#/'),
      again: () => start(),
    });
    celebrate();
  }

  // Testler oyun durumunu buradan okur
  if (window.__sinemikoDuelHook) window.__sinemikoDuelHook(ctx);
  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!ctx.m && !ctx.m.over,
  };
}
