// (Round 108) The Hollow Hill, made over: a court of the fair folk under
// one of the Wyrd Isle's mounds, where it's always twilight from nowhere
// and nothing stays where it was put. Drystone and turf, the heath growing
// through, spirals carved in the kerbstones, ogham on the standing stones,
// silver birches growing indoors, a feast laid that is never eaten. Large
// halls and side chambers, and little height: the court's dais, the
// stones' mound, a pool of stars sunk in the wood (see game/moundwork.js:
// the hill-doors, each with its twin somewhere else in the hill; the feast
// you mustn't eat; the ring that takes you dancing; the stones that roll
// back the cairn's slab when they're woken in the trees' order; the harp).
//
// A floor of it, beside the old rooms (the ring, the court, the glade, the
// shrine, the pillared hall, the traps, the treasure, the guard), and what
// its own rooms are:
//   the hall: the court: starlit stone strewn with petals, birches in two
//     rows, the throne up on its dais, fey lanterns, the harp; the
//     knights; the hob;
//   the feast: the long table laid with fairy food, benches, candle-trees,
//     the piper asleep against the wall; the knights asleep at the table;
//     the changeling;
//   the dance: a ring of toadstools in the heath, its caps, the bones of
//     the taken; the wisps dancing in it, a knight watching;
//   the stones: a mound in the middle, five standing stones on it each
//     cut with its tree's ogham; the cairn's slab in the wall (the chamber
//     behind); the seer's verse; the witch-hares;
//   the passage: the passage tomb, long, its kerbstones carved, basins in
//     its side chambers, the bones of the taken, a hill-door; the ravens;
//   the birchwood: a wood under the hill, birches, hazel, toadstools, a
//     pool of stars; the hares; the hob.
// And the queen's bower, behind a hill-door with no other way in.
// About the floor: its papers (see deeps/moundlore.js) made from the
// hill's own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { moundLore } from './moundlore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket } from './common.js';

