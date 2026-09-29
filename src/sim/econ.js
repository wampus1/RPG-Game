// Settlement economy. Every villager record carries coins, an inventory,
// skills, hunger and mood; every business has a till and a store; every
// household has a pantry; the settlement has a treasury, taxes and laws.
//
// The same hour-by-hour rules run whether or not the player is nearby: an
// active settlement is ticked as game time passes, and a distant one is
// simply caught up (hour by hour, capped) the next time it's needed.
import { foundingLaws, reviewLaws, LAWS, LAW_IDS } from './laws.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { ITEMS } from '../world/items.js';
import { JOBS, activityAt } from '../entities/npcgen.js';
import { personName, familyName } from '../world/names.js';
import { townWeather, rainedRecently } from '../world/weather.js';

export const DAY = 1440;
// How far back a town's story is caught up when you return (towns you've
// been to are also kept ticking over in the background).
const MAX_CATCHUP = 45 * DAY;

// What each kind of trader deals in (also what their shop restocks).
export const STOCK = {
  general: ['torch', 'bread', 'apple', 'planks', 'cloth', 'string', 'fishing_rod', 'lantern', 'glass', 'chest', 'bed', 'seeds', 'arrow', 'bucket'],
  smith: ['iron_ingot', 'coal', 'stone_pickaxe', 'stone_axe', 'stone_sword', 'iron_sword', 'iron_pickaxe', 'iron_axe', 'spear', 'hammer', 'anvil', 'lantern', 'iron_bars', 'iron_helmet', 'chainmail', 'iron_breastplate', 'iron_greaves', 'iron_boots'],
  baker: ['bread', 'pie', 'wheat', 'apple', 'berries'],
  inn: ['stew', 'feast', 'gruel', 'cooked_meat', 'bread', 'cooked_fish', 'dice'],
  cook: ['stew', 'feast', 'gruel', 'cooked_meat', 'cooked_fish', 'bread'],
  tailor: ['cloth', 'string', 'leather', 'rug_red', 'rug_blue', 'rug_green', 'bed', 'linen_shirt', 'wool_trousers', 'wool_hood', 'straw_hat', 'fine_coat', 'leather_tunic', 'leather_boots'],
  carpenter: ['planks', 'planks_dark', 'chest', 'door', 'table', 'chair', 'stool', 'bench', 'bookshelf', 'fence', 'workbench', 'barrel', 'crate', 'hanging_sign', 'bucket', 'raft'],
  herbalist: ['herb', 'mushroom', 'berries', 'seeds', 'sapling', 'flower_red', 'flower_blue'],
  fisher: ['fish', 'cooked_fish', 'fishing_rod', 'reeds', 'string', 'raft'],
  farmer: ['wheat', 'carrot', 'cabbage', 'seeds', 'hay_bale', 'pumpkin', 'apple', 'bucket'],
  scholar: ['book', 'scroll', 'sketchbook', 'bookshelf', 'lantern'],
  trapper: ['raw_meat', 'leather', 'feather', 'arrow', 'bow', 'snare', 'leather_cap', 'leather_trousers'],
};

// Which items each trade will buy from the player.
export const WANTS = {
  general: null, // anything
  smith: ['iron_ore', 'gold_ore', 'coal', 'iron_ingot', 'gold_ingot', 'gem', 'cobblestone', 'iron_helmet', 'chainmail', 'iron_breastplate', 'iron_greaves', 'iron_boots'],
  baker: ['wheat', 'berries', 'apple', 'carrot'],
  inn: ['raw_meat', 'fish', 'carrot', 'cabbage', 'mushroom', 'wheat', 'berries', 'cooked_meat', 'cooked_fish'],
  cook: ['raw_meat', 'fish', 'carrot', 'cabbage', 'mushroom', 'wheat', 'berries', 'pumpkin', 'apple'],
  tailor: ['string', 'leather', 'cloth', 'feather', 'wheat', 'linen_shirt', 'wool_trousers', 'wool_hood', 'straw_hat', 'fine_coat', 'leather_tunic', 'leather_trousers', 'leather_boots', 'leather_cap'],
  carpenter: ['log_oak', 'log_birch', 'log_pine', 'log_palm', 'log_jungle', 'log_acacia', 'log_willow', 'planks', 'stick'],
  herbalist: ['herb', 'mushroom', 'berries', 'flower_red', 'flower_blue', 'flower_yellow', 'flower_white', 'flower_purple', 'sapling', 'slime_gel'],
  fisher: ['string', 'reeds', 'fish'],
  farmer: ['seeds', 'bone', 'wheat', 'carrot', 'cabbage'],
  scholar: ['book', 'scroll', 'gem', 'reeds', 'feather'],
  trapper: ['string', 'stick', 'feather', 'arrow', 'raw_meat', 'leather', 'bone'],
};

export const MEAL_ITEMS = ['feast', 'stew', 'gruel'];
export const MEAL_PRICE = { gruel: 2, stew: 5, feast: 9 };
const PLAIN_FOOD = ['pie', 'cooked_meat', 'cooked_fish', 'bread', 'apple', 'carrot', 'cabbage', 'berries', 'coconut', 'mushroom'];
const RAW_FOOD = ['raw_meat', 'fish'];
const VEG = ['carrot', 'cabbage', 'mushroom', 'wheat'];

// ------------------------------------------------------------ helpers
export function invCount(inv, item) {
  let n = 0;
  for (const s of inv) if (s && s.item === item) n += s.count;
  return n;
}
export function invAdd(inv, item, n = 1) {
  if (n <= 0) return;
  const s = inv.find((q) => q && q.item === item);
  if (s) s.count += n;
  else inv.push({ item, count: n });
}
export function invTake(inv, item, n = 1) {
  let taken = 0;
  for (let i = inv.length - 1; i >= 0 && taken < n; i--) {
    const s = inv[i];
    if (!s || s.item !== item) continue;
    const k = Math.min(n - taken, s.count);
    s.count -= k;
    taken += k;
    if (s.count <= 0) inv.splice(i, 1);
  }
  return taken;
}
export const st = {
  count: (o, k) => o[k] || 0,
  add(o, k, n = 1) {
    if (n > 0) o[k] = (o[k] || 0) + n;
  },
  take(o, k, n = 1) {
    const t = Math.min(n, o[k] || 0);
    if (t > 0) {
      o[k] -= t;
      if (!o[k]) delete o[k];
    }
    return t;
  },
  total: (o) => Object.values(o).reduce((a, b) => a + b, 0),
};

export function price(item) {
  return ITEMS[item] ? Math.max(1, Math.round(ITEMS[item].value)) : 1;
}

export function alive(rec) {
  return rec.alive !== false;
}

export function traderOf(rec) {
  if (rec.visitor) return 'general';
  return JOBS[rec.job]?.trader || null;
}

