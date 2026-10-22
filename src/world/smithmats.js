// (Round 132) What goes into a piece at the forge besides its iron (see
// game/smithing.js): the smith's additives, each with a nature of its own
// that's hidden till you've worked it once (as a cook learns what a thing
// is by cooking with it), and the old places' own materials, rarer the
// deeper and off the greater masters.
//   A trait leans what a piece comes out with toward some modifiers (a
// fiery thing toward searing blades and fire-tipped arrows), or changes
// the work itself (`pure`: the work goes better; `flawed`: worse, and
// flaws likelier; `tough`: flaws less likely). (Round 137) Or it's a
// trigger (`trig`: "battle-born", when you're struck), that sets off one
// of the piece's modifiers or its ability; or an ability (`ab`:
// "radiant", a healing aura). See world/triggers.js. A material of rare
// quality or better lets a piece reach five stars.
//   (Plain data: items.js makes items of the materials; nothing here knows
// of it.)

import { TRIGGERS, ABILITIES } from './triggers.js';

// How rare a material is: its name and colour.
export const RARITY = {
  common: { name: 'Common', color: '#c8c0b0', n: 0 },
  uncommon: { name: 'Uncommon', color: '#70d070', n: 1 },
  rare: { name: 'Rare', color: '#60a8f0', n: 2 },
  vrare: { name: 'Very Rare', color: '#c070f0', n: 3 },
};

// What each trait does to a piece: the modifiers it leans toward, by kind
// of gear (each a weight), the time it holds its modifier to, or what it
// does to the work.
export const TRAITS = {
  keen: { name: 'keen', lean: { blade: { keen: 3, merciless: 1 }, bow: { piercing: 3 }, tool: { keen: 3 }, shield: { duel: 1 } } },
  fiery: { name: 'fiery', lean: { blade: { searing: 3 }, bow: { fire: 3 }, shield: { smoulder: 3 }, armor: { fireproof: 3 }, tool: { smelting: 2 } } },
  frosty: { name: 'cold', lean: { blade: { frost: 3 }, bow: { rime: 3 }, armor: { furred: 3 } } },
  venomous: { name: 'venomous', lean: { blade: { venom: 3 }, bow: { barbed: 3 }, armor: { spiked: 1 } } },
  light: { name: 'light', lean: { blade: { swift: 3 }, bow: { quick: 3 }, shield: { light: 3 }, armor: { feather: 2, fleet: 2 }, tool: { quick: 3 } } },
  heavy: { name: 'heavy', lean: { blade: { brutal: 3 }, shield: { stalwart: 3, repel: 1 }, armor: { sturdy: 3 } } },
  vital: { name: 'living', lean: { blade: { thirst: 3 }, shield: { rally: 2 }, armor: { hale: 3, tireless: 1 } } },
  cruel: { name: 'cruel', lean: { blade: { merciless: 3, venom: 1 }, armor: { spiked: 3 }, shield: { thorns: 3 } } },
  far: { name: 'far-reaching', lean: { bow: { far: 3 }, tool: { long: 3 } } },
  lucky: { name: 'lucky', lean: { tool: { fortune: 3, prospect: 2 }, bow: { thrifty: 3 } } },
  deft: { name: 'deft', lean: { shield: { duel: 3, catch: 2 }, bow: { twin: 3 }, blade: { keen: 1 } } },
  tireless: { name: 'tireless', lean: { armor: { tireless: 3 }, shield: { rally: 1 }, tool: { lumber: 2 } } },
  // What changes the work itself.
  pure: { name: 'pure', work: 0.08 },
  flawed: { name: 'brittle', work: -0.08, flaw: 0.25 },
  tough: { name: 'tough', flaw: -0.5 },
};
// (Round 137) The triggers and the abilities, each a trait of its own.
for (const [k, T] of Object.entries(TRIGGERS)) TRAITS[k] = { name: T.trait, trig: k };
for (const [k, A] of Object.entries(ABILITIES)) TRAITS[k] = { name: A.trait, ab: k };

