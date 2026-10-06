// Biome definitions: base tiles, patches, vegetation and world map glyphs.
import { B } from './blocks.js';

// patches: [block, noiseScale, threshold] applied in order on the surface layer.
// trees: [treeType, weight]; treeSpacing: jittered-grid cell size;
// treeChance: chance a grid cell holds a tree (boosted by forest clumping noise).
// (Round 63) What the land's like, said by each (so a mod's biome, or a
// change to one of these, can say it too): climate ('mild', 'warm',
// 'cold': snow on the heights sooner; 'hot': never snow), bank (the block
// along rivers and lakes; none: its own ground), bed ('mud': a muddy
// bottom under its water), reeds (false: none by the water), lilies (lily
// pads on its pools), rain (how often it rains: 1 as most; less, drier),
// snowy (it snows rather than rains).
export const BIOMES = {
  ocean: {
    name: 'Ocean', char: '≈', fg: '#5fa8e8', bg: '#123a6a',
    climate: 'mild',
    surface: B.sand, sub: B.sand, hills: 0,
    trees: [], treeSpacing: 8, treeChance: 0, plants: [], plantDensity: 0,
  },
  beach: {
    name: 'Beach', char: '·', fg: '#f3dd9a', bg: '#8a7440',
    climate: 'warm', bank: B.sand, rain: 0.75,
    surface: B.sand, sub: B.sand, hills: 0,
    patches: [[B.gravel, 7, 0.78]],
    trees: [['palm', 1]], treeSpacing: 9, treeChance: 0.12,
    plants: [[B.dead_bush, 1], [B.tall_grass, 2]], plantDensity: 0.02,
    rocks: 0.004,
  },
  plains: {
    name: 'Plains', char: '"', fg: '#a8e05a', bg: '#3c6e28',
    climate: 'warm', bank: B.sand,
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
    climate: 'mild', lilies: true,
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
    climate: 'cold', bank: B.gravel, reeds: false, snowy: true,
    surface: B.grass_taiga, sub: B.dirt, hills: 2,
    patches: [[B.snow, 12, 0.45], [B.gravel, 6, 0.83]],
    trees: [['pine', 6], ['snowpine', 3]], treeSpacing: 4, treeChance: 0.55, clump: 0.3,
    plants: [[B.fern, 6], [B.bush, 2], [B.berry_bush, 1], [B.mushroom_brown, 1], [B.tall_grass, 2]],
    plantDensity: 0.14, rocks: 0.008, ponds: true,
  },
  tundra: {
    name: 'Tundra', char: '*', fg: '#e8f4ff', bg: '#6a7c8e',
    climate: 'cold', bank: B.gravel, reeds: false, snowy: true,
    surface: B.snow, sub: B.dirt, hills: 1,
    patches: [[B.ice, 9, 0.72], [B.gravel, 5, 0.8], [B.grass_taiga, 14, 0.62]],
    trees: [['snowpine', 3], ['dead', 1]], treeSpacing: 9, treeChance: 0.1, clump: 0.5,
    plants: [[B.dead_bush, 2], [B.fern, 1]], plantDensity: 0.03, rocks: 0.01,
  },
  desert: {
    name: 'Desert', char: '~', fg: '#f6d56a', bg: '#9a7a2a',
    climate: 'warm', bank: B.sand, rain: 0.08,
    surface: B.sand, sub: B.sand, hills: 1,
    patches: [[B.sandstone, 8, 0.74], [B.gravel, 5, 0.86]],
    trees: [['cactus', 4], ['dead', 1]], treeSpacing: 7, treeChance: 0.14, clump: 0,
    plants: [[B.dead_bush, 5], [B.tall_grass, 0.5]], plantDensity: 0.03, rocks: 0.006,
  },
  savanna: {
    name: 'Savanna', char: ',', fg: '#e0c85a', bg: '#6c6424',
    climate: 'warm', bank: B.sand, rain: 0.3,
    surface: B.grass_dry, sub: B.dirt, hills: 1,
    patches: [[B.dirt, 8, 0.66], [B.grass, 15, 0.72]],
    trees: [['acacia', 1]], treeSpacing: 10, treeChance: 0.25, clump: 0.2,
    plants: [[B.tall_grass, 12], [B.dead_bush, 2], [B.flower_yellow, 1], [B.bush, 1]],
    plantDensity: 0.22, rocks: 0.004,
  },
  jungle: {
    name: 'Jungle', char: '¥', fg: '#3ef06a', bg: '#0c4418',
    climate: 'warm', bank: B.sand, rain: 1.2, lilies: true,
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
    climate: 'mild', bank: B.mud, bed: 'mud', rain: 1.2, lilies: true,
    surface: B.mud, sub: B.dirt, hills: 0,
    patches: [[B.grass_lush, 10, 0.5], [B.clay, 6, 0.85]],
    trees: [['willow', 4], ['dead', 1]], treeSpacing: 6, treeChance: 0.35, clump: 0.3,
    plants: [[B.reeds, 6], [B.tall_grass, 6], [B.mushroom_brown, 2], [B.fern, 3], [B.herb, 1]],
    plantDensity: 0.3, rocks: 0.001, pools: true,
  },
  mountain: {
    name: 'Mountains', char: '▲', fg: '#c8c8d0', bg: '#4a4a58',
    climate: 'cold', bank: B.gravel, reeds: false, snowy: true,
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
    climate: 'hot', bank: B.cinder, reeds: false,
    surface: B.ash, sub: B.basalt, hills: 1,
    patches: [[B.basalt, 7, 0.74], [B.cinder, 10, 0.64], [B.scorched, 13, 0.72]],
    trees: [['charred', 3], ['cinder', 1]], treeSpacing: 8, treeChance: 0.12, clump: 0.4,
    plants: [[B.dead_bush, 4], [B.fire_lily, 1.2], [B.tall_grass, 0.6]], plantDensity: 0.05, rocks: 0.01,
  },
  // Woods of cinder trees: black bark, leaves like embers.
  cinderwood: {
    name: 'Cinderwood', char: '♣', fg: '#ff7a3a', bg: '#3a1a14', isle: 'kharos',
    climate: 'hot', bank: B.cinder, reeds: false,
    surface: B.scorched, sub: B.dirt, hills: 2,
    patches: [[B.ash, 11, 0.58], [B.cinder, 6, 0.8]],
    trees: [['cinder', 6], ['charred', 1]], treeSpacing: 5, treeChance: 0.5, clump: 0.3,
    plants: [[B.fire_lily, 2], [B.fern, 2], [B.dead_bush, 2], [B.bush, 1]], plantDensity: 0.12, rocks: 0.004,
  },
  // Sulphur flats: yellow crust, steam vents, and hot springs that steam
  // in the cold of the morning.
  geyser: {
    name: 'Geyser Flats', char: '♨', fg: '#f0e060', bg: '#5a5020', isle: 'kharos',
    climate: 'hot', bank: B.cinder, reeds: false,
    surface: B.ash, sub: B.basalt, hills: 0,
    patches: [[B.sulfur_crust, 8, 0.6], [B.basalt, 6, 0.76], [B.gravel, 5, 0.84]],
    trees: [['charred', 1]], treeSpacing: 10, treeChance: 0.05, clump: 0,
    plants: [[B.steam_vent, 2], [B.dead_bush, 2], [B.fire_lily, 0.5]], plantDensity: 0.04, rocks: 0.006, pools: true, hot: true,
  },
  // The mountain itself: basalt and black glass up to the crater's lip.
  volcano: {
    name: 'Volcano', char: '▲', fg: '#ff6a2a', bg: '#2e1612', isle: 'kharos',
    climate: 'hot', bank: B.cinder, reeds: false,
    surface: B.basalt, sub: B.basalt, hills: 1,
    patches: [[B.obsidian, 9, 0.72], [B.ash, 12, 0.56], [B.cinder, 7, 0.7]],
    trees: [['charred', 1]], treeSpacing: 12, treeChance: 0.04, clump: 0,
    plants: [[B.steam_vent, 1], [B.fire_lily, 0.4]], plantDensity: 0.02, rocks: 0.016,
  },
  // --- Myrrow, the misty island --------------------------------------------
  // Mangroves standing in the warm shallows on their arching roots.
  mangrove: {
    name: 'Mangroves', char: 'Ψ', fg: '#6ac08a', bg: '#1a3a2a', isle: 'myrrow',
    climate: 'mild', bank: B.mud, bed: 'mud', lilies: true,
    surface: B.mud, sub: B.dirt, hills: 0,
    patches: [[B.moss, 9, 0.62], [B.clay, 6, 0.86]],
    trees: [['mangrove', 1]], treeSpacing: 4, treeChance: 0.55, clump: 0.2, wetTrees: true,
    plants: [[B.reeds, 6], [B.fern, 3], [B.tall_grass, 3], [B.mushroom_brown, 0.6]], plantDensity: 0.22, rocks: 0.001, pools: true,
  },
  // The fungal forests: white mycelium, mushrooms taller than houses (the
  // blue ones glow at night).
  fungal: {
    name: 'Fungal Forest', char: '♤', fg: '#e08ad0', bg: '#2a1a34', isle: 'myrrow',
    climate: 'mild', lilies: true,
    surface: B.mycelium, sub: B.dirt, hills: 1,
    patches: [[B.moss, 10, 0.6], [B.mud, 7, 0.82]],
    trees: [['mushroom', 4], ['glowshroom', 2], ['toadstool', 3]], treeSpacing: 5, treeChance: 0.5, clump: 0.3,
    plants: [[B.mushroom_brown, 4], [B.mushroom_red, 3], [B.glowshroom, 1], [B.fern, 2]], plantDensity: 0.2, rocks: 0.002, ponds: true,
  },
  // Open moor: moss and peat, purple heather, the odd standing stone, mist.
  moor: {
    name: 'Moor', char: '∴', fg: '#b88ad0', bg: '#3a3044', isle: 'myrrow',
    climate: 'mild',
    surface: B.moss, sub: B.dirt, hills: 2,
    patches: [[B.peat, 9, 0.64], [B.grass_taiga, 14, 0.6], [B.gravel, 6, 0.86]],
    trees: [['dead', 1], ['birch', 1]], treeSpacing: 9, treeChance: 0.06, clump: 0.5,
    plants: [[B.heather, 9], [B.tall_grass, 4], [B.fern, 1], [B.berry_bush, 0.4]], plantDensity: 0.24, rocks: 0.012, ponds: true,
  },
  // --- the far lands (round 68: see world/farlands.js) ----------------------
  // Velmarch's warm heart: golden grass over rolling hills, silver olive
  // groves, dark cypresses standing like sentries, wild vines.
  olive_hills: {
    name: 'Olive Hills', char: '♣', fg: '#d8c060', bg: '#5a5a2a', land: 'velmarch',
    climate: 'warm', bank: B.sand, rain: 0.6,
    surface: B.grass_gold, sub: B.dirt, hills: 2,
    patches: [[B.grass, 12, 0.62], [B.gravel, 7, 0.84]],
    trees: [['olive', 5], ['cypress', 3]], treeSpacing: 5, treeChance: 0.4, clump: 0.4,
    plants: [[B.tall_grass, 8], [B.vine, 2.5], [B.flower_yellow, 2], [B.flower_purple, 1.5], [B.herb, 0.6], [B.bush, 1]], plantDensity: 0.2, rocks: 0.006,
  },
  // Velmarch's frozen north: frost birches white as bone, leaves of ice,
  // the ground silvered with frost, ice flowers that glow at dusk.
  rimewood: {
    name: 'Rimewood', char: '♠', fg: '#c8e8ff', bg: '#2a3a5a', land: 'velmarch',
    climate: 'cold', bank: B.gravel, reeds: false, snowy: true,
    surface: B.frost_grass, sub: B.dirt, hills: 2,
    patches: [[B.snow, 10, 0.5], [B.gravel, 7, 0.85]],
    trees: [['frostbirch', 6], ['snowpine', 2]], treeSpacing: 4, treeChance: 0.5, clump: 0.3,
    plants: [[B.ice_flower, 3], [B.fern, 2], [B.tall_grass, 2], [B.berry_bush, 0.8]], plantDensity: 0.16, rocks: 0.008,
  },
  // Ostria's green east: bamboo groves, cherry trees in blossom, peonies.
  bamboo_grove: {
    name: 'Bamboo Grove', char: '‖', fg: '#7ad070', bg: '#1e4a2a', land: 'ostria',
    climate: 'warm', lilies: true, rain: 1.2,
    surface: B.grass_lush, sub: B.dirt, hills: 2,
    patches: [[B.grass, 10, 0.55], [B.mud, 8, 0.86]],
    trees: [['bamboo', 7], ['cherry', 2]], treeSpacing: 4, treeChance: 0.58, clump: 0.25,
    plants: [[B.fern, 5], [B.peony, 2.5], [B.tall_grass, 4], [B.flower_red, 1], [B.herb, 0.8]], plantDensity: 0.22, rocks: 0.004, ponds: true,
  },
  // Ostria's red canyons: red rock and red sand, saguaro and prickly pear.
  red_mesa: {
    name: 'Red Mesa', char: '▙', fg: '#e07040', bg: '#6a2a18', land: 'ostria',
    climate: 'hot', bank: B.sand, reeds: false, rain: 0.3,
    surface: B.red_rock, sub: B.red_rock, hills: 3,
    patches: [[B.sand, 9, 0.6], [B.sandstone, 7, 0.78]],
    trees: [['saguaro', 4], ['dead', 1]], treeSpacing: 9, treeChance: 0.14, clump: 0.2,
    plants: [[B.prickly_pear, 3], [B.dead_bush, 3], [B.tall_grass, 1], [B.flower_yellow, 0.6]], plantDensity: 0.06, rocks: 0.02,
  },
  // Corrow's bone strand: pale sand full of bone chips, the ribs of
  // whales standing up out of it, sea grass.
  bone_strand: {
    name: 'Bone Strand', char: ')', fg: '#f0e8d0', bg: '#6a6458', land: 'corrow',
    climate: 'mild', bank: B.bone_sand, reeds: false,
    surface: B.bone_sand, sub: B.sand, hills: 1,
    patches: [[B.grass_taiga, 11, 0.6], [B.gravel, 7, 0.8]],
    trees: [['dead', 1]], treeSpacing: 10, treeChance: 0.04, clump: 0.3,
    plants: [[B.sea_grass, 6], [B.whale_rib, 1.2], [B.tall_grass, 2], [B.dead_bush, 1]], plantDensity: 0.12, rocks: 0.008,
  },
  // Saltmere's flats: a white crust to the horizon, salt crystals, saltbush,
  // and pink lagoons.
  salt_flats: {
    name: 'Salt Flats', char: '▫', fg: '#f8f4ec', bg: '#a89a9a', land: 'saltmere',
    climate: 'hot', bank: B.salt_crust, reeds: false, rain: 0.35,
    surface: B.salt_crust, sub: B.sand, hills: 0,
    patches: [[B.sand, 10, 0.66], [B.clay, 8, 0.85]],
    trees: [['dead', 1]], treeSpacing: 12, treeChance: 0.03, clump: 0,
    plants: [[B.saltbush, 4], [B.salt_crystal, 1.5], [B.dead_bush, 1]], plantDensity: 0.07, rocks: 0.002, pools: true,
  },
  // Hollowmark's hollows: deep moss, giant ferns, glowberries, and the
  // lantern trees whose pods light the bottoms all night.
  lantern_hollows: {
    name: 'Lantern Hollows', char: '♣', fg: '#ffd070', bg: '#2a3a1a', land: 'hollowmark',
    climate: 'mild', lilies: true,
    surface: B.moss, sub: B.dirt, hills: 3,
    patches: [[B.grass_lush, 10, 0.55], [B.mud, 7, 0.84]],
    trees: [['lantern', 5], ['oak', 2]], treeSpacing: 5, treeChance: 0.42, clump: 0.3,
    plants: [[B.giant_fern, 4], [B.fern, 4], [B.glowberry_bush, 2], [B.mushroom_brown, 1], [B.tall_grass, 2]], plantDensity: 0.24, rocks: 0.006, ponds: true,
  },
  // The Wyrd Isle's heath: purple-grey heath, silver birches, fairy rings,
  // standing stones, the aurora overhead.
  rune_heath: {
    name: 'Rune Heath', char: '∩', fg: '#b8a0e0', bg: '#2e2a44', land: 'wyrd',
    climate: 'cold',
    surface: B.heath, sub: B.dirt, hills: 2,
    patches: [[B.moss, 9, 0.6], [B.gravel, 7, 0.84]],
    trees: [['silverbirch', 4], ['dead', 1]], treeSpacing: 7, treeChance: 0.16, clump: 0.5,
    plants: [[B.heather, 6], [B.fairy_ring, 1], [B.standing_stone, 0.5], [B.tall_grass, 3], [B.mushroom_red, 0.6]], plantDensity: 0.18, rocks: 0.01, ponds: true,
  },
  // The Skerries' sea cliffs: wind-cropped turf, pink thrift, cairns, rock.
  sea_cliffs: {
    name: 'Sea Cliffs', char: '^', fg: '#c8d0d8', bg: '#3a4450', land: 'skerries',
    climate: 'cold', bank: B.gravel, reeds: false, rain: 1.3,
    surface: B.grass_taiga, sub: B.stone, hills: 3,
    patches: [[B.stone, 7, 0.62], [B.gravel, 9, 0.7]],
    trees: [['dead', 1]], treeSpacing: 12, treeChance: 0.02, clump: 0,
    plants: [[B.thrift, 5], [B.tall_grass, 4], [B.cairn, 0.4], [B.heather, 1]], plantDensity: 0.14, rocks: 0.025,
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
  // (Round 68: the far lands', for whoever lives there without a realm.)
  olive_hills: 'velari', rimewood: 'rime', bamboo_grove: 'jade', red_mesa: 'kesh', bone_strand: 'corrow', salt_flats: 'salt', lantern_hollows: 'hollow', rune_heath: 'wyrd', sea_cliffs: 'skerry',
};

// How good each kind of land is to build a town on (see worldgen.js).
export const BIOME_SETTLE = {
  plains: 0.45, forest: 0.3, savanna: 0.15, taiga: 0.1, jungle: 0.05, desert: -0.1, tundra: -0.2, swamp: -0.2, mountain: -1,
  ashland: 0.2, cinderwood: 0.15, geyser: 0.35, volcano: -1, moor: 0.35, fungal: 0.2, mangrove: 0.15,
  olive_hills: 0.5, rimewood: 0.05, bamboo_grove: 0.25, red_mesa: 0.1, bone_strand: 0.25, salt_flats: 0.3, lantern_hollows: 0.3, rune_heath: 0.3, sea_cliffs: 0.2,
};
