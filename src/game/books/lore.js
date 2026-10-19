// (Round 126) What the books know: the world as its scholars have it.
//
// Most of it is simply the world: its realms and their peoples, faiths and
// tables; its towns, where they stand and what's near them; the old places
// and their stories; the beasts of each land; the wars being fought, and
// the town histories already told (on the plaques, by the townsfolk). The
// rest is the long past behind all that, which nobody alive saw: when each
// people came, when each realm was proclaimed and who has ruled it since,
// the old wars between neighbours (and which towns changed hands in them),
// the hard winters and fevers that fell on a whole island at once. That's
// made once for the world (the same every time it's asked for, from its
// seed), so every book that tells of the Toll War tells of the same war,
// fought in the same years, under the same kings.
//
// Nothing here is made up that the world says otherwise: a town given up
// in an old war is one the winner holds now; a town's own history is only
// told where the town has one (it's been seen); a ruler named is the one
// on the throne.
import { RNG, hash4 } from '../../util/rng.js';
import { yearOf, FOUNDERS, STYLE_EPITHETS, STYLE_CAME, STYLE_BEASTS, STYLE_PLACES } from '../../sim/history.js';
import { religionOf, realmFaith, cuisineOf, TABOOS } from '../../sim/culture.js';
import { dirFrom } from '../../sim/dungeons.js';
import { shortTitle } from '../../sim/realms.js';
import { personName, CULTURES } from '../../world/names.js';
import { FAR_PEOPLES } from '../../world/farlands.js';
import { LANDMASSES } from '../../world/geography.js';
import { ITEMS } from '../../world/items.js';
import { BIOMES } from '../../world/biomes.js';
import { SPECIES } from '../../entities/creature.js';
import { ANCIENT, ANCIENT_IDS } from '../../sim/ancient.js';
import { isAncient } from '../../world/ancient.js';
import { dtypeOf } from '../../world/dungeongen.js';

export const LANDS = Object.fromEntries(LANDMASSES.map((L) => [L.key, L.name]));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const bare = (n) => String(n || '').replace(/^the /i, '');
// "the Realm of Kingsdale", "the Barforge Dominion".
const theName = (civ) => `the ${bare(civ.name)}`;
// Its own name, without what kind of realm it is: "Kingsdale", "Barforge".
function shortOf(civ) {
  const n = bare(civ.name);
  if (n.includes(' of ')) return n.split(' of ').pop();
  return n.split(' ')[0];
}

// The land things live on (the home island's, unless they say).
const HOME_BEASTS = ['slime', 'skeleton', 'wolf', 'boar', 'deer', 'rabbit', 'chicken', 'horse', 'ghoul', 'wisp', 'pig', 'sheep', 'cow'];

// Each kind of land, as a writer puts it.
const GROUND_WORDS = {
  plains: 'open grassland', forest: 'deep forest', taiga: 'dark pine forest', tundra: 'cold bare tundra', desert: 'desert', savanna: 'dry grass country',
  jungle: 'jungle', swamp: 'fen and marsh', mountain: 'the mountains', beach: 'the shore', ashlands: 'ash and black rock', fungal: 'the mushroom woods',
  moor: 'moorland', mangrove: 'mangrove swamp', olive_hills: 'olive hills', rimewood: 'the frozen rimewood', bamboo_grove: 'bamboo groves', red_mesa: 'red mesas',
  bone_strand: 'the bone strand', salt_flats: 'salt flats', lantern_hollows: 'the lantern hollows', rune_heath: 'rune-cut heath', sea_cliffs: 'sea cliffs',
};
// What a people are called, by their way of life.
export function peopleOf(style) {
  return (CULTURES[style] && CULTURES[style].label) || (FAR_PEOPLES[style] && FAR_PEOPLES[style].label) || 'Valeborn';
}

export function groundWord(b) {
  return GROUND_WORDS[b] || (BIOMES[b] && BIOMES[b].name ? BIOMES[b].name.toLowerCase() : 'open country');
}

