// (Round 96) The mine's own, where each goes (the drawings are in
// art/mine_art.js): its hewn rock (four faces of it, and a vein, a seam of
// ore, a chalk cross), the timbering of its drifts, its props, benches cut
// in the rock and the steps up them, boards laid over a sump, the rubble
// that chokes a passage; the trodden spoil of its floor; the rails laid
// down its drifts (joined to their neighbours, round a bend in a curve);
// and what's set about in it.
import { grid, frameOf } from '../pixart.js';
import { Px } from '../pixel.js';
import * as A from './mine_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));

// The top of the rock, where a wall's cut off: a dark mass, close-grained,
// a crack or two across it, a chip of lighter stone; something of what's
// in it showing (a glint of ore, a smear of chalk, the end of a beam).
const MASS = { k: '#17120e', d: '#1f1813', e: '#261e17', E: '#2c231b', l: '#3a2f25', L: '#4a3d30' };
function rockMass(v, rand, extra = null) {
  const p = new Px(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = rand();
    p.set(x, y, r < 0.3 ? MASS.d : r < 0.5 ? MASS.E : r < 0.53 ? MASS.l : MASS.e);
  }
  // A crack wandering across it.
  let x = rand() * 16;
  let y = rand() * 4;
  for (let i = 0; i < 12 + (v % 3) * 2; i++) {
    p.set(Math.floor(x) & 15, Math.floor(y) & 15, MASS.k);
    x += rand() * 2 - 1;
    y += rand() < 0.7 ? 1 : 0;
  }
  // A chip of paler stone, lit on its top.
  const cx = Math.floor(rand() * 13);
  const cy = Math.floor(rand() * 13);
  p.set(cx, cy, MASS.L);
  p.set(cx + 1, cy, MASS.l);
  p.set(cx, cy + 1, MASS.l);
  p.set(cx + 1, cy + 1, MASS.k);
  if (extra) extra(p, rand);
  return p;
}
const glints = (cols) => (p, rand) => {
  for (let i = 0; i < 5; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), cols[i % cols.length]);
};
const beamEnd = (p) => {
  // The end of a squared timber let into the rock: its rings.
  p.rect(5, 5, 6, 6, '#3a2513');
  p.rect(6, 6, 4, 4, '#55381c');
  p.rect(7, 7, 2, 2, '#3a2513');
  p.hline(5, 10, 5, '#68441f');
};

// The tops (16 by 16), or null if it isn't one of ours.
export function mineTop(name, v, rand = Math.random) {
  switch (name) {
    case 'mine_rock':
    case 'mine_quartz':
    case 'mine_seep':
      return rockMass(v, rand);
    case 'rich_vein':
      return rockMass(v, rand, glints(['#e8c050', '#a8802c', '#0e0d10']));
    case 'chalk_mark':
      return rockMass(v, rand, glints(['#d8d8cc', '#4a3d30']));
    case 'mine_timber':
    case 'mine_beam':
      return rockMass(v, rand, beamEnd);
    case 'cart_choke':
      return rockMass(v + 1, rand, glints(['#68441f', '#625141', '#76634f']));
    case 'mine_fall':
      return rockMass(v + 2, rand, glints(['#625141', '#76634f', '#4a3d30']));
    case 'mine_floor':
      return grid({ pal: A.FLOOR, rows: [A.FLOORS[0], A.FLOORS[1], A.FLOORS[2], A.FLOORS[3]][v % 4] });
    case 'mine_bench':
      // Cut rock, flat and paler than the floor round it, chisel-lined.
      return grid({ pal: { ...A.FLOOR, e: '#4a3d30', E: '#54453a', d: '#3e3228', l: '#5e4e40' }, rows: v % 2 ? flipX(A.FLOORS[0]) : A.FLOORS[2] });
    case 'mine_boards':
      return grid({ pal: A.BOARDS, rows: v % 2 ? flipX(A.BOARDS_A) : A.BOARDS_A });
    default:
      return null;
  }
}

