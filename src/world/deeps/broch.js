// (Round 109) The Drowned Broch, made over: one of the broken sea towers of
// the Skerries, drystone, double-walled, its stairs and galleries in the
// thickness of its walls; the great storm broke it and the sea came into
// its stair. Tight and tall rather than wide: the scarcement ledge up round
// the court, the gallery climbing over itself in the wall, wall-cells, and
// below, the drowned stair going down into black water. The gale comes in
// at the slits (see game/brochwork.js: the gusts that snuff the lamps and
// knock you off the ledge; the lamps, and the trowies that won't come near
// them lit; the beacon, fed with fish-oil fetched up from below; the
// wreckers' false lights that call the drowned up out of the water; the
// strongroom and its key; the wall-cells and the trowies' hoards).
//
// A floor of it, beside the old rooms (the flooded hall, the storehouse,
// the wreck, the traps, the treasure, the guard), and what its own rooms
// are:
//   the court: the broch's round court, the hearth in its middle and the
//     quern, the scarcement ledge up round its back wall with a step up
//     onto it and the fulmars nesting on it, the slits over it (a gust off
//     them knocks you down off the ledge), the wall-cells, the lamps;
//   the wheelhouse: a round house, stone piers out from its walls toward
//     its hearth making bays, each bay its use (bunks, peat, creels, nets,
//     a quern, a kist); the trowies in the bays;
//   the gallery: the passage in the wall's thickness, climbing up over
//     itself and down again, a slit at its end the gale comes down, cells
//     off it to shelter in; the trowies;
//   the stair: the drowned stair, its far side gone down into the black
//     water, a shingle bank, kelp, the seals on the bank, the drowned
//     asleep in the shallows, a wrecker's false light at the water's edge;
//   the den: the wreckers' den: plunder, kists, false lights, the casks of
//     fish-oil they took off the keeper, the strongroom barred and
//     padlocked, the wreckers, one of them with its key;
//   the beacon: the beacon up on its dais, cold; the keeper's box-bed and
//     his log, his kist (locked till the light's lit), the empty casks;
//   the noust: the boat-shed: a wreck's ribs, the slip of water, creels,
//     nets, a rack of fish, an anchor, a figurehead, oil casks, the seals.
// About the floor: its papers (see deeps/brochlore.js) made from the
// broch's own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { brochLore } from './brochlore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun, frameOf } from './common.js';

const POOL = [['gallery', 2], ['court', 1], ['wheelhouse', 1], ['stair', 1], ['den', 1], ['beacon', 1], ['noust', 1], ['storehouse', 1], ['flooded', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['court', 'wheelhouse', 'stair', 'den', 'beacon', 'noust', 'storehouse', 'flooded', 'trap', 'treasure']);
export const BROCH_OWN = new Set(['court', 'wheelhouse', 'gallery', 'stair', 'den', 'beacon', 'noust']);

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The gallery on every floor; the court on the first and now and then
  // after; the stair or the wheelhouse; the beacon with somewhere the oil's
  // kept (the den or the noust), or one of those alone.
  out.push('gallery');
  if (n === 0 || rng.chance(0.4)) out.push('court');
  out.push(rng.pick(['stair', 'wheelhouse']));
  if (rng.chance(0.6)) out.push('beacon');
  out.push(rng.pick(['den', 'noust']));
  let guard = 0;
  while (out.length < count && guard++ < 300) {
    const k = rng.weighted(POOL);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= 2) continue;
    out.push(k);
  }
  const head = last ? [out[0]] : [];
  return [...head, ...rng.shuffle(out.slice(head.length))].slice(0, count);
}

