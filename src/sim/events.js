// Town events: weddings, feast days, and the celebration when a place grows
// into a town or a city. Each is announced a couple of days ahead. The day
// before, somebody goes round putting up posters; on the day the builders
// put up an arch and benches (for a wedding) or a maypole, tables and bunting
// (for a feast) by the square, and people drift in over the hour or so
// before it starts: the ones who want to go, which depends on whose do it
// is, what they're like and how they feel. The next morning it all comes
// down again.
// Each people does it its own way (a maypole in the vales, a bonfire in
// the north, a lantern post and rugs in the south, a fire pit in the
// jungle, an anvil to dance round under the mountain), in its own colours,
// and the builders hang bunting across the streets between the houses and
// put up banners by the hall, the tavern and the roads in, all over town.
import { alive, ledger, setOverride, DAY } from './econ.js';
import { B, BLOCKS, META_STATE, CANOPY_SHIFT } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { hash4, clamp } from '../util/rng.js';
import { festivalName, religionOf } from './culture.js';

export const EVENT_BLOCKS = new Set(['poster', 'flower_arch', 'maypole', 'bunting', 'feast_table', 'festival_banner'].map((k) => B[k]));

// How each people dresses a do: what the dancers go round, what lights it,
// and its colours (see DECOR_PALETTES; a wedding's are white and pink).
const LIT_ = META_STATE;
export const STYLES = {
  vale: { palette: 0, centre: [['maypole']], centreWord: 'a maypole', light: ['lantern', LIT_] },
  north: { palette: 1, centre: [['campfire', LIT_]], centreWord: 'a bonfire', light: ['torch', LIT_] },
  sun: { palette: 2, centre: [['fence'], ['lantern', LIT_]], centreWord: 'a lantern post', light: ['lantern', LIT_], rugs: ['rug_red', 'rug_blue'] },
  wild: { palette: 3, centre: [['campfire', LIT_]], centreWord: 'a fire pit', light: ['torch', LIT_], flowers: ['flower_red', 'flower_yellow', 'flower_purple'] },
  high: { palette: 4, centre: [['anvil']], centreWord: 'an anvil to dance round', light: ['lantern', LIT_] },
  ember: { palette: 0, centre: [['campfire', LIT_]], centreWord: 'a great fire for the mountain', light: ['torch', LIT_], flowers: ['fire_lily'] },
  mist: { palette: 1, centre: [['fence'], ['lantern', LIT_]], centreWord: 'a lantern pole', light: ['lantern', LIT_], flowers: ['heather', 'mushroom_red'] },
  tide: { palette: 3, centre: [['campfire', LIT_]], centreWord: 'a driftwood fire', light: ['torch', LIT_], rugs: ['rug_blue'] },
};
export const WEDDING_PALETTE = 5;
export function styleOf(s) {
  return STYLES[s && s.style] || STYLES.vale;
}
// A colour for bunting or a banner (rotation kept for bunting).
export function decorMeta(palette, rot = 0) {
  return (rot & 3) | ((palette & 3) << CANOPY_SHIFT) | (palette >= 4 ? META_STATE : 0);
}

// When things happen (minutes into the day).
const START = { wedding: 900, feast: 960, fete: 960 };
const LENGTH = { wedding: 150, feast: 180, fete: 180 };
const POSTERS_AT = 480; // the day before, from 8:00...
const POSTERS_BY = 780; // ...all up by 13:00 (and down again by then the day after)
const BUILD_AT = 360; // the builders are on it first thing on the day
const STRIKE_AT = 420; // and take it down the next morning
const KEEP_DAYS = 4; // past events remembered (for talk)

const LIT = META_STATE;
const at = (list) => list.map(([dx, dz, face = 2]) => ({ dx, dz, face }));

