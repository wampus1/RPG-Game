// Adaptive chiptune music, made up as it plays. Each place has a theme: a
// key, a scale, a tempo, a chord progression, instruments and a drum
// pattern. A theme makes a couple of short melodic phrases and plays them
// in an A-A-B-A shape over its chords, so it sounds like a tune rather
// than noodling. When you move somewhere else (into a town, a ruin, a
// graveyard, another biome, or a fight) the old theme fades out as the
// new one fades in. Nights are slower and quieter.
import { mulberry32 } from '../util/rng.js';
import { townMusic } from '../sim/prosperity.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  penta: [0, 2, 4, 7, 9],
  minpenta: [0, 3, 5, 7, 10],
  whole: [0, 2, 4, 6, 8, 10],
};

// root: MIDI note; prog: chord roots as scale degrees; density: how busy
// the melody is; drums: pattern name (or null).
export const THEMES = {
  title: { root: 57, scale: 'dorian', bpm: 76, prog: [0, 5, 3, 4], lead: 'triangle', pad: true, drums: null, density: 0.4, arp: true },
  plains: { root: 60, scale: 'penta', bpm: 92, prog: [0, 3, 4, 0], lead: 'triangle', drums: 'soft', density: 0.55 },
  forest: { root: 57, scale: 'dorian', bpm: 84, prog: [0, 6, 3, 4], lead: 'triangle', drums: 'soft', density: 0.5, arp: true },
  taiga: { root: 55, scale: 'minor', bpm: 70, prog: [0, 5, 3, 6], lead: 'sine', pad: true, drums: null, density: 0.35 },
  tundra: { root: 53, scale: 'minpenta', bpm: 62, prog: [0, 5, 3, 4], lead: 'sine', pad: true, drums: null, density: 0.28 },
  desert: { root: 62, scale: 'hijaz', bpm: 78, prog: [0, 1, 0, 6], lead: 'square', drums: 'hand', density: 0.45 },
  savanna: { root: 58, scale: 'mixo', bpm: 96, prog: [0, 6, 3, 0], lead: 'triangle', drums: 'hand', density: 0.5 },
  jungle: { root: 64, scale: 'lydian', bpm: 104, prog: [0, 1, 0, 4], lead: 'triangle', drums: 'tribal', density: 0.55, arp: true },
  swamp: { root: 53, scale: 'phrygian', bpm: 68, prog: [0, 1, 5, 1], lead: 'sine', pad: true, drums: 'soft', density: 0.32, detune: 12 },
  mountain: { root: 50, scale: 'dorian', bpm: 72, prog: [0, 6, 4, 0], lead: 'triangle', pad: true, drums: null, density: 0.38, fifths: true },
  beach: { root: 65, scale: 'mixo', bpm: 88, prog: [0, 3, 6, 4], lead: 'triangle', drums: 'soft', density: 0.5, swing: 0.2 },
  ocean: { root: 62, scale: 'penta', bpm: 70, prog: [0, 4, 3, 4], lead: 'sine', pad: true, drums: null, density: 0.3 },
  village: { root: 60, scale: 'major', bpm: 106, prog: [0, 4, 5, 3], lead: 'square', drums: 'light', density: 0.68, swing: 0.12 },
  town: { root: 62, scale: 'major', bpm: 112, prog: [0, 5, 3, 4], lead: 'square', drums: 'light', density: 0.7, arp: true },
  city: { root: 65, scale: 'mixo', bpm: 116, prog: [0, 3, 4, 5, 0, 3, 6, 4], lead: 'square', drums: 'light', density: 0.72, arp: true, pad: true },
  tavern: { root: 60, scale: 'mixo', bpm: 124, prog: [0, 3, 0, 4], lead: 'square', drums: 'light', density: 0.8, swing: 0.25 },
  ruins: { root: 57, scale: 'minor', bpm: 58, prog: [0, 5, 1, 4], lead: 'sine', pad: true, drums: null, density: 0.22, detune: 18 },
  graveyard: { root: 52, scale: 'harmonic', bpm: 52, prog: [0, 5, 3, 4], lead: 'sine', pad: true, organ: true, drums: null, density: 0.2, toll: true },
  fight_monsters: { root: 57, scale: 'harmonic', bpm: 148, prog: [0, 5, 6, 4], lead: 'square', drums: 'battle', density: 0.8, drive: true },
  fight_guards: { root: 55, scale: 'phrygian', bpm: 136, prog: [0, 1, 0, 6], lead: 'square', drums: 'march', density: 0.72, drive: true },
  // Below ground: each kind of place its own dread. A barrow's slow bell,
  // a mine's dripping dark, a crypt's organ under water, a bandits' den
  // with its drums, and the Kavorent's halls in a scale no living people
  // use, glittering and wrong.
  dungeon_barrow: { root: 50, scale: 'phrygian', bpm: 54, prog: [0, 1, 5, 0], lead: 'sine', pad: true, drums: null, density: 0.2, toll: true, detune: 10 },
  dungeon_mine: { root: 48, scale: 'minor', bpm: 64, prog: [0, 6, 5, 6], lead: 'triangle', pad: true, drums: 'soft', density: 0.24, fifths: true },
  dungeon_crypt: { root: 52, scale: 'harmonic', bpm: 50, prog: [0, 5, 1, 4], lead: 'sine', pad: true, organ: true, drums: null, density: 0.18, detune: 14 },
  dungeon_holdout: { root: 55, scale: 'dorian', bpm: 84, prog: [0, 6, 0, 4], lead: 'triangle', drums: 'hand', density: 0.4, swing: 0.15 },
  dungeon_kavorent: { root: 54, scale: 'whole', bpm: 66, prog: [0, 2, 4, 1], lead: 'sine', pad: true, arp: true, drums: null, density: 0.3, detune: 22 },
  fight_kavorent: { root: 54, scale: 'whole', bpm: 140, prog: [0, 1, 3, 2], lead: 'square', drums: 'battle', density: 0.78, drive: true, arp: true },
  // The openings: an old town's story, slow and warm; a shanty on deck;
  // the storm; and the cold after.
  history: { root: 60, scale: 'major', bpm: 74, prog: [0, 5, 3, 4], lead: 'triangle', pad: true, arp: true, drums: null, density: 0.42 },
  voyage: { root: 62, scale: 'dorian', bpm: 110, prog: [0, 3, 0, 4], lead: 'square', drums: 'light', density: 0.62, swing: 0.3 },
  storm: { root: 50, scale: 'phrygian', bpm: 140, prog: [0, 1, 0, 6], lead: 'square', drums: 'battle', density: 0.74, drive: true, detune: 10 },
  wreck: { root: 45, scale: 'minor', bpm: 46, prog: [0, 5, 3, 4], lead: 'sine', pad: true, drums: null, density: 0.14 },
  fight_boss: { root: 50, scale: 'harmonic', bpm: 156, prog: [0, 5, 1, 4, 0, 6, 1, 4], lead: 'square', drums: 'battle', density: 0.85, drive: true, organ: true },
};

