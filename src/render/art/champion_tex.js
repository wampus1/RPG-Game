// (Round 111) The Hall of the Last Champion's own, where each goes (the
// drawings are in art/champion_art.js): its sandstone (three of it, the
// first turned the other way for a fourth); the frieze, the banner, the
// plaque of the fallen, the shield and spears, the laurel, the oath-door,
// the curse in the stone; the faces of a step and of a sunk floor; its
// floors; and what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './champion_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  ch_frieze: (v) => (v % 2 ? A.FRIEZE_1 : A.FRIEZE_0), ch_banner: (v) => (v % 2 ? A.BANNER_1 : A.BANNER_0), ch_plaque: () => A.PLAQUE, ch_arms: () => A.ARMS,
  ch_laurel: () => A.LAUREL, ch_oathdoor: () => A.OATHDOOR, ch_cursewall: (v) => (v % 2 ? A.CURSEWALL_1 : A.CURSEWALL_0),
};
const FLOORS = { ch_flags: A.FLAGS, ch_cracked: A.CRACKED, ch_runner: A.RUNNER, ch_cursed: A.CURSED };

// The tops (16 by 16), or null if it isn't one of ours.
export function championTop(name, v) {
  if (name === 'ch_stone' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  if (name === 'ch_runner') return grid({ pal: FLOOR, rows: A.RUNNER[0] });
  if (FLOORS[name]) return grid({ pal: FLOOR, rows: turned(FLOORS[name][(v >> 1) % FLOORS[name].length], v) });
  if (name === 'ch_dais') return grid({ pal: FLOOR, rows: turned(A.FLAGS[(v >> 1) % 2], v) });
  return null;
}
// The fronts (16 by 12).
export function championFront(name, v) {
  if (name === 'ch_stone') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'ch_dais') return grid({ pal: WALL, rows: A.DAIS });
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
const P = A.CHAMPION_PROPS;
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
// (A statue: which hero by its turn's second bit, faced by its first. A
// kneeling-stone: which virtue by its turn, kindled by its state.)
const statues = [either(P.ch_statue_0), either(P.ch_statue_1)];
const kneels = [0, 1, 2, 3].map((v) => [one(P[`ch_kneel_${v}`]), one(P[`ch_kneel_${v}_on`])]);
export const CHAMPION_SPRITES = {
  ch_statue: (rot, st, f) => statues[(rot >> 1) & 1](rot & 1, st, f),
  ch_kneel: (rot, st, f) => kneels[rot % 4][st ? 1 : 0](f),
  ch_ward: byState(P.ch_ward, P.ch_ward_cracked),
  ch_memorial: byState(P.ch_memorial_given, P.ch_memorial),
  ch_flowers: either(P.ch_flowers),
  ch_table: either(P.ch_table),
  ch_bench: either(P.ch_bench),
  ch_hearth: plain(P.ch_hearth),
  ch_armour: either(P.ch_armour),
  ch_dummy: either(P.ch_dummy),
  ch_cot: either(P.ch_cot),
  ch_rack: either(P.ch_rack),
  ch_brazier: plain(P.ch_brazier),
  ch_column: plain(P.ch_column),
  ch_growth: either(P.ch_growth),
  ch_lectern: either(P.ch_lectern),
  ch_candles: plain(P.ch_candles),
  ch_barricade: either(P.ch_barricade),
  ch_fallen: either(P.ch_fallen),
};
export const CHAMPION_ANIM = { ch_ward: 2, ch_hearth: 2, ch_brazier: 2, ch_growth: 3, ch_candles: 2 };
