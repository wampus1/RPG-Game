// (Round 102) The Tide Grotto, made over: a sea cave on Myrrow's coast that
// the stilt folk dived for pearls, until the tide came in behind one of
// them. Natural and wet, not built: black rock wearing the tide (dry above
// the high-water mark, crowded with barnacles and mussels below it), coral
// grown over everything low, shell sand rippled underfoot; and what people
// made here small and sea-worn (plank walks on stilts, rope ladders, nets,
// shell lanterns, a shrine of shells). Its floors in tiers: the sand flats
// and channels the tide floods; shelves of rock a step up, dry at high
// water; ledges two up along the walls.
//
// A floor of it, beside the old rooms (the tide pools, the reef, the wreck,
// the pearl bed, the fall, the shrine, the traps and the treasure), and
// what its own rooms are:
//   the tidal flat: wet sand the tide covers, a channel through it, rock
//     shelves to stand on; the drowned divers lying on the sand; jellies;
//   the clam beds: giant clams on the flats (open at low water, a pearl in
//     some), urchin beds among them; the shrimpkin;
//   the divers' camp: a boardwalk on stilts along its wall, nets, baskets,
//     the dive-weights, a cold fire, the tide-pole and the tide-bell; the
//     tide-law and the dive-count;
//   the sea-shrine: a floor of shell, the spiral of shells and its prayer,
//     three offering shells, and the sea-door three pearls open;
//   the blowhole: a ledge two up with no way up to it but the blowhole at
//     its foot, which spouts at high water;
//   the eel-run: a long kelp-choked way, moray holes along its walls,
//     urchins;
//   the glow-pool: a deep pool in the dark, glowing anemones round it,
//     jellies in it; the bones of one who stayed.
// About the floor: its papers (see deeps/grottolore.js) made from the
// grotto's own history and its town's.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { grottoLore } from './grottolore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['tideflat', 2], ['clambed', 2], ['eelrun', 1], ['glowpool', 1], ['blowhole', 1], ['tidepool', 2], ['reef', 2], ['wreck', 1], ['pearlbed', 1], ['collapsed', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['divecamp', 'seashrine', 'blowhole', 'glowpool', 'eelrun', 'wreck', 'pearlbed', 'collapsed', 'trap', 'treasure']);
export const GROTTO_OWN = new Set(['tideflat', 'clambed', 'divecamp', 'seashrine', 'blowhole', 'eelrun', 'glowpool']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: a tidal flat at the head of the list, made its
  // hall.)
  if (last) out.push('tideflat');
  // The divers' camp on the first floor; the shrine (its sea-door), and the
  // clam beds that give the pearls for it, together.
  if (n === 0) out.push('divecamp');
  if (n === 0 || rng.chance(0.6)) out.push('seashrine', 'clambed');
  if (!out.includes('tideflat')) out.push('tideflat');
  if (rng.chance(0.5)) out.push('blowhole');
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
  tideflat: [[11, 15], [9, 12]], clambed: [[10, 13], [8, 10]], divecamp: [[10, 13], [7, 9]], seashrine: [[9, 11], [7, 9]],
  blowhole: [[9, 12], [7, 9]], eelrun: [[13, 17], [5, 6]], glowpool: [[10, 13], [9, 11]],
};
const SHAPES = { tideflat: ['cave', 'round'], clambed: ['cave', 'round'], divecamp: ['rect', 'cave'], seashrine: ['round'], blowhole: ['rect', 'cave'], eelrun: ['rect'], glowpool: ['round', 'cave'] };

