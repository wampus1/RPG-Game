// Item registry. Placeable blocks get an item with the same key as the block.
import { BLOCKS, B } from './blocks.js';
import { deriveStarred, softArmor } from './quality.js';
import { deriveDish, deriveRecipe, RECIPE_PREFIX } from './dishes.js';
import { rule } from '../mod/rules.js';

export const ITEMS = {};
// A starred piece of gear ("iron_sword~3dk7.venom": see quality.js), or
// a relic grown with shards ("relic_hearth*3": see grownRelic), is made up
// from its plain one the first time it's asked for, and kept. (Looked for
// only where a key isn't one of the items proper, so the rest cost
// nothing more.)
// (Round 66: likewise a piece set with a stone or a fitting that isn't
// set out below, as a mod's are: "m:mod:blade+ruby"; and one tuned by a
// mod's node, "iron_sword^d3_S1": see tuneKey.)
const STARRED = new Map();
const isStarred = (k) => typeof k === 'string' && (k.includes('~') || k.includes('*') || k.includes('^') || k.includes('+'));
function starred(k) {
  // (A dish cooked up, its make-up in its key, and a recipe for one
  // written on a scroll: see dishes.js.)
  if (!STARRED.has(k)) STARRED.set(k, k.startsWith('dish~') ? deriveDish(k) : k.startsWith(RECIPE_PREFIX) ? deriveRecipe(k) : k.startsWith('note~') ? deriveNote(k) : k.startsWith('bottled~') ? deriveBottled(k) : k.includes('~') ? deriveStarred(k) : k.includes('*') ? deriveGrown(k) : deriveVariant(k));
  return STARRED.get(k) || undefined;
}
// (Mods come and go: what was made up of theirs is forgotten with them.)
export function forgetDerived(prefix = 'm:') {
  for (const k of [...STARRED.keys()]) if (k.startsWith(prefix)) STARRED.delete(k);
}

// ------------------------------------------------------------ tuned pieces
// (Round 66) A piece a mod's node has changed (Item, Change an item): what
// it changes written into its key after a '^', as a stone's is after a
// '+', so it goes wherever an item goes as itself. Each change a letter
// and a number, '_' between: d damage (+), a armour (+ percent), b block
// (+ percent), s work speed (times), w swings (times as fast), r reach
// (+), g range (+), h heals (+), v worth (times), S A E C strength,
// agility, endurance, charisma (+); n its name (hex of its letters).
const TUNES = { d: 'damage', a: 'armor', b: 'block', s: 'speed', w: 'swing', r: 'reach', g: 'range', h: 'heal', v: 'value', S: 'str', A: 'agi', E: 'end', C: 'cha' };
const TUNE_OF = Object.fromEntries(Object.entries(TUNES).map(([k, v]) => [v, k]));
const TUNE_MUL = new Set(['speed', 'swing', 'value']);
export const TUNE_FIELDS = Object.values(TUNES);
const hexOf = (s) => [...new globalThis.TextEncoder().encode(String(s).slice(0, 32))].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => {
  try {
    return new globalThis.TextDecoder().decode(Uint8Array.from((h.match(/../g) || []).map((b) => parseInt(b, 16))));
  } catch {
    return '';
  }
};
// `t`: { damage, armor, ..., name } (anything left at no change left out).
// The piece itself if nothing changes.
export function tuneKey(base, t) {
  const parts = [];
  for (const [field, letter] of Object.entries(TUNE_OF)) {
    const v = +t[field];
    if (!Number.isFinite(v) || v === (TUNE_MUL.has(field) ? 1 : 0)) continue;
    parts.push(`${letter}${Math.round(v * 1000) / 1000}`);
  }
  const nm = String(t.name || '').trim();
  if (nm) parts.push(`n${hexOf(nm)}`);
  return parts.length ? `${base}^${parts.join('_')}` : base;
}
export function parseTune(code) {
  const t = {};
  for (const p of String(code).split('_')) {
    if (!p) continue;
    if (p[0] === 'n') t.name = fromHex(p.slice(1)).slice(0, 32);
    else if (TUNES[p[0]] && Number.isFinite(+p.slice(1))) t[TUNES[p[0]]] = +p.slice(1);
    else return null;
  }
  return t;
}
const rr2 = (n) => Math.round(n * 100) / 100;
function deriveTuned(k, from, code, b) {
  const t = parseTune(code);
  if (!t) return null;
  const d = { ...b, key: k, tuned: t, tunedFrom: from };
  if (t.damage && typeof b.damage === 'number') d.damage = Math.max(0, rr2(b.damage + t.damage));
  if (t.armor && b.kind === 'armor' && b.slot !== 'shield') d.armor = Math.max(0, softArmor(b.slot, Math.round(((b.armor || 0) + t.armor / 100) * 1000) / 1000));
  if (t.block && typeof b.block === 'number') d.block = Math.max(0, Math.min(0.96, Math.round((b.block + t.block / 100) * 1000) / 1000));
  if (t.speed && b.speed) d.speed = rr2(b.speed * Math.max(0.1, t.speed));
  if (t.swing && b.cooldown) d.cooldown = Math.max(0.12, Math.round((b.cooldown / Math.max(0.1, t.swing)) * 1000) / 1000);
  if (t.reach && b.reach) d.reach = Math.max(0.5, rr2(b.reach + t.reach));
  if (t.range && b.range) d.range = Math.max(1, Math.round(b.range + t.range));
  if (t.heal && b.kind === 'food') {
    d.heal = Math.max(0, (b.heal || 0) + t.heal);
    d.regen = Math.max(0, (b.regen || 0) + t.heal);
  }
  if (t.value) d.value = Math.max(0, Math.round((b.value || 1) * t.value));
  const st = { ...(b.stats || {}) };
  let any = false;
  for (const s of ['str', 'agi', 'end', 'cha']) {
    if (!t[s]) continue;
    st[s] = (st[s] || 0) + Math.round(t[s]);
    any = true;
  }
  if (any) d.stats = st;
  if (t.name) d.name = t.name;
  return d;
}

