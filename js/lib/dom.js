// DOM ve zamanlama yardımcıları

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Güvenli şablon: değerler kaçışlanır, raw() ile işaretlenenler olduğu gibi kalır
export const raw = (s) => ({ __html: String(s) });

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && '__html' in v) return v.__html;
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return raw(out);
}

export const toHTML = (tpl) => part(tpl);

export function el(tpl) {
  const t = document.createElement('template');
  t.innerHTML = part(tpl).trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Bir ekranın ömrü: ekran kapanınca dinleyiciler, zamanlayıcılar ve bekleyen işler biter
export class Life {
  constructor() {
    this.alive = true;
    this.cleanups = [];
  }
  add(fn) {
    if (!this.alive) { fn(); return fn; }
    this.cleanups.push(fn);
    return fn;
  }
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.add(() => target.removeEventListener(type, fn, opts));
  }
  timeout(fn, ms) {
    const id = setTimeout(() => { if (this.alive) fn(); }, ms);
    this.add(() => clearTimeout(id));
    return id;
  }
  interval(fn, ms) {
    const id = setInterval(() => { if (this.alive) fn(); }, ms);
    this.add(() => clearInterval(id));
    return id;
  }
  // Ekran kapanırsa söz hiç çözülmez, ardından gelen kod da çalışmaz
  sleep(ms) {
    return new Promise((resolve) => this.timeout(resolve, ms));
  }
  raf(fn) {
    let id = 0;
    const loop = (t) => {
      if (!this.alive) return;
      if (fn(t) === false) return;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    const stop = () => cancelAnimationFrame(id);
    this.add(stop);
    return stop;
  }
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    const list = this.cleanups.splice(0).reverse();
    for (const fn of list) {
      try { fn(); } catch (err) { console.error(err); }
    }
  }
}
