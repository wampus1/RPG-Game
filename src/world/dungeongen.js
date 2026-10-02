// Building one floor of a dungeon (or of a Kavorent ruin): rooms from
// hand-made kits (a guard room, an ossuary, a flooded hall, a shrine, a
// collapsed passage...), stitched together with corridors, dressed in the
// stone of the place, and seeded with what's down there: its dead and its
// beasts, its traps and puzzles, its secrets and its loot.
//
// A floor is laid out on a grid of tiles in a place apart (see World.inst):
// solid rock everywhere, rooms and passages carved out of it. You stand at
// FY; the floor block is under you, two blocks of wall rise round you.
//
// The same dungeon and floor always comes out the same (it's from the
// dungeon's seed); what's been done to it since is kept by game/dungeon.js.
import { REGION_W, REGION_D, WORLD_Y, INST_RX } from '../config.js';
import { B, BLOCKS, META_STATE } from './blocks.js';
import { Region } from './region.js';
import { RNG, hash4 } from '../util/rng.js';
import { ITEMS, RELICS, SHARD_GEMS } from './items.js';

export const FY = 5; // standing level on a dungeon floor
const WALL_H = 2; // how high the walls show

// --------------------------------------------------------------- kinds
// Each kind of place: its stone, its floors, the rooms it's made of, who
// lives there, how deep it goes and who rules it.
export const DTYPES = {
  barrow: {
    name: 'Barrow', wall: B.barrow_stone, floor: B.barrow_earth, alt: B.crypt_floor, beam: null, regions: [2, 2], floors: [2, 3],
    kits: ['guard', 'ossuary', 'burial', 'shrine', 'burial', 'collapsed', 'pillared', 'trap', 'treasure', 'guard'],
    mobs: [['skeleton', 4], ['wight', 2], ['ghoul', 2], ['rat', 1], ['moth', 1]], boss: 'barrow_king', torches: 0.25,
  },
  mine: {
    name: 'Mine', wall: B.mine_rock, floor: B.gravel, alt: B.stone, beam: B.mine_beam, regions: [2, 2], floors: [2, 4],
    kits: ['gallery', 'gallery', 'camp', 'flooded', 'collapsed', 'collapsed', 'shaft', 'trap', 'treasure', 'gallery'],
    mobs: [['crawler', 3], ['rat', 3], ['skeleton', 1], ['moth', 2], ['slime', 1]], boss: 'worm', torches: 0.2,
  },
  crypt: {
    name: 'Crypt', wall: B.crypt_brick, floor: B.crypt_floor, alt: B.stone_bricks, beam: null, regions: [2, 2], floors: [2, 3],
    kits: ['flooded', 'flooded', 'burial', 'ossuary', 'shrine', 'pillared', 'trap', 'library', 'treasure', 'burial'],
    mobs: [['drowned', 3], ['skeleton', 2], ['ghoul', 2], ['rat', 2], ['wisp', 1]], boss: 'priest', altBoss: 'horror', torches: 0.3,
  },
  holdout: {
    name: 'Holdout', wall: B.cave_rock, floor: B.dirt, alt: B.path, beam: B.mine_beam, regions: [2, 2], floors: [2, 3],
    kits: ['bunks', 'cache', 'watch', 'kitchen', 'cells', 'collapsed', 'trap', 'bunks', 'watch', 'treasure'],
    mobs: [['cutthroat', 4], ['holdout_archer', 3], ['rat', 1], ['wolf', 1]], boss: 'warlord', torches: 0.7,
  },
  kavorent: {
    name: 'Kavorent Ruin', wall: B.kav_wall, floor: B.kav_floor, alt: B.kav_floor, beam: null, regions: [3, 3], floors: [6, 6],
    kits: ['hall', 'lab', 'gallery_k', 'field', 'plates', 'hangar', 'archive', 'reactor', 'hall', 'collapse_k', 'lab', 'hangar'],
    mobs: [['drone', 4], ['warden', 2], ['mender', 2], ['mite', 2], ['golem', 1]], boss: 'overseer', torches: 0,
  },
};

// --------------------------------------------------------------- layout
// A floor's plan before it's built: rooms and passages on a grid.
class Plan {
  constructor(W, D) {
    this.W = W;
    this.D = D;
    this.open = new Uint8Array(W * D); // 0 rock, 1 floor
    this.room = new Int16Array(W * D).fill(-1);
    this.rooms = [];
    this.corr = new Uint8Array(W * D); // 1: a passage
  }
  at(x, z) {
    return x >= 0 && z >= 0 && x < this.W && z < this.D ? this.open[z * this.W + x] : 0;
  }
  carve(x, z, room = -1) {
    if (x < 1 || z < 1 || x >= this.W - 1 || z >= this.D - 1) return;
    const i = z * this.W + x;
    this.open[i] = 1;
    if (room >= 0) this.room[i] = room;
  }
}

function overlaps(a, b, gap) {
  return a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.z0 - gap <= b.z1 && b.z0 - gap <= a.z1;
}

// Room sizes by kit (w and d ranges).
const KIT_SIZE = {
  boss: [[13, 17], [10, 13]], entry: [[6, 8], [5, 7]], exit: [[6, 9], [5, 7]],
  hall: [[10, 16], [8, 12]], reactor: [[11, 14], [9, 11]], hangar: [[10, 14], [8, 11]], vault: [[6, 8], [5, 6]], foundry: [[12, 15], [10, 12]],
  pillared: [[9, 13], [7, 10]], flooded: [[8, 12], [6, 9]], ossuary: [[7, 11], [6, 8]], burial: [[8, 12], [6, 8]],
};

function roomSize(kit, rng, big) {
  const s = KIT_SIZE[kit] || [[6, 10], [5, 8]];
  const k = big ? 1.25 : 1;
  return [Math.round(rng.int(s[0][0], s[0][1]) * k), Math.round(rng.int(s[1][0], s[1][1]) * k)];
}

