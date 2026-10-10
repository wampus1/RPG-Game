// (Round 78) Ships of your own design, drawn up at a shipwright's bench:
// how long she is and how broad, how many decks she has below, what rooms
// (a raised quarterdeck, or a cabin under it, and a great cabin over that;
// a forecastle, or a galley under it), her masts and how each is rigged,
// her guns (on her deck, and a gun deck below), stalls for horses and
// room for wagons, her hold, and her colours, her paint and her sails.
// What she'll do (her speed, how she turns, her crew) and what she costs
// follow from it. A design, once drawn up, is a kind of ship like any
// other (a SHIP_TYPES entry: see world/shipmodels.js, which builds her
// cell by cell from it), kept with the world; the bench turns out a ship
// in a bottle of it ("shipd~<id>": see world/items.js).
import { SHIP_TYPES, DESIGNS } from '../world/shipmodels.js';
import { ITEMS } from '../world/items.js';

export const DESIGN_TYPE = 'design_';
export const RIGS = ['sloop', 'gaff', 'square2', 'square3', 'lateen', 'mizzen'];
export const RIG_NAMES = { sloop: 'gaff main and jib', gaff: 'gaff sail', square2: 'two square sails', square3: 'three square sails', lateen: 'lateen', mizzen: 'mizzen' };
const RIG_PULL = { sloop: 1, gaff: 0.9, square2: 1.1, square3: 1.4, lateen: 0.7, mizzen: 0.8 };
export const LIMITS = { L: [14, 36], W: [7, 13], masts: [1, 3], deckGuns: [0, 6], hold: [1, 8] };