// The master at the bottom: chosen from the grotto's own seed, so every
// floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6704) % list.length] : null;
};
const Lof = (ctx) => ctx.grottoLore || (ctx.grottoLore = grottoLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const lifted = (ctx, x, z) => (ctx.lifted ||= new Set()).add(key(ctx, x, z));
const abs = (ctx, t) => ({ x: ctx.b.x0 + t.x, z: t.z });
const clear = (ctx, H, r, x, z) => free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z);
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
// The south wall's tiles (the row under the room), for the morays there.
function southWall(ctx, r) {
  const out = [];
  for (let x = r.x0; x <= r.x1; x++) {
    let z = r.z1;
    while (z >= r.z0 && ctx.plan.room[z * ctx.W + x] !== r.id) z--;
    if (z < r.z0 || ctx.plan.at(x, z + 1)) continue;
    out.push({ x, z: z + 1 });
  }
  return out;
}
// A wall tile given another face (both its rows), if it's still the
// grotto's own rock.
function face(ctx, w, id) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id);
  return true;
}
// A patch of another floor, soft-edged: never over a floor that means
// something (the shrine's shell, an urchin bed).
const KEEP_FLOOR = new Set([B.gt_mosaic, B.gt_urchins]);
function patch(ctx, H, r, id, cx, cz, rad) {
  for (let z = Math.floor(cz - rad); z <= Math.ceil(cz + rad); z++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z) || KEEP_FLOOR.has(ctx.b.get(x, ctx.FY - 1, z))) continue;
      if (Math.hypot(x - cx, (z - cz) * 1.2) <= rad + ctx.rng.float(-0.6, 0.3)) floorAt(ctx, x, z, id);
    }
  }
}
// The tiles of the room, free and clear of its ways in.
const tilesOf = (ctx, H, r) => {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (clear(ctx, H, r, x, z)) out.push({ x, z });
  return out;
};
// The flats: the room's middle laid with the wet sand the tide covers,
// soft at its edge (a rim of dry sand left by the walls and the ways in).
function flats(ctx, H, r, frac = 0.62) {
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  const out = [];
  for (const t of tilesOf(ctx, H, r)) {
    const q = Math.hypot((t.x - r.cx) / (w * 0.5), (t.z - r.cz) / (d * 0.5)) + ctx.rng.float(-0.08, 0.08);
    if (q > frac || H.byWall(ctx.plan, t.x, t.z)) continue;
    floorAt(ctx, t.x, t.z, B.gt_wetsand);
    out.push(t);
  }
  return out;
}
// A shelf of rock a step up out of the flats (two by two, or three by
// two): where you stand when the tide's in.
function shelf(ctx, H, r, cx, cz, w = 2, d = 2) {
  const tiles = [];
  // (Never beside the channel: a shelf's two steps over the water.)
  const wet = (x, z) => ctx.sunk?.has(key(ctx, x, z));
  for (let z = cz; z < cz + d; z++) for (let x = cx; x < cx + w; x++) if (clear(ctx, H, r, x, z) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => wet(x + ox, z + oz))) tiles.push({ x, z });
  if (tiles.length < Math.max(2, w * d - 1)) return [];
  for (const t of tiles) raise(ctx, H, t.x, t.z, B.gt_shelf);
  // (Its rock steps, on the side toward the room's middle.)
  const t = tiles[0];
  const sides = [[t.x - 1, t.z, 3], [t.x, t.z - 1, 0], [t.x + w, t.z, 1], [t.x, t.z + d, 2]];
  sides.sort((a, c) => Math.hypot(a[0] - r.cx, a[1] - r.cz) - Math.hypot(c[0] - r.cx, c[1] - r.cz));
  for (const [sx, sz, rot] of sides) {
    if (!clear(ctx, H, r, sx, sz)) continue;
    ctx.b.set(sx, H.FY, sz, B.gt_shelfsteps, rot);
    lifted(ctx, sx, sz);
    break;
  }
  return tiles;
}
// A channel sunk across the room, water in it always (two deep at high
// water: swum).
function channel(ctx, H, r) {
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  const out = [];
  const lo = along ? r.x0 + 1 : r.z0 + 1;
  const hi = along ? r.x1 - 1 : r.z1 - 1;
  let off = 0;
  for (let u = lo; u <= hi; u++) {
    if (ctx.rng.chance(0.25)) off = Math.max(-1, Math.min(1, off + ctx.rng.pick([-1, 1])));
    const t = along ? { x: u, z: r.cz + off } : { x: r.cx + off, z: u };
    if (!clear(ctx, H, r, t.x, t.z)) continue;
    out.push(t);
  }
  // (Never a run of it straight across a doorway's line: those stay dry.)
  for (const t of out) sink(ctx, H, t.x, t.z, B.gt_shelf, true);
  return out;
}
// The tiles along one wall of the room, clear of the ways in.
function rimRow(ctx, H, r, side = 'n') {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!clear(ctx, H, r, x, z)) continue;
      const wallAt = side === 'n' ? !ctx.plan.at(x, z - 1) : side === 's' ? !ctx.plan.at(x, z + 1) : side === 'w' ? !ctx.plan.at(x - 1, z) : !ctx.plan.at(x + 1, z);
      if (!wallAt) continue;
      if (H.doorways(ctx.plan, r).some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) <= 2)) continue;
      out.push({ x, z });
    }
  }
  return out;
}
// An urchin bed: a few tiles of them in the sand, apart.
function urchins(ctx, H, r, n, onFlats = null) {
  const pool = (onFlats || tilesOf(ctx, H, r)).filter((t) => clear(ctx, H, r, t.x, t.z));
  const set = [];
  for (const t of ctx.rng.shuffle(pool)) {
    if (set.length >= n) break;
    if (set.some((q) => Math.abs(q.x - t.x) + Math.abs(q.z - t.z) < 2)) continue;
    floorAt(ctx, t.x, t.z, B.gt_urchins);
    set.push(t);
  }
  return set;
}
// A moray's hole in a wall of the room (north or south, where it's seen),
// and the moray in it, its head out into the room.
function moray(ctx, H, r, side = null) {
  const { rng } = ctx;
  const walls = [];
  for (const s of side ? [side] : ['n', 's']) {
    for (const w of s === 'n' ? northWall(ctx, r) : southWall(ctx, r)) {
      const f = { x: w.x, z: w.z + (s === 'n' ? 1 : -1) };
      if (!clear(ctx, H, r, f.x, f.z)) continue;
      if (ctx.out.spawns.some((q) => q.x === ctx.b.x0 + f.x && q.z === f.z)) continue;
      walls.push({ w, f, out: s === 'n' ? 1 : -1 });
    }
  }
  for (const c of rng.shuffle(walls)) {
    if (!face(ctx, c.w, B.gt_eelhole)) continue;
    put(ctx, 'moray', c.f.x, c.f.z, r, { hole: abs(ctx, c.w), out: { x: 0, z: c.out } });
    return c;
  }
  return null;
}

