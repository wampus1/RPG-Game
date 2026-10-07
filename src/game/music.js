// Adaptive music in the old synthesizer records' way, made up as it plays.
// Each place has a theme: a key, a mode, a tempo, its chords (and the
// chords of its middle part), its instruments (see synth.js: a pan flute
// over an electric piano in a village, a saw lead and a pumping bass in a
// fight, an organ and a choir in a crypt), its drum machine's pattern (see
// compose.js's KITS) and the room it's played in (a hall, a cave, a
// cathedral). A theme writes its own tune (see compose.js): a motif, the
// motif answered, a contrasting middle; and plays it in a form, parts
// coming and going (an intro, the tune, the tune again with more around
// it, the middle, a breath), so it sounds like a piece rather than a loop.
// When you move somewhere else (into a town, a ruin, a graveyard, another
// biome, or a fight) the old theme fades out as the new one fades in.
// Towns sound like their people, and like how they're doing; nights are
// slower, dimmer and dreamier.
import { mulberry32 } from '../util/rng.js';
import { townMusic } from '../sim/prosperity.js';
import { fightPhase } from '../entities/tempo.js';
import { SCALES, chordDegs, degMidi, motif, line, counterLine, bassBar, ARPS, KITS, HIT } from './compose.js';
import { Rack, Samples, master, makeIR, midiHz } from './synth.js';
import { BIOMES } from '../world/biomes.js';
import { MAP_W, REGION_W, REGION_D } from '../config.js';
import { MODS } from '../mod/state.js';
import { SongPlayer } from '../mod/song.js';
import { clipBuffer } from '../mod/sound.js';

// What every theme starts from, by the kind of music it is: out in the
// country (unhurried, the drums coming in late), in a town (a groove), in a
// fight (driving), down below (dark and slow, in a cave), in a master's
// hall (grand, climbing with the fight).
const CALM = { form: 'calm', energy: 0.42, mood: 'calm', space: 'hall', wet: 0.32, echo: 0.16, tone: 5200, shape: 'seventh', bassStyle: 'root', keysStyle: 'broken', arpStyle: 'up', arpRate: 2 };
const GROOVE = { form: 'groove', energy: 0.6, mood: 'bright', space: 'room', wet: 0.24, echo: 0.12, tone: 7200, shape: 'seventh', bassStyle: 'walk', keysStyle: 'comp', arpStyle: 'updown', arpRate: 2 };
// (Round 49: a fight's darker than it was. Its tune's slower than the
// drive under it (`leadEnergy`: fewer, longer notes, few leaps), low and
// in a dark mode, over an ostinato; nothing bright twinkling over it.)
const DRIVE = { form: 'drive', energy: 0.86, leadEnergy: 0.55, mood: 'dark', space: 'room', wet: 0.22, echo: 0.08, tone: 6400, shape: 'triad', bassStyle: 'pulse', keysStyle: 'pulse', arpStyle: 'broken', arpRate: 1, pump: true };
const DEEP = { form: 'calm', energy: 0.24, mood: 'dark', space: 'cave', wet: 0.5, echo: 0.22, tone: 3000, shape: 'triad', bassStyle: 'drone', keysStyle: 'swell', arpStyle: 'wide', arpRate: 4 };
const BOSS = { form: 'boss', energy: 0.7, leadEnergy: 0.5, mood: 'dark', space: 'cathedral', wet: 0.28, echo: 0.08, tone: 5000, shape: 'triad', bassStyle: 'root', keysStyle: 'block', arpStyle: 'broken', arpRate: 1, grand: true, stab: 'braam' };

