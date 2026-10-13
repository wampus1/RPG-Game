// (Round 104) The Terracotta Vault, made over: an emperor of Ostria sealed
// into his hill with an army of clay to guard him. Two layers of making:
// the army's pits, older-seeming and all dust (walls of rammed earth in its
// layers, timber posts, grey brick floors, roof-beams fallen in), with the
// army standing in its trenches rank on rank, every face different, all
// facing the way you came in; and the palace within, kept as it was (black
// and red lacquer, gold, bronze, jade, polished black stone), with the
// empire laid out in little and its rivers running in quicksilver. Large
// and many-roomed; its verticality the trenches: the army stands down in
// them, the earth ridges between them at the floor's height, so you walk
// the ridges looking down on the clay faces. Some of the faces aren't clay.
//
// A floor of it, beside the old rooms (the soldiers' hall, the lantern
// hall, the pillared hall, the shrine, the cache, the traps, the treasure,
// the guard, the fall), and what its own rooms are:
//   the pit: the army in its trenches, sunk a step, two wide (the soldiers
//     in the far row, an aisle before them), the ridges between; the drum
//     at its head and the officer who beats it; the muster on a stele;
//     fallen beams;
//   the stable: the chariot pit: the clay horses in their team, the
//     crossbowmen kneeling behind them;
//   the hall: the palace's court: black lacquer walls, red columns in two
//     rows, the dais at its head with the throne, screens, the bronze
//     cauldrons, the lamps; the court's jade dead;
//   the rivers: the empire in little: rivers of quicksilver sunk across a
//     floor of black stone, bronze bridges over them, bronze mountains;
//     beads of the quicksilver rolling about it;
//   the workshop: the artisans': loess floor, the kiln, the shelves of
//     heads, soldiers half made, clay, shards; the sealed artisans still at
//     work (they mend the broken); their tally on the wall, and the crack by
//     it that gives onto the tunnel they dug;
//   the directions: the shrine of the five directions: a floor of jade
//     in black stone, the four beasts on the wall, five jade discs on
//     pedestals in a cross; set each to its colour and the chamber behind
//     the bronze door opens;
//   the gallery: the crossbow gallery: stone armour on its stands, racks of
//     arms; the crossbows in the north wall, and the plates in the floor
//     that loose them down the line.
// About the floor: its papers (see deeps/vaultlore.js) made from the vault's
// own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { vaultLore, DIRECTIONS } from './vaultlore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket } from './common.js';

const POOL = [['pit', 3], ['stable', 1], ['rivers', 1], ['workshop', 1], ['gallery', 1], ['soldiers', 1], ['lanterns', 1], ['shrine', 1], ['pillared', 1], ['cache', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['hall', 'stable', 'rivers', 'workshop', 'directions', 'gallery', 'lanterns', 'shrine', 'pillared', 'cache', 'trap', 'treasure']);
export const VAULT_OWN = new Set(['pit', 'stable', 'hall', 'rivers', 'workshop', 'directions', 'gallery']);
// The colours of the discs, as blocks, in the order of the directions'
// colours (green, red, white, black, yellow).
export const DISCS = ['tv_disc_green', 'tv_disc_red', 'tv_disc_white', 'tv_disc_black', 'tv_disc_yellow'];

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: its hall at the head of the list, and the
  // palace's court beside it.)
  if (last) out.push('boss', 'hall');
  // The army's pit on every floor; the shrine of the directions on the
  // first (its chamber), and now and then after; the workshop or the
  // rivers.
  out.push('pit');
  if (n === 0 || rng.chance(0.4)) out.push('directions');
  out.push(rng.pick(['workshop', 'rivers']));
  if (!out.includes('hall') && rng.chance(0.5)) out.push('hall');
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
  pit: [[15, 19], [9, 11]], stable: [[11, 13], [8, 9]], hall: [[13, 15], [10, 12]], rivers: [[13, 15], [10, 12]],
  workshop: [[11, 13], [8, 10]], directions: [[11, 11], [11, 11]], gallery: [[15, 19], [5, 6]],
};
const SHAPES = { pit: ['rect'], stable: ['rect'], hall: ['rect'], rivers: ['rect', 'octagon'], workshop: ['rect'], directions: ['rect'], gallery: ['rect'] };

