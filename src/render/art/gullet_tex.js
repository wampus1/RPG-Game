// (Round 113) The Gullet of the World's own, where each goes (the drawings
// are in art/gullet_art.js): its packed earth (three of it, the first
// turned the other way for a fourth), the bore's cut through the city, the
// belly's etched earth; the city's mudbrick (two of it), its friezes, a
// door, the river god, a tablet, a bricked-up door; a terrace's face and a
// flat roof's; the face of a sunk floor; its floors; and what's set about
// in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './gullet_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const EARTH = [A.WALL_A, A.WALL_B, A.WALL_C];
const earth = (v) => (v === 3 ? flipX(EARTH[0]) : EARTH[v % 3]);
const FACES = {
  gl_city: (v) => turned(v & 2 ? A.CITY_B : A.CITY_A, v), gl_frieze: (v) => (v % 2 ? A.FRIEZE_1 : A.FRIEZE_0), gl_doorway: () => A.DOORWAY,
  gl_relief: () => A.GOD, gl_tablet: () => A.TABLET, gl_bricked: () => A.BRICKED, gl_cut: (v) => turned(v & 2 ? A.CUT_1 : A.CUT_0, v),
  gl_etched: (v) => turned(v & 2 ? A.ETCHED_1 : A.ETCHED_0, v), gl_terrace: () => A.TERRACE, gl_roof: (v) => turned(A.CITY_A, v),
};
const FLOORS = { gl_dirt: A.DIRT, gl_paving: A.PAVING, gl_slick: A.SLICK, gl_silt: A.SILT, gl_glazed: A.GLAZED, gl_deck: A.DECK };
const FIXED = new Set(['gl_glazed', 'gl_deck']);

// The tops (16 by 16), or null if it isn't one of ours.
export function gulletTop(name, v) {
  if (name === 'gl_terrace') return grid({ pal: FLOOR, rows: A.GLAZED[0] });
  if (name === 'gl_roof') return grid({ pal: FLOOR, rows: turned(A.DIRT[(v >> 1) % A.DIRT.length], v) });
  if (name === 'gl_earth' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  if (FIXED.has(name)) return grid({ pal: FLOOR, rows: FLOORS[name][0] });
  if (FLOORS[name]) return grid({ pal: FLOOR, rows: turned(FLOORS[name][(v >> 1) % FLOORS[name].length], v) });
  return null;
}
// The fronts (16 by 12).
export function gulletFront(name, v) {
  if (name === 'gl_earth') return grid({ pal: WALL, rows: earth(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
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
const P = A.GULLET_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (The god's table, given to; the sluice wheel, turned.)
const lit = (off, on) => {
  const a = one(off);
  const b = one(on);
  return (rot, st, f) => (st ? b(f) : a(f));
};
export const GULLET_SPRITES = {
  gl_eggs: either(P.gl_eggs),
  gl_column: either(P.gl_column),
  gl_lion: either(P.gl_lion),
  gl_jars: either(P.gl_jars),
  gl_oven: either(P.gl_oven),
  gl_well: plain(P.gl_well),
  gl_stall: either(P.gl_stall),
  gl_cart: either(P.gl_cart),
  gl_offering: lit(P.gl_offering, P.gl_offering_on),
  gl_god: plain(P.gl_god),
  gl_wheel: lit(P.gl_wheel, P.gl_wheel_on),
  gl_barge: either(P.gl_barge),
  gl_skin: either(P.gl_skin),
  gl_hoard: either(P.gl_hoard),
  gl_throne: either(P.gl_throne),
  gl_tablets: either(P.gl_tablets),
  gl_roots: either(P.gl_roots),
  gl_grit: either(P.gl_grit),
  gl_lamp: either(P.gl_lamp),
  gl_bones: either(P.gl_bones),
};
export const GULLET_ANIM = { gl_eggs: 2, gl_oven: 2, gl_roots: 3, gl_lamp: 2 };
