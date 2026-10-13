// (Round 98) The holdout, made over: caves a band of outlaws took for a
// hold when the watch drove them off the road, and have lived in since.
// Not a ruin: lived in, and loud with it. Smoke under the roof, the spit
// turning, dice, dogs, a cask on the go; rooms walled off out of the cave
// with palisade logs and boards torn off the wagons they robbed; scaffolds
// up the cave walls where the lookouts sit; and everything in it stolen.
// Cramped and up-and-down: the archers above you on their planks, a crack
// in the floor with a rope bridge over it, pits under hides.
//
// A floor of it, and what its rooms are:
//   the mess: long tables, benches, the spit at the end of the room; the
//     gang at their ease (a brawl the moment they're up), the articles
//     nailed up;
//   the bunks: bunks against the walls, bedrolls and straw between, a
//     footlocker with a letter home in it, and those asleep in them;
//   the watch: a scaffold along the back wall two high, a ladder up, the
//     lookout on it with the archers; a barricade across the room, caltrops
//     in front of it, and the gong;
//   the kennel: pens of fence, straw, gnawed bones, the meat on its hooks;
//     the dogs and their master;
//   the armory: racks, stands of stolen armour, the grindstone, a keg or
//     two; the bruiser who keeps it;
//   the cells: barred cells along the back wall, a door in each; captives
//     in some of them, the jailer with the keys; a ransom letter;
//   the store: the plunder crates, branded with their merchants' marks;
//     cloth, sacks, a smashed wagon; the quartermaster's ledger (it says
//     which crate holds the take); and behind a false wall, the stash;
//   the kitchen: the cauldron, the block, the hooks, the cook;
//   the powder hole: kegs, and a trail of powder from them to the door
//     (put a flame to it);
//   the crack: a cleft across the cave floor, staked at its foot, a rope
//     bridge over it, archers on the far side.
// And about the floor: tripwires strung with bells across the passages,
// hides over staked pits. Its papers (see deeps/holdoutlore.js) are made
// from the holdout's own history and the towns it robs.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { holdLore, BRANDS } from './holdoutlore.js';
import { key, raise, put, isUp, free, near, lvlOf, mainDoor, groupOf, lore, at2, pocket, sealHollows, frameOf, shown, backSeen, place, longestRun } from './common.js';

// Each land's holdout in its own stuff (the cave rock, the shoring are
// Thessa's own; elsewhere their own stone stands in, and the timberwork's
// the same everywhere: outlaws build with what they've stolen).
export function matsOf(T) {
  const thessa = T.wall === B.hold_rock;
  return {
    thessa,
    wall: T.wall,
    floor: T.floor,
    planks: thessa ? B.hold_planks : T.alt || T.floor,
    straw: B.hold_straw,
    rug: B.hold_rug,
    shore: thessa ? B.hold_shore : null,
  };
}

// The rooms a holdout's made of (beyond the way in and the way on), by how
// deep: where they live up top, where they keep what matters below.
const FIRST = [['mess', 2], ['bunks', 2], ['watch', 2], ['kennel', 1], ['armory', 1], ['kitchen', 2], ['magazine', 1], ['trap', 1], ['treasure', 1]];
const DEEP = [['bunks', 1], ['watch', 2], ['kennel', 1], ['armory', 1], ['magazine', 1], ['cells', 1], ['plunder', 1], ['chasm', 2], ['mess', 1], ['kitchen', 1], ['trap', 1], ['treasure', 1]];
// One of each to a floor, at most.
const ONCE = new Set(['mess', 'plunder', 'cells', 'kitchen', 'magazine', 'armory', 'chasm', 'kennel']);
export const HOLD_KITS = new Set(['mess', 'bunks', 'watch', 'kennel', 'armory', 'cells', 'plunder', 'kitchen', 'magazine', 'chasm']);

function kits(rng, rec, n, last, count) {
  const pool = n === 0 ? FIRST : DEEP;
  const out = [];
  // (The first floor keeps the store and the cells: the take, and someone
  // who knows where the rest of it is. Kept at the end of the list, clear
  // of the first, which may be made the way in or the master's.)
  const sure = n === 0 ? ['plunder', 'cells'] : [];
  out.push(...sure, n === 0 ? 'mess' : 'watch');
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const k = rng.weighted(pool);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= (guard > 120 ? 3 : 2)) continue;
    out.push(k);
  }
  const rest = rng.shuffle(out.filter((k, i) => i >= sure.length));
  return [...rest.slice(0, count - sure.length), ...sure];
}

// (The way in: the cave they first came into, roomy.)
const SIZES = {
  entry: [[9, 12], [8, 10]], mess: [[11, 14], [7, 9]], bunks: [[9, 12], [6, 8]], watch: [[10, 13], [7, 9]], kennel: [[8, 11], [6, 8]], armory: [[7, 9], [6, 7]],
  cells: [[11, 14], [7, 8]], plunder: [[9, 12], [7, 9]], kitchen: [[7, 9], [6, 7]], magazine: [[7, 9], [6, 8]], chasm: [[11, 14], [8, 10]],
};
// (Built rooms square, walled off out of the cave; the rest the cave's.)
// (The bunks have no shape of their own, so they may be made a great hall
// walled into quarters.)
const SHAPES = {
  mess: ['rect'], watch: ['rect'], kennel: ['rect', 'cave'], armory: ['rect'], cells: ['rect'], plunder: ['rect'],
  kitchen: ['rect', 'cave', 'ell'], magazine: ['rect', 'cave', 'ell'], chasm: ['rect', 'cave'],
};
// The rooms they built (walled in timber, not left as the cave).
const BUILT = new Set(['mess', 'bunks', 'armory', 'cells', 'plunder', 'kitchen', 'boss']);

