// (Round 105) The Leviathan's Gut, made over: inside a whale the size of a
// hill, cast up on Corrow so long ago the island grew round it; and it is
// not as dead as it looks. Nothing here was built but what the whalers
// built inside it: walls of flesh in folds, wet, veined, moving; the
// throat's cartilage; the ribs arching up like a cathedral's vault; bile
// in its belly; ambergris; and under everything, the heartbeat (see
// game/gutwork.js: on the beat the valves open, and the ridged floor
// pushes). Mixed in its scale: cramped winding gut, low and close, and
// great chambers; its verticality a ledge up on the ribs where the whalers
// kept their stash, and the bile sunk in the stomach's floor.
//
// A floor of it, beside the old rooms (the ribcage, the bile pool, the
// wreck, the fall, the traps, the treasure, the guard), and what its own
// rooms are:
//   the gullet: a long low tunnel, the throat's cartilage, its floor
//     ridged and pushing along its length; gutworms in holes in its walls;
//   the ribs: the ribcage, a great hall, the ribs in pairs down its sides,
//     bone sand; the whalers' camp under them (their lean-to, the try-pot,
//     harpoons, casks, lanterns, the captain's log); a ledge of bone up
//     along its back with a rope ladder and their stash; the whalers;
//   the stomach: bile sunk in its floor in pools, the swallowed ship on its
//     side (hull, mast, deck, manifest), bile blisters, the dead it's
//     digesting;
//   the valve: a sphincter in the wall that opens on the beat, a moment,
//     and a cache behind it; the floor pushing toward it;
//   the nest: the gutworms' nest: holes in every wall, eggs on the walls
//     and the floor;
//   the ambergris: the pocket where it lies, grey lumps of it, the hermits
//     that wear it; the whalers' scar in the wall (their cache behind);
//   the artery: near the heart: great vessels along the walls, the bile
//     blisters, the beat loud.
// About the floor: its papers (see deeps/gutlore.js) made from the gut's
// own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { gutLore } from './gutlore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['gullet', 3], ['stomach', 1], ['nest', 1], ['ambergris', 1], ['artery', 1], ['valve', 1], ['ribcage', 1], ['bilepool', 1], ['wreck', 1], ['collapsed', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['ribs', 'stomach', 'nest', 'ambergris', 'artery', 'valve', 'ribcage', 'bilepool', 'wreck', 'collapsed', 'trap', 'treasure']);
export const GUT_OWN = new Set(['gullet', 'ribs', 'stomach', 'valve', 'nest', 'ambergris', 'artery']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: its hall at the head of the list, and the
  // arteries by it.)
  if (last) out.push('boss', 'artery');
  // The gullet on every floor; the whalers' ribs on the first and now and
  // then after; the stomach or the ambergris; the valve.
  out.push('gullet');
  if (n === 0 || rng.chance(0.4)) out.push('ribs');
  out.push(rng.pick(['stomach', 'ambergris']));
  if (rng.chance(0.6)) out.push('valve');
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
  gullet: [[15, 19], [4, 5]], ribs: [[15, 17], [11, 13]], stomach: [[14, 17], [11, 13]], valve: [[9, 11], [7, 9]],
  nest: [[11, 13], [8, 10]], ambergris: [[9, 11], [8, 9]], artery: [[11, 13], [8, 10]],
};
const SHAPES = { gullet: ['rect'], ribs: ['rect'], stomach: ['rect', 'octagon'], valve: ['rect'], nest: ['rect', 'octagon'], ambergris: ['rect', 'octagon'], artery: ['rect'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6a04) % list.length] : null;
};
const Lof = (ctx) => ctx.gutLore || (ctx.gutLore = gutLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
const underNorth = (ctx, H, r) => northWall(ctx, r).map((w) => ({ x: w.x, z: w.z + 1, w })).filter((t) => clear(ctx, H, r, t.x, t.z));
// Glowing cysts along the walls (the light down here), spaced out.
function cysts(ctx, H, r, n) {
  const set = [];
  for (const t of ctx.rng.shuffle(tilesOf(ctx, H, r).filter((q) => H.byWall(ctx.plan, q.x, q.z) && ctx.plan.at(q.x, q.z + 1)))) {
    if (set.length >= n) break;
    if (set.some((q) => Math.abs(q.x - t.x) + Math.abs(q.z - t.z) < 5)) continue;
    if (ctx.b.get(t.x, ctx.FY, t.z) !== B.air) continue;
    ctx.b.set(t.x, ctx.FY, t.z, B.lv_cyst);
    set.push(t);
  }
  return set;
}
// A worm's hole in the north wall, the gutworm in it (it lunges out at
// whoever passes, and latches on).
function wormhole(ctx, H, r, at = null) {
  const cands = underNorth(ctx, H, r).filter((t) => !ctx.out.spawns.some((q) => q.x === ctx.b.x0 + t.x && q.z === t.z) && !ctx.reserved.has(key(ctx, t.x, t.z)));
  const pick = at ? cands.sort((a, c) => Math.abs(a.x - at.x) - Math.abs(c.x - at.x))[0] : ctx.rng.pick(cands);
  if (!pick || !face(ctx, pick.w, B.lv_wormhole)) return null;
  put(ctx, 'gutworm', pick.x, pick.z, r, { hole: abs(ctx, pick.w), out: { x: 0, z: 1 } });
  ctx.reserved.add(key(ctx, pick.x, pick.z));
  return pick;
}
// The ridged floor down a run of tiles, its grain one way (it pushes
// that way on the beat).
function rugae(ctx, t, dx, dz) {
  floorAt(ctx, t.x, t.z, dx ? B.lv_rugae_x : B.lv_rugae_z);
  (ctx.out.rugae ||= []).push({ ...abs(ctx, t), dx, dz });
}
// A bile pit: the tiles sunk, bile in them.
function bilePit(ctx, H, tiles) {
  for (const t of tiles) {
    sink(ctx, H, t.x, t.z, B.lv_bile);
    (ctx.out.bile ||= []).push(abs(ctx, t));
  }
}
// The tiles of a blob about (cx, cz), clear, off the walls.
function blobOf(ctx, H, r, cx, cz, rx, rz) {
  return tilesOf(ctx, H, r).filter((t) => ((t.x - cx) / rx) ** 2 + ((t.z - cz) / rz) ** 2 <= 1 && !H.byWall(ctx.plan, t.x, t.z));
}

// --------------------------------------------------------------- the rooms
// The gullet: a long low tunnel of the throat, cartilage in its walls; its
// floor ridged down its middle, pushing along it (toward one end); worm
// holes; a polyp or two, a cyst for light.
function gullet(ctx, H, r) {
  const { rng } = ctx;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.lv_fleshfloor);
  for (const w of northWall(ctx, r)) if (rng.chance(0.6)) face(ctx, w, B.lv_cartilage);
  const dir = rng.chance(0.5) ? 1 : -1;
  for (const t of tilesOf(ctx, H, r)) if (Math.abs(t.z - r.cz) <= (r.z1 - r.z0 >= 4 ? 1 : 0) && t.x > r.x0 && t.x < r.x1) rugae(ctx, t, dir, 0);
  wormhole(ctx, H, r);
  if (r.x1 - r.x0 >= 16) wormhole(ctx, H, r);
  cysts(ctx, H, r, 2);
  place(ctx, H, r, B.lv_polyp, rng.int(0, 1));
  const s = place(ctx, H, r, B.lv_skeleton, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, rng.chance(0.5) ? L.dead() : L.farewell());
  if (rng.chance(0.6)) band(ctx, H, r, rng.chance(0.5) ? ['slime', 'bile_blister'] : ['bone_crab'], { x: r.cx + rng.pick([-4, 4]), z: r.cz }, 'throat');
}
// The ribs: the ribcage, a great hall: the ribs in pairs down its sides;
// bone sand; the whalers' camp in its middle; a ledge of bone along its
// back wall, a rope ladder up to it, their stash on it; the whalers.
function ribs(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.lv_bonesand);
  // The ribs down the sides, facing in.
  for (let z = r.z0 + 2; z <= r.z1 - 1; z += 3) {
    for (const [x, rot] of [[r.x0, 0], [r.x1, 1]]) if (clear(ctx, H, r, x, z) && ctx.plan.at(x, z + 1)) b.set(x, FY, z, B.lv_rib, rot);
  }
  for (const w of northWall(ctx, r)) if (rng.chance(0.35)) face(ctx, w, B.lv_ribwall, rng.int(0, 1));
  const rw = northWall(ctx, r).find((w) => b.get(w.x, FY, w.z) === B.lv_ribwall);
  if (rw) lore(ctx, rw.x, rw.z, L.tally());
  // The ledge (as the ossuary's loft: along the back wall, a ladder up its
  // middle), before the camp, so the camp keeps clear of it.
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 2;
  const hi = (S.along ? r.x1 : r.z1) - 2;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const ledge = longestRun(row0, S.along).slice(0, 5);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const li = ledge.length >= 3 ? [1, 2].find((i) => i < ledge.length - 1 && clear(ctx, H, r, front(ledge[i]).x, front(ledge[i]).z)) : undefined;
  if (li !== undefined) {
    for (const t of ledge) raise(ctx, H, t.x, t.z, B.lv_ledge, 2);
    const lt = ledge[li];
    const far = li > (ledge.length - 1) / 2 ? ledge[0] : ledge[ledge.length - 1];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), ['ambergris', rng.int(1, 2)], ['old_coin', rng.int(3, 8)]], H.foundIn(ctx, false)));
    const bx = ledge.find((t) => t !== far && t !== lt);
    if (bx) b.set(bx.x, FY + 2, bx.z, B.lv_barrels, rng.int(0, 1));
    const { x: lx, z: lz } = front(lt);
    const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
    for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.lv_ladder, d);
    ctx.reserved.add(key(ctx, lx, lz));
  }
  // The camp: the lean-to, the try-pot, harpoons, casks, lanterns, the log.
  const camp = (dx, dz, id, meta = 0) => {
    const t = near(ctx, H, r, r.cx + dx, r.cz + dz, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (t) b.set(t.x, FY, t.z, id, meta);
    return t;
  };
  camp(-2, 0, B.lv_tent, 0);
  camp(1, 0, B.lv_trypot, META_STATE);
  camp(-2, 2, B.lv_harpoons, rng.int(0, 1));
  const ck = camp(3, 2, B.lv_barrels, rng.int(0, 1));
  if (ck) lore(ctx, ck.x, ck.z, L.complaint());
  const lg = camp(0, 2, B.lv_logbook);
  if (lg) lore(ctx, lg.x, lg.z, L.log());
  for (const ox of [-4, 4]) camp(ox, -1, B.lv_lantern, META_STATE | (ox > 0 ? 1 : 0));
  band(ctx, H, r, rng.chance(0.6) ? ['bone_whaler', 'bone_whaler'] : ['bone_whaler', 'bone_crab'], { x: r.cx, z: r.cz + 3 }, 'camp');
  if (rng.chance(0.5)) band(ctx, H, r, ['bone_crab'], { x: r.x0 + 2, z: r.z1 - 1 }, 'bones');
}
// The stomach: bile sunk in its floor in pools; the swallowed ship on its
// side at one end (its hull, its mast, its deck, its manifest); the bile
// blisters; the dead it's digesting.
function stomach(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.lv_fleshfloor);
  for (const w of northWall(ctx, r)) if (rng.chance(0.25)) face(ctx, w, B.lv_artery, rng.int(0, 1));
  // The ship, at the east or west end: its deck laid, its hull and mast.
  const east = rng.chance(0.5);
  const sx = east ? r.x1 - 2 : r.x0 + 2;
  for (const t of tilesOf(ctx, H, r)) if (Math.abs(t.x - sx) <= 2 && Math.abs(t.z - r.cz) <= 2) floorAt(ctx, t.x, t.z, B.lv_deck);
  const put1 = (dx, dz, id, meta = 0) => {
    const t = near(ctx, H, r, sx + dx, r.cz + dz, 1);
    if (t) b.set(t.x, FY, t.z, id, meta);
    return t;
  };
  put1(0, -2, B.lv_mast, east ? 1 : 0);
  put1(east ? 2 : -2, 0, B.lv_hull, east ? 1 : 0);
  put1(0, 2, B.lv_hull, east ? 0 : 1);
  const mf = put1(east ? -1 : 1, 1, B.lv_logbook);
  if (mf) lore(ctx, mf.x, mf.z, L.manifest());
  put1(east ? 1 : -1, -1, B.lv_barrels, rng.int(0, 1));
  if (rng.chance(0.5)) put1(east ? -2 : 2, -1, B.lv_anchor, rng.int(0, 1));
  // The bile: two pools, on the other side from the ship.
  const px = east ? r.x0 + Math.round((r.x1 - r.x0) * 0.3) : r.x1 - Math.round((r.x1 - r.x0) * 0.3);
  bilePit(ctx, H, blobOf(ctx, H, r, px, r.cz - 2, 2.2, 1.4).filter((t) => Math.abs(t.x - sx) > 3));
  bilePit(ctx, H, blobOf(ctx, H, r, r.cx, r.cz + 2, 2.4, 1.2).filter((t) => Math.abs(t.x - sx) > 3));
  // The dead it's digesting, by the bile.
  for (let i = 0; i < 2; i++) {
    const s = place(ctx, H, r, B.lv_skeleton, rng.int(0, 1));
    if (s && i === 0) lore(ctx, s.x, s.z, L.dead());
  }
  cysts(ctx, H, r, 2);
  band(ctx, H, r, ['bile_blister', 'bile_blister'], { x: r.cx, z: r.cz }, 'blisters', { dormant: 0 });
  band(ctx, H, r, rng.chance(0.5) ? ['slime', 'drowned'] : ['bone_whaler', 'slime'], { x: px, z: r.cz }, 'belly');
}
// The valve: a sphincter in the north wall that opens on the beat (a
// moment: be in it then), and a cache behind it; the floor before it
// ridged and pushing toward it; arteries along the wall.
function valve(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, B.lv_fleshfloor);
  const pk = pocket(ctx, H, r, B.lv_flesh);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.lv_valve);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['ambergris', rng.int(1, 3)], ['pearl', rng.int(1, 3)]], H.foundIn(ctx, false)));
    for (const c of pk.cells) {
      if (c === back || (c.x === pk.cells[0].x && c.z === pk.cells[0].z) || b.get(c.x, FY, c.z) !== B.air) continue;
      if (rng.chance(0.5)) b.set(c.x, FY, c.z, rng.chance(0.5) ? B.lv_ambergris : B.lv_cyst, rng.int(0, 1));
    }
    const inside = { x: pk.door.x - pk.dir.x, z: pk.door.z - pk.dir.z };
    ctx.reserved.add(key(ctx, inside.x, inside.z));
    (out.valves ||= []).push({ ...abs(ctx, pk.door), room: r.id });
    // The floor before it pushing toward it (one tile out, two).
    for (let k = 2; k <= 3; k++) {
      const t = { x: pk.door.x - pk.dir.x * k, z: pk.door.z - pk.dir.z * k };
      if (clear(ctx, H, r, t.x, t.z)) rugae(ctx, t, pk.dir.x, pk.dir.z);
    }
  }
  for (const w of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, w, B.lv_artery, rng.int(0, 1));
  cysts(ctx, H, r, 2);
  if (rng.chance(0.6)) band(ctx, H, r, ['bile_blister'], { x: r.cx, z: r.cz + 1 }, 'valve', { dormant: 0 });
  if (rng.chance(0.5)) band(ctx, H, r, ['slime'], { x: r.cx, z: r.z1 - 1 }, 'gut');
}
// The nest: the gutworms': holes in the walls, eggs on the walls and on
// the floor; worms.
function nest(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, B.lv_fleshfloor);
  for (let i = 0; i < 3; i++) wormhole(ctx, H, r, i === 0 ? { x: r.x0 + 2 } : i === 1 ? { x: r.x1 - 2 } : null);
  for (const w of northWall(ctx, r)) if (b.get(w.x, FY, w.z) === ctx.T.wall && rng.chance(0.5)) face(ctx, w, B.lv_eggs);
  for (let i = 0; i < 4; i++) place(ctx, H, r, B.lv_eggclutch, rng.int(0, 1));
  place(ctx, H, r, B.lv_polyp, rng.int(0, 1));
  cysts(ctx, H, r, 2);
  const s = place(ctx, H, r, B.lv_skeleton, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, Lof(ctx).farewell());
  if (rng.chance(0.5)) band(ctx, H, r, ['slime'], { x: r.cx, z: r.cz + 1 }, 'nest');
}
// The ambergris: the pocket where it lies: its floor of it, lumps of it,
// the hermits that wear it; the whalers' scar in the wall, their cache
// behind it.
function ambergris(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.lv_bonesand);
  floorAll(ctx, H, r, B.lv_amberfloor, (x, z) => ((x - r.cx) / 3) ** 2 + ((z - r.cz) / 2.4) ** 2 <= 1);
  for (let i = 0; i < 4; i++) place(ctx, H, r, B.lv_ambergris, rng.int(0, 1));
  const pk = pocket(ctx, H, r, B.lv_flesh);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.lv_scar);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.6, ctx.T), ['ambergris', rng.int(2, 4)], ['harpoon', 1], ['old_coin', rng.int(4, 9)]], H.foundIn(ctx, false)));
    const bc = pk.cells.find((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (bc) b.set(bc.x, FY, bc.z, B.lv_barrels, 0);
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.scars ||= []).push({ ...abs(ctx, pk.door), room: r.id });
  }
  const s = place(ctx, H, r, B.lv_skeleton, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.dead());
  cysts(ctx, H, r, 1);
  band(ctx, H, r, rng.chance(0.5) ? ['ambergris_hermit', 'ambergris_hermit'] : ['ambergris_hermit'], { x: r.cx, z: r.cz }, 'hermits', { dormant: 0 });
  if (rng.chance(0.5)) wormhole(ctx, H, r);
}
// The artery: near the heart: great vessels along the walls, the beat
// loud; blisters; the floor pushing toward a bile pit.
function artery(ctx, H, r) {
  const { rng } = ctx;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.lv_fleshfloor);
  for (const w of northWall(ctx, r)) if (rng.chance(0.7)) face(ctx, w, B.lv_artery, rng.int(0, 1));
  const pit = blobOf(ctx, H, r, r.cx + 2, r.cz + 1, 1.6, 1.2);
  bilePit(ctx, H, pit);
  for (let k = 1; k <= 3; k++) {
    const t = { x: r.cx + 2 - k - 1, z: r.cz + 1 };
    if (clear(ctx, H, r, t.x, t.z)) rugae(ctx, t, 1, 0);
  }
  cysts(ctx, H, r, 2);
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.lv_polyp, rng.int(0, 1));
  const s = place(ctx, H, r, B.lv_skeleton, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.prayer());
  band(ctx, H, r, ['bile_blister', 'bile_blister'], { x: r.cx - 2, z: r.cz - 1 }, 'blisters', { dormant: 0 });
  band(ctx, H, r, rng.chance(0.5) ? ['bone_whaler'] : ['slime'], { x: r.cx, z: r.z1 - 1 }, 'artery');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'gullet':
      return gullet(ctx, H, r);
    case 'ribs':
      return ribs(ctx, H, r);
    case 'stomach':
      return stomach(ctx, H, r);
    case 'valve':
      return valve(ctx, H, r);
    case 'nest':
      return nest(ctx, H, r);
    case 'ambergris':
      return ambergris(ctx, H, r);
    case 'artery':
      return artery(ctx, H, r);
  }
}

