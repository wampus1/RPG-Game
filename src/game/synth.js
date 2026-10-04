// The instruments the music is played on (see music.js for what plays,
// compose.js for how the tunes are written): the old synthesizer records'
// sounds, made over from oscillators, filters and noise. Detuned saws
// through a chorus for the pads, a bell-toned electric piano and bells, a
// breathy pan flute, plucked strings with a filter snapping shut, brass
// that swells open, a fat analogue bass, and a drum machine with a gated
// snare. Each tune is played in a room of its own (see Rack): a convolver
// ringing like a small room, a hall, a cave or a cathedral, and a tape
// echo set to the tune's tempo; and all of it through a gentle compressor
// and a warm clip at the end (see master).
//
// Built lean, the way the old machines were: a chord's notes share one
// filter and one envelope (as a polysynth's voices share a chorus), a
// sound made of several waves is one oscillator playing a wave drawn to
// measure (see WAVES), and the drums are struck once into samples and
// played back from them (see Samples), as the old drum machines did.
//
// Everything here works with as little of a sound card as there is: with
// no convolver, delay, panner, compressor, shaper or drawn waves (or a
// filter without its Q), it plays plainer, dry and in the middle.

export const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A parameter worked out once a block (a few milliseconds) rather than
// every sample: plenty for an envelope or a vibrato, and cheaper.
function krate(p) {
  if (p && 'automationRate' in p) {
    try {
      p.automationRate = 'k-rate';
    } catch {
      // (Not on this card.)
    }
  }
}

// --- the end of the line --------------------------------------------------
// The mix glued (a slow compressor), then rounded off (a soft clip, so the
// loudest moments warm up rather than crack): into `dest` (the volume).
export function master(ctx, dest) {
  const mix = ctx.createGain();
  mix.gain.value = 1;
  let tail = mix;
  if (ctx.createDynamicsCompressor) {
    const k = ctx.createDynamicsCompressor();
    k.threshold.value = -20;
    k.knee.value = 12;
    k.ratio.value = 3;
    k.attack.value = 0.015;
    k.release.value = 0.25;
    tail.connect(k);
    tail = k;
  }
  if (ctx.createWaveShaper) {
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    const w = ctx.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(2 * ((i / (n - 1)) * 2 - 1));
    w.curve = curve;
    w.oversample = '2x';
    tail.connect(pre).connect(w);
    tail = w;
  }
  tail.connect(dest);
  return mix;
}

// --- the rooms -------------------------------------------------------------
// A space's ring, made up: noise dying away, its highs going first, a few
// early echoes off near walls, and a moment's gap before it all.
const SPACES = {
  room: { len: 1.2, damp: 0.5, pre: 0.006, early: 7, spread: 0.035, rise: 0.002 },
  hall: { len: 2.6, damp: 0.55, pre: 0.02, early: 5, spread: 0.07, rise: 0.012 },
  cave: { len: 5.2, damp: 0.82, pre: 0.05, early: 12, spread: 0.16, rise: 0.02 },
  cathedral: { len: 4.6, damp: 0.6, pre: 0.035, early: 4, spread: 0.12, rise: 0.06 },
};
export function makeIR(ctx, space) {
  const P = SPACES[space] || SPACES.hall;
  const sr = ctx.sampleRate;
  const n = Math.max(2, Math.floor(P.len * sr));
  const buf = ctx.createBuffer(2, n, sr);
  const pre = Math.floor(P.pre * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const x = (i - pre) / (n - pre);
      // (A filter closing as it rings: the highs die first.)
      const a = 1 - clamp(0.08 + P.damp * x, 0, 0.985);
      lp += a * (Math.random() * 2 - 1 - lp);
      const rise = Math.min(1, (i - pre) / Math.max(1, P.rise * sr));
      d[i] = lp * Math.exp(-6.9 * x) * rise * (1.2 + P.damp);
    }
    for (let k = 0; k < P.early; k++) {
      const at = pre + Math.floor(Math.random() * P.spread * sr);
      if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.7 - (0.4 * k) / P.early);
    }
  }
  return buf;
}

// --- drawn waves ------------------------------------------------------------
// Waves drawn harmonic by harmonic (how loud each is), each standing in for
// what would otherwise take several oscillators: the analogue bass's saw
// over its square an octave down (played at the square's pitch), an
// organ's drawbars (likewise from an octave down), an electric piano's
// bright strike, a shawm's nasal buzz. (`plain`: the nearest ordinary wave,
// for a card that can't draw its own.)
const WAVES = {
  sawsub: { plain: 'sawtooth', h: (k) => (k % 2 ? 0.6 / k : 2 / k) },
  organ: { plain: 'triangle', h: (k) => ({ 1: 0.35, 2: 1, 4: 0.7, 6: 0.45, 8: 0.35, 12: 0.15, 16: 0.08 })[k] || 0 },
  pipe: { plain: 'triangle', h: (k) => ({ 1: 0.6, 2: 1, 4: 0.5, 6: 0.18, 8: 0.22 })[k] || 0 },
  ep: { plain: 'sine', h: (k) => [0, 1, 0.32, 0.1, 0.05, 0.02, 0.01, 0.07][k] || 0 },
  glass: { plain: 'sine', h: (k) => [0, 1, 0.3, 0.12, 0.06][k] || 0 },
  steel: { plain: 'triangle', h: (k) => [0, 1, 0.55, 0.22, 0.09, 0.03][k] || 0 },
  flute: { plain: 'sine', h: (k) => [0, 1, 0.06, 0.12, 0.02, 0.02][k] || 0 },
  warm: { plain: 'triangle', h: (k) => (k === 1 ? 1 : k % 2 ? 0.7 / (k * k) : 0.05 / k) },
  sub: { plain: 'sine', h: (k) => [0, 1, 0.12, 0.06][k] || 0 },
  horn: { plain: 'sawtooth', h: (k) => (k <= 16 ? 1 / Math.pow(k, 1.6) : 0) },
  shawm: { plain: 'sawtooth', h: (k) => (k <= 30 ? (1 + 1.6 * Math.exp(-((k - 5) ** 2) / 6)) / Math.pow(k, 0.65) : 0) },
  squeeze: { plain: 'sawtooth', h: (k) => (k <= 30 ? (k % 2 ? 1.3 : 0.7) / k : 0) },
  fmb: { plain: 'triangle', h: (k) => [0, 1, 0.6, 0.35, 0.18, 0.08][k] || 0 },
  sqsine: { plain: 'square', h: (k) => (k === 1 ? 1.8 : k % 2 ? 1 / k : 0) },
};
const waveCache = new WeakMap();
function drawnWave(ctx, name) {
  if (!ctx.createPeriodicWave) return null;
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = {}));
  if (!m[name]) {
    const n = 40;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = WAVES[name].h(k);
    m[name] = ctx.createPeriodicWave(re, im);
  }
  return m[name];
}

