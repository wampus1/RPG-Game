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
  'cobweb', 'well', 'altar', 'statue', 'campfire', 'gravestone', 'cell_door', 'cell_door_open', 'cell_door_top', 'farmland_wet', 'bell', 'canopy',
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
item('seeds', { name: 'Wheat Seeds', value: 1, plant: B.wheat_crop });
item('cabbage_seeds', { name: 'Cabbage Seeds', value: 1, plant: B.cabbage_crop });
item('wheat', { value: 2 });
item('reeds', { value: 1 });
item('herb', { value: 4 });
item('bone', { value: 1 });
item('slime_gel', { value: 3 });
item('feather', { value: 1 });
item('book', { kind: 'misc', stack: 16, value: 10 });
item('coin', { name: 'Gold Coin', kind: 'misc', stack: 999, value: 1 });
// What's left of a tavern meal, waiting to be cleared away.
item('dirty_dish', { name: 'Dirty Dish', kind: 'misc', stack: 16, value: 0 });

// --- food ---------------------------------------------------------------------
const food = (key, heal, value, name, extra = {}) => item(key, { kind: 'food', heal, value, name, ...extra });
food('apple', 2, 2);
food('berries', 1, 1);
food('coconut', 2, 2);
food('carrot', 2, 2, 'Carrot', { plant: B.carrot_crop });
food('cabbage', 2, 2);
food('mushroom', 1, 1);
food('bread', 4, 4);
food('raw_meat', 1, 3, 'Raw Meat');
food('cooked_meat', 6, 7, 'Roast Meat');
// Poured at the tavern (and left as an empty mug on the table after).
food('ale', 2, 4, 'Mug of Ale');
item('empty_mug', { name: 'Empty Mug', kind: 'misc', stack: 16, value: 0 });
food('fish', 1, 3, 'Raw Fish');
food('cooked_fish', 5, 6, 'Grilled Fish');
food('stew', 7, 8, 'Hearty Stew', { quality: 'acceptable', meal: true });
food('pie', 7, 10, 'Berry Pie');
// Tavern meals: a cook's skill decides which one comes out of the pot.
food('gruel', 2, 3, 'Burnt Gruel', { quality: 'terrible', meal: true });
food('feast', 12, 15, 'Savory Feast', { quality: 'delightful', meal: true });
// Each people's own dishes (see culture.js): a hot pot from the tavern,
// and something to carry.
food('pottage', 6, 6, 'Herb Pottage', { quality: 'acceptable', region: 'vale' });
food('apple_tart', 4, 6, 'Apple Tart', { region: 'vale' });
food('chowder', 7, 7, 'Fish Chowder', { quality: 'acceptable', region: 'north' });
food('smoked_fish', 4, 5, 'Smoked Herring', { region: 'north' });
food('spiced_lentils', 6, 6, 'Spiced Lentils', { quality: 'acceptable', region: 'sun' });
food('flatbread', 4, 5, 'Flatbread and Dates', { region: 'sun' });
food('tamales', 6, 7, 'Maize Tamales', { quality: 'acceptable', region: 'wild' });
food('cocoa', 3, 5, 'Cup of Cocoa', { region: 'wild' });
food('goulash', 7, 7, 'Mountain Goulash', { quality: 'acceptable', region: 'high' });
food('oatcakes', 4, 4, 'Oatcakes', { region: 'high' });

