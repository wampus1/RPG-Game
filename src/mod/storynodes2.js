// More story nodes (round 68): a story told with as much in its hands as an
// entity's graph. Ways for it to go (which way by a value, round again,
// the first time, in turn, marks to jump to, waiting till anything an If
// can ask is so, whichever comes first, meanwhile); its people (another
// brought into it, sent somewhere, brought along, turned against the
// players or calmed, changed, found out about, a word with conditions on
// its answers, two of them talking); the town and the realms (a town's
// coffers and laws, war and peace, the story moved to another town, a
// newcomer, a dungeon found, the weather, a mark on the map); the players
// (paid or charged, hurt or healed, taken somewhere, made famous, a title
// across the screen, a moment of sound and light); the sea (a ship come,
// told what to do, a realm's ships sent across); and its values worked
// out. Besides these, a story can have any of the entity graph's nodes in
// it (actions, flow, values, maths, terrain, behaviour...): see
// storyrun.js, which runs them with the story's people and places.
import { def, T } from './graph.js';
import { WHO, IF_PROPS, OPS, LANDS } from './storynodes.js';
import { TOWN_CHANGES, TOWN_FACTS, PERSON_FACTS, PERSON_CHANGES, LAW_LIST, JOB_LIST, SHOP_KINDS } from './townlists.js';
import { SOUNDS, THEME_LIST, STATUSES } from './lists.js';

const C = { flow: '#5a5470', people: '#3a7a5a', town: '#7a6a2a', players: '#6a4a8a', sea: '#2a5a7a', values: '#4a3a2a', who: '#3a4a46', end: '#7a3a3a' };
const flowIn = { id: 'in', t: T.flow, label: '' };
const out = (id, label) => ({ id, t: T.flow, label });
const P = (id, t, label, d, o = {}) => ({ id, t, label, def: d, ...o });
const pick = (id, label, opts, d, o = {}) => ({ id, t: 'enum', label, opts, def: d ?? (Array.isArray(opts[0]) ? opts[0][0] : opts[0]), ...o });
const dat = (id, t, label, o = {}) => ({ id, t, label, def: null, ...o });

// Who in a story someone can be: the two it begins with, and two more it
// can bring in (Someone else comes into it).
export const ROLES4 = ['giver', 'other', 'third', 'fourth'];
// Where in a story something can be.
export const PLACES = ['the town', 'the giver', 'the other', 'the third', 'the fourth', 'a player in it', 'where its task is', 'the story\'s place', 'out near the town', 'far out in the wilds', 'the sea off the town', 'the nearest other town'];
export const SHIP_KINDS = [['sloop', 'a sloop'], ['brigantine', 'a brigantine'], ['galleon', 'a galleon'], ['frigate', 'a frigate']];
export const DUNGEON_KINDS = ['any', 'barrow', 'mine', 'crypt', 'holdout', 'grove', 'forge', 'grotto', 'kavorent', 'catacomb', 'vault', 'gut', 'saltworks', 'warren', 'mound', 'broch', 'athanor', 'champion', 'rift', 'gullet'];
const S2 = (cat, color) => (type, o) => def(type, { cat, story: true, color, ...o, in: [flowIn, ...(o.in || [])] });
const flow = S2('Story: ways', C.flow);
const people = S2('Story: people', C.people);
const town = S2('Story: towns & realms', C.town);
const plays = S2('Story: players', C.players);
const sea = S2('Story: the sea', C.sea);
const vals = S2('Story: values', C.values);