const SIZES = {
  court: [[13, 15], [11, 13]], wheelhouse: [[13, 14], [11, 13]], gallery: [[16, 20], [5, 6]], stair: [[12, 14], [10, 11]],
  den: [[12, 14], [8, 10]], beacon: [[11, 13], [9, 11]], noust: [[13, 15], [9, 10]],
};
const SHAPES = { court: ['octagon'], wheelhouse: ['octagon'], gallery: ['rect'], stair: ['rect'], den: ['rect'], beacon: ['rect', 'octagon'], noust: ['rect'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6204) % list.length] : null;
};
const Lof = (ctx) => ctx.brochLore || (ctx.brochLore = brochLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const abs = (ctx, t) => ({ x: ctx.b.x0 + t.x, z: t.z });
const clear = (ctx, H, r, x, z) => free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z);
function band(ctx, H, r, list, at, k, o = {}) {
  const g = groupOf(ctx, r, k);
  const out = [];
  for (const species of list) {
    const s0 = near(ctx, H, r, at.x + ctx.rng.int(-1, 1), at.z + ctx.rng.int(-1, 1), 3);
    if (!s0) continue;
    const s = put(ctx, species, s0.x, s0.z, r, { dormant: 5, group: g, ...o });
    if (s) out.push(s);
  }
  return out;
}
function northWall(ctx, r) {
  const out = [];
  for (let x = r.x0; x <= r.x1; x++) {
    let z = r.z0;
    while (z <= r.z1 && ctx.plan.room[z * ctx.W + x] !== r.id) z++;
    if (z > r.z1 || ctx.plan.at(x, z - 1)) continue;
    out.push({ x, z: z - 1 });
  }
  return out;
}
function face(ctx, w, id, meta = 0) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id, meta);
  return true;
}
function floorAll(ctx, H, r, id, test = null) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && (!test || test(x, z))) floorAt(ctx, x, z, id);
}
const tilesOf = (ctx, H, r) => {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (clear(ctx, H, r, x, z)) out.push({ x, z });
  return out;
};
// (Near one of the room's ways in: a doorway tile, or a pace off one.)
function byDoor(ctx, H, r, x, z, d = 1) {
  return H.doorways(ctx.plan, r).some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) <= d);
}
// A wall-cell's low door in the north wall: searched once, for what the
// trowies hoard in it (and now and then a trowie in it, that bites).
function cell(ctx, H, r, w) {
  const { rng } = ctx;
  if (!face(ctx, w, B.bc_cell)) return false;
  const loot = [['old_coin', rng.int(1, 4)]];
  if (rng.chance(0.3)) loot.push([rng.pick(['gem', 'pearl', 'fish_oil', 'feather', 'seaweed_crisps']), 1]);
  (ctx.out.cells ||= []).push({ ...abs(ctx, w), room: r.id, loot, trow: rng.chance(0.35) });
  return true;
}
// A slit in the north wall: the gale through it blows south down its
// column of the room (see brochwork.gust).
function slit(ctx, H, r, w) {
  if (!face(ctx, w, B.bc_slit)) return false;
  const tiles = [];
  for (let z = w.z + 1; z <= r.z1 && z <= w.z + 8; z++) {
    if (!H.own(ctx.plan, r, w.x, z)) break;
    tiles.push(abs(ctx, { x: w.x, z }));
  }
  (ctx.out.slits ||= []).push({ ...abs(ctx, w), dir: { x: 0, z: 1 }, tiles, room: r.id });
  return true;
}
// The north wall's faces, a few each, spaced: slits, cells, lamps in their
// niches, symbol stones.
function walls(ctx, H, r, list, p, skip = null) {
  const L = Lof(ctx);
  let last = -9;
  for (const w of northWall(ctx, r)) {
    if (skip && skip(w)) continue;
    if (w.x - last < 2 || !ctx.rng.chance(p)) continue;
    const k = ctx.rng.weighted(list);
    let ok = false;
    if (k === 'slit') ok = slit(ctx, H, r, w);
    else if (k === 'cell') ok = cell(ctx, H, r, w);
    else if (k === 'symbol') {
      const kind = ctx.rng.int(0, 1);
      ok = face(ctx, w, B.bc_symbol, kind);
      if (ok) lore(ctx, w.x, w.z, L.symbol(kind));
    } else ok = face(ctx, w, B[k], ctx.rng.int(0, 1));
    if (ok) last = w.x;
  }
}
function lamps(ctx, H, r, n) {
  for (let i = 0; i < n; i++) place(ctx, H, r, B.bc_lamp, META_STATE | ctx.rng.int(0, 1), true);
}
// An oil cask (full: its jar of fish-oil for the beacon: see brochwork).
function casks(ctx, H, r, n, full = true) {
  for (let i = 0; i < n; i++) {
    const t = place(ctx, H, r, B.bc_oilcask, (full ? 0 : META_STATE) | ctx.rng.int(0, 1), true);
    if (t && full) (ctx.out.casks ||= []).push({ ...abs(ctx, t), room: r.id });
  }
}

