// What a realm knows. Every realm (and every free town on its own) works
// its way out along four branches of learning: Economy, Warfare, Law &
// Society and Engineering. Each starts from a root and splits into lines;
// some steps are choices (learn one and its rivals are barred for good, so
// no two realms end up knowing quite the same things), and a few are great
// works: trade ships, siege engines, prison labour, portals. The ruler (a
// free town's mayor) chooses what the scholars study next, after their own
// leanings and the realm's troubles; researchers at an academy (scholars at
// the library, before there is one) do the work a little at a time, every
// day. Each town's share of that work is remembered: a town that changes
// banner takes it along to its new realm.
import { alive, ledger, stockOf } from './econ.js';
import { retrain } from '../entities/npcgen.js';
import { breachFor } from './growth.js';
import { RNG, hash4 } from '../util/rng.js';
import { ITEMS } from '../world/items.js';
import { B, META_STATE } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND, SURFACE } from '../config.js';
import { tradeWeekly } from './isletrades.js';

export const BRANCHES = [
  { id: 'economy', name: 'Economy', color: '#e8c060' },
  { id: 'warfare', name: 'Warfare', color: '#e86a5a' },
  { id: 'society', name: 'Law & Society', color: '#8ab8e8' },
  { id: 'engineering', name: 'Engineering', color: '#9ad08a' },
];

// What each step costs, in study (a researcher at an academy puts in about
// 4 a day): the first steps take days, the great works months.
const COST = [0, 80, 140, 220, 320, 450, 600];

