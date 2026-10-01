// Ways of life. Each people (the five styles of the world: vale, north, sun,
// wild, high) eats its own dishes, dresses in its own colours, builds in its
// own stone and timber (see settlement.js) and keeps its own feast days.
// Each realm keeps a faith of its own, drawn from its people's old gods:
// a god, a holy day of the week, a feast in the god's honour, and a few
// customs and taboos the faithful keep. A free town keeps the old folk ways
// of its people, with fewer rules. Breaking a custom isn't a crime: folk who
// see it think a little less of you.
import { hash4 } from '../util/rng.js';

// What's eaten and drunk where (item keys; see items.js).
export const CUISINE = {
  vale: { dishes: ['pottage', 'apple_tart'], word: 'herb pottage and apple tart', drink: 'ale' },
  north: { dishes: ['chowder', 'smoked_fish'], word: 'fish chowder and smoked herring', drink: 'mead' },
  sun: { dishes: ['spiced_lentils', 'flatbread'], word: 'spiced lentils and flatbread with dates', drink: 'mint tea' },
  wild: { dishes: ['tamales', 'cocoa'], word: 'maize tamales and hot cocoa', drink: 'cocoa' },
  high: { dishes: ['goulash', 'oatcakes'], word: 'mountain goulash and oatcakes', drink: 'dark beer' },
};
// Hot dishes a tavern cooks (a pot feeds several, like a stew).
export const REGIONAL_MEALS = new Set(['pottage', 'chowder', 'spiced_lentils', 'tamales', 'goulash']);
// Which have meat or fish in them.
export const MEATY = new Set(['raw_meat', 'cooked_meat', 'feast', 'goulash']);
export const FISHY = new Set(['fish', 'cooked_fish', 'chowder', 'smoked_fish']);
export const DRINKS = new Set(['ale']);

// How they dress: shirts mostly from their own palette (same number of
// draws as before, so the world doesn't change shape).
export const CLOTHES = {
  vale: ['#4a7a3a', '#6a8a4a', '#8a7a3a', '#a86a2a', '#9a8a6a', '#b8a078', '#5a4a3a', '#7a5a3a', '#3a5a8a', '#8a3a2a'],
  north: ['#3a5a8a', '#2a4a6a', '#5a7a9a', '#4a4a5a', '#6a6a7a', '#8a3a2a', '#7a2a4a', '#9a9aa8', '#5a4a3a', '#3a6a5a'],
  sun: ['#e8dcc0', '#d8c8a0', '#c89048', '#2a3a7a', '#3a4a9a', '#b8a078', '#a86a2a', '#f0e8d8', '#7a2a4a', '#c8a048'],
  wild: ['#3a8a4a', '#c8a020', '#c83a32', '#2a8a8a', '#e07a2a', '#6a4a8a', '#4a7a3a', '#d8b030', '#9a4a5a', '#3a6a5a'],
  high: ['#3a3a44', '#4a4a5a', '#6a2a2a', '#7a2a4a', '#8a6a3a', '#5a5a6a', '#2a3a4a', '#a86a2a', '#4a3a2a', '#6a6a7a'],
};
// A trim each people likes on its shirts.
export const PATTERN = { vale: 'buttons', north: 'collar', sun: 'sash', wild: 'stripes', high: 'buttons' };

// The old gods of each people, and the bits a realm's faith is made of.
const GODS = {
  vale: { gods: ['the Green Mother', 'the Hearth-Father', 'Saint Aldwyn of the Lamp', 'the Harvest Queen', 'the Shepherd of Stars'], faith: ['the Old Hearth', 'the Way of the Seasons', 'the Church of the Bright Lamp', 'the Green Faith'], feast: ['Harvest Home', 'May Morning', 'Lamplight Eve', 'Sheaf Day'], symbol: ['a wheat sheaf', 'a lit lamp', 'an oak leaf', 'a crook'] },
  north: { gods: ['the All-Father', 'the Wolf of Winter', 'the Sea-Mother', 'Thunderer Asvald', 'the Raven of Night'], faith: ['the Old Gods of the Ice', 'the Raven Rite', 'the Hall of the Drowned', 'the Frost Creed'], feast: ['Midwinter Blot', 'Sunreturn', 'the Night of Ravens', 'Shiprest'], symbol: ['a raven', 'a hammer', 'a longship prow', 'a wolf head'] },
  sun: { gods: ['the One Light', 'the Sun-Crowned', 'the Well of Stars', 'the Veiled Moon', 'the Keeper of Waters'], faith: ['the Faith of the Lamp', 'the Path of Noon', 'the Order of the Well', 'the Way of the Veil'], feast: ['Lantern Night', 'the Feast of Noon', 'Starwell Eve', 'the Night of Veils'], symbol: ['a crescent', 'a sun disc', 'a water jar', 'an eight-pointed star'] },
  wild: { gods: ['the Feathered Serpent', 'the Rain-Lord', 'the Jaguar of Night', 'the Maize Mother', 'the Smoking Mirror'], faith: ['the Serpent Rites', 'the Way of Maize', 'the Rain Covenant', 'the Jaguar Mysteries'], feast: ['the Rain Dance', 'the Green Maize Feast', 'the Night of the Jaguar', 'the Feather Day'], symbol: ['a feathered serpent', 'a maize cob', 'a jaguar mask', 'a rain glyph'] },
  high: { gods: ['the Deep Smith', 'the Stone Mother', 'the Anvil-King', 'the Lantern in the Dark', 'the Ore-Father'], faith: ['the Forge Creed', 'the Halls of the Deep', 'the Covenant of Stone', 'the Lantern Rite'], feast: ['Forge Day', 'the Delving', 'Lanternmoot', 'Hammerfast'], symbol: ['an anvil', 'a pick and hammer', 'a mountain', 'a lantern'] },
};
export const DAY_NAMES = ['Moonday', 'Ashday', 'Woden\'s Day', 'Thunderday', 'Freyday', 'Starday', 'Sunday'];

