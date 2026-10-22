// (Round 135) Lines for the moment (see talk/rules.js): when each is said,
// and how (marks for the letters: see ui/textfx.js).
//
// Topics:
//   open   their first words when you start talking
//   greet  a remark as you pass
//   feel   "How are you?" (how they really are)
//   skill  "What are you good at?" (what they can do, and might)
//   jest   your joke landed; jest_flat: it didn't
//   bark   said to nobody in particular (in the tavern, at home, about town)
//   pair   two of them talking ("opener || reply")
// Third persons are named, never he or she.
const RULES = [];
const R = (id, topic, when, lines, o = {}) => RULES.push({ id, topic, when, lines, ...o });
const strong = { min: 0.5 };
const some = { min: 0.3 };

// ============================================================ open
// ---- grief
R('o_grief_partner', 'open', { mem_loss: (m) => m && m.x === 'partner', grief: strong }, [
  '{@slow}{c:Oh. {name}.} {.}Sorry. I keep thinking I hear {dead} at the door.',
  '{@slow}{c:I set two cups out this morning.} {.}Habit. {dead} always took the chipped one.',
  '{@crawl}{c:Forgive me. Since {dead} went, the days don\'t hold together.}',
  '{@slow}{c:Everyone keeps telling me it gets easier.} {.}When?',
]);
R('o_grief_child', 'open', { mem_loss: (m) => m && m.x === 'child', grief: strong }, [
  '{@crawl}{c:...}{.} {c:{dead} would have been running about in this weather.}',
  '{@slow}{c:You\'ll forgive me. I can\'t talk long. {.}I keep going to wake {dead}.}',
  '{@crawl}{c:Nobody should bury their own child, {name}.} {.}Nobody.',
]);
R('o_grief_parent', 'open', { mem_loss: (m) => m && m.x === 'parent', grief: some }, [
  '{@slow}{c:I\'m sorry, I\'m not myself.} {dead} used to know just what to say on a day like this.',
  '{@slow}Strange, being nobody\'s child any more. {.}{c:I miss {dead}.}',
  '{@slow}I found {dead}\'s old pipe today. Still smells of that awful tobacco. {.}{c:I sat with it an hour.}',
]);
R('o_grief_friend', 'open', { mem_loss: (m) => m && ['friend', 'sibling', 'household'].includes(m.x), grief: some }, [
  '{@slow}{c:Hello. {.}Sorry, I was miles away. Thinking about {dead}.}',
  '{@slow}It\'s quieter without {dead}. I didn\'t think one voice could make that much difference.',
  '{@slow}{dead} owed me a game of dice. {.}{c:Now I\'ll never collect.}',
]);
R('o_grief_any', 'open', { feel: 'grief', grief: strong }, [
  '{@slow}{c:Oh. Hello.} {.}It\'s been a hard few days.',
  '{@slow}{c:Sorry. I\'m not good company just now.}',
  '{@crawl}{c:...Hm? Oh.} Forgive me, {name}.',
]);
// ---- fear
R('o_fear_raid', 'open', { mem_raid: true, fear: some }, [
  '{t:W-who\'s that?} {.}Oh. You. Sorry. Since the raid, every footstep\'s a bandit.',
  '{@fast}{t:Did you see anyone on the road? Anyone with blades?} No? {.}Good. Good.',
  '{t:I sleep with the poker by the bed now.} Laugh if you like.',
  '{@fast}{t:They came right up to the doors last time.} I keep the shutters barred now.',
]);
R('o_fear_war', 'open', { mem_war: true, fear: some }, [
  '{t:Is it true the armies are on the move?} Tell me straight, {name}.',
  '{@fast}{t:War. Again.} {.}My grandparents talked about the last one. I never thought I\'d see it.',
  '{t:They say the levies will take every pair of hands that can hold a spear.} I\'m not a fighter.',
]);
R('o_fear_killer', 'open', { heard_killed: true, fear: some }, [
  '{@fast}{t:Someone was killed, here, in {town}.} Do you know anything about it?',
  '{t:They say there\'s a killer about.} I\'m not walking home alone tonight.',
]);
R('o_fear_eruption', 'open', { mem_eruption: true, fear: some, island: 'kharos' }, [
  '{t:Did you feel it last night? The ground, I mean.} The mountain\'s awake.',
  '{@fast}{t:Ash on the windowsills again.} If it blows properly, there\'ll be no outrunning it.',
]);
R('o_fear_any', 'open', { feel: 'fear', fear: strong }, [
  '{@fast}{t:Oh! You startled me.}',
  '{t:Is something coming? You look like you\'ve seen something.}',
  '{@fast}{t:Keep your voice down.} {.}Sorry. I\'m on edge.',
]);
// ---- anger
R('o_anger_killer_kin', 'open', { memPk: 'killed', anger: some }, [
  '{sr:You.} {.}{r:You killed {killed}. And you come here, to me, and want to talk?}',
  '{@fast}{sr:Get away from me! Murderer!}',
  '{r:I see {killed}\'s face every night. And then I see yours.}',
]);
R('o_anger_hurt', 'open', { memPk: 'hurt', anger: some }, [
  '{r:Back for another go, are you?} I\'ve still got the bruise.',
  '{@fast}{sr:Keep your hands where I can see them!}',
  '{r:You struck me. In my own town.} I\'ve not forgotten.',
]);
R('o_anger_insult', 'open', { memPk: 'insult', anger: some }, [
  '{r:Oh, it\'s you. Come to insult me again?}',
  '{r:I\'ve been thinking of all the things I should have said to you.} Shall I start?',
  'Well, if it isn\'t the one with the {r:sharp tongue}.',
]);
R('o_anger_robbed', 'open', { mem_robbed: true, anger: some }, [
  '{r:Robbed!} On the open road, {name}. In broad day. And the guards shrug.',
  '{@fast}{sr:If I ever see those bandits again, I swear...}',
  '{r:Every coin I had for the month, gone.} Don\'t tell me to be grateful I\'m alive.',
]);
R('o_anger_raid', 'open', { mem_raid: (m) => m && m.x === 'lost', anger: some }, [
  '{r:They took the winter stores. All of it.} And where was the watch?',
  '{@fast}{sr:Bandits! In our streets!} Somebody has to do something.',
]);
R('o_anger_tax', 'open', { taxHigh: true, anger: some, kid: false }, [
  '{r:Have you seen the taxes?} The council must think we shovel gold out of the river.',
  '{r:Another tithe, another levy.} There\'s nothing left at the end of the week.',
]);
R('o_anger_any', 'open', { feel: 'anger', anger: strong }, [
  '{@fast}{r:What.}',
  '{r:Not now. I\'m in no mood.}',
  '{@fast}{sr:Whatever it is, make it quick!}',
  '{r:Don\'t take it personally. It\'s not you.} {.}This time.',
]);
// ---- shame
R('o_shame_exiled', 'open', { mem_exiled: true, shame: some }, [
  '{@slow}{d:You\'ve heard, I suppose. Everyone has.}',
  '{@slow}{d:I don\'t want to talk about it. Any of it.}',
]);
R('o_shame_guard', 'open', { job: 'guard', mem_raid: (m) => m && m.x, shame: some }, [
  '{@slow}{d:We should have held them at the gate.} I should have.',
  '{d:Don\'t look at me like that.} I know we failed.',
]);
R('o_shame_any', 'open', { feel: 'shame', shame: strong }, [
  '{@slow}{d:Oh. Hello.} {.}I was hoping not to see anyone today.',
  '{@slow}{d:Please don\'t ask.}',
]);
// ---- joy and pride and love
R('o_joy_wed', 'open', { mem_wed: true, joy: some }, [
  '{wg:{name}! I\'m married!} {.}Still doesn\'t sound real. {spouse} and me!',
  '{wg:Have you heard? {spouse} and I were wed!} Come and have a drink with us.',
  '{w:Married life suits me.} Ask {spouse}, ask anyone!',
]);
R('o_joy_born', 'open', { mem_born: true, joy: some }, [
  '{wg:A baby! {child}! Come and see, come and see!}',
  '{w:I\'ve not slept in three days and I don\'t care at all.} {child} has the tiniest hands.',
  '{wg:{child} smiled at me this morning!} Or it was wind. I\'m choosing smile.',
]);
R('o_joy_grandchild', 'open', { mem_grandchild: true, joy: some }, [
  '{wg:I\'m a grandparent!} Little {child}. I feel a hundred years old and twelve at once.',
  '{w:Have you met {child} yet?} The spit of my own mother, I swear it.',
]);
R('o_pride_master', 'open', { mem_mastery: (m) => m && m.s >= 0.8, pride: some }, [
  '{g:You\'re talking to a master now, I\'ll have you know.} Took me long enough.',
  '{g:They\'re calling me the best in {town}.} I try not to let it go to my head. I fail.',
  '{wg:Years at it, and finally it clicked.} You should see what I can do now.',
]);
R('o_pride_step', 'open', { mem_mastery: true, pride: some, kid: false }, [
  '{g:I\'m getting good at this, you know.} Really good.',
  '{g:Did a fine day\'s work yesterday.} Best I\'ve done.',
  'Ask anyone about my {trade} work these days. {g:Go on, ask.}',
]);
R('o_pride_grown', 'open', { mem_grown: true, pride: some }, [
  '{g:I\'m a {trade} now!} A real one, with pay and everything.',
  '{wg:First week at work!} My arms ache and I love it.',
]);
R('o_pride_won_war', 'open', { mem_won_war: true, pride: some }, [
  '{g:We won! The war\'s over and we won!}',
  '{g:They\'ll write songs about this year.} Mark me.',
]);
R('o_pride_raid_beaten', 'open', { mem_raid_beaten: true, job: 'guard', pride: some }, [
  '{g:You should have seen it. We sent those bandits running!}',
  '{g:Not one of them got past the gate.} Not one.',
]);
R('o_pride_chosen', 'open', { mem_chosen: true, pride: some }, [
  '{g:Mayor!} Me! I keep signing my name with the title just to see it.',
  '{g:The town chose me.} I mean to deserve it.',
]);
R('o_love_any', 'open', { feel: 'love', love: strong, partnered: true }, [
  '{p:Isn\'t it a lovely day?} Everything\'s lovely today.',
  'Sorry, I\'m distracted. {p:Somebody kissed me goodbye this morning.}',
]);
R('o_joy_feast', 'open', { mem_feast: true, joy: some }, [
  '{w:What a do that was!} My head\'s still ringing.',
  '{wg:Wasn\'t the feast grand?} I danced till I couldn\'t feel my feet.',
]);
R('o_joy_any', 'open', { feel: 'joy', joy: strong }, [
  '{wg:{name}! Isn\'t it a wonderful {tw}?}',
  '{w:Hello, hello!} Can\'t stop smiling today.',
  '{wg:Good {tw}! Good everything!}',
]);
// ---- strain
R('o_strain_hungry', 'open', { starving: true }, [
  '{@slow}{d:Sorry. I\'ve not eaten properly in days.} It\'s hard to think.',
  '{t:You wouldn\'t have a crust, would you?} No, never mind. Sorry.',
]);
R('o_strain_any', 'open', { strain: strong }, [
  '{@slow}I\'m so tired, {name}. Everything at once, all the time.',
  '{@slow}Don\'t mind me. Long week. Long month, if I\'m honest.',
  '{d:If one more thing goes wrong today, I\'m going to sit down in the road and stay there.}',
]);
// ---- memories of you
R('o_saved', 'open', { memPk: 'saved', kid: false }, [
  '{wg:{name}!} I tell everyone. You saved my life.',
  '{w:There\'s my hero.} Anything you need, you only have to ask.',
  'I light a candle for you, you know. Every week. {p:For saving me.}',
]);
R('o_saved_kid', 'open', { memPk: 'saved', kid: true }, [
  '{wg:You\'re the one who saved me!} I told everyone at school!',
  '{w:When I grow up I\'m going to be brave like you.}',
]);
R('o_gift_thanks', 'open', { memPk: 'gift', op: { min: 10 } }, [
  'I still have the {gift} you gave me. {p:I think of you every time.}',
  '{name}! I meant to thank you again for the {gift}.',
  'You know, nobody had given me anything in years before that {gift}.',
]);
R('o_comforted', 'open', { memPk: 'comforted' }, [
  'You were kind to me when I needed it. {p:I haven\'t forgotten.}',
  '{name}. You listened, that day. Most people don\'t.',
]);
R('o_heard_good', 'open', { heardPk: ['saved', 'gift', 'comforted'], met: false }, [
  'You\'re {name}, aren\'t you? I\'ve heard good things.',
  'Ah, you\'re the one folk keep talking about. {w:All good, don\'t worry.}',
]);
R('o_heard_killer', 'open', { heardPk: 'killed', opBand: ['dislike', 'hate', 'neutral'] }, [
  '{t:I know who you are.} Everyone in {town} knows what you did to {killed}.',
  '{@fast}{t:Stay back. I\'ve heard about you.}',
]);
R('o_heard_hurt', 'open', { heardPk: ['hurt', 'insult'], met: false }, [
  'I\'ve heard about you. Picking fights, they say.',
  'Folk say you\'ve a temper. {r:Don\'t try it with me.}',
]);
// ---- how you look
R('o_hurt', 'open', { hurt: true, kid: false }, [
  '{t:You\'re hurt!} Sit, sit down. Do you need the healer?',
  'Gods, look at you. {t:Who did this?}',
  'You\'re bleeding on my step, {name}. {.}Here, take this rag.',
  'You look half dead. {d:Is it as bad as it looks?}',
]);
R('o_hurt_kid', 'open', { hurt: true, kid: true }, [
  '{t:You\'ve got blood on you!} Does it hurt? Mum! MUM!',
  'Whoa. Did you fight a monster? {w:Was it a big one?}',
]);
R('o_dying_healer', 'open', { dying: true, job: ['herbalist', 'priest'] }, [
  '{@fast}{t:Don\'t move.} Let me see. {.}You\'re lucky you walked in when you did.',
  '{@fast}{sr:Lie down! Now!} You\'ve no business standing.',
]);
R('o_wet', 'open', { wet: true, indoors: false, kid: false }, [
  'You\'re soaked through! Come in out of it.',
  'You look like something the river coughed up, {name}.',
  'Dripping on my boots, that is. {w:Ha!} Here, stand by the fire.',
]);
R('o_swimming', 'open', { swimming: true }, [
  'Are you... talking to me from the water?',
  'Nice day for a swim, is it? {w:Rather you than me.}',
]);
R('o_snowy', 'open', { snowy: true, kid: false }, [
  'You\'ve snow in your hair. Brush it off before it melts down your neck.',
  '{t:Brr.} You look frozen. Stamp your feet, it helps.',
]);
R('o_armed_drawn', 'open', { armed: true, kid: false, op: { max: 30 } }, [
  '{t:Put that away before you talk to me.}',
  'You always greet folk with a blade in your hand? {r:Put it down.}',
  'There\'s no call for that here. {d:Sheathe it, please.}',
]);
R('o_armed_kid', 'open', { armed: true, kid: true }, [
  '{wg:Is that a real sword? Can I hold it?}',
  'Whoa. Have you killed a dragon with that?',
]);
R('o_armed_guard', 'open', { armed: true, job: 'guard', onWatch: false, op: { max: 20 } }, [
  'Keep that blade where I can see it, {name}.',
  '{r:Steel out in the street?} Sheathe it, or I\'ll do it for you.',
]);
R('o_armoured', 'open', { armoured: true, kid: false, job: ['guard', 'blacksmith'] }, [
  'Good iron, that. Someone knew what they were doing.',
  'That plate\'s seen some knocks. Want it beaten out?',
]);
R('o_fine', 'open', { fine: true, kid: false, poorTown: true }, [
  'Fine clothes for a place like {town}. Mind your purse.',
  'Ooh, look at the gentry. {d:Lost, are we?}',
]);
R('o_ragged', 'open', { ragged: true, kid: false }, [
  'You look like you\'ve slept in a ditch. {d:Have you?}',
  'Where are your clothes, {name}? Don\'t tell me. I don\'t want to know.',
]);
R('o_rich', 'open', { rich: true, job: ['merchant', 'innkeeper', 'barkeep', 'beggar'] }, [
  'Your purse is singing, {name}. I can hear it from here.',
  '{w:Ah, a customer of means!} Come in, come in.',
]);
R('o_broke_beggar', 'open', { broke: true, job: 'beggar' }, [
  'Hah. You look about as rich as me. Sit down, there\'s room on the step.',
  'Empty pockets too? {w:Welcome to the club.}',
]);
R('o_flower', 'open', { holdingFlower: true, kid: false }, [
  'A flower! Who\'s that for, then? {p:Go on, tell me.}',
  'That\'s pretty. Picked it yourself?',
]);
R('o_food_hungry', 'open', { holdingFood: true, hungry: true }, [
  '{t:Is that food?} Sorry. I\'ve not eaten. It smells so good.',
  'You\'re not going to eat that in front of me, are you? {d:Please.}',
]);
R('o_book', 'open', { holdingBook: true, job: ['scholar', 'researcher', 'priest'] }, [
  'Oh, what are you reading? {w:Let me see the spine.}',
  'A reader! Rare as hens\' teeth in {town}.',
]);
R('o_mounted', 'open', { mounted: true, kid: false }, [
  'Fine beast. Don\'t let it eat my cabbages.',
  'You could climb down to talk, you know. My neck\'s getting a crick.',
]);
R('o_mounted_kid', 'open', { mounted: true, kid: true }, [
  '{wg:A horse! What\'s its name? Can I stroke it?}',
]);
R('o_fighting', 'open', { fighting: true, kid: false }, [
  '{@fast}{t:Was that fighting? Just now?} Is it over?',
  'You\'re breathing hard, and there\'s blood on your boots. {t:What happened?}',
]);
// ---- who you are
R('o_out_first', 'open', { outworlder: true, met: false, kid: false }, [
  'Your skin... {t:what are you?} No offence. I\'ve just never seen the like.',
  'You\'re the one who fell from the sky in that burning pod. {d:Aren\'t you.}',
  'Folk say you came from beyond the stars. {t:Is it true? Is it cold out there?}',
  'I\'ll be honest, {name}: you frighten people. Give us time.',
], { once: true });
R('o_out_kid', 'open', { outworlder: true, kid: true }, [
  '{wg:Are you from the stars? Is your mum a star?}',
  'Can you do magic? You look like you can do magic.',
  'My friend says you eat children. {w:Do you?} I don\'t think you do.',
]);
R('o_out_mut', 'open', { outworlder: true, mutated: true, met: true, kid: false, op: { min: 20 } }, [
  'I\'m getting used to your {mut}, you know. Almost don\'t notice it.',
  'Does the {mut} hurt? I\'ve always wondered. You don\'t have to say.',
]);
R('o_out_gills', 'open', { mut_gills: true, wet: false, kid: false }, [
  'You look dry. Is that bad for you? With the... the gills?',
  'There\'s a trough by the stable if you need to... wet them. Or whatever you do.',
]);
R('o_out_glow', 'open', { mut_glow: true, night: true }, [
  'You\'re glowing again. {w:Handy, on a night like this.}',
  'I could read by you, {name}. {.}That\'s meant kindly.',
]);
R('o_out_eye', 'open', { mut_third_eye: true, kid: false, met: false }, [
  'I\'m trying not to look at the third eye. {d:I\'m looking at it. Sorry.}',
]);
R('o_out_antennae', 'open', { mut_antennae: true, kid: true }, [
  '{wg:Your head has feelers! Can they hear me?}',
]);
R('o_brig_first', 'open', { brigand: true, met: false, kid: false }, [
  'Black Gull colours. {t:I don\'t want trouble.}',
  'A pirate, walking in our streets. {r:The watch will want a word with you.}',
  'I know a brigand\'s swagger when I see one. {d:Mind yourself here.}',
], { once: true });
R('o_brig_shady', 'open', { brigand: true, job: ['beggar', 'barkeep'] }, [
  'A Gull. {w:Psst.} If you ever need a buyer for anything... unusual, find me.',
  'One of the brethren! Sit down. Drinks are on you, mind.',
]);
R('o_star_first', 'open', { star: true, met: false, timid: true }, [
  '{t:That wing... it\'s glowing. Is it supposed to do that?}',
], { once: true });
R('o_native_elder', 'open', { native: true, elder: true, met: true }, [
  'I remember you no taller than a fence post. {w:Look at you now.}',
  'Your grandmother would be proud of you, {name}. Mostly.',
]);
R('o_native_kid', 'open', { native: true, kid: true }, [
  'Are you {name}? Mum says you used to climb the bell tower.',
]);
R('o_leader_angry', 'open', { leader: true, anger: some, kid: false }, [
  '{r:{Address}.} Since you\'re here, you can hear it from me: people are angry.',
  '{r:With respect, {address}, the taxes are killing us.}',
]);
R('o_leader_grief', 'open', { leader: true, grief: some, kid: false }, [
  '{@slow}{c:{Address}. Forgive me. We lost {dead}.}',
]);
R('o_leader_proud', 'open', { leader: true, pride: some, kid: false }, [
  '{g:{Address}! Have you heard? I\'ve been named a master of my trade.}',
]);
R('o_renown_hero', 'open', { renown: 'Hero', kid: true }, [
  '{wg:It\'s the HERO! Can I have your autograph? What\'s an autograph?}',
]);
R('o_guard_fellow_fear', 'open', { job: 'guard', onWatch: true, fear: some }, [
  '{t:Between us, I don\'t like how quiet it is.} Keep your blade loose tonight.',
]);
R('o_wanted_kid', 'open', { wanted: true, kid: true }, [
  '{t:Mum says I\'m not to talk to you.} {.}What did you do?',
]);
R('o_dread_timid', 'open', { dread: { min: 2 }, timid: true }, [
  '{@fast}{t:Please, I have children. Whatever you want, take it.}',
  '{t:I-I won\'t tell anyone I saw you. I promise.}',
]);
// ---- the hour and the weather
R('o_late', 'open', { late: true, kid: false, job: (j) => !['guard', 'barkeep', 'innkeeper'].includes(j) }, [
  'At this hour? {d:Some of us have work in the morning, {name}.}',
  '{d:*yawns*} What is it? It\'s the middle of the night.',
  'You keep strange hours, {name}.',
]);
R('o_late_kid', 'open', { late: true, kid: true }, [
  '{d:Shh! I\'m not supposed to be up.} Don\'t tell.',
]);
R('o_dawn', 'open', { dawn: true, diligent: true }, [
  'Up with the sun! Good. The best of the day\'s before breakfast.',
]);
R('o_dawn_lazy', 'open', { dawn: true, lazy: true }, [
  '{d:Too early. Far too early. Come back at noon.}',
]);
R('o_storm', 'open', { weather: 'storm', indoors: false, kid: false }, [
  '{t:Get inside! You\'ll be blown into the sea!}',
  'Listen to that wind. {t:Shutters won\'t hold if it gets worse.}',
]);
// ---- the town
R('o_festival_soon', 'open', { festivalSoon: true, joy: { min: 0.05 } }, [
  '{w:Are you coming to the festival?} I\'ve been practising my dancing.',
  'Only a day or two now! {w:I can smell the pies already.}',
]);
R('o_wedding_soon', 'open', { weddingSoon: true, kid: false }, [
  'There\'s a wedding coming! Half the town\'s sewing ribbons.',
]);
R('o_famine', 'open', { mem_famine: true, kid: false }, [
  '{@slow}{d:The stores are empty, {name}.} Children going to bed hungry, in {town}.',
  'Bread\'s dearer than silver this month. {r:And the council sits on its hands.}',
]);
R('o_riot', 'open', { mem_riot: true, kid: false }, [
  'You heard about the trouble in the square? {t:Stones through windows.} I\'d never have believed it.',
]);
R('o_war_martial', 'open', { mem_war: true, civ_martial: true, kid: false, fear: { max: 0.3 } }, [
  '{g:War, at last.} Let them come. We were born for it.',
  'My spear\'s sharpened and my boots are oiled. {g:Let them come.}',
]);
R('o_peace', 'open', { mem_peace: true, kid: false }, [
  'Peace, they say. {w:I\'ll believe it when the soldiers come home.}',
]);
// ---- trade and talent
R('o_green_worker', 'open', { green: true, diligent: true, kid: false }, [
  'Still learning the trade. Everyone says I\'ll get there. {d:Everyone\'s very polite.}',
  'I ruined a whole batch this morning. {.}Tomorrow will be better. It has to be.',
]);
R('o_master_gruff', 'open', { master: true, gruff: true }, [
  'If you\'ve come to watch a master at work, stand back and keep quiet.',
]);
R('o_kin_gift', 'open', { kinGifted: true, kid: false, parent: true, op: { min: 0 } }, [
  'You should see my {kin} at {kinGift}. {g:Better than I ever was, at that age.}',
  'My {kin}\'s got a real knack for {kinGift}. {w:I don\'t know where it comes from. Not me!}',
]);

