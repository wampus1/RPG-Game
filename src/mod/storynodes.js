// Story nodes (round 62): what the Story tool's graphs are made of. A
// story is a few beats wired one to the next: how it begins (and who's in
// it: someone asking, someone else), what's put on the town's board, the
// tasks posted (bring things, carry something, slay something, talk to
// someone, go somewhere), words with people, waiting, chance and checks,
// values kept, things given, structures raised, events sent and waited
// for, other stories begun, and how it ends. Played by the game's own
// story engine (see mod/storyrun.js), so a mod's stories have their tasks
// on the boards, their people with something to say, their place in the
// journal, just as the game's do.
import { def, T } from './graph.js';
import { TRAITS, ORIGINS } from '../game/hero.js';

const C = { begin: '#8a6a3a', beat: '#4a6a8a', task: '#6a4a8a', talk: '#3a7a5a', flow: '#5a5470', world: '#7a5a2a', end: '#7a3a3a' };
const flowIn = { id: 'in', t: T.flow, label: '' };
const out = (id, label) => ({ id, t: T.flow, label });
const P = (id, t, label, d, o = {}) => ({ id, t, label, def: d, ...o });
const pick = (id, label, opts, d, o = {}) => ({ id, t: 'enum', label, opts, def: d ?? opts[0], ...o });

// Who in a town someone in a story can be, and (round 65: every trade a
// town has) the work that makes them that.
export const WHO_JOBS = {
  'the innkeeper': ['innkeeper', 'barkeep'], 'the priest': ['priest'], 'a smith': ['blacksmith', 'smith'], 'a cook': ['cook', 'baker'],
  'a farmer': ['farmer'], 'a merchant': ['merchant', 'jeweller', 'tailor'], 'a guard': ['guard'],
  'a barkeep': ['barkeep'], 'a baker': ['baker'], 'a scholar': ['scholar'], 'a researcher': ['researcher'], 'a noble': ['noble'],
  'a tailor': ['tailor'], 'a carpenter': ['carpenter'], 'a herbalist': ['herbalist'], 'a fisher': ['fisher'], 'a lumberjack': ['lumberjack'],
  'a miner': ['miner'], 'a trapper': ['trapper'], 'a labourer': ['laborer'], 'a builder': ['builder'], 'a beggar': ['beggar'],
  'an animal handler': ['handler'], 'a miller': ['miller'], 'a glassblower': ['glassblower'], 'a sporewright': ['sporewright'],
  'a pearl diver': ['pearldiver'], 'someone retired': ['retired'],
};
export const WHO = ['someone grown', 'the mayor', 'an elder', 'a child', ...Object.keys(WHO_JOBS), 'nobody'];
// (Round 68) The lands a town can be on: the three islands, and the lands
// out past the storm (as the world map has them), with their keys.
export const LANDS = [['Thessa', 'thessa'], ['Kharos', 'kharos'], ['Myrrow', 'myrrow'], ['Velmarch', 'velmarch'], ['Ostria', 'ostria'], ['Corrow', 'corrow'], ['Saltmere', 'saltmere'],
  ['Hollowmark', 'hollowmark'], ['Wyrd', 'wyrd'], ['the Grey Skerries', 'skerries']];
