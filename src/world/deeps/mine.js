// (Round 96) The mine, made over: a working gone wrong. Not old the way a
// barrow's old: a generation back the company was still sending shifts
// down; then the deep drift broke into something, the roof came in, and
// the shift that was down never came up. Everything's where they left it:
// the lamps still on their stakes, the tags still on the tally board,
// carts on the rails, the powder in its store. It's close, low and dark,
// timbered, dusty, warm the further down you go; islands of lamplight in
// the black; the creak of the props over everything.
//
// A floor of it is a mine's floor: drifts timbered every few paces, rails
// laid down the main way from the shaft to the next one down, and off them
// the places the miners worked and slept:
//   the stope: the working face at the back of a hall, cut in benches a
//     step up, the ore in its wall, the last shift still at it;
//   the sump: the water that collects at the bottom, black, in a pit; boards
//     laid across it; a pump (work it, and the pit drains, and what's in
//     it's left high and dry);
//   the powder store: kegs in rows, and the beetles that nest in the
//     powder, and a prop by the door that's cracking;
//   the bunkroom: bunks along the walls, the stove gone cold, those who
//     never got up from their bunks still in them;
//   the foreman's office: his ledger on the surveyor's table, the pay
//     chest;
//   the shaft: a ledge up the side of it, a ladder to it, what was left up
//     there;
//   the gas drift: a drift where the firedamp collects, hanging in the air,
//     waiting for a flame;
//   the fall: where the roof came in; the trapped shift's last note; what's
//     digging on the other side;
//   the breakthrough: where the deep drift broke into a cave nobody dug,
//     and the crawlers' eggs in it.
// And its secrets: a soft face with a chalk cross on it, the rich pocket
// the miners sealed up behind it against the day; a drift choked with
// fall that only a runaway cart down the rails will clear (if the points
// are thrown the right way). Its papers (see deeps/minelore.js) are made
// from the mine's own history.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { mineLore } from './minelore.js';

// Each region's mine in its own stuff (the timbering and the cut benches
// are Thessa's; elsewhere their own rock and timber stand in).
export function matsOf(T) {
  const thessa = T.wall === B.mine_rock;
  const pick = (...ks) => ks.find((k) => k !== undefined && k !== null && BLOCKS[k]) ?? T.floor;
  return {
    thessa,
    wall: T.wall,
    floor: T.floor,
    timber: thessa ? B.mine_timber : pick(T.beam, B.mine_beam),
    bench: thessa ? B.mine_bench : pick(T.alt, T.floor),
    steps: thessa ? B.mine_steps : null,
    boards: B.mine_boards,
    quartz: thessa ? B.mine_quartz : null,
    seep: thessa ? B.mine_seep : null,
  };
}

const FIRST = [['workings', 2], ['stope', 2], ['bunkroom', 2], ['powder', 2], ['sump', 2], ['office', 1], ['cave_in', 2], ['shaft', 2], ['gas_drift', 1], ['trap', 1], ['treasure', 1]];
const DEEP = [['workings', 2], ['stope', 2], ['sump', 2], ['powder', 2], ['cave_in', 2], ['shaft', 2], ['gas_drift', 2], ['breakthrough', 1], ['bunkroom', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['office', 'breakthrough', 'bunkroom', 'gas_drift']);
export const MINE_KITS = new Set(['workings', 'stope', 'sump', 'powder', 'bunkroom', 'office', 'breakthrough', 'cave_in', 'shaft', 'gas_drift']);

function kits(rng, rec, n, last, count) {
  const pool = n === 0 ? FIRST : DEEP;
  const out = [];
  // (The first floor keeps the foreman's office; the bottom floor, the
  // breakthrough, where it all went wrong. Kept at the end of the list,
  // clear of the first, which may be made the way in or the master's.)
  const sure = [];
  if (n === 0) sure.push('office');
  if (last) sure.push('breakthrough');
  out.push(...sure, 'stope');
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const k = rng.weighted(pool);
    if (ONCE.has(k) && out.includes(k)) continue;
    // (Two of a kind on a floor at most (two faces worked, two falls),
    // unless there's no other way to fill it.)
    if (out.filter((q) => q === k).length >= (guard > 120 ? 3 : 2)) continue;
    out.push(k);
  }
  const rest = rng.shuffle(out.filter((k, i) => i >= sure.length));
  return [...rest.slice(0, count - sure.length), ...sure];
}

const SIZES = {
  stope: [[10, 13], [8, 9]], sump: [[9, 12], [8, 10]], powder: [[7, 9], [6, 8]], bunkroom: [[8, 11], [6, 8]], office: [[6, 8], [5, 7]],
  breakthrough: [[11, 14], [9, 12]], cave_in: [[8, 11], [7, 9]], shaft: [[8, 10], [8, 10]], gas_drift: [[11, 14], [5, 5]],
};
const SHAPES = {
  stope: ['rect'], sump: ['round', 'rect'], powder: ['rect'], bunkroom: ['rect'], office: ['rect'], breakthrough: ['cave'], cave_in: ['cave', 'rect'], shaft: ['rect'], gas_drift: ['rect'],
};

// The master waiting at the bottom: chosen from the mine's own seed, so
// every floor's papers can speak of it (see deeps/minelore.js).
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x3e3) % list.length] : null;
};

