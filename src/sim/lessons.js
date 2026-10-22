// (Round 83) What goes on in an Academy class (see saga/motifs/academy.js):
// the masters as people (each their own way of teaching, their own past
// and what they do with their evenings, not one of them the subject's
// usual sort), and each subject's lessons: what the master shows, the
// questions they put to the room (about how things really work: answer
// one right and you've learnt something you can use), and the work they
// set everyone to, done at the room's own oven, dummies, desk or bench.
import { RNG, hash4 } from '../util/rng.js';

// How a master teaches. Any of them may teach anything.
export const TEMPERS = {
  warm: {
    open: ['Come in, come in. Find a spot where you can see.', 'Good to see you all. Let\'s make something of today.'],
    right: ['Yes! That\'s exactly it.', 'Just so. You\'ve been paying attention.', 'Right, and well put.'],
    wrong: ['Not quite. But I can see the road you took to get there.', 'Close. Let\'s walk it back a step.', 'No, though plenty of good people think so.'],
    nudge: ['Take your time. Nobody\'s marking you down for thinking.', 'Have a go. A wrong answer here costs nothing.'],
    praise: ['Look at that. You should be pleased.', 'Lovely work.', 'That\'s the way.'],
    close: ['That\'s us for today. Well done, all of you.', 'Off you go. Come back hungry for more.'],
  },
  dry: {
    open: ['Ah. You came back. Brave.', 'Settle down. Or don\'t. I\'m paid either way.'],
    right: ['Correct. Try not to let it go to your head.', 'Right. I\'ll pretend I\'m not surprised.', 'Yes. Mark the day.'],
    wrong: ['No. Though I admire the confidence.', 'Wrong, but in an interesting direction.', 'Not even slightly. Still, you answered.'],
    nudge: ['The silence is lovely, but I did ask a question.', 'Anyone. Even a guess. Especially a guess.'],
    praise: ['Hm. That\'s actually good.', 'I\'ll allow it. It\'s good.', 'Better than mine, the first time. Don\'t tell anyone.'],
    close: ['That\'ll do. Go and be clever somewhere else.', 'We\'re done. Mind the door; it bites.'],
  },
  storyteller: {
    open: ['Sit. Before we start, I\'ll tell you about a storm I once rode out...', 'Today puts me in mind of the year the river froze. Never mind: later.'],
    right: ['Right! My old teacher would have bought you a drink for that.', 'Just so. It took me a winter on the road to learn that.', 'Yes. And there\'s a story behind why, if we\'ve time.'],
    wrong: ['No. I said the same once, and paid for it.', 'Not that. I knew someone who thought so; they don\'t think so any more.', 'Afraid not. Let me tell you how I found out.'],
    nudge: ['Think of it like a road you\'ve walked. Where does it go?', 'Anyone? You\'ll have a story of your own about it, I\'d bet.'],
    praise: ['That\'s the one I\'ll tell the next lot about.', 'Good! You\'ll remember doing that.', 'Now that\'s a tale worth telling.'],
    close: ['That\'s the end of today\'s chapter.', 'Go on. Make some stories of your own.'],
  },
  quiet: {
    open: ['...Good. Let\'s begin.', 'Watch first. Then we\'ll talk.'],
    right: ['Yes.', 'Good. Exactly.', 'Mm. Right.'],
    wrong: ['No. Look again.', 'Not that.', 'Hm. No. Think about why.'],
    nudge: ['...Anyone?', 'Take a moment.'],
    praise: ['Good.', 'There. You see?', 'Well done.'],
    close: ['Enough for today.', 'Thank you. Go well.'],
  },
  restless: {
    open: ['Right, right, no time to waste, there\'s so much to get through!', 'Ooh, today\'s a good one. Up, up, everyone gather round!'],
    right: ['YES! That\'s it! See, see, I knew one of you had it!', 'Right! Brilliant! On we go!', 'Exactly! Ha!'],
    wrong: ['No, no, no, but good energy! Again!', 'Wrong! Wonderful! Now we can fix it!', 'Nope! Next!'],
    nudge: ['Come on, come on, somebody shout something!', 'Hands up! Any hand! A foot, even!'],
    praise: ['Look at that! Everybody look at that!', 'Ha! Marvellous!', 'That\'s the stuff!'],
    close: ['And that\'s time already?! Out you go, out!', 'Same again next time, only faster!'],
  },
  curious: {
    open: ['I\'ve been wondering something all week. Maybe you\'ll know.', 'Let\'s find something out together today.'],
    right: ['Yes. And how did you know? I want to hear.', 'Right. I\'d never thought of it put that way.', 'That\'s it. Huh. Nicely reasoned.'],
    wrong: ['No, but now I\'m curious why you thought so.', 'That\'s not it. What made you lean that way?', 'No. But it\'s a better wrong answer than most.'],
    nudge: ['What would you guess? I\'m honestly asking.', 'I want to hear what you think, not what\'s in the book.'],
    praise: ['Oh, that\'s clever. May I steal that?', 'I learnt something just now, watching you.', 'Very good. Show me again later?'],
    close: ['I\'ll be thinking about today for a while. Thank you.', 'That\'s all. Bring me your questions next time.'],
  },
  plain: {
    open: ['Morning. Let\'s get to it.', 'Right then. Hands, eyes, ears.'],
    right: ['That\'s right.', 'Aye, that\'s it.', 'Good. That\'ll serve you.'],
    wrong: ['No. Here\'s how it goes.', 'Not so. Easy mistake.', 'No. Watch.'],
    nudge: ['No shame in guessing.', 'Go on. Say it.'],
    praise: ['Good work. Honest work.', 'That\'ll do nicely.', 'You\'ve got the knack.'],
    close: ['That\'s the day done. Off home with you.', 'Good day\'s work. See you next time.'],
  },
};
export const TEMPER_KEYS = Object.keys(TEMPERS);

