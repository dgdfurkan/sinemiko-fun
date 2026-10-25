// Vücut pozları: kural, kart çizimi ve iki poz arasındaki benzerlik.
// Koordinatlar aynalı ekran düzlemindedir; kişinin sol omzu (11) ekranın solunda görünür.

const VIS = 0.5;
const LIMB = 0.3;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// x en boy oranıyla çarpılır, böylece x ve y aynı ölçekte olur
export function body(lm, ar = 16 / 9) {
  if (!lm || lm.length < 25) return null;
  const P = (k) => ({ x: lm[k].x * ar, y: lm[k].y, v: lm[k].v });
  const b = { n: P(0), ls: P(11), rs: P(12), le: P(13), re: P(14), lw: P(15), rw: P(16), m1: P(9), m2: P(10) };
  if (b.n.v < VIS || b.ls.v < VIS || b.rs.v < VIS) return null;
  b.sw = dist(b.ls, b.rs);
  if (b.sw < 0.02) return null;
  b.mo = { x: (b.m1.x + b.m2.x) / 2, y: (b.m1.y + b.m2.y) / 2 };
  b.mx = (b.ls.x + b.rs.x) / 2;
  b.my = (b.ls.y + b.rs.y) / 2;
  b.arms = [b.le, b.lw, b.re, b.rw].every((p) => p.v > LIMB);
  return b;
}

/* ---------- Kart çizimleri ---------- */

const BASE = { n: [50, 22], ls: [36, 44], rs: [64, 44], lh: [41, 80], rh: [59, 80] };
const REST_L = { le: [31, 62], lw: [30, 79] };
const REST_R = { re: [69, 62], rw: [70, 79] };
const fig = (o) => ({ ...BASE, ...REST_L, ...REST_R, ...o });

// Sağ ve sol yer değiştirir; aynı pozun öbür taraf hali
function mirrorFig(f) {
  const m = (p) => [100 - p[0], p[1]];
  return {
    n: m(f.n), lh: m(f.rh), rh: m(f.lh),
    ls: m(f.rs), rs: m(f.ls), le: m(f.re), re: m(f.le), lw: m(f.rw), rw: m(f.lw),
  };
}

const LEFT_UP = fig({ le: [30, 28], lw: [32, 8] });
const LEAN_L = fig({ n: [41, 24], ls: [33, 52], rs: [60, 40], le: [31, 70], lw: [32, 86], re: [66, 56], rw: [70, 72] });

// Bir kol çapraz yukarıda, öbür kol yüzün önünde; iki yöne de olur
const dabL = (b) => b.lw.x < b.ls.x - 0.7 * b.sw && b.lw.y < b.ls.y - 0.2 * b.sw
  && b.rw.x < b.n.x + 0.3 * b.sw && b.rw.x < b.rs.x - 0.2 * b.sw && b.rw.y < b.rs.y + 0.3 * b.sw;
const dabR = (b) => b.rw.x > b.rs.x + 0.7 * b.sw && b.rw.y < b.rs.y - 0.2 * b.sw
  && b.lw.x > b.n.x - 0.3 * b.sw && b.lw.x > b.ls.x + 0.2 * b.sw && b.lw.y < b.ls.y + 0.3 * b.sw;

/* ---------- Pozlar ---------- */