// A fresh design, to start from: a sloop, near enough.
export function blankDesign() {
  return {
    name: 'New Design', L: 18, W: 7, decks: 1, quarter: 'raised', fore: 'none', poop: false,
    masts: ['sloop'], deckGuns: 2, gunDeck: false, horses: 0, wagons: 0, hold: 2,
    paint: '#2a4a8a', paint2: '#1a1a20', flag: '#e0c040', emblem: 'stripe', sail: '#f0ead8',
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Put right whatever couldn't be built: sizes in range, a beam that's odd
// (she has a centreline), a great cabin only over a cabin, a gun deck
// only with two decks below, no more stalls than she has room for.
export function tidy(d) {
  d.L = clamp(Math.round(d.L / 2) * 2, ...LIMITS.L);
  d.W = clamp(d.W | 1, ...LIMITS.W);
  d.decks = d.decks === 2 ? 2 : 1;
  if (!['none', 'raised', 'cabin'].includes(d.quarter)) d.quarter = 'raised';
  if (!['none', 'raised', 'galley'].includes(d.fore)) d.fore = 'none';
  if (d.quarter !== 'cabin' || d.L < 24) d.poop = false;
  if (d.fore === 'galley' && d.L < 20) d.fore = 'raised';
  if (d.quarter === 'cabin' && d.L < 18) d.quarter = 'raised';
  d.masts = (d.masts || ['sloop']).filter((r) => RIGS.includes(r)).slice(0, LIMITS.masts[1]);
  if (!d.masts.length) d.masts = ['sloop'];
  // (Three masts want a long hull; two, a middling one.)
  const maxMasts = d.L >= 26 ? 3 : d.L >= 20 ? 2 : 1;
  d.masts = d.masts.slice(0, maxMasts);
  d.deckGuns = clamp(d.deckGuns | 0, 0, Math.min(LIMITS.deckGuns[1], Math.floor((d.L - 8) / 3)));
  if (d.decks < 2) d.gunDeck = false;
  d.hold = clamp(d.hold | 0, ...LIMITS.hold);
  const room = stallRoom(d);
  d.horses = clamp(d.horses | 0, 0, room.horses);
  d.wagons = clamp(d.wagons | 0, 0, room.wagons);
  d.name = String(d.name || 'New Design').slice(0, 24);
  return d;
}

// How many horses and wagons she could be made to carry.
export function stallRoom(d) {
  const below = d.L * d.W * d.decks;
  return { horses: Math.min(4, Math.floor(below / 70)), wagons: d.decks === 2 && d.W >= 9 ? Math.min(2, Math.floor(d.L / 14)) : 0 };
}

// The deck guns' frames: spread down her waist, clear of her castles.
function gunFrames(T, n) {
  if (!n) return [];
  const a = (T.quarter ? T.quarter.z1 : 2) + 2;
  const b = (T.fore ? T.fore.z0 : T.L - 3) - 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.round(a + ((b - a) * (i + 0.5)) / n));
  return [...new Set(out)];
}

// The kind of ship a design makes (a SHIP_TYPES entry).
export function typeOf(d0) {
  const d = tidy({ ...d0 });
  const { L, W } = d;
  const deck = d.decks === 1 ? 4 : 7;
  const T = {
    name: d.name, L, W, wl: d.decks === 1 ? 2 : W >= 11 ? 4 : 3, deck, floors: d.decks === 1 ? [1] : [1, 4],
    quarter: null, fore: null, poop: null, design: true,
  };
  if (d.quarter === 'raised') T.quarter = { z1: Math.max(2, Math.round(L * 0.15)), y: deck + 1 };
  else if (d.quarter === 'cabin') T.quarter = { z1: Math.max(5, Math.round(L * 0.27)), y: deck + 3 };
  if (d.fore === 'raised') T.fore = { z0: L - Math.max(3, Math.round(L * 0.14)), y: deck + 1 };
  else if (d.fore === 'galley') T.fore = { z0: L - Math.max(6, Math.round(L * 0.2)), y: deck + 3 };
  if (d.poop && T.quarter && T.quarter.y - deck >= 3) T.poop = { z1: Math.max(3, Math.round(T.quarter.z1 * 0.45)), y: T.quarter.y + 3 };
  const at = d.masts.length === 1 ? [0.58] : d.masts.length === 2 ? [0.66, 0.36] : [0.72, 0.5, 0.22];
  const tall = Math.round(L * 0.45 + W * 0.6);
  T.masts = d.masts.map((rig, i) => ({ z: at[i], h: Math.max(10, tall + (i === Math.min(1, d.masts.length - 1) ? 3 : 0) - (i === 2 ? 4 : 0)), rig }));
  T.bowsprit = Math.round(L * 0.28);
  T.deckGuns = gunFrames(T, d.deckGuns);
  T.gunDeck = d.gunDeck ? Array.from({ length: Math.floor((L - 10) / 3) }, (_, i) => 6 + i * 3).filter((z) => z < L - 5) : null;
  const guns = T.deckGuns.length * 2 + (T.gunDeck ? T.gunDeck.length * 2 : 0);
  const pull = d.masts.reduce((s, r) => s + RIG_PULL[r], 0);
  const rooms = (d.quarter === 'cabin' ? 1 : 0) + (d.fore === 'galley' ? 1 : 0) + (d.poop ? 1 : 0);
  T.speed = Math.round(clamp(8 + pull * 6 + (L / W - 2.3) * 5 - guns * 0.25 - (W - 7) * 1.5 - rooms - (d.horses + d.wagons * 2) * 0.4, 8, 32));
  T.turn = Math.round(clamp(1.25 - L * 0.026 - (W - 7) * 0.03, 0.3, 1) * 100) / 100;
  T.accel = Math.round(clamp(0.78 - L * 0.015, 0.2, 0.6) * 100) / 100;
  T.crew = Math.max(2, Math.round(d.masts.length * 2 + guns / 4 + L / 12));
  T.hold = d.hold;
  T.carries = { horses: d.horses, wagons: d.wagons };
  T.cost = costOf(d).coin;
  T.guns = guns;
  T.blurb = `Your own design: ${L} paces long, ${W} across, ${d.masts.length} mast${d.masts.length > 1 ? 's' : ''}, ${guns} gun${guns === 1 ? '' : 's'}${d.horses ? `, stalls for ${d.horses}` : ''}${d.wagons ? `, room for ${d.wagons} wagon${d.wagons > 1 ? 's' : ''}` : ''}.`;
  return T;
}

// What the bench wants to build her: coin (the shipwright's time and the
// fittings), timber, iron for her guns, cloth for her sails, rope.
export function costOf(d) {
  const guns = d.deckGuns * 2 + (d.gunDeck && d.decks === 2 ? Math.floor((d.L - 10) / 3) * 2 : 0);
  const rooms = (d.quarter === 'cabin' ? 1 : 0) + (d.fore === 'galley' ? 1 : 0) + (d.poop ? 1 : 0);
  const coin = Math.round((d.L * d.W * d.decks * 3.2 + guns * 45 + d.masts.length * 140 + rooms * 160 + d.horses * 60 + d.wagons * 90 + d.hold * 30) / 10) * 10;
  return {
    coin,
    items: [
      ['planks', Math.round((d.L * d.W * (d.decks + 1)) / 6)],
      ['iron_ingot', guns + 2],
      ['cloth', d.masts.reduce((s, r) => s + (r === 'square3' ? 6 : r === 'square2' || r === 'mizzen' ? 4 : 3), 0)],
      ['string', d.masts.length * 4],
    ].filter(([, n]) => n > 0),
  };
}

// ------------------------------------------------------------ kept
// A design drawn up for good: a kind of ship of its own. Its id, its type.
export function registerDesign(game, d0, id) {
  const d = tidy({ ...d0 });
  game.shipDesigns ||= new Map();
  if (id === undefined) id = Math.max(0, ...game.shipDesigns.keys()) + 1;
  d.id = id;
  game.shipDesigns.set(id, d);
  installDesign(d);
  return d;
}

function installDesign(d) {
  const type = `${DESIGN_TYPE}${d.id}`;
  DESIGNS.set(d.id, d);
  // (Built once: if the same id comes again it's the same ship.)
  if (!SHIP_TYPES[type]) SHIP_TYPES[type] = typeOf(d);
  return type;
}

export const designType = (d) => `${DESIGN_TYPE}${d.id}`;
export const designOfType = (game, type) => (typeof type === 'string' && type.startsWith(DESIGN_TYPE) ? (game.shipDesigns && game.shipDesigns.get(+type.slice(DESIGN_TYPE.length))) || DESIGNS.get(+type.slice(DESIGN_TYPE.length)) || null : null);

export function designsSave(game) {
  return game.shipDesigns && game.shipDesigns.size ? [...game.shipDesigns.values()] : null;
}

// (Before any ship is made from them: see game.js, and the guest's copy.)
export function designsLoad(game, list) {
  game.shipDesigns = new Map();
  for (const d of list || []) if (d && Number.isFinite(d.id)) registerDesign(game, d, d.id);
}

// What's needed and what's short, from the pack (and your own chests
// near the bench: see invtools.craftSources).
export function shortOf(d, count) {
  const c = costOf(d);
  const short = [];
  if (count('coin') < c.coin) short.push(`¤${c.coin - count('coin')}`);
  for (const [k, n] of c.items) if (count(k) < n) short.push(`${n - count(k)} ${(ITEMS[k] && ITEMS[k].name) || k}`);
  return short;
}
