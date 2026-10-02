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
    mobs: [['skeleton', 4], ['wight', 2], ['ghoul', 2], ['rat', 1], ['moth', 1]], bosses: ['barrow_king', 'mound_witch', 'huntsman'], torches: 0.25,
    // Round chambers under the mound, passages that wander a little; urns of
    // the dead, roots through the roof, and a cold mist along the floor.
    shapes: { round: 5, rect: 2, octagon: 1, cross: 1 }, wiggle: 0.5, decor: [['urn', 4], ['roots', 3], ['cobweb', 2], ['rubble', 2], ['candles', 1], ['skull_pile', 1]],
    dark: [0.08, 0.085, 0.068], motes: ['#8a9a8a', '#b8c0b0'], ambient: ['whisper', 'drip', 'wind_low'],
  },
  mine: {
    name: 'Mine', wall: B.mine_rock, floor: B.gravel, alt: B.stone, beam: B.mine_beam, regions: [2, 2], floors: [2, 4],
    kits: ['gallery', 'gallery', 'camp', 'flooded', 'collapsed', 'collapsed', 'shaft', 'trap', 'treasure', 'gallery'],
    mobs: [['crawler', 3], ['rat', 3], ['skeleton', 1], ['moth', 2], ['slime', 1]], bosses: ['worm', 'foreman', 'brood_mother'], torches: 0.2,
    // Ragged caverns and long galleries joined by winding drifts; carts and
    // props left where they stood, glowing fungus, powder nobody came back for.
    shapes: { cave: 6, ell: 2, rect: 1 }, wiggle: 1.6, decor: [['stalagmite', 4], ['glowshroom', 3], ['mine_cart', 2], ['rubble', 3], ['powder_keg', 1], ['cobweb', 1]],
    dark: [0.085, 0.068, 0.05], motes: ['#8a7a5a', '#6a5a40'], ambient: ['rumble', 'skitter', 'drip', 'tink'],
  },
  crypt: {
    name: 'Crypt', wall: B.crypt_brick, floor: B.crypt_floor, alt: B.stone_bricks, beam: null, regions: [2, 2], floors: [2, 3],
    kits: ['flooded', 'flooded', 'burial', 'ossuary', 'shrine', 'pillared', 'trap', 'library', 'treasure', 'burial'],
    mobs: [['drowned', 3], ['skeleton', 2], ['ghoul', 2], ['rat', 2], ['wisp', 1]], bosses: ['priest', 'horror', 'hollow_saint'], torches: 0.3,
    // Laid out by masons: eight-sided halls and cross-shaped chapels on
    // straight passages; candles, statues, chains, skulls stacked in niches.
    shapes: { octagon: 4, cross: 3, rect: 2, round: 1 }, wiggle: 0, decor: [['candles', 4], ['statue', 2], ['urn', 2], ['skull_pile', 2], ['hanging_chains', 2], ['cobweb', 2]],
    dark: [0.055, 0.068, 0.11], motes: ['#7ac8b0', '#a0e8d0'], ambient: ['drip', 'chains', 'drone', 'whisper'],
  },
  holdout: {
    name: 'Holdout', wall: B.cave_rock, floor: B.dirt, alt: B.path, beam: B.mine_beam, regions: [2, 2], floors: [2, 3],
    kits: ['bunks', 'cache', 'watch', 'kitchen', 'cells', 'collapsed', 'trap', 'bunks', 'watch', 'treasure'],
    mobs: [['cutthroat', 4], ['holdout_archer', 3], ['rat', 1], ['wolf', 1]], bosses: ['warlord', 'twins', 'poisoner'], torches: 0.7,
    // Caves somebody's made a home of: rooms walled off square, racks of
    // stolen arms, banners, kegs of powder, an alarm gong.
    shapes: { rect: 3, ell: 3, cave: 2 }, wiggle: 0.8, decor: [['weapon_rack', 3], ['war_banner', 2], ['powder_keg', 2], ['stalagmite', 1], ['rubble', 2]],
    dark: [0.09, 0.066, 0.058], motes: ['#8a8078', '#5a5450'], ambient: ['crackle', 'creak', 'voices'],
  },
  kavorent: {
    name: 'Kavorent Ruin', wall: B.kav_wall, floor: B.kav_floor, alt: B.kav_floor, beam: null, regions: [3, 3], floors: [6, 6],
    kits: ['hall', 'lab', 'gallery_k', 'field', 'plates', 'hangar', 'archive', 'reactor', 'hall', 'collapse_k', 'lab', 'hangar'],
    mobs: [['drone', 4], ['warden', 2], ['mender', 2], ['mite', 2], ['golem', 1]], bosses: ['overseer'], torches: 0,
    // Halls made to overawe: sentinels, conduits, the husks of what fell,
    // vents breathing in the floor, light-screens, monoliths.
    shapes: { rect: 4, octagon: 1, cross: 1 }, wiggle: 0, decor: [['kav_conduit', 3], ['kav_vent', 3], ['kav_husk', 2], ['kav_holo', 1], ['kav_statue', 1], ['kav_monolith', 1]],
    dark: [0.15, 0.18, 0.25], motes: ['#5ad8f0', '#c8fbff'], ambient: ['hum', 'pulse', 'hum', 'drone'],
  },
};

// Each floor of a Kavorent ruin lit its own colour, deeper and stranger the
// further down: how far the light's hue is turned from the ruin's own cyan
// (and how much colour is left in it), the dark, the tint of what's lit,
// the glow round a light, and the motes in the air.
export const KAV_FLOORS = [
  { name: 'cyan', hue: 0, sat: 1, dark: [0.15, 0.18, 0.25], tint: [0.72, 0.94, 1.1], glow: [140, 230, 255], motes: ['#5ad8f0', '#c8fbff'] },
  { name: 'violet', hue: 80, sat: 1, dark: [0.17, 0.13, 0.25], tint: [0.94, 0.76, 1.12], glow: [200, 150, 255], motes: ['#b07aff', '#e6d0ff'] },
  { name: 'amber', hue: -150, sat: 1, dark: [0.22, 0.16, 0.1], tint: [1.12, 0.9, 0.62], glow: [255, 190, 100], motes: ['#ffb040', '#ffe0a0'] },
  { name: 'verdant', hue: -55, sat: 1, dark: [0.11, 0.2, 0.14], tint: [0.74, 1.1, 0.84], glow: [120, 255, 170], motes: ['#5aff9a', '#d0ffe0'] },
  { name: 'crimson', hue: 160, sat: 1.1, dark: [0.22, 0.09, 0.11], tint: [1.14, 0.72, 0.74], glow: [255, 110, 120], motes: ['#ff5a6a', '#ffc8d0'] },
  { name: 'pale', hue: -140, sat: 0.3, dark: [0.19, 0.19, 0.21], tint: [1.06, 1.02, 0.96], glow: [255, 240, 210], motes: ['#ffffff', '#ffe8a0'] },
];
export function kavFloor(n) {
  return KAV_FLOORS[Math.max(0, n) % KAV_FLOORS.length];
}

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

