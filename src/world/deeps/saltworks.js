// (Round 106) The Salt Cathedral, made over: Saltmere's oldest salt
// workings, dug down and down in the service of the Salt Mother until the
// miners were carving chapels instead of cutting salt; and then the brine
// came up through the floor. Rock salt in its bands, grey and white and
// pink; carved smooth and glittering where they made it holy, raw and
// pick-marked where they cut it; the timber that holds the roof up greyed
// by the salt; chandeliers of crystal; and under it all the brine (see
// game/saltwork.js: wade it and the salt grows on you; the chandeliers
// fall when their ropes are slipped; the singing crystals ring; the lake
// drains when the treadwheel's walked). Large and high: the chapel's dais
// up carved steps, the workings' gallery up salt stairs, the shaft's loft
// up a ladder, the lake sunk below.
//
// A floor of it, beside the old rooms (the crystals, the brine pool, the
// shrine, the pillared hall, the gallery, the traps, the treasure, the
// guard), and what its own rooms are:
//   the chapel: the miners' church carved in the salt: slabs, pews in rows
//     either side of the aisle, the dais at its head up its steps with the
//     altar and the Mother carved over it, reliefs and niches in the wall,
//     chandeliers hung on ropes tied off at the wall; the dead at prayer;
//   the lake: the brine lake sunk across the room, a walkway of planks over
//     it, the miners' boat drawn up, the treadwheel and the sluice, the
//     arch at its end flooded to its roof (the lower chapel behind it);
//     the pale flamingos wading;
//   the workings: the face: timber posts, cribbing, cut blocks, carts,
//     tools; a gallery up salt stairs along its back with the gang's
//     stash; the tally-book; the rakers at work;
//   the shaft: where the salt went up: the hoist's wheel, a loft up a
//     ladder with the stash, lamps; the Salt Office's decree;
//   the pans: where the brine was boiled for salt: the pans on their
//     hearths, a channel of brine, sacks; scorpions, a bloom;
//   the crystals: the singing hall: the great crystals, a floor of crystal,
//     what the blooms have grown; and the chapel the miners bricked up.
// About the floor: its papers (see deeps/saltlore.js) made from the
// workings' own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { saltLore } from './saltlore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['workings', 2], ['chapel', 1], ['lake', 1], ['shaft', 1], ['pans', 1], ['crystals', 1], ['singing', 1], ['brinepool', 1], ['shrine', 1], ['pillared', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['chapel', 'lake', 'shaft', 'pans', 'singing', 'crystals', 'brinepool', 'shrine', 'pillared', 'trap', 'treasure']);
export const SALT_OWN = new Set(['chapel', 'lake', 'workings', 'shaft', 'pans', 'singing']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: its hall at the head of the list.)
  if (last) out.push('boss');
  // The workings on every floor; the chapel on the first and now and then
  // after; the lake or the pans; the shaft or the singing hall.
  out.push('workings');
  if (n === 0 || rng.chance(0.45)) out.push('chapel');
  out.push(rng.pick(['lake', 'pans']));
  out.push(rng.pick(['shaft', 'singing']));
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
  chapel: [[15, 19], [11, 13]], lake: [[14, 17], [10, 12]], workings: [[13, 16], [9, 11]], shaft: [[10, 12], [9, 10]],
  pans: [[12, 14], [8, 10]], singing: [[12, 14], [9, 11]],
};
const SHAPES = { chapel: ['rect'], lake: ['rect', 'octagon'], workings: ['rect'], shaft: ['rect'], pans: ['rect'], singing: ['rect', 'octagon'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6b04) % list.length] : null;
};
const Lof = (ctx) => ctx.saltLore || (ctx.saltLore = saltLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
// The tiles of a blob about (cx, cz), clear, off the walls.
function blobOf(ctx, H, r, cx, cz, rx, rz) {
  return tilesOf(ctx, H, r).filter((t) => ((t.x - cx) / rx) ** 2 + ((t.z - cz) / rz) ** 2 <= 1 && !H.byWall(ctx.plan, t.x, t.z));
}
// The north wall's faces given over to the place's own now and then: a
// relief, a niche with its votive, the cribbing, a vein, a seep.
function faces(ctx, r, list, p) {
  for (const w of northWall(ctx, r)) {
    if (!ctx.rng.chance(p)) continue;
    face(ctx, w, ctx.rng.weighted(list), ctx.rng.int(0, 1));
  }
}
// A brine pit: the tiles sunk, brine in them (it crusts whoever wades it).
function brinePit(ctx, H, tiles, list = 'brine') {
  for (const t of tiles) {
    sink(ctx, H, t.x, t.z, B.sw_brine);
    (ctx.out[list] ||= []).push(abs(ctx, t));
  }
}
// A chandelier hung over (x, z), its rope tied off at an iron ring in the
// north wall nearest it (slip the rope, and down it comes).
function chandelier(ctx, H, r, x, z) {
  const { b } = ctx;
  if (!clear(ctx, H, r, x, z) || b.get(x, ctx.FY, z) !== B.air) return null;
  const ws = northWall(ctx, r).filter((w) => b.get(w.x, ctx.FY, w.z) === ctx.T.wall && ctx.plan.at(w.x, w.z + 1) && !(ctx.out.chandeliers || []).some((q) => q.cleat.x === ctx.b.x0 + w.x && q.cleat.z === w.z));
  const w = ws.sort((a, c) => Math.abs(a.x - x) - Math.abs(c.x - x))[0];
  if (!w || !face(ctx, w, B.sw_cleat, x < w.x ? 1 : 0)) return null;
  b.set(x, ctx.FY, z, B.sw_chandelier);
  const c = { ...abs(ctx, { x, z }), cleat: abs(ctx, w), room: r.id };
  (ctx.out.chandeliers ||= []).push(c);
  return c;
}
// A singing crystal grown up out of the floor (strike it, and it rings).
function singer(ctx, H, r, x, z) {
  const t = near(ctx, H, r, x, z, 2, (xx, zz) => ctx.plan.at(xx, zz + 1) && !H.byWall(ctx.plan, xx, zz));
  if (!t) return null;
  ctx.b.set(t.x, ctx.FY, t.z, B.sw_singer);
  (ctx.out.singers ||= []).push({ ...abs(ctx, t), room: r.id });
  return t;
}
// A dais (or a gallery): a run of tiles raised a step, the row behind it
// raised two (a ledge), so it's climbed as stairs.
function dais(ctx, H, r, tiles) {
  for (const t of tiles) raise(ctx, H, t.x, t.z, B.sw_step, t.h || 1);
}

// --------------------------------------------------------------- the rooms
// The chapel: slabs; the dais at its head (its north end) up a step, the
// altar on it and the Mother carved behind; pews in rows down either side
// of the aisle; reliefs and niches in the walls; chandeliers on ropes; the
// dead at prayer.
function chapel(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_slabs);
  faces(ctx, r, [[B.sw_relief, 3], [B.sw_niche, 2]], 0.55);
  // The dais: the north row and the one before it, the middle of the room.
  const top = r.z0 + (ctx.plan.at(r.cx, r.z0) ? 0 : 1);
  const span = Math.min(3, Math.floor((r.x1 - r.x0) / 4));
  const back = [];
  const fore = [];
  for (let x = r.cx - span; x <= r.cx + span; x++) {
    if (clear(ctx, H, r, x, top)) back.push({ x, z: top });
    if (clear(ctx, H, r, x, top + 1)) fore.push({ x, z: top + 1 });
  }
  if (back.length >= 3 && fore.length >= 3) {
    dais(ctx, H, r, [...back, ...fore]);
    const m = back.find((t) => t.x === r.cx) || back[Math.floor(back.length / 2)];
    b.set(m.x, FY + 1, m.z, B.sw_mother);
    lore(ctx, m.x, m.z, L.carving());
    const a = fore.find((t) => t.x === m.x) || fore[Math.floor(fore.length / 2)];
    b.set(a.x, FY + 1, a.z, B.sw_altar, META_STATE);
    lore(ctx, a.x, a.z, L.hymn());
    for (const t of [back[0], back[back.length - 1]]) b.set(t.x, FY + 1, t.z, B.sw_votive);
  }
  // The pews: rows facing the altar, either side of the aisle, a pace off
  // the side walls; benches three long, a gap between (three rows at most).
  const rows = [];
  for (let z = top + 3; z <= r.z1 - 2 && rows.length < 3; z += 2) rows.push(z);
  for (const z of rows) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const x = r.cx + side * (2 + k);
        if (k % 4 === 3) continue;
        if (x <= r.x0 + 1 || x >= r.x1 - 1) break;
        if (clear(ctx, H, r, x, z) && ctx.plan.at(x, z + 1) && b.get(x, FY, z) === B.air) b.set(x, FY, z, B.sw_pew, 0);
      }
    }
  }
  // The chandeliers over the aisles between the rows, a rope to each.
  const gaps = rows.map((z) => z + 1).filter((z) => z < r.z1);
  if (gaps.length) {
    const g0 = gaps[Math.min(gaps.length - 1, Math.floor(gaps.length / 2))];
    chandelier(ctx, H, r, r.cx - Math.max(3, span + 1), g0);
    chandelier(ctx, H, r, r.cx + Math.max(3, span + 1), g0);
    if (gaps.length > 2 && rng.chance(0.6)) chandelier(ctx, H, r, r.cx, gaps[0]);
  }
  const s = place(ctx, H, r, B.sw_dead, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.prayer());
  // The dead at prayer, and one with a rake at the back.
  band(ctx, H, r, ['salt_wight', 'salt_wight'], { x: r.cx - 3, z: gaps[0] ?? r.cz }, 'prayer', { dormant: 4 });
  band(ctx, H, r, rng.chance(0.6) ? ['salt_raker', 'salt_wight'] : ['salt_wight'], { x: r.cx + 3, z: r.z1 - 1 }, 'nave');
}
// The lake: brine sunk across the room but a bank round it; a walkway of
// planks over it; the boat drawn up; the treadwheel on the bank, the
// sluice in the wall by it; the arch at its end flooded to its roof, the
// lower chapel and its chest behind; the flamingos.
function lake(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_crust);
  faces(ctx, r, [[B.sw_seep, 3], [B.sw_vein, 1]], 0.35);
  // The flooded arch (dug first, so the lake keeps clear of its door).
  const pk = pocket(ctx, H, r, B.sw_rock);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.sw_flooded);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.sw_slabs);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['salt', rng.int(4, 9)], ['gem', rng.int(1, 2)], ['mothers_tear', 1]], H.foundIn(ctx, false)));
    const side = pk.cells.find((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (side) b.set(side.x, FY, side.z, B.sw_votive);
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    out.arches = [...(out.arches || []), { ...abs(ctx, pk.door), room: r.id }];
  }
  // The lake: an oval over the middle, off the walls, a bank round it.
  const rx = Math.max(2.2, (r.x1 - r.x0) / 2 - 2.2);
  const rz = Math.max(1.6, (r.z1 - r.z0) / 2 - 2);
  const pit = blobOf(ctx, H, r, r.cx, r.cz, rx, rz);
  // The walkway across it, east and west, its middle row.
  const walk = new Set(pit.filter((t) => t.z === r.cz).map((t) => `${t.x},${t.z}`));
  const lakeTiles = pit.filter((t) => !walk.has(`${t.x},${t.z}`));
  brinePit(ctx, H, lakeTiles, 'lake');
  for (const t of pit) if (walk.has(`${t.x},${t.z}`)) floorAt(ctx, t.x, t.z, B.sw_planks);
  // The treadwheel on the bank by the north wall, the sluice in the wall
  // beside it; the brine-reeve's notes by it.
  const bank = tilesOf(ctx, H, r).filter((t) => ctx.plan.at(t.x, t.z + 1) && !H.byWall(ctx.plan, t.x, t.z + 1));
  const wh = near(ctx, H, r, r.x0 + 2, r.z0 + 1, 3, (x, z) => ctx.plan.at(x, z + 1) && !ctx.sunk?.has(key(ctx, x, z + 1)));
  if (wh) {
    b.set(wh.x, FY, wh.z, B.sw_wheel);
    (out.wheels ||= []).push({ ...abs(ctx, wh), room: r.id, lake: true });
    const sl = northWall(ctx, r).sort((a, c) => Math.abs(a.x - wh.x - 1) - Math.abs(c.x - wh.x - 1))[0];
    if (sl) face(ctx, sl, B.sw_sluice);
    const lg = near(ctx, H, r, wh.x + 2, wh.z, 2, (x, z) => ctx.plan.at(x, z + 1));
    if (lg) {
      b.set(lg.x, FY, lg.z, B.sw_ledger);
      lore(ctx, lg.x, lg.z, L.reeve());
    }
  }
  // The boat drawn up on the bank, an oar in it.
  const bt = bank.find((t) => t.z >= r.cz + 1 && !isUp(ctx, t.x, t.z) && b.get(t.x, FY, t.z) === B.air && Math.abs(t.x - r.cx) > 2);
  if (bt) b.set(bt.x, FY, bt.z, B.sw_boat, rng.int(0, 1));
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.sw_lamp, META_STATE | rng.int(0, 1), true);
  // The flamingos on the bank by the water, still; the scorpions.
  band(ctx, H, r, ['pale_flamingo', 'pale_flamingo', 'pale_flamingo'], { x: r.cx + 2, z: r.z1 - 1 }, 'flock', { dormant: 0, peaceful: true });
  if (rng.chance(0.6)) band(ctx, H, r, ['brine_scorpion'], { x: r.x1 - 2, z: r.cz }, 'bank');
}
// The workings: the face; timber posts in rows, cribbing on the walls;
// cut blocks, carts, sacks, tools; a gallery along the back up salt
// stairs, the gang's stash on it; the tally-book; the rakers.
function workings(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_floor);
  faces(ctx, r, [[B.sw_crib, 3], [B.sw_tally, 1], [B.sw_seep, 1]], 0.45);
  // The gallery: the back row raised two, the stair up to it a step at
  // one end.
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const run = longestRun(row0, S.along).slice(0, 6);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const stairAt = run.length >= 4 ? [run[0], run[run.length - 1]].find((t) => clear(ctx, H, r, front(t).x, front(t).z)) : null;
  if (stairAt) {
    dais(ctx, H, r, run.map((t) => ({ ...t, h: 2 })));
    const st = front(stairAt);
    dais(ctx, H, r, [{ ...st, h: 1 }]);
    const far = stairAt === run[0] ? run[run.length - 1] : run[0];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.4, ctx.T), ['salt', rng.int(3, 8)], ['old_coin', rng.int(3, 8)]], H.foundIn(ctx, false)));
    // (Nothing else up there: it's a pace wide, and the way to the stash.)
  }
  // The posts holding the roof, in two rows.
  for (const fz of [r.cz - 1, r.cz + 2]) {
    for (let x = r.x0 + 3; x <= r.x1 - 3; x += 4) {
      const t = near(ctx, H, r, x, fz, 1, (xx, zz) => ctx.plan.at(xx, zz + 1) && !H.byWall(ctx.plan, xx, zz));
      if (t) b.set(t.x, FY, t.z, B.sw_post);
    }
  }
  for (const [id, n] of [[B.sw_blocks, 2], [B.sw_cart, 1], [B.sw_tools, 1], [B.sw_sacks, 1]]) for (let i = 0; i < n; i++) place(ctx, H, r, id, rng.int(0, 1), true);
  const lg = place(ctx, H, r, B.sw_ledger, 0);
  if (lg) lore(ctx, lg.x, lg.z, L.tally());
  place(ctx, H, r, B.sw_lamp, META_STATE | rng.int(0, 1), true);
  band(ctx, H, r, ['salt_raker', rng.chance(0.5) ? 'salt_raker' : 'salt_wight'], { x: r.cx, z: r.cz }, 'face');
  if (rng.chance(0.6)) band(ctx, H, r, ['salt_bloom'], { x: r.x1 - 3, z: r.z1 - 1 }, 'bloom', { dormant: 0 });
}
// The shaft: where the salt went up: the hoist's wheel; a loft along the
// back up a ladder with the stash; the decree; lamps; posts.
function shaft(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_floor);
  faces(ctx, r, [[B.sw_crib, 3], [B.sw_tally, 1]], 0.5);
  // The loft (as the gut's ledge: along the back, a ladder up its middle).
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const ledge = longestRun(row0, S.along).slice(0, 5);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const li = ledge.length >= 3 ? [1, 2].find((i) => i < ledge.length - 1 && clear(ctx, H, r, front(ledge[i]).x, front(ledge[i]).z)) : undefined;
  if (li !== undefined) {
    for (const t of ledge) raise(ctx, H, t.x, t.z, B.sw_crib, 2);
    const lt = ledge[li];
    const far = li > (ledge.length - 1) / 2 ? ledge[0] : ledge[ledge.length - 1];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), ['salt', rng.int(2, 6)], ['gold_ore', rng.int(1, 2)]], H.foundIn(ctx, false)));
    const bx = ledge.find((t) => t !== far && t !== lt);
    if (bx) b.set(bx.x, FY + 2, bx.z, B.sw_sacks, rng.int(0, 1));
    const { x: lx, z: lz } = front(lt);
    const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
    for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.sw_ladder, d);
    ctx.reserved.add(key(ctx, lx, lz));
  }
  // The hoist's wheel in the middle, its rope long since snapped; carts
  // waiting by it.
  const wh = near(ctx, H, r, r.cx, r.cz, 1, (x, z) => ctx.plan.at(x, z + 1));
  if (wh) {
    b.set(wh.x, FY, wh.z, B.sw_wheel);
    (out.wheels ||= []).push({ ...abs(ctx, wh), room: r.id, lake: false });
  }
  const c1 = near(ctx, H, r, r.cx + 2, r.cz + 1, 1);
  if (c1) b.set(c1.x, FY, c1.z, B.sw_cart, 1);
  const dc = place(ctx, H, r, B.sw_ledger, 0);
  if (dc) lore(ctx, dc.x, dc.z, L.decree());
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.sw_lamp, META_STATE | rng.int(0, 1), true);
  place(ctx, H, r, B.sw_post, 0, true);
  band(ctx, H, r, rng.chance(0.5) ? ['salt_wight', 'salt_raker'] : ['salt_wight', 'salt_wight'], { x: r.cx - 2, z: r.z1 - 1 }, 'hoist');
}
// The pans: where the brine was boiled for salt: the pans on their
// hearths in a row, lit; a channel of brine along the floor to them;
// sacks; scorpions and a bloom.
function pans(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_brick);
  faces(ctx, r, [[B.sw_seep, 2], [B.sw_niche, 1]], 0.35);
  // The pans along the middle.
  for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
    const t = near(ctx, H, r, x, r.cz - 1, 1, (xx, zz) => ctx.plan.at(xx, zz + 1) && !H.byWall(ctx.plan, xx, zz));
    if (t) b.set(t.x, FY, t.z, B.sw_pan, META_STATE);
  }
  // The channel: a row of brine sunk along the south side.
  const z = r.cz + 2 <= r.z1 - 1 ? r.cz + 2 : r.cz + 1;
  brinePit(ctx, H, tilesOf(ctx, H, r).filter((t) => t.z === z && t.x > r.x0 + 1 && t.x < r.x1 - 1 && !H.byWall(ctx.plan, t.x, t.z)));
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.sw_sacks, rng.int(0, 1), true);
  place(ctx, H, r, B.sw_blocks, rng.int(0, 1), true);
  const s = place(ctx, H, r, B.sw_dead, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.letter());
  band(ctx, H, r, ['brine_scorpion', 'brine_scorpion'], { x: r.cx, z: z }, 'channel');
  band(ctx, H, r, ['salt_bloom'], { x: r.x0 + 2, z: z }, 'bloom', { dormant: 0 });
}
// The singing hall: a floor of crystal; the great crystals that ring;
// growth; veins in the walls; the chapel the miners bricked up behind
// one of them; the blooms and the dead.
function singing(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.sw_floor);
  floorAll(ctx, H, r, B.sw_crystalfloor, (x, z) => ((x - r.cx) / 3.4) ** 2 + ((z - r.cz) / 2.4) ** 2 <= 1);
  faces(ctx, r, [[B.sw_vein, 3]], 0.4);
  // The bricked chapel (dug first, so the crystals keep clear of its door).
  const pk = pocket(ctx, H, r, B.sw_rock);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.sw_bricked);
    for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.sw_slabs);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.7, ctx.T), ['gem', rng.int(1, 3)], ['mothers_tear', 1], ['old_coin', rng.int(4, 9)]], H.foundIn(ctx, false)));
    const cells = pk.cells.filter((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (cells[0]) {
      b.set(cells[0].x, FY, cells[0].z, B.sw_dead, 0);
      lore(ctx, cells[0].x, cells[0].z, L.story());
    }
    if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.sw_votive);
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.bricks ||= []).push({ ...abs(ctx, pk.door), room: r.id });
  }
  singer(ctx, H, r, r.cx - 3, r.cz);
  singer(ctx, H, r, r.cx + 3, r.cz);
  for (let i = 0; i < 4; i++) place(ctx, H, r, B.sw_growth, rng.int(0, 1), true);
  const s = place(ctx, H, r, B.sw_dead, rng.int(0, 1));
  if (s) lore(ctx, s.x, s.z, L.dead());
  band(ctx, H, r, ['salt_bloom', 'salt_bloom'], { x: r.cx, z: r.cz + 1 }, 'blooms', { dormant: 0 });
  band(ctx, H, r, ['salt_wight', 'salt_wight'], { x: r.cx, z: r.z1 - 1 }, 'listening');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'chapel':
      return chapel(ctx, H, r);
    case 'lake':
      return lake(ctx, H, r);
    case 'workings':
      return workings(ctx, H, r);
    case 'shaft':
      return shaft(ctx, H, r);
    case 'pans':
      return pans(ctx, H, r);
    case 'singing':
      return singing(ctx, H, r);
  }
}

