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
import { Q, findLot, claimLot, gatesOf, Y0, waysAbout } from './kit.js';
import { SURFACE, REGION_W, REGION_D } from '../../config.js';
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

// (Tests: the ways about a quarter checked but left as built.)
export const FIX_WAYS = { on: true };

// (Round 147) The design the quarters are built to: a town's quarters built
// to an older one are built again, once (see sim/cities.js).
export const QUARTER_V = 2;

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
  // (Round 147) Every seat, place and thing in it to be got to from its
  // ways in: a way opened through what's set about where one isn't.
  const ways = waysAbout(L, q.out, FIX_WAYS.on);
  if (ways.missing.length) q.out.unreached = ways.missing.slice(0, 8).map((m) => `${m.what}@${m.x},${m.y},${m.z}`);
  if (FIX_WAYS.seen) FIX_WAYS.seen(L, q.out, ways);
  q.out.sk = L.settlement.spec.indexOf(spec);
  L.quarters.push(q.out);
  // (Marked on the town's map with its landmarks: see townmap.js.)
  (L.qmarks ||= []).push({ kind: `q_${spec.k}`, name: spec.name, x0: lot.x, z0: lot.z, x1: lot.x + lot.W - 1, z1: lot.z + lot.D - 1, at: q.out.at, q: i });
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

// (An older world) The lane from an annex's way in to the town: out of its
// gate to the strip of ground just outside the town's edge, then along
// that to the road out on that side (lot.to: where that road leaves the
// town, along the side), up to the road's edge. Tiles [x, z].
function laneOf(L, lot) {
  const b = L.bounds;
  const g = gatesOf(L, lot)[0];
  const dx = g.out.x - g.x;
  const dz = g.out.z - g.z;
  const out = [];
  let x = g.x;
  let z = g.z;
  // (The strip just outside the town on that side.)
  const edge = dz > 0 ? b.z0 - 1 : dz < 0 ? b.z1 + 1 : dx > 0 ? b.x0 - 1 : b.x1 + 1;
  for (let k = 0; k < 24 && (dz ? z !== edge : x !== edge); k++) {
    x += dx;
    z += dz;
    out.push([x, z]);
  }
  if (lot.to === undefined) return out;
  // (Along the town's edge: x for a lot north or south of it, z for one
  // to the west or east.)
  const ns = dz !== 0;
  const from = ns ? x : z;
  const step = Math.sign(lot.to - from);
  for (let a = from + step; step && a !== lot.to; a += step) {
    const [px, pz] = ns ? [a, z] : [x, a];
    if (L.isRoadTile(px, pz)) break;
    out.push([px, pz]);
  }
  // (It never goes in.)
  return out.filter(([px, pz]) => px < b.x0 || px > b.x1 || pz < b.z0 || pz > b.z1);
}

