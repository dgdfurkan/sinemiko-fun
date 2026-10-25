// Kalıcı ayarlar: isimler, ses düzeyleri, baloncuk sayacı, rekorlar

const KEY = 'sinemiko-fun/v1';
const DEFAULT_NAMES = ['Furkan', 'Sinem'];
const listeners = new Set();

const num = (v, fallback, min = 0, max = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const cleanName = (v, fallback) => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 14) : '';
  return s || fallback;
};

function load() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  const names = Array.isArray(saved.names) ? saved.names : [];
  const best = saved.best && typeof saved.best === 'object' ? saved.best : {};
  return {
    names: [cleanName(names[0], DEFAULT_NAMES[0]), cleanName(names[1], DEFAULT_NAMES[1])],
    musicOn: bool(saved.musicOn, true),
    musicVol: num(saved.musicVol, 0.55),
    sfxVol: num(saved.sfxVol, 0.8),
    bubbles: bool(saved.bubbles, true),
    popped: num(saved.popped, 0, 0, 1e9),
    maskVol: num(saved.maskVol, 0.7),
    homeTab: typeof saved.homeTab === 'string' ? saved.homeTab : 'all',
    best: { ...best },
  };
}

let state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Gizli sekmede depolama kapalı olabilir; oyun yine çalışır
  }
}

export const store = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state = { ...state, [key]: value };
    persist();
    listeners.forEach((fn) => fn(key, value));
  },
  setName(i, value) {
    const names = state.names.slice();
    names[i] = cleanName(value, DEFAULT_NAMES[i]);
    this.set('names', names);
  },
  // Yeni rekorsa kaydeder ve true döner
  setBest(game, value) {
    const prev = state.best[game];
    if (typeof prev === 'number' && prev >= value) return false;
    this.set('best', { ...state.best, [game]: value });
    return true;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const nameOf = (i) => state.names[i];
