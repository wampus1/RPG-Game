// Tile-level generation of one region: terrain columns, ores, vegetation and
// any settlement structures that overlap the region.
import { REGION_W, REGION_D, WORLD_Y } from '../config.js';
import { hash4, hashf, mulberry32 } from '../util/rng.js';
import { B, BLOCKS, META_STATE } from './blocks.js';
import { BIOMES } from './biomes.js';
import { TREE_BUILDERS, TREE_MARGIN } from './trees.js';
import { Region } from './region.js';
import { stampSites } from './sites.js';
import { BRIDGE_KINDS, bridgeMats, DECK_Y } from './bridges.js';
import { landmarkCells, cacheSpot } from './landmarks.js';
import { featuresIn, featureOps } from './features.js';

const GREEN = new Set([B.grass, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.mud, B.dirt]);
const SANDY = new Set([B.sand, B.sandstone, B.gravel]);
// (The other islands' ground, that things grow in too.)
const ISLE_GROUND = new Set([B.ash, B.cinder, B.scorched, B.moss, B.peat, B.mycelium, B.basalt, B.sulfur_crust]);

// (A spring's landmark sits on its water.)
const WATER_Y_OF = (c) => (c.water >= 0 ? c.water : c.h);

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
        // (Round 79) A mesa's (or a canyon's) banded rock, in the hot lands.
        else if (c.band && y >= 2) id = (y >> 1) & 1 ? B.clay : B.sandstone;
        else if (y >= h - 2 && c.sub !== B.stone) id = c.surf === B.sand || c.surf === B.sandstone ? (y === h - 1 ? B.sand : B.sandstone) : c.sub;
        else id = B.stone;
        if (id === B.stone) id = oreAt(x, y, z, seed);
        region.set(lx, y, lz, id);
      }
      // (Round 65: a biome's ponds frozen over, or a bog: see terrain.js.)
      if (c.water >= 0) for (let y = h + 1; y <= c.water; y++) region.set(lx, y, lz, c.lava ? B.lava : c.liquid === B.ice ? (y === c.water ? B.ice : B.water) : c.liquid || B.water);
      // (Round 68) A bridge across a strait over it.
      if (c.bridge) stampBridge(region, lx, lz, c);
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
      // (Mangroves stand in the shallows; nothing else does.)
      if (!bd.trees.length || (c.water >= 0 && !(bd.wetTrees && !c.deep && !c.lava)) || c.flat > 0.02 || c.bridge) continue;
      // (Round 79: none through a landmark, up a cone, on a pillar.)
      if (c.landmark || c.form === 'cone' || c.form === 'pillar' || c.form === 'sinkhole') continue;
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
        if (cur === B.air || (cd.replaceable && !cd.liquid) || (isTrunk && cd.name.startsWith('leaves')) || (isTrunk && cur === B.water && bd.wetTrees)) {
          region.set(lx, wy, lz, id);
        }
      }
    }
  }

  // (Round 79) Landmarks, their caches, and the small things out in the
  // country (see landmarks.js and features.js), in worlds made since.
  if (terrain.forms) {
    // (Any tile's column: this region's own, else worked out on its own.)
    const extra = new Map();
    const col = (x, z) => {
      const lx = x - x0;
      const lz = z - z0;
      if (lx >= -M && lz >= -M && lx < REGION_W + M && lz < REGION_D + M) return colAt(lx, lz);
      const k = x * 100003 + z;
      if (!extra.has(k)) extra.set(k, terrain.column(x, z, terrain.context(x - 1, z - 1, x + 1, z + 1), {}));
      return extra.get(k);
    };
    const putIn = (wx, wy, wz, id, force = false) => {
      if (!inRegion(wx, wy, wz)) return;
      const lx = wx - x0;
      const lz = wz - z0;
      const cur = region.get(lx, wy, lz);
      const cd = BLOCKS[cur];
      if (force || cur === B.air || (cd && cd.replaceable && !cd.liquid) || (cd && cd.name.startsWith('leaves'))) region.set(lx, wy, lz, id);
    };
    for (const lm of ctx.landmarks || []) {
      const centre = col(lm.x, lm.z);
      const lying = lm.kind === 'tree' || lm.kind === 'bones';
      for (const [dx, dy, dz, id] of landmarkCells(lm)) {
        const wx = lm.x + dx;
        const wz = lm.z + dz;
        const base = lying ? col(wx, wz) : centre;
        if (!base || (base.water >= 0 && lm.kind !== 'spring')) continue;
        putIn(wx, (lm.kind === 'spring' ? WATER_Y_OF(base) : base.h) + 1 + dy - (lm.kind === 'crater' ? 1 : 0), wz, id, lm.kind === 'crater');
      }
      // (Its secret: a chest under the ground by its foot.)
      const g = lm.secret ? col(lm.x + lm.secret.dx * 2, lm.z + lm.secret.dz * 2) : null;
      const cs = g && g.water < 0 ? cacheSpot(lm, g.h - 1) : null;
      if (cs && inRegion(cs.x, cs.y, cs.z)) region.set(cs.x - x0, cs.y, cs.z - z0, B.chest);
    }
    for (const f of featuresIn(world.ow, x0, z0, x0 + REGION_W - 1, z0 + REGION_D - 1)) {
      const ops = featureOps(f, col);
      if (!ops) continue;
      for (const o of ops) {
        if (!inRegion(o.x, o.y, o.z)) continue;
        if (o.surface || o.id === B.air || o.id === B.gravel) region.set(o.x - x0, o.y, o.z - z0, o.id);
        else putIn(o.x, o.y, o.z, o.id);
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
      if (c.bridge) continue;
      if (c.water >= 0) {
        if (!c.deep && !c.lava && !c.liquid && c.water + 1 < WORLD_Y && bd.lilies && r < 0.07) {
          region.set(lx, c.water + 1, lz, B.lily_pad);
        }
        continue;
      }
      const y = c.h + 1;
      if (y >= WORLD_Y || region.get(lx, y, lz) !== B.air) continue;
      // (Round 79) A boulder fallen from a cliff, or left by the ice.
      if (c.boulder) {
        region.set(lx, y, lz, r < 0.5 ? B.cobblestone : B.stone);
        if (r < 0.3 && y + 1 < WORLD_Y) region.set(lx, y + 1, lz, B.stone);
        continue;
      }
      let density = bd.plantDensity;
      if (c.flat > 0) {
        if (layoutMask(x, z) !== 0) continue;
        density *= c.sett ? 0.25 : 1 - c.flat * 0.6;
      }
      const r2 = hashf(x, z, seed, 14);
      if (c.wet < 2.2 && bd.reeds !== false && r < 0.3) {
        region.set(lx, y, lz, B.reeds);
        continue;
      }
      if (bd.rocks && r2 < bd.rocks * (c.flat > 0 ? 0.2 : 1)) {
        region.set(lx, y, lz, B.rock);
        continue;
      }
      if (r >= density || !bd.plants.length) continue;
      // (A mod's biome: its plants grow on its own ground too.)
      const surfOk = GREEN.has(c.surf) || ISLE_GROUND.has(c.surf) || (SANDY.has(c.surf) && (c.biome === 'desert' || c.biome === 'beach')) || c.surf === B.snow || (bd.grows && bd.grows.has(c.surf));
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

// (Round 68) One column of a bridge (see bridges.js): over the water its
// deck a layer above the sea, the rail or parapet along its edges, piers
// down to the bed and lamps every so far (towers on a causeway); on land,
// its ends run up to meet it.
function stampBridge(region, lx, lz, c) {
  const { b, along, side } = c.bridge;
  const K = BRIDGE_KINDS[b.kind];
  const M = bridgeMats(b.land, b.kind);
  const D = DECK_Y;
  // (Its edge: where a step to the side, any of the four ways, would be off
  // it; on a slant that's a staircase of cells, and the corners of it
  // filled (rim: see bridges.onBridge), so the parapet along it is one
  // wall.)
  const edge = c.bridge.rim || Math.abs(side) === b.hw || (c.bridge.sideF !== undefined && Math.abs(c.bridge.sideF) + c.bridge.slant > b.hw + 0.5);
  const a = Math.round(along);
  const deck = b.kind === 'causeway' && side === 0 && M.mid !== undefined ? M.mid : M.deck;
  if (c.water < 0) {
    // (Its ends: the ground made up to the deck, and paved.)
    if (c.h < D) {
      for (let y = c.h + 1; y < D; y++) region.set(lx, y, lz, B.dirt);
      region.set(lx, D, lz, deck);
      for (let y = D + 1; y < D + 3; y++) if (BLOCKS[region.get(lx, y, lz)].replaceable) region.set(lx, y, lz, B.air);
    } else if (c.h === D) region.set(lx, D, lz, deck);
    return;
  }
  for (let y = c.water + 1; y <= D + 2; y++) region.set(lx, y, lz, B.air);
  region.set(lx, D, lz, deck);
  if (!edge) return;
  const tower = K.towers && a % K.towers <= 1 && a > 4 && a < c.bridge.len - 4;
  const pier = tower || (K.piers ? a % K.piers === 0 : a % 4 === 0);
  if (pier) for (let y = Math.max(1, c.h + 1); y < D; y++) region.set(lx, y, lz, M.pier);
  if (tower) {
    for (let y = D + 1; y <= D + 3; y++) region.set(lx, y, lz, M.pier);
    if (a % K.towers === 0) region.set(lx, D + 4, lz, M.lamp, META_STATE);
    return;
  }
  region.set(lx, D + 1, lz, M.rail);
  // (Lit, as they're meant to be: round 70.)
  if (K.lamps && a % K.lamps === Math.floor(K.lamps / 2)) region.set(lx, D + 2, lz, M.lamp, META_STATE);
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
