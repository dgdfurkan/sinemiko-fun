// Ana menü: logo, iki karakter ve oyun rafı

import { html, toHTML, Life } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar, setBlob, react } from '../ui/avatar.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { GAMES } from '../games/registry.js';
import { artFor } from './art.js';

const LOGO_COLORS = ['#ff5fa2', '#ffcd3c', '#2ed6a0', '#4fb6ff', '#a98bff', '#ff8a3d', '#ff4f62', '#ff5fa2'];

export function logoHTML(cls = '') {
  const letters = [...'Sinemiko'].map((ch, i) => html`<span class="ch" style="--c:${LOGO_COLORS[i]};--i:${i};--r:${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg">${ch}</span>`);
  return html`<h1 class="logo ${cls}" aria-label="Sinemiko Fun"><span class="logo-word">${letters}</span><span class="logo-fun">Fun</span></h1>`;
}

const TILTS = ['-1.4deg', '1.2deg', '-.8deg', '1.6deg', '.9deg', '-1.5deg', '1deg'];

function cardHTML(g, i) {
  return html`
    <button class="gcard ${i === 0 ? 'featured' : ''} ${g.dark ? 'dark' : ''}" data-game="${g.id}" style="--gc:${g.card};--tilt:${TILTS[i % TILTS.length]};--d:${i * 45}ms">
      <span class="gcard-dots" aria-hidden="true"></span>
      ${g.isNew ? html`<span class="gcard-new" aria-hidden="true">Yeni</span>` : ''}
      ${g.tags.length ? html`<span class="gcard-tags">${g.tags.map(([ic, t]) => html`<span class="tag">${icon(ic)}${t}</span>`)}</span>` : ''}
      <span class="gcard-art">${artFor(g.id)}</span>
      <span class="gcard-text">
        <span class="gcard-title">${g.title}</span>
        <span class="gcard-desc">${i === 0 ? g.desc : g.tagline}</span>
      </span>
      <span class="gcard-go" aria-hidden="true">${icon('arrow')}</span>
    </button>`;
}

export function mountHome(view, { navigate }) {
  const life = new Life();
  view.innerHTML = toHTML(html`
    <section class="screen home">
      <div class="home-hero">
        <div class="home-brand">
          ${logoHTML()}
          <p class="home-tag t-hand">Bu gece ne oynuyoruz?
            <svg class="home-arrow" viewBox="0 0 90 60" aria-hidden="true"><path d="M6 8c22 2 44 12 56 36M50 40l13 6 4-14" fill="none" stroke="#2a1636" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </p>
        </div>
        <div class="home-duo">
          <button class="duo-p hit" data-who="0" aria-label="${nameOf(0)}">${avatar(0, { mood: 'happy' })}<span class="duo-name name-p1">${nameOf(0)}</span></button>
          <span class="duo-heart" aria-hidden="true">${icon('heart')}</span>
          <button class="duo-p hit" data-who="1" aria-label="${nameOf(1)}">${avatar(1, { mood: 'happy' })}<span class="duo-name name-p2">${nameOf(1)}</span></button>
        </div>
      </div>
      <div class="home-grid">${GAMES.map(cardHTML)}</div>
    </section>`);

  const root = view.querySelector('.home');
  life.on(root, 'click', (e) => {
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
