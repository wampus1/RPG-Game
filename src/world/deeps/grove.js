// (Round 100) The Wildwood Hollow, made over: the deep that was grown, not
// dug. Rounded hollows of living root and earth, never square, joined by
// low root tunnels; moss and leaf-litter underfoot, the Keepers' old flags
// here and there; inside the rooms the ground rises and falls, banks of
// earth held up by roots (a step up, root-steps to climb them, or two up
// and a ladder of roots), dells sunk a step, a spring in the bottom. Beauty
// first (glowcaps, ferns, bluebells, a shaft of real daylight), and then
// the wrong in it: faces in the roots, the Kept grown into the walls, rags
// tied with wishes, a ring of toadstools nobody should step in, milk left
// out in a bowl.
//
// A floor of it, beside the old rooms (the glade, the thicket, the burrow,
// the spring, the shrine, the fallen ones, the traps and the treasure), and
// what its own rooms are:
//   the hollow: the inside of a great trunk, round, roots coming down
//     through it as pillars, a bank of earth round its back a step up;
//   the rootway: a long low way through hanging roots, roots across the
//     floor (and the snares among them), something under the floor;
//   the dell: a hollow sunk in the floor, leaf mould, a spring in its
//     bottom, the drowsebloom down there;
//   the Keepers' shrine: their flags, the Green Man's face cut in the
//     roots, antler posts, the rule-stone; the offering stone and the hob
//     who keeps it (leave it food, and the roots draw back);
//   the hall of the Kept: the townsfolk in the walls, some of them stood
//     out of it, some of them awake; the rag-root;
//   the sunwell: a shaft of daylight onto a bed of earth before a bank two
//     high, what's kept up there out of reach (plant the sun-seed in the
//     light and roots climb the bank);
//   the woodcutter's camp: the notched stump, the axe, the last camp, and a
//     hornets' nest over it.
// And the glade's ring of toadstools: step in it and you're taken (to a
// glade of its own walled off from the floor; step in its toadstools to be
// put back). About the floor: its papers (see deeps/grovelore.js) made from
// the hollow's own history and its town's.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { groveLore } from './grovelore.js';
import { key, raise, sink, put, isUp, free, near, mainDoor, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

// The rooms a hollow's floor is made of (beyond the way in and the way
// on): the Keepers' shrine on its first floor, a glade (and its ring) on
// every one, the sunwell more often than not, and the rest.
const POOL = [['glade', 1], ['thicket', 2], ['burrow', 1], ['spring', 1], ['hollow', 2], ['rootway', 2], ['dell', 2], ['kept', 1], ['camp', 1], ['collapsed', 1], ['shrine', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['keepers', 'kept', 'sunwell', 'camp', 'spring', 'burrow', 'shrine', 'trap', 'treasure', 'glade']);
export const GROVE_OWN = new Set(['hollow', 'rootway', 'dell', 'keepers', 'kept', 'sunwell', 'camp']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: a hollow at the head of the list, made its hall.)
  if (last) out.push('hollow');
  out.push(n === 0 ? 'keepers' : rng.pick(['kept', 'keepers', 'kept']));
  out.push('glade');
  if (rng.chance(0.75)) out.push('sunwell');
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
  hollow: [[9, 12], [8, 11]], rootway: [[11, 15], [4, 5]], dell: [[8, 11], [7, 9]], keepers: [[8, 11], [7, 9]],
  kept: [[9, 12], [6, 7]], sunwell: [[7, 9], [6, 8]], camp: [[7, 9], [6, 8]],
};
const SHAPES = { hollow: ['round'], rootway: ['rect'], dell: ['round'], keepers: ['round', 'octagon'], kept: ['rect'], sunwell: ['rect'], camp: ['round', 'octagon'] };

// The master at the bottom: chosen from the hollow's own seed, so every
// floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0xa74) % list.length] : null;
};
const Lof = (ctx) => ctx.groveLore || (ctx.groveLore = groveLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const lifted = (ctx, x, z) => (ctx.lifted ||= new Set()).add(key(ctx, x, z));
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
// A wall tile turned to another face (both its rows), if it's still the
// place's own wall.
function face(ctx, w, id) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id);
  return true;
}
// A patch of another floor (litter, mould), soft-edged (never over the
// sunwell's bed of earth, nor the keepers' flags).
const KEEP_FLOOR = new Set([B.gr_sunbed, B.gr_flags]);
function patch(ctx, H, r, id, cx, cz, rad) {
  for (let z = Math.floor(cz - rad); z <= Math.ceil(cz + rad); z++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z) || KEEP_FLOOR.has(ctx.b.get(x, ctx.FY - 1, z))) continue;
      if (Math.hypot(x - cx, (z - cz) * 1.2) <= rad + ctx.rng.float(-0.6, 0.3)) floorAt(ctx, x, z, id);
    }
  }
}
// A path worn from one way in to another, through the room's middle.
function worn(ctx, H, r) {
  const ds = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
  if (ds.length < 2) return;
  const mid = { x: r.cx, z: r.cz };
  for (const d of ds.slice(0, 3)) {
    const n = Math.max(Math.abs(mid.x - d.x), Math.abs(mid.z - d.z));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(d.x + ((mid.x - d.x) * i) / n);
      const z = Math.round(d.z + ((mid.z - d.z) * i) / n);
      if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && ctx.b.get(x, ctx.FY - 1, z) === ctx.T.floor) floorAt(ctx, x, z, B.gr_worn);
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
// The edge of the room (its own tiles against its walls), clear of the
// ways in: where a bank of earth can run.
function rim(ctx, H, r, ok = () => true) {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!free(ctx, H, r, x, z) || !H.byWall(ctx.plan, x, z) || !ok(x, z)) continue;
      // (Two clear of any way in: a bank never shuts a door.)
      if (H.doorways(ctx.plan, r).some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) <= 2)) continue;
      out.push({ x, z });
    }
  }
  return out;
}
// A bank a step up along a stretch of the room's edge, root-steps up it
// where its face looks into the room.
function bank(ctx, H, r, tiles, steps = 1) {
  const { b, rng } = ctx;
  const FY = H.FY;
  for (const t of tiles) raise(ctx, H, t.x, t.z, B.gr_bank);
  let n = 0;
  for (const t of rng.shuffle(tiles.slice())) {
    if (n >= steps) break;
    // (The step in front of the bank, facing up it.)
    for (const [ox, oz, rot] of [[0, 1, 0], [0, -1, 2], [1, 0, 3], [-1, 0, 1]]) {
      const x = t.x + ox;
      const z = t.z + oz;
      if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
      b.set(x, FY, z, B.gr_banksteps, rot);
      lifted(ctx, x, z);
      n++;
      break;
    }
  }
}
// A glowcap or a fern on a bank's top (where it's seen).
function onBank(ctx, tiles, n) {
  const { b, rng } = ctx;
  for (const t of rng.shuffle(tiles.slice()).slice(0, n)) {
    if (b.get(t.x, ctx.FY + 1, t.z) !== B.air) continue;
    b.set(t.x, ctx.FY + 1, t.z, rng.chance(0.6) ? B.gr_glowcaps : B.gr_fern, rng.int(0, 3));
  }
}

