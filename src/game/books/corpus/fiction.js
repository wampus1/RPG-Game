// (Round 127) Stories: the novels the people of the island write, and the
// sequels and prequels that follow them. See novels.js for how a story is
// put together: a cast (a hero, a friend, an elder and a villain), a
// setting taken from the world (the hero's own town, an old place near it,
// a war of the long past), and the beats of its plot, each said with one of
// the paragraphs here.
//
// Each beat is a pool of whole paragraphs, in the phrase grammar of
// talk/grammar.js ("(a|b)", "[a]") with the blanks filled from the story:
//
//   {hero} {last}   the hero, and their family name
//   {He} {he} {His} {his} {him} {himself}     the hero's pronouns
//   {friend} {FHe} {fhe} {FHis} {fhis} {fhim}  the friend (in a romance,
//                   the one the hero loves)
//   {mentor} {MHe} {mhe} {MHis} {mhis} {mhim}  the elder: the old soldier
//                   of a quest, the dead of a mystery, the grandparent of
//                   a romance; the hero of the prequel
//   {villain} {VHe} {vhe} {VHis} {vhis} {vhim} {vhimself}
//   {home} {homekind} {people} {ground} {water} {god} {feast} {clergy}
//   {war} {battle} {enemy} {place} {where} {dwellers} {thing}
//   {thingshort} {kept} {town2} {dish} {drink} {trade} {flaw} {fwas}
//   {vwhat} {gate} {way}
//
// A sequel adds {years} (since the last book), {prevplace}, {prevthing},
// {villain2} and {vrel} (the villain's kin); a prequel {comrade} {CHe}
// {che} {chis} {chim}, {battleyear}, {winner}, {loser}, {later} (years till
// the first book) and the first book's {hero}.
//
// A pool "beat@voice" is that writer's own way with it (see voice.js): the
// lyrical writer's weather, the plain writer's short sentences.
//
// The models: the old adventure stories, the village mysteries, the
// romances of feuding families; written plainly, with the feeling under
// the surface, and every chapter ending on a turn.
export const FICTION = {
  // ============================================================ a quest
  'quest.open': [
    '{hero} {last} was {trade} in {home}, and until the spring of {year} the most remarkable thing that had ever happened to {him} was a broken arm at the age of nine. {He} was {flaw}, which {his} friends forgave and {his} masters did not.',
    'Nobody in {home} expected very much of {hero} {last}, and for most of {his} life {hero} had been careful to give them no reason to. {He} was {trade}, {flaw}, and content, or nearly.',
    'In {home} they still tell the story of {hero} {last}, though most of them tell it wrong. {He} was {trade} when it began, and {flaw}, and nobody would have picked {him} out of a crowd. This is how it happened.',
  ],
  'quest.open@lyrical': [
    'In the spring of {year} the blossom came early to {home}, and lay on the roofs like snow, and {hero} {last}, who was {trade} and {flaw}, thought that nothing would ever happen to {him} at all.',
  ],
  'quest.home': [
    '{home} was a {homekind} of {people} folk in {ground}, the kind of place where everyone knew the price of everyone else\'s cow. In the temple of {god}, {kept}, stood {thing}, {thingwhat}; and it had stood there so long that people had stopped seeing it.',
    'That year {feast} came in with a hard frost, and {home} was hung with lamps from the hall to the gate. Everyone went to the temple of {god} to look at {thing}, as they did every year, and every year it was there.',
    'There is a thing that every child of {home} is taken to see once, and told never to touch: {thing}, {thingwhat}, kept {kept}. {hero} had seen it a hundred times, and thought about it perhaps twice.',
  ],
  'quest.theft': [
    'On the last night of {feast} somebody broke the temple door, and in the morning {thingshort} was gone. The {clergy} found the door hanging from one hinge and the shelf empty, and a smell in the air like a snuffed candle.',
    'It was a dog that raised the alarm, barking at nothing in the small hours. By the time anyone had found a lamp, the door of the temple stood open, the shelf was bare, and whoever had done it was a mile up the {way} road and walking fast.',
    'Nobody heard a thing. That was what frightened people afterwards: the temple doors were barred, the {clergy} slept beside the shrine, and in the morning {thingshort} was simply gone, as if it had got up in the night and walked away.',
  ],
  'quest.blame': [
    'By noon half of {home} had decided that strangers had done it, and the other half had decided it was the {clergy}. The council met, argued till dark, and resolved to write to {ruler}, which was what the council always did when it did not know what else to do.',
    'The council met in the hall and shouted at each other for an afternoon. Somebody blamed the drovers who had come through at {feast}; somebody else blamed the gods. Nobody suggested going after it, because everybody knew that somebody else would.',
  ],
  'quest.mentor': [
    '"It was {villain}," said old {mentor}, who had not spoken at a council meeting in twenty years. "I would know the work anywhere. I marched with {vhim} in {war}, before {vhe} turned." Nobody laughed, though some of them wanted to.',
    'That evening there was a knock at {hero}\'s door, and old {mentor} stood there in a soldier\'s cloak gone grey with age. "You were at the temple this morning," {mhe} said. "You saw the marks on the door. I saw marks like that once before, at {battle}, and I hoped never to see them again."',
    '{mentor} had been a soldier once, in {war}, and had come home with a limp and nothing to say about it. Now {mhe} stood at the back of the hall and said one name, quietly, and the room went still: "{villain}."',
  ],
  'quest.choice': [
    '{hero} knew {he} ought to say no. {He} had work in the morning, and no sword, and no idea where {place} even was. "When do we leave?" {he} said.',
    '"Why me?" {hero} asked. "Because you were the only one at the temple this morning who looked at the door instead of the shelf," said {mentor}. "And because I am too old to go alone, and too proud to say so to anyone else."',
    'All night {hero} lay awake and listed the reasons not to go. There were a great many of them, and they were all good. In the morning {he} packed a bag.',
  ],
  'quest.leave': [
    'They left {home} before dawn by the {gate} road. They had gone less than a mile when {friend} came running after them with a pack on {fhis} back and bread for three. "If you think," {fhe} said, out of breath, "that you are going without me, you are both stupider than you look."',
    '{friend} was waiting at the bridge with two horses that did not belong to {fhim}. "Borrowed," {fhe} said, before anyone could ask. "I will give them back. Probably." {mentor} looked at the horses, and then at {friend}, and said nothing at all, which was {mhis} way of saying yes.',
    '{friend}, {fwas}, did not ask where they were going, or why. {FHe} simply fell into step beside {hero} at the gate, as {fhe} had done every day since they were children, and {hero} found that {he} was more glad of it than {he} could say.',
  ],
  'quest.road': [
    'The road to {place} ran {way} through {ground}, and for two days they saw nobody. {mentor} walked at the front, steadily, the way old soldiers walk, and would not stop until the light failed.',
    'Rain found them on the second day, and stayed. They walked bent into it through {ground}, and at night they slept under a hedge, and woke wetter than they had lain down.',
    'The first day was easy, and they talked; the second was hard, and they did not. By the third, {hero} had blisters on {his} blisters, and had learned more about {friend} than in twenty years of living two doors apart.',
  ],
  'quest.road@lyrical': [
    'Beyond {home} the country opened out: {ground} as far as the eye could reach, and above it a sky so large that {hero} felt, for the first time in {his} life, how small {home} had been, and how much of the world had been going on without {him}.',
  ],
  'quest.road@plain': [
    'They walked {way} for two days. It rained. Nobody spoke much.',
  ],
  'quest.camp': [
    'That night, by a fire that gave more smoke than heat, {mentor} told them about {war}. "We held the line at {battle} until noon," {mhe} said. "{villain} was beside me when the {enemy} came over the ditch. When I looked again, {vhe} was gone, and so was the paymaster\'s chest." {MHe} did not tell them the rest, and they did not ask.',
    '"Was {vhe} always bad?" {friend} asked the fire. {mentor} took so long to answer that {hero} thought {mhe} had fallen asleep. "No," {mhe} said at last. "That is the worst of it. At {battle} {vhe} carried me two miles on {vhis} back. Something broke in {vhim} after that. War does that to some people. It does other things to the rest."',
    'They camped in the lee of a ruined wall, and {mentor} sat up with the watch. "I was younger than you when I marched to {battle}," {mhe} told {hero}, low, so as not to wake {friend}. "I thought I knew what I was for. I found out. Mind you do not find out the same way."',
  ],
  'quest.sign': [
    'On the third morning they came to a farm with its door broken in and its hens scattered over the yard. The farmer had hidden in the loft. "{VHe} asked the way to {place}," the farmer said, still shaking. "Polite as you like. Then {vhe} took my horse."',
    'Beside the road they found the ashes of a fire still warm, and in the ashes a scrap of the cloth that {thingshort} had been wrapped in. {mentor} turned it over with {mhis} stick. "A day ahead of us," {mhe} said. "Less, if {vhe} is carrying it {vhimself}."',
    'In a village where they stopped for water, a child told them that a traveller in a grey hood had come through the day before, asking the way to {place}, and had paid for a cup of milk with a coin of silver. "Nobody pays silver for milk," said {friend}. "Not unless they want to be remembered."',
  ],
  'quest.arrive': [
    '{place} lay {where}, and the first sight of it was enough to make {friend} stop talking, which {hero} had not thought possible.',
    'They came to {place} at dusk. The way in was a dark mouth in the ground, and the air that came out of it was cold, and smelled of old stone and of something else that none of them wanted to name.',
    'It did not look like much, {place}: a hump of ground {where}, a few stones, a hole. "They never do," said {mentor}, and lit the lamps.',
  ],
  'quest.descent': [
    'They went down with two lamps and a coil of rope, {mentor} first and {friend} last. The passages went on further than seemed reasonable. Somewhere far below, something was moving, and it stopped when they stopped.',
    'Below, the dark was the kind that presses on the eyes. They heard {dwellers} before they saw them, and saw them for a heartbeat only, before {mentor} had them flat against the wall and the lamps shuttered.',
    'The first hall was empty, and the second, and {hero} had begun to hope. In the third, the floor was covered with old bones, very neatly arranged, and the lamplight showed fresh footprints going through them.',
  ],
  'quest.trap': [
    'It was {friend} who found the trap, by stepping on it. The floor tilted, a stone slid away, and {fhe} was gone into the dark below with a cry that seemed to go on falling for a long time. When {hero} lowered the lamp {fhe} was there, well out of reach, swearing magnificently. "Leg," {fhe} called up. "Not broken. Probably. Go on. I will find another way."',
    'The passage forked, and forked again, and at the third fork they lost {friend}. One moment {fhe} was behind them with the second lamp, and the next there was only the dark and, a long way off, a light going away.',
  ],
  'quest.villain': [
    'In the deepest hall, by the light of a dozen stolen candles, {villain} was waiting for them, with {thingshort} on the floor at {vhis} feet. "{mentor}," {vhe} said, as if they had parted the week before. "I wondered whether they would send you. You always did like a lost cause."',
    '{villain} was not what {hero} had expected. {VHe} was small, and grey, and tired-looking, and when {vhe} smiled it was almost kind. "So this is the one the old fool has brought to die for {mhim}," {vhe} said. "Sit down. There is no hurry. There never was."',
    '"Do you know what it is?" {villain} asked, and held up {thingshort} so that the light ran over it. "Of course you do not. Nobody in {home} has known for a hundred years. They light candles to it. I mean to use it." {VHe} looked at {mentor}. "We could have been rich, you and I, after {battle}. You chose to be good instead. Look where it has got you."',
  ],
  'quest.dark.mdead': [
    'What happened next happened very fast, and {hero} was never afterwards able to tell it in order. There was a blade, and {mentor} stepping in front of it; and then {mentor} was on the floor, and {villain} was gone into the dark with {thingshort}, and the lamp was guttering. "Go after {vhim}," {mentor} said. "Not now. When you are ready." {MHe} died before the lamp went out.',
    '{mentor} fought the way old soldiers fight, without grace and without stopping, and for a while it seemed {mhe} might win. Then {mhe} slipped on the wet stone. {villain} did not even look back. "Tell them in {home}," {mentor} whispered, with {hero} holding {mhis} head, "that I was not afraid. Tell them that, even if it is not true."',
  ],
  'quest.dark.mlive': [
    'When the dust settled {villain} was gone, and {mentor} was lying against the wall with blood on {mhis} sleeve and {mhis} face the colour of ash. "It is nothing," {mhe} said. "Go. {VHe} will make for the deep stair. Go, before I change my mind and ask you to stay."',
    'The roof came down between them. When {hero} had dug {mentor} out {mhe} was alive and furious, with one leg pinned and no chance of walking on it, and {villain} was gone. "Leave me," {mentor} said. "I have been in worse places, and in worse company. Get after {vhim}."',
  ],
  'quest.alone': [
    'So {hero} went on alone, with half a lamp of oil and no idea of the way. {He} was {flaw}, and for an hour in that dark {he} was nothing else at all. {He} sat down on the cold stone and wept, and when {he} had finished weeping {he} got up again, because there was nothing else to do.',
    'Afterwards, {hero} could never say how long {he} walked in the dark. {He} thought of {home}, of the lamps at {feast}, of {friend}\'s voice. {He} thought of turning back more often than {he} would ever admit.',
  ],
  'quest.alone@lyrical': [
    'The dark below {place} was older than any dark {hero} had known, and it had a weight, and a patience, and it seemed to {him} that it had been waiting a long time for someone exactly as frightened as {he} was.',
  ],
  'quest.resolve': [
    'It was a small thing that saved {him} in the end: a draught on {his} cheek, cool and steady, coming from somewhere ahead. Air from outside, {mentor} had said once. Follow the air. {hero} followed it.',
    '{He} remembered something {mentor} had said by the fire, that first night on the road: that {villain} never in {vhis} life went anywhere without a way out behind {vhim}. {hero} stopped looking for {villain}, and began looking for the way out.',
  ],
  'quest.climax.vdead': [
    '{He} found {villain} at the foot of the deep stair, struggling with {thingshort}, which was heavier than it looked. They fought, if it can be called fighting: {hero} had never held a blade in anger. At the end of it {villain} lay still on the stone, and {hero} stood over {vhim}, and did not feel at all as the songs had told {him} {he} would.',
    'The stair was old, and {villain} was in a hurry. {hero} heard the crack of the step giving way, and the long silence, and then nothing. {He} found {thingshort} on the edge of the drop, where {villain} had let go of it to save {vhimself}, and not been quick enough.',
  ],
  'quest.climax.vfled': [
    '{He} came out into the grey light on the hillside just in time to see {villain} on a stolen horse, a long way off and getting further. {thingshort} lay in the heather where {vhe} had dropped it. {villain} turned once in the saddle and lifted a hand, as if in greeting, and was gone.',
    'It was a near thing. {villain} had {thingshort} in {vhis} hands at the very mouth of {place} when {hero} caught up, and for a long moment they stood face to face. Then {villain} laughed, threw it down at {hero}\'s feet, and ran. "Keep it," {vhe} called back. "I will come for it again when it is worth more."',
  ],
  'quest.climax.vcaught': [
    '{hero} caught up with {villain} at the bottom of the deep stair, where the way out had fallen in. {villain} looked at the rubble, and at {hero}, and sat down on a stone. "Well," {vhe} said. "I suppose you had better take me back." {hero} had expected many things, but {he} had not expected {villain} to look relieved.',
    'In the end it was {villain}\'s own greed that undid {vhim}: {vhe} would not let go of {thingshort}, even to climb, and {hero} caught {vhim} on the ladder by the ankle. They came up into the daylight together, the thief and {thetrade}, and the thief did not try to run again.',
  ],
  'quest.after.kept': [
    '{friend} was sitting at the mouth of {place} when {hero} came out, filthy, bruised and grinning. "Took you long enough," {fhe} said. They carried {thingshort} home between them, wrapped in {hero}\'s cloak, and did not talk much on the way, which was new.',
    'They found {friend} on the road below {place}, limping, furious and alive, having climbed out by a way {fhe} refused to describe. {FHe} looked at {thingshort} in {hero}\'s arms and then at {hero}, and for once in {fhis} life had nothing to say.',
  ],
  'quest.after.lost': [
    '{thingshort} was lost in the end, gone down into a dark that had no bottom anyone has ever found. {hero} came out without it, and found {friend} waiting at the mouth of {place}, and for a while that was enough.',
    'Nobody would ever see {thingshort} again; {hero} had watched it go down into the deep, turning over and over, a little light falling through the dark until there was no light at all. {He} came up into the morning empty-handed, and {friend} was there, and did not ask.',
  ],
  'quest.home2.mdead': [
    'They came home to {home} on the eve of the first frost. The whole {homekind} turned out to meet them, and the {clergy} wept, and the council made a speech that went on far too long. {hero} stood through all of it thinking of a grave with no stone, far under the ground at {place}.',
    'There was a feast, of course; {home} could not let a thing like that pass without one. They set a place at the high table for {mentor}, and left it empty, and nobody sat in it all night.',
  ],
  'quest.home2.mlive': [
    'They came home to {home} on the eve of the first frost. {mentor}, carried the last miles on a cart and complaining about every rut in the road, was given the seat of honour at the feast, and slept through most of it.',
    '{home} gave them a feast, and {mentor} told the story of it so many times that winter that it grew a dragon, two more villains and a storm at sea. {hero} let {mhim}. {He} thought {mentor} had earned it.',
  ],
  'quest.end.villain': [
    'Nobody in {home} saw {villain} again that year. But sometimes, on winter nights, {hero} would wake for no reason and lie listening to the wind, and wonder where {vhe} was, and what {vhe} was waiting for.',
  ],
  'quest.end.kin': [
    'Among {villain}\'s things they found a letter, never sent, to someone {vhe} called only "my dear one", promising to come home rich. {hero} kept it. {He} did not know why, then.',
  ],
  'quest.end.deep': [
    'And far below {place}, where {thingshort} had fallen, something that had slept a long time turned over in the dark, and began, very slowly, to wake.',
  ],
  'quest.end.door': [
    'Only {hero} had seen the second door in the deepest hall of {place}, sealed with a seal {he} did not know. {He} told nobody about it. But {he} did not forget it, either.',
  ],

  // ============================================================ a mystery
  'mystery.open': [
    'They found {mentor} on the morning of {feast}, face down in the mill-race below {home}, with {mhis} purse still full and {mhis} best coat on. {mentor} had been a soldier in {war}, a churchwarden of {god}, and the most disliked person in the {homekind}; and it was {hero} {last}, {trade}, who found {mhim}.',
    'Afterwards, everyone in {home} said they had known something would happen to old {mentor}. Nobody had liked {mhim}; a good many people had owed {mhim} money; and {mhe} had a way of looking at you, they said, as if {mhe} knew. On the morning after {feast}, {mhe} was found dead at the foot of the temple stair.',
    'It was {hero} {last} who found old {mentor}\'s body at the foot of the temple stair, and {hero} who noticed what was wrong with it, and {hero}, therefore, whom the council blamed for the whole business. {He} was {trade}, and {flaw}, and had never in {his} life meant to be interesting.',
  ],
  'mystery.scene': [
    'The watch said {mentor} had fallen, drunk, as old soldiers do. But {mentor} had not drunk anything stronger than milk in thirty years, and {mhis} boots were dry, and on {mhis} right hand, clenched so tight they had to break the fingers to open it, was a single brass button from a {enemy} soldier\'s coat.',
    '{hero} looked for a long time at the body, until the watchman told {him} to stop it. The lamp was still lit in {mentor}\'s window. The door was bolted from inside. And on the table, beside a cup of cold tea, lay a list of names, and every one of them had been crossed out but one.',
  ],
  'mystery.watch': [
    'The captain of the watch was a large, comfortable person who believed in accidents the way other people believe in {god}. "{MHe} fell," the captain said. "Old folk fall. Go home, {hero}." {hero} went home, and did not stop thinking.',
    '"You will leave it alone," said the steward of the hall, very kindly, "if you know what is good for you." {hero} had never known what was good for {him}. {He} went straight round to the temple to ask questions.',
  ],
  'mystery.friend': [
    '{friend}, {fwas}, listened to the whole thing in silence, and then said: "You are going to make a fool of yourself, and you will want somebody with you when you do." It was the nicest thing anyone had said to {hero} in a week.',
    'It was {friend} who made {him} write it all down, every name and every hour, on the back of an old almanac. "You remember things wrong," {fhe} said. "Everybody does. Paper does not."',
  ],
  'mystery.suspects': [
    'There were, {hero} decided, three people in {home} who might have wanted {mentor} dead: the stranger at the inn, who had arrived the week before and asked a great many questions; {mentor}\'s own nephew, who stood to inherit; and {villain}, {vwhat}, who had been seen arguing with {mentor} on the temple steps. {He} liked {villain}. That was the trouble.',
    'Everyone had a reason. The nephew wanted the house. The innkeeper was owed money. {villain}, {vwhat}, had quarrelled with {mentor} at the last council over the old war-rolls. And the stranger, who said {vhe} was a pedlar but had no pack, had been seen by the mill-race on the night of {feast}.',
  ],
  'mystery.clue': [
    'In the back room of the temple, where the old rolls were kept, {hero} found the roll of those who had marched from {home} to {battle}. One name had been scraped off it with a knife, so carefully that only the shape of it remained. {He} held it up to the window, and read it, and sat down rather suddenly.',
    'The button was the key. There were not many {enemy} soldiers\' buttons in {home}; there were not many {enemy} soldiers who had come home from {war} at all. But the old {clergy} remembered one: a deserter, who had come back after {battle} under another name and had never left.',
    'The tea in {mentor}\'s cup had been sweetened, and {mentor} never took sweetening. Somebody had known that {mhe} would not taste the difference with honey enough in it. Somebody, therefore, who had known {mentor} for a very long time.',
  ],
  'mystery.wrong': [
    'The watch arrested the stranger at the inn on the fourth day, on no evidence at all, and the whole of {home} was relieved. {hero} went to see {vhim} in the cells. "I did not do it," the stranger said, without much hope. "I know," said {hero}. "That is what worries me."',
    'For two days everyone was sure it was the nephew, and the nephew, who was a fool, behaved exactly as if it were. {hero} watched {villain} watching the crowd in the square, and saw {vhim} smile, very slightly, and for the first time {he} was afraid.',
  ],
  'mystery.danger': [
    'On the fifth night someone tried to burn the house where {hero} lodged. {He} woke to smoke, and got out through the window with {his} notes in {his} teeth, and stood barefoot in the street watching the thatch go up. Whoever had done it knew {he} was close.',
    'Somebody followed {him} home from the temple that night: footsteps that stopped when {his} stopped. {He} did not look round. {He} did not need to. In the morning there was a knife in the door of {his} lodging, holding a note that said only: "Leave it."',
  ],
  'mystery.reveal': [
    '{hero} laid it out before the council in the hall, piece by piece, the way {friend} had made {him} write it down: the scraped roll, the button, the sweetened tea. The name on the roll had been {villain}\'s, before {vhe} changed it; the deserter from {battle} was {villain}, {vwhat}; and {mentor}, who had marched beside {vhim}, had known it for {warago} years and had finally meant to say so.',
    '"You knew {mhim} at {battle}," {hero} said. {villain} did not answer. "{MHe} carried the roll home. {MHe} knew what you did there, and {mhe} kept it to {mhim}self for {warago} years, and then {mhe} told you {mhe} would tell. So you made {mhim} tea." The hall was so quiet that {hero} could hear the rain.',
  ],
  'mystery.reveal.vcaught': [
    '{villain} did not run. {VHe} sat down at the council table, folded {vhis} hands, and said: "{MHe} would not let it lie. {Warago} years. Who keeps a grudge {warago} years?" Then {vhe} let the watch take {vhim}, and never said another word.',
  ],
  'mystery.reveal.vfled': [
    'By the time the watch came for {villain}, {vhe} was gone: out of the back of the hall, over the wall, and away up the {way} road on the steward\'s best horse. They found the horse two days later, lame. They never found {villain}.',
  ],
  'mystery.reveal.vdead': [
    'They found {villain} the next morning in the mill-race, where {mentor} had been found, and nobody ever settled whether {vhe} had fallen or jumped. The watch called it an accident. {hero} did not argue. {He} had had enough of arguing.',
  ],
  'mystery.close': [
    'They buried {mentor} in the temple yard, under {mhis} own name and the name of {battle}, which {mhe} had asked for in {mhis} will. More people came than anyone had expected. {hero} stood at the back, and {friend} stood beside {him}, and afterwards they walked home the long way, by {water}.',
    'The stranger at the inn was let out of the cells, and left {home} the same day, and sent {hero} a letter from {town2} that said only: "Thank you. I will not forget it." The council gave {hero} a vote of thanks, which cost nothing, and a new coat, which cost a little more.',
  ],
  'mystery.end.villain': [
    'But on the first night of winter a letter came for {hero}, with no name on it, from {town2}. Inside was a single brass button, and three words: "Not yet finished."',
  ],
  'mystery.end.kin': [
    'Among {villain}\'s papers was a letter to a child {vhe} had never mentioned to anyone in {home}, a child {vhe} called "my own". {hero} burned the letter. {He} would remember, years later, that {he} had burned it, and wish {he} had not.',
  ],
  'mystery.end.door': [
    'Only one thing still troubled {hero}. On the roll of {battle} there had been another name scraped away, below {villain}\'s, and nobody in {home} could tell {him} whose it had been.',
  ],
  'mystery.end.deep': [
    'And on the mill-race below {home}, where it all began, the water ran on as it always had, and kept whatever else it knew to itself.',
  ],

  // ============================================================ a romance
  'romance.open': [
    'Everyone in {home} knew two things about the {last} family: that they kept the best orchard in the valley, and that they would sooner eat their own boots than speak to anyone from {town2}. {hero} {last} had always thought both things perfectly reasonable, until the {feast} of {year}.',
    'There had been a quarrel between {home} and {town2} since {war}, when the two towns had marched under different banners and the {last} family had lost three sons at {battle}. Nobody remembered any longer exactly whose fault it had been. That had never stopped anybody.',
    '{hero} {last} was {trade}, {flaw}, and, in the opinion of {his} grandmother, old {mentor}, very much too old to be unmarried. {He} had heard this opinion so often that {he} had stopped hearing it. That was before {he} met {friend}.',
  ],
  'romance.meet': [
    'They met at {feast}, at the dancing on the green, when {hero} trod on {friend}\'s foot and {friend} trod back, hard, on purpose. "You are from {home}," {fhe} said. "I can tell by the boots." "And you are from {town2}," said {hero}. "I can tell by the manners." By the end of the night they had danced four times, and neither of them could have said why.',
    '{friend} came to {home} market every week with eggs to sell from {town2}, and every week {hero} found a reason to buy eggs, until {his} grandmother asked whether {he} was planning to build a house out of them.',
    'It was raining, and {friend} had no cloak, and {hero} had one, and that was all it was at the start. {FHe} gave it back the next week, dry and mended where it had been torn, with a sprig of rosemary in the pocket. {hero} kept the rosemary in a book for the rest of {his} life.',
  ],
  'romance.meet@lyrical': [
    'They met in the orchard at the edge of the two parishes, where the trees of {home} lean over the wall into {town2}, and the blossom does not know which side it is on. {hero} was there to pick the apples, and {friend} to steal them, and by the end of the afternoon neither of them had done either.',
  ],
  'romance.feud': [
    '"A {town2} {fman}?" said old {mentor}, when {mhe} heard, and set down {mhis} spoon. "Your great-uncles died at {battle} because of {town2}." "That was {warago} years ago," said {hero}. "Grief does not count years," said {mentor}, "and neither will I."',
    'When old {mentor} heard, {mhe} did not shout, which was worse. {MHe} went out to the orchard and stood among the trees {mhis} brothers had planted before {battle}, and when {mhe} came in {mhe} said only: "Not while I live."',
  ],
  'romance.feud2': [
    'The {town2} family took it no better. {friend}\'s mother said she would sooner see {fhim} married to a goat, and {friend}\'s father said nothing at all, which was worse.',
    'In {town2} it was the same. {friend} was told, at length and at volume, what the {last} family had done in {war}, and what they would surely do again given half a chance.',
  ],
  'romance.secret': [
    'So they met in secret, which was easier than either of them had expected and harder than either of them could bear: by the ford at dusk, in the ruined mill, once, wonderfully, in the bell tower of the temple of {god} while the {clergy} rang for evening below them.',
    'They wrote to each other. {friend}\'s letters were short, and badly spelt, and full of jokes; {hero}\'s were long, and full of things {he} could never have said aloud. They left them in a hollow of the boundary wall, and it was a whole summer before anyone found out.',
  ],
  'romance.found': [
    'It was {hero}\'s cousin who saw them, and told, and by nightfall both towns knew. There were words in the street, and then more than words, and the watch had to be called out. {friend} was sent away the next morning to an aunt in {capital}, and nobody would tell {hero} for how long.',
    'Someone found the letters in the wall. They were read aloud at the inn in {town2} to roars of laughter, and in {home} to a silence that was worse. {hero} did not leave the house for a week.',
  ],
  'romance.apart': [
    'The winter that followed was the longest {hero} had ever known. {He} worked, and ate, and slept, and did not speak of {friend}; and {his} grandmother, who had won, found that {mhe} did not enjoy it nearly as much as {mhe} had expected.',
    'Months passed. {hero} heard nothing, and told {himself} that {he} was glad, and did not believe it. In the spring {he} began to walk, every evening, as far as the boundary wall, and every evening {he} came back alone.',
  ],
  'romance.apart@lyrical': [
    'Winter came down over the valley like a held breath. The river froze between the two towns, and for the first time in living memory it was possible to walk from {home} to {town2} dry-shod; and nobody did.',
  ],
  'romance.crisis': [
    'Then, in the spring, the river rose. It came down in a single night, brown and roaring, and took the bridge, and the lower houses of {town2} with it. {hero} was in the first boat out from {home}. {He} did not think about it. {He} did not think about anything except a window in {town2} with a light in it.',
    'Then the fever came to {town2}, the way fevers come, without warning and without mercy, and {home} closed its gate. {hero} went over the wall in the night with a bag of medicines from the temple of {god}, and nobody in {home} saw {him} for a month.',
  ],
  'romance.grandmother': [
    'It was old {mentor} who ended it. {MHe} stood up in the hall, leaning on {mhis} stick, and told them all a story nobody had heard before: about a {town2} soldier who had carried a wounded {home} boy off the field at {battle}, and been killed for it, and whose name {mhe} had never let {mhim}self say. "I have been angry for {warago} years," {mhe} said. "It has not brought anybody back. Let the children be."',
  ],
  'romance.end.together': [
    'They were married at midsummer, in the orchard on the boundary, by a {clergy} from {home} and a {clergy} from {town2} who took it in turns to read and very nearly came to blows over the order of service. Everyone said it was the best wedding in fifty years. Everyone was right.',
    'They were married the next spring. Half of {home} came, and half of {town2}, and they sat on opposite sides of the temple and glared at each other until the dancing started, and then forgot to.',
  ],
  'romance.end.apart': [
    '{friend} did not come back. {FHe} married a merchant in {capital}, years later, and was happy, or said so in {fhis} letters. {hero} never married. {He} kept a sprig of rosemary in a book, and on {feast} {he} would take it out and look at it, and put it back.',
    'In the end it was too late. {friend} had gone away for good, and the letters stopped, and {hero} learned to live with an empty place at the table the way one learns to live with a limp. {He} did not regret it. {He} told {himself} so often enough.',
  ],
  'romance.end.villain': [
    'Only one person in {home} did not come to the wedding: {villain}, {vwhat}, who had wanted the orchard for {vhimself}, and who stood at the window of the hall and watched the dancing with a face like a shut door.',
  ],
  'romance.end.kin': [
    'And in the box of old letters that {mentor} left when {mhe} died, the following winter, there was one more, unopened, addressed in a hand from {town2}, dated the year of {battle}.',
  ],
  'romance.end.door': [
    'Nobody ever told them what had become of the {town2} soldier\'s family. {hero} meant to ask. {He} kept meaning to, for years.',
  ],
  'romance.end.deep': [
    'The river went down, in time, and the two towns rebuilt the bridge together, and argued about every stone of it. But the old people said that the water had not finished, and watched it, every spring, with narrowed eyes.',
  ],

  // ============================================================ a sequel: picking up the thread
  'seq.open.quest': [
    '{years} years had passed since {hero} {last} came home from {prevplace} with {prevthing}, and {home} had mostly stopped talking about it. {He} was {trade} now, with grey coming in at {his} temples and a limp on wet mornings, and {he} liked it that way.',
    'They still sang a song about {hero} in the taverns of {home}, a bad one, with the facts wrong. {He} had stopped correcting people. It had been {years} years since {prevplace}, and {he} had other things to think about.',
  ],
  'seq.open.mystery': [
    'Since the business of old {mentor}\'s death, {years} years before, people in {home} had got into the habit of bringing their troubles to {hero} {last}: lost goats, stolen washing, a husband who came home late. {He} solved most of them, and charged nothing, and had come, very slightly, to enjoy it.',
    '{years} years after the death of {mentor}, {hero} {last} was still {trade}, still {flaw}, and still, in the opinion of the watch, a busybody who had got lucky once.',
  ],
  'seq.open.romance': [
    '{years} years after the wedding in the orchard, the {last} family and the family from {town2} had very nearly stopped quarrelling, which in that valley counted as a miracle.',
    'It had been {years} years since the spring of the flood. Most of {home} remembered it as a love story. {hero} remembered it as the year {he} had learned how much {he} could lose.',
  ],
  'seq.friend.together': [
    '{friend} had married {him} the spring after it was all over, to nobody\'s surprise but their own, and they had a house by the green with a leaking roof that both of them had promised, for {years} years, to mend.',
    '{friend} was still beside {him}: older, broader, louder, and the only person in {home} who could tell {hero} {he} was wrong and be thanked for it.',
  ],
  'seq.friend.apart': [
    '{friend} had gone away the year after, to {town2}, and wrote at midwinter: long letters full of other people\'s news, which {hero} read twice and kept in a box under the bed.',
  ],
  'seq.mentor.dead': [
    'On the anniversary of it, as every year, {hero} went up to the temple and lit a candle for {mentor}. The {clergy} had long since stopped asking who it was for.',
  ],
  'seq.mentor.alive': [
    'Old {mentor} was older still, and nearly blind, and spent the days in a chair by the temple door, telling anyone who would listen that {mhe} had done most of the work.',
  ],
  'seq.call.villain': [
    'Then one morning a stranger rode into {home} with a message, and the message was in a hand {hero} had not seen in {years} years, and had hoped never to see again. It said only: "I told you I would come back."',
    'It began with a horse: a grey, lame in the off hind, that limped into {home} one evening with an empty saddle and a note tied to the girth. {hero} knew the hand before {he} had unfolded it. {villain} had come back.',
  ],
  'seq.call.kin': [
    'The stranger who came to {home} that autumn was young, and courteous, and asked a great many questions about the old days. It was {friend} who noticed it first: the stranger had {villain}\'s eyes. "My name is {villain2}," the stranger said to {hero}, quite pleasantly, on the third day. "You killed my {vrel}."',
  ],
  'seq.call.caught': [
    '{villain} had been in the cells at {capital} for {years} years. The letter from the governor said that {vhe} had walked out of them on the night of {feast}, through three locked doors, and that nobody could say how.',
  ],
  'seq.call.deep': [
    'That spring the wells of {home} began to run warm, and the dogs would not go near the road to {prevplace}. Something below had woken, just as {hero} had always feared, and it was coming up.',
  ],
  'seq.call.door': [
    '{He} had never forgotten the second door. When the {clergy} of {home} brought {him} an old key found in the wall of the temple, {he} knew at once what it would open, and that {he} would have to go back.',
  ],
  'seq.end': [
    'It was over, and this time {hero} knew that it was over. {He} went home to {home} by the long road, and took {his} time about it, and at the top of the last hill {he} stopped and looked down at the roofs and the smoke, and for the first time in {years} years {he} felt that {he} could put it down.',
    'Afterwards, when people asked {hero} about it, {he} said that it had been less frightening the second time, which was not true, and that {he} would not do it again, which was.',
  ],

  // ============================================================ a prequel: the war the elder marched to
  'pre.open': [
    'Long before anyone in {home} had heard of {hero} {last}, when old {mentor} was young {mentor}, with all {mhis} teeth and none of {mhis} sense, the word came to {home} that the realm was at war with the {enemy}.',
    'In the year that {war} began, {mentor} was seventeen, {mtrade}, and certain that {mhe} would be famous by the harvest. This is the story of how {mhe} was wrong.',
  ],
  'pre.muster': [
    'They mustered on the green, every soul in {home} of an age to carry a spear and a good many who were not. {mentor} stood in the second rank, beside {comrade}, who had been {mhis} friend since they could walk and who had brought, instead of a spear, a fiddle.',
    'The {clergy} of {god} blessed them in the square, and the whole {homekind} came out to see them go. {mentor}\'s mother would not come. {mentor} looked for her face at every window as they marched out by the {gate} gate, and did not find it.',
  ],
  'pre.muster.romance': [
    'The {clergy} of {god} blessed them in the square, and the whole {homekind} came out to see them go. {mentor}\'s mother would not come. {mentor} looked for her face at every window as they marched out by the {gate} gate, and did not find it.',
    'They mustered on the green, every soul in {home} of an age to carry a spear and a good many who were not, and {mentor} stood in the second rank with {mhis} younger brother beside {mhim}, and promised their mother to bring him home.',
  ],
  'pre.march': [
    'The march was nothing like the songs. It rained for nine days; the bread went mouldy; {comrade} played the fiddle every night until the sergeant threatened to break it over {chis} head, and then played it more quietly.',
    'They walked for three weeks to reach the border, and on the way they passed a village the {enemy} had burned. Nobody sang after that. {comrade} put the fiddle away and did not take it out again for a long time.',
  ],
  'pre.villain': [
    'It was on the march that {mentor} first met {villain}: a quick, clever, laughing soldier from somewhere further up the valley, who could find food when nobody else could and never said where {vhe} found it. {mentor} liked {vhim} at once. Everybody did. That was {villain}\'s gift.',
  ],
  'pre.battle': [
    'They met the {enemy} at {battle}, in the year {battleyear}. {mentor} remembered almost nothing of it afterwards but the noise, and the mud, and {comrade} beside {mhim} one moment and then not beside {mhim}. The day went to {winner}. It did not feel like anybody\'s day.',
    '{battle} began at dawn and went on until neither side could stand. {mentor} was hit twice, and did not notice either time. When it was over, {winner} held the field, and {mentor} was sitting in a ditch with {comrade}\'s head in {mhis} lap, singing to {chim}, very badly, the song {che} had always played.',
  ],
  'pre.betrayal': [
    'In the night after the battle {villain} came to {mentor} with a lantern and a proposition: the paymaster was dead, and the paymaster\'s chest was lying in the mud with nobody to guard it, and who would ever know? "I would," said {mentor}. {villain} looked at {mhim} for a long moment, and then laughed, and went away into the dark. In the morning {vhe} was gone, and so was the chest.',
  ],
  'pre.thing': [
    'Among the dead on the field {mentor} found the old {clergy} of {home}, who had carried {thing} before the army for a blessing, as was the custom then. "Take it home," the {clergy} whispered, before the end. "Keep it safe. They will come for it." {mentor} carried it all the way back to {home} inside {mhis} shirt.',
    '{thing} had gone to war with them, carried before the army by the {clergy} of {home}, as it always had been. After the battle {mentor} found it in the mud beside the {clergy}\'s body, and picked it up, and did not let go of it again until {mhe} was home.',
  ],
  'pre.home': [
    'They came home in the autumn, fewer than had gone. {mentor} gave {thingshort} into the keeping of the temple, and told nobody how {mhe} had come by it, and never spoke of {comrade} again except once a year, at {feast}, when {mhe} would sit by the fire and hum a tune that nobody else knew.',
    '{mentor} came home to {home} with a limp, a medal and {thingshort} sewn into the lining of {mhis} coat. {MHe} gave the medal to {comrade}\'s mother, and {thingshort} to the temple, and kept the limp.',
  ],
  'pre.irony': [
    'And {villain}? {VHe} went over the hills with the paymaster\'s chest, and changed {vhis} name, and was not heard of in {home} for {later} years; not until the night, long after, when {vhe} came back for {thingshort}, and found waiting for {vhim} an old soldier and {trade} called {hero} {last}.',
    '{mentor} grew old in {home}, as soldiers do who are lucky. {MHe} never married. {MHe} told the children no stories. But {mhe} kept {mhis} sword oiled, all those years, as if {mhe} knew; and in the end, {later} years later, {mhe} was proved right.',
  ],

  // ============================================================ a quest, again
  'sq.leave.together': [
    'They left {home} at first light, {hero} and {friend}, by the same road they had taken {years} years before. Neither of them said so. Neither of them needed to.',
    '{friend} packed for both of them, as {fhe} always did, and put in twice the bread and half the patience. "We are too old for this," {fhe} said at the gate. "Much too old," {hero} agreed, and they went.',
  ],
  'sq.leave.apart': [
    '{hero} went alone, this time. {He} wrote a letter to {friend} in {town2} before {he} went, and tore it up, and wrote another, shorter one, and sent that.',
  ],
  'sq.road': [
    'The road had changed in {years} years: there were new farms along it, and a bridge where there had been a ford, and an inn where they had once slept under a hedge. {hero} had changed too. {He} was slower than {he} had been, and wiser, {he} hoped, and a great deal more afraid.',
    'It is a strange thing to walk a road a second time. Every turning was where {hero} remembered it, and every one of them was wrong somehow, smaller, or nearer, or further off, as if the road had been quietly rearranged while {he} was away.',
  ],
  'sq.memory.dead': [
    'At the place where they had camped the first night, {years} years ago, {hero} stopped and stood for a while. {mentor} had sat just there, on that stone, and told them about {battle}. {hero} found that {he} could still hear {mhis} voice, and that it still told {him} to stop dawdling.',
  ],
  'sq.memory.alive': [
    '"Bring me back a story," old {mentor} had said at the gate, gripping {his} hand with surprising strength. "A good one. I am tired of my own." {hero} had promised. {He} meant to keep it, if {he} could.',
  ],
  'sq.arrive.same': [
    '{place} had not changed. That was the worst of it: {hero} had lived {years} years since {he} last stood here, and the dark at the mouth of it had not lived one day.',
  ],
  'sq.arrive.new': [
    '{place} lay {where}, and {hero} had never been there; but {he} knew the look of such places now, the stillness of them, the way the birds would not sing near the door. {He} lit the lamp with steady hands, and was proud of them.',
  ],
  'sq.below': [
    'Below, it was as {he} remembered, and worse. They heard {dwellers} in the dark ahead, and waited, and went round. {hero} found that {his} feet knew things {his} head had forgotten: where to tread, when to stop, how to breathe without making a sound.',
    'The passages went down further than any map of them, and the air grew warm, and then hot. Somewhere below them {dwellers} were moving, unhurried, as if they knew there was all the time in the world.',
  ],
  'sq.face.villain': [
    '{villain} was waiting in the deepest hall, older, thinner, greyer, and still smiling. "I said I would come back," {vhe} said. "I always keep my promises. It is my only virtue, and I am very proud of it."',
  ],
  'sq.face.caught': [
    '{villain} was waiting in the deepest hall. The cells at {capital} had not been kind to {vhim}; {vhe} was all bones and eyes now. "Did you think they could hold me?" {vhe} said. "I let them, for a while. I wanted time to think. I have thought."',
  ],
  'sq.face.kin': [
    '{villain2} was waiting in the deepest hall, with a lamp and a drawn sword and {vrel2} smile. "I was nine years old when they told me," {khe} said. "I have been coming here ever since. Every day of my life I have been walking towards this room."',
  ],
  'sq.face.deep': [
    'What waited at the bottom of {place} had no name in any book in {home}. It was very old, and very patient, and it had been waiting, {hero} understood, for {prevthing} to come back to it.',
  ],
  'sq.face.door': [
    'Behind the second door was a room nobody had entered since before {home} was founded. In the middle of it, on a block of stone, lay a book bound in something that was not leather, and around the walls, sitting very still, were the ones who had been set to guard it.',
  ],
  'sq.climax.villain': [
    'It ended where it had begun, in the dark under the ground, with the two of them face to face and nobody to see. {hero} did not remember drawing {his} blade. {He} remembered only {villain}\'s face at the very end, surprised, as if this were the one thing {vhe} had never planned for.',
    'In the end {hero} did not fight {vhim}. {He} sat down on the stone floor, and told {villain} everything that had happened in {home} in {years} years: the weddings, the harvests, the deaths. {villain} listened to all of it. When {hero} had finished, {vhe} put down {vhis} sword, and wept, and let {him} lead {vhim} out into the light.',
  ],
  'sq.climax.caught': [
    'This time there were no cells. {villain} went over the edge of the deep stair fighting, and {hero} heard {vhim} laughing all the way down.',
  ],
  'sq.climax.kin': [
    '{hero} would not fight {villain2}. {He} stood with {his} hands empty, and told {khim} the truth about {villain}: all of it, the good and the bad, the paymaster\'s chest and the two miles {vhe} had carried {mentor} at {battle}. When {he} had finished, {villain2} was crying, and the sword was on the floor.',
  ],
  'sq.climax.deep': [
    'There was no fighting it. In the end {hero} did the only thing {he} could think of: {he} spoke to it, as the {clergy} speak to {god}, and asked it to sleep. It looked at {him} for a long time. Then, very slowly, as a great tide goes out, it went back down into the dark.',
  ],
  'sq.climax.door': [
    '{hero} did not take the book. {He} had learned that much, at least. {He} bowed to the guardians, who did not move, and backed out of the room, and shut the second door behind {him}, and sealed it again with wax from {his} own candle.',
  ],

  // ============================================================ a mystery, again
  'sm.death': [
    'The second death came on a wet night in the autumn: {victim}, who had kept the temple rolls of {home} for thirty years, was found at the foot of the archive stair with {xhis} neck broken and the roll of {battle} gone from its box.',
    'It was {friend} who brought the news, white-faced, before breakfast: {victim}, the old captain of the watch, had been found dead in {xhis} own garden, and beside {xhim} on the bench stood a cup of tea, and the tea had been sweetened.',
  ],
  'sm.friend.together': [
    '{friend} put on {fhis} coat without a word. In {years} years {fhe} had never once let {hero} go asking questions alone, and {fhe} did not mean to start now.',
  ],
  'sm.friend.apart': [
    '{hero} wrote to {friend} in {town2} that same night. {He} did not expect an answer. On the third day {friend} was at the door, wet through, with a bag in {fhis} hand. "You will only make a fool of yourself," {fhe} said, "without me."',
  ],
  'sm.watch': [
    'The new captain of the watch was young and nervous and had heard all the stories. "I suppose," {khe2} said, "you will want to look at the body." {hero} said that {he} would, and the captain looked so relieved that {hero} felt sorry for {khim2}.',
    'This time the watch did not tell {him} to go home. This time they came to {his} door, cap in hand, and asked {him} to come. {hero} had imagined that moment for {years} years, and found that {he} did not enjoy it at all.',
  ],
  'sm.clue.villain': [
    'In {victim}\'s hand they found a brass button from a {enemy} soldier\'s coat, the twin of the one {mentor} had held {years} years before. {hero} had kept that one. {He} took it out of its box and laid the two side by side on the table, and knew that {villain} had come home.',
  ],
  'sm.clue.caught': [
    'The letter from {capital} said that {villain} had escaped in the spring. Nobody had thought to tell {home}. {hero} read it twice, and then went very quietly to the inn and asked who had taken a room there since the thaw.',
  ],
  'sm.clue.kin': [
    'The new schoolmaster had come to {home} in the summer, and was liked by everyone, and had {villain}\'s trick of tilting the head when listening. {hero} went through the hall rolls that night by candlelight until {he} found it: {villain2}, born in {town2}, the year after {battle}. {villain}\'s child.',
  ],
  'sm.clue.door': [
    'With the roll of {battle} gone, there was only one other copy: the one in the temple at {capital}. {hero} rode there in two days, and found it, and found the second scraped name written out in full: {villain2}. {He} knew the name. Everybody in {home} knew it.',
  ],
  'sm.clue.deep': [
    'The mill-race had given up {mentor}, {years} years before. Now, in the drought, it gave up something else: a box, long rotted, and in the box a soldier\'s papers in the name of {villain2}, who had been dead, the rolls said, since {battle}.',
  ],
  'sm.danger': [
    'On the fourth night someone came for {hero}. {He} had been waiting for it, and sat up in the dark with a lamp shuttered beside {him} and {friend} asleep in the chair, and when the door-latch lifted, very gently, {he} was ready.',
    'They tried to frighten {him} off, as they had the first time. But {hero} was older now, and harder to frighten, and when the stone came through the window {he} simply picked it up, read the note tied to it, and put it in {his} pocket as evidence.',
  ],
  'sm.reveal': [
    'At the end, as at the beginning, {hero} laid it all out before the council: the button, the tea, the rolls. "{villain2}," {he} said, and the name went round the hall like a draught. {villain2} stood up quite slowly, and looked at {him}, and said: "You took your time."',
    '"It was always about {battle}," {hero} said. "It always is, in {home}. Everyone who marched there came home with something, and some of them came home with secrets, and some of the secrets were worth killing for." {He} turned. "Were they not, {villain2}?"',
  ],

  // ============================================================ a romance, again
  'sr.trouble.villain': [
    'Trouble came, as it usually does, with a lawyer. {villain}, {vwhat}, had found an old deed in the hall, and the deed said that the orchard on the boundary belonged to neither family, but to the hall; and {villain} meant to have it.',
  ],
  'sr.trouble.kin': [
    'It was {friend} who finally opened old {mentor}\'s letter, the one from the year of {battle}. It was from the {town2} soldier, written the night before the battle, to a child in {town2}. And the child, the rolls said, was alive: an old {kman} now, living alone at the edge of {town2}, who had never been told how {kfather} died.',
  ],
  'sr.trouble.door': [
    'In the spring {hero} finally did what {he} had meant to do for {years} years, and went looking for the family of the {town2} soldier. {He} found them, in the end, in a cottage at the edge of {town2}, and the door was opened to {him} by {villain2}, who knew exactly who {he} was. {KHe} was the soldier\'s grandchild, and had a long memory, and a lawyer in {capital}; and {khe} had come, {khe} said, for what {home} owed {khis} family.',
  ],
  'sr.trouble.deep': [
    'The old people had been right: the water had not finished. It came again in the spring, higher than before, and this time it took the orchard.',
  ],
  'sr.trial': [
    'For a while it seemed that the old quarrel would wake again. There were words at the market, and a fight outside the inn, and in {town2} someone painted something on the {last} family\'s gate that {hero} had to scrub off before the children could read it.',
    'It was a hard year. There were nights when {hero} and {friend} sat on opposite sides of the hearth and did not speak, and nights when they spoke too much; and one night, near midwinter, when {friend} packed a bag, and set it by the door, and did not, in the end, pick it up.',
  ],
  'sr.help': [
    'Help came from where nobody expected it: from {town2}, from the same family that had once said they would sooner see {friend} married to a goat. They came over the bridge one morning with tools and timber and three days\' bread, and said nothing about it at all, then or ever.',
    'In the end it was the children who settled it, as children will, by refusing to take any notice of the quarrel whatsoever, and marrying into each other\'s families at such a rate that within a generation nobody could remember which side they were supposed to be on.',
  ],
  'sr.resolve.kin': [
    'In the spring {hero} and {friend} walked over to {town2} together and knocked at the old {kman}\'s door, and sat in {khis} kitchen, and told {khim} how {kfather} died at {battle}, carrying a {home} boy off the field. {KHe} listened without a word. When they had finished, {khe} got up, and put the kettle on, and asked them to stay for supper.',
  ],
  'sr.resolve.door': [
    'It was settled in the end without the lawyer. {hero} took {villain2} to the hall and showed {khim} the stone where the names of the dead of {battle} were cut, and the one name that had been left off it; and the council of {home}, shamed, sent for a mason that same afternoon.',
  ],
  'sr.resolve.villain': [
    'The deed, when the {clergy} of {god} finally read it through, turned out to have been written by {villain}\'s own grandfather, on the wrong side of the parchment, in the wrong year. {villain} left {home} that summer. Nobody asked where {vhe} went.',
  ],
  'sr.resolve.deep': [
    'They planted the orchard again on higher ground, both families together, a tree for every year since {battle}. It would be twenty years before it bore properly. Nobody minded. That was not what it was for.',
  ],
  'sr.end.together': [
    'On the evening of {feast} they walked out to the orchard together, {hero} and {friend}, slowly, because neither of them walked fast any more. The trees were in blossom on both sides of the wall. They stood there until it was dark, and then went home.',
  ],
  'sr.end.apart': [
    '{friend} came back to {home} that summer, after {years} years, a widow with grey in {fhis} hair and the same laugh. {hero} met {fhim} at the boundary wall. Neither of them said anything for a long time. Then {friend} said: "Your boots are still terrible," and {hero} laughed until {he} cried.',
  ],

  // ============================================================ a prequel, more of it
  'pre.town2': [
    'There was a soldier in the company from {town2}, {comrade} by name, who had a fiddle and a sweetheart and a joke for everything; and though {home} and {town2} had never loved each other, {mentor} found {mhim}self liking {chim} very much.',
  ],
  'pre.saved': [
    'At the worst of it, when the line broke, {mentor} saw {comrade} go back into the press for a {home} boy who had fallen: lift him, and carry him, and fall. The boy lived. {comrade} did not. {mentor} carried that sight home with {mhim}, and never set it down.',
  ],
  'pre.roll': [
    'It was {mentor} who carried the company roll home, with the dead marked on it and the deserters too. There was one name {mhe} looked at for a long time, by firelight, before {mhe} marked it. {villain}. {MHe} marked it, and folded the roll, and said nothing to anybody.',
  ],
  'pre.home.mystery': [
    'They came home in the autumn, fewer than had gone. {mentor} gave the roll into the keeping of the temple, and became, in time, a churchwarden, and a moneylender, and the most disliked person in {home}; and nobody ever knew why {mhe} watched the road so carefully.',
  ],
  'pre.home.romance': [
    'They came home in the autumn, and the {home} boy whom {comrade} had carried off the field was {mentor}\'s own younger brother. {mentor} never spoke of {comrade} again. {MHe} found it easier, in the end, to hate {town2} than to grieve for one of its sons.',
  ],
  'pre.irony.mystery': [
    'And {villain} came back too, in time, under another name, and was respected, and was trusted; and for {later} years {mentor} kept {mhis} secret, until the night {mhe} decided to keep it no longer, and somebody made {mhim} a cup of tea.',
  ],
  'pre.irony.romance': [
    'It would be {later} years before a grandchild of the {last} family danced with someone from {town2} at {feast}, and {mentor}, by then very old, would stand up in the hall and tell this story at last.',
  ],
  // ============================================================ (in a writer's own voice)
  'quest.open@plain': [
    '{hero} {last} lived in {home}. {He} was {trade}. {He} was {flaw}. Nothing had ever happened to {him}, and {he} did not expect it to.',
  ],
  'quest.open@pious': [
    'The {clergies} of {home} say that {god} chooses the least likely of us for the hardest roads, and if that is so, {god} could hardly have chosen less likely than {hero} {last}, {trade}, who was {flaw}.',
  ],
  'mystery.open@scholar': [
    'The facts, so far as they were ever established, are these. On the morning of {feast} the body of {mentor}, a veteran of {war} and a churchwarden of {god}, was recovered from the mill-race below {home}. It was found by {hero} {last}, {trade}, who was to spend the following weeks proving that it had not been an accident.',
  ],
  'mystery.open@storyteller': [
    'Now, everybody in {home} will tell you they knew old {mentor} would come to a bad end, and everybody in {home} is a liar. Nobody expected it, least of all {hero} {last}, {trade}, who found {mhim} face down in the mill-race on the morning of {feast} and dropped a whole basket of eggs.',
  ],
  'romance.open@lyrical': [
    'Between {home} and {town2} the river runs slow and brown, under willows, and on summer evenings the bells of both towns can be heard across it at once, a little out of time with each other, like two people who will not walk in step.',
  ],
  'romance.open@plain': [
    'The {last} family of {home} did not speak to anyone from {town2}. Nobody remembered why. {hero} {last} had never questioned it, until {feast} in {year}.',
  ],
  'quest.home2.mdead@pious': [
    'They came home to {home} on the eve of the first frost, and went first of all to the temple of {god}, before they had eaten or washed, to give thanks; and the {clergy} said the prayers for the dead over an empty bier, for {mentor}, who lay far under the ground at {place}.',
  ],
  'seq.end@lyrical': [
    'And so it ended, as such things end, not with a shout but with a long road home in the rain, and a light in a window, and someone at the door who had been waiting, and did not ask, and put the kettle on.',
  ],
  'seq.end@plain': [
    'It was over. {hero} went home. {He} did not go looking for trouble again.',
  ],
  'pre.open@pious': [
    'In the year that {war} began, {mentor} was seventeen, and knelt in the temple of {god} the night before the muster and asked to be made brave. {MHe} did not know then that {god} answers such prayers, but seldom in the way they are meant.',
  ],
  'mystery.close@storyteller': [
    'They buried {mentor} in the temple yard, and more people came than ever spoke to {mhim} alive, which is the way of it. {hero} stood at the back with {friend}. "{MHe} would have hated this," {friend} whispered. "All these people." "{MHe} would have counted them," said {hero}, "and sent them each a bill."',
  ],
};

