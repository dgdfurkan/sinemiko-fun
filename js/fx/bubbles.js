// Ekranda süzülen, tıklayınca patlayan sabun baloncukları

import { rand, reducedMotion } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { burst } from './confetti.js';

let layer = null;
let enabled = true;
let onPop = () => {};

function maxBubbles() {
  const w = window.innerWidth;
  if (reducedMotion()) return 4;
  return w < 600 ? 6 : w < 1100 ? 10 : 14;
}

function spawn() {
  if (!enabled || document.hidden || !layer) return;
  if (layer.querySelectorAll('.bubble:not(.popping)').length >= maxBubbles()) return;
  const size = rand(34, window.innerWidth < 600 ? 64 : 92);
  // Kenarlarda daha sık, ortada daha seyrek
  const edge = Math.random() < 0.72;
  const x = edge ? (Math.random() < 0.5 ? rand(0, 16) : rand(84, 100)) : rand(16, 84);
  const roll = Math.random();
  const kind = roll < 0.06 ? 'gold' : roll < 0.13 ? 'love' : '';
  const b = document.createElement('button');
  b.className = `bubble ${kind}`;
  b.type = 'button';
  b.tabIndex = -1;
  b.setAttribute('aria-hidden', 'true');
  b.style.cssText = `left:calc(${x.toFixed(2)}vw - ${(size / 2).toFixed(0)}px);bottom:${(-size * 1.3).toFixed(0)}px;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;--hue:${rand(0, 360).toFixed(0)}deg`;
  b.innerHTML = '<span class="bubble-in"><span class="bubble-ring"></span></span>';
  layer.append(b);
  // Kesin değerli Web Animations: ekran kartı yürütür, her karede stil hesabı olmaz.
  // (Anahtar karelerde CSS değişkeni olunca animasyon ana iş parçacığına düşüyordu.)
  const drift = rand(8, 26);
  const rise = b.animate(
    [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(0, ${(-(window.innerHeight + size * 2.6)).toFixed(0)}px, 0)` }],
    { duration: rand(11000, 19000), easing: 'linear', fill: 'forwards' },
  );
  rise.finished.then(() => b.remove(), () => {});
  const inner = b.firstElementChild;
  inner.animate(
    [{ transform: `translateX(${-drift}px) scale(1, .96)` }, { transform: `translateX(${drift}px) scale(.96, 1)` }],
    { duration: rand(1800, 3200), direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
  );
  if (!reducedMotion()) inner.firstElementChild.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 7000, iterations: Infinity });
}

function pop(b) {
  if (b.classList.contains('popping')) return;
  b.classList.add('popping');
  b.getAnimations({ subtree: true }).forEach((a) => a.pause());
  const r = b.getBoundingClientRect();
  const lr = layer.getBoundingClientRect();
  const cx = r.left + r.width / 2 - lr.left;
  const cy = r.top + r.height / 2 - lr.top;
  const inner = b.firstElementChild;
  inner.animate(
    [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.32)', opacity: 0.6, offset: 0.5 }, { transform: 'scale(1.5)', opacity: 0 }],
    { duration: 170, easing: 'ease-out', fill: 'forwards' },
  ).finished.then(() => b.remove(), () => b.remove());

  const ring = document.createElement('span');
  ring.className = 'pop-ring';
  ring.style.cssText = `left:${cx - r.width / 2}px;top:${cy - r.height / 2}px;width:${r.width}px;height:${r.height}px`;
  layer.append(ring);
  ring.animate([{ transform: 'scale(.7)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' })
    .finished.then(() => ring.remove(), () => ring.remove());

  const n = 9;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('span');
    d.className = 'drop';
    d.style.left = `${cx - 4.5}px`;
    d.style.top = `${cy - 4.5}px`;
    layer.append(d);
    const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
    const dist = r.width * rand(0.55, 0.95);
    d.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist + 18}px) scale(.3)`, opacity: 0 },
      ],
      { duration: rand(420, 620), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
    ).finished.then(() => d.remove(), () => d.remove());
  }

  const kind = b.classList.contains('gold') ? 'gold' : b.classList.contains('love') ? 'love' : 'plain';
  sfx.pop(r.width / 60);
  const px = r.left + r.width / 2;
  const py = r.top + r.height / 2;
  if (kind === 'gold') {
    sfx.sparkle();
    burst(px, py, { count: 34, power: 9, shapes: ['star'], colors: ['#ffcd3c', '#ffe27a', '#ffb300'], gravity: 0.18 });
    plus(cx, cy, '+5');
  } else if (kind === 'love') {
    sfx.heart();
    burst(px, py, { count: 22, power: 7, shapes: ['heart'], colors: ['#ff5fa2', '#ff8fc0', '#ff4f62'], gravity: 0.12, size: [10, 16] });
  }
  onPop(kind === 'gold' ? 5 : 1);
}

function plus(x, y, text) {
  const s = document.createElement('span');
  s.className = 'pop-plus';
  s.textContent = text;
  s.style.left = `${x - 18}px`;
  s.style.top = `${y - 14}px`;
  layer.append(s);
  s.animate([{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(-26px) scale(1.15)', opacity: 1, offset: 0.35 }, { transform: 'translateY(-60px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' })
    .finished.then(() => s.remove(), () => s.remove());
}

export function initBubbles(el, { onPop: cb } = {}) {
  layer = el;
  if (cb) onPop = cb;
  layer.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.bubble');
    if (b) {
      e.preventDefault();
      pop(b);
    }
  });
  const loop = () => {
    spawn();
    setTimeout(loop, rand(700, 1500));
  };
  loop();
  // Açılışta birkaç baloncukla başla
  for (let i = 0; i < 4; i++) setTimeout(spawn, 200 + i * 350);
}

export function setBubbles(on) {
  enabled = on;
  if (!on && layer) layer.querySelectorAll('.bubble').forEach((b) => b.remove());
}
