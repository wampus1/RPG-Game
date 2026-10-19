// (Round 126) Realms and their wars: the history of a realm (its people's
// coming, its founding, its rulers one after another, what it holds dear,
// its faith, its towns, its wars), and accounts of the wars themselves
// (why they were fought, their battles, the peace, what came of it). See
// annals.js for how these are written.
export const FLOWS = {
  // ---------------------------------------------------------- a realm
  came: [
    ['before', 'came', 'first', 'settle'],
    ['came', 'first', 'settle'],
    ['came', 'settle', 'first'],
    ['before', 'came', 'settle'],
  ],
  proclaimed: [
    ['when', 'why', 'first', 'capital'],
    ['when', 'first', 'capital'],
    ['why', 'when', 'first'],
    ['when', 'capital', 'first', 'remark'],
  ],
  reign: [
    ['reign', 'epithet', 'death'],
    ['reign', 'deed', 'death'],
    ['reign', 'epithet', 'deed', 'death'],
    ['reign', 'deed', 'epithet'],
    ['reign', 'war', 'death'],
    ['reign', 'epithet', 'war', 'death'],
  ],
  value: [
    ['open', 'show', 'show*', 'close'],
    ['open', 'show', 'close'],
    ['show', 'show*', 'close'],
  ],
  rfaith: [
    ['god', 'feast', 'clergy', 'virtue'],
    ['god', 'clergy', 'virtue', 'rite'],
    ['god', 'virtue', 'feast', 'rite'],
  ],
  towns: [
    ['open', 'capital', 'count'],
    ['open', 'count', 'capital'],
  ],
  rwar: [
    ['open', 'course', 'end'],
    ['open', 'end', 'cite'],
    ['open', 'course', 'end', 'cite'],
  ],
  rnow: [
    ['ruler', 'state', 'end'],
    ['state', 'ruler', 'hope', 'end'],
    ['ruler', 'hope', 'end'],
  ],
  // ---------------------------------------------------------- a war
  cause: [
    ['open', 'why', 'blame', 'rulers'],
    ['why', 'rulers', 'blame'],
    ['open', 'why', 'rulers', 'spark'],
    ['why', 'spark', 'blame'],
  ],
  opening: [
    ['declare', 'muster', 'mood'],
    ['declare', 'mood', 'muster'],
    ['declare', 'muster', 'march'],
  ],
  battle: [
    ['when', 'field', 'fight', 'outcome', 'cost'],
    ['when', 'fight', 'outcome', 'cost'],
    ['when', 'field', 'outcome', 'cost', 'remember'],
    ['when', 'fight', 'turn', 'outcome'],
    ['when', 'field', 'fight', 'turn', 'outcome'],
  ],
  siege: [
    ['when', 'invest', 'inside', 'outcome', 'cost'],
    ['when', 'inside', 'outcome', 'cost', 'returned'],
    ['when', 'invest', 'outcome', 'returned', 'remember'],
    ['when', 'invest', 'inside', 'outcome', 'returned'],
  ],
  peace: [
    ['tired', 'terms', 'after'],
    ['terms', 'after', 'judge'],
    ['tired', 'terms', 'judge'],
  ],
  aftermath: [
    ['remember', 'judge', 'end'],
    ['ceded', 'remember', 'end'],
    ['remember', 'end'],
  ],
  ongoing: [
    ['now', 'mood', 'end'],
    ['now', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ a people comes
  'came.before': [
    'Before the {people} came, {land} (was|had been) (a wild place|wild country), (and|where) (only|none but) (hunters|the beasts) (went|lived).',
    '(No one|Nobody) (now|living) (can say|knows) who (held|lived on) {land} before the {people}, (if anyone did|though the old stones say someone did).',
  ],
  'came.came': [
    'The {people} came to {land} in (about|around) the year {came}, {camehow}.',
    '(It was|This was) in the year {came}, (as near as|so far as) (anyone|the chroniclers) can (tell|reckon), that the {people} came to {land}, {camehow}.',
    '(The|Their) (songs|old songs) (say|tell) that the {people} came {camehow}, (and|) (the|their) (chroniclers|scholars) (put|set) it (in|at) the year {came}.',
  ],
  'came.first': [
    'They were a (hardy|stubborn) (people|folk), as they had to be in those first (years|winters).',
    'The first (years|winters) were (hard|bitter), and (many|not a few) of the (newcomers|settlers) (are|lie) buried in the first (barrows|cairns) (they raised|of that time).',
    '(At first|In the first years) they (lived|kept) (close together|to the coast and the rivers), for they did not yet know the (land|country) or (its beasts|what lived in it).',
  ],
  'came.settle': [
    '(Little by little|In a few generations), (they|the {people}) (spread|went out) (across|over) {land}, founding (village after village|town after town).',
    '(The|Their) (villages|settlements) (grew into|became) towns, and (the|their) towns (grew|became) (rich|proud), and (in time|before long) (each|the greatest of them) (wanted|had) a (lord|ruler) of its own.',
  ],

  // ------------------------------------------------------------ a realm proclaimed
  'proclaimed.when': [
    '{realm} was proclaimed at {capital} in the year {founded}, and {firstking} (took|was given) the throne.',
    'In the year {founded}, (the|) (chiefs|heads of the great families) of the {people} (met|gathered) at {capital} and (proclaimed|named) {firstking} the first ruler of {realm}.',
    '(It was|This was) in {founded} that {realm} (was|came to be) proclaimed, (at|in) {capital}, with {firstking} (on|upon) the throne.',
  ],
  'proclaimed.why': [
    '(Raiders|Enemies) (on|from) (every side|all sides) (made|had made) (it|a realm) (needful|necessary): (no|not one) town (could|was able to) (hold out|stand) (alone|by itself).',
    'The towns of the {people} (had|) (quarrelled|feuded) (among themselves|with one another) (for|through) (a generation|years), and (were|grew) (tired|weary) of it.',
    'The (realm|crown) was (born|made) (of|out of) (need|fear) (more than|rather than) (pride|ambition), (as|so) the (chroniclers|old books) (tell|have) it.',
  ],
  'proclaimed.first': [
    '{firstking} (was|had been) (a|) (chief|war-leader) of {capital} (before|until then), and is (remembered|honoured) (still|to this day) as the (founder|first) of the (realm|line).',
    'Of {firstking} (much|a great deal) is (told|sung) and (little|not much) (is|is truly) known, as is (often|always) the way with founders.',
  ],
  'proclaimed.capital': [
    '{capital} (has been|was made) the (seat|capital) of the realm (from the first|ever since), and (its|the) (hall|throne) (stands|is) on the spot where {firstking} was (named|crowned).',
    '(The|A) (stone|throne) on which {firstking} (sat|was named) (is|stands) (still|) in the (hall|great hall) at {capital}[, (worn|polished) (smooth|thin) by (the|all the) (rulers|years) since].',
  ],
  'proclaimed.remark': [
    '(So|Thus) (began|was begun) {realm}, (which|and it) (has|) (stood|lasted) (ever since|to this day).',
  ],

  // ------------------------------------------------------------ a ruler
  'reign.epithet.builder': [
    '(They were|This ruler was) called the Builder for good reason: (the|their) (walls|bridges|roads|halls) (stand|are standing) (all over|throughout) the realm (still|to this day).',
    '(It was in their reign that|In their reign) the (roads|walls) of {capital} were (laid|raised) in stone, and (a|the) (great|new) (hall|bridge) was (raised|begun).',
  ],
  'reign.epithet.bold': [
    '(They|This ruler) (earned|won) the name (in battle|by deeds), and feared (nothing|no one) living, or so the (songs|singers) (say|claim).',
  ],
  'reign.epithet.wise': [
    '(They were|This ruler was) (wise|just) (in|by) the (judgement|reckoning) of (their own|later) (day|days), (and|for) (their|the) (laws|judgements) (are|were) (still|) (quoted|cited) (in|by) the (courts|magistrates) of the realm.',
    '(Their|The) (council|court) was (full of|open to) (scholars|learned folk), and (they|this ruler) would (listen to them|hear them out) before (speaking|deciding anything).',
  ],
  'reign.epithet.pious': [
    '(They|This ruler) (built|raised) (temples|shrines) to {god} (in|across) (every|half the) (town|towns) of the realm, and (kept|would keep) (every|each) (fast|holy day) (without fail|to the letter).',
  ],
  'reign.epithet.young': [
    '(They|This ruler) came to the throne (a child|very young), and (the|a) (council|regent) (ruled|governed) (in their name|for them) (for|through) the first (years|part) of the reign.',
  ],
  'reign.epithet.unready': [
    '(Unready|Ill-counselled) (they were|this ruler was) (called|named), for trouble always (seemed to find them|found them) (unready|unprepared) when it came.',
    '(The|Their) (counsellors|council) (quarrelled|fought) (among themselves|over everything), (and|while) (the|) (ruler|throne) (looked|seemed to look) (on|the other way).',
  ],
  'reign.epithet.peace': [
    '(They|This ruler) kept the peace with every neighbour of the realm, and (no war was fought|not one army marched) in (their|that) reign.',
  ],
  'reign.epithet.old': [
    '(They|This ruler) (reigned|lived) (long|a long time), so long that (few|hardly anyone) (living|alive) (could|by the end could) remember (another|any other) (ruler|on the throne).',
  ],
  'reign.epithet.other': [
    'Why (they were|this ruler was) called {epithet}, the (chroniclers|rolls) do not (agree|say); (the|) (songs|old songs) (give|have) (three|several) (reasons|answers), (none of them|and none) (flattering|very likely).',
    'They were called {epithet} from their (youth|early years), and the name (stuck|stayed with them) (to the end|all their life).',
  ],
  'reign.deed': [
    '(In|During) (their|that) reign (the realm|the towns of the realm) (grew|prospered), and new (roads|markets) were made between its towns.',
    '(They|This ruler) married into (the|a) (great|old) (house|family) of {capital}, (and that|which) (brought|bought) peace (at home|among the great families) for (a generation|a lifetime).',
    'A (great|hard) (winter|famine) (came|fell) (in|during) (their|that) reign, and (they|the ruler) (opened|emptied) the (royal|realm\'s) (granaries|stores) to (feed|keep) the (poor|towns).',
    '(They|This ruler) (made the first written laws for|gave the first written laws to) the (markets|courts) of the realm, and (some of them|a few) are (kept|in force) (still|to this day).',
  ],
  'reign.war': [
    '(Their|That) reign (was|is) (remembered|known) (above all|most of all) for {war}, (fought|which was fought) (against|with) {enemy} (from {warstart} to {warend}|between {warstart} and {warend}).',
    '(It was|This was) (in|during) (their|that) reign that {war} (was fought|broke out) (with|against) {enemy}[, of which (more|much more) (below|is said below)].',
  ],

  // ------------------------------------------------------------ what a realm holds dear
  'value.open': [
    '(Every|Each) (people|realm) (holds|has) (something|some things) (dearer|more dear) than (the rest|others), and the {people} of {realm} are no different.',
    'Ask (anyone|any of the {people}) what (they prize|their realm prizes) (most|above all), and (they will tell you|the answer will be) {values}.',
  ],
  'value.close': [
    '(Strangers|Travellers) (who|that) (mind|remember) (this|these things) (will|) (find|get on) (well enough|well) (among|with) the {people}.',
    '(It|This) has been (so|the way of things) (since|from) the (days|time) of {firstking}, and (is not likely|seems unlikely) to change.',
  ],
  'value.show.martial': [
    'The {people} (are|have always been) a (warlike|soldierly) (people|folk): (every|each) town (keeps|has) its (watch|muster), and (every|each) (young|grown) (townsman and townswoman|one of them) (can|knows how to) (hold|use) a spear.',
    '(The|Their) (songs|stories) (are|tell) (all|mostly) of (battles|war), and (their|the) (heroes|honoured dead) (are|have) (statues|stones) (on|in) (every|half the) (square|squares) of the realm.',
  ],
  'value.show.mercantile': [
    '(The|Their) (markets|merchants) (are|have long been) the (busiest|richest) (on|in) {land}, and (a|the) (merchant|guild-master) of {capital} (is|counts for) (more|as much) (than|as) (a|any) (lord|noble) (elsewhere|in other realms).',
    '(Coin|Trade) (is|has been) the (life|blood) of {realm}: (its|the) (roads|caravans) (run|go) (to|toward) (every|each) (market|town) on {land}.',
  ],
  'value.show.pious': [
    'The {people} (are|have always been) (a pious|a devout) (people|folk), and the {clergies} of {god} (sit|have a seat) (in|on) the council of the realm.',
    '(Every|Each) town of {realm} (has|keeps) its temple (to|of) {god}, where (the|a) (lamp|fire) has (never|not once) gone out.',
  ],
  'value.show.scholarly': [
    '(Learning|Scholarship) (is|has always been) (prized|honoured) in {realm}: (its|the) (schools|libraries) are the (best|finest) on {land}, and (its|the) (scholars|masters) are (welcome|sought after) (everywhere|in every court).',
    '(Every|Each) (child|town child) of the {people} (is|was) (taught|made) to (read|read and reckon), (or|and) (is|was) (meant|supposed) to be.',
  ],
  'value.show.agrarian': [
    'The {people} (are|have always been) (farmers|a people of the plough) (first|above all), and their harvest fairs are the (greatest|chief) feasts of the year.',
    '(The|Its) (fields|farms) (feed|have fed) (half|much) of {land} (in|through) (lean|hungry) years, and its farmers have a (voice|say) in every council.',
  ],
  'value.show.seafaring': [
    '(The|Its) (ships|sailors) (go|have gone) (further|farther) than (anyone|any other people) (on|of) {land}, and (their|the) (charts|logs) (are|have been) (kept|guarded) (like|as) (treasure|jewels).',
    '(The|A) (sea|harbour) (is|has been) (the|) (life|road) of {realm}, and (its|the) (children|young) (learn|are taught) to (row|swim) before they (can|) (read|walk).',
  ],
  'value.show.artisan': [
    '(The|Its) (craftsmen|smiths and joiners) are the (best|finest) on {land}, and (a|the) (mark|stamp) of {realm} (on|upon) (a|any) (blade|piece of work) (is|was) (worth|) (more than|as good as) (gold|its weight in silver).',
    '(The|Its) (guilds|crafts) (keep|guard) (their|the) (secrets|methods) (closely|jealously), and an apprentice serves (seven|nine) years before (they are|being) allowed to sell their own (work|wares).',
  ],

  // ------------------------------------------------------------ a realm's faith
  'rfaith.god': [
    'The (people|towns) of {realm} keep {faith}, and honour {god} above (all|every) other (gods|power).',
    '{faith} has been the faith of {realm} (since its founding|from the days of {firstking}), and {god} (its|the) (first|highest) (god|power).',
  ],
  'rfaith.feast': [
    '(The|Its) (great|greatest) (feast|holy day) is {feast}, (and|when) (every|each) town of the realm (keeps|keep) it (in|with) (its own way|their own way), (but|and) (all|every one) (with|of them with) (bonfires|feasting).',
    '{holyday} is the holy day (of the week|in every week), and (no|little) work is (done|to be done) (on it|then) in (any town|all the towns) of the realm.',
  ],
  'rfaith.clergy': [
    'The (clergy|priests) of {god} are called {clergies}, and (one|a {clergy}) (serves|sits) (in|on) the council of (every|each) town.',
  ],
  'rfaith.virtue': [
    '(Of|Among) all the virtues, {faith} (prizes|honours) {virtue} (most|above all), (and|so that) (a|the) (lack|want) of it (is|counts as) (shameful|a shame) (among|to) the {people}.',
  ],
  'rfaith.rite': [
    '(The|Their) dead are (seen off|laid to rest) with {rite}, as it has (always|) been done (since|from) the first days of the {people}.',
  ],

  // ------------------------------------------------------------ the towns of a realm
  'towns.open': [
    'In all, {count} (towns|towns and villages) (keep|fly) the (banner|standard) of {realm}, (great and small|from the capital to the smallest village).',
    '(Today|Now) {count} (towns|towns and villages) (fly|keep) the (banner|standard) of {realm}.',
  ],
  'towns.capital': [
    'The (greatest|first) of them is {capital}, (the|its) (capital|seat), where {ruler} (sits|keeps court).',
    '{capital} (is|has always been) the (greatest|chief) of them, and the (hall|throne) (is|stands) there.',
  ],
  'towns.one': [
    '{one} is a {onekind} (in|among) {oneground}[, (by|on) {onewater}].',
    '{one}, (by|on) {onewater}, is (known|famous) for {onefamous}.',
    '{one} (lies|stands) {oneway} of {capital}, (in|among) {oneground}.',
    '{one} is (known|famous) (all over|across) the realm for {onefamous}.',
    '{one}, a {onekind} {oneway} of {capital}, (is|has always been) (proud|vain) of its {onedish}.',
    'In {one} (they|the folk) (say|swear) (their|the) {onedish} is the best in the realm, (and|but) (so|the same) (do|is said in) (the other towns|every other town).',
  ],
  'towns.count': [
    '(Of|Among) the (rest|others), {towns} (are|count among) (the best known|the greatest), (but|and) (every|each) (village|one) (has|keeps) (its own|a) (story|history) (worth|for) (telling|another book).',
  ],

  // ------------------------------------------------------------ a realm's wars
  'rwar.open': [
    'In {warstart}, {realm} (went to|was at) war with {enemy}, over {why}.',
    '{war} (began|broke out) in {warstart} between {realm} and {enemy}, (over|for the sake of) {why}.',
  ],
  'rwar.course': [
    'Its battles were {battles}, and (it|the fighting) (lasted|went on) (until|till) {warend}.',
    '(Its|The) (greatest|bloodiest) (battle|fight) (was|came at) {battle}, in {battleyear}, (which|and) {battlewinner} (won|carried).',
  ],
  'rwar.end': [
    '{endtext}.',
  ],
  'rwar.cite': [
    '(The|Its) (whole|full) (story|account) (is|is told) in {otherbook}, by {otherauthor}.',
    '(Those|Readers) who want (more|the battles one by one) (should|may) (read|turn to) {otherbook}, by {otherauthor}.',
  ],

  // ------------------------------------------------------------ the realm now
  'rnow.ruler': [
    '(Today|In the year {year}) {ruler} (rules|reigns) (over|in) {realm}, from (the hall|the throne) at {capital}.',
    '{ruler} (sits|is on) the throne (at|of) {capital} (now|today), (the|) (last|latest) of (a|the) (long|) (line|line of rulers) (going back|that goes back) to {firstking}.',
  ],
  'rnow.state': [
    '(The realm is|Its towns are) (strong|at peace) (now|today), or (strong|peaceful) enough as realms go, (though|and yet) no realm (is|stays) at peace (for ever|forever).',
    '(Its|The) (markets|fields) are (full|busy), (its|the) (roads|walls) (are|) (kept|in good repair), and (the|its) (people|{people}) (are|seem) (as content|content enough) as (any|people anywhere) (are|ever are).',
  ],
  'rnow.hope': [
    'May {realm} (stand|endure) (as long again|another thousand years), and (its people|the {people}) (prosper|with it).',
  ],
  'rnow.end': [
    '(Here|So) (ends|closes) (this|my) (history|account) of {realm}.',
    '(The rest|What comes next) is for (another|some other) (hand|writer) to (set down|write).',
  ],

  // ------------------------------------------------------------ a war's causes
  'cause.open': [
    '(No|Not one) war (begins|is begun) (in|on) a (day|single day), and {war} (was|is) no (different|exception).',
    '(To|If we are to) (understand|make sense of) {war}, (one|we) must (go back|look back) (some years|a long way) before the first (blow|battle) was struck.',
  ],
  'cause.why': [
    '(The|Its) (quarrel|cause) was {why}[, (or|at least) (so|that is what) (the|) (heralds|proclamations) (said|claimed)].',
    '{aggressor} (said|claimed) (it|the war) was (fought|made) (over|for) {why}; {defender} (said|answered) that it was (greed|plain greed), and nothing more.',
  ],
  'cause.blame': [
    'Which side was in the (right|wrong), (every|each) (chronicler|writer) (answers|will answer) (differently|according to where they were born).',
    '(I|This writer) (will|shall) not (say|judge) (who|which side) was (to blame|in the wrong); (the|) (reader|readers) (may|can) (judge|do that) for themselves.',
    '(Both|Each of the) (sides|realms) had (wrongs|grievances) (enough|to spare), (and|but) (neither|not one of them) (would|was willing to) (be|) (the first to|) (give way|forgive).',
  ],
  'cause.rulers': [
    '{akings} (sat|was on) the throne of {aggressor} (then|in those years), and {bkings} (that|the throne) of {defender}.',
    '(It was|This was) (in|during) the reign of {akings} (in|over) {aggressor}, and of {bkings} (in|over) {defender}.',
  ],
  'cause.spark': [
    'The spark (was|came from) a small thing: a (quarrel|brawl) (at|in) a (market|tavern) (on|by) the border, a death, and then (hard words|insults) between the two (courts|thrones).',
    '(Messengers|Envoys) (went|rode) (back and forth|to and fro) (for|through) a (year|whole season), (and|but) (each|every one) (came|went) back (with|bearing) (harder|angrier) words than (the last|before).',
  ],

  // ------------------------------------------------------------ the war begins
  'opening.declare': [
    '(War|The war) was declared in {warstart}, (at|in) {acapital}, (before|in front of) the (whole|assembled) court.',
    'In {warstart} {aggressor} (declared|made) war (on|against) {defender}, and (heralds|riders) (carried|took) the word to (every|each) town of both realms.',
  ],
  'opening.muster': [
    '(Every|Each) town (sent|gave) its (watch|young folk) to the muster, (and|) (smiths|the forges) (worked|were at work) day and night (on|making) (spears|blades) and (helms|mail).',
    'The (muster|levy) (was|went) (called|out) in (every|each) town, and (by|before) (summer|midsummer) (two|both) (armies|hosts) were (in|on) the field.',
  ],
  'opening.mood': [
    '(At first|In the first weeks) the (folk|people) on both sides (thought|said) (it|the war) (would|should) (be over|be done) (by|before) (harvest|the winter); (it was not|they were wrong).',
    'There was (singing|music) in the (roads|streets), as there always is at the start of a war, and (less|much less) of it at the end.',
  ],
  'opening.march': [
    '(The|Their) (host|army) (marched|went) (out|) (toward|on) the border (with|behind) (banners|drums), (and|while) (the|) (towns|people) (watched|lined the road) (them go|to see them go).',
  ],

  // ------------------------------------------------------------ a battle
  'battle.when': [
    '{battle} was fought in {battleyear}.',
    'In {battleyear} the (two|) (hosts|armies) (met|came together) at {battle}.',
    '(Then|Next) came {battle}, in {battleyear}.',
  ],
  'battle.field': [
    '(The|Its) (ground|field) (was|lay) (near|before|outside) {place}, (on|in) {ground}, and (it|the ground) (favoured|helped) (neither|no) (side|one) (much|greatly).',
    '(They|The armies) (met|drew up) (on|in) {ground} (near|outside|before) {place}, where the (road|ford) (crosses|crossed) the (low|open) ground.',
  ],
  'battle.fight': [
    'The (fighting|battle) (lasted|went on) from (dawn|first light) (until|till) (dusk|the light failed), and (more than once|again and again) the line (seemed|looked) (lost|about to break).',
    '(Arrows|Spears) (fell|came) (thick|like rain) (on|upon) both (lines|sides), and (then|after that) it was (shield to shield|hand to hand).',
    '(The|A) (charge|rush) (of|from) {winner} (broke|went through) the (line|lines) of {loser}, and (the rest was|after that it was) (slaughter|a rout).',
  ],
  'battle.turn': [
    'What (turned|won) the day, the soldiers said afterwards, was a (flank|line) that (held|did not break) when all the rest (gave way|broke).',
    '(Late in the day|Toward evening), a (storm|rain) (came|swept) (in|across the field), (and|so that) the bows were (useless|no use) (to|for) {loser}.',
  ],
  'battle.outcome': [
    'The day (went|belonged) to {winner}, (and|while) {loser} (fell back|drew off) (in good order|in disorder).',
    '{winner} (won|carried) the (field|day), and {loser} left (its|their) (dead|banners) (behind|on the field).',
    '(When|By the time) the (dark|night) (came|fell), {winner} (held|had) the (field|ground), and {loser} (was in flight|was gone|had fled).',
  ],
  'battle.cost': [
    '(Some|About) {fallen} (were|lay) dead (on|upon) the field, (on both sides|on either side).',
    '(It|The victory) (cost|was bought with) (some|nearly) {fallen} (lives|dead), and the (crows|ravens) (ate|fed) (well|for a week).',
  ],
  'battle.remember': [
    '(A|The) (cairn|stone) (stands|was raised) on the field, (and|where) the (folk|farmers) (of|near) {place} (lay|leave) (flowers|wreaths) (on|at) {feast}.',
    '(The|A) (song|ballad) of {battle} (is|was) (sung|still sung) in the (taverns|halls) of {winner} (to this day|still), (and|but) (never|not) (in|among) {loser}.',
  ],

  // ------------------------------------------------------------ a siege
  'siege.when': [
    '{battle} (began|was laid) in {battleyear}.',
    'In {battleyear} the (army|host) of {besieger} (came|marched) (before|to) the walls of {place}, and {battle} began.',
  ],
  'siege.invest': [
    '(They|The besiegers) (dug|threw up) (earthworks|ditches) (round|about) the (city|walls), and (built|raised) (engines|siege towers) from timber felled (nearby|round about).',
    '(No|Not one) (cart|boat) (went|came) (in|into) {place} or (out|out of it) (for|through) (weeks|months), (and|while) the (engines|stones) (beat|struck) (at|on) the walls (day and night|night and day).',
  ],
  'siege.inside': [
    '(Inside|Within) the walls (the|) (folk|people) (ate|were eating) (their horses|rats) (before|by) the end, (but|and) (still|yet) (they did not|would not) (open|give up) the (gates|city).',
    '(The|Its) (watch|defenders) (held|kept) the walls (with|by) (whatever|what) they had: (spears|bows), (stones|roof tiles), (boiling|hot) (water|pitch).',
  ],
  'siege.held': [
    '(In the end|At last) the siege was (broken|lifted), and {loser} (went|marched) (home|away) (with nothing|empty-handed).',
    '{place} (held|held out), and {loser} (gave up|abandoned) the siege (before|when) the (winter|autumn rains) came.',
    '(When|After) (it was|the siege was) (over|done), {winner} (still|) held {place}, and the walls (stood|were still standing).',
  ],
  'siege.fell': [
    '(In the end|At last) the gates (were opened|gave way), and {place} (fell|was taken) to {winner}.',
    '(Hunger|Sickness) (did|finished) what the engines could not, and {place} (opened its gates|was given up) to {winner}.',
  ],
  'siege.returned': [
    '{place} was given back (at|in) {peace}[, but (its|the) (people|folk) never (forgot|forgave) the (siege|hunger)].',
  ],
  'siege.cost': [
    '(Some|About) {fallen} (died|were lost) (before|in) (it was over|the siege), (more|many) of (hunger|sickness) than of (wounds|steel).',
  ],
  'siege.remember': [
    'The (breach|mended stretch of wall) (can|may) (still|) be (seen|made out) (on|in) the walls of {place}, where the stone is (newer|paler) than the rest.',
  ],

  // ------------------------------------------------------------ peace
  'peace.tired': [
    '(By|In) {warend} (both|the two) (realms|sides) were (tired|weary) of (it|war), and (their|the) (treasuries|coffers) (empty|bare).',
    '(Neither|Not one) (side|realm) could (win|finish it) (outright|by force), and (both|the two) (knew|came to know) it.',
  ],
  'peace.terms': [
    '{endtext}.',
  ],
  'peace.after': [
    'The (treaty|peace) was (signed|sealed) (in wax and ink|with seals), and sworn before the {clergies} of both realms.',
    '(Heralds|Riders) (carried|took) the (news|word) (home|to every town), (and|) (the|) (bells|temple bells) (rang|were rung) (from|in) (every|each) town (on|of) (both|either) (sides|side).',
  ],
  'peace.judge': [
    'Whether (it|the peace) was (just|a fair one) or not, the treaty held, and that is more than (most|many) (peaces|treaties) can say.',
    '(Few|Not many) on either side were (happy|pleased) with the terms, and that, (some|the wise) (say|would say), is the mark of a (fair|good) peace.',
  ],

  // ------------------------------------------------------------ after a war
  'aftermath.ceded': [
    '{ceded} (has been|is) (a town|part) of {victor} ever since, (and|though) (its|the) (old folk|oldest folk) (still|) (call|remember) themselves (people|subjects) of {loser}.',
  ],
  'aftermath.remember': [
    'The (dead|fallen) are (remembered|named) on (stones|plaques) in both realms, and (each|every) (year|spring) their names are read aloud again.',
    '(Songs|Ballads) of {war} are (still|) sung, (and|though) the songs (tell|sing) it (very|quite) differently on (either|each) side of the border.',
  ],
  'aftermath.judge': [
    '(It|The war) (changed|settled) (less|little) than (anyone|those who fought it) (hoped|had hoped), (as|which is the way of) (wars|most wars) (do|go).',
    'Whether it was worth (it|the dead), (I|this writer) will not say; (those|the ones) (who|that) (fought|fell) in it (were|) (not|never) asked.',
  ],
  'aftermath.end': [
    '(Here|So) (ends|closes) (this|my) (account|history) of {war}.',
    '(This|That) (is|was) {war}, (as|so far as) (it|the truth of it) (can|may) (now|still) be (told|known).',
  ],
  'ongoing.now': [
    '(As|Even as) (I|this) (write|is written), the war (goes on|is not over), and (no one|nobody) (can|could) say (how|when) it will end.',
    '(At|In) the (time|year) of (writing|this writing), {war} (goes on|is still being fought), (and|) (the|) (news|word) (from|of) the (border|front) (comes|arrives) (every|each) week.',
  ],
  'ongoing.mood': [
    '(In|On) (the|both) (towns|sides) (folk|people) (pray|hope) for (peace|an end to it), (and|while) the (young|soldiers) (march|go) (off|out) (to the muster|again).',
  ],
  'ongoing.end': [
    '(Whatever|What) (comes|happens) next (must|will have to) be (written|told) (by|in) (another|some other) (hand|book).',
  ],
};
