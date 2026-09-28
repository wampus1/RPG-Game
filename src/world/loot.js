// Container loot, rolled deterministically from a container's position and
// the kind of building it sits in.
import { mulberry32, hash4 } from '../util/rng.js';
import { ITEMS } from './items.js';

export const CONTAINER_SIZE = { chest: 18, barrel: 9, crate: 9 };

const TABLES = {
  house: [['bread', 3, 1, 3], ['apple', 3, 1, 4], ['coin', 3, 2, 12], ['cloth', 1, 1, 2], ['torch', 2, 2, 5], ['carrot', 2, 1, 4], ['stick', 1, 2, 6], ['book', 0.4, 1, 1], ['pie', 0.5, 1, 1], ['wood_sword', 0.2, 1, 1], ['seeds', 1, 2, 6]],
  tavern: [['bread', 3, 2, 5], ['stew', 2, 1, 2], ['cooked_meat', 2, 1, 3], ['apple', 2, 2, 5], ['coin', 2, 4, 15], ['dice', 1, 1, 2], ['berries', 2, 2, 6]],
  shop: [['coin', 2, 5, 20], ['torch', 2, 4, 10], ['cloth', 2, 1, 4], ['string', 1, 2, 5], ['bread', 2, 1, 4], ['glass', 1, 2, 6], ['book', 1, 1, 2], ['lantern', 0.4, 1, 1], ['stone_pickaxe', 0.4, 1, 1], ['fishing_rod', 0.3, 1, 1]],
  smithy: [['iron_ingot', 3, 1, 4], ['coal', 3, 3, 10], ['iron_ore', 2, 1, 4], ['iron_sword', 0.4, 1, 1], ['iron_pickaxe', 0.4, 1, 1], ['stone_axe', 0.6, 1, 1], ['gold_ingot', 0.3, 1, 2], ['hammer', 0.3, 1, 1]],
  bakery: [['bread', 4, 3, 8], ['wheat', 3, 4, 12], ['pie', 2, 1, 3], ['coin', 1, 2, 8]],
  temple: [['book', 2, 1, 2], ['prayer_beads', 1, 1, 1], ['coin', 3, 5, 20], ['scroll', 2, 1, 3], ['torch', 1, 2, 5]],
  library: [['book', 4, 1, 4], ['scroll', 3, 1, 4], ['sketchbook', 0.5, 1, 1], ['coin', 1, 2, 8]],
  townhall: [['coin', 4, 10, 40], ['ledger', 1, 1, 1], ['scroll', 2, 1, 3], ['gem', 0.3, 1, 1], ['gold_ingot', 0.4, 1, 2]],
  guardhouse: [['iron_sword', 0.6, 1, 1], ['spear', 0.6, 1, 1], ['bread', 2, 1, 3], ['torch', 2, 2, 6], ['coin', 1, 3, 10], ['cooked_meat', 1, 1, 2]],
  tailor: [['cloth', 4, 2, 8], ['string', 3, 2, 8], ['leather', 2, 1, 3], ['coin', 1, 3, 10]],
  workshop: [['planks', 4, 6, 20], ['stick', 3, 4, 12], ['fence', 1, 2, 6], ['chair', 1, 1, 2], ['wood_axe', 0.5, 1, 1]],
  herbalist: [['herb', 4, 2, 8], ['mushroom', 2, 1, 4], ['berries', 2, 2, 6], ['seeds', 1, 2, 6], ['coin', 1, 2, 8]],
  warehouse: [['planks', 3, 8, 24], ['cobblestone', 3, 8, 24], ['wheat', 2, 4, 12], ['cloth', 1, 1, 4], ['coal', 2, 3, 10], ['iron_ore', 1, 1, 4], ['sand', 1, 4, 12]],
  barn: [['wheat', 4, 4, 16], ['seeds', 3, 4, 12], ['carrot', 2, 2, 6], ['cabbage', 1, 1, 3], ['hoe', 0.3, 1, 1], ['leather', 1, 1, 3]],
  manor: [['coin', 4, 20, 60], ['gold_ingot', 1, 1, 3], ['gem', 0.6, 1, 2], ['book', 2, 1, 3], ['pie', 2, 1, 2], ['dagger', 0.3, 1, 1]],
  ruins: [['coin', 2, 2, 20], ['bone', 3, 1, 4], ['string', 2, 1, 5], ['gem', 0.3, 1, 1], ['iron_ingot', 1, 1, 2], ['scroll', 1, 1, 2], ['stone_sword', 0.4, 1, 1], ['gold_ingot', 0.3, 1, 1]],
};

export function buildingKind(type) {
  if (!type) return null;
  if (type.startsWith('house')) return 'house';
  return type;
}

export function rollContainerLoot(world, x, y, z, blockName, settlement) {
  const size = CONTAINER_SIZE[blockName] || 9;
  const slots = new Array(size).fill(null);
  if (!settlement) return slots; // containers in the wild (or placed by the player) start empty
  const layout = world.getLayout(settlement);
  const b = layout.buildings.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
  if (b && b.playerHome) return slots;
  let kind = settlement.condition === 'abandoned' ? 'ruins' : buildingKind(b ? b.type : null) || 'house';
  const table = TABLES[kind] || TABLES.house;
  const rand = mulberry32(hash4(x, y, z, world.seed ^ 0x100f));
  const rolls = 2 + Math.floor(rand() * (size > 9 ? 5 : 3));
  const wealth = { prosperous: 1.5, normal: 1, poor: 0.5, abandoned: 1 }[settlement.condition] || 1;
  for (let i = 0; i < rolls; i++) {
    let total = 0;
    for (const e of table) total += e[1];
    let r = rand() * total;
    let pick = table[0];
    for (const e of table) {
      if ((r -= e[1]) <= 0) {
        pick = e;
        break;
      }
    }
    const [item, , min, max] = pick;
    if (!ITEMS[item]) continue;
    let count = min + Math.floor(rand() * (max - min + 1));
    if (item === 'coin') count = Math.max(1, Math.round(count * wealth));
    const slot = Math.floor(rand() * size);
    if (!slots[slot]) slots[slot] = { item, count: Math.min(count, ITEMS[item].stack) };
  }
  return slots;
}
