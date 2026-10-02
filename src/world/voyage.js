// The ship you sailed on, before the storm (the crash-landing opening: see
// game/cutscene.js): a two-masted merchantman out on open water, made in
// the place apart beyond the map's edge (see World.inst) and gone again
// once you've woken on the beach. Her hull is dark planking riding two
// layers out of the sea, with a rail round the deck; a raised quarterdeck
// aft with the wheel and the stern lanterns, a little forecastle forward
// with the bowsprit; two masts carrying their canvas; and the deck cargo
// (barrels, crates, a chest or two, the ship's bell).
import { Region } from './region.js';
import { B, META_STATE } from './blocks.js';
import { REGION_W, REGION_D, WORLD_Y, INST_RX } from '../config.js';

// The place apart: two regions by two of open sea.
const RW = 2;
const RD = 2;
// Where she lies (in tiles from the place's corner), and how she's built:
// `len` stem to stern along x (the bow toward +x), the deck at layer 7
// (so you stand at 8), the quarterdeck and forecastle a layer higher.
export const HULL = { x0: 46, len: 36, cz: 36, deck: 7 };
export const DECK_Y = HULL.deck + 1;

// How far out from the centreline the hull reaches, `i` tiles from the stern.
export function halfBeam(i) {
  const L = HULL.len;
  if (i < 0 || i >= L) return -1;
  if (i < 2) return 3;
  if (i >= L - 9) return Math.max(0, Math.round((4 * (L - 1 - i)) / 8));
  return 4;
}

// Is it the raised deck there (quarterdeck aft, forecastle forward)?
export function raised(i) {
  return i <= 6 || i >= HULL.len - 7;
}