export const LAND_OF = Object.fromEntries(LANDS.map(([n, k]) => [`a town on ${n}`, k]));
export const WHERE_TOWN = ['any town', 'a town on Thessa', 'a town on Kharos', 'a town on Myrrow', 'the nearest town', ...LANDS.slice(3).map(([n]) => `a town on ${n}`), 'a town past the storm', 'an empire\'s capital'];
export const SPOTS = ['out near the town', 'far out in the wilds', 'in the town', 'by the one asking'];
export const ROLES = ['giver', 'other'];
export const STORY_TEXT = 'In any words: {town}, {giver}, {other}, {third}, {fourth}, {player}, {item}, {count}, {creature}, any value the story has set ({name}), and your graphs\' values ({world:name}, {player:name}).';
// (Round 64) What an If can ask, and how two things can be compared.
export const IFS = [
  'a player in it has', 'a player in it holds', 'a player in it wears', 'a player in it is hurt', 'a player in it is near',
  'a player in it is famous', 'the giver thinks well of a player in it', 'a player in it has the trait', 'a player in it came as',
  'players in it are at least', 'the giver is alive', 'the other is alive', 'it is night', 'it is day', 'the hour is between',
  'days since it began are at least', 'the weather is', 'the town is a', 'the town is on', 'the town is at war',
  'a value is at least', 'a value is', 'a world value is', 'a player value is', 'these compare', 'by chance', 'another story of yours is going',
  // (Round 68)
  'the third is alive', 'the fourth is alive', 'someone in it is following a player', 'someone in it is where they were sent', 'a player in it is at sea', 'a player in it is aboard the story\'s ship',
  'the story\'s ship is sunk', 'the story\'s ship is near the town', 'a player in it is in a dungeon', 'the storm wall is down', 'the town\'s realm is at war with a player\'s', 'a player in it has coins',
  'a player in it is in the town', 'a player in it is near the story\'s place', 'the town has in its coffers', 'the town\'s people are content', 'an event has been sent',
];
export const OPS = ['is', 'is not', 'is at least', 'is more than', 'is at most', 'is less than', 'has in it'];
const holding = ['a player in it has', 'a player in it holds', 'a player in it wears'];
const valued = ['a value is', 'a world value is', 'a player value is'];

def('st.start', {
  cat: 'Story', story: true, storyRoot: true, color: C.begin, title: 'The story begins',
  help: 'How it starts, where, and who\'s in it: the one asking (the giver), and someone else (the other). Wire Begins into what happens first.',
  in: [],
  props: [
    P('title', 'text', 'Called', 'Trouble in {town}'),
    pick('when', 'Starts', ['now and then', 'after a game story ends', 'when an event is sent', 'only when started'], 'now and then'),
    P('chance', 'number', 'Chance a day (%)', 8, { min: 0, max: 100, show: { when: ['now and then'] } }),
    P('after', 'text', 'After the story', '', { show: { when: ['after a game story ends'] } }),
    P('outcome', 'text', 'Ending (blank: any)', '', { show: { when: ['after a game story ends'] } }),
    P('event', 'text', 'On the event', 'my_event', { show: { when: ['when an event is sent'] } }),
    pick('where', 'In', WHERE_TOWN, 'any town'),
    pick('giver', 'Asking', WHO, 'someone grown'),
    pick('other', 'And', WHO, 'nobody'),
    P('max', 'number', 'At once, at most', 2, { min: 1, max: 8, adv: true }),
    P('perTown', 'bool', 'One to a town', true, { adv: true }),
    P('secret', 'bool', 'Kept from the journal till over', false, { adv: true }),
  ],
  out: [out('begin', 'Begins')],
});

def('st.news', {
  cat: 'Story', story: true, color: C.beat, title: 'News',
  help: 'A line in the story\'s history; on the town\'s notice board too, if you like, and told to the players there.',
  in: [flowIn],
  props: [P('text', 'text', 'Says', '{giver} of {town} is looking for help.', { long: true }), P('board', 'bool', 'On the notice board', true), P('tell', 'bool', 'Told to players nearby', false)],
  out: [out('next', 'Then')],
});

