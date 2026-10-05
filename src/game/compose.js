// Writing the tunes (see music.js for what plays them, synth.js for the
// instruments). A theme's tune grows out of a couple of motifs: a bar's
// rhythm and the shape of its line. A motif is played over the theme's
// chords, then again moved to fit the next chord, then varied, then closed
// with a cadence: four bars that ask and answer, like a tune someone could
// whistle. The notes on the beat are the chord's own; the ones between
// step to them. A second motif makes the contrasting middle. Under it all:
// chords voiced to move as little as they can from one to the next, a bass
// line in the theme's style, broken chords, and the drum machine's
// patterns (see KITS).

// The scales, as semitones above the root.
export const SCALES = {
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
  // (Nobody's: the Kavorent's.)
  alien: [0, 1, 4, 5, 6, 10],
};

// A chord on a scale degree, as the degrees in it: three notes, or four
// (the seventh: the soft, open sound of the old synthesizer records), the
// ninth added, suspended, or bare fifths (dark, and hard).
export const SHAPES = {
  triad: [0, 2, 4],
  seventh: [0, 2, 4, 6],
  add9: [0, 2, 4, 8],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  power: [0, 4, 7],
  six: [0, 2, 4, 5],
};
export const chordDegs = (root, shape = 'triad') => (SHAPES[shape] || SHAPES.triad).map((k) => root + k);

// A scale degree (any octave) as a MIDI note.
export function degMidi(root, scale, deg, oct = 0) {
  const sc = SCALES[scale] || SCALES.major;
  const n = sc.length;
  const o = Math.floor(deg / n);
  return root + sc[((deg % n) + n) % n] + 12 * (o + oct);
}

// The rhythms a bar of tune can take (the steps it plays on), by how busy
// the music is: four to the bar (sixteen steps) or three (twelve).
const RHYTHMS = {
  16: {
    slow: [[0, 8], [0, 6, 8], [0, 12], [0, 4, 8], [0, 10], [0, 3, 8], [0, 8, 12]],
    mid: [[0, 4, 6, 8, 12], [0, 3, 6, 8, 12], [0, 2, 4, 8, 12], [0, 6, 8, 10, 12], [0, 4, 8, 10, 12, 14], [0, 3, 6, 10, 12], [0, 4, 7, 8, 12]],
    busy: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 12, 14], [0, 2, 4, 7, 8, 10, 12, 15], [0, 3, 4, 6, 8, 11, 12, 14]],
  },
  12: {
    slow: [[0, 8], [0, 4, 8], [0, 6]],
    mid: [[0, 4, 6, 8], [0, 2, 4, 8], [0, 4, 8, 10]],
    busy: [[0, 2, 4, 6, 8, 10], [0, 3, 4, 6, 8, 10], [0, 2, 4, 8, 10]],
  },
};
const busyness = (energy) => (energy < 0.36 ? 'slow' : energy < 0.72 ? 'mid' : 'busy');

// A motif: a bar's rhythm, and the step (in scale degrees) from each of
// its notes to the next: mostly steps, now and then a leap (more of them
// in bright music, fewer in dark), and after a leap a turn back to fill
// the gap.
export function motif(r, meter = 16, energy = 0.5, mood = 'calm') {
  const pool = RHYTHMS[meter === 12 ? 12 : 16][busyness(energy)];
  const rhythm = pool[Math.floor(r() * pool.length)];
  const leapy = mood === 'bright' ? 0.3 : mood === 'dark' || mood === 'eerie' ? 0.14 : 0.22;
  const shape = [];
  let dir = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < rhythm.length; i++) {
    const leap = i > 0 && r() < leapy;
    shape.push(leap ? dir * (2 + Math.floor(r() * 2)) : i === 0 ? 0 : dir * (r() < 0.8 ? 1 : 0));
    if (leap) dir = -dir;
    else if (r() < 0.28) dir = -dir;
  }
  return { rhythm, shape };
}