// The old places' own materials (items of their own: see items.js), and
// how rare each is.
export const MATERIALS = {
  // Uncommon: off the lesser masters, and the middle floors.
  grave_iron: { name: 'Grave Iron', rarity: 'uncommon', value: 30, color: '#6a7080', traits: ['cruel', 'dusk', 'shade'], about: 'Iron dug out of a barrow, black and cold to the touch. It takes an edge that bites deep, and darker after dark.' },
  cave_silver: { name: 'Cave Silver', rarity: 'uncommon', value: 32, color: '#d8e0e8', traits: ['pure', 'deft', 'parry'], about: 'Bright silver from far underground, so pure it flows under the hammer.' },
  beast_sinew: { name: 'Beast Sinew', rarity: 'uncommon', value: 26, color: '#c8a070', traits: ['far', 'tough', 'shot'], about: 'Dried sinew off some great beast of the deep: a bowyer\'s treasure, and it binds anything.' },
  ironbark: { name: 'Ironbark', rarity: 'uncommon', value: 28, color: '#5a4030', traits: ['heavy', 'tough', 'roots'], about: 'Wood from a tree that grew in the dark, hard as iron and twice as heavy.' },
  bog_resin: { name: 'Bog Resin', rarity: 'uncommon', value: 24, color: '#8a7a2a', traits: ['venomous', 'soak', 'plague'], about: 'Sticky amber resin from a drowned place, bitter and poisonous.' },
  // Rare: off the greater masters, and deep down now and then.
  star_iron: { name: 'Star Iron', rarity: 'rare', value: 90, color: '#a8b8f0', traits: ['pure', 'keen', 'light', 'starfall'], about: 'Iron that fell from the sky long ago, shot through with silver threads. A smith works with it once in a lifetime.' },
  drake_scale: { name: 'Drake Scale', rarity: 'rare', value: 85, color: '#c84a2a', traits: ['fiery', 'heavy', 'kill', 'meteor'], about: 'A scale as big as your hand, still warm, from something that should not exist.' },
  living_amber: { name: 'Living Amber', rarity: 'rare', value: 80, color: '#f0a830', traits: ['vital', 'lucky', 'struck', 'halo'], about: 'Amber with something moving in it. It mends, they say, whatever it\'s set into.' },
  wraith_silk: { name: 'Wraith Silk', rarity: 'rare', value: 80, color: '#c8d8e8', traits: ['light', 'bloodied', 'phantom'], about: 'Grey thread spun of nothing at all, cold, and weightless.' },
  rime_heart: { name: 'Rime Heart', rarity: 'rare', value: 85, color: '#a8e8f8', traits: ['frosty', 'tireless', 'glacier'], about: 'A lump of ice that never melts, beating faintly.' },
  // Very rare: off the greatest masters, and hardly ever else.
  heartstone: { name: 'Heartstone', rarity: 'vrare', value: 260, color: '#e83a5a', traits: ['pure', 'vital', 'deathblow', 'beacon'], about: 'A red stone the size of a heart, warm and slow-beating. A blank cast can be made of it; few things else are worthy.' },
  void_glass: { name: 'Void Glass', rarity: 'vrare', value: 280, color: '#3a2a5a', traits: ['pure', 'keen', 'delve', 'stasis'], about: 'Glass as black as the space between stars. It cuts what it touches, even light.' },
  phoenix_ash: { name: 'Phoenix Ash', rarity: 'vrare', value: 270, color: '#ff9030', traits: ['pure', 'fiery', 'brink', 'nova'], about: 'Ash that will not stay cold. Breathe on it and it glows.' },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS);
const BY_RARITY = { uncommon: [], rare: [], vrare: [] };
for (const [k, m] of Object.entries(MATERIALS)) BY_RARITY[m.rarity].push(k);