// Why neighbours went to war, by what the one who started it held dear.
const CAUSES = [
  { k: 'land', when: (A) => A.values.includes('martial'), why: (A, B) => `the good land along the border between ${A.short} and ${B.short}`, name: () => 'the Border War' },
  { k: 'tolls', when: (A) => A.values.includes('mercantile'), why: (A, B) => `the tolls on the road between ${A.capName} and ${B.capName}`, name: () => 'the Toll War' },
  { k: 'faith', when: (A, B) => A.values.includes('pious') && A.faith.god !== B.faith.god, why: (A, B) => `an insult to ${A.faith.god}, done by priests of ${B.faith.god}`, name: () => 'the War of the Two Altars' },
  { k: 'ore', when: (A) => A.style === 'high' || A.values.includes('artisan'), why: () => 'a seam of silver that ran under the border', name: () => 'the Silver War' },
  { k: 'water', when: (A) => A.style === 'sun' || A.style === 'kesh', why: () => 'the wells along the caravan road', name: () => 'the War of the Wells' },
  { k: 'herd', when: () => true, why: (A, B) => `a herd driven off from the pastures of ${B.capName}`, name: () => 'the Cattle War' },
  { k: 'bride', when: () => true, why: (A, B) => `a betrothal broken between the houses of ${A.short} and ${B.short}`, name: () => 'the War of the Broken Betrothal' },
  { k: 'crown', when: () => true, why: (A, B) => `a claim on the throne of ${B.short}, through a grandmother`, name: () => 'the War of the Two Crowns' },
];
// What fell on a whole land at once.
const GREAT_EVENTS = [
  { k: 'winter', name: 'the Long Winter', text: (land) => `the Long Winter: snow lay on ${land} from autumn to midsummer, and the rivers froze to the bed` },
  { k: 'fever', name: 'the Red Fever', text: (land) => `the Red Fever came across ${land} from the ports, and took one in six` },
  { k: 'comet', name: 'the Bearded Star', text: (land) => `a star with a burning beard hung over ${land} for a whole season, and the priests of every faith read it differently` },
  { k: 'quake', name: 'the Shaking', text: (land) => `the ground of ${land} shook for three days, and old walls came down in every town` },
  { k: 'blight', name: 'the Grey Blight', text: (land) => `the Grey Blight took the crops of ${land} two summers running, and bread was dearer than wine` },
  { k: 'locust', name: 'the Year of Wings', text: (land) => `clouds of locusts came over ${land} out of the south, and ate the fields to the root` },
];

export class Lore {
  constructor(game) {
    this.game = game;
    this.sim = game.sim;
    this.ow = game.world.ow;
    this.seed = game.seed >>> 0;
    this.day = game.day;
    this.now = yearOf(game.day);
    // (The long past is reckoned from the year the world began, and stays
    // put however long it's played.)
    this.base = yearOf(0);
    this.realms = [];
    this.byCiv = new Map();
    this.townCache = new Map();
    this.makeRealms();
    this.makePast();
  }

  // ------------------------------------------------------------ realms
  makeRealms() {
    const realms = this.sim.realms;
    for (const civ of this.ow.civs || []) {
      const towns = this.ow.settlements.filter((s) => s.civ === civ && !s.deserted && s.condition !== 'abandoned');
      if (!towns.length) continue;
      const capital = this.ow.settlements[civ.capital] || towns.find((s) => s.type === 'city') || towns[0];
      const style = civ.style || capital.style || 'vale';
      const rng = new RNG(hash4(this.seed, civ.id, 0xb00c));
      const R = {
        civ, id: civ.id, style, values: civ.values || [], people: civ.people || 'folk',
        name: theName(civ), short: shortOf(civ),
        capital, capName: capital.name, towns, island: capital.island || 'thessa',
        faith: realmFaith(civ), cuisine: cuisineOf(capital), title: shortTitle(civ),
        ruler: null,
      };
      R.land = LANDS[R.island] || 'the island';
      // On the throne now (if the world knows yet who).
      const st = realms && realms.state ? realms.state[civ.id] : null;
      if (st && st.head) R.ruler = `${R.title} ${st.headName || 'the ruler'}`;
      else if (st && st.ruler !== null && st.ruler !== undefined && realms.rulerName) R.ruler = realms.rulerName(civ);
      // When it was proclaimed, and the people came; and who has reigned.
      // (Proclaimed after its capital was built, before any of its towns
      // swore to it; its people came before any of their towns was
      // founded: see history.js, whose cities are 280 to 520 years old.)
      const hi = this.base - 212;
      const lo = Math.min(hi, Math.max(this.base - 276, this.foundedOf(capital) + 4));
      R.founded = rng.int(lo, hi);
      R.came = this.base - 520 - rng.int(15, 140);
      R.cameHow = rng.pick(STYLE_CAME[style] || STYLE_CAME.vale);
      R.kings = this.dynasty(R, rng);
      this.realms.push(R);
      this.byCiv.set(civ.id, R);
    }
  }