// --------------------------------------------------------------- helpers
const key = (ctx, x, z) => z * ctx.W + x;
// A tile raised a step (a bench cut in the rock), or two (a ledge up the
// side of a shaft: a ladder to it).
function raise(ctx, H, x, z, id, high = 1) {
  const { b } = ctx;
  for (let k = 0; k < high; k++) b.set(x, H.FY + k, z, id);
  for (let k = high; k < high + 2; k++) b.set(x, H.FY + k, z, B.air);
  (high > 1 ? (ctx.ledge ||= new Set()) : (ctx.lifted ||= new Set())).add(key(ctx, x, z));
  ctx.out.maxY = Math.max(ctx.out.maxY || 0, H.FY + high);
}
// A tile sunk a step below the floor (a sump's pit), water in it or not.
function sink(ctx, H, x, z, floor, water = false) {
  const { b } = ctx;
  b.set(x, H.FY - 1, z, water ? B.water : B.air);
  b.set(x, H.FY - 2, z, floor);
  (ctx.sunk ||= new Set()).add(key(ctx, x, z));
  ctx.reserved.add(key(ctx, x, z));
}
// Someone set out exactly there (in another land, its own in their place,
// and its own look on the rest: see render/pixart.VARIANTS).
const LOOK = { kharos: 1, myrrow: 2, hollowmark: 2, velmarch: 3, saltmere: 3 };
function put(ctx, species, x, z, r, o = {}) {
  const { out, b } = ctx;
  if (out.spawns.some((s) => s.x === b.x0 + x && s.z === z)) return null;
  const sw = ctx.T.swap && ctx.T.swap[species];
  const v = LOOK[ctx.rec.isle] || 0;
  const s = { id: out.spawns.length, species: sw ? ctx.rng.pick(sw) : species, x: b.x0 + x, z, room: r.id, ...(v ? { variant: v } : {}), ...o };
  out.spawns.push(s);
  return s;
}
const isUp = (ctx, x, z) => ctx.lifted?.has(key(ctx, x, z)) || ctx.ledge?.has(key(ctx, x, z)) || ctx.sunk?.has(key(ctx, x, z));
const free = (ctx, H, r, x, z) => H.freeIn(ctx, r, x, z) && !isUp(ctx, x, z);
function near(ctx, H, r, x, z, rad = 3, ok = null) {
  for (let d = 0; d <= rad; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        if (free(ctx, H, r, x + dx, z + dz) && (!ok || ok(x + dx, z + dz))) return { x: x + dx, z: z + dz };
      }
    }
  }
  return null;
}
const lvlOf = (ctx) => (ctx.rec.level || 1) + ctx.n * 0.5;
function mainDoor(ctx, H, r) {
  const ds = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
  if (!ds.length) return null;
  const e = ctx.out.entry ? { x: ctx.out.entry.x - ctx.b.x0, z: ctx.out.entry.z } : { x: r.cx, z: r.cz };
  return ds.sort((a, c) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(c.x - e.x, c.z - e.z))[0];
}
const groupOf = (ctx, r, k) => `${ctx.n}:${r.id}:${k}`;
function lore(ctx, x, z, entry) {
  (ctx.out.lore ||= []).push({ x: ctx.b.x0 + x, z, ...entry });
}
const Lof = (ctx) => ctx.lore || (ctx.lore = mineLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));
// The side of the room furthest from its main way in (its back wall), as
// a row: which axis it runs along, the row by the wall, and which way is
// out from the wall into the room.
function backOf(ctx, H, r) {
  const door = mainDoor(ctx, H, r);
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  if (along) {
    const back = door && door.z <= r.cz ? r.z1 : r.z0;
    return { along, back, out: back === r.z1 ? -1 : 1 };
  }
  const back = door && door.x <= r.cx ? r.x1 : r.x0;
  return { along, back, out: back === r.x1 ? -1 : 1 };
}
const at2 = (S, a, row) => (S.along ? { x: a, z: row } : { x: row, z: a });
// A pocket dug behind one wall of the room (three deep, two wide at its
// end): its way in, and where its back is.
function pocket(ctx, H, r, lining, accept = null) {
  const { plan, b, rng } = ctx;
  const FY = H.FY;
  const W = ctx.W;
  for (const w of rng.shuffle(H.wallsOf(plan, r))) {
    const dx = H.own(plan, r, w.x - 1, w.z) ? 1 : H.own(plan, r, w.x + 1, w.z) ? -1 : 0;
    const dz = H.own(plan, r, w.x, w.z - 1) ? 1 : H.own(plan, r, w.x, w.z + 1) ? -1 : 0;
    if (!!dx === !!dz) continue;
    // (Not where something's already been set against it.)
    if (b.get(w.x - dx, FY, w.z - dz) !== B.air || ctx.reserved?.has((w.z - dz) * W + w.x - dx)) continue;
    const cells = [1, 2, 3].map((k) => ({ x: w.x + dx * k, z: w.z + dz * k }));
    const side = (c) => [[dz, dx], [-dz, -dx]].map(([ox, oz]) => ({ x: c.x + ox, z: c.z + oz }));
    const all = [w, ...cells, ...side(cells[1]), ...side(cells[2])];
    if (all.some((c) => c.x < 2 || c.z < 2 || c.x >= W - 2 || c.z >= ctx.D - 2 || plan.at(c.x, c.z) || plan.forbid[c.z * W + c.x])) continue;
    if (all.some((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => plan.at(c.x + ox, c.z + oz) && plan.room[(c.z + oz) * W + c.x + ox] !== r.id))) continue;
    if (accept && !accept(w, { x: dx, z: dz })) continue;
    const open = [...cells, ...side(cells[2])];
    for (const c of open) {
      plan.carve(c.x, c.z);
      plan.forbid[c.z * W + c.x] = 1;
      b.set(c.x, FY, c.z, B.air);
      b.set(c.x, FY + 1, c.z, B.air);
      b.set(c.x, FY - 1, c.z, ctx.T.floor);
    }
    // Its own walls, all round.
    if (lining) {
      for (const c of open) {
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const q = { x: c.x + ox, z: c.z + oz };
          if (plan.at(q.x, q.z) || (q.x === w.x && q.z === w.z)) continue;
          for (const y of [FY, FY + 1]) b.set(q.x, y, q.z, lining);
        }
      }
    }
    return { door: w, back: cells[2], dir: { x: dx, z: dz }, cells: open };
  }
  return null;
}