// A set stone or fitting not set out below, or a tuned piece: made up
// from the piece it's of.
function deriveVariant(k) {
  const i = Math.max(k.lastIndexOf('+'), k.lastIndexOf('^'));
  if (i <= 0) return null;
  const from = k.slice(0, i);
  const what = k.slice(i + 1);
  const b = ITEMS[from];
  if (!b) return null;
  if (k[i] === '^') return deriveTuned(k, from, what, b);
  if (GEMS[what]) {
    if (!canSocket(from)) return null;
    const stats = { ...(b.stats || {}) };
    for (const [st, n] of Object.entries(GEMS[what].stats)) stats[st] = (stats[st] || 0) + n;
    return { ...b, key: k, name: `${b.name} (${GEMS[what].name})`, value: b.value + 40, stats, socket: what, base: from };
  }
  if ((what === 'edge' || what === 'plating') && canEnhance(from, what)) {
    const extra = what === 'edge' ? { damage: b.damage + 3 } : { armor: softArmor(b.slot, Math.round((b.armor + 0.05) * 100) / 100), stats: { ...(b.stats || {}), end: ((b.stats || {}).end || 0) + 1 } };
    return { ...b, key: k, name: `${b.name} (${what === 'edge' ? 'Alloy-Edged' : 'Alloy-Plated'})`, value: b.value + 120, enhanced: what, base: from, ...extra };
  }
  return null;
}
Object.setPrototypeOf(ITEMS, new Proxy(Object.prototype, {
  get: (t, k, r) => (isStarred(k) ? starred(k) : Reflect.get(t, k, r)),
  has: (t, k) => (isStarred(k) ? !!starred(k) : Reflect.has(t, k)),
}));

// (Round 52) A story's letter (see sim/saga): "note~<story>~<n>~<kind>".
// What it says is the story's; what it is shows in its name.
const NOTES = {
  letter: ['Sealed Letter', 'letter'], ransom: ['Ransom Note', 'letter'], orders: ['Written Orders', 'dispatch'], map: ['Rough Map', 'scroll'],
  confession: ['Signed Confession', 'scroll'], warrant: ['Warrant', 'dispatch'], contract: ['Blood Contract', 'scroll'], will: ['Last Will', 'scroll'],
  deed: ['Deed', 'scroll'], list: ['List of Names', 'scroll'], plea: ['Desperate Letter', 'letter'], invite: ['Invitation', 'letter'], token: ['Pardon', 'dispatch'],
};
function deriveNote(k) {
  const [, th, n, kind] = String(k).split('~');
  const [name, icon] = NOTES[kind] || NOTES.letter;
  return { key: k, kind: 'note', name, icon, stack: 1, value: 0, noSell: true, note: { th: +th, n: +n, kind: kind || 'letter' }, about: 'Read it [F/RMB].' };
}