// The master at the bottom: chosen from the vault's own seed, so every
// floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6904) % list.length] : null;
};
const Lof = (ctx) => ctx.vaultLore || (ctx.vaultLore = vaultLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

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
// A wall tile given another face (both its rows), if it's still the
// vault's own earth.
function face(ctx, w, id, meta = 0) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id, meta);
  return true;
}
// The room's floor laid in another (never where it's been raised or sunk).
function floorAll(ctx, H, r, id, test = null) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && (!test || test(x, z))) floorAt(ctx, x, z, id);
}
const tilesOf = (ctx, H, r) => {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (clear(ctx, H, r, x, z)) out.push({ x, z });
  return out;
};
// A clay soldier set standing (its kind: two of infantry, the kneeling
// crossbowman, the officer); now and then one that isn't clay (`alive`:
// it waits as a statue till you come by: see game/vaultwork.js).
function soldierAt(ctx, x, z, y, kind, alive) {
  ctx.b.set(x, y, z, B.tv_soldier, kind & 3);
  (ctx.out.statues ||= []).push({ x: ctx.b.x0 + x, z, y, kind, alive: !!alive });
}
// How many of them are alive, deeper down more.
const aliveChance = (ctx) => 0.1 + ctx.n * 0.03;
// Lamps along the walls of a room (the kneeling girls), spaced out.
function lampsAlong(ctx, H, r, n) {
  const set = [];
  for (const t of ctx.rng.shuffle(tilesOf(ctx, H, r).filter((q) => H.byWall(ctx.plan, q.x, q.z) && ctx.plan.at(q.x, q.z + 1)))) {
    if (set.length >= n) break;
    if (set.some((q) => Math.abs(q.x - t.x) + Math.abs(q.z - t.z) < 4)) continue;
    if (ctx.b.get(t.x, ctx.FY, t.z) !== B.air) continue;
    ctx.b.set(t.x, ctx.FY, t.z, B.tv_lamp, META_STATE);
    set.push(t);
  }
  return set;
}