// --- tools & weapons -----------------------------------------------------------
const TIERS = { wood: [2, 1], stone: [3.2, 2], iron: [5, 3], gold: [7, 2] };
for (const [tier, [speed, dmg]] of Object.entries(TIERS)) {
  const t = tier[0].toUpperCase() + tier.slice(1);
  item(`${tier}_pickaxe`, { name: `${t} Pickaxe`, kind: 'tool', stack: 1, tool: 'pick', speed, damage: 1 + dmg * 0.5, reach: 1.5, cooldown: 0.45, value: 4 * speed });
  item(`${tier}_axe`, { name: `${t} Axe`, kind: 'tool', stack: 1, tool: 'axe', speed, damage: 2 + dmg, reach: 1.5, cooldown: 0.55, value: 4 * speed });
  item(`${tier}_shovel`, { name: `${t} Shovel`, kind: 'tool', stack: 1, tool: 'shovel', speed, damage: 1 + dmg * 0.5, reach: 1.5, cooldown: 0.45, value: 3 * speed });
  item(`${tier}_sword`, { name: `${t} Sword`, kind: 'weapon', stack: 1, damage: 3 + dmg * 1.5, reach: 1.6, cooldown: 0.42, value: 6 * speed, heft: tier === 'stone' ? 1.1 : tier === 'gold' ? 0.95 : 1 });
}
// Forged by smiths of a realm that knows steelworking (see tech.js).
item('steel_sword', { name: 'Steel Sword', kind: 'weapon', stack: 1, damage: 9, reach: 1.7, cooldown: 0.4, value: 48, heft: 0.9 });
item('spear', { name: 'Iron Spear', kind: 'weapon', stack: 1, damage: 5, reach: 2.6, cooldown: 0.65, value: 20 });
item('club', { name: 'Wooden Club', kind: 'weapon', stack: 1, damage: 3, reach: 1.4, cooldown: 0.5, value: 3 });
// A fire-hardened point: what a watch carries before it has a forge.
item('wooden_spear', { name: 'Wooden Spear', kind: 'weapon', stack: 1, damage: 3.5, reach: 2.6, cooldown: 0.65, value: 5 });
item('dagger', { name: 'Dagger', kind: 'weapon', stack: 1, damage: 3, reach: 1.3, cooldown: 0.3, value: 10 });
item('mace', { name: 'Iron Mace', kind: 'weapon', stack: 1, damage: 4.5, reach: 1.4, cooldown: 0.6, value: 22, heft: 1.15 });
// More arms. One-handed ones leave the other arm free for a shield, or a
// second blade; two-handed ones (`hands: 2`) take both, so no shield and
// nothing in the off hand while one's out. `heft` is how slow it is to
// swing beside others of its kind (1: middling), and `style` how it's
// fought with, where the name doesn't say (see combat.js).
item('short_sword', { name: 'Short Sword', kind: 'weapon', stack: 1, damage: 4, reach: 1.4, cooldown: 0.34, value: 16, heft: 0.82 });
item('sabre', { name: 'Curved Sabre', kind: 'weapon', stack: 1, damage: 5.5, reach: 1.6, cooldown: 0.38, value: 32, heft: 0.9 });
item('hand_axe', { name: 'Hand Axe', kind: 'weapon', stack: 1, damage: 5, reach: 1.4, cooldown: 0.5, value: 14, heft: 0.85 });
item('flail', { name: 'Iron Flail', kind: 'weapon', stack: 1, damage: 5.5, reach: 1.5, cooldown: 0.62, value: 28, style: 'flail' });
item('quarterstaff', { name: 'Quarterstaff', kind: 'weapon', stack: 1, damage: 3.5, reach: 1.8, cooldown: 0.45, value: 6, hands: 2, style: 'staff' });
item('greatsword', { name: 'Greatsword', kind: 'weapon', stack: 1, damage: 10, reach: 1.8, cooldown: 0.85, value: 72, hands: 2, style: 'great' });
item('battle_axe', { name: 'Battle Axe', kind: 'weapon', stack: 1, damage: 11, reach: 1.6, cooldown: 0.95, value: 60, hands: 2, style: 'great', heft: 1.1 });
item('warhammer', { name: 'War Hammer', kind: 'weapon', stack: 1, damage: 9, reach: 1.6, cooldown: 0.9, value: 55, hands: 2, style: 'maul' });
item('halberd', { name: 'Halberd', kind: 'weapon', stack: 1, damage: 8, reach: 2.6, cooldown: 0.85, value: 50, hands: 2, style: 'halberd' });
item('hammer', { name: 'Smith Hammer', kind: 'tool', stack: 1, tool: 'pick', speed: 2.5, damage: 3, reach: 1.4, cooldown: 0.5, value: 12 });
item('hoe', { name: 'Hoe', kind: 'tool', stack: 1, tool: 'shovel', speed: 1.5, damage: 1.5, reach: 1.5, cooldown: 0.5, value: 5 });
item('bucket', { name: 'Wooden Bucket', kind: 'tool', stack: 1, value: 4, bucket: true });
item('water_bucket', { name: 'Bucket of Water', kind: 'tool', stack: 1, value: 4, bucket: true, water: 3 });
item('raft', { name: 'Raft', kind: 'tool', stack: 1, value: 16, raft: true });
// Tack for a horse of your own, and a wagon for it to pull.
item('saddle', { name: 'Saddle', kind: 'misc', stack: 1, value: 35 });
item('wagon', { name: 'Wagon', kind: 'misc', stack: 1, value: 60 });
// A rope lead, to lead an animal about or tie it up at a fence.
item('lead', { name: 'Lead', kind: 'misc', stack: 8, value: 6 });
item('fishing_rod', { name: 'Fishing Rod', kind: 'tool', stack: 1, damage: 1, reach: 1.5, cooldown: 0.5, value: 8, fishing: true });
item('bow', { name: 'Hunting Bow', kind: 'weapon', stack: 1, damage: 4, reach: 1.2, range: 8, ranged: true, cooldown: 0.9, value: 15, hands: 2 });
item('arrow', { value: 1 });
// Further, harder or cheaper than a hunting bow: a longbow (far and hard,
// slow to draw), a crossbow (bolts that punch through; slow to wind), a
// sling (river stones, or any cobble), and javelins (thrown, and picked up
// again where they land).
item('longbow', { name: 'Longbow', kind: 'weapon', stack: 1, damage: 6, reach: 1.2, range: 11, ranged: true, cooldown: 1.25, value: 34, hands: 2 });
item('crossbow', { name: 'Crossbow', kind: 'weapon', stack: 1, damage: 9, reach: 1.2, range: 10, ranged: true, cooldown: 1.9, value: 58, hands: 2, ammo: 'bolt' });
item('bolt', { name: 'Crossbow Bolt', value: 2 });
// What a bow (or crossbow, or sling) shoots.
export const ammoOf = (key) => (key && ITEMS[key] && ITEMS[key].ammo) || 'arrow';
item('sling', { name: 'Sling', kind: 'weapon', stack: 1, damage: 3, reach: 1.2, range: 7, ranged: true, cooldown: 0.75, value: 6, ammo: 'cobblestone' });
item('javelin', { name: 'Javelin', kind: 'weapon', stack: 6, damage: 7, reach: 1.2, range: 7, ranged: true, thrown: true, cooldown: 1.0, value: 9, ammo: 'javelin' });

