// (Round 126; rewritten Round 127) A town's annals: how a chronicler writes
// of a town, from the empty land before it to its own day. In the phrase
// grammar of talk/grammar.js: "(a|b)" says one of them, "[a]" says it or
// not; "{town}" and the like are filled in from the town (see books.js).
//
// FLOWS: the ways a paragraph of each kind has been written, as runs of
// moves (see write.js: a chain learns what follows what). POOLS: what's
// said for each move, `${kind}.${move}`; and a writer's own, in their
// voice, `${kind}.${move}@${voice}` (see voice.js).
//
// The models for these are the old county histories and parish annals:
// unhurried, specific, fond of the particular (the baker's yard where the
// fire began, the line on the temple wall that shows how high the water
// came), sparing with adjectives, and given to a dry remark at the end.
export const FLOWS = {
  preface: [
    ['purpose', 'sources', 'humble'],
    ['purpose', 'debt', 'sources'],
    ['sources', 'purpose', 'dedicate'],
    ['purpose', 'sources', 'debt', 'humble'],
    ['purpose', 'humble', 'dedicate'],
    ['purpose', 'sources', 'pious', 'humble'],
    ['pious', 'purpose', 'sources'],
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
    ['now', 'realm', 'hope', 'end'],
    ['realm', 'people', 'now', 'end'],
    ['people', 'realm', 'now', 'hope', 'end'],
  ],
};

