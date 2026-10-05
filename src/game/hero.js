// Who you are: made on the character screen before a new game. Your looks,
// what you start with, four stats, your traits (good ones and flaws), and
// where you come from: washed up on the shore after a shipwreck, or born
// and raised in one of the island's towns (where everyone knows you).
import { RNG, hash4 } from '../util/rng.js';
import { personName, familyName, CULTURES } from '../world/names.js';

export const STATS = [
  { key: 'str', name: 'Strength', about: 'Each point: +10% melee damage and +8% digging and chopping speed.' },
  { key: 'agi', name: 'Agility', about: 'Each point: 5% faster walking, 6% faster attacks and +0.4 stamina.' },
  { key: 'end', name: 'Endurance', about: 'Each point: +2 health.' },
  { key: 'cha', name: 'Charm', about: 'Each point: prices 3% better and reputation gains 12% larger.' },
];
export const STAT_BASE = 2;
export const STAT_MAX = 5;
export const STAT_POINTS = 4; // to spend above the base

// Traits: what you're good at (the old skills are traits too), and flaws.
// You pick up to TRAIT_PICKS good ones; each flaw you take (as many as
// you like) lets you pick one more. A flaw never takes away what a stat
// gives (health, stamina, speed, damage, prices, liking): it costs you
// somewhere else.
export const TRAIT_PICKS = 4;
export const TRAITS = {
  // Good.
  angler: { name: 'Angler', about: 'Fish bite 25% sooner, the strike window lasts 50% longer and you reel in 25% faster.' },
  haggler: { name: 'Haggler', about: 'Prices are 8% better when you buy and sell.' },
  forager: { name: 'Forager', about: 'Plants and bushes give one extra item 60% of the time.' },
  miner: { name: 'Digger', about: 'Mining and digging are 25% faster.' },
  brawler: { name: 'Brawler', about: '+1 damage on every hit.' },
  farmer: { name: 'Green Thumb', about: 'Every ripe harvest gives one extra crop.' },
  sneak: { name: 'Light Step', about: 'People notice your crimes from 30% less far away.' },
  healer: { name: 'Herbalist', about: 'Food and herbs heal 2 more health.' },
  duelist: { name: 'Duelist', about: 'Your parry window is 50% longer, and 18% of your hits are critical instead of 10%.' },
  shieldbearer: { name: 'Shield Wall', about: 'Blocking with a shield costs 40% less stamina and stops 10% more damage.' },
  marksman: { name: 'Marksman', about: 'Arrows do +2 damage, you draw 15% faster and full-power shots crit 22% of the time instead of 12%.' },
  tracker: { name: 'Tracker', about: 'Animals you kill drop one more meat and hide more often. You spot bandit camps from 110 blocks instead of 45.' },
  tinker: { name: 'Tinker', about: 'Crafting gives back one material 25% of the time, and gear you make tends to get more stars.' },
  cook: { name: 'Cook', about: 'Cooking gives one extra portion 35% of the time.' },
  scholar: { name: 'Scholar', about: 'Research at a research table earns 50% more points.' },
  rider: { name: 'Horseman', about: 'Horses and wagons are 20% faster with you on them.' },
  sailor: { name: 'Sailor', about: 'Rafts go 35% faster with you paddling.' },
  honest_face: { name: 'Honest Face', about: 'Everyone starts with an opinion of you 8 points higher.' },
  tough: { name: 'Tough', about: '+4 health.' },
  swimmer: { name: 'Strong Swimmer', about: 'Water doesn\'t slow you down.' },
  lucky: { name: 'Lucky', about: 'Coins and gems on your fishing line are twice as likely.' },
  early_riser: { name: 'Early Riser', about: 'From 5:00 to 10:00 your stamina comes back twice as fast.' },
  night_owl: { name: 'Night Owl', about: 'From 20:00 to 2:00 your stamina comes back twice as fast.' },
  nimble: { name: 'Nimble', about: 'A dodge roll costs half the stamina and goes 3 blocks instead of 2.' },
  tireless: { name: 'Tireless', about: '+3 stamina, and stamina comes back 40% faster.' },
  sure_footed: { name: 'Sure-Footed', about: 'Heavy hits never stagger you or knock you back.' },
  iron_stomach: { name: 'Iron Stomach', about: 'Every meal heals 1 more. Raw food heals as much as cooked.' },
  devout: { name: 'Devout', about: 'Priests and devout people like you 15 points more. Praying at an altar also gives 4 blue hearts.' },
  silver_tongue: { name: 'Silver Tongue', about: 'Reputation gains are 25% larger.' },
  steady_hands: { name: 'Steady Hands', about: 'Lock pins give 40% more warning before they bind, and a slip strains your pick less.' },
  night_eyes: { name: 'Night Eyes', about: 'The light around you reaches 6 blocks instead of 4 at night and underground.' },
  fire_hardened: { name: 'Fire-Hardened', about: 'Burning hurts you half as often.' },
  northern_blood: { name: 'Northern Blood', about: 'Cold and frost slow you for half as long.' },
  // Flaws: each lets you pick one more good trait.
  squeamish: { name: 'Squeamish', about: 'Raw meat and raw fish don\'t heal you at all.', flaw: true },
  notorious: { name: 'Notorious', about: 'People notice your crimes from 25% further away.', flaw: true },
  night_blind: { name: 'Night Blind', about: 'The light around you reaches 2 blocks instead of 4 at night and underground.', flaw: true },
  poor_swimmer: { name: 'Poor Swimmer', about: 'Water slows you down 50% more than it does other people.', flaw: true },
  heavy_handed: { name: 'Heavy-Handed', about: 'Lock pins give 30% less warning before they bind, and a slip strains your pick more.', flaw: true },
  burner: { name: 'Burns the Food', about: 'Cooking ruins the whole batch 20% of the time.', flaw: true },
  butterfingers: { name: 'Butterfingers', about: 'A biting fish gets away a third sooner, and you reel in 20% slower.', flaw: true },
  unlucky: { name: 'Unlucky', about: 'Coins and gems never come up on your fishing line.', flaw: true },
  seasick: { name: 'Seasick', about: 'Rafts go 25% slower with you paddling.', flaw: true },
  saddle_sore: { name: 'Saddle-Sore', about: 'Horses and wagons are 20% slower with you on them.', flaw: true },
};
// (Older characters had their skills apart: they're traits now.)
export const SPECIALTIES = {};