// The master waiting at the bottom: chosen from the holdout's own seed, so
// every floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x8c4) % list.length] : null;
};
const Lof = (ctx) => ctx.lore || (ctx.lore = holdLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const spot = (ctx, H, r, x, z, rad = 2) => near(ctx, H, r, x, z, rad);
const spotShown = (ctx, H, r, x, z, rad = 2) => near(ctx, H, r, x, z, rad, (qx, qz) => ctx.plan.at(qx, qz + 1));
// The room's floor laid in something else (planks, straw), all of it or
// the share asked.
function lay(ctx, H, r, id, share = 1) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && ctx.rng.chance(share)) floorAt(ctx, x, z, id);
}
// A lantern on its post, lit.
const lantern = (ctx, H, r) => place(ctx, H, r, B.hold_lantern, 0, true);
// A free tile against the room's walls where it'll be seen, whichever wall.
function byWallShown(ctx, H, r, avoid = []) {
  const { plan, rng } = ctx;
  for (const w of rng.shuffle(H.wallsOf(plan, r))) {
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = w.x + ox;
      const z = w.z + oz;
      if (!shown(ctx, H, r, x, z) || avoid.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 3)) continue;
      return { x, z };
    }
  }
  return null;
}
// The gang (one of a group, waking as one): `rest` sat about, dozing.
function gang(ctx, H, r, species, n, g, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const at = spot(ctx, H, r, ctx.rng.int(r.x0 + 1, Math.max(r.x0 + 1, r.x1 - 1)), ctx.rng.int(r.z0 + 1, Math.max(r.z0 + 1, r.z1 - 1)), 3);
    if (!at) continue;
    const s = put(ctx, species, at.x, at.z, r, { dormant: 3, group: g, ...o });
    if (s) out.push(s);
  }
  return out;
}

