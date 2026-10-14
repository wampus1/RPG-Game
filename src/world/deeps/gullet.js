// (Round 113) The Gullet of the World, made over: the World-Worm's bore,
// down through the earth of Ostria and through the first kingdom of it,
// which it ate whole, city and river and all, before it went down to sleep
// it off. The feeling is weight and warmth and a whole people swallowed:
// packed earth scored by the worm's rings, roots let down through the
// roof, grit trickling; and caught in it, or lying whole in the dark, the
// city of the river kingdom (mudbrick under flaking plaster, friezes of
// lapis-glazed brick with yellow lions, palm-log lintels, flat roofs up
// ladders, the temple's stepped terraces, the canal); and deeper, the
// belly, slick with what it digests, its eggs, its shed skins, the hoard
// of the kingdom going soft and green. It goes down through what the worm
// has done, a floor each: the Bore (tunnels, the city glimpsed in their
// walls), the Swallowed City (its streets, its temple, its canal), the
// Belly. See game/gulletwork.js for the tremors (where the roof's cracked,
// grit under it, it comes in when the Sleeper turns, on whoever's under
// it, yours or theirs), the sluice (turn the canal's wheel and the river
// runs again, washing its acid away), the god's table (feed the river god
// and its waters can't burn you a while), the bricked-up door (break it in,
// loud), and the Swallowed (who lead you to it); game/ancient.js for the old
// works (the acid, the eggs, the quakes, the leech-pools, the throats, the
// nests), kept in their rooms.
//
// A floor of it, beside the old rooms, and what its own rooms are:
//   the bore: a long passage of the worm's, ringed earth, roots hanging,
//     the roof cracked in places (grit under), a column or a slab of
//     frieze it brought down with it; the delvers;
//   the street: a street of the city, its paving, the house fronts along
//     the back with their flat roofs up a ladder (jars and a lamp up
//     there), a well, ovens, a stall, a cart; the Swallowed at the well;
//     the spitters on the roofs; a household's bricked-up door off it;
//   the temple: the god's stepped terraces of glazed brick in the middle
//     of its floor, his table and his statue at the top; the annals on the
//     wall, the friezes; the Swallowed knelt on the steps;
//   the canal: a channel of acid down its length (once the river), its
//     quays, a footbridge, a barge sunk in it with its cargo, the sluice
//     wheel at its head; leeches;
//   the clutch: the worm's eggs in clutches, slick floor, the brood-mother
//     tending them; larvae;
//   the shed: the worm's shed skins standing in rings, the roof cracked;
//     bones, a delver, leeches;
//   the hoard: what the kingdom kept, swallowed: gold going green, the
//     king's chair, columns, the lion frieze fallen; its guards.
// About the floor: its papers (see deeps/gulletlore.js), and what it was.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { Region } from '../region.js';
import { REGION_W, REGION_D } from '../../config.js';
import { gulletLore } from './gulletlore.js';
import { key, raise, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const OLD = ['acid', 'eggs', 'quake', 'bones', 'leech_pool', 'tunnel', 'throat', 'nest'];
const POOL = [['bore', 3], ['street', 1], ['temple', 1], ['canal', 1], ['clutch', 1], ['shed', 1], ['hoard', 1], ...OLD.map((k) => [k, 1]), ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['street', 'temple', 'canal', 'clutch', 'shed', 'hoard', ...OLD, 'trap', 'treasure']);
export const GULLET_OWN = new Set(['bore', 'street', 'temple', 'canal', 'clutch', 'shed', 'hoard']);
// The city's rooms (its walls its own mudbrick) and the belly's.
const CITY = new Set(['street', 'temple', 'canal', 'hoard']);
const BELLY = new Set(['clutch', 'shed']);
// What each floor was: its floor.
export const STAGE_FLOOR = ['gl_dirt', 'gl_paving', 'gl_slick'];
// (The bore's own earth, but slick in the belly.)
const earthOf = (ctx) => (ctx.n >= 2 ? B.gl_slick : B.gl_dirt);

function kits(rng, rec, n, last, count) {
  const out = [];
  if (last) out.push('boss');
  // The bore on every floor; the city's rooms from the second (now and
  // then on the first); the belly's on the last.
  out.push('bore');
  if (n === 0) out.push('bore');
  if (n === 1 || rng.chance(0.4)) out.push('street');
  if (n === 1 || rng.chance(0.25)) out.push('temple');
  if (n === 1 || rng.chance(0.3)) out.push('canal');
  if (n >= 1) out.push(n >= 2 || rng.chance(0.5) ? 'clutch' : 'shed');
  if (n >= 2) out.push('shed', 'hoard');
  // And one of the old works of the place on every floor (see
  // game/ancient.js).
  out.push(rng.pick(OLD));
  let guard = 0;
  while (out.length < count && guard++ < 300) {
    const k = rng.weighted(POOL);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= 3) continue;
    out.push(k);
  }
  const head = last ? [out[0]] : [];
  return [...head, ...rng.shuffle(out.slice(head.length))].slice(0, count);
}

