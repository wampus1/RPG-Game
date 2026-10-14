// (Round 97) The crypt, made over: the undercroft of a temple, raised over
// a saint's bones and kept for generations by an order who buried the
// town's dead there and kept the VIGIL: candles that never went out, so the
// dead would sleep. Then the water came up through the floor, and the
// candles guttered, and the dead woke. Masons' work, not the earth of a
// barrow or a mine's timber: pale dressed stone in courses, carved
// pilasters, ledger slabs over graves in the floor, marble down the nave,
// the niches of the dead in every wall; symmetry, long sightlines, pools of
// candlelight with the cold between. Large halls with many rooms off them,
// and little up and down: a chancel a step up, the flooded undercroft a
// step down.
//
// A floor of it, and what its rooms were:
//   the nave: the great hall, aisles of pillars either side, marble down
//     the middle with the vigil candles, tombs in the aisles; a chancel a
//     step up at its end, the altar on it and the choir stalls, and the
//     cantor still at its office;
//   a chapel: an altar against its back wall, candles either side of it, a
//     prayer desk before it; and a saint in stone, or someone's tomb;
//   the donors' chapel: the tombs of the crypt's benefactors in a row, each
//     with its effigy laid on the lid its own way (the Register says which
//     of them took the chalice to their grave with them);
//   the loculi: a long gallery, the dead shelved in niches up both its
//     walls, two tiers of them; candles down its middle; and here and there
//     a flag cracked over the void;
//   the ossuary: walls of bones, heaps of them, and the sexton who keeps
//     them;
//   the undercroft: the lower crypt, drowned: black water a step down, a
//     causeway through it, tombs standing in it, and the drowned;
//   the cells: the keepers' dormitory, cells off a walk down its middle, a
//     cot in each, the last of them left as they were;
//   the scriptorium: the Register of the dead on its lectern, shelves of
//     the order's books;
//   the vigil chapel: candles round it, all of them out, and a grille in
//     its wall (light them all, and it lifts);
//   the light well: daylight down a grate from the churchyard above,
//     ferns grown in it, the paupers buried in its earth (the dead won't
//     go into the light);
//   the sacristy: the vestments in their presses, the plate in its chest;
//   the reliquary: at the bottom, the saint's bones in their casket on a
//     dais (whoever takes them takes the vigil with them).
// And its secrets: a penitent ghost walking from chapel to chapel, who ends
// kneeling at a loose flag (lift it); the chalice in the right tomb; the
// grille of the vigil chapel. Its papers (see deeps/cryptlore.js) are made
// from the crypt's own history and the town above it.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { cryptLore } from './cryptlore.js';
import { key, raise, sink, put, isUp, free, near, lvlOf, mainDoor, groupOf, lore, at2, pocket, sealHollows, frameOf, shown, backSeen as backOf, place } from './common.js';

// Each land's crypt in its own stuff (the dressed limestone, the marble,
// the niches are Thessa's own; elsewhere their own stone stands in).
export function matsOf(T) {
  const thessa = T.wall === B.crypt_brick;
  // (Round 114: never a liquid, a place whose second floor is water.)
  const pick = (...ks) => ks.find((k) => k !== undefined && k !== null && BLOCKS[k] && !BLOCKS[k].liquid) ?? T.floor;
  return {
    thessa,
    wall: T.wall,
    floor: T.floor,
    marble: thessa ? B.crypt_marble : pick(T.alt, T.floor),
    ledger: thessa ? B.crypt_ledger : pick(T.alt, T.floor),
    dais: thessa ? B.crypt_dais : pick(T.alt, T.floor),
    steps: thessa ? B.crypt_steps : null,
    niche: thessa ? B.crypt_niche : null,
    sealed: thessa ? B.crypt_sealed : null,
    pilaster: thessa ? B.crypt_pilaster : null,
    earth: B.dirt,
  };
}

// The rooms a crypt's made of (beyond the way in and the way on), by how
// deep: the temple's own on the first floor, the old crypt below.
const FIRST = [['chapel', 3], ['nave', 2], ['loculi', 2], ['cells', 2], ['scriptorium', 1], ['lightwell', 1], ['vigil', 1], ['sacristy', 1], ['effigies', 1], ['trap', 1], ['treasure', 1]];
const DEEP = [['chapel', 2], ['loculi', 2], ['ossuary', 2], ['undercroft', 2], ['nave', 1], ['effigies', 1], ['vigil', 1], ['lightwell', 1], ['cells', 1], ['trap', 1], ['treasure', 1]];
// One of each to a floor, at most.
const ONCE = new Set(['nave', 'scriptorium', 'effigies', 'vigil', 'lightwell', 'sacristy', 'reliquary', 'cells']);
export const CRYPT_KITS = new Set(['nave', 'chapel', 'effigies', 'loculi', 'ossuary', 'undercroft', 'cells', 'scriptorium', 'vigil', 'lightwell', 'sacristy', 'reliquary']);

function kits(rng, rec, n, last, count) {
  const pool = n === 0 ? FIRST : DEEP;
  const out = [];
  // (The first floor keeps the Register; the bottom floor, the reliquary.
  // Kept at the end of the list, clear of the first, which may be made the
  // way in or the master's.)
  const sure = [];
  if (n === 0) sure.push('scriptorium');
  if (last) sure.push('reliquary');
  out.push(...sure, n === 0 ? 'nave' : 'chapel');
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const k = rng.weighted(pool);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= (guard > 120 ? 3 : 2) + (k === 'chapel' ? 1 : 0)) continue;
    out.push(k);
  }
  const rest = rng.shuffle(out.filter((k, i) => i >= sure.length));
  return [...rest.slice(0, count - sure.length), ...sure];
}

