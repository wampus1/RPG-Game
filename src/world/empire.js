// (Round 70) An empire's city, filled out: its people's houses and shops
// thick along every street, and the places a great city has that a town
// hasn't, each a landmark to know your way by: an arena (its stands, its
// sand, its banners) where crowds watch the bouts; a training ground with
// its dummies and racks; a park, hedged, with a fountain, flower beds and
// benches; pens for the city's beasts by its stables; a monument on its
// own square; a market of stalls; and an academy. Laid out by
// settlement.js (see placeBuildingsSteps) after everything a town of its
// size would have, in whatever's left.
import { GROUND, SURFACE } from '../config.js';
import { B, META_STATE, CANOPY_SHIFT, CANOPY_STYLE_SHIFT, CANOPY_STYLES } from './blocks.js';
import { M } from './settlement.js';

const Y0 = GROUND;
const LIT = META_STATE;

// The landmarks, in the order they claim ground, each with the sizes it
// can be laid out at (across, deep) and how it's laid.
export const LANDMARKS = [
  { kind: 'arena', name: 'Arena', sizes: [[19, 15], [17, 13], [15, 11]], lay: arena },
  { kind: 'park', name: 'Gardens', sizes: [[15, 13], [13, 11], [11, 9]], lay: park },
  { kind: 'training', name: 'Training Ground', sizes: [[15, 9], [13, 9], [11, 7]], lay: training },
  { kind: 'pens', name: 'Beast Pens', sizes: [[13, 9], [11, 8], [9, 7]], lay: pens },
  { kind: 'market', name: 'Market', sizes: [[13, 9], [11, 7], [9, 7]], lay: market },
  { kind: 'monument', name: 'Monument', sizes: [[9, 9], [7, 7]], lay: monument },
];

// Ground no landmark may cover (or stand right beside). (Made when first
// wanted: settlement.js, where M is, imports this.)
let BAD = null;

// Lay an empire city's quarter out (on Layout `L`).
export function empireQuarter(L, rng) {
  const steps = empireQuarterSteps(L, rng);
  while (!steps.next().done);
}

// (Round 77) A step at a time, so a far city laid out in the background
// never holds up a frame for long.
export function* empireQuarterSteps(L, rng) {
  L.landmarks ||= [];
  L.pens ||= [];
  const s = L.settlement;
  // Its academy first (it wants the most ground), else a research hall.
  const has = (t) => L.buildings.some((b) => b.type === t);
  if (!has('college') && !(yield* L.placeBuildingSteps('college', near(L, L.frontage()), rng)) && !has('academy')) yield* L.placeBuildingSteps('academy', near(L, L.frontage()), rng);
  yield;
  // The landmarks, each where it fits best (the arena and the park toward
  // the middle; the pens out toward the edge).
  for (const lm of LANDMARKS) {
    const lot = findLot(L, lm.sizes, rng, lm.kind === 'pens' ? 'edge' : 'mid');
    yield;
    if (!lot) continue;
    claim(L, lot);
    const mark = { kind: lm.kind, name: `${s.name} ${lm.name}`, x0: lot.x, z0: lot.z, x1: lot.x + lot.W - 1, z1: lot.z + lot.D - 1 };
    lm.lay(L, lot, rng, mark);
    L.landmarks.push(mark);
    yield;
  }
  // Stables for its horses, by its pens if it can.
  if (!has('stables')) yield* L.placeBuildingSteps('stables', near(L, L.frontage()), rng);
  yield;
  // And its streets built up: houses (for those still to come), and a few
  // more shops among them, on every lot that's left by a street.
  let n = 0;
  for (let tries = 0; tries < 400 && n < 60; tries++) {
    const cands = rng.shuffle(L.frontage());
    if (!cands.length) break;
    const t = rng.pick(['house_s', 'house_s', 'house_m', 'house_m', 'house_l', 'shop']);
    const b = yield* L.placeBuildingSteps(t, cands.slice(0, 300), rng);
    if (!b) {
      if (!(yield* L.placeBuildingSteps('house_s', cands.slice(0, 300), rng))) break;
    }
    n++;
    yield;
  }
  L.fillers = n;
}

