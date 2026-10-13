// (Round 98) The holdout's own, where each goes (the drawings are in
// art/hold_art.js): its cave rock (warm under the fires, sooted above
// them), a timber shore, a palisade of logs, boards torn off caravans, the
// scaffold, a false wall over the stash; its packed earth, planks, a
// stolen rug, straw, a rope bridge's slats; on the floor, caltrops, a
// tripwire, a powder trail, a hide over a pit; and what's set about in it.
import { grid, frameOf } from '../pixart.js';
import * as A from './hold_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const ROCKS = [A.ROCK_A, A.ROCK_B, flipX(A.ROCK_A), A.SOOT];

// The tops (16 by 16), or null if it isn't one of ours.
export function holdTop(name, v) {
  switch (name) {
    case 'hold_rock':
    case 'hold_shore':
    case 'hold_false':
      return grid({ pal: A.FLOOR, rows: v % 2 ? A.TOP_B : A.TOP_A });
    case 'palisade':
      return grid({ pal: A.ROCK, rows: v % 2 ? flipX(A.PAL_TOP) : A.PAL_TOP });
    case 'hold_boards':
    case 'hold_scaffold':
    case 'hold_planks':
      return grid({ pal: A.FLOOR, rows: A.PLANKS[v % 3] });
    case 'hold_dirt':
      return grid({ pal: A.FLOOR, rows: A.DIRTS[v % 4] });
    case 'hold_rug':
      return grid({ pal: A.FLOOR, rows: A.RUGS[v % 4 === 3 ? 1 : 0] });
    case 'hold_straw':
      return grid({ pal: A.FLOOR, rows: v % 2 ? flipX(A.STRAWS[(v >> 1) % 2]) : A.STRAWS[(v >> 1) % 2] });
    case 'hold_bridge':
      return grid({ pal: A.FLOOR, rows: A.BRIDGE });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function holdFront(name, v) {
  switch (name) {
    case 'hold_rock':
      return grid({ pal: A.ROCK, rows: ROCKS[v % 4] });
    case 'hold_false':
      // (The stash's false wall: rock like the rest, near enough.)
      return grid({ pal: A.ROCK, rows: A.ROCK_B });
    case 'hold_shore':
      return grid({ pal: A.ROCK, rows: v % 2 ? flipX(A.SHORE) : A.SHORE });
    case 'palisade':
      return grid({ pal: A.ROCK, rows: v % 3 === 2 ? A.PAL_B : A.PAL_A });
    case 'hold_boards':
      return grid({ pal: A.ROCK, rows: v % 2 ? A.BOARDS_B : A.BOARDS_A });
    case 'hold_scaffold':
      return grid({ pal: A.ROCK, rows: A.SCAFFOLD });
    case 'hold_bridge':
      return grid({ pal: A.FLOOR, rows: A.BRIDGE_FACE });
    case 'hold_dirt':
      return grid({ pal: A.FLOOR, rows: A.DIRTS[v % 4].slice(0, 12) });
    case 'hold_planks':
      return grid({ pal: A.FLOOR, rows: A.PLANKS[v % 3].slice(0, 12) });
    case 'hold_rug':
      return grid({ pal: A.FLOOR, rows: A.RUGS[0].slice(0, 12) });
    case 'hold_straw':
      return grid({ pal: A.FLOOR, rows: A.STRAWS[0].slice(0, 12) });
    default:
      return null;
  }
}

// What lies flat on the floor (or null: none of ours).
export function holdFlat(name) {
  switch (name) {
    case 'hold_caltrops':
      return grid({ pal: A.FLOOR, rows: A.CALTROPS });
    case 'hold_tripwire':
      return grid({ pal: A.FLOOR, rows: A.TRIPWIRE });
    case 'hold_powder':
      return grid({ pal: A.FLOOR, rows: A.POWDER });
    case 'hold_hide':
      return grid({ pal: A.FLOOR, rows: A.HIDE });
    default:
      return null;
  }
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
// (One picture out of a prop's several: a crate's brand.)
const posed = (def, k) => {
  let p = null;
  return () => (p ||= frameOf(def, k)).copy();
};
const P = A.HOLD_PROPS;
export const HOLD_SPRITES = {
  hold_table: one(P.hold_table),
  hold_bench: one(P.hold_bench),
  hold_bunk: one(P.hold_bunk),
  hold_bedroll: one(P.hold_bedroll),
  hold_locker: one(P.hold_locker),
  hold_spit: one(P.hold_spit),
  ale_cask: one(P.ale_cask),
  dice_barrel: one(P.dice_barrel),
  crate_star: posed(P.plunder_crate, 0),
  crate_wheel: posed(P.plunder_crate, 1),
  crate_fish: posed(P.plunder_crate, 2),
  crate_tree: posed(P.plunder_crate, 3),
  crate_open: one(P.crate_open),
  cloth_bolts: one(P.cloth_bolts),
  loot_sacks: one(P.loot_sacks),
  smashed_wagon: one(P.smashed_wagon),
  armour_stand: one(P.armour_stand),
  hold_grind: one(P.grindstone),
  hold_cauldron: one(P.hold_cauldron),
  butcher_block: one(P.butcher_block),
  meat_hooks: one(P.meat_hooks),
  wanted_post: one(P.wanted_post),
  raid_map: one(P.raid_map),
  plunder_ledger: one(P.plunder_ledger),
  loot_throne: one(P.loot_throne),
  hold_lantern: one(P.hold_lantern),
  dog_bones: one(P.dog_bones),
};
export const HOLD_ANIM = { hold_spit: 3, hold_cauldron: 2, hold_lantern: 2 };