// A step: its branch; how far out (`tier`: what it costs) and to which side
// of the branch's line it sits (-2 to 2); what must be known first (`req`:
// all of it, where a list inside it means any one of those); the item drawn
// for it; its name; and exactly what it does. Options: `also` (needed too,
// from another branch: not drawn on the tree), `excl` (a choice: learning
// one step of the group bars the others for good), `big` (a great work).
// `isles`: only the peoples of those of the Dagoni Islands can learn it
// (each island's tree is laid out its own way: see ISLE_TREES). `as`: an
// island's own form of a common step, that does all it does (and counts
// as knowing it).
const T = (branch, tier, side, req, icon, name, desc, o = {}) => ({
  branch, tier, side, req, icon, name, desc, also: o.also || [], excl: o.excl || null, big: !!o.big, cost: COST[tier], isles: o.isles || null, as: o.as || [],
});
export const TECHS = {
  // Economy
  bookkeeping: T('economy', 1, 0, [], 'ledger', 'Bookkeeping', 'Taxes bring in 20% more in every town.'),
  guilds: T('economy', 2, -1, ['bookkeeping'], 'hanging_sign', 'Guild Charters', 'Merchants can rise to master (gems, gold and fine goods), and master merchants visit from abroad. Shops hang out guild awnings.'),
  markets: T('economy', 2, 1, ['bookkeeping'], 'apple', 'Market Days', 'Travelling merchants come to town 80% more often.'),
  gemcraft: T('economy', 3, -1, ['guilds'], 'gem', 'Gemcraft', 'Jewellers can be licensed: they cut gems and set them in weapons and armour.'),
  free_trade: T('economy', 3, 0.5, ['markets'], 'cloth', 'Free Trade', 'No tariffs, ever: travelling merchants come 40% more often, and trade with other realms warms relations 50% faster.', { excl: 'tolls' }),
  customs: T('economy', 3, 1.5, ['markets'], 'crate', 'Customs Houses', 'Every merchant from another realm pays ¤6 into the treasury of each town they trade in.', { excl: 'tolls' }),
  banking: T('economy', 4, -1.5, ['gemcraft'], 'gold_ingot', 'Banking', 'Every town\'s treasury earns 5% interest a week (up to ¤120).', { excl: 'coffers' }),
  monopolies: T('economy', 4, -0.5, ['gemcraft'], 'chest', 'Guild Monopolies', 'Shops and workshops earn 25% more; everything you buy in the realm costs 10% more.', { excl: 'coffers' }),
  caravan_law: T('economy', 4, 1, [['free_trade', 'customs']], 'lantern', 'Caravan Law', 'Merchants travel 20% faster, and are harried abroad 60% less often.'),
  mint: T('economy', 5, -1, [['banking', 'monopolies']], 'coin', 'Royal Mint', 'Each week the capital mints ¤25 for every town in the realm (up to ¤250).'),
  trade_ships: T('economy', 5, 1, ['caravan_law'], 'raft', 'Trade Ships', 'Towns by a river or the sea build a harbour and a great ship. Up to five merchants sail together to ports abroad, three times as fast as by road, carrying three times the goods: ¤60 to ¤200 for the town each voyage.', { big: true }),
  trade_league: T('economy', 6, 0, [['banking', 'monopolies'], 'caravan_law'], 'scroll', 'Trade League', 'Trade warms relations 50% faster; tariffs sour them half as much.'),
  // Warfare
  drill: T('warfare', 1, 0, [], 'iron_sword', 'Drilled Watch', 'Guards get +6 health and 20% more strength in battle; they wear helmets once it settles in.'),
  archery: T('warfare', 2, -1, ['drill'], 'bow', 'Archery', 'Every guard carries a bow and 12 arrows; armies are 8% stronger. Archery butts go up by the guardhouse.'),
  muster: T('warfare', 2, 1, ['drill'], 'spear', 'Muster Rolls', 'Levies for war are 50% larger.'),
  shieldwall: T('warfare', 3, -1.5, ['archery'], 'iron_shield', 'Shield Wall', 'Every guard carries a shield (no two-handed weapons); armies defending are 15% stronger, and so is the watch against raids.', { excl: 'arms' }),
  greatweapons: T('warfare', 3, -0.5, ['archery'], 'greatsword', 'Great Weapons', 'Guards fight two-handed (greatswords, battle axes, war hammers, halberds; iron needed); armies attacking are 15% stronger, and so are raiders.', { excl: 'arms' }),
  cavalry: T('warfare', 3, 0.5, ['muster'], 'saddle', 'Cavalry', 'The watch always rides out against raiders (+20% defence, 2 extra horses); armies are 10% stronger and can flank.'),
  fieldworks: T('warfare', 3, 1.5, ['muster'], 'iron_shovel', 'Field Fortifications', 'Armies can dig in behind log walls and stakes; a town under threat builds its walls for 55% of the cost (not 75%).'),
  longbows: T('warfare', 4, -1.5, [['shieldwall', 'greatweapons']], 'longbow', 'Longbowmen', 'Guards\' bows become longbows (range 11, damage 6); armies are 5% stronger.', { excl: 'bows' }),
  crossbows: T('warfare', 4, -0.5, [['shieldwall', 'greatweapons']], 'crossbow', 'Crossbowmen', 'Guards\' bows become crossbows with bolts (damage 9, slow to reload); armies are 5% stronger.', { excl: 'bows' }),
  steel: T('warfare', 4, 1, ['cavalry', 'fieldworks'], 'steel_sword', 'Steelworking', 'Smiths sell steel swords, and every guard\'s sword is steel; armies are 15% stronger.', { also: ['metalworking'] }),
  siegecraft: T('warfare', 5, 0.5, ['steel'], 'iron_pickaxe', 'Siegecraft', 'A decisive victory takes the town behind the field 25% more often, and a capital once the war is half won (not four-fifths).'),
  rams: T('warfare', 6, 0, ['siegecraft'], 'log_oak', 'Battering Rams', 'Armies bring a ram: a walled town gives its defenders nothing against capture (walls otherwise make it 40% less likely), and in battle the ram rolls up and knocks a breach in the wall.', { big: true }),
  catapults: T('warfare', 6, 1, ['siegecraft'], 'catapult', 'Catapults', 'Armies bring catapults that hurl stones into the enemy\'s ranks: the other side fights 12% weaker, and in battle you\'ll see the stones fall (8 damage where they land).', { big: true }),
  // Law & Society
  codex: T('society', 1, 0, [], 'book', 'Written Law', 'The ruler can set the size of the watch: one in ten grown folk in quiet times, one in four in war.'),
  alchemy: T('society', 2, -1, ['codex'], 'potion_vigor', 'Alchemy', 'Herbalists brew and sell potions (vigour, might, swiftness and more).'),
  prisons: T('society', 2, 1, ['codex'], 'iron_bars', 'Prisons', 'When the capital\'s cells are full it builds a great prison instead of a stockade; prisoners escape 70% less often.'),
  hospitality: T('society', 3, -1, ['alchemy'], 'bed', 'Hospitality', 'A night in a town bed gives you 2 blue hearts for the day; townsfolk wake with 2 extra health too.'),
  clemency: T('society', 3, 0.5, ['prisons'], 'prayer_beads', 'Clemency', 'Jail terms are halved (yours too), and unrest fades twice as fast.', { excl: 'justice' }),
  ironlaw: T('society', 3, 1.5, ['prisons'], 'guard_badge', 'Iron Law', 'Fines are 50% higher (yours too); townsfolk commit crimes 30% less often.', { excl: 'justice' }),
  schools: T('society', 4, -1.5, ['hospitality'], 'paper', 'Schools', 'All study goes 40% faster. Children go about with their books.', { excl: 'learning' }),
  apprenticeships: T('society', 4, -0.5, ['hospitality'], 'workbench', 'Apprenticeships', 'Shops and workshops earn 30% more.', { excl: 'learning' }),
  conscription: T('society', 4, 1.5, [['clemency', 'ironlaw']], 'iron_helmet', 'Conscription', 'In a losing war the ruler can draft elders into the watch, and in a desperate one children too.'),
  prison_labor: T('society', 5, 1, [['clemency', 'ironlaw']], 'stone_pickaxe', 'Prison Labour', 'By day, prisoners quarry stone and cut wood for the town (2 to 3 each a day), watched by whatever guards can be spared (one for every two prisoners; none when the watch is thin). Each day worked takes two days off a sentence; prisoners of war go home after 8 days\' work.', { big: true }),
  embassies: T('society', 6, 0, [['schools', 'apprenticeships'], 'conscription'], 'dispatch', 'Embassies', 'Alliances need 10 less goodwill, and the realm declares war half as often.'),
  // Engineering
  masonry: T('engineering', 1, -1, [], 'stone_bricks', 'Masonry', 'Buildings and walls go up 35% faster; in time the town paves its square in dressed stone.'),
  metalworking: T('engineering', 1, 1, [], 'anvil', 'Metalworking', 'Forges and blacksmiths can work; the watch carries iron instead of wood and stone.'),
  wells: T('engineering', 2, -1.5, ['masonry'], 'water_bucket', 'Clean Wells', 'A drink from a town well heals 4 and gives 3 blue hearts for the day (instead of healing 2).'),
  surveying: T('engineering', 2, -0.5, ['masonry'], 'iron_shovel', 'Surveying', 'Roads are built 50% faster; in time the town\'s lanes are gravelled and its streets cobbled.'),
  mining: T('engineering', 2, 1, ['metalworking'], 'mine_cart', 'Deep Mines', 'Miners dig 50% more stone and ore, and find gems twice as often.'),
  mills: T('engineering', 3, -1.5, ['wells'], 'wheat', 'Watermills', 'Farms yield 50% more grain; hay is stacked by the barns.'),
  cranes: T('engineering', 3, -0.5, ['surveying'], 'hammer', 'Cranes', 'Building goes 30% faster (on top of masonry).'),
  lodestones: T('engineering', 3, 1, ['mining'], 'iron_ore', 'Lodestones', 'Compasses: merchants, letters, settlers and armies travel between towns 15% faster.'),
  aqueducts: T('engineering', 4, -2, ['mills'], 'bucket', 'Aqueducts', '60% more children are born in every town, and in time a fountain plays on the square where its well stood (its water as good as a well\'s).', { excl: 'harvest' }),
  granaries: T('engineering', 4, -1, ['mills'], 'barrel', 'Granaries', 'A famine takes 6 hungry days to set in (not 4), and hunger stirs half the unrest.', { excl: 'harvest' }),
  fortress: T('engineering', 5, -0.75, ['cranes', ['aqueducts', 'granaries']], 'cobblestone', 'Fortification', 'Towers and gatehouses: a walled town adds +2 defence against raids (on top of its walls\' +1.5), and capture is a further 25% less likely.'),
  portals: T('engineering', 6, 1, ['lodestones'], 'portal', 'Portals', 'Each town of the realm raises a portal on its square. Step through to any other portal of the same realm; merchants and soldiers use them too. A town taken by another realm is cut off: its portal goes dark.', { big: true }),
  // --- the islands' own -------------------------------------------------
  // Thessa: the old island of roads and fields.
  royal_roads: T('economy', 2, 0, ['bookkeeping'], 'cobblestone', 'Royal Roads', 'Travelling merchants come to town 40% more often (on top of Market Days).', { isles: ['thessa'] }),
  crop_rotation: T('engineering', 2, 0.25, ['masonry'], 'wheat', 'Crop Rotation', 'Farmers bring in 30% more from the fields.', { isles: ['thessa'] }),
  horse_lords: T('warfare', 2, 0, ['drill'], 'saddle', 'Horse Lords', 'The watch rides out against raiders even with no horse in the stable (+20% defence), and the realm\'s raiders are 10% stronger.', { isles: ['thessa'] }),
  // Kharos: the Ashborn under the mountain.
  sulphur_trade: T('economy', 2, 0, ['bookkeeping'], 'sulfur', 'Sulphur Trade', 'Each week every town sells sulphur abroad: ¤12 to its treasury (¤20 for a port).', { isles: ['kharos'] }),
  obsidian_edge: T('warfare', 2, 0, ['drill'], 'obsidian_blade', 'Obsidian Edge', 'Smiths knap black glass: they sell obsidian blades (6 damage, quick), and every guard\'s sword is one; armies are 6% stronger.', { isles: ['kharos'] }),
  ash_masks: T('society', 2, 0, ['codex'], 'cloth', 'Ash Masks', 'When the mountain wakes, the realm\'s folk mask their faces and shelter in time: an eruption kills, burns and starves 60% less in its towns.', { isles: ['kharos'] }),
  // Myrrow: the Mirefolk and the Stiltfolk.
  outriggers: T('economy', 2, 0, ['bookkeeping'], 'raft', 'Outrigger Rafts', 'Rafts with outriggers: the realm\'s merchants and soldiers cross the sea to the other islands 40% faster, and its raids from the sea are 15% stronger.', { isles: ['myrrow'] }),
  fog_wardens: T('warfare', 2, 0, ['drill'], 'lantern', 'Fog Wardens', 'The watch knows the mist: the realm\'s towns defend 25% better against raids, and in time fog lanterns are hung at the crossings and along the edge of every town, burning all night.', { isles: ['myrrow'] }),
  spore_lore: T('society', 2, 0, ['codex'], 'glowcap', 'Spore Lore', 'Herbalists brew from the fungal woods: they sell potions even without Alchemy; sporewrights raise twice the glowcaps; townsfolk wake 2 health better every morning; and in time glowcaps are grown along the lanes, lighting them at night.', { isles: ['myrrow'] }),
  // (And more of each island's own, in the places of the common steps it
  // never learns.)
  horse_archers: T('warfare', 4, -0.5, [['shieldwall', 'greatweapons']], 'bow', 'Horse Archers', 'Guards\' bows become longbows (range 11, damage 6), and the watch rides out against raiders even with no horse in the stable (+20% defence); armies are 5% stronger.', { isles: ['thessa'], excl: 'bows', as: ['longbows'] }),
  toll_roads: T('economy', 3, 1.5, ['markets'], 'crate', 'Toll Roads', 'Every merchant from another realm pays ¤6 into the treasury of each town they trade in, and the tolls keep up the roads: they\'re built 25% faster.', { isles: ['thessa'], excl: 'tolls', as: ['customs'] }),
  windmills: T('engineering', 3, -0.5, ['crop_rotation'], 'wheat', 'Great Windmills', 'Millers grind twice as fast: bread and flour cost 25% less in a town with a windmill, and its millers pay a third more for wheat.', { isles: ['thessa'] }),
  magma_forges: T('warfare', 3, 0.5, ['obsidian_edge'], 'furnace', 'Magma Forges', 'Forges fed from the mountain\'s own fire: smiths sell steel swords even without Steelworking, and armies are 10% stronger. In time bronze grates are let into the streets over channels of the forges\' heat, glowing all night.', { isles: ['kharos'] }),
  ash_fields: T('engineering', 2, -1.5, ['kilnwork'], 'wheat', 'Ash Fields', 'The black ash of the mountain is rich: farms yield 50% more grain, and hay is stacked by the barns.', { isles: ['kharos'], as: ['mills'] }),
  glassblowing: T('economy', 3, 0.5, ['sulphur_trade'], 'glass', 'Glassblowing', 'Glassworks sell their wares 25% cheaper, and each week every town with a glassworks sends glass abroad: ¤10 to its treasury. In time the braziers along the streets are made over as lamps of amber glass, burning brighter.', { isles: ['kharos'], excl: 'tolls' }),
  fire_walking: T('society', 3, -1, ['ash_masks'], 'torch', 'Fire-Walking', 'A night in a town bed hardens you to fire for the day: lava and flames do you half the harm. The realm\'s folk wake 2 health better every morning.', { isles: ['kharos'] }),
  bog_venom: T('warfare', 3, -0.5, ['archery'], 'slime_gel', 'Bog Venom', 'The watch tips its arrows with marsh venom: a guard\'s arrow poisons whatever it hits (1 harm a second for 5 seconds); armies are 8% stronger.', { isles: ['myrrow'], excl: 'arms' }),
  tide_charts: T('engineering', 2, 1, ['metalworking'], 'scroll', 'Tide Charts', 'Charts of the tides and the channels: merchants, letters, settlers and armies travel between towns 15% faster, and fishers who know the tides bring in half as much again.', { isles: ['myrrow'], as: ['lodestones'] }),
  pearl_diving: T('economy', 3, -0.25, ['outriggers'], 'pearl', 'Pearl Diving', 'Pearl divers bring up twice as many pearls, and each week every town with a pearl house sells pearls abroad: ¤10 to its treasury. In time every town lays its square in tiles of mother-of-pearl.', { isles: ['myrrow'] }),
  // Round 36: the islands' own first step in building, and a great work
  // each, for the heart of every town.
  kilnwork: T('engineering', 1, -1, [], 'kiln_brick', 'Kilnwork', 'Kilns fire brick and tile for the whole town: buildings and walls go up 35% faster, and in time the square is laid in a mosaic of red kiln tile and black basalt, a sun burning at its heart.', { isles: ['kharos'], as: ['masonry'] }),
  ember_ward: T('society', 4, -2.5, ['fire_walking'], 'ruby', 'The Ember Ward', 'Each town\'s heartfire is set in a heart-crystal that raises a ward of heat over the town: an eruption breaks on it (nobody hurt, no roof burnt, nothing lost from the stores), burning rock falling about you stops at its edge, and no raider\'s torch takes under it.', { isles: ['kharos'], big: true }),
  mist_heart: T('society', 4, -2.5, ['spore_lore'], 'glowcap', 'Heart of the Mire', 'The Old Glowcap on each Mirefolk square grows great and bright, and the pearls of each Stiltfolk conch fountain kindle: no night horror rises within thirty paces of the realm\'s towns, and anyone resting on the square by the heart is mended (1 health every 4 seconds).', { isles: ['myrrow'], big: true }),
};

export const TECH_IDS = Object.keys(TECHS);

