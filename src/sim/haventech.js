// (Round 131) What a pirates' haven learns: the brethren's own tree, the
// common one with much of it torn out (no banks or mints, no siege trains,
// no prisons or schools, no aqueducts or fortresses: pirates have no use
// for them) and the brethren's own steps in their places. A haven knows
// its first steps from the day it's made (shares, boarding, the Articles,
// shacks on stilts, a black ship at its pier).
//   Each step's `fx` is what it does, in plain amounts (see tech.fxOf),
// the common ones (`tax`, `income`, `merchants`, `defence`, `army`,
// `crime`, `heal`, `build`, `relations`) and the brethren's own, worked
// out over a guild's standing havens (see Brethren.fx):
//   `chest` (¤ a week into the guild's chest from each haven), `fence`
// (the fence pays a share more for plunder), `prizeOdds` (captains take
// prizes a share more often), `prize` (each prize worth a share more),
// `shares` (share-outs a share bigger), `ransom` (ransoms a share higher),
// `ransomPay` (towns a share readier to pay), `repel` (a realm's marines
// a share weaker against the haven), `raid` (the chief's coastal raids a
// share stronger), `temper` (the guild's mood the steadier), `loyalty`
// (captains the slower to turn), `revel` (Revels the more often),
// `hidden` (word of the haven gets about a share less), `careen` (ships
// careened a share quicker), `warn` (word of an expedition comes ahead).

// [branch, tier, side, req, icon, name, desc, opts]
export const HAVEN_TECH_DEFS = {
  // ------------------------------------------------ the chest
  h_shares: ['economy', 1, 0, [], 'coin', 'Fair Shares', 'Every hand\'s share written in the book: the haven\'s cut brings in 15% more, and each haven puts ¤6 a week into the guild\'s chest.', { isles: ['haven'], as: ['bookkeeping'], fx: { tax: 0.15, chest: 6 } }],
  h_fences: ['economy', 2, -1, ['h_shares'], 'chest', 'The Fences\' Ring', 'Fences in every port who ask no questions: the haven\'s fence pays 25% more for plunder, and sells the haven\'s takings abroad for ¤8 a week.', { isles: ['haven'], fx: { fence: 0.25, income: 8 } }],
  h_smuggling: ['economy', 2, 1, ['h_shares'], 'crate', 'Smugglers\' Runs', 'Boats in and out by night with no realm\'s tariffs paid: travelling merchants come to the haven 40% more often.', { isles: ['haven'], fx: { merchants: 0.4 } }],
  h_ransom: ['economy', 3, -1, ['h_fences'], 'scroll', 'Ransom Brokers', 'Go-betweens in every port: captives\' ransoms run half again as high, and their towns pay twice as readily.', { isles: ['haven'], fx: { ransom: 0.5, ransomPay: 1 } }],
  h_black_ships: ['economy', 3, 1, ['h_smuggling'], 'raft', 'Black Ships', 'The haven\'s own great ship lies at its pier, black-hulled under the guild\'s flag, and sails on its own voyages (¤60 to ¤200 a time); the guild\'s captains take prizes 15% more often.', { isles: ['haven'], big: true, as: ['trade_ships'], fx: { prizeOdds: 0.15 } }],
  h_prize_courts: ['economy', 4, 0, [['h_ransom', 'h_black_ships']], 'gold_ingot', 'Prize Courts', 'Taken ships sold whole, hull and cargo, at a court of the brethren\'s own: every prize brings the guild\'s chest 40% more.', { isles: ['haven'], fx: { prize: 0.4 } }],
  h_treasure_fleet: ['economy', 5, 0, ['h_prize_courts'], 'gem', 'The Treasure Fleet', 'Once a season the brethren sail together after a realm\'s treasure fleet: each haven puts ¤30 a week into the guild\'s chest, and every share-out is half as big again.', { isles: ['haven'], big: true, fx: { chest: 30, shares: 0.5 } }],
  // ------------------------------------------------ the cutlass
  h_boarding: ['warfare', 1, 0, [], 'sabre', 'Boarding Drill', 'Corsairs drilled to go over the side with cutlass and dirk: the haven\'s guards are drilled as a town\'s watch, and it defends 10% better.', { isles: ['haven'], as: ['drill'], fx: { defence: 0.1 } }],
  h_grapples: ['warfare', 2, 1, ['h_boarding'], 'iron_bars', 'Grapnels and Pikes', 'Iron grapnels to lash a prize alongside, and pikes to clear her deck: the guild\'s captains take prizes 20% more often, and the haven\'s raiders are 15% stronger.', { isles: ['haven'], fx: { prizeOdds: 0.2, army: 0.15 } }],
  h_powder: ['warfare', 3, 1, ['h_grapples'], 'cannonball', 'Powder Magazines', 'Powder kept dry in a stone magazine and the shore guns manned day and night: the haven defends 20% better, and a realm\'s marines come ashore 25% weaker.', { isles: ['haven'], fx: { defence: 0.2, repel: 0.25 } }],
  h_coastal_raids: ['warfare', 4, 1.5, ['h_powder'], 'torch', 'Coastal Raids', 'Marines of the brethren\'s own: raids the chief calls on a coast are 30% stronger, and the haven\'s raiders 10% stronger again.', { isles: ['haven'], fx: { raid: 0.3, army: 0.1 } }],
  h_fireships: ['warfare', 5, 0.5, [['h_coastal_raids', 'steel']], 'lantern', 'Fireships', 'Old hulks packed with pitch and powder, let loose on the wind: a realm\'s expedition against the haven loses half its strength before it can land.', { isles: ['haven'], big: true, fx: { repel: 0.5 } }],
  // ------------------------------------------------ the Articles
  h_articles: ['society', 1, 0, [], 'scroll', 'The Articles', 'Every hand signs the Articles: crime in the haven falls 20%, and the guild\'s temper holds steadier.', { isles: ['haven'], as: ['codex'], fx: { crime: 0.2, temper: 0.1 } }],
  h_grog: ['society', 2, 1, ['h_articles'], 'grog', 'Grog Rations', 'Rum cut with water and lime, a ration a day: the haven\'s folk wake with 1 extra health every morning, and the brethren hold a Revel twice as often.', { isles: ['haven'], fx: { heal: 1, revel: 1 } }],
  h_honour: ['society', 3, 1, ['h_grog'], 'bone', 'Honour Among Thieves', 'A brother who steals another\'s share is marooned: crime falls a further 25%, and the guild\'s captains are slower to turn on their chief or go over to another guild.', { isles: ['haven'], fx: { crime: 0.25, loyalty: 0.15, temper: 0.1 } }],
  h_hidden: ['society', 3, -0.5, ['h_articles'], 'treasure_map', 'Hidden Coves', 'Blindfolds for captives and silence in every tavern: word of the haven gets about half as often, and a captive sent home can\'t say where they were held.', { isles: ['haven'], fx: { hidden: 0.5 } }],
  h_republic: ['society', 5, 0, [['h_honour', 'h_hidden']], 'rum', 'The Pirate Republic', 'The havens govern themselves as one: relations between the guilds warm twice as fast, and the guild\'s temper never falls far.', { isles: ['haven'], big: true, fx: { relations: 1, temper: 0.3 } }],
  // ------------------------------------------------ the shore
  h_stilts: ['engineering', 1, -1, [], 'log_mangrove', 'Stilt Shacks', 'Shacks on mangrove stilts over the tide line: buildings go up 30% faster.', { isles: ['haven'], as: ['masonry'], fx: { build: 0.3 } }],
  h_careening: ['engineering', 2, -1.5, ['h_stilts'], 'planks', 'Careening Beach', 'Ships hauled over on the beach and scraped of weed: the guild\'s ships are careened in half the time, and back at sea sooner.', { isles: ['haven'], fx: { careen: 0.5 } }],
  h_lookouts: ['engineering', 3, -1, ['h_careening'], 'spyglass', 'Lookout Towers', 'A lookout on every headland: the haven defends 10% better, and the brethren hear of a realm\'s expedition the moment it\'s sent (and the guild\'s ships can come home to meet it).', { isles: ['haven'], fx: { defence: 0.1, warn: 1 } }],
  h_batteries: ['engineering', 4, -0.5, ['h_lookouts', 'cranes'], 'barrel', 'Shore Batteries', 'Guns dug in along the shore behind earth and timber: the haven defends 25% better, and a realm\'s marines come ashore 15% weaker.', { isles: ['haven'], fx: { defence: 0.25, repel: 0.15 } }],
};