const SIZES = {
  bore: [[15, 19], [7, 9]], street: [[14, 17], [10, 12]], temple: [[13, 15], [13, 15]], canal: [[15, 17], [10, 12]],
  clutch: [[12, 14], [11, 13]], shed: [[13, 15], [10, 12]], hoard: [[12, 14], [11, 12]],
};
const SHAPES = { bore: ['rect'], street: ['rect'], temple: ['rect'], canal: ['rect'], clutch: ['round', 'octagon'], shed: ['round', 'rect'], hoard: ['rect', 'octagon'] };

const Lof = (ctx) => ctx.glLore || (ctx.glLore = gulletLore(ctx.rec, ctx.n));
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x8134) % list.length] : null;
};

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
const WALLISH = (ctx) => new Set([ctx.T.wall, B.gl_earth, B.gl_city]);
function face(ctx, w, id, meta = 0) {
  const { b } = ctx;
  const ok = WALLISH(ctx);
  if (!ok.has(b.get(w.x, ctx.FY, w.z)) || !ok.has(b.get(w.x, ctx.FY + 1, w.z))) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id, meta);
  return true;
}
function floorAll(ctx, H, r, id, test = null) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && (!test || test(x, z))) floorAt(ctx, x, z, id);
}
function byDoor(ctx, H, r, x, z, d = 1) {
  return H.doorways(ctx.plan, r).some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) <= d);
}
// The room's walls (the earth all round it) made the city's mudbrick, or
// the belly's etched earth.
function rewall(ctx, H, r, id) {
  const { b, plan } = ctx;
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      if (plan.at(x, z)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([ox, oz]) => H.own(plan, r, x + ox, z + oz))) continue;
      for (const y of [ctx.FY, ctx.FY + 1]) if (b.get(x, y, z) === ctx.T.wall || b.get(x, y, z) === B.gl_earth) b.set(x, y, z, id, (x * 7 + z * 3) & 3);
    }
  }
}
// The north wall's faces, spaced: what's set in it.
function walls(ctx, H, r, list, p, loreOf = null) {
  let last = -9;
  for (const w of northWall(ctx, r)) {
    if (w.x - last < 2 || !ctx.rng.chance(p)) continue;
    const k = ctx.rng.weighted(list);
    const ok = face(ctx, w, B[k], ctx.rng.int(0, 3));
    if (ok && loreOf && loreOf[k]) {
      const e = loreOf[k]();
      if (e) lore(ctx, w.x, w.z, e);
    }
    if (ok) last = w.x;
  }
}
// Where the roof's cracked: grit fallen under it, the tiles kept clear of
// anything else (it'll come in on them: see gulletwork.js).
function cracks(ctx, H, r, n) {
  const { b, rng, out } = ctx;
  const FY = ctx.FY;
  for (let k = 0; k < n; k++) {
    const c = near(ctx, H, r, r.cx + rng.int(-5, 5), r.cz + rng.int(-2, 2), 2, (x, z) => !byDoor(ctx, H, r, x, z, 2));
    if (!c) continue;
    const tiles = [];
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) {
      const x = c.x + dx;
      const z = c.z + dz;
      if (tiles.length >= 4 || !clear(ctx, H, r, x, z) || byDoor(ctx, H, r, x, z, 1) || rng.chance(0.25)) continue;
      // (Not reserved: what's reserved is cleared at the last, and the grit
      // must stay. Nothing else is set where it lies.)
      b.set(x, FY, z, B.gl_grit, rng.int(0, 1));
      tiles.push(abs(ctx, { x, z }));
    }
    if (tiles.length) out.falls = [...(out.falls || []), { tiles, room: r.id }];
  }
}

