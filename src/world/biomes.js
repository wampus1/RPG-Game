// Biome definitions: base tiles, patches, vegetation and world map glyphs.
import { B } from './blocks.js';

// patches: [block, noiseScale, threshold] applied in order on the surface layer.
// trees: [treeType, weight]; treeSpacing: jittered-grid cell size;
// treeChance: chance a grid cell holds a tree (boosted by forest clumping noise).
export const BIOMES = {
  ocean: {
    name: 'Ocean', char: '≈', fg: '#5fa8e8', bg: '#123a6a',
    surface: B.sand, sub: B.sand, hills: 0,
    trees: [], treeSpacing: 8, treeChance: 0, plants: [], plantDensity: 0,
  },
  beach: {
    name: 'Beach', char: '·', fg: '#f3dd9a', bg: '#8a7440',
    surface: B.sand, sub: B.sand, hills: 0,
    patches: [[B.gravel, 7, 0.78]],
    trees: [['palm', 1]], treeSpacing: 9, treeChance: 0.12,
    plants: [[B.dead_bush, 1], [B.tall_grass, 2]], plantDensity: 0.02,
    rocks: 0.004,
  },
  plains: {
    name: 'Plains', char: '"', fg: '#a8e05a', bg: '#3c6e28',
    surface: B.grass, sub: B.dirt, hills: 1,
    patches: [[B.grass_lush, 13, 0.55], [B.dirt, 6, 0.8]],
    trees: [['oak', 5], ['birch', 1]], treeSpacing: 7, treeChance: 0.1, clump: 0.35,
    plants: [
      [B.tall_grass, 14], [B.flower_red, 2], [B.flower_yellow, 3], [B.flower_white, 2],
      [B.flower_blue, 1], [B.bush, 2], [B.berry_bush, 0.6], [B.herb, 0.3],
    ],
    plantDensity: 0.2, rocks: 0.003, ponds: true,
  },
  forest: {
    name: 'Forest', char: '♣', fg: '#5ccf4e', bg: '#1e4a22',
    surface: B.grass_lush, sub: B.dirt, hills: 2,
    patches: [[B.grass, 11, 0.5], [B.dirt, 5, 0.82]],
    trees: [['oak', 5], ['birch', 3], ['stump', 0.3]], treeSpacing: 4, treeChance: 0.62, clump: 0.25,
    plants: [
      [B.fern, 8], [B.tall_grass, 6], [B.bush, 4], [B.berry_bush, 1.5], [B.mushroom_red, 0.8],
      [B.mushroom_brown, 1.2], [B.flower_white, 0.8], [B.flower_purple, 0.5], [B.herb, 0.6],
    ],
    plantDensity: 0.26, rocks: 0.004, ponds: true,
  },
  taiga: {
    name: 'Taiga', char: '♠', fg: '#6fc2a0', bg: '#173c3a',
    surface: B.grass_taiga, sub: B.dirt, hills: 2,
    patches: [[B.snow, 12, 0.45], [B.gravel, 6, 0.83]],
    trees: [['pine', 6], ['snowpine', 3]], treeSpacing: 4, treeChance: 0.55, clump: 0.3,
    plants: [[B.fern, 6], [B.bush, 2], [B.berry_bush, 1], [B.mushroom_brown, 1], [B.tall_grass, 2]],
    plantDensity: 0.14, rocks: 0.008, ponds: true,
  },
  tundra: {
    name: 'Tundra', char: '*', fg: '#e8f4ff', bg: '#6a7c8e',
    surface: B.snow, sub: B.dirt, hills: 1,
    patches: [[B.ice, 9, 0.72], [B.gravel, 5, 0.8], [B.grass_taiga, 14, 0.62]],
    trees: [['snowpine', 3], ['dead', 1]], treeSpacing: 9, treeChance: 0.1, clump: 0.5,
    plants: [[B.dead_bush, 2], [B.fern, 1]], plantDensity: 0.03, rocks: 0.01,
  },
  desert: {
    name: 'Desert', char: '~', fg: '#f6d56a', bg: '#9a7a2a',
    surface: B.sand, sub: B.sand, hills: 1,
    patches: [[B.sandstone, 8, 0.74], [B.gravel, 5, 0.86]],
    trees: [['cactus', 4], ['dead', 1]], treeSpacing: 7, treeChance: 0.14, clump: 0,
    plants: [[B.dead_bush, 5], [B.tall_grass, 0.5]], plantDensity: 0.03, rocks: 0.006,
  },
  savanna: {
    name: 'Savanna', char: ',', fg: '#e0c85a', bg: '#6c6424',
    surface: B.grass_dry, sub: B.dirt, hills: 1,
    patches: [[B.dirt, 8, 0.66], [B.grass, 15, 0.72]],
    trees: [['acacia', 1]], treeSpacing: 10, treeChance: 0.25, clump: 0.2,
    plants: [[B.tall_grass, 12], [B.dead_bush, 2], [B.flower_yellow, 1], [B.bush, 1]],
    plantDensity: 0.22, rocks: 0.004,
  },
  jungle: {
    name: 'Jungle', char: '¥', fg: '#3ef06a', bg: '#0c4418',
    surface: B.grass_jungle, sub: B.dirt, hills: 2,
    patches: [[B.mud, 9, 0.7], [B.grass_lush, 12, 0.5]],
    trees: [['jungle', 5], ['palm', 1], ['bushtree', 2]], treeSpacing: 4, treeChance: 0.66, clump: 0.2,
    plants: [
      [B.fern, 10], [B.bush, 6], [B.flower_red, 1.5], [B.flower_purple, 1.5], [B.tall_grass, 4],
      [B.berry_bush, 1], [B.herb, 1],
    ],
    plantDensity: 0.4, rocks: 0.002, ponds: true,
  },
  swamp: {
    name: 'Swamp', char: '%', fg: '#9ab85a', bg: '#2e3a1e',
    surface: B.mud, sub: B.dirt, hills: 0,
    patches: [[B.grass_lush, 10, 0.5], [B.clay, 6, 0.85]],
    trees: [['willow', 4], ['dead', 1]], treeSpacing: 6, treeChance: 0.35, clump: 0.3,
    plants: [[B.reeds, 6], [B.tall_grass, 6], [B.mushroom_brown, 2], [B.fern, 3], [B.herb, 1]],
    plantDensity: 0.3, rocks: 0.001, pools: true,
  },
  mountain: {
    name: 'Mountains', char: '▲', fg: '#c8c8d0', bg: '#4a4a58',
    surface: B.stone, sub: B.stone, hills: 1,
    patches: [[B.gravel, 7, 0.62], [B.grass_taiga, 15, 0.64]],
    trees: [['pine', 3], ['dead', 1]], treeSpacing: 8, treeChance: 0.1, clump: 0.3,
    plants: [[B.fern, 1], [B.dead_bush, 1]], plantDensity: 0.03, rocks: 0.02,
  },
};

export const BIOME_KEYS = Object.keys(BIOMES);

// Cultural building style families, keyed by the biome a civ's capital sits in.
export const BIOME_STYLE = {
  plains: 'vale', forest: 'vale', beach: 'vale', ocean: 'vale',
  taiga: 'north', tundra: 'north',
  desert: 'sun', savanna: 'sun',
  jungle: 'wild', swamp: 'wild',
  mountain: 'high',
};
