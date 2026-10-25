// Tekerleme Düellosu: aynı tekerlemeyi ikiniz de söylersiniz, hatasız ve en hızlı olan turu alır

import { html, Life, shuffle } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { fmtSec } from '../lib/text.js';
import { Stage } from '../ui/stage.js';
import { avatar } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { scoreboard } from '../ui/scoreboard.js';
import { segHTML, bindSeg, stepperHTML, bindStepper } from '../ui/controls.js';
import { VoiceRecorder, voicedDuration } from '../audio/recorder.js';
import { stopClip } from '../audio/clip.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { TWISTERS } from '../data/voice.js';
import { lobbyHTML, optHTML, FIRST_OPTIONS, coinFlip, celebrate, versusFinaleHTML, finaleButtons, other, pSpan } from './common.js';
import { micGate, miniPlayer, recordScene } from './mic.js';

export function mount(view, { game, navigate }) {
  const life = new Life();
  view.innerHTML = '<section class="screen game game-twister"><div class="stage"></div></section>';
  const stage = new Stage(view.querySelector('.stage'), life);
  const rec = new VoiceRecorder();
  life.add(() => {
    rec.close();
    stopClip();
    music.duck('twister', false);
    scoreboard.hide();
  });
  const cfg = { rounds: 3, first: 'random' };
  let g = null;
  let starting = false;

  function lobby() {
    g = null;
    music.duck('twister', false);
    scoreboard.hide();
    const scene = stage.show(lobbyHTML({
      game,
      rules: [
        'Her turda bir tekerleme çıkar. İkiniz de sırayla mikrofona söylersiniz.',
        'Oyun, söylemenin kaç saniye sürdüğünü kayıttan ölçer.',
        'Diğeriniz hata olup olmadığına karar verir. Hatasız ve en hızlı olan turu alır.',
      ],
      options: html`
        ${optHTML('Tur Sayısı', stepperHTML('rounds', cfg.rounds))}
        ${optHTML('İlk Başlayan', segHTML('first', FIRST_OPTIONS(), cfg.first))}`,
      start: 'Mikrofonu Aç ve Başla',
      startIcon: 'mic',
    }), { start: () => startGame() }, { className: 'has-lobby' });
    bindStepper(scene.querySelector('[data-stepper="rounds"]'), { value: cfg.rounds, min: 2, max: 10, onChange: (v) => { cfg.rounds = v; } });
    const seg = bindSeg(scene.querySelector('[data-seg="first"]'), { value: cfg.first, onChange: (v) => { cfg.first = v; } });
    stage.own(() => seg.destroy());
  }

  async function startGame() {
    if (starting) return;
    starting = true;
    const btn = stage.scene.querySelector('[data-act="start"], [data-act="again"]');
    if (btn) btn.disabled = true;
    const ok = await micGate(rec, life);
    starting = false;
    if (!ok) {
      if (life.alive && btn) btn.disabled = false;
      return;
    }
    g = { round: 0, total: cfg.rounds, first: 0, deck: shuffle(TWISTERS), over: false, best: [Infinity, Infinity] };
    scoreboard.show({ mode: 'versus', mid: `Tur 1 / ${g.total}` });
    g.first = cfg.first === 'random' ? await coinFlip(stage, life, { title: 'İlk Kim Söylüyor?' }) : Number(cfg.first);
    newRound();
  }

  function newRound() {
    if (!g.deck.length) g.deck = shuffle(TWISTERS);
    const p = (g.first + g.round) % 2;
    g.cur = { text: g.deck.pop(), order: [p, other(p)], idx: 0, runs: [null, null] };
    scoreboard.setMid(`Tur ${g.round + 1} / ${g.total}`);
    intro();
  }

  const twisterCard = (text, cls = '') => html`<div class="twister-card card ${cls}" data-in><span class="wc-cat">Tekerleme</span><p class="tw-text">${text}</p></div>`;

  function intro() {
    const c = g.cur;
    const p = c.order[c.idx];
    scoreboard.setActive(p);
    music.duck('twister', false);
    stage.show(html`
      <p class="t-hand" data-in>${c.idx ? 'Şimdi sıra diğerinde' : 'Bu turun tekerlemesi'}</p>
      ${twisterCard(c.text)}
      <div class="qz-head" data-in>${avatar(p, { mood: 'smirk', pose: 'mic', props: 'mic' })}<p class="t-lead">${nameOf(p)}, önce bir kere sessizce oku. Hazır olunca kayda başla ve olabildiğince hızlı söyle.</p></div>
      <button class="btn btn--primary btn--big nudge" data-act="go" data-primary data-once>${icon('mic')}${nameOf(p)} Hazır</button>`, {
      go: () => recordRun(p),
    });
  }

  function recordRun(p) {
    const c = g.cur;
    recordScene(stage, life, rec, {
      who: p,
      heading: `${nameOf(p)}, Hızlı ve Hatasız!`,
      extra: twisterCard(c.text, 'small'),
      duckKey: 'twister',
      maxSec: 15,
      onDone: (buf) => {
        const time = voicedDuration(buf.getChannelData(0), buf.sampleRate);
        c.runs[p] = { time, ok: null, clip: buf };
        judge(p);
      },
    });
  }

  function judge(p) {
    const c = g.cur;
    const run = c.runs[p];
    const j = other(p);
    const scene = stage.show(html`
      <p class="big-stat" data-in><b>${fmtSec(run.time).replace(' sn', '')}</b> saniye</p>
      <div class="mini-clips two" data-in>
        <button class="mini-clip" data-act="mc" data-r="1" data-silent><span class="mc-ic">${icon('play')}</span>Dinle<span class="mc-bar"></span></button>
        <button class="mini-clip" data-act="mc" data-r="1.8" data-silent><span class="mc-ic">${icon('sparkle')}</span>Sincap Hızında<span class="mc-bar"></span></button>
      </div>
      <div class="qz-head" data-in>${avatar(j, { mood: 'smirk', pose: 'think' })}<p class="t-hand">${nameOf(j)}, karar senin: hatasız mıydı?</p></div>
      <div class="row" data-in>
        <button class="btn btn--bad" data-act="bad" data-once>${icon('x')}Hata Var</button>
        <button class="btn btn--good btn--big" data-act="good" data-primary data-once>${icon('check')}Hatasız</button>
      </div>`, {
      mc: (b) => play(b, run.clip, Number(b.dataset.r)),
      good: () => decide(true),
      bad: () => decide(false),
    });
    const play = miniPlayer(scene);

    function decide(ok) {
      if (run.ok !== null) return;
      run.ok = ok;
      stopClip();
      if (ok) {
        sfx.success();
        g.best[p] = Math.min(g.best[p], run.time);
      } else {
        sfx.boing();
      }
      c.idx++;
      if (c.idx < 2) intro();
      else result();
    }
  }

  function result() {
    const c = g.cur;
    const [a, b] = c.runs;
    let winners = [];
    if (a.ok && b.ok) {
      if (Math.abs(a.time - b.time) < 0.05) winners = [0, 1];
      else winners = [a.time < b.time ? 0 : 1];
    } else if (a.ok) winners = [0];
    else if (b.ok) winners = [1];
    const last = g.round + 1 >= g.total;
    const maxT = Math.max(a.time, b.time, 0.1);
    const bar = (i) => {
      const r = c.runs[i];
      return html`<div class="tw-bar p${i} ${winners.includes(i) ? 'win' : ''} ${r.ok ? '' : 'bad'}">
        ${avatar(i, winners.includes(i) ? { mood: 'laugh', eyes: 'happy', props: 'crown' } : { mood: r.ok ? 'smirk' : 'sad' })}
        <div class="tw-track"><span class="tw-fill" style="--w:${(r.time / maxT).toFixed(3)}"></span></div>
        <span class="tw-time">${r.ok ? fmtSec(r.time) : 'Hatalı'}</span>
      </div>`;
    };
    const title = !winners.length ? 'İkiniz de Takıldınız!' : winners.length === 2 ? 'Berabere!' : html`${pSpan(winners[0])} Kazandı!`;
    const scene = stage.show(html`
      ${twisterCard(c.text, 'small')}
      <h2 class="t-title" data-in>${title}</h2>
      <div class="tw-bars" data-in>${bar(0)}${bar(1)}</div>
      <button class="btn btn--primary btn--big nudge" data-act="next" data-primary data-once>${last ? 'Sonuçları Gör' : 'Sonraki Tekerleme'}${icon('arrow')}</button>`, {
      next: () => {
        g.round++;
        if (g.round >= g.total) final();
        else newRound();
      },
    });
    winners.forEach((w) => {
      const el = scene.querySelector(`.tw-bar.p${w}`);
      scoreboard.add(w, 1, el);
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 50, power: 12 });
    });
    if (winners.length) sfx.fanfare();
    else sfx.fail();
  }

  function final() {
    g.over = true;
    scoreboard.setActive(-1);
    const fin = versusFinaleHTML(scoreboard.scores, { lines: { tie: 'Berabere! İki Dil Ustası' } });
    const best = (i) => (Number.isFinite(g.best[i]) ? fmtSec(g.best[i]) : 'hatasız deneme yok');
    stage.show(html`
      ${fin.html}
      <p class="t-lead" data-in>En hızlı hatasız denemeler: ${nameOf(0)} ${best(0)}, ${nameOf(1)} ${best(1)}.</p>
      ${finaleButtons()}`, {
      home: () => navigate('#/'),
      again: () => startGame(),
    });
    celebrate();
  }

  lobby();
  return {
    unmount: () => life.dispose(),
    inProgress: () => !!g && !g.over,
  };
}
