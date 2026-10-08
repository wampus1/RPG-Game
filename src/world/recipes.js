// Crafting recipes grouped by the station they need.

import { DYEABLE, DYES, DYE_FROM, GEMS } from './items.js';
import { STAIR_BASES } from './blocks.js';

export const STATIONS = {
  hand: 'By Hand',
  workbench: 'Workbench',
  furnace: 'Furnace',
  anvil: 'Anvil',
  // Trade benches (only someone licensed in the trade can work them).
  tailor: 'Tailor\'s Loom',
  herbalist: 'Herbalist\'s Still',
  scribe: 'Scribe\'s Desk',
  jeweller: 'Jeweller\'s Bench',
  baker: 'Baker\'s Oven',
  smith: 'Smith\'s Grindstone',
  trapper: 'Tanning Rack',
  fisher: 'Tackle Bench',
  woodcutter: 'Sawhorse',
  farmer: 'Potting Bench',
  miner: 'Rock Crusher',
  // The islands' own trades (see isletrades.js).
  miller: 'Millstone',
  glassblower: 'Glass Kiln',
  sporewright: 'Spore Bed',
  pearldiver: 'Pearl-Sorting Table',
};
// Stations that belong to a trade.
export const TRADE_STATIONS = new Set(['tailor', 'herbalist', 'scribe', 'jeweller', 'baker', 'smith', 'trapper', 'fisher', 'woodcutter', 'farmer', 'miner', 'miller', 'glassblower', 'sporewright', 'pearldiver']);

const R = [];
function r(station, out, n, ingredients) {
  R.push({ station, out, n, in: ingredients });
}

// --- by hand -------------------------------------------------------------------
for (const w of ['oak', 'jungle', 'acacia', 'willow', 'palm']) r('hand', 'planks', 4, { [`log_${w}`]: 1 });
r('hand', 'planks_birch', 4, { log_birch: 1 });
r('hand', 'planks_dark', 4, { log_pine: 1 });
r('hand', 'planks_cinder', 4, { log_cinder: 1 });
r('hand', 'planks_bog', 4, { log_mangrove: 1 });
r('hand', 'stick', 4, { planks: 2 });
r('hand', 'torch', 4, { stick: 1, coal: 1 });
r('hand', 'workbench', 1, { planks: 4 });
r('hand', 'campfire', 1, { stick: 3, cobblestone: 2 });
r('hand', 'club', 1, { stick: 1, planks: 2 });
r('workbench', 'wooden_spear', 1, { stick: 3 });

// Leather and cloth, sewn by hand.
r('hand', 'leather_cap', 1, { leather: 2, string: 1 });
r('hand', 'leather_tunic', 1, { leather: 5, string: 2 });
r('hand', 'leather_trousers', 1, { leather: 4, string: 1 });
r('hand', 'leather_boots', 1, { leather: 2, string: 1 });
r('hand', 'straw_hat', 1, { wheat: 4 });
r('hand', 'wool_hood', 1, { cloth: 2, string: 1 });
r('hand', 'linen_shirt', 1, { cloth: 3, string: 1 });
r('hand', 'wool_trousers', 1, { cloth: 3, string: 1 });
r('workbench', 'fine_coat', 1, { cloth: 5, string: 2, gold_ingot: 1 });