// (Round 69) A ship of yours put in a bottle (see shipgame.js): "bottled~
// <type>~<n>~<her name in hex>". What was aboard her is kept with the
// world (game.shipBottles[n]); her name shows when you look at it.
export function bottledKey(type, n, name) {
  return `bottled~${type}~${n}~${hexOf(name || '')}`;
}
function deriveBottled(k) {
  const [, type, n, hex] = String(k).split('~');
  const base = ITEMS[`ship_${type}`];
  if (!base) return undefined;
  const name = fromHex(hex || '');
  return { ...base, key: k, value: Math.round(base.value * 0.8), shipPrice: undefined, bottled: +n, shipName: name, about: `${name || 'A ship of yours'}, in a bottle, and everyone who was aboard her with her (her crew, whoever came with you), and all her stores. Right-click by open water to uncork her and launch her again, just as she was.` };
}

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
  // (What's built into dungeons stays there.)
  'barrow_stone', 'barrow_earth', 'crypt_brick', 'crypt_floor', 'mine_rock', 'mine_beam', 'cave_rock', 'bones', 'coffin', 'sarcophagus',
  'pressure_plate', 'arrow_slit', 'lever', 'portcullis', 'portcullis_up', 'cracked_floor', 'weak_wall', 'sealed_door', 'stairs_down',
  'stairs_up', 'brazier', 'barrow_door', 'sinkhole', 'mine_shaft', 'cave_mouth', 'rubble_seal', 'kav_pillar', 'kav_door', 'kav_lift',
  'kav_wall', 'kav_floor', 'kav_glow', 'kav_debris', 'kav_field', 'kav_console', 'kav_plate', 'kav_node', 'kav_seal', 'kav_cache',
  'kav_emitter', 'relic', 'kav_lamp', 'kav_pylon', 'kav_basin', 'sail', 'helm',
  'cobweb', 'urn', 'candles', 'statue', 'skull_pile', 'mine_cart', 'stalagmite', 'glowshroom', 'war_banner', 'hanging_chains',
  'powder_keg', 'roots', 'rubble', 'bone_throne', 'boss_gate', 'boss_gate_open', 'kav_gate', 'gong',
  'kav_keystone', 'void_bloom', 'glow_crystal', 'tendril', 'eye_stalk', 'leaves_void',
  'kav_statue', 'kav_monolith', 'kav_holo', 'kav_conduit', 'kav_husk', 'kav_vent', 'satchel', 'spikes', 'idol', 'blight_floor', 'blight_wall',
  // (The other islands' ground: what it gives when it's dug is its own.)
  'lava', 'steam_vent', 'scorched', 'moss', 'mycelium', 'peat', 'sulfur_crust', 'mushroom_stem', 'mushroom_cap', 'glowcap_cap',
  // (The great things in the squares, and what the islands' learning puts
  // up about their towns.)
  'fountain', 'heartfire', 'heart_crystal', 'great_glowcap', 'conch_fountain', 'plinth', 'glass_lamp', 'ember_gutter', 'fog_lantern',
  // (Round 68: the far peoples' great things.)
  'triumph_column', 'frost_hearth', 'bell_pagoda', 'sun_wheel', 'jaw_arch', 'salt_obelisk', 'lantern_tree', 'stone_ring', 'beacon',
  // (And the ways into their old places.)
  'catacomb_door', 'vault_door', 'gut_mouth', 'salt_door', 'warren_hole', 'mound_door', 'broch_door',
  // (Round 71: and the ancient places'.)
  'athanor_door', 'champion_door', 'rift_door', 'gullet_mouth',
  // (What a great ship's built of: mended with planks, not taken away whole.)
  'hull_planks', 'deck_planks', 'ship_rail', 'gunport', 'stern_window', 'gilt_trim', 'ship_mast', 'copper_sheath', 'ship_cannon', 'hammock', 'ship_pump', 'capstan',
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
// From Kharos and Myrrow: yellow sulphur (the Ashborn trade it for black
// powder), turves of peat that burn slow and long, and flakes of black
// glass.
item('sulfur', { name: 'Sulphur', value: 3 });
item('peat_turf', { name: 'Peat Turf', value: 2, fuel: true });
item('obsidian_shard', { name: 'Obsidian Shard', value: 4 });
// Shaken from a gloam moth's wings: it glows a while in the hand.
item('moth_dust', { name: 'Gloam Dust', value: 4 });
// The islands' own trades (see isletrades.js): flour from a Thessan
// windmill; pearls from the Stiltfolk's shallows, and strings of them.
item('flour', { name: 'Sack of Flour', value: 4 });
item('pearl', { name: 'Pearl', value: 16 });
item('pearl_necklace', { name: 'Pearl Necklace', kind: 'misc', stack: 8, value: 70 });

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
// The other Dagoni Islands' peoples: the Ashborn of Kharos bake their bread
// in the hot ash and stew everything with fire-peppers; the moor folk of
// Myrrow live on what grows in the dark and the stilt folk on what the
// shallows give.
food('pepper_stew', 7, 8, 'Fire-Pepper Stew', { quality: 'acceptable', region: 'ember' });
food('ash_bread', 4, 5, 'Ash-Baked Bread', { region: 'ember' });
food('mushroom_broth', 6, 6, 'Mushroom Broth', { quality: 'acceptable', region: 'mist' });
food('glowcap_tea', 3, 5, 'Glowcap Tea', { region: 'mist' });
food('crab_boil', 7, 8, 'Crab Boil', { quality: 'acceptable', region: 'tide' });
food('kelp_cakes', 4, 4, 'Kelp Cakes', { region: 'tide' });
// (Round 68) The far lands' peoples' (see world/farlands.js): the Velari's
// fish-sauce stew and olive bread, the Rimeborn's roast reindeer and
// cloudberry cakes, the Jade Court's dumplings and jasmine tea, the
// Keshari's chili squash and blue corn, the Bonewrights' whale stew and
// bannocks, the Saltfolk's shrimp soup and salt fish, the Hollowfolk's
// root stew and glowberry tart, the Wyrdfolk's seer's stew and heather
// bread, the Skerrymen's fish pie and seaweed crisps.
food('garum_stew', 7, 8, 'Garum Fish Stew', { quality: 'acceptable', region: 'velari' });
food('olive_bread', 4, 5, 'Olive Bread and Figs', { region: 'velari' });
food('reindeer_roast', 8, 8, 'Roast Reindeer', { quality: 'acceptable', region: 'rime' });
food('cloudberry_cakes', 4, 6, 'Cloudberry Cakes', { region: 'rime' });
food('dumplings', 7, 8, 'Steamed Dumplings', { quality: 'acceptable', region: 'jade' });
food('jasmine_tea', 3, 5, 'Jasmine Tea', { region: 'jade' });
food('chili_squash', 7, 7, 'Chili Squash', { quality: 'acceptable', region: 'kesh' });
food('blue_corn_cakes', 4, 5, 'Blue Corn Cakes', { region: 'kesh' });
food('whale_stew', 8, 8, 'Whale Stew', { quality: 'acceptable', region: 'corrow' });
food('oat_bannock', 4, 4, 'Oat Bannock', { region: 'corrow' });
food('shrimp_soup', 6, 7, 'Pink Shrimp Soup', { quality: 'acceptable', region: 'salt' });
food('salt_fish', 4, 5, 'Salt Fish', { region: 'salt' });
food('root_stew', 6, 7, 'Cave-Root Stew', { quality: 'acceptable', region: 'hollow' });
food('glowberry_tart', 4, 6, 'Glowberry Tart', { region: 'hollow' });
food('seer_stew', 6, 7, 'Seer\'s Stew', { quality: 'acceptable', region: 'wyrd' });
food('heather_bread', 4, 5, 'Heather Bread', { region: 'wyrd' });
food('fish_pie', 7, 8, 'Fish Pie', { quality: 'acceptable', region: 'skerry' });
food('seaweed_crisps', 3, 4, 'Seaweed Crisps', { region: 'skerry' });
// What the far lands grow (see blocks.js): olives, grapes, cherries,
// cactus fruit, glowberries, lantern pods; and bamboo, salt and frost
// crystals to work with.
food('olives', 1, 2, 'Olives');
food('grapes', 1, 3, 'Grapes');
food('cherries', 1, 2, 'Cherries');
food('cactus_fruit', 1, 3, 'Cactus Fruit');
food('glowberries', 1, 3, 'Glowberries');
food('lantern_pod', 1, 1, 'Lantern Pod');
item('bamboo_cane', { name: 'Bamboo Cane', kind: 'misc', stack: 64, value: 1 });
item('salt', { name: 'Salt', kind: 'misc', stack: 64, value: 3 });
item('frost_crystal', { name: 'Frost Crystal', kind: 'misc', stack: 32, value: 9, about: 'A shard of ice that never melts. The Rimeborn burn them in their frost hearths.' });
item('antler', { name: 'Antler', kind: 'misc', stack: 16, value: 6 });
item('tiger_pelt', { name: 'Tiger Pelt', kind: 'misc', stack: 8, value: 30 });
item('pink_feather', { name: 'Pink Feather', kind: 'misc', stack: 32, value: 4 });
item('scorpion_sting', { name: 'Scorpion Sting', kind: 'misc', stack: 16, value: 8 });
// What grows (and swims) there.
food('ember_pod', 1, 2, 'Ember Pod');
food('mangrove_pod', 1, 1, 'Mangrove Pod');
food('glowcap', 1, 3, 'Glowcap');
food('crab_meat', 1, 3, 'Crab Meat');
food('cooked_crab', 5, 6, 'Cooked Crab');
// Hot dishes from the pot (and a warm cup) do their good slowly: a little
// at once, the rest over the next while, and more in all than anything
// eaten cold. [now, over time, seconds it takes]
const SLOW = { stew: [2, 10, 20], pottage: [1, 9, 18], chowder: [2, 10, 20], spiced_lentils: [1, 9, 18], goulash: [2, 10, 20], tamales: [2, 7, 14], cocoa: [0, 6, 12], ale: [1, 3, 8],
  pepper_stew: [2, 10, 20], mushroom_broth: [1, 9, 18], glowcap_tea: [0, 6, 12], crab_boil: [2, 10, 20],
  garum_stew: [2, 10, 20], reindeer_roast: [2, 11, 22], dumplings: [2, 10, 20], jasmine_tea: [0, 6, 12], chili_squash: [2, 9, 18], whale_stew: [2, 11, 22],
  shrimp_soup: [1, 9, 18], root_stew: [1, 9, 18], seer_stew: [1, 9, 18], fish_pie: [2, 10, 20] };