export function ledger(L, day, text) {
  const e = L.econ;
  e.ledger.push({ day, text });
  if (e.ledger.length > 200) e.ledger.shift();
}

// Stories worth passing on to another town (not the comings and goings of
// the merchants themselves).
export function notableNews(L, sinceDay, max = 3) {
  const out = [];
  for (const it of [...L.econ.ledger].reverse()) {
    if (it.day < sinceDay) break;
    if (/merchant|came back from|set out for|arrived in town|wrote to|traveling|in its coffers|stand at \d+%|wages/i.test(it.text)) continue;
    out.push(it.text);
    if (out.length >= max) break;
  }
  return out;
}

// News from elsewhere, as heard from the merchants.
export function hearNews(L, from, items, day) {
  const e = L.econ;
  if (!items || !items.length) return;
  const known = new Set((e.rumours || []).map((r) => r.text));
  e.rumours = [...(e.rumours || []), ...items.filter((t) => !known.has(t)).map((text) => ({ from, text, day }))].filter((r) => r.day >= day - 10).slice(-8);
}

export function mayorOf(L) {
  return L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.migrated) || null;
}

export function kitchenOf(L) {
  const t = L.buildings.find((b) => b.type === 'tavern' && L.econ.biz[b.id]);
  return t ? L.econ.biz[t.id] : null;
}

// ------------------------------------------------------------ setup
const SKILL_JOBS = {
  cooking: { cook: [0.35, 0.95], innkeeper: [0.3, 0.6], baker: [0.3, 0.6], barkeep: [0.2, 0.5] },
  hunting: { trapper: [0.45, 0.95], guard: [0.3, 0.6], fisher: [0.15, 0.4] },
  fishing: { fisher: [0.45, 0.95], trapper: [0.2, 0.4] },
  farming: { farmer: [0.4, 0.9], herbalist: [0.3, 0.6] },
  trading: { merchant: [0.45, 0.95], innkeeper: [0.3, 0.6], noble: [0.3, 0.7] },
  building: { carpenter: [0.5, 0.95], laborer: [0.35, 0.7], blacksmith: [0.3, 0.6], miner: [0.25, 0.5], lumberjack: [0.25, 0.5] },
  crafting: { blacksmith: [0.45, 0.95], tailor: [0.45, 0.95], carpenter: [0.4, 0.9], herbalist: [0.4, 0.8], scholar: [0.4, 0.9] },
};

export function skillsFor(rec, rng) {
  const out = {};
  for (const [k, jobs] of Object.entries(SKILL_JOBS)) {
    const r = jobs[rec.job];
    let v = r ? rng.float(r[0], r[1]) : rng.float(0.05, 0.4);
    if (rec.age === 'child') v *= 0.4;
    if (rec.age === 'elder') v = Math.min(1, v * 1.15);
    out[k] = Math.round(v * 100) / 100;
  }
  return out;
}

export function initRec(rec, rng) {
  rec.coins = rec.equipment.coins || 0;
  rec.inv = [];
  const keep = [];
  for (const it of rec.equipment.items) {
    if (ITEMS[it.item]?.kind === 'food' || it.item === 'arrow') invAdd(rec.inv, it.item, it.count);
    else keep.push(it);
  }
  rec.equipment.items = keep;
  rec.skills = skillsFor(rec, rng);
  rec.fed = 1;
  rec.hungry = 0;
  rec.mood = clamp(0.55 + rng.float(-0.12, 0.12), 0, 1);
  rec.earned = 0;
  rec.earnedY = 0;
  rec.lastMeal = null;
  rec.grief = [];
  rec.override = null;
  rec.away = false;
  rec.trip = null;
  rec.doneKeys = [];
}

// Timber and stone for building, cut and quarried by the town's own
// lumberjacks, miners and labourers (or bought in when the council can
// afford it). Each new building needs its share.
export const MATERIALS = {
  house_s: [12, 6], house_m: [20, 10], house_l: [30, 16], tavern: [30, 20], smithy: [20, 30], bakery: [18, 16], workshop: [26, 8],
  shop: [20, 14], library: [26, 22], tailor: [18, 10], guardhouse: [14, 30], temple: [20, 40], herbalist: [16, 8], warehouse: [24, 12],
};
const STOCK_CAP = 300;

export function stockOf(L) {
  const e = L.econ;
  if (!e.stock) {
    const s = L.settlement;
    const [w, st0] = { village: [40, 24], town: [80, 60], city: [150, 120] }[s.baseType || s.type] || [40, 24];
    const k = { prosperous: 1.4, poor: 0.6 }[s.condition] || 1;
    e.stock = { wood: Math.round(w * k), stone: Math.round(st0 * k) };
  }
  return e.stock;
}

export function hasMaterials(L, type) {
  const [w, s] = MATERIALS[type] || [15, 10];
  const k = stockOf(L);
  return k.wood >= w && k.stone >= s;
}

export function useMaterials(L, type) {
  const [w, s] = MATERIALS[type] || [15, 10];
  const k = stockOf(L);
  k.wood = Math.max(0, k.wood - w);
  k.stone = Math.max(0, k.stone - s);
}

function gather(L, kind, n) {
  const k = stockOf(L);
  k[kind] = Math.min(STOCK_CAP, k[kind] + n);
}