// Customs and taboos: what the faithful don't do (and what folk say when
// you do). `test` names the check in Customs.
export const TABOOS = {
  no_meat: { rule: 'eat no flesh of beasts', test: 'eat', remark: ['You\'d eat meat, here?', 'Flesh! In front of everyone...', 'We don\'t eat that here.'] },
  no_fish: { rule: 'never eat fish (the waters are holy)', test: 'eat', remark: ['Fish? The waters are holy, stranger.', 'Put that fish away!'] },
  no_drink: { rule: 'touch no ale or strong drink', test: 'eat', remark: ['Drink, in the street? Shameful.', 'We keep our heads clear here.'] },
  holy_rest: { rule: 'do no work on the holy day', test: 'work', remark: ['On the holy day? Put that down!', 'Have you no respect? It\'s the holy day.'] },
  no_hunting: { rule: 'kill no beast near the town', test: 'hunt', remark: ['You killed it? Here? The beasts are under the god\'s eye.', 'Blood on the holy ground...'] },
  sacred_trees: { rule: 'fell no tree near the town', test: 'fell', remark: ['That tree was older than your grandmother!', 'The trees are sacred here!'] },
  temple_arms: { rule: 'bear no weapon in a house of the gods', test: 'temple', remark: ['A blade in the temple? Out!', 'Leave your weapon at the door.'] },
};
// Which taboos each people's gods tend to ask for.
const LEANS = {
  vale: ['holy_rest', 'temple_arms', 'sacred_trees'],
  north: ['temple_arms', 'holy_rest', 'sacred_trees'],
  sun: ['no_drink', 'no_meat', 'no_fish', 'temple_arms', 'holy_rest'],
  wild: ['no_hunting', 'sacred_trees', 'no_meat'],
  high: ['holy_rest', 'temple_arms', 'no_drink'],
};

// A string's hash (for a realm's name: the same faith every time).
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pickBy = (list, h) => list[h % list.length];

// A realm's faith (a free town keeps the folk ways of its people).
export function religionOf(s) {
  if (!s) return null;
  const civ = s.civ || null;
  const style = (civ ? civ.style : s.style) || 'vale';
  const G = GODS[style] || GODS.vale;
  const seed = civ ? strHash(`${civ.name}:${civ.id}`) : hash4(s.seed >>> 0, 0x6f1c);
  const h = (k) => hash4(seed, k, 0x7e11);
  // (Realms of one people still keep gods and churches of their own.)
  const god = civ ? G.gods[(strHash(style) + civ.id) % G.gods.length] : pickBy(G.gods, h(1));
  const holy = h(3) % 7;
  const pious = civ && (civ.values || []).includes('pious');
  // Taboos: a free town keeps one at most; a realm one or two (three if
  // it's a pious one).
  const lean = LEANS[style] || LEANS.vale;
  const n = civ ? 1 + (h(5) % 2) + (pious ? 1 : 0) : h(5) % 2;
  const taboos = [];
  for (let i = 0; taboos.length < n && i < 8; i++) {
    const t = pickBy(lean, h(20 + i));
    if (!taboos.includes(t)) taboos.push(t);
  }
  return {
    style,
    god,
    faith: civ ? G.faith[(strHash(style) + civ.id * 3) % G.faith.length] : `the folk ways of the ${style === 'vale' ? 'vales' : style === 'north' ? 'north' : style === 'sun' ? 'south' : style === 'wild' ? 'forest' : 'mountains'}`,
    symbol: pickBy(G.symbol, h(4)),
    holy,
    holyName: DAY_NAMES[holy],
    feast: `${pickBy(G.feast, h(6))}`,
    taboos,
  };
}

// The feast day's name, for posters and talk.
export function festivalName(s) {
  const r = religionOf(s);
  return r ? r.feast : 'the feast day';
}

export function isHolyDay(s, day) {
  const r = religionOf(s);
  return !!r && day % 7 === r.holy;
}

