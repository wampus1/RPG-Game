// (Round 111) The Hall of the Last Champion, made over: a hero's barrow in
// the hills of Velmarch, a memorial and a prison at once, where his
// companions sealed him in while he could still beg them to. Solemn and
// grand, gone to grief: pale sandstone in long courses, carved friezes of
// the old wars, bronze and old gold, his banners faded, laurels, candles
// still burning and the folk's flowers at the door. Long processional
// halls with alcoves and a raised gallery along them; and it goes down
// through what it was, a floor each: the Hall of Honours (the memorial,
// whole, the red runner down its halls), the Hall of Trials (where they
// made their last stand: cracked flags, barricades, the fallen), and the
// Sealed Barrow (the curse growing out of the cracks). See
// game/championwork.js for the oath (the kneeling-stones, knelt at in the
// order of his oath, open the oath-door), the wards (the cracked ones leak
// the curse; kneel and hold one to seal it), the memorials (an offering
// left, a blessing), and the keeners; game/ancient.js for the old works
// (the trials, the statues that swing their swords, the blades, the
// tombs, the reliquaries, the arena), kept in their rooms.
//
// A floor of it, beside the old rooms, and what its own rooms are:
//   the hall of honours: a nave, its red runner down the middle, columns
//     in pairs, a gallery raised along its back wall (a step up at each
//     end) with the heroes of the old wars on it, his banners and the
//     friezes of his wars on the walls; squires below, a shade with a bow
//     up on the gallery;
//   the feast-hall: the Company's long table and its benches, the hearth
//     at its end, shields on the walls; the shades still at the table;
//   the oath chapel: the oath book, the kneeling-stones of his virtues,
//     the bronze oath-door in its back wall and his cache behind it;
//   the barracks: the squires' cots, armour on its stands, the training
//     dummies, a rack of arms; the squires asleep;
//   the wound: where the curse broke out of the stone, growing over the
//     floor from the cracked wall, and the ward-stones round it, some
//     cracked; the curselings;
//   the hall of the fallen: memorial stones in rows, the folk's flowers,
//     candles; a keener kneeling.
// About the floor: its papers (see deeps/championlore.js), and what it
// was.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { championLore } from './championlore.js';
import { key, raise, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, frameOf, longestRun } from './common.js';

const POOL = [['hall', 2], ['feast', 1], ['oath', 1], ['barracks', 1], ['wound', 1], ['memorial', 1], ['trial', 1], ['armory', 1], ['statues', 1], ['blades', 1], ['chapel', 1], ['tomb', 1], ['reliquary', 1], ['arena', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['feast', 'oath', 'barracks', 'wound', 'memorial', 'trial', 'armory', 'statues', 'blades', 'chapel', 'tomb', 'reliquary', 'arena', 'trap', 'treasure']);
export const CHAMPION_OWN = new Set(['hall', 'feast', 'oath', 'barracks', 'wound', 'memorial']);
// What each floor was: its floor.
export const STAGE_FLOOR = ['ch_flags', 'ch_cracked', 'ch_cracked'];
const stageOf = (ctx) => B[STAGE_FLOOR[Math.min(ctx.n, 2)]];

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The hall of honours on every floor; the oath chapel on the first and
  // now and then after; the feast-hall or the barracks; the hall of the
  // fallen on the first; the wound, deeper down, where the curse is.
  out.push('hall');
  if (n === 0 || rng.chance(0.45)) out.push('oath');
  out.push(rng.pick(['feast', 'barracks']));
  if (n === 0 || rng.chance(0.35)) out.push('memorial');
  if (n >= 1 || rng.chance(0.3)) out.push('wound');
  // And one of the old works of the place on every floor (see
  // game/ancient.js): a trial, the statues, the blades, the tombs, the
  // arena.
  out.push(rng.pick(['trial', 'statues', 'statues', 'blades', 'tomb', 'arena', 'reliquary']));
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
  hall: [[17, 20], [9, 10]], feast: [[13, 15], [9, 10]], oath: [[11, 13], [10, 11]], barracks: [[12, 14], [9, 10]],
  wound: [[12, 14], [11, 12]], memorial: [[12, 14], [10, 12]],
};
const SHAPES = { hall: ['rect'], feast: ['rect'], oath: ['rect'], barracks: ['rect'], wound: ['octagon', 'rect'], memorial: ['rect'] };