// Lay rooms out and join them up. Returns the plan.
function layout(rng, W, D, kits, big) {
  const plan = new Plan(W, D);
  const want = ['entry', 'exit', ...kits];
  let tries = 0;
  for (const kit of want) {
    for (let t = 0; t < 60; t++) {
      tries++;
      const [w, d] = roomSize(kit, rng, big);
      const x0 = rng.int(2, W - w - 3);
      const z0 = rng.int(2, D - d - 3);
      const r = { x0, z0, x1: x0 + w - 1, z1: z0 + d - 1, kit, id: plan.rooms.length };
      if (plan.rooms.some((o) => overlaps(o, r, 3))) continue;
      r.cx = Math.floor((r.x0 + r.x1) / 2);
      r.cz = Math.floor((r.z0 + r.z1) / 2);
      plan.rooms.push(r);
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) plan.carve(x, z, r.id);
      break;
    }
  }
  // Join them: the shortest links that tie them all together, and a few
  // more, so it isn't all dead ends.
  const R = plan.rooms;
  const inTree = new Set([0]);
  const edges = [];
  while (inTree.size < R.length) {
    let best = null;
    for (const i of inTree) for (let j = 0; j < R.length; j++) {
      if (inTree.has(j)) continue;
      const d = Math.abs(R[i].cx - R[j].cx) + Math.abs(R[i].cz - R[j].cz);
      if (!best || d < best.d) best = { i, j, d };
    }
    if (!best) break;
    inTree.add(best.j);
    edges.push([best.i, best.j]);
  }
  for (let k = 0; k < Math.max(1, Math.floor(R.length / 5)); k++) {
    const i = rng.int(0, R.length - 1);
    const near = R.map((r, j) => ({ j, d: Math.abs(r.cx - R[i].cx) + Math.abs(r.cz - R[i].cz) })).filter((q) => q.j !== i && !edges.some(([a, b]) => (a === i && b === q.j) || (b === i && a === q.j))).sort((a, b) => a.d - b.d)[0];
    if (near && near.d < 40) edges.push([i, near.j]);
  }
  plan.edges = edges;
  const width = big ? 2 : 1;
  for (const [i, j] of edges) corridor(plan, R[i], R[j], rng, width);
  plan.links = R.map(() => []);
  for (const [i, j] of edges) {
    plan.links[i].push(j);
    plan.links[j].push(i);
  }
  plan.tries = tries;
  return plan;
}

// An L-shaped passage from one room's middle to another's.
function corridor(plan, a, b, rng, width) {
  const horizFirst = rng.chance(0.5);
  const cut = (x, z) => {
    for (let k = 0; k < width; k++) {
      const i0 = z * plan.W + x;
      if (!plan.open[i0]) plan.corr[i0] = 1;
      plan.carve(x, z);
      if (k) {
        const ix = (z + 1) * plan.W + x;
        if (!plan.open[ix]) plan.corr[ix] = 1;
        plan.carve(x, z + 1);
        const iy = z * plan.W + x + 1;
        if (!plan.open[iy]) plan.corr[iy] = 1;
        plan.carve(x + 1, z);
      }
    }
  };
  let x = a.cx;
  let z = a.cz;
  const stepX = () => {
    while (x !== b.cx) {
      cut(x, z);
      x += Math.sign(b.cx - x);
    }
  };
  const stepZ = () => {
    while (z !== b.cz) {
      cut(x, z);
      z += Math.sign(b.cz - z);
    }
  };
  if (horizFirst) {
    stepX();
    stepZ();
  } else {
    stepZ();
    stepX();
  }
  cut(x, z);
}