// What the old rooms set about, the gut's own instead: the ribs, the dead,
// the casks, the kelp (polyps), the candles and braziers (cysts), urns
// (eggs).
const OWN_OF = new Map([[B.whale_rib, B.lv_rib], [B.bones, B.lv_skeleton], [B.barrel, B.lv_barrels], [B.crate, B.lv_barrels], [B.kelp, B.lv_polyp], [B.candles, B.lv_cyst], [B.urn, B.lv_eggclutch], [B.skull_pile, B.lv_skeleton], [B.rubble, B.lv_polyp]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.lv_cyst);
        continue;
      }
      // (The old wreck's hull and the bile pool's water.)
      if (r.kit === 'wreck' && (id === B.planks_dark || id === B.log_mangrove) && H.own(ctx.plan, r, x, z)) {
        b.set(x, H.FY, z, B.lv_hull, (x + z) % 2);
        continue;
      }
      if (b.get(x, H.FY - 1, z) === B.planks_dark) b.set(x, H.FY - 1, z, B.lv_deck);
      if (b.get(x, H.FY - 1, z) === B.mud) b.set(x, H.FY - 1, z, B.lv_fleshfloor);
      const to = OWN_OF.get(id);
      if (!to) continue;
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
      // On the first floor, the whalers' farewell where they came in.
      if (ctx.n === 0) {
        const s = place(ctx, H, r, B.lv_skeleton, 0);
        if (s) lore(ctx, s.x, s.z, L.letter());
      }
      for (const w of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, w, B.lv_hide);
      cysts(ctx, H, r, 1);
      break;
    }
    case 'bilepool': {
      // The old pool of water: bile, sunk in the floor.
      const pool = [];
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (b.get(x, FY, z) === B.water) pool.push({ x, z });
      for (const t of pool) b.set(t.x, FY, t.z, B.air);
      bilePit(ctx, H, pool);
      break;
    }
    case 'ribcage':
      floorAll(ctx, H, r, B.lv_bonesand);
      if (rng.chance(0.5)) {
        const t = place(ctx, H, r, B.lv_harpoons, 0, true);
        if (t) lore(ctx, t.x, t.z, L.tryworks());
      }
      break;
    case 'wreck':
      floorAll(ctx, H, r, B.lv_fleshfloor, (x, z) => b.get(x, FY - 1, z) === ctx.T.floor);
      break;
    case 'treasure':
      floorAll(ctx, H, r, B.lv_amberfloor);
      break;
    case 'boss': {
      // The master's hall: flesh, the great vessels in its walls, the
      // cysts; the hall's own word cut in a rib by it.
      floorAll(ctx, H, r, B.lv_fleshfloor);
      for (const q of northWall(ctx, r)) if (rng.chance(0.6)) face(ctx, q, rng.chance(0.7) ? B.lv_artery : B.lv_ribwall, rng.int(0, 1));
      cysts(ctx, H, r, 3);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.lv_ribwall)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the gut's things, spaced out; the walls given