// ============================================================ greet
R('g_grief', 'greet', { feel: 'grief', grief: strong }, ['{@slow}{c:...}', '{c:*stares at nothing*}', '{@slow}{c:Not today, {name}.}']);
R('g_fear', 'greet', { feel: 'fear', fear: strong }, ['{t:*jumps*} Oh! It\'s you.', '{@fast}{t:Keep moving, keep moving.}', '{t:Did you hear that?}']);
R('g_anger', 'greet', { feel: 'anger', anger: strong }, ['{r:*mutters darkly*}', '{r:Don\'t.}', '{sr:Out of my way!}']);
R('g_joy', 'greet', { feel: 'joy', joy: strong }, ['{wg:Good {tw}, {name}!}', '{w:*humming*}', '{wg:What a day!}']);
R('g_pride', 'greet', { feel: 'pride', pride: strong }, ['{g:*walks a little taller*}', '{g:Morning, {name}! Fine work today!}']);
R('g_love', 'greet', { feel: 'love', love: strong }, ['{p:*smiling at nothing*}', '{p:Lovely {tw}, isn\'t it?}']);
R('g_shame', 'greet', { feel: 'shame', shame: strong }, ['{d:*looks away*}', '{d:...}']);
R('g_strain', 'greet', { strain: strong }, ['{d:*sighs heavily*}', '{d:Long day.}', '{d:One more thing...}']);
R('g_saved', 'greet', { memPk: 'saved' }, ['{p:There goes my hero!}', '{w:{name}! Thank you again!}']);
R('g_killer', 'greet', { memPk: 'killed' }, ['{sr:Murderer!}', '{r:*spits*}']);
R('g_heard_killer', 'greet', { heardPk: 'killed', timid: true }, ['{t:*hurries away*}', '{t:That\'s the one...}']);
R('g_hurt', 'greet', { hurt: true, kind: true }, ['{t:You\'re hurt! See the healer!}', 'You\'re bleeding, {name}!']);
R('g_wet', 'greet', { wet: true }, ['Wet enough for you?', '{w:Ha! Drowned rat!}', 'Get inside, you\'ll catch your death!']);
R('g_armed', 'greet', { armed: true, timid: true }, ['{t:*edges away from your blade*}', '{t:Careful with that!}']);
R('g_out_kid', 'greet', { outworlder: true, kid: true }, ['{wg:Star person!}', '{w:Hello, sky-friend!}', '*stares, mouth open*']);
R('g_out_wary', 'greet', { outworlder: true, op: { max: 0 }, kid: false }, ['{d:*keeps a wide berth*}', '{t:...}', '*makes a warding sign*']);
R('g_glow', 'greet', { mut_glow: true, night: true }, ['{w:Evening, lamp-light!}']);
R('g_brigand', 'greet', { brigand: true, op: { max: 10 } }, ['{r:Pirate.}', '{t:*clutches purse*}']);
R('g_hungry', 'greet', { starving: true }, ['{d:So hungry...}', '{t:Spare a crust?}']);
R('g_late', 'greet', { late: true }, ['{d:Late, isn\'t it?}', '{d:*yawns*}']);
R('g_born', 'greet', { mem_born: true, joy: some }, ['{wg:I\'m a parent, {name}!}', '{w:*rocking an invisible bundle*}']);
R('g_wed', 'greet', { mem_wed: true, joy: some }, ['{p:Married! Me!}', '{wg:Hello, hello!}']);
R('g_master', 'greet', { mem_mastery: (m) => m && m.s >= 0.8 }, ['{g:A master, they call me now!}']);

