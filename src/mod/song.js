// Songs in mods (round 66): tunes sketched in the Workshop's Music tab the
// way the old trackers had it. Each channel (an instrument) has patterns,
// a bar of notes each; the song is a grid of them, saying for each bar
// which of its patterns each channel plays (or none). Played on the game's
// own instruments (see game/synth.js), or on the mod's sounds.
//
// A song, as a mod keeps it:
//   { name, bpm, beats (to a bar), steps (to a beat), bars (how long it
//     is), key (0 C .. 11 B), scale, swing (0..0.5), space ('room' |
//     'hall' | 'cave' | 'cathedral'), wet (how much of the room, 0..1),
//     echo (0..1), loopFrom (the bar it goes back to, played as music),
//     chans: [{ id, name, kind ('tone' | 'drums' | 'sound'), inst (an
//       instrument's name; a sound's '@id'), vol, pan, verb, echo, mute,
//       solo, kit (drums: the drum each row is), ring (a sound's: rung
//       out past its note's end), pats: [{ notes: [[step, note, len,
//       vel]] }], seq: [the pattern each bar plays (1..), 0 for none] }] }
// A note: the step of its bar it starts on, its pitch (MIDI's numbers, 60
// middle C; for drums, the row), how many steps long, how hard (0..1).
import { Rack, PATCH, DRUM, midiHz, makeIR, master } from '../game/synth.js';
import { SCALES } from '../game/compose.js';
import { clipBuffer } from './sound.js';

export const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALE_NAMES = { major: 'Major', minor: 'Minor', dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixo: 'Mixolydian', harmonic: 'Harmonic minor', hijaz: 'Hijaz (the desert\'s)', penta: 'Pentatonic', minpenta: 'Minor pentatonic', whole: 'Whole tone', alien: 'Kavorent', chromatic: 'Every note' };
export const scaleOf = (name) => (name === 'chromatic' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : SCALES[name] || SCALES.minor);
export const SPACES = ['room', 'hall', 'cave', 'cathedral'];
export const SONG_LIMITS = { chans: 12, pats: 99, bars: 256, notes: 256, len: 64 };