// --------------------------------------------------------------- the rooms
// The inside of a great trunk: roots down through it as pillars, a bank
// round its back, glowcaps; something kept on the bank.
function hollow(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  // The bank round its back (north) half.
  const tiles = rim(ctx, H, r, (x, z) => z <= r.cz - 1);
  bank(ctx, H, r, tiles, 2);
  onBank(ctx, tiles, 3);
  // The roots coming down through it.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng.float(0, 1.2);
    const x = Math.round(r.cx + Math.cos(a) * w * 0.22);
    const z = Math.round(r.cz + Math.sin(a) * d * 0.22);
    if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
    for (const y of [FY, FY + 1]) b.set(x, y, z, B.gr_roots);
    const g = near(ctx, H, r, x + 1, z, 1);
    if (g && rng.chance(0.6)) b.set(g.x, FY, g.z, B.gr_glowcaps, rng.int(0, 3));
  }
  // Up on the bank, something of the wood's: thornlings, or one of the Kept.
  const up = tiles.filter((t) => b.get(t.x, FY + 1, t.z) === B.air);
  const g = groupOf(ctx, r, 'hollow');
  for (const t of rng.shuffle(up).slice(0, rng.int(1, 2))) put(ctx, rng.chance(0.4) ? 'woodwose' : 'thornling', t.x, t.z, r, { dormant: 5, group: g });
  band(ctx, H, r, ['thornling', rng.chance(0.5) ? 'glimmer' : 'thornling'], { x: r.cx, z: r.cz + 1 }, 'hollow');
}
// A long low way through hanging roots: roots across the floor and the
// snares among them; something under the floor.
function rootway(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  // Hanging roots along its walls.
  for (const w of northWall(ctx, r)) {
    const x = w.x;
    const z = w.z + 1;
    if (x % 3 || !free(ctx, H, r, x, z)) continue;
    b.set(x, FY, z, B.gr_rootcurtain, rng.int(0, 3));
  }
  // Roots across its floor, and among them the snares.
  const longX = r.x1 - r.x0 >= r.z1 - r.z0;
  const tiles = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z)) tiles.push({ x, z });
  const picks = rng.shuffle(tiles);
  let snares = 0;
  let roots = 0;
  for (const t of picks) {
    if (roots < Math.max(4, tiles.length / 8)) {
      if (picks.slice(0, roots).some((q) => Math.abs(q.x - t.x) + Math.abs(q.z - t.z) < 2)) continue;
      const snare = snares < 2 + (ctx.n > 0 ? 1 : 0) && (longX ? Math.abs(t.z - r.cz) <= 1 : Math.abs(t.x - r.cx) <= 1);
      b.set(t.x, FY, t.z, snare ? B.gr_snare : B.gr_rootflat, rng.int(0, 31));
      if (snare) snares++;
      roots++;
    }
  }
  // Something under the floor, and the hunt at its far end.
  const far = longX ? { x: r.x1 - 2, z: r.cz } : { x: r.cx, z: r.z1 - 2 };
  band(ctx, H, r, ['delver'], { x: r.cx, z: r.cz }, 'under');
  if (rng.chance(0.5)) band(ctx, H, r, ['wolf', 'wolf', 'drowsebloom'], far, 'hunt');
  else band(ctx, H, r, ['thornling', 'thornling'], far, 'way');
}
// A hollow sunk in the floor: leaf mould, a spring in its bottom, the
// drowsebloom down there; ferns round its rim.
function dell(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  const sunk = [];
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!free(ctx, H, r, x, z) || H.doorBlocked(ctx.plan, r, x, z)) continue;
      const q = Math.hypot((x - r.cx) / (w * 0.5), (z - r.cz) / (d * 0.5));
      if (q < 0.55) sunk.push({ x, z, q });
    }
  }
  for (const t of sunk) sink(ctx, H, t.x, t.z, B.gr_mould, t.q < 0.16);
  // The drowsebloom in its bottom, and something under its mould.
  const bottom = sunk.filter((t) => t.q >= 0.16 && t.q < 0.4);
  const g = groupOf(ctx, r, 'dell');
  if (bottom.length) {
    const t = rng.pick(bottom);
    put(ctx, 'drowsebloom', t.x, t.z, r, { dormant: 5, group: g });
  }
  if (rng.chance(0.6)) band(ctx, H, r, ['delver'], { x: r.cx, z: r.cz }, 'dell');
  // Thornlings on the rim, ferns and bluebells round it.
  const rimT = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z)) rimT.push({ x, z });
  for (const t of rng.shuffle(rimT).slice(0, 2)) put(ctx, 'thornling', t.x, t.z, r, { dormant: 5, group: g });
  let n = 0;
  for (const t of rng.shuffle(rimT)) {
    if (n >= 4) break;
    if (!free(ctx, H, r, t.x, t.z) || !ctx.plan.at(t.x, t.z + 1)) continue;
    b.set(t.x, FY, t.z, rng.chance(0.5) ? B.gr_fern : B.gr_bluebells, rng.int(0, 3));
    n++;
  }
}
// The Keepers' shrine: their flags, the Green Man, antler posts, the
// rule-stone; the offering stone and its hob, and the roots that draw back.
function keepers(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  // The flags: a round of them in the middle, a path of them from the way in.
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && Math.hypot(x - r.cx, (z - r.cz) * 1.2) <= 2.2) floorAt(ctx, x, z, B.gr_flags);
  const door = mainDoor(ctx, H, r);
  if (door) {
    const n = Math.max(Math.abs(r.cx - door.x), Math.abs(r.cz - door.z));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(door.x + ((r.cx - door.x) * i) / n);
      const z = Math.round(door.z + ((r.cz - door.z) * i) / n);
      if (H.own(ctx.plan, r, x, z)) floorAt(ctx, x, z, B.gr_flags);
    }
  }
  // The Green Man, cut in the back wall.
  const wall = northWall(ctx, r);
  const mid = wall.filter((w) => Math.abs(w.x - r.cx) <= 1);
  const gm = mid[0] || wall[Math.floor(wall.length / 2)];
  if (gm && face(ctx, gm, B.gr_greenman)) lore(ctx, gm.x, gm.z, L.greenman());
  // The rule-stone, against the wall by the way in.
  const rs = place(ctx, H, r, B.gr_rulestone, 0, true);
  if (rs) lore(ctx, rs.x, rs.z, L.rulestone());
  // Antler posts either side of the flags.
  for (const ox of [-3, 3]) {
    const s = near(ctx, H, r, r.cx + ox, r.cz - 1, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (s) b.set(s.x, FY, s.z, B.gr_antlerpost);
  }
  // The roots that draw back: a pocket behind the wall, its way in a door
  // of roots; the offering stone in front of it, the hob by the stone.
  const pk = pocket(ctx, H, r, B.gr_roots);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.gr_rootdoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.4, ctx.T), ['honeycomb', 2]], H.foundIn(ctx, false)));
    for (const c of pk.cells) if (c !== back && rng.chance(0.4) && b.get(c.x, FY, c.z) === B.air && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z)) b.set(c.x, FY, c.z, B.gr_glowcaps, rng.int(0, 3));
    const fx = pk.door.x - pk.dir.x;
    const fz = pk.door.z - pk.dir.z;
    // (The stone set beside the door, so the way to it stays open.)
    const st = near(ctx, H, r, fx, fz, 2, (x, z) => (x !== fx || z !== fz) && Math.abs(x - fx) + Math.abs(z - fz) <= 2);
    ctx.reserved.add(key(ctx, fx, fz));
    if (st) {
      b.set(st.x, FY, st.z, B.gr_offering);
      const hb = near(ctx, H, r, st.x, st.z, 2, (x, z) => x !== fx || z !== fz);
      if (hb) put(ctx, 'hob', hb.x, hb.z, r, { peaceful: true, role: 'hob' });
      (out.hobs ||= []).push({ stone: { x: b.x0 + st.x, z: st.z }, door: { x: b.x0 + pk.door.x, z: pk.door.z } });
    }
  } else {
    // (No room behind the wall: the stone alone, and the hob by it.)
    const st = place(ctx, H, r, B.gr_offering, 0, true);
    if (st) {
      const hb = near(ctx, H, r, st.x, st.z, 2);
      if (hb) put(ctx, 'hob', hb.x, hb.z, r, { peaceful: true, role: 'hob' });
      (out.hobs ||= []).push({ stone: { x: b.x0 + st.x, z: st.z }, door: null });
    }
  }
  // Glimmers about the flags.
  if (rng.chance(0.6)) band(ctx, H, r, ['glimmer', 'thornling'], { x: r.cx, z: r.cz }, 'court');
}
// The hall of the Kept: the townsfolk in the walls, some stood out of it
// (one of them awake), the rag-root.
function kept(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  let first = true;
  for (const w of wall) {
    if ((w.x - r.x0) % 2) continue;
    if (!face(ctx, w, B.gr_kept)) continue;
    lore(ctx, w.x, w.z, first ? L.first() : L.kept());
    first = false;
  }
  // Some of them stood out of it: in the row before the wall, a pace apart;
  // one or two of them awake, and waiting.
  const g = groupOf(ctx, r, 'kept');
  const row = [];
  for (const w of wall) if (free(ctx, H, r, w.x, w.z + 1) && !H.doorBlocked(ctx.plan, r, w.x, w.z + 1) && (w.x - r.x0) % 3 === 1) row.push({ x: w.x, z: w.z + 1 });
  let woke = 0;
  for (const t of row) {
    b.set(t.x, FY, t.z, B.gr_keptroot);
    lore(ctx, t.x, t.z, L.kept());
    const s = near(ctx, H, r, t.x, t.z + 1, 1);
    if (s && woke < 2 && rng.chance(0.6)) {
      put(ctx, 'woodwose', s.x, s.z, r, { dormant: 4, group: g, from: { x: b.x0 + t.x, z: t.z } });
      woke++;
    }
  }
  if (woke) band(ctx, H, r, ['glimmer'], { x: r.cx, z: r.cz }, 'kept');
  // The rag-root.
  const rr = near(ctx, H, r, r.cx, r.z1 - 1, 3, (x, z) => ctx.plan.at(x, z + 1));
  if (rr) {
    b.set(rr.x, FY, rr.z, B.gr_ragroot, rng.int(0, 1));
    lore(ctx, rr.x, rr.z, L.rags());
  }
}
// The sunwell: a shaft of daylight onto a bed of earth before a bank two
// high, what's kept up there out of reach.
function sunwell(ctx, H, r) {
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
  const ledge = longestRun(row0, S.along);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const mid = Math.floor(ledge.length / 2);
  const li = ledge.length >= 3 ? [mid, mid - 1, mid + 1].find((i) => i > 0 && i < ledge.length - 1 && free(ctx, H, r, front(ledge[i]).x, front(ledge[i]).z) && !H.doorBlocked(ctx.plan, r, front(ledge[i]).x, front(ledge[i]).z)) : undefined;
  if (li === undefined) {
    // (No room for it: a spring of daylight on the moss, and no more.)
    const s = place(ctx, H, r, B.gr_sunbeam);
    if (s) floorAt(ctx, s.x, s.z, B.gr_sunbed);
    return;
  }
  for (const t of ledge) raise(ctx, H, t.x, t.z, B.gr_bank, 2);
  // What's kept up there: at the far end from the way up, a chest; ferns.
  const lt = ledge[li];
  const far = Math.abs(0 - li) > Math.abs(ledge.length - 1 - li) ? ledge[0] : ledge[ledge.length - 1];
  b.set(far.x, FY + 2, far.z, B.chest, 0);
  b.container(far.x, FY + 2, far.z, H.fill(rng, 18, H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.6, ctx.T), H.foundIn(ctx, false)));
  for (const t of ledge) if (t !== far && t !== lt && rng.chance(0.4)) b.set(t.x, FY + 2, t.z, rng.chance(0.5) ? B.gr_fern : B.gr_bluebells, rng.int(0, 3));
  // The shaft of daylight in front of it, on its bed of earth.
  const { x: bx, z: bz } = front(lt);
  floorAt(ctx, bx, bz, B.gr_sunbed);
  b.set(bx, FY, bz, B.gr_sunbeam);
  // (The way the roots will climb, when it's grown: up the bank's face.)
  const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
  (out.sunwells ||= []).push({ beam: { x: b.x0 + bx, z: bz }, rot: d, room: r.id });
  // Bluebells in the light about it.
  for (const ox of [1, -1]) {
    const x = bx + (S.along ? ox : 0);
    const z = bz + (S.along ? 0 : ox);
    if (free(ctx, H, r, x, z) && rng.chance(0.7)) b.set(x, FY, z, B.gr_bluebells, rng.int(0, 3));
  }
}
// The woodcutter's last camp: the notched stump, the camp, a fallen log,
// and over it a hornets' nest.
function camp(ctx, H, r) {
  const { b, rng } = ctx;
  const L = Lof(ctx);
  const st = place(ctx, H, r, B.gr_stump, 0, false);
  if (st) lore(ctx, st.x, st.z, L.stump());
  const cp = st && near(ctx, H, r, st.x + rng.pick([-2, 2]), st.z, 2, (x, z) => ctx.plan.at(x, z + 1));
  if (cp) {
    b.set(cp.x, ctx.FY, cp.z, B.gr_camp);
    lore(ctx, cp.x, cp.z, L.camp());
  }
  place(ctx, H, r, B.gr_log, rng.int(0, 1), true);
  // The nest, against the wall over the camp.
  const ns = cp && near(ctx, H, r, cp.x, cp.z - 1, 3, (x, z) => H.byWall(ctx.plan, x, z) && ctx.plan.at(x, z + 1));
  if (ns) b.set(ns.x, ctx.FY, ns.z, B.gr_hornets);
  band(ctx, H, r, ['thornling', 'thornling'], { x: r.cx, z: r.cz }, 'camp');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'hollow':
      return hollow(ctx, H, r);
    case 'rootway':
      return rootway(ctx, H, r);
    case 'dell':
      return dell(ctx, H, r);
    case 'keepers':
      return keepers(ctx, H, r);
    case 'kept':
      return kept(ctx, H, r);
    case 'sunwell':
      return sunwell(ctx, H, r);
    case 'camp':
      return camp(ctx, H, r);
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and the
// hollow's own about them.
function extra(ctx, r, H) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the town's wishes tied on the rag-root.
      if (ctx.n === 0) {
        const at = place(ctx, H, r, B.gr_ragroot, rng.int(0, 1), true);
        if (at) lore(ctx, at.x, at.z, L.rags());
      }
      break;
    }
    case 'glade': {
      // The glowcaps of its ring become a ring of toadstools; step in it and
      // you're taken.
      let n = 0;
      let rad = 0;
      for (let z = r.z0; z <= r.z1; z++) {
        for (let x = r.x0; x <= r.x1; x++) {
          if (!H.own(ctx.plan, r, x, z) || b.get(x, FY, z) !== B.glowshroom) continue;
          b.set(x, FY, z, B.gr_toadstool, rng.int(0, 3));
          rad = Math.max(rad, Math.abs(z - r.cz));
          n++;
        }
      }
      if (n < 6) break;
      // Its own glade, walled off from the floor (its door left as root):
      // where the ring takes you; its toadstools to step in to come back.
      const pk = pocket(ctx, H, r, B.gr_roots);
      if (!pk) break;
      const [c1, c2, c3] = pk.cells;
      b.set(c1.x, FY, c1.z, B.gr_toadstool, rng.int(0, 3));
      const sides = pk.cells.slice(3);
      if (sides[0]) {
        b.set(sides[0].x, FY, sides[0].z, B.chest, 0);
        b.container(sides[0].x, FY, sides[0].z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), ['glowcap', 2]], H.foundIn(ctx, false)));
      }
      if (sides[1]) b.set(sides[1].x, FY, sides[1].z, B.gr_glowcaps, rng.int(0, 3));
      b.set(c2.x, FY, c2.z, B.gr_bluebells, rng.int(0, 3));
      // (A glowcap shelf in its walls, for its light.)
      for (const c of [c3]) for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (b.get(c.x + ox, FY, c.z + oz) === B.gr_roots && rng.chance(0.5)) for (const y of [FY, FY + 1]) b.set(c.x + ox, y, c.z + oz, B.gr_glowshelf);
      (out.rings ||= []).push({ x: b.x0 + r.cx, z: r.cz, rx: Math.max(1.6, rad * 1.2), rz: Math.max(1.4, rad), to: { x: b.x0 + c3.x, z: c3.z }, back: { x: b.x0 + c1.x, z: c1.z }, room: r.id });
      // Glimmers about it, and the court's thornlings.
      band(ctx, H, r, ['glimmer'], { x: r.cx, z: r.cz }, 'ring');
      break;
    }
    case 'thicket':
      // The garden: a drowsebloom in among the briars.
      if (rng.chance(0.7)) band(ctx, H, r, ['drowsebloom'], { x: r.cx, z: r.cz }, 'garden');
      break;
    case 'burrow':
      for (const w of northWall(ctx, r)) if (rng.chance(0.35) && free(ctx, H, r, w.x, w.z + 1)) b.set(w.x, FY, w.z + 1, B.gr_rootcurtain, rng.int(0, 3));
      break;
    case 'spring': {
      let n = 0;
      for (let t = 0; t < 12 && n < 4; t++) {
        const s = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(-2, 2), 1, (x, z) => ctx.plan.at(x, z + 1));
        if (!s) continue;
        b.set(s.x, FY, s.z, rng.chance(0.5) ? B.gr_bluebells : B.gr_fern, rng.int(0, 3));
        n++;
      }
      if (rng.chance(0.5)) band(ctx, H, r, ['glimmer'], { x: r.cx, z: r.cz }, 'spring');
      break;
    }
    case 'shrine':
      for (const ox of [-2, 2]) {
        const s = near(ctx, H, r, r.cx + ox, r.cz, 1, (x, z) => ctx.plan.at(x, z + 1));
        if (s) b.set(s.x, FY, s.z, B.gr_antlerpost);
      }
      break;
    case 'collapsed':
      for (const w of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, w, B.gr_earth);
      break;
    case 'boss': {
      // What's written at its master's door: against the wall, off the
      // middle of the hall (where its master needs the room).
      const at = near(ctx, H, r, r.cx, r.z1 - 1, 5, (x, z) => H.byWall(ctx.plan, x, z) && Math.abs(x - r.cx) >= 2);
      if (at) {
        b.set(at.x, FY, at.z, B.gr_rulestone);
        lore(ctx, at.x, at.z, L.last());
      }
      break;
    }
  }
}