// The chapters of each kind of story: [title, [beats]]. A beat's pool is
// `${kind}.${beat}` (or the beat as written, if it names its own pool);
// beats that turn on how the story went are named for it by novels.js
// (see OUTCOME there): "dark" is "quest.dark.mdead" or "quest.dark.mlive".
export const PLOTS = {
  quest: [
    ['{titlething}', ['open', 'home', 'theft', 'blame', 'mentor', 'choice']],
    ['The Road {way}', ['leave', 'road', 'camp', 'sign']],
    ['{titleplace}', ['arrive', 'descent', 'trap', 'villain']],
    ['In the Dark', ['dark', 'alone', 'resolve']],
    ['The Way Out', ['climax', 'after', 'home2', 'end']],
  ],
  mystery: [
    ['A Death at {feast}', ['open', 'scene', 'watch']],
    ['Questions', ['friend', 'suspects', 'clue']],
    ['The Wrong Door', ['wrong', 'danger']],
    ['What the Roll Said', ['reveal', 'climax', 'close', 'end']],
  ],
  romance: [
    ['{feast}', ['open', 'meet', 'feud', 'feud2']],
    ['The Boundary Wall', ['secret', 'found']],
    ['Winter', ['apart', 'crisis']],
    ['The Orchard', ['grandmother', 'climax', 'end']],
  ],
  // (A sequel picks up the thread: what's become of them all, and what
  // calls the hero back; then its own story; then the end of it.)
  'sequel.quest': [
    ['{years} Years On', ['seq.open', 'seq.friend', 'seq.mentor', 'seq.call']],
    ['The Road Again', ['sq.leave', 'sq.road', 'sq.memory']],
    ['{titleplace}', ['sq.arrive', 'sq.below', 'sq.face']],
    ['The Last of It', ['sq.climax', 'seq.end']],
  ],
  'sequel.mystery': [
    ['{years} Years On', ['seq.open', 'seq.friend', 'seq.mentor']],
    ['Another Death', ['sm.death', 'sm.friend', 'sm.watch']],
    ['Old Rolls', ['sm.clue', 'sm.danger']],
    ['The Answer', ['sm.reveal', 'seq.end']],
  ],
  'sequel.romance': [
    ['{years} Years On', ['seq.open', 'seq.friend', 'seq.mentor']],
    ['Trouble', ['sr.trouble', 'sr.trial']],
    ['The Bridge', ['sr.help', 'sr.resolve', 'sr.end']],
  ],
  'prequel.quest': [
    ['The Muster', ['pre.open', 'pre.muster']],
    ['The March', ['pre.march', 'pre.villain']],
    ['{battletitle}', ['pre.battle', 'pre.betrayal']],
    ['Home', ['pre.thing', 'pre.home', 'pre.irony']],
  ],
  'prequel.mystery': [
    ['The Muster', ['pre.open', 'pre.muster']],
    ['The March', ['pre.march', 'pre.villain']],
    ['{battletitle}', ['pre.battle', 'pre.betrayal']],
    ['The Roll', ['pre.roll', 'pre.home.mystery', 'pre.irony.mystery']],
  ],
  'prequel.romance': [
    ['The Muster', ['pre.open', 'pre.muster.romance']],
    ['The March', ['pre.town2', 'pre.march']],
    ['{battletitle}', ['pre.battle', 'pre.saved']],
    ['Home', ['pre.home.romance', 'pre.irony.romance']],
  ],
};
