// (Round 108) The Hollow Hill's own, where each goes (the drawings are in
// art/mound_art.js): its drystone (three of it, the first turned the other
// way for a fourth); the spiral kerbstone, the hill-door, the ogham stone,
// the cairn's slab, the niche of candles, the woven branches; the faces
// of the dais and of a floor where it's sunk; its floors; and what's set
// about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './mound_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const FACES = {
  hh_spiral: () => A.SPIRAL, hh_hilldoor: () => A.HILLDOOR, hh_ogham: (v) => turned(A.OGHAM, v), hh_slab: () => A.SLAB,
  hh_niche: () => A.NICHE, hh_woven: (v) => turned(A.WOVEN, v),
};
const FLOORS = new Set(['hh_heath', 'hh_flags', 'hh_starlit', 'hh_ring', 'hh_moss', 'hh_litter', 'hh_pool']);

// The tops (16 by 16), or null if it isn't one of ours.
export function moundTop(name, v) {
  if (name === 'hh_drystone' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'hh_heath':
      return grid({ pal: FLOOR, rows: turned(A.HEATH[(v >> 1) % 2], v) });
    case 'hh_flags':
      return grid({ pal: FLOOR, rows: turned(A.FLAGS[0], v) });
    case 'hh_starlit':
      return grid({ pal: FLOOR, rows: turned(A.STARLIT[(v >> 1) % 2], v) });
    case 'hh_ring':
      return grid({ pal: FLOOR, rows: turned(A.RINGT[0], v) });
    case 'hh_moss':
      return grid({ pal: FLOOR, rows: turned(A.MOSS[0], v) });
    case 'hh_litter':
      return grid({ pal: FLOOR, rows: turned(A.LITTER[0], v) });
    case 'hh_pool':
      return grid({ pal: FLOOR, rows: A.POOL[v % 2] });
    case 'hh_dais':
      return grid({ pal: FLOOR, rows: turned(A.HEATH[(v >> 1) % 2], v) });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function moundFront(name, v) {
  if (name === 'hh_drystone') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'hh_dais') return grid({ pal: WALL, rows: A.DAIS });
  // (A floor seen from the side, where it's sunk.)
  if (FLOORS.has(name)) return grid({ pal: WALL, rows: turned(A.PITFACE, v) });
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
const P = A.MOUND_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
const byState = (on, off, flip = false) => {
  const a = flip ? either(on) : plain(on);
  const b = flip ? either(off) : plain(off);
  return (rot, st, f) => (st ? a(rot, st, f) : b(rot, st, f));
};
const byRot = (defs) => {
  const fs = defs.map(one);
  return (rot, st, f) => fs[rot % fs.length](f);
};
// (A standing stone: which tree it is by its turn; woken, its ogham alight.)
const stones = [0, 1, 2, 3, 4].map((k) => [one(P[`hh_stone_${k}`]), one(P[`hh_stone_${k}_on`])]);
export const MOUND_SPRITES = {
  hh_stone: (rot, st, f) => stones[rot % 5][st ? 1 : 0](f),
  hh_cairn: either(P.hh_cairn),
  hh_basin: plain(P.hh_basin),
  hh_birch: either(P.hh_birch),
  hh_hazel: either(P.hh_hazel),
  hh_toadstools: either(P.hh_toadstools),
  hh_ringcap: byState(P.hh_kicked, P.hh_toadstools),
  hh_throne: plain(P.hh_throne),
  hh_lantern: byState(P.hh_lantern, P.hh_lantern_off, true),
  hh_harp: either(P.hh_harp),
  hh_bench: either(P.hh_bench),
  hh_feast: byRot([P.hh_feast_0, P.hh_feast_1]),
  hh_piper: either(P.hh_piper),
  hh_bones: either(P.hh_bones),
  hh_offering: either(P.hh_offering),
  hh_candles: plain(P.hh_candles),
};
export const MOUND_ANIM = {
  hh_lantern: 2, hh_feast: 2, hh_candles: 2,
};
