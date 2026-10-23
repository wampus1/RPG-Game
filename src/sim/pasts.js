// (Round 142) More to a town's past than a fire and a fever: how it came
// to be (a fort, a miners' camp, a ferry with an inn, a shrine, a market
// at a crossroads, a boat that never put to sea again), the run of luck it
// has had (blessed, troubled, turbulent, or just steady), the folk whose
// names are still spoken there (a guild's founder, the headman who ran off
// with the town chest, a child of the town who went far), the neighbours
// it fell out with or sent its young folk off to found, and what came of
// what happened (a fire, and the town rebuilt in stone; a feud, and the
// wedding that ended it). See History.generate.
import { personName } from '../world/names.js';

// How a town began. `when`: whether it could have (`c`: see History.past);
// `w`: how likely; `text`: the founding, as it's told; `then`: what came
// of it later on (or nothing), [lo, hi] of the town's age after.
export const FOUNDINGS = [
  {
    k: 'families', w: () => 3,
    text: (c) => `${c.s.name} was founded by ${c.founder}, who came ${c.came} with ${c.rng.int(3, 12)} families.`,
  },
  {
    k: 'fort', w: (c) => (c.L.walled || c.s.type === 'city' ? 2.5 : 0) + (c.values.includes('martial') ? 1.5 : 0),
    text: (c) => `${c.s.name} began as a fort, raised by ${c.founder} to watch ${c.rng.pick(['the border', 'the old road', ...(c.s.nearMountain ? ['the pass'] : []), ...(c.s.river ? ['the river crossing'] : []), ...(c.s.coast ? ['the coast'] : [])])}; the town grew up in the shadow of its walls.`,
    then: [0.3, 0.8, (c) => ({ text: `The old fort of ${c.s.name} was pulled down, and its stones went into the houses round the square.`, kind: 'build' })],
  },
  {
    k: 'mine', w: (c) => (c.s.nearMountain ? 3 : 0),
    text: (c) => `${c.s.name} began as a miners' camp, after ${c.founder} struck ${c.ore} in the hills above it.`,
    then: [0.4, 0.9, (c) => ({ text: `The ${c.ore} seam under ${c.s.name} ran out at last; the miners turned to ${c.rng.pick(['quarrying', 'the fields', 'their goats', 'smithing'])}, and the town carried on.`, kind: 'mine' })],
  },
  {
    k: 'ferry', w: (c) => (c.s.river ? 3 : 0),
    text: (c) => `${c.founder} kept a ferry across the river here, and an inn for those waiting on it; ${c.s.name} grew up round the inn.`,
    then: [0.3, 0.8, (c) => ({ text: `A bridge was built where the ferry used to cross, and ${c.person()} kept its toll for forty years.`, kind: 'build' })],
  },
  {
    k: 'harbour', w: (c) => (c.s.coast ? 3 : 0),
    text: (c) => `${c.founder} beached a boat in the cove and never put to sea again; the fishing families who followed built ${c.s.name}.`,
    then: [0.2, 0.7, (c) => ({ text: `The harbour wall of ${c.s.name} was built, stone by stone, by every family in turn.`, kind: 'build' })],
  },
  {
    k: 'market', w: (c) => (c.values.includes('mercantile') ? 2.5 : 0) + (c.s.type !== 'village' ? 1 : 0),
    text: (c) => `${c.s.name} began as a market at a crossroads, where ${c.founder} set out the first stall.`,
    then: [0.2, 0.6, (c) => ({ text: `The market of ${c.s.name} was given its charter, and its fair-days were fixed for ever after.`, kind: 'trade' })],
  },
  {
    k: 'shrine', w: (c) => (c.values.includes('pious') ? 2.5 : 0.6),
    text: (c) => `${c.s.name} grew up round a shrine to ${c.god}, kept by ${c.founder}, who saw ${c.faith.beast} there in a dream.`,
    then: [0.2, 0.7, (c) => ({ text: `The old shrine of ${c.s.name} was rebuilt as a temple, and the pilgrims came in greater numbers.`, kind: 'temple' })],
  },
  {
    k: 'refuge', w: () => 0.8,
    text: (c) => `${c.s.name} was founded by ${c.founder} and those who fled with them from ${c.rng.pick(['a burned town to the north', 'a flood that drowned their villages', 'a lord who taxed them to the bone', 'a war that was none of theirs', 'a sickness in the old town'])}.`,
  },
  {
    k: 'camp', w: (c) => (['forest', 'taiga', 'jungle', 'bamboo_grove', 'rimewood'].includes(c.s.biome) ? 2.5 : 0),
    text: (c) => `${c.s.name} began as a woodcutters' camp; ${c.founder} felled the first tree and built the first hut from it.`,
    then: [0.2, 0.6, (c) => ({ text: `The forest round ${c.s.name} was cleared back a mile, and fields were sown where it had stood.`, kind: 'growth' })],
  },
  {
    k: 'herders', w: (c) => (['plains', 'savanna', 'tundra', 'moor', 'olive_hills'].includes(c.s.biome) ? 2 : 0),
    text: (c) => `${c.founder} brought ${c.rng.pick(['a flock of sheep', 'a herd of cattle', 'their goats', 'a string of horses'])} to graze here one summer, and never went home; ${c.s.name} grew up round the fold.`,
  },
  {
    k: 'exiles', w: () => 0.7,
    text: (c) => `${c.s.name} was founded by ${c.founder}, cast out of ${c.near ? c.near.name : 'their old home'} for ${c.rng.pick(['speaking against its headman', 'marrying beneath them', 'a debt they would not pay', 'an old feud', 'keeping the old gods'])}.`,
    then: [0.4, 0.9, (c) => (c.near ? { text: `${c.s.name} and ${c.near.name} made up their old quarrel at last, over a barrel of ${c.drink} on the road between them.`, kind: 'good' } : null)],
  },
];