// What goes up: blocks by the corner of the site ([dx, dy, dz, block, meta]),
// and where everyone stands or sits.
const DESIGNS = {
  wedding: {
    w: 5, d: 5,
    what: 'an arch and benches',
    blocks: [
      [2, 0, 0, 'flower_arch'],
      [0, 0, 0, 'fence'], [0, 1, 0, 'lantern', LIT], [4, 0, 0, 'fence'], [4, 1, 0, 'lantern', LIT],
      ...[1, 2, 3, 4].map((dz) => [2, 0, dz, 'rug_red']),
      ...[0, 1, 3, 4].flatMap((dx) => [[dx, 0, 2, 'bench', 2], [dx, 0, 3, 'bench', 2]]),
    ],
    lead: { dx: 2, dz: 0, face: 0 },
    couple: at([[1, 1, 3], [3, 1, 1]]),
    seats: at([[1, 2], [3, 2], [0, 2], [4, 2], [1, 3], [3, 3], [0, 3], [4, 3]]),
    stand: at([[1, 4], [3, 4], [0, 4], [4, 4], [-1, 2], [5, 2], [-1, 3], [5, 3], [-1, 4], [5, 4], [1, 5], [3, 5], [0, 5], [4, 5], [2, 5], [-1, 1], [5, 1], [-1, 5], [5, 5], [1, 6], [3, 6], [0, 6], [4, 6]]),
  },
  wedding_small: {
    w: 3, d: 3,
    what: 'a flower arch',
    blocks: [[1, 0, 0, 'flower_arch'], [1, 0, 1, 'rug_red'], [1, 0, 2, 'rug_red'], [0, 0, 2, 'bench', 2], [2, 0, 2, 'bench', 2]],
    lead: { dx: 1, dz: 0, face: 0 },
    couple: at([[0, 1, 3], [2, 1, 1]]),
    seats: at([[0, 2], [2, 2]]),
    stand: at([[0, 3], [2, 3], [1, 3], [-1, 2], [3, 2], [-1, 3], [3, 3], [0, 4], [2, 4], [-1, 1], [3, 1], [1, 4], [-1, 4], [3, 4]]),
  },
  feast: {
    w: 7, d: 6,
    what: 'a maypole, tables and bunting',
    blocks: [
      [0, 0, 0, 'fence'], [0, 1, 0, 'fence'], [0, 2, 0, 'lantern', LIT],
      [6, 0, 0, 'fence'], [6, 1, 0, 'fence'], [6, 2, 0, 'lantern', LIT],
      ...[1, 2, 3, 4, 5].map((dx) => [dx, 2, 0, 'bunting', 0]),
      ...[1, 2, 4, 5].map((dx) => [dx, 0, 1, 'feast_table']),
      [3, 0, 4, 'maypole'],
      [0, 0, 5, 'fence'], [0, 1, 5, 'lantern', LIT], [6, 0, 5, 'fence'], [6, 1, 5, 'lantern', LIT],
    ],
    lead: { dx: 3, dz: 1, face: 0 },
    serve: at([[1, 0, 0], [2, 0, 0], [4, 0, 0], [5, 0, 0]]),
    dine: at([[1, 2], [2, 2], [4, 2], [5, 2]]),
    ring: { dx: 3, dz: 4 },
    stand: at([[0, 2], [6, 2], [0, 3], [6, 3], [1, 3], [5, 3], [0, 4], [6, 4], [1, 5], [5, 5], [3, 6], [2, 6], [4, 6], [1, 6], [5, 6], [-1, 2], [7, 2], [-1, 4], [7, 4], [0, 6], [6, 6], [-1, 3], [7, 3]]),
  },
  feast_small: {
    w: 5, d: 5,
    what: 'a maypole and tables',
    blocks: [
      [0, 0, 0, 'fence'], [0, 1, 0, 'fence'], [0, 2, 0, 'lantern', LIT],
      [4, 0, 0, 'fence'], [4, 1, 0, 'fence'], [4, 2, 0, 'lantern', LIT],
      ...[1, 2, 3].map((dx) => [dx, 2, 0, 'bunting', 0]),
      [1, 0, 1, 'feast_table'], [3, 0, 1, 'feast_table'],
      [2, 0, 3, 'maypole'],
    ],
    lead: { dx: 2, dz: 1, face: 0 },
    serve: at([[1, 0, 0], [3, 0, 0]]),
    dine: at([[0, 1, 3], [4, 1, 1]]),
    ring: { dx: 2, dz: 3 },
    stand: at([[0, 2], [4, 2], [0, 3], [4, 3], [0, 4], [4, 4], [2, 5], [1, 5], [3, 5], [-1, 2], [5, 2], [-1, 3], [5, 3], [0, 5], [4, 5], [-1, 1], [5, 1]]),
  },
  feast_tiny: {
    w: 3, d: 4,
    what: 'a maypole and a table',
    blocks: [[1, 0, 0, 'feast_table'], [1, 0, 2, 'maypole']],
    lead: { dx: 0, dz: 0, face: 0 },
    serve: at([[2, 0, 0]]),
    ring: { dx: 1, dz: 2 },
    stand: at([[-1, 0], [3, 0], [-1, 1], [3, 1], [-1, 2], [3, 2], [-1, 3], [3, 3], [0, 4], [1, 4], [2, 4], [1, -1], [0, -1], [2, -1]]),
  },
};
// The islands' own rites (see RITES): Kharos's ring of fires for the
// mountain, the Mirefolk's avenue of lanterns, the Stiltfolk's driftwood
// feast, and Thessa's fair in a paddock.
const FIRE_RING = [[1, 1], [5, 1], [1, 5], [5, 5]];
Object.assign(DESIGNS, {
  vigil: {
    w: 7, d: 7,
    what: 'a ring of fires for the mountain',
    blocks: [
      [3, 0, 3, 'campfire', LIT],
      [3, 0, 0, 'obsidian'], [3, 1, 0, 'obsidian'],
      ...FIRE_RING.map(([dx, dz]) => [dx, 0, dz, 'fire_lily']),
      ...[[0, 0], [6, 0], [0, 6], [6, 6]].flatMap(([dx, dz]) => [[dx, 0, dz, 'basalt'], [dx, 1, dz, 'torch', LIT]]),
    ],
    lead: { dx: 3, dz: 1, face: 0 },
    ring: { dx: 3, dz: 3 },
    stand: at([[1, 2], [5, 2], [1, 4], [5, 4], [2, 6], [4, 6], [0, 3], [6, 3], [2, 1], [4, 1], [-1, 2], [7, 2], [-1, 4], [7, 4], [1, 7], [5, 7], [3, 7], [-1, 3], [7, 3]]),
  },
  vigil_small: {
    w: 5, d: 5,
    what: 'a fire for the mountain',
    blocks: [[2, 0, 2, 'campfire', LIT], [2, 0, 0, 'obsidian'], [0, 0, 4, 'basalt'], [0, 1, 4, 'torch', LIT], [4, 0, 4, 'basalt'], [4, 1, 4, 'torch', LIT]],
    lead: { dx: 2, dz: 1, face: 0 },
    ring: { dx: 2, dz: 2 },
    stand: at([[0, 2], [4, 2], [1, 4], [3, 4], [-1, 1], [5, 1], [-1, 3], [5, 3], [2, 5], [1, 5], [3, 5]]),
  },
  lanterns: {
    w: 9, d: 5,
    what: 'an avenue of lanterns',
    blocks: [
      ...[0, 2, 4, 6, 8].flatMap((dx) => [[dx, 0, 0, 'fence'], [dx, 1, 0, 'lantern', LIT], [dx, 0, 4, 'fence'], [dx, 1, 4, 'lantern', LIT]]),
      [4, 0, 2, 'mossy_bricks'], [4, 1, 2, 'mossy_bricks'], [4, 2, 2, 'lantern', LIT],
      [1, 0, 2, 'mushroom_red'], [7, 0, 2, 'mushroom_red'],
    ],
    lead: { dx: 4, dz: 1, face: 0 },
    ring: { dx: 4, dz: 2 },
    stand: at([[1, 1], [3, 1], [5, 1], [7, 1], [1, 3], [3, 3], [5, 3], [7, 3], [0, 2], [8, 2], [2, 5], [4, 5], [6, 5], [-1, 2], [9, 2], [2, -1], [6, -1]]),
  },
  lanterns_small: {
    w: 5, d: 5,
    what: 'a lantern pole and a ring of mushrooms',
    blocks: [[2, 0, 2, 'fence'], [2, 1, 2, 'fence'], [2, 2, 2, 'lantern', LIT], [0, 0, 0, 'mushroom_red'], [4, 0, 0, 'mushroom_red'], [0, 0, 4, 'mushroom_brown'], [4, 0, 4, 'mushroom_brown']],
    lead: { dx: 2, dz: 0, face: 0 },
    ring: { dx: 2, dz: 2 },
    stand: at([[0, 2], [4, 2], [1, 4], [3, 4], [-1, 1], [5, 1], [-1, 3], [5, 3], [2, 5], [1, 5], [3, 5]]),
  },
  tidefeast: {
    w: 7, d: 6,
    what: 'a driftwood fire and the catch laid out',
    blocks: [
      [0, 0, 0, 'barrel'], [6, 0, 0, 'barrel'], [0, 1, 0, 'torch', LIT], [6, 1, 0, 'torch', LIT],
      ...[1, 2, 4, 5].map((dx) => [dx, 0, 1, 'feast_table']),
      [3, 0, 4, 'campfire', LIT],
      [0, 0, 5, 'crate'], [6, 0, 5, 'crate'], [0, 0, 4, 'barrel'],
    ],
    lead: { dx: 3, dz: 1, face: 0 },
    serve: at([[1, 0, 0], [2, 0, 0], [4, 0, 0], [5, 0, 0]]),
    dine: at([[1, 2], [2, 2], [4, 2], [5, 2]]),
    ring: { dx: 3, dz: 4 },
    stand: at([[0, 2], [6, 2], [0, 3], [6, 3], [1, 3], [5, 3], [1, 5], [5, 5], [3, 6], [2, 6], [4, 6], [-1, 2], [7, 2], [-1, 4], [7, 4]]),
  },
  tidefeast_small: {
    w: 5, d: 5,
    what: 'a driftwood fire',
    blocks: [[2, 0, 3, 'campfire', LIT], [1, 0, 1, 'feast_table'], [3, 0, 1, 'feast_table'], [0, 0, 0, 'barrel'], [4, 0, 0, 'crate']],
    lead: { dx: 2, dz: 1, face: 0 },
    serve: at([[1, 0, 0], [3, 0, 0]]),
    ring: { dx: 2, dz: 3 },
    stand: at([[0, 2], [4, 2], [0, 4], [4, 4], [2, 5], [1, 5], [3, 5], [-1, 2], [5, 2], [-1, 3], [5, 3]]),
  },
  fair: {
    w: 9, d: 7,
    what: 'a paddock, hay and a trader\'s table',
    blocks: [
      ...[0, 1, 2, 3, 5, 6, 7, 8].map((dx) => [dx, 0, 0, 'fence']),
      ...[1, 2, 3, 4, 5].flatMap((dz) => [[0, 0, dz, 'fence'], [8, 0, dz, 'fence']]),
      ...[0, 1, 2, 6, 7, 8].map((dx) => [dx, 0, 6, 'fence']),
      [2, 0, 2, 'hay_bale'], [6, 0, 2, 'hay_bale'], [2, 0, 4, 'hay_bale'], [6, 1, 2, 'hay_bale'],
      [4, 0, 7, 'feast_table'], [3, 0, 7, 'feast_table'],
      [0, 1, 0, 'lantern', LIT], [8, 1, 0, 'lantern', LIT],
    ],
    lead: { dx: 4, dz: 1, face: 0 },
    serve: at([[3, 8, 2], [4, 8, 2]]),
    ring: { dx: 4, dz: 3 },
    stand: at([[-1, 1], [9, 1], [-1, 3], [9, 3], [-1, 5], [9, 5], [1, 7], [7, 7], [2, 8], [5, 8], [6, 8], [1, -1], [3, -1], [5, -1], [7, -1]]),
  },
  fair_small: {
    w: 5, d: 5,
    what: 'a hay ring and a trader\'s table',
    blocks: [[0, 0, 0, 'hay_bale'], [4, 0, 0, 'hay_bale'], [0, 0, 4, 'hay_bale'], [4, 0, 4, 'hay_bale'], [2, 0, 0, 'feast_table']],
    lead: { dx: 2, dz: 1, face: 0 },
    serve: at([[2, -1, 0]]),
    ring: { dx: 2, dz: 2 },
    stand: at([[0, 2], [4, 2], [1, 4], [3, 4], [-1, 1], [5, 1], [-1, 3], [5, 3], [2, 5], [1, 5], [3, 5]]),
  },
});

const PLANS = {
  wedding: ['wedding', 'wedding_small'], feast: ['feast', 'feast_small', 'feast_tiny'], fete: ['feast', 'feast_small', 'feast_tiny'],
  'rite:vigil': ['vigil', 'vigil_small'], 'rite:lanterns': ['lanterns', 'lanterns_small'], 'rite:tidefeast': ['tidefeast', 'tidefeast_small'], 'rite:fair': ['fair', 'fair_small'],
};