// The same motif played another way: a note let go, one added between, the
// shape turned upside down, or the rhythm shifted a step.
export function vary(M, r, meter = 16) {
  const k = r();
  if (k < 0.3) return { rhythm: M.rhythm, shape: M.shape.map((m) => -m) };
  if (k < 0.55 && M.rhythm.length > 2) {
    const drop = 1 + Math.floor(r() * (M.rhythm.length - 1));
    return { rhythm: M.rhythm.filter((_, i) => i !== drop), shape: M.shape.filter((_, i) => i !== drop) };
  }
  if (k < 0.8) {
    const at = M.rhythm[M.rhythm.length - 1];
    const add = Math.min(meter - 2, at + 2);
    if (add > at) return { rhythm: [...M.rhythm, add], shape: [...M.shape, M.shape[M.shape.length - 1] > 0 ? -1 : 1] };
  }
  return { rhythm: M.rhythm.map((s, i) => (i > 0 && s + 1 < meter && !M.rhythm.includes(s + 1) ? s + 1 : s)), shape: M.shape };
}

// The nearest of a chord's degrees (in any octave) to `deg`.
function nearestIn(deg, chord, n) {
  let best = deg;
  let bd = Infinity;
  for (const c of chord) {
    for (let o = -2; o <= 2; o++) {
      const d = c + o * n;
      const dd = Math.abs(d - deg) + (d === deg ? -0.1 : 0);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
  }
  return best;
}

// Four bars of tune over `prog` (a chord root a bar): the motif, the motif
// again (fitted to the next chord), a variation, and a cadence: closed
// (`close`) at home (the key's own note, where the last chord holds it,
// else that chord's root), or left open on its fifth (asking to go on). Each
// note { s, deg, len, vel }, `deg` a scale degree; kept between `lo` and
// `hi`.
export function line(T, r, M, prog, { close = true, lo = 0, hi = 11, shape = 'triad', meter = 16 } = {}) {
  const n = (SCALES[T.scale] || SCALES.major).length;
  const bars = [];
  const strongEvery = meter === 12 ? 6 : 4;
  let deg = nearestIn(Math.round((lo + hi) / 2), chordDegs(prog[0], shape), n);
  const V = vary(M, r, meter);
  for (let b = 0; b < 4; b++) {
    const root = prog[b % prog.length];
    const chord = chordDegs(root, shape === 'power' ? 'triad' : shape);
    const use = b === 2 ? V : M;
    const cadence = b === 3;
    // (The cadence: the first half of the motif, and a long last note.)
    const rh = cadence ? use.rhythm.filter((s) => s < meter / 2).concat(use.rhythm.some((s) => s >= meter / 2) ? [meter / 2] : []) : use.rhythm;
    const notes = [];
    rh.forEach((s, i) => {
      const strong = s % strongEvery === 0 || i === 0;
      let target = deg + (use.shape[i] || 0);
      if (strong) target = nearestIn(target, chord, n);
      if (cadence && i === rh.length - 1) target = nearestIn(target, close ? (chord.some((c) => ((c % n) + n) % n === 0) ? [0] : [root]) : [root + 4, root + 1], n);
      while (target > hi) target -= n;
      while (target < lo) target += n;
      deg = target;
      const next = i + 1 < rh.length ? rh[i + 1] : meter;
      const len = cadence && i === rh.length - 1 ? meter - s : Math.max(1, Math.min(next - s, 8));
      notes.push({ s, deg, len, vel: strong ? 1 : 0.78 + r() * 0.12 });
    });
    bars.push(notes);
  }
  return bars;
}

// A counter-line under the tune: the chords' thirds and sevenths (or
// fifths), two notes to the bar, moving against the tune, lower than it.
export function counterLine(T, r, prog, { lo = -3, hi = 6, meter = 16 } = {}) {
  const n = (SCALES[T.scale] || SCALES.major).length;
  const bars = [];
  let deg = Math.round((lo + hi) / 2);
  for (let b = 0; b < 4; b++) {
    const root = prog[b % prog.length];
    const notes = [];
    for (const s of meter === 12 ? [0, 6] : [0, 8]) {
      const want = [root + 2, root + 6, root + 4][Math.floor(r() * 3)];
      let target = nearestIn(deg + (r() < 0.5 ? -1 : 1), [want], n);
      while (target > hi) target -= n;
      while (target < lo) target += n;
      deg = target;
      notes.push({ s, deg, len: meter / 2, vel: 0.85 });
    }
    bars.push(notes);
  }
  return bars;
}

// A bar of bass in a style, under a chord rooted on `root` (the next
// chord's root `next`, for a walk up to it). Each { s, deg, oct, len, vel }.
export function bassBar(style, root, next, meter = 16, r = Math.random, energy = 0.5) {
  const out = [];
  const q = meter === 12 ? 4 : 4;
  const add = (s, deg, len, vel = 1, oct = -2) => out.push({ s, deg, oct, len, vel });
  switch (style) {
    case 'drone':
      add(0, root, meter * 2, 0.9);
      break;
    case 'root':
      add(0, root, meter / 2 + 2, 1);
      if (meter === 16) add(8, root, 7, 0.75);
      break;
    case 'fifths':
      add(0, root, meter / 2, 1);
      add(meter / 2, root + 4, meter / 2 - 1, 0.8);
      break;
    case 'walk': {
      // Root, third, fifth, and a step to the next chord.
      add(0, root, 3, 1);
      add(q, root + 2, 3, 0.75);
      add(2 * q, root + 4, 3, 0.85);
      if (meter === 16) add(3 * q, next + (next > root ? -1 : 1), 3, 0.75);
      break;
    }
    case 'bounce':
      // (Root and its octave, skipping: a town's dancing bass.)
      add(0, root, 3, 1);
      add(3, root, 1, 0.6, -1);
      add(6, root + 4, 2, 0.8);
      if (meter === 16) {
        add(8, root, 3, 0.9);
        add(11, root, 1, 0.6, -1);
        add(14, next, 2, 0.75);
      }
      break;
    case 'offbeat':
      // (The shallows: the bass skipping off the beat.)
      for (let s = 2; s < meter; s += 4) add(s, s % 8 === 2 ? root : root + 4, 2, 0.85);
      add(0, root, 1, 0.7);
      break;
    case 'pulse':
      // Eighths on the root, an octave up on the off-beats (the old
      // synthesizer records' driving bass).
      for (let s = 0; s < meter; s += 2) add(s, root, 2, s % 4 === 0 ? 1 : 0.7, s % 4 === 2 && energy > 0.6 ? -1 : -2);
      break;
    case 'gallop':
      for (let s = 0; s < meter; s += 4) {
        add(s, root, 2, 1);
        add(s + 2, root, 1, 0.7);
        add(s + 3, root, 1, 0.75);
      }
      break;
    case 'waltz':
      add(0, root, 4, 1);
      break;
    default:
      add(0, root, meter, 1);
  }
  return out;
}

// Broken chords: which of the chord's notes (and the octave over it) in
// turn, for each style.
export const ARPS = {
  up: [0, 1, 2, 3],
  updown: [0, 1, 2, 3, 2, 1],
  broken: [0, 2, 1, 3, 2, 4],
  wide: [0, 2, 4, 1, 3, 4],
  down: [3, 2, 1, 0],
};

// The drum machine's patterns: a bar to a line, one line for each of its
// drums ('x' a full stroke, 'o' a lighter one, '-' a ghost, '.' none).
// `fill` is played on the last bar before a new part of the tune; `crash`
// opens the next.
export const KITS = {
  // Out in the country: a soft thump, a shaker.
  soft: { kick: 'x.......x.......', shaker: '..o...o...o...o.', rim: '............-...' },
  // A village: a light tread, a rimshot on the back beat, a shaker.
  light: { kick: 'x.......x..o....', rim: '....o.......o...', shaker: '-.o.-.o.-.o.-.o.', fill: { rim: '....o.......o.oo', kick: 'x.......x.x.x...' } },
  // A town: the drum machine proper, a clap on the back beat.
  groove: { kick: 'x.....x.x.......', snare: '....o.......o...', clap: '............o...', hat: 'o.-.o.-.o.-.o.-.', hatO: '..............o.', fill: { snare: '....o.......oooo', kick: 'x.....x.x.x.x...' }, crash: true },
  // A city: busier, the hats in sixteenths.
  city: { kick: 'x.......x.x.....', snare: '....x.......x...', clap: '....o.......o...', hat: 'o-o-o-o-o-o-o-o-', hatO: '......o.......o.', fill: { snare: '....x...x.x.xxxx', tom: '............o.oo' }, crash: true },
  // Hand drums: congas, bongos, a shaker, finger cymbals now and then.
  hand: { conga: 'x..o..x...o.x...', bongo: '..o...-.o...-.o.', shaker: '-.o.-.o.-.o.-.o.', zill: '............-...', fill: { conga: 'x..o..x...o.xooo' } },
  // Toms and wood, the jungle's.
  tribal: { tom: 'x.....x.x..o..o.', wood: '..o...o...o...o.', shaker: '-o-o-o-o-o-o-o-o', fill: { tom: 'x.....x.x.oooxxx' } },
  // The shallows': hand drums under, a wood block knocking across them.
  steel: { conga: 'x..o..x...o.x...', wood: '..o..o...o..o...', shaker: '-.o.-.o.-.o.-.o.', fill: { conga: 'x..o..x...o.ooxx' } },
  // A march: snare rolls on the drum machine.
  march: { kick: 'x.......x.......', snare: '....x.oo....x.oo', rim: '-.-.-.-.-.-.-.-.', fill: { snare: '....x.xxxxxxxxxx' }, crash: true },
  // Three to the bar: one, two, three.
  waltz: { kick: 'x...........', hat: '....o...o...', shaker: '..-...-...-.' },
  // The dark: a heartbeat, now and then.
  heart: { kick: 'x..o............' },
  // High ground: a great drum far off, echoing.
  peak: { taiko: 'x.......x.......', tom: '..........-.....', fill: { taiko: 'x.......x...x.x.' } },
  // A shanty: stamping feet and clapping hands.
  shanty: { kick: 'x.......x.......', clap: '....o.......o...', shaker: '-.o.-.o.-.o.-.o.', fill: { clap: '....o...o...oooo', kick: 'x.......x.x.x...' } },
  // A rite: great drums and rattles, circling.
  ritual: { taiko: 'x.....x.....x...', tom: '...o.....o....o.', shaker: '-o-o-o-o-o-o-o-o', fill: { tom: '...o.....o.oooxx' } },
  // Far below: a heartbeat and a distant hammer.
  deep: { kick: 'x..o............', tom: '..........-.....' },
  // A fight with beasts: taiko and toms, the hunt's pulse; no snare.
  beast: { taiko: 'x.....x...x.....', tom: '..o..o....o..o.o', shaker: 'o-o-o-o-o-o-o-o-', fill: { tom: 'x.....x...xoxoxx', taiko: 'x.....x...x...x.' }, crash: true },
  // (Round 49: each kind of fight its own drums, all of them heavier.)
  // The hunt: war drums and stamping, low toms circling; no snare, nothing
  // bright.
  hunt: { taiko: 'x.....x...x.....', stomp: 'x.......x..x....', tom: '..o..o....o..o.o', wood: '...-.......-....', fill: { tom: 'x.....x...xoxoxx', taiko: 'x.....x...x...x.' }, crash: true },
  // The night's: an iron foundry: a low snare, chains rattling, a kick that
  // stumbles.
  night: { kick: 'x..x....x..x..x.', war: '....x.......x...', chain: '..o...o.-.o...o.', tom: '..............oo', fill: { war: '....x...x.xxxxxx', tom: '........o.o.oooo' }, crash: true },
  // The watch's: a war march, the low snare rolling, timpani on the bar.
  warmarch: { kick: 'x.......x.......', war: '....x.oo....x.oo', timp: 'x.......x.......', rim: '-.-.-.-.-.-.-.-.', fill: { war: '....x.xxxxxxxxxx', timp: 'x.......x.x.x.x.' }, crash: true },
  // The outlaws': boots stamping on boards, slow hand claps, a wood block.
  outlaw: { stomp: 'x.....x.x.......', clap: '....o.......o...', wood: '..-.....-.o.....', tom: '..............o.', fill: { stomp: 'x.....x.x.x.xxx.', clap: '....o...o.o.oooo' }, crash: true },
  // The Kavorent's halls in a fight: a machine's pulse, chains for hats.
  machine: { kick: 'x...x...x...x...', war: '....x.......x...', chain: '..o...o...o..oo.', fill: { war: '....x...x.x.xxxx', chain: 'oooooooooooooooo' }, crash: true },
  // The deep water's: slow toms, a heartbeat, the dripping.
  abyss: { kick: 'x.....x...x.....', tom: '....o.......o..o', conga: '..-...-...-...-.', fill: { tom: '....o...o.o.oooo' }, drip: true, crash: true },
  // The Wildwood's rite: war drums, toms, a wood block knocking.
  rite: { taiko: 'x.......x...x...', tom: '..o.o.....o.o...', wood: 'o...o...o...o...', fill: { tom: '..o.o...x.xxxxxx' }, crash: true },
  // A barrow's: a dirge, a heartbeat kick under a slow low snare.
  dirge: { kick: 'x..x....x..x....', war: '........x.......', tom: '....-.......-...', fill: { war: '........x.x.xxxx', tom: '....o.......oooo' }, crash: true },
  // A mountain breaking open: great drums and the ground stamping.
  quake: { taiko: 'x.....x.x.......', stomp: 'x..x....x..x....', tom: '....o.......o.o.', fill: { taiko: 'x.....x.x.x.xxxx' }, crash: true },
  // The storm at sea: a great drum and a low snare, thunder in it.
  gale: { taiko: 'x.......x.......', war: '....x.......x.x.', tom: '..-...-...-...-.', fill: { war: '....x...xxxxxxxx' }, crash: true },
  // A fight with things of the night: the drum machine at full tilt, a
  // gated snare, sixteenth hats.
  battle: { kick: 'x..x....x..x....', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', clap: '............o...', fill: { snare: '....x...x.xxxxxx', tom: '........o.o.oooo' }, crash: true },
  // Driving: four on the floor.
  drive: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', shaker: 'o-o-o-o-o-o-o-o-', fill: { snare: '....x.......xxxx' }, crash: true },
  // A bandits' fight: hand drums and a stamping kick.
  rogue: { kick: 'x..x..x.x.......', conga: '..o..o....o.o..o', snare: '....o.......o...', shaker: '-o-o-o-o-o-o-o-o', fill: { conga: 'x..o..x...ooxxxx' }, crash: true },
  // Kharos: hammer, anvil, a bellows breathing.
  forge: { kick: 'x.......x.......', anvil: '....x.......x..-', tom: '......-.........', fill: { anvil: '....x.......x.xx' } },
  forge_battle: { kick: 'x..x....x..x....', anvil: '....x.......x...', chain: '.-.-.-.-.-.-.-.-', war: '....o.......o...', fill: { anvil: '....x...x.x.xxxx' }, crash: true },
  // Embers: a crackle here and there, a low thump.
  crackle: { kick: 'x...............', crackle: true },
  // Myrrow's dark water: a drip now and then, and a heartbeat.
  drip: { kick: 'x.........-.....', drip: true },
  // A master's, by its phase: heavy and slow, then driving, then savage.
  // (Round 49: the low war snare, chains for hats: darker, heavier.)
  grand: { taiko: 'x.......x.......', kick: 'x.....x...x.....', war: '........x.......', fill: { war: '........x.xxxxxx', tom: '............xxxx' }, crash: true },
  grand2: { kick: 'x..x....x..x....', war: '....x.......x...', chain: '..o...o...o...o.', taiko: 'x.......x.......', fill: { war: '....x...xxxxxxxx', tom: '........x.x.xxxx' }, crash: true },
  fury: { kick: 'x.xx..x.x.xx..x.', war: '....x..x....x.xx', chain: 'o.o.o.o.o.o.o.o.', taiko: 'x...x...x...x...', fill: { war: 'xxxxxxxxxxxxxxxx', tom: '........xxxxxxxx' }, crash: true },
};
// What a line's character is worth as a stroke's strength.
export const HIT = { x: 1, X: 1.2, o: 0.62, '-': 0.32, '.': 0 };
