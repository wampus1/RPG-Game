// (Round 126) A people's table: what they eat and drink, how it's made,
// when it's eaten, and what the faithful among them won't touch. What each
// dish and drink is (DISHES, DRINKS) is fixed: the same in every book, so
// two cookery books never disagree about what goes into a goulash. See
// annals.js for how these are written.
export const DISHES = {
  pottage: { what: 'a thick pottage of barley, leeks and peas, with whatever herbs the garden gives', how: 'left to simmer all day at the back of the hearth, and stirred by whoever passes', when: 'eaten most days of the year, in poor houses and rich ones alike', with: 'a heel of brown bread' },
  apple_tart: { what: 'apples from the autumn orchards, sliced thin and laid in a crust of butter pastry', how: 'baked in the bread oven once the loaves are out, while the oven is still hot', when: 'kept for feast days and for guests', with: 'a jug of cream' },
  chowder: { what: 'cod or haddock stewed with onions and milk, and thickened with crushed ship\'s biscuit', how: 'cooked in a great pot, on the boats as often as at home', when: 'eaten after every long day at sea', with: 'a horn of mead' },
  smoked_fish: { what: 'herring split open and hung in the smokehouse over smouldering oak and juniper', how: 'smoked for three days, until the flesh is gold and as dry as leather', when: 'carried on every voyage, and eaten all through the winter', with: 'black bread and butter' },
  spiced_lentils: { what: 'red lentils stewed soft with cumin, coriander and a little saffron', how: 'cooked slowly in a clay pot buried in the embers', when: 'eaten at the evening meal, when the heat of the day is gone', with: 'warm flatbread' },
  flatbread: { what: 'thin bread slapped against the inside wall of a clay oven, eaten with dates from the oasis palms', how: 'baked a few at a time and eaten warm from the oven', when: 'eaten at every meal, and given to every guest at the door', with: 'dates and soft cheese' },
  tamales: { what: 'maize dough filled with beans, squash or meat and wrapped in maize husks', how: 'steamed by the basketful over boiling water', when: 'made by the hundred for feast days', with: 'a cup of hot cocoa' },
  cocoa: { what: 'roasted cocoa beans ground to a paste and whipped with water and chili until it froths', how: 'poured from a height, from one cup into another, to raise the froth', when: 'drunk morning and evening, and offered to the gods', with: 'a maize cake' },
  goulash: { what: 'beef and onions stewed red with paprika and caraway', how: 'cooked for half a day in an iron kettle hung over the forge fire', when: 'eaten after a long shift in the mines', with: 'oatcakes and a mug of dark beer' },
  oatcakes: { what: 'rough cakes of oatmeal, salt and dripping', how: 'baked on a griddle stone over the fire', when: 'carried down the mine in every pocket', with: 'a wedge of hard cheese' },
  pepper_stew: { what: 'meat and beans stewed with the fire-peppers that grow on the warm slopes of the mountain', how: 'cooked in a pot set over a steam vent, and left all day', when: 'eaten on cold nights, and by anyone with something to prove', with: 'ash-baked bread' },
  ash_bread: { what: 'a heavy round loaf baked in the hot ash of the hearth', how: 'buried in the embers overnight, dug out black, and brushed clean', when: 'eaten every day', with: 'a bowl of fire-pepper stew' },
  mushroom_broth: { what: 'a clear broth of marsh mushrooms and wild garlic', how: 'simmered gently and never boiled, so the mushrooms keep their scent', when: 'eaten at the end of every day', with: 'a cup of glowcap tea' },
  glowcap_tea: { what: 'a tea of dried glowcaps, which glows faintly in the cup', how: 'steeped in water just off the boil', when: 'drunk before sleep, to bring good dreams', with: 'nothing at all' },
  crab_boil: { what: 'crabs, shellfish and sweet roots boiled together with sea salt and lime', how: 'boiled in a great pot on the beach and tipped out onto broad leaves', when: 'eaten by the whole village together after a good catch', with: 'palm toddy' },
  kelp_cakes: { what: 'cakes of pounded kelp and root flour', how: 'fried in palm oil until they crackle', when: 'eaten at every meal', with: 'a little crab meat' },
  olive_bread: { what: 'a white loaf studded with black olives, served with dried figs', how: 'baked in the great ovens of the town', when: 'eaten at the midday meal', with: 'a cup of spiced wine' },
  garum_stew: { what: 'fish stewed with herbs and seasoned with garum, the sauce of fermented fish', how: 'cooked slowly, with the garum stirred in at the last', when: 'eaten at the evening meal, lying down if you are rich enough', with: 'olive bread' },
  reindeer_roast: { what: 'a haunch of reindeer roasted over birch embers', how: 'turned on a spit for half a day', when: 'eaten at the autumn slaughter and on feast nights', with: 'cloudberry cakes and birch mead' },
  cloudberry_cakes: { what: 'little cakes sweetened with the golden cloudberries of the bogs', how: 'baked on a griddle', when: 'made in late summer, when the berries are picked', with: 'birch mead' },
  dumplings: { what: 'thin wheat dough folded around pork, ginger and greens', how: 'steamed in towers of bamboo baskets', when: 'eaten at the turn of the year and at every family gathering', with: 'jasmine tea' },
  jasmine_tea: { what: 'green tea scented with jasmine flowers', how: 'steeped three times, each better than the last', when: 'drunk all day long', with: 'a plate of dumplings' },
  chili_squash: { what: 'squash stewed with chili and sweet corn', how: 'cooked in a clay pot in an outdoor oven', when: 'eaten after the harvest is in', with: 'blue corn cakes' },
  blue_corn_cakes: { what: 'thin cakes of blue corn meal', how: 'cooked on a hot flat stone', when: 'eaten at every meal', with: 'cactus tea' },
  whale_stew: { what: 'whale meat and blubber stewed with oats and seaweed', how: 'boiled in the great pot of the hall', when: 'eaten when a whale is brought in, which is a feast for the whole strand', with: 'oat bannocks and a dram of peat whisky' },
  oat_bannock: { what: 'a flat round of oat bread', how: 'baked on a girdle over the peat fire', when: 'eaten every day', with: 'butter, if there is any' },
  shrimp_soup: { what: 'the pink shrimp of the lagoons boiled with lime and pepper', how: 'cooked quickly, so the shrimp stay tender', when: 'eaten in the hot afternoons', with: 'a glass of lime cordial' },
  salt_fish: { what: 'fish packed in salt from the flats and dried in the sun', how: 'soaked overnight before it is cooked', when: 'eaten when the boats cannot go out', with: 'boiled roots' },
  root_stew: { what: 'the pale roots that grow in the hollows, stewed with mushrooms', how: 'cooked slowly over a small fire, for the smoke must not fill the warren', when: 'eaten every day', with: 'a mug of mushroom ale' },
  glowberry_tart: { what: 'a tart of glowberries, which shine faintly when the crust is cut', how: 'baked in a stone oven', when: 'kept for feasts', with: 'mushroom ale' },
  seer_stew: { what: 'a stew of mutton, roots and bitter herbs said to bring visions', how: 'cooked by the seers themselves, who will not say what goes into it', when: 'eaten on the long nights before a rune-reading', with: 'heather bread and aurora mead' },
  heather_bread: { what: 'bread sweetened with heather honey', how: 'baked on the hearthstone', when: 'eaten at every meal', with: 'a cup of aurora mead' },
  fish_pie: { what: 'white fish and onions under a crust', how: 'baked in a peat oven', when: 'eaten when the boats come in', with: 'a dram of peat whisky' },
  seaweed_crisps: { what: 'seaweed dried and toasted until it crackles', how: 'toasted on a hot stone by the fire', when: 'eaten by the fire on long evenings', with: 'peat whisky' },
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
  ],
  dish: [
    ['what', 'how', 'when', 'with'],
    ['what', 'when', 'how', 'remark'],
    ['what', 'how', 'with', 'remark'],
    ['what', 'how', 'when', 'remark'],
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
  'tableopen.land': [
    'The {people} live (among|in) {ground}, and (their|the) table (is|has always been) (shaped|made) by (it|the land) (as much as by|more than by) (any|their) (cook|cooks).',
    '(What|Whatever) {land} (gives|grows), the {people} (eat|cook), and (they|their cooks) (waste|throw away) (nothing|little) of it.',
  ],
  'tableopen.table': [
    'Ask (any of the|one of the) {people} what they live on, and they will tell you: {cuisine}.',
    'The table of the {people} is {cuisine}, (and|with) {drink} to (wash it down|drink).',
  ],
  'tableopen.poor': [
    '(Rich|The rich) and (poor|the poor) (eat|share) the same dishes, (though|but) the (rich|well-off) (eat|have) more of them, and the poor make theirs go further.',
  ],
  'tableopen.guest': [
    'A guest is fed before anyone (asks|thinks to ask) their (name|business), for sending a (stranger|guest) away hungry (is|would be) (a shame|shameful) among the {people}.',
  ],
  'dish.what': [
    '{dish} {be} {what}.',
    'The {dish} of the {people} {be} {what}.',
    'What the {people} call {dish} {be} {what}.',
  ],
  'dish.how': [
    '{they} {be} {how}.',
    '(To make {it}|Properly made), {they} {be} {how}.',
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
