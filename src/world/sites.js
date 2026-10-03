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
  // (The Ashborn dig deep for their forges; the old dead of Myrrow lie in
  // the wet ground.)
  if (['ashland', 'cinderwood', 'geyser'].includes(c.biome) && rng.chance(0.5)) return 'mine';
  if (['moor', 'fungal', 'mangrove'].includes(c.biome) && rng.chance(0.5)) return rng.chance(0.6) ? 'crypt' : 'barrow';
  if ((c.biome === 'swamp' || water >= 3) && rng.chance(0.7)) return 'crypt';
  if (['plains', 'tundra', 'taiga'].includes(c.biome) && rng.chance(0.6)) return 'barrow';
  if (['forest', 'jungle', 'savanna'].includes(c.biome) && rng.chance(0.6)) return 'holdout';
  return rng.pick(['barrow', 'crypt', 'holdout', 'mine']);
}

// The old places of the Dagoni Islands: on each, its own few dungeons and
// one to three of the Kavorent's spires out where nobody lives (Thessa has
// the most: see geography.js). Placed with the world.
export function genSites(ow) {
  const rng = new RNG(hash4(ow.seed, 0xd0e5));
  const sites = [];
  const sett = ow.settlements;
  const farFromTowns = (c, d) => sett.every((s) => Math.hypot(s.cx + (s.cw - 1) / 2 - c.cx, (s.cz + (s.cd - 1) / 2 - c.cz) * 1.4) >= d);
  const farFromSites = (c, d) => sites.every((q) => Math.hypot(q.cx - c.cx, (q.cz - c.cz) * 1.4) >= d);
  for (const I of ow.islands || []) {
    const land = ow.liveCells.filter((c) => c.island === I.key && c.biome !== 'ocean' && c.biome !== 'beach' && c.biome !== 'volcano' && !c.lake && c.settlement === null && c.cont > 0.08 && c.cx > 0 && c.cz > 0 && c.cx < MAP_W - 1 && c.cz < MAP_H - 1);
    const mine = sett.filter((s) => s.island === I.key);
    // The Kavorent's first: the loneliest places (desert, ice, deep forest,
    // the feet of mountains; ash and moor on the other islands).
    const lonely = land
      .filter((c) => LONELY.has(c.biome) && c.mountainness < 0.4)
      .map((c) => ({ c, d: Math.min(99, ...mine.map((s) => Math.hypot(s.cx - c.cx, (s.cz - c.cz) * 1.4))) + rng.float(0, 3) }))
      .sort((a, b) => b.d - a.d);
    let n = 0;
    for (const { c } of lonely) {
      if (n >= I.spires) break;
      if (!farFromTowns(c, 4) || !farFromSites(c, 10)) continue;
      sites.push({ id: sites.length, type: 'kavorent', cx: c.cx, cz: c.cz, island: I.key, seed: hash4(ow.seed, c.cx, c.cz, 0x4a7) });
      n++;
    }
    // Then the dungeons, near enough to people that they have a story.
    n = 0;
    for (const c of rng.shuffle(land.slice())) {
      if (n >= I.dungeons) break;
      if (!farFromTowns(c, 2.4) || !farFromSites(c, 3.4)) continue;
      if (c.mountainness > 0.5) continue;
      const type = kindFor(ow, c, rng);
      sites.push({ id: sites.length, type, cx: c.cx, cz: c.cz, island: I.key, seed: hash4(ow.seed, c.cx, c.cz, sites.length, 0x5d1) });
      n++;
    }
  }
  return sites;
}
const LONELY = new Set(['desert', 'tundra', 'jungle', 'mountain', 'taiga', 'savanna', 'swamp', 'ashland', 'geyser', 'moor', 'fungal', 'mangrove']);

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
    // Blighted ground round it (see blight, for further out), fallen
    // alloy, and the strange things that grow in it.
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) continue;
      put(dx, h, dz, rng.chance(0.25) ? B.gravel : B.grass_void);
      if (rng.chance(0.07)) put(dx, h + 1, dz, B.kav_debris);
      else if (rng.chance(0.12)) put(dx, h + 1, dz, GROWTHS[rng.int(0, GROWTHS.length - 1)], rng.int(0, 3));
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
    // A keystone in each face at the height of your hand, with a hollow in
    // it the shape of a cut stone.
    for (const [ox, oz] of [[0, 2], [-2, 0], [0, -2], [2, 0]]) put(ox, h + 1, oz, B.kav_keystone);
    // Opened (whichever face the stone was set in): a doorway two high in
    // every face, all the way round.
    const side = state.open;
    if (side !== undefined && side !== null) {
      for (const [ox, oz] of [[0, 2], [-2, 0], [0, -2], [2, 0]]) {
        put(ox, h + 1, oz, B.kav_door);
        put(ox, h + 2, oz, B.air);
      }
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
  // (The way in set into the face itself, flush with the rock round it.)
  put(0, h + 1, 0, B.cave_mouth);
  put(0, h + 2, 0, B.air);
  for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) > 1) put(dx, h + 1, 3, B.fence);
  put(2, h + 1, 2, B.campfire);
  for (let dz = 1; dz <= 4; dz++) put(0, h, dz, B.path);
  return out;
}