// --- armour & clothes ----------------------------------------------------------
// Worn in one of four places. `armor` is the share of each blow it takes
// off (the pieces add up, to at most 60%); `look` is how it shows on you.
export const WEAR_SLOTS = ['head', 'body', 'legs', 'feet', 'shield'];
export const ARMOR_CAP = 0.6;
const wear = (key, name, slot, armor, value, look, extra = {}) => item(key, { name, kind: 'armor', stack: 1, slot, armor, value, look, ...extra });
wear('leather_cap', 'Leather Cap', 'head', 0.04, 10, 'lcap');
wear('iron_helmet', 'Iron Helmet', 'head', 0.1, 40, 'helmet');
wear('straw_hat', 'Straw Hat', 'head', 0, 4, 'straw');
wear('wool_hood', 'Wool Hood', 'head', 0.02, 8, 'hood');
wear('gold_circlet', 'Gold Circlet', 'head', 0, 60, 'circlet');
wear('leather_tunic', 'Leather Tunic', 'body', 0.1, 24, 'leather');
wear('chainmail', 'Chainmail Shirt', 'body', 0.18, 70, 'chain');
wear('iron_breastplate', 'Iron Breastplate', 'body', 0.26, 110, 'plate');
wear('linen_shirt', 'Linen Shirt', 'body', 0, 8, 'linen');
wear('fine_coat', 'Fine Coat', 'body', 0.03, 45, 'coat');
wear('leather_trousers', 'Leather Trousers', 'legs', 0.06, 16, 'leather');
wear('iron_greaves', 'Iron Greaves', 'legs', 0.12, 60, 'plate');
wear('wool_trousers', 'Wool Trousers', 'legs', 0.01, 8, 'cloth');
wear('leather_boots', 'Leather Boots', 'feet', 0.03, 12, 'leather');
wear('iron_boots', 'Iron Boots', 'feet', 0.06, 35, 'iron');
// Shields go on the other arm: nothing off a blow you don't see coming,
// most of one you do (hold the right mouse button to raise it).
wear('wooden_shield', 'Wooden Shield', 'shield', 0, 14, 'wood', { block: 0.7 });
wear('iron_shield', 'Iron Shield', 'shield', 0, 45, 'iron', { block: 0.88 });
wear('round_shield', 'Painted Round Shield', 'shield', 0, 26, 'round', { block: 0.78 });
// The watch's uniform, issued to anyone sworn in as a guard: a mail shirt
// under a tabard in the colours of the civilization (plain red in a free
// town), a helm and boots. A look written "kind:#colour" is tinted.
export const TABARDS = { crimson: '#c8323c', azure: '#2f6fd0', verdant: '#3c9a48', gilded: '#e0b030', violet: '#8a4ab8', free: '#b03030' };
for (const [k, c] of Object.entries(TABARDS)) wear(`tabard_${k}`, `${k[0].toUpperCase()}${k.slice(1)} Guard Tabard`, 'body', 0.16, 30, `tabard:${c}`, { uniform: true, noSell: true });
wear('guard_helm', 'Guard Helm', 'head', 0.08, 25, 'helmet', { uniform: true, noSell: true });
wear('guard_boots', 'Guard Boots', 'feet', 0.04, 12, 'iron', { uniform: true, noSell: true });

