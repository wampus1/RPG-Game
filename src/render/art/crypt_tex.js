// (Round 97) The crypt's own, where each goes (the drawings are in
// art/crypt_art.js): its dressed ashlar (four faces of it, the wet down a
// joint, a knocked corner), a pilaster, the niches of the dead and the
// sealed ones, the ossuary's bones, the grille, the dais and its steps; its
// flagstones, ledger slabs, marble, a cracked flag and a loose one; and
// what's set about in it.
import { grid, frameOf } from '../pixart.js';
import * as A from './crypt_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const BONE_PAL = { ...A.FLOOR, b: A.STONE.b, x: A.STONE.x };
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_D, A.WALL_C];

// The tops (16 by 16), or null if it isn't one of ours.
export function cryptTop(name, v) {
  switch (name) {
    case 'crypt_brick':
    case 'crypt_pilaster':
    case 'crypt_niche':
    case 'crypt_sealed':
    case 'crypt_grille':
      return grid({ pal: A.FLOOR, rows: v % 2 ? A.TOP_B : A.TOP_A });
    case 'bone_wall':
      return grid({ pal: BONE_PAL, rows: v % 2 ? flipX(A.TOP_BONES) : A.TOP_BONES });
    case 'crypt_floor':
      return grid({ pal: A.FLOOR, rows: A.FLAGS[v % 4] });
    // (The dais: the same flags, laid a step up.)
    case 'crypt_dais':
      return grid({ pal: A.FLOOR, rows: v % 2 ? flipX(A.FLAGS[v % 3]) : A.FLAGS[v % 3] });
    case 'crypt_ledger':
      return grid({ pal: A.FLOOR, rows: v % 2 ? A.LEDGER_B : A.LEDGER_A });
    case 'crypt_marble':
      return grid({ pal: A.FLOOR, rows: v % 2 ? A.MARBLE_B : A.MARBLE_A });
    case 'crypt_weak':
      return grid({ pal: A.FLOOR, rows: A.WEAK });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function cryptFront(name, v) {
  switch (name) {
    case 'crypt_brick':
      // (One in four with the wet down a joint, the moss in its bed.)
      return grid({ pal: A.STONE, rows: WALLS[v % 4] });
    case 'crypt_pilaster':
      return grid({ pal: A.STONE, rows: A.PILASTER });
    case 'crypt_niche':
      return grid({ pal: A.STONE, rows: v % 2 ? A.NICHE_BONES : A.NICHE_SKULL });
    case 'crypt_sealed':
      return grid({ pal: A.STONE, rows: v % 2 ? flipX(A.SEALED) : A.SEALED });
    case 'bone_wall':
      return grid({ pal: A.STONE, rows: v % 2 ? A.BONES_B : A.BONES_A });
    case 'crypt_grille':
      return grid({ pal: A.STONE, rows: A.GRILLE });
    case 'crypt_dais':
      return grid({ pal: A.STONE, rows: v % 2 ? flipX(A.DAIS) : A.DAIS });
    case 'crypt_floor':
    case 'crypt_ledger':
    case 'crypt_marble':
    case 'crypt_weak':
      return grid({ pal: A.FLOOR, rows: A.FLAGS[v % 4].slice(0, 12) });
    default:
      return null;
  }
}

// A loose flag as the floor draws it (or null: it isn't one).
export function cryptFlat(name) {
  if (name === 'loose_flag') return grid({ pal: A.FLOOR, rows: A.LOOSE });
  return null;
}

// ------------------------------------------------------------ the props
const one = (def) => {
  const cache = new Map();
  return (rot, st, f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = frameOf(def, k)));
    return p.copy();
  };
};
// (One picture out of a prop's several: an effigy's pose.)
const posed = (def, k) => {
  let p = null;
  return () => (p ||= frameOf(def, k)).copy();
};
const P = A.CRYPT_PROPS;
export const CRYPT_SPRITES = {
  vigil_candle: one(P.vigil_candle),
  vigil_out: one(P.vigil_out),
  effigy_tomb: posed(P.effigy_tomb, 0),
  effigy_book: posed(P.effigy_tomb, 1),
  effigy_prayer: posed(P.effigy_tomb, 2),
  effigy_crozier: posed(P.effigy_tomb, 3),
  tomb_open: posed(P.tomb_open, 0),
  crypt_altar: one(P.crypt_altar),
  saint_statue: one(P.saint_statue),
  register_lectern: one(P.register_lectern),
  choir_stall: one(P.choir_stall),
  ossuary_heap: one(P.ossuary_heap),
  keeper_cot: one(P.keeper_cot),
  prayer_desk: one(P.prayer_desk),
  reliquary: one(P.reliquary),
  light_shaft: one(P.light_shaft),
  crypt_fern: one(P.crypt_fern),
  vestment_press: one(P.vestment_press),
  grave_board: one(P.grave_board),
};
export const CRYPT_ANIM = { vigil_candle: 3, reliquary: 2, light_shaft: 2 };