// What the old rooms set about, the cathedral's own instead: the crystals
// (growth), candles (votives), carts, barrels and crates (sacks), the dead
// (white with salt), rubble (cut blocks), statues (the Mother carved).
const OWN_OF = new Map([[B.salt_crystal, B.sw_growth], [B.candles, B.sw_votive], [B.mine_cart, B.sw_cart], [B.barrel, B.sw_sacks], [B.crate, B.sw_sacks], [B.bones, B.sw_dead], [B.skull_pile, B.sw_dead], [B.rubble, B.sw_blocks], [B.statue, B.sw_mother]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.sw_votive);
        continue;
      }
      // (The old salt-brick pillars: rock salt, carved.)
      if (id === B.salt_brick && H.own(ctx.plan, r, x, z)) {
        for (const y of [H.FY, H.FY + 1]) if (b.get(x, y, z) === B.salt_brick) b.set(x, y, z, B.sw_rock);
        continue;
      }
      if (b.get(x, H.FY - 1, z) === B.mud) b.set(x, H.FY - 1, z, B.sw_crust);
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
      // On the first floor, a votive where they came down, and a letter.
      if (ctx.n === 0) {
        const s = place(ctx, H, r, B.sw_dead, 0);
        if (s) lore(ctx, s.x, s.z, L.letter());
      }
      for (const w of northWall(ctx, r)) if (rng.chance(0.35)) face(ctx, w, B.sw_niche, rng.int(0, 1));
      const n = northWall(ctx, r).find((w) => b.get(w.x, FY, w.z) === B.sw_niche);
      if (n) lore(ctx, n.x, n.z, L.votive());
      break;
    }
    case 'brinepool': {
      // The old pool of water: brine, sunk in the floor.
      const pool = [];
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (b.get(x, FY, z) === B.water) pool.push({ x, z });
      for (const t of pool) b.set(t.x, FY, t.z, B.air);
      brinePit(ctx, H, pool);
      floorAll(ctx, H, r, B.sw_crust);
      break;
    }
    case 'crystals':
      floorAll(ctx, H, r, B.sw_crystalfloor, (x, z) => ((x - r.cx) / 3) ** 2 + ((z - r.cz) / 2) ** 2 <= 1);
      if (rng.chance(0.5)) singer(ctx, H, r, r.cx, r.cz);
      break;
    case 'shrine':
      floorAll(ctx, H, r, B.sw_slabs);
      for (const w of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, w, rng.chance(0.5) ? B.sw_relief : B.sw_niche, rng.int(0, 1));
      {
        const t = place(ctx, H, r, B.sw_altar, META_STATE);
        if (t) lore(ctx, t.x, t.z, L.hymn());
      }
      break;
    case 'treasure':
      floorAll(ctx, H, r, B.sw_slabs);
      break;
    case 'boss': {
      // The master's hall: slabs, reliefs and niches, chandeliers on their
      // ropes, a singing crystal either side, brine sunk in the corners;
      // the hall's own word cut in a relief by it.
      floorAll(ctx, H, r, B.sw_slabs);
      for (const q of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, q, rng.chance(0.6) ? B.sw_relief : B.sw_niche, rng.int(0, 1));
      chandelier(ctx, H, r, r.cx - 3, r.cz);
      chandelier(ctx, H, r, r.cx + 3, r.cz);
      singer(ctx, H, r, r.x0 + 2, r.cz + 1);
      singer(ctx, H, r, r.x1 - 2, r.cz + 1);
      for (const [cx, cz] of [[r.x0 + 2, r.z1 - 1], [r.x1 - 2, r.z1 - 1]]) brinePit(ctx, H, blobOf(ctx, H, r, cx, cz, 1.5, 1.1).filter((t) => Math.abs(t.x - r.cx) > 3));
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.sw_relief)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the cathedral's things, spaced out; the walls
// given their faces now and then; the floors as they lie.
const DECOR = {
  entry: [['sw_votive', 1], ['sw_sacks', 1]],
  exit: [['sw_votive', 1], ['sw_lamp', 1]],
  crystals: [['sw_growth', 2], ['sw_dead', 1]],
  brinepool: [['sw_growth', 1], ['sw_boat', 1]],
  shrine: [['sw_votive', 2], ['sw_pew', 1]],
  pillared: [['sw_post', 1], ['sw_votive', 1], ['sw_lamp', 1]],
  gallery: [['sw_votive', 1], ['sw_pew', 1], ['sw_lamp', 1]],
  trap: [['sw_dead', 1]],
  treasure: [['sw_blocks', 1], ['sw_votive', 1]],
  guard: [['sw_tools', 1], ['sw_sacks', 1]],
  chapel: [['sw_votive', 1]],
  lake: [['sw_growth', 1]],
  workings: [['sw_sacks', 1]],
  shaft: [['sw_blocks', 1]],
  pans: [['sw_sacks', 1]],
  singing: [['sw_growth', 1]],
};
const SOLID = new Set(['sw_lamp', 'sw_post', 'sw_sacks', 'sw_blocks', 'sw_tools', 'sw_boat', 'sw_growth', 'sw_pew']);
const STATE = new Set(['sw_lamp']);
const OLD_FLOOR = { entry: B.sw_floor, exit: B.sw_floor, guard: B.sw_floor, crystals: B.sw_floor, trap: B.sw_crust, pillared: B.sw_slabs, gallery: B.sw_slabs, collapsed: B.sw_crust };
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
  if (!SALT_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.06) face(ctx, w, B.sw_crib, rng.int(0, 1));
      else if (p < 0.1) face(ctx, w, B.sw_vein, rng.int(0, 1));
      else if (p < 0.13) face(ctx, w, B.sw_niche, rng.int(0, 1));
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

