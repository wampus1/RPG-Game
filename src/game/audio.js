// Tiny synthesized chiptune sound effects (no audio files).
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.35;
    this.last = new Map();
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.volume;
          this.master.connect(this.ctx.destination);
          this.noiseBuf = this.makeNoise();
        } catch {
          this.enabled = false;
        }
      } else if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('mousedown', unlock);
    window.addEventListener('keydown', unlock);
  }

  makeNoise() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1200, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  // `src` (optional) is an entity; far-away sounds are skipped.
  play(name, src = null, game = null) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (src && this.listener && Math.hypot(src.x - this.listener.x, src.z - this.listener.z) > 14) return;
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < 40) return;
    this.last.set(name, now);
    switch (name) {
      case 'step': this.noise(0.05, 0.08, 500 + Math.random() * 300); break;
      case 'splash': this.noise(0.15, 0.12, 900); break;
      case 'dig': this.noise(0.07, 0.2, 350 + Math.random() * 200); break;
      case 'break': this.noise(0.18, 0.28, 300); this.tone(140, 0.12, 'square', 0.08, -60); break;
      case 'place': this.tone(220, 0.06, 'square', 0.12, -80); this.noise(0.05, 0.1, 600); break;
      case 'pickup': this.tone(660, 0.06, 'square', 0.1); this.tone(990, 0.08, 'square', 0.1, 0, 0.05); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.1); this.tone(1318, 0.12, 'square', 0.1, 0, 0.06); break;
      case 'door': this.tone(180, 0.12, 'sawtooth', 0.08, -60); this.noise(0.08, 0.08, 400); break;
      case 'swing': this.noise(0.08, 0.1, 2200); break;
      case 'hit': this.noise(0.1, 0.25, 800); this.tone(200, 0.08, 'square', 0.12, -120); break;
      case 'hurt': this.tone(300, 0.2, 'square', 0.18, -200); break;
      case 'death': this.tone(400, 0.5, 'triangle', 0.2, -350); break;
      case 'clang': this.tone(1400 + Math.random() * 200, 0.12, 'triangle', 0.08); break;
      case 'craft': this.tone(523, 0.07, 'square', 0.1); this.tone(659, 0.07, 'square', 0.1, 0, 0.07); this.tone(784, 0.12, 'square', 0.1, 0, 0.14); break;
      case 'ui_open': this.tone(440, 0.05, 'square', 0.06, 400); break;
      case 'ui_close': this.tone(700, 0.05, 'square', 0.06, -350); break;
      case 'select': this.tone(880, 0.03, 'square', 0.05); break;
      case 'eat': this.noise(0.06, 0.15, 700); this.noise(0.06, 0.15, 600, 0.1); break;
      case 'alarm': this.tone(880, 0.15, 'square', 0.1); this.tone(660, 0.15, 'square', 0.1, 0, 0.16); break;
      case 'torch': this.noise(0.2, 0.1, 2500); break;
      case 'error': this.tone(120, 0.1, 'square', 0.1); break;
    }
  }
}