// The best open ground of one of `sizes`, beside a street.
function findLot(L, sizes, rng, prefer) {
  const b = L.bounds;
  const Wd = L.W;
  const Dd = L.D;
  const sat = (fn) => {
    const t = new Int32Array((Wd + 1) * (Dd + 1));
    for (let z = 0; z < Dd; z++) {
      for (let x = 0; x < Wd; x++) {
        const v = fn(b.x0 + x, b.z0 + z) ? 1 : 0;
        t[(z + 1) * (Wd + 1) + x + 1] = v + t[z * (Wd + 1) + x + 1] + t[(z + 1) * (Wd + 1) + x] - t[z * (Wd + 1) + x];
      }
    }
    return (x0, z0, x1, z1) => {
      const a = Math.max(0, x0 - b.x0);
      const c = Math.max(0, z0 - b.z0);
      const e = Math.min(Wd, x1 - b.x0 + 1);
      const f = Math.min(Dd, z1 - b.z0 + 1);
      if (e <= a || f <= c) return 0;
      return t[f * (Wd + 1) + e] - t[c * (Wd + 1) + e] - t[f * (Wd + 1) + a] + t[c * (Wd + 1) + a];
    };
  };
  const free = sat((x, z) => {
    const m = L.maskAt(x, z);
    return m === M.FREE || m === M.YARD;
  });
  BAD ||= new Set([M.BUILD, M.WALL, M.FIELD, M.WATER, M.PLAZA, M.DECOR, M.BRIDGE]);
  const bad = sat((x, z) => BAD.has(L.maskAt(x, z)));
  const road = sat((x, z) => L.maskAt(x, z) === M.ROAD);
  const p = L.plaza;
  const cx0 = p ? p.cx : (b.x0 + b.x1) / 2;
  const cz0 = p ? p.cz : (b.z0 + b.z1) / 2;
  for (const [W, D] of sizes) {
    let best = null;
    for (let z = b.z0 + 2; z + D <= b.z1 - 1; z++) {
      for (let x = b.x0 + 2; x + W <= b.x1 - 1; x++) {
        if (free(x, z, x + W - 1, z + D - 1) !== W * D) continue;
        if (bad(x - 1, z - 1, x + W, z + D) > 0) continue;
        // (Somewhere you can walk in from: a street along a side.)
        const ring = road(x - 2, z - 2, x + W + 1, z + D + 1);
        if (!ring) continue;
        const d = Math.hypot(x + W / 2 - cx0, z + D / 2 - cz0);
        const score = (prefer === 'edge' ? -d : d) + rng.float(0, 8);
        if (!best || score < best.score) best = { x, z, W, D, score };
      }
    }
    if (best) return best;
  }
  return null;
}

function claim(L, lot) {
  for (let dz = 0; dz < lot.D; dz++) for (let dx = 0; dx < lot.W; dx++) L.setMask(lot.x + dx, lot.z + dz, M.DECOR);
}

// The street tiles round a lot (where its gates go), nearest the middle of
// each side first.
function gates(L, lot) {
  const out = [];
  const { x, z, W, D } = lot;
  const mx = x + Math.floor(W / 2);
  const mz = z + Math.floor(D / 2);
  const roadNear = (px, pz) => L.maskAt(px, pz) === M.ROAD;
  if (roadNear(mx, z - 1) || roadNear(mx, z - 2)) out.push({ side: 'n', x: mx, z });
  if (roadNear(mx, z + D) || roadNear(mx, z + D + 1)) out.push({ side: 's', x: mx, z: z + D - 1 });
  if (roadNear(x - 1, mz) || roadNear(x - 2, mz)) out.push({ side: 'w', x, z: mz });
  if (roadNear(x + W, mz) || roadNear(x + W + 1, mz)) out.push({ side: 'e', x: x + W - 1, z: mz });
  if (!out.length) out.push({ side: 's', x: mx, z: z + D - 1 });
  return out;
}

// Is (px, pz) on the edge of the lot, and is it a gate (or by one)?
function edgeOf(lot, px, pz) {
  return px === lot.x || pz === lot.z || px === lot.x + lot.W - 1 || pz === lot.z + lot.D - 1;
}
function atGate(gs, px, pz, wide = 1) {
  return gs.some((g) => (g.side === 'n' || g.side === 's' ? Math.abs(px - g.x) <= wide && pz === g.z : Math.abs(pz - g.z) <= wide && px === g.x));
}

// The city's own stone (and its trim), for what's built of it.
function stone(L, rng) {
  const m = L.buildingMats('temple', rng);
  return { wall: m.wall, corner: m.corner || m.wall, floor: m.floor };
}

