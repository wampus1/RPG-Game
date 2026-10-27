// (Round 146) Building what each place is known for (see
// world/specialties.js): its ground found and claimed, and the quarter
// laid out on it by its kind's builder (see the files beside this one),
// in its people's own way, with its own features.
//
// In a world made from 1.46 on (world gen 10) a town's quarters are laid
// out with it (see Layout.placeBuildingsSteps), after the buildings a town
// can't do without and before its houses. In an older world the town's
// already there: the quarter's raised on whatever open ground is left the
// first time it's visited (see sim/cities.js), its lot kept with the town
// so it's planned the same each time after.
import { SPECIALTIES, formOf } from '../specialties.js';
import { Q, findLot, claimLot, gatesOf, Y0 } from './kit.js';
import { SURFACE } from '../../config.js';
import { M } from '../settlement.js';
import { B } from '../blocks.js';
import { ARENA } from './arena.js';
import { LEARNING } from './learning.js';
import { HOLY } from './holy.js';
import { TRADE } from './trade.js';
import { CRAFT } from './craft.js';
import { MARTIAL } from './martial.js';
import { LEISURE } from './leisure.js';
import { DEEP } from './deep.js';

export const BUILDERS = { ...ARENA, ...LEARNING, ...HOLY, ...TRADE, ...CRAFT, ...MARTIAL, ...LEISURE, ...DEEP };

// Where each wants to be: by the square, out at the edge, on the water.
const PREFER = {
  forge: 'edge', citadel: 'edge', racecourse: 'edge', fair: 'edge', ruins: 'edge', winery: 'edge', shipyard: 'water',
  monastery: 'edge', apiary: 'edge', circle: 'edge', quarry: 'edge', delve: 'mid',
};

// The sizes a specialty's form can be laid out at, the grander first, then
// (if there's no room for it) the forms of smaller places.
function sizesFor(q) {
  const K = SPECIALTIES[q.k];
  const F = formOf(q);
  const out = [...(F ? F.sizes : [])];
  for (const sz of ['town', 'village']) {
    const G = K.forms[sz];
    if (G && G !== F) for (const s of G.sizes) if (!out.some((o) => o[0] === s[0] && o[1] === s[1])) out.push(s);
  }
  return out;
}

// Lay out one quarter on `lot` (claimed), as quarter number `i` of the town.
function raise(L, lot, spec, i, rng) {
  claimLot(L, lot);
  const q = new Q(L, lot, spec, i, rng);
  const build = BUILDERS[spec.k];
  if (build) build(q);
  q.out.sk = L.settlement.spec.indexOf(spec);
  L.quarters.push(q.out);
  (L.landmarks ||= []).push({ kind: `q_${spec.k}`, name: spec.name, x0: lot.x, z0: lot.z, x1: lot.x + lot.W - 1, z1: lot.z + lot.D - 1, at: q.out.at, q: i });
  return q.out;
}