// --------------------------------------------------------------- the rooms
// The bore: the worm's passage, the roof cracked, roots, what it brought
// down with it; the delvers.
function bore(ctx, H, r) {
  const { rng } = ctx;
  floorAll(ctx, H, r, earthOf(ctx));
  cracks(ctx, H, r, 2 + (ctx.n >= 1 ? 1 : 0));
  for (let k = 0; k < 3; k++) place(ctx, H, r, B.gl_roots, rng.int(0, 1), false);
  // What it brought down with it: a column, a slab of the frieze.
  if (rng.chance(0.7)) place(ctx, H, r, B.gl_column, rng.int(0, 1), true);
  if (rng.chance(0.5)) place(ctx, H, r, B.gl_lion, rng.int(0, 1), true);
  place(ctx, H, r, ctx.n >= 2 ? B.gl_bones : B.gl_jars, rng.int(0, 1), true);
  walls(ctx, H, r, [['gl_cut', 2], ['gl_tablet', 1]], 0.35, { gl_tablet: () => Lof(ctx).tablet() });
  if (ctx.n >= 2) walls(ctx, H, r, [['gl_etched', 1]], 0.3);
  // The delvers, under the floor; a larva or two deeper down.
  band(ctx, H, r, ['borer'], { x: r.cx - 3, z: r.cz }, 'bore');
  band(ctx, H, r, ctx.n >= 1 ? ['borer', 'maw_larva'] : ['borer'], { x: r.cx + 4, z: r.cz }, 'bore2');
}
// The street: the house fronts and their roofs, the well, the ovens.
function street(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  rewall(ctx, H, r, B.gl_city);
  floorAll(ctx, H, r, B.gl_paving);
  // The roofs: a ledge two high along the back, a ladder up, jars and a
  // lamp up there.
  const S = backSeen(ctx, H, r);
  const row0 = [];
  for (let a = (S.along ? r.x0 : r.z0) + 1; a <= (S.along ? r.x1 : r.z1) - 1; a++) {
    const t = at2(S, a, S.back);
    const behind = at2(S, a, S.back - S.out);
    if (clear(ctx, H, r, t.x, t.z) && !byDoor(ctx, H, r, t.x, t.z, 1) && !ctx.plan.at(behind.x, behind.z)) row0.push(t);
  }
  const roof = longestRun(row0, S.along).slice(0, 9);
  let up = null;
  if (roof.length >= 4) {
    for (const t of roof) raise(ctx, H, t.x, t.z, B.gl_roof, 2);
    const fr = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
    const lt = roof.slice(1, -1).find((t) => clear(ctx, H, r, fr(t).x, fr(t).z));
    if (lt) {
      const { x: lx, z: lz } = fr(lt);
      const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
      for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.ladder, d);
      ctx.reserved.add(key(ctx, lx, lz));
      b.set(roof[0].x, FY + 2, roof[0].z, B.gl_jars, rng.int(0, 1));
      b.set(roof[roof.length - 1].x, FY + 2, roof[roof.length - 1].z, B.gl_lamp, rng.int(0, 1));
      up = roof[Math.floor(roof.length / 2)];
    }
  }
  // The well in the middle; ovens and a stall by the walls; a cart.
  const w = near(ctx, H, r, r.cx, r.cz + 1, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.byWall(ctx.plan, x, z));
  if (w) b.set(w.x, FY, w.z, B.gl_well, 0);
  place(ctx, H, r, B.gl_oven, rng.int(0, 1), true);
  place(ctx, H, r, B.gl_stall, rng.int(0, 1), true);
  if (rng.chance(0.6)) place(ctx, H, r, B.gl_cart, rng.int(0, 1), true);
  place(ctx, H, r, B.gl_jars, rng.int(0, 1), true);
  walls(ctx, H, r, [['gl_doorway', 4], ['gl_frieze', 2], ['gl_tablet', 1]], 0.65, { gl_tablet: () => L.tablet() });
  // A household's bricked-up door off it, and what they shut in with them.
  bricked(ctx, H, r);
  // The Swallowed at the well; the spitters up on the roofs; a leech.
  const g = groupOf(ctx, r, 'swallowed_one');
  for (let k = 0; k < 2; k++) {
    const t = w ? near(ctx, H, r, w.x + (k ? 2 : -2), w.z, 2) : near(ctx, H, r, r.cx, r.cz, 3);
    if (t) put(ctx, 'swallowed_one', t.x, t.z, r, { dormant: 0, peaceful: true, group: g });
  }
  if (up) {
    put(ctx, 'acid_spitter', up.x, up.z, r, { dormant: 5, group: groupOf(ctx, r, 'roofs') });
  }
  band(ctx, H, r, ['gut_leech'], { x: r.cx + 4, z: r.cz + 2 }, 'street');
}
// A household's bricked-up door off a room: their cache, and their letter.
function bricked(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = ctx.FY;
  if (ctx.glBricked) return;
  const pk = pocket(ctx, H, r, B.gl_city, (w, d) => (d.z ? w.x > r.x0 + 1 && w.x < r.x1 - 1 : w.z > r.z0 + 1 && w.z < r.z1 - 1));
  if (!pk) return;
  ctx.glBricked = true;
  for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.gl_bricked);
  for (const c of pk.cells) floorAt(ctx, c.x, c.z, B.gl_paving);
  b.set(pk.back.x, FY, pk.back.z, B.chest, 0);
  b.container(pk.back.x, FY, pk.back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2, ctx.T), ['gold_ingot', rng.int(1, 2)], ['old_coin', rng.int(6, 16)], ['bread', rng.int(1, 3)]], H.foundIn(ctx, false)));
  const cells = pk.cells.filter((c) => c !== pk.back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
  if (cells[0]) {
    b.set(cells[0].x, FY, cells[0].z, B.gl_tablets, 0);
    lore(ctx, cells[0].x, cells[0].z, Lof(ctx).letter());
  }
  if (cells[1]) b.set(cells[1].x, FY, cells[1].z, B.gl_bones, rng.int(0, 1));
  if (cells[2]) b.set(cells[2].x, FY, cells[2].z, B.gl_lamp, 0);
  out.bricks = [...(out.bricks || []), { door: abs(ctx, pk.door), room: r.id }];
}
// The temple: the god's terraces, his table and statue at the top.
function temple(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  rewall(ctx, H, r, B.gl_city);
  floorAll(ctx, H, r, B.gl_paving);
  const c = { x: r.cx, z: r.cz };
  // The terraces: a square five across a step up, three across two up.
  const okAt = (x, z) => clear(ctx, H, r, x, z) && !byDoor(ctx, H, r, x, z, 2);
  let fits = true;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (!okAt(c.x + dx, c.z + dz)) fits = false;
  if (fits) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const top = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
        raise(ctx, H, c.x + dx, c.z + dz, B.gl_terrace, top ? 2 : 1);
      }
    }
    // (The ring round it kept clear: the way round and up.)
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 3) ctx.reserved.add(key(ctx, c.x + dx, c.z + dz));
    // His table at the top, and the god behind it.
    b.set(c.x, FY + 2, c.z, B.gl_offering, 0);
    b.set(c.x + 1, FY + 2, c.z - 1, B.gl_god, 0);
    lore(ctx, c.x + 1, c.z - 1, L.statue());
    out.offerings = [...(out.offerings || []), { ...abs(ctx, c), y: FY + 2, room: r.id }];
    b.set(c.x - 1, FY + 2, c.z - 1, B.gl_lamp, 0);
    b.set(c.x - 1, FY + 2, c.z + 1, B.gl_lamp, 1);
  } else {
    const t = place(ctx, H, r, B.gl_god, 0, true);
    if (t) lore(ctx, t.x, t.z, L.statue());
  }
  // The walls: friezes, the god in relief, the annals.
  const an = rng.shuffle(northWall(ctx, r)).find((w) => face(ctx, w, B.gl_tablet));
  if (an) lore(ctx, an.x, an.z, L.annals());
  walls(ctx, H, r, [['gl_frieze', 3], ['gl_relief', 2]], 0.6, { gl_relief: () => L.relief() });
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.gl_column, 0, true);
  place(ctx, H, r, B.gl_jars, rng.int(0, 1), true);
  // The Swallowed knelt on the steps; a spitter keeping the top corner; leeches.
  const g = groupOf(ctx, r, 'knelt');
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, c.x + (i ? 4 : -4), c.z + 1, 1);
    if (t) put(ctx, 'swallowed_one', t.x, t.z, r, { dormant: 0, peaceful: true, group: g });
  }
  band(ctx, H, r, ['gut_leech', 'gut_leech'], { x: c.x - 4, z: c.z + 4 }, 'temple');
  if (ctx.n >= 1) band(ctx, H, r, ['acid_spitter'], { x: c.x + 5, z: c.z - 4 }, 'temple2');
}
// The canal: the acid where the river was, the barge, the sluice wheel.
function canal(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  rewall(ctx, H, r, B.gl_city);
  floorAll(ctx, H, r, B.gl_paving);
  // The channel: three wide down the room's length, through its middle.
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  const mid = along ? r.cz : r.cx;
  const lo = along ? r.x0 : r.z0;
  const hi = along ? r.x1 : r.z1;
  const P = (a, o) => (along ? { x: a, z: mid + o } : { x: mid + o, z: a });
  const acid = [];
  const crossAt = lo + 2 + rng.int(0, 2);
  // (The barge sunk out in the middle of it: its deck isn't the acid.)
  const ba = Math.round((lo + hi) / 2) + rng.int(-1, 1);
  const deck = [P(ba, 0), P(ba + 1, 0)];
  const onDeck = (p) => deck.some((q) => q.x === p.x && q.z === p.z);
  for (let a = lo; a <= hi; a++) {
    for (const o of [-1, 0, 1]) {
      const p = P(a, o);
      if (!H.own(ctx.plan, r, p.x, p.z) || byDoor(ctx, H, r, p.x, p.z, 1)) continue;
      ctx.reserved.add(key(ctx, p.x, p.z));
      // (A footbridge of brick across it near one end.)
      if (a === crossAt || onDeck(p)) continue;
      floorAt(ctx, p.x, p.z, B.acid_pool);
      acid.push(abs(ctx, p));
    }
  }
  if (acid.length < 9) return;
  const bx = { x0: b.x0 + r.x0, z0: r.z0, x1: b.x0 + r.x1, z1: r.z1 };
  H.anc(ctx).acid.push({ tiles: acid, box: bx });
  H.anc(ctx).leeches.push({ tiles: acid, box: bx });
  // The barge sunk in it, out in the middle, its cargo aboard.
  if (deck.every((p) => H.own(ctx.plan, r, p.x, p.z))) {
    for (const p of deck) floorAt(ctx, p.x, p.z, B.gl_deck);
    b.set(deck[0].x, FY, deck[0].z, B.gl_barge, rng.int(0, 1));
    b.set(deck[1].x, FY, deck[1].z, B.chest, 0);
    b.container(deck[1].x, FY, deck[1].z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['gold_ingot', rng.int(1, 2)], ['gem', rng.int(0, 2)]], H.foundIn(ctx, false)));
    // (Kept: what's reserved is cleared at the last.)
    for (const p of deck) ctx.reserved.delete(key(ctx, p.x, p.z));
  }
  // The sluice wheel at its head, on the quay by the channel's end.
  const head = [P(hi, -2), P(hi, 2), P(hi - 1, -2), P(hi - 1, 2), P(lo, -2), P(lo, 2)].find((p) => clear(ctx, H, r, p.x, p.z) && !byDoor(ctx, H, r, p.x, p.z, 1));
  if (head) {
    b.set(head.x, FY, head.z, B.gl_wheel, 0);
    out.sluices = [...(out.sluices || []), { wheel: abs(ctx, head), acid, room: r.id, lore: L.sluice() }];
  }
  walls(ctx, H, r, [['gl_frieze', 1], ['gl_doorway', 1], ['gl_relief', 1]], 0.45, { gl_relief: () => L.relief() });
  place(ctx, H, r, B.gl_jars, rng.int(0, 1), true);
  if (rng.chance(0.5)) place(ctx, H, r, B.gl_cart, rng.int(0, 1), true);
  // A leech on the quay, a spitter across the water.
  band(ctx, H, r, ['gut_leech'], P(lo + 2, -3), 'quay');
  band(ctx, H, r, ['acid_spitter'], P(hi - 2, 3), 'far');
}
// The clutch: the worm's eggs, the brood-mother tending them.
function clutch(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  rewall(ctx, H, r, B.gl_etched);
  floorAll(ctx, H, r, B.gl_slick);
  const eggs = [];
  for (let k = 0; k < 7; k++) {
    const t = near(ctx, H, r, r.cx + rng.int(-4, 4), r.cz + rng.int(-3, 3), 2, (x, z) => ctx.plan.at(x, z + 1) && !byDoor(ctx, H, r, x, z, 2) && !eggs.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 2));
    if (!t) continue;
    b.set(t.x, FY, t.z, B.gl_eggs, rng.int(0, 1));
    eggs.push(t);
  }
  if (eggs.length) out.clutches = [...(out.clutches || []), { eggs: eggs.map((t) => abs(ctx, t)), room: r.id }];
  if (rng.chance(0.6)) place(ctx, H, r, B.gl_skin, rng.int(0, 1), true);
  place(ctx, H, r, B.gl_bones, rng.int(0, 1), true);
  walls(ctx, H, r, [['gl_etched', 1]], 0.2);
  put(ctx, 'clutch_mother', r.cx, r.cz, r, { dormant: 4, group: groupOf(ctx, r, 'brood') });
  band(ctx, H, r, ['maw_larva', 'maw_larva'], { x: r.cx + 2, z: r.cz + 2 }, 'brood');
}
// The shed: the worm's old skins, standing; the roof cracked.
function shed(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  rewall(ctx, H, r, B.gl_etched);
  floorAll(ctx, H, r, B.gl_slick);
  const set = [];
  for (let k = 0; k < 4; k++) {
    const t = near(ctx, H, r, r.cx + rng.int(-4, 4), r.cz + rng.int(-2, 2), 2, (x, z) => ctx.plan.at(x, z + 1) && !set.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 3));
    if (!t) continue;
    b.set(t.x, FY, t.z, B.gl_skin, rng.int(0, 1));
    set.push(t);
  }
  cracks(ctx, H, r, 2);
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.gl_bones, rng.int(0, 1), true);
  if (rng.chance(0.5)) place(ctx, H, r, B.gl_hoard, rng.int(0, 1), true);
  band(ctx, H, r, ['borer', 'gut_leech'], { x: r.cx, z: r.cz + 2 }, 'shed');
}
// The hoard: what the kingdom kept, swallowed; the king's chair.
function hoard(ctx, H, r) {
  const { rng } = ctx;
  const L = Lof(ctx);
  rewall(ctx, H, r, B.gl_city);
  floorAll(ctx, H, r, B.gl_paving);
  floorAll(ctx, H, r, B.gl_slick, (x, z) => Math.sin(x * 1.3 + z * 0.7) + Math.cos(z * 1.1 - x * 0.4) > 0.9);
  const th = place(ctx, H, r, B.gl_throne, rng.int(0, 1), true);
  if (th) lore(ctx, th.x, th.z, L.throne());
  for (let k = 0; k < 3; k++) place(ctx, H, r, B.gl_hoard, rng.int(0, 1), true);
  for (let k = 0; k < 2; k++) place(ctx, H, r, B.gl_column, 0, true);
  place(ctx, H, r, B.gl_lion, rng.int(0, 1), true);
  H.chestIn(ctx, r, 2.2, B.chest, [['gold_ingot', rng.int(1, 3)], ['gem', rng.int(1, 2)]]);
  walls(ctx, H, r, [['gl_frieze', 2], ['gl_etched', 1]], 0.5);
  band(ctx, H, r, ['gut_leech', 'gut_leech', 'borer'], { x: r.cx, z: r.cz + 2 }, 'hoard');
  if (ctx.n >= 2) band(ctx, H, r, ['clutch_mother'], { x: r.cx + 3, z: r.cz - 2 }, 'hoard2');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'bore':
      return bore(ctx, H, r);
    case 'street':
      return street(ctx, H, r);
    case 'temple':
      return temple(ctx, H, r);
    case 'canal':
      return canal(ctx, H, r);
    case 'clutch':
      return clutch(ctx, H, r);
    case 'shed':
      return shed(ctx, H, r);
    case 'hoard':
      return hoard(ctx, H, r);
  }
}

