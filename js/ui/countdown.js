// 3-2-1 geri sayımı; her sayı sahneye çarparak gelir

import { el, html } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { burst } from '../fx/confetti.js';
import { store } from '../lib/store.js';
import { announcer } from '../audio/announcer.js';

function slam(layer, text, final) {
  const node = el(html`<span class="cd-num ${final ? 'final' : ''}">${text}</span>`);
  layer.append(node);
  // Her aralığın kendi eğrisi var; genel eğri doğrusal kalmalı yoksa rakam erken solar
  node.animate(
    [
      { transform: 'scale(2.8) rotate(-14deg)', opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: 'scale(.92) rotate(3deg)', opacity: 1, offset: 0.3, easing: 'ease-out' },
      { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.75, easing: 'ease-in' },
      { transform: 'scale(1.06) translateY(-10px)', opacity: 0 },
    ],
    { duration: final ? 900 : 780, easing: 'linear', fill: 'forwards' },
  ).finished.then(() => node.remove(), () => node.remove());
}

// voice: son kelimenin ses kaydı (ör. 'go-poz'); verilirse sayıları da sunucu okur
export async function countdown(host, life, { from = 3, final = 'Başla!', step = 760, voice = null } = {}) {
  const layer = el(html`<div class="countdown" aria-live="assertive"></div>`);
  host.append(layer);
  life.add(() => layer.remove());
  const talk = !!voice && from <= 3 && store.get('voiceOn');
  for (let n = from; n >= 1; n--) {
    if (talk) announcer.say(`cd-${n}`);
    else sfx.tick(from - n);
    slam(layer, String(n), false);
    await life.sleep(step);
  }
  if (talk) announcer.say(voice);
  sfx.go();
  slam(layer, final, true);
  const r = host.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { count: 46, power: 13 });
  await life.sleep(560);
  layer.remove();
}
