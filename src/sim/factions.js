// (Round 121) The town's factions, as a mayor sees them: the merchants, the
// farmers and fishers, the crafters, the watch, the clergy, the elders and
// the poor. Everyone grown up belongs to one (by their trade, their years
// and their purse), and each faction has its own idea of a fair tax, its own
// view of each law (the average of its members' own: see laws.js), and its
// own hopes for the town's spending. How well a faction thinks of whoever
// governs is worked out from all that, from how its people are faring (fed,
// in good spirits), and from what's been done for or against it lately.
//
// The same reckoning, run on a town as it would be (another tax, a law
// passed, a budget changed), is how the council window shows what each
// choice will do before it's made.
import { alive } from './econ.js';
import { LAWS, LAW_IDS, lawFits, lawOn, stance } from './laws.js';
import { clamp } from '../util/rng.js';

export const FACTIONS = {
  merchants: { name: 'Merchants', glyph: '¤', color: '#ffd070', tax: 0.05, about: 'Traders, innkeepers and the well-off: low taxes, open trade, safe streets.' },
  farmers: { name: 'Farmers & fishers', glyph: '♣', color: '#90d070', tax: 0.07, about: 'Those who work the land and the water: fair taxes, bread for the hungry, and the game law if they trap.' },
  crafters: { name: 'Crafters', glyph: '⌂', color: '#e0a070', tax: 0.07, about: 'Smiths, builders, carpenters, miners and labourers: work, building, and the freedom to fell and dig.' },
  guards: { name: 'Guards', glyph: '†', color: '#a0b8ff', tax: 0.12, about: 'The town\'s guards: their pay, a full watch, and order kept.' },
  clergy: { name: 'Clergy', glyph: '✦', color: '#f0e8ff', tax: 0.1, about: 'Priests and the devout: charity, the temple, and quiet nights.' },
  elders: { name: 'Elders', glyph: 'Ω', color: '#c8a0ff', tax: 0.09, about: 'The town\'s old folk: order, tradition and a full treasury.' },
  poor: { name: 'Poor folk', glyph: '•', color: '#ff9a7a', tax: 0.03, about: 'Beggars and those with next to nothing: alms, bread and low taxes.' },
};
export const FACTION_IDS = Object.keys(FACTIONS);

const TRADE = new Set(['merchant', 'innkeeper', 'barkeep', 'noble', 'jeweller', 'tailor', 'caravanner', 'scholar']);
const LAND = new Set(['farmer', 'fisher', 'trapper', 'handler', 'pearldiver', 'miller']);
const CRAFT = new Set(['blacksmith', 'carpenter', 'builder', 'laborer', 'miner', 'lumberjack', 'glassblower', 'sporewright', 'cook', 'baker', 'herbalist', 'researcher']);

// Which faction someone belongs to (null: a child, or a visitor).
export function factionOf(r) {
  if (!r || !alive(r) || r.age === 'child' || r.visitor || r.migrated) return null;
  if (r.job === 'guard') return 'guards';
  if (r.job === 'priest' || (r.traits || []).includes('devout')) return 'clergy';
  if (r.age === 'elder' || r.job === 'retired') return 'elders';
  if (r.job === 'beggar' || ((r.coins || 0) < 6 && !r.ruler && r.job !== 'mayor')) return 'poor';
  if (TRADE.has(r.job)) return 'merchants';
  if (LAND.has(r.job)) return 'farmers';
  if (CRAFT.has(r.job)) return 'crafters';
  return 'crafters';
}

// The grown-ups of the town, by faction.
export function members(L) {
  const out = {};
  for (const f of FACTION_IDS) out[f] = [];
  for (const r of L.npcs) {
    if (r.away) continue;
    const f = factionOf(r);
    if (f) out[f].push(r);
  }
  return out;
}