function floor(L, lot, id) {
  for (let dz = 0; dz < lot.D; dz++) for (let dx = 0; dx < lot.W; dx++) L.put(lot.x + dx, SURFACE, lot.z + dz, id);
}

function lamp(L, x, z) {
  L.put(x, Y0, z, B.fence);
  L.put(x, Y0 + 1, z, B.lantern, LIT);
}

// ------------------------------------------------------------ the arena
// An oval of stands two steps high round a floor of sand, gates in its
// sides, banners at its ends; a pair of dummies at its heart. The crowd
// stand on the steps to watch; the city's fighters spar on the sand.
function arena(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  const st = stone(L, rng);
  // (Two gates, facing each other: the stands a ring, not four corners.)
  const all = gates(L, lot);
  const ns = all.filter((g) => g.side === 'n' || g.side === 's');
  const gs = ns.length ? ns : all.slice(0, 2);
  const cx = x + (W - 1) / 2;
  const cz = z + (D - 1) / 2;
  const rx = (W - 1) / 2;
  const rz = (D - 1) / 2;
  const ring = (px, pz) => ((px - cx) / rx) ** 2 + ((pz - cz) / rz) ** 2;
  for (let dz = 0; dz < D; dz++) {
    for (let dx = 0; dx < W; dx++) {
      const px = x + dx;
      const pz = z + dz;
      const r = ring(px, pz);
      if (r > 1.02) continue;
      const gate = gs.some((g) => (g.side === 'n' || g.side === 's' ? Math.abs(px - g.x) <= 1 : Math.abs(pz - g.z) <= 1)) && r > 0.45;
      if (gate) {
        L.put(px, SURFACE, pz, B.sand);
        continue;
      }
      if (r > 0.78) {
        // The outer wall, two high, and the step inside it.
        L.put(px, SURFACE, pz, st.floor);
        L.put(px, Y0, pz, st.wall);
        L.put(px, Y0 + 1, pz, st.wall);
      } else if (r > 0.58) {
        L.put(px, SURFACE, pz, st.floor);
        L.put(px, Y0, pz, st.corner);
      } else L.put(px, SURFACE, pz, B.sand);
    }
  }
  // Banners at its ends, lamps by its gates.
  L.put(Math.round(cx), Y0 + 2, z + 1, B.war_banner);
  L.put(Math.round(cx), Y0 + 2, z + D - 2, B.war_banner);
  for (const g of gs) {
    const [ox, oz] = g.side === 'n' || g.side === 's' ? [2, 0] : [0, 2];
    if (L.maskAt(g.x - ox, g.z - oz) !== M.BUILD) L.put(g.x - ox, Y0 + 2, g.z - oz, B.lantern, LIT);
    if (L.maskAt(g.x + ox, g.z + oz) !== M.BUILD) L.put(g.x + ox, Y0 + 2, g.z + oz, B.lantern, LIT);
  }
  // Two dummies to spar at, and a rack.
  const mx = Math.round(cx);
  const mz = Math.round(cz);
  L.put(mx - 2, Y0, mz, B.training_dummy);
  L.put(mx + 2, Y0, mz, B.training_dummy);
  L.put(mx, Y0, mz - Math.max(1, Math.floor(rz * 0.4)), B.weapon_rack);
  L.addSpot(mx - 1, mz, 1, ['train']);
  L.addSpot(mx + 1, mz, 3, ['train']);
  // Where the crowd stands to watch (on the inner step, facing in).
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * rx * 0.7);
    const pz = Math.round(cz + Math.sin(a) * rz * 0.7);
    const r = ring(px, pz);
    if (r < 0.5 || r > 0.78) continue;
    const face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 1 : 3) : Math.sin(a) > 0 ? 2 : 0;
    L.addSpot(px, pz, face, ['social', 'gossip', 'play', 'stroll'], { y: Y0 + 1 });
  }
  mark.at = { x: mx, z: mz };
}

