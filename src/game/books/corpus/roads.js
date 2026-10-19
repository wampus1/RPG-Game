// (Round 126; rewritten Round 127) A traveller's road: a journey from town
// to town across one land, as the traveller wrote it up after (in the first
// person, in the past): why they set out, the road between each town and
// the next (which way it ran, the country, the weather, who they met, what
// they thought on the way), each town as they found it (its look, its inn,
// its table, its faith and its customs, the people they talked to, the old
// place the townsfolk warned them of), and the end of the road. See
// annals.js for how these are written.
//
// The models are the walking books: the traveller who notices the colour of
// the mud and the price of a bed, who is honest about blisters and bad
// suppers, and who lets the country do the talking.
export const FLOWS = {
  setout: [
    ['why', 'pack', 'leave'],
    ['why', 'leave', 'mood'],
    ['why', 'pack', 'mood', 'leave'],
    ['why', 'doubt', 'leave'],
    ['why', 'pack', 'doubt', 'leave'],
  ],
  road: [
    ['way', 'weather', 'meet', 'arrive'],
    ['way', 'country', 'arrive'],
    ['way', 'weather', 'country', 'arrive'],
    ['way', 'meet', 'think', 'arrive'],
    ['way', 'country', 'meet', 'arrive'],
    ['way', 'country', 'think', 'arrive'],
    ['way', 'weather', 'think', 'arrive'],
  ],
  stay: [
    ['first', 'inn', 'food', 'faith', 'leave'],
    ['first', 'food', 'taboo', 'old', 'leave'],
    ['first', 'inn', 'talk', 'food', 'leave'],
    ['first', 'faith', 'taboo', 'food', 'leave'],
    ['first', 'inn', 'faith', 'old', 'leave'],
    ['first', 'talk', 'old', 'leave'],
    ['first', 'food', 'talk', 'leave'],
  ],
  homeward: [
    ['last', 'think', 'end'],
    ['last', 'end'],
    ['think', 'last', 'end'],
    ['last', 'think', 'thanks', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ setting out
  'setout.why': [
    'I (set out from|left) {town} in (early spring|the spring|high summer|the autumn) of {year}, (meaning|resolved) to see the towns of {land} (with my own eyes|for myself) (before I was too old|while my legs were good).',
    'I was (charged|sent) to (carry|take) (letters|a parcel of books) (to|as far as) {last}, and I (meant|resolved) to (see|take in) every town on the road.',
    'I had (lived|been) all my life in {town} and (never|not once) (gone|been) further than (the next village|a day\'s walk), and in {year} I (resolved|decided) to (mend|change) that.',
    'It was the year {year}, and I had grown (restless|tired of my own fireside), (when|so) I took the road out of {town}.',
    'There is a kind of restlessness that comes on in the spring of a certain year of a person\'s life, and in {year} it came on me.',
    'I had read of the road to {last} in other people\'s books for half my life, and in {year} I decided it was time to read it with my feet.',
  ],
  'setout.why@plain': [
    'In {year} I walked from {town} to {last}. This is the account of it.',
    'I left {town} in {year}. I wanted to see {land}, and I had the time.',
  ],
  'setout.why@lyrical': [
    'I left {town} in the spring of {year}, when the hedges were white with blossom and the whole country seemed to be going somewhere, and I went with it.',
    'All that winter of {year} the road to {last} ran through my sleep, and when the thaw came I got up and followed it.',
  ],
  'setout.why@storyteller': [
    'Now, I had a cousin who swore that nobody from {town} had ever walked all the way to {last}, and in {year} I set out to make a liar of them.',
  ],
  'setout.pack': [
    'I (took|carried) (little|no more than I could carry): a (good|stout) (cloak|pair of boots), a (staff|stick), (bread|oatcakes) and cheese (for|enough for) (three|four) days, and (a purse|a little coin) sewn (into|inside) my (shirt|coat).',
    'My (pack|bag) (held|carried) (a blanket|my blanket), (a|my) (knife|flint), (ink and paper|this book, then empty), and (more|less) (food|bread) than I (needed|turned out to need).',
    'I packed and unpacked my bag four times the night before, and still left behind the one thing I needed, which was a second pair of stockings.',
  ],
  'setout.doubt': [
    'My neighbours thought me a fool, and said so; the older ones said it kindly, which was worse.',
    'More than one person told me that the road would be the death of me, and for the first few miles I half believed them.',
  ],
  'setout.leave': [
    'I (went out|slipped out) by the {gate} gate (at|before) (dawn|first light), with (no one|nobody) (to see me off|awake to see me go) but the (watch|baker).',
    'My (neighbours|friends) (walked|came) with me (as far as|to) the (bridge|last houses), and (there|then) (we parted|I went on alone).',
    'I looked back once from the top of the first rise, and saw the smoke of {town} going straight up into a still sky, and then I did not look back again.',
  ],
  'setout.mood': [
    'My heart was (light|lighter than it had been in years), and the road (ahead|before me) (seemed|looked) (short|easy), as it always does on the first morning.',
    'There is no feeling quite like the first mile of a long road, when the boots are still dry and every turning is a promise.',
  ],

  // ------------------------------------------------------------ the road
  'road.way': [
    'The road (out of|from) {from} (turns|bends) {way}, and (it is|it was) {days} (of|on) (good|fair|rough) road to {town}.',
    'I (took|kept to) the {way} road out of {from}, (and it|which) (brought|took) me to {town} in {days}.',
    '{town} lies {way} of {from}, {days} (away|off) (on foot|by the road), (through|across) {ground}.',
    'From {from} the road (ran|went) {way}, (through|across) {ground}[, and I (walked|kept to) it (for|through) {days}].',
    'It is {days} from {from} to {town}, (going|heading) {way} (through|across) {ground}.',
    'I (left|went out of) {from} (going|heading) {way}, and (the|my) road (lay|ran) (through|across) {ground} (for|all of) {days}.',
    'Beyond {from} the road goes {way}, and the going is easy for the first hour and then, as roads do, it changes its mind.',
  ],
  'road.weather': [
    'It rained (the whole way|all the first day), and I came into {town} (wet to the skin|soaked through) and (glad|very glad) of (any|a) roof.',
    'The (weather|sky) (was|stayed) (fair|kind) (the whole way|all the way), and I (slept|lay) (out|under the stars) (one night|a night) rather than (pay|paying) for a (bed|roof).',
    'A (cold|hard) wind (blew|came) (in my face|against me) (the whole way|all the way), and I (walked|went) (bent|bowed) (into|against) it like an old tree in a gale.',
    '(Mist|Fog) (lay|hung) (on|over) the (low|lower) ground (each|every) morning, (and|but) (burned|lifted) (off|away) (by|before) noon.',
    'The sun was hot enough by midday to make me wish I had brought a hat, and I made a poor one out of a dock leaf, which did nothing.',
  ],
  'road.weather@lyrical': [
    'All that day the clouds went over in long grey fleets, and their shadows ran across the country ahead of me like dogs let off the leash.',
    'Rain came in the afternoon, soft and endless, the kind that does not so much fall as hang in the air and wait for you to walk into it.',
  ],
  'road.meet': [
    'On the road I (fell in with|met) a (pedlar|tinker) (going|bound) the same way, who (talked|told me stories) (the whole way|all the way) and (sold|tried to sell) me a (comb|ribbon) I did not want.',
    'I (passed|met) a (string|long line) of (pilgrims|carts) (going|bound) (the other way|toward {from}), and (they|their leader) (warned|told) me (of|about) (bandits|wolves) (ahead|on the road).',
    '(A|An old) (shepherd|farmer) gave me (milk|bread) at their (gate|door), and would take nothing for it.',
    'I (met|saw) (no one|nobody) (the whole way|on the road) but a (patrol|rider) of the watch of {town}, who (asked|wanted to know) my (name|business) and waved me on.',
    'A child herding geese walked beside me for a mile, asking where I was going and why, and was plainly disappointed by both answers.',
  ],
  'road.meet@storyteller': [
    'I shared the road for a while with a carter who swore their mule could count, and I will say this for the mule: it stopped at every inn without being told.',
  ],
  'road.country': [
    'The country between {from} and {town} is {ground}, and (fair|pleasant|hard) walking in (any|that) season.',
    'For a whole day I saw no one but the birds, and was glad of my own thoughts for company.',
    'It is {ground} for most of the way, with a farm now and then and a great deal of nothing in between.',
    'The road was (good|better than I had feared) for the first stretch, and then little more than a cart-track, rutted and full of water.',
    'Here and there along the way stood an old marker stone, its letters worn past reading, still pointing the way to {town}.',
  ],
  'road.country@lyrical': [
    'The land between {from} and {town} is {ground}, and in that season it was all one colour, and the colour had no name.',
  ],
  'road.think': [
    'Walking alone, I found, leaves a great deal of room for thinking, and most of what I thought about was supper.',
    'It struck me on that stretch that I had not known, until I walked it, how large {land} is, or how much of it belongs to nobody.',
    'I have noticed that every road is longer going than coming back, and that this one was longer than most.',
  ],
  'road.think@scholar': [
    'It occurred to me on the way that the distances given in the older books are almost all too short, which suggests their writers rode.',
  ],
  'road.think@pious': [
    'I said the evening prayers to {god} by the roadside, with nobody to hear but the crows, and felt the better for it.',
  ],
  'road.arrive': [
    'I (came into|arrived at) {town} (at|toward) (dusk|evening), (as|just as) the temple bell (rang|was ringing) for the evening.',
    'I (reached|came to) {town} (a little after|toward) noon, (hungry|footsore) and (dusty|thirsty) from the road.',
    'The (walls|roofs) of {town} were (red|gold) (in|with) the (evening|setting) sun when I (came|walked) (up to|in at) the gate.',
    '{town} (came into sight|showed itself) from the (last|top of the last) (hill|rise), smoke going up from every roof.',
    'It was (late|dark) when I came to {town}, and the gate was (shut|closing); the (watch|watchman) (let|grumbled and let) me in.',
    'I smelt {town} before I saw it, woodsmoke and bread, and I do not think anything has ever smelt better.',
  ],

  // ------------------------------------------------------------ a town
  'stay.first': [
    '{town} (sits|lies) (by|on) {water}, (a|the) {towntype} of {people} (folk|people), (and|) (busy|quiet) (enough|) (in|at) (that|any) season.',
    'The (houses|roofs) of {town} are (low|tall) and (close-built|crowded together), and its (streets|lanes) (narrow|crooked) enough to lose my way (twice|more than once).',
    '{town} is a {towntype} of {realm}[, (and|) (proud|very proud) of it], (built|set) (by|on) {water}.',
    '{town} is a {towntype} (in|set among) {ground}, and (its|the) (people|folk) are {people}[, (as|like) (most|nearly all) in that country].',
    'My first sight of {town} was (of|) its (market|square), which was (busier|bigger) than I had (expected|been told).',
    'The first thing anyone in {town} will tell you about is {famous}, and the second thing is usually the same.',
  ],
  'stay.first@lyrical': [
    '{town} lies by {water} like something the land put down and forgot to pick up again, all grey roofs and gardens and the sound of water.',
  ],
  'stay.first@plain': [
    '{town} is a {towntype} by {water}. It is clean, and the people are civil.',
  ],
  'stay.free': [
    '{town} (owes|swears) (fealty|allegiance) to no (realm|crown), and (its people|they) let me know it (within the hour|before I had my boots off).',
    '{town} is a free {towntype}, (beholden|answerable) to no (realm|crown) but its own (council|elders), and (proud|prouder) of it than (of anything else|of anything).',
  ],
  'stay.inn': [
    'I (lodged|took a bed) at the inn (by|on) the (square|market), where the (beds|rooms) (were|are) (clean|cheap) enough and the (keeper|host) (talked|asked questions) (too much|without stopping).',
    '(There was|I found) no (inn|room) to be had, (and|so) I slept in a (loft|hayloft) over the stables for (a copper|the price of a meal).',
    'The (inn|tavern) (was full of|was crowded with) (traders|travellers) that (night|week), and I shared a (bed|bench) with a (drover|carter) who (snored|talked in their sleep).',
    'The inn had one room to let, and a cat had already let it; we came to an arrangement.',
  ],
  'stay.inn@storyteller': [
    'The innkeeper of {town} charged me double for a bed with a sag in the middle like a hammock, and then, I swear it, asked if I had slept well.',
  ],
  'stay.food': [
    '(At|For) supper I (had|was given) {dish}, which (is|they say is) the (pride|glory) of the {people}, and (it|the dish) (was|is) (all|everything) they (say|claim) of it.',
    'They (eat|keep) {dish} and {dish2} in {town}, and drink {drink}[, and I (drank|had) (more|rather more) of it than I should have].',
    'I would (walk|go) (back|again) to {town} (for|just for) its {dish} (alone|and nothing else).',
    'The {drink} of {town} (is|was) (strong|stronger than it looks), (and|as) I (learned|found out) (the|my) first (night|evening) (to my cost|the hard way).',
    'Supper was {dish}, eaten at a long table with a dozen strangers who were not strangers by the end of it.',
  ],
  'stay.food@scholar': [
    'The {dish} of {town} differs from that of the neighbouring towns chiefly in the quantity of salt, a point on which the people of {town} hold firm views.',
  ],
  'stay.faith': [
    'The (folk|people) of {town} keep {faith}, and their {clergies} (wear|carry) {symbol} (on|at) (the|their) (breast|belt).',
    'I (was|happened to be) (there|in {town}) on {holyday}, the holy day, and not (a|one) (shop|stall) (would|was willing to) (sell|open) to me (till|before) evening.',
    'I (heard|saw) the {clergies} of {god} (at|keeping) their (rites|evening rites) (in|by) the temple, and the singing was a (fine|strange) thing to hear.',
  ],
  'stay.faith@pious': [
    'I gave thanks to {god} in the temple of {town} for bringing me safe so far, and the {clergy} there blessed my boots, which needed it.',
  ],
  'stay.taboo': [
    'A (stranger|traveller) (should|must) know that the faithful of {town} {taboo}, and (they|folk) think the less of anyone who forgets it.',
    'I was (scolded|told off) on my first (day|morning) for (forgetting|not knowing) that the faithful (here|of {town}) {taboo}.',
  ],
  'stay.talk': [
    'An old (woman|man) by the well told me the whole history of {town} in the time it took to fill a bucket, and I have not found a better one since.',
    'I asked a boy the way to the market, and he took me there himself, and then to his aunt\'s house, and then to supper.',
    'The people of {town} are slow to speak to a stranger and slower to stop once they have started.',
    'Everyone I spoke to in {town} asked where I was going, and every one of them told me I was going the wrong way.',
  ],
  'stay.talk@plain': [
    'I talked to the miller. They said the harvest would be poor. It was not.',
  ],
  'stay.old': [
    'The (folk|townsfolk) of {town} (warned|told) me (of|about) {dungeon}, {where}, and (would|did) not (say|speak) (more|much more) of it than that.',
    '(Everyone|Everybody) (in|at) the (inn|tavern) (had|knew) a (story|tale) (of|about) {dungeon}, {where}, and (no two|not two) of them (agreed|were the same).',
    'I (asked|wanted) to see {dungeon}, {where}, but (no one|nobody) (would|was willing to) (take|guide) me (there|out to it) for all the money in my purse.',
    'Every town has its bad place, and the bad place of {town} is {dungeon}, {where}; I did not go, and I do not apologise for it.',
  ],
  'stay.leave': [
    'On the (fourth|third) (morning|day) I (paid|settled) (my|the) (reckoning|bill), (filled|refilled) my (flask|water-skin), and (took|was back on) the road.',
    '(Folk|The townsfolk) (saw|walked) me (to|as far as) the gate when I left {town}, and (pressed|pushed) (bread|a cake) (on|into the hands of) me for the road.',
    'I (did not|could not) (stay|linger) long in {town}, (for|as) the (season|year) was (turning|getting on), and (went|set off) on (the next|the following) (morning|day).',
    'I (stayed|rested) (two|three|four) (days|nights) in {town}, and (left|went on) (with|carrying) more in my pack than I (came|brought).',
    'I (left|was sorry to leave) {town} on a (grey|bright|wet) morning, but the road would not wait.',
  ],

  // ------------------------------------------------------------ the end of the road
  'homeward.last': [
    '{town} was the end of my road, and there I turned for home, by another way that does not need telling here.',
    '(At|In) {town} my (journey|road) (ended|came to its end), for my (boots|legs) (would|could) (go|carry me) no further.',
    'I sat down on the steps of the hall of {town} with my boots off and my feet in the air, and decided that I had gone far enough.',
  ],
  'homeward.think': [
    'I (had|have) (seen|walked through) {count} towns (in|on) that road, and (no two|not two) of them (were|are) alike, (though|and yet) every one of them (is|was) {land}.',
    'If I learned (anything|one thing) on the road, it (is|was) that every town (thinks|believes) itself the (centre|middle) of the world, and every one of them is (right|half right).',
    'I went out to see {land}, and came back having seen mostly its people, which I now think was the better bargain.',
  ],
  'homeward.thanks': [
    'To everyone who fed me, housed me, set me right or set me on my way, I give my thanks; they are the true authors of this book.',
  ],
  'homeward.end': [
    '(Here|So) (ends|closes) (the|my) (account|story) of (my|that) road.',
    'May the reader walk that road (one day|some day), and find it as (kind|good) as I did.',
    'My boots are worn through, and I would not have it otherwise.',
  ],
};
