// Every town has a past: who founded it and when, the fires, floods and
// sieges it came through, what it's known for, and the old story folk tell
// round the fire. It's cut on the plaque by the old statue on the square,
// written up in the library's books, and told by anyone who's asked. What
// happens from now on (battles, raids, heroes, a new ruler, a town grown
// into a city) is added as it happens, and the greatest deeds get a statue
// of their own on the square.
import { RNG, hash4 } from '../util/rng.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { ledger } from './econ.js';
import { religionOf, cuisineOf } from './culture.js';

// The year it is now: a year here runs sixty days.
const YEAR_DAYS = 60;
const BASE_YEAR = 1180;
export function yearOf(day) {
  return BASE_YEAR + Math.floor(Math.max(0, day) / YEAR_DAYS);
}

const FOUNDERS = {
  vale: ['Aldo', 'Berta', 'Corin', 'Dela', 'Emrys', 'Fenna', 'Galt', 'Hesse', 'Ines', 'Jorn'],
  north: ['Asgrim', 'Brynja', 'Egil', 'Frida', 'Halvar', 'Ingrid', 'Ketil', 'Sigrun'],
  sun: ['Amun', 'Bastet', 'Farid', 'Hanan', 'Idris', 'Layla', 'Nabil', 'Samira'],
  wild: ['Ayo', 'Chidi', 'Ekon', 'Imani', 'Kofi', 'Nia', 'Tendai', 'Zola'],
  high: ['Balin', 'Dagna', 'Durin', 'Helga', 'Thrain', 'Brunhild', 'Gimra', 'Orsik'],
};
const EPITHETS = ['the Elder', 'the Founder', 'Oakheart', 'the Bold', 'Longstride', 'the Wise', 'Ironhand', 'the Wanderer', 'Hearthkeeper', 'of the Old Road'];
// Each people's own: epithets, how founders came, what haunts the hills,
// the places stories are told of, and the things that happen to them.
const STYLE_EPITHETS = {
  vale: ['the Ploughman', 'Goodwife', 'the Miller', 'Applecheek', 'the Shepherd'],
  north: ['Bloodaxe', 'the Far-Sailing', 'Wolfskin', 'the Unbowed', 'Ice-Beard'],
  sun: ['the Star-Reader', 'of the Seven Wells', 'the Caravaneer', 'the Patient', 'Gold-Hand'],
  wild: ['Jaguar-Eye', 'the Rain-Bringer', 'Feather-Crowned', 'Who-Walks-Softly', 'the Root-Keeper'],
  high: ['Stonefist', 'the Delver', 'Forge-Born', 'Deepdelver', 'Oakenshield'],
};
const STYLE_CAME = {
  vale: ['over the hills with their sheep', 'up the river on a barge of seed corn', 'from the old kingdom after the war', 'looking for good black earth'],
  north: ['across the sea in three longships', 'over the ice in the hungry winter', 'following the whales down the coast', 'exiled from a jarl\'s hall'],
  sun: ['with a caravan of forty camels', 'following a star across the sands', 'from the drowned city on the coast', 'seeking a well that never dries'],
  wild: ['when the old forest city fell', 'following the jaguar\'s tracks', 'paddling down the great river', 'led by a dream of the Rain-Lord'],
  high: ['up from the deep halls below', 'over the high passes before the snows', 'following a seam of silver', 'driven out of the old mountain by fire'],
};
const STYLE_BEASTS = {
  vale: ['a great white stag', 'a black dog with eyes like lamps', 'a lady in grey', 'a headless rider'],
  north: ['a wolf as big as a horse', 'a draugr that walks the shore', 'a serpent in the deep water', 'a troll under the bridge'],
  sun: ['a djinn in the old well', 'a sand-wyrm', 'a veiled woman who asks for water', 'a lion with a man\'s face'],
  wild: ['a jaguar that walks like a man', 'a feathered serpent', 'the weeping woman of the river', 'a spirit in the great tree'],
  high: ['a wyrm under the hill', 'a stone giant', 'the lost miners\' lanterns', 'a goat with golden horns'],
};
const STYLE_PLACES = {
  vale: ['the old well', 'the mill race', 'the crossroads', 'the churchyard yew'],
  north: ['the burial mound', 'the old longhouse', 'the sea cliffs', 'the standing stones'],
  sun: ['the dry well', 'the old caravanserai', 'the dunes', 'the star tower'],
  wild: ['the old pyramid', 'the cenote', 'the great tree', 'the overgrown ballcourt'],
  high: ['the old mine', 'the deep stair', 'the cairn on the peak', 'the sealed door'],
};
// What befalls each people (and its land) in the years.
const STYLE_EVENTS = {
  vale: [
    (s) => `A great fair was held in ${s.name}, and folk came from three valleys to sell their wool.`,
    () => 'The blight took the apple orchards; it was ten years before they bore again.',
    (s) => `A saint was said to have healed the lame at the well of ${s.name}. Pilgrims still come.`,
    () => 'The harvest was so great the barns would not hold it, and the surplus fed the whole valley through the next winter.',
  ],
  north: [
    () => 'Raiders from over the sea burned the boathouses; the town rowed out after them and took back the stolen cattle.',
    () => 'The Long Winter: the sea froze to the horizon, and men walked to the islands on the ice.',
    (s) => `A whale beached at ${s.name}, and fed the town through a hungry spring.`,
    () => 'A jarl\'s feud split the town for a generation, and ended with a wedding.',
  ],
  sun: [
    () => 'The great drought: the wells ran dry, and the town lived on what the caravans brought.',
    (s) => `A star-reader of ${s.name} foretold an eclipse to the hour, and was made chief of the council.`,
    () => 'A sandstorm buried the old market; it was dug out again stall by stall.',
    () => 'Spice traders from the far south came, and the town grew rich on pepper and saffron.',
  ],
  wild: [
    () => 'The rains failed for three years, until the shaman danced for nine days without rest.',
    () => 'A fever came up from the river and took the young and old alike.',
    (s) => `The jungle swallowed half of ${s.name} while its people were away at war; it was cut back by hand.`,
    () => 'A great flood carried away the old shrine, and the god was said to be angry.',
  ],
  high: [
    () => 'A mine collapsed, and forty were lost; their names are cut into the deep stair.',
    () => 'An avalanche came down in the night and buried the lower houses.',
    (s) => `A vein of silver was struck under ${s.name}, and the town was rich for a lifetime.`,
    () => 'The forges burned day and night for a year to arm the realm against the lowlanders.',
  ],
};
// What a realm's values bring.
const VALUE_EVENTS = {
  martial: (s) => `The men and women of ${s.name} marched to war, and fewer came home; a stone on the square names the dead.`,
  mercantile: (s) => `The merchants' guild of ${s.name} was chartered, and the market moved inside the walls.`,
  pious: (s) => `A holy relic was brought to ${s.name} in a procession that lasted three days.`,
  scholarly: (s) => `A school was founded in ${s.name}, and its masters' books are copied to this day.`,
  agrarian: () => 'New ploughs came, and the fields were doubled in a single season.',
  seafaring: () => 'A ship of the town sailed beyond the edge of the charts, and came home a year later laden with spices.',
  artisan: (s) => `The craftsmen of ${s.name} made a clock for the town hall that still keeps time.`,
};
const BEASTS = ['a great white stag', 'a wolf as big as a horse', 'a serpent in the deep water', 'a wyrm under the hill', 'a headless rider', 'a lady in grey', 'a bear that walks like a man'];
const PLACES = ['the old well', 'the graveyard', 'the hill road', 'the mill race', 'the ruined tower', 'the crossroads'];
const CAME = ['over the hills', 'up the river', 'across the sea', 'out of the east', 'down from the high passes', 'fleeing a hard winter', 'following a wandering star'];