// (World gen 10 on) Before a town's or a city's streets are laid: the
// ground for each of its quarters, kept clear of where the main streets
// and the square will be (`cx`, `cz`: where they cross; `pw` by `pd`, the
// square), of the ring road inside a city's walls, of the water and of
// each other. The side streets are laid round them. By specialty, a lot
// or null (none: one's looked for later, as for a village's).
export function reserveQuarters(L, cx, cz, pw, pd, wobX, wobZ, rng) {
  const s = L.settlement;
  const b = L.bounds;
  const lots = [];
  const edge = s.type === 'city' ? 5 : 2;
  const px0 = cx + 1 - Math.floor(pw / 2) - 2;
  const pz0 = cz + 1 - Math.floor(pd / 2) - 2;
  const px1 = px0 + pw + 3;
  const pz1 = pz0 + pd + 3;
  const W = L.W;
  const D = L.D;
  // (How many good tiles there are in a rectangle, at a glance.)
  const t = new Int32Array((W + 1) * (D + 1));
  const sum = () => {
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const m = L.mask[z * W + x];
      const v = m === M.FREE || m === M.YARD ? 1 : 0;
      t[(z + 1) * (W + 1) + x + 1] = v + t[z * (W + 1) + x + 1] + t[(z + 1) * (W + 1) + x] - t[z * (W + 1) + x];
    }
  };
  const good = (x0, z0, x1, z1) => {
    const a = x0 - b.x0;
    const c = z0 - b.z0;
    const e = x1 - b.x0 + 1;
    const f = z1 - b.z0 + 1;
    if (a < 0 || c < 0 || e > W || f > D) return 0;
    return t[f * (W + 1) + e] - t[c * (W + 1) + e] - t[f * (W + 1) + a] + t[c * (W + 1) + a];
  };
  const wetNear = (x0, z0, x1, z1) => {
    let n = 0;
    for (let x = x0 - 2; x <= x1 + 2; x++) for (let z = z0 - 2; z <= z1 + 2; z++) if (!(x >= x0 && x <= x1 && z >= z0 && z <= z1) && L.maskAt(x, z) === M.WATER) n++;
    return n;
  };
  // (No more of the town's open ground than an eighth or so given over to
  // them, so there's room left for its people's homes: a quarter that
  // would take more is built smaller, or found room for later.)
  let open = 0;
  for (let i = 0; i < L.mask.length; i++) if (L.mask[i] === M.FREE || L.mask[i] === M.YARD) open++;
  let budget = open * 0.12;
  (s.spec || []).forEach((spec, k) => {
    lots[k] = null;
    if (!SPECIALTIES[spec.k]) return;
    sum();
    const prefer = PREFER[spec.k] || 'mid';
    const r = rng.fork(`res:${spec.k}`);
    for (const [Wl, Dl] of sizesFor(spec)) {
      if (Wl * Dl > budget) continue;
      let best = null;
      for (let z = b.z0 + edge; z + Dl - 1 <= b.z1 - edge; z++) {
        for (let x = b.x0 + edge; x + Wl - 1 <= b.x1 - edge; x++) {
          const x1 = x + Wl - 1;
          const z1 = z + Dl - 1;
          // (Clear of the main streets, winding as they may, and the square.)
          if (z1 >= cz - wobZ && z <= cz + 2 + wobZ) continue;
          if (x1 >= cx - wobX && x <= cx + 2 + wobX) continue;
          if (x1 >= px0 && x <= px1 && z1 >= pz0 && z <= pz1) continue;
          if (good(x - 1, z - 1, x1 + 1, z1 + 1) !== (Wl + 2) * (Dl + 2)) continue;
          const d = Math.hypot(x + Wl / 2 - cx, z + Dl / 2 - cz);
          let score = (prefer === 'mid' ? d : -d) + r.float(0, 12);
          if (prefer === 'water') score -= Math.min(20, wetNear(x, z, x1, z1)) * 3;
          if (!best || score < best.score) best = { x, z, W: Wl, D: Dl, score };
        }
      }
      if (best) {
        lots[k] = { x: best.x, z: best.z, W: best.W, D: best.D };
        claimLot(L, lots[k]);
        budget -= best.W * best.D;
        break;
      }
    }
  });
  return lots;
}

// (After the streets) A lane from each kept lot to the nearest street, if
// none runs by it.
export function laneToQuarters(L) {
  const roadAt = (x, z) => {
    const m = L.maskAt(x, z);
    return m === M.ROAD || m === M.PLAZA || m === M.BRIDGE;
  };
  for (const lot of L.qlots || []) {
    if (!lot) continue;
    const mx = lot.x + Math.floor(lot.W / 2);
    const mz = lot.z + Math.floor(lot.D / 2);
    const sides = [[mx, lot.z - 1, 0, -1], [mx, lot.z + lot.D, 0, 1], [lot.x - 1, mz, -1, 0], [lot.x + lot.W, mz, 1, 0]];
    let best = null;
    for (const [sx, sz, dx, dz] of sides) {
      for (let k = 0; k < 14; k++) {
        const x = sx + dx * k;
        const z = sz + dz * k;
        if (!L.inside(x, z)) break;
        if (roadAt(x, z) || roadAt(x + Math.abs(dz), z + Math.abs(dx))) {
          if (!best || k < best.k) best = { sx, sz, dx, dz, k };
          break;
        }
        const m = L.maskAt(x, z);
        if (m !== M.FREE && m !== M.YARD) break;
      }
    }
    if (!best || best.k === 0) continue;
    for (let k = 0; k < best.k; k++) {
      const x = best.sx + best.dx * k;
      const z = best.sz + best.dz * k;
      L.paveRoad(x, z);
      L.paveRoad(x + Math.abs(best.dz), z + Math.abs(best.dx));
    }
  }
}