const POOL = [['passage', 2], ['hall', 1], ['feast', 1], ['dance', 1], ['stones', 1], ['birchwood', 1], ['ring', 1], ['glade', 1], ['shrine', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['hall', 'feast', 'dance', 'stones', 'birchwood', 'ring', 'glade', 'shrine', 'trap', 'treasure']);
export const MOUND_OWN = new Set(['hall', 'feast', 'dance', 'stones', 'passage', 'birchwood']);

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The passage on every floor; the court's hall on the first and now and
  // then after; the feast or the dance; the stones or the birchwood.
  out.push('passage');
  if (n === 0 || rng.chance(0.4)) out.push('hall');
  out.push(rng.pick(['feast', 'dance']));
  out.push(rng.pick(['stones', 'birchwood']));
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
  hall: [[15, 17], [11, 13]], feast: [[12, 14], [8, 10]], dance: [[11, 13], [10, 11]], stones: [[12, 14], [11, 12]],
  passage: [[15, 19], [5, 6]], birchwood: [[12, 14], [10, 11]],
};
const SHAPES = { hall: ['rect'], feast: ['rect'], dance: ['octagon'], stones: ['octagon'], passage: ['rect'], birchwood: ['rect', 'octagon'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6d04) % list.length] : null;
};
const Lof = (ctx) => ctx.moundLore || (ctx.moundLore = moundLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
function faces(ctx, r, list, p) {
  for (const w of northWall(ctx, r)) {
    if (!ctx.rng.chance(p)) continue;
    face(ctx, w, ctx.rng.weighted(list), ctx.rng.int(0, 1));
  }
}
// A hill-door in the north wall (paired with another at the floor's end:
// see after).
function hilldoor(ctx, H, r, near_ = null) {
  const ws = northWall(ctx, r).filter((w) => ctx.b.get(w.x, ctx.FY, w.z) === ctx.T.wall && clear(ctx, H, r, w.x, w.z + 1) && ctx.plan.at(w.x, w.z + 1));
  if (!ws.length) return null;
  const w = near_ ? ws.sort((a, c) => Math.abs(a.x - near_) - Math.abs(c.x - near_))[0] : ctx.rng.pick(ws);
  if (!face(ctx, w, B.hh_hilldoor)) return null;
  const front = { x: w.x, z: w.z + 1 };
  ctx.reserved.add(key(ctx, front.x, front.z));
  (ctx.out.hilldoors ||= []).push({ ...abs(ctx, w), front: abs(ctx, front), room: r.id });
  return w;
}
// Lanterns along the sides of a room.
function lanterns(ctx, H, r, n) {
  for (let i = 0; i < n; i++) place(ctx, H, r, B.hh_lantern, META_STATE | ctx.rng.int(0, 1), true);
}

// --------------------------------------------------------------- the rooms
// The hall: the court.
function hall(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_starlit);
  // The dais at its head, the throne on it.
  const top = r.z0 + (ctx.plan.at(r.cx, r.z0) ? 0 : 1);
  const dais = [];
  for (let x = r.cx - 2; x <= r.cx + 2; x++) for (const z of [top, top + 1]) if (clear(ctx, H, r, x, z)) dais.push({ x, z });
  if (dais.length >= 8) {
    for (const t of dais) raise(ctx, H, t.x, t.z, B.hh_dais, 1);
    b.set(r.cx, FY + 1, top, B.hh_throne);
    lore(ctx, r.cx, top, L.throne());
    for (const x of [r.cx - 2, r.cx + 2]) if (dais.some((t) => t.x === x && t.z === top)) b.set(x, FY + 1, top, B.hh_candles);
  }
  // The birches down either side, in two rows.
  for (const z of [top + 3, r.z1 - 2]) {
    for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
      if (Math.abs(x - r.cx) <= 1) continue;
      if (clear(ctx, H, r, x, z) && ctx.plan.at(x, z + 1) && b.get(x, FY, z) === B.air) b.set(x, FY, z, B.hh_birch, rng.int(0, 1));
    }
  }
  faces(ctx, r, [[B.hh_woven, 3], [B.hh_niche, 2]], 0.5);
  hilldoor(ctx, H, r, rng.chance(0.5) ? r.x0 + 1 : r.x1 - 1);
  const hp = near(ctx, H, r, r.cx + 3, top + 2, 2, (x, z) => ctx.plan.at(x, z + 1));
  if (hp) b.set(hp.x, FY, hp.z, B.hh_harp, 0);
  lanterns(ctx, H, r, 3);
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.hh_bench, rng.int(0, 1), true);
  band(ctx, H, r, ['fey_knight', rng.chance(0.5) ? 'fey_knight' : 'wisp'], { x: r.cx, z: r.cz + 1 }, 'court');
  band(ctx, H, r, ['hob'], { x: r.x0 + 2, z: r.z1 - 1 }, 'hob', { dormant: 0, peaceful: true });
}
// The feast: the long table laid with fairy food.
function feast(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_flags);
  faces(ctx, r, [[B.hh_niche, 2], [B.hh_woven, 2], [B.hh_spiral, 1]], 0.5);
  const tables = [];
  for (let x = r.cx - 3; x <= r.cx + 3; x++) {
    if (!clear(ctx, H, r, x, r.cz) || !ctx.plan.at(x, r.cz + 1)) continue;
    b.set(x, FY, r.cz, B.hh_feast, (x + r.cz) % 2);
    tables.push(abs(ctx, { x, z: r.cz }));
  }
  if (tables.length) out.feasts = [...(out.feasts || []), { tables, room: r.id }];
  for (const z of [r.cz - 1, r.cz + 1]) {
    for (let x = r.cx - 3; x <= r.cx + 3; x += 2) if (clear(ctx, H, r, x, z) && b.get(x, FY, z) === B.air && ctx.plan.at(x, z + 1)) b.set(x, FY, z, B.hh_bench, 0);
  }
  for (const x of [r.cx - 5, r.cx + 5]) {
    const t = near(ctx, H, r, x, r.cz, 1, (xx, zz) => ctx.plan.at(xx, zz + 1));
    if (t) b.set(t.x, FY, t.z, B.hh_candles);
  }
  const pp = place(ctx, H, r, B.hh_piper, rng.int(0, 1));
  if (pp) lore(ctx, pp.x, pp.z, L.piper());
  // The knights asleep at the table (they wake if you eat); the changeling
  // by the wall, crying.
  band(ctx, H, r, ['fey_knight', 'fey_knight'], { x: r.cx, z: r.cz + 2 }, 'feast', { dormant: 2 });
  band(ctx, H, r, ['changeling'], { x: r.x0 + 2, z: r.z1 - 1 }, 'child', { dormant: 0, peaceful: true });
}
// The dance: the ring of toadstools in the heath.
function dance(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_heath);
  faces(ctx, r, [[B.hh_spiral, 1], [B.hh_woven, 1]], 0.35);
  const rad = Math.max(2.2, Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.28);
  const ring = tilesOf(ctx, H, r).filter((t) => Math.abs(Math.hypot(t.x - r.cx, t.z - r.cz) - rad) < 0.6);
  // In order round it (so the dance goes round).
  ring.sort((a, c) => Math.atan2(a.z - r.cz, a.x - r.cx) - Math.atan2(c.z - r.cz, c.x - r.cx));
  for (const t of ring) {
    floorAt(ctx, t.x, t.z, B.hh_ring);
    ctx.reserved.add(key(ctx, t.x, t.z));
  }
  const caps = [];
  for (let i = 0; i < ring.length; i += Math.max(2, Math.floor(ring.length / 4))) {
    const t = ring[i];
    b.set(t.x, FY, t.z, B.hh_ringcap, rng.int(0, 1));
    // (Not kept clear at the end, or they'd be swept away.)
    ctx.reserved.delete(key(ctx, t.x, t.z));
    caps.push(abs(ctx, t));
  }
  if (ring.length >= 6) out.rings = [...(out.rings || []), { tiles: ring.map((t) => abs(ctx, t)), caps, room: r.id }];
  // (Outside the ring, by the walls: a toadstool or two of its own, and
  // the bones of one who danced.)
  place(ctx, H, r, B.hh_toadstools, rng.int(0, 1), true);
  const bn = place(ctx, H, r, B.hh_bones, rng.int(0, 1));
  if (bn) lore(ctx, bn.x, bn.z, L.taken());
  // The wisps dancing in it; a knight watching the dance.
  band(ctx, H, r, ['wisp', 'wisp'], { x: r.cx, z: r.cz }, 'dance', { dormant: 0 });
  band(ctx, H, r, ['fey_knight'], { x: r.cx, z: r.z1 - 1 }, 'watch');
}
// The stones: the mound with its five standing stones; the cairn's slab.
function stones(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_heath);
  // The cairn's chamber first (dug behind a wall, its slab), so the stones
  // keep clear of its door.
  const pk = pocket(ctx, H, r, B.hh_drystone);
  let slab = null;
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.hh_slab);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.hh_flags);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['gem', rng.int(1, 3)], ['gold_ingot', 1], ['heather_bread', rng.int(1, 2)]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.hh_bones, 0);
      lore(ctx, cells[0].x, cells[0].z, L.story());
    }
    if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.hh_cairn, 0);
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    slab = abs(ctx, pk.door);
  }
  // The mound: raised a step in the middle.
  const mound = tilesOf(ctx, H, r).filter((t) => Math.hypot(t.x - r.cx, (t.z - r.cz) * 1.2) <= 2.6 && !H.byWall(ctx.plan, t.x, t.z));
  for (const t of mound) raise(ctx, H, t.x, t.z, B.hh_dais, 1);
  // The five stones on it, round, each its tree (in an order of the hill's
  // own: not the trees' order).
  const ring = mound.filter((t) => Math.hypot(t.x - r.cx, (t.z - r.cz) * 1.2) >= 1.4).sort((a, c) => Math.atan2(a.z - r.cz, a.x - r.cx) - Math.atan2(c.z - r.cz, c.x - r.cx));
  const pick = [];
  for (let i = 0; i < 5 && ring.length >= 5; i++) pick.push(ring[Math.floor((i * ring.length) / 5)]);
  const kinds = rng.shuffle([0, 1, 2, 3, 4]);
  if (pick.length === 5 && slab) {
    const set = [];
    pick.forEach((t, i) => {
      b.set(t.x, FY + 1, t.z, B.hh_stone, kinds[i]);
      set.push({ ...abs(ctx, t), kind: kinds[i] });
    });
    out.circles = [...(out.circles || []), { stones: set, slab, room: r.id }];
  }
  // The seer's verse at the offering; the cairns.
  const of = place(ctx, H, r, B.hh_offering, 0);
  if (of) lore(ctx, of.x, of.z, L.verse());
  place(ctx, H, r, B.hh_cairn, rng.int(0, 1), true);
  faces(ctx, r, [[B.hh_ogham, 3], [B.hh_spiral, 1]], 0.45);
  band(ctx, H, r, ['witch_hare', rng.chance(0.5) ? 'witch_hare' : 'fey_knight'], { x: r.cx, z: r.z1 - 1 }, 'hares');
}
// The passage: the passage tomb.
function passage(ctx, H, r) {
  const { rng } = ctx;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_flags);
  faces(ctx, r, [[B.hh_spiral, 3], [B.hh_ogham, 1]], 0.6);
  hilldoor(ctx, H, r, rng.chance(0.5) ? r.x0 + 1 : r.x1 - 1);
  for (let i = 0; i < 2; i++) {
    const t = place(ctx, H, r, B.hh_basin, 0, true);
    if (t && i === 0) lore(ctx, t.x, t.z, L.doors());
  }
  const bn = place(ctx, H, r, B.hh_bones, rng.int(0, 1));
  if (bn) lore(ctx, bn.x, bn.z, L.taken());
  place(ctx, H, r, B.hh_cairn, rng.int(0, 1), true);
  place(ctx, H, r, B.hh_candles, 0, true);
  band(ctx, H, r, rng.chance(0.5) ? ['grave_raven', 'grave_raven'] : ['grave_raven', 'witch_hare'], { x: r.cx, z: r.cz }, 'passage');
}
// The birchwood: a wood under the hill; the queen's bower behind it.
function birchwood(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.hh_litter);
  // (The heath in patches through the leaf-litter.)
  const ph = (ctx.rec.seed % 97) / 15;
  floorAll(ctx, H, r, B.hh_heath, (x, z) => Math.sin(x * 0.8 + ph) + Math.sin(z * 1.1 + x * 0.4 - ph) > 0.7);
  // The bower: dug behind a wall, its only door a hill-door.
  const pk = pocket(ctx, H, r, B.hh_drystone);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.hh_hilldoor);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.hh_moss);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['gem', rng.int(1, 3)], ['frost_crystal', rng.int(1, 2)], ['seer_stew', 1]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.hh_offering, 0);
      lore(ctx, cells[0].x, cells[0].z, L.changeling());
    }
    if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.hh_toadstools, 0);
    const inside = { x: pk.door.x + pk.dir.x, z: pk.door.z + pk.dir.z };
    const front = { x: pk.door.x - pk.dir.x, z: pk.door.z - pk.dir.z };
    ctx.reserved.add(key(ctx, front.x, front.z));
    (out.hilldoors ||= []).push({ ...abs(ctx, pk.door), front: abs(ctx, inside), outside: abs(ctx, front), room: r.id, bower: true });
  }
  // The pool of stars, sunk.
  const pool = tilesOf(ctx, H, r).filter((t) => ((t.x - r.cx - 1) / 1.8) ** 2 + ((t.z - r.cz) / 1.3) ** 2 <= 1 && !H.byWall(ctx.plan, t.x, t.z) && ctx.b.get(t.x, FY, t.z) === B.air);
  for (const t of pool) sink(ctx, H, t.x, t.z, B.hh_pool);
  // The birches, scattered; hazel; toadstools.
  for (let i = 0; i < 5; i++) {
    const t = near(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1), 2, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
    if (t && b.get(t.x, FY, t.z) === B.air) b.set(t.x, FY, t.z, B.hh_birch, rng.int(0, 1));
  }
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.hh_hazel, rng.int(0, 1), true);
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.hh_toadstools, rng.int(0, 1));
  band(ctx, H, r, ['witch_hare'], { x: r.x0 + 2, z: r.cz }, 'hare');
  band(ctx, H, r, rng.chance(0.5) ? ['hob'] : ['wisp'], { x: r.x1 - 2, z: r.z1 - 1 }, 'wood', { dormant: 0, peaceful: true });
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'hall':
      return hall(ctx, H, r);
    case 'feast':
      return feast(ctx, H, r);
    case 'dance':
      return dance(ctx, H, r);
    case 'stones':
      return stones(ctx, H, r);
    case 'passage':
      return passage(ctx, H, r);
    case 'birchwood':
      return birchwood(ctx, H, r);
  }
}

