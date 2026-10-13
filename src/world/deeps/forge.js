// (Round 101) The Kiln-Deep, made over: the great forge of the Kiln-Kings,
// dug into the mountain and sealed with its smiths still inside. Built,
// monumental, straight-lined: dressed basalt, iron plate underfoot, lit
// from below by the fires; halls bigger than they need to be, and in tiers
// (a gantry along a hall, a pouring platform, troughs and channels sunk in
// the floor, a flue with a ledge up its side).
//
// A floor of it, beside the old rooms (the smelter's lava channel, the
// rows of anvils, the slag heaps, the cooling troughs, the pillared halls,
// the guard, the traps and the treasure), and what its own rooms are:
//   the great forge: the hearth of grates in its middle, the bellows that
//     breathe on it, anvils (the ash-smiths at work at them), trip-hammers
//     falling on their beat, a gantry along its back wall;
//   the casting pit: a pouring platform with the crucible and its lever,
//     a channel cut down from it to a mould sunk in the floor (pull the
//     lever, the metal runs, and in the mould, the kiln-key);
//   the quench hall: troughs along its walls, steam vents down its middle,
//     racks of blades, the quench-law; the iron wardens;
//   the bellows room: the great bellows along its wall, grates before them
//     that flare when they breathe, coal; the bellowsbacks;
//   the guild-hall: fired brick, long tables and benches, the tally of the
//     days, the guild-roll, banners; the three singing anvils and the
//     forge-song, and the guild-door they open;
//   the king's gallery: masterworks on plinths, the Great Work's piece, the
//     founder in stone, and the kiln-door the kiln-key opens;
//   the coal store, and the flue (a ledge up its side, a ladder to it).
// About the floor: its papers (see deeps/forgelore.js) made from the
// forge's own history and its town's.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { forgeLore } from './forgelore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['forgefloor', 2], ['quench', 2], ['bellows', 2], ['coalstore', 1], ['flue', 1], ['smelter', 2], ['anvils', 1], ['slagheap', 1], ['cooling', 1], ['pillared', 1], ['guard', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['guildhall', 'casting', 'gallery', 'coalstore', 'flue', 'anvils', 'cooling', 'pillared', 'guard', 'trap', 'treasure']);
export const FORGE_OWN = new Set(['forgefloor', 'casting', 'quench', 'bellows', 'guildhall', 'gallery', 'coalstore', 'flue']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: a great forge at the head of the list, made its
  // hall.)
  if (last) out.push('forgefloor');
  out.push(n === 0 ? 'guildhall' : rng.pick(['guildhall', 'quench', 'forgefloor']));
  // The casting pit and the gallery its key opens, together.
  if (n === 0 || rng.chance(0.6)) out.push('casting', 'gallery');
  if (!out.includes('forgefloor')) out.push('forgefloor');
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
  forgefloor: [[11, 15], [9, 12]], casting: [[10, 13], [8, 10]], quench: [[11, 15], [6, 8]], bellows: [[8, 11], [7, 9]],
  guildhall: [[11, 14], [8, 10]], gallery: [[9, 12], [7, 9]], coalstore: [[7, 9], [6, 8]], flue: [[6, 8], [6, 8]],
};
const SHAPES = { forgefloor: ['rect', 'octagon'], casting: ['rect'], quench: ['rect'], bellows: ['rect'], guildhall: ['rect'], gallery: ['rect', 'octagon'], coalstore: ['rect'], flue: ['rect'] };

