// (Round 112) The Sundered Reach's own, where each goes (the drawings are
// in art/rift_art.js): its red sandstone (three of it, the first turned
// the other way for a fourth); the murals, the niche of pots, the star
// chart, the glass wall, the tear; the faces of a step and of a sunk
// floor; its floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './rift_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  rf_mural: (v) => (v % 2 ? A.MURAL_1 : A.MURAL_0), rf_niche: () => A.NICHE, rf_chart: () => A.CHART,
  rf_glasswall: (v) => (v % 2 ? A.GLASSWALL_1 : A.GLASSWALL_0), rf_tearwall: (v) => (v % 2 ? A.TEAR_1 : A.TEAR_0),
};
const FLOORS = { rf_sand: A.SAND, rf_crazed: A.CRAZED, rf_glass: A.GLASS, rf_abyss: A.ABYSS, rf_bridge: A.BRIDGE, rf_rug: A.RUG, rf_lid: A.LID };
const FIXED = new Set(['rf_bridge', 'rf_rug', 'rf_lid']);

// The tops (16 by 16), or null if it isn't one of ours.
export function riftTop(name, v) {
  if (name === 'rf_stone' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  if (FIXED.has(name)) return grid({ pal: FLOOR, rows: FLOORS[name][0] });
  if (FLOORS[name]) return grid({ pal: FLOOR, rows: turned(FLOORS[name][(v >> 1) % FLOORS[name].length], v) });
  if (name === 'rf_dais') return grid({ pal: FLOOR, rows: turned(A.SAND[(v >> 1) % 2], v) });
  return null;
}
// The fronts (16 by 12).
export function riftFront(name, v) {
  if (name === 'rf_stone') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'rf_dais') return grid({ pal: WALL, rows: A.DAIS });
  if (FLOORS[name]) return grid({ pal: WALL, rows: turned(A.PITFACE, v) });
  return null;
}

// ------------------------------------------------------------ the props
const one = (def) => {
  const cache = new Map();
  return (f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = frameOf(def, k)));
    return p.copy();
  };
};
const flipped = (def) => {
  const cache = new Map();
  return (f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = grid({ pal: def.pal, rows: flipX(frameRows(def, k)) })));
    return p.copy();
  };
};
const P = A.RIFT_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (A sighting-stone: which sign by its turn, shining once the sky's set
// right.)
const dials = [0, 1, 2, 3].map((k) => [one(P[`rf_dial_${k}`]), one(P[`rf_dial_${k}_on`])]);
export const RIFT_SPRITES = {
  rf_crystal: either(P.rf_crystal),
  rf_pots: either(P.rf_pots),
  rf_metate: either(P.rf_metate),
  rf_loom: either(P.rf_loom),
  rf_hearth: plain(P.rf_hearth),
  rf_kachina: either(P.rf_kachina),
  rf_dial: (rot, st, f) => dials[rot % 4][st ? 1 : 0](f),
  rf_float: either(P.rf_float),
  rf_tear: plain(P.rf_tear),
  rf_bowl: either(P.rf_bowl),
  rf_baskets: either(P.rf_baskets),
  rf_bones: either(P.rf_bones),
  rf_shards: either(P.rf_shards),
  rf_brazier: plain(P.rf_brazier),
  rf_journal: either(P.rf_journal),
  rf_cairn: either(P.rf_cairn),
};
export const RIFT_ANIM = { rf_crystal: 3, rf_hearth: 2, rf_float: 3, rf_tear: 2, rf_brazier: 2 };
