// (Round 101) The Kiln-Deep's own, where each goes (the drawings are in
// art/forge_art.js): its wall of dressed basalt (three of it, and the first
// turned the other way), a flue's mouth, an iron band, the guild's mark, the
// tally, the guild-roll, the kiln-door, the guild-door, a gantry's girder,
// the brick lining of a pit; iron plates, basalt flags, a grate over fire,
// coal, ash, fired brick, a gantry's deck, a casting mould; and what's set
// about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './forge_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  fg_flue: A.FLUE, fg_ironband: A.IRONBAND, fg_relief: A.RELIEF, fg_tally: A.TALLY, fg_roll: A.ROLL,
  fg_kilndoor: A.KILNDOOR, fg_guilddoor: A.GUILDDOOR,
};
const FLOORS = new Set(['fg_plate', 'fg_flags', 'fg_grate', 'fg_coal', 'fg_ash', 'fg_brick', 'fg_mould', 'fg_keymould']);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);

// The tops (16 by 16), or null if it isn't one of ours.
export function forgeTop(name, v) {
  if (name === 'fg_wall' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 2], v) });
  switch (name) {
    case 'fg_plate':
      // (Worn bright where the ways are: one plate in four.)
      return grid({ pal: FLOOR, rows: A.PLATE[v % 4] });
    case 'fg_flags':
      return grid({ pal: FLOOR, rows: turned(A.FLAGS[(v >> 1) % 3], v) });
    case 'fg_grate':
      return grid({ pal: FLOOR, rows: A.GRATE[v % 2] });
    case 'fg_coal':
      return grid({ pal: FLOOR, rows: turned(A.COAL[(v >> 1) % 2], v) });
    case 'fg_ash':
      return grid({ pal: FLOOR, rows: turned(A.ASH[(v >> 1) % 2], v) });
    case 'fg_brick':
      return grid({ pal: FLOOR, rows: A.BRICK[v % 2] });
    case 'fg_gantry':
      return grid({ pal: FLOOR, rows: A.DECK });
    case 'fg_mould':
      return grid({ pal: FLOOR, rows: A.MOULD[0] });
    case 'fg_keymould':
      return grid({ pal: FLOOR, rows: A.MOULD[1] });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function forgeFront(name, v) {
  if (name === 'fg_wall') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: name === 'fg_relief' || name === 'fg_roll' || name === 'fg_kilndoor' ? FACES[name] : turned(FACES[name], v) });
  if (name === 'fg_gantry') return grid({ pal: WALL, rows: A.GANTRY });
  // (A floor seen from the side, where a pit's sunk: the brick lining it.)
  if (FLOORS.has(name)) return grid({ pal: WALL, rows: turned(A.BRICKFACE, v) });
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
const P = A.FORGE_PROPS;
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
// (By its state: a crucible tipped, a hammer down, a vent venting, a lever
// pulled, a key set.)
const byState = (off, on) => {
  const a = one(off);
  const b = one(on);
  return (rot, st, f) => (st ? b(f) : a(f));
};
// (One of several by its rot: an anvil's note, a masterwork.)
const byRot = (defs) => {
  const fs = defs.map(one);
  return (rot, st, f) => fs[rot % fs.length](f);
};
const SING = byRot([P.fg_singanvil_0, P.fg_singanvil_1, P.fg_singanvil_2]);
const SING_HOT = byRot([P.fg_singanvil_hot_0, P.fg_singanvil_hot_1, P.fg_singanvil_hot_2]);
export const FORGE_SPRITES = {
  fg_anvil: either(P.fg_anvil),
  fg_singanvil: (rot, st, f) => (st ? SING_HOT(rot, st, f) : SING(rot, st, f)),
  fg_crucible: byState(P.fg_crucible, P.fg_crucible_tipped),
  fg_bellows: either(P.fg_bellows),
  fg_hammer: byState(P.fg_hammer, P.fg_hammer_down),
  fg_brazier: plain(P.fg_brazier),
  fg_rack: either(P.fg_rack),
  fg_ingots: either(P.fg_ingots),
  fg_coalheap: either(P.fg_coalheap),
  fg_cart: either(P.fg_cart),
  fg_vent: byState(P.fg_vent, P.fg_vent_on),
  fg_lever: byState(P.fg_lever, P.fg_lever_on),
  fg_plinth: byRot([P.fg_plinth_0, P.fg_plinth_1, P.fg_plinth_2, P.fg_plinth_3]),
  fg_chain: plain(P.fg_chain),
  fg_banner: plain(P.fg_banner),
  fg_table: either(P.fg_table),
  fg_bench: either(P.fg_bench),
  fg_statue: plain(P.fg_statue),
  fg_slag: either(P.fg_slag),
  fg_ladder: plain(P.fg_ladder),
  fg_castkey: byState(P.fg_castkey, P.fg_castkey_set),
};
export const FORGE_ANIM = {
  fg_crucible: 2, fg_bellows: 2, fg_brazier: 3, fg_coalheap: 2, fg_vent: 2, fg_chain: 2, fg_banner: 2,
};