// Recent news worth writing into a town's history (from its ledger).
const NOTABLE = /Battle of|raided|raiders|burned|sacked|is named Hero|statue|crowned|now rules|is a (town|city) now|became a (town|city)|swore|broke away|made peace|declared war|opens its gates|taken by|bandits|exiled|founded|plague|great fire|are no more|opened the doors of their own|week after week/i;

export class History {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // The town's story (made up the first time it's asked for).
  of(L) {
    const e = L.econ;
    if (!e.history) e.history = this.generate(L);
    return e.history;
  }

  generate(L) {
    const s = L.settlement;
    const rng = new RNG(hash4(s.seed >>> 0, 0x415f));
    const style = (s.civ ? s.civ.style : s.style) || 'vale';
    const now = yearOf(this.game.day);
    const age = s.type === 'city' ? rng.int(280, 520) : s.type === 'town' ? rng.int(110, 300) : rng.int(35, 150);
    const founded = now - age;
    const founder = `${rng.pick(FOUNDERS[style] || FOUNDERS.vale)} ${rng.pick(rng.chance(0.6) ? STYLE_EPITHETS[style] || EPITHETS : EPITHETS)}`;
    const entries = [];
    const at = (lo, hi) => founded + Math.round(age * rng.float(lo, hi));
    // (A village settlers founded in your own time: its true story.)
    if (s.founding || L.econ.foundedBy) {
      const from = this.game.world.ow.settlements[(s.founding || L.econ.foundedBy).from];
      const y = yearOf((s.founding || L.econ.foundedBy).day);
      L.econ.foundedBy = s.founding || L.econ.foundedBy;
      const first = L.npcs.find((r) => r.age === 'adult');
      const who = first ? `${first.name.first} ${first.name.last}` : 'settlers';
      return { founded: y, founder: who, famous: 'being new', legend: `${who} chose this spot because a ${rng.pick(['hawk', 'deer', 'crow', 'fox'])} crossed their path here.`, entries: [{ y, text: `${s.name} was founded by settlers from ${from ? from.name : 'afar'}, led by ${who}.`, kind: 'founded' }], scanned: 0 };
    }
    entries.push({ y: founded, text: `${s.name} was founded by ${founder}, who came ${rng.pick(rng.chance(0.7) ? STYLE_CAME[style] || CAME : CAME)} with ${rng.int(3, 12)} families.`, kind: 'founded' });
    const pool = [];
    // The people's own troubles and glories, and its realm's.
    for (const f of rng.shuffle((STYLE_EVENTS[style] || []).slice()).slice(0, 2)) pool.push(() => ({ y: at(0.1, 0.95), text: f(s), kind: 'lore' }));
    for (const v of (s.civ ? s.civ.values || [] : []).slice(0, 2)) if (VALUE_EVENTS[v]) pool.push(() => ({ y: at(0.5, 0.97), text: VALUE_EVENTS[v](s), kind: 'realm' }));
    if (s.biome === 'desert') pool.push(() => ({ y: at(0.1, 0.9), text: 'A year without rain: the date palms died, and were planted again.', kind: 'drought' }));
    if (s.biome === 'tundra' || s.biome === 'taiga') pool.push(() => ({ y: at(0.1, 0.9), text: 'Wolves came down out of the forest in the dead of winter, and the watch kept the fires lit for a month.', kind: 'winter' }));
    if (s.biome === 'swamp') pool.push(() => ({ y: at(0.1, 0.9), text: 'A fog lay on the fen for forty days, and boats that went out into it never came back.', kind: 'fog' }));
    if (s.coast) pool.push(() => ({ y: at(0.1, 0.9), text: 'A ship broke up on the rocks in a storm; the town took in the sailors, and some never left.', kind: 'wreck' }));
    if (s.type !== 'village') pool.push(() => ({ y: at(0.2, 0.6), text: `Most of ${s.name} burned in the Great Fire, and was built again ${s.type === 'city' ? 'in stone' : 'by the next summer'}.`, kind: 'fire' }));
    if (s.river || s.lake || s.coast) pool.push(() => ({ y: at(0.1, 0.8), text: `The ${s.coast ? 'sea came over the harbour wall' : s.river ? 'river burst its banks' : 'lake rose'} and took the old mill and half the fields.`, kind: 'flood' }));
    pool.push(() => ({ y: at(0.3, 0.9), text: 'The coughing sickness took one in five. The graveyard was doubled that year.', kind: 'plague' }));
    if (s.type === 'city' || L.walled) pool.push(() => ({ y: at(0.4, 0.9), text: `${s.name} held out through a long siege, and the walls were raised higher after.`, kind: 'siege' }));
    pool.push(() => ({ y: at(0.05, 0.5), text: `The temple of ${religionOf(s).god} was raised on the hill.`, kind: 'temple' }));
    pool.push(() => ({ y: at(0.2, 0.95), text: 'A hungry winter: the snow lay till spring, and the town ate its seed corn.', kind: 'famine' }));
    pool.push(() => ({ y: at(0.1, 0.9), text: `A star with a burning tail hung over ${s.name} for nine nights.`, kind: 'omen' }));
    if (s.civ) pool.push(() => ({ y: at(0.6, 0.98), text: `${s.name} swore itself to the ${s.civ.name.replace(/^The /, '')}.`, kind: 'realm' }));
    for (const f of rng.shuffle(pool).slice(0, s.type === 'city' ? 6 : s.type === 'town' ? 4 : 3)) entries.push(f());
    entries.sort((a, b) => a.y - b.y);
    // Known for.
    const c = cuisineOf(s);
    const known = [];
    if (s.nearMountain) known.push('its iron', 'its miners');
    if (s.coast || s.river || s.lake) known.push('its fish', 'its boatmen');
    if (['forest', 'taiga', 'jungle'].includes(s.biome)) known.push('its timber');
    if (['plains', 'savanna'].includes(s.biome)) known.push('its horses');
    if (L.fields && L.fields.length) known.push('its harvest fairs');
    known.push(`its ${c.word.split(' and ')[0]}`);
    if (!(/ale|mead|beer/.test(c.drink) && religionOf(s).taboos.includes('no_drink'))) known.push(`its ${c.drink}`);
    const famous = rng.pick(known);
    const places = rng.chance(0.7) ? STYLE_PLACES[style] || PLACES : PLACES;
    const beasts = rng.chance(0.7) ? STYLE_BEASTS[style] || BEASTS : BEASTS;
    const faith = religionOf(s);
    const legend = rng.pick([
      `${founder}'s ghost walks ${rng.pick(places)} on ${faith.holyName} nights.`,
      `${rng.pick(beasts)} lives out past ${rng.pick(places)}. Folk who go looking don't come back the same.`,
      `There's gold buried under ${rng.pick(places)}, from before the town was even here.`,
      `the old statue on the square weeps on the day ${founder} died.`,
      `${founder} never died at all, and sleeps under the hill till ${s.name} needs them again.`,
      `${faith.god} once walked through ${s.name} in the shape of ${faith.beast}, and blessed the house that fed them.`,
      `whoever drinks from ${rng.pick(places)} at midnight on ${faith.feast} sees their true love's face.`,
    ]);
    return { founded, founder, famous, legend, entries, scanned: 0 };
  }

