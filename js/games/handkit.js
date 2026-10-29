// El oyunlarının ortak çizimleri: ortadaki bölme çizgisi, eller, oyuncu adları

import { nameOf } from '../lib/store.js';
import { drawHand } from '../vision/hands.js';
import { PCOL, tag } from './arena.js';

// Herkes ellerini kendi yarısında tutar; çizgi bunu hatırlatır
export function divider(g, W, H) {
  g.save();
  g.setLineDash([12, 12]);
  g.beginPath();
  g.moveTo(W / 2, 0);
  g.lineTo(W / 2, H);
  g.lineWidth = 5;
  g.strokeStyle = '#ffffffaa';
  g.stroke();
  g.restore();
}

export function drawPlayerHands(g, cam, players, { alpha = 1 } = {}) {
  players.forEach((p, i) => {
    if (!p || !p.hands) return;
    for (const h of p.hands) drawHand(g, cam.W, cam.H, h, PCOL[i], { alpha });
  });
}

// Bekleme ekranında eller ve adlar
export function handIdle(ctx, g, players) {
  const { cam } = ctx;
  divider(g, cam.W, cam.H);
  drawPlayerHands(g, cam, players);
  for (const i of [0, 1]) {
    const [a, b] = ctx.half(i);
    tag(g, ((a + b) / 2) * cam.W, cam.H - 40, `${nameOf(i)} burada`, PCOL[i], 16);
  }
}