export const ORIGINS = {
  crash: { name: 'Crash Landing', about: 'Your ship broke up on the rocks. You wake on a beach with what washed ashore, and nobody on the island knows you.' },
  native: { name: 'Island Native', about: 'You were born and raised in one of the island\'s towns. You start at home with your family, and the whole town knows you.' },
  star: { name: 'Fallen Star', about: 'You fell from the night sky and landed in a crater near a village on Thessa. You have one glowing wing. Some people are wary of you. Your wing lets you do a second dodge roll right after the first without stamina; it then fades and grows back over 20 seconds.' },
};
// (A fallen star's wing: how long it takes to come back once spent.)
export const WING_BACK = 20;

// What you start with (on top of a few common things).
export const KITS = {
  wanderer: { name: 'Wanderer', items: [['stone_sword', 1], ['wood_pickaxe', 1], ['wood_axe', 1], ['leather_tunic', 1], ['leather_boots', 1], ['torch', 8], ['bread', 4]], coins: 20 },
  soldier: { name: 'Soldier', items: [['iron_sword', 1], ['iron_helmet', 1], ['leather_tunic', 1], ['leather_trousers', 1], ['bread', 3], ['torch', 4]], coins: 10 },
  fisher: { name: 'Fisher', items: [['fishing_rod', 1], ['straw_hat', 1], ['linen_shirt', 1], ['bucket', 1], ['cooked_fish', 4], ['wood_axe', 1]], coins: 20 },
  farmer: { name: 'Farmer', items: [['hoe', 1], ['seeds', 12], ['cabbage_seeds', 6], ['straw_hat', 1], ['wool_trousers', 1], ['bucket', 1], ['bread', 5]], coins: 20 },
  builder: { name: 'Builder', items: [['stone_pickaxe', 1], ['stone_axe', 1], ['stone_shovel', 1], ['planks', 32], ['cobblestone', 24], ['door', 2], ['workbench', 1], ['chest', 1], ['leather_cap', 1], ['bread', 3]], coins: 10 },
  merchant: { name: 'Merchant', items: [['dagger', 1], ['fine_coat', 1], ['wool_trousers', 1], ['bread', 3], ['torch', 4]], coins: 90 },
  hunter: { name: 'Hunter', items: [['bow', 1], ['arrow', 24], ['dagger', 1], ['leather_cap', 1], ['leather_trousers', 1], ['cooked_meat', 3]], coins: 15 },
  miner: { name: 'Miner', items: [['stone_pickaxe', 1], ['stone_shovel', 1], ['torch', 16], ['leather_cap', 1], ['leather_boots', 1], ['bread', 3]], coins: 15 },
  scholar: { name: 'Scholar', items: [['book', 2], ['scroll', 3], ['lantern', 1], ['wool_hood', 1], ['linen_shirt', 1], ['bread', 3]], coins: 50 },
  noble: { name: 'Minor Noble', items: [['iron_sword', 1], ['fine_coat', 1], ['gold_circlet', 1], ['leather_boots', 1], ['pie', 2]], coins: 140 },
  herbalist: { name: 'Herbalist', items: [['herb', 8], ['healing_salve', 2], ['potion_vigor', 1], ['wool_hood', 1], ['dagger', 1], ['bread', 3]], coins: 25 },
  smith: { name: 'Smith', items: [['hammer', 1], ['iron_ingot', 4], ['stone_pickaxe', 1], ['leather_boots', 1], ['bread', 3]], coins: 20 },
  cutpurse: { name: 'Cutpurse', items: [['dagger', 1], ['lockpick', 5], ['wool_hood', 1], ['bread', 3], ['torch', 2]], coins: 30 },
  bard: { name: 'Bard', items: [['lute', 1], ['flute', 1], ['dagger', 1], ['fine_coat', 1], ['bread', 3], ['torch', 2]], coins: 45 },
  castaway: { name: 'Nothing at all', items: [], coins: 0 },
};
// Everyone has these.
export const COMMON_KIT = [['torch', 4], ['bread', 1]];

