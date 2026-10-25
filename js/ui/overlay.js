// Alt pencere (onay, ayarlar) ve kısa bildirimler

import { el, html, toHTML } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { icon } from './icons.js';

const root = () => document.getElementById('sheets');
let openCount = 0;

export const sheetOpen = () => openCount > 0;

export function openSheet(tpl, { actions = {}, dismissable = true, onClose = null, wide = false } = {}) {
  const back = el(html`<div class="sheet-back"><div class="sheet card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"></div></div>`);
  const sheet = back.firstElementChild;
  sheet.innerHTML = toHTML(tpl);
  if (dismissable) sheet.insertAdjacentHTML('afterbegin', toHTML(html`<button class="ibtn sheet-close" data-act="__close" aria-label="Kapat">${icon('x')}</button>`));
  root().append(back);
  openCount++;
  const prevFocus = document.activeElement;
  let closed = false;

  back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  sheet.animate(
    [{ opacity: 0, transform: 'translateY(60px) scale(.9) rotate(-2deg)' }, { opacity: 1, transform: 'none' }],
    { duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  );
  sfx.whoosh();

  function close(result) {
    if (closed) return;
    closed = true;
    openCount--;
    window.removeEventListener('keydown', onKeyDown, true);
    const a = sheet.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px) scale(.94)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    a.finished.then(() => back.remove(), () => back.remove());
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    if (onClose) onClose(result);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && dismissable) {
      e.preventDefault();
      e.stopPropagation();
      close(undefined);
    }
  }
  window.addEventListener('keydown', onKeyDown, true);

  back.addEventListener('click', (e) => {
    if (e.target === back && dismissable) {
      close(undefined);
      return;
    }
    const t = e.target.closest('[data-act]');
    if (!t || !sheet.contains(t) || t.disabled) return;
    if (t.dataset.act === '__close') {
      sfx.click();
      close(undefined);
      return;
    }
    const fn = actions[t.dataset.act];
    if (fn) {
      sfx.click();
      fn(t, e, close);
    }
  });

  const first = sheet.querySelector('[autofocus], [data-primary]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  return { el: sheet, close };
}

export function confirmSheet({ title, text, ok = 'Evet', cancel = 'Vazgeç', okClass = 'btn--primary' }) {
  return new Promise((resolve) => {
    openSheet(
      html`
        <h2 class="t-big t-accent">${title}</h2>
        ${text ? html`<p class="t-lead">${text}</p>` : ''}
        <div class="row">
          <button class="btn" data-act="no">${cancel}</button>
          <button class="btn ${okClass}" data-act="yes" data-primary>${ok}</button>
        </div>`,
      {
        actions: {
          yes: (t, e, close) => close(true),
          no: (t, e, close) => close(false),
        },
        onClose: (r) => resolve(r === true),
      },
    );
  });
}

export function toast(text, { tone = '', ms = 2800 } = {}) {
  const host = document.getElementById('toasts');
  const node = el(html`<div class="toast ${tone}" role="status">${text}</div>`);
  host.append(node);
  node.animate(
    [{ opacity: 0, transform: 'translateY(-30px) rotate(-4deg) scale(.8)' }, { opacity: 1, transform: 'rotate(-1deg)' }],
    { duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' },
  );
  setTimeout(() => {
    const a = node.animate([{ opacity: 1, transform: 'rotate(-1deg)' }, { opacity: 0, transform: 'translateY(-20px) scale(.9)' }], { duration: 260, fill: 'forwards' });
    a.finished.then(() => node.remove(), () => node.remove());
  }, ms);
}