// --- workbench ------------------------------------------------------------------
r('workbench', 'wood_pickaxe', 1, { planks: 3, stick: 2 });
r('workbench', 'wood_axe', 1, { planks: 3, stick: 2 });
r('workbench', 'wood_shovel', 1, { planks: 1, stick: 2 });
r('workbench', 'wood_sword', 1, { planks: 2, stick: 1 });
r('workbench', 'wooden_shield', 1, { planks: 4, leather: 1 });
r('workbench', 'round_shield', 1, { planks: 3, leather: 1, cloth: 1 });
r('workbench', 'stone_pickaxe', 1, { cobblestone: 3, stick: 2 });
r('workbench', 'stone_axe', 1, { cobblestone: 3, stick: 2 });
r('workbench', 'stone_shovel', 1, { cobblestone: 1, stick: 2 });
r('workbench', 'stone_sword', 1, { cobblestone: 2, stick: 1 });
r('workbench', 'chest', 1, { planks: 8 });
r('workbench', 'barrel', 1, { planks: 6, stick: 2 });
r('workbench', 'crate', 1, { planks: 4, stick: 2 });
r('workbench', 'door', 1, { planks: 6 });
r('workbench', 'fence', 4, { planks: 2, stick: 4 });
r('workbench', 'table', 1, { planks: 4, stick: 2 });
r('workbench', 'chair', 1, { planks: 2, stick: 2 });
r('workbench', 'bench', 1, { planks: 3, stick: 2 });
r('workbench', 'bed', 1, { planks: 3, cloth: 3 });
r('workbench', 'bookshelf', 1, { planks: 6, book: 3 });
// (Round 73) Things to show things on, and paintings to hang.
r('workbench', 'weapon_rack', 1, { planks: 4, stick: 3, iron_ingot: 1 });
r('workbench', 'display_stand', 1, { planks: 3, stick: 1 });
r('workbench', 'wall_hanger', 1, { planks: 1, stick: 2 });
r('workbench', 'painting_small', 1, { planks: 1, cloth: 1, paper: 1 });
r('workbench', 'painting_large', 1, { planks: 3, cloth: 2, paper: 2 });
r('workbench', 'sign', 1, { planks: 3, stick: 1 });
r('workbench', 'counter', 2, { planks: 4 });
r('workbench', 'furnace', 1, { cobblestone: 8 });
r('workbench', 'stone_bricks', 4, { cobblestone: 4 });
r('workbench', 'timber', 4, { planks: 2, plaster: 2 });
r('workbench', 'plaster', 4, { sand: 2, clay: 2 });
r('workbench', 'thatch', 4, { wheat: 4 });
r('workbench', 'roof_wood', 4, { planks: 3 });
r('workbench', 'hay_bale', 1, { wheat: 6 });
r('workbench', 'cloth', 1, { string: 4 });
r('workbench', 'book', 1, { cloth: 1, reeds: 3 });
r('workbench', 'fishing_rod', 1, { stick: 3, string: 2 });
r('workbench', 'bucket', 1, { planks: 3, string: 1 });
r('workbench', 'raft', 1, { planks: 6, stick: 2, string: 3 });
r('workbench', 'ship_sloop', 1, { planks: 80, string: 24, cloth: 12, iron_ingot: 6, glass: 4 });
// (Round 69) A bottle great enough for a ship (see shipgame.js).
r('workbench', 'ship_bottle', 1, { glass: 6, planks: 2, string: 1 });
r('workbench', 'saddle', 1, { leather: 4, string: 2, iron_ingot: 1 });
r('hand', 'lead', 1, { string: 3 });
r('workbench', 'wagon', 1, { planks: 16, stick: 4, iron_ingot: 2, cloth: 3 });
r('workbench', 'rug_red', 2, { cloth: 2 });
r('workbench', 'rug_blue', 2, { cloth: 2 });
r('workbench', 'rug_green', 2, { cloth: 2 });
r('workbench', 'training_dummy', 1, { hay_bale: 1, stick: 3 });
r('workbench', 'log_wall', 4, { log: 2 });
// (Round 75) Stairs of each floor's stuff: three of it makes four.
for (const base of STAIR_BASES) r('workbench', `${base}_stairs`, 4, { [base]: 3 });
r('workbench', 'stool', 2, { planks: 1, stick: 2 });
r('workbench', 'hanging_sign', 1, { planks: 2, stick: 1, string: 1 });
r('workbench', 'snare', 1, { stick: 2, string: 2 });
r('workbench', 'bow', 1, { stick: 3, string: 3 });
r('workbench', 'longbow', 1, { stick: 5, string: 4 });
r('workbench', 'sling', 1, { string: 3, leather: 1 });
r('workbench', 'quarterstaff', 1, { planks: 2, stick: 2 });
r('workbench', 'arrow', 8, { stick: 1, feather: 1, cobblestone: 1 });

// --- furnace --------------------------------------------------------------------
r('furnace', 'iron_ingot', 1, { iron_ore: 1, coal: 1 });
r('furnace', 'gold_ingot', 1, { gold_ore: 1, coal: 1 });
r('furnace', 'glass', 2, { sand: 2, coal: 1 });
r('furnace', 'stone', 4, { cobblestone: 4, coal: 1 });
r('furnace', 'bricks', 4, { clay: 4, coal: 1 });
r('furnace', 'sandstone', 4, { sand: 4, coal: 1 });
r('furnace', 'adobe', 4, { mud: 2, wheat: 1 });
r('furnace', 'coal', 1, { log: 2 });
r('furnace', 'cooked_meat', 1, { raw_meat: 1 });
r('furnace', 'cooked_fish', 1, { fish: 1 });
r('furnace', 'bread', 1, { wheat: 3 });
r('furnace', 'stew', 1, { cooked_meat: 1, carrot: 1, mushroom: 1 });
r('furnace', 'pie', 1, { berries: 3, wheat: 2 });
r('furnace', 'feast', 1, { cooked_meat: 2, cooked_fish: 1, bread: 1, cabbage: 1 });

