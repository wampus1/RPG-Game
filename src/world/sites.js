// Where the old places are, and what shows of them above ground: a barrow
// mound with a stone door in it, a mine's headframe over its shaft, a
// ruined chapel round a sinkhole, a cave in a rock outcrop with a palisade
// before it, and the Kavorent's spires, five paces square and taller than
// anything men have built. (What's below: see dungeongen.js.)
import { REGION_W, REGION_D, MAP_W, MAP_H, WORLD_Y } from '../config.js';
import { B, BLOCKS } from './blocks.js';
import { RNG, hash4 } from '../util/rng.js';

// What kind of place suits a map square, if any: by its land and its
// neighbours.
function kindFor(ow, c, rng) {
  const near = (dx, dz) => ow.cell(c.cx + dx, c.cz + dz);
  let mtn = 0;
  let water = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const q = near(dx, dz);
    if (!q) continue;
    if (q.mountainness > 0.1 || q.biome === 'mountain') mtn++;
    if (q.lake || q.river || q.biome === 'ocean') water++;
  }
  if (mtn >= 2 && rng.chance(0.75)) return 'mine';
  if ((c.biome === 'swamp' || water >= 3) && rng.chance(0.7)) return 'crypt';
  if (['plains', 'tundra', 'taiga'].includes(c.biome) && rng.chance(0.6)) return 'barrow';
  if (['forest', 'jungle', 'savanna'].includes(c.biome) && rng.chance(0.6)) return 'holdout';
  return rng.pick(['barrow', 'crypt', 'holdout', 'mine']);
}

// The old places of the island: a dozen and more dungeons, and two or three
// of the Kavorent's spires out where nobody lives. Placed with the world.
export function genSites(ow) {
  const rng = new RNG(hash4(ow.seed, 0xd0e5));
  const sites = [];
  const sett = ow.settlements;
  const farFromTowns = (c, d) => sett.every((s) => Math.hypot(s.cx + (s.cw - 1) / 2 - c.cx, (s.cz + (s.cd - 1) / 2 - c.cz) * 1.4) >= d);
  const farFromSites = (c, d) => sites.every((q) => Math.hypot(q.cx - c.cx, (q.cz - c.cz) * 1.4) >= d);
  const land = ow.cells.filter((c) => c && c.biome !== 'ocean' && c.biome !== 'beach' && !c.lake && c.settlement === null && c.cont > 0.08 && c.cx > 0 && c.cz > 0 && c.cx < MAP_W - 1 && c.cz < MAP_H - 1);
  // The Kavorent's first: the loneliest places (desert, ice, deep forest,
  // the feet of mountains).
  const lonely = land
    .filter((c) => ['desert', 'tundra', 'jungle', 'mountain', 'taiga', 'savanna', 'swamp'].includes(c.biome) && c.mountainness < 0.4)
    .map((c) => ({ c, d: Math.min(...sett.map((s) => Math.hypot(s.cx - c.cx, (s.cz - c.cz) * 1.4))) + rng.float(0, 3) }))
    .sort((a, b) => b.d - a.d);
  for (const { c } of lonely) {
    if (sites.length >= 3) break;
    if (!farFromTowns(c, 4) || !farFromSites(c, 10)) continue;
    sites.push({ id: sites.length, type: 'kavorent', cx: c.cx, cz: c.cz, seed: hash4(ow.seed, c.cx, c.cz, 0x4a7) });
  }
  // Then the dungeons, near enough to people that they have a story.
  const cands = rng.shuffle(land.slice());
  for (const c of cands) {
    if (sites.length >= 17) break;
    if (!farFromTowns(c, 2.4) || !farFromSites(c, 3.4)) continue;
    if (c.mountainness > 0.5) continue;
    const type = kindFor(ow, c, rng);
    sites.push({ id: sites.length, type, cx: c.cx, cz: c.cz, seed: hash4(ow.seed, c.cx, c.cz, sites.length, 0x5d1) });
  }
  return sites;
}