// How a town's luck has run: the weight of good and bad, and how many
// things there are to tell.
export const FORTUNES = {
  steady: { good: 1, bad: 1, more: -1 },
  blessed: { good: 2.2, bad: 0.5, more: 0, era: 'Golden Years' },
  troubled: { good: 0.5, bad: 2.2, more: 0, era: 'Hard Years' },
  turbulent: { good: 1, bad: 1.6, more: 2 },
};

const TRADES = ['weavers\'', 'smiths\'', 'coopers\'', 'tanners\'', 'masons\'', 'brewers\'', 'carpenters\'', 'dyers\''];
const MAKERS = [['miller', 'mill-wheel'], ['smith', 'bellows'], ['potter', 'kiln'], ['weaver', 'loom'], ['carpenter', 'crane'], ['tanner', 'tanning vat']];
const QUARRELS = ['a boundary stone', 'a stolen pig', 'a broken betrothal', 'a dead man\'s will', 'the best pew in the temple', 'a dog that bit a child', 'water rights on the brook'];
const FAR_FAMES = ['a general of the realm', 'a poet sung in every hall', 'the realm\'s treasurer', 'a famous healer', 'a sea captain who found new lands', 'a judge known for hard but fair sentences', 'a master builder of temples'];
const ORDEALS = ['souring the milk', 'cursing a neighbour\'s cow', 'calling up the fog', 'talking to crows'];