const SIZES = {
  nave: [[14, 17], [9, 11]], chapel: [[6, 8], [6, 8]], effigies: [[9, 11], [7, 8]], loculi: [[12, 15], [5, 5]], ossuary: [[8, 11], [7, 9]],
  undercroft: [[10, 13], [8, 10]], cells: [[11, 13], [7, 7]], scriptorium: [[7, 9], [6, 8]], vigil: [[7, 9], [7, 9]], lightwell: [[7, 9], [7, 9]],
  sacristy: [[6, 8], [5, 7]], reliquary: [[9, 11], [9, 11]],
};
// (A chapel has no shape of its own, so it may be made a great one: a hall
// with chapels down each side.)
const SHAPES = {
  nave: ['rect'], effigies: ['rect'], loculi: ['rect'], ossuary: ['rect', 'octagon'], undercroft: ['rect'], cells: ['rect'], scriptorium: ['rect'],
  vigil: ['octagon'], lightwell: ['round', 'octagon'], sacristy: ['rect'], reliquary: ['octagon'],
};

// The master waiting at the bottom: chosen from the crypt's own seed, so
// every floor's papers can speak of it (see deeps/cryptlore.js).
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x7c3) % list.length] : null;
};
const Lof = (ctx) => ctx.lore || (ctx.lore = cryptLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
// A vigil candle (lit, or long out).
function candle(ctx, x, z, lit = true, y = null) {
  const { b } = ctx;
  b.set(x, y ?? ctx.FY, z, lit ? B.vigil_candle : B.vigil_out);
  (ctx.out.candles ||= []).push({ x: b.x0 + x, z, y: y ?? ctx.FY });
}
// A tomb, its effigy laid one of four ways (its turn); who's in it rises
// when the candles near it go out (see game/cryptwork.js).
export const TOMBS = [B.effigy_tomb, B.effigy_book, B.effigy_prayer, B.effigy_crozier];
function tomb(ctx, r, x, z, pose, o = {}) {
  const { b } = ctx;
  const y = o.y ?? ctx.FY;
  b.set(x, y, z, TOMBS[pose & 3]);
  const t = { x: b.x0 + x, z, y, pose: pose & 3, room: r.id, species: o.species || 'entombed', ...o };
  (ctx.out.tombs ||= []).push(t);
  return t;
}
// The floor underfoot made something else (a ledger slab, the marble).
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
// A free tile of the room at (x, z) or near it, by a wall or not.
const spot = (ctx, H, r, x, z, rad = 2) => near(ctx, H, r, x, z, rad);
const spotShown = (ctx, H, r, x, z, rad = 2) => near(ctx, H, r, x, z, rad, (qx, qz) => ctx.plan.at(qx, qz + 1));
const DEAD = (lvl) => (lvl >= 2.5 ? 'ghoul' : 'skeleton');

// --------------------------------------------------------------- the rooms
function dress(ctx, r, H) {
  const { rng, b, T, rec } = ctx;
  ctx.FY = H.FY;
  const M = matsOf(T);
  const FY = H.FY;
  const L = Lof(ctx);
  const lvl = lvlOf(ctx);
  switch (r.kit) {
    // The nave: two rows of pillars down its length, the marble between
    // them and the vigil candles along it; tombs in the aisles; at its end
    // the chancel, a step up, with the altar and the stalls, and the cantor.
    case 'nave': {
      const F = frameOf(ctx, H, r);
      const vA = 2;
      const vB = F.Wd - 3;
      const end = F.L - 1;
      // The chancel: its last two rows raised, steps up in the middle.
      for (const u of [end, end - 1]) {
        for (let v = 0; v < F.Wd; v++) {
          const t = F.P(u, v);
          if (free(ctx, H, r, t.x, t.z)) raise(ctx, H, t.x, t.z, M.dais);
        }
      }
      const st = F.P(end - 2, F.mid);
      if (M.steps && shown(ctx, H, r, st.x, st.z)) {
        b.set(st.x, FY, st.z, M.steps, F.stepRot);
        (ctx.lifted ||= new Set()).add(key(ctx, st.x, st.z));
      }
      // On it: the altar, candles either side, the stalls, the cantor.
      const alt = F.P(end, F.mid);
      if (isUp(ctx, alt.x, alt.z)) {
        b.set(alt.x, FY + 1, alt.z, B.crypt_altar);
        lore(ctx, alt.x, alt.z, L.altar());
      }
      for (const dv of [-2, 2]) {
        const c = F.P(end, F.mid + dv);
        if (isUp(ctx, c.x, c.z) && b.get(c.x, FY + 1, c.z) === B.air) candle(ctx, c.x, c.z, true, FY + 1);
      }
      for (const v of [0, F.Wd - 1]) {
        const s = F.P(end - 1, v);
        if (isUp(ctx, s.x, s.z) && b.get(s.x, FY + 1, s.z) === B.air) b.set(s.x, FY + 1, s.z, B.choir_stall);
      }
      const cn = F.P(end - 1, F.mid + 1);
      if (isUp(ctx, cn.x, cn.z)) put(ctx, 'cantor', cn.x, cn.z, r, { dormant: 4, group: groupOf(ctx, r, 'choir'), raised: 1 });
      // The pillars, every third pace down both rows (not on the chancel).
      for (let u = 2; u < end - 2; u += 3) {
        for (const v of [vA, vB]) {
          const t = F.P(u, v);
          if (!free(ctx, H, r, t.x, t.z)) continue;
          for (const y of [FY, FY + 1]) b.set(t.x, y, t.z, M.pilaster || M.wall);
          ctx.reserved.add(key(ctx, t.x, t.z));
        }
      }
      // The marble down the middle, ledger slabs in the aisles.
      for (let u = 0; u < end - 1; u++) {
        for (let v = 0; v < F.Wd; v++) {
          const t = F.P(u, v);
          if (!H.own(ctx.plan, r, t.x, t.z) || isUp(ctx, t.x, t.z)) continue;
          if (v > vA && v < vB) floorAt(ctx, t.x, t.z, M.marble);
          else if ((v < vA - 0 || v > vB) && (u % 3 === 1) && rng.chance(0.55)) floorAt(ctx, t.x, t.z, M.ledger);
        }
      }
      // The vigil candles down the nave, just inside the pillars, one side
      // and then the other.
      for (let u = 3, i = 0; u < end - 2; u += 3, i++) {
        const t = F.P(u, i % 2 ? vB - 1 : vA + 1);
        if (shown(ctx, H, r, t.x, t.z)) candle(ctx, t.x, t.z, true);
      }
      // Tombs in the aisles, against the walls, between the pillars.
      let tombs = 0;
      for (let u = 4; u < end - 2 && tombs < 2 + Math.floor(lvl / 2); u += 3) {
        const v = rng.chance(0.5) ? 0 : F.Wd - 2;
        const t = F.P(u, v);
        if (!shown(ctx, H, r, t.x, t.z)) continue;
        tomb(ctx, r, t.x, t.z, rng.int(0, 3));
        tombs++;
      }
      // The dead in the aisles, and something veiled drifting among them.
      const g = groupOf(ctx, r, 'nave');
      for (let i = 0; i < 1 + Math.floor(lvl / 1.5); i++) {
        const t = F.P(rng.int(1, end - 3), rng.chance(0.5) ? 1 : F.Wd - 2);
        const at = spot(ctx, H, r, t.x, t.z, 1);
        if (at) put(ctx, DEAD(lvl), at.x, at.z, r, { dormant: 2.5, group: g, vigil: true });
      }
      if (lvl >= 1.5) {
        const t = F.P(1, F.mid);
        const at = spot(ctx, H, r, t.x, t.z, 2);
        if (at) put(ctx, 'mourner', at.x, at.z, r, { dormant: 6, group: g });
      }
      break;
    }
    // A chapel: an altar against its back wall, candles either side, a
    // prayer desk before it, a ledger slab in the floor; and its own: a
    // saint in stone (a lady chapel, candles round her), or a tomb (a
    // chantry, where they sang for the one in it), or both.
    case 'chapel': {
      const S = backOf(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const mid = Math.round((lo + hi) / 2);
      const a = at2(S, mid, S.back);
      const altar = shown(ctx, H, r, a.x, a.z) ? a : null;
      if (altar) {
        b.set(altar.x, FY, altar.z, B.crypt_altar);
        lore(ctx, altar.x, altar.z, L.altar());
        for (const d of [-1, 1]) {
          const c = at2(S, mid + d, S.back);
          if (shown(ctx, H, r, c.x, c.z)) candle(ctx, c.x, c.z, true);
        }
        const pd = at2(S, mid, S.back + S.out * 2);
        if (shown(ctx, H, r, pd.x, pd.z)) b.set(pd.x, FY, pd.z, B.prayer_desk);
      }
      const ls = at2(S, mid, S.back + S.out * 3);
      if (H.own(ctx.plan, r, ls.x, ls.z)) floorAt(ctx, ls.x, ls.z, M.ledger);
      const kind = rng.pick(['lady', 'chantry', 'chantry', 'both']);
      if (kind === 'lady' || kind === 'both') {
        const s = at2(S, rng.chance(0.5) ? lo : hi, S.back);
        if (shown(ctx, H, r, s.x, s.z)) {
          b.set(s.x, FY, s.z, B.saint_statue);
          lore(ctx, s.x, s.z, L.saintPlate());
          const c = at2(S, s.x === at2(S, lo, 0).x && s.z === at2(S, lo, 0).z ? lo + 1 : hi - 1, S.back + S.out);
          if (shown(ctx, H, r, c.x, c.z)) candle(ctx, c.x, c.z, true);
        }
      }
      if (kind === 'chantry' || kind === 'both') {
        const side = rng.chance(0.5) ? lo : hi;
        const t = at2(S, side, S.back + S.out * 2);
        const at = shown(ctx, H, r, t.x, t.z) ? t : spotShown(ctx, H, r, t.x, t.z, 1);
        if (at) {
          tomb(ctx, r, at.x, at.z, rng.int(0, 3));
          const c = spotShown(ctx, H, r, at.x + (S.along ? 0 : S.out), at.z + (S.along ? S.out : 0), 1);
          if (c) candle(ctx, c.x, c.z, true);
        }
      }
      // (A great chapel, walled into chapels down each side: in each, a
      // tomb with its candle, or a saint, or a little altar.)
      if (r.grand) {
        const ends = [];
        for (let z = r.z0; z <= r.z1; z++) {
          for (let x = r.x0; x <= r.x1; x++) {
            if (!shown(ctx, H, r, x, z)) continue;
            const shut = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oz]) => !H.own(ctx.plan, r, x + ox, z + oz) || b.get(x + ox, FY, z + oz) !== B.air).length;
            if (shut >= 3) ends.push({ x, z });
          }
        }
        for (const e of rng.shuffle(ends).slice(0, 6)) {
          if (!shown(ctx, H, r, e.x, e.z)) continue;
          const roll = rng.float(0, 1);
          if (roll < 0.5) tomb(ctx, r, e.x, e.z, rng.int(0, 3));
          else if (roll < 0.75) {
            b.set(e.x, FY, e.z, B.saint_statue);
            lore(ctx, e.x, e.z, L.saintPlate());
          } else b.set(e.x, FY, e.z, B.crypt_altar);
          const c = spotShown(ctx, H, r, e.x, e.z, 1);
          if (c && rng.chance(0.6)) candle(ctx, c.x, c.z, true);
        }
      }
      const g = groupOf(ctx, r, 'chapel');
      if (rng.chance(0.7)) {
        const at = spot(ctx, H, r, r.cx, r.cz, 2);
        if (at) put(ctx, DEAD(lvl), at.x, at.z, r, { dormant: 2.5, group: g, vigil: true });
      }
      if (lvl >= 2 && rng.chance(0.35)) {
        const at = spot(ctx, H, r, r.cx, r.cz, 3);
        if (at) put(ctx, 'mourner', at.x, at.z, r, { dormant: 5, group: g });
      }
      break;
    }
    // The donors' chapel: their tombs in a row against the back wall, each
    // effigy laid its own way, a candle before each; one of them took the
    // chalice to the grave (the Register says which: how they lie).
    case 'effigies': {
      const S = backOf(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      // (The row along the back wall, or the first the room has, if its
      // corners are cut.)
      for (let k = 0; k < 2; k++) {
        let n = 0;
        for (let a = lo; a <= hi; a++) {
          const t = at2(S, a, S.back);
          if (H.own(ctx.plan, r, t.x, t.z)) n++;
        }
        if (n >= 3) break;
        S.back += S.out;
      }
      const poses = rng.shuffle([0, 1, 2, 3]);
      const n = hi - lo >= 6 ? 4 : 3;
      const step = Math.max(2, Math.floor((hi - lo) / (n - 1)));
      const row = [];
      for (let i = 0; i < n; i++) {
        const a = Math.min(hi, lo + i * step);
        const t = at2(S, a, S.back);
        if (!shown(ctx, H, r, t.x, t.z)) continue;
        row.push({ t, pose: poses[i] });
      }
      if (row.length >= 2) {
        const answer = rng.pick(row).pose;
        const g = groupOf(ctx, r, 'donors');
        const list = [];
        for (const q of row) {
          list.push(tomb(ctx, r, q.t.x, q.t.z, q.pose, { puzzle: true, right: q.pose === answer, group: g }));
          const c = at2(S, (S.along ? q.t.x : q.t.z), S.back + S.out * 2);
          if (shown(ctx, H, r, c.x, c.z)) candle(ctx, c.x, c.z, true);
        }
        ctx.effigy = answer;
        (ctx.out.effigies ||= []).push({ room: r.id, answer, tombs: list.map((t) => ({ x: t.x, z: t.z, pose: t.pose })) });
      }
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.urn, 0, true);
      const at = spot(ctx, H, r, r.cx, r.cz, 2);
      if (at && rng.chance(0.6)) put(ctx, 'mourner', at.x, at.z, r, { dormant: 5, group: groupOf(ctx, r, 'donors') });
      break;
    }
    // The loculi: the dead shelved in niches up both long walls, two tiers
    // of them, some sealed with their lettered slabs; candles down the
    // middle; those in the niches lying still while the candles burn; a
    // flag or two cracked over the void.
    case 'loculi': {
      const F = frameOf(ctx, H, r);
      for (const w of H.wallsOf(ctx.plan, r)) {
        for (const y of [FY, FY + 1]) {
          if (b.get(w.x, y, w.z) !== M.wall || !M.niche) continue;
          const roll = rng.float(0, 1);
          if (roll < 0.62) b.set(w.x, y, w.z, M.niche);
          else if (roll < 0.86) b.set(w.x, y, w.z, M.sealed);
        }
      }
      for (let u = 2; u < F.L - 1; u += 4) {
        const t = F.P(u, F.mid);
        if (shown(ctx, H, r, t.x, t.z)) candle(ctx, t.x, t.z, true);
      }
      const g = groupOf(ctx, r, 'niches');
      for (let i = 0; i < 2 + Math.floor(lvl / 1.5); i++) {
        const t = F.P(rng.int(1, F.L - 2), rng.chance(0.5) ? 0 : F.Wd - 1);
        const at = spot(ctx, H, r, t.x, t.z, 1);
        if (at) put(ctx, 'skeleton', at.x, at.z, r, { dormant: 2, group: g, vigil: true });
      }
      if (rng.chance(0.55)) {
        const t = F.P(F.L - 2, F.mid);
        const at = spot(ctx, H, r, t.x, t.z, 1);
        if (at) put(ctx, 'mourner', at.x, at.z, r, { dormant: 6, group: g });
      }
      // The cracked flags (over the drowned undercroft below).
      if (rng.chance(0.55)) {
        const u0 = rng.int(3, Math.max(3, F.L - 5));
        for (let du = 0; du < rng.int(2, 3); du++) {
          const t = F.P(u0 + du, F.mid + (du % 2 ? 1 : 0));
          if (!free(ctx, H, r, t.x, t.z) || b.get(t.x, FY - 1, t.z) !== M.floor) continue;
          floorAt(ctx, t.x, t.z, B.crypt_weak);
          (ctx.out.weakFlags ||= []).push({ x: b.x0 + t.x, z: t.z });
        }
      }
      break;
    }
    // The ossuary: walls of bones, heaps of them down the middle, skulls,
    // the dead stirring in them; and the sexton, who keeps them.
    case 'ossuary': {
      for (const w of H.wallsOf(ctx.plan, r)) for (const y of [FY, FY + 1]) if (b.get(w.x, y, w.z) === M.wall) b.set(w.x, y, w.z, B.bone_wall);
      const F = frameOf(ctx, H, r);
      for (let u = 1; u < F.L - 1; u += 3) {
        for (const v of [F.mid - 1, F.mid + 1]) {
          const t = F.P(u + (v > F.mid ? 1 : 0), v);
          if (shown(ctx, H, r, t.x, t.z) && rng.chance(0.75)) b.set(t.x, FY, t.z, rng.chance(0.75) ? B.ossuary_heap : B.skull_pile);
        }
      }
      for (let i = 0; i < 5; i++) {
        const at = place(ctx, H, r, B.bones, 0, false);
        if (at && isUp(ctx, at.x, at.z)) b.set(at.x, FY, at.z, B.air);
      }
      const g = groupOf(ctx, r, 'ossuary');
      for (let i = 0; i < 2 + Math.floor(lvl / 1.5); i++) {
        const at = spot(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1), 2);
        if (at) put(ctx, 'skeleton', at.x, at.z, r, { dormant: 2.5, group: g });
      }
      const at = spot(ctx, H, r, r.cx, r.cz, 3);
      if (at) put(ctx, 'sexton', at.x, at.z, r, { dormant: 5, group: g });
      if (rng.chance(0.5)) H.chestIn(ctx, r, 1, B.chest, [['bone', rng.int(2, 6)]]);
      break;
    }
    // The undercroft: drowned, a step down; a causeway kept through it from
    // its ways in, tombs standing in the water, the drowned in it; a chest
    // gone under.
    case 'undercroft': {
      const F = frameOf(ctx, H, r);
      const doors = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
      const nearDoor = (x, z) => doors.some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) <= 1);
      const water = [];
      for (let u = 0; u < F.L; u++) {
        for (let v = 0; v < F.Wd; v++) {
          const t = F.P(u, v);
          if (!free(ctx, H, r, t.x, t.z) || v === F.mid || nearDoor(t.x, t.z)) continue;
          sink(ctx, H, t.x, t.z, M.floor, true);
          water.push(t);
        }
      }
      // The causeway: slabs over graves, candles along it.
      for (let u = 0; u < F.L; u++) {
        const t = F.P(u, F.mid);
        if (!H.own(ctx.plan, r, t.x, t.z) || isUp(ctx, t.x, t.z)) continue;
        if (u % 3 === 1) floorAt(ctx, t.x, t.z, M.ledger);
        if (u % 4 === 2 && shown(ctx, H, r, t.x, t.z)) candle(ctx, t.x, t.z, true);
      }
      rng.shuffle(water);
      let tombs = 0;
      for (const t of water) {
        if (tombs >= 2 + Math.floor(lvl / 2)) break;
        const v = F.longX ? t.z - r.z0 : t.x - r.x0;
        if (Math.abs(v - F.mid) < 2) continue;
        tomb(ctx, r, t.x, t.z, rng.int(0, 3), { y: FY - 1, species: lvl >= 2 ? 'entombed' : 'drowned' });
        tombs++;
      }
      const g = groupOf(ctx, r, 'water');
      const wet = water.filter((t) => b.get(t.x, FY - 1, t.z) === B.water);
      for (let i = 0; i < Math.min(wet.length, 2 + Math.floor(lvl / 1.5)); i++) put(ctx, 'drowned', wet[i].x, wet[i].z, r, { dormant: 1.8, group: g, buried: true });
      const deep = wet[wet.length - 1];
      if (deep) {
        b.set(deep.x, FY - 1, deep.z, B.chest, rng.int(0, 3));
        b.container(deep.x, FY - 1, deep.z, H.fill(rng, 9, [...H.lootFor(rec.type, H.tierOf(ctx), rng, 1.6, T), ['old_coin', rng.int(4, 12)]], H.foundIn(ctx)));
      }
      sealHollows(ctx, H, r, M.wall);
      break;
    }
    // The cells: a walk down the middle, cells off it either side, a cot in
    // each, a prayer desk; the last of the keepers' letters on one cot, the
    // rota on another.
    case 'cells': {
      const F = frameOf(ctx, H, r);
      const walk = [F.mid, F.mid + (F.Wd % 2 ? 0 : 1)];
      const cells = [];
      for (let u = 0; u < F.L; u++) {
        for (const side of [0, 1]) {
          const vs = side ? [...Array(F.Wd).keys()].filter((v) => v > walk[1]) : [...Array(F.Wd).keys()].filter((v) => v < walk[0]);
          if (!vs.length) continue;
          // A partition every third pace (stone from the outer wall to the
          // walk, two high).
          if (u % 3 === 0 && u > 0 && u < F.L - 1) {
            for (const v of vs) {
              const t = F.P(u, v);
              if (!free(ctx, H, r, t.x, t.z)) continue;
              for (const y of [FY, FY + 1]) b.set(t.x, y, t.z, M.wall);
            }
          } else if (u % 3 === 1) {
            const outer = side ? Math.max(...vs) : Math.min(...vs);
            cells.push({ u, v: outer, side });
          }
        }
      }
      const g = groupOf(ctx, r, 'cells');
      let wrote = 0;
      for (const c of rng.shuffle(cells)) {
        const t = F.P(c.u, c.v);
        if (!shown(ctx, H, r, t.x, t.z)) continue;
        b.set(t.x, FY, t.z, B.keeper_cot);
        if (wrote < 2) {
          lore(ctx, t.x, t.z, wrote === 0 ? L.letter() : L.rota());
          wrote++;
        }
        const pd = F.P(c.u + 1, c.v);
        if (rng.chance(0.4) && shown(ctx, H, r, pd.x, pd.z)) b.set(pd.x, FY, pd.z, B.prayer_desk);
        else if (rng.chance(0.5)) {
          const at = spot(ctx, H, r, pd.x, pd.z, 0);
          if (at) put(ctx, DEAD(lvl), at.x, at.z, r, { dormant: 2, group: g, vigil: true });
        }
      }
      for (let u = 1; u < F.L - 1; u += 4) {
        const t = F.P(u, walk[0]);
        if (shown(ctx, H, r, t.x, t.z)) candle(ctx, t.x, t.z, true);
      }
      sealHollows(ctx, H, r, M.wall);
      break;
    }
    // The scriptorium: the Register on its lectern at the back (what it
    // says is written last, when the floor's riddles are known: see after),
    // shelves of the order's books along the walls, a desk, a candle.
    case 'scriptorium': {
      const S = backOf(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const mid = Math.round((lo + hi) / 2);
      const t = at2(S, mid, S.back + S.out);
      if (shown(ctx, H, r, t.x, t.z)) {
        b.set(t.x, FY, t.z, B.register_lectern);
        ctx.registerAt = { x: t.x, z: t.z };
      }
      for (const w of H.wallsOf(ctx.plan, r)) {
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = w.x + ox;
          const z = w.z + oz;
          if ((S.along ? z : x) === S.back) continue;
          if (!shown(ctx, H, r, x, z) || rng.chance(0.45)) continue;
          b.set(x, FY, z, B.bookshelf, ox ? (ox > 0 ? 3 : 1) : oz > 0 ? 0 : 2);
          break;
        }
      }
      place(ctx, H, r, B.table, 0, false);
      place(ctx, H, r, B.candles, 0, true);
      for (const d of [-2, 2]) {
        const c = at2(S, mid + d, S.back);
        if (shown(ctx, H, r, c.x, c.z)) candle(ctx, c.x, c.z, true);
      }
      H.chestIn(ctx, r, 1, B.chest, []);
      if (rng.chance(0.6)) {
        const at = spot(ctx, H, r, r.cx, r.cz, 2);
        if (at) put(ctx, 'cantor', at.x, at.z, r, { dormant: 3, group: groupOf(ctx, r, 'scribes') });
      }
      break;
    }
    // The vigil chapel: candles round its walls, every one of them out; a
    // saint in the middle; a grille in one wall, and behind it what the
    // order kept for the day the vigil failed. (Light them all, and it
    // lifts: how many there are, the Register says.)
    case 'vigil': {
      const p = pocket(ctx, H, r, M.wall);
      if (p) {
        b.set(p.door.x, FY, p.door.z, B.crypt_grille);
        b.set(p.door.x, FY + 1, p.door.z, M.wall);
        b.set(p.back.x, FY, p.back.z, B.chest, 0);
        b.container(p.back.x, FY, p.back.z, H.fill(rng, 9, [...H.lootFor(rec.type, H.tierOf(ctx) + 1, rng, 2.2, T), ['gilt_chalice', 1]], H.foundIn(ctx)));
      }
      const n = rng.int(3, Math.min(6, 2 + Math.floor((r.x1 - r.x0) / 2)));
      const ring = [];
      for (let k = 0; k < 24 && ring.length < n; k++) {
        const a = (k / 24) * Math.PI * 2 + rng.float(0, 0.2);
        const rx = (r.x1 - r.x0) / 2 - 1;
        const rz = (r.z1 - r.z0) / 2 - 1;
        const x = Math.round(r.cx + Math.cos(a) * rx);
        const z = Math.round(r.cz + Math.sin(a) * rz);
        if (!shown(ctx, H, r, x, z) || ring.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 3)) continue;
        candle(ctx, x, z, false);
        ring.push({ x: b.x0 + x, z });
      }
      if (shown(ctx, H, r, r.cx, r.cz)) {
        b.set(r.cx, FY, r.cz, B.saint_statue);
        lore(ctx, r.cx, r.cz, L.saintPlate());
      }
      if (p && ring.length) {
        (ctx.out.vigils ||= []).push({ room: r.id, candles: ring, grille: { x: b.x0 + p.door.x, z: p.door.z } });
        ctx.lights = ring.length;
      }
      const g = groupOf(ctx, r, 'vigil');
      for (let i = 0; i < 1 + Math.floor(lvl / 2); i++) {
        const at = spot(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1), 2);
        if (at) put(ctx, DEAD(lvl), at.x, at.z, r, { dormant: 2.5, group: g, vigil: true });
      }
      break;
    }
    // The light well: earth under a grate, daylight down it, ferns grown in
    // the light; the paupers buried there, their boards.
    case 'lightwell': {
      const cells = [];
      for (let z = r.cz - 2; z <= r.cz + 2; z++) {
        for (let x = r.cx - 2; x <= r.cx + 2; x++) {
          if (Math.hypot(x - r.cx, z - r.cz) > 2.3 || !H.own(ctx.plan, r, x, z)) continue;
          floorAt(ctx, x, z, M.earth);
          cells.push({ x, z });
        }
      }
      if (shown(ctx, H, r, r.cx, r.cz)) b.set(r.cx, FY, r.cz, B.light_shaft);
      (ctx.out.wells ||= []).push({ x: b.x0 + r.cx, z: r.cz, r: 2 });
      let boards = 0;
      for (const c of rng.shuffle(cells)) {
        if (!shown(ctx, H, r, c.x, c.z) || (c.x === r.cx && c.z === r.cz)) continue;
        if (boards < 3 && Math.hypot(c.x - r.cx, c.z - r.cz) >= 1.4) {
          b.set(c.x, FY, c.z, B.grave_board);
          lore(ctx, c.x, c.z, L.board());
          boards++;
        } else if (rng.chance(0.55)) b.set(c.x, FY, c.z, B.crypt_fern);
      }
      if (rng.chance(0.5)) put(ctx, 'rat', r.cx + 2, r.cz + 1, r, { dormant: 3 });
      break;
    }
    // The sacristy: the vestment presses, the plate chest, a table.
    case 'sacristy': {
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.vestment_press, 0, true);
      place(ctx, H, r, B.table, 0, false);
      H.chestIn(ctx, r, 1.5, B.chest, [['gilt_chalice', 1], ['old_coin', rng.int(3, 9)]]);
      place(ctx, H, r, B.candles, 0, true);
      const at = spot(ctx, H, r, r.cx, r.cz, 2);
      if (at) put(ctx, rng.chance(0.5) ? 'mourner' : DEAD(lvl), at.x, at.z, r, { dormant: 3, group: groupOf(ctx, r, 'sacristy'), vigil: true });
      break;
    }
    // The reliquary: a dais in the middle, a step up, the saint's casket on
    // it with four candles round it; tombs round the walls, of those who
    // asked to lie near the saint. (Take the bones, and the vigil goes with
    // them: see game/cryptwork.js.)
    case 'reliquary': {
      const door = mainDoor(ctx, H, r);
      for (let z = r.cz - 1; z <= r.cz + 1; z++) for (let x = r.cx - 1; x <= r.cx + 1; x++) if (free(ctx, H, r, x, z)) raise(ctx, H, x, z, M.dais);
      if (isUp(ctx, r.cx, r.cz)) {
        b.set(r.cx, FY + 1, r.cz, B.reliquary);
        lore(ctx, r.cx, r.cz, L.relic());
        ctx.out.reliquary = { x: b.x0 + r.cx, z: r.cz, y: FY + 1 };
      }
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = r.cx + dx;
        const z = r.cz + dz;
        if (isUp(ctx, x, z) && b.get(x, FY + 1, z) === B.air) candle(ctx, x, z, true, FY + 1);
      }
      // The steps up, on the side of the way in.
      if (M.steps && door) {
        const dx = Math.sign(door.x - r.cx);
        const dz = dx ? 0 : Math.sign(door.z - r.cz) || 1;
        const x = r.cx + dx * 2;
        const z = r.cz + dz * 2;
        if (shown(ctx, H, r, x, z)) {
          b.set(x, FY, z, M.steps, dx ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0);
          (ctx.lifted ||= new Set()).add(key(ctx, x, z));
        }
      }
      let tombs = 0;
      for (const w of rng.shuffle(H.wallsOf(ctx.plan, r))) {
        if (tombs >= 4) break;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = w.x + ox;
          const z = w.z + oz;
          if (!shown(ctx, H, r, x, z) || (ctx.out.tombs || []).some((t) => Math.abs(t.x - b.x0 - x) + Math.abs(t.z - z) < 3)) continue;
          tomb(ctx, r, x, z, rng.int(0, 3));
          tombs++;
          break;
        }
      }
      break;
    }
  }
}