// Whatever of a room can't be got to from its doors (shut in by a fall of
// rock, a step up too many) is filled with the fall, and nothing's left
// set out in it.
function sealHollows(ctx, H, r) {
  const { b, plan, out } = ctx;
  const FY = H.FY;
  const W = ctx.W;
  const solid = (x, y, z) => BLOCKS[b.get(x, y, z)].solid;
  // (Where you'd stand on the tile, or null: the floor, or a step up.)
  const stand = (x, z) => (!solid(x, FY, z) && !solid(x, FY + 1, z) ? FY : solid(x, FY, z) && !solid(x, FY + 1, z) && !solid(x, FY + 2, z) ? FY + 1 : null);
  const seen = new Set();
  const q = [];
  for (const d of H.doorways(plan, r)) {
    if (!H.own(plan, r, d.x, d.z) || stand(d.x, d.z) === null) continue;
    seen.add(d.z * W + d.x);
    q.push(d);
  }
  while (q.length) {
    const { x, z } = q.pop();
    const h = stand(x, z);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const nz = z + oz;
      const j = nz * W + nx;
      if (seen.has(j) || !H.own(plan, r, nx, nz)) continue;
      const h2 = stand(nx, nz);
      if (h2 === null || h2 - h > 1) continue;
      seen.add(j);
      q.push({ x: nx, z: nz });
    }
  }
  if (!seen.size) return;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(plan, r, x, z) || seen.has(z * W + x) || solid(x, FY, z)) continue;
      b.set(x, FY, z, B.mine_fall);
      b.set(x, FY + 1, z, B.mine_fall);
      const k = out.spawns.findIndex((sp) => sp.x === b.x0 + x && sp.z === z);
      if (k >= 0) out.spawns.splice(k, 1);
    }
  }
  out.spawns.forEach((sp, i) => (sp.id = i));
}

