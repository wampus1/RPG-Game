// What the far lands' peoples learn (round 68): each people its own tree,
// the common one with steps of their own in it (in place of some of the
// common ones, and on top of them), and a few common steps it never
// learns. The two continents' peoples, old and many, know far more than
// the isles' (sixteen to eighteen steps their own, against six), and so
// their trees are the biggest there are.
//   Each step's `fx` is what it does, in plain amounts (see tech.fxOf, and
// where each is used): `tax` (taxes, a share more), `study` (study, a share
// faster), `build` (building), `army` (a soldier's strength in war),
// `defence` (a town's against raids), `income` (¤ into each town's treasury
// every week), `merchants` (how often they come), `births`, `crime` (a
// share less), `farms` (yields), `travel` (between towns), `relations`
// (how fast they warm), `heal` (health townsfolk wake with, every
// morning), `muster` (the size of levies).
//   A step `as` a common one does all that one does (and counts as
// knowing it).

// [branch, tier, side, req, icon, name, desc, opts]
export const FAR_TECH_DEFS = {
  // ------------------------------------------------ the Velari (Velmarch)
  v_census: ['economy', 1, 1, [], 'ledger', 'The Census', 'Every head counted and taxed: taxes bring in 10% more, and every town puts ¤8 a week into its treasury from the rolls.', { isles: ['velari'], fx: { tax: 0.1, income: 8 } }],
  v_roads: ['economy', 2, 0, ['bookkeeping'], 'cobblestone', 'Imperial Roads', 'Paved roads between every town: merchants come 30% more often, and armies, letters and settlers travel 20% faster.', { isles: ['velari'], fx: { merchants: 0.3, travel: 0.2 } }],
  v_denarius: ['economy', 3, -2, ['guilds'], 'coin', 'The Silver Denarius', 'One coin from one end of the empire to the other: taxes bring in 15% more, and every town banks ¤10 a week.', { isles: ['velari'], fx: { tax: 0.15, income: 10 } }],
  v_estates: ['economy', 4, 2, ['caravan_law'], 'olives', 'Great Estates', 'Olive groves and vineyards worked on a great scale: farms yield 40% more, and every town sells oil and wine abroad for ¤12 a week.', { isles: ['velari'], fx: { farms: 0.4, income: 12 } }],
  v_forum: ['economy', 6, 1.25, [['mint', 'trade_ships']], 'marble', 'The Forum', 'Every town raises a forum: merchants come 50% more often, relations with other realms warm 30% faster, and study goes 15% faster.', { isles: ['velari'], big: true, fx: { merchants: 0.5, relations: 0.3, study: 0.15 } }],
  v_legion: ['warfare', 2, 0, ['drill'], 'iron_sword', 'The Legion', 'The watch drilled as legionaries, eight to a tent: armies are 15% stronger.', { isles: ['velari'], fx: { army: 0.15 } }],
  v_testudo: ['warfare', 3, -2.25, ['archery'], 'iron_shield', 'The Testudo', 'Every guard carries a great shield, locked overhead in the tortoise (no two-handed weapons): towns defend 35% better against raids, and armies defending are 15% stronger.', { isles: ['velari'], excl: 'arms', as: ['shieldwall'], fx: { defence: 0.2 } }],
  v_pila: ['warfare', 5, -0.75, ['v_legion'], 'spear', 'Pila', 'Every legionary carries two heavy javelins, thrown before the charge: armies are 12% stronger.', { isles: ['velari'], fx: { army: 0.12 } }],
  v_castra: ['warfare', 4, 2, ['fieldworks'], 'log_oak', 'Marching Camps', 'A fortified camp dug every night on the march: armies are 10% stronger, and towns defend 10% better.', { isles: ['velari'], fx: { army: 0.1, defence: 0.1 } }],
  v_ballistae: ['warfare', 6, -1, ['siegecraft'], 'crossbow', 'Ballistae', 'Great bolt-throwers: armies bring them to war (the other side fights 12% weaker; you\'ll see the stones and bolts fall), and every town\'s walls carry them (defence 15% better).', { isles: ['velari'], big: true, as: ['catapults'], fx: { defence: 0.15 } }],
  v_senate: ['society', 2, 0, ['codex'], 'scroll', 'The Senate', 'The great families sit in council: townsfolk commit crimes 15% less often, and relations warm 15% faster.', { isles: ['velari'], fx: { crime: 0.15, relations: 0.15 } }],
  v_citizenship: ['society', 3, -2, ['v_senate'], 'dispatch', 'Citizenship', 'Every free man a citizen: 25% more children are born, and crime falls a further 15%.', { isles: ['velari'], fx: { births: 0.25, crime: 0.15 } }],
  v_augurs: ['society', 3, 2.5, ['codex'], 'feather', 'The Augurs', 'The birds read before every war and every law: armies are 6% stronger, and study goes 10% faster.', { isles: ['velari'], fx: { army: 0.06, study: 0.1 } }],
  v_games: ['society', 4, 2.5, ['v_senate'], 'olive_bread', 'Bread and Games', 'The towns fed and amused: townsfolk wake with 1 extra health every morning, and commit crimes 20% less often.', { isles: ['velari'], fx: { heal: 1, crime: 0.2 } }],
  v_libraries: ['society', 5, -1.5, [['schools', 'apprenticeships']], 'book', 'Great Libraries', 'A library in every city, copied scroll by scroll: all study goes 30% faster.', { isles: ['velari'], fx: { study: 0.3 } }],
  v_concrete: ['engineering', 2, 2, ['masonry'], 'stone_bricks', 'Concrete', 'Lime and ash poured like stone: buildings and walls go up 30% faster, and walls hold 5% better.', { isles: ['velari'], fx: { build: 0.3, defence: 0.05 } }],
  v_aqueducts: ['engineering', 4, -2, ['mills'], 'water_bucket', 'Imperial Aqueducts', 'Arches carrying water from the hills: 80% more children are born in every town, and a fountain plays on every square where its well stood.', { isles: ['velari'], excl: 'harvest', as: ['aqueducts'], fx: { births: 0.2 } }],
  v_hypocaust: ['engineering', 3, 2, ['mining'], 'furnace', 'Hypocausts', 'Floors warmed from below: townsfolk wake with 2 extra health every morning, even in winter.', { isles: ['velari'], fx: { heal: 2 } }],
  // ------------------------------------------------ the Rimeborn (Velmarch)
  r_herds: ['economy', 1, 1, [], 'leather', 'Reindeer Herds', 'Every town keeps herds: farms bring in 25% more, and hides sell abroad for ¤6 a week.', { isles: ['rime'], fx: { farms: 0.25, income: 6 } }],
  r_furs: ['economy', 2, 0, ['bookkeeping'], 'leather', 'The Fur Trade', 'Sable and fox sold south: every town banks ¤12 a week, and merchants come 20% more often.', { isles: ['rime'], fx: { income: 12, merchants: 0.2 } }],
  r_sledges: ['economy', 3, -2, ['guilds'], 'planks', 'Sledge Roads', 'Over the snow in every season: merchants, letters and armies travel 25% faster.', { isles: ['rime'], fx: { travel: 0.25 } }],
  r_amber: ['economy', 4, 2, ['caravan_law'], 'gem', 'The Amber Road', 'Amber carried south: every town banks ¤15 a week, and relations warm 25% faster.', { isles: ['rime'], fx: { income: 15, relations: 0.25 } }],
  r_skis: ['warfare', 2, 0, ['drill'], 'stick', 'Ski Troops', 'The watch moves fast over the snow: towns defend 15% better, and armies are 5% stronger.', { isles: ['rime'], fx: { defence: 0.15, army: 0.05 } }],
  r_berserkers: ['warfare', 3, -0.5, ['archery'], 'battle_axe', 'Berserkers', 'Guards fight two-handed in a fury (greatswords, battle axes, war hammers): armies attacking are 15% stronger, and 10% stronger besides.', { isles: ['rime'], excl: 'arms', as: ['greatweapons'], fx: { army: 0.1 } }],
  r_frost_arrows: ['warfare', 4, -2.5, ['archery'], 'arrow', 'Frost-Tipped Arrows', 'Arrows tipped with ice crystal: armies are 8% stronger, and towns defend 10% better.', { isles: ['rime'], fx: { army: 0.08, defence: 0.1 } }],
  r_longships: ['warfare', 5, 1.5, ['steel'], 'raft', 'Longships', 'Shallow keels for raids up any river: armies are 10% stronger, and levies 20% larger.', { isles: ['rime'], big: true, fx: { army: 0.1, muster: 0.2 } }],
  r_thing: ['society', 2, 0, ['codex'], 'standing_stone', 'The Thing', 'The free folk meet at the thing-stone each year: crime falls 20%, and relations warm 20% faster.', { isles: ['rime'], fx: { crime: 0.2, relations: 0.2 } }],
  r_sagas: ['society', 3, -2, ['r_thing'], 'book', 'The Sagas', 'Skalds who know every saga by heart: all study goes 20% faster.', { isles: ['rime'], fx: { study: 0.2 } }],
  r_drums: ['society', 3, 2.5, ['codex'], 'antler', 'Noaidi Drums', 'Drum-healers in every village: townsfolk wake with 2 extra health every morning.', { isles: ['rime'], fx: { heal: 2 } }],
  r_hearth_law: ['society', 5, -1, ['r_sagas'], 'campfire', 'Hearth Law', 'Nobody turned from a hearth in winter: 30% more children are born, and crime falls 20%.', { isles: ['rime'], fx: { births: 0.3, crime: 0.2 } }],
  r_longhouses: ['engineering', 2, 2, ['masonry'], 'log_frost', 'Longhouses', 'Great turf-roofed halls of frosted log: buildings go up 25% faster.', { isles: ['rime'], fx: { build: 0.25 } }],
  r_ice_cellars: ['engineering', 3, 2, ['mining'], 'frost_crystal', 'Ice Cellars', 'Food kept frozen in the ice: a famine takes 6 hungry days to set in (not 4), hunger stirs half the unrest, and farms keep 20% more.', { isles: ['rime'], excl: 'harvest', as: ['granaries'], fx: { farms: 0.2 } }],
  r_frost_iron: ['engineering', 4, 1.5, ['mining'], 'iron_ingot', 'Frost-Forged Iron', 'Iron quenched in snowmelt: armies are 10% stronger, and buildings go up 10% faster.', { isles: ['rime'], fx: { army: 0.1, build: 0.1 } }],
  r_aurora: ['engineering', 6, -1, ['fortress'], 'glass', 'The Aurora Stones', 'Stones raised to catch the northern lights: all study goes 25% faster, and every town defends 20% better.', { isles: ['rime'], big: true, fx: { study: 0.25, defence: 0.2 } }],
  // ------------------------------------------------ the Jade Court (Ostria)
  j_silk: ['economy', 1, 1, [], 'cloth', 'Silk Weaving', 'Silk sold to the whole world: every town banks ¤10 a week, and merchants come 20% more often.', { isles: ['jade'], fx: { income: 10, merchants: 0.2 } }],
  j_tea: ['economy', 2, 0, ['bookkeeping'], 'jasmine_tea', 'Tea Houses', 'A tea house in every town: merchants come 30% more often, and relations warm 20% faster.', { isles: ['jade'], fx: { merchants: 0.3, relations: 0.2 } }],
  j_porcelain: ['economy', 3, -2, ['guilds'], 'glass', 'Porcelain', 'Fine porcelain for every table in the world: every town banks ¤15 a week.', { isles: ['jade'], fx: { income: 15 } }],
  j_paper_money: ['economy', 5, 0, [['banking', 'monopolies']], 'paper', 'Paper Money', 'Notes of the imperial treasury: taxes bring in 25% more.', { isles: ['jade'], fx: { tax: 0.25 } }],
  j_grand_canal: ['economy', 6, 1.5, ['caravan_law'], 'water_bucket', 'The Grand Canal', 'A canal joining the realm\'s towns: merchants come 50% more often, travel is 30% faster, and every town banks ¤10 a week.', { isles: ['jade'], big: true, fx: { merchants: 0.5, travel: 0.3, income: 10 } }],
  j_art_of_war: ['warfare', 3, 2.5, ['muster'], 'scroll', 'The Art of War', 'Generals schooled in the classics: armies are 12% stronger, and levies 20% larger.', { isles: ['jade'], fx: { army: 0.12, muster: 0.2 } }],
  j_repeaters: ['warfare', 4, -0.5, [['shieldwall', 'greatweapons']], 'crossbow', 'Repeating Crossbows', 'Guards\' bows become crossbows that loose ten bolts a minute (damage 9): armies are 12% stronger.', { isles: ['jade'], excl: 'bows', as: ['crossbows'], fx: { army: 0.07 } }],
  j_fire_lances: ['warfare', 5, -1.5, ['j_repeaters'], 'dynamite', 'Fire Lances', 'Black powder packed in bamboo: armies are 15% stronger.', { isles: ['jade'], fx: { army: 0.15 } }],
  j_great_wall: ['warfare', 6, -1, ['siegecraft'], 'cobblestone', 'The Great Wall', 'Walls joined from town to town: every town of the realm defends 40% better against raids.', { isles: ['jade'], big: true, fx: { defence: 0.4 } }],
  j_exams: ['society', 2, 0, ['codex'], 'paper', 'Imperial Examinations', 'Officials chosen by examination: all study goes 20% faster, and crime falls 10%.', { isles: ['jade'], fx: { study: 0.2, crime: 0.1 } }],
  j_analects: ['society', 3, -2, ['j_exams'], 'book', 'The Analects', 'Duty to parents taught in every home: crime falls 25%, and 15% more children are born.', { isles: ['jade'], fx: { crime: 0.25, births: 0.15 } }],
  j_needles: ['society', 3, 2.5, ['alchemy'], 'herb', 'Needle and Herb', 'Acupuncture and the herbalists\' art: townsfolk wake with 2 extra health every morning.', { isles: ['jade'], fx: { heal: 2 } }],
  j_printing: ['society', 4, 2.5, ['j_exams'], 'scroll', 'Woodblock Printing', 'Books for every town: all study goes 30% faster.', { isles: ['jade'], fx: { study: 0.3 } }],
  j_mandate: ['society', 5, -1.5, ['j_analects'], 'gold_ingot', 'The Mandate of Heaven', 'The throne\'s right from heaven: relations warm 30% faster, and taxes bring in 10% more.', { isles: ['jade'], fx: { relations: 0.3, tax: 0.1 } }],
  j_paddies: ['engineering', 1, 0, [], 'wheat', 'Terraced Paddies', 'Rice grown on terraces up every hill: farms yield 40% more.', { isles: ['jade'], fx: { farms: 0.4 } }],
  j_compass: ['engineering', 3, 1, ['mining'], 'iron_ore', 'The South-Pointing Compass', 'A needle that always points south: merchants, letters, settlers and armies travel between towns 15% faster, and 10% faster again.', { isles: ['jade'], as: ['lodestones'], fx: { travel: 0.1 } }],
  j_pagodas: ['engineering', 4, 0.5, ['cranes'], 'roof_jade', 'Pagodas', 'Towers raised tier on tier: buildings go up 30% faster.', { isles: ['jade'], fx: { build: 0.3 } }],
  j_gunpowder: ['engineering', 5, 1.75, ['j_compass'], 'dynamite', 'Gunpowder', 'Black powder for mines and for war: armies are 10% stronger, and towns defend 10% better.', { isles: ['jade'], big: true, fx: { army: 0.1, defence: 0.1 } }],
  // ------------------------------------------------ the Keshari (Ostria)
  k_turquoise: ['economy', 1, 1, [], 'turquoise_tile', 'The Turquoise Trade', 'Turquoise dug and sold abroad: every town banks ¤12 a week.', { isles: ['kesh'], fx: { income: 12 } }],
  k_posts: ['economy', 2, 0, ['bookkeeping'], 'crate', 'Trading Posts', 'Posts where the trails meet: merchants come 40% more often.', { isles: ['kesh'], fx: { merchants: 0.4 } }],
  k_pottery: ['economy', 3, -2, ['guilds'], 'clay', 'Painted Pottery', 'Black-on-white pots traded far: every town banks ¤8 a week, and taxes bring in 10% more.', { isles: ['kesh'], fx: { income: 8, tax: 0.1 } }],
  k_trails: ['economy', 4, 2, ['caravan_law'], 'cobblestone', 'Canyon Trails', 'Hidden trails through the canyons: travel is 25% faster, and merchants come 20% more often.', { isles: ['kesh'], fx: { travel: 0.25, merchants: 0.2 } }],
  k_cliff_forts: ['warfare', 2, 0, ['drill'], 'red_rock', 'Cliff Forts', 'Towns with their backs to the cliffs: they defend 25% better against raids.', { isles: ['kesh'], fx: { defence: 0.25 } }],
  k_atlatls: ['warfare', 3, -2.5, ['archery'], 'spear', 'Atlatls', 'Spear-throwers that hurl twice as far: armies are 10% stronger.', { isles: ['kesh'], fx: { army: 0.1 } }],
  k_war_paint: ['warfare', 4, 2, ['muster'], 'cloth', 'War Paint', 'Warriors painted for war: armies are 8% stronger, and levies 25% larger.', { isles: ['kesh'], fx: { army: 0.08, muster: 0.25 } }],
  k_eagle_warriors: ['warfare', 5, -1.5, ['k_atlatls'], 'feather', 'Eagle Warriors', 'An order of the bravest, in feathered helms: armies are 15% stronger.', { isles: ['kesh'], fx: { army: 0.15 } }],
  k_kiva: ['society', 2, 0, ['codex'], 'campfire', 'The Kiva', 'Councils held underground: crime falls 20%.', { isles: ['kesh'], fx: { crime: 0.2 } }],
  k_star_lore: ['society', 3, -2, ['k_kiva'], 'glass', 'Star Lore', 'Sky-watchers on every mesa: all study goes 20% faster.', { isles: ['kesh'], fx: { study: 0.2 } }],
  k_sand_paintings: ['society', 3, 2.5, ['alchemy'], 'sand', 'Sand Paintings', 'Healers\' paintings in coloured sand: townsfolk wake with 2 extra health every morning.', { isles: ['kesh'], fx: { heal: 2 } }],
  k_clan_mothers: ['society', 4, 2.5, ['k_kiva'], 'prayer_beads', 'Clan Mothers', 'The clan mothers choose the chiefs: 25% more children are born, and relations warm 20% faster.', { isles: ['kesh'], fx: { births: 0.25, relations: 0.2 } }],
  k_adobe: ['engineering', 1, 0, [], 'adobe_red', 'Adobe', 'Sun-dried brick: buildings go up 30% faster.', { isles: ['kesh'], fx: { build: 0.3 } }],
  k_canals: ['engineering', 2, 2, ['masonry'], 'water_bucket', 'Desert Canals', 'Canals dug from the river: farms yield 45% more.', { isles: ['kesh'], fx: { farms: 0.45 } }],
  k_cliff_dwellings: ['engineering', 4, 1, ['k_canals'], 'red_rock', 'Cliff Dwellings', 'Whole towns carved into the canyon walls: buildings go up 20% faster, and towns defend 15% better.', { isles: ['kesh'], fx: { build: 0.2, defence: 0.15 } }],
  k_sun_dagger: ['engineering', 6, -1, ['fortress'], 'gold_ingot', 'The Sun Dagger', 'A calendar cut in light on the rock: all study goes 30% faster, and farms yield 20% more.', { isles: ['kesh'], big: true, fx: { study: 0.3, farms: 0.2 } }],
  // ------------------------------------------------ the isles' peoples
  c_whaling: ['economy', 2, 0, ['bookkeeping'], 'harpoon', 'Whaling', 'Whale oil and bone sold abroad: every town banks ¤15 a week.', { isles: ['corrow'], fx: { income: 15 } }],
  c_rendering: ['economy', 3, 2.5, ['markets'], 'barrel', 'Rendering Houses', 'Every scrap of the whale put to use: farms and the hunt bring in 30% more.', { isles: ['corrow'], fx: { farms: 0.3 } }],
  c_harpoons: ['warfare', 3, -2.5, ['archery'], 'harpoon', 'Barbed Harpoons', 'The watch carries whalers\' harpoons: armies are 12% stronger.', { isles: ['corrow'], fx: { army: 0.12 } }],
  c_sea_lore: ['society', 2, 0, ['codex'], 'fish_pie', 'Sea Lore', 'The old sailors\' lore: travel by sea is 20% faster, and townsfolk wake with 1 extra health every morning.', { isles: ['corrow'], fx: { travel: 0.2, heal: 1 } }],
  c_widows_walks: ['society', 4, 2.5, ['c_sea_lore'], 'lantern', 'Widows\' Walks', 'A watcher on every roof: towns defend 20% better, and crime falls 15%.', { isles: ['corrow'], fx: { defence: 0.2, crime: 0.15 } }],
  c_bone_halls: ['engineering', 2, 2, ['masonry'], 'whalebone', 'Whalebone Halls', 'Ribs for rafters: buildings go up 25% faster.', { isles: ['corrow'], fx: { build: 0.25 } }],
  s_salt_pans: ['economy', 1, 1, [], 'salt', 'Salt Pans', 'Salt raked and sold abroad: every town banks ¤14 a week.', { isles: ['salt'], fx: { income: 14 } }],
  s_banking_houses: ['economy', 4, 2, ['caravan_law'], 'coin', 'Banking Houses', 'Letters of credit honoured in every port: taxes bring in 20% more, and merchants come 30% more often.', { isles: ['salt'], fx: { tax: 0.2, merchants: 0.3 } }],
  s_galleys: ['warfare', 3, -2.5, ['archery'], 'raft', 'War Galleys', 'Oared galleys for the lagoons: armies are 10% stronger, and towns defend 10% better.', { isles: ['salt'], fx: { army: 0.1, defence: 0.1 } }],
  s_council: ['society', 2, 0, ['codex'], 'scroll', 'The Doge\'s Council', 'Merchant princes in council: taxes bring in 15% more, and relations warm 20% faster.', { isles: ['salt'], fx: { tax: 0.15, relations: 0.2 } }],
  s_tile_kilns: ['engineering', 2, 1.75, ['masonry'], 'tile_blue', 'Blue Tile Kilns', 'Glazed tile for every roof: buildings go up 20% faster, and every town sells tile for ¤6 a week.', { isles: ['salt'], fx: { build: 0.2, income: 6 } }],
  s_brine_curing: ['engineering', 3, 2.25, ['s_tile_kilns'], 'salt_fish', 'Brine Curing', 'Fish and meat kept in salt: farms keep 25% more.', { isles: ['salt'], fx: { farms: 0.25 } }],
  h_smials: ['engineering', 1, 0, [], 'cob', 'Smials', 'Homes dug into the hills, round-doored and warm: buildings go up 30% faster, and townsfolk wake with 1 extra health every morning.', { isles: ['hollow'], fx: { build: 0.3, heal: 1 } }],
  h_lantern_gardens: ['engineering', 2, 2, ['masonry'], 'lantern_pod', 'Lantern Gardens', 'Lantern pods grown along every lane: farms yield 30% more, and crime falls 15%.', { isles: ['hollow'], fx: { farms: 0.3, crime: 0.15 } }],
  h_pipeweed: ['economy', 2, 0, ['bookkeeping'], 'herb', 'Pipeweed', 'The best leaf in the world, sold abroad: every town banks ¤12 a week, and merchants come 25% more often.', { isles: ['hollow'], fx: { income: 12, merchants: 0.25 } }],
  h_bounders: ['warfare', 2, 0, ['drill'], 'stick', 'The Bounders', 'Watchers walking the borders: towns defend 25% better against raids.', { isles: ['hollow'], fx: { defence: 0.25 } }],
  h_seven_meals: ['society', 2, 0, ['codex'], 'glowberry_tart', 'Seven Meals a Day', 'Plenty for everyone: 30% more children are born, and townsfolk wake with 1 extra health every morning.', { isles: ['hollow'], fx: { births: 0.3, heal: 1 } }],
  h_mathoms: ['society', 3, -2, ['h_seven_meals'], 'chest', 'The Mathom-House', 'Every town\'s oddments kept and studied: all study goes 15% faster, and relations warm 20% faster.', { isles: ['hollow'], fx: { study: 0.15, relations: 0.2 } }],
  w_ogham: ['society', 2, 0, ['codex'], 'standing_stone', 'Ogham', 'Writing cut in the edges of stones: all study goes 20% faster.', { isles: ['wyrd'], fx: { study: 0.2 } }],
  w_druids: ['society', 3, 2.5, ['alchemy'], 'herb', 'The Druids', 'Mistletoe cut at the full moon: townsfolk wake with 2 extra health every morning, and crime falls 15%.', { isles: ['wyrd'], fx: { heal: 2, crime: 0.15 } }],
  w_stone_circles: ['engineering', 2, 1.75, ['masonry'], 'standing_stone', 'Stone Circles', 'Rings raised to the solstice sun: farms yield 25% more, and study goes 10% faster.', { isles: ['wyrd'], fx: { farms: 0.25, study: 0.1 } }],
  w_fey_bargains: ['economy', 2, 0, ['bookkeeping'], 'gem', 'Bargains with the Hill', 'Trade with the fair folk, carefully: every town banks ¤12 a week.', { isles: ['wyrd'], fx: { income: 12 } }],
  w_fianna: ['warfare', 2, 0, ['drill'], 'sabre', 'The Fianna', 'Warrior bands trained from boyhood: armies are 12% stronger.', { isles: ['wyrd'], fx: { army: 0.12 } }],
  w_raven_lore: ['warfare', 3, 2.5, ['muster'], 'feather', 'Raven Lore', 'Ravens bring word of raiders on the way: towns defend 25% better.', { isles: ['wyrd'], fx: { defence: 0.25 } }],
  sk_haaf: ['economy', 1, 1, [], 'salt_fish', 'Haaf Fishing', 'Far out to the deep-sea banks in six-oared boats: farms and the catch bring in 35% more, and every town banks ¤6 a week.', { isles: ['skerry'], fx: { farms: 0.35, income: 6 } }],
  sk_wool: ['economy', 2, 0, ['bookkeeping'], 'cloth', 'Island Wool', 'Knitted wool, fine as lace, sold abroad: every town banks ¤12 a week.', { isles: ['skerry'], fx: { income: 12 } }],
  sk_beacons: ['warfare', 2, 0, ['drill'], 'torch', 'Beacon Chains', 'Fires lit from isle to isle at the sight of sails: towns defend 20% better, and levies are 20% larger.', { isles: ['skerry'], fx: { defence: 0.2, muster: 0.2 } }],
  sk_wreck_law: ['society', 2, 0, ['codex'], 'barrel', 'Wreck Law', 'What the sea brings in is shared: every town banks ¤6 a week, and crime falls 15%.', { isles: ['skerry'], fx: { income: 6, crime: 0.15 } }],
  sk_storm_lore: ['society', 3, 2.5, ['sk_wreck_law'], 'feather', 'Storm Lore', 'The weather read in the sky: travel is 20% faster, and townsfolk wake with 1 extra health every morning.', { isles: ['skerry'], fx: { travel: 0.2, heal: 1 } }],
  sk_brochs: ['engineering', 2, 1.75, ['masonry'], 'drystone', 'Brochs', 'Round towers of drystone by every shore: towns defend 30% better against raids.', { isles: ['skerry'], fx: { defence: 0.3 } }],
};