const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x7104) % list.length] : null;
};
const Lof = (ctx) => ctx.chLore || (ctx.chLore = championLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
// The north wall's faces, spaced: banners, friezes, plaques of the fallen
// (with their names), shields and spears, laurels.
function walls(ctx, H, r, list, p) {
  const L = Lof(ctx);
  let last = -9;
  for (const w of northWall(ctx, r)) {
    if (w.x - last < 2 || !ctx.rng.chance(p)) continue;
    const k = ctx.rng.weighted(list);
    const ok = face(ctx, w, B[k], ctx.rng.int(0, 1));
    if (ok && k === 'ch_plaque') lore(ctx, w.x, w.z, ctx.rng.chance(0.3) ? L.wars() : L.plaque());
    if (ok) last = w.x;
  }
}
// (Deeper down, the last stand and then the curse: barricades and the
// fallen about a room; the curse's growth.)
function ruin(ctx, H, r) {
  const { b, rng } = ctx;
  const L = Lof(ctx);
  if (ctx.n >= 1 && rng.chance(0.55)) {
    const t = place(ctx, H, r, B.ch_barricade, rng.int(0, 1), true);
    if (t && rng.chance(0.5)) {
      const f = place(ctx, H, r, B.ch_fallen, rng.int(0, 1), true);
      if (f) lore(ctx, f.x, f.z, L.fallen());
    }
  }
  if (ctx.n >= 2) {
    for (let k = 0; k < 2; k++) {
      const c = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(-2, 2), 2);
      if (!c) continue;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx && dz && rng.chance(0.6)) || !H.own(ctx.plan, r, c.x + dx, c.z + dz) || isUp(ctx, c.x + dx, c.z + dz)) continue;
          if (b.get(c.x + dx, H.FY - 1, c.z + dz) === stageOf(ctx)) floorAt(ctx, c.x + dx, c.z + dz, B.ch_cursed);
        }
      }
    }
    if (rng.chance(0.5)) place(ctx, H, r, B.ch_growth, rng.int(0, 1), false);
  }
}

