// (Round 110) The Athanor, made over: the furnace-vault of the Divine
// Alchemist under the hills of Velmarch, a temple-laboratory older than
// the empire, still working: white and gold marble, glass and brass, the
// great work bubbling, everything faintly luminous and humming. Wide halls
// opening into many small rooms (alcoves, cells, side-chapels of the art)
// rather than climbing; and it goes down through the stages of the Work, a
// floor each: nigredo (black marble and ash), albedo (white and silver),
// rubedo (red porphyry and gold). See game/athanorwork.js for the speculum
// (the sun-lamp's beam turned by mirrors onto the sanctum's seal), the
// transmutation table, the great athanor (fed, it ripens its egg, and the
// imps come to its fire), and the vats and their tender; game/ancient.js
// for the old works (the circles, the stills, the quicksilver, the
// orreries, the salt gardens, the furnaces), kept in their rooms.
//
// A floor of it, beside the old rooms, and what its own rooms are:
//   the laboratorium: a long hall of workbenches and alembics down its
//     middle, the shelves and niches and the Emerald Tablet in its walls,
//     alcoves dug off it each with its apparatus or an adept's papers, and
//     the transmutation table at its end; the adepts at the Work;
//   the furnace: the great athanor up on its dais, coal and sulphur heaped
//     by it, the wall-furnaces; the imps;
//   the cloister: a colonnade round a court, the quicksilver fountain in
//     its middle, pools of quicksilver round it, trees of Diana; the
//     homunculi in the quicksilver, a leaden sentinel;
//   the speculum: the sun-lamp, three mirrors on their stands, and the
//     sanctum's seal in the north wall (the sanctum behind it);
//   the vat-hall: the vats in rows with what's growing in them, the
//     tender going among them;
//   the garden: the garden of metals: salt underfoot, the silver trees,
//     crystals, and the shepherds the Work turned to salt where they stood.
// About the floor: its papers (see deeps/athanorlore.js), the stage it's
// at, and what the Work wanted.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { athanorLore } from './athanorlore.js';
import { key, raise, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, frameOf } from './common.js';

const POOL = [['laboratorium', 2], ['furnace', 1], ['cloister', 1], ['speculum', 1], ['vathall', 1], ['garden', 1], ['circle', 1], ['distillery', 1], ['mercury', 1], ['library', 1], ['observatory', 1], ['salt_garden', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['furnace', 'cloister', 'speculum', 'vathall', 'garden', 'circle', 'distillery', 'mercury', 'library', 'observatory', 'salt_garden', 'trap', 'treasure']);
export const ATHANOR_OWN = new Set(['laboratorium', 'furnace', 'cloister', 'speculum', 'vathall', 'garden']);
// The stages of the Work, a floor each: its floor.
export const STAGE_FLOOR = ['an_nigredo', 'an_albedo', 'an_rubedo'];
const stageOf = (ctx) => B[STAGE_FLOOR[Math.min(ctx.n, 2)]];

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The laboratorium on every floor; the speculum and the furnace on the
  // first and often after; the cloister or the vat-hall; the garden now
  // and then.
  out.push('laboratorium');
  if (n === 0 || rng.chance(0.6)) out.push('speculum');
  if (n === 0 || rng.chance(0.5)) out.push('furnace');
  out.push(rng.pick(['cloister', 'vathall']));
  if (rng.chance(0.5)) out.push('garden');
  // And one of the old works of the place on every floor (see
  // game/ancient.js): an orrery, a salt garden, a circle, a still, a pool.
  out.push(rng.pick(['observatory', 'salt_garden', 'observatory', 'salt_garden', 'circle', 'distillery', 'mercury']));
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
  laboratorium: [[16, 18], [9, 10]], furnace: [[12, 13], [11, 12]], cloister: [[13, 15], [12, 13]], speculum: [[13, 15], [10, 11]],
  vathall: [[14, 16], [8, 9]], garden: [[12, 13], [11, 12]],
};
const SHAPES = { laboratorium: ['rect'], furnace: ['octagon'], cloister: ['rect'], speculum: ['rect'], vathall: ['rect'], garden: ['octagon', 'round'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6304) % list.length] : null;
};
const Lof = (ctx) => ctx.athLore || (ctx.athLore = athanorLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
function byDoor(ctx, H, r, x, z, d = 1) {
  return H.doorways(ctx.plan, r).some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) <= d);
}
// The north wall's faces, spaced: pilasters, niches, shelves, a rose
// window, a wall-furnace, the Emerald Tablet (with its words).
function walls(ctx, H, r, list, p) {
  const L = Lof(ctx);
  let last = -9;
  for (const w of northWall(ctx, r)) {
    if (w.x - last < 2 || !ctx.rng.chance(p)) continue;
    const k = ctx.rng.weighted(list);
    const ok = face(ctx, w, B[k], ctx.rng.int(0, 1));
    if (ok && k === 'an_tablet') lore(ctx, w.x, w.z, L.tablet());
    if (ok) last = w.x;
  }
}
// An alcove dug off the room: open, its own little floor, something of
// the art in it.
function alcove(ctx, H, r, fill) {
  const { b } = ctx;
  const FY = H.FY;
  const pk = pocket(ctx, H, r, ctx.T.wall);
  if (!pk) return null;
  for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.air);
  ctx.plan.carve(pk.door.x, pk.door.z);
  b.set(pk.door.x, FY - 1, pk.door.z, stageOf(ctx));
  for (const c of pk.cells) floorAt(ctx, c.x, c.z, stageOf(ctx));
  fill(pk);
  return pk;
}