export const POOLS = {
  // ------------------------------------------------------------ preface
  'preface.purpose': [
    'I have tried in these pages to set down the history of {histtown} from its founding to the year {year}, and to set it down truly.',
    'This is the story of {histtown}: how it began, what it has suffered, and what it has made of itself.',
    'No one had written the whole history of {histtown} in one book before, and the old folk who remembered it were growing fewer every winter; so I began.',
    'A town keeps its history in odd places: in the temple rolls, in the names on the gravestones, in the stories old people tell when the fire is low. I have tried to gather it into one place.',
    'I was born in {histtown}, and this book is, in its way, my thanks to it.',
    'What follows is an account of {subject}, as complete as I have been able to make it.',
    'I have set down what is known of {subject}, and marked plainly where what is known gives out and what is only told begins.',
    'This book was many years in the writing, and longer in the gathering; I hope the reader will think it worth both.',
  ],
  'preface.purpose@storyteller': [
    'I have been collecting the stories of {histtown} since I was old enough to sit at my grandmother\'s feet, and somebody had to write them down before I forgot them.',
    'Ask anyone in {histtown} about the old days and you will get a story; ask three people and you will get three. This book is my attempt to make them agree.',
  ],
  'preface.purpose@scholar': [
    'The purpose of this work is to establish, as far as the surviving records permit, the history of {subject}.',
    'Previous accounts of {subject} have been fragmentary; this one attempts to be complete, and to distinguish what is recorded from what is merely repeated.',
  ],
  'preface.purpose@pious': [
    'I began this book in the hope that {god} would look kindly on the labour, and on the people whose story it tells.',
  ],
  'preface.purpose@plain': [
    'This is a history of {subject}. I have kept it short.',
    'I wrote this book because nobody else had.',
  ],
  'preface.purpose@lyrical': [
    'Every town is a kind of song, sung over and over by everyone who has ever lived in it; this book is my attempt to write down the tune.',
    'Stand on the bridge at {histtown} at evening, when the smoke goes up from every chimney, and you will understand why I wanted to write this book.',
  ],
  'preface.sources': [
    'My chief sources have been the rolls of the temple, kept by the {clergies} of {god} in an unbroken hand for longer than anyone can remember.',
    'Where the rolls are silent I have listened instead to the oldest people I could find, and I have said so wherever I have done it.',
    'The records of the council were of some use, though they are more concerned with the price of grain than with anything a reader would care to know.',
    'I have read every book and roll on {subject} that I could lay my hands on, and asked a great many questions of a great many patient people.',
    'Where the old books disagree, I have given the account that seemed likeliest to me, and noted where others differ.',
    'More than one winter evening was spent at the fireside of some old soul who remembered what the rolls forgot, and I owe those evenings more than I can say.',
  ],
  'preface.sources@scholar': [
    'The principal sources are the temple rolls, the council minutes and the testimony of the oldest residents; where these conflict, I have preferred the written record.',
    'I have checked every date against at least two sources where two could be found, and noted every place where only one could.',
  ],
  'preface.sources@storyteller': [
    'Most of what is in here I had from old people over a mug of something warm, and I have done my best to keep their words as they said them.',
  ],
  'preface.debt': [
    '{otherauthor} covered some of the same ground in {otherbook}, and I have leaned on that book more than once.',
    'The reader who wants to know more of {othertopic} should turn to {otherbook}, by {otherauthor}, which I have used freely.',
    'Where this book and {otherbook} tell it differently, I have said so, without pretending to be the more right.',
    'I owe a particular debt to {otherauthor}, whose {otherbook} I first read as a child and have never quite stopped reading.',
  ],
  'preface.humble': [
    'Any errors are my own, and I ask the reader\'s patience with them.',
    'I do not claim that this book is complete: there will always be more stories than any one writer can gather.',
    'If I have left out anything that matters, the fault is mine, and I would be glad to be told of it.',
    'I am no great writer, and this is a plain book; but everything in it is as true as I could make it.',
  ],
  'preface.humble@plain': [
    'If anything in it is wrong, tell me and I will put it right.',
  ],
  'preface.humble@lyrical': [
    'Whatever is missing from these pages is still out there, in the fields and the old walls, waiting for a better writer than I am.',
  ],
  'preface.pious': [
    'I began this book with a prayer to {god}, and I end it the same way.',
    '{god} gave me the years and the patience to finish it, and I am thankful for both.',
    'Much of it was written by the lamp of the temple of {god}, between the evening rites and the morning ones.',
  ],
  'preface.dedicate': [
    'I give this book to the people of {histtown}, who made its history and rarely had time to write it down.',
    'This book is for the children of {histtown}, so that they may know whose town it is, and what it cost.',
    'To the memory of the dead of {histtown}, who are most of its people, and all of its past.',
  ],

  // ------------------------------------------------------------ the land
  'land.lie': [
    '{town} stands beside {water}, in a country of {ground}, on {land}.',
    'The land about {town} is {ground}, with {water} winding past its lower streets.',
    'Seen from a distance, {town} is a huddle of roofs and smoke among {ground}, with {water} glinting below it.',
    'Those who come to {town} come through {ground}, and see the smoke of it long before they see the roofs.',
    '{town} lies in {ground}, toward the heart of {land}, where the roads from the neighbouring towns meet.',
    'The traveller who comes to {town} for the first time is struck less by the town itself than by the country around it: {ground}, mile upon mile of it.',
  ],
  'land.lie@lyrical': [
    'In the early morning, when the mist lies on {water}, {town} seems to float above it, roof by roof, like something half remembered.',
    'There is a moment on the road into {town}, at the top of the last rise, when the whole of it comes into view at once: the roofs, the smoke, {water}, and all the {ground} beyond.',
  ],
  'land.before': [
    'Before there was a town here, there was only {ground}, crossed now and then by hunters and herds, and settled by no one.',
    'Nobody knows who, if anyone, lived on the spot before the founding; but the ploughs still turn up worked flints and broken pots in the fields, so somebody did.',
    'The old folk say that before the first house was built, the place belonged to the wolves, and the wolves did not give it up gladly.',
    'Whatever stood here before {town} is forgotten now, though every spring the ploughmen bring up some new piece of it: a bead, a blade, a bone.',
  ],
  'land.why': [
    'Good water, good earth and timber near at hand were reason enough to stay; most towns have begun with less.',
    '{water} gave fish, water and a road downstream, which was more than most places could offer.',
    'It was never the easiest place to make a living, but it was a good place to be left alone, and in those days that counted for a great deal.',
    'Whoever chose the spot chose well: there is sweet water in every season, and the hill behind it keeps off the worst of the wind.',
  ],

  // ------------------------------------------------------------ the founding
  'founding.first': [
    'The first houses were raised of rough timber close by the water, and the ground around them was cleared by hand, with axe and fire.',
    'They built the hall first, before anything else, and lived in it together through that first year while the houses went up around it.',
    'Within a generation the settlement had a well, a mill and a shrine to {god}, and the beginnings of a market.',
    'The oldest house in {town} still stands near the well, though it has been patched and rebuilt so often that very little of the first one can be left.',
    'They cut the first fields out of {ground} that spring, sowed them with seed they had carried with them, and waited.',
  ],
  'founding.hardship': [
    'The first winter was hard, and not all of the settlers lived to see the spring; their graves are the oldest in the town.',
    'Those first years were lean ones, and the settlers lived on what they could hunt and gather until the first harvest came in.',
    'Fever took some of the first families before the year was out, and they are remembered still by a stone near the old well.',
    'Many of them must have thought of going back the way they had come. None of them did.',
  ],
  'founding.grow': [
    'Others followed, having heard of the good earth, and within forty years the settlement was a village of a hundred hearths.',
    'The village grew slowly, a house and a family at a time, until it was large enough to need a market and a council of its own.',
    'By the time the founder died, there were children in {town} who had never seen anywhere else.',
  ],
  'founding.name': [
    '{founder} is remembered in {town} to this day; children learn the name before they can read it.',
    'The town keeps a feast in honour of {founder}, although nobody now can say for certain where the founder lies buried.',
    'Every child in {town} can tell you how {founder} came, and every one of them tells it a little differently.',
  ],

  // ------------------------------------------------------------ an event
  'event.detail.lore': [
    'The rolls say little about it, but the old folk said a great deal, and never quite the same thing twice.',
    'Those who saw it talked of it for the rest of their lives, and their grandchildren tell it still.',
    'For a season, the whole of {town} talked of nothing else.',
    'It is written into the rolls in a careful hand, with no word of what the writer thought of it; perhaps the writer did not trust themselves to say.',
  ],
  'event.after.lore': [
    'Life in {town} went on, as it must; but the thing was not forgotten.',
    'It is still remembered every year, on the day itself, by those who keep such things.',
  ],
  'event.detail.good': [
    'There was money in every purse that year, and new roofs went up along the high street one after another.',
    'Word of it spread across {land}, and people came from the other towns to see it for themselves.',
    'The {clergies} of {god} gave thanks in the temple, and for once the whole town came to hear them.',
    'The old folk still speak of it as the best year {town} ever had, with the particular fondness people keep for good times that did not last.',
  ],
  'event.after.good': [
    'The good fortune did not last for ever, as such things never do; but a great deal of what is finest in {town} was paid for out of it.',
    'Since then {town} has thought of itself as a lucky place, which is perhaps the most valuable thing a town can think.',
    'Much of what stands on the square today was built in those years.',
  ],
  'event.detail.bad': [
    'Families went hungry that winter, and more than one of them gave up and left {town} for good.',
    'The worst of it fell, as the worst always does, on the poor; the {clergies} of {god} fed whom they could, and buried the rest.',
    'It is remembered still as the black year, and the old folk lower their voices when they speak of it.',
    'Nobody living could remember a harder time, though the oldest of them insisted, with the satisfaction of the old, that worse was coming.',
  ],
  'event.after.bad': [
    'It took {town} a generation to recover, but recover it did.',
    'Afterwards the council made new rules, so that the like should not happen again; whether the rules were kept is another matter.',
    'Those who lived through it were harder for it, or so they said, and they seldom spoke of it willingly.',
  ],
  'event.detail.oath': [
    'It was not done lightly: the elders argued through a whole winter before they agreed.',
    'Some in {town} wanted no lord but their own council, and said so loudly; but they were outvoted.',
    'The oath was sworn in the square, before the whole town, with the banner of {realm} hung over the door of the hall.',
  ],
  'event.after.oath': [
    'From that day {town} sent its taxes to {capital}, and its young folk marched under the banner of {realm} whenever they were called.',
    'Whether it was wise is still argued in the taverns, usually late, and never to anyone\'s satisfaction.',
  ],
  'event.detail.war': [
    'The young folk of {town} marched out behind the banner of {realm} with drums and singing, and fewer of them came home.',
    'There was hardly a family in {town} that did not lose someone that year, or know someone who had.',
  ],
  'event.after.war': [
    'Their names are cut on a stone on the square, and every year at {feast} somebody lays flowers at its foot.',
  ],
  'event.detail.battle': [
    'The fighting came right up to the fields of {town}, and the townsfolk watched it from the walls in silence.',
    'The wounded were carried into {town} by the wagonload, and for a week every hall in the town was a sickroom.',
    'The ploughs still turn up arrowheads from that day in the fields outside {town}, and the children sell them to travellers.',
  ],
  'event.after.battle': [
    'The dead of both sides were buried together in one long grave beside the road, and a cairn stands over them still.',
    'For a generation afterwards, nobody in {town} would walk that road after dark.',
  ],
  'event.detail.ceded': [
    'Nobody in {town} was asked, and the banner of {victor} went up over the gate before the season was out.',
    'Some families left for {loser2} rather than swear a new oath; most stayed, as most people always do.',
  ],
  'event.after.ceded': [
    'The oldest folk still speak of that year with a shrug, and their grandchildren have known no other crown.',
  ],
  'event.detail.proclaimed': [
    'The heads of the great families rode in from every corner of {land} to swear to the new ruler, and {town} feasted for a fortnight.',
    'From that day {town} was the seat of the crown, and its hall was rebuilt in stone to match.',
  ],
  'event.detail.dungeon': [
    'Grandmothers in {town} still hush their children with it, though none of them has ever been near the place.',
    'Hunters who pass near it say they have heard voices under the ground after dark, and nobody laughs at them for saying so.',
    'Its story is told to every child in {town}, partly as a story and partly as a warning.',
  ],
  'event.after.dungeon': [
    'No one has gone down since, or no one who came back to say so.',
    'The way in is marked on no map made in {town}; every child knows it anyway.',
  ],
  'event.remark': [
    'These are the trials by which a town finds out what it is made of.',
    'I set it down as the rolls give it, without adding anything of my own.',
    'It is worth remembering that the people of {town} did not give up, whatever came.',
    'Every town has years like these in its past, and {town} has rather more than its share.',
  ],
  'event.remark@storyteller': [
    'Now, I have heard that story told a dozen ways, and this is the only one I believe.',
    'My grandmother used to tell this one with her eyes closed, which I always took to mean it was true.',
  ],
  'event.remark@scholar': [
    'The sources agree on the year; they agree on very little else.',
    'Here, for once, the rolls and the old folk tell the same story, which is reason enough to trust it.',
  ],
  'event.remark@pious': [
    'May {god} keep the souls of those who did not live to see the end of it.',
    'It was a hard lesson, and the faithful of {town} took it to heart.',
  ],
  'event.remark@plain': [
    'That was that.',
    'Nobody forgot it.',
  ],
  'event.remark@lyrical': [
    'Some years leave no mark on a town; others it wears for ever, like a scar it has learned to be proud of.',
    'The grass has long since grown back, but the old folk still walk a little more slowly past the place.',
  ],
  'event.source': [
    'So say the temple rolls, which are careful in matters of this kind.',
    'My account follows the rolls kept by the {clergies}, which give the year plainly.',
    'I had the story from the oldest soul in {town}, whose grandmother saw it with her own eyes.',
  ],
  'event.link': [
    '{when}, {other}.',
    '{when}, {other}; the rolls of {town} make no mention of it.',
    'It is worth noting that, {whenlow}, {other}.',
  ],
  // (Each kind of thing that befalls a town.)
  'event.detail.fire': [
    'The fire began, it is said, in a baker\'s yard near the square, and the wind carried it from roof to roof faster than anyone could run.',
    'Thatch and timber burned like kindling, and by morning whole streets were nothing but black posts standing in the ash.',
    'The townsfolk formed lines with buckets from the well to the burning streets, and passed water hand to hand all night; it was not nearly enough.',
    'No one could say afterwards how many were lost that night, because the rolls burned with everything else.',
  ],
  'event.after.fire': [
    '{town} was rebuilt in stone, street by street, and was the finer town for it.',
    'A law was made that no house inside the walls should ever be roofed with thatch again, and for once a law was kept.',
    'The black marks of it can still be seen on the oldest stones by the well, if you know where to look.',
  ],
  'event.detail.flood': [
    'The water rose in the night, and by morning the lower streets stood in it up to the sills.',
    'It had rained for eleven days without a break, and the banks could not hold it any longer.',
    'Folk carried what they could to the upper floors and the roofs, and watched the rest float away below them.',
  ],
  'event.after.flood': [
    'The mill was rebuilt further from the water, and a line was cut in the temple wall to show how high the flood had come; it is above a tall man\'s head.',
    'When the water went down it left a foot of silt over the fields, and the next harvest was the richest anyone could remember.',
  ],
  'event.detail.plague': [
    'The sickness came in with the traders and went from house to house faster than the {clergies} could pray.',
    'Whole households died within a week of each other, and the temple bell tolled every day for a month.',
    'The {clergies} of {god} nursed the sick until many of them sickened too, and were nursed in their turn by whoever was left.',
  ],
  'event.after.plague': [
    'The burial ground had to be made larger, and a plain stone at its gate remembers the dead of that year.',
    'For a generation afterwards, no stranger was let into {town} without a letter from someone the council trusted.',
  ],
  'event.detail.siege': [
    'The besiegers sat down before the walls for a whole season, and tried the gates night after night.',
    'Inside the walls the people ate their horses and then the rats, and still would not open the gates.',
    'The watch held the walls with whatever came to hand: spears and bows, roof tiles, boiling water from the kitchens.',
  ],
  'event.after.siege': [
    'A plaque over the gate names those who held it, and those who died doing so.',
    'The siege is remembered every year with a night of bonfires on the walls, and the children are allowed to stay up for it.',
  ],
  'event.detail.famine': [
    'The harvest failed, and before the new year the granaries were bare.',
    'By the end, folk were eating acorns and boiled leather, and the old and the weakest went first.',
    'The council gave out what was left a handful at a time, and there was never enough.',
  ],
  'event.after.famine': [
    'Ever since, {town} has kept a granary against hard years, and no council has dared to empty it.',
    'The spring came late but kind, and the fields were sown again from seed begged from the neighbours.',
  ],
  'event.detail.omen': [
    'Some took it for an omen of war or plague to come; others said it was nothing at all, and went back to their suppers.',
    'The {clergies} of {god} watched it every night, but could not say whether it meant good or ill.',
    'Children were kept indoors after dark, and the shrine was crowded every night it shone.',
  ],
  'event.detail.temple': [
    'The stone was hauled from the hills by ox-cart and on the backs of the faithful, and the building took thirty years.',
    'Every household in {town} gave something toward it, and the givers\' names are carved in the porch to this day.',
    'Its bell can be heard all the way out to the farthest fields on a still evening.',
  ],
  'event.detail.realm': [
    'It was not done lightly: the council argued through a whole winter before they swore.',
  ],
  'event.detail.news': [
    'It is still fresh enough in the memory of the townsfolk that they speak of it often.',
    'Those who were in {town} at the time can tell you exactly where they were when the word came.',
    'What the rolls say of it is short; what is said in the taverns is a good deal longer.',
  ],
  'event.detail.wreck': [
    'The ship broke up on the rocks in plain sight of the shore, and the people of {town} waded out into the surf to drag the survivors ashore.',
    'Her timbers washed up for a month afterwards, and more than one house in {town} is roofed with them still.',
  ],
  'event.detail.drought': [
    'The wells sank lower every week, and folk walked half a day for a jar of water.',
    'The fields cracked in the sun, and the herds had to be slaughtered before they starved.',
  ],
  'event.detail.winter': [
    'The snow lay over the eaves, and folk went from house to house by tunnels cut through the drifts.',
    'The watch kept the fires high all night, and the wolves howled in the forest outside the walls.',
  ],
  'event.detail.fog': [
    'The fog lay so thick that the townsfolk could not see their own hands in front of their faces.',
    'Boats that put out into it did not come back, and their names are cut on the post by the landing.',
  ],
  'event.detail.statue': [
    'The statue was carved from local stone, and is said to be a fair likeness, though those who knew the subject are not so sure.',
    'The whole of {town} came out for the raising, and there was feasting until the small hours.',
  ],

  // ------------------------------------------------------------ the town's ways
  'ways.famous': [
    '{town} is known across {land} for {famous}, and the townsfolk have never been modest about it.',
    'Ask anyone on the road about {town}, and the first thing they mention will be {famous}.',
    'Whatever else {town} has been known for, it has always been known first for {famous}.',
  ],
  'ways.table': [
    'The table of {town} is the table of the {people}: {dish} above everything, and {dish2}, with {drink} to wash it down.',
    'No feast in {town} is thought complete without {dish}, and a guest who refuses it will be remembered, and not kindly.',
    'Every kitchen in {town} has its own way with {dish}, and every one of them is certain that the others are doing it wrong.',
    '{drink} is drunk at every meal in {town}, by young and old alike; strangers would do well to go carefully with it.',
  ],
  'ways.faith': [
    'The faithful of {town} keep {faith}, and honour {god}, whose sign is {symbol}.',
    '{town} has always kept {faith}, and its {clergies} are well loved there, which cannot be said of every town.',
    'In {faith} the first virtue is {virtue}, and the folk of {town} try, for the most part, to live by it.',
  ],
  'ways.feast': [
    '{holyday} is the holy day, and no shop in {town} opens until the evening bell.',
    'At {feast} the whole of {town} turns out into the square, and the {clergy} leads the procession through the streets.',
    '{feast} is the great day of the year in {town}, and folk walk in from the farms for miles around to keep it.',
  ],

  // ------------------------------------------------------------ the legend
  'legend.open': [
    'Every town has its old stories, told by the fire on winter nights, and {town} is no exception.',
    'It would not be right to end a history of {town} without its best-known tale.',
  ],
  'legend.belief': [
    'Whether it is true, I cannot say; but nobody in {town} will go there after dark.',
    'The {clergies} call it a story for children, but they do not smile when they say so.',
    'I have heard it told five different ways, and every one of them ended the same.',
    'Sensible people laugh at it by daylight, and bar their shutters at night.',
  ],
  'legend.belief@scholar': [
    'There is no evidence for any of it, which has never yet stopped a good story.',
  ],
  'legend.belief@storyteller': [
    'I have been out there myself, once, at night. I did not stay long.',
  ],
  'legend.place': [
    'Some say it has something to do with {dungeon}, which lies {where}.',
    'Those who tell it best nod toward {dungeon}, {where}, when they come to the end.',
  ],
  'legend.close': [
    'But that is a story for the fire, and not for a book of years.',
    'I leave it here, for the reader to make of it what they will.',
  ],

  // ------------------------------------------------------------ the present day
  'present.realm': [
    '{town} is sworn to {realm}, and {ruler} rules it from {capital}.',
    'Today {town} is one of the towns of {realm}, under {ruler}.',
    'The banner of {realm} hangs over the hall of {town}, and its taxes go to {capital}.',
  ],
  'present.free': [
    '{town} owes allegiance to no realm and no crown, and its people are proud of it.',
    'No king has ever held {town} for long, and its council means to keep it that way.',
  ],
  'present.now': [
    'Today {town} is {state}, and its people have not forgotten the hard years behind them.',
    'The {towntype} that {founder} founded is today {state}, and I doubt the founder would recognise very much of it.',
    'A great deal has changed in {town} over the years, but the market is exactly where it always was, and so are most of the arguments.',
  ],
  'present.people': [
    'Some {souls} souls live in {town} now, and {mayor} keeps its hall.',
    '{town} counts some {souls} people today, and its council is led by {mayor}.',
    'Today {mayor} holds the hall of {town}, and about {souls} folk call it home.',
  ],
  'present.hope': [
    'May {town} stand another {age} years, and its people with it.',
    'Whatever the years bring, {town} has come through worse before.',
  ],
  'present.hope@pious': [
    'May {god} keep {town} as {god} has kept it so far, and a little better, if it can be managed.',
  ],
  'present.end': [
    'Here ends my history of {town}.',
    'What comes next is for another writer to set down.',
    'The rest of the story is still being lived, and cannot yet be written.',
  ],
  'present.end@storyteller': [
    'And that, more or less, is {town}. Go and see it for yourself.',
  ],
  'present.end@lyrical': [
    'The bells are ringing for the evening as I write this, as they have rung every evening for {age} years; I will let them have the last word.',
  ],
};
