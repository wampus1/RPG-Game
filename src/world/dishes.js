// Dishes cooked up out of anything (round 50). Every item in the game is,
// to a cook, one or two kinds of thing (hidden till you've cooked with
// it): metallic, cold, meat, hard, crumbly, juicy... Cook one to three of
// them at a fire, a pot, an oven or a table and what comes out is a dish
// of its own: its name made of what went in and how it was cooked
// ("Sandy Bread and Iron Stew"), its picture of them on a skewer, in a
// bowl, on a plate or baked into a pie, and what it does made up from
// what they were:
//   - up to three of the kinds in it are drawn on, each giving one of its
//     three effects: two good, one bad (cooked well, the good ones much
//     more often: see cookDish);
//   - with two or three things in it, one of the kinds drawn may instead
//     become a condition: its effects only work while that holds ("only
//     while you wear metal armour");
//   - some kinds lengthen or shorten how long it lasts.
// A dish's whole make-up is written into its key ("dish~p~sand,bread,
// iron_ingot~dry.0,crumbly.0~metallic~300~6": see dishKey), so it goes
// wherever an item goes as itself, and the same dish is the same item (a
// recipe makes it again: see game/cooking.js).
import { ITEMS, healSplit } from './items.js';

// ------------------------------------------------------------ what it does
// Each effect a kind can give: how it reads (n: its strength).
export const FX = {
  mine: { text: (n) => `breaks stone and ore ${Math.round(n * 100)}% faster` },
  heatproof: { text: (n) => `fire burns you ${n >= 0.45 ? 'half' : 'less'} as often` },
  coldproof: { text: (n) => `cold and frost slow you ${Math.round(n * 100)}% less` },
  armor: { text: (n) => (n >= 0 ? `you take ${Math.round(n * 100)}% less harm` : `you take ${Math.round(-n * 100)}% more harm`) },
  regen: { text: () => 'you heal slowly while it lasts' },
  speed: { text: (n) => (n >= 0 ? `you move ${Math.round(n * 100)}% faster` : `you move ${Math.round(-n * 100)}% slower`) },
  fury: { text: (n) => (n >= 0 ? `blows ${Math.round(n * 100)}% harder` : `blows ${Math.round(-n * 100)}% weaker`) },
  haste: { text: (n) => (n >= 0 ? `blows ${Math.round(n * 100)}% quicker` : `blows ${Math.round(-n * 100)}% slower`) },
  wind: { text: (n) => (n >= 0 ? `breath comes back ${Math.round(n * 100)}% faster` : `breath comes back ${Math.round(-n * 100)}% slower`) },
  breath: { text: (n) => (n >= 0 ? `+${n} breath` : `${n} breath`) },
  str: { text: (n) => `${n >= 0 ? '+' : ''}${n} Strength` },
  agi: { text: (n) => `${n >= 0 ? '+' : ''}${n} Agility` },
  end: { text: (n) => `${n >= 0 ? '+' : ''}${n} Endurance` },
  cha: { text: (n) => `${n >= 0 ? '+' : ''}${n} Charisma` },
  light: { text: () => 'you glow softly in the dark' },
  sight: { text: () => 'you see in the dark' },
  fish: { text: (n) => `fish bite ${Math.round(n * 100)}% sooner` },
  sick: { text: () => 'now and then your stomach turns (-1 health)' },
  long: { text: () => 'lasts half again as long', duration: true },
  short: { text: () => 'wears off sooner', duration: true },
};

// When a kind's made the condition: when its dish works.
export const CONDS = {
  metal: 'while you wear metal armour',
  leather: 'while you wear leather',
  night: 'at night',
  day: 'by day',
  hurt: 'while you\'re below half health',
  hale: 'while you\'re hale (three-quarters health or more)',
  armed: 'while you hold a weapon',
  town: 'in a town',
  wild: 'out in the wilds',
  deep: 'down in the old places',
  under: 'underground',
  rain: 'in the rain',
  dry: 'while it\'s dry',
  water: 'in or beside water',
  fight: 'in a fight',
};

