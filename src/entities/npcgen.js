// NPC generation: population planning for a settlement, households/families,
// jobs, personality, hobbies, equipment, appearance and daily schedules.
import { CLOTHES, PATTERN } from '../sim/culture.js';
import { RNG, clamp, hash4 } from '../util/rng.js';
import { personName, familyName } from '../world/names.js';
import { ITEMS } from '../world/items.js';

// start/end: minutes after midnight for the job's core hours.
export const JOBS = {
  guard: { title: 'Guard', place: 'guardhouse', start: 360, end: 1080, tools: ['spear', 'iron_sword', 'iron_sword', 'iron_axe', 'mace', 'bow', 'halberd', 'sabre', 'short_sword', 'flail', 'greatsword', 'hand_axe'], outfit: 'guard' },
  innkeeper: { title: 'Innkeeper', place: 'tavern', start: 600, end: 1400, tools: [], outfit: 'apron', trader: 'inn' },
  cook: { title: 'Cook', place: 'tavern', start: 420, end: 1260, tools: ['ladle'], outfit: 'baker', trader: 'cook' },
  barkeep: { title: 'Barkeep', place: 'tavern', start: 660, end: 1380, tools: [], outfit: 'apron' },
  blacksmith: { title: 'Blacksmith', place: 'smithy', start: 450, end: 1050, tools: ['hammer'], outfit: 'smith', trader: 'smith' },
  merchant: { title: 'Merchant', place: 'shop', start: 480, end: 1080, tools: ['ledger'], outfit: 'vest', trader: 'general' },
  priest: { title: 'Priest', place: 'temple', start: 420, end: 1140, tools: ['prayer_beads'], outfit: 'robe_white' },
  baker: { title: 'Baker', place: 'bakery', start: 300, end: 840, tools: ['bread'], outfit: 'baker', trader: 'baker' },
  scholar: { title: 'Scholar', place: 'library', start: 540, end: 1080, tools: ['book'], outfit: 'robe_blue', trader: 'scholar' },
  // Studying for the realm at its academy (at the library, till there is one).
  researcher: { title: 'Researcher', place: 'academy', start: 510, end: 1110, tools: ['book'], outfit: 'robe_blue', trader: 'scholar' },
  mayor: { title: 'Mayor', place: 'townhall', start: 540, end: 1020, tools: ['ledger'], outfit: 'noble' },
  noble: { title: 'Noble', place: 'manor', start: 600, end: 960, tools: ['dagger'], outfit: 'noble' },
  tailor: { title: 'Tailor', place: 'tailor', start: 480, end: 1050, tools: ['cloth'], outfit: 'vest', trader: 'tailor' },
  carpenter: { title: 'Carpenter', place: 'workshop', start: 450, end: 1050, tools: ['wood_axe'], outfit: 'smith', trader: 'carpenter' },
  herbalist: { title: 'Herbalist', place: 'herbalist', start: 480, end: 1020, tools: ['herb'], outfit: 'robe_green', trader: 'herbalist' },
  fisher: { title: 'Fisher', place: 'dock', start: 330, end: 900, tools: ['fishing_rod'], outfit: 'fisher', trader: 'fisher' },
  farmer: { title: 'Farmer', place: 'farm', start: 360, end: 1080, tools: ['hoe'], outfit: 'farmer', trader: 'farmer' },
  lumberjack: { title: 'Lumberjack', place: 'wild', start: 420, end: 1050, tools: ['iron_axe', 'stone_axe'], outfit: 'plaid' },
  miner: { title: 'Miner', place: 'wild', start: 420, end: 1050, tools: ['stone_pickaxe', 'iron_pickaxe'], outfit: 'miner' },
  trapper: { title: 'Trapper', place: 'wild', start: 390, end: 1020, tools: ['bow'], outfit: 'hunter', trader: 'trapper' },
  laborer: { title: 'Laborer', place: 'warehouse', start: 450, end: 1050, tools: ['wood_shovel'], outfit: 'plain' },
  builder: { title: 'Builder', place: 'rounds', start: 420, end: 1080, tools: ['hammer'], outfit: 'smith' },
  beggar: { title: 'Beggar', place: 'plaza', start: 480, end: 1140, tools: [], outfit: 'rags' },
  child: { title: 'Child' },
  retired: { title: 'Retiree' },
  adventurer: { title: 'Adventurer', outfit: 'hunter' },
  handler: { title: 'Animal Handler', place: 'stables', start: 420, end: 1080, tools: ['wheat'], outfit: 'farmer' },
  caravanner: { title: 'Caravan Trader', outfit: 'vest' },
};

export const HOBBIES = {
  fishing: { label: 'fishing', tag: 'fish', item: 'fishing_rod', day: true },
  reading: { label: 'reading', tag: 'read', item: 'book' },
  gardening: { label: 'gardening', tag: 'garden', item: 'hoe', day: true },
  drinking: { label: 'drinking at the tavern', tag: 'drink', item: null },
  praying: { label: 'praying', tag: 'pray', item: 'prayer_beads' },
  music: { label: 'playing music', tag: 'music', item: 'lute' },
  sketching: { label: 'sketching', tag: 'sketch', item: 'sketchbook', day: true },
  dice: { label: 'playing dice', tag: 'dice', item: 'dice' },
  gossip: { label: 'gossiping', tag: 'gossip', item: null },
  training: { label: 'sword practice', tag: 'train', item: 'wood_sword', day: true },
  stargazing: { label: 'stargazing', tag: 'stargaze', item: null, night: true },
  strolling: { label: 'long walks', tag: 'stroll', item: null },
  smoking: { label: 'pipe smoking', tag: 'smoke', item: 'pipe' },
};

// Job title, with a few settlement-dependent variants.
// A merchant's standing (see shops.js).
const MERCHANT_TITLES = [null, 'Peddler', 'Trader', 'Master Merchant'];

export function jobTitle(rec, s) {
  if (rec.job === 'mayor' && s && s.type === 'village') return 'Village Elder';
  if (rec.job === 'guard' && rec.life && rec.life.rank) return `${rec.life.rank} of the Watch`;
  if (rec.nomadBand !== undefined) return 'Nomad';
  if (rec.bandit !== undefined) return rec.banditChief ? 'Bandit Chief' : rec.hiredSword ? 'Sellsword' : 'Bandit';
  if (rec.adventurer !== undefined) return ADVENTURER_TITLES[rec.advLevel || 1];
  if (rec.caravanTrader !== undefined) return { trader: 'Caravan Trader', driver: 'Wagon Driver', guard: 'Caravan Guard' }[rec.role] || 'Caravan Trader';
  const tier = rec.visitor ? rec.visit && rec.visit.tier : rec.job === 'merchant' ? rec.tier : null;
  if (rec.visitor) return tier ? `Traveling ${MERCHANT_TITLES[tier]}` : 'Traveling Merchant';
  if (tier) return MERCHANT_TITLES[tier];
  return JOBS[rec.job]?.title || 'Villager';
}