// Each room set about with a few of the wood's things, by what it is,
// spaced out, the tall ones against the walls; its walls given their
// faces; its floor its patches of litter and its worn ways.
const DECOR = {
  glade: [['gr_bluebells', 3], ['gr_fern', 2], ['gr_glowcaps', 1]],
  thicket: [['gr_fern', 2], ['gr_puffball', 1]],
  burrow: [['bones', 2], ['gr_fern', 1]],
  spring: [['gr_fern', 1], ['gr_glowcaps', 1]],
  shrine: [['gr_glowcaps', 2], ['gr_fern', 1]],
  collapsed: [['gr_boulder', 2], ['gr_log', 1], ['gr_glowcaps', 1]],
  entry: [['gr_glowcaps', 2], ['gr_fern', 2]],
  exit: [['gr_glowcaps', 2], ['gr_fern', 1], ['gr_boulder', 1]],
  hollow: [['gr_glowcaps', 2], ['gr_puffball', 1], ['gr_fern', 1]],
  rootway: [['gr_glowcaps', 1], ['gr_puffball', 1]],
  dell: [['gr_glowcaps', 1]],
  keepers: [['gr_glowcaps', 1], ['gr_bluebells', 1]],
  kept: [['gr_glowcaps', 2], ['gr_fern', 1]],
  sunwell: [['gr_fern', 2]],
  camp: [['gr_glowcaps', 1], ['gr_fern', 1], ['gr_puffball', 1]],
  trap: [['gr_puffball', 1]],
  treasure: [['gr_glowcaps', 1]],
};
const TALL = new Set(['gr_boulder', 'gr_log']);
const ROT = new Set(['gr_glowcaps', 'gr_fern', 'gr_bluebells', 'gr_boulder', 'gr_log', 'gr_toadstool']);
function decorate(ctx, r, H) {
  const { rng, plan, b } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  if (r.sealed && r.kit !== 'treasure') return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  // Its floor: a patch or two of leaf litter, the ways in worn to earth.
  if (!['keepers', 'dell'].includes(r.kit)) {
    for (let i = 0; i < Math.max(1, Math.round(area / 40)); i++) patch(ctx, H, r, B.gr_litter, rng.int(r.x0, r.x1), rng.int(r.z0, r.z1), rng.float(1.2, 2.4));
    worn(ctx, H, r);
  }
  // Its walls: glowcaps on some, bare earth, a knothole now and then, and
  // (deeper) one of the Kept.
  for (const w of northWall(ctx, r)) {
    const p = rng.float(0, 1);
    if (p < 0.1) face(ctx, w, B.gr_glowshelf);
    else if (p < 0.2) face(ctx, w, B.gr_earth);
    else if (p < 0.23) face(ctx, w, B.gr_knot);
    else if (p < 0.25 && ctx.n > 0 && r.kit !== 'kept') face(ctx, w, B.gr_kept);
  }
  // Roots lying across the floor, here and there.
  if (r.kit !== 'rootway' && r.kit !== 'keepers') for (let i = 0; i < Math.round(area / 30); i++) place(ctx, H, r, B.gr_rootflat, rng.int(0, 31));
  // And its things, spaced out.
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 22) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], ROT.has(k) ? rng.int(0, 3) : 0, TALL.has(k));
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