  // The rulers since the realm was proclaimed: each with their years and
  // what they were called for. (The last of them reigns still, if the world
  // hasn't named who reigns now.)
  dynasty(R, rng) {
    const out = [];
    let y = R.founded;
    const style = R.style;
    const eps = [...(STYLE_EPITHETS[style] || []), 'the Elder', 'the Bold', 'the Wise', 'the Just', 'the Young', 'the Pious', 'the Builder', 'the Unready', 'the Peacemaker', 'the Grey', 'the Lame', 'Longreign'];
    let first = true;
    while (y < this.base - 4) {
      const len = rng.int(7, 34);
      let nm = first && FOUNDERS[style] ? rng.pick(FOUNDERS[style]) : personName(rng, style).first;
      // (No two of a line with one name: the chronicles would muddle them.)
      for (let t = 0; t < 6 && out.some((q) => q.name === nm); t++) nm = personName(rng, style).first;
      // (No two of a line called the same.)
      const ep = rng.pick(eps.filter((e) => !out.some((q) => q.epithet === e)));
      const k = { name: nm, epithet: ep || rng.pick(eps), from: y, to: Math.min(this.base - 1, y + len), how: null };
      // (Not two of a line dying the same way running, but in their beds.)
      const hows = ['died in their bed', 'died in their bed', 'fell from a horse', 'died of a fever', 'gave up the throne in old age', 'died in battle', 'was poisoned, some say', 'drowned crossing a river', 'died in their sleep', 'died of a winter cough'];
      const last = out.slice(-2).map((q) => q.how);
      k.how = rng.pick(hows.filter((h) => h === 'died in their bed' || !last.includes(h)));
      k.full = `${R.title === 'Monarch' ? '' : `${R.title} `}${k.name} ${k.epithet}`;
      out.push(k);
      y = k.to + 1;
      first = false;
    }
    return out;
  }

  // When a town was founded: its history's year if it has one; otherwise
  // the year its history will give it (the same first draw history.js
  // makes), as near as can be told now.
  foundedOf(s) {
    const L = this.game.world.layouts ? this.game.world.layouts.get(s.id) : null;
    const h = L && L.econ && L.econ.history;
    if (h) return h.founded;
    if (s.founding) return yearOf(s.founding.day);
    const rng = new RNG(hash4(s.seed >>> 0, 0x415f));
    const age = s.type === 'city' ? rng.int(280, 520) : s.type === 'town' ? rng.int(110, 300) : rng.int(35, 150);
    return this.base - age;
  }

  realmOf(s) {
    return s && s.civ ? this.byCiv.get(s.civ.id) || null : null;
  }

  // Who reigned over a realm in a year.
  reigning(R, y) {
    return (R && R.kings.find((k) => y >= k.from && y <= k.to)) || null;
  }