// Which building type each workplace job needs.
export function workplaceTypeFor(job) {
  const p = JOBS[job]?.place;
  if (!p || p === 'wild' || p === 'plaza' || p === 'dock' || p === 'farm' || p === 'rounds') return null;
  return p;
}

// ---------------------------------------------------------------- planning
export function planPopulation(s, rng) {
  const vals = s.civ ? s.civ.values : [];
  const has = (v) => vals.includes(v);
  // A village just being founded: nobody yet (the settlers come with
  // their own records), nothing built but its square.
  if (s.founding) return { households: [], jobs: [], target: 0 };
  if (s.condition === 'abandoned') {
    // Empty homes (for ruins) but nobody lives there any more.
    const households = [];
    for (let i = rng.int(4, 7); i > 0; i--) households.push({ kind: 'ghost', members: new Array(rng.int(1, 4)).fill({ age: 'adult' }) });
    return { households, jobs: rng.shuffle(['innkeeper', 'priest', 'blacksmith', 'farmer']).slice(0, 2), target: 0 };
  }
  let target = { village: rng.int(13, 21), town: rng.int(28, 40), city: rng.int(60, 84) }[s.type];
  target *= { prosperous: 1.15, normal: 1, poor: 0.78 }[s.condition] || 1;
  if (has('agrarian') && s.type === 'village') target *= 1.12;
  if (has('mercantile') && s.type !== 'village') target *= 1.08;
  if (s.biome === 'tundra' || s.biome === 'desert' || s.biome === 'swamp') target *= 0.85;
  target = Math.round(target);

  const households = [];
  let pop = 0;
  while (pop < target) {
    const kind = rng.weighted([
      ['single', 0.22], ['couple', 0.2], ['family', 0.3], ['parent', 0.08],
      ['elder', 0.08], ['elders', 0.05], ['extended', 0.07],
    ]);
    const m = [];
    if (kind === 'single') m.push({ age: 'adult' });
    else if (kind === 'couple') m.push({ age: 'adult', partner: 1 }, { age: 'adult', partner: 0 });
    else if (kind === 'family' || kind === 'extended') {
      m.push({ age: 'adult', partner: 1 }, { age: 'adult', partner: 0 });
      const kids = rng.int(1, 3);
      for (let i = 0; i < kids; i++) m.push({ age: 'child', child: true });
      if (kind === 'extended') m.push({ age: 'elder', grandparent: true });
    } else if (kind === 'parent') {
      m.push({ age: 'adult' });
      for (let i = rng.int(1, 2); i > 0; i--) m.push({ age: 'child', child: true });
    } else if (kind === 'elder') m.push({ age: 'elder' });
    else m.push({ age: 'elder', partner: 1 }, { age: 'elder', partner: 0 });
    households.push({ kind, members: m });
    pop += m.length;
  }

  // Jobs for working-age adults.
  const adults = households.reduce((n, h) => n + h.members.filter((x) => x.age === 'adult').length, 0);
  const jobs = [];
  const add = (job, n) => {
    for (let i = 0; i < n; i++) jobs.push(job);
  };
  const T = s.type;
  const scale = (v, n, t, c) => (T === 'village' ? v : T === 'town' ? t : c) + (n ? n : 0);
  const poor = s.condition === 'poor';
  if (T === 'village') add('farmer', 2);
  const guardCap = Math.max(2, Math.round(adults * (T === 'village' ? 0.25 : 0.2)));
  add('guard', Math.min(guardCap, Math.round(scale(rng.int(2, 3), 0, rng.int(4, 5), rng.int(7, 10)) * (has('martial') ? 1.5 : 1) * (poor ? 0.75 : 1))));
  add('mayor', 1);
  // (Every place has a builder, villages too: roads and repairs need one.)
  add('builder', T === 'city' ? 2 : 1);
  add('cook', T === 'city' ? 2 : 1);
  // (An herbalist, when there is one, is among the first a place keeps.)
  const herbAt = jobs.length;
  add('trapper', T === 'village' ? 1 : rng.int(1, 2));
  if (T !== 'village') add('farmer', T === 'city' ? 3 : 2);
  if (T !== 'village' || rng.chance(0.4)) add('innkeeper', 1);
  if (T !== 'village') add('barkeep', T === 'city' ? 2 : 1);
  add('blacksmith', scale(rng.chance(0.6) ? 1 : 0, 0, 1, 2) + (has('artisan') ? 1 : 0));
  add('merchant', Math.round(scale(rng.chance(0.5) ? 1 : 0, 0, 2, 4) * (has('mercantile') ? 1.5 : 1)));
  add('priest', scale(has('pious') || rng.chance(0.4) ? 1 : 0, 0, 1, 2) + (has('pious') && T !== 'village' ? 1 : 0));
  add('baker', scale(rng.chance(0.4) ? 1 : 0, 0, 1, 2));
  if (T !== 'village' || has('scholarly')) add('scholar', scale(has('scholarly') ? 1 : 0, 0, has('scholarly') ? 2 : 1, has('scholarly') ? 3 : 2));
  if (T === 'city') add('noble', rng.int(2, 3));
  if (T !== 'village') add('tailor', 1);
  if (T !== 'village' || has('artisan')) add('carpenter', 1);
  if (rng.chance(T === 'village' ? 0.45 : 0.7)) jobs.splice(herbAt, 0, 'herbalist');
  if (s.river || s.lake || s.coast) add('fisher', Math.round(scale(rng.int(1, 2), 0, 2, 3) * (has('seafaring') ? 2 : 1)));
  if (['forest', 'taiga', 'jungle'].includes(s.biome)) add('lumberjack', T === 'city' ? 2 : 1);
  if (s.nearMountain) add('miner', rng.int(1, T === 'village' ? 2 : 3));
  if (['forest', 'taiga', 'tundra', 'savanna'].includes(s.biome) && rng.chance(0.6)) add('trapper', 1);
  if (poor && T !== 'village') add('beggar', rng.int(1, 3));
  add('farmer', Math.round(scale(rng.int(3, 5), 0, rng.int(3, 4), rng.int(4, 5)) * (has('agrarian') ? 1.5 : 1)));
  // Trim to the adult count, keeping essential roles first (in plan order).
  const trimmed = jobs.slice(0, adults);
  while (trimmed.length < adults) trimmed.push(T === 'village' ? 'farmer' : rng.chance(0.5) ? 'laborer' : 'farmer');
  return { households, jobs: trimmed, target };
}