// --- the other Dagoni Islands -----------------------------------------------------
// Cinder and mangrove wood saw like any other; peat burns in place of coal
// (and chars down to it); obsidian takes an edge at the bench, as the
// Ashborn knap it; sulphur and coal make blasting powder; a harpoon for
// the Stiltfolk's shallows; crab cooks like anything else; and the moths'
// glowing dust quickens a draught as well as feathers do.
r('hand', 'planks_dark', 4, { log_cinder: 1 });
r('hand', 'planks', 4, { log_mangrove: 1 });
r('hand', 'torch', 3, { stick: 1, peat_turf: 1 });
r('workbench', 'obsidian_blade', 1, { obsidian_shard: 3, stick: 1, leather: 1 });
r('anvil', 'harpoon', 1, { iron_ingot: 1, stick: 2, string: 2 });
r('anvil', 'dynamite', 2, { sulfur: 2, coal: 1, string: 1 });
r('anvil', 'cannonball', 4, { iron_ingot: 1, sulfur: 1, coal: 1 });
r('furnace', 'cooked_crab', 1, { crab_meat: 1 });
r('furnace', 'coal', 1, { peat_turf: 2 });
r('herbalist', 'potion_swiftness', 1, { herb: 1, moth_dust: 2, glass: 1 });

// --- the Kavorent's ------------------------------------------------------------
// Shards of their crystal grow back into one when pressed together (five
// of a colour make a stone; a jeweller, who knows how to coax them, needs
// only four). Their scrap is the hardest thing there is to work, but a
// furnace can get iron out of it, and a smith twice as much.
for (const g of Object.keys(GEMS)) {
  r('hand', g, 1, { [`shard_${g}`]: 5 });
  r('jeweller', g, 1, { [`shard_${g}`]: 4 });
}
r('furnace', 'iron_ingot', 1, { kav_scrap: 2, coal: 1 });
r('smith', 'iron_ingot', 2, { kav_scrap: 1 });

// --- anvil ----------------------------------------------------------------------
for (const t of ['iron', 'gold']) {
  r('anvil', `${t}_pickaxe`, 1, { [`${t}_ingot`]: 3, stick: 2 });
  r('anvil', `${t}_axe`, 1, { [`${t}_ingot`]: 3, stick: 2 });
  r('anvil', `${t}_shovel`, 1, { [`${t}_ingot`]: 1, stick: 2 });
  r('anvil', `${t}_sword`, 1, { [`${t}_ingot`]: 2, stick: 1 });
}
r('anvil', 'spear', 1, { iron_ingot: 2, stick: 3 });
r('anvil', 'dagger', 1, { iron_ingot: 1, stick: 1 });
r('anvil', 'lockpick', 4, { iron_ingot: 1 });
r('anvil', 'mace', 1, { iron_ingot: 3, stick: 1 });
r('anvil', 'short_sword', 1, { iron_ingot: 1, stick: 1, leather: 1 });
r('anvil', 'sabre', 1, { iron_ingot: 3, stick: 1, leather: 1 });
r('anvil', 'hand_axe', 1, { iron_ingot: 2, stick: 1 });
r('anvil', 'flail', 1, { iron_ingot: 3, stick: 1, string: 2 });
r('anvil', 'greatsword', 1, { iron_ingot: 5, stick: 2, leather: 1 });
r('anvil', 'battle_axe', 1, { iron_ingot: 5, stick: 3 });
r('anvil', 'warhammer', 1, { iron_ingot: 5, stick: 3 });
r('anvil', 'halberd', 1, { iron_ingot: 4, stick: 4 });
r('anvil', 'crossbow', 1, { iron_ingot: 2, planks: 3, string: 3 });
r('anvil', 'bolt', 8, { iron_ingot: 1, stick: 2, feather: 1 });
r('anvil', 'javelin', 3, { iron_ingot: 1, stick: 3 });
r('anvil', 'iron_shield', 1, { iron_ingot: 5, planks: 2 });
r('anvil', 'hammer', 1, { iron_ingot: 2, stick: 2 });
r('anvil', 'hoe', 1, { iron_ingot: 1, stick: 2 });
r('anvil', 'lantern', 1, { iron_ingot: 1, torch: 1 });
r('anvil', 'anvil', 1, { iron_ingot: 5 });
r('anvil', 'iron_bars', 4, { iron_ingot: 2 });
// Armour at the anvil.
r('anvil', 'iron_helmet', 1, { iron_ingot: 4 });
r('anvil', 'chainmail', 1, { iron_ingot: 5, string: 2 });
r('anvil', 'iron_breastplate', 1, { iron_ingot: 8, leather: 1 });
r('anvil', 'iron_greaves', 1, { iron_ingot: 5, leather: 1 });
r('anvil', 'iron_boots', 1, { iron_ingot: 3, leather: 1 });
r('anvil', 'gold_circlet', 1, { gold_ingot: 2, gem: 1 });

