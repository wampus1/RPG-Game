// (Round 126) The old places, and what was here before anyone: a delver's
// notes on the barrows, mines, crypts and caves about a town (each one's
// story, what it's like, what lives in it, how deep it goes, who has gone
// down and who came back), and the scholars' books of the Kavorent, their
// spires and their arts, and the four things older still. See annals.js
// for how these are written.
export const FLOWS = {
  oldplace: [
    ['story', 'what', 'dwell', 'deep', 'fate'],
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
    '(These|The places that follow) are not {town}\'s own, but (they are|they lie) near enough (to|that) (its|the) (folk|people of {town}) (tell|know) (of|the stories of) them, and (I|this writer) (have|) (set them down|included them) (here|too).',
    '(Further off|A little further off), (about|near) {other} and (the|its) (towns|villages) (round about|nearby), (there are|lie) (more|other) old places, and (some|a few) of them (are|have been) (worse|stranger) (than|even than) those (above|already set down).',
  ],
  'delvefar.warn': [
    'I (have|) (been|gone) (down|in) (into|to) (fewer|none) of these (myself|in person), and (give|set down) (them|what follows) (as|for) (I|what I) was told.',
  ],
  'delveopen.why': [
    'There are (more|more of) old places (about|near) {town} than (most|the townsfolk) (would like|care to count), and (every|each) one of them (has|keeps) (a story|its story).',
    'I have (gone down|been down) into (some|a few) of the old places (about|near) {town}, and (heard|listened to) (the stories|what is told) of (the rest|all of them).',
    '(These|What follow) are (my|a delver\'s) notes on the old places (about|near) {town}: (what|all that) I (saw|found) (in them|below), and (what|all that) I was told.',
  ],
  'delveopen.how': [
    'I (went|have gone) down (with|carrying) (a lamp|two lamps), (a rope|good rope), (a blade|my blade) and more (bread|courage) than I (needed|turned out to need), and came back (every time|each time), (which|and that) is more than (some|many) can say.',
  ],
  'delveopen.warn': [
    'Let (no one|nobody) take these pages for (an invitation|a map to treasure).',
    'The reader (who|that) (means|plans) to (go down|follow me) (should|had better) (go|do so) (well armed|in company) and (come back|return) (before|by) dark.',
  ],
  'oldplace.what': [
    '(It is|The place is) (cold|dark) (and|) (damp|close) (inside|below), (and|) (the|its) (air|dark) (is|smells) (stale|of earth and old stone).',
    '(Its|The) (way in|door) (is|was) (low|narrow), (and|) (beyond it|past it) the (passages|halls) (go|run) (down|on) (further|deeper) than (any lamp|a lamp) (can|will) (show|light).',
  ],
  'oldplace.what.barrow': [
    'The barrow is (a long|a great) (mound|hill) of (earth|turf) (over|on) (stone|a stone chamber), with (a|its) (stone|great stone) door (on|in) the (east|west) side.',
    'Inside, (the|its) (passages|halls) are (lined|walled) with (dry stone|standing slabs), (and|) the (grave goods|old offerings) (lie|are laid) (where|as) they were (left|put down).',
  ],
  'oldplace.what.mine': [
    'The (galleries|workings) (go|run) down (and down|deep) (into the hill|under the hill), (propped|held up) with (old|rotten) (timber|props) that (creak|groan) when anyone walks under them.',
    'The (old|miners\') (rails|tracks) (still|) (run|lead) down into the dark, and the miners\' (picks|carts) (lie|stand) where they were left.',
  ],
  'oldplace.what.crypt': [
    'The chapel (above|over it) has (fallen in|long since fallen), and the stair down (goes|runs) under (black|still) water (before the bottom|halfway down).',
    'The vaults are (half drowned|full of black water), and the (tombs|niches) (stand|lie) (open|empty) along the walls.',
  ],
  'oldplace.what.holdout': [
    'The caves (are|were) (fortified|walled up) (like|as) a (keep|fort), with (barricades|stockades) of (timber|planks) and (murder holes|arrow slits) (cut|hacked) (into|in) the rock.',
  ],
  'oldplace.what.grove': [
    'The (hollow|way in) (opens|lies) (under|among) the roots of (a|the) (great|oldest) (tree|trees) (in|of) the wood, where the air smells (green|of moss and rot).',
  ],
  'oldplace.what.forge': [
    'The (deep|forge) (is|was) (hot|warm) (even now|still), (and|) (the|its) (halls|galleries) (glow|are lit) (red|dull red) (from|with) (fires|embers) (no one|nobody) (living|) (has fed|feeds).',
  ],
  'oldplace.what.grotto': [
    'The sea caves fill with the tide, and can only be (entered|gone into) at the lowest tides.',
  ],
  'oldplace.what.kavorent': [
    'The spire (stands|rises) (higher|taller) than (any|the highest) tower (of|in) {land}, (black|dark) and (smooth|seamless), (and|with) runes (crawling|that crawl) up its sides.',
  ],
  'oldplace.dwell': [
    'What lives (in it|below) now (are|is) {dwellers}, or so (the delvers|those who came back) say.',
    '(Those|The delvers) who (have gone|went) down (tell|speak) of {dwellers}, and (worse|worse things) (deeper|further down).',
    'I (met|saw) {dwellers} (below|in it), and (did not|would not) (stay|linger) to (meet|see) (more|anything else).',
  ],
  'oldplace.dwell.kav': [
    '(Those|The few) who claim to have been inside (speak|tell) of {dwellers}, (that|which) (keep|tend) (the|its) halls (still|as if their makers were coming back).',
  ],
  'oldplace.deep': [
    '(It|The place) (goes|runs) {depth} (deep|down), and each (level|one) is (worse|darker) than the one above.',
    'There are {depth} below the ground, or at least that is as far as any delver has gone and come back.',
  ],
  'oldplace.deep.one': [
    'It is (shallow|not deep), (a single|one) (level|floor) (below the ground|under the earth), (but|and) (that|one level of it) is (enough|plenty) (for anyone|for most).',
  ],
  'oldplace.fate.none': [
    '(No one|Nobody) has (yet|ever) (reached|come to) the bottom of it, or (no one|nobody) who lived to tell of it.',
    '(No|Not one) (band|party) of (delvers|adventurers) has (gone|been) down (in my time|in living memory), so whatever is (at the bottom|down there) (is there still|has been left alone ever since).',
  ],
  'oldplace.fate.delved': [
    '{delves} (bands|parties) of (delvers|adventurers) have (gone down|gone in) (in my time|in living memory), (and|but) (not all|few) of them (came|have come) back.',
    '(Delvers|Adventurers) (go|have gone) down (into it|there) {delves} times (in my time|that I know of), (and|but) (none|not one) of them (has|) (reached|come to) the bottom.',
  ],
  'oldplace.fate.cleared': [
    '(It was|The place was) (cleared|made safe) by {clearedby}, and the way in fell shut behind them.',
    '{clearedby} (went down|went in) and (killed|put down) (what|the thing that) (kept|ruled) it, and the way in (has|) (fallen|stayed) shut (since|ever since).',
  ],
  'oldplace.warn': [
    '(Do not|Never) go (in|down) (alone|by night), and (do not|never) (take|carry off) (anything|what you find) (that|which) (was|is) (left|laid) for the dead.',
    'Those who go in for (gold|treasure) come out with (nothing but their lives|less than they took in), if they come out at all.',
    'This is no place for the (curious|careless), and I say so as plainly as I can.',
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