export function initEcon(L) {
  if (L.econ) return L.econ;
  const s = L.settlement;
  const rng = new RNG(hash4(s.seed, 0xec0));
  const pop = L.npcs.length;
  const vals = s.civ ? s.civ.values : [];
  const wealth = { prosperous: rng.float(1.4, 2.2), normal: rng.float(0.7, 1.3), poor: rng.float(0.15, 0.5) }[s.condition] ?? 0;
  const typeF = { city: 1.5, town: 1.2, village: 1 }[s.baseType || s.type] || 1;
  const e = (L.econ = {
    wealth,
    treasury: Math.round(pop * 14 * wealth * typeF),
    tax: Math.round(clamp((s.condition === 'poor' ? 0.14 : s.condition === 'prosperous' ? 0.06 : 0.1) + rng.float(-0.02, 0.02), 0.02, 0.3) * 100) / 100,
    fineScale: vals.includes('martial') ? 1.25 : vals.includes('pious') ? 0.85 : 1,
    laws: { ...foundingLaws(s, new RNG(hash4(s.seed, 0x1a55)), vals), armsBan: vals.includes('martial') || rng.chance(0.25) },
    ledger: [],
    biz: {},
    pantry: {},
    lastAbs: null,
    recent: { thefts: 0, violence: 0, deaths: 0, calm: 0, night: 0, poached: 0, felled: 0, raids: 0 },
    taxY: 0,
    unpaid: 0,
    festival: -99,
    crops: [],
  });
  e.crops = L.fields.length ? ['wheat', 'carrot', 'cabbage'] : ['carrot', 'cabbage'];
  for (const b of L.buildings) {
    if (b.residential) continue;
    e.biz[b.id] = { till: Math.round(rng.int(12, 40) * wealth), store: {}, earned: 0, earnedY: 0 };
  }
  for (const b of L.buildings) {
    if (!b.residential || !b.household) continue;
    const pan = (e.pantry[b.id] = {});
    const n = b.household.members.length;
    st.add(pan, 'bread', Math.round(n * wealth * rng.float(0.5, 1.2)));
    st.add(pan, rng.pick(['carrot', 'cabbage', 'apple']), Math.round(n * wealth * rng.float(0.3, 1)));
    if (rng.chance(0.4 * wealth)) st.add(pan, 'cooked_meat', 1);
  }
  for (const rec of L.npcs) initRec(rec, rng.fork(rec.idx + 31));
  // One merchant per place travels between settlements with goods.
  const traveler = L.npcs.find((r) => r.job === 'merchant' && r.age === 'adult');
  if (traveler) traveler.traveler = true;
  // Seed shop stores and the tavern kitchen.
  for (const rec of L.npcs) {
    const t = traderOf(rec);
    const b = rec.work && rec.work.building != null ? e.biz[rec.work.building] : null;
    if (!t || !b || t === 'cook' || t === 'inn') continue;
    for (const k of STOCK[t] || []) if (ITEMS[k] && rng.chance(0.7)) st.add(b.store, k, rng.int(1, 3));
  }
  const k = kitchenOf(L);
  if (k) {
    st.add(k.store, 'stew', Math.round(rng.int(2, 5) * Math.max(0.4, wealth)));
    st.add(k.store, 'raw_meat', rng.int(1, 3));
    if (rng.chance(0.4)) st.add(k.store, 'feast', 1);
    if (s.condition === 'poor') st.add(k.store, 'gruel', rng.int(1, 3));
  }
  const m = mayorOf(L);
  ledger(L, 0, `${s.name} keeps ¤${e.treasury} in its coffers.`);
  ledger(L, 0, `Taxes stand at ${Math.round(e.tax * 100)}%${m ? `, by order of ${m.name.first} ${m.name.last}` : ''}.`);
  for (const id of LAW_IDS) if (e.laws[id]) ledger(L, 0, `Law: ${LAWS[id].desc}`);
  return e;
}

// ------------------------------------------------------------ time
// The activity a record is doing at an absolute time, including temporary
// overrides (mourning, foraging, building, trials, travel...).
export function activityFor(rec, day, minute) {
  const o = rec.override;
  const abs = day * DAY + minute;
  if (o && abs >= o.s && abs < o.e) {
    // Long plans (a day of building) still break for meals.
    if (o.allowMeals) {
      const a = activityAt(rec, minute, day);
      if (a.entry.act === 'eat') {
        a.key = `${day}:${a.rest ? 'r' : 'w'}${a.index}`;
        return a;
      }
    }
    return { entry: o.entry, index: -1, override: o, key: `o${o.id}` };
  }
  if (o && abs >= o.e) rec.override = null;
  const a = activityAt(rec, minute, day);
  a.key = `${day}:${a.rest ? 'r' : 'w'}${a.index}`;
  return a;
}

// Outdoor trades, and whether this person packs it in when the weather
// turns: the lazy and the gloomy go home, the hardworking carry on.
const OUTDOOR = new Set(['farmer', 'fisher', 'lumberjack', 'miner', 'trapper', 'builder', 'laborer']);
export function weatherQuits(rec, kind) {
  if (kind === 'clear' || !OUTDOOR.has(rec.job) || rec.age !== 'adult') return false;
  const tr = rec.traits || [];
  if (tr.includes('hardworking') || tr.includes('disciplined')) return false;
  let w = 0.5 - (rec.personality?.diligence ?? 0.5);
  if (tr.includes('lazy')) w += 0.35;
  if (tr.includes('gloomy')) w += 0.15;
  if (tr.includes('timid')) w += 0.05;
  if (tr.includes('cheerful') || tr.includes('patient')) w -= 0.1;
  if (kind === 'snow') w += 0.1;
  if (kind === 'fog') w -= 0.3;
  return w > 0.12;
}

// Knocking off early for the weather: home until the shift would have ended.
export function weatherBreak(rec, kind, day, minute) {
  if (rec.override || rec.hired) return null;
  const a = activityFor(rec, day, minute);
  if (a.entry.act !== 'work' || !weatherQuits(rec, kind)) return null;
  const now = day * DAY + minute;
  const end = day * DAY + a.entry.e;
  if (end - now < 30) return null;
  return setOverride(rec, now, end, 'home', { place: 'home', weather: kind });
}

let overrideId = 1;
// Replace part of today's schedule with a special activity.
export function setOverride(rec, s, e, act, extra = {}) {
  const m0 = ((s % DAY) + DAY) % DAY;
  rec.override = { id: overrideId++, s, e, act, entry: { s: m0, e: m0 + (e - s), act, place: extra.place || act, ...extra }, ...extra };
  return rec.override;
}

// First free stretch (hobby, wander, social, play or evening at home) in a
// record's schedule for `day` at or after `fromMin`.
export function freeSlot(rec, day, fromMin = 0, len = 90) {
  const sched = day % 7 === rec.restDay ? rec.schedule.rest : rec.schedule.work;
  for (const e of sched) {
    if (e.e <= fromMin) continue;
    if (!['hobby', 'wander', 'social', 'play', 'home'].includes(e.act)) continue;
    if (e.act === 'home' && e.s < 600) continue;
    const s = Math.max(e.s, fromMin);
    if (e.e - s < 30) continue;
    return { s: day * DAY + s, e: day * DAY + Math.min(e.e, s + len) };
  }
  return null;
}

// ------------------------------------------------------------ meals
function payer(L, rec) {
  // Families share: parents pay for their children's food (and grown-ups
  // for their elders) when they can.
  let best = rec;
  for (const o of L.npcs) {
    if (o.home !== rec.home || o === rec || !alive(o) || o.away || o.age === 'child') continue;
    if (o.coins > best.coins) best = o;
  }
  return best;
}

function mealEffects(rec, item, rng) {
  const q = ITEMS[item]?.quality || (RAW_FOOD.includes(item) ? 'raw' : 'plain');
  if (q === 'terrible') {
    rec.mood = clamp(rec.mood - 0.08, 0, 1);
    if (rng.chance(0.3)) {
      rec.hp = Math.max(1, (rec.hp ?? rec.maxHp) - 1);
      rec.sick = true;
    }
  } else if (q === 'acceptable') rec.mood = clamp(rec.mood + 0.02, 0, 1);
  else if (q === 'delightful') {
    rec.mood = clamp(rec.mood + 0.1, 0, 1);
    rec.hp = rec.maxHp;
    rec.sick = false;
  }
  if (rec.ent && !rec.ent.dead) rec.ent.hp = rec.hp ?? rec.ent.hp;
  return q;
}

