// The old places of the far lands (round 68), as each land's people made
// them: the usual kinds in each land's own stone, dark and dead (see
// dungeongen.dtypeOf, which lays these over the plain kinds), each land's
// own kind of old place nobody else has, and the two masters each kind has
// in each land (see entities/bosses_far.js), none of them met anywhere
// else. No Kavorent spire stands outside the storm.
//   Velmarch: the Imperial Catacombs, where the legions of the old empire
//     are laid in their ranks, and still march;
//   Ostria: the Terracotta Vaults, an emperor's clay army guarding his
//     tomb, its crossbows still strung;
//   Corrow: the Leviathan's Gut, a cave that is the inside of a whale as
//     big as a hill, still, somehow, digesting;
//   Saltmere: the Salt Cathedrals, mines cut so deep and so long they
//     became churches, the brine still welling up;
//   Hollowmark: the Deep Warrens, the oldest burrows, dug by things that
//     were digging long before the Hollowfolk;
//   the Wyrd Isle: the Hollow Hills, the fair folk's courts under their
//     mounds, where nothing stays where it was put;
//   the Grey Skerries: the Drowned Brochs, sea towers the storms broke and
//     the sea came into.
// (Each's own peril, and what drifts in its air: see game/dungeon.js.)
import { B } from './blocks.js';