for (const [k, [now, over, secs]] of Object.entries(SLOW)) Object.assign(ITEMS[k], { heal: now + over, now: Math.max(1, Math.min(3, now)), regen: now + over - Math.max(1, Math.min(3, now)), regenT: secs });
// (Round 50: nothing heals more than a little at once. A bite does 1 to 3
// at once and the rest of its good over the next few seconds, faster than
// a hot dish's slow warmth.) See also healSplit, for dishes cooked up.
export function healSplit(heal, slowSecs = null) {
  const now = Math.min(heal, heal >= 8 ? 3 : heal >= 4 ? 2 : heal);
  const regen = heal - now;
  return { now, regen, regenT: regen ? slowSecs ?? Math.max(3, Math.round(regen * 1.2)) : 0 };
}
for (const [k, d] of Object.entries(ITEMS)) if (d.kind === 'food' && !SLOW[k] && d.heal > 0) Object.assign(d, healSplit(d.heal));

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
// The island arms: an Ashborn blade of knapped black glass bound to a
// cinderwood haft (keen, light, quick), and the stilt folk's barbed
// harpoon (a spear that bites deep).
item('obsidian_blade', { name: 'Obsidian Blade', kind: 'weapon', stack: 1, damage: 6, reach: 1.5, cooldown: 0.36, value: 30, heft: 0.85 });
item('harpoon', { name: 'Barbed Harpoon', kind: 'weapon', stack: 1, damage: 5.5, reach: 2.6, cooldown: 0.66, value: 22, style: 'spear' });
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
// (Round 68) The great ships (see world/shipmodels.js): bought at a
// harbour's shipwright (a sloop can be built at a workbench), launched on
// open water; shot for their guns; a sailor signed on.
item('cannonball', { name: 'Cannonball', kind: 'misc', stack: 32, value: 3, about: 'Iron shot for a ship\'s gun, a shot a fire. An anvil makes four from an iron ingot, a lump of sulphur and a coal; a harbour\'s shipwright sells them.' });
item('sailors_articles', { name: 'Sailor\'s Articles', kind: 'misc', stack: 8, value: 45, about: 'A sailor\'s mark on the ship\'s articles: right-click aboard a ship of your own and they join her crew (more hands sail her better, man her guns, pump her and mend her). Talk to a hand of yours for orders.' });
// (Round 69) Every ship comes in a bottle, and goes back into one: she
// comes out of it with no crew (sign them on), and at a fixed price, 750
// to 5,000 coins by her kind.
for (const [type, name, cost, about] of [
  ['sloop', 'Sloop', 750, 'A sloop in a bottle: right-click by open water to uncork her and launch her. One mast, four guns, quick to turn. She comes with no crew: sign sailors on with Sailor\'s Articles (or sail her alone).'],
  ['brigantine', 'Brigantine', 1800, 'A brigantine in a bottle: right-click by open water to uncork her and launch her. Square sails forward, a great gaff sail aft, eight guns. She comes with no crew: sign sailors on with Sailor\'s Articles.'],
  ['galleon', 'Galleon', 3500, 'A galleon in a bottle: right-click by open water to uncork her and launch her. A towering castle of a ship, a deep hold, twenty guns; slow to turn. She comes with no crew: sign sailors on with Sailor\'s Articles.'],
  ['frigate', 'Frigate', 5000, 'A frigate in a bottle: right-click by open water to uncork her and launch her. The fastest thing on the sea, eighteen guns. She comes with no crew: sign sailors on with Sailor\'s Articles.'],
]) item(`ship_${type}`, { name: `${name} in a Bottle`, kind: 'tool', stack: 1, value: cost, shipPrice: cost, shipKit: type, about });
item('ship_bottle', { name: 'Ship Bottle', kind: 'tool', stack: 4, value: 60, shipBottle: true, about: 'A great empty bottle, blown by a shipwright\'s craft to hold a ship. Right-click beside a ship of your own (or aboard her) and she\'s in it, everyone aboard her with her.' });
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
// (Round 56: no set of armour, with anything else that turns blows, past
// four-fifths.)
export const ARMOR_CAP = 0.8;
const wear = (key, name, slot, armor, value, look, extra = {}) => item(key, { name, kind: 'armor', stack: 1, slot, armor, value, look, ...extra });
wear('leather_cap', 'Leather Cap', 'head', 0.04, 10, 'lcap');
wear('iron_helmet', 'Iron Helmet', 'head', 0.1, 40, 'helmet');
wear('straw_hat', 'Straw Hat', 'head', 0, 4, 'straw');
wear('wool_hood', 'Wool Hood', 'head', 0.02, 8, 'hood');
wear('gold_circlet', 'Gold Circlet', 'head', 0, 60, 'circlet');
// Blown in a Kharos glassworks: the mountain's ash can't blind you.
wear('ash_goggles', 'Smoked-Glass Goggles', 'head', 0, 24, 'goggles', { ashproof: true });
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
  // (A starred piece keeps its stars: the stone goes in before them.)
  const i = base.indexOf('~');
  return i < 0 ? `${base}+${gem}` : `${base.slice(0, i)}+${gem}${base.slice(i)}`;
}
export function canSocket(key) {
  if (key && key.includes('~')) return canSocket(key.slice(0, key.indexOf('~')));
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
// A light carried in the off hand (where a shield or second blade would
// be): a torch, a lantern, the Kavorent's Everlight.
export function offhandLight(key) {
  return key === 'torch' || key === 'lantern' || key === 'kav_everlight';
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
// A Mirefolk sporewright's tincture of glowcap: the dark goes grey and
// clear for a few hours.
potion('spore_tincture', 'Fogsight Tincture', 20, { sight: true, hours: 4 });

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
// Shards of crystal from the Kavorent's halls, in each stone's colour.
export const SHARD_GEMS = Object.keys(GEMS);
for (const k of SHARD_GEMS) item(`shard_${k}`, { name: `${GEMS[k].name} Shard`, kind: 'shard', stack: 64, value: GEMS[k].rare ? 22 : 13, shard: k, color: GEMS[k].color, about: `Five fuse into a whole ${GEMS[k].name.toLowerCase()} at a jeweller's bench (or a jeweller will buy them).` });

// --- from below ---------------------------------------------------------------------
// What dungeons give up (see world/dungeongen.js): old coin (good silver,
// if an odd stamp), plans for things nobody's built in a hundred years, a
// sigil for a sealed door, and relics: things of power that work on all
// round them wherever they're set down (see game/relics.js).
item('old_coin', { name: 'Old Coins', kind: 'misc', stack: 64, value: 0.5, exchange: 2, about: 'Stamped with kings nobody remembers. Any merchant will change them: two of them for a gold coin.' });
item('old_blueprint', { name: 'Old Blueprint', kind: 'misc', stack: 8, value: 30, about: 'Plans for works long forgotten. A mayor would pay well for them, and the town\'s builders and thinkers would learn from them.' });
item('sigil', { name: 'Bronze Sigil', kind: 'misc', stack: 8, value: 0, noSell: true, about: 'The key to a sealed door, down below.' });
item('kav_key', { name: 'Glyph Key', kind: 'misc', stack: 8, value: 0, noSell: true, about: 'A shard of light in a frame of alloy: it opens a Kavorent vault.' });
// A relic's power, and the colour of its circle.
export const RELICS = {
  hearth: { name: 'Hearthstone', color: '#ffb050', about: 'Wounds close a little, slowly, for everyone near it.' },
  vigil: { name: 'Vigil Lamp', color: '#fff0a0', about: 'No night thing comes within its circle, and the dead are weakened near it.' },
  breath: { name: 'Windcharm', color: '#70f0c8', about: 'Breath comes back twice as fast to everyone near it.' },
  ward: { name: 'Warding Idol', color: '#70a8ff', about: 'Blows land a fifth lighter on everyone near it.' },
  fury: { name: 'War Totem', color: '#ff5050', about: 'Blows struck near it land a fifth harder.' },
  harvest: { name: 'Seed of Plenty', color: '#90e050', about: 'Crops near it grow twice as fast.' },
};
for (const [k, r] of Object.entries(RELICS)) item(`relic_${k}`, { name: r.name, kind: 'relic', stack: 1, value: 90, relic: k, plant: B.relic, color: r.color, about: `${r.about} (Set it down to use it; pick it up again any time.)` });
// Relic shards: what a master of an old place leaves of the power it kept
// about it (one to three). One set into a relic in your pack makes its
// circle reach half a pace further, for good, up to eight of them.
export const SHARD_MAX = 8;
export const SHARD_REACH = 0.5;
item('relic_shard', { name: 'Relic Shard', kind: 'relic_shard', stack: 16, value: 30, color: '#e0b8ff', about: `A splinter of the power a master of the deep kept about it. Used from your belt, it sinks into a relic in your pack: that relic's circle reaches half a pace further, for good (up to ${SHARD_MAX} shards to a relic).` });
// A relic with `n` shards set in it ("relic_hearth*3").
export function grownRelic(kind, n = 0) {
  const k = `relic_${kind}`;
  return n > 0 ? `${k}*${Math.min(SHARD_MAX, n)}` : k;
}
function deriveGrown(key) {
  const m = /^(relic_[a-z]+)\*([1-9])$/.exec(key);
  const base = m && ITEMS[m[1]];
  const n = m ? +m[2] : 0;
  if (!base || !base.relic || n > SHARD_MAX) return null;
  return { ...base, key, plain: m[1], shards: n, name: `${base.name} +${n}`, value: base.value + 20 * n };
}

// --- the Kavorent's ---------------------------------------------------------------
// Scrap of their alloy (a smith can make iron of it, and good iron), the
// cores that powered their halls (a mayor will pay a fortune for one: the
// town's thinkers can learn from it what nobody else alive knows), and
// shards of crystal in a gem's colours (five fuse into a whole stone).
item('kav_scrap', { name: 'Kavorent Scrap', kind: 'material', stack: 64, value: 14, about: 'Dark, light, unbelievably hard. A smith can work it into iron.' });
// (Round 61) Time crystals: what a master leaves when it falls, of its
// tier. Used at the way into a beaten place, they turn it back to what it
// was before anyone went down, a tier harder (and richer) than the crystal:
// see game/timecrystal.js.
for (const t of [1, 2, 3]) {
  item(`time_crystal_${t}`, {
    name: `Time Crystal (Tier ${['', 'I', 'II', 'III'][t]})`, kind: 'time_crystal', tier: t, stack: 4, value: [0, 300, 700, 1500][t], color: ['', '#9ad8ff', '#c8a0ff', '#ffd070'][t],
    about: `It ticks, very softly, out of time with everything. Hold it at the way into an old place whose master is beaten and use it (right-click): the place turns back to what it was, at tier ${['', 'II', 'III', 'III'][t]}: harder, its master stronger, its chests richer.`,
  });
}
item('kav_core', { name: 'Kavorent Core', kind: 'misc', stack: 8, value: 450, about: 'A heavy sphere with a slow light turning inside it. Give it to a mayor: with it, a realm can begin to learn the Kavorent\'s arts.' });
// (Their shards are made with the stones, above.)
// The rarest finds: their arms and armour, things they made to carry, and
// fittings that make what you have better than it was.
item('kav_blade', { name: 'Phase Blade', kind: 'weapon', stack: 1, damage: 10, reach: 1.7, cooldown: 0.36, value: 380, heft: 0.8, pierce: 0.6, kav: true, about: 'Its edge is never quite where it seems: it slips past shields and through armour.' });
item('kav_lance', { name: 'Arc Lance', kind: 'weapon', stack: 1, damage: 9, reach: 2.6, cooldown: 0.7, value: 420, hands: 2, style: 'halberd', kav: true, lance: true, about: 'Each thrust throws a lance of light that strikes everything in a line, four paces out.' });
item('kav_caster', { name: 'Pulse Caster', kind: 'weapon', stack: 1, damage: 6, reach: 1.2, range: 10, ranged: true, cooldown: 0.6, value: 460, hands: 2, ammo: 'none', kav: true, about: 'Needs no arrows: it draws on your breath, and looses bolts of light.' });
const kwear = (key, name, slot, armor, value, extra = {}) => item(key, { name, kind: 'armor', stack: 1, slot, armor, value, look: 'kav', kav: true, ...extra });
kwear('kav_visor', 'Kavorent Visor', 'head', 0.12, 260, { stats: { cha: 1 }, about: 'You see in the dark a little, wearing it.' });
kwear('kav_carapace', 'Kavorent Carapace', 'body', 0.28, 520, { stats: { end: 2 }, about: 'Light as cloth, hard as nothing forged.' });
kwear('kav_greaves', 'Kavorent Greaves', 'legs', 0.14, 300, { stats: { agi: 1 } });
kwear('kav_treads', 'Kavorent Treads', 'feet', 0.07, 220, { stats: { agi: 1 }, about: 'Your steps are quicker and make no sound.' });
kwear('kav_aegis', 'Aegis Projector', 'shield', 0, 480, { block: 0.95, about: 'Raised, it throws up a wall of light: arrows go no further.' });
// Gadgets: used from your belt (F, or the right mouse button).
const gadget = (key, name, value, about, extra = {}) => item(key, { name, kind: 'gadget', stack: 1, value, about, kav: true, ...extra });
gadget('kav_blink', 'Blink Shard', 320, 'Use it and you\'re six paces away, toward where you point, in an instant. It takes a few seconds to gather itself again.', { charge: 4 });
gadget('kav_everlight', 'Everlight', 180, 'A cold, steady light that never goes out. Hold it, or carry it in your off hand.', { light: 13 });
gadget('kav_mender', 'Mending Cell', 300, 'Use it to mend 12 health over a few seconds. Three uses; it fills again each dawn.', { uses: 3 });
gadget('kav_bulwark', 'Field Projector', 340, 'Use it to throw up a wall of light in front of you for eight seconds: nothing gets through.', { charge: 20 });
gadget('kav_lodestar', 'Lodestar', 160, 'Use it and it points the way: below ground, to the way down; above, to the nearest place of old stone you haven\'t yet beaten.', { charge: 2 });
gadget('overseer_eye', 'The Overseer\'s Eye', 900, 'The great eye of the Kavorent\'s last warden, still burning. Use it and its beam pours out toward where you point for four seconds, burning all it touches and setting the floor alight; then it must gather itself again (half a minute).', { charge: 30, light: 4 });
// (Round 72) What the evolved masters leave (see game/evolvedgear.js):
// used from your belt like the Kavorent's gadgets, each a thing of its
// master's power.
const relicGadget = (key, name, value, color, about, extra = {}) => item(key, { name, kind: 'gadget', stack: 1, value, color, about, evolved: true, ...extra });
relicGadget('alchemist_hand', 'Hand of the Great Work', 1800, '#ffd060', 'The Divine Alchemist\'s hand, twelve-fingered, still turning. Use it and a ring of its element breaks out of the ground three paces round you, burning, freezing, eating or striking whoever stands in it: fire, then frost, then acid, then lightning, each use the next. It gathers itself again in nine seconds.', { charge: 9 });
relicGadget('rift_needle', 'The Crawler\'s Needle', 1800, '#c8a0ff', 'A spine of the Rift Crawler\'s, cold as nothing. Use it once and it marks where you stand; use it again, elsewhere, and it tears a rift between the mark and you, for twenty seconds: step into either end and you come out of the other (so does anything else). Six seconds to gather itself after.', { charge: 6 });
relicGadget('hero_gauntlet', 'The Champion\'s Gauntlet', 1800, '#ffe070', 'The Hero\'s own gauntlet, the curse gone out of it. Use it and for twelve seconds you have his strength: your blows land half again as hard and rend whoever else is before you, and what lands on you lands lighter by a third. Forty seconds to gather itself again.', { charge: 40 });
relicGadget('worm_tooth', 'The Alinelidan\'s Tooth', 1800, '#c8f080', 'A tooth of the World-Worm, as long as your forearm. Use it and you go down into the ground as it did, and come up under where you point, up to eight paces off and through anything between: whoever is there is thrown back and bitten, and the hole you leave is full of its acid. Fourteen seconds to gather itself again.', { charge: 14 });
// Fittings: set into a weapon, or a piece of armour, for good.
item('kav_edge', { name: 'Alloy Edge', kind: 'enhancer', stack: 4, value: 220, kav: true, fits: 'weapon', about: 'Fit it to a weapon (use it with the weapon in your belt): +3 to every blow, for good.' });
item('kav_plating', { name: 'Alloy Plating', kind: 'enhancer', stack: 4, value: 240, kav: true, fits: 'armor', about: 'Fit it to a piece of armour you wear (use it): it turns a twentieth more of each blow, and adds a point of endurance.' });

// --- hobby & trade goods -------------------------------------------------------
// Instruments (round 51): held, the right button (or F) plays them (see
// game/instruments.js), each on its own keys.
const PLAY = 'Hold it and press F (or the right button) to play: its keys play its notes.';
item('lute', { kind: 'misc', stack: 1, value: 25, instrument: true, about: `Plucked strings: the home row, A to ;. ${PLAY}` });
item('lyre', { name: 'Lyre', kind: 'misc', stack: 1, value: 30, instrument: true, about: `Harp strings on a frame: the number keys, 1 to 8. ${PLAY}` });
item('fiddle', { name: 'Fiddle', kind: 'misc', stack: 1, value: 34, instrument: true, about: `Bowed strings: the bottom row, Z to /. ${PLAY}` });
item('hand_drum', { name: 'Hand Drum', kind: 'misc', stack: 1, value: 14, instrument: true, about: `Hide on a wooden frame: F to K, from a boom to a shake. ${PLAY}` });
item('hunting_horn', { name: 'Hunting Horn', kind: 'misc', stack: 1, value: 20, instrument: true, about: `A horn's five notes: 1 to 5. ${PLAY}` });
item('dice', { kind: 'misc', stack: 8, value: 3 });
// For a household's locked chest (see ui/lockpick.js). Holdout thieves
// carry them; four are beaten out of an iron ingot at an anvil.
item('lockpick', { name: 'Lockpick', kind: 'misc', stack: 16, value: 4, about: 'A thin steel pick and a tension wrench. Use one on a locked chest: flick the pins up and turn as each one meets the shear line. A slip strains it; too many and it snaps.' });
// A holdout bombarder's (see monsters.js): lit and thrown where you point
// (right button), it goes up a moment after it lands.
item('dynamite', { name: 'Dynamite', kind: 'misc', stack: 8, value: 8, about: 'A stick of blasting powder with a fuse. Right-click to light it and throw it where you point: it goes up a moment after it lands, and hurts whoever is near.' });
item('sketchbook', { kind: 'misc', stack: 1, value: 8 });
item('prayer_beads', { name: 'Prayer Beads', kind: 'misc', stack: 1, value: 6 });
item('pipe', { name: 'Clay Pipe', kind: 'misc', stack: 1, value: 4, about: 'Hold it and press F (or the right button) for a smoke.' });
item('flute', { kind: 'misc', stack: 1, value: 12, instrument: true, about: `A wooden flute: the top row, Q to P. ${PLAY}` });
item('ledger', { kind: 'misc', stack: 1, value: 5 });
item('scroll', { kind: 'misc', stack: 16, value: 6, about: 'A blank scroll. Use it (F or the right button) to copy a recipe you know onto it, to sell to a cook or give away.' });
item('ladle', { kind: 'misc', stack: 1, value: 3 });
// Tokens of the player's standing: not wanted by any trader.
item('guard_badge', { name: 'Guard Badge', kind: 'misc', stack: 1, value: 0, noSell: true });
item('letter', { name: 'Sealed Letter', kind: 'misc', stack: 16, value: 0, noSell: true });
item('dispatch', { name: 'Mayor\'s Dispatch', kind: 'misc', stack: 16, value: 0, noSell: true });
// (Round 54) Proof of a term passed at a city's Academy (see sim/college.js).
item('diploma', { name: 'Academy Diploma', kind: 'misc', stack: 4, value: 0, noSell: true, about: 'Rolled parchment, the Academy\'s seal at the foot of it: proof you sat a term and passed. Frame it, or show it off.' });
// (Round 52: see sim/saga.) The key to an outlaws' cage; goods taken on the
// road, to carry to a fence; a token of an outlaw band's that you ride with
// them; proof of a deed done.
item('cage_key', { name: 'Cage Key', kind: 'misc', stack: 1, value: 0, noSell: true, about: 'Iron, heavy, warm from an outlaw\'s pocket. It opens the cage at their camp.' });
item('stolen_goods', { name: 'Bundle of Stolen Goods', kind: 'misc', stack: 8, value: 0, noSell: true, about: 'Silver plate, a lady\'s rings, a merchant\'s ledger: wrapped in sacking and tied. Take it to the fence.' });
item('outlaw_token', { name: 'Outlaw\'s Token', kind: 'misc', stack: 1, value: 0, noSell: true, about: 'A coin cut in half and strung on a cord. Outlaws who know it let you by.' });
item('trophy', { name: 'Trophy', kind: 'misc', stack: 8, value: 30, about: 'Proof of a hunt: a tooth, a claw, a lock of grey fur. Folk will pay to see it, or to have it.' });
item('heirloom', { name: 'Heirloom', kind: 'misc', stack: 1, value: 25, noSell: true, about: 'Old silver, worn smooth. Somebody misses this.' });
item('holy_relic', { name: 'Holy Relic', kind: 'misc', stack: 1, value: 60, noSell: true, about: 'A saint\'s bone in a silver box. It belongs in a temple.' });
item('cure', { name: 'Fever Cure', kind: 'potion', stack: 8, value: 18, effect: { heal: 4 }, about: 'Bitter, green, and it works. Give it to someone with the fever (or drink it yourself).' });

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
    let count = min + Math.floor(rand() * (max - min + 1));
    // (Round 66: as much as the world's mods have blocks give.)
    const k = rule('drops');
    if (k !== 1) count = Math.floor(count * k + rand());
    if (count > 0 && ITEMS[e.item]) out.push({ item: e.item, count });
  }
  return out;
}

