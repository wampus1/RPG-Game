// Each people of the Dagoni Islands has a trade nobody else has, and a
// building for it:
//   Thessa: the windmill, and its miller, who grinds the island's wheat
//     into flour (and bakes a little of it), its sails turning over the
//     roofs. (Great Windmills: twice the grinding, cheaper bread.)
//   Kharos: the glassworks, and its glassblower, at a kiln that never goes
//     out: window glass, lanterns, black-glass blades, and smoked goggles
//     against the mountain's ash. (Glassblowing: cheaper wares, and glass
//     sent abroad.)
//   Myrrow's Mirefolk: the spore cellar, and its sporewright, who grows
//     glowcaps in beds of peat in the dark: broths, teas, and the fogsight
//     tincture that lets you see by night.
//   Myrrow's Stiltfolk: the pearl house, and its pearl diver, who dives off
//     the stilts every morning: pearls, and strings of them. (Pearl Diving:
//     twice the pearls, and pearls sold abroad.)
//   A licensed player can take up the trade too (see careers.js): a
//   licensed pearl diver finds pearls when swimming in the sea.
import { lawOn } from './laws.js';

export const THESSA_STYLES = ['vale', 'north', 'sun', 'wild', 'high'];

export const ISLE_TRADES = {
  miller: { styles: THESSA_STYLES, building: 'windmill', bench: 'millstone', tech: 'windmills', isle: 'thessa' },
  glassblower: { styles: ['ember'], building: 'glassworks', bench: 'glass_kiln', tech: 'glassblowing', isle: 'kharos' },
  sporewright: { styles: ['mist'], building: 'sporehouse', bench: 'spore_bed', tech: 'spore_lore', isle: 'myrrow' },
  pearldiver: { styles: ['tide'], building: 'pearlhouse', bench: 'pearl_table', tech: 'pearl_diving', isle: 'myrrow' },
};
export const TRADE_BUILDINGS = new Set(Object.values(ISLE_TRADES).map((t) => t.building));

// The trade of a people (by its building style), if it has one.
export function tradeOfStyle(style) {
  for (const [job, t] of Object.entries(ISLE_TRADES)) if (t.styles.includes(style)) return job;
  return null;
}

// Does this town have the trade at work: its building up, someone in it?
export function tradeWorking(L, job) {
  const T = ISLE_TRADES[job];
  if (!T || !L || !L.buildings) return false;
  const b = L.buildings.find((q) => q.type === T.building && !q.underConstruction);
  return !!b && (L.npcs || []).some((r) => r.job === job && r.alive !== false && !r.migrated);
}

// What a trade's goods cost here, beside the usual: Thessa's great
// windmills make bread and flour cheaper and wheat dearer; Kharos's
// glassblowers sell for less once the realm knows glassblowing.
const BREADS = new Set(['bread', 'flour']);
const GLASSWARE = new Set(['glass', 'lantern', 'ash_goggles', 'obsidian_blade']);
export function tradePrice(L, k, selling) {
  if (!L || !L.settlement || !L.sim || !L.sim.tech) return 1;
  const T = L.sim.tech;
  const s = L.settlement;
  if (!selling && BREADS.has(k) && T.has(s, 'windmills') && tradeWorking(L, 'miller')) return 0.75;
  if (selling && k === 'wheat' && T.has(s, 'windmills') && tradeWorking(L, 'miller')) return 1.33;
  if (!selling && GLASSWARE.has(k) && T.has(s, 'glassblowing') && tradeWorking(L, 'glassblower')) return 0.75;
  // (A pearl fetches less where the stilt folk share the catch.)
  if (selling && k === 'pearl' && lawOn(L, 'catchShare')) return 0.8;
  return 1;
}

// Each week: glass and pearls sold abroad, where the realm knows how.
export function tradeWeekly(L) {
  const T = L.sim && L.sim.tech;
  if (!T || !L.econ) return 0;
  const s = L.settlement;
  let coin = 0;
  if (T.has(s, 'glassblowing') && tradeWorking(L, 'glassblower')) coin += 10;
  if (T.has(s, 'pearl_diving') && tradeWorking(L, 'pearldiver')) coin += 10;
  L.econ.treasury += coin;
  return coin;
}

// A day's work at the trade: what the tradesfolk make for their shelves
// (two lots, where the realm has learned to do it better).
export const TRADE_GOODS = {
  miller: ['flour', 'flour', 'bread', 'hay_bale'],
  glassblower: ['glass', 'glass', 'lantern', 'obsidian_blade', 'ash_goggles'],
  sporewright: ['glowcap', 'glowcap', 'mushroom', 'mushroom_broth', 'spore_tincture'],
  pearldiver: ['pearl', 'crab_meat', 'pearl', 'pearl_necklace'],
};
export function tradeOutput(L, job, rng) {
  const T = ISLE_TRADES[job];
  const list = TRADE_GOODS[job];
  if (!T || !list) return [];
  const twice = L.sim && L.sim.tech && L.sim.tech.has(L.settlement, T.tech);
  const out = [rng.pick(list)];
  if (twice) out.push(rng.pick(list));
  return out;
}