// Room sizes by kit (w and d ranges): closets to great halls.
const KIT_SIZE = {
  boss: [[14, 18], [11, 14]], entry: [[6, 8], [5, 7]], exit: [[6, 9], [5, 7]],
  hall: [[10, 16], [8, 12]], reactor: [[11, 14], [9, 11]], hangar: [[10, 14], [8, 11]], vault: [[6, 8], [5, 6]], foundry: [[12, 15], [10, 12]],
  pillared: [[9, 14], [7, 11]], flooded: [[7, 13], [6, 10]], ossuary: [[6, 11], [5, 9]], burial: [[8, 13], [6, 9]],
  trap: [[4, 6], [4, 6]], treasure: [[5, 7], [4, 6]], shrine: [[6, 10], [6, 9]], library: [[7, 11], [5, 8]], cells: [[8, 12], [5, 7]],
  gallery: [[10, 18], [5, 8]], shaft: [[5, 8], [5, 8]], camp: [[7, 11], [6, 9]], collapsed: [[7, 12], [6, 10]],
  guard: [[5, 9], [5, 8]], bunks: [[6, 10], [5, 8]], cache: [[4, 6], [4, 6]], watch: [[8, 12], [7, 10]], kitchen: [[6, 9], [5, 7]],
};
// Kits whose fittings need a room of a given shape (rows of coffins, a
// grid of pillars, bars along a wall...); the rest take the place's own.
const KIT_SHAPES = {
  entry: ['rect'], exit: ['rect', 'octagon'], vault: ['rect'], treasure: ['rect', 'octagon'], boss: ['octagon', 'rect', 'round'],
  burial: ['rect'], pillared: ['rect', 'octagon'], library: ['rect'], cells: ['rect'], watch: ['rect'], trap: ['rect'], shrine: ['round', 'octagon', 'cross'],
  reactor: ['rect'], foundry: ['rect'], plates: ['rect'], field: ['rect'], gallery_k: ['rect'], lab: ['rect'], archive: ['rect'],
};
// Rooms with one way in, and only one: the sealed vault, the master's
// hall, a treasure room behind its gate.
export const SEALED = new Set(['vault', 'boss', 'treasure']);

function roomSize(kit, rng, big) {
  const s = KIT_SIZE[kit] || [[6, 10], [5, 8]];
  let k = big ? 1.25 : 1;
  // (Now and then a cramped one, or a great one.)
  if (!SEALED.has(kit) && kit !== 'entry' && kit !== 'exit') k *= rng.chance(0.18) ? 0.7 : rng.chance(0.15) ? 1.4 : 1;
  return [Math.max(4, Math.round(rng.int(s[0][0], s[0][1]) * k)), Math.max(4, Math.round(rng.int(s[1][0], s[1][1]) * k))];
}

function pickShape(kit, T, rng, w, d) {
  const fixed = KIT_SHAPES[kit];
  let sh = fixed ? rng.pick(fixed) : rng.weighted(Object.entries(T.shapes || { rect: 1 }));
  if ((sh === 'cross' && (w < 7 || d < 7)) || (sh === 'round' && (w < 5 || d < 5)) || (sh === 'ell' && (w < 6 || d < 6))) sh = 'rect';
  return sh;
}

// Which of a room's bounds are carved, by its shape:
//   rect     all of it
//   round    a circle or an oval (a barrow's chambers are round)
//   octagon  its corners cut away
//   cross    four arms off a middle
//   ell      an L: one corner left as rock
//   cave     a ragged blob, worked out of the living rock
// (The middle's always open, so the passages meet; and it's all one piece.)
function makeMask(r, rng) {
  const w = r.x1 - r.x0 + 1;
  const d = r.z1 - r.z0 + 1;
  const m = new Uint8Array(w * d);
  const cx = (w - 1) / 2;
  const cz = (d - 1) / 2;
  const cut = Math.max(1, Math.floor(Math.min(w, d) / 4));
  const q = rng.int(0, 3);
  const blobs = r.shape === 'cave' ? Array.from({ length: rng.int(3, 5) }, () => ({ x: rng.float(w * 0.25, w * 0.75), z: rng.float(d * 0.25, d * 0.75), rx: rng.float(w * 0.28, w * 0.5), rz: rng.float(d * 0.28, d * 0.5) })) : null;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      let on = true;
      const dx = (x - cx) / (w / 2);
      const dz = (z - cz) / (d / 2);
      if (r.shape === 'round') on = dx * dx + dz * dz <= 1.05;
      else if (r.shape === 'octagon') on = Math.min(x, w - 1 - x) + Math.min(z, d - 1 - z) >= cut;
      else if (r.shape === 'cross') on = Math.abs(x - cx) <= Math.max(1, w * 0.2) || Math.abs(z - cz) <= Math.max(1, d * 0.2);
      else if (r.shape === 'ell') {
        const ex = q % 2 ? x < cx - 0.5 : x > cx + 0.5;
        const ez = q < 2 ? z < cz - 0.5 : z > cz + 0.5;
        on = !(ex && ez);
      } else if (r.shape === 'cave') on = blobs.some((b) => ((x - b.x) / b.rx) ** 2 + ((z - b.z) / b.rz) ** 2 <= 1 + rng.float(-0.15, 0.15));
      m[z * w + x] = on ? 1 : 0;
    }
  }
  const mx = Math.floor(cx);
  const mz = Math.floor(cz);
  for (let k = -1; k <= 1; k++) {
    if (mx + k >= 0 && mx + k < w) m[mz * w + mx + k] = 1;
    if (mz + k >= 0 && mz + k < d) m[(mz + k) * w + mx] = 1;
  }
  // (One piece: whatever isn't joined to the middle goes back to rock.)
  const seen = new Uint8Array(w * d);
  const stack = [mz * w + mx];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const z = (i / w) | 0;
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const nz = z + oz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
      const j = nz * w + nx;
      if (m[j] && !seen[j]) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  for (let i = 0; i < m.length; i++) if (!seen[i]) m[i] = 0;
  return m;
}

function inMask(r, x, z) {
  if (x < r.x0 || z < r.z0 || x > r.x1 || z > r.z1) return false;
  return !!r.mask[(z - r.z0) * (r.x1 - r.x0 + 1) + (x - r.x0)];
}

// Lay rooms out and join them up. Returns the plan (with plan.ok false if
// a sealed room couldn't be given its one way in: try again).
function layout(rng, W, D, kits, big, T) {
  let plan = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    plan = tryLayout(rng, W, D, kits, big, T);
    if (plan.ok) break;
  }
  return plan;
}