// The old rooms, laid in the floor's own earth, their walls given faces.
const RECOLOUR = new Set(['mud', 'bone_sand', 'cave_rock', 'peat'].map((k) => B[k]).filter((v) => v !== undefined));
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z)) continue;
      const f = b.get(x, FY - 1, z);
      if (f === ctx.T.floor || f === ctx.T.alt || RECOLOUR.has(f)) b.set(x, FY - 1, z, f === B.peat ? B.gl_slick : earthOf(ctx));
    }
  }
  // (The old eggs, the worm's own.)
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && b.get(x, FY, z) === B.void_bloom) b.set(x, FY, z, B.gl_eggs, rng.int(0, 1));
  switch (r.kit) {
    case 'entry': {
      // On each floor, what it is, cut in a tablet by the way in.
      const w = northWall(ctx, r).find((q) => WALLISH(ctx).has(b.get(q.x, FY, q.z)));
      if (w && face(ctx, w, B.gl_tablet)) lore(ctx, w.x, w.z, L.hall());
      walls(ctx, H, r, [['gl_cut', 2]], 0.3);
      break;
    }
    case 'boss': {
      // Where it lies: the belly's slick, the etched earth, its last words.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && rng.chance(0.6)) b.set(x, FY - 1, z, B.gl_slick);
      rewall(ctx, H, r, B.gl_etched);
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) <= 3);
      const c = rng.pick(w);
      if (c) {
        for (const y of [FY, FY + 1]) b.set(c.x, y, c.z, B.gl_relief);
        lore(ctx, c.x, c.z, L.last());
      }
      break;
    }
    default:
      if (ctx.n >= 2) rewall(ctx, H, r, B.gl_etched);
      walls(ctx, H, r, [['gl_cut', 2], ['gl_tablet', 1]], 0.3, { gl_tablet: () => L.tablet() });
  }
}