// --------------------------------------------------------------- the rooms
// The hall of honours: the nave, its runner, its columns, its gallery.
function hall(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, stageOf(ctx));
  const Fm = frameOf(ctx, H, r);
  // The runner down its middle (worn, deeper down).
  if (ctx.n < 2) {
    for (let u = 1; u <= Fm.L - 2; u++) {
      const p = Fm.P(u, Fm.mid);
      if (H.own(ctx.plan, r, p.x, p.z) && (ctx.n === 0 || rng.chance(0.7))) floorAt(ctx, p.x, p.z, B.ch_runner);
    }
  }
  // The gallery: a ledge two deep up along the back wall, a step up at
  // each end of its front; the heroes of the old wars along the back of
  // it, a candle or two; the walk along the front of it kept clear.
  const S = backSeen(ctx, H, r);
  const row0 = [];
  for (let a = (S.along ? r.x0 : r.z0) + 2; a <= (S.along ? r.x1 : r.z1) - 2; a++) {
    const t = at2(S, a, S.back);
    const f = at2(S, a, S.back + S.out);
    const behind = at2(S, a, S.back - S.out);
    if (clear(ctx, H, r, t.x, t.z) && clear(ctx, H, r, f.x, f.z) && !byDoor(ctx, H, r, t.x, t.z, 1) && !byDoor(ctx, H, r, f.x, f.z, 1) && !ctx.plan.at(behind.x, behind.z)) row0.push(t);
  }
  const run = longestRun(row0, S.along).slice(0, 12);
  const walk = [];
  if (run.length >= 6) {
    run.forEach((t, i) => {
      const a = S.along ? t.x : t.z;
      const f = at2(S, a, S.back + S.out);
      const step = i === 0 || i === run.length - 1;
      raise(ctx, H, t.x, t.z, B.ch_dais, 2);
      raise(ctx, H, f.x, f.z, B.ch_dais, step ? 1 : 2);
      if (!step) walk.push(f);
      if (i % 3 === 1 && i < run.length - 1) b.set(t.x, FY + 2, t.z, B.ch_statue, rng.int(0, 3));
      else if (i % 3 === 2 && rng.chance(0.3)) b.set(t.x, FY + 2, t.z, B.ch_candles, 0);
    });
    const a = walk[Math.floor(walk.length / 2)];
    if (a) put(ctx, 'shade_archer', a.x, a.z, r, { dormant: 4, group: groupOf(ctx, r, 'gallery') });
  }
  // The columns, in pairs, either side of the runner, a pace in.
  for (let u = 3; u <= Fm.L - 4; u += 4) {
    for (const v of [1, Fm.Wd - 2]) {
      const p = Fm.P(u, v);
      if (clear(ctx, H, r, p.x, p.z) && !byDoor(ctx, H, r, p.x, p.z, 1) && ctx.plan.at(p.x, p.z + 1) && Math.abs(v - Fm.mid) > 1) b.set(p.x, FY, p.z, B.ch_column, 0);
    }
  }
  // Braziers at its end.
  for (const v of [Fm.mid - 2, Fm.mid + 2]) {
    const p = Fm.P(Fm.L - 2, v);
    if (clear(ctx, H, r, p.x, p.z) && ctx.plan.at(p.x, p.z + 1)) b.set(p.x, FY, p.z, B.ch_brazier, 0);
  }
  walls(ctx, H, r, [['ch_banner', 3], ['ch_frieze', 3], ['ch_plaque', 2], ['ch_arms', 1], ['ch_laurel', 1]], 0.6);
  ruin(ctx, H, r);
  band(ctx, H, r, ['oathbound_squire', 'oathbound_squire'], { x: r.cx, z: r.cz + 1 }, 'nave');
  if (ctx.n >= 1 || rng.chance(0.5)) band(ctx, H, r, ['banner_wraith'], { x: r.cx + 3, z: r.cz }, 'nave2');
}
// The feast-hall: the long table, its benches, the hearth.
function feast(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const Fm = frameOf(ctx, H, r);
  const seats = [];
  let toast = null;
  for (let u = 3; u <= Fm.L - 3; u++) {
    const p = Fm.P(u, Fm.mid);
    if (!clear(ctx, H, r, p.x, p.z)) continue;
    b.set(p.x, FY, p.z, B.ch_table, rng.int(0, 1));
    if (!toast) toast = p;
    for (const v of [Fm.mid - 1, Fm.mid + 1]) {
      const q = Fm.P(u, v);
      if ((u % 3) && clear(ctx, H, r, q.x, q.z) && !byDoor(ctx, H, r, q.x, q.z, 1)) b.set(q.x, FY, q.z, B.ch_bench, rng.int(0, 1));
      else if (clear(ctx, H, r, q.x, q.z)) seats.push(q);
    }
  }
  if (toast) lore(ctx, toast.x, toast.z, L.toast());
  // The hearth at its end.
  const h = Fm.P(Fm.L - 2, Fm.mid);
  if (clear(ctx, H, r, h.x, h.z) && !byDoor(ctx, H, r, h.x, h.z, 1)) b.set(h.x, FY, h.z, B.ch_hearth, 0);
  walls(ctx, H, r, [['ch_arms', 3], ['ch_banner', 2], ['ch_laurel', 1]], 0.6);
  ruin(ctx, H, r);
  // The shades of the Company, still at the table.
  const g = groupOf(ctx, r, 'feast');
  for (const q of rng.shuffle(seats).slice(0, 3)) put(ctx, rng.chance(0.6) ? 'oathbound_squire' : 'banner_wraith', q.x, q.z, r, { dormant: 4, group: g, rest: true });
}
// The oath chapel: the book, the kneeling-stones, the oath-door.
function oath(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  // The door in its back wall, his cache behind.
  const pk = pocket(ctx, H, r, ctx.T.wall, (w, d) => (d.z ? w.x > r.x0 + 1 && w.x < r.x1 - 1 : w.z > r.z0 + 1 && w.z < r.z1 - 1));
  if (!pk) return;
  for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.ch_oathdoor);
  for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.ch_runner);
  b.set(pk.back.x, FY, pk.back.z, B.chest, 0);
  b.container(pk.back.x, FY, pk.back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2.2, ctx.T), ['gold_ingot', rng.int(1, 3)], ['gem', rng.int(1, 2)], ['old_coin', rng.int(8, 20)]], H.foundIn(ctx, false)));
  const cells = pk.cells.filter((c) => c !== pk.back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
  if (cells[0]) {
    b.set(cells[0].x, FY, cells[0].z, B.ch_lectern, 0);
    lore(ctx, cells[0].x, cells[0].z, L.story());
  }
  if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.ch_candles, 0);
  // The kneeling-stones, in a row across the chapel three paces out from
  // the door (whichever wall it's in), set down in no order (it's in the
  // book).
  const d = pk.dir;
  const c0 = { x: pk.door.x - d.x * 3, z: pk.door.z - d.z * 3 };
  const line = [];
  for (let k = -6; k <= 6; k += 2) {
    const t = d.z ? { x: c0.x + k, z: c0.z } : { x: c0.x, z: c0.z + k };
    if (H.own(ctx.plan, r, t.x, t.z) && clear(ctx, H, r, t.x, t.z) && !byDoor(ctx, H, r, t.x, t.z, 1) && ctx.plan.at(t.x, t.z + 1)) line.push(t);
  }
  if (line.length < 4) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.air);
    return;
  }
  const mid = Math.floor((line.length - 4) / 2);
  const at = line.slice(mid, mid + 4);
  const virtues = rng.shuffle([0, 1, 2, 3]);
  const kneels = at.map((t, i) => {
    b.set(t.x, FY, t.z, B.ch_kneel, virtues[i]);
    return { ...abs(ctx, t), v: virtues[i] };
  });
  // (The way from the stones to the door kept clear.)
  for (let k = 1; k < 3; k++) ctx.reserved.add(key(ctx, pk.door.x - d.x * k, pk.door.z - d.z * k));
  out.oaths = [...(out.oaths || []), { kneels, door: abs(ctx, pk.door), order: L.oath, room: r.id }];
  // His oath, cut in bronze on the chapel's wall (or, where there's no
  // wall for it, in the book on a lectern).
  const pl = rng.shuffle(northWall(ctx, r)).find((w) => face(ctx, w, B.ch_plaque));
  if (pl) lore(ctx, pl.x, pl.z, L.oathBook());
  else {
    const lc = place(ctx, H, r, B.ch_lectern, rng.int(0, 1), true);
    if (lc) lore(ctx, lc.x, lc.z, L.oathBook());
  }
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.ch_candles, 0, true);
  walls(ctx, H, r, [['ch_banner', 2], ['ch_laurel', 2], ['ch_frieze', 1]], 0.55);
  // A keener, knelt at the stones.
  const m = near(ctx, H, r, at[1].x - d.x, at[1].z - d.z, 2);
  if (m) put(ctx, 'keener', m.x, m.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'keener') });
}
// The barracks: cots, armour, dummies, a rack.
function barracks(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, stageOf(ctx));
  const S = backSeen(ctx, H, r);
  // Cots along the back wall, a pace apart; armour stands between.
  let k = 0;
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a += 2) {
    const t = at2(S, a, S.back);
    if (!clear(ctx, H, r, t.x, t.z) || byDoor(ctx, H, r, t.x, t.z, 1) || !ctx.plan.at(t.x, t.z + 1)) continue;
    b.set(t.x, FY, t.z, k % 3 === 2 ? B.ch_armour : B.ch_cot, rng.int(0, 1));
    k++;
  }
  // The dummies in the middle, the rack by them.
  for (const dx of [-2, 2]) {
    const t = near(ctx, H, r, r.cx + dx, r.cz + 1, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
    if (t) b.set(t.x, FY, t.z, B.ch_dummy, rng.int(0, 1));
  }
  place(ctx, H, r, B.ch_rack, rng.int(0, 1), true);
  const lc = place(ctx, H, r, B.ch_lectern, rng.int(0, 1), true);
  if (lc) lore(ctx, lc.x, lc.z, Lof(ctx).diary());
  walls(ctx, H, r, [['ch_arms', 3], ['ch_banner', 1]], 0.5);
  ruin(ctx, H, r);
  band(ctx, H, r, ['oathbound_squire', 'oathbound_squire', 'oathbound_squire'], { x: r.cx, z: r.cz }, 'bunks', { rest: true });
  if (ctx.n >= 1) band(ctx, H, r, ['trial_sentinel'], { x: r.cx + 3, z: r.cz + 1 }, 'drill');
}
// The wound: the curse out of the stone, the wards round it.
function wound(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.ch_cracked);
  // The wall it broke out of.
  const nw = northWall(ctx, r).filter((w) => Math.abs(w.x - r.cx) <= 2);
  let src = { x: r.cx, z: r.z0 };
  for (const w of rng.shuffle(nw)) {
    if (face(ctx, w, B.ch_cursewall, 0)) {
      src = { x: w.x, z: w.z + 1 };
      break;
    }
  }
  // The growth, out from it over the floor.
  const R0 = 3 + Math.min(2, ctx.n);
  const tiles = [];
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z) || byDoor(ctx, H, r, x, z, 1)) continue;
      const d = Math.hypot(x - src.x, (z - src.z) * 1.1) + Math.sin(x * 1.7 + z) * 0.8;
      if (d < R0) {
        floorAt(ctx, x, z, B.ch_cursed);
        tiles.push({ x, z });
      }
    }
  }
  for (let k = 0; k < 2 + ctx.n; k++) {
    const t = near(ctx, H, r, src.x + rng.int(-2, 2), src.z + rng.int(1, 3), 2, (x, z) => ctx.plan.at(x, z + 1));
    if (t) b.set(t.x, FY, t.z, B.ch_growth, rng.int(0, 1));
  }
  // The wards round it: some sealed still, most cracked.
  const wards = [];
  const spots = [[-4, 2], [4, 2], [0, 5], [-3, 5], [3, 5]];
  for (const [dx, dz] of rng.shuffle(spots).slice(0, 3)) {
    const t = near(ctx, H, r, src.x + dx, src.z + dz, 2, (x, z) => ctx.plan.at(x, z + 1) && !byDoor(ctx, H, r, x, z, 1));
    if (!t) continue;
    const sealed = wards.length === 0 && rng.chance(0.4);
    b.set(t.x, FY, t.z, B.ch_ward, sealed ? META_STATE : 0);
    wards.push({ ...abs(ctx, t), sealed });
  }
  if (wards.length) out.wards = [...(out.wards || []), { wards, tiles: tiles.map((t) => abs(ctx, t)), src: abs(ctx, src), room: r.id }];
  const lc = place(ctx, H, r, B.ch_lectern, rng.int(0, 1), true);
  if (lc) lore(ctx, lc.x, lc.z, rng.chance(0.5) ? L.wards() : L.curse());
  band(ctx, H, r, ['curseling', 'curseling', 'curseling'], { x: src.x, z: src.z + 2 }, 'wound', { dormant: 3 });
  band(ctx, H, r, ['trial_sentinel'], { x: r.cx + 2, z: r.z1 - 2 }, 'warden');
}
// The hall of the fallen: memorials in rows, flowers, candles.
function memorial(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, stageOf(ctx));
  const list = [];
  // Rows of stones, two paces apart each way, an aisle down the middle.
  for (let z = r.z0 + 1; z <= r.z1 - 2; z += 3) {
    for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) {
      if (Math.abs(x - r.cx) <= 1 || !clear(ctx, H, r, x, z) || byDoor(ctx, H, r, x, z, 1) || !ctx.plan.at(x, z + 1)) continue;
      b.set(x, FY, z, B.ch_memorial, 0);
      list.push({ ...abs(ctx, { x, z }), lore: L.memorial() });
      if (rng.chance(0.35)) {
        const f = { x, z: z + 1 };
        if (clear(ctx, H, r, f.x, f.z) && ctx.plan.at(f.x, f.z + 1) && !byDoor(ctx, H, r, f.x, f.z, 1)) b.set(f.x, FY, f.z, B.ch_flowers, rng.int(0, 1));
      }
    }
  }
  if (list.length) out.memorials = [...(out.memorials || []), { list, room: r.id }];
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.ch_candles, 0, true);
  walls(ctx, H, r, [['ch_plaque', 3], ['ch_laurel', 2], ['ch_banner', 1]], 0.5);
  ruin(ctx, H, r);
  const m = near(ctx, H, r, r.cx, r.cz, 3);
  if (m) put(ctx, 'keener', m.x, m.z, r, { dormant: 0, peaceful: true, group: groupOf(ctx, r, 'keener') });
  if (ctx.n >= 1) band(ctx, H, r, ['banner_wraith'], { x: r.cx, z: r.z1 - 2 }, 'fallen');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'hall':
      return hall(ctx, H, r);
    case 'feast':
      return feast(ctx, H, r);
    case 'oath':
      return oath(ctx, H, r);
    case 'barracks':
      return barracks(ctx, H, r);
    case 'wound':
      return wound(ctx, H, r);
    case 'memorial':
      return memorial(ctx, H, r);
  }
}