// What may have happened to a town (beyond its people's own: see
// STYLE_EVENTS in history.js). `tone`: good, bad or odd (an odd thing is
// neither); `when`, if it couldn't happen anywhere; `at`: when in its
// life [lo, hi]; `then`: what came of it later.
export const TOWN_EVENTS = [
  // Good things.
  { id: 'bridge', tone: 'good', kind: 'build', at: [0.2, 0.9], when: (c) => c.s.river && c.founding !== 'ferry', text: (c) => `A stone bridge was raised over the river at ${c.s.name}, and ${c.person()} was made its first toll-keeper.` },
  { id: 'walls', tone: 'good', kind: 'build', at: [0.2, 0.7], when: (c) => c.L.walled && c.founding !== 'fort', text: (c) => `${c.s.name} built its first walls, after ${c.rng.pick(['bandits', 'raiders', 'wolves', 'the realm\'s enemies'])} came once too often.` },
  { id: 'guild', tone: 'good', kind: 'trade', at: [0.3, 0.95], when: (c) => c.s.type !== 'village', text: (c) => `The ${c.rng.pick(TRADES)} guild of ${c.s.name} was founded by ${c.person()}.` },
  { id: 'fair', tone: 'good', kind: 'festival', at: [0.1, 0.8], text: (c) => `The first ${c.s.name} Fair was held on the green; it has been held every year since, bar ${c.rng.int(2, 5)} years of ${c.rng.pick(['war', 'fever', 'flood'])}.` },
  { id: 'school', tone: 'good', kind: 'good', at: [0.3, 0.95], when: (c) => !c.values.includes('scholarly'), text: (c) => `${c.person()} opened a school in the back room of the inn, and taught half of ${c.s.name} its letters.` },
  { id: 'bell', tone: 'good', kind: 'build', at: [0.2, 0.95], text: (c) => `A great bell was cast for ${c.s.name}, and hung in the ${c.rng.pick(['temple', 'hall', 'gate'])} tower; they say it can be heard ${c.near ? `in ${c.near.name}` : 'three valleys off'}.` },
  { id: 'road', tone: 'good', kind: 'trade', at: [0.3, 0.95], when: (c) => !!c.near, text: (c) => `The road from ${c.s.name} to ${c.near.name} was paved, and the carters stopped cursing it.` },
  { id: 'harvest', tone: 'good', kind: 'good', at: [0.1, 0.95], text: (c) => `The best harvest anyone could remember: ${c.s.name} sold its grain ${c.near ? `to ${c.near.name}` : 'down the road'} at its own price.` },
  { id: 'visit', tone: 'good', kind: 'realm', at: [0.6, 0.98], when: (c) => !!c.civ, text: (c) => `The ruler of the ${c.civName} stayed a night in ${c.s.name} on the way to war, and slept in ${c.person()}'s best bed.` },
  { id: 'invention', tone: 'good', kind: 'good', at: [0.3, 0.95], text: (c) => { const [who, what] = c.rng.pick(MAKERS); return `${c.person()}, a ${who} of ${c.s.name}, built a ${what} that did the work of ten; it was copied the length of the land.`; } },
  { id: 'well', tone: 'good', kind: 'build', at: [0.05, 0.6], text: (c) => `A new well was dug in the square of ${c.s.name}, and its water was the sweetest for miles.` },
  { id: 'rights', tone: 'good', kind: 'realm', at: [0.4, 0.95], when: (c) => !!c.civ && c.s.type !== 'village', text: (c) => `${c.s.name} was granted the right to hold its own court, and tried its first thief the same week.` },
  { id: 'books', tone: 'good', kind: 'good', at: [0.3, 0.95], text: (c) => `A travelling scholar left ${c.rng.int(9, 40)} books in ${c.s.name}, and the town kept them in a locked chest in the hall.` },
  { id: 'planted', tone: 'good', kind: 'growth', at: [0.1, 0.8], text: (c) => `The first ${c.crop} were planted on the slopes above ${c.s.name} by ${c.person()}.` },
  { id: 'daughter', tone: 'good', kind: 'growth', at: [0, 1], when: (c) => !!c.younger, text: (c) => `Folk of ${c.s.name} went off with their carts to found ${c.younger.name}.` },
  { id: 'festival', tone: 'good', kind: 'festival', at: [0.2, 0.9], text: (c) => `The first ${c.rng.pick(['Lantern', 'Bonfire', 'Boat', 'Mask', 'Ribbon', 'Candle'])} Night was kept in ${c.s.name}, in memory of ${c.rng.pick(['the founders', 'the drowned', 'a winter survived', 'a child found alive', 'a siege lifted'])}.` },
  { id: 'catch', tone: 'good', kind: 'good', at: [0.1, 0.95], when: (c) => c.s.coast || c.s.lake || c.s.river, text: (c) => `A fish as long as a boat was taken from the ${c.water}; its jaw still hangs over the inn door.` },
  { id: 'trade', tone: 'good', kind: 'trade', at: [0.2, 0.9], when: (c) => c.s.type !== 'village' || c.values.includes('mercantile'), text: (c) => `${c.rng.pick(['Salt', 'Wool', 'Spice', 'Timber', 'Copper'])} traders made ${c.s.name} their stopping-place, and the town grew fat on the road.` },
  { id: 'famous', tone: 'good', kind: 'people', at: [0.4, 0.97], text: (c) => `${c.person()}, born in ${c.s.name}, became ${c.rng.pick(FAR_FAMES)}; the town claims them still.` },
  { id: 'healer', tone: 'good', kind: 'good', at: [0.2, 0.95], text: (c) => `A healer, ${c.person()}, stopped a fever at the gates of ${c.s.name} by burning the bedding of the sick; not one more died of it.` },
  { id: 'wedding', tone: 'good', kind: 'feud', at: [0.2, 0.95], text: (c) => `${c.person()} and ${c.person()} were married, and the feast went on for nine days; their two families had been at odds for forty years.` },
  // Bad things.
  { id: 'feud', tone: 'bad', kind: 'feud', at: [0.1, 0.7], text: (c) => { const [a, b] = [c.family(), c.family()]; c.feud = [a, b]; return `The ${a} family and the ${b} family fell out over ${c.rng.pick(QUARRELS)}; ${c.s.name} was split down the middle for a generation.`; }, then: [3, 30, (c) => (c.feud ? { text: `The feud between the ${c.feud[0]}s and the ${c.feud[1]}s ended ${c.rng.pick(['with a wedding', 'when the last of the old quarrellers died', 'with a duel at dawn that nobody won', 'when the temple made them swear a peace'])}.`, kind: 'feud' } : null)], abs: true },
  { id: 'scandal', tone: 'bad', kind: 'scandal', at: [0.3, 0.95], text: (c) => `The headman of ${c.s.name}, ${c.person()}, fled in the night with the town chest, and was never seen again.` },
  { id: 'riot', tone: 'bad', kind: 'bad', at: [0.3, 0.95], when: (c) => c.s.type !== 'village', text: (c) => `Bread went to ${c.rng.int(3, 9)} pennies a loaf, and the folk of ${c.s.name} broke open the granary.` },
  { id: 'hail', tone: 'bad', kind: 'bad', at: [0.1, 0.95], text: () => 'A hailstorm flattened the crops in an hour; the stones were as big as hen\'s eggs.' },
  { id: 'locusts', tone: 'bad', kind: 'bad', at: [0.1, 0.95], when: (c) => ['desert', 'savanna', 'plains', 'red_mesa', 'salt_flats', 'olive_hills'].includes(c.s.biome), text: (c) => `Locusts came over ${c.s.name} like a cloud, and ate the fields to the root.` },
  { id: 'quake', tone: 'bad', kind: 'quake', at: [0.1, 0.95], when: (c) => c.s.nearMountain || c.style === 'ember' || c.style === 'high', text: (c) => `The ground shook under ${c.s.name}, and the ${c.rng.pick(['temple', 'hall', 'gate'])} tower cracked from top to bottom; the crack is there still.` },
  { id: 'bandits', tone: 'bad', kind: 'bad', at: [0.2, 0.95], text: (c) => `Bandits held the road to ${c.s.name} for a whole summer, until ${c.person()} led the townsfolk out against them.` },
  { id: 'accused', tone: 'odd', kind: 'lore', at: [0.2, 0.9], text: (c) => `${c.person()} was accused of ${c.rng.pick(ORDEALS)} and driven out of ${c.s.name}. ${c.rng.pick(['The trouble went on just the same.', 'Things got no better.', 'Some say it was all a neighbour\'s spite.'])}` },
  { id: 'murrain', tone: 'bad', kind: 'bad', at: [0.1, 0.95], text: (c) => `A murrain took the cattle of ${c.s.name}; the town lived on ${c.s.coast || c.s.river || c.s.lake ? 'fish' : 'turnips'} and porridge for a year.` },
  { id: 'sinkhole', tone: 'odd', kind: 'lore', at: [0.1, 0.95], text: (c) => `A hole opened up overnight in ${c.rng.pick(['the square', 'a barley field', 'the road'])} of ${c.s.name}, and swallowed ${c.rng.pick(['a hay cart', 'the smithy\'s woodpile', 'a well', 'two pigs'])}.` },
  { id: 'beast', tone: 'bad', kind: 'beast', at: [0.05, 0.95], text: (c) => `${cap(c.beast)} was seen at ${c.place}, and nobody in ${c.s.name} went out after dark for a month.`, then: [1, 6, (c) => ({ text: `${c.person()} went out against ${c.beast.replace(/^an? /, 'the ')}, and came back with a tale nobody quite believed.`, kind: 'beast' })], abs: true },
  { id: 'exodus', tone: 'bad', kind: 'bad', at: [0.3, 0.95], text: (c) => `Half the young folk of ${c.s.name} went off ${c.rng.pick(['to the cities', 'over the sea', 'to the wars', 'after a rumour of gold'])} in a single spring, and the town was quiet for a generation.` },
  { id: 'market-fire', tone: 'bad', kind: 'fire', at: [0.2, 0.95], when: (c) => c.s.type !== 'village', text: (c) => `The market of ${c.s.name} burned in a single night; the guilds had it rebuilt within the year.` },
  { id: 'ice', tone: 'bad', kind: 'winter', at: [0.1, 0.95], when: (c) => (c.s.river || c.s.lake) && ['tundra', 'taiga', 'rimewood', 'mountain', 'plains', 'forest', 'moor'].includes(c.s.biome), text: (c) => `The ${c.water} froze, and ${c.rng.int(2, 6)} skaters went through the ice on the feast of ${c.faith.feast}.` },
  { id: 'steward', tone: 'bad', kind: 'realm', at: [0.5, 0.97], when: (c) => !!c.civ, text: (c) => `A hard steward, ${c.person()}, taxed ${c.s.name} until its folk sent a petition to the throne; the steward was called home in disgrace.` },
  { id: 'cut-off', tone: 'bad', kind: 'bad', at: [0.1, 0.95], text: (c) => `The road out of ${c.s.name} was washed away, and for ${c.rng.int(2, 7)} months nothing came in or went out but by mule.` },
  // Odd things.
  { id: 'calf', tone: 'odd', kind: 'omen', at: [0.1, 0.95], text: (c) => `A calf was born in ${c.s.name} with two heads. The priests of ${c.god} said it foretold ${c.rng.pick(['a good harvest', 'a war', 'a hard winter', 'a wedding in the ruling house'])}, and so it came to pass.` },
  { id: 'eclipse', tone: 'odd', kind: 'omen', at: [0.05, 0.95], text: (c) => `The sun went dark at noon over ${c.s.name}; folk hid in the temple of ${c.god} until it came back.` },
  { id: 'stranger', tone: 'odd', kind: 'lore', at: [0.1, 0.95], text: (c) => `A stranger came to ${c.s.name} who spoke no tongue anyone knew, stayed the winter, and left behind a carved ${c.rng.pick(['box', 'stone', 'staff', 'mask'])} that still sits in the hall.` },
  { id: 'renamed', tone: 'odd', kind: 'name', at: [0.15, 0.7], text: (c) => `Until that year the town was called ${c.oldName}; it was renamed ${c.s.name} ${c.rng.pick(['when the realm took it in', 'after a quarrel over the old name', 'for the river that runs by it', 'by a vote of the elders, after much shouting'])}.` },
];