// How each island's tree differs from the common one: the steps it never
// learns (`drop`), and those that sit elsewhere on it or need other things
// first (`move`). Its own steps are in TECHS above.
//   Thessa, the island of roads and fields: surveying from the first, the
// horse before the muster, mills from rotated fields; tolls not customs,
// horse archers not crossbowmen, and no prisoners set to labour (an old
// law of the island).
//   Kharos, under the mountain: kilnwork not masonry, deep mines from the
// first, black glass before steel, ash fields not wells and mills; no
// horses (no cavalry), no tall yew (no longbows), no ships (they cross on
// rafts), and no free trade (the mountain's goods are sold dear). Its
// streets are paved in basalt, not gravel and cobbles.
//   Myrrow, in the mist: alchemy as old as law, spore lore from it,
// hospitality early; tide charts not lodestones (no mines, no lodestone);
// venomed arrows not great weapons (nothing heavy in the bog); no horses,
// no stone fortresses, no siege engines, and no monopolies (the stilt
// folk share).
export const ISLE_TREES = {
  thessa: {
    drop: ['crossbows', 'customs', 'prison_labor'],
    move: {
      surveying: { tier: 1, side: 0, req: [] },
      crop_rotation: { side: -0.5 },
      cranes: { tier: 3, side: 0.5 },
      lodestones: { side: 1.5 },
      fortress: { side: -0.25 },
      portals: { side: 1.5 },
      cavalry: { req: ['horse_lords'] },
      caravan_law: { req: [['free_trade', 'toll_roads']] },
    },
  },
  kharos: {
    drop: ['masonry', 'cavalry', 'longbows', 'mills', 'wells', 'aqueducts', 'trade_ships', 'free_trade', 'hospitality'],
    move: {
      mining: { tier: 1, side: 0, req: [] },
      surveying: { side: -0.5, req: ['kilnwork'], desc: 'Roads are built 50% faster; in time the town\'s lanes are laid with black basalt and its streets with dressed basalt slabs.' },
      lodestones: { tier: 2, side: 1 },
      granaries: { tier: 3, side: -1.5, req: ['ash_fields'], excl: null },
      cranes: { side: -0.5 },
      fortress: { side: -1, req: ['cranes', 'granaries'] },
      crossbows: { side: -1 },
      steel: { req: ['magma_forges', 'fieldworks'] },
      caravan_law: { req: [['glassblowing', 'customs']] },
      schools: { req: ['fire_walking'] },
      apprenticeships: { req: ['fire_walking'] },
    },
  },
  myrrow: {
    drop: ['cavalry', 'greatweapons', 'mining', 'lodestones', 'fortress', 'rams', 'catapults', 'monopolies'],
    move: {
      alchemy: { tier: 1, side: -1, req: [] },
      surveying: { desc: 'Roads are built 50% faster.' },
      codex: { side: 1 },
      spore_lore: { side: -1.5, req: ['alchemy'] },
      hospitality: { tier: 2, side: -0.5, req: ['alchemy'] },
      prisons: { side: 1 },
      longbows: { req: [['shieldwall', 'bog_venom']] },
      crossbows: { req: [['shieldwall', 'bog_venom']] },
      steel: { req: ['fieldworks'] },
      gemcraft: { side: -1.25 },
      free_trade: { side: 0.75 },
      customs: { side: 1.75 },
      banking: { side: -1.25 },
      mint: { side: -1.25 },
      portals: { req: ['tide_charts'] },
    },
  },
};

// An island's tree (or the common one, for anywhere else): each step as it
// sits there.
const TREES = new Map();
export function treeOf(isle) {
  const key = ISLE_TREES[isle] ? isle : '';
  let tree = TREES.get(key);
  if (tree) return tree;
  const spec = ISLE_TREES[key] || { drop: [], move: {} };
  const techs = {};
  for (const id of TECH_IDS) {
    const t = TECHS[id];
    if (t.isles ? !t.isles.includes(key) : spec.drop.includes(id)) continue;
    const m = spec.move[id];
    techs[id] = m ? { ...t, ...m, cost: COST[m.tier ?? t.tier] } : t;
  }
  // (A choice of steps loses the ones the island never learns.)
  for (const [id, t] of Object.entries(techs)) {
    if (!t.req.some((r) => Array.isArray(r) && r.some((k) => !techs[k]))) continue;
    techs[id] = { ...t, req: t.req.map((r) => (Array.isArray(r) ? r.filter((k) => techs[k]) : r)) };
  }
  tree = { isle: key || null, techs, ids: Object.keys(techs) };
  TREES.set(key, tree);
  return tree;
}
// What each common step's island forms are (anything that works `as` it).
const ALIASES = {};
for (const id of TECH_IDS) for (const a of TECHS[id].as) (ALIASES[a] ||= []).push(id);
export const aliasesOf = (id) => ALIASES[id] || [];
export const branchTechs = (b, tree = treeOf(null)) => tree.ids.filter((k) => tree.techs[k].branch === b).sort((x, y) => tree.techs[x].tier - tree.techs[y].tier || tree.techs[x].side - tree.techs[y].side);
// What a step needs, flattened (a choice of several counts each of them).
export const reqIds = (id, tree = treeOf(null)) => (tree.techs[id] || TECHS[id]).req.flat();
// The other steps of the same choice (learning this bars them).
export const rivalsOf = (id, tree = treeOf(null)) => {
  const t = tree.techs[id];
  return t && t.excl ? tree.ids.filter((k) => k !== id && tree.techs[k].excl === t.excl) : [];
};
const met = (done, r) => (Array.isArray(r) ? r.some((k) => done.includes(k)) : done.includes(r));
// Which of the Dagoni Islands a realm or town is on (its capital's, for a
// realm), and may it learn this step? (Each island has a few of its own.)
export function isleOf(s) {
  if (!s) return null;
  if (s.civ) return s.civ.island || null;
  return s.island || null;
}
export const offered = (s, id) => !!treeOf(isleOf(s)).techs[id];
export const ISLE_TECHS = TECH_IDS.filter((k) => TECHS[k].isles);

// What a realm leans toward knowing first, by what it holds dear.
const LEAN = {
  martial: { warfare: 2 }, mercantile: { economy: 2 }, pious: { society: 1.5 }, scholarly: { society: 1, engineering: 1 },
  agrarian: { engineering: 1.5 }, seafaring: { economy: 1 }, artisan: { engineering: 1, economy: 0.5 },
};
// A first step some realms already have at the start.
const STARTS = { martial: 'drill', mercantile: 'bookkeeping', scholarly: 'codex', artisan: 'masonry', pious: 'codex', agrarian: 'masonry', seafaring: 'bookkeeping' };
// What each people leans toward knowing (on top of what its realm holds
// dear): the highlanders build and forge, the northerners fight, the
// southerners trade, the forest peoples heal and keep the law of the
// tribe, the valley folk farm and build.
const CULTURE_LEAN = {
  high: { engineering: 1.5, warfare: 1 }, north: { warfare: 1.5, engineering: 0.5 }, sun: { economy: 1.5, society: 0.5 },
  wild: { society: 1.2, engineering: 0.5 }, vale: { engineering: 1, economy: 0.8 },
  ember: { warfare: 1.2, engineering: 1 }, mist: { society: 1.5, engineering: 0.3 }, tide: { economy: 1.4, warfare: 0.5 },
};
// Which side of a choice suits whom: a realm's values and people, and its
// ruler's temper (`kind`: the kindly lean that way; `hard`: the harsh).
const FIT = {
  free_trade: { values: ['mercantile', 'seafaring'], kind: 1 },
  customs: { values: ['martial', 'agrarian'], hard: 1 },
  banking: { values: ['mercantile', 'scholarly'] },
  monopolies: { values: ['artisan'], styles: ['high'], hard: 0.5 },
  shieldwall: { values: ['pious', 'agrarian'], styles: ['vale'], kind: 0.6 },
  greatweapons: { values: ['martial'], styles: ['north'], hard: 1 },
  longbows: { styles: ['wild', 'vale'], values: ['agrarian'] },
  crossbows: { styles: ['high', 'sun'], values: ['artisan', 'mercantile'] },
  clemency: { values: ['pious', 'scholarly'], kind: 1.5 },
  ironlaw: { values: ['martial'], hard: 1.5 },
  schools: { values: ['scholarly', 'pious'] },
  apprenticeships: { values: ['artisan', 'mercantile'], styles: ['high'] },
  aqueducts: { styles: ['sun', 'vale'], values: ['scholarly'] },
  granaries: { values: ['agrarian'], styles: ['north', 'high'] },
};

// Who has worked iron since before anyone remembers: highlanders and
// northerners, and any people that holds arms or craft dear. (Everyone
// else lights their first forge once they've learned how.)
const SMITHS = new Set(['martial', 'artisan', 'mercantile']);
const SMITH_STYLES = new Set(['high', 'north', 'ember']);

// What can't be had without knowing something first.
export const GATES = {
  building: { smithy: 'metalworking', jeweler: 'gemcraft', academy: null },
  job: { blacksmith: 'metalworking', jeweller: 'gemcraft' },
};
// The watch's arms, with and without a forge to make them.
const PRIMITIVE = {
  iron_sword: 'stone_sword', steel_sword: 'stone_sword', gold_sword: 'stone_sword', iron_axe: 'stone_axe', spear: 'wooden_spear', mace: 'club', iron_shield: 'wooden_shield',
  short_sword: 'stone_sword', sabre: 'stone_sword', greatsword: 'stone_sword', hand_axe: 'stone_axe', battle_axe: 'stone_axe', halberd: 'wooden_spear', flail: 'club', warhammer: 'club', crossbow: 'bow',
};


