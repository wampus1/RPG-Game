// (Round 126; rewritten Round 127) A people's table: what they eat and
// drink, how it's made, when it's eaten, and what the faithful among them
// won't touch. Each dish has its headnote (what it is, where it comes
// from, what the cook thinks of it), then what it needs and the method
// (see recipes.js), as the old household books set them out. What each
// dish and drink is (DISHES, DRINKS) is fixed: the same in every book, so
// two cookery books never disagree about what goes into a goulash. See
// annals.js for how these are written.
export const DISHES = {
  pottage: { what: 'a thick pottage of wheat and cabbage, with whatever herbs the garden gives', how: 'left to simmer all day at the back of the hearth, and stirred by whoever passes', when: 'eaten most days of the year, in poor houses and rich ones alike', with: 'a heel of brown bread' },
  apple_tart: { what: 'apples from the autumn orchards, sliced thin, laid in a crust and glazed with honey from the comb', how: 'baked in the bread oven once the loaves are out, while the oven is still hot', when: 'kept for feast days and for guests', with: 'a jug of cream' },
  chowder: { what: 'fish stewed with cabbage and thickened with bread', how: 'cooked in a great pot, on the boats as often as at home', when: 'eaten after every long day at sea', with: 'a horn of mead' },
  smoked_fish: { what: 'fish split open, salted, and hung high over a smouldering fire', how: 'smoked for three days, until the flesh is gold and as dry as leather', when: 'carried on every voyage, and eaten all through the winter', with: 'black bread and butter' },
  spiced_lentils: { what: 'small seeds stewed soft with herbs and a little salt', how: 'cooked slowly in a clay pot buried in the embers', when: 'eaten at the evening meal, when the heat of the day is gone', with: 'warm flatbread' },
  flatbread: { what: 'thin bread baked against the wall of a hot oven, eaten with crushed berries', how: 'baked a few at a time and eaten warm from the oven', when: 'eaten at every meal, and given to every guest at the door', with: 'dates and soft cheese' },
  tamales: { what: 'wheat dough wrapped around meat stewed with pumpkin', how: 'steamed by the basketful over boiling water', when: 'made by the hundred for feast days', with: 'a cup of hot cocoa' },
  cocoa: { what: 'the inside of a coconut warmed with honey and the seeds of an ember pod, and whipped until it froths', how: 'poured from a height, from one cup into another, to raise the froth', when: 'drunk morning and evening, and offered to the gods', with: 'a maize cake' },
  goulash: { what: 'meat and carrots stewed with herbs until the meat falls apart', how: 'cooked for half a day in an iron kettle hung over the forge fire', when: 'eaten after a long shift in the mines', with: 'oatcakes and a mug of dark beer' },
  oatcakes: { what: 'rough cakes of ground wheat and salt', how: 'baked on a griddle stone over the fire', when: 'carried down the mine in every pocket', with: 'a wedge of hard cheese' },
  pepper_stew: { what: 'meat and carrots stewed with the ember pods that grow on the warm slopes of the mountain', how: 'cooked in a pot set over a steam vent, and left all day', when: 'eaten on cold nights, and by anyone with something to prove', with: 'ash-baked bread' },
  ash_bread: { what: 'a heavy round loaf of flour and salt, baked in the hot ash of the hearth', how: 'buried in the embers overnight, dug out black, and brushed clean', when: 'eaten every day', with: 'a bowl of fire-pepper stew' },
  mushroom_broth: { what: 'a clear broth of mushrooms and glowcaps', how: 'simmered gently and never boiled, so the mushrooms keep their scent', when: 'eaten at the end of every day', with: 'a cup of glowcap tea' },
  glowcap_tea: { what: 'a tea of dried glowcaps, which glows faintly in the cup', how: 'steeped in water just off the boil', when: 'drunk before sleep, to bring good dreams', with: 'nothing at all' },
  crab_boil: { what: 'crab meat boiled together with kelp and sea salt', how: 'boiled in a great pot on the beach and tipped out onto broad leaves', when: 'eaten by the whole village together after a good catch', with: 'palm toddy' },
  kelp_cakes: { what: 'cakes of chopped kelp and flour', how: 'cooked on a hot flat stone until they crackle', when: 'eaten at every meal', with: 'a little crab meat' },
  olive_bread: { what: 'a white loaf studded with olives', how: 'baked in the great ovens of the town', when: 'eaten at the midday meal', with: 'a cup of spiced wine' },
  garum_stew: { what: 'fish stewed with olives and herbs', how: 'cooked slowly, with the herbs torn in at the last', when: 'eaten at the evening meal, lying down if you are rich enough', with: 'olive bread' },
  reindeer_roast: { what: 'a haunch of meat rubbed with herbs and roasted, with a sauce of crushed berries', how: 'turned over a low fire for half a day', when: 'eaten at the autumn slaughter and on feast nights', with: 'cloudberry cakes and birch mead' },
  cloudberry_cakes: { what: 'little cakes of flour and golden berries', how: 'baked on a griddle', when: 'made in late summer, when the berries are picked', with: 'birch mead' },
  dumplings: { what: 'thin dough folded around chopped meat and cabbage', how: 'steamed in towers of bamboo baskets', when: 'eaten at the turn of the year and at every family gathering', with: 'jasmine tea' },
  jasmine_tea: { what: 'a tea of dried daisies, sweetened with honey from the comb', how: 'steeped three times, each better than the last', when: 'drunk all day long', with: 'a plate of dumplings' },
  chili_squash: { what: 'pumpkin stewed with an ember pod and herbs', how: 'cooked in a clay pot in an outdoor oven', when: 'eaten after the harvest is in', with: 'blue corn cakes' },
  blue_corn_cakes: { what: 'thin cakes of ground wheat and cactus fruit', how: 'cooked on a hot flat stone', when: 'eaten at every meal', with: 'cactus tea' },
  whale_stew: { what: 'meat stewed all day with kelp and salt', how: 'boiled in the great pot of the hall', when: 'eaten when a whale is brought in, which is a feast for the whole strand', with: 'oat bannocks and a dram of peat whisky' },
  oat_bannock: { what: 'a flat round of ground wheat, sweetened with honey', how: 'baked on a girdle over the peat fire', when: 'eaten every day', with: 'butter, if there is any' },
  shrimp_soup: { what: 'fish and crab meat cooked quickly in the water of a coconut', how: 'cooked quickly, so the shrimp stay tender', when: 'eaten in the hot afternoons', with: 'a glass of lime cordial' },
  salt_fish: { what: 'fish packed in salt and dried in the wind', how: 'soaked overnight before it is cooked', when: 'eaten when the boats cannot go out', with: 'boiled roots' },
  root_stew: { what: 'carrots stewed with mushrooms and glowcaps', how: 'cooked slowly over a small fire, for the smoke must not fill the warren', when: 'eaten every day', with: 'a mug of mushroom ale' },
  glowberry_tart: { what: 'a tart of glowberries, which shine faintly when the crust is cut', how: 'baked in a stone oven', when: 'kept for feasts', with: 'mushroom ale' },
  seer_stew: { what: 'a stew of fish, mushrooms and bitter herbs said to bring visions', how: 'cooked by the seers themselves, who will not say what goes into it', when: 'eaten on the long nights before a rune-reading', with: 'heather bread and aurora mead' },
  heather_bread: { what: 'bread of flour kneaded with fresh herbs', how: 'baked on the hearthstone', when: 'eaten at every meal', with: 'a cup of aurora mead' },
  fish_pie: { what: 'fish and carrots under a crust', how: 'baked in a peat oven', when: 'eaten when the boats come in', with: 'a dram of peat whisky' },
  seaweed_crisps: { what: 'kelp brushed with fish oil and salt, toasted until it crackles', how: 'toasted on a hot stone by the fire', when: 'eaten by the fire on long evenings', with: 'peat whisky' },
};
export const DRINKS = {
  ale: 'brewed from barley malt in every inn and in many houses besides',
  mead: 'honey wine, brewed strong and drunk from horns',
  'mint tea': 'green tea poured over fresh mint, with a great deal of sugar',
  cocoa: 'cocoa whipped to a froth with water and chili',
  'dark beer': 'brewed black and thick in the deep cellars',
  'smoked spirit': 'a fierce spirit distilled from grain and smoked over ash-wood',
  'heather wine': 'wine made of heather flowers and honey',
  'palm toddy': 'the sap of the palm, left a day in the sun to ferment',
  'spiced wine': 'red wine warmed with honey and spices',
  'birch mead': 'mead brewed with the sap of the birch',
  'jasmine tea': 'green tea scented with jasmine flowers',
  'cactus tea': 'a tea of cactus flowers, sweet and a little sour',
  'peat whisky': 'whisky made over the smoke of a peat fire',
  'lime cordial': 'lime juice sweetened with cane sugar',
  'mushroom ale': 'ale brewed from mushrooms instead of barley',
  'aurora mead': 'mead brewed, they say, only under the northern lights',
};