// ------------------------------------------------------------ the park
// Lawns behind a hedge, the gaps its gates, a fountain at its heart on its
// plinth, flower beds, benches facing the water, a lamp at each corner.
function park(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  const gs = gates(L, lot);
  floor(L, lot, B.grass_lush);
  const mx = x + Math.floor(W / 2);
  const mz = z + Math.floor(D / 2);
  const flowers = [B.flower_red, B.flower_yellow, B.flower_white, B.flower_blue].filter((q) => q !== undefined);
  for (let dz = 0; dz < D; dz++) {
    for (let dx = 0; dx < W; dx++) {
      const px = x + dx;
      const pz = z + dz;
      if (edgeOf(lot, px, pz)) {
        if (atGate(gs, px, pz, 1)) {
          L.put(px, SURFACE, pz, B.gravel);
          continue;
        }
        L.put(px, Y0, pz, B.leaves_oak);
        continue;
      }
      // Gravel walks from the gates to the fountain.
      const walk = (Math.abs(px - mx) <= 0 && gs.some((g) => g.side === 'n' || g.side === 's')) || (Math.abs(pz - mz) <= 0 && gs.some((g) => g.side === 'w' || g.side === 'e'));
      if (walk || (Math.abs(px - mx) <= 2 && Math.abs(pz - mz) <= 2)) {
        L.put(px, SURFACE, pz, B.gravel);
        continue;
      }
      // Beds of flowers, and the odd young tree.
      const bed = (dx % 4 === 2 && dz % 3 === 1) || (dx % 4 === 3 && dz % 3 === 1);
      if (bed && flowers.length) L.put(px, Y0, pz, rng.pick(flowers));
      else if (dx > 1 && dz > 1 && dx < W - 2 && dz < D - 2 && rng.chance(0.06) && B.sapling !== undefined) L.put(px, Y0, pz, B.sapling);
      else if (rng.chance(0.08) && B.tall_grass !== undefined) L.put(px, Y0, pz, B.tall_grass);
    }
  }
  // The fountain, on its plinth.
  L.put(mx, Y0, mz, B.fountain);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) L.put(mx + dx, Y0, mz + dz, B.plinth);
  if (L.wells) L.wells.push({ x: mx, z: mz + 2 });
  // Benches round it, facing it.
  for (const [dx, dz, face] of [[0, -3, 0], [0, 3, 2], [-3, 0, 3], [3, 0, 1]]) {
    if (Math.abs(dz) >= Math.floor(D / 2) || Math.abs(dx) >= Math.floor(W / 2)) continue;
    const bx = mx + dx + (dz ? 1 : 0);
    const bz = mz + dz + (dx ? 1 : 0);
    L.put(bx, Y0, bz, B.bench, face);
    L.addSpot(bx, bz, face, ['rest', 'read', 'social', 'music', 'sketch', 'stargaze']);
  }
  // Lamps in its corners.
  for (const [px, pz] of [[x + 1, z + 1], [x + W - 2, z + 1], [x + 1, z + D - 2], [x + W - 2, z + D - 2]]) lamp(L, px, pz);
  for (let k = 0; k < 4; k++) L.addSpot(mx + rng.int(-W / 2 + 2, W / 2 - 2), mz + rng.int(-D / 2 + 2, D / 2 - 2), rng.int(0, 3), ['stroll', 'play', 'sketch', 'music', 'gossip']);
  mark.at = { x: mx, z: mz };
}

// ------------------------------------------------------------ training
// A fenced yard of beaten gravel: a row of dummies, racks of arms, butts
// of hay to loose at, a banner; where the guard and the city's fighters
// train.
function training(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  const gs = gates(L, lot);
  floor(L, lot, B.gravel);
  for (let dz = 0; dz < D; dz++) {
    for (let dx = 0; dx < W; dx++) {
      const px = x + dx;
      const pz = z + dz;
      if (edgeOf(lot, px, pz) && !atGate(gs, px, pz, 0)) L.put(px, Y0, pz, B.fence);
    }
  }
  // Dummies down the middle, each with a place to stand at it.
  const mz = z + Math.floor(D / 2);
  for (let px = x + 2; px <= x + W - 3; px += 3) {
    L.put(px, Y0, mz - 1, B.training_dummy);
    L.addSpot(px, mz, 2, ['train']);
  }
  // Racks along the back, hay butts at the far end to shoot at.
  for (let px = x + 2; px <= x + W - 3; px += 4) L.put(px, Y0, z + 1, B.weapon_rack);
  for (let pz = z + 2; pz <= z + D - 3; pz += 2) L.put(x + W - 2, Y0, pz, B.hay_bale);
  L.addSpot(x + 2, z + D - 2, 1, ['train']);
  L.put(x + 1, Y0, z + D - 2, B.war_banner);
  lamp(L, x + 1, z + 1);
  mark.at = { x: x + Math.floor(W / 2), z: mz };
}

