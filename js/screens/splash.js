// Açılış ekranı: sesi açmak için gereken ilk dokunuş burada alınır

import { html, toHTML } from '../lib/dom.js';
import { nameOf } from '../lib/store.js';
import { avatar } from '../ui/avatar.js';
import { logoHTML } from './home.js';
import { icon } from '../ui/icons.js';

export function mountSplash(view, onEnter, { intro = false, full = true } = {}) {
  view.innerHTML = toHTML(html`
    <section class="screen splash">
      <div class="splash-inner">
        <div class="splash-duo">
          ${avatar(0, { mood: 'laugh', pose: 'cheer', eyes: 'happy', cls: 'splash-blob' })}
          ${logoHTML('logo--splash')}
          ${avatar(1, { mood: 'laugh', pose: 'cheer', eyes: 'happy', cls: 'splash-blob' })}
        </div>
        <p class="t-hand splash-sub">${nameOf(0)} & ${nameOf(1)} oyun gecesi</p>
        ${intro
          ? html`<button class="btn btn--primary btn--big nudge splash-go" id="enter">${full ? html`${icon('full')}Tam Ekran Yap` : html`${icon('film')}Filmi Başlat`}</button>
            <p class="splash-hint splash-hint--intro">İlk açılışa özel kısa bir film var.${full ? html` Tam ekran yapınca başlar<span class="sh-corner">, sağ üstteki düğme de olur</span>.` : ''}</p>`
          : html`<button class="btn btn--primary btn--big nudge splash-go" id="enter">${icon('play')}Oyuna Gir</button>
            <p class="splash-hint"><span class="key">F</span> tam ekran <span class="key">M</span> müzik</p>`}
      </div>
    </section>`);
  const btn = view.querySelector('#enter');
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    btn.disabled = true;
    onEnter(btn);
  };
  btn.addEventListener('click', go);
  setTimeout(() => btn.focus({ preventScroll: true }), 400);
  // Sağ üstteki tam ekran düğmesi ve F tuşu da aynı girişi kullanır
  return { go };
}