// The old stories (on top of those in history.js).
export const LEGENDS = [
  (c) => `${c.founder} buried something under the ${c.rng.pick(['hearth of the inn', 'temple step', 'old oak', 'first house'])}, and made their children swear never to dig it up.`,
  (c) => `on still nights you can hear ${c.rng.pick(['bells', 'singing', 'a hammer on an anvil', 'hoofbeats'])} from ${c.place}, though nothing is there.`,
  (c) => `the first stone of ${c.s.name} was carried from ${c.rng.pick(['the sea', 'a fallen star', 'the old kingdom', 'a giant\'s grave'])}, and while it stands the town will too.`,
  (c) => `${c.beast} and ${c.founder} made a bargain, and the town keeps its half of it every ${c.faith.feast}.`,
  (c) => `there's a door at ${c.place} that opens only for the seventh child of a seventh child.`,
  (c) => `a child of ${c.s.name} was carried off by ${c.beast}, and came home seven years later not a day older.`,
  (c) => `the river once ran the other way round ${c.s.name}, until ${c.founder} turned it with a single spade.`,
  (c) => `${c.god} took the shape of a beggar at ${c.place}, and the house that turned them away burned the same night.`,
];

// What a town may be known for, from what happened there.
export const FAME_BY_EVENT = {
  bridge: 'its old bridge', fair: 'its fair', bell: 'its great bell', guild: 'its guildsmen', feud: 'its feuds', festival: 'its lantern nights',
  catch: 'its fishermen\'s tall tales', books: 'its learning', invention: 'its clever hands', wedding: 'its weddings', trade: 'its traders',
  planted: 'its orchards', healer: 'its healers', well: 'its sweet water', walls: 'its walls', famous: 'its famous children', renamed: 'its stubborn folk',
};