export function buildVoyage() {
  const regions = new Map();
  for (let j = 0; j < RD; j++) for (let i = 0; i < RW; i++) regions.set((INST_RX + i) * 4096 + j, new Region(INST_RX + i, j));
  const W = RW * REGION_W;
  const D = RD * REGION_D;
  const reg = (x, z) => regions.get((INST_RX + Math.floor(x / REGION_W)) * 4096 + Math.floor(z / REGION_D));
  const set = (x, y, z, id, meta = 0) => {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= WORLD_Y) return;
    reg(x, z).set(x % REGION_W, y, z % REGION_D, id, meta);
  };
  const get = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= WORLD_Y ? B.air : reg(x, z).get(x % REGION_W, y, z % REGION_D));
  // Open sea all round: a sandy bottom far down, water to the surface.
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      set(x, 0, z, B.bedrock);
      set(x, 1, z, B.sand);
      for (let y = 2; y <= 5; y++) set(x, y, z, B.water);
    }
  }
  const { x0, len, cz } = HULL;
  const deck = HULL.deck;
  const lanterns = [];
  // The hull, frame by frame from the stern.
  for (let i = 0; i < len; i++) {
    const x = x0 + i;
    const hw = halfBeam(i);
    const up = raised(i) ? 1 : 0;
    for (let dz = -hw; dz <= hw; dz++) {
      const z = cz + dz;
      const edge = Math.abs(dz) === hw || i === 0 || i === len - 1;
      // Below the waterline she's solid timber; above it, her dark sides
      // and the deck planking.
      for (let y = 3; y <= 5; y++) set(x, y, z, B.planks_dark);
      set(x, 6, z, edge ? B.planks_dark : B.planks);
      set(x, deck, z, edge ? B.planks_dark : B.planks);
      if (up) set(x, deck + 1, z, edge ? B.planks_dark : B.planks);
      // The rail round the edge.
      if (edge) set(x, deck + 1 + up, z, B.fence);
    }
  }
  // The steps up to the quarterdeck and the forecastle: a gap in the rail
  // across the middle (the deck's only a step higher there).
  for (const i of [6, len - 7]) {
    const hw = halfBeam(i);
    for (let dz = -hw + 1; dz <= hw - 1; dz++) {
      if (Math.abs(dz) <= 1) continue;
      set(x0 + i, deck + 2, cz + dz, B.fence);
    }
  }
  // Masts: the main a little aft of midships, the fore further up, each
  // with its canvas set fore and aft along the centreline (high enough to
  // walk under).
  const main = x0 + Math.round(len * 0.44);
  const fore = x0 + Math.round(len * 0.7);
  for (const [mx, top, half] of [[main, WORLD_Y - 1, 3], [fore, WORLD_Y - 2, 2]]) {
    for (let y = deck + 1; y <= top; y++) set(mx, y, cz, B.log_oak);
    for (let y = deck + 3; y <= top - 1; y++) {
      const w = y >= top - 1 ? half - 1 : half;
      for (let dx = -w; dx <= w; dx++) if (dx) set(mx + dx, y, cz, B.sail);
    }
  }
  // The bowsprit, out over the water.
  for (let k = 1; k <= 3; k++) set(x0 + len - 1 + k, deck + 1, cz, B.log_oak);
  // On the quarterdeck: the wheel, the stern lanterns, the bell.
  const qd = deck + 2;
  set(x0 + 3, qd, cz, B.helm);
  for (const dz of [-2, 2]) {
    set(x0 + 1, qd, cz + dz, B.lantern, META_STATE);
    lanterns.push({ x: x0 + 1, y: qd, z: cz + dz });
  }
  set(x0 + 5, qd, cz - 2, B.bell);
  // Forward: a lantern at the bow.
  set(x0 + len - 3, qd, cz, B.lantern, META_STATE);
  lanterns.push({ x: x0 + len - 3, y: qd, z: cz });
  // Deck cargo along the rails, lashed down; a lantern on each mast.
  const dk = deck + 1;
  const cargo = [
    [9, -3, B.barrel], [10, -3, B.barrel], [9, 3, B.crate], [11, 3, B.barrel], [12, -3, B.crate],
    [19, -3, B.barrel], [20, 3, B.crate], [21, 3, B.crate], [22, -3, B.chest], [24, 3, B.barrel], [25, -3, B.barrel],
  ];
  for (const [i, dz, id] of cargo) if (get(x0 + i, dk, cz + dz) === B.air) set(x0 + i, dk, cz + dz, id);
  for (const mx of [main, fore]) {
    set(mx, dk, cz + 1, B.lantern, META_STATE);
    lanterns.push({ x: mx, y: dk, z: cz + 1 });
  }
  for (const r of regions.values()) r.recomputeTops();
  const X = INST_RX * REGION_W;
  return {
    regions,
    x0: X,
    // (In world tiles, for the cutscene.)
    hull: { x0: X + x0, x1: X + x0 + len - 1, cz, main: X + main, fore: X + fore },
    lanterns: lanterns.map((q) => ({ ...q, x: X + q.x })),
  };
}

// Where people stand and work aboard (world tiles; `y` the layer you stand
// on there).
export function deckSpots(v) {
  const h = v.hull;
  const cz = h.cz;
  const at = (i, dz) => ({ x: h.x0 + i, y: DECK_Y + (raised(i) ? 1 : 0), z: cz + dz });
  return {
    helm: at(4, 0),
    stern: [at(2, -1), at(2, 1), at(5, 2)],
    waist: [at(9, 0), at(11, -1), at(13, 2), at(15, -2), at(17, 1), at(19, 0), at(21, -1), at(23, 1), at(27, -1), at(14, 0), at(18, -2)],
    bow: [at(30, 0), at(31, -1), at(32, 1), at(29, 2)],
    rail: [at(10, -2), at(14, 3), at(18, -3), at(23, -2), at(26, 2), at(16, 3)],
    mainmast: at(h.main - h.x0 + 1, 0),
    foremast: at(h.fore - h.x0 - 1, 0),
    start: at(15, 1),
  };
}