// their faces now and then; the floors as they lie.
const DECOR = {
  entry: [['lv_barrels', 1], ['lv_polyp', 1]],
  exit: [['lv_polyp', 1], ['lv_skeleton', 1]],
  ribcage: [['lv_skeleton', 1], ['lv_lantern', 1], ['lv_barrels', 1]],
  bilepool: [['lv_polyp', 1], ['lv_skeleton', 1]],
  wreck: [['lv_barrels', 1], ['lv_anchor', 1]],
  collapsed: [['lv_polyp', 2], ['lv_skeleton', 1]],
  trap: [['lv_skeleton', 1]],
  treasure: [['lv_ambergris', 2], ['lv_barrels', 1]],
  guard: [['lv_harpoons', 1], ['lv_barrels', 1]],
  gullet: [['lv_polyp', 1]],
  ribs: [['lv_skeleton', 1]],
  stomach: [['lv_polyp', 1]],
  valve: [['lv_polyp', 1]],
  nest: [['lv_eggclutch', 1]],
  ambergris: [['lv_polyp', 1]],
  artery: [['lv_polyp', 1]],
};
const SOLID = new Set(['lv_barrels', 'lv_lantern', 'lv_anchor', 'lv_harpoons', 'lv_ambergris']);
const STATE = new Set(['lv_lantern']);
const OLD_FLOOR = { entry: B.lv_fleshfloor, exit: B.lv_fleshfloor, guard: B.lv_bonesand, collapsed: B.lv_bonesand, trap: B.lv_fleshfloor, bilepool: B.lv_fleshfloor };
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
  if (!GUT_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.06) face(ctx, w, B.lv_ribwall, rng.int(0, 1));
      else if (p < 0.1) face(ctx, w, B.lv_artery, rng.int(0, 1));
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

