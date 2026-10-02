// Tile-level generation of one region: terrain columns, ores, vegetation and
// any settlement structures that overlap the region.
import { REGION_W, REGION_D, WORLD_Y } from '../config.js';
import { hash4, hashf, mulberry32 } from '../util/rng.js';
import { B, BLOCKS } from './blocks.js';
import { BIOMES } from './biomes.js';
import { TREE_BUILDERS, TREE_MARGIN } from './trees.js';
import { Region } from './region.js';
import { stampSites } from './sites.js';

const GREEN = new Set([B.grass, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.mud, B.dirt]);
const SANDY = new Set([B.sand, B.sandstone, B.gravel]);

function pickWeighted(list, r) {
  let total = 0;
  for (const it of list) total += it[1];
  let v = r * total;
  for (const it of list) {
    if ((v -= it[1]) <= 0) return it[0];
  }
  return list[list.length - 1][0];
}

export function generateRegion(world, rx, rz) {
  const { terrain, seed } = world;
  const region = new Region(rx, rz);
  const x0 = rx * REGION_W;
  const z0 = rz * REGION_D;
  const M = TREE_MARGIN;
  const EW = REGION_W + 2 * M;
  const ED = REGION_D + 2 * M;
  const ctx = terrain.context(x0 - M, z0 - M, x0 + REGION_W - 1 + M, z0 + REGION_D - 1 + M);
  const cols = new Array(EW * ED);
  for (let ez = 0; ez < ED; ez++) {
    for (let ex = 0; ex < EW; ex++) cols[ez * EW + ex] = terrain.column(x0 - M + ex, z0 - M + ez, ctx, {});
  }
  const colAt = (lx, lz) => cols[(lz + M) * EW + lx + M];

  // 1. Terrain fill + ores.
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const c = colAt(lx, lz);
      const x = x0 + lx;
      const z = z0 + lz;
      const h = c.h;
      region.set(lx, 0, lz, B.bedrock);
      for (let y = 1; y <= h; y++) {
        let id;
        if (y === h) id = c.surf;
        else if (y >= h - 2 && c.sub !== B.stone) id = c.surf === B.sand || c.surf === B.sandstone ? (y === h - 1 ? B.sand : B.sandstone) : c.sub;
        else id = B.stone;
        if (id === B.stone) id = oreAt(x, y, z, seed);
        region.set(lx, y, lz, id);
      }
      if (c.water >= 0) for (let y = h + 1; y <= c.water; y++) region.set(lx, y, lz, B.water);
    }
  }

  // 2. Settlement layouts overlapping this region.
  const layouts = ctx.setts.map((s) => world.getLayout(s));
  const layoutMask = (x, z) => {
    for (const L of layouts) {
      const v = L.maskAt(x, z);
      if (v !== 0) return v;
    }
    return 0;
  };

  // 3. Trees (candidates in the margin may overhang into this region).
  const inRegion = (x, y, z) => x >= x0 && x < x0 + REGION_W && z >= z0 && z < z0 + REGION_D && y >= 0 && y < WORLD_Y;
  for (let ez = 0; ez < ED; ez++) {
    for (let ex = 0; ex < EW; ex++) {
      const c = cols[ez * EW + ex];
      const bd = BIOMES[c.biome];
      if (!bd.trees.length || c.water >= 0 || c.flat > 0.02) continue;
      const x = c.x;
      const z = c.z;
      const S = bd.treeSpacing;
      const gx = Math.floor(x / S);
      const gz = Math.floor(z / S);
      const hh = hash4(gx, gz, seed, S * 7 + 3);
      if (gx * S + (hh % S) !== x || gz * S + ((hh >>> 8) % S) !== z) continue;
      let type = pickWeighted(bd.trees, hashf(x, z, seed, 91));
      const nearWater = c.wet < 4;
      if (nearWater && (c.biome === 'desert' || c.biome === 'beach' || c.biome === 'savanna')) type = 'palm';
      let chance = bd.treeChance * terrain.clump(x, z, bd.clump);
      if (type === 'palm' && c.biome === 'desert') chance = nearWater ? 0.8 : 0;
      if (hashf(x, z, seed, 5) >= chance) continue;
      if (c.surf === B.ice || c.surf === B.stone && c.biome !== 'mountain') continue;
      if (type !== 'cactus' && type !== 'palm' && type !== 'dead' && SANDY.has(c.surf) && c.surf !== B.gravel) continue;
      const rand = mulberry32(hash4(x, z, seed, 77));
      const cells = TREE_BUILDERS[type](rand);
      const baseY = c.h + 1;
      for (const [dx, dy, dz, id] of cells) {
        const wx = x + dx;
        const wy = baseY + dy;
        const wz = z + dz;
        if (!inRegion(wx, wy, wz)) continue;
        const lx = wx - x0;
        const lz = wz - z0;
        const cur = region.get(lx, wy, lz);
        const cd = BLOCKS[cur];
        const isTrunk = BLOCKS[id].opaque;
        if (cur === B.air || (cd.replaceable && !cd.liquid) || (isTrunk && cd.name.startsWith('leaves'))) {
          region.set(lx, wy, lz, id);
        }
      }
    }
  }

  // 4. Plants, rocks, lily pads.
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const c = colAt(lx, lz);
      const x = x0 + lx;
      const z = z0 + lz;
      const bd = BIOMES[c.biome];
      const r = hashf(x, z, seed, 13);
      if (c.water >= 0) {
        if (!c.deep && c.water + 1 < WORLD_Y && (c.biome === 'swamp' || c.biome === 'forest' || c.biome === 'jungle') && r < 0.07) {
          region.set(lx, c.water + 1, lz, B.lily_pad);
        }
        continue;
      }
      const y = c.h + 1;
      if (y >= WORLD_Y || region.get(lx, y, lz) !== B.air) continue;
      let density = bd.plantDensity;
      if (c.flat > 0) {
        if (layoutMask(x, z) !== 0) continue;
        density *= c.sett ? 0.25 : 1 - c.flat * 0.6;
      }
      const r2 = hashf(x, z, seed, 14);
      if (c.wet < 2.2 && !['tundra', 'mountain', 'taiga'].includes(c.biome) && r < 0.3) {
        region.set(lx, y, lz, B.reeds);
        continue;
      }
      if (bd.rocks && r2 < bd.rocks * (c.flat > 0 ? 0.2 : 1)) {
        region.set(lx, y, lz, B.rock);
        continue;
      }
      if (r >= density || !bd.plants.length) continue;
      const surfOk = GREEN.has(c.surf) || (SANDY.has(c.surf) && (c.biome === 'desert' || c.biome === 'beach')) || c.surf === B.snow;
      if (!surfOk) continue;
      let plant = pickWeighted(bd.plants, r2);
      if (c.surf === B.snow && plant !== B.dead_bush && plant !== B.fern) continue;
      region.set(lx, y, lz, plant);
    }
  }

  // 5. Settlement structures.
  const key = world.regionKey(rx, rz);
  for (const L of layouts) {
    const p = L.placements.get(key);
    if (!p) continue;
    for (let i = 0; i < p.length; i += 5) {
      const lx = p[i] - x0;
      const lz = p[i + 2] - z0;
      region.set(lx, p[i + 1], lz, p[i + 3], p[i + 4]);
    }
  }

  // 6. The old places' ways in (dungeons, the Kavorent's spires).
  stampSites(world, region);

  region.recomputeTops();
  return region;
}

export function oreAt(x, y, z, seed) {
  const cluster = hashf(x >> 1, y >> 1, z >> 1, seed ^ 0x51a7);
  if (cluster < 0.86) return B.stone;
  const v = hashf(x, y, z, seed ^ 0x0e3);
  if (v > 0.55) return B.stone;
  if (y <= 2 && cluster > 0.988) return B.gem_ore;
  if (y <= 3 && cluster > 0.968) return B.gold_ore;
  if ((y <= 4 || y >= 9) && cluster > 0.93) return B.iron_ore;
  return B.coal_ore;
}
