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
  ember: { dishes: ['pepper_stew', 'ash_bread'], word: 'fire-pepper stew and bread baked in the ash', drink: 'smoked spirit' },
  mist: { dishes: ['mushroom_broth', 'glowcap_tea'], word: 'mushroom broth and glowcap tea', drink: 'heather wine' },
  tide: { dishes: ['crab_boil', 'kelp_cakes'], word: 'crab boil and kelp cakes', drink: 'palm toddy' },
};
// Hot dishes a tavern cooks (a pot feeds several, like a stew).
export const REGIONAL_MEALS = new Set(['pottage', 'chowder', 'spiced_lentils', 'tamales', 'goulash', 'pepper_stew', 'mushroom_broth', 'crab_boil']);
// Which have meat or fish in them.
export const MEATY = new Set(['raw_meat', 'cooked_meat', 'feast', 'goulash', 'pepper_stew']);
export const FISHY = new Set(['fish', 'cooked_fish', 'chowder', 'smoked_fish', 'crab_boil', 'kelp_cakes', 'crab_meat', 'cooked_crab']);
export const DRINKS = new Set(['ale']);

// How they dress: shirts mostly from their own palette (same number of
// draws as before, so the world doesn't change shape).
export const CLOTHES = {
  vale: ['#4a7a3a', '#6a8a4a', '#8a7a3a', '#a86a2a', '#9a8a6a', '#b8a078', '#5a4a3a', '#7a5a3a', '#3a5a8a', '#8a3a2a'],
  north: ['#3a5a8a', '#2a4a6a', '#5a7a9a', '#4a4a5a', '#6a6a7a', '#8a3a2a', '#7a2a4a', '#9a9aa8', '#5a4a3a', '#3a6a5a'],
  sun: ['#e8dcc0', '#d8c8a0', '#c89048', '#2a3a7a', '#3a4a9a', '#b8a078', '#a86a2a', '#f0e8d8', '#7a2a4a', '#c8a048'],
  wild: ['#3a8a4a', '#c8a020', '#c83a32', '#2a8a8a', '#e07a2a', '#6a4a8a', '#4a7a3a', '#d8b030', '#9a4a5a', '#3a6a5a'],
  high: ['#3a3a44', '#4a4a5a', '#6a2a2a', '#7a2a4a', '#8a6a3a', '#5a5a6a', '#2a3a4a', '#a86a2a', '#4a3a2a', '#6a6a7a'],
  // (Soot-black and ember-red; moss and heather; sun-bleached and sea-blue.)
  ember: ['#2a2426', '#3a3034', '#8a2a1a', '#c84a1a', '#e07a2a', '#5a4a44', '#6a2a2a', '#3a3a3a', '#a83a1a', '#4a3a34'],
  mist: ['#5a6a5a', '#6a5a7a', '#8a7aa0', '#4a5a4a', '#7a8a7a', '#3a4a4a', '#9a8ab0', '#5a4a5a', '#6a7a6a', '#4a3a5a'],
  tide: ['#e8e0c8', '#2a8a9a', '#3aa8b8', '#f0d890', '#d87a5a', '#4a7aaa', '#c8e0d8', '#2a6a7a', '#e0b070', '#7ac0c8'],
};
// A trim each people likes on its shirts.
export const PATTERN = { vale: 'buttons', north: 'collar', sun: 'sash', wild: 'stripes', high: 'buttons', ember: 'sash', mist: 'patches', tide: 'stripes' };