// A weapon or a piece of armour with a Kavorent fitting set into it (its
// own key, like a set stone: "iron_sword+edge"), made here for everything
// that can take one. (Before the stones, so a fitted piece can take one too.)
export function enhanced(key, kind) {
  // (A starred piece keeps its stars: the fitting goes in before them.)
  const i = key.indexOf('~');
  return i < 0 ? `${key}+${kind}` : `${key.slice(0, i)}+${kind}${key.slice(i)}`;
}
export function canEnhance(key, kind) {
  if (key && key.includes('~')) return canEnhance(key.slice(0, key.indexOf('~')), kind);
  const it = ITEMS[key];
  if (!it || it.socket || it.enhanced || it.uniform || it.thrown) return false;
  if (kind === 'edge') return it.kind === 'weapon' && !it.ranged;
  if (kind === 'plating') return it.kind === 'armor' && it.slot !== 'shield' && it.armor > 0;
  return false;
}
// (Round 73) A weapon that takes both hands hits harder than it did: two
// to four more a blow (the heavier and slower, the more), so it holds its
// own against a light blade in each hand. (Before the alloyed and
// gem-set kinds below are made from it.)
export const TWO_HAND_BONUS = (it) => (!it || it.hands !== 2 || it.ranged || !it.damage ? 0 : (it.cooldown || 0.5) >= 0.88 ? 4 : (it.cooldown || 0.5) >= 0.6 ? 3 : 2);
for (const key of Object.keys(ITEMS)) {
  const it = ITEMS[key];
  const n = TWO_HAND_BONUS(it);
  if (n) ITEMS[key] = { ...it, damage: it.damage + n };
}

