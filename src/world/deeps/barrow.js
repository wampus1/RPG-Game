// (Round 95) The barrow, made over: a chieftain's mound, sealed with the
// hearth-guard that swore to keep them and the goods they took with them.
// Cold and hushed, low and close; old fieldstone and oak, the turf's roots
// through the roof; carved stones standing in the dark.
//
// A floor of it is laid as a barrow is: a processional way of worn flags
// from the way in toward the heart of the mound, lined with great carved
// stones, chambers off it either side; and what the chambers were:
//   the feast of the dead: a long hall where the hearth-guard sit at their
//     benches still, round a hearth gone cold but for a ghost of embers;
//   the ship burial: a longship laid in the earth, a dragon at its prow,
//     its hold sunk below the floor, its dead and its goods aboard;
//   the kerb ring: a round chamber ringed with spiral stones, each carved
//     with a sigil that turns (set them in the order the chief's slab
//     gives, and the stone that closes the chief's treasury rolls back);
//   the vigil: a chamber lined with oak, a bier raised on a dais of flags
//     with someone laid on it, and two of the hearth-guard either side;
//   the offering pit: a pit sunk in the floor where the folk above left
//     what they owed (take it, and the dead come for it);
//   the charnel: bones heaped, and a corpse-light over them (it raises
//     them);
//   the robbers' tunnel: a hole dug in by grave-robbers who never got out
//     again, and what they became, and the last of their notes;
// and the old kinds as well (the guard post, the trapped way, the shrine,
// the hoard, a fall of earth). The chief lies at the bottom, on a dais at
// the back of their hall, or did.
//
// Who lies here, and who's with them, is written down here and there
// (rune slabs you can read: see deeps/lore.js); and what they've set out
// to meet you is laid out as the hearth-guard would: a wall of shields in
// a passage mouth with spears behind it; two at a vigil; the feast's dead
// in their seats, who rise when something's taken.
import { B, BLOCKS } from '../blocks.js';
import { barrowLore } from './lore.js';
import { backOf, at2 } from './common.js';

// Each region's barrow in its own stuff (the carved stones and the oak are
// Thessa's own; elsewhere their own stone and timber stand in).
export function matsOf(T) {
  const thessa = T.wall === B.barrow_stone;
  // (Round 114: never a liquid, a place whose second floor is water.)
  const pick = (...ks) => ks.find((k) => k !== undefined && k !== null && BLOCKS[k] && !BLOCKS[k].liquid) ?? T.floor;
  const flags = thessa ? B.barrow_flags : pick(T.alt, T.floor);
  return {
    thessa,
    wall: T.wall,
    floor: T.floor,
    flags,
    ortho: thessa ? B.barrow_ortho : T.wall,
    oak: thessa ? B.barrow_oak : pick(T.beam, B.planks_dark),
    // (Round 114: steps in every land's, cut from its own flags where
    // there's a stair of them, plain flagstone where not.)
    steps: thessa ? B.barrow_flags_stairs : (B[`${BLOCKS[flags]?.name}_stairs`] ?? B.flagstone_stairs),
    hull: B.planks_dark,
    lamp: thessa ? B.corpse_lantern : pick(B.ash_brazier !== undefined && T.motes && T.motes[0] === '#c8502a' ? B.ash_brazier : null, B.fog_lantern, B.corpse_lantern),
  };
}

// The rooms a barrow's made of (beyond the way in and the way on), by how
// deep: the first floor nearer the door, the hearth-guard's halls below.
const FIRST = [['guard', 3], ['charnel', 2], ['offering_pit', 2], ['vigil', 2], ['robbers', 2], ['kerb_ring', 1], ['trap', 1], ['treasure', 1], ['collapsed', 1], ['shrine', 1]];
const DEEP = [['feast', 3], ['vigil', 2], ['guard', 2], ['charnel', 2], ['kerb_ring', 1], ['offering_pit', 1], ['robbers', 1], ['pillared', 1], ['trap', 1], ['treasure', 1], ['shrine', 1]];
// One of each to a floor, at most (and one ship to a barrow).
const ONCE = new Set(['kerb_ring', 'feast', 'ship', 'robbers', 'offering_pit', 'vigil']);

export const BARROW_KITS = new Set(['feast', 'ship', 'kerb_ring', 'vigil', 'offering_pit', 'charnel', 'robbers']);

// The four sigils a spiral stone shows, by block (see game/deeps.js).
export const SIGIL_BLOCKS = [B.spiral_stone, B.spiral_stone_sun, B.spiral_stone_serpent, B.spiral_stone_eye];

// The floor the ship lies on (a middle one, if it goes deep enough).
export const shipFloor = (rec) => (rec.depth >= 2 ? (rec.seed >>> 0) % Math.max(1, rec.depth - 1) : -1);

function kits(rng, rec, n, last, count) {
  const pool = n === 0 ? FIRST : DEEP;
  const out = [];
  if (n === shipFloor(rec) && !last) out.push('ship');
  // (Every floor below the first keeps a vigil; the feast's on the second
  // floor down if there is one.)
  if (n >= 1) out.push('vigil');
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const k = rng.weighted(pool);
    if (ONCE.has(k) && out.includes(k)) continue;
    out.push(k);
  }
  return rng.shuffle(out).slice(0, count);
}

const SIZES = {
  feast: [[13, 16], [7, 9]], ship: [[13, 15], [8, 10]], kerb_ring: [[10, 12], [9, 11]], vigil: [[8, 10], [7, 8]],
  offering_pit: [[8, 11], [8, 10]], charnel: [[7, 10], [6, 8]], robbers: [[7, 10], [6, 8]],
};
const SHAPES = {
  feast: ['rect'], ship: ['rect'], kerb_ring: ['round'], vigil: ['rect'], offering_pit: ['round', 'octagon'], charnel: ['round', 'rect'], robbers: ['cave'],
};

