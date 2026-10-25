// Ses dalgası çizimi; kayıtta canlı, dinlemede ilerleme çubuğuyla

import { peaks } from '../audio/clip.js';

export class Waveform {
  constructor(canvas, { bars = 56 } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.bars = bars;
    this.values = new Array(bars).fill(0.04);
    this.progress = 0;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.colors = null;
    this.draw();
  }

  setBuffer(buffer) {
    this.values = peaks(buffer, this.bars);
    this.progress = 0;
    this.draw();
  }

  setValues(values) {
    this.values = values;
    this.draw();
  }

  setProgress(p) {
    this.progress = p;
    this.draw();
  }

  draw() {
    const { g, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return;
    if (!this.colors) {
      const cs = getComputedStyle(canvas);
      this.colors = [cs.getPropertyValue('--wf-on').trim() || '#ff5fa2', cs.getPropertyValue('--wf-off').trim() || '#2a163640'];
    }
    const [on, off] = this.colors;
    g.clearRect(0, 0, W, H);
    const n = this.values.length;
    const slot = W / n;
    const bw = Math.max(2, slot * 0.58);
    for (let i = 0; i < n; i++) {
      const v = Math.max(0.06, Math.min(1, this.values[i]));
      const h = v * H * 0.92;
      const x = i * slot + (slot - bw) / 2;
      const y = (H - h) / 2;
      g.fillStyle = (i + 0.5) / n <= this.progress ? on : off;
      const r = Math.min(bw / 2, h / 2);
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, bw, h, r);
      else g.rect(x, y, bw, h);
      g.fill();
    }
  }

  destroy() {
    this.ro.disconnect();
  }
}
