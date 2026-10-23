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
import { farTable } from '../world/farlands.js';
import { FOUNDINGS, FORTUNES, TOWN_EVENTS, LEGENDS, FAME_BY_EVENT, cropOf, namer } from './pasts.js';

// The year it is now: a year here runs sixty days.
const YEAR_DAYS = 60;
const BASE_YEAR = 1180;
export function yearOf(day) {
  return BASE_YEAR + Math.floor(Math.max(0, day) / YEAR_DAYS);
}

export const FOUNDERS = {
  vale: ['Aldo', 'Berta', 'Corin', 'Dela', 'Emrys', 'Fenna', 'Galt', 'Hesse', 'Ines', 'Jorn'],
  north: ['Asgrim', 'Brynja', 'Egil', 'Frida', 'Halvar', 'Ingrid', 'Ketil', 'Sigrun'],
  sun: ['Amun', 'Bastet', 'Farid', 'Hanan', 'Idris', 'Layla', 'Nabil', 'Samira'],
  wild: ['Ayo', 'Chidi', 'Ekon', 'Imani', 'Kofi', 'Nia', 'Tendai', 'Zola'],
  high: ['Balin', 'Dagna', 'Durin', 'Helga', 'Thrain', 'Brunhild', 'Gimra', 'Orsik'],
  ember: ['Azkar', 'Brasa', 'Cendrik', 'Hestra', 'Ignar', 'Pyrrha', 'Tephros', 'Vulka'],
  mist: ['Aelwen', 'Bryn', 'Gloamwyn', 'Heth', 'Lune', 'Myrrin', 'Sorrel', 'Vell'],
  tide: ['Ahi', 'Kailani', 'Makoa', 'Nalu', 'Pelani', 'Reva', 'Tasi', 'Wahine'],
};
const EPITHETS = ['the Elder', 'the Founder', 'Oakheart', 'the Bold', 'Longstride', 'the Wise', 'Ironhand', 'the Wanderer', 'Hearthkeeper', 'of the Old Road'];
// Each people's own: epithets, how founders came, what haunts the hills,
// the places stories are told of, and the things that happen to them.
export const STYLE_EPITHETS = {
  vale: ['the Ploughman', 'Goodwife', 'the Miller', 'Applecheek', 'the Shepherd'],
  north: ['Bloodaxe', 'the Far-Sailing', 'Wolfskin', 'the Unbowed', 'Ice-Beard'],
  sun: ['the Star-Reader', 'of the Seven Wells', 'the Caravaneer', 'the Patient', 'Gold-Hand'],
  wild: ['Jaguar-Eye', 'the Rain-Bringer', 'Feather-Crowned', 'Who-Walks-Softly', 'the Root-Keeper'],
  high: ['Stonefist', 'the Delver', 'Forge-Born', 'Deepdelver', 'Oakenshield'],
  ember: ['Ash-Crowned', 'the Unburnt', 'Glassblood', 'the Kiln-Keeper', 'Smoke-Eye'],
  mist: ['the Lantern', 'Fog-Walker', 'the Quiet', 'Owl-Sight', 'Moss-Hand'],
  tide: ['Sharktooth', 'the Pearl-Diver', 'Net-Mender', 'Wave-Rider', 'the Storm-Watcher'],
};
export const STYLE_CAME = {
  vale: ['over the hills with their sheep', 'up the river on a barge of seed corn', 'from the old kingdom after the war', 'looking for good black earth'],
  north: ['across the sea in three longships', 'over the ice in the hungry winter', 'following the whales down the coast', 'exiled from a jarl\'s hall'],
  sun: ['with a caravan of forty camels', 'following a star across the sands', 'from the drowned city on the coast', 'seeking a well that never dries'],
  wild: ['when the old forest city fell', 'following the jaguar\'s tracks', 'paddling down the great river', 'led by a dream of the Rain-Lord'],
  high: ['up from the deep halls below', 'over the high passes before the snows', 'following a seam of silver', 'driven out of the old mountain by fire'],
  ember: ['across the black glass fields after the last waking', 'out of the caves when the ash settled', 'following the smoke to the forge-fires', 'from Thessa, cast out for worshipping the mountain'],
  mist: ['out of the fog one morning, nobody knows from where', 'following lantern-lights over the moor', 'from the drowned villages of the south shore', 'seeking the mushroom rings their grandmothers spoke of'],
  tide: ['on a raft of mangrove logs lashed with kelp', 'following the turtles to their landing beaches', 'when the reef villages sank', 'from Thessa, looking for warmer water'],
};
export const STYLE_BEASTS = {
  vale: ['a great white stag', 'a black dog with eyes like lamps', 'a lady in grey', 'a headless rider'],
  north: ['a wolf as big as a horse', 'a draugr that walks the shore', 'a serpent in the deep water', 'a troll under the bridge'],
  sun: ['a djinn in the old well', 'a sand-wyrm', 'a veiled woman who asks for water', 'a lion with a man\'s face'],
  wild: ['a jaguar that walks like a man', 'a feathered serpent', 'the weeping woman of the river', 'a spirit in the great tree'],
  high: ['a wyrm under the hill', 'a stone giant', 'the lost miners\' lanterns', 'a goat with golden horns'],
  ember: ['a salamander as long as a ship', 'the Sleeper\'s red eye in the crater', 'a man of black glass', 'the ash-walkers who come before an eruption'],
  mist: ['the Hollow King and his grey court', 'a lantern that walks by itself', 'the drowned who call from the bog', 'an owl with a woman\'s voice'],
  tide: ['the shark who waits beyond the reef', 'a turtle as big as an island', 'the singing in the storm wall', 'a drowned ship that sails by night'],
};
export const STYLE_PLACES = {
  vale: ['the old well', 'the mill race', 'the crossroads', 'the churchyard yew'],
  north: ['the burial mound', 'the old longhouse', 'the sea cliffs', 'the standing stones'],
  sun: ['the dry well', 'the old caravanserai', 'the dunes', 'the star tower'],
  wild: ['the old pyramid', 'the cenote', 'the great tree', 'the overgrown ballcourt'],
  high: ['the old mine', 'the deep stair', 'the cairn on the peak', 'the sealed door'],
  ember: ['the crater\'s lip', 'the glass fields', 'the steam vents', 'the old lava tube'],
  mist: ['the standing stones', 'the mushroom ring', 'the bog road', 'the lantern cairn'],
  tide: ['the reef', 'the turtle beach', 'the old pier', 'the mangrove maze'],
};
// What befalls each people (and its land) in the years.
const STYLE_EVENTS = {
  vale: [
    (s) => `A great fair was held in ${s.name}, and folk came from three valleys to sell their wool.`,
    () => 'The blight took the apple orchards; it was ten years before they bore again.',
    (s) => `A saint was said to have healed the lame at the well of ${s.name}. Pilgrims still come.`,
    () => 'The harvest was so great the barns would not hold it, and the surplus fed the whole valley through the next winter.',
    (s) => `The miller of ${s.name} was caught with a thumb on the scales, and the whole town ducked them in the mill pond.`,
    () => 'A sheep-shearing contest was begun that year, and the champion\'s crook still hangs in the inn.',
    (s) => `The great hedge round ${s.name}'s common was planted, a mile of hawthorn, and the cattle stopped wandering.`,
    () => 'A cheese of the town took first prize at the county fair three years running, and the rival towns cried foul.',
  ],
  north: [
    () => 'Raiders from over the sea burned the boathouses; the town rowed out after them and took back the stolen cattle.',
    () => 'The Long Winter: the sea froze to the horizon, and men walked to the islands on the ice.',
    (s) => `A whale beached at ${s.name}, and fed the town through a hungry spring.`,
    () => 'A jarl\'s feud split the town for a generation, and ended with a wedding.',
    (s) => `A longship of ${s.name} went raiding and came home with a bell from a foreign temple; it hangs in the longhouse still.`,
    () => 'The skalds held a contest of verses that lasted three nights, and the winner was given a gold arm-ring.',
    () => 'A bear came into the town in the dead of winter and slept a week in the smokehouse before anyone dared move it.',
    (s) => `The sea-wall of ${s.name} was raised after a storm surge took the boat-sheds and twelve good boats.`,
  ],
  sun: [
    () => 'The great drought: the wells ran dry, and the town lived on what the caravans brought.',
    (s) => `A star-reader of ${s.name} foretold an eclipse to the hour, and was made chief of the council.`,
    () => 'A sandstorm buried the old market; it was dug out again stall by stall.',
    () => 'Spice traders from the far south came, and the town grew rich on pepper and saffron.',
    (s) => `An astronomer of ${s.name} built a tower to watch the stars from, and named a new one after the town.`,
    () => 'A caravan was lost in the deep sands; one camel came back alone, still carrying its load.',
    () => 'The new cistern was dug under the square, and the town never went thirsty again.',
    (s) => `A poet of ${s.name} wrote a song about the river of stars, and it is sung at every wedding still.`,
  ],
  wild: [
    () => 'The rains failed for three years, until the shaman danced for nine days without rest.',
    () => 'A fever came up from the river and took the young and old alike.',
    (s) => `The jungle swallowed half of ${s.name} while its people were away at war; it was cut back by hand.`,
    () => 'A great flood carried away the old shrine, and the god was said to be angry.',
    (s) => `The ballcourt of ${s.name} was built, and its team beat every town on the river for twenty years.`,
    () => 'A giant tree fell across the river, and the town used it as a bridge for a hundred years.',
    (s) => `Hunters of ${s.name} brought back a jaguar pelt as long as a canoe, and it was hung in the shrine.`,
    () => 'The cacao harvest was so rich that beans were used as coins for a season.',
  ],
  high: [
    () => 'A mine collapsed, and forty were lost; their names are cut into the deep stair.',
    () => 'An avalanche came down in the night and buried the lower houses.',
    (s) => `A vein of silver was struck under ${s.name}, and the town was rich for a lifetime.`,
    () => 'The forges burned day and night for a year to arm the realm against the lowlanders.',
    (s) => `The deep stair of ${s.name} broke into a cavern of crystal, and it was sealed again the same day by order of the elders.`,
    () => 'A runesmith carved the town\'s laws into the hall pillars, so no one could ever say they had not been told.',
    () => 'A goat-herd found the old pass through the peaks, and the trade over it made the town rich for a while.',
    (s) => `The clan-moot of ${s.name} sat for nine days over who owned a single cart of ore.`,
  ],
  ember: [
    () => 'The mountain woke, and the sky was black for a week; the town was dug out of the ash by hand.',
    (s) => `A river of fire stopped a stone's throw from ${s.name}. The kiln-priests say the Sleeper spared it.`,
    () => 'A glassknapper made a blade so keen it cut a falling hair, and the ruler hung it over the throne.',
    () => 'The sulphur pits caught fire, and burned blue for a whole season.',
    (s) => `Warm springs broke out of the rock by ${s.name}, and a bathhouse was built over them.`,
    () => 'A kiln-priest walked across the cooling lava to the crater, and came back with a stone that never cools.',
    () => 'Ash ruined the harvest, but the year after, the fields grew taller than anyone had ever seen.',
    (s) => `The black glass of ${s.name} was sold as far as the coast, and the glassknappers formed a guild of their own.`,
  ],
  mist: [
    () => 'A fog came in and did not lift for forty days; some who went into it never came out.',
    (s) => `A ring of giant mushrooms came up overnight on the square of ${s.name}, and nobody dared cut them.`,
    () => 'The bog gave up an old king in his crown, perfectly kept; he was buried again with honours.',
    () => 'A blight took the glowcaps, and the winter was long and dark until they came back.',
    (s) => `A lantern was lit at the edge of ${s.name} for the lost, and someone has kept it burning every night since.`,
    () => 'The peat-cutters found an old boat deep in the bog, its oars still in the locks.',
    () => 'An owl nested in the temple roof and would not be moved; the priests took it as a blessing.',
    (s) => `The bog road to ${s.name} was laid with oak planks, and folk stopped vanishing on it.`,
  ],
  tide: [
    () => 'A great storm broke the stilts of half the town; it was rebuilt higher, on mangrove posts.',
    (s) => `A pearl as big as a hen's egg was brought up off ${s.name}, and bought a year of plenty.`,
    () => 'The turtles did not come to the beaches one year, and the old folk said it was a bad omen; the next year the fever came.',
    () => 'A raft tried to sail out through the storm wall. Only its mast came back, three days later.',
    (s) => `The canoe race round the reef was first rowed by the young folk of ${s.name}; it is rowed every year since.`,
    () => 'A whale shark lingered in the lagoon a whole season, and the children rode on its back.',
    () => 'The stilt-houses were joined by rope bridges, and folk stopped wading to visit their neighbours.',
    (s) => `A diver of ${s.name} stayed under for as long as it takes to sing three songs, and came up with a pearl in each hand.`,
  ],
};
// (Round 68) The far lands' peoples' own (see world/farlands.js).
Object.assign(FOUNDERS, farTable('founders'));
Object.assign(STYLE_EPITHETS, farTable('epithets'));
Object.assign(STYLE_CAME, farTable('came'));
Object.assign(STYLE_BEASTS, farTable('haunts'));
Object.assign(STYLE_PLACES, farTable('places'));
Object.assign(STYLE_EVENTS, farTable('events'));
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