// Cook raw food at home: the result depends on the cook's skill.
function homeCook(rec, raw, rng) {
  const skill = rec.skills?.cooking ?? 0.2;
  const roll = skill * 0.8 + rng.float(0, 0.45);
  if (roll < 0.25) return 'gruel';
  return raw === 'fish' ? 'cooked_fish' : 'cooked_meat';
}

function takeFood(storeLike, isInv, list) {
  for (const k of list) {
    const n = isInv ? invCount(storeLike, k) : st.count(storeLike, k);
    if (n > 0) {
      if (isInv) invTake(storeLike, k, 1);
      else st.take(storeLike, k, 1);
      return k;
    }
  }
  return null;
}

export function buyMeal(L, rec, rng) {
  const k = kitchenOf(L);
  if (!k) return null;
  const who = payer(L, rec);
  const e = L.econ;
  for (const m of who.coins > 20 ? MEAL_ITEMS : ['stew', 'gruel', 'feast']) {
    if (!st.count(k.store, m)) continue;
    const pr = Math.round(MEAL_PRICE[m] * (1 + e.tax * 0.5));
    if (who.coins < pr) continue;
    st.take(k.store, m, 1);
    who.coins -= pr;
    k.till += pr;
    k.earned += pr;
    return m;
  }
  return null;
}

function buyBread(L, rec) {
  const bakery = L.buildings.find((b) => b.type === 'bakery');
  const biz = bakery ? L.econ.biz[bakery.id] : null;
  const who = payer(L, rec);
  if (!biz || !st.count(biz.store, 'bread') || who.coins < 3) return null;
  st.take(biz.store, 'bread', 1);
  who.coins -= 3;
  biz.till += 3;
  biz.earned += 3;
  return 'bread';
}

// Someone sits down to eat: their own food, the family pantry, a meal bought
// from the tavern kitchen (children's meals are paid by their parents), or
// nothing at all.
export function eatMeal(L, rec, place, day, rng, minute = 720) {
  const e = L.econ;
  const pantry = e.pantry[rec.home];
  let item = null;
  let source = null;
  // Two good meals a day is plenty.
  if (rec.fed >= 2) return { day, item: null, q: null, source: 'full', full: true };
  // Breakfast is whatever is in the house; nobody goes to buy food for it.
  const light = minute < 600 && place === 'home';
  const atTavern = place === 'tavern' || (place === 'work' && (rec.job === 'cook' || rec.job === 'innkeeper' || rec.job === 'barkeep'));
  if (atTavern) {
    item = buyMeal(L, rec, rng);
    if (item) source = 'tavern';
  }
  if (!item) {
    item = takeFood(rec.inv, true, [...MEAL_ITEMS, ...PLAIN_FOOD]);
    if (item) source = 'own';
  }
  if (!item && pantry) {
    item = takeFood(pantry, false, [...MEAL_ITEMS, ...PLAIN_FOOD]);
    if (item) source = 'pantry';
  }
  // Raw food gets cooked at home.
  if (!item) {
    let raw = takeFood(rec.inv, true, RAW_FOOD);
    if (!raw && pantry) raw = takeFood(pantry, false, RAW_FOOD);
    if (raw) {
      item = homeCook(rec, raw, rng);
      source = 'cooked';
    }
  }
  if (!item && !light) {
    item = buyMeal(L, rec, rng) || buyBread(L, rec);
    if (item) source = 'bought';
  }
  if (!item && light) return { day, item: null, q: null, source: 'skipped', full: true };
  if (!item) {
    rec.lastMeal = { day, item: null, q: null, source: null };
    rec.mood = clamp(rec.mood - 0.04, 0, 1);
    return rec.lastMeal;
  }
  const q = mealEffects(rec, item, rng);
  rec.fed++;
  rec.lastMeal = { day, item, q, source };
  return rec.lastMeal;
}

// ------------------------------------------------------------ foraging
export function forage(L, rec, rng) {
  const s = L.settlement;
  const skill = rec.skills?.hunting ?? 0.2;
  const chance = (0.35 + skill * 0.6) * (rec.age === 'child' ? 0.6 : 1) * (s.biome === 'desert' || s.biome === 'tundra' ? 0.6 : 1);
  if (!rng.chance(chance)) return null;
  let item;
  if ((s.river || s.lake || s.coast) && rng.chance(0.35)) item = 'fish';
  else if (rec.age !== 'child' && rng.chance(0.5)) item = 'raw_meat';
  else item = rng.pick(['berries', 'mushroom', 'berries', 'apple']);
  const n = rng.int(1, 2);
  invAdd(rec.inv, item, n);
  return { item, n };
}

// ------------------------------------------------------------ entries
// Called exactly once per schedule entry (by the active entity when it
// starts the activity, or by the hourly tick for everyone else).
export function entryStart(sim, L, rec, act, day, rng) {
  const done = rec.doneKeys || (rec.doneKeys = []);
  if (done.includes(act.key)) return false;
  done.push(act.key);
  if (done.length > 6) done.shift();
  const e = act.entry;
  if (e.act === 'eat') {
    const r = eatMeal(L, rec, e.place, day, rng, e.s);
    if (sim && rec.ent && !r.full) rec.ent.onMeal(r);
  } else if (e.act === 'forage') {
    const got = forage(L, rec, rng);
    rec.forageResult = got;
    // Children bring what they find home to the pantry.
    if (got && rec.age === 'child' && L.econ.pantry[rec.home]) {
      invTake(rec.inv, got.item, got.n);
      st.add(L.econ.pantry[rec.home], got.item, got.n);
    }
  }
  return true;
}

// ------------------------------------------------------------ production
const INCOME = { blacksmith: 4, tailor: 3, carpenter: 3, herbalist: 2, scholar: 2, merchant: 3, miner: 3, lumberjack: 2, laborer: 2, beggar: 0.5, priest: 1, innkeeper: 2, barkeep: 2, noble: 1 };
const GOODS = {
  blacksmith: ['iron_ingot', 'iron_sword', 'stone_pickaxe', 'stone_axe', 'lantern', 'iron_bars', 'iron_helmet', 'chainmail', 'iron_boots'],
  tailor: ['cloth', 'cloth', 'leather', 'rug_red', 'bed', 'linen_shirt', 'wool_trousers', 'leather_tunic'],
  carpenter: ['planks', 'chair', 'stool', 'table', 'chest', 'barrel', 'door'],
  herbalist: ['herb', 'herb', 'mushroom', 'sapling'],
  scholar: ['book', 'scroll'],
  miner: ['coal', 'coal', 'iron_ore', 'cobblestone'],
  lumberjack: ['log_oak', 'planks', 'stick'],
};