// What the music should be right now.
export function musicMood(game) {
  const p = game.player;
  if (!p) return 'title';
  if (game.cutscene && game.cutscene.mood) return game.cutscene.mood;
  // A fight: guards after you, or beasts at your throat.
  if (!p.dead) {
    const guards = game.npcs.some((n) => !n.dead && n.threat === p && (n.state === 'fight' || n.state === 'alert') && n.distTo(p) < 20);
    if (guards) return 'fight_guards';
    const beasts = game.creatures.some((c) => !c.dead && c.hostileNow && c.target === p && c.distTo(p) < 12);
    if (beasts || (game.combatT || 0) > 0) {
      if (game.combatWith === 'guard') return 'fight_guards';
      // (Below ground: a master's hall, or the Kavorent's guardians.)
      if (game.dungeon) {
        if (game.creatures.some((c) => !c.dead && c.isBoss && c.target === p && c.distTo(p) < 18)) return 'fight_boss';
        if (game.dungeon.kav) return 'fight_kavorent';
      }
      return 'fight_monsters';
    }
  }
  // Down below (no nights there).
  if (game.dungeon) return `dungeon_${game.dungeon.rec.type}`;
  const night = game.minute < 330 || game.minute >= 1230;
  const s = game.currentSettlement;
  if (s) {
    const L = game.active.get(s.id)?.layout;
    const gy = L && L.graveyard;
    if (gy) {
      const d = Math.max(gy.x - 3 - p.x, p.x - (gy.x + gy.W + 2), gy.z - 3 - p.z, p.z - (gy.z + 2 * gy.maxRows + 3));
      if (d <= 0) return 'graveyard';
    }
    if (s.condition === 'abandoned' || s.deserted) return 'ruins';
    const b = game.buildingAtPlayer ? game.buildingAtPlayer() : null;
    if (b && b.type === 'tavern') return night ? 'tavern:night' : 'tavern';
    const kind = (s.type === 'city' ? 'city' : s.type === 'town' ? 'town' : 'village') + townMusic(L);
    return night ? `${kind}:night` : kind;
  }
  const biome = game.biomeCache ? game.biomeCache.biome : 'plains';
  const t = THEMES[biome] ? biome : 'plains';
  return night ? `${t}:night` : t;
}

