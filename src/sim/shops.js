// Shopping. Shops don't simply take money in: people who need what they sell
// (a miner whose pick is worn out, a household short of a lantern, someone
// ill wanting a salve) set off to the shop that has it and buy it over the
// counter, and that's where the takings come from. In a town you're in you
// see them walk in; elsewhere it happens all the same.
import { alive, price, st, invAdd, setOverride, freeSlot } from './econ.js';
import { ITEMS } from '../world/items.js';
import { hash4 } from '../util/rng.js';

// What the shop charges over what it paid.
export const MARKUP = 1.2;

// Tools and supplies each trade wears out or uses up.
const TOOLS = {
  miner: ['iron_pickaxe', 'stone_pickaxe', 'torch'], lumberjack: ['iron_axe', 'stone_axe'], farmer: ['hoe', 'seeds', 'bucket'],
  fisher: ['fishing_rod', 'string'], trapper: ['arrow', 'string', 'snare'], builder: ['hammer', 'planks'], carpenter: ['hammer', 'iron_axe'],
  guard: ['arrow', 'iron_sword', 'spear'], laborer: ['bucket', 'planks'], cook: ['bucket'], priest: ['lantern'],
};
const CLOTHES = {
  farmer: ['straw_hat', 'wool_trousers', 'linen_shirt'], trapper: ['leather_tunic', 'leather_boots', 'leather_cap'], fisher: ['wool_hood', 'leather_boots'],
  miner: ['leather_cap', 'leather_boots'], lumberjack: ['leather_boots', 'wool_trousers'],
};
const PLAIN_CLOTHES = ['linen_shirt', 'wool_trousers', 'leather_boots', 'wool_hood', 'linen_shirt_blue', 'linen_shirt_red'];
const FINE_CLOTHES = ['fine_coat', 'fine_coat_purple', 'fine_coat_black', 'gold_circlet', 'linen_shirt_white'];
const HOUSE = ['lantern', 'torch', 'bucket', 'chair', 'table', 'barrel', 'chest', 'rug_red', 'rug_blue', 'stool'];
const REMEDY = ['healing_salve', 'herb', 'potion_vigor'];
const READING = ['book', 'scroll', 'paper', 'ink'];
const ARMOUR = ['iron_helmet', 'chainmail', 'iron_boots', 'iron_greaves', 'iron_breastplate'];
// Weapons and armour with a stone set in them (a guard's sort).
const GUARD_GEAR = ['iron_sword', 'spear', 'bow', 'iron_helmet', 'chainmail', 'iron_breastplate', 'iron_boots', 'iron_greaves'];
let jewelled = null;
export function JEWELLED() {
  return (jewelled ||= Object.keys(ITEMS).filter((k) => ITEMS[k].socket && GUARD_GEAR.includes(ITEMS[k].base)));
}

// Someone puts on or takes up what they bought (a guard's new sword, a
// jewelled helm).
export function equipFor(rec, item) {
  const it = ITEMS[item];
  if (!it) return false;
  if (it.kind === 'armor') {
    (rec.wear ||= {})[it.slot] = item;
    return true;
  }
  if (rec.job === 'guard' && (it.kind === 'weapon' || it.damage)) {
    const eq = (rec.equipment ||= { items: [] });
    eq.items = (eq.items || []).filter((q) => !(ITEMS[q.item] && !!ITEMS[q.item].ranged === !!it.ranged && (ITEMS[q.item].kind === 'weapon')));
    eq.items.push({ item, count: 1 });
    if (!it.ranged) eq.tool = item;
    return true;
  }
  return false;
}

// Somebody who keeps the house (the grown-up with the fullest purse).
function keepsHouse(L, rec) {
  if (rec.home === null || rec.home === undefined) return false;
  const adults = L.npcs.filter((r) => r.home === rec.home && alive(r) && r.age !== 'child' && !r.away);
  return adults.sort((a, b) => b.coins - a.coins)[0] === rec;
}

