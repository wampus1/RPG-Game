// (Round 102) The Tide Grotto's own, where each goes (the drawings are in
// art/grotto_art.js): its wall of black volcanic rock wearing the tide on it
// (three of it, and the first turned the other way), mussels thick, coral
// grown up it, the glowing algae, the tide-marks, the shrine's shells, the
// sea-door, a moray's hole, the carving of the Tide-Mother; the face of a
// shelf of rock, of a boardwalk on its stilts, the lining of a pool; shell
// sand, the wet sand of the flats, a wet rock shelf, shingle, the shrine's
// mosaic, the boardwalk's planks, an urchin bed; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './grotto_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  gt_mussels: A.MUSSELS, gt_coralwall: A.CORALWALL, gt_glowwall: A.GLOWWALL, gt_tidemark: A.TIDEMARK, gt_shellwall: A.SHELLWALL,
  gt_seadoor: A.SEADOOR, gt_eelhole: A.EELHOLE, gt_carving: A.CARVING,
};
// (Faces that read one way only: writing, a carving, a door.)
const FIXED = new Set(['gt_tidemark', 'gt_shellwall', 'gt_seadoor', 'gt_carving']);
const FLOORS = new Set(['gt_sand', 'gt_wetsand', 'gt_pebbles', 'gt_mosaic', 'gt_urchins']);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);

// The tops (16 by 16), or null if it isn't one of ours.
export function grottoTop(name, v) {
  if (name === 'gt_rock' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'gt_sand':
      return grid({ pal: FLOOR, rows: turned(A.SAND[(v >> 1) % 3], v) });
    case 'gt_wetsand':
      return grid({ pal: FLOOR, rows: turned(A.WETSAND[(v >> 1) % 3], v) });
    case 'gt_shelf':
      return grid({ pal: FLOOR, rows: turned(A.ROCK[(v >> 1) % 2], v) });
    case 'gt_pebbles':
      return grid({ pal: FLOOR, rows: turned(A.PEBBLES[(v >> 1) % 2], v) });
    case 'gt_mosaic':
      return grid({ pal: FLOOR, rows: A.MOSAIC[0] });
    case 'gt_boardwalk':
      return grid({ pal: FLOOR, rows: turned(A.PLANKS[(v >> 1) % 2], v) });
    case 'gt_urchins':
      return grid({ pal: FLOOR, rows: turned(A.URCHINS[(v >> 1) % 2], v) });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function grottoFront(name, v) {
  if (name === 'gt_rock') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FIXED.has(name) ? FACES[name] : turned(FACES[name], v) });
  if (name === 'gt_shelf') return grid({ pal: WALL, rows: turned(A.SHELFFACE, v) });
  if (name === 'gt_boardwalk') return grid({ pal: WALL, rows: A.STILTS });
  // (A floor seen from the side, where a pool's sunk: wet rock, weed.)
  if (FLOORS.has(name)) return grid({ pal: WALL, rows: turned(A.POOLFACE, v) });
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
const P = A.GROTTO_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
// (Turned either way by its rot.)
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (By its state: a scallop with its pearl laid in, a bell rung, a blowhole
// spouting.)
const byState = (off, on) => {
  const a = one(off);
  const b = one(on);
  return (rot, st, f) => (st ? b(f) : a(f));
};
// (One of several by its rot: a coral's kind, an anemone's colour.)
const byRot = (defs) => {
  const fs = defs.map(one);
  return (rot, st, f) => fs[rot % fs.length](f);
};
// (A clam by its state: shut; open (its rot's low bit: a pearl on its
// mantle).)
const CLAM = [one(P.gt_clam), one(P.gt_clam_open), one(P.gt_clam_pearl)];
export const GROTTO_SPRITES = {
  gt_kelp: plain(P.gt_kelp),
  gt_coral: byRot([P.gt_coral_0, P.gt_coral_1, P.gt_coral_2, P.gt_coral_3]),
  gt_anemone: byRot([P.gt_anemone_0, P.gt_anemone_1]),
  gt_clam: (rot, st, f) => (st ? CLAM[1 + (rot & 1)](f) : CLAM[0](f)),
  gt_scallop: byState(P.gt_scallop, P.gt_scallop_full),
  gt_net: plain(P.gt_net),
  gt_basket: either(P.gt_basket),
  gt_tidepole: plain(P.gt_tidepole),
  gt_bell: byState(P.gt_bell, P.gt_bell_rung),
  gt_ladder: plain(P.gt_ladder),
  gt_weights: either(P.gt_weights),
  gt_hull: either(P.gt_hull),
  gt_lantern: plain(P.gt_lantern),
  gt_blowhole: byState(P.gt_blowhole, P.gt_blowhole_on),
  gt_bones: either(P.gt_bones),
  gt_cairn: plain(P.gt_cairn),
  gt_driftwood: either(P.gt_driftwood),
  gt_firering: plain(P.gt_firering),
  gt_boulder: either(P.gt_boulder),
};
export const GROTTO_ANIM = {
  gt_kelp: 2, gt_anemone: 2, gt_net: 2, gt_lantern: 3, gt_blowhole: 2,
};