// The master at the bottom: chosen from the deep's own seed, so every
// floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0xf04) % list.length] : null;
};
const Lof = (ctx) => ctx.forgeLore || (ctx.forgeLore = forgeLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const lifted = (ctx, x, z) => (ctx.lifted ||= new Set()).add(key(ctx, x, z));
const abs = (ctx, t) => ({ x: ctx.b.x0 + t.x, z: t.z });
// A group of them set out about a spot, waking as one when you come near.
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
// The north wall's tiles (their faces are the ones you see).
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
// A wall tile given another face (both its rows), if it's still the
// forge's own wall.
function face(ctx, w, id) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id);
  return true;
}
// A patch of another floor (ash, coal), soft-edged: never over a floor
// that means something (a grate, a mould, the guild's brick).
const KEEP_FLOOR = new Set([B.fg_grate, B.fg_mould, B.fg_keymould, B.fg_brick]);
function patch(ctx, H, r, id, cx, cz, rad) {
  for (let z = Math.floor(cz - rad); z <= Math.ceil(cz + rad); z++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z) || KEEP_FLOOR.has(ctx.b.get(x, ctx.FY - 1, z))) continue;
      if (Math.hypot(x - cx, (z - cz) * 1.2) <= rad + ctx.rng.float(-0.6, 0.3)) floorAt(ctx, x, z, id);
    }
  }
}
// The ways worn through a room, door to door: flags laid along them.
function ways(ctx, H, r) {
  const ds = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
  if (ds.length < 2) return;
  const mid = { x: r.cx, z: r.cz };
  for (const d of ds.slice(0, 3)) {
    const n = Math.max(Math.abs(mid.x - d.x), Math.abs(mid.z - d.z));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(d.x + ((mid.x - d.x) * i) / n);
      const z = Math.round(d.z + ((mid.z - d.z) * i) / n);
      if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && ctx.b.get(x, ctx.FY - 1, z) === ctx.T.floor) floorAt(ctx, x, z, ctx.T.alt);
    }
  }
}
// How much of a room's floor is taken up by something solid already.
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
// The tiles along one wall of the room (north, by default: its face is
// the one you see), clear of the ways in.
function rimRow(ctx, H, r, side = 'n') {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
      const wallAt = side === 'n' ? !ctx.plan.at(x, z - 1) : side === 's' ? !ctx.plan.at(x, z + 1) : side === 'w' ? !ctx.plan.at(x - 1, z) : !ctx.plan.at(x + 1, z);
      if (!wallAt) continue;
      if (H.doorways(ctx.plan, r).some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) <= 2)) continue;
      out.push({ x, z });
    }
  }
  return out;
}
// A gantry a step up along a run of tiles, an iron stair up to it at one
// end (facing up it from the room).
function gantry(ctx, H, r, tiles) {
  const { b } = ctx;
  const FY = H.FY;
  for (const t of tiles) raise(ctx, H, t.x, t.z, B.fg_gantry);
  for (const t of [tiles[0], tiles[tiles.length - 1]]) {
    for (const [ox, oz, rot] of [[0, 1, 0], [0, -1, 2], [1, 0, 3], [-1, 0, 1]]) {
      const x = t.x + ox;
      const z = t.z + oz;
      if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
      b.set(x, FY, z, B.fg_gantrysteps, rot);
      lifted(ctx, x, z);
      return true;
    }
  }
  return false;
}
// A tile in front of a spot, into the room.
const tilesOf = (ctx, H, r) => {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z)) out.push({ x, z });
  return out;
};