// --------------------------------------------------------------- the rooms
// The court: the broch's round court.
function court(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, B.bc_flags);
  // The hearth in its middle, the quern by it.
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (clear(ctx, H, r, r.cx + dx, r.cz + dz)) floorAt(ctx, r.cx + dx, r.cz + dz, B.bc_hearth);
  const q = near(ctx, H, r, r.cx + 3, r.cz, 1, (x, z) => ctx.plan.at(x, z + 1) && Math.abs(x - r.cx) > 1);
  if (q) b.set(q.x, FY, q.z, B.bc_quern);
  // The scarcement: a ledge up along the back wall, a step up onto it at
  // one end; the fulmars nest on it.
  // (Its back row, or the one in from it where a round room's back is cut
  // short; against the wall all along.)
  const S = backSeen(ctx, H, r);
  let run = [];
  for (const off of [0, 1, 2]) {
    const row0 = [];
    for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a++) {
      const t = at2(S, a, S.back + S.out * off);
      const behind = at2(S, a, S.back + S.out * (off - 1));
      if (clear(ctx, H, r, t.x, t.z) && !byDoor(ctx, H, r, t.x, t.z) && !ctx.plan.at(behind.x, behind.z)) row0.push(t);
    }
    const got = longestRun(row0, S.along).slice(0, 8);
    if (got.length > run.length) run = got;
    if (run.length >= 5) break;
  }
  const ledge = new Set();
  if (run.length >= 4) {
    const fromLow = rng.chance(0.5);
    const tiles = fromLow ? run : [...run].reverse();
    tiles.forEach((t, i) => {
      raise(ctx, H, t.x, t.z, i === 0 ? B.bc_step : B.bc_ledge, i === 0 ? 1 : 2);
      ledge.add(`${t.x},${t.z}`);
    });
    const n0 = tiles[Math.min(tiles.length - 1, 3)];
    b.set(n0.x, FY + 2, n0.z, B.bc_nest, rng.int(0, 1));
    put(ctx, 'fulmar', n0.x, n0.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'nest') });
    const n1 = tiles[tiles.length - 1];
    if (n1 !== n0 && rng.chance(0.6)) put(ctx, 'fulmar', n1.x, n1.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'nest') });
  }
  // The walls: slits over the ledge, cells, lamps in their niches, a
  // symbol stone.
  walls(ctx, H, r, [['slit', 3], ['cell', 2], ['bc_lampniche', 1], ['symbol', 1], ['bc_wrackwall', 1]], 0.55);
  lamps(ctx, H, r, 2);
  place(ctx, H, r, B.bc_peat, 0, true);
  band(ctx, H, r, ['drowned', 'drowned'], { x: r.cx, z: r.cz + 2 }, 'court');
  const c0 = (ctx.out.cells || []).find((c) => c.room === r.id);
  if (c0) band(ctx, H, r, ['trowie'], { x: c0.x - ctx.b.x0, z: c0.z + 1 }, 'cell', { dormant: 3 });
}
// The wheelhouse: piers out from its walls, bays between.
function wheelhouse(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_slate);
  floorAt(ctx, r.cx, r.cz, B.bc_hearth);
  const rx = (r.x1 - r.x0) / 2;
  const rz = (r.z1 - r.z0) / 2;
  // (Four piers, square to the walls, so the bays are plain to see.)
  const n = 4;
  const a0 = rng.chance(0.5) ? 0 : Math.PI / 4;
  const pier = new Set();
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * 2 * Math.PI) / n;
    for (let d = 0.55; d <= 1.2; d += 0.05) {
      const x = Math.round(r.cx + Math.cos(a) * rx * d);
      const z = Math.round(r.cz + Math.sin(a) * rz * d);
      if (!H.own(ctx.plan, r, x, z) || pier.has(`${x},${z}`)) continue;
      if (!clear(ctx, H, r, x, z) || byDoor(ctx, H, r, x, z, 2)) continue;
      for (const y of [FY, FY + 1]) b.set(x, y, z, ctx.T.wall);
      pier.add(`${x},${z}`);
    }
  }
  // (Every bay open to the hub: a pier that shuts one off, cut back.)
  for (let guard = 0; guard < 20; guard++) {
    const seen = new Set();
    const q = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z) && !pier.has(`${d.x},${d.z}`));
    for (const d of q) seen.add(`${d.x},${d.z}`);
    while (q.length) {
      const { x, z } = q.pop();
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + ox},${z + oz}`;
        if (seen.has(k) || pier.has(k) || !H.own(ctx.plan, r, x + ox, z + oz)) continue;
        seen.add(k);
        q.push({ x: x + ox, z: z + oz });
      }
    }
    let cut = null;
    for (const k of pier) {
      const [x, z] = k.split(',').map(Number);
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oz]) => `${x + ox},${z + oz}`).filter((q2) => !pier.has(q2) && H.own(ctx.plan, r, +q2.split(',')[0], +q2.split(',')[1]));
      if (side.some((q2) => seen.has(q2)) && side.some((q2) => !seen.has(q2))) {
        cut = { x, z, k };
        break;
      }
    }
    if (!cut) break;
    for (const y of [FY, FY + 1]) b.set(cut.x, y, cut.z, B.air);
    pier.delete(cut.k);
  }
  // Each bay its use, at its back.
  const USE = ['bc_bunk', 'bc_peat', 'bc_creels', 'bc_kist', 'bc_nets', 'bc_rack', 'bc_quern', 'bc_plunder'];
  const uses = rng.shuffle(USE);
  for (let k = 0; k < n; k++) {
    const a = a0 + ((k + 0.5) * 2 * Math.PI) / n;
    const t = near(ctx, H, r, Math.round(r.cx + Math.cos(a) * rx * 0.75), Math.round(r.cz + Math.sin(a) * rz * 0.75), 1, (x, z) => ctx.plan.at(x, z + 1) && !byDoor(ctx, H, r, x, z));
    if (!t) continue;
    const u = uses[k % uses.length];
    b.set(t.x, FY, t.z, B[u], rng.int(0, 1));
    if (u === 'bc_kist') lore(ctx, t.x, t.z, L.kist());
    if (u === 'bc_bunk') lore(ctx, t.x, t.z, L.letter());
  }
  walls(ctx, H, r, [['cell', 2], ['bc_lampniche', 1], ['symbol', 1]], 0.4);
  lamps(ctx, H, r, 1);
  band(ctx, H, r, ['trowie', 'trowie'], { x: r.cx + 2, z: r.cz }, 'bays', { dormant: 3 });
  band(ctx, H, r, ['drowned'], { x: r.cx - 2, z: r.cz }, 'hub');
}
// The gallery: the passage in the wall, climbing up over itself.
function gallery(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_slate);
  const Fm = frameOf(ctx, H, r);
  // The rise: up a step, along the top, down a step; never where a way in
  // comes into it.
  const len = Math.min(Fm.L - 6, rng.int(5, 8));
  let a = null;
  for (let t = 0; t < 8 && a === null; t++) {
    const u0 = rng.int(2, Math.max(2, Fm.L - len - 3));
    let ok = true;
    for (let u = u0 - 1; u <= u0 + len && ok; u++) {
      for (let v = 0; v < Fm.Wd && ok; v++) {
        const p = Fm.P(u, v);
        if (H.own(ctx.plan, r, p.x, p.z) && (byDoor(ctx, H, r, p.x, p.z, 1) || !free(ctx, H, r, p.x, p.z))) ok = false;
      }
    }
    if (ok) a = u0;
  }
  if (a !== null) {
    for (let u = a; u < a + len; u++) {
      const step = u === a || u === a + len - 1;
      for (let v = 0; v < Fm.Wd; v++) {
        const p = Fm.P(u, v);
        if (!H.own(ctx.plan, r, p.x, p.z)) continue;
        raise(ctx, H, p.x, p.z, step ? B.bc_step : B.bc_ledge, step ? 1 : 2);
      }
    }
  }
  // The slit at its far end, the gale coming down the whole of it.
  const end = Fm.P(Fm.L, Fm.mid);
  if (!ctx.plan.at(end.x, end.z) && b.get(end.x, FY, end.z) === ctx.T.wall) {
    const dir = { x: Fm.longX ? -Fm.dir : 0, z: Fm.longX ? 0 : -Fm.dir };
    const tiles = [];
    for (let u = Fm.L - 1; u >= 0; u--) for (let v = 0; v < Fm.Wd; v++) {
      const p = Fm.P(u, v);
      if (H.own(ctx.plan, r, p.x, p.z)) tiles.push(abs(ctx, p));
    }
    out.slits = [...(out.slits || []), { ...abs(ctx, end), dir, tiles, room: r.id, along: true }];
  }
  // Cells off it to shelter in, a kist or the bones of one who didn't.
  for (let i = 0; i < 2; i++) {
    const pk = pocket(ctx, H, r, ctx.T.wall);
    if (!pk) break;
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.bc_slate);
    const back = pk.back;
    if (i === 0) {
      b.set(back.x, FY, back.z, B.bc_bones, rng.int(0, 1));
      lore(ctx, back.x, back.z, L.drowned());
    } else {
      b.set(back.x, FY, back.z, B.bc_kist, rng.int(0, 1));
      lore(ctx, back.x, back.z, L.kist());
    }
  }
  walls(ctx, H, r, [['cell', 3], ['slit', 1], ['bc_lampniche', 2], ['symbol', 1]], 0.4);
  lamps(ctx, H, r, 2);
  band(ctx, H, r, ['trowie', 'trowie'], { x: r.cx, z: r.cz }, 'gallery', { dormant: 3 });
}
// The stair: the drowned stair going down into the black water.
function stair(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_wet);
  // The far half gone down into the water: shallow at its edge, deep in
  // its middle; a shingle bank down one side.
  const bankLeft = rng.chance(0.5);
  const bank = (x) => (bankLeft ? x <= r.x0 + 2 : x >= r.x1 - 2);
  floorAll(ctx, H, r, B.bc_shingle, (x) => bank(x));
  const pool = [];
  for (const t of tilesOf(ctx, H, r)) {
    if (t.z <= r.cz - 1 || bank(t.x) || H.byWall(ctx.plan, t.x, t.z) || byDoor(ctx, H, r, t.x, t.z, 2)) continue;
    pool.push(t);
  }
  for (const t of pool) sink(ctx, H, t.x, t.z, B.bc_shingle, true);
  const deep = pool.filter((t) => t.z >= r.cz + 1 && pool.some((q) => q.x === t.x - 1 && q.z === t.z) && pool.some((q) => q.x === t.x + 1 && q.z === t.z) && pool.some((q) => q.x === t.x && q.z === t.z - 1));
  for (const t of deep) {
    b.set(t.x, FY - 2, t.z, B.water);
    b.set(t.x, FY - 3, t.z, B.bc_shingle);
  }
  if (pool.length) out.pools = [...(out.pools || []), { tiles: pool.map((t) => abs(ctx, t)), room: r.id }];
  // Kelp and the seals on the bank; a drowned sailor; a sea-kist washed up.
  const bankTiles = tilesOf(ctx, H, r).filter((t) => bank(t.x) && ctx.plan.at(t.x, t.z + 1));
  for (const t of rng.shuffle(bankTiles).slice(0, 3)) if (b.get(t.x, FY, t.z) === B.air) b.set(t.x, FY, t.z, B.bc_kelp, rng.int(0, 1));
  const sealAt = rng.shuffle(bankTiles).filter((t) => b.get(t.x, FY, t.z) === B.air).slice(0, rng.int(1, 2));
  for (const t of sealAt) put(ctx, 'seal', t.x, t.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'seals') });
  const bn = place(ctx, H, r, B.bc_bones, rng.int(0, 1));
  if (bn) lore(ctx, bn.x, bn.z, L.drowned());
  const kt = place(ctx, H, r, B.bc_kist, rng.int(0, 1), true);
  if (kt) lore(ctx, kt.x, kt.z, L.letter());
  // The wrecker's false light at the water's edge, its bearer by it; the
  // drowned asleep in the shallows.
  const edge = tilesOf(ctx, H, r).filter((t) => pool.some((p) => Math.abs(p.x - t.x) + Math.abs(p.z - t.z) === 1) && ctx.plan.at(t.x, t.z + 1) && !byDoor(ctx, H, r, t.x, t.z));
  const fl = rng.pick(edge);
  if (fl) {
    b.set(fl.x, FY, fl.z, B.bc_falselight, META_STATE | rng.int(0, 1));
    band(ctx, H, r, ['lantern_bearer'], { x: fl.x, z: fl.z - 1 }, 'light');
  }
  const shallow = pool.filter((t) => !deep.includes(t));
  for (const t of rng.shuffle(shallow).slice(0, 2)) put(ctx, 'drowned', t.x, t.z, r, { dormant: 2, group: groupOf(ctx, r, 'shallows') });
  walls(ctx, H, r, [['bc_wrackwall', 3], ['slit', 1], ['cell', 1]], 0.6);
}
// The den: the wreckers'.
function den(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_planks);
  floorAll(ctx, H, r, B.bc_flags, (x, z) => H.byWall(ctx.plan, x, z));
  // The strongroom: dug behind the wall, barred and padlocked.
  const pk = pocket(ctx, H, r, ctx.T.wall);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.bc_bardoor);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.bc_planks);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['coin', rng.int(10, 25)], ['gem', rng.int(1, 2)], ['fish_pie', rng.int(1, 2)]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.bc_kist, 0);
      lore(ctx, cells[0].x, cells[0].z, L.story());
    }
    if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.bc_plunder, 0);
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    out.strongrooms = [...(out.strongrooms || []), { ...abs(ctx, pk.door), room: r.id }];
  }
  // Plunder; the tally on a kist; the oil they took off the keeper.
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.bc_plunder, rng.int(0, 1), true);
  const tk = place(ctx, H, r, B.bc_kist, rng.int(0, 1), true);
  if (tk) lore(ctx, tk.x, tk.z, L.tally());
  casks(ctx, H, r, 2);
  place(ctx, H, r, B.bc_rope, rng.int(0, 1));
  // A false light by the wall, ready to carry out to the rocks.
  const fl = place(ctx, H, r, B.bc_falselight, META_STATE | rng.int(0, 1), true);
  walls(ctx, H, r, [['bc_patch', 2], ['cell', 1], ['bc_lampniche', 1]], 0.45);
  // The wreckers; one with the strongroom's key; the bearer.
  const crew = band(ctx, H, r, ['wrecker', 'wrecker'], { x: r.cx, z: r.cz }, 'crew');
  if (pk && crew[0]) crew[0].key = 'wreckers_key';
  if (pk && !crew[0]) {
    const t = near(ctx, H, r, r.cx, r.cz, 3);
    if (t) put(ctx, 'wrecker', t.x, t.z, r, { dormant: 5, key: 'wreckers_key', group: groupOf(ctx, r, 'crew') });
  }
  if (fl) band(ctx, H, r, ['lantern_bearer'], { x: fl.x, z: fl.z + 1 }, 'light');
}
// The beacon: up on its dais, cold.
function beacon(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_flags);
  // The dais at the back: three by two, a step up; the beacon on it.
  const S = backSeen(ctx, H, r);
  const mid = S.along ? r.cx : r.cz;
  const dais = [];
  for (let a = mid - 1; a <= mid + 1; a++) {
    for (const off of [0, 1]) {
      const t = at2(S, a, S.back + S.out * off);
      if (clear(ctx, H, r, t.x, t.z) && !byDoor(ctx, H, r, t.x, t.z)) dais.push(t);
    }
  }
  if (dais.length === 6) {
    for (const t of dais) raise(ctx, H, t.x, t.z, B.bc_step, 1);
    const c = at2(S, mid, S.back);
    b.set(c.x, FY + 1, c.z, B.bc_beacon, 0);
    out.beacons = [...(out.beacons || []), { ...abs(ctx, c), room: r.id }];
    // The keeper's kist by it, locked till the light's lit.
    const k = near(ctx, H, r, at2(S, mid + 2, S.back).x, at2(S, mid + 2, S.back).z, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (k) {
      b.set(k.x, FY, k.z, B.bc_keeperkist, 0);
      b.container(k.x, FY, k.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2, ctx.T), ['lantern', 1], ['gem', rng.int(1, 3)], ['spyglass', rng.chance(0.25) ? 1 : 0]], H.foundIn(ctx, false)));
      out.keeperkists = [...(out.keeperkists || []), { ...abs(ctx, k), room: r.id }];
    }
  }
  // His box-bed and his log; his things in a kist; the empty casks; peat.
  const bk = place(ctx, H, r, B.bc_bunk, 0, true);
  if (bk) lore(ctx, bk.x, bk.z, L.log());
  const kt = place(ctx, H, r, B.bc_kist, rng.int(0, 1), true);
  if (kt) lore(ctx, kt.x, kt.z, L.bunk());
  casks(ctx, H, r, 2, false);
  place(ctx, H, r, B.bc_peat, 0, true);
  walls(ctx, H, r, [['slit', 2], ['bc_lampniche', 1], ['symbol', 1]], 0.5);
  lamps(ctx, H, r, 1);
  band(ctx, H, r, ['drowned', 'drowned'], { x: r.cx, z: r.cz + 1 }, 'watch');
  const d0 = dais[0];
  if (d0 && rng.chance(0.6)) put(ctx, 'fulmar', d0.x, d0.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'nest') });
}
// The noust: the boat-shed.
function noust(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.bc_shingle);
  floorAll(ctx, H, r, B.bc_planks, (x, z) => z === r.cz || z === r.cz - 1);
  // The slip: shallow water along the south side.
  const slip = tilesOf(ctx, H, r).filter((t) => t.z === r.z1 && !byDoor(ctx, H, r, t.x, t.z, 2) && H.own(ctx.plan, r, t.x, t.z - 1));
  for (const t of slip) sink(ctx, H, t.x, t.z, B.bc_shingle, true);
  if (slip.length) out.pools = [...(out.pools || []), { tiles: slip.map((t) => abs(ctx, t)), room: r.id }];
  // The wreck's ribs, standing; a figurehead off her; an anchor.
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, r.cx + (i ? 3 : -3), r.cz - 2, 2, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
    if (t) b.set(t.x, FY, t.z, B.bc_ribs, rng.int(0, 1));
  }
  const fh = place(ctx, H, r, B.bc_figurehead, rng.int(0, 1), true);
  if (fh) lore(ctx, fh.x, fh.z, L.figurehead());
  for (const k of ['bc_anchor', 'bc_creels', 'bc_nets', 'bc_rack', 'bc_jawbone']) place(ctx, H, r, B[k], rng.int(0, 1), true);
  place(ctx, H, r, B.bc_rope, rng.int(0, 1));
  casks(ctx, H, r, 2);
  // The seals on the shingle; the fulmars; the drowned.
  for (let i = 0; i < rng.int(1, 2); i++) {
    const t = near(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), r.z1 - 1, 2);
    if (t) put(ctx, 'seal', t.x, t.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'seals') });
  }
  walls(ctx, H, r, [['bc_wrackwall', 2], ['bc_patch', 1], ['cell', 1], ['slit', 1]], 0.5);
  band(ctx, H, r, ['drowned', rng.chance(0.5) ? 'wrecker' : 'drowned'], { x: r.cx, z: r.cz }, 'shed');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'court':
      return court(ctx, H, r);
    case 'wheelhouse':
      return wheelhouse(ctx, H, r);
    case 'gallery':
      return gallery(ctx, H, r);
    case 'stair':
      return stair(ctx, H, r);
    case 'den':
      return den(ctx, H, r);
    case 'beacon':
      return beacon(ctx, H, r);
    case 'noust':
      return noust(ctx, H, r);
  }
}

// What the old rooms set about, the broch's own instead: the old braziers
// (cruisie lamps), kelp, bones, the hanging chains (nets), rubble (peat).
const OWN_OF = new Map([[B.kelp, B.bc_kelp], [B.bones, B.bc_bones], [B.skull_pile, B.bc_bones], [B.hanging_chains, B.air], [B.candles, B.bc_lamp], [B.rubble, B.bc_peat], [B.roots, B.air]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.bc_lamp, META_STATE);
        continue;
      }
      const to = OWN_OF.get(id);
      if (to === undefined) continue;
      b.set(x, H.FY, z, to, to === B.bc_lamp ? META_STATE : (x + z) % 2);
    }
  }
}

function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  ownThings(ctx, H, r);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the keeper's notice by the way in.
      floorAll(ctx, H, r, B.bc_flags);
      if (ctx.n === 0) {
        const w = northWall(ctx, r).find((q) => b.get(q.x, FY, q.z) === ctx.T.wall);
        if (w && face(ctx, w, B.bc_patch)) lore(ctx, w.x, w.z, L.rules());
      }
      walls(ctx, H, r, [['slit', 1], ['bc_lampniche', 1]], 0.3);
      break;
    }
    case 'flooded':
      floorAll(ctx, H, r, B.bc_wet);
      walls(ctx, H, r, [['bc_wrackwall', 3]], 0.6);
      break;
    case 'storehouse':
      floorAll(ctx, H, r, B.bc_planks);
      casks(ctx, H, r, 1);
      walls(ctx, H, r, [['bc_patch', 1], ['cell', 1]], 0.4);
      break;
    case 'treasure':
    case 'trap':
    case 'guard':
    case 'exit':
      floorAll(ctx, H, r, rng.chance(0.5) ? B.bc_slate : B.bc_flags);
      walls(ctx, H, r, [['slit', 1], ['cell', 1], ['bc_lampniche', 1]], 0.3);
      break;
    case 'boss': {
      // The top of the broch, where the light was: flagstones and planks,
      // the beacon (lit, the master's), slits, lamps; its own word cut on
      // a symbol stone.
      floorAll(ctx, H, r, B.bc_flags);
      floorAll(ctx, H, r, B.bc_planks, (x, z) => Math.abs(x - r.cx) + Math.abs(z - r.cz) * 1.4 < 4);
      const t = near(ctx, H, r, r.cx, r.z0 + 1, 2, (x, z) => ctx.plan.at(x, z + 1));
      if (t) b.set(t.x, FY, t.z, B.bc_beacon, META_STATE);
      for (const [dx, dz] of [[-5, 2], [5, 2]]) {
        const q = near(ctx, H, r, r.cx + dx, r.cz + dz, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
        if (q) b.set(q.x, FY, q.z, B.bc_lamp, META_STATE);
      }
      walls(ctx, H, r, [['slit', 2], ['bc_lampniche', 1]], 0.45);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.bc_symbol, 0)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the broch's things, spaced out.
const DECOR = {
  entry: [['bc_peat', 1], ['bc_creels', 1], ['bc_kelp', 1]],
  exit: [['bc_lamp', 1], ['bc_creels', 1]],
  flooded: [['bc_kelp', 2], ['bc_bones', 1]],
  storehouse: [['bc_plunder', 1], ['bc_peat', 1], ['bc_creels', 1]],
  trap: [['bc_bones', 1], ['bc_kelp', 1]],
  treasure: [['bc_lamp', 1], ['bc_plunder', 1]],
  guard: [['bc_lamp', 1], ['bc_plunder', 1]],
  court: [['bc_kelp', 1], ['bc_creels', 1]],
  wheelhouse: [['bc_kelp', 1]],
  gallery: [['bc_bones', 1]],
  stair: [['bc_kelp', 1]],
  den: [['bc_creels', 1], ['bc_nets', 1]],
  beacon: [['bc_peat', 1]],
  noust: [['bc_kelp', 2], ['bc_creels', 1]],
};
const SOLID = new Set(['bc_lamp', 'bc_peat', 'bc_creels', 'bc_plunder']);
const STATE = new Set(['bc_lamp']);
function crowd(ctx, H, r) {
  let n = 0;
  let solid = 0;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z)) continue;
      n++;
      if (BLOCKS[ctx.b.get(x, H.FY, z)].solid) solid++;
    }
  }
  return n ? solid / n : 1;
}
function decorate(ctx, r, H) {
  const { rng, plan, b } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  if (r.sealed && r.kit !== 'treasure') return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 34) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.22) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], STATE.has(k) ? META_STATE : rng.int(0, 1), SOLID.has(k));
      if (!at) break;
      let close = set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2);
      for (let oz = -1; oz <= 1 && !close; oz++) for (let ox = -1; ox <= 1; ox++) if ((ox || oz) && plan.at(at.x + ox, at.z + oz) && b.get(at.x + ox, FY, at.z + oz) !== B.air) close = true;
      if (close) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      set.push(at);
      break;
    }
  }
}

// (Nothing set about so thick some of a room's floor can't be got to from
// its doors: what's in the way, cleared, a thing at a time; a chest stood
// in the one gap there is, moved aside.)
const MOVABLE = new Set(['bc_lamp', 'bc_peat', 'bc_creels', 'bc_plunder', 'bc_kelp', 'bc_rope', 'bc_bones', 'bc_nets', 'bc_rack', 'bc_quern', 'bc_anchor', 'bc_kist', 'bc_oilcask', 'bc_figurehead', 'bc_jawbone', 'bc_ribs', 'bc_bunk', 'bc_falselight', 'brazier', 'candles', 'barrel', 'crate'].map((k) => B[k]));
function openUp(ctx, H, r) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  const hi = (x, z) => (ctx.ledge?.has(key(ctx, x, z)) ? 2 : ctx.lifted?.has(key(ctx, x, z)) ? 1 : ctx.sunk?.has(key(ctx, x, z)) ? -1 : 0);
  const blocked = (x, z) => {
    const y = FY + Math.max(0, hi(x, z));
    return !!BLOCKS[b.get(x, y, z)].solid || !!BLOCKS[b.get(x, y + 1, z)].solid;
  };
  for (let guard = 0; guard < 12; guard++) {
    const seen = new Set();
    const q = [];
    for (const d of H.doorways(plan, r)) {
      if (!H.own(plan, r, d.x, d.z) || blocked(d.x, d.z)) continue;
      seen.add(d.z * W + d.x);
      q.push(d);
    }
    if (!q.length) return;
    while (q.length) {
      const { x, z } = q.pop();
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox;
        const nz = z + oz;
        const j = nz * W + nx;
        if (seen.has(j) || !H.own(plan, r, nx, nz) || blocked(nx, nz)) continue;
        if (Math.abs(hi(nx, nz) - hi(x, z)) > 1) continue;
        seen.add(j);
        q.push({ x: nx, z: nz });
      }
    }
    let cut = null;
    for (let z = r.z0; z <= r.z1 && !cut; z++) {
      for (let x = r.x0; x <= r.x1 && !cut; x++) {
        if (!H.own(plan, r, x, z) || seen.has(z * W + x) || blocked(x, z)) continue;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = { x: x + ox, z: z + oz };
          const y = FY + Math.max(0, hi(t.x, t.z));
          if (H.own(plan, r, t.x, t.z) && MOVABLE.has(b.get(t.x, y, t.z))) {
            cut = { ...t, y };
            break;
          }
        }
      }
    }
    if (!cut) {
      if (!moveChest(ctx, H, r, seen, blocked)) return;
      continue;
    }
    b.set(cut.x, cut.y, cut.z, B.air);
  }
}
function moveChest(ctx, H, r, seen, blocked) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(plan, r, x, z) || b.get(x, FY, z) !== B.chest) continue;
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oz]) => ({ x: x + ox, z: z + oz })).filter((t) => H.own(plan, r, t.x, t.z) && !blocked(t.x, t.z));
      if (!sides.some((t) => seen.has(t.z * W + t.x)) || sides.every((t) => seen.has(t.z * W + t.x))) continue;
      for (let zz = r.z0; zz <= r.z1; zz++) {
        for (let xx = r.x0; xx <= r.x1; xx++) {
          if (!seen.has(zz * W + xx) || Math.abs(xx - x) + Math.abs(zz - z) < 2 || !H.freeIn(ctx, r, xx, zz) || !H.byWall(plan, xx, zz) || isUp(ctx, xx, zz)) continue;
          const from = b.region(x, z);
          const k = Region.idx(x % REGION_W, FY, z % REGION_D);
          const slots = from.containers.get(k);
          from.containers.delete(k);
          b.set(x, FY, z, B.air);
          b.set(xx, FY, zz, B.chest, 0);
          if (slots) b.container(xx, FY, zz, slots);
          for (const m of ctx.out.mimics || []) if (m.x === b.x0 + x && m.z === z) { m.x = b.x0 + xx; m.z = zz; }
          return true;
        }
      }
    }
  }
  return false;
}

// Its architect's last word: what's at work kept only where it still is
// (the beacons, the keepers' kists, the strongrooms, the casks, the slits,
// the cells, the pools); and the lamps and the false lights, as they lie.
function after(ctx, H) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  if (H) for (const r of ctx.plan.rooms) if (r.kit !== 'hidden') openUp(ctx, H, r);
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  out.beacons = (out.beacons || []).filter((q) => at(q, FY + 1) === B.bc_beacon);
  out.keeperkists = (out.keeperkists || []).filter((q) => at(q) === B.bc_keeperkist);
  out.strongrooms = (out.strongrooms || []).filter((q) => at(q) === B.bc_bardoor);
  out.casks = (out.casks || []).filter((q) => at(q) === B.bc_oilcask);
  // (A beacon and no oil on the floor: one of the keeper's own casks has a
  // jar left in it after all.)
  if (out.beacons.length && !out.casks.length) {
    for (let z = 0; z < ctx.plan.D && !out.casks.length; z++) {
      for (let x = 0; x < ctx.W; x++) {
        if (b.get(x, FY, z) !== B.bc_oilcask) continue;
        b.set(x, FY, z, B.bc_oilcask, 0);
        out.casks.push({ ...abs(ctx, { x, z }), room: -1 });
        break;
      }
    }
  }
  out.cells = (out.cells || []).filter((q) => at(q) === B.bc_cell);
  out.slits = (out.slits || []).filter((q) => q.along || at(q) === B.bc_slit);
  out.pools = (out.pools || []).filter((q) => q.tiles.length);
  // (Papers left only where there's still something to read them on.)
  out.lore = (out.lore || []).filter((q) => [FY, FY + 1, FY + 2].some((y) => BLOCKS[at(q, y)]?.interact === 'lore'));
  out.lamps = [];
  out.falselights = [];
  for (let z = 0; z < ctx.plan.D; z++) {
    for (let x = 0; x < ctx.W; x++) {
      const id = b.get(x, FY, z);
      if (id === B.bc_lamp) out.lamps.push(abs(ctx, { x, z }));
      else if (id === B.bc_falselight) out.falselights.push(abs(ctx, { x, z }));
    }
  }
}

export const BROCH_ARCH = {
  own: BROCH_OWN,
  kits,
  // (The gallery and the court never lost to the way down.)
  keep: new Set(['gallery', 'court']),
  spare: (rng, n, have = []) => {
    const pool = [['gallery', 2], ['storehouse', 1], ['flooded', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'gallery';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const BROCH_THINGS = ['bc_beacon', 'bc_falselight', 'bc_lamp', 'bc_oilcask', 'bc_peat', 'bc_quern', 'bc_kist', 'bc_keeperkist', 'bc_creels', 'bc_nets', 'bc_rack', 'bc_rope', 'bc_anchor', 'bc_ribs', 'bc_figurehead', 'bc_jawbone', 'bc_bunk', 'bc_plunder', 'bc_nest', 'bc_kelp', 'bc_bones'].filter((k) => BLOCKS[B[k]]);
