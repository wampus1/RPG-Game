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
  // --- Kharos, the fire island ---------------------------------------------
  // Grey ash plains over black basalt, burned snags and the red fire lilies
  // that grow nowhere else.
  ashland: {
    name: 'Ashlands', char: '░', fg: '#a8a0a0', bg: '#3a3434', isle: 'kharos',
    surface: B.ash, sub: B.basalt, hills: 1,
    patches: [[B.basalt, 7, 0.74], [B.cinder, 10, 0.64], [B.scorched, 13, 0.72]],
    trees: [['charred', 3], ['cinder', 1]], treeSpacing: 8, treeChance: 0.12, clump: 0.4,
    plants: [[B.dead_bush, 4], [B.fire_lily, 1.2], [B.tall_grass, 0.6]], plantDensity: 0.05, rocks: 0.01,
  },
  // Woods of cinder trees: black bark, leaves like embers.
  cinderwood: {
    name: 'Cinderwood', char: '♣', fg: '#ff7a3a', bg: '#3a1a14', isle: 'kharos',
    surface: B.scorched, sub: B.dirt, hills: 2,
    patches: [[B.ash, 11, 0.58], [B.cinder, 6, 0.8]],
    trees: [['cinder', 6], ['charred', 1]], treeSpacing: 5, treeChance: 0.5, clump: 0.3,
    plants: [[B.fire_lily, 2], [B.fern, 2], [B.dead_bush, 2], [B.bush, 1]], plantDensity: 0.12, rocks: 0.004,
  },
  // Sulphur flats: yellow crust, steam vents, and hot springs that steam
  // in the cold of the morning.
  geyser: {
    name: 'Geyser Flats', char: '♨', fg: '#f0e060', bg: '#5a5020', isle: 'kharos',
    surface: B.ash, sub: B.basalt, hills: 0,
    patches: [[B.sulfur_crust, 8, 0.6], [B.basalt, 6, 0.76], [B.gravel, 5, 0.84]],
    trees: [['charred', 1]], treeSpacing: 10, treeChance: 0.05, clump: 0,
    plants: [[B.steam_vent, 2], [B.dead_bush, 2], [B.fire_lily, 0.5]], plantDensity: 0.04, rocks: 0.006, pools: true, hot: true,
  },
  // The mountain itself: basalt and black glass up to the crater's lip.
  volcano: {
    name: 'Volcano', char: '▲', fg: '#ff6a2a', bg: '#2e1612', isle: 'kharos',
    surface: B.basalt, sub: B.basalt, hills: 1,
    patches: [[B.obsidian, 9, 0.72], [B.ash, 12, 0.56], [B.cinder, 7, 0.7]],
    trees: [['charred', 1]], treeSpacing: 12, treeChance: 0.04, clump: 0,
    plants: [[B.steam_vent, 1], [B.fire_lily, 0.4]], plantDensity: 0.02, rocks: 0.016,
  },
  // --- Myrrow, the misty island --------------------------------------------
  // Mangroves standing in the warm shallows on their arching roots.
  mangrove: {
    name: 'Mangroves', char: 'Ψ', fg: '#6ac08a', bg: '#1a3a2a', isle: 'myrrow',
    surface: B.mud, sub: B.dirt, hills: 0,
    patches: [[B.moss, 9, 0.62], [B.clay, 6, 0.86]],
    trees: [['mangrove', 1]], treeSpacing: 4, treeChance: 0.55, clump: 0.2, wetTrees: true,
    plants: [[B.reeds, 6], [B.fern, 3], [B.tall_grass, 3], [B.mushroom_brown, 0.6]], plantDensity: 0.22, rocks: 0.001, pools: true,
  },
  // The fungal forests: white mycelium, mushrooms taller than houses (the
  // blue ones glow at night).
  fungal: {
    name: 'Fungal Forest', char: '♤', fg: '#e08ad0', bg: '#2a1a34', isle: 'myrrow',
    surface: B.mycelium, sub: B.dirt, hills: 1,
    patches: [[B.moss, 10, 0.6], [B.mud, 7, 0.82]],
    trees: [['mushroom', 4], ['glowshroom', 2], ['toadstool', 3]], treeSpacing: 5, treeChance: 0.5, clump: 0.3,
    plants: [[B.mushroom_brown, 4], [B.mushroom_red, 3], [B.glowshroom, 1], [B.fern, 2]], plantDensity: 0.2, rocks: 0.002, ponds: true,
  },
  // Open moor: moss and peat, purple heather, the odd standing stone, mist.
  moor: {
    name: 'Moor', char: '∴', fg: '#b88ad0', bg: '#3a3044', isle: 'myrrow',
    surface: B.moss, sub: B.dirt, hills: 2,
    patches: [[B.peat, 9, 0.64], [B.grass_taiga, 14, 0.6], [B.gravel, 6, 0.86]],
    trees: [['dead', 1], ['birch', 1]], treeSpacing: 9, treeChance: 0.06, clump: 0.5,
    plants: [[B.heather, 9], [B.tall_grass, 4], [B.fern, 1], [B.berry_bush, 0.4]], plantDensity: 0.24, rocks: 0.012, ponds: true,
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
  ashland: 'ember', cinderwood: 'ember', geyser: 'ember', volcano: 'ember',
  mangrove: 'tide', fungal: 'mist', moor: 'mist',
};