// Rooms by how many passages it takes to reach them from the first.
function depths(plan, from) {
  const d = plan.rooms.map(() => Infinity);
  d[from] = 0;
  const q = [from];
  while (q.length) {
    const i = q.shift();
    for (const j of plan.links[i]) if (d[j] === Infinity) {
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return d;
}

// Where a room's passages come into it: the open tiles just outside its
// walls, with the wall tile between.
function doorways(plan, r) {
  const out = [];
  const check = (x, z, ox, oz) => {
    if (plan.at(x, z) && plan.room[z * plan.W + x] !== r.id) out.push({ x: x - ox, z: z - oz, ox, oz, outX: x, outZ: z });
  };
  for (let x = r.x0; x <= r.x1; x++) {
    check(x, r.z0 - 1, 0, -1);
    check(x, r.z1 + 1, 0, 1);
  }
  for (let z = r.z0; z <= r.z1; z++) {
    check(r.x0 - 1, z, -1, 0);
    check(r.x1 + 1, z, 1, 0);
  }
  return out;
}

// --------------------------------------------------------------- building it
// The blocks of the floor, written into regions in the place apart.
class Builder {
  constructor(W, D) {
    this.W = W;
    this.D = D;
    this.rw = Math.ceil(W / REGION_W);
    this.rd = Math.ceil(D / REGION_D);
    this.x0 = INST_RX * REGION_W;
    this.z0 = 0;
    this.regions = new Map();
    for (let j = 0; j < this.rd; j++) for (let i = 0; i < this.rw; i++) this.regions.set((INST_RX + i) * 4096 + j, new Region(INST_RX + i, j));
  }
  region(x, z) {
    return this.regions.get((INST_RX + Math.floor(x / REGION_W)) * 4096 + Math.floor(z / REGION_D));
  }
  // (Local tile coordinates.)
  set(x, y, z, id, meta = 0) {
    if (x < 0 || z < 0 || x >= this.rw * REGION_W || z >= this.rd * REGION_D || y < 0 || y >= WORLD_Y) return;
    this.region(x, z).set(x % REGION_W, y, z % REGION_D, id, meta);
  }
  get(x, y, z) {
    if (x < 0 || z < 0 || x >= this.rw * REGION_W || z >= this.rd * REGION_D || y < 0 || y >= WORLD_Y) return B.bedrock;
    return this.region(x, z).get(x % REGION_W, y, z % REGION_D);
  }
  container(x, y, z, slots) {
    const r = this.region(x, z);
    r.containers.set(Region.idx(x % REGION_W, y, z % REGION_D), slots);
  }
  finish() {
    for (const r of this.regions.values()) r.recomputeTops();
  }
}

// A chest's (or coffin's, or cache's) contents.
function fill(rng, size, picks) {
  const slots = new Array(size).fill(null);
  for (const [k, n] of picks) {
    if (!ITEMS[k] || n <= 0) continue;
    let s = rng.int(0, size - 1);
    for (let i = 0; i < size && slots[s]; i++) s = (s + 1) % size;
    if (!slots[s]) slots[s] = { item: k, count: Math.min(n, ITEMS[k].stack || 64) };
  }
  return slots;
}

// What a chest down here holds, by kind of place and how deep.
function lootFor(type, depth, rng, rich = 1) {
  const out = [];
  const add = (k, lo, hi, chance = 1) => {
    if (rng.chance(Math.min(1, chance * rich))) out.push([k, rng.int(lo, hi)]);
  };
  if (type === 'kavorent') {
    add('kav_scrap', 2, 6);
    add(`shard_${rng.pick(SHARD_GEMS)}`, 1, 3, 0.8);
    add(`shard_${rng.pick(SHARD_GEMS)}`, 1, 2, 0.5);
    add('old_blueprint', 1, 1, 0.12);
    add('healing_salve', 1, 2, 0.4);
    add(rng.pick(['kav_everlight', 'kav_blink', 'kav_mender', 'kav_lodestar', 'kav_bulwark', 'kav_edge', 'kav_plating']), 1, 1, 0.06 + depth * 0.015);
    return out;
  }
  add('old_coin', 3 + depth * 2, 10 + depth * 5);
  add('coin', 2, 12 + depth * 6, 0.6);
  add('torch', 2, 5, 0.5);
  add('healing_salve', 1, 2, 0.35);
  add(rng.pick(['iron_ingot', 'gold_ingot', 'gem']), 1, 2, 0.35 + depth * 0.1);
  add(rng.pick(['bone', 'string', 'scroll', 'book', 'candle']), 1, 3, 0.4);
  add(rng.pick(['potion_vigor', 'potion_might', 'potion_breath', 'potion_wind', 'potion_fury', 'potion_haste']), 1, 1, 0.25 + depth * 0.05);
  add(rng.pick(depth >= 2 ? ['steel_sword', 'sabre', 'flail', 'chainmail', 'iron_helmet', 'iron_shield', 'longbow', 'battle_axe', 'halberd'] : ['iron_sword', 'short_sword', 'hand_axe', 'mace', 'leather_tunic', 'wooden_shield', 'iron_boots', 'bow']), 1, 1, 0.22 + depth * 0.05);
  add('old_blueprint', 1, 1, 0.08 + depth * 0.03);
  if (type === 'mine') add(rng.pick(['iron_ore', 'gold_ore', 'coal']), 2, 6, 0.7);
  if (type === 'holdout') add('arrow', 6, 16, 0.6);
  return out;
}

// --------------------------------------------------------------- the floor
// Build floor `n` (0 = the first down) of a dungeon. `rec` is the
// dungeon's record (see sim/dungeons.js): { type, seed, depth, level }.
export function buildFloor(rec, n) {
  const T = DTYPES[rec.type];
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0xd06e));
  const big = rec.type === 'kavorent';
  const W = T.regions[0] * REGION_W;
  const D = T.regions[1] * REGION_D;
  const last = n === rec.depth - 1;
  // The rooms this floor's made of (the last has its master's hall).
  let kits = rng.shuffle([...T.kits]);
  const count = big ? 18 + rng.int(0, 5) : 9 + rng.int(0, 3);
  while (kits.length < count) kits.push(rng.pick(T.kits));
  kits = kits.slice(0, count);
  if (last) kits[0] = 'boss';
  // (The sealed vault: one in the whole dungeon, on its floor; a Kavorent
  // ruin has three, and on its middle floors a foundry where a Prime Golem
  // stands waiting.)
  if (rec.vaults ? rec.vaults.includes(n) : n === rec.vaultFloor) kits.push('vault');
  if (big && (n === 2 || n === 4)) kits.push('foundry');
  const plan = layout(rng, W, D, kits, big);
  const R = plan.rooms;
  const entry = R[0];
  const dep = depths(plan, 0);
  // The way down (or the master's hall) is the room furthest from the way in.
  let far = 1;
  for (let i = 1; i < R.length; i++) if (dep[i] !== Infinity && (dep[i] > dep[far] || R[i].kit === 'boss')) far = i;
  const boss = R.find((r) => r.kit === 'boss');
  if (boss && last) far = boss.id;
  else if (R[far].kit === 'boss') R[far].kit = 'exit';
  R[1].kit = R[1].kit === 'exit' && far !== 1 ? rng.pick(T.kits) : R[1].kit;
  R[far].kit = last ? 'boss' : 'exit';
  entry.kit = 'entry';
  const b = new Builder(W, D);
  const out = {
    W, D, x0: b.x0, z0: b.z0, rooms: R, spawns: [], levers: [], plates: [], cracks: [], braziers: [], drains: [], nodes: [], consoles: [],
    fields: [], emitters: [], seals: [], weak: [], coffins: [], ambush: [], relicAt: null, notes: [],
  };
  const wall = T.wall;
  // Rock everywhere; the floor of each open tile; the walls round it.
  for (let z = 0; z < b.rd * REGION_D; z++) {
    for (let x = 0; x < b.rw * REGION_W; x++) {
      b.set(x, 0, z, B.bedrock);
      for (let y = 1; y < FY - 1; y++) b.set(x, y, z, big ? B.kav_wall : B.stone);
      const open = plan.at(x, z);
      b.set(x, FY - 1, z, open ? T.floor : wall);
      if (!open) for (let y = FY; y < FY + WALL_H; y++) b.set(x, y, z, wall);
    }
  }
  // Variety in the floors: patches of the other stone, rubble, puddles.
  for (const r of R) {
    if (rng.chance(0.4)) for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.18)) b.set(x, FY - 1, z, T.alt);
  }
  // Mine passages are propped up with timbers; the Kavorent's lit by seams.
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      if (plan.at(x, z)) continue;
      const nearOpen = plan.at(x + 1, z) || plan.at(x - 1, z) || plan.at(x, z + 1) || plan.at(x, z - 1);
      if (!nearOpen) continue;
      if (T.beam && (x + z * 3) % 7 === 0) b.set(x, FY, z, T.beam);
      if (big && (x * 7 + z * 13) % 11 === 0) b.set(x, FY + 1, z, B.kav_glow);
      // Torches in brackets on the walls, now and then (more in a holdout:
      // somebody lives there).
      if (!big && rng.chance(T.torches * 0.04) && plan.at(x, z + 1) && !plan.corr[(z + 1) * W + x]) {
        b.set(x, FY, z + 1, B.torch, META_STATE);
      }
    }
  }
  // The way in, and on.
  const up = { x: entry.cx, z: entry.z0 };
  if (big) b.set(up.x, FY - 1, up.z, B.kav_lift);
  else b.set(up.x, FY, up.z, B.stairs_up, 2);
  out.up = { x: b.x0 + up.x, z: up.z };
  out.entry = { x: b.x0 + entry.cx, z: entry.cz };
  const ex = R[far];
  if (!last) {
    const dx = ex.cx;
    const dz = ex.cz;
    if (big) b.set(dx, FY - 1, dz, B.kav_lift);
    else if (rec.type === 'mine') b.set(dx, FY - 1, dz, B.mine_shaft);
    else b.set(dx, FY - 1, dz, B.stairs_down);
    out.down = { x: b.x0 + dx, z: dz };
  }
  // Dress each room by its kit.
  const ctx = { rng, b, plan, T, rec, n, out, last, big, W, D };
  for (const r of R) dress(ctx, r);
  // Secrets: a hidden room behind a crumbling wall, cracked floors (not on
  // the bottom floor), a trapped passage or two.
  hiddenRoom(ctx);
  if (!last) crackedFloors(ctx);
  trapPassages(ctx);
  // A gate somewhere, and the lever that lifts it in another room.
  leverGate(ctx);
  // Who's about, besides: a few wandering on their own.
  for (let i = 0; i < (big ? 10 : 5); i++) {
    const r = R[rng.int(1, R.length - 1)];
    if (r.kit === 'boss' || r.kit === 'vault' || r.kit === 'entry') continue;
    spawnIn(ctx, r, pickMob(ctx), 1);
  }
  b.finish();
  out.regions = b.regions;
  out.depth = rec.depth;
  return out;
}

