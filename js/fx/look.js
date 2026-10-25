// Blob karakterlerin gözleri imleci takip eder

let px = window.innerWidth / 2;
let py = window.innerHeight / 2;
let queued = false;
let idleTimer = 0;

function update() {
  queued = false;
  const blobs = document.querySelectorAll('.blob');
  for (const b of blobs) {
    const r = b.getBoundingClientRect();
    if (!r.width) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.45;
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.max(140, Math.hypot(dx, dy));
    b.style.setProperty('--lx', (dx / d).toFixed(3));
    b.style.setProperty('--ly', (dy / d).toFixed(3));
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
  // Yeni sahneler eklendiğinde de doğru yöne baksınlar
  new MutationObserver(queue).observe(document.getElementById('app'), { childList: true, subtree: true });
}