// (World gen 10 on) As the town's laid out: a step at a time.
export function* layQuartersSteps(L, rng) {
  L.quarters ||= [];
  const s = L.settlement;
  for (const [k, spec] of (s.spec || []).entries()) {
    if (!SPECIALTIES[spec.k]) continue;
    const r = rng.fork(`q:${spec.k}`);
    const lot = (L.qlots && L.qlots[k]) || findLot(L, sizesFor(spec), r, PREFER[spec.k] || 'mid') || (PREFER[spec.k] === 'water' ? findLot(L, sizesFor(spec), r, 'edge') : null);
    yield;
    if (!lot) continue;
    raise(L, lot, spec, L.quarters.length, r);
    yield;
  }
}

// (An older world, its towns built up to their edges) Ground just outside
// the town, beside one of the roads out of it: dry, level enough to be
// made good (it's dug down or built up to the town's ground: see
// raiseQuarters), clear of the other towns, the old places, and the
// town's other quarters. Its way in on the road (`face`, the side it's
// on). Sizes as for findLot (the first that has room); null if none.
function findAnnex(L, sizes, rng, taken) {
  const t = L.world && L.world.terrain;
  const ow = L.world && L.world.ow;
  if (!t || !ow) return null;
  const b = L.bounds;
  const ctx = t.context(b.x0 - 48, b.z0 - 48, b.x1 + 48, b.z1 + 48);
  const cols = new Map();
  const col = (x, z) => {
    const k = x * 65536 + z;
    let c = cols.get(k);
    if (!c) {
      const o = t.column(x, z, ctx, {});
      c = { h: o.h, wet: o.water >= 0 };
      cols.set(k, c);
    }
    return c;
  };
  const others = ow.settlements.filter((o) => o && o !== L.settlement && o.bounds);
  const sites = (ow.sites || []).filter((o) => o.x !== undefined);
  const ok = (lot) => {
    const x0 = lot.x - 1;
    const z0 = lot.z - 1;
    const x1 = lot.x + lot.W;
    const z1 = lot.z + lot.D;
    for (const o of others) if (!(o.bounds.x1 + 4 < x0 || o.bounds.x0 - 4 > x1 || o.bounds.z1 + 4 < z0 || o.bounds.z0 - 4 > z1)) return -1;
    for (const o of sites) if (o.x >= x0 - 8 && o.x <= x1 + 8 && o.z >= z0 - 8 && o.z <= z1 + 8) return -1;
    for (const o of taken) if (o && !(o.x + o.W + 2 < x0 || o.x - 2 > x1 || o.z + o.D + 2 < z0 || o.z - 2 > z1)) return -1;
    let cost = 0;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const c = col(x, z);
        if (c.wet) return -1;
        const d = Math.abs(c.h - SURFACE);
        if (d > 5) return -1;
        cost += d;
      }
    }
    return cost;
  };
  const exits = L.exits().filter((e) => e.dx || e.dz);
  for (const [W0, D0] of sizes) {
    let best = null;
    for (const e of exits) {
      for (const gap of [2, 3, 5]) {
        for (const side of [-1, 1]) {
          let lot;
          if (e.dz) {
            // A road out to the north or south: the lot beside it, its
            // front to the road (west or east).
            const W = D0;
            const D = W0;
            const x = side > 0 ? e.x + 3 : e.x - 2 - W;
            const z = e.dz > 0 ? b.z1 + gap : b.z0 - gap - D + 1;
            lot = { x, z, W, D, face: side > 0 ? 'w' : 'e' };
          } else {
            const W = W0;
            const D = D0;
            const z = side > 0 ? e.z + 3 : e.z - 2 - D;
            const x = e.dx > 0 ? b.x1 + gap : b.x0 - gap - W + 1;
            lot = { x, z, W, D, face: side > 0 ? 'n' : 's' };
          }
          const c = ok(lot);
          if (c < 0) continue;
          const score = c + gap * 2 + rng.float(0, 6);
          if (!best || score < best.score) best = { ...lot, score };
        }
      }
    }
    if (best) return { x: best.x, z: best.z, W: best.W, D: best.D, face: best.face, annex: true };
  }
  return null;
}

