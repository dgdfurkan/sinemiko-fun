// Mikrofon örneklerini ham PCM olarak toplar; 4096'lık parçalar halinde ana iş parçacığına yollar
class SinemikoCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.buf = new Float32Array(4096);
    this.fill = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') {
        this.fill = 0;
        this.on = true;
      } else if (e.data === 'stop') {
        this.on = false;
        if (this.fill) this.port.postMessage(this.buf.slice(0, this.fill));
        this.fill = 0;
        this.port.postMessage('done');
      }
    };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (this.on && ch) {
      let i = 0;
      while (i < ch.length) {
        const n = Math.min(ch.length - i, this.buf.length - this.fill);
        this.buf.set(ch.subarray(i, i + n), this.fill);
        this.fill += n;
        i += n;
        if (this.fill === this.buf.length) {
          this.port.postMessage(this.buf.slice(0));
          this.fill = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('sinemiko-capture', SinemikoCapture);