// Its architect's last word: the sun-seed set down on the floor, away from
// the sunwell it's for (in another room if there is one).
function after(ctx, H) {
  const { out, b, rng } = ctx;
  for (const sw of out.sunwells || []) {
    const rooms = rng.shuffle(out.rooms.filter((r) => !r.sealed && r.id !== sw.room && !['boss', 'exit', 'hidden', 'vault', 'trap'].includes(r.kit)));
    const home = out.rooms.find((r) => r.id === sw.room);
    for (const r of [...rooms, home].filter(Boolean)) {
      const at = place(ctx, H, r, B.gr_seedpod);
      if (!at) continue;
      sw.seed = { x: b.x0 + at.x, z: at.z };
      break;
    }
  }
}

export const GROVE_ARCH = {
  own: GROVE_OWN,
  kits,
  // (The Keepers' shrine and the sunwell never lost to the way down.)
  keep: new Set(['keepers', 'sunwell', 'kept']),
  spare: (rng, n, have = []) => {
    const pool = [['thicket', 2], ['hollow', 2], ['rootway', 1], ['dell', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'thicket';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a hollow's own things are, for those who count them.)
export const GROVE_THINGS = ['gr_glowcaps', 'gr_toadstool', 'gr_fern', 'gr_bluebells', 'gr_rootcurtain', 'gr_ragroot', 'gr_offering', 'gr_antlerpost', 'gr_rulestone', 'gr_keptroot', 'gr_puffball', 'gr_hornets', 'gr_log', 'gr_stump', 'gr_camp', 'gr_sunbeam', 'gr_seedpod', 'gr_boulder'].filter((k) => BLOCKS[B[k]]);