// ============================================================ feel
// "How are you?"
R('f_grief_partner', 'feel', { mem_loss: (m) => m && m.x === 'partner', grief: some }, [
  '{@slow}{c:How am I.} {.}I wake up and for a moment {dead} is still here. Then I remember. Every morning.',
  '{@slow}{c:I talk to {dead} still. Out loud, when nobody\'s about.} Is that strange?',
  '{@slow}{c:The house is so big now.} Too big. I might sell up.',
]);
R('f_grief_child', 'feel', { mem_loss: (m) => m && m.x === 'child', grief: some }, [
  '{@crawl}{c:I\'m breathing. That\'s about the size of it.}',
  '{@crawl}{c:I kept {dead}\'s little shoes. I don\'t know what else to do with them.}',
]);
R('f_grief_any', 'feel', { grief: some }, [
  '{@slow}{c:Honestly? Not good. {dead} was... I keep expecting to see them.}',
  '{@slow}{c:Some days I\'m fine. Today isn\'t one of them.}',
  '{@slow}{c:Grief\'s a strange weight. You don\'t notice it till you try to stand.}',
]);
R('f_fear_raid', 'feel', { mem_raid: true, fear: some }, [
  '{t:Jumpy. Since the raid, I hear them in every creak of the floor.}',
  '{t:I\'m all right in the day. It\'s the nights.} The nights are long.',
]);
R('f_fear_war', 'feel', { mem_war: true, fear: some }, [
  '{t:Afraid, if I\'m honest.} The war\'s far off, they say. Wars don\'t stay far off.',
]);
R('f_fear_any', 'feel', { fear: some }, [
  '{t:On edge.} Something\'s not right, I can feel it.',
  '{t:Scared, {name}. I don\'t even know of what. That\'s the worst of it.}',
]);
R('f_anger_you', 'feel', { memPk: ['insult', 'hurt', 'killed', 'tactless'], anger: some }, [
  '{r:You have the nerve to ask me that?}',
  '{r:I was fine until you walked up.}',
]);
R('f_anger_robbed', 'feel', { mem_robbed: true, anger: some }, [
  '{r:Robbed, that\'s how I am.} Robbed and fuming.',
]);
R('f_anger_tax', 'feel', { taxHigh: true, anger: some }, [
  '{r:Taxed to the bone, that\'s how.} Ask the council how they are, they\'re eating well.',
]);
R('f_anger_any', 'feel', { anger: some }, [
  '{r:Angry. Just angry. Don\'t ask me why, I\'ll only get angrier.}',
  '{r:I\'d like to throw something. Hard.}',
]);
R('f_shame', 'feel', { shame: some }, [
  '{@slow}{d:I made a fool of myself. Let\'s leave it there.}',
  '{@slow}{d:I can\'t look people in the eye this week.}',
]);
R('f_strain_hungry', 'feel', { hungry: true }, [
  '{d:Hungry. You stop noticing after a day or two. Then you notice nothing else.}',
]);
R('f_strain', 'feel', { strain: some }, [
  '{@slow}Worn thin. Work, family, money, more work.',
  '{@slow}{d:Tired in my bones, {name}.} A week of sleep wouldn\'t mend it.',
]);
R('f_joy_wed', 'feel', { mem_wed: true, joy: some }, [
  '{wg:Married! I\'m married!} Did I say? I keep saying.',
  '{p:Happier than I\'ve any right to be. {spouse} snores like a bear, and I don\'t even mind.}',
]);
R('f_joy_born', 'feel', { mem_born: true }, [
  '{w:Exhausted, and the happiest I\'ve ever been.} {child} kept us up all night.',
  '{wg:A parent! Me!} I\'m terrified. It\'s wonderful.',
]);
R('f_pride', 'feel', { pride: some }, [
  '{g:Proud, if you must know.} I\'ve worked hard and it shows.',
  '{g:Good. Better than good.}',
]);
R('f_love', 'feel', { love: some, partnered: true }, [
  '{p:In love, still, after all this time.} Don\'t tell anyone. I\'ve a reputation.',
]);
R('f_joy', 'feel', { joy: some }, [
  '{wg:Grand! Couldn\'t be better.}',
  '{w:Good! The sun\'s out, the bread\'s fresh, and nobody\'s shouted at me yet.}',
]);
R('f_calm_gruff', 'feel', { feel: 'calm', gruff: true }, ['Fine. Why?', 'Same as yesterday.', 'Busy.']);
R('f_calm_kind', 'feel', { feel: 'calm', kind: true }, ['Oh, well enough, thank you for asking. And you?', 'Can\'t complain! Well, I can, but I won\'t.']);
R('f_calm', 'feel', { feel: 'calm' }, ['Well enough.', 'Not bad. Not bad at all.', 'Getting by, same as everyone.', 'Fine, thanks. You?']);
R('f_kid_any', 'feel', { kid: true, feel: 'calm' }, ['Good! I found a really good stick today.', 'Bored. There\'s nothing to do.', 'I\'m HUNGRY.']);
R('f_kid_fear', 'feel', { kid: true, fear: some }, ['{t:Scared. Mum says the bandits won\'t come back. Will they?}']);
R('f_kid_grief', 'feel', { kid: true, grief: some }, ['{@slow}{c:Sad. {dead} isn\'t coming back. Mum said.}']);