// The old gods of each people, and the bits a realm's faith is made of.
const GODS = {
  vale: { gods: ['the Green Mother', 'the Hearth-Father', 'Saint Aldwyn of the Lamp', 'the Harvest Queen', 'the Shepherd of Stars', 'the Lady of the Well', 'the Twin Saints of the Bridge'], faith: ['the Old Hearth', 'the Way of the Seasons', 'the Church of the Bright Lamp', 'the Green Faith', 'the Holy Well', 'the Brotherhood of the Plough'], feast: ['Harvest Home', 'May Morning', 'Lamplight Eve', 'Sheaf Day', 'Well-Dressing Day', 'Plough Monday'], symbol: ['a wheat sheaf', 'a lit lamp', 'an oak leaf', 'a crook', 'a well-bucket', 'a bridge'] },
  north: { gods: ['the All-Father', 'the Wolf of Winter', 'the Sea-Mother', 'Thunderer Asvald', 'the Raven of Night', 'the Bear-Who-Sleeps', 'the Norn of Threads'], faith: ['the Old Gods of the Ice', 'the Raven Rite', 'the Hall of the Drowned', 'the Frost Creed', 'the Bear Cult', 'the Weavers of Fate'], feast: ['Midwinter Blot', 'Sunreturn', 'the Night of Ravens', 'Shiprest', 'the Bear-Waking', 'the Long Night'], symbol: ['a raven', 'a hammer', 'a longship prow', 'a wolf head', 'a bear claw', 'a spindle'] },
  sun: { gods: ['the One Light', 'the Sun-Crowned', 'the Well of Stars', 'the Veiled Moon', 'the Keeper of Waters', 'the Scarab of Dawn', 'the Lion of the Dunes'], faith: ['the Faith of the Lamp', 'the Path of Noon', 'the Order of the Well', 'the Way of the Veil', 'the Dawn Mysteries', 'the Pride of the Lion'], feast: ['Lantern Night', 'the Feast of Noon', 'Starwell Eve', 'the Night of Veils', 'the Scarab Rising', 'the Lion\'s Feast'], symbol: ['a crescent', 'a sun disc', 'a water jar', 'an eight-pointed star', 'a scarab', 'a lion\'s mane'] },
  wild: { gods: ['the Feathered Serpent', 'the Rain-Lord', 'the Jaguar of Night', 'the Maize Mother', 'the Smoking Mirror', 'the Hummingbird of War', 'the Grandmother Tree'], faith: ['the Serpent Rites', 'the Way of Maize', 'the Rain Covenant', 'the Jaguar Mysteries', 'the Root and Branch', 'the Hummingbird Oath'], feast: ['the Rain Dance', 'the Green Maize Feast', 'the Night of the Jaguar', 'the Feather Day', 'the Root Festival', 'the Flower War'], symbol: ['a feathered serpent', 'a maize cob', 'a jaguar mask', 'a rain glyph', 'a hummingbird', 'a great tree'] },
  high: { gods: ['the Deep Smith', 'the Stone Mother', 'the Anvil-King', 'the Lantern in the Dark', 'the Ore-Father', 'the Silent Ancestors', 'the Goat of the Peaks'], faith: ['the Forge Creed', 'the Halls of the Deep', 'the Covenant of Stone', 'the Lantern Rite', 'the Ancestor Hall', 'the Way of the Peaks'], feast: ['Forge Day', 'the Delving', 'Lanternmoot', 'Hammerfast', 'the Remembering', 'the Goat-Run'], symbol: ['an anvil', 'a pick and hammer', 'a mountain', 'a lantern', 'an ancestor stone', 'a goat\'s horn'] },
  // The Ashborn worship the mountain itself, the Sleeper, whose waking
  // they both dread and long for.
  ember: { gods: ['the Sleeper in the Mountain', 'the Kiln-Mother', 'the Ash-Crowned', 'the Black Glass Saint', 'the Red Tongue', 'the Ember Twins', 'the Smoke That Watches'], faith: ['the Vigil of the Mountain', 'the Kiln Creed', 'the Order of Black Glass', 'the Ashen Covenant', 'the Rite of the Red Tongue', 'the Embers\' Keeping'], feast: ['the Night of Embers', 'Ashfall Day', 'the Waking Vigil', 'the Kiln-Lighting', 'Glassblood Eve', 'the Day of Smoke'], symbol: ['a smoking peak', 'a black glass blade', 'a kiln mouth', 'an ember in a hand', 'a red tongue of flame', 'a crown of ash'] },
  // The Mirefolk keep the old ways of the mist: the dead walk in it, and
  // the mushrooms carry their whispers.
  mist: { gods: ['the Grey Lady', 'the Lantern-Bearer', 'the Mother of Spores', 'the Hollow King', 'the Owl Who Remembers', 'the Drowned Ones', 'the Heather Crone'], faith: ['the Way of the Mist', 'the Lantern Rite', 'the Spore Communion', 'the Hollow Court', 'the Remembering Owl', 'the Heather Path'], feast: ['the Night of Lanterns', 'Fogwalk', 'Sporefall', 'the Hollow Moot', 'the Owl\'s Watch', 'Heather Burning'], symbol: ['a lantern in the mist', 'a mushroom ring', 'an owl\'s eye', 'a sprig of heather', 'a grey veil', 'a standing stone'] },
  // The Stiltfolk's gods are the sea's: the tide that feeds them and the
  // storm round the islands that holds them in.
  tide: { gods: ['the Tide-Mother', 'the Storm Wall', 'the Great Turtle', 'the Pearl in the Deep', 'the Gull-Herald', 'the Mangrove Grandfather', 'the Shark Who Waits'], faith: ['the Tide Covenant', 'the Watchers of the Storm', 'the Turtle\'s Way', 'the Pearl Rite', 'the Gull Oath', 'the Root Moorings'], feast: ['the High Tide Feast', 'Stormwatch', 'the Turtle Landing', 'Pearl Night', 'the Gull Day', 'the Root Blessing'], symbol: ['a turtle shell', 'a pearl', 'a wave', 'a gull feather', 'a fish hook', 'a mangrove root'] },
};
export const DAY_NAMES = ['Moonday', 'Ashday', 'Woden\'s Day', 'Thunderday', 'Freyday', 'Starday', 'Sunday'];