// Find the exact spot for each: flat, dry ground near the middle of its
// square. Needs the terrain (see World).
export function settleSites(world, sites) {
  const t = world.terrain;
  for (const s of sites) {
    const rng = new RNG(s.seed);
    const cx = Math.floor((s.cx + 0.5) * REGION_W);
    const cz = Math.floor((s.cz + 0.5) * REGION_D);
    let best = null;
    for (let i = 0; i < 70; i++) {
      const x = cx + rng.int(-22, 22);
      const z = cz + rng.int(-10, 10);
      const ctx = t.context(x - 6, z - 6, x + 6, z + 6);
      const col = t.column(x, z, ctx, {});
      if (col.water >= 0) continue;
      let bad = 0;
      for (let dz = -5; dz <= 5 && bad < 99; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const q = t.column(x + dx, z + dz, ctx, {});
          if (q.water >= 0 || q.sett) bad += 99;
          else bad += Math.abs(q.h - col.h);
        }
      }
      if (!best || bad < best.bad) best = { x, z, h: col.h, bad };
      if (bad < 6) break;
    }
    s.x = best ? best.x : cx;
    s.z = best ? best.z : cz;
    s.h = best ? best.h : 5;
  }
}

// --------------------------------------------------------------- above ground
// The blocks of a site's entrance, as [dx, y, dz, id, meta] from its spot
// (y absolute). `state`: { cleared, open (a spire's open side) }.
export function siteBlocks(s, state = {}) {
  const out = [];
  const h = s.h;
  const put = (dx, y, dz, id, meta = 0) => out.push([dx, y, dz, id, meta]);
  // (Right up to the sky: no tree's crown left hanging over it.)
  const clear = (r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) for (let y = h + 1; y < WORLD_Y; y++) put(dx, y, dz, B.air);
  };
  const rng = new RNG(hash4(s.seed, 0x51e));
  if (s.type === 'kavorent') {
    clear(7);
    // Dead, scorched ground round it, and fallen alloy.
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) continue;
      if (rng.chance(0.5)) put(dx, h, dz, rng.chance(0.5) ? B.gravel : B.grass_dry);
      if (rng.chance(0.08)) put(dx, h + 1, dz, B.kav_debris);
    }
    // The spire: five square, up as far as the world goes; hollow at the
    // foot round a lift.
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        put(dx, h, dz, Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? B.kav_floor : B.kav_pillar);
        for (let y = h + 1; y < WORLD_Y; y++) {
          const inner = Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && y <= h + 3;
          put(dx, y, dz, inner ? B.air : B.kav_pillar);
        }
      }
    }
    put(0, h, 0, B.kav_lift);
    // An opened side: a doorway, two high.
    const side = state.open;
    if (side !== undefined && side !== null) {
      const [ox, oz] = [[0, 2], [-2, 0], [0, -2], [2, 0]][side];
      put(ox, h + 1, oz, B.kav_door);
      put(ox, h + 2, oz, B.air);
    }
    return out;
  }
  if (state.cleared) {
    // Fallen in: a heap of rubble where the way down was.
    clear(2);
    put(0, h, 0, B.rubble_seal);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (rng.chance(0.7)) put(dx, h + 1, dz, rng.chance(0.5) ? B.cobblestone : B.gravel);
    return out;
  }
  if (s.type === 'barrow') {
    clear(5);
    // The mound, grassed over, a little high in the middle.
    for (let dz = -3; dz <= 2; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx / 4.6, dz / 3.4);
        if (d > 1) continue;
        put(dx, h + 1, dz, d > 0.75 ? B.dirt : B.grass);
        if (d < 0.55) put(dx, h + 2, dz, B.grass);
        if (d < 0.75 && d >= 0.55) put(dx, h + 1, dz, B.grass);
      }
    }
    // Standing stones round it, and the door at its foot.
    for (const [dx, dz] of [[-5, -1], [5, -1], [-4, 3], [4, 3], [0, -4]]) {
      put(dx, h + 1, dz, B.cobblestone);
      if (rng.chance(0.7)) put(dx, h + 2, dz, B.stone);
    }
    put(0, h + 1, 3, B.barrow_door);
    put(0, h + 2, 3, B.air);
    put(0, h + 1, 4, B.air);
    put(0, h, 4, B.gravel);
    return out;
  }
  if (s.type === 'mine') {
    clear(4);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h, dz, B.gravel);
    put(0, h, 0, B.mine_shaft);
    // The headframe: four posts and a beam over the shaft.
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, B.log_oak);
    for (let dx = -1; dx <= 1; dx++) put(dx, h + 4, 0, B.planks_dark);
    put(0, h + 4, -1, B.planks_dark);
    put(0, h + 4, 1, B.planks_dark);
    // Spoil heaps, an old cart's planks, a barrel.
    for (let i = 0; i < 5; i++) put(rng.int(-4, 4), h + 1, rng.int(3, 4) * (rng.chance(0.5) ? 1 : -1), rng.chance(0.5) ? B.gravel : B.cobblestone);
    put(3, h + 1, 2, B.barrel);
    put(-3, h + 1, -2, B.crate);
    return out;
  }
  if (s.type === 'crypt') {
    clear(5);
    // A chapel's ruin round the sinkhole the crypt fell into.
    for (let dz = -3; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) {
      const edge = Math.abs(dx) === 4 || Math.abs(dz) === 3;
      if (edge && rng.chance(0.65)) {
        put(dx, h + 1, dz, B.crypt_brick);
        if (rng.chance(0.4)) put(dx, h + 2, dz, B.crypt_brick);
      } else if (!edge && rng.chance(0.4)) put(dx, h, dz, B.crypt_floor);
    }
    put(0, h, 0, B.sinkhole);
    for (const [dx, dz] of [[-2, 4], [2, 4], [0, 5]]) put(dx, h + 1, dz, B.gravestone);
    put(0, h + 1, 3, B.air);
    return out;
  }
  // A holdout: a rock outcrop with a cave in its face, a palisade before it.
  clear(5);
  for (let dz = -4; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.hypot(dx / 3.6, (dz + 2) / 2.6);
    if (d > 1) continue;
    put(dx, h + 1, dz, B.cave_rock);
    if (d < 0.8) put(dx, h + 2, dz, B.cave_rock);
    if (d < 0.45) put(dx, h + 3, dz, B.cave_rock);
  }
  put(0, h + 1, 1, B.cave_mouth);
  put(0, h + 2, 1, B.air);
  for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) > 1) put(dx, h + 1, 3, B.fence);
  put(2, h + 1, 2, B.campfire);
  for (let dz = 1; dz <= 4; dz++) put(0, h, dz, B.path);
  return out;
}