// ============================================================ skill
R('s_kid_green', 'skill', { kid: true, bestV: { max: 0.12 } }, [
  'Nothing yet! I\'m only little.',
  'I\'m good at running. And hiding. And not eating cabbage.',
]);
R('s_kid_learning', 'skill', { kid: true, bestV: { min: 0.12 } }, [
  'I help with the {skill}! I\'m getting really good. {g:Everyone says.}',
  'I know loads about {skill} now. Ask me something!',
]);
R('s_master', 'skill', { master: true, kid: false }, [
  '{g:{Skill}. I\'m the best in {town} at it, and I don\'t say that lightly.}',
  '{g:{Skill}, and I\'ve the hands to prove it.} Thirty years at it.',
  'There\'s nobody in {town} better at {skill}. {g:Ask anyone.}',
]);
R('s_good', 'skill', { bestV: { min: 0.55, max: 0.88 }, kid: false }, [
  '{Skill}, mostly. I\'m {skillWord} at it, if I say so myself.',
  'I\'d say {skill}. Not a master, but I know what I\'m about.',
  'Folk come to me for {skill}. That says something.',
]);
R('s_middling', 'skill', { bestV: { max: 0.55 }, kid: false }, [
  'Good at? Hm. {Skill}, maybe. {d:I\'m no great hand at anything.}',
  'I muddle through at {skill}. Nobody\'s complained. Much.',
]);
R('s_green', 'skill', { green: true, kid: false }, [
  '{d:Honestly? Not my trade. Not yet.} I\'m still learning the {trade} work.',
  'I keep at it. {.}One day I\'ll be good at something, {name}.',
]);
R('s_kin', 'skill', { kinGifted: true, kid: false }, [
  'Me? Nothing special. But my {kin} has a gift for {kinGift}. {g:That one\'ll go far.}',
  'Ask about my {kin}. {kinGift} comes to that child like breathing.',
]);