// --------------------------------------------------------------- helpers
const key = (ctx, x, z) => z * ctx.W + x;
// A tile raised a step above the floor (a dais, a ship's deck), with
// whatever's on it set on top; kept clear of everything else's placing.
function raise(ctx, H, x, z, id) {
  const { b } = ctx;
  b.set(x, H.FY, z, id);
  b.set(x, H.FY + 1, z, B.air);
  (ctx.lifted ||= new Set()).add(key(ctx, x, z));
  ctx.out.maxY = H.FY + 1;
}
// A tile sunk a step below it (a pit, a ship's hold).
function sink(ctx, H, x, z, floor) {
  const { b } = ctx;
  b.set(x, H.FY - 1, z, B.air);
  b.set(x, H.FY - 2, z, floor);
  (ctx.sunk ||= new Set()).add(key(ctx, x, z));
  ctx.reserved.add(key(ctx, x, z));
}
// (Round 114) A stair's turn, by which way its high side lies: (0, 1)
// toward +z, (-1, 0) toward -x, (0, -1) toward -z, (1, 0) toward +x.
export const stepRot = (dx, dz) => (dz > 0 ? 0 : dx < 0 ? 1 : dz < 0 ? 2 : 3);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Can this tile be raised a step and still be got up onto from every side
// it's open to (room over it, and over whoever steps up from beside it:
// never hard by a doorway's low lintel, nor a pit's edge)?
function liftable(ctx, H, r, x, z) {
  const { b, plan } = ctx;
  if (!free(ctx, H, r, x, z) || BLOCKS[b.get(x, H.FY + 2, z)].solid || BLOCKS[b.get(x, H.FY + 3, z)].solid) return false;
  for (const [dx, dz] of N4) {
    const nx = x + dx;
    const nz = z + dz;
    if (!plan.at(nx, nz)) continue;
    if (!H.own(plan, r, nx, nz) || ctx.sunk?.has(key(ctx, nx, nz)) || BLOCKS[b.get(nx, H.FY + 2, nz)].solid) return false;
  }
  return true;
}
// (Round 114) A terrace: the back of the room raised a step, `deep` rows
// of it, and steps up onto it from the floor in front (its middle, and one
// end); what's set out up there stands on it. Null if the room won't take
// one.
function terrace(ctx, H, r, M, deep = 2) {
  const { b, rng } = ctx;
  const S = backOf(ctx, H, r);
  if ((S.along ? r.z1 - r.z0 : r.x1 - r.x0) < deep + 4) return null;
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const tiles = [];
  for (let k = 0; k < deep; k++) {
    for (let a = lo; a <= hi; a++) {
      const t = at2(S, a, S.back + S.out * k);
      if (liftable(ctx, H, r, t.x, t.z)) tiles.push({ ...t, a, k });
    }
  }
  if (tiles.length < Math.max(4, (hi - lo + 1) * deep * 0.5)) return null;
  for (const t of tiles) raise(ctx, H, t.x, t.z, M.flags);
  // The steps: high side toward the back wall.
  const rot = S.along ? stepRot(0, -S.out) : stepRot(-S.out, 0);
  const steps = [];
  const mid = Math.round((lo + hi) / 2);
  // (Its middle and one end first; failing those, wherever along its front
  // there's room.)
  const rest = [];
  for (let a = lo; a <= hi; a++) rest.push(a);
  rest.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
  for (const a of [mid, rng.chance(0.5) ? lo + 1 : hi - 1, ...rest]) {
    if (steps.length >= 2) break;
    const t = at2(S, a, S.back + S.out * deep);
    const up = at2(S, a, S.back + S.out * (deep - 1));
    if (!ctx.lifted?.has(key(ctx, up.x, up.z)) || !free(ctx, H, r, t.x, t.z) || steps.some((q) => Math.abs(q.a - a) < 2)) continue;
    if (BLOCKS[b.get(t.x, H.FY + 2, t.z)].solid) continue;
    b.set(t.x, H.FY, t.z, M.steps, rot);
    ctx.lifted.add(key(ctx, t.x, t.z));
    steps.push({ ...t, a });
  }
  // (No room for a step anywhere in front of it: no gallery, then.)
  if (!steps.length) {
    for (const t of tiles) {
      b.set(t.x, H.FY, t.z, B.air);
      ctx.lifted.delete(key(ctx, t.x, t.z));
    }
    return null;
  }
  (ctx.out.terraces ||= []).push({ room: r.id, tiles: tiles.length, steps: steps.map((q) => ({ x: b.x0 + q.x, z: q.z })) });
  return { S, tiles, steps };
}
// (Round 114) A sunken floor: the middle of the room let down a step
// (`inset` paces in from its walls), its edge kerbed with flags, steps
// down into it on the side nearest the way in and on the far side. Null
// if the room won't take one.
function sunken(ctx, H, r, M, inset = 2, floor = M.floor) {
  const { b, plan } = ctx;
  const tiles = [];
  for (let z = r.z0 + inset; z <= r.z1 - inset; z++) {
    for (let x = r.x0 + inset; x <= r.x1 - inset; x++) {
      if (!free(ctx, H, r, x, z)) continue;
      // (Never hard by a raised tile: two steps is too far to climb.)
      if (N4.some(([dx, dz]) => ctx.lifted?.has(key(ctx, x + dx, z + dz)) || ctx.ledge?.has(key(ctx, x + dx, z + dz)))) continue;
      tiles.push({ x, z });
    }
  }
  if (tiles.length < 6) return null;
  for (const t of tiles) sink(ctx, H, t.x, t.z, floor);
  // Its kerb: the floor round its edge, flags.
  const rim = [];
  for (const t of tiles) {
    for (const [dx, dz] of N4) {
      const nx = t.x + dx;
      const nz = t.z + dz;
      if (!plan.at(nx, nz) || ctx.sunk.has(key(ctx, nx, nz))) continue;
      if (H.own(plan, r, nx, nz) && BLOCKS[b.get(nx, H.FY - 1, nz)].solid && !ctx.lifted?.has(key(ctx, nx, nz))) b.set(nx, H.FY - 1, nz, M.flags);
      // (A place for steps down: the floor beside it open to stand on, the
      // pit behind it.)
      if (H.own(plan, r, nx, nz) && b.get(nx, H.FY, nz) === B.air && !ctx.lifted?.has(key(ctx, nx, nz)) && ctx.sunk.has(key(ctx, t.x - dx, t.z - dz))) rim.push({ x: t.x, z: t.z, ox: dx, oz: dz });
    }
  }
  const door = mainDoor(ctx, H, r) || { x: r.cx, z: r.cz };
  const by = (q) => Math.hypot(q.x - door.x, q.z - door.z);
  rim.sort((a, c) => by(a) - by(c));
  const steps = [];
  for (const q of [rim[0], rim[rim.length - 1]]) {
    if (!q || steps.some((s) => Math.abs(s.x - q.x) + Math.abs(s.z - q.z) < 3)) continue;
    b.set(q.x, H.FY - 1, q.z, M.steps, stepRot(q.ox, q.oz));
    steps.push(q);
  }
  (ctx.out.sunken ||= []).push({ room: r.id, tiles: tiles.length, steps: steps.map((q) => ({ x: b.x0 + q.x, z: q.z })) });
  return { tiles, steps };
}
// Someone set out exactly there (`o`: dormant, its group, its role).
// (In another land's barrow, its own in their place, and its own look on
// the rest: see render/pixart.VARIANTS.)
const LOOK = { kharos: 1, myrrow: 2, hollowmark: 2, velmarch: 3, saltmere: 3 };
function put(ctx, species, x, z, r, o = {}) {
  const { out, b } = ctx;
  if (out.spawns.some((s) => s.x === b.x0 + x && s.z === z)) return null;
  const sw = ctx.T.swap && ctx.T.swap[species];
  const v = LOOK[ctx.rec.isle] || 0;
  const s = { id: out.spawns.length, species: sw ? ctx.rng.pick(sw) : species, x: b.x0 + x, z, room: r.id, ...(v ? { variant: v } : {}), ...o };
  out.spawns.push(s);
  return s;
}
const free = (ctx, H, r, x, z) => H.freeIn(ctx, r, x, z) && !ctx.lifted?.has(key(ctx, x, z)) && !ctx.sunk?.has(key(ctx, x, z));
// A free tile of the room near (x, z), nearest first.
function near(ctx, H, r, x, z, rad = 3, ok = null) {
  for (let d = 0; d <= rad; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        if (free(ctx, H, r, x + dx, z + dz) && (!ok || ok(x + dx, z + dz))) return { x: x + dx, z: z + dz };
      }
    }
  }
  return null;
}
const lvlOf = (ctx) => (ctx.rec.level || 1) + ctx.n * 0.5;
// The room's main way in (the doorway nearest the entry).
function mainDoor(ctx, H, r) {
  const ds = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
  if (!ds.length) return null;
  const e = ctx.out.entry ? { x: ctx.out.entry.x - ctx.b.x0, z: ctx.out.entry.z } : { x: r.cx, z: r.cz };
  return ds.sort((a, c) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(c.x - e.x, c.z - e.z))[0];
}
// A group's name (for waking together: see game/deeps.js).
const groupOf = (ctx, r, k) => `${ctx.n}:${r.id}:${k}`;
// Lore set down on a slab (or a bowl, a ship, a page) at (x, z).
function lore(ctx, x, z, entry) {
  (ctx.out.lore ||= []).push({ x: ctx.b.x0 + x, z, ...entry });
}