// --- a tune's own desk -------------------------------------------------------
// One playing tune's channels: each instrument its own level, place in the
// stereo field, and how much of it goes to the room and to the echo; a tone
// control over all of it (the tune's brightness), and its fader (`out`).
export class Rack {
  constructor(music, dest, { space = 'hall', wet = 0.3, echo = 0.15, tone = 6000, beat = 0.5, rand = Math.random } = {}) {
    const c = (this.c = music.ctx);
    this.m = music;
    this.rand = rand;
    this.ch = {};
    this.live = [];
    this.out = dest;
    this.tone = this.filter('lowpass', tone, 0.5);
    this.tone.connect(dest);
    this.sum = this.gain(1);
    this.sum.connect(this.tone);
    // The room (fed in mono: one ring, spread by the room itself).
    if (c.createConvolver && music.ir) {
      this.verbIn = this.gain(1);
      this.verbIn.channelCount = 1;
      this.verbIn.channelCountMode = 'explicit';
      const v = c.createConvolver();
      v.buffer = music.ir(space);
      this.verbOut = this.gain(wet * 1.6);
      // (A little cut under the room, so it doesn't boom.)
      const hp = this.filter('highpass', 180, 0.5);
      this.verbIn.connect(hp).connect(v).connect(this.verbOut).connect(this.tone);
      this.live.push(this.verbIn, v, this.verbOut);
    }
    // The tape echo: bounced left and right, a little duller each time.
    if (c.createDelay && echo > 0) {
      this.echoIn = this.gain(1);
      this.echoIn.channelCount = 1;
      this.echoIn.channelCountMode = 'explicit';
      const lo = this.filter('highpass', 320, 0.5);
      const hi = this.filter('lowpass', 3200, 0.5);
      const dl = c.createDelay(2);
      const dr = c.createDelay(2);
      const fb1 = this.gain(0.38);
      const fb2 = this.gain(0.38);
      this.echoOut = this.gain(echo * 2.2);
      this.echoIn.connect(lo).connect(hi).connect(dl);
      this.pan(dl, -0.7).connect(this.echoOut);
      dl.connect(fb1).connect(dr);
      this.pan(dr, 0.7).connect(this.echoOut);
      dr.connect(fb2).connect(dl);
      this.echoOut.connect(this.sum);
      if (this.verbIn) {
        const s = this.gain(0.25);
        this.echoOut.connect(s).connect(this.verbIn);
      }
      this.delays = [dl, dr];
      this.live.push(this.echoIn, dl, dr, fb1, fb2, this.echoOut);
      this.setBeat(beat);
    }
  }

  gain(v) {
    const g = this.c.createGain();
    g.gain.value = v;
    return g;
  }

  filter(type, f, q) {
    const n = this.c.createBiquadFilter();
    n.type = type;
    krate(n.frequency);
    krate(n.Q);
    n.frequency.value = f;
    if (q !== undefined && n.Q) n.Q.value = q;
    return n;
  }

  // `node` placed left (-1) to right (1), where the card can; what to
  // connect on from.
  pan(node, p) {
    if (!p || !this.c.createStereoPanner) return node;
    const s = this.c.createStereoPanner();
    s.pan.value = p;
    node.connect(s);
    return s;
  }

  // The echo follows the tempo: a dotted eighth.
  setBeat(beat) {
    if (!this.delays) return;
    const d = clamp(beat * 0.75, 0.05, 1.9);
    if (this.beat && Math.abs(this.beat - d) < 0.002) return;
    this.beat = d;
    for (const dl of this.delays) {
      if (dl.delayTime.setTargetAtTime) dl.delayTime.setTargetAtTime(d, this.c.currentTime, 0.4);
      else dl.delayTime.value = d;
    }
  }

  // The tune's brightness, eased to.
  setTone(f, t = this.c.currentTime) {
    this.tone.frequency.setTargetAtTime(clamp(f, 300, 16000), t, 0.8);
  }

  // A channel (made the first time it's asked for): what an instrument
  // plays into.
  chan(name, { vol = 1, pan = 0, verb = 0.25, echo = 0, chorus = false } = {}) {
    let ch = this.ch[name];
    if (ch) return ch.in;
    const g = this.gain(vol);
    const tail = this.pan(g, pan);
    if (chorus && this.c.createDelay) this.chorus(tail);
    else tail.connect(this.sum);
    if (verb > 0 && this.verbIn) tail.connect(this.gain(verb)).connect(this.verbIn);
    if (echo > 0 && this.echoIn) tail.connect(this.gain(echo)).connect(this.echoIn);
    ch = this.ch[name] = { in: g };
    return g;
  }

  // The old string machines' chorus: the sound, and two copies of it
  // wavering a few milliseconds behind, one to each side.
  chorus(src) {
    const c = this.c;
    src.connect(this.sum);
    for (const [ms, rate, side] of [[11, 0.53, -0.8], [17, 0.71, 0.8]]) {
      const d = c.createDelay(0.1);
      d.delayTime.value = ms / 1000;
      const lfo = c.createOscillator();
      lfo.frequency.value = rate;
      const depth = this.gain(0.0024);
      lfo.connect(depth).connect(d.delayTime);
      lfo.start();
      this.lfos = this.lfos || [];
      this.lfos.push(lfo);
      const w = this.gain(0.55);
      src.connect(d);
      this.pan(d, side).connect(w).connect(this.sum);
    }
  }

  // A volume dip on a channel (the pads ducking under each kick: the
  // breathing pulse of the dance records).
  duck(name, t, depth, len) {
    const ch = this.ch[name];
    if (!ch) return;
    const g = ch.in.gain;
    this.ducks = this.ducks || {};
    const v = this.ducks[name] ?? g.value;
    this.ducks[name] = v;
    g.setValueAtTime(v, t);
    g.linearRampToValueAtTime(v * (1 - depth), t + 0.01);
    g.linearRampToValueAtTime(v, t + len);
  }