// The kinds of thing a cook knows: each two good effects, one bad, and
// the condition it makes.
export const TYPES = {
  metallic: { good: [['mine', 0.4], ['armor', 0.12]], bad: ['speed', -0.12], cond: 'metal', color: '#a8b0b8' },
  cold: { good: [['heatproof', 0.5], ['wind', 0.25]], bad: ['speed', -0.08], cond: 'night', color: '#b8e0f8' },
  hot: { good: [['coldproof', 0.5], ['fury', 0.12]], bad: ['sick', 1], cond: 'day', color: '#f08040' },
  meat: { good: [['str', 1], ['regen', 1]], bad: ['wind', -0.25], cond: 'hurt', color: '#c05a48' },
  hard: { good: [['armor', 0.1], ['end', 1]], bad: ['agi', -1], cond: 'armed', color: '#8a8478' },
  soft: { good: [['regen', 1], ['cha', 1]], bad: ['armor', -0.12], cond: 'town', color: '#f0e0c8' },
  sticky: { good: [['long', 1.5], ['mine', 0.2]], bad: ['speed', -0.1], cond: 'deep', color: '#d8b048' },
  chewy: { good: [['long', 1.5], ['end', 1]], bad: ['haste', -0.1], cond: 'hale', color: '#b08060' },
  leathery: { good: [['armor', 0.1], ['coldproof', 0.3]], bad: ['agi', -1], cond: 'leather', color: '#8a5a38' },
  crumbly: { good: [['mine', 0.3], ['haste', 0.1]], bad: ['short', 0.6], cond: 'under', color: '#d8c098' },
  juicy: { good: [['wind', 0.3], ['regen', 1]], bad: ['short', 0.6], cond: 'rain', color: '#e05878' },
  dry: { good: [['heatproof', 0.4], ['long', 1.5]], bad: ['wind', -0.2], cond: 'dry', color: '#d8c890' },
  squishy: { good: [['agi', 1], ['fish', 0.4]], bad: ['sick', 1], cond: 'water', color: '#e8d0b0' },
  sweet: { good: [['cha', 1], ['haste', 0.1]], bad: ['sick', 1], cond: 'town', color: '#f0a0c0' },
  bitter: { good: [['end', 1], ['coldproof', 0.3]], bad: ['cha', -1], cond: 'night', color: '#6a7848' },
  salty: { good: [['wind', 0.25], ['breath', 2]], bad: ['breath', -2], cond: 'water', color: '#e8f0f0' },
  earthy: { good: [['mine', 0.25], ['end', 1]], bad: ['speed', -0.08], cond: 'wild', color: '#7a5a3a' },
  herbal: { good: [['regen', 1], ['sight', 1]], bad: ['cha', -1], cond: 'day', color: '#68b048' },
  spicy: { good: [['fury', 0.18], ['coldproof', 0.4]], bad: ['sick', 1], cond: 'fight', color: '#e03020' },
  fishy: { good: [['fish', 0.4], ['breath', 2]], bad: ['cha', -1], cond: 'water', color: '#88a8b8' },
  glowing: { good: [['light', 1], ['sight', 1]], bad: ['sick', 1], cond: 'night', color: '#80f0d0' },
  stony: { good: [['armor', 0.15], ['mine', 0.2]], bad: ['speed', -0.15], cond: 'under', color: '#909090' },
  woody: { good: [['end', 1], ['long', 1.5]], bad: ['agi', -1], cond: 'wild', color: '#9a7048' },
  crystal: { good: [['light', 1], ['haste', 0.12]], bad: ['armor', -0.15], cond: 'under', color: '#c8a0f0' },
  oily: { good: [['haste', 0.15], ['agi', 1]], bad: ['sick', 1], cond: 'armed', color: '#c8a838' },
};
export const TYPE_KEYS = Object.keys(TYPES);