// (An older world) The town's quarters as they're planned now, on the lots
// kept for them (`lots`, by specialty: a lot, or false where there was no
// room), new ones found for any not tried yet. What's to be set into the
// world for those raised just now (blocks to clear and blocks to place),
// and whether any lot was found or given up on (to keep).
export function raiseQuarters(L, lots, rng) {
  L.quarters ||= [];
  const s = L.settlement;
  const ops = [];
  let changed = false;
  const local = L.local;
  L.local = new Map();
  try {
    (s.spec || []).forEach((spec, k) => {
      if (!SPECIALTIES[spec.k] || lots[k] === false) return;
      let lot = lots[k];
      const fresh = !lot;
      const r = rng.fork(`q:${spec.k}:${k}`);
      if (fresh) {
        lot = findLot(L, sizesFor(spec), r, PREFER[spec.k] || 'mid') || (PREFER[spec.k] === 'water' ? findLot(L, sizesFor(spec), r, 'edge') : null)
          || (spec.k !== 'shipyard' ? findAnnex(L, sizesFor(spec), r, lots) : null);
        lots[k] = lot || false;
        changed = true;
        if (!lot) return;
      }
      L.collect = [];
      raise(L, lot, spec, L.quarters.length, r.fork('build'));
      const placed = L.collect;
      L.collect = null;
      if (!fresh) return;
      // (Whatever grew or stood on the ground cleared off it first; out past
      // the town's edge, the ground made good to the town's own, dug down
      // or built up, a border of it round about.)
      const e = lot.annex ? 1 : 0;
      for (let z = lot.z - e; z < lot.z + lot.D + e; z++) {
        for (let x = lot.x - e; x < lot.x + lot.W + e; x++) {
          for (let y = Y0; y < Y0 + (e ? 14 : 10); y++) ops.push([x, y, z, B.air, 0]);
          if (!e) continue;
          for (let y = SURFACE - 4; y < SURFACE; y++) ops.push([x, y, z, B.dirt, 0]);
          ops.push([x, SURFACE, z, B.grass, 0]);
        }
      }
      // (And a path from its way in out to the road.)
      if (lot.annex) {
        const g = gatesOf(L, lot)[0];
        const dx = g.out.x - g.x;
        const dz = g.out.z - g.z;
        for (let k = 1; k <= 5; k++) {
          const x = g.x + dx * k;
          const z = g.z + dz * k;
          if (L.maskAt(x, z) === M.ROAD && L.inside(x, z)) break;
          for (let y = SURFACE - 3; y < SURFACE; y++) ops.push([x, y, z, B.dirt, 0]);
          for (let w = -1; w <= 1; w++) ops.push([x + Math.abs(dz) * w, SURFACE, z + Math.abs(dx) * w, B.gravel ?? B.cobblestone, 0]);
          for (let w = -1; w <= 1; w++) for (let y = Y0; y < Y0 + 4; y++) ops.push([x + Math.abs(dz) * w, y, z + Math.abs(dx) * w, B.air, 0]);
        }
      }
      for (const op of placed) ops.push(op);
    });
  } finally {
    L.collect = null;
    L.local = local;
  }
  return { ops, changed };
}

// The quarter of a town at (x, z), if there's one there.
export function quarterAt(L, x, z) {
  for (const q of (L && L.quarters) || []) if (x >= q.x0 - 1 && x <= q.x1 + 1 && z >= q.z0 - 1 && z <= q.z1 + 1) return q;
  return null;
}
