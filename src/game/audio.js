// Tiny synthesized chiptune sound effects (no audio files), and (round
// 66) the sounds of the world's mods, played from their clips.
import { MODS } from '../mod/state.js';
import { clipBuffer } from '../mod/sound.js';

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

  // A note that grows rather than fades (and its pitch climbing with it),
  // cut off at the end.
  swell(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0005, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);
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

  // `src` (optional) is an entity; far-away sounds are skipped. (Round 66:
  // a mod's sound by its key, 'm:mod:id'; `o`: { vol, pitch } for it.)
  play(name, src = null, game = null, o = null) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (src && this.listener && Math.hypot(src.x - this.listener.x, src.z - this.listener.z) > 14) return;
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < 40) return;
    this.last.set(name, now);
    if (typeof name === 'string' && name.startsWith('m:')) {
      const r = MODS.sounds.get(name);
      if (r) this.playClip(r.v, o || {});
      return;
    }
    this.voice(name);
  }

  // (Round 66) A sound clip (a mod's: see mod/sound.js) played as it is,
  // as loud as it says (times `o.vol`), faster and higher by `o.pitch`.
  // Returns its source (to stop it), or null.
  playClip(s, o = {}) {
    if (!this.ctx || !this.master) return null;
    const buf = clipBuffer(this.ctx, s);
    if (!buf) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    const p = Math.max(0.25, Math.min(4, +o.pitch || 1));
    if (p !== 1) src.playbackRate.value = p;
    const g = c.createGain();
    g.gain.value = Math.max(0, Math.min(3, (s.vol ?? 1) * (o.vol ?? 1)));
    src.connect(g).connect(o.dest || this.master);
    src.start(c.currentTime + (o.delay || 0));
    return src;
  }

  // One of the game's own sounds, by name.
  voice(name) {
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
      // Three crunchy bites, then a swallow.
      case 'eat':
        for (let i = 0; i < 3; i++) {
          this.noise(0.05, 0.16, 900 + Math.random() * 700, i * 0.13);
          this.noise(0.03, 0.08, 2600 + Math.random() * 800, i * 0.13 + 0.01);
        }
        this.tone(180, 0.09, 'sine', 0.07, -60, 0.42);
        break;
      // Drinking: two gulps.
      case 'gulp': this.tone(240, 0.08, 'sine', 0.1, -120); this.noise(0.05, 0.05, 500, 0.02); this.tone(220, 0.09, 'sine', 0.1, -110, 0.2); this.noise(0.05, 0.05, 450, 0.22); break;
      // Mended: a soft rising chime.
      case 'heal': this.tone(660, 0.18, 'sine', 0.05, 220); this.tone(990, 0.25, 'sine', 0.035, 330, 0.08); break;
      // (Round 64) A shimmer of magic (a mod's sound to pick: it was silent).
      case 'magic': this.tone(784, 0.14, 'sine', 0.06, 400); this.tone(1175, 0.18, 'triangle', 0.04, 300, 0.06); this.tone(1568, 0.24, 'sine', 0.03, 500, 0.12); this.noise(0.18, 0.03, 5200, 0.02); break;
      // Close to death: your heart in your ears.
      case 'heartbeat': this.tone(55, 0.12, 'sine', 0.22, -15); this.tone(50, 0.14, 'sine', 0.16, -15, 0.18); break;
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
      case 'draw': this.tone(110, 0.3, 'sawtooth', 0.025, 70); this.noise(0.22, 0.03, 700); break;
      case 'chirp': for (let i = 0; i < 3; i++) this.tone(2400 + Math.random() * 600, 0.04, 'sine', 0.025, 900, i * 0.07); break;
      case 'hoot': this.tone(330, 0.32, 'sine', 0.05, -30); this.tone(300, 0.5, 'sine', 0.045, -40, 0.42); break;
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
      // Breath torn out of you: a hollow inward rush.
      case 'drain': this.noise(0.35, 0.08, 900); this.tone(520, 0.35, 'sine', 0.05, -380); break;
      // The stones: ice cracking shut, a void's swallow, a mirror's ring,
      // moonlight's chime, a wet blood-red cut, thunder close by.
      case 'freeze': this.noise(0.12, 0.12, 5200); this.tone(1900, 0.2, 'triangle', 0.05, -900, 0.04); break;
      case 'void': this.tone(90, 0.5, 'sine', 0.14, -50); this.tone(180, 0.45, 'sawtooth', 0.03, -150); this.noise(0.35, 0.05, 300, 0.05); break;
      case 'reflect': this.tone(2200, 0.14, 'triangle', 0.08, 600); this.tone(3300, 0.2, 'sine', 0.05, 0, 0.05); break;
      // A witch-light let go (a wobbling rise), and it glancing off a wall.
      case 'orb': this.tone(330, 0.45, 'sine', 0.08, 330); this.tone(495, 0.4, 'triangle', 0.03, 495, 0.05); this.noise(0.25, 0.03, 700); break;
      case 'orbBounce': this.tone(620 + Math.random() * 80, 0.12, 'sine', 0.05, -260); break;
      case 'moon': this.tone(880, 0.5, 'sine', 0.06, 220); this.tone(1320, 0.6, 'sine', 0.04, 330, 0.08); this.tone(1760, 0.5, 'sine', 0.025, 0, 0.16); break;
      case 'bleed': this.noise(0.1, 0.12, 1300); this.tone(240, 0.12, 'sine', 0.05, -120, 0.02); break;
      case 'thunder': this.noise(0.9, 0.3, 160); this.noise(0.4, 0.18, 900, 0.02); this.tone(60, 0.8, 'sine', 0.2, -20); break;
      // The mountain going up: a crack, then a long deep roar that rolls on.
      case 'eruption': this.noise(0.5, 0.4, 220); this.noise(3.2, 0.32, 110, 0.15); this.noise(2.4, 0.14, 600, 0.3); this.tone(40, 3.5, 'sine', 0.3, -12); this.tone(55, 2.8, 'sawtooth', 0.05, -20, 0.2); break;
      // Underground: a lever, a gate grinding, a trap's click and its dart,
      // stone crumbling away, something heavy walking, a hum of old power,
      // a lift going down, runes waking, a beam of light.
      case 'lever': this.tone(260, 0.06, 'square', 0.08, -90); this.noise(0.08, 0.1, 900, 0.04); break;
      case 'gate': for (let i = 0; i < 6; i++) this.noise(0.09, 0.08, 300 + i * 20, i * 0.09); this.tone(90, 0.6, 'sawtooth', 0.03, -10); break;
      case 'click': this.tone(1800, 0.02, 'square', 0.06); this.tone(1200, 0.02, 'square', 0.05, 0, 0.03); break;
      case 'dart': this.noise(0.08, 0.1, 4200); this.tone(900, 0.06, 'triangle', 0.04, -500); break;
      case 'crumble': for (let i = 0; i < 5; i++) this.noise(0.12, 0.12, 250 + Math.random() * 300, i * 0.06); break;
      case 'stomp': this.tone(55, 0.22, 'sine', 0.22, -20); this.noise(0.12, 0.14, 180); break;
      case 'hum': this.tone(110, 0.8, 'sawtooth', 0.02, 0); this.tone(220, 0.8, 'sine', 0.025, 4); break;
      // A vent breathing out; a deep pulse through the Kavorent's floors.
      case 'hiss': this.noise(0.7, 0.025, 3800); this.noise(0.5, 0.015, 1600, 0.1); break;
      case 'pulse': this.tone(55, 1.2, 'sine', 0.07, 0); this.tone(82.5, 1.0, 'triangle', 0.02, 0, 0.05); break;
      case 'lift': this.tone(140, 1.4, 'sawtooth', 0.03, -60); this.tone(70, 1.4, 'sine', 0.06, -20); this.noise(1.2, 0.03, 600); break;
      // A Kavorent lift's ride: the drive spinning up, each band of light
      // rushing past, the drive winding down to a stop with a clunk.
      case 'lift_go': this.swell(90, 1.4, 'sawtooth', 0.025, 140); this.swell(180, 1.4, 'sine', 0.035, 280); this.noise(1.2, 0.02, 500); this.tone(1200, 0.2, 'sine', 0.02, 300, 0.05); break;
      // The rite: a glyph cut in light; the circle catching; and you, back.
      case 'etch': this.tone(1800 + Math.random() * 600, 0.25, 'triangle', 0.035, -900); this.noise(0.18, 0.04, 5200); break;
      case 'rebirth': [261.6, 329.6, 392, 523.2, 659.2].forEach((f, i) => this.swell(f, 2.6, i % 2 ? 'triangle' : 'sine', 0.06, 0, i * 0.03)); this.noise(0.6, 0.12, 7000); this.tone(65, 0.9, 'sine', 0.25, -10); break;
      case 'whoosh': this.noise(0.4, 0.05, 1800); this.tone(520, 0.35, 'sine', 0.012, -360); break;
      // (The islands' night things: a glass beast's growl, a lurker's
      // tongue, a thief's snatch, black glass breaking.)
      case 'growl': this.tone(90, 0.5, 'sawtooth', 0.035, -30); this.noise(0.4, 0.04, 300); break;
      case 'whip': this.noise(0.12, 0.1, 3000); this.tone(900, 0.12, 'sine', 0.02, -700); break;
      case 'steal': this.tone(1200, 0.08, 'square', 0.02, 400); this.noise(0.06, 0.05, 4000); break;
      case 'glass': this.noise(0.25, 0.07, 6000); this.tone(2400, 0.3, 'sine', 0.03, -200); this.tone(3600, 0.2, 'sine', 0.02, 300); break;
      case 'lift_stop': this.tone(260, 0.7, 'sawtooth', 0.025, -200); this.tone(58, 0.35, 'sine', 0.14, -18, 0.45); this.noise(0.18, 0.08, 900, 0.45); this.tone(1400, 0.12, 'triangle', 0.03, 0, 0.6); break;
      case 'rune': this.tone(660, 0.3, 'triangle', 0.05, 330); this.tone(990, 0.4, 'sine', 0.04, 495, 0.1); break;
      case 'beam': this.tone(1400, 0.35, 'sawtooth', 0.03, -700); this.noise(0.3, 0.05, 6000); break;
      case 'charge': this.tone(200, 0.6, 'sawtooth', 0.03, 900); break;
      case 'boom': this.tone(48, 0.6, 'sine', 0.3, -20); this.noise(0.5, 0.3, 220); this.noise(0.3, 0.2, 1200, 0.05); break;
      case 'secret': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.05, 0, i * 0.09)); break;
      case 'creak': this.tone(130, 0.5, 'sawtooth', 0.025, 40); this.tone(170, 0.4, 'sawtooth', 0.02, -30, 0.2); break;
      case 'scream': this.tone(700, 0.4, 'sawtooth', 0.04, 300); this.tone(900, 0.35, 'square', 0.02, -200, 0.1); break;
      // Below ground, the places' own sounds: water dripping somewhere,
      // the earth groaning, a whisper on cold air, chains, old power.
      case 'drip': { const f = 1400 + Math.random() * 900; this.tone(f, 0.05, 'sine', 0.05, -f * 0.5); this.tone(f * 0.6, 0.18, 'sine', 0.015, 0, 0.06); break; }
      case 'rumble': this.noise(1.8, 0.06, 90); this.tone(38, 1.6, 'sine', 0.08, -6); break;
      case 'whisper': for (let i = 0; i < 3; i++) this.noise(0.5, 0.025, 2400 + Math.random() * 1800, i * 0.35); break;
      case 'chains': for (let i = 0; i < 5; i++) this.tone(2200 + Math.random() * 900, 0.04, 'triangle', 0.025, 0, i * 0.06 + Math.random() * 0.03); break;
      case 'drone': this.tone(73, 2.2, 'sawtooth', 0.012, 2); this.tone(110, 2.2, 'sine', 0.02, -3); break;
      case 'skitter': for (let i = 0; i < 6; i++) this.noise(0.02, 0.05, 3000 + Math.random() * 2000, i * 0.03); break;
      // (Round 68) The far lands' old places: the dead legions' tramp far
      // off in the dark; the slow beat of a heart as big as a house; the
      // salt singing; a far bell under the sea.
      case 'march': for (let i = 0; i < 8; i++) { this.noise(0.07, 0.05, 260, i * 0.42); this.tone(62, 0.09, 'sine', 0.05, -12, i * 0.42); if (i % 2) this.tone(2600, 0.03, 'triangle', 0.012, 0, i * 0.42 + 0.03); } break;
      case 'heart': this.tone(44, 0.22, 'sine', 0.2, -10); this.noise(0.12, 0.08, 140); this.tone(40, 0.26, 'sine', 0.16, -8, 0.3); this.noise(0.1, 0.06, 120, 0.3); break;
      case 'salt_song': [1568, 1976, 2349, 2093].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.012, f * 0.01, i * 0.22)); break;
      case 'sea_bell': this.tone(196, 2.4, 'sine', 0.05, -2); this.tone(392, 1.8, 'triangle', 0.02, -4, 0.02); this.tone(587, 1.2, 'sine', 0.012, 0, 0.03); break;
      case 'bones': for (let i = 0; i < 4; i++) this.tone(900 + Math.random() * 500, 0.03, 'square', 0.04, -300, i * 0.04); break;
      case 'shatter': this.noise(0.15, 0.2, 3200); for (let i = 0; i < 3; i++) this.tone(2400 + Math.random() * 1600, 0.05, 'triangle', 0.04, 0, 0.03 + i * 0.04); break;
      case 'thud': this.tone(90, 0.1, 'sine', 0.14, -40); this.noise(0.06, 0.1, 400); break;
      // A metal foot coming down.
      // Spikes shooting up out of the floor.
      case 'spikes': this.noise(0.08, 0.14, 3800); this.tone(1400, 0.06, 'square', 0.03, -600); this.tone(180, 0.1, 'sawtooth', 0.04, -60, 0.02); break;
      case 'clank': this.tone(70, 0.18, 'sine', 0.14, -20); this.tone(340, 0.07, 'square', 0.03, -140); this.noise(0.05, 0.07, 2600); break;
      case 'flap': for (let i = 0; i < 4; i++) this.noise(0.04, 0.06, 900, i * 0.07); break;
      // A master's lair: the gate slamming shut, a roar, the bar's sting.
      case 'gate_slam': this.tone(60, 0.5, 'sine', 0.3, -25); this.noise(0.35, 0.3, 300); for (let i = 0; i < 4; i++) this.noise(0.06, 0.08, 1800, 0.15 + i * 0.05); break;
      case 'roar': this.noise(1.1, 0.22, 240); this.tone(95, 1.1, 'sawtooth', 0.08, -45); this.tone(140, 0.9, 'square', 0.03, -70, 0.05); break;
      case 'sting': [220, 233, 208].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.05, 0, i * 0.02)); this.tone(55, 0.9, 'sine', 0.18, -10); break;
      case 'victory': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, i === 4 ? 0.6 : 0.14, 'square', 0.07, 0, i * 0.11)); break;
      // The deep places' own: a holdout's gong, a pick far off, a fire's
      // crackle, voices you can't make out, a low wind in a barrow; a fuse.
      case 'gong': [196, 247, 294].forEach((f, i) => this.tone(f, 2.4, 'sine', 0.09 - i * 0.02, -4)); this.noise(0.2, 0.12, 1200); break;
      case 'tink': { const f = 2600 + Math.random() * 600; for (let i = 0; i < 3; i++) this.tone(f, 0.05, 'triangle', 0.02, 0, i * 0.55); break; }
      case 'crackle': for (let i = 0; i < 8; i++) this.noise(0.02, 0.04, 2000 + Math.random() * 3000, Math.random() * 0.8); break;
      case 'voices': for (let i = 0; i < 4; i++) this.tone(140 + Math.random() * 90, 0.18, 'sawtooth', 0.008, Math.random() * 40 - 20, i * 0.22); break;
      case 'wind_low': this.noise(2.4, 0.03, 220); break;
      case 'fuse': this.noise(1.0, 0.05, 5200); break;
      // Picking a lock: a locked chest's rattle, a pin flicked (a binding
      // one, stiffer), one caught, the pick straining and snapping, and the
      // plug turning over at last.
      case 'locked': this.noise(0.08, 0.1, 900); this.noise(0.06, 0.08, 1300, 0.09); break;
      case 'pick_tick': this.tone(3200 + Math.random() * 400, 0.03, 'triangle', 0.025); break;
      case 'pick_bind': this.tone(1500, 0.05, 'square', 0.02, -200); this.noise(0.04, 0.03, 2400); break;
      case 'pick_set': this.tone(2400, 0.04, 'square', 0.04); this.tone(1800, 0.06, 'triangle', 0.04, 0, 0.03); this.noise(0.03, 0.05, 4000); break;
      case 'pick_strain': this.tone(420, 0.18, 'sawtooth', 0.025, -60); this.noise(0.12, 0.03, 1800); break;
      case 'pick_snap': this.noise(0.06, 0.2, 5200); this.tone(2900, 0.05, 'square', 0.05, -900); this.tone(1200, 0.12, 'triangle', 0.03, -400, 0.05); break;
      case 'unlock': this.tone(220, 0.12, 'square', 0.06, -40); this.noise(0.1, 0.12, 700); this.tone(660, 0.18, 'triangle', 0.05, 0, 0.12); this.tone(880, 0.3, 'triangle', 0.04, 0, 0.2); break;
      // A shout for help (a holdout coward's).
      case 'shout': this.tone(300, 0.32, 'sawtooth', 0.05, 60); this.tone(420, 0.28, 'square', 0.025, 50, 0.03); this.noise(0.22, 0.05, 1500); this.tone(360, 0.3, 'sawtooth', 0.04, -40, 0.36); break;
      // A long swell, rising (a spire waking).
      case 'riser': [55, 82.5, 110, 165, 220].forEach((f, i) => this.swell(f, 3.0, i % 2 ? 'sawtooth' : 'sine', i % 2 ? 0.035 : 0.07, f * 1.5, 0)); this.noise(3.0, 0.03, 1600); break;
      // (Round 51) A dish coming out: the build-up (rising, faster), and
      // what it comes out as, from a fanfare down to a sad slide; a star
      // ringing in; a pull on a pipe.
      case 'cook_build':
        this.swell(196, 1.45, 'triangle', 0.05, 392);
        this.swell(294, 1.45, 'sine', 0.04, 588);
        this.noise(1.45, 0.025, 2600);
        for (let i = 0; i < 10; i++) this.tone(900 + i * 120, 0.04, 'square', 0.012, 0, i * 0.14 * (1 - i * 0.045));
        break;
      case 'reveal_great':
        this.noise(0.25, 0.08, 4000);
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, 0, i * 0.07));
        [523, 659, 784, 1046, 1318].forEach((f) => this.tone(f, 1.1, 'triangle', 0.05, 0, 0.3));
        for (let i = 0; i < 6; i++) this.tone(2093 + i * 260, 0.08, 'sine', 0.025, 0, 0.35 + i * 0.07);
        break;
      case 'reveal_good':
        this.noise(0.18, 0.06, 3500);
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.08));
        [392, 523, 659, 784].forEach((f) => this.tone(f, 0.8, 'triangle', 0.045, 0, 0.26));
        break;
      case 'reveal_poor': [392, 494].forEach((f, i) => this.tone(f, i ? 0.4 : 0.12, 'triangle', 0.05, 0, i * 0.12)); break;
      case 'reveal_bad':
        this.noise(0.5, 0.05, 500);
        [392, 370, 349].forEach((f, i) => this.tone(f, 0.24, 'sawtooth', 0.035, -8, i * 0.26));
        this.tone(330, 0.7, 'sawtooth', 0.035, -60, 0.78);
        break;
      case 'star_ding': this.tone(1568 + Math.random() * 40, 0.12, 'sine', 0.05); this.tone(3136, 0.08, 'sine', 0.015); break;
      case 'puff': this.noise(0.5, 0.04, 700); break;
      // (Round 53: a dish's ward or flash; a player turned into a sheep.)
      case 'chime': this.tone(1320, 0.25, 'sine', 0.06); this.tone(1760, 0.3, 'sine', 0.05, 0, 0.08); break;
      case 'baa': this.tone(400, 0.12, 'sawtooth', 0.05, 20); this.tone(380, 0.28, 'sawtooth', 0.05, -60, 0.1); break;
    }
  }
}

// (Round 66) One of the game's own sounds made into samples (for the
// Workshop's Sound tab, to put into a clip): { rate, x }, the quiet after
// it cut off. Null where the browser can't.
export async function renderGameSound(name, rate = 22050) {
  const OAC = globalThis.OfflineAudioContext;
  if (!OAC) return null;
  const oc = new OAC(1, Math.ceil(rate * 4), rate);
  const a = Object.create(Audio.prototype);
  a.ctx = oc;
  a.master = oc.createGain();
  a.master.gain.value = 1;
  a.master.connect(oc.destination);
  const b = oc.createBuffer(1, Math.floor(rate * 0.5), rate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  a.noiseBuf = b;
  a.voice(name);
  const buf = await oc.startRendering();
  const x = buf.getChannelData(0);
  let end = x.length;
  while (end > 0 && Math.abs(x[end - 1]) < 0.0015) end--;
  return { rate, x: x.slice(0, Math.min(x.length, end + Math.round(rate * 0.02))) };
}
