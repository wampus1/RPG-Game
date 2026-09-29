// Crafting recipes grouped by the station they need.

export const STATIONS = {
  hand: 'By Hand',
  workbench: 'Workbench',
  furnace: 'Furnace',
  anvil: 'Anvil',
};

const R = [];
function r(station, out, n, ingredients) {
  R.push({ station, out, n, in: ingredients });
}

// --- by hand -------------------------------------------------------------------
for (const w of ['oak', 'jungle', 'acacia', 'willow', 'palm']) r('hand', 'planks', 4, { [`log_${w}`]: 1 });
r('hand', 'planks_birch', 4, { log_birch: 1 });
r('hand', 'planks_dark', 4, { log_pine: 1 });
r('hand', 'stick', 4, { planks: 2 });
r('hand', 'torch', 4, { stick: 1, coal: 1 });
r('hand', 'workbench', 1, { planks: 4 });
r('hand', 'campfire', 1, { stick: 3, cobblestone: 2 });
r('hand', 'club', 1, { stick: 1, planks: 2 });

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
r('workbench', 'rug_red', 2, { cloth: 2 });
r('workbench', 'rug_blue', 2, { cloth: 2 });
r('workbench', 'rug_green', 2, { cloth: 2 });
r('workbench', 'training_dummy', 1, { hay_bale: 1, stick: 3 });
r('workbench', 'log_wall', 4, { log_pine: 2 });
r('workbench', 'stool', 2, { planks: 1, stick: 2 });
r('workbench', 'hanging_sign', 1, { planks: 2, stick: 1, string: 1 });
r('workbench', 'snare', 1, { stick: 2, string: 2 });
r('workbench', 'bow', 1, { stick: 3, string: 3 });
r('workbench', 'arrow', 8, { stick: 1, feather: 1, cobblestone: 1 });

// --- furnace --------------------------------------------------------------------
r('furnace', 'iron_ingot', 1, { iron_ore: 1, coal: 1 });
r('furnace', 'gold_ingot', 1, { gold_ore: 1, coal: 1 });
r('furnace', 'glass', 2, { sand: 2, coal: 1 });
r('furnace', 'stone', 4, { cobblestone: 4, coal: 1 });
r('furnace', 'bricks', 4, { clay: 4, coal: 1 });
r('furnace', 'sandstone', 4, { sand: 4, coal: 1 });
r('furnace', 'adobe', 4, { mud: 2, wheat: 1 });
r('furnace', 'coal', 1, { log_oak: 2 });
r('furnace', 'cooked_meat', 1, { raw_meat: 1 });
r('furnace', 'cooked_fish', 1, { fish: 1 });
r('furnace', 'bread', 1, { wheat: 3 });
r('furnace', 'stew', 1, { cooked_meat: 1, carrot: 1, mushroom: 1 });
r('furnace', 'pie', 1, { berries: 3, wheat: 2 });
r('furnace', 'feast', 1, { cooked_meat: 2, cooked_fish: 1, bread: 1, cabbage: 1 });

// --- anvil ----------------------------------------------------------------------
for (const t of ['iron', 'gold']) {
  r('anvil', `${t}_pickaxe`, 1, { [`${t}_ingot`]: 3, stick: 2 });
  r('anvil', `${t}_axe`, 1, { [`${t}_ingot`]: 3, stick: 2 });
  r('anvil', `${t}_shovel`, 1, { [`${t}_ingot`]: 1, stick: 2 });
  r('anvil', `${t}_sword`, 1, { [`${t}_ingot`]: 2, stick: 1 });
}
r('anvil', 'spear', 1, { iron_ingot: 2, stick: 3 });
r('anvil', 'dagger', 1, { iron_ingot: 1, stick: 1 });
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

export const RECIPES = R;

export function recipesFor(station) {
  // Hand recipes are available everywhere.
  return R.filter((x) => x.station === station || (station !== 'furnace' && station !== 'anvil' && x.station === 'hand'));
}