// --------------------------------------------------------------- the rooms
// The tidal flat: the wet sand the tide covers, a channel through it,
// shelves of rock to stand on; the drowned divers lying where they fell;
// jellies in the channel.
function tideflat(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const sand = flats(ctx, H, r, 0.72);
  const ch = rng.chance(0.75) ? channel(ctx, H, r) : [];
  // Shelves out on the flats (two or three), and one by the wall.
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  let shelves = [];
  for (const [fx, fz] of rng.shuffle([[0.22, 0.25], [0.7, 0.3], [0.3, 0.68], [0.68, 0.7]]).slice(0, rng.int(2, 3))) {
    const s = shelf(ctx, H, r, Math.round(r.x0 + w * fx), Math.round(r.z0 + d * fz), rng.int(2, 3), 2);
    shelves = shelves.concat(s);
  }
  // Something up on a shelf now and then: anemones, a basket the divers left.
  for (const t of rng.shuffle(shelves.slice()).slice(0, 2)) if (b.get(t.x, FY + 1, t.z) === B.air) b.set(t.x, FY + 1, t.z, rng.chance(0.6) ? B.gt_anemone : B.gt_basket, rng.int(0, 1));
  // Kelp along the channel.
  for (const t of rng.shuffle(ch.slice()).slice(0, 3)) {
    const k = near(ctx, H, r, t.x, t.z + 1, 1);
    if (k && ctx.plan.at(k.x, k.z + 1)) b.set(k.x, FY, k.z, B.gt_kelp);
  }
  // The drowned divers lying on the sand (they rise with the tide), a
  // jelly in the channel, a crab.
  const g = groupOf(ctx, r, 'flat');
  for (const t of rng.shuffle(sand.filter((q) => clear(ctx, H, r, q.x, q.z))).slice(0, rng.int(1, 2))) put(ctx, 'drowned_diver', t.x, t.z, r, { group: g, lying: true });
  for (const t of rng.shuffle(ch.slice()).slice(0, rng.int(1, 2))) put(ctx, 'lantern_jelly', t.x, t.z, r, { group: g });
  if (rng.chance(0.5)) band(ctx, H, r, ['reef_crab'], { x: r.cx, z: r.cz }, 'flat');
  // A diver's bones at the flat's edge, and what they scratched in a shell.
  const bt = place(ctx, H, r, B.gt_bones, rng.int(0, 1));
  if (bt && rng.chance(0.6)) lore(ctx, bt.x, bt.z, L.shell());
}
// The clam beds: giant clams in rows on the flats (they open at low water,
// a pearl in some), urchins between; the shrimpkin; crabs.
function clambed(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const sand = flats(ctx, H, r, 0.8);
  const set = [];
  for (let z = r.z0 + 2; z <= r.z1 - 2; z += 3) {
    for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
      const t = { x: x + rng.int(-1, 0), z };
      if (!clear(ctx, H, r, t.x, t.z) || !ctx.plan.at(t.x, t.z + 1) || set.length >= 5) continue;
      b.set(t.x, FY, t.z, B.gt_clam);
      set.push(t);
    }
  }
  // (A pearl in about half of them; the first always.)
  for (const [i, t] of set.entries()) (out.clams ||= []).push({ ...abs(ctx, t), pearl: i === 0 || rng.chance(0.45), room: r.id });
  urchins(ctx, H, r, rng.int(3, 5), sand);
  const g = groupOf(ctx, r, 'beds');
  band(ctx, H, r, rng.chance(0.5) ? ['shrimpkin', 'shrimpkin'] : ['shrimpkin'], { x: r.cx, z: r.cz }, 'shrimp', { peaceful: true });
  band(ctx, H, r, ['reef_crab', rng.chance(0.5) ? 'reef_crab' : 'drowned_diver'], { x: r.cx + 2, z: r.cz }, 'beds');
  if (rng.chance(0.4)) put(ctx, 'lantern_jelly', r.cx - 2, r.cz, r, { group: g });
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.gt_anemone, rng.int(0, 1));
}
// The divers' camp: a boardwalk on stilts along its back wall (nets hung
// on it, baskets, the dive-weights), a cold fire, the tide-pole, the
// tide-bell; the tide-law and the dive-count.
function divecamp(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  // The boardwalk.
  const row = longestRun(rimRow(ctx, H, r, 'n'), true);
  if (row.length >= 4) {
    const deck = row.slice(0, Math.min(row.length, 7));
    for (const t of deck) raise(ctx, H, t.x, t.z, B.gt_boardwalk);
    for (const [i, t] of deck.entries()) {
      if (b.get(t.x, FY + 1, t.z) !== B.air) continue;
      if (i % 3 === 1) b.set(t.x, FY + 1, t.z, B.gt_net);
      else if (i % 3 === 2 && rng.chance(0.6)) b.set(t.x, FY + 1, t.z, rng.chance(0.5) ? B.gt_basket : B.gt_weights, rng.int(0, 1));
    }
  }
  // The tide-law, burned into the camp's wall; the dive-count by it.
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  const wl = wall[Math.floor(wall.length * 0.3)];
  const wc = wall[Math.floor(wall.length * 0.7)];
  if (wl && face(ctx, wl, B.gt_tidemark)) lore(ctx, wl.x, wl.z, L.count());
  if (wc && wc !== wl && face(ctx, wc, B.gt_carving)) lore(ctx, wc.x, wc.z, L.law());
  // The cold fire in the middle; the tide-pole and the bell by the water.
  const f = near(ctx, H, r, r.cx, r.cz + 1, 2, (x, z) => ctx.plan.at(x, z + 1));
  if (f) b.set(f.x, FY, f.z, B.gt_firering);
  const tp = near(ctx, H, r, r.x0 + 1, r.cz + 1, 3, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z));
  if (tp) {
    b.set(tp.x, FY, tp.z, B.gt_tidepole);
    lore(ctx, tp.x, tp.z, L.pole());
  }
  const bl = near(ctx, H, r, r.x1 - 1, r.cz + 1, 3, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z));
  if (bl) {
    b.set(bl.x, FY, bl.z, B.gt_bell);
    (out.bells ||= []).push({ ...abs(ctx, bl), room: r.id });
  }
  // A strip of the flats at the camp's foot, where they went in.
  patch(ctx, H, r, B.gt_wetsand, r.cx, r.z1 - 1, 2.2);
  for (let i = 0; i < 2; i++) place(ctx, H, r, rng.chance(0.5) ? B.gt_driftwood : B.gt_basket, rng.int(0, 1), true);
  // The camp's own still here: two of its divers, and the shrimpkin.
  band(ctx, H, r, ['drowned_diver', 'drowned_diver'], { x: r.cx, z: r.z1 - 1 }, 'camp', { dormant: 0, lying: true });
  if (rng.chance(0.5)) band(ctx, H, r, ['shrimpkin'], { x: r.cx - 2, z: r.cz }, 'shrimp', { peaceful: true });
}
// The sea-shrine: a floor of shell, the spiral of shells and its prayer,
// the carving of the Mother; three offering shells, and the sea-door
// behind them that three pearls open.
function seashrine(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && Math.hypot(x - r.cx, (z - r.cz) * 1.2) <= 3.2) floorAt(ctx, x, z, B.gt_mosaic);
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  const ws = wall[Math.floor(wall.length / 2)];
  let spiral = null;
  if (ws && face(ctx, ws, B.gt_shellwall)) spiral = ws;
  for (const w of [wall[1], wall[wall.length - 2]]) if (w && w !== ws && rng.chance(0.6)) face(ctx, w, B.gt_glowwall);
  // The three offering shells in an arc before the spiral.
  const shells = [];
  for (const ox of [-2, 0, 2]) {
    const s = near(ctx, H, r, r.cx + ox, r.cz, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z) && !shells.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 2));
    if (!s) break;
    b.set(s.x, FY, s.z, B.gt_scallop);
    shells.push(s);
  }
  // The sea-door: a pocket behind the wall, the founder's own pearls in it.
  const pk = shells.length === 3 ? pocket(ctx, H, r, B.gt_rock) : null;
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.gt_seadoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['pearl', rng.int(3, 6)], [rng.pick(['pearl_necklace', 'gem']), 1]], H.foundIn(ctx, false)));
    for (const c of pk.cells) if (c !== back && rng.chance(0.4) && b.get(c.x, FY, c.z) === B.air && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z)) b.set(c.x, FY, c.z, rng.chance(0.5) ? B.gt_cairn : B.gt_anemone, rng.int(0, 1));
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.shells ||= []).push({ shells: shells.map((q) => abs(ctx, q)), door: abs(ctx, pk.door), room: r.id });
    if (spiral) lore(ctx, spiral.x, spiral.z, L.prayer());
  } else {
    // (No door to open: the shells only shells, and the spiral its prayer.)
    for (const q of shells) b.set(q.x, FY, q.z, B.gt_cairn);
    if (spiral) lore(ctx, spiral.x, spiral.z, L.prayer());
  }
  // The shell lanterns, a cairn, the carving of the Mother.
  for (const ox of [-3, 3]) {
    const s = near(ctx, H, r, r.cx + ox, r.cz - 2, 1, (x, z) => ctx.plan.at(x, z + 1) && !H.doorBlocked(ctx.plan, r, x, z));
    if (s) b.set(s.x, FY, s.z, B.gt_lantern);
  }
  const c = place(ctx, H, r, B.gt_cairn, 0, true);
  if (c) lore(ctx, c.x, c.z, L.cairn());
  // Its keepers: a drowned diver, and the jellies that drift in.
  band(ctx, H, r, ['drowned_diver', 'reef_crab'], { x: r.cx, z: r.cz + 2 }, 'shrine');
  if (rng.chance(0.5)) band(ctx, H, r, ['lantern_jelly'], { x: r.cx, z: r.cz + 1 }, 'shrine');
}
// The blowhole: a ledge two up along the back wall, something kept up
// there; no way up but the blowhole at its foot, which spouts at high
// water and throws whoever's on it up.
function blowhole(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const ledge = longestRun(row0, S.along);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const mid = Math.floor(ledge.length / 2);
  const li = ledge.length >= 3 ? [mid, mid - 1, mid + 1].find((i) => i > 0 && i < ledge.length - 1 && clear(ctx, H, r, front(ledge[i]).x, front(ledge[i]).z)) : undefined;
  flats(ctx, H, r, 0.7);
  if (li !== undefined) {
    for (const t of ledge) raise(ctx, H, t.x, t.z, B.gt_rock, 2);
    const lt = ledge[li];
    const far = li > (ledge.length - 1) / 2 ? ledge[0] : ledge[ledge.length - 1];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.6, ctx.T), ['pearl', rng.int(1, 3)]], H.foundIn(ctx, false)));
    for (const t of ledge) if (t !== far && t !== lt && rng.chance(0.35)) b.set(t.x, FY + 2, t.z, B.gt_anemone, rng.int(0, 1));
    const f = front(lt);
    floorAt(ctx, f.x, f.z, B.gt_shelf);
    b.set(f.x, FY, f.z, B.gt_blowhole);
    ctx.reserved.add(key(ctx, f.x, f.z));
    (out.blowholes ||= []).push({ ...abs(ctx, f), top: { ...abs(ctx, lt), y: FY + 2 }, room: r.id });
  }
  moray(ctx, H, r);
  urchins(ctx, H, r, rng.int(1, 2));
  band(ctx, H, r, ['reef_crab', 'drowned_diver'], { x: r.cx, z: r.cz + 1 }, 'spout');
}
// The eel-run: a long low way choked with kelp, moray holes along its
// walls, urchins underfoot.
function eelrun(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const tiles = tilesOf(ctx, H, r);
  let n = 0;
  for (const t of rng.shuffle(tiles)) {
    if (n >= Math.max(3, tiles.length / 12)) break;
    if (!ctx.plan.at(t.x, t.z + 1) || !clear(ctx, H, r, t.x, t.z)) continue;
    // (Kelp by the walls, and never two side by side: a way left through.)
    if (!H.byWall(ctx.plan, t.x, t.z) && rng.chance(0.7)) continue;
    let near = false;
    for (let oz = -2; oz <= 2 && !near; oz++) for (let ox = -2; ox <= 2; ox++) if (b.get(t.x + ox, FY, t.z + oz) === B.gt_kelp) near = true;
    if (near) continue;
    b.set(t.x, FY, t.z, B.gt_kelp);
    n++;
  }
  moray(ctx, H, r, 'n');
  if (rng.chance(0.7)) moray(ctx, H, r, 's');
  urchins(ctx, H, r, rng.int(2, 4));
  patch(ctx, H, r, B.gt_wetsand, r.cx, r.cz, 2.4);
  if (rng.chance(0.6)) band(ctx, H, r, ['drowned_diver'], { x: r.cx, z: r.cz }, 'run', { dormant: 0, lying: true });
}
// The glow-pool: a deep pool in the dark, the glowing anemones round it,
// the algae on its walls; jellies in it; the bones of the one who stayed.
function glowpool(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  const pool = [];
  for (const t of tilesOf(ctx, H, r)) {
    const q = Math.hypot((t.x - r.cx) / (w * 0.5), (t.z - r.cz) / (d * 0.5));
    if (q < 0.5 && !H.byWall(ctx.plan, t.x, t.z)) pool.push({ ...t, q });
  }
  for (const t of pool) sink(ctx, H, t.x, t.z, B.gt_shelf, true);
  // (Deep in its heart: water two deep, swum.)
  for (const t of pool) {
    if (t.q > 0.28) continue;
    ctx.b.set(t.x, FY - 2, t.z, B.water);
    ctx.b.set(t.x, FY - 3, t.z, B.gt_shelf);
  }
  for (const wl of northWall(ctx, r)) if (rng.chance(0.45)) face(ctx, wl, B.gt_glowwall);
  // The anemones round its rim.
  const rim = tilesOf(ctx, H, r).filter((t) => pool.some((p) => Math.abs(p.x - t.x) + Math.abs(p.z - t.z) === 1) && ctx.plan.at(t.x, t.z + 1));
  for (const [i, t] of rng.shuffle(rim).slice(0, 5).entries()) b.set(t.x, FY, t.z, B.gt_anemone, i % 2);
  // The one who stayed.
  const bt = place(ctx, H, r, B.gt_bones, rng.int(0, 1));
  if (bt) lore(ctx, bt.x, bt.z, L.shell());
  place(ctx, H, r, B.gt_basket, rng.int(0, 1), true);
  // What's in it.
  const g = groupOf(ctx, r, 'pool');
  for (const t of rng.shuffle(pool.slice()).slice(0, rng.int(2, 3))) put(ctx, 'lantern_jelly', t.x, t.z, r, { group: g });
  band(ctx, H, r, ['shrimpkin'], { x: r.cx, z: r.z1 - 1 }, 'shrimp', { peaceful: true });
  if (rng.chance(0.5)) band(ctx, H, r, ['drowned_diver'], { x: r.cx + 2, z: r.z1 - 1 }, 'pool');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'tideflat':
      return tideflat(ctx, H, r);
    case 'clambed':
      return clambed(ctx, H, r);
    case 'divecamp':
      return divecamp(ctx, H, r);
    case 'seashrine':
      return seashrine(ctx, H, r);
    case 'blowhole':
      return blowhole(ctx, H, r);
    case 'eelrun':
      return eelrun(ctx, H, r);
    case 'glowpool':
      return glowpool(ctx, H, r);
  }
}

