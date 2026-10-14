// (Round 112) The Sundered Reach, made over: the mesa of the Sky-Watchers
// in the red country of Ostria, where they read the stars from the top
// and lived in the rock under it, until one night the sky split over it
// and something climbed down on long legs and cut its way in. The feeling
// is vertigo and wrongness, and a lost people: warm red stone in its
// strata, adobe and painted pots and woven blankets, against the cold
// black glass of the void growing through it with the stars inside, and
// chasms of nothing. Lofts up ladders in the dwellings, the kiva sunk in
// the observatory floor, the chasms; and it goes down through what the
// void has done to it, a floor each: the Mesa (the dwellings mostly whole,
// glass only in the cracks), the Fault (the stone crazed, chasms open),
// the Between (black glass underfoot, rocks floating loose, the tear). See
// game/riftwork.js for the sky-dial (the sighting-stones, set as the sky
// stood the night it split, open the kiva), the chasms and their
// phase-bridges (step onto the abyss and you fall), and the watchers'
// echoes; game/ancient.js for the old works (the rift pairs, the
// fractures, the echoes, the shards, the shard-storms, the gravity wells,
// the flicker), kept in their rooms.
//
// A floor of it, beside the old rooms, and what its own rooms are:
//   the dwelling: the hearth, the grinding stone, the loom, the pots, a
//     rug; a loft along the back wall up a ladder, baskets and pots up
//     there; the watchers' echoes at their chores;
//   the observatory: the kiva's lid in the middle of the floor, the four
//     sighting-stones round it at the quarters, the star chart on the wall,
//     the elder's journal, sighting cairns;
//   the fault: a chasm of the abyss right across it, phase-bridges over;
//     crystals, shards; the stalkers;
//   the crystals: a cavern grown full of the void's crystals, shardbacks
//     grazing among them, a weaver;
//   the shrine: the spirit figures along the back wall, offering bowls, the
//     murals, a rug; watchers' echoes knelt; a weaver;
//   the breach: where the sky came down: the tear stood up in the middle,
//     black glass round it, rocks floating loose, a rift pair; stalkers,
//     motes.
// About the floor: its papers (see deeps/riftlore.js), and what it was.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { riftLore } from './riftlore.js';
import { key, raise, put, isUp, free, near, groupOf, lore, place, backSeen, at2, frameOf, longestRun } from './common.js';

const POOL = [['dwelling', 2], ['observatory', 1], ['fault', 1], ['crystals', 1], ['shrine', 1], ['breach', 1], ['portals', 1], ['fracture', 1], ['echo', 1], ['shards', 1], ['shardstorm', 1], ['gravity', 1], ['flicker', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['observatory', 'fault', 'crystals', 'shrine', 'breach', 'portals', 'fracture', 'echo', 'shards', 'shardstorm', 'gravity', 'flicker', 'trap', 'treasure']);
export const RIFT_OWN = new Set(['dwelling', 'observatory', 'fault', 'crystals', 'shrine', 'breach']);
// What each floor was: its floor.
export const STAGE_FLOOR = ['rf_sand', 'rf_crazed', 'rf_glass'];
const stageOf = (ctx) => B[STAGE_FLOOR[Math.min(ctx.n, 2)]];

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The dwellings on every floor; the observatory on the first and now
  // and then after; the fault deeper down; the breach on the last; the
  // crystals or the shrine.
  out.push('dwelling');
  if (n === 0 || rng.chance(0.4)) out.push('observatory');
  if (n >= 1 || rng.chance(0.35)) out.push('fault');
  out.push(rng.pick(['crystals', 'shrine']));
  if (n >= 2 || rng.chance(0.3)) out.push('breach');
  // And one of the old works of the place on every floor (see
  // game/ancient.js).
  out.push(rng.pick(['portals', 'fracture', 'echo', 'shards', 'shardstorm', 'gravity', 'flicker']));
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
  dwelling: [[13, 15], [10, 11]], observatory: [[13, 14], [12, 13]], fault: [[15, 17], [10, 12]], crystals: [[12, 14], [11, 12]],
  shrine: [[11, 13], [10, 11]], breach: [[13, 15], [12, 13]],
};
const SHAPES = { dwelling: ['rect'], observatory: ['octagon', 'round'], fault: ['rect'], crystals: ['round', 'octagon'], shrine: ['rect'], breach: ['octagon'] };