function produce(L, rec, rng) {
  const e = L.econ;
  const sk = rec.skills;
  const s = L.settlement;
  const bizId = rec.work && rec.work.building != null ? rec.work.building : null;
  const biz = bizId != null ? e.biz[bizId] : null;
  // Felled timber and hauled stone go to the town's building stores.
  if (rec.job === 'lumberjack' && rng.chance(0.6)) gather(L, 'wood', rng.int(1, 2));
  else if (rec.job === 'laborer' && rng.chance(0.25)) gather(L, rng.chance(0.5) ? 'wood' : 'stone', 1);
  switch (rec.job) {
    case 'trapper': {
      const game = s.biome === 'desert' ? 0.5 : s.biome === 'tundra' ? 0.7 : 1;
      if (rng.chance(0.4 * (0.5 + sk.hunting) * game)) invAdd(rec.inv, 'raw_meat', rng.int(1, 3));
      if (rng.chance(0.08)) invAdd(rec.inv, 'leather', 1);
      if (rng.chance(0.05)) invAdd(rec.inv, 'feather', 1);
      sk.hunting = Math.min(1, sk.hunting + 0.001);
      return;
    }
    case 'fisher':
      if (rng.chance(0.45 * (0.5 + sk.fishing))) invAdd(rec.inv, 'fish', rng.int(1, 3));
      sk.fishing = Math.min(1, sk.fishing + 0.001);
      return;
    case 'farmer':
      // Moist fields (recent rain, or water carried from the well) yield more.
      if (rng.chance(0.5 * (0.5 + sk.farming) * (e.moist ? 1.5 : 1))) invAdd(rec.inv, rng.pick(e.crops), rng.int(1, 3));
      return;
    case 'baker': {
      if (!biz) return;
      if (st.count(biz.store, 'wheat') >= 2) {
        st.take(biz.store, 'wheat', 2);
        st.add(biz.store, 'bread', 2 + (rng.chance(sk.cooking) ? 1 : 0));
      } else if (rng.chance(0.3)) st.add(biz.store, 'bread', 1); // flour from the stores
      return;
    }
    case 'cook': {
      const k = kitchenOf(L) || biz;
      if (!k) return;
      const pop = L.npcs.length;
      const meals = MEAL_ITEMS.reduce((a, m) => a + st.count(k.store, m), 0);
      for (let n = 0; n < 3 && meals + n * 2 < pop * 0.7 + 4; n++) {
        const raw = st.count(k.store, 'raw_meat') ? 'raw_meat' : st.count(k.store, 'fish') ? 'fish' : null;
        const veg = VEG.find((v) => st.count(k.store, v) > 0);
        if (!raw && !veg) break;
        if (raw) st.take(k.store, raw, 1);
        if (veg) st.take(k.store, veg, 1);
        // Skill decides whether the pot turns out terrible, fine or delightful.
        const roll = sk.cooking * 0.75 + rng.float(0, 0.45) + (raw && veg ? 0.08 : 0) - (raw ? 0 : 0.15);
        const meal = roll < 0.38 ? 'gruel' : roll < 0.84 ? 'stew' : 'feast';
        // A pot of stew feeds several people.
        st.add(k.store, meal, (raw === 'raw_meat' ? 3 : raw ? 2 : 1) + (raw && veg ? 1 : 0));
        sk.cooking = Math.min(1, sk.cooking + 0.002);
      }
      return;
    }
    case 'miner': {
      // Out at the rock face: stone, coal and ore (a little gold if lucky),
      // and blocks of stone for the town's builders.
      if (rng.chance(0.5)) gather(L, 'stone', 1);
      if (rng.chance(0.55 * (0.6 + (sk.building || 0.3)))) {
        const ore = rng.weighted([['cobblestone', 3], ['coal', 3], ['iron_ore', 2.5], ['gold_ore', 0.3]]);
        invAdd(rec.inv, ore, rng.int(1, 2));
      }
      // Too much rubble to carry: leave it.
      const rubble = invCount(rec.inv, 'cobblestone');
      if (rubble > 16) invTake(rec.inv, 'cobblestone', rubble - 16);
      return;
    }
    case 'blacksmith': {
      // Iron ore and coal make ingots and tools; without them the forge idles.
      if (biz && st.count(biz.store, 'iron_ore') >= 1) {
        st.take(biz.store, 'iron_ore', 1);
        if (st.count(biz.store, 'coal')) st.take(biz.store, 'coal', 1);
        st.add(biz.store, rng.chance(0.6) ? 'iron_ingot' : rng.pick(GOODS.blacksmith), 1);
        biz.till += 3;
        biz.earned += 3;
      } else if (biz) {
        biz.till += 1;
        biz.earned += 1;
      }
      return;
    }
    case 'guard': case 'mayor': case 'child': case 'retired':
      return;
    default: {
      const base = INCOME[rec.job];
      if (!base) return;
      const inc = Math.round(base * rng.float(0.5, 1.5) * (0.6 + (sk.crafting + sk.trading) * 0.4) * Math.max(0.3, e.wealth));
      if (biz) {
        biz.till += inc;
        biz.earned += inc;
      } else {
        rec.coins += inc;
        rec.earned += inc;
      }
      const g = GOODS[rec.job];
      if (g && rng.chance(0.15)) {
        const item = rng.pick(g);
        if (biz) st.add(biz.store, item, 1);
        else invAdd(rec.inv, item, 1);
      }
    }
  }
}

// ------------------------------------------------------------ market
// Producers sell surplus food to the tavern kitchen and the bakery.
function market(L, rng) {
  const e = L.econ;
  const k = kitchenOf(L);
  const bakery = L.buildings.find((b) => b.type === 'bakery');
  const bb = bakery ? e.biz[bakery.id] : null;
  const pop = L.npcs.length;
  for (const rec of L.npcs) {
    if (!alive(rec) || rec.away || !rec.inv.length) continue;
    if (!['trapper', 'fisher', 'farmer', 'miner'].includes(rec.job) && !rec.forageResult) continue;
    for (const it of [...rec.inv]) {
      let buyer = null;
      // The smithy buys ore and coal to work.
      if (['iron_ore', 'coal', 'gold_ore'].includes(it.item)) {
        const smithy = L.buildings.find((b) => b.type === 'smithy' && e.biz[b.id]);
        if (smithy && st.count(e.biz[smithy.id].store, it.item) < 10) buyer = e.biz[smithy.id];
      }
      if (k && (RAW_FOOD.includes(it.item) || VEG.includes(it.item))) {
        const have = st.count(k.store, 'raw_meat') + st.count(k.store, 'fish') + VEG.reduce((n, v) => n + st.count(k.store, v), 0);
        const meals = MEAL_ITEMS.reduce((a, m) => a + st.count(k.store, m), 0);
        if (have < 6 + pop / 10 && meals < pop * 0.8 + 6 && !(it.item === 'wheat' && st.count(k.store, 'wheat') >= 4)) buyer = k;
      }
      if (!buyer && bb && it.item === 'wheat' && st.count(bb.store, 'wheat') < 8) buyer = bb;
      if (!buyer) continue;
      // Keep one for the family table.
      const sell = Math.max(0, it.count - 1);
      for (let i = 0; i < sell; i++) {
        const pr = price(it.item);
        let pay = buyer.till >= pr ? buyer : null;
        if (!pay) break;
        pay.till -= pr;
        rec.coins += pr;
        rec.earned += pr;
        invTake(rec.inv, it.item, 1);
        st.add(buyer.store, it.item, 1);
      }
    }
  }
}