// --------------------------------------------------------------- the rooms
function dress(ctx, r, H) {
  const { rng, b, T, rec } = ctx;
  ctx.FY = H.FY;
  const M = matsOf(T);
  const FY = H.FY;
  const L = Lof(ctx);
  const lvl = lvlOf(ctx);
  switch (r.kit) {
    // The mess: one long table down the middle (or two, end to end),
    // benches either side with gaps where the gang sit; the spit turning at
    // the far end; casks against the walls, dice on a barrel; the articles.
    case 'mess': {
      const F = frameOf(ctx, H, r);
      lay(ctx, H, r, M.planks, 0.85);
      const g = groupOf(ctx, r, 'mess');
      const seats = [];
      const u0 = 2;
      const u1 = F.L - 4;
      for (let u = u0; u <= u1; u++) {
        // (A gap halfway along, if it's long: two tables, end to end.)
        if (u1 - u0 >= 7 && u === Math.round((u0 + u1) / 2)) continue;
        const t = F.P(u, F.mid);
        if (!free(ctx, H, r, t.x, t.z)) continue;
        b.set(t.x, FY, t.z, B.hold_table);
        for (const dv of [-1, 1]) {
          const s = F.P(u, F.mid + dv);
          if (!free(ctx, H, r, s.x, s.z)) continue;
          if (rng.chance(0.3)) seats.push(s);
          else b.set(s.x, FY, s.z, B.hold_bench, F.longX ? 0 : 1);
        }
      }
      // The spit, at the end of the room, its fire under it.
      const sp = F.P(F.L - 2, F.mid);
      const spit = shown(ctx, H, r, sp.x, sp.z) ? sp : spotShown(ctx, H, r, sp.x, sp.z, 1);
      if (spit) b.set(spit.x, FY, spit.z, B.hold_spit, META_STATE);
      // The gang at their ease, sat at the table; the cook at the spit.
      const n = Math.min(seats.length, 2 + Math.floor(lvl / 1.2));
      for (const s of rng.shuffle(seats).slice(0, n)) put(ctx, rng.chance(0.75) ? 'cutthroat' : 'thief', s.x, s.z, r, { dormant: 3, group: g, rest: true });
      if (spit) {
        const at = spot(ctx, H, r, spit.x + (F.longX ? -F.dir : 1), spit.z + (F.longX ? 1 : F.dir), 1);
        if (at) put(ctx, 'cutthroat', at.x, at.z, r, { dormant: 3, group: g });
      }
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.ale_cask, 0, true);
      const dice = place(ctx, H, r, B.dice_barrel, 0, false);
      if (dice) {
        // (Two at the dice, stood over it.)
        for (let i = 0; i < 2; i++) {
          const at = spot(ctx, H, r, dice.x + (i ? 1 : -1), dice.z, 1);
          if (at) put(ctx, 'cutthroat', at.x, at.z, r, { dormant: 2.5, group: g });
        }
      }
      // The articles, nailed up on the wall.
      const art = byWallShown(ctx, H, r, spit ? [spit] : []);
      if (art) {
        b.set(art.x, FY, art.z, B.tally_board);
        lore(ctx, art.x, art.z, L.articles());
      }
      place(ctx, H, r, B.war_banner, 0, true);
      break;
    }
    // The bunks: bunks against the walls every other pace, bedrolls and
    // straw between; a footlocker with a letter home; asleep, mostly.
    case 'bunks': {
      lay(ctx, H, r, M.straw, 0.35);
      const bunks = [];
      for (const w of rng.shuffle(H.wallsOf(ctx.plan, r))) {
        if (bunks.length >= 3 + Math.floor((r.x1 - r.x0) / 4)) break;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = w.x + ox;
          const z = w.z + oz;
          if (!shown(ctx, H, r, x, z) || bunks.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 2)) continue;
          b.set(x, FY, z, B.hold_bunk, ox ? (ox > 0 ? 1 : 3) : oz > 0 ? 0 : 2);
          bunks.push({ x, z });
          break;
        }
      }
      const g = groupOf(ctx, r, 'bunks');
      // Bedrolls on the floor, some with someone in them.
      for (let i = 0; i < 2 + Math.floor(lvl / 2); i++) {
        const at = place(ctx, H, r, B.hold_bedroll, rng.int(0, 1), false);
        if (!at) continue;
        if (rng.chance(0.6)) {
          b.set(at.x, FY, at.z, B.air);
          floorAt(ctx, at.x, at.z, M.straw);
          put(ctx, rng.chance(0.7) ? 'cutthroat' : 'thief', at.x, at.z, r, { dormant: 1.5, group: g, rest: true });
        }
      }
      // (And someone by a bunk, asleep sat up.)
      if (bunks.length) {
        const q = rng.pick(bunks);
        const at = spot(ctx, H, r, q.x, q.z, 1);
        if (at) put(ctx, 'holdout_archer', at.x, at.z, r, { dormant: 1.5, group: g, rest: true });
      }
      const lk = byWallShown(ctx, H, r, bunks.slice(0, 1));
      if (lk) {
        b.set(lk.x, FY, lk.z, B.hold_locker);
        lore(ctx, lk.x, lk.z, L.letter());
      }
      if (rng.chance(0.5)) {
        const gong = place(ctx, H, r, B.gong, 0, true);
        if (gong) ctx.out.gongs.push({ x: b.x0 + gong.x, z: gong.z });
      }
      lantern(ctx, H, r);
      H.chestIn(ctx, r, 0.8, B.chest, [['coin', rng.int(2, 6)]]);
      break;
    }
    // The watch: the scaffold along the back wall, two high, the ladder up
    // to it; the lookout up there with the archers; a barricade across the
    // room, caltrops in front of it; the gong by the barricade; the rota.
    case 'watch': {
      const S = backSeen(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const row0 = [];
      for (let a = lo; a <= hi; a++) {
        const t = at2(S, a, S.back);
        if (free(ctx, H, r, t.x, t.z)) row0.push(t);
      }
      const ledge = longestRun(row0, S.along);
      const g = groupOf(ctx, r, 'watch');
      // (The ladder up, in front of the ledge, toward one end of it: where
      // there's room for it. No room for one anywhere, and no scaffold.)
      const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
      const order = ledge.map((t, i) => i).filter((i) => i > 0 && i < ledge.length - 1).sort((a, c) => Math.min(a, ledge.length - 1 - a) - Math.min(c, ledge.length - 1 - c) || rng.float(-1, 1));
      const li = order.find((i) => {
        const f = front(ledge[i]);
        return free(ctx, H, r, f.x, f.z) && !H.doorBlocked(ctx.plan, r, f.x, f.z);
      });
      if (ledge.length >= 4 && li !== undefined) {
        for (const t of ledge) raise(ctx, H, t.x, t.z, B.hold_scaffold, 2);
        const lt = ledge[li];
        const { x: lx, z: lz } = front(lt);
        const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
        for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.ladder, d);
        ctx.reserved.add(key(ctx, lx, lz));
        // Up there: the lookout in the middle, the archers either side, a
        // lantern at the far end from the ladder.
        const mid = ledge[Math.floor(ledge.length / 2)];
        put(ctx, 'lookout', mid.x, mid.z, r, { group: g });
        const ends = [ledge[0], ledge[ledge.length - 1]].filter((q) => q !== lt);
        for (let i = 0; i < Math.min(2, 1 + Math.floor(lvl / 2)); i++) {
          const q = ledge[Math.max(0, Math.min(ledge.length - 1, Math.floor(ledge.length / 2) + (i ? 2 : -2)))];
          if (q !== mid && q !== lt) put(ctx, 'holdout_archer', q.x, q.z, r, { dormant: 6, group: g });
        }
        const far = ends[ends.length - 1];
        if (far) b.set(far.x, FY + 2, far.z, B.hold_lantern);
      }
      // The barricade: a fence across the room's middle, with a gap.
      const row = S.back + S.out * Math.max(3, Math.floor(((S.along ? r.z1 - r.z0 : r.x1 - r.x0) + 1) / 2));
      const gap = rng.int(lo + 1, Math.max(lo + 1, hi - 1));
      const fence = [];
      for (let a = lo; a <= hi; a++) {
        if (Math.abs(a - gap) <= 0) continue;
        const t = at2(S, a, row);
        if (!free(ctx, H, r, t.x, t.z) || rng.chance(0.15)) continue;
        b.set(t.x, FY, t.z, B.fence);
        fence.push(t);
      }
      // Caltrops strewn in front of it (the side away from the scaffold).
      for (let i = 0; i < 3 + Math.floor(lvl / 2); i++) {
        const a = rng.int(lo, hi);
        const t = at2(S, a, row + S.out * rng.int(1, 2));
        if (free(ctx, H, r, t.x, t.z)) b.set(t.x, FY, t.z, B.hold_caltrops, rng.int(0, 3));
      }
      // A cutthroat behind the fence; the gong beside it.
      const behind = at2(S, gap, row - S.out);
      const at = spot(ctx, H, r, behind.x, behind.z, 1);
      if (at) put(ctx, 'cutthroat', at.x, at.z, r, { dormant: 4, group: g });
      const gong = near(ctx, H, r, behind.x, behind.z, 3, (x, z) => ctx.plan.at(x, z + 1) && H.byWall(ctx.plan, x, z));
      if (gong) {
        b.set(gong.x, FY, gong.z, B.gong);
        ctx.out.gongs.push({ x: b.x0 + gong.x, z: gong.z });
      }
      const rota = byWallShown(ctx, H, r, gong ? [gong] : []);
      if (rota) {
        b.set(rota.x, FY, rota.z, B.tally_board);
        lore(ctx, rota.x, rota.z, L.rota());
      }
      if (rng.chance(0.5)) place(ctx, H, r, B.barrel, 0, true);
      sealHollows(ctx, H, r, M.wall);
      break;
    }
    // The kennel: pens of fence along the back wall, straw in them; bones,
    // the meat on its hooks; the dogs, and their master.
    case 'kennel': {
      const S = backSeen(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      lay(ctx, H, r, M.straw, 0.6);
      // (The pens: a fence two paces out from the back wall, a post every
      // third pace back to it, and a gate left open in each.)
      const row = S.back + S.out * 2;
      const pens = [];
      for (let a = lo; a <= hi; a++) {
        const t = at2(S, a, row);
        if (!free(ctx, H, r, t.x, t.z)) continue;
        if ((a - lo) % 3 === 1) {
          pens.push(at2(S, a, S.back + S.out));
          continue;
        }
        b.set(t.x, FY, t.z, B.fence);
        if ((a - lo) % 3 === 0 && a > lo) {
          const p = at2(S, a, S.back + S.out);
          if (free(ctx, H, r, p.x, p.z)) b.set(p.x, FY, p.z, B.fence);
        }
      }
      const g = groupOf(ctx, r, 'pack');
      const dogs = 2 + (lvl >= 2 ? 1 : 0) + (lvl >= 3 ? 1 : 0);
      let placed = 0;
      for (const p of rng.shuffle(pens)) {
        if (placed >= dogs) break;
        const at = spot(ctx, H, r, p.x, p.z, 1);
        if (at && put(ctx, 'war_hound', at.x, at.z, r, { dormant: 3.5, group: g, rest: true })) placed++;
      }
      if (placed < dogs) gang(ctx, H, r, 'war_hound', dogs - placed, g, { dormant: 3.5 });
      const mid = at2(S, Math.round((lo + hi) / 2), row + S.out * 2);
      const hm = spot(ctx, H, r, mid.x, mid.z, 2);
      if (hm) put(ctx, 'houndmaster', hm.x, hm.z, r, { dormant: 3.5, group: g });
      for (let i = 0; i < 3; i++) place(ctx, H, r, B.dog_bones, rng.int(0, 3), false);
      place(ctx, H, r, B.meat_hooks, 0, true);
      if (rng.chance(0.5)) place(ctx, H, r, B.butcher_block, 0, true);
      lantern(ctx, H, r);
      break;
    }
    // The armory: racks of stolen arms and stands of stolen armour round
    // the walls, the grindstone, a keg or two by the door (the bruiser
    // knows what they're for), and the bruiser.
    case 'armory': {
      lay(ctx, H, r, M.planks, 0.7);
      for (let i = 0; i < 2 + (rng.chance(0.5) ? 1 : 0); i++) place(ctx, H, r, B.weapon_rack, 0, true);
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.armour_stand, 0, true);
      place(ctx, H, r, B.hold_grind, 0, false);
      const door = mainDoor(ctx, H, r);
      if (door) {
        for (let i = 0; i < 2; i++) {
          const k = near(ctx, H, r, door.x + rng.int(-2, 2), door.z + rng.int(-2, 2), 2, (x, z) => Math.abs(x - door.x) + Math.abs(z - door.z) >= 2);
          if (k) b.set(k.x, FY, k.z, B.powder_keg);
        }
      }
      const g = groupOf(ctx, r, 'armory');
      const at = spot(ctx, H, r, r.cx, r.cz, 2);
      if (at) put(ctx, 'bruiser', at.x, at.z, r, { dormant: 3.5, group: g });
      if (lvl >= 2) gang(ctx, H, r, 'cutthroat', 1, g);
      H.chestIn(ctx, r, 1.2, B.chest, [['arrow', rng.int(4, 10)]]);
      lantern(ctx, H, r);
      break;
    }
    // The cells: barred cells along the back wall, each two paces wide, a
    // door in its bars; captives in some, bones in others; the jailer with
    // the keys, a ransom letter on the jailer's locker.
    case 'cells': {
      const S = backSeen(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const front = S.back + S.out * 2;
      const cells = [];
      // (Bars two high; a cell door in the bars, its frame over it.)
      const bars = (t) => {
        b.set(t.x, FY, t.z, B.iron_bars);
        b.set(t.x, FY + 1, t.z, B.iron_bars);
      };
      // (Shut on every side: the room's wall, bars already up, or bars
      // set up now where the floor's free.)
      const shut = (t) => !H.own(ctx.plan, r, t.x, t.z) || b.get(t.x, FY, t.z) === B.iron_bars;
      const ok = (t) => shut(t) || free(ctx, H, r, t.x, t.z);
      for (let a = lo; a + 1 <= hi; a += 3) {
        const inside = [a, a + 1].flatMap((q) => [at2(S, q, S.back), at2(S, q, S.back + S.out)]);
        const sides = [a - 1, a + 2].flatMap((q) => [at2(S, q, S.back), at2(S, q, S.back + S.out)]);
        const fr = [a - 1, a, a + 1, a + 2].map((q) => at2(S, q, front));
        if (!inside.every((t) => free(ctx, H, r, t.x, t.z)) || !fr.slice(1, 3).every((t) => free(ctx, H, r, t.x, t.z))) continue;
        if (!sides.every(ok) || !ok(fr[0]) || !ok(fr[3])) continue;
        for (const t of [...sides, fr[0], fr[3]]) if (!shut(t)) bars(t);
        const door = fr[1 + rng.int(0, 1)];
        b.set(door.x, FY, door.z, B.cell_door, 0);
        b.set(door.x, FY + 1, door.z, B.cell_door_top, 0);
        bars(door === fr[1] ? fr[2] : fr[1]);
        // (Kept clear of whatever's set about the room after: see late.)
        for (const t of inside) {
          floorAt(ctx, t.x, t.z, M.straw);
          ctx.reserved.add(key(ctx, t.x, t.z));
          (ctx.cellInside ||= new Set()).add(key(ctx, t.x, t.z));
        }
        cells.push({ door, inside });
      }
      const g = groupOf(ctx, r, 'jail');
      const held = Math.min(cells.length, 1 + (rng.chance(0.4) ? 1 : 0));
      for (const [i, c] of rng.shuffle(cells).entries()) {
        const seen = c.inside.filter((t) => ctx.plan.at(t.x, t.z + 1));
        if (i < held) {
          const t = seen[0] || c.inside[0];
          const s = put(ctx, 'captive', t.x, t.z, r, { rest: true, peaceful: true });
          if (s) (ctx.captives ||= []).push({ s, door: c.door, room: r });
        } else {
          const t = rng.pick(seen.length ? seen : c.inside);
          (ctx.cellDeco ||= []).push({ x: t.x, z: t.z, id: rng.chance(0.6) ? B.bones : B.hanging_chains });
        }
      }
      // The jailer, with the keys; a ransom letter on the locker.
      const at = spot(ctx, H, r, r.cx, front + S.out * 2 * (S.along ? 1 : 0) || r.cz, 3) || spot(ctx, H, r, r.cx, r.cz, 3);
      if (at) put(ctx, 'cutthroat', at.x, at.z, r, { dormant: 3, group: g, key: 'cell_keys' });
      if (lvl >= 2 && rng.chance(0.6)) gang(ctx, H, r, 'war_hound', 1, g);
      const lk = place(ctx, H, r, B.hold_locker, 0, true);
      if (lk) ctx.ransomAt = { x: lk.x, z: lk.z };
      place(ctx, H, r, B.hold_table, 0, false);
      lantern(ctx, H, r);
      break;
    }
    // The store: the plunder crates stacked about the walls, each branded
    // with its merchant house's mark (one of each, and more of the others:
    // only the ledger says which one holds the take); cloth, sacks, a
    // smashed wagon; the ledger on its desk; and the stash behind a false
    // wall, in a pocket dug out of the rock.
    case 'plunder': {
      lay(ctx, H, r, M.planks, 0.6);
      // The stash: first, so the crates don't stand in its way. (Behind a
      // wall whose face you can see, if it can be.)
      const seen = (w, d) => d.z === -1 || d.x !== 0;
      const p = pocket(ctx, H, r, M.wall, seen) || pocket(ctx, H, r, M.wall);
      if (p) {
        b.set(p.door.x, FY, p.door.z, B.hold_false);
        b.set(p.door.x, FY + 1, p.door.z, B.hold_false);
        ctx.reserved.add(key(ctx, p.door.x - p.dir.x, p.door.z - p.dir.z));
        b.set(p.back.x, FY, p.back.z, B.chest, rng.int(0, 3));
        b.container(p.back.x, FY, p.back.z, H.fill(rng, 18, [...H.lootFor(rec.type, H.tierOf(ctx) + 1, rng, 2.4, T), ['coin', rng.int(15, 40)], ['gold_ingot', rng.int(1, 2)]], H.foundIn(ctx)));
        for (const c of p.cells) {
          if (c.x === p.back.x && c.z === p.back.z) continue;
          if (rng.chance(0.35)) b.set(c.x, FY, c.z, B.loot_sacks);
        }
        ctx.out.stash = { x: b.x0 + p.door.x, z: p.door.z, ox: -p.dir.x, oz: -p.dir.z, room: r.id };
        ctx.stash = { r, dir: p.dir };
      }
      // The crates.
      const answer = rng.int(0, 3);
      const brands = [0, 1, 2, 3];
      const others = [0, 1, 2, 3].filter((q) => q !== answer);
      for (let i = 0; i < rng.int(2, 4); i++) brands.push(rng.pick(others));
      const crates = [];
      for (const br of rng.shuffle(brands)) {
        const id = B[`crate_${BRANDS[br]}`];
        const at = place(ctx, H, r, id, 0, true) || place(ctx, H, r, id, 0, false);
        if (at) crates.push({ x: b.x0 + at.x, z: at.z, brand: br });
      }
      if (crates.some((c) => c.brand === answer)) ctx.out.plunder = { crates, answer, room: r.id };
      if (rng.chance(0.6)) place(ctx, H, r, B.crate_open, 0, true);
      place(ctx, H, r, B.cloth_bolts, 0, true);
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.loot_sacks, 0, rng.chance(0.5));
      if (rng.chance(0.7)) place(ctx, H, r, B.smashed_wagon, 0, true);
      const lg = place(ctx, H, r, B.plunder_ledger, 0, true);
      if (lg) lore(ctx, lg.x, lg.z, L.ledger(ctx.out.plunder ? answer : null));
      const g = groupOf(ctx, r, 'store');
      gang(ctx, H, r, 'thief', 1, g, { dormant: 2.5 });
      if (lvl >= 1.5) gang(ctx, H, r, 'cutthroat', 1, g, { dormant: 2.5 });
      lantern(ctx, H, r);
      break;
    }
    // The kitchen: the cauldron on its fire, the block, the hooks, a cask,
    // the cook at it; the scraps a hound's come for.
    case 'kitchen': {
      const S = backSeen(ctx, H, r);
      const mid = Math.round(((S.along ? r.x0 : r.z0) + (S.along ? r.x1 : r.z1)) / 2);
      const c = at2(S, mid, S.back + S.out);
      const cau = shown(ctx, H, r, c.x, c.z) ? c : spotShown(ctx, H, r, c.x, c.z, 2);
      if (cau) b.set(cau.x, FY, cau.z, B.hold_cauldron, META_STATE);
      place(ctx, H, r, B.butcher_block, 0, true);
      place(ctx, H, r, B.meat_hooks, 0, true);
      place(ctx, H, r, B.ale_cask, 0, true);
      if (rng.chance(0.6)) place(ctx, H, r, B.loot_sacks, 0, true);
      H.chestIn(ctx, r, 0.6, B.chest, [['bread', rng.int(2, 5)], ['cooked_meat', rng.int(1, 4)], ['ale', rng.int(1, 3)]]);
      const g = groupOf(ctx, r, 'kitchen');
      if (cau) {
        const at = spot(ctx, H, r, cau.x, cau.z + 1, 1);
        if (at) put(ctx, 'cutthroat', at.x, at.z, r, { dormant: 2.5, group: g });
      }
      if (rng.chance(0.5)) gang(ctx, H, r, 'war_hound', 1, g, { dormant: 2.5, rest: true });
      else gang(ctx, H, r, 'rat', 2, g, { dormant: 2 });
      break;
    }
    // The powder hole: kegs against the walls in twos and threes; a trail
    // of black powder spilt from them toward the door (a spark at the door
    // end and it burns all the way back); the bombarder who keeps it. No
    // lights at all.
    case 'magazine': {
      const door = mainDoor(ctx, H, r);
      const kegs = [];
      for (let i = 0; i < 2 + (rng.chance(0.5) ? 1 : 0); i++) {
        const k0 = place(ctx, H, r, B.powder_keg, 0, true);
        if (!k0) continue;
        kegs.push(k0);
        for (let j = 0; j < rng.int(1, 2); j++) {
          const k = near(ctx, H, r, k0.x, k0.z, 1, (x, z) => H.byWall(ctx.plan, x, z));
          if (!k) break;
          b.set(k.x, FY, k.z, B.powder_keg);
          kegs.push(k);
        }
      }
      // The trail: from by a keg toward the way in, a pace at a time.
      if (door && kegs.length) {
        const k = kegs.sort((a, c) => Math.hypot(c.x - door.x, c.z - door.z) - Math.hypot(a.x - door.x, a.z - door.z))[0];
        let x = k.x;
        let z = k.z;
        const trail = [];
        for (let s = 0; s < 14; s++) {
          const dx = Math.sign(door.x - x);
          const dz = Math.sign(door.z - z);
          if (Math.abs(door.x - x) + Math.abs(door.z - z) <= 1) break;
          const opts = [[dx, 0], [0, dz]].filter(([ox, oz]) => ox || oz);
          const [ox, oz] = opts.length > 1 && rng.chance(0.5) ? opts[1] : opts[0];
          x += ox;
          z += oz;
          if (!free(ctx, H, r, x, z)) {
            if (b.get(x, FY, z) === B.hold_powder) continue;
            break;
          }
          trail.push({ x, z });
        }
        for (const t of trail) b.set(t.x, FY, t.z, B.hold_powder, rng.int(0, 3));
      }
      const g = groupOf(ctx, r, 'powder');
      gang(ctx, H, r, 'bombarder', 1 + (lvl >= 2.5 ? 1 : 0), g, { dormant: 3 });
      if (rng.chance(0.5)) place(ctx, H, r, B.crate, 0, true);
      break;
    }
    // The crack: a cleft across the cave floor, a step down and staked at
    // its foot; a rope bridge over it; archers on the far side, lanterns
    // either end of the bridge.
    case 'chasm': {
      const F = frameOf(ctx, H, r);
      const u0 = Math.max(2, Math.floor(F.L / 2) - 1);
      const bridge = F.mid;
      const crack = [];
      for (let v = 0; v < F.Wd; v++) {
        // (Two wide, and wider here and there, as a crack is.)
        const us = [u0, u0 + 1];
        if (v !== bridge && rng.chance(0.3)) us.push(rng.chance(0.5) ? u0 - 1 : u0 + 2);
        for (const u of us) {
          if (v === bridge && u !== u0 && u !== u0 + 1) continue;
          const t = F.P(u, v);
          if (!free(ctx, H, r, t.x, t.z)) continue;
          if (v === bridge) {
            floorAt(ctx, t.x, t.z, B.hold_bridge);
            ctx.reserved.add(key(ctx, t.x, t.z));
            continue;
          }
          b.set(t.x, FY - 1, t.z, B.spikes, META_STATE);
          b.set(t.x, FY - 2, t.z, M.floor);
          (ctx.sunk ||= new Set()).add(key(ctx, t.x, t.z));
          ctx.reserved.add(key(ctx, t.x, t.z));
          crack.push({ x: b.x0 + t.x, z: t.z });
        }
      }
      (ctx.out.stakes ||= []).push(...crack);
      // Lanterns at either end of the bridge.
      for (const u of [u0 - 1, u0 + 2]) {
        const t = F.P(u, bridge + 1);
        if (shown(ctx, H, r, t.x, t.z)) b.set(t.x, FY, t.z, B.hold_lantern);
      }
      // The far side: archers, and on a deep floor a bruiser at the bridge
      // (one shove, and you're on the stakes).
      const g = groupOf(ctx, r, 'crack');
      for (let i = 0; i < 1 + Math.floor(lvl / 1.5); i++) {
        const t = F.P(rng.int(u0 + 3, Math.max(u0 + 3, F.L - 2)), rng.int(0, F.Wd - 1));
        const at = spot(ctx, H, r, t.x, t.z, 2);
        if (at) put(ctx, 'holdout_archer', at.x, at.z, r, { dormant: 7, group: g });
      }
      if (lvl >= 2) {
        const t = F.P(u0 + 3, bridge);
        const at = spot(ctx, H, r, t.x, t.z, 1);
        if (at) put(ctx, 'bruiser', at.x, at.z, r, { dormant: 6, group: g });
      }
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.rubble, rng.int(0, 1), false);
      break;
    }
  }
}