// --------------------------------------------------------------- the rooms
// The great forge: the hearth of grates in its middle and the bellows that
// breathe on it, anvils with the ash-smiths at them, trip-hammers on their
// beat, a gantry along its back.
function forgefloor(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  // The gantry along its back (north) wall, first, so the floor's laid out
  // round it; chains hung from the dark in front of it.
  const row = longestRun(rimRow(ctx, H, r, 'n'), true);
  let deck = [];
  if (row.length >= 5) {
    deck = row.slice(1, -1);
    if (!gantry(ctx, H, r, deck)) deck = [];
  }
  // The hearth: grates over the fire, three by two.
  const hearth = [];
  for (let z = r.cz; z <= r.cz + 1; z++) {
    for (let x = r.cx - 1; x <= r.cx + 1; x++) {
      if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
      floorAt(ctx, x, z, B.fg_grate);
      hearth.push(abs(ctx, { x, z }));
    }
  }
  if (hearth.length) (out.grates ||= []).push({ tiles: hearth, room: r.id, phase: rng.float(0, 5) });
  // Its bellows either side, nozzles to the fire.
  for (const [ox, rot] of [[-2, 1], [2, 0]]) {
    const s = near(ctx, H, r, r.cx + ox, r.cz, 1, (x, z) => Math.abs(x - r.cx) >= 2 && !H.doorBlocked(ctx.plan, r, x, z));
    if (s) b.set(s.x, FY, s.z, B.fg_bellows, rot);
  }
  // The anvils before the hearth, an ash-smith at each.
  const smiths = groupOf(ctx, r, 'smiths');
  for (const ox of [-2, 2]) {
    const a = near(ctx, H, r, r.cx + ox, r.cz + 3, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z));
    if (!a) continue;
    b.set(a.x, FY, a.z, B.fg_anvil, rng.int(0, 1));
    const s = near(ctx, H, r, a.x, a.z + 1, 1);
    if (s) put(ctx, 'ash_smith', s.x, s.z, r, { peaceful: true, group: smiths, anvil: abs(ctx, a) });
  }
  // Trip-hammers across the way, on their beat.
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  for (const k of [0, 1]) {
    if (k && rng.chance(0.4)) break;
    const t = along ? { x: k ? r.x1 - 2 : r.x0 + 2, z: r.cz + 1 } : { x: r.cx + 3, z: k ? r.z1 - 2 : r.z0 + 3 };
    const s = near(ctx, H, r, t.x, t.z, 1, (x, z) => !H.doorBlocked(ctx.plan, r, x, z));
    if (!s) continue;
    b.set(s.x, FY, s.z, B.fg_hammer);
    (out.hammers ||= []).push({ ...abs(ctx, s), phase: k * 1.2 + rng.float(0, 0.6), room: r.id });
  }
  // Who's here: a bellowsback up on the gantry, an iron warden by the
  // hearth; the hounds, on the master's floor.
  const g = groupOf(ctx, r, 'forge');
  if (deck.length) {
    const up = rng.pick(deck);
    put(ctx, 'bellowsback', up.x, up.z, r, { dormant: 5, group: g });
    for (const t of deck) if (rng.chance(0.25) && ctx.plan.at(t.x, t.z + 1)) b.set(t.x, FY + 1, t.z, B.fg_chain);
  }
  if (rng.chance(0.6)) band(ctx, H, r, ['iron_warden'], { x: r.cx, z: r.cz + 2 }, 'forge');
  else band(ctx, H, r, ['forge_hound', 'forge_hound'], { x: r.cx, z: r.cz + 2 }, 'forge');
  if (rng.chance(0.5)) band(ctx, H, r, ['cinderling', 'cinderling'], { x: r.cx, z: r.cz - 1 }, 'forge');
}
// The casting pit: a pouring platform with the crucible and its lever on
// it, a channel cut down from it to the mould where the kiln-key is cast.
function casting(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (free(ctx, H, r, t.x, t.z) && !H.doorBlocked(ctx.plan, r, t.x, t.z)) row0.push(t);
  }
  const run = longestRun(row0, S.along);
  const step = (t, k) => ({ x: t.x + (S.along ? 0 : S.out * k), z: t.z + (S.along ? S.out * k : 0) });
  const mid = Math.floor(run.length / 2);
  if (run.length < 5) {
    band(ctx, H, r, ['magma_slug', 'slag_crab'], { x: r.cx, z: r.cz }, 'cast');
    return;
  }
  // The platform: three wide, a step up, iron.
  const plat = run.slice(mid - 1, mid + 2);
  for (const t of plat) raise(ctx, H, t.x, t.z, B.fg_gantry);
  const c = plat[1];
  // The channel: from the foot of the platform, out into the room, to the
  // mould at its end.
  const chan = [];
  for (let k = 1; k <= 5; k++) {
    const t = step(c, k);
    if (!free(ctx, H, r, t.x, t.z) || H.doorBlocked(ctx.plan, r, t.x, t.z)) break;
    chan.push(t);
  }
  if (chan.length < 3) {
    for (const t of plat) {
      b.set(t.x, FY, t.z, B.air);
      ctx.lifted?.delete(key(ctx, t.x, t.z));
    }
    band(ctx, H, r, ['magma_slug', 'slag_crab'], { x: r.cx, z: r.cz }, 'cast');
    return;
  }
  const mould = chan[chan.length - 1];
  for (const t of chan.slice(0, -1)) sink(ctx, H, t.x, t.z, B.fg_flags);
  sink(ctx, H, mould.x, mould.z, B.fg_mould);
  // The crucible on it, the lever beside; the iron stair up at its end.
  b.set(c.x, FY + 1, c.z, B.fg_crucible);
  const lv = plat[rng.chance(0.5) ? 0 : 2];
  b.set(lv.x, FY + 1, lv.z, B.fg_lever);
  const end = lv === plat[0] ? plat[2] : plat[0];
  const sx = step(end, 1);
  if (free(ctx, H, r, sx.x, sx.z) && !H.doorBlocked(ctx.plan, r, sx.x, sx.z)) {
    const rot = S.along ? (S.out > 0 ? 2 : 0) : S.out > 0 ? 1 : 3;
    b.set(sx.x, FY, sx.z, B.fg_gantrysteps, rot);
    lifted(ctx, sx.x, sx.z);
  }
  // (And the other end's way up, if the first won't do.)
  const sy = step(lv, 1);
  if (b.get(sx.x, FY, sx.z) !== B.fg_gantrysteps && free(ctx, H, r, sy.x, sy.z)) {
    const rot = S.along ? (S.out > 0 ? 2 : 0) : S.out > 0 ? 1 : 3;
    b.set(sy.x, FY, sy.z, B.fg_gantrysteps, rot);
    lifted(ctx, sy.x, sy.z);
  }
  (out.casts ||= []).push({
    lever: { ...abs(ctx, lv), y: FY + 1 }, crucible: { ...abs(ctx, c), y: FY + 1 },
    channel: chan.slice(0, -1).map((t) => abs(ctx, t)), mould: abs(ctx, mould), room: r.id,
  });
  // Bar moulds set flush in the floor about it, and ingots cast long ago.
  let n = 0;
  for (const t of rng.shuffle(tilesOf(ctx, H, r))) {
    if (n >= 3) break;
    if (Math.abs(t.x - c.x) + Math.abs(t.z - c.z) < 3) continue;
    floorAt(ctx, t.x, t.z, B.fg_mould);
    n++;
  }
  place(ctx, H, r, B.fg_ingots, rng.int(0, 1), true);
  band(ctx, H, r, ['magma_slug', rng.chance(0.5) ? 'slag_crab' : 'forge_hound'], { x: r.cx, z: r.cz }, 'cast');
}
// The quench hall: troughs along its walls, steam vents down its middle,
// racks of blades; the quench-law over it all; the iron wardens.
function quench(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  // The troughs: along the long walls, two or three tiles to a trough.
  for (const side of along ? ['n', 's'] : ['w', 'e']) {
    const row = rimRow(ctx, H, r, side);
    let k = 0;
    for (const t of row) {
      const u = along ? t.x - r.x0 : t.z - r.z0;
      if (u % 4 === 3 || u % 4 === 0) continue;
      if (side === 'n' && k % 5 === 4) {
        k++;
        continue;
      }
      sink(ctx, H, t.x, t.z, B.fg_flags, true);
      k++;
    }
  }
  // The vents down its middle.
  const midline = [];
  for (let u = 2; u <= (along ? r.x1 - r.x0 : r.z1 - r.z0) - 2; u += 3) {
    const t = along ? { x: r.x0 + u, z: r.cz } : { x: r.cx, z: r.z0 + u };
    if (free(ctx, H, r, t.x, t.z) && !H.doorBlocked(ctx.plan, r, t.x, t.z)) midline.push(t);
  }
  for (const t of midline.slice(0, 3)) {
    b.set(t.x, FY, t.z, B.fg_vent);
    (out.vents ||= []).push({ ...abs(ctx, t), phase: rng.float(0, 6), room: r.id });
  }
  // The quench-law over the troughs.
  const wall = northWall(ctx, r);
  const lw = wall[Math.floor(wall.length / 2)];
  if (lw && face(ctx, lw, B.fg_roll)) lore(ctx, lw.x, lw.z, L.quench());
  // Racks of blades, cooling.
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.fg_rack, rng.int(0, 1), true);
  // The wardens, and a cinderling to heat them.
  band(ctx, H, r, ['iron_warden', 'forge_hound'], { x: r.cx, z: r.cz }, 'quench');
  if (rng.chance(0.6)) band(ctx, H, r, ['cinderling'], { x: r.cx + 2, z: r.cz }, 'quench');
}
// The bellows room: the great bellows along its wall, grates before them
// that flare as they breathe, coal; the bellowsbacks.
function bellows(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const row = rimRow(ctx, H, r, 'n');
  const tiles = [];
  let n = 0;
  for (const t of row) {
    if ((t.x - r.x0) % 3 !== 1 || n >= 3) continue;
    b.set(t.x, FY, t.z, B.fg_bellows, rng.int(0, 1));
    n++;
    const g = { x: t.x, z: t.z + 1 };
    if (free(ctx, H, r, g.x, g.z) && !H.doorBlocked(ctx.plan, r, g.x, g.z)) {
      floorAt(ctx, g.x, g.z, B.fg_grate);
      tiles.push(abs(ctx, g));
      for (const ox of [-1, 1]) {
        const q = { x: g.x + ox, z: g.z };
        if (free(ctx, H, r, q.x, q.z) && !H.doorBlocked(ctx.plan, r, q.x, q.z) && rng.chance(0.6)) {
          floorAt(ctx, q.x, q.z, B.fg_grate);
          tiles.push(abs(ctx, q));
        }
      }
    }
  }
  if (tiles.length) (out.grates ||= []).push({ tiles, room: r.id, phase: rng.float(0, 5) });
  patch(ctx, H, r, B.fg_coal, r.cx + rng.int(-2, 2), r.z1 - 1, 1.8);
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.fg_coalheap, rng.int(0, 1));
  if (rng.chance(0.6)) place(ctx, H, r, B.fg_cart, rng.int(0, 1), true);
  band(ctx, H, r, ['bellowsback', 'cinderling', 'cinderling'], { x: r.cx, z: r.cz + 1 }, 'bellows');
}
// The guild-hall: fired brick underfoot, long tables and benches, the tally
// and the guild-roll on its wall, banners; the singing anvils and the
// forge-song, and the guild-door they open; ash-smiths at rest.
function guildhall(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z)) floorAt(ctx, x, z, B.fg_brick);
  // The tally and the roll on its north wall; banners before it.
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  const picks = [Math.floor(wall.length * 0.25), Math.floor(wall.length * 0.5), Math.floor(wall.length * 0.75)];
  const [wt, wsong, wr] = picks.map((i) => wall[i]);
  if (wt && face(ctx, wt, B.fg_tally)) lore(ctx, wt.x, wt.z, L.tally());
  if (wr && face(ctx, wr, B.fg_roll)) lore(ctx, wr.x, wr.z, L.roll());
  let plaque = null;
  if (wsong && face(ctx, wsong, B.fg_relief)) plaque = wsong;
  for (const w of [wall[0], wall[wall.length - 1]]) if (w && free(ctx, H, r, w.x, w.z + 1)) b.set(w.x, FY, w.z + 1, B.fg_banner);
  // The long tables, benches either side of them; ash-smiths on the
  // benches, at rest (neutral, till they're given cause).
  const smiths = groupOf(ctx, r, 'guild');
  let seated = 0;
  let lettered = false;
  for (const tz of [r.cz - 1, r.cz + 2]) {
    for (let x = r.cx - 2; x <= r.cx + 1; x++) {
      if (!free(ctx, H, r, x, tz) || H.doorBlocked(ctx.plan, r, x, tz)) continue;
      b.set(x, FY, tz, B.fg_table, x % 2);
      if (!lettered && rng.chance(0.4)) {
        lettered = true;
        lore(ctx, x, tz, L.letter());
      }
      for (const bz of [tz - 1, tz + 1]) {
        if (!free(ctx, H, r, x, bz) || H.doorBlocked(ctx.plan, r, x, bz)) continue;
        if (seated < 2 && rng.chance(0.25)) {
          put(ctx, 'ash_smith', x, bz, r, { peaceful: true, group: smiths });
          seated++;
        } else if (rng.chance(0.6)) b.set(x, FY, bz, B.fg_bench, x % 2);
      }
    }
  }
  // The singing anvils, in a row along the south of the hall, each its
  // note; the guild-door, a pocket dug behind the wall, and its cache.
  const notes = rng.shuffle([0, 1, 2]);
  const anv = [];
  for (let i = 0; i < 3; i++) {
    const s = near(ctx, H, r, r.cx - 3 + i * 3, r.z1 - 1, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z) && !anv.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 2));
    if (!s) break;
    b.set(s.x, FY, s.z, B.fg_singanvil, notes[i]);
    anv.push({ x: s.x, z: s.z, note: notes[i] });
  }
  const pk = anv.length === 3 ? pocket(ctx, H, r, B.fg_wall) : null;
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.fg_guilddoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), ['gold_ingot', rng.int(1, 2)]], H.foundIn(ctx, false)));
    for (const c of pk.cells) if (c !== back && rng.chance(0.35) && b.get(c.x, FY, c.z) === B.air && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z)) b.set(c.x, FY, c.z, B.fg_ingots, rng.int(0, 1));
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.anvils ||= []).push({ anvils: anv.map((q) => ({ ...abs(ctx, q), note: q.note })), song: L.song, door: abs(ctx, pk.door), room: r.id });
    if (plaque) lore(ctx, plaque.x, plaque.z, L.songPlaque());
  } else {
    // (No door to open: the anvils are only anvils, and the plaque the mark.)
    for (const q of anv) b.set(q.x, FY, q.z, B.fg_anvil, q.note % 2);
  }
}
// The king's gallery: masterworks on plinths along its wall (the Great
// Work's piece among them), the founder in stone, and the kiln-door.
function gallery(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const WORK_ROT = { crown: 0, blade: 1, bell: 2, man: 3, gate: 3 };
  const row = rimRow(ctx, H, r, 'n').filter((t) => ctx.plan.at(t.x, t.z + 1));
  let first = true;
  for (const t of row) {
    if ((t.x - r.x0) % 2) continue;
    const rot = first ? WORK_ROT[L.workKey] : rng.int(0, 3);
    b.set(t.x, FY, t.z, B.fg_plinth, rot);
    lore(ctx, t.x, t.z, first ? L.work() : L.masterwork());
    first = false;
  }
  // The founder in stone, at the hall's far end.
  const st = near(ctx, H, r, r.cx, r.z1 - 1, 3, (x, z) => H.byWall(ctx.plan, x, z) && ctx.plan.at(x, z + 1) && Math.abs(x - r.cx) >= 1);
  if (st) {
    b.set(st.x, FY, st.z, B.fg_statue);
    lore(ctx, st.x, st.z, L.sealing());
  }
  // The kiln-door: a pocket behind the wall, the door shut on it, the king's
  // own treasure in it.
  const pk = pocket(ctx, H, r, B.fg_wall);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.fg_kilndoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2.0, ctx.T), ['gold_ingot', rng.int(2, 4)], [rng.pick(['warhammer', 'obsidian_blade']), 1]], H.foundIn(ctx, false)));
    for (const c of pk.cells) if (c !== back && rng.chance(0.4) && b.get(c.x, FY, c.z) === B.air && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z)) b.set(c.x, FY, c.z, rng.chance(0.5) ? B.fg_ingots : B.fg_plinth, rng.int(0, 3));
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.kilndoors ||= []).push({ ...abs(ctx, pk.door), room: r.id });
  }
  for (const ox of [-3, 3]) {
    const s = near(ctx, H, r, r.cx + ox, r.cz - 1, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z));
    if (s && rng.chance(0.7)) b.set(s.x, FY, s.z, B.fg_banner);
  }
  // The king's guard.
  band(ctx, H, r, ['iron_warden', rng.chance(0.5) ? 'iron_warden' : 'ash_smith'], { x: r.cx, z: r.cz }, 'kingsguard');
}
// The coal store: coal underfoot and heaped, a cart, the hoist; slag
// crabs dug into the heaps.
function coalstore(ctx, H, r) {
  const { rng } = ctx;
  patch(ctx, H, r, B.fg_coal, r.cx, r.cz, 2.6);
  patch(ctx, H, r, B.fg_coal, r.cx + rng.int(-2, 2), r.cz + rng.int(-1, 1), 1.6);
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.fg_coalheap, rng.int(0, 1));
  place(ctx, H, r, B.fg_cart, rng.int(0, 1), true);
  place(ctx, H, r, B.fg_chain);
  band(ctx, H, r, ['slag_crab', 'slag_crab'], { x: r.cx, z: r.cz }, 'coal');
}
// The flue: a chimney's foot, soot and ash; its flues in the wall; a ledge
// up its side and an iron ladder to it, something kept up there.
function flue(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  patch(ctx, H, r, B.fg_ash, r.cx, r.cz, 2.4);
  for (const w of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, w, B.fg_flue);
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (free(ctx, H, r, t.x, t.z) && !H.doorBlocked(ctx.plan, r, t.x, t.z)) row0.push(t);
  }
  const ledge = longestRun(row0, S.along);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const mid = Math.floor(ledge.length / 2);
  const li = ledge.length >= 3 ? [mid, mid - 1, mid + 1].find((i) => i > 0 && i < ledge.length - 1 && free(ctx, H, r, front(ledge[i]).x, front(ledge[i]).z) && !H.doorBlocked(ctx.plan, r, front(ledge[i]).x, front(ledge[i]).z)) : undefined;
  if (li !== undefined) {
    for (const t of ledge) raise(ctx, H, t.x, t.z, B.fg_wall, 2);
    const lt = ledge[li];
    const far = li > (ledge.length - 1) / 2 ? ledge[0] : ledge[ledge.length - 1];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), H.foundIn(ctx, false)));
    const { x: lx, z: lz } = front(lt);
    const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
    for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.fg_ladder, d);
    ctx.reserved.add(key(ctx, lx, lz));
  }
  band(ctx, H, r, ['cinderling', 'cinderling'], { x: r.cx, z: r.cz }, 'flue');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'forgefloor':
      return forgefloor(ctx, H, r);
    case 'casting':
      return casting(ctx, H, r);
    case 'quench':
      return quench(ctx, H, r);
    case 'bellows':
      return bellows(ctx, H, r);
    case 'guildhall':
      return guildhall(ctx, H, r);
    case 'gallery':
      return gallery(ctx, H, r);
    case 'coalstore':
      return coalstore(ctx, H, r);
    case 'flue':
      return flue(ctx, H, r);
  }
}