// ============================================================ jest
R('j_kid', 'jest', { kid: true }, ['{wg:Hahaha! Do another one!}', '{w:That\'s the best joke EVER.}', 'I don\'t get it. {w:Haha!}']);
R('j_outgoing', 'jest', { outgoing: true }, ['{wg:Ha! Oh, that\'s a good one. I\'m stealing it.}', '{w:Hahaha!} Stop, my sides!']);
R('j_gruff', 'jest', { gruff: true }, ['{d:Hm.} {.}Heh. All right, that was funny.', '*the corner of a mouth twitches*']);
R('j_strain', 'jest', { strain: some }, ['{w:Ha!} Thanks. I needed that today.', 'Ha... ha. Oh, that\'s better. I\'d forgotten how to laugh.']);
R('j_any', 'jest', {}, ['{w:Ha! Good one.}', 'Heh. You\'re a funny one, {name}.', '{w:Hahaha!} Where do you get them?']);
R('jf_grief', 'jest_flat', { grief: some }, ['{@slow}{c:I\'m not in the mood for jokes, {name}.}', '{r:Do you think this is funny?}']);
R('jf_gruff', 'jest_flat', { gruff: true }, ['...', 'Was that meant to be funny?', 'Don\'t give up your day work.']);
R('jf_any', 'jest_flat', {}, ['Hm. I don\'t get it.', '*polite smile*', 'Ah. Yes. Very... yes.']);

