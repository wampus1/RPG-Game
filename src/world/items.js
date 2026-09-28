// Item registry. Placeable blocks get an item with the same key as the block.
import { BLOCKS, B } from './blocks.js';

export const ITEMS = {};

function item(key, props) {
  const d = {
    key,
    kind: 'material',
    stack: 64,
    value: 1,
    ...props,
  };
  d.name = props.name || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  ITEMS[key] = d;
  return d;
}

// Blocks that exist in the world but are never held as items.
const NOT_ITEMS = new Set([
  'air', 'bedrock', 'water', 'door_top', 'lily_pad', 'grass', 'grass_lush', 'grass_dry',
  'grass_jungle', 'grass_taiga', 'path', 'farmland', 'roof_snow', 'leaves_snowy', 'coal_ore',
  'gem_ore', 'wheat_crop', 'carrot_crop', 'cabbage_crop', 'tall_grass', 'fern', 'bush',
  'berry_bush', 'dead_bush', 'reeds', 'mushroom_red', 'mushroom_brown', 'herb', 'rock',
  'cobweb', 'well', 'altar', 'statue', 'campfire', 'gravestone', 'cell_door', 'cell_door_open',
]);

const BLOCK_VALUES = {
  planks: 1, cobblestone: 1, stone_bricks: 2, glass: 3, chest: 8, door: 6, bed: 12,
  workbench: 8, furnace: 10, anvil: 40, lantern: 12, bookshelf: 15, marble: 4, iron_ore: 5,
  gold_ore: 10, torch: 1, hay_bale: 4, pumpkin: 3, fence: 1, table: 5, chair: 3, bench: 4, barrel: 5, crate: 4,
  rug_red: 4, rug_blue: 4, rug_green: 4, sapling: 2, flower_red: 1, flower_blue: 1, planks_dark: 1, sign: 3,
  iron_bars: 8, stool: 2, hanging_sign: 4, snare: 3,
};

for (const b of BLOCKS) {
  if (NOT_ITEMS.has(b.name)) continue;
  item(b.name, { name: b.label, kind: 'block', block: b.id, value: BLOCK_VALUES[b.name] || 1 });
}
// Leaves drop as items too (for decoration).
item('leaves_snowy', { name: 'Snowy Needles', kind: 'block', block: B.leaves_snowy });
item('campfire', { name: 'Campfire', kind: 'block', block: B.campfire, value: 3 });

// --- materials -----------------------------------------------------------------
item('stick', { value: 1 });
item('coal', { value: 2 });
item('iron_ingot', { value: 12 });
item('gold_ingot', { value: 25 });
item('gem', { value: 60 });
item('string', { value: 2 });
item('leather', { value: 5 });
item('cloth', { value: 4 });
item('seeds', { name: 'Seeds', value: 1, plant: B.wheat_crop });
item('wheat', { value: 2 });
item('reeds', { value: 1 });
item('herb', { value: 4 });
item('bone', { value: 1 });
item('slime_gel', { value: 3 });
item('feather', { value: 1 });
item('book', { kind: 'misc', stack: 16, value: 10 });
item('coin', { name: 'Gold Coin', kind: 'misc', stack: 999, value: 1 });

// --- food ---------------------------------------------------------------------
const food = (key, heal, value, name, extra = {}) => item(key, { kind: 'food', heal, value, name, ...extra });
food('apple', 2, 2);
food('berries', 1, 1);
food('coconut', 2, 2);
food('carrot', 2, 2);
food('cabbage', 2, 2);
food('mushroom', 1, 1);
food('bread', 4, 4);
food('raw_meat', 1, 3, 'Raw Meat');
food('cooked_meat', 6, 7, 'Roast Meat');
food('fish', 1, 3, 'Raw Fish');
food('cooked_fish', 5, 6, 'Grilled Fish');
food('stew', 7, 8, 'Hearty Stew', { quality: 'acceptable', meal: true });
food('pie', 7, 10, 'Berry Pie');
// Tavern meals: a cook's skill decides which one comes out of the pot.
food('gruel', 2, 3, 'Burnt Gruel', { quality: 'terrible', meal: true });
food('feast', 12, 15, 'Savory Feast', { quality: 'delightful', meal: true });

