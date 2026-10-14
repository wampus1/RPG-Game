// (Round 107) The Deep Warren, made over: under Hollowmark, a delve of the
// Hollowfolk's that dug down into a burrow far older than any of theirs,
// round tunnels going down further than anyone has dared follow; and they
// stopped it up again in a hurry. Two layers of digging: the Hollowfolk's
// (warm and round and patched: wattle, round doors, boards and rag rugs,
// lantern pods hung from the roots) and the old burrow's (clay scraped in
// rings by claws, scree underfoot, no light but glowworms). Cramped and
// deep: the delve's sleeping loft up a ladder, the moot's tiers stepped up
// round its hall, pits where the floor has given way (see game/warrenwork.js:
// the blind tunnelers hear you on the scree and the boards; the gloom
// moths smother the pods; the cracked floor gives way; the dresser over
// the pantry door; the stopped-up tunnel).
//
// A floor of it, beside the old rooms (the burrow, the lantern room, the
// roots, the larder, the fall, the traps, the treasure, the guard), and
// what its own rooms are:
//   the delve: a Hollowfolk home: boards and a rag rug, round doors in its
//     walls (one scored from the inside), shelves, the hearth, the table
//     with supper on it, a dresser across the pantry's little door, the
//     sleeping loft up a ladder; the family's diary;
//   the stores: the delve's larder: shelves of jars, casks of mushroom ale,
//     hams and onions hung, root bins, the recipe; the grubs in the bins;
//   the moot: the Moot-hall dug round, its tiers stepped up all round the
//     walls, the speaking-stone in the middle, pods hung over it, benches
//     on the tiers; the moot-book;
//   the tunnel: the old round tunnel: scree loud underfoot, its walls
//     scraped in rings, glowworms, the tunnelers' nest, old bones, and the
//     stopper in its wall (the old cell behind it);
//   the roothall: roots down out of the roof in pillars and curtains, the
//     floor of roots and loam, cracked where it's hollow under; the
//     rootbound;
//   the garden: the Hollowfolk's mushroom beds, glowcaps, pods on their
//     vines, moss paths, the gloom moths; a crack in it.
// About the floor: its papers (see deeps/warrenlore.js) made from the
// delve's own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { warrenLore } from './warrenlore.js';
import { key, raise, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['tunnel', 2], ['delve', 1], ['stores', 1], ['moot', 1], ['roothall', 1], ['garden', 1], ['lanternroom', 1], ['roots', 1], ['larder', 1], ['collapsed', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['delve', 'stores', 'moot', 'roothall', 'garden', 'lanternroom', 'roots', 'larder', 'collapsed', 'trap', 'treasure']);
export const WARREN_OWN = new Set(['delve', 'stores', 'moot', 'tunnel', 'roothall', 'garden']);

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The old tunnel on every floor; the delve on the first and now and then
  // after; the stores or the garden; the moot or the root hall.
  out.push('tunnel');
  if (n === 0 || rng.chance(0.4)) out.push('delve');
  out.push(rng.pick(['stores', 'garden']));
  out.push(rng.pick(['moot', 'roothall']));
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
  delve: [[12, 15], [9, 11]], stores: [[10, 12], [8, 9]], moot: [[15, 17], [13, 15]], tunnel: [[15, 19], [5, 6]],
  roothall: [[12, 14], [10, 11]], garden: [[12, 14], [9, 10]],
};
const SHAPES = { delve: ['rect'], stores: ['rect'], moot: ['octagon'], tunnel: ['rect'], roothall: ['rect', 'octagon'], garden: ['rect'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6c04) % list.length] : null;
};
const Lof = (ctx) => ctx.warrenLore || (ctx.warrenLore = warrenLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
function faces(ctx, r, list, p, skip = null) {
  for (const w of northWall(ctx, r)) {
    if (skip && skip(w)) continue;
    if (!ctx.rng.chance(p)) continue;
    face(ctx, w, ctx.rng.weighted(list), ctx.rng.int(0, 1));
  }
}
// A lantern pod hung from the roof over (x, z), lit (or gone dark).
function pod(ctx, H, r, x, z, lit = true) {
  const t = near(ctx, H, r, x, z, 2, (xx, zz) => ctx.plan.at(xx, zz + 1));
  if (!t) return null;
  ctx.b.set(t.x, ctx.FY, t.z, B.wr_pod, lit ? META_STATE : 0);
  (ctx.out.pods ||= []).push({ ...abs(ctx, t), room: r.id });
  return t;
}
// Cracked earth: hollow under, it gives way (and now and then, in what
// it drops you into, something the old diggers left).
function crack(ctx, H, r, t, cache = false) {
  if (!clear(ctx, H, r, t.x, t.z)) return false;
  floorAt(ctx, t.x, t.z, B.wr_cracked);
  (ctx.out.cracks ||= []).push({ ...abs(ctx, t), room: r.id, ...(cache ? { cache: true } : {}) });
  ctx.reserved.add(key(ctx, t.x, t.z));
  return true;
}

// --------------------------------------------------------------- the rooms
// The delve: a Hollowfolk home.
function delve(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_boards);
  floorAll(ctx, H, r, B.wr_rug, (x, z) => x === r.cx && z === r.cz);
  // The pantry first (dug behind a wall, its little door, the dresser
  // pushed across it), so the rest keeps clear of it.
  const pk = pocket(ctx, H, r, B.wr_loam, (w, d) => d.z === 0 || d.z === 1);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.wr_smalldoor);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.wr_boards);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.6, ctx.T), ['glowberry_tart', rng.int(1, 3)], ['root_stew', rng.int(1, 2)], ['lantern_pod', rng.int(1, 3)]], H.foundIn(ctx, false)));
    const side = pk.cells.find((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (side) b.set(side.x, FY, side.z, B.wr_casks, 0);
    const front = { x: pk.door.x - pk.dir.x, z: pk.door.z - pk.dir.z };
    // (Not kept clear with the reserved paces: it's meant to be in the way.)
    b.set(front.x, FY, front.z, B.wr_dresser, pk.dir.x ? 1 : 0);
    out.pantries = [...(out.pantries || []), { door: abs(ctx, pk.door), dresser: abs(ctx, front), dir: pk.dir, room: r.id }];
  }
  // The sleeping loft: along the back at one end, a ladder up, the bed.
  const S = backSeen(ctx, H, r);
  const row0 = [];
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const loft = longestRun(row0, S.along).slice(0, 3);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const loftAt = new Set();
  if (loft.length === 3 && clear(ctx, H, r, front(loft[1]).x, front(loft[1]).z)) {
    for (const t of loft) {
      raise(ctx, H, t.x, t.z, B.wr_tier, 2);
      loftAt.add(`${t.x},${t.z}`);
    }
    b.set(loft[0].x, FY + 2, loft[0].z, B.wr_bedstead, 0);
    lore(ctx, loft[0].x, loft[0].z, L.drawing());
    const { x: lx, z: lz } = front(loft[1]);
    const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
    for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.wr_ladder, d);
    ctx.reserved.add(key(ctx, lx, lz));
  }
  // The walls: round doors, shelves, the hearth in the middle, wattle.
  const nw = northWall(ctx, r).filter((w) => !loftAt.has(`${w.x},${w.z + 1}`));
  const mid = nw.sort((a, c) => Math.abs(a.x - r.cx) - Math.abs(c.x - r.cx))[0];
  if (mid) face(ctx, mid, B.wr_hearth);
  faces(ctx, r, [[B.wr_door, 2], [B.wr_shelf, 2], [B.wr_wattle, 2]], 0.5, (w) => loftAt.has(`${w.x},${w.z + 1}`));
  // One of the doors scored from the inside.
  const dr = northWall(ctx, r).find((w) => b.get(w.x, FY, w.z) === B.wr_door);
  if (dr && rng.chance(0.6)) for (const y of [FY, FY + 1]) b.set(dr.x, y, dr.z, B.wr_door, 1);
  // The table, supper on it, stools round; the diary on its stand.
  const tb = near(ctx, H, r, r.cx, r.cz, 1, (x, z) => ctx.plan.at(x, z + 1));
  if (tb) {
    b.set(tb.x, FY, tb.z, B.wr_table);
    for (const [dx, dz] of [[-1, 0], [1, 0]]) if (clear(ctx, H, r, tb.x + dx, tb.z + dz) && b.get(tb.x + dx, FY, tb.z + dz) === B.air) b.set(tb.x + dx, FY, tb.z + dz, B.wr_stool, dx < 0 ? 0 : 1);
  }
  const bk = place(ctx, H, r, B.wr_book, 0);
  if (bk) lore(ctx, bk.x, bk.z, L.diary());
  pod(ctx, H, r, r.x0 + 2, r.cz);
  pod(ctx, H, r, r.x1 - 2, r.cz + 1);
  place(ctx, H, r, B.wr_spades, rng.int(0, 1), true);
  // Something came up through the floor at supper.
  band(ctx, H, r, rng.chance(0.5) ? ['tunneler', 'rat'] : ['tunneler'], { x: r.cx + 3, z: r.z1 - 1 }, 'supper');
  if (rng.chance(0.6)) band(ctx, H, r, ['gloom_moth'], { x: r.x0 + 2, z: r.cz + 1 }, 'moths', { dormant: 0 });
}
// The stores: the delve's larder.
function stores(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_floor);
  faces(ctx, r, [[B.wr_shelf, 4], [B.wr_wattle, 1]], 0.7);
  for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
    const t = near(ctx, H, r, x, r.z0 + 1, 1, (xx, zz) => ctx.plan.at(xx, zz + 1));
    if (t) b.set(t.x, FY, t.z, B.wr_hams);
  }
  const ck = place(ctx, H, r, B.wr_casks, rng.int(0, 1), true);
  if (ck) lore(ctx, ck.x, ck.z, L.larder());
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.wr_bins, rng.int(0, 1), true);
  place(ctx, H, r, B.wr_casks, rng.int(0, 1), true);
  const bk = place(ctx, H, r, B.wr_book, 0);
  if (bk) lore(ctx, bk.x, bk.z, L.recipe());
  pod(ctx, H, r, r.cx, r.cz, rng.chance(0.6));
  // The grubs in the bins; something that comes for them.
  band(ctx, H, r, ['larder_grub', 'larder_grub', 'larder_grub'], { x: r.cx, z: r.cz + 1 }, 'grubs', { dormant: 0, peaceful: true });
  band(ctx, H, r, ['tunneler'], { x: r.x1 - 2, z: r.z1 - 1 }, 'larder');
  if (rng.chance(0.3)) band(ctx, H, r, ['rat', 'rat'], { x: r.x0 + 2, z: r.z1 - 1 }, 'rats');
}
// The moot: the Moot-hall dug round, its tiers stepped up all round.
function moot(ctx, H, r) {
  const { b, rng, plan } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_floor);
  // How far a tile is in from the room's edge (its ring).
  const edge = (x, z) => {
    let d = 0;
    while (d < 4 && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].every(([ox, oz]) => H.own(plan, r, x + ox * (d + 1), z + oz * (d + 1)))) d++;
    return d;
  };
  // The ways in, kept level straight in to the floor of the hall.
  const aisle = new Set();
  for (const d of H.doorways(plan, r)) {
    if (!H.own(plan, r, d.x, d.z)) continue;
    const sx = Math.sign(r.cx - d.x);
    const sz = Math.sign(r.cz - d.z);
    const dx = Math.abs(r.cx - d.x) >= Math.abs(r.cz - d.z) ? sx : 0;
    const dz = dx ? 0 : sz;
    for (let k = 0; k <= 3; k++) {
      aisle.add(`${d.x + dx * k},${d.z + dz * k}`);
      for (const s of [-1, 1]) aisle.add(`${d.x + dx * k + (dz ? s : 0)},${d.z + dz * k + (dx ? s : 0)}`);
    }
  }
  const tops = [];
  for (const t of tilesOf(ctx, H, r)) {
    if (aisle.has(`${t.x},${t.z}`)) continue;
    const e = edge(t.x, t.z);
    if (e > 1) continue;
    raise(ctx, H, t.x, t.z, B.wr_tier, e === 0 ? 2 : 1);
    tops.push({ ...t, h: e === 0 ? 2 : 1 });
  }
  // Benches here and there on the tiers.
  for (const t of rng.shuffle(tops).slice(0, 6)) if (b.get(t.x, FY + t.h, t.z) === B.air && plan.at(t.x, t.z + 1)) b.set(t.x, FY + t.h, t.z, B.wr_bench, rng.int(0, 1));
  // The speaking-stone in the middle; pods hung round it.
  const st = near(ctx, H, r, r.cx, r.cz, 1);
  if (st) {
    b.set(st.x, FY, st.z, B.wr_speakstone);
    lore(ctx, st.x, st.z, L.moot());
  }
  for (const [dx, dz] of [[-3, -2], [3, -2], [0, 3]]) pod(ctx, H, r, r.cx + dx, r.cz + dz, rng.chance(0.7));
  const s = place(ctx, H, r, B.wr_dead, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.prayer());
  band(ctx, H, r, rng.chance(0.5) ? ['rootbound', 'rootbound'] : ['rootbound', 'tunneler'], { x: r.cx, z: r.cz + 1 }, 'moot');
}
// The tunnel: the old round tunnel.
function tunnel(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_scree);
  // The stopper (dug first, so the nest keeps clear of it).
  const pk = pocket(ctx, H, r, B.wr_rings);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.wr_stopper);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.wr_scree);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['gem', rng.int(1, 2)], ['lantern_pod', rng.int(2, 4)], ['gold_ore', rng.int(1, 3)]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.wr_dead, 0);
      lore(ctx, cells[0].x, cells[0].z, L.story());
    }
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    out.stoppers = [...(out.stoppers || []), { ...abs(ctx, pk.door), room: r.id }];
  }
  faces(ctx, r, [[B.wr_rings, 4], [B.wr_glow, 2]], 0.8);
  // A run of loam down its middle: the quiet way, if you keep to it.
  for (const t of tilesOf(ctx, H, r)) if (t.z === r.cz && (t.x + r.id) % 5 !== 0) floorAt(ctx, t.x, t.z, B.wr_floor);
  // The nest, at one end, the tunnelers asleep in it; old bones.
  const east = rng.chance(0.5);
  const nx = east ? r.x1 - 2 : r.x0 + 2;
  const ns = near(ctx, H, r, nx, r.cz, 1);
  if (ns) b.set(ns.x, FY, ns.z, B.wr_nest, rng.int(0, 1));
  const bo = place(ctx, H, r, B.wr_bones, rng.int(0, 1), true);
  if (bo) lore(ctx, bo.x, bo.z, L.bones());
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.wr_clods, rng.int(0, 1));
  band(ctx, H, r, ['tunneler', rng.chance(0.5) ? 'tunneler' : 'badger'], { x: nx, z: r.cz }, 'nest', { dormant: 2 });
  if (rng.chance(0.5)) band(ctx, H, r, ['gloom_moth'], { x: east ? r.x0 + 3 : r.x1 - 3, z: r.cz }, 'moth', { dormant: 0 });
}
// The root hall: roots down out of the roof; the floor cracked, hollow
// under; the rootbound.
function roothall(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_floor);
  floorAll(ctx, H, r, B.wr_roots, (x, z) => (x + z * 3) % 7 < 3);
  floorAll(ctx, H, r, B.wr_moss, (x, z) => ((x - r.cx) / 3) ** 2 + ((z - r.cz) / 2) ** 2 <= 1);
  faces(ctx, r, [[B.wr_glow, 1]], 0.3);
  for (const [dx, dz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) {
    const t = near(ctx, H, r, r.cx + dx, r.cz + dz, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
    if (t) b.set(t.x, FY, t.z, B.wr_rootpillar, rng.int(0, 1));
  }
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.wr_hangroots, rng.int(0, 1));
  // The hollow places: cracked, three or four; one with the old diggers'
  // leavings under it.
  const cand = rng.shuffle(tilesOf(ctx, H, r).filter((t) => !H.byWall(ctx.plan, t.x, t.z) && ctx.b.get(t.x, FY, t.z) === B.air));
  let n = 0;
  for (const t of cand) {
    if (n >= 3 + rng.int(0, 1)) break;
    if ((ctx.out.cracks || []).some((q) => Math.abs(q.x - ctx.b.x0 - t.x) + Math.abs(q.z - t.z) < 3)) continue;
    if (crack(ctx, H, r, t, n === 0)) n++;
  }
  const s = place(ctx, H, r, B.wr_dead, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.dead());
  pod(ctx, H, r, r.cx, r.z0 + 1, rng.chance(0.5));
  band(ctx, H, r, ['rootbound', rng.chance(0.5) ? 'rootbound' : 'tunneler'], { x: r.cx, z: r.cz }, 'roots');
}
// The garden: mushroom beds, glowcaps, pods on their vines, moss paths;
// the gloom moths; a crack.
function garden(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.wr_moss);
  // The beds in rows, moss between.
  for (const t of tilesOf(ctx, H, r)) if ((t.z - r.z0) % 3 !== 0 && !H.byWall(ctx.plan, t.x, t.z) && (t.x - r.x0) % 5 !== 0) floorAt(ctx, t.x, t.z, B.wr_bed);
  faces(ctx, r, [[B.wr_wattle, 2], [B.wr_glow, 1]], 0.4);
  for (let i = 0; i < 5; i++) place(ctx, H, r, B.wr_glowcap, rng.int(0, 1), true);
  for (const [dx, dz] of [[-4, -1], [0, -2], [4, -1], [-2, 2], [3, 2]]) pod(ctx, H, r, r.cx + dx, r.cz + dz, rng.chance(0.8));
  place(ctx, H, r, B.wr_spades, rng.int(0, 1), true);
  const bk = place(ctx, H, r, B.wr_book, 0);
  if (bk) lore(ctx, bk.x, bk.z, L.rounds());
  const cand = rng.shuffle(tilesOf(ctx, H, r).filter((t) => !H.byWall(ctx.plan, t.x, t.z) && b.get(t.x, FY, t.z) === B.air));
  if (cand.length) crack(ctx, H, r, cand[0], rng.chance(0.5));
  band(ctx, H, r, ['gloom_moth', 'gloom_moth'], { x: r.cx, z: r.cz }, 'moths', { dormant: 0 });
  if (rng.chance(0.6)) band(ctx, H, r, ['larder_grub'], { x: r.x0 + 2, z: r.z1 - 1 }, 'grub', { dormant: 0, peaceful: true });
  if (rng.chance(0.6)) band(ctx, H, r, ['tunneler'], { x: r.x1 - 2, z: r.z1 - 1 }, 'garden');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'delve':
      return delve(ctx, H, r);
    case 'stores':
      return stores(ctx, H, r);
    case 'moot':
      return moot(ctx, H, r);
    case 'tunnel':
      return tunnel(ctx, H, r);
    case 'roothall':
      return roothall(ctx, H, r);
    case 'garden':
      return garden(ctx, H, r);
  }
}