// The instruments a channel can play, in families: [key, name].
export const INSTRUMENTS = [
  ['Keys and bells', [['felt', 'Felt piano'], ['ep', 'Electric piano'], ['organ', 'Organ'], ['celesta', 'Celesta'], ['musicbox', 'Music box'], ['vibes', 'Vibraphone'], ['bell', 'Bells'], ['glass', 'Glass'], ['marimba', 'Marimba'], ['kalimba', 'Kalimba'], ['handpan', 'Handpan'], ['steel', 'Steel drum'], ['bowl', 'Singing bowl']]],
  ['Strings', [['strings', 'Strings'], ['cello', 'Cello'], ['fiddle', 'Fiddle'], ['harp', 'Harp'], ['koto', 'Koto'], ['dulcimer', 'Dulcimer'], ['pluck', 'Synth pluck'], ['twang', 'Twangy guitar'], ['dist', 'Distorted guitar'], ['screech', 'Shrieking strings']]],
  ['Winds', [['flute', 'Pan flute'], ['reed', 'Reed flute'], ['breath', 'Breath'], ['horn', 'Horn'], ['brass', 'Synth brass'], ['warhorn', 'War horn'], ['squeeze', 'Squeezebox'], ['buzz', 'Shawm'], ['didge', 'Didgeridoo']]],
  ['Voices and pads', [['pad', 'Pad'], ['warm', 'Warm pad'], ['choir', 'Choir'], ['chant', 'Chant'], ['abyss', 'Call from the deep'], ['drone', 'Drone'], ['braam', 'Braam']]],
  ['Synths', [['lead', 'Synth lead'], ['moog', 'Analogue synth'], ['theremin', 'Theremin'], ['crushed', 'Broken machine']]],
  ['Basses', [['sub', 'Sub bass'], ['pluckbass', 'Plucked bass'], ['fmbass', 'FM bass'], ['reese', 'Reese bass']]],
];
export const INST_NAME = Object.fromEntries(INSTRUMENTS.flatMap(([, l]) => l));
export const DRUM_NAMES = {
  kick: 'Kick', snare: 'Snare', clap: 'Clap', hat: 'Hi-hat', hatO: 'Open hat', shaker: 'Shaker', rim: 'Rim', tom: 'Tom', conga: 'Conga', bongo: 'Bongo', taiko: 'Taiko', wood: 'Wood block', crash: 'Crash',
  swell: 'Cymbal swell', timp: 'Timpani', anvil: 'Anvil', drip: 'Drip', zill: 'Finger cymbals', crackle: 'Crackle', gong: 'Gong', impact: 'Impact', chain: 'Chains', stomp: 'Stomp', war: 'War drum', thunder: 'Thunder', riser: 'Riser', wind: 'Wind', sea: 'Sea',
};
export const DEFAULT_KIT = ['kick', 'snare', 'hat', 'hatO', 'clap', 'tom', 'rim', 'crash'];
// (Drums that last as long as their note, not as long as they ring.)
const LONG_DRUMS = new Set(['swell', 'thunder', 'riser', 'wind', 'sea']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ------------------------------------------------------------ making one
export function newChan(kind = 'tone', o = {}) {
  const c = {
    id: o.id || 'c1', name: o.name || (kind === 'drums' ? 'Drums' : kind === 'sound' ? 'Sound' : INST_NAME[o.inst] || 'Tone'), kind,
    inst: kind === 'drums' ? null : o.inst || (kind === 'tone' ? 'ep' : null), vol: o.vol ?? 0.8, pan: o.pan ?? 0, verb: o.verb ?? (kind === 'drums' ? 0.12 : 0.3), echo: o.echo ?? 0,
    mute: false, solo: false, pats: [{ notes: [] }], seq: [],
  };
  if (kind === 'drums') c.kit = (o.kit || DEFAULT_KIT).slice();
  if (kind === 'sound') c.ring = true;
  return c;
}

// An id for a new channel (not one the song has).
export function freeChanId(song) {
  let n = 1;
  while (song.chans.some((c) => c.id === `c${n}`)) n++;
  return `c${n}`;
}

// A new song: a melody, chords, a bass and drums, every bar playing each
// one's first pattern (empty). `o.demo`: with a little tune in it already.
export function newSong(o = {}) {
  const s = { name: o.name || 'Song', bpm: 100, beats: 4, steps: 4, bars: 8, key: 9, scale: 'minor', swing: 0, space: 'hall', wet: 0.3, echo: 0.15, loopFrom: 0, chans: [] };
  s.chans.push(newChan('tone', { id: 'c1', name: 'Melody', inst: 'flute', verb: 0.35, echo: 0.25 }));
  s.chans.push(newChan('tone', { id: 'c2', name: 'Chords', inst: 'pad', vol: 0.55 }));
  s.chans.push(newChan('tone', { id: 'c3', name: 'Bass', inst: 'pluckbass', verb: 0.08 }));
  s.chans.push(newChan('drums', { id: 'c4', name: 'Drums' }));
  for (const c of s.chans) c.seq = Array(s.bars).fill(1);
  if (o.demo) demo(s);
  return s;
}

// A little tune in A minor (Am F C G), to start from and hear how it goes.
function demo(s) {
  const [mel, chords, bass, drums] = s.chans;
  const N = (list) => ({ notes: list.map(([st, note, len, vel = 0.8]) => [st, note, len, vel]) });
  mel.pats = [
    N([[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 71, 4], [12, 72, 4]]),
    N([[0, 69, 6], [6, 72, 2], [8, 77, 4], [12, 76, 4]]),
    N([[0, 76, 4], [4, 79, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4]]),
    N([[0, 71, 6], [6, 74, 2], [8, 71, 4], [12, 67, 4]]),
    N([[0, 71, 4], [4, 72, 4], [8, 69, 8, 0.9]]),
  ];
  mel.seq = [1, 2, 3, 4, 1, 2, 3, 5];
  const chord = (ns) => N(ns.map((n) => [0, n, 16, 0.6]));
  chords.pats = [chord([57, 60, 64]), chord([53, 57, 60]), chord([55, 60, 64]), chord([55, 59, 62])];
  chords.seq = [1, 2, 3, 4, 1, 2, 3, 4];
  const pulse = (r) => N([[0, r, 3, 0.9], [4, r, 3, 0.7], [8, r, 3, 0.85], [12, r + 12, 2, 0.6], [14, r, 2, 0.7]]);
  bass.pats = [pulse(45), pulse(41), pulse(48), pulse(43)];
  bass.seq = [1, 2, 3, 4, 1, 2, 3, 4];
  const beat = [[0, 0, 1, 0.9], [8, 0, 1, 0.8], [10, 0, 1, 0.6], [4, 1, 1, 0.8], [12, 1, 1, 0.8]];
  for (let i = 0; i < 16; i += 2) beat.push([i, 2, 1, i % 4 ? 0.45 : 0.6]);
  const fill = beat.filter(([st]) => st < 12).concat([[12, 5, 1, 0.7], [13, 5, 1, 0.6], [14, 5, 1, 0.75], [15, 1, 1, 0.8]]);
  drums.pats = [N(beat), N(fill), N([[0, 7, 1, 0.8], ...beat])];
  drums.seq = [3, 1, 1, 2, 3, 1, 1, 2];
}

// A song read from somewhere, put right where it's wrong (in place; and
// returned).
export function cleanSong(s) {
  if (!s || typeof s !== 'object') s = {};
  s.name = String(s.name || 'Song').slice(0, 48);
  s.bpm = clamp(Math.round(num(s.bpm, 100)), 40, 240);
  s.beats = clamp(Math.round(num(s.beats, 4)), 2, 8);
  s.steps = [2, 3, 4, 6, 8].includes(s.steps) ? s.steps : 4;
  s.bars = clamp(Math.round(num(s.bars, 8)), 1, SONG_LIMITS.bars);
  s.key = clamp(Math.round(num(s.key, 0)), 0, 11);
  if (!SCALE_NAMES[s.scale]) s.scale = 'minor';
  s.swing = clamp(num(s.swing, 0), 0, 0.5);
  if (!SPACES.includes(s.space)) s.space = 'hall';
  s.wet = clamp(num(s.wet, 0.3), 0, 1);
  s.echo = clamp(num(s.echo, 0.15), 0, 1);
  s.loopFrom = clamp(Math.round(num(s.loopFrom, 0)), 0, s.bars - 1);
  if (!Array.isArray(s.chans)) s.chans = [];
  s.chans = s.chans.filter((c) => c && typeof c === 'object').slice(0, SONG_LIMITS.chans);
  const ids = new Set();
  const bs = barSteps(s);
  for (const c of s.chans) {
    if (!['tone', 'drums', 'sound'].includes(c.kind)) c.kind = 'tone';
    if (typeof c.id !== 'string' || !/^[a-z0-9_]{1,12}$/.test(c.id) || ids.has(c.id)) c.id = freeChanId({ chans: [...ids].map((id) => ({ id })) });
    ids.add(c.id);
    c.name = String(c.name || 'Channel').slice(0, 24);
    if (c.kind === 'tone' && !PATCH[c.inst]) c.inst = 'ep';
    if (c.kind === 'drums') {
      c.inst = null;
      c.kit = (Array.isArray(c.kit) ? c.kit : DEFAULT_KIT).filter((d) => DRUM[d]).slice(0, 16);
      if (!c.kit.length) c.kit = DEFAULT_KIT.slice();
    }
    if (c.kind === 'sound') {
      c.inst = typeof c.inst === 'string' && /^(@|m:)/.test(c.inst) ? c.inst : null;
      c.ring = c.ring !== false;
    }
    c.vol = clamp(num(c.vol, 0.8), 0, 1.5);
    c.pan = clamp(num(c.pan, 0), -1, 1);
    c.verb = clamp(num(c.verb, 0.25), 0, 1);
    c.echo = clamp(num(c.echo, 0), 0, 1);
    c.mute = !!c.mute;
    c.solo = !!c.solo;
    if (!Array.isArray(c.pats) || !c.pats.length) c.pats = [{ notes: [] }];
    c.pats = c.pats.slice(0, SONG_LIMITS.pats).map((p) => {
      const rows = c.kind === 'drums' ? c.kit.length : 128;
      const notes = (p && Array.isArray(p.notes) ? p.notes : []).filter((q) => Array.isArray(q) && q.length >= 2).map(([st, n, len, vel]) => [Math.round(num(st, 0)), Math.round(num(n, 60)), clamp(Math.round(num(len, 1)), 1, SONG_LIMITS.len), clamp(num(vel, 0.8), 0, 1)]);
      return { notes: notes.filter(([st, n]) => st >= 0 && st < bs && n >= 0 && n < rows).slice(0, SONG_LIMITS.notes) };
    });
    const seq = Array.isArray(c.seq) ? c.seq : [];
    c.seq = Array.from({ length: s.bars }, (_, i) => {
      const v = Math.round(num(seq[i], 0));
      return v >= 1 && v <= c.pats.length ? v : 0;
    });
  }
  return s;
}

// ------------------------------------------------------------ its time
export const barSteps = (s) => s.beats * s.steps;
export const stepSecs = (s) => 60 / s.bpm / s.steps;
export const songSteps = (s) => s.bars * barSteps(s);
export const songSecs = (s) => songSteps(s) * stepSecs(s);
export const patAt = (c, bar) => {
  const n = c.seq[bar] || 0;
  return n ? c.pats[n - 1] || null : null;
};

// The notes struck from step `a` (of the whole song) to before `b`, of
// the channels heard (not muted; the soloed ones, if any are): [{ ci (the
// channel's place), at (the step), note, len, vel }], in order.
export function notesIn(song, a, b) {
  const bs = barSteps(song);
  const out = [];
  const solo = song.chans.some((c) => c.solo);
  song.chans.forEach((c, ci) => {
    if (c.mute || (solo && !c.solo)) return;
    for (let bar = Math.max(0, Math.floor(a / bs)); bar * bs < b && bar < song.bars; bar++) {
      const P = patAt(c, bar);
      if (!P) continue;
      for (const [st, note, len, vel] of P.notes) {
        const at = bar * bs + st;
        if (at >= a && at < b) out.push({ ci, at, note, len, vel });
      }
    }
  });
  return out.sort((p, q) => p.at - q.at || p.ci - q.ci);
}

// ------------------------------------------------------------ playing it
// What a song's instruments play through on a sound card (its noise and
// rooms, made once).
const hosts = new WeakMap();
export function songHost(ctx) {
  let h = hosts.get(ctx);
  if (h) return h;
  const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const irs = {};
  h = { ctx, noise: n, ir: (space) => (irs[space] ||= makeIR(ctx, space)) };
  hosts.set(ctx, h);
  return h;
}

// A song playing (scheduled a little ahead: call schedule(until) often).
// `host`: { ctx, noise, ir(space), samples? } (the game's Music, or
// songHost(ctx)). `o`: { from (the step to start at), loop (false: once
// through), loopTo (the bar it goes back to; the song's loopFrom if not
// given), range ([a, b) bars: only those, round and round), clip (a
// sound channel's sound: fn(ref) -> the sound), gain, onEnd }.
export class SongPlayer {
  constructor(host, dest, song, o = {}) {
    this.h = host;
    this.c = host.ctx;
    this.song = song;
    this.o = o;
    this.out = this.c.createGain();
    this.out.gain.value = o.gain ?? 1;
    this.out.connect(dest);
    this.rack = new Rack(host, this.out, { space: song.space, wet: song.wet, echo: Math.max(0.0001, song.echo), tone: 15000, beat: stepSecs(song) * song.steps });
    this.chs = new Map();
    this.pos = Math.max(0, o.from | 0);
    this.next = this.c.currentTime + 0.06;
    this.marks = [];
    this.stopped = false;
  }

  // A channel's own fader, place and sends (made the first time).
  chan(c) {
    let n = this.chs.get(c.id);
    if (n) return n;
    const R = this.rack;
    const g = R.gain(c.vol);
    let tail = g;
    let p = null;
    if (this.c.createStereoPanner) {
      p = this.c.createStereoPanner();
      p.pan.value = c.pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(R.sum);
    const vs = R.gain(c.verb);
    if (R.verbIn) tail.connect(vs).connect(R.verbIn);
    const es = R.gain(c.echo);
    if (R.echoIn) tail.connect(es).connect(R.echoIn);
    n = { g, p, vs, es };
    this.chs.set(c.id, n);
    return n;
  }

  // The song's levels changed (a channel's volume or place, the room's
  // share, the echo's): heard at once.
  refresh() {
    const t = this.c.currentTime;
    for (const c of this.song.chans) {
      const n = this.chs.get(c.id);
      if (!n) continue;
      n.g.gain.setTargetAtTime(c.vol, t, 0.02);
      if (n.p) n.p.pan.setTargetAtTime(c.pan, t, 0.02);
      n.vs.gain.setTargetAtTime(c.verb, t, 0.02);
      n.es.gain.setTargetAtTime(c.echo, t, 0.02);
    }
    const R = this.rack;
    if (R.verbOut) R.verbOut.gain.setTargetAtTime(this.song.wet * 1.6, t, 0.05);
    if (R.echoOut) R.echoOut.gain.setTargetAtTime(this.song.echo * 2.2, t, 0.05);
    R.setBeat(stepSecs(this.song) * this.song.steps);
  }

  endStep() {
    const S = this.song;
    const R = this.o.range;
    return (R ? Math.min(R[1], S.bars) : S.bars) * barSteps(S);
  }

  loopStep() {
    const S = this.song;
    const R = this.o.range;
    const to = R ? R[0] : this.o.loopTo ?? S.loopFrom ?? 0;
    return clamp(to, 0, S.bars - 1) * barSteps(S);
  }

  schedule(until) {
    let guard = 0;
    while (!this.stopped && this.next < until && guard++ < 1024) {
      const sd = stepSecs(this.song);
      if (this.pos >= this.endStep()) {
        if (this.o.loop === false) {
          this.stopped = true;
          this.ended = this.next;
          this.o.onEnd?.(this.next);
          break;
        }
        this.pos = this.loopStep();
      }
      this.playStep(this.pos, this.next, sd);
      this.marks.push([this.next, this.pos, sd]);
      if (this.marks.length > 96) this.marks.shift();
      this.next += sd;
      this.pos++;
    }
  }

  playStep(abs, t, sd) {
    const S = this.song;
    const R = this.rack;
    // (Every other step a little late: the swing.)
    const at = t + (S.steps % 2 === 0 && abs % 2 === 1 ? clamp(S.swing, 0, 0.5) * sd : 0);
    const chords = new Map();
    for (const e of notesIn(S, abs, abs + 1)) {
      const c = S.chans[e.ci];
      const n = this.chan(c);
      if (c.kind === 'tone') {
        // (A channel's notes struck together and as long: one chord.)
        const k = `${e.ci}:${e.len}`;
        if (!chords.has(k)) chords.set(k, { c, n, len: e.len, fs: [], vel: 0 });
        const q = chords.get(k);
        q.fs.push(midiHz(e.note));
        q.vel = Math.max(q.vel, e.vel);
      } else if (c.kind === 'drums') {
        const d = c.kit[e.note];
        if (d) R.hit(d, n.g, at, e.vel, LONG_DRUMS.has(d) ? { dur: Math.max(0.2, e.len * sd) } : {});
      } else this.sample(c, n, e, at, sd);
    }
    for (const q of chords.values()) R.play(q.c.inst || 'ep', q.n.g, q.fs, at, q.len * sd, q.vel);
  }

  // A sound channel's note: the sound, faster or slower for its pitch.
  sample(c, n, e, t, sd) {
    const s = this.o.clip && c.inst ? this.o.clip(c.inst) : null;
    const buf = s && clipBuffer(this.c, s);
    if (!buf) return;
    const src = this.c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 2 ** ((e.note - (s.root || 60)) / 12);
    const g = this.c.createGain();
    const v = e.vel * (s.vol ?? 1);
    g.gain.value = v;
    src.connect(g).connect(n.g);
    src.start(t);
    if (!c.ring) {
      const end = t + e.len * sd;
      g.gain.setValueAtTime(v, end);
      g.gain.linearRampToValueAtTime(0, end + 0.04);
      src.stop(end + 0.06);
    }
  }

  // Where it's got to (the step heard now, and how far into it), or null.
  at(now = this.c.currentTime) {
    let hit = null;
    for (const m of this.marks) if (m[0] <= now) hit = m;
    return hit ? hit[1] + Math.min(0.999, (now - hit[0]) / hit[2]) : null;
  }

  stop(fade = 0.08) {
    if (this.dead) return;
    this.stopped = true;
    this.dead = true;
    const now = this.c.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.exponentialRampToValueAtTime(0.0001, now + fade);
    globalThis.setTimeout(() => {
      this.out.disconnect();
      this.rack.dispose();
    }, (fade + 0.3) * 1000);
  }
}

// The song played out to samples (in the background, faster than heard):
// { rate, left, right, x (the two together) }. `o`: { rate, loops, tail
// (seconds of ring after), clip }.
export async function renderSong(song, o = {}) {
  const OAC = globalThis.OfflineAudioContext;
  if (!OAC) throw new Error('This browser can\'t make sound files.');
  const rate = o.rate || 44100;
  const loops = Math.max(1, o.loops || 1);
  const len = songSecs(song) * loops;
  const secs = Math.min(600, len + (o.tail ?? 2.5));
  const oc = new OAC(2, Math.ceil(secs * rate), rate);
  const host = songHost(oc);
  const end = master(oc, oc.destination);
  const p = new SongPlayer(host, end, song, { loop: true, loopTo: 0, clip: o.clip });
  p.next = 0.02;
  p.schedule(len + 0.01);
  const buf = await oc.startRendering();
  const left = buf.getChannelData(0);
  const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
  const x = new Float32Array(buf.length);
  for (let i = 0; i < x.length; i++) x[i] = (left[i] + right[i]) / 2;
  return { rate, left, right, x };
}

// ------------------------------------------------------------ MIDI
// General MIDI's programs (eight to a family) as the nearest instrument
// here, and back; its drum notes as the drums here, and back.
const GM = [
  'felt', 'felt', 'felt', 'ep', 'ep', 'ep', 'dulcimer', 'dulcimer', 'celesta', 'bell', 'musicbox', 'vibes', 'marimba', 'marimba', 'bell', 'dulcimer',
  'organ', 'organ', 'organ', 'organ', 'organ', 'squeeze', 'squeeze', 'squeeze', 'harp', 'koto', 'twang', 'twang', 'twang', 'dist', 'dist', 'harp',
  'pluckbass', 'pluckbass', 'pluckbass', 'fmbass', 'fmbass', 'fmbass', 'moog', 'moog', 'fiddle', 'fiddle', 'cello', 'cello', 'strings', 'pluck', 'harp', 'sub',
  'strings', 'strings', 'strings', 'strings', 'choir', 'choir', 'choir', 'braam', 'brass', 'horn', 'horn', 'brass', 'horn', 'brass', 'brass', 'brass',
  'reed', 'reed', 'reed', 'reed', 'buzz', 'buzz', 'reed', 'reed', 'flute', 'flute', 'flute', 'flute', 'breath', 'breath', 'reed', 'flute',
  'lead', 'lead', 'flute', 'lead', 'dist', 'choir', 'lead', 'moog', 'pad', 'warm', 'pad', 'choir', 'glass', 'glass', 'abyss', 'pad',
  'glass', 'pad', 'glass', 'glass', 'pad', 'abyss', 'abyss', 'glass', 'koto', 'twang', 'koto', 'koto', 'kalimba', 'buzz', 'fiddle', 'buzz',
  'celesta', 'bell', 'steel', 'marimba', 'sub', 'sub', 'sub', 'glass', 'glass', 'breath', 'breath', 'glass', 'glass', 'glass', 'glass', 'glass',
];
const GM_OF = {};
GM.forEach((p, i) => {
  if (!(p in GM_OF)) GM_OF[p] = i;
});
const GM_DRUM = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare', 41: 'tom', 42: 'hat', 43: 'tom', 44: 'hat', 45: 'tom', 46: 'hatO', 47: 'tom', 48: 'tom', 49: 'crash', 50: 'tom',
  51: 'hatO', 52: 'gong', 53: 'hatO', 54: 'shaker', 55: 'swell', 56: 'wood', 57: 'crash', 58: 'chain', 59: 'hatO', 60: 'bongo', 61: 'bongo', 62: 'conga', 63: 'conga', 64: 'conga',
  65: 'tom', 66: 'tom', 67: 'wood', 68: 'wood', 69: 'shaker', 70: 'shaker', 71: 'zill', 72: 'zill', 73: 'shaker', 74: 'shaker', 75: 'wood', 76: 'wood', 77: 'wood', 78: 'drip', 79: 'drip', 80: 'zill', 81: 'zill',
};
const DRUM_GM = {
  kick: 36, snare: 38, clap: 39, hat: 42, hatO: 46, shaker: 70, rim: 37, tom: 45, conga: 63, bongo: 60, taiko: 41, wood: 76, crash: 49, swell: 55, timp: 47, anvil: 56, drip: 79, zill: 81,
  crackle: 69, gong: 52, impact: 35, chain: 58, stomp: 41, war: 40, thunder: 57, riser: 55, wind: 74, sea: 57,
};

// The song as a MIDI file (a track for each channel; the drums on MIDI's
// drum channel).
export function songToMidi(song) {
  const PPQ = 96;
  const tps = PPQ / song.steps;
  const chunks = [];
  const vlq = (v) => {
    const out = [v & 127];
    while ((v = Math.floor(v / 128))) out.unshift((v & 127) | 128);
    return out;
  };
  const text = (s) => [...String(s).slice(0, 60)].map((ch) => Math.min(127, ch.charCodeAt(0)));
  const track = (evs) => {
    const data = [];
    let last = 0;
    evs.sort((p, q) => p[0] - q[0] || p[2] - q[2]);
    for (const [tick, b] of evs) {
      for (const v of vlq(tick - last)) data.push(v);
      for (const v of b) data.push(v);
      last = tick;
    }
    data.push(0, 0xff, 0x2f, 0);
    chunks.push(Uint8Array.from([0x4d, 0x54, 0x72, 0x6b, (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255]), Uint8Array.from(data));
  };
  const chans = song.chans.filter((c) => !c.mute);
  chunks.push(Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, ((chans.length + 1) >> 8) & 255, (chans.length + 1) & 255, 0, PPQ]));
  const tempo = Math.round(60e6 / song.bpm);
  const nm = text(song.name);
  track([[0, [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255], 0], [0, [0xff, 0x58, 4, song.beats, 2, 24, 8], 0], [0, [0xff, 0x03, nm.length, ...nm], 0]]);
  let mc = 0;
  const all = notesIn({ ...song, chans: song.chans.map((c) => ({ ...c, solo: false })) }, 0, songSteps(song));
  for (const c of chans) {
    const drums = c.kind === 'drums';
    const ch = drums ? 9 : mc === 9 ? ++mc : mc;
    if (!drums) mc = Math.min(15, mc + 1);
    const ci = song.chans.indexOf(c);
    const cn = text(c.name);
    const evs = [[0, [0xff, 0x03, cn.length, ...cn], 0]];
    if (!drums) evs.push([0, [0xc0 | ch, GM_OF[c.inst] ?? 0], 0]);
    for (const e of all) {
      if (e.ci !== ci) continue;
      const note = drums ? DRUM_GM[c.kit[e.note]] ?? 38 : clamp(e.note, 0, 127);
      const vel = clamp(Math.round(e.vel * 127), 1, 127);
      evs.push([Math.round(e.at * tps), [0x90 | ch, note, vel], 1]);
      evs.push([Math.round((e.at + (drums ? 1 : e.len)) * tps), [0x80 | ch, note, 0], 0]);
    }
    track(evs);
  }
  const size = chunks.reduce((a, q) => a + q.length, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const q of chunks) {
    out.set(q, o);
    o += q.length;
  }
  return out;
}

