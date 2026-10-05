// Cooking, in play (round 50): what a dish does once it's eaten, the
// conditions on it, and the cooks of the towns cooking the same way (with
// what they keep in, buy from the farmers, the fishers and the traders,
// and the recipes they keep of their best). What a dish is: see
// world/dishes.js; cooking one yourself: see ui/cook.js.
import { ITEMS } from '../world/items.js';
import { TYPES, CONDS, FX, baseOf, cookDish, parseDish, dishKey, COOK_STATIONS, RECIPE_PREFIX } from '../world/dishes.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addItem, removeItem } from './inventory.js';

const nowOf = (g) => g.day * 1440 + g.minute;
// (No more than this many dishes working on you at once: the newest.)
export const DISH_MAX = 3;

// ------------------------------------------------------------ conditions
const worn = (p) => Object.values(p.equip || {}).filter(Boolean).map((k) => ITEMS[k]).filter(Boolean);
const NATURAL = new Set(['stone', 'dirt', 'gravel', 'sand', 'clay', 'cobblestone', 'basalt', 'granite', 'deepslate', 'coal_ore', 'iron_ore', 'gold_ore', 'gem_ore']);
export const COND_TEST = {
  metal: (g, p) => worn(p).some((d) => d.kind === 'armor' && /iron|steel|gold|chain|mail|plate|bronze|copper|kav/.test(d.key)),
  leather: (g, p) => worn(p).some((d) => /leather|hide|fur/.test(d.key)),
  night: (g) => !g.isDay(),
  day: (g) => g.isDay(),
  hurt: (g, p) => p.hp < p.maxHp * 0.5,
  hale: (g, p) => p.hp >= p.maxHp * 0.75,
  armed: (g, p) => {
    const h = p.heldDef ? p.heldDef() : null;
    return !!(h && (h.kind === 'weapon' || (h.damage || 0) > 2));
  },
  town: (g, p) => !!(g.world.ow.settlementAt && g.world.ow.settlementAt(p.x, p.z)),
  wild: (g, p) => !g.dungeon && !(g.world.ow.settlementAt && g.world.ow.settlementAt(p.x, p.z)),
  deep: (g) => !!g.dungeon,
  under: (g, p) => {
    if (g.dungeon) return true;
    let n = 0;
    for (let y = p.y + 2; y < p.y + 12; y++) {
      const b = BLOCKS[g.world.getBlock(p.x, y, p.z)];
      if (b && NATURAL.has(b.name)) n++;
    }
    return n >= 3;
  },
  rain: (g) => !!(g.weather && /rain|storm/.test(g.weather.kind || '')),
  dry: (g) => !(g.weather && /rain|storm|snow/.test(g.weather.kind || '')),
  water: (g, p) => {
    if (p.inWater) return true;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (g.world.isWaterAt(p.x + dx, p.y, p.z + dz) || g.world.isWaterAt(p.x + dx, p.y - 1, p.z + dz)) return true;
    return false;
  },
  fight: (g, p) => g.sim.abs - (p.fightAt ?? -99) < 0.2,
};