// Its architect's last word: the ridged floor, the bile, the valves and
// the scars still where they were laid.
function after(ctx) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  out.rugae = (out.rugae || []).filter((q) => at(q, FY - 1) === B.lv_rugae_x || at(q, FY - 1) === B.lv_rugae_z);
  out.bile = (out.bile || []).filter((q) => at(q, FY - 2) === B.lv_bile);
  out.valves = (out.valves || []).filter((q) => at(q) === B.lv_valve);
  out.scars = (out.scars || []).filter((q) => at(q) === B.lv_scar);
}

export const GUT_ARCH = {
  own: GUT_OWN,
  kits,
  // (The gullet, the whalers' ribs and the arteries never lost to the
  // way down.)
  keep: new Set(['gullet', 'ribs', 'artery']),
  spare: (rng, n, have = []) => {
    const pool = [['gullet', 2], ['nest', 1], ['ribcage', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'gullet';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const GUT_THINGS = ['lv_rib', 'lv_skeleton', 'lv_tent', 'lv_trypot', 'lv_harpoons', 'lv_lantern', 'lv_barrels', 'lv_ladder', 'lv_logbook', 'lv_ambergris', 'lv_eggclutch', 'lv_cyst', 'lv_polyp', 'lv_hull', 'lv_mast', 'lv_hook', 'lv_anchor'].filter((k) => BLOCKS[B[k]]);
