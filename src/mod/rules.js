// The game's rules, as a mod changes them (round 66: the Workshop's Rules
// tab). A mod keeps them as `rules`:
//   { breakSpeed, hearts, ... (the world's: see WORLD_RULES; percents,
//     100 as the game has it), items: { key: { damage, armor, ... } },
//     blocks: { key: { hardness, light, label } }, creatures: { key: {
//     hp, dmg, speed, aggro, name } } }
// (a thing of the mod's own by its '@id'). Several mods' together: their
// percents multiplied, their numbers the last one's.
//
// Nothing imported but the mods' state, so any part of the game can ask
// (see rule); what's put into the game's lists is put in by ruleset.js.
import { MODS } from './state.js';

// [key, name, what it does, unit, as the game has it, lowest, highest].
export const WORLD_RULES = [
  { key: 'breakSpeed', name: 'Breaking blocks', tip: 'How fast blocks break (200: twice as fast).', unit: '%', def: 100, min: 10, max: 2000, group: 'Working' },
  { key: 'drops', name: 'What blocks drop', tip: 'How much a block gives when it\'s broken (200: twice as much).', unit: '%', def: 100, min: 0, max: 1000, group: 'Working' },
  { key: 'growth', name: 'Crops growing', tip: 'How fast crops grow (200: twice as fast).', unit: '%', def: 100, min: 10, max: 2000, group: 'Working' },
  { key: 'hearts', name: 'Hearts to start with', tip: 'A player\'s hearts before their endurance, traits and armour (the game\'s: 10).', unit: '♥', def: 10, min: 1, max: 50, group: 'Players' },
  { key: 'regen', name: 'Health coming back', tip: 'Half a heart back on its own every so many seconds (0: never, as the game has it: food and rest mend you).', unit: 's', def: 0, min: 0, max: 600, group: 'Players' },
  { key: 'walk', name: 'Walking speed', tip: 'How fast players move (150: half again as fast).', unit: '%', def: 100, min: 25, max: 300, group: 'Players' },
  { key: 'breath', name: 'Stamina coming back', tip: 'How fast stamina comes back (200: twice as fast).', unit: '%', def: 100, min: 10, max: 1000, group: 'Players' },
  { key: 'dealt', name: 'Damage players deal', tip: 'How hard players hit (200: twice as hard).', unit: '%', def: 100, min: 0, max: 1000, group: 'Fighting' },
  { key: 'taken', name: 'Damage players take', tip: 'How much a blow on a player hurts (50: half as much).', unit: '%', def: 100, min: 0, max: 1000, group: 'Fighting' },
  { key: 'fall', name: 'Falling hurts', tip: 'How much a long fall hurts (0: not at all).', unit: '%', def: 100, min: 0, max: 1000, group: 'Fighting' },
  { key: 'mobHp', name: 'Creatures\' health', tip: 'How much health every creature has (200: twice as much).', unit: '%', def: 100, min: 10, max: 1000, group: 'Creatures' },
  { key: 'mobDmg', name: 'Damage creatures deal', tip: 'How hard creatures hit (50: half as hard).', unit: '%', def: 100, min: 0, max: 1000, group: 'Creatures' },
  { key: 'spawns', name: 'Creatures out in the wild', tip: 'How many wander about (200: twice as many; 0: none come).', unit: '%', def: 100, min: 0, max: 500, group: 'Creatures' },
  { key: 'day', name: 'Length of a day', tip: 'How long a day lasts (200: twice as long; the game\'s is 24 minutes).', unit: '%', def: 100, min: 10, max: 1000, group: 'The world' },
  { key: 'buy', name: 'What things cost', tip: 'What shops ask (150: half again as much).', unit: '%', def: 100, min: 10, max: 1000, group: 'The world' },
  { key: 'sell', name: 'What they pay you', tip: 'What shops give for what you sell (50: half as much).', unit: '%', def: 100, min: 0, max: 1000, group: 'The world' },
];
export const RULE_OF = Object.fromEntries(WORLD_RULES.map((r) => [r.key, r]));

// What can be changed of an item, a block, a creature: [key, name, kind].
export const ITEM_FIELDS = [['name', 'Name', 'text'], ['damage', 'Damage', 'num'], ['armor', 'Armour (%)', 'num'], ['block', 'Blocks (%, shields)', 'num'], ['cooldown', 'Seconds a swing', 'num'], ['speed', 'Work speed (tools)', 'num'], ['reach', 'Reach', 'num'], ['range', 'Range (bows)', 'num'], ['heal', 'Heals (food)', 'num'], ['stack', 'Stacks to', 'num'], ['value', 'Worth', 'num']];
export const BLOCK_FIELDS = [['label', 'Name', 'text'], ['hardness', 'Hardness', 'num'], ['light', 'Light (0-15)', 'num']];
export const CREATURE_FIELDS = [['name', 'Name', 'text'], ['hp', 'Health', 'num'], ['dmg', 'Damage', 'num'], ['speed', 'Speed (%)', 'num'], ['aggro', 'Sees you from (tiles)', 'num']];

// A world rule as the world's mods have it: a multiplier (1: as the game
// has it), or for hearts and health coming back, a number.
export function rule(k) {
  const R = MODS.rules;
  const v = R ? R[k] : undefined;
  if (v !== undefined) return v;
  return k === 'hearts' ? 10 : k === 'regen' ? 0 : 1;
}
