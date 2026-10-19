// (Round 126; rewritten Round 127) The old places, and what was here
// before anyone: a delver's
// notes on the barrows, mines, crypts and caves about a town (each one's
// story, what it's like, what lives in it, how deep it goes, who has gone
// down and who came back), and the scholars' books of the Kavorent, their
// spires and their arts, and the four things older still. See annals.js
// for how these are written.
//
// The models are the old guides for walkers in wild country, and the notes
// of people who go into caves for pleasure: practical, unboastful, exact
// about the way in and the way out, and quietly frightened.
export const FLOWS = {
  oldplace: [
    ['story', 'what', 'dwell', 'deep', 'fate'],
    ['story', 'way', 'what', 'dwell', 'fate', 'warn'],
    ['story', 'way', 'dwell', 'deep', 'warn'],
    ['story', 'what', 'deep', 'dwell', 'warn'],
    ['story', 'dwell', 'what', 'fate', 'warn'],
    ['story', 'what', 'dwell', 'fate'],
    ['story', 'deep', 'what', 'dwell', 'warn'],
  ],
  delvefar: [
    ['open', 'warn'],
    ['open'],
  ],
  delveopen: [
    ['why', 'how', 'warn'],
    ['why', 'warn'],
  ],
  kavwho: [
    ['before', 'what', 'choir', 'left'],
    ['before', 'choir', 'what'],
    ['what', 'choir', 'left', 'doubt'],
  ],
  spire: [
    ['where', 'look', 'names'],
    ['where', 'names', 'look', 'inside'],
    ['where', 'look', 'inside'],
  ],
  arts: [
    ['cores', 'art', 'who'],
    ['cores', 'who', 'art'],
  ],
  art: [
    ['what', 'held'],
    ['what', 'none'],
  ],
  elder: [
    ['story', 'where', 'what', 'warn'],
    ['story', 'what', 'warn'],
    ['story', 'where', 'warn'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ a delver's notes
  'delvefar.open': [
    'The places that follow are not {town}\'s own, but they lie near enough that its people know the stories of them, and I have set them down too.',
    'Further off, about {other} and the villages round it, there are other old places, and a few of them are stranger than any already set down.',
    'A day or two beyond {town} the country holds more old places still; I give them more briefly, for I know them less well.',
  ],
  'delvefar.warn': [
    'I have been into fewer of these myself, and I give what follows as I was told it.',
    'What follows is mostly hearsay, and I have marked it as such where I could.',
  ],
  'delveopen.why': [
    'There are more old places about {town} than the townsfolk care to count, and each one of them has its story.',
    'I have been down into a few of the old places near {town}, and listened to what is told of all of them.',
    'These are a delver\'s notes on the old places about {town}: what I saw below, and what I was told above.',
    'Every town keeps a few places it does not talk about after dark, and {town} keeps more than most.',
  ],
  'delveopen.why@plain': [
    'These are notes on the old places near {town}. I have been to some of them.',
  ],
  'delveopen.why@storyteller': [
    'Ask anyone in {town} about the old places, and they will tell you three stories, two warnings and the name of someone who never came back.',
  ],
  'delveopen.how': [
    'I went down with two lamps, good rope, a blade and more bread than I needed, and came back each time, which is more than some can say.',
    'I am no hero, and I went into these places the way a sensible person goes into cold water: slowly, and ready to get out.',
  ],
  'delveopen.warn': [
    'Let nobody take these pages for a map to treasure.',
    'The reader who means to follow me had better go in company, and come back before dark.',
    'Whoever goes down should tell someone above where they have gone, and when to start worrying.',
  ],
  'oldplace.way': [
    'The way in is easy to miss: a gap in the rock no wider than a door, with a thorn bush grown half across it.',
    'You will know the way in by the cold air that comes out of it, even on the hottest day of summer.',
    'A track runs to it from the road, worn by more feet than you would expect, and fewer coming back than going.',
    'There is a cairn of stones by the way in, and every delver who comes out alive adds one to it.',
  ],
  'oldplace.what': [
    'It is cold and damp below, and the air smells of earth and old stone.',
    'The way in is low and narrow, and beyond it the passages run on further than a lamp will show.',
    'Sound carries strangely below: a dropped stone seems to go on falling long after it ought to have stopped.',
  ],
  'oldplace.what.barrow': [
    'The barrow is a long mound of turf over a stone chamber, with its great stone door on the east side, facing the sunrise.',
    'Inside, the passages are walled with standing slabs, and the grave goods lie where they were set down, under a fur of dust.',
    'The roof of the first chamber is low enough that a tall delver goes bent double, which, they say, is how the dead meant it.',
  ],
  'oldplace.what.mine': [
    'The galleries run deep under the hill, propped with old timber that groans when anyone walks beneath it.',
    'The miners\' rails still lead down into the dark, and their carts stand where they were left, half full of ore.',
    'Water drips everywhere below, and in the deepest workings it stands knee-deep and very cold.',
  ],
  'oldplace.what.crypt': [
    'The vaults are half drowned, and the niches stand open along the walls, most of them empty and some of them not.',
    'The stair down is worn hollow in the middle by the feet of the old priests, and slick with the damp.',
    'Below, the air is thick with the smell of old incense and older water, and the lamps burn low.',
  ],
  'oldplace.what.holdout': [
    'The caves are walled up like a keep, with stockades of timber and arrow slits hacked into the rock.',
    'Whoever holds the caves has built well: there is one way in, and it is overlooked from three sides.',
  ],
  'oldplace.what.grove': [
    'The hollow opens among the roots of the oldest tree in the wood, where the air smells green.',
    'The roots go down a long way, and the passages between them are lined with moss that glows faintly when touched.',
    'It is warm below, and quiet, and there is a smell like fresh-turned earth and honey, which is not reassuring.',
  ],
  'oldplace.what.forge': [
    'The halls are warm even now, and glow dull red with embers that nobody living has fed.',
    'The anvils still ring now and then, they say, though no smith has worked there in a hundred years.',
  ],
  'oldplace.what.grotto': [
    'The sea caves fill with the tide, and can only be entered at the lowest ebb, and left before the turn.',
    'The rock below is slick with weed and sharp with shells, and the sea booms in the deeper chambers like a great slow drum.',
  ],
  'oldplace.what.kavorent': [
    'The spire stands taller than the highest tower of {land}, black and seamless as a blade.',
    'Close to, the spire hums, very faintly, like a hive heard through a wall.',
  ],
  'oldplace.dwell': [
    'What lives below now are {dwellers}, or so those who came back say.',
    'The delvers who have gone down tell of {dwellers}, and of worse things deeper.',
    'I met {dwellers} below, and did not stay to meet anything else.',
    'Below there are {dwellers}, and they know the dark better than any visitor will.',
  ],
  'oldplace.dwell.kav': [
    'The few who claim to have been inside speak of {dwellers}, which keep its halls as if their makers were coming back.',
  ],
  'oldplace.deep': [
    'It goes {depth} down, and each one is darker than the one above.',
    'There are {depth} below the ground, or at least that is as far as any delver has gone and come back.',
  ],
  'oldplace.deep.one': [
    'It is not deep, a single level below the ground, but one level of it is plenty for most.',
  ],
  'oldplace.fate.none': [
    'Nobody has yet reached the bottom of it, or nobody who lived to tell of it.',
    'No party of delvers has gone down in living memory, so whatever is down there has been left alone ever since.',
  ],
  'oldplace.fate.delved': [
    '{delves} parties of delvers have gone down in my time, and not all of them came back.',
    'Delvers have gone down there {delves} times that I know of, and not one of them has reached the bottom.',
  ],
  'oldplace.fate.cleared': [
    'It was made safe by {clearedby}, and the way in fell shut behind them.',
    '{clearedby} went down and put an end to what ruled it, and the way in has stayed shut ever since.',
  ],
  'oldplace.warn': [
    'Never go down alone, and never carry off anything that was laid there for the dead.',
    'Those who go in for treasure come out with less than they took in, if they come out at all.',
    'This is no place for the careless, and I say so as plainly as I can.',
    'Take twice the oil you think you need, and turn back while you still have half of it.',
  ],
  'oldplace.warn@storyteller': [
    'My advice, for what it is worth, is to admire it from the road, and then go and have your supper.',
  ],
  'oldplace.warn@pious': [
    'Say a prayer to {god} at the way in, and another at the way out, if you are spared to say it.',
  ],

  // ------------------------------------------------------------ the Kavorent
  'kavwho.before': [
    'Before the {people}, before (any|the first) (people|folk) (came|walked) (on|to) {land}, the Kavorent were here.',
    'No (song|chronicle) of {land} (goes|reaches) back far enough to (tell|say) when the Kavorent came, or when they (went|were gone).',
  ],
  'kavwho.what': [
    'They (made|built) things (no one|nobody) since has (understood|been able to make): the spires, the (cores|engines), the (runes|glyphs) that (crawl|move) (on|across) the stone.',
    'Whatever they were, they knew far more than anyone since, and their works have outlasted every (realm|kingdom) of {land}.',
  ],
  'kavwho.choir': [
    'The (glyph|old) (readers|scholars) (say|believe) the Kavorent (meant|chose) to leave their bodies: they lay down in (pods|cradles) in the (deep|cradle) halls, and their minds went up (into|to) the Choir, to wait out the long count together.',
    'The (scholars|glyph-readers) (call|name) it the Choir: (all|every one) of the Kavorent (at once|together), (thinking|waiting) (in|inside) the (spires|stone), (as|while) the long count (goes|runs) on.',
  ],
  'kavwho.left': [
    'The things they left (behind|below) (still|) (keep|watch) their (halls|works): (drones|constructs) that (mend|tend) what (breaks|wears out), and (wardens|golems) that will not (let anyone pass|suffer strangers to pass).',
  ],
  'kavwho.doubt': [
    '(How much|Whether any) of this is (true|so), (no one|nobody) (living|alive) (can|could) (say|swear); the glyphs (do not|will not) (give|yield) (up|) their (meaning|secrets) (easily|lightly).',
  ],
  'spire.where': [
    '{spire} (stands|rises) {where}.',
    'One spire (stands|rises) {where}: {spire}, (the|as the) (folk|people) (there|of {near}) call it.',
  ],
  'spire.look': [
    '(Its|The) stone is (warm|cold) to the touch (in|at) (every|any) season, and (hums|thrums) (faintly|very faintly) (if|when) (you|one) (lay|lays) (an ear|a hand) (to|on) it.',
    '(At night|After dark) (the|its) runes (glow|burn) (faint|pale) (blue|green), and (can|may) be seen (from|for) (miles|a long way) (off|around).',
    '(It|The spire) is (black|dark) and (smooth|seamless) (as|like) (glass|a blade), and runes (crawl|move) up its (sides|faces), (and|) (fade|glow), and come again.',
    'Nothing grows (near|close to) it, (and|) (birds|the birds) (will not|do not) (land|perch) on it.',
  ],
  'spire.names': [
    '(Every|Each) people (has|keeps) its own name for the spires, and its own (story|tale) of (who|what) (made|raised) them; {spire} is (what|only what) the {people} (call|name) this one.',
  ],
  'spire.inside': [
    'Its (door|way in), if it has one, (is|has) (never|not once) been (found|opened) by (anyone|any delver) (living|now living).',
    '(No one|Nobody) alive has been (inside|within) one, (or|at least) (no one|nobody) who (came|has come) out (to say so|and said so).',
    '(Those|The few) who (have|claim to have) (gone|been) (inside|within) (speak|tell) of (halls|rooms) of (sleepers|pods), (and|) of (wardens|things) that (do not|never) (sleep|rest).',
  ],
  'arts.cores': [
    'From the (spires|old places) (delvers|adventurers) (bring|carry) (out|home) (cores|the cores): (stones|hearts) of (light|cold light) that (hum|sing) (in|against) the (hand|palm).',
    'The cores (are|have been) (worth|counted worth) more than (gold|their weight in gold), (for|since) (with them|with enough of them) a realm (can|may) (learn|wake) the (arts|old arts) of the Kavorent.',
  ],
  'arts.who': [
    '{arts} (have been|are) (learned|woken) in {artrealms}, and no other realm can say as much (yet|as yet).',
  ],
  'art.what': [
    '(The|Of the arts, the) {art}: {artdesc}',
    'Then there is {art}. {artdesc}',
    '(Of|Concerning) {art}, the (glyph-readers|scholars) write (this|as follows): {artdesc}',
    '(Next|After that) (comes|is) {art}. {artdesc}',
  ],
  'art.held': [
    '(It is|This art is) (held|known) in {artrealms} (now|already).',
  ],
  'art.none': [
    '(No|Not one) realm (has|holds) (it|this art) (yet|as yet).',
  ],
  'elder.story': [
    '{story}',
  ],
  'elder.where': [
    '{place} (lies|is) on {land}, {where}.',
  ],
  'elder.what': [
    '(Inside|Within) its halls, (they|the few who came back) (say|tell), (live|wait) {dwellers}, and at its heart waits {master}.',
    '{master} is (older|far older) than the Kavorent, the oldest stories (say|hold), and has (outlived|outlasted) them as it may (outlive|outlast) us.',
  ],
  'elder.what.hero': [
    'He was the kindest (man|soul) (of|in) his (age|day), the (stories|old songs) (say|agree), and that is the (worst|saddest) of it.',
    '(Inside|Within) his hall, (they|the few who came back) (say|tell), (keep|wait) {dwellers}, and at its heart he (waits|keeps his watch) (still|yet).',
  ],
  'elder.warn': [
    'Do not go looking for it; but if you must, do not go (alone|unready).',
    'No (realm|army) has (ever|yet) (gone|marched) against it, and no ruler ever will, while rulers keep their sense.',
  ],
};