// (An older world, its towns built up to their edges) Ground just outside
// the town, along one of its sides: dry, level enough to be made good (it's
// dug down or built up to the town's ground: see raiseQuarters), clear of
// the other towns, the old places, and the town's other quarters, and out
// of the way of everyone else who uses the ground out there: off the roads
// (`avoid`: the realm's roads, by x * 65536 + z) with a lane either side,
// off the line travellers take in to the middle of town, and away from the
// ground by each road out where caravans and companies pitch camp. Its
// way in faces the town (`face`, the side it's on), a lane from it along
// the town's edge to the road out on that side (`to`: see laneOf). Sizes
// as for findLot (the first that has room); null if none.
function findAnnex(L, sizes, rng, taken, avoid = null) {
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
  const cx = Math.floor((b.x0 + b.x1) / 2);
  const cz = Math.floor((b.z0 + b.z1) / 2);
  // (Where caravans camp: out along each road from where it leaves town, a
  // good way to either side of it; see Camps.site.)
  const ents = [...(L.entrances || []), ...L.exits().filter((e) => e.dx || e.dz)];
  const camps = ents.map((e) => {
    const ex = e.x - (b.x0 + b.x1) / 2;
    const ez = e.z - (b.z0 + b.z1) / 2;
    const ox = Math.abs(ex) / (b.x1 - b.x0 + 1) > Math.abs(ez) / (b.z1 - b.z0 + 1) ? Math.sign(ex) : 0;
    const oz = ox ? 0 : Math.sign(ez) || 1;
    const far = [e.x + ox * 16, e.z + oz * 16];
    return ox
      ? { x0: Math.min(e.x, far[0]), x1: Math.max(e.x, far[0]), z0: e.z - 22, z1: e.z + 22, e }
      : { x0: e.x - 22, x1: e.x + 22, z0: Math.min(e.z, far[1]), z1: Math.max(e.z, far[1]), e };
  });
  const roadNear = (x0, z0, x1, z1) => {
    for (let z = z0 - 3; z <= z1 + 3; z++) {
      for (let x = x0 - 3; x <= x1 + 3; x++) {
        const k = x * 65536 + z;
        if ((L.outRoads && L.outRoads.has(k)) || (avoid && avoid.has(k))) return true;
      }
    }
    return false;
  };
  const ok = (lot) => {
    const x0 = lot.x - 1;
    const z0 = lot.z - 1;
    const x1 = lot.x + lot.W;
    const z1 = lot.z + lot.D;
    // (Not across the way in to the middle of town.)
    if (lot.face === 'n' || lot.face === 's' ? x0 - 6 <= cx && x1 + 6 >= cx : z0 - 6 <= cz && z1 + 6 >= cz) return -1;
    for (const o of camps) if (!(o.x1 < x0 || o.x0 > x1 || o.z1 < z0 || o.z0 > z1)) return -1;
    for (const o of others) if (!(o.bounds.x1 + 4 < x0 || o.bounds.x0 - 4 > x1 || o.bounds.z1 + 4 < z0 || o.bounds.z0 - 4 > z1)) return -1;
    for (const o of sites) if (o.x >= x0 - 8 && o.x <= x1 + 8 && o.z >= z0 - 8 && o.z <= z1 + 8) return -1;
    for (const o of taken) if (o && !(o.x + o.W + 2 < x0 || o.x - 2 > x1 || o.z + o.D + 2 < z0 || o.z - 2 > z1)) return -1;
    if (roadNear(x0, z0, x1, z1)) return -1;
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
  // (The lane out to the road: dry, near enough level, clear of the other
  // quarters' lots.)
  const laneCost = (lane) => {
    let cost = 0;
    for (const [x, z] of lane) {
      const c = col(x, z);
      if (c.wet || Math.abs(c.h - SURFACE) > 4) return -1;
      if (others.some((o) => x >= o.bounds.x0 && x <= o.bounds.x1 && z >= o.bounds.z0 && z <= o.bounds.z1)) return -1;
      if (taken.some((o) => o && x >= o.x && x < o.x + o.W && z >= o.z && z < o.z + o.D)) return -1;
      cost += Math.abs(c.h - SURFACE) + 0.25;
    }
    return cost;
  };
  // (The roads out on each side of town: a lot north of town, its way in
  // on its south side, goes by a road out of the north side; and so on.)
  const side = { s: (e) => e.dz < 0, n: (e) => e.dz > 0, e: (e) => e.dx < 0, w: (e) => e.dx > 0 };
  const exits = L.exits().filter((e) => e.dx || e.dz);
  for (const [W0, D0] of sizes) {
    let best = null;
    // (Close in if there's room; a small town's roads out, in the middle
    // of each side, leave no room by it but further out, or off a corner.)
    for (const gap of [3, 4, 6, 9, 13, 18]) {
      for (const face of ['n', 's', 'e', 'w']) {
        // The lot along that side of town, its way in toward it (a lot on
        // the north side faces south, and so on).
        const ns = face === 'n' || face === 's';
        const W = ns ? W0 : D0;
        const D = ns ? D0 : W0;
        const roads = exits.filter(side[face]).map((e) => (ns ? e.x : e.z));
        if (!roads.length) continue;
        const [lo, hi] = ns ? [b.x0 - (W >> 1), b.x1 - (W >> 1)] : [b.z0 - (D >> 1), b.z1 - (D >> 1)];
        for (let a = lo; a <= hi; a += 3) {
          const lot = face === 's' ? { x: a, z: b.z0 - gap - D + 1, W, D, face }
            : face === 'n' ? { x: a, z: b.z1 + gap, W, D, face }
              : face === 'e' ? { x: b.x0 - gap - W + 1, z: a, W, D, face }
                : { x: b.x1 + gap, z: a, W, D, face };
          const c = ok(lot);
          if (c < 0) continue;
          const g = gatesOf(L, lot)[0];
          const at = ns ? g.x : g.z;
          lot.to = roads.reduce((m, r) => (Math.abs(r - at) < Math.abs(m - at) ? r : m), roads[0]);
          const lane = laneOf(L, lot);
          if (lane.length > 80) continue;
          const lc = laneCost(lane);
          if (lc < 0) continue;
          const score = c + lc + gap * 3 + rng.float(0, 6);
          if (!best || score < best.score) best = { ...lot, score };
        }
      }
      if (best) break;
    }
    if (best) return { x: best.x, z: best.z, W: best.W, D: best.D, face: best.face, to: best.to, annex: true };
  }
  return null;
}

// (An older world) The town's quarters as they're planned now, on the lots
// kept for them (`lots`, by specialty: a lot, or false where there was no
// room), new ones found for any not tried yet. What's to be set into the
// world for those raised just now (blocks to clear and blocks to place),
// and whether any lot was found or given up on (to keep).
export function raiseQuarters(L, lots, rng, avoid = null, rebuild = false) {
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
          || (spec.k !== 'shipyard' ? findAnnex(L, sizesFor(spec), r, lots, avoid) : null);
        lots[k] = lot || false;
        changed = true;
        if (!lot) return;
      }
      L.collect = [];
      const qo = raise(L, lot, spec, L.quarters.length, r.fork('build'));
      const placed = L.collect;
      L.collect = null;
      // (Its ways in kept with its lot: built the same each time after,
      // whatever's built round it.)
      if (!lot.gates) {
        lot.gates = qo.gates.map((g) => ({ side: g.side, x: g.x, z: g.z }));
        changed = true;
      }
      if (!fresh && !rebuild) return;
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
      // (And a gravel lane from its way in to the town's edge and along it
      // to the road out: on the lie of the land, sloped up or down to the
      // quarter's own ground over its first few paces.)
      const t = L.world && L.world.terrain;
      if (lot.annex && t) {
        const lane = laneOf(L, lot);
        const xs = lane.map((p) => p[0]);
        const zs = lane.map((p) => p[1]);
        const ctx = lane.length ? t.context(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)) : null;
        lane.forEach(([x, z], k) => {
          const h = t.column(x, z, ctx, {}).h;
          const y = Math.round(SURFACE + (h - SURFACE) * Math.min(1, k / 4));
          for (let d = 3; d > 0; d--) ops.push([x, y - d, z, B.dirt, 0]);
          ops.push([x, y, z, B.gravel ?? B.cobblestone, 0]);
          for (let d = 1; d <= 4; d++) ops.push([x, y + d, z, B.air, 0]);
        });
      }
      for (const op of placed) ops.push(op);
    });
  } finally {
    L.collect = null;
    L.local = local;
  }
  return { ops, changed };
}

