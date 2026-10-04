// Stars and modifiers: what makes one sword better than the next of its
// kind. Arms, armour and tools made at a bench, or brought up out of the
// old places, come with one to five stars (★): each star a little more of
// whatever the piece does (a little more or less than that, piece to
// piece), and with stars, now and then a modifier or two, eight of them
// to be had for each kind of gear (a blade, a bow, a shield, armour, a
// tool). Pieces found below ground carry the mark of where they came from.
// (What the modifiers do in a fight or at work: see game/mods.js.)
//
// A piece's stars and modifiers are written into its key, the way a set
// stone is ("iron_sword~3dk7.venom.keen": three stars, from the deep,
// its roll, venomous and keen), so it goes wherever an item goes (packs,
// chests, the ground, your back, a save, the wire) as itself; its
// definition's made up from the plain piece's the first time it's looked
// up (see items.js).
import { ITEMS } from './items.js';

export const STAR_MAX = 5;

// The modifiers, by kind of gear: the word put before the piece's name,
// and what it does. (`tools`: only on those kinds of tool; `ammo`: only on
// a bow that shoots something.)
export const MODS = {
  blade: {
    venom: { name: 'Venomous', about: 'its cuts are poisoned: a point of harm a second, for four seconds' },
    keen: { name: 'Keen', about: 'strikes true more often (about one blow in four a telling one)' },
    searing: { name: 'Searing', about: 'one cut in three sets what it strikes alight' },
    frost: { name: 'Frostbitten', about: 'its cuts chill, slowing what they strike' },
    thirst: { name: 'Thirsting', about: 'one cut in four mends you a little' },
    swift: { name: 'Swift', about: 'swings a fifth quicker' },
    brutal: { name: 'Brutal', about: 'blows throw foes back further, and stagger them' },
    merciless: { name: 'Merciless', about: 'half again as hard on a foe worn down to a third' },
  },
  bow: {
    twin: { name: 'Twin-strung', about: 'looses two more arrows with each, fanned either side (half as hard)' },
    piercing: { name: 'Piercing', about: 'its arrows go on through, into whoever stands behind' },
    fire: { name: 'Fire-tipped', about: 'its arrows set what they strike alight' },
    rime: { name: 'Rime-feathered', about: 'its arrows chill what they strike' },
    quick: { name: 'Quick-drawn', about: 'draws a third quicker' },
    far: { name: 'Far-flying', about: 'reaches half again as far, and its arrows fly faster' },
    thrifty: { name: 'Thrifty', about: 'one shot in three costs you nothing', ammo: true },
    barbed: { name: 'Barbed', about: 'its arrows poison what they strike' },
  },
  shield: {
    thorns: { name: 'Thorned', about: 'a third of every blow it turns goes back into whoever struck' },
    stalwart: { name: 'Stalwart', about: 'takes more of each blow' },
    light: { name: 'Light', about: 'holding it up costs a third less breath' },
    repel: { name: 'Repelling', about: 'a blow it turns throws the one who struck it back a pace' },
    catch: { name: 'Arrow-catching', about: 'arrows that strike it go into your quiver' },
    smoulder: { name: 'Smouldering', about: 'a blow it turns may set the one who struck it alight' },
    duel: { name: "Duellist's", about: 'a wider moment to parry with it' },
    rally: { name: 'Rallying', about: 'each blow it turns gives you back breath; a parry, a little health' },
  },
  armor: {
    fleet: { name: 'Fleet', about: 'you move a little faster' },
    sturdy: { name: 'Sturdy', about: 'takes a third more off each blow' },
    hale: { name: 'Hale', about: '+2 to your health while you wear it' },
    fireproof: { name: 'Fireproof', about: 'fire burns you half as often' },
    furred: { name: 'Fur-lined', about: 'cold and frost slow you for half as long' },
    feather: { name: 'Featherweight', about: 'rolling costs less breath' },
    spiked: { name: 'Spiked', about: 'whoever strikes you up close takes a point of harm back' },
    tireless: { name: 'Tireless', about: 'your breath comes back quicker' },
  },
  tool: {
    smelting: { name: 'Smelting', about: 'ore it digs comes out smelted, ready to work', tools: ['pick'] },
    quick: { name: 'Quick', about: 'works a third faster' },
    fortune: { name: 'Fortunate', about: 'one block in five gives twice as much' },
    long: { name: 'Long-hafted', about: 'reaches a pace further' },
    prospect: { name: 'Prospecting', about: 'stone it breaks sometimes turns up coal, iron or a gem', tools: ['pick'] },
    sawing: { name: 'Sawing', about: 'trees it fells come down as planks, ready sawn', tools: ['axe'] },
    wide: { name: 'Wide', about: 'digs out the block above as well: a tunnel you can walk', tools: ['pick', 'shovel'] },
    keen: { name: 'Keen-edged', about: 'hits two harder as a weapon' },
  },
};
export const MOD_KINDS = Object.keys(MODS);

// What kind of gear a piece is (for its stars and modifiers), if any:
// 'blade', 'bow', 'shield', 'armor' (that keeps blows off, not clothes)
// or 'tool' (pick, axe, shovel, hoe).
export function gearClass(it) {
  if (!it) return null;
  if (it.uniform) return null;
  if (it.kind === 'weapon') return it.thrown ? null : it.ranged ? 'bow' : 'blade';
  if (it.kind === 'armor') return it.block ? 'shield' : it.armor > 0 ? 'armor' : null;
  if (it.kind === 'tool' && ['pick', 'axe', 'shovel'].includes(it.tool) && it.speed) return 'tool';
  return null;
}

