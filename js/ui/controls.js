// Tarayıcı form öğeleri yerine oyuna uygun özel kontroller

import { html, clamp } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { icon } from './icons.js';

/* Bölümlü seçim */
export const segHTML = (name, options, value) => html`
  <div class="seg ctl" data-seg="${name}" role="radiogroup">
    <span class="seg-thumb"></span>
    ${options.map(([v, label]) => html`<button type="button" role="radio" data-value="${v}" class="${String(v) === String(value) ? 'on' : ''}" aria-checked="${String(String(v) === String(value))}">${label}</button>`)}
  </div>`;

export function bindSeg(root, { value, onChange } = {}) {
  const thumb = root.querySelector('.seg-thumb');
  const buttons = [...root.querySelectorAll('button')];
  let current = String(value ?? buttons[0].dataset.value);
  const place = (instant) => {
    const on = buttons.find((b) => b.dataset.value === current) || buttons[0];
    if (instant) thumb.style.transition = 'none';
    thumb.style.left = `${on.offsetLeft}px`;
    thumb.style.width = `${on.offsetWidth}px`;
    if (instant) {
      void thumb.offsetWidth;
      thumb.style.transition = '';
    }
  };
  const set = (v, silent) => {
    current = String(v);
    buttons.forEach((b) => {
      const on = b.dataset.value === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    place(false);
    if (!silent && onChange) onChange(current);
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.value === current) return;
    sfx.soft();
    set(b.dataset.value);
  });
  requestAnimationFrame(() => place(true));
  // Yazı tipi geç yüklenirse ölçüleri yenile
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(true));
  const ro = new ResizeObserver(() => place(true));
  ro.observe(root);
  return { get: () => current, set: (v) => set(v, true), destroy: () => ro.disconnect() };
}

/* Sayı seçici */
export const stepperHTML = (name, value, format = (v) => v) => html`
  <div class="stepper ctl" data-stepper="${name}">
    <button type="button" data-step="-1" aria-label="Azalt">−</button>
    <div class="stepper-val" aria-live="polite"><span>${format(value)}</span></div>
    <button type="button" data-step="1" aria-label="Artır">+</button>
  </div>`;

export function bindStepper(root, { value, min, max, step = 1, format = (v) => v, onChange } = {}) {
  let v = value;
  const box = root.querySelector('.stepper-val');
  const [minus, plus] = root.querySelectorAll('button');
  const sync = () => {
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  };
  const show = (dir) => {
    const prev = box.firstElementChild;
    const next = document.createElement('span');
    next.textContent = format(v);
    box.append(next);
    const off = dir > 0 ? 100 : -100;
    next.animate([{ transform: `translateY(${off}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (prev) {
      const a = prev.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-off}%)`, opacity: 0 }], { duration: 220, fill: 'forwards' });
      a.finished.then(() => prev.remove(), () => prev.remove());
    }
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const dir = Number(b.dataset.step);
    const nv = clamp(v + dir * step, min, max);
    if (nv === v) return;
    v = nv;
    sfx.soft();
    show(dir);
    sync();
    if (onChange) onChange(v);
  });
  sync();
  return { get: () => v };
}

/* Çoklu seçim fişleri */
export const chipsHTML = (name, options, selected) => html`
  <div class="chips ctl" data-chips="${name}">
    ${options.map(([v, label]) => html`<button type="button" class="chip ${selected.has(v) ? 'on' : ''}" data-value="${v}" aria-pressed="${String(selected.has(v))}"><span class="chip-box">${icon('check')}</span>${label}</button>`)}
  </div>`;

export function bindChips(root, { values, min = 1, onChange } = {}) {
  const set = new Set(values);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const v = b.dataset.value;
    if (set.has(v)) {
      if (set.size <= min) {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        sfx.boing();
        return;
      }
      set.delete(v);
    } else {
      set.add(v);
    }
    const on = set.has(v);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    sfx.soft();
    if (onChange) onChange(new Set(set));
  });
  return { get: () => new Set(set) };
}

/* Anahtar */
export const switchHTML = (name, on, label) => html`
  <button type="button" class="switch ctl" role="switch" data-switch="${name}" aria-checked="${String(!!on)}" aria-label="${label}"><span class="switch-knob"></span></button>`;

export function bindSwitch(root, { value, onChange } = {}) {
  let v = !!value;
  root.addEventListener('click', () => {
    v = !v;
    root.setAttribute('aria-checked', String(v));
    sfx.soft();
    if (onChange) onChange(v);
  });
  return { get: () => v };
}

/* Kaydırıcı */
export const sliderHTML = (name, value, label) => html`
  <div class="slider ctl" data-slider="${name}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}" style="--v:${value}">
    <div class="slider-track"><div class="slider-fill"></div></div>
    <div class="slider-knob"></div>
  </div>`;

export function bindSlider(root, { value, onInput, onChange } = {}) {
  let v = clamp(value, 0, 1);
  let dragging = false;
  const apply = (nv, fire = true) => {
    v = clamp(nv, 0, 1);
    root.style.setProperty('--v', v.toFixed(4));
    root.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    if (fire && onInput) onInput(v);
  };
  const fromEvent = (e) => {
    const r = root.getBoundingClientRect();
    const knob = 34;
    return (e.clientX - r.left - knob / 2) / Math.max(1, r.width - knob);
  };
  root.addEventListener('pointerdown', (e) => {
    dragging = true;
    root.classList.add('dragging');
    root.setPointerCapture(e.pointerId);
    apply(fromEvent(e));
  });
  root.addEventListener('pointermove', (e) => {
    if (dragging) apply(fromEvent(e));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('dragging');
    sfx.soft();
    if (onChange) onChange(v);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    apply(v + d);
    if (onChange) onChange(v);
  });
  return { get: () => v, set: (nv) => apply(nv, false) };
}