// ============================================================ bark
// Overheard, with nobody in particular to say it to (see npc.js:
// feelBark).
R('b_tav_anger', 'bark', { feel: 'anger', anger: some }, [
  '{r:Another!} And keep them coming.',
  '{sr:They\'ll hear from me, you see if they don\'t!}',
  '{r:*slams a mug down*}',
  '{r:Taxes! Bandits! What do we pay the council for?}',
]);
R('b_tav_joy', 'bark', { feel: 'joy', joy: some }, [
  '{wg:A round for the house!}',
  '{w:*sings something that might once have been a tune*}',
  '{wg:To good days, and more of them!}',
]);
R('b_tav_wed', 'bark', { mem_wed: true, joy: some }, ['{wg:To my {spouse}! The best thing that ever happened to me!}']);
R('b_tav_born', 'bark', { mem_born: true, joy: some }, ['{wg:To little {child}!} {w:*raises a mug*}']);
R('b_tav_pride', 'bark', { feel: 'pride', pride: some }, ['{g:Did I tell you about my work today?} I\'ll tell you again.', '{g:Best in {town}, me!}']);
R('b_tav_strain', 'bark', { strain: some }, ['{d:One more, then home. Then work. Then one more.}', '{@slow}{d:*stares into a mug*}']);
R('b_grief', 'bark', { feel: 'grief', grief: some }, ['{@slow}{c:*quietly* Rest easy, {dead}.}', '{@slow}{c:*sighs*}']);
R('b_grief_pray', 'bark', { feel: 'grief', grief: some, devout: true }, ['{@slow}{c:Keep {dead} safe, wherever they are.}']);
R('b_fear', 'bark', { feel: 'fear', fear: some }, ['{t:Did you hear something?}', '{t:Bar the door. Just in case.}', '{@fast}{t:Who\'s there?!}']);
R('b_shame', 'bark', { feel: 'shame', shame: some }, ['{d:*keeps to the corner*}', '{d:Stupid. Stupid.}']);
R('b_love', 'bark', { feel: 'love', love: some }, ['{p:*humming a love song*}']);