function pickMob(ctx) {
  const { rng, T } = ctx;
  let total = 0;
  for (const [, w] of T.mobs) total += w;
  let v = rng.float(0, total);
  for (const [k, w] of T.mobs) if ((v -= w) <= 0) return k;
  return T.mobs[0][0];
}

// Someone placed in a room (at a free floor tile in it).
function spawnIn(ctx, r, species, n = 1, opts = {}) {
  const { rng, plan, out, b } = ctx;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 20; t++) {
      const x = rng.int(r.x0 + 1, Math.max(r.x0 + 1, r.x1 - 1));
      const z = rng.int(r.z0 + 1, Math.max(r.z0 + 1, r.z1 - 1));
      if (!plan.at(x, z) || b.get(x, FY, z) !== B.air) continue;
      if (out.spawns.some((s) => s.x === b.x0 + x && s.z === z)) continue;
      out.spawns.push({ id: out.spawns.length, species, x: b.x0 + x, z, room: r.id, ...opts });
      break;
    }
  }
}

// Put a block on a free floor tile of a room (null if none).
function placeIn(ctx, r, id, meta = 0, edge = false) {
  const { rng, b, plan } = ctx;
  for (let t = 0; t < 30; t++) {
    let x = rng.int(r.x0, r.x1);
    let z = rng.int(r.z0, r.z1);
    if (edge) {
      if (rng.chance(0.5)) z = rng.chance(0.5) ? r.z0 : r.z1;
      else x = rng.chance(0.5) ? r.x0 : r.x1;
    }
    if (!plan.at(x, z) || b.get(x, FY, z) !== B.air) continue;
    // (Not in a doorway's way.)
    if (doorBlocked(plan, r, x, z)) continue;
    b.set(x, FY, z, id, meta);
    return { x, z };
  }
  return null;
}

function doorBlocked(plan, r, x, z) {
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + ox;
    const nz = z + oz;
    if ((nx < r.x0 || nx > r.x1 || nz < r.z0 || nz > r.z1) && plan.at(nx, nz)) return true;
  }
  return false;
}

function chestIn(ctx, r, rich = 1, block = B.chest, extra = []) {
  const { rng, b, rec, n } = ctx;
  const at = placeIn(ctx, r, block, rng.int(0, 3), true);
  if (!at) return null;
  b.container(at.x, FY, at.z, fill(rng, block === B.chest ? 18 : 9, [...lootFor(rec.type, n + (rec.level || 1) - 1, rng, rich), ...extra]));
  return at;
}

const RELIC_KEYS = Object.keys(RELICS);