// Write the bits of every site that fall in a region (when it's made).
export function stampSites(world, region) {
  const sites = world.sites || [];
  const x0 = region.x0;
  const z0 = region.z0;
  for (const s of sites) {
    if (s.x === undefined || Math.abs(s.x - (x0 + REGION_W / 2)) > REGION_W / 2 + 8 || Math.abs(s.z - (z0 + REGION_D / 2)) > REGION_D / 2 + 8) continue;
    for (const [dx, y, dz, id, meta] of siteBlocks(s, s.state || {})) {
      const x = s.x + dx;
      const z = s.z + dz;
      if (x < x0 || z < z0 || x >= x0 + REGION_W || z >= z0 + REGION_D || y < 0 || y >= WORLD_Y) continue;
      region.set(x - x0, y, z - z0, id, meta);
    }
  }
}

// Change what shows above ground of a site that's loaded (a dungeon beaten,
// a spire opened).
export function restamp(world, s) {
  for (const [dx, y, dz, id, meta] of siteBlocks(s, s.state || {})) {
    const x = s.x + dx;
    const z = s.z + dz;
    if (!world.regionAt(x, z)) continue;
    if (world.getBlock(x, y, z) !== id) world.setBlock(x, y, z, id, meta);
  }
}

// The site at (x, z), if any's entrance is right there (within a pace or two).
export function siteAt(world, x, z, r = 3) {
  return (world.sites || []).find((s) => s.x !== undefined && Math.abs(s.x - x) <= r && Math.abs(s.z - z) <= r + 1) || null;
}

export { BLOCKS, MAP_H, REGION_D };
