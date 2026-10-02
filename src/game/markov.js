// Small talk, made up as it's said, so nobody says quite the same thing
// twice, and what they say has something to do with who they are, what
// they do and what's going on around them.
//
// It's built in three layers:
//   1. A phrase grammar. Each topic (the weather, work, food, family, the
//      market, gossip, faith, the realm...) has a pool of sentence frames,
//      written with choices in them: "(The|This) rain (has|leaves) [the
//      whole of] {town} (soaked|dripping)". Expanded, a few dozen frames
//      make thousands of sentences, every one of them grammatical.
//   2. Word chains. For each speaker (their people, their way of talking,
//      their quirks, their trade) and each topic, the frames are expanded
//      into a corpus and a word chain is trained on it; a line is a walk
//      along the chain. Within one topic the joins between borrowed phrases
//      make sense, so the chain finds new sentences instead of gluing the
//      first half of a line about rain to the second half of one about
//      bread. Every three words in a row come from something real, and a
//      line that trails off, repeats itself or runs on is thrown back.
//   3. Talk. What they talk about is weighted by what's on their mind: the
//      weather when it's foul, food when they're hungry, prices when
//      something's short, their family, the person next door. Now and then
//      one thought leads to another ("Mind you, ..."). Then their manner:
//      a rough speaker drops letters, a child exclaims, a terse one says
//      half of it; and their people's dialect.
//
// Adding talk is adding lines: under BASE (everyone), CULTURE (each
// people, with a lexicon of word swaps), REGISTER (a way of talking), FLAVOR
// (a quirk) or JOBS (a trade), each keyed by topic. Slots ({town}, {god},
// {dish}, {drink}, {feast}, {realm}, {weather}, {other}, {scarce},
// {plenty}, {neighbour}, {friend}, {partner}, {child}, {time}) are filled
// in from where it's said; a frame whose slot can't be filled isn't used.
import { RNG, hash4 } from '../util/rng.js';
import { voiceOf } from './voice.js';