// Each theme: root (a MIDI note), scale, bpm, prog (a chord root a bar, as
// scale degrees) and progB (the middle's); lead, counter, pad, keys, arp,
// bass (instruments: see synth.js's PATCH) and how the keys, arp and bass
// play; kit (the drums); the room (`space`, how `wet`, how much `echo`,
// how bright: `tone`); and touches of its own: a tolling bell (`toll`), a
// low drone, a fog of a pad drifting out of tune, wind, the sea, a far
// hammer, a shimmer of bells by night.
export const THEMES = {
  // --- the title's songs (see TITLE_SONGS) ----------------------------------
  // The long road: a pan flute over an electric piano, a plucked arp
  // echoing away.
  title: { ...CALM, root: 57, scale: 'dorian', bpm: 78, prog: [0, 5, 3, 4], progB: [3, 6, 0, 4], lead: 'flute', counter: 'strings', pad: 'pad', keys: 'ep', arp: 'pluck', arpStyle: 'updown', bass: 'sub', kit: 'soft', echo: 0.26, energy: 0.45 },
  // A bright morning on bells, the kalimba ringing under them.
  title_dawn: { ...CALM, root: 60, scale: 'lydian', bpm: 84, prog: [0, 4, 5, 3], progB: [1, 4, 5, 1], lead: 'bell', pad: 'glass', keys: 'ep', arp: 'kalimba', arpStyle: 'wide', bass: 'sub', echo: 0.3, tone: 6400, energy: 0.4 },
  // A waltz by the fire, three to the bar: a squeezebox, the piano's
  // oom-pah-pah.
  title_hearth: { ...GROOVE, root: 62, scale: 'major', bpm: 128, meter: 12, shape: 'triad', prog: [0, 3, 4, 0, 5, 3, 4, 4], progB: [3, 0, 4, 0], lead: 'squeeze', counter: 'flute', keys: 'ep', keysStyle: 'oompah', bass: 'sub', bassStyle: 'waltz', kit: 'waltz', space: 'room', energy: 0.5 },
  // A slow ballad of the barrows, sung in parts over strings and a harp.
  title_ballad: { ...CALM, root: 55, scale: 'harmonic', bpm: 64, shape: 'triad', prog: [0, 5, 3, 4, 0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'flute', counter: 'choir', pad: 'strings', keys: 'harp', bass: 'sub', wet: 0.4, energy: 0.34 },
  // A march under the banner: brass, a snare rolling.
  title_banner: { ...GROOVE, root: 58, scale: 'mixo', bpm: 100, shape: 'triad', prog: [0, 6, 3, 4], progB: [3, 0, 6, 4], lead: 'brass', counter: 'horn', pad: 'strings', bass: 'moog', bassStyle: 'fifths', kit: 'march', space: 'hall', energy: 0.6 },
  // A shanty for far shores: a tin whistle, the squeezebox under it,
  // hand drums, the sea.
  title_shore: { ...GROOVE, root: 62, scale: 'dorian', bpm: 104, swing: 0.24, shape: 'triad', prog: [0, 6, 0, 4], progB: [3, 6, 2, 4], lead: 'flute', counter: 'squeeze', keys: 'squeeze', keysStyle: 'stab', bass: 'pluckbass', bassStyle: 'bounce', kit: 'hand', sea: true, energy: 0.58 },
  // The dark below: a bell, a choir, a heartbeat, a cave's long ring.
  title_deep: { ...DEEP, root: 50, scale: 'phrygian', bpm: 58, prog: [0, 1, 5, 0], progB: [6, 5, 1, 0], lead: 'bell', pad: 'choir', bass: 'sub', kit: 'heart', toll: true, drone: true, energy: 0.26 },
  // The Kavorent's glass and starlight, three to the bar.
  title_spire: { ...CALM, root: 54, scale: 'whole', bpm: 70, meter: 12, shape: 'triad', prog: [0, 2, 4, 1], progB: [1, 3, 2, 0], lead: 'glass', pad: 'glass', arp: 'bell', arpStyle: 'wide', arpRate: 2, bass: 'sub', bassStyle: 'drone', space: 'cathedral', echo: 0.4, detune: 16, mood: 'eerie', energy: 0.3 },

  // --- the Workshop's (round 64: see WORKSHOP_SONGS) ---------------------
  // Slow and soft, to work by: no drums but the faintest, the new
  // instruments (a felt piano, a vibraphone, a handpan, singing bowls, a
  // breath of a pad), wide rooms and long echoes.
  // A felt piano over a breath, in the lydian's light.
  ws_studio: { ...CALM, root: 60, scale: 'lydian', bpm: 66, shape: 'add9', prog: [0, 4, 5, 3], progB: [1, 4, 0, 5], lead: 'felt', pad: 'breath', keys: 'felt', keysStyle: 'broken', bass: 'sub', bassStyle: 'drone', wet: 0.42, echo: 0.3, tone: 4800, energy: 0.26 },
  // A vibraphone over glass, singing bowls struck far apart.
  ws_glass: { ...CALM, root: 57, scale: 'penta', bpm: 60, prog: [0, 3, 1, 4], progB: [3, 2, 0, 4], lead: 'vibes', pad: 'glass', arp: 'bowl', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', space: 'cathedral', wet: 0.45, echo: 0.34, energy: 0.22 },
  // A handpan rolling on a breeze, a soft step under it.
  ws_drift: { ...CALM, root: 62, scale: 'dorian', bpm: 72, prog: [0, 6, 3, 4], progB: [3, 4, 0, 6], lead: 'handpan', pad: 'breath', arp: 'handpan', arpStyle: 'updown', arpRate: 2, bass: 'sub', kit: 'soft', energy: 0.3 },
  // A lantern on the bench: a vibraphone, the felt piano under it, warm.
  ws_lantern: { ...CALM, root: 65, scale: 'major', bpm: 62, prog: [0, 5, 3, 4], progB: [5, 3, 1, 4], lead: 'vibes', pad: 'warm', keys: 'felt', keysStyle: 'broken', bass: 'sub', echo: 0.28, energy: 0.24 },
  // The tide out: bowls and a breath, the vibraphone swelling, the sea.
  ws_tide: { ...CALM, root: 55, scale: 'mixo', bpm: 56, shape: 'sus2', prog: [0, 6, 0, 4], progB: [3, 6, 2, 0], lead: 'bowl', pad: 'breath', keys: 'vibes', keysStyle: 'swell', bass: 'sub', bassStyle: 'drone', sea: true, wet: 0.5, echo: 0.3, energy: 0.2 },
  // Late at the bench: the felt piano low, a cello under it.
  ws_dusk: { ...CALM, root: 52, scale: 'minor', bpm: 58, prog: [0, 5, 3, 6], progB: [3, 0, 5, 4], lead: 'felt', counter: 'cello', pad: 'warm', keys: 'vibes', keysStyle: 'broken', bass: 'sub', wet: 0.38, mood: 'dark', energy: 0.24 },

  // --- Thessa, out in the country ---------------------------------------
  // Open grassland: a pan flute over a warm pad and an electric piano.
  plains: { ...CALM, root: 60, scale: 'major', bpm: 92, prog: [0, 3, 5, 4], progB: [5, 3, 0, 4], lead: 'flute', pad: 'warm', keys: 'ep', bass: 'sub', kit: 'soft', energy: 0.46 },
  // The woods: a flute and a kalimba twinkling under the trees.
  forest: { ...CALM, root: 57, scale: 'dorian', bpm: 84, prog: [0, 6, 3, 4], progB: [2, 3, 0, 6], lead: 'flute', pad: 'pad', arp: 'kalimba', arpStyle: 'updown', bass: 'sub', kit: 'soft', energy: 0.42 },
  // Pines in the snow: bells and glass, no drums.
  taiga: { ...CALM, root: 55, scale: 'minor', bpm: 68, shape: 'add9', prog: [0, 5, 3, 6], progB: [5, 6, 0, 4], lead: 'bell', pad: 'glass', keys: 'harp', bass: 'sub', wet: 0.42, echo: 0.28, tone: 4600, energy: 0.3 },
  // The frozen waste: a few bells, the wind.
  tundra: { ...CALM, root: 53, scale: 'minpenta', bpm: 60, shape: 'triad', prog: [0, 3, 2, 0], progB: [2, 4, 3, 1], lead: 'bell', pad: 'glass', bass: 'sub', bassStyle: 'drone', wind: true, wet: 0.5, echo: 0.3, tone: 4200, energy: 0.22, mood: 'dark' },
  // Sand: a koto in the old desert mode, hand drums, finger cymbals.
  desert: { ...CALM, root: 62, scale: 'hijaz', bpm: 80, shape: 'triad', prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'koto', pad: 'warm', bass: 'sub', kit: 'hand', drone: true, echo: 0.26, energy: 0.5 },
  // Long grass and far trees: a marimba, a flute answering, hand drums.
  savanna: { ...CALM, root: 58, scale: 'mixo', bpm: 96, prog: [0, 6, 3, 0], progB: [5, 3, 6, 0], lead: 'marimba', counter: 'flute', pad: 'warm', bass: 'pluckbass', bassStyle: 'bounce', kit: 'hand', energy: 0.55, mood: 'bright' },
  // The jungle: a kalimba lead, marimbas, toms and wood.
  jungle: { ...GROOVE, root: 64, scale: 'lydian', bpm: 104, prog: [0, 1, 0, 4], progB: [5, 2, 1, 4], lead: 'kalimba', pad: 'pad', keys: 'marimba', keysStyle: 'stab', arp: 'marimba', arpStyle: 'broken', bass: 'pluckbass', bassStyle: 'offbeat', kit: 'tribal', space: 'hall', energy: 0.6 },
  // The swamp: a reed out of tune, water dripping, a heartbeat.
  swamp: { ...CALM, root: 53, scale: 'phrygian', bpm: 66, shape: 'triad', prog: [0, 1, 5, 1], progB: [6, 5, 1, 0], lead: 'reed', pad: 'warm', bass: 'sub', bassStyle: 'drone', kit: 'drip', detune: 14, wet: 0.42, energy: 0.28, mood: 'eerie' },
  // High ground: a horn calling over strings, a great drum far off, wind.
  mountain: { ...CALM, root: 50, scale: 'dorian', bpm: 72, shape: 'sus2', prog: [0, 6, 4, 0], progB: [3, 2, 6, 4], lead: 'horn', counter: 'strings', pad: 'strings', bass: 'sub', bassStyle: 'fifths', kit: 'peak', wind: true, wet: 0.42, energy: 0.38 },
  // The shore: an electric piano, a flute, a lazy swing, the waves.
  beach: { ...CALM, root: 65, scale: 'mixo', bpm: 90, swing: 0.18, prog: [0, 3, 6, 3], progB: [5, 4, 3, 6], lead: 'flute', pad: 'warm', keys: 'ep', keysStyle: 'comp', bass: 'sub', bassStyle: 'offbeat', kit: 'light', sea: true, energy: 0.5, mood: 'bright' },
  // Out at sea: glass and bells and their echoes, the swell.
  ocean: { ...CALM, root: 62, scale: 'penta', bpm: 70, shape: 'triad', prog: [0, 4, 3, 4], progB: [3, 2, 0, 1], lead: 'bell', pad: 'glass', arp: 'ep', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', sea: true, wet: 0.45, echo: 0.36, energy: 0.3 },

  // --- Thessa's towns ------------------------------------------------------
  // A village: a pan flute over an electric piano, a light step.
  village: { ...GROOVE, root: 60, scale: 'major', bpm: 100, swing: 0.1, prog: [0, 4, 5, 3], progB: [3, 4, 2, 5], lead: 'flute', pad: 'warm', keys: 'ep', keysStyle: 'broken', bass: 'sub', bassStyle: 'root', kit: 'light', energy: 0.52, tone: 6400 },
  // A town: a plucked lead and a flute answering, the piano comping, a
  // walking bass, the drum machine proper.
  town: { ...GROOVE, root: 62, scale: 'major', bpm: 108, prog: [0, 5, 3, 4], progB: [1, 4, 0, 5], lead: 'pluck', counter: 'flute', pad: 'pad', keys: 'ep', bass: 'moog', bassStyle: 'walk', kit: 'groove', energy: 0.64 },
  // A city: a saw lead, strings, brass, an FM bass slapping, the hats in
  // sixteenths.
  city: { ...GROOVE, root: 65, scale: 'mixo', bpm: 114, prog: [0, 3, 4, 5, 0, 3, 6, 4], progB: [5, 3, 6, 4], lead: 'lead', counter: 'brass', pad: 'strings', keys: 'ep', arp: 'pluck', bass: 'fmbass', bassStyle: 'bounce', kit: 'city', energy: 0.72 },
  // A tavern: a squeezebox, the piano, a bouncing bass and a shuffle.
  tavern: { ...GROOVE, root: 60, scale: 'mixo', bpm: 124, swing: 0.24, shape: 'six', prog: [0, 3, 0, 4], progB: [6, 3, 0, 4], lead: 'squeeze', counter: 'flute', keys: 'ep', keysStyle: 'stab', bass: 'moog', bassStyle: 'bounce', kit: 'shanty', energy: 0.76 },
  // An empty town: a music box out of tune, its echo going on too long.
  ruins: { ...DEEP, root: 57, scale: 'minor', bpm: 58, prog: [0, 5, 1, 4], progB: [3, 0, 5, 6], lead: 'kalimba', pad: 'warm', bass: 'sub', space: 'hall', echo: 0.38, detune: 16, energy: 0.2 },
  // A graveyard: an organ, a choir singing low, a bell tolling.
  graveyard: { ...DEEP, root: 52, scale: 'harmonic', bpm: 52, prog: [0, 5, 3, 4], progB: [3, 0, 1, 4], lead: 'choir', pad: 'organ', bass: 'sub', toll: true, space: 'cathedral', tone: 3600, energy: 0.2 },

  // --- fights -----------------------------------------------------------
  // (Round 49: each its own instruments, and none of them playful.)
  // Beasts: the hunt. A war horn calling low over war drums and stamping
  // feet, the low strings chugging; no snare, nothing bright.
  fight_beasts: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 132, shape: 'power', prog: [0, 0, 6, 5], progB: [3, 1, 0, 6], lead: 'warhorn', pad: 'strings', keys: 'cello', keysStyle: 'chug', bass: 'sub', bassStyle: 'pulse', kit: 'hunt', space: 'hall', energy: 0.84 },
  // Things of the night: strings shrieking over a breathing, beating bass,
  // monks chanting under it, chains for hats, the low strings racing.
  fight_monsters: { ...DRIVE, root: 51, scale: 'harmonic', bpm: 140, prog: [0, 1, 0, 4], progB: [5, 1, 3, 4], lead: 'screech', counter: 'chant', pad: 'choir', arp: 'cello', arpRate: 1, bass: 'reese', kit: 'night', space: 'hall', wet: 0.3, detune: 8, energy: 0.9 },
  // The watch: a war march. Brass walls struck on the beat, the low
  // strings galloping, timpani and the low snare rolling.
  fight_guards: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 124, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'brass', counter: 'cello', pad: 'strings', keys: 'braam', keysStyle: 'block', arp: 'cello', arpStyle: 'down', arpRate: 1, bass: 'moog', bassStyle: 'gallop', kit: 'warmarch', space: 'hall', energy: 0.82 },
  // Bandits: an outlaw's baritone guitar twanging and trembling over
  // stamping boots and slow claps, a long echo, in the desert mode.
  fight_bandits: { ...DRIVE, root: 52, scale: 'hijaz', bpm: 128, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'twang', counter: 'chant', pad: 'strings', bass: 'pluckbass', bassStyle: 'gallop', kit: 'outlaw', drone: true, echo: 0.26, space: 'hall', energy: 0.8 },
  fight_boss: { ...BOSS, root: 45, scale: 'harmonic', bpm: 116, prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'chant', counter: 'strings', pad: 'choir', keys: 'organ', arp: 'cello', bass: 'moog', toll: true },

  // --- below ground ---------------------------------------------------------
  // Each kind of place its own dread. A barrow's tolling bell and
  // heartbeat; a mine's drips and far hammer; a crypt's organ in a
  // cathedral's ring; a bandits' den with its hand drums; and the
  // Kavorent's halls in a scale no living people use, glittering and wrong.
  dungeon_barrow: { ...DEEP, root: 50, scale: 'phrygian', bpm: 54, prog: [0, 1, 5, 0], progB: [6, 5, 1, 0], lead: 'choir', pad: 'warm', bass: 'sub', kit: 'heart', toll: true, drone: true, detune: 10 },
  dungeon_mine: { ...DEEP, root: 48, scale: 'minor', bpm: 62, prog: [0, 6, 5, 6], progB: [3, 5, 6, 0], lead: 'bell', pad: 'pad', bass: 'sub', bassStyle: 'fifths', kit: 'deep', drone: true, hammer: true, drip: true, energy: 0.26 },
  dungeon_crypt: { ...DEEP, root: 52, scale: 'harmonic', bpm: 50, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'choir', pad: 'organ', bass: 'sub', space: 'cathedral', toll: true, detune: 6, energy: 0.18 },
  dungeon_holdout: { ...CALM, root: 55, scale: 'dorian', bpm: 84, shape: 'triad', prog: [0, 6, 0, 4], progB: [3, 6, 5, 4], lead: 'pluck', pad: 'warm', bass: 'pluckbass', bassStyle: 'offbeat', kit: 'hand', space: 'room', swing: 0.12, tone: 3600, energy: 0.42, mood: 'tense' },
  dungeon_kavorent: { ...DEEP, root: 54, scale: 'whole', bpm: 66, prog: [0, 2, 4, 1], progB: [1, 3, 2, 0], lead: 'glass', pad: 'glass', arp: 'bell', arpRate: 3, bass: 'sub', space: 'cathedral', echo: 0.36, detune: 22, tone: 4800, energy: 0.3, mood: 'eerie' },
  // ...each its own fight: the same dread, driven, with its own voice.
  // A barrow's: the dead's dirge (low strings singing, monks under them,
  // the bell); a mine's: a distorted guitar grinding over the hammers; a
  // crypt's: an organ's toccata, strings shrieking over it; the den's: the
  // outlaws' guitar; the Kavorent's: a broken machine's voice.
  dungeon_barrow_fight: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 128, prog: [0, 1, 5, 0], progB: [6, 5, 1, 0], lead: 'cello', counter: 'chant', pad: 'choir', arp: 'cello', arpStyle: 'down', bass: 'sub', kit: 'dirge', toll: true, space: 'cave', wet: 0.3 },
  dungeon_mine_fight: { ...DRIVE, root: 47, scale: 'minor', bpm: 138, shape: 'power', prog: [0, 6, 5, 6], progB: [3, 4, 5, 6], lead: 'dist', pad: 'strings', keys: 'dist', keysStyle: 'chug', bass: 'moog', bassStyle: 'gallop', kit: 'drive', hammer: true, space: 'cave', wet: 0.28 },
  dungeon_crypt_fight: { ...DRIVE, root: 52, scale: 'harmonic', bpm: 132, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'screech', counter: 'chant', pad: 'choir', keys: 'organ', keysStyle: 'pulse', bass: 'fmbass', kit: 'warmarch', space: 'cathedral', wet: 0.3 },
  dungeon_holdout_fight: { ...DRIVE, root: 53, scale: 'hijaz', bpm: 140, prog: [0, 1, 0, 6], progB: [3, 1, 6, 4], lead: 'twang', counter: 'brass', pad: 'strings', bass: 'pluckbass', bassStyle: 'gallop', kit: 'outlaw', echo: 0.22 },
  dungeon_kavorent_fight: { ...DRIVE, root: 54, scale: 'alien', bpm: 140, prog: [0, 1, 3, 2], progB: [2, 4, 1, 3], lead: 'crushed', pad: 'glass', arp: 'crushed', arpStyle: 'down', bass: 'reese', kit: 'machine', space: 'cathedral', wet: 0.26, detune: 10 },
  fight_kavorent: { ...DRIVE, root: 54, scale: 'alien', bpm: 140, prog: [0, 1, 3, 2], progB: [2, 4, 1, 3], lead: 'crushed', pad: 'glass', arp: 'crushed', arpStyle: 'down', bass: 'reese', kit: 'machine', space: 'cathedral', wet: 0.26, detune: 10 },
  // ...and each its master's: grand and dark (`grand`). A drone under it
  // all, a choir, walls of brass struck on the beat (`stab`), timpani, a
  // gong as each part opens, a deep bell with a tritone ringing in it; and
  // it climbs as the fight does, through the master's phases (see
  // bossLevel): half-time and heavy, then driving with the strings racing,
  // then savage, the strings shivering and the key lifted.
  dungeon_barrow_boss: { ...BOSS, root: 45, scale: 'phrygian', bpm: 112, prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'warhorn', counter: 'chant', pad: 'choir', arp: 'cello', bass: 'moog', toll: true },
  dungeon_mine_boss: { ...BOSS, root: 43, scale: 'harmonic', bpm: 118, shape: 'power', prog: [0, 6, 5, 4, 0, 6, 1, 4], progB: [5, 3, 1, 4], lead: 'dist', counter: 'brass', pad: 'strings', arp: 'dist', bass: 'moog', stab: 'dist', hammer: true, space: 'cave', wet: 0.24 },
  dungeon_crypt_boss: { ...BOSS, root: 45, scale: 'harmonic', bpm: 110, prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'organ', counter: 'chant', pad: 'choir', arp: 'screech', bass: 'fmbass', toll: true, detune: 8 },
  dungeon_holdout_boss: { ...BOSS, root: 46, scale: 'hijaz', bpm: 120, prog: [0, 1, 0, 6, 0, 1, 4, 6], progB: [5, 6, 1, 0], lead: 'twang', counter: 'brass', pad: 'strings', arp: 'twang', bass: 'moog', stab: 'brass', space: 'hall' },
  dungeon_kavorent_boss: { ...BOSS, root: 42, scale: 'alien', bpm: 112, prog: [0, 1, 3, 2, 0, 4, 3, 1], progB: [2, 4, 1, 3], lead: 'crushed', counter: 'choir', pad: 'glass', arp: 'crushed', bass: 'reese', stab: 'crushed', dbl: 'screech', detune: 14 },
  // Each island's own old place, with its own music (`own`: not made over
  // in the island's way, being its already): a Wildwood Hollow's pipes in
  // a creaking hush, a Kiln-Deep's anvils and the roar under them, a Tide
  // Grotto's steel drums slowed to a drip, the sea's swell under it. And
  // each its own fight, and its master's.
  dungeon_grove: { ...DEEP, own: true, root: 57, scale: 'dorian', bpm: 58, shape: 'sus2', prog: [0, 6, 3, 4], progB: [2, 3, 6, 0], lead: 'reed', pad: 'warm', arp: 'kalimba', arpRate: 4, bass: 'sub', space: 'hall', wind: true, detune: 8, tone: 3800 },
  // (A Wildwood's fight: a droning wooden pipe and the rite's drums; its
  // master's the same, a horn calling over the strings.)
  dungeon_grove_fight: { ...DRIVE, own: true, root: 52, scale: 'minor', bpm: 130, prog: [0, 6, 3, 4], progB: [2, 3, 6, 4], lead: 'reed', counter: 'horn', pad: 'strings', bass: 'didge', bassStyle: 'pulse', kit: 'rite', wind: true, space: 'hall' },
  dungeon_grove_boss: { ...BOSS, own: true, root: 45, scale: 'minor', bpm: 112, prog: [0, 6, 3, 4, 0, 6, 1, 4], progB: [2, 3, 6, 4], lead: 'horn', counter: 'reed', pad: 'choir', arp: 'cello', bass: 'didge', space: 'hall' },
  dungeon_forge: { ...DEEP, own: true, root: 48, scale: 'phrygian', bpm: 62, prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'buzz', pad: 'warm', bass: 'sub', kit: 'forge', drone: true, tone: 3400, energy: 0.28 },
  dungeon_forge_fight: { ...DRIVE, own: true, root: 48, scale: 'phrygian', bpm: 144, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'dist', counter: 'buzz', pad: 'strings', keys: 'dist', keysStyle: 'chug', bass: 'moog', kit: 'forge_battle', drone: true, space: 'cave', wet: 0.24 },
  dungeon_forge_boss: { ...BOSS, own: true, root: 41, scale: 'phrygian', bpm: 118, shape: 'power', prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'buzz', counter: 'dist', pad: 'choir', arp: 'dist', bass: 'moog', stab: 'dist', drone: true, toll: true, space: 'cave', wet: 0.24 },
  dungeon_grotto: { ...DEEP, own: true, root: 55, scale: 'minpenta', bpm: 60, swing: 0.1, prog: [0, 3, 4, 3], progB: [2, 4, 3, 1], lead: 'steel', pad: 'glass', bass: 'sub', kit: 'drip', fog: true, sea: true, tone: 3800 },
  // (A Tide Grotto's fight: a call from the deep over slow toms and the
  // dripping dark; its master's the same, the low strings under it.)
  dungeon_grotto_fight: { ...DRIVE, own: true, root: 53, scale: 'phrygian', bpm: 126, prog: [0, 6, 0, 1], progB: [3, 6, 5, 1], lead: 'abyss', counter: 'chant', pad: 'glass', arp: 'cello', arpStyle: 'down', arpRate: 2, bass: 'reese', kit: 'abyss', fog: true, sea: true, space: 'cave', wet: 0.3 },
  dungeon_grotto_boss: { ...BOSS, own: true, root: 46, scale: 'harmonic', bpm: 112, prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'abyss', counter: 'brass', pad: 'choir', arp: 'cello', bass: 'reese', fog: true, sea: true, space: 'cave', wet: 0.24 },

  // --- a Kavorent spire -------------------------------------------------------
  // Near it, a slow wrong music in a scale nobody uses; as one opens, it
  // gathers and swells; open, it rings.
  spire: { ...DEEP, root: 49, scale: 'alien', bpm: 48, prog: [0, 1, 5, 2], progB: [2, 4, 1, 0], lead: 'glass', pad: 'glass', arp: 'bell', arpRate: 4, bass: 'sub', space: 'cathedral', echo: 0.4, detune: 28, tone: 4400, energy: 0.16, mood: 'eerie' },
  spire_swell: { ...DRIVE, root: 49, scale: 'alien', bpm: 92, prog: [0, 1, 0, 1, 5, 2, 5, 3], progB: [2, 4, 1, 3], lead: 'lead', pad: 'choir', keys: 'organ', keysStyle: 'swell', arp: 'glass', arpRate: 2, bass: 'fmbass', kit: 'ritual', space: 'cathedral', wet: 0.36, detune: 18, energy: 0.62 },
  spire_open: { ...CALM, root: 54, scale: 'whole', bpm: 64, shape: 'triad', prog: [0, 2, 4, 1], progB: [1, 3, 2, 0], lead: 'choir', pad: 'organ', arp: 'bell', arpStyle: 'wide', bass: 'sub', bassStyle: 'drone', space: 'cathedral', echo: 0.34, detune: 22, energy: 0.34, mood: 'eerie' },

  // --- the stories --------------------------------------------------------
  // An old town's story, slow and warm; a shanty on deck; the storm; and
  // the cold after.
  history: { ...CALM, root: 60, scale: 'major', bpm: 74, prog: [0, 5, 3, 4], progB: [3, 0, 1, 4], lead: 'flute', counter: 'horn', pad: 'strings', keys: 'harp', bass: 'sub', energy: 0.42 },
  voyage: { ...GROOVE, root: 62, scale: 'dorian', bpm: 110, swing: 0.28, shape: 'triad', prog: [0, 3, 0, 4], progB: [6, 3, 0, 4], lead: 'squeeze', counter: 'flute', keys: 'squeeze', keysStyle: 'stab', bass: 'sub', bassStyle: 'bounce', kit: 'shanty', sea: true, energy: 0.62 },
  storm: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 140, prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'lead', pad: 'choir', arp: 'pluck', bass: 'moog', kit: 'battle', wind: true, sea: true, space: 'hall', wet: 0.3, detune: 10 },
  // Out on a raft: a sea-song, a flute over a squeezebox, a harp turning
  // under it, the waves.
  sailing: { ...GROOVE, root: 60, scale: 'mixo', bpm: 96, swing: 0.2, shape: 'triad', prog: [0, 3, 4, 0], progB: [5, 3, 1, 4], lead: 'flute', counter: 'squeeze', keys: 'harp', keysStyle: 'broken', bass: 'pluckbass', bassStyle: 'bounce', kit: 'shanty', sea: true, wind: true, energy: 0.5, mood: 'bright' },
  // Into the storm round the islands (see stormsea.js): ominous coming up
  // to it (p1), dread in the black (p2), terror in the red (p3); the same
  // tune climbing, as a master's fight does.
  tempest: { ...BOSS, root: 41, scale: 'phrygian', bpm: 86, prog: [0, 1, 0, 6, 0, 1, 5, 1], progB: [5, 6, 1, 0], lead: 'choir', counter: 'strings', pad: 'choir', arp: 'glass', bass: 'moog', toll: true, drone: true, wind: true, sea: true, space: 'cathedral', echo: 0.3, detune: 16, mood: 'eerie' },
  wreck: { ...DEEP, root: 45, scale: 'minor', bpm: 46, prog: [0, 5, 3, 4], progB: [3, 0, 5, 4], lead: 'ep', pad: 'warm', bass: 'sub', space: 'hall', echo: 0.36, sea: true, tone: 3600, energy: 0.14 },
  // Fallen: a lament, a choir over an organ in the dark; then the
  // Kavorent's rite that brings you back, strange and climbing.
  death: { ...DEEP, root: 45, scale: 'harmonic', bpm: 44, prog: [0, 5, 3, 4], progB: [3, 0, 1, 4], lead: 'choir', pad: 'organ', bass: 'sub', toll: true, space: 'cathedral', energy: 0.16 },
  ritual: { ...CALM, root: 50, scale: 'alien', bpm: 88, shape: 'triad', prog: [0, 2, 4, 1], progB: [1, 3, 2, 0], lead: 'choir', pad: 'organ', arp: 'glass', arpRate: 1, arpStyle: 'wide', bass: 'fmbass', bassStyle: 'pulse', kit: 'deep', space: 'cathedral', echo: 0.3, detune: 26, energy: 0.5, mood: 'eerie' },

  // --- the cutscenes' own (round 49) ------------------------------------------
  // Each scene its own music, heard nowhere else, its own instruments in it.
  // (`form: 'scene'`: straight into the tune, no intro to wait through.
  // `opener`: drums struck as it starts, on the scene's cue.)
  // A star falling: a celesta over a choir and glass, a music box turning,
  // three to the bar in a floating mode...
  cs_starfall: { ...CALM, form: 'scene', root: 56, scale: 'lydian', bpm: 66, meter: 12, shape: 'add9', prog: [0, 1, 5, 4], progB: [3, 1, 0, 1], lead: 'celesta', counter: 'choir', pad: 'glass', arp: 'musicbox', arpStyle: 'wide', arpRate: 2, bass: 'sub', bassStyle: 'drone', space: 'cathedral', wet: 0.45, echo: 0.36, shimmer: true, energy: 0.34 },
  // ...and where it strikes: the blow and a gong, then alone in the dark, a
  // music box and a choir, slow and low.
  cs_starfall_dark: { ...DEEP, form: 'scene', root: 52, scale: 'minor', bpm: 54, meter: 12, shape: 'add9', prog: [0, 5, 3, 4], progB: [5, 3, 0, 4], lead: 'musicbox', pad: 'choir', bass: 'sub', bassStyle: 'drone', space: 'cathedral', echo: 0.4, opener: ['impact', 'gong'], energy: 0.22, mood: 'calm' },
  // Home: a hammered dulcimer's tune, a horn answering it, a harp turning
  // under them: an old town's story, warm and fond and a little sad.
  cs_home: { ...CALM, form: 'scene', root: 62, scale: 'major', bpm: 80, meter: 12, shape: 'triad', prog: [0, 4, 5, 3, 0, 3, 4, 4], progB: [5, 3, 0, 4], lead: 'dulcimer', counter: 'horn', pad: 'warm', keys: 'harp', keysStyle: 'broken', bass: 'sub', bassStyle: 'root', kit: 'soft', energy: 0.42 },
  // The voyage: a fiddle's jig on deck, the squeezebox under it, stamping
  // and clapping, the sea...
  cs_voyage: { ...GROOVE, form: 'scene', root: 62, scale: 'dorian', bpm: 116, swing: 0.28, shape: 'triad', prog: [0, 6, 0, 4], progB: [3, 6, 0, 4], lead: 'fiddle', counter: 'squeeze', keys: 'squeeze', keysStyle: 'stab', bass: 'pluckbass', bassStyle: 'bounce', kit: 'shanty', sea: true, energy: 0.62, mood: 'bright' },
  // ...and the storm taking her: a choir wailing over walls of brass, the
  // low strings racing, a great drum and the thunder rolling in it.
  cs_gale: { ...DRIVE, form: 'scene', root: 49, scale: 'phrygian', bpm: 118, prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'choir', counter: 'cello', pad: 'strings', keys: 'braam', keysStyle: 'block', arp: 'cello', bass: 'moog', kit: 'gale', thunder: true, wind: true, sea: true, space: 'hall', wet: 0.32, opener: ['impact'] },
  // The mountain breaking open: a shawm crying over war drums and the
  // ground stamping, a guitar's power chords, the drone.
  cs_eruption: { ...DRIVE, form: 'scene', root: 46, scale: 'hijaz', bpm: 100, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'buzz', counter: 'warhorn', pad: 'choir', keys: 'dist', keysStyle: 'block', bass: 'moog', bassStyle: 'root', kit: 'quake', drone: true, opener: ['impact'], space: 'cave', wet: 0.3, energy: 0.78 },
  // The Wall coming down: a choir and an organ swelling in the dark, wind
  // and sea and the bell; then, broken, a hymn: brass and choir and bells
  // in a bright mode, the first in a hundred years.
  cs_wall: { ...CALM, form: 'scene', root: 49, scale: 'phrygian', bpm: 70, shape: 'sus2', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'choir', pad: 'strings', keys: 'organ', keysStyle: 'swell', bass: 'sub', bassStyle: 'drone', kit: 'heart', wind: true, sea: true, toll: true, space: 'cathedral', energy: 0.4, mood: 'dark' },
  cs_wall_free: { ...CALM, form: 'scene', root: 55, scale: 'lydian', bpm: 76, shape: 'triad', prog: [0, 4, 5, 3], progB: [3, 4, 1, 4], lead: 'brass', counter: 'choir', pad: 'strings', keys: 'organ', keysStyle: 'swell', arp: 'celesta', arpStyle: 'wide', bass: 'sub', bassStyle: 'fifths', kit: 'peak', opener: ['gong'], space: 'cathedral', energy: 0.55, mood: 'bright' },
  // A spire waking: a theremin gliding over an organ and a choir in the
  // Kavorent's scale, the rite's drums gathering.
  cs_spire: { ...DRIVE, form: 'scene', root: 49, scale: 'alien', bpm: 84, prog: [0, 1, 0, 1, 5, 2, 5, 3], progB: [2, 4, 1, 3], lead: 'theremin', pad: 'choir', keys: 'organ', keysStyle: 'swell', arp: 'glass', arpRate: 2, bass: 'reese', kit: 'ritual', space: 'cathedral', wet: 0.36, detune: 18, energy: 0.6, mood: 'eerie' },
  // A master brought down: a slow fanfare, brass over a choir and an organ,
  // the gong and the bell.
  cs_victory: { ...CALM, form: 'scene', root: 53, scale: 'mixo', bpm: 72, shape: 'triad', prog: [0, 6, 3, 4], progB: [5, 6, 3, 4], lead: 'brass', counter: 'choir', pad: 'strings', keys: 'organ', keysStyle: 'swell', bass: 'sub', bassStyle: 'fifths', kit: 'peak', toll: true, opener: ['gong'], space: 'cathedral', energy: 0.5 },

  // --- the other Dagoni Islands, each its own sound ------------------------
  // Kharos: the Ashborn's music is the forge's. A buzzing shawm of a lead,
  // anvils for drums (`forge`), the mountain's rumble under it all
  // (`drone`), in the dark modes. Its ash plains bare and slow; the cinder
  // woods crackling; the geyser fields hissing in a scale of whole steps;
  // the mountain itself savage.
  ashland: { ...DEEP, root: 50, scale: 'phrygian', bpm: 66, prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'buzz', pad: 'warm', bass: 'sub', kit: 'forge', drone: true, wind: true, space: 'hall', energy: 0.32 },
  cinderwood: { ...CALM, root: 52, scale: 'harmonic', bpm: 76, shape: 'triad', prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'koto', pad: 'pad', bass: 'sub', kit: 'crackle', drone: true, tone: 3600, energy: 0.36, mood: 'dark' },
  geyser: { ...CALM, root: 55, scale: 'whole', bpm: 70, shape: 'triad', prog: [0, 2, 0, 4], progB: [1, 3, 2, 0], lead: 'glass', pad: 'glass', arp: 'bell', arpRate: 3, bass: 'sub', kit: 'crackle', wind: true, detune: 10, energy: 0.3, mood: 'eerie' },
  volcano: { ...CALM, root: 45, scale: 'phrygian', bpm: 90, shape: 'power', prog: [0, 1, 6, 1], progB: [5, 6, 1, 0], lead: 'buzz', counter: 'brass', pad: 'strings', bass: 'moog', bassStyle: 'fifths', kit: 'forge', drone: true, tone: 4200, energy: 0.55, mood: 'dark' },
  ashborn_village: { ...GROOVE, root: 52, scale: 'phrygian', bpm: 96, shape: 'triad', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'buzz', pad: 'warm', keys: 'koto', keysStyle: 'broken', bass: 'sub', bassStyle: 'fifths', kit: 'forge', energy: 0.56 },
  ashborn_town: { ...GROOVE, root: 54, scale: 'hijaz', bpm: 104, shape: 'triad', prog: [0, 1, 5, 4], progB: [3, 1, 6, 0], lead: 'buzz', counter: 'koto', pad: 'pad', arp: 'koto', bass: 'moog', bassStyle: 'fifths', kit: 'forge', energy: 0.64 },
  ashborn_city: { ...GROOVE, root: 50, scale: 'hijaz', bpm: 110, shape: 'triad', prog: [0, 1, 0, 6, 0, 5, 1, 4], progB: [3, 1, 6, 0], lead: 'buzz', counter: 'brass', pad: 'pad', arp: 'koto', bass: 'moog', bassStyle: 'fifths', kit: 'forge', drone: true, energy: 0.7 },
  fight_kharos: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 146, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'buzz', counter: 'brass', pad: 'strings', keys: 'dist', keysStyle: 'chug', bass: 'moog', kit: 'forge_battle', drone: true },
  // Myrrow: the Mirefolk's is the fog's: a breathy reed flute, water
  // dripping in the dark for drums (`drip`), a pad of glass drifting out
  // of tune (`fog`). The Stiltfolk's is the shallows': steel drums, wood
  // blocks and hand drums, a skanking piano, lilting. The moor bleak; the
  // fungal woods strange, in whole steps; the mangroves between.
  moor: { ...CALM, root: 55, scale: 'dorian', bpm: 64, shape: 'sus2', prog: [0, 6, 3, 6], progB: [2, 3, 6, 0], lead: 'reed', pad: 'glass', bass: 'sub', bassStyle: 'drone', fog: true, wind: true, wet: 0.42, tone: 4000, energy: 0.3, mood: 'dark' },
  fungal: { ...CALM, root: 58, scale: 'whole', bpm: 72, shape: 'triad', prog: [0, 2, 1, 3], progB: [1, 3, 2, 0], lead: 'reed', pad: 'glass', arp: 'kalimba', arpStyle: 'wide', bass: 'sub', kit: 'drip', fog: true, detune: 20, energy: 0.32, mood: 'eerie' },
  mangrove: { ...CALM, root: 60, scale: 'minpenta', bpm: 84, swing: 0.15, shape: 'triad', prog: [0, 3, 4, 3], progB: [2, 4, 3, 1], lead: 'steel', pad: 'glass', bass: 'sub', bassStyle: 'offbeat', kit: 'drip', fog: true, energy: 0.42 },
  mire_village: { ...GROOVE, root: 57, scale: 'dorian', bpm: 84, shape: 'sus2', prog: [0, 6, 3, 4], progB: [2, 3, 6, 0], lead: 'reed', pad: 'glass', keys: 'kalimba', keysStyle: 'broken', bass: 'sub', bassStyle: 'root', kit: 'drip', fog: true, energy: 0.48, tone: 5200 },
  mire_town: { ...GROOVE, root: 59, scale: 'dorian', bpm: 90, prog: [0, 3, 6, 4], progB: [2, 3, 6, 0], lead: 'reed', counter: 'flute', pad: 'glass', arp: 'kalimba', bass: 'sub', bassStyle: 'root', kit: 'drip', fog: true, energy: 0.54, tone: 5600 },
  mire_city: { ...GROOVE, root: 55, scale: 'dorian', bpm: 94, prog: [0, 6, 3, 4, 0, 2, 6, 4], progB: [2, 3, 6, 0], lead: 'reed', counter: 'strings', pad: 'glass', keys: 'organ', keysStyle: 'swell', arp: 'kalimba', bass: 'sub', bassStyle: 'walk', kit: 'soft', fog: true, energy: 0.6, tone: 6000 },
  stilt_village: { ...GROOVE, root: 64, scale: 'penta', bpm: 108, swing: 0.22, shape: 'triad', prog: [0, 4, 3, 4], progB: [3, 2, 0, 1], lead: 'steel', keys: 'marimba', keysStyle: 'stab', bass: 'sub', bassStyle: 'offbeat', kit: 'steel', sea: true, energy: 0.6 },
  stilt_town: { ...GROOVE, root: 65, scale: 'mixo', bpm: 114, swing: 0.2, shape: 'triad', prog: [0, 6, 3, 4], progB: [5, 3, 6, 0], lead: 'steel', counter: 'flute', pad: 'warm', keys: 'ep', keysStyle: 'stab', bass: 'pluckbass', bassStyle: 'offbeat', kit: 'steel', energy: 0.66 },
  stilt_city: { ...GROOVE, root: 62, scale: 'mixo', bpm: 118, swing: 0.2, prog: [0, 3, 6, 4, 0, 3, 4, 4], progB: [5, 3, 6, 0], lead: 'steel', counter: 'brass', pad: 'pad', keys: 'ep', keysStyle: 'stab', arp: 'marimba', bass: 'fmbass', bassStyle: 'offbeat', kit: 'steel', energy: 0.72 },
  fight_myrrow: { ...DRIVE, root: 53, scale: 'minor', bpm: 134, prog: [0, 6, 0, 1], progB: [3, 6, 5, 4], lead: 'reed', counter: 'chant', pad: 'glass', arp: 'cello', arpStyle: 'down', bass: 'reese', kit: 'abyss', fog: true },
};