// Where a master learnt what they teach (none of them where you'd guess),
// what they do when they're not teaching, and something about them you
// notice in class.
const PASTS = {
  cooking: ['fed forty sailors twice a day on a ship that never quite docked', 'learnt at a roadside inn, from a grandmother who never measured anything', 'was a camp cook for a road crew, and found they liked feeding people more than digging', 'taught themselves from a book they couldn\'t read at first, working out the words from the pictures', 'grew up on a farm where nothing was wasted, ever'],
  dueling: ['learnt it as a dance before anyone told them it was fighting', 'was taught by their mother, a ferry pilot who\'d seen off river pirates', 'took up the sword late, after years as a mason, and still thinks of it like laying stone', 'was a bandit once, turned themselves in, and has been making up for it since', 'learnt from a one-armed fencer who said it was all in the feet'],
  research: ['was a miner who started asking why the rock lay the way it did', 'kept a lighthouse, and filled the long nights with questions', 'was a weaver who saw numbers in the patterns and couldn\'t stop counting', 'trained as a healer, and wanted to know why the cures worked', 'went to sea as a navigator and came back with a head full of stars'],
  gemcraft: ['grew up the child of glassblowers, and wanted something that didn\'t shatter', 'was a locksmith first: small parts, steady hands, patience', 'found their first stone in a riverbed at seven and never stopped looking down', 'was a scribe who illuminated books, and liked colour more than words', 'mended clocks for a living before a jeweller saw their work'],
};
const PASTIMES = ['keeps bees on the Academy roof', 'plays the fiddle badly and happily', 'writes long letters to a sister across the sea', 'grows tomatoes in a window box and talks to them', 'is learning to swim, slowly', 'carves little wooden birds and leaves them about', 'walks the city walls every evening', 'collects old maps, the wronger the better', 'plays draughts at the tavern and loses on purpose to the old folk', 'sings in the temple choir, very loudly', 'rows on the river at dawn', 'keeps a fat, idle cat called Bishop'];
const QUIRKS = ['hums while they think', 'draws diagrams in the air with one finger', 'keeps a tally of right answers chalked on the wall', 'explains everything with apples, whatever the subject', 'calls everyone by their full name', 'sits on the table instead of a chair', 'always has tea going, and offers it round', 'claps once, loudly, when something goes right'];

// Each master their own: a temper, a past, a pastime, a quirk (seeded, so
// the same master stays the same).
export function masterNature(seed, subject, idx = 0) {
  const rng = new RNG(hash4(seed | 0, 0x7ea7, subject.length, idx));
  return {
    temper: rng.pick(TEMPER_KEYS),
    past: rng.pick(PASTS[subject] || PASTS.research),
    pastime: rng.pick(PASTIMES),
    quirk: rng.pick(QUIRKS),
  };
}