// What the old rooms set about, the grotto's own instead: its coral, its
// kelp, its clams (shut, for now: they open with the tide), its stones.
const OWN_OF = new Map([[B.coral, B.gt_coral], [B.kelp, B.gt_kelp], [B.giant_clam, B.gt_clam], [B.rubble, B.gt_boulder], [B.brazier, B.gt_lantern]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const kept = [];
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      const to = OWN_OF.get(id);
      if (!to) continue;
      // (Thinned where the old room crowded them: never two side by side.)
      if ((to === B.gt_coral || to === B.gt_kelp) && kept.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 2)) {
        b.set(x, H.FY, z, B.air);
        continue;
      }
      if (to === B.gt_coral || to === B.gt_kelp) kept.push({ x, z });
      b.set(x, H.FY, z, to, to === B.gt_coral ? (x * 7 + z * 3) % 4 : 0);
      if (to === B.gt_clam) (out.clams ||= []).push({ x: b.x0 + x, z, pearl: ctx.rng.chance(0.4), room: r.id });
    }
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and the
// grotto's own about them.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  ownThings(ctx, H, r);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the stilt folk's carving of the Mother, and
      // the story cut under her.
      if (ctx.n === 0) {
        const w = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
        const c = w[Math.floor(w.length / 2)];
        if (c && face(ctx, c, B.gt_carving)) lore(ctx, c.x, c.z, L.carving());
      }
      break;
    }
    case 'tidepool':
      // The pools left by the tide: anemones by them, a crab's shelf.
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.gt_anemone, rng.int(0, 1));
      if (rng.chance(0.5)) band(ctx, H, r, ['lantern_jelly'], { x: r.cx, z: r.cz }, 'pools');
      break;
    case 'reef':
      for (let i = 0; i < 2; i++) place(ctx, H, r, B.gt_coral, rng.int(0, 3), true);
      if (rng.chance(0.5)) moray(ctx, H, r);
      break;
    case 'wreck': {
      // The boat that came in after them: its ribs on the sand, its log.
      const h = place(ctx, H, r, B.gt_hull, rng.int(0, 1), true);
      if (h) lore(ctx, h.x, h.z, L.log());
      place(ctx, H, r, B.gt_driftwood, rng.int(0, 1));
      break;
    }
    case 'pearlbed':
      // (Its clams are the grotto's own now: see ownThings.) Urchins.
      urchins(ctx, H, r, rng.int(1, 3));
      band(ctx, H, r, ['shrimpkin'], { x: r.cx, z: r.cz }, 'shrimp', { peaceful: true });
      break;
    case 'shrine': {
      const c = place(ctx, H, r, B.gt_cairn, 0, true);
      if (c) lore(ctx, c.x, c.z, L.cairn());
      place(ctx, H, r, B.gt_lantern, 0, true);
      break;
    }
    case 'boss': {
      // What's at its master's door: a cairn of shells for the drowned,
      // against the wall, off the middle of the hall.
      const at = near(ctx, H, r, r.cx, r.z1 - 1, 5, (x, z) => H.byWall(ctx.plan, x, z) && Math.abs(x - r.cx) >= 2);
      if (at) {
        b.set(at.x, FY, at.z, B.gt_cairn);
        lore(ctx, at.x, at.z, L.last());
      }
      break;
    }
  }
}