// What the old rooms set about, the warren's own instead: the glowshrooms
// (glowcaps), the roots (hanging), lanterns (pods), barrels and crates
// (casks and bins), bones (the old diggers'), rubble (clods), the old root
// walls (pillars of roots).
const OWN_OF = new Map([[B.glowshroom, B.wr_glowcap], [B.roots, B.wr_hangroots], [B.lantern, B.wr_pod], [B.barrel, B.wr_casks], [B.crate, B.wr_bins], [B.bones, B.wr_bones], [B.rubble, B.wr_clods], [B.table, B.wr_table], [B.glowberry_bush, B.wr_glowcap]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.wr_glowcap);
        continue;
      }
      // (The old root walls: pillars of roots, top and bottom.)
      if (id === B.root_wall && H.own(ctx.plan, r, x, z)) {
        b.set(x, H.FY, z, B.wr_rootpillar, (x + z) % 2);
        if (b.get(x, H.FY + 1, z) === B.root_wall) b.set(x, H.FY + 1, z, B.air);
        continue;
      }
      if (b.get(x, H.FY - 1, z) === B.dirt) b.set(x, H.FY - 1, z, B.wr_floor);
      const to = OWN_OF.get(id);
      if (!to) continue;
      b.set(x, H.FY, z, to, to === B.wr_pod ? META_STATE : (x + z) % 2);
      if (to === B.wr_pod) (out.pods ||= []).push({ x: b.x0 + x, z, room: r.id });
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
      // On the first floor, a letter where they came down; a round door.
      if (ctx.n === 0) {
        const s = place(ctx, H, r, B.wr_dead, 0);
        if (s) lore(ctx, s.x, s.z, L.letter());
      }
      for (const w of northWall(ctx, r)) if (rng.chance(0.3)) face(ctx, w, rng.chance(0.5) ? B.wr_door : B.wr_wattle);
      pod(ctx, H, r, r.cx, r.cz);
      break;
    }
    case 'larder':
      floorAll(ctx, H, r, B.wr_boards);
      if (rng.chance(0.6)) band(ctx, H, r, ['larder_grub', 'larder_grub'], { x: r.cx, z: r.cz }, 'grubs', { dormant: 0, peaceful: true });
      break;
    case 'lanternroom':
      floorAll(ctx, H, r, B.wr_moss);
      for (let i = 0; i < 2; i++) pod(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1));
      if (rng.chance(0.6)) band(ctx, H, r, ['gloom_moth'], { x: r.cx, z: r.cz }, 'moth', { dormant: 0 });
      break;
    case 'roots':
      floorAll(ctx, H, r, B.wr_roots, (x, z) => (x + z) % 3 === 0);
      break;
    case 'treasure':
      floorAll(ctx, H, r, B.wr_boards);
      break;
    case 'boss': {
      // The master's hall: the old burrow's, round, scree and loam, its
      // walls scraped in rings; pods hung, dark and lit; roots; a crack.
      floorAll(ctx, H, r, B.wr_floor);
      floorAll(ctx, H, r, B.wr_scree, (x, z) => (x * 7 + z * 3) % 5 === 0);
      for (const q of northWall(ctx, r)) if (rng.chance(0.6)) face(ctx, q, rng.chance(0.7) ? B.wr_rings : B.wr_glow, rng.int(0, 1));
      for (const [dx, dz] of [[-4, -1], [4, -1], [-3, 2], [3, 2]]) pod(ctx, H, r, r.cx + dx, r.cz + dz, rng.chance(0.6));
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.wr_hangroots, rng.int(0, 1));
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.wr_rings)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the warren's things, spaced out; the walls
// given their faces now and then; the floors as they lie.
const DECOR = {
  entry: [['wr_spades', 1], ['wr_clods', 1]],
  exit: [['wr_clods', 1], ['wr_hangroots', 1]],
  burrow: [['wr_bones', 1], ['wr_clods', 1], ['wr_nest', 1]],
  lanternroom: [['wr_glowcap', 2], ['wr_hangroots', 1]],
  roots: [['wr_hangroots', 2], ['wr_clods', 1]],
  larder: [['wr_casks', 1], ['wr_bins', 1], ['wr_hams', 1]],
  collapsed: [['wr_clods', 2], ['wr_dead', 1]],
  trap: [['wr_clods', 1]],
  treasure: [['wr_casks', 1], ['wr_dresser', 1]],
  guard: [['wr_spades', 1], ['wr_casks', 1]],
  delve: [['wr_stool', 1]],
  stores: [['wr_bins', 1]],
  moot: [['wr_clods', 1]],
  tunnel: [['wr_clods', 1]],
  roothall: [['wr_hangroots', 1]],
  garden: [['wr_glowcap', 1]],
};
const SOLID = new Set(['wr_casks', 'wr_bins', 'wr_glowcap', 'wr_spades', 'wr_bones', 'wr_stool', 'wr_dresser']);
const OLD_FLOOR = { entry: B.wr_floor, exit: B.wr_floor, guard: B.wr_floor, burrow: B.wr_scree, collapsed: B.wr_scree, trap: B.wr_floor, roots: B.wr_floor, lanternroom: B.wr_moss };
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
  if (OLD_FLOOR[r.kit]) floorAll(ctx, H, r, OLD_FLOOR[r.kit], (x, z) => b.get(x, FY - 1, z) === ctx.T.floor || b.get(x, FY - 1, z) === ctx.T.alt);
  if (!WARREN_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.06) face(ctx, w, B.wr_rings, rng.int(0, 1));
      else if (p < 0.1) face(ctx, w, B.wr_glow, rng.int(0, 1));
      else if (p < 0.13) face(ctx, w, B.wr_wattle, rng.int(0, 1));
    }
  }
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 30) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.22) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], rng.int(0, 1), SOLID.has(k));
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