// --------------------------------------------------------------- the rooms
function dress(ctx, r, H) {
  const { rng, b, T, rec } = ctx;
  const M = matsOf(T);
  const FY = H.FY;
  const L = Lof(ctx);
  const lvl = lvlOf(ctx);
  switch (r.kit) {
    // The stope: the face at the back of the hall cut in a bench a step up
    // (two, in a deep hall), steps up the middle of it; the ore in the face
    // (a rich seam of it, here and there); the shift still at it, picks
    // going; a cart on rails to carry it off, ore heaped by it.
    case 'stope': {
      const S = backOf(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const mid = Math.round((lo + hi) / 2);
      const bench = [];
      for (let a = lo; a <= hi; a++) {
        for (const k of [0, 1]) {
          const t = at2(S, a, S.back + S.out * k);
          if (free(ctx, H, r, t.x, t.z)) {
            raise(ctx, H, t.x, t.z, M.bench);
            bench.push({ ...t, k });
          }
        }
      }
      // The steps up, in front of the middle of it.
      const st = at2(S, mid, S.back + S.out * 2);
      if (M.steps && bench.length && free(ctx, H, r, st.x, st.z)) {
        b.set(st.x, FY, st.z, M.steps, S.along ? (S.out > 0 ? 0 : 2) : S.out > 0 ? 3 : 1);
        (ctx.lifted ||= new Set()).add(key(ctx, st.x, st.z));
      }
      // The face: ore in it, a rich seam now and then.
      for (const w of H.wallsOf(ctx.plan, r)) {
        if ((S.along ? w.z : w.x) !== S.back - S.out) continue;
        for (const y of [FY + 1, FY + 2]) {
          const roll = rng.float(0, 1);
          if (roll < 0.12) b.set(w.x, y, w.z, B.rich_vein);
          else if (roll < 0.3) b.set(w.x, y, w.z, rng.chance(0.3) ? B.gold_ore : rng.chance(0.5) ? B.iron_ore : B.coal_ore);
        }
      }
      // The shift at the face (dormant: they're working, and don't look
      // round till you're close, or one of them sees you and rings for
      // the rest: see entities/minemobs.js).
      const g = groupOf(ctx, r, 'shift');
      const top = bench.filter((q) => q.k === 0);
      rng.shuffle(top);
      for (let i = 0; i < Math.min(top.length, 1 + Math.floor(lvl / 2), 3); i++) put(ctx, 'lost_miner', top[i].x, top[i].z, r, { dormant: 3, group: g, role: 'work' });
      // The cart, on its rails out from the bench to the door.
      const cart = at2(S, mid + 2, S.back + S.out * 3);
      if (free(ctx, H, r, cart.x, cart.z)) b.set(cart.x, FY, cart.z, B.mine_cart);
      const heap = near(ctx, H, r, at2(S, mid - 2, S.back + S.out * 3).x, at2(S, mid - 2, S.back + S.out * 3).z, 1);
      if (heap) b.set(heap.x, FY, heap.z, B.ore_pile);
      for (let i = 0; i < 2; i++) H.placeIn(ctx, r, B.pit_lamp, 0, true);
      if (lvl >= 2.5 && rng.chance(0.5)) put(ctx, 'firedamp', r.cx, r.cz, r, {});
      if (rng.chance(0.5)) H.chestIn(ctx, r, 1, B.chest, [[rng.pick(['iron_ore', 'gold_ore', 'coal']), rng.int(2, 5)]]);
      break;
    }
    // The sump: a pit in the middle of the hall, sunk a step, full of black
    // water; boards across it; the pump at its edge. Pumped dry, it shows
    // what went into it (a strongbox, the bones of whoever was carrying it,
    // and something that was waiting in the water).
    case 'sump': {
      const rad = Math.max(1.6, Math.min(3, (Math.min(r.x1 - r.x0, r.z1 - r.z0) - 3) / 2));
      const pit = [];
      for (let z = Math.floor(r.cz - rad); z <= Math.ceil(r.cz + rad); z++) {
        for (let x = Math.floor(r.cx - rad); x <= Math.ceil(r.cx + rad); x++) {
          if (Math.hypot(x - r.cx, (z - r.cz) * 1.05) > rad || !free(ctx, H, r, x, z)) continue;
          pit.push({ x, z });
        }
      }
      if (pit.length < 6) break;
      // Boards across it along its long way (level with the floor).
      const along = r.x1 - r.x0 >= r.z1 - r.z0;
      const boards = new Set(pit.filter((q) => (along ? q.z === r.cz : q.x === r.cx)).map((q) => `${q.x},${q.z}`));
      const water = [];
      for (const q of pit) {
        if (boards.has(`${q.x},${q.z}`)) {
          b.set(q.x, FY - 1, q.z, M.boards);
          ctx.reserved.add(key(ctx, q.x, q.z));
          continue;
        }
        sink(ctx, H, q.x, q.z, M.floor, true);
        water.push({ x: b.x0 + q.x, z: q.z, y: FY - 1 });
      }
      // In the bottom of it: a strongbox, bones.
      const low = rng.shuffle(pit.filter((q) => !boards.has(`${q.x},${q.z}`)));
      if (low[0]) {
        b.set(low[0].x, FY - 1, low[0].z, B.chest, rng.int(0, 3));
        b.container(low[0].x, FY - 1, low[0].z, H.fill(rng, 9, [...H.lootFor(rec.type, H.tierOf(ctx), rng, 1.5, T), ['old_coin', rng.int(4, 10)]], H.foundIn(ctx)));
        water.splice(water.findIndex((q) => q.x === b.x0 + low[0].x && q.z === low[0].z), 1);
      }
      if (low[1]) b.set(low[1].x, FY - 1, low[1].z, B.bones);
      // The pump, at the pit's edge.
      let pump = null;
      for (let k = 0; k < 12 && !pump; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = Math.round(r.cx + Math.cos(a) * (rad + 1.3));
        const z = Math.round(r.cz + Math.sin(a) * (rad + 1.1));
        if (free(ctx, H, r, x, z)) pump = { x, z };
      }
      if (pump) {
        b.set(pump.x, FY, pump.z, B.mine_pump);
        (ctx.out.pumps ||= []).push({ x: b.x0 + pump.x, z: pump.z, water, group: groupOf(ctx, r, 'sump') });
      }
      // In the water: what's in the water (up when it's drained, or when
      // you wade in).
      const g = groupOf(ctx, r, 'sump');
      for (let i = 0; i < 1 + Math.floor(lvl / 2); i++) {
        const q = low[2 + i];
        if (q) put(ctx, i === 0 && lvl >= 2 ? 'lost_miner' : 'slime', q.x, q.z, r, { dormant: 1.5, group: g, buried: i === 0 && lvl >= 2 });
      }
      // The wet running down the walls round it.
      if (M.seep) for (const w of H.wallsOf(ctx.plan, r)) if (rng.chance(0.35)) b.set(w.x, FY, w.z, M.seep);
      break;
    }
    // The powder store: kegs in rows against the walls, a crate of fuse;
    // the beetles nesting in the powder; a prop by the door cracking (a
    // blast in here brings the roof down: see game/minework.js).
    case 'powder': {
      let kegs = 0;
      for (const w of rng.shuffle(H.wallsOf(ctx.plan, r))) {
        if (kegs >= 6 + Math.floor(lvl)) break;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = w.x + ox;
          const z = w.z + oz;
          if (!free(ctx, H, r, x, z) || rng.chance(0.4)) continue;
          b.set(x, FY, z, B.powder_keg);
          kegs++;
          break;
        }
      }
      const door = mainDoor(ctx, H, r);
      if (door) {
        const at = near(ctx, H, r, door.x - door.ox * 2 + door.oz, door.z - door.oz * 2 + door.ox, 1);
        if (at) {
          b.set(at.x, FY, at.z, B.cracked_prop);
          (ctx.out.props ||= []).push({ x: b.x0 + at.x, z: at.z });
        }
      }
      const g = groupOf(ctx, r, 'nest');
      for (let i = 0; i < 2 + Math.floor(lvl / 1.5); i++) {
        const at = near(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1), 2);
        if (at) put(ctx, 'blast_beetle', at.x, at.z, r, { dormant: 2.5, group: g });
      }
      H.chestIn(ctx, r, 1.1, B.chest, [['bomb', rng.int(1, 3)]]);
      break;
    }
    // The bunkroom: bunks along the walls, the stove cold in the middle,
    // a rack of tools; those who never got up still in their bunks (they
    // get up now); a letter never sent, in one of the bunks.
    case 'bunkroom': {
      const bunks = [];
      for (const w of rng.shuffle(H.wallsOf(ctx.plan, r))) {
        if (bunks.length >= 3 + Math.floor((r.x1 - r.x0) / 4)) break;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = w.x + ox;
          const z = w.z + oz;
          if (!free(ctx, H, r, x, z) || bunks.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 3)) continue;
          b.set(x, FY, z, B.miner_bunk);
          bunks.push({ x, z });
          break;
        }
      }
      const stove = near(ctx, H, r, r.cx, r.cz, 2);
      if (stove) b.set(stove.x, FY, stove.z, B.cold_stove);
      H.placeIn(ctx, r, B.tool_rack, 0, true);
      H.placeIn(ctx, r, B.pit_lamp, 0, true);
      // The sleepers, beside their bunks.
      const g = groupOf(ctx, r, 'bunks');
      for (const q of rng.shuffle([...bunks]).slice(0, 1 + Math.floor(lvl / 1.5))) {
        const at = near(ctx, H, r, q.x, q.z, 1);
        if (at) put(ctx, 'lost_miner', at.x, at.z, r, { dormant: 2, group: g, rest: true });
      }
      if (bunks[0]) lore(ctx, bunks[0].x, bunks[0].z, L.letter());
      for (let i = 0; i < 2; i++) H.spawnIn(ctx, r, 'rat', 1);
      if (rng.chance(0.6)) H.chestIn(ctx, r, 0.8, B.chest, [['bread', rng.int(1, 2)], ['torch', rng.int(2, 4)]]);
      break;
    }
    // The foreman's office: the surveyor's table with the ledger on it,
    // the pay chest, the lamp; one of the little knockers, maybe, who
    // liked the foreman.
    case 'office': {
      const S = backOf(ctx, H, r);
      const t = near(ctx, H, r, at2(S, S.along ? r.cx : r.cz, S.back + S.out).x, at2(S, S.along ? r.cx : r.cz, S.back + S.out).z, 2);
      if (t) {
        b.set(t.x, FY, t.z, B.survey_table);
        lore(ctx, t.x, t.z, L.ledger());
      }
      H.chestIn(ctx, r, 1.3, B.chest, [['old_coin', rng.int(8, 20)]]);
      H.placeIn(ctx, r, B.pit_lamp, 0, true);
      H.placeIn(ctx, r, B.tool_rack, 0, true);
      const nb = H.placeIn(ctx, r, B.tally_board, 0, true);
      if (nb) lore(ctx, nb.x, nb.z, L.notice());
      if (rng.chance(0.6)) put(ctx, 'knocker', r.cx, r.cz, r, { peaceful: true });
      break;
    }
    // The old workings: a hall worked out room and pillar, the pillars
    // left standing to hold the roof (a great one is walled so: see
    // dungeongen.js, subRooms); ore heaped, a cart left where it stood,
    // lamps, a prop cracking; and the shift wandering it still.
    case 'workings': {
      for (let i = 0; i < 2; i++) H.placeIn(ctx, r, B.ore_pile, 0, true);
      H.placeIn(ctx, r, B.mine_cart, 0, true);
      H.placeIn(ctx, r, B.pit_lamp, 0, true);
      if (rng.chance(0.5)) H.placeIn(ctx, r, B.tool_rack, 0, true);
      const at = H.placeIn(ctx, r, B.cracked_prop, 0, true);
      if (at) (ctx.out.props ||= []).push({ x: b.x0 + at.x, z: at.z });
      H.spawnIn(ctx, r, 'lost_miner', 1 + (lvl >= 2 ? 1 : 0));
      if (rng.chance(0.5)) H.spawnIn(ctx, r, 'blast_beetle', 1);
      break;
    }
    // The shaft: props up its middle; a ledge two high along one side, a
    // ladder up to it, and what was left up there; things that fly in the
    // shaft's dark.
    case 'shaft': {
      const S = backOf(ctx, H, r);
      const lo = (S.along ? r.x0 : r.z0) + 1;
      const hi = (S.along ? r.x1 : r.z1) - 1;
      const ledge = [];
      for (let a = lo; a <= hi; a++) {
        const t = at2(S, a, S.back);
        if (free(ctx, H, r, t.x, t.z)) ledge.push(t);
      }
      if (ledge.length >= 4) {
        for (const t of ledge) raise(ctx, H, t.x, t.z, M.bench, 2);
        // The ladder, at one end, in front of it.
        const lt = ledge[Math.floor(ledge.length / 2)];
        const lx = lt.x + (S.along ? 0 : S.out);
        const lz = lt.z + (S.along ? S.out : 0);
        if (free(ctx, H, r, lx, lz)) {
          // (Facing the ledge: see player.climb.)
          const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
          for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.ladder, d);
          ctx.reserved.add(key(ctx, lx, lz));
        }
        // Up there: a chest, a lamp.
        const end = ledge[ledge.length - 1];
        b.set(end.x, FY + 2, end.z, B.chest, rng.int(0, 3));
        b.container(end.x, FY + 2, end.z, H.fill(rng, 9, H.lootFor(rec.type, H.tierOf(ctx) + 0.5, rng, 1.6, T), H.foundIn(ctx)));
        b.set(ledge[0].x, FY + 2, ledge[0].z, B.pit_lamp);
      }
      for (let z = r.z0 + 2; z <= r.z1 - 2; z += 3) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 4) if (free(ctx, H, r, x, z) && !H.byWall(ctx.plan, x, z)) for (const y of [FY, FY + 1]) b.set(x, y, z, B.mine_beam);
      H.spawnIn(ctx, r, 'moth', 2);
      break;
    }
    // The gas drift: long and low, timbered; firedamp hanging in the
    // middle of it, and the damp itself drifting; something that sparks.
    case 'gas_drift': {
      const cells = [];
      for (let z = r.z0 + 1; z <= r.z1 - 1; z++) for (let x = r.x0 + 2; x <= r.x1 - 2; x++) if (free(ctx, H, r, x, z) && rng.chance(0.55)) cells.push({ x, z });
      for (const q of cells) b.set(q.x, FY, q.z, B.firedamp);
      (ctx.out.gas ||= []).push(...cells.map((q) => ({ x: b.x0 + q.x, z: q.z })));
      put(ctx, 'firedamp', r.cx, r.cz, r, {});
      if (lvl >= 1.5) {
        const at = near(ctx, H, r, r.x1 - 1, r.cz, 2);
        if (at) put(ctx, 'blast_beetle', at.x, at.z, r, { dormant: 2 });
      }
      // (Timbered, both sides.)
      for (const w of H.wallsOf(ctx.plan, r)) if ((w.x + w.z) % 3 === 0) for (const y of [FY, FY + 1]) b.set(w.x, y, w.z, M.timber);
      break;
    }
    // The fall: the roof come in across half the hall, props cracked round
    // its edge; the trapped shift's last note on a lamp-tin; and what's
    // digging out of the fall toward you.
    case 'cave_in': {
      const cx = rng.int(r.x0 + 2, r.x1 - 2);
      const cz = rng.chance(0.5) ? r.z0 + 1 : r.z1 - 1;
      const fall = [];
      // (Across half the hall at most, however big it is.)
      const half = Math.max(2, Math.floor((r.z1 - r.z0) / 2));
      const reach = Math.min(3.8, (r.x1 - r.x0) / 2.4 + 1);
      for (let z = r.z0; z <= r.z1; z++) {
        for (let x = r.x0; x <= r.x1; x++) {
          const d = Math.hypot(x - cx, (z - cz) * 1.2);
          if (Math.abs(z - cz) > half || d > reach + rng.float(0, 1) || !free(ctx, H, r, x, z)) continue;
          b.set(x, FY, z, rng.chance(0.65) ? B.mine_fall : B.rubble);
          if (d < 2.2) b.set(x, FY + 1, z, B.mine_fall);
          fall.push({ x, z });
        }
      }
      for (let i = 0; i < 2; i++) {
        const at = near(ctx, H, r, cx + (i ? 3 : -3), cz + (cz === r.z0 + 1 ? 3 : -3), 2);
        if (at) {
          b.set(at.x, FY, at.z, B.cracked_prop);
          (ctx.out.props ||= []).push({ x: b.x0 + at.x, z: at.z });
        }
      }
      const tin = near(ctx, H, r, cx, cz + (cz === r.z0 + 1 ? 4 : -4), 3);
      if (tin) {
        b.set(tin.x, FY, tin.z, B.lamp_tin);
        lore(ctx, tin.x, tin.z, L.trapped());
      }
      H.placeIn(ctx, r, B.bones, 0);
      // Under the fall: the shift that was trapped, digging out (they come
      // up out of it when you're near: see game/dungeon.js, buried).
      const g = groupOf(ctx, r, 'fall');
      const edge = fall.filter((q) => b.get(q.x, FY + 1, q.z) === B.air && b.get(q.x, FY, q.z) !== B.air);
      for (let i = 0; i < Math.min(edge.length, 1 + Math.floor(lvl / 1.5)); i++) {
        const q = edge[rng.int(0, edge.length - 1)];
        b.set(q.x, FY, q.z, B.air);
        put(ctx, 'lost_miner', q.x, q.z, r, { dormant: 2.5, group: g, buried: true });
      }
      sealHollows(ctx, H, r);
      if (rng.chance(0.5)) H.chestIn(ctx, r, 0.9);
      break;
    }
    // The breakthrough: the cave the deep drift broke into, that nobody
    // dug; glowing caps on its walls, stalagmites, the crawlers' eggs in
    // rows; the last shift's chalk on the rock.
    case 'breakthrough': {
      for (let i = 0; i < 4; i++) H.placeIn(ctx, r, B.glowshroom, 0, true);
      for (let i = 0; i < 3; i++) H.placeIn(ctx, r, B.stalagmite, 0, true);
      const eggs = [];
      for (let i = 0; i < 3 + Math.floor(lvl / 1.5); i++) {
        const at = near(ctx, H, r, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.z0 + 1, r.z1 - 1), 2);
        if (!at) continue;
        b.set(at.x, FY, at.z, B.egg_sac);
        eggs.push({ x: b.x0 + at.x, z: at.z });
      }
      (ctx.out.eggs ||= []).push(...eggs);
      for (let i = 0; i < 2; i++) H.spawnIn(ctx, r, 'crawler', 1);
      const tin = H.placeIn(ctx, r, B.lamp_tin, 0, true);
      if (tin) lore(ctx, tin.x, tin.z, L.breakthrough());
      H.chestIn(ctx, r, 1.2);
      break;
    }
    default:
      return false;
  }
  return true;
}