// --- the far lands, each its own sound (round 68) ----------------------------
// Velmarch: the Velari's lyre and brass, the legion's drums, in bright
// modes; the Rimeborn's horn over a chant, the frame drum, a drone, the
// wind off the ice. Ostria: the Jade Court's erhu and zither, temple
// blocks, in the pentatonic; the Keshari's cedar flute over the great
// drum, the desert wind. Corrow's pipes and bodhran over the sea;
// Saltmere's bouzouki dancing in the old modes; Hollowmark's ocarina by
// the hearth; the Wyrd Isle's harp and whistle in a fey ring; the
// Skerries' fiddle reels, the sea and the gale.
const FAR_MUSIC = {
  velari: { root: 62, scale: 'mixo', bpm: 100, lead: 'lyre', counter: 'brass', pad: 'strings', keys: 'lyre', keysStyle: 'broken', arp: 'harp', bass: 'sub', bassStyle: 'fifths', kit: 'legion' },
  rime: { root: 52, scale: 'dorian', bpm: 84, lead: 'horn', counter: 'chant', pad: 'glass', keys: 'harp', keysStyle: 'broken', arp: 'bell', bass: 'sub', bassStyle: 'drone', kit: 'frame', drone: true, wind: true },
  jade: { root: 60, scale: 'penta', bpm: 88, prog: [0, 3, 4, 2], progB: [3, 4, 1, 0], lead: 'erhu', counter: 'flute', pad: 'glass', keys: 'koto', keysStyle: 'broken', arp: 'koto', bass: 'sub', bassStyle: 'root', kit: 'temple' },
  kesh: { root: 55, scale: 'minpenta', bpm: 92, prog: [0, 3, 4, 3], progB: [2, 4, 3, 0], lead: 'cedar', counter: 'chant', pad: 'warm', keys: 'marimba', keysStyle: 'stab', arp: 'kalimba', bass: 'sub', bassStyle: 'pulse', kit: 'pueblo', drone: true, wind: true },
  corrow: { root: 57, scale: 'mixo', bpm: 104, swing: 0.2, lead: 'pipes', counter: 'reel', pad: 'warm', keys: 'harp', keysStyle: 'broken', arp: 'harp', bass: 'pluckbass', bassStyle: 'bounce', kit: 'bodhran', sea: true },
  salt: { root: 62, scale: 'hijaz', bpm: 112, lead: 'bouzouki', counter: 'reed', pad: 'warm', keys: 'bouzouki', keysStyle: 'stab', arp: 'harp', bass: 'pluckbass', bassStyle: 'offbeat', kit: 'sirtaki', sea: true },
  hollow: { root: 60, scale: 'major', bpm: 90, swing: 0.12, lead: 'ocarina', counter: 'squeeze', pad: 'warm', keys: 'ep', keysStyle: 'broken', arp: 'kalimba', bass: 'sub', bassStyle: 'root', kit: 'hearth' },
  wyrd: { root: 57, scale: 'dorian', bpm: 78, meter: 12, lead: 'flute', counter: 'pipes', pad: 'glass', keys: 'harp', keysStyle: 'broken', arp: 'bell', bass: 'sub', bassStyle: 'drone', kit: 'circle', shimmer: true, detune: 8 },
  skerry: { root: 62, scale: 'mixo', bpm: 118, swing: 0.24, lead: 'reel', counter: 'squeeze', pad: 'warm', keys: 'squeeze', keysStyle: 'stab', arp: 'harp', bass: 'pluckbass', bassStyle: 'bounce', kit: 'bodhran', sea: true, wind: true },
};
const FAR_TIERS = {
  village: (P) => ({ ...GROOVE, ...P, counter: null, arp: null, energy: 0.5 }),
  town: (P) => ({ ...GROOVE, ...P, arp: null, energy: 0.6, bpm: P.bpm * 1.04 }),
  city: (P) => ({ ...GROOVE, ...P, energy: 0.68, bpm: P.bpm * 1.07, prog: [...P.prog, ...P.progB] }),
  // (An empire's capital: grander still, a choir over it all.)
  empire: (P) => ({ ...GROOVE, ...P, pad: 'choir', energy: 0.74, bpm: P.bpm * 1.08, prog: [...P.prog, ...P.progB], space: 'cathedral', toll: true }),
};
for (const [k, P] of Object.entries(FAR_MUSIC)) {
  const base = { prog: [0, 5, 3, 4], progB: [3, 4, 0, 4], ...P };
  for (const [tier, fn] of Object.entries(FAR_TIERS)) THEMES[`${k}_${tier}`] = fn(base);
}
Object.assign(THEMES, {
  // Their lands. The olive hills: the lyre over strings, a soft legion's
  // tread far off, warm.
  olive_hills: { ...CALM, own: true, root: 62, scale: 'mixo', bpm: 84, prog: [0, 6, 3, 4], progB: [5, 3, 1, 4], lead: 'lyre', counter: 'flute', pad: 'strings', keys: 'harp', keysStyle: 'broken', bass: 'sub', bassStyle: 'fifths', kit: 'soft', energy: 0.42, mood: 'bright' },
  // The rimewood: a horn calling over a chant and glass, the frame drum
  // slow, the drone of the ice, the wind.
  rimewood: { ...CALM, own: true, root: 50, scale: 'dorian', bpm: 64, shape: 'sus2', prog: [0, 6, 3, 6], progB: [2, 3, 6, 0], lead: 'horn', counter: 'chant', pad: 'glass', arp: 'bell', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', kit: 'frame', drone: true, wind: true, wet: 0.45, echo: 0.3, energy: 0.3, mood: 'dark' },
  // The bamboo: an erhu over the zither, temple blocks, the pentatonic.
  bamboo_grove: { ...CALM, own: true, root: 60, scale: 'penta', bpm: 76, prog: [0, 4, 3, 4], progB: [3, 2, 0, 1], lead: 'erhu', counter: 'flute', pad: 'glass', arp: 'koto', arpStyle: 'updown', arpRate: 2, bass: 'sub', kit: 'temple', wet: 0.4, energy: 0.38 },
  // The red mesa: the cedar flute alone over the great drum and the wind.
  red_mesa: { ...CALM, own: true, root: 55, scale: 'minpenta', bpm: 72, shape: 'sus2', prog: [0, 3, 4, 3], progB: [2, 4, 3, 0], lead: 'cedar', pad: 'warm', bass: 'sub', bassStyle: 'drone', kit: 'pueblo', drone: true, wind: true, wet: 0.45, echo: 0.34, energy: 0.34 },
  // The bone strand: a lament on the pipes, the sea, a heartbeat.
  bone_strand: { ...CALM, own: true, root: 55, scale: 'dorian', bpm: 66, prog: [0, 6, 3, 4], progB: [6, 3, 0, 4], lead: 'pipes', counter: 'cello', pad: 'warm', bass: 'sub', bassStyle: 'drone', kit: 'heart', sea: true, wind: true, energy: 0.3, mood: 'dark' },
  // The salt flats: a bouzouki in the heat, the old mode, hand drums.
  salt_flats: { ...CALM, own: true, root: 62, scale: 'hijaz', bpm: 80, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'bouzouki', counter: 'reed', pad: 'warm', bass: 'sub', bassStyle: 'drone', kit: 'hand', drone: true, wind: true, energy: 0.4 },
  // The lantern hollows: an ocarina by firelight, a kalimba, cosy.
  lantern_hollows: { ...CALM, own: true, root: 60, scale: 'major', bpm: 78, swing: 0.1, prog: [0, 4, 5, 3], progB: [3, 4, 1, 4], lead: 'ocarina', counter: 'squeeze', pad: 'warm', arp: 'kalimba', arpStyle: 'updown', bass: 'sub', kit: 'hearth', energy: 0.38 },
  // The rune heath: a whistle and harp in three, the pipes far off, a
  // glitter of bells, a little out of this world.
  rune_heath: { ...CALM, own: true, root: 57, scale: 'dorian', bpm: 70, meter: 12, shape: 'sus2', prog: [0, 6, 3, 4], progB: [2, 3, 6, 0], lead: 'flute', counter: 'pipes', pad: 'glass', keys: 'harp', keysStyle: 'broken', arp: 'bell', arpStyle: 'wide', bass: 'sub', bassStyle: 'drone', kit: 'circle', shimmer: true, detune: 10, wet: 0.45, energy: 0.3, mood: 'eerie' },
  // The sea cliffs: a slow air on the fiddle, the squeezebox, the gale.
  sea_cliffs: { ...CALM, own: true, root: 62, scale: 'mixo', bpm: 74, prog: [0, 6, 0, 4], progB: [3, 6, 2, 4], lead: 'reel', counter: 'squeeze', pad: 'warm', keys: 'harp', keysStyle: 'broken', bass: 'sub', kit: 'soft', sea: true, wind: true, energy: 0.36 },
  // Their fights: each people's war-music.
  fight_velmarch: { ...DRIVE, root: 50, scale: 'phrygian', bpm: 136, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'brass', counter: 'lyre', pad: 'strings', keys: 'braam', keysStyle: 'block', bass: 'moog', bassStyle: 'gallop', kit: 'warmarch', space: 'hall' },
  fight_ostria: { ...DRIVE, root: 52, scale: 'minpenta', bpm: 140, prog: [0, 3, 4, 3], progB: [2, 4, 3, 0], lead: 'erhu', counter: 'koto', pad: 'strings', arp: 'koto', arpStyle: 'down', arpRate: 1, bass: 'moog', bassStyle: 'pulse', kit: 'hunt', space: 'hall' },
  fight_corrow: { ...DRIVE, root: 50, scale: 'dorian', bpm: 140, prog: [0, 6, 0, 4], progB: [3, 6, 5, 4], lead: 'pipes', counter: 'reel', pad: 'strings', bass: 'moog', bassStyle: 'gallop', kit: 'battle', sea: true },
  fight_saltmere: { ...DRIVE, root: 52, scale: 'hijaz', bpm: 144, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'bouzouki', counter: 'brass', pad: 'strings', keys: 'bouzouki', keysStyle: 'chug', bass: 'pluckbass', bassStyle: 'gallop', kit: 'rogue' },
  fight_hollowmark: { ...DRIVE, root: 50, scale: 'minor', bpm: 132, prog: [0, 6, 3, 4], progB: [2, 3, 6, 4], lead: 'ocarina', counter: 'cello', pad: 'strings', arp: 'cello', arpStyle: 'down', bass: 'moog', kit: 'rite' },
  fight_wyrd: { ...DRIVE, root: 51, scale: 'harmonic', bpm: 134, meter: 12, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'pipes', counter: 'chant', pad: 'choir', arp: 'bell', bass: 'reese', kit: 'night', detune: 10 },
  fight_skerries: { ...DRIVE, root: 50, scale: 'dorian', bpm: 146, swing: 0.1, prog: [0, 6, 0, 4], progB: [3, 6, 0, 4], lead: 'reel', counter: 'squeeze', pad: 'strings', bass: 'pluckbass', bassStyle: 'gallop', kit: 'battle', sea: true, wind: true },
  // (Round 68) The far lands' own old places, each its own music, below,
  // in a fight, and in its master's hall.
  //   The Imperial Catacombs: a dead legion's hymn, choir and lyre, a
  //     slow march far off; then the march at the charge, brass and war-drums.
  dungeon_catacomb: { ...DEEP, own: true, root: 50, scale: 'dorian', bpm: 58, prog: [0, 6, 3, 4], progB: [5, 3, 6, 0], lead: 'lyre', counter: 'choir', pad: 'choir', bass: 'sub', bassStyle: 'fifths', kit: 'legion', toll: true, space: 'cathedral', energy: 0.28 },
  dungeon_catacomb_fight: { ...DRIVE, own: true, root: 50, scale: 'phrygian', bpm: 132, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'brass', counter: 'lyre', pad: 'choir', keys: 'braam', keysStyle: 'block', bass: 'moog', bassStyle: 'gallop', kit: 'warmarch', space: 'hall' },
  dungeon_catacomb_boss: { ...BOSS, own: true, root: 43, scale: 'harmonic', bpm: 112, shape: 'power', prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'brass', counter: 'choir', pad: 'choir', arp: 'lyre', bass: 'moog', stab: 'braam', toll: true, space: 'cathedral' },
  //   The Terracotta Vaults: a temple's bells and the erhu over a long
  //   drone, clay settling; in a fight the war-drums of the clay army.
  dungeon_vault: { ...DEEP, own: true, root: 52, scale: 'minpenta', bpm: 60, prog: [0, 3, 4, 2], progB: [3, 4, 1, 0], lead: 'erhu', counter: 'bell', pad: 'glass', arp: 'koto', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', kit: 'temple', drone: true, wet: 0.4, energy: 0.28 },
  dungeon_vault_fight: { ...DRIVE, own: true, root: 52, scale: 'minpenta', bpm: 138, prog: [0, 3, 4, 3], progB: [2, 4, 3, 0], lead: 'erhu', counter: 'koto', pad: 'strings', arp: 'koto', arpStyle: 'down', arpRate: 1, bass: 'moog', bassStyle: 'pulse', kit: 'hunt', space: 'hall' },
  dungeon_vault_boss: { ...BOSS, own: true, root: 45, scale: 'phrygian', bpm: 116, prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'erhu', counter: 'brass', pad: 'choir', arp: 'twang', bass: 'moog', stab: 'braam', toll: true, space: 'hall' },
  //   The Leviathan's Gut: a heartbeat for a drum, the pipes' lament
  //   gone low and strange, the sea through the ribs.
  dungeon_gut: { ...DEEP, own: true, root: 46, scale: 'phrygian', bpm: 54, prog: [0, 1, 0, 6], progB: [5, 6, 1, 0], lead: 'pipes', counter: 'cello', pad: 'pad', bass: 'sub', bassStyle: 'drone', kit: 'heart', drone: true, sea: true, detune: 12, tone: 3000, energy: 0.26 },
  dungeon_gut_fight: { ...DRIVE, own: true, root: 46, scale: 'phrygian', bpm: 128, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'abyss', counter: 'pipes', pad: 'strings', bass: 'reese', kit: 'abyss', sea: true, space: 'cave', wet: 0.3 },
  dungeon_gut_boss: { ...BOSS, own: true, root: 41, scale: 'harmonic', bpm: 108, prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'abyss', counter: 'pipes', pad: 'choir', arp: 'cello', bass: 'reese', kit: 'heart', toll: true, space: 'cave', wet: 0.3 },
  //   The Salt Cathedrals: glass and choir in a great white echo, the
  //   bouzouki's old mode slowed to a hymn; the salt singing.
  dungeon_saltworks: { ...DEEP, own: true, root: 57, scale: 'hijaz', bpm: 56, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'bouzouki', counter: 'choir', pad: 'glass', arp: 'bell', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', shimmer: true, space: 'cathedral', wet: 0.5, energy: 0.26 },
  dungeon_saltworks_fight: { ...DRIVE, own: true, root: 52, scale: 'hijaz', bpm: 140, prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'bouzouki', counter: 'glass', pad: 'strings', keys: 'bouzouki', keysStyle: 'chug', bass: 'pluckbass', bassStyle: 'gallop', kit: 'rogue', space: 'hall' },
  dungeon_saltworks_boss: { ...BOSS, own: true, root: 45, scale: 'hijaz', bpm: 114, prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'bouzouki', counter: 'choir', pad: 'choir', arp: 'cello', bass: 'moog', toll: true, shimmer: true, space: 'cathedral' },
  //   The Deep Warrens: the ocarina gone wary in the dark, a kalimba
  //   ticking like something digging, low drums.
  dungeon_warren: { ...DEEP, own: true, root: 53, scale: 'dorian', bpm: 62, swing: 0.1, prog: [0, 6, 3, 4], progB: [2, 3, 6, 0], lead: 'ocarina', counter: 'cello', pad: 'warm', arp: 'kalimba', arpStyle: 'updown', arpRate: 2, bass: 'sub', kit: 'deep', drip: true, energy: 0.3 },
  dungeon_warren_fight: { ...DRIVE, own: true, root: 50, scale: 'minor', bpm: 132, prog: [0, 6, 3, 4], progB: [2, 3, 6, 4], lead: 'ocarina', counter: 'cello', pad: 'strings', arp: 'cello', arpStyle: 'down', bass: 'moog', kit: 'rite', space: 'cave' },
  dungeon_warren_boss: { ...BOSS, own: true, root: 43, scale: 'phrygian', bpm: 110, prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'ocarina', counter: 'dist', pad: 'choir', arp: 'cello', bass: 'reese', stab: 'dist', toll: true, space: 'cave' },
  //   The Hollow Hills: the fair folk's own dance, harp and whistle in
  //   three, bells glittering, a little too sweet.
  dungeon_mound: { ...DEEP, own: true, root: 57, scale: 'lydian', bpm: 66, meter: 12, shape: 'sus2', prog: [0, 1, 4, 0], progB: [3, 1, 6, 4], lead: 'flute', counter: 'pipes', pad: 'glass', keys: 'harp', keysStyle: 'broken', arp: 'bell', arpStyle: 'wide', bass: 'sub', bassStyle: 'drone', kit: 'circle', shimmer: true, detune: 12, wet: 0.5, energy: 0.3 },
  dungeon_mound_fight: { ...DRIVE, own: true, root: 51, scale: 'harmonic', bpm: 136, meter: 12, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'pipes', counter: 'chant', pad: 'choir', arp: 'bell', bass: 'reese', kit: 'night', detune: 10 },
  dungeon_mound_boss: { ...BOSS, own: true, root: 45, scale: 'harmonic', bpm: 120, meter: 12, prog: [0, 1, 4, 0, 0, 6, 1, 4], progB: [3, 1, 6, 4], lead: 'flute', counter: 'choir', pad: 'choir', arp: 'harp', bass: 'reese', shimmer: true, toll: true, space: 'hall' },
  //   The Drowned Brochs: a slow air on the fiddle over the sea in the
  //   stair, a bell under the water.
  dungeon_broch: { ...DEEP, own: true, root: 50, scale: 'dorian', bpm: 58, prog: [0, 6, 0, 4], progB: [3, 6, 2, 4], lead: 'reel', counter: 'cello', pad: 'pad', arp: 'bell', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', toll: true, sea: true, wind: true, fog: true, energy: 0.28 },
  dungeon_broch_fight: { ...DRIVE, own: true, root: 50, scale: 'dorian', bpm: 144, swing: 0.1, prog: [0, 6, 0, 4], progB: [3, 6, 0, 4], lead: 'reel', counter: 'squeeze', pad: 'strings', bass: 'pluckbass', bassStyle: 'gallop', kit: 'battle', sea: true, wind: true },
  dungeon_broch_boss: { ...BOSS, own: true, root: 43, scale: 'phrygian', bpm: 116, prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'reel', counter: 'brass', pad: 'choir', arp: 'crushed', bass: 'reese', toll: true, sea: true, wind: true, space: 'hall' },
  // (Round 71) The ancient places on the great continents, and their
  // evolved masters: the darkest music there is. Below, a dread that
  // never lifts; in their halls, the end of the world, climbing through
  // every one of the master's phases (see bossLevel: five, and its
  // rising) and heavier with each: the drums doubling, the choir and the
  // braams piling up, a gong at every bar at the last (see grandBar).
  //   The Athanor: glass and an organ in a sealed vault, the bubbling of
  //     the great work; its master's a hymn turned inside out.
  dungeon_athanor: { ...DEEP, own: true, root: 49, scale: 'harmonic', bpm: 56, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'organ', counter: 'glass', pad: 'choir', arp: 'bell', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', drone: true, toll: true, shimmer: true, space: 'cathedral', wet: 0.5, detune: 10, energy: 0.26 },
  dungeon_athanor_fight: { ...DRIVE, own: true, root: 49, scale: 'harmonic', bpm: 138, prog: [0, 5, 1, 4], progB: [3, 0, 5, 4], lead: 'organ', counter: 'chant', pad: 'choir', keys: 'organ', keysStyle: 'pulse', arp: 'glass', arpStyle: 'down', bass: 'reese', kit: 'warmarch', space: 'cathedral', wet: 0.32 },
  dungeon_athanor_boss: { ...BOSS, own: true, levels: 6, apocalypse: true, root: 40, scale: 'harmonic', bpm: 104, prog: [0, 5, 1, 4, 0, 6, 1, 4], progB: [3, 0, 5, 4], lead: 'organ', counter: 'choir', pad: 'choir', arp: 'glass', bass: 'reese', stab: 'braam', dbl: 'screech', toll: true, shimmer: true, space: 'cathedral', wet: 0.32, detune: 12 },
  //   The Sundered Reach: the alien scale broken and slid out of tune,
  //     glass shattering in the echo; its master's time coming apart.
  dungeon_rift: { ...DEEP, own: true, root: 47, scale: 'alien', bpm: 52, prog: [0, 1, 3, 2], progB: [2, 4, 1, 3], lead: 'crushed', counter: 'glass', pad: 'glass', arp: 'bell', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'drone', drone: true, fog: true, space: 'cathedral', wet: 0.55, detune: 18, energy: 0.24 },
  dungeon_rift_fight: { ...DRIVE, own: true, root: 47, scale: 'alien', bpm: 142, prog: [0, 1, 3, 2], progB: [2, 4, 1, 3], lead: 'crushed', counter: 'screech', pad: 'glass', arp: 'crushed', arpStyle: 'down', bass: 'reese', kit: 'machine', space: 'cathedral', wet: 0.3, detune: 16 },
  dungeon_rift_boss: { ...BOSS, own: true, levels: 6, apocalypse: true, root: 39, scale: 'alien', bpm: 106, prog: [0, 1, 3, 2, 0, 4, 3, 1], progB: [2, 4, 1, 3], lead: 'crushed', counter: 'choir', pad: 'glass', arp: 'crushed', bass: 'reese', stab: 'crushed', dbl: 'screech', toll: true, space: 'cathedral', wet: 0.3, detune: 20 },
  //   The Hall of the Last Champion: a dead hero's march, the warhorn
  //     over a choir, slow and grand and wrong; its master's a last stand.
  dungeon_champion: { ...DEEP, own: true, root: 50, scale: 'phrygian', bpm: 58, prog: [0, 1, 6, 5], progB: [5, 6, 1, 0], lead: 'warhorn', counter: 'cello', pad: 'choir', arp: 'lyre', arpStyle: 'wide', arpRate: 4, bass: 'sub', bassStyle: 'fifths', kit: 'legion', toll: true, space: 'cathedral', wet: 0.45, energy: 0.28 },
  dungeon_champion_fight: { ...DRIVE, own: true, root: 50, scale: 'phrygian', bpm: 136, shape: 'power', prog: [0, 1, 0, 6], progB: [5, 1, 6, 0], lead: 'warhorn', counter: 'brass', pad: 'choir', keys: 'braam', keysStyle: 'block', bass: 'moog', bassStyle: 'gallop', kit: 'warmarch', space: 'hall' },
  dungeon_champion_boss: { ...BOSS, own: true, levels: 6, apocalypse: true, root: 41, scale: 'phrygian', bpm: 108, shape: 'power', prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'warhorn', counter: 'choir', pad: 'choir', arp: 'cello', bass: 'moog', stab: 'braam', dbl: 'brass', toll: true, space: 'cathedral' },
  //   The Gullet of the World: a heartbeat as big as a mountain, the
  //     earth grinding, the abyss's call; its master's the end of it all.
  dungeon_gullet: { ...DEEP, own: true, root: 45, scale: 'phrygian', bpm: 50, prog: [0, 1, 0, 6], progB: [5, 6, 1, 0], lead: 'abyss', counter: 'cello', pad: 'pad', bass: 'sub', bassStyle: 'drone', kit: 'heart', drone: true, drip: true, detune: 14, tone: 2600, energy: 0.24 },
  dungeon_gullet_fight: { ...DRIVE, own: true, root: 45, scale: 'phrygian', bpm: 130, shape: 'power', prog: [0, 1, 0, 6], progB: [3, 1, 6, 0], lead: 'abyss', counter: 'dist', pad: 'strings', keys: 'dist', keysStyle: 'chug', bass: 'reese', kit: 'abyss', space: 'cave', wet: 0.3 },
  dungeon_gullet_boss: { ...BOSS, own: true, levels: 6, apocalypse: true, root: 38, scale: 'phrygian', bpm: 100, shape: 'power', prog: [0, 1, 6, 5, 0, 1, 4, 0], progB: [5, 6, 1, 0], lead: 'abyss', counter: 'choir', pad: 'choir', arp: 'dist', bass: 'reese', stab: 'dist', dbl: 'screech', kit: 'heart', toll: true, space: 'cave', wet: 0.3, detune: 16 },
});

// The two other islands' sound laid over any tune heard there that isn't
// their own already (the beach, the sea, a fight with the watch, a tavern,
// the dungeons below and their masters): its modes darkened or blurred, its
// instruments and drums swapped for the island's. (Thessa's is the plain
// one.)
const ISLE_SOUND = {
  kharos: {
    root: -2, toneX: 0.85, drone: true,
    scale: { minor: 'harmonic', dorian: 'phrygian', mixo: 'hijaz', major: 'hijaz', penta: 'minpenta', lydian: 'phrygian' },
    voice: { flute: 'buzz', lead: 'buzz', pluck: 'koto', ep: 'koto', kalimba: 'koto', marimba: 'koto', harp: 'koto', steel: 'buzz', reed: 'buzz', squeeze: 'buzz', horn: 'brass' },
    pad: { glass: 'pad' },
    kit: { soft: 'forge', light: 'forge', groove: 'forge', city: 'forge', hand: 'forge', tribal: 'forge', march: 'forge', steel: 'forge', shanty: 'forge', peak: 'forge', battle: 'forge_battle', drive: 'forge_battle', beast: 'forge_battle', rogue: 'forge_battle' },
  },
  myrrow: {
    root: 1, bpmX: 0.92, fog: true,
    scale: { minor: 'dorian', harmonic: 'dorian', phrygian: 'dorian', major: 'lydian', mixo: 'dorian', penta: 'minpenta' },
    voice: { flute: 'reed', ep: 'reed', bell: 'reed', choir: 'reed', glass: 'reed', squeeze: 'reed', horn: 'reed', pluck: 'kalimba', marimba: 'kalimba', koto: 'kalimba', harp: 'kalimba' },
    pad: { pad: 'glass', warm: 'glass', strings: 'glass' },
    kit: { soft: 'drip', light: 'drip', hand: 'drip', tribal: 'drip', groove: 'drip', heart: 'drip', shanty: 'drip', peak: 'drip' },
  },
};
// (Round 68) The far lands' sound over what's heard there that isn't their
// own: Velmarch's lyre and legion, Ostria's erhu and temple blocks,
// Corrow's pipes, Saltmere's bouzouki, Hollowmark's ocarina, the Wyrd
// Isle's harp and fey bells, the Skerries' fiddle.
Object.assign(ISLE_SOUND, {
  velmarch: { root: 2, scale: { minor: 'dorian', penta: 'major' }, voice: { flute: 'lyre', ep: 'lyre', pluck: 'lyre', kalimba: 'lyre', harp: 'lyre', koto: 'lyre', steel: 'lyre', squeeze: 'brass', reed: 'horn' }, pad: {}, kit: { soft: 'legion', light: 'legion', groove: 'legion', city: 'legion', hand: 'legion', tribal: 'legion', shanty: 'legion', steel: 'legion' } },
  ostria: { scale: { major: 'penta', mixo: 'penta', minor: 'minpenta', dorian: 'minpenta', lydian: 'penta' }, voice: { flute: 'erhu', lead: 'erhu', ep: 'koto', pluck: 'koto', kalimba: 'koto', harp: 'koto', marimba: 'koto', squeeze: 'erhu', reed: 'erhu' }, pad: { pad: 'glass' }, kit: { soft: 'temple', light: 'temple', groove: 'temple', city: 'temple', hand: 'temple', shanty: 'temple', steel: 'temple' } },
  corrow: { root: -3, scale: { major: 'mixo', minor: 'dorian', lydian: 'mixo' }, voice: { flute: 'pipes', lead: 'pipes', squeeze: 'pipes', ep: 'harp', pluck: 'harp', kalimba: 'harp', steel: 'reel' }, pad: {}, kit: { soft: 'bodhran', light: 'bodhran', groove: 'bodhran', city: 'bodhran', hand: 'bodhran', steel: 'bodhran' }, sea: true },
  saltmere: { scale: { major: 'hijaz', mixo: 'hijaz', minor: 'phrygian', dorian: 'phrygian' }, voice: { flute: 'bouzouki', lead: 'bouzouki', pluck: 'bouzouki', ep: 'bouzouki', kalimba: 'harp', squeeze: 'reed', steel: 'bouzouki' }, pad: {}, kit: { soft: 'sirtaki', light: 'sirtaki', groove: 'sirtaki', city: 'sirtaki', shanty: 'sirtaki', steel: 'sirtaki' } },
  hollowmark: { bpmX: 0.94, scale: { minor: 'dorian', phrygian: 'dorian' }, voice: { flute: 'ocarina', lead: 'ocarina', reed: 'ocarina', bell: 'kalimba', pluck: 'kalimba', steel: 'ocarina' }, pad: { pad: 'warm', glass: 'warm' }, kit: { soft: 'hearth', light: 'hearth', groove: 'hearth', city: 'hearth', hand: 'hearth', tribal: 'hearth' } },
  wyrd: { root: -3, scale: { major: 'dorian', mixo: 'dorian', minor: 'dorian', lydian: 'dorian' }, voice: { lead: 'flute', ep: 'harp', pluck: 'harp', kalimba: 'bell', squeeze: 'pipes', reed: 'pipes', steel: 'harp' }, pad: { pad: 'glass', warm: 'glass' }, kit: { soft: 'circle', light: 'circle', groove: 'circle', city: 'circle', hand: 'circle', shanty: 'circle', steel: 'circle' }, fog: true },
  skerries: { scale: { major: 'mixo', minor: 'dorian' }, voice: { flute: 'reel', lead: 'reel', reed: 'reel', ep: 'squeeze', pluck: 'harp', kalimba: 'harp', steel: 'reel' }, pad: {}, kit: { soft: 'bodhran', light: 'bodhran', groove: 'bodhran', city: 'bodhran', hand: 'bodhran', steel: 'bodhran' }, sea: true },
});
export function isleTheme(T, isle) {
  const c = ISLE_SOUND[isle];
  if (!c) return T;
  T.root += c.root || 0;
  if (c.bpmX) T.bpm *= c.bpmX;
  T.scale = c.scale[T.scale] || T.scale;
  // (A fight's saw lead and brass stay: only the gentler instruments go
  // over.)
  for (const k of ['lead', 'counter', 'keys', 'arp']) if (T[k]) T[k] = c.voice[T[k]] || T[k];
  if (T.pad) T.pad = c.pad[T.pad] || T.pad;
  if (T.kit) T.kit = c.kit[T.kit] || T.kit;
  if (c.drone) T.drone = true;
  if (c.toneX) T.tone *= c.toneX;
  if (c.fog) {
    T.fog = true;
    T.detune = Math.max(T.detune || 0, 12);
  }
  if (c.sea) T.sea = true;
  return T;
}
// Each island's own tunes, where it has them: its towns' (by people), its
// fights' and its lands'.
const ISLE_TOWNS = { ember: 'ashborn', mist: 'mire', tide: 'stilt' };
const ISLE_FIGHTS = { kharos: 'fight_kharos', myrrow: 'fight_myrrow', velmarch: 'fight_velmarch', ostria: 'fight_ostria', corrow: 'fight_corrow', saltmere: 'fight_saltmere', hollowmark: 'fight_hollowmark', wyrd: 'fight_wyrd', skerries: 'fight_skerries' };
const OWN_BIOMES = new Set(['ashland', 'cinderwood', 'geyser', 'volcano', 'moor', 'fungal', 'mangrove', 'olive_hills', 'rimewood', 'bamboo_grove', 'red_mesa', 'bone_strand', 'salt_flats', 'lantern_hollows', 'rune_heath', 'sea_cliffs']);

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

// (Round 64) The Workshop's own, likewise (a few minutes each).
export const WORKSHOP_SONGS = [
  ['ws_studio', 'The Studio'],
  ['ws_glass', 'Glass Bench'],
  ['ws_drift', 'Drift'],
  ['ws_lantern', 'Lantern Hours'],
  ['ws_tide', 'Low Tide'],
  ['ws_dusk', 'Late at the Bench'],
];
export const WORKSHOP_SONG_LEN = 180;

// How long a scene's music is kept once the scene's over (seconds).
export const LINGER = 9;

// Is the music right now a scene's own (to come in on its cue)?
export function moodUrgent(game) {
  return !!(game && ((game.cutscene && game.cutscene.mood) || (game.scene && game.scene.mood)));
}

// What the music should be right now.
export function musicMood(game) {
  const p = game.player;
  if (!p) return 'title';
  if (game.cutscene && game.cutscene.mood) return game.cutscene.mood;
  if (game.scene && game.scene.mood) return game.scene.mood;
  // (Round 66) A mod's music, put on by one of its nodes (for a while, or
  // till it's stopped).
  const mm = modMusicNow(game);
  if (mm) return mm;
  // (Which of the Dagoni Islands you're on, or under: its sound.)
  const tilde = isleTilde(game);
  // A fight: the watch after you, bandits, beasts at your throat, or
  // things of the night.
  if (!p.dead) {
    const after = game.npcs.filter((n) => !n.dead && n.threat === p && (n.state === 'fight' || n.state === 'alert') && n.distTo(p) < 20);
    if (after.some((n) => !(n.rec && n.rec.bandit !== undefined))) return `fight_guards${tilde}`;
    if (after.length) return `fight_bandits${tilde}`;
    const foes = game.creatures.filter((c) => !c.dead && c.hostileNow && c.target === p && c.distTo(p) < 12);
    if (foes.length || (game.combatT || 0) > 0) {
      if (game.combatWith === 'guard') return `fight_guards${tilde}`;
      if (game.combatWith === 'bandit') return `fight_bandits${tilde}`;
      // (Below ground: a master's hall, or the place's own fight music.)
      if (game.dungeon) {
        const ty = game.dungeon.rec.type;
        const own = ownDungeon(ty) ? '' : tilde;
        if (game.dungeon.fight || game.creatures.some((c) => !c.dead && c.isBoss && c.target === p && c.distTo(p) < 18)) return `dungeon_${ty}_boss${own}:p${Math.min(levelsOf(ty), fightPhase(game.dungeon.fight))}`;
        return `dungeon_${ty}_fight${own}`;
      }
      if (ISLE_FIGHTS[tilde.slice(1)]) return ISLE_FIGHTS[tilde.slice(1)];
      // (A beast, not a thing of the night: the hunt's music.)
      const beasts = foes.length ? foes.every((c) => c.beast) : game.combatWith === 'beast';
      return beasts ? 'fight_beasts' : 'fight_monsters';
    }
  }
  // Near a Kavorent spire (not one whose ruin is beaten).
  if (!game.dungeon && game.nearSpire) {
    const s = game.nearSpire;
    const rec = game.sim.dungeons.get?.(s.id);
    if (Math.hypot(s.x - p.x, s.z - p.z) < 20 && !(rec && rec.cleared)) return rec && rec.spire && rec.spire.open !== null && rec.spire.open !== undefined ? 'spire_open' : 'spire';
  }
  // Out on a raft: a sea-song; into the storm, its own music, darker the
  // deeper in; and when it's over, the wreck's.
  const SS = game.stormSea;
  if (SS && SS.phase) return SS.phase === 'wake' ? 'wreck' : 'tempest:p3';
  if (p.raft && !game.dungeon) {
    if (SS && (SS.depth > 0.03 || SS.near > 0.3)) return `tempest:p${SS.red > 0.15 ? 3 : SS.depth > 0.2 ? 2 : 1}`;
    return game.minute < 330 || game.minute >= 1230 ? 'sailing:night' : 'sailing';
  }
  // Down below (no nights there): its master's fight, once begun, even
  // between blows.
  if (game.dungeon) {
    const ty = game.dungeon.rec.type;
    const own = ownDungeon(ty) ? '' : tilde;
    return game.dungeon.fight ? `dungeon_${ty}_boss${own}:p${Math.min(levelsOf(ty), fightPhase(game.dungeon.fight))}` : `dungeon_${ty}${own}`;
  }
  const night = game.minute < 330 || game.minute >= 1230;
  const s = game.currentSettlement;
  if (s) {
    const L = game.active.get(s.id)?.layout;
    const gy = L && L.graveyard;
    if (gy) {
      const d = Math.max(gy.x - 3 - p.x, p.x - (gy.x + gy.W + 2), gy.z - 3 - p.z, p.z - (gy.z + 2 * gy.maxRows + 3));
      if (d <= 0) return 'graveyard';
    }
    if (s.condition === 'abandoned' || s.deserted) return `ruins${tilde}`;
    const b = game.buildingAtPlayer ? game.buildingAtPlayer() : null;
    if (b && b.type === 'tavern') return night ? `tavern${tilde}:night` : `tavern${tilde}`;
    // (An island people's town plays its own tune; Thessa's peoples play
    // the old tunes their own way.)
    const tier = s.type === 'city' ? 'city' : s.type === 'town' ? 'town' : 'village';
    const style = (s.civ ? s.civ.style : s.style) || 'vale';
    // (Round 68) A far people's town its own people's music; an empire's
    // capital, grandest of all.
    const far = FAR_MUSIC[style] ? `${style}_${s.empire ? 'empire' : tier}` : null;
    const kind = (far || (ISLE_TOWNS[style] ? `${ISLE_TOWNS[style]}_${tier}` : tier)) + townMusic(L);
    return night ? `${kind}:night` : kind;
  }
  const biome = game.biomeCache ? game.biomeCache.biome : 'plains';
  const def = BIOMES[biome];
  // (Round 66) A biome a mod's given a song of its own (or a sound to play
  // round and round), by day and by night. (At night: the night's song;
  // or, if the night has a theme of the game's, that; else the day's.)
  const song = def && (night ? def.songNight || (def.musicNight ? null : def.song) : def.song);
  if (song && (MODS.songs.has(song) || MODS.sounds.has(song))) return `song:${song}`;
  // (Its night's own theme, if it's given one.)
  if (night && def && def.musicNight && THEMES[def.musicNight]) return def.musicNight + (OWN_BIOMES.has(def.musicNight) ? '' : tilde);
  // (A mod's biome, or a change to one of the game's: the music of the
  // game's biome it asks for.)
  const mb = def && def.music && THEMES[def.music] ? def.music : THEMES[biome] ? biome : 'plains';
  const t = mb + (OWN_BIOMES.has(mb) ? '' : tilde);
  return night ? `${t}:night` : t;
}

// (Round 66) The music a mod's node has put on for this player, while it
// lasts: 'song:...' (or a theme's key), or null.
export function modMusicNow(game) {
  const r = game.renderer;
  const M = r && r.modMusicOn;
  if (!M) return null;
  if (M.until && performance.now() / 1000 > M.until) {
    r.modMusicOn = null;
    return null;
  }
  return M.key;
}

// '~kharos' or '~myrrow' where you are (or where the dungeon you're in
// is), '' on Thessa or anywhere else.
export function isleTilde(game) {
  const ow = game.world && game.world.ow;
  if (!ow || !ow.islandAt) return '';
  const at = game.dungeon && game.dungeon.rec && game.dungeon.rec.x !== undefined ? game.dungeon.rec : game.player;
  let isle = ow.islandAt(Math.round(at.x), Math.round(at.z));
  // (Round 68) Or one of the far lands: the land under you (made already,
  // being where you are).
  if (!isle && ow.cells) {
    const c = ow.cells[Math.floor(at.z / REGION_D) * MAP_W + Math.floor(at.x / REGION_W)];
    if (c && c.biome !== 'ocean' && c.island) isle = c.island;
  }
  return ISLE_SOUND[isle] ? `~${isle}` : '';
}

// An island's own kind of dungeon has its own music already.
function ownDungeon(ty) {
  return !!(THEMES[`dungeon_${ty}`] && THEMES[`dungeon_${ty}`].own);
}

// Each people plays its own way. The north's in the old dorian mode, a
// horn over a harp, the bass in fifths; the sun peoples' in the desert
// mode on a koto, hand drums under it; the wild peoples' bright and
// strange, kalimbas and marimbas over toms; the high peoples' a march of
// brass and organ.
const CULTURE_SOUND = {
  vale: {},
  north: { scale: 'dorian', root: -2, bpmX: 0.9, lead: 'horn', keys: 'harp', keysStyle: 'broken', bassStyle: 'fifths', kit: 'soft', drone: true },
  sun: { scale: 'hijaz', root: 2, lead: 'koto', counter: 'flute', kit: 'hand', swing: 0.1 },
  wild: { scale: 'lydian', root: 4, lead: 'kalimba', keys: 'marimba', keysStyle: 'stab', arp: 'kalimba', kit: 'tribal' },
  high: { scale: 'mixo', root: -5, bpmX: 0.92, lead: 'brass', pad: 'strings', keys: 'organ', keysStyle: 'swell', bassStyle: 'fifths', kit: 'march' },
  // (The Ashborn, the Mirefolk and the Stiltfolk have tunes of their own:
  // see ISLE_TOWNS.)
};
// And how the town's doing. Thriving: quicker and brighter, more playing
// (a counter-melody, an arp, a fuller kit). Struggling: slower, in a
// sadder mode (sad, not hopeless: a major key goes to dorian, not minor),
// the tune alone on a soft instrument over a warm pad, the drums down to a
// shaker.
const DARKER = { major: 'dorian', mixo: 'dorian', lydian: 'mixo', hijaz: 'phrygian', dorian: 'minor', penta: 'minpenta' };
const SOFTER = { lead: 'ep', pluck: 'ep', brass: 'horn', squeeze: 'flute', marimba: 'kalimba' };
const KIT_UP = { soft: 'light', light: 'groove', groove: 'city', heart: 'soft' };
export function flavourTheme(T, style, fortune) {
  const c = CULTURE_SOUND[style] || {};
  if (c.scale) T.scale = c.scale;
  if (c.root) T.root += c.root;
  if (c.bpmX) T.bpm *= c.bpmX;
  for (const k of ['lead', 'counter', 'pad', 'keys', 'keysStyle', 'arp', 'bassStyle', 'kit', 'swing', 'drone']) if (c[k] !== undefined) T[k] = c[k];
  if (fortune === 'thriving') {
    T.bpm *= 1.06;
    T.energy = Math.min(0.95, (T.energy || 0.5) + 0.12);
    T.counter = T.counter || (T.lead === 'flute' ? 'strings' : 'flute');
    T.arp = T.arp || 'pluck';
    T.kit = KIT_UP[T.kit] || T.kit || 'light';
    T.tone = (T.tone || 6000) * 1.15;
    T.mood = 'bright';
  } else if (fortune === 'struggling') {
    T.scale = DARKER[T.scale] || T.scale;
    T.bpm *= 0.82;
    T.energy = (T.energy || 0.5) * 0.6;
    T.lead = SOFTER[T.lead] || T.lead || 'ep';
    T.pad = 'warm';
    T.keys = null;
    T.arp = null;
    T.counter = null;
    T.kit = T.kit ? 'soft' : null;
    T.bass = 'sub';
    T.bassStyle = 'root';
    T.tone = (T.tone || 6000) * 0.7;
    T.wet = (T.wet || 0.3) + 0.1;
    T.detune = 8;
    T.mood = 'calm';
  }
  return T;
}

// Every tune has a night version: slower, sparser, a dreamier mode, softer
// instruments (the saw lead to glass, the brass to a far horn, a pluck to
// a kalimba), the drums down to a shaker (or gone), more of the room and
// the echo, and a faint high shimmer of bells now and then. (Whatever the
// people's own drums: a sun town's hand drums and a high town's march
// quieten too.)
const NIGHT_SCALE = { major: 'lydian', mixo: 'dorian', hijaz: 'phrygian', penta: 'minpenta' };
const NIGHT_KIT = { light: 'soft', groove: 'soft', city: 'light', hand: 'soft', tribal: 'soft', march: null, soft: null, peak: null, waltz: null, forge: 'crackle', steel: 'soft', shanty: 'soft', drip: 'drip', crackle: 'crackle', heart: 'heart' };
// (The islands' own instruments stay at night, softer; a forge's buzz goes
// down to a reed.)
const NIGHT_VOICE = { lead: 'glass', brass: 'horn', pluck: 'kalimba', buzz: 'reed', marimba: 'kalimba', squeeze: 'flute', organ: 'warm' };
const STEADY_BASS = { walk: 'root', bounce: 'root', pulse: 'root', gallop: 'root', offbeat: 'root' };
export function nightTheme(T) {
  T.bpm *= 0.75;
  T.energy = (T.energy || 0.5) * 0.55;
  if (T.lead) T.lead = NIGHT_VOICE[T.lead] || T.lead;
  if (T.kit in NIGHT_KIT) T.kit = NIGHT_KIT[T.kit];
  T.scale = NIGHT_SCALE[T.scale] || T.scale;
  T.pad = !T.pad || T.pad === 'pad' ? 'warm' : T.pad;
  T.arp = ['bell', 'kalimba', 'glass', 'harp', 'ep'].includes(T.arp) ? T.arp : null;
  T.arpRate = Math.max(T.arpRate || 2, 4);
  T.counter = null;
  if (T.keys) T.keysStyle = 'broken';
  if (T.bass === 'moog' || T.bass === 'fmbass') T.bass = 'sub';
  T.bassStyle = STEADY_BASS[T.bassStyle] || T.bassStyle;
  if (T.form === 'groove') T.form = 'calm';
  T.swing = 0;
  T.wet = Math.min(0.7, (T.wet || 0.3) + 0.15);
  T.echo = (T.echo || 0.15) + 0.1;
  T.tone = (T.tone || 6000) * 0.7;
  T.shimmer = true;
  T.night = true;
  return T;
}

// A master's fight's phase, from a theme's variant ('p1' to 'p3'; 0 for
// any other).
export function bossLevel(variant) {
  const m = /^p([1-6])$/.exec(variant || '');
  return m ? +m[1] : 0;
}
// How far a place's master's music climbs (three; an ancient place's six).
export function levelsOf(type) {
  return (THEMES[`dungeon_${type}_boss`] && THEMES[`dungeon_${type}_boss`].levels) || 3;
}

// --- playing a theme ------------------------------------------------------------
// The parts of a tune's form and how many bars each, by the kind of music;
// once through, it goes round again from `loop`. (A calm one: an intro, the
// tune, its middle, the tune again, a breath. A town's: an intro, the
// tune, the middle, the tune with more around it, a break. A fight's: a
// count-in, then the same, ending on a drop. A master's: no intro, no
// rest.)
const FORMS = {
  calm: { parts: [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['air', 4]], loop: 1 },
  groove: { parts: [['intro', 4], ['A', 8], ['B', 8], ['A2', 8], ['break', 4]], loop: 1 },
  drive: { parts: [['intro', 2], ['A', 8], ['B', 8], ['A2', 8], ['drop', 4]], loop: 1 },
  boss: { parts: [['A', 8], ['B', 8], ['A2', 8], ['bridge', 4]], loop: 0 },
  // (A scene's: in on its cue with the tune, no intro.)
  scene: { parts: [['A', 8], ['B', 8], ['A2', 8], ['air', 4]], loop: 0 },
};
// How loud each kind of music is against the others: out in the country
// and down below softer than a town, a fight louder, a master's loudest
// (and by night all of it a little softer).
const LEVEL = { calm: 0.72, groove: 0.85, drive: 1, boss: 1.05, scene: 0.95 };
// How strongly each part's played.
const DYN = { intro: 0.82, A: 0.92, B: 0.96, A2: 1, air: 0.78, break: 0.86, drop: 0.95, bridge: 0.9 };

// Each instrument's channel on the desk: its level, where it sits, how much
// of it goes to the room and to the echo, and whether it's chorused.
const CH = {
  lead: { vol: 0.9, pan: 0, verb: 0.35, echo: 0.6 },
  dbl: { vol: 0.35, pan: 0.18, verb: 0.35, echo: 0.4 },
  counter: { vol: 0.55, pan: -0.28, verb: 0.45, echo: 0.3 },
  pad: { vol: 0.5, pan: 0, verb: 0.55, chorus: true },
  fog: { vol: 0.4, pan: 0, verb: 0.6, chorus: true },
  keys: { vol: 0.5, pan: 0.22, verb: 0.38, echo: 0.2, chorus: true },
  arp: { vol: 0.34, pan: -0.15, verb: 0.35, echo: 0.9 },
  bass: { vol: 0.8, pan: 0, verb: 0.04 },
  drone: { vol: 0.55, pan: 0, verb: 0.3 },
  brass: { vol: 0.5, pan: 0.12, verb: 0.4 },
  bell: { vol: 0.5, pan: 0.1, verb: 0.75, echo: 0.35 },
  kick: { vol: 0.85, pan: 0, verb: 0.06 },
  snare: { vol: 0.8, pan: 0.04, verb: 0.4 },
  hats: { vol: 0.55, pan: 0.3, verb: 0.12 },
  perc: { vol: 0.6, pan: -0.25, verb: 0.3, echo: 0.15 },
  toms: { vol: 0.6, pan: 0.15, verb: 0.35 },
  boom: { vol: 0.6, pan: 0, verb: 0.55 },
  cym: { vol: 0.4, pan: 0.2, verb: 0.3 },
  metal: { vol: 0.4, pan: 0.2, verb: 0.5, echo: 0.3 },
  fx: { vol: 0.5, pan: 0, verb: 0.6, echo: 0.2 },
};
const DRUM_CH = { kick: 'kick', snare: 'snare', clap: 'snare', hat: 'hats', hatO: 'hats', shaker: 'hats', rim: 'perc', conga: 'perc', bongo: 'perc', wood: 'perc', zill: 'metal', tom: 'toms', taiko: 'boom', timp: 'boom', crash: 'cym', swell: 'cym', anvil: 'metal', drip: 'metal', crackle: 'fx', riser: 'fx', wind: 'fx', sea: 'fx',
  gong: 'boom', impact: 'boom', chain: 'metal', stomp: 'toms', war: 'snare', thunder: 'fx' };
// How each kit's kick sounds (a soft thump, a heartbeat, a deep boom, a
// punch), and how loud the kit is.
const KICK = {
  soft: { f0: 110, f1: 46, dec: 0.3, click: false }, heart: { f0: 85, f1: 38, dec: 0.28, click: false }, deep: { f0: 85, f1: 38, dec: 0.3, click: false },
  drip: { f0: 85, f1: 38, dec: 0.28, click: false }, crackle: { f0: 90, f1: 40, dec: 0.3, click: false }, light: { f0: 130, f1: 48, dec: 0.28 },
  waltz: { f0: 110, f1: 46, dec: 0.3, click: false }, shanty: { f0: 120, f1: 50, dec: 0.22, click: false },
  grand: { f0: 140, f1: 38, dec: 0.75 }, grand2: { f0: 150, f1: 42, dec: 0.5 }, fury: { f0: 170, f1: 46, dec: 0.32 },
  night: { f0: 150, f1: 40, dec: 0.4 }, warmarch: { f0: 120, f1: 42, dec: 0.45, click: false }, machine: { f0: 160, f1: 45, dec: 0.3 },
  abyss: { f0: 90, f1: 36, dec: 0.5, click: false }, dirge: { f0: 90, f1: 38, dec: 0.45, click: false },
};
const KIT_VOL = { soft: 0.6, heart: 0.75, deep: 0.7, drip: 0.6, crackle: 0.6, light: 0.8, waltz: 0.7, peak: 0.85, shanty: 0.85 };
// Which steps of the bar the keys play on (and for how many), by style.
const KEYS = {
  comp: { 16: [[0, 3], [6, 2], [10, 4]], 12: [[0, 3], [6, 2], [9, 3]] },
  block: { 16: [[0, 7], [8, 7]], 12: [[0, 5], [6, 5]] },
  oompah: { 16: [[4, 2], [12, 2]], 12: [[4, 2], [8, 2]] },
  stab: { 16: [[2, 1], [6, 1], [10, 1], [14, 1]], 12: [[3, 1], [9, 1]] },
  swell: { 16: [[0, 16]], 12: [[0, 12]] },
  pulse: { 16: [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 1]), 12: [0, 2, 4, 6, 8, 10].map((s) => [s, 1]) },
  // (A fight's ostinato: short, hard and galloping, low strings or a
  // guitar muted against the bridge.)
  chug: { 16: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14].map((s) => [s, 1]), 12: [0, 2, 3, 6, 8, 9].map((s) => [s, 1]) },
};
// Instruments that sit an octave over the tune's usual place (and how the
// tune's notes are held on each: a bell rings on, a pluck's let go).
// (And some an octave under it: the low strings, a guitar, monks, a war
// horn, the outlaws' baritone.)
const UP = { flute: 12, bell: 12, glass: 12, kalimba: 12, steel: 12, reed: 12, marimba: 12, screech: 12, celesta: 12, musicbox: 12, cello: -12, dist: -12, chant: -12, warhorn: -12, twang: -12, ocarina: 12, cedar: 12 };
const LEGATO = {
  lead: 1.02, flute: 0.95, brass: 0.9, horn: 0.95, squeeze: 0.88, buzz: 0.92, reed: 0.95, choir: 1, organ: 0.95, bell: 1.5, glass: 1.3, kalimba: 1.2, koto: 1.2, steel: 1, ep: 1.1, pluck: 1, marimba: 1, harp: 1.3,
  cello: 1, dist: 0.9, chant: 1, screech: 1, warhorn: 0.95, braam: 1, twang: 1.3, crushed: 0.8, abyss: 1.1, celesta: 1.4, dulcimer: 1.3, fiddle: 0.95, theremin: 1.02, musicbox: 1.3,
  lyre: 1.3, erhu: 0.96, cedar: 0.95, pipes: 0.98, bouzouki: 1.1, ocarina: 1, reel: 0.95,
};
// Which take a grace note now and then (a flick from the note above).
const GRACE = new Set(['flute', 'reed', 'buzz', 'koto', 'squeeze', 'horn', 'fiddle', 'dulcimer', 'erhu', 'cedar', 'pipes', 'ocarina', 'reel']);
// Instruments played an octave under where the chords are usually voiced,
// as keys, arp or a master's stabs (the low strings' ostinato, a guitar's
// power chords, a wall of brass).
const DOWN = { cello: 12, dist: 12, braam: 12, chant: 12, twang: 12 };
const down = (patch, m) => (DOWN[patch] ? (Array.isArray(m) ? m.map((q) => q - DOWN[patch]) : m - DOWN[patch]) : m);

// A note moved by octaves into [lo, hi].
function reg(n, lo, hi) {
  while (n < lo) n += 12;
  while (n > hi) n -= 12;
  return n;
}

// A chord's notes placed between `lo` and `hi`, as close as they can be to
// the last chord's (so the parts move smoothly rather than jumping).
export function voiceChord(notes, lo, hi, prev) {
  const opts = notes.map((m) => {
    const pc = ((m % 12) + 12) % 12;
    const o = [];
    for (let x = lo; x <= hi; x++) if (((x % 12) + 12) % 12 === pc) o.push(x);
    return o.length ? o : [reg(m, lo, lo + 11)];
  });
  let best = null;
  let bc = Infinity;
  const acc = [];
  const pick = (i) => {
    if (i === opts.length) {
      const v = [...acc].sort((a, b) => a - b);
      let cost = 0;
      for (let k = 1; k < v.length; k++) {
        if (v[k] === v[k - 1]) cost += 50;
        // (No muddy seconds at the bottom.)
        else if (k === 1 && v[1] - v[0] < 3) cost += 5;
      }
      if (prev && prev.length === v.length) for (let k = 0; k < v.length; k++) cost += Math.abs(v[k] - prev[k]);
      else cost += v[v.length - 1] - v[0] + Math.abs(v[0] - (lo + 4));
      if (cost < bc) {
        bc = cost;
        best = v;
      }
      return;
    }
    for (const x of opts[i]) {
      acc.push(x);
      pick(i + 1);
      acc.pop();
    }
  };
  pick(0);
  return best;
}

// A theme filled out: whatever it doesn't say, the usual.
function finish(T) {
  T.meter = T.meter || 16;
  T.shape = T.shape || 'triad';
  T.progB = T.progB || [3, 4, 5, 4];
  T.energy = T.energy ?? 0.5;
  T.form = FORMS[T.form] ? T.form : 'calm';
  T.space = T.space || 'hall';
  T.wet = T.wet ?? 0.3;
  T.echo = T.echo ?? 0.12;
  T.tone = T.tone || 5000;
  T.swing = T.swing || 0;
  T.detune = T.detune || 0;
  T.bassStyle = T.bassStyle || 'root';
  T.keysStyle = T.keysStyle || 'broken';
  T.arpStyle = T.arpStyle || 'up';
  T.arpRate = T.arpRate || 2;
  T.mood = T.mood || 'calm';
  return T;
}

// One playing theme: its own desk (see synth.js's Rack) and fader,
// scheduled a little ahead.
class Voice {
  constructor(music, key, fadeIn = 2.5) {
    const [full, variant] = key.split(':');
    const [named, flavour] = full.split('@');
    // (`~isle`: one of the other islands' sound laid over it.)
    const [name, isle] = named.split('~');
    this.m = music;
    this.key = key;
    this.T = { ...(THEMES[name] || THEMES.plains) };
    if (isle) isleTheme(this.T, isle);
    // A town's own people's sound, and how it's doing.
    if (flavour) flavourTheme(this.T, ...flavour.split('.'));
    if (variant === 'night') nightTheme(this.T);
    finish(this.T);
    // A master's fight, and how far into it (its phase: see bossLevel).
    this.level = bossLevel(variant) || 1;
    this.lv = this.level;
    const c = music.ctx;
    this.rand = mulberry32((Math.random() * 1e9) | 0);
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(LEVEL[this.T.form] * (this.T.night ? 0.85 : 1), c.currentTime + fadeIn);
    this.out.connect(music.mix || music.bus);
    const T = this.T;
    this.rack = new Rack(music, this.out, { space: T.space, wet: T.wet, echo: T.echo, tone: this.toneNow(), beat: this.stepDur * 4, rand: this.rand });
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.part = 0;
    this.partBar = -1;
    this.loops = 0;
    this.barN = -1;
    this.arpK = 0;
    this.write(true);
    this.stopped = false;
  }

  get stepDur() {
    return 60 / (this.T.bpm * (1 + 0.09 * (this.lv - 1))) / 4;
  }

  toneNow() {
    return this.T.tone * (1 + 0.22 * (this.lv - 1));
  }

  // The fight's moved into a new phase: the same tune, climbing to it over
  // a few bars (quicker, busier, more of it playing), with a riser and a
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
      this.hit('riser', t, 1, { dur: sd * 16 });
      const f = midiHz(reg(this.T.root, 36, 47));
      for (let i = 0; i < 8; i++) this.hit('timp', t + sd * 8 + i * sd, 0.3 + i * 0.09, { f });
      // (And it lands with a blow.)
      this.hit('impact', t + sd * 16, 0.9);
    }
  }

  // The tune written (see compose.js): the first motif's two phrases, the
  // middle's two, and a counter-line under each. Written again (the middle
  // always, the tune now and then, from the same motif) each time round,
  // so a long walk isn't one loop.
  write(all) {
    const T = this.T;
    const r = this.rand;
    const M = T.meter;
    const n = (SCALES[T.scale] || SCALES.major).length;
    // (A fight's tune moves slower than the drive under it: see DRIVE.)
    const e = T.leadEnergy ?? T.energy;
    if (all || !this.mA) this.mA = motif(r, M, e, T.mood);
    this.mB = motif(r, M, Math.min(1, e + 0.15), T.mood);
    const four = (p, k) => [0, 1, 2, 3].map((i) => p[(4 * k + i) % p.length]);
    const o = { lo: -1, hi: n + 2, shape: T.shape, meter: M };
    const ob = { ...o, lo: 0, hi: n + 3 };
    if (all || r() < 0.5) this.lineA = [...line(T, r, this.mA, four(T.prog, 0), { ...o, close: false }), ...line(T, r, this.mA, four(T.prog, 1), { ...o, close: true })];
    this.lineB = [...line(T, r, this.mB, four(T.progB, 0), { ...ob, close: false }), ...line(T, r, this.mB, four(T.progB, 1), { ...ob, close: true })];
    const c = { lo: -3, hi: n - 1, meter: M };
    this.ctrA = [...counterLine(T, r, four(T.prog, 0), c), ...counterLine(T, r, four(T.prog, 1), c)];
    this.ctrB = [...counterLine(T, r, four(T.progB, 0), c), ...counterLine(T, r, four(T.progB, 1), c)];
  }

  // The channel an instrument plays into (on this tune's desk).
  ch(role) {
    return this.rack.chan(role, CH[role] || CH.fx);
  }

  // A note (or a chord, its notes together) on an instrument.
  note(role, patch, midi, t, dur, vel, o = {}) {
    const f = Array.isArray(midi) ? midi.map(midiHz) : midiHz(midi);
    this.rack.play(patch, this.ch(role), f, t, dur, vel, { detune: this.T.detune, pipe: this.T.space === 'cathedral', ...o });
  }

  hit(drum, t, vel = 1, o = {}) {
    this.rack.hit(drum, this.ch(DRUM_CH[drum] || 'perc'), t, vel, o);
  }

  get partName() {
    return FORMS[this.T.form].parts[this.part][0];
  }

  get partLen() {
    return FORMS[this.T.form].parts[this.part][1];
  }

  // What's playing in this part of the form (and at this point in a
  // master's fight).
  layers() {
    const T = this.T;
    const name = this.partName;
    const calm = T.form === 'calm';
    const half = this.partBar >= this.partLen / 2;
    const L = { lead: false, counter: false, pad: !!T.pad, keys: !!T.keys, arp: false, bass: !!T.bass, drums: !!this.kitName() };
    if (name === 'intro') {
      L.keys = L.keys && (calm || half);
      L.bass = L.bass && (!calm || half);
      L.drums = L.drums && !calm;
      L.arp = !!T.arp && (T.form === 'drive' || (calm && !T.keys));
    } else if (name === 'A') {
      L.lead = true;
      L.counter = !!T.counter && this.loops > 0;
      L.arp = !!T.arp && (T.form === 'drive' || this.loops > 0 || calm);
    } else if (name === 'A2') {
      L.lead = true;
      L.counter = !!T.counter;
      L.arp = !!T.arp;
    } else if (name === 'B') {
      L.lead = true;
      L.counter = !!T.counter;
      L.arp = !!T.arp && !calm;
    } else if (name === 'air') {
      L.drums = false;
      L.arp = !!T.arp;
    } else if (name === 'break') {
      L.arp = !!T.arp;
    } else if (name === 'drop') {
      L.pad = false;
      L.keys = false;
      L.arp = !!T.arp;
    } else if (name === 'bridge') {
      L.counter = true;
    }
    if (T.grand) {
      // (A master's: the arp and the strings only once it's climbing.)
      L.arp = !!T.arp && this.lv >= 1.6 && name !== 'bridge';
      L.counter = L.counter && (name === 'bridge' || this.lv >= 1.6);
    }
    return L;
  }

  kitName() {
    const T = this.T;
    // (A master's: heavy and slow to begin, then driving, then savage, as
    // the fight climbs.)
    if (T.grand) return this.lv < 1.6 ? 'grand' : this.lv < 2.5 ? 'grand2' : 'fury';
    return T.kit || null;
  }

  // A new bar: on through the form; then the chord, and what's held
  // through the bar (the pad, the bass line, the drone, the bells).
  startBar(t) {
    const T = this.T;
    const F = FORMS[T.form];
    this.barN++;
    this.partBar++;
    if (this.partBar >= this.partLen) {
      this.partBar = 0;
      this.part++;
      if (this.part >= F.parts.length) {
        this.part = F.loop;
        this.loops++;
        this.write(false);
      }
      // (The fight at its fiercest: the key lifted a step, once.)
      if (T.grand && this.lv >= 2.5 && !this.lifted) {
        this.lifted = true;
        T.root += 1;
      }
    }
    const M = T.meter;
    const sd = this.stepDur;
    const barDur = sd * M;
    const name = this.partName;
    const prog = name === 'B' || name === 'bridge' ? T.progB : T.prog;
    const chord = prog[this.partBar % prog.length];
    const next = prog[(this.partBar + 1) % prog.length];
    const lastChord = this.chord;
    this.chord = chord;
    this.L = this.layers();
    const L = this.L;
    this.rack.setBeat(sd * 4);
    if (T.grand) this.rack.setTone(this.toneNow(), t);
    const sc = T.scale;
    const notes = chordDegs(chord, T.shape).map((d) => degMidi(T.root, sc, d));
    // The pad: held while the chord is.
    if (L.pad && (this.partBar === 0 || chord !== lastChord || !this.padOn)) {
      let run = 1;
      while (this.partBar + run < this.partLen && prog[(this.partBar + run) % prog.length] === chord) run++;
      const lo = reg(T.root, 50, 61);
      this.padV = voiceChord(notes, lo, lo + 17, this.padV);
      const cut = Math.min(2600, Math.max(700, T.tone * 0.3)) * (1 + 0.25 * (this.lv - 1));
      this.note('pad', T.pad, this.padV, t, barDur * run - sd * 0.5, 0.85 * DYN[name], { cut });
    }
    this.padOn = L.pad;
    const kl = reg(T.root, 55, 66);
    this.keysV = voiceChord(notes, kl, kl + 16, this.keysV);
    const al = reg(T.root, 62, 73);
    this.arpV = voiceChord(notes, al, al + 14, this.arpV);
    // The bass line, in its style.
    this.bassNotes = [];
    if (L.bass) {
      const style = T.grand ? (this.lv < 1.6 ? 'root' : this.lv < 2.5 ? 'pulse' : 'gallop') : T.bassStyle;
      const base = reg(T.root, 33, 44);
      let shift = 0;
      const rn = degMidi(base, sc, chord, 0);
      while (rn + shift > base + 7) shift -= 12;
      while (rn + shift < base - 5) shift += 12;
      for (const b of bassBar(style, chord, next, M, this.rand, T.energy)) this.bassNotes.push({ ...b, midi: degMidi(base, sc, b.deg, b.oct + 2) + shift });
    }
    // The touches of its own.
    const root = T.root;
    if (T.drone && !T.grand && this.barN % 2 === 0) this.note('drone', 'drone', reg(root, 36, 47), t, barDur * 2, 0.8);
    if (T.toll && this.barN % 2 === 0) this.note('bell', 'bell', reg(root, 48, 59), t, barDur, 0.75, { deep: true });
    if (T.fog && this.barN % 2 === 1) this.note('fog', 'glass', [notes[0], notes[2] ?? notes[0] + 7].map((m) => reg(m, 60, 71)), t, barDur * 2, 0.5, { detune: 30 });
    if (T.wind && this.barN % 4 === 0 && this.rand() < 0.75) this.hit('wind', t, 0.8, { dur: barDur * 4 * 0.9 });
    if (T.sea && this.barN % 2 === 0) this.hit('sea', t, 0.7, { dur: barDur * 2 });
    if (T.shimmer && this.barN % 2 === 1) this.note('bell', 'bell', reg(notes[notes.length - 1], 79, 90), t + sd * 2, sd * 6, 0.3);
    if (T.hammer && this.barN % 4 === 2 && this.rand() < 0.65) this.hit('anvil', t + sd * Math.floor(this.rand() * M), 0.3);
    if (T.thunder && this.barN % 4 === 1 && this.rand() < 0.7) this.hit('thunder', t + sd * Math.floor(this.rand() * M), 0.8, { dur: barDur * 2 });
    // (A scene's music opening on its cue: the blow, the gong.)
    if (this.barN === 0) for (const d of T.opener || []) this.hit(d, t, 1);
    if (T.grand) this.grandBar(t, barDur);
    // (A drop's last bars: a riser into the tune coming back.)
    if (name === 'drop' && this.partBar === this.partLen - 2) this.hit('riser', t, 1, { dur: barDur * 2 });
  }

  // A master's, each bar: the drone, timpani on the bar (and rolling into
  // every fourth), a deep bell with a tritone in it now and then.
  grandBar(t, barDur) {
    const T = this.T;
    const sd = this.stepDur;
    const low = reg(T.root, 36, 47);
    if (this.barN % 2 === 0) this.note('drone', 'drone', low, t, barDur * 2, 0.9 + 0.1 * (this.lv - 1));
    this.hit('timp', t, 0.75, { f: midiHz(low + (this.barN % 2 ? 7 : 0)) });
    if (this.barN % 4 === 3) for (let i = 12; i < T.meter; i++) this.hit('timp', t + sd * i, 0.2 + (i - 12) * 0.12, { f: midiHz(low) });
    // (A gong as each part of it opens.)
    if (this.partBar === 0) this.hit('gong', t, 0.55 + 0.15 * (this.lv - 1));
    if (this.barN % 4 === 0) {
      this.note('bell', 'bell', reg(T.root, 45, 56), t, barDur, 0.8, { deep: true });
      this.note('bell', 'bell', reg(T.root, 45, 56) + 6, t + 0.02, barDur, 0.35, { deep: true });
    }
    // (Round 71) The end of the world, an evolved master's: heavier with
    // every phase. A blow on every bar; then the timpani doubled and a
    // braam on the half bar; then a riser into every other bar; risen, a
    // gong at every bar and the blows on every beat.
    if (T.apocalypse) {
      const lv = this.lv;
      if (lv >= 2.5) this.hit('impact', t, 0.35 + 0.08 * (lv - 2.5));
      if (lv >= 3.5) {
        for (let i = 2; i < T.meter; i += 4) this.hit('timp', t + sd * i, 0.3 + 0.05 * lv, { f: midiHz(low + (i % 8 ? 7 : 0)) });
        this.note('brass', T.stab || 'braam', reg(T.root, 36, 47), t + sd * Math.floor(T.meter / 2), sd * 4, 0.5, { stab: true });
      }
      if (lv >= 4.5 && this.barN % 2 === 1) this.hit('riser', t, 0.6, { dur: barDur });
      if (lv >= 5.5) {
        this.hit('gong', t, 0.5);
        for (let i = 4; i < T.meter; i += 4) this.hit('impact', t + sd * i, 0.3);
        this.note('drone', 'drone', low - 12, t, barDur, 0.8);
      }
    }
  }

  // Schedule one sixteenth-note step.
  play(s, t) {
    const T = this.T;
    const M = T.meter;
    const sd = this.stepDur;
    // (Eased toward the fight's phase, a little each step.)
    if (this.lv !== this.level) this.lv += Math.sign(this.level - this.lv) * Math.min(Math.abs(this.level - this.lv), sd * 0.3);
    const b = s % M;
    if (b === 0 || !this.L) this.startBar(t);
    const L = this.L;
    const r = this.rand;
    const name = this.partName;
    const dyn = DYN[name] * (T.grand ? 0.9 + 0.06 * (this.lv - 1) : 1);
    const sw = T.swing && b % 2 === 1 ? sd * T.swing : 0;
    const tt = t + sw;
    const human = () => (r() - 0.5) * 0.008;
    // The bass.
    for (const n of this.bassNotes) if (n.s === b) this.note('bass', T.bass, n.midi, tt, sd * n.len * 0.92, n.vel * dyn, { cut: T.tone * 0.25 });
    // The keys.
    if (L.keys && this.keysV) {
      if (T.keysStyle === 'broken') {
        const k = (M === 12 ? [0, 4, 8] : [0, 4, 8, 12]).indexOf(b);
        if (k >= 0) {
          const v = this.keysV;
          this.note('keys', T.keys, down(T.keys, v[[0, 1, 2, 3][k] % v.length]), tt + human(), sd * 7, (k ? 0.68 : 0.8) * dyn);
        }
      } else {
        for (const [at, len] of (KEYS[T.keysStyle] || KEYS.comp)[M === 12 ? 12 : 16]) {
          if (at !== b) continue;
          this.note('keys', T.keys, down(T.keys, this.keysV), tt + human() * 0.5, sd * len * 0.92, (b === 0 ? 0.72 : 0.6) * dyn);
        }
      }
    }
    // The arp: the chord broken, its filter sweeping open and shut over
    // eight bars.
    if (L.arp && this.arpV && b % T.arpRate === 0) {
      const pat = ARPS[T.arpStyle] || ARPS.up;
      const v = [...this.arpV, this.arpV[0] + 12, this.arpV[1] + 12];
      const m = v[Math.min(v.length - 1, pat[this.arpK++ % pat.length])];
      const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * ((this.barN % 8) + b / M)) / 8);
      this.note('arp', T.arp, down(T.arp, m), tt, sd * T.arpRate * 0.9, (b % 4 === 0 ? 0.85 : 0.68) * dyn, { cut: 900 + 3000 * sweep * (T.tone / 7000) });
    }
    // The tune (the middle's, in the middle), and its counter-line.
    if (L.lead && T.lead) {
      const ln = (name === 'B' ? this.lineB : this.lineA)[this.partBar % 8];
      const base = reg(T.root, 57, 68) + (UP[T.lead] || 0);
      for (const n of ln) {
        if (n.s !== b) continue;
        const m = degMidi(base, T.scale, n.deg);
        let at = tt + human();
        const dur = n.len * sd * (LEGATO[T.lead] || 1);
        if (GRACE.has(T.lead) && n.len >= 3 && (this.loops > 0 || name !== 'A') && r() < 0.16) {
          this.note('lead', T.lead, degMidi(base, T.scale, n.deg + 1), at, sd * 0.35, n.vel * dyn * 0.7);
          at += sd * 0.35;
        }
        this.note('lead', T.lead, m, at, dur, n.vel * dyn, { from: this.lastLead, cut: Math.min(3000, T.tone * 0.45) });
        this.lastLead = midiHz(m);
        // (Desperate: the tune doubled an octave up, shrill over it all.)
        if (T.grand && this.lv >= 2.5) this.note('dbl', T.dbl || 'lead', m + 12 + (UP[T.lead] < 0 ? 12 : 0), at, dur * 0.9, n.vel * 0.6);
      }
    }
    if (L.counter) {
      const cl = (name === 'B' || name === 'bridge' ? this.ctrB : this.ctrA)[this.partBar % 8];
      const patch = T.counter || 'strings';
      const base = reg(T.root, 52, 63) + (patch === 'flute' || patch === 'reed' ? 12 : 0);
      for (const n of cl) if (n.s === b) this.note('counter', patch, degMidi(base, T.scale, n.deg), tt, sd * n.len * 0.96, 0.8 * dyn, { trem: T.grand && this.lv >= 2.5 });
    }
    // A master's brass stabs (more of them as it climbs).
    if (T.grand && this.keysV && name !== 'bridge') {
      const lv = this.lv;
      const stab = T.stab || 'brass';
      if (b === 0 || (lv >= 1.6 && b === 10) || (lv >= 2.5 && (b === 6 || b === 14))) this.note('brass', stab, down(stab, this.keysV), tt, sd * (b === 0 ? 3 : 1.6), b === 0 ? 0.8 : 0.62, { stab: true });
    }
    this.drums(b, t, sw, dyn);
  }

  // The drum machine: the kit's pattern for this step (its fill on a
  // part's last bar, a crash opening the next), thinned by the part of the
  // form.
  drums(b, t, sw, dyn) {
    const T = this.T;
    const M = T.meter;
    const sd = this.stepDur;
    const kn = this.kitName();
    const K = kn && KITS[kn];
    if (!K || !this.L.drums) return;
    const name = this.partName;
    const last = this.partBar === this.partLen - 1;
    const fill = last && K.fill && this.partLen >= 4 && name !== 'intro';
    const half = this.partBar >= this.partLen / 2;
    const thin = (name === 'intro' && !half) || (name === 'break' && !last) || name === 'bridge' || (name === 'drop' && !half);
    const r = this.rand;
    const vol = (KIT_VOL[kn] || 1) * dyn;
    for (const drum of Object.keys(K)) {
      if (typeof K[drum] !== 'string') continue;
      if (thin && !(drum === 'hat' || drum === 'shaker' || drum === 'rim' || drum === 'wood' || drum === 'chain' || (name === 'bridge' && drum === 'taiko') || (name === 'drop' && (drum === 'kick' || drum === 'stomp')))) continue;
      const pat = fill && K.fill[drum] ? K.fill[drum] : K[drum];
      const hv = HIT[pat[b] || '.'] || 0;
      if (!hv) continue;
      const v = hv * vol * (0.9 + r() * 0.16);
      const at = t + sw + (drum === 'kick' ? 0 : (r() - 0.5) * 0.006);
      if (drum === 'kick') {
        this.hit('kick', at, v, KICK[kn] || {});
        // (The pads breathing around the kick.)
        if ((T.pump || (T.grand && this.lv >= 1.6)) && hv >= 1) {
          this.rack.duck('pad', at, 0.55, sd * 3);
          this.rack.duck('keys', at, 0.3, sd * 2.5);
        }
      } else if (drum === 'tom') this.hit('tom', at, v, { pitch: fill ? 1.35 - (0.6 * b) / M : 1 });
      else this.hit(drum, at, v);
    }
    if (K.crackle && r() < 0.18) this.hit('crackle', t + r() * sd, 0.3 + r() * 0.5);
    if ((K.drip || T.drip) && r() < 0.07) this.hit('drip', t + r() * sd, 0.4 + r() * 0.4);
    // A crash to open a part (and the cymbal swelling into it).
    if (K.crash && b === 0 && this.partBar === 0 && this.barN > 0 && name !== 'intro' && name !== 'break' && name !== 'air') this.hit('crash', t, 0.9);
    if (K.crash && last && b === M / 2 && T.form !== 'calm') this.hit('swell', t, 0.8, { dur: sd * (M / 2) });
  }

  schedule(until) {
    while (!this.stopped && this.next < until) {
      this.play(this.step, this.next);
      this.next += this.stepDur;
      this.step++;
    }
  }

  fadeOut(dur = 2.2) {
    const c = this.m.ctx;
    this.out.gain.cancelScheduledValues(c.currentTime);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    this.stopped = true;
    setTimeout(() => {
      this.out.disconnect();
      this.rack.dispose();
    }, (dur + 0.4) * 1000);
  }
}