// What's set about the rooms that aren't the holdout's own.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  ctx.FY = H.FY;
  const L = Lof(ctx);
  const FY = H.FY;
  if (r.kit === 'entry') {
    // The way in: the WANTED bill nailed up (the first floor), lanterns.
    if (ctx.n === 0) {
      const w = place(ctx, H, r, B.wanted_post, 0, true);
      if (w) lore(ctx, w.x, w.z, L.wanted());
    }
    lantern(ctx, H, r);
    if (rng.chance(0.5)) place(ctx, H, r, B.loot_sacks, 0, true);
  } else if (r.kit === 'boss') {
    // The chief's hall: the throne of loot at its far end, a rug laid to
    // it, the raid map on its table, the chief's book; lanterns.
    const S = backSeen(ctx, H, r);
    const mid = Math.round(((S.along ? r.x0 : r.z0) + (S.along ? r.x1 : r.z1)) / 2);
    const t = at2(S, mid, S.back);
    const th = shown(ctx, H, r, t.x, t.z) ? t : near(ctx, H, r, t.x, t.z, 2, (x, z) => ctx.plan.at(x, z + 1));
    if (th) b.set(th.x, FY, th.z, B.loot_throne);
    for (let z = r.cz - 1; z <= r.cz + 1; z++) for (let x = r.cx - 2; x <= r.cx + 2; x++) if (H.own(ctx.plan, r, x, z)) floorAt(ctx, x, z, B.hold_rug);
    const map = place(ctx, H, r, B.raid_map, 0, true);
    if (map) lore(ctx, map.x, map.z, L.raidMap());
    const book = place(ctx, H, r, B.plunder_ledger, 0, true);
    if (book) lore(ctx, book.x, book.z, L.last());
    for (let i = 0; i < 2; i++) lantern(ctx, H, r);
    place(ctx, H, r, B.cloth_bolts, 0, true);
  } else if (r.kit === 'exit') {
    lantern(ctx, H, r);
    if (rng.chance(0.5)) place(ctx, H, r, B.crate, 0, true);
  } else if (r.kit === 'trap' || r.kit === 'treasure') {
    lantern(ctx, H, r);
  }
}

