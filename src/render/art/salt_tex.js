// (Round 106) The Salt Cathedral's own, where each goes (the drawings are
// in art/salt_art.js): its rock salt in bands (three of it, the first
// turned the other way for a fourth); the reliefs, the cribbing, a niche,
// the bricked-up chapel, the rope tied off, a vein, the seep, the tally,
// the sluice, the flooded arch; the faces of a carved step and of a floor
// where it's sunk (a brine pit's side); its floors; and what's set about
// in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './salt_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const FACES = {
  sw_relief: (v) => (v % 2 ? A.RELIEF_B : A.RELIEF_A), sw_crib: (v) => turned(A.CRIB, v), sw_niche: (v) => (v % 2 ? A.NICHE_B : A.NICHE),
  sw_bricked: () => A.BRICKED, sw_cleat: (v) => turned(A.CLEAT, v), sw_vein: (v) => turned(A.VEIN, v), sw_seep: (v) => turned(A.SEEP, v),
  sw_tally: () => A.TALLY, sw_sluice: () => A.SLUICE, sw_flooded: () => A.FLOODED,
};
const FLOORS = new Set(['sw_floor', 'sw_slabs', 'sw_crust', 'sw_planks', 'sw_crystalfloor', 'sw_brick', 'sw_wetbed']);

// The tops (16 by 16), or null if it isn't one of ours.
export function saltTop(name, v) {
  // (The shaft's loft of cribbing: planks laid over it.)
  if (name === 'sw_crib') return grid({ pal: FLOOR, rows: A.PLANKS[0] });
  if (name === 'sw_rock' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'sw_floor':
      return grid({ pal: FLOOR, rows: turned(A.SALTFLOOR[(v >> 1) % 2], v) });
    case 'sw_slabs':
      return grid({ pal: FLOOR, rows: A.SLABS[0] });
    case 'sw_crust':
      return grid({ pal: FLOOR, rows: turned(A.CRUST[(v >> 1) % 2], v) });
    case 'sw_brine':
      return grid({ pal: FLOOR, rows: A.BRINE[v % 2] });
    case 'sw_planks':
      return grid({ pal: FLOOR, rows: A.PLANKS[0] });
    case 'sw_crystalfloor':
      return grid({ pal: FLOOR, rows: turned(A.CRYSTALF[0], v) });
    case 'sw_brick':
      return grid({ pal: FLOOR, rows: A.BRICKF[0] });
    case 'sw_wetbed':
      return grid({ pal: FLOOR, rows: turned(A.WETBED[0], v) });
    case 'sw_step':
      return grid({ pal: FLOOR, rows: A.SLABS[0] });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function saltFront(name, v) {
  if (name === 'sw_rock') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'sw_step') return grid({ pal: WALL, rows: A.STEP });
  // (A floor seen from the side, where it's sunk: the rock of a pit, the
  // crust at the brine's line.)
  if (FLOORS.has(name) || name === 'sw_brine') return grid({ pal: WALL, rows: turned(A.PITFACE, v) });
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
const P = A.SALT_PROPS;
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
export const SALT_SPRITES = {
  sw_chandelier: plain(P.sw_chandelier),
  sw_shards: either(P.sw_shards),
  sw_pew: either(P.sw_pew),
  sw_altar: byState(P.sw_altar, P.sw_altar_off),
  sw_mother: plain(P.sw_mother),
  sw_votive: plain(P.sw_votive),
  sw_post: plain(P.sw_post),
  sw_cart: either(P.sw_cart),
  sw_blocks: either(P.sw_blocks),
  sw_sacks: either(P.sw_sacks),
  sw_tools: either(P.sw_tools),
  sw_wheel: plain(P.sw_wheel),
  sw_lamp: byState(P.sw_lamp, P.sw_lamp_off, true),
  sw_ladder: plain(P.sw_ladder),
  sw_ledger: plain(P.sw_ledger),
  sw_dead: either(P.sw_dead),
  sw_pan: byState(P.sw_pan, P.sw_pan_off),
  sw_boat: either(P.sw_boat),
  sw_singer: plain(P.sw_singer),
  sw_growth: byRot([P.sw_growth_0, P.sw_growth_1]),
};
export const SALT_ANIM = {
  sw_chandelier: 2, sw_altar: 2, sw_votive: 2, sw_lamp: 2, sw_pan: 2, sw_singer: 2,
};