// A shield wall's arms (one hand free for the shield), and great weapons.
const ONE_HANDED = { greatsword: 'iron_sword', battle_axe: 'iron_axe', warhammer: 'mace', halberd: 'spear', quarterstaff: 'club' };
const TWO_HANDED = { iron_sword: 'greatsword', steel_sword: 'greatsword', short_sword: 'greatsword', sabre: 'greatsword', iron_axe: 'battle_axe', hand_axe: 'battle_axe', mace: 'warhammer', flail: 'warhammer', spear: 'halberd' };

// Who can be spared for the academy.
const SPARE = { laborer: 1, farmer: 3, scholar: 1, merchant: 2, fisher: 3 };

export class Tech {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.state = {}; // key -> { done, current, progress, banked, log }
    // What each town has put into its realm's study: town id -> step -> points.
    this.contrib = {};
    // (For testing: everything known everywhere.)
    this.cheat = false;
  }

  // A realm's key, or a free town's.
  keyOf(s) {
    if (!s) return null;
    if (s.civ) return `c${s.civ.id}`;
    if (s.people !== undefined || s.values !== undefined) return `c${s.id}`;
    return `s${s.id}`;
  }

  stateOf(s) {
    const k = this.keyOf(s);
    if (!k) return null;
    let st = this.state[k];
    if (!st) {
      st = this.state[k] = { done: [], current: null, progress: 0, banked: {}, log: [] };
      st.isle = isleOf(s);
      const civ = s.civ || (s.values ? s : null);
      for (const v of civ ? civ.values || [] : []) if (STARTS[v] && !st.done.includes(STARTS[v])) st.done.push(STARTS[v]);
      if (this.startsSmithing(s, civ)) st.done.push('metalworking');
      // (A state just broken away starts from what its towns bring it: see
      // changeHands.)
      if (civ && !civ.freed) this.startingPerks(civ, st);
    }
    st.banked ||= {};
    // (Which island's tree it learns from: its capital's.)
    if (st.isle === undefined) st.isle = isleOf(s);
    return st;
  }

  // The tree a realm (or free town) learns from, and a step as it sits on it.
  treeFor(st) {
    return treeOf(st ? st.isle : null);
  }

  def(st, id) {
    return this.treeFor(st).techs[id] || TECHS[id];
  }

  // A realm starts out knowing a few things already: one to seven steps of
  // the tree (more for a big realm of cities, fewer for a handful of
  // villages), chosen mostly by its people and what it holds dear, and a
  // little by chance. Nothing past the middle of the tree.
  startingPerks(civ, st) {
    const ow = this.game.world && this.game.world.ow;
    if (!ow) return;
    const towns = ow.settlements.filter((q) => q.civ === civ && !q.deserted);
    const size = towns.reduce((n, q) => n + (q.type === 'city' ? 3 : q.type === 'town' ? 2 : 1), 0);
    const rng = new RNG(hash4(this.game.seed >>> 0, civ.id, 0x7ec5));
    const want = Math.max(1, Math.min(7, 1 + Math.round(size / 3) + rng.int(-1, 1)));
    const lean = {};
    for (const v of civ.values || []) for (const [b, n] of Object.entries(LEAN[v] || {})) lean[b] = (lean[b] || 0) + n;
    for (const [b, n] of Object.entries(CULTURE_LEAN[civ.style] || {})) lean[b] = (lean[b] || 0) + n;
    const tree = this.treeFor(st);
    while (st.done.length < want) {
      const open = tree.ids.filter((k) => !st.done.includes(k) && tree.techs[k].tier <= 3 && this.ready(st, k));
      if (!open.length) break;
      st.done.push(rng.weighted(open.map((k) => [k, (1 + (lean[tree.techs[k].branch] || 0) * 1.5) * this.fit(civ, null, k) / tree.techs[k].tier])));
    }
    st.start = st.done.length;
  }

  // Born knowing how to work iron? (A free town: if it had a forge going
  // when it was founded.)
  startsSmithing(s, civ) {
    if (civ) return (civ.values || []).some((v) => SMITHS.has(v)) || SMITH_STYLES.has(civ.style);
    const L = this.game.world && this.game.world.layouts && this.game.world.layouts.get(s.id);
    if (L) return L.buildings.some((b) => b.type === 'smithy');
    return SMITH_STYLES.has(s.style) || s.type !== 'village';
  }

  // May this realm (or free town) have it yet?
  allows(s, kind, key) {
    const need = GATES[kind] && GATES[kind][key];
    return !need || this.has(s, need);
  }

  // (An island's own form of a step counts as knowing it.)
  has(s, id) {
    if (this.cheat) return true;
    const st = this.stateOf(s);
    return !!st && (st.done.includes(id) || aliasesOf(id).some((k) => st.done.includes(k)));
  }

  // What must be known first (a list inside it: any one of those), on the
  // tree it's learned from.
  prereqs(id, st = null) {
    const t = this.def(st, id);
    return t ? t.req : [];
  }

  // (The first of them, for anything that only wants one.)
  prereq(id, st = null) {
    const r = this.prereqs(id, st)[0];
    return Array.isArray(r) ? r[0] : r || null;
  }

  // Barred: the realm chose another side of this choice.
  barred(st, id) {
    return rivalsOf(id, this.treeFor(st)).some((k) => st.done.includes(k));
  }

  ready(st, id) {
    const t = this.def(st, id);
    return this.prereqs(id, st).every((r) => met(st.done, r)) && (t.also || []).every((k) => st.done.includes(k)) && !this.barred(st, id);
  }

  // How far along a step is (what's under study now, or put by for later).
  progressOn(st, id) {
    if (st.done.includes(id)) return this.def(st, id).cost;
    return st.current === id ? st.progress : (st.banked && st.banked[id]) || 0;
  }

  // How well one side of a choice suits a realm (and its ruler): 1 for
  // anything that isn't a choice.
  fit(civ, ruler, id) {
    const f = FIT[id];
    let w = 1;
    if (f) {
      w = 0.6;
      for (const v of (civ && civ.values) || []) if ((f.values || []).includes(v)) w += 0.8;
      if (civ && (f.styles || []).includes(civ.style)) w += 0.7;
      const p = (ruler && ruler.personality) || {};
      if (f.kind) w += ((p.kindness ?? 0.5) - 0.5) * 2 * f.kind;
      if (f.hard) w += ((p.temper ?? 0.5) - 0.5) * 2 * f.hard;
      w = Math.max(0.15, w);
    }
    // (Ships want a harbour to sail from.)
    if (id === 'trade_ships' && civ) {
      const ow = this.game.world && this.game.world.ow;
      const ports = ow ? ow.settlements.filter((q) => q.civ === civ && !q.deserted && (q.coast || q.river)).length : 0;
      w *= ports ? 1 + Math.min(1, ports * 0.3) : 0.1;
    }
    return w;
  }

  available(s) {
    const st = this.stateOf(s);
    if (!st) return [];
    return this.treeFor(st).ids.filter((k) => !st.done.includes(k) && this.ready(st, k));
  }

  // Who decides: the realm's ruler, or a free town's mayor.
  leaderOf(s) {
    if (s.civ) return this.sim.realms.ruler(s.civ);
    const L = this.sim.layoutOf(s.id);
    return L ? L.npcs.find((r) => r.job === 'mayor' && alive(r)) || null : null;
  }

  // The leader picks what to study next: their leanings, the realm's, and
  // what's troubling it (raids and war call for arms, an empty treasury for
  // trade, unrest for law).
  choose(s, day, rng) {
    const st = this.stateOf(s);
    const opts = this.available(s);
    if (!opts.length) {
      st.current = null;
      return null;
    }
    const civ = s.civ;
    const w = { economy: 1, warfare: 1, society: 1, engineering: 1 };
    for (const v of civ ? civ.values || [] : []) for (const [b, n] of Object.entries(LEAN[v] || {})) w[b] += n;
    const r = this.leaderOf(s);
    const p = (r && r.personality) || {};
    w.warfare += (p.bravery ?? 0.5) - 0.3 + (p.temper ?? 0.5) * 0.5;
    w.economy += (p.diligence ?? 0.5) * 0.5;
    w.society += (p.kindness ?? 0.5) * 0.8;
    // (What the ruler dreams of, if anything.)
    const amb = civ && this.sim.realms.ambition ? this.sim.realms.ambition(civ, day) : null;
    if (amb === 'merchant') w.economy += 1.5;
    else if (amb === 'warlord') w.warfare += 1.5;
    else if (amb === 'zealot') w.society += 1.5;
    const towns = civ ? this.sim.realms.memberLayouts(civ) : [this.sim.layoutOf(s.id)].filter(Boolean);
    const raids = towns.reduce((n, L) => n + (L.econ.recent.raids || 0) + (L.econ.recent.violence || 0), 0);
    w.warfare += Math.min(3, raids * 0.6) + (this.sim.war && civ && this.sim.war.atWar(civ) ? 4 : 0);
    if (towns.some((L) => L.econ.treasury < 60)) w.economy += 1.5;
    if (towns.some((L) => (L.econ.unrest || 0) > 1)) w.society += 1.5;
    // Cheaper steps first, mostly (and what's half done already); for a
    // choice, the side that suits the realm. (A great work is worth the wait.)
    const D = (k) => this.def(st, k);
    const score = (k) => w[D(k).branch] * Math.max(0.25, 1.4 - D(k).tier * 0.15) * this.fit(civ, r, k)
      * (D(k).big ? 1.3 : 1) * (1 + Math.min(1, (st.banked[k] || 0) / D(k).cost)) * (0.6 + rng.next() * 0.8);
    const scored = opts.map((k) => [k, score(k)]);
    const pick = scored.reduce((m, q) => (q[1] > m[1] ? q : m))[0];
    st.current = pick;
    // (Picking up where the scholars left off, if they've been at it before.)
    st.progress = (st.progress || 0) + (st.banked[pick] || 0);
    delete st.banked[pick];
    const who = r ? `${r.name.first} ${r.name.last}` : 'The council';
    this.announce(s, day, `${who} has set the scholars to study ${TECHS[pick].name.toLowerCase()}.`);
    return pick;
  }

  // The realm itself (given a realm, or one of its towns), or null for a
  // free town.
  civOf(s) {
    return s.civ || (s.values !== undefined || s.people !== undefined ? s : null);
  }

  announce(s, day, text) {
    const civ = this.civOf(s);
    if (civ) this.sim.realms.proclaim(civ, day, text);
    else {
      const L = this.sim.layoutOf(s.id);
      if (L && L.econ) ledger(L, day, text);
    }
  }

  // Learned at once, and whatever it needs first (the first side of any
  // choice that's still open): for the console. Returns what was learned.
  learnWithPrereqs(s, id, day) {
    const st = this.stateOf(s);
    const out = [];
    const go = (k, depth = 0) => {
      if (st.done.includes(k) || depth > 12) return true;
      if (this.barred(st, k)) return false;
      for (const r of [...this.prereqs(k, st), ...(this.def(st, k).also || [])]) {
        const opts = Array.isArray(r) ? r : [r];
        if (opts.some((q) => st.done.includes(q))) continue;
        if (!opts.some((q) => go(q, depth + 1))) return false;
      }
      if (this.learn(s, k, day)) out.push(k);
      return true;
    };
    go(id);
    return out;
  }

  // A day's study (or an insight of yours) toward what's being learned,
  // put down to the town where it was done.
  addPoints(s, n, day) {
    const st = this.stateOf(s);
    if (!st || n <= 0) return null;
    // (Known already, or barred by a choice made since: put by, and on to
    // something else.)
    if (st.current && (st.done.includes(st.current) || this.barred(st, st.current))) {
      if (!st.done.includes(st.current)) st.banked[st.current] = (st.banked[st.current] || 0) + st.progress;
      st.current = null;
      st.progress = 0;
    }
    if (!st.current) this.choose(s, day, new RNG(hash4(day, s.id, 0x7ec)));
    if (!st.current) return null;
    // (The Glyph Archive: the Kavorent's own records to read.)
    const pts = n * (this.has(s, 'schools') ? 1.4 : 1) * (this.sim.ancient && this.sim.ancient.has(s, 'archive') ? 2 : 1);
    st.progress += pts;
    if (s.cx !== undefined) {
      const c = (this.contrib[s.id] ||= {});
      c[st.current] = Math.round(((c[st.current] || 0) + pts) * 10) / 10;
    }
    const t = this.def(st, st.current);
    if (st.progress >= t.cost) {
      st.progress -= t.cost;
      return this.learn(s, st.current, day);
    }
    return null;
  }

  learn(s, id, day) {
    const st = this.stateOf(s);
    if (!st || st.done.includes(id)) return null;
    st.done.push(id);
    st.log.push({ id, day });
    delete st.banked[id];
    if (st.current === id) st.current = null;
    // (A choice made: whatever was under study on another side of it is
    // put by, for good.)
    if (st.current && this.barred(st, st.current)) {
      st.banked[st.current] = (st.banked[st.current] || 0) + st.progress;
      st.current = null;
      st.progress = 0;
    }
    const t = this.def(st, id);
    this.announce(s, day, `The scholars have mastered ${t.name.toLowerCase()}! ${t.desc}`);
    this.applyNow(s, id);
    if (this.game.currentSettlement && this.keyOf(this.game.currentSettlement) === this.keyOf(s)) this.game.ui.msg(`Your realm has learned ${t.name}.`, '#ffe070');
    return id;
  }

  // What changes the moment it's known.
  applyNow(s, id) {
    const civ = this.civOf(s);
    const towns = civ ? this.sim.realms.memberLayouts(civ) : [this.sim.layoutOf(s.id)].filter(Boolean);
    for (const L of towns) {
      for (const r of L.npcs) {
        if (!alive(r)) continue;
        if (r.job === 'guard') this.equipGuard(L, r);
        // Guild charters: the merchants with the means become masters.
        if (id === 'guilds' && r.job === 'merchant' && r.master && r.tier === 2) r.tier = 3;
      }
    }
  }

  // A weapon as this town's smiths can make it: wood and stone without a
  // forge, steel for a sword where they know steelworking.
  armFor(s, key) {
    if (!this.has(s, 'metalworking')) return PRIMITIVE[key] || key;
    if (key === 'iron_sword' && this.has(s, 'steel')) return 'steel_sword';
    return key;
  }

  // A guard's kit, by what the realm knows: drilled (tougher), a bow
  // (archery), a steel blade (steel).
  equipGuard(L, r) {
    const s = L.settlement;
    const eq = r.equipment;
    if (!eq) return;
    if (this.has(s, 'drill') && !r.drilled) {
      r.drilled = true;
      r.maxHp = (r.maxHp || 32) + 6;
      r.hp = Math.min(r.maxHp, (r.hp || 0) + 6);
    }
    eq.items ||= [];
    const metal = this.has(s, 'metalworking');
    const swap = (from, to) => {
      if (!from || !to || from === to) return;
      if (eq.tool === from) eq.tool = to;
      for (const i of eq.items) if (i.item === from) i.item = to;
      if (eq.shield === from) eq.shield = to;
    };
    // No bows in the watch till the realm has learned archery (a guard
    // who'd have carried one takes a spear instead).
    if (!this.has(s, 'archery') && eq.tool === 'bow') {
      swap('bow', metal ? 'spear' : 'wooden_spear');
      eq.items = eq.items.filter((i) => i.item !== 'arrow');
      if (r.inv) r.inv = r.inv.filter((i) => i && i.item !== 'arrow');
    }
    // Wood and stone without a forge; their iron back once there is one.
    if (!metal) {
      for (const [from, to] of Object.entries(PRIMITIVE)) {
        if (eq.tool !== from && eq.shield !== from && !eq.items.some((i) => i.item === from)) continue;
        swap(from, to);
        (r.unforged ||= {})[to] = from;
      }
    } else if (r.unforged) {
      for (const [to, from] of Object.entries(r.unforged)) swap(to, from === 'gold_sword' ? 'iron_sword' : from);
      delete r.unforged;
    }
    if (this.has(s, 'archery') && !eq.items.some((i) => ITEMS[i.item]?.ranged) && !ITEMS[eq.tool]?.ranged) {
      eq.items.push({ item: 'bow', count: 1 });
      (r.inv ||= []).push({ item: 'arrow', count: 12 });
    }
    // Steel for the swordsmen (an axe or a mace stays an axe or a mace);
    // black glass for the Ashborn's (before they have steel).
    if (metal && this.has(s, 'steel') && (eq.tool === 'iron_sword' || eq.tool === 'stone_sword' || eq.tool === 'obsidian_blade')) swap(eq.tool, 'steel_sword');
    else if (this.has(s, 'obsidian_edge') && ['iron_sword', 'stone_sword', 'short_sword'].includes(eq.tool)) swap(eq.tool, 'obsidian_blade');
    // How the watch fights: a shield on every arm (and a weapon for one
    // hand), or a great weapon in both.
    if (this.has(s, 'shieldwall')) {
      const one = ONE_HANDED[eq.tool];
      if (one) swap(eq.tool, metal ? one : PRIMITIVE[one] || one);
      if (!eq.shield && !ITEMS[eq.tool]?.ranged) eq.shield = metal ? 'iron_shield' : 'wooden_shield';
    } else if (this.has(s, 'greatweapons') && metal && TWO_HANDED[eq.tool]) {
      swap(eq.tool, TWO_HANDED[eq.tool]);
      eq.shield = null;
    }
    // Their bows: longbows, or crossbows and bolts.
    const bowTo = this.has(s, 'longbows') ? 'longbow' : this.has(s, 'crossbows') ? 'crossbow' : null;
    if (bowTo) {
      for (const i of eq.items) if (ITEMS[i.item]?.ranged && i.item !== bowTo) i.item = bowTo;
      if (ITEMS[eq.tool]?.ranged && eq.tool !== bowTo) eq.tool = bowTo;
      if (bowTo === 'crossbow' && r.inv) {
        const arrows = r.inv.filter((q) => q && q.item === 'arrow').reduce((n, q) => n + q.count, 0);
        if (arrows) {
          r.inv = r.inv.filter((q) => !q || q.item !== 'arrow');
          r.inv.push({ item: 'bolt', count: arrows });
        }
      }
    }
    if (r.look && r.look.gear) {
      if (eq.shield && ITEMS[eq.shield] && ITEMS[eq.shield].block) r.look.gear.shield = ITEMS[eq.shield].look;
      else if (!eq.shield && r.look.gear.shield) delete r.look.gear.shield;
    }
    if (r.ent && !r.ent.dead && r.look) r.ent.look = r.look;
    if (r.ent && !r.ent.dead) {
      r.ent.maxHp = r.maxHp;
      r.ent.hp = Math.min(r.ent.maxHp, Math.max(r.ent.hp, r.hp || 0));
    }
  }

  // ------------------------------------------------------------ daily
  // Each town's share of the realm's study, an academy for it when it can
  // afford one, someone to work there, and a decision when the last piece
  // of work is done.
  daily(L, day, rng) {
    const s = L.settlement;
    if (s.deserted || s.condition === 'abandoned') return null;
    const st = this.stateOf(s);
    if (!st.current) this.choose(s, day, rng);
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
    const academy = L.buildings.find((b) => b.type === 'academy' && !b.underConstruction);
    // Somewhere to study: the academy, or else the library or a study.
    const lab = academy || L.buildings.find((b) => (b.type === 'library' || b.type === 'study') && !b.underConstruction) || null;
    const researchers = people.filter((r) => r.job === 'researcher');
    const scholars = people.filter((r) => r.job === 'scholar');
    // (What the mayor has spent on the place: shelves, desks, lamps.)
    const fitted = 1 + 0.15 * (L.econ.labLevel || 0);
    // (A realm's study is led from its academies; a small town's study
    // adds a little to it. A free town's study is all it has.)
    const minor = s.civ && !academy && !this.sim.realms.isCapital(s) ? 0.35 : 1;
    let pts = (researchers.length * (academy ? 4 : lab ? 3 : 2.5) + scholars.length * 1.5) * fitted * minor;
    // You, at the desk (see the research window): counted as you go.
    const out = { points: pts };
    this.enforce(L, day);
    this.integrate(L, day);
    // Every town has a place to study, however small: a study, if it has
    // nothing better (so a free village can work things out too).
    const anyLab = L.buildings.some((b) => ['academy', 'library', 'study'].includes(b.type));
    if (!anyLab && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && (p.type === 'study' || p.type === 'academy'))
      && !(L.econ.buildQueue || []).some((o) => o.kind === 'build' && o.type === 'study')) {
      const p = this.sim.works.startBuilding(L, 'study', ', so the town can learn', false, 40);
      if (p) {
        L.econ.treasury = Math.max(0, L.econ.treasury - 40);
        out.study = p;
      }
    }
    // The mayor spends on it now and then: more shelves and desks, better
    // lamps, and at last a whole new wing (coin, and timber and stone from
    // the town's stock). Each makes the study go a little faster.
    const lvl = L.econ.labLevel || 0;
    const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r));
    if (lab && mayor && lvl < 3 && (day + s.id) % 4 === 0) {
      const cost = [70, 140, 240][lvl];
      const [wood, stone] = [[10, 4], [16, 10], [24, 18]][lvl];
      const k = stockOf(L);
      if (L.econ.treasury >= cost + 60 && k.wood >= wood && k.stone >= stone && rng.chance(0.5)) {
        L.econ.treasury -= cost;
        k.wood -= wood;
        k.stone -= stone;
        L.econ.labLevel = lvl + 1;
        const what = ['new shelves and a second desk', 'a reading room and good lamps', 'a whole new wing of books and instruments'][lvl];
        ledger(L, day, `Mayor ${mayor.name.first} ${mayor.name.last} has paid ¤${cost}, and timber and stone, for ${what} at the ${lab.name.replace(/^The /, '')}. The scholars work faster for it.`);
        out.upgraded = L.econ.labLevel;
        this.fitLab(L, lab, L.econ.labLevel);
      }
    }
    // An academy for the capital first (and then the bigger towns).
    const capital = !s.civ || this.sim.realms.isCapital(s);
    if (!academy && s.type !== 'village' && (capital || s.type === 'city') && L.econ.treasury >= 260 && rng.chance(capital ? 0.3 : 0.12)
      && !L.buildings.some((b) => b.type === 'academy') && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && p.type === 'academy')) {
      const p = this.sim.works.startBuilding(L, 'academy', ', for the realm\'s scholars', false, 180);
      // (No room inside the walls: out through them first.)
      if (!p) breachFor(this.sim, L, 'academy');
      if (p) {
        L.econ.treasury -= 180;
        out.academy = p;
      }
    }
    // (Those who studied at the library move into the new academy; till
    // there's anywhere, they work at a table in the town hall.)
    const desk = lab || L.buildings.find((b) => b.type === 'townhall' && !b.underConstruction) || null;
    if (desk) for (const r of researchers) if (!r.work || r.work.building !== desk.id) r.work = { kind: 'building', building: desk.id };
    // Someone to study there (always at least one).
    const want = academy ? (s.type === 'city' ? 3 : 2) : 1;
    if (researchers.length < want) {
      const many = (job) => people.filter((q) => q.job === job && q.age === 'adult').length;
      const pick = people.find((r) => r.age === 'adult' && SPARE[r.job] && many(r.job) >= SPARE[r.job] && !r.ruler && !r.trip?.phase?.startsWith('away'))
        // (A small place spares whoever it can.)
        || (!researchers.length ? people.find((r) => r.age === 'adult' && ['laborer', 'beggar', 'farmer', 'fisher', 'scholar', 'merchant'].includes(r.job) && !r.ruler && r.job !== 'mayor' && !r.trip?.phase?.startsWith('away')) : null);
      if (pick) {
        const was = pick.job;
        retrain(L, pick, 'researcher', new RNG(hash4(pick.idx, day, 0x5e)));
        if (pick.ent && !pick.ent.dead) {
          pick.ent.look = pick.look;
          pick.ent.activity = null;
        }
        if (desk) pick.work = { kind: 'building', building: desk.id };
        ledger(L, day, `${pick.name.first} ${pick.name.last}, once a ${was}, took up study at the ${(desk ? desk.name : 'academy').replace(/^The /, '').toLowerCase()}.`);
        out.hired = pick;
        pts += 2;
      }
    }
    if (pts) out.learned = this.addPoints(s, pts, day);
    // Weekly: a little interest on the treasury (banking).
    if (day % 7 === 0 && this.has(s, 'banking')) L.econ.treasury += Math.min(120, Math.round(L.econ.treasury * 0.05));
    // Weekly: the royal mint strikes coin, at the capital.
    if (day % 7 === 0 && s.civ && this.has(s, 'mint') && this.sim.realms.isCapital(s)) {
      const n = this.sim.realms.members(s.civ).filter((q) => !q.deserted).length;
      const coin = Math.min(250, 25 * n);
      L.econ.treasury += coin;
      out.minted = coin;
    }
    // Weekly: the Ashborn's sulphur sold abroad.
    if (day % 7 === 0 && this.has(s, 'sulphur_trade')) L.econ.treasury += s.coast || s.river ? 20 : 12;
    // (And glass and pearls, where there's a glassworks or a pearl house.)
    if (day % 7 === 0) tradeWeekly(L);
    // Spore lore: the herbalists' brews, every morning (and the Ashborn,
    // hardened by the fire-walk).
    if (this.has(s, 'spore_lore') || this.has(s, 'fire_walking')) for (const r of people) if (r.hp !== undefined && r.maxHp) r.hp = Math.min(r.maxHp, r.hp + 2);
    // A night in a proper bed: townsfolk wake hardier (hospitality).
    if (this.has(s, 'hospitality')) for (const r of people) if (r.home !== null && r.home !== undefined) r.blue = { day, hp: 2 };
    // Guards keep up with what the realm knows.
    for (const r of people) if (r.job === 'guard') this.equipGuard(L, r);
    return out;
  }

  // ------------------------------------------------------------ in practice
  // A town keeps to what its realm knows: no forge lit without
  // metalworking (its smith works as a labourer till the realm learns it,
  // and lights it again then), and the watch armed with what it has.
  enforce(L, day) {
    const s = L.settlement;
    if (!L.econ || s.deserted || s.condition === 'abandoned') return;
    const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.visitor);
    const metal = this.has(s, 'metalworking');
    const forge = L.buildings.find((b) => b.type === 'smithy' && !b.underConstruction);
    if (!metal) {
      for (const r of people) {
        if (r.job !== 'blacksmith' || r.ruler !== undefined) continue;
        retrain(L, r, 'laborer', new RNG(hash4(r.idx, day, 0xf0a9)));
        r.coldForge = true;
        if (r.ent && !r.ent.dead) {
          r.ent.look = r.look;
          r.ent.activity = null;
        }
        if (day > 0) ledger(L, day, `${r.name.first} ${r.name.last} can't get a forge to work without the know-how, and labours for a living instead.`);
      }
      if (forge && !forge.cold) forge.cold = true;
    } else if (forge) {
      // The forge is lit again (by the smith who waited, if they're still here).
      forge.cold = false;
      if (!people.some((r) => r.job === 'blacksmith')) {
        const r = people.find((q) => q.coldForge && q.age === 'adult') || null;
        if (r) {
          retrain(L, r, 'blacksmith', new RNG(hash4(r.idx, day, 0xf0aa)));
          r.coldForge = false;
          r.work = { kind: 'building', building: forge.id };
          if (r.ent && !r.ent.dead) {
            r.ent.look = r.look;
            r.ent.activity = null;
          }
          ledger(L, day, `The forge at the ${forge.name.replace(/^The /, '')} is lit at last: ${r.name.first} ${r.name.last} is back at the anvil.`);
        }
      }
    }
    for (const r of people) if (r.job === 'guard') this.equipGuard(L, r);
  }

  // How long something new takes to become part of everyday life in a
  // town (the capital first; the further steps take longer).
  settledIn(s, id, day) {
    const st = this.stateOf(s);
    if (!st) return false;
    // (An island's own form of it settles in the same way.)
    const k = st.done.includes(id) ? id : aliasesOf(id).find((q) => st.done.includes(q));
    if (!k) return false;
    const e = st.log.find((q) => q.id === k);
    if (!e) return true;
    const capital = !s.civ || this.sim.realms.isCapital(s);
    return day - e.day >= 2 + this.def(st, k).tier * 2 + (capital ? 0 : 3);
  }

  // What you can see of it, once it's settled in (once, in each town, and
  // only while you're there to see it go up; otherwise when you next come).
  integrate(L, day, arriving = false) {
    const s = L.settlement;
    const e = L.econ;
    if (!e || s.deserted || s.condition === 'abandoned') return;
    e.shown ||= [];
    const active = this.game.active.has(s.id);
    for (const id of Object.keys(LOOKS)) {
      if (e.shown.includes(id) || !this.settledIn(s, id, day)) continue;
      // (Things on people happen anywhere; things built need you there.)
      if (LOOKS[id].built && !active) continue;
      const done = LOOKS[id].apply(this, L, day);
      if (done === false) continue;
      e.shown.push(id);
      if (!arriving && LOOKS[id].news) ledger(L, day, LOOKS[id].news(s));
    }
  }

  // A better-fitted study: another shelf, a lamp, a desk.
  fitLab(L, lab, level) {
    if (!this.game.active.has(L.settlement.id) || lab.x0 === undefined) return;
    const w = this.game.world;
    const block = [B.bookshelf, B.lantern, B.bookshelf][level - 1] ?? B.bookshelf;
    for (let z = lab.z0 + 1; z < lab.z1; z++) {
      for (let x = lab.x0 + 1; x < lab.x1; x++) {
        if (!w.regionAt(x, z) || w.getBlock(x, GROUND, z) !== B.air) continue;
        // (Against a wall, and out of the way of the door.)
        const wall = x === lab.x0 + 1 || x === lab.x1 - 1 || z === lab.z0 + 1 || z === lab.z1 - 1;
        if (!wall || Math.abs(x - lab.door.x) + Math.abs(z - lab.door.z) <= 2) continue;
        if (block === B.lantern) this.sim.setBlocks([[x, GROUND, z, B.table, 0], [x, GROUND + 1, z, B.lantern, META_STATE]]);
        else this.sim.setBlocks([[x, GROUND, z, block, 0]]);
        return;
      }
    }
  }

  // Two realms made one: the bigger knows all the smaller knew, and takes
  // up its half-done work.
  inherit(toCiv, fromS) {
    const from = this.stateOf(fromS);
    const st = this.stateOf(toCiv);
    for (const k of from.done) if (!st.done.includes(k)) st.done.push(k);
    const part = { ...from.banked, ...(from.current ? { [from.current]: from.progress } : {}) };
    for (const [k, n] of Object.entries(part)) {
      if (st.done.includes(k) || n <= 0) continue;
      if (st.current === k) st.progress = Math.max(st.progress, n);
      else st.banked[k] = Math.max(st.banked[k] || 0, n);
    }
  }

  // A town under a new banner (taken in war, sworn to another realm, or
  // free): it knows only what its new realm knows, but the work it put into
  // its old realm's study goes with it. Whatever the new realm hasn't
  // learned, it's that much further along with: a town that did a fifth of
  // the work on metalworking brings a fifth of metalworking. (All of it, if
  // the town did it all: the realm learns it there and then.)
  changeHands(s, old, day = this.sim.today ? this.sim.today() : 0) {
    const mine = this.contrib[s.id];
    if (!mine || !s.civ) return [];
    const st = this.stateOf(s);
    const out = [];
    for (const [id, pts] of Object.entries(mine)) {
      // (Work on a step its new realm's island never learns is lost.)
      const t = this.treeFor(st).techs[id];
      if (!t || pts < 1 || st.done.includes(id)) continue;
      const before = this.progressOn(st, id);
      const after = before + pts;
      if (after >= t.cost && this.ready(st, id)) {
        if (st.current === id) {
          st.current = null;
          st.progress = 0;
        }
        out.push({ id, learned: true });
        this.learn(s, id, day);
        continue;
      }
      const to = Math.min(t.cost - 1, after);
      if (to <= before) continue;
      if (st.current === id) st.progress = to;
      else st.banked[id] = to;
      out.push({ id, pct: Math.round((to / t.cost) * 100), share: Math.round(((to - before) / t.cost) * 100) });
    }
    if (out.length) {
      const names = out.map((q) => TECHS[q.id].name.toLowerCase());
      const text = `The scholars of ${s.name} bring their work with them: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}.`;
      this.announce(s, day, text);
      void old;
    }
    return out;
  }

  // What a town has put into a step (points, and the share of its cost).
  contribution(s, id) {
    const n = (this.contrib[s.id] && this.contrib[s.id][id]) || 0;
    const t = TECHS[id] && this.def(this.stateOf(s), id);
    return { n, pct: t ? Math.round((n / t.cost) * 100) : 0 };
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { state: this.state, contrib: this.contrib };
  }

  load(d) {
    this.state = (d && d.state) || {};
    this.contrib = (d && d.contrib) || {};
    for (const st of Object.values(this.state)) st.banked ||= {};
  }
}