// Households top up their pantries in the morning.
function shopForPantries(L, rng) {
  const e = L.econ;
  for (const b of L.buildings) {
    const pan = e.pantry[b.id];
    if (!pan || !b.household) continue;
    const members = L.npcs.filter((r) => r.home === b.id && alive(r));
    if (!members.length) continue;
    const food = st.total(pan);
    if (food >= members.length) continue;
    const buyer = members.filter((r) => r.age !== 'child').sort((a, c) => c.coins - a.coins)[0];
    if (!buyer) continue;
    const sellers = L.npcs.filter((r) => alive(r) && !r.away && r.home !== b.id && r.inv.length && ['farmer', 'fisher', 'trapper'].includes(r.job));
    for (let i = food; i < members.length * 2; i++) {
      let got = null;
      // Straight from a farmer, fisher or trapper...
      for (const sl of sellers) {
        const it = sl.inv.find((q) => q.count > 1 && (VEG.includes(q.item) || RAW_FOOD.includes(q.item)));
        if (!it || buyer.coins < price(it.item)) continue;
        buyer.coins -= price(it.item);
        sl.coins += price(it.item);
        sl.earned += price(it.item);
        invTake(sl.inv, it.item, 1);
        got = it.item;
        break;
      }
      // ...or bread from the bakery, or a pot of stew from the tavern.
      if (!got) got = buyBread(L, buyer) || (buyer.coins > 12 ? buyMeal(L, buyer, rng) : null);
      if (!got) break;
      st.add(pan, got, 1);
    }
  }
}

// Shops restock the goods they deal in from outside suppliers; the kitchen
// and the bakery also buy food from the farms around town (dearer than what
// local trappers, fishers and farmers sell).
function restock(L, rng) {
  const e = L.econ;
  const pop = L.npcs.filter(alive).length;
  const k = kitchenOf(L);
  if (k) {
    const raw = st.count(k.store, 'raw_meat') + st.count(k.store, 'fish') + VEG.reduce((n, v) => n + st.count(k.store, v), 0);
    const meals = MEAL_ITEMS.reduce((a, m) => a + st.count(k.store, m), 0);
    for (let i = raw; i < pop / 3 && meals < pop; i++) {
      const item = rng.pick(['raw_meat', 'carrot', 'cabbage', 'raw_meat', 'fish']);
      const cost = Math.round(price(item) * 1.4);
      if (k.till < cost + 10) break;
      k.till -= cost;
      st.add(k.store, item, 1);
    }
  }
  // The town looks after elders and others with no income: enough for
  // two meals a day.
  for (const r of L.npcs) {
    if (!alive(r) || r.away || r.age === 'child' || (r.job !== 'retired' && r.job !== 'beggar') || r.coins >= 11) continue;
    const give = Math.min(11 - r.coins, e.treasury - 10);
    if (give <= 0) break;
    e.treasury -= give;
    r.coins += give;
  }
  const bakery = L.buildings.find((b) => b.type === 'bakery');
  const bb = bakery ? e.biz[bakery.id] : null;
  if (bb) {
    for (let i = st.count(bb.store, 'wheat'); i < 8; i++) {
      if (bb.till < 12) break;
      bb.till -= 3;
      st.add(bb.store, 'wheat', 1);
    }
  }
  for (const rec of L.npcs) {
    if (!alive(rec)) continue;
    const t = traderOf(rec);
    if (!t || t === 'cook' || t === 'inn' || t === 'trapper' || t === 'fisher' || t === 'farmer') continue;
    const b = rec.work && rec.work.building != null ? e.biz[rec.work.building] : null;
    if (!b) continue;
    for (const k of STOCK[t] || []) {
      if (!ITEMS[k] || st.count(b.store, k) >= 2 || !rng.chance(0.35)) continue;
      const cost = Math.max(1, Math.round(price(k) * 0.4));
      if (b.till < cost + 10) break;
      b.till -= cost;
      st.add(b.store, k, 1);
    }
  }
}

// ------------------------------------------------------------ daily
function dailyNeeds(sim, L, day, rng) {
  for (const rec of L.npcs) {
    if (!alive(rec)) continue;
    if (rec.fed === 0 && !rec.away) rec.hungry++;
    else rec.hungry = 0;
    rec.fed = 0;
    rec.earnedY = rec.earned;
    rec.earned = 0;
    rec.forageResult = null;
    if (rec.hungry >= 2) {
      rec.hp = Math.max(1, (rec.hp ?? rec.maxHp) - 2);
      rec.mood = clamp(rec.mood - 0.12, 0, 1);
    } else if (!rec.sick) rec.hp = Math.min(rec.maxHp, (rec.hp ?? rec.maxHp) + 3);
    if (rec.ent && !rec.ent.dead) rec.ent.hp = rec.hp;
    rec.sick = false;
    // Mood drifts back toward normal.
    rec.mood += (0.55 - rec.mood) * 0.15;
    if (rec.away || rec.hungry < 1) continue;
    // Wheat in the pantry can be baked into bread at home.
    const pan = rec.home !== null && rec.home !== undefined ? L.econ.pantry[rec.home] : null;
    if (pan && st.count(pan, 'wheat') >= 2) {
      st.take(pan, 'wheat', 2);
      rec.fed = 1;
      rec.hungry = 0;
      continue;
    }
    // Hungry: go out and catch something. Parents who can't afford food go
    // themselves, and send the older children out too.
    if (rec.age === 'child') {
      const parents = rec.parents.map((i) => L.npcs[i]).filter((p) => p && alive(p) && !p.away);
      // Money's no use when the kitchen's bare: after two hungry days the
      // family goes out for food anyway.
      const canPay = parents.some((p) => p.coins >= 4);
      if (canPay && rec.hungry < 2) continue;
      for (const p of parents) {
        if (p.override && p.override.e > day * DAY) continue;
        const slot = freeSlot(p, day, 600, 120);
        if (slot) setOverride(p, slot.s, slot.e, 'forage', { forFamily: true });
      }
      if (!parents.length || rng.chance(0.5)) {
        const slot = freeSlot(rec, day, 780, 90);
        if (slot) setOverride(rec, slot.s, slot.e, 'forage');
      }
    } else if (rec.coins < 5 || !kitchenOf(L) || rec.hungry >= 2) {
      const slot = freeSlot(rec, day, 600, 120);
      if (slot && !(rec.override && rec.override.e > day * DAY)) setOverride(rec, slot.s, slot.e, 'forage');
    }
  }
  for (const b of Object.values(L.econ.biz)) {
    b.earnedY = b.earned;
    b.earned = 0;
  }
  if (sim) sim.dailySocial(L, day, rng);
}