// What the old rooms set about, the forge's own instead: its anvils, its
// crucibles, its braziers, its chains.
const OWN_OF = new Map([[B.anvil, B.fg_anvil], [B.crucible, B.fg_crucible], [B.ash_brazier, B.fg_brazier], [B.brazier, B.fg_brazier], [B.hanging_chains, B.fg_chain]]);
function ownThings(ctx, H, r) {
  const { b } = ctx;
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      const to = OWN_OF.get(id);
      if (to) b.set(x, H.FY, z, to, id === B.anvil ? (x + z) & 1 : 0);
    }
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and the
// forge's own about them.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  ownThings(ctx, H, r);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the founder in stone, and the sealing cut under.
      if (ctx.n === 0) {
        const at = place(ctx, H, r, B.fg_statue, 0, true);
        if (at) lore(ctx, at.x, at.z, L.sealing());
      }
      break;
    }
    case 'anvils': {
      // The old smiths' anvils: an ash-smith still at one; their work about.
      const smiths = groupOf(ctx, r, 'anvils');
      let n = 0;
      for (let z = r.z0; z <= r.z1 && n < 2; z++) {
        for (let x = r.x0; x <= r.x1 && n < 2; x++) {
          if (b.get(x, FY, z) !== B.fg_anvil || !rng.chance(0.5)) continue;
          const s = near(ctx, H, r, x, z + 1, 1);
          if (s) {
            put(ctx, 'ash_smith', s.x, s.z, r, { peaceful: true, group: smiths, anvil: abs(ctx, { x, z }) });
            n++;
          }
        }
      }
      place(ctx, H, r, B.fg_rack, rng.int(0, 1), true);
      break;
    }
    case 'smelter':
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.fg_chain);
      break;
    case 'slagheap':
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.fg_slag, rng.int(0, 1));
      break;
    case 'cooling': {
      // A vent among the troughs.
      const v = near(ctx, H, r, r.cx, r.cz, 2, (x, z) => !H.doorBlocked(ctx.plan, r, x, z));
      if (v) {
        b.set(v.x, FY, v.z, B.fg_vent);
        (ctx.out.vents ||= []).push({ ...abs(ctx, v), phase: rng.float(0, 6), room: r.id });
      }
      if (rng.chance(0.5)) band(ctx, H, r, ['iron_warden'], { x: r.cx, z: r.cz }, 'cooling');
      break;
    }
    case 'pillared':
    case 'guard':
      for (const w of northWall(ctx, r)) if ((w.x - r.x0) % 4 === 2 && free(ctx, H, r, w.x, w.z + 1)) b.set(w.x, FY, w.z + 1, B.fg_banner);
      break;
    case 'boss': {
      // What's written at its master's door: the founder in stone, against
      // the wall, off the middle of the hall (where its master needs room).
      const at = near(ctx, H, r, r.cx, r.z1 - 1, 5, (x, z) => H.byWall(ctx.plan, x, z) && Math.abs(x - r.cx) >= 2);
      if (at) {
        b.set(at.x, FY, at.z, B.fg_statue);
        lore(ctx, at.x, at.z, L.last());
      }
      break;
    }
  }
}