function tryLayout(rng, W, D, kits, big, T) {
  const plan = new Plan(W, D);
  // (The sealed rooms placed early, while there's space for them.)
  const want = ['entry', 'exit', ...kits.filter((k) => SEALED.has(k)), ...kits.filter((k) => !SEALED.has(k))];
  let tries = 0;
  for (const kit of want) {
    for (let t = 0; t < 80; t++) {
      tries++;
      const [w, d] = roomSize(kit, rng, big);
      if (w + 7 > W || d + 7 > D) continue;
      const x0 = rng.int(2, W - w - 3);
      const z0 = rng.int(2, D - d - 3);
      const r = { x0, z0, x1: x0 + w - 1, z1: z0 + d - 1, kit, id: plan.rooms.length, sealed: SEALED.has(kit) };
      if (plan.rooms.some((o) => overlaps(o, r, o.sealed || r.sealed ? 4 : 3))) continue;
      r.cx = Math.floor((r.x0 + r.x1) / 2);
      r.cz = Math.floor((r.z0 + r.z1) / 2);
      r.shape = pickShape(kit, T, rng, w, d);
      r.mask = makeMask(r, rng);
      plan.rooms.push(r);
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (inMask(r, x, z)) plan.carve(x, z, r.id);
      break;
    }
  }
  const R = plan.rooms;
  // Ground the passages keep off: a sealed room and a pace round it (so
  // nothing runs alongside its wall, or through it).
  plan.forbid = new Uint8Array(W * D);
  for (const r of R) {
    if (!r.sealed) continue;
    for (let z = r.z0 - 1; z <= r.z1 + 1; z++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) if (x >= 0 && z >= 0 && x < W && z < D) plan.forbid[z * W + x] = 1;
  }
  // (Rock beside a room's wall costs a passage more: they come in square,
  // rather than scraping along the side.)
  plan.hug = new Uint8Array(W * D);
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      if (plan.room[z * W + x] >= 0) continue;
      if (plan.room[z * W + x + 1] >= 0 || plan.room[z * W + x - 1] >= 0 || plan.room[(z + 1) * W + x] >= 0 || plan.room[(z - 1) * W + x] >= 0) plan.hug[z * W + x] = 1;
    }
  }
  // How much a passage wanders (mines' drifts twist about; a crypt's are
  // laid straight).
  plan.wig = new Float32Array(W * D);
  const wig = T.wiggle || 0;
  if (wig) for (let i = 0; i < W * D; i++) plan.wig[i] = rng.float(0, wig);
  // Join the open rooms: the shortest links that tie them all together, and
  // a few more, so it isn't all dead ends.
  const free = R.filter((r) => !r.sealed).map((r) => r.id);
  const inTree = new Set([free[0]]);
  const edges = [];
  while (inTree.size < free.length) {
    let best = null;
    for (const i of inTree) {
      for (const j of free) {
        if (inTree.has(j)) continue;
        const d = Math.abs(R[i].cx - R[j].cx) + Math.abs(R[i].cz - R[j].cz);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    if (!best) break;
    inTree.add(best.j);
    edges.push([best.i, best.j]);
  }
  for (let k = 0; k < Math.max(1, Math.floor(free.length / 5)); k++) {
    const i = rng.pick(free);
    const near = free.map((j) => ({ j, d: Math.abs(R[j].cx - R[i].cx) + Math.abs(R[j].cz - R[i].cz) })).filter((q) => q.j !== i && !edges.some(([a, b]) => (a === i && b === q.j) || (b === i && a === q.j))).sort((a, b) => a.d - b.d)[0];
    if (near && near.d < 40) edges.push([i, near.j]);
  }
  const width = big ? 2 : 1;
  plan.ok = true;
  for (const [i, j] of edges) {
    const path = route(plan, { x: R[i].cx, z: R[i].cz }, { x: R[j].cx, z: R[j].cz });
    if (!path) {
      plan.ok = false;
      continue;
    }
    cutPath(plan, path, width);
  }
  // Each sealed room: one passage, from the nearest open room, coming
  // square into the middle of the side that faces it, through one doorway.
  for (const s of R) {
    if (!s.sealed) continue;
    const from = free.map((j) => R[j]).sort((a, b) => Math.abs(a.cx - s.cx) + Math.abs(a.cz - s.cz) - (Math.abs(b.cx - s.cx) + Math.abs(b.cz - s.cz)))[0];
    if (!from) {
      plan.ok = false;
      continue;
    }
    const sides = [
      { ox: -1, oz: 0, dx: s.x0 - 1, dz: s.cz, k: s.cx - from.cx },
      { ox: 1, oz: 0, dx: s.x1 + 1, dz: s.cz, k: from.cx - s.cx },
      { ox: 0, oz: -1, dx: s.cx, dz: s.z0 - 1, k: s.cz - from.cz },
      { ox: 0, oz: 1, dx: s.cx, dz: s.z1 + 1, k: from.cz - s.cz },
    ].sort((a, b) => b.k - a.k);
    let done = false;
    for (const sd of sides) {
      const px = sd.dx + sd.ox;
      const pz = sd.dz + sd.oz;
      if (px < 2 || pz < 2 || px >= W - 2 || pz >= D - 2 || plan.forbid[pz * W + px]) continue;
      const path = route(plan, { x: from.cx, z: from.cz }, { x: px, z: pz });
      if (!path) continue;
      cutPath(plan, path, width);
      plan.carve(sd.dx, sd.dz);
      plan.corr[sd.dz * W + sd.dx] = 1;
      // (In, to the room's floor, should its shape not reach the side.)
      let ix = sd.dx - sd.ox;
      let iz = sd.dz - sd.oz;
      while (!inMask(s, ix, iz) && Math.abs(ix - s.cx) + Math.abs(iz - s.cz) > 0) {
        plan.carve(ix, iz, s.id);
        ix -= sd.ox;
        iz -= sd.oz;
      }
      s.door = { x: sd.dx, z: sd.dz, ox: sd.ox, oz: sd.oz };
      edges.push([from.id, s.id]);
      done = true;
      break;
    }
    if (!done) plan.ok = false;
  }
  plan.edges = edges;
  plan.links = R.map(() => []);
  for (const [i, j] of edges) {
    plan.links[i].push(j);
    plan.links[j].push(i);
  }
  plan.tries = tries;
  return plan;
}

// A passage dug along a path (two wide in a Kavorent ruin).
function cutPath(plan, path, width) {
  for (const { x, z } of path) {
    const cells = width > 1 ? [[x, z], [x + 1, z], [x, z + 1]] : [[x, z]];
    for (const [cx, cz] of cells) {
      if (cx < 1 || cz < 1 || cx >= plan.W - 1 || cz >= plan.D - 1) continue;
      const i = cz * plan.W + cx;
      if (plan.forbid[i]) continue;
      if (!plan.open[i]) plan.corr[i] = 1;
      plan.carve(cx, cz);
    }
  }
}

// The way a passage goes from one spot to another: cheapest through what's
// already open, dearer for each turn (so they run straight and turn
// square), dearer still scraping along a room's wall; never through a
// sealed room's ground. (A* over spot-and-heading.)
function route(plan, from, to) {
  const { W, D } = plan;
  const N = W * D;
  const cost = new Float32Array(N * 4).fill(Infinity);
  const prev = new Int32Array(N * 4).fill(-1);
  const heap = new Heap();
  const DX = [1, -1, 0, 0];
  const DZ = [0, 0, 1, -1];
  const h = (x, z) => 0.7 * (Math.abs(x - to.x) + Math.abs(z - to.z));
  const start = from.z * W + from.x;
  for (let d = 0; d < 4; d++) {
    cost[start * 4 + d] = 0;
    heap.push(h(from.x, from.z), start * 4 + d);
  }
  const goal = to.z * W + to.x;
  while (heap.size) {
    const s = heap.pop();
    const i = s >> 2;
    const d = s & 3;
    if (i === goal) {
      const out = [];
      for (let k = s; k >= 0; k = prev[k]) out.push({ x: (k >> 2) % W, z: ((k >> 2) / W) | 0 });
      return out.reverse();
    }
    const c = cost[s];
    const x = i % W;
    const z = (i / W) | 0;
    for (let nd = 0; nd < 4; nd++) {
      const nx = x + DX[nd];
      const nz = z + DZ[nd];
      if (nx < 1 || nz < 1 || nx >= W - 1 || nz >= D - 1) continue;
      const ni = nz * W + nx;
      if (plan.forbid[ni] && ni !== goal) continue;
      let step = plan.open[ni] ? 0.7 : 1 + plan.wig[ni] + (plan.hug[ni] ? 2 : 0);
      if (nd !== d) step += 2.5;
      const ns = ni * 4 + nd;
      const nc = c + step;
      if (nc < cost[ns]) {
        cost[ns] = nc;
        prev[ns] = s;
        heap.push(nc + h(nx, nz), ns);
      }
    }
  }
  return null;
}

// A plain binary heap of (priority, value).
class Heap {
  constructor() {
    this.p = [];
    this.v = [];
  }
  get size() {
    return this.v.length;
  }
  push(p, v) {
    const P = this.p;
    const V = this.v;
    let i = V.length;
    P.push(p);
    V.push(v);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (P[up] <= p) break;
      P[i] = P[up];
      V[i] = V[up];
      i = up;
    }
    P[i] = p;
    V[i] = v;
  }
  pop() {
    const P = this.p;
    const V = this.v;
    const top = V[0];
    const lp = P.pop();
    const lv = V.pop();
    if (V.length) {
      let i = 0;
      const n = V.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        P[i] = P[c];
        V[i] = V[c];
        i = c;
      }
      P[i] = lp;
      V[i] = lv;
    }
    return top;
  }
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
// floor, with the floor tile between. (A sealed room has just the one.)
function doorways(plan, r) {
  if (r.door) return [{ x: r.door.x - r.door.ox, z: r.door.z - r.door.oz, ox: r.door.ox, oz: r.door.oz, outX: r.door.x, outZ: r.door.z }];
  const out = [];
  const seen = new Set();
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (plan.room[z * plan.W + x] !== r.id) continue;
      for (const [ox, oz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + ox;
        const nz = z + oz;
        const k = nz * plan.W + nx;
        if (!plan.at(nx, nz) || plan.room[k] === r.id || seen.has(k)) continue;
        seen.add(k);
        out.push({ x, z, ox, oz, outX: nx, outZ: nz });
      }
    }
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

// What a chest down here holds, by kind of place and how far down: poor
// pickings on the first floor (a torch, some string, a coin or two), and
// better the deeper you go. `tier` is mostly the floor (0 = the first
// down; see tierOf), a little more in a harder place. A chest holds only a
// few kinds of thing (the best of what came up); `rich` makes each likelier
// (and, rich enough, one more kind).
function lootFor(type, tier, rng, rich = 1) {
  const out = [];
  const t = Math.max(0, tier);
  const add = (k, lo, hi, chance = 1) => {
    if (rng.chance(Math.min(1, chance * rich))) out.push([k, rng.int(lo, Math.max(lo, hi))]);
  };
  if (type === 'kavorent') {
    add('kav_scrap', 1, 3 + Math.floor(t / 2));
    add(`shard_${rng.pick(SHARD_GEMS)}`, 1, 2, 0.35 + t * 0.05);
    add('healing_salve', 1, 1, 0.25);
    add('old_blueprint', 1, 1, 0.04 + t * 0.015);
    add(rng.pick(['kav_everlight', 'kav_blink', 'kav_mender', 'kav_lodestar', 'kav_bulwark', 'kav_edge', 'kav_plating']), 1, 1, 0.03 + t * 0.012);
  } else {
    // Odds and ends anybody might have left.
    add(rng.pick(['bone', 'string', 'torch', 'cloth', 'stick', 'feather']), 1, 3, 0.75);
    add(rng.pick(['bone', 'torch', 'string', 'leather', 'bread']), 1, 2, 0.35);
    // A few coins (old ones, mostly: the kingdoms that struck them are dust).
    add('old_coin', 1, 2 + Math.floor(t), 0.3 + t * 0.06);
    add('coin', 1, 2 + Math.floor(t * 1.5), 0.1 + t * 0.04);
    add('healing_salve', 1, 1, 0.1 + t * 0.05);
    if (t >= 1) {
      add(rng.pick(['iron_ingot', 'scroll', 'book', 'leather']), 1, 2, 0.25);
      add(rng.pick(['potion_vigor', 'potion_might', 'potion_breath']), 1, 1, 0.1 + t * 0.04);
    }
    if (t >= 2) {
      add(rng.pick(['gold_ingot', 'gem', 'iron_ingot']), 1, 2, 0.12 + t * 0.04);
      add(rng.pick(['potion_wind', 'potion_fury', 'potion_haste']), 1, 1, 0.06 + t * 0.03);
      add('old_blueprint', 1, 1, 0.02 + t * 0.02);
    }
    if (t >= 3) add(rng.pick(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst']), 1, 1, 0.08 + (t - 3) * 0.05);
    // Arms and armour: scraps near the top, good steel deep down.
    const gear = t < 1 ? ['dagger', 'short_sword', 'hand_axe', 'leather_cap', 'wooden_shield', 'leather_boots']
      : t < 2 ? ['iron_sword', 'mace', 'spear', 'leather_tunic', 'bow', 'iron_boots', 'wooden_shield']
        : t < 3 ? ['steel_sword', 'sabre', 'flail', 'chainmail', 'iron_helmet', 'iron_shield', 'longbow']
          : ['steel_sword', 'battle_axe', 'halberd', 'greatsword', 'warhammer', 'crossbow', 'iron_breastplate', 'iron_greaves', 'chainmail'];
    add(rng.pick(gear), 1, 1, t < 1 ? 0.05 : 0.08 + t * 0.04);
    if (type === 'mine') add(rng.pick(t >= 2 ? ['iron_ore', 'gold_ore', 'coal'] : ['coal', 'iron_ore']), 1, 3 + Math.floor(t), 0.5);
    if (type === 'holdout') add('arrow', 2, 5 + 2 * Math.floor(t), 0.4);
  }
  // Only a few kinds of thing to a chest: the best of them.
  const kinds = Math.min(4, 2 + Math.floor(t / 2) + (rich >= 1.5 ? 1 : 0));
  return out.filter(([k]) => ITEMS[k]).sort((p, q) => (ITEMS[q[0]].value || 0) - (ITEMS[p[0]].value || 0)).slice(0, kinds);
}

// How good a floor's loot runs: its number down, and a little for how hard
// the place is.
function tierOf(ctx) {
  return ctx.n + ((ctx.rec.level || 1) - 1) * 0.5;
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
  const plan = layout(rng, W, D, kits, big, T);
  const R = plan.rooms;
  const entry = R[0];
  const dep = depths(plan, 0);
  // The way down (or the master's hall) is the room furthest from the way in.
  // (Never a sealed room: those keep the one way in they were made with.)
  let far = R.findIndex((r, i) => i > 0 && !r.sealed);
  if (far < 0) far = 1;
  for (let i = 1; i < R.length; i++) if (!R[i].sealed && dep[i] !== Infinity && dep[i] > dep[far]) far = i;
  const boss = R.find((r) => r.kit === 'boss');
  if (last && boss) far = boss.id;
  if (far !== 1 && R[1] && R[1].kit === 'exit') R[1].kit = rng.pick(T.kits.filter((k) => !SEALED.has(k)));
  if (!(last && boss)) R[far].kit = last ? 'boss' : 'exit';
  entry.kit = 'entry';
  const b = new Builder(W, D);
  const out = {
    W, D, x0: b.x0, z0: b.z0, rooms: R, spawns: [], levers: [], plates: [], cracks: [], braziers: [], drains: [], nodes: [], consoles: [],
    fields: [], emitters: [], seals: [], weak: [], coffins: [], ambush: [], relicAt: null, notes: [], gongs: [], kegs: [], mimics: [], spikes: [],
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
  for (const r of R) decorate(ctx, r);
  // An old idol somewhere, its blessing waiting for whoever finds it.
  if (!big && rng.chance(0.55)) {
    const rooms = R.filter((r) => !['entry', 'boss', 'vault', 'exit'].includes(r.kit) && !r.sealed);
    if (rooms.length) placeIn(ctx, rng.pick(rooms), B.idol, META_STATE, true);
  }
  // (Dig through it or go round: there's always a way between a room's doors.)
  for (const r of R) ensureWays(ctx, r);
  passageDecor(ctx);
  spikeRuns(ctx);
  // Secrets: a hidden room behind a crumbling wall, a trapped passage or two.
  hiddenRoom(ctx);
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
  out.plan = { W: plan.W, D: plan.D, open: plan.open, room: plan.room, corr: plan.corr };
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
      if (!own(plan, r, x, z) || b.get(x, FY, z) !== B.air) continue;
      if (out.spawns.some((s) => s.x === b.x0 + x && s.z === z)) continue;
      out.spawns.push({ id: out.spawns.length, species, x: b.x0 + x, z, room: r.id, ...opts });
      break;
    }
  }
}

// Put a block on a free floor tile of a room (null if none). `edge`: up
// against its wall.
function placeIn(ctx, r, id, meta = 0, edge = false) {
  const { rng, b, plan } = ctx;
  for (let t = 0; t < 40; t++) {
    const x = rng.int(r.x0, r.x1);
    const z = rng.int(r.z0, r.z1);
    if (!own(plan, r, x, z) || b.get(x, FY, z) !== B.air) continue;
    if (edge && !byWall(plan, x, z)) continue;
    // (Not in a doorway's way.)
    if (doorBlocked(plan, r, x, z)) continue;
    b.set(x, FY, z, id, meta);
    return { x, z };
  }
  return null;
}

// Is (x, z) this room's own floor?
function own(plan, r, x, z) {
  return x >= 0 && z >= 0 && x < plan.W && z < plan.D && plan.room[z * plan.W + x] === r.id;
}

// Against a wall (rock on a side of it).
function byWall(plan, x, z) {
  return !plan.at(x + 1, z) || !plan.at(x - 1, z) || !plan.at(x, z + 1) || !plan.at(x, z - 1);
}

// Next to where a passage comes in (or anything open that isn't this room).
function doorBlocked(plan, r, x, z) {
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + ox;
    const nz = z + oz;
    if (plan.at(nx, nz) && plan.room[nz * plan.W + nx] !== r.id) return true;
  }
  return false;
}

// The rock just outside a room's floor (its walls, from inside).
function wallsOf(plan, r) {
  const out = [];
  const seen = new Set();
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      if (plan.at(x, z) || x < 1 || z < 1 || x >= plan.W - 1 || z >= plan.D - 1) continue;
      if (!(own(plan, r, x + 1, z) || own(plan, r, x - 1, z) || own(plan, r, x, z + 1) || own(plan, r, x, z - 1))) continue;
      const k = z * plan.W + x;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x, z });
    }
  }
  return out;
}