// What's set about the rooms that aren't the crypt's own.
function extra(ctx, r, H) {
  const { b } = ctx;
  ctx.FY = H.FY;
  const L = Lof(ctx);
  const FY = H.FY;
  const lit = (n) => {
    for (let i = 0; i < n; i++) {
      const at = place(ctx, H, r, B.vigil_candle, 0, true);
      if (at) (ctx.out.candles ||= []).push({ x: b.x0 + at.x, z: at.z, y: FY });
    }
  };
  if (r.kit === 'entry') {
    // The way down from the temple above: the saint at the stair's foot,
    // the dedication on the altar (the first floor), candles.
    if (ctx.n === 0) {
      const s = place(ctx, H, r, B.saint_statue, 0, true);
      if (s) lore(ctx, s.x, s.z, L.saintPlate());
    }
    lit(2);
  } else if (r.kit === 'boss') {
    // The master's hall: candles at its corners, the tombs of the order's
    // priors along its walls, the last page left on a lectern.
    lit(3);
    const lt = place(ctx, H, r, B.register_lectern, 0, true);
    if (lt) lore(ctx, lt.x, lt.z, L.last());
    for (let i = 0; i < 2; i++) place(ctx, H, r, B.tomb_open, 0, true);
  } else if (r.kit === 'exit') {
    lit(1);
    if (ctx.rng.chance(0.4)) {
      const lt = place(ctx, H, r, B.register_lectern, 0, true);
      if (lt) lore(ctx, lt.x, lt.z, L.last());
    }
  } else if (r.kit === 'trap' || r.kit === 'treasure') {
    lit(1);
  }
}