// --- tools & weapons -----------------------------------------------------------
const TIERS = { wood: [2, 1], stone: [3.2, 2], iron: [5, 3], gold: [7, 2] };
for (const [tier, [speed, dmg]] of Object.entries(TIERS)) {
  const t = tier[0].toUpperCase() + tier.slice(1);
  item(`${tier}_pickaxe`, { name: `${t} Pickaxe`, kind: 'tool', stack: 1, tool: 'pick', speed, damage: 1 + dmg * 0.5, reach: 1.5, cooldown: 0.45, value: 4 * speed });
  item(`${tier}_axe`, { name: `${t} Axe`, kind: 'tool', stack: 1, tool: 'axe', speed, damage: 2 + dmg, reach: 1.5, cooldown: 0.55, value: 4 * speed });
  item(`${tier}_shovel`, { name: `${t} Shovel`, kind: 'tool', stack: 1, tool: 'shovel', speed, damage: 1 + dmg * 0.5, reach: 1.5, cooldown: 0.45, value: 3 * speed });
  item(`${tier}_sword`, { name: `${t} Sword`, kind: 'weapon', stack: 1, damage: 3 + dmg * 1.5, reach: 1.6, cooldown: 0.42, value: 6 * speed });
}
item('spear', { name: 'Iron Spear', kind: 'weapon', stack: 1, damage: 5, reach: 2.6, cooldown: 0.65, value: 20 });
item('club', { name: 'Wooden Club', kind: 'weapon', stack: 1, damage: 3, reach: 1.4, cooldown: 0.5, value: 3 });
item('dagger', { name: 'Dagger', kind: 'weapon', stack: 1, damage: 3, reach: 1.3, cooldown: 0.3, value: 10 });
item('hammer', { name: 'Smith Hammer', kind: 'tool', stack: 1, tool: 'pick', speed: 2.5, damage: 3, reach: 1.4, cooldown: 0.5, value: 12 });
item('hoe', { name: 'Hoe', kind: 'tool', stack: 1, tool: 'shovel', speed: 1.5, damage: 1.5, reach: 1.5, cooldown: 0.5, value: 5 });
item('fishing_rod', { name: 'Fishing Rod', kind: 'tool', stack: 1, damage: 1, reach: 1.5, cooldown: 0.5, value: 8, fishing: true });
item('bow', { name: 'Hunting Bow', kind: 'weapon', stack: 1, damage: 4, reach: 1.2, range: 8, ranged: true, cooldown: 0.9, value: 15 });
item('arrow', { value: 1 });

// --- hobby & trade goods -------------------------------------------------------
item('lute', { kind: 'misc', stack: 1, value: 25 });
item('dice', { kind: 'misc', stack: 8, value: 3 });
item('sketchbook', { kind: 'misc', stack: 1, value: 8 });
item('prayer_beads', { name: 'Prayer Beads', kind: 'misc', stack: 1, value: 6 });
item('pipe', { name: 'Clay Pipe', kind: 'misc', stack: 1, value: 4 });
item('flute', { kind: 'misc', stack: 1, value: 12 });
item('ledger', { kind: 'misc', stack: 1, value: 5 });
item('scroll', { kind: 'misc', stack: 16, value: 6 });
item('ladle', { kind: 'misc', stack: 1, value: 3 });

export function getItem(key) {
  return ITEMS[key];
}

export function itemForBlock(blockId) {
  const b = BLOCKS[blockId];
  return ITEMS[b.name] ? b.name : null;
}

export function maxStack(key) {
  return ITEMS[key] ? ITEMS[key].stack : 64;
}

// Roll a block's drop table into [{item, count}].
export function rollDrops(blockId, rand) {
  const b = BLOCKS[blockId];
  const d = b.drop;
  if (!d) return [];
  if (typeof d === 'string') return ITEMS[d] ? [{ item: d, count: 1 }] : [];
  const out = [];
  for (const e of d) {
    if (e.chance !== undefined && rand() >= e.chance) continue;
    const min = e.min ?? 1;
    const max = e.max ?? min;
    const count = min + Math.floor(rand() * (max - min + 1));
    if (count > 0 && ITEMS[e.item]) out.push({ item: e.item, count });
  }
  return out;
}