// The fronts (16 by 12).
const FALL_PAL = { ...A.CHOKE_PAL, w: '#2a2119', W: '#362c24', t: '#544538', T: '#625141', n: '#1c1612', N: '#2a2119' };
const ROCKS = [A.ROCK_A, A.ROCK_B, A.ROCK_VEIN, A.ROCK_WET];
// (The prop's own timber and iron over the rock it stands in.)
const BEAM_PAL = { ...A.ROCK, t: A.WOOD.t, T: A.WOOD.T, W: A.WOOD.W, w: A.WOOD.w, n: A.WOOD.n, N: A.WOOD.N, i: A.WOOD.i, I: A.WOOD.I };
export function mineFront(name, v) {
  switch (name) {
    case 'mine_rock':
      return grid({ pal: A.ROCK, rows: [ROCKS[0], ROCKS[1], flipX(ROCKS[0]), flipX(ROCKS[1])][v % 4] });
    // (A vein of quartz through it, or the wet where water seeps down it:
    // set here and there, see world/deeps/mine.js.)
    case 'mine_quartz':
      return grid({ pal: A.ROCK, rows: v % 2 ? flipX(ROCKS[2]) : ROCKS[2] });
    case 'mine_seep':
      return grid({ pal: A.ROCK, rows: v % 2 ? flipX(ROCKS[3]) : ROCKS[3] });
    case 'rich_vein':
      return grid({ pal: A.ROCK, rows: v % 2 ? flipX(A.ROCK_ORE) : A.ROCK_ORE });
    case 'chalk_mark':
      return grid({ pal: A.ROCK, rows: A.ROCK_CHALK });
    case 'mine_timber':
      return grid({ pal: A.WOOD, rows: v % 2 ? flipX(A.TIMBER) : A.TIMBER });
    case 'mine_beam':
      return grid({ pal: BEAM_PAL, rows: v % 2 ? flipX(A.BEAM) : A.BEAM });
    case 'mine_bench':
      return grid({ pal: A.ROCK, rows: A.BENCH });
    case 'cart_choke':
      return grid({ pal: A.CHOKE_PAL, rows: v % 2 ? flipX(A.CHOKE) : A.CHOKE });
    // (A fall of rock: the choke's broken stone, without its timber.)
    case 'mine_fall':
      return grid({ pal: FALL_PAL, rows: v % 2 ? flipX(A.CHOKE) : A.CHOKE });
    case 'mine_floor':
      return grid({ pal: A.FLOOR, rows: A.FLOORS[v % 4].slice(0, 12) });
    case 'mine_boards':
      return grid({ pal: A.BOARDS, rows: A.BOARDS_A.slice(3, 15) });
    default:
      return null;
  }
}