// --------------------------------------------------------------- the rooms
function dress(ctx, r, H) {
  const { rng, b, T, rec, n } = ctx;
  const M = matsOf(T);
  const FY = H.FY;
  const L = ctx.lore || (ctx.lore = barrowLore(rec, n));
  const lvl = lvlOf(ctx);
  switch (r.kit) {
    // The feast of the dead: two long boards down the hall, benches either
    // side, the hearth between them; shields and spears along the walls;
    // the dead in their seats (dormant: they rise when something of theirs
    // is taken, or when you come right up to them, or a fight's near).
    case 'feast': {
      const along = r.x1 - r.x0 >= r.z1 - r.z0;
      const g = groupOf(ctx, r, 'feast');
      const rows = along ? [r.cz - 2, r.cz + 2] : [r.cx - 2, r.cx + 2];
      const lo = (along ? r.x0 : r.z0) + 2;
      const hi = (along ? r.x1 : r.z1) - 2;
      const seat = [];
      for (const row of rows) {
        for (let a = lo; a <= hi; a++) {
          // (A gap in the middle of each board for the hearth's way.)
          const mid = along ? r.cx : r.cz;
          if (Math.abs(a - mid) <= 1) continue;
          const x = along ? a : row;
          const z = along ? row : a;
          if (!free(ctx, H, r, x, z)) continue;
          b.set(x, FY, z, B.feast_board);
          // A bench on the near side of the board, and someone on it.
          const bx = along ? x : x + (row < (along ? r.cz : r.cx) ? -1 : 1);
          const bz = along ? z + (row < r.cz ? -1 : 1) : z;
          // (A bench is sat on: where one of them sits, if any do.)
          if (free(ctx, H, r, bx, bz) && rng.chance(0.7)) {
            b.set(bx, FY, bz, B.mead_bench);
            seat.push({ x: bx, z: bz });
          }
        }
      }
      b.set(r.cx, FY, r.cz, B.cold_hearth);
      // The high seat's board: the chief's share of the grave goods.
      const head = along ? { x: r.x1 - 1, z: r.cz } : { x: r.cx, z: r.z1 - 1 };
      const at = near(ctx, H, r, head.x, head.z, 2);
      if (at) {
        b.set(at.x, FY, at.z, B.grave_goods);
        b.container(at.x, FY, at.z, H.fill(rng, 9, [...H.lootFor(rec.type, H.tierOf(ctx), rng, 1.4, T), ['old_coin', rng.int(3, 8)]], H.foundIn(ctx)));
        (ctx.out.wakes ||= []).push({ x: b.x0 + at.x, z: at.z, group: g });
      }
      // Along the walls: their shields and spears laid by.
      for (let i = 0; i < 2 + rng.int(0, 2); i++) H.placeIn(ctx, r, rng.chance(0.5) ? B.shield_rack : B.grave_spears, 0, true);
      // The dead at the feast.
      const nDead = Math.min(seat.length, 2 + Math.floor(lvl / 1.5) + rng.int(0, 1));
      rng.shuffle(seat);
      for (let i = 0; i < nDead; i++) put(ctx, i === 0 && lvl >= 2 ? 'wight' : 'bone_thrall', seat[i].x, seat[i].z, r, { dormant: 1, group: g, rest: true });
      if (rng.chance(0.5)) put(ctx, 'hearthguard', head.x, head.z + (along ? 1 : 0), r, { dormant: 2, group: g, rest: true });
      lore(ctx, r.cx, r.cz, { block: 'hearth', ...L.feast() });
      break;
    }
    // The ship: a hull of dark planks the length of the hall, its hold
    // sunk a step, the dragon at the prow; the chief's companion on a bier
    // amidships, goods and a lantern either end.
    case 'ship': {
      const along = r.x1 - r.x0 >= r.z1 - r.z0;
      const len = (along ? r.x1 - r.x0 : r.z1 - r.z0) - 3;
      const a0 = (along ? r.x0 : r.z0) + 2;
      const mid = along ? r.cz : r.cx;
      const hull = [];
      for (let i = 0; i < len; i++) {
        const a = a0 + i;
        // (Pointed at either end: narrower near the stem and the stern.)
        const half = i === 0 || i === len - 1 ? 0 : i === 1 || i === len - 2 ? 1 : 2;
        for (let w = -half - 1; w <= half + 1; w++) {
          const x = along ? a : mid + w;
          const z = along ? mid + w : a;
          if (!H.own(ctx.plan, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
          if (Math.abs(w) === half + 1) {
            // (Planked down to the hold's floor: the sides of the hold are
            // the hull, not the earth under it.)
            b.set(x, FY, z, M.hull);
            b.set(x, FY - 1, z, M.hull);
            hull.push({ x, z });
          } else sink(ctx, H, x, z, M.hull);
        }
      }
      // The dragon at the stem; the sternpost at the other end (the ends of
      // the hold planked too).
      const sx = along ? a0 - 1 : mid;
      const sz = along ? mid : a0 - 1;
      if (H.own(ctx.plan, r, sx, sz)) {
        b.set(sx, FY, sz, B.ship_prow);
        b.set(sx, FY - 1, sz, M.hull);
      }
      const tx = along ? a0 + len : mid;
      const tz = along ? mid : a0 + len;
      if (H.own(ctx.plan, r, tx, tz) && !H.doorBlocked(ctx.plan, r, tx, tz)) {
        b.set(tx, FY, tz, M.hull);
        b.set(tx, FY - 1, tz, M.hull);
        hull.push({ x: tx, z: tz });
      }
      // (Wherever the hold's edge isn't a side (a doorway's gap, the room's
      // own edge), the earth there that faces into it planked too.)
      for (const k of ctx.sunk || []) {
        const x = k % ctx.W;
        const z = (k / ctx.W) | 0;
        if (!H.own(ctx.plan, r, x, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const nz = z + dz;
          if (ctx.sunk.has(key(ctx, nx, nz)) || !ctx.plan.at(nx, nz)) continue;
          if (BLOCKS[b.get(nx, FY - 1, nz)].solid) b.set(nx, FY - 1, nz, M.hull);
        }
      }
      // A ladder up the inside of the hull, aft, so whoever goes down into
      // the hold can climb out again.
      {
        const i = Math.max(1, len - 3);
        const half = i === 0 || i === len - 1 ? 0 : i === 1 || i === len - 2 ? 1 : 2;
        const lx = along ? a0 + i : mid + half;
        const lz = along ? mid + half : a0 + i;
        if (ctx.sunk?.has(key(ctx, lx, lz))) {
          // (Facing the side it's against.)
          const d = along ? 0 : 3;
          for (const y of [FY - 1, FY]) b.set(lx, y, lz, B.ladder, d);
          ctx.shipLadder = { x: lx, z: lz };
        }
      }
      // Amidships, the bier; goods fore and aft.
      const bx = along ? a0 + Math.floor(len / 2) : mid;
      const bz = along ? mid : a0 + Math.floor(len / 2);
      b.set(bx, FY - 1, bz, M.hull);
      b.set(bx, FY - 2, bz, M.hull);
      b.set(bx, FY - 1, bz, B.bier, along ? 0 : 1);
      const goods = [];
      for (const k of [2, len - 3]) {
        const gx = along ? a0 + k : mid;
        const gz = along ? mid : a0 + k;
        if (ctx.sunk?.has(key(ctx, gx, gz))) {
          b.set(gx, FY - 1, gz, B.grave_goods);
          b.container(gx, FY - 1, gz, H.fill(rng, 9, H.lootFor(rec.type, H.tierOf(ctx), rng, 1.6, T), H.foundIn(ctx)));
          goods.push({ x: b.x0 + gx, z: gz, y: FY - 1 });
        }
      }
      // Lanterns at the four corners of the hall.
      for (const [x, z] of [[r.x0 + 1, r.z0 + 1], [r.x1 - 1, r.z0 + 1], [r.x0 + 1, r.z1 - 1], [r.x1 - 1, r.z1 - 1]]) if (free(ctx, H, r, x, z)) b.set(x, FY, z, M.lamp);
      const g = groupOf(ctx, r, 'ship');
      for (const q of goods) (ctx.out.wakes ||= []).push({ ...q, group: g });
      // Its crew, waiting to row.
      for (let i = 0; i < 2 + Math.floor(lvl / 2); i++) {
        const at = near(ctx, H, r, along ? a0 + rng.int(0, len - 1) : mid + (rng.chance(0.5) ? 4 : -4), along ? mid + (rng.chance(0.5) ? 4 : -4) : a0 + rng.int(0, len - 1), 3);
        if (at) put(ctx, i === 0 ? 'hearthguard' : 'bone_thrall', at.x, at.z, r, { dormant: 2, group: g, rest: true });
      }
      lore(ctx, sx, sz, { block: 'prow', ...L.ship() });
      break;
    }
    // The kerb ring: spiral stones round a cairn, each carved with a sigil
    // that turns; behind one stone in the wall, the chief's treasury.
    case 'kerb_ring': {
      const rad = Math.max(2, Math.min(4, Math.floor(Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2) - 1));
      // (One at each of the four quarters round the cairn: north, east,
      // south, west.)
      const stones = [];
      for (const [k, [dx, dz]] of [[0, -1], [1, 0], [0, 1], [-1, 0]].entries()) {
        const at = near(ctx, H, r, r.cx + Math.round(dx * rad * 1.15), r.cz + dz * rad, 1);
        if (!at) continue;
        const start = rng.int(0, 3);
        b.set(at.x, FY, at.z, SIGIL_BLOCKS[start]);
        stones.push({ x: b.x0 + at.x, z: at.z, start, dir: k });
      }
      if (free(ctx, H, r, r.cx, r.cz)) b.set(r.cx, FY, r.cz, B.cairn);
      // The answer: on a name-stone somewhere else on this floor (see
      // after), and on the chief's slab.
      const want = stones.map((q) => {
        let k = rng.int(0, 3);
        if (k === q.start) k = (k + 1 + rng.int(0, 2)) % 4;
        return k;
      });
      const vault = treasury(ctx, H, r, M);
      if (stones.length >= 3 && vault) {
        (ctx.out.spirals ||= []).push({ stones, want, door: vault.door, room: r.id });
        ctx.spiralClue = stones.map((q, i) => ({ dir: q.dir, k: want[i] }));
      }
      for (let i = 0; i < 2; i++) H.placeIn(ctx, r, M.lamp, 0, true);
      if (rng.chance(0.6)) put(ctx, 'old_hound', r.cx + 1, r.cz + 1, r, { peaceful: true });
      break;
    }
    // A vigil: oak along the walls, a dais of flags at the back with a
    // bier on it, someone laid on the bier (who isn't as still as they
    // look), and two of the hearth-guard keeping watch.
    case 'vigil': {
      const door = mainDoor(ctx, H, r);
      // (The dais at the far end from the way in.)
      const farZ = door && door.z <= r.cz ? r.z1 - 1 : r.z0 + 1;
      const step = farZ > r.cz ? -1 : 1;
      const dais = [];
      for (let x = r.cx - 1; x <= r.cx + 1; x++) for (const z of [farZ, farZ + step]) if (free(ctx, H, r, x, z)) dais.push({ x, z });
      if (dais.length >= 4) {
        for (const t of dais) raise(ctx, H, t.x, t.z, M.flags);
        // The bier, on the dais.
        b.set(r.cx, FY + 1, farZ, B.bier, 0);
        // A step up onto it, in front.
        const sx = r.cx;
        const sz = farZ + step * 2;
        if (M.steps && free(ctx, H, r, sx, sz)) {
          b.set(sx, FY, sz, M.steps, stepRot(0, -step));
          (ctx.lifted ||= new Set()).add(key(ctx, sx, sz));
        }
        const g = groupOf(ctx, r, 'vigil');
        // On the bier: one of the chief's own, waiting.
        if (ctx.lifted?.has(key(ctx, r.cx, farZ + step))) put(ctx, lvl >= 2.5 ? 'wight' : 'bone_thrall', r.cx, farZ + step, r, { dormant: 2, group: g, rest: true, effigy: true });
        for (const dx of [-2, 2]) {
          const at = near(ctx, H, r, r.cx + dx, farZ + step, 1);
          if (at) put(ctx, 'hearthguard', at.x, at.z, r, { dormant: 3, group: g });
        }
        (ctx.out.wakes ||= []).push({ x: b.x0 + r.cx, z: farZ, y: FY + 1, group: g, touch: true });
      }
      // Oak along the walls behind it.
      for (const w of H.wallsOf(ctx.plan, r)) if (Math.abs(w.z - farZ) <= 1 && rng.chance(0.8)) for (const y of [FY, FY + 1]) b.set(w.x, y, w.z, M.oak);
      const slab = H.placeIn(ctx, r, B.rune_slab, 0, true);
      if (slab) lore(ctx, slab.x, slab.z, L.hearthguard());
      if (rng.chance(0.5)) H.chestIn(ctx, r, 1.1);
      break;
    }
    // The offering pit: sunk in the middle of the room, bones and coin in
    // it, bowls round its lip; take from a bowl, and the dead come.
    case 'offering_pit': {
      const rad = Math.max(1.5, Math.min(2.5, (Math.min(r.x1 - r.x0, r.z1 - r.z0) - 4) / 2));
      const pit = [];
      for (let z = Math.floor(r.cz - rad); z <= Math.ceil(r.cz + rad); z++) {
        for (let x = Math.floor(r.cx - rad); x <= Math.ceil(r.cx + rad); x++) {
          if (Math.hypot(x - r.cx, (z - r.cz) * 1.1) > rad || !free(ctx, H, r, x, z)) continue;
          sink(ctx, H, x, z, M.floor);
          pit.push({ x, z });
        }
      }
      for (const t of pit) if (rng.chance(0.3)) b.set(t.x, FY - 1, t.z, B.bones);
      const g = groupOf(ctx, r, 'pit');
      // Bowls round the lip.
      let bowls = 0;
      for (let k = 0; k < 8 && bowls < 3; k++) {
        const a = (k / 8) * Math.PI * 2 + rng.float(0, 0.4);
        const x = Math.round(r.cx + Math.cos(a) * (rad + 1.2));
        const z = Math.round(r.cz + Math.sin(a) * (rad + 1));
        if (!free(ctx, H, r, x, z)) continue;
        b.set(x, FY, z, B.offering_bowl);
        (ctx.out.offerings ||= []).push({ x: b.x0 + x, z, group: g, coins: rng.int(2, 5 + Math.floor(lvl)) });
        bowls++;
      }
      // Those who come for what's taken: up out of the pit.
      for (let i = 0; i < 2 + Math.floor(lvl / 2); i++) {
        const t = pit[rng.int(0, pit.length - 1)];
        if (t) put(ctx, 'bone_thrall', t.x, t.z, r, { dormant: 0.5, group: g, buried: true });
      }
      const tab = H.placeIn(ctx, r, B.rune_slab, 0, true);
      if (tab) lore(ctx, tab.x, tab.z, L.offering());
      break;
    }
    // The charnel: bones heaped all about, and a corpse-light over them.
    case 'charnel': {
      // (Round 114) The bone-pit: the middle of it let down a step, steps
      // down into it, the bones deepest there.
      if (rng.chance(0.75)) {
        const pit = sunken(ctx, H, r, M, 2);
        if (pit) for (const t of pit.tiles) if (rng.chance(0.4) && !pit.steps.some((q) => q.x === t.x && q.z === t.z)) b.set(t.x, FY - 1, t.z, B.bones);
      }
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.2) && free(ctx, H, r, x, z)) b.set(x, FY, z, B.bones);
      for (let i = 0; i < 2; i++) H.placeIn(ctx, r, B.skull_pile, 0, true);
      put(ctx, 'corpse_light', r.cx, r.cz, r, {});
      if (lvl >= 2) put(ctx, 'wight', r.cx + 2, r.cz, r, { dormant: 3 });
      if (rng.chance(0.4)) H.chestIn(ctx, r, 0.8);
      break;
    }
    // The robbers' tunnel: a ragged hole, their bones and gear, niches
    // where they lie in wait still, and the last of a robber's notes.
    case 'robbers': {
      const g = groupOf(ctx, r, 'robbers');
      const walls = rng.shuffle(H.wallsOf(ctx.plan, r).filter((q) => !ctx.plan.forbid[q.z * ctx.W + q.x]));
      let niches = 0;
      for (const { x, z } of walls) {
        if (niches >= 2 + Math.floor(lvl / 2)) break;
        if (ctx.plan.at(x, z)) continue;
        ctx.plan.carve(x, z, r.id);
        b.set(x, FY, z, B.air);
        b.set(x, FY + 1, z, B.air);
        b.set(x, FY - 1, z, T.floor);
        put(ctx, 'ghoul', x, z, r, { ambush: true, group: g });
        niches++;
      }
      for (let i = 0; i < 3; i++) H.placeIn(ctx, r, B.bones, 0);
      for (let i = 0; i < 2; i++) H.spawnIn(ctx, r, 'tomb_rat', 1);
      const page = H.placeIn(ctx, r, B.rune_slab, 0, true);
      if (page) lore(ctx, page.x, page.z, L.robber());
      if (rng.chance(0.7)) H.chestIn(ctx, r, 0.9);
      break;
    }
    default:
      return false;
  }
  return true;
}

// A small treasury dug behind one wall of the room, sealed with a stone
// (rolled back by the spiral stones' puzzle: see game/deeps.js).
function treasury(ctx, H, r, M) {
  const { plan, b, rng } = ctx;
  const FY = H.FY;
  const W = ctx.W;
  for (const w of rng.shuffle(H.wallsOf(plan, r))) {
    // Straight back into the rock: the wall tile, then two more beyond it.
    const dx = H.own(plan, r, w.x - 1, w.z) ? 1 : H.own(plan, r, w.x + 1, w.z) ? -1 : 0;
    const dz = H.own(plan, r, w.x, w.z - 1) ? 1 : H.own(plan, r, w.x, w.z + 1) ? -1 : 0;
    if (!!dx === !!dz) continue;
    const cells = [1, 2, 3].map((k) => ({ x: w.x + dx * k, z: w.z + dz * k }));
    const side = (c) => [[dz, dx], [-dz, -dx]].map(([ox, oz]) => ({ x: c.x + ox, z: c.z + oz }));
    const all = [w, ...cells, ...side(cells[1]), ...side(cells[2])];
    if (all.some((c) => c.x < 2 || c.z < 2 || c.x >= W - 2 || c.z >= ctx.D - 2 || plan.at(c.x, c.z) || plan.forbid[c.z * W + c.x])) continue;
    // (Nothing open near it either.)
    if (all.some((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => plan.at(c.x + ox, c.z + oz) && plan.room[(c.z + oz) * W + c.x + ox] !== r.id))) continue;
    for (const c of [...cells, ...side(cells[2])]) {
      plan.carve(c.x, c.z);
      plan.forbid[c.z * W + c.x] = 1;
      b.set(c.x, FY, c.z, B.air);
      b.set(c.x, FY + 1, c.z, B.air);
      b.set(c.x, FY - 1, c.z, M.flags);
    }
    // The stone across the way in.
    b.set(w.x, FY, w.z, B.spiral_seal);
    b.set(w.x, FY + 1, w.z, M.ortho);
    const back = cells[2];
    b.set(back.x, FY, back.z, B.grave_goods);
    b.container(back.x, FY, back.z, H.fill(rng, 9, [...H.lootFor(ctx.rec.type, H.tierOf(ctx) + 1, rng, 2.2, ctx.T), ['old_coin', rng.int(6, 14)], ['gold_torc', 1]], H.foundIn(ctx)));
    return { door: { x: b.x0 + w.x, z: w.z } };
  }
  return null;
}

// The old rooms, more of the barrow's own: the guard post a wall of
// shields; the master's hall its dais and kerb; the way in its forecourt.
function extra(ctx, r, H) {
  const { rng, b, T, rec, n } = ctx;
  const M = matsOf(T);
  const FY = H.FY;
  const L = ctx.lore || (ctx.lore = barrowLore(rec, n));
  const lvl = lvlOf(ctx);
  if (r.kit === 'entry' && n === 0) {
    // The forecourt: two carved stones flanking the way in, the slab that
    // says whose mound this is.
    for (const dx of [-2, 2]) {
      const at = near(ctx, H, r, r.cx + dx, r.cz - 1, 1);
      if (at) b.set(at.x, FY, at.z, SIGIL_BLOCKS[rng.int(0, 3)]);
    }
    const slab = H.placeIn(ctx, r, B.rune_slab, 0, true);
    if (slab) lore(ctx, slab.x, slab.z, L.door());
  } else if (r.kit === 'guard') {
    // A shield-wall: two hearth-guard across the way in, a spear (or two)
    // behind them; bigger as you go down.
    const door = mainDoor(ctx, H, r);
    if (door) {
      const fx = door.x - door.ox * 2;
      const fz = door.z - door.oz * 2;
      const side = { x: door.oz ? 1 : 0, z: door.ox ? 1 : 0 };
      for (const k of [-1, 1]) {
        const at = near(ctx, H, r, fx + side.x * k, fz + side.z * k, 1);
        if (at) put(ctx, 'hearthguard', at.x, at.z, r, { role: 'wall' });
      }
      for (let i = 0; i < 1 + Math.floor(lvl / 2); i++) {
        const at = near(ctx, H, r, fx - door.ox * 2 + side.x * (i - 1), fz - door.oz * 2 + side.z * (i - 1), 2);
        if (at) put(ctx, 'wight', at.x, at.z, r, { role: 'spear' });
      }
    }
    H.placeIn(ctx, r, B.shield_rack, 0, true);
    // (Round 114) Its back raised a step, a gallery for the spears.
    if (rng.chance(0.75)) terrace(ctx, H, r, M, 2);
  } else if (r.kit === 'pillared') {
    // (Round 114) The nave between the pillars let down a step, and in a
    // long enough hall a gallery at its back above it: down, and up again.
    if ((r.x1 - r.x0) * (r.z1 - r.z0) >= 80 && rng.chance(0.5)) terrace(ctx, H, r, M, 2);
    sunken(ctx, H, r, M, 2);
  } else if (r.kit === 'shrine' || r.kit === 'treasure') {
    // (Round 114) What's kept here, up a step at the back.
    if (rng.chance(r.kit === 'shrine' ? 0.6 : 0.5)) terrace(ctx, H, r, M, 2);
    if (r.kit === 'shrine' && rng.chance(0.6)) H.placeIn(ctx, r, M.lamp, 0, true);
  } else if (r.kit === 'boss') {
    // The chief's own hall: a dais at the back with their bier on it,
    // broken open (they rose from it), a kerb of carved stones round the
    // hall, the saga of them cut in the slab at the dais's foot.
    const backZ = r.z0 + 1;
    for (let x = r.cx - 2; x <= r.cx + 2; x++) for (const z of [backZ, backZ + 1]) if (free(ctx, H, r, x, z)) raise(ctx, H, x, z, M.flags);
    if (ctx.lifted?.has(key(ctx, r.cx, backZ))) b.set(r.cx, FY + 1, backZ, B.bier, 0);
    if (M.steps) for (const dx of [-1, 1]) if (free(ctx, H, r, r.cx + dx, backZ + 2)) {
      b.set(r.cx + dx, FY, backZ + 2, M.steps, stepRot(0, -1));
      (ctx.lifted ||= new Set()).add(key(ctx, r.cx + dx, backZ + 2));
    }
    const slab = near(ctx, H, r, r.cx + 3, backZ + 2, 2);
    if (slab) {
      b.set(slab.x, FY, slab.z, B.rune_slab);
      lore(ctx, slab.x, slab.z, L.chief(ctx.spiralClue || null));
    }
    for (const [x, z] of [[r.x0 + 2, r.cz], [r.x1 - 2, r.cz]]) {
      const at = near(ctx, H, r, x, z, 1);
      if (at) b.set(at.x, FY, at.z, SIGIL_BLOCKS[rng.int(0, 3)]);
    }
  } else if (r.kit === 'exit' && rng.chance(0.5)) {
    const at = H.placeIn(ctx, r, B.rune_slab, 0, true);
    if (at) lore(ctx, at.x, at.z, L.hearthguard());
  }
}

// --------------------------------------------------------------- dressing
// What's set about each room: a few things to it by its size, each kind
// kept apart from its own (no two lanterns side by side, no wall of
// urns), solid ones against the walls, never in a doorway's way; and
// cobwebs in the corners.
const DECOR = [['urn', 4], ['rubble', 2], ['candles', 1], ['skull_pile', 1], ['grave_spears', 1], ['cairn', 1]];
function decorate(ctx, r, H) {
  const { rng, b, plan, T } = ctx;
  const FY = H.FY;
  if (r.kit === 'vault' || r.kit === 'hidden' || r.kit === 'boss' || r.kit === 'ship' || r.kit === 'feast') return;
  const M = matsOf(T);
  const list = [...(T.decor || DECOR).filter(([k]) => B[k] !== undefined && k !== 'cobweb'), ...(M.thessa ? [['grave_spears', 1]] : [])];
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const n = Math.round((area / 20) * rng.float(0.6, 1.2));
  const placed = [];
  for (let i = 0; i < n; i++) {
    const k = rng.weighted(list);
    // (Never right beside another of its own kind.)
    for (let t = 0; t < 6; t++) {
      const at = H.placeIn(ctx, r, B[k], rng.int(0, 3), true);
      if (!at) break;
      if (placed.some((q) => q.k === k && Math.hypot(q.x - at.x, q.z - at.z) < 3)) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      placed.push({ k, x: at.x, z: at.z });
      break;
    }
  }
  // A corpse-lantern in the bigger rooms (their only light), and roots
  // through the roof here and there.
  if (area > 40 && rng.chance(0.55)) H.placeIn(ctx, r, M.lamp, 0, true);
  if (M.thessa) for (let i = 0; i < Math.floor(area / 30); i++) H.placeIn(ctx, r, B.roots, 0, true);
  // Cobwebs strung across the corners.
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!free(ctx, H, r, x, z) || ctx.reserved?.has(z * plan.W + x)) continue;
      const wx = !plan.at(x - 1, z) ? -1 : !plan.at(x + 1, z) ? 1 : 0;
      const wz = !plan.at(x, z - 1) ? -1 : !plan.at(x, z + 1) ? 1 : 0;
      if (wx && wz && rng.chance(0.35)) b.set(x, FY, z, B.cobweb, wx < 0 ? 0 : 1);
    }
  }
}