// --------------------------------------------------------------- kits
function dress(ctx, r) {
  const { rng, b, out, T, rec, n, big } = ctx;
  const lvl = (rec.level || 1) + n * 0.5;
  const group = (k, lo, hi) => spawnIn(ctx, r, k, rng.int(lo, hi));
  switch (r.kit) {
    case 'entry':
      if (!big) {
        placeIn(ctx, r, B.brazier, META_STATE, true);
        if (n === 0) placeIn(ctx, r, B.bones);
      }
      out.notes.push({ x: b.x0 + r.cx, z: r.cz, kind: 'entry' });
      break;
    case 'exit':
      if (!big) placeIn(ctx, r, B.brazier, 0, true);
      group(pickMob(ctx), 1, 2);
      break;
    case 'boss': {
      // The master's hall: braziers lit at its corners, its master waiting.
      for (const [x, z] of [[r.x0 + 1, r.z0 + 1], [r.x1 - 1, r.z0 + 1], [r.x0 + 1, r.z1 - 1], [r.x1 - 1, r.z1 - 1]]) b.set(x, FY, z, big ? B.kav_glow : B.brazier, META_STATE);
      let boss = T.boss;
      if (T.altBoss && rng.chance(0.4)) boss = T.altBoss;
      out.spawns.push({ id: out.spawns.length, species: boss, x: b.x0 + r.cx, z: r.cz, room: r.id, boss: true });
      out.bossRoom = { x0: b.x0 + r.x0, z0: r.z0, x1: b.x0 + r.x1, z1: r.z1 };
      if (big) {
        // Four power nodes round the Overseer's hall: while they burn, it's
        // shielded.
        for (const [x, z] of [[r.x0 + 2, r.z0 + 2], [r.x1 - 2, r.z0 + 2], [r.x0 + 2, r.z1 - 2], [r.x1 - 2, r.z1 - 2]]) {
          b.set(x, FY, z, B.kav_node, META_STATE);
          out.nodes.push({ x: b.x0 + x, z, boss: true });
        }
      }
      // What it guards.
      const rich = big ? 3 : 2.5;
      // (The Overseer itself carries the ruin's great core.)
      const at = chestIn(ctx, r, rich, big ? B.kav_cache : B.chest, big ? [[rng.pick(['kav_blade', 'kav_lance', 'kav_caster', 'kav_carapace', 'kav_aegis']), 1], [rng.pick(['kav_edge', 'kav_plating', 'kav_blink']), 1]] : [['old_blueprint', 1]]);
      if (at) out.bossChest = { x: b.x0 + at.x, z: at.z };
      break;
    }
    case 'vault': {
      // Sealed: a sigil (or a glyph key) opens it.
      const doors = doorways(ctx.plan, r);
      for (const d of doors) {
        b.set(d.outX, FY, d.outZ, big ? B.kav_seal : B.sealed_door, d.oz ? 0 : 1);
        b.set(d.outX, FY + 1, d.outZ, B.air);
        out.seals.push({ x: b.x0 + d.outX, z: d.outZ });
      }
      const relic = `relic_${rng.pick(RELIC_KEYS)}`;
      const special = [rng.pick(['kav_blink', 'kav_mender', 'kav_bulwark', 'kav_edge', 'kav_plating', 'kav_visor', 'kav_treads', 'kav_greaves']), 1];
      chestIn(ctx, r, 3, big ? B.kav_cache : B.chest, big ? [special, ...(rng.chance(0.45) ? [['kav_core', 1]] : [])] : [[relic, 1], ['old_blueprint', 1]]);
      if (!big) {
        const at = placeIn(ctx, r, B.relic);
        if (at) {
          out.relicAt = { x: b.x0 + at.x, z: at.z, kind: rng.pick(RELIC_KEYS) };
        }
      }
      // (Whoever holds the key to it is somewhere on this floor.)
      const holder = ctx.plan.rooms.filter((q) => q !== r && q.kit !== 'entry' && q.kit !== 'boss' && q.kit !== 'vault');
      if (holder.length) spawnIn(ctx, rng.pick(holder), big ? 'golem' : rec.type === 'holdout' ? 'cutthroat' : 'skel_captain', 1, { key: big ? 'kav_key' : 'sigil' });
      break;
    }
    // ------------------------------------------------ barrow, crypt
    case 'guard':
      placeIn(ctx, r, B.brazier, META_STATE, true);
      for (let i = 0; i < 2; i++) placeIn(ctx, r, rng.chance(0.5) ? B.barrel : B.crate, 0, true);
      group('skeleton', 2, 3 + Math.floor(lvl / 2));
      if (rng.chance(0.4)) spawnIn(ctx, r, rec.type === 'barrow' ? 'wight' : 'skeleton', 1);
      break;
    case 'ossuary': {
      // Bones heaped everywhere; and niches cut in the walls where the
      // dead wait for you to pass.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.22) && b.get(x, FY, z) === B.air && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.bones, 0);
      const niches = rng.int(2, 3);
      for (let i = 0; i < niches; i++) {
        const side = rng.int(0, 3);
        const x = side < 2 ? rng.int(r.x0 + 1, r.x1 - 1) : side === 2 ? r.x0 - 1 : r.x1 + 1;
        const z = side >= 2 ? rng.int(r.z0 + 1, r.z1 - 1) : side === 0 ? r.z0 - 1 : r.z1 + 1;
        if (ctx.plan.at(x, z)) continue;
        ctx.plan.carve(x, z, r.id);
        b.set(x, FY, z, B.air);
        b.set(x, FY + 1, z, B.air);
        b.set(x, FY - 1, z, T.floor);
        out.spawns.push({ id: out.spawns.length, species: 'ghoul', x: b.x0 + x, z, room: r.id, ambush: true });
      }
      if (rng.chance(0.5)) chestIn(ctx, r, 0.8);
      break;
    }
    case 'burial': {
      // Coffins in rows. Some hold grave goods; some hold something else.
      for (let z = r.z0 + 1; z <= r.z1 - 1; z += 2) {
        for (let x = r.x0 + 1; x <= r.x1 - 1; x += 3) {
          if (b.get(x, FY, z) !== B.air || doorBlocked(ctx.plan, r, x, z)) continue;
          const sarc = rec.type !== 'barrow' && rng.chance(0.15);
          b.set(x, FY, z, sarc ? B.sarcophagus : B.coffin, rng.chance(0.5) ? 1 : 3);
          const ghoul = rng.chance(0.3);
          out.coffins.push({ x: b.x0 + x, z, ghoul });
          if (!ghoul) b.container(x, FY, z, fill(rng, 9, lootFor(rec.type, n, rng, sarc ? 1.4 : 0.5).slice(0, 3)));
        }
      }
      break;
    }
    case 'shrine': {
      // An altar, and three braziers gone cold. Light them all, and what was
      // kept here shows itself.
      const alt = placeIn(ctx, r, B.altar);
      const set = [];
      for (let i = 0; i < 3; i++) {
        const at = placeIn(ctx, r, B.brazier, 0, true);
        if (at) set.push({ x: b.x0 + at.x, z: at.z });
      }
      if (alt && set.length) out.braziers.push({ set, reward: { x: b.x0 + alt.x, z: alt.z + 1 }, relic: rng.chance(0.35) ? `relic_${rng.pick(RELIC_KEYS)}` : null });
      if (rng.chance(0.5)) group(rec.type === 'crypt' ? 'wisp' : 'wight', 1, 1);
      break;
    }
    case 'pillared':
      for (let z = r.z0 + 2; z <= r.z1 - 2; z += 3) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
        b.set(x, FY, z, T.wall);
        b.set(x, FY + 1, z, T.wall);
      }
      group(pickMob(ctx), 1, 3);
      break;
    case 'collapsed': {
      // Half the room fallen in: rubble to dig through, or go round.
      const rock = rec.type === 'kavorent' ? B.kav_debris : rng.chance(0.5) ? B.gravel : B.cobblestone;
      const cx = rng.int(r.x0, r.x1);
      const cz = rng.int(r.z0, r.z1);
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        const d = Math.hypot(x - cx, (z - cz) * 1.3);
        if (d < 3.5 + rng.float(0, 1.5) && !doorBlocked(ctx.plan, r, x, z)) {
          b.set(x, FY, z, rock);
          if (d < 2.2) b.set(x, FY + 1, z, rock);
        }
      }
      if (rng.chance(0.5)) placeIn(ctx, r, B.bones);
      if (rng.chance(0.4)) chestIn(ctx, r, 0.7);
      group(pickMob(ctx), 0, 2);
      break;
    }
    case 'trap':
      // (A plated passage, below: this room's just a dead end with bones in.)
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.bones);
      if (rng.chance(0.6)) chestIn(ctx, r, 1);
      break;
    case 'treasure':
      chestIn(ctx, r, 1.6);
      if (rng.chance(0.5)) chestIn(ctx, r, 1.1);
      r.gate = true;
      group(pickMob(ctx), 1, 2);
      break;
    case 'library':
      for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.6) && !doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.bookshelf);
      placeIn(ctx, r, B.table);
      chestIn(ctx, r, 0.8, B.chest, [['old_blueprint', 1], ['book', rng.int(1, 3)], ['scroll', rng.int(1, 3)]]);
      group('wisp', 0, 1);
      break;
    case 'flooded': {
      // Black water over the floor, knee deep; the drowned under it. A
      // lever somewhere in the room drains it.
      const water = [];
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        if (b.get(x, FY, z) !== B.air) continue;
        b.set(x, FY, z, B.water);
        water.push({ x: b.x0 + x, z });
      }
      const lv = placeIn(ctx, r, B.lever, 0, true) || null;
      if (lv) {
        b.set(lv.x, FY, lv.z, B.lever, 0);
        out.drains.push({ lever: { x: b.x0 + lv.x, z: lv.z }, water });
      }
      group(rec.type === 'mine' ? 'slime' : 'drowned', 2, 3);
      if (rng.chance(0.5)) chestIn(ctx, r, 1);
      break;
    }
    // ------------------------------------------------ mine
    case 'gallery': {
      // The seam they were working: ore in the walls (iron, coal, gold, a
      // gem now and then).
      for (let z = r.z0 - 1; z <= r.z1 + 1; z++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (ctx.plan.at(x, z) || !rng.chance(0.3)) continue;
        const ore = rng.chance(0.06) ? B.gem_ore : rng.chance(0.15) ? B.gold_ore : rng.chance(0.4) ? B.iron_ore : B.coal_ore;
        b.set(x, FY, z, ore);
      }
      placeIn(ctx, r, B.crate, 0, true);
      group(rng.chance(0.6) ? 'crawler' : 'rat', 1, 3);
      break;
    }
    case 'camp':
      // Where the miners camped, the day it fell in.
      placeIn(ctx, r, B.campfire);
      placeIn(ctx, r, B.bed, 0, true);
      placeIn(ctx, r, B.barrel, 0, true);
      chestIn(ctx, r, 1, B.chest, [['iron_pickaxe', 1], ['torch', 4], ['bread', 2]]);
      placeIn(ctx, r, B.bones);
      group('rat', 2, 4);
      break;
    case 'shaft':
      for (let z = r.z0 + 1; z <= r.z1 - 1; z += 3) for (let x = r.x0 + 1; x <= r.x1 - 1; x += 4) {
        b.set(x, FY, z, B.mine_beam);
        b.set(x, FY + 1, z, B.mine_beam);
      }
      group('moth', 2, 4);
      group('crawler', 0, 1);
      break;
    // ------------------------------------------------ holdout
    case 'bunks':
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.bed, rng.int(0, 3), true);
      chestIn(ctx, r, 0.9);
      group('cutthroat', 1, 3);
      break;
    case 'cache':
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.crate, 0, true);
      chestIn(ctx, r, 1.4, B.chest, [['coin', rng.int(10, 30)]]);
      chestIn(ctx, r, 1);
      group('cutthroat', 1, 2);
      break;
    case 'watch': {
      // A barricade across the room, archers behind it.
      const z = Math.floor((r.z0 + r.z1) / 2);
      for (let x = r.x0 + 1; x <= r.x1 - 1; x++) if (rng.chance(0.7) && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.fence);
      group('holdout_archer', 2, 3);
      placeIn(ctx, r, B.barrel, 0, true);
      break;
    }
    case 'kitchen':
      placeIn(ctx, r, B.campfire);
      placeIn(ctx, r, B.table);
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.barrel, 0, true);
      chestIn(ctx, r, 0.6, B.chest, [['bread', rng.int(2, 5)], ['cooked_meat', rng.int(1, 4)], ['ale', rng.int(1, 3)]]);
      group('cutthroat', 1, 2);
      break;
    case 'cells':
      for (let x = r.x0; x <= r.x1; x += 2) if (!doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.iron_bars);
      placeIn(ctx, r, B.bones);
      chestIn(ctx, r, 0.8, B.chest, [['lead', 1]]);
      group('cutthroat', 1, 1);
      break;
    // ------------------------------------------------ Kavorent
    case 'hall':
      for (let z = r.z0 + 2; z <= r.z1 - 2; z += 4) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 4) {
        b.set(x, FY, z, B.kav_wall);
        b.set(x, FY + 1, z, B.kav_glow);
      }
      group('drone', 1, 2);
      group('warden', 0, 1);
      break;
    case 'lab':
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.kav_console, 0, true);
      chestIn(ctx, r, 1, B.kav_cache);
      group('mender', 1, 2);
      group('drone', 1, 1);
      break;
    case 'archive':
      for (let x = r.x0; x <= r.x1; x += 2) if (!doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.kav_glow);
      chestIn(ctx, r, 1.2, B.kav_cache, [['old_blueprint', 1]]);
      group('drone', 1, 2);
      break;
    case 'hangar':
      // A golem (or two) standing dormant, a mender or two tending it.
      group('golem', 1, n >= 3 ? 2 : 1);
      group('mender', 1, 2);
      group('mite', 1, 3);
      chestIn(ctx, r, 1.1, B.kav_cache);
      break;
    case 'reactor': {
      // A ring of power nodes round a core housing: put the nodes out and
      // the housing opens (a core inside, on the deeper floors).
      const set = [];
      for (const [x, z] of [[r.x0 + 2, r.z0 + 2], [r.x1 - 2, r.z0 + 2], [r.x0 + 2, r.z1 - 2], [r.x1 - 2, r.z1 - 2]]) {
        b.set(x, FY, z, B.kav_node, META_STATE);
        set.push({ x: b.x0 + x, z });
      }
      b.set(r.cx, FY, r.cz, B.kav_field);
      b.set(r.cx, FY + 1, r.cz, B.kav_field);
      b.set(r.cx, FY, r.cz + 1, B.kav_cache, 0);
      b.container(r.cx, FY, r.cz + 1, fill(rng, 9, [...lootFor('kavorent', n, rng, 2), ...(n >= 2 && rng.chance(0.35) ? [['kav_core', 1]] : [])]));
      out.nodes.push({ set, field: [{ x: b.x0 + r.cx, z: r.cz }] });
      group('warden', 1, 2);
      group('drone', 1, 2);
      break;
    }
    case 'field': {
      // A wall of light across the way, and a console that drops it if you
      // can read its glyph (step on the plate that matches).
      const doors = doorways(ctx.plan, r).filter((d) => !ctx.plan.rooms.some((q) => q.kit === 'entry' && q.id === ctx.plan.room[d.outZ * ctx.W + d.outX]));
      const d = doors[0];
      if (d) {
        b.set(d.outX, FY, d.outZ, B.kav_field);
        b.set(d.outX, FY + 1, d.outZ, B.kav_field);
        const con = placeIn(ctx, r, B.kav_console, 0, true);
        const plates = [];
        for (let i = 0; i < 4; i++) {
          const at = placeIn(ctx, r, B.kav_plate, i);
          if (at) plates.push({ x: b.x0 + at.x, z: at.z, glyph: i });
        }
        if (con && plates.length) out.consoles.push({ x: b.x0 + con.x, z: con.z, plates, answer: rng.int(0, plates.length - 1), fields: [{ x: b.x0 + d.outX, z: d.outZ }] });
      }
      group('drone', 1, 2);
      break;
    }
    case 'plates': {
      // Glyph plates in a sequence: tread them in the order the console
      // shows and a cache opens.
      const plates = [];
      for (let i = 0; i < 4; i++) {
        const at = placeIn(ctx, r, B.kav_plate, i);
        if (at) plates.push({ x: b.x0 + at.x, z: at.z, glyph: i });
      }
      const con = placeIn(ctx, r, B.kav_console, 0, true);
      const cache = chestIn(ctx, r, 1.5, B.kav_cache, rng.chance(0.4) ? [[rng.pick(['kav_everlight', 'kav_lodestar', 'kav_edge']), 1]] : []);
      if (con && plates.length >= 3) out.consoles.push({ x: b.x0 + con.x, z: con.z, plates, order: rng.shuffle(plates.map((_, i) => i)).slice(0, 3), cache: cache ? { x: b.x0 + cache.x, z: cache.z } : null, locked: true });
      group('mite', 1, 2);
      break;
    }
    case 'gallery_k': {
      // Emitters in the walls, firing across the room in turn.
      for (let z = r.z0 + 1; z <= r.z1 - 1; z += 2) {
        if (ctx.plan.at(r.x0 - 1, z)) continue;
        b.set(r.x0 - 1, FY, z, B.kav_emitter, 3);
        out.emitters.push({ x: b.x0 + r.x0 - 1, z, dx: 1, dz: 0, len: r.x1 - r.x0 + 1, phase: (z - r.z0) * 0.4 });
      }
      chestIn(ctx, r, 1.2, B.kav_cache);
      break;
    }
    case 'foundry': {
      // Where they made their guardians: moulds along the walls, channels
      // of light in the floor, and the last thing made here still standing
      // in the middle, waiting. (It wakes when you come close.)
      for (let x = r.x0 + 1; x <= r.x1 - 1; x++) if (!doorBlocked(ctx.plan, r, x, r.cz)) b.set(x, FY - 1, r.cz, B.kav_glow);
      for (let z = r.z0 + 1; z <= r.z1 - 1; z++) if (!doorBlocked(ctx.plan, r, r.cx, z)) b.set(r.cx, FY - 1, z, B.kav_glow);
      for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) if (!doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.kav_debris);
      out.spawns.push({ id: out.spawns.length, species: 'prime', x: b.x0 + r.cx, z: r.cz - 1, room: r.id, guardian: true });
      group('mender', 2, 3);
      group('mite', 2, 4);
      chestIn(ctx, r, 2.4, B.kav_cache, [[rng.pick(['kav_edge', 'kav_plating', 'kav_everlight', 'kav_lodestar', 'kav_mender']), 1]]);
      break;
    }
    case 'collapse_k':
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.25) && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.kav_debris);
      group('mite', 1, 3);
      group('drone', 0, 1);
      break;
    default:
      group(pickMob(ctx), 1, 2);
  }
}