  // Something worth remembering happened here.
  add(L, text, kind = 'event', day = this.game.day) {
    if (!L || !L.econ) return null;
    const h = this.of(L);
    if (h.entries.some((q) => q.text === text)) return null;
    const it = { y: yearOf(day), day, text, kind };
    h.entries.push(it);
    // (The made-up past is kept; the recent run is trimmed.)
    const live = h.entries.filter((q) => q.day !== undefined);
    if (live.length > 30) h.entries.splice(h.entries.indexOf(live[0]), 1);
    return it;
  }

  // Daily: the notable lines of the town's ledger go into its history.
  daily(L, day) {
    const h = this.of(L);
    const list = L.econ.ledger || [];
    for (const it of list) {
      if (it.day < (h.scanned || 0) || it.day > day) continue;
      if (NOTABLE.test(it.text) && !/council wants|can't pay/i.test(it.text)) this.add(L, it.text, 'news', it.day);
    }
    h.scanned = day + 1;
  }

  // The plaque by the old statue (and the history book in the library).
  lines(L, max = 14) {
    const h = this.of(L);
    const s = L.settlement;
    const out = [`Founded in the year ${h.founded} by ${h.founder}.`, `Known far and wide for ${h.famous}.`, ''];
    const list = h.entries.filter((q) => q.kind !== 'founded');
    const keep = list.slice(-Math.max(1, max - 4));
    for (const q of keep) out.push(`${q.y}: ${q.text}`);
    if (!keep.length) out.push(`Little has happened in ${s.name} that anyone wrote down.`);
    return out;
  }

  // What someone tells you of the place.
  talk(L, rng) {
    const h = this.of(L);
    const s = L.settlement;
    const out = [`${s.name}? ${h.founder} founded it, back in ${h.founded}. ${yearOf(this.game.day) - h.founded} years ago, near enough.`];
    const old = h.entries.filter((q) => q.day === undefined && q.kind !== 'founded');
    const recent = h.entries.filter((q) => q.day !== undefined);
    if (old.length) {
      const o = rng.pick(old);
      out.push(`My grandmother used to tell how in ${o.y}... ${o.text.replace(/^\w/, (c) => c.toLowerCase())}`);
    }
    if (recent.length) out.push(`And not long ago: ${recent[recent.length - 1].text.replace(/^\w/, (c) => c.toLowerCase())}`);
    out.push(`We're known for ${h.famous.replace(/^its /, 'our ')}. And they say ${h.legend}`);
    return out;
  }

  legend(L) {
    return this.of(L).legend;
  }

  // ------------------------------------------------------------ statues
  // A statue on the square for someone who did something great here.
  raiseStatue(L, who, deed, day = this.game.day, kind = 'npc') {
    if (!L || !L.econ || !L.plaza) return null;
    const e = L.econ;
    e.statues ||= [];
    if (e.statues.some((q) => q.who === who && q.deed === deed)) return null;
    const p = L.plaza;
    const w = this.game.world;
    const taken = new Set(e.statues.map((q) => `${q.x},${q.z}`));
    // (Nor where the portal stands.)
    const portal = this.sim.portals && this.sim.portals.of(L.settlement.id);
    if (portal) taken.add(`${portal.x},${portal.z}`);
    let at = null;
    for (let r = 2; r <= 7 && !at; r++) {
      for (let dz = -r; dz <= r && !at; dz++) {
        for (let dx = -r; dx <= r && !at; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || (dx + dz) % 2) continue;
          const x = p.cx + dx;
          const z = p.cz + dz;
          if (L.maskAt(x, z) !== M.PLAZA || taken.has(`${x},${z}`)) continue;
          if (L.spots && L.spots.some && L.spots.some((q) => q.x === x && q.z === z)) continue;
          if (w.regionAt(x, z) && (w.getBlock(x, GROUND, z) !== B.air || this.game.entityAt?.(x, GROUND, z))) continue;
          at = { x, z };
        }
      }
    }
    if (!at) return null;
    this.sim.setBlocks([[at.x, GROUND, at.z, B.statue, 0]]);
    const st = { x: at.x, z: at.z, who, deed, day, kind };
    e.statues.push(st);
    const text = `A statue of ${who} was raised on the square, for ${deed}.`;
    ledger(L, day, text);
    this.add(L, text, 'statue', day);
    if (this.game.active.has(L.settlement.id)) this.game.ui.msg(`${L.settlement.name} raises a statue of ${who} on the square, for ${deed}.`, '#ffe070');
    return st;
  }

  statueAt(L, x, z) {
    return (L.econ.statues || []).find((q) => q.x === x && q.z === z) || null;
  }

  // What the statue or the plaque says.
  statueText(L, x, z) {
    const st = this.statueAt(L, x, z);
    if (st) return { title: `A STATUE OF ${st.who.toUpperCase()}`, lines: [`${st.who}`, `for ${st.deed}`, '', `Raised by the people of ${L.settlement.name}`, `in the year ${yearOf(st.day)}.`] };
    return { title: `THE HISTORY OF ${L.settlement.name.toUpperCase()}`, lines: this.lines(L) };
  }
}
