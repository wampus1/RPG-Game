// (Round 147) What's said of a town's great places (see world/quarters and
// sim/cities.js): what's on at them today and whether you're going, how
// the last of it went, what's been called off and why; and what those who
// work there have to say of their work. Facts: qOn (the kind of the next
// of today's doings not yet over), qNow (it's on now), qOff ('siege' or
// 'rain'), qPast (the kind of the last, within a couple of days), qCheers
// (the last play cheered), qCrowd (the next draws a crowd), qJob (their
// place at one), qFan (one of those who'd talk of it), qThere (in the crowd
// there now). See talk/facts.js.
//
// (A first word or a remark in passing about them is worth a little more
// than the guards they're written with: enough to be said, never over
// how someone feels.)
const RULES = [];
const R = (id, topic, when, lines, o = {}) => RULES.push({ id, topic, when, lines, bonus: topic === 'open' || topic === 'greet' ? 1 : 0, ...o });

// ============================================================ open
// ---- what's on today
R('q_on_games', 'open', { qOn: 'games', qFan: true }, [
  'Games at {qPlace} today, {name}! First bout at {qAt}. {.}You\'ll come, won\'t you?',
  '{wg:The games!} {qAt} at {qPlace}. I\'ve not missed a card in years.',
  'There\'s a title bout on today, they say. Or there might be. {.}Either way, {qAt}.',
]);
R('q_on_races', 'open', { qOn: 'races', qFan: true }, [
  'Racing at {qPlace} from {qAt}. {.}I\'ve a tip, if you want it. {.}No? Suit yourself.',
  'Race day! The whole town smells of horse.',
  '{w:Off at {qAt}.} I\'ve got my coin on a grey. {.}I always back the grey.',
]);
R('q_on_play', 'open', { qOn: 'play', qFan: true }, [
  'They\'re putting on "{qShow}" tonight. {qAt}, at {qPlace}.',
  'Have you a seat for "{qShow}"? I hear the lead\'s new. {.}And nervous.',
  'A play tonight! I\'ll be the one weeping in the back row.',
]);
R('q_on_service', 'open', { qOn: ['service', 'feast'], qFan: true, devout: true }, [
  '{qShow} at {qAt}. You\'d be welcome, {name}. {.}Everyone is.',
  'I\'ll see you at {qPlace}? {qAt}. Bring nothing but yourself.',
]);
R('q_on_auction', 'open', { qOn: 'auction', qFan: true }, [
  'There\'s an auction at {qPlace}, {qAt}. Things nobody needs, at prices nobody can pay.',
  'Go and look at the lots before {qAt}. I saw a gold circlet, I swear.',
]);
R('q_on_expedition', 'open', { qOn: 'expedition', qFan: true }, [
  '{t:The delvers go down today.} {.}I always count them coming back up.',
  'They\'re going down again at {qAt}. {.}Brave or mad. I\'ve never decided which.',
]);
R('q_on_any', 'open', { qOn: true, qCrowd: true, qFan: true }, [
  '{qShow} at {qPlace} today, {qAt}. Half the town will be there.',
  'You\'re here for {qShow}, I suppose? {qAt}. Everyone is.',
  'There\'s {qShow} at {qAt}, if you\'ve nothing better to do. {.}I haven\'t.',
]);
R('q_now', 'open', { qOn: true, qNow: true, qCrowd: true, qFan: true, qThere: false }, [
  '{qShow}\'s on {g:right now}, at {qPlace}. What are you doing here?',
  'Can\'t stop, {name}! {qShow}\'s started without me!',
], { bonus: 0.5 });
R('q_there', 'open', { qNow: true, qThere: true }, [
  'Isn\'t this something? {.}Sit, sit, you\'re blocking the view.',
  '{w:Best seat in the house, this.} Well. Second best. You\'re in the best.',
  'Shh! {.}Oh, it\'s you. {c:*whispers*} Glad you came.',
]);
// ---- called off
R('q_off_siege', 'open', { qOff: 'siege' }, [
  '{d:No {qOffShow} today.} Not with them camped outside the walls.',
  '{t:Who\'d sit in the stands with an army at the gate?} They\'ve called it off.',
  '{d:They called off {qOffShow}.} {.}The temple\'s full, though. Funny, that.',
]);
R('q_off_rain', 'open', { qOff: 'rain', qFan: true }, [
  '{d:They\'ve called off {qOffShow}.} This weather.',
  'All that rain, and now no {qOffShow}. {.}{d:I\'d already told everyone I\'d win.}',
  '{d:Put off for the weather.} I\'d my good boots on, too.',
]);
// ---- how the last went
R('q_past_games', 'open', { qPast: 'games', qFan: true }, [
  'Were you at the games? {qRes}! {.}{w:I\'m still hoarse.}',
  '{qRes}. {.}Nobody saw that coming. Well. I did. {.}I\'d have bet on it, if I\'d had the coin.',
]);
R('q_past_races', 'open', { qPast: 'races', qFan: true }, [
  '{qRes}. I had my money on the other one. {.}Of course I did.',
  'Did you see the racing? {qRes}! {w:What a finish.}',
]);
R('q_past_play_cheers', 'open', { qPast: 'play', qCheers: true, qFan: true }, [
  '"{qPastShow}"! {w:They cheered the roof off.} I cried twice.',
  'You missed "{qPastShow}"? {.}Oh, {name}. It was {w:wonderful}.',
]);
R('q_past_play_jeers', 'open', { qPast: 'play', qCheers: false, qFan: true }, [
  '"{qPastShow}"? {d:I want my evening back.}',
  'Somebody threw a cabbage at the lead in "{qPastShow}". {.}It was me. {.}It was deserved.',
]);
// ---- their work there
R('q_job_gladiator', 'open', { qJob: 'gladiator' }, [
  'The sand doesn\'t care who you were, {name}. Only who\'s standing at the end.',
  '{g:Come and watch me fight.} Or fight me yourself, if you\'ve the nerve.',
  'Every scar\'s a crowd I sent home happy.',
]);
R('q_job_gladiator_on', 'open', { qJob: 'gladiator', qOn: 'games' }, [
  '{t:I fight today.} {.}Bet on me, or against me. Just come.',
  'I\'m on the card at {qAt}. {.}If I don\'t see you after, {c:remember me kindly}.',
]);
R('q_job_lanista', 'open', { qJob: 'lanista' }, [
  'Fighters are like knives, {name}. Keep them sharp, keep them fed, and never trust one.',
  'Looking for work? The school always needs someone who can take a hit.',
]);
R('q_job_bookie', 'open', { qJob: 'bookie' }, [
  'Odds on anything, {name}. {.}Anything at all.',
  'The house always wins. {.}{c:I\'m the house.}',
]);
R('q_job_delver', 'open', { qJob: 'delver' }, [
  '{d:Down again soon.} Every time a few less come back up.',
  'You hear things down there. {.}{t:Breathing, sometimes. Not ours.}',
  'Rope, lamp, nerve. {.}Lose any one of them and you don\'t come up.',
]);
R('q_job_delver_on', 'open', { qJob: 'delver', qOn: 'expedition' }, [
  '{t:We go down at {qAt}.} {.}Say a word for us, would you?',
]);
R('q_job_surgeon', 'open', { qJob: 'surgeon' }, [
  'What the delve sends back up, I stitch. {.}When there\'s enough to stitch.',
]);
R('q_job_actor', 'open', { qJob: 'actor' }, [
  'Lines, lines, lines. {.}Don\'t ask me how the second act goes.',
  '{w:All the town\'s a stage, {name}!} {.}Mine just has better lighting.',
]);
R('q_job_actor_on', 'open', { qJob: 'actor', qOn: 'play' }, [
  '{t:"{qShow}" tonight.} {.}I\'ve been sick twice already. It\'s lucky, they say.',
]);
R('q_job_musician', 'open', { qJob: 'musician' }, [
  'Hum me something and I\'ll play it back to you. {.}Better.',
]);
R('q_job_jockey', 'open', { qJob: 'jockey' }, [
  'Light as a feather, me. {.}Haven\'t had a proper supper in years.',
  'Horses know if you\'re afraid. {.}So I\'m never afraid.',
]);
R('q_job_groom', 'open', { qJob: 'groom' }, [
  'Mind the grey. {.}She bites. {.}She likes you, though, I can tell.',
]);
R('q_job_vintner', 'open', { qJob: 'vintner' }, [
  'A good year, this. {.}I say that every year. {.}This year I mean it.',
  'Wine\'s just patience in a barrel, {name}.',
]);
R('q_job_beekeeper', 'open', { qJob: 'beekeeper' }, [
  'Move slowly round the hives. {.}They don\'t mind you if you don\'t mind them.',
]);
R('q_job_astronomer', 'open', { qJob: 'astronomer' }, [
  'Up all night again. {.}The sky\'s not going to chart itself.',
]);
R('q_job_monk', 'open', { qJob: ['monk', 'cleric'] }, [
  '{@slow}Peace on you, {name}. {.}Stay a while, if your road allows.',
]);
R('q_job_attendant', 'open', { qJob: 'attendant' }, [
  'The water\'s hot today. {.}Leave your troubles with your boots.',
]);
R('q_job_gardener', 'open', { qJob: 'gardener' }, [
  'Mind the beds. {.}I\'ve been coaxing those roses since spring.',
]);
R('q_job_founder', 'open', { qJob: ['founder', 'smith'] }, [
  'Hot work, {name}. {.}You get used to it. Or you don\'t, and you go and keep bees.',
]);
R('q_job_sellsword', 'open', { qJob: 'sellsword' }, [
  'Need a blade? {.}Coin first. Always coin first.',
]);
R('q_job_auctioneer', 'open', { qJob: 'auctioneer' }, [
  'Everything has a price, {name}. {.}My job\'s to find out how much higher it is than you think.',
]);
R('q_job_antiquarian', 'open', { qJob: 'antiquarian' }, [
  'Whoever built these walls knew things we\'ve forgotten. {.}I mean to find out what.',
]);
R('q_job_showman', 'open', { qJob: ['showman', 'fortuneteller'] }, [
  '{w:Roll up, roll up!} {.}Oh, it\'s you. Roll up anyway.',
]);