// (Round 66) A mod's song playing as the music ('song:m:mod:id'): its
// patterns scheduled a little ahead on a desk of its own, round and round
// (from the bar it says to go back to); or a mod's sound, played round
// and round. The Workshop's preview is 'song:@preview' (see
// Music.preview).
class SongVoice {
  constructor(music, key, fadeIn = 2.5) {
    this.m = music;
    this.key = key;
    const c = music.ctx;
    const ref = key.slice(5);
    const pv = ref === '@preview' ? music.previewSong : null;
    const rec = pv || MODS.songs.get(ref) || MODS.sounds.get(ref);
    const mod = rec ? rec.mod : null;
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(0.9, c.currentTime + Math.max(0.05, fadeIn));
    this.out.connect(music.mix || music.bus);
    this.player = null;
    this.src = null;
    if (!rec) return;
    if (rec.v && Array.isArray(rec.v.chans)) {
      const clip = (r) => {
        const k = r && r[0] === '@' && mod ? `m:${mod.id}:${r.slice(1)}` : r;
        const own = r && r[0] === '@' && mod && mod.sounds ? mod.sounds[r.slice(1)] : null;
        return own || (MODS.sounds.get(k) || {}).v || null;
      };
      this.player = new SongPlayer(music, this.out, rec.v, { loop: true, clip });
    } else {
      const buf = clipBuffer(c, rec.v);
      if (!buf) return;
      const g = c.createGain();
      g.gain.value = Math.min(2, rec.v.vol ?? 1);
      this.src = c.createBufferSource();
      this.src.buffer = buf;
      this.src.loop = true;
      this.src.connect(g).connect(this.out);
      this.src.start(c.currentTime + 0.05);
    }
  }

