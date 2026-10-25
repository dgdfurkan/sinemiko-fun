// Çizim tuvali: çizgiler oransal koordinatla saklanır, boyut değişince aynen yeniden çizilir

export class Sketch {
  constructor(canvas, { bg = '#fffdf8', onStroke = null } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.bg = bg;
    this.strokes = [];
    this.cur = null;
    this.color = '#2a1636';
    this.size = 10;
    this.erase = false;
    this.enabled = true;
    this.onStroke = onStroke;
    this.w = 0;
    this.h = 0;
    this.handlers = {
      down: (e) => this.down(e),
      move: (e) => this.move(e),
      up: (e) => this.up(e),
    };
    canvas.addEventListener('pointerdown', this.handlers.down);
    canvas.addEventListener('pointermove', this.handlers.move);
    canvas.addEventListener('pointerup', this.handlers.up);
    canvas.addEventListener('pointercancel', this.handlers.up);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.redraw();
  }

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  down(e) {
    if (!this.enabled || (e.button !== undefined && e.button > 0)) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    // Kalınlık 1000 piksellik genişliğe göre oransal saklanır
    this.cur = { c: this.erase ? this.bg : this.color, s: this.size / 1000, pts: [this.point(e)] };
    this.strokes.push(this.cur);
    this.paintTail(this.cur);
  }

  move(e) {
    if (!this.cur) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      this.cur.pts.push(this.point(ev));
      this.paintTail(this.cur);
    }
  }

  up() {
    if (!this.cur) return;
    this.cur = null;
    if (this.onStroke) this.onStroke();
  }

  prep(st) {
    const { g } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = st.c;
    g.fillStyle = st.c;
    g.lineWidth = Math.max(1.5, st.s * this.w);
  }

  // Son eklenen noktaya kadar olan kısmı yumuşak eğriyle çizer
  paintTail(st) {
    const { g } = this;
    const p = st.pts;
    const n = p.length;
    const X = (q) => q[0] * this.w;
    const Y = (q) => q[1] * this.h;
    this.prep(st);
    if (n === 1) {
      g.beginPath();
      g.arc(X(p[0]), Y(p[0]), g.lineWidth / 2, 0, Math.PI * 2);
      g.fill();
      return;
    }
    g.beginPath();
    if (n === 2) {
      g.moveTo(X(p[0]), Y(p[0]));
      g.lineTo(X(p[1]), Y(p[1]));
    } else {
      const a = p[n - 3];
      const b = p[n - 2];
      const c = p[n - 1];
      g.moveTo((X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2);
      g.quadraticCurveTo(X(b), Y(b), (X(b) + X(c)) / 2, (Y(b) + Y(c)) / 2);
    }
    g.stroke();
  }

  paintStroke(st) {
    const { g } = this;
    const p = st.pts;
    const X = (q) => q[0] * this.w;
    const Y = (q) => q[1] * this.h;
    this.prep(st);
    if (p.length === 1) {
      g.beginPath();
      g.arc(X(p[0]), Y(p[0]), g.lineWidth / 2, 0, Math.PI * 2);
      g.fill();
      return;
    }
    g.beginPath();
    g.moveTo(X(p[0]), Y(p[0]));
    if (p.length === 2) {
      g.lineTo(X(p[1]), Y(p[1]));
    } else {
      g.lineTo((X(p[0]) + X(p[1])) / 2, (Y(p[0]) + Y(p[1])) / 2);
      for (let i = 1; i < p.length - 1; i++) {
        g.quadraticCurveTo(X(p[i]), Y(p[i]), (X(p[i]) + X(p[i + 1])) / 2, (Y(p[i]) + Y(p[i + 1])) / 2);
      }
      g.lineTo(X(p[p.length - 1]), Y(p[p.length - 1]));
    }
    g.stroke();
  }

  redraw() {
    const { g } = this;
    if (!this.w) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = this.bg;
    g.fillRect(0, 0, this.w, this.h);
    for (const st of this.strokes) this.paintStroke(st);
  }

  undo() {
    this.cur = null;
    this.strokes.pop();
    this.redraw();
  }

  clear() {
    this.cur = null;
    this.strokes = [];
    this.redraw();
  }

  get empty() {
    return this.strokes.length === 0;
  }

  // Küçük boyutlu PNG; galeride ve indirmede kullanılır
  snapshot(maxW = 640) {
    const scale = Math.min(1, maxW / this.canvas.width);
    const c = document.createElement('canvas');
    c.width = Math.round(this.canvas.width * scale);
    c.height = Math.round(this.canvas.height * scale);
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  destroy() {
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.handlers.down);
    this.canvas.removeEventListener('pointermove', this.handlers.move);
    this.canvas.removeEventListener('pointerup', this.handlers.up);
    this.canvas.removeEventListener('pointercancel', this.handlers.up);
  }
}