// --------------------------------------------------------------- dressing
// What's set about each room: a few things by its size, each kind kept
// apart from its own, never in a doorway's way; pilasters let into its
// walls at a measured pace (masons laid this out); an open niche here and
// there.
const DECOR = [['candles', 3], ['urn', 2], ['cobweb', 3], ['hanging_chains', 1], ['skull_pile', 1], ['ossuary_heap', 1], ['prayer_desk', 1]];
function decorate(ctx, r, H) {
  const { rng, b, plan, T } = ctx;
  const FY = H.FY;
  if (r.kit === 'vault' || r.kit === 'hidden') return;
  const M = matsOf(T);
  // The pilasters, every fourth pace along the walls; the niches between.
  if (M.pilaster) {
    for (const w of H.wallsOf(plan, r)) {
      if (b.get(w.x, FY, w.z) !== M.wall) continue;
      if ((w.x + w.z) % 4 === 0) {
        b.set(w.x, FY, w.z, M.pilaster);
        b.set(w.x, FY + 1, w.z, M.pilaster);
      } else if (M.niche && r.kit !== 'boss' && rng.chance(0.06)) b.set(w.x, FY + 1, w.z, rng.chance(0.7) ? M.niche : M.sealed);
    }
  }
  if (r.kit === 'boss') return;
  const list = DECOR.filter(([k]) => B[k] !== undefined);
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const busy = CRYPT_KITS.has(r.kit) ? 0.4 : 1;
  const n = Math.round((area / 24) * rng.float(0.6, 1.2) * busy);
  const placed = [];
  for (let i = 0; i < n; i++) {
    const k = rng.weighted(list);
    for (let t = 0; t < 6; t++) {
      const at = place(ctx, H, r, B[k], rng.int(0, 3), k !== 'candles');
      if (!at) break;
      if (isUp(ctx, at.x, at.z) || placed.some((q) => q.k === k && Math.hypot(q.x - at.x, q.z - at.z) < 4)) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      placed.push({ k, x: at.x, z: at.z });
      break;
    }
  }
}