def('st.task', {
  cat: 'Story', story: true, color: C.task, title: 'A task', waits: true,
  help: 'Something to be done, posted in the town (on its board, and the giver asks anyone who\'ll listen). Done, it goes on by Done; out of time, by Failed.',
  in: [flowIn],
  props: [
    pick('kind', 'Kind', ['bring things', 'carry something', 'slay creatures', 'talk to someone', 'go somewhere'], 'bring things'),
    P('title', 'text', 'Called', 'Bring {giver} {count} {item}'),
    P('pitch', 'text', 'Asked as', 'Would you help me? I need {count} {item}, and quickly.', { long: true }),
    P('item', 'item', 'Item', 'bread', { show: { kind: ['bring things', 'carry something'] } }),
    P('count', 'number', 'How many', 3, { min: 1, max: 99, show: { kind: ['bring things', 'carry something', 'slay creatures'] } }),
    P('creature', 'creature', 'Creature', 'wolf', { show: { kind: ['slay creatures'] } }),
    pick('spot', 'Where', SPOTS, 'out near the town', { adv: true, show: { kind: ['slay creatures', 'go somewhere'] } }),
    P('structure', 'structure', 'A structure there', null, { adv: true, show: { kind: ['slay creatures', 'go somewhere'] } }),
    pick('to', 'To', ROLES, 'other', { show: { kind: ['carry something', 'talk to someone'] } }),
    P('days', 'number', 'Days to do it (0: any)', 0, { min: 0, max: 60, adv: true }),
    P('coins', 'number', 'Reward: coins', 20, { min: 0, max: 5000 }),
    P('reward', 'item', 'Reward: item', null, { adv: true }),
    P('rewardN', 'number', 'Reward: how many', 1, { min: 1, max: 99, adv: true }),
    P('rep', 'number', 'Thought of more', 5, { min: 0, max: 50, adv: true }),
  ],
  out: [out('done', 'Done'), out('failed', 'Failed')],
});

def('st.talk', {
  cat: 'Story', story: true, color: C.talk, title: 'A word with someone', waits: true,
  help: 'Waits till a player talks to them: they say their piece, and the answer chosen picks the way on (no answers: it goes on by Then). Talk nodes one after another make a conversation.',
  in: [flowIn],
  props: [
    pick('who', 'With', ROLES, 'giver'),
    P('ask', 'text', 'The player says', 'You wanted to see me?'),
    P('text', 'text', 'They say', 'I did. There\'s something you should know about {other}.', { long: true }),
    P('a', 'text', 'Answer 1', 'Tell me more.'),
    P('b', 'text', 'Answer 2', 'Not now.'),
    P('c', 'text', 'Answer 3', '', { adv: true }),
    P('bye', 'text', 'Then they say', '', { adv: true }),
  ],
  out: [out('a', 'Answer 1'), out('b', 'Answer 2'), out('c', 'Answer 3'), out('next', 'Then')],
});

def('st.wait', {
  cat: 'Story', story: true, color: C.flow, title: 'Wait', waits: true,
  help: 'Some hours of the game\'s time go by.',
  in: [flowIn],
  props: [P('hours', 'number', 'Hours', 12, { min: 1, max: 24 * 30 })],
  out: [out('next', 'Then')],
});

def('st.chance', {
  cat: 'Story', story: true, color: C.flow, title: 'Chance',
  help: 'One way or another, at random: the bigger its weight, the likelier.',
  in: [flowIn],
  props: [P('a', 'number', 'Weight A', 1, { min: 0, max: 100 }), P('b', 'number', 'Weight B', 1, { min: 0, max: 100 }), P('c', 'number', 'Weight C', 0, { min: 0, max: 100 })],
  out: [out('a', 'A'), out('b', 'B'), out('c', 'C')],
});

