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
    // Browsers only allow sound after the first click, tap or key press.
    for (const ev of ['mousedown', 'pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, unlock);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
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
      case 'parry': this.tone(1760, 0.1, 'triangle', 0.12); this.tone(2350, 0.18, 'triangle', 0.09, 0, 0.04); this.noise(0.05, 0.12, 3000); break;
      case 'roll': this.noise(0.18, 0.09, 700); break;
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
      // Footsteps by what's underfoot.
      case 'step_grass': this.noise(0.05, 0.06, 380 + Math.random() * 160); break;
      case 'step_stone': this.noise(0.035, 0.08, 1500 + Math.random() * 500); this.tone(900 + Math.random() * 200, 0.02, 'square', 0.015); break;
      case 'step_wood': this.tone(170 + Math.random() * 30, 0.05, 'triangle', 0.08); this.noise(0.03, 0.05, 700); break;
      case 'step_sand': this.noise(0.07, 0.05, 2600 + Math.random() * 800); break;
      case 'step_snow': this.noise(0.08, 0.07, 1100 + Math.random() * 300); this.noise(0.04, 0.04, 3000, 0.03); break;
      // Work and the world.
      case 'chop': this.tone(140, 0.07, 'triangle', 0.16, -40); this.noise(0.06, 0.14, 600); break;
      case 'stone': this.noise(0.05, 0.2, 2000); this.tone(420, 0.04, 'square', 0.05, -120); break;
      case 'crop': this.noise(0.09, 0.1, 1800); this.noise(0.06, 0.08, 2600, 0.05); break;
      case 'pour': for (let i = 0; i < 5; i++) this.noise(0.1, 0.07, 1200 + i * 250, i * 0.07); break;
      case 'fill': this.tone(300, 0.25, 'sine', 0.06, 500); this.noise(0.2, 0.06, 900); break;
      case 'bite': this.tone(520, 0.05, 'sine', 0.14, -260); this.noise(0.1, 0.12, 700, 0.03); break;
      case 'reel': for (let i = 0; i < 4; i++) this.tone(1800, 0.012, 'square', 0.03, 0, i * 0.035); break;
      case 'catch': this.tone(660, 0.08, 'square', 0.08); this.tone(880, 0.08, 'square', 0.08, 0, 0.08); this.tone(1320, 0.16, 'square', 0.08, 0, 0.16); break;
      case 'equip': this.noise(0.08, 0.12, 1400); this.tone(700, 0.05, 'triangle', 0.05, 200, 0.05); break;
      case 'armor_hit': this.tone(1100 + Math.random() * 300, 0.1, 'square', 0.06, -300); this.noise(0.06, 0.12, 3200); break;
      case 'bow': this.tone(220, 0.12, 'triangle', 0.12, 180); this.noise(0.05, 0.05, 4000); break;
      case 'bell':
        for (const [m, v, d] of [[1, 0.2, 2.2], [2.76, 0.08, 1.4], [5.4, 0.04, 0.9], [8.9, 0.02, 0.5]]) this.tone(392 * m, d, 'sine', v);
        for (const [m, v, d] of [[1, 0.14, 1.8], [2.76, 0.05, 1.1]]) this.tone(392 * m, d, 'sine', v, 0, 0.55);
        break;
      case 'tag': this.tone(900, 0.08, 'square', 0.04, 500); this.tone(1300, 0.06, 'square', 0.03, 300, 0.08); break;
      case 'save': this.tone(784, 0.1, 'triangle', 0.08); this.tone(1175, 0.18, 'triangle', 0.08, 0, 0.1); break;
      case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i === 3 ? 0.35 : 0.1, 'square', 0.08, 0, i * 0.1)); break;
      case 'sleep': this.tone(392, 0.3, 'sine', 0.06, -100); this.tone(330, 0.4, 'sine', 0.05, -80, 0.3); break;
      case 'chest': this.tone(200, 0.1, 'sawtooth', 0.05, 80); this.noise(0.06, 0.06, 500, 0.05); break;
      // Ambience.
      case 'bird': { const f = 2400 + Math.random() * 1200; this.tone(f, 0.06, 'sine', 0.03, 600); this.tone(f * 1.1, 0.05, 'sine', 0.025, -400, 0.09); break; }
      case 'cricket': for (let i = 0; i < 3; i++) this.tone(4200, 0.025, 'square', 0.008, 0, i * 0.05); break;
      case 'owl': this.tone(360, 0.25, 'sine', 0.05, -30); this.tone(340, 0.4, 'sine', 0.05, -30, 0.35); break;
      case 'howl': this.tone(300, 1.4, 'sine', 0.05, 250); break;
      case 'gull': this.tone(1500, 0.18, 'sawtooth', 0.015, -500); this.tone(1400, 0.2, 'sawtooth', 0.012, -500, 0.22); break;
      case 'wave': this.noise(1.2, 0.05, 500); break;
      case 'wind': this.noise(1.6, 0.04, 350); break;
      case 'frog': this.tone(180, 0.08, 'square', 0.03, 60); this.tone(170, 0.08, 'square', 0.03, 60, 0.12); break;
      // Siege engines: a heavy thud (a stone landing, a ram on a wall), the
      // creak and whip of a catapult's arm.
      case 'impact': this.tone(70, 0.3, 'sine', 0.3, -40); this.noise(0.25, 0.3, 260); break;
      case 'catapult': this.tone(160, 0.18, 'sawtooth', 0.06, -80); this.noise(0.22, 0.12, 1600, 0.12); break;
      // A portal: a rising shimmer.
      case 'portal': this.tone(440, 0.4, 'sine', 0.08, 440); this.tone(660, 0.45, 'triangle', 0.05, 660, 0.08); this.noise(0.3, 0.05, 5000); break;
      // A ship's horn, low and long.
      case 'horn': this.tone(110, 0.9, 'sawtooth', 0.06, 8); this.tone(165, 0.9, 'triangle', 0.04, 6); break;
    }
  }
}