// ============================================================ ways
flow('st.switch', {
  title: 'Which way',
  help: 'Goes one of up to five ways, by what a value is ({choice}, {world:name}, a number wired in): the first that matches, else by Otherwise.',
  in: [P('value', T.any, 'Which', '{choice}')],
  props: [P('a', 'text', 'Way 1 if it is', 'yes'), P('b', 'text', 'Way 2 if it is', 'no'), P('c', 'text', 'Way 3 if it is', ''), P('d', 'text', 'Way 4 if it is', '', { adv: true }), P('e', 'text', 'Way 5 if it is', '', { adv: true }), pick('op', 'Matched when it', OPS, 'is', { adv: true })],
  out: [out('a', 'Way 1'), out('b', 'Way 2'), out('c', 'Way 3'), out('d', 'Way 4'), out('e', 'Way 5'), out('else', 'Otherwise')],
});
flow('st.loop', {
  title: 'Round again',
  help: 'Goes back round by Again (wire it to a beat before this one) so many times, then on by Done (and it\'s ready to count again).',
  props: [P('times', 'number', 'Times round', 3, { min: 1, max: 99 })],
  out: [out('again', 'Again'), out('done', 'Done')],
});
flow('st.once', {
  title: 'The first time',
  help: 'The first time the story comes here it goes by First; every time after, by After.',
  out: [out('first', 'First'), out('after', 'After')],
});
flow('st.cycle', {
  title: 'In turn',
  help: 'Each time it comes here, the next way of so many (or, shuffled, each in a random order, none twice till all have been).',
  props: [P('ways', 'number', 'Ways', 3, { min: 2, max: 6 }), P('shuffle', 'bool', 'Shuffled', false)],
  out: [out('w1', 'First'), out('w2', 'Second'), out('w3', 'Third'), out('w4', 'Fourth'), out('w5', 'Fifth'), out('w6', 'Sixth')],
});
flow('st.mark', {
  title: 'A mark',
  help: 'A place in the story, by a name: Go to a mark comes back here from anywhere in it (so a long story needn\'t have wires all over).',
  props: [P('name', 'text', 'Called', 'the crossroads')],
  out: [out('next', 'Then')],
});
flow('st.jump', {
  title: 'Go to a mark',
  help: 'On from the mark of that name.',
  props: [P('name', 'text', 'The mark', 'the crossroads')],
  out: [],
});
flow('st.when', {
  title: 'Wait till', waits: true,
  help: 'Waits till anything an If can ask is so (a player comes near, the hour comes round, a value comes to something, the story\'s ship is sunk...), then goes on by It is. Given up after so many hours (0: never), by Gave up.',
  props: [...IF_PROPS, P('hours', 'number', 'Give up after (hours; 0: never)', 0, { min: 0, max: 24 * 60 })],
  out: [out('yes', 'It is'), out('no', 'Gave up')],
});
flow('st.race', {
  title: 'Whichever comes first', waits: true,
  help: 'Waits for whichever of these comes first (leave one blank and it isn\'t waited for): an event sent, a kill, a player in it coming near someone or somewhere, or hours going by.',
  props: [P('event', 'text', 'An event', ''), P('creature', 'creature', 'A kill of', null), P('count', 'number', 'How many killed', 1, { min: 1, max: 99 }),
    pick('near', 'A player coming near', ['nobody', ...PLACES.slice(0, 8)], 'nobody'), P('dist', 'number', 'Within (blocks)', 6, { min: 1, max: 200 }), P('hours', 'number', 'Hours going by (0: not)', 0, { min: 0, max: 24 * 60 })],
  out: [out('ev', 'The event'), out('kill', 'The kill'), out('near', 'Came near'), out('time', 'Time ran out')],
});
flow('st.meanwhile', {
  title: 'Meanwhile',
  help: 'The story goes two ways at once: on by Then, and (as a second telling of it, with the same people, town and values) by Meanwhile. Each ends on its own.',
  out: [out('next', 'Then'), out('aside', 'Meanwhile')],
});
flow('st.retitle', {
  title: 'A new chapter',
  help: 'The story called something new from here (in the journal); and, if you like, its new name across the screens of the players in it, like the title of a chapter.',
  props: [P('title', 'text', 'Now called', 'The Drowned Bell'), P('sub', 'text', 'Beneath it', 'Chapter two'), P('card', 'bool', 'Across the screen', true), P('line', 'text', 'In its history', '', { adv: true })],
  out: [out('next', 'Then')],
});
flow('st.endstory', {
  title: 'End another story',
  help: 'Another of your stories, wherever it\'s being told (or only in this town), ended: by an ending of your choosing.',
  props: [P('story', 'story', 'Story', null), P('outcome', 'text', 'Ending', 'cut short'), P('here', 'bool', 'Only in this town', false)],
  out: [out('next', 'Then')],
});
flow('st.reveal', {
  title: 'Into the journal',
  help: 'A secret story (Kept from the journal) shown to the players in it from now on; or, unticked, hidden again.',
  props: [P('show', 'bool', 'Shown', true)],
  out: [out('next', 'Then')],
});