// The questions an If (or a Wait till) asks, and what each needs.
export const IF_PROPS = [
  pick('what', 'If', IFS, 'a player in it has'),
  P('item', 'item', 'Item', 'coin', { show: { what: holding } }),
  P('count', 'number', 'How many', 1, { min: 0, max: 99999, show: { what: ['a player in it has', 'a value is at least', 'a player in it has coins', 'the town has in its coffers'] } }),
  P('least', 'number', 'At least', 1, { min: -999, max: 9999, show: { what: ['a player in it is famous', 'the giver thinks well of a player in it', 'players in it are at least', 'days since it began are at least'] } }),
  P('pct', 'number', 'Health under (%)', 50, { min: 1, max: 100, show: { what: ['a player in it is hurt'] } }),
  pick('whom', 'Near', ['the giver', 'the other', 'the town', 'where a task is', 'the third', 'the fourth'], 'the giver', { show: { what: ['a player in it is near'] } }),
  P('dist', 'number', 'Within (blocks)', 8, { min: 1, max: 500, show: { what: ['a player in it is near', 'a player in it is near the story\'s place', 'the story\'s ship is near the town'] } }),
  P('event', 'text', 'Event', 'my_event', { show: { what: ['an event has been sent'] } }),
  pick('trait', 'Trait', [...Object.keys(TRAITS).map((k) => [k, TRAITS[k].name]), ['mod', 'One of your traits']], 'tough', { show: { what: ['a player in it has the trait'] } }),
  P('traitId', 'text', 'Trait (its id)', '', { show: (g) => g('what') === 'a player in it has the trait' && g('trait') === 'mod' }),
  pick('origin', 'Came as', [...Object.keys(ORIGINS).map((k) => [k, ORIGINS[k].name]), ['mod', 'One of your origins']], 'crash', { show: { what: ['a player in it came as'] } }),
  P('originId', 'text', 'Origin (its id)', '', { show: (g) => g('what') === 'a player in it came as' && g('origin') === 'mod' }),
  P('from', 'number', 'From (hour)', 6, { min: 0, max: 24, show: { what: ['the hour is between'] } }),
  P('to', 'number', 'Till (hour)', 12, { min: 0, max: 24, show: { what: ['the hour is between'] } }),
  pick('sky', 'Weather', ['rain or snow', 'rain', 'snow', 'fog', 'clear'], 'rain or snow', { show: { what: ['the weather is'] } }),
  pick('size', 'Kind', ['village', 'town', 'city', 'empire'], 'village', { show: { what: ['the town is a'] } }),
  pick('isle', 'Island', LANDS.map(([n]) => n), 'Thessa', { show: { what: ['the town is on'] } }),
  P('left', 'text', 'This', '{trust}', { show: { what: ['these compare'] } }),
  P('name', 'text', 'Value', 'trust', { show: { what: ['a value is at least', ...valued] } }),
  pick('op', 'Compared', OPS, 'is at least', { show: { what: [...valued, 'these compare'] } }),
  P('value', 'text', 'With', '1', { show: { what: [...valued, 'these compare'] } }),
  P('chance', 'number', 'Chance (%)', 50, { min: 0, max: 100, show: { what: ['by chance'] } }),
  P('story', 'story', 'Story', null, { show: { what: ['another story of yours is going'] } }),
];

def('st.check', {
  cat: 'Story', story: true, color: C.flow, title: 'If',
  help: 'Goes on by Yes or No, as things stand. Fields to compare can have values in them: {name} (the story\'s), {world:name}, {player:name}.',
  in: [flowIn],
  props: IF_PROPS,
  out: [out('yes', 'Yes'), out('no', 'No')],
});

def('st.set', {
  cat: 'Story', story: true, color: C.flow, title: 'Set a value',
  help: 'A value the story keeps (a count, a choice made), for If and for words ({name}).',
  in: [flowIn],
  props: [P('name', 'text', 'Value', 'trust'), pick('op', 'To', ['set', 'add', 'take away', 'a random number up to', 'words'], 'add'), P('value', 'number', 'By', 1, { min: -999, max: 999, show: { op: { not: ['words'] } } }), P('words', 'text', 'Words', '{giver}', { show: { op: ['words'] } })],
  out: [out('next', 'Then')],
});

def('st.take', {
  cat: 'Story', story: true, color: C.world, title: 'Take',
  help: 'Something taken from a player in the story, if one has enough (Taken), or not (Hasn\'t).',
  in: [flowIn],
  props: [P('item', 'item', 'Item', 'coin'), P('count', 'number', 'How many', 5, { min: 1, max: 999 }), P('text', 'text', 'Told', '{giver} takes it gratefully.')],
  out: [out('ok', 'Taken'), out('no', 'Hasn\'t')],
});

def('st.rep', {
  cat: 'Story', story: true, color: C.world, title: 'Thought of',
  help: 'How the players in the story are thought of: by the town (and the towns near it), or by the giver or the other alone. Less, if it\'s below 0.',
  in: [flowIn],
  props: [pick('by', 'By', ['the town', 'the giver', 'the other'], 'the town'), P('n', 'number', 'More by', 5, { min: -50, max: 50 }), P('text', 'text', 'Told', '', { adv: true })],
  out: [out('next', 'Then')],
});