// Every weapon and piece of armour can carry one set gem: those are items of
// their own ("iron_sword+ruby"), made here once everything else exists.
export function socketed(base, gem) {
  return `${base}+${gem}`;
}
export function canSocket(key) {
  const it = ITEMS[key];
  return !!it && !it.socket && !it.uniform && !it.thrown && (it.kind === 'weapon' || it.kind === 'armor' || (it.kind === 'tool' && it.damage >= 3 && /_(sword|axe)$/.test(key)));
}

// Two hands to hold it (no shield, nothing in the off hand).
export function twoHanded(key) {
  const it = key && ITEMS[key];
  return !!it && it.hands === 2;
}

// Can it be carried in the off hand, a second blade where a shield would
// be? (One-handed, and for close work.)
export function offhandable(key) {
  const it = key && ITEMS[key];
  return !!it && it.kind === 'weapon' && !it.ranged && it.hands !== 2;
}
export function registerSockets() {
  for (const key of Object.keys(ITEMS)) {
    if (!canSocket(key)) continue;
    const base = ITEMS[key];
    for (const [g, gd] of Object.entries(GEMS)) {
      const stats = { ...(base.stats || {}) };
      for (const [st, n] of Object.entries(gd.stats)) stats[st] = (stats[st] || 0) + n;
      ITEMS[socketed(key, g)] = { ...base, key: socketed(key, g), name: `${base.name} (${gd.name})`, value: base.value + 40, stats, socket: g, base: key };
    }
  }
}

// The tabard for a settlement's watch.
export function tabardFor(s) {
  const k = s && s.civ ? s.civ.color.name.toLowerCase() : 'free';
  return TABARDS[k] ? `tabard_${k}` : 'tabard_free';
}

// --- tailored clothes ------------------------------------------------------------
// Dyed at a tailor's loom: good cloth, well cut and in a fine colour, and
// people warm to you (each piece adds to your charisma while worn).
export const DYES = { red: '#c83a32', blue: '#2f5fc0', yellow: '#d8a828', green: '#3c8a40', purple: '#7a3aa8', black: '#2e2a34', white: '#ece8dc' };
export const DYE_FROM = { red: 'flower_red', blue: 'flower_blue', yellow: 'flower_yellow', green: 'herb', purple: 'flower_purple', black: 'coal', white: 'flower_white' };
export const DYEABLE = { linen_shirt: 1, wool_trousers: 1, wool_hood: 1, fine_coat: 3 };
for (const [g, cha] of Object.entries(DYEABLE)) {
  const base = ITEMS[g];
  const kind = String(base.look).split(':')[0];
  for (const [c, hexc] of Object.entries(DYES)) {
    wear(`${g}_${c}`, `${c[0].toUpperCase()}${c.slice(1)} ${base.name}`, base.slot, base.armor, base.value + 8 + cha * 4, `${kind}:${hexc}`, { stats: { cha }, tailored: true, dyed: c, dyeOf: g });
  }
}