// ============================================================ people
people('st.cast', {
  title: 'Someone else comes into it',
  help: 'Someone more in the story, as the third or the fourth ({third}, {fourth} in its words): of the town, or of the nearest other town. Nobody fits: by Nobody.',
  props: [pick('role', 'As', ['third', 'fourth'], 'third'), pick('who', 'Who', WHO.filter((w) => w !== 'nobody'), 'someone grown'), pick('from', 'From', ['the town', 'the nearest other town', 'the town of a player in it'], 'the town'), P('line', 'text', 'In its history', '', { adv: true })],
  out: [out('next', 'Then'), out('none', 'Nobody')],
});
people('st.walk', {
  title: 'Someone goes',
  help: 'Someone in the story walks somewhere, and stays there (till told otherwise: Someone turns). Waits till they\'re there, if you like (or a while, if nobody\'s near to see: then they\'re simply there).',
  in: [dat('at', T.pos, 'To (wired: a place)')],
  props: [pick('who', 'Who', ROLES4, 'giver'), pick('to', 'To', PLACES, 'the town'), P('wait', 'bool', 'Waits till they\'re there', false), P('say', 'text', 'Says as they go', '', { adv: true })],
  out: [out('next', 'Then')],
});
people('st.escort', {
  title: 'Bring someone along', waits: true,
  help: 'Someone in the story follows the nearest player in it, till they\'re brought somewhere (by Brought), or come to harm (by Lost). A task in the journal while it lasts.',
  props: [pick('who', 'Who', ROLES4, 'other'), pick('to', 'To', ['the town', 'the giver', 'the nearest other town', 'where its task is', 'the story\'s place', 'out near the town', 'far out in the wilds'], 'the town'),
    P('title', 'text', 'The task', 'See {other} safely to {town}'), P('near', 'number', 'Brought within (blocks)', 5, { min: 2, max: 30, adv: true }), P('hours', 'number', 'Hours to do it (0: any)', 0, { min: 0, max: 24 * 30, adv: true })],
  out: [out('done', 'Brought'), out('lost', 'Lost')],
});
people('st.turn', {
  title: 'Someone turns',
  help: 'Someone in the story turns on the players in it (and fights), runs from them, stands where they are, follows a player, or goes back to their day.',
  props: [pick('who', 'Who', ROLES4, 'giver'), pick('how', 'They', ['turn on the players', 'run from the players', 'stand where they are', 'follow a player in it', 'go back to their day'], 'turn on the players'), P('say', 'text', 'Saying', '', { adv: true })],
  out: [out('next', 'Then')],
});
people('st.fate', {
  title: 'Something befalls someone',
  help: 'Someone in the story dies (quietly, or as if struck down), is hurt or healed, or grows happier or sadder. The town hears of a death.',
  props: [pick('who', 'Who', ROLES4, 'other'), pick('what', 'They', ['die', 'are struck down', 'are hurt', 'are healed', 'grow happier', 'grow sadder', 'come into money', 'lose their money'], 'die'), P('n', 'number', 'How much', 5, { min: 1, max: 100, show: { what: ['are hurt', 'are healed', 'come into money'] } }), P('cause', 'text', 'Of', 'a fever', { show: { what: ['die'] } })],
  out: [out('next', 'Then')],
});
people('st.person', {
  title: 'Change someone',
  help: 'Something about someone in the story changed: their trade, coins, mood, what they think of the players in it, a trait, their first name.',
  props: [pick('who', 'Who', ROLES4, 'giver'), pick('what', 'Change', PERSON_CHANGES, 'mood'), pick('how', 'How', ['add', 'set'], 'add', { show: { what: ['coins', 'mood', 'what they think of you'] } }),
    P('value', 'text', 'By / to', '10', { show: { what: ['coins', 'mood', 'what they think of you'] } }), pick('job', 'Trade', JOB_LIST, 'farmer', { show: { what: ['trade'] } }),
    P('text', 'text', 'Words', 'brave', { show: { what: ['add a trait', 'take a trait', 'first name'] } })],
  out: [out('next', 'Then'), out('no', 'Couldn\'t')],
});
people('st.learn', {
  title: 'Find out',
  help: 'Something about someone in the story, the town, or the players in it, kept as one of the story\'s values ({name} in its words, for an If, for Which way).',
  props: [pick('of', 'About', ['the giver', 'the other', 'the third', 'the fourth', 'the town', 'a player in it', 'the world'], 'the giver'),
    pick('pf', 'What', PERSON_FACTS, 'name', { show: { of: ['the giver', 'the other', 'the third', 'the fourth'] } }),
    pick('tf', 'What', TOWN_FACTS, 'coffers', { show: { of: ['the town'] } }),
    pick('plf', 'What', ['name', 'health', 'health (%)', 'coins', 'fame', 'standing in the town', 'land', 'at sea', 'aboard a ship'], 'name', { show: { of: ['a player in it'] } }),
    pick('wf', 'What', ['day', 'hour', 'weather', 'the wall is down', 'ships at sea', 'stories going'], 'day', { show: { of: ['the world'] } }),
    P('name', 'text', 'Kept as', 'found')],
  out: [out('next', 'Then')],
});
people('st.ask', {
  title: 'A word, with conditions', waits: true,
  help: 'Like A word with someone, with up to five answers, each of which can ask something of the player: an item (taken), coins (paid), a value of the story at least so much. An answer they can\'t give is shown greyed (or not at all).',
  props: [pick('who', 'With', ROLES4, 'giver'), P('ask', 'text', 'The player says', 'About what you said...'), P('text', 'text', 'They say', 'Well? Have you thought about it?', { long: true }),
    ...['a', 'b', 'c', 'd', 'e'].flatMap((k, i) => [
      P(k, 'text', `Answer ${i + 1}`, i === 0 ? 'Here, take it.' : i === 1 ? 'Not yet.' : ''),
      pick(`${k}need`, `Answer ${i + 1} needs`, ['nothing', 'an item', 'coins', 'a value at least'], i === 0 ? 'an item' : 'nothing', { show: (g) => !!g(k) }),
      P(`${k}item`, 'item', `Answer ${i + 1}: item`, 'bread', { show: (g) => !!g(k) && g(`${k}need`) === 'an item' }),
      P(`${k}n`, 'number', `Answer ${i + 1}: how many`, 1, { min: 1, max: 9999, show: (g) => !!g(k) && g(`${k}need`) !== 'nothing' }),
      P(`${k}val`, 'text', `Answer ${i + 1}: value`, 'trust', { show: (g) => !!g(k) && g(`${k}need`) === 'a value at least' }),
    ]),
    P('hide', 'bool', 'Hide answers they can\'t give', false, { adv: true }), P('bye', 'text', 'Then they say', '', { adv: true })],
  out: [out('a', 'Answer 1'), out('b', 'Answer 2'), out('c', 'Answer 3'), out('d', 'Answer 4'), out('e', 'Answer 5')],
});
people('st.chat', {
  title: 'Two of them talk',
  help: 'A little scene: lines said aloud in turn, one a line ("giver: ...", "other: ...", "third: ..."; a line with no name, by whoever spoke before). Goes on at once, or once it\'s said.',
  props: [P('lines', 'text', 'Lines', 'giver: Did you hear what happened at the mill?\nother: Hush. Not here.\ngiver: Then where?', { long: true }), P('gap', 'number', 'Seconds between', 3, { min: 1, max: 12 }), P('wait', 'bool', 'Waits till it\'s said', true)],
  out: [out('next', 'Then')],
});