// ============================================================ pair
// Two of them talking: "what the first says || what the other says back".
R('p_raid', 'pair', { mem_raid: true, kid: false }, [
  '{t:Still can\'t sleep since the raid.} || Nor me. I keep the axe by the door now.',
  'Did they ever catch any of those bandits? || {r:Not one. The watch is a joke.}',
  '{r:If they come again, I\'m not running.} || {t:Then you\'re braver than me.}',
]);
R('p_war', 'pair', { mem_war: true, kid: false }, [
  '{t:They say the armies are marching.} || {t:Don\'t. My eldest\'s of an age for the levy.}',
  'War again. || {d:When was it ever anything else?}',
]);
R('p_loss', 'pair', { mem_loss: true, grief: some, kid: false }, [
  '{@slow}{c:I miss {dead}.} || {c:We all do. Come and eat with us tonight.}',
  '{@slow}{c:Is it wrong that I\'m angry at {dead} for going?} || No. No, it isn\'t.',
]);
R('p_born', 'pair', { mem_born: true }, [
  '{wg:Have you seen little {child} yet?} || {w:Twice! The spit of you.}',
  'I\'ve not slept since {child} came. || {w:Welcome to the rest of your life.}',
]);
R('p_wed', 'pair', { mem_wed: true }, [
  '{p:Married life! Who\'d have thought it.} || {w:Everyone. Everyone thought it. You two were hopeless.}',
]);
R('p_master', 'pair', { mem_mastery: (m) => m && m.s >= 0.8 }, [
  '{g:They\'re calling me a master now.} || {w:About time. You never shut up about it.}',
]);
R('p_heard_saved', 'pair', { heardPk: 'saved' }, [
  'Did you hear what {name} did? || {w:Saved a life, I heard. Not many would.}',
]);
R('p_heard_killer', 'pair', { heardPk: 'killed' }, [
  '{t:You know {name} killed {killed}?} || {t:Hush! They might hear you.}',
  'I won\'t have that {name} in my shop. || {r:Nor me. Not after {killed}.}',
]);
R('p_heard_gift', 'pair', { heardPk: 'gift' }, [
  '{name} gave a gift to someone I know. Out of nowhere. || Generous sort. Or after something.',
]);
R('p_tax', 'pair', { taxHigh: true, kid: false }, [
  '{r:The taxes again!} || {r:I know. I had to sell the goat.}',
  'Who\'s the council spending it all on? || {d:Themselves, same as ever.}',
]);
R('p_out', 'pair', { outworlder: true, kid: false }, [
  'Have you seen the star-folk one, {name}? || {t:The one with the {mut}? Gives me the shivers.}',
  'That {name}, the one from the sky... || {w:Friendly enough, I found. Odd, but friendly.}',
]);
R('p_strain', 'pair', { strain: some, kid: false }, [
  '{d:I\'m worn through.} || {d:You and the whole of {town}.}',
]);
R('p_joy', 'pair', { feel: 'joy', joy: strong }, [
  '{wg:What a day, eh?} || {w:Aye! Something in the air.}',
]);
R('p_fear', 'pair', { feel: 'fear', fear: strong }, [
  '{t:You\'ve heard the talk?} || {t:Don\'t. I don\'t want to hear it.}',
]);
R('p_kin_gift', 'pair', { kinGifted: true }, [
  '{g:My {kin} is a natural at {kinGift}.} || {w:Must get it from the other side of the family.}',
]);

export { RULES };