// (World gen 10 on) What a town's quarters are, block by block, as laid
// out with it (Layout.placements): to set into the world over what was
// built to an older design. Each lot cleared first, as high as anything
// goes. Only where `want(regionKey)` says so (the parts of the world kept
// as they were left; the rest are made afresh from the plan anyway).
export function placedOps(L, want = () => true) {
  const ops = [];
  const w = L.world;
  for (const qo of L.quarters || []) {
    const rx0 = Math.floor(qo.x0 / REGION_W);
    const rx1 = Math.floor(qo.x1 / REGION_W);
    const rz0 = Math.floor(qo.z0 / REGION_D);
    const rz1 = Math.floor(qo.z1 / REGION_D);
    for (let rz = rz0; rz <= rz1; rz++) {
      for (let rx = rx0; rx <= rx1; rx++) {
        const key = w.regionKey(rx, rz);
        if (!want(key)) continue;
        const x0 = Math.max(qo.x0, rx * REGION_W);
        const x1 = Math.min(qo.x1, rx * REGION_W + REGION_W - 1);
        const z0 = Math.max(qo.z0, rz * REGION_D);
        const z1 = Math.min(qo.z1, rz * REGION_D + REGION_D - 1);
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (let y = Y0; y < Y0 + 16; y++) ops.push([x, y, z, B.air, 0]);
        const arr = L.placements.get(key) || [];
        for (let i = 0; i < arr.length; i += 5) {
          const x = arr[i];
          const z = arr[i + 2];
          if (x >= x0 && x <= x1 && z >= z0 && z <= z1) ops.push([x, arr[i + 1], z, arr[i + 3], arr[i + 4]]);
        }
      }
    }
  }
  return ops;
}

// The quarter of a town at (x, z), if there's one there.
export function quarterAt(L, x, z) {
  for (const q of (L && L.quarters) || []) if (x >= q.x0 - 1 && x <= q.x1 + 1 && z >= q.z0 - 1 && z <= q.z1 + 1) return q;
  return null;
}