// Each room set about with the Gullet's things, spaced out.
const DECOR = {
  entry: [['gl_lamp', 1], ['gl_jars', 1], ['gl_roots', 1]],
  exit: [['gl_roots', 1], ['gl_column', 1]],
  acid: [['gl_bones', 2], ['gl_roots', 1]],
  eggs: [['gl_bones', 1], ['gl_skin', 1]],
  quake: [['gl_column', 1], ['gl_lion', 1]],
  bones: [['gl_jars', 1], ['gl_roots', 1]],
  leech_pool: [['gl_roots', 1], ['gl_bones', 1]],
  tunnel: [['gl_roots', 2], ['gl_column', 1]],
  throat: [['gl_roots', 2]],
  nest: [['gl_skin', 1], ['gl_bones', 1]],
  trap: [['gl_bones', 1]],
  treasure: [['gl_jars', 1], ['gl_hoard', 1]],
  guard: [['gl_lamp', 1], ['gl_column', 1]],
  bore: [['gl_roots', 2], ['gl_jars', 1]],
  street: [['gl_jars', 2], ['gl_lamp', 1], ['gl_oven', 1]],
  temple: [['gl_lamp', 1], ['gl_jars', 1]],
  canal: [['gl_jars', 1], ['gl_lamp', 1]],
  clutch: [['gl_bones', 1]],
  shed: [['gl_bones', 1], ['gl_roots', 1]],
  hoard: [['gl_hoard', 1], ['gl_jars', 1]],
  boss: [['gl_skin', 2], ['gl_bones', 2]],
};
const SOLID = new Set(['gl_jars', 'gl_lamp', 'gl_oven', 'gl_column', 'gl_lion', 'gl_bones', 'gl_skin', 'gl_hoard']);
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
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 24) * rng.float(0.8, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], rng.int(0, 1), SOLID.has(k));
      if (!at) break;
      let close = set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2) || BLOCKS[b.get(at.x, FY - 1, at.z)].liquid;
      for (let oz = -1; oz <= 1 && !close; oz++) for (let ox = -1; ox <= 1; ox++) if ((ox || oz) && plan.at(at.x + ox, at.z + oz) && b.get(at.x + ox, FY, at.z + oz) !== B.air && SOLID.has(BLOCKS[b.get(at.x + ox, FY, at.z + oz)].name)) close = true;
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
const MOVABLE = new Set(['gl_jars', 'gl_lamp', 'gl_oven', 'gl_well', 'gl_column', 'gl_lion', 'gl_bones', 'gl_skin', 'gl_hoard', 'gl_cart', 'gl_stall', 'gl_eggs', 'gl_throne', 'gl_tablets', 'rubble', 'stalagmite', 'bones', 'skull_pile', 'whale_rib', 'roots', 'void_bloom'].map((k) => B[k]).filter((v) => v !== undefined));
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
        // (A chest walled in counts as what's cut off.)
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
      // (Not the barge's: it's meant to be out there.)
      if (b.get(x, FY - 1, z) === B.gl_deck) continue;
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
  out.falls = (out.falls || []).map((g) => ({ ...g, tiles: g.tiles.filter((q) => at(q) === B.gl_grit) })).filter((g) => g.tiles.length);
  out.sluices = (out.sluices || []).filter((q) => at(q.wheel) === B.gl_wheel);
  out.offerings = (out.offerings || []).filter((q) => at(q, q.y) === B.gl_offering);
  out.bricks = (out.bricks || []).filter((q) => at(q.door) === B.gl_bricked);
  out.clutches = (out.clutches || []).map((g) => ({ ...g, eggs: g.eggs.filter((q) => at(q) === B.gl_eggs) })).filter((g) => g.eggs.length);
  out.lore = (out.lore || []).filter((q) => [FY, FY + 1, FY + 2].some((y) => BLOCKS[at(q, y)]?.interact === 'lore'));
}

export const GULLET_ARCH = {
  own: GULLET_OWN,
  kits,
  // (The bore and the street never lost to the way down.)
  keep: new Set(['bore', 'street']),
  spare: (rng, n, have = []) => {
    const pool = [['bore', 2], ['shed', 1], ['street', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'bore';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
export const GULLET_THINGS = ['gl_eggs', 'gl_column', 'gl_lion', 'gl_jars', 'gl_oven', 'gl_well', 'gl_stall', 'gl_cart', 'gl_offering', 'gl_god', 'gl_wheel', 'gl_barge', 'gl_skin', 'gl_hoard', 'gl_throne', 'gl_tablets', 'gl_roots', 'gl_grit', 'gl_lamp', 'gl_bones'].filter((k) => BLOCKS[B[k]]);
export { META_STATE };
// (Which of its rooms are the city's, which the belly's.)
export { CITY, BELLY };