// The old rooms, laid in the floor's own stone, their walls given faces.
const RECOLOUR = new Set(['flagstone', 'cracked_bricks', 'mossy_bricks'].map((k) => B[k]).filter((v) => v !== undefined));
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z)) continue;
      const f = b.get(x, FY - 1, z);
      if (f === ctx.T.floor || f === ctx.T.alt || RECOLOUR.has(f)) b.set(x, FY - 1, z, stageOf(ctx));
    }
  }
  switch (r.kit) {
    case 'entry': {
      // On each floor, what it was, on a plaque by the way in; the folk's
      // flowers on the first.
      const w = northWall(ctx, r).find((q) => b.get(q.x, FY, q.z) === ctx.T.wall);
      if (w && face(ctx, w, B.ch_plaque)) lore(ctx, w.x, w.z, L.hall());
      if (ctx.n === 0) for (let k = 0; k < 2; k++) place(ctx, H, r, B.ch_flowers, rng.int(0, 1), true);
      walls(ctx, H, r, [['ch_banner', 2], ['ch_laurel', 1]], 0.4);
      break;
    }
    case 'boss': {
      // His barrow: the curse over its floor, his word on the plaque.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && rng.chance(0.35)) b.set(x, FY - 1, z, B.ch_cursed);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) <= 3 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.ch_plaque)) lore(ctx, c.x, c.z, L.last());
      walls(ctx, H, r, [['ch_cursewall', 2], ['ch_banner', 2], ['ch_frieze', 1]], 0.5);
      break;
    }
    default:
      walls(ctx, H, r, [['ch_banner', 2], ['ch_frieze', 1], ['ch_arms', 1], ['ch_plaque', 1]], 0.35);
  }
}