  // Everything let go (once the tune's faded out).
  dispose() {
    for (const l of this.lfos || []) {
      try {
        l.stop();
      } catch {
        // (Already stopped.)
      }
    }
    for (const n of [...this.live, this.sum, this.tone]) n.disconnect?.();
  }

  // --- the parts instruments are made of -----------------------------------
  // An oscillator: an ordinary wave, or one of the drawn ones (see WAVES).
  osc(type, f, t, end, cents = 0) {
    const o = this.c.createOscillator();
    const W = WAVES[type];
    const w = W && drawnWave(this.c, type);
    if (w && o.setPeriodicWave) o.setPeriodicWave(w);
    else o.type = W ? W.plain : type;
    krate(o.frequency);
    krate(o.detune);
    o.frequency.setValueAtTime(f, t);
    if (cents) o.detune.setValueAtTime(cents, t);
    o.start(t);
    o.stop(end + 0.02);
    return o;
  }

  noise(t, end) {
    const s = this.c.createBufferSource();
    s.buffer = this.m.noise;
    s.loop = true;
    s.start(t, this.rand() * 1.5);
    s.stop(end + 0.02);
    return s;
  }

  // A vibrato: a slow wobble of `cents`, coming in after `delay`.
  vibrato(params, t, end, rate, cents, delay = 0.2) {
    const lfo = this.osc('sine', rate, t, end);
    const g = this.c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(cents, t + delay + 0.35);
    lfo.connect(g);
    for (const p of params) g.connect(p);
  }

  // An envelope: up to `peak` over `a`, falling over `d` toward `s` of it,
  // held to the note's end, then let go over `r`. When it's done.
  adsr(p, t, dur, peak, a, d, s, r) {
    const hold = Math.max(a, dur);
    const sus = peak * s;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    let lvl = peak;
    if (s < 1 && d > 0) {
      p.setTargetAtTime(sus, t + a, d / 3);
      lvl = sus + (peak - sus) * Math.exp(-(hold - a) / (d / 3));
    }
    p.setValueAtTime(Math.max(0.0001, lvl), t + hold);
    p.exponentialRampToValueAtTime(0.0001, t + hold + r);
    return t + hold + r;
  }

  // A struck envelope: up fast, dying away.
  perc(p, t, peak, a, decay) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + decay);
    return t + a + decay;
  }

  // A struck envelope that rings until let go (an electric piano's: held
  // `dur`, dying over `ring`, then damped).
  ring(p, t, dur, peak, ringT, damp = 0.3) {
    const hold = Math.min(dur, ringT * 1.5);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + 0.004);
    p.setTargetAtTime(0.0001, t + 0.004, ringT / 3);
    p.setValueAtTime(Math.max(0.0001, peak * Math.exp(-hold / (ringT / 3))), t + hold);
    p.exponentialRampToValueAtTime(0.0001, t + hold + damp);
    return t + hold + damp;
  }

  // Struck partials: sines at `ratio` times the note, each `amp` loud,
  // dying over `decay` (the bright ones first: a bell's way).
  partials(ch, f, t, list, peak) {
    let end = t;
    for (const [ratio, amp, decay] of list) {
      if (f * ratio > 11000) continue;
      const x = this.osc('sine', f * ratio, t, t + decay + 0.01);
      const g = this.gain(0);
      end = Math.max(end, this.perc(g.gain, t, peak * amp, 0.002, decay));
      x.connect(g).connect(ch);
    }
    return end;
  }

  // A breath as a pipe speaks: noise through a band at `f`, a moment long.
  chiff(ch, f, t, peak, len = 0.12) {
    const n = this.noise(t, t + len + 0.02);
    const bp = this.filter('bandpass', f, 1.5);
    const g = this.gain(0);
    this.perc(g.gain, t, peak, 0.015, len);
    n.connect(bp).connect(g).connect(ch);
  }

  // An instrument's note (or chord: the notes played together share its
  // filter and envelope) into a channel.
  play(patch, ch, f, t, dur, vel = 1, o = {}) {
    const fs = Array.isArray(f) ? f : [f];
    if (!fs.length) return;
    const P = PATCH[patch] || PATCH.pad;
    P(this, ch, fs, t, dur, vel * (LOUD[patch] || 1), o);
  }

  // A drum: from its sample, once there is one (see Samples); struck live
  // till then.
  hit(drum, ch, t, vel = 1, o = {}) {
    const S = this.m.samples;
    const s = S && S.get(drum, o);
    if (s) {
      const src = this.c.createBufferSource();
      src.buffer = s.buf;
      if (s.rate !== 1) src.playbackRate.value = s.rate;
      const g = this.gain(vel * (DRUM_LOUD[drum] || 1));
      src.connect(g).connect(ch);
      src.start(t);
      return;
    }
    const D = DRUM[drum];
    if (D) D(this, ch, t, vel * (DRUM_LOUD[drum] || 1), o);
  }
}

// The drums' levels against each other likewise (a clap's narrow band and
// a hat's high hiss carry less than their envelopes say).
const DRUM_LOUD = { clap: 3.5, hat: 2.7, hatO: 2.2, shaker: 1.9, rim: 1.35, wood: 1.2 };

// How loud each instrument is against the others at the same velocity
// (measured: a held note of each, made about as loud as the rest).
export const LOUD = {
  pad: 1.1, warm: 0.7, glass: 1.15, choir: 2.3, organ: 1.1, strings: 1.3,
  ep: 1, bell: 1.25, pluck: 2.1, kalimba: 1.45, marimba: 1.4, koto: 1.7, harp: 1.35,
  flute: 0.63, lead: 1.25, brass: 1.15, horn: 0.75, squeeze: 0.85,
  sub: 0.83, moog: 1.3, pluckbass: 1.7, fmbass: 1, drone: 0.78,
  buzz: 1.35, steel: 1.5, reed: 0.63,
};

