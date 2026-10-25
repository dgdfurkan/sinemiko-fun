// Şarkı hatırlatıcı: mırıldanacak şarkının 30 saniyelik kesiti ve sözleri.
// Kesit Apple'ın resmi önizlemesinden, sözler LRCLIB açık söz arşivinden gelir.

import { html, toHTML, sleep } from '../lib/dom.js';
import { icon } from '../ui/icons.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';

const cache = new Map();
const RING = 2 * Math.PI * 21;

// LRCLIB arada bir 503 döner; birkaç kez yeniden dener
async function getJSON(url, tries = 3) {
  let last = null;
  for (let k = 0; k < tries; k++) {
    // Takılan istek paneli sonsuza dek "geliyor" bırakmasın
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.ok) return await res.json();
      last = new Error(`http ${res.status}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      last = err;
    } finally {
      clearTimeout(timer);
    }
    if (k + 1 < tries) await sleep(1000 * (k + 1));
  }
  throw last;
}

function once(key, fn) {
  if (!cache.has(key)) {
    const p = fn();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return cache.get(key);
}

const GENERIC = /müziği|şarkısı|türkü|çizgi film/i;

function previewOf(song) {
  return once(`p:${song.it || song.text}`, async () => {
    let r = null;
    if (song.it) {
      for (const country of ['TR', 'US']) {
        const d = await getJSON(`https://itunes.apple.com/lookup?id=${song.it}&country=${country}`);
        r = (d.results || []).find((x) => x.previewUrl);
        if (r) break;
      }
    } else {
      const term = song.hint && !GENERIC.test(song.hint) ? `${song.hint} ${song.text}` : song.text;
      const d = await getJSON(`https://itunes.apple.com/search?${new URLSearchParams({ term, media: 'music', entity: 'song', limit: '5', country: 'TR' })}`);
      r = (d.results || []).find((x) => x.previewUrl);
    }
    if (!r) throw new Error('kesit yok');
    return { url: r.previewUrl, title: r.trackName, artist: r.artistName };
  });
}

async function fromLRCLIB(song) {
  if (song.lr > 0) {
    const d = await getJSON(`https://lrclib.net/api/get/${song.lr}`, 2);
    if (d.instrumental) return { instrumental: true };
    if (d.plainLyrics) return { text: d.plainLyrics, src: 'LRCLIB' };
  }
  const q = song.hint && !GENERIC.test(song.hint) ? `${song.hint} ${song.text}` : song.text;
  const list = await getJSON(`https://lrclib.net/api/search?${new URLSearchParams({ q })}`, 2);
  const hit = (list || []).find((x) => x.plainLyrics);
  if (hit) return { text: hit.plainLyrics, src: 'LRCLIB' };
  if ((list || []).some((x) => x.instrumental)) return { instrumental: true };
  return { none: true };
}

// LRCLIB yoğunken ya da şarkıyı bulamazsa ikinci kaynak
async function fromOVH(song) {
  if (!song.hint || GENERIC.test(song.hint)) return { none: true };
  const d = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.hint)}/${encodeURIComponent(song.text)}`, 1);
  return d && d.lyrics ? { text: d.lyrics.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n'), src: 'lyrics.ovh' } : { none: true };
}

function lyricsOf(song) {
  return once(`l:${song.lr || song.text}`, async () => {
    if (song.lr === -1) return { instrumental: true };
    let res;
    try {
      res = await fromLRCLIB(song);
    } catch {
      res = { error: true };
    }
    if (res.text || res.instrumental) return res;
    try {
      const alt = await fromOVH(song);
      if (alt.text) return alt;
    } catch {
      // İkinci kaynak da yanıt vermezse ilk sonucun mesajı gösterilir
    }
    return res;
  });
}

const searchURL = (song) => `https://www.google.com/search?${new URLSearchParams({ q: `${song.hint && !GENERIC.test(song.hint) ? `${song.hint} ` : ''}${song.text} şarkı sözleri` })}`;