// Does the condition on dish `d` hold for player `p` just now?
export function condHolds(g, p, d) {
  if (!d || !d.cond) return true;
  const c = TYPES[d.cond] && TYPES[d.cond].cond;
  const f = c && COND_TEST[c];
  try {
    return f ? !!f(g, p) : true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ what it does
// The dishes working on `p` now: [{ key, until, def }].
export function dishBuffs(p, now = p.game ? nowOf(p.game) : 0) {
  return (p.buffs || []).filter((q) => q.dish && q.until > now).map((q) => ({ ...q, def: ITEMS[q.dish] })).filter((q) => q.def && q.def.dish);
}

// How much of effect `k` the dishes `p` has eaten are giving them just now
// (those whose condition holds), worked out once a frame.
export function dishFx(p, k) {
  const g = p && p.game;
  if (!g || !p.buffs || !p.buffs.length) return 0;
  const frame = g.frameNo || 0;
  let c = p._dishFx;
  if (!c || c.frame !== frame) {
    const sums = {};
    for (const q of dishBuffs(p)) {
      const D = q.def.dish;
      if (!condHolds(g, p, D)) continue;
      for (const e of D.effects) sums[e.k] = (sums[e.k] || 0) + e.n;
    }
    c = p._dishFx = { frame, sums };
  }
  return c.sums[k] || 0;
}

// Eaten: it starts working (and if it's one already working, starts again).
export function eatDish(game, p, def) {
  const D = def && def.dish;
  if (!D) return null;
  const now = nowOf(game);
  p.buffs = (p.buffs || []).filter((q) => q.until > now && q.dish !== def.key);
  p.buffs.push({ dish: def.key, until: now + D.mins, name: def.name });
  // (Only so many at once: the oldest wears off.)
  const dishes = p.buffs.filter((q) => q.dish);
  if (dishes.length > DISH_MAX) {
    const old = dishes.sort((a, b) => a.until - D.mins - (b.until - D.mins))[0];
    p.buffs = p.buffs.filter((q) => q !== old);
  }
  p._dishFx = null;
  // (And you know now what went into it was.)
  learnKinds(p, D.ings);
  return D;
}

// What a cook's learnt each thing is (by cooking with it, or eating it).
export function learnKinds(p, ings) {
  p.kinds ||= [];
  for (const k of ings) {
    const b = baseOf(k);
    if (!p.kinds.includes(b)) p.kinds.push(b);
  }
  if (p.kinds.length > 400) p.kinds.splice(0, p.kinds.length - 400);
}

// Each moment, as a dish works: a slow mending, or a turn of the stomach.
export function tickDishes(game, p, dt) {
  if (!p.buffs || !p.buffs.some((q) => q.dish)) return;
  if (dishFx(p, 'regen') > 0 && p.hp < p.maxHp && p.hp > 0) {
    p.dishRegenT = (p.dishRegenT || 0) + dt;
    if (p.dishRegenT >= 8) {
      p.dishRegenT = 0;
      p.hp = Math.min(p.maxHp, p.hp + 1);
      p.quietHeal = true;
      game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 3, color: ['#80e070', '#c0ffa0'], up: 12, speed: 6, gravity: -8, life: 0.7, glow: true });
    }
  }
  if (dishFx(p, 'sick') > 0 && p.hp > 1) {
    p.sickT = (p.sickT || 0) + dt;
    if (p.sickT >= 25) {
      p.sickT = 0;
      if (Math.random() < 0.4) {
        p.hp = Math.max(1, p.hp - 1);
        game.ui.msg('Your stomach turns. (-1 HP)', '#c0a060', true);
        game.renderer.emit(p.x, p.y + 1, p.z, { n: 4, color: ['#a0c060', '#c8d880'], up: 8, speed: 8, life: 0.6, shape: 'puff' });
      }
    }
  }
  // (Strength and the rest: counted with the rest of your bonuses, so
  // looked at again now and then, as conditions come and go.)
  p.dishStatT = (p.dishStatT || 0) + dt;
  if (p.dishStatT >= 1) {
    p.dishStatT = 0;
    const key = ['str', 'agi', 'end', 'cha'].map((k) => dishFx(p, k)).join(',');
    if (key !== p.dishStatKey) {
      p.dishStatKey = key;
      game.refreshBonus?.();
    }
  }
}

// ------------------------------------------------------------ recipes
// A dish written down: where it's made, what goes in, and what comes out
// (made from it, the same dish again).
export function recipeOf(key) {
  const d = parseDish(key);
  return d ? { key, st: d.st, ings: d.ings, name: ITEMS[key] ? ITEMS[key].name : key } : null;
}

// (Round 51) Recipes on scrolls. How many a cook keeps in their head (the
// oldest forgotten for a new one past that).
export const RECIPE_MAX = 24;
export const recipeScroll = (dishKey) => RECIPE_PREFIX + dishKey;

// A recipe learnt (from cooking it well, or from a scroll): 'new', or
// 'known' if it was already.
export function learnRecipe(p, dishKey) {
  const r = recipeOf(dishKey);
  if (!r) return null;
  p.recipes ||= [];
  if (p.recipes.some((q) => q.key === dishKey)) return 'known';
  p.recipes.push(r);
  if (p.recipes.length > RECIPE_MAX) p.recipes.shift();
  return 'new';
}

// One you know, written out on a blank scroll from the pack (the scroll
// used up, the recipe scroll in its place). False with no scroll.
export function writeRecipe(inv, dishKey) {
  if (!parseDish(dishKey) || !inv.some((s) => s && s.item === 'scroll' && s.count > 0)) return false;
  removeItem(inv, 'scroll', 1);
  if (addItem(inv, recipeScroll(dishKey), 1)) {
    // (No room for it: the blank one back.)
    addItem(inv, 'scroll', 1);
    return false;
  }
  return true;
}