// --------------------------------------------------------------- the rooms
// The pit: trenches along the room, two wide, sunk a step, with earth
// ridges between them at the floor's height (and along the walls); the
// clay army in the far row of each trench, facing you, an aisle before
// them; the ends left at the floor's height to walk round by. The drum at
// the head of it and its officer; the muster; the beams fallen in.
function pit(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.tv_loess);
  // The trenches: rows z0+1..z0+2, z0+4..z0+5, ... (a ridge between each).
  const trenches = [];
  for (let z = r.z0 + 1; z + 1 <= r.z1 - 1; z += 3) trenches.push([z, z + 1]);
  const g = groupOf(ctx, r, 'army');
  let alive = 0;
  for (const [ti, [za, zb]] of trenches.entries()) {
    for (let x = r.x0 + 2; x <= r.x1 - 2; x++) {
      if (!clear(ctx, H, r, x, za) || !clear(ctx, H, r, x, zb)) continue;
      sink(ctx, H, x, za, B.tv_brick);
      sink(ctx, H, x, zb, B.tv_brick);
      // The soldiers in the far row (every tile but now and then a gap
      // where one's fallen), the first trench kneeling crossbowmen.
      if (rng.chance(0.12)) {
        b.set(x, FY - 1, za, B.tv_shards, rng.int(0, 1));
        if (rng.chance(0.3)) lore(ctx, x, za, L.mark());
        continue;
      }
      const kind = ti === 0 ? 2 : rng.chance(0.08) ? 3 : rng.int(0, 1);
      const live = alive < 3 + ctx.n && rng.chance(aliveChance(ctx));
      if (live) alive++;
      soldierAt(ctx, x, za, FY - 1, kind, live);
    }
  }
  // The ridges between: a fallen beam across one now and then, the earth
  // it brought down with it.
  for (const [za] of trenches) {
    const rz = za - 1;
    if (rz <= r.z0 || !rng.chance(0.35)) continue;
    const x = rng.int(r.x0 + 3, r.x1 - 3);
    if (clear(ctx, H, r, x, rz)) b.set(x, FY, rz, B.tv_beam, rng.int(0, 1));
  }
  // The drum at the head of it (by the west end), its officer by it.
  const dt = near(ctx, H, r, r.x0, r.z0 + 3, 2, (x, z) => ctx.plan.at(x, z + 1));
  if (dt) {
    b.set(dt.x, FY, dt.z, B.tv_drum);
    const o = near(ctx, H, r, dt.x, dt.z + 1, 2);
    if (o) put(ctx, 'drummer', o.x, o.z, r, { group: g, dormant: 5 });
  }
  // The muster, cut in a stele in the north wall.
  const w = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
  const st = rng.pick(w);
  if (st && face(ctx, st, B.tv_stele)) lore(ctx, st.x, st.z, L.muster());
  // The posts along the walls (the wall's own face with its timber).
  lampsAlong(ctx, H, r, 1);
}
// The stable: the chariot pit. The team of four clay horses abreast, the
// officer before them; crossbowmen kneeling in rows behind; grey brick.
function stable(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, B.tv_brick);
  for (let i = 0; i < 4; i++) {
    const x = r.cx - 2 + i;
    if (clear(ctx, H, r, x, r.cz - 1)) b.set(x, FY, r.cz - 1, B.tv_horse);
  }
  if (clear(ctx, H, r, r.cx, r.cz + 1)) soldierAt(ctx, r.cx, r.cz + 1, FY, 3, false);
  let alive = 0;
  for (const z of [r.z0 + 1, r.z1 - 1]) {
    for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) {
      if (!clear(ctx, H, r, x, z) || Math.abs(x - r.cx) <= 1) continue;
      const live = alive < 2 && rng.chance(aliveChance(ctx) + 0.05);
      if (live) alive++;
      soldierAt(ctx, x, z, FY, 2, live);
    }
  }
  if (rng.chance(0.5)) place(ctx, H, r, B.tv_beam, rng.int(0, 1), true);
}
// The hall: the palace's court. Black lacquer walls (the decree on a
// stele among them), red columns in two rows, the dais at its head with
// the throne on it, screens by it, bronze cauldrons, the girls' lamps,
// lanterns; a floor of black stone, red lacquer laid down its middle; the
// court's jade dead, and the bells.
function hall(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const wide = r.x1 - r.x0 >= 14 ? 2 : 1;
  floorAll(ctx, H, r, B.tv_stone);
  floorAll(ctx, H, r, B.tv_lacquerfloor, (x) => Math.abs(x - r.cx) <= wide - 1);
  const wall = northWall(ctx, r);
  for (const q of wall) face(ctx, q, Math.abs(q.x - r.cx) <= 1 ? B.tv_roundel : B.tv_lacquer);
  const st = wall.filter((q) => Math.abs(q.x - r.cx) >= 3);
  const s = rng.pick(st);
  if (s) {
    for (const y of [FY, FY + 1]) b.set(s.x, y, s.z, B.tv_stele);
    lore(ctx, s.x, s.z, L.decree());
  }
  // The dais: three or five wide, two deep, against the north wall; the
  // throne on it, its steps before its middle.
  const dais = [];
  for (let z = r.z0; z <= r.z0 + 1; z++) for (let x = r.cx - wide; x <= r.cx + wide; x++) if (clear(ctx, H, r, x, z)) dais.push({ x, z });
  if (dais.length >= (2 * wide + 1) * 2 - 1 && clear(ctx, H, r, r.cx, r.z0 + 2)) {
    for (const t of dais) raise(ctx, H, t.x, t.z, B.tv_dais);
    b.set(r.cx, FY, r.z0 + 2, B.tv_daissteps, 0);
    lifted(ctx, r.cx, r.z0 + 2);
    b.set(r.cx, FY + 1, r.z0, B.tv_throne);
    lore(ctx, r.cx, r.z0, L.throne());
    for (const ox of [-wide, wide]) if (b.get(r.cx + ox, FY + 1, r.z0) === B.air) b.set(r.cx + ox, FY + 1, r.z0, B.tv_screen, ox < 0 ? 0 : 1);
  }
  // The columns, in two rows down the hall.
  for (let z = r.z0 + 3; z <= r.z1 - 1; z += 3) {
    for (const ox of [-wide - 2, wide + 2]) {
      const x = r.cx + ox;
      if (clear(ctx, H, r, x, z) && ctx.plan.at(x, z + 1)) b.set(x, FY, z, B.tv_column);
    }
  }
  // Cauldrons, a lantern either side at the foot, lamps along the walls.
  for (const ox of [-wide - 1, wide + 1]) {
    const t = near(ctx, H, r, r.cx + ox, r.z0 + 3, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (t) {
      b.set(t.x, FY, t.z, B.tv_ding);
      lore(ctx, t.x, t.z, L.ding());
    }
  }
  for (const ox of [-3, 3]) {
    const t = near(ctx, H, r, r.cx + ox, r.z1 - 1, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (t) b.set(t.x, FY, t.z, B.tv_lantern, META_STATE);
  }
  lampsAlong(ctx, H, r, 3);
  if (rng.chance(0.6)) place(ctx, H, r, B.tv_bells, 0, true);
  band(ctx, H, r, rng.chance(0.5) ? ['jade_corpse', 'jade_corpse'] : ['jade_corpse', 'quicksilver'], { x: r.cx, z: r.cz + 1 }, 'court');
}
// The rivers: the empire in little. A floor of black stone; two rivers of
// quicksilver sunk across it from wall to wall, winding; a bronze bridge
// over each where the way goes; bronze mountains on the land; the beads.
function rivers(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.tv_stone);
  const span = r.z1 - r.z0;
  const rows = [r.z0 + Math.round(span * 0.33), r.z0 + Math.round(span * 0.7)];
  for (const z0 of rows) {
    let z = z0;
    const bridge = new Set([rng.int(r.x0 + 2, r.cx - 1), rng.int(r.cx + 1, r.x1 - 2)]);
    for (let x = r.x0 + 1; x <= r.x1 - 1; x++) {
      if (x > r.x0 + 1 && rng.chance(0.25)) z = Math.max(z0 - 1, Math.min(z0 + 1, z + rng.pick([-1, 1])));
      if (!clear(ctx, H, r, x, z)) continue;
      if (bridge.has(x)) {
        floorAt(ctx, x, z, B.tv_bridge);
        ctx.reserved.add(key(ctx, x, z));
        continue;
      }
      sink(ctx, H, x, z, B.tv_mercury);
      (out.mercury ||= []).push({ x: b.x0 + x, z });
    }
  }
  // The mountains, on the land between, spaced.
  for (let i = 0; i < 4; i++) place(ctx, H, r, B.tv_mountain, rng.int(0, 1), true);
  const w = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
  const st = rng.pick(w);
  if (st && face(ctx, st, B.tv_stele)) lore(ctx, st.x, st.z, L.map());
  for (const q of northWall(ctx, r)) if (q !== st && ctx.rng.chance(0.35)) face(ctx, q, B.tv_lacquer);
  lampsAlong(ctx, H, r, 1);
  band(ctx, H, r, rng.chance(0.5) ? ['quicksilver', 'quicksilver_bead'] : ['quicksilver', 'quicksilver'], { x: r.cx, z: r.cz }, 'beads');
  // A statue or two of the court left by the rivers: for the beads.
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, r.cx + (i ? 4 : -4), r.cz + 1, 2);
    if (t) soldierAt(ctx, t.x, t.z, FY, 3, false);
  }
}
// The workshop: the artisans'. Loess underfoot; the kiln in the north
// wall, the shelves of heads by it; soldiers half made, clay, horses
// waiting their heads; shards; the artisans at their work. Their tally on
// the wall, and the crack by it that gives onto the tunnel they dug, their
// letter and one of them in it.
function workshop(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.tv_loess);
  const wall = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
  const mid = wall[Math.floor(wall.length / 2)];
  if (mid) face(ctx, mid, B.tv_kiln);
  for (const q of wall) if (q !== mid && Math.abs(q.x - (mid ? mid.x : r.cx)) <= 3 && rng.chance(0.6)) face(ctx, q, B.tv_heads);
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.tv_torso, rng.int(0, 1), true);
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.tv_clay, rng.int(0, 1), true);
  place(ctx, H, r, B.tv_jars, rng.int(0, 1), true);
  if (rng.chance(0.6)) place(ctx, H, r, B.tv_horse, 0, true);
  // The finished ones, in a row down the west wall, waiting for their
  // paint (none of them alive: not yet).
  for (let z = r.z0 + 2; z <= r.z1 - 1; z += 2) if (clear(ctx, H, r, r.x0, z) && ctx.plan.at(r.x0, z + 1)) soldierAt(ctx, r.x0, z, FY, rng.int(0, 3) === 3 ? 3 : rng.int(0, 1), false);
  // Shards: soldiers broken, waiting to be mended.
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, r.cx + rng.int(-3, 3), r.cz + rng.int(0, 2), 2);
    if (!t) continue;
    b.set(t.x, FY, t.z, B.tv_shards, rng.int(0, 1));
    lore(ctx, t.x, t.z, L.mark());
    (out.shards ||= []).push({ ...abs(ctx, t), y: FY, room: r.id });
  }
  // The tunnel behind the crack: a pocket in the earth, the crack its
  // door; the tally beside it.
  const pk = pocket(ctx, H, r, B.tv_earth);
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.tv_crack);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.6, ctx.T), ['old_coin', rng.int(4, 10)], ['clay', rng.int(2, 5)]], H.foundIn(ctx, false)));
    const bc = pk.cells.find((c) => c !== back && !(c.x === pk.cells[0].x && c.z === pk.cells[0].z) && b.get(c.x, FY, c.z) === B.air);
    if (bc) {
      b.set(bc.x, FY, bc.z, B.tv_bones, rng.int(0, 1));
      lore(ctx, bc.x, bc.z, L.letter());
    }
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.tunnels ||= []).push({ ...abs(ctx, pk.door), room: r.id });
    // The tally on a wall tile by it, if there's one to cut it in.
    const tw = northWall(ctx, r).find((q) => Math.abs(q.x - pk.door.x) <= 2 && !(q.x === pk.door.x && q.z === pk.door.z) && b.get(q.x, FY, q.z) === ctx.T.wall);
    if (tw && face(ctx, tw, B.tv_tally)) lore(ctx, tw.x, tw.z, L.tally());
  }
  if (!out.tunnels || !out.tunnels.some((c) => c.room === r.id)) {
    const tw = rng.pick(wall.filter((q) => b.get(q.x, FY, q.z) === ctx.T.wall));
    if (tw && face(ctx, tw, B.tv_tally)) lore(ctx, tw.x, tw.z, L.tally());
  }
  band(ctx, H, r, rng.chance(0.5) ? ['artisan', 'artisan'] : ['artisan'], { x: r.cx, z: r.cz }, 'artisans', { peaceful: true, dormant: 0 });
  // One of the army left here to be mended, that isn't clay.
  const t = near(ctx, H, r, r.cx + 3, r.z0 + 1, 2, (x, z) => ctx.plan.at(x, z + 1));
  if (t) soldierAt(ctx, t.x, t.z, FY, rng.int(0, 1), rng.chance(0.5));
}
// The directions: the shrine of the five directions. Jade laid in black
// stone; the four beasts on the north wall; five pedestals in a cross (the centre, and
// three out to each quarter), each with its jade disc in the wrong colour;
// the stele of the directions; the chamber behind the bronze door.
function directions(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  // (Black stone, the jade laid in it in the cross of the five
  // directions.)
  floorAll(ctx, H, r, B.tv_stone);
  floorAll(ctx, H, r, B.tv_jade, (x, z) => Math.abs(x - r.cx) <= 1 || Math.abs(z - r.cz) <= 1);
  const wall = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
  const mid = Math.floor(wall.length / 2);
  // The beasts, about the middle of the wall; the stele in the middle.
  const order = rng.shuffle([0, 1, 2, 3]);
  let k = 0;
  for (const [i, w] of wall.entries()) {
    if (i === mid) {
      if (face(ctx, w, B.tv_stele)) lore(ctx, w.x, w.z, L.directions());
      continue;
    }
    if (Math.abs(i - mid) > 3 || k >= 4) continue;
    const d = DIRECTIONS[order[k]];
    if (face(ctx, w, B[d.block])) {
      lore(ctx, w.x, w.z, L.beast(order[k]));
      k++;
    }
  }
  // The pedestals: centre, east (+x), south (+z), west, north.
  const spots = [{ d: 4, x: r.cx, z: r.cz }, { d: 0, x: r.cx + 3, z: r.cz }, { d: 1, x: r.cx, z: r.cz + 3 }, { d: 2, x: r.cx - 3, z: r.cz }, { d: 3, x: r.cx, z: r.cz - 3 }];
  const peds = [];
  for (const s of spots) {
    if (!clear(ctx, H, r, s.x, s.z)) break;
    // (Never already in its colour.)
    const c = (s.d + rng.int(1, 4)) % 5;
    b.set(s.x, FY, s.z, B[DISCS[c]]);
    peds.push({ ...abs(ctx, s), dir: s.d });
  }
  const pk = peds.length === 5 ? pocket(ctx, H, r, B.tv_earth) : null;
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.tv_bronzedoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 2, ctx.T), ['gem', rng.int(1, 2)], ['jasmine_tea', rng.int(1, 3)], [rng.pick(['gold_ingot', 'gem']), 1]], H.foundIn(ctx, false)));
    for (const c of pk.cells) {
      if (c === back || (c.x === pk.cells[0].x && c.z === pk.cells[0].z) || b.get(c.x, FY, c.z) !== B.air) continue;
      if (rng.chance(0.5)) b.set(c.x, FY, c.z, rng.chance(0.5) ? B.tv_ding : B.tv_lamp, rng.chance(0.5) ? 0 : META_STATE);
    }
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.discs ||= []).push({ peds, door: abs(ctx, pk.door), room: r.id });
  }
  lampsAlong(ctx, H, r, 1);
  if (rng.chance(0.5)) band(ctx, H, r, ['wisp'], { x: r.cx, z: r.z1 - 1 }, 'directions');
}
// The gallery: the crossbow gallery. Grey brick, and in it here and there a
// plate (its course laid square); the crossbows' slots in the north wall,
// each looses down its own line when a plate on that line is trodden; stone
// armour on its stands and racks of arms along the south side; the verse
// a crossbowman scratched; kneeling crossbowmen at its far end.
function gallery(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.tv_brick);
  const wall = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
  const bows = [];
  for (const w of wall) {
    if (w.x % 3 !== r.x0 % 3 || !face(ctx, w, B.tv_crossbow)) continue;
    // Its plates: one or two down its line, never by a way in.
    const plates = [];
    for (let z = w.z + 2; z <= r.z1; z++) {
      if (!clear(ctx, H, r, w.x, z) || !rng.chance(0.45) || plates.length >= 2) continue;
      floorAt(ctx, w.x, z, B.tv_plate);
      plates.push({ x: b.x0 + w.x, z });
      ctx.reserved.add(key(ctx, w.x, z));
    }
    if (plates.length) bows.push({ ...abs(ctx, w), plates, room: r.id });
  }
  if (bows.length) (out.crossbows ||= []).push(...bows);
  // Armour and racks against the south wall, spaced.
  const south = tilesOf(ctx, H, r).filter((t) => t.z === r.z1 && !out.crossbows?.some((c) => c.plates.some((p) => p.x === b.x0 + t.x && p.z === t.z)));
  let last = -9;
  for (const t of south) {
    if (t.x - last < 2 || ctx.reserved.has(key(ctx, t.x, t.z))) continue;
    b.set(t.x, FY, t.z, rng.chance(0.6) ? B.tv_armour : B.tv_rack, rng.int(0, 1));
    last = t.x;
  }
  // The verse, scratched on a slot-less stretch of the wall.
  const vw = wall.find((q) => b.get(q.x, FY, q.z) === ctx.T.wall && q.x > r.cx);
  if (vw && face(ctx, vw, B.tv_tally)) lore(ctx, vw.x, vw.z, L.verse());
  // Kneeling crossbowmen at the far end, facing down it.
  for (let i = 0; i < 2; i++) {
    const t = near(ctx, H, r, r.x1 - 1, r.cz + (i ? 1 : -1), 1, (x, z) => !ctx.reserved.has(key(ctx, x, z)));
    if (t) soldierAt(ctx, t.x, t.z, FY, 2, rng.chance(0.4));
  }
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'pit':
      return pit(ctx, H, r);
    case 'stable':
      return stable(ctx, H, r);
    case 'hall':
      return hall(ctx, H, r);
    case 'rivers':
      return rivers(ctx, H, r);
    case 'workshop':
      return workshop(ctx, H, r);
    case 'directions':
      return directions(ctx, H, r);
    case 'gallery':
      return gallery(ctx, H, r);
  }
}

