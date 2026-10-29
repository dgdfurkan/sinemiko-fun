// Masa hokeyi fiziği ve çizimi: Burun Hokeyi (kamera) ile Masa Hokeyi (klavye) aynı masayı kullanır.
// Birimler masa birimi: X 0..A (A = en/boy oranı), Y 0..1. Ekrana çizerken piksel = birim × H

import { inked, heartPath, PCOL } from './arena.js';

export const PUCK_R = 0.045;
export const MALLET_R = 0.075;
export const GOAL_H = 0.2;
const MAX_V = 2.8;

export function newHockey(A) {
  return {
    A,
    puck: { X: A / 2, Y: 0.5, vx: 0, vy: 0, rot: 0 },
    mallets: [{ X: A * 0.2, Y: 0.5, vx: 0, vy: 0 }, { X: A * 0.8, Y: 0.5, vx: 0, vy: 0 }],
    trail: [],
    hitCool: 0,
  };
}

// Tokmağı hedefe sınırlı hızla götürür; side 0 sol yarı, 1 sağ yarı
export function moveMallet(h, k, side, tx, ty, dt, maxSpeed = 3.6) {
  const m = h.mallets[k];
  const A = h.A;
  const xmin = side === 0 ? MALLET_R : A / 2 + MALLET_R;
  const xmax = side === 0 ? A / 2 - MALLET_R : A - MALLET_R;
  tx = Math.min(xmax, Math.max(xmin, tx));
  ty = Math.min(1 - MALLET_R, Math.max(MALLET_R, ty));
  const dx = tx - m.X;
  const dy = ty - m.Y;
  const d = Math.hypot(dx, dy);
  const step = maxSpeed * dt;
  const k2 = d > step ? step / d : 1;
  const nx = m.X + dx * k2;
  const ny = m.Y + dy * k2;
  if (dt > 0) {
    m.vx = (nx - m.X) / dt;
    m.vy = (ny - m.Y) / dt;
  }
  m.X = nx;
  m.Y = ny;
}

// Bir adım: çarpışmalar ve gol. Gol olursa atanın tarafını (0 ya da 1) döner, yoksa -1
export function stepHockey(h, dt, { onHit, onWall } = {}) {
  const p = h.puck;
  const A = h.A;
  h.hitCool = Math.max(0, h.hitCool - dt);
  // Hızlı harekette tünellemesin: küçük adımlara böl
  const n = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * dt) / (PUCK_R * 0.5)));
  const sd = dt / n;
  for (let s = 0; s < n; s++) {
    p.X += p.vx * sd;
    p.Y += p.vy * sd;
    if (p.Y < PUCK_R) { p.Y = PUCK_R; p.vy = Math.abs(p.vy) * 0.9; if (onWall) onWall(p); }
    if (p.Y > 1 - PUCK_R) { p.Y = 1 - PUCK_R; p.vy = -Math.abs(p.vy) * 0.9; if (onWall) onWall(p); }
    const inMouth = Math.abs(p.Y - 0.5) < GOAL_H;
    if (p.X < PUCK_R && !inMouth) { p.X = PUCK_R; p.vx = Math.abs(p.vx) * 0.9; if (onWall) onWall(p); }
    if (p.X > A - PUCK_R && !inMouth) { p.X = A - PUCK_R; p.vx = -Math.abs(p.vx) * 0.9; if (onWall) onWall(p); }
    if (p.X < -PUCK_R) return 1;
    if (p.X > A + PUCK_R) return 0;
    h.mallets.forEach((m, k) => {
      const dx = p.X - m.X;
      const dy = p.Y - m.Y;
      const d = Math.hypot(dx, dy);
      const min = PUCK_R + MALLET_R;
      if (d >= min || d === 0) return;
      const nx = dx / d;
      const ny = dy / d;
      p.X = m.X + nx * min;
      p.Y = m.Y + ny * min;
      const rvx = p.vx - m.vx;
      const rvy = p.vy - m.vy;
      const dot = rvx * nx + rvy * ny;
      if (dot < 0) {
        p.vx -= 1.85 * dot * nx;
        p.vy -= 1.85 * dot * ny;
        // Duran tokmağa çarpan pul da biraz hızlansın
        p.vx += nx * 0.25;
        p.vy += ny * 0.25;
        if (onHit && h.hitCool <= 0) {
          h.hitCool = 0.12;
          onHit(k, Math.hypot(p.vx, p.vy));
        }
      }
    });
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > MAX_V) {
    p.vx *= MAX_V / sp;
    p.vy *= MAX_V / sp;
  }
  const fr = Math.max(0, 1 - 0.32 * dt);
  p.vx *= fr;
  p.vy *= fr;
  // Pul bir yarıda durup kalırsa birkaç saniye sonra öbür tarafa doğru kayar; oyun tıkanmaz
  h.still = Math.hypot(p.vx, p.vy) < 0.08 ? (h.still || 0) + dt : 0;
  if (h.still > 2.5) {
    h.still = 0;
    p.vx = (p.X < A / 2 ? 1 : -1) * 0.5;
    p.vy = (Math.random() - 0.5) * 0.4;
  }
  p.rot += (p.vx + p.vy) * dt * 3;
  h.trail.push({ X: p.X, Y: p.Y });
  if (h.trail.length > 10) h.trail.shift();
  return -1;
}

