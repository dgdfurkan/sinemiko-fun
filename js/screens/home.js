// Ana menü: logo, iki karakter ve oyun rafı

import { html, toHTML, Life } from '../lib/dom.js';
import { nameOf, store } from '../lib/store.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { GAMES, TABS } from '../games/registry.js';
import { artFor } from './art.js';

const LOGO_COLORS = ['#ff5fa2', '#ffcd3c', '#2ed6a0', '#4fb6ff', '#a98bff', '#ff8a3d', '#ff4f62', '#ff5fa2'];

export function logoHTML(cls = '') {
  const letters = [...'Sinemiko'].map((ch, i) => html`<span class="ch" style="--c:${LOGO_COLORS[i]};--i:${i};--r:${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg">${ch}</span>`);
  return html`<h1 class="logo ${cls}" aria-label="Sinemiko Fun"><span class="logo-word">${letters}</span><span class="logo-fun">Fun</span></h1>`;
}

const TILTS = ['-1.4deg', '1.2deg', '-.8deg', '1.6deg', '.9deg', '-1.5deg', '1deg'];

// Sekmeye göre yerleşim: öne çıkan kart, uzun açıklama ve ızgara biçimi
const LAYOUT = {
  all: { featured: false, roomy: false },
  kamera: { featured: false, roomy: true },
  ses: { featured: true, roomy: false },
  yarisma: { featured: false, roomy: true },
  ikimiz: { featured: true, roomy: false },
};

function cardHTML(g, i, tab) {
  const lay = LAYOUT[tab];
  const featured = lay.featured && i === 0;
  const long = featured || lay.roomy;
  return html`
    <button class="gcard ${featured ? 'featured' : ''} ${g.dark ? 'dark' : ''}" data-game="${g.id}" style="--gc:${g.card};--tilt:${TILTS[i % TILTS.length]};--d:${i * 35}ms">
      <span class="gcard-dots" aria-hidden="true"></span>
      ${g.isNew ? html`<span class="gcard-new" aria-hidden="true">Yeni</span>` : ''}
      ${g.tags.length ? html`<span class="gcard-tags">${g.tags.map(([ic, t]) => html`<span class="tag" title="${t}">${icon(ic)}<span class="tag-t">${t}</span></span>`)}</span>` : ''}
      <span class="gcard-art">${artFor(g.id)}</span>
      <span class="gcard-text">
        <span class="gcard-title">${g.title}</span>
        <span class="gcard-desc ${long ? 'long' : ''}">${long ? g.desc : g.tagline}</span>
      </span>
      <span class="gcard-go" aria-hidden="true">${icon('arrow')}</span>
    </button>`;
}

const gamesOf = (tab) => (tab === 'all' ? GAMES : GAMES.filter((g) => g.cat === tab));

const tabsHTML = (cur) => html`
  <div class="home-tabs ctl" role="tablist" aria-label="Oyun kategorileri">
    <span class="ht-thumb"></span>
    ${TABS.map(([id, label, ic]) => html`<button class="ht ${id === cur ? 'on' : ''}" role="tab" aria-selected="${String(id === cur)}" data-tab="${id}">${icon(ic)}<span>${label}</span><b>${gamesOf(id).length}</b></button>`)}
  </div>`;

export function mountHome(view, { navigate }) {
  const life = new Life();
  const saved = store.get('homeTab');
  let tab = TABS.some(([id]) => id === saved) ? saved : 'all';
  view.innerHTML = toHTML(html`
    <section class="screen home">
      <div class="home-hero">
        <div class="home-brand">
          ${logoHTML()}
          <p class="home-tag t-hand">Bu gece ne oynuyoruz?
            <svg class="home-arrow" viewBox="0 0 90 60" aria-hidden="true"><path d="M6 8c22 2 44 12 56 36M50 40l13 6 4-14" fill="none" stroke="#2a1636" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </p>
        </div>
        ${tabsHTML(tab)}
        <div class="home-duo">
          <button class="duo-p hit" data-who="0" aria-label="${nameOf(0)}">${avatar(0, { mood: 'happy' })}<span class="duo-name name-p1">${nameOf(0)}</span></button>
          <span class="duo-heart" aria-hidden="true">${icon('heart')}</span>
          <button class="duo-p hit" data-who="1" aria-label="${nameOf(1)}">${avatar(1, { mood: 'happy' })}<span class="duo-name name-p2">${nameOf(1)}</span></button>
        </div>
      </div>
      <div class="home-grid" data-layout="${tab}">${gamesOf(tab).map((g, i) => cardHTML(g, i, tab))}</div>
    </section>`);

  const root = view.querySelector('.home');
  const grid = root.querySelector('.home-grid');
  const tabs = root.querySelector('.home-tabs');
  const thumb = tabs.querySelector('.ht-thumb');
  const TAB_COLORS = { all: '#ff5fa2', kamera: '#7a5cff', ses: '#ff9f1c', yarisma: '#4fb6ff', ikimiz: '#ff4f62' };
  const placeThumb = (instant) => {
    const on = tabs.querySelector('.ht.on');
    if (!on) return;
    thumb.style.background = TAB_COLORS[tab];
    if (instant) thumb.style.transition = 'none';
    thumb.style.left = `${on.offsetLeft}px`;
    thumb.style.width = `${on.offsetWidth}px`;
    if (instant) {
      void thumb.offsetWidth;
      thumb.style.transition = '';
    }
  };
  requestAnimationFrame(() => placeThumb(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (life.alive) placeThumb(true); });
  const ro = new ResizeObserver(() => placeThumb(true));
  ro.observe(tabs);
  life.add(() => ro.disconnect());

  let switching = false;
  async function setTab(next) {
    if (next === tab || switching) return;
    switching = true;
    tab = next;
    store.set('homeTab', tab);
    sfx.soft();
    tabs.querySelectorAll('.ht').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    placeThumb(false);
    const out = grid.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(18px) scale(.97)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    await out.finished.catch(() => {});
    if (!life.alive) return;
    grid.dataset.layout = tab;
    grid.innerHTML = toHTML(html`${gamesOf(tab).map((g, i) => cardHTML(g, i, tab))}`);
    out.cancel();
    grid.scrollTop = 0;
    root.scrollTop = 0;
    window.dispatchEvent(new Event('sf:scene'));
    switching = false;
  }

  life.on(root, 'click', (e) => {
    const tb = e.target.closest('.ht');
    if (tb) {
      setTab(tb.dataset.tab);
      return;
    }
    const card = e.target.closest('.gcard');
    if (card) {
      sfx.click();
      const r = card.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2;
      const y = e.clientY || r.top + r.height / 2;
      navigate(`#/oyun/${card.dataset.game}`, { x, y });
      return;
    }
    const duo = e.target.closest('.duo-p');
    if (duo) {
      const svg = duo.querySelector('.blob');
      setBlob(svg, { mood: 'laugh', eyes: 'happy', props: 'heart' });
      react(svg, 'jump');
      sfx.heart();
      const r = svg.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * 0.3, { count: 14, power: 6, shapes: ['heart'], colors: ['#ff5fa2', '#ff8fc0'], gravity: 0.1, size: [10, 16] });
      life.timeout(() => setBlob(svg, { mood: 'happy', eyes: 'open', props: '' }), 1400);
    }
  });

  return { unmount: () => life.dispose() };
}