// What the old rooms set about, the vault's own instead: its statues (the
// clay army, some of them not clay: the old hall's waiting soldiers become
// statues that wake), urns (jars), candles (the girls' lamps), lanterns,
// the altar (a cauldron), rubble (a fallen beam), banners (lanterns), the
// red lacquer of the lantern hall's floor; the pillared hall's pillars
// (red columns).
const OWN_OF = new Map([[B.urn, B.tv_jars], [B.candles, B.tv_lamp], [B.lantern, B.tv_lantern], [B.altar, B.tv_ding], [B.rubble, B.tv_beam], [B.war_banner, B.tv_lantern], [B.bones, B.tv_bones]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.statue) {
        soldierAt(ctx, x, z, H.FY, (x + z) % 2, false);
        continue;
      }
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        b.set(x, H.FY, z, B.tv_lantern, META_STATE);
        continue;
      }
      if (r.kit === 'pillared' && id === ctx.T.wall && H.own(ctx.plan, r, x, z)) {
        b.set(x, H.FY, z, B.tv_column);
        b.set(x, H.FY + 1, z, B.air);
        continue;
      }
      if (b.get(x, H.FY - 1, z) === B.planks_lacquer) b.set(x, H.FY - 1, z, B.tv_lacquerfloor);
      const to = OWN_OF.get(id);
      if (!to) continue;
      b.set(x, H.FY, z, to, to === B.tv_lamp || to === B.tv_lantern ? META_STATE : (x + z) % 2);
    }
  }
  // (The soldiers' hall's waiting soldiers: statues of their own, that
  // wake.)
  if (r.kit === 'soldiers') {
    for (const s of out.spawns.filter((q) => q.room === r.id && q.ambush && (q.species === 'terracotta_soldier' || q.species === 'terracotta_archer'))) {
      const x = s.x - b.x0;
      if (b.get(x, H.FY, s.z) !== B.air) continue;
      soldierAt(ctx, x, s.z, H.FY, s.species === 'terracotta_archer' ? 2 : (x + s.z) % 2, true);
      s.gone = true;
    }
    out.spawns = out.spawns.filter((q) => !q.gone);
    out.spawns.forEach((q, i) => (q.id = i));
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and the
// vault's own about them.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  ownThings(ctx, H, r);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the stele at the way in.
      if (ctx.n === 0) {
        const w = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
        const c = w[Math.floor(w.length / 2)];
        if (c && face(ctx, c, B.tv_stele)) lore(ctx, c.x, c.z, L.stele());
      }
      lampsAlong(ctx, H, r, 2);
      break;
    }
    case 'soldiers':
      floorAll(ctx, H, r, B.tv_brick);
      if (rng.chance(0.5)) band(ctx, H, r, ['drummer'], { x: r.cx, z: r.z0 + 1 }, 'drum');
      break;
    case 'lanterns':
      for (const q of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, q, B.tv_lacquer);
      break;
    case 'shrine':
      floorAll(ctx, H, r, B.tv_stone);
      for (const q of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, q, B.tv_lacquer);
      break;
    case 'treasure':
    case 'cache':
      floorAll(ctx, H, r, B.tv_stone);
      break;
    case 'boss': {
      // The master's hall: black stone, jade at its heart, lacquer walls,
      // lanterns, columns; and the hall's own word on a stele by it.
      floorAll(ctx, H, r, B.tv_stone);
      floorAll(ctx, H, r, B.tv_jade, (x, z) => Math.abs(x - r.cx) <= 1 && Math.abs(z - r.cz) <= 1);
      for (const q of northWall(ctx, r)) if (rng.chance(0.5)) face(ctx, q, rng.chance(0.3) ? B.tv_roundel : B.tv_lacquer);
      for (const ox of [-4, 4]) {
        const t = near(ctx, H, r, r.cx + ox, r.z0 + 1, 1, (x, z) => ctx.plan.at(x, z + 1));
        if (t) b.set(t.x, FY, t.z, B.tv_lantern, META_STATE);
      }
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.tv_stele)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the vault's things, by what it is, spaced out,
// the solid ones against the walls; its walls given their faces (a post, a
// crack, lacquer in the palace's rooms); its floor as it was laid.
const DECOR = {
  entry: [['tv_jars', 1], ['tv_lantern', 1]],
  exit: [['tv_jars', 1], ['tv_beam', 1]],
  soldiers: [['tv_beam', 1], ['tv_shards', 1]],
  lanterns: [['tv_screen', 1], ['tv_ding', 1], ['tv_jars', 1]],
  pillared: [['tv_jars', 1], ['tv_lamp', 1]],
  shrine: [['tv_ding', 1], ['tv_lamp', 1]],
  cache: [['tv_jars', 2], ['tv_rack', 1]],
  collapsed: [['tv_beam', 2], ['tv_shards', 1]],
  trap: [['tv_shards', 1], ['tv_bones', 1]],
  treasure: [['tv_jars', 2], ['tv_ding', 1]],
  guard: [['tv_rack', 1], ['tv_armour', 1]],
  pit: [['tv_jars', 1]],
  stable: [['tv_jars', 1]],
  hall: [['tv_jars', 1]],
  rivers: [['tv_jars', 1]],
  workshop: [['tv_clay', 1], ['tv_jars', 1]],
  directions: [['tv_ding', 1]],
  gallery: [['tv_jars', 1]],
};
const SOLID = new Set(['tv_jars', 'tv_lantern', 'tv_beam', 'tv_screen', 'tv_ding', 'tv_lamp', 'tv_rack', 'tv_armour', 'tv_clay']);
const ROT = new Set(['tv_jars', 'tv_beam', 'tv_shards', 'tv_screen', 'tv_rack', 'tv_bones', 'tv_clay']);
const STATE = new Set(['tv_lantern', 'tv_lamp']);
// The old rooms' own floors, as the emperor's builders laid them.
const OLD_FLOOR = { entry: B.tv_brick, exit: B.tv_brick, pillared: B.tv_stone, guard: B.tv_brick, collapsed: B.tv_loess, trap: B.tv_brick, lanterns: B.tv_stone };
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
  // Its walls: the earth, now and then its timber post or a crack.
  if (!VAULT_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.06) face(ctx, w, B.tv_heads);
      else if (p < 0.1 && (r.kit === 'lanterns' || r.kit === 'treasure')) face(ctx, w, B.tv_roundel);
    }
  }
  // And its things, spaced out.
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 30) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.22) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], STATE.has(k) ? META_STATE : ROT.has(k) ? rng.int(0, 1) : 0, SOLID.has(k));
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