// The usual kinds, as each far land makes them.
export const FAR_DSTYLE = {
  velmarch: {
    barrow: {
      name: 'Frost Barrow', wall: B.drystone, floor: B.frost_grass, alt: B.snow,
      mobs: [['skeleton', 3], ['frost_wolf', 2], ['legion_shade', 2], ['wisp', 1]],
      swap: { ghoul: ['frost_wolf'], wight: ['legion_shade'] },
      decor: [['urn', 3], ['skull_pile', 2], ['candles', 1], ['rubble', 2]],
      dark: [0.06, 0.075, 0.1], motes: ['#c8e8ff', '#ffffff'], ambient: ['wind_low', 'whisper', 'drip'],
      loot: [['frost_crystal', 1, 2, 0.4], ['antler', 1, 1, 0.3], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Silver Mine', wall: B.mine_rock, floor: B.gravel, alt: B.travertine, beam: B.log_oak,
      mobs: [['crawler', 3], ['rat', 2], ['legion_shade', 1], ['slime', 1], ['moth', 1]],
      decor: [['mine_cart', 2], ['stalagmite', 3], ['rubble', 3], ['powder_keg', 1]],
      dark: [0.08, 0.075, 0.07], motes: ['#d8d8e0', '#a0a0b0'], ambient: ['rumble', 'tink', 'drip'],
      loot: [['iron_ore', 1, 3, 0.5], ['gold_ore', 1, 2, 0.25], ['marble', 1, 3, 0.3]],
    },
    crypt: {
      name: 'Marble Crypt', wall: B.marble, floor: B.travertine, alt: B.marble_column,
      mobs: [['legion_shade', 3], ['skeleton', 2], ['wisp', 2], ['drowned', 1]],
      swap: { drowned: ['legion_shade'], ghoul: ['legion_shade'] },
      decor: [['statue', 3], ['candles', 3], ['urn', 2], ['war_banner', 1]],
      dark: [0.09, 0.08, 0.06], motes: ['#ffe8a0', '#ffffff'], ambient: ['drone', 'whisper', 'chains'],
      loot: [['old_coin', 2, 6, 0.6], ['gold_ingot', 1, 1, 0.15], ['olives', 1, 3, 0.3]],
    },
    holdout: {
      name: 'Deserters\' Fort', wall: B.travertine, floor: B.gravel, alt: B.flagstone, beam: B.log_oak,
      mobs: [['cutthroat', 3], ['holdout_archer', 3], ['legion_shade', 1], ['thief', 1]],
      decor: [['weapon_rack', 3], ['war_banner', 3], ['powder_keg', 1], ['rubble', 1]],
      dark: [0.09, 0.07, 0.055], motes: ['#c8a070', '#8a7a5a'], ambient: ['voices', 'crackle', 'creak'],
      loot: [['coin', 4, 12, 0.6], ['iron_ingot', 1, 2, 0.3], ['olive_bread', 1, 2, 0.3]],
    },
  },
  ostria: {
    barrow: {
      name: 'Jade Tomb', wall: B.stone_bricks, floor: B.flagstone, alt: B.planks_lacquer,
      mobs: [['jade_corpse', 3], ['skeleton', 2], ['wisp', 1], ['rattlesnake', 1]],
      swap: { wight: ['jade_corpse'], ghoul: ['jade_corpse'] },
      decor: [['urn', 3], ['candles', 2], ['statue', 1], ['skull_pile', 1]],
      dark: [0.05, 0.09, 0.07], motes: ['#80e0a0', '#e0ffe8'], ambient: ['whisper', 'drone', 'drip'],
      loot: [['jasmine_tea', 1, 2, 0.3], ['gem', 1, 1, 0.12], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Turquoise Mine', wall: B.red_rock, floor: B.sand, alt: B.turquoise_tile, beam: B.log_acacia,
      mobs: [['crawler', 2], ['rattlesnake', 2], ['rat', 2], ['coyote', 1], ['slime', 1]],
      decor: [['mine_cart', 2], ['stalagmite', 3], ['rubble', 3], ['powder_keg', 1]],
      dark: [0.1, 0.07, 0.05], motes: ['#2ab0a8', '#e07a4a'], ambient: ['rumble', 'tink', 'wind_low'],
      loot: [['gem', 1, 2, 0.2], ['gold_ore', 1, 2, 0.25], ['cactus_fruit', 1, 2, 0.3]],
    },
    crypt: {
      name: 'Ancestral Hall', wall: B.planks_lacquer, floor: B.bamboo, alt: B.paper_wall,
      mobs: [['jade_corpse', 3], ['wisp', 2], ['skeleton', 1], ['drowned', 1]],
      swap: { drowned: ['jade_corpse'], ghoul: ['jade_corpse'] },
      decor: [['candles', 4], ['statue', 2], ['urn', 2], ['hanging_chains', 1]],
      dark: [0.1, 0.06, 0.05], motes: ['#ff9060', '#ffe0a0'], ambient: ['drone', 'whisper', 'chains'],
      loot: [['old_coin', 2, 6, 0.5], ['dumplings', 1, 2, 0.3], ['gem', 1, 1, 0.12]],
    },
    holdout: {
      name: 'Canyon Lair', wall: B.red_rock, floor: B.sand, alt: B.adobe_red, beam: B.log_acacia,
      mobs: [['cutthroat', 3], ['holdout_archer', 3], ['coyote', 2], ['thief', 1]],
      decor: [['weapon_rack', 2], ['war_banner', 2], ['powder_keg', 2], ['rubble', 2]],
      dark: [0.1, 0.07, 0.05], motes: ['#e0a070', '#8a5a3a'], ambient: ['voices', 'crackle', 'wind_low'],
      loot: [['coin', 4, 12, 0.6], ['blue_corn_cakes', 1, 2, 0.3], ['gem', 1, 1, 0.1]],
    },
  },
  corrow: {
    barrow: {
      name: 'Whale Barrow', wall: B.drystone, floor: B.bone_sand, alt: B.whalebone,
      mobs: [['skeleton', 3], ['bone_whaler', 2], ['bone_crab', 2], ['wisp', 1]],
      swap: { wight: ['bone_whaler'], ghoul: ['bone_crab'] },
      decor: [['bones', 3], ['skull_pile', 2], ['urn', 2], ['candles', 1]],
      dark: [0.07, 0.075, 0.08], motes: ['#e8e0cc', '#a8b8c0'], ambient: ['wave', 'whisper', 'wind_low'],
      loot: [['bone', 2, 4, 0.5], ['whale_stew', 1, 1, 0.2], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Oil Cave', wall: B.cave_rock, floor: B.bone_sand, alt: B.mud, beam: B.whalebone,
      mobs: [['bone_crab', 3], ['rat', 2], ['slime', 2], ['crawler', 1]],
      decor: [['barrel', 3], ['stalagmite', 2], ['rubble', 2], ['bones', 2]],
      dark: [0.08, 0.07, 0.05], motes: ['#c8a050', '#8a7a5a'], ambient: ['drip', 'wave', 'creak'],
      loot: [['coal', 1, 3, 0.4], ['bone', 1, 3, 0.4], ['leather', 1, 2, 0.3]],
    },
    crypt: {
      name: 'Bone Chapel', wall: B.whalebone, floor: B.drystone, alt: B.bone_sand,
      mobs: [['bone_whaler', 3], ['drowned', 2], ['skeleton', 2], ['wisp', 1]],
      swap: { ghoul: ['bone_whaler'] },
      decor: [['bones', 3], ['candles', 3], ['skull_pile', 2], ['hanging_chains', 1]],
      dark: [0.06, 0.07, 0.09], motes: ['#e8f0ff', '#a0c0e0'], ambient: ['drone', 'wave', 'whisper'],
      loot: [['bone', 2, 4, 0.5], ['old_coin', 2, 5, 0.5], ['harpoon', 1, 1, 0.1]],
    },
    holdout: {
      name: 'Wreckers\' Cave', wall: B.cave_rock, floor: B.planks_drift, alt: B.bone_sand, beam: B.whalebone,
      mobs: [['cutthroat', 3], ['holdout_archer', 2], ['bone_crab', 2], ['thief', 1]],
      decor: [['barrel', 3], ['weapon_rack', 2], ['powder_keg', 2], ['war_banner', 1]],
      dark: [0.08, 0.075, 0.07], motes: ['#a8b8c0', '#e8e0cc'], ambient: ['wave', 'voices', 'creak'],
      loot: [['coin', 4, 12, 0.6], ['harpoon', 1, 1, 0.12], ['whale_stew', 1, 1, 0.2]],
    },
  },
  saltmere: {
    barrow: {
      name: 'Salt Barrow', wall: B.salt_brick, floor: B.salt_crust, alt: B.sand,
      mobs: [['salt_wight', 3], ['skeleton', 2], ['brine_scorpion', 2]],
      swap: { wight: ['salt_wight'], ghoul: ['brine_scorpion'] },
      decor: [['urn', 3], ['salt_crystal', 2], ['skull_pile', 1], ['candles', 1]],
      dark: [0.1, 0.095, 0.09], motes: ['#ffffff', '#e8c8d0'], ambient: ['wind_low', 'whisper', 'drip'],
      loot: [['salt', 2, 5, 0.6], ['salt_fish', 1, 2, 0.3], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Brine Pit', wall: B.salt_brick, floor: B.salt_crust, alt: B.clay, beam: B.log_birch,
      mobs: [['brine_scorpion', 3], ['crawler', 2], ['salt_wight', 1], ['slime', 1]],
      decor: [['salt_crystal', 4], ['mine_cart', 2], ['rubble', 2], ['barrel', 1]],
      dark: [0.1, 0.09, 0.09], motes: ['#ffffff', '#f0d8e0'], ambient: ['drip', 'tink', 'rumble'],
      loot: [['salt', 3, 6, 0.6], ['gem', 1, 1, 0.12], ['gold_ore', 1, 2, 0.2]],
    },
    crypt: {
      name: 'White Ossuary', wall: B.salt_brick, floor: B.tile_blue, alt: B.salt_crust,
      mobs: [['salt_wight', 3], ['drowned', 2], ['wisp', 1], ['skeleton', 1]],
      swap: { ghoul: ['salt_wight'] },
      decor: [['candles', 3], ['statue', 2], ['salt_crystal', 2], ['skull_pile', 1]],
      dark: [0.09, 0.09, 0.11], motes: ['#ffffff', '#a0c8ff'], ambient: ['drone', 'drip', 'whisper'],
      loot: [['salt', 2, 4, 0.5], ['old_coin', 2, 5, 0.5], ['pink_feather', 1, 2, 0.3]],
    },
    holdout: {
      name: 'Smugglers\' Pans', wall: B.salt_brick, floor: B.sand, alt: B.planks_birch, beam: B.log_birch,
      mobs: [['cutthroat', 3], ['holdout_archer', 3], ['brine_scorpion', 1], ['thief', 2]],
      decor: [['barrel', 3], ['weapon_rack', 2], ['powder_keg', 1], ['salt_crystal', 1]],
      dark: [0.1, 0.09, 0.08], motes: ['#e8e0d0', '#c8b8a8'], ambient: ['voices', 'wave', 'creak'],
      loot: [['coin', 4, 12, 0.6], ['salt', 2, 4, 0.4], ['shrimp_soup', 1, 1, 0.2]],
    },
  },
  hollowmark: {
    barrow: {
      name: 'Root Barrow', wall: B.cob, floor: B.moss, alt: B.peat,
      mobs: [['skeleton', 2], ['tunneler', 3], ['cave_moth', 2], ['rat', 1]],
      swap: { wight: ['tunneler'], ghoul: ['tunneler'] },
      decor: [['roots', 4], ['urn', 2], ['glowshroom', 2], ['candles', 1]],
      dark: [0.07, 0.08, 0.05], motes: ['#ffd070', '#c8e080'], ambient: ['drip', 'whisper', 'skitter'],
      loot: [['glowberries', 1, 3, 0.4], ['lantern_pod', 1, 2, 0.4], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Glowworm Cave', wall: B.cave_rock, floor: B.moss, alt: B.mud, beam: B.log_oak,
      mobs: [['crawler', 2], ['tunneler', 2], ['cave_moth', 2], ['rat', 2]],
      decor: [['glowshroom', 4], ['stalagmite', 3], ['mine_cart', 1], ['roots', 2]],
      dark: [0.06, 0.08, 0.07], motes: ['#80e8ff', '#ffe890'], ambient: ['drip', 'skitter', 'tink'],
      loot: [['glowberries', 1, 3, 0.4], ['iron_ore', 1, 2, 0.3], ['gem', 1, 1, 0.1]],
    },
    crypt: {
      name: 'Lantern Crypt', wall: B.mossy_bricks, floor: B.planks, alt: B.cob,
      mobs: [['tunneler', 2], ['wisp', 2], ['cave_moth', 2], ['skeleton', 1]],
      swap: { drowned: ['tunneler'] },
      decor: [['candles', 4], ['roots', 2], ['urn', 2], ['glowshroom', 2]],
      dark: [0.09, 0.075, 0.05], motes: ['#ffd070', '#fff0b0'], ambient: ['drone', 'whisper', 'drip'],
      loot: [['lantern_pod', 1, 3, 0.4], ['old_coin', 2, 5, 0.5], ['glowberry_tart', 1, 1, 0.2]],
    },
    holdout: {
      name: 'Burglars\' Burrow', wall: B.cob, floor: B.dirt, alt: B.planks, beam: B.log_oak,
      mobs: [['cutthroat', 3], ['holdout_archer', 2], ['thief', 3], ['badger', 1]],
      decor: [['barrel', 2], ['weapon_rack', 2], ['roots', 2], ['war_banner', 1]],
      dark: [0.09, 0.075, 0.05], motes: ['#c8a070', '#8a6a48'], ambient: ['voices', 'crackle', 'skitter'],
      loot: [['coin', 4, 12, 0.6], ['root_stew', 1, 1, 0.2], ['lantern_pod', 1, 2, 0.3]],
    },
  },
  wyrd: {
    barrow: {
      name: 'Rune Barrow', wall: B.drystone, floor: B.heath, alt: B.moss,
      mobs: [['skeleton', 2], ['fey_knight', 2], ['wisp', 2], ['grave_raven', 1]],
      swap: { wight: ['fey_knight'], ghoul: ['wisp'] },
      decor: [['standing_stone', 2], ['urn', 2], ['candles', 1], ['roots', 2]],
      dark: [0.07, 0.06, 0.1], motes: ['#c8a0ff', '#80ffc0'], ambient: ['whisper', 'wind_low', 'drone'],
      loot: [['frost_crystal', 1, 1, 0.2], ['heather_bread', 1, 1, 0.3], ['old_coin', 1, 4, 0.5]],
    },
    mine: {
      name: 'Spirit Mine', wall: B.cave_rock, floor: B.heath, alt: B.drystone, beam: B.log_birch,
      mobs: [['crawler', 2], ['wisp', 3], ['fey_knight', 1], ['rat', 1]],
      decor: [['glowshroom', 3], ['stalagmite', 3], ['standing_stone', 1], ['rubble', 2]],
      dark: [0.06, 0.06, 0.1], motes: ['#a0c8ff', '#e0d0ff'], ambient: ['drone', 'tink', 'whisper'],
      loot: [['gem', 1, 1, 0.15], ['iron_ore', 1, 2, 0.3], ['frost_crystal', 1, 1, 0.2]],
    },
    crypt: {
      name: 'Seers\' Vault', wall: B.drystone, floor: B.flagstone, alt: B.heath,
      mobs: [['fey_knight', 2], ['wisp', 3], ['skeleton', 1], ['drowned', 1]],
      swap: { ghoul: ['fey_knight'] },
      decor: [['candles', 3], ['standing_stone', 2], ['statue', 1], ['skull_pile', 1]],
      dark: [0.07, 0.06, 0.11], motes: ['#c8a0ff', '#ffffff'], ambient: ['drone', 'whisper', 'chains'],
      loot: [['old_coin', 2, 5, 0.5], ['seer_stew', 1, 1, 0.2], ['gem', 1, 1, 0.12]],
    },
    holdout: {
      name: 'Outlaws\' Ring', wall: B.drystone, floor: B.heath, alt: B.dirt, beam: B.log_birch,
      mobs: [['cutthroat', 3], ['holdout_archer', 3], ['grave_raven', 1], ['thief', 1]],
      decor: [['weapon_rack', 2], ['war_banner', 2], ['standing_stone', 1], ['rubble', 1]],
      dark: [0.08, 0.07, 0.09], motes: ['#a090c0', '#d0c0e0'], ambient: ['voices', 'wind_low', 'crackle'],
      loot: [['coin', 4, 12, 0.6], ['heather_bread', 1, 2, 0.3], ['gem', 1, 1, 0.08]],
    },
  },
  skerries: {
    barrow: {
      name: 'Cairn Barrow', wall: B.drystone, floor: B.gravel, alt: B.stone,
      mobs: [['skeleton', 3], ['drowned', 2], ['wrecker', 1], ['wisp', 1]],
      swap: { wight: ['drowned'] },
      decor: [['cairn', 3], ['urn', 2], ['skull_pile', 1], ['rubble', 2]],
      dark: [0.065, 0.07, 0.08], motes: ['#a8b8c8', '#e0e8f0'], ambient: ['wind_low', 'wave', 'whisper'],
      loot: [['salt_fish', 1, 2, 0.3], ['old_coin', 1, 4, 0.5], ['feather', 1, 3, 0.3]],
    },
    mine: {
      name: 'Sea Cave', wall: B.cave_rock, floor: B.gravel, alt: B.water, beam: B.planks_dark,
      mobs: [['crawler', 2], ['drowned', 2], ['rat', 2], ['slime', 1]],
      decor: [['kelp', 3], ['stalagmite', 2], ['rubble', 2], ['barrel', 1]],
      dark: [0.06, 0.07, 0.09], motes: ['#a0c8e0', '#e0f0ff'], ambient: ['wave', 'drip', 'tink'],
      loot: [['iron_ore', 1, 3, 0.3], ['fish_pie', 1, 1, 0.2], ['gem', 1, 1, 0.1]],
    },
    crypt: {
      name: 'Drowned Kirk', wall: B.drystone, floor: B.stone_bricks, alt: B.gravel,
      mobs: [['drowned', 3], ['skeleton', 2], ['wisp', 1], ['wrecker', 1]],
      swap: { ghoul: ['drowned'] },
      decor: [['candles', 3], ['statue', 1], ['kelp', 2], ['hanging_chains', 2]],
      dark: [0.06, 0.07, 0.09], motes: ['#a0d0e0', '#ffffff'], ambient: ['drone', 'wave', 'chains'],
      loot: [['old_coin', 2, 5, 0.5], ['salt_fish', 1, 2, 0.3], ['gem', 1, 1, 0.1]],
    },
    holdout: {
      name: 'Wreckers\' Hold', wall: B.drystone, floor: B.planks_dark, alt: B.gravel, beam: B.planks_dark,
      mobs: [['wrecker', 3], ['cutthroat', 2], ['holdout_archer', 2], ['thief', 1]],
      swap: { cutthroat: ['wrecker', 'cutthroat'] },
      decor: [['barrel', 3], ['weapon_rack', 2], ['powder_keg', 2], ['war_banner', 1]],
      dark: [0.07, 0.07, 0.08], motes: ['#a8b8c8', '#ffb060'], ambient: ['wave', 'voices', 'creak'],
      loot: [['coin', 4, 12, 0.6], ['fish_pie', 1, 1, 0.2], ['harpoon', 1, 1, 0.08]],
    },
  },
};

// Each far land's own kind of old place.
export const FAR_DTYPES = {
  // The catacombs of the old empire under Velmarch: long halls of
  // travertine and marble, mosaics of the legions' victories on the
  // floors, the dead laid out in ranks; and the ranks get up.
  catacomb: {
    name: 'Imperial Catacomb', isle: 'velmarch', wall: B.travertine, floor: B.marble, alt: B.turquoise_tile, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['legion', 'mosaic', 'ossuary', 'shrine', 'legion', 'pillared', 'burial', 'trap', 'treasure', 'guard'],
    mobs: [['legion_shade', 5], ['skeleton', 2], ['wisp', 1]],
    swap: { wight: ['legion_shade'], ghoul: ['legion_shade'], drowned: ['legion_shade'] },
    bosses: ['last_emperor', 'bronze_wolf'], torches: 0.35,
    shapes: { rect: 4, octagon: 2, cross: 2 }, wiggle: 0, decor: [['statue', 3], ['urn', 2], ['candles', 3], ['war_banner', 2]],
    dark: [0.1, 0.085, 0.06], motes: ['#ffe090', '#fff8e0'], ambient: ['drone', 'chains', 'whisper', 'march'],
    loot: [['gold_ingot', 1, 2, 0.3], ['old_coin', 3, 8, 0.6], ['marble', 2, 4, 0.3], ['gem', 1, 1, 0.12]],
  },
  // An emperor's tomb in Ostria, guarded by his army in clay: rank on rank
  // of terracotta soldiers, red lacquer halls, lanterns, the crossbows of
  // the statues still drawn.
  vault: {
    name: 'Terracotta Vault', isle: 'ostria', wall: B.adobe_red, floor: B.flagstone, alt: B.planks_lacquer, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['soldiers', 'lanterns', 'pillared', 'shrine', 'soldiers', 'cache', 'trap', 'treasure', 'guard', 'collapsed'],
    mobs: [['terracotta_soldier', 4], ['terracotta_archer', 2], ['jade_corpse', 2], ['wisp', 1]],
    swap: { skeleton: ['terracotta_soldier'], wight: ['jade_corpse'], ghoul: ['terracotta_soldier'], cutthroat: ['terracotta_soldier'], holdout_archer: ['terracotta_archer'], bombarder: ['terracotta_archer'] },
    bosses: ['terracotta_general', 'jade_dragon'], torches: 0.3,
    shapes: { rect: 5, cross: 2, octagon: 1 }, wiggle: 0, decor: [['statue', 3], ['candles', 2], ['urn', 2], ['war_banner', 1]],
    dark: [0.1, 0.06, 0.05], motes: ['#ff8060', '#ffd0a0'], ambient: ['drone', 'creak', 'whisper'],
    loot: [['gem', 1, 2, 0.2], ['gold_ingot', 1, 1, 0.2], ['jasmine_tea', 1, 2, 0.3], ['old_coin', 3, 8, 0.6]],
  },
  // Inside a whale the size of a hill, cast up on Corrow so long ago the
  // island grew round it: ribs for walls, bone for floor, the bile pools,
  // the parasites; and it's still, somehow, digesting.
  gut: {
    name: 'Leviathan\'s Gut', isle: 'corrow', wall: B.whalebone, floor: B.bone_sand, alt: B.mud, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['ribcage', 'bilepool', 'ribcage', 'wreck', 'bilepool', 'collapsed', 'trap', 'treasure', 'ribcage', 'guard'],
    mobs: [['bone_crab', 3], ['bone_whaler', 2], ['drowned', 2], ['slime', 2]],
    swap: { skeleton: ['bone_whaler'], wight: ['bone_whaler'], ghoul: ['bone_crab'], crawler: ['bone_crab'] },
    bosses: ['leviathan_heart', 'gut_wyrm'], torches: 0.1,
    shapes: { cave: 5, round: 3 }, wiggle: 1.5, decor: [['bones', 4], ['skull_pile', 1], ['kelp', 2], ['rubble', 1]],
    dark: [0.1, 0.06, 0.06], motes: ['#e8d0c0', '#a8c070'], ambient: ['heart', 'drip', 'creak', 'wave'],
    loot: [['bone', 3, 6, 0.6], ['whale_stew', 1, 1, 0.2], ['pearl', 1, 2, 0.25], ['harpoon', 1, 1, 0.08]],
  },
  // Saltmere's oldest workings, cut down and down until they were
  // cathedrals: white vaults of salt, pillars of crystal, pools of brine,
  // the miners' chapels; and the brine wells up.
  saltworks: {
    name: 'Salt Cathedral', isle: 'saltmere', wall: B.salt_brick, floor: B.salt_crust, alt: B.tile_blue, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['crystals', 'brinepool', 'shrine', 'pillared', 'crystals', 'gallery', 'trap', 'treasure', 'brinepool', 'guard'],
    mobs: [['salt_wight', 4], ['brine_scorpion', 3], ['drowned', 1]],
    swap: { skeleton: ['salt_wight'], wight: ['salt_wight'], ghoul: ['brine_scorpion'], crawler: ['brine_scorpion'] },
    bosses: ['salt_mother', 'mirage_lion'], torches: 0.25,
    shapes: { octagon: 3, rect: 2, cave: 2, cross: 1 }, wiggle: 0.4, decor: [['salt_crystal', 4], ['candles', 2], ['statue', 1], ['mine_cart', 1]],
    dark: [0.12, 0.11, 0.12], motes: ['#ffffff', '#f8d8e8'], ambient: ['drip', 'salt_song', 'tink', 'drone'],
    loot: [['salt', 4, 8, 0.6], ['gem', 1, 2, 0.2], ['pink_feather', 1, 2, 0.3], ['gold_ore', 1, 2, 0.2]],
  },
  // The oldest burrows under Hollowmark, dug before the Hollowfolk came by
  // whatever was digging then: tunnels round as pipes, larders, rooms of
  // roots, the lantern pods grown in them; and the floor's hollow too.
  warren: {
    name: 'Deep Warren', isle: 'hollowmark', wall: B.cob, floor: B.moss, alt: B.dirt, beam: B.log_oak, regions: [2, 2], floors: [1, 3],
    kits: ['burrow', 'lanternroom', 'roots', 'larder', 'burrow', 'collapsed', 'trap', 'treasure', 'lanternroom', 'guard'],
    mobs: [['tunneler', 4], ['badger', 2], ['cave_moth', 2], ['rat', 2]],
    swap: { skeleton: ['tunneler'], wight: ['tunneler'], ghoul: ['badger'], crawler: ['tunneler'], wolf: ['badger', 'tunneler'], moth: ['cave_moth'] },
    bosses: ['first_digger', 'thing_below'], torches: 0.15,
    shapes: { round: 5, cave: 3 }, wiggle: 1.3, decor: [['roots', 4], ['glowshroom', 3], ['barrel', 1], ['rubble', 1]],
    dark: [0.08, 0.07, 0.04], motes: ['#ffd070', '#c8a060'], ambient: ['skitter', 'drip', 'rumble', 'whisper'],
    loot: [['lantern_pod', 2, 4, 0.5], ['glowberries', 1, 3, 0.4], ['gold_ore', 1, 2, 0.2], ['gem', 1, 1, 0.12]],
  },
  // A court of the fair folk under one of the Wyrd Isle's mounds: halls of
  // drystone with the heath growing through, rings of toadstools, the
  // standing stones; and nothing stays where it was put, you included.
  mound: {
    name: 'Hollow Hill', isle: 'wyrd', wall: B.drystone, floor: B.heath, alt: B.moss, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['ring', 'court', 'glade', 'shrine', 'ring', 'pillared', 'trap', 'treasure', 'court', 'guard'],
    mobs: [['fey_knight', 4], ['wisp', 3], ['grave_raven', 1]],
    swap: { skeleton: ['fey_knight'], wight: ['fey_knight'], ghoul: ['wisp'], drowned: ['fey_knight'], thornling: ['fey_knight', 'wisp'], moth: ['grave_raven'] },
    bosses: ['fair_king', 'hill_sleeper'], torches: 0.1,
    shapes: { round: 4, octagon: 2, cave: 2 }, wiggle: 0.8, decor: [['standing_stone', 3], ['glowshroom', 3], ['candles', 1], ['roots', 2]],
    dark: [0.06, 0.05, 0.1], motes: ['#c8a0ff', '#80ffd0', '#ffffff'], ambient: ['whisper', 'drone', 'chime'],
    loot: [['gem', 1, 2, 0.25], ['frost_crystal', 1, 2, 0.3], ['seer_stew', 1, 1, 0.2], ['old_coin', 2, 6, 0.5]],
  },
  // The broken sea towers of the Skerries, flooded to their second floors:
  // drystone, the sea in the stair, weed on everything, the old beacon
  // keepers' stores; and the gale comes in through the slits.
  broch: {
    name: 'Drowned Broch', isle: 'skerries', wall: B.drystone, floor: B.stone, alt: B.gravel, beam: B.planks_dark, regions: [2, 2], floors: [1, 3],
    kits: ['flooded', 'beaconroom', 'storehouse', 'wreck', 'flooded', 'collapsed', 'trap', 'treasure', 'beaconroom', 'guard'],
    mobs: [['drowned', 4], ['wrecker', 2], ['crawler', 1], ['skeleton', 1]],
    swap: { skeleton: ['drowned'], wight: ['drowned'], ghoul: ['wrecker'], cutthroat: ['wrecker'] },
    bosses: ['beacon_keeper', 'sea_trow'], torches: 0.2,
    shapes: { round: 5, octagon: 2 }, wiggle: 0.3, decor: [['kelp', 3], ['barrel', 2], ['rubble', 2], ['hanging_chains', 1]],
    dark: [0.06, 0.07, 0.09], motes: ['#a0c8e0', '#ffffff'], ambient: ['wave', 'wind_low', 'sea_bell', 'creak'],
    loot: [['fish_pie', 1, 1, 0.2], ['gem', 1, 1, 0.15], ['iron_ingot', 1, 2, 0.3], ['old_coin', 2, 6, 0.5]],
  },
};
export const FAR_OWN_TYPE = { velmarch: 'catacomb', ostria: 'vault', corrow: 'gut', saltmere: 'saltworks', hollowmark: 'warren', wyrd: 'mound', skerries: 'broch' };

// Two masters to each kind of old place in each far land (one picked for
// each place): see entities/bosses_far.js.
export const FAR_BOSSES = {
  velmarch: { barrow: ['frost_jarl', 'barrow_mammoth'], mine: ['iron_legate', 'silver_wyrm'], crypt: ['pale_vestal', 'marble_colossus'], holdout: ['deserter_general', 'war_eagle'], catacomb: ['last_emperor', 'bronze_wolf'] },
  ostria: { barrow: ['jade_corpse_lord', 'skinwalker'], mine: ['turquoise_golem', 'great_centipede'], crypt: ['nine_tailed_fox', 'hungry_ghost'], holdout: ['bandit_khan', 'thunderbird'], vault: ['terracotta_general', 'jade_dragon'] },
  corrow: { barrow: ['bone_thane', 'carrion_roc'], mine: ['scrimshaw_horror', 'oil_bloat'], crypt: ['whale_priest', 'kraken_spawn'], holdout: ['harpoon_queen', 'bull_walrus'], gut: ['leviathan_heart', 'gut_wyrm'] },
  saltmere: { barrow: ['salt_mummy', 'brine_crab_king'], mine: ['crystal_matriarch', 'salt_wyrm'], crypt: ['salt_bride', 'flamingo_seraph'], holdout: ['salt_doge', 'lagoon_hydra'], saltworks: ['salt_mother', 'mirage_lion'] },
  hollowmark: { barrow: ['mole_king', 'root_witch'], mine: ['glowworm_queen', 'deep_golem'], crypt: ['moth_queen', 'lamplighter'], holdout: ['burrow_baron', 'cave_bear'], warren: ['first_digger', 'thing_below'] },
  wyrd: { barrow: ['raven_queen', 'antlered_one'], mine: ['rune_golem', 'ninth_wyrm'], crypt: ['rune_witch', 'banshee'], holdout: ['fey_reaver', 'white_hart'], mound: ['fair_king', 'hill_sleeper'] },
  skerries: { barrow: ['trow_king', 'finnman'], mine: ['storm_giant', 'stack_crab'], crypt: ['selkie_widow', 'drowned_bell'], holdout: ['the_wrecker', 'storm_petrel'], broch: ['beacon_keeper', 'sea_trow'] },
};

// How many old places each far land has, and how many of them are its own
// kind.
export const FAR_SITES = { velmarch: 14, ostria: 11, corrow: 4, saltmere: 4, hollowmark: 4, wyrd: 5, skerries: 4 };
export const FAR_OWN_SHARE = 0.35;

// Harder than the Dagoni Islands' masters, these: further from home.
export const FAR_BOSS_HP = 1.4;
export const FAR_BOSS_DMG = 1.25;
export const FAR_BOSS_TEMPO = 1.35;

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// What a far land's own old place is called after, and how folk there
// speak of one.
export const FAR_TYPE_LORE = {
  catacomb: {
    who: ['the Emperor Aurelian', 'the Ninth Legion', 'the Empress Livia', 'Consul Varro', 'the Praetorian Guard'],
    name: (who) => `the Catacomb of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${who} was laid to rest under the hills ${where} with the legions ranked round about, sworn to guard their emperor past death. ${tn ? `${tn} still hears the march` : 'The march is still heard'} on the eve of the Triumph.`,
    short: (who, where) => `${cap(who)} lies under the hills ${where}, the legions ranked round about.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. The dead down there stand in their ranks, and when a living man walks in, they dress their lines.`, `They say the catacomb ${where} is full of gold. They say a lot of things about it. ${d.origin.short}`],
  },
  vault: {
    who: ['the First Emperor', 'General Bai Qi', 'the Jade Empress', 'the Dragon-Born Prince', 'the Eternal Court'],
    name: (who) => `the Vault of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${who} was sealed into a tomb ${where} with an army of clay to guard it, eight thousand strong, every face different. ${tn ? `The scholars of ${tn}` : 'The scholars'} say the crossbows of the statues are still drawn.`,
    short: (who, where) => `${cap(who)} was sealed into a tomb ${where} with an army of clay to guard it.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. An army of clay, every face a real man's. Some say they were real men.`, `Don't go into the vault ${where}. The clay soldiers turn their heads to watch you. ${d.origin.short}`],
  },
  gut: {
    who: ['the Great Whale', 'the Leviathan', 'Old Bones', 'the Whale-Mother', 'the Drowned King'],
    name: (who) => `the Gut of ${who}`,
    text: (y, who, where, tn) => `In ${y}, a hunting party went into the bones of ${who} ${where} after ambergris, and found the way went on down, into the whale, and the whale was not as dead as it looked. ${tn ? `${tn} won't` : 'Nobody will'} fish the bay there now.`,
    short: (who, where) => `The bones of ${who} ${where} go down into the whale, and the whale isn't as dead as it looks.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. Put your ear to the ground there and you'll hear it: a heartbeat, slow as the tide.`, `There's ambergris in the gut ${where}, a fortune of it. ${d.origin.short}`],
  },
  saltworks: {
    who: ['the Salt Mother', 'the First Rakers', 'Doge Kostas', 'the Brine-Keeper', 'the White Sisters'],
    name: (who) => `the Cathedral of ${who}`,
    text: (y, who, where, tn) => `In ${y}, the old workings ${where} were closed: dug so deep in the service of ${who} that they'd become a church, and the brine came up through the floor of it. ${tn ? `The salt of ${tn}` : 'The salt'} has tasted of tears ever since.`,
    short: (who, where) => `The old salt workings ${where}, dug so deep for ${who} they became a church.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. The salt there sings when the brine rises. Nobody goes down when it's singing.`, `The miners who never came up from ${d.name} are still down there, white as the walls. ${d.origin.short}`],
  },
  warren: {
    who: ['the First Digger', 'the Old Mole', 'the Root-King', 'the Deep Sleeper', 'the Lantern Mother'],
    name: (who) => `the Warren of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${tn ? `the folk of ${tn}` : 'the Hollowfolk'} dug into a burrow ${where} older than any of theirs, dug by ${who}, and stopped it up again in a hurry.`,
    short: (who, where) => `There's a burrow ${where} older than any of ours, dug by ${who}.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. Round tunnels, perfectly round, going down further than anyone's dared follow.`, `Something's still digging under ${where}. You can feel it in your feet. ${d.origin.short}`],
  },
  mound: {
    who: ['the Fair King', 'the Antlered One', 'the Raven Queen', 'the Sleeper Under the Hill', 'the Fey Court'],
    name: (who) => `the Hill of ${who}`,
    text: (y, who, where, tn) => `In ${y}, a piper of ${tn || 'the isle'} followed music into the hill ${where}, the court of ${who}. He came out the next morning, he said; but it was a hundred years later, and nobody knew him.`,
    short: (who, where) => `The hill ${where} is the court of ${who}. Go in, and you may not come out in the same year.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. Walk round it three times widdershins and the door appears. Don't.`, `Leave milk out for the hill ${where} and it'll leave you be. ${d.origin.short}`],
  },
  broch: {
    who: ['the Beacon-Keeper Erling', 'the Storm Giant', 'the Wreckers', 'Old Finnman', 'the Selkie Mother'],
    name: (who) => `the Broch of ${who}`,
    text: (y, who, where, tn) => `In ${y}, the great storm broke the broch ${where} where ${who} kept the beacon, and the sea came into its stair. ${tn ? `${tn} still sees` : 'Folk still see'} a light in it on wild nights.`,
    short: (who, where) => `The broch ${where}, where ${who} kept the beacon, till the sea came in.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. There's a light in it on stormy nights, and nobody to light it.`, `The broch ${where} is full of what the wreckers took. ${d.origin.short}`],
  },
};
