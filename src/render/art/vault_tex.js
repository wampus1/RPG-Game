// (Round 104) The Terracotta Vault's own, where each goes (the drawings are
// in art/vault_art.js): its rammed earth (three of it, the first turned the
// other way for a fourth); the palace's lacquer, the four beasts, the bronze
// door, a crossbow's slot, a stele, the artisans' tally and the crack by it,
// the clay heads, a kiln; the faces of a ridge, the dais, a channel, and of
// a floor where it's sunk (a trench); its floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './vault_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  tv_lacquer: () => A.LACQUER, tv_roundel: () => A.LACQUER_B,
  tv_dragon: () => A.DRAGON, tv_bird: () => A.BIRD, tv_tiger: () => A.TIGER, tv_tortoise: () => A.TORTOISE,
  tv_bronzedoor: () => A.BRONZEDOOR, tv_crossbow: () => A.CROSSBOW, tv_stele: () => A.STELE, tv_tally: () => A.TALLY,
  // (The crack gives nothing away from the front but its line.)
  tv_crack: () => A.WALL_C,
  tv_heads: () => A.HEADS, tv_kiln: () => A.KILN,
};
const FLOORS = new Set(['tv_brick', 'tv_plate', 'tv_loess', 'tv_stone', 'tv_lacquerfloor', 'tv_jade', 'tv_bridge']);
const PALACE = new Set(['tv_stone', 'tv_lacquerfloor', 'tv_jade', 'tv_bridge']);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
// (A plate in the floor. Round 116: a bronze-rimmed slab set in the bricks,
// a mark cut in it, plain to see from across the room: step round it.)
const PLATE = A.BRICK[0].map((r, y) => {
  if (y < 2 || y > 13) return r;
  return [...r].map((c, x) => {
    if (x < 2 || x > 13) return c;
    if (y === 2 || x === 2) return 'C';
    if (y === 13 || x === 13) return 'b';
    if (y === 3 || x === 3) return 'c';
    if (y === 12 || x === 12) return 'B';
    // The mark: a ring cut in the slab.
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
    if (d >= 2 && d < 3) return 'k';
    if (d >= 3 && d < 3.5) return 'H';
    return y < 6 && x < 6 ? 'Q' : 'S';
  }).join('');
});

// The tops (16 by 16), or null if it isn't one of ours.
export function vaultTop(name, v) {
  if (name === 'tv_earth' || name === 'tv_ridge' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'tv_brick':
      return grid({ pal: FLOOR, rows: A.BRICK[v % 3] });
    case 'tv_plate':
      return grid({ pal: FLOOR, rows: PLATE });
    case 'tv_loess':
      return grid({ pal: FLOOR, rows: turned(A.LOESS[(v >> 1) % 2], v) });
    case 'tv_stone':
      return grid({ pal: FLOOR, rows: turned(A.STONE[(v >> 1) % 2], v) });
    case 'tv_lacquerfloor':
    case 'tv_dais':
      return grid({ pal: FLOOR, rows: A.LACQUERF[(v >> 1) % 2] });
    case 'tv_mercury':
      return grid({ pal: FLOOR, rows: A.MERCURY[v % 3] });
    case 'tv_jade':
      return grid({ pal: FLOOR, rows: A.JADE[0] });
    case 'tv_bridge':
      return grid({ pal: FLOOR, rows: A.BRONZE[0] });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function vaultFront(name, v) {
  if (name === 'tv_earth') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'tv_ridge') return grid({ pal: WALL, rows: turned(A.RIDGE, v) });
  if (name === 'tv_dais') return grid({ pal: WALL, rows: A.DAIS });
  // (The quicksilver's channel: its bronze lining.)
  if (name === 'tv_mercury') return grid({ pal: WALL, rows: A.CHANNEL });
  // (A floor seen from the side, where it's sunk: in the pits, a trench's
  // earth; in the palace, the bronze lining of a river's channel.)
  if (PALACE.has(name)) return grid({ pal: WALL, rows: A.CHANNEL });
  if (FLOORS.has(name)) return grid({ pal: WALL, rows: turned(A.TRENCH, v) });
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
const P = A.VAULT_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (A lamp by its state: lit, its flame moving; or dark.)
const byState = (on, off) => {
  const a = one(on);
  const b = one(off);
  return (rot, st, f) => (st ? a(f) : b(f));
};
// (One of several by its rot: which soldier, which mountain.)
const byRot = (defs) => {
  const fs = defs.map(one);
  return (rot, st, f) => fs[rot % fs.length](f);
};
// (A jade disc, its colour its own; shining once all five are set.)
const disc = (c) => byState(P[`tv_pedestal_${c}_lit`], P[`tv_pedestal_${c}`]);
export const VAULT_SPRITES = {
  tv_soldier: byRot([0, 1, 2, 3].map((k) => P[`tv_soldier_${k}`])),
  tv_shards: byRot([P.tv_shards_0, P.tv_shards_1]),
  tv_horse: plain(P.tv_horse),
  tv_column: plain(P.tv_column),
  tv_lamp: byState(P.tv_lamp, P.tv_lamp_off),
  tv_lantern: byState(P.tv_lantern, P.tv_lantern_off),
  tv_ding: plain(P.tv_ding),
  tv_bells: plain(P.tv_bells),
  tv_drum: plain(P.tv_drum),
  tv_screen: either(P.tv_screen),
  tv_throne: plain(P.tv_throne),
  tv_mountain: byRot([P.tv_mountain_0, P.tv_mountain_1]),
  tv_disc_green: disc(0),
  tv_disc_red: disc(1),
  tv_disc_white: disc(2),
  tv_disc_black: disc(3),
  tv_disc_yellow: disc(4),
  tv_torso: either(P.tv_torso),
  tv_clay: either(P.tv_clay),
  tv_bones: either(P.tv_bones),
  tv_armour: plain(P.tv_armour),
  tv_rack: either(P.tv_rack),
  tv_beam: either(P.tv_beam),
  tv_jars: either(P.tv_jars),
};
export const VAULT_ANIM = {
  tv_lamp: 3, tv_lantern: 2,
};