// Could this piece carry stars (a plain one: none yet, no stone set)?
export function starable(key) {
  const it = key && ITEMS[key];
  return !!it && !it.stars && !it.socket && !it.enhanced && !!gearClass(it);
}

// ------------------------------------------------------------ keys
const KEY = /^(.+)~([1-5])([dc])([0-9a-z]{2})((?:\.[a-z]+)*)$/;
const ROLLS = 36 * 36;

export function starKey(plain, stars, origin, roll, mods = []) {
  const r = Math.max(0, Math.min(ROLLS - 1, roll | 0)).toString(36).padStart(2, '0');
  return `${plain}~${stars}${origin}${r}${mods.map((m) => `.${m}`).join('')}`;
}

// A starred key taken apart: { plain, stars, origin, roll, mods } (or null).
export function parseStar(key) {
  const m = typeof key === 'string' && KEY.exec(key);
  if (!m) return null;
  return { plain: m[1], stars: +m[2], origin: m[3], roll: parseInt(m[4], 36), mods: m[5] ? m[5].slice(1).split('.') : [] };
}

// The piece with its stars taken off (the key itself, for a plain one).
export function plainKey(key) {
  const p = parseStar(key);
  return p ? p.plain : key;
}

// How much better its stars make it: a twentieth and a bit a star, give or
// take a little either way, by its roll.
export function starMult(stars, roll) {
  return 1 + 0.06 * stars + ((roll / (ROLLS - 1)) - 0.5) * 0.06;
}

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

// The definition of a starred piece, made from the plain one's (see the
// head of this file). Null for a key that isn't a good one.
export function deriveStarred(key) {
  const p = parseStar(key);
  if (!p) return null;
  const base = ITEMS[p.plain];
  const cls = gearClass(base);
  if (!base || !cls || base.stars) return null;
  const mods = p.mods.filter((m) => MODS[cls][m]);
  if (mods.length !== p.mods.length) return null;
  const k = starMult(p.stars, p.roll);
  const has = (m) => mods.includes(m);
  const d = { ...base, key, stars: p.stars, origin: p.origin, roll: p.roll, mods, gear: cls, plain: p.plain, base: base.base || p.plain };
  if (base.damage) d.damage = r2(base.damage * k + (cls === 'tool' && has('keen') ? 2 : 0));
  if (cls === 'tool') {
    d.speed = r2(base.speed * k * (has('quick') ? 1.35 : 1));
    if (has('long')) d.reach = (base.reach || 1.5) + 1;
  }
  if (cls === 'bow' && base.range) d.range = Math.round(base.range * (1 + (k - 1) * 0.5) * (has('far') ? 1.5 : 1));
  if (cls === 'armor') d.armor = r3(base.armor * k * (has('sturdy') ? 1.33 : 1));
  if (cls === 'shield') d.block = r3(Math.min(0.96, 1 - (1 - base.block) / k * (has('stalwart') ? 0.7 : 1)));
  d.value = Math.round((base.value || 1) * (1 + 0.3 * (p.stars - 1)) + 15 * mods.length);
  d.name = mods.length ? `${MODS[cls][mods[0]].name} ${base.name}` : base.name;
  return d;
}

// ------------------------------------------------------------ rolling
// (Anything with chance/int/float/pick will do; Math.random otherwise.)
const LOOSE = {
  chance: (p) => Math.random() < p,
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  float: (a, b) => a + Math.random() * (b - a),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
};

// How many stars: made at a bench, mostly one or two (a tinker's hand a
// little better); found below, more the deeper (`tier`, as the old place's
// loot runs: see dungeongen.lootTier), and more again off a master.
export function rollStars(rng = LOOSE, o = {}) {
  if (o.origin === 'd') {
    const s = Math.round(1 + (o.tier || 0) * 0.65 + rng.float(-0.6, 1.1) + (o.boss ? 1 : 0));
    return Math.max(1, Math.min(STAR_MAX, s));
  }
  const w = o.tinker ? [30, 32, 22, 11, 5] : [45, 30, 16, 7, 2];
  let r = rng.float(0, w.reduce((a, b) => a + b, 0));
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

// Which modifiers a piece of `cls` with so many stars comes with: none to
// one at one star, up to three at five.
export function rollMods(cls, stars, rng = LOOSE, base = null) {
  const n = Math.min(3, Math.floor(stars / 2) + (rng.chance(0.35) ? 1 : 0));
  const pool = Object.entries(MODS[cls] || {}).filter(([, m]) => (!m.tools || (base && m.tools.includes(base.tool))) && (!m.ammo || (base && base.ammo !== 'none'))).map(([k]) => k);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

// A piece of gear given its stars (and modifiers): `origin` 'c' (made) or
// 'd' (found below). A piece that can't carry stars comes back as it was.
export function starGear(key, o = {}, rng = LOOSE) {
  if (!starable(key)) return key;
  const base = ITEMS[key];
  const stars = o.stars || rollStars(rng, o);
  const mods = o.mods || rollMods(gearClass(base), stars, rng, base);
  return starKey(key, stars, o.origin || 'c', rng.int(0, ROLLS - 1), mods);
}

// ★★★☆☆
export function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, STAR_MAX - n));
}