// Its architect's last word: the brine, the chandeliers, the singing
// crystals, the treadwheels, the flooded arches and the bricks still where
// they were laid.
// (Nothing set about so close it shuts a pace of floor in on every side:
// one of what shuts it in is taken away.)
const MOVABLE = new Set(['sw_growth', 'sw_sacks', 'sw_blocks', 'sw_votive', 'sw_dead', 'sw_tools', 'sw_cart', 'sw_pew', 'sw_lamp', 'sw_post', 'sw_boat', 'sw_shards'].map((k) => B[k]));
function unbox(ctx) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const solid = (x, z) => !!BLOCKS[b.get(x, FY, z)].solid || !plan.at(x, z);
  for (let z = 1; z < ctx.D - 1; z++) {
    for (let x = 1; x < ctx.W - 1; x++) {
      if (!plan.at(x, z) || isUp(ctx, x, z) || solid(x, z)) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: x + dx, z: z + dz }));
      if (nb.some((q) => !solid(q.x, q.z) || isUp(ctx, q.x, q.z))) continue;
      const q = nb.find((t) => plan.at(t.x, t.z) && MOVABLE.has(b.get(t.x, FY, t.z)));
      if (q) b.set(q.x, FY, q.z, B.air);
    }
  }
}
// (Nor so thick in a room, the old crystals grown across it, that some of
// its floor can't be got to from its doors: what's in the way, cleared, a
// thing at a time, till it can.)
function openUp(ctx, H, r) {
  const { b, plan } = ctx;
  const FY = ctx.FY;
  const W = ctx.W;
  const hi = (x, z) => (ctx.ledge?.has(key(ctx, x, z)) ? 2 : ctx.lifted?.has(key(ctx, x, z)) ? 1 : ctx.sunk?.has(key(ctx, x, z)) ? -1 : 0);
  const blocked = (x, z) => {
    const h = hi(x, z);
    const y = FY + Math.max(0, h);
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
    // A floor tile shut off, and the thing beside it that's in the way.
    let cut = null;
    for (let z = r.z0; z <= r.z1 && !cut; z++) {
      for (let x = r.x0; x <= r.x1 && !cut; x++) {
        if (!H.own(plan, r, x, z) || seen.has(z * W + x) || blocked(x, z) || hi(x, z) === 2) continue;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = { x: x + ox, z: z + oz };
          const id = b.get(t.x, FY, t.z);
          // (In the old rooms, their statue or their altar too, if need be.)
          if (H.own(plan, r, t.x, t.z) && hi(t.x, t.z) === 0 && (MOVABLE.has(id) || (!SALT_OWN.has(r.kit) && (id === B.sw_mother || id === B.sw_altar)))) {
            cut = t;
            break;
          }
        }
      }
    }
    if (!cut) return;
    b.set(cut.x, FY, cut.z, B.air);
  }
}
function after(ctx, H) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  unbox(ctx);
  if (H) for (const r of ctx.plan.rooms) if (r.kit !== 'hidden' && !r.sealed) openUp(ctx, H, r);
  const at = (q, y = FY) => b.get(q.x - b.x0, y, q.z);
  out.brine = (out.brine || []).filter((q) => at(q, FY - 2) === B.sw_brine);
  out.lake = (out.lake || []).filter((q) => at(q, FY - 2) === B.sw_brine);
  out.chandeliers = (out.chandeliers || []).filter((q) => at(q) === B.sw_chandelier && at(q.cleat) === B.sw_cleat);
  out.singers = (out.singers || []).filter((q) => at(q) === B.sw_singer);
  out.wheels = (out.wheels || []).filter((q) => at(q) === B.sw_wheel);
  out.arches = (out.arches || []).filter((q) => at(q) === B.sw_flooded);
  out.bricks = (out.bricks || []).filter((q) => at(q) === B.sw_bricked);
}

export const SALT_ARCH = {
  own: SALT_OWN,
  kits,
  // (The workings and the chapel never lost to the way down.)
  keep: new Set(['workings', 'chapel']),
  spare: (rng, n, have = []) => {
    const pool = [['workings', 2], ['crystals', 1], ['brinepool', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'workings';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const SALT_THINGS = ['sw_chandelier', 'sw_shards', 'sw_pew', 'sw_altar', 'sw_mother', 'sw_votive', 'sw_post', 'sw_cart', 'sw_blocks', 'sw_sacks', 'sw_tools', 'sw_wheel', 'sw_lamp', 'sw_ladder', 'sw_ledger', 'sw_dead', 'sw_pan', 'sw_boat', 'sw_singer', 'sw_growth'].filter((k) => BLOCKS[B[k]]);