// What the town's spending can be set to: each line, three steps (lean,
// as usual, generous), and what each faction makes of the steps above and
// below the usual (per step). The costs are the town's own, worked out in
// office.js (see BUDGET_COST there).
export const BUDGET = {
  watch: { name: 'Watch pay', levels: ['Lean (¤4)', 'Usual (¤5)', 'Generous (¤7)'], short: ['Lean', 'Usual', 'Generous'], about: 'What each guard is paid a day.', likes: { guards: 9, merchants: 2, elders: 1, poor: -2 } },
  relief: { name: 'Relief', levels: ['None', 'The hungry fed', 'Alms as well'], short: ['None', 'Feed', 'Alms too'], about: 'Bread for the hungry when many go without; alms gives ¤1 a day to each of the poorest too.', likes: { poor: 11, clergy: 4, farmers: 2, elders: 1, merchants: -3 } },
  works: { name: 'Public works', levels: ['Nothing new', 'What\'s needed', 'Ambitious'], short: ['None', 'Needed', 'Ambitious'], about: 'Whether the town builds what it lacks (a tavern, a smithy, a bakery), and how readily.', likes: { crafters: 8, merchants: 2, farmers: -1, elders: -1 } },
  fetes: { name: 'Feast days', levels: ['None', 'When flush', 'Often'], short: ['None', 'If flush', 'Often'], about: 'How readily the treasury pays for a feast day in the square.', likes: { poor: 3, farmers: 2, crafters: 2, merchants: 1, guards: 1, clergy: -1, elders: -2 } },
};
export const BUDGET_IDS = Object.keys(BUDGET);
export const BUDGET_USUAL = { watch: 1, relief: 1, works: 1, fetes: 1 };

// The town as it is now (or as it would be, with `over` laid on top):
// the tax, the laws, the budget, the charter.
export function townState(L, T, over = {}) {
  const e = L.econ;
  const laws = {};
  for (const id of LAW_IDS) laws[id] = lawOn(L, id);
  return {
    tax: over.tax ?? e.tax,
    laws: { ...laws, ...(over.laws || {}) },
    budget: { ...BUDGET_USUAL, ...((T && T.budget) || {}), ...(over.budget || {}) },
    charter: over.charter ?? (T ? T.charter : null),
    favour: over.favour || null,
  };
}

// How each faction sees each law (its members' average), cached for the
// day (people's minds don't change by the hour).
const stanceCache = new WeakMap();
export function factionStances(L, M = members(L), day = 0) {
  const c = stanceCache.get(L);
  if (c && c.day === day && c.n === L.npcs.length) return c.v;
  const v = {};
  for (const f of FACTION_IDS) {
    v[f] = {};
    const list = M[f];
    for (const id of LAW_IDS) v[f][id] = list.length ? list.reduce((n, r) => n + stance(r, id), 0) / list.length : 0;
  }
  stanceCache.set(L, { day, n: L.npcs.length, v });
  return v;
}