function chestIn(ctx, r, rich = 1, block = B.chest, extra = []) {
  const { rng, b, rec } = ctx;
  const at = placeIn(ctx, r, block, rng.int(0, 3), true);
  if (!at) return null;
  b.container(at.x, FY, at.z, fill(rng, block === B.chest ? 18 : 9, [...lootFor(rec.type, tierOf(ctx), rng, rich), ...extra]));
  // (Deeper down, now and then, a chest that isn't: see DungeonRun.wakeMimic.)
  if (block === B.chest && !ctx.big && ctx.n >= 1 && r.kit !== 'boss' && rng.chance(MIMIC_CHANCE)) ctx.out.mimics.push({ x: b.x0 + at.x, z: at.z });
  return at;
}
export const MIMIC_CHANCE = 0.14;

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
      // The master's hall: braziers lit round it, its master waiting, and a
      // great gate across the one way in (it comes down behind you).
      const ring = [[r.x0 + 1, r.z0 + 1], [r.x1 - 1, r.z0 + 1], [r.x0 + 1, r.z1 - 1], [r.x1 - 1, r.z1 - 1], [r.cx, r.z0 + 1], [r.cx, r.z1 - 1], [r.x0 + 1, r.cz], [r.x1 - 1, r.cz]];
      for (const [x, z] of ring) {
        let tx = x;
        let tz = z;
        // (Into the room's floor, if its shape doesn't reach the corner.)
        for (let k = 0; k < 6 && !own(ctx.plan, r, tx, tz); k++) {
          tx += Math.sign(r.cx - tx);
          tz += Math.sign(r.cz - tz);
        }
        if (own(ctx.plan, r, tx, tz) && !doorBlocked(ctx.plan, r, tx, tz) && b.get(tx, FY, tz) === B.air) b.set(tx, FY, tz, big ? B.kav_glow : B.brazier, META_STATE);
      }
      const boss = rng.pick(T.bosses);
      out.spawns.push({ id: out.spawns.length, species: boss, x: b.x0 + r.cx, z: r.cz, room: r.id, boss: true });
      // (The Twins: two of them, one bar between them.)
      if (boss === 'twins') out.spawns.push({ id: out.spawns.length, species: 'twin_b', x: b.x0 + r.cx + 2, z: r.cz, room: r.id, boss: true, twin: true });
      out.bossRoom = { x0: b.x0 + r.x0, z0: r.z0, x1: b.x0 + r.x1, z1: r.z1, id: r.id };
      if (r.door) {
        b.set(r.door.x, FY, r.door.z, big ? B.kav_gate : B.boss_gate, r.door.oz ? 0 : 1);
        b.set(r.door.x, FY + 1, r.door.z, B.air);
        out.bossGate = { x: b.x0 + r.door.x, z: r.door.z, rot: r.door.oz ? 0 : 1, ox: r.door.ox, oz: r.door.oz };
      }
      bossHall(ctx, r, boss);
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
      const special = [rng.pick(['kav_blink', 'kav_mender', 'kav_bulwark', 'kav_edge', 'kav_plating', 'kav_visor', 'kav_treads', 'kav_greaves']), 1];
      chestIn(ctx, r, 3, big ? B.kav_cache : B.chest, big ? [special, ...(rng.chance(0.45) ? [['kav_core', 1]] : [])] : [['old_blueprint', 1]]);
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
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.22) && own(ctx.plan, r, x, z) && b.get(x, FY, z) === B.air && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.bones, 0);
      const niches = rng.int(2, 3);
      const walls = rng.shuffle(wallsOf(ctx.plan, r).filter((q) => !ctx.plan.forbid[q.z * ctx.W + q.x]));
      for (let i = 0; i < niches && walls.length; i++) {
        const { x, z } = walls.pop();
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
          if (!ghoul) b.container(x, FY, z, fill(rng, 9, lootFor(rec.type, tierOf(ctx), rng, sarc ? 1.4 : 0.5).slice(0, 2)));
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
      if (alt && set.length) out.braziers.push({ set, reward: { x: b.x0 + alt.x, z: alt.z + 1 }, relic: rng.chance(0.06) ? `relic_${rng.pick(RELIC_KEYS)}` : null });
      if (rng.chance(0.5)) group(rec.type === 'crypt' ? 'wisp' : 'wight', 1, 1);
      break;
    }
    case 'pillared':
      for (let z = r.z0 + 2; z <= r.z1 - 2; z += 3) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) {
        if (!own(ctx.plan, r, x, z) || doorBlocked(ctx.plan, r, x, z)) continue;
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
        if (d < 3.5 + rng.float(0, 1.5) && own(ctx.plan, r, x, z) && !doorBlocked(ctx.plan, r, x, z)) {
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
      for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.6) && own(ctx.plan, r, x, r.z0) && !doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.bookshelf);
      for (let k = 0; k < 2; k++) placeIn(ctx, r, B.candles, 0, true);
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
      for (const { x, z } of wallsOf(ctx.plan, r)) {
        if (!rng.chance(0.3)) continue;
        const ore = rng.chance(0.06) ? B.gem_ore : rng.chance(0.15) ? B.gold_ore : rng.chance(0.4) ? B.iron_ore : B.coal_ore;
        b.set(x, FY, z, ore);
      }
      placeIn(ctx, r, B.crate, 0, true);
      placeIn(ctx, r, B.mine_cart, 0, true);
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
        if (!own(ctx.plan, r, x, z) || doorBlocked(ctx.plan, r, x, z)) continue;
        b.set(x, FY, z, B.mine_beam);
        b.set(x, FY + 1, z, B.mine_beam);
      }
      group('moth', 2, 4);
      group('crawler', 0, 1);
      break;
    // ------------------------------------------------ holdout
    case 'bunks':
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.bed, rng.int(0, 3), true);
      placeIn(ctx, r, B.weapon_rack, 0, true);
      chestIn(ctx, r, 0.9);
      group('cutthroat', 1, 3);
      break;
    case 'cache':
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.crate, 0, true);
      placeIn(ctx, r, B.powder_keg, 0, true);
      chestIn(ctx, r, 1.4, B.chest, [['coin', rng.int(3, 8)]]);
      chestIn(ctx, r, 1);
      group('cutthroat', 1, 2);
      break;
    case 'watch': {
      // A barricade across the room, archers behind it.
      const z = Math.floor((r.z0 + r.z1) / 2);
      for (let x = r.x0 + 1; x <= r.x1 - 1; x++) if (rng.chance(0.7) && own(ctx.plan, r, x, z) && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.fence);
      // (And a gong, to rouse the place.)
      const gong = placeIn(ctx, r, B.gong, 0, true);
      if (gong) out.gongs.push({ x: b.x0 + gong.x, z: gong.z });
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
      for (let x = r.x0; x <= r.x1; x += 2) if (own(ctx.plan, r, x, r.z0) && !doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.iron_bars);
      placeIn(ctx, r, B.bones);
      placeIn(ctx, r, B.hanging_chains, 0, true);
      chestIn(ctx, r, 0.8, B.chest, [['lead', 1]]);
      group('cutthroat', 1, 1);
      break;
    // ------------------------------------------------ Kavorent
    case 'hall':
      for (let z = r.z0 + 2; z <= r.z1 - 2; z += 4) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 4) {
        if (!own(ctx.plan, r, x, z) || doorBlocked(ctx.plan, r, x, z)) continue;
        b.set(x, FY, z, B.kav_wall);
        b.set(x, FY + 1, z, B.kav_glow);
      }
      // Sentinels along the far wall, a monolith at either end.
      for (let x = r.x0 + 1; x <= r.x1 - 1; x += 3) {
        if (!own(ctx.plan, r, x, r.z0) || doorBlocked(ctx.plan, r, x, r.z0) || b.get(x, FY, r.z0) !== B.air) continue;
        b.set(x, FY, r.z0, x === r.x0 + 1 || x + 3 > r.x1 - 1 ? B.kav_monolith : B.kav_statue);
      }
      group('drone', 1, 2);
      group('warden', 0, 1);
      break;
    case 'lab':
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.kav_console, 0, true);
      for (let i = 0; i < 2; i++) placeIn(ctx, r, B.kav_holo, 0, true);
      chestIn(ctx, r, 1, B.kav_cache);
      group('mender', 1, 2);
      group('drone', 1, 1);
      break;
    case 'archive':
      for (let x = r.x0; x <= r.x1; x += 2) if (own(ctx.plan, r, x, r.z0) && !doorBlocked(ctx.plan, r, x, r.z0)) b.set(x, FY, r.z0, B.kav_glow);
      chestIn(ctx, r, 1.2, B.kav_cache, [['old_blueprint', 1]]);
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.kav_holo, 0, true);
      placeIn(ctx, r, B.kav_monolith, 0, true);
      group('drone', 1, 2);
      break;
    case 'hangar':
      // A golem (or two) standing dormant, a mender or two tending it; the
      // husks of others round the walls, and vents in the floor.
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.kav_husk, rng.int(0, 3), true);
      for (let i = 0; i < 3; i++) placeIn(ctx, r, B.kav_vent);
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
      b.container(r.cx, FY, r.cz + 1, fill(rng, 9, [...lootFor('kavorent', tierOf(ctx), rng, 2), ...(n >= 2 && rng.chance(0.35) ? [['kav_core', 1]] : [])]));
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
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (rng.chance(0.25) && own(ctx.plan, r, x, z) && !doorBlocked(ctx.plan, r, x, z)) b.set(x, FY, z, B.kav_debris);
      group('mite', 1, 3);
      group('drone', 0, 1);
      break;
    default:
      group(pickMob(ctx), 1, 2);
  }
}

