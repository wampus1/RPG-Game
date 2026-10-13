// (Round 105) The Leviathan's Gut's own, where each goes (the drawings are
// in art/gut_art.js): its flesh in folds (three of it, the first turned the
// other way for a fourth); the throat's cartilage, a rib through the wall,
// the hide, a worm's hole, the whalers' scar, the valve, an artery, eggs;
// the faces of a ledge of bone and of a floor where it's sunk (a bile
// pit's flesh); its floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './gut_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  lv_cartilage: () => A.CARTILAGE, lv_ribwall: (v) => (v % 2 ? flipX(A.RIBWALL) : A.RIBWALL), lv_hide: () => A.HIDE,
  lv_wormhole: () => A.WORMHOLE, lv_scar: () => A.SCAR, lv_valve: () => A.VALVE, lv_artery: (v) => (v % 2 ? flipX(A.ARTERY) : A.ARTERY), lv_eggs: () => A.EGGS,
};
const FLOORS = new Set(['lv_rugae_x', 'lv_rugae_z', 'lv_fleshfloor', 'lv_bonesand', 'lv_amberfloor', 'lv_deck']);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);

// The tops (16 by 16), or null if it isn't one of ours.
export function gutTop(name, v) {
  if (name === 'lv_flesh' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    // (The ridges across the way it pushes: along x, the ridges run
    // down the tile; along z, across it.)
    case 'lv_rugae_x':
      return grid({ pal: FLOOR, rows: A.RUGAE[1] });
    case 'lv_rugae_z':
      return grid({ pal: FLOOR, rows: A.RUGAE[0] });
    case 'lv_fleshfloor':
      return grid({ pal: FLOOR, rows: turned(A.FLESH[(v >> 1) % 2], v) });
    case 'lv_bonesand':
      return grid({ pal: FLOOR, rows: turned(A.BONESAND[(v >> 1) % 2], v) });
    case 'lv_bile':
      return grid({ pal: FLOOR, rows: A.BILE[v % 2] });
    case 'lv_amberfloor':
      return grid({ pal: FLOOR, rows: turned(A.AMBER[0], v) });
    case 'lv_deck':
      return grid({ pal: FLOOR, rows: A.DECK[0] });
    case 'lv_ledge':
      return grid({ pal: FLOOR, rows: turned(A.BONESAND[(v >> 1) % 2], v) });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function gutFront(name, v) {
  if (name === 'lv_flesh') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'lv_ledge') return grid({ pal: WALL, rows: A.LEDGE });
  // (A floor seen from the side, where it's sunk: the flesh of a pit, the
  // bile's line at its foot.)
  if (FLOORS.has(name) || name === 'lv_bile') return grid({ pal: WALL, rows: turned(A.PITFACE, v) });
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
const P = A.GUT_PROPS;
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
export const GUT_SPRITES = {
  lv_rib: either(P.lv_rib),
  lv_skeleton: either(P.lv_skeleton),
  lv_tent: either(P.lv_tent),
  lv_trypot: byState(P.lv_trypot, P.lv_trypot_off),
  lv_harpoons: either(P.lv_harpoons),
  lv_lantern: byState(P.lv_lantern, P.lv_lantern_off, true),
  lv_barrels: either(P.lv_barrels),
  lv_ladder: plain(P.lv_ladder),
  lv_logbook: plain(P.lv_logbook),
  lv_ambergris: byRot([P.lv_ambergris_0, P.lv_ambergris_1]),
  lv_eggclutch: either(P.lv_eggs),
  lv_cyst: plain(P.lv_cyst),
  lv_polyp: either(P.lv_polyp),
  lv_hull: either(P.lv_hull),
  lv_mast: either(P.lv_mast),
  lv_hook: plain(P.lv_hook),
  lv_anchor: either(P.lv_anchor),
};
export const GUT_ANIM = {
  lv_trypot: 2, lv_lantern: 2, lv_cyst: 2,
};