// --------------------------------------------------------------- the floor
// The Register's words (now the floor's riddles are known), the
// penitent's walk to the loose flag, and the heights.
function after(ctx, H) {
  const { plan, b, rng, out } = ctx;
  ctx.FY = H.FY;
  const FY = H.FY;
  const W = ctx.W;
  const R = plan.rooms;
  const L = Lof(ctx);
  const effigy = ctx.effigy ?? null;
  const lights = ctx.lights ?? null;
  // The Register: on its lectern in the scriptorium, or, if there's none on
  // this floor and there's a riddle to answer, on one set up elsewhere.
  let reg = ctx.registerAt;
  if (!reg && (effigy !== null || lights)) {
    // (In the nave, a chapel, the cells; any room at all; at the last, in
    // the donors' chapel itself.)
    const rank = (q) => ['nave', 'chapel', 'cells'].indexOf(q.kit) >= 0 ? ['nave', 'chapel', 'cells'].indexOf(q.kit) : ['effigies', 'vigil'].includes(q.kit) ? 9 : 5;
    const rooms = R.filter((q) => !['entry', 'exit', 'boss', 'vault', 'hidden'].includes(q.kit) && !q.sealed).sort((a, c) => rank(a) - rank(c));
    for (const r of rooms) if (!reg) reg = place(ctx, H, r, B.register_lectern, 0, true) || place(ctx, H, r, B.register_lectern, 0, false);
  }
  if (reg) lore(ctx, reg.x, reg.z, L.register(effigy, lights));
  // The penitent's walk: from the way in, from chapel to chapel, to where
  // it kneels at the end (a loose flag: lift it).
  const stations = rng.shuffle(R.filter((r) => ['chapel', 'nave', 'lightwell', 'vigil', 'effigies'].includes(r.kit) && !r.sealed)).slice(0, 3);
  const entry = R.find((r) => r.kit === 'entry');
  if (entry && stations.length >= 2 && rng.chance(0.75)) {
    const last = stations[stations.length - 1];
    let flag = null;
    for (let t = 0; t < 30 && !flag; t++) {
      const x = rng.int(last.x0 + 1, last.x1 - 1);
      const z = rng.int(last.z0 + 1, last.z1 - 1);
      if (free(ctx, H, last, x, z) && !isUp(ctx, x, z) && b.get(x, FY - 1, z) !== B.water && b.get(x, FY - 1, z) !== B.crypt_weak) flag = { x, z };
    }
    if (flag) {
      b.set(flag.x, FY, flag.z, B.loose_flag);
      const path = [entry, ...stations.slice(0, -1)].map((r) => ({ x: b.x0 + r.cx, z: r.cz }));
      path.push({ x: b.x0 + flag.x, z: flag.z });
      out.penitent = { path, flag: { x: b.x0 + flag.x, z: flag.z } };
      const at = near(ctx, H, entry, entry.cx + 1, entry.cz + 1, 3);
      if (at) put(ctx, 'penitent', at.x, at.z, entry, { peaceful: true, route: path });
    }
  }
  // Each tomb's candle: the nearest burning within four paces (while it
  // burns, who's in the tomb sleeps).
  const cs = out.candles || [];
  for (const t of out.tombs || []) {
    let best = null;
    for (const c of cs) {
      const d = Math.max(Math.abs(c.x - t.x), Math.abs(c.z - t.z));
      if (d <= 4 && (!best || d < best.d)) best = { d, c };
    }
    t.candle = best ? { x: best.c.x, z: best.c.z, y: best.c.y } : null;
  }
  // Those set out to sleep by the vigil, lying light by a burning candle
  // (they won't wake for you passing, only for you on them): see
  // game/cryptwork.js.
  for (const s of out.spawns) {
    if (!s.vigil || !s.dormant) continue;
    if (cs.some((c) => Math.max(Math.abs(c.x - s.x), Math.abs(c.z - s.z)) <= 4)) s.dormant = 0.6;
  }
  // (Whatever's raised can be stood on: the floor's height bound lifted
  // for it.)
  out.lifted = [...(ctx.lifted || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
  out.ledges = [...(ctx.ledge || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
}

export const CRYPT_ARCH = {
  own: CRYPT_KITS,
  kits,
  // (The Register and the reliquary are never lost to the way down.)
  keep: new Set(['scriptorium', 'reliquary']),
  // (A room spare: some kind there's not already one of, if it's one of
  // a kind.)
  // (A room spare, laid out for some other kind: one of those that suit
  // any shape and size.)
  spare: (rng, n, have = []) => {
    const pool = [['chapel', 3], ['ossuary', n === 0 ? 0 : 1], ['loculi', 1]].filter(([k, w]) => w > 0 && have.filter((q) => q === k).length < (k === 'chapel' ? 3 : 2));
    return pool.length ? rng.weighted(pool) : 'chapel';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