// A way kept clear across a room, from each of its doorways to the first:
// whatever's been put in the way (rubble, pillars, the room's dressing) is
// cleared along the cheapest line, sparing chests and the like if it can.
const KEEP = new Set(['chest', 'coffin', 'sarcophagus', 'kav_cache', 'altar', 'lever', 'relic', 'brazier', 'kav_node', 'kav_console', 'gong', 'idol']);
function ensureWays(ctx, r) {
  const { plan, b } = ctx;
  const doors = doorways(plan, r).filter((d) => own(plan, r, d.x, d.z));
  if (doors.length < 2) return;
  const W = plan.W;
  const blocked = (x, z) => BLOCKS[b.get(x, FY, z)].solid || BLOCKS[b.get(x, FY + 1, z)].solid;
  const start = doors[0].z * W + doors[0].x;
  const cost = new Map([[start, 0]]);
  const prev = new Map([[start, -1]]);
  const heap = new Heap();
  heap.push(0, start);
  while (heap.size) {
    const i = heap.pop();
    const x = i % W;
    const z = (i / W) | 0;
    const c = cost.get(i);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const nz = z + oz;
      if (!own(plan, r, nx, nz)) continue;
      const j = nz * W + nx;
      const step = blocked(nx, nz) ? (KEEP.has(BLOCKS[b.get(nx, FY, nz)].name) ? 30 : 1) : 0.001;
      if (cost.has(j) && cost.get(j) <= c + step) continue;
      cost.set(j, c + step);
      prev.set(j, i);
      heap.push(c + step, j);
    }
  }
  for (const d of doors.slice(1)) {
    for (let i = d.z * W + d.x; i >= 0 && prev.has(i); i = prev.get(i)) {
      const x = i % W;
      const z = (i / W) | 0;
      for (const y of [FY, FY + 1]) if (BLOCKS[b.get(x, y, z)].solid) b.set(x, y, z, B.air);
    }
  }
}

