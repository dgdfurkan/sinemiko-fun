// Ayarlar: isimler, müzik ve efekt sesi, baloncuklar

import { html } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { openSheet } from '../ui/overlay.js';
import { avatar } from '../ui/avatar.js';
import { sliderHTML, bindSlider, switchHTML, bindSwitch } from '../ui/controls.js';
import { sfx } from '../audio/sfx.js';

export function openSettings() {
  const names = store.get('names');
  const { el } = openSheet(html`
    <h2 class="t-big t-accent">Ayarlar</h2>
    <div class="set-names">
      <label class="name-box">${avatar(0, { mood: 'happy' })}<input class="field" data-name="0" maxlength="14" value="${names[0]}" aria-label="Birinci oyuncunun adı"></label>
      <label class="name-box">${avatar(1, { mood: 'happy' })}<input class="field" data-name="1" maxlength="14" value="${names[1]}" aria-label="İkinci oyuncunun adı"></label>
    </div>
    <div class="sheet-grid">
      <div class="set-row"><span class="opt-label">Fon Müziği</span>${switchHTML('musicOn', store.get('musicOn'), 'Fon müziği')}</div>
      <div class="set-row"><span class="opt-label">Müzik Sesi</span>${sliderHTML('musicVol', store.get('musicVol'), 'Müzik sesi')}</div>
      <div class="set-row"><span class="opt-label">Efekt Sesi</span>${sliderHTML('sfxVol', store.get('sfxVol'), 'Efekt sesi')}</div>
      <div class="set-row"><span class="opt-label">Baloncuklar</span>${switchHTML('bubbles', store.get('bubbles'), 'Baloncuklar')}</div>
    </div>
    <p class="opt-note">Bugüne kadar ${store.get('popped')} baloncuk patlattınız. İsimler ve ayarlar bu tarayıcıda saklanır.</p>
    <button class="btn btn--primary" data-act="done" data-primary>Tamam</button>`, {
    actions: { done: (t, e, close) => close() },
  });

  el.querySelectorAll('[data-name]').forEach((input) => {
    input.addEventListener('change', () => store.setName(Number(input.dataset.name), input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    input.addEventListener('blur', () => { input.value = store.get('names')[Number(input.dataset.name)]; });
  });
  bindSwitch(el.querySelector('[data-switch="musicOn"]'), { value: store.get('musicOn'), onChange: (v) => store.set('musicOn', v) });
  bindSwitch(el.querySelector('[data-switch="bubbles"]'), { value: store.get('bubbles'), onChange: (v) => store.set('bubbles', v) });
  bindSlider(el.querySelector('[data-slider="musicVol"]'), { value: store.get('musicVol'), onInput: (v) => store.set('musicVol', v) });
  bindSlider(el.querySelector('[data-slider="sfxVol"]'), { value: store.get('sfxVol'), onInput: (v) => store.set('sfxVol', v), onChange: () => sfx.pop(1) });
}