// Each morning the tax collector takes the town's share of yesterday's
// earnings. Fractions of a coin carry over (so even small earners pay, and
// a higher rate really does bring in more); what can't be paid is owed.
function collectTaxes(L, day) {
  const e = L.econ;
  let total = 0;
  const take = (o, earned, purse) => {
    o.taxDue = Math.min(50, (o.taxDue || 0) + Math.max(0, earned) * e.tax);
    const t = Math.min(purse, Math.floor(o.taxDue));
    o.taxDue -= t;
    return t;
  };
  for (const rec of L.npcs) {
    if (!alive(rec) || rec.age === 'child' || rec.away) continue;
    const t = take(rec, rec.earnedY, rec.coins);
    rec.coins -= t;
    rec.taxPaid = t;
    total += t;
  }
  for (const b of Object.values(e.biz)) {
    const t = take(b, b.earnedY, b.till);
    b.till -= t;
    total += t;
  }
  e.treasury += total;
  e.taxY = total;
  e.taxDay = day;
}

// Evening: businesses share profits with their workers and the treasury
// pays the guards and the mayor.
function payWages(L, day) {
  const e = L.econ;
  const pop = L.npcs.filter(alive).length;
  for (const [id, b] of Object.entries(e.biz)) {
    const workers = L.npcs.filter((r) => alive(r) && !r.away && r.work && r.work.building === +id);
    if (!workers.length) continue;
    const float = Math.min(35, 10 + Math.round(pop / 4));
    const pay = Math.max(0, b.till - float);
    if (!pay) continue;
    const each = Math.floor(pay / workers.length);
    for (const w of workers) {
      w.coins += each;
      w.earned += each;
    }
    b.till -= each * workers.length;
  }
  let owed = 0;
  // The town pays its guards, mayor, priest and builders.
  const staff = L.npcs.filter((r) => alive(r) && !r.away && (r.job === 'guard' || r.job === 'mayor' || r.job === 'priest' || r.job === 'builder'));
  for (const r of staff) owed += r.job === 'guard' ? 5 : r.job === 'mayor' ? 8 : r.job === 'builder' ? 4 : 3;
  if (e.treasury >= owed) {
    e.treasury -= owed;
    for (const r of staff) {
      const wage = r.job === 'guard' ? 5 : r.job === 'mayor' ? 8 : r.job === 'builder' ? 4 : 3;
      r.coins += wage;
      r.earned += wage;
    }
    e.unpaid = 0;
  } else {
    e.unpaid++;
    for (const r of staff) r.mood = clamp(r.mood - 0.1, 0, 1);
    if (e.unpaid === 1) ledger(L, day, 'The treasury could not pay the guards today.');
  }
}

// The mayor looks over the books: taxes, relief for the hungry, laws.
function mayorReview(sim, L, day, rng) {
  const e = L.econ;
  const s = L.settlement;
  const m = mayorOf(L);
  const who = m ? `${s.type === 'village' ? 'Elder' : 'Mayor'} ${m.name.last}` : 'The council';
  const living = L.npcs.filter(alive);
  const pop = living.length + (sim ? sim.playerCount(s.id) : 0);
  const guards = living.filter((r) => r.job === 'guard').length + (sim ? sim.playerGuard(s.id) : 0);
  const reserve = pop * 8 + guards * 15;
  if (e.treasury < reserve && e.tax < 0.3) {
    e.tax = Math.round(Math.min(0.3, e.tax + 0.02) * 100) / 100;
    ledger(L, day, `${who} raised taxes to ${Math.round(e.tax * 100)}%: the coffers are thin.`);
  } else if (e.treasury > pop * 35 && e.tax > 0.04) {
    e.tax = Math.round(Math.max(0.02, e.tax - 0.02) * 100) / 100;
    ledger(L, day, `${who} lowered taxes to ${Math.round(e.tax * 100)}%.`);
  }
  // Bread for the hungry: when many go without, or anyone has for two days.
  const hungry = living.filter((r) => r.hungry >= 1 && !r.away);
  if ((hungry.length >= Math.max(2, pop * 0.12) || hungry.some((r) => r.hungry >= 2)) && e.treasury > 25) {
    let spent = 0;
    const k = kitchenOf(L);
    for (const r of hungry) {
      if (e.treasury < 4) break;
      if (r.home === null || r.home === undefined) continue;
      const pan = e.pantry[r.home] || (e.pantry[r.home] = {});
      const meal = k && st.take(k.store, 'stew', 1) ? 'stew' : 'bread';
      st.add(pan, meal, 1);
      // ...and sees that the one who went without actually eats it.
      if (r.hungry >= 2) {
        st.take(pan, meal, 1);
        r.fed = Math.max(r.fed || 0, 1);
      }
      e.treasury -= 4;
      if (k && meal === 'stew') k.till += 4;
      spent += 4;
    }
    if (spent) ledger(L, day, `${who} paid ¤${spent} to feed ${hungry.length} hungry folk.`);
  }
  // A kitchen with no money to buy ingredients gets a small grant.
  const k = kitchenOf(L);
  if (k && k.till < 10 && e.treasury > 60) {
    k.till += 20;
    e.treasury -= 20;
  }
  const r = e.recent;
  if (r.thefts >= 2 && e.fineScale < 1.6) {
    e.fineScale = Math.round(e.fineScale * 1.25 * 100) / 100;
    ledger(L, day, `${who} raised fines after a spate of thefts.`);
    r.thefts = 0;
  }
  // The town's laws: what people want, and what's been going on.
  reviewLaws(L, day, who);
  if (r.calm >= 6 && e.fineScale > 1) {
    e.fineScale = Math.max(1, Math.round(e.fineScale * 0.85 * 100) / 100);
    ledger(L, day, `${who} eased fines: the streets have been calm.`);
    r.calm = 0;
  }
  r.calm++;
  if (e.treasury > pop * 50 && day - e.festival > 5 && rng.chance(0.35)) {
    const spend = Math.round(e.treasury * 0.15);
    e.treasury -= spend;
    e.festival = day;
    for (const rec of living) rec.mood = clamp(rec.mood + 0.12, 0, 1);
    ledger(L, day, `A feast day was held in the square (¤${spend} from the treasury).`);
  }
  if (sim) sim.dailyCivic(L, day, rng);
}

