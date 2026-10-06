// Where mods' biomes grow in a new world (round 63): kept apart (it needs
// nothing but the mods' state), so world generation can ask without
// bringing the rest of the mods in.
import { MODS } from './state.js';

// Where each of the game's biomes is found (warmth, then wetness: 0 to 1),
// as a new world picks them (see worldgen.pickBiome): for a landmass that
// only takes some, the nearest of those it takes.
export const CLIMATE_OF = {
  tundra: [0.1, 0.25], taiga: [0.22, 0.7], plains: [0.5, 0.25], forest: [0.45, 0.62], swamp: [0.55, 0.9], desert: [0.82, 0.2], savanna: [0.82, 0.53],
  jungle: [0.85, 0.76], mountain: [0.5, 0.5], ashland: [0.6, 0.2], cinderwood: [0.6, 0.5], geyser: [0.6, 0.8], mangrove: [0.7, 0.6], fungal: [0.5, 0.85], moor: [0.35, 0.5],
};

// In a new world, a splotch of land's biome as the mods have it: one of
// theirs instead (by its rules, at the share it takes), or, on a landmass
// that only takes some, the nearest of those to its climate. `roll(salt)`:
// the same number in [0, 1) for this splotch and salt every time.
export function modBiomeFor(b, L, temp, moist, roll, rules = MODS.biomeRules, allow = null) {
  let out = b;
  if (rules && rules.length && L) {
    for (const r of rules) {
      if (r.isles.length && !r.isles.includes(L.key)) continue;
      if (r.how === 'replace' ? b !== r.replaces : b === 'mountain' || temp < r.temp[0] || temp > r.temp[1] || moist < r.moist[0] || moist > r.moist[1]) continue;
      if (roll(r.salt) >= r.share) continue;
      out = r.key;
      break;
    }
  }
  if (allow && allow.length && !allow.includes(out)) {
    let best = allow[0];
    let bd = Infinity;
    for (const k of allow) {
      const c = climateOf(k, rules);
      const d = (c[0] - temp) ** 2 + (c[1] - moist) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    out = best;
  }
  return out;
}

// Where a biome's found (warmth, wetness): the game's, or a mod's (the
// middle of its climate, if it's given one).
export function climateOf(k, rules = MODS.biomeRules) {
  if (CLIMATE_OF[k]) return CLIMATE_OF[k];
  const r = rules && rules.find((q) => q.key === k);
  if (r && r.how === 'climate') return [(r.temp[0] + r.temp[1]) / 2, (r.moist[0] + r.moist[1]) / 2];
  if (r && r.replaces && CLIMATE_OF[r.replaces]) return CLIMATE_OF[r.replaces];
  return [0.5, 0.5];
}
