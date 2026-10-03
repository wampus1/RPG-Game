// Adaptive chiptune music, made up as it plays. Each place has a theme: a
// key, a scale, a tempo, a chord progression, instruments and a drum
// pattern. A theme makes a couple of short melodic phrases and plays them
// in an A-A-B-A shape over its chords, so it sounds like a tune rather
// than noodling. When you move somewhere else (into a town, a ruin, a
// graveyard, another biome, or a fight) the old theme fades out as the
// new one fades in. Nights are slower and quieter.
import { mulberry32 } from '../util/rng.js';
import { townMusic } from '../sim/prosperity.js';
import { fightPhase } from '../entities/tempo.js';

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
  // (Nobody's: the Kavorent's.)
  alien: [0, 1, 4, 5, 6, 10],
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
  // ...and each its own fight, and its own master's: a barrow's bell
  // tolling under the drums, a mine's hammering, a crypt's organ, a
  // holdout's war drums, the Kavorent's scale turned savage. A master's is
  // grand and dark (`grand`): a low drone under it all, a choir breathing
  // in each bar, brass stabs, timpani, a deep bell with a tritone ringing
  // in it; and it climbs as the fight does, through the master's phases
  // (see bossLevel).
  dungeon_barrow_fight: { root: 50, scale: 'phrygian', bpm: 138, prog: [0, 1, 5, 0], lead: 'square', drums: 'battle', density: 0.74, drive: true, toll: true },
  dungeon_barrow_boss: { root: 45, scale: 'phrygian', bpm: 118, prog: [0, 1, 6, 5, 0, 1, 4, 0], lead: 'square', drums: 'grand', density: 0.6, toll: true, organ: true, grand: true, choir: true, brass: true },
  dungeon_mine_fight: { root: 48, scale: 'minor', bpm: 142, prog: [0, 6, 5, 6], lead: 'square', drums: 'tribal', density: 0.72, drive: true, fifths: true },
  dungeon_mine_boss: { root: 43, scale: 'harmonic', bpm: 122, prog: [0, 6, 5, 4, 0, 6, 1, 4], lead: 'square', drums: 'grand', density: 0.62, fifths: true, grand: true, brass: true, choir: true },
  dungeon_crypt_fight: { root: 52, scale: 'harmonic', bpm: 132, prog: [0, 5, 1, 4], lead: 'square', drums: 'march', density: 0.7, drive: true, organ: true },
  dungeon_crypt_boss: { root: 45, scale: 'harmonic', bpm: 114, prog: [0, 5, 1, 4, 0, 6, 1, 4], lead: 'square', drums: 'grand', density: 0.58, organ: true, toll: true, detune: 8, grand: true, choir: true },
  dungeon_holdout_fight: { root: 55, scale: 'dorian', bpm: 150, prog: [0, 6, 0, 4], lead: 'square', drums: 'tribal', density: 0.78, drive: true, swing: 0.1 },
  dungeon_holdout_boss: { root: 46, scale: 'phrygian', bpm: 126, prog: [0, 1, 0, 6, 0, 1, 4, 6], lead: 'square', drums: 'grand', density: 0.64, grand: true, brass: true },
  dungeon_kavorent_fight: { root: 54, scale: 'whole', bpm: 140, prog: [0, 1, 3, 2], lead: 'square', drums: 'battle', density: 0.78, drive: true, arp: true },
  // A Kavorent spire: near it, a slow wrong music in a scale nobody uses;
  // as one opens, it gathers and swells; open, it rings.
  spire: { root: 49, scale: 'alien', bpm: 48, prog: [0, 1, 5, 2], lead: 'sine', pad: true, drums: null, density: 0.16, detune: 28, arp: true },
  spire_swell: { root: 49, scale: 'alien', bpm: 92, prog: [0, 1, 0, 1, 5, 2, 5, 3], lead: 'square', pad: true, organ: true, drums: 'tribal', density: 0.62, drive: true, detune: 18, arp: true },
  spire_open: { root: 54, scale: 'whole', bpm: 64, prog: [0, 2, 4, 1], lead: 'sine', pad: true, organ: true, arp: true, drums: null, density: 0.34, detune: 22 },
  dungeon_kavorent_boss: { root: 42, scale: 'alien', bpm: 116, prog: [0, 1, 3, 2, 0, 4, 3, 1], lead: 'square', drums: 'grand', density: 0.6, arp: true, detune: 14, grand: true, choir: true, brass: true },
  // The openings: an old town's story, slow and warm; a shanty on deck;
  // the storm; and the cold after.
  history: { root: 60, scale: 'major', bpm: 74, prog: [0, 5, 3, 4], lead: 'triangle', pad: true, arp: true, drums: null, density: 0.42 },
  voyage: { root: 62, scale: 'dorian', bpm: 110, prog: [0, 3, 0, 4], lead: 'square', drums: 'light', density: 0.62, swing: 0.3 },
  storm: { root: 50, scale: 'phrygian', bpm: 140, prog: [0, 1, 0, 6], lead: 'square', drums: 'battle', density: 0.74, drive: true, detune: 10 },
  wreck: { root: 45, scale: 'minor', bpm: 46, prog: [0, 5, 3, 4], lead: 'sine', pad: true, drums: null, density: 0.14 },
  fight_boss: { root: 45, scale: 'harmonic', bpm: 120, prog: [0, 5, 1, 4, 0, 6, 1, 4], lead: 'square', drums: 'grand', density: 0.6, organ: true, grand: true, choir: true, brass: true },
  // The title's other songs (see TITLE_SONGS): a bright morning on bells;
  // a waltz by the fire, three to the bar; a slow ballad of the barrows,
  // sung in parts; a march under the banner; a shanty for far shores; the
  // dark below with its bell; and the Kavorent's glass and starlight.
  title_dawn: { root: 60, scale: 'lydian', bpm: 84, prog: [0, 4, 5, 3], lead: 'triangle', bell: true, pad: true, drums: null, density: 0.42, arp: true },
  title_hearth: { root: 62, scale: 'major', bpm: 128, meter: 12, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'triangle', harmony: true, drums: 'waltz', density: 0.55 },
  title_ballad: { root: 55, scale: 'harmonic', bpm: 64, prog: [0, 5, 3, 4, 0, 5, 1, 4], lead: 'sine', harmony: true, pad: true, drums: null, density: 0.34, detune: 6 },
  title_banner: { root: 58, scale: 'mixo', bpm: 100, prog: [0, 6, 3, 4], lead: 'square', drums: 'march', density: 0.6, fifths: true, stabs: true },
  title_shore: { root: 62, scale: 'dorian', bpm: 104, prog: [0, 6, 0, 4], lead: 'square', drums: 'hand', density: 0.6, swing: 0.28, harmony: true },
  title_deep: { root: 50, scale: 'phrygian', bpm: 58, prog: [0, 1, 5, 0], lead: 'sine', bell: true, pad: true, drums: null, density: 0.24, toll: true, detune: 10 },
  title_spire: { root: 54, scale: 'whole', bpm: 70, meter: 12, prog: [0, 2, 4, 1], lead: 'sine', bell: true, pad: true, arp: true, drums: null, density: 0.3, detune: 16 },
};

