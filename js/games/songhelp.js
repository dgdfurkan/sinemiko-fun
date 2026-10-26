// Şarkı hatırlatıcı: şarkının tam hali (YouTube), zamanlı sözler ve parça parça dinleme.
// Söz bölümüne dokununca o kısım çalar, söylenen satır yanar.
// Kaynaklar: YouTube oynatıcısı, LRCLIB (yedek lyrics.ovh), YouTube yoksa Apple'ın 30 sn önizlemesi.

import { html, toHTML, sleep } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { icon } from '../ui/icons.js';
import { segHTML, bindSeg } from '../ui/controls.js';
import { toast } from '../ui/overlay.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';

const RING = 2 * Math.PI * 21;
const cache = new Map();

/* ---------- Ağ ---------- */

// LRCLIB arada bir 503 döner; kısa aralıklarla yeniden dener, takılan isteği keser
export async function getJSON(url, tries = 3) {
  let last = null;
  for (let k = 0; k < tries; k++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
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

export const GENERIC = /müziği|şarkısı|türkü|çizgi film/i;

// Şarkı listesindeki YouTube alanı: "e:a,b" sitede gömülü çalar, "w:a" YouTube penceresinde açılır
export function ytField(v) {
  const m = String(v || '').match(/^([ew]):(.*)$/);
  const ids = (m ? m[2] : String(v || '')).split(',').filter(Boolean);
  return m && m[1] === 'w' ? { yt: [], ytWatch: ids[0] || null } : { yt: ids, ytWatch: null };
}
const artistOf = (song) => (song.hint && !GENERIC.test(song.hint) ? song.hint : '');

/* ---------- Sözler ---------- */

// [01:23.45] satır biçimini zaman sıralı satırlara çevirir; boş satırlar atlanır
export function parseLRC(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const line = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!tags.length || !line) continue;
    for (const m of tags) out.push({ t: Number(m[1]) * 60 + Number(m[2]), line });
  }
  return out.sort((a, b) => a.t - b.t);
}

const fromRecord = (d, src = 'LRCLIB') => {
  if (!d) return null;
  if (d.instrumental) return { instrumental: true };
  const synced = parseLRC(d.syncedLyrics);
  if (synced.length >= 4) return { synced, src };
  if (d.plainLyrics) return { plain: d.plainLyrics, src };
  return null;
};

async function fromLRCLIB(song) {
  for (const id of [song.syn, song.lr]) {
    if (!(id > 0)) continue;
    const r = fromRecord(await getJSON(`https://lrclib.net/api/get/${id}`, 2));
    if (r && (r.synced || r.instrumental || id === song.lr)) return r;
  }
  const artist = artistOf(song);
  const q = artist ? `${artist} ${song.text}` : song.text;
  const list = (await getJSON(`https://lrclib.net/api/search?${new URLSearchParams({ q })}`, 2)) || [];
  // Zamanlı sözü olan kayıt öne alınır
  const best = list.find((x) => x.syncedLyrics && !x.instrumental) || list.find((x) => x.plainLyrics);
  if (best) return fromRecord(best);
  if (list.some((x) => x.instrumental)) return { instrumental: true };
  return { none: true };
}

async function fromOVH(song) {
  const artist = artistOf(song);
  if (!artist) return { none: true };
  const d = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song.text)}`, 1);
  return d && d.lyrics ? { plain: d.lyrics.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n'), src: 'lyrics.ovh' } : { none: true };
}

export function lyricsOf(song) {
  return once(`l:${song.syn || song.lr || ''}:${song.text}:${song.hint || ''}`, async () => {
    if (song.lr === -1) return { instrumental: true };
    let res;
    try {
      res = await fromLRCLIB(song);
    } catch {
      res = { error: true };
    }
    if (res.synced || res.plain || res.instrumental) return res;
    try {
      const alt = await fromOVH(song);
      if (alt.plain) return alt;
    } catch {
      // İkinci kaynak da yanıt vermezse ilk sonucun mesajı gösterilir
    }
    return res;
  });
}

/* ---------- Önizleme (YouTube yoksa) ---------- */

function previewOf(song) {
  return once(`p:${song.it || song.text}:${song.hint || ''}`, async () => {
    let r = null;
    if (song.it) {
      for (const country of ['TR', 'US']) {
        const d = await getJSON(`https://itunes.apple.com/lookup?id=${song.it}&country=${country}`);
        r = ((d && d.results) || []).find((x) => x.previewUrl);
        if (r) break;
      }
    } else {
      const artist = artistOf(song);
      const term = artist ? `${artist} ${song.text}` : song.text;
      const d = await getJSON(`https://itunes.apple.com/search?${new URLSearchParams({ term, media: 'music', entity: 'song', limit: '5', country: 'TR' })}`);
      r = ((d && d.results) || []).find((x) => x.previewUrl);
    }
    if (!r) throw new Error('kesit yok');
    return { url: r.previewUrl };
  });
}

