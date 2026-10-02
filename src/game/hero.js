// Who you are: made on the character screen before a new game. Your looks,
// what you start with, four stats, two specialties, up to two traits, and
// where you come from: washed up on the shore after a shipwreck, or born
// and raised in one of the island's towns (where everyone knows you).
import { RNG, hash4 } from '../util/rng.js';
import { personName, familyName, CULTURES } from '../world/names.js';

export const STATS = [
  { key: 'str', name: 'Strength', about: 'Harder blows; quicker digging and chopping.' },
  { key: 'agi', name: 'Agility', about: 'Quicker on your feet and with a blade.' },
  { key: 'end', name: 'Endurance', about: 'More health: 2 HP a point.' },
  { key: 'cha', name: 'Charm', about: 'Better prices; people warm to you faster.' },
];
export const STAT_BASE = 2;
export const STAT_MAX = 5;
export const STAT_POINTS = 4; // to spend above the base

export const SPECIALTIES = {
  angler: { name: 'Angler', about: 'Fish bite sooner, you have longer to strike, and they tire faster.' },
  haggler: { name: 'Haggler', about: 'Traders give you another 8% either way.' },
  forager: { name: 'Forager', about: 'Plants and bushes often give an extra handful.' },
  miner: { name: 'Digger', about: 'Mining and digging go a quarter faster.' },
  brawler: { name: 'Brawler', about: 'Every hit lands a little harder (+1).' },
  farmer: { name: 'Green Thumb', about: 'Harvests give an extra crop.' },
  sneak: { name: 'Light Step', about: 'People have to be closer to notice what you get up to.' },
  healer: { name: 'Herbalist', about: 'Food and herbs heal you 2 HP more.' },
  duelist: { name: 'Duelist', about: 'A wider moment to parry, and more of your blows strike true.' },
  shieldbearer: { name: 'Shield Wall', about: 'Blocking with a shield costs less breath and stops more of the blow.' },
  marksman: { name: 'Marksman', about: 'Your arrows hit 2 harder and find a weak spot more often.' },
  tracker: { name: 'Tracker', about: 'Beasts you bring down give more meat and hide; you spot bandit camps from further off.' },
  tinker: { name: 'Tinker', about: 'Making things at a bench, one time in four you save a material.' },
  cook: { name: 'Cook', about: 'Cooking at a fire or oven, you often get an extra portion.' },
  scholar: { name: 'Scholar', about: 'Half again as much comes of your study at a research table.' },
  rider: { name: 'Horseman', about: 'Horses and wagons go a fifth faster under you.' },
  sailor: { name: 'Sailor', about: 'You paddle a raft faster and turn it more sharply.' },
};

export const TRAITS = {
  honest_face: { name: 'Honest Face', about: 'Strangers think a little better of you.' },
  tough: { name: 'Tough', about: '+4 health.' },
  swimmer: { name: 'Strong Swimmer', about: 'Water doesn\'t slow you down.' },
  lucky: { name: 'Lucky', about: 'Better finds on the end of a fishing line.' },
  early_riser: { name: 'Early Riser', about: 'You heal quickly in the morning hours.' },
  nimble: { name: 'Nimble', about: 'A dodge roll costs half the breath and carries you further.' },
  tireless: { name: 'Tireless', about: '+3 stamina, and it comes back quicker.' },
  sure_footed: { name: 'Sure-Footed', about: 'Heavy blows don\'t stagger you or knock you back.' },
  iron_stomach: { name: 'Iron Stomach', about: 'Every meal heals 1 more; raw food does you as much good as cooked.' },
  devout: { name: 'Devout', about: 'Priests and the devout think well of you; a prayer at an altar adds blue hearts too.' },
  silver_tongue: { name: 'Silver Tongue', about: 'People warm to you a quarter faster.' },
  // Flaws: each gives a stat point back.
  frail: { name: 'Frail', about: '-4 health (+1 stat point).', flaw: true },
  rude: { name: 'Blunt', about: 'People like you a little less (+1 stat point).', flaw: true },
  slow: { name: 'Heavy-Footed', about: 'You walk a little slower (+1 stat point).', flaw: true },
  clumsy: { name: 'Clumsy', about: 'Rolling and blocking cost a third more breath (+1 stat point).', flaw: true },
  short_winded: { name: 'Short of Breath', about: '-3 stamina (+1 stat point).', flaw: true },
  outlander: { name: 'Outlander', about: 'Traders charge you 8% more, wherever you go (+1 stat point).', flaw: true },
  notorious: { name: 'Notorious', about: 'Your face is known: people notice what you get up to from further off (+1 stat point).', flaw: true },
};

export const ORIGINS = {
  crash: { name: 'Crash Landing', about: 'Your ship broke up on the rocks. You wake on a beach with what washed ashore, and nobody on the island knows you.' },
  native: { name: 'Island Native', about: 'You were born and raised in one of the island\'s towns. You start at home with your family, and the whole town knows you.' },
};

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
  castaway: { name: 'Nothing at all', items: [], coins: 0 },
};
// Everyone has these.
export const COMMON_KIT = [['torch', 4], ['bread', 1]];