// The title plays these one after another (a few minutes each, never the
// same one twice running): the theme and what it's called.
export const TITLE_SONGS = [
  ['title', 'The Long Road'],
  ['title_dawn', 'Dawn over the Vale'],
  ['title_hearth', 'Hearthside Waltz'],
  ['title_ballad', 'Ballad of the Barrows'],
  ['title_banner', 'Under the Banner'],
  ['title_shore', 'Far Shores'],
  ['title_deep', 'What Lies Below'],
  ['title_spire', 'Glass and Starlight'],
];
// Seconds of each before the next.
export const TITLE_SONG_LEN = 150;

// What the music should be right now.
export function musicMood(game) {
  const p = game.player;
  if (!p) return 'title';
  if (game.cutscene && game.cutscene.mood) return game.cutscene.mood;
  if (game.scene && game.scene.mood) return game.scene.mood;
  // A fight: guards after you, or beasts at your throat.
  if (!p.dead) {
    const guards = game.npcs.some((n) => !n.dead && n.threat === p && (n.state === 'fight' || n.state === 'alert') && n.distTo(p) < 20);
    if (guards) return 'fight_guards';
    const beasts = game.creatures.some((c) => !c.dead && c.hostileNow && c.target === p && c.distTo(p) < 12);
    if (beasts || (game.combatT || 0) > 0) {
      if (game.combatWith === 'guard') return 'fight_guards';
      // (Below ground: a master's hall, or the place's own fight music.)
      if (game.dungeon) {
        const ty = game.dungeon.rec.type;
        if (game.dungeon.fight || game.creatures.some((c) => !c.dead && c.isBoss && c.target === p && c.distTo(p) < 18)) return `dungeon_${ty}_boss:p${fightPhase(game.dungeon.fight)}`;
        return `dungeon_${ty}_fight`;
      }
      return 'fight_monsters';
    }
  }
  // Near a Kavorent spire (not one whose ruin is beaten).
  if (!game.dungeon && game.nearSpire) {
    const s = game.nearSpire;
    const rec = game.sim.dungeons.get?.(s.id);
    if (Math.hypot(s.x - p.x, s.z - p.z) < 20 && !(rec && rec.cleared)) return rec && rec.spire && rec.spire.open !== null && rec.spire.open !== undefined ? 'spire_open' : 'spire';
  }
  // Down below (no nights there): its master's fight, once begun, even
  // between blows.
  if (game.dungeon) return game.dungeon.fight ? `dungeon_${game.dungeon.rec.type}_boss:p${fightPhase(game.dungeon.fight)}` : `dungeon_${game.dungeon.rec.type}`;
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

// A master's fight's phase, from a theme's variant ('p1' to 'p3'; 0 for
// any other).
export function bossLevel(variant) {
  const m = /^p([1-3])$/.exec(variant || '');
  return m ? +m[1] : 0;
}

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
    // A master's fight, and how far into it (its phase: see bossLevel).
    this.level = bossLevel(variant) || 1;
    this.lv = this.level;
    this.base = this.T.density;
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
    return 60 / (this.T.bpm * (1 + 0.09 * (this.lv - 1))) / 4;
  }

  // The fight's moved into a new phase: the same tune, climbing to it over
  // a few bars (quicker, busier, more of it playing), with a swell and a
  // roll of the timpani into it.
  retune(key) {
    this.key = key;
    const n = bossLevel(key.split(':')[1]) || 1;
    if (n === this.level) return;
    const up = n > this.level;
    this.level = n;
    if (up && this.m.ctx) {
      const t = this.next;
      const sd = this.stepDur;
      this.riser(t, sd * 16);
      for (let i = 0; i < 8; i++) this.timp(midi(this.T.root - 12), t + sd * 8 + i * sd, 0.1 + i * 0.05);
    }
    this.phrases = [this.phrase(), this.phrase()];
  }

  // A two-bar melody: rhythm and scale steps, leaning on chord tones.
  phrase() {
    const T = this.T;
    const r = this.rand;
    const out = [];
    let deg = Math.floor(r() * 3) * 2;
    const dens = Math.min(0.95, (this.base ?? T.density) + 0.11 * ((this.level || 1) - 1));
    for (let s = 0; s < 2 * (T.meter || 16); s++) {
      const strong = s % 4 === 0;
      const p = strong ? dens + 0.2 : s % 2 === 0 ? dens * 0.7 : dens * 0.3;
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

  // A struck bell: the note, and the bright partials over it dying first.
  bell(freq, t, dur, vol) {
    this.tone(freq, t, dur * 2.2, 'sine', vol);
    this.tone(freq * 2.76, t, dur * 0.9, 'sine', vol * 0.28);
    this.tone(freq * 5.4, t, dur * 0.4, 'sine', vol * 0.1);
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

  // A long note that breathes in and out: through a filter, slow to come
  // (a drone, a choir).
  swell(freq, t, dur, type, vol, cutoff = 1200, attack = 0.3, detune = 0) {
    const c = this.m.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime((this.rand() - 0.5) * detune * 2, t);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * attack);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // A brass stab: a chord, bright and short.
  stab(freqs, t, dur, vol) {
    const c = this.m.ctx;
    for (const fq of freqs) {
      const o = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fq, t);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2200, t);
      f.frequency.exponentialRampToValueAtTime(500, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  // A timpani: a deep skin struck, its pitch sagging as it rings.
  timp(freq, t, vol = 0.4) {
    const c = this.m.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.75);
    this.hit(t, 160, 0.12, vol * 0.5);
  }

  // A swell of noise rising into a new phase.
  riser(t, dur) {
    const c = this.m.ctx;
    const s = c.createBufferSource();
    s.buffer = this.m.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    s.connect(f).connect(g).connect(this.out);
    s.start(t);
    s.stop(t + dur + 0.15);
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
    // (A master's: heavy and slow to begin, then driving, then savage, as
    // the fight climbs.)
    const d = this.T.grand ? (this.lv < 1.6 ? 'grand' : this.lv < 2.5 ? 'battle' : 'fury') : this.T.drums;
    const b = s % (this.T.meter || 16);
    if (!d) return;
    if (d === 'waltz') {
      // (One, two, three: the low drum, then two light brushes.)
      if (b === 0) this.kick(t, 0.3);
      if (b === 4 || b === 8) this.hit(t, 6000, 0.05, 0.05);
      if (b === 10 && s % 24 === 22) this.hit(t, 2600, 0.04, 0.03);
      return;
    }
    if (d === 'grand') {
      if (b === 0) this.kick(t, 0.65);
      if (b === 6 || b === 10) this.kick(t, 0.32);
      if (b === 8) {
        this.hit(t, 900, 0.28, 0.24);
        this.hit(t, 200, 0.3, 0.2);
      }
      if (b % 4 === 2) this.hit(t, 8000, 0.03, 0.04);
      return;
    }
    if (d === 'fury') {
      if ([0, 3, 6, 8, 11, 14].includes(b)) this.kick(t, b % 8 === 0 ? 0.6 : 0.42);
      if (b === 4 || b === 12) this.hit(t, 1500, 0.14, 0.24);
      this.hit(t, 9500, 0.02, b % 2 ? 0.05 : 0.09);
      return;
    }
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
    // (Steps to the bar: sixteen, or twelve for three to the bar.)
    const M = T.meter || 16;
    const bar = Math.floor(s / M);
    const b = s % M;
    const chord = T.prog[bar % T.prog.length];
    const sd = this.stepDur;
    // Bass.
    const drive = T.drive || (T.grand && this.lv >= 1.6);
    // (Eased toward the fight's phase, a little each step.)
    if (this.lv !== this.level) this.lv += Math.sign(this.level - this.lv) * Math.min(Math.abs(this.level - this.lv), sd * 0.3);
    if (M === 12) {
      // (Three to the bar: the root, then the chord twice, oom-pah-pah.)
      if (b === 0) this.tone(midi(this.note(chord, -2)), t, sd * 3.5, 'triangle', 0.22);
      if (b === 4 || b === 8) for (const k of [2, 4]) this.tone(midi(this.note(chord + k, -1)), t, sd * 1.5, 'triangle', 0.05);
    } else if (drive ? b % 2 === 0 : b === 0 || b === 8 || (T.bpm > 100 && b === 12)) {
      this.tone(midi(this.note(chord, -2)), t, sd * (drive ? 1.8 : 3.5), 'triangle', 0.22);
      if (T.fifths && b === 0) this.tone(midi(this.note(chord + 4, -2)), t, sd * 7, 'triangle', 0.12);
    }
    // Pad (or organ) chord, once a bar.
    if (T.pad && b === 0) {
      for (const k of [0, 2, 4]) this.tone(midi(this.note(chord + k, -1)), t, sd * (M - 1), T.organ ? 'triangle' : 'sine', T.organ ? 0.07 : 0.05, T.detune || 0);
    }
    // Brass on the bar (and an answer late in every other).
    if (T.stabs && (b === 0 || (b === 10 && bar % 2 === 1))) this.stab([0, 2, 4].map((k) => midi(this.note(chord + k, -1))), t, sd * (b === 0 ? 2.5 : 1.4), b === 0 ? 0.035 : 0.025);
    // Arpeggio.
    if (T.arp && b % 2 === 0) {
      const k = [0, 2, 4, 2][(b / 2) % 4];
      this.tone(midi(this.note(chord + k, 0)), t, sd * 1.6, 'square', 0.03);
    }
    // Melody: phrases A A B A over eight bars.
    const which = [0, 0, 1, 0][Math.floor(bar / 2) % 4];
    const ph = this.phrases[which];
    const ps = s % (2 * M);
    for (const n of ph) {
      if (n.s !== ps) continue;
      const sw = T.swing && ps % 2 === 1 ? sd * T.swing : 0;
      const dg = n.deg + chord * (this.rand() < 0.3 ? 1 : 0);
      const nt = this.note(dg, 1);
      if (T.bell) this.bell(midi(nt), t + sw, sd * n.len, 0.075);
      else this.tone(midi(nt), t + sw, sd * n.len * 0.95, T.lead, T.lead === 'square' ? 0.06 : 0.1, T.detune || 0);
      // (Sung in parts: a third under it on the beats.)
      if (T.harmony && ps % 4 === 0) this.tone(midi(this.note(dg - 2, 1)), t + sw, sd * n.len * 0.9, 'triangle', 0.045);
      // (Desperate: the tune doubled an octave up, shrill over it all.)
      if (T.grand && this.lv >= 2.5) this.tone(midi(nt + 12), t + sw, sd * n.len * 0.8, 'square', 0.025);
    }
    // A master's: grand and dark.
    if (T.grand) this.grandLayers(s, t, bar, b, chord, sd);
    // A slow bell in the graveyard.
    if (T.toll && s % (2 * M) === 0) {
      for (const [m, v] of [[1, 0.12], [2.76, 0.05], [5.4, 0.02]]) this.tone(midi(this.T.root - 12) * m, t, 3.5, 'sine', v);
    }
    // (By night, a faint shimmer high over it every other bar.)
    if (T.night && b === 0 && bar % 2 === 1) this.tone(midi(this.note(chord + 4, 2)), t + sd * 2, sd * 10, 'sine', 0.025);
    this.drums(s, t);
    // New tunes every so often, so a long walk isn't one loop.
    if (s % (8 * M) === 8 * M - 1) this.phrases = [this.phrase(), this.rand() < 0.5 ? this.phrases[1] : this.phrase()];
  }

  // Under a master's fight: a low drone, a choir breathing in each bar,
  // brass stabs (more of them as it climbs), timpani on the bar and rolling
  // into every fourth, and a deep bell with a tritone in it now and then.
  grandLayers(s, t, bar, b, chord, sd) {
    const T = this.T;
    const lv = this.lv;
    if (b === 0 && bar % 2 === 0) {
      this.swell(midi(T.root - 24), t, sd * 32, 'sawtooth', 0.07, 240, 0.35);
      this.swell(midi(T.root - 17), t, sd * 32, 'sawtooth', 0.035, 240, 0.35);
    }
    if (T.choir && b === 0) for (const k of [0, 2, 4, 7]) this.swell(midi(this.note(chord + k, -1)), t, sd * 16, 'triangle', 0.03 + 0.012 * (lv - 1), 1500, 0.3, 14);
    if (T.brass || lv >= 1.6) {
      const at = b === 0 || (lv >= 1.6 && b === 10) || (lv >= 2.5 && (b === 6 || b === 14));
      if (at) this.stab([0, 2, 4].map((k) => midi(this.note(chord + k, -1))), t, sd * (b === 0 ? 3 : 1.6), b === 0 ? 0.05 : 0.035);
    }
    if (b === 0) this.timp(midi(T.root - 12 + (bar % 2 ? 7 : 0)), t, 0.42);
    if (bar % 4 === 3 && b >= 12) this.timp(midi(T.root - 12), t, 0.12 + (b - 12) * 0.07);
    if (s % 64 === 0) for (const [m, v] of [[1, 0.1], [1.414, 0.05], [2.76, 0.03], [5.4, 0.012]]) this.tone(midi(T.root - 12) * m, t, 4.5, 'sine', v);
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

  // On the title: its songs one after another (see TITLE_SONGS), from a
  // random one, each a few minutes (counted only while it's heard).
  titleSong(dt) {
    const c = this.ctx;
    if (!this.title) this.title = { i: Math.floor(Math.random() * TITLE_SONGS.length), t: 0 };
    const T = this.title;
    if (c && c.state === 'running' && this.voice && this.voice.key === TITLE_SONGS[T.i][0]) T.t += dt;
    if (T.t >= TITLE_SONG_LEN) {
      T.i = (T.i + 1 + Math.floor(Math.random() * (TITLE_SONGS.length - 1))) % TITLE_SONGS.length;
      T.t = 0;
    }
    return TITLE_SONGS[T.i][0];
  }

  // What's playing on the title (its name), or null.
  nowPlaying() {
    if (!this.voice || !this.title) return null;
    const s = TITLE_SONGS.find(([k]) => k === this.voice.key);
    return s ? s[1] : null;
  }

  // Called every frame with the mood the game is in; switches themes once
  // a new mood has held for a moment (fights switch at once).
  update(dt, mood) {
    if (!this.setup()) return;
    if (mood === 'title') mood = this.titleSong(dt);
    else this.title = null;
    if (!this.voice) {
      this.voice = new Voice(this, mood);
      return;
    }
    if (mood === this.voice.key) {
      this.want = null;
      return;
    }
    // (A master's fight into a new phase: the same tune, climbing.)
    if (mood.split(':')[0] === this.voice.key.split(':')[0] && bossLevel(mood.split(':')[1]) && bossLevel(this.voice.key.split(':')[1])) {
      this.voice.retune(mood);
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