// What sets one faith apart from the next: what it prizes most, what its
// clergy are called, how it sees off its dead, and the beast it holds
// sacred.
const VIRTUES = ['charity', 'courage', 'hard work', 'learning', 'silence', 'hospitality', 'honesty', 'patience'];
const CLERGY = {
  vale: ['priest', 'vicar', 'hearth-keeper', 'well-warden'], north: ['godi', 'seer', 'skald-priest', 'rune-reader'], sun: ['imam of the lamp', 'star-reader', 'veiled one', 'keeper of the well'],
  wild: ['shaman', 'rain-caller', 'jaguar priest', 'tree-speaker'], high: ['forge-priest', 'lorekeeper', 'stone-singer', 'ancestor-speaker'],
  ember: ['kiln-priest', 'ash-reader', 'vigil-keeper', 'glass-speaker'], mist: ['lantern-bearer', 'spore-wife', 'fog-seer', 'owl-keeper'], tide: ['tide-caller', 'storm-watcher', 'pearl-keeper', 'gull-speaker'],
};
const RITES = ['burial in the graveyard', 'a pyre on the hill', 'a boat on the water', 'a cairn of stones', 'a tree planted over them'];
const STYLE_RITES = { vale: [0, 0, 4], north: [1, 2, 3], sun: [0, 3], wild: [4, 1], high: [3, 0], ember: [1, 1, 3], mist: [0, 4], tide: [2, 2, 1] };
const BEASTS = {
  vale: ['the hare', 'the owl', 'the deer'], north: ['the wolf', 'the raven', 'the bear'], sun: ['the camel', 'the hawk', 'the lion'], wild: ['the jaguar', 'the hummingbird', 'the serpent'], high: ['the goat', 'the eagle', 'the bear'],
  ember: ['the ash lizard', 'the cinder crow', 'the salamander'], mist: ['the owl', 'the mire toad', 'the moth'], tide: ['the turtle', 'the gull', 'the crab'],
};

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
  no_mushroom: { rule: 'eat no mushroom (they belong to the dead)', test: 'eat', remark: ['That\'s food of the dead!', 'Spit it out! The dead\'ll want that back.'] },
  sacred_beast: { rule: 'harm no beast the god holds sacred', test: 'hunt', remark: ['You killed one of the god\'s own!', 'That beast was sacred!'] },
  no_digging: { rule: 'break no stone near the town (the mountain is the god\'s bones)', test: 'dig', remark: ['You\'re cutting into the god\'s own bones!', 'Leave the stone be!'] },
};
// Which taboos each people's gods tend to ask for.
const LEANS = {
  vale: ['holy_rest', 'temple_arms', 'sacred_trees'],
  north: ['temple_arms', 'holy_rest', 'sacred_trees'],
  sun: ['no_drink', 'no_meat', 'no_fish', 'temple_arms', 'holy_rest'],
  wild: ['no_hunting', 'sacred_trees', 'no_meat', 'no_mushroom', 'sacred_beast'],
  high: ['holy_rest', 'temple_arms', 'no_drink', 'no_digging'],
  ember: ['temple_arms', 'no_digging', 'holy_rest', 'sacred_beast'],
  // (Never what their own table is made of: the Mirefolk live on
  // mushrooms, the Stiltfolk on the catch.)
  mist: ['sacred_trees', 'holy_rest', 'sacred_beast', 'no_drink'],
  tide: ['sacred_beast', 'holy_rest', 'temple_arms', 'no_hunting'],
};