// Its architect's last word: the statues still standing (and which of them
// are alive), the shards still lying, the cracks and the discs still in
// their places, the plates and their crossbows, the quicksilver.
function after(ctx) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  const at = (q, y = FY) => b.get(q.x - b.x0, q.y ?? y, q.z);
  out.statues = (out.statues || []).filter((q) => at(q) === B.tv_soldier);
  out.shards = (out.shards || []).filter((q) => at(q) === B.tv_shards);
  out.tunnels = (out.tunnels || []).filter((q) => at(q) === B.tv_crack);
  out.discs = (out.discs || []).filter((q) => q.peds.every((p) => DISCS.some((k) => at(p) === B[k])) && at(q.door) === B.tv_bronzedoor);
  out.crossbows = (out.crossbows || []).filter((q) => at(q) === B.tv_crossbow).map((q) => ({ ...q, plates: q.plates.filter((p) => b.get(p.x - b.x0, FY - 1, p.z) === B.tv_plate) })).filter((q) => q.plates.length);
  out.mercury = (out.mercury || []).filter((q) => b.get(q.x - b.x0, FY - 2, q.z) === B.tv_mercury);
}

export const VAULT_ARCH = {
  own: VAULT_OWN,
  kits,
  // (The army's pit, the shrine of the directions and the court never lost
  // to the way down.)
  keep: new Set(['pit', 'directions', 'hall']),
  spare: (rng, n, have = []) => {
    const pool = [['pit', 2], ['stable', 1], ['soldiers', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'soldiers';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a vault's own things are, for those who count them.)
export const VAULT_THINGS = ['tv_soldier', 'tv_shards', 'tv_horse', 'tv_column', 'tv_lamp', 'tv_lantern', 'tv_ding', 'tv_bells', 'tv_drum', 'tv_screen', 'tv_throne', 'tv_mountain', ...DISCS, 'tv_torso', 'tv_clay', 'tv_bones', 'tv_armour', 'tv_rack', 'tv_beam', 'tv_jars'].filter((k) => BLOCKS[B[k]]);