// --------------------------------------------------------------- dressing
// Each kind of place dressed in its own things (see DTYPES.decor): a few to
// a room, by its size; the solid ones against the walls, out of the way.
const WALLWARD = new Set(['urn', 'statue', 'skull_pile', 'mine_cart', 'stalagmite', 'weapon_rack', 'powder_keg', 'war_banner', 'hanging_chains', 'roots', 'candles', 'kav_conduit', 'kav_statue', 'kav_holo', 'kav_monolith', 'kav_husk']);
function decorate(ctx, r) {
  const { rng, T, plan, b } = ctx;
  if (!T.decor || !T.decor.length || r.kit === 'vault' || r.kit === 'hidden' || r.kit === 'boss') return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (own(plan, r, x, z)) area++;
  const n = Math.round((area / 16) * rng.float(0.6, 1.3));
  for (let i = 0; i < n; i++) {
    const k = rng.weighted(T.decor);
    if (k === 'cobweb') continue;
    placeIn(ctx, r, B[k], rng.int(0, 3), WALLWARD.has(k));
  }
  // Cobwebs strung across the corners.
  if (T.decor.some(([k]) => k === 'cobweb')) {
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (!own(plan, r, x, z) || b.get(x, FY, z) !== B.air || doorBlocked(plan, r, x, z)) continue;
        const wx = !plan.at(x - 1, z) ? -1 : !plan.at(x + 1, z) ? 1 : 0;
        const wz = !plan.at(x, z - 1) ? -1 : !plan.at(x, z + 1) ? 1 : 0;
        if (wx && wz && rng.chance(0.45)) b.set(x, FY, z, B.cobweb, wx < 0 ? 0 : 1);
      }
    }
  }
  // A holdout keeps a gong in its bunkrooms too.
  if (r.kit === 'bunks' && rng.chance(0.5)) {
    const g = placeIn(ctx, r, B.gong, 0, true);
    if (g) ctx.out.gongs.push({ x: b.x0 + g.x, z: g.z });
  }
}