// test(b, side): side +1 ise partner sağda, -1 ise solda
export const POSES = [
  {
    id: 'up', name: 'Eller Havaya', fig: fig({ le: [31, 27], lw: [33, 7], re: [69, 27], rw: [67, 7] }),
    test: (b) => b.arms && b.lw.y < b.ls.y - 0.6 * b.sw && b.rw.y < b.rs.y - 0.6 * b.sw && Math.max(b.lw.y, b.rw.y) < b.n.y - 0.25 * b.sw,
  },
  {
    id: 'y', name: 'Y Harfi', fig: fig({ le: [25, 31], lw: [14, 15], re: [75, 31], rw: [86, 15] }),
    test: (b) => b.arms && b.lw.y < b.ls.y - 0.8 * b.sw && b.rw.y < b.rs.y - 0.8 * b.sw && b.lw.x < b.ls.x - 0.6 * b.sw && b.rw.x > b.rs.x + 0.6 * b.sw,
  },
  {
    id: 't', name: 'T Pozu', fig: fig({ le: [21, 44], lw: [6, 44], re: [79, 44], rw: [94, 44] }),
    test: (b) => b.arms && b.lw.x < b.ls.x - 0.9 * b.sw && b.rw.x > b.rs.x + 0.9 * b.sw
      && Math.abs(b.lw.y - b.ls.y) < 0.5 * b.sw && Math.abs(b.rw.y - b.rs.y) < 0.5 * b.sw,
  },
  {
    id: 'left', name: 'Sol El Havada', fig: LEFT_UP,
    test: (b) => b.arms && b.lw.y < b.n.y - 0.1 * b.sw && b.rw.y > b.rs.y + 0.2 * b.sw,
  },
  {
    id: 'right', name: 'Sağ El Havada', fig: mirrorFig(LEFT_UP),
    test: (b) => b.arms && b.rw.y < b.n.y - 0.1 * b.sw && b.lw.y > b.ls.y + 0.2 * b.sw,
  },
  {
    id: 'head', name: 'Eller Başa', fig: fig({ le: [22, 30], lw: [42, 9], re: [78, 30], rw: [58, 9] }),
    // Bilekler başın hemen üstünde, dirsekler yana açık
    test: (b) => b.arms && [b.lw, b.rw].every((w) => w.y < b.n.y + 0.1 * b.sw && w.y > b.n.y - 1.1 * b.sw && Math.abs(w.x - b.n.x) < 0.5 * b.sw)
      && dist(b.lw, b.rw) > 0.35 * b.sw && b.le.y < b.ls.y && b.re.y < b.rs.y
      && b.le.x < b.ls.x - 0.2 * b.sw && b.re.x > b.rs.x + 0.2 * b.sw,
  },
  {
    id: 'heart', name: 'Başının Üstünde Kalp', fig: fig({ le: [24, 22], lw: [47, 3], re: [76, 22], rw: [53, 3] }),
    test: (b) => b.arms && dist(b.lw, b.rw) < 0.55 * b.sw && Math.max(b.lw.y, b.rw.y) < b.n.y - 0.4 * b.sw && b.le.x < b.ls.x && b.re.x > b.rs.x,
  },
  {
    id: 'cross', name: 'Kollar Çapraz', fig: fig({ le: [37, 66], lw: [61, 52], re: [63, 66], rw: [39, 52] }),
    test: (b) => b.arms && b.lw.x > b.rw.x + 0.12 * b.sw
      && [b.lw, b.rw].every((w) => w.y > b.ls.y - 0.2 * b.sw && w.y < b.ls.y + 1.8 * b.sw),
  },
  {
    id: 'muscle', name: 'Pazı Göster', fig: fig({ le: [17, 46], lw: [19, 24], re: [83, 46], rw: [81, 24] }),
    test: (b) => b.arms && b.le.x < b.ls.x - 0.4 * b.sw && b.re.x > b.rs.x + 0.4 * b.sw
      && Math.abs(b.le.y - b.ls.y) < 0.6 * b.sw && Math.abs(b.re.y - b.rs.y) < 0.6 * b.sw
      && b.lw.y < b.le.y - 0.35 * b.sw && b.rw.y < b.re.y - 0.35 * b.sw
      && Math.abs(b.lw.x - b.le.x) < 0.45 * b.sw && Math.abs(b.rw.x - b.re.x) < 0.45 * b.sw,
  },
  {
    id: 'think', name: 'Çeneni Tut', fig: fig({ re: [66, 58], rw: [53, 33] }),
    test: (b) => [b.lw, b.rw].some((w) => w.v > LIMB && dist(w, b.mo) < 0.7 * b.sw && w.y > b.n.y - 0.1 * b.sw),
  },
  {
    id: 'hide', name: 'Yüzünü Kapat', fig: fig({ le: [38, 58], lw: [44, 24], re: [62, 58], rw: [56, 24] }),
    test: (b) => b.arms && dist(b.lw, b.n) < 0.75 * b.sw && dist(b.rw, b.n) < 0.75 * b.sw && dist(b.lw, b.rw) < 0.75 * b.sw
      && Math.min(b.lw.y, b.rw.y) > b.n.y - 0.35 * b.sw,
  },
  {
    id: 'leanl', name: 'Sola Yat', fig: LEAN_L,
    test: (b) => b.ls.y - b.rs.y > 0.25 * b.sw && b.n.x < b.mx - 0.12 * b.sw,
  },
  {
    id: 'leanr', name: 'Sağa Yat', fig: mirrorFig(LEAN_L),
    test: (b) => b.rs.y - b.ls.y > 0.25 * b.sw && b.n.x > b.mx + 0.12 * b.sw,
  },
  {
    id: 'point', name: 'Partnerini Göster', fig: fig({ re: [78, 43], rw: [94, 41] }),
    test: (b, side) => {
      if (!b.arms) return false;
      const near = side > 0 ? b.rs : b.ls;
      const far = side > 0 ? b.ls : b.rs;
      const out = (w) => (w.x - near.x) * side > 0.9 * b.sw && Math.abs(w.y - b.ls.y) < 0.7 * b.sw;
      // T pozunu saymasın: öbür kol karşı tarafa açılmamalı
      const open = (w) => (w.x - far.x) * -side > 0.5 * b.sw;
      return (out(b.lw) && !open(b.rw)) || (out(b.rw) && !open(b.lw));
    },
  },
  {
    id: 'dab', name: 'Dab!', fig: fig({ le: [22, 34], lw: [8, 20], re: [52, 38], rw: [40, 25] }),
    test: (b) => b.arms && (dabL(b) || dabR(b)),
  },
  {
    id: 'pray', name: 'Avuçları Birleştir', fig: fig({ le: [37, 66], lw: [49, 56], re: [63, 66], rw: [51, 56] }),
    test: (b) => b.arms && dist(b.lw, b.rw) < 0.4 * b.sw && Math.abs((b.lw.x + b.rw.x) / 2 - b.mx) < 0.6 * b.sw
      && [b.lw, b.rw].every((w) => w.y > b.ls.y + 0.1 * b.sw && w.y < b.ls.y + 1.8 * b.sw),
  },
];

