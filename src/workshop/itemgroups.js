// What kind of thing each of the game's items is, for the Workshop's lists
// (round 65: its blocks last, where they no longer fill the list before
// any item gets into it). No page needed: the tests read it too.
import { ITEMS } from '../world/items.js';

export const ITEM_GROUPS = ['Weapons', 'Tools', 'Armour', 'Food & potions', 'Materials & gems', 'Other things', 'Blocks'];
export function itemGroup(k) {
  const d = ITEMS[k] || {};
  const kd = d.kind;
  if (kd === 'weapon') return 'Weapons';
  if (kd === 'tool') return 'Tools';
  if (kd === 'armor') return 'Armour';
  if (kd === 'food' || kd === 'potion') return 'Food & potions';
  if (kd === 'material' || kd === 'gem' || kd === 'shard') return 'Materials & gems';
  if (kd === 'block') return 'Blocks';
  return 'Other things';
}