// The passages: webs in their corners, fallen stone, glowcaps in a mine's.
function passageDecor(ctx) {
  const { rng, plan, b, T, big } = ctx;
  if (big) return;
  const has = (k) => T.decor.some(([q]) => q === k);
  for (let z = 1; z < plan.D - 1; z++) {
    for (let x = 1; x < plan.W - 1; x++) {
      if (!plan.corr[z * plan.W + x] || plan.room[z * plan.W + x] >= 0 || b.get(x, FY, z) !== B.air) continue;
      const turn = (plan.at(x + 1, z) || plan.at(x - 1, z)) && (plan.at(x, z + 1) || plan.at(x, z - 1));
      if (turn && has('cobweb') && rng.chance(0.18)) b.set(x, FY, z, B.cobweb, rng.int(0, 1));
      else if (has('glowshroom') && rng.chance(0.025)) b.set(x, FY, z, B.glowshroom);
      else if (has('roots') && rng.chance(0.02)) b.set(x, FY, z, B.roots);
      else if (rng.chance(0.015)) b.set(x, FY, z, B.rubble, rng.int(0, 1));
    }
  }
}

// Spikes across a passage or two: two or three in a row, each coming up a
// beat after the one before (time it, and go through between).
function spikeRuns(ctx) {
  const { rng, plan, b, out, big } = ctx;
  if (big) return;
  const n = rng.int(1, 3);
  for (let k = 0, tries = 0; k < n && tries < 120; tries++) {
    const x = rng.int(2, plan.W - 3);
    const z = rng.int(2, plan.D - 3);
    const i = z * plan.W + x;
    if (!plan.corr[i] || plan.room[i] >= 0 || b.get(x, FY, z) !== B.air) continue;
    const alongX = plan.at(x + 1, z) && plan.at(x - 1, z) && !plan.at(x, z + 1) && !plan.at(x, z - 1);
    const alongZ = plan.at(x, z + 1) && plan.at(x, z - 1) && !plan.at(x + 1, z) && !plan.at(x - 1, z);
    if (!alongX && !alongZ) continue;
    const len = rng.int(2, 3);
    const phase = rng.float(0, SPIKE_CYCLE);
    let placed = 0;
    for (let j = 0; j < len; j++) {
      const sx = alongX ? x + j : x;
      const sz = alongZ ? z + j : z;
      const si = sz * plan.W + sx;
      if (!plan.corr[si] || plan.room[si] >= 0 || b.get(sx, FY, sz) !== B.air) break;
      b.set(sx, FY, sz, B.spikes);
      out.spikes.push({ x: b.x0 + sx, z: sz, phase: phase + j * 0.3 });
      placed++;
    }
    if (placed) k++;
  }
}
// How long a spike takes to come round (down, a rattle, up).
export const SPIKE_CYCLE = 3.2;