// --- the instruments ------------------------------------------------------
// Each plays a note, or a chord's notes together: (rack, channel, the
// frequencies, start, held for, velocity, options).
const each = (fs, fn) => {
  for (const f of fs) fn(f);
};
export const PATCH = {
  // Saws through a slowly opening filter and the channel's chorus: the
  // string machine's wash (two saws a note when there are few notes).
  // (`o.cut`: how bright; `o.detune`: how far apart the saws.)
  pad(R, ch, fs, t, dur, v, o) {
    const cut = o.cut || 1500;
    const a = clamp(dur * 0.3, 0.15, 1.1);
    const end = t + Math.max(a, dur) + 0.9;
    const flt = R.filter('lowpass', cut * 0.45, 0.7);
    flt.frequency.setValueAtTime(cut * 0.45, t);
    flt.frequency.linearRampToValueAtTime(cut, t + a * 1.5);
    const g = R.gain(0);
    const two = fs.length <= 2;
    R.adsr(g.gain, t, dur, 0.05 * v * (two ? 1 : 1.5), a, 0.8, 0.85, 0.9);
    const det = 6 + (o.detune || 0) * 0.5;
    each(fs, (f) => {
      for (const d of two ? [-det, det] : [(R.rand() - 0.5) * 2 * det]) R.osc('sawtooth', f, t, end, d).connect(flt);
    });
    flt.connect(g).connect(ch);
  },

  // Softer: a rounded wave, warm and dim (hard times, night).
  warm(R, ch, fs, t, dur, v, o) {
    const a = clamp(dur * 0.35, 0.2, 1.2);
    const end = t + Math.max(a, dur) + 1;
    const flt = R.filter('lowpass', o.cut ? o.cut * 0.6 : 900, 0.5);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.07 * v, a, 1, 0.9, 1);
    each(fs, (f) => R.osc('warm', f, t, end, (o.detune || 0) * (R.rand() - 0.5)).connect(flt));
    flt.connect(g).connect(ch);
  },

  // Glass: a sine with its octave and twelfth over it, each note a hair
  // out of tune with the next, shimmering and cold.
  glass(R, ch, fs, t, dur, v, o) {
    const a = clamp(dur * 0.3, 0.1, 0.9);
    const end = t + Math.max(a, dur) + 1.2;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.05 * v, a, 1.2, 0.7, 1.2);
    const det = Math.max(4, o.detune || 0);
    each(fs, (f) => R.osc('glass', f, t, end, det * (R.rand() - 0.5) * 2).connect(g));
    g.connect(ch);
  },

  // A choir breathing "ah": saws through the voice's formants, a slow
  // vibrato, slow to swell.
  choir(R, ch, fs, t, dur, v, o) {
    const a = clamp(dur * 0.35, 0.18, 1);
    const end = t + Math.max(a, dur) + 0.9;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.11 * v, a, 1, 0.85, 0.9);
    const oscs = fs.map((f) => R.osc('sawtooth', f, t, end, (6 + (o.detune || 0)) * (R.rand() - 0.5) * 2));
    R.vibrato(oscs.map((x) => x.detune), t, end, 5.2, 9, 0.3);
    for (const [ff, amp] of o.vowel === 'oo' ? [[380, 1], [820, 0.45]] : [[730, 1], [1150, 0.6]]) {
      const bp = R.filter('bandpass', ff, 6);
      for (const x of oscs) x.connect(bp);
      bp.connect(R.gain(amp)).connect(g);
    }
    g.connect(ch);
  },

  // An organ's drawbars: the pipe and its octaves and fifth, steady.
  // (`o.pipe`: a church's, rounder.)
  organ(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.3;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.06 * v, o.pipe ? 0.07 : 0.02, 0, 1, 0.25);
    each(fs, (f) => R.osc(o.pipe ? 'pipe' : 'organ', f / 2, t, end, (R.rand() - 0.5) * 4).connect(g));
    g.connect(ch);
  },

  // A string section: saws, bowed in, singing with vibrato (or shivering
  // in a tremolo, `o.trem`).
  strings(R, ch, fs, t, dur, v, o) {
    const a = clamp(dur * 0.25, 0.08, 0.5);
    const end = t + Math.max(a, dur) + 0.6;
    const flt = R.filter('lowpass', o.cut || 2600, 0.6);
    const g = R.gain(0);
    const two = fs.length <= 2;
    R.adsr(g.gain, t, dur, 0.045 * v * (two ? 1 : 1.5), a, 0.6, 0.85, 0.5);
    const oscs = [];
    each(fs, (f) => {
      for (const d of two ? [-10, 10] : [(R.rand() - 0.5) * 22]) oscs.push(R.osc('sawtooth', f, t, end, d));
    });
    R.vibrato(oscs.map((x) => x.detune), t, end, 5.5, 10, 0.3);
    for (const x of oscs) x.connect(flt);
    if (o.trem) {
      const tg = R.gain(0.6);
      R.osc('triangle', 11, t, end).connect(R.gain(0.4)).connect(tg.gain);
      flt.connect(tg).connect(g);
    } else flt.connect(g);
    g.connect(ch);
  },

  // The electric piano of the old records: bright as it's struck, the
  // brightness dying fast (as an FM piano's does), mellowing as it rings
  // (longer the lower it is).
  ep(R, ch, fs, t, dur, v) {
    const ringT = 1.2 + clamp((600 - fs[0]) / 300, 0, 1.6);
    const end = t + Math.min(dur, ringT * 1.5) + 0.35;
    const flt = R.filter('lowpass', 900, 0.6);
    const top = 1800 + 2600 * clamp(v, 0.3, 1.2);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.setTargetAtTime(Math.max(500, fs[0] * 2.2), t + 0.01, 0.18);
    const g = R.gain(0);
    R.ring(g.gain, t, dur, 0.07 * v, ringT);
    each(fs, (f) => R.osc('ep', f, t, end, (R.rand() - 0.5) * 4).connect(flt));
    flt.connect(g).connect(ch);
  },

  // A bell: a clangorous partial over the note, dying first. (`o.deep`: a
  // great bell's, tolling, its hum an octave under it.)
  bell(R, ch, fs, t, dur, v, o) {
    const ringT = o.deep ? 6 : clamp(dur * 2.4, 1.2, 3.5);
    const P = o.deep ? [[0.5, 0.5, ringT], [1, 1, ringT * 0.8], [1.19, 0.4, ringT * 0.6], [2.76, 0.22, ringT * 0.3]] : [[1, 1, ringT], [2.76, 0.35, ringT * 0.4], [5.4, 0.15, ringT * 0.18]];
    each(fs, (f) => R.partials(ch, f, t, P, 0.07 * v));
  },

  // A plucked synth: a saw through a filter that snaps shut. (`o.cut`: how
  // bright it's struck, swept by the arranger.)
  pluck(R, ch, fs, t, dur, v, o) {
    const dec = clamp(dur * 1.3, 0.18, 0.8);
    const end = t + dec + 0.05;
    const top = (o.cut || 2600) * (0.7 + 0.4 * clamp(v, 0, 1.2));
    const flt = R.filter('lowpass', top, 4);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(180, fs[0] * 1.2), t + dec * 0.6);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.08 * v, 0.003, dec);
    each(fs, (f) => R.osc('sawtooth', f, t, end, (R.rand() - 0.5) * 8).connect(flt));
    flt.connect(g).connect(ch);
  },

  // A thumb piano: a round note with a bright plink on the strike.
  kalimba(R, ch, fs, t, dur, v) {
    const ringT = clamp(dur * 2, 0.5, 1.3);
    const body = R.gain(0);
    R.perc(body.gain, t, 0.07 * v, 0.002, ringT);
    const plink = R.gain(0);
    R.perc(plink.gain, t, 0.018 * v, 0.001, 0.035);
    each(fs, (f) => {
      R.osc('sine', f, t, t + ringT + 0.01).connect(body);
      R.osc('sine', f * 5.9, t, t + 0.05).connect(plink);
    });
    body.connect(ch);
    plink.connect(ch);
  },

  // A marimba: a round wooden note, its overtone two octaves up dying fast.
  marimba(R, ch, fs, t, dur, v) {
    const ringT = clamp(0.5 + (400 - fs[0]) / 800, 0.25, 0.9);
    const body = R.gain(0);
    R.perc(body.gain, t, 0.08 * v, 0.002, ringT);
    const over = R.gain(0);
    R.perc(over.gain, t, 0.025 * v, 0.001, 0.08);
    each(fs, (f) => {
      R.osc('sine', f, t, t + ringT + 0.01).connect(body);
      R.osc('sine', f * 4, t, t + 0.1).connect(over);
    });
    body.connect(ch);
    over.connect(ch);
  },

  // A plucked koto (or a guitar's twang, in the bandits' fights): bent up
  // into the note, the filter closing as it rings.
  koto(R, ch, fs, t, dur, v, o) {
    const ringT = clamp(dur * 2, 0.5, 1.4);
    const end = t + ringT + 0.05;
    const top = o.cut || 4200;
    const flt = R.filter('lowpass', top, 3);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(300, fs[0] * 1.5), t + ringT * 0.7);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.08 * v, 0.002, ringT);
    each(fs, (f) => {
      const x = R.osc('sawtooth', f * 0.982, t, end, (R.rand() - 0.5) * 6);
      x.frequency.exponentialRampToValueAtTime(f, t + 0.035);
      x.connect(flt);
    });
    flt.connect(g).connect(ch);
  },

  // A harp: a soft round string, plucked.
  harp(R, ch, fs, t, dur, v) {
    const ringT = clamp(dur * 2, 0.8, 1.8);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.07 * v, 0.003, ringT);
    each(fs, (f) => R.osc('warm', f, t, t + ringT + 0.01).connect(g));
    g.connect(ch);
  },

  // A pan flute: a breathy chiff as it speaks, a round tone under it, the
  // vibrato coming in as the note's held.
  flute(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.15;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.08 * v, 0.05, 0.3, 0.85, 0.12);
    const oscs = fs.map((f) => R.osc('flute', f, t, end, (o.detune || 0) * (R.rand() - 0.5)));
    R.vibrato(oscs.map((x) => x.detune), t, end, 5, 7, 0.25);
    for (const x of oscs) x.connect(g);
    R.chiff(ch, fs[0] * 2, t, 0.045 * v);
    g.connect(ch);
  },

  // A synth lead: a saw over a square an octave down, and a second saw a
  // hair apart; gliding from the last note, the vibrato coming in late.
  lead(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.18;
    const cut = o.cut || 2600;
    const flt = R.filter('lowpass', cut, 2);
    flt.frequency.setValueAtTime(cut * 1.7, t);
    flt.frequency.exponentialRampToValueAtTime(cut, t + 0.18);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.05 * v, 0.008, 0.3, 0.75, 0.14);
    const oscs = [];
    each(fs, (f) => {
      const from = fs.length === 1 && o.from && Math.abs(Math.log2(o.from / f)) < 1 ? o.from : 0;
      for (const [type, m, d] of [['sawsub', 0.5, -6], ['sawtooth', 1, 7]]) {
        const x = R.osc(type, (from || f) * m, t, end, d);
        if (from) x.frequency.exponentialRampToValueAtTime(f * m, t + 0.06);
        oscs.push(x);
      }
    });
    R.vibrato(oscs.map((x) => x.detune), t, end, 5.8, 12, 0.22);
    for (const x of oscs) x.connect(flt);
    flt.connect(g).connect(ch);
  },

  // Synth brass: saws, the filter swelling open as it's blown and settling
  // back. (`o.stab`: short and punchy.)
  brass(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.22;
    const top = (o.cut || 2800) * (0.75 + 0.3 * clamp(v, 0, 1.2));
    const a = o.stab ? 0.03 : 0.07;
    const flt = R.filter('lowpass', 400, 1.2);
    flt.frequency.setValueAtTime(380, t);
    flt.frequency.linearRampToValueAtTime(top, t + a);
    flt.frequency.setTargetAtTime(top * 0.55, t + a, 0.25);
    const g = R.gain(0);
    const one = fs.length === 1;
    R.adsr(g.gain, t, dur, 0.045 * v * (one ? 1 : 1.6), a, 0.4, 0.8, o.stab ? 0.12 : 0.2);
    each(fs, (f) => {
      for (const d of one ? [-10, 0, 10] : [(R.rand() - 0.5) * 20]) R.osc('sawtooth', f, t, end, d).connect(flt);
    });
    flt.connect(g).connect(ch);
  },

  // A horn: brass blown softly, round and far (the mountains', the north's).
  horn(R, ch, fs, t, dur, v) {
    const end = t + dur + 0.3;
    const flt = R.filter('lowpass', 300, 0.8);
    flt.frequency.setValueAtTime(300, t);
    flt.frequency.linearRampToValueAtTime(1400, t + 0.14);
    flt.frequency.setTargetAtTime(950, t + 0.14, 0.3);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.07 * v, 0.1, 0.5, 0.85, 0.26);
    const oscs = fs.map((f) => R.osc('horn', f, t, end, (R.rand() - 0.5) * 6));
    R.vibrato(oscs.map((x) => x.detune), t, end, 4.8, 6, 0.35);
    for (const x of oscs) x.connect(flt);
    flt.connect(g).connect(ch);
  },

  // A squeezebox (a shanty's, a waltz's): two reeds a few cents apart,
  // beating, through the bellows' nasal ring.
  squeeze(R, ch, fs, t, dur, v) {
    const end = t + dur + 0.1;
    const flt = R.filter('lowpass', 2600, 0.7);
    const pk = R.filter('peaking', 1400, 1);
    if (pk.gain) pk.gain.value = 5;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.045 * v, 0.03, 0.2, 0.9, 0.08);
    each(fs, (f) => {
      R.osc('squeeze', f, t, end, -5).connect(flt);
      if (fs.length <= 2) R.osc('squeeze', f, t, end, 7).connect(flt);
    });
    flt.connect(pk).connect(g).connect(ch);
  },

  // --- basses ---
  // A sub: a deep, round note (the country's, the night's).
  sub(R, ch, fs, t, dur, v) {
    const end = t + dur + 0.1;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.13 * v, 0.012, 0.3, 0.85, 0.09);
    each(fs, (f) => R.osc('sub', f, t, end).connect(g));
    g.connect(ch);
  },

  // The analogue bass: a saw over a square an octave down, through a
  // resonant filter that snaps shut.
  moog(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.08;
    const top = (o.cut || 1400) * (0.6 + 0.5 * clamp(v, 0, 1.2));
    const flt = R.filter('lowpass', top, 6);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(120, fs[0] * 2), t + 0.16);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.09 * v, 0.004, 0.25, 0.75, 0.06);
    each(fs, (f) => R.osc('sawsub', f / 2, t, end).connect(flt));
    flt.connect(g).connect(ch);
  },

  // A plucked bass: a square with a round body, struck.
  pluckbass(R, ch, fs, t, dur, v) {
    const dec = clamp(dur * 1.2, 0.15, 0.6);
    const end = t + dec + 0.05;
    const flt = R.filter('lowpass', 1100, 3);
    flt.frequency.setValueAtTime(1100, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(120, fs[0] * 1.5), t + 0.12);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.11 * v, 0.003, dec);
    each(fs, (f) => R.osc('sqsine', f, t, end).connect(flt));
    flt.connect(g).connect(ch);
  },

  // The FM bass of the city records: a punchy slap, its overtones dying in
  // a moment, settling to a round note.
  fmbass(R, ch, fs, t, dur, v) {
    const end = t + dur + 0.08;
    const flt = R.filter('lowpass', 600, 0.8);
    flt.frequency.setValueAtTime(2600 * clamp(v, 0.4, 1.2), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(150, fs[0] * 2.5), t + 0.15);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.11 * v, 0.003, 0.3, 0.7, 0.07);
    each(fs, (f) => R.osc('fmb', f, t, end).connect(flt));
    flt.connect(g).connect(ch);
  },

  // A drone: the root and its fifth, low, two saws breathing slowly in a
  // filter that wanders.
  drone(R, ch, fs, t, dur, v) {
    const end = t + dur + 1.5;
    const flt = R.filter('lowpass', 220, 1.5);
    R.osc('sine', 0.09, t, end).connect(R.gain(90)).connect(flt.frequency);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.07 * v, dur * 0.35, 0, 1, 1.5);
    each(fs, (f) => {
      R.osc('sawtooth', f, t, end, -5).connect(flt);
      R.osc('sawtooth', f * 1.4983, t, end, 5).connect(flt);
    });
    flt.connect(g).connect(ch);
  },

  // --- the islands' own ---
  // The Ashborn's shawm: a nasal, buzzing reed, a wide vibrato.
  buzz(R, ch, fs, t, dur, v) {
    const end = t + dur + 0.1;
    const lp = R.filter('lowpass', 3600, 0.5);
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.08 * v, 0.02, 0.3, 0.85, 0.08);
    const oscs = fs.map((f) => R.osc('shawm', f, t, end));
    R.vibrato(oscs.map((x) => x.detune), t, end, 6.2, 16, 0.15);
    for (const x of oscs) x.connect(lp);
    lp.connect(g).connect(ch);
  },

  // The Stiltfolk's steel drum: a round note, its octave and twelfth
  // ringing over it and fading first.
  steel(R, ch, fs, t, dur, v) {
    const ringT = clamp(dur * 1.8, 0.4, 1.2);
    const end = t + ringT + 0.05;
    const flt = R.filter('lowpass', 800, 0.7);
    flt.frequency.setValueAtTime(5000, t);
    flt.frequency.setTargetAtTime(Math.max(400, fs[0] * 1.6), t + 0.005, ringT * 0.25);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.08 * v, 0.003, ringT);
    each(fs, (f) => R.osc('steel', f, t, end).connect(flt));
    flt.connect(g).connect(ch);
  },

  // The Mirefolk's reed flute: breathy, hollow, slow to speak, wavering
  // out of tune in the fog (`o.detune`).
  reed(R, ch, fs, t, dur, v, o) {
    const end = t + dur + 0.22;
    const g = R.gain(0);
    R.adsr(g.gain, t, dur, 0.08 * v, 0.09, 0.4, 0.85, 0.2);
    const oscs = fs.map((f) => R.osc('flute', f, t, end, (o.detune || 0) * (R.rand() - 0.5) * 1.5));
    R.vibrato(oscs.map((x) => x.detune), t, end, 4.4, 11, 0.3);
    for (const x of oscs) x.connect(g);
    R.chiff(ch, fs[0] * 1.5, t, 0.03 * v, 0.2);
    g.connect(ch);
  },
};