// ------------------------------------------------------------ the grammar
// "(a|b|c)": one of them; "[a]": sometimes.
export function expand(t, rng) {
  let i = 0;
  const seq = (stop) => {
    let out = '';
    while (i < t.length && !stop.includes(t[i])) {
      const ch = t[i];
      if (ch === '(') {
        i++;
        const alts = [seq('|)')];
        while (t[i] === '|') {
          i++;
          alts.push(seq('|)'));
        }
        i++;
        out += alts[Math.floor(rng.next() * alts.length)];
      } else if (ch === '[') {
        i++;
        const inner = seq(']');
        i++;
        if (rng.next() < 0.5) out += inner;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  };
  return seq('').replace(/\s+/g, ' ').replace(/\s([,.!?;])/g, '$1').trim();
}

// ------------------------------------------------------------ what's said
// Everyone's talk, by topic. (Topics with a ":" are only for when it's so:
// weather:rain when it's raining, and so on.)
const BASE = {
  'weather:rain': [
    '(This|The) rain (has|leaves) (the whole town|everyone|{town}) (soaked|dripping|in a sulk).',
    '(Rain|More rain), (again|and more to come). The (lane|square|road) is (pure mud|a river|a bog).',
    'At least the rain (saves|spares) (me|us) (hauling water|a trip to the well).',
    '(My roof leaks|My boots let in water|My cloak lets the rain through) (every time it rains|in weather like this).',
    'The (fields|gardens|crops) (will thank us|needed it), (I suppose|mind), (but|though) my (boots|knees) (won\'t|don\'t).',
    'You (can\'t|cannot) (dry anything|get anything dry|get a thing dry) in (this|weather like this).',
    'The (children|dogs) (love|are loving) the (puddles|mud), (at least|anyway).',
    'I (hung|put) the washing out (and|then) the rain came. (Typical|Of course).',
  ],
  'weather:snow': [
    '(The|This) snow (has|keeps) (everyone|half the town) (indoors|by the fire).',
    'I (can\'t|cannot) feel my (fingers|toes|nose) (in this cold|out here).',
    'The (well|trough) froze (over|solid) (again|last night).',
    'The (children|little ones) (have|have already) built (a snowman|three snowmen) (by the well|in the square).',
    '(Snow|This cold) makes (the roads|travel) (a misery|near impossible).',
    'A (hot|warm) (cup|mug) of {drink} by the fire is (all I want|the only cure for this cold).',
  ],
  'weather:fog': [
    '(This|The) fog (is so thick|is thick enough) you (could|can) (cut it|lose your own hand in it).',
    'I (walked|nearly walked) (straight|right) into (the well|a cart|the smithy door) in this fog.',
    '(Fog|Weather) like this always (gives me the shivers|puts me in a strange mood).',
    'You (can\'t|cannot) see (the next house|your own feet|across the square) (in this|this morning).',
  ],
  'weather:storm': [
    '(That|This) storm (nearly took|tore half|blew) the (roof|thatch|shutters) (off|clean off) my (house|neighbour\'s place).',
    'The (thunder|wind) (kept|had) (me|the whole house) (up|awake) (all night|half the night).',
    'Nobody (sensible|with sense) (goes|is) out in (a storm like this|weather like this).',
    'I (hope|pray) the (roofs hold|walls hold|old barn holds) (through the night|till morning).',
  ],
  'weather:fine': [
    '(What|Such) a (fine|lovely|glorious) (day|morning|afternoon) (for it|it is).',
    'Days like this (make me glad I live|remind me why I live|are why I live) in {town}.',
    '(The|This) sun (is|feels) (good|kind) on (old bones|the back|the face).',
    'Fine weather (means|brings) (busy streets|a busy market|everyone out of doors).',
    'If the (weather|sun) holds, (the harvest|the crops|the hay) (will|should) (be good|come in fine).',
  ],
  work: [
    'There\'s always (something|more) that needs doing (around here|in {town}|before nightfall).',
    'My (back aches|shoulders ache|hands are sore) from (all that|a day of) (lifting|work|bending).',
    '(Work|A day\'s work) never (ends|stops) (around here|in {town}), (does it|that\'s for sure).',
    'I (should|ought to) (mend|fix|see to) that (fence|roof|door|cart) before (the winter|the rain|it falls down).',
    'An honest day\'s work, an honest (day\'s pay|meal|night\'s sleep). That\'s (the way of it|all I ask).',
    'Some days I (think|wonder if) I (should|ought to) have (been|become) a (merchant|sailor|scholar|baker).',
    '(Up|Out) (before|at) dawn (again|every day), and (not a moment|no time) to (rest|sit down).',
    'I (finished|got through) (everything|my work) early (today|for once), and (nobody|not a soul) (noticed|said thank you).',
  ],
  food: [
    'They say the {dish} at the tavern is (better than ever|the best in years|worth the walk).',
    'I could (murder|do with|kill for) a (cup|mug) of {drink} (right now|about now|after today).',
    'Nothing beats (a bowl of|a plate of|good) {dish} (on a cold night|after a long day|with friends).',
    'You can tell a lot about a town by its (bread|ale|tavern|cooking).',
    'There\'s nothing like the smell of (fresh bread|{dish}|baking) in the (morning|evening).',
    '(My|Our) (mother|grandmother|neighbour) (made|makes) the (best|finest) {dish} in {town}.',
    'A (good meal|full belly) and a warm bed, (that\'s|and that is) all (I want|anybody needs).',
  ],
  hungry: [
    'I (haven\'t|have not) (eaten|had a proper meal) (since yesterday|in days|all day).',
    'My (belly|stomach) (is|has been) (growling|rumbling) (since dawn|all morning|all day).',
    'If (somebody|anyone) (has|had) a crust (to spare|going spare), I (wouldn\'t|would not) say no.',
    'The (larders|stores|shelves) are (bare|empty), and (prices keep|the price of bread keeps) going up.',
  ],
  family: [
    'Have you seen how fast the (children|little ones) are growing?',
    'I keep meaning to (visit|write to) my (cousin|sister|brother|aunt) in {other}.',
    'My (grandmother|grandfather|mother|old dad) always said (the river remembers|you reap what you sow|bread before boasting).',
    'Family is (everything|all you have|what matters), (in the end|when all is said and done).',
  ],
  partner: [
    '{partner} (says|thinks) I work too hard. (Maybe|Perhaps) {partner} is right.',
    'I (should|ought to) (bring|get) {partner} something (nice|from the market) (today|this week).',
    '{partner} and I (had words|had a row) this morning. (It\'ll blow over|We\'ll make up by supper).',
    'Married life suits me, (whatever|no matter what) {partner} (says|tells you).',
  ],
  child: [
    '(Little|Young) {child} (asked|wanted to know) (where the sun goes at night|why the sky is blue|how fish breathe). I (had no idea|didn\'t know).',
    '{child} (ran off|disappeared) (again|this morning), (up to|after) (no good|the river|some mischief), no doubt.',
    '{child} (wants|has decided) to be a (guard|smith|merchant|sailor) when they grow up.',
    'I (worry|fret) about {child} (more than I should|every day|all the time).',
  ],
  single: [
    'It gets (lonely|quiet) (of an evening|at night|in the house), (I won\'t lie|truth be told).',
    'Perhaps (this year|one day) I\'ll find someone (to share the hearth with|worth the trouble).',
    'Everyone (keeps|keeps on) asking when I\'ll (settle down|marry). (Let them ask|Not yet).',
  ],
  town: [
    'Everyone in {town} knows everyone else\'s business.',
    'I (wouldn\'t|would not) trade {town} for any city (in the world|under the sun).',
    '{town} (isn\'t|is not) what it (was|used to be), (but|though) (it\'s|it is) home.',
    'The (square|tavern|market) (was so loud last night|has been so busy all week|was packed last night).',
    '(Somebody|Someone) (keeps taking|walked off with) the good bucket from the well.',
    'The guards (have been|are) walking the streets more (often|than they used to).',
    'Nobody tells me anything around here.',
  ],
  thriving: [
    '{town} (is doing|has done) well (for itself|this year). (Fine|New) houses (going up|everywhere).',
    'Coin (comes|flows) into {town} (like water|from all over) these days.',
    'Never seen so many (merchants|strangers|carts) in {town}. Good for (trade|business), (I suppose|mind).',
  ],
  struggling: [
    'Times are hard in {town}. (Folk|People) are (counting every coin|tightening their belts).',
    'Half the (shops|stalls) are (empty|shut), and nobody (knows|can say) when it\'ll get better.',
    'Some (families|folk) have (packed up|left) for (better places|the cities). Can\'t say I blame them.',
  ],
  famine: [
    'There (isn\'t|is no) (bread|food|grain) to be had in {town} for love nor money.',
    'The (children|little ones) go to bed hungry. (It\'s|It is) not right.',
    'If the (next harvest|harvest) fails too, (I don\'t know|heaven knows) what we\'ll do.',
  ],
  market: [
    'The prices at the market keep going (up and up|up), (and|but) the wages (don\'t|stay the same).',
    'A merchant (told|was telling) me (strange tales|wild stories) of (the east|far-off lands|{other}).',
    'A traveller paid me twice what the job was worth. (Wish they all did|I didn\'t argue).',
    'I (paid|gave) (far|much) too much for (that|this) (cloth|cheese|knife). (Again|Never again).',
  ],
  scarce: [
    'You can\'t get {scarce} (for love nor money|anywhere|for any price) (round here|in {town}) (just now|these days).',
    'The price of {scarce} has gone (sky high|through the roof). (Somebody|Someone) (bought|must have bought) it all up.',
    'If (you|anyone) (had|has) {scarce} to sell, (you\'d|they\'d) (get|make) a (good|fine) price (here|in {town}).',
  ],
  plenty: [
    'There\'s so much {plenty} about, you can hardly give it away.',
    'You can get {plenty} for a song (here|in {town}) (just now|this week).',
    'Somebody flooded the market with {plenty}. (The merchants|The buyers) are rubbing their hands.',
  ],
  gossip: [
    '(You didn\'t hear it from me|Between you and me), but {neighbour} (has a secret|has a new sweetheart|owes half the town money).',
    '{neighbour} (snores|sings) so loudly I (can hear|hear) it through the wall.',
    '(I saw|Somebody saw) {neighbour} (sneaking|creeping) (out|home) (at night|before dawn). (What for, I wonder?|Up to no good, I reckon.)',
    '{neighbour} (borrowed|took) my (good|best) (ladder|pot|axe) and (never|still hasn\'t) (brought it back|returned it).',
    '{neighbour} (thinks|reckons) (they\'re|they are) (better than|above) the rest of us. (Ha|Hmph).',
  ],
  friend: [
    '{friend} and I (go back|have known each other) (years|since we were small).',
    'I (owe|still owe) {friend} (a drink|a favour|three coins), (come to think of it|now I think on it).',
    '{friend} (always|never) (knows|knew) (how to cheer me up|when to keep quiet).',
  ],
  faith: [
    '(I light a candle for {god} every morning|I lit a candle for {god} this morning|I light a candle for my mother, and one for {god}).',
    'The temple roof (needs mending|leaks), and I pray someone (sees to it|does something).',
    'Faith keeps a town together, (more than walls|more than coin|better than any guard).',
    'May {god} (keep|watch over) (us|{town}) (through the winter|through hard times|always).',
    'We give thanks to {god} (at every harvest|before every meal|each evening).',
  ],
  feast: [
    'Not long now (until|till) {feast}. (I can\'t wait|The whole town\'s talking of it).',
    'Come {feast}, (the whole town|everyone) (dances|sings) (till dawn|all night).',
    '(Last|At) {feast} (I danced|I ate|we sang) (till I dropped|more than was wise|till morning).',
  ],
  travel: [
    'The roads are busier than they used to be.',
    '(I dreamt of the sea last night, and I\'ve never even seen it|I keep dreaming of far-off cities, and I\'ve never been further than {other}|I dreamt of the mountains again, and I\'ve never set foot on one).',
    'They say the road to {other} (is|has become) (dangerous|thick with bandits|washed out) (lately|these days).',
    'A (caravan|merchant train) (came through|passed by) (yesterday|this week), (heading for|bound for) {other}.',
    'One day I\'ll (see|travel to) {other}, (and further|and beyond), (you see if I don\'t|mark my words).',
  ],
  past: [
    'Old folk say the winters were colder when they were young.',
    'The days go by so quickly (now|these days|the older you get).',
    'Things were (simpler|quieter|better done) when I was (young|a child|your age).',
    'I remember when {town} was (just|nothing but) a (handful of houses|few huts and a well).',
  ],
  realm: [
    '{realm} could do more for little (towns|places) like ours.',
    'The taxes (keep|seem to keep) going up, and (for what|what do we get for it), I ask you?',
    '(I heard|They say) the (mayor|council) (was|is) in a (foul|black) mood again.',
    'Whatever {realm} (decides|says), (it\'s|it is) us who (pay for it|feel it first).',
  ],
  war: [
    'This war (will|is going to) (ruin|be the end of) us all, (mark my words|you see).',
    'My (cousin|nephew|neighbour\'s eldest) (went off|was called up) to fight. (No word since|We pray for them every night).',
    'Every day I (hope|pray) to hear the war (is over|has ended).',
  ],
  nature: [
    'The (cat|dog) keeps bringing (mice|bones|frogs) to my door.',
    'I swear the (chickens|geese|goats) are plotting something.',
    'The (birds|crows) (were|have been) singing (since before dawn|all morning).',
    'I (found|saw) a (coin|fox|strange stone) in the road this morning.',
  ],
  musing: [
    'I could do with a quiet day for once.',
    'Funny, isn\'t it, how (the years slip|time slips|life slips) by.',
    'Work hard, eat well, sleep sound. That is the way of it.',
    'I (sometimes|often) wonder what (lies|is) beyond the (mountains|sea|hills).',
  ],
  'time:morning': [
    '(An early start|Up with the lark) (today|again). (The rooster|My neighbour\'s rooster) (saw to that|made sure of it).',
    'Mornings (are|were) (made|meant) for (work|bread and quiet), (not talk|I always say).',
  ],
  'time:evening': [
    'Nearly (supper|evening). (I can taste the {dish} already|Can\'t come soon enough).',
    'Long day. (I\'ll|I shall) sleep (well|like the dead) tonight.',
  ],
  'time:night': [
    'You (shouldn\'t|ought not) (be|wander) out this late. (Wolves|Thieves|Things) (about|abroad).',
    'Can\'t sleep. (Too much on my mind|The house creaks so).',
  ],
};

// Each people's own: what it cares about, how it puts things, and a
// dialect (words swapped over in whatever they say).
const CULTURE = {
  vale: {
    work: [
      '(The orchard is|The apple trees are) heavy with (fruit|apples) this year.',
      'The (sheep|goats) wandered off again, the (silly|daft) things.',
      'The mill wheel has been creaking (all week|since the rains).',
      'A good hedge makes a good neighbour, my (father|mother) (said|used to say).',
    ],
    food: [
      'Nothing beats a slice of (apple tart|honey cake) by the fire.',
      'A bowl of {dish} and a mug of {drink}, and all is (well|right with the world).',
      'My hens laid (twice as many|so many) eggs this week.',
    ],
    town: [
      'They say the old oak on the hill is older than {town}.',
      'We are simple folk in the vale, and proud of it.',
      'The meadow flowers are out (early|already) this (spring|year).',
    ],
    faith: ['We give thanks to {god} at (every|each) harvest (in the vale|with a sheaf of the first wheat).'],
    feast: ['Come {feast}, the whole valley dances (till dawn|round the maypole).'],
    lexicon: [[/\bfriend\b/g, 'neighbour'], [/\bvery\b/g, 'ever so']],
  },
  north: {
    work: [
      'The fjord froze early this year, and the boats sat idle.',
      'The herring run will be good, if the ice breaks soon.',
      'Strong arms and a sharp axe, that is all a body needs.',
      'My (father|grandmother) sailed further than anyone in {town}.',
    ],
    'weather:snow': ['Snow? This is nothing. (You should see|You should have seen) the winter (my father|we) had (as a child|in the old days).'],
    food: [
      'A warm bowl of {dish} is worth more than gold in winter.',
      'We drink {drink} to the memory of those lost at sea.',
    ],
    town: [
      'A northerner fears nothing but a cold hearth.',
      'The nights are long, but the stories are longer.',
      'The wolves came close to the (village|walls) again last night.',
    ],
    faith: ['May {god} watch the waves, (and remember the brave|and bring the boats home).'],
    feast: ['At {feast} we light fires on every hill.'],
    past: ['My grandmother could smell a storm a day away.'],
    lexicon: [[/\byes\b/g, 'aye'], [/\bYes\b/g, 'Aye'], [/\blittle\b/g, 'wee'], [/\bchildren\b/g, 'bairns'], [/\bvery\b/g, 'right']],
  },
  sun: {
    'weather:fine': [
      'The heat today would bake bread on the doorstep.',
      'Even the palms look tired in this heat.',
      'We drink {drink} in the shade and wait for evening.',
    ],
    work: [
      'The spice merchants are late this season.',
      'The wind brought sand into (everything|every pot and pan) again.',
      'My uncle crossed the dunes with forty camels once.',
    ],
    food: ['Give me {dish} and warm flatbread, and I am content.'],
    town: [
      'Hospitality is the first law of our people.',
      'Under the stars, the desert is the most beautiful place in the world.',
    ],
    faith: ['A guest at the door is a gift from {god}.', 'Praise to {god}, the well has not run dry.'],
    feast: ['At {feast} the lanterns turn the whole town to gold.'],
    lexicon: [[/\bfriend\b/g, 'cousin'], [/\bFriend\b/g, 'Cousin']],
  },
  wild: {
    'weather:rain': ['The rains came early, and the maize drank deep.'],
    work: [
      'The jaguar has been seen near the river again.',
      'The forest gives, and the forest takes back.',
      'My grandmother wove this cloth when she was a girl.',
    ],
    food: ['A cup of hot {drink} and the day is good.', 'Nobody cooks {dish} like my mother.'],
    town: [
      'The jungle hums all night, you get used to it.',
      'The parrots woke me before the sun again.',
      'The old stones in the forest are older than any kingdom.',
    ],
    faith: ['We leave an offering to {god} before the hunt.', 'Walk softly in the deep green, and it will let you pass.'],
    feast: ['At {feast} the drums do not stop till sunrise.'],
    lexicon: [[/\bfriend\b/g, 'kin'], [/\bFriend\b/g, 'Kin']],
  },
  high: {
    work: [
      'The deep seams sing when the ore is good.',
      'A hammer in the hand is worth two in the forge.',
      'My clan has worked these tunnels for twelve generations.',
      'The mountain does not forgive a careless step.',
      'Some say there is gold deeper than anyone has dug.',
    ],
    food: ['Nothing warms you like a pot of {dish} after a day in the mines.', 'A mug of {drink} and a good song, that is the way.'],
    town: ['Stone is honest. People, less so.', 'The lanterns in the hall have never once gone out.', 'My beard is my pride, and my axe is my honour.'],
    faith: ['We swear by {god} and the stone beneath our feet.'],
    feast: ['At {feast} the forges burn all night long.'],
    lexicon: [[/\bHello\b/g, 'Well met'], [/\bfriend\b/g, 'stonefriend'], [/\bvery\b/g, 'mighty']],
  },
};

// Ways of putting things (see voice.js).
const REGISTER = {
  formal: {
    town: [
      'I must confess, the affairs of the council weigh upon me.',
      'One must keep up appearances, whatever the season.',
      'Good order is the foundation of a good town.',
      'One hears all manner of rumours in the square.',
    ],
    realm: ['I have written to the council on the matter twice now.', 'A measured word is worth more than a hasty deed.'],
    musing: ['Indeed, there is much to be said for patience.', 'The library holds answers for those who look.', 'It would be most improper to say more.'],
    market: ['I trust the harvest will prove sufficient.'],
  },
  plain: {
    musing: ['Well, you do what you can, don\'t you?', 'It\'s been one of those weeks.', 'Can\'t complain, though I do anyway.', 'It all works out in the end, mostly.'],
    work: ['Just trying to get through the day.', 'Somebody\'s got to do it, I suppose.'],
    market: ['I\'ll believe it when I see it.', 'There\'s no use crying over spilt milk.'],
  },
  rough: {
    work: [
      'Me hands are raw from all that (work|digging|hauling), I tell you.',
      'Ain\'t no rest for folk like us.',
      'Give me an honest day\'s graft over talk any time.',
      'Broke me best (shovel|axe|boots) this morning, didn\'t I.',
      'The boss can shout all they like, I ain\'t moving faster.',
    ],
    food: ['A pint and a pie, that\'s all I\'m after.'],
    realm: ['Them up at the hall don\'t know what real work is.'],
    'weather:rain': ['Bloody rain. Bloody prices. Bloody everything.'],
  },
  chirpy: {
    nature: ['I saw a (really|really really) big (beetle|frog|spider) by the well!', 'I found a shiny stone, it might be treasure!'],
    town: ['Do you wanna see my secret hiding place?', 'I can run faster than anybody in {town}!', 'My friend says the ruins are full of ghosts!'],
    musing: ['When I grow up I am going to have a horse!', 'Can you do a cartwheel? I can do three!', 'Mum says I ask too many questions.'],
    family: ['My (mum|dad|gran) makes the best {dish} in the whole world!'],
  },
  terse: {
    musing: ['Busy.', 'Not much to say.', 'Same as ever.'],
    'weather:fine': ['Fine day.'],
    'weather:rain': ['Wet.', 'Rain again.'],
    work: ['Work to do.'],
  },
  gruff: {
    musing: ['Everyone wants something from me today.', 'If it isn\'t one thing, it\'s another.', 'I have no time for idle chatter.'],
    town: ['Hmph. Strangers everywhere these days.', 'Bah, the young ones never listen.'],
    realm: ['Don\'t get me started on the taxes.'],
    work: ['Leave a body to their work, will you.', 'Things were better done in my day.'],
  },
};

// Quirks.
const FLAVOR = {
  pious: {
    faith: [
      'I light a candle for {god} every morning, (without fail|and another at night).',
      'Nothing we do is hidden from {god}, (kind or unkind|good or bad).',
      'The priest says the old ways are the true ways.',
      'I give a tenth of what I earn to the temple.',
    ],
  },
  gloomy: {
    musing: ['It will rain, it always rains.', 'Nothing good lasts, does it?', 'I expect the worst and I am rarely disappointed.', 'We all end up in the graveyard sooner or later.'],
    nature: ['The crows have been gathering. That is never good.'],
    'weather:fine': ['Enjoy the sun while it lasts. (It won\'t|It never does).'],
  },
  cheerful: {
    musing: ['What a lovely day to be alive!', 'Every cloud has a silver lining, I always say.', 'Smile, it might never happen!', 'There is always something to be happy about.'],
    market: ['I just love the sound of the market in the morning.'],
    'weather:rain': ['Rain\'s good for the gardens! (Cheer up|Don\'t look so glum).'],
  },
  superstitious: {
    nature: ['A black cat crossed my path this morning. Bad omen.', 'The moon was red last night. Something is coming.'],
    musing: ['Never whistle near the graveyard after dark.', 'I put salt on the doorstep to keep the spirits out.', 'Do not count the stars, or you will lose your luck.'],
  },
  romantic: {
    musing: ['Have you ever been in love? Truly in love?', 'There is someone I cannot stop thinking about.', 'I wrote a poem, but I am too shy to read it to anyone.', 'Spring makes everyone a little foolish, I think.'],
    town: ['The sunset over {town} is the most beautiful thing.'],
  },
  gossipy: {
    gossip: ['I heard the most shocking thing (at the well|in the market) this morning.', 'Between you and me, the mayor is not as clever as people think.', 'Someone has been sneaking out at night, (and|but) I know who.'],
    town: ['You did not hear this from me, but the baker has a secret.'],
  },
  nosy: { gossip: ['I (make it my business|like) to know (who comes and goes|what goes on) in {town}.'] },
  stingy: {
    market: ['Coins do not grow on trees, you know.', 'A penny saved is a penny earned.', 'Everyone wants a loan, nobody wants to pay it back.'],
  },
  thrifty: { market: ['I (mend|darn) everything twice before I buy (it new|new).'] },
  curious: {
    musing: ['I wonder what lies beyond the mountains.', 'Do you know how they make glass? I have always wanted to know.', 'Every traveller has a story, if you ask the right questions.'],
    travel: ['I counted the stones in the square once. Did you know there are hundreds?'],
  },
  witty: { musing: ['(They say|Folk say) laughter is the best medicine. (Which is lucky|Just as well), (since|as) the herbalist (charges|costs) a fortune.'] },
  proud: { work: ['Nobody in {town} (does|can do) it better than me, (and they know it|ask anyone).'] },
  stubborn: { musing: ['I (said|told them) it would (rain|go wrong), and I (won\'t|shan\'t) be told otherwise.'] },
  'absent-minded': { musing: ['Now, what was I (doing|saying)? (It\'s gone|It\'ll come back to me).', 'I (put|left) my (hat|keys|pipe) down somewhere (this morning|and now it\'s gone).'] },
};

// Their trade, when they talk of work.
const JOBS = {
  farmer: ['(The wheat is|The barley is|The cabbages are) coming on (nicely|well) (this year|after the rain).', 'Crows (had|took) half my (seed|corn) (again|this morning).', 'A farmer\'s (day|work) (starts|begins) before the sun (and ends after it|is up).'],
  blacksmith: ['The forge (has been|was) (roaring|hot) since dawn.', 'Everyone wants (a blade|horseshoes|nails) and nobody (wants to pay|pays on time).', 'Good iron (sings|rings) when you strike it. Bad iron (just|only) (thuds|cracks).'],
  fisher: ['(The fish are biting|The catch is good) (today|this week), (for once|thank goodness).', '(Mended|Spent all morning mending) my nets (again|and they tore again).', 'The river (gives|gave) me (nothing|a boot and a branch) (today|this morning).'],
  guard: ['Quiet (night|watch), (thank goodness|for once).', 'Keep your nose clean and we\'ll (get along|have no trouble).', 'My feet (ache|are sore) from walking the (walls|streets) all (night|day).'],
  merchant: ['Buy low, sell high. (The rest is talk|That\'s the whole secret).', 'The roads (to|from) {other} (are|have been) (bad|slow) for trade (lately|this season).', 'A good merchant (knows|can smell) a bargain (a mile off|from the next town).'],
  cook: ['(The|My) {dish} (won\'t|will not) (cook itself|stir itself), (you know|more\'s the pity).', 'Everyone (complains|grumbles) about the food, and everyone (comes back|eats it).'],
  baker: ['(Up|Awake) at four to (knead|start) the (dough|bread), (every|each) day.', 'Flour (gets|is) everywhere. In my hair, in my (bed|ears).'],
  builder: ['That (wall|roof) (won\'t|will not) build itself.', 'Measure twice, cut once. (Always|That\'s the rule).'],
  carpenter: ['A good (joint|table) (needs|takes) no nails, (only|just) patience.', 'The wood (warps|splits) if you (rush|hurry) it.'],
  miner: ['Dark and damp (down there|in the mine), but the (pay|ore) (is good|is honest).', 'Heard the (rock|ceiling) (groan|creak) today. (Didn\'t like it|Gave me a fright).'],
  trapper: ['(Snares|My snares) (were|came up) empty (again|this morning). (Foxes|Something) (got there|got to them) first.', 'You learn to (move|walk) quiet in the woods, or you (go hungry|catch nothing).'],
  herbalist: ['(Feverfew|Willow bark|Mint) for (headaches|aches|the belly). I (keep|have) a (jar|pot) of everything.', 'Half of {town} (comes|came) to me with (coughs|sniffles) this week.'],
  priest: ['The (faithful|temple) (need|needs) (tending|looking after) like any (garden|flock).', 'I (pray|prayed) for {town} (every|this) morning.'],
  innkeeper: ['Full rooms (all week|again)! (Travellers|Merchants) everywhere.', 'If (one more|another) (drunk|guest) (breaks|smashes) a (mug|stool), I\'ll (scream|throw them out).'],
  tailor: ['(Silk|Fine cloth) from {other}, (and|but) the colours (run|fade) in the wash.', 'Everyone (wants|needs) new clothes for {feast}.'],
  scholar: ['I (found|read) (something|a passage) (fascinating|curious) in an old (book|scroll) (last night|today).', 'Knowledge is (the only|a) treasure (no thief can take|that grows when shared).'],
  laborer: ['(Hauled|Carried) stone (all day|since dawn). My back (knows it|will tell me tomorrow).', 'Work\'s work. (It pays|Coin is coin).'],
  woodcutter: ['(Felled|Cut) (three|four) (oaks|pines) (today|this morning). (Good|Hard) work.', 'The forest (grows back|gives), if you (take|cut) (with care|wisely).'],
  mayor: ['The council (sat|argued) (late|till midnight) again, and (decided nothing|settled nothing).', 'Everyone wants (roads|walls|lower taxes), and nobody wants to pay for them.'],
  noble: ['One (must|has to) (keep up|maintain) appearances, (whatever the cost|come what may).', 'My (estates|lands) keep me (busy|terribly busy), (you understand|naturally).'],
  beggar: ['A coin for (a crust|bread)? Nobody (spares|has) a coin (these days|any more).', 'The (nights|cobbles) are (cold|hard) (this time of year|at night).'],
};

// What one thought leads on to (the second sentence, sometimes).
const LINKS = {
  weather: ['work', 'food', 'nature', 'musing', 'time'],
  work: ['musing', 'food', 'market', 'weather', 'family'],
  food: ['market', 'feast', 'family', 'town'],
  hungry: ['market', 'struggling', 'famine', 'realm'],
  family: ['musing', 'town', 'food', 'partner', 'child'],
  partner: ['family', 'child', 'musing'],
  child: ['family', 'musing', 'nature'],
  single: ['musing', 'friend', 'town'],
  town: ['gossip', 'realm', 'past', 'market', 'thriving', 'struggling'],
  thriving: ['market', 'town', 'travel'],
  struggling: ['realm', 'market', 'musing'],
  famine: ['realm', 'faith', 'musing'],
  market: ['travel', 'realm', 'scarce', 'plenty', 'town'],
  scarce: ['market', 'realm'],
  plenty: ['market', 'travel'],
  gossip: ['town', 'gossip', 'friend'],
  friend: ['town', 'musing', 'gossip'],
  faith: ['feast', 'musing', 'family'],
  feast: ['food', 'town', 'faith'],
  travel: ['market', 'musing', 'past'],
  past: ['musing', 'town', 'family'],
  realm: ['war', 'market', 'town'],
  war: ['realm', 'faith', 'family'],
  nature: ['weather', 'musing', 'town'],
  musing: ['past', 'town', 'faith', 'work'],
  time: ['work', 'food', 'musing'],
};

// Slots that have a stand-in when nothing's known.
const DEFAULTS = { town: 'this town', god: 'the gods', dish: 'stew', drink: 'ale', feast: 'the feast', realm: 'the council', weather: 'weather', other: 'the next town', time: 'day' };
// Topics that must have something to talk about.
const TOPIC_NEEDS = { scarce: 'scarce', plenty: 'plenty', gossip: 'neighbour', friend: 'friend', partner: 'partner', child: 'child' };

export const STYLES = { base: BASE, culture: CULTURE, register: REGISTER, flavor: FLAVOR, jobs: JOBS };
const QUIRKS = new Set(Object.keys(FLAVOR));

// ------------------------------------------------------------ the chains
const START = '^';
const END = '$';
const ORDER = 3;
const tokens = (line) => line.split(/\s+/).filter(Boolean);
// (Matching ignores case and a trailing comma.)
const norm = (w) => (w === START ? w : w.toLowerCase().replace(/,$/, ''));

function train(chain, line, w) {
  const t = [...new Array(ORDER).fill(START), ...tokens(line), END];
  for (let i = ORDER; i < t.length; i++) {
    const k = t.slice(i - ORDER, i).map(norm).join(' ');
    let m = chain.get(k);
    if (!m) chain.set(k, (m = new Map()));
    m.set(t[i], (m.get(t[i]) || 0) + w);
  }
}

function nextWord(m, rng) {
  let total = 0;
  for (const n of m.values()) total += n;
  let r = rng.next() * total;
  for (const [k, n] of m) {
    r -= n;
    if (r <= 0) return k;
  }
  return END;
}

// Each source of lines for a topic, and how much it counts.
function framesFor(topic, culture, register, flavors, job) {
  const out = [];
  const add = (list, w) => {
    for (const l of list || []) out.push([l, w]);
  };
  const base = topic.split(':')[0];
  add(BASE[topic], 1);
  add(CULTURE[culture] && CULTURE[culture][topic], 2);
  add(REGISTER[register] && REGISTER[register][topic], 2);
  for (const f of flavors) add(FLAVOR[f] && FLAVOR[f][topic], 2);
  if (base === 'work' && job && JOBS[job]) add(JOBS[job], 3);
  return out;
}

// A topic's chain for one kind of speaker: its frames expanded into a
// corpus (each a handful of ways), and a chain trained on that.
function topicChain(c, topic) {
  let t = c.topics.get(topic);
  if (t) return t;
  const frames = framesFor(topic, c.culture, c.register, c.flavors, c.job);
  const chain = new Map();
  const corpus = [];
  for (const [f, w] of frames) {
    const rng = new RNG(hash4(f.length, f.charCodeAt(0) || 0, f.charCodeAt(f.length >> 1) || 0, 0x7e11));
    const seen = new Set();
    const n = /[(\[]/.test(f) ? 6 : 1;
    for (let i = 0; i < n; i++) {
      const s = expand(f, rng);
      if (seen.has(s)) continue;
      seen.add(s);
      corpus.push(s);
      train(chain, s, w);
    }
  }
  t = { chain, corpus, seen: new Set(corpus), frames };
  c.topics.set(topic, t);
  return t;
}

const cache = new Map();
// A speaker's model: their people, their way of talking, their quirks and
// their trade (the chains are made per topic, as they're needed).
export function chainFor(culture, register, flavors = [], job = null) {
  const fl = [...new Set(flavors.filter((f) => QUIRKS.has(f)))].sort();
  const key = `${culture}|${register}|${fl.join(',')}|${job || ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = { culture, register, flavors: fl, job, topics: new Map(), lexicon: (CULTURE[culture] && CULTURE[culture].lexicon) || [] };
  // (Everything they could say, for checking a line's new.)
  c.seen = new Set();
  if (cache.size > 300) cache.clear();
  cache.set(key, c);
  return c;
}

// Words a line can't end on.
const DANGLING = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'my', 'your', 'our', 'their', 'is', 'was', 'are', 'i', 'it\'s', 'that', 'than', 'so', 'if', 'as', 'from', 'by', 'me', 'we', 'be', 'into']);

// Is it a line worth saying? (Not trailing off, not saying a word twice
// over, not an unclosed question, nor nonsense length.)
function wellFormed(words, min, max) {
  if (words.length < min || words.length > max) return false;
  const last = norm(words[words.length - 1]).replace(/[.!?]$/, '');
  if (DANGLING.has(last)) return false;
  const seen = new Set();
  for (let i = 0; i + 1 < words.length; i++) {
    const bg = `${norm(words[i])} ${norm(words[i + 1])}`;
    if (seen.has(bg)) return false;
    seen.add(bg);
  }
  for (let i = 1; i < words.length; i++) if (norm(words[i]) === norm(words[i - 1]) && !/^(very|really|ha|no)$/.test(norm(words[i]))) return false;
  return true;
}

// The topics this speaker has something to say about.
function topicsOf(c) {
  const out = new Set(['work', 'food', 'family', 'town', 'market', 'faith', 'feast', 'travel', 'past', 'realm', 'nature', 'musing']);
  for (const src of [CULTURE[c.culture], REGISTER[c.register], ...c.flavors.map((f) => FLAVOR[f])]) for (const k of Object.keys(src || {})) if (k !== 'lexicon' && !k.includes(':') && !TOPIC_NEEDS[k]) out.add(k);
  return [...out];
}

// One line on a topic (any topic, if none's given): a new walk along the
// chain where one comes out well, or one of the sentences the frames make.
export function babble(c, rng, { min = 4, max = 22, tries = 14, topic = null, novel = 0.75 } = {}) {
  const tp = topic || rng.pick(topicsOf(c));
  const t = topicChain(c, tp);
  if (!t.corpus.length) return 'Hm.';
  const short = t.corpus.some((l) => tokens(l).length < min);
  const lo = short ? 1 : min;
  // (Mostly something new; now and then just one of the frames.)
  if (rng.next() < novel) {
    for (let i = 0; i < tries; i++) {
      const out = [];
      const ctx = new Array(ORDER).fill(START);
      for (let n = 0; n < max + 4; n++) {
        const m = t.chain.get(ctx.map(norm).join(' '));
        if (!m) break;
        const w = nextWord(m, rng);
        if (w === END) break;
        out.push(w);
        ctx.shift();
        ctx.push(w);
      }
      if (!wellFormed(out, lo, max)) continue;
      let s = out.join(' ');
      if (!/[.!?]$/.test(s)) s += '.';
      if (!t.seen.has(s) || i === tries - 1) return s;
    }
  }
  return rng.pick(t.corpus);
}

// Fill in the blanks from where it's said, and tidy up.
export function fill(text, ctx = {}) {
  let s = text.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== '' ? ctx[k] : DEFAULTS[k] || m));
  s = s.replace(/\b([Tt])he the\b/g, '$1he').replace(/\b([Aa]) ([aeiouAEIOU]\w)/g, '$1n $2').replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// How one thought leads to the next, in each manner.
const JOIN = {
  formal: ['Then again, ', 'That said, ', 'Moreover, ', 'Mind you, '],
  plain: ['Mind you, ', 'Still, ', 'Anyway, ', 'Oh, and ', 'Then again, '],
  rough: ['Mind, ', 'Anyhow, ', 'And ', 'Still, '],
  chirpy: ['And ', 'Oh! And ', 'Also, '],
  terse: [],
  gruff: ['And ', 'Not that anyone listens, but ', 'Still, '],
};
const LOWER = new Set(['The', 'It', 'It\'s', 'We', 'There', 'There\'s', 'This', 'That', 'My', 'Our', 'A', 'An', 'Some', 'Everyone', 'Nobody', 'You', 'They', 'Nothing', 'If', 'Not', 'What', 'How', 'Every', 'Half', 'Times', 'Coin', 'Fine', 'Good', 'Funny', 'Family', 'Faith', 'Old', 'Days', 'Things', 'Work', 'Rain', 'More', 'At', 'Come', 'Last', 'One', 'Up', 'Early', 'Mornings', 'Long', 'Married', 'Can\'t', 'Never', 'Quiet', 'Buy', 'Full', 'Flour', 'Dark', 'Measure', 'Knowledge', 'Snow', 'Fog', 'Nearly', 'Somebody', 'Someone', 'Between', 'Every', 'Whatever', 'Busy', 'Same', 'Wet']);

// Their manner, beyond what voice.js already does to a line.
function manner(s, reg, rng) {
  if (reg === 'rough') {
    if (rng.next() < 0.6) s = s.replace(/\bmy\b/g, 'me').replace(/\bMy\b/g, 'Me');
    s = s.replace(/\b(\w+)ing\b(?=[ ,.!?])/g, (m, w) => (w.length > 3 && rng.next() < 0.5 ? `${w}in'` : m));
    if (rng.next() < 0.15) s = s.replace(/\.$/, ', I tell you.');
  } else if (reg === 'chirpy') {
    if (rng.next() < 0.6) s = s.replace(/\.$/, '!');
    if (rng.next() < 0.2) s = `Guess what? ${s}`;
  } else if (reg === 'terse') {
    // Half of it, and the half that matters.
    let first = s.split(/,\s|;\s| and | but /)[0].replace(/^(I think|I heard|They say|Well|Oh)\s*/i, '');
    if (tokens(first).length < 4) first = s;
    const w = tokens(first).slice(0, 8);
    while (w.length > 1 && DANGLING.has(norm(w[w.length - 1]).replace(/[.!?]$/, ''))) w.pop();
    s = w.join(' ').replace(/[,;:]$/, '');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
  } else if (reg === 'gruff') {
    if (rng.next() < 0.18) s = `${s} Hmph.`;
  } else if (reg === 'formal') {
    if (rng.next() < 0.12) s = `I dare say ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  }
  return s;
}

// What's on their mind: each topic weighted by who they are and what's
// going on around them.
function topicWeights(rec, ctx, c) {
  const w = new Map();
  const add = (k, n) => w.set(k, (w.get(k) || 0) + n);
  for (const k of topicsOf(c)) add(k, 1);
  const wk = ctx.wkind || 'fine';
  add(`weather:${wk}`, wk === 'fine' ? 1.2 : 3);
  if (ctx.time) add(`time:${ctx.time}`, 0.6);
  add('work', rec.job && rec.job !== 'none' ? 1.5 : 0.3);
  if (ctx.hungry) add('hungry', 4);
  if (ctx.famine) add('famine', 3);
  if (ctx.fortune === 'thriving') add('thriving', 1.5);
  if (ctx.fortune === 'struggling') add('struggling', 2);
  if (ctx.war) add('war', 2);
  if (ctx.scarce) add('scarce', 1.4);
  if (ctx.plenty) add('plenty', 1);
  if (ctx.partner) add('partner', 1.2);
  if (ctx.child) add('child', 1.2);
  if (!ctx.partner && rec.age === 'adult') add('single', 0.5);
  if (ctx.neighbour) add('gossip', c.flavors.includes('gossipy') || c.flavors.includes('nosy') ? 3 : 0.8);
  if (ctx.friend) add('friend', 0.8);
  if (c.flavors.includes('pious')) add('faith', 2);
  if (c.flavors.length) for (const f of c.flavors) for (const k of Object.keys(FLAVOR[f] || {})) add(k, 1);
  if (rec.age === 'child') {
    for (const k of ['realm', 'market', 'work', 'past', 'single', 'partner', 'struggling', 'scarce', 'plenty', 'gossip', 'war', 'thriving']) w.delete(k);
    add('nature', 2);
    add('musing', 1.5);
  }
  // (Only what there's something to say about.)
  for (const [k] of [...w]) {
    const base = k.split(':')[0];
    const need = TOPIC_NEEDS[base];
    if (need && !ctx[need]) w.delete(k);
  }
  return [...w];
}

// Something to say, in this person's own way of talking (`ctx` says where:
// see dialogue.talkContext).
export function smallTalk(rec, rng, ctx = {}) {
  const v = voiceOf(rec);
  const culture = ctx.culture || 'vale';
  const traits = rec.traits || [];
  const flavors = traits.filter((t) => QUIRKS.has(t));
  if ((rec.personality?.piety ?? 0) > 0.7 || rec.job === 'priest') flavors.push('pious');
  const c = chainFor(culture, v.reg, flavors, rec.age === 'child' ? null : rec.job);
  // Who's who in their life.
  const L = ctx.L;
  const nameOf = (i) => (L && i !== null && i !== undefined && L.npcs[i] && L.npcs[i].name ? L.npcs[i].name.first : null);
  const kid = (rec.children || []).map(nameOf).find(Boolean) || null;
  const next = L ? L.npcs.find((q) => q !== rec && q.home !== null && q.home !== undefined && q.home !== rec.home && Math.abs((q.home || 0) - (rec.home || 0)) <= 2 && q.age === 'adult' && q.alive !== false && q.name) : null;
  const pctx = {
    ...ctx,
    partner: nameOf(rec.partner),
    child: kid,
    friend: (rec.friends || []).map((f) => nameOf(typeof f === 'object' ? f.idx : f)).find(Boolean) || null,
    neighbour: next ? next.name.first : null,
    hungry: (rec.hungry || 0) >= 1 || ctx.hungry,
  };
  const pick = (list) => {
    let total = 0;
    for (const [, n] of list) total += n;
    let r = rng.next() * total;
    for (const [k, n] of list) {
      r -= n;
      if (r <= 0) return k;
    }
    return list[list.length - 1][0];
  };
  const weights = topicWeights(rec, pctx, c);
  const terse = v.reg === 'terse';
  const opts = { min: terse ? 1 : 4, max: terse ? 9 : 22 };
  const topic = pick(weights);
  let s = fill(babble(c, rng, { ...opts, topic }), pctx);
  // One thing leads to another, now and then.
  const link = LINKS[topic.split(':')[0]];
  if (!terse && link && rng.next() < (v.reg === 'chirpy' ? 0.35 : 0.3) && s.length < 70) {
    const ok = new Set(weights.map(([k]) => k.split(':')[0]));
    const nexts = link.filter((k) => ok.has(k));
    if (nexts.length) {
      const k2 = rng.pick(nexts);
      const full = weights.find(([k]) => k.split(':')[0] === k2)[0];
      let s2 = fill(babble(c, rng, { ...opts, topic: full, max: 16 }), pctx);
      const first = s2.split(' ')[0].replace(/[,.!?]$/, '');
      if (LOWER.has(first)) s2 = s2.charAt(0).toLowerCase() + s2.slice(1);
      const j = rng.pick(JOIN[v.reg] || JOIN.plain);
      if (s2 !== s && (s + s2).length < 150) s = `${s} ${j}${s2}`;
    }
  }
  s = manner(s, v.reg, rng);
  for (const [a, b] of c.lexicon) s = s.replace(a, b);
  return s;
}

// A seeded generator for a line (the same moment gives the same line).
export function talkRng(rec, salt = 0) {
  return new RNG(hash4(rec.idx || 0, salt, 0x6a7c));
}