  // ------------------------------------------------------------ the long past
  makePast() {
    const rng = new RNG(hash4(this.seed, 0xb00d));
    this.events = [];
    this.wars = [];
    for (const R of this.realms) {
      this.events.push({ y: R.came, kind: 'came', text: `the ${R.people} came to ${R.land}, ${R.cameHow}`, realms: [R.id] });
      this.events.push({ y: R.founded, kind: 'proclaimed', text: `${R.name} was proclaimed at ${R.capName}, and ${R.kings[0] ? R.kings[0].full : 'its first ruler'} took the throne`, realms: [R.id] });
    }
    // The old wars: between neighbours on one land, now and then.
    const pairs = [];
    for (const A of this.realms) for (const B of this.realms) {
      if (A.id >= B.id || A.island !== B.island) continue;
      const d = Math.hypot(A.capital.cx - B.capital.cx, (A.capital.cz - B.capital.cz) * 1.4);
      pairs.push({ A, B, d });
    }
    pairs.sort((p, q) => p.d - q.d);
    for (const { A, B, d } of pairs) {
      if (d > 34 || !rng.chance(d < 18 ? 0.8 : 0.45)) continue;
      const n = rng.chance(0.3) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = this.oldWar(rng.chance(0.5) ? [A, B] : [B, A], rng);
        if (w) this.wars.push(w);
      }
    }
    // What fell on a whole land.
    const lands = [...new Set(this.realms.map((R) => R.island))];
    for (const land of lands) {
      const rs = this.realms.filter((R) => R.island === land);
      const oldest = Math.min(...rs.map((R) => R.came));
      for (const ev of rng.shuffle(GREAT_EVENTS.slice()).slice(0, rng.int(2, 3))) {
        const y = rng.int(oldest + 10, this.base - 6);
        this.events.push({ y, kind: ev.k, name: ev.name, text: ev.text(LANDS[land] || 'the island'), realms: rs.map((R) => R.id), land });
      }
    }
    // (The wars as they're happening now, and lately ended.)
    for (const w of [...(this.sim.war?.past || []), ...(this.sim.war?.wars || [])]) {
      const lw = this.liveWar(w);
      if (lw) this.wars.push(lw);
    }
    for (const w of this.wars) {
      this.events.push({ y: w.start, kind: 'war', text: `${w.a.name} went to war with ${w.b.name} over ${w.why}`, realms: [w.a.id, w.b.id], war: w });
      if (w.end !== null) this.events.push({ y: w.end, kind: 'peace', text: w.endText, realms: [w.a.id, w.b.id], war: w });
    }
    this.events.sort((p, q) => p.y - q.y);
    this.wars.sort((p, q) => p.start - q.start);
    // (Nobody died in battle in a reign with no war at its end.)
    for (const R of this.realms) for (const k of R.kings) if (k.how === 'died in battle' && !k.war) k.how = 'died of a fever';
  }

  // An old war (A started it, against B): its battles, who won, the peace.
  oldWar([A, B], rng) {
    const lo = Math.max(A.founded, B.founded) + 5;
    const hi = this.base - 12;
    if (hi <= lo) return null;
    const start = rng.int(lo, hi);
    // (Not two wars at once between the same two.)
    if (this.wars.some((w) => ((w.a === A && w.b === B) || (w.a === B && w.b === A)) && start <= w.end + 3 && start >= w.start - 8)) return null;
    const C = CAUSES.filter((c) => c.when(A, B));
    const cause = rng.pick(C.length ? C : CAUSES.slice(-3));
    const len = rng.int(1, 9);
    const end = Math.min(this.base - 2, start + len);
    // Where it was fought: the towns nearest the other's capital.
    const nearTo = (towns, to) => towns.slice().sort((p, q) => Math.hypot(p.cx - to.cx, p.cz - to.cz) - Math.hypot(q.cx - to.cx, q.cz - to.cz));
    // (Only towns standing then.)
    const front = [...nearTo(B.towns, A.capital).slice(0, 3), ...nearTo(A.towns, B.capital).slice(0, 2)].filter((s) => this.foundedOf(s) < start - 5);
    if (!front.length) return null;
    let score = 0;
    const battles = [];
    const nb = rng.int(2, 4);
    for (let i = 0; i < nb; i++) {
      const at = rng.pick(front);
      const y = Math.min(end, start + Math.floor(((i + rng.next()) / nb) * (end - start + 1)));
      const siege = at.type === 'city' && rng.chance(0.5);
      const name = siege ? `the Siege of ${at.name}` : rng.pick([`the Battle of ${at.name}`, `the Battle of ${at.name} Ford`, `the Field of ${at.name}`, `the Battle of the ${at.name} Road`]);
      if (battles.some((b) => b.name === name)) continue;
      const winA = rng.chance(0.5 + (A.values.includes('martial') ? 0.12 : 0) - (B.values.includes('martial') ? 0.12 : 0));
      score += winA ? 1 : -1;
      battles.push({ name, y, at, winner: winA ? A : B, loser: winA ? B : A, fallen: rng.int(4, 40) * 10 });
    }
    battles.sort((p, q) => p.y - q.y);
    const victor = score > 0 ? A : score < 0 ? B : null;
    const loser = victor === A ? B : victor === B ? A : null;
    // The peace: a town the winner holds now, near the loser's capital, was
    // given up; or gold; or nothing won at all.
    let terms = 'white';
    let ceded = null;
    if (victor) {
      const cand = nearTo(victor.towns.filter((s) => s !== victor.capital && this.foundedOf(s) < start), loser.capital);
      if (cand.length && rng.chance(0.55)) {
        terms = 'ceded';
        ceded = cand[0];
      } else terms = 'tribute';
    }
    const peaceAt = rng.pick([A.capital, B.capital, ...front]);
    const w = {
      name: cause.name(A, B), cause: cause.k, why: cause.why(A, B), a: A, b: B, start, end, battles, victor, loser, terms, ceded,
      peace: `the Peace of ${peaceAt.name}`, live: false,
    };
    // (Two of a name: the second is the second.)
    const same = this.wars.filter((q) => q.name === w.name || q.name.startsWith(`${w.name} `)).length;
    if (same) w.name = `the ${['Second', 'Third', 'Fourth'][same - 1] || 'Last'} ${bare(w.name)}`;
    w.endText = terms === 'ceded' ? `${w.peace} ended ${w.name}, and ${ceded.name} passed from ${loser.name} to ${victor.name}`
      : terms === 'tribute' ? `${w.peace} ended ${w.name}, and ${loser.name} paid tribute to ${victor.name} for ${rng.int(3, 12)} years`
        : `${w.peace} ended ${w.name} with nothing won, and both sides counted their dead`;
    // A ruler who died in battle reigned through a war.
    for (const R of [A, B]) {
      const k = this.reigning(R, end);
      if (k && k.how === 'died in battle' && k.to === end) k.war = w;
    }
    return w;
  }

  // A war of the world as it is: from the war records.
  liveWar(w) {
    const A = this.byCiv.get(w.lead ? w.lead.a : w.a[0]);
    const B = this.byCiv.get(w.lead ? w.lead.b : w.b[0]);
    if (!A || !B) return null;
    const start = yearOf(w.start || 0);
    const battles = (w.battles || []).map((b) => ({ name: b.name, y: yearOf(b.day), at: null, winner: b.winner === 'a' ? A : B, loser: b.winner === 'a' ? B : A, fallen: (b.la || 0) + (b.lb || 0), decisive: b.decisive }));
    const victor = w.over ? (w.over.victor === A.id ? A : w.over.victor === B.id ? B : null) : null;
    return {
      name: `the war between ${A.short} and ${B.short}`, cause: w.reason || 'live', why: w.why || 'old grievances', a: A, b: B, start,
      end: w.over ? yearOf(w.over.day) : null, battles, victor, loser: victor ? (victor === A ? B : A) : null, terms: w.over ? w.over.terms : null,
      ceded: null, peace: null, live: true, endText: w.over ? String(w.over.text || '').replace(/\.$/, '') : null,
    };
  }

  // What else happened about a year (within `span` years), anywhere but
  // `not` (a town's own realm, say): for "in that same year...".
  near(y, span = 2, not = null) {
    return this.events.filter((e) => Math.abs(e.y - y) <= span && e.y <= this.now && (!not || !e.realms.includes(not)));
  }

  // ------------------------------------------------------------ towns
  // A town as the books know it.
  town(s) {
    if (!s) return null;
    let T = this.townCache.get(s.id);
    if (T) return T;
    const R = this.realmOf(s);
    const L = this.game.world.layouts ? this.game.world.layouts.get(s.id) : null;
    const hist = L && L.econ && this.sim.history ? this.sim.history.of(L) : null;
    T = {
      s, id: s.id, name: s.name, kind: s.type, realm: R, style: (s.civ ? s.civ.style : s.style) || 'vale', biome: s.biome, ground: groundWord(s.biome),
      water: s.coast ? 'the sea' : s.river ? 'the river' : s.lake ? 'the lake' : null,
      faith: religionOf(s), cuisine: cuisineOf(s), island: s.island || 'thessa', mountain: !!s.nearMountain,
      dungeons: (this.sim.dungeons ? this.sim.dungeons.all : []).filter((d) => d.town === s.id && d.name),
      hist, L,
    };
    T.land = LANDS[T.island] || 'the island';
    T.dishes = T.cuisine.dishes.map((k) => (ITEMS[k] ? ITEMS[k].name : k));
    T.wars = this.wars.filter((w) => w.battles.some((b) => b.at === s) || w.ceded === s);
    this.townCache.set(s.id, T);
    return T;
  }

  // The nearest towns to one (on the same land), with the way there.
  neighbours(s, n = 3) {
    return this.ow.settlements
      .filter((q) => q !== s && (q.island || 'thessa') === (s.island || 'thessa') && !q.deserted && q.condition !== 'abandoned')
      .map((q) => ({ q, d: Math.hypot(q.cx - s.cx, (q.cz - s.cz) * 1.4) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map(({ q }) => ({ T: this.town(q), way: dirFrom(s, q).replace(/ of .*$/, '') }));
  }

  // The way from one town to another: which way, and how long a walk.
  wayTo(a, b) {
    const dx = b.cx + (b.cw || 1) / 2 - (a.cx + (a.cw || 1) / 2);
    const dz = b.cz + (b.cd || 1) / 2 - (a.cz + (a.cd || 1) / 2);
    const d = Math.hypot(dx, dz * 1.4);
    const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    const k = Math.round((Math.atan2(-dz, dx) / (Math.PI * 2)) * 8 + 8) % 8;
    const days = d < 2.5 ? 'a few hours' : d < 5 ? 'half a day' : d < 9 ? 'a day' : d < 14 ? 'two days' : 'three days';
    return { dir: dirs[k], days };
  }

  // A road through several towns, each the nearest not yet seen.
  route(s, n, rng) {
    const out = [s];
    let at = s;
    for (let i = 1; i < n; i++) {
      const next = this.ow.settlements
        .filter((q) => !out.includes(q) && (q.island || 'thessa') === (s.island || 'thessa') && !q.deserted && q.condition !== 'abandoned')
        .map((q) => ({ q, d: Math.hypot(q.cx - at.cx, (q.cz - at.cz) * 1.4) + rng.float(0, 3) }))
        .sort((a, b) => a.d - b.d)[0];
      if (!next || next.d > 22) break;
      out.push(next.q);
      at = next.q;
    }
    return out;
  }

  // ------------------------------------------------------------ old places
  dungeons(filter = () => true) {
    return (this.sim.dungeons ? this.sim.dungeons.all : []).filter((d) => d.name && d.origin && filter(d));
  }

  // Where an old place is: "a half day north of Redford".
  whereOf(d) {
    const t = d.town !== null && d.town !== undefined ? this.ow.settlements[d.town] : null;
    return dirFrom(t, d);
  }

  // What lives in an old place of its kind (by name).
  dwellers(d) {
    try {
      const T = dtypeOf({ type: d.type, isle: d.isle || null });
      return (T.mobs || []).map(([k]) => (SPECIES[k] ? SPECIES[k].name : null)).filter(Boolean);
    } catch {
      return [];
    }
  }

  ancients() {
    return this.dungeons((d) => isAncient(d.type));
  }

  spires() {
    return this.dungeons((d) => d.type === 'kavorent');
  }

  // The ancient arts, and which realms have them.
  arts() {
    const A = this.sim.ancient;
    return ANCIENT_IDS.map((id) => ({ id, ...ANCIENT[id], realms: this.realms.filter((R) => A && A.has && A.has(R.capital, id)) }));
  }

  // ------------------------------------------------------------ beasts
  beasts(land) {
    return Object.entries(SPECIES)
      .filter(([k, sp]) => (land === 'thessa' ? HOME_BEASTS.includes(k) : sp.isle === land && !sp.boss && !sp.under && !sp.minion))
      .map(([k, sp]) => ({ key: k, ...sp, drops: (sp.drops || []).map(([it]) => (ITEMS[it] ? ITEMS[it].name.toLowerCase() : it.replace(/_/g, ' '))) }));
  }

  // The things only told of: what haunts the hills, by each people's tales.
  haunts(style) {
    return { beasts: STYLE_BEASTS[style] || STYLE_BEASTS.vale, places: STYLE_PLACES[style] || STYLE_PLACES.vale };
  }

  taboo(k) {
    return TABOOS[k] ? TABOOS[k].rule : null;
  }
}

// The books' knowledge of a world (made once a day: the world moves on).
export function loreOf(game) {
  const k = `${game.seed}:${game.day}`;
  if (game._bookLore && game._bookLore.key === k) return game._bookLore.lore;
  const lore = new Lore(game);
  game._bookLore = { key: k, lore };
  return lore;
}

export { cap, bare };