export const FLOWS = {
  tableopen: [
    ['land', 'table', 'poor'],
    ['table', 'land', 'guest'],
    ['land', 'table', 'guest', 'poor'],
    ['memory', 'land', 'table'],
    ['memory', 'table', 'guest'],
  ],
  dish: [
    ['open', 'what', 'when', 'with'],
    ['what', 'when', 'remark'],
    ['open', 'what', 'remark'],
    ['what', 'how', 'when', 'remark'],
    ['open', 'what', 'when', 'remark'],
  ],
  drink: [
    ['what', 'where', 'remark'],
    ['what', 'remark', 'where'],
  ],
  forbid: [
    ['rule', 'why', 'stranger'],
    ['rule', 'stranger'],
  ],
  feastday: [
    ['feast', 'table', 'holy'],
    ['feast', 'holy', 'table'],
  ],
  abroad: [
    ['other', 'compare', 'end'],
    ['other', 'end'],
  ],
};

export const POOLS = {
  'tableopen.memory': [
    'The first thing I remember is the smell of my grandmother\'s kitchen, and I have been trying to get back to it ever since; this book is the record of the attempt.',
    'I learned to cook as most of the {people} do, by standing at the elbow of someone who would not explain anything, and watching.',
    'Most of what is in this book I was taught, and the rest I found out by getting it wrong, which is the more thorough method.',
  ],
  'tableopen.memory@plain': [
    'I have cooked for thirty years. These are the dishes I make.',
  ],
  'tableopen.memory@lyrical': [
    'Every dish of the {people} carries a season in it, and to eat one is to remember a time of year you may never have lived through.',
  ],
  'tableopen.land': [
    'The {people} live (among|in) {ground}, and (their|the) table (is|has always been) (shaped|made) by (it|the land) (as much as by|more than by) (any|their) (cook|cooks).',
    '(What|Whatever) {land} (gives|grows), the {people} (eat|cook), and (they|their cooks) (waste|throw away) (nothing|little) of it.',
    'It is the land that writes a people\'s cookery, and the cooks who copy it out; the land of the {people} is {ground}, and their food tastes of it.',
  ],
  'tableopen.table': [
    'Ask (any of the|one of the) {people} what they live on, and they will tell you: {cuisine}.',
    'The table of the {people} is {cuisine}, (and|with) {drink} to (wash it down|drink).',
    'Theirs is plain food, for the most part, made well: {cuisine}, and {drink} to go with it.',
  ],
  'tableopen.poor': [
    '(Rich|The rich) and (poor|the poor) (eat|share) the same dishes, (though|but) the (rich|well-off) (eat|have) more of them, and the poor make theirs go further.',
    'The best of it was invented by the poor, as the best cookery always is, and later claimed by the rich.',
  ],
  'tableopen.guest': [
    'A guest is fed before anyone (asks|thinks to ask) their (name|business), for sending a (stranger|guest) away hungry (is|would be) (a shame|shameful) among the {people}.',
  ],

  // ------------------------------------------------------------ a dish's headnote
  'dish.open': [
    'There is no dish more truly of the {people} than {dish}, and none they argue over more.',
    'If you cook only one thing from this book, let it be {dish}.',
    'Every household of the {people} makes {dish}, and no two make it alike.',
    'This is the dish I am asked for most often, and the one I am least able to explain.',
    'A cook is judged among the {people} by their {dish}, and a bride, they used to say, by her mother-in-law\'s opinion of it.',
  ],
  'dish.open@storyteller': [
    'I once watched two old neighbours stop speaking for a year over {dish}, and I am still not sure which of them was right.',
  ],
  'dish.open@scholar': [
    '{dish} is among the oldest dishes of the {people}, and the earliest accounts of it differ from the modern one chiefly in the quantity of salt.',
  ],
  'dish.open@pious': [
    'The {clergies} say that {god} gave the {people} {dish} in a hungry year, and I see no reason to doubt it.',
  ],
  'dish.open@lyrical': [
    'Made well, {dish} tastes of a kitchen on a winter evening, with the shutters closed and the fire drawing.',
  ],
  'dish.what': [
    '{dish} {be} {what}.',
    'The {dish} of the {people} {be} {what}.',
    'What the {people} call {dish} {be} {what}.',
    'At its simplest, {dish} {be} {what}; but simplicity, here as elsewhere, takes practice.',
  ],
  'dish.how': [
    '{they} {be} {how}.',
    'Properly made, {they} {be} {how}.',
    'The {people} (say|hold) that {they} must be {how}, and that (any|every) other way (spoils|ruins) {it}.',
  ],
  'dish.when': [
    '{they} {be} {when}.',
    '(Among|With) the {people}, {they} {be} {when}.',
    '{dish} {be} {when}, and (no one|nobody) (thinks|would think) it (strange|odd) to (have|eat) {it} twice in a day.',
  ],
  'dish.with': [
    '{they} {be} (best|eaten) with {with}.',
    '(Serve|Eat) {it} with {with}, (as|the way) the {people} do.',
  ],
  'dish.remark': [
    '(Every|Each) (cook|kitchen) (has|keeps) (a|their own) (way|secret) with {it}, and (every|each) one (swears|holds) (theirs|their own) (is|to be) the only (true|right) one.',
    '(Strangers|Travellers) (who|that) (try|taste) {it} (once|for the first time) (rarely|seldom) forget {it}, (for good or ill|one way or the other).',
    'The dish is older than the realm, the {people} (say|claim), and the recipe has hardly changed in all that time.',
    'I give the method as my mother gave it to me, with one small change of my own, which she would not have approved of.',
    'It is not difficult, but it will not be hurried, and a cook who tries will be found out.',
  ],
  'dish.remark@plain': [
    'It is not hard to make. Do not hurry it.',
  ],
  'dish.meatless': [
    'The faithful, who {taboo}, (make|cook) {it} without the meat, (and|but) (say|swear) (it is|{they} {be}) (none|no) the worse for it.',
  ],
  'dish.fishless': [
    'The faithful, who {taboo}, (make|cook) {it} (with roots|with beans) (in place of|instead of) the fish, (and|but) (say|swear) (it is|{they} {be}) (none|no) the worse for it.',
  ],
  'dish.nomush': [
    'The faithful, who {taboo}, (will not|do not) (touch|eat) {it} at all, (and|but) (the rest|everyone else) (eat|eats) (their share|it) (gladly|for them).',
  ],
  'drink.what': [
    '{drink} is {drinkwhat}.',
    'The {people} drink {drink}, which is {drinkwhat}.',
  ],
  'drink.where': [
    '(Every|Each) (inn|tavern) (keeps|has) (its own|a cask of its own), and (every|each) (house|household) (thinks|believes) (its own|theirs) (is|to be) (better|the best).',
    'It is (drunk|taken) (with|at) every meal, (and|) (young and old|by young and old) (alike|together).',
  ],
  'drink.dry': [
    'The faithful (will not|do not) (touch|drink) it, and (drink|keep to) (water|well water) instead; the rest of the {people} (make up for them|drink their share for them).',
    '(Because|Since) the faithful (touch|drink) no strong drink, {drink} (is|has always been) (brewed|made) (in|behind) (back rooms|closed doors), and (drunk|taken) (quietly|without fuss).',
  ],
  'drink.remark': [
    '(Strangers|Visitors) (should|had better) (go carefully|take care) with it, (for|as) it is (stronger|more potent) than it (looks|tastes).',
    '(No|Not one) (bargain|marriage) (is|was ever) (struck|made) among the {people} without (a cup|a cup of it) (to seal it|between them).',
    'I will not give a method for it here: those who make it will not tell, and those who tell do not make it well.',
  ],
  'forbid.rule': [
    'The faithful (among|of) the {people} {taboo}, and (keep|hold to) (it|the rule) (strictly|to the letter).',
    'Those (who|that) keep {faith} {taboo}; (it is|this is) (the|a) (rule|custom) (as old as|older than) the (faith|temples) (itself|themselves).',
  ],
  'forbid.why': [
    'The {clergies} (say|teach) (that|) {god} (asked|wished) it of them, (and|) (no|not one) (good|faithful) (house|family) (would|will) (break it|go against it).',
  ],
  'forbid.stranger': [
    'A (stranger|guest) (who|that) (breaks it|forgets it) (is|will be) (forgiven|pardoned) (once|the first time), (but|and) (not|never) (twice|a second time).',
    '(Cooks|Innkeepers) (who|that) (serve|feed) (strangers|travellers) (know|keep) (it|the rule) (better|more carefully) than (anyone|the priests themselves).',
  ],
  'feastday.feast': [
    'At {feast} (the whole town|every household) (cooks|bakes) (for days|for a week) (beforehand|before), and the tables are (set|laid) out in the street for (all|everyone) to share.',
    '{feast} is the (great|greatest) feast of the year, and the {dish} (made|cooked) for it {be} the (best|finest) of the year.',
  ],
  'feastday.table': [
    'On that day even the (poorest|meanest) household eats {dish}, and as much of it as they like.',
    'It is the one day of the year when nobody counts the cost, and the cooks are thanked, which is rarer still.',
  ],
  'feastday.holy': [
    '{holyday} is the holy day, and (the|its) (meal|supper) (is|has always been) (plain|simple), (for|as) (the|a) (day|holy day) is (no|not a) (day|time) for (feasting|show).',
  ],
  'abroad.other': [
    'The {otherpeople}, (their|) (neighbours|next neighbours), eat {otherdish} (and|) (drink|with) {otherdrink}, and (think|count) (it|their own table) the better.',
    '(Over|Across) the (border|hills), the {otherpeople} (live on|keep) {otherdish}, which the {people} think (strange|outlandish) (food|fare).',
  ],
  'abroad.compare': [
    '(Each|Every) people (thinks|believes) its own table (the best|the finest) in the world, and (each|every one) (is|of them is) (right|wrong) in (its|their) own way.',
  ],
  'abroad.end': [
    '(Here|So) (ends|closes) (this|my) book of the table of the {people}.',
    'And so, reader, to the kitchen, and a good appetite to you.',
  ],
};
