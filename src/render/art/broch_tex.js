// (Round 109) The Drowned Broch's own, where each goes (the drawings are in
// art/broch_art.js): its flagstone (three of it, the first turned the other
// way for a fourth); the wrack-hung courses, the driftwood patch, the slit,
// the wall-cell, the symbol stones, the cruisie lamp's niche, the barred
// door; the faces of the scarcement, of a step and of a floor where it's
// sunk; its floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './broch_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const WALLS = [A.WALL_A, A.WALL_D, A.WALL_E];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  bc_wrackwall: (v) => turned(A.WALL_B, v), bc_patch: (v) => turned(A.WALL_C, v), bc_slit: () => A.SLIT, bc_cell: () => A.CELL,
  bc_symbol: (v) => (v % 2 ? A.SYMBOL_1 : A.SYMBOL_0), bc_bardoor: () => A.BARDOOR,
};
const FLOORS = new Set(['bc_flags', 'bc_wet', 'bc_slate', 'bc_shingle', 'bc_hearth', 'bc_planks']);

// The tops (16 by 16), or null if it isn't one of ours.
export function brochTop(name, v) {
  if (name === 'bc_flagstone' || name === 'bc_lampniche' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'bc_flags':
      return grid({ pal: FLOOR, rows: turned(A.FLAGS[(v >> 1) % 2], v) });
    case 'bc_wet':
      return grid({ pal: FLOOR, rows: turned(A.WET[(v >> 1) % 2], v) });
    case 'bc_slate':
      return grid({ pal: FLOOR, rows: turned(A.SLATE[0], v) });
    case 'bc_shingle':
      return grid({ pal: FLOOR, rows: turned(A.SHINGLE[(v >> 1) % 2], v) });
    case 'bc_hearth':
      return grid({ pal: FLOOR, rows: A.HEARTH[0] });
    case 'bc_planks':
      return grid({ pal: FLOOR, rows: turned(A.PLANKS[0], v) });
    case 'bc_ledge':
    case 'bc_step':
      return grid({ pal: FLOOR, rows: turned(A.FLAGS[(v >> 1) % 2], v) });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function brochFront(name, v) {
  if (name === 'bc_flagstone') return grid({ pal: WALL, rows: wall(v) });
  if (name === 'bc_lampniche') return grid({ pal: WALL, rows: v % 2 ? A.LAMP_1 : A.LAMP_0 });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'bc_ledge') return grid({ pal: WALL, rows: A.LEDGE });
  if (name === 'bc_step') return grid({ pal: WALL, rows: A.STEP });
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
const P = A.BROCH_PROPS;
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
export const BROCH_SPRITES = {
  bc_beacon: byState(P.bc_beacon_on, P.bc_beacon),
  bc_falselight: byState(P.bc_falselight, P.bc_falselight_off, true),
  bc_lamp: byState(P.bc_lamp, P.bc_lamp_off, true),
  bc_oilcask: byState(P.bc_oilcask_open, P.bc_oilcask, true),
  bc_peat: either(P.bc_peat),
  bc_quern: plain(P.bc_quern),
  bc_kist: either(P.bc_kist),
  bc_keeperkist: plain(P.bc_keeperkist),
  bc_creels: either(P.bc_creels),
  bc_nets: either(P.bc_nets),
  bc_rack: either(P.bc_rack),
  bc_rope: either(P.bc_rope),
  bc_anchor: either(P.bc_anchor),
  bc_ribs: either(P.bc_ribs),
  bc_figurehead: either(P.bc_figurehead),
  bc_jawbone: plain(P.bc_jawbone),
  bc_bunk: either(P.bc_bunk),
  bc_plunder: either(P.bc_plunder),
  bc_nest: either(P.bc_nest),
  bc_kelp: either(P.bc_kelp),
  bc_bones: either(P.bc_bones),
};
export const BROCH_ANIM = {
  bc_beacon: 2, bc_falselight: 2, bc_lamp: 2,
};