// Can `inv` (slots or a store {item: n}) make recipe `r`?
export function canMake(inv, r) {
  const need = {};
  for (const k of r.ings) need[k] = (need[k] || 0) + 1;
  return Object.entries(need).every(([k, n]) => countIn(inv, k) >= n);
}
export function countIn(inv, k) {
  if (Array.isArray(inv)) return inv.reduce((n, s) => n + (s && baseOf(s.item) === k && !String(s.item).startsWith('dish~') ? s.count : s && s.item === k ? s.count : 0), 0);
  return inv[k] || 0;
}

// ------------------------------------------------------------ the towns' cooks
// What a town's cooks keep in: a little of everything a kitchen uses.
export const PANTRY = ['raw_meat', 'fish', 'carrot', 'cabbage', 'apple', 'berries', 'mushroom', 'wheat', 'flour', 'herb', 'bread', 'egg', 'honey', 'ember_pod', 'glowcap', 'crab_meat', 'mangrove_pod'];
// Where each kind of cook does their cooking.
export const COOK_JOBS = { cook: 'p', innkeeper: 'p', barkeep: 'p', baker: 'o' };

// A cook's store (or the kitchen they work in), stocked up with a few of
// each thing a kitchen uses that's to be had (a new town, or a world
// brought up from before cooks cooked: see migrate.js).
export function stockPantry(store, rng = Math.random, n = 2) {
  let added = 0;
  for (const k of PANTRY) {
    if (!ITEMS[k] || rng() < 0.35) continue;
    const want = 1 + Math.floor(rng() * n);
    if ((store[k] || 0) >= want) continue;
    store[k] = (store[k] || 0) + want;
    added += want;
  }
  return added;
}

// A cook at work makes a dish of what's in their kitchen: one of their own
// recipes if they've what it takes, or else something new out of whatever
// they have (and the good ones written down for next time). Into the
// kitchen's store it goes, for sale. Returns the dish key, or null.
export function npcCook(rec, store, rng = Math.random) {
  const st = COOK_JOBS[rec.job] || 'c';
  rec.recipes ||= [];
  const skill = rec.skills ? rec.skills.cooking || 0.3 : 0.3;
  const known = rec.recipes.filter((r) => r.st === st && canMake(store, r));
  let key = null;
  let ings = null;
  if (known.length && rng() < 0.7) {
    const r = known[Math.floor(rng() * known.length)];
    key = r.key;
    ings = r.ings;
  } else {
    // (Raw things, not meals already made.)
    const raw = (k) => {
      const d = ITEMS[k];
      return PANTRY.includes(k) || (d.kind === 'food' && !d.quality && !d.region && !d.meal && (d.heal || 0) <= 4);
    };
    const have = Object.keys(store).filter((k) => store[k] > 0 && ITEMS[k] && !k.startsWith('dish~') && raw(k));
    if (!have.length) return null;
    const n = Math.min(have.length, 1 + Math.floor(rng() * 3));
    ings = [];
    while (ings.length < n) {
      const k = have.splice(Math.floor(rng() * have.length), 1)[0];
      ings.push(k);
    }
    // (How well they do it: their skill, and the day they're having.)
    const score = Math.max(0, Math.min(1, skill * 0.8 + rng() * 0.45));
    key = cookDish(ings, st, score, rng);
    // A good one's written down, to be made again.
    if (score >= 0.6 && !rec.recipes.some((r) => r.key === key)) {
      rec.recipes.push(recipeOf(key));
      if (rec.recipes.length > 6) rec.recipes.shift();
    }
  }
  for (const k of ings) store[k] = (store[k] || 0) - 1;
  for (const k of Object.keys(store)) if (store[k] <= 0) delete store[k];
  store[key] = (store[key] || 0) + 1;
  return key;
}

// Bought in for the kitchen: what the farmers, fishers, trappers and
// herbalists of the town (and a trader passing through) have spare.
export function marketRun(kitchen, sellers, rng = Math.random) {
  let got = 0;
  for (const b of sellers) {
    if (!b || !b.store || b === kitchen) continue;
    for (const k of Object.keys(b.store)) {
      if (!PANTRY.includes(k) || (b.store[k] || 0) < 2 || (kitchen.store[k] || 0) >= 3 || rng() < 0.5) continue;
      const pr = Math.max(1, Math.round((ITEMS[k].value || 1) * 0.9));
      if ((kitchen.till || 0) < pr + 8) return got;
      b.store[k] -= 1;
      kitchen.store[k] = (kitchen.store[k] || 0) + 1;
      kitchen.till -= pr;
      b.till = (b.till || 0) + pr;
      got++;
    }
  }
  return got;
}

export { TYPES, CONDS, FX, COOK_STATIONS, dishKey, B };