// ============================================================ towns and realms
town('st.town', {
  title: 'The town changes',
  help: 'The story\'s town changed: its coffers, its taxes, everyone\'s mood, its stores of wood and stone, a law made or lifted, a new name, a feast day, the players\' standing there, how wanted they are, a line in its records, a shop stocked.',
  props: [pick('what', 'Change', TOWN_CHANGES, 'coffers'), pick('how', 'How', ['add', 'set'], 'add', { show: { what: ['coffers', 'tax %', 'everyone\'s mood', 'wood', 'stone', 'your standing', 'wanted'] } }),
    P('value', 'text', 'By / to', '50', { show: { what: ['coffers', 'tax %', 'everyone\'s mood', 'wood', 'stone', 'your standing', 'wanted', 'a feast day', 'stock a shop'] } }),
    pick('law', 'Law', LAW_LIST, 'curfew', { show: { what: ['a law'] } }), P('on', 'bool', 'Made (unticked: lifted)', true, { show: { what: ['a law'] } }),
    P('text', 'text', 'Words', '{giver} was seen at the gate.', { show: { what: ['name', 'a line in its records'] } }), P('item', 'item', 'Item', 'bread', { show: { what: ['stock a shop'] } }), pick('shop', 'Shop', SHOP_KINDS, 'shop', { show: { what: ['stock a shop'] } })],
  out: [out('next', 'Then')],
});
town('st.realm', {
  title: 'Realms',
  help: 'The town\'s realm and another: war declared, peace made, warmer or colder feelings between them. The other: the nearest realm, one on another land, or the realm of a player in it.',
  props: [pick('what', 'They', ['go to war', 'make peace', 'grow warmer', 'grow colder'], 'grow colder'), pick('with', 'With', ['the nearest realm', 'a realm on another land', 'a realm it is at war with', 'the realm of a player in it'], 'the nearest realm'),
    P('n', 'number', 'By', 20, { min: 1, max: 100, show: { what: ['grow warmer', 'grow colder'] } }), P('why', 'text', 'Over', 'what happened in {town}', { show: { what: ['go to war'] } })],
  out: [out('next', 'Then'), out('no', 'Couldn\'t')],
});
town('st.move', {
  title: 'The story moves',
  help: 'The story goes on in another town from here (its board, its people, "the town" in it): the nearest other, one on a land you choose, its realm\'s capital, or the town of someone in it.',
  props: [pick('to', 'To', ['the nearest other town', 'a town on a land', 'its realm\'s capital', 'the town of the other', 'the town of a player in it'], 'the nearest other town'), pick('land', 'Land', LANDS.map(([n]) => n), 'Thessa', { show: { to: ['a town on a land'] } }),
    P('line', 'text', 'In its history', 'The trail led to {town}.')],
  out: [out('next', 'Then'), out('no', 'Nowhere')],
});
town('st.newcomer', {
  title: 'Someone arrives',
  help: 'Someone new comes to live in the town (of a trade, if it has work for one): in the story from now on, as the third or the fourth, if you like.',
  props: [pick('job', 'Trade', [['any', 'any'], ...JOB_LIST], 'any'), P('first', 'text', 'First name (blank: any)', ''), pick('role', 'In the story as', ['nobody', 'third', 'fourth'], 'third')],
  out: [out('next', 'Then'), out('no', 'No room')],
});
town('st.dungeon', {
  title: 'A dungeon',
  help: 'The nearest dungeon to the town (of a kind, if you like) marked on the players\' maps, and the story\'s place from now on (tasks "far out" and "the story\'s place" go there).',
  props: [pick('kind', 'Of the kind', DUNGEON_KINDS, 'any'), P('label', 'text', 'Marked as', 'Where {other} was last seen'), P('far', 'number', 'No further than (blocks)', 600, { min: 50, max: 4000, adv: true })],
  out: [out('next', 'Then'), out('none', 'None near')],
});
town('st.weather', {
  title: 'The weather turns',
  help: 'Rain, snow, fog, or clear skies, for so many hours (or the weather as it would be, again).',
  props: [pick('kind', 'To', ['rain', 'snow', 'fog', 'clear', 'as it would be'], 'rain'), P('hours', 'number', 'For (hours)', 6, { min: 1, max: 96 })],
  out: [out('next', 'Then')],
});
town('st.pin', {
  title: 'A mark on the map',
  help: 'A place marked on the map (with words, and a mark of your choosing), for everyone.',
  in: [dat('at', T.pos, 'At (wired: a place)')],
  props: [pick('at', 'At', PLACES, 'the story\'s place'), P('label', 'text', 'Words', 'Something buried here'), pick('glyph', 'Mark', ['!', '?', '*', 'X', '+', '•', '†', '⚑'], 'X')],
  out: [out('next', 'Then')],
});

