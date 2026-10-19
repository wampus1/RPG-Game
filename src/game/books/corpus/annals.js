// (Round 126) A town's annals: how a chronicler writes of a town, from the
// empty land before it to its own day. In the phrase grammar of talk/
// grammar.js: "(a|b)" says one of them, "[a]" says it or not; "{town}" and
// the like are filled in from the town (see books.js).
//
// FLOWS: the ways a paragraph of each kind has been written, as runs of
// moves (see write.js: a chain learns what follows what). POOLS: what's
// said for each move, `${kind}.${move}`.
export const FLOWS = {
  preface: [
    ['purpose', 'sources', 'humble'],
    ['purpose', 'sources', 'pious', 'humble'],
    ['pious', 'purpose', 'sources'],
    ['purpose', 'debt', 'sources'],
    ['sources', 'purpose', 'dedicate'],
    ['purpose', 'sources', 'debt', 'humble'],
    ['purpose', 'humble', 'dedicate'],
  ],
  land: [
    ['lie', 'before', 'why'],
    ['lie', 'why'],
    ['before', 'lie', 'why'],
    ['lie', 'before'],
  ],
  founding: [
    ['arrive', 'first', 'hardship', 'name'],
    ['arrive', 'hardship', 'first'],
    ['arrive', 'first', 'name'],
    ['arrive', 'first', 'grow'],
    ['arrive', 'hardship', 'grow', 'name'],
  ],
  event: [
    ['when', 'detail', 'after'],
    ['when', 'detail', 'detail*', 'after'],
    ['when', 'detail', 'after', 'remark'],
    ['when', 'after', 'source'],
    ['when', 'detail', 'source'],
    ['when', 'detail', 'after', 'link'],
    ['when', 'detail', 'link', 'remark'],
  ],
  ways: [
    ['famous', 'table', 'faith', 'feast'],
    ['famous', 'faith', 'feast'],
    ['table', 'famous', 'faith'],
    ['famous', 'table', 'feast'],
  ],
  legend: [
    ['open', 'tell', 'belief'],
    ['open', 'tell', 'place', 'belief'],
    ['tell', 'belief', 'place'],
    ['open', 'tell', 'belief', 'close'],
  ],
  present: [
    ['realm', 'now', 'end'],
    ['now', 'realm', 'end'],
    ['realm', 'now', 'hope', 'end'],
    ['now', 'hope', 'end'],
    ['realm', 'people', 'now', 'end'],
    ['people', 'now', 'hope', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ preface
  'preface.purpose': [
    'I have (set down|written) in these pages (what is known|all that I could learn) of {subject}, (as far as|so far as) (the records allow|it can be known).',
    'No one had yet written (the whole|a full account) of {subject} in one (place|book), and so I have (tried|taken it upon myself) to do it.',
    '(This book|What follows) was (many|some) years in the (making|writing), and I hope the reader will find it worth the (trouble|reading).',
    'I have (set down|written) (here|in these pages) the (history|story) of {histtown}, from (its founding|the day {founder} came) to (the present day|our own time|the year {year}).',
    '(This book|What follows) is (an account|a history) of {histtown}, (as far as|so far as) (it can be known|the records allow|the old folk remember).',
    'It (was|has long been) my (wish|aim) to (gather|bring together) (what is known|everything that is told) of {histtown} (into|in) one (book|place), (before|lest) it (is|be) forgotten.',
    '(No one|Nobody) (had yet|had ever) (written|set down) the (whole|full) story of {histtown} in one (place|book), and so I have (tried|taken it upon myself) to do it.',
    'I (was born|grew up) in {histtown}, and (this book|these pages) (is|are) my (thanks|debt) to it.',
    'A town (is|keeps) more than its (walls|houses), and (this book|what follows) is (an attempt|my attempt) to (write down|set down) the rest of {histtown}.',
  ],
  'preface.sources': [
    'I have (read|drawn on) every (book|book and roll) (on|about) {subject} (I could|that I could) (find|lay hands on), and (spoken with|asked) (anyone|those) who (knew|remembered) more.',
    'Where (the books|the old books) (disagree|tell it differently), I have (given|set down) what (seems|seemed) to me (likeliest|the likeliest), and (said|noted) where others differ.',
    'I have (drawn on|read|used) the (temple rolls|tax books|old rolls|council minutes) of {histtown}, and (listened to|spoken with) the (oldest folk|elders) (who|that) (still remember|remember) (more than|what) the rolls (forget|do not say).',
    'Where the (rolls|records) (are silent|say nothing), I have (written down|given) only what (the old folk|the townsfolk) (tell|say), and (said so|marked it as such).',
    'The (oldest|earliest) (rolls|records) of {histtown} (are|were) (kept|written) by the {clergy} of {god}, (in a hand|and in a hand) (that is|) (hard|not easy) to read.',
    '(Much|Most) of what (follows|is written here) (comes from|was taken from) the (rolls|records) of the temple, (which|and these) (are|I have found to be) (trustworthy|careful) in (such matters|matters of years).',
    'The (old folk|elders) of {histtown} (gave|lent) me (their|) (memories|stories) (freely|gladly), and (more than one|many a) (evening|winter evening) (was|went) (spent|by) (by|at) (their|a) fire (listening|while they talked).',
  ],
  'preface.debt': [
    '{otherauthor} (went over|covered) (some of|much of) (this ground|the same ground) before me, in {otherbook}, and I (owe|am in debt to) (that book|them) (a great deal|more than I can say).',
    'The reader who wants more (of|on) {othertopic} (should|may) (turn to|read) {otherbook}, by {otherauthor}, which I have (leaned on|used) (often|freely).',
    'Where this book and {otherbook} (disagree|tell it differently), I have (said so|noted it), without (claiming|pretending) to be the more right.',
  ],
  'preface.humble': [
    'Any (errors|mistakes) are my own[, and I ask the reader\'s (pardon|patience) for them].',
    'I (do not claim|make no claim) that (this book|it) is (complete|the whole of it): there (are|will always be) more (stories|tales) than any one (book|writer) can (hold|gather).',
    'If (I have|this book has) (left out|forgotten) (anything|anyone) that (matters|ought to be in it), the (fault|blame) is mine (alone|and nobody else\'s).',
    'I (am|was) no (scholar|great writer), and (this|it) (is|was) (a plain book|plainly written); but (it is|everything in it is) (true|as true as I could make it).',
  ],
  'preface.pious': [
    'I began this book with a prayer to {god}, and I (end|finish) it the same way.',
    '{god} (gave|has given) me the (years|patience) to (finish|write) it, and I (give thanks|am thankful) for it.',
    'I (wrote|have written) (it|this book) (in|by) the (light|lamp) of the temple of {god}, (between|after) the (evening|night) (prayers|rites).',
  ],
  'preface.dedicate': [
    'I (give|dedicate) (this book|these pages) to the (people|folk) of {histtown}, who (made|have made) its history and (seldom|rarely) (wrote|write) it down.',
    '(This book|These pages) (is|are) for (my|the) (grandchildren|children of {histtown}), (that|so that) they (know|may know) (where they come from|whose town it is).',
    'To the (memory|memory of the dead) of {histtown}, (and|) (those|all) (who|that) (lie|are buried) (under|by) the temple of {god}.',
  ],

  // ------------------------------------------------------------ the land
  'land.lie': [
    '{town} (lies|stands) (on|by|beside) {water}, (in|amid) {ground}[, (on|in) {land}].',
    '{town} stands (in|among) {ground}, (on|toward) the (edge|heart) of {land}.',
    'The (land|country) (about|around) {town} is {ground}, with {water} (running|winding) (close by|past its gates|below it).',
    'Those who (come|travel) to {town} (come|pass) (through|across) {ground}[, (and|with) {water} (beside|alongside) them (the last mile|for the last mile)].',
    '(Seen|Looked at) from (the hills|a distance|the road), {town} is (a cluster of roofs|a huddle of roofs|a smudge of smoke) (in|among) {ground}.',
  ],
  'land.before': [
    'Before (there was a town|the founding|anyone settled there), the (place|land) was (nothing but|only) {ground}, (crossed|walked) by (deer|herds|hunters) and (little else|no one who stayed).',
    '(No one|Nobody) (lived|had lived) there (before|until) {founder} (came|arrived)[, (or|at least) (no one|nobody) (who left|that left) (a mark|a name)].',
    'The (old folk|elders) say (that|) (before|long before) the (town|first house), the (place|spot) (belonged to|was known only to) the (wolves|birds|beasts of {ground}).',
    '(What|Whatever) was (there|on the spot) before {town} (is|has been) (forgotten|lost), (but|though) (the ploughs|ploughmen) (still|now and then) (turn up|find) (old|strange) (stones|pots|bones) (in the fields|there).',
  ],
  'land.why': [
    '(Good|Clean) water, (good|black) earth and (timber|stone) near at hand (are|were) reason enough (for a town|to stay).',
    '{water} (gave|offered) (fish|water) and a (road|way) (to the sea|downstream), and that (is|was) (more than most places can say|reason enough to stay).',
    'It is not (the easiest|an easy) (place|spot) to (live|make a living), but it is a (good|safe) (place|spot) to (defend|be left alone).',
    'Whoever (chose|picked) the (spot|place) (chose|picked) (well|wisely): there is (sweet|fresh) water (in every season|all year), and (it is|it lies) (out of|sheltered from) the (worst of the wind|wind).',
  ],

  // ------------------------------------------------------------ the founding
  'founding.first': [
    'The first (houses|halls) were (built|raised) of (timber|turf and timber|rough stone) (close to|by|along) the water, and the (fields|land) (around|about) them (was|were) (cleared|broken) by hand.',
    '(Within|In) a (generation|few years) (there was|the settlers had) a (well|mill|market) and a (shrine|temple) to {god}[, and the beginnings of a town].',
    'They (built|raised) the (hall|first hall) (first|before anything else), (and|then) the (houses|homes), (and|then) a (wall|fence) (of stakes|of timber) (around|about) (them all|the lot).',
    '(The settlers|They) (cut|cleared) the (first|) ground (with|by) (axe|axes) and fire, and (sowed|planted) it (that|the first) spring.',
    'The (first|oldest) (house|houses) of {town} (stood|stand) (still|) (near|by) the (square|well), (though|but) (it has|they have) been (rebuilt|mended) (many times|so often) (since|that little of the first is left).',
  ],
  'founding.hardship': [
    'In the first (winter|years) (the settlers|they) went (hungry|short), and not all of them lived to see the spring.',
    'The first (winters|years) were (hard|bitter), and (the settlers|they) (lived|got by) on what they could (hunt|catch|gather) (until|till) the (first|) harvest (came in|was in).',
    '(Sickness|Fever) (took|carried off) (some|a few) of the (first|) (families|settlers) (in|before) the first year (was out|ended)[, and they are (buried|remembered) (by|near) the (old|first) well].',
    '(It was|Those were) (hard|lean) years, (and|but) (no one|nobody) (went back|turned back) (the way they had come|to where they came from).',
  ],
  'founding.grow': [
    '(Others|More settlers) (followed|came after), (hearing|having heard) of the (good|black) earth, and (in|within) (twenty|thirty|forty) years the (place|settlement) (was|had become) a (village|town) (of|with) (a hundred|two hundred) (souls|hearths).',
    'The (village|settlement) (grew|throve) (slowly|steadily), a (house|family) at a time, (until|till) (it was|it had become) (big enough|large enough) to (need|want) a (market|council) of its own.',
  ],
  'founding.name': [
    '{founder} is (remembered|honoured) (still|to this day) in {town}, (where|and) (children|the young) (learn|are taught) the name (before|as soon as) they can (walk|read).',
    '(There is|The town keeps) a (stone|carving|feast) (for|in honour of) {founder}, though (no one|nobody) now (knows|can say) (where|which) (the grave|their grave) (is|was).',
    '(Every|Each) (child|boy and girl) in {town} (can|could) (tell you|tell) (how|the story of how) {founder} (came|founded it), (and|though) (each|every one) (tells|of them tells) it (a little|) differently.',
  ],

  // ------------------------------------------------------------ an event
  // (Something remembered, neither good nor ill.)
  'event.detail.lore': [
    '(The rolls|The records) (say|tell) (little|less than we would like) of it, but the (old folk|elders) (tell|told) (more|much more), (though|and) (never|not always) the same way twice.',
    '(Those|The few) who saw it (spoke|talked) of it (all their lives|to the end of their days), and their (children|grandchildren) (tell it still|still tell it).',
    'The whole of {town} (talked|spoke) of (nothing|little) else (for a month|for a season|all that year).',
    '(It|The thing) (is|was) (written|set down) in the (temple rolls|rolls) in (a careful|a plain|an unsteady) hand, (with|and) (nothing|no word) (said|added) of what (anyone|the writer) (thought|made) of it.',
  ],
  'event.after.lore': [
    'Life in {town} (went on|returned to what it had been), as (it does|it must), (but|and) (it|the thing) was (not|never) (forgotten|quite forgotten).',
    'It has been (told|remembered) (every year|each year) since, on the (anniversary|day itself), (by|among) (the old folk|those who keep such things).',
  ],
  // (A good year.)
  'event.detail.good': [
    '(Folk|The townsfolk) (still|) (speak|talk) of (that year|those years) as the (best|happiest) {town} (ever had|has known).',
    'There was (money|coin) (in every purse|in every house) (that|for a) (year|while), and (new|fine) (houses|roofs) (went up|were raised) (along|on) the (square|high street).',
    '(Word|News) of it (went|spread) (all over|across) {land}, and (folk|people) (came|travelled) (from|out of) (far|the other towns) to (see|share in) it.',
    'The {clergy} of {god} (gave|offered) (thanks|a feast of thanks) (in|at) the temple, and (the whole town|everyone) (came|turned out) (to hear it|for it).',
  ],
  'event.after.good': [
    '(It|That good fortune) did not last (for ever|forever), (as|for) (such things|good years) (never|do not) (do|last); but it (is|was) (remembered|not forgotten).',
    '(A good deal|Much) of what (is|stands) (finest|best) in {town} (today|now) was (built|paid for) in (that year|those years).',
    '(Since then|After that), {town} has (thought|spoken) of itself as (a lucky place|the kind of place fortune smiles on).',
  ],
  // (A bad year.)
  'event.detail.bad': [
    '(Folk|Families) went (hungry|short) that (year|winter), and more than one (family|household) (left|gave up and left) {town} for good.',
    'The (worst|hardest) of it (fell|came) on the poor, as (it always does|the worst always does), and the {clergies} of {god} (fed|kept) (whom|those) they could.',
    '(It|The year) is (remembered|spoken of) (still|to this day) as (a black year|the black year|the bad year) in {town}.',
    '(No one|Nobody) (could|can) (remember|say) (a worse|a harder) (time|year), (and|though) (some|the old folk) (said|swore) (that|) (worse|harder) (was|were) (to come|coming).',
  ],
  'event.after.bad': [
    '{town} took (years|a generation) to (mend|recover), (but|and) mend it did.',
    '(Afterwards|After that), the (council|elders) of {town} (made|passed) (new rules|a law) so that the like (should|might) not (come|happen) again.',
    '(Those|The ones) who (lived|came) through it (were|grew) (harder|tougher) for it, (they said|or so they said), (and|but) they (never|seldom) spoke of it (gladly|willingly).',
  ],
  // (The town's oath to its realm.)
  'event.detail.oath': [
    '(It was|This was) not (done|decided) (lightly|in a day): the (council|elders) (argued|talked) (through|for) a whole (winter|season) before they (agreed|swore).',
    '(Some|Many) in {town} (wanted|would have) no (lord|crown) but their own (council|elders), but they were (outvoted|fewer).',
    'The oath was (sworn|taken) in the (square|hall), before the whole town, with the (banner|standard) of {realm} (hung|raised) over the (door|gate).',
  ],
  'event.after.oath': [
    '(Since then|From that day), {town} (has sent|has paid) its (taxes|tithes) to {capital}, and (its|the) (young|young men and women) (have marched|march) (under|with) the (banner|standard) of {realm} (when|whenever) (it|they) (calls|are called).',
    'Whether (it|the oath) was (wise|the right choice), (folk|the townsfolk) (still|) (argue|disagree) (over|about) it (in the taverns|over their ale) (to this day|today).',
  ],
  // (The town's young gone to war.)
  'event.detail.war': [
    '(The|Its) (young|young folk) (marched|went) out (under|behind) the banner of {realm}, (singing|with drums), and (fewer|not all of them) (came|marched) (home|back).',
    '(Every|Each) (house|family) in {town} (lost|gave) (someone|a son or a daughter) (that|in that) (year|war), or (knew|had) (a neighbour|someone) who (did|had).',
  ],
  'event.after.war': [
    '(Their|The) names (are|were) (cut|carved) (on|into) a stone (on|by) the square, and (each year|every year) (flowers|garlands) are (laid|left) (at its foot|there) (on|for) {feast}.',
  ],
  // (A battle by the town, in one of the old wars.)
  'event.detail.battle': [
    'The (fighting|battle) (came|spread) (right|) up to the (fields|gates) of {town}, and (the townsfolk|folk) (watched|saw) it from the (walls|rooftops) (with their hearts in their mouths|in silence).',
    'The (wounded|dying) were (carried|brought) into {town} (by|on) the (cartload|wagonload), and (every|each) (house|hall) (became|was made) a (hospital|sickroom) (that|for a) (night|week).',
    '(Arrows|Spearheads) (from|of) that (day|battle) (are|have been) (still|) (turned up|found) by the (ploughs|ploughmen) (in|of) the fields (outside|about) {town}.',
  ],
  'event.after.battle': [
    'The dead (of both sides|of either side) were buried (together|side by side) in (a|one) long grave (outside|by) the {town} road, (and|where) (a|the) (cairn|stone) (marks|stands over) (it|them) (still|to this day).',
    '(For|In) (years|a generation) (after|afterwards), (no one|nobody) in {town} (would|could) (walk|go) (that|the) (field|road) (after dark|at night).',
  ],
  // (Given away in a peace, to another realm.)
  'event.detail.ceded': [
    '(Nobody|No one) in {town} (was|had been) asked, (and|but) the (banner|standard) of {victor} (went up|was raised) over the (gate|hall) (before|by) the (month|season) was out.',
    '(Some|Many) (folk|families) (left|went) (for|over the border to) {loser2} (rather than|sooner than) (swear|live under) (the|a) new (oath|crown), (and|but) (most|the rest) (stayed|stayed on), as (most folk|people) (do|always do).',
  ],
  'event.after.ceded': [
    '(The|Its) (old folk|oldest folk) (still|) (speak|talk) of (the|that) (year|peace) (bitterly|with a shrug), (and|but) their grandchildren (know|have known) no other (crown|realm).',
  ],
  // (The realm proclaimed in it.)
  'event.detail.proclaimed': [
    '(The|Its) (chiefs|heads of the great families) (came|rode) (in|into {town}) from (every|all) (corner|part) of {land} to (see|swear to) the (new|first) ruler, and {town} (feasted|was feasting) (for|through) a (week|fortnight).',
    '(From|After) (that day|then), {town} (has been|was) the seat of the (realm|crown), and (its|the) (hall|great hall) (grew|was rebuilt) (to match|in stone).',
  ],
  // (An old place gone bad.)
  'event.detail.dungeon': [
    '(Mothers|Grandmothers) in {town} (still|) (frighten|hush) (their|) children (with|by naming) it, (and|though) (few|none) of them (have|has) (seen|been near) it (themselves|with their own eyes).',
    '(Shepherds|Hunters) who (pass|passed) near it (say|have said) they (hear|have heard) (things|voices) (below|under the ground) (at night|after dark).',
    '(Its|The) (story|tale) (is|has been) told to every (child|generation) in {town}, as a warning.',
  ],
  'event.after.dungeon': [
    '(No one|Nobody) has (gone|been) (down|in) since[, or (no one|nobody) who came back to say so].',
    'The way in is (marked|shown) on no map (made in|of) {town}, but every child (knows|in {town} knows) the way all the same.',
  ],
  'event.remark': [
    '(Such|These) are the (trials|years) by which a town (learns|finds out) what it is made of.',
    'I (set it down|write it) (here|plainly) as the (rolls|records) (have|give) it, without adding anything of my own.',
    '(It is|This is) (worth|well worth) (remembering|setting down) that the (people|folk) of {town} did not (give up|leave), whatever (came|befell them).',
    '(Every|Each) town (has|keeps) (such years|years like these) in its (past|history), and {town} (has|keeps) (more than its share|its share).',
  ],
  'event.source': [
    'So (say|run) the (temple rolls|old rolls|records) of {town}, (which|and these) (are|I have found to be) (careful|trustworthy) in (such matters|matters of this kind).',
    '(The|My) (account|telling) (here|) (follows|is taken from) the (rolls|records) (of the temple|kept by the {clergy}), (which|and they) (give|have) the (year|date) (plainly|exactly).',
    'I (had|heard) (this|the story) from (an old|the oldest) soul in {town}, whose (grandmother|grandfather) (saw it|was there).',
  ],
  'event.link': [
    '{when}, {other}.',
    '{when}, {other}[, (though|but) (the rolls|the records) of {town} (say nothing of it|do not mention it)].',
    'It is (worth|well worth) (remembering|noting) that, {whenlow}, {other}.',
  ],
  // (Each kind of thing that befalls a town.)
  'event.detail.fire': [
    'The fire (began|started)[, it is said,] in a (baker\'s|chandler\'s|smith\'s) (shop|yard) (near|by) the (square|market), and the wind (did the rest|carried it from roof to roof).',
    '(Thatch and timber|Timber and straw) burned (like kindling|as dry as tinder), and by (morning|nightfall) whole streets were (gone|ash|nothing but black posts).',
    'The (people|townsfolk) (formed|made) (bucket-lines|lines with buckets) (from the well|from the water), but the flames (outran them|were faster).',
    '(No one|Nobody) (can|could) say (how many|who) (died|were lost) that night, for the (rolls|records) (burned|went up) (with the rest|too).',
  ],
  'event.after.fire': [
    '{town} was (rebuilt|built again) (in stone|in brick|street by street), and (it is|it was) (the better|a finer town) for it.',
    'A (law|rule) was made that no (roof|house) (within|inside) the (walls|town) (should|might) be (thatched|of timber) again.',
    'The (black|scorch) marks (can|may) (still|) be seen (on|upon) the (oldest|older) (houses|stones) (by|near) the (square|well).',
  ],
  'event.detail.flood': [
    'The (water|flood) (came|rose) in the night, (and|so that) (by|at) (morning|dawn) the (lower|low) (streets|houses) (were|stood) (under|in) water (to the sills|to the eaves).',
    '(The rain|It) (had|) (fallen|come down) for (nine|eleven|many) days (without|with no) (stopping|break), and the (banks|walls) (could|did) not hold.',
    '(Folk|People) (took|went up) to the (roofs|upper floors) with what they could (carry|save), and (watched|saw) the (rest|everything else) (float|go) (away|past).',
  ],
  'event.after.flood': [
    'The (mill|fields) (was|were) (rebuilt|mended) (higher|further from the water), and (a mark|a line) (was cut|cut) (on|in) the (temple|town) wall (shows|to show) (how high|where) the water (came|rose).',
    'When the water (went down|fell), it (left|had left) (a foot of|a crust of) (mud|silt) (over|on) (everything|the fields), and the (harvest|next harvest) (was|came) (the best|richer than) (in living memory|anyone remembered).',
  ],
  'event.detail.plague': [
    'The (sickness|fever) (came|began) (with|among) the (traders|travellers|sailors), and (spread|went) from house to house (faster|quicker) than (word of it|the {clergy} could pray).',
    '(Whole|Some) (families|households) (died|were lost) (together|in a week), and the (bells|temple bell) (rang|tolled) (every day|day after day) (for|through) (a month|the summer).',
    'The {clergy} of {god} (nursed|tended) the (sick|dying) (until|till) (they|many of them) (fell sick|sickened) themselves.',
  ],
  'event.after.plague': [
    'The (graveyard|burial ground) (was|had to be) (doubled|made larger), and (the|a) (stone|plain stone) (by its gate|at its gate) (names|remembers) the dead of that year.',
    '(For|In) (years|a generation) (after|afterwards), (no|few) (stranger|strangers) (was|were) (let in|welcome) (without|unless they had) (a word|a letter) (from|for) (someone|the council).',
  ],
  'event.detail.siege': [
    'The (enemy|besiegers) (camped|sat down) (before|outside) the walls (for|through) (a whole season|the summer|forty days), and (tried|tested) the gates (night after night|again and again).',
    '(Inside|Within) the walls (the people|folk) (ate|were eating) (their horses|the last of the grain|rats) (before|by) the end, (but|and still) (they did not|no one would) (open the gates|give up).',
    'The (watch|defenders) (held|kept) the (walls|gate) with (whatever|what) they had: (spears|bows), (stones|roof tiles) and (boiling|hot) (water|pitch).',
  ],
  'event.after.siege': [
    '(A stone|A plaque) (by|over) the (gate|main gate) (remembers|names) (those|the ones) (who|that) (held|kept) it, and (fell|died) (doing so|there).',
    '(The siege|It) (is|was) (still|) (remembered|spoken of) (each year|every year) (with|by) (a vigil|a feast|a night of bonfires) on the walls.',
  ],
  'event.detail.famine': [
    'The (harvest|crop) (failed|had failed), and (by|before) (midwinter|the new year) the (granaries|barns) were (empty|bare).',
    '(Folk|People) (ate|were eating) (acorns|bark and roots|boiled leather) by the end, and (the old|the weakest) (died|went) (first|before the rest).',
    'The (council|elders) (shared|gave out) (what was left|the last of the grain) by the (handful|measure), (and|but) (it was not enough|there was never enough).',
  ],
  'event.after.famine': [
    '(Since then|Ever since), {town} has kept a (granary|store of grain) against (hard years|the next bad year), and no (council|mayor) has dared to empty it.',
    'The (spring|next spring) (came|was) (late|kind), and the fields were (sown|planted) (again|from seed begged from (neighbours|the next valley)).',
  ],
  'event.detail.omen': [
    '(Some|Many) took it for (a sign|an omen) of (war|plague|great change) to come, (and|while) others (said|thought) it (was|meant) nothing at all.',
    'The {clergy} of {god} (watched|kept watch on) it (every night|night after night), but could not (say|tell) whether it (meant|was) good or ill.',
    '(Children|Folk) (stayed|were kept) (indoors|in) after dark, and (the|every) (temple|shrine) was (full|crowded) (every|each) night (it shone|it hung there).',
  ],
  'event.detail.temple': [
    '(The|Its) (stone|stones) (was|were) (hauled|brought) from (the hills|far off) (by|on) (ox-cart|the backs of the faithful), and (it|the work) (took|was) (a generation|thirty years) (to finish|in the building).',
    '(Every|Each) (family|household) in {town} (gave|paid for) (a stone|something), and (their names|the givers\' names) are (cut|carved) (inside|in) the (porch|walls) (still|to this day).',
    '(It|The temple) (stands|has stood) (since|ever since), (and|) (the|its) (bell|bells) (can|may) be heard (all the way to|as far as) the (fields|hills) on (a|any) (still|quiet) day.',
  ],
  'event.detail.realm': [
    '(It was|This was) (not|) (done|decided) (lightly|in a day): the (council|elders) (argued|talked) (for|through) (a whole|the) (winter|season) (before|until) they (agreed|swore).',
    '(Some|Many) in {town} (wanted|would have) (no lord|no crown) (but|except) their own (council|elders), (and|but) (they were|the rest) (outvoted|fewer).',
    'The oath was (sworn|taken) in the (square|hall), before (the whole town|everyone), with (a|the) (banner|standard) of {realm} (hung|raised) (above|over) the (door|gate).',
  ],
  'event.detail.news': [
    '(It|This) (is|was) (still|) (fresh|new) (enough|) (in|to) the (memory|minds) of (the|most) (townsfolk|people of {town}) (that|and) (they|folk) (speak|talk) of it (often|still).',
    '(Those|All) (who|that) (were|lived) in {town} (then|at the time) (remember|will remember) (where|what) (they were|they were doing) when (they heard|the word came).',
    '(The|What) (rolls|records) (have|say) (of it|) (is|are) (short|brief); (the|what) (talk|is said) in the (taverns|square) (is|) (longer|much longer).',
  ],
  'event.detail.wreck': [
    'The (ship|wreck) (broke|went to pieces) on the rocks (within sight of|in plain sight of) the (town|shore), and (the people|folk) (went|waded) out (into the surf|in the storm) to (pull|drag) the (sailors|survivors) (ashore|out).',
    '(Its|The) (timbers|cargo) (washed|came) (ashore|up) for (weeks|a month) after, and (more than one|many a) house in {town} (is|was) (roofed|built) with (them|its timbers).',
  ],
  'event.detail.drought': [
    'The (wells|springs) (sank|dropped) (lower|deeper) (every|each) (week|day), and (folk|the people) (walked|went) (miles|half a day) (for|to fetch) (water|a jar of water).',
    'The (fields|ground) (cracked|split) (in|under) the sun, and the (herds|beasts) (were|had to be) (slaughtered|killed) (before|rather than let them) (they|) (starved|starve).',
  ],
  'event.detail.winter': [
    'The (snow|drifts) (lay|came) (to|over) the (eaves|doors), and (folk|the people) (went|passed) (from house to house|between houses) by (tunnels|paths) (dug|cut) (through|in) (it|the snow).',
    'The (watch|night watch) kept the fires (high|burning) (all night|through the dark), (and|while) (the wolves|the pack) (called|howled) (from|in) the (trees|forest) (close by|outside the walls).',
  ],
  'event.detail.fog': [
    'The fog (lay|sat) so (thick|heavy) (that|) (folk|the townsfolk) (could not|could hardly) see their own hands (before|in front of) their faces.',
    '(Boats|Fishers) (that|who) (went out|put out) (into it|in it) (did not|never) come back, and (their|the) (names|boats) (are|were) (cut|carved) (on|into) the (post|stone) by the (landing|water).',
  ],
  'event.detail.statue': [
    'The (statue|likeness) (was|is) (cut|carved) from (white|grey|local) stone, and (it|the face) (is|was) (said to be|thought) (a fair|a good) likeness[, (though|but) (those|the folk) (who knew them|who remember) (say otherwise|are not so sure)].',
    '(The whole of|All) {town} (turned out|came) (to see it|for the raising), and (there was|it was) (feasting|a feast) (till|until) (dawn|the small hours).',
  ],

  // ------------------------------------------------------------ the town's ways
  'ways.famous': [
    '{town} is (known|famous|spoken of) (far and wide|across {land}|beyond its walls) for {famous}[, and (its people|the townsfolk) (are|have always been) (proud|vain) of it].',
    '(Ask|Speak to) anyone (on the road|in the markets of {land}) about {town}, and the first thing they will (mention|speak of) is {famous}.',
    'Whatever else {town} (is|has been) (known|remembered) for, it (is|has always been) {famous} (first|above all).',
  ],
  'ways.table': [
    '(The table|The food) of {town} is the (food|table) of the {people}: {dish} (above all|first of all), and {dish2}, (washed down|taken) with {drink}.',
    'No (feast|table) in {town} is (thought|counted) (complete|whole) without {dish}, and a guest (who refuses|that refuses) it (is|will be) (thought|counted) (rude|ill-mannered).',
    '(Every|Each) (house|kitchen) in {town} (has|keeps) its own (way with|way of making) {dish}, and (each|every one) (swears|holds) (theirs|its own) (is|to be) the (only|true) (one|way).',
    '{drink} is (drunk|taken) (at every meal|with everything) in {town}, by (young and old|old and young) alike; but (strangers|visitors) (should|had better) (go carefully|take care) with it.',
  ],
  'ways.faith': [
    'The faithful of {town} keep {faith}, and honour {god}, whose (sign|token) is {symbol}.',
    '{town} (keeps|has always kept) {faith}, and its {clergies} are (much|well) (loved|respected) (there|in the town).',
    'In {faith}, the (first|highest) virtue is {virtue}, and the folk of {town} (try|are said) to (live by it|keep to it)[, (more or less|for the most part)].',
  ],
  'ways.feast': [
    '{holyday} is the holy day, and (on it|then) (the|no) (shops|work) (close|is done) (till|until) (evening|the evening bell).',
    '(At|For) {feast}, the whole of {town} (turns out|gathers) (in|on) the (square|streets), and the {clergy} leads the (procession|rites).',
    '{feast} is the (great|greatest) (feast|day) of the year in {town}, and (folk|people) (come|walk) (from|out of) the (farms|villages) (for miles|round about) (to keep it|for it).',
  ],

  // ------------------------------------------------------------ the legend
  'legend.open': [
    '(Every|Each) town (has|keeps) its (old|) (story|stories), (told|that are told) (round|by) the fire (on|in) (winter|long) (nights|evenings), and {town} (is|) no (different|exception).',
    '(I|It) (would|) (not|) (be|seem) (right|fair) to (leave|end) (this book|a history of {town}) without (its|the) (oldest|best-known) (story|tale).',
  ],
  'legend.belief': [
    '(Whether|How much of) it is true, I (cannot|could not) say; but (no one|nobody) in {town} will (go|walk) there after dark.',
    'The {clergy} (call|calls) it (a tale for children|an old wives\' tale), but (they|the {clergy}) (do not|never) (laugh|smile) when they (say so|say it).',
    'I have heard it (told|said) (three|four|five) (ways|different ways), and (in every one|each time) the ending was the same.',
    '(Sensible|Learned) (folk|people) (laugh|smile) at it by day, (but|and) the same folk (bar|lock) their (doors|shutters) at night.',
  ],
  'legend.place': [
    '(Some|Others) (say|hold) (that|) (it has|the story has) (something|much) to do with {dungeon}, (out|which lies) {where}.',
    '(Folk|The old folk) (who|that) (tell|know) it (best|well) (point|nod) (toward|in the direction of) {dungeon}, {where}, (when|as) they (tell|finish) it.',
  ],
  'legend.close': [
    '(But|And) (that|this) is (a story for the fire|a tale for a winter fire), and not for a (history|book of years).',
    '(I|So I) (leave|set) it (here|down), (for|as) (what it is worth|the reader to make of it what they will).',
  ],

  // ------------------------------------------------------------ the present day
  'present.realm': [
    '{town} (is sworn|swears) to {realm}, (and|whose) {ruler} (rules|reigns) from {capital}.',
    '(Today|Now) {town} (is|stands) (among|one of) the (towns|places) of {realm}, (under|ruled by) {ruler}.',
    'The (banner|standard) of {realm} (flies|hangs) (over|above) the (hall|gate) of {town}, and its (taxes|tithes) (go|are sent) to {capital}.',
  ],
  'present.free': [
    '{town} (owes|swears) (allegiance|fealty) to no (realm|crown), and (its people|the townsfolk) are (proud|glad) of it.',
    '(No|Not one) (king|crown|realm) (has|) (ever|yet) (held|ruled) {town} (for long|for good), and (its council|its elders) (mean|intend) (to keep it so|that none ever will).',
  ],
  'present.now': [
    '(Today|In our own day) {town} is {state}, (and|but) (its people|the townsfolk) (remember|have not forgotten) (where they came from|the hard years).',
    'The {towntype} (that|which) {founder} (founded|began) is (today|now) {state}, and (I|the old folk) (think|believe) {founder} would (know|recognise) (little|hardly anything) of it.',
    '(Some|A good many) (things|ways) in {town} have changed over the years, but (the|its) (market|square) (is|stands) (where|just where) it (always was|has always been).',
  ],
  'present.people': [
    '(Some|About) {souls} (souls|folk) live in {town} (today|now), and {mayor} (keeps|holds) its (hall|council).',
    '{town} (counts|has) (some|about) {souls} (souls|people) (today|now), (under|and its council is led by) {mayor}.',
    '(Today|Now) {mayor} (keeps|holds) the hall of {town}, and (some|about) {souls} (souls|folk) (call|have made) it home.',
  ],
  'present.hope': [
    'May {town} (stand|prosper) (as long again|another {age} years), and (its people|its children) with it.',
    'Long may {town} (stand|prosper), and (its people|its children) with it.',
    'Whatever (the years bring|the future holds), {town} has (come through|weathered) (worse|harder times) before.',
  ],
  'present.end': [
    '(Here|So) (ends|closes) (this|my) (history|account) of {town}.',
    '(What|Whatever) comes next is for (another|some other) (hand|writer) to (set down|write).',
    '(The rest|What remains) of the story (is still being lived|belongs to the living), and cannot yet be (written|set down).',
  ],
};