export const DRUM = {
  // A kick: a sine diving in pitch, a click on the front. (`o.f0`, `o.f1`:
  // where it dives from and to; `o.dec`: how long it booms.)
  kick(R, ch, t, v, o) {
    const f0 = o.f0 || 150;
    const f1 = o.f1 || 48;
    const dec = o.dec || 0.32;
    const x = R.osc('sine', f0, t, t + dec + 0.05);
    x.frequency.exponentialRampToValueAtTime(f1, t + 0.07);
    x.frequency.exponentialRampToValueAtTime(f1 * 0.85, t + dec);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.9 * v, 0.002, dec);
    x.connect(g).connect(ch);
    if (o.click !== false) {
      const n = R.noise(t, t + 0.02);
      const hp = R.filter('highpass', 2500, 0.7);
      const ng = R.gain(0);
      R.perc(ng.gain, t, 0.18 * v, 0.001, 0.012);
      n.connect(hp).connect(ng).connect(ch);
    }
  },

  // The big gated snare of the old records: a body, and a burst of noise
  // held and then cut.
  snare(R, ch, t, v) {
    const body = R.osc('triangle', 200, t, t + 0.15);
    body.frequency.exponentialRampToValueAtTime(165, t + 0.05);
    const bg = R.gain(0);
    R.perc(bg.gain, t, 0.5 * v, 0.001, 0.11);
    body.connect(bg).connect(ch);
    const n = R.noise(t, t + 0.2);
    const bp = R.filter('bandpass', 1900, 0.7);
    const hp = R.filter('highpass', 900, 0.7);
    const ng = R.gain(0);
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.5 * v, t + 0.002);
    ng.gain.linearRampToValueAtTime(0.32 * v, t + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    n.connect(bp).connect(hp).connect(ng).connect(ch);
  },

  // A handclap: three quick slaps and a tail.
  clap(R, ch, t, v) {
    const n = R.noise(t, t + 0.25);
    const bp = R.filter('bandpass', 1150, 1.2);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    for (const d of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(0.45 * v, t + d);
      g.gain.exponentialRampToValueAtTime(0.05 * v, t + d + 0.009);
    }
    g.gain.setValueAtTime(0.35 * v, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
    n.connect(bp).connect(g).connect(ch);
  },

  // Hats: noise, high, closed (short) or open (ringing).
  hat(R, ch, t, v, o) {
    const dec = o.open ? 0.26 : 0.04;
    const n = R.noise(t, t + dec + 0.02);
    const hp = R.filter('highpass', 7200, 0.7);
    const bp = R.filter('bandpass', 10500, 0.6);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.22 * v, 0.001, dec);
    n.connect(hp).connect(bp).connect(g).connect(ch);
  },
  hatO(R, ch, t, v) {
    DRUM.hat(R, ch, t, v, { open: true });
  },

  // A shaker's swish.
  shaker(R, ch, t, v) {
    const n = R.noise(t, t + 0.1);
    const bp = R.filter('bandpass', 5600, 1.4);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * v, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    n.connect(bp).connect(g).connect(ch);
  },

  // A rimshot's knock.
  rim(R, ch, t, v) {
    const hp = R.filter('highpass', 350, 0.7);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.3 * v, 0.001, 0.035);
    R.osc('triangle', 1720, t, t + 0.05).connect(hp);
    R.osc('triangle', 480, t, t + 0.05).connect(R.gain(0.6)).connect(hp);
    hp.connect(g).connect(ch);
  },

  // A synth tom: a pitch falling, a breath of noise. (`o.pitch`: higher or
  // lower, for a fill rolling down.)
  tom(R, ch, t, v, o) {
    const f = 150 * (o.pitch || 1);
    const x = R.osc('sine', f * 1.7, t, t + 0.4);
    x.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.6 * v, 0.002, 0.34);
    x.connect(g).connect(ch);
    const n = R.noise(t, t + 0.06);
    const lp = R.filter('lowpass', 1400, 0.7);
    const ng = R.gain(0);
    R.perc(ng.gain, t, 0.12 * v, 0.001, 0.05);
    n.connect(lp).connect(ng).connect(ch);
  },

  // Hand drums.
  conga(R, ch, t, v, o) {
    const f = (o.high ? 470 : 310) * (o.pitch || 1);
    const x = R.osc('sine', f * 1.12, t, t + 0.3);
    x.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.45 * v, 0.001, o.high ? 0.12 : 0.22);
    x.connect(g).connect(ch);
    const n = R.noise(t, t + 0.03);
    const bp = R.filter('bandpass', 2200, 1);
    const ng = R.gain(0);
    R.perc(ng.gain, t, 0.1 * v, 0.001, 0.02);
    n.connect(bp).connect(ng).connect(ch);
  },
  bongo(R, ch, t, v) {
    DRUM.conga(R, ch, t, v, { high: true });
  },

  // A great drum: a deep boom, the skin's slap on top.
  taiko(R, ch, t, v) {
    const x = R.osc('sine', 100, t, t + 0.8);
    x.frequency.exponentialRampToValueAtTime(56, t + 0.14);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.95 * v, 0.003, 0.7);
    x.connect(g).connect(ch);
    const n = R.noise(t, t + 0.15);
    const lp = R.filter('lowpass', 650, 0.7);
    const ng = R.gain(0);
    R.perc(ng.gain, t, 0.4 * v, 0.002, 0.12);
    n.connect(lp).connect(ng).connect(ch);
  },

  // A wood block's knock.
  wood(R, ch, t, v) {
    const g = R.gain(0);
    R.perc(g.gain, t, 0.3 * v, 0.001, 0.06);
    R.osc('sine', 930, t, t + 0.08).connect(g);
    R.osc('triangle', 1860, t, t + 0.05).connect(R.gain(0.25)).connect(g);
    g.connect(ch);
  },

  // A crash cymbal, opening a new part.
  crash(R, ch, t, v) {
    const n = R.noise(t, t + 1.7);
    const hp = R.filter('highpass', 3800, 0.7);
    const bp = R.filter('bandpass', 7500, 0.4);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.24 * v, 0.002, 1.6);
    n.connect(hp).connect(bp).connect(g).connect(ch);
  },

  // A cymbal swelling backward into the next part.
  swell(R, ch, t, v, o) {
    const dur = o.dur || 1;
    const n = R.noise(t, t + dur + 0.02);
    const hp = R.filter('highpass', 3000, 0.7);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15 * v, t + dur);
    g.gain.setValueAtTime(0.0001, t + dur + 0.01);
    n.connect(hp).connect(g).connect(ch);
  },

  // Timpani: a skin tuned to the note, its pitch sagging as it rings.
  timp(R, ch, t, v, o) {
    const f = o.f || 80;
    const x = R.osc('sine', f * 1.3, t, t + 1.2);
    x.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.6 * v, 0.003, 1.1);
    x.connect(g).connect(ch);
    const h = R.osc('sine', f * 1.5, t, t + 0.5);
    const hg = R.gain(0);
    R.perc(hg.gain, t, 0.18 * v, 0.003, 0.45);
    h.connect(hg).connect(ch);
    const n = R.noise(t, t + 0.1);
    const lp = R.filter('lowpass', 400, 0.7);
    const ng = R.gain(0);
    R.perc(ng.gain, t, 0.25 * v, 0.002, 0.08);
    n.connect(lp).connect(ng).connect(ch);
  },

  // An anvil struck (Kharos's drums): partials that don't agree, ringing.
  anvil(R, ch, t, v) {
    for (const [m, amp] of [[1, 1], [1.47, 0.6], [2.33, 0.45], [3.91, 0.25]]) {
      const x = R.osc('sine', 1150 * m, t, t + 0.6 / m + 0.1);
      const g = R.gain(0);
      R.perc(g.gain, t, 0.14 * v * amp, 0.001, 0.55 / m + 0.05);
      x.connect(g).connect(ch);
    }
    const n = R.noise(t, t + 0.05);
    const hp = R.filter('highpass', 3000, 0.7);
    const ng = R.gain(0);
    R.perc(ng.gain, t, 0.25 * v, 0.001, 0.04);
    n.connect(hp).connect(ng).connect(ch);
  },

  // Water dripping in the dark: a falling plink.
  drip(R, ch, t, v) {
    const f = 1400 + R.rand() * 1000;
    const x = R.osc('sine', f, t, t + 0.14);
    x.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.09);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.2 * v, 0.001, 0.11);
    x.connect(g).connect(ch);
  },

  // Finger cymbals: a high, bright ring.
  zill(R, ch, t, v) {
    for (const [f, amp] of [[2400, 1], [3610, 0.6], [5260, 0.3]]) {
      const x = R.osc('sine', f, t, t + 0.9);
      const g = R.gain(0);
      R.perc(g.gain, t, 0.05 * v * amp, 0.001, 0.85);
      x.connect(g).connect(ch);
    }
  },

  // An ember's crackle.
  crackle(R, ch, t, v) {
    const n = R.noise(t, t + 0.04);
    const bp = R.filter('bandpass', 2500 + R.rand() * 4500, 2);
    const g = R.gain(0);
    R.perc(g.gain, t, 0.3 * v, 0.001, 0.008 + R.rand() * 0.02);
    n.connect(bp).connect(g).connect(ch);
  },

  // A riser: noise swelling and climbing into what's next.
  riser(R, ch, t, v, o) {
    const dur = o.dur || 2;
    const n = R.noise(t, t + dur + 0.1);
    const bp = R.filter('bandpass', 400, 1.2);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14 * v, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    n.connect(bp).connect(g).connect(ch);
  },

  // Wind over high ground: noise through a slowly wandering band.
  wind(R, ch, t, v, o) {
    const dur = o.dur || 6;
    const n = R.noise(t, t + dur);
    const bp = R.filter('bandpass', 350, 2.5);
    bp.frequency.setValueAtTime(300 + R.rand() * 200, t);
    bp.frequency.linearRampToValueAtTime(700 + R.rand() * 500, t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(320, t + dur);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2 * v, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(ch);
  },

  // The sea: a wave rolling in and drawing back.
  sea(R, ch, t, v, o) {
    const dur = o.dur || 5;
    const n = R.noise(t, t + dur);
    const lp = R.filter('lowpass', 300, 0.5);
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.4);
    lp.frequency.linearRampToValueAtTime(250, t + dur);
    const g = R.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * v, t + dur * 0.38);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(g).connect(ch);
  },
};

