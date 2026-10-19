// (Round 127) How each dish of the island is made, as a cookery book sets
// it down: what it serves, what it needs, the method step by step, and the
// cook's own word at the end. Fixed, like DISHES (see table.js): every
// cookery book agrees on what goes into a goulash, though not on much else.
//
// The models are the old household books: measures by the handful and the
// cup, a method that assumes a fire rather than an oven dial, and a cook
// who has made the dish a thousand times and has opinions about it.
export const RECIPES = {
  pottage: {
    serves: 'a household of six, for two days',
    needs: ['two cups of pearl barley, soaked overnight', 'a cup of dried peas', 'three leeks, washed and sliced', 'a knob of dripping or butter', 'a handful of whatever herbs the garden gives: parsley, thyme, a little sage', 'salt, and water to cover'],
    steps: ['Melt the dripping in the pot and soften the leeks in it, slowly, without letting them brown.', 'Add the barley and the peas, cover them well with water, and bring the pot to the boil.', 'Draw it to the back of the hearth, where it will barely tremble, and leave it there the whole day.', 'Stir it whenever you pass, and add water if it grows too thick to stir.', 'Season it at the last, throw in the chopped herbs, and serve it with brown bread.'],
    tip: 'A pottage is never finished, only eaten. What is left at night goes back on the fire in the morning, and is better for it.',
  },
  apple_tart: {
    serves: 'eight, or four at a feast',
    needs: ['six good apples, sharp rather than sweet', 'two cups of flour', 'half a cup of cold butter', 'a little honey', 'a pinch of salt, and cold water'],
    steps: ['Rub the butter into the flour and salt with cold fingers until it is like breadcrumbs, then bind it with as little water as will hold it.', 'Rest the pastry in a cool place while you peel, core and slice the apples thin.', 'Roll out the pastry, line a dish with it, and lay the apples over it in rings, each overlapping the last.', 'Drizzle the honey over, and bake the tart in the bread oven once the loaves are out.', 'It is done when the pastry is golden and the apples are soft at the edges and just browned.'],
    tip: 'Cold hands make good pastry. If yours are warm, run them under the pump first.',
  },
  chowder: {
    serves: 'a boat\'s crew, or six at home',
    needs: ['two pounds of cod or haddock, skinned and boned', 'three onions, sliced', 'a jug of milk', 'four ship\'s biscuits, crushed', 'a piece of salt pork the size of your palm', 'pepper'],
    steps: ['Cut the salt pork small and fry it in the pot until the fat runs.', 'Add the onions and cook them soft in the fat.', 'Lay the fish on top in pieces, pour over water just to cover, and simmer until the fish flakes.', 'Stir in the crushed biscuit to thicken it, then the milk, and heat it through without letting it boil.', 'Season it with plenty of pepper, and serve it hot.'],
    tip: 'Never let a chowder boil once the milk is in, or it will curdle, and the cook will be blamed.',
  },
  smoked_fish: {
    serves: 'a household through the winter',
    needs: ['a basket of fresh herring', 'coarse salt', 'oak chips and a few juniper branches', 'a smokehouse, or a barrel with a fire pit beneath it'],
    steps: ['Split the herring down the back, clean them, and leave the heads on to hang them by.', 'Lay them in salt overnight, then rinse them and let them dry in the wind until the skins are tacky.', 'Hang them in the smokehouse, well apart, over a fire of oak chips kept smouldering, never blazing.', 'Feed the fire juniper now and then, and keep it going three days.', 'They are done when the flesh is gold and as dry as leather. Store them hung up, in a dry place.'],
    tip: 'Flame cooks a fish; smoke keeps it. If you see flame, throw on wet chips.',
  },
  spiced_lentils: {
    serves: 'six',
    needs: ['two cups of red lentils, washed', 'an onion, chopped fine', 'a spoonful each of cumin and coriander seed', 'a pinch of saffron, steeped in a little warm water', 'oil, salt, and water'],
    steps: ['Toast the cumin and coriander in a dry pan until they smell, then grind them.', 'Soften the onion in oil in a clay pot, and stir in the ground spices.', 'Add the lentils and water to cover them by a finger\'s width, and the saffron with its water.', 'Cover the pot and bury it in the embers, and leave it the length of the afternoon.', 'Stir it, salt it, and serve it with warm flatbread when the heat of the day has gone.'],
    tip: 'Lentils drink water as a camel does. Look in the pot once, at least, and give them more.',
  },
  flatbread: {
    serves: 'a family at one meal',
    needs: ['four cups of flour', 'a little salt', 'warm water', 'a clay oven, very hot'],
    steps: ['Mix the flour and salt with enough warm water to make a soft dough, and knead it until it is smooth.', 'Cover it and let it rest while the oven heats.', 'Pull off pieces the size of an egg, and pat each one out thin between your palms.', 'Slap each round against the hot inside wall of the oven, where it will stick.', 'Peel it off when it blisters and browns, and eat it warm, with dates and soft cheese.'],
    tip: 'The first bread is always for the guest at the door, and the second for the cook.',
  },
  tamales: {
    serves: 'a feast',
    needs: ['a basket of dried maize husks, soaked soft', 'maize dough, made with lard and a little broth', 'a filling of beans, squash or stewed meat', 'chili, to taste'],
    steps: ['Spread a spoonful of dough thin over each husk, leaving the edges bare.', 'Lay a little filling down the middle, and fold the husk around it, sides first, then the tail.', 'Stand the tamales upright in a basket over a pot of boiling water, packed close.', 'Cover them, and steam them until the dough comes away clean from the husk.', 'Unwrap them at the table, and drink hot cocoa with them.'],
    tip: 'Tamales are made by the hundred, and by everyone in the house; the gossip is part of the recipe.',
  },
  cocoa: {
    serves: 'as many cups as you have',
    needs: ['a handful of cocoa beans, roasted', 'a small dried chili', 'hot water', 'honey, if you are soft'],
    steps: ['Crack and winnow the roasted beans, and grind them on the stone to a dark paste.', 'Grind the chili with them.', 'Beat the paste with hot water until it is smooth.', 'Pour it from a height, from one cup into another and back, until a thick froth stands on it.', 'Drink it at once, while the froth holds.'],
    tip: 'A cup of cocoa without froth is an insult in some houses, and an accident in others.',
  },
  goulash: {
    serves: 'a mining crew',
    needs: ['three pounds of beef, cut in pieces', 'as many onions as there are pounds of beef, and one more', 'two spoonfuls of ground paprika', 'a spoonful of caraway seed', 'lard, salt, and water'],
    steps: ['Melt the lard in an iron kettle and cook the onions in it slowly until they are soft and golden.', 'Take the kettle off the heat and stir in the paprika, so it does not scorch.', 'Add the beef and the caraway, stir it all together, and put the kettle back over the fire.', 'Pour in water just to cover, and let it cook gently for half a day.', 'Salt it at the end. It is done when the meat breaks under a spoon and the gravy is red and thick.'],
    tip: 'Paprika burns in a moment and turns bitter, and no amount of meat will hide it. Off the fire, always.',
  },
  oatcakes: {
    serves: 'a pocketful each, for a crew',
    needs: ['two cups of oatmeal', 'a pinch of salt', 'a spoonful of melted dripping', 'hot water'],
    steps: ['Mix the oatmeal and salt, and pour in the dripping.', 'Add hot water a little at a time, until it holds together as a stiff dough.', 'Knead it quickly, roll it out thin, and cut it into rounds or wedges.', 'Bake them on the griddle stone over a steady fire, turning once, until they are dry and just coloured.'],
    tip: 'Work fast: oat dough stiffens as it cools, and then it cracks.',
  },
  pepper_stew: {
    serves: 'six, or three with something to prove',
    needs: ['two pounds of meat, goat or mutton, cut small', 'two cups of beans, soaked', 'a handful of fire-peppers, as many as you dare', 'an onion', 'salt'],
    steps: ['Brown the meat in the pot with the onion.', 'Add the beans and the peppers, whole or broken, and water to cover.', 'Set the pot over a steam vent, or at the back of the hearth, and leave it all day.', 'Taste it before you salt it, and taste it carefully.'],
    tip: 'Break the peppers for heat, leave them whole for flavour. Fish them out before serving guests, unless you dislike the guests.',
  },
  ash_bread: {
    serves: 'a family, for a day',
    needs: ['four cups of coarse flour', 'salt', 'water', 'a hearth with a good bed of hot ash'],
    steps: ['Make a stiff dough of the flour, salt and water, and shape it into a round loaf.', 'Rake open the ash, lay the loaf in it, and cover it over with ash and embers.', 'Leave it overnight.', 'Dig it out in the morning black on the outside, knock it on the hearthstone, and brush it clean.'],
    tip: 'The black crust is not burnt, only dressed. Brush it, do not cut it off.',
  },
  mushroom_broth: {
    serves: 'four',
    needs: ['two handfuls of marsh mushrooms, wiped, not washed', 'four cloves of wild garlic, or a handful of its leaves', 'a little butter', 'clear water and salt'],
    steps: ['Slice the mushrooms and soften them gently in the butter with the garlic.', 'Pour over water and bring it just to a simmer.', 'Keep it there, trembling and never boiling, for as long as it takes to say the evening prayers twice.', 'Salt it, and serve it clear.'],
    tip: 'Boil a mushroom broth and you will have mushroom water. Keep the fire low and your patience high.',
  },
  glowcap_tea: {
    serves: 'one, before sleep',
    needs: ['three dried glowcaps', 'a cup of water, just off the boil'],
    steps: ['Crumble the glowcaps into the cup.', 'Pour over water just off the boil, never boiling.', 'Cover the cup with a saucer, and let it steep until the tea begins to glow.', 'Drink it in the dark, to see it at its best.'],
    tip: 'Two cups bring good dreams. Three bring dreams you will want to tell people about, and they will not want to hear.',
  },
  crab_boil: {
    serves: 'a whole village after a good catch',
    needs: ['crabs and shellfish, as many as were caught', 'a basket of sweet roots, scrubbed', 'sea salt', 'limes, halved', 'a great pot and a fire on the beach'],
    steps: ['Fill the pot with sea water, and bring it to a rolling boil over the beach fire.', 'Put in the roots first, for they take longest.', 'When the roots are nearly soft, add the crabs and the shellfish and the limes.', 'Boil until the shells are red and the mussels open.', 'Tip it all out onto broad leaves laid on the sand, and let everyone help themselves.'],
    tip: 'Throw away any shell that will not open. The sea keeps some secrets for a reason.',
  },
  kelp_cakes: {
    serves: 'six',
    needs: ['a basket of fresh kelp, rinsed of sand', 'two cups of root flour', 'salt', 'palm oil, for frying'],
    steps: ['Pound the kelp to a paste in the mortar.', 'Work in the root flour and a little salt until it holds together.', 'Shape it into small flat cakes.', 'Fry them in hot palm oil until they crackle and turn brown at the edges.'],
    tip: 'The oil is hot enough when a pinch of flour dances in it.',
  },
  olive_bread: {
    serves: 'a household at the midday meal',
    needs: ['five cups of white flour', 'a cup of sourdough leaven', 'a handful of black olives, stoned', 'a little oil and salt', 'warm water'],
    steps: ['Mix the flour, leaven, salt and oil with warm water to a soft dough, and knead it well.', 'Let it rise in a warm place until it has doubled.', 'Knock it back, work in the olives, and shape it into a round.', 'Let it rise again, then bake it in a hot oven until it sounds hollow when tapped.', 'Serve it with dried figs.'],
    tip: 'Stone the olives yourself, and count the stones. A guest who finds one will remember it longer than the bread.',
  },
  garum_stew: {
    serves: 'six, lying down if you are rich enough',
    needs: ['two pounds of firm white fish', 'a handful of herbs: lovage, mint and coriander', 'a cup of wine', 'a spoonful of garum', 'oil and pepper'],
    steps: ['Cut the fish in pieces and lay them in a pot with the oil and the herbs.', 'Pour over the wine and enough water to cover.', 'Simmer it slowly until the fish is just done.', 'Stir in the garum at the very last, off the heat, and season it with pepper.'],
    tip: 'Garum is a seasoning, not an ingredient. Too much and the whole house will know.',
  },
  reindeer_roast: {
    serves: 'a hall on a feast night',
    needs: ['a haunch of reindeer', 'salt and crushed juniper berries', 'a fire of birch logs, burned down to embers', 'a spit'],
    steps: ['Rub the haunch all over with salt and juniper, and let it rest a night in the cold.', 'Spit it, and set it over the birch embers, high enough that the fat does not flare.', 'Turn it steadily for half a day, basting it with its own drippings.', 'Rest it before carving, and serve it with cloudberry cakes and birch mead.'],
    tip: 'Birch gives the sweetest smoke. Pine will make the meat taste of a forest fire.',
  },
  cloudberry_cakes: {
    serves: 'a dozen small cakes',
    needs: ['a cup of cloudberries, picked ripe', 'two cups of flour', 'an egg', 'a little honey and butter', 'milk'],
    steps: ['Beat the egg with the honey and enough milk to make a thick batter with the flour.', 'Fold in the cloudberries gently, so they do not break.', 'Drop spoonfuls onto a buttered griddle over a low fire.', 'Turn them once, when the tops are set.'],
    tip: 'The berries are ready when they turn from red to gold. Pick them red and the cakes will be sour.',
  },
  dumplings: {
    serves: 'a family gathering',
    needs: ['a pound of minced pork', 'a thumb of ginger, grated', 'a handful of greens, chopped fine', 'wheat dough, rolled thin and cut in rounds', 'a little salt and oil'],
    steps: ['Mix the pork, ginger, greens and salt well together.', 'Put a spoonful of the filling on each round of dough.', 'Fold the dough over and pleat the edges shut, pinching as you go.', 'Steam them in bamboo baskets stacked over boiling water, until the dough is clear.', 'Serve them with jasmine tea.'],
    tip: 'Count the pleats: a good cook makes eighteen. A hungry one makes three.',
  },
  jasmine_tea: {
    serves: 'one, three times over',
    needs: ['a pinch of green tea scented with jasmine', 'water, hot but not boiling'],
    steps: ['Warm the pot and the cup.', 'Put in the tea and pour over the water, and pour it off again at once, to wake the leaves.', 'Fill the pot again, and let it stand only as long as it takes to breathe deeply ten times.', 'Pour it, and fill the pot again for the second steeping, and the third.'],
    tip: 'The first cup is for the nose, the second for the mouth, and the third for conversation.',
  },
  chili_squash: {
    serves: 'six, after the harvest',
    needs: ['a large squash, peeled and cut in pieces', 'three ears of sweet corn, the kernels cut off', 'two dried chilies', 'an onion', 'salt'],
    steps: ['Soften the onion in the clay pot with a little fat.', 'Add the squash, the corn and the chilies, crumbled.', 'Add a little water, cover the pot, and set it in the outdoor oven.', 'Cook it until the squash falls apart at a touch, and serve it with blue corn cakes.'],
    tip: 'Squash gives its own water as it cooks. Add less than you think.',
  },
  blue_corn_cakes: {
    serves: 'a family, at every meal',
    needs: ['two cups of blue corn meal', 'a pinch of ash or lime, to brighten the colour', 'salt', 'warm water'],
    steps: ['Mix the meal, ash and salt, and add warm water until the batter is thin.', 'Heat the flat stone until a drop of water skips across it.', 'Pour the batter on thin and spread it with the palm.', 'Lift it off when it is dry, and stack the cakes as you go.'],
    tip: 'The ash turns the cakes a deeper blue. Too much turns them grey, and bitter.',
  },
  whale_stew: {
    serves: 'the whole strand',
    needs: ['whale meat and blubber, as much as the pot will take', 'a sack of oats', 'seaweed, washed and chopped', 'salt, and fresh water'],
    steps: ['Cut the meat and blubber in pieces, and render some of the blubber in the great pot of the hall.', 'Brown the meat in it.', 'Add water, the seaweed and the oats, and bring it to the boil.', 'Simmer it until it is thick enough to stand a spoon in, and serve it with oat bannocks and a dram of peat whisky.'],
    tip: 'A whale is a gift of the sea, and every house on the strand has a share of it. The stew is the share of those who cannot cut their own.',
  },
  oat_bannock: {
    serves: 'one round, cut in four',
    needs: ['two cups of oatmeal', 'a pinch of salt and a pinch of soda', 'a spoonful of butter or dripping', 'buttermilk'],
    steps: ['Mix the dry things together, and rub in the butter.', 'Stir in enough buttermilk to make a soft dough.', 'Pat it out into a round a finger thick, and cut it across into four.', 'Bake it on the girdle over the peat fire, turning once, until it is firm.'],
    tip: 'Never cut a bannock with a knife once it is baked; break it with your hands, as your grandmother did.',
  },
  shrimp_soup: {
    serves: 'four, on a hot afternoon',
    needs: ['a basket of pink lagoon shrimp', 'two limes', 'a little ground pepper', 'salt, and water'],
    steps: ['Bring a pot of salted water to the boil.', 'Throw in the shrimp and boil them only until they curl and turn pink.', 'Squeeze in the limes, add pepper, and take the pot off the fire at once.', 'Eat it as soon as it is cool enough to hold.'],
    tip: 'A shrimp overcooked is a shrimp wasted. Count to sixty, and no more.',
  },
  salt_fish: {
    serves: 'a household, when the boats cannot go out',
    needs: ['fish, split and cleaned', 'salt from the flats, in plenty', 'sun, and patience'],
    steps: ['Pack the fish in layers of salt in a barrel, and leave it a week.', 'Take it out, rinse it, and lay it on racks in the sun to dry hard.', 'Store it in a dry place.', 'To cook it, soak it overnight in fresh water, changing the water twice, and then boil it with roots.'],
    tip: 'The soaking is the whole art. Too little and you will drink the well dry.',
  },
  root_stew: {
    serves: 'a warren family',
    needs: ['a basket of pale hollow roots, scrubbed', 'a handful of cave mushrooms', 'a little fat and salt', 'water'],
    steps: ['Cut the roots in pieces, and slice the mushrooms.', 'Brown them a little in the fat in a small pot.', 'Add water to cover, and cook them over a small, clean fire.', 'Salt it when the roots are soft.'],
    tip: 'Keep the fire small and dry: smoke has nowhere to go underground, and neither will you.',
  },
  glowberry_tart: {
    serves: 'a feast table',
    needs: ['two cups of glowberries', 'pastry for a tart', 'a little honey', 'a beaten egg, for the top'],
    steps: ['Line a dish with half the pastry and fill it with the berries and honey.', 'Cover it with the rest of the pastry and seal the edges.', 'Brush it with egg and bake it in the stone oven until golden.', 'Bring it to the table whole, and cut it there, with the lamps turned down.'],
    tip: 'The berries shine brightest the moment the crust is broken. Do not waste it in the kitchen.',
  },
  seer_stew: {
    serves: 'the seers and their guests',
    needs: ['mutton, cut small', 'roots of the season', 'bitter herbs, which the seers will not name', 'salt and water'],
    steps: ['The seers make it themselves, behind a closed door.', 'What can be said is that it cooks all day, that it smells of the hills, and that the herbs go in last.', 'It is eaten on the long nights before a rune-reading, with heather bread and aurora mead.'],
    tip: 'Do not ask what is in it. Everyone asks, and nobody has ever been told.',
  },
  heather_bread: {
    serves: 'a household at every meal',
    needs: ['four cups of flour', 'a cup of leaven', 'two spoonfuls of heather honey', 'salt and warm water'],
    steps: ['Dissolve the honey in warm water and mix it with the flour, leaven and salt.', 'Knead it smooth, and let it rise by the hearth.', 'Shape it into a round, and bake it on the hearthstone under an upturned pot heaped with embers.'],
    tip: 'Heather honey is thick and will not pour. Warm the jar by the fire first.',
  },
  fish_pie: {
    serves: 'six, when the boats come in',
    needs: ['two pounds of white fish', 'three onions, sliced', 'a jug of milk', 'butter and flour, for the sauce', 'pastry or mashed roots, for the crust'],
    steps: ['Poach the fish gently in the milk, then lift it out and flake it.', 'Make a sauce of the butter, flour and the milk the fish was cooked in.', 'Lay the fish and onions in a dish, and pour the sauce over.', 'Cover it with the crust, and bake it in the peat oven until it is brown on top.'],
    tip: 'Keep the milk the fish was poached in. Throwing it away is throwing away the pie.',
  },
  seaweed_crisps: {
    serves: 'a long evening',
    needs: ['sheets of seaweed, washed and dried', 'coarse salt'],
    steps: ['Lay the seaweed flat on a hot stone by the fire.', 'Turn it once, as soon as it darkens and begins to curl.', 'Salt it while it is still warm.'],
    tip: 'It goes from crisp to burnt in a breath. Watch it, and do not talk while you do.',
  },
};