const Lof = (ctx) => ctx.rfLore || (ctx.rfLore = riftLore(ctx.rec, ctx.n));
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x8104) % list.length] : null;
};

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const abs = (ctx, t) => ({ x: ctx.b.x0 + t.x, z: t.z });
const clear = (ctx, H, r, x, z) => free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z);
function band(ctx, H, r, list, at, k, o = {}) {
  const g = groupOf(ctx, r, k);
  const out = [];
  for (const species of list) {
    const s0 = near(ctx, H, r, at.x + ctx.rng.int(-1, 1), at.z + ctx.rng.int(-1, 1), 3, (x, z) => !ctx.chasm?.has(key(ctx, x, z)));
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
function byDoor(ctx, H, r, x, z, d = 1) {
  return H.doorways(ctx.plan, r).some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) <= d);
}
// The north wall's faces, spaced: murals (with what's painted on them),
// niches of pots, the glass, the tear.
function walls(ctx, H, r, list, p) {
  const L = Lof(ctx);
  let last = -9;
  for (const w of northWall(ctx, r)) {
    if (w.x - last < 2 || !ctx.rng.chance(p)) continue;
    const k = ctx.rng.weighted(list);
    const ok = face(ctx, w, B[k], ctx.rng.int(0, 1));
    // (Now and then something painted that can still be made out; a niche
    // with the potter's mark on what's in it.)
    if (ok && k === 'rf_mural' && ctx.rng.chance(0.4)) lore(ctx, w.x, w.z, L.mural());
    if (ok && k === 'rf_niche' && ctx.rng.chance(0.25)) lore(ctx, w.x, w.z, L.mark());
    if (ok) last = w.x;
  }
}
// (Deeper down, the void through everything: patches of black glass,
// shards, crystals; on the last, rocks floating loose.)
function ruin(ctx, H, r) {
  const { b, rng } = ctx;
  if (ctx.n >= 1) {
    for (let k = 0; k < 1 + ctx.n; k++) {
      const c = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(-2, 2), 2);
      if (!c) continue;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx && dz && rng.chance(0.5)) || !H.own(ctx.plan, r, c.x + dx, c.z + dz) || isUp(ctx, c.x + dx, c.z + dz)) continue;
          const f = b.get(c.x + dx, H.FY - 1, c.z + dz);
          if (f === stageOf(ctx) || f === B.rf_sand || (ctx.n >= 2 && f === B.rf_crazed)) floorAt(ctx, c.x + dx, c.z + dz, ctx.n >= 2 ? B.rf_glass : B.rf_crazed);
        }
      }
    }
    if (rng.chance(0.5)) place(ctx, H, r, B.rf_shards, rng.int(0, 1), false);
    if (rng.chance(0.4)) place(ctx, H, r, B.rf_crystal, rng.int(0, 1), true);
  }
  if (ctx.n >= 2 && rng.chance(0.5)) place(ctx, H, r, B.rf_float, rng.int(0, 1), false);
}