// ============================================================ the players
plays('st.coins', {
  title: 'Coins',
  help: 'Coins given to the players in the story (each), or asked of one of them: paid (by Paid) or not (by Couldn\'t).',
  props: [pick('how', 'Coins', ['given', 'asked for'], 'given'), P('n', 'number', 'How many', 25, { min: 1, max: 99999 }), P('text', 'text', 'Told', '', { adv: true })],
  out: [out('next', 'Then'), out('no', 'Couldn\'t')],
});
plays('st.harm', {
  title: 'Befalls the players',
  help: 'The players in the story hurt, healed, or given a condition (burning, chilled, stunned, poisoned, quickened, slowed, mending, weakened, shielded).',
  props: [pick('what', 'They are', ['hurt', 'healed', 'given a condition'], 'healed'), P('n', 'number', 'How much', 5, { min: 1, max: 999, show: { what: ['hurt', 'healed'] } }),
    pick('status', 'Condition', STATUSES, 'regen', { show: { what: ['given a condition'] } }), P('secs', 'number', 'Seconds', 10, { min: 1, max: 600, show: { what: ['given a condition'] } }), P('text', 'text', 'Told', '', { adv: true })],
  out: [out('next', 'Then')],
});
plays('st.send', {
  title: 'The players are taken',
  help: 'The players in the story taken somewhere at once (a blackout with words, if you like: carried off, dreamt...).',
  in: [dat('at', T.pos, 'To (wired: a place)')],
  props: [pick('to', 'To', PLACES, 'the town'), P('lines', 'text', 'Blackout words (blank: none)', '', { long: true })],
  out: [out('next', 'Then')],
});
plays('st.fame', {
  title: 'Spoken of',
  help: 'The players in the story better known (or, below 0, less); and how many bounties and tasks they\'re thought to have done.',
  props: [P('n', 'number', 'Fame', 2, { min: -20, max: 20 }), P('text', 'text', 'Told', '', { adv: true })],
  out: [out('next', 'Then')],
});
plays('st.scene', {
  title: 'A moment',
  help: 'Sound and light for the players in the story: the screen shaken or flashed, a sound, music (the game\'s own, or one of your songs), sparks at a place, one of your effects.',
  in: [dat('at', T.pos, 'At (wired: a place)')],
  props: [pick('at', 'At', PLACES, 'the giver'), P('shake', 'number', 'Shake (0: none)', 0, { min: 0, max: 1, step: 0.05 }), P('flash', 'color', 'Flash', '#000000'), P('flashT', 'number', 'Flash (seconds; 0: none)', 0, { min: 0, max: 3, step: 0.05 }),
    { id: 'sound', t: 'sound', label: 'Sound', opts: ['(none)', ...SOUNDS], def: '(none)' }, pick('music', 'Music', [['', '(as it is)'], ['stop', '(stopped)'], ['song', 'a song of yours'], ...THEME_LIST], ''),
    P('song', 'song', 'Song', null, { show: { music: ['song'] } }), P('musicT', 'number', 'Music for (seconds; 0: till stopped)', 0, { min: 0, max: 3600, show: { music: { not: ['', 'stop'] } } }),
    P('sparks', 'color', 'Sparks', '#000000'), P('vfx', 'vfx', 'Effect', null)],
  out: [out('next', 'Then')],
});
plays('st.card', {
  title: 'Words across the screen',
  help: 'Words across the screens of the players in the story, large, for a few seconds: a place reached, a vow, the end of a chapter.',
  props: [P('title', 'text', 'Words', 'Three days later...'), P('sub', 'text', 'Beneath', ''), P('secs', 'number', 'Seconds', 4, { min: 1, max: 12 }), P('color', 'color', 'Colour', '#f0d890')],
  out: [out('next', 'Then')],
});