// Each island's rite: what it's called (by people), when it's held (and
// for how long), how often (days; the vigil's held when the mountain
// stirs), its colours, the crowd it draws, and what's said.
export const RITES = {
  vigil: {
    name: () => 'the Waking Vigil', at: 19 * 60, len: 180, palette: 0, pull: 0.75,
    poster: (s) => ['THE SLEEPER STIRS', '', 'Come to the fires by the square', 'and keep watch with us,', `so ${s.name} may be spared.`, ''],
    beats: (town) => [
      { t: 0, who: 'lead', say: 'The mountain is waking. We keep the fires, and we keep faith.' },
      { t: 2, who: 'crowd', cheer: ['Sleep, Sleeper.', 'Spare us.', 'We keep the fires.', 'Sleep...'] },
      { t: 60, who: 'lead', say: `Black glass for the mountain, and bread for the hearths of ${town}.` },
      { t: 61, who: 'crowd', cheer: ['Spare us!', 'We keep faith!'] },
      { t: 150, who: 'lead', say: 'Go home. Keep a mask by your bed, and your children close.' },
    ],
  },
  lanterns: {
    name: () => 'the Night of Lanterns', at: 21 * 60, len: 150, palette: 1, pull: 0.65, every: 12,
    poster: () => ['THE NIGHT OF LANTERNS', '', 'Bring a light to the square', 'and walk the avenue with us,', 'so the fog knows our faces.', ''],
    beats: () => [
      { t: 0, who: 'lead', say: 'Lights up, all of you. Let the fog see who we are.' },
      { t: 2, who: 'crowd', cheer: ['Light to light.', 'We are here.', 'Light to light!'] },
      { t: 75, who: 'lead', say: 'For those the fog took. Say their names, softly.' },
      { t: 76, who: 'crowd', cheer: ['*whispers*', 'Remembered.', 'Light to light.'] },
    ],
  },
  tidefeast: {
    name: () => 'the High Tide Feast', at: 11 * 60 + 30, len: 180, palette: 3, pull: 0.62, every: 9,
    poster: (s) => ['THE HIGH TIDE FEAST', '', 'The tide is in and the pots are full!', `Crab boil and kelp cakes for all of ${s.name}`, 'by the driftwood fire.', ''],
    beats: (town) => [
      { t: 0, who: 'lead', say: 'The Tide-Mother fills the nets. Eat, all of you!' },
      { t: 2, who: 'crowd', cheer: ['To the tide!', 'Pass the crab!', 'Hooray!', `To ${town}!`] },
      { t: 90, who: 'lead', say: 'One shell back to the sea for every one we ate. That\'s the rule.' },
      { t: 91, who: 'crowd', cheer: ['Back to the sea!', 'Ha! Fair enough.'] },
    ],
  },
  fair: {
    name: (s) => ({ vale: 'the Horse Fair', north: 'the Hiring Fair', sun: 'the Caravan Fair', wild: 'the Feather Market', high: 'the Ore Fair' }[s.style] || 'the Fair'),
    at: 10 * 60, len: 240, palette: 2, pull: 0.58, every: 15,
    poster: (s, nm) => [`${nm.toUpperCase()}!`, '', 'Buying, selling, racing and wagers', `in ${s.name} by the square.`, 'Bring your best and your coin!', ''],
    beats: (town) => [
      { t: 0, who: 'lead', say: `The fair is open! Bring your best, ${town}!` },
      { t: 2, who: 'crowd', cheer: ['Hooray!', 'Look at that one!', 'What am I bid?', 'Fair day!'] },
      { t: 120, who: 'lead', say: 'Prizes at the table for the finest beast and the best bargain!' },
      { t: 121, who: 'crowd', cheer: ['Huzzah!', 'Rigged!', 'Well done!'] },
    ],
  },
};
const RITE_OF = { ember: 'vigil', mist: 'lanterns', tide: 'tidefeast' };
// Which rite a people keeps (Thessa's peoples: the fair).
export function riteOf(s) {
  return (s && RITE_OF[s.style]) || 'fair';
}
// Round the maypole, a step at a time.
const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

// How much each sort of person wants to go.
const TRAIT_PULL = {
  outgoing: 0.18, reserved: -0.2, cheerful: 0.12, gloomy: -0.15, gossipy: 0.12, nosy: 0.1, gruff: -0.12, bookish: -0.08,
  hardworking: -0.08, curious: 0.05, timid: -0.05, 'night owl': -0.04, kind: 0.05, easygoing: 0.05, proud: 0.03, witty: 0.04,
};
const TRAIT_PULL_KIND = {
  wedding: { romantic: 0.2, devout: 0.08 },
  feast: { lazy: 0.08, stingy: 0.1, romantic: 0.05 },
  fete: { lazy: 0.08, stingy: 0.08, proud: 0.08 },
  rite: { devout: 0.18, gloomy: 0.1, proud: 0.05 },
};

