// Blob karakterlerin gözleri imleci takip eder

let px = window.innerWidth / 2;
let py = window.innerHeight / 2;
let queued = false;
let idleTimer = 0;

// Konumlar her karede ölçülmez: ölçüm sayfa düzenini zorlar, fare hareketinde kasma yapar.
// Sahne değişince, pencere boyutu değişince ya da en geç saniyede bir yeniden ölçülür.
let rects = [];
let measuredAt = 0;
let dirty = true;
const last = new WeakMap();

function measure() {
  rects = [];
  for (const b of document.querySelectorAll('.blob')) {
    const r = b.getBoundingClientRect();
    if (r.width) rects.push({ b, cx: r.left + r.width / 2, cy: r.top + r.height * 0.45 });
  }
  measuredAt = performance.now();
  dirty = false;
}

function update() {
  queued = false;
  if (dirty || performance.now() - measuredAt > 1000) measure();
  for (const { b, cx, cy } of rects) {
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.max(140, Math.hypot(dx, dy));
    const lx = Math.round((dx / d) * 50) / 50;
    const ly = Math.round((dy / d) * 50) / 50;
    const prev = last.get(b);
    // Değer değişmediyse stil yazılmaz; gereksiz stil hesabı olmaz
    if (prev && prev[0] === lx && prev[1] === ly) continue;
    last.set(b, [lx, ly]);
    b.style.setProperty('--lx', String(lx));
    b.style.setProperty('--ly', String(ly));
  }
}

function queue() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(update);
  }
}

export function initLook() {
  window.addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    queue();
    clearTimeout(idleTimer);
    // İmleç uzun süre durursa gözler etrafa bakınır
    idleTimer = setTimeout(function glance() {
      px = Math.random() * window.innerWidth;
      py = Math.random() * window.innerHeight * 0.8;
      queue();
      idleTimer = setTimeout(glance, 2500 + Math.random() * 3000);
    }, 6000);
  }, { passive: true });
  // Yeni sahne gelince, giriş animasyonu bitince bir kez güncelle; DOM'u sürekli izleme
  const remeasure = () => {
    dirty = true;
    queue();
  };
  window.addEventListener('sf:scene', () => {
    setTimeout(remeasure, 60);
    setTimeout(remeasure, 700);
  });
  window.addEventListener('resize', remeasure, { passive: true });
}