// --------------------------------------------------------------- the rooms
// The laboratorium: benches down its middle, alcoves off it.
function laboratorium(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const Fm = frameOf(ctx, H, r);
  // The benches and the alembics, down the middle, an aisle each side.
  for (let u = 2; u <= Fm.L - 4; u += 2) {
    const p = Fm.P(u, Fm.mid);
    if (!clear(ctx, H, r, p.x, p.z) || byDoor(ctx, H, r, p.x, p.z, 2)) continue;
    b.set(p.x, FY, p.z, u % 4 === 2 ? B.an_table : B.an_alembic, rng.int(0, 1));
  }
  // The transmutation table at its end.
  const tt = Fm.P(Fm.L - 2, Fm.mid);
  if (clear(ctx, H, r, tt.x, tt.z) && ctx.plan.at(tt.x, tt.z + 1)) {
    b.set(tt.x, FY, tt.z, B.an_transmute, 0);
    lore(ctx, tt.x, tt.z, L.table());
    out.tables = [...(out.tables || []), { ...abs(ctx, tt), room: r.id }];
  }
  // Its alcoves: an alembic and jars; an adept's papers; jars and coal.
  const fills = rng.shuffle([
    (pk) => {
      b.set(pk.back.x, FY, pk.back.z, B.an_alembic, 0);
      const c = pk.cells.find((q) => q !== pk.back && b.get(q.x, FY, q.z) === B.air && !(q.x === pk.cells[0].x && q.z === pk.cells[0].z));
      if (c) b.set(c.x, FY, c.z, B.an_jars, 0);
    },
    (pk) => {
      b.set(pk.back.x, FY, pk.back.z, B.an_lectern, 0);
      lore(ctx, pk.back.x, pk.back.z, L.diary());
    },
    (pk) => {
      b.set(pk.back.x, FY, pk.back.z, B.an_lectern, 0);
      lore(ctx, pk.back.x, pk.back.z, rng.chance(0.5) ? L.letter() : L.inventory());
    },
  ]);
  for (let i = 0; i < 3; i++) alcove(ctx, H, r, fills[i]);
  walls(ctx, H, r, [['an_shelves', 3], ['an_niche', 2], ['an_pilaster', 2], ['an_tablet', 1]], 0.55);
  place(ctx, H, r, B.an_candles, 0, true);
  band(ctx, H, r, ['adept', 'quicksilver_homunculus'], { x: r.cx, z: r.cz }, 'work');
  band(ctx, H, r, ['quicksilver_homunculus'], { x: r.cx + 4, z: r.cz }, 'work2');
}
// The furnace: the great athanor up on its dais.
function furnace(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const dais = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (clear(ctx, H, r, r.cx + dx, r.cz + dz)) dais.push({ x: r.cx + dx, z: r.cz + dz });
  if (dais.length === 9) {
    for (const t of dais) raise(ctx, H, t.x, t.z, B.an_dais, 1);
    b.set(r.cx, FY + 1, r.cz, B.an_athanor, 0);
    out.athanors = [...(out.athanors || []), { ...abs(ctx, { x: r.cx, z: r.cz }), room: r.id, box: H.box(b, r) }];
  }
  for (const dx of [-3, 3]) {
    const t = near(ctx, H, r, r.cx + dx, r.cz + 2, 1, (x, z) => ctx.plan.at(x, z + 1) && !isUp(ctx, x, z));
    if (t) b.set(t.x, FY, t.z, B.an_coal, rng.int(0, 1));
  }
  const lc = place(ctx, H, r, B.an_lectern, 0, true);
  if (lc) lore(ctx, lc.x, lc.z, L.furnace());
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.an_candles, 0, true);
  walls(ctx, H, r, [['an_furnace', 3], ['an_pilaster', 2]], 0.6);
  band(ctx, H, r, ['sulphur_imp', 'sulphur_imp'], { x: r.cx, z: r.z1 - 2 }, 'imps', { dormant: 3 });
  if (rng.chance(0.6)) band(ctx, H, r, ['alembic_golem'], { x: r.cx + 3, z: r.cz - 2 }, 'golem');
}
// The cloister: a colonnade round a court, the quicksilver fountain.
function cloister(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  // The columns, every other pace, two in from the walls.
  for (let z = r.z0 + 2; z <= r.z1 - 2; z++) {
    for (let x = r.x0 + 2; x <= r.x1 - 2; x++) {
      const ring = x === r.x0 + 2 || x === r.x1 - 2 || z === r.z0 + 2 || z === r.z1 - 2;
      if (!ring || (x + z) % 2 || !clear(ctx, H, r, x, z) || byDoor(ctx, H, r, x, z, 2)) continue;
      if (!ctx.plan.at(x, z + 1)) continue;
      b.set(x, FY, z, B.an_column);
    }
  }
  // The court: the fountain, pools of quicksilver round it, the ouroboros.
  if (clear(ctx, H, r, r.cx, r.cz)) b.set(r.cx, FY, r.cz, B.an_fountain);
  const pool = [];
  for (const [dx, dz] of [[-1, 0], [1, 0], [-1, -1], [1, -1], [0, -1]]) {
    const x = r.cx + dx;
    const z = r.cz + dz;
    if (!clear(ctx, H, r, x, z)) continue;
    floorAt(ctx, x, z, B.quicksilver);
    pool.push(abs(ctx, { x, z }));
  }
  if (pool.length) H.anc(ctx).mercury.push({ box: H.box(b, r), tiles: pool });
  if (clear(ctx, H, r, r.cx, r.cz + 1)) floorAt(ctx, r.cx, r.cz + 1, B.an_ouroboros);
  for (const [dx, dz] of [[-3, -2], [3, -2]]) {
    const t = near(ctx, H, r, r.cx + dx, r.cz + dz, 1, (x, z) => ctx.plan.at(x, z + 1) && b.get(x, FY, z) === B.air);
    if (t) b.set(t.x, FY, t.z, B.an_tree, rng.int(0, 1));
  }
  const sm = place(ctx, H, r, B.an_saltman, rng.int(0, 1), true);
  if (sm) lore(ctx, sm.x, sm.z, L.shepherd());
  walls(ctx, H, r, [['an_pilaster', 2], ['an_rose', 1], ['an_niche', 1]], 0.4);
  band(ctx, H, r, ['quicksilver_homunculus', 'quicksilver_homunculus'], { x: r.cx, z: r.cz - 2 }, 'court');
  band(ctx, H, r, ['leaden_sentinel'], { x: r.cx, z: r.z1 - 2 }, 'cloister');
}
// A mirror turned `/` (0) throws a beam going (dx, dz) to (-dz, -dx);
// turned `\` (1), to (dz, dx). (Its work, game/athanorwork.js, the same.)
export const mirrorTurn = (rot, d) => (rot % 2 ? { x: d.z, z: d.x } : { x: -d.z, z: -d.x });
const sameDir = (a, b) => a.x === b.x && a.z === b.z;
// The speculum: the sun-lamp, the mirrors, the seal, the sanctum.
function speculum(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const ok = (x, z) => H.own(ctx.plan, r, x, z) && b.get(x, FY, z) === B.air && !isUp(ctx, x, z) && !ctx.reserved.has(key(ctx, x, z));
  // (Laid out as if the seal were in the north wall, then turned to
  // whichever wall it's in: across the room is i, in from the seal's wall
  // is j.)
  const frames = {
    '0,-1': { T: (i, j) => ({ x: r.x0 + i, z: r.z0 + j }), si: (w) => w.x - r.x0, Wd: r.x1 - r.x0 + 1, Dp: r.z1 - r.z0 + 1 },
    '0,1': { T: (i, j) => ({ x: r.x1 - i, z: r.z1 - j }), si: (w) => r.x1 - w.x, Wd: r.x1 - r.x0 + 1, Dp: r.z1 - r.z0 + 1 },
    '1,0': { T: (i, j) => ({ x: r.x1 - j, z: r.z0 + i }), si: (w) => w.z - r.z0, Wd: r.z1 - r.z0 + 1, Dp: r.x1 - r.x0 + 1 },
    '-1,0': { T: (i, j) => ({ x: r.x0 + j, z: r.z1 - i }), si: (w) => r.z1 - w.z, Wd: r.z1 - r.z0 + 1, Dp: r.x1 - r.x0 + 1 },
  };
  // The way the beam must go: across from the lamp, toward the seal's wall
  // at the first mirror, along at the second, at the third into the seal.
  const route = (F, si) => {
    const jL = F.Dp - 2;
    const jb = 2;
    if (jL - jb < 3) return null;
    for (const ia of rng.shuffle(Array.from({ length: F.Wd - 3 }, (_, i) => 2 + i))) {
      if (Math.abs(ia - si) < 3) continue;
      const tiles = [];
      for (let i = 0; i <= ia; i++) tiles.push(F.T(i, jL));
      for (let j = jL - 1; j >= jb; j--) tiles.push(F.T(ia, j));
      const s1 = Math.sign(si - ia);
      for (let i = ia + s1; i !== si + s1; i += s1) tiles.push(F.T(i, jb));
      for (let j = jb - 1; j >= 0; j--) tiles.push(F.T(si, j));
      if (!tiles.every((t) => ok(t.x, t.z))) continue;
      const stops = [F.T(ia, jL), F.T(ia, jb), F.T(si, jb), F.T(0, jL)];
      if (stops.some((t) => byDoor(ctx, H, r, t.x, t.z, 1))) continue;
      return { tiles, lamp: F.T(0, jL), at: stops.slice(0, 3) };
    }
    return null;
  };
  let path = null;
  const pk = pocket(ctx, H, r, ctx.T.wall, (w, d) => {
    const F = frames[`${d.x},${d.z}`];
    const si = F.si(w);
    if (si < 3 || si > F.Wd - 3) return false;
    path = route(F, si);
    return !!path;
  });
  if (pk && path) {
    const seal = pk.door;
    for (const y of [FY, FY + 1]) b.set(seal.x, y, seal.z, B.an_seal);
    // The sanctum: its floor, its chest, the last page of the Book.
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.an_rubedo);
    b.set(pk.back.x, FY, pk.back.z, B.chest, 0);
    b.container(pk.back.x, FY, pk.back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2.2, ctx.T), ['gold_ingot', rng.int(1, 3)], ['gem', rng.int(1, 3)], ['red_tincture', 1]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== pk.back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.an_lectern, 0);
      lore(ctx, cells[0].x, cells[0].z, L.story());
    }
    if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.an_candles, 0);
    // The lamp and the mirrors, each turned whichever way takes the beam
    // on along its way, then turned at random (never all right).
    const { lamp, at } = path;
    const dir = { x: Math.sign(at[0].x - lamp.x), z: Math.sign(at[0].z - lamp.z) };
    const legs = [dir, ...at.slice(1).map((m, i) => ({ x: Math.sign(m.x - at[i].x), z: Math.sign(m.z - at[i].z) })), { x: Math.sign(seal.x - at[2].x), z: Math.sign(seal.z - at[2].z) }];
    const want = at.map((m, i) => (sameDir(mirrorTurn(0, legs[i]), legs[i + 1]) ? 0 : 1));
    let turns = want.map(() => rng.int(0, 1));
    if (turns.every((t, i) => t === want[i])) turns[rng.int(0, 2)] ^= 1;
    b.set(lamp.x, FY, lamp.z, B.an_sunlamp, dir.x < 0 ? 1 : 0);
    at.forEach((m, i) => b.set(m.x, FY, m.z, B.an_mirror, turns[i]));
    // (The beam's way kept clear of anything set down later.)
    for (const t of path.tiles) if (!(t.x === lamp.x && t.z === lamp.z) && !at.some((m) => m.x === t.x && m.z === t.z)) ctx.reserved.add(key(ctx, t.x, t.z));
    out.specula = [...(out.specula || []), { lamp: { ...abs(ctx, lamp), dir }, mirrors: at.map((m, i) => ({ ...abs(ctx, m), want: want[i] })), seal: abs(ctx, seal), room: r.id }];
  }
  const lc = place(ctx, H, r, B.an_lectern, 0, true);
  if (lc) lore(ctx, lc.x, lc.z, L.speculum());
  walls(ctx, H, r, [['an_rose', 2], ['an_pilaster', 2], ['an_niche', 1]], 0.45);
  place(ctx, H, r, B.an_armillary, 0, true);
  band(ctx, H, r, ['adept'], { x: r.cx, z: r.cz }, 'watch');
}
// The vat-hall: the vats in rows, the tender among them.
function vathall(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const S = backSeen(ctx, H, r);
  const vats = [];
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 2; a += 2) {
    const t = at2(S, a, S.back);
    if (!clear(ctx, H, r, t.x, t.z) || byDoor(ctx, H, r, t.x, t.z, 1) || !ctx.plan.at(t.x, t.z + 1)) continue;
    b.set(t.x, FY, t.z, B.an_vat, META_STATE);
    vats.push(abs(ctx, t));
  }
  // A second row, out in the hall, every third pace.
  for (let a = (S.along ? r.x0 : r.z0) + 2; a <= (S.along ? r.x1 : r.z1) - 2; a += 3) {
    const t = at2(S, a, S.back + S.out * 3);
    if (!clear(ctx, H, r, t.x, t.z) || byDoor(ctx, H, r, t.x, t.z, 2) || !ctx.plan.at(t.x, t.z + 1)) continue;
    b.set(t.x, FY, t.z, B.an_vat, META_STATE);
    vats.push(abs(ctx, t));
  }
  if (vats.length) out.vats = [...(out.vats || []), { vats, room: r.id }];
  const lc = place(ctx, H, r, B.an_lectern, 0, true);
  if (lc) lore(ctx, lc.x, lc.z, L.recipe());
  place(ctx, H, r, B.an_alembic, rng.int(0, 1), true);
  walls(ctx, H, r, [['an_niche', 2], ['an_shelves', 2]], 0.4);
  band(ctx, H, r, ['vat_tender'], { x: r.cx, z: r.cz }, 'tender', { dormant: 0, peaceful: true });
  band(ctx, H, r, ['quicksilver_homunculus', 'alembic_golem'], { x: r.cx + 3, z: r.cz + 1 }, 'vats');
}
// The garden of metals.
function garden(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  floorAll(ctx, H, r, B.salt_crust, (x, z) => Math.hypot(x - r.cx, (z - r.cz) * 1.2) < 3.6 + Math.sin(x * 1.3 + z) * 0.8);
  for (let i = 0; i < 3; i++) {
    const t = near(ctx, H, r, r.cx + [-3, 3, 0][i], r.cz + [-2, -2, 2][i], 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
    if (t) b.set(t.x, FY, t.z, B.an_tree, rng.int(0, 1));
  }
  for (let i = 0; i < 2; i++) {
    const t = place(ctx, H, r, B.an_saltman, rng.int(0, 1), true);
    if (t) lore(ctx, t.x, t.z, i ? L.inventory() : L.shepherd());
  }
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.glow_crystal, rng.int(0, 3));
  walls(ctx, H, r, [['an_niche', 1], ['an_pilaster', 2], ['an_rose', 1]], 0.4);
  band(ctx, H, r, ['leaden_sentinel'], { x: r.cx, z: r.cz }, 'garden');
  band(ctx, H, r, ['sulphur_imp'], { x: r.cx + 3, z: r.cz + 2 }, 'garden2');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'laboratorium':
      return laboratorium(ctx, H, r);
    case 'furnace':
      return furnace(ctx, H, r);
    case 'cloister':
      return cloister(ctx, H, r);
    case 'speculum':
      return speculum(ctx, H, r);
    case 'vathall':
      return vathall(ctx, H, r);
    case 'garden':
      return garden(ctx, H, r);
  }
}