export const SKINS = ['#fbe0c8', '#f4d0b0', '#e8b48c', '#d8a47c', '#d49a6a', '#c0845a', '#b07a4a', '#9a6a40', '#8a5a34', '#6e4628', '#5a3a22', '#40281a'];
export const HAIRS = ['#1e1612', '#3a2418', '#6e4424', '#8a5a30', '#a0642e', '#c87a3a', '#d8a048', '#e8d8a0', '#f0ecd8', '#c8c8c8', '#8a8a92', '#a83a2a', '#3a4a8a', '#6a3a7a', '#3a7a4a'];
export const HAIR_STYLES = ['short', 'long', 'ponytail', 'bun', 'curly', 'spiky', 'mohawk', 'afro', 'braids', 'sidepart', 'topknot', 'pigtails', 'wavy', 'undercut', 'bald'];
export const CLOTHES = ['#2f6f8f', '#8f2f3a', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#3a3a4a', '#e0dccc', '#a04a2a', '#2a4a3a', '#8a3a6a', '#4a6aa8', '#c86a3a', '#6a6a6a', '#1e1e28'];
export const PANTS = ['#3a3a4a', '#4a3a2a', '#2a3a5a', '#5a5a5a', '#6a4a2e', '#2a2a2a', '#3a4a2a', '#6a2a2a', '#c8b88a', '#4a2a4a'];
export const SHOES = ['#2a1a10', '#4a2e1a', '#1a1a1e', '#6a4a2e', '#5a5a62', '#7a2a2a'];
export const FACES = [null, 'beard', 'mustache', 'freckles', 'glasses', 'earring', 'scar', 'eyepatch'];
// Facial hair and a detail can be combined.
export const BEARDS = [false, true];
export const DETAILS = [null, 'mustache', 'freckles', 'glasses', 'earring', 'scar', 'eyepatch'];
export const HATS = [null, 'straw', 'cap', 'beret', 'bandana', 'wide', 'feather', 'scarf', 'flower', 'hood', 'fur', 'tricorn', 'wreath'];
export const PATTERNS = [null, 'stripes', 'collar', 'sash', 'buttons', 'patches'];
export const OUTFITS = ['plain', 'vest', 'hunter', 'plaid', 'noble', 'apron', 'fisher', 'farmer', 'tunic', 'traveller', 'robe_blue', 'robe_green', 'robe_white'];
// The finer things (see the character screen's LOOKS): eyes, how a beard's
// worn, marks on the face, a kerchief at the neck, gloves, a cloak.
export const EYES = ['#1e1a28', '#4a2e1a', '#6a5a2a', '#3a6a3a', '#3a5a9a', '#7a8090', '#a87a2a'];
export const BEARD_STYLES = ['full', 'goatee', 'stubble', 'long', 'chinstrap'];
export const MARKS = [null, 'warpaint', 'tattoo', 'blush', 'mole', 'stripes'];
export const NECKS = [null, '#c83a32', '#2f6f8f', '#e0d0b0', '#3a7a3a', '#c8a030', '#5a3a7a', '#1e1e28'];
export const GLOVES = [null, '#4a2e1a', '#2a2a2a', '#7a5232', '#e0dccc', '#8f2f3a'];
export const CAPES = [null, '#8f2f3a', '#2f4a6f', '#3a5a2a', '#4a3a2a', '#5a3a7a', '#2a2a32', '#c8a030'];
export const BUILDS = [false, true]; // stooped or upright

export function pointsLeft(h) {
  const spent = STATS.reduce((n, s) => n + (h.stats[s.key] - STAT_BASE), 0);
  return STAT_POINTS - spent;
}

// How many good traits you may pick (one more for each flaw), and how many
// you have.
export function traitPicks(h) {
  return TRAIT_PICKS + (h.traits || []).filter((t) => TRAITS[t]?.flaw).length;
}
export function goodTraits(h) {
  return (h.traits || []).filter((t) => TRAITS[t] && !TRAITS[t].flaw);
}

// A name from a culture (the character screen's "another name").
export function heroName(seed, style) {
  const rng = new RNG(hash4(seed >>> 0, 0x9a3e));
  const st = CULTURES[style] ? style : rng.pick(Object.keys(CULTURES));
  return personName(rng, st, familyName(rng, st)).first;
}

// A fresh random character (also what "randomise" does).
export function randomHero(seed) {
  const rng = new RNG(hash4(seed >>> 0, 0x4e70));
  const style = rng.pick(Object.keys(CULTURES));
  const fam = familyName(rng, style);
  const nm = personName(rng, style, fam);
  const face = rng.pick(FACES);
  const h = {
    name: nm.first,
    origin: rng.pick(Object.keys(ORIGINS)),
    kit: rng.pick(Object.keys(KITS)),
    look: {
      skin: rng.pick(SKINS), hair: rng.pick(HAIRS), hairStyle: rng.pick(HAIR_STYLES), shirt: rng.pick(CLOTHES), pants: rng.pick(PANTS),
      outfit: 'plain', accent: rng.pick(CLOTHES), hat: null, beard: face === 'beard', acc: face && face !== 'beard' ? face : null,
      shoes: rng.pick(SHOES), pattern: rng.chance(0.4) ? rng.pick(PATTERNS.filter(Boolean)) : null,
    },
    stats: { str: STAT_BASE, agi: STAT_BASE, end: STAT_BASE, cha: STAT_BASE },
    traits: rng.shuffle(Object.keys(TRAITS).filter((t) => !TRAITS[t].flaw)).slice(0, rng.chance(0.6) ? 3 : 2),
  };
  const keys = STATS.map((s) => s.key);
  for (let i = 0; i < STAT_POINTS; i++) {
    const k = rng.pick(keys.filter((q) => h.stats[q] < STAT_MAX));
    h.stats[k]++;
  }
  // (The finer things, now and then.)
  const L = h.look;
  L.eyeColor = rng.pick(EYES);
  L.beardStyle = rng.pick(BEARD_STYLES);
  L.mark = rng.chance(0.15) ? rng.pick(MARKS.filter(Boolean)) : null;
  L.neck = rng.chance(0.2) ? rng.pick(NECKS.filter(Boolean)) : null;
  L.gloves = rng.chance(0.15) ? rng.pick(GLOVES.filter(Boolean)) : null;
  L.cape = rng.chance(0.15) ? rng.pick(CAPES.filter(Boolean)) : null;
  return h;
}

// Fill in anything missing from an older or partial record.
export function normalizeHero(h) {
  const base = randomHero(1);
  const out = { ...base, ...h, look: { ...base.look, ...(h.look || {}) }, stats: { ...base.stats, ...(h.stats || {}) } };
  out.look.hatColor = out.look.accent;
  // (Skills were kept apart once: they're traits now. Flaws that are gone
  // are dropped.)
  const all = [...new Set([...(h.specialties || []), ...(h.traits || [])])].filter((k) => TRAITS[k]);
  const flaws = all.filter((k) => TRAITS[k].flaw);
  out.traits = [...all.filter((k) => !TRAITS[k].flaw).slice(0, TRAIT_PICKS + flaws.length), ...flaws];
  out.specialties = [];
  if (!ORIGINS[out.origin]) out.origin = 'crash';
  if (!KITS[out.kit]) out.kit = 'wanderer';
  for (const s of STATS) out.stats[s.key] = Math.max(1, Math.min(STAT_MAX, out.stats[s.key] | 0));
  return out;
}

// ------------------------------------------------------------------ effects
export const has = (h, k) => !!h && ((h.specialties || []).includes(k) || (h.traits || []).includes(k));
// Your abilities, with whatever your clothes, set gems and potions add
// (kept up to date by the game in h.bonus).
const stat = (h, k) => (h && h.stats ? h.stats[k] ?? STAT_BASE : STAT_BASE) + ((h && h.bonus && h.bonus[k]) || 0);

export function damageMult(h) {
  return 1 + 0.1 * (stat(h, 'str') - STAT_BASE);
}
export function digMult(h) {
  return (1 + 0.08 * (stat(h, 'str') - STAT_BASE)) * (has(h, 'miner') ? 1.25 : 1);
}
export function stepMult(h) {
  return 1 - 0.05 * (stat(h, 'agi') - STAT_BASE);
}
export function cooldownMult(h) {
  return 1 - 0.06 * (stat(h, 'agi') - STAT_BASE);
}
export function hpBonus(h) {
  return 2 * (stat(h, 'end') - STAT_BASE) + (has(h, 'tough') ? 4 : 0);
}
// Multiplies what you pay (below 1 is better); sell prices divide by it.
export function priceMult(h) {
  return (1 - 0.03 * (stat(h, 'cha') - STAT_BASE)) * (has(h, 'haggler') ? 0.92 : 1);
}
export function repGainMult(h) {
  return (1 + 0.12 * (stat(h, 'cha') - STAT_BASE)) * (has(h, 'silver_tongue') ? 1.25 : 1);
}
// Breath for blocking, rolling and swinging.
// (In tenths of a point. Light on your feet, you've a little more breath:
// four tenths for every point of agility above the base.)
export function staminaBonus(h) {
  return (has(h, 'tireless') ? 30 : 0) + 4 * (stat(h, 'agi') - STAT_BASE);
}
export function opinionBonus(h) {
  // Well dressed (or charming for a few hours), people warm to you at once.
  const dress = h && h.bonus ? Math.max(0, h.bonus.cha || 0) * 2 : 0;
  return (has(h, 'honest_face') ? 8 : 0) + dress;
}