// ---------------------------------------------------------------- appearance
const SKIN = {
  vale: ['#f2c7a5', '#e8b48c', '#d9a077', '#f6d3b8', '#c48a62', '#b07a52', '#fadcc4'],
  north: ['#f6dcc8', '#f0cdb3', '#e9bf9f', '#fae6d8', '#f4d0bc', '#e2b494'],
  sun: ['#c8905c', '#b07848', '#9a653a', '#d8a470', '#86532e', '#704226', '#e0b080'],
  wild: ['#a86a3c', '#8e5630', '#b87a48', '#734424', '#c68a58', '#5e361c', '#4e2c18'],
  high: ['#e0aa84', '#d49a74', '#c88a64', '#ecc0a0', '#b8805a', '#f0ceb0'],
};
const ALL_SKIN = Object.values(SKIN).flat();
const HAIR = [
  '#2a1a12', '#4a2c1a', '#6e4424', '#a0622a', '#d8a848', '#e8d078', '#b83a1c', '#1a1a22', '#5a5a5a',
  '#8a3a1a', '#e8e0c8', '#1a2030', '#6a3a1a', '#d07848', '#3a2418',
];
const DYED = ['#3a7a7a', '#6a3a7a', '#2a4a8a', '#8a2a4a'];
const HAIR_STYLES = ['short', 'long', 'bald', 'ponytail', 'bun', 'braids', 'curly', 'mohawk', 'short', 'long', 'spiky', 'topknot', 'afro', 'sidepart', 'sidepart', 'pigtails'];
const CLOTH = [
  '#8a3a2a', '#3a5a8a', '#4a7a3a', '#8a7a3a', '#6a4a7a', '#a86a2a', '#4a6a6a', '#7a2a4a', '#5a4a3a', '#2a4a6a', '#9a8a6a',
  '#b8a078', '#5a7a9a', '#7a5a3a', '#3a6a5a', '#9a4a5a', '#c89048', '#4a4a5a', '#6a8a4a', '#8a5a8a',
];
const PANTS = ['#3a2a1e', '#2a2a3a', '#4a3a2a', '#3a3a2a', '#2e3a4a', '#5a4a3a', '#4a4a4a', '#5a3a2a', '#2a3a2a'];
const HAT_COLORS = ['#8a2a3a', '#2a4a7a', '#3a6a3a', '#c83a32', '#6a4a8a', '#c89030'];

function makeLook(rng, style, age, job, civ) {
  // Mostly local looks, with the odd traveler's child from further afield.
  const skin = rng.chance(0.12) ? rng.pick(ALL_SKIN) : rng.pick(SKIN[style] || SKIN.vale);
  let hair = rng.chance(0.04) && age !== 'elder' ? rng.pick(DYED) : rng.pick(HAIR);
  if (age === 'elder') hair = rng.pick(['#d8d8d8', '#b0b0b0', '#f0f0f0', '#8a8a8a', '#c8c0b0']);
  let hairStyle = rng.pick(HAIR_STYLES);
  if (age !== 'child' && hairStyle === 'pigtails') hairStyle = rng.pick(['braids', 'ponytail']);
  if (age === 'elder' && ['mohawk', 'spiky', 'afro'].includes(hairStyle)) hairStyle = rng.pick(['short', 'bald', 'bun']);
  const look = {
    skin, hair, hairStyle,
    // (Each people dresses in its own colours: see culture.js.)
    shirt: rng.pick(CLOTHES[style] || CLOTH),
    pants: rng.pick(PANTS),
    shoes: rng.pick(['#2a1a10', '#3a2a1a', '#1a1a1a', '#5a3a1a']),
    outfit: JOBS[job]?.outfit || 'plain',
    accent: civ ? civ.color.hex : '#b03030',
    beard: age !== 'child' && rng.chance(0.2),
    small: age === 'child',
    stoop: age === 'elder',
  };
  if (style === 'sun' && rng.chance(0.4)) look.hat = 'scarf';
  if (style === 'north' && rng.chance(0.3)) look.hat = 'fur';
  if (job === 'farmer' && rng.chance(0.7)) look.hat = 'straw';
  if (job === 'guard') look.hat = 'helmet';
  if (job === 'baker') look.hat = 'chef';
  if (job === 'miner') look.hat = 'miner';
  if (job === 'fisher' && rng.chance(0.6)) look.hat = 'cap';
  if (job === 'noble' || job === 'mayor') look.hat = rng.chance(0.5) ? 'feather' : rng.chance(0.3) ? 'circlet' : null;
  if (!look.hat && rng.chance(0.14)) {
    look.hat = rng.pick(age === 'child' ? ['flower', 'bandana'] : ['beret', 'bandana', 'wide', 'flower', 'beret']);
    look.hatColor = rng.pick(HAT_COLORS);
  }
  if (rng.chance(0.4)) look.pattern = rng.pick([PATTERN[style] || 'buttons', PATTERN[style] || 'stripes', 'stripes', 'sash', 'collar', 'buttons']);
  // Glasses, earrings, freckles, moustaches, old scars.
  const accs = age === 'child' ? [['freckles', 3], ['glasses', 1]]
    : [['glasses', job === 'scholar' || job === 'priest' || age === 'elder' ? 5 : 1.5], ['earring', 1.5], ['freckles', age === 'elder' ? 0 : 1.2],
      ['mustache', 1.5], ['scar', job === 'guard' || job === 'trapper' ? 3 : 0.5], ['eyepatch', job === 'guard' ? 0.8 : 0.15]];
  if (rng.chance(job === 'scholar' ? 0.7 : 0.35)) {
    let t = rng.float(0, accs.reduce((a, [, w]) => a + w, 0));
    for (const [k, w] of accs) {
      t -= w;
      if (t <= 0) {
        look.acc = k;
        break;
      }
    }
  }
  finerThings(look, age, job);
  return look;
}