// Each people plays its own way; a thriving town's tune is quick and
// bright, a struggling one's slow and in a minor key.
const CULTURE_SOUND = {
  vale: {},
  north: { scale: 'dorian', root: -2, bpmX: 0.9, drums: 'soft', fifths: true, lead: 'triangle' },
  sun: { scale: 'hijaz', root: 2, drums: 'hand', swing: 0.1 },
  wild: { scale: 'lydian', root: 4, drums: 'tribal', arp: true },
  high: { scale: 'mixo', root: -5, bpmX: 0.92, drums: 'march', fifths: true, pad: true },
};
const DARKER = { major: 'minor', mixo: 'dorian', lydian: 'dorian', hijaz: 'phrygian', dorian: 'phrygian', penta: 'minpenta' };
export function flavourTheme(T, style, fortune) {
  const c = CULTURE_SOUND[style] || {};
  if (c.scale) T.scale = c.scale;
  if (c.root) T.root += c.root;
  if (c.bpmX) T.bpm *= c.bpmX;
  for (const k of ['drums', 'fifths', 'lead', 'swing', 'arp', 'pad']) if (c[k] !== undefined) T[k] = c[k];
  if (fortune === 'thriving') {
    T.bpm *= 1.08;
    T.density = Math.min(0.9, T.density + 0.08);
    T.arp = true;
    if (!T.drums) T.drums = 'light';
  } else if (fortune === 'struggling') {
    T.scale = DARKER[T.scale] || T.scale;
    T.bpm *= 0.82;
    T.density *= 0.65;
    T.drums = T.drums ? 'soft' : null;
    T.lead = 'sine';
    T.pad = true;
    T.detune = 8;
  }
  return T;
}