// --------------------------------------------------------------- the floor
// The processional way: from the way in to the way on (or the chief's
// hall), its passages floored with worn flags and lined with carved
// stones; snare-runes cut in it, here and there, deeper down.
function after(ctx, H) {
  const { plan, b, rng, T, out, n } = ctx;
  const FY = H.FY;
  const M = matsOf(T);
  const W = ctx.W;
  const R = plan.rooms;
  const from = R.find((r) => r.kit === 'entry');
  const to = R.find((r) => r.kit === 'boss') || R.find((r) => r.kit === 'exit');
  if (from && to) {
    // (Through the open floor, the fewest passage tiles first.)
    const start = from.cz * W + from.cx;
    const goal = to.cz * W + to.cx;
    const prev = new Int32Array(W * ctx.D).fill(-2);
    prev[start] = -1;
    const q = [start];
    while (q.length) {
      const i = q.shift();
      if (i === goal) break;
      const x = i % W;
      const z = (i / W) | 0;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (z + oz) * W + x + ox;
        if (prev[j] !== -2 || !plan.at(x + ox, z + oz)) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    const way = [];
    for (let i = goal; i >= 0 && prev[i] !== -2; i = prev[i]) way.push(i);
    const onWay = new Set(way);
    let k = 0;
    for (const i of way) {
      if (!plan.corr[i]) continue;
      const x = i % W;
      const z = (i / W) | 0;
      // Its flags (and those of the passage beside it, it's two wide).
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const j = (z + oz) * W + x + ox;
        if (plan.corr[j] && b.get(x + ox, FY, z + oz) === B.air) b.set(x + ox, FY - 1, z + oz, M.flags);
      }
      // A carved stone in the wall beside it every few paces.
      if (k++ % 4 === 0) {
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (plan.at(x + ox, z + oz)) continue;
          b.set(x + ox, FY, z + oz, M.ortho);
          b.set(x + ox, FY + 1, z + oz, M.ortho);
        }
      }
    }
    // Snare-runes on the way, deeper down.
    if (n >= 1) {
      const cand = way.filter((i) => plan.corr[i] && b.get(i % W, FY, (i / W) | 0) === B.air);
      for (let s = 0; s < Math.min(3, 1 + n) && cand.length; s++) {
        const i = cand.splice(rng.int(0, cand.length - 1), 1)[0];
        b.set(i % W, FY, (i / W) | 0, B.snare_rune, rng.int(0, 3));
        (out.snares ||= []).push({ x: b.x0 + (i % W), z: (i / W) | 0 });
      }
    }
    out.way = way.length;
    void onWay;
  }
  // The answer to the kerb ring's stones: the chief's name in sigils, cut
  // on a stone in some other room of the floor (the old hound knows where).
  for (const sp of out.spirals || []) {
    const L = ctx.lore || (ctx.lore = barrowLore(ctx.rec, n));
    const rooms = rng.shuffle(R.filter((r) => r.id !== sp.room && !r.sealed && !['entry', 'vault', 'hidden', 'boss'].includes(r.kit)));
    for (const r of rooms) {
      const at = H.placeIn(ctx, r, B.rune_slab, 0, true);
      if (!at) continue;
      lore(ctx, at.x, at.z, L.clue(sp.stones.map((q, i) => ({ dir: q.dir, k: sp.want[i] }))));
      sp.clue = { x: b.x0 + at.x, z: at.z };
      out.hound = { x: b.x0 + at.x, z: at.z };
      break;
    }
  }
  // (Whatever's raised can be stood on: a floor's height bound lifted
  // for it.)
  if (ctx.lifted && ctx.lifted.size) out.maxY = FY + 1;
  out.lifted = ctx.lifted ? [...ctx.lifted].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 })) : [];
}

export const BARROW_ARCH = {
  own: BARROW_KITS,
  kits,
  // (A room the layout had to make something else of.)
  spare: (rng, n) => rng.weighted(n === 0 ? FIRST : DEEP).replace('kerb_ring', 'charnel').replace('feast', 'guard'),
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
};
