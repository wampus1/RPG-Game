// What everyone has to say, by topic: the phrase grammar the word chains
// are trained on (see markov.js for how it's said, and chain.js for the
// chains). A frame is a sentence with choices in it: "(a|b|c)" says one of
// them, "[a]" says it or not, and "{slot}" is filled in from where it's
// said (see DEFAULTS). Adding talk is adding frames:
//   BASE      everyone, by topic
//   CULTURE   each people (and its lexicon: word swaps for its dialect)
//   REGISTER  each way of talking (formal, plain, rough, chirpy, terse, gruff)
//   FLAVOR    each quirk of character (pious, gloomy, gossipy...)
//   JOBS      each trade (said when talking about work)
//   LINKS     what one topic leads on to ("Mind you, ...")
// A topic with a ":" is only for when it's so (weather:rain when it's
// raining); a topic in TOPIC_NEEDS is only for when its slot can be filled.

// ------------------------------------------------------------ what's said
// Everyone's talk, by topic. (Topics with a ":" are only for when it's so:
// weather:rain when it's raining, and so on.)
export const BASE = {
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
export const CULTURE = {
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
export const REGISTER = {
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
export const FLAVOR = {
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
export const JOBS = {
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
export const LINKS = {
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
export const DEFAULTS = { town: 'this town', god: 'the gods', dish: 'stew', drink: 'ale', feast: 'the feast', realm: 'the council', weather: 'weather', other: 'the next town', time: 'day' };
// Topics that must have something to talk about.
export const TOPIC_NEEDS = { scarce: 'scarce', plenty: 'plenty', gossip: 'neighbour', friend: 'friend', partner: 'partner', child: 'child' };

// ------------------------------------------------------------ more talk
// More of everyone's talk on what was already talked of, and new things to
// talk of: what the scholars are at and what they've found, the town's
// ship, the portal on the square, the prisoners at the quarry, aches and
// cures, animals, old stories, chores.
const more = (into, add) => {
  for (const [k, v] of Object.entries(add)) {
    if (Array.isArray(v)) into[k] = [...(into[k] || []), ...v];
    else if (v && typeof v === 'object') into[k] = more(into[k] || {}, v);
    else into[k] = v;
  }
  return into;
};

more(BASE, {
  'weather:rain': [
    'The (well|trough|water barrel) is (full|brimming) (for once|at least), (thanks to|with) all this rain.',
    'Rain (on|over) {town} (again|all week). I (could|might) (grow|sprout) moss.',
    'The (roads|lanes) (out of|round) {town} are (mud|a mire) (to the knee|up to your ankles).',
    '(Good|Fine) weather for (ducks|frogs|fish), as my mother (used to say|always said).',
  ],
  'weather:snow': [
    '(Snow|Frost) on the (roofs|fields|hills) (already|again). (Winter|The cold) is (here|in earnest).',
    '(Mind|Watch) your (feet|footing) on the (ice|cobbles); half of {town} (has fallen|went flat) (this week|already).',
    'Snow makes (the town|{town}|everything) so (quiet|still), (doesn\'t it|I find).',
  ],
  'weather:fog': [
    '(Sounds|Voices) carry (strangely|oddly) in the fog. I (heard|thought I heard) (someone|my name) (calling|whispering).',
    '(Mind|Watch) the (well|ditches|river) in this fog. (Easier|It\'s easier) to (walk|fall) in than you think.',
  ],
  'weather:storm': [
    '(Lightning|A bolt of lightning) (hit|struck|split) (the old oak|a tree) (outside town|by the road) (last night|in the night).',
    '(Bar|Shut) (your|the) shutters (tight|fast); (this storm|the wind) (isn\'t done yet|is only starting).',
  ],
  'weather:fine': [
    '(Blue sky|Not a cloud) (all day|from end to end). It makes a (body|person) (glad|want to sing).',
    '(Too|Far too) (fine|nice) a day to (work|be indoors), (if you ask me|I say).',
    'The (washing|laundry) (dries|will be dry) in an hour on a day like this.',
  ],
  work: [
    '(Some|Most) days the work (is|feels) (lighter|easier) with (a song|company|a full belly).',
    'I (never|don\'t) (mind|grudge) hard work. It\'s the (waiting|idleness|talk) I (can\'t abide|hate).',
    '(My|The) (tools|hands) (are|have been) (worn|rubbed) smooth with (use|years of it).',
    '(Half|Most) of {town} (works|is working) (harder|longer) than the other half (thinks|knows).',
    'A good (day|week) of work, and the (rest|ale) (tastes|feels) all the (sweeter|better).',
  ],
  food: [
    '(Nothing|There\'s nothing) (beats|like) (fresh|warm) bread (in the morning|straight from the oven).',
    'I (had|ate) {dish} (twice|three times) (this week|already). Not that I\'m (complaining|tired of it).',
    '(My|Our) (larder|pantry|cupboard) is (fuller|emptier) than (it\'s been for weeks|usual this season).',
    '(A bowl of|Some) {dish} and a (cup|mug) of {drink}: that\'s (all|everything) (a body|anyone) needs.',
  ],
  hungry: [
    '(My belly|My stomach) (is|has been) (growling|rumbling) since (dawn|noon|yesterday).',
    'I\'d (give|trade) (my boots|a day\'s pay) for (a crust|a bite) of something (warm|hot) (right now|about now).',
  ],
  family: [
    '(Family|Kin) (can|will) drive you (mad|to drink), but (who else|nobody else) (would|will) (have you|stand by you).',
    '(My|Our) (cousins|kin) in {other} (write|send word) (now and then|when they remember).',
    '(Every|Each) (family|house) in {town} has (its|a) (squabbles|quarrels). (Ours|Mine) (just|only) (shout|are) louder.',
  ],
  partner: [
    '{partner} (snores|hums) (like|worse than) a (bear|kettle|millstone). (I wouldn\'t change it|Still, I\'d miss it).',
    '{partner} (made|cooked) (supper|{dish}) (last night|yesterday) and (it was|I tell you it was) (wonderful|very nearly edible).',
  ],
  child: [
    '{child} (wants|says they want) to (be|become) a (guard|merchant|scholar|sailor) (one day|when they\'re grown). (Last week|Yesterday) it was a (dragon|bear).',
    '{child} (found|brought home) a (frog|beetle|bird\'s egg) (yesterday|this morning). (It lives in|Now it\'s in) (a jar|my best bowl).',
  ],
  single: [
    '(Nobody|No one) (tells|bothers) me when to (come home|go to bed), (at least|mind you).',
    '(Maybe|Perhaps) (next|this) year I\'ll (find|meet) (someone|the right one) at {feast}.',
  ],
  town: [
    '{town} (isn\'t|is not) (much|big), but it\'s (ours|home|where my people lie).',
    '(New|Fresh) (faces|folk) in {town} (every week|lately). (Merchants|Travellers|Settlers), (mostly|I suppose).',
    'The builders have (been|gone) (busy|at it) (again|all week). {town} (keeps|is) growing.',
    '(The|Our) (square|well|town hall) has seen (better|stranger) days than (these|this).',
  ],
  thriving: [
    '(Coin|Money) (in every purse|on every table) (these days|this season). (Long may it last|Touch wood).',
    '(Even|Why, even) the (beggars|poorest) in {town} (eat|have eaten) (well|meat) this week.',
  ],
  struggling: [
    '(Times|Things) (are|have been) (hard|lean) in {town}. (We|Folk) (make|get) do.',
    '(Too many|More) (mouths|folk) than (work|coin) in {town} (these days|this year).',
  ],
  famine: [
    'We\'ve been (eating|boiling) (nettles|bark|grass) (soup|porridge). (Don\'t|You don\'t want to) ask.',
    '(The children|My little ones) went to bed hungry (again|last night). It (breaks|would break) your heart.',
  ],
  market: [
    '(Prices|Everything) (went|goes) up (again|this week), and (my|our) purse (didn\'t|doesn\'t).',
    'The (merchant|trader) from {other} (had|brought) (cloth|spices|knives) (I\'ve never seen|you don\'t see) (round here|in {town}).',
    '(I|We) (haggled|argued) (an hour|all morning) over (a|one) (copper|coin). (Worth it|Won, too).',
  ],
  scarce: [
    '(No|Not a scrap of|Hardly any) {scarce} (to be had|for sale) (anywhere|in all of {town}).',
    'Anyone who (has|brings) {scarce} to {town} (now|this week) (could|can) name their price.',
  ],
  plenty: [
    '{plenty} (going|sold) for (next to nothing|a song) (at|on) the market (this week|today).',
  ],
  gossip: [
    '{neighbour} (has|has gone and) (bought|got) a new (hat|cart|goat). (Where|How) did {neighbour} find the coin, (I wonder|eh)?',
    '(Did you|Have you) (hear|heard) {neighbour} (singing|arguing) (last night|at all hours)? (The whole street|Everyone) (did|heard).',
  ],
  friend: [
    '{friend} and I (go back|have known each other) (years|since we were small).',
    '{friend} owes me (a drink|a favour|two coins). (I haven\'t forgotten|Not that I\'m counting).',
  ],
  faith: [
    '(The|Our) (priest|temple) (says|tells us) {god} (sees|hears) (all|everything). (I hope|Let\'s hope) not everything.',
    'I (lit|left) a (candle|offering) for {god} (this morning|last night). (Can\'t hurt|It can\'t hurt).',
  ],
  feast: [
    '(Only|Just) (a few|some) days to {feast}. (I\'ve|We\'ve) (been saving|saved) (all month|for it).',
    'At {feast} last year (someone|a guard|old Tam) (fell|danced) (into|right into) the (well|fountain|cake).',
  ],
  travel: [
    'The road to {other} (is|was) (long|dusty|full of ruts). My (feet|legs) (still ache|haven\'t forgiven me).',
    '(I\'ve|I have) (never|not once) (been|gone) further than {other}. (Maybe|Someday) I\'ll go.',
  ],
  past: [
    '(When|Back when) I was (young|a child), {town} was (half|nothing like) the size.',
    '(The|My) (old folk|grandmother) (used to|would) say the winters were (harder|colder) in their day.',
  ],
  realm: [
    '(Taxes|Tithes) (again|up again). What does {realm} (spend it on|do with it), (I ask you|eh)?',
    'Whatever {realm} (decides|says), (we|it\'s us who) (pay for it|do the work).',
  ],
  war: [
    '(My|Our) (cousin|neighbour\'s boy) (marched|went) (off|away) with the levy. (No word|Not a word) since.',
    'War is a (rich man\'s|ruler\'s) game, and a poor (man\'s|family\'s) (grave|burden).',
  ],
  nature: [
    '(Saw|There was) a (fox|deer|hare|heron) (by the river|at the edge of town|in the fields) (at dawn|this morning).',
    'The (swallows|geese) (are|have been) (leaving|coming back) (early|late) this year. (That means something|Means something), (they say|I\'m sure).',
  ],
  musing: [
    '(Funny|Strange) how (the days|the years|time) (go|fly) by when you\'re not looking.',
    '(I|Sometimes I) (wonder|think about) what\'s (beyond|past) (the hills|the sea|{other}). (Then|And then) I (get on|go back to work).',
  ],
  'time:morning': [
    '(Too|Far too) early for (talk|all this). (Ask me|Talk to me) after (breakfast|a cup of {drink}).',
  ],
  'time:evening': [
    '(A|The) (long|good) day (done|over). (Time|Nearly time) for (supper|a {drink}|my bed).',
  ],
  'time:night': [
    '(Shouldn\'t|Oughtn\'t) you be (in bed|abed|home) at this hour? (I|We) (certainly|ought to) be.',
  ],
  // What the scholars are at, and what they've found.
  study: [
    'The scholars (are|have been) (at|working on) {study} (all week|for days|since spring), (they say|I hear).',
    '(Something|Some new art) called {study}. (Don\'t|I don\'t) (ask me|know) what it\'s for, (but|though) the scholars (are|seem) (excited|pleased).',
    '(If|When) they (crack|master) {study}, (things|life) (will|might) (get easier|change round here), (they say|so they tell us).',
    '(My|Our) (neighbour|cousin) (helps|sweeps up) at the (study|library), and (says|swears) {study} is (nearly|almost) (done|worked out).',
  ],
  learned: [
    'Ever since {realm} learned {learned}, (things have|everything has) (changed|been different) (round here|in {town}).',
    '{learned}! Whoever (would have|could have) thought it. The scholars (earned|deserved) their (bread|keep) for once.',
    '(They|The scholars) (finally|at last) (mastered|worked out) {learned}. (We\'ll see what good it does|I\'ll believe it when I see it).',
  ],
  // The town's ship.
  ships: [
    'The {ship} (is due back|should be home) (any day now|before the week\'s out). (I\'ve|My cousin\'s) (got coin|got goods) in her hold.',
    '(Saw|Watched) the {ship} (put out|cast off) (this morning|yesterday). (What|Such) a (sight|ship), all sail set.',
    '(They say|I hear) the {ship} (brings back|carries) (spices|silks|wine) from (ports|places) (I can\'t say the names of|far away).',
    '(Every|Each) time the {ship} (comes in|ties up), the (whole town|pier) (turns out|is crowded) to (see|watch).',
  ],
  // The portal on the square.
  portal: [
    'I (went|stepped) through the portal to {portalto} (yesterday|last week). My (stomach|head) (is still there|hasn\'t caught up).',
    '(One step|A single step) and you\'re in {portalto}. (It isn\'t natural|Not natural, that), (if you ask me|I say).',
    'That portal on the square (hums|glows) (all night|at night). I can\'t sleep for (it|the light).',
    '(My|Our) (sister|cousin|brother) in {portalto} (visits|comes over) (every week|twice a week) now, through the portal.',
  ],
  // The prisoners at the quarry.
  prisoners: [
    'The prisoners (are|were) out (at the quarry|in the woods) again (today|this morning), (picks|axes) and all.',
    '(Better|Better they) (cut wood|haul stone) than (rot|sit) in the cells, (I say|if you ask me).',
    'One guard (for|to) every two prisoners. (I hope|Let\'s hope) the guards (can count|stay awake).',
  ],
  health: [
    '(My|This) (knee|back|hip) (tells|warns) me when (rain\'s|weather\'s) coming. (It|And it) (never|seldom) (lies|misses).',
    'The herbalist (gave|sold) me (a salve|something green) for my (cough|chest). (Tastes|Smells) like old boots.',
    '(Half|Most) of {town} (has|have) (a cold|the sniffles) (this week|again). (Keep your distance|Don\'t come too close).',
    '(Sleep|A good night\'s sleep) and (a bowl of {dish}|some broth): (the best|better than any) (medicine|cure) there is.',
  ],
  animals: [
    '(Our|My) (goat|dog|cat) (got out|ran off) (again|last night) and (ate|chewed) (the washing|half the garden|someone\'s hat).',
    '(The|My) (hens|chickens) (stopped|aren\'t) laying. (A fox|Something) must have (scared|frightened) them.',
    '(That|The) (cat|dog) (at|from) the tavern (thinks|acts like) it (owns|runs) {town}.',
    '(There\'s|I saw) a (stray|wild) (dog|pig|goat) (about|loose) (by the well|near the market). (Mind|Watch) your (ankles|basket).',
  ],
  stories: [
    '(My|Our) (grandmother|old nan) (told|used to tell) (a story|tales) about (a dragon|a giant|wolves) in the (hills|woods) (near|outside) {town}.',
    'There\'s a (song|ballad) about the (founding|first days) of {town}. (Everyone|Nobody) (knows|remembers) all the words.',
    'The (minstrel|traveller) at the tavern (sang a song|told a story) (last night|the other night) that had (half the room|everyone) (weeping|laughing|in tears).',
  ],
  chores: [
    '(Wood|Water) to (fetch|carry), (floors|pots) to (scrub|sweep), and only the one of me.',
    '(I|We) (swept|scrubbed) the (floor|step|hearth) (this morning|twice) and it\'s (filthy|muddy) (again|already).',
    '(The|My) (roof|fence|door) (needs|wants) (mending|patching) before {feast}, (or else|or there\'ll be words).',
  ],
});

more(JOBS, {
  lumberjack: JOBS.woodcutter.concat(['(Timber|Good timber) (fetches|is fetching) a fair price (this season|with all the building).']),
  researcher: [
    '(Up|Awake) (half|all) the night (over|with) (the books|my notes) again.',
    'The (problem|work) (came|comes) clear (for a moment|all at once), and then (the candle|my lamp) (went out|guttered).',
    '(Every|Each) (step|art) we (learn|master) (takes|took) (months|longer than anyone thinks).',
  ],
  barkeep: [
    '(Poured|Pulled) {drink} (all night|till my arm ached), and (half|most) of it (on the floor|spilled).',
    'You (hear|learn) everything from behind the bar. (And|But) I (say|tell) nothing.',
  ],
  handler: [
    'The (grey|bay|chestnut) mare (kicked|bit) me (again|this morning). She (likes|loves) me really.',
    'A horse (knows|can tell) (who|whether you) (fears|fear) it. (Don\'t|Never) let it (see|know).',
  ],
  caravanner: [
    '(Another|One more) road, (another|one more) (market|camp). The wagons (never|don\'t) (stop|rest) long.',
    'We (trade|carry goods) between {other} and (the coast|the hills|anywhere that pays).',
  ],
  adventurer: [
    '(Ruins|Caves|Old towers) (in|past) the hills, full of (gold|bones|both), they say. (I\'m|We\'re) (going|heading) back (soon|tomorrow).',
    '(Steel|A blade) and (luck|nerve): (all|everything) an adventurer (needs|has).',
  ],
  retired: [
    'I put in my years. (Now|These days) I (watch|sit and watch) the (young ones|world) (do it|go by).',
    '(In|Back in) my day we worked (twice|half again) as hard for half the pay.',
  ],
});

more(CULTURE, {
  vale: { stories: ['(Down|Here) in the valleys we (tell|have) a (story|tale) for (every|each) (field|stone|well).'] },
  north: { stories: ['(The|Our) (skalds|old ones) (sing|tell) of (the long winter|the sea serpent|the first longships).'] },
  sun: { stories: ['(The|Our) (elders|grandmothers) (tell|told) of (the drowned city|the star caravans|the endless dunes).'] },
  wild: { stories: ['(The|Our) (forest|trees) (remember|keep) the old tales, if you (listen|know how to listen).'] },
  high: { stories: ['(Deep|Down) in the (mountain|old mines) (there are|lie) (halls|songs) older than (any king|anything).'] },
});

more(FLAVOR, {
  superstitious: { portal: ['Nothing good (comes|will come) of (stepping|walking) through (that|a) (light|portal), (mark my words|you\'ll see).'] },
  gloomy: { ships: ['One day the {ship} (won\'t|will not) come back. The (sea|river) (takes|keeps) what it wants in the end.'] },
  cheerful: { learned: ['{learned}! (Isn\'t it (wonderful|grand)?|How (wonderful|grand)!) (What|Whatever) will they (think of|learn) next!'] },
  curious: { study: ['I (asked|went to ask) the scholars about {study}. (They|One of them) talked (for an hour|till supper), and I (understood|followed) (a word|none of it).'] },
});

more(LINKS, {
  study: ['learned', 'realm', 'musing'],
  learned: ['study', 'realm', 'work'],
  ships: ['market', 'travel', 'past'],
  portal: ['travel', 'musing', 'family'],
  prisoners: ['realm', 'war', 'gossip'],
  health: ['food', 'faith', 'musing'],
  animals: ['nature', 'chores', 'child'],
  stories: ['past', 'faith', 'musing'],
  chores: ['work', 'family', 'animals'],
  market: ['ships'],
  travel: ['portal', 'ships'],
  realm: ['study', 'learned'],
  war: ['prisoners'],
});
more(TOPIC_NEEDS, { study: 'study', learned: 'learned', ships: 'ship', portal: 'portalto', prisoners: 'prisoners' });