// Is this food or drink against the custom of the place?
export function forbiddenFood(s, item) {
  const r = religionOf(s);
  if (!r) return null;
  if (r.taboos.includes('no_meat') && MEATY.has(item)) return 'no_meat';
  if (r.taboos.includes('no_fish') && FISHY.has(item)) return 'no_fish';
  if (r.taboos.includes('no_drink') && DRINKS.has(item)) return 'no_drink';
  return null;
}

// The dishes of the place.
export function dishesOf(s) {
  const c = CUISINE[(s && (s.civ ? s.civ.style : s.style)) || 'vale'] || CUISINE.vale;
  return c.dishes;
}

export function cuisineOf(s) {
  return CUISINE[(s && (s.civ ? s.civ.style : s.style)) || 'vale'] || CUISINE.vale;
}

// What someone of the place tells you of its ways.
export function customsTalk(s) {
  const r = religionOf(s);
  const c = cuisineOf(s);
  const lines = [];
  lines.push(`Here we keep ${r.faith}, and honour ${r.god} (${r.symbol} is the sign of it).`);
  lines.push(`${r.holyName} is the holy day. ${r.feast} is our great feast.`);
  if (r.taboos.length) lines.push(`The faithful ${r.taboos.map((t) => TABOOS[t].rule).join(', and ')}. Mind that, and folk will think the better of you.`);
  else lines.push('We\'re not ones for many rules. Be decent and you\'ll be fine.');
  // (No ale where the faith forbids it.)
  const strong = /ale|mead|beer/.test(c.drink);
  lines.push(`You must try the ${c.word}. ${strong && r.taboos.includes('no_drink') ? 'Our wells give the sweetest water you\'ll ever taste, and that\'s what we drink.' : `And our ${c.drink}!`}`);
  return lines;
}

// The customs of the place, kept and broken.
export class Customs {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.noticed = new Map(); // `${sid}:${key}` -> day you were told
  }

  // The town you're in (or right by).
  here() {
    const p = this.game.player;
    return this.game.world.ow.settlementAt(p.x, p.z) || null;
  }

  // Near enough to a town for its customs to count: its own ground, or
  // a short walk out of it.
  near(x, z, pad = 20) {
    const ow = this.game.world.ow;
    const s = ow.settlementAt(x, z);
    if (s) return s;
    for (const o of ow.settlementsNear ? ow.settlementsNear(x, z) : []) {
      const b = o.bounds;
      if (x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad) return o;
    }
    return null;
  }

  // You broke a custom of `s`: whoever saw it thinks less of you, and one
  // of them says so. Returns the number who saw.
  breach(s, key, x, z) {
    if (!s || s.deserted || s.condition === 'abandoned') return 0;
    const r = religionOf(s);
    if (!r || !r.taboos.includes(key)) return 0;
    const sim = this.sim;
    const wits = sim.witnesses ? sim.witnesses(s.id, x, z, 9) : [];
    if (!wits.length) return 0;
    for (const n of wits) sim.changeRep(n, -2);
    const t = TABOOS[key];
    const sayer = wits.find((n) => n.state === 'routine') || wits[0];
    if (sayer && sayer.say) sayer.say(sayer.rng.pick(t.remark), 3, '#e8c080');
    const k = `${s.id}:${key}`;
    if (this.noticed.get(k) !== this.game.day) {
      this.noticed.set(k, this.game.day);
      this.game.ui.msg(`In ${s.name} the faithful ${t.rule}. Folk saw, and think a little less of you (no crime, though).`, '#e8c080');
    }
    return wits.length;
  }

  // Hooks from the game.
  onEat(item) {
    const p = this.game.player;
    const s = this.here();
    const key = s ? forbiddenFood(s, item) : null;
    if (key) this.breach(s, key, p.x, p.z);
  }

  onBreak(block, x, z) {
    const s = this.near(x, z);
    if (!s) return;
    if (/^log_/.test(block)) this.breach(s, 'sacred_trees', x, z);
    if (isHolyDay(s, this.game.day) && this.game.world.ow.settlementAt(x, z)) this.breach(s, 'holy_rest', x, z);
  }

  onKill(creature) {
    if (!creature || creature.kind !== 'creature' || creature.hostileNow) return;
    const s = this.near(creature.x, creature.z, 16);
    if (s) this.breach(s, 'no_hunting', creature.x, creature.z);
  }

  // Each second or so: a weapon in hand in a temple.
  tick() {
    const g = this.game;
    const b = g.buildingAtPlayer ? g.buildingAtPlayer() : null;
    if (!b || b.type !== 'temple') return;
    const d = g.player.heldDef ? g.player.heldDef() : null;
    if (!d || d.kind !== 'weapon') return;
    const s = this.here();
    if (s && this.noticed.get(`${s.id}:temple_arms`) !== g.day) this.breach(s, 'temple_arms', g.player.x, g.player.z);
  }
}