// --------------------------------------------------------------- the rooms
// The dwelling: the hearth, the stone, the loom, the pots; the loft.
function dwelling(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  // (Their homes hold out longest: even in the Between, the stone's still
  // there underfoot, the glass coming through it in patches.)
  floorAll(ctx, H, r, ctx.n >= 2 ? B.rf_crazed : stageOf(ctx));
  // The loft: a ledge two high along the back wall, a ladder up to it in
  // front, baskets and pots up there.
  const S = backSeen(ctx, H, r);
  const row0 = [];
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a++) {
    const t = at2(S, a, S.back);
    const behind = at2(S, a, S.back - S.out);
    if (clear(ctx, H, r, t.x, t.z) && !byDoor(ctx, H, r, t.x, t.z, 1) && !ctx.plan.at(behind.x, behind.z)) row0.push(t);
  }
  const loft = longestRun(row0, S.along).slice(0, 8);
  if (loft.length >= 4) {
    for (const t of loft) raise(ctx, H, t.x, t.z, B.rf_dais, 2);
    const fr = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
    const mid = Math.floor(loft.length / 2);
    const lt = [...loft].sort((a, c) => Math.abs(loft.indexOf(a) - mid) - Math.abs(loft.indexOf(c) - mid)).find((t) => clear(ctx, H, r, fr(t).x, fr(t).z));
    if (lt) {
      const { x: lx, z: lz } = fr(lt);
      // (Facing the loft: see player.climb.)
      const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
      for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.ladder, d);
      ctx.reserved.add(key(ctx, lx, lz));
      // Up there: baskets at one end, pots at the other, a rug between.
      b.set(loft[0].x, FY + 2, loft[0].z, B.rf_baskets, rng.int(0, 1));
      b.set(loft[loft.length - 1].x, FY + 2, loft[loft.length - 1].z, B.rf_pots, rng.int(0, 1));
      for (const t of loft.slice(1, -1)) if (rng.chance(0.6)) b.set(t.x, FY + 1, t.z, B.rf_rug);
    }
  }
  // The hearth in the middle, a rug before it, the stone and the loom.
  const h = near(ctx, H, r, r.cx, r.cz + 1, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
  if (h) {
    b.set(h.x, FY, h.z, B.rf_hearth, 0);
    for (const [dx, dz] of [[-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2]]) if (H.own(ctx.plan, r, h.x + dx, h.z + dz) && !isUp(ctx, h.x + dx, h.z + dz)) floorAt(ctx, h.x + dx, h.z + dz, B.rf_rug);
  }
  place(ctx, H, r, B.rf_metate, rng.int(0, 1), true);
  place(ctx, H, r, B.rf_loom, rng.int(0, 1), true);
  place(ctx, H, r, B.rf_pots, rng.int(0, 1), true);
  walls(ctx, H, r, [['rf_niche', 3], ['rf_mural', 2]], 0.5);
  ruin(ctx, H, r);
  // The watchers' echoes at their chores.
  const g = groupOf(ctx, r, 'watchers');
  for (let k = 0; k < 2; k++) {
    const t = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(0, 2), 2);
    if (t) put(ctx, 'sky_watcher', t.x, t.z, r, { dormant: 0, peaceful: true, group: g });
  }
  if (ctx.n >= 1) band(ctx, H, r, ['echo_shade'], { x: r.cx + 3, z: r.cz }, 'dwell');
}
// The observatory: the kiva and its lid, the sighting-stones, the chart.
function observatory(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const c = { x: r.cx, z: r.cz };
  const lid = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (clear(ctx, H, r, c.x + dx, c.z + dz)) lid.push({ x: c.x + dx, z: c.z + dz });
  const quarters = [[0, -3], [3, 0], [0, 3], [-3, 0]].map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz }));
  if (lid.length < 9 || !quarters.every((q) => clear(ctx, H, r, q.x, q.z) && !byDoor(ctx, H, r, q.x, q.z, 1))) {
    walls(ctx, H, r, [['rf_mural', 2], ['rf_niche', 1]], 0.5);
    return;
  }
  // The kiva: a pit under the lid, its floor a step down.
  for (const t of lid) {
    b.set(t.x, FY - 2, t.z, B.rf_sand);
    b.set(t.x, FY - 1, t.z, B.rf_lid);
    ctx.reserved.add(key(ctx, t.x, t.z));
  }
  // The sighting-stones at the quarters, turned anyhow (never all right).
  let turns = quarters.map(() => rng.int(0, 3));
  if (turns.every((t, i) => t === L.sky[i])) turns[rng.int(0, 3)] = (turns[0] + 1) % 4;
  const dials = quarters.map((q, i) => {
    b.set(q.x, FY, q.z, B.rf_dial, turns[i]);
    return { ...abs(ctx, q), want: L.sky[i], quarter: i };
  });
  // (The ring between the stones and the lid kept clear.)
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) ctx.reserved.add(key(ctx, c.x + dx, c.z + dz));
  const loot = H.fill(rng, 9, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2, ctx.T), ['gem', rng.int(1, 3)], ['frost_crystal', rng.int(1, 2)]], H.foundIn(ctx, false)).filter(Boolean).map((s) => [s.item, s.count]);
  out.kivas = [...(out.kivas || []), { dials, lid: lid.map((t) => abs(ctx, t)), c: abs(ctx, c), loot, room: r.id }];
  // The chart on the wall, the journal by it, cairns, braziers.
  const ch = rng.shuffle(northWall(ctx, r)).find((w) => face(ctx, w, B.rf_chart));
  if (ch) lore(ctx, ch.x, ch.z, L.chart());
  const jn = place(ctx, H, r, B.rf_journal, rng.int(0, 1), true);
  if (jn) lore(ctx, jn.x, jn.z, L.journal());
  else if (ch) lore(ctx, ch.x, ch.z, L.journal());
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.rf_cairn, rng.int(0, 1), true);
  place(ctx, H, r, B.rf_brazier, 0, true);
  walls(ctx, H, r, [['rf_mural', 2], ['rf_niche', 1]], 0.4);
  ruin(ctx, H, r);
  const t = near(ctx, H, r, r.cx + 4, r.cz + 3, 2);
  if (t) put(ctx, 'sky_watcher', t.x, t.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'watchers') });
  if (ctx.n >= 1) band(ctx, H, r, ['rift_weaver'], { x: r.cx - 4, z: r.cz - 3 }, 'loom');
}
// The fault: the chasm across it, the phase-bridges.
function fault(ctx, H, r) {
  const { rng, out } = ctx;
  floorAll(ctx, H, r, stageOf(ctx));
  const Fm = frameOf(ctx, H, r);
  const u0 = Math.floor(Fm.L / 2) - 1;
  // Its two crossings, a bridge each, well apart.
  const vs = [];
  for (let v = 1; v < Fm.Wd - 1; v++) vs.push(v);
  const cross = rng.shuffle(vs).filter((v, i, a) => a.slice(0, i).every((w) => Math.abs(w - v) >= 3)).slice(0, 2);
  const abyss = [];
  const bridges = cross.map(() => []);
  ctx.chasm ||= new Set();
  for (let v = 0; v < Fm.Wd; v++) {
    for (const u of [u0, u0 + 1]) {
      const p = Fm.P(u, v);
      if (!H.own(ctx.plan, r, p.x, p.z) || isUp(ctx, p.x, p.z) || byDoor(ctx, H, r, p.x, p.z, 1)) continue;
      const k = cross.indexOf(v);
      if (k >= 0) {
        floorAt(ctx, p.x, p.z, B.rf_bridge);
        bridges[k].push(abs(ctx, p));
      } else {
        floorAt(ctx, p.x, p.z, B.rf_abyss);
        abyss.push(abs(ctx, p));
        ctx.chasm.add(key(ctx, p.x, p.z));
      }
      ctx.reserved.add(key(ctx, p.x, p.z));
    }
  }
  // (The ways onto the bridges kept clear.)
  for (const v of cross) for (const u of [u0 - 1, u0 + 2]) {
    const p = Fm.P(u, v);
    ctx.reserved.add(key(ctx, p.x, p.z));
  }
  if (abyss.length) out.faults = [...(out.faults || []), { abyss, bridges: bridges.filter((q) => q.length), room: r.id, beat: rng.float(0, 4) }];
  // Crystals and shards either side; the glass on the walls.
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.rf_crystal, rng.int(0, 1), true);
  place(ctx, H, r, B.rf_shards, rng.int(0, 1), false);
  walls(ctx, H, r, [['rf_glasswall', 3], ['rf_mural', 1]], 0.5);
  ruin(ctx, H, r);
  // The stalkers, one each side; motes over the chasm.
  band(ctx, H, r, ['void_stalker'], Fm.P(2, Fm.mid), 'near');
  band(ctx, H, r, ['void_stalker', 'shard_mote'], Fm.P(Fm.L - 3, Fm.mid), 'far');
}
// The crystals: the cavern grown full of them, the shardbacks, a weaver.
function crystals(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, stageOf(ctx));
  floorAll(ctx, H, r, ctx.n >= 1 ? B.rf_glass : B.rf_crazed, (x, z) => Math.hypot(x - r.cx, (z - r.cz) * 1.2) < 2.6 + Math.sin(x * 1.3 + z) * 0.8);
  const set = [];
  for (let k = 0; k < 6; k++) {
    const t = near(ctx, H, r, r.cx + rng.int(-4, 4), r.cz + rng.int(-3, 3), 2, (x, z) => ctx.plan.at(x, z + 1) && !set.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 3));
    if (!t) continue;
    b.set(t.x, FY, t.z, B.rf_crystal, rng.int(0, 1));
    set.push(t);
  }
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.rf_shards, rng.int(0, 1), false);
  place(ctx, H, r, B.rf_bones, rng.int(0, 1), true);
  walls(ctx, H, r, [['rf_glasswall', 2], ['rf_niche', 1]], 0.4);
  const g = groupOf(ctx, r, 'herd');
  for (let k = 0; k < 2 + (ctx.n >= 1 ? 1 : 0); k++) {
    const t = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(-2, 2), 2);
    if (t) put(ctx, 'shardback', t.x, t.z, r, { dormant: 0, group: g });
  }
  band(ctx, H, r, ['rift_weaver'], { x: r.cx + 4, z: r.cz - 3 }, 'weaver');
}
// The shrine: the spirit figures, the bowls, the murals; watchers knelt.
function shrine(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const S = backSeen(ctx, H, r);
  let k = 0;
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a += 2) {
    const t = at2(S, a, S.back);
    if (!clear(ctx, H, r, t.x, t.z) || byDoor(ctx, H, r, t.x, t.z, 1) || !ctx.plan.at(t.x, t.z + 1)) continue;
    if (k % 2 === 0) {
      b.set(t.x, FY, t.z, B.rf_kachina, rng.int(0, 1));
      lore(ctx, t.x, t.z, L.spirit());
    } else b.set(t.x, FY, t.z, B.rf_bowl, rng.int(0, 1));
    k++;
  }
  for (let dz = -1; dz <= 1; dz++) for (let dx = -2; dx <= 2; dx++) if (H.own(ctx.plan, r, r.cx + dx, r.cz + dz) && !isUp(ctx, r.cx + dx, r.cz + dz)) floorAt(ctx, r.cx + dx, r.cz + dz, B.rf_rug);
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.rf_brazier, 0, true);
  walls(ctx, H, r, [['rf_mural', 4], ['rf_niche', 1]], 0.65);
  ruin(ctx, H, r);
  const g = groupOf(ctx, r, 'knelt');
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, r.cx + (i ? 2 : -2), r.cz, 2);
    if (t) put(ctx, 'sky_watcher', t.x, t.z, r, { dormant: 0, peaceful: true, group: g });
  }
  band(ctx, H, r, ['rift_weaver'], { x: r.cx, z: r.z1 - 2 }, 'weaver');
  if (ctx.n >= 1) band(ctx, H, r, ['echo_shade'], { x: r.cx + 3, z: r.cz + 2 }, 'echo');
}
// The breach: the tear, the glass, the floating rocks, a rift pair.
function breach(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, stageOf(ctx));
  floorAll(ctx, H, r, B.rf_glass, (x, z) => Math.hypot(x - r.cx, (z - r.cz) * 1.15) < 4 + Math.sin(x + z * 1.7) * 0.9);
  if (clear(ctx, H, r, r.cx, r.cz)) b.set(r.cx, FY, r.cz, B.rf_tear, 0);
  const set = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng.float(0, 1);
    const t = near(ctx, H, r, Math.round(r.cx + Math.cos(a) * 4), Math.round(r.cz + Math.sin(a) * 3.4), 1, (x, z) => ctx.plan.at(x, z + 1) && !set.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 3));
    if (!t) continue;
    b.set(t.x, FY, t.z, B.rf_float, rng.int(0, 1));
    set.push(t);
  }
  // A rift pair (see game/ancient.js), either side of the tear.
  const ends = [];
  for (const dx of [-5, 5]) {
    const t = near(ctx, H, r, r.cx + dx, r.cz + rng.int(-1, 1), 2, (x, z) => !H.byWall(ctx.plan, x, z));
    if (t) ends.push(t);
  }
  if (ends.length === 2) {
    for (const q of ends) {
      floorAt(ctx, q.x, q.z, B.rf_crazed);
      ctx.reserved.add(key(ctx, q.x, q.z));
    }
    H.anc(ctx).portals.push({ a: abs(ctx, ends[0]), b: abs(ctx, ends[1]) });
  }
  walls(ctx, H, r, [['rf_tearwall', 1], ['rf_glasswall', 3]], 0.55);
  band(ctx, H, r, ['void_stalker', 'shard_mote', 'shard_mote'], { x: r.cx, z: r.cz + 3 }, 'breach');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'dwelling':
      return dwelling(ctx, H, r);
    case 'observatory':
      return observatory(ctx, H, r);
    case 'fault':
      return fault(ctx, H, r);
    case 'crystals':
      return crystals(ctx, H, r);
    case 'shrine':
      return shrine(ctx, H, r);
    case 'breach':
      return breach(ctx, H, r);
  }
}