// The common steps each people never learns (it has its own way, or none),
// and where its tree puts others. (`prune`: a step that needed one of the
// dropped needs it no more.)
export const FAR_TREES = {
  velari: { drop: ['longbows', 'aqueducts', 'shieldwall', 'catapults'], move: { crossbows: { req: [['v_testudo', 'greatweapons']] } }, prune: true },
  rime: { drop: ['aqueducts', 'granaries', 'clemency', 'greatweapons'], move: { conscription: { req: ['ironlaw'] }, prison_labor: { req: ['ironlaw'] }, fortress: { req: ['cranes', 'r_ice_cellars'] } }, prune: true },
  jade: { drop: ['longbows', 'lodestones', 'crossbows'], move: { portals: { req: ['j_compass'] } }, prune: true },
  kesh: { drop: ['cavalry', 'wells'], move: { mills: { req: ['k_canals'], side: -1.5 }, steel: { req: ['fieldworks'] } }, prune: true },
  corrow: { drop: ['cavalry', 'mills', 'aqueducts', 'granaries', 'fortress', 'rams', 'catapults', 'portals'], move: { steel: { req: ['fieldworks'] } }, prune: true },
  salt: { drop: ['cavalry', 'mining', 'lodestones', 'portals', 'rams', 'catapults', 'longbows', 'fortress'], move: { steel: { req: ['fieldworks'] } }, prune: true },
  hollow: { drop: ['cavalry', 'greatweapons', 'rams', 'catapults', 'portals', 'conscription', 'prison_labor'], move: { steel: { req: ['fieldworks'] } }, prune: true },
  wyrd: { drop: ['cavalry', 'mining', 'lodestones', 'portals', 'rams', 'catapults', 'banking'], move: { steel: { req: ['fieldworks'] } }, prune: true },
  skerry: { drop: ['cavalry', 'mining', 'lodestones', 'portals', 'rams', 'catapults', 'aqueducts', 'free_trade'], move: { steel: { req: ['fieldworks'] } }, prune: true },
};