// Each room set about with the grotto's things, by what it is, spaced
// out, the solid ones against the walls; its walls given their faces; its
// floor its drifts of shingle.
const DECOR = {
  entry: [['gt_lantern', 1], ['gt_driftwood', 1], ['gt_kelp', 1]],
  exit: [['gt_lantern', 1], ['gt_coral', 1]],
  tidepool: [['gt_kelp', 2], ['gt_coral', 1]],
  reef: [['gt_coral', 2], ['gt_anemone', 1]],
  wreck: [['gt_driftwood', 2], ['gt_basket', 1]],
  pearlbed: [['gt_anemone', 1], ['gt_coral', 1]],
  collapsed: [['gt_boulder', 2], ['gt_driftwood', 1]],
  shrine: [['gt_anemone', 1], ['gt_coral', 1]],
  trap: [['gt_bones', 1]],
  treasure: [['gt_basket', 1], ['gt_coral', 1]],
  tideflat: [['gt_coral', 1], ['gt_kelp', 1], ['gt_boulder', 1]],
  clambed: [['gt_coral', 1], ['gt_kelp', 1]],
  divecamp: [['gt_lantern', 1], ['gt_driftwood', 1]],
  seashrine: [['gt_anemone', 1]],
  blowhole: [['gt_coral', 1], ['gt_boulder', 1]],
  eelrun: [['gt_coral', 1]],
  glowpool: [['gt_anemone', 1], ['gt_coral', 1]],
};
const SOLID = new Set(['gt_coral', 'gt_basket', 'gt_lantern', 'gt_boulder', 'gt_weights', 'gt_hull']);
const ROT = new Set(['gt_coral', 'gt_anemone', 'gt_basket', 'gt_driftwood', 'gt_boulder', 'gt_bones']);
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
  // Its floor: a drift of shingle by a wall, now and then.
  if (r.kit !== 'seashrine' && rng.chance(0.4)) {
    const w = rng.pick(tilesOf(ctx, H, r).filter((t) => H.byWall(plan, t.x, t.z))) || null;
    if (w) patch(ctx, H, r, B.gt_pebbles, w.x, w.z, rng.float(1.0, 1.8));
  }
  // Its walls: mussels thick now and then, coral grown up them, the glow.
  for (const w of northWall(ctx, r)) {
    const p = rng.float(0, 1);
    if (p < 0.1) face(ctx, w, B.gt_mussels);
    else if (p < 0.16) face(ctx, w, B.gt_coralwall);
    else if (p < 0.21) face(ctx, w, B.gt_glowwall);
  }
  // And its things, spaced out.
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 24) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], ROT.has(k) ? rng.int(0, 3) : 0, SOLID.has(k));
      if (!at) break;
      let near = set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2);
      // (Nor hard by what the room's own kit set down.)
      for (let oz = -1; oz <= 1 && !near; oz++) for (let ox = -1; ox <= 1; ox++) if ((ox || oz) && plan.at(at.x + ox, at.z + oz) && b.get(at.x + ox, FY, at.z + oz) !== B.air) near = true;
      if (near) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      set.push(at);
      break;
    }
  }
}

