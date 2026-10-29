// El hareketleri: parmak sayma, el işaretleri, çimdik.
// lm: 21 nokta, aynalı ekran düzleminde 0-1. 0 bilek, 1-4 başparmak, 5-8 işaret, 9-12 orta, 13-16 yüzük, 17-20 serçe.
// Ölçüler elin kendi büyüklüğüne (bilek ile orta parmak kökü arası) bölünür: el kameraya yakın da olsa uzak da olsa aynı sonuç

const dist = (a, b, ar) => Math.hypot((a.x - b.x) * ar, a.y - b.y);
const FINGERS = [[8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17]];

export function fingers(h, ar = 16 / 9) {
  const lm = h.lm;
  const palm = dist(lm[0], lm[9], ar) || 0.01;
  // Başparmak: ucu serçe kökünden eklemine göre daha uzaksa ve işaret köküne yapışık değilse açık
  const thumb = dist(lm[4], lm[17], ar) > dist(lm[3], lm[17], ar) * 1.08 && dist(lm[4], lm[5], ar) > palm * 0.45 && dist(lm[4], lm[9], ar) > palm * 0.6;
  const ext = [thumb];
  for (const [tip, pip, mcp] of FINGERS) {
    // Parmak ucu bilekten orta eklemine göre belirgin uzaksa açık; yön önemli değil, el yan dursa da sayar
    ext.push(dist(lm[tip], lm[0], ar) > dist(lm[pip], lm[0], ar) * 1.1 && dist(lm[tip], lm[mcp], ar) > palm * 0.42);
  }
  return { ext, count: ext.filter(Boolean).length, palm };
}

// İki elin parmak toplamı (0-10)
export const fingerCount = (p, ar = 16 / 9) => (p && p.hands ? p.hands.reduce((s, h) => s + fingers(h, ar).count, 0) : 0);

export const pinchOf = (h, ar = 16 / 9) => {
  const { palm } = fingers(h, ar);
  return dist(h.lm[4], h.lm[8], ar) / palm;
};

export const pinchPoint = (h) => ({ x: (h.lm[4].x + h.lm[8].x) / 2, y: (h.lm[4].y + h.lm[8].y) / 2 });
export const palmOf = (h) => ({ x: (h.lm[0].x + h.lm[5].x + h.lm[17].x + h.lm[9].x) / 4, y: (h.lm[0].y + h.lm[5].y + h.lm[17].y + h.lm[9].y) / 4 });

// El işareti: emoji karşılığı olan kalıplar. Hiçbiri değilse null
export function gesture(h, ar = 16 / 9) {
  const { ext, palm } = fingers(h, ar);
  const [T, I, M, R, P] = ext;
  const lm = h.lm;
  const pinch = dist(lm[4], lm[8], ar) < palm * 0.38;
  if (pinch && M && R && P) return 'ok';
  if (I && M && R && P) return T ? 'open' : 'four';
  if (!I && !M && !R && !P) {
    // Başparmak yukarı: ucu bilekten ve işaret kökünden belirgin yukarıda
    if (T && lm[4].y < lm[5].y - palm * 0.25 && lm[4].y < lm[0].y - palm * 0.5) return 'thumb';
    if (T && lm[4].y > lm[0].y + palm * 0.2) return 'down';
    return 'fist';
  }
  if (I && M && !R && !P) return 'peace';
  if (I && !M && !R && P) return T ? 'love' : 'rock';
  if (!I && !M && !R && P && T) return 'call';
  if (I && !M && !R && !P) return T ? 'gun' : 'point';
  if (I && M && R && !P) return 'three';
  return null;
}

// İki elden birinin işareti uyuyorsa yeter
export const hasGesture = (p, g, ar = 16 / 9) => !!(p && p.hands && p.hands.some((h) => gesture(h, ar) === g));

/* ---------- Çizim ---------- */

const CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];

// Sevimli el iskeleti: kalın kontur, oyuncu renginde kemik, parmak uçlarında beyaz nokta
export function drawHand(g, W, H, h, color, { alpha = 1, tips = true } = {}) {
  const lm = h.lm;
  const s = Math.max(4, Math.min(12, h.size * H * 0.12 || 7));
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    for (const ch of CHAINS) {
      g.moveTo(lm[ch[0]].x * W, lm[ch[0]].y * H);
      for (let k = 1; k < ch.length; k++) g.lineTo(lm[ch[k]].x * W, lm[ch[k]].y * H);
    }
  };
  path();
  g.lineWidth = s + 6;
  g.strokeStyle = '#2a1636';
  g.stroke();
  path();
  g.lineWidth = s;
  g.strokeStyle = color;
  g.stroke();
  if (tips) {
    for (const k of [4, 8, 12, 16, 20]) {
      g.beginPath();
      g.arc(lm[k].x * W, lm[k].y * H, s * 0.75, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = '#2a1636';
      g.stroke();
    }
  }
  g.restore();
}

export const GESTURES = {
  fist: { emoji: '✊', name: 'Yumruk' },
  open: { emoji: '🖐️', name: 'Açık El' },
  peace: { emoji: '✌️', name: 'Zafer' },
  thumb: { emoji: '👍', name: 'Süper' },
  rock: { emoji: '🤘', name: 'Rock' },
  ok: { emoji: '👌', name: 'Tamam' },
  point: { emoji: '☝️', name: 'İşaret' },
  call: { emoji: '🤙', name: 'Ara Beni' },
  love: { emoji: '🤟', name: 'Seni Seviyorum' },
  gun: { emoji: '👉', name: 'Tabanca' },
  three: { emoji: '3️⃣', name: 'Üç' },
};