// A song from a MIDI file: its notes put on the song's grid (sixteenths),
// a channel for each instrument it has (the most used, a dozen at most),
// each bar a pattern (the same bar twice: the same pattern). Throws if it
// isn't one.
export function midiToSong(bytes, o = {}) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let p = 0;
  const tag = () => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
  const u32 = () => {
    const v = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
    p += 4;
    return v;
  };
  const u16 = () => {
    const v = (b[p] << 8) | b[p + 1];
    p += 2;
    return v;
  };
  const vl = () => {
    let v = 0;
    let c;
    let k = 0;
    do {
      c = b[p++] ?? 0;
      v = v * 128 + (c & 127);
    } while (c & 128 && k++ < 4);
    return v;
  };
  if (b.length < 14 || tag() !== 'MThd') throw new Error('That isn\'t a MIDI file.');
  p += 4;
  const hl = u32();
  u16();
  const ntr = u16();
  let div = u16();
  p = 8 + hl;
  if (div & 0x8000 || !div) div = 96;
  const notes = [];
  const names = {};
  let tempo = 500000;
  let tempoSet = false;
  let num = 4;
  for (let tr = 0; tr < ntr && p + 8 <= b.length; tr++) {
    const id = tag();
    p += 4;
    const len = u32();
    const end = Math.min(b.length, p + len);
    if (id !== 'MTrk') {
      p = end;
      tr--;
      continue;
    }
    let tick = 0;
    let run = 0;
    const on = new Map();
    const prog = new Array(16).fill(0);
    while (p < end) {
      tick += vl();
      let st = b[p];
      if (st & 0x80) p++;
      else st = run;
      if (st === 0xff) {
        const type = b[p++];
        const l = vl();
        if (type === 0x51 && !tempoSet && l >= 3) {
          tempo = (b[p] << 16) | (b[p + 1] << 8) | b[p + 2];
          tempoSet = true;
        } else if (type === 0x58 && l >= 1) num = b[p];
        else if ((type === 0x03 || type === 0x04) && !names[tr]) names[tr] = String.fromCharCode(...b.subarray(p, p + Math.min(l, 24))).replace(/[^\x20-\x7e]/g, '').trim();
        p += l;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        p += vl();
        continue;
      }
      if (!(st & 0x80)) break;
      run = st;
      const kind = st & 0xf0;
      const ch = st & 15;
      const d1 = b[p++];
      const d2 = kind === 0xc0 || kind === 0xd0 ? 0 : b[p++];
      const k = ch * 128 + d1;
      const close = () => {
        const s = on.get(k);
        if (s) notes.push({ tr, ch, note: d1, tick: s[0], dur: Math.max(1, tick - s[0]), vel: s[1] / 127, prog: s[2] });
        on.delete(k);
      };
      if (kind === 0x90 && d2 > 0) {
        close();
        on.set(k, [tick, d2, prog[ch]]);
      } else if (kind === 0x80 || kind === 0x90) close();
      else if (kind === 0xc0) prog[ch] = d1;
    }
    p = end;
  }
  if (!notes.length) throw new Error('That MIDI file has no notes in it.');
  const steps = 4;
  const beats = num >= 2 && num <= 8 ? num : 4;
  const tps = div / steps;
  const bs = beats * steps;
  const song = { name: o.name || 'Song', bpm: clamp(Math.round(60e6 / tempo), 40, 240), beats, steps, bars: 1, key: 0, scale: 'chromatic', swing: 0, space: 'hall', wet: 0.25, echo: 0.1, loopFrom: 0, chans: [] };
  // (Each track's channel a channel here: the busiest, a dozen at most.)
  const groups = new Map();
  for (const q of notes) {
    const k = `${q.tr}:${q.ch}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(q);
  }
  const list = [...groups.values()].sort((a, c) => c.length - a.length).slice(0, SONG_LIMITS.chans).sort((a, c) => a[0].tr - c[0].tr || a[0].ch - c[0].ch);
  let maxStep = 0;
  let lost = 0;
  list.forEach((qs, i) => {
    const drums = qs[0].ch === 9;
    const c = newChan(drums ? 'drums' : 'tone', { id: `c${i + 1}`, inst: drums ? null : GM[qs[0].prog] || 'ep' });
    c.name = (names[qs[0].tr] || (drums ? 'Drums' : INST_NAME[c.inst] || 'Channel')).slice(0, 24);
    if (drums) {
      const count = {};
      for (const q of qs) {
        const d = GM_DRUM[q.note] || 'tom';
        count[d] = (count[d] || 0) + 1;
      }
      c.kit = Object.keys(count).sort((a, z) => count[z] - count[a]).slice(0, 16);
    }
    const bars = new Map();
    for (const q of qs) {
      const at = Math.round(q.tick / tps);
      const bar = Math.floor(at / bs);
      if (bar >= SONG_LIMITS.bars) continue;
      const row = drums ? c.kit.indexOf(GM_DRUM[q.note] || 'tom') : q.note;
      if (row < 0) continue;
      const len = drums ? 1 : clamp(Math.round(q.dur / tps), 1, SONG_LIMITS.len);
      if (!bars.has(bar)) bars.set(bar, []);
      bars.get(bar).push([at - bar * bs, row, len, Math.round(q.vel * 100) / 100]);
      maxStep = Math.max(maxStep, at);
    }
    c.pats = [];
    const seen = new Map();
    c.seq = [];
    for (const [bar, ns] of bars) {
      ns.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
      const key = JSON.stringify(ns);
      let n = seen.get(key);
      if (!n) {
        if (c.pats.length >= SONG_LIMITS.pats) {
          lost++;
          continue;
        }
        c.pats.push({ notes: ns.slice(0, SONG_LIMITS.notes) });
        n = c.pats.length;
        seen.set(key, n);
      }
      c.seq[bar] = n;
    }
    if (!c.pats.length) c.pats = [{ notes: [] }];
    song.chans.push(c);
  });
  song.bars = clamp(Math.floor(maxStep / bs) + 1, 1, SONG_LIMITS.bars);
  for (const c of song.chans) c.seq = Array.from({ length: song.bars }, (_, i) => c.seq[i] || 0);
  cleanSong(song);
  song.lost = lost;
  return song;
}

// ------------------------------------------------------------ files
export const SONG_FORMAT = 'tessera-song';
// A song as a file of its own (with the mod's sounds it plays, so it's
// whole wherever it goes).
export function songFile(song, mod = null) {
  const s = JSON.parse(JSON.stringify(song));
  delete s.id;
  const sounds = {};
  for (const c of s.chans) {
    if (c.kind !== 'sound' || typeof c.inst !== 'string' || c.inst[0] !== '@') continue;
    const id = c.inst.slice(1);
    const snd = mod && mod.sounds && mod.sounds[id];
    if (snd) sounds[id] = { ...snd };
  }
  return JSON.stringify({ format: SONG_FORMAT, v: 1, song: s, sounds });
}

// A song file's song (and the sounds it brought). Throws if it isn't one.
export function readSongFile(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('That file isn\'t a song (it couldn\'t be read).');
  }
  if (!d || d.format !== SONG_FORMAT || !d.song) throw new Error('That file isn\'t a song.');
  return { song: cleanSong(d.song), sounds: d.sounds && typeof d.sounds === 'object' ? d.sounds : {} };
}