// --------------------------------------------------------------- dressing
// The rooms they built walled in timber (palisade logs, wagon boards);
// the cave's own shored up here and there. And what's set about each
// room: a few things by its size, each kind kept apart from its own.
const DECOR = [['weapon_rack', 2], ['war_banner', 2], ['ale_cask', 1], ['loot_sacks', 2], ['dog_bones', 1], ['rubble', 1], ['barrel', 1], ['crate', 1]];
function decorate(ctx, r, H) {
  const { rng, b, plan, T } = ctx;
  const FY = H.FY;
  if (r.kit === 'vault' || r.kit === 'hidden') return;
  const M = matsOf(T);
  const walls = H.wallsOf(plan, r);
  if (BUILT.has(r.kit)) {
    // (Logs for the rooms they live in; boards torn off the wagons for
    // the ones they keep things in.)
    const id = ['mess', 'bunks', 'boss'].includes(r.kit) ? B.palisade : B.hold_boards;
    for (const w of walls) {
      if (b.get(w.x, FY, w.z) !== M.wall || b.get(w.x, FY + 1, w.z) !== M.wall) continue;
      const pick = rng.chance(0.12) ? (id === B.palisade ? B.hold_boards : B.palisade) : id;
      b.set(w.x, FY, w.z, pick);
      b.set(w.x, FY + 1, w.z, pick);
    }
  } else if (M.shore) {
    for (const w of walls) if (b.get(w.x, FY, w.z) === M.wall && (w.x * 3 + w.z * 5) % 7 === 0) b.set(w.x, FY, w.z, M.shore);
  }
  if (r.kit === 'boss') return;
  const list = DECOR.filter(([k]) => B[k] !== undefined && !(r.kit === 'magazine' && k === 'war_banner'));
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const busy = HOLD_KITS.has(r.kit) ? 0.35 : 1;
  const n = Math.round((area / 22) * rng.float(0.6, 1.2) * busy);
  const placed = [];
  for (let i = 0; i < n; i++) {
    const k = rng.weighted(list);
    const wallward = !['dog_bones', 'rubble'].includes(k);
    for (let t = 0; t < 6; t++) {
      const at = place(ctx, H, r, B[k], k === 'rubble' ? rng.int(0, 1) : 0, wallward);
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
// The captives' word on the stash, the tripwires and the pits, the heights.
function after(ctx, H) {
  const { plan, b, rng, out } = ctx;
  ctx.FY = H.FY;
  const FY = H.FY;
  const W = ctx.W;
  const L = Lof(ctx);
  // Where the stash is, as a captive overheard it.
  let where = null;
  if (ctx.stash) {
    const d = ctx.stash.dir;
    const side = d.z < 0 ? 'north' : d.z > 0 ? 'south' : d.x < 0 ? 'west' : 'east';
    where = rng.pick([`in the store-cave, on its ${side} side`, `in the cave where they keep the crates, the ${side} wall`, `by the plunder crates, ${side} side`]);
  }
  // The captives, and what they'll say.
  out.cells = [];
  let ransom = false;
  for (const c of ctx.captives || []) {
    const info = L.captive(where);
    out.cells.push({ door: { x: b.x0 + c.door.x, z: c.door.z }, captive: c.s.id, name: info.name, thanks: info.thanks, farewell: info.farewell, stashHint: info.stashHint });
    if (!ransom && ctx.ransomAt) {
      lore(ctx, ctx.ransomAt.x, ctx.ransomAt.z, info.ransom);
      ransom = true;
    }
  }
  if (!ransom && ctx.ransomAt) lore(ctx, ctx.ransomAt.x, ctx.ransomAt.z, L.letter());
  // Tripwires strung with bells across the passages just outside a room or
  // two, where you'd walk straight into them.
  const rooms = plan.rooms.filter((r) => !['entry', 'vault', 'hidden'].includes(r.kit) && !r.sealed);
  let wires = 0;
  for (const r of rng.shuffle(rooms)) {
    if (wires >= 2 + Math.floor(ctx.n / 2)) break;
    for (const d of rng.shuffle(H.doorways(plan, r))) {
      const i = d.outZ * W + d.outX;
      if (!plan.corr[i] || plan.room[i] >= 0 || b.get(d.outX, FY, d.outZ) !== B.air || ctx.reserved.has(i)) continue;
      b.set(d.outX, FY, d.outZ, B.hold_tripwire, d.ox ? 1 : 0);
      wires++;
      break;
    }
  }
  // Hides pegged over staked pits, in the passages (and the odd one in a
  // room, by a wall where no one would think to look).
  let hides = 0;
  for (let t = 0; t < 200 && hides < 2 + ctx.n; t++) {
    const x = rng.int(2, plan.W - 3);
    const z = rng.int(2, plan.D - 3);
    const i = z * W + x;
    if (!plan.corr[i] || plan.room[i] >= 0 || b.get(x, FY, z) !== B.air || ctx.reserved.has(i)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => [B.hold_hide, B.hold_tripwire].includes(b.get(x + ox, FY, z + oz)))) continue;
    b.set(x, FY, z, B.hold_hide, rng.int(0, 3));
    hides++;
  }
  // Caltrops at a choke or two.
  for (let t = 0, n = 0; t < 120 && n < 1 + Math.floor(ctx.n / 2); t++) {
    const x = rng.int(2, plan.W - 3);
    const z = rng.int(2, plan.D - 3);
    const i = z * W + x;
    if (!plan.corr[i] || plan.room[i] >= 0 || b.get(x, FY, z) !== B.air || ctx.reserved.has(i)) continue;
    const alongX = plan.at(x + 1, z) && plan.at(x - 1, z) && !plan.at(x, z + 1) && !plan.at(x, z - 1);
    const alongZ = plan.at(x, z + 1) && plan.at(x, z - 1) && !plan.at(x + 1, z) && !plan.at(x - 1, z);
    if (!alongX && !alongZ) continue;
    b.set(x, FY, z, B.hold_caltrops, rng.int(0, 3));
    n++;
  }
  // (Whatever's raised can be stood on: the floor's height bound lifted
  // for it.)
  out.lifted = [...(ctx.lifted || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
  out.ledges = [...(ctx.ledge || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
}

// The floor's last word, once everything else has been set about: what
// lies in the empty cells, nobody but the captives in them, and nothing
// left standing in the staked crack.
function late(ctx) {
  const { b, out } = ctx;
  const FY = ctx.FY;
  for (const d of ctx.cellDeco || []) if (b.get(d.x, FY, d.z) === B.air) b.set(d.x, FY, d.z, d.id);
  if (ctx.cellInside) {
    const keep = new Set((ctx.captives || []).map((c) => c.s));
    out.spawns = out.spawns.filter((s) => keep.has(s) || !ctx.cellInside.has(key(ctx, s.x - b.x0, s.z)));
    out.spawns.forEach((s, i) => (s.id = i));
    (ctx.captives || []).forEach((c, i) => out.cells[i] && (out.cells[i].captive = c.s.id));
  }
  for (const s of out.stakes || []) if (BLOCKS[b.get(s.x - b.x0, FY, s.z)]?.solid) b.set(s.x - b.x0, FY, s.z, B.air);
  b.finish();
}

export const HOLD_ARCH = {
  own: HOLD_KITS,
  kits,
  // (The store and the cells are never lost to the way down.)
  keep: new Set(['plunder', 'cells']),
  // (A room spare, laid out for some other kind: one of those that suit
  // any shape and size.)
  spare: (rng, n, have = []) => {
    const pool = [['bunks', 2], ['watch', 2], ['kennel', have.includes('kennel') ? 0 : 1]].filter(([k, w]) => w > 0 && have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'bunks';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  late,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