// What someone wants from the shops, and how often (in days).
export function needsOf(L, rec) {
  const out = [];
  const traits = rec.traits || [];
  if (TOOLS[rec.job]) out.push({ key: 'tool', items: TOOLS[rec.job], every: 6 });
  out.push({ key: 'clothes', items: CLOTHES[rec.job] || PLAIN_CLOTHES, every: 15 });
  if (['noble', 'mayor', 'merchant'].includes(rec.job) || traits.includes('proud') || traits.includes('vain')) out.push({ key: 'fine', items: FINE_CLOTHES, every: 10, spare: 50 });
  // (Badly hurt or sick: off to the herbalist's soon.)
  const hurt = rec.hp !== undefined && rec.maxHp && rec.hp < rec.maxHp * 0.6;
  if (rec.sick || (rec.hp !== undefined && rec.maxHp && rec.hp < rec.maxHp) || rec.age === 'elder') out.push({ key: 'remedy', items: REMEDY, every: rec.sick || hurt ? 1 : 8 });
  if (['scholar', 'priest', 'mayor', 'noble'].includes(rec.job) || (rec.hobbies || []).includes('reading') || traits.includes('bookish')) out.push({ key: 'reading', items: READING, every: 9 });
  if (keepsHouse(L, rec)) out.push({ key: 'house', items: HOUSE, every: 12 });
  if (rec.job === 'guard') {
    out.push({ key: 'armour', items: ARMOUR, every: 12, spare: 30 });
    // Now and then a guard with money to spare treats themselves to
    // something jewelled (it works for them as it would for you).
    out.push({ key: 'jewel', items: JEWELLED(), every: 16, spare: 40 });
  }
  return out;
}

// A shop in town with one of these on its shelves (and someone behind the
// counter): the first thing on the list it has, and who's selling.
export function shopFor(L, items, not = null) {
  const e = L.econ;
  let best = null;
  for (const b of L.buildings) {
    const biz = e.biz[b.id];
    if (!biz || b.underConstruction || b.id === not) continue;
    const keeper = L.npcs.find((r) => alive(r) && !r.away && r.work && r.work.building === b.id && r.age !== 'child');
    if (!keeper) continue;
    const i = items.findIndex((k) => (biz.store[k] || 0) > 0 && ITEMS[k]);
    if (i < 0) continue;
    if (!best || i < best.rank) best = { b, biz, keeper, item: items[i], rank: i };
  }
  // ...or a merchant's stall on the square.
  for (const r of stallKeepers(L)) {
    const store = r.stall || {};
    const i = items.findIndex((k) => (store[k] || 0) > 0 && ITEMS[k]);
    if (i < 0) continue;
    if (!best || i < best.rank) best = { seller: r, keeper: r, store, item: items[i], rank: i };
  }
  return best;
}

// Merchants who sell from a stall, not a shop.
export function stallKeepers(L) {
  return L.npcs.filter((r) => r.job === 'merchant' && alive(r) && !r.away && r.age !== 'child' && r.work && r.work.kind === 'spot');
}

export function costOf(item) {
  return Math.max(1, Math.round(price(item) * MARKUP));
}

// Each morning: who goes shopping today, where, and when (one trip each).
export function planShopping(sim, L, day) {
  if (L.settlement.deserted) return 0;
  let n = 0;
  for (const rec of L.npcs) {
    if (!alive(rec) || rec.away || rec.visitor || rec.migrated || rec.age === 'child' || rec.override || rec.jailed) continue;
    const due = (rec.shopDue ||= {});
    for (const need of needsOf(L, rec)) {
      // (First time round, a day somewhere in the stretch.)
      if (due[need.key] === undefined) due[need.key] = day + (hash4(rec.idx, need.key.length, L.settlement.id) % need.every);
      if (day < due[need.key]) continue;
      const pick = shopFor(L, need.items, rec.work && rec.work.building);
      if (!pick) {
        due[need.key] = day + 2;
        continue;
      }
      const cost = costOf(pick.item);
      if (rec.coins < cost + (need.spare || 0)) {
        due[need.key] = day + 3;
        continue;
      }
      const slot = freeSlot(rec, day, 9 * 60, 60);
      if (!slot) break;
      setOverride(rec, slot.s, slot.e, 'shop', { ...(pick.b ? { building: pick.b.id } : { seller: pick.seller.idx }), item: pick.item, items: need.items, need: need.key, place: 'shop', every: need.every });
      // (Tomorrow again if it doesn't come off; later if it does.)
      due[need.key] = day + 1;
      n++;
      break;
    }
  }
  return n;
}