// How the brethren's tree differs from the common one: what they never
// learn (taken by their own steps above, or of no use to pirates), and the
// common steps they keep but reach from their own.
export const HAVEN_TREE = {
  drop: [
    'bookkeeping', 'guilds', 'markets', 'gemcraft', 'free_trade', 'customs', 'banking', 'monopolies', 'caravan_law', 'mint', 'trade_ships', 'trade_league',
    'drill', 'muster', 'cavalry', 'fieldworks', 'siegecraft', 'rams', 'catapults',
    'codex', 'prisons', 'clemency', 'ironlaw', 'schools', 'conscription', 'prison_labor', 'embassies',
    'masonry', 'wells', 'mills', 'aqueducts', 'granaries', 'fortress', 'lodestones', 'portals',
  ],
  move: {
    archery: { req: ['h_boarding'] },
    alchemy: { req: ['h_articles'] },
    surveying: { req: ['h_stilts'], side: -0.25 },
    steel: { tier: 4, side: 0.25, req: ['h_powder'] },
    shieldwall: { side: -2 },
    greatweapons: { side: -1 },
    longbows: { side: -2 },
    crossbows: { side: -1 },
    hospitality: { side: -1.5 },
    apprenticeships: { side: -1.5, tier: 4 },
    cranes: { side: 0.5 },
    mining: { side: 1.5 },
  },
  prune: true,
};

// What every haven knows from the first.
export const HAVEN_STARTS = ['h_shares', 'h_boarding', 'h_articles', 'h_stilts', 'metalworking', 'h_smuggling', 'h_black_ships'];