// --- potions --------------------------------------------------------------------
// Brewed at an herbalist's still. Vigor gives extra (blue) hearts until the
// day ends; the others raise one of your abilities for a few hours.
const potion = (key, name, value, effect) => item(key, { name, kind: 'potion', stack: 8, value, effect });
potion('potion_vigor', 'Draught of Vigor', 16, { blue: 4 });
potion('potion_might', 'Potion of Might', 18, { stat: 'str', n: 2, hours: 3 });
potion('potion_swiftness', 'Potion of Swiftness', 18, { stat: 'agi', n: 2, hours: 3 });
potion('potion_fortitude', 'Potion of Fortitude', 18, { stat: 'end', n: 2, hours: 4 });
potion('potion_charm', 'Philtre of Charm', 20, { stat: 'cha', n: 2, hours: 4 });
potion('healing_salve', 'Healing Salve', 10, { heal: 8 });
// For a fight, an hour or three: deeper breath (more stamina), a second
// wind (it comes back faster), a fury (harder blows) and quicksilver (quicker
// ones).
potion('potion_breath', 'Tonic of Deep Breath', 22, { combat: 'breath', n: 5, hours: 3 });
potion('potion_wind', 'Second Wind Elixir', 22, { combat: 'wind', n: 0.8, hours: 3 });
potion('potion_fury', 'Berserker\'s Brew', 26, { combat: 'fury', n: 0.35, hours: 2 });
potion('potion_haste', 'Quicksilver Draught', 26, { combat: 'haste', n: 0.35, hours: 2 });

// --- the scribe's trade -----------------------------------------------------------
item('paper', { value: 2 });
item('ink', { name: 'Pot of Ink', value: 3, stack: 16 });
// Printed at a scribe's desk from the events they've recorded: the latest
// edition is what every copy says (see the Press in sim.js).
item('newspaper', { name: 'Newspaper', kind: 'misc', stack: 32, value: 2, newspaper: true });

// --- the jeweller's trade -----------------------------------------------------------
// Cut from a rough gem, then set into a weapon or a piece of armour (a
// delicate job: see the setting at a jeweller's bench). Each stone raises an
// ability; set in a weapon, it also gives the blade a gift of its own.
export const GEMS = {
  ruby: { name: 'Ruby', color: '#e0304a', stats: { str: 1 }, about: 'Fire: a flaming swing, burning arrows, armour that sets attackers alight' },
  sapphire: { name: 'Sapphire', color: '#3060e0', stats: { agi: 1 }, about: 'Frost: quicker blades and arrows that chill, armour that slows attackers' },
  emerald: { name: 'Emerald', color: '#30c060', stats: { end: 1 }, about: 'Life: hits that mend you, armour that closes wounds' },
  topaz: { name: 'Topaz', color: '#e8b830', stats: { cha: 1 }, about: 'Lightning: blows that arc, arrows that dazzle, armour that blinds attackers' },
  amethyst: { name: 'Amethyst', color: '#a050e0', stats: { end: 1 }, about: 'Force: staggering blows and arrows, armour that turns blows back' },
  // Rarer stones (one rough gem in several cuts to one of these): `color`
  // is the light they give off, `body` the stone itself.
  onyx: { name: 'Onyx', color: '#9a6ad8', body: '#241c30', stats: { agi: 1 }, rare: true, about: 'Shadow: blows echoed by your shade, arrows that split, armour that slips you out of sight' },
  moonstone: { name: 'Moonstone', color: '#bcd8ff', body: '#e4ecf6', stats: { cha: 1 }, rare: true, about: 'Moonlight: crescents of light thrown off your blade, arrows that mark, armour that glows and wards you' },
  bloodstone: { name: 'Bloodstone', color: '#e83848', body: '#2c5236', stats: { str: 1 }, rare: true, about: 'Blood: wounds that bleed, and armour that hits harder the closer you are to death' },
};
for (const [k, g] of Object.entries(GEMS)) item(k, { name: g.name, kind: 'gem', stack: 16, value: g.rare ? 110 : 70, gem: true });

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
// Tokens of the player's standing: not wanted by any trader.
item('guard_badge', { name: 'Guard Badge', kind: 'misc', stack: 1, value: 0, noSell: true });
item('letter', { name: 'Sealed Letter', kind: 'misc', stack: 16, value: 0, noSell: true });
item('dispatch', { name: 'Mayor\'s Dispatch', kind: 'misc', stack: 16, value: 0, noSell: true });

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

// (Last, so every weapon and piece of armour above can take a gem.)
registerSockets();