// The old rooms, laid in the stage's own stone: their floors, the old
// marble rings gilt (so they show on any floor), their walls given faces.
const RECOLOUR = new Set(['marble', 'tile_blue', 'kiln_tile'].map((k) => B[k]).filter((v) => v !== undefined));
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z)) continue;
      const f = b.get(x, FY - 1, z);
      if (f === B.marble) b.set(x, FY - 1, z, B.gilt_trim);
      else if (f === ctx.T.floor || f === ctx.T.alt || RECOLOUR.has(f)) b.set(x, FY - 1, z, stageOf(ctx));
    }
  }
  switch (r.kit) {
    case 'entry': {
      // On each floor, the stage it's at, on a lectern by the way in.
      const lc = place(ctx, H, r, B.an_lectern, 0, true);
      if (lc) lore(ctx, lc.x, lc.z, L.operations());
      walls(ctx, H, r, [['an_pilaster', 2], ['an_niche', 1]], 0.4);
      break;
    }
    case 'boss': {
      // The master's hall: the rubedo, the rose windows, its word on the
      // tablet.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && b.get(x, FY - 1, z) !== B.gilt_trim) b.set(x, FY - 1, z, B.an_rubedo);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) <= 3 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.an_tablet)) lore(ctx, c.x, c.z, L.last());
      walls(ctx, H, r, [['an_rose', 2], ['an_pilaster', 2], ['an_furnace', 1]], 0.5);
      break;
    }
    default:
      walls(ctx, H, r, [['an_pilaster', 2], ['an_niche', 1], ['an_shelves', 1]], 0.35);
  }
}

