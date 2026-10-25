// Açılış ekranı: sesi açmak için gereken ilk dokunuş burada alınır

import { html, toHTML } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar } from '../ui/avatar.js';
import { logoHTML } from './home.js';
import { icon } from '../ui/icons.js';

export function mountSplash(view, onEnter) {
  view.innerHTML = toHTML(html`
    <section class="screen splash">
      <div class="splash-inner">
        <div class="splash-duo">
          ${avatar(0, { mood: 'laugh', pose: 'cheer', eyes: 'happy', cls: 'splash-blob' })}
          ${logoHTML('logo--splash')}
          ${avatar(1, { mood: 'laugh', pose: 'cheer', eyes: 'happy', cls: 'splash-blob' })}
        </div>
        <p class="t-hand splash-sub">${nameOf(0)} & ${nameOf(1)} oyun gecesi</p>
        <button class="btn btn--primary btn--big nudge splash-go" id="enter">${icon('play')}Oyuna Gir</button>
        <p class="splash-hint"><span class="key">F</span> tam ekran <span class="key">M</span> müzik</p>
      </div>
    </section>`);
  const btn = view.querySelector('#enter');
  const go = () => {
    btn.disabled = true;
    onEnter(btn);
  };
  btn.addEventListener('click', go, { once: true });
  setTimeout(() => btn.focus({ preventScroll: true }), 400);
}