// Gol sonrası pul ortada, gol yiyenin tarafına doğru yavaşça
export function servePuck(h, toward) {
  const p = h.puck;
  p.X = h.A / 2;
  p.Y = 0.5;
  p.vx = (toward === 0 ? -1 : 1) * 0.35;
  p.vy = (Math.random() - 0.5) * 0.4;
  h.trail.length = 0;
}

// Masa: orta çizgi, daireler, kaleler. sides[k]: k. tokmağın oyuncusu (renk için)
export function drawTable(g, h, H, { glass = true, goalColors = PCOL } = {}) {
  const A = h.A;
  const W = A * H;
  if (glass) {
    g.fillStyle = '#ffffff22';
    g.fillRect(0, 0, W, H);
  }
  g.lineWidth = 4;
  g.strokeStyle = '#ffffffcc';
  g.beginPath();
  g.moveTo(W / 2, 0);
  g.lineTo(W / 2, H);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H / 2, H * 0.14, 0, Math.PI * 2);
  g.stroke();
  for (const [x, dir, c] of [[0, 1, goalColors[0]], [W, -1, goalColors[1]]]) {
    g.beginPath();
    g.arc(x, H / 2, H * 0.24, -Math.PI / 2, Math.PI / 2, dir < 0);
    g.strokeStyle = '#ffffffaa';
    g.stroke();
    g.fillStyle = c;
    g.fillRect(dir > 0 ? 0 : W - 10, H * (0.5 - GOAL_H), 10, H * GOAL_H * 2);
    g.strokeStyle = '#2a1636';
    g.lineWidth = 3;
    g.strokeRect(dir > 0 ? 0 : W - 10, H * (0.5 - GOAL_H), 10, H * GOAL_H * 2);
    g.lineWidth = 4;
  }
}

export function drawPuck(g, h, H) {
  const p = h.puck;
  h.trail.forEach((q, k) => {
    g.globalAlpha = (k / h.trail.length) * 0.35;
    g.beginPath();
    g.arc(q.X * H, q.Y * H, PUCK_R * H * (0.5 + (k / h.trail.length) * 0.5), 0, Math.PI * 2);
    g.fillStyle = '#ff5fa2';
    g.fill();
  });
  g.globalAlpha = 1;
  g.save();
  g.translate(p.X * H, p.Y * H);
  g.rotate(p.rot);
  g.beginPath();
  g.arc(0, 0, PUCK_R * H, 0, Math.PI * 2);
  inked(g, '#3a2d5c', 3.5);
  heartPath(g, 0, PUCK_R * H * 0.12, PUCK_R * H * 0.55);
  g.fillStyle = '#ff5fa2';
  g.fill();
  g.restore();
}

export function drawMallet(g, m, H, color, label = '') {
  const x = m.X * H;
  const y = m.Y * H;
  const r = MALLET_R * H;
  g.beginPath();
  g.arc(x, y + 4, r, 0, Math.PI * 2);
  g.fillStyle = '#2a163655';
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  inked(g, color, 4);
  g.beginPath();
  g.arc(x, y, r * 0.55, 0, Math.PI * 2);
  g.fillStyle = '#ffffff55';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#2a1636';
  g.stroke();
  if (label) {
    g.font = `400 ${Math.round(r * 0.5)}px "Lilita One", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a1636';
    g.fillText(label, x, y + 1);
  }
}