// A small room beyond a crumbling wall, joined to nothing: there's good
// stuff in it, and nobody's been in for a long time.
function hiddenRoom(ctx) {
  const { rng, plan, b, T, out, rec, big } = ctx;
  for (let t = 0; t < 30; t++) {
    const r = plan.rooms[rng.int(1, plan.rooms.length - 1)];
    if (r.kit === 'boss' || r.kit === 'vault') continue;
    const side = rng.int(0, 3);
    const w = rng.int(3, 5);
    const d = rng.int(3, 4);
    let wx;
    let wz;
    let room;
    if (side === 0) {
      wx = rng.int(r.x0 + 1, r.x1 - 1);
      wz = r.z0 - 1;
      room = { x0: wx - 1, z0: wz - d, x1: wx - 1 + w - 1, z1: wz - 1 };
    } else if (side === 1) {
      wx = rng.int(r.x0 + 1, r.x1 - 1);
      wz = r.z1 + 1;
      room = { x0: wx - 1, z0: wz + 1, x1: wx - 1 + w - 1, z1: wz + d };
    } else if (side === 2) {
      wx = r.x0 - 1;
      wz = rng.int(r.z0 + 1, r.z1 - 1);
      room = { x0: wx - w, z0: wz - 1, x1: wx - 1, z1: wz - 1 + d - 1 };
    } else {
      wx = r.x1 + 1;
      wz = rng.int(r.z0 + 1, r.z1 - 1);
      room = { x0: wx + 1, z0: wz - 1, x1: wx + w, z1: wz - 1 + d - 1 };
    }
    if (room.x0 < 2 || room.z0 < 2 || room.x1 >= plan.W - 2 || room.z1 >= plan.D - 2) continue;
    let clear = true;
    for (let z = room.z0 - 1; z <= room.z1 + 1 && clear; z++) for (let x = room.x0 - 1; x <= room.x1 + 1; x++) if (plan.at(x, z)) clear = false;
    if (!clear) continue;
    room.id = plan.rooms.length;
    room.kit = 'hidden';
    room.cx = Math.floor((room.x0 + room.x1) / 2);
    room.cz = Math.floor((room.z0 + room.z1) / 2);
    for (let z = room.z0; z <= room.z1; z++) for (let x = room.x0; x <= room.x1; x++) {
      plan.carve(x, z, room.id);
      b.set(x, FY - 1, z, T.floor);
      b.set(x, FY, z, B.air);
      b.set(x, FY + 1, z, B.air);
    }
    plan.rooms.push(room);
    b.set(wx, FY, wz, B.weak_wall);
    b.set(wx, FY + 1, wz, B.weak_wall);
    b.set(wx, FY - 1, wz, T.floor);
    out.weak.push({ x: b.x0 + wx, z: wz });
    chestIn(ctx, room, 2.2, big ? B.kav_cache : B.chest, big ? [[`shard_${rng.pick(SHARD_GEMS)}`, rng.int(2, 4)]] : rng.chance(0.4) ? [[`relic_${rng.pick(RELIC_KEYS)}`, 1]] : [['old_coin', rng.int(8, 20)]]);
    if (!big) placeIn(ctx, room, B.bones);
    void rec;
    return room;
  }
  return null;
}