// What the old rooms set about, the hill's own instead: the old standing
// stones (cairns), candles (candle-trees), the old fairy rings (heath with
// toadstools), the old throne (the hill's), glowshrooms (toadstools),
// roots and bones.
const OWN_OF = new Map([[B.standing_stone, B.hh_cairn], [B.candles, B.hh_candles], [B.bone_throne, B.hh_throne], [B.glowshroom, B.hh_toadstools], [B.bones, B.hh_bones], [B.skull_pile, B.hh_bones], [B.roots, B.air], [B.rubble, B.hh_cairn]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.hh_candles);
        continue;
      }
      if (id === B.fairy_ring) {
        b.set(x, H.FY, z, B.air);
        b.set(x, H.FY - 1, z, B.hh_ring);
        continue;
      }
      const to = OWN_OF.get(id);
      if (to === undefined) continue;
      b.set(x, H.FY, z, to, (x + z) % 2);
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
      // On the first floor, the Wyrdfolk's rules cut on a stone by the way
      // in, and an offering.
      if (ctx.n === 0) {
        const s = place(ctx, H, r, B.hh_offering, 0);
        if (s) lore(ctx, s.x, s.z, L.rules());
      }
      for (const w of northWall(ctx, r)) if (rng.chance(0.3)) face(ctx, w, rng.chance(0.5) ? B.hh_spiral : B.hh_niche);
      break;
    }
    case 'ring':
    case 'glade':
      floorAll(ctx, H, r, B.hh_heath);
      break;
    case 'court':
      floorAll(ctx, H, r, B.hh_starlit);
      break;
    case 'shrine':
      floorAll(ctx, H, r, B.hh_flags);
      for (const w of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, w, rng.chance(0.5) ? B.hh_ogham : B.hh_niche, rng.int(0, 1));
      break;
    case 'treasure':
      floorAll(ctx, H, r, B.hh_starlit);
      break;
    case 'boss': {
      // The master's hall: starlit stone and heath, birches, lanterns, the
      // spirals in its walls; a hill-door; its own word cut in a kerbstone.
      floorAll(ctx, H, r, B.hh_starlit);
      // (The heath growing in from the walls, in drifts.)
      floorAll(ctx, H, r, B.hh_heath, (x, z) => Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z) + Math.sin(x * 0.9 + z * 0.3) * 1.2 + Math.sin(z * 1.3 - x * 0.5) < 1.6);
      for (const q of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, q, rng.chance(0.6) ? B.hh_spiral : B.hh_niche, rng.int(0, 1));
      for (const [dx, dz] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) {
        const t = near(ctx, H, r, r.cx + dx, r.cz + dz, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
        if (t) b.set(t.x, FY, t.z, B.hh_birch, rng.int(0, 1));
      }
      lanterns(ctx, H, r, 2);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.hh_spiral)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the hill's things, spaced out; the walls given