// ============================================================ the sea
sea('st.ship', {
  title: 'A ship comes',
  help: 'A ship (sloop, brigantine, galleon or frigate) on the water off the town or off the players, with her crew: at anchor and friendly, passing, or under black colours and after the players. She\'s the story\'s ship (for If, Wait till, The story\'s ship).',
  props: [pick('type', 'Ship', SHIP_KINDS, 'brigantine'), pick('side', 'She is', ['at anchor, friendly', 'passing by', 'after the players', 'the town\'s, at anchor'], 'at anchor, friendly'), pick('off', 'Off', ['the town', 'a player in it', 'far out'], 'the town'),
    P('name', 'text', 'Called', 'The {giver}'), P('crew', 'number', 'Hands (0: as she needs)', 0, { min: 0, max: 30, adv: true }), P('cargo', 'item', 'Her hold: item', null, { adv: true }), P('cargoN', 'number', 'Her hold: how many', 10, { min: 1, max: 999, adv: true })],
  out: [out('next', 'Then'), out('no', 'No water near')],
});
sea('st.shipdo', {
  title: 'The story\'s ship',
  help: 'What the story\'s ship does now: sails to the town, to the players, turns on them, weighs anchor and leaves, drops anchor, is given to a player in it (hers to sail), founders.',
  props: [pick('what', 'She', ['sails to the town', 'sails to the players', 'turns on the players', 'drops anchor', 'weighs anchor and leaves', 'is given to a player in it', 'founders'], 'sails to the town')],
  out: [out('next', 'Then'), out('no', 'No ship')],
});
sea('st.fleet', {
  title: 'Ships are sent',
  help: 'The town\'s realm sends ships across the sea (if it has the means: its learning): merchantmen, settlers, a man-of-war, a cargo hulk, to a port of another land. Sailing as the realms\' ships do, on the world map.',
  props: [pick('kind', 'Sends', [['trade', 'merchantmen'], ['settlers', 'settlers'], ['war', 'a man-of-war'], ['cargo', 'a cargo hulk']], 'trade'), pick('to', 'To', ['the nearest port of another land', 'a port of a realm at war with it', 'a port on a land'], 'the nearest port of another land'),
    pick('land', 'Land', LANDS.map(([n]) => n), 'Velmarch', { show: { to: ['a port on a land'] } }), P('any', 'bool', 'Even without the learning', false, { adv: true })],
  out: [out('next', 'Then'), out('no', 'Couldn\'t')],
});