// ------------------------------------------------------------ merchants
function tradeGoodsFor(L, rng) {
  const s = L.settlement;
  const out = [];
  if (s.coast || s.river || s.lake) out.push('fish', 'cooked_fish');
  if (s.nearMountain) out.push('iron_ore', 'coal', 'iron_ingot');
  if (['forest', 'taiga', 'jungle'].includes(s.biome)) out.push('planks', 'log_oak', 'leather');
  if (L.fields.length) out.push('wheat', 'bread', 'carrot');
  if (s.biome === 'desert') out.push('glass', 'sandstone');
  out.push('cloth', 'string', 'torch', 'apple', 'herb', 'lantern', 'book');
  return rng.shuffle(out);
}

// Goods a traveling merchant carries: bought from local businesses where
// possible, topped up with the region's specialties.
export function packGoods(L, rec, rng) {
  const e = L.econ;
  const goods = {};
  let budget = Math.round(rec.coins * 0.6);
  for (const b of Object.values(e.biz)) {
    for (const [k, n] of Object.entries(b.store)) {
      if (MEAL_ITEMS.includes(k) || n < 2 || budget < price(k)) continue;
      st.take(b.store, k, 1);
      st.add(goods, k, 1);
      b.till += price(k);
      budget -= price(k);
      rec.coins -= price(k);
    }
  }
  for (const k of tradeGoodsFor(L, rng).slice(0, 5)) if (ITEMS[k]) st.add(goods, k, rng.int(1, 4));
  return goods;
}

function merchants(sim, L, h, day, hod, rng) {
  if (!sim) return;
  for (const rec of L.npcs) {
    if (rec.errand && h >= rec.errand.ret && sim.diplomacy) sim.diplomacy.courierHome(L, rec, day);
    if (!rec.traveler || !alive(rec)) continue;
    const t = rec.trip || (rec.trip = { phase: 'home', since: day - 1 });
    const keen = sim.diplomacy ? Object.values(L.econ.relations || {}).reduce((m, r) => Math.max(m, r.trade || 0), 0) : 0;
    if (t.phase === 'home' && hod === 8 && day - t.since >= (keen >= 2 ? 1 : 2) && rng.chance(0.5 + keen * 0.1)) sim.departMerchant(L, rec, h, day, rng);
    else if (t.phase === 'away' && h >= t.ret) sim.returnMerchant(L, rec, day);
  }
  sim.merchantVisits(L, h, rng);
}

// ------------------------------------------------------------ deaths
function mortality(sim, L, day, rng) {
  if (!sim) return;
  for (const rec of L.npcs) {
    if (!alive(rec) || rec.away) continue;
    let cause = null;
    if (rec.age === 'elder' && rng.chance(0.0012)) cause = 'old age';
    else if (rec.job === 'trapper' && rng.chance(0.0006)) cause = 'a hunting accident';
    else if (rec.hungry >= 5 && rng.chance(0.15)) cause = 'starvation';
    else if (rec.hp <= 1 && rec.sick && rng.chance(0.05)) cause = 'illness';
    if (cause) sim.recordDeath(L, rec, cause, null, day);
  }
}

// ------------------------------------------------------------ tick
export function tickHour(sim, L, h) {
  const s = L.settlement;
  const day = Math.floor(h / DAY);
  const hm = h - day * DAY;
  const hod = Math.floor(hm / 60);
  const rng = new RNG(hash4(s.seed, day, hod, 0x71c));
  const sky = sim && sim.game ? townWeather(sim.game.seed, s, h + 30) : 'clear';
  const active = sim && sim.game && sim.game.active && sim.game.active.has(s.id);
  for (const rec of L.npcs) {
    if (!alive(rec) || rec.away) continue;
    // Out in the rain? Some would rather be at home (people in a town you're
    // in decide for themselves, on the spot).
    if (!active && sky !== 'clear') weatherBreak(rec, sky, day, hm + 30);
    // Schedule entries starting within this hour (active entities usually
    // handled these already, which the done-keys make harmless).
    const rest = day % 7 === rec.restDay;
    const sched = rest ? rec.schedule.rest : rec.schedule.work;
    const o = rec.override;
    for (let i = 0; i < sched.length; i++) {
      const en = sched[i];
      if (en.s < hm || en.s >= hm + 60) continue;
      if (o && h + (en.s - hm) >= o.s && h + (en.s - hm) < o.e && !(o.allowMeals && en.act === 'eat')) continue;
      entryStart(sim, L, rec, { entry: en, index: i, key: `${day}:${rest ? 'r' : 'w'}${i}` }, day, rng);
    }
    if (o && o.s >= h && o.s < h + 60) entryStart(sim, L, rec, { entry: o.entry, index: -1, key: `o${o.id}` }, day, rng);
    const mid = activityFor(rec, day, hm + 30);
    if (mid.entry.act === 'work') produce(L, rec, rng);
  }
  if (hod >= 7 && hod <= 20) market(L, rng);
  if (hod === 5) {
    // Are the fields moist today? Rain in the last day, or a well to water from.
    if (sim && sim.game) L.econ.moist = rainedRecently(sim.game.seed, s, h, 24) || !!(L.wells && L.wells.length);
    dailyNeeds(sim, L, day, rng);
  }
  if (hod === 6) restock(L, rng);
  if (hod === 7) shopForPantries(L, rng);
  if (hod === 8) collectTaxes(L, day);
  if (hod === 10) mayorReview(sim, L, day, rng);
  if (hod === 18) payWages(L, day);
  if (hod === 3) mortality(sim, L, day, rng);
  merchants(sim, L, h, day, hod, rng);
  if (sim) sim.hourly(L, h, day, hod, rng);
}

// Bring a settlement's books up to `abs` (absolute game minutes).
export function simulateTo(sim, L, abs) {
  const e = L.econ;
  // A settlement's story starts on the first morning of the world.
  if (e.lastAbs === null) e.lastAbs = Math.floor(Math.min(abs - 60, DAY + 360) / 60) * 60;
  if (abs - e.lastAbs > MAX_CATCHUP) e.lastAbs = Math.floor((abs - MAX_CATCHUP) / 60) * 60;
  let n = 0;
  while (e.lastAbs + 60 <= abs) {
    tickHour(sim, L, e.lastAbs);
    e.lastAbs += 60;
    n++;
  }
  return n;
}

// A synthetic traveling merchant from another settlement (random event).
export function makeVisitor(from, rng, h, goods) {
  const style = from.style;
  const fam = familyName(rng, style);
  return {
    from: from.id,
    fromName: from.name,
    name: personName(rng, style, fam),
    style,
    goods,
    arrive: h,
    leave: h + rng.int(5, 9) * 60,
    coins: rng.int(20, 60),
    traded: false,
    earned: 0,
    id: `v${hash4(from.id, h, rng.int(0, 1e6))}`,
  };
}