// The master's hall, fitted out for it: standing stones round a barrow
// king's, pillars and candles in a crypt's, stalagmites and glowing fungus
// in a mine's, banners and powder kegs in a holdout's; and a throne at the
// far end from the gate, for the dead that rule.
function bossHall(ctx, r, boss) {
  const { rng, b, plan, T, rec } = ctx;
  const type = rec.type;
  const put = (x, z, id, meta = 0, high = false) => {
    if (!own(plan, r, x, z) || b.get(x, FY, z) !== B.air || doorBlocked(plan, r, x, z)) return false;
    if (Math.abs(x - r.cx) <= 1 && Math.abs(z - r.cz) <= 1) return false;
    b.set(x, FY, z, id, meta);
    if (high) b.set(x, FY + 1, z, id, meta);
    return true;
  };
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  // (Away from the gate.)
  const back = r.door ? { x: r.cx - r.door.ox * Math.floor(w / 2 - 1), z: r.cz - r.door.oz * Math.floor(d / 2 - 1) } : { x: r.cx, z: r.z0 + 1 };
  if (type === 'barrow') {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3;
      put(Math.round(r.cx + Math.cos(a) * w * 0.32), Math.round(r.cz + Math.sin(a) * d * 0.32), T.wall, 0, true);
    }
    for (let k = 0; k < 4; k++) placeIn(ctx, r, B.urn, rng.int(0, 3), true);
    for (let k = 0; k < 3; k++) placeIn(ctx, r, B.roots, 0, true);
  } else if (type === 'crypt') {
    for (const [fx, fz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) put(Math.round(r.x0 + w * fx), Math.round(r.z0 + d * fz), T.wall, 0, true);
    for (let k = 0; k < 6; k++) placeIn(ctx, r, B.candles, 0, true);
    for (let k = 0; k < 2; k++) placeIn(ctx, r, B.hanging_chains, 0, true);
  } else if (type === 'mine') {
    for (let k = 0; k < 6; k++) placeIn(ctx, r, B.stalagmite, rng.int(0, 3), rng.chance(0.5));
    for (let k = 0; k < 5; k++) placeIn(ctx, r, B.glowshroom, 0, false);
    for (let k = 0; k < 3; k++) placeIn(ctx, r, B.rubble, rng.int(0, 1), false);
    if (boss === 'foreman') for (let k = 0; k < 3; k++) placeIn(ctx, r, B.powder_keg, 0, true);
    if (boss === 'brood_mother') for (let k = 0; k < 10; k++) placeIn(ctx, r, B.cobweb, rng.int(0, 1), false);
  } else if (type === 'kavorent') {
    // The Overseer's hall: sentinels ranked down both sides, monoliths
    // between them, conduits along the back wall.
    for (let z = r.z0 + 1; z <= r.z1 - 1; z += 2) {
      const id = (z - r.z0) % 4 === 1 ? B.kav_statue : B.kav_monolith;
      put(r.x0, z, id);
      put(r.x1, z, id);
    }
    for (let x = r.x0 + 2; x <= r.x1 - 2; x += 2) put(x, back.z < r.cz ? r.z0 : r.z1, B.kav_conduit);
    for (let k = 0; k < 4; k++) placeIn(ctx, r, B.kav_vent);
  } else if (type === 'holdout') {
    for (let k = 0; k < 4; k++) placeIn(ctx, r, B.war_banner, 0, true);
    for (let k = 0; k < 2; k++) placeIn(ctx, r, B.weapon_rack, 0, true);
    for (let k = 0; k < 3; k++) placeIn(ctx, r, B.powder_keg, 0, true);
  }
  // The throne (the dead rule from one; bandits sit on a stolen chair).
  if (type === 'barrow' || type === 'crypt') put(back.x, back.z, B.bone_throne);
}

// A small room beyond a crumbling wall, joined to nothing: there's good
// stuff in it, and nobody's been in for a long time.
function hiddenRoom(ctx) {
  const { rng, plan, b, T, out, rec, big } = ctx;
  for (let t = 0; t < 30; t++) {
    const r = plan.rooms[rng.int(1, plan.rooms.length - 1)];
    if (r.sealed || r.kit === 'hidden') continue;
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
    for (let z = room.z0 - 1; z <= room.z1 + 1 && clear; z++) for (let x = room.x0 - 1; x <= room.x1 + 1; x++) if (plan.at(x, z) || plan.forbid[z * plan.W + x]) clear = false;
    if (!clear) continue;
    room.id = plan.rooms.length;
    room.kit = 'hidden';
    room.cx = Math.floor((room.x0 + room.x1) / 2);
    room.cz = Math.floor((room.z0 + room.z1) / 2);
    room.shape = 'rect';
    room.mask = new Uint8Array((room.x1 - room.x0 + 1) * (room.z1 - room.z0 + 1)).fill(1);
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
    chestIn(ctx, room, 2.2, big ? B.kav_cache : B.chest, big ? [[`shard_${rng.pick(SHARD_GEMS)}`, rng.int(2, 4)]] : rng.chance(0.05) ? [[`relic_${rng.pick(RELIC_KEYS)}`, 1]] : [['old_coin', rng.int(2, 5)]]);
    if (!big) placeIn(ctx, room, B.bones);
    void rec;
    return room;
  }
  return null;
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
    const others = plan.rooms.filter((q) => q !== r && !q.sealed && q.kit !== 'hidden');
    const lr = rng.pick(others);
    const at = lr ? placeIn(ctx, lr, B.lever, 0, true) : null;
    if (at) out.levers.push({ x: b.x0 + at.x, z: at.z, gates });
    else for (const g of gates) b.set(g.x - b.x0, FY, g.z, B.portcullis_up, g.rot);
  }
}

export { BLOCKS };