const name = (r) => `${r.name.first} ${r.name.last}`;
const hodStr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export class Events {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  list(L) {
    return (L.econ.events ||= []);
  }

  get(L, id) {
    return this.list(L).find((ev) => ev.id === id) || null;
  }

  // What's coming up or going on (not over and done with).
  upcoming(L) {
    return this.list(L).filter((ev) => ev.state !== 'off' && ev.state !== 'done' && ev.state !== 'over');
  }

  // Everyone already promised to someone at a wedding still to come.
  engaged(L) {
    const out = new Set();
    for (const ev of this.upcoming(L)) if (ev.couple) for (const i of ev.couple) out.add(i);
    return out;
  }

  title(L, ev) {
    if (ev.kind === 'wedding') {
      const [a, b] = ev.couple.map((i) => L.npcs[i]);
      return `the wedding of ${a.name.first} and ${b.name.first}`;
    }
    if (ev.kind === 'rite') return RITES[ev.rite].name(L.settlement);
    return ev.kind === 'fete' ? `the celebration of ${L.settlement.name} becoming a ${ev.tier}` : festivalName(L.settlement);
  }

  // The island's own rite, when its day comes round (Kharos's when the
  // mountain stirs). (`soon`: from the command console.)
  rite(L, day, soon = null) {
    const s = L.settlement;
    const key = riteOf(s);
    const R = RITES[key];
    const ev = this.announce(L, 'rite', day, { rite: key, host: (L.npcs.find((r) => r.job === 'priest' && alive(r) && !r.away) || L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.away) || {}).idx ?? null, at: R.at, len: R.len }, soon);
    ledger(L, day, `${cap(R.name(s))} will be held by the square on day ${ev.day} from ${hodStr(ev.s % DAY)}.`);
    return ev;
  }

  // Each morning: is it a rite's day? (Kharos keeps its vigil the evening
  // the mountain first shakes; the others on their own calendars.)
  rites(L, day) {
    const s = L.settlement;
    if (s.condition === 'abandoned' || this.upcoming(L).length) return null;
    const key = riteOf(s);
    if (key === 'vigil') {
      const V = this.sim.volcano;
      if (!V || s.island !== 'kharos' || V.warned !== day) return null;
      return this.rite(L, day, Math.max(this.sim.abs + 60, day * DAY + RITES.vigil.at));
    }
    const R = RITES[key];
    if (key === 'fair' && s.type === 'village') return null;
    if ((day + 2 + (s.id * 7)) % R.every !== 0) return null;
    return this.rite(L, day);
  }

  // ------------------------------------------------------------ announcing
  // (`soon`, from the command console: it starts then, today, instead.)
  announce(L, kind, day, extra = {}, soon = null) {
    const e = L.econ;
    const id = (e.eventN = (e.eventN || 0) + 1);
    // One do a day: the next free day from the day after tomorrow.
    let d = day + 2;
    while (this.upcoming(L).some((q) => q.day === d)) d++;
    let start = d * DAY + (extra.at ?? START[kind]);
    if (soon !== null) {
      d = Math.floor(soon / DAY);
      start = Math.ceil(Math.max(soon, d * DAY + BUILD_AT + 60) / 30) * 30;
    }
    const ev = {
      id, kind, day: d, s: start, e: start + (extra.len ?? LENGTH[kind]), state: 'announced',
      posters: [], crier: null, site: null, blocks: [], stage: null, strike: null, guests: null, came: 0, ...extra,
    };
    this.list(L).push(ev);
    return ev;
  }

  // Two people to be married, the day after tomorrow.
  wedding(L, a, b, day, soon = null) {
    const officiant = L.npcs.find((r) => r.job === 'priest' && alive(r) && !r.away) || L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.away);
    const ev = this.announce(L, 'wedding', day, { couple: [a.idx, b.idx], host: officiant ? officiant.idx : null }, soon);
    for (const r of [a, b]) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.2);
    ledger(L, day, `${name(a)} and ${name(b)} are to be married on the square on day ${ev.day} at ${hodStr(ev.s % DAY)}. All are welcome.`);
    return ev;
  }

  // The council's feast day, paid for from the treasury.
  feast(L, day, spend, soon = null) {
    const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.away);
    const ev = this.announce(L, 'feast', day, { host: mayor ? mayor.idx : null, spend }, soon);
    ledger(L, day, `The council declared ${festivalName(L.settlement)} for day ${ev.day}${spend ? ` (¤${spend} from the treasury)` : ''}: food, drink and dancing by the square from ${hodStr(ev.s % DAY)}.`);
    return ev;
  }

  // A village that's become a town (or a town a city) celebrates.
  fete(L, day, tier, soon = null) {
    const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.away);
    const ev = this.announce(L, 'fete', day, { host: mayor ? mayor.idx : null, tier }, soon);
    ledger(L, day, `A celebration for ${L.settlement.name} becoming a ${tier} will be held by the square on day ${ev.day} from ${hodStr(ev.s % DAY)}.`);
    return ev;
  }

  // ------------------------------------------------------------ time
  // Moved on to `now` (the end of the hour the town has just lived through).
  hourly(L, now) {
    const list = this.list(L);
    if (!list.length) return;
    const active = this.game.active.has(L.settlement.id);
    for (const ev of list) this.step(L, ev, now, active);
    const today = Math.floor(now / DAY);
    L.econ.events = list.filter((ev) => !((ev.state === 'done' || ev.state === 'off') && ev.day < today - KEEP_DAYS));
  }

  step(L, ev, now, active) {
    const D = ev.day * DAY;
    if (ev.state === 'off' || ev.state === 'done') {
      if (ev.state === 'off') this.tidy(L, ev, now, active);
      return;
    }
    // A wedding with one of the pair gone is off.
    if (ev.kind === 'wedding' && now < ev.s + 30 && !ev.wed) {
      const gone = ev.couple.map((i) => L.npcs[i]).find((r) => !r || !alive(r) || r.migrated);
      if (gone) return this.cancel(L, ev, now);
    }
    if (ev.state === 'announced' && now >= D - DAY + POSTERS_AT) {
      this.postersUp(L, ev, now, active);
      ev.state = 'posting';
    }
    if (ev.state === 'posting' && now >= D - DAY + POSTERS_BY) {
      for (let i = 0; i < ev.posters.length; i++) this.poster(L, ev, i, true, true);
      ev.state = 'posted';
    }
    if (ev.state === 'posted' && now >= D + BUILD_AT) {
      this.build(L, ev, active);
      this.invite(L, ev);
      ev.state = 'building';
    }
    if (ev.state === 'building') {
      // Not finished an hour before? Everyone pitches in.
      // (Behind in a town you're in, they carry on as the guests arrive;
      // elsewhere it's simply up.)
      const p = ev.stage !== null ? this.sim.works.projects.find((q) => q.id === ev.stage) : null;
      if (!p || p.done || now >= ev.s - 60) {
        if (p && !p.done && !active) this.sim.works.finishNow(L, p);
        ev.state = 'ready';
      }
    }
    if ((ev.state === 'building' || ev.state === 'ready' || ev.state === 'on') && ev.guests && now < ev.e - 30) this.gather(L, ev, now);
    if (ev.state === 'ready' && now >= ev.s) {
      ev.state = 'on';
      if (active) this.game.ui.msg(`${cap(this.title(L, ev))} has begun by the square.`, '#ffd0e8');
    }
    if (ev.state === 'on' && ev.kind === 'wedding' && !ev.wed && now >= ev.s + 30) this.wed(L, ev);
    if (ev.state === 'on' && now >= ev.e) this.end(L, ev);
    if (ev.state === 'over') this.tidy(L, ev, now, active);
  }

  // ------------------------------------------------------------ posters
  // A few spots around town where people will see them: by the notice
  // board, the tavern, the temple and the hall, and the roads in.
  posterSpots(L, n) {
    const anchors = [];
    const board = L.signs.find((q) => q.kind === 'board');
    if (board) anchors.push(board);
    for (const t of ['tavern', 'townhall', 'temple', 'shop', 'bakery']) {
      const b = L.buildings.find((q) => q.type === t && q.outside && !q.underConstruction);
      if (b) anchors.push(b.outside);
    }
    anchors.push(...L.entrances);
    const doors = new Set();
    for (const b of L.buildings) if (b.outside) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) doors.add((b.outside.x + dx) * 65536 + b.outside.z + dz);
    const spots = new Set(L.spots.map((q) => q.x * 65536 + q.z));
    const out = [];
    for (const a of anchors) {
      if (out.length >= n) break;
      let best = null;
      for (let r = 1; r <= 4 && !best; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = a.x + dx;
            const z = a.z + dz;
            const k = x * 65536 + z;
            if (doors.has(k) || spots.has(k) || !L.inside(x, z, 1)) continue;
            const m = L.maskAt(x, z);
            if (m !== M.FREE && m !== M.YARD) continue;
            if (!L.isRoadTile(x + 1, z) && !L.isRoadTile(x - 1, z) && !L.isRoadTile(x, z + 1) && !L.isRoadTile(x, z - 1)) continue;
            if (out.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 4)) continue;
            if (!this.clear(L, x, z, 1)) continue;
            const d = Math.abs(dx) + Math.abs(dz);
            if (!best || d < best.d) best = { x, z, d };
          }
        }
      }
      if (best) out.push({ x: best.x, z: best.z, up: false });
    }
    return out;
  }

  // Nothing standing on a tile (up to `h` layers), on firm ground.
  clear(L, x, z, h) {
    const w = this.game.world;
    if (w.regionAt(x, z)) {
      for (let y = GROUND; y < GROUND + h; y++) if (w.getBlock(x, y, z) !== B.air) return false;
      const below = w.getBlock(x, GROUND - 1, z);
      return BLOCKS[below].solid && !BLOCKS[below].liquid;
    }
    const map = this.laid(L);
    for (let y = GROUND; y < GROUND + h; y++) {
      const id = map.get(`${x},${y},${z}`);
      if (id !== undefined && id !== B.air) return false;
    }
    const c = L.col && L.col(x, z);
    return !c || c.water < 0;
  }

  // What the town laid out where (for places not loaded right now), with
  // any changes still waiting to be made there. Kept for a moment.
  laid(L) {
    const now = this.sim.abs;
    if (this.laidCache && this.laidCache.L === L && this.laidCache.t === now) return this.laidCache.map;
    const map = new Map();
    for (const arr of L.placements.values()) for (let i = 0; i < arr.length; i += 5) map.set(`${arr[i]},${arr[i + 1]},${arr[i + 2]}`, arr[i + 3]);
    for (const ops of this.sim.pending.values()) for (const [x, y, z, id] of ops) map.set(`${x},${y},${z}`, id);
    this.laidCache = { L, t: now, map };
    return map;
  }

  // Someone goes round with the posters (in a town you're in: you'll see
  // them do it); elsewhere they just go up.
  postersUp(L, ev, now, active) {
    const n = { village: 3, town: 4, city: 5 }[L.settlement.type] || 3;
    ev.posters = this.posterSpots(L, n);
    const crier = this.crierFor(L, ev);
    ev.crier = crier ? crier.idx : null;
    if (active && crier && ev.posters.length) {
      setOverride(crier, now, ev.day * DAY - DAY + POSTERS_BY, 'poster', { ev: ev.id, mode: 'up', place: 'town', allowMeals: true });
      if (crier.ent && !crier.ent.dead) crier.ent.activity = null;
      return;
    }
    for (let i = 0; i < ev.posters.length; i++) this.poster(L, ev, i, true);
  }

  // A wedding's posters go up by one of the couple; a feast's by whoever
  // keeps the town's records, or somebody with time on their hands.
  crierFor(L, ev) {
    const ok = (r) => r && alive(r) && !r.away && r.age === 'adult' && !r.hired && !(r.override && r.override.e > this.sim.abs && r.override.act !== 'forage');
    if (ev.couple) {
      const c = ev.couple.map((i) => L.npcs[i]).find(ok);
      if (c) return c;
    }
    const pref = ['scholar', 'scribe', 'laborer', 'beggar', 'retired', 'noble'];
    for (const j of pref) {
      const r = L.npcs.find((q) => q.job === j && ok(q));
      if (r) return r;
    }
    return L.npcs.find((q) => ok(q) && q.job !== 'guard' && q.job !== 'mayor') || null;
  }

  // Put up (or take down) poster i. Returns whether anything changed. A
  // spot that's been built on meanwhile is skipped; one somebody's standing
  // on waits (unless `force`).
  poster(L, ev, i, up, force = false) {
    const q = ev.posters[i];
    if (!q) return false;
    const w = this.game.world;
    const loaded = w.regionAt(q.x, q.z);
    if (up) {
      if (q.up || q.down) return false;
      if (loaded && w.getBlock(q.x, GROUND, q.z) !== B.air) {
        q.down = true;
        return false;
      }
      if (loaded && this.game.entityAt(q.x, GROUND, q.z)) {
        if (force) q.down = true;
        return false;
      }
      this.sim.setBlocks([[q.x, GROUND, q.z, B.poster, ev.kind === 'wedding' ? 0 : META_STATE]]);
      q.up = true;
      return true;
    }
    if (q.down) return false;
    q.down = true;
    if (!q.up) return false;
    q.up = false;
    if (!loaded || w.getBlock(q.x, GROUND, q.z) === B.poster) this.sim.setBlocks([[q.x, GROUND, q.z, B.air, 0]]);
    return true;
  }

  // The next poster for the crier to see to.
  nextPoster(L, ev, mode, from) {
    let best = -1;
    let bd = Infinity;
    ev.posters.forEach((q, i) => {
      if (mode === 'up' ? q.up || q.down : q.down || !q.up) return;
      const d = from ? Math.abs(q.x - from.x) + Math.abs(q.z - from.z) : i;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  eventAtPoster(L, x, z) {
    return this.list(L).find((ev) => ev.posters.some((q) => q.x === x && q.z === z && q.up)) || null;
  }

  posterText(L, x, z) {
    const ev = this.eventAtPoster(L, x, z);
    const s = L.settlement;
    if (!ev) return { title: 'POSTER', lines: ['A faded poster.', 'Whatever it was, it\'s over now.'] };
    const when = `Day ${ev.day}, from ${hodStr(ev.s % DAY)}, by the square.`;
    const round = styleOf(s).centreWord.replace(/^an? /, 'the ').replace(/ to dance round$/, '');
    if (ev.kind === 'wedding') {
      const [a, b] = ev.couple.map((i) => L.npcs[i]);
      const lead = ev.host !== null && ev.host !== undefined ? L.npcs[ev.host] : null;
      return {
        title: 'POSTER',
        lines: [
          'YOU ARE INVITED', '', 'to the wedding of', `${name(a).toUpperCase()}`, 'and', `${name(b).toUpperCase()}`, '', when,
          lead ? `${lead.job === 'priest' ? 'Blessed by' : 'Wed by'} ${name(lead)}.` : '', 'All are welcome. Bring flowers!',
        ],
      };
    }
    if (ev.kind === 'rite') {
      const R = RITES[ev.rite];
      return { title: 'POSTER', lines: [...R.poster(s, R.name(s)), when, '', `By the council of ${s.name}.`] };
    }
    if (ev.kind === 'fete') {
      return { title: 'POSTER', lines: [`${s.name.toUpperCase()} IS A ${ev.tier.toUpperCase()}!`, '', 'Come and celebrate with us:', 'food, drink and dancing', `round ${round}.`, '', when, '', `By order of the council of ${s.name}.`] };
    }
    return { title: 'POSTER', lines: [`${festivalName(s).toUpperCase()}!`, `(in honour of ${religionOf(s).god})`, `The council of ${s.name} invites all`, 'to eat, drink and dance', `round ${round}.`, '', when, '', 'Free food for everyone!'] };
  }

  // ------------------------------------------------------------ the stage
  // The best place near the square with room for it.
  findSite(L, kind) {
    const p = L.plaza;
    const spots = new Set(L.spots.map((q) => q.x * 65536 + q.z));
    const doors = new Set();
    for (const b of L.buildings) if (b.outside) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) doors.add((b.outside.x + dx) * 65536 + b.outside.z + dz);
    const okTile = (x, z, h) => {
      if (!L.inside(x, z, 1)) return false;
      const m = L.maskAt(x, z);
      if (m !== M.PLAZA && m !== M.FREE && m !== M.YARD && m !== M.ROAD) return false;
      const k = x * 65536 + z;
      if (spots.has(k) || doors.has(k)) return false;
      return this.clear(L, x, z, h);
    };
    for (const key of PLANS[kind]) {
      const dsn = DESIGNS[key];
      const tall = dsn.blocks.some((q) => q[1] >= 2) ? 3 : 2;
      let best = null;
      for (let z0 = p.z0 - 16; z0 <= p.z1 + 16 - dsn.d + 1; z0++) {
        for (let x0 = p.x0 - 16; x0 <= p.x1 + 16 - dsn.w + 1; x0++) {
          let ok = true;
          let roads = 0;
          for (let dz = 0; dz < dsn.d && ok; dz++) {
            for (let dx = 0; dx < dsn.w && ok; dx++) {
              ok = okTile(x0 + dx, z0 + dz, tall);
              const m = ok ? L.maskAt(x0 + dx, z0 + dz) : -1;
              if (m === M.ROAD) roads++;
              else if (m === M.YARD) roads += 0.1;
            }
          }
          if (!ok) continue;
          // Room round the edge to stand (and not up against the city wall).
          let room = 0;
          for (let dz = -1; dz <= dsn.d; dz++) {
            for (let dx = -1; dx <= dsn.w; dx++) {
              if (dz >= 0 && dz < dsn.d && dx >= 0 && dx < dsn.w) continue;
              const m = L.maskAt(x0 + dx, z0 + dz);
              if (m === M.WALL) ok = false;
              else if (m !== M.WATER && m !== M.FIELD && m !== M.BUILD) room++;
            }
          }
          if (!ok || room < dsn.w + dsn.d) continue;
          const score = Math.hypot(x0 + dsn.w / 2 - p.cx, z0 + dsn.d / 2 - p.cz) + roads * 1.5;
          if (!best || score < best.score) best = { x0, z0, score };
        }
      }
      if (best) return { key, x0: best.x0, z0: best.z0, x1: best.x0 + dsn.w - 1, z1: best.z0 + dsn.d - 1 };
    }
    return null;
  }

  build(L, ev, active) {
    void active;
    const site = this.findSite(L, ev.kind === 'rite' ? `rite:${ev.rite}` : ev.kind);
    ev.site = site;
    const look = styleOf(L.settlement);
    const palette = ev.kind === 'wedding' ? WEDDING_PALETTE : ev.kind === 'rite' ? RITES[ev.rite].palette : look.palette;
    const stage = [];
    if (site) {
      const dsn = DESIGNS[site.key];
      for (const [dx, dy, dz, k, meta = 0] of this.dress(dsn, look, palette)) stage.push([site.x0 + dx, GROUND + dy, site.z0 + dz, B[k], meta]);
      // Lower things first, so the posts stand before the bunting goes up.
      stage.sort((a, b) => a[1] - b[1]);
    }
    // ...then round town.
    const decor = this.decorFor(L, ev, palette, stage);
    ev.blocks = [...stage, ...decor];
    ev.decorN = decor.length;
    if (!ev.blocks.length) return;
    const what = site ? this.what(site.key, look) : null;
    const label = `putting up ${what ? `${what} by the square${decor.length ? ', and more all round town,' : ''}` : 'bunting and banners round town'} for ${this.title(L, ev)}`;
    const pz = L.plaza;
    const bounds = site ? { x0: site.x0, z0: site.z0, x1: site.x1, z1: site.z1 } : { x0: pz.x0, z0: pz.z0, x1: pz.x1, z1: pz.z1 };
    // (Builders put it up piece by piece, here or while you're away.)
    const p = this.sim.works.add({ sid: L.settlement.id, kind: 'stage', blocks: ev.blocks, bounds, label, ev: ev.id });
    ev.stage = p.id;
  }

  // What goes up on the square, the way these people do it.
  what(key, look) {
    return DESIGNS[key].what.replace('a maypole', look.centreWord);
  }

  dress(dsn, look, palette) {
    const out = [];
    for (const [dx, dy, dz, k, meta = 0] of dsn.blocks) {
      if (k === 'maypole') look.centre.forEach(([ck, cm = 0], i) => out.push([dx, dy + i, dz, ck, cm]));
      else if (k === 'lantern') out.push([dx, dy, dz, look.light[0], look.light[1] ?? 0]);
      else if (k === 'bunting') out.push([dx, dy, dz, 'bunting', decorMeta(palette, meta)]);
      else out.push([dx, dy, dz, k, meta]);
    }
    // Rugs laid round the dancers in the south; flowers where people
    // stand in the jungle.
    if (dsn.ring && look.rugs) RING.forEach(([rx, rz], i) => out.push([dsn.ring.dx + rx, 0, dsn.ring.dz + rz, look.rugs[i % look.rugs.length]]));
    if (dsn.stand && look.flowers) dsn.stand.slice(0, 4).forEach((q, i) => out.push([q.dx, 0, q.dz, look.flowers[i % look.flowers.length]]));
    return out;
  }

  // All over town: bunting strung across the streets from house to house,
  // and banners by the doors of the hall, the tavern and the temple and at
  // the roads in (more for a town's own celebration). A wedding's are
  // white and pink, with flowers at the couple's door.
  decorFor(L, ev, palette, stage) {
    const w = this.game.world;
    const s = L.settlement;
    const tier = { village: 0, town: 1, city: 2 }[s.type] ?? 0;
    const strings = [3, 6, 10][tier];
    const banners = [3, 5, 8][tier] + (ev.kind === 'fete' ? 3 : 0);
    const used = new Set(stage.map(([x, , z]) => x * 65536 + z));
    if (ev.site) for (let z = ev.site.z0 - 1; z <= ev.site.z1 + 1; z++) for (let x = ev.site.x0 - 1; x <= ev.site.x1 + 1; x++) used.add(x * 65536 + z);
    const blocked = new Set([M.BUILD, M.WALL, M.WATER, M.FIELD]);
    const air = (x, y, z) => !w.regionAt(x, z) || w.getBlock(x, y, z) === B.air;
    const open = (x, z, high = false) => L.inside(x, z, 0) && !blocked.has(L.maskAt(x, z)) && !used.has(x * 65536 + z) && (high ? air(x, GROUND + 2, z) : air(x, GROUND, z) && air(x, GROUND + 1, z));
    const wallAt = (x, z) => L.maskAt(x, z) === M.BUILD && (!w.regionAt(x, z) || (BLOCKS[w.getBlock(x, GROUND + 2, z)] || {}).solid);
    const out = [];
    // Strings across the street: a straight run of open air at head
    // height with a house wall at each end.
    const spans = [];
    const seen = new Set();
    for (let z = L.bounds.z0; z <= L.bounds.z1; z++) {
      for (let x = L.bounds.x0; x <= L.bounds.x1; x++) {
        if (!L.isRoadTile(x, z)) continue;
        for (const [ax, az, rot] of [[1, 0, 0], [0, 1, 1]]) {
          let a = 0;
          let b = 0;
          while (a < 6 && open(x - ax * (a + 1), z - az * (a + 1), true)) a++;
          while (b < 6 && open(x + ax * (b + 1), z + az * (b + 1), true)) b++;
          const len = a + b + 1;
          if (len < 2 || len > 7 || !open(x, z, true)) continue;
          if (!wallAt(x - ax * (a + 1), z - az * (a + 1)) || !wallAt(x + ax * (b + 1), z + az * (b + 1))) continue;
          const x0 = x - ax * a;
          const z0 = z - az * a;
          const key = `${x0},${z0},${rot}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const tiles = [];
          for (let k = 0; k < len; k++) tiles.push([x0 + ax * k, z0 + az * k]);
          spans.push({ tiles, rot, cx: x0 + (ax * (len - 1)) / 2, cz: z0 + (az * (len - 1)) / 2 });
        }
      }
    }
    const pz = L.plaza;
    const jitter = (q) => hash4(s.seed, ev.id, Math.round(q.cx), Math.round(q.cz)) % 7;
    spans.sort((a, b) => Math.hypot(a.cx - pz.cx, a.cz - pz.cz) + jitter(a) - (Math.hypot(b.cx - pz.cx, b.cz - pz.cz) + jitter(b)));
    const chosen = [];
    for (const sp of spans) {
      if (chosen.length >= strings) break;
      if (chosen.some((q) => Math.hypot(q.cx - sp.cx, q.cz - sp.cz) < 6)) continue;
      chosen.push(sp);
      for (const [x, z] of sp.tiles) {
        out.push([x, GROUND + 2, z, B.bunting, decorMeta(palette, sp.rot)]);
      }
    }
    // Banners beside the doors that matter, and at the roads in.
    const spots = [];
    for (const t of ['townhall', 'tavern', 'temple', 'shop', 'guardhouse', 'library']) {
      const b = L.buildings.find((q) => q.type === t && q.outside && !q.underConstruction);
      if (b) spots.push(b.outside);
    }
    for (const e of L.entrances || []) spots.push(e);
    const bmeta = decorMeta(palette);
    let n = 0;
    for (const at of spots) {
      if (n >= banners) break;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, 1], [1, 2], [-1, 2]]) {
        const x = at.x + dx;
        const z = at.z + dz;
        if (!open(x, z) || L.isRoadTile(x, z) || L.spots.some((q) => q.x === x && q.z === z)) continue;
        out.push([x, GROUND, z, B.festival_banner, bmeta]);
        used.add(x * 65536 + z);
        n++;
        break;
      }
    }
    // Flowers at the couple's door.
    if (ev.couple) {
      const home = L.buildings[L.npcs[ev.couple[0]]?.home];
      if (home && home.outside) {
        let f = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [1, 1], [-1, 1]]) {
          const x = home.outside.x + dx;
          const z = home.outside.z + dz;
          if (f >= 2 || !open(x, z) || L.isRoadTile(x, z)) continue;
          out.push([x, GROUND, z, f ? B.flower_red : B.flower_white, 0]);
          used.add(x * 65536 + z);
          f++;
        }
      }
    }
    // In the order someone would walk round putting it up, from the square.
    const order = [];
    let cur = { x: pz.cx, z: pz.cz };
    const left = out.slice();
    while (left.length) {
      let bi = 0;
      for (let i = 1; i < left.length; i++) if (Math.abs(left[i][0] - cur.x) + Math.abs(left[i][2] - cur.z) < Math.abs(left[bi][0] - cur.x) + Math.abs(left[bi][2] - cur.z)) bi = i;
      const [op] = left.splice(bi, 1);
      order.push(op);
      cur = { x: op[0], z: op[2] };
    }
    return order;
  }

  free([x, y, z]) {
    const w = this.game.world;
    return !w.regionAt(x, z) || w.getBlock(x, y, z) === B.air;
  }

  // Take it all down: the builders in the morning (or all at once elsewhere).
  strike(L, ev, active) {
    if (ev.strike !== null) return;
    ev.strike = -1;
    if (!ev.blocks.length) return;
    const w = this.game.world;
    const still = ([x, y, z, id]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === id;
    const down = ([x, y, z]) => [x, y, z, B.air, 0];
    const n = ev.blocks.length - (ev.decorN || 0);
    // Top first on the square: bunting and lanterns before the posts under
    // them. Then round town the way it went up.
    const ops = ev.blocks.slice(0, n).filter(still).map(down);
    ops.sort((a, b) => b[1] - a[1]);
    ops.push(...ev.blocks.slice(n).filter(still).map(down));
    if (!ops.length) return;
    const look = styleOf(L.settlement);
    const pz = L.plaza;
    const bounds = ev.site ? { x0: ev.site.x0, z0: ev.site.z0, x1: ev.site.x1, z1: ev.site.z1 } : { x0: pz.x0, z0: pz.z0, x1: pz.x1, z1: pz.z1 };
    const label = ev.site ? `taking down the ${this.what(ev.site.key, look).replace(/^an? /, '')} by the square${ev.decorN ? ', and the bunting round town' : ''}` : 'taking down the bunting round town';
    const p = this.sim.works.add({ sid: L.settlement.id, kind: 'strike', blocks: ops, bounds, label, ev: ev.id });
    ev.strike = p.id;
  }

  // ------------------------------------------------------------ who goes
  relation(L, rec, o) {
    if (!o || rec === o) return null;
    if (rec.partner === o.idx || rec.parents.includes(o.idx) || o.parents.includes(rec.idx) || (rec.household != null && rec.household === o.household)) return 'family';
    if (rec.parents.some((i) => o.parents.includes(i))) return 'family';
    if ((rec.friends || []).includes(o.idx) || (o.friends || []).includes(rec.idx)) return 'friend';
    if (rec.work && o.work && rec.work.building != null && rec.work.building === o.work.building) return 'work';
    return null;
  }

  // How likely someone is to go (0 to 1).
  pull(L, ev, rec) {
    if (!alive(rec) || rec.away || rec.migrated || rec.visitor || rec.hired || rec.traveler) return 0;
    if (ev.couple && ev.couple.includes(rec.idx)) return 1;
    if (rec.idx === ev.host) return 1;
    const pers = rec.personality || {};
    let p = ev.kind === 'rite' ? RITES[ev.rite].pull : { wedding: 0.38, feast: 0.52, fete: 0.66 }[ev.kind];
    if (ev.couple) {
      const rels = ev.couple.map((i) => this.relation(L, rec, L.npcs[i]));
      p += rels.includes('family') ? 0.6 : rels.includes('friend') ? 0.4 : rels.includes('work') ? 0.15 : 0;
    }
    p += ((pers.sociability ?? 0.5) - 0.5) * 0.8;
    const mood = rec.mood ?? 0.5;
    p += (mood - 0.5) * 0.7;
    if (mood < 0.25) p -= 0.2;
    for (const t of rec.traits || []) p += (TRAIT_PULL[t] || 0) + (TRAIT_PULL_KIND[ev.kind][t] || 0);
    if ((rec.grief || []).some((g) => g.rel !== 'acquaintance')) p -= 0.35;
    const hp = rec.ent && !rec.ent.dead ? rec.ent.hp : rec.hp ?? rec.maxHp;
    if (hp < (rec.maxHp || 12) * 0.4 || rec.sick) p -= 0.4;
    // The watch mostly stays at its posts (the night watch is asleep).
    if (rec.job === 'guard') p = rec.shift === 'night' ? 0 : Math.min(p, 0.3);
    if (rec.shift === 'night') p -= 0.25;
    return clamp(p, 0, 0.97);
  }

  roll(L, ev, rec) {
    return (hash4(L.settlement.seed, ev.id, rec.idx, 0xe7e) % 1000) / 1000;
  }

  // Whether someone means to go (children go if a parent is going).
  going(L, ev, rec) {
    if (rec.age === 'child') {
      const par = rec.parents.map((i) => L.npcs[i]).filter((q) => q && alive(q));
      if (par.some((q) => q.age !== 'child' && this.roll(L, ev, q) < this.pull(L, ev, q))) return this.roll(L, ev, rec) < 0.9;
      return this.roll(L, ev, rec) < this.pull(L, ev, rec) - 0.15;
    }
    return this.roll(L, ev, rec) < this.pull(L, ev, rec);
  }

  // Who's coming, when they set off, and where they'll stand.
  invite(L, ev) {
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
    const coming = people.filter((r) => this.going(L, ev, r));
    const site = ev.site;
    const dsn = site ? DESIGNS[site.key] : null;
    const pos = (q) => ({ x: site.x0 + q.dx, z: site.z0 + q.dz, face: q.face });
    const taken = new Set();
    const guests = [];
    const place = (r, role, spot, extra = {}) => {
      if (spot) taken.add(spot.x * 65536 + spot.z);
      guests.push({ idx: r.idx, role, x: spot ? spot.x : null, z: spot ? spot.z : null, face: spot ? spot.face : 2, leave: this.leaveTime(L, ev, r, role), set: false, ...extra });
    };
    const w = this.game.world;
    const standable = (x, z) => L.inside(x, z, 1) && ![M.BUILD, M.WALL, M.WATER, M.FIELD].includes(L.maskAt(x, z)) && (!w.regionAt(x, z) || w.findStandY(x, z, GROUND) === GROUND);
    const free = (list) => (list || []).map(pos).filter((q) => !taken.has(q.x * 65536 + q.z) && standable(q.x, q.z));
    // At a wedding, those standing keep a little room round them.
    const roomy = (x, z) => ev.kind !== 'wedding' || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => taken.has((x + dx) * 65536 + z + dz));
    const rest = [];
    const couple = ev.couple ? ev.couple.map((i) => L.npcs[i]) : [];
    const close = (r) => couple.some((c) => this.relation(L, r, c) === 'family') ? 2 : couple.some((c) => this.relation(L, r, c) === 'friend') ? 1 : 0;
    for (const r of coming) {
      if (!site) {
        place(r, 'guest', null);
        continue;
      }
      if (ev.couple && ev.couple.includes(r.idx)) {
        place(r, 'couple', pos(dsn.couple[ev.couple.indexOf(r.idx)]));
        continue;
      }
      if (r.idx === ev.host) {
        place(r, 'lead', pos(dsn.lead));
        continue;
      }
      rest.push(r);
    }
    // Family and friends get the best seats; then the old; then whoever.
    rest.sort((a, b) => close(b) - close(a) || (b.age === 'elder') - (a.age === 'elder') || a.idx - b.idx);
    const dancers = () => guests.filter((g) => g.role === 'dance').length;
    for (const r of rest) {
      if (!site) break;
      const serving = ev.kind !== 'wedding' && ['cook', 'innkeeper', 'barkeep', 'baker'].includes(r.job);
      const dancer = ev.kind !== 'wedding' && (r.age === 'child' || (r.age === 'adult' && ((r.personality?.sociability ?? 0.5) > 0.6 || (r.traits || []).includes('cheerful'))));
      let spot = null;
      let role = 'guest';
      if (serving && dsn.serve) {
        [spot] = free(dsn.serve);
        if (spot) role = 'serve';
      }
      if (!spot && dancer && dsn.ring && dancers() < RING.length - 2) {
        const [dx, dz] = RING[dancers()];
        const x = site.x0 + dsn.ring.dx + dx;
        const z = site.z0 + dsn.ring.dz + dz;
        if (standable(x, z)) {
          spot = { x, z, face: 2 };
          role = 'dance';
        }
      }
      if (!spot && dsn.seats) {
        [spot] = free(dsn.seats);
        if (spot) role = 'seat';
      }
      if (!spot && dsn.dine) {
        [spot] = free(dsn.dine);
        if (spot) role = 'dine';
      }
      if (!spot) [spot] = free(dsn.stand).filter((q) => roomy(q.x, q.z));
      if (!spot) {
        // Somewhere round the edge.
        for (let r2 = 1; r2 <= (ev.kind === 'wedding' ? 7 : 4) && !spot; r2++) {
          for (let dz = -r2; dz <= dsn.d - 1 + r2 && !spot; dz++) {
            for (let dx = -r2; dx <= dsn.w - 1 + r2 && !spot; dx++) {
              if (dz > -r2 && dz < dsn.d - 1 + r2 && dx > -r2 && dx < dsn.w - 1 + r2) continue;
              const x = site.x0 + dx;
              const z = site.z0 + dz;
              if (!taken.has(x * 65536 + z) && standable(x, z) && roomy(x, z)) spot = { x, z, face: dz < 0 ? 0 : dx < 0 ? 3 : dx >= dsn.w ? 1 : 2 };
            }
          }
        }
      }
      place(r, role, spot);
    }
    // Children set off with the parent who's going.
    for (const g of guests) {
      const r = L.npcs[g.idx];
      if (r.age !== 'child') continue;
      const par = guests.find((q) => r.parents.includes(q.idx));
      if (par) g.leave = par.leave + 1;
    }
    ev.guests = guests;
    ev.invited = people.length;
  }

  // The couple and whoever's leading it are there early; the rest drift in
  // over the hour or so before (the keen and the early risers first, the
  // lazy and the scatterbrained a bit late).
  leaveTime(L, ev, r, role) {
    const h = hash4(L.settlement.seed, ev.id, r.idx, 0x1ea);
    if (role === 'couple' || role === 'lead') return ev.s - 60 - (h % 25);
    if (role === 'serve') return ev.s - 70 - (h % 20);
    const tr = r.traits || [];
    let off = 12 + (h % 55);
    if (tr.includes('early riser') || (r.personality?.diligence ?? 0.5) > 0.7) off += 20;
    if (tr.includes('lazy') || tr.includes('absent-minded') || tr.includes('night owl')) off -= 22;
    if (this.relation(L, r, ev.couple ? L.npcs[ev.couple[0]] : null) === 'family' || this.relation(L, r, ev.couple ? L.npcs[ev.couple[1]] : null) === 'family') off += 15;
    return ev.s - off;
  }

  // Send people on their way as their time comes (an hour ahead at most, so
  // what they're doing till then isn't cut short).
  gather(L, ev, now) {
    for (const g of ev.guests) {
      if (g.set || g.leave >= now + 60) continue;
      const r = L.npcs[g.idx];
      if (!r || !alive(r) || r.away || r.hired) continue;
      const o = r.override;
      if (o && o.e > now && ['trial', 'bury', 'funeral', 'repair', 'watch', 'alarm', 'travel', 'customer', 'confront'].includes(o.act)) continue;
      if (o && o.e > now && o.act === 'build' && o.project !== undefined && o.project !== ev.stage) continue;
      g.set = true;
      const s = Math.max(g.leave, now - 60);
      const target = g.x !== null ? { x: g.x, z: g.z } : { x: L.plaza.cx + ((g.idx % 5) - 2), z: L.plaza.cz + 2 + (g.idx % 3) };
      setOverride(r, s, ev.e, 'event', { ev: ev.id, kind: ev.kind, role: g.role, target, face: g.face, seat: g.role === 'seat', place: 'square' });
      if (r.ent && !r.ent.dead && s <= this.sim.abs) r.ent.activity = null;
    }
  }

  // ------------------------------------------------------------ the day
  wed(L, ev) {
    ev.wed = true;
    const [a, b] = ev.couple.map((i) => L.npcs[i]);
    if (!a || !b || !alive(a) || !alive(b)) return;
    marry(L, a, b);
    const came = this.cameCount(L, ev);
    ledger(L, ev.day, `${name(a)} and ${name(b)} were married by the square; ${came} came to wish them well.`);
    L.econ.lastWedding = ev.day;
  }

  cameCount(L, ev) {
    return (ev.guests || []).filter((g) => g.set && L.npcs[g.idx] && alive(L.npcs[g.idx])).length;
  }

  end(L, ev) {
    ev.state = 'over';
    const came = this.cameCount(L, ev);
    ev.came = came;
    const lift = ev.kind === 'wedding' ? 0.1 : 0.15;
    for (const g of ev.guests || []) {
      const r = L.npcs[g.idx];
      if (!r || !alive(r) || !g.set) continue;
      r.mood = Math.min(1, (r.mood ?? 0.5) + lift);
      // Nobody goes home hungry from a feast (or a wedding).
      r.fed = 1;
      r.hungry = 0;
    }
    if (ev.kind !== 'wedding') {
      L.econ.lastFeast = ev.day;
      ledger(L, ev.day, ev.kind === 'fete' ? `${came} people turned out by the square to celebrate ${L.settlement.name} becoming a ${ev.tier}.` : `${cap(this.title(L, ev))} by the square drew ${came} people.`);
    }
    // You came along: they won't forget it.
    if (ev.playerCame) {
      const sid = L.settlement.id;
      const thank = ev.couple ? ev.couple.map((i) => L.npcs[i]) : ev.host !== null && ev.host !== undefined ? [L.npcs[ev.host]] : [];
      for (const r of thank) if (r && alive(r)) this.bump(sid, r, ev.couple ? 4 : 2);
      for (const g of (ev.guests || []).slice(0, 12)) if (g.set) this.bump(sid, L.npcs[g.idx], 1);
    }
  }

  bump(sid, rec, n) {
    const e = this.sim.repEntry(sid, rec.idx);
    e.v = clamp(e.v + n, -100, 100);
    this.sim.areaCache.delete(sid);
  }

  // After it's over (or called off): the builders take it down the next
  // morning, and the posters come down.
  tidy(L, ev, now, active) {
    if (ev.tidied) return;
    if (ev.tidyDay === undefined) ev.tidyDay = ev.state === 'off' ? Math.floor(now / DAY) + (now % DAY >= POSTERS_BY ? 1 : 0) : ev.day + 1;
    const T = ev.tidyDay * DAY;
    if (now >= T + STRIKE_AT) this.strike(L, ev, active);
    if (now >= T + POSTERS_AT && !ev.downSet) {
      ev.downSet = true;
      const crier = ev.crier !== null && ev.crier !== undefined ? L.npcs[ev.crier] : null;
      if (active && ev.posters.some((q) => q.up) && crier && alive(crier) && !crier.away && !(crier.override && crier.override.e > now)) {
        setOverride(crier, now, T + POSTERS_BY, 'poster', { ev: ev.id, mode: 'down', place: 'town', allowMeals: true });
        if (crier.ent && !crier.ent.dead) crier.ent.activity = null;
      } else for (let i = 0; i < ev.posters.length; i++) this.poster(L, ev, i, false);
    }
    if (now < T + POSTERS_BY) return;
    for (let i = 0; i < ev.posters.length; i++) this.poster(L, ev, i, false);
    this.strike(L, ev, active);
    const p = ev.strike > 0 ? this.sim.works.projects.find((q) => q.id === ev.strike) : null;
    // Builders in a town you're in get the day; elsewhere it's just done.
    if (p && !p.done && (!active || now >= T + 1140)) this.sim.works.finishNow(L, p);
    if (!p || p.done) {
      ev.tidied = true;
      if (ev.state === 'over') ev.state = 'done';
    }
  }

  cancel(L, ev, now) {
    ev.state = 'off';
    const [a, b] = ev.couple.map((i) => L.npcs[i]);
    ledger(L, Math.floor(now / DAY), `The wedding of ${name(a)} and ${name(b)} was called off.`);
    for (const g of ev.guests || []) {
      const r = L.npcs[g.idx];
      if (r && r.override && r.override.act === 'event' && r.override.ev === ev.id) {
        r.override = null;
        if (r.ent) r.ent.activity = null;
      }
    }
    // Half-built? The builders down tools (and take down what's up).
    const p = ev.stage ? this.sim.works.projects.find((q) => q.id === ev.stage) : null;
    if (p && !p.done) this.sim.works.abandon(L, p);
  }

  // ------------------------------------------------------------ in town
  // (Called often in a town you're in.) Did you come along?
  update() {
    const p = this.game.player;
    for (const { layout: L } of this.game.active.values()) {
      for (const ev of L.econ.events || []) {
        if (ev.state !== 'on' || ev.playerCame || p.dead) continue;
        const s = ev.site || { x0: L.plaza.cx - 2, z0: L.plaza.cz - 2, x1: L.plaza.cx + 2, z1: L.plaza.cz + 2 };
        if (p.x >= s.x0 - 3 && p.x <= s.x1 + 3 && p.z >= s.z0 - 3 && p.z <= s.z1 + 3) {
          ev.playerCame = true;
          this.game.ui.msg(ev.couple ? 'You join the wedding guests.' : 'You join the celebration.', '#ffd0e8');
        }
      }
    }
  }

  // What's said and done, and when (minutes from the start).
  beats(L, ev) {
    const town = L.settlement.name;
    if (ev.kind === 'wedding') {
      const [a, b] = ev.couple.map((i) => L.npcs[i].name.first);
      return [
        { t: -8, who: 'lead', say: 'Take your places, everyone. It\'s nearly time!' },
        { t: 0, who: 'lead', say: `Friends! We're gathered here for ${a} and ${b}.` },
        { t: 4, who: 'lead', say: `${a}, will you have ${b}, in fair days and foul?` },
        { t: 7, who: 0, say: 'I will.' },
        { t: 10, who: 'lead', say: `And ${b}, will you have ${a}?` },
        { t: 13, who: 1, say: 'I will!' },
        { t: 16, who: 'lead', say: `Then before all of ${town}, I declare you wed!` },
        { t: 17, who: 'couple', kiss: true },
        { t: 18, who: 'crowd', cheer: ['Hooray!', 'Congratulations!', 'Huzzah!', 'To the happy couple!', '*sniff* Beautiful...'] },
        { t: 26, who: 'lead', say: 'Now, eat, drink and be merry!' },
      ];
    }
    if (ev.kind === 'rite') return RITES[ev.rite].beats(town);
    return [
      { t: 0, who: 'lead', say: ev.kind === 'fete' ? `${town} is a ${ev.tier} now! Let's celebrate!` : 'Welcome, all! Eat, drink and dance!' },
      { t: 2, who: 'crowd', cheer: ['Hooray!', 'Huzzah!', `To ${town}!`, 'Hear, hear!'] },
      { t: 90, who: 'lead', say: 'A toast! To all of us, and many more days like this!' },
      { t: 91, who: 'crowd', cheer: ['Cheers!', 'Hear, hear!', 'To us!'] },
    ];
  }

  // Run the ceremony along (in a town you're in). Beats long past are
  // skipped, not said all at once.
  ceremony(L, ev, t, lead) {
    const beats = this.beats(L, ev);
    let k = ev.beat ?? -1;
    if (k + 1 >= beats.length || t < beats[k + 1].t) return;
    while (k + 1 < beats.length && t >= beats[k + 1].t) k++;
    ev.beat = k;
    const b = beats[k];
    if (t - b.t > 3) return;
    const game = this.game;
    const couple = (ev.couple || []).map((i) => L.npcs[i]?.ent).filter((e) => e && !e.dead && e.act === 'event');
    const near = lead.distTo(game.player) < 20;
    if (b.who === 'lead') lead.say(b.say, 3.5, '#ffe8f0');
    else if (typeof b.who === 'number') couple[b.who]?.say(b.say, 3, '#ffd0e8');
    else if (b.kiss && couple.length === 2) {
      couple[0].face(couple[1].x, couple[1].z);
      couple[1].face(couple[0].x, couple[0].z);
      const x = (couple[0].x + couple[1].x) / 2;
      const z = (couple[0].z + couple[1].z) / 2;
      game.renderer.emit(x, GROUND + 1, z, { n: 14, color: ['#ff6a8a', '#ff9ad0', '#ffffff'], up: 30, life: 1.4, gravity: -12 });
      if (near) game.audio?.play('fanfare');
    } else if (b.cheer) {
      const crowd = game.npcs.filter((n) => !n.dead && n.layout === L && n.act === 'event' && n.rec.override && n.rec.override.ev === ev.id && n.atGoal && n !== lead);
      for (const n of crowd) {
        if (!n.rng.chance(0.45)) continue;
        n.doAction(0.3);
        if (n.rng.chance(0.6)) n.say(n.rng.pick(b.cheer), 2.5);
      }
      const s = ev.site;
      if (s) game.renderer.emit((s.x0 + s.x1) / 2, GROUND + 2, (s.z0 + s.z1) / 2, { n: 24, color: ev.kind === 'wedding' ? ['#ff9ad0', '#ffffff', '#f0d040'] : ['#c83a32', '#e0b030', '#3264c0', '#3c9a48'], up: 40, speed: 60, life: 1.6, gravity: 30 });
    }
  }

  // The next place round the maypole (clockwise), for a dancer.
  danceStep(ev, x, z) {
    const s = ev.site;
    const dsn = s && DESIGNS[s.key];
    if (!dsn || !dsn.ring) return null;
    const cx = s.x0 + dsn.ring.dx;
    const cz = s.z0 + dsn.ring.dz;
    const k = RING.findIndex(([dx, dz]) => cx + dx === x && cz + dz === z);
    if (k < 0) return { x: cx + RING[0][0], z: cz + RING[0][1], face: 3 };
    const [dx, dz] = RING[(k + 1) % RING.length];
    const [ex, ez] = RING[(k + 2) % RING.length];
    return { x: cx + dx, z: cz + dz, face: Math.abs(ex - dx) > Math.abs(ez - dz) ? (ex > dx ? 3 : 1) : ez > dz ? 0 : 2 };
  }

  // Small talk at the do.
  chatter(L, ev, rec, role, t) {
    const town = L.settlement.name;
    const child = rec.age === 'child';
    if (ev.kind === 'wedding') {
      const [a, b] = ev.couple.map((i) => L.npcs[i].name.first);
      if (role === 'couple') return t < 0 ? ['I\'m so nervous...', 'Is my hair all right?', 'Here we go...', 'Look at everyone who came!'] : t > 20 ? ['We did it!', 'Thank you all for coming!', 'Best day of my life.'] : null;
      if (role === 'lead') return t > 20 ? ['A fine match, those two.', 'Enjoy yourselves, everyone!'] : null;
      if (t >= 0 && t < 20) return ['*sniff*', 'Shh!'];
      if (t < 0) return child ? ['Is it starting yet?', 'I\'m bored...', 'Will there be cake?'] : ['I do love a wedding.', 'Isn\'t it lovely?', `${a} looks so happy.`, 'Who made the arch? Gorgeous.', 'Nearly time!', `I always knew ${a} and ${b} would end up together.`];
      return child ? ['Cake!', 'Can we go home now?', 'Yuck, kissing.'] : ['To the happy couple!', 'What a lovely ceremony.', 'I cried the whole way through.', 'They make a fine pair.', 'Pass the cake!'];
    }
    if (t < 0) return ['Smells wonderful!', 'Save me a place!', 'Is the music starting?', `Look at ${styleOf(L.settlement).centreWord.replace(/^an? /, 'the ').replace(/ to dance round$/, '')}!`, 'Look at all the bunting!'];
    if (role === 'serve') return ['Who\'s hungry?', 'Plenty more where that came from!', 'Mind, it\'s hot!', 'Bread\'s fresh this morning.'];
    if (role === 'dine') return ['Pass the bread!', 'This roast is wonderful.', 'Another tankard over here!', 'I\'ll never eat again. Until supper.'];
    if (role === 'lead') return ['Enjoy yourselves, everyone!', 'A fine turnout!', `Good people, ${town}.`];
    return child ? ['Can I dance too?', 'Look at them go round!', 'This is the best day ever!'] : ['What a day!', `To ${town}!`, 'Look at them dance!', 'Best feast in years.', 'Somebody fetch a fiddle!'];
  }

  // What someone going says about it (or why they aren't going).
  plansOf(L, rec) {
    const today = this.game.day;
    const ev = this.upcoming(L).find((q) => q.day >= today && q.day <= today + 2);
    if (!ev) return null;
    return { ev, going: this.going(L, ev, rec), when: ev.day === today ? 'today' : ev.day === today + 1 ? 'tomorrow' : 'the day after tomorrow' };
  }
}

// Two people wed: they set up home in the roomier of their two houses
// (children too).
export function marry(L, a, b) {
  a.partner = b.idx;
  b.partner = a.idx;
  const ha = L.buildings[a.home];
  const hb = L.buildings[b.home];
  const room = (h) => (h ? h.beds.length - L.npcs.filter((r) => r.home === h.id && alive(r) && !r.migrated).length : -99);
  const [stay, move] = room(hb) > room(ha) ? [b, a] : [a, b];
  if (stay.home !== null && stay.home !== undefined) {
    const kids = L.npcs.filter((r) => alive(r) && r.age === 'child' && r.parents.includes(move.idx) && r.home === move.home);
    for (const r of [move, ...kids]) {
      r.home = stay.home;
      r.household = stay.household;
      r.bed = L.npcs.filter((q) => q.home === stay.home && alive(q)).length % Math.max(1, L.buildings[stay.home]?.beds.length || 1);
    }
  }
  for (const r of [a, b]) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.3);
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}