// --- the drum machine's memory ------------------------------------------------
// Each drum struck once (offline, in the background) into a sample, then
// played back from it: two nodes a hit, not a handful of oscillators and
// filters. A tom or a timpani plays its one sample faster or slower for
// its pitch, as the old samplers did. (Till its sample's ready, a drum is
// struck live; drums with a length or a randomness of their own always
// are.)
const SAMPLED = { kick: 0.85, snare: 0.3, clap: 0.3, hat: 0.08, hatO: 0.32, shaker: 0.11, rim: 0.07, tom: 0.45, conga: 0.3, bongo: 0.2, taiko: 0.8, wood: 0.1, crash: 1.7, timp: 1.2, zill: 0.95, anvil: 0.65 };
export class Samples {
  constructor(ctx, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.buf = {};
    this.pending = new Set();
    this.ok = typeof globalThis.OfflineAudioContext === 'function';
  }

  // The sample for a drum struck so (and how fast to play it), or null.
  get(drum, o = {}) {
    if (!this.ok || !(drum in SAMPLED)) return null;
    let rate = 1;
    let key = drum;
    const opt = { ...o };
    if (drum === 'tom') {
      rate = o.pitch || 1;
      delete opt.pitch;
    } else if (drum === 'timp') {
      rate = (o.f || 80) / 80;
      delete opt.f;
    } else if (drum === 'kick' && Object.keys(o).length) key += JSON.stringify(o);
    const buf = this.buf[key];
    if (buf) return { buf, rate };
    if (!this.pending.has(key)) {
      this.pending.add(key);
      this.render(key, drum, opt).catch(() => {
        // (Struck live, then.)
      });
    }
    return null;
  }

  async render(key, drum, o) {
    const sr = this.ctx.sampleRate;
    const oc = new globalThis.OfflineAudioContext(1, Math.ceil(SAMPLED[drum] * sr), sr);
    const R = new Rack({ ctx: oc, noise: this.noise }, oc.destination, { echo: 0 });
    DRUM[drum](R, R.chan('x', { verb: 0 }), 0, 1, o);
    this.buf[key] = await oc.startRendering();
  }
}