// The old rooms, more of the mine's own: the way in its pithead (the
// headframe over the shaft, the tally board, the bell, the lamps; one of
// the knockers, who were friends of the miners); the master's hall; and
// lamps in the rest.
function extra(ctx, r, H) {
  const { rng, b, n } = ctx;
  const L = Lof(ctx);
  if (r.kit === 'entry') {
    if (n === 0) {
      const hf = H.placeIn(ctx, r, B.headframe, 0, true);
      if (hf) lore(ctx, hf.x, hf.z, L.headframe());
      const tb = H.placeIn(ctx, r, B.tally_board, 0, true);
      if (tb) lore(ctx, tb.x, tb.z, L.tally());
      const bell = H.placeIn(ctx, r, B.shaft_bell, 0, true);
      if (bell) (ctx.out.bells ||= []).push({ x: b.x0 + bell.x, z: bell.z });
      H.placeIn(ctx, r, B.tool_rack, 0, true);
    } else {
      const nb = H.placeIn(ctx, r, B.tally_board, 0, true);
      if (nb) lore(ctx, nb.x, nb.z, rng.chance(0.5) ? L.notice() : L.tally());
      const bell = H.placeIn(ctx, r, B.shaft_bell, 0, true);
      if (bell) (ctx.out.bells ||= []).push({ x: b.x0 + bell.x, z: bell.z });
    }
    H.placeIn(ctx, r, B.pit_lamp, 0, true);
    if (rng.chance(0.65)) {
      const at = near(ctx, H, r, r.cx + 2, r.cz, 3);
      if (at) put(ctx, 'knocker', at.x, at.z, r, { peaceful: true });
    }
  } else if (r.kit === 'boss') {
    // The deep hall: the last shift's chalk on the rock, lamps knocked
    // over, props cracking all round it.
    const tin = H.placeIn(ctx, r, B.lamp_tin, 0, true);
    if (tin) lore(ctx, tin.x, tin.z, L.breakthrough());
    for (let i = 0; i < 2; i++) {
      const at = H.placeIn(ctx, r, B.cracked_prop, 0, true);
      if (at) (ctx.out.props ||= []).push({ x: b.x0 + at.x, z: at.z });
    }
  } else if (r.kit === 'exit') {
    H.placeIn(ctx, r, B.pit_lamp, 0, true);
    if (rng.chance(0.5)) {
      const bell = H.placeIn(ctx, r, B.shaft_bell, 0, true);
      if (bell) (ctx.out.bells ||= []).push({ x: b.x0 + bell.x, z: bell.z });
    }
  } else if (r.kit === 'trap' || r.kit === 'treasure') {
    H.placeIn(ctx, r, B.pit_lamp, 0, true);
  }
}