// ------------------------------------------------------------ the rails
// A length of track seen from above (v: which sides it runs on into more
// track, as the screen has it: 1 up, 2 right, 4 down, 8 left): two iron
// rails on wooden sleepers; straight through, or round a bend in a curve,
// or meeting at a junction.
const RAIL = { sl: '#3e2814', SL: '#5e3e1e', sk: '#1e140a', r: '#4a4a52', R: '#8a8a96', rk: '#16161a' };
function sleeperH(p, y, x0 = 2, x1 = 13) {
  p.hline(x0, x1, y, RAIL.SL);
  p.hline(x0, x1, y + 1, RAIL.sl);
  p.set(x0 - 1, y + 1, RAIL.sk);
  p.hline(x0, x1, y + 2, RAIL.sk);
}
function sleeperV(p, x, y0 = 2, y1 = 13) {
  for (let y = y0; y <= y1; y++) {
    p.set(x, y, RAIL.SL);
    p.set(x + 1, y, RAIL.sl);
    p.set(x + 2, y, RAIL.sk);
  }
}
function straightV(p, y0 = 0, y1 = 15, sleepers = true) {
  if (sleepers) for (let y = y0 + 1; y < y1; y += 5) sleeperH(p, y);
  for (let y = y0; y <= y1; y++) {
    for (const x of [4, 11]) {
      p.set(x, y, RAIL.R);
      p.set(x + 1, y, RAIL.r);
      p.set(x + 2, y, RAIL.rk);
    }
  }
}
function straightH(p, x0 = 0, x1 = 15, sleepers = true) {
  if (sleepers) for (let x = x0 + 1; x < x1; x += 5) sleeperV(p, x);
  for (let x = x0; x <= x1; x++) {
    for (const y of [4, 11]) {
      p.set(x, y, RAIL.R);
      p.set(x, y + 1, RAIL.r);
      p.set(x, y + 2, RAIL.rk);
    }
  }
}
// Round a bend: the rails as quarter circles about the corner between the
// two sides it runs to, sleepers across them.
function bend(p, cx, cy) {
  const at = (r, a) => [Math.round(cx + Math.cos(a) * r * (cx ? -1 : 1) - (cx ? 0.5 : -0.5)), Math.round(cy + Math.sin(a) * r * (cy ? -1 : 1) - (cy ? 0.5 : -0.5))];
  const put = (x, y, c) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) p.set(x, y, c);
  };
  // The sleepers, three of them, laid across the bend (each two wide).
  for (const a0 of [0.2, 0.78, 1.36]) {
    for (const da of [0, 0.09]) for (let r = 3; r <= 14; r += 0.5) put(...at(r, a0 + da), da ? RAIL.sl : RAIL.SL);
    for (let r = 3; r <= 14; r += 0.5) put(...at(r, a0 + 0.18), RAIL.sk);
  }
  // The rails over them: each a bright edge, its body, its shadow.
  for (const [rad, col] of [[5, 'R'], [6, 'r'], [7, 'rk'], [12, 'R'], [13, 'r'], [14, 'rk']]) {
    for (let t = 0; t <= 96; t++) put(...at(rad, (t / 96) * (Math.PI / 2)), RAIL[col]);
  }
}
export function railSprite(v) {
  const m = v & 15;
  const p = new Px(16, 16);
  const up = m & 1;
  const rt = m & 2;
  const dn = m & 4;
  const lf = m & 8;
  const n = (up ? 1 : 0) + (rt ? 1 : 0) + (dn ? 1 : 0) + (lf ? 1 : 0);
  if (n === 2 && !((up && dn) || (lf && rt))) {
    bend(p, rt ? 16 : 0, dn ? 16 : 0);
    return p;
  }
  const vert = up || dn;
  const horz = lf || rt;
  // (On its own, or only up and down: north to south. Only side to side:
  // across. Both: a junction, the one laid over the other.)
  if (!horz) straightV(p);
  else if (!vert) straightH(p);
  else {
    straightV(p);
    straightH(p, 0, 15, false);
  }
  return p;
}

// A rail as the floor draws it (or null: it isn't).
export function mineFlat(name, v) {
  if (name === 'mine_rail') return railSprite(v);
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
const P = A.MINE_PROPS;
// (The switch thrown one way or the other: see game/minework.js.)
const SWITCH = [one({ ...P.rail_switch, frames: undefined }), one({ ...P.rail_switch, rows: P.rail_switch.rows.map((r, i) => P.rail_switch.frames[1][i] ?? r), frames: undefined })];
export const MINE_SPRITES = {
  pit_lamp: one(P.pit_lamp),
  tally_board: one(P.tally_board),
  headframe: one(P.headframe),
  mine_pump: one(P.mine_pump),
  cracked_prop: one(P.cracked_prop),
  shaft_bell: one(P.shaft_bell),
  miner_bunk: one(P.miner_bunk),
  cold_stove: one(P.cold_stove),
  tool_rack: one(P.tool_rack),
  firedamp: one(P.firedamp),
  egg_sac: one(P.egg_sac),
  survey_table: one(P.survey_table),
  lamp_tin: one(P.lamp_tin),
  mine_cart: one(P.ore_cart),
  runaway_cart: one(P.ore_cart),
  ore_pile: one(P.ore_pile),
  rail_switch: (rot, st, f) => SWITCH[st ? 1 : 0](rot, st, f),
};
export const MINE_ANIM = { pit_lamp: 3, cracked_prop: 2, firedamp: 4, egg_sac: 2 };