  schedule(until) {
    if (this.player) this.player.schedule(until);
  }

  retune(key) {
    this.key = key;
  }

  fadeOut(dur = 2.2) {
    const c = this.m.ctx;
    this.out.gain.cancelScheduledValues(c.currentTime);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    this.stopped = true;
    setTimeout(() => {
      if (this.player) this.player.stop(0.01);
      if (this.src) {
        try {
          this.src.stop();
        } catch {
          // (Done already.)
        }
      }
      this.out.disconnect();
    }, (dur + 0.4) * 1000);
  }
}

// The voice for a mood: a mod's song or sound, or one of the game's themes.
function voiceFor(music, key, fadeIn) {
  return key.startsWith('song:') ? new SongVoice(music, key, fadeIn) : new Voice(music, key, fadeIn);
}

// How loud the music is at full volume (against the game's sounds).
const GAIN = 0.26;

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
    this.bus.gain.value = this.volume * GAIN;
    this.bus.connect(c.destination);
    this.mix = master(c, this.bus);
    const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    this.irs = {};
    // (The drum machine's samples, struck in the background.)
    this.samples = new Samples(c, n);
    for (const d of ['kick', 'snare', 'clap', 'hat', 'hatO', 'shaker', 'rim', 'tom', 'conga', 'bongo', 'taiko', 'wood', 'crash', 'timp']) this.samples.get(d);
    this.timer = globalThis.setInterval(() => this.tick(), 60);
    return true;
  }

  // A room's ring (made once, the first time it's wanted).
  ir(space) {
    if (!this.irs[space]) this.irs[space] = makeIR(this.ctx, space);
    return this.irs[space];
  }

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.voice) return;
    this.voice.schedule(c.currentTime + 0.3);
    // (Dipped under a sound a moment: back up once it's gone.)
    if (this.ducked && c.currentTime >= this.ducked) {
      this.ducked = 0;
      if (this.bus) this.bus.gain.setTargetAtTime(this.enabled && !this.hushed ? this.volume * GAIN : 0, c.currentTime, 0.5);
    }
  }

  // (Round 64) Dips out for `secs` (a sound played over it: the
  // Workshop's previews), then comes back.
  duck(secs = 1.4) {
    const c = this.ctx;
    if (!c || !this.bus || !this.enabled || this.hushed) return;
    if (!this.ducked) this.bus.gain.setTargetAtTime(this.volume * GAIN * 0.12, c.currentTime, 0.06);
    this.ducked = Math.max(this.ducked || 0, c.currentTime + secs);
  }

  // (Round 66) The Workshop's: one of the game's themes (its key), or a
  // mod's song or sound ({ song, mod } or { sound, mod }), heard for
  // `secs` in place of the Workshop's music (null: stop now).
  preview(what, secs = 30) {
    if (!what) {
      // (Stopped: gone at once, the Workshop's own coming back in.)
      if (this.previewKey && this.previewT > 0 && this.voice) {
        this.voice.fadeOut(0.35);
        this.voice = null;
      }
      this.previewT = 0;
      this.previewKey = null;
      this.linger = 0;
      return;
    }
    if (typeof what === 'string') this.previewKey = what;
    else {
      this.previewSong = { mod: what.mod, v: what.song || what.sound };
      // (A new key each time, so the same song heard again starts over.)
      this.previewN = (this.previewN || 0) + 1;
      this.previewKey = 'song:@preview';
      if (this.voice && this.voice.key === 'song:@preview') this.voice.key = `song:@preview~${this.previewN}`;
    }
    this.previewT = secs;
  }

  previewing() {
    return this.previewKey && this.previewT > 0 ? this.previewKey : null;
  }

  // (Round 66) Quiet (the Workshop playing something of its own over it),
  // or back.
  hush(on) {
    this.hushed = !!on;
    const c = this.ctx;
    if (this.bus && c) this.bus.gain.setTargetAtTime(this.enabled && !on ? this.volume * GAIN : 0, c.currentTime, on ? 0.08 : 0.6);
  }

  setVolume(v) {
    this.volume = v;
    this.enabled = v > 0;
    if (this.bus) this.bus.gain.setTargetAtTime(this.hushed ? 0 : v * GAIN, this.ctx.currentTime, 0.2);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.bus) this.bus.gain.setTargetAtTime(this.enabled && !this.hushed ? this.volume * GAIN : 0, this.ctx.currentTime, 0.3);
    return this.enabled;
  }

  // On the title: its songs one after another (see TITLE_SONGS), from a
  // random one, each a few minutes (counted only while it's heard).
  // (The Workshop's likewise: `list`, `len`, and which it's kept as.)
  titleSong(dt, list = TITLE_SONGS, len = TITLE_SONG_LEN, as = 'title') {
    const c = this.ctx;
    if (!this[as]) this[as] = { i: Math.floor(Math.random() * list.length), t: 0 };
    const T = this[as];
    if (c && c.state === 'running' && this.voice && this.voice.key === list[T.i][0]) T.t += dt;
    if (T.t >= len) {
      T.i = (T.i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
      T.t = 0;
    }
    return list[T.i][0];
  }

  // What's playing on the title (its name), or null.
  nowPlaying() {
    if (!this.voice || !this.title) return null;
    const s = TITLE_SONGS.find(([k]) => k === this.voice.key);
    return s ? s[1] : null;
  }

  // Called every frame with the mood the game is in; switches themes once
  // a new mood has held for a moment (fights switch at once).
  // `urgent`: a scene's own music (see moodUrgent): in on its cue, not a
  // few seconds after; and kept a while once the scene's over, rather than
  // cut off the moment it ends (anything but a fight waits for it).
  update(dt, mood, urgent = false) {
    if (!this.setup()) return;
    // (Round 66) Something the Workshop wants heard in its place a while
    // (see preview).
    if (this.previewKey) {
      this.previewT -= dt;
      if (this.previewT > 0) {
        mood = this.previewKey;
        urgent = true;
      } else {
        this.previewKey = null;
        this.linger = 0;
      }
    }
    if (mood === 'title') mood = this.titleSong(dt);
    else if (mood === 'workshop') mood = this.titleSong(dt, WORKSHOP_SONGS, WORKSHOP_SONG_LEN, 'ws');
    else this.title = null;
    if (mood.startsWith('ws_') === false && this.ws) this.ws = null;
    if (!this.voice) {
      this.voice = voiceFor(this, mood, urgent ? 0.6 : 2.5);
      return;
    }
    if (urgent) this.linger = LINGER;
    else if (this.linger > 0) {
      this.linger -= dt;
      if (mood !== this.voice.key && !mood.startsWith('fight')) return;
    }
    if (mood === this.voice.key) {
      this.want = null;
      return;
    }
    if (urgent) {
      this.voice.fadeOut(0.8);
      this.voice = voiceFor(this, mood, 0.5);
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
      this.voice = voiceFor(this, mood);
      this.want = null;
    }
  }
}
