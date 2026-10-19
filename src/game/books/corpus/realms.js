// (Round 126; rewritten Round 127) Realms and their wars: the history of a
// realm (its people's coming, its founding, its rulers one after another,
// what it holds dear, its faith, its towns, its wars), and accounts of the
// wars themselves (why they were fought, their battles, the peace, what
// came of it). See annals.js for how these are written.
//
// The models: the old court chroniclers for the realms (the reigns told as
// a succession, each ruler's character in a sentence and a deed in the
// next), and the soldier-historians for the wars (the ground, the weather,
// the moment the line broke, the cost counted plainly at the end).
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
    ['reign', 'epithet', 'deed'],
    ['reign', 'deed', 'epithet'],
    ['reign', 'epithet', 'war'],
    ['reign', 'war', 'deed'],
    ['reign', 'epithet'],
    ['reign', 'deed'],
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
    'Before the {people} came, {land} was a wild place, walked by hunters and the beasts they hunted, and by nobody who stayed.',
    'Who held {land} before the {people}, no one now can say, though the old stones in the high places suggest that someone did.',
    'The {people} were not the first to see {land}; but they were the first to stay, and that, in the end, is what counts.',
  ],
  'came.came': [
    'The {people} came to {land} in about the year {came}, {camehow}.',
    'It was in the year {came}, as near as the chroniclers can reckon it, that the {people} came to {land}, {camehow}.',
    'Their old songs say that the {people} came {camehow}, and their scholars, who are less fond of songs, put it at about the year {came}.',
  ],
  'came.first': [
    'They were a hardy people, as they had to be in those first winters.',
    'The first years were bitter, and a good many of the newcomers lie in the first cairns they raised.',
    'At first they kept close to the coasts and the rivers, for they did not yet know the land or what lived in it.',
  ],
  'came.settle': [
    'Little by little they spread across {land}, founding village after village, and the villages grew into towns.',
    'Their villages became towns, and the towns grew proud, and in time each of them wanted a lord of its own.',
  ],

  // ------------------------------------------------------------ a realm proclaimed
  'proclaimed.when': [
    '{realm} was proclaimed at {capital} in the year {founded}, and {firstking} was given the throne.',
    'In {founded} the heads of the great families of the {people} met at {capital} and named {firstking} the first ruler of {realm}.',
    'It was in {founded} that {realm} came into being, at {capital}, with {firstking} upon the throne.',
  ],
  'proclaimed.why': [
    'The realm was born of need more than of ambition: raiders came from every side, and no town could hold out against them alone.',
    'The towns of the {people} had feuded among themselves for a generation, and were tired of it.',
    'It is often said that realms are made by conquerors; this one was made by people who were tired of being conquered.',
  ],
  'proclaimed.first': [
    '{firstking} had been war-leader of {capital}, and is remembered still as the founder of the line.',
    'Of {firstking} a great deal is sung and very little is known, as is generally the way with founders.',
  ],
  'proclaimed.capital': [
    '{capital} has been the seat of the realm ever since, and its hall stands on the spot where {firstking} was named.',
    'The stone on which {firstking} sat to be named stands still in the great hall at {capital}, worn smooth by every ruler since.',
  ],
  'proclaimed.remark': [
    'So began {realm}, which has lasted, through everything that followed, to this day.',
  ],

  // ------------------------------------------------------------ a ruler
  'reign.epithet.builder': [
    'They were called the Builder for good reason: their roads and walls stand all over the realm, and most of them are still in use.',
    'It was in their reign that the walls of {capital} were raised in stone, and the great bridge was begun.',
  ],
  'reign.epithet.bold': [
    'They earned their name in battle, and were said to fear nothing living; the songs, at least, are agreed on that.',
    'Their courage was the stuff of songs, and some of the songs are even true.',
  ],
  'reign.epithet.wise': [
    'Their judgements are still quoted in the courts of the realm, which is the kind of fame most rulers would envy.',
    'Their council was full of learned folk, and they had the rare habit of listening to them before deciding anything.',
  ],
  'reign.epithet.pious': [
    'They raised temples to {god} in half the towns of the realm, and kept every fast and holy day to the letter.',
  ],
  'reign.epithet.young': [
    'They came to the throne a child, and a regent ruled in their name through the first years of the reign.',
  ],
  'reign.epithet.unready': [
    'They were called the Unready, and the name was earned: trouble always seemed to find them unprepared.',
    'Their counsellors quarrelled over everything, and the ruler seemed always to be looking the other way.',
  ],
  'reign.epithet.peace': [
    'They kept the peace with every neighbour of the realm, and not one army marched in all their years on the throne.',
  ],
  'reign.epithet.old': [
    'They reigned so long that, by the end, hardly anyone living could remember another ruler on the throne.',
  ],
  'reign.epithet.other': [
    'Why they were called {epithet}, the chroniclers do not say; the songs give several reasons, none of them flattering.',
    'They were called {epithet} from their youth, and the name stayed with them to the end.',
  ],
  'reign.deed': [
    'In their reign the realm prospered, and new roads were made between its towns.',
    'They married into one of the great families of {capital}, and the marriage bought peace among the families for a lifetime.',
    'A hard famine came in their reign, and they opened the royal granaries to feed the towns, which the towns did not forget.',
    'They gave the first written laws to the markets of the realm, and some of them are kept to this day.',
    'Their reign is remembered as a quiet one, which is to say a fortunate one.',
  ],
  'reign.war': [
    'Their reign is remembered above all for {war}, fought against {enemy} from {warstart} to {warend}.',
    'It was in their reign that {war} broke out against {enemy}, of which more is told below.',
  ],

  // ------------------------------------------------------------ what a realm holds dear
  'value.open': [
    'Every people holds some things dearer than the rest, and the {people} of {realm} are no different.',
    'Ask any of the {people} what they prize above all, and they will tell you: {values}.',
  ],
  'value.close': [
    'A stranger who understands this will get on well enough among the {people}.',
    'It has been so since the days of {firstking}, and seems unlikely to change.',
  ],
  'value.show.martial': [
    'The {people} are a soldierly people: every town keeps its muster, and every grown townsman and townswoman knows how to hold a spear.',
    'Their songs are mostly of battles, and their honoured dead have stones on half the squares of the realm.',
  ],
  'value.show.mercantile': [
    'Their markets are the busiest on {land}, and a guild-master of {capital} counts for more than a lord does elsewhere.',
    'Trade is the lifeblood of {realm}: its roads and caravans run to every market on {land}.',
  ],
  'value.show.pious': [
    'The {people} are a devout people, and the {clergies} of {god} sit on the council of the realm.',
    'Every town of {realm} keeps a temple to {god}, where the lamp has not once gone out.',
  ],
  'value.show.scholarly': [
    'Learning is prized in {realm}: its libraries are the finest on {land}, and its scholars are welcome in every court.',
    'Every child of the {people} is taught to read and reckon, or is supposed to be.',
  ],
  'value.show.agrarian': [
    'The {people} are farmers above all, and their harvest fairs are the greatest feasts of the year.',
    'Their fields have fed half of {land} in hungry years, and their farmers have a say in every council.',
  ],
  'value.show.seafaring': [
    'Their sailors have gone further than anyone else on {land}, and their charts are guarded like jewels.',
    'The sea is the road of {realm}, and its children learn to row before they can read.',
  ],
  'value.show.artisan': [
    'Their craftsmen are the best on {land}, and the mark of {realm} on a blade is as good as its weight in silver.',
    'The guilds keep their secrets jealously, and an apprentice serves seven years before being allowed to sell a single piece of work.',
  ],

  // ------------------------------------------------------------ a realm's faith
  'rfaith.god': [
    'The people of {realm} keep {faith}, and honour {god} above all other powers.',
    '{faith} has been the faith of {realm} since the days of {firstking}, and {god} its highest power.',
  ],
  'rfaith.feast': [
    'Its great feast is {feast}, when every town of the realm keeps the night with bonfires and singing.',
    '{holyday} is the holy day in every week, and little work is done on it in any town of the realm.',
  ],
  'rfaith.clergy': [
    'The priests of {god} are called {clergies}, and one of them sits on the council of every town.',
  ],
  'rfaith.virtue': [
    'Of all the virtues, {faith} prizes {virtue} most, and to lack it is counted a shame among the {people}.',
  ],
  'rfaith.rite': [
    'The dead are laid to rest with {rite}, as it has been done since the first days of the {people}.',
  ],

  // ------------------------------------------------------------ the towns of a realm
  'towns.open': [
    'In all, {count} towns and villages fly the banner of {realm}, from the capital to the smallest hamlet.',
    'Today {count} towns and villages keep the banner of {realm}.',
  ],
  'towns.capital': [
    'The greatest of them is {capital}, the seat of the realm, where {ruler} keeps court.',
    '{capital} has always been the first of them, and the throne stands there.',
  ],
  'towns.count': [
    'Of the rest, {towns} are the best known; but every village has its own history, and most of them deserve a book.',
  ],
  'towns.one': [
    '{one} is a {onekind} in {oneground}, by {onewater}.',
    '{one}, by {onewater}, is known for {onefamous}.',
    '{one} lies {oneway} of {capital}, in {oneground}.',
    '{one} is known across the realm for {onefamous}.',
    '{one}, a {onekind} {oneway} of {capital}, is proud above all of its {onedish}.',
    'In {one} they will tell you that their {onedish} is the best in the realm; the same is said in every other town.',
  ],

  // ------------------------------------------------------------ a realm's wars
  'rwar.open': [
    'In {warstart} {realm} went to war with {enemy}, over {why}.',
    '{war} broke out in {warstart} between {realm} and {enemy}, over {why}.',
  ],
  'rwar.course': [
    'Its battles were {battles}, and it dragged on until {warend}.',
    'The bloodiest fight came at {battle}, in {battleyear}, which {battlewinner} won.',
  ],
  'rwar.end': [
    '{endtext}.',
  ],
  'rwar.cite': [
    'The whole story is told in {otherbook}, by {otherauthor}.',
    'Readers who want the battles one by one should turn to {otherbook}, by {otherauthor}.',
  ],

  // ------------------------------------------------------------ the realm now
  'rnow.ruler': [
    'In the year {year} {ruler} reigns over {realm} from the hall at {capital}.',
    '{ruler} sits on the throne at {capital} today, the latest of a long line that goes back to {firstking}.',
  ],
  'rnow.state': [
    'The realm is at peace, or as near to peace as realms ever are.',
    'Its markets are busy, its roads are kept, and its people are about as content as people anywhere ever are.',
  ],
  'rnow.hope': [
    'May {realm} endure as long again, and its people with it.',
  ],
  'rnow.end': [
    'Here ends my history of {realm}.',
    'What comes next is for another hand to write.',
  ],
  'rnow.end@storyteller': [
    'And there, more or less, you have it: the whole of {realm}, or as much as will fit in a book.',
  ],

  // ------------------------------------------------------------ a war's causes
  'cause.open': [
    'No war begins on a single day, and {war} was no exception.',
    'To understand {war}, one must go back some years before the first blow was struck.',
    'Wars, like fires, are usually the work of a small spark and a great deal of dry timber.',
  ],
  'cause.why': [
    'The quarrel was over {why}, or so the heralds of both sides proclaimed.',
    '{aggressor} said the war was fought over {why}; {defender} said it was plain greed, and nothing more.',
  ],
  'cause.blame': [
    'Which side was in the wrong, every chronicler answers according to where they were born.',
    'I shall not say who was to blame; the reader may judge that for themselves.',
    'Both realms had grievances to spare, and neither was willing to be the first to forgive.',
  ],
  'cause.rulers': [
    '{akings} sat on the throne of {aggressor} in those years, and {bkings} on that of {defender}.',
    'It was in the reign of {akings} over {aggressor}, and of {bkings} over {defender}.',
  ],
  'cause.spark': [
    'The spark was a small thing: a quarrel in a tavern by the border, a death, and then hard words between the two courts.',
    'Envoys rode to and fro for a whole season, and each came back with angrier words than the last.',
  ],

  // ------------------------------------------------------------ the war begins
  'opening.declare': [
    'War was declared in {warstart}, at {acapital}, before the assembled court.',
    'In {warstart} {aggressor} declared war on {defender}, and riders carried the word to every town of both realms.',
  ],
  'opening.muster': [
    'Every town sent its young folk to the muster, and the forges worked day and night on spearheads and helms.',
    'The levy was called in every town, and by midsummer both armies were in the field.',
  ],
  'opening.mood': [
    'In the first weeks, people on both sides said it would be over by harvest. They were wrong.',
    'There was singing in the streets, as there always is at the start of a war, and much less of it at the end.',
  ],
  'opening.march': [
    'The host marched out toward the border behind its banners, and the people lined the road to watch it go.',
  ],

  // ------------------------------------------------------------ a battle
  'battle.when': [
    '{battle} was fought in {battleyear}.',
    'In {battleyear} the two hosts met at {battle}.',
  ],
  'battle.field': [
    'The ground was open, near {place}, in {ground}, and favoured neither side.',
    'The armies drew up in {ground} outside {place}, where the road crosses the low ground.',
    'They met in {ground} before {place}, on ground that the farmers there still will not plough.',
  ],
  'battle.fight': [
    'The fighting went on from first light until the light failed, and more than once the line seemed about to break.',
    'Arrows fell like rain on both lines, and then it was shield to shield, and then it was only noise.',
    'A charge from {winner} went through the lines of {loser}, and after that it was not a battle but a rout.',
  ],
  'battle.turn': [
    'What won the day, the soldiers said afterwards, was a single company that held when all the rest gave way.',
    'Toward evening a storm swept across the field, and the bows of {loser} were suddenly no use at all.',
  ],
  'battle.outcome': [
    'The day went to {winner}, and {loser} drew off in what order it could.',
    '{winner} carried the field, and {loser} left its dead and its banners behind.',
    'By nightfall {winner} held the ground, and {loser} was in flight.',
  ],
  'battle.cost': [
    'Some {fallen} lay dead on the field, on both sides.',
    'The victory was bought with nearly {fallen} lives, and the crows ate well for a week.',
  ],
  'battle.remember': [
    'A cairn stands on the field, and the farmers of {place} lay flowers on it at {feast}.',
    'A ballad of {battle} is still sung in the taverns of {winner}, and never in those of {loser}.',
  ],

  // ------------------------------------------------------------ a siege
  'siege.when': [
    '{battle} began in {battleyear}.',
    'In {battleyear} the army of {besieger} came before the walls of {place}, and {battle} began.',
  ],
  'siege.invest': [
    'The besiegers dug ditches around the walls, and built siege towers from timber felled in the woods nearby.',
    'For weeks no cart went in or out of {place}, while the engines beat at the walls night and day.',
  ],
  'siege.inside': [
    'Inside the walls the people ate their horses before the end, and still they would not open the gates.',
    'The defenders held the walls with whatever they had: spears and bows, roof tiles, boiling water.',
  ],
  'siege.held': [
    'In the end the siege was lifted, and {loser} marched home with nothing to show for it.',
    '{place} held, and {loser} gave up the siege before the autumn rains came.',
  ],
  'siege.fell': [
    'In the end the gates gave way, and {place} fell to {winner}.',
    'Hunger did what the engines could not, and {place} opened its gates to {winner}.',
  ],
  'siege.returned': [
    '{place} was given back at {peace}, but its people never forgot the hunger.',
  ],
  'siege.cost': [
    'Some {fallen} died before it was over, more of hunger and sickness than of wounds.',
  ],
  'siege.remember': [
    'The mended stretch of wall can still be seen at {place}, where the stone is paler than the rest.',
  ],

  // ------------------------------------------------------------ peace
  'peace.tired': [
    'By {warend} both realms were tired of war, and their treasuries were empty.',
    'Neither side could win outright, and by {warend} both of them knew it.',
  ],
  'peace.terms': [
    '{endtext}.',
  ],
  'peace.after': [
    'The treaty was sealed in wax and sworn before the {clergies} of both realms.',
    'Riders took the news home, and the bells were rung in every town on both sides of the border.',
  ],
  'peace.judge': [
    'Whether or not the peace was a fair one, the treaty held, which is more than most treaties can say.',
    'Nobody on either side was pleased with the terms, which, the wise say, is the mark of a good peace.',
  ],

  // ------------------------------------------------------------ after a war
  'aftermath.ceded': [
    '{ceded} has belonged to {victor} ever since, though its oldest folk still think of themselves as subjects of {loser}.',
  ],
  'aftermath.remember': [
    'The dead are named on stones in both realms, and every spring their names are read aloud again.',
    'Songs of {war} are still sung, though they tell it very differently on either side of the border.',
  ],
  'aftermath.judge': [
    'The war changed less than anyone had hoped, as wars generally do.',
    'Whether it was worth the dead, I will not say; those who died in it were never asked.',
  ],
  'aftermath.end': [
    'Here ends my account of {war}.',
    'That was {war}, as far as the truth of it can now be told.',
  ],
  'ongoing.now': [
    'As I write, the war goes on, and no one can say when it will end.',
    'At the time of writing, {war} is still being fought, and the news from the border comes in every week.',
  ],
  'ongoing.mood': [
    'In the towns on both sides, people pray for peace, and the young go off to the muster all the same.',
  ],
  'ongoing.end': [
    'Whatever happens next will have to be told in another book.',
  ],
};
