// The choices the Towns nodes offer (round 65), kept apart from towns.js
// (which reaches into the game's towns) so the Workshop can show them
// without the game. towns.js is held to them by the tests.
export const TOWN_FACTS = ['name', 'kind', 'island', 'people', 'coffers', 'tax %', 'mood', 'wood', 'stone', 'guards', 'realm', 'ruler', 'at war', 'wanted', 'your standing', 'laws', 'feast days ago', 'weather', 'condition'];
export const TOWN_CHANGES = ['coffers', 'tax %', 'everyone\'s mood', 'wood', 'stone', 'a law', 'name', 'a feast day', 'your standing', 'wanted', 'a line in its records', 'stock a shop'];
export const PERSON_FACTS = ['name', 'first name', 'trade', 'trade (its key)', 'age', 'mood', 'coins', 'thinks of you', 'traits', 'town', 'home', 'work', 'alive', 'married', 'children'];
export const PERSON_CHANGES = ['trade', 'coins', 'mood', 'what they think of you', 'add a trait', 'take a trait', 'first name'];
// [key, name] of each law a town can have.
export const LAW_LIST = [['armsBan', 'Weapons ban'], ['curfew', 'Curfew'], ['tariff', 'Outsiders\' tariff'], ['poaching', 'Game law'], ['felling', 'Tree law'], ['openMarket', 'Open market'],
  ['horseLaw', 'Riding law'], ['fireTithe', 'Fire tithe'], ['blackGlass', 'Black-glass law'], ['lanternLaw', 'Lantern law'], ['sporeLaw', 'Spore law'], ['catchShare', 'Catch-share'], ['raftDues', 'Raft dues']];
// [key, title] of each trade someone in a town can have.
export const JOB_LIST = [['farmer', 'Farmer'], ['guard', 'Guard'], ['merchant', 'Merchant'], ['blacksmith', 'Blacksmith'], ['innkeeper', 'Innkeeper'], ['cook', 'Cook'], ['barkeep', 'Barkeep'],
  ['baker', 'Baker'], ['priest', 'Priest'], ['scholar', 'Scholar'], ['researcher', 'Researcher'], ['mayor', 'Mayor'], ['noble', 'Noble'], ['tailor', 'Tailor'], ['carpenter', 'Carpenter'],
  ['herbalist', 'Herbalist'], ['fisher', 'Fisher'], ['lumberjack', 'Lumberjack'], ['miner', 'Miner'], ['trapper', 'Trapper'], ['laborer', 'Laborer'], ['builder', 'Builder'], ['beggar', 'Beggar'],
  ['handler', 'Animal Handler'], ['miller', 'Miller'], ['glassblower', 'Glassblower'], ['sporewright', 'Sporewright'], ['pearldiver', 'Pearl Diver']];
// The kinds of shop a town has, to stock.
export const SHOP_KINDS = ['shop', 'smithy', 'bakery', 'tavern', 'tailor', 'herbalist', 'workshop', 'library'];