// Each room set about with the forge's things, by what it is, spaced out,
// the solid ones against the walls; its walls given their faces; its floor
// its ways of flags and its drifts of ash.
const DECOR = {
  entry: [['fg_brazier', 2], ['fg_chain', 1]],
  exit: [['fg_brazier', 2], ['fg_slag', 1]],
  smelter: [['fg_ingots', 1], ['fg_coalheap', 1]],
  anvils: [['fg_ingots', 1], ['fg_brazier', 1]],
  slagheap: [['fg_coalheap', 1]],
  cooling: [['fg_rack', 1], ['fg_brazier', 1]],
  pillared: [['fg_brazier', 2], ['fg_chain', 1]],
  guard: [['fg_rack', 1], ['fg_brazier', 1]],
  trap: [['fg_slag', 1]],
  treasure: [['fg_ingots', 1]],
  forgefloor: [['fg_rack', 1], ['fg_ingots', 1], ['fg_coalheap', 1], ['fg_brazier', 1]],
  casting: [['fg_brazier', 1], ['fg_chain', 1]],
  quench: [['fg_brazier', 1]],
  bellows: [['fg_brazier', 1]],
  guildhall: [['fg_brazier', 1], ['fg_ingots', 1]],
  gallery: [['fg_brazier', 2]],
  coalstore: [['fg_brazier', 1]],
  flue: [['fg_slag', 1], ['fg_coalheap', 1]],
};
const SOLID = new Set(['fg_rack', 'fg_ingots', 'fg_brazier', 'fg_slag', 'fg_cart']);
const ROT = new Set(['fg_rack', 'fg_ingots', 'fg_coalheap', 'fg_slag', 'fg_cart']);
function decorate(ctx, r, H) {
  const { rng, plan, b } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  if (r.sealed && r.kit !== 'treasure') return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  // Its floor: the ways through it laid with flags, a drift of ash.
  if (r.kit !== 'guildhall') {
    ways(ctx, H, r);
    if (rng.chance(0.5)) patch(ctx, H, r, B.fg_ash, rng.int(r.x0, r.x1), rng.int(r.z0, r.z1), rng.float(1.0, 1.8));
  }
  // Its walls: a flue's mouth now and then, an iron band, the guild's mark.
  for (const w of northWall(ctx, r)) {
    const p = rng.float(0, 1);
    if (p < 0.06) face(ctx, w, B.fg_flue);
    else if (p < 0.16) face(ctx, w, B.fg_ironband);
    else if (p < 0.19 && r.kit !== 'guildhall') face(ctx, w, B.fg_relief);
  }
  // And its things, spaced out.
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 26) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], ROT.has(k) ? rng.int(0, 1) : 0, SOLID.has(k));
      if (!at) break;
      if (set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2)) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      set.push(at);
      break;
    }
  }
}