export const SKINS = ['#fbe0c8', '#f4d0b0', '#e8b48c', '#d8a47c', '#d49a6a', '#c0845a', '#b07a4a', '#9a6a40', '#8a5a34', '#6e4628', '#5a3a22', '#40281a'];
export const HAIRS = ['#1e1612', '#3a2418', '#6e4424', '#8a5a30', '#a0642e', '#c87a3a', '#d8a048', '#e8d8a0', '#f0ecd8', '#c8c8c8', '#8a8a92', '#a83a2a', '#3a4a8a', '#6a3a7a', '#3a7a4a'];
export const HAIR_STYLES = ['short', 'long', 'ponytail', 'bun', 'curly', 'spiky', 'mohawk', 'afro', 'braids', 'sidepart', 'topknot', 'pigtails', 'bald'];
export const CLOTHES = ['#2f6f8f', '#8f2f3a', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#3a3a4a', '#e0dccc', '#a04a2a', '#2a4a3a', '#8a3a6a', '#4a6aa8', '#c86a3a', '#6a6a6a', '#1e1e28'];
export const PANTS = ['#3a3a4a', '#4a3a2a', '#2a3a5a', '#5a5a5a', '#6a4a2e', '#2a2a2a', '#3a4a2a', '#6a2a2a', '#c8b88a', '#4a2a4a'];
export const SHOES = ['#2a1a10', '#4a2e1a', '#1a1a1e', '#6a4a2e', '#5a5a62', '#7a2a2a'];
export const FACES = [null, 'beard', 'mustache', 'freckles', 'glasses', 'earring', 'scar', 'eyepatch'];
// Facial hair and a detail can be combined.
export const BEARDS = [false, true];
export const DETAILS = [null, 'mustache', 'freckles', 'glasses', 'earring', 'scar', 'eyepatch'];
export const HATS = [null, 'straw', 'cap', 'beret', 'bandana', 'wide', 'feather', 'scarf', 'flower', 'hood', 'fur'];
export const PATTERNS = [null, 'stripes', 'collar', 'sash', 'buttons'];
export const OUTFITS = ['plain', 'vest', 'hunter', 'plaid', 'noble', 'apron', 'fisher', 'farmer', 'robe_blue', 'robe_green', 'robe_white'];
export const BUILDS = [false, true]; // stooped or upright

export function pointsLeft(h) {
  const spent = STATS.reduce((n, s) => n + (h.stats[s.key] - STAT_BASE), 0);
  const bonus = (h.traits || []).filter((t) => TRAITS[t]?.flaw).length;
  return STAT_POINTS + bonus - spent;
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
    origin: rng.chance(0.5) ? 'crash' : 'native',
    kit: rng.pick(Object.keys(KITS)),
    look: {
      skin: rng.pick(SKINS), hair: rng.pick(HAIRS), hairStyle: rng.pick(HAIR_STYLES), shirt: rng.pick(CLOTHES), pants: rng.pick(PANTS),
      outfit: 'plain', accent: rng.pick(CLOTHES), hat: null, beard: face === 'beard', acc: face && face !== 'beard' ? face : null,
      shoes: rng.pick(SHOES), pattern: rng.chance(0.4) ? rng.pick(PATTERNS.filter(Boolean)) : null,
    },
    stats: { str: STAT_BASE, agi: STAT_BASE, end: STAT_BASE, cha: STAT_BASE },
    specialties: rng.shuffle(Object.keys(SPECIALTIES)).slice(0, 2),
    traits: rng.chance(0.6) ? [rng.pick(Object.keys(TRAITS).filter((t) => !TRAITS[t].flaw))] : [],
  };
  const keys = STATS.map((s) => s.key);
  for (let i = 0; i < STAT_POINTS; i++) {
    const k = rng.pick(keys.filter((q) => h.stats[q] < STAT_MAX));
    h.stats[k]++;
  }
  return h;
}

// Fill in anything missing from an older or partial record.
export function normalizeHero(h) {
  const base = randomHero(1);
  const out = { ...base, ...h, look: { ...base.look, ...(h.look || {}) }, stats: { ...base.stats, ...(h.stats || {}) } };
  out.look.hatColor = out.look.accent;
  out.specialties = (h.specialties || []).filter((k) => SPECIALTIES[k]).slice(0, 2);
  out.traits = (h.traits || []).filter((k) => TRAITS[k]).slice(0, 2);
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
  return (1 - 0.05 * (stat(h, 'agi') - STAT_BASE)) * (has(h, 'slow') ? 1.1 : 1);
}
export function cooldownMult(h) {
  return 1 - 0.06 * (stat(h, 'agi') - STAT_BASE);
}
export function hpBonus(h) {
  return 2 * (stat(h, 'end') - STAT_BASE) + (has(h, 'tough') ? 4 : 0) - (has(h, 'frail') ? 4 : 0);
}
// Multiplies what you pay (below 1 is better); sell prices divide by it.
export function priceMult(h) {
  return (1 - 0.03 * (stat(h, 'cha') - STAT_BASE)) * (has(h, 'haggler') ? 0.92 : 1) * (has(h, 'outlander') ? 1.08 : 1);
}
export function repGainMult(h) {
  return (1 + 0.12 * (stat(h, 'cha') - STAT_BASE)) * (has(h, 'silver_tongue') ? 1.25 : 1);
}
// Breath for blocking, rolling and swinging.
export function staminaBonus(h) {
  return (has(h, 'tireless') ? 30 : 0) - (has(h, 'short_winded') ? 30 : 0);
}
export function opinionBonus(h) {
  // Well dressed (or charming for a few hours), people warm to you at once.
  const dress = h && h.bonus ? Math.max(0, h.bonus.cha || 0) * 2 : 0;
  return (has(h, 'honest_face') ? 8 : 0) - (has(h, 'rude') ? 8 : 0) + dress;
}