for (const key of Object.keys(ITEMS)) {
  for (const kind of ['edge', 'plating']) {
    if (!canEnhance(key, kind)) continue;
    const b = ITEMS[key];
    const extra = kind === 'edge' ? { damage: b.damage + 3 } : { armor: softArmor(b.slot, Math.round((b.armor + 0.05) * 100) / 100), stats: { ...(b.stats || {}), end: ((b.stats || {}).end || 0) + 1 } };
    ITEMS[enhanced(key, kind)] = { ...b, key: enhanced(key, kind), name: `${b.name} (${kind === 'edge' ? 'Alloy-Edged' : 'Alloy-Plated'})`, value: b.value + 120, enhanced: kind, base: key, ...extra };
  }
}

// (Last, so every weapon and piece of armour above can take a gem.)
registerSockets();

// (Round 66) A piece changed (by a mod's rules): its stones and fittings,
// set out above, made again from it as it is now.
export function rebuildVariants(key) {
  const b = ITEMS[key];
  if (!b) return;
  for (const k of Object.keys(ITEMS)) {
    const v = ITEMS[k];
    if (!v || k === key || v.base !== key) continue;
    if (v.socket && GEMS[v.socket]) {
      const stats = { ...(b.stats || {}) };
      for (const [st, n] of Object.entries(GEMS[v.socket].stats)) stats[st] = (stats[st] || 0) + n;
      ITEMS[k] = { ...b, key: k, name: `${b.name} (${GEMS[v.socket].name})`, value: b.value + 40, stats, socket: v.socket, base: key };
    } else if (v.enhanced === 'edge' || v.enhanced === 'plating') {
      const extra = v.enhanced === 'edge' ? { damage: b.damage + 3 } : { armor: softArmor(b.slot, Math.round((b.armor + 0.05) * 100) / 100), stats: { ...(b.stats || {}), end: ((b.stats || {}).end || 0) + 1 } };
      ITEMS[k] = { ...b, key: k, name: `${b.name} (${v.enhanced === 'edge' ? 'Alloy-Edged' : 'Alloy-Plated'})`, value: b.value + 120, enhanced: v.enhanced, base: key, ...extra };
    } else continue;
    rebuildVariants(k);
  }
}
