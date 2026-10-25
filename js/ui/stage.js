// Oyun sahnesi: her fazda tek odaklı bir sahne gösterir, eskisini canlandırarak kaldırır

import { toHTML } from '../lib/dom.js';
import { sfx } from '../audio/sfx.js';
import { sheetOpen } from './overlay.js';

export class Stage {
  constructor(host, life) {
    this.host = host;
    this.life = life;
    this.scene = null;
    this.actions = {};
    this.onKey = null;
    this.sceneCleanups = [];
    life.on(host, 'click', (e) => this.handleClick(e));
    life.on(window, 'keydown', (e) => this.handleKey(e));
    life.add(() => this.runCleanups());
  }

  handleClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || !this.scene || !this.scene.contains(t)) return;
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const fn = this.actions[t.dataset.act];
    if (!fn) return;
    if (t.hasAttribute('data-once')) t.disabled = true;
    // Fareyle tıklanan düğmede odak kalmasın; Enter ve Boşluk sahnenin ana eylemine gitsin
    if (e.detail > 0 && t.blur) t.blur();
    if (!t.hasAttribute('data-silent')) sfx.click();
    fn(t, e);
  }

  handleKey(e) {
    if (e.defaultPrevented || !this.scene || sheetOpen()) return;
    const typing = !!(e.target && e.target.closest && e.target.closest('input, textarea'));
    if (this.onKey && this.onKey(e, typing) === true) return;
    if (e.repeat || e.isComposing) return;
    if (e.key === 'Enter') {
      const primary = this.scene.querySelector('[data-primary]:not([disabled])');
      // Odak başka bir düğmedeyse tarayıcının kendi davranışına bırak
      const focused = e.target && e.target.closest && e.target.closest('button, a, [role="slider"], [role="switch"]');
      if (focused && focused !== primary) return;
      if (primary) {
        e.preventDefault();
        primary.click();
      }
    }
  }

  // Sahneye ait temizlik işi; sahne değişince çalışır
  own(fn) {
    this.sceneCleanups.push(fn);
  }

  runCleanups() {
    const list = this.sceneCleanups.splice(0);
    for (const fn of list) {
      try { fn(); } catch (err) { console.error(err); }
    }
  }

  show(tpl, actions = {}, { onKey = null, className = '' } = {}) {
    this.runCleanups();
    const old = this.scene;
    if (old) {
      old.classList.add('leaving');
      const anim = old.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94) translateY(-14px)' }],
        { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
      );
      anim.finished.then(() => old.remove(), () => old.remove());
    }
    const scene = document.createElement('div');
    scene.className = `scene ${className}`.trim();
    scene.innerHTML = toHTML(tpl);
    this.host.append(scene);
    this.scene = scene;
    this.actions = actions;
    this.onKey = onKey;
    const items = scene.querySelectorAll('[data-in]');
    items.forEach((node, i) => {
      node.animate(
        [
          { opacity: 0, transform: 'translateY(28px) scale(.9) rotate(-1.5deg)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 560, delay: 90 + i * 70, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' },
      );
    });
    const auto = scene.querySelector('[autofocus]');
    if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 380);
    return scene;
  }
}