// --------------------------------------------------------------- dressing
// What's set about each room: a few things by its size, each kind kept
// apart from its own, the solid ones against the walls, never in a
// doorway's way; a lamp or two (the only light down here); the walls
// shot through with quartz here and there.
const DECOR = [['ore_pile', 2], ['mine_cart', 1], ['rubble', 3], ['stalagmite', 1], ['tool_rack', 1], ['powder_keg', 1]];
function decorate(ctx, r, H) {
  const { rng, b, plan, T } = ctx;
  const FY = H.FY;
  if (r.kit === 'vault' || r.kit === 'hidden' || r.kit === 'boss') return;
  const M = matsOf(T);
  const list = DECOR.filter(([k]) => B[k] !== undefined);
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const busy = MINE_KITS.has(r.kit) ? 0.5 : 1;
  const n = Math.round((area / 22) * rng.float(0.6, 1.2) * busy);
  const placed = [];
  for (let i = 0; i < n; i++) {
    const k = rng.weighted(list);
    for (let t = 0; t < 6; t++) {
      const at = H.placeIn(ctx, r, B[k], rng.int(0, 3), true);
      if (!at) break;
      if (isUp(ctx, at.x, at.z) || placed.some((q) => q.k === k && Math.hypot(q.x - at.x, q.z - at.z) < 3)) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      placed.push({ k, x: at.x, z: at.z });
      break;
    }
  }
  if (area > 36 && rng.chance(0.6) && !['stope', 'bunkroom', 'office'].includes(r.kit)) H.placeIn(ctx, r, B.pit_lamp, 0, true);
  if (M.quartz) for (const w of H.wallsOf(plan, r)) if (b.get(w.x, FY, w.z) === M.wall && rng.chance(0.05)) b.set(w.x, FY, w.z, M.quartz);
}