// The old rooms, laid in the floor's own stone, their walls given faces.
const RECOLOUR = new Set(['rock_void', 'blight_floor'].map((k) => B[k]).filter((v) => v !== undefined));
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z)) continue;
      const f = b.get(x, FY - 1, z);
      if (f === ctx.T.floor || f === ctx.T.alt || RECOLOUR.has(f)) b.set(x, FY - 1, z, f === B.blight_floor ? B.rf_glass : stageOf(ctx));
    }
  }
  switch (r.kit) {
    case 'entry': {
      // On each floor, what it was, painted by the way in.
      const w = northWall(ctx, r).find((q) => b.get(q.x, FY, q.z) === ctx.T.wall);
      if (w && face(ctx, w, B.rf_mural, rng.int(0, 1))) lore(ctx, w.x, w.z, L.hall());
      walls(ctx, H, r, [['rf_niche', 2]], 0.4);
      break;
    }
    case 'boss': {
      // Where the sky came down: the glass, the tear in the wall.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && rng.chance(0.5)) b.set(x, FY - 1, z, B.rf_glass);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) <= 3 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.rf_mural, 1)) lore(ctx, c.x, c.z, L.last());
      walls(ctx, H, r, [['rf_tearwall', 1], ['rf_glasswall', 3]], 0.55);
      break;
    }
    default:
      walls(ctx, H, r, [['rf_glasswall', 3], ['rf_niche', 2], ['rf_mural', 1]], 0.3);
  }
}