// Over the counter: the money in the till, the goods in their hands.
export function buyAt(L, rec, o, day) {
  const seller = o.seller !== undefined ? L.npcs[o.seller] : null;
  const biz = seller ? null : L.econ.biz[o.building];
  const store = seller ? (seller.stall ||= {}) : biz && biz.store;
  if (!store || (seller && !alive(seller))) return null;
  const item = (store[o.item] || 0) > 0 ? o.item : (o.items || []).find((k) => (store[k] || 0) > 0);
  if (!item) return { none: true };
  const cost = costOf(item);
  if (rec.coins < cost) return { poor: true, item };
  rec.coins -= cost;
  st.take(store, item, 1);
  if (seller) {
    seller.coins += cost;
    seller.earned = (seller.earned || 0) + cost;
    seller.sales = (seller.sales || 0) + 1;
  } else {
    biz.till += cost;
    biz.earned = (biz.earned || 0) + cost;
    biz.sales = (biz.sales || 0) + 1;
  }
  if (o.need === 'remedy') {
    rec.sick = false;
    if (rec.maxHp) rec.hp = rec.maxHp;
  } else if (!equipFor(rec, item)) invAdd((rec.inv ||= []), item, 1);
  if (rec.shopDue && o.need) rec.shopDue[o.need] = day + (o.every || 7);
  return { item, cost };
}

// ------------------------------------------------------------ merchants
// A merchant's standing: a peddler with a pack, a trader, or a master
// merchant with rare wares and a fatter purse (and trips that pay more).
export const MERCHANT_TIERS = [
  null,
  { title: 'Peddler', coins: 40, profit: 1.15, share: 0.45, goods: ['torch', 'string', 'cloth', 'bread', 'apple', 'arrow', 'bucket'] },
  { title: 'Trader', coins: 90, profit: 1.35, share: 0.6, goods: ['lantern', 'glass', 'iron_ingot', 'iron_pickaxe', 'fishing_rod', 'leather_boots', 'healing_salve', 'book'] },
  { title: 'Master Merchant', coins: 200, profit: 1.6, share: 0.75, goods: ['gem', 'ruby', 'sapphire', 'emerald', 'gold_ingot', 'fine_coat', 'gold_circlet', 'potion_charm', 'potion_vigor', 'chainmail', 'iron_sword+ruby', 'spear+sapphire', 'bow+topaz', 'chainmail+emerald', 'iron_helmet+amethyst'] },
];

export function rollTier(seed) {
  const r = (seed % 100) / 100;
  return r < 0.55 ? 1 : r < 0.87 ? 2 : 3;
}

// The wares a merchant of a tier starts out with: everything the tiers
// below carry, and more of it the higher they are.
export function tierGoods(tier, rng) {
  const out = {};
  for (let t = 1; t <= tier; t++) {
    for (const k of MERCHANT_TIERS[t].goods) {
      if (!ITEMS[k] || !rng.chance(t === tier ? 0.7 : 0.5)) continue;
      st.add(out, k, t === 3 ? 1 : rng.int(1, 1 + tier));
    }
  }
  return out;
}

// What a market stall keeps in stock.
export const STALL_GOODS = ['torch', 'bread', 'apple', 'string', 'cloth', 'lantern', 'bucket', 'seeds', 'arrow', 'fishing_rod', 'linen_shirt', 'leather_boots', 'healing_salve', 'rug_red'];

// A stallholder buys in more when the stall runs low (from their own purse).
export function restockStall(rec, rng) {
  const stall = (rec.stall ||= {});
  const total = Object.values(stall).reduce((n, v) => n + v, 0);
  if (total >= 10 || !rng.chance(0.3)) return 0;
  const T = MERCHANT_TIERS[rec.tier || 1];
  const k = rng.pick([...STALL_GOODS, ...T.goods]);
  if (!ITEMS[k]) return 0;
  const cost = Math.max(1, Math.round(price(k) * 0.45));
  if (rec.coins < cost + 8) return 0;
  rec.coins -= cost;
  st.add(stall, k, 1);
  return 1;
}

// Merchants at home get their standing and their stock.
export function setUpMerchants(L, rng) {
  const e = L.econ;
  for (const rec of L.npcs) {
    if (rec.job !== 'merchant' || rec.tier) continue;
    rec.tier = rollTier(hash4(L.settlement.seed, rec.idx, 0x7e7));
    const T = MERCHANT_TIERS[rec.tier];
    rec.coins = Math.max(rec.coins || 0, Math.round(T.coins * rng.float(0.8, 1.3)));
    const biz = rec.work && rec.work.building != null ? e.biz[rec.work.building] : null;
    const goods = tierGoods(rec.tier, rng);
    // (A stallholder lays out everyday goods as well.)
    if (!biz) for (const k of STALL_GOODS) if (rng.chance(0.5)) st.add(goods, k, rng.int(1, 3));
    for (const [k, n] of Object.entries(goods)) st.add(biz ? biz.store : (rec.stall ||= {}), k, n);
  }
}

export function tierOf(rec) {
  return MERCHANT_TIERS[rec && rec.tier] || null;
}