// Its architect's last word: where the tide comes in on this floor (the
// flats, the urchin beds, the channels and pools) and the clams that are
// still to be found where something was laid over them.
function after(ctx) {
  const { out, b, plan } = ctx;
  const FY = ctx.FY;
  const tide = [];
  for (let z = 0; z < ctx.D; z++) {
    for (let x = 0; x < ctx.W; x++) {
      if (!plan.at(x, z)) continue;
      const f = b.get(x, FY - 1, z);
      const top = b.get(x, FY, z);
      if ((f === B.gt_wetsand || f === B.gt_urchins) && top === B.air) tide.push({ x: b.x0 + x, z });
      else if (f === B.water && top === B.air) tide.push({ x: b.x0 + x, z, deep: true });
    }
  }
  out.tide = tide;
  out.clams = (out.clams || []).filter((c) => b.get(c.x - b.x0, FY, c.z) === B.gt_clam);
}

export const GROTTO_ARCH = {
  own: GROTTO_OWN,
  kits,
  // (The divers' camp, the shrine and its clam beds never lost to the way
  // down.)
  keep: new Set(['divecamp', 'seashrine', 'clambed']),
  spare: (rng, n, have = []) => {
    const pool = [['tideflat', 2], ['tidepool', 1], ['reef', 1], ['clambed', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'tidepool';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a grotto's own things are, for those who count them.)
export const GROTTO_THINGS = ['gt_kelp', 'gt_coral', 'gt_anemone', 'gt_clam', 'gt_scallop', 'gt_net', 'gt_basket', 'gt_tidepole', 'gt_bell', 'gt_weights', 'gt_hull', 'gt_lantern', 'gt_blowhole', 'gt_bones', 'gt_cairn', 'gt_driftwood', 'gt_firering', 'gt_boulder'].filter((k) => BLOCKS[B[k]]);