// --------------------------------------------------------------- the floor
// The main way, from the shaft's foot to the next shaft down (or the deep
// hall): rails down it, the drifts timbered every few paces; props
// cracking here and there along it; firedamp collected in a dead end; the
// rich pocket behind the chalk cross; the cart run.
function after(ctx, H) {
  const { plan, b, rng, T, out } = ctx;
  const FY = H.FY;
  const M = matsOf(T);
  const W = ctx.W;
  const R = plan.rooms;
  const L = Lof(ctx);
  const from = R.find((r) => r.kit === 'entry');
  const to = R.find((r) => r.kit === 'boss') || R.find((r) => r.kit === 'exit');
  let way = [];
  if (from && to) {
    const start = from.cz * W + from.cx;
    const goal = to.cz * W + to.cx;
    const prev = new Int32Array(W * ctx.D).fill(-2);
    prev[start] = -1;
    const q = [start];
    while (q.length) {
      const i = q.shift();
      if (i === goal) break;
      const x = i % W;
      const z = (i / W) | 0;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (z + oz) * W + x + ox;
        if (prev[j] !== -2 || !plan.at(x + ox, z + oz)) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    for (let i = goal; i >= 0 && prev[i] !== -2; i = prev[i]) way.push(i);
  }
  // Rails down it (where the floor's clear), the timbering beside them.
  const onWay = new Set(way);
  let k = 0;
  for (const i of way) {
    const x = i % W;
    const z = (i / W) | 0;
    if (b.get(x, FY, z) === B.air && !ctx.reserved?.has(i) && !isUp(ctx, x, z) && b.get(x, FY - 1, z) !== B.water) b.set(x, FY, z, B.mine_rail);
    if (!plan.corr[i]) continue;
    if (k++ % 3 === 0) {
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (plan.at(x + ox, z + oz)) continue;
        for (const y of [FY, FY + 1]) b.set(x + ox, y, z + oz, M.timber);
      }
    }
  }
  // (And in the side drifts too, every few paces.)
  for (let i = 0; i < W * ctx.D; i++) {
    if (!plan.corr[i] || (i % W) % 4 || onWay.has(i)) continue;
    const x = i % W;
    const z = (i / W) | 0;
    for (const [ox, oz] of [[0, 1], [0, -1]]) {
      if (plan.at(x + ox, z + oz) || b.get(x + ox, FY, z + oz) !== M.wall) continue;
      b.set(x + ox, FY, z + oz, M.timber);
    }
  }
  // Props cracking in the drifts, where there's room to pass them.
  const wide = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oz]) => plan.corr[(z + oz) * W + x + ox] && b.get(x + ox, FY, z + oz) === B.air).length >= 2;
  const drift = [];
  for (let i = 0; i < W * ctx.D; i++) if (plan.corr[i] && b.get(i % W, FY, (i / W) | 0) === B.air && !ctx.reserved?.has(i)) drift.push(i);
  rng.shuffle(drift);
  let props = 0;
  for (const i of drift) {
    if (props >= 1 + Math.min(2, ctx.n)) break;
    const x = i % W;
    const z = (i / W) | 0;
    if (!H.byWall(plan, x, z) || !wide(x, z)) continue;
    b.set(x, FY, z, B.cracked_prop);
    (out.props ||= []).push({ x: b.x0 + x, z });
    props++;
  }
  // Firedamp collected in a dead end of a drift (or two), deeper down.
  let pockets = 0;
  for (const i of drift) {
    if (pockets >= Math.min(2, ctx.n + 1)) break;
    const x = i % W;
    const z = (i / W) | 0;
    const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oz]) => plan.at(x + ox, z + oz)).length;
    if (nbs !== 1 || b.get(x, FY, z) !== B.air) continue;
    const cells = [];
    for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (z + oz) * W + x + ox;
      if (plan.corr[j] && b.get(x + ox, FY, z + oz) === B.air && !ctx.reserved?.has(j)) cells.push({ x: x + ox, z: z + oz });
    }
    for (const c of cells) b.set(c.x, FY, c.z, B.firedamp);
    (out.gas ||= []).push(...cells.map((c) => ({ x: b.x0 + c.x, z: c.z })));
    pockets++;
  }
  // The rich pocket the miners sealed up behind a chalk cross (in some
  // room that isn't the way in or out).
  const rooms = rng.shuffle(R.filter((r) => !r.sealed && !['entry', 'exit', 'boss', 'vault', 'hidden', 'sump', 'shaft'].includes(r.kit)));
  let chalk = false;
  if (rng.chance(0.75)) {
    for (const r of rooms) {
      const p = pocket(ctx, H, r, B.rich_vein);
      if (!p) continue;
      b.set(p.door.x, FY, p.door.z, B.chalk_mark);
      b.set(p.door.x, FY + 1, p.door.z, M.wall);
      b.set(p.back.x, FY, p.back.z, B.chest, 0);
      b.container(p.back.x, FY, p.back.z, H.fill(rng, 9, [...H.lootFor(ctx.rec.type, H.tierOf(ctx) + 1, rng, 2, T), ['gem', rng.int(1, 3)], ['gold_ore', rng.int(2, 5)]], H.foundIn(ctx)));
      (out.chalk ||= []).push({ x: b.x0 + p.door.x, z: p.door.z, room: r.id });
      chalk = true;
      break;
    }
  }
  // The cart run: a choked drift dug off a room, rails from it straight
  // across the floor to a cart; halfway, points, and a spur off to the side
  // that ends in a buffer (thrown that way, the cart goes nowhere useful).
  let points = null;
  for (const r of rooms) {
    if (out.cartRuns && out.cartRuns.length) break;
    // (Straight in from the choke, into the room, five clear at least.)
    const lineFrom = (w, dir) => {
      const line = [];
      for (let s = 1; s <= 7; s++) {
        const x = w.x - dir.x * s;
        const z = w.z - dir.z * s;
        if (!free(ctx, H, r, x, z)) break;
        line.push({ x, z });
      }
      return line;
    };
    const p = pocket(ctx, H, r, M.wall, (w, dir) => lineFrom(w, dir).length >= 5);
    if (!p) continue;
    const line = lineFrom(p.door, p.dir);
    b.set(p.door.x, FY, p.door.z, B.cart_choke);
    b.set(p.door.x, FY + 1, p.door.z, B.cart_choke);
    for (const c of line) b.set(c.x, FY, c.z, B.mine_rail);
    const cart = line[line.length - 1];
    b.set(cart.x, FY, cart.z, B.runaway_cart);
    // The trapped shift's stash, beyond the fall.
    b.set(p.back.x, FY, p.back.z, B.chest, 0);
    b.container(p.back.x, FY, p.back.z, H.fill(rng, 9, [...H.lootFor(ctx.rec.type, H.tierOf(ctx) + 0.5, rng, 1.8, T), ['old_coin', rng.int(5, 12)]], H.foundIn(ctx)));
    const run = { cart: { x: b.x0 + cart.x, z: cart.z }, choke: { x: b.x0 + p.door.x, z: p.door.z }, room: r.id };
    // The points: at the middle of the line, a spur off to one side two or
    // three long, the lever beside the junction.
    const j = line[Math.floor(line.length / 2)];
    const side = [[p.dir.z, p.dir.x], [-p.dir.z, -p.dir.x]].find(([ox, oz]) => [1, 2].every((s) => free(ctx, H, r, j.x + ox * s, j.z + oz * s)));
    if (side) {
      const spur = [];
      for (let s = 1; s <= 3; s++) {
        const x = j.x + side[0] * s;
        const z = j.z + side[1] * s;
        if (!free(ctx, H, r, x, z)) break;
        spur.push({ x, z });
      }
      for (const c of spur) b.set(c.x, FY, c.z, B.mine_rail);
      const end = spur[spur.length - 1];
      const lev = near(ctx, H, r, j.x - side[0], j.z - side[1], 1, (x, z) => !line.some((c) => c.x === x && c.z === z));
      if (lev) {
        b.set(lev.x, FY, lev.z, B.rail_switch, 0);
        // (Which way the points send it to the choke: the papers say.)
        points = rng.pick(['over', 'back']);
        run.switch = { x: b.x0 + lev.x, z: lev.z };
        run.junction = { x: b.x0 + j.x, z: j.z };
        run.spur = { x: side[0], z: side[1], end: { x: b.x0 + end.x, z: end.z } };
        run.want = points === 'over' ? 1 : 0;
      }
    }
    (out.cartRuns ||= []).push(run);
  }
  // The surveyor's notes, if there's anything on this floor they'd tell of
  // (the chalk, the points), on a table in some room (or the office's).
  if (chalk || points) {
    const r = R.find((q) => q.kit === 'office') || rooms.find((q) => !(out.cartRuns || []).some((c) => c.room === q.id));
    if (r) {
      const t = H.placeIn(ctx, r, B.survey_table, 0, true);
      if (t) lore(ctx, t.x, t.z, L.survey(chalk, points ? (points === 'over' ? 'over, away from the spur' : 'back, toward the spur') : null));
    }
  }
  // (Whatever's raised can be stood on: the floor's height bound lifted
  // for it.)
  out.lifted = [...(ctx.lifted || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
  out.ledges = [...(ctx.ledge || [])].map((i) => ({ x: b.x0 + (i % W), z: (i / W) | 0 }));
  out.way = way.length;
}

export const MINE_ARCH = {
  own: MINE_KITS,
  kits,
  // (The office and the breakthrough are never lost to the way down.)
  keep: new Set(['office', 'breakthrough']),
  // (A room spare: some kind there's not already two of.)
  spare: (rng, n, have = []) => {
    const pool = (n === 0 ? FIRST : DEEP).filter(([k]) => !ONCE.has(k) && have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'stope';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