// ------------------------------------------------------------ the pens
// Fenced pens of the city's beasts (sheep, goats' cousins, pigs, a cow or
// two) on straw, a water barrel and hay in each; people stop by the fence
// to look.
function pens(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  const gs = gates(L, lot);
  floor(L, lot, B.dirt);
  const half = x + Math.floor(W / 2);
  for (let dz = 0; dz < D; dz++) {
    for (let dx = 0; dx < W; dx++) {
      const px = x + dx;
      const pz = z + dz;
      if ((edgeOf(lot, px, pz) && !atGate(gs, px, pz, 0)) || (px === half && pz !== z + Math.floor(D / 2))) L.put(px, Y0, pz, B.fence);
    }
  }
  const kinds = ['sheep', 'pig', 'cow', 'sheep', 'chicken'];
  for (const [x0, x1] of [[x + 1, half - 1], [half + 1, x + W - 2]]) {
    if (x1 - x0 < 1) continue;
    L.put(x0, Y0, z + 1, B.hay_bale);
    L.put(x1, Y0, z + D - 2, B.barrel);
    L.pens.push({ x0, z0: z + 1, x1, z1: z + D - 2, kinds: [rng.pick(kinds), rng.pick(kinds)], n: 2 + rng.int(0, 2) });
  }
  for (const g of gs) L.addSpot(g.x + (g.side === 'w' ? -1 : g.side === 'e' ? 1 : 0), g.z + (g.side === 'n' ? -1 : g.side === 's' ? 1 : 0), 0, ['stroll', 'sketch', 'gossip']);
  lamp(L, x + W - 1, z);
  mark.at = { x: half, z: z + Math.floor(D / 2) };
}

// ------------------------------------------------------------ the market
// Rows of stalls under their canopies on a paved yard, crates and barrels
// of wares, where the city's sellers stand and its buyers wander.
function market(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  floor(L, lot, B.flagstone ?? B.cobblestone);
  for (let pz = z + 1; pz <= z + D - 2; pz += 3) {
    for (let px = x + 1; px <= x + W - 2; px += 3) {
      L.put(px, Y0, pz, rng.pick([B.crate, B.barrel, B.table]));
      // (Round 79: in the empire's own way, a gilt-hemmed cloth.)
      L.put(px, Y0 + 1, pz, B.canopy, rng.int(0, 3) | (rng.int(0, 3) << CANOPY_SHIFT) | ((CANOPY_STYLES[L.settlement.style] ?? 6) << CANOPY_STYLE_SHIFT));
      if (pz + 1 <= z + D - 1) L.addSpot(px, pz + 1, 2, ['market', 'shop', 'social', 'stroll']);
    }
  }
  lamp(L, x, z);
  lamp(L, x + W - 1, z + D - 1);
  mark.at = { x: x + Math.floor(W / 2), z: z + Math.floor(D / 2) };
}

// ------------------------------------------------------------ monument
// A statue of someone the empire remembers, on a paved square of its own
// between columns, banners and lamps.
function monument(L, lot, rng, mark) {
  const { x, z, W, D } = lot;
  const st = stone(L, rng);
  floor(L, lot, B.flagstone ?? st.floor);
  const mx = x + Math.floor(W / 2);
  const mz = z + Math.floor(D / 2);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) L.put(mx + dx, SURFACE, mz + dz, st.floor);
  L.put(mx, Y0, mz, B.statue);
  for (const [px, pz] of [[x + 1, z + 1], [x + W - 2, z + 1], [x + 1, z + D - 2], [x + W - 2, z + D - 2]]) {
    const col = B.marble_column ?? st.corner;
    L.put(px, Y0, pz, col);
    L.put(px, Y0 + 1, pz, col);
    L.put(px, Y0 + 2, pz, B.lantern, LIT);
  }
  L.put(mx, Y0, z + 1, B.war_banner);
  for (const [dx, dz, f] of [[0, 2, 2], [-2, 0, 3], [2, 0, 1]]) L.addSpot(mx + dx, mz + dz, f, ['stroll', 'sketch', 'gossip', 'pray']);
  mark.at = { x: mx, z: mz };
}

// Candidate street frontage, nearest the square first.
function near(L, cands) {
  const p = L.plaza;
  if (!p) return cands;
  return cands.sort((a, b) => Math.hypot(a.x - p.cx, a.z - p.cz) - Math.hypot(b.x - p.cx, b.z - p.cz));
}
