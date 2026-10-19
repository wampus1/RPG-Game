// (Round 126) A traveller's road: a journey from town to town across one
// land, as the traveller wrote it up after (in the first person, in the
// past): why they set out, the road between each town and the next (which
// way it ran, the country, the weather, who they met), each town as they
// found it (its look, its inn, its table, its faith and its customs, the
// old place the townsfolk warned them of), and the end of the road. See
// annals.js for how these are written.
export const FLOWS = {
  setout: [
    ['why', 'pack', 'leave'],
    ['why', 'leave', 'mood'],
    ['why', 'pack', 'mood', 'leave'],
  ],
  road: [
    ['way', 'weather', 'meet', 'arrive'],
    ['way', 'country', 'arrive'],
    ['way', 'weather', 'country', 'arrive'],
    ['way', 'meet', 'arrive'],
    ['way', 'country', 'meet', 'arrive'],
  ],
  stay: [
    ['first', 'inn', 'food', 'faith', 'leave'],
    ['first', 'food', 'taboo', 'old', 'leave'],
    ['first', 'inn', 'food', 'old', 'leave'],
    ['first', 'faith', 'taboo', 'food', 'leave'],
    ['first', 'inn', 'faith', 'old', 'leave'],
  ],
  homeward: [
    ['last', 'think', 'end'],
    ['last', 'end'],
    ['think', 'last', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ setting out
  'setout.why': [
    'I (set out from|left) {town} in (early spring|the spring|high summer|the autumn) of {year}, (meaning|resolved) to see the towns of {land} (with my own eyes|for myself) (before I was too old|while my legs were good).',
    'I was (charged|sent) to (carry|take) (letters|a parcel of books) (to|as far as) {last}, and I (meant|resolved) to (see|take in) every town on the road.',
    'I had (lived|been) all my life in {town} and (never|not once) (gone|been) further than (the next village|a day\'s walk), and in {year} I (resolved|decided) to (mend|change) that.',
    'It was the year {year}, and I had grown (restless|tired of my own fireside), (when|so) I took the road out of {town}.',
  ],
  'setout.pack': [
    'I (took|carried) (little|no more than I could carry): a (good|stout) (cloak|pair of boots), a (staff|stick), (bread|oatcakes) and cheese (for|enough for) (three|four) days, and (a purse|a little coin) sewn (into|inside) my (shirt|coat).',
    'My (pack|bag) (held|carried) (a blanket|my blanket), (a|my) (knife|flint), (ink and paper|this book, then empty), and (more|less) (food|bread) than I (needed|turned out to need).',
  ],
  'setout.leave': [
    'I (went out|slipped out) by the {gate} gate (at|before) (dawn|first light), with (no one|nobody) (to see me off|awake to see me go) but the (watch|baker).',
    'My (neighbours|friends) (walked|came) with me (as far as|to) the (bridge|last houses), and (there|then) (we parted|I went on alone).',
  ],
  'setout.mood': [
    'My heart was (light|lighter than it had been in years), and the road (ahead|before me) (seemed|looked) (short|easy), as it always does on the first morning.',
  ],

  // ------------------------------------------------------------ the road
  'road.way': [
    'The road (out of|from) {from} (turns|bends) {way}, and (it is|it was) {days} (of|on) (good|fair|rough) road to {town}.',
    'I (took|kept to) the {way} road out of {from}, (and|which) (brought|took) me to {town} in {days}.',
    '{town} lies {way} of {from}, {days} (away|off) (on foot|by the road), (through|across) {ground}.',
    'From {from} the road (ran|went) {way}, (through|across) {ground}[, and I (walked|kept to) it (for|through) {days}].',
    'It is {days} from {from} to {town}, (going|heading) {way} (through|across) {ground}.',
    'I (left|went out of) {from} (going|heading) {way}, and (the|my) road (lay|ran) (through|across) {ground} (for|all of) {days}.',
  ],
  'road.weather': [
    'It rained (the whole way|all the first day), and I came into {town} (wet to the skin|soaked through) and (glad|very glad) of (any|a) roof.',
    'The (weather|sky) (was|stayed) (fair|kind) (the whole way|all the way), and I (slept|lay) (out|under the stars) (one night|a night) rather than (pay|paying) for a (bed|roof).',
    'A (cold|hard) wind (blew|came) (in my face|against me) (the whole way|all the way), and I (walked|went) (bent|bowed) (into|against) it like an old tree in a gale.',
    '(Mist|Fog) (lay|hung) (on|over) the (low|lower) ground (each|every) morning, (and|but) (burned|lifted) (off|away) (by|before) noon.',
  ],
  'road.meet': [
    'On the road I (fell in with|met) a (pedlar|tinker) (going|bound) the same way, who (talked|told me stories) (the whole way|all the way) and (sold|tried to sell) me a (comb|ribbon) I did not want.',
    'I (passed|met) a (string|long line) of (pilgrims|carts) (going|bound) (the other way|toward {from}), and (they|their leader) (warned|told) me (of|about) (bandits|wolves) (ahead|on the road).',
    '(A|An old) (shepherd|farmer) gave me (milk|bread) at their (gate|door), and would take nothing for it.',
    'I (met|saw) (no one|nobody) (the whole way|on the road) but a (patrol|rider) of the watch of {town}, who (asked|wanted to know) my (name|business) and waved me on.',
  ],
  'road.country': [
    'The country between {from} and {town} is {ground}, and (fair|pleasant|hard) walking in (any|that) season.',
    'For a whole day I saw no one but the birds, and was glad of my own thoughts for company.',
  ],
  'road.arrive': [
    'I (came into|arrived at) {town} (at|toward) (dusk|evening), (as|just as) the temple bell (rang|was ringing) for the evening.',
    'I (reached|came to) {town} (a little after|toward) noon, (hungry|footsore) and (dusty|thirsty) from the road.',
    'The (walls|roofs) of {town} were (red|gold) (in|with) the (evening|setting) sun when I (came|walked) (up to|in at) the gate.',
    '{town} (came into sight|showed itself) from the (last|top of the last) (hill|rise), smoke going up from every roof.',
    'It was (late|dark) when I came to {town}, and the gate was (shut|closing); the (watch|watchman) (let|grumbled and let) me in.',
  ],

  // ------------------------------------------------------------ a town
  'stay.first': [
    '{town} (sits|lies) (by|on) {water}, (a|the) {towntype} of {people} (folk|people), (and|) (busy|quiet) (enough|) (in|at) (that|any) season.',
    'The (houses|roofs) of {town} are (low|tall) and (close-built|crowded together), and its (streets|lanes) (narrow|crooked) enough to lose my way (twice|more than once).',
    '{town} is a {towntype} of {realm}[, (and|) (proud|very proud) of it], (built|set) (by|on) {water}.',
    '{town} is a {towntype} (in|set among) {ground}, and (its|the) (people|folk) are {people}[, (as|like) (most|nearly all) in that country].',
    'My first sight of {town} was (of|) its (market|square), which was (busier|bigger) than I had (expected|been told).',
  ],
  'stay.free': [
    '{town} (owes|swears) (fealty|allegiance) to no (realm|crown), and (its people|they) let me know it (within the hour|before I had my boots off).',
    '{town} is a free {towntype}, (beholden|answerable) to no (realm|crown) but its own (council|elders), and (proud|prouder) of it than (of anything else|of anything).',
  ],
  'stay.inn': [
    'I (lodged|took a bed) at the inn (by|on) the (square|market), where the (beds|rooms) (were|are) (clean|cheap) enough and the (keeper|host) (talked|asked questions) (too much|without stopping).',
    '(There was|I found) no (inn|room) to be had, (and|so) I slept in a (loft|hayloft) over the stables for (a copper|the price of a meal).',
    'The (inn|tavern) (was full of|was crowded with) (traders|travellers) that (night|week), and I shared a (bed|bench) with a (drover|carter) who (snored|talked in their sleep).',
  ],
  'stay.food': [
    '(At|For) supper I (had|was given) {dish}, which (is|they say is) the (pride|glory) of the {people}, and (it|the dish) (was|is) (all|everything) they (say|claim) of it.',
    'They (eat|keep) {dish} and {dish2} in {town}, and drink {drink}[, and I (drank|had) (more|rather more) of it than I should have].',
    'I would (walk|go) (back|again) to {town} (for|just for) its {dish} (alone|and nothing else).',
    'The {drink} of {town} (is|was) (strong|stronger than it looks), (and|as) I (learned|found out) (the|my) first (night|evening) (to my cost|the hard way).',
  ],
  'stay.faith': [
    'The (folk|people) of {town} keep {faith}, and their {clergies} (wear|carry) {symbol} (on|at) (the|their) (breast|belt).',
    'I (was|happened to be) (there|in {town}) on {holyday}, the holy day, and not (a|one) (shop|stall) (would|was willing to) (sell|open) to me (till|before) evening.',
    'I (heard|saw) the {clergies} of {god} (at|keeping) their (rites|evening rites) (in|by) the temple, and the singing was a (fine|strange) thing to hear.',
  ],
  'stay.taboo': [
    'A (stranger|traveller) (should|must) know that the faithful of {town} {taboo}, and (they|folk) think the less of anyone who forgets it.',
    'I was (scolded|told off) on my first (day|morning) for (forgetting|not knowing) that the faithful (here|of {town}) {taboo}.',
  ],
  'stay.old': [
    'The (folk|townsfolk) of {town} (warned|told) me (of|about) {dungeon}, {where}, and (would|did) not (say|speak) (more|much more) of it than that.',
    '(Everyone|Everybody) (in|at) the (inn|tavern) (had|knew) a (story|tale) (of|about) {dungeon}, {where}, and (no two|not two) of them (agreed|were the same).',
    'I (asked|wanted) to see {dungeon}, {where}, but (no one|nobody) (would|was willing to) (take|guide) me (there|out to it) for all the money in my purse.',
  ],
  'stay.leave': [
    '(On|At) the (fourth|third) (morning|day) I (paid|settled) (my|the) (reckoning|bill), (filled|refilled) my (flask|water-skin), and (took|was back on) the road.',
    '(Folk|The townsfolk) (saw|walked) me (to|as far as) the gate when I left {town}, and (pressed|pushed) (bread|a cake) (on|into the hands of) me for the road.',
    'I (did not|could not) (stay|linger) long in {town}, (for|as) the (season|year) was (turning|getting on), and (went|set off) on (the next|the following) (morning|day).',
    'I (stayed|rested) (two|three|four) (days|nights) in {town}, and (left|went on) (with|carrying) more in my pack than I (came|brought).',
    'I (left|was sorry to leave) {town} on a (grey|bright|wet) morning, but the road would not wait.',
  ],

  // ------------------------------------------------------------ the end of the road
  'homeward.last': [
    '{town} was the end of my road, and there I turned for home, by another way that does not need telling here.',
    '(At|In) {town} my (journey|road) (ended|came to its end), for my (boots|legs) (would|could) (go|carry me) no further.',
  ],
  'homeward.think': [
    'I (had|have) (seen|walked through) {count} towns (in|on) that road, and (no two|not two) of them (were|are) alike, (though|and yet) every one of them (is|was) {land}.',
    'If I learned (anything|one thing) on the road, it (is|was) that every town (thinks|believes) itself the (centre|middle) of the world, and every one of them is (right|half right).',
  ],
  'homeward.end': [
    '(Here|So) (ends|closes) (the|my) (account|story) of (my|that) road.',
    'May the reader walk that road (one day|some day), and find it as (kind|good) as I did.',
  ],
};