// ============================================================ greet
R('q_g_on', 'greet', { qOn: true, qCrowd: true, qFan: true }, ['{qShow} at {qAt}!', 'See you at {qPlace}?']);
R('q_g_now', 'greet', { qOn: true, qNow: true, qCrowd: true, qFan: true }, ['{wg:Hurry, it\'s started!}', '{@fast}Can\'t stop!']);
R('q_g_off', 'greet', { qOff: ['siege', 'rain'], qFan: true }, ['{d:Called off. Typical.}', '{d:No {qOffShow} today.}']);

// ============================================================ bark
R('q_b_games', 'bark', { qNow: true, qThere: true, qOn: 'games' }, ['{wg:Come on!}', '{sr:Get up! GET UP!}', '{wg:Again! Again!}']);
R('q_b_races', 'bark', { qNow: true, qThere: true, qOn: 'races' }, ['{wg:Go on, go on, GO ON!}', '{wg:Look at the grey run!}']);
R('q_b_play', 'bark', { qNow: true, qThere: true, qOn: 'play' }, ['{c:*whispers* Shh, this is the good part.}', '{w:Bravo!}']);

// ============================================================ pair
R('q_p_games', 'pair', { qPast: 'games', kid: false }, [
  'Were you at the games? || {qRes}. I was there. I\'ve still got sand in my teeth.',
  'Did you hear how the games went? || {qRes}. {.}I lost a week\'s pay on it.',
]);
R('q_p_races', 'pair', { qPast: 'races', kid: false }, [
  'Any luck at the racing? || {d:{qRes}.} {.}Does that sound like luck to you?',
]);
R('q_p_play', 'pair', { qPast: 'play', kid: false }, [
  'Did you see "{qPastShow}"? || I did. {.}I\'ve been humming the songs ever since.',
]);
R('q_p_off', 'pair', { qOff: ['siege', 'rain'], kid: false }, [
  'No {qOffShow} today, then. || {d:No. Nothing to do but stare at the walls.}',
]);
R('q_p_on', 'pair', { qOn: true, qNow: false, qCrowd: true, kid: false }, [
  'Going to {qShow}? || Wouldn\'t miss it. {qAt}, isn\'t it?',
  'Are you going to {qPlace} later? || If the work lets me. It never does.',
]);

export { RULES };
