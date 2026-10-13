// (Round 100) The Wildwood Hollow's own, where each goes (the drawings are
// in art/grove_art.js): its wall of roots (three weaves of it, each turned
// either way), a shelf of glowcaps, bare earth, the Green Man, one of the
// Kept, a knothole with eyes in it, a door of roots, a bank of earth held
// by roots; moss, leaf litter, a worn path, the Keepers' flags, leaf mould,
// a bed of earth in the sun; roots lying across the floor, and the snare;
// and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './grove_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const ROOTS = [A.ROOTS_A, A.ROOTS_B, A.ROOTS_C];
// (Three weaves and the first turned the other way: four faces, so a wall
// of them seldom shows the same one twice running.)
const roots = (v) => (v === 3 ? flipX(ROOTS[0]) : ROOTS[v % 3]);

// The tops (16 by 16), or null if it isn't one of ours.
export function groveTop(name, v) {
  switch (name) {
    case 'gr_roots':
    case 'gr_glowshelf':
    case 'gr_earth':
    case 'gr_greenman':
    case 'gr_kept':
    case 'gr_knot':
    case 'gr_rootdoor':
      return grid({ pal: WALL, rows: v % 2 ? flipX(A.TOPS[(v >> 1) % 2]) : A.TOPS[(v >> 1) % 2] });
    case 'gr_moss':
      return grid({ pal: FLOOR, rows: A.MOSS[v % 4] });
    case 'gr_litter':
      return grid({ pal: FLOOR, rows: v % 2 ? flipX(A.LITTER[(v >> 1) % 2]) : A.LITTER[(v >> 1) % 2] });
    case 'gr_worn':
      return grid({ pal: FLOOR, rows: v % 2 ? flipX(A.WORN[0]) : A.WORN[0] });
    case 'gr_flags':
      return grid({ pal: FLOOR, rows: A.FLAGS[v % 5 === 0 ? 0 : 1] });
    case 'gr_mould':
      return grid({ pal: FLOOR, rows: v % 2 ? flipX(A.MOULD[(v >> 1) % 2]) : A.MOULD[(v >> 1) % 2] });
    case 'gr_bank':
      return grid({ pal: FLOOR, rows: A.BANKTOP[v % 2] });
    case 'gr_sunbed':
      return grid({ pal: FLOOR, rows: A.SUNBED });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function groveFront(name, v) {
  switch (name) {
    case 'gr_roots':
      return grid({ pal: WALL, rows: roots(v) });
    case 'gr_glowshelf':
      return grid({ pal: WALL, rows: v % 2 ? flipX(A.GLOWSHELF) : A.GLOWSHELF });
    case 'gr_earth':
      return grid({ pal: WALL, rows: v % 2 ? flipX(A.EARTHWALL) : A.EARTHWALL });
    case 'gr_greenman':
      return grid({ pal: WALL, rows: A.GREENMAN });
    case 'gr_kept':
      return grid({ pal: WALL, rows: v % 2 ? flipX(A.KEPT) : A.KEPT });
    case 'gr_knot':
      return grid({ pal: WALL, rows: A.KNOT });
    case 'gr_rootdoor':
      return grid({ pal: WALL, rows: A.ROOTDOOR });
    case 'gr_bank':
      return grid({ pal: WALL, rows: v % 2 ? flipX(A.BANKFACE) : A.BANKFACE });
    case 'gr_moss':
    case 'gr_litter':
    case 'gr_worn':
    case 'gr_mould':
    case 'gr_sunbed':
      return grid({ pal: WALL, rows: A.EARTHWALL });
    case 'gr_flags':
      return grid({ pal: FLOOR, rows: A.FLAGS[1].slice(0, 12) });
    default:
      return null;
  }
}

// Lying flat on the floor: roots across it, and the snare among them.
export function groveFlat(name, v = 0) {
  switch (name) {
    case 'gr_rootflat':
      return grid({ pal: FLOOR, rows: v % 2 ? flipX(A.ROOTFLAT[(v >> 1) % 2]) : A.ROOTFLAT[(v >> 1) % 2] });
    case 'gr_snare':
      return grid({ pal: FLOOR, rows: A.SNAREFLAT });
    default:
      return null;
  }
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
const P = A.GROVE_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
// (Turned either way by its rot: no two ferns, toadstools, caps alike.)
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (By its state: an offering given, one of the Kept awake, a puffball
// burst, a shoot grown tall.)
const byState = (off, on) => {
  const a = one(off);
  const b = one(on);
  return (rot, st, f) => (st ? b(f) : a(f));
};
const TOADS = [either(P.gr_toadstool), either(P.gr_toadstool_b)];
export const GROVE_SPRITES = {
  gr_glowcaps: either(P.gr_glowcaps),
  gr_toadstool: (rot, st, f) => TOADS[(rot >> 1) % 2](rot, st, f),
  gr_fern: either(P.gr_fern),
  gr_bluebells: either(P.gr_bluebells),
  gr_rootcurtain: either(P.gr_rootcurtain),
  gr_ragroot: either(P.gr_ragroot),
  gr_offering: byState(P.gr_offering, P.gr_offering_given),
  gr_antlerpost: plain(P.gr_antlerpost),
  gr_rulestone: plain(P.gr_rulestone),
  gr_keptroot: byState(P.gr_keptroot, P.gr_keptroot_wake),
  gr_puffball: byState(P.gr_puffball, P.gr_puffball_burst),
  gr_hornets: plain(P.gr_hornets),
  gr_log: either(P.gr_log),
  gr_stump: plain(P.gr_stump),
  gr_camp: plain(P.gr_camp),
  gr_sunbeam: plain(P.gr_sunbeam),
  gr_seedpod: plain(P.gr_seedpod),
  gr_sprout: byState(P.gr_sprout, P.gr_sprout_tall),
  gr_rootladder: plain(P.gr_rootladder),
  gr_boulder: either(P.gr_boulder),
};
export const GROVE_ANIM = {
  gr_glowcaps: 2, gr_fern: 2, gr_bluebells: 2, gr_rootcurtain: 2, gr_ragroot: 2, gr_antlerpost: 2,
  gr_puffball: 2, gr_hornets: 2, gr_sunbeam: 4, gr_seedpod: 2,
};