// ============================================================ values
vals('st.calc', {
  title: 'Work it out',
  help: 'One of the story\'s values worked out from two others (typed, with {values} in them, or wired in from any value node): added, taken away, times, divided, the least, the most, what\'s left over, a random number between, joined as words.',
  in: [P('a', T.any, 'This', '{gold}'), P('b', T.any, 'And', '1')],
  props: [P('name', 'text', 'Kept as', 'gold'), pick('op', 'Is', ['this + that', 'this - that', 'this × that', 'this ÷ that', 'the least', 'the most', 'what\'s left over', 'a random number between', 'this to the power', 'joined as words', 'rounded'], 'this + that')],
  out: [out('next', 'Then')],
});
vals('st.keep', {
  title: 'Keep a value',
  help: 'A value kept beyond the story: the world\'s ({world:name}, for your graphs too), or each player\'s in it ({player:name}); set, added to, or words.',
  in: [P('value', T.any, 'Value', '1')],
  props: [pick('scope', 'Kept by', ['the world', 'each player in it'], 'the world'), P('name', 'text', 'Name', 'deeds'), pick('op', 'To', ['set', 'add', 'take away', 'words'], 'add')],
  out: [out('next', 'Then')],
});

// ============================================================ the story's own (values for any node)
def('st.who', {
  cat: 'Story: values', story: true, color: C.who, title: 'Who\'s in it',
  help: 'The story\'s people and places, for any node wired in: the giver, the other, the third, the fourth (where they\'re about), a player in it, its town, where its task is, the story\'s place, its ship.',
  in: [],
  out: [{ id: 'giver', t: T.ent, label: 'The giver' }, { id: 'other', t: T.ent, label: 'The other' }, { id: 'third', t: T.ent, label: 'The third' }, { id: 'fourth', t: T.ent, label: 'The fourth' },
    { id: 'player', t: T.ent, label: 'A player in it' }, { id: 'town', t: T.town, label: 'Its town' }, { id: 'task', t: T.pos, label: 'Where its task is' }, { id: 'place', t: T.pos, label: 'The story\'s place' }, { id: 'ship', t: T.pos, label: 'Its ship' },
    { id: 'title', t: T.text, label: 'Its title' }, { id: 'days', t: T.num, label: 'Days since it began' }],
});
def('st.value', {
  cat: 'Story: values', story: true, color: C.who, title: 'A story value',
  help: 'One of the story\'s values ({name}), for any node wired in.',
  in: [],
  props: [P('name', 'text', 'Value', 'trust')],
  out: [{ id: 'out', t: T.any, label: 'Its value' }],
});

export const STORY_NODE_TYPES_2 = ['st.switch', 'st.loop', 'st.once', 'st.cycle', 'st.mark', 'st.jump', 'st.when', 'st.race', 'st.meanwhile', 'st.retitle', 'st.endstory', 'st.reveal',
  'st.cast', 'st.walk', 'st.escort', 'st.turn', 'st.fate', 'st.person', 'st.learn', 'st.ask', 'st.chat',
  'st.town', 'st.realm', 'st.move', 'st.newcomer', 'st.dungeon', 'st.weather', 'st.pin',
  'st.coins', 'st.harm', 'st.send', 'st.fame', 'st.scene', 'st.card',
  'st.ship', 'st.shipdo', 'st.fleet',
  'st.calc', 'st.keep', 'st.who', 'st.value'];
