// (Round 107) The Deep Warren's own, where each goes (the drawings are in
// art/warren_art.js): its loam in strata (three of it, the first turned
// the other way for a fourth); the wattle, the round doors, the pantry's
// little door, the shelves, the hearth, the old burrow's rings, the
// stopper, the glowworms; the faces of a tier of the moot and of a floor
// where it's sunk (a pit's side); its floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './warren_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const FACES = {
  wr_wattle: (v) => turned(A.WATTLE, v), wr_door: (v) => (v % 2 ? A.DOOR_X : A.DOOR), wr_smalldoor: () => A.SMALLDOOR, wr_shelf: (v) => turned(A.SHELF, v),
  wr_hearth: () => A.HEARTH, wr_rings: (v) => turned(A.RINGS, v), wr_stopper: (v) => turned(A.STOPPER, v), wr_glow: (v) => turned(A.GLOW, v),
};
const FLOORS = new Set(['wr_floor', 'wr_moss', 'wr_scree', 'wr_boards', 'wr_rug', 'wr_cracked', 'wr_bed', 'wr_roots', 'wr_pitbed']);

// The tops (16 by 16), or null if it isn't one of ours.
export function warrenTop(name, v) {
  if (name === 'wr_loam' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'wr_floor':
      return grid({ pal: FLOOR, rows: turned(A.LOAM[(v >> 1) % 2], v) });
    case 'wr_moss':
      return grid({ pal: FLOOR, rows: turned(A.MOSS[(v >> 1) % 2], v) });
    case 'wr_scree':
      return grid({ pal: FLOOR, rows: turned(A.SCREE[(v >> 1) % 2], v) });
    case 'wr_boards':
      return grid({ pal: FLOOR, rows: A.BOARDS[0] });
    case 'wr_rug':
      return grid({ pal: FLOOR, rows: A.RUG[0] });
    case 'wr_cracked':
      return grid({ pal: FLOOR, rows: turned(A.CRACKED[0], v) });
    case 'wr_bed':
      return grid({ pal: FLOOR, rows: A.BED[0] });
    case 'wr_roots':
      return grid({ pal: FLOOR, rows: turned(A.ROOTF[0], v) });
    case 'wr_pitbed':
      return grid({ pal: FLOOR, rows: turned(A.PITBED[0], v) });
    case 'wr_tier':
      return grid({ pal: FLOOR, rows: A.BOARDS[0] });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function warrenFront(name, v) {
  if (name === 'wr_loam') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'wr_tier') return grid({ pal: WALL, rows: A.TIER });
  // (A floor seen from the side, where it's sunk: the earth of a pit.)
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
const P = A.WARREN_PROPS;
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
export const WARREN_SPRITES = {
  wr_pod: byState(P.wr_pod, P.wr_pod_off),
  wr_glowcap: either(P.wr_glowcap),
  wr_table: plain(P.wr_table),
  wr_stool: either(P.wr_stool),
  wr_dresser: either(P.wr_dresser),
  wr_bedstead: either(P.wr_bed),
  wr_book: plain(P.wr_book),
  wr_casks: either(P.wr_casks),
  wr_hams: plain(P.wr_hams),
  wr_bins: either(P.wr_bins),
  wr_rootpillar: either(P.wr_rootpillar),
  wr_hangroots: either(P.wr_hangroots),
  wr_speakstone: plain(P.wr_speakstone),
  wr_bench: either(P.wr_bench),
  wr_dead: either(P.wr_dead),
  wr_ladder: plain(P.wr_ladder),
  wr_nest: either(P.wr_nest),
  wr_spades: either(P.wr_spades),
  wr_bones: either(P.wr_bones),
  wr_clods: either(P.wr_clods),
};
export const WARREN_ANIM = {
  wr_pod: 2, wr_glowcap: 2, wr_table: 2,
};