// their faces now and then; the floors as they lie.
const DECOR = {
  entry: [['hh_cairn', 2], ['hh_toadstools', 1], ['hh_bones', 1]],
  exit: [['hh_candles', 1], ['hh_cairn', 1]],
  ring: [['hh_toadstools', 1], ['hh_bones', 1], ['hh_cairn', 1]],
  court: [['hh_lantern', 1], ['hh_bench', 1], ['hh_candles', 1]],
  glade: [['hh_hazel', 2], ['hh_birch', 2], ['hh_toadstools', 1]],
  shrine: [['hh_candles', 1], ['hh_offering', 1]],
  pillared: [['hh_lantern', 1], ['hh_cairn', 1]],
  trap: [['hh_bones', 1]],
  treasure: [['hh_candles', 1], ['hh_cairn', 1]],
  guard: [['hh_bench', 1], ['hh_lantern', 1]],
  hall: [['hh_candles', 1]],
  feast: [['hh_candles', 1], ['hh_bench', 1]],
  dance: [['hh_cairn', 1]],
  stones: [['hh_cairn', 1], ['hh_bones', 1]],
  passage: [['hh_cairn', 2], ['hh_candles', 1], ['hh_bones', 1]],
  birchwood: [['hh_hazel', 1], ['hh_toadstools', 1]],
};
const SOLID = new Set(['hh_lantern', 'hh_bench', 'hh_candles', 'hh_cairn', 'hh_hazel', 'hh_birch']);
const STATE = new Set(['hh_lantern']);
const OLD_FLOOR = { entry: B.hh_heath, exit: B.hh_heath, guard: B.hh_flags, pillared: B.hh_flags, trap: B.hh_heath, collapsed: B.hh_heath };
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
  if (!MOUND_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.07) face(ctx, w, B.hh_spiral, rng.int(0, 1));
      else if (p < 0.1) face(ctx, w, B.hh_niche, rng.int(0, 1));
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
// its doors: what's in the way, cleared, a thing at a time.)
const MOVABLE = new Set(['hh_toadstools', 'hh_cairn', 'hh_hazel', 'hh_birch', 'hh_bench', 'hh_candles', 'hh_lantern', 'hh_bones', 'hh_offering', 'hh_basin', 'brazier', 'candles'].map((k) => B[k]));
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
      // (A chest stood in the one gap there is: moved aside, to a wall
      // on the side it can be got at from.)
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
          if (!seen.has(zz * W + xx) || Math.abs(xx - x) + Math.abs(zz - z) < 2 || !H.freeIn(ctx, r, xx, zz) || !H.byWall(plan, xx, zz) || ctx.lifted?.has(key(ctx, xx, zz)) || ctx.sunk?.has(key(ctx, xx, zz))) continue;
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
// Its architect's last word: the hill-doors paired (the bower's first, its
// twin in another room; the rest two by two; one left over is only
// carved stone); the rings, the feasts and the stones still where they
// were laid.
function after(ctx, H) {
  const { out, b, rng } = ctx;
  const FY = ctx.FY;
  if (H) for (const r of ctx.plan.rooms) if (r.kit !== 'hidden') openUp(ctx, H, r);
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  const doors = (out.hilldoors || []).filter((q) => at(q) === B.hh_hilldoor);
  const bowers = doors.filter((q) => q.bower);
  const rest = rng.shuffle(doors.filter((q) => !q.bower));
  const pairs = [];
  for (const bw of bowers) {
    const i = rest.findIndex((q) => q.room !== bw.room);
    if (i < 0) {
      // (No twin for it: the bower is let alone, its door only stone.)
      for (const y of [FY, FY + 1]) b.set(bw.x - b.x0, y, bw.z, B.hh_spiral);
      continue;
    }
    pairs.push([bw, rest.splice(i, 1)[0]]);
  }
  while (rest.length >= 2) pairs.push([rest.shift(), rest.shift()]);
  for (const q of rest) for (const y of [FY, FY + 1]) b.set(q.x - b.x0, y, q.z, B.hh_spiral);
  out.hilldoors = [];
  for (const [a, c] of pairs) {
    const ia = out.hilldoors.length;
    out.hilldoors.push({ ...a, to: ia + 1 }, { ...c, to: ia });
  }
  // (The fey lanterns, for the wisps and the hob: see moundwork.js.)
  out.lanterns = [];
  for (let z = 0; z < ctx.plan.D; z++) for (let x = 0; x < ctx.W; x++) if (b.get(x, FY, z) === B.hh_lantern) out.lanterns.push(abs(ctx, { x, z }));
  out.rings = (out.rings || []).filter((q) => q.tiles.every((t) => at(t, FY - 1) === B.hh_ring) && q.caps.length && q.caps.every((c) => at(c) === B.hh_ringcap));
  out.feasts = (out.feasts || []).filter((q) => q.tables.some((t) => at(t) === B.hh_feast));
  out.circles = (out.circles || []).filter((q) => q.stones.every((s) => at(s, FY + 1) === B.hh_stone) && at(q.slab) === B.hh_slab);
}

export const MOUND_ARCH = {
  own: MOUND_OWN,
  kits,
  // (The passage and the court never lost to the way down.)
  keep: new Set(['passage', 'hall']),
  spare: (rng, n, have = []) => {
    const pool = [['passage', 2], ['glade', 1], ['ring', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'passage';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const MOUND_THINGS = ['hh_stone', 'hh_cairn', 'hh_basin', 'hh_birch', 'hh_hazel', 'hh_toadstools', 'hh_ringcap', 'hh_throne', 'hh_lantern', 'hh_harp', 'hh_bench', 'hh_feast', 'hh_piper', 'hh_bones', 'hh_offering', 'hh_candles'].filter((k) => BLOCKS[B[k]]);