// ------------------------------------------------------------ what a thing is
// What a cook would call it, by what it is: the obvious ones by name...
const KNOWN = {
  sand: ['crumbly', 'dry'], dirt: ['earthy', 'crumbly'], gravel: ['stony', 'crumbly'], clay: ['sticky', 'earthy'],
  bread: ['squishy', 'dry'], flour: ['dry', 'crumbly'], wheat: ['dry', 'chewy'], apple: ['juicy', 'sweet'], berries: ['juicy', 'sweet'],
  carrot: ['hard', 'sweet'], cabbage: ['soft', 'bitter'], mushroom: ['earthy', 'squishy'], pumpkin: ['sweet', 'soft'], coconut: ['hard', 'juicy'],
  raw_meat: ['meat', 'chewy'], cooked_meat: ['meat', 'hot'], fish: ['fishy', 'squishy'], cooked_fish: ['fishy', 'hot'], crab_meat: ['fishy', 'salty'], cooked_crab: ['fishy', 'hot'],
  egg: ['squishy', 'soft'], honey: ['sticky', 'sweet'], ale: ['bitter', 'juicy'], cocoa: ['bitter', 'hot'], herb: ['herbal', 'bitter'],
  glowcap: ['glowing', 'earthy'], ember_pod: ['hot', 'spicy'], mangrove_pod: ['salty', 'chewy'], kelp: ['salty', 'slimy'],
  iron_ingot: ['metallic', 'hard'], gold_ingot: ['metallic', 'soft'], iron_ore: ['metallic', 'stony'], gold_ore: ['metallic', 'stony'], coal: ['hot', 'crumbly'],
  stone: ['stony', 'hard'], cobblestone: ['stony', 'hard'], marble: ['stony', 'cold'], obsidian: ['crystal', 'hard'], ice: ['cold', 'hard'], snow: ['cold', 'soft'],
  glass: ['crystal', 'hard'], gem: ['crystal', 'hard'], pearl: ['crystal', 'salty'], slime_gel: ['sticky', 'squishy'],
  leather: ['leathery', 'chewy'], string: ['chewy', 'dry'], cloth: ['soft', 'dry'], feather: ['soft', 'dry'], bone: ['hard', 'dry'],
  stick: ['woody', 'dry'], planks: ['woody', 'hard'], log_oak: ['woody', 'hard'], sapling: ['woody', 'herbal'], seeds: ['dry', 'crumbly'], reeds: ['woody', 'juicy'],
  paper: ['dry', 'crumbly'], book: ['dry', 'chewy'], ink: ['bitter', 'sticky'], torch: ['hot', 'woody'], lantern: ['hot', 'metallic'],
  healing_salve: ['herbal', 'sticky'], flower_red: ['sweet', 'herbal'], flower_blue: ['cold', 'herbal'], hay_bale: ['dry', 'woody'],
};
// ...the rest by the words in their names...
const WORDS = [
  [/iron|steel|gold|copper|ingot|nail|chain|anvil|helmet|mail|plate|greaves|breastplate|sword|axe|pick|hammer|mace|spear|dagger|halberd|sabre|flail/, ['metallic', 'hard']],
  [/sand|dust|ash/, ['crumbly', 'dry']],
  [/stone|cobble|brick|marble|granite|basalt|slate|tile|rock|ore/, ['stony', 'hard']],
  [/log|plank|wood|stick|bow|staff|chair|table|stool|bench|barrel|crate|door|fence|shield/, ['woody', 'hard']],
  [/leather|hide|boots|cap\b/, ['leathery', 'chewy']],
  [/cloth|wool|linen|silk|shirt|trousers|hood|coat|rug|bed|hat/, ['soft', 'dry']],
  [/leaf|leaves|grass|herb|fern|moss|vine/, ['herbal', 'bitter']],
  [/flower|petal|rose/, ['sweet', 'herbal']],
  [/ice|snow|frost|rime/, ['cold', 'hard']],
  [/lava|magma|ember|fire|coal|cinder|pepper|torch/, ['hot', 'spicy']],
  [/slime|gel|ooze|kelp|spore/, ['sticky', 'squishy']],
  [/glass|gem|crystal|pearl|ruby|sapphire|emerald|amethyst|topaz|onyx|opal|quartz/, ['crystal', 'hard']],
  [/mushroom|cap|truffle|fungus|glow/, ['earthy', 'squishy']],
  [/fish|crab|shrimp|eel|herring|shark|clam|oyster/, ['fishy', 'salty']],
  [/meat|steak|ham|bacon|rib|haunch/, ['meat', 'chewy']],
  [/bread|cake|biscuit|tart|pie|oat|flatbread|loaf/, ['crumbly', 'dry']],
  [/stew|soup|broth|chowder|goulash|pottage|boil|lentil|tea/, ['hot', 'juicy']],
  [/apple|berry|berries|fruit|pod|date|melon|grape/, ['juicy', 'sweet']],
  [/honey|sugar|sweet|candy|jam/, ['sweet', 'sticky']],
  [/oil|grease|wax|tallow/, ['oily', 'sticky']],
  [/bone|skull|tooth|horn|shell|scale/, ['hard', 'dry']],
  [/paper|book|scroll|map|letter|newspaper/, ['dry', 'crumbly']],
  [/potion|salve|tincture|elixir|draught|tonic|brew|philtre/, ['herbal', 'juicy']],
  [/rope|string|thread|net|feather/, ['chewy', 'dry']],
  [/relic|kav|core|rune|ancient/, ['crystal', 'glowing']],
];
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
// ...and whatever's left, one or two kinds it just is.
export function ingredientTypes(key) {
  const k = baseOf(key);
  if (KNOWN[k]) return KNOWN[k].filter((t) => TYPES[t]);
  const def = ITEMS[k];
  const text = `${k} ${def ? def.name : ''}`.toLowerCase();
  for (const [re, types] of WORDS) if (re.test(text)) return types.filter((t) => TYPES[t]);
  if (def && def.kind === 'food') return ['soft', 'juicy'];
  const h = hash(k);
  const a = TYPE_KEYS[h % TYPE_KEYS.length];
  const b = TYPE_KEYS[(h >>> 8) % TYPE_KEYS.length];
  return a === b || (h >>> 16) % 3 === 0 ? [a] : [a, b];
}