// (Nothing set about so thick in a room some of its floor can't be got to
// from its doors: what's in the way, cleared, a thing at a time.)
const MOVABLE = new Set(['wr_glowcap', 'wr_stool', 'wr_casks', 'wr_bins', 'wr_spades', 'wr_bones', 'wr_clods', 'wr_hangroots', 'wr_rootpillar', 'wr_bench', 'wr_nest', 'wr_dead', 'wr_table'].map((k) => B[k]));
function openUp(ctx, H, r) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  const hi = (x, z) => (ctx.ledge?.has(key(ctx, x, z)) ? 2 : ctx.lifted?.has(key(ctx, x, z)) ? 1 : ctx.sunk?.has(key(ctx, x, z)) ? -1 : 0);
  const blocked = (x, z) => {
    const y = FY + Math.max(0, hi(x, z));
    return !!BLOCKS[b.get(x, y, z)].solid || !!BLOCKS[b.get(x, y + 1, z)].solid;
  };
  const ladder = (x, z) => [FY, FY + 1].some((y) => BLOCKS[b.get(x, y, z)].ladder);
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
        if (Math.abs(hi(nx, nz) - hi(x, z)) > 1 && !ladder(x, z) && !ladder(nx, nz)) continue;
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
    if (!cut) return;
    b.set(cut.x, cut.y, cut.z, B.air);
  }
}
// Its architect's last word: the pods, the cracks, the pantries and the
// stoppers still where they were laid.
function after(ctx, H) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  if (H) for (const r of ctx.plan.rooms) if (r.kit !== 'hidden') openUp(ctx, H, r);
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  out.pods = (out.pods || []).filter((q) => at(q) === B.wr_pod);
  out.cracks = (out.cracks || []).filter((q) => at(q, FY - 1) === B.wr_cracked && at(q) === B.air);
  out.pantries = (out.pantries || []).filter((q) => at(q.door) === B.wr_smalldoor && at(q.dresser) === B.wr_dresser);
  out.stoppers = (out.stoppers || []).filter((q) => at(q) === B.wr_stopper);
}

export const WARREN_ARCH = {
  own: WARREN_OWN,
  kits,
  // (The old tunnel and the delve never lost to the way down.)
  keep: new Set(['tunnel', 'delve']),
  spare: (rng, n, have = []) => {
    const pool = [['tunnel', 2], ['roots', 1], ['burrow', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'tunnel';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const WARREN_THINGS = ['wr_pod', 'wr_glowcap', 'wr_table', 'wr_stool', 'wr_dresser', 'wr_bedstead', 'wr_book', 'wr_casks', 'wr_hams', 'wr_bins', 'wr_rootpillar', 'wr_hangroots', 'wr_speakstone', 'wr_bench', 'wr_dead', 'wr_ladder', 'wr_nest', 'wr_spades', 'wr_bones', 'wr_clods'].filter((k) => BLOCKS[B[k]]);