// Each subject's lessons: what the master shows (their words, and what
// they do it at: 'station' the room's own oven, dummies, desk or bench),
// the questions (the right answer first), and the work set the class.
export const LESSONS = {
  cooking: {
    stations: ['oven', 'furnace', 'table'],
    show: [
      'A pot on the furnace is about keeping it at a simmer: up stokes it, down lets it settle. Too hot and it boils over.',
      'An oven pie: crimp the crust the way the arrows tell you, then take it out when it\'s golden. Not before. Not after.',
      'At a campfire you turn the skewer as the marker crosses the glow. Three good turns and it\'s done right.',
      'At a table it\'s knife work: chop as each mark comes under the blade.',
      'Anything you like can go in, one to three things. What comes out depends on what goes in, and how well you cook it.',
      'A dish worth making again, write it down as a recipe. Made from the recipe, it comes out the same every time.',
    ],
    questions: [
      { q: 'Where do you keep a stew at a simmer?', a: ['In a pot on the furnace', 'On a campfire skewer', 'At the table'], why: 'The furnace pot: up stokes the fire, down lets it settle.' },
      { q: 'Baking a pie in the oven: what comes before taking it out?', a: ['Crimping the crust', 'Stirring the filling', 'Turning the skewer'], why: 'Crimp first, then out when it\'s golden.' },
      { q: 'At a campfire, when do you turn the skewer?', a: ['As the marker crosses the glow', 'When it starts to smoke', 'Whenever you like'], why: 'Watch the glow, and turn as the marker crosses it.' },
      { q: 'What does a delightful dish do for you?', a: ['Leaves you well fed: you heal faster', 'Makes you run faster', 'Nothing; it only tastes good'], why: 'Well fed, you mend quicker.' },
      { q: 'Made from a written recipe, how does a dish come out?', a: ['The same every time, if you have what goes in it', 'A little better each time', 'Worse, unless you\'re licensed'], why: 'A recipe makes it the same, no skill wanted, if you have the makings.' },
      { q: 'What\'s a table good for?', a: ['A platter or a salad', 'A stew', 'A loaf'], why: 'Tables are for knife work: platters and salads.' },
      { q: 'How many things can go into one dish?', a: ['One to three', 'Exactly two', 'As many as you like'], why: 'One to three. More is just a mess.' },
    ],
    work: {
      ask: 'Your turn. Cook something, anything, at the oven, the furnace or the table. I\'ll come round.',
      how: 'Use the kitchen\'s oven, furnace or table (F or right-click it) and cook something.',
      done: 'cooked something for the class',
    },
    npc: ['*stirs*', 'Is it meant to bubble like this?', 'Smells right, at least.', '*chop chop*', 'I think I under-crimped.'],
  },
  dueling: {
    stations: ['dummy'],
    show: [
      'To parry: raise your guard (hold right mouse) just before the blow lands. Too early and it\'s only a block.',
      'Land a parry and they reel, dazed and wide open for a moment. That\'s your opening: take it.',
      'Hold the strike before you let it go and it becomes your weapon\'s own special: a lunge, a sweep, a whirlwind, a leap. Slower, and the heavy ones cost you, but they land hard.',
      'Rolling gets you out of the way, but it costs stamina, and so does taking blows on a shield.',
      'A shield holds the parry open a little longer than a blade does. Forgiving, for the learning.',
      'Hit the dummy and watch what it shows you: what that blow would have done, and the run of them together.',
    ],
    questions: [
      { q: 'How do you parry?', a: ['Raise your guard just before the blow lands', 'Raise it the moment you see them', 'Roll toward them'], why: 'Just before it lands. Early is only a block.' },
      { q: 'What does someone do when you parry them?', a: ['Reels back, dazed and open for a moment', 'Falls down dead', 'Runs away'], why: 'They\'re dazed and open: that\'s your riposte.' },
      { q: 'How do you loose your weapon\'s special?', a: ['Hold the strike before letting it go', 'Strike twice quickly', 'Strike as you roll'], why: 'Hold, then release: the special.' },
      { q: 'What does rolling cost you?', a: ['Stamina', 'Health', 'Nothing at all'], why: 'Stamina. So does a blow taken on a shield.' },
      { q: 'A shield, against a blade, for parrying?', a: ['It holds the parry open a little longer', 'It can\'t parry at all', 'It parries by itself'], why: 'A little more forgiving, a shield.' },
      { q: 'Fighting with two blades: where does the second go?', a: ['In the off hand, where a shield would', 'On your back', 'You can\'t carry two'], why: 'Right-click a one-handed blade in your pack to carry it in the off hand.' },
      { q: 'What does a training dummy show you?', a: ['What each blow would have done', 'Nothing; it\'s straw', 'How much you\'ve earned'], why: 'Each blow\'s worth, and the run of them together.' },
    ],
    work: {
      ask: 'On the dummies, everyone. A few good blows each, and one heavy. I\'m watching your feet.',
      how: 'Strike a training dummy in the practice hall a few times (hold the click for your weapon\'s special).',
      done: 'worked the dummies',
      hits: 4,
    },
    npc: ['Hup!', '*thwack*', 'My arms...', 'Again!', 'Was that heavy enough?'],
  },
  research: {
    stations: ['desk'],
    show: [
      'The realm\'s learning is a tree, and the mayor keeps it. Four paths: Economy, Warfare, Law & Society, Engineering.',
      'Two steps side by side, crossed through between them, are a choice: learn one and the other is barred for good.',
      'At the study desk: rings of glyphs, each with one marked. Turn a ring and the one inside it turns too, by its gearing.',
      'When every ring\'s mark sits under the pointer at once, the thought comes clear: record it before the candle burns down.',
      'Insights one after another without a blot run on as a streak, each worth more than the last.',
      'A researcher studies at an academy, a library or a study: the realm\'s scholars set the problems.',
    ],
    questions: [
      { q: 'Who keeps the realm\'s tree of learning?', a: ['The mayor', 'The innkeeper', 'Nobody: it grows by itself'], why: 'Ask the mayor to see what the realm knows, and choose what\'s next.' },
      { q: 'Two steps side by side, crossed through: what does that mean?', a: ['Learn one and the other is barred', 'You must learn both together', 'Nothing: they\'re the same'], why: 'A choice. Choose well.' },
      { q: 'At the study desk, when does a thought come clear?', a: ['When every ring\'s mark is under the pointer', 'When the candle goes out', 'When you ring a bell'], why: 'All the marks under the pointer at once.' },
      { q: 'Turn one ring: what does the ring inside it do?', a: ['Turns too, by its gearing', 'Always stays still', 'Spins on its own'], why: 'By its gearing: half against, half along, right back, or not at all.' },
      { q: 'Insights one after another without a blot?', a: ['A streak, each worth more', 'Nothing more than usual', 'A headache, mostly'], why: 'Keep the streak: it pays.' },
      { q: 'Where can a researcher study?', a: ['An academy, a library or a study', 'Any tavern', 'Anywhere out of doors'], why: 'Somewhere with books and a desk.' },
      { q: 'The four paths of the tree?', a: ['Economy, Warfare, Law & Society, Engineering', 'Fire, Water, Earth and Air', 'Farming, Fishing, Mining, Hunting'], why: 'Economy north, Warfare east, Law south, Engineering west.' },
    ],
    work: {
      ask: 'To the desk, one at a time: work a problem through. The rest of you, write down what you see.',
      how: 'Use the lecture room\'s writing desk (F or right-click it) and work a problem through.',
      done: 'worked a problem at the desk',
    },
    npc: ['*scribbles*', 'If that ring turns half against...', 'Oh! Oh, I see it!', 'Can I borrow some ink?', 'Hm.'],
  },
  gemcraft: {
    stations: ['bench'],
    show: [
      'Ruby in a blade: a flaming swing. In armour, it sets alight whoever strikes you.',
      'Sapphire: frost. Quicker blades, arrows that chill, armour that slows them.',
      'Emerald: life. Hits that mend you, armour that closes your wounds.',
      'Topaz: lightning. Blows that arc. Amethyst: force, blows that stagger.',
      'Five shards of one stone fuse into a whole one at a jeweller\'s bench.',
      'Setting a stone, press each claw as the gleam comes under it, and leave a cracked claw well alone.',
    ],
    questions: [
      { q: 'What does a ruby do, set in a blade?', a: ['Fire: a flaming swing', 'Frost: a chilling cut', 'Life: hits that heal you'], why: 'Ruby is fire.' },
      { q: 'And sapphire?', a: ['Frost: quicker blades, chilling arrows', 'Lightning that arcs', 'Force that staggers'], why: 'Sapphire is frost.' },
      { q: 'Emerald, set in armour?', a: ['It closes your wounds', 'It burns attackers', 'It blinds attackers'], why: 'Emerald is life.' },
      { q: 'Which stone throws lightning?', a: ['Topaz', 'Onyx', 'Amethyst'], why: 'Topaz: blows that arc.' },
      { q: 'Five shards of one stone make?', a: ['A whole stone, at a jeweller\'s bench', 'A sword', 'Nothing useful'], why: 'Fused at the bench.' },
      { q: 'What can take a gem?', a: ['Weapons and armour', 'Only rings', 'Food, if you\'re brave'], why: 'Blades, bows and armour.' },
      { q: 'Setting a stone: which claw do you leave alone?', a: ['A cracked one', 'The first one', 'The brightest one'], why: 'A cracked claw slips. Leave it.' },
    ],
    work: {
      ask: 'At the bench, each of you: cut or set a stone. Gently. I\'ll lend a stone to anyone without one.',
      how: 'Use the gem workshop\'s jeweller\'s bench (F or right-click it) and set a stone in a weapon or a piece of armour.',
      done: 'set a stone at the bench',
    },
    npc: ['Steady... steady...', 'It cracked. It cracked!', 'Look how it catches the light.', 'Which claw was cracked again?', 'Hm.'],
  },
};

// A question as asked: its answers in an order of its own (and which is
// right).
export function shuffleQuestion(q, rng) {
  const order = rng.shuffle([0, 1, 2]);
  return { q: q.q, opts: order.map((i) => q.a[i]), right: order.indexOf(0), why: q.why };
}