// The plain thing a starred, set or grown one's made from (and a dish
// cooked into another is still that dish's ingredients' kinds).
export function baseOf(key) {
  const s = String(key);
  if (s.startsWith('dish~')) return s;
  return s.split(/[~*]/)[0];
}

// ------------------------------------------------------------ where it's cooked
// The places a dish is made, and what each makes of it.
export const COOK_STATIONS = {
  c: { block: 'campfire', name: 'Campfire', verb: 'roast', mins: 180, heal: 1.2 },
  p: { block: 'furnace', name: 'Cooking Pot', verb: 'stew', mins: 240, heal: 1.5 },
  o: { block: 'oven', name: 'Oven', verb: 'bake', mins: 300, heal: 1.6 },
  t: { block: 'table', name: 'Table', verb: 'prepare', mins: 150, heal: 1.0 },
};
export const STATION_OF_BLOCK = Object.fromEntries(Object.entries(COOK_STATIONS).map(([k, s]) => [s.block, k]));

// What it comes out as, there: a skewer, a stew or a soup, a pie or a tart
// or a loaf, a platter or a salad.
export function dishForm(st, ings) {
  const kinds = ings.flatMap((k) => ingredientTypes(k));
  const has = (t) => kinds.includes(t);
  const share = (...ts) => kinds.filter((t) => ts.includes(t)).length / Math.max(1, kinds.length);
  if (st === 'c') return 'Skewer';
  if (st === 'p') return share('juicy', 'cold', 'salty', 'fishy') >= 0.5 ? 'Soup' : 'Stew';
  if (st === 'o') return has('sweet') ? 'Tart' : !has('meat') && share('crumbly', 'dry') >= 0.5 ? 'Loaf' : 'Pie';
  return share('herbal', 'juicy', 'sweet') >= 0.5 ? 'Salad' : 'Platter';
}