def('st.say', {
  cat: 'Story', story: true, color: C.talk, title: 'Says aloud',
  help: 'The giver or the other says something aloud, where they stand (seen by anyone near).',
  in: [flowIn],
  props: [pick('who', 'Who', ROLES, 'giver'), P('text', 'text', 'Says', 'Has anyone seen {other}?', { long: true })],
  out: [out('next', 'Then')],
});

def('st.spawn', {
  cat: 'Story', story: true, color: C.world, title: 'Creatures come',
  help: 'Creatures of a kind appear (when someone\'s near enough to see them): near the town, far out, in it, or by the giver.',
  in: [flowIn],
  props: [P('creature', 'creature', 'Creature', 'wolf'), P('count', 'number', 'How many', 3, { min: 1, max: 12 }), pick('spot', 'Where', SPOTS, 'out near the town')],
  out: [out('next', 'Then')],
});

def('st.give', {
  cat: 'Story', story: true, color: C.world, title: 'Give',
  help: 'Something given to the players who\'ve had a hand in the story.',
  in: [flowIn],
  props: [P('item', 'item', 'Item', 'coin'), P('count', 'number', 'How many', 5, { min: 1, max: 999 }), P('text', 'text', 'Told', '{giver} presses something into your hands.')],
  out: [out('next', 'Then')],
});

def('st.place', {
  cat: 'Story', story: true, color: C.world, title: 'Raise a structure',
  help: 'One of your structures, put up near the town (when someone comes near enough to see it go up). Tasks set "out near the town" go to it.',
  in: [flowIn],
  props: [P('structure', 'structure', 'Structure', null), pick('spot', 'Where', SPOTS.slice(0, 2), 'out near the town')],
  out: [out('next', 'Then')],
});

def('st.event', {
  cat: 'Story', story: true, color: C.world, title: 'Send an event',
  help: 'Heard by On event nodes in your graphs (and by World events set to "a custom event").',
  in: [flowIn],
  props: [P('name', 'text', 'Event', 'my_event'), P('value', 'text', 'With', '', { adv: true })],
  out: [out('next', 'Then')],
});

def('st.until', {
  cat: 'Story', story: true, color: C.flow, title: 'Wait for',
  help: 'Waits till an event of yours is sent (from a graph, a trigger), creatures of a kind are killed, a value comes to something ({world:name} and {player:name} too), or an hour of the day comes round.',
  in: [flowIn],
  waits: true,
  props: [pick('what', 'For', ['an event', 'a kill', 'a value', 'a time of day'], 'an event'), P('name', 'text', 'Event', 'my_event', { show: { what: ['an event'] } }), P('creature', 'creature', 'Creature', 'wolf', { show: { what: ['a kill'] } }), P('count', 'number', 'How many', 1, { min: 1, max: 99, show: { what: ['a kill'] } }), P('value', 'text', 'Value', 'trust', { show: { what: ['a value'] } }), pick('op', 'Compared', OPS, 'is at least', { show: { what: ['a value'] } }), P('than', 'text', 'With', '3', { show: { what: ['a value'] } }), P('hour', 'number', 'Hour', 8, { min: 0, max: 23, show: { what: ['a time of day'] } })],
  out: [out('next', 'Then')],
});

def('st.story', {
  cat: 'Story', story: true, color: C.world, title: 'Start a story',
  help: 'Another of your stories, begun from this one (with the same town and people).',
  in: [flowIn],
  props: [P('story', 'story', 'Story', null)],
  out: [out('next', 'Then')],
});

def('st.end', {
  cat: 'Story', story: true, color: C.end, title: 'The end',
  help: 'How it came out. Told on the board if you like; other stories can follow on from it by its ending.',
  in: [flowIn],
  props: [P('outcome', 'text', 'Ending', 'good'), P('text', 'text', 'Last line', 'And so it was settled.', { long: true }), P('board', 'bool', 'On the notice board', true)],
  out: [],
});

export const STORY_NODE_TYPES = ['st.start', 'st.news', 'st.task', 'st.talk', 'st.say', 'st.wait', 'st.chance', 'st.check', 'st.set', 'st.give', 'st.take', 'st.rep', 'st.spawn', 'st.place', 'st.event', 'st.until', 'st.story', 'st.end'];