// The crops a town plants, by its land.
export function cropOf(biome) {
  if (['olive_hills', 'savanna', 'desert', 'red_mesa'].includes(biome)) return 'olive trees';
  if (['jungle', 'mangrove', 'bamboo_grove'].includes(biome)) return 'cacao trees';
  if (['tundra', 'taiga', 'rimewood'].includes(biome)) return 'hardy rye';
  if (['mountain', 'moor'].includes(biome)) return 'hops';
  if (['plains', 'forest'].includes(biome)) return 'apple trees';
  return 'vines';
}

const cap = (t) => t.replace(/^\w/, (ch) => ch.toUpperCase());

// Someone of the town, named (a first name and a family name).
export function namer(rng, style) {
  const used = new Set();
  return {
    person() {
      for (let i = 0; i < 6; i++) {
        const n = personName(rng, style);
        const full = `${n.first} ${n.last}`;
        if (!used.has(full)) {
          used.add(full);
          return full;
        }
      }
      const n = personName(rng, style);
      return `${n.first} ${n.last}`;
    },
    family() {
      for (let i = 0; i < 6; i++) {
        const n = personName(rng, style).last;
        if (!used.has(n)) {
          used.add(n);
          return n;
        }
      }
      return personName(rng, style).last;
    },
  };
}