// Patches of cracked floor (in passages, mostly): step on them and you go
// through, to the floor below.
function crackedFloors(ctx) {
  const { rng, plan, b, out, big } = ctx;
  if (big) return;
  const tiles = [];
  for (let z = 1; z < plan.D - 1; z++) for (let x = 1; x < plan.W - 1; x++) if (plan.corr[z * plan.W + x]) tiles.push({ x, z });
  for (let k = 0; k < 2 && tiles.length; k++) {
    const c = tiles[rng.int(0, tiles.length - 1)];
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const x = c.x + dx;
      const z = c.z + dz;
      if (!plan.at(x, z) || b.get(x, FY, z) !== B.air || !rng.chance(dx || dz ? 0.6 : 1)) continue;
      b.set(x, FY - 1, z, B.cracked_floor);
      out.cracks.push({ x: b.x0 + x, z });
    }
  }
}

// Passages with loose flagstones in them, and arrow slits in the walls
// that fire along them when one's stepped on.
function trapPassages(ctx) {
  const { rng, plan, b, out, big } = ctx;
  const n = big ? 0 : rng.int(1, 3);
  for (let k = 0, tries = 0; k < n && tries < 80; tries++) {
    const x = rng.int(2, plan.W - 3);
    const z = rng.int(2, plan.D - 3);
    if (!plan.corr[z * plan.W + x] || b.get(x, FY, z) !== B.air) continue;
    // A slit in the wall beside the plate, looking across the passage.
    let slit = null;
    for (const [ox, oz, rot] of [[0, -1, 0], [0, 1, 2], [-1, 0, 3], [1, 0, 1]]) {
      if (plan.at(x + ox, z + oz)) continue;
      if (!plan.at(x - ox, z - oz)) continue;
      slit = { x: x + ox, z: z + oz, dx: -ox, dz: -oz, rot };
      break;
    }
    if (!slit) continue;
    b.set(x, FY, z, B.pressure_plate);
    b.set(slit.x, FY, slit.z, B.arrow_slit, slit.rot);
    out.plates.push({ x: b.x0 + x, z, slits: [{ x: b.x0 + slit.x, z: slit.z, dx: slit.dx, dz: slit.dz }] });
    k++;
  }
  // The trap rooms' own passages too.
  for (const r of plan.rooms.filter((q) => q.kit === 'trap')) {
    for (let i = 0; i < 4; i++) {
      const x = rng.int(r.x0, r.x1);
      const z = rng.int(r.z0, r.z1);
      if (b.get(x, FY, z) !== B.air || doorBlocked(plan, r, x, z)) continue;
      b.set(x, FY, z, B.pressure_plate);
      // Slits in the far walls of the room, along both lines through it.
      const slits = [];
      if (!plan.at(r.x0 - 1, z)) {
        b.set(r.x0 - 1, FY, z, B.arrow_slit, 3);
        slits.push({ x: b.x0 + r.x0 - 1, z, dx: 1, dz: 0 });
      }
      if (!plan.at(x, r.z0 - 1)) {
        b.set(x, FY, r.z0 - 1, B.arrow_slit, 0);
        slits.push({ x: b.x0 + x, z: r.z0 - 1, dx: 0, dz: 1 });
      }
      out.plates.push({ x: b.x0 + x, z, slits });
    }
  }
}