// One faction's approval (0 to 100) of the town's government, in a given
// state; and the reasons, largest first ({ text, v }).
//   `charters`: the CHARTERS table (passed in, to keep this file free of
// the office's own imports).
export function approvalOf(L, T, f, state, M, stances, charters = null) {
  const list = M[f];
  if (!list.length) return { v: 50, why: [] };
  const why = [];
  const add = (v, text) => {
    if (Math.abs(v) >= 0.5) why.push({ v, text });
    return v;
  };
  let a = 50;
  const mood = list.reduce((n, r) => n + (r.mood ?? 0.55), 0) / list.length;
  a += add((mood - 0.55) * 70, mood >= 0.55 ? 'in good spirits' : 'low spirits');
  const hungry = list.filter((r) => (r.hungry || 0) >= 1).length / list.length;
  a += add(-hungry * 35, 'going hungry');
  // The tax, against what they think fair.
  const pref = FACTIONS[f].tax;
  a += add(clamp((pref - state.tax) * 180, -25, 12), state.tax > pref ? `taxes at ${Math.round(state.tax * 100)}% (${Math.round(pref * 100)}% is fair)` : 'taxes they think fair');
  // The laws in force, and laws they badly want that aren't.
  const st = stances[f];
  let lawSum = 0;
  let worst = null;
  for (const id of LAW_IDS) {
    if (!lawFits(L.settlement, id, !!T) && !state.laws[id]) continue;
    const s = st[id] || 0;
    const v = state.laws[id] ? s * 7 : s > 0.35 ? -(s - 0.35) * 10 : 0;
    lawSum += v;
    if (!worst || v < worst.v) worst = { v, id };
  }
  a += add(lawSum, lawSum >= 0 ? 'the laws suit them' : worst ? `the ${LAWS[worst.id].name.toLowerCase()}${state.laws[worst.id] ? '' : ' not passed'}` : 'the laws');
  // The budget.
  for (const id of BUDGET_IDS) {
    const step = (state.budget[id] ?? 1) - 1;
    const like = BUDGET[id].likes[f] || 0;
    if (step && like) a += add(step * like, `${BUDGET[id].name.toLowerCase()}: ${BUDGET[id].levels[state.budget[id]].toLowerCase()}`);
  }
  // The charter they're governed under.
  const ch = charters && state.charter ? charters[state.charter] : null;
  if (ch && ch.mod && ch.mod[f]) a += add(ch.mod[f], `governed as ${ch.short || ch.name.toLowerCase()}`);
  // What's been done for them or against them lately (decisions, promises
  // kept and broken, appointments: see office.js), fading day by day.
  const fav = (T && T.favour ? T.favour[f] || 0 : 0) + (state.favour ? state.favour[f] || 0 : 0);
  a += add(fav, fav >= 0 ? 'what you\'ve done for them' : 'what you\'ve done to them');
  // What they think of whoever governs, person to person.
  const reg = T && T.regard ? T.regard[f] || 0 : 0;
  a += add(reg, reg >= 0 ? 'they like you' : 'they dislike you');
  why.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
  return { v: Math.round(clamp(a, 0, 100)), why };
}

// Every faction's approval, and the town's overall (each faction counted
// by its numbers).
export function approvals(L, T, over = {}, charters = null, day = 0) {
  const M = members(L);
  const stances = factionStances(L, M, day);
  const state = townState(L, T, over);
  const by = {};
  let n = 0;
  let sum = 0;
  for (const f of FACTION_IDS) {
    const r = approvalOf(L, T, f, state, M, stances, charters);
    by[f] = { ...r, n: M[f].length };
    n += M[f].length;
    sum += r.v * M[f].length;
  }
  return { by, overall: n ? Math.round(sum / n) : 50, M };
}

// What a change would do to each faction's approval (positive: better
// thought of): { faction: delta }, and overall.
export function preview(L, T, over, charters = null, day = 0) {
  const now = approvals(L, T, {}, charters, day);
  const then = approvals(L, T, over, charters, day);
  const out = {};
  for (const f of FACTION_IDS) if (now.by[f].n) out[f] = then.by[f].v - now.by[f].v;
  return { by: out, overall: then.overall - now.overall };
}

// The thing a faction most wants of the town just now: a short line.
export function wish(L, T, f, state, M, stances) {
  const list = M[f];
  if (!list.length) return '';
  if (list.filter((r) => (r.hungry || 0) >= 1).length * 3 >= list.length) return 'bread: too many of them are hungry';
  const pref = FACTIONS[f].tax;
  if (state.tax - pref >= 0.04) return `lower taxes (${Math.round(pref * 100)}% would suit them)`;
  let best = null;
  for (const id of LAW_IDS) {
    if (!lawFits(L.settlement, id, !!T) && !state.laws[id]) continue;
    const s = stances[f][id] || 0;
    const v = state.laws[id] ? -s : s;
    if (v > 0.3 && (!best || v > best.v)) best = { id, v };
  }
  if (best) return `${state.laws[best.id] ? 'the' : /^[aeiou]/i.test(LAWS[best.id].name) ? 'an' : 'a'} ${LAWS[best.id].name.toLowerCase()} ${state.laws[best.id] ? 'thrown out' : 'passed'}`;
  for (const id of BUDGET_IDS) {
    const like = BUDGET[id].likes[f] || 0;
    const lv = state.budget[id] ?? 1;
    if (like >= 4 && lv < 2) return `${BUDGET[id].name.toLowerCase()}: ${BUDGET[id].levels[lv + 1].toLowerCase()}`;
  }
  return 'nothing pressing';
}