// --- the trade benches themselves (at a workbench) ------------------------------
r('workbench', 'loom', 1, { planks: 6, stick: 4, string: 6 });
r('workbench', 'alembic', 1, { cobblestone: 4, iron_ingot: 1, glass: 2 });
r('workbench', 'writing_desk', 1, { planks: 5, stick: 2, feather: 1 });
r('workbench', 'jeweler_bench', 1, { planks: 4, iron_ingot: 2, glass: 1 });
r('workbench', 'oven', 1, { cobblestone: 6, clay: 4 });
r('workbench', 'grindstone', 1, { cobblestone: 4, planks: 2, stick: 2 });
r('workbench', 'tanning_rack', 1, { stick: 6, string: 2 });
r('workbench', 'tackle_bench', 1, { planks: 3, stick: 2, string: 3 });
r('workbench', 'sawbench', 1, { planks: 3, stick: 4, iron_ingot: 1 });
r('workbench', 'potting_bench', 1, { planks: 4, stick: 2, dirt: 2 });
r('workbench', 'rock_crusher', 1, { cobblestone: 8, stick: 2, iron_ingot: 1 });

// --- what each trade makes at its bench -------------------------------------------
// Tailors: dyed, well-cut clothes that win people over.
for (const g of Object.keys(DYEABLE)) for (const c of Object.keys(DYES)) r('tailor', `${g}_${c}`, 1, { [g]: 1, [DYE_FROM[c]]: 2 });
r('tailor', 'cloth', 2, { string: 3 });
r('tailor', 'linen_shirt', 1, { cloth: 2 });
r('tailor', 'fine_coat', 1, { cloth: 4, string: 2, gold_ingot: 1 });
// Herbalists: potions for vigour and for a few hours' extra strength, speed,
// endurance or charm; and salves.
r('herbalist', 'potion_vigor', 1, { herb: 2, berries: 2, glass: 1 });
r('herbalist', 'potion_might', 1, { herb: 1, mushroom: 2, glass: 1 });
r('herbalist', 'potion_swiftness', 1, { herb: 1, feather: 2, glass: 1 });
r('herbalist', 'potion_fortitude', 1, { herb: 1, mushroom: 1, berries: 1, glass: 1 });
r('herbalist', 'potion_charm', 1, { flower_red: 1, flower_purple: 1, herb: 1, glass: 1 });
r('herbalist', 'healing_salve', 2, { herb: 2, mushroom: 1 });
r('herbalist', 'potion_breath', 1, { herb: 1, berries: 2, feather: 1, glass: 1 });
r('herbalist', 'potion_wind', 1, { herb: 2, apple: 1, glass: 1 });
r('herbalist', 'potion_fury', 1, { mushroom: 2, raw_meat: 1, glass: 1 });
r('herbalist', 'potion_haste', 1, { herb: 1, feather: 2, slime_gel: 1, glass: 1 });
// Scribes: paper and ink (newspapers are printed from the desk itself),
// books and scrolls.
r('scribe', 'paper', 3, { reeds: 3 });
r('scribe', 'ink', 2, { coal: 1, berries: 1 });
r('scribe', 'scroll', 2, { paper: 1, ink: 1 });
r('scribe', 'book', 1, { paper: 3, leather: 1, ink: 1 });
// Jewellers: rough gems cut into stones for setting (the setting itself is
// done at the bench, carefully).
// (The rarer stones take three rough gems' worth of cutting.)
for (const k of Object.keys(GEMS)) r('jeweller', k, 1, { gem: GEMS[k].rare ? 3 : 1 });
r('jeweller', 'gold_circlet', 1, { gold_ingot: 2, gem: 1 });
// Bakers.
r('baker', 'bread', 2, { wheat: 3 });
r('baker', 'pie', 2, { berries: 3, wheat: 2 });
r('baker', 'feast', 1, { bread: 1, cooked_meat: 1, cabbage: 1, apple: 1 });
// Smiths: sharpening and fine work beyond the anvil.
r('smith', 'dagger', 1, { iron_ingot: 1, leather: 1 });
r('smith', 'short_sword', 1, { iron_ingot: 1, leather: 1 });
r('smith', 'sabre', 1, { iron_ingot: 2, leather: 1 });
r('smith', 'greatsword', 1, { iron_ingot: 4, leather: 1 });
r('smith', 'iron_bars', 6, { iron_ingot: 2 });
r('smith', 'lantern', 2, { iron_ingot: 1, torch: 2 });
// Trappers.
r('trapper', 'leather', 2, { raw_meat: 2 });
r('trapper', 'arrow', 12, { stick: 2, feather: 2, cobblestone: 1 });
r('trapper', 'snare', 3, { stick: 3, string: 2 });
r('trapper', 'leather_tunic', 1, { leather: 4, string: 1 });
// Fishers.
r('fisher', 'fishing_rod', 1, { stick: 2, string: 1 });
r('fisher', 'cooked_fish', 3, { fish: 3, coal: 1 });
r('fisher', 'raft', 1, { planks: 4, stick: 2, string: 2 });
// Woodcutters: more planks from a log than by hand.
r('woodcutter', 'planks', 6, { log: 1 });
r('woodcutter', 'stick', 8, { planks: 2 });
r('woodcutter', 'fence', 6, { planks: 2, stick: 3 });
// Farmers.
r('farmer', 'seeds', 4, { wheat: 1 });
r('farmer', 'cabbage_seeds', 3, { cabbage: 1 });
r('farmer', 'hay_bale', 1, { wheat: 5 });
// Miners: sorting ore out of rubble.
r('miner', 'iron_ore', 1, { cobblestone: 8 });
r('miner', 'coal', 2, { cobblestone: 6 });
r('miner', 'sand', 4, { cobblestone: 2 });
// Thessa's millers: flour from wheat, and a loaf or two from flour.
r('miller', 'flour', 2, { wheat: 3 });
r('miller', 'bread', 2, { flour: 1, wheat: 1 });
r('miller', 'hay_bale', 1, { wheat: 4 });
// Kharos's glassblowers: glass from sand (and the mountain's own black
// glass), lanterns, goggles against the ash, black-glass blades.
r('glassblower', 'glass', 3, { sand: 2, coal: 1 });
r('glassblower', 'glass', 2, { obsidian_shard: 2 });
r('glassblower', 'lantern', 1, { glass: 1, torch: 1, iron_ingot: 1 });
r('glassblower', 'ash_goggles', 1, { glass: 2, leather: 1 });
r('glassblower', 'obsidian_blade', 1, { obsidian_shard: 3, stick: 1, string: 1 });
// The Mirefolk's sporewrights: glowcaps raised in peat, and what's made
// of them.
r('sporewright', 'glowcap', 2, { mushroom: 1, peat_turf: 1 });
r('sporewright', 'mushroom', 3, { peat_turf: 1 });
r('sporewright', 'mushroom_broth', 1, { mushroom: 2, glowcap: 1 });
r('sporewright', 'glowcap_tea', 2, { glowcap: 1 });
r('sporewright', 'spore_tincture', 1, { glowcap: 2, glass: 1 });
// The Stiltfolk's pearl divers: pearls strung, harpoons for the deep.
r('pearldiver', 'pearl_necklace', 1, { pearl: 4, string: 1 });
r('pearldiver', 'harpoon', 1, { stick: 2, iron_ingot: 1, string: 1 });

export const RECIPES = R;

export function recipesFor(station) {
  if (TRADE_STATIONS.has(station)) return R.filter((x) => x.station === station);
  // Hand recipes are available everywhere.
  return R.filter((x) => x.station === station || (station !== 'furnace' && station !== 'anvil' && x.station === 'hand'));
}