// Each room set about with the Athanor's things, spaced out.
const DECOR = {
  entry: [['an_candles', 2], ['an_jars', 1], ['an_column', 1]],
  exit: [['an_candles', 2], ['an_armillary', 1], ['an_column', 1]],
  circle: [['an_candles', 3], ['an_column', 1]],
  distillery: [['an_alembic', 2], ['an_jars', 2], ['an_coal', 1]],
  mercury: [['an_jars', 1], ['an_candles', 1], ['an_column', 1]],
  library: [['an_lectern', 1], ['an_candles', 2], ['an_jars', 1]],
  observatory: [['an_armillary', 2], ['an_candles', 1]],
  salt_garden: [['an_saltman', 1], ['an_tree', 1]],
  trap: [['an_jars', 1], ['an_candles', 1]],
  treasure: [['an_candles', 1], ['an_jars', 1]],
  guard: [['an_candles', 1], ['an_column', 1]],
  laboratorium: [['an_jars', 3], ['an_candles', 2], ['an_armillary', 1], ['an_alembic', 1]],
  furnace: [['an_jars', 1], ['an_coal', 2], ['an_candles', 1]],
  cloister: [['an_candles', 1], ['an_tree', 1]],
  speculum: [['an_candles', 3], ['an_column', 2], ['an_jars', 1]],
  vathall: [['an_jars', 2], ['an_alembic', 1], ['an_candles', 1]],
  garden: [['an_armillary', 1], ['an_saltman', 1]],
  boss: [['an_candles', 1], ['an_column', 1]],
};
// The floor inlaid: a band of the other marble a pace in from the walls,
// or a cross of it through the middle, or a medallion at the middle with
// the serpent in it (whichever the room's given; never over what's been
// laid already).
const ACCENT = { an_nigredo: 'an_albedo', an_albedo: 'an_nigredo', an_rubedo: 'an_albedo' };
const INLAY = { laboratorium: ['band', 'cross'], speculum: ['band', 'medallion'], vathall: ['band'], entry: ['medallion'], exit: ['medallion', 'band'], library: ['band', 'cross'], guard: ['cross', 'band'], treasure: ['medallion'], cloister: ['medallion'], observatory: ['medallion'], boss: ['band'] };
function inlay(ctx, H, r) {
  const { b, plan, rng } = ctx;
  const FY = H.FY;
  const kinds = INLAY[r.kit];
  if (!kinds) return;
  const base = b.get(r.cx, FY - 1, r.cz);
  const name = BLOCKS[base]?.name;
  const acc = B[ACCENT[name] || ACCENT[BLOCKS[stageOf(ctx)].name]];
  const own = (x, z) => H.own(plan, r, x, z);
  const lay = (x, z, id) => {
    if (!own(x, z) || isUp(ctx, x, z) || BLOCKS[b.get(x, FY - 1, z)].name !== BLOCKS[base].name) return;
    b.set(x, FY - 1, z, id);
  };
  const kind = rng.pick(kinds);
  if (kind === 'band') {
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (!own(x, z)) continue;
        // (A pace in from the walls: its own, with a wall beside its
        // outer neighbour.)
        const edge = (q) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => !own(q.x + ox, q.z + oz));
        if (edge({ x, z })) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([ox, oz]) => own(x + ox, z + oz) && edge({ x: x + ox, z: z + oz }))) lay(x, z, acc);
      }
    }
  } else if (kind === 'cross') {
    for (let x = r.x0 + 1; x < r.x1; x++) lay(x, r.cz, acc);
    for (let z = r.z0 + 1; z < r.z1; z++) lay(r.cx, z, acc);
  }
  if (kind === 'medallion' || kind === 'cross') {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) lay(r.cx + dx, r.cz + dz, dx || dz ? acc : B.an_ouroboros);
  }
}
const SOLID = new Set(['an_candles', 'an_jars', 'an_alembic', 'an_lectern', 'an_armillary', 'an_saltman', 'an_column', 'an_tree', 'an_coal']);
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
  inlay(ctx, H, r);
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
const MOVABLE = new Set(['an_candles', 'an_jars', 'an_alembic', 'an_table', 'an_lectern', 'an_armillary', 'an_saltman', 'an_tree', 'an_column', 'an_coal', 'candles', 'glass_lamp', 'crucible', 'bookshelf', 'glow_crystal', 'marble_column', 'statue', 'steam_vent', 'glass'].map((k) => B[k]).filter((v) => v !== undefined));
function openUp(ctx, H, r) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  const hi = (x, z) => (ctx.ledge?.has(key(ctx, x, z)) ? 2 : ctx.lifted?.has(key(ctx, x, z)) ? 1 : ctx.sunk?.has(key(ctx, x, z)) ? -1 : 0);
  const blocked = (x, z) => {
    const y = FY + Math.max(0, hi(x, z));
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
  out.specula = (out.specula || []).filter((q) => at(q.seal) === B.an_seal && at(q.lamp) === B.an_sunlamp && q.mirrors.every((m) => at(m) === B.an_mirror));
  out.tables = (out.tables || []).filter((q) => at(q) === B.an_transmute);
  out.athanors = (out.athanors || []).filter((q) => at(q, FY + 1) === B.an_athanor);
  out.vats = (out.vats || []).map((g) => ({ ...g, vats: g.vats.filter((q) => at(q) === B.an_vat) })).filter((g) => g.vats.length);
  out.lore = (out.lore || []).filter((q) => [FY, FY + 1, FY + 2].some((y) => BLOCKS[at(q, y)]?.interact === 'lore'));
}

export const ATHANOR_ARCH = {
  own: ATHANOR_OWN,
  kits,
  // (The laboratorium never lost to the way down.)
  keep: new Set(['laboratorium', 'speculum']),
  spare: (rng, n, have = []) => {
    const pool = [['laboratorium', 2], ['distillery', 1], ['library', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'laboratorium';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const ATHANOR_THINGS = ['an_athanor', 'an_alembic', 'an_table', 'an_vat', 'an_mirror', 'an_sunlamp', 'an_lectern', 'an_armillary', 'an_tree', 'an_saltman', 'an_column', 'an_fountain', 'an_transmute', 'an_candles', 'an_coal', 'an_jars'].filter((k) => BLOCKS[B[k]]);