// What a town looks like once something new has settled in.
const tilesWhere = (L, pred) => {
  const out = [];
  const b = L.bounds;
  for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (pred(L.maskAt(x, z), x, z)) out.push([x, z]);
  return out;
};
// The tiles of a town's square (under its benches and its great thing
// too, so it's all of a piece).
const squareTiles = (L) => {
  const P = L.plaza;
  return P ? tilesWhere(L, (m, x, z) => (m === M.PLAZA || m === M.DECOR) && x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) : [];
};
// The great thing in the middle of a town's square (see render/pieces.js),
// as it stands: { x, z, id, meta }, or null where the ground isn't loaded.
function centrepiece(T, L) {
  const P = L.plaza;
  const w = T.game.world;
  if (!P || !w.regionAt(P.cx, P.cz)) return null;
  return { x: P.cx, z: P.cz, id: w.getBlock(P.cx, GROUND, P.cz), meta: w.getMeta(P.cx, GROUND, P.cz) };
}
// Free tiles beside a town's streets, spaced out (for lamps and the like):
// `want(x, z, road)` picks among them; each at least `gap` from the last
// and from the town's lamps.
function besideStreets(T, L, gap, want, max) {
  const w = T.game.world;
  const taken = (L.lamps || []).map((q) => ({ x: q.x, z: q.z }));
  const out = [];
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [x, z] of tilesWhere(L, (m) => m === M.FREE || m === M.YARD)) {
    if (out.length >= max) break;
    const road = D4.find(([dx, dz]) => L.maskAt(x + dx, z + dz) === M.ROAD);
    if (!road || !w.regionAt(x, z)) continue;
    if (w.getBlock(x, GROUND, z) !== B.air || w.getBlock(x, GROUND + 1, z) !== B.air) continue;
    // (Never in front of a door, nor on a building's doorstep.)
    if (D4.some(([dx, dz]) => L.maskAt(x + dx, z + dz) === M.BUILD) || L.buildings.some((b) => b.outside && Math.abs(b.outside.x - x) + Math.abs(b.outside.z - z) <= 1)) continue;
    if (!want(x, z, [x + road[0], z + road[1]])) continue;
    if (taken.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < gap) || out.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < gap)) continue;
    out.push({ x, z });
  }
  return out;
}
const ISLE_STYLES = new Set(['ember', 'mist', 'tide']);
const LOOKS = {
  // Masonry: the square paved in dressed stone. (The Ashborn's kilnwork
  // lays theirs in a mosaic: a sun of red kiln tile on black basalt, its
  // rays running out to a border of glazed brick.)
  masonry: {
    built: true,
    apply(T, L) {
      const w = T.game.world;
      const P = L.plaza;
      const was = L.mats && L.mats.plaza;
      if (!P || !was) return;
      const ops = [];
      if (L.settlement.style === 'ember') {
        for (const [x, z] of squareTiles(L)) {
          if (!w.regionAt(x, z) || w.getBlock(x, SURFACE, z) !== was) continue;
          const dx = x - P.cx;
          const dz = z - P.cz;
          const d = Math.hypot(dx, dz);
          let id;
          if (x === P.x0 || x === P.x1 || z === P.z0 || z === P.z1) id = B.kiln_brick;
          else if (d < 2.2) id = B.kiln_tile;
          else if (d > 3.4 && d < 4.4) id = B.kiln_brick;
          else id = Math.floor(((Math.atan2(dz, dx) / (Math.PI * 2)) + 1) * 12 + 0.5) % 2 ? B.kiln_tile : B.basalt_bricks;
          ops.push([x, SURFACE, z, id, 0]);
        }
      } else {
        if (was === B.stone_bricks) return;
        for (const [x, z] of squareTiles(L)) if (w.regionAt(x, z) && w.getBlock(x, SURFACE, z) === was) ops.push([x, SURFACE, z, B.stone_bricks, 0]);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => (s.style === 'ember' ? `The kilnmasters of ${s.name} have laid the square in a mosaic: a sun of red tile on black basalt.` : `The masons of ${s.name} have paved the square in dressed stone.`),
  },
  // Surveying: dirt lanes gravelled, gravel streets cobbled. (On Kharos:
  // the lanes laid with black basalt, the streets with dressed slabs of it.)
  surveying: {
    built: true,
    apply(T, L) {
      const w = T.game.world;
      const ops = [];
      const ember = L.settlement.style === 'ember';
      const next = ember ? { [B.path]: B.gravel, [B.gravel]: B.basalt, [B.basalt]: B.basalt_bricks } : { [B.path]: B.gravel, [B.gravel]: B.cobblestone };
      for (const [x, z] of tilesWhere(L, (m) => m === M.ROAD)) {
        const id = w.regionAt(x, z) ? w.getBlock(x, SURFACE, z) : null;
        if (id !== null && next[id] !== undefined) ops.push([x, SURFACE, z, next[id], 0]);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => (s.style === 'ember' ? `New surveyors' roads in ${s.name}: the lanes are laid with black basalt now, the streets with dressed slabs.` : `New surveyors' roads in ${s.name}: the old lanes are gravelled now, the streets cobbled.`),
  },
  // Glassblowing: the Ashborn's street braziers made over as lamps of
  // amber glass.
  glassblowing: {
    built: true,
    apply(T, L) {
      if (L.settlement.style !== 'ember') return;
      const w = T.game.world;
      const ops = [];
      for (const q of L.lamps || []) if (w.regionAt(q.x, q.z) && w.getBlock(q.x, GROUND, q.z) === B.ash_brazier) ops.push([q.x, GROUND, q.z, B.glass_lamp, 0]);
      if (!ops.length) return false;
      T.sim.setBlocks(ops);
    },
    news: (s) => `The glassblowers of ${s.name} have made over the street braziers as lamps of amber glass.`,
  },
  // Magma forges: bronze grates let into the streets over channels of the
  // forges' heat, glowing at night (spaced out along every street).
  magma_forges: {
    built: true,
    apply(T, L) {
      if (L.settlement.style !== 'ember') return;
      const w = T.game.world;
      const paved = new Set([B.path, B.gravel, B.basalt, B.basalt_bricks, B.cobblestone]);
      const ops = [];
      const put = [];
      const seed = L.settlement.seed >>> 0;
      for (const [x, z] of tilesWhere(L, (m) => m === M.ROAD)) {
        if (hash4(x, z, seed, 0x6a7e) % 4 !== 0 || !w.regionAt(x, z) || !paved.has(w.getBlock(x, SURFACE, z))) continue;
        if (put.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 5)) continue;
        put.push({ x, z });
        ops.push([x, SURFACE, z, B.ember_gutter, 0]);
        if (ops.length >= 40) break;
      }
      if (!ops.length) return false;
      T.sim.setBlocks(ops);
    },
    news: (s) => `Bronze grates have been let into the streets of ${s.name} over channels of the forges' heat; they glow all night.`,
  },
  // Fog wardens: fog lanterns at the crossings and along the edge of town.
  fog_wardens: {
    built: true,
    apply(T, L) {
      const b = L.bounds;
      const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const at = besideStreets(T, L, 6, (x, z, [rx, rz]) => {
        const ways = D4.filter(([dx, dz]) => L.maskAt(rx + dx, rz + dz) === M.ROAD).length;
        const edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z) <= 4;
        return ways >= 3 || edge;
      }, 14);
      if (!at.length) return false;
      T.sim.setBlocks(at.map((q) => [q.x, GROUND, q.z, B.fog_lantern, 0]));
      for (const q of at) L.setMask(q.x, q.z, M.DECOR);
    },
    news: (s) => `The fog wardens of ${s.name} have hung lanterns at the crossings and along the edge of town.`,
  },
  // Spore lore: glowcaps grown along the lanes, in little clumps.
  spore_lore: {
    built: true,
    apply(T, L) {
      const seed = L.settlement.seed >>> 0;
      const at = besideStreets(T, L, 4, (x, z) => hash4(x, z, seed, 0x5b07) % 3 === 0, 22);
      if (!at.length) return false;
      T.sim.setBlocks(at.map((q) => [q.x, GROUND, q.z, B.glowshroom, 0]));
      for (const q of at) L.setMask(q.x, q.z, M.DECOR);
    },
    news: (s) => `Glowcaps have been grown along the lanes of ${s.name}; they light the way at night.`,
  },
  // Pearl diving: the square laid in tiles of mother-of-pearl, a border
  // of the old boards (or stone) left round it.
  pearl_diving: {
    built: true,
    apply(T, L) {
      if (!ISLE_STYLES.has(L.settlement.style) || L.settlement.style === 'ember') return;
      const w = T.game.world;
      const P = L.plaza;
      const was = new Set([L.mats && L.mats.plaza, B.stone_bricks]);
      const ops = [];
      for (const [x, z] of squareTiles(L)) {
        if (x === P.x0 || x === P.x1 || z === P.z0 || z === P.z1) continue;
        if (w.regionAt(x, z) && was.has(w.getBlock(x, SURFACE, z))) ops.push([x, SURFACE, z, B.nacre_tile, 0]);
      }
      if (!ops.length) return false;
      T.sim.setBlocks(ops);
    },
    news: (s) => `The pearl divers of ${s.name} have laid the square in tiles of mother-of-pearl.`,
  },
  // Aqueducts: a fountain where the square's well (or its statue) stood,
  // on nine paces (the eight about it a plinth: see render/pieces.js).
  aqueducts: {
    built: true,
    apply(T, L) {
      if (ISLE_STYLES.has(L.settlement.style)) return;
      const c = centrepiece(T, L);
      if (!c) return false;
      if (c.id !== B.well && c.id !== B.statue) return;
      const w = T.game.world;
      const ring = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) ring.push([c.x + dx, c.z + dz]);
      // (Room for it: a festival's things cleared away first, say.)
      if (ring.some(([x, z]) => w.getBlock(x, GROUND, z) !== B.air || w.getBlock(x, GROUND + 1, z) !== B.air)) return false;
      T.sim.setBlocks([[c.x, GROUND, c.z, B.fountain, 0], ...ring.map(([x, z]) => [x, GROUND, z, B.plinth, 0])]);
      for (const [x, z] of ring) L.setMask(x, z, M.DECOR);
      L.wells = (L.wells || []).filter((q) => !(q.x === c.x && q.z === c.z));
      L.wells.push({ x: c.x, z: c.z + 1 });
    },
    news: (s) => `The aqueduct reaches ${s.name}: a fountain plays on the square where the well stood.`,
  },
  // The ember ward: the heartfire set in a heart-crystal.
  ember_ward: {
    built: true,
    apply(T, L) {
      const c = centrepiece(T, L);
      if (!c) return false;
      if (c.id !== B.heartfire) return;
      T.sim.setBlocks([[c.x, GROUND, c.z, B.heart_crystal, 0]]);
      T.game.lightDirty = true;
    },
    news: (s) => `The heartfire of ${s.name} has been set in a heart-crystal, and a ward of heat stands over the town.`,
  },
  // The heart of the mire: the Old Glowcap grown great; the conch
  // fountain's pearls kindled.
  mist_heart: {
    built: true,
    apply(T, L) {
      const c = centrepiece(T, L);
      if (!c) return false;
      if (c.id !== B.great_glowcap && c.id !== B.conch_fountain) return;
      T.sim.setBlocks([[c.x, GROUND, c.z, c.id, c.meta | META_STATE]]);
      T.game.lightDirty = true;
    },
    news: (s) => (s.style === 'tide' ? `The pearls of the conch fountain in ${s.name} have kindled; night horrors keep away from the town now.` : `The Old Glowcap of ${s.name} has grown great and bright; night horrors keep away from the town now.`),
  },
  // Drill: proper helms on the watch.
  drill: {
    apply(T, L) {
      for (const r of L.npcs) {
        if (r.job !== 'guard' || !alive(r) || !r.look) continue;
        r.look.hat = 'helmet';
        if (r.ent && !r.ent.dead) r.ent.look = r.look;
      }
    },
  },
  // Archery: butts by the guardhouse.
  archery: {
    built: true,
    apply(T, L) {
      const gh = L.buildings.find((b) => b.type === 'guardhouse' && b.outside) || L.buildings.find((b) => b.type === 'townhall' && b.outside);
      if (!gh) return;
      const rng = new RNG(hash4(L.settlement.seed >>> 0, 0xa7c4));
      const ops = [];
      for (let i = 0; i < 2; i++) {
        const at = L.findFreeNear(gh.outside.x, gh.outside.z, 6, rng);
        if (!at) break;
        ops.push([at.x, GROUND, at.z, i ? B.hay_bale : B.training_dummy, 0]);
        L.setMask(at.x, at.z, M.DECOR);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `Archery butts have gone up by the guardhouse in ${s.name}; the watch practise every morning.`,
  },
  // Watermills: hay stacked by the barns.
  mills: {
    built: true,
    apply(T, L) {
      const barn = L.buildings.find((b) => b.type === 'barn' && b.outside);
      const f = L.fields && L.fields[0];
      const at0 = barn ? barn.outside : f ? { x: f.x0 - 1, z: f.z0 } : null;
      if (!at0) return;
      const rng = new RNG(hash4(L.settlement.seed >>> 0, 0x3111));
      const ops = [];
      for (let i = 0; i < 3; i++) {
        const at = L.findFreeNear(at0.x, at0.z, 5, rng);
        if (!at) break;
        ops.push([at.x, GROUND, at.z, B.hay_bale, 0]);
        L.setMask(at.x, at.z, M.DECOR);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `The mill keeps up with the harvest now in ${s.name}: hay stacked high by the barns.`,
  },
  // Schools: children about with their books.
  schools: {
    apply(T, L) {
      for (const r of L.npcs) {
        if (r.age !== 'child' || !alive(r) || !r.equipment) continue;
        if (hash4(r.idx, 0x5c400) % 2) continue;
        r.equipment.tool = 'book';
        if (!r.equipment.items.some((i) => i.item === 'book')) r.equipment.items.push({ item: 'book', count: 1 });
      }
    },
    news: (s) => `There's a schoolroom in ${s.name} now; the children go about with their books.`,
  },
  // Guild charters: guild awnings over the shop doors.
  guilds: {
    built: true,
    apply(T, L) {
      const DX = [0, -1, 0, 1];
      const DZ = [1, 0, -1, 0];
      const cloth = [B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green][hash4(L.settlement.civ ? L.settlement.civ.id : L.settlement.id, 0x9e1d) % 4];
      const ops = [];
      for (const b of L.buildings) {
        if (!['shop', 'tailor', 'bakery', 'smithy', 'herbalist'].includes(b.type) || !b.outside || b.underConstruction) continue;
        const rot = b.door.rot;
        const px = DZ[rot] !== 0 ? 1 : 0;
        const pz = DX[rot] !== 0 ? 1 : 0;
        for (const sg of [1, -1]) {
          const x = b.outside.x + px * sg;
          const z = b.outside.z + pz * sg;
          if (L.maskAt(x, z) === M.BUILD || L.maskAt(x, z) === M.WALL) continue;
          const w = T.game.world;
          if (!w.regionAt(x, z) || w.getBlock(x, GROUND + 2, z) !== B.air) continue;
          ops.push([x, GROUND + 2, z, cloth, 0]);
        }
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `The shops of ${s.name} hang out their guild colours.`,
  },
};

// How much a step of study is worth (for the window): done, total.
export function progressOf(tech, s) {
  const st = tech.stateOf(s);
  if (!st || !st.current) return null;
  return { id: st.current, done: Math.floor(st.progress), cost: tech.def(st, st.current).cost };
}