// Every tune has a night version: slower, sparser, a dreamier mode, the
// drums down to a heartbeat (or gone), a soft pad under it all and a
// faint high shimmer now and then. (Whatever the people's own drums: a
// sun town's hand drums and a high town's march quieten too.)
const NIGHT_SCALE = { major: 'lydian', mixo: 'dorian', hijaz: 'phrygian', penta: 'minpenta' };
const NIGHT_DRUMS = { light: 'soft', hand: 'soft', tribal: 'soft', march: null, soft: null };
export function nightTheme(T) {
  T.bpm *= 0.74;
  T.density *= 0.55;
  T.lead = T.lead === 'square' ? 'triangle' : 'sine';
  if (T.drums in NIGHT_DRUMS) T.drums = NIGHT_DRUMS[T.drums];
  T.scale = NIGHT_SCALE[T.scale] || T.scale;
  T.pad = true;
  T.arp = false;
  T.swing = 0;
  T.night = true;
  return T;
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// One playing theme: its own gain node, scheduled a little ahead.
class Voice {
  constructor(music, key) {
    const [full, variant] = key.split(':');
    const [name, flavour] = full.split('@');
    this.m = music;
    this.key = key;
    this.T = { ...THEMES[name] };
    // A town's own people's sound, and how it's doing.
    if (flavour) flavourTheme(this.T, ...flavour.split('.'));
    if (variant === 'night') nightTheme(this.T);
    const c = music.ctx;
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(1, c.currentTime + 2.5);
    this.out.connect(music.bus);
    this.rand = mulberry32((Math.random() * 1e9) | 0);
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.phrases = [this.phrase(), this.phrase()];
    this.stopped = false;
  }

  get stepDur() {
    return 60 / this.T.bpm / 4;
  }

  // A two-bar melody: rhythm and scale steps, leaning on chord tones.
  phrase() {
    const T = this.T;
    const r = this.rand;
    const out = [];
    let deg = Math.floor(r() * 3) * 2;
    for (let s = 0; s < 32; s++) {
      const strong = s % 4 === 0;
      const p = strong ? T.density + 0.2 : s % 2 === 0 ? T.density * 0.7 : T.density * 0.3;
      if (r() > p) continue;
      const move = r() < 0.6 ? (r() < 0.5 ? -1 : 1) : r() < 0.5 ? -2 : 2;
      deg = Math.max(-2, Math.min(9, deg + move));
      if (strong && r() < 0.5) deg = Math.round(deg / 2) * 2;
      let len = 1;
      while (len < 4 && r() < 0.45) len++;
      out.push({ s, deg, len });
    }
    return out;
  }

  note(deg, octave = 0) {
    const sc = SCALES[this.T.scale];
    const o = Math.floor(deg / sc.length);
    const i = ((deg % sc.length) + sc.length) % sc.length;
    return this.T.root + sc[i] + 12 * (o + octave);
  }

  tone(freq, t, dur, type, vol, detune = 0) {
    const c = this.m.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime((this.rand() - 0.5) * detune * 2, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit(t, freq, dur, vol) {
    const c = this.m.ctx;
    const s = c.createBufferSource();
    s.buffer = this.m.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  kick(t, vol = 0.5) {
    const c = this.m.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }

  drums(s, t) {
    const d = this.T.drums;
    const b = s % 16;
    if (!d) return;
    if (d === 'soft') {
      if (b === 0) this.kick(t, 0.25);
      if (b % 4 === 2) this.hit(t, 7000, 0.03, 0.04);
    } else if (d === 'light') {
      if (b === 0 || b === 8) this.kick(t, 0.35);
      if (b === 4 || b === 12) this.hit(t, 1800, 0.09, 0.12);
      if (b % 2 === 0) this.hit(t, 8000, 0.025, 0.05);
    } else if (d === 'battle') {
      if (b === 0 || b === 3 || b === 8 || b === 11) this.kick(t, 0.5);
      if (b === 4 || b === 12) this.hit(t, 1600, 0.12, 0.2);
      this.hit(t, 9000, 0.02, b % 2 ? 0.03 : 0.07);
    } else if (d === 'march') {
      if (b === 0 || b === 8) this.kick(t, 0.45);
      if ([4, 6, 7, 12, 14, 15].includes(b)) this.hit(t, 2000, 0.07, b % 4 === 0 ? 0.18 : 0.1);
    } else if (d === 'hand') {
      if ([0, 3, 6, 10, 12].includes(b)) this.hit(t, b === 0 ? 300 : 700 + (b % 3) * 150, 0.1, 0.16);
    } else if (d === 'tribal') {
      if ([0, 6, 8, 11, 14].includes(b)) this.kick(t, b === 0 ? 0.4 : 0.22);
      if (b % 4 === 2) this.hit(t, 500, 0.08, 0.1);
    }
  }

  // Schedule one sixteenth-note step.
  play(s, t) {
    const T = this.T;
    const bar = Math.floor(s / 16);
    const b = s % 16;
    const chord = T.prog[bar % T.prog.length];
    const sd = this.stepDur;
    // Bass.
    if (T.drive ? b % 2 === 0 : b === 0 || b === 8 || (T.bpm > 100 && b === 12)) {
      this.tone(midi(this.note(chord, -2)), t, sd * (T.drive ? 1.8 : 3.5), 'triangle', 0.22);
      if (T.fifths && b === 0) this.tone(midi(this.note(chord + 4, -2)), t, sd * 7, 'triangle', 0.12);
    }
    // Pad (or organ) chord, once a bar.
    if (T.pad && b === 0) {
      for (const k of [0, 2, 4]) this.tone(midi(this.note(chord + k, -1)), t, sd * 15, T.organ ? 'triangle' : 'sine', T.organ ? 0.07 : 0.05, T.detune || 0);
    }
    // Arpeggio.
    if (T.arp && b % 2 === 0) {
      const k = [0, 2, 4, 2][(b / 2) % 4];
      this.tone(midi(this.note(chord + k, 0)), t, sd * 1.6, 'square', 0.03);
    }
    // Melody: phrases A A B A over eight bars.
    const which = [0, 0, 1, 0][Math.floor(bar / 2) % 4];
    const ph = this.phrases[which];
    const ps = s % 32;
    for (const n of ph) {
      if (n.s !== ps) continue;
      const sw = T.swing && ps % 2 === 1 ? sd * T.swing : 0;
      this.tone(midi(this.note(n.deg + chord * (this.rand() < 0.3 ? 1 : 0), 1)), t + sw, sd * n.len * 0.95, T.lead, T.lead === 'square' ? 0.06 : 0.1, T.detune || 0);
    }
    // A slow bell in the graveyard.
    if (T.toll && s % 32 === 0) {
      for (const [m, v] of [[1, 0.12], [2.76, 0.05], [5.4, 0.02]]) this.tone(midi(this.T.root - 12) * m, t, 3.5, 'sine', v);
    }
    // (By night, a faint shimmer high over it every other bar.)
    if (T.night && b === 0 && bar % 2 === 1) this.tone(midi(this.note(chord + 4, 2)), t + sd * 2, sd * 10, 'sine', 0.025);
    this.drums(s, t);
    // New tunes every so often, so a long walk isn't one loop.
    if (s % 128 === 127) this.phrases = [this.phrase(), this.rand() < 0.5 ? this.phrases[1] : this.phrase()];
  }

  schedule(until) {
    while (!this.stopped && this.next < until) {
      this.play(this.step, this.next);
      this.next += this.stepDur;
      this.step++;
    }
  }

  fadeOut() {
    const c = this.m.ctx;
    this.out.gain.cancelScheduledValues(c.currentTime);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.2);
    this.stopped = true;
    setTimeout(() => this.out.disconnect(), 2600);
  }
}

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this.volume = 0.5;
    this.voice = null;
    this.want = null;
    this.wantT = 0;
    this.timer = null;
  }

  get ctx() {
    return this.audio && this.audio.ctx;
  }

  setup() {
    const c = this.ctx;
    if (!c || this.bus) return !!this.bus;
    this.bus = c.createGain();
    this.bus.gain.value = this.volume * 0.4;
    this.bus.connect(c.destination);
    const n = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    this.timer = globalThis.setInterval(() => this.tick(), 60);
    return true;
  }

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.voice) return;
    this.voice.schedule(c.currentTime + 0.3);
  }

  setVolume(v) {
    this.volume = v;
    this.enabled = v > 0;
    if (this.bus) this.bus.gain.setTargetAtTime(v * 0.4, this.ctx.currentTime, 0.2);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.bus) this.bus.gain.setTargetAtTime(this.enabled ? this.volume * 0.4 : 0, this.ctx.currentTime, 0.3);
    return this.enabled;
  }

  // Called every frame with the mood the game is in; switches themes once
  // a new mood has held for a moment (fights switch at once).
  update(dt, mood) {
    if (!this.setup()) return;
    if (!this.voice) {
      this.voice = new Voice(this, mood);
      return;
    }
    if (mood === this.voice.key) {
      this.want = null;
      return;
    }
    if (mood !== this.want) {
      this.want = mood;
      this.wantT = 0;
    }
    this.wantT += dt;
    const fight = mood.startsWith('fight');
    const leavingFight = this.voice.key.startsWith('fight');
    const hold = fight ? 0.3 : leavingFight ? 4 : 2.5;
    if (this.wantT >= hold) {
      this.voice.fadeOut();
      this.voice = new Voice(this, mood);
      this.want = null;
    }
  }
}