// An iron gate across the way into a treasure room; a lever somewhere else
// on the floor that raises it.
function leverGate(ctx) {
  const { rng, plan, b, out } = ctx;
  const rooms = plan.rooms.filter((r) => r.gate || r.kit === 'treasure');
  for (const r of rooms) {
    const doors = doorways(plan, r);
    if (!doors.length) continue;
    const gates = [];
    for (const d of doors) {
      if (b.get(d.outX, FY, d.outZ) !== B.air) continue;
      b.set(d.outX, FY, d.outZ, B.portcullis, d.oz ? 0 : 1);
      b.set(d.outX, FY + 1, d.outZ, B.air);
      gates.push({ x: b.x0 + d.outX, z: d.outZ, rot: d.oz ? 0 : 1 });
    }
    if (!gates.length) continue;
    const others = plan.rooms.filter((q) => q !== r && q.kit !== 'boss' && q.kit !== 'vault' && q.kit !== 'hidden');
    const lr = rng.pick(others);
    const at = placeIn(ctx, lr, B.lever, 0, true);
    if (at) out.levers.push({ x: b.x0 + at.x, z: at.z, gates });
    else for (const g of gates) b.set(g.x - b.x0, FY, g.z, B.portcullis_up, g.rot);
  }
}

export { BLOCKS };