// A string's hash (for a realm's name: the same faith every time).
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pickBy = (list, h) => list[h % list.length];
// Where each people's folk ways come from.
const FOLK = { vale: 'vales', north: 'north', sun: 'south', wild: 'forest', high: 'mountains', ember: 'ash', mist: 'mist', tide: 'shallows' };

// A realm's faith (a free town keeps the folk ways of its people).
export function religionOf(s) {
  if (!s) return null;
  // (A town may keep another realm's faith: one it was conquered from,
  // or one carried to it by merchants and missionaries.)
  const civ = s.faithCiv !== undefined ? s.faithCiv : s.civ || null;
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
    faith: civ ? G.faith[(strHash(style) + civ.id * 3) % G.faith.length] : `the folk ways of the ${FOLK[style] || 'vales'}`,
    symbol: pickBy(G.symbol, h(4)),
    holy,
    holyName: DAY_NAMES[holy],
    feast: `${pickBy(G.feast, h(6))}`,
    taboos,
    key: civ ? `c${civ.id}` : `f${style}`,
    virtue: pickBy(VIRTUES, h(7)),
    clergy: pickBy(CLERGY[style] || CLERGY.vale, h(8)),
    rite: RITES[pickBy(STYLE_RITES[style] || [0], h(9))],
    beast: pickBy(BEASTS[style] || BEASTS.vale, h(10)),
  };
}

// The faith a realm keeps (for missionaries and holy wars).
export function realmFaith(civ) {
  return civ ? religionOf({ civ, style: civ.style, seed: civ.id }) : null;
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
  if (r.taboos.includes('no_mushroom') && /mushroom/.test(item)) return 'no_mushroom';
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
    if (/stone|ore|cobble/.test(block) && !/brick/.test(block)) this.breach(s, 'no_digging', x, z);
    if (isHolyDay(s, this.game.day) && this.game.world.ow.settlementAt(x, z)) this.breach(s, 'holy_rest', x, z);
  }

  onKill(creature) {
    if (!creature || creature.kind !== 'creature' || creature.hostileNow) return;
    const s = this.near(creature.x, creature.z, 16);
    if (s) this.breach(s, 'no_hunting', creature.x, creature.z);
    // The god's own beast, anywhere near.
    const r = s ? religionOf(s) : null;
    if (r && r.taboos.includes('sacred_beast') && r.beast.includes(creature.species)) this.breach(s, 'sacred_beast', creature.x, creature.z);
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
