// (Round 127) How each dish of the island is made, as a cookery book sets
// it down: what it serves, the method step by step, and the cook's own
// word at the end. Fixed, like DISHES (see table.js): every cookery book
// agrees on what goes into a goulash, though not on much else.
//
// (Round 128) What goes in is the game's own: the list a book gives is
// world/recipes.js DISH_RECIPES, the very things a furnace's pot (or a
// baker's oven) takes to make it, and the method uses those and nothing
// else. The voice is still the old household books': a cook who has made
// the dish a thousand times and has opinions about it.
export const RECIPES = {
  pottage: {
    serves: 'a household of six, for two days',
    steps: ['Rub the wheat from its husks between your palms, and set the grain to soak while you see to the rest.', 'Shred the cabbage fine and put it in the pot with the grain, with water to cover them both.', 'Bring it to the boil, then draw it to where it will barely tremble, and leave it there the whole day.', 'Tear in the herbs at the last, and serve it thick enough to stand a spoon in.'],
    tip: 'A pottage is never finished, only eaten. What is left at night goes back on the fire in the morning, and is better for it.',
  },
  apple_tart: {
    serves: 'eight, or four at a feast',
    steps: ['Make a stiff pastry of the flour and a little cold water, and rest it somewhere cool.', 'Peel, core and slice the apples thin while it rests.', 'Line the dish with the pastry and lay the apples over it in rings, each overlapping the last.', 'Warm the honeycomb until the honey runs, pour it over, and bake the tart until the pastry is golden.'],
    tip: 'Cold hands make good pastry. If yours are warm, run them under the pump first.',
  },
  chowder: {
    serves: 'a boat\'s crew, or six at home',
    steps: ['Clean the fish and cut them in pieces, skin and all.', 'Shred the cabbage and soften it in the pot with a little water.', 'Lay the fish on top, cover it with water, and simmer it until the flesh flakes from the bone.', 'Crumble the bread in to thicken it, stir it well, and serve it hot.'],
    tip: 'Never let a chowder boil hard once the bread is in, or it will catch, and the cook will be blamed.',
  },
  smoked_fish: {
    serves: 'a household through the winter',
    steps: ['Split the fish down the back and clean them, leaving the heads on to hang them by.', 'Rub them well with the salt and leave them overnight.', 'Hang them high over a fire kept smouldering, never blazing, and leave them there three days.', 'They are done when the flesh is gold and as dry as leather. Store them hung up, in a dry place.'],
    tip: 'Flame cooks a fish; smoke keeps it. If you see flame, throw on wet chips.',
  },
  spiced_lentils: {
    serves: 'six',
    steps: ['Pick over the seeds for grit, and wash them twice.', 'Put them in the pot with the herbs and water to cover them by a finger\'s width.', 'Cover the pot, set it in the embers, and leave it the length of the afternoon.', 'Stir in the salt at the last, never before, and serve it when the heat of the day has gone.'],
    tip: 'Seeds drink water as a camel does. Look in the pot once, at least, and give them more.',
  },
  flatbread: {
    serves: 'a family at one meal',
    steps: ['Mix the flour with enough warm water to make a soft dough, and knead it until it is smooth.', 'Cover it and let it rest while the oven heats.', 'Pat out rounds the size of your hand, thin, and bake them against the hottest part of the oven until they blister.', 'Eat them warm, with the berries crushed over.'],
    tip: 'The first bread is always for the guest at the door, and the second for the cook.',
  },
  tamales: {
    serves: 'a feast',
    steps: ['Grind the wheat and work it into a stiff dough with a little water.', 'Stew the meat with the pumpkin, cut small, until both fall apart at a touch.', 'Wrap a spoonful of the stew in a jacket of dough, and pack the parcels close in the pot.', 'Steam them, covered, until the dough comes away clean.'],
    tip: 'Tamales are made by the hundred, and by everyone in the house; the gossip is part of the recipe.',
  },
  cocoa: {
    serves: 'as many cups as you have',
    steps: ['Crack the coconut, pour what is inside it into the pot, and scrape in the white flesh too.', 'Break the ember pod and put in only the seeds of it.', 'Warm it slowly with the honeycomb until the honey melts into it.', 'Pour it from a height, from one cup into another and back, until a froth stands on it, and drink it at once.'],
    tip: 'A cup of cocoa without froth is an insult in some houses, and an accident in others.',
  },
  goulash: {
    serves: 'a mining crew',
    steps: ['Cut the meat into pieces the size of a walnut and brown them in the pot in their own fat.', 'Add the carrot, cut in rounds, and water to cover.', 'Put the lid on and let it stew the whole afternoon, until the meat falls apart.', 'Stir in the herbs off the fire, and serve it with plenty of bread.'],
    tip: 'Herbs burn in a moment and turn bitter, and no amount of meat will hide it. Off the fire, always.',
  },
  oatcakes: {
    serves: 'a pocketful each, for a crew',
    steps: ['Thresh the wheat and grind it coarse.', 'Mix it with the salt and as much hot water as will bind it.', 'Roll it out thin, quickly, and cut it into rounds.', 'Bake them slowly until they curl at the edges.'],
    tip: 'Work fast: the dough stiffens as it cools, and then it cracks.',
  },
  pepper_stew: {
    serves: 'six, or three with something to prove',
    steps: ['Brown the meat in the pot.', 'Add the carrot, and water to cover.', 'Drop in the ember pods, whole or broken as you dare.', 'Stew it slow until the meat is tender and the broth has gone red.'],
    tip: 'Break the pods for heat, leave them whole for flavour. Fish them out before serving guests, unless you dislike the guests.',
  },
  ash_bread: {
    serves: 'a family, for a day',
    steps: ['Mix the flour and the salt with enough water for a firm dough.', 'Knead it until it is smooth, and shape it into a low round loaf.', 'Bake it in the hot ash of the oven floor, covered with more ash.', 'Brush the ash off when it sounds hollow underneath.'],
    tip: 'The black crust is not burnt, only dressed. Brush it, do not cut it off.',
  },
  mushroom_broth: {
    serves: 'four',
    steps: ['Wipe the mushrooms clean; never wash them.', 'Slice them, with the glowcap, and put them in the pot with cold water.', 'Bring it up slowly, and keep it just below the boil for an hour.', 'Strain it, or do not; the Mirefolk never do.'],
    tip: 'Boil a mushroom broth and you will have mushroom water. Keep the fire low and your patience high.',
  },
  glowcap_tea: {
    serves: 'one, before sleep',
    steps: ['Slice the glowcap thin.', 'Pour water just off the boil over it, and cover the cup.', 'Let it stand until the water glows faintly, then drink it warm.'],
    tip: 'Two cups bring good dreams. Three bring dreams you will want to tell people about, and they will not want to hear.',
  },
  crab_boil: {
    serves: 'a whole village after a good catch',
    steps: ['Fill the pot with water, put in the salt, and bring it to a rolling boil.', 'Lay the kelp in the bottom.', 'Put in the crab meat and boil it until it turns white through.', 'Tip it all out on the table and let everyone help themselves.'],
    tip: 'Throw away any crab that smells of anything but the sea. The sea keeps some secrets for a reason.',
  },
  kelp_cakes: {
    serves: 'six',
    steps: ['Wash the kelp well in fresh water, and chop it fine.', 'Mix it with the flour and a little water to a thick batter.', 'Drop spoonfuls of it on a hot flat stone.', 'Turn them once, and eat them while they are crisp.'],
    tip: 'The stone is hot enough when a pinch of flour dances on it.',
  },
  olive_bread: {
    serves: 'a household at the midday meal',
    steps: ['Stone the olives and chop them roughly.', 'Work them into a dough of the flour and warm water.', 'Let it rise in a warm place for the morning.', 'Bake it until the crust is hard and golden.'],
    tip: 'Stone the olives yourself, and count the stones. A guest who finds one will remember it longer than the bread.',
  },
  garum_stew: {
    serves: 'six, lying down if you are rich enough',
    steps: ['Cut the fish into pieces.', 'Put them in the pot with the olives and water to cover.', 'Simmer it until the fish is just cooked.', 'Tear in the herbs, and serve it with bread.'],
    tip: 'Fish is the seasoning here as much as the meat of it. Too much and the whole house will know.',
  },
  reindeer_roast: {
    serves: 'a hall on a feast night',
    steps: ['Rub the meat with the herbs.', 'Roast it slowly over a low fire, turning it often.', 'Crush the berries in the drippings to make a sauce.', 'Let it rest before carving it.'],
    tip: 'Birch gives the sweetest smoke. Pine will make the meat taste of a forest fire.',
  },
  cloudberry_cakes: {
    serves: 'a dozen small cakes',
    steps: ['Mix the flour with a little water to a stiff dough.', 'Fold the berries in gently, so as not to break them.', 'Shape small rounds and bake them until golden.'],
    tip: 'The berries are ready when they turn from red to gold. Pick them red and the cakes will be sour.',
  },
  dumplings: {
    serves: 'a family gathering',
    steps: ['Make a smooth dough of the flour and water, and rest it.', 'Chop the meat and the cabbage fine together for the filling.', 'Roll out thin rounds, fill each one, and pleat them shut.', 'Steam them, covered, until the dough is clear.'],
    tip: 'Count the pleats: a good cook makes eighteen. A hungry one makes three.',
  },
  jasmine_tea: {
    serves: 'one, three times over',
    steps: ['Dry the daisies in the shade until they are papery.', 'Put them in the pot with a piece of the honeycomb.', 'Pour on water just off the boil, and let it stand a few breaths.', 'Pour it, and fill the pot again for the second cup, and the third.'],
    tip: 'The first cup is for the nose, the second for the mouth, and the third for conversation.',
  },
  chili_squash: {
    serves: 'six, after the harvest',
    steps: ['Cut the pumpkin into pieces and scrape out the seeds.', 'Put it in the pot with the ember pod, broken, and a little water.', 'Stew it until the pumpkin is soft.', 'Stir in the herbs and serve it.'],
    tip: 'Pumpkin gives its own water as it cooks. Add less than you think.',
  },
  blue_corn_cakes: {
    serves: 'a family, at every meal',
    steps: ['Grind the wheat fine.', 'Mash the cactus fruit and mix it in, with water to make a soft dough.', 'Pat out thin cakes.', 'Bake them on a hot stone until they puff.'],
    tip: 'The fruit turns the cakes a deeper colour. Too much turns them soggy.',
  },
  whale_stew: {
    serves: 'the whole strand',
    steps: ['Cut the meat into chunks.', 'Put it in the pot with the kelp, the salt and water to cover.', 'Stew it slowly all day.', 'Skim the fat as it rises, and save it for the lamps.'],
    tip: 'A whale is a gift of the sea, and every house on the strand has a share of it. The stew is the share of those who cannot cut their own.',
  },
  oat_bannock: {
    serves: 'one round, cut in four',
    steps: ['Grind the wheat coarse.', 'Melt the honeycomb and mix the honey in with a little hot water.', 'Pat it into a round as big as a plate.', 'Bake it until the top is firm, and mark it into four.'],
    tip: 'Never cut a bannock with a knife once it is baked; break it with your hands, as your grandmother did.',
  },
  shrimp_soup: {
    serves: 'four, on a hot afternoon',
    steps: ['Crack the coconut and pour what is inside it into the pot.', 'Cut the fish into small pieces and add them.', 'Warm it gently, then add the crab meat for the last moment only.', 'Serve it at once.'],
    tip: 'Crab overcooked is crab wasted. Count to sixty, and no more.',
  },
  salt_fish: {
    serves: 'a household, when the boats cannot go out',
    steps: ['Split and clean the fish.', 'Pack them in layers with the salt.', 'Leave them for a week, then dry them in the wind.', 'Soak them overnight before cooking.'],
    tip: 'The soaking is the whole art. Too little and you will drink the well dry.',
  },
  root_stew: {
    serves: 'a warren family',
    steps: ['Scrub the carrots and cut them up.', 'Put them in the pot with the mushroom and the glowcap.', 'Stew it slowly over a small fire.', 'Serve it in the bowl you ate the last one from.'],
    tip: 'Keep the fire small and dry: smoke has nowhere to go underground, and neither will you.',
  },
  glowberry_tart: {
    serves: 'a feast table',
    steps: ['Make pastry of the flour and cold water.', 'Line a dish with it.', 'Fill it with the glowberries.', 'Bake it until the crust is golden.'],
    tip: 'The berries shine brightest the moment the crust is broken. Do not waste it in the kitchen.',
  },
  seer_stew: {
    serves: 'the seers and their guests',
    steps: ['Cut the fish and the mushroom small.', 'Put them in the pot with the herbs.', 'Stew it slowly, stirring always the same way round.', 'Serve it in silence.'],
    tip: 'Do not ask what is in it. Everyone asks, and the seers will only say that it is fish, mushroom and herbs, which nobody believes.',
  },
  heather_bread: {
    serves: 'a household at every meal',
    steps: ['Mix the flour with warm water.', 'Knead the herbs into it.', 'Let it rise in a warm place.', 'Bake it until it sounds hollow.'],
    tip: 'The herbs are best picked the morning you bake. A day old and the bread will only smell of them.',
  },
  fish_pie: {
    serves: 'six, when the boats come in',
    steps: ['Poach the fish and flake it.', 'Cut the carrot small and mix it in.', 'Make pastry of the flour, and cover the pie with it.', 'Bake it until the crust is golden.'],
    tip: 'Keep the water the fish was poached in, and wet the filling with it. Throwing it away is throwing away the pie.',
  },
  seaweed_crisps: {
    serves: 'a long evening',
    steps: ['Wash the kelp and dry it well.', 'Brush it with the fish oil and sprinkle it with the salt.', 'Toast it over the fire until crisp.'],
    tip: 'It goes from crisp to burnt in a breath. Watch it, and do not talk while you do.',
  },
};