// What the smith's everyday additives are, as the forge knows them.
export const ADDITIVES = {
  coal: { traits: ['heavy', 'block'] },
  bone: { traits: ['light', 'tumble'] },
  ash: { traits: ['tough', 'fall'] },
  salt: { traits: ['tough', 'soak'] },
  feather: { traits: ['far', 'light', 'draw'] },
  ember_pod: { traits: ['fiery', 'crit'] },
  sulfur: { traits: ['fiery', 'flawed', 'thunder'] },
  frost_crystal: { traits: ['frosty', 'afflicted'] },
  slime_gel: { traits: ['venomous', 'siphon'] },
  obsidian_shard: { traits: ['keen', 'flawed', 'first', 'rend'] },
  kav_scrap: { traits: ['light', 'pure', 'chain'] },
  herb: { traits: ['vital', 'mend'] },
  glowcap: { traits: ['vital', 'dusk', 'wisps'] },
  gold_ingot: { traits: ['lucky', 'pure', 'midas'] },
  pearl: { traits: ['deft', 'soak', 'aegis'] },
  old_coin: { traits: ['lucky', 'ore'] },
  shard_ruby: { traits: ['fiery', 'pure', 'smite'] },
  shard_sapphire: { traits: ['frosty', 'pure', 'winded'] },
  shard_emerald: { traits: ['vital', 'bramble'] },
  shard_topaz: { traits: ['lucky', 'quicken', 'seek'] },
  shard_amethyst: { traits: ['deft', 'combo', 'blades'] },
  shard_onyx: { traits: ['cruel', 'mob', 'cyclone'] },
  shard_moonstone: { traits: ['tireless', 'dusk', 'hit'] },
  shard_bloodstone: { traits: ['cruel', 'bloodied', 'rage'] },
  // (Round 137) Things that were never put in a forge before.
  clay: { traits: ['tough', 'mine', 'shatter'] },
  glass: { traits: ['light', 'flawed', 'dodge'] },
  antler: { traits: ['heavy', 'fell'] },
  coral: { traits: ['vital', 'streak'] },
  relic_shard: { traits: ['pure', 'boss'] },
  // (Round 138) And more, with the new triggers and abilities in them.
  tiger_pelt: { traits: ['heavy', 'back', 'spirit'] },
  scorpion_sting: { traits: ['venomous', 'oneshot', 'lance'] },
  honeycomb: { traits: ['vital', 'eat', 'swarm'] },
  fish_oil: { traits: ['fiery', 'fish', 'firewall'] },
  moth_dust: { traits: ['light', 'veil'] },
  mangrove_pod: { traits: ['tough', 'rain', 'geyser'] },
  sun_seed: { traits: ['vital', 'dawn', 'renew'] },
  pink_feather: { traits: ['far', 'gale'] },
  peat_turf: { traits: ['heavy', 'ironskin'] },
  ambergris: { traits: ['lucky', 'victory'] },
  mothers_tear: { traits: ['pure', 'smash', 'pact'] },
  reeds: { traits: ['far', 'shotat', 'hook'] },
  lantern_pod: { traits: ['vital', 'guardbreak', 'well'] },
  prayer_beads: { traits: ['pure', 'undead'] },
};
for (const [k, m] of Object.entries(MATERIALS)) ADDITIVES[k] = { traits: m.traits, rarity: m.rarity };

export const rarityOf = (k) => (MATERIALS[k] ? MATERIALS[k].rarity : 'common');
export const isAdditive = (k) => !!ADDITIVES[k];
// A rare material or better: a piece can reach five stars with it.
export const lifts = (k) => RARITY[rarityOf(k)].n >= 2;

// A chest deep in an old place (`t`: its loot tier): now and then one of
// the uncommon materials, deep enough a rare one. Or null.
export function chestMaterial(t, rng, rich = 1) {
  if (t < 1.5) return null;
  const p = Math.min(0.22, (0.04 + (t - 1.5) * 0.04) * rich);
  if (!rng.chance(p)) return null;
  const rare = t >= 4 && rng.chance(Math.min(0.25, 0.06 + (t - 4) * 0.05));
  const pool = rare ? BY_RARITY.rare : BY_RARITY.uncommon;
  return pool[rng.int(0, pool.length - 1)];
}

// What a master leaves of the place's materials (one or two, moderate,
// better off a greater master: `tier` its tier, 1 to 4).
export function bossMaterials(tier, rng) {
  const n = rng.chance(0.5) ? 2 : 1;
  const w = [
    null,
    { uncommon: 88, rare: 12, vrare: 0 },
    { uncommon: 60, rare: 38, vrare: 2 },
    { uncommon: 25, rare: 65, vrare: 10 },
    { uncommon: 10, rare: 60, vrare: 30 },
  ][Math.max(1, Math.min(4, tier | 0))];
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = rng.float(0, w.uncommon + w.rare + w.vrare);
    const rar = (r -= w.uncommon) < 0 ? 'uncommon' : (r -= w.rare) < 0 ? 'rare' : 'vrare';
    const pool = BY_RARITY[rar];
    out.push(pool[rng.int(0, pool.length - 1)]);
  }
  return out;
}