// What grows in a spire's blight.
const GROWTHS = [B.void_bloom, B.void_bloom, B.glow_crystal, B.tendril, B.eye_stalk];
const GRASSY = new Set([B.grass, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.dirt, B.mud, B.clay, B.sand]);
// (Snow the blight turns lavender, rather than to turf.)
const SNOWY = new Set([B.snow, B.snow_void]);
export const BLIGHT_R = 16;

// How far the blight reaches round a spire, that way (`ang`, radians):
// never a neat circle, but a ragged one, lobed and fingered, the same each
// time for the same spire.
export function blightReach(s, ang) {
  const ph = (k) => ((hash4(s.seed, k, 0xb10) % 1000) / 1000) * Math.PI * 2;
  return BLIGHT_R - 1 + 2.4 * Math.sin(3 * ang + ph(1)) + 1.5 * Math.sin(5 * ang + ph(2)) + 0.9 * Math.sin(9 * ang + ph(3)) + 1.2 * Math.max(0, Math.sin(7 * ang + ph(4))) ** 6 * 3;
}

// Is (x, z) in a spire's blight? Inside its reach for sure; just past it,
// thinning out tile by tile (a feathered edge, not a hard one).
export function blighted(s, x, z) {
  const d = Math.hypot(x - s.x, z - s.z);
  if (d < 7) return false;
  const R = blightReach(s, Math.atan2(z - s.z, x - s.x));
  if (d <= R - 1.5) return true;
  if (d >= R + 2) return false;
  const k = (R + 2 - d) / 3.5;
  return (hash4(x, z, s.seed, 0xb1) % 1000) / 1000 < k * k * (3 - 2 * k);
}

// The Kavorent's blight round a spire, out past the cleared ground: the
// turf and the trees gone violet, the flowers turned to strange growths,
// and more of them the nearer you come.
function blight(region, s) {
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const x = region.x0 + lx;
      const z = region.z0 + lz;
      const d = Math.hypot(x - s.x, z - s.z);
      if (d > BLIGHT_R + 10 || d < 7 || !blighted(s, x, z)) continue;
      const roll = (hash4(x, z, s.seed, 0xb2) % 1000) / 1000;
      for (let y = WORLD_Y - 1; y >= 1; y--) {
        const id = region.get(lx, y, lz);
        if (id === B.air) continue;
        const b = BLOCKS[id];
        if (b.name.startsWith('leaves_')) {
          region.set(lx, y, lz, B.leaves_void);
          continue;
        }
        if (b.render === 'plant') {
          region.set(lx, y, lz, roll < 0.45 ? GROWTHS[Math.floor(roll * 100) % GROWTHS.length] : B.air);
          continue;
        }
        if (!b.solid) continue;
        // (Snow on the ground: the blight's lavender through it.)
        if (SNOWY.has(id)) {
          region.set(lx, y, lz, B.snow_void);
          const near = 1 - d / BLIGHT_R;
          if (y + 1 < WORLD_Y && region.get(lx, y + 1, lz) === B.air && roll < 0.03 + near * 0.08) region.set(lx, y + 1, lz, GROWTHS[Math.floor(roll * 997) % GROWTHS.length], Math.floor(roll * 40) % 4);
          break;
        }
        if (!GRASSY.has(id)) break;
        region.set(lx, y, lz, B.grass_void);
        const near = 1 - d / BLIGHT_R;
        if (y + 1 < WORLD_Y && region.get(lx, y + 1, lz) === B.air && roll < 0.04 + near * 0.1) region.set(lx, y + 1, lz, GROWTHS[Math.floor(roll * 997) % GROWTHS.length], Math.floor(roll * 40) % 4);
        break;
      }
    }
  }
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
  // (The blight reaches further than any site's own ground.)
  for (const s of sites) {
    if (s.type !== 'kavorent' || s.x === undefined) continue;
    if (Math.abs(s.x - (x0 + REGION_W / 2)) > REGION_W / 2 + BLIGHT_R + 10 || Math.abs(s.z - (z0 + REGION_D / 2)) > REGION_D / 2 + BLIGHT_R + 10) continue;
    blight(region, s);
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