// The finer things (eyes, how a beard's worn, a kerchief, gloves, a
// cloak), settled from the rest of the look rather than drawn from the
// town's dice, so nothing else about anyone changes for them.
const EYE_COLS = ['#1e1a28', '#1e1a28', '#4a2e1a', '#4a2e1a', '#6a5a2a', '#3a6a3a', '#3a5a9a', '#7a8090'];
const KERCHIEFS = ['#c83a32', '#2f6f8f', '#e0d0b0', '#3a7a3a', '#c8a030'];
function finerThings(look, age, job) {
  let h = 2166136261;
  for (const ch of `${look.skin}${look.hair}${look.hairStyle}${look.shirt}${look.pants}${look.acc || ''}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const roll = (k) => (Math.imul(h ^ (k * 0x9e3779b1), 2654435761) >>> 0) / 4294967296;
  const pick = (k, list) => list[Math.floor(roll(k) * list.length)];
  look.eyeColor = pick(1, EYE_COLS);
  if (look.beard) look.beardStyle = pick(2, ['full', 'full', 'goatee', 'stubble', 'long', 'chinstrap']);
  if (age === 'child') return;
  if (roll(3) < (job === 'fisher' || job === 'trapper' || job === 'farmer' ? 0.22 : 0.07)) look.neck = pick(4, KERCHIEFS);
  if (roll(5) < (job === 'smith' || job === 'trapper' || job === 'guard' || job === 'builder' ? 0.4 : 0.03)) look.gloves = pick(6, ['#4a2e1a', '#2a2a2a', '#7a5232']);
  if (roll(7) < (job === 'noble' || job === 'mayor' ? 0.5 : job === 'priest' ? 0.2 : 0.02)) look.cape = pick(8, [look.accent, '#2f4a6f', '#8f2f3a', '#4a3a2a']);
}

// ---------------------------------------------------------------- personality
function makePersonality(rng, civ, job, age) {
  const vals = civ ? civ.values : [];
  const p = {
    bravery: clamp(rng.gauss(0.5, 0.2) + (vals.includes('martial') ? 0.12 : 0), 0, 1),
    sociability: clamp(rng.gauss(0.5, 0.22) + (vals.includes('mercantile') ? 0.08 : 0), 0, 1),
    diligence: clamp(rng.gauss(0.5, 0.2) + (vals.includes('artisan') ? 0.08 : 0), 0, 1),
    chronotype: clamp(rng.gauss(0, 0.45), -1, 1),
    temper: clamp(rng.gauss(0.4, 0.2), 0, 1),
    kindness: clamp(rng.gauss(0.55, 0.2) + (vals.includes('pious') ? 0.08 : 0), 0, 1),
  };
  if (job === 'guard') p.bravery = Math.max(p.bravery, 0.65 + rng.float(0, 0.3));
  if (age === 'child') p.bravery *= 0.5;
  if (job === 'baker' || job === 'farmer' || job === 'fisher') p.chronotype = Math.min(p.chronotype, -0.2);
  if (job === 'innkeeper' || job === 'barkeep') p.chronotype = Math.max(p.chronotype, 0.3);
  const traits = [];
  if (p.bravery > 0.72) traits.push('brave');
  else if (p.bravery < 0.3) traits.push('timid');
  if (p.sociability > 0.7) traits.push('outgoing');
  else if (p.sociability < 0.3) traits.push('reserved');
  if (p.diligence > 0.72) traits.push('hardworking');
  else if (p.diligence < 0.28) traits.push('lazy');
  if (p.chronotype < -0.45) traits.push('early riser');
  else if (p.chronotype > 0.45) traits.push('night owl');
  if (p.temper > 0.72) traits.push('hot-headed');
  if (p.kindness > 0.75) traits.push('kind');
  else if (p.kindness < 0.28) traits.push('gruff');
  if (!traits.length) traits.push('easygoing');
  // A quirk of their own, nudged by what their people value.
  const quirks = ['curious', 'stubborn', 'generous', 'stingy', 'cheerful', 'gloomy', 'superstitious', 'romantic', 'honest', 'gossipy', 'clumsy', 'proud', 'witty', 'absent-minded', 'thrifty', 'nosy'];
  if (vals.includes('pious')) quirks.push('devout', 'devout');
  if (vals.includes('scholarly')) quirks.push('curious', 'bookish');
  if (vals.includes('mercantile')) quirks.push('thrifty', 'shrewd');
  if (vals.includes('martial')) quirks.push('proud', 'disciplined');
  if (vals.includes('agrarian')) quirks.push('down-to-earth', 'patient');
  if (p.sociability > 0.6) quirks.push('gossipy');
  if (p.kindness > 0.6) quirks.push('generous');
  else if (p.kindness < 0.35) quirks.push('stingy');
  if (rng.chance(age === 'child' ? 0.4 : 0.65)) {
    const q = rng.pick(quirks.filter((t) => !(age === 'child' && ['romantic', 'thrifty', 'stingy', 'shrewd'].includes(t))));
    if (!traits.includes(q)) traits.push(q);
  }
  return { p, traits };
}

function pickHobbies(rng, p, civ, avail, age) {
  const vals = civ ? civ.values : [];
  const w = {
    fishing: avail.fish ? 1 + (p.sociability < 0.4 ? 1 : 0) : 0,
    reading: 0.8 + (vals.includes('scholarly') ? 1.2 : 0) + (avail.read ? 0.4 : 0),
    gardening: 0.8 + (vals.includes('agrarian') ? 1 : 0),
    drinking: avail.tavern && age !== 'child' ? 0.6 + p.sociability * 1.6 : 0,
    praying: avail.temple ? 0.4 + (vals.includes('pious') ? 1.8 : 0) + (age === 'elder' ? 0.8 : 0) : 0,
    music: 0.6 + p.sociability * 0.8,
    sketching: 0.6,
    dice: avail.tavern && age !== 'child' ? 0.3 + p.temper : 0,
    gossip: 0.3 + p.sociability * 1.8,
    training: (avail.train ? 0.4 : 0.1) + p.bravery * 1.2 + (vals.includes('martial') ? 0.8 : 0),
    stargazing: p.chronotype > 0.2 ? 1.2 : 0.2,
    strolling: 1,
    smoking: age === 'child' ? 0 : 0.5,
  };
  if (age === 'child') {
    w.fishing *= 0.5;
    w.reading *= 0.6;
  }
  const n = age === 'elder' ? rng.int(2, 3) : rng.int(1, 2);
  const out = [];
  const entries = Object.entries(w).filter(([, v]) => v > 0);
  for (let i = 0; i < n && entries.length; i++) {
    const h = rng.weighted(entries);
    out.push(h);
    entries.splice(entries.findIndex((e) => e[0] === h), 1);
  }
  return out;
}

function equipmentFor(rng, job, hobbies, cond, age) {
  const items = [];
  const j = JOBS[job];
  let tool = null;
  if (j && j.tools && j.tools.length) {
    tool = rng.pick(j.tools);
    items.push({ item: tool, count: 1 });
  }
  if (job === 'trapper') {
    items.push({ item: rng.chance(0.5) ? 'stone_sword' : 'iron_sword', count: 1 }, { item: 'arrow', count: rng.int(8, 16) });
  }
  // The watch: each guard their own weapon (and their own way of fighting
  // with it); archers keep a dagger for close work; a sword or a mace goes
  // with a shield, most of the time.
  let shield = null;
  // (Or a second blade on the shield arm, to fight with two; and never a
  // shield with arms that want both hands.)
  if (job === 'guard') {
    if (tool === 'bow') items.push({ item: 'arrow', count: rng.int(12, 24) }, { item: 'dagger', count: 1 });
    const oneHand = ['iron_sword', 'mace', 'sabre', 'short_sword', 'flail', 'hand_axe'].includes(tool);
    if (oneHand && rng.chance(0.7)) shield = cond === 'prosperous' && rng.chance(0.6) ? 'iron_shield' : rng.chance(0.5) ? 'round_shield' : 'wooden_shield';
    else if (oneHand && rng.chance(0.6)) shield = rng.pick(['dagger', 'short_sword', 'hand_axe']);
  }
  let hobbyItem = null;
  for (const h of hobbies) {
    let it = HOBBIES[h].item;
    if (h === 'music') it = rng.chance(0.6) ? 'lute' : 'flute';
    if (it && !items.some((x) => x.item === it)) {
      items.push({ item: it, count: 1 });
      if (!hobbyItem) hobbyItem = it;
    }
  }
  if (rng.chance(0.5)) items.push({ item: rng.pick(['bread', 'apple', 'berries', 'carrot', 'cooked_fish']), count: rng.int(1, 3) });
  const wealth = { prosperous: 1.6, normal: 1, poor: 0.5 }[cond] || 1;
  const base = { noble: 60, mayor: 40, merchant: 30, blacksmith: 20, innkeeper: 18, cook: 14, scholar: 14, beggar: 1 }[job] ?? (age === 'child' ? 1 : 8);
  const coins = Math.max(0, Math.round(base * wealth * rng.float(0.5, 1.5)));
  return { tool, hobbyItem, items, coins, armor: job === 'guard' ? 0.35 : 0, shield };
}

// ---------------------------------------------------------------- schedules
// A schedule is a list of {s, e, act, place, hobby} covering 0..1440.
function mins(v) {
  return ((Math.round(v) % 1440) + 1440) % 1440;
}

function buildDay(npc, rng, avail, rest) {
  const p = npc.personality;
  const job = npc.job;
  const J = JOBS[job] || {};
  const age = npc.age;
  const hobbies = npc.hobbies;
  const out = [];
  const push = (s, e, act, place, hobby) => {
    s = Math.round(s);
    e = Math.round(e);
    if (e - s < 10) return;
    out.push({ s, e, act, place, hobby });
  };
  let wake = 380 + p.chronotype * 70 + rng.float(-20, 20);
  let bed = 1330 + p.chronotype * 70 + rng.float(-20, 20);
  if (age === 'child') {
    wake = 420 + rng.float(-15, 25);
    bed = 1230 + rng.float(-20, 20);
  } else if (age === 'elder') {
    wake -= 30;
    bed -= 70;
  }
  const nightGuard = job === 'guard' && npc.shift === 'night';
  if (!rest && job === 'baker') wake = 250 + rng.float(-10, 15);
  if (!rest && job === 'fisher') wake = Math.min(wake, 310);
  if (!rest && (job === 'innkeeper' || job === 'barkeep')) bed = Math.max(bed, 1420);
  if (rest) {
    wake += 45;
    bed += 20;
  }
  bed = Math.min(bed, 1435);

  if (nightGuard && !rest) {
    // Sleep in the morning, patrol all night (not all changing over at once).
    const k = rng.float(-25, 25);
    push(0, 360 + k, 'work', 'work');
    push(360 + k, 420 + k, 'eat', 'home');
    push(420 + k, 900 + k, 'sleep', 'bed');
    push(900 + k, 960 + k, 'eat', 'home');
    const h = hobbies[0];
    push(960 + k, 1080 + k, 'hobby', 'hobby', h);
    push(1080 + k, 1130 + k, 'social', 'social');
    push(1130 + k, 1440, 'work', 'work');
    return out;
  }

  const hasJob = J.start !== undefined && age === 'adult' && !rest;
  push(0, wake, 'sleep', 'bed');
  const bfEnd = wake + rng.float(25, 45);
  push(wake, bfEnd, 'eat', 'home');
  let t = bfEnd;
  // Meals are staggered: not everyone downs tools at the same moment.
  const dinnerS = 1100 + rng.float(-60, 60);
  if (hasJob) {
    const startW = Math.max(t + 10, J.start + rng.float(-35, 35) - (p.diligence - 0.5) * 30);
    push(t, startW, 'home', 'home');
    let endW = J.end + rng.float(-25, 25) + (p.diligence - 0.5) * 50;
    const lunch = 715 + rng.float(-60, 60);
    if (J.end - J.start > 400 && lunch > startW + 60 && lunch + 50 < endW) {
      push(startW, lunch, 'work', 'work');
      const lunchPlace = avail.tavern && p.sociability > 0.55 ? 'tavern' : 'home';
      push(lunch, lunch + rng.float(30, 60), 'eat', lunchPlace);
      t = out[out.length - 1].e;
    } else t = startW;
    if (J.end >= 1200) {
      // Evening workers eat on the job.
      push(t, dinnerS, 'work', 'work');
      push(dinnerS, dinnerS + 35, 'eat', 'work');
      t = dinnerS + 35;
      endW = Math.min(endW, bed - 20);
      push(t, endW, 'work', 'work');
      t = endW;
    } else {
      push(t, endW, 'work', 'work');
      t = endW;
      const h = hobbies[0];
      const hEnd = Math.min(dinnerS, t + rng.float(80, 150));
      if (h && hEnd > t + 20) push(t, hEnd, 'hobby', 'hobby', h);
      else push(t, hEnd, 'wander', 'town');
      t = hEnd;
      if (t < dinnerS) push(t, dinnerS, 'home', 'home');
      push(dinnerS, dinnerS + rng.float(35, 55), 'eat', p.sociability > 0.75 && avail.tavern ? 'tavern' : 'home');
      t = out[out.length - 1].e;
    }
  } else {
    // Free day: children study/play, adults do hobbies, elders potter about.
    // Lessons come in classes, morning or afternoon, so the children
    // aren't all at their books (or all out playing) at once.
    const lunchC = 705 + rng.float(-35, 35);
    // Children play for about seven tenths of their free time; the rest they
    // spend wandering about town or helping a parent at work.
    const kid = (s, e) => {
      s = Math.round(s);
      e = Math.round(e);
      const len = e - s;
      if (len < 40) {
        push(s, e, 'play', 'play');
        return;
      }
      const other = rng.chance(0.55) ? 'help' : 'wander';
      const place = other === 'help' ? 'work' : 'town';
      if (rng.chance(0.5)) {
        push(s, s + len * 0.7, 'play', 'play');
        push(s + len * 0.7, e, other, place);
      } else {
        push(s, s + len * 0.3, other, place);
        push(s + len * 0.3, e, 'play', 'play');
      }
    };
    if (age === 'child' && !rest && avail.study) {
      const cls = rng.int(0, 2);
      if (cls < 2) {
        const s0 = 510 + cls * 45 + rng.float(-10, 10);
        push(t, s0, 'play', 'home');
        push(s0, Math.min(lunchC, s0 + 150), 'study', 'study');
        kid(Math.min(lunchC, s0 + 150), lunchC);
        push(lunchC, lunchC + 45, 'eat', 'home');
        kid(lunchC + 45, dinnerS);
      } else {
        const s1 = 810 + rng.float(-15, 15);
        kid(t, lunchC);
        push(lunchC, lunchC + 45, 'eat', 'home');
        kid(lunchC + 45, s1);
        push(s1, s1 + 140, 'study', 'study');
        kid(s1 + 140, dinnerS);
      }
    } else if (age === 'child') {
      kid(t, lunchC);
      push(lunchC, lunchC + 45, 'eat', 'home');
      kid(lunchC + 45, dinnerS);
    } else {
      const h1 = hobbies[0];
      const h2 = hobbies[1] || hobbies[0];
      const mid = 720 + rng.float(-55, 55);
      push(t, t + rng.float(40, 80), 'wander', 'town');
      t = out[out.length - 1].e;
      push(t, mid, 'hobby', 'hobby', h1);
      push(mid, mid + 45, 'eat', avail.tavern && p.sociability > 0.5 ? 'tavern' : 'home');
      t = mid + 45;
      const s2 = t + rng.float(30, 90);
      push(t, s2, p.sociability > 0.5 ? 'social' : 'home', p.sociability > 0.5 ? 'social' : 'home');
      push(s2, dinnerS - 20, 'hobby', 'hobby', h2);
      push(dinnerS - 20, dinnerS, 'home', 'home');
    }
    push(dinnerS, dinnerS + 45, 'eat', 'home');
    t = dinnerS + 45;
  }
  // Evening.
  if (t < bed) {
    const evH = hobbies.find((h) => HOBBIES[h].night) || (hobbies.includes('drinking') ? 'drinking' : null);
    if (age === 'child') push(t, bed, 'home', 'home');
    else if (evH && rng.chance(0.8)) {
      const mid = t + (bed - t) * rng.float(0.5, 0.8);
      push(t, mid, 'hobby', 'hobby', evH);
      push(mid, bed, 'home', 'home');
    } else if (p.sociability > 0.55 && avail.tavern) {
      const mid = t + (bed - t) * rng.float(0.5, 0.85);
      push(t, mid, 'social', 'tavern');
      push(mid, bed, 'home', 'home');
    } else push(t, bed, 'home', 'home');
  }
  push(bed, 1440, 'sleep', 'bed');
  // Normalize: sort and close gaps so every minute belongs to an entry.
  out.sort((a, b) => a.s - b.s);
  for (let i = 0; i < out.length - 1; i++) out[i].e = out[i + 1].s;
  if (out.length) {
    out[0].s = 0;
    out[out.length - 1].e = 1440;
  }
  return out;
}

export function makeSchedules(npc, rng, avail) {
  return { work: buildDay(npc, rng.fork('w'), avail, false), rest: buildDay(npc, rng.fork('r'), avail, true) };
}

// What a settlement offers for building daily routines.
export function availOf(layout) {
  return {
    tavern: layout.buildings.some((b) => b.type === 'tavern'),
    temple: layout.buildings.some((b) => b.type === 'temple'),
    read: layout.buildings.some((b) => b.type === 'library'),
    study: layout.buildings.some((b) => b.type === 'library' || b.type === 'temple'),
    fish: layout.spotsByTag('fish').length > 0,
    train: layout.spotsByTag('train').length > 0,
  };
}

// A shield on their arm (or none).
export function withShield(look, shield) {
  const gear = { ...(look.gear || {}) };
  // (A blade in the off hand isn't worn: it's drawn in the hand.)
  if (shield && ITEMS[shield] && ITEMS[shield].block) gear.shield = ITEMS[shield].look;
  else delete gear.shield;
  return Object.keys(gear).length ? { ...look, gear } : { ...look, gear: undefined };
}

// Give someone a new trade: workplace, tools, clothes and a new routine.
export function retrain(layout, rec, job, rng) {
  rec.job = job;
  rec.work = layout.assignWork(rec, rng);
  const eq = equipmentFor(rng, job, rec.hobbies, layout.settlement.condition, rec.age);
  rec.equipment = { ...rec.equipment, tool: eq.tool, armor: eq.armor, shield: eq.shield, items: [...eq.items.filter((i) => ITEMS[i.item]?.kind === 'weapon' || i.item === eq.tool || i.item === 'arrow'), ...(rec.equipment?.items || []).filter((i) => ITEMS[i.item]?.kind !== 'weapon')] };
  const look = withShield({ ...rec.look, outfit: JOBS[job]?.outfit || 'plain' }, eq.shield);
  // (An archer's quiver.)
  const quiver = eq.items.find((i) => i.item === 'arrow');
  if (quiver) {
    rec.inv ||= [];
    const have = rec.inv.find((q) => q && q.item === 'arrow');
    if (have) have.count += quiver.count;
    else rec.inv.push({ item: 'arrow', count: quiver.count });
  }
  if (job === 'guard') {
    look.hat = 'helmet';
    rec.maxHp = 24;
    rec.hp = Math.max(rec.hp ?? 12, 18);
    rec.personality.bravery = Math.max(rec.personality.bravery, 0.6);
    rec.shift = 'day';
  }
  rec.look = look;
  rec.schedule = makeSchedules(rec, rng, availOf(layout));
  rec.retrained = true;
  return rec;
}

export function activityAt(npc, minute, day) {
  const sched = day % 7 === npc.restDay ? npc.schedule.rest : npc.schedule.work;
  const m = mins(minute);
  for (let i = 0; i < sched.length; i++) {
    const e = sched[i];
    if (m >= e.s && m < e.e) return { entry: e, index: i, rest: sched === npc.schedule.rest };
  }
  return { entry: sched[sched.length - 1], index: sched.length - 1 };
}

// ---------------------------------------------------------------- creation
// Build NPC records for a laid-out settlement. `houses` are building records
// with bed lists; each household gets exactly one house.
export function generateNPCs(layout, plan, seed) {
  const s = layout.settlement;
  const rng = new RNG(seed);
  const style = s.style;
  const civ = s.civ;
  const npcs = [];
  const avail = availOf(layout);
  // Pair households with houses (largest households get the largest houses).
  const houses = layout.buildings.filter((b) => b.residential);
  const hh = plan.households
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.members.length - a.h.members.length);
  const freeHouses = [...houses].sort((a, b) => b.beds.length - a.beds.length);
  const jobQueue = [...plan.jobs];
  for (const { h } of hh) {
    const house = freeHouses.find((b) => b.beds.length >= h.members.length && !b.household);
    if (!house) continue;
    house.household = h;
    const fam = familyName(rng, style);
    house.family = fam;
    house.homeName = house.type === 'manor' ? `${fam} Manor` : house.type === 'house_s' ? `${fam} Cottage` : `The ${fam} House`;
    const members = [];
    for (const m of h.members) {
      const idx = npcs.length;
      let job = m.age === 'child' ? 'child' : m.age === 'elder' ? 'retired' : null;
      if (!job) {
        // Pick a job whose workplace exists; fall back to farmer/laborer.
        let k = 0;
        while (k < jobQueue.length && !layout.hasWorkplaceFor(jobQueue[k])) k++;
        job = k < jobQueue.length ? jobQueue.splice(k, 1)[0] : s.type === 'village' ? 'farmer' : 'laborer';
        // Everyone able finds some work: the fields, the water, the woods.
        if (!layout.hasWorkplaceFor(job)) job = ['farmer', 'fisher', 'trapper', 'laborer', 'lumberjack', 'miner'].find((alt) => layout.hasWorkplaceFor(alt)) || 'retired';
      }
      if (job === 'noble' && house.type !== 'manor') {
        // Nobles who didn't get a manor become merchants.
        job = layout.hasWorkplaceFor('merchant') ? 'merchant' : 'laborer';
      }
      const { p, traits } = makePersonality(rng, civ, job, m.age);
      const npc = {
        id: `${s.id}:${idx}`,
        idx,
        sid: s.id,
        name: personName(rng, style, fam),
        age: m.age,
        job,
        home: house.id,
        bed: members.length,
        household: house.id,
        partner: null,
        children: [],
        parents: [],
        personality: p,
        traits,
        hobbies: [],
        look: null,
        alive: true,
        shift: 'day',
        restDay: rng.int(0, 6),
      };
      npc.hobbies = pickHobbies(rng, p, civ, avail, m.age);
      npc.equipment = equipmentFor(rng, job, npc.hobbies, s.condition, m.age);
      npc.look = withShield(makeLook(rng, style, m.age, job, civ), npc.equipment.shield);
      npc.maxHp = job === 'guard' ? 24 : m.age === 'child' ? 6 : m.age === 'elder' ? 8 : 12;
      npc.hp = npc.maxHp;
      npc.work = layout.assignWork(npc, rng);
      members.push(npc);
      npcs.push(npc);
    }
    // Family links.
    h.members.forEach((m, i) => {
      const npc = members[i];
      if (!npc) return;
      if (m.partner !== undefined && members[m.partner]) npc.partner = members[m.partner].idx;
      if (m.child) {
        npc.parents = members.filter((o, j) => h.members[j].age === 'adult').map((o) => o.idx);
        for (const par of npc.parents) npcs[par].children.push(npc.idx);
      }
    });
    // Couples share a rest day; families eat together.
    const adults = members.filter((x) => x.age === 'adult');
    if (adults.length === 2) adults[1].restDay = adults[0].restDay;
  }
  // The night watch: about a third of the guards (at least one wherever
  // there are three or more) walk the streets after dark.
  const guards = npcs.filter((n) => n.job === 'guard');
  const nightN = guards.length >= 3 ? Math.max(1, Math.floor(guards.length / 3)) : 0;
  guards.forEach((g, i) => {
    g.shift = i >= guards.length - nightN ? 'night' : 'day';
  });
  for (const npc of npcs) {
    npc.schedule = makeSchedules(npc, rng.fork(npc.idx + 1000), avail);
  }
  // Friendships: people who share a hobby, a workplace or an age group.
  const frng = rng.fork('friends');
  for (const npc of npcs) {
    npc.friends = npc.friends || [];
    const want = npc.personality.sociability > 0.6 ? 3 : npc.personality.sociability > 0.3 ? 2 : 1;
    const cands = npcs.filter((o) => o !== npc && o.household !== npc.household && (o.age === npc.age || (o.age !== 'child' && npc.age !== 'child')) &&
      (o.hobbies.some((h) => npc.hobbies.includes(h)) || (o.work && npc.work && o.work.building != null && o.work.building === npc.work.building) || frng.chance(0.15)));
    for (const o of frng.shuffle(cands)) {
      if (npc.friends.length >= want) break;
      if (npc.friends.includes(o.idx)) continue;
      npc.friends.push(o.idx);
      o.friends = o.friends || [];
      if (!o.friends.includes(npc.idx)) o.friends.push(npc.idx);
    }
  }
  return npcs;
}

// A child comes of age: a grown-up's clothes (same face and hair), their
// own trade, and a grown-up's day.
export function growUp(layout, rec, job, rng) {
  const s = layout.settlement;
  const adult = makeLook(rng, s.style, 'adult', job, s.civ);
  rec.age = 'adult';
  rec.look = { ...adult, skin: rec.look.skin, hair: rec.look.hair, hairStyle: rec.look.hairStyle === 'pigtails' ? 'braids' : rec.look.hairStyle, small: false };
  rec.maxHp = 12;
  rec.hp = 12;
  rec.hobbies = pickHobbies(rng, rec.personality, s.civ, availOf(layout), 'adult');
  rec.grown = true;
  retrain(layout, rec, job, rng);
  return rec;
}

// Hard, physical trades that elders give up; the rest keep at their work.
export const RETIRE_FROM = ['guard', 'miner', 'lumberjack', 'builder', 'laborer', 'trapper', 'fisher', 'farmer'];

// Someone grows old: grey hair, a stoop, less strength, an earlier bed,
// and (from the hard trades) retirement.
export function growOld(layout, rec, rng) {
  rec.age = 'elder';
  const grey = ['#d8d8d8', '#b0b0b0', '#f0f0f0', '#8a8a8a', '#c8c0b0'];
  const look = { ...rec.look, hair: rng.pick(grey), stoop: true };
  if (['mohawk', 'spiky', 'afro'].includes(look.hairStyle)) look.hairStyle = rng.pick(['short', 'bald', 'bun']);
  rec.look = look;
  rec.maxHp = 8;
  rec.hp = Math.min(rec.hp ?? 8, 8);
  rec.aged = true;
  if (RETIRE_FROM.includes(rec.job)) {
    if (rec.look.hat === 'helmet' || rec.look.hat === 'miner') rec.look = { ...rec.look, hat: null };
    retrain(layout, rec, 'retired', rng);
    rec.shift = 'day';
    return true;
  }
  rec.schedule = makeSchedules(rec, rng, availOf(layout));
  return false;
}

// A baby born to a couple in town.
export function makeChild(layout, a, b, rng) {
  const s = layout.settlement;
  const civ = s.civ;
  const { p, traits } = makePersonality(rng, civ, 'child', 'child');
  const avail = availOf(layout);
  const r = {
    name: personName(rng, s.style, a.name.last), age: 'child', job: 'child', home: a.home, household: a.household, partner: null, children: [],
    parents: [a.idx, b.idx], friends: [], personality: p, traits, hobbies: pickHobbies(rng, p, civ, avail, 'child'), alive: true, shift: 'day',
    restDay: a.restDay, maxHp: 6, hp: 6,
  };
  r.equipment = equipmentFor(rng, 'child', r.hobbies, s.condition, 'child');
  const look = makeLook(rng, s.style, 'child', 'child', civ);
  // A family resemblance.
  look.skin = rng.chance(0.5) ? a.look.skin : b.look.skin;
  if (rng.chance(0.6)) look.hair = rng.chance(0.5) ? a.look.hair : b.look.hair;
  r.look = look;
  r.work = { kind: 'none' };
  r.schedule = makeSchedules(r, rng, avail);
  return r;
}

// A band of nomads: one family on the road, with its own name, faces and
// habits. Records get their home, work and schedule when (if) they settle.
const NOMAD_STYLES = ['vale', 'north', 'sun', 'wild', 'high'];
export function makeNomadBand(rng, size) {
  const style = rng.pick(NOMAD_STYLES);
  const fam = familyName(rng, style);
  const ages = ['adult'];
  if (size >= 2) ages.push(rng.chance(0.8) ? 'adult' : 'elder');
  while (ages.length < size) ages.push(rng.chance(0.75) ? 'child' : 'adult');
  const avail = { tavern: true, temple: true, read: false, study: false, fish: true, train: false };
  const out = ages.map((age, i) => {
    const job = age === 'child' ? 'child' : age === 'elder' ? 'retired' : 'laborer';
    const { p, traits } = makePersonality(rng, null, job, age);
    if (i === 0 && !traits.includes('well-traveled')) traits.unshift('well-traveled');
    const r = {
      name: personName(rng, style, fam), age, job, partner: null, children: [], parents: [], friends: [], personality: p, traits,
      hobbies: pickHobbies(rng, p, null, avail, age), alive: true, shift: 'day', restDay: rng.int(0, 6), nomad: true, style,
    };
    r.equipment = equipmentFor(rng, rng.chance(0.5) ? 'trapper' : 'laborer', r.hobbies, 'poor', age);
    r.look = makeLook(rng, style, age, job, null);
    if (age === 'adult' && rng.chance(0.5)) r.look.hat = 'hood';
    r.look.outfit = age === 'child' ? 'plain' : rng.pick(['hunter', 'plain', 'rags', 'vest']);
    r.maxHp = age === 'child' ? 6 : age === 'elder' ? 8 : 12;
    r.hp = r.maxHp;
    return r;
  });
  // The first two adults are partners, the children theirs.
  const adults = out.map((r, i) => (r.age === 'adult' ? i : -1)).filter((i) => i >= 0);
  if (adults.length >= 2) {
    out[adults[0]].partner = adults[1];
    out[adults[1]].partner = adults[0];
  }
  out.forEach((r, i) => {
    if (r.age === 'child') r.parents = adults.slice(0, 2);
  });
  for (const a of adults.slice(0, 2)) out[a].children = out.map((r, i) => (r.age === 'child' ? i : -1)).filter((i) => i >= 0);
  return { style, family: fam, people: out };
}

// Someone who lives on the road with a trading company: a trader, a
// driver or a guard (armed). A family name is shared when given.
export function makeTraveller(rng, style, role, family = null) {
  const job = role === 'guard' ? 'guard' : 'merchant';
  const { p, traits } = makePersonality(rng, null, job, 'adult');
  const look = makeLook(rng, style, 'adult', job, null);
  look.outfit = role === 'guard' ? 'guard' : role === 'driver' ? rng.pick(['vest', 'plain', 'hunter']) : rng.pick(['vest', 'noble', 'plain']);
  look.hat = role === 'guard' ? 'helmet' : rng.pick(['feather', 'cap', 'hood', null, 'straw']);
  return { name: personName(rng, style, family || familyName(rng, style)), look, personality: p, traits: ['well-traveled', ...traits.slice(0, 2)], role };
}

// ------------------------------------------------------------ adventurers
export const ADVENTURER_TITLES = { 1: 'Adventurer', 2: 'Seasoned Adventurer', 3: 'Renowned Adventurer' };
const ADV_GEMS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'onyx', 'moonstone', 'bloodstone'];

// An adventurer: someone who lives on the road, going from realm to realm,
// armed and armoured well beyond any townsfolk (a renowned one in jewelled
// gear). `level` 1-3.
export function makeAdventurer(rng, style, level) {
  const { p, traits } = makePersonality(rng, null, 'guard', 'adult');
  p.bravery = Math.max(p.bravery, 0.75);
  p.sociability = clamp(p.sociability + 0.1, 0, 1);
  const tr = ['well-traveled', ...traits.filter((t) => t !== 'timid')].slice(0, 3);
  if (!tr.includes('brave')) tr.push('brave');
  const look = makeLook(rng, style, 'adult', 'adventurer', null);
  look.outfit = rng.pick(['hunter', 'hunter', 'guard', 'vest']);
  look.accent = rng.pick(['#c83a32', '#2a4a7a', '#3a6a3a', '#6a4a8a', '#c89030', '#2a2a2a']);
  const gem = () => rng.pick(ADV_GEMS);
  const set = (base, chance) => (rng.chance(chance) ? `${base}+${gem()}` : base);
  // Moderate gear for a new hand, jewelled for a renowned one.
  const weapon = level >= 3 ? set(rng.pick(['iron_sword', 'gold_sword']), 1) : level === 2 ? set('iron_sword', 0.5) : rng.pick(['iron_sword', 'stone_sword', 'iron_axe', 'spear']);
  const bow = level >= 2 || rng.chance(0.4) ? set('bow', level >= 3 ? 0.6 : 0.15) : null;
  const wear = level >= 3
    ? { head: set('iron_helmet', 0.3), body: set(rng.pick(['chainmail', 'iron_breastplate']), 0.7), legs: 'iron_greaves', feet: 'iron_boots' }
    : level === 2
      ? { head: rng.pick(['iron_helmet', 'leather_cap']), body: set('chainmail', 0.35), legs: rng.pick(['iron_greaves', 'leather_trousers']), feet: 'leather_boots' }
      : { head: rng.chance(0.5) ? 'leather_cap' : null, body: 'leather_tunic', legs: 'leather_trousers', feet: 'leather_boots' };
  for (const k of Object.keys(wear)) if (!wear[k] || !ITEMS[wear[k]]) delete wear[k];
  look.hat = wear.head && wear.head.startsWith('iron_helmet') ? 'helmet' : wear.head ? 'hood' : rng.pick(['hood', null, 'feather']);
  if (wear.body && !wear.body.startsWith('leather')) look.outfit = 'guard';
  return {
    name: personName(rng, style, familyName(rng, style)), style, look, personality: p, traits: tr,
    gear: { weapon: ITEMS[weapon] ? weapon : 'iron_sword', bow: bow && ITEMS[bow] ? bow : null, wear },
    maxHp: 26 + level * 8 + rng.int(0, 4),
    // How often they slip a blow, turn an arrow aside.
    dodge: 0.22 + level * 0.07 + rng.float(0, 0.06),
    deflect: 0.3 + level * 0.1 + rng.float(0, 0.08),
  };
}

// A synthetic record for a traveling merchant visiting from elsewhere.
export function visitorRecord(visit, idx, sid) {
  const rng = new RNG(hash4(idx, visit.arrive, 0x7a11));
  const { p, traits } = makePersonality(rng, null, 'merchant', 'adult');
  p.sociability = Math.max(p.sociability, 0.6);
  const look = makeLook(rng, visit.style, 'adult', 'merchant', null);
  look.hat = rng.pick(['feather', 'cap', 'hood', null]);
  look.outfit = 'vest';
  const all = { s: 0, e: 1440, act: 'visit', place: 'market' };
  return {
    id: `${sid}:v${idx}`, idx, sid, visitor: true, visit,
    name: visit.name, age: 'adult', job: 'merchant', home: null, bed: 0, household: null,
    partner: null, children: [], parents: [], friends: [], personality: p, traits: ['well-traveled', ...traits.slice(0, 1)],
    hobbies: ['strolling'], look, alive: true, shift: 'day', restDay: -1,
    equipment: { tool: 'ledger', hobbyItem: null, items: [], coins: 0, armor: 0 },
    maxHp: 12, hp: 12, work: { kind: 'none' }, schedule: { work: [all], rest: [all] },
    coins: visit.coins, inv: [], skills: { trading: 0.8, cooking: 0.2, hunting: 0.3, fishing: 0.2, farming: 0.1, building: 0.1, crafting: 0.3 },
    fed: 1, hungry: 0, mood: 0.7, grief: [], override: null, away: false, doneKey: null,
  };
}

export function describeNPC(npc) {
  return `${npc.name.first} ${npc.name.last}`;
}