// A thing's name, said short, for a dish's name ("Iron" for an iron
// ingot), and as a word for what's put before the rest ("Sandy").
const ADJ = {
  sand: 'Sandy', dirt: 'Earthy', gravel: 'Gritty', stone: 'Stony', cobblestone: 'Stony', mushroom: 'Mushroom', honey: 'Honeyed', herb: 'Herbed',
  fish: 'Fishy', raw_meat: 'Meaty', cooked_meat: 'Meaty', snow: 'Snowy', ice: 'Icy', coal: 'Smoky', ash: 'Ashen', slime_gel: 'Slimy', glowcap: 'Glowing',
  ember_pod: 'Fiery', gold_ingot: 'Golden', iron_ingot: 'Iron', glass: 'Glassy', feather: 'Feathered', leather: 'Leathery', cabbage: 'Leafy', pepper: 'Peppered',
};
export function ingredientName(key) {
  const k = baseOf(key);
  if (k.startsWith('dish~')) return 'Leftover';
  const def = ITEMS[k];
  let n = def ? def.name : k.replace(/_/g, ' ');
  n = n.replace(/^(Raw|Sack of|Block of|Bundle of|Piece of|Lump of|Mug of|Cup of|Pile of|Handful of) /i, '').replace(/ (Ingot|Ore|Log|Block|Bars?)$/i, '');
  return n.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dishName(st, ings) {
  const form = dishForm(st, ings);
  const n = ings.map(ingredientName);
  if (ings.length === 1) return `${n[0]} ${form}`;
  if (ings.length === 2) return `${n[0]} and ${n[1]} ${form}`;
  // ("Sandy Bread and Iron Stew"; with no word for the first, a list.)
  const adj = ADJ[baseOf(ings[0])];
  return adj ? `${adj} ${n[1]} and ${n[2]} ${form}` : `${n[0]}, ${n[1]} and ${n[2]} ${form}`;
}

// ------------------------------------------------------------ the dish itself
// Written into its key: station, what went in, the effects drawn (kind and
// which of its three: 0 and 1 good, 2 bad), the condition (a kind, or -),
// how long it lasts (game minutes), and how much good it does.
export function dishKey(o) {
  const fx = o.fx.length ? o.fx.map((f) => `${f.type}.${f.i}`).join(',') : '-';
  return `dish~${o.st}~${o.ings.map(baseOf).join(',')}~${fx}~${o.cond || '-'}~${Math.round(o.mins)}~${Math.round(o.heal)}`;
}

export function parseDish(key) {
  const p = String(key).split('~');
  if (p[0] !== 'dish' || p.length < 7 || !COOK_STATIONS[p[1]]) return null;
  const ings = p[2].split(',').filter(Boolean).slice(0, 3);
  const fx = p[3] === '-' ? [] : p[3].split(',').map((s) => {
    const [type, i] = s.split('.');
    return { type, i: +i };
  }).filter((f) => TYPES[f.type] && f.i >= 0 && f.i <= 2);
  const cond = TYPES[p[4]] ? p[4] : null;
  const mins = Math.max(10, Math.min(24 * 60, parseInt(p[5], 10) || 60));
  const heal = Math.max(1, Math.min(20, parseInt(p[6], 10) || 1));
  return { st: p[1], ings, fx, cond, mins, heal };
}

// One effect drawn from a kind: what it does, and how strongly.
export function effectOf(f) {
  const T = TYPES[f.type];
  const [k, n] = f.i === 2 ? T.bad : T.good[f.i];
  return { k, n, good: f.i !== 2, type: f.type };
}

// The item a dish key stands for (see items.js, which asks for it the
// first time the key's looked up).
export function deriveDish(key) {
  const d = parseDish(key);
  if (!d) return undefined;
  const effects = d.fx.map(effectOf);
  const name = dishName(d.st, d.ings);
  return {
    key,
    kind: 'food',
    stack: 8,
    name,
    heal: d.heal,
    ...healSplit(d.heal, d.st === 'p' ? Math.max(8, d.heal * 2) : null),
    value: Math.max(2, 2 + d.heal + effects.filter((e) => e.good).length * 4 - effects.filter((e) => !e.good).length * 2),
    dish: { ...d, effects, form: dishForm(d.st, d.ings), cond: d.cond, condText: d.cond ? CONDS[TYPES[d.cond].cond] : null },
  };
}

// What it does, in words (for its tooltip and the cook's window).
export function dishLines(def) {
  const D = def && def.dish;
  if (!D) return [];
  const out = [];
  const real = D.effects.filter((e) => !FX[e.k].duration);
  if (!real.length) out.push({ text: 'Nothing more than a meal.', good: true });
  for (const e of real) out.push({ text: FX[e.k].text(e.n), good: e.good });
  if (D.condText) out.push({ text: `only ${D.condText}`, cond: true });
  const hrs = D.mins / 60;
  out.push({ text: `for ${hrs >= 1 ? `${Math.round(hrs * 10) / 10} hours` : `${D.mins} minutes`}`, dur: true });
  return out;
}

// ------------------------------------------------------------ cooking it
// What comes of cooking `ings` (one to three item keys) at station `st`,
// cooked as well as `score` (0 burnt to 1 perfect), luck from `rng` (a
// function giving 0-1). Returns the dish's key.
export function cookDish(ings, st, score, rng = Math.random) {
  // (A dish put in another stands for the first thing in it: its key
  // can't hold another's.)
  ings = ings.slice(0, 3).map((k) => (String(k).startsWith('dish~') ? (parseDish(k)?.ings[0] || 'bread') : baseOf(k)));
  const S = COOK_STATIONS[st] || COOK_STATIONS.c;
  const kinds = [];
  for (const k of ings) for (const t of ingredientTypes(k)) if (!kinds.includes(t)) kinds.push(t);
  // Up to three of its kinds drawn on.
  const pool = kinds.slice();
  const drawn = [];
  while (pool.length && drawn.length < 3) drawn.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  // With more than one thing in it, one of them may be the condition
  // instead (an even chance).
  let cond = null;
  if (ings.length >= 2 && drawn.length >= 2 && rng() < 0.5) cond = drawn.splice(Math.floor(rng() * drawn.length), 1)[0];
  // Cooked well, the good effects; badly, the bad, more often.
  const badChance = 0.05 + 0.65 * Math.pow(1 - Math.max(0, Math.min(1, score)), 1.3);
  const fx = drawn.map((type) => ({ type, i: rng() < badChance ? 2 : rng() < 0.5 ? 0 : 1 }));
  // How long it lasts: the place's own time, longer or shorter for what's
  // in it, and a little for how well it was done.
  let mins = S.mins * (0.8 + 0.4 * score);
  for (const f of fx) {
    const e = effectOf(f);
    if (e.k === 'long') mins *= 1.5;
    if (e.k === 'short') mins *= 0.6;
  }
  mins = Math.max(30, Math.round(mins / 10) * 10);
  // The good it does you: what was food in it, the more for the cooking,
  // and a little more for each thing in it.
  const food = ings.reduce((n, k) => {
    const d = ITEMS[k];
    return n + (d && d.kind === 'food' ? d.heal || 0 : 0);
  }, 0);
  const heal = Math.max(1, Math.min(20, Math.round((food * S.heal + (ings.length - 1)) * (0.6 + 0.6 * score))));
  return dishKey({ st, ings, fx, cond, mins, heal });
}

// How well it was cooked, in a word.
export function scoreWord(score) {
  return score >= 0.92 ? 'Perfect' : score >= 0.7 ? 'Good' : score >= 0.45 ? 'Fair' : score >= 0.2 ? 'Poor' : 'Burnt';
}
