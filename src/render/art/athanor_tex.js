// (Round 110) The Athanor's own, where each goes (the drawings are in
// art/athanor_art.js): its marble (three of it, the first turned the
// other way for a fourth); the pilaster, the niches, the shelves, the
// Emerald Tablet, the rose window, the wall-furnace, the sanctum's seal;
// the faces of the dais and of a sunk floor; its floors, a stage of the
// Work each; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './athanor_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  an_pilaster: () => A.PILASTER, an_niche: (v) => (v % 2 ? A.NICHE_1 : A.NICHE_0), an_shelves: (v) => turned(A.SHELVES, v), an_tablet: () => A.TABLET,
  an_rose: () => A.ROSE, an_furnace: (v) => (v % 2 ? A.FURNACE_1 : A.FURNACE_0), an_seal: () => A.SEAL,
};
const FLOORS = { an_nigredo: A.NIGREDO, an_albedo: A.ALBEDO, an_rubedo: A.RUBEDO, an_ouroboros: A.OUROBOROS };

// The tops (16 by 16), or null if it isn't one of ours.
export function athanorTop(name, v) {
  if (name === 'an_marble' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  if (name === 'an_ouroboros') return grid({ pal: FLOOR, rows: A.OUROBOROS[0] });
  if (FLOORS[name]) return grid({ pal: FLOOR, rows: turned(FLOORS[name][(v >> 1) % FLOORS[name].length], v) });
  if (name === 'an_dais') return grid({ pal: FLOOR, rows: turned(A.RUBEDO[(v >> 1) % 2], v) });
  return null;
}
// The fronts (16 by 12).
export function athanorFront(name, v) {
  if (name === 'an_marble') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'an_dais') return grid({ pal: WALL, rows: A.DAIS });
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
const P = A.ATHANOR_PROPS;
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
// (A mirror: which way it's turned by its turn, `/` or `\`; lit by the
// beam, its face ablaze.)
const mirrors = [[one(P.an_mirror_0), one(P.an_mirror_0_on)], [one(P.an_mirror_1), one(P.an_mirror_1_on)]];
export const ATHANOR_SPRITES = {
  an_athanor: byState(P.an_athanor, P.an_athanor_off),
  an_alembic: either(P.an_alembic),
  an_table: either(P.an_table),
  an_vat: byState(P.an_vat, P.an_vat_broken),
  an_mirror: (rot, st, f) => mirrors[rot % 2][st ? 1 : 0](f),
  an_sunlamp: either(P.an_sunlamp),
  an_lectern: either(P.an_lectern),
  an_armillary: plain(P.an_armillary),
  an_tree: either(P.an_tree),
  an_saltman: either(P.an_saltman),
  an_column: plain(P.an_column),
  an_fountain: plain(P.an_fountain),
  an_transmute: byState(P.an_transmute_gold, P.an_transmute),
  an_candles: plain(P.an_candles),
  an_coal: either(P.an_coal),
  an_jars: either(P.an_jars),
};
export const ATHANOR_ANIM = {
  an_athanor: 2, an_alembic: 2, an_vat: 2, an_sunlamp: 2, an_armillary: 2, an_fountain: 2, an_candles: 2,
};