export const poseById = (id) => POSES.find((p) => p.id === id);

// Kartta görünen sevimli çöp adam
export function figSVG(f, color = '#ffcd3c', cls = '') {
  const L = (a, b, w, c) => `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const limb = (a, b, c) => L(a, b, 11, '#2a1636') + L(b, c, 11, '#2a1636') + L(a, b, 6, color) + L(b, c, 6, color);
  const foot = (h, dx) => [h[0] + dx, 104];
  const hand = (p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.2" fill="#fff" stroke="#2a1636" stroke-width="2.6"/>`;
  const [nx, ny] = f.n;
  return `<svg class="pose-fig ${cls}" viewBox="-4 -6 108 116" aria-hidden="true">
    ${L(f.lh, foot(f.lh, -3), 11, '#2a1636')}${L(f.rh, foot(f.rh, 3), 11, '#2a1636')}
    ${L(f.lh, foot(f.lh, -3), 6, color)}${L(f.rh, foot(f.rh, 3), 6, color)}
    <path d="M${f.ls[0]} ${f.ls[1]}L${f.rs[0]} ${f.rs[1]}L${f.rh[0]} ${f.rh[1]}L${f.lh[0]} ${f.lh[1]}Z" fill="${color}" stroke="#2a1636" stroke-width="3.2" stroke-linejoin="round"/>
    ${limb(f.ls, f.le, f.lw)}${limb(f.rs, f.re, f.rw)}${hand(f.lw)}${hand(f.rw)}
    <circle cx="${nx}" cy="${ny}" r="11.5" fill="${color}" stroke="#2a1636" stroke-width="3.2"/>
    <circle cx="${nx - 4}" cy="${ny - 1.5}" r="1.9" fill="#2a1636"/><circle cx="${nx + 4}" cy="${ny - 1.5}" r="1.9" fill="#2a1636"/>
    <path d="M${nx - 4} ${ny + 3.5}q4 3.6 8 0" fill="none" stroke="#2a1636" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
}

/* ---------- Kopya Kedi için poz karşılaştırma ---------- */

const ang = (a, c) => Math.atan2(c.y - a.y, c.x - a.x);
const angDiff = (a, b) => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

// Kolların ve gövdenin açıları; boydan ve kameraya uzaklıktan bağımsız
export function poseVec(b) {
  return {
    a: [ang(b.ls, b.le), ang(b.le, b.lw), ang(b.rs, b.re), ang(b.re, b.rw)],
    vis: [b.le.v > LIMB, b.le.v > LIMB && b.lw.v > LIMB, b.re.v > LIMB, b.re.v > LIMB && b.rw.v > LIMB],
    len: [dist(b.ls, b.le) / b.sw, dist(b.le, b.lw) / b.sw, dist(b.rs, b.re) / b.sw, dist(b.re, b.rw) / b.sw],
    tilt: ang(b.ls, b.rs),
    head: { x: (b.n.x - b.mx) / b.sw, y: (b.n.y - b.my) / b.sw },
  };
}

// 0 ile 1 arası; 30 derecelik ortalama sapma yaklaşık 0,8 verir
export function similarity(t, c) {
  const near = (d, span) => Math.max(0, 1 - (d / span) ** 1.5);
  const deg = Math.PI / 180;
  let sum = 0;
  let w = 0;
  for (let k = 0; k < 4; k++) {
    if (!t.vis[k]) continue;
    sum += c.vis[k] ? near(angDiff(t.a[k], c.a[k]), 100 * deg) : 0;
    w += 1;
  }
  sum += 0.6 * near(angDiff(t.tilt, c.tilt), 40 * deg);
  w += 0.6;
  sum += 0.4 * near(Math.hypot(t.head.x - c.head.x, t.head.y - c.head.y), 0.6);
  w += 0.4;
  return sum / w;
}