/* ---------- YouTube oynatıcısı ---------- */

let ytApi = null;
function loadYT() {
  if (!ytApi) {
    ytApi = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => reject(new Error('youtube'));
      document.head.append(s);
      setTimeout(() => reject(new Error('youtube zaman aşımı')), 15000);
    });
    ytApi.catch(() => { ytApi = null; });
  }
  return ytApi;
}

const searchURL = (song) => `https://www.google.com/search?${new URLSearchParams({ q: `${artistOf(song) ? `${artistOf(song)} ` : ''}${song.text} şarkı sözleri` })}`;
const ytSearchURL = (song) => `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${artistOf(song)} ${song.text}`.trim() })}`;
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ---------- Panel ---------- */

export function songHelper(host, life) {
  const root = document.createElement('aside');
  root.className = 'song-help';
  root.hidden = true;
  root.innerHTML = toHTML(html`
    <div class="sh-dock">
      <button class="sh-btn" data-sh="listen" aria-label="Şarkıyı dinle">
        <svg class="sh-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle class="sh-prog" cx="24" cy="24" r="21" style="stroke-dasharray:${RING.toFixed(1)};stroke-dashoffset:${RING.toFixed(1)}"/></svg>
        <span class="sh-ic">${icon('play', 'i-play')}${icon('pause', 'i-stop')}<span class="sh-spin"></span></span>
        <span class="sh-label">Dinle</span>
      </button>
      <button class="sh-btn" data-sh="lyrics" aria-label="Şarkı sözlerini aç" aria-expanded="false">
        <span class="sh-ic">${icon('lyrics')}</span>
        <span class="sh-label">Sözler</span>
      </button>
    </div>
    <div class="sh-panel" role="dialog" aria-label="Şarkı ve sözler" aria-hidden="true">
      <header class="sh-head">
        <div class="sh-name"><b data-title></b><span data-artist></span></div>
        <button class="ibtn sh-close" data-sh="close" aria-label="Paneli kapat">${icon('x')}</button>
      </header>
      <div class="sh-media" data-media></div>
      <div class="sh-tools">
        ${segHTML('chunk', [['2', '2 Satır'], ['4', '4 Satır']], String(store.get('lyricChunk')))}
        <button class="btn btn--sm" data-sh="from0">${icon('replay')}Baştan</button>
      </div>
      <p class="sh-rec">Kayıt sürüyor, ses kapalı. Sözlere bakmaya devam edebilirsin.</p>
      <div class="sh-body" data-body></div>
    </div>`);
  host.append(root);
  const listenBtn = root.querySelector('[data-sh="listen"]');
  const lyrBtn = root.querySelector('[data-sh="lyrics"]');
  const panel = root.querySelector('.sh-panel');
  const media = root.querySelector('[data-media]');
  const body = root.querySelector('[data-body]');
  const prog = root.querySelector('.sh-prog');

  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.9;

  let song = null;
  let token = 0;
  let recording = false;
  let open = false;
  let lyr = null;
  let lines = [];
  let nowLine = -1;
  let player = null;
  let hooks = null;
  let ytList = [];
  let ytIdx = 0;
  let mode = 'none';
  let mediaReady = null;
  let watchId = null;
  let watchOpened = false;
  let playing = false;
  let stopAt = null;
  let raf = 0;

  const chunkSeg = bindSeg(root.querySelector('[data-seg="chunk"]'), {
    value: String(store.get('lyricChunk')),
    onChange: (v) => {
      store.set('lyricChunk', Number(v));
      renderLyrics();
    },
  });

  const setProg = (v) => { prog.style.strokeDashoffset = (RING * (1 - Math.max(0, Math.min(1, v)))).toFixed(1); };
  const setPlaying = (on) => {
    playing = on;
    root.classList.toggle('is-playing', on);
    root.classList.remove('is-loading');
    music.duck('preview', on);
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(tick);
  };

  const curTime = () => {
    if (mode === 'yt' && player && player.getCurrentTime) return player.getCurrentTime() - (song.off || 0);
    if (mode === 'preview') return audio.currentTime;
    return 0;
  };
  const totalTime = () => {
    if (mode === 'yt' && player && player.getDuration) return player.getDuration() || 1;
    return audio.duration || 30;
  };

  function tick() {
    if (!playing) return;
    const t = curTime();
    setProg(t / totalTime());
    if (stopAt !== null && t >= stopAt) {
      pause();
      return;
    }
    if (mode === 'yt') highlight(t);
    raf = requestAnimationFrame(tick);
  }

  function highlight(t) {
    if (!lines.length) return;
    let k = -1;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].t <= t + 0.15) k = j;
      else break;
    }
    if (k === nowLine) return;
    nowLine = k;
    body.querySelectorAll('.sh-line.now').forEach((n) => n.classList.remove('now'));
    body.querySelectorAll('.sh-chunk.on').forEach((n) => n.classList.remove('on'));
    if (k < 0) return;
    const el = body.querySelector(`.sh-line[data-k="${k}"]`);
    if (!el) return;
    el.classList.add('now');
    const chunk = el.closest('.sh-chunk');
    chunk.classList.add('on');
    // Çalan bölüm görünür alanda kalsın
    const r = chunk.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) body.scrollTo({ top: body.scrollTop + r.top - b.top - 40, behavior: 'smooth' });
  }

  /* --- Ortam: önce YouTube, olmazsa önizleme --- */

  function mediaHTML(kind, s) {
    if (kind === 'yt') return html`<div class="sh-video"><div data-yt></div></div>`;
    if (kind === 'watch') {
      return html`<div class="sh-alt sh-watch"><p>Bu şarkının sahibi başka sitelerde çalınmasına izin vermiyor. Tam hali küçük bir YouTube penceresinde açılır; söz bölümüne dokununca YouTube o saniyeden başlar.</p>
        <button class="btn btn--sm btn--primary" data-sh="from0">${icon('play')}Pencerede Çal</button></div>`;
    }
    if (kind === 'loading') return html`<div class="sh-alt"><span class="sh-spin dark"></span><p>Şarkı hazırlanıyor...</p></div>`;
    const msg = kind === 'preview' ? 'Bu şarkının tam hali bulunamadı. Dinle 30 saniyelik kesiti çalar.' : 'Bu şarkıyı çalamadım.';
    return html`<div class="sh-alt"><p>${msg}</p><a class="btn btn--sm" href="${ytSearchURL(s)}" target="_blank" rel="noopener">${icon('play')}YouTube'da Aç</a></div>`;
  }

  function dropPlayer() {
    if (player && player.destroy) {
      try {
        player.destroy();
      } catch {
        // Oynatıcı zaten kapanmış olabilir
      }
    }
    player = null;
    hooks = null;
  }

  // Gömülemeyen video oynarken hata verirse sıradaki adaya, o da yoksa YouTube penceresine geçer
  function runtimeError() {
    ytIdx++;
    if (ytIdx < ytList.length) {
      player.loadVideoById(ytList[ytIdx]);
      return;
    }
    const was = playing;
    watchId = watchId || ytList[0];
    ytList = [];
    mediaReady = null;
    setPlaying(false);
    dropPlayer();
    ensureMedia().then((ok) => { if (ok && was) play(0); });
  }

  function useWatch(s) {
    const was = mode;
    mode = 'watch';
    media.innerHTML = toHTML(mediaHTML('watch', s));
    // Bölüm düğmeleri pencere moduna göre yeniden çizilir
    if (was !== 'watch' && lyr) renderLyrics();
    return true;
  }

  // Gömülemeyen şarkı YouTube'un kendi sayfasında, küçük bir pencerede o saniyeden açılır.
  // YouTube açılan pencereyle bağı güvenlik gereği koparır; pencere buradan kapatılamaz ve izlenemez.
  function openWatch(from) {
    const t = from === null ? 0 : Math.max(0, Math.floor(from + (song.off || 0) - 1));
    const url = `https://www.youtube.com/watch?${new URLSearchParams({ v: watchId, t: `${t}s` })}`;
    const w = Math.min(760, window.screen.availWidth - 80);
    const win = window.open(url, '_blank', `popup=yes,width=${w},height=${Math.round(w * 0.6)},left=40,top=80`);
    if (!win) {
      toast('Tarayıcı açılır pencereyi engelledi. Adres çubuğundan bu siteye izin ver.', { tone: 'warn', ms: 3600 });
      return false;
    }
    watchOpened = true;
    return true;
  }

  function setupPlayer(s, my) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        hooks = null;
        resolve(v && my === token);
      };
      hooks = {
        ready: () => done(true),
        error: () => {
          ytIdx++;
          if (ytIdx < ytList.length) player.cueVideoById(ytList[ytIdx]);
          else done(false);
        },
      };
      if (player) {
        player.cueVideoById(ytList[ytIdx]);
        // Yeniden yüklemede hazır olayı gelmez; hata gelmezse hazır sayılır
        setTimeout(() => done(true), 1500);
        return;
      }
      media.innerHTML = toHTML(mediaHTML('yt', s));
      player = new window.YT.Player(media.querySelector('[data-yt]'), {
        videoId: ytList[ytIdx],
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => { if (hooks) hooks.ready(); },
          onStateChange: (e) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              if (recording || !open) {
                player.pauseVideo();
                return;
              }
              setPlaying(true);
            } else if (e.data === S.PAUSED || e.data === S.ENDED) {
              setPlaying(false);
            }
          },
          // 100: video yok, 101/150: başka sitede oynatılamaz
          onError: () => {
            if (hooks) hooks.error();
            else runtimeError();
          },
        },
      });
    });
  }

  function ensureMedia() {
    if (mediaReady) return mediaReady;
    const my = token;
    const s = song;
    mediaReady = (async () => {
      // Kendi bulduğun şarkıda YouTube kaydı yoksa Gemini anahtarıyla aranır
      if (!ytList.length && !watchId && !s.ytTried) {
        s.ytTried = true;
        try {
          const { findYouTube } = await import('./songfind.js');
          const ids = await findYouTube(s);
          if (my !== token) return false;
          if (ids.length) {
            s.yt = ids;
            ytList = ids.slice();
            ytIdx = 0;
          }
        } catch {
          // Bulunamazsa kesit çalar
        }
      }
      if (ytList.length) {
        const first = ytList[0];
        try {
          await loadYT();
          if (my !== token) return false;
          mode = 'yt';
          if (await setupPlayer(s, my)) return true;
        } catch {
          // YouTube açılmazsa pencereye ya da önizlemeye geçilir
        }
        if (my !== token) return false;
        dropPlayer();
        watchId = watchId || first;
      }
      if (watchId) return useWatch(s);
      try {
        const p = await previewOf(s);
        if (my !== token) return false;
        mode = 'preview';
        media.innerHTML = toHTML(mediaHTML('preview', s));
        if (audio.src !== p.url) audio.src = p.url;
        return true;
      } catch {
        if (my !== token) return false;
        mode = 'none';
        media.innerHTML = toHTML(mediaHTML('none', s));
        return false;
      }
    })();
    return mediaReady;
  }

  async function play(from = null, to = null) {
    if (!song || recording) return;
    root.classList.add('is-loading');
    const my = token;
    const ok = await ensureMedia();
    if (my !== token) return;
    root.classList.remove('is-loading');
    if (!ok) {
      sfx.boing();
      return;
    }
    if (mode === 'yt') {
      stopAt = to;
      if (from !== null) player.seekTo(Math.max(0, from + (song.off || 0) - 0.25), true);
      player.playVideo();
    } else if (mode === 'watch') {
      if (openWatch(from)) markChunk(from);
    } else if (mode === 'preview') {
      // Kesitte zaman bilgisi yok; söz bölümleri kesiti baştan çalar
      stopAt = null;
      if (from !== null) audio.currentTime = 0;
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }

  // Pencere modunda zaman bilinmez; dokunulan bölüm işaretlenir
  function markChunk(from) {
    body.querySelectorAll('.sh-chunk.on').forEach((n) => n.classList.remove('on'));
    if (from === null) return;
    const c = [...body.querySelectorAll('.sh-chunk')].find((n) => Math.abs(Number(n.dataset.from) - from) < 0.01);
    if (c) c.classList.add('on');
  }

  function pause() {
    stopAt = null;
    if (mode === 'yt' && player && player.pauseVideo) player.pauseVideo();
    if (!audio.paused) audio.pause();
    setPlaying(false);
  }

  audio.addEventListener('ended', () => setPlaying(false));

  /* --- Sözler --- */

  function renderLyrics() {
    if (!lyr || !song) return;
    lines = [];
    nowLine = -1;
    const s = song;
    if (lyr.synced) {
      const watchOnly = mode === 'watch' || (!ytList.length && !!watchId);
      const n = Number(store.get('lyricChunk')) || 4;
      lines = lyr.synced;
      const groups = [];
      for (let k = 0; k < lines.length; k += n) groups.push(lines.slice(k, k + n).map((l, j) => ({ ...l, k: k + j })));
      const chunkHTML = (g, gi) => {
        const end = gi + 1 < groups.length ? groups[gi + 1][0].t : g[g.length - 1].t + 5;
        return html`<button class="sh-chunk" data-sh="chunk" data-from="${g[0].t.toFixed(2)}" data-to="${end.toFixed(2)}">
          <span class="sh-ct">${icon(watchOnly ? 'arrow' : 'play')}${mmss(g[0].t)}${watchOnly ? ' YouTube\'da' : ''}</span>
          ${g.map((l) => html`<span class="sh-line" data-k="${l.k}">${l.line}</span>`)}
        </button>`;
      };
      body.innerHTML = toHTML(html`
        <p class="sh-hint">${watchOnly ? 'Bir bölüme dokun, YouTube o saniyeden açılsın.' : 'Bir bölüme dokun, o kısım çalsın.'}</p>
        ${groups.map(chunkHTML)}
        <p class="sh-src">Sözler: ${lyr.src}</p>`);
    } else if (lyr.plain) {
      body.innerHTML = toHTML(html`<p class="sh-hint">Bu şarkının zamanlı sözü yok; bölüm bölüm çalınamaz.</p><p class="sh-lyrics">${lyr.plain.trim()}</p><p class="sh-src">Sözler: ${lyr.src}</p>`);
    } else {
      const msg = lyr.instrumental ? 'Bu parça sözsüz. Dinle ile melodiyi hatırla.'
        : lyr.error ? 'Sözlere şu an ulaşılamadı. Biraz sonra tekrar dene.'
          : 'Bu şarkının sözlerini bulamadım.';
      body.innerHTML = toHTML(html`<div class="sh-empty"><p>${msg}</p>
        ${lyr.error ? html`<button class="btn btn--sm" data-sh="retry">${icon('replay')}Tekrar Dene</button>` : ''}
        ${lyr.instrumental ? '' : html`<a class="btn btn--sm" href="${searchURL(s)}" target="_blank" rel="noopener">İnternette Ara</a>`}</div>`);
    }
    body.scrollTop = 0;
  }

  async function loadLyrics() {
    const my = token;
    const s = song;
    lyr = null;
    body.innerHTML = '<div class="sh-wait"><span class="sh-spin dark"></span>Sözler geliyor...</div>';
    setTimeout(() => {
      const wait = body.querySelector('.sh-wait');
      if (!wait || my !== token) return;
      wait.insertAdjacentHTML('afterend', toHTML(html`<div class="sh-empty"><p>Sözler biraz gecikti.</p><a class="btn btn--sm" href="${searchURL(s)}" target="_blank" rel="noopener">İnternette Ara</a></div>`));
    }, 3500);
    let res;
    try {
      res = await lyricsOf(s);
    } catch {
      res = { error: true };
    }
    if (my !== token || !life.alive) return;
    lyr = res;
    renderLyrics();
  }

  function setOpen(on) {
    if (on === open) return;
    open = on;
    root.classList.toggle('is-open', on);
    host.classList.toggle('sh-open', on);
    panel.setAttribute('aria-hidden', String(!on));
    lyrBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      if (!lyr) loadLyrics();
      ensureMedia();
    } else {
      // Oynatıcı görünmezken çalmaz
      pause();
    }
  }

  function reset(next) {
    token++;
    pause();
    song = next;
    lyr = null;
    lines = [];
    mediaReady = null;
    ytList = (next.yt || []).slice();
    watchId = next.ytWatch || null;
    ytIdx = 0;
    mode = 'none';
    setProg(0);
    root.querySelector('[data-title]').textContent = next.text;
    root.querySelector('[data-artist]').textContent = next.hint || '';
    if (player && ytList.length) {
      player.stopVideo();
    } else {
      dropPlayer();
      media.innerHTML = toHTML(mediaHTML('loading', next));
    }
    if (open) {
      loadLyrics();
      ensureMedia();
    }
  }

  life.on(root, 'click', (e) => {
    const b = e.target.closest('[data-sh]');
    if (!b) return;
    // Fareyle tıklanan düğmede odak kalmasın; Boşluk kayda gitsin, düğmeye değil
    if (e.detail > 0 && b.blur) b.blur();
    const k = b.dataset.sh;
    if (k === 'listen') {
      if (recording) return;
      setOpen(true);
      if (playing) pause();
      else play(null);
    } else if (k === 'lyrics') {
      sfx.soft();
      setOpen(!open);
    } else if (k === 'close') {
      sfx.soft();
      setOpen(false);
    } else if (k === 'retry') {
      cache.forEach((v, key) => { if (key.startsWith('l:')) cache.delete(key); });
      loadLyrics();
    } else if (k === 'from0') {
      play(0);
    } else if (k === 'chunk') {
      if (recording) {
        toast('Kayıt sürerken ses çalmaz, mikrofona karışır.', { ms: 1800 });
        return;
      }
      if (mode === 'preview') toast('Bu şarkıda yalnızca kısa kesit var, bölüm çalmaz.', { ms: 1800 });
      play(Number(b.dataset.from), Number(b.dataset.to));
    }
  });
  life.on(window, 'keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });
  life.add(() => {
    token++;
    pause();
    chunkSeg.destroy();
    dropPlayer();
    audio.removeAttribute('src');
    root.remove();
    host.classList.remove('sh-open');
  });

  return {
    show(next) {
      if (!next) {
        this.hide();
        return;
      }
      if (!song || song.text !== next.text || song.hint !== next.hint || String(song.yt) !== String(next.yt) || song.ytWatch !== next.ytWatch) reset(next);
      if (root.hidden) {
        root.hidden = false;
        root.querySelector('.sh-dock').animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    },
    hide() {
      pause();
      setOpen(false);
      root.hidden = true;
    },
    // Kayıtta ses çalmaz, mikrofona karışır; sözler açık kalabilir
    setRecording(on) {
      recording = on;
      if (on) pause();
      if (on && watchOpened) toast('YouTube penceresi açıksa durdur, ses kayda karışmasın.', { tone: 'warn', ms: 3200 });
      listenBtn.disabled = on;
      listenBtn.title = on ? 'Kayıt sırasında ses çalmaz, mikrofona karışır' : '';
      root.classList.toggle('is-rec', on);
    },
  };
}