export function songHelper(host, life) {
  const root = document.createElement('aside');
  root.className = 'song-help';
  root.hidden = true;
  root.innerHTML = toHTML(html`
    <div class="sh-dock">
      <button class="sh-btn" data-sh="play" aria-label="Şarkıdan kesit dinle">
        <svg class="sh-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle class="sh-prog" cx="24" cy="24" r="21" style="stroke-dasharray:${RING.toFixed(1)};stroke-dashoffset:${RING.toFixed(1)}"/></svg>
        <span class="sh-ic">${icon('play', 'i-play')}${icon('stop', 'i-stop')}<span class="sh-spin"></span></span>
        <span class="sh-label">Kesit</span>
      </button>
      <button class="sh-btn" data-sh="lyrics" aria-label="Şarkı sözlerini aç" aria-expanded="false">
        <span class="sh-ic">${icon('lyrics')}</span>
        <span class="sh-label">Sözler</span>
      </button>
    </div>
    <div class="sh-panel" role="dialog" aria-label="Şarkı sözleri" aria-hidden="true">
      <header class="sh-head">
        <div class="sh-name"><b data-title></b><span data-artist></span></div>
        <button class="ibtn sh-close" data-sh="close" aria-label="Sözleri kapat">${icon('x')}</button>
      </header>
      <div class="sh-body" data-body></div>
    </div>`);
  host.append(root);
  const playBtn = root.querySelector('[data-sh="play"]');
  const lyrBtn = root.querySelector('[data-sh="lyrics"]');
  const panel = root.querySelector('.sh-panel');
  const body = root.querySelector('[data-body]');
  const prog = root.querySelector('.sh-prog');
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.9;
  let song = null;
  let token = 0;
  let recording = false;
  let open = false;
  let raf = 0;

  const setProg = (v) => { prog.style.strokeDashoffset = (RING * (1 - Math.max(0, Math.min(1, v)))).toFixed(1); };
  const tick = () => {
    if (audio.duration) setProg(audio.currentTime / audio.duration);
    raf = requestAnimationFrame(tick);
  };
  const stopPreview = () => {
    if (!audio.paused) audio.pause();
    cancelAnimationFrame(raf);
    setProg(0);
    root.classList.remove('is-playing', 'is-loading');
    music.duck('preview', false);
  };
  audio.addEventListener('ended', stopPreview);
  audio.addEventListener('error', () => {
    if (!audio.src) return;
    stopPreview();
    playBtn.classList.add('is-off');
  });

  async function togglePreview() {
    if (!song || recording) return;
    if (root.classList.contains('is-playing') || root.classList.contains('is-loading')) {
      stopPreview();
      return;
    }
    const my = ++token;
    root.classList.add('is-loading');
    try {
      const p = await previewOf(song);
      if (my !== token || !life.alive) return;
      if (audio.src !== p.url) audio.src = p.url;
      audio.currentTime = 0;
      music.duck('preview', true);
      await audio.play();
      if (my !== token) return;
      root.classList.remove('is-loading');
      root.classList.add('is-playing');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    } catch {
      if (my !== token) return;
      stopPreview();
      playBtn.classList.add('is-off');
      sfx.boing();
      flashNote('Bu şarkının kesiti bulunamadı.');
    }
  }

  function flashNote(text) {
    const n = document.createElement('span');
    n.className = 'sh-note';
    n.textContent = text;
    root.querySelector('.sh-dock').append(n);
    n.animate([{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }], { duration: 250, fill: 'both' });
    setTimeout(() => n.remove(), 2400);
  }

  async function loadLyrics() {
    const my = token;
    const s = song;
    root.querySelector('[data-title]').textContent = s.text;
    root.querySelector('[data-artist]').textContent = s.hint || '';
    body.innerHTML = '<div class="sh-wait"><span class="sh-spin"></span>Sözler geliyor...</div>';
    // Kaynak gecikirse beklerken internette arama yolu da açılır
    setTimeout(() => {
      const wait = body.querySelector('.sh-wait');
      if (!wait || my !== token || s !== song) return;
      wait.insertAdjacentHTML('afterend', toHTML(html`<div class="sh-empty"><p>Sözler biraz gecikti.</p><a class="btn btn--sm" href="${searchURL(s)}" target="_blank" rel="noopener">İnternette Ara</a></div>`));
    }, 3500);
    let res;
    try {
      res = await lyricsOf(s);
    } catch {
      res = { error: true };
    }
    if (my !== token || s !== song || !life.alive) return;
    if (res.text) {
      body.innerHTML = toHTML(html`<p class="sh-lyrics">${res.text.trim()}</p><p class="sh-src">Sözler: ${res.src}</p>`);
      body.scrollTop = 0;
    } else {
      const msg = res.instrumental ? 'Bu parça sözsüz. Kesiti dinleyip melodiyi hatırla.'
        : res.error ? 'Sözlere şu an ulaşılamadı. Biraz sonra tekrar dene.'
          : 'Bu şarkının sözlerini bulamadım.';
      body.innerHTML = toHTML(html`<div class="sh-empty"><p>${msg}</p>
        ${res.error ? html`<button class="btn btn--sm" data-sh="retry">${icon('replay')}Tekrar Dene</button>` : ''}
        ${res.instrumental ? '' : html`<a class="btn btn--sm" href="${searchURL(s)}" target="_blank" rel="noopener">İnternette Ara</a>`}</div>`);
    }
  }

  function setOpen(on) {
    open = on;
    root.classList.toggle('is-open', on);
    // Sahne sola kayar, sözler ortadaki düğmelerin üstüne binmez
    host.classList.toggle('sh-open', on);
    panel.setAttribute('aria-hidden', String(!on));
    lyrBtn.setAttribute('aria-expanded', String(on));
    if (on) loadLyrics();
  }

  life.on(root, 'click', (e) => {
    const b = e.target.closest('[data-sh]');
    if (!b) return;
    // Fareyle tıklanan düğmede odak kalmasın; Boşluk kayda gitsin, düğmeye değil
    if (e.detail > 0 && b.blur) b.blur();
    const k = b.dataset.sh;
    if (k === 'play') togglePreview();
    else if (k === 'lyrics') {
      sfx.soft();
      setOpen(!open);
    } else if (k === 'retry') {
      loadLyrics();
    } else if (k === 'close') {
      sfx.soft();
      setOpen(false);
    }
  });
  life.on(window, 'keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });
  life.add(() => {
    stopPreview();
    audio.removeAttribute('src');
    root.remove();
  });

  return {
    show(next) {
      if (!next) {
        this.hide();
        return;
      }
      if (!song || song.text !== next.text || song.it !== next.it) {
        token++;
        stopPreview();
        playBtn.classList.remove('is-off');
        song = next;
        if (open) loadLyrics();
        // Kesit bilgisi arka planda hazırlanır; sözler yalnızca panel açılınca istenir
        previewOf(song).catch(() => {});
      }
      if (root.hidden) {
        root.hidden = false;
        root.querySelector('.sh-dock').animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    },
    hide() {
      token++;
      stopPreview();
      setOpen(false);
      root.hidden = true;
    },
    // Kayıtta kesit çalmaz, mikrofona karışır; sözler açık kalabilir
    setRecording(on) {
      recording = on;
      if (on) stopPreview();
      playBtn.disabled = on;
      playBtn.title = on ? 'Kayıt sırasında kesit çalmaz, mikrofona karışır' : '';
      root.classList.toggle('is-rec', on);
    },
  };
}