// Each room set about with the Reach's things, spaced out.
const DECOR = {
  entry: [['rf_brazier', 1], ['rf_pots', 1], ['rf_cairn', 1]],
  exit: [['rf_brazier', 1], ['rf_cairn', 1]],
  portals: [['rf_crystal', 2], ['rf_shards', 1]],
  fracture: [['rf_shards', 2], ['rf_crystal', 1]],
  echo: [['rf_pots', 1], ['rf_baskets', 1]],
  shards: [['rf_crystal', 2]],
  shardstorm: [['rf_crystal', 1], ['rf_shards', 2]],
  gravity: [['rf_float', 1], ['rf_shards', 1]],
  flicker: [['rf_crystal', 1]],
  trap: [['rf_bones', 1]],
  treasure: [['rf_pots', 1], ['rf_baskets', 1]],
  guard: [['rf_brazier', 1], ['rf_crystal', 1]],
  dwelling: [['rf_pots', 2], ['rf_baskets', 2], ['rf_brazier', 1]],
  observatory: [['rf_cairn', 1], ['rf_bowl', 1]],
  fault: [['rf_crystal', 1], ['rf_bones', 1]],
  crystals: [['rf_bones', 1]],
  shrine: [['rf_bowl', 1], ['rf_pots', 1]],
  breach: [['rf_shards', 2], ['rf_crystal', 1]],
  boss: [['rf_crystal', 2], ['rf_float', 1]],
};
const SOLID = new Set(['rf_pots', 'rf_baskets', 'rf_brazier', 'rf_cairn', 'rf_bowl', 'rf_crystal', 'rf_bones']);
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
  if (!RIFT_OWN.has(r.kit) && !['boss', 'hidden', 'entry', 'exit', 'vault'].includes(r.kit)) ruin(ctx, H, r);
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 22) * rng.float(0.8, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.22) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], rng.int(0, 1), SOLID.has(k));
      if (!at) break;
      let close = set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2) || ctx.chasm?.has(key(ctx, at.x, at.z));
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
const MOVABLE = new Set(['rf_pots', 'rf_baskets', 'rf_brazier', 'rf_cairn', 'rf_bowl', 'rf_crystal', 'rf_bones', 'rf_float', 'rf_metate', 'rf_loom', 'rf_journal', 'glow_crystal', 'void_bloom', 'eye_stalk', 'tendril', 'obsidian'].map((k) => B[k]).filter((v) => v !== undefined));
function openUp(ctx, H, r) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  const hi = (x, z) => (ctx.ledge?.has(key(ctx, x, z)) ? 2 : ctx.lifted?.has(key(ctx, x, z)) ? 1 : ctx.sunk?.has(key(ctx, x, z)) ? -1 : 0);
  const ladderAt = (x, z) => !!BLOCKS[b.get(x, FY, z)].ladder;
  const blocked = (x, z) => {
    const y = FY + Math.max(0, hi(x, z));
    if (ladderAt(x, z)) return false;
    return !!BLOCKS[b.get(x, y, z)].solid || !!BLOCKS[b.get(x, y + 1, z)].solid;
  };
  for (let guard = 0; guard < 16; guard++) {
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
        if (Math.abs(hi(nx, nz) - hi(x, z)) > 1 && !ladderAt(x, z) && !ladderAt(nx, nz)) continue;
        seen.add(j);
        q.push({ x: nx, z: nz });
      }
    }
    let cut = null;
    for (let z = r.z0; z <= r.z1 && !cut; z++) {
      for (let x = r.x0; x <= r.x1 && !cut; x++) {
        // (A chest walled in counts as what's cut off: what's walled it in,
        // cleared, and then it's moved aside.)
        if (!H.own(plan, r, x, z) || seen.has(z * W + x) || (blocked(x, z) && b.get(x, FY, z) !== B.chest)) continue;
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
    // (A stack of it, all of it.)
    for (let y = cut.y; y <= cut.y + 2 && MOVABLE.has(b.get(cut.x, y, cut.z)); y++) b.set(cut.x, y, cut.z, B.air);
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

// Its architect's last word: what's at work kept only where it still is.
function after(ctx, H) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  if (H) for (const r of ctx.plan.rooms) if (r.kit !== 'hidden') openUp(ctx, H, r);
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  out.kivas = (out.kivas || []).filter((q) => q.dials.every((d) => at(d) === B.rf_dial) && q.lid.every((t) => at(t, FY - 1) === B.rf_lid));
  out.faults = (out.faults || []).filter((q) => q.abyss.length && q.bridges.length);
  out.lore = (out.lore || []).filter((q) => [FY, FY + 1, FY + 2].some((y) => BLOCKS[at(q, y)]?.interact === 'lore'));
}

export const RIFT_ARCH = {
  own: RIFT_OWN,
  kits,
  // (The dwellings never lost to the way down.)
  keep: new Set(['dwelling', 'observatory']),
  spare: (rng, n, have = []) => {
    const pool = [['dwelling', 2], ['crystals', 1], ['shrine', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'dwelling';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const RIFT_THINGS = ['rf_crystal', 'rf_pots', 'rf_metate', 'rf_loom', 'rf_hearth', 'rf_kachina', 'rf_dial', 'rf_float', 'rf_tear', 'rf_bowl', 'rf_baskets', 'rf_bones', 'rf_shards', 'rf_brazier', 'rf_journal', 'rf_cairn'].filter((k) => BLOCKS[B[k]]);
export { META_STATE };