// A pick from `list`, each as likely as its weight.
function weighted(rng, list, w) {
  let sum = 0;
  for (const q of list) sum += Math.max(0, w(q) || 0);
  if (sum <= 0) return list[0];
  let r = rng.next() * sum;
  for (const q of list) {
    r -= Math.max(0, w(q) || 0);
    if (r <= 0) return q;
  }
  return list[list.length - 1];
}

// How old a town is (the first draw its history makes: lore.js reckons
// with the same one).
function drawAge(rng, s) {
  return s.type === 'city' ? rng.int(280, 520) : s.type === 'town' ? rng.int(110, 300) : rng.int(35, 150);
}
export function ageOf(s) {
  return drawAge(new RNG(hash4(s.seed >>> 0, 0x415f)), s);
}

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
    const age = drawAge(rng, s);
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
    // (Round 142) What's known of the town and those round it, for its
    // past to be made from (see pasts.js).
    const faith = religionOf(s);
    const cz = cuisineOf(s);
    const c = this.pastContext(L, rng, style, founder, founded, now, faith, cz);
    // How it began, and what came of that.
    const fd = weighted(rng, FOUNDINGS, (f) => f.w(c));
    c.founding = fd.k;
    entries.push({ y: founded, text: fd.text(c), kind: 'founded' });
    const later = (then, y0, abs = false) => {
      const [lo, hi, f] = then;
      const e = f(c);
      if (!e) return;
      const y = abs ? y0 + rng.int(lo, hi) : founded + Math.round(age * rng.float(lo, hi));
      if (y > y0 && y < now) entries.push({ y, ...e });
    };
    if (fd.then && rng.chance(0.75)) later(fd.then, founded);
    // How its luck has run.
    const fortune = weighted(rng, Object.keys(FORTUNES), (k) => ({ steady: 3, blessed: 2, troubled: 2, turbulent: 1.4 })[k]);
    const F = FORTUNES[fortune];
    const toneW = (tone) => (tone === 'good' ? F.good : tone === 'bad' ? F.bad : 1);
    const pool = [];
    const put = (w, tone, make) => pool.push({ w: w * toneW(tone), make });
    // The people's own troubles and glories, and its realm's.
    for (const f of rng.shuffle((STYLE_EVENTS[style] || []).slice()).slice(0, 3)) put(1.6, 'odd', () => ({ y: at(0.1, 0.95), text: f(s), kind: 'lore' }));
    for (const v of (s.civ ? s.civ.values || [] : []).slice(0, 2)) if (VALUE_EVENTS[v]) put(1.2, 'good', () => ({ y: at(0.5, 0.97), text: VALUE_EVENTS[v](s), kind: 'realm' }));
    if (s.biome === 'desert') put(1, 'bad', () => ({ y: at(0.1, 0.9), text: 'A year without rain: the date palms died, and were planted again.', kind: 'drought' }));
    if (s.biome === 'tundra' || s.biome === 'taiga') put(1, 'bad', () => ({ y: at(0.1, 0.9), text: 'Wolves came down out of the forest in the dead of winter, and the watch kept the fires lit for a month.', kind: 'winter' }));
    if (s.biome === 'swamp') put(1, 'bad', () => ({ y: at(0.1, 0.9), text: 'A fog lay on the fen for forty days, and boats that went out into it never came back.', kind: 'fog' }));
    if (s.coast) put(1, 'bad', () => ({ y: at(0.1, 0.9), text: 'A ship broke up on the rocks in a storm; the town took in the sailors, and some never left.', kind: 'wreck' }));
    if (s.type !== 'village') put(1, 'bad', () => ({ y: at(0.2, 0.6), text: `Most of ${s.name} burned in the Great Fire, and was built again ${s.type === 'city' ? 'in stone' : 'by the next summer'}.`, kind: 'fire' }));
    if (s.river || s.lake || s.coast) {
      put(1, 'bad', () => ({
        y: at(0.1, 0.8), text: `The ${s.coast ? 'sea came over the harbour wall' : s.river ? 'river burst its banks' : 'lake rose'} and took the old mill and half the fields.`, kind: 'flood',
        then: [2, 15, () => ({ text: `A dyke was raised along the ${c.water} at ${s.name}, and it has held ever since.`, kind: 'build' })],
      }));
    }
    put(1, 'bad', () => ({ y: at(0.3, 0.9), text: 'The coughing sickness took one in five. The graveyard was doubled that year.', kind: 'plague', then: [1, 8, () => ({ text: `${c.person()} gave their house in ${s.name} to be a hospice for the sick, and it is one still.`, kind: 'good' })] }));
    if (s.type === 'city' || L.walled) put(1, 'bad', () => ({ y: at(0.4, 0.9), text: `${s.name} held out through a long siege, and the walls were raised higher after.`, kind: 'siege' }));
    if (fd.k !== 'shrine') put(1, 'good', () => ({ y: at(0.05, 0.5), text: `The temple of ${faith.god} was raised on the hill.`, kind: 'temple' }));
    put(1, 'bad', () => ({ y: at(0.2, 0.95), text: 'A hungry winter: the snow lay till spring, and the town ate its seed corn.', kind: 'famine', then: [1, 6, () => ({ text: `A great granary was built in ${s.name}, so the town would never eat its seed corn again.`, kind: 'build' })] }));
    put(0.8, 'odd', () => ({ y: at(0.1, 0.9), text: `A star with a burning tail hung over ${s.name} for nine nights.`, kind: 'omen' }));
    if (s.civ) put(1.4, 'odd', () => ({ y: at(0.6, 0.98), text: `${s.name} swore itself to the ${s.civ.name.replace(/^The /, '')}.`, kind: 'realm' }));
    // What may befall any town (see pasts.js).
    for (const ev of TOWN_EVENTS) {
      if (ev.when && !ev.when(c)) continue;
      put(0.75, ev.tone, () => ({ y: ev.year ? ev.year(c) : at(ev.at[0], ev.at[1]), text: ev.text(c), kind: ev.kind, then: ev.then, abs: ev.abs, id: ev.id }));
    }
    // (A town founded from this one later on: told when it was.)
    const n = Math.max(2, (s.type === 'city' ? 6 : s.type === 'town' ? 4 : 3) + rng.int(0, 2) + F.more);
    const ids = [];
    for (let i = 0; i < n && pool.length; i++) {
      const q = weighted(rng, pool, (o) => o.w);
      pool.splice(pool.indexOf(q), 1);
      const e = q.make();
      if (e.id === 'daughter') e.y = c.younger.y - rng.int(1, 3);
      if (!(e.y > founded && e.y < now)) continue;
      const { then, abs, id, ...it } = e;
      entries.push(it);
      if (id) ids.push(id);
      if (then && rng.chance(0.7)) later(then, it.y, abs !== false);
    }
    // A run of good years, or of bad ones, that the town still speaks of.
    if (F.era && age >= 60 && rng.chance(0.7)) {
      const y1 = at(0.3, 0.75);
      const y2 = Math.min(now - 1, y1 + rng.int(12, 40));
      const what = fortune === 'blessed'
        ? rng.pick(['full barns, fat markets and no war', 'a good harvest every year and a healthy child in every cradle', 'the town doubled in size, and every house had glass in its windows'])
        : rng.pick(['one bad harvest after another, and every other house shut up', 'fever, flood and debt, and the young folk leaving', 'the roads were unsafe and the markets empty']);
      entries.push({ y: y1, text: `The years from ${y1} to ${y2} are remembered in ${s.name} as the ${F.era}: ${what}.`, kind: fortune === 'blessed' ? 'good' : 'bad' });
    }
    // The old places near it: what happened there, and when.
    for (const d of this.sim.dungeons ? this.sim.dungeons.forTown(s.id) : []) entries.push({ y: d.origin.y, text: d.origin.short.replace(/^\w/, (ch) => ch.toUpperCase()), kind: 'dungeon' });
    entries.sort((a, b) => a.y - b.y);
    // Known for (and now and then for what happened there).
    const known = [];
    if (s.nearMountain) known.push('its iron', 'its miners');
    if (s.coast || s.river || s.lake) known.push('its fish', 'its boatmen');
    if (['forest', 'taiga', 'jungle'].includes(s.biome)) known.push('its timber');
    if (['plains', 'savanna'].includes(s.biome)) known.push('its horses');
    if (L.fields && L.fields.length) known.push('its harvest fairs');
    known.push(`its ${cz.word.split(' and ')[0]}`);
    if (!(/ale|mead|beer/.test(cz.drink) && faith.taboos.includes('no_drink'))) known.push(`its ${cz.drink}`);
    for (const id of ids) if (FAME_BY_EVENT[id]) known.push(FAME_BY_EVENT[id]);
    const famous = rng.pick(known);
    const legend = rng.pick([
      `${founder}'s ghost walks ${rng.pick(c.places)} on ${faith.holyName} nights.`,
      `${rng.pick(c.beasts)} lives out past ${rng.pick(c.places)}. Folk who go looking don't come back the same.`,
      `There's gold buried under ${rng.pick(c.places)}, from before the town was even here.`,
      `the old statue on the square weeps on the day ${founder} died.`,
      `${founder} never died at all, and sleeps under the hill till ${s.name} needs them again.`,
      `${faith.god} once walked through ${s.name} in the shape of ${faith.beast}, and blessed the house that fed them.`,
      `whoever drinks from ${rng.pick(c.places)} at midnight on ${faith.feast} sees their true love's face.`,
      ...LEGENDS.map((f) => f(c)),
    ]);
    return { founded, founder, famous, legend, entries, fortune, began: fd.k, scanned: 0 };
  }

  // (Round 142) What a town's past is made from: its people's names, its
  // neighbours, its land and its faith (see pasts.js).
  pastContext(L, rng, style, founder, founded, now, faith, cz) {
    const s = L.settlement;
    const ow = this.game.world.ow;
    const near = (ow.settlements || [])
      .filter((o) => o !== s && !o.haven && !o.deserted && (o.island || 'thessa') === (s.island || 'thessa'))
      .map((o) => ({ o, d: Math.hypot(o.cx - s.cx, o.cz - s.cz) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((q) => q.o);
    // (A neighbour founded later than this town, by folk from it.)
    let younger = null;
    for (const o of near) {
      const y = o.founding ? yearOf(o.founding.day) : now - ageOf(o);
      if (y > founded + 10 && y < now - 2 && (!younger || y < younger.y)) younger = { name: o.name, y };
    }
    const nm = namer(rng, style);
    const places = rng.chance(0.7) ? STYLE_PLACES[style] || PLACES : PLACES;
    const beasts = rng.chance(0.7) ? STYLE_BEASTS[style] || BEASTS : BEASTS;
    return {
      s, L, rng, style, founder, founded, now, faith, god: faith.god,
      civ: s.civ || null, civName: s.civ ? s.civ.name.replace(/^The /, '') : '',
      values: s.civ ? s.civ.values || [] : [],
      came: rng.pick(rng.chance(0.7) ? STYLE_CAME[style] || CAME : CAME),
      near: near[0] || null, younger,
      ore: style === 'high' ? rng.pick(['silver', 'iron', 'silver', 'gold']) : rng.pick(['iron', 'copper', 'tin', 'silver']),
      water: s.coast ? 'sea' : s.lake ? 'lake' : 'river',
      drink: cz.drink, crop: cropOf(s.biome),
      places, beasts, place: rng.pick(places), beast: rng.pick(beasts),
      oldName: `${founder.split(' ')[0]}'s ${rng.pick(['Stead', 'Ford', 'Hold', 'Well', 'Cross', 'Landing', 'Rest'])}`,
      person: nm.person, family: nm.family,
    };
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
