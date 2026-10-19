// (Round 126) Beasts and gods: a bestiary of one land (every beast of it as
// it really is: tame or wild, harmless or not, out by day or by night,
// alone or in packs, and what it gives the hunter; and then the things only
// told of), and the book of a faith (its god, its holy day and feast, the
// virtue it prizes, what the faithful don't do, how they see off their
// dead, a parable, a prayer). See annals.js for how these are written.
export const FLOWS = {
  beastopen: [
    ['why', 'how', 'warn'],
    ['why', 'warn'],
    ['how', 'why'],
  ],
  beast: [
    ['open', 'nature', 'habit', 'body', 'use'],
    ['open', 'habit', 'nature', 'use', 'advice'],
    ['open', 'nature', 'body', 'advice'],
    ['open', 'nature', 'habit', 'use', 'advice'],
    ['open', 'body', 'nature', 'habit', 'advice'],
  ],
  haunt: [
    ['told', 'where', 'doubt'],
    ['told', 'doubt'],
    ['told', 'where', 'seen'],
  ],
  god: [
    ['who', 'sign', 'beast', 'love'],
    ['who', 'beast', 'sign'],
    ['who', 'love', 'sign', 'beast'],
  ],
  holy: [
    ['day', 'feast', 'keep'],
    ['day', 'keep', 'feast'],
    ['feast', 'keep', 'day'],
  ],
  virtue: [
    ['open', 'teach', 'example', 'close'],
    ['open', 'teach', 'close'],
    ['teach', 'example', 'close'],
  ],
  rule: [
    ['rule', 'why', 'breach'],
    ['rule', 'breach'],
    ['rule', 'why'],
  ],
  dead: [
    ['rite', 'grief', 'after'],
    ['rite', 'after'],
    ['grief', 'rite', 'after'],
  ],
  parable: [
    ['once', 'trial', 'turn', 'lesson'],
  ],
  prayer: [
    ['call', 'ask', 'end'],
    ['call', 'thank', 'ask', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ a bestiary
  'beastopen.why': [
    '(Every|Each) (hunter|traveller) on {land} (should|ought to) know the beasts of the land: which (to fear|are to be feared), and which (to leave be|are harmless).',
    'I have (set down|written) here every one of the beasts of {land} that I know of, (as|so far as) I have (seen|known) them (myself|with my own eyes) or heard them described by (hunters|those) I (trust|believe).',
  ],
  'beastopen.how': [
    'I (give|set down) for each what it is like, whether it (will|is likely to) (harm|attack) (a traveller|you), and what the hunter (takes|gets) from it.',
  ],
  'beastopen.warn': [
    'No (book|bestiary) is (any|a) (match|substitute) for (a sharp eye|good sense) and (a sharp blade|a stout stick).',
  ],
  'beast.open': [
    'The {beast} is (common|well known) (all over|across) {land}.',
    'Of the {beasts} there is (little|not much) to say that (every|any) (child|farmer) does not already know, but I (set it down|say it) (all the same|for the sake of strangers).',
    '{beasts} are (found|met with) (everywhere on|in every part of) {land}.',
  ],
  'beast.nature.passive': [
    'The {beast} is (harmless|a gentle beast), and (runs|flees) from anyone who (comes|gets) (near|too close).',
    '{beasts} (will not|never) (harm|attack) (a soul|anyone), whatever is done to them.',
  ],
  'beast.nature.neutral': [
    'The {beast} (keeps|goes) its own way, and (will|does) not (trouble|harm) (anyone|a traveller) who leaves it (be|alone); but (strike|harm) it, and it will (fight|turn on you).',
    'Leave the {beast} (be|alone) and it will leave you (be|alone); (corner|strike) it, and (you will|you\'ll) (be sorry|regret it).',
  ],
  'beast.nature.hostile': [
    'The {beast} (is|has always been) (a danger|dangerous) to (travellers|anyone on the road), and will (come at|attack) (anyone|a traveller) it (sees|can see) (without|with no) (warning|cause).',
    '{beasts} (hunt|go for) (people|travellers) (on sight|as soon as they see them), and (no|not one) (traveller|hunter) should take them lightly.',
  ],
  'beast.habit.night': [
    '{beasts} come out (only|) (at|by) night, so that a traveller who (keeps|stays) (indoors|by a fire) after dark has (little|nothing) to fear from them.',
    '(By day|In daylight) (there is|you see) no sign of (them|the {beasts}); it is only after dark that (they come|you meet them).',
  ],
  'beast.habit.pack': [
    '{beasts} (hunt|go) in (packs|twos and threes), and where you see one, look for (the rest|more).',
  ],
  'beast.habit.float': [
    'The {beast} (floats|drifts) through the air (rather than walking|and does not walk), so no (ditch|wall) will keep it out.',
  ],
  'beast.habit.tame': [
    'The {beast} is (kept|bred) on (every farm|most farms) (on|of) {land}, and more are kept (in|about) the towns than are found in the wild.',
  ],
  'beast.body.weak': [
    'It is (small|a small thing) and (easily|quickly) killed, and no hunter boasts of it as a kill.',
  ],
  'beast.body.fair': [
    '(It|The {beast}) is no great danger (alone|on its own), (but|though) (a careless|an unwary) (traveller|hunter) (can|may) still come to harm by it.',
  ],
  'beast.body.hardy': [
    '(It|The {beast}) is (hard|very hard) to kill, and takes more blows than (a|any) (traveller|stranger) (would|might) (think|expect).',
  ],
  'beast.use': [
    '(From|Off) the {beast} the hunter (takes|gets) {drops}.',
    '(Hunters go after|Trappers take) the {beast} for its {drops}, which will (fetch|sell for) (a fair|a good) price in (the|any) market.',
  ],
  'beast.use.tame': [
    '(Farmers|Herders) keep the {beast} for its {drops}, (and|) (no|not a) (farm|farmyard) (on|of) {land} (is|would be) (without|complete without) (one|a few).',
    'The {beast} (gives|is kept for) {drops}, and (a|every) (farmer|household) (with|that keeps) (a few|one or two) (is|counts itself) (never|seldom) (poor|in want).',
  ],
  'beast.body.big': [
    'It is a (big|heavy) beast, and (takes|needs) a strong arm to bring down.',
  ],
  'beast.advice.tame': [
    'A (farmer|household) with (one|a few) (counts itself|is) (lucky|well off), and (a|any) (town|village) (without|that lacks) (them|any) (is|would be) (poor|a poor place) (indeed|).',
  ],
  'beast.advice.passive': [
    'There is no (need|reason) to (fear|be afraid of) it; and (the|a) (hunter|cook) will be glad of it.',
  ],
  'beast.advice.neutral': [
    '(My advice|The wise traveller\'s way) (is|has always been) to (walk|go) (round|past) it, giving it (room|plenty of room).',
  ],
  'beast.advice.hostile': [
    '(Keep|Carry) (a blade|a good blade) (at|to) hand, and never (turn|run) (your back on it|from it).',
    '(Travel|Go) (in company|with friends) (where|when) they are (about|abroad), and (keep|stay) (to|on) the road.',
  ],
  'haunt.told': [
    'In {land} (they|folk) (tell|speak) of {haunt}, (though|but) no (hunter|traveller) I (know|have met) has (seen|met) it.',
    'The {people} (tell|have a tale) of {haunt}, which the old folk (swear|say) (is|was) (seen|abroad) now and then (in|near) {place}.',
  ],
  'haunt.where': [
    '(It|The thing) (is|has been) (seen|met with), if it is seen at all, (near|by) {place}, and (always|only) (at|by) night.',
  ],
  'haunt.doubt': [
    'I (set|put) it (here|down) (for what it is worth|as a curiosity), and (make|claim) no more of it than that.',
    '(Whether|If) such a thing (lives|is real), I (cannot|could not) (say|tell); but I have never (walked|gone) (near|by) {place} after dark.',
  ],
  'haunt.seen': [
    '(A|One) (shepherd|hunter) (of|from) {near} (swore|told me) that they had seen it, but would not (say|tell) (more|much more) than that.',
  ],

  // ------------------------------------------------------------ a faith
  'god.who': [
    '{god} is the (first|highest) (power|god) of {faith}, and the faithful have kept that faith (since|from) the first days of the {people}.',
    '(Of|Among) all the (gods|powers) of the {people}, {faith} (honours|keeps) {god} (first|above the rest).',
  ],
  'god.sign': [
    'The sign of {god} is {symbol}, and it is (carved|cut) (over|above) the door of (every|each) temple (of|in) {realm}.',
    '{symbol} (is|has always been) the (sign|token) of {god}, and the faithful (wear|carry) it (at|on) their (throats|belts).',
  ],
  'god.beast': [
    '{sacredbeast} is (sacred|holy) to {god}, and (no|not one) (faithful|good) (hunter|soul) (will|would) (harm|kill) one.',
    '{god} (once walked|is said to have walked) the earth in the (shape|form) of {sacredbeast}, (as|so) the (old stories|{clergies}) (tell|say).',
  ],
  'god.love': [
    '{god} (asks|wants) (little|not much) of the faithful: (honesty|kindness) to (neighbours|strangers), the holy day kept, and {virtue} (above all|before everything).',
  ],
  'holy.day': [
    '{holyday} is the holy day of {faith}, and (on it|then) (no|little) work is done (from dawn|till the evening bell).',
    '(Each|Every) {holyday} the faithful (rest|keep the day), and (go|walk) to the temple in the (morning|early morning) to (hear|listen to) the {clergies}.',
  ],
  'holy.feast': [
    '{feast} is the (great|greatest) feast of {faith}, and every town of {realm} keeps it with (bonfires|feasting) and (music|singing) (until|till) (dawn|morning).',
    'At {feast} the {clergies} (lead|carry) the (sign|image) of {god} (through|round) the (streets|town), and every household comes out to follow.',
  ],
  'holy.keep': [
    '(Those|The faithful) who (keep|honour) the day (well|rightly) (are|will be) (blessed|remembered) (by|before) {god}, (as|so) the {clergies} (teach|say).',
  ],
  'virtue.open': [
    '(Of|Among) all the virtues, {faith} (prizes|honours) {virtue} (most|above the rest).',
  ],
  'virtue.teach': [
    'The {clergies} (teach|say) that {virtue} is the (root|beginning) of (every good thing|all other good things), and that without it (no|not one) (soul|life) (can|will) (thrive|be whole).',
    '(A|The) (faithful|good) (soul|life) (is|will be) (known|marked) by its {virtue}, (as|just as) (a|the) tree is (known|marked) by its fruit.',
  ],
  'virtue.example': [
    '(It is|They say it was) for {virtue} that {firstking} was chosen to rule, and every ruler of {realm} is held to it (still|since).',
  ],
  'virtue.close': [
    'Let every reader (remember|keep) it, and live by it.',
  ],
  'rule.rule': [
    'The faithful {taboo}.',
    'It is (the|a) rule of {faith} that the faithful {taboo}.',
    '(Among|In) {faith}, the faithful {taboo}, and (they keep|keep) (it|the rule) (strictly|to the letter).',
  ],
  'rule.why': [
    '(It is|This is) (an old|one of the oldest) (rules|customs) of the faith, (older|as old as) the (temples|first temples) of {realm}[, (and|) (no one|nobody) (living|) (knows|remembers) (why|how it began)].',
    '(Some|The {clergies}) (say|hold) (it|the rule) (keeps|is meant to keep) the faithful (humble|mindful of {god}), and others say it was (only|simply) good sense in the old days.',
    'The {clergies} (say|teach) that {god} asked it of the first faithful, and that (whoever|anyone who) breaks it turns their back on {god}.',
  ],
  'rule.breach': [
    '(Folk|Neighbours) (think|will think) the less of (anyone|a neighbour) who (breaks|does not keep) it, (though|but) it is no crime (in|before) the (law|courts) of {realm}.',
    'A (stranger|traveller) who (breaks|forgets) it is (forgiven|pardoned) the first time; but one of the faithful who breaks it is (shunned|put out of the temple) until they make amends.',
  ],
  'dead.rite': [
    'The faithful (are|go) (seen off|laid to rest) with {rite}, and a {clergy} (sings|says) their names over them (three|nine) times.',
  ],
  'dead.grief': [
    'Mourning is kept for a (season|month), and the (mourners|bereaved) (wear|go in) (grey|undyed cloth) until it is done.',
  ],
  'dead.after': [
    '{faith} (teaches|holds) that the dead (go|pass) to {god}, and (wait|are kept) there until (those|the ones) (they loved|who loved them) (come|follow) (after|in turn).',
  ],
  'parable.once': [
    'Once, the {clergies} (say|tell), a (traveller|stranger) came to {capital} (in|on) (the|a) (hungry|cold) (winter|night), and (knocked|asked) at every door for (bread|shelter).',
    'There was once a (stranger|traveller) (in rags|in a grey cloak) who (came|walked) into {capital} (at dusk|on a winter evening), begging (at every door|from house to house) for (bread|a place by the fire).',
  ],
  'parable.trial': [
    'Every door (was|stayed) (shut|closed) against them (but|except) the last, where a (poor|widowed) (soul|weaver) had only a crust left in the house.',
  ],
  'parable.turn': [
    'The (poor|widowed) (soul|one) (shared|gave) the crust (gladly|without a word), and (in the morning|at dawn) the (stranger|traveller) was gone, and the (bread|bowl) (was|had become) (full|whole) (again|once more), and stayed so all that winter.',
  ],
  'parable.lesson': [
    'So the {clergies} (teach|say) that {god} (walks|goes) (among|with) us (in a stranger\'s face|under a beggar\'s cloak), and that {virtue} (is|will be) (repaid|rewarded) (in|at) the (end|last).',
  ],
  'prayer.call': [
    'O {godcall}, (hear|look upon) (us|me), who (keep|have kept) your (day|holy day) and (bear|wear) your (sign|token).',
  ],
  'prayer.thank': [
    'For (bread|the harvest) and (fire|the roof), for our (living|children) and our dead, we (thank|praise) you.',
  ],
  'prayer.ask': [
    '(Keep|Guard) (us|our houses) (from|against) (fever|hunger) and (fire|war), and (teach|give) us {virtue} (enough|) (for|to last) (the|this) (day|year).',
  ],
  'prayer.end': [
    '(So|Thus) (may|let) it be, now and (always|for ever).',
  ],
};