// Each room set about with the Hall's things, spaced out.
const DECOR = {
  entry: [['ch_candles', 2], ['ch_brazier', 1], ['ch_column', 1]],
  exit: [['ch_candles', 2], ['ch_brazier', 1]],
  trial: [['ch_brazier', 1], ['ch_rack', 1]],
  armory: [['ch_armour', 2], ['ch_rack', 2]],
  statues: [['ch_candles', 1], ['ch_flowers', 1]],
  blades: [['ch_brazier', 1]],
  chapel: [['ch_candles', 2], ['ch_flowers', 1]],
  tomb: [['ch_candles', 2], ['ch_flowers', 1]],
  burial: [['ch_candles', 1], ['ch_flowers', 1]],
  reliquary: [['ch_candles', 2]],
  arena: [['ch_brazier', 2], ['ch_rack', 1]],
  trap: [['ch_brazier', 1]],
  treasure: [['ch_candles', 1], ['ch_armour', 1]],
  guard: [['ch_rack', 1], ['ch_brazier', 1]],
  hall: [['ch_candles', 2], ['ch_flowers', 1], ['ch_armour', 1]],
  feast: [['ch_candles', 2], ['ch_rack', 1]],
  oath: [['ch_flowers', 2], ['ch_candles', 1]],
  barracks: [['ch_armour', 1], ['ch_rack', 1], ['ch_candles', 1]],
  wound: [['ch_brazier', 1]],
  memorial: [['ch_flowers', 2], ['ch_candles', 2]],
  boss: [['ch_brazier', 1], ['ch_column', 1]],
};
// The floor inlaid: the runner down a long room, or a border of the
// worn flags round a cracked one.
const SOLID = new Set(['ch_candles', 'ch_brazier', 'ch_armour', 'ch_rack', 'ch_column', 'ch_barricade', 'ch_fallen']);
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
  if (!CHAMPION_OWN.has(r.kit) && !['boss', 'hidden', 'entry', 'exit', 'vault'].includes(r.kit)) ruin(ctx, H, r);
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
const MOVABLE = new Set(['ch_candles', 'ch_brazier', 'ch_armour', 'ch_rack', 'ch_column', 'ch_barricade', 'ch_fallen', 'ch_table', 'ch_bench', 'ch_cot', 'ch_dummy', 'ch_lectern', 'ch_growth', 'candles', 'weapon_rack', 'war_banner', 'triumph_column', 'hanging_chains', 'skull_pile'].map((k) => B[k]).filter((v) => v !== undefined));
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
  out.oaths = (out.oaths || []).filter((q) => at(q.door) === B.ch_oathdoor && q.kneels.every((k) => at(k) === B.ch_kneel));
  out.wards = (out.wards || []).map((g) => ({ ...g, wards: g.wards.filter((q) => at(q) === B.ch_ward) })).filter((g) => g.wards.length);
  out.memorials = (out.memorials || []).map((g) => ({ ...g, list: g.list.filter((q) => at(q) === B.ch_memorial) })).filter((g) => g.list.length);
  out.lore = (out.lore || []).filter((q) => [FY, FY + 1, FY + 2].some((y) => BLOCKS[at(q, y)]?.interact === 'lore'));
}

export const CHAMPION_ARCH = {
  own: CHAMPION_OWN,
  kits,
  // (The hall of honours never lost to the way down.)
  keep: new Set(['hall', 'oath']),
  spare: (rng, n, have = []) => {
    const pool = [['hall', 2], ['barracks', 1], ['feast', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'hall';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const CHAMPION_THINGS = ['ch_statue', 'ch_kneel', 'ch_ward', 'ch_memorial', 'ch_flowers', 'ch_table', 'ch_bench', 'ch_hearth', 'ch_armour', 'ch_dummy', 'ch_cot', 'ch_rack', 'ch_brazier', 'ch_column', 'ch_growth', 'ch_lectern', 'ch_candles', 'ch_barricade', 'ch_fallen'].filter((k) => BLOCKS[B[k]]);