// Its architect's last word: a kiln-door with no key cast on its floor
// stands open (the key long since taken).
function after(ctx) {
  const { out, b } = ctx;
  if ((out.kilndoors || []).length && !(out.casts || []).length) {
    for (const k of out.kilndoors) for (const y of [ctx.FY, ctx.FY + 1]) b.set(k.x - b.x0, y, k.z, B.air);
    out.kilndoors = [];
  }
}

export const FORGE_ARCH = {
  own: FORGE_OWN,
  kits,
  // (The great forge, the guild-hall, the casting pit and its gallery never
  // lost to the way down.)
  keep: new Set(['forgefloor', 'guildhall', 'casting', 'gallery']),
  spare: (rng, n, have = []) => {
    const pool = [['smelter', 2], ['forgefloor', 1], ['quench', 1], ['bellows', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'smelter';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a Kiln-Deep's own things are, for those who count them.)
export const FORGE_THINGS = ['fg_anvil', 'fg_singanvil', 'fg_crucible', 'fg_bellows', 'fg_hammer', 'fg_brazier', 'fg_rack', 'fg_ingots', 'fg_coalheap', 'fg_cart', 'fg_vent', 'fg_lever', 'fg_plinth', 'fg_chain', 'fg_banner', 'fg_table', 'fg_bench', 'fg_statue', 'fg_slag', 'fg_ladder'].filter((k) => BLOCKS[B[k]]);
