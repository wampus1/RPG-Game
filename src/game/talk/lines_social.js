// (Round 136) What's said among the townsfolk and to you, in the things you
// can now do with them (see game/social.js): gossip and what they make of
// it, opinions (true and softened), dreams, secrets, matchmaking, peace
// made and refused, apologies, threats, a town's grievances, and them
// coming to you. And more for the moments of the round before: friends
// made, quarrels, rivals, hearts broken, dreams come true or come to
// nothing. (Rules and marks as in lines.js.)
const RULES = [];
const R = (id, topic, when, lines, o = {}) => RULES.push({ id, topic, when, lines, ...o });
const some = { min: 0.3 };

// ============================================================ coming to you
// ---- as they come over (a bubble)
R('sk_confront', 'seek', { seekK: 'confront' }, [
  '{r:You! Yes, you. A word.}',
  '{r:Hold it right there, {name}.}',
  '{sr:Don\'t you walk away from me!}',
  '{r:I\'ve been looking for you.}',
]);
R('sk_group', 'seek', { seekK: 'group' }, [
  '{r:{name}! We need to talk. All of us.}',
  '{r:There you are. The whole town\'s talking about you.}',
]);
R('sk_thanks', 'seek', { seekK: 'thanks' }, [
  '{w:{name}! There you are!}',
  '{name}! Wait, wait, I\'ve been hoping to catch you.',
  '{g:Oh, it\'s you! Hold on a moment!}',
]);
R('sk_advice', 'seek', { seekK: 'advice' }, [
  '{name}? Have you got a moment?',
  'Oh, {name}. Could I... ask you something?',
]);
R('sk_invite', 'seek', { seekK: 'invite' }, [
  '{w:{name}! Just who I wanted to see!}',
  '{w:Oi, {name}! Over here!}',
]);
R('sk_warn', 'seek', { seekK: 'warn' }, [
  '{d:{name}. A quiet word, if you don\'t mind.}',
  '{t:Psst. {name}. Over here.}',
]);
// ---- when you talk to them
R('so_confront_ins', 'seek_open', { seekK: 'confront', mem_insult: true }, [
  '{r:You. You made a fool of me, in front of everyone.} {.}I\'ve not forgotten.',
  '{r:Remember what you said to me, {name}?} {.}Because I do.',
]);
R('so_confront_hurt', 'seek_open', { seekK: 'confront', mem_hurt: true }, [
  '{sr:You laid hands on me!} {.}{r:Did you think I\'d just let it go?}',
  '{r:I\'ve still got the bruise, {name}.} {.}What have you got to say for yourself?',
]);
R('so_confront_wronged', 'seek_open', { seekK: 'confront', mem_wronged: true }, [
  '{r:What you did to me, {name}. In my own town.} {.}We\'re going to settle it.',
]);
R('so_confront_slander', 'seek_open', { seekK: 'confront', mem_slander: true }, [
  '{sr:Lies! You\'ve been spreading lies about me!}',
  '{r:I know what you\'ve been saying about me, {name}.} {.}Every word of it.',
]);
R('so_confront_any', 'seek_open', { seekK: 'confront' }, [
  '{r:You and I need to have this out, {name}.}',
  '{r:I\'ve been waiting for you to show your face.}',
]);
R('so_group_open', 'seek_open', { seekK: 'group' }, [
  '{r:Enough is enough, {name}. The whole of {town} has had it with you.}',
  '{r:They sent me to speak for them.} {.}{r:We\'ve all heard what you did.}',
]);
R('so_thanks_saved', 'seek_open', { seekK: 'thanks', mem_saved: true }, [
  '{w:I never thanked you properly.} {.}You saved my life. I don\'t know how to repay that.',
  '{@slow}{p:If you hadn\'t come when you did...} {.}Thank you. Truly.',
]);
R('so_thanks_gift', 'seek_open', { seekK: 'thanks', mem_gift: true }, [
  '{w:That {gift} you gave me!} I\'ve not stopped smiling.',
  '{g:I\'ve been wanting to thank you for the {gift}.}',
]);
R('so_thanks_fed', 'seek_open', { seekK: 'thanks', mem_fed: true }, [
  '{@slow}{p:You fed my family when nobody else would.} {.}I won\'t forget it.',
]);
R('so_thanks_helped', 'seek_open', { seekK: 'thanks', mem_helped: true }, [
  '{w:You helped me when you didn\'t have to.} {.}I want you to have something.',
]);
R('so_thanks_comfort', 'seek_open', { seekK: 'thanks', mem_comforted: true }, [
  '{@slow}When things were bad, you sat with me. {.}{p:I wanted to say thank you.}',
]);
R('so_thanks_any', 'seek_open', { seekK: 'thanks' }, [
  '{w:I\'ve been meaning to find you, {name}. To say thank you.}',
  '{g:You\'ve been good to me. I wanted you to know I noticed.}',
]);
R('so_advice_leave', 'seek_open', { seekK: 'advice', amb_leave: true }, [
  '{d:I\'ve been thinking of leaving {town}.} {.}You\'ve been about. Is it better, out there?',
  '{t:Can I ask you something? I keep thinking I should go. Pack up, start again.}',
]);
R('so_advice_trade', 'seek_open', { seekK: 'advice', amb_trade: true }, [
  'I want to be a {ambTrade}, {name}. {.}Am I mad? Everyone says I\'m mad.',
  'If you were me, would you give it all up to be a {ambTrade}?',
]);
R('so_advice_wed', 'seek_open', { seekK: 'advice', amb_wed: true }, [
  '{p:It\'s about {ambWho}.} {.}{d:Do you think they\'d... with someone like me?}',
  '{p:Can I tell you something? I think I\'m in love with {ambWho}.} What should I do?',
]);
R('so_advice_venture', 'seek_open', { seekK: 'advice', amb_venture: true }, [
  'I want to open a place of my own. {.}Tell me honestly: would you buy from me?',
]);
R('so_advice_office', 'seek_open', { seekK: 'advice', amb_office: true }, [
  '{d:Between us, {name}:} I\'m thinking of standing against the mayor. Would folk follow me?',
]);
R('so_advice_any', 'seek_open', { seekK: 'advice' }, [
  'You seem like someone who knows things. Can I ask your advice?',
]);
R('so_invite_open', 'seek_open', { seekK: 'invite' }, [
  '{w:A few of us are going to the tavern tonight. Come with us!}',
  '{w:You look like you could use an ale. My treat!}',
]);
R('so_warn_open', 'seek_open', { seekK: 'warn' }, [
  '{d:I shouldn\'t say. But you\'ve been good to me.} {.}{t:{subj} has it in for you. Watch yourself.}',
  '{t:Keep your eyes open, {name}.} {d:{subj} has been saying things. Ugly things.}',
]);
R('so_sulk', 'sulk', {}, [
  '{r:I\'ve nothing to say to you.}',
  '{r:You\'ve got a nerve, talking to me.}',
  '{r:Go away, {name}.}',
  '*turns away from you*',
]);
R('so_sulk_hot', 'sulk', { hot: true }, ['{sr:Get away from me before I do something I regret!}']);
R('so_sulk_kid', 'sulk', { kid: true }, ['{r:I\'m not talking to you!}', '{r:Hmph!}']);

// ============================================================ gossip
// ---- what they've heard, by what it is
R('w_loss', 'word', { wordK: 'loss' }, [
  '{@slow}{c:You heard about {who}?} {.}Gone. Just like that.',
  '{@slow}We buried {who}. {.}{c:The whole street came out.}',
  '{c:Poor {who}.} Nobody expected it. Nobody ever does.',
]);
R('w_born', 'word', { wordK: 'born' }, ['{w:There\'s a new baby! {who}! Tiny thing, with a voice like a bell.}', 'Have you seen little {who} yet? {w:All the old women are fighting over who gets to hold them.}']);
R('w_wed', 'word', { wordK: 'wed' }, ['{w:{who} got married! I cried. Everyone cried.}', 'Did you hear? {who} has tied the knot. {.}About time, too.']);
R('w_wedding', 'word', { wordK: 'wedding' }, ['{who} were wed. {w:What a day that was.}']);
R('w_raid', 'word', { wordK: 'raid' }, ['{t:The raid. Have you heard about the raid?} They came right up to the doors.', '{t:Everyone\'s talking about the raid.} Nobody\'s sleeping well.']);
R('w_robbed', 'word', { wordK: 'robbed' }, ['Somebody was robbed. {.}{t:In broad daylight!}', 'Keep your purse close. {d:There\'s a thief about.}']);
R('w_mastery', 'word', { wordK: 'mastery' }, ['{who}\'s a master of their trade now, they say. {g:Earned it, too.}', '{g:You know {who}? Best in the town at it, now.}']);
R('w_dream_done', 'word', { wordK: 'dream_done' }, ['{w:{who} finally did it.} What they always wanted. Good for them.', 'You know {who} always dreamed of it? {w:Well, they got there.}']);
R('w_dream_lost', 'word', { wordK: 'dream_lost' }, ['{d:Poor {who}.} Wanted it so badly, and it came to nothing.', '{d:{who} had a dream once. Not any more.}']);
R('w_friend', 'word', { wordK: 'friend', wordH: false }, ['{who} and I have become thick as thieves, lately. {w:Who\'d have thought it?}', 'I\'ve a new friend: {who}. {w:We talk for hours.}']);
R('w_friend_h', 'word', { wordK: 'friend', wordH: true }, ['{who} has made a new friend, I hear. {w:Good. They needed one.}']);
R('w_quarrel', 'word', { wordK: 'quarrel', wordH: false }, ['{r:{who} and I had words.} I don\'t want to talk about it.', '{r:Don\'t mention {who} to me.}']);
R('w_quarrel_h', 'word', { wordK: 'quarrel', wordH: true }, ['{who}\'s fallen out with someone. {d:Shouting in the street, the pair of them.}']);
R('w_bad_word', 'word', { wordK: 'bad_word', wordYou: false }, [
  '{d:{teller}\'s been saying things about {who}.} Not nice things.',
  '{d:Between us? {teller} can\'t stand {who}. Tells anyone who\'ll listen.}',
]);
R('w_bad_word_you', 'word', { wordK: 'bad_word', wordYou: true }, [
  '{d:I shouldn\'t tell you this.} {.}{teller} has been bad-mouthing you all over {town}.',
  '{t:You should know: {teller} has it in for you. Says all sorts.}',
]);
R('w_rumour_bad', 'word', { wordK: 'rumour_bad' }, ['{d:They say {who} isn\'t to be trusted.} I never thought it, myself. But they say it.', '{d:Word is, you want to watch {who}.}']);
R('w_rumour_good', 'word', { wordK: 'rumour_good' }, ['{w:They say {who} has a heart of gold.} I always thought so.']);
R('w_petition', 'word', { wordK: 'petition_won' }, ['{g:We won! The petition! They had to listen to us in the end.}', '{g:The council gave in. That\'s what comes of standing together.}']);
R('w_vigil', 'word', { wordK: 'vigil' }, ['{@slow}{c:We kept a vigil for {who}.} {.}Half the town came, with candles.']);
R('w_rival', 'word', { wordK: 'rival', wordH: false }, ['{r:{who}.} {.}Thinks they\'re better than me. We\'ll see.', '{r:Don\'t talk to me about {who}. Rivals, the two of us.}']);
R('w_rival_h', 'word', { wordK: 'rival', wordH: true }, ['{who} has a rival, I hear. {w:It\'s better than a play.}']);
R('w_heartbreak', 'word', { wordK: 'heartbreak' }, ['{d:Poor {who}.} Their heart was set on someone, and it wasn\'t to be.']);
R('w_grown', 'word', { wordK: 'grown' }, ['{who}\'s all grown up and working now. {w:Where do the years go?}']);
R('w_chosen', 'word', { wordK: 'chosen' }, ['{g:The town has a new mayor!} I hope they\'re better than the last.']);
R('w_made_up', 'word', { wordK: 'made_up' }, ['{w:{who} and I have made it up.} {.}Years of not speaking. All done with.']);
R('w_famine', 'word', { wordK: 'famine' }, ['{d:The stores are empty.} Everyone\'s talking about the hunger, and nobody\'s doing anything.']);
R('w_riot', 'word', { wordK: 'riot' }, ['{t:You heard about the trouble at the hall?} Windows broken. People hurt.']);
R('w_war', 'word', { wordK: 'war' }, ['{t:War.} That\'s all anyone talks about now.']);
R('w_peace', 'word', { wordK: 'peace' }, ['{w:Peace! The war\'s over!} Or so they tell us.']);
R('w_eruption', 'word', { wordK: 'eruption' }, ['{t:The mountain woke.} They say you could see the fire from the coast.']);
R('w_crowned', 'word', { wordK: 'crowned' }, ['There\'s a new ruler on the throne. {d:Same as the old one, I expect.}']);
R('w_exiled', 'word', { wordK: 'exiled' }, ['{d:Someone was banished, did you hear?} Sent off with nothing.']);
R('w_saved', 'word', { wordK: 'saved', wordYou: true }, ['{g:Everyone knows what you did, saving folk like that.}']);
R('w_saved_o', 'word', { wordK: 'saved', wordYou: false }, ['{g:Someone was saved, right at the last.} {.}Folk still talk about it.']);
R('w_gift_you', 'word', { wordK: 'gift', wordYou: true }, ['Word is you\'ve been generous round here. {w:Folk notice.}']);
R('w_hurt_you', 'word', { wordK: 'hurt', wordYou: true }, ['{d:Folk say you\'ve a heavy hand.} {.}Is it true?']);
R('w_insult_you', 'word', { wordK: 'insult', wordYou: true }, ['{d:They say you\'ve a sharp tongue.} I\'m only telling you what I heard.']);
R('w_slander', 'word', { wordK: 'slander' }, ['{r:Somebody\'s been telling lies.} And I know who.']);
R('w_helped', 'word', { wordK: 'helped' }, ['{w:{who} helped me out when things were bad.} {.}There\'s good people in {town}.']);
R('w_grandchild', 'word', { wordK: 'grandchild' }, ['{w:I\'m a grandparent!} Little {who}! Have you seen them?']);
R('w_feast', 'word', { wordK: 'feast' }, ['{w:What a feast that was!} I\'m still full.']);
R('w_won_war', 'word', { wordK: 'won_war' }, ['{g:We won! The war\'s won!}']);
R('w_any_you', 'word', { wordYou: true }, ['Folk talk about you, you know. {.}{d:Not all of it\'s true, I\'m sure.}']);
// ---- nothing to tell
R('w_none', 'word_none', {}, ['Quiet, lately. Nothing worth repeating.', 'Nothing much. Same as ever.', 'If I hear anything, you\'ll be the first to know.', 'Nothing you\'d want to hear.']);
R('w_none_reserved', 'word_none', { reserved: true }, ['I keep myself to myself.', '{d:I don\'t carry tales.}', 'Ask someone else. I mind my own business.']);
R('w_none_gossip', 'word_none', { trait_outgoing: true }, ['{w:Nothing! Can you believe it? The one week I want news!}']);

// ---- told something by you
R('t_known', 'told', { toldKnown: true }, ['I\'d heard. Everyone\'s heard.', 'Old news, {name}.', '{d:Yes, yes. I know.}']);
R('t_self_bad', 'told', { toldSelf: true, toldGood: false, toldKnown: false }, [
  '{sr:They said WHAT about me?}',
  '{r:Who told you that?} {.}I\'ll be having words.',
  '{s:That\'s a lie! Every word of it!}',
]);
R('t_self_bad_betray', 'told', { toldSelf: true, toldK: 'bad_word', toldKnown: false }, [
  '{sr:{teller} said that? {teller}?} {.}{r:And I thought we were friends.}',
  '{r:{teller}. Of course it was {teller}.} {.}Thank you for telling me.',
]);
R('t_self_good', 'told', { toldSelf: true, toldGood: true, toldKnown: false }, ['{w:Oh! They said that? About me?}', '{p:That\'s... that\'s nice to hear.}']);
R('t_kin_loss', 'told', { toldKin: true, toldK: 'loss', toldKnown: false }, ['{@crawl}{c:No.} {.}{c:No, not {who}.}', '{@slow}{c:...I didn\'t know.} {.}Thank you for telling me.']);
R('t_kin_bad', 'told', { toldKin: true, toldGood: false, toldKnown: false }, ['{r:My {who}? Who\'s saying that?}', '{t:Is {who} all right? I have to go to them.}']);
R('t_kin_good', 'told', { toldKin: true, toldGood: true, toldKnown: false }, ['{wg:That\'s my {who}!}', '{g:I always said {who} would do well.}']);
R('t_far', 'told', { toldFar: true, toldKnown: false }, ['In {there}? I don\'t know the place well. {.}Still. Fancy that.', 'News from {there}! Nobody tells us anything out here.']);
R('t_good', 'told', { toldGood: true, toldKnown: false }, ['Is that so? Good for {who}.', '{w:Well, that\'s cheering.}', 'I\'ll tell the others.']);
R('t_bad', 'told', { toldGood: false, toldKnown: false }, ['No! Really?', '{d:Hm. I\'d not have thought it of {who}.}', 'That\'s a shame. A real shame.']);
R('t_loss', 'told', { toldK: 'loss', toldKnown: false }, ['{@slow}{c:{who}? Gone?} {.}I didn\'t know them well. Still.']);

// ---- your rumours
R('ru_bad_yes', 'rumour', { rumourBad: true, believed: true }, ['{d:Really? {subj}?} I\'d never have thought it.', '{d:I always wondered about {subj}.} Now I know.', '{t:I\'ll keep an eye on {subj}, then.}']);
R('ru_bad_no', 'rumour', { rumourBad: true, believed: false }, ['That doesn\'t sound like {subj}. {.}{r:Who told you that?}', '{r:I\'ve known {subj} for years. You\'re wrong.}', '{d:Careful, {name}. Talk like that gets around.}']);
R('ru_good_yes', 'rumour', { rumourBad: false, believed: true }, ['Is that so? {w:I\'ll think the better of {subj}.}', '{w:I always liked {subj}.}']);
R('ru_good_no', 'rumour', { rumourBad: false, believed: false }, ['{subj}? {d:Hah. You don\'t know them like I do.}', '{d:If you say so.}']);

// ============================================================ opinions
// ---- of someone
R('th_adore_partner', 'think', { subjBand: 'adore', subjBond: 'partner' }, ['{p:{subj}? The best thing that ever happened to me.}', '{p:I\'d walk into the sea for {subj}. Don\'t tell them I said that.}']);
R('th_adore_child', 'think', { subjBand: ['adore', 'like'], subjBond: 'child' }, ['{g:My {subj}? The light of my life.}', '{w:{subj} drives me mad, and I wouldn\'t change a thing.}']);
R('th_adore_parent', 'think', { subjBand: ['adore', 'like'], subjBond: 'parent' }, ['{p:{subj} made me who I am.}', 'I owe {subj} everything. {.}Not that I\'d ever tell them.']);
R('th_adore', 'think', { subjBand: 'adore' }, ['{w:{subj}? I\'d do anything for them.}', '{p:One of the best people I know, {subj}.}', '{g:{subj}! Now there\'s a friend.}']);
R('th_like_friend', 'think', { subjBand: 'like', subjBond: 'friend' }, ['{subj}\'s a good friend. {w:We go back a long way.}']);
R('th_like', 'think', { subjBand: 'like' }, ['{subj}? Good sort.', 'I like {subj}. You can trust them.', '{w:{subj}\'s all right. Better than all right.}']);
R('th_neutral', 'think', { subjBand: 'neutral' }, ['{subj}? I don\'t know them well.', 'We say good morning. That\'s about it.', '{subj}? Can\'t say I\'ve given them much thought.']);
R('th_dislike', 'think', { subjBand: 'dislike' }, ['{d:{subj}? We don\'t see eye to eye.}', '{subj}. {.}{d:I\'ll say no more.}', '{r:Don\'t get me started on {subj}.}']);
R('th_hate', 'think', { subjBand: 'hate' }, ['{r:{subj}? I can\'t stand them.}', '{sr:If {subj} fell down a well, I\'d walk the other way.}', '{r:Don\'t say that name to me.}']);
R('th_hate_quarrel', 'think', { subjBand: ['hate', 'dislike'], subjMem: 'quarrel' }, ['{r:After what {subj} said to me?} {.}Never.', '{r:We had words, {subj} and I.} {.}Words I won\'t forget.']);
R('th_hate_rival', 'think', { subjBand: ['hate', 'dislike'], subjMem: 'rival' }, ['{r:{subj} thinks they\'re better than me.} {.}{g:They\'re not.}']);
R('th_hate_betrayed', 'think', { subjBand: ['hate', 'dislike'], subjMem: 'betrayed' }, ['{r:I trusted {subj}.} {.}{c:I won\'t make that mistake again.}']);
R('th_like_friend_mem', 'think', { subjBand: ['like', 'adore'], subjMem: 'friend' }, ['{w:{subj} and I became friends not long ago.} {.}Best thing that\'s happened to me this year.']);
R('th_like_sat', 'think', { subjBand: ['like', 'adore'], subjMem: 'sat_with' }, ['{@slow}{p:When I was at my lowest, {subj} sat with me every evening.} {.}I won\'t forget it.']);
R('th_polite', 'think', { subjBand: 'polite' }, ['{subj}? Oh, they\'re fine.', 'Can\'t complain about {subj}.', '{subj}\'s... nice. Very nice.', 'We get on. {.}Mostly.']);
R('th_polite_mayor', 'think', { subjBand: 'polite', subjMayor: true }, ['The mayor? {d:Doing their best, I\'m sure.}', '{d:I\'ve no complaints about the mayor.} None I\'d say out loud.']);
R('th_pressed_dislike', 'think', { subjBand: ['dislike', 'hate'], pressed: true }, ['{d:All right. You want the truth?} {.}{r:I can\'t stand {subj}. Never could.}', '{d:Fine.} {.}{subj} is the worst kind of person, and everyone pretends otherwise.']);
R('th_pressed_polite', 'think', { subjBand: 'polite', pressed: true }, ['{d:I\'ve said all I mean to say.}', 'Leave it, {name}.']);
R('th_kid', 'think', { subjKid: true }, ['{subj}? A sweet little thing. Noisy, but sweet.', '{w:{subj}\'s always into something, that one.}']);

// ---- of you
R('me_adore', 'me', { meBand: 'adore' }, ['{p:Honestly? You\'re one of the best people I know.}', '{w:I\'m glad you came to {town}. There. I said it.}', '{g:I\'d trust you with my life. Maybe I already have.}']);
R('me_like', 'me', { meBand: 'like' }, ['I like you, {name}. You\'re all right.', '{w:You\'re good company. That\'s rare.}', 'I trust you. Mostly.']);
R('me_neutral', 'me', { meBand: 'neutral' }, ['I don\'t know you well enough to say.', 'You seem all right. Time will tell.', '{d:You\'re a stranger still, to me.}']);
R('me_dislike', 'me', { meBand: 'dislike' }, ['{d:I don\'t trust you. There. You asked.}', '{r:You want honesty? I don\'t like you much.}']);
R('me_hate', 'me', { meBand: 'hate' }, ['{r:You really want to know? I can\'t stand you.}', '{sr:I think you\'re the worst thing to happen to {town} in years.}']);
R('me_polite', 'me', { meBand: 'polite' }, ['Oh, you\'re fine. Why do you ask?', 'You\'re... very nice. Very nice.', '{d:I\'ve nothing against you.} Nothing at all.']);
R('me_polite_pressed', 'me', { meBand: 'polite', pressed: true }, ['{d:I said what I said.}', 'Why are you pushing me?']);
R('me_insult', 'me', { meBand: ['dislike', 'hate'], meMem: 'insult' }, ['{r:You insulted me, {name}.} {.}You probably don\'t even remember.', '{r:Not after the way you spoke to me.}']);
R('me_hurt', 'me', { meBand: ['dislike', 'hate'], meMem: 'hurt' }, ['{r:You hurt me.} {.}You think I\'d just forget?']);
R('me_threatened', 'me', { meBand: ['dislike', 'hate'], meMem: 'threatened' }, ['{t:You threatened me.} {.}{r:That\'s what I think of you.}']);
R('me_killed', 'me', { meBand: ['dislike', 'hate'], meMem: 'killed' }, ['{@slow}{c:You killed {dead}.} {.}{r:What do you think I think of you?}']);
R('me_liar', 'me', { meBand: ['dislike', 'hate', 'neutral'], meMem: 'liar' }, ['{d:You tell tales, {name}.} I don\'t believe half of what you say.']);
R('me_saved', 'me', { meBand: ['like', 'adore'], meMem: 'saved' }, ['{p:You saved my life.} {.}What do you think I think of you?']);
R('me_gift', 'me', { meBand: ['like', 'adore'], meMem: 'gift' }, ['{w:Anyone who gives a {what} as a present is all right by me.}']);
R('me_helped', 'me', { meBand: ['like', 'adore'], meMem: 'helped' }, ['{g:You helped me when I needed it.} {.}That counts for a lot.']);
R('me_comforted', 'me', { meBand: ['like', 'adore'], meMem: ['comforted', 'sat_with'] }, ['{@slow}{p:You were kind to me, when it counted.}']);
R('me_drink', 'me', { meBand: ['like', 'adore'], meMem: 'drink' }, ['{w:Anyone who stands me a drink can\'t be all bad!}']);
R('me_sparred', 'me', { meBand: ['like', 'adore', 'neutral'], meMem: 'sparred' }, ['{g:You fight well. I respect that.}']);
R('me_kid', 'me', { kid: true }, ['{w:You\'re funny!}', 'You\'re all right. For a grown-up.']);

// ============================================================ dreams
R('dr_shut', 'dream_shut', {}, ['That\'s my own business.', '{d:Why do you want to know?}', 'Ask me again when I know you better.']);
R('dr_shut_gruff', 'dream_shut', { gruff: true }, ['{d:Hmph. Mind your own.}']);
R('dr_none', 'dream', { noDream: true }, ['Me? I\'ve all I need, I think.', 'Want? A quiet life. I\'ve got one. {w:Mostly.}', 'Just to see the children grow up well.', 'I don\'t think about it. Every day\'s the same, and that suits me.']);
R('dr_none_low', 'dream', { noDream: true, strain: some }, ['{d:Want?} {.}{d:Just to get through the week.}', '{@slow}{d:I used to want things. I\'m too tired now.}']);
R('dr_none_glad', 'dream', { noDream: true, joy: some }, ['{w:Honestly? I\'ve got it. Right now. This.}']);
R('dr_none_elder', 'dream', { noDream: true, elder: true }, ['{@slow}At my age? To see one more spring. {.}{w:And to outlive that old goat across the road.}']);
R('dr_master', 'dream', { dreamTold: true, amb_master: true }, [
  'To be the best {ambTrade} there\'s ever been. {g:Not just in {town}. Anywhere.}',
  'I want to be a master of {ambTrade}. {.}I\'m close. I can feel it.',
  '{g:Mastery.} {.}I work late every night. One day they\'ll talk about my work.',
]);
R('dr_master_close', 'dream', { dreamTold: true, amb_master: true, ambP: { min: 0.85 } }, ['{g:I\'m nearly there. A season more, and they\'ll call me master.}']);
R('dr_trade', 'dream', { dreamTold: true, amb_trade: true }, [
  'I want to be a {ambTrade}. {.}I\'ve always had a feel for it. I\'m just in the wrong life.',
  '{d:Don\'t laugh.} {.}I want to be a {ambTrade}. I practise every evening.',
  'Every night after work, I study. {w:One day I\'ll be a {ambTrade}. You\'ll see.}',
]);
R('dr_venture', 'dream', { dreamTold: true, amb_venture: true }, ['A place of my own. {w:My own sign over the door.} I\'m saving every coin.', 'I want to open {ambBiz}. {g:There\'s nothing like it for miles.}']);
R('dr_venture_st', 'dream', { dreamTold: true, amb_venture: true, ambSt: 1 }, ['{g:It\'s open! My own place!} Now I just have to keep it open.']);
R('dr_wed', 'dream', { dreamTold: true, amb_wed: true }, ['{p:Someone to come home to.} {.}Is that so much?', '{d:I\'m lonely, {name}.} I want someone to share it all with.']);
R('dr_wed_who', 'dream', { dreamTold: true, amb_wed: true, ambWho: (v, F) => !!F.vars.ambWho }, [
  '{p:Can you keep a secret? It\'s {ambWho}.} {.}{d:I can\'t stop thinking about them.}',
  '{p:{ambWho}.} {.}{d:I go red just saying it.}',
]);
R('dr_wed_st', 'dream', { dreamTold: true, amb_wed: true, ambSt: 1 }, ['{p:{ambWho} and I are walking out together!} {w:Don\'t tell anyone. Tell everyone!}']);
R('dr_office', 'dream', { dreamTold: true, amb_office: true }, ['To lead {town}. {.}It needs leading, and nobody else will.', '{g:I\'d be a better mayor than the one we\'ve got.} {d:Keep that to yourself.}']);
R('dr_office_st', 'dream', { dreamTold: true, amb_office: true, ambSt: 1 }, ['{g:I\'m standing for mayor!} Will you speak for me?']);
R('dr_revenge', 'dream', { dreamTold: true, amb_revenge: true, ambOnYou: false }, [
  '{r:To see {ambWho} get what\'s coming to them.}',
  '{r:{ambWho} wronged me.} {.}I won\'t rest till it\'s put right.',
  '{d:You want to know what I want?} {.}{r:{ambWho}, brought low.}',
]);
R('dr_revenge_you', 'dream', { dreamTold: true, ambOnYou: true }, ['{r:You really want to know?} {.}{sr:To see you pay for what you did.}']);
R('dr_leave', 'dream', { dreamTold: true, amb_leave: true }, ['{d:To get out of {town}.} Somewhere I can breathe.', '{t:I want to leave. Somewhere safe.} {.}Somewhere far from here.', '{@slow}{c:Everything here reminds me.} I want a fresh start.']);
R('dr_protect', 'dream', { dreamTold: true, amb_protect: true }, ['{g:To stand with the watch.} Next time they come, I\'ll be ready.', '{r:I won\'t be helpless again.} I train every night.']);
R('dr_learn', 'dream', { dreamTold: true, amb_learn: true }, ['To study. {w:Properly. At the Academy, if they\'ll have me.}', 'Books, {name}. {w:All the books in the world.}']);
R('dr_reconcile', 'dream', { dreamTold: true, amb_reconcile: true }, ['{@slow}{c:To make it up with {ambWho}.} {.}We haven\'t spoken in too long.', '{@slow}{ambWho} and I fell out. {.}{p:I want my {ambWho} back.}']);
R('dr_provide', 'dream', { dreamTold: true, amb_provide: true }, ['{d:Want?} {.}{d:Bread on the table. That\'s all.}', '{@slow}{c:To see my little ones fed.} Nothing else matters.']);
R('dr_child', 'dream', { dreamTold: true, amb_child: true }, ['{p:A child of our own.} {.}{w:We\'ve been trying. Don\'t make that face.}', '{p:A little one. Someone to teach.}']);
// ---- what you said about it
R('dr_enc', 'dream_enc', {}, ['You think so? {w:Thank you. I needed to hear that.}', '{g:You\'re right. I can do this.}', '{w:Nobody else has said that to me.}']);
R('dr_enc_rev', 'dream_enc', { amb_revenge: true }, ['{r:You see it too. They had it coming.}', '{r:Good. I knew I wasn\'t wrong.}']);
R('dr_enc_leave', 'dream_enc', { amb_leave: true }, ['{d:You think I should go?} {.}Then maybe I will.']);
R('dr_enc_adv', 'dream_enc', { advised: true }, ['{g:Right. Right! I\'ll do it.}', '{w:That settles it, then.}']);
R('dr_help', 'dream_help', {}, ['You\'d do that? {w:I don\'t know what to say.}', '{p:Nobody\'s ever done anything like that for me.}', '{g:This changes everything. Thank you.}']);
R('dr_help_wed', 'dream_help', { amb_wed: true }, ['{p:You\'ll talk to {ambWho}? For me?} {.}{t:What will you say?}']);
R('dr_help_rev', 'dream_help', { amb_revenge: true }, ['{r:Then we\'re of one mind.} {.}{ambWho} won\'t know what hit them.']);
R('dr_stop_ok', 'dream_stop', { stopOk: true }, ['{@slow}Maybe you\'re right. {.}Maybe.', '{d:...You\'re right. It was foolish.}', 'I\'ll let it lie. For now.']);
R('dr_stop_ok_rev', 'dream_stop', { stopOk: true, amb_revenge: true }, ['{@slow}{d:...It won\'t bring anything back, will it.} {.}All right. I\'ll let it go.']);
R('dr_stop_ok_leave', 'dream_stop', { stopOk: true, amb_leave: true }, ['{@slow}Things will get better? {.}All right. I\'ll stay. {w:For now.}']);
R('dr_stop_no', 'dream_stop', { stopOk: false }, ['{r:My mind\'s made up.}', '{d:You don\'t understand.}', 'I didn\'t ask what you thought.']);

// ============================================================ secrets
R('se_none', 'secret', { secretK: 'none' }, ['Me? I\'m an open book.', '{w:Nothing! My life\'s very dull, I promise.}']);
R('se_talent', 'secret', { secretK: 'talent' }, [
  '{d:I\'ve always thought I\'d be good at {what}.} {.}I\'ve never had the chance.',
  '{p:Promise you won\'t laugh?} {.}I think I was meant for {what}. I just know it.',
]);
R('se_dream', 'secret', { secretK: 'dream' }, ['{d:Between you and me?} {.}I want {ambWhat}. Nobody knows.', '{p:I\'ve a dream, {name}.} {.}{ambWhat}. There. Now you know.']);
R('se_sweet', 'secret', { secretK: 'sweet' }, [
  '{p:I\'m sweet on {who}.} {.}{t:Don\'t you dare tell them!}',
  '{p:It\'s {who}.} {.}{d:Every time they walk past, I forget my own name.}',
]);
R('se_dislike', 'secret', { secretK: 'hidden_dislike' }, ['{d:I smile at {who} every day.} {.}{r:I can\'t stand them.}', '{d:Everyone thinks {who} and I get on.} {.}We don\'t.']);
R('se_seen', 'secret', { secretK: 'seen' }, ['{t:I know something about {who}.} {.}{d:I\'ve never told a soul.}', '{d:You want a secret? Ask {who} where they were that night.}']);
R('se_purse', 'secret', { secretK: 'purse' }, ['{p:Here.} {.}{w:I\'ve been putting a little aside. I want you to have some of it.}', '{p:Don\'t argue. Take it.} You\'ve been a better friend than you know.']);

// ============================================================ friends
R('in_good', 'intro', { introGood: true }, ['{w:{subj}? We should have met years ago!}', 'I\'ll look out for {subj}. {w:They seem good company.}', '{w:Thank you. I like {subj} already.}']);
R('in_bad', 'intro', { introBad: true }, ['{d:{subj}? We\'ve met. We didn\'t get on.}', '{d:Not {subj}. Anyone but {subj}.}']);
R('in_meh', 'intro', {}, ['{subj}? I know the name. I\'ll say hello.', 'All right. If you say so.']);
R('in_match', 'intro', { introMatch: true }, ['{p:{subj}?} {.}{p:Oh. Oh, my.}', '{p:Why didn\'t anyone tell me about {subj} before?}', '{p:I... think I\'d like to see {subj} again.}']);
R('me_made', 'mediate', { made: true }, ['{@slow}{d:Maybe you\'re right about {subj}.} {.}I\'ll go and talk to them.', '{d:It was a long time ago, wasn\'t it.} {.}All right.', '{w:You\'re a peacemaker, {name}. All right. I\'ll try.}']);
R('me_not', 'mediate', { made: false }, ['{r:Stay out of it.}', '{r:You don\'t know what {subj} did.}', '{d:Some things can\'t be mended.}']);
R('dk_yes', 'drink', { drinkNo: false }, ['{w:Don\'t mind if I do!}', '{w:Now you\'re talking!}', '{w:First one\'s yours, second\'s mine.}', '{w:I thought you\'d never ask.}']);
R('dk_yes_low', 'drink', { drinkNo: false, strain: some }, ['{@slow}{d:Gods, yes. I need one.}']);
R('dk_no', 'drink', { drinkNo: true }, ['I\'m working. Another time.', '{d:Can\'t. They\'d have my hide.}']);
R('sp_ask', 'spar', { sparAsk: true }, ['A friendly bout? {g:Why not.}', '{g:You think you can take me?}', 'First to yield. No hard feelings.']);
R('sp_ask_guard', 'spar', { sparAsk: true, job: 'guard' }, ['{g:A bout with the watch? Bold.} Don\'t cry when you lose.']);
R('sp_ask_prot', 'spar', { sparAsk: true, amb_protect: true }, ['{g:Yes! I need the practice.} Don\'t go easy on me.']);
R('sp_go', 'spar', { sparAsk: false }, ['{g:Ready yourself!}', '{g:Come on, then!}', 'Here I come!']);
R('te_fee', 'teach', { teachFee: true, teachNo: true }, ['A lesson\'s ¤5. {d:Come back when you have it.}']);
R('te_any', 'teach', {}, ['Watch closely, now. {.}No, closer.', '{g:The trick is in the wrist.}', 'It took me years to learn this. {w:You\'ve got an afternoon.}']);
R('te_fish', 'teach', { teachK: 'fishing' }, ['Patience. {.}And never let them see your shadow on the water.', 'Feel the line. {w:The fish will tell you what it\'s doing.}']);
R('te_cook', 'teach', { teachK: 'cooking' }, ['Salt early, herbs late. {.}And taste everything.', '{w:A good stew is half patience and half not burning it.}']);
R('te_craft', 'teach', { teachK: 'crafting' }, ['{g:Let the work tell you what it wants to be.}', 'Measure twice. Then once more. {.}Then cut.']);
R('te_lore', 'teach', { teachK: 'lore' }, ['Read it once for the words, and again for what they mean.', '{w:Every book is an argument with another book.}']);
R('te_combat', 'teach', { teachK: 'combat' }, ['{g:Keep your feet under you. Everything starts with the feet.}', 'Watch the shoulders, not the blade.']);
R('sh_any', 'show', {}, ['{w:Oh! I never thought of doing it that way.}', '{g:Show me that again.}', 'Where did you learn that?']);

// ============================================================ quarrels
R('so_ok', 'sorry', { sorryOk: true }, ['{d:Well.} {.}Thank you for saying so.', '{@slow}I\'ll take that. {.}Don\'t do it again.', '{d:Apology accepted. Mostly.}']);
R('so_ok_paid', 'sorry', { sorryOk: true, sorryPaid: true }, ['{d:Very well. We\'re square.}', 'Money doesn\'t mend everything. {.}But it\'s a start.']);
R('so_ok_killed', 'sorry', { sorryOk: true, sorryK: 'killed' }, ['{@crawl}{c:It doesn\'t bring {dead} back.} {.}But I can see you mean it.']);
R('so_no', 'sorry', { sorryOk: false }, ['{r:Sorry? Sorry doesn\'t mend it.}', '{r:Words are cheap, {name}.} {.}{d:It\'d take {price} to make it right.}', '{r:You\'ll have to do better than that.}']);
R('so_no_killed', 'sorry', { sorryOk: false, sorryK: 'killed' }, ['{@slow}{c:Sorry?} {.}{sr:Get out of my sight.}']);
R('thr_ok', 'threat', { threatOk: true }, ['{t:A-all right! All right.} I don\'t want any trouble.', '{t:Easy! Easy. I hear you.}', '{t:...Fine. Fine.}']);
R('thr_cowed', 'threat', { threatOk: true, cowed: true }, ['{t:Fine! It\'s forgotten. All of it.} {.}{d:Just leave me alone.}']);
R('thr_no', 'threat', { threatOk: false }, ['{r:You don\'t frighten me.}', '{sr:Try it. Go on. Try it.}', '{r:Guards! This one\'s making threats!}']);
R('thr_no_brave', 'threat', { threatOk: false, brave: true }, ['{g:Ha! I\'ve faced worse than you before breakfast.}']);

// ============================================================ together
R('gr_tax', 'group', { grp_tax: true }, ['{r:The taxes, {name}. Every month more, and for what?}', '{r:We can\'t pay what they ask and still eat.} {.}So we\'re asking for {grpAsk}.', '{d:{grpLeader} is speaking for us.} We want {grpAsk}, that\'s all.']);
R('gr_tax_lead', 'group', { grp_tax: true, grpLead: true }, ['{g:They chose me to speak for them.} {.}{r:And I\'ll not stop till the taxes come down.}']);
R('gr_hunger', 'group', { grp_hunger: true }, ['{@slow}{d:There are children going to bed hungry, {name}.} {.}{r:And the hall does nothing.}', '{r:Bread. That\'s all we\'re asking for. Bread.}']);
R('gr_safety', 'group', { grp_safety: true }, ['{t:After the raid? We need more guards. Anyone can see it.}', '{t:Next time they\'ll burn the whole town.} {.}{r:We want {grpAsk}.}']);
R('gr_mayor', 'group', { grp_mayor: true }, ['{r:The mayor\'s had their chance.} {.}We want {grpAsk}.', '{r:Things have gone from bad to worse under this mayor.}']);
R('gr_petition', 'group', { grpSt: 'petition' }, ['We\'ve put our names to a petition. {.}{d:Now we wait.}']);
R('gr_protest', 'group', { grpSt: 'protest' }, ['{r:They refused us!} So we\'re in the square every night till they listen.']);
R('gr_strike', 'group', { grpSt: 'strike' }, ['{r:Tools down.} Not a stroke of work till they hear us.', '{r:Let them see how the town runs without us.}']);
R('gr_militia', 'group', { grpSt: 'militia' }, ['{g:If the hall won\'t give us guards, we\'ll guard ourselves.} We drill every evening.']);
R('gr_share', 'group', { grpSt: 'share' }, ['{d:We share what we have.} It\'s not much. {.}It\'s something.']);
R('gr_join', 'group_join', {}, ['{g:With you behind us, they\'ll have to listen!}', '{w:Thank you! Tell everyone!}', '{g:See? Even {name} is with us!}']);
R('gr_calm_ok', 'group_calm', { calmOk: true }, ['{@slow}Maybe. {.}Maybe we\'ve been hot-headed.', '{d:You might be right. We\'ll give it time.}']);
R('gr_calm_no', 'group_calm', { calmOk: false }, ['{r:Easy for you to say.}', '{r:You don\'t live here. You don\'t know.}']);
R('gr_give', 'group_give', {}, ['{p:Bless you.} {.}There are children who\'ll eat tonight.', '{w:You\'ve done more than the whole council!}']);
R('pl_ok', 'plead', { pleadOk: true }, ['{d:Very well.} {.}I\'ll see what can be done.', '{d:...Perhaps I\'ve been too hard on them.}']);
R('pl_no', 'plead', { pleadOk: false }, ['{r:I\'ll not be told how to run this town.}', '{d:They\'ll get {grpAsk} when the coffers allow it. Not before.}']);
// ---- in the square
R('ra_tax', 'rally', { rallyK: 'tax' }, ['{r:Down with the taxes!}', '{r:We won\'t pay for their feasts!}', '{sr:Enough is enough!}', '{r:Every coin we earn, they take!}']);
R('ra_tax_lead', 'rally', { rallyK: 'tax', rallyLead: true }, ['{sr:Hear me! We want what\'s fair, and no more!}', '{g:Stand together, and they\'ll have to listen!}']);
R('ra_hunger', 'rally', { rallyK: 'hunger' }, ['{r:Bread! We want bread!}', '{sr:Our children are starving!}', '{r:Feed the hungry!}']);
R('ra_safety', 'rally', { rallyK: 'safety' }, ['{t:Who\'ll protect us next time?}', '{r:More guards! More guards!}', '{g:We\'ll stand guard ourselves!}']);
R('ra_mayor', 'rally', { rallyK: 'mayor' }, ['{r:Out! Out! Out!}', '{sr:We want a new mayor!}', '{r:Shame on the hall!}']);
R('ra_any', 'rally', {}, ['{r:Hear us!}', '{r:We won\'t be ignored!}']);
// ---- a grudge, had out
R('cf_any', 'confront', {}, ['{r:You know what you did.} {.}So what are you going to do about it?', '{r:I want an apology, {name}. Or I want it made right.}']);
R('cf_hot', 'confront', { hot: true }, ['{sr:Give me one reason I shouldn\'t lay you out right here!}']);
R('cf_timid', 'confront', { timid: true }, ['{t:I-I\'ve been working up the nerve to say this.} {.}{r:What you did was wrong.}']);
R('cfg_any', 'confront_group', {}, ['{r:{n} of us have had enough of you, {name}.} {.}Make it right, or don\'t show your face in {town}.', '{r:The town\'s talking. About you.} {.}{d:They sent me. What\'s it going to be?}']);
R('cfe_leave', 'confront_end', { confrontHow: 'leave' }, ['{r:This isn\'t over.}', '{r:Walk away, then. Everyone\'s watching.}']);
R('cfe_paid', 'confront_end', { confrontHow: 'paid' }, ['{d:Fine. We\'re square.} {.}For now.', '{d:Money talks, I suppose.}']);
R('cfe_forgiven', 'confront_end', { confrontHow: 'forgiven' }, ['{d:Well.} {.}I\'ll take that. Don\'t make me regret it.', '{@slow}I didn\'t expect that. {.}All right. It\'s done.']);
R('cfe_refused', 'confront_end', { confrontHow: 'refused' }, ['{r:Words. Just words.}', '{r:You think that\'s enough?}']);
// ---- thanks, advice, invitations, warnings
R('tk_gift', 'thanks', { thanksGift: true }, ['{w:Here. It\'s not much: {what}.} {.}I wanted you to have something.', '{p:Take this {what}. Please. I insist.}']);
R('tk_none', 'thanks', { thanksGift: false }, ['{p:I\'ve nothing to give you but my thanks.} {.}You have that.', '{w:If you ever need anything, you come to me.}']);
R('adv_any', 'advice', {}, ['{d:What do you think I should do?}', 'I trust you. Tell me straight.']);
R('adv_wait', 'advice_wait', {}, ['You\'re right. {.}I\'ll sleep on it.', '{d:Hm. I suppose there\'s no hurry.}']);
R('inv_any', 'invite', {}, ['{w:Come on! First round\'s on me!}', '{w:Everyone\'ll be there. Say you\'ll come!}']);
R('inv_yes', 'invite_yes', {}, ['{w:Come on, then! First round\'s mine.}', '{w:Ha! I knew you would!}']);
R('wn_any', 'warn', {}, ['{t:Watch yourself.} {.}{subj} has it in for you.', '{d:I\'ve said too much. But be careful of {subj}.}']);

// ============================================================ more for the moment
// ---- open: what's happened between them and others
R('o_new_friend', 'open', { mem_friend: true, joy: { min: 0.05 }, kid: false }, ['{w:I\'ve just come from {friend}\'s. We talked half the night!}', 'Have you met {friend}? {w:We\'ve become good friends, lately.}', '{w:{friend} and I are going fishing tomorrow. Can you believe I\'ve never been?}']);
R('o_quarrel', 'open', { mem_quarrel: true, anger: some }, ['{r:Don\'t mention {friend}. Or anyone. I\'m in a mood.}', '{r:Had words with someone today.} {.}I don\'t want to talk about it.', '{r:Some people, {name}. Some people!}']);
R('o_rival', 'open', { mem_rival: true, kid: false, anger: { min: 0.05 } }, ['{r:Have you seen {rival}? Strutting about like they own the place.}', '{g:I\'ll show {rival}. You\'ll see.}', '{r:If {rival} says one more word to me...}']);
R('o_heartbreak', 'open', { mem_heartbreak: true, grief: { min: 0.1 } }, ['{@slow}{c:Sorry. I\'m not much company today.} {.}{c:It\'s about {lostLove}.}', '{@slow}{c:They chose someone else.} {.}Of course they did.']);
R('o_rejected', 'open', { mem_rejected: true, shame: { min: 0.1 } }, ['{d:Don\'t look at me. I made a fool of myself.}', '{d:I told {lostLove} how I felt.} {.}{d:They laughed. Kindly. But they laughed.}']);
R('o_dream_done', 'open', { mem_dream_done: true, joy: some }, ['{wg:I did it, {name}! I actually did it!}', '{g:You\'re looking at someone who got exactly what they wanted.}', '{wg:Best day of my life. Ask me why!}']);
R('o_dream_lost', 'open', { mem_dream_lost: true, grief: { min: 0.1 } }, ['{@slow}{d:It\'s over. What I wanted.} {.}{c:It wasn\'t to be.}', '{@slow}{d:I gave it everything.} {.}It wasn\'t enough.']);
R('o_ceiling', 'open', { mem_ceiling: true, kid: false }, ['{@slow}{d:I\'ve found where my gift runs out.} {.}I\'ll never be the best. Strange, knowing it.', '{d:Some folk are born to it. I wasn\'t.} {.}{w:I\'m good, though. Good is something.}']);
R('o_made_up', 'open', { mem_made_up: true, joy: { min: 0.1 } }, ['{w:{name}! We made it up! After all these years!}', '{p:I had dinner with family I hadn\'t spoken to in years.} {.}{w:We laughed like children.}']);
R('o_petition_won', 'open', { mem_petition_won: true, joy: some }, ['{g:We won, {name}! They listened to us!}', '{wg:The hall gave in! That\'s what happens when we stand together!}']);
R('o_joined', 'open', { mem_joined: true, anger: some, kid: false }, ['{r:Are you with us or against us?}', '{r:You\'ve heard what\'s going on? We\'ve had enough.}']);
R('o_betrayed', 'open', { mem_betrayed: true, anger: some }, ['{r:You think you know people.} {.}{c:And then you find out what they say behind your back.}']);
R('o_sat_with', 'open', { mem_sat_with: true, grief: some }, ['{@slow}{c:{friend} sat with me again last night.} {.}{p:I don\'t know what I\'d do without them.}']);
R('o_vigil', 'open', { mem_vigil: true, grief: { min: 0.1 } }, ['{@slow}{c:We kept the vigil last night.} {.}So many candles. {dead} would have hated the fuss.']);
R('o_militia', 'open', { mem_militia: true, kid: false }, ['{g:I\'ve been drilling with the others.} Next time, we\'ll be ready.']);
R('o_learned', 'open', { mem_learned: true, pride: { min: 0.1 } }, ['{g:I\'ve read every book in {town}, {name}.} {.}Some of them twice.']);
R('o_stayed', 'open', { mem_stayed: true, kid: false }, ['I nearly left {town}, you know. {.}{w:Glad I didn\'t.}']);
// ---- open: what's between them and you
R('o_you_threatened', 'open', { memPk: 'threatened', fear: { min: 0.05 } }, ['{t:W-what do you want now?}', '{t:I don\'t want any trouble.}']);
R('o_you_threatened_angry', 'open', { memPk: 'threatened', anger: some, brave: true }, ['{r:Back again? Going to threaten me some more?}']);
R('o_you_liar', 'open', { memPk: 'liar', kid: false }, ['{d:Oh. You.} {.}Spreading tales again?', '{d:Heard any good lies lately, {name}?}']);
R('o_you_slander', 'open', { memPk: 'slander' }, ['{r:I know what you said about me.}', '{sr:Liar! I know it was you!}']);
R('o_you_forgave', 'open', { memPk: 'forgave', kid: false }, ['{d:We\'re square, you and I.} {.}{w:Let\'s keep it that way.}']);
R('o_you_peace', 'open', { memPk: 'peace_made', joy: { min: 0.05 } }, ['{w:You were right, you know. About making it up.} We\'re speaking again!']);
R('o_you_helped', 'open', { memPk: 'helped', kid: false }, ['{w:{name}! I haven\'t forgotten what you did for me.}', '{g:Here\'s the one who helped me!} Anything you need, ask.']);
R('o_you_fed', 'open', { memPk: 'fed' }, ['{p:You fed us when nobody else would.} {.}Come in, come in.']);
R('o_you_taught', 'open', { memPk: 'shown', kid: false }, ['{g:I tried that thing you showed me!} {.}{w:It worked!}']);
R('o_you_sparred', 'open', { memPk: 'sparred', kid: false }, ['{g:Ready for another bout?} {.}My arm\'s still sore from the last.', '{g:You\'ve a good arm, {name}.} I\'ve been practising.']);
R('o_you_drink', 'open', { memPk: 'drink', kid: false }, ['{w:{name}! My drinking companion!}', '{w:My head still hurts from the other night. Your fault.}']);
R('o_you_talked_out', 'open', { memPk: 'talked_out', kid: false }, ['I\'ve been thinking about what you said. {.}{d:You were probably right.}']);
R('o_you_introduced', 'open', { memPk: 'introduced', joy: { min: 0.05 } }, ['{w:Thank you for introducing me to {friend}!}']);
// ---- open: what they're after
R('o_amb_master', 'open', { amb_master: true, diligent: true, kid: false }, ['Can\'t stop long. {.}{g:I\'m working late again. I\'m close to something.}', '{g:Another long night at the work.} I\'ll be the best yet.']);
R('o_amb_trade', 'open', { amb_trade: true, kid: false }, ['{d:Don\'t tell anyone, but I\'m learning to be a {ambTrade}.}', 'I was up till midnight practising. {w:A {ambTrade}, one day. You\'ll see.}']);
R('o_amb_wed', 'open', { amb_wed: true, love: some }, ['{p:Do I look all right? Be honest.}', '{p:Have you seen {ambWho} today?} {.}{d:No reason.}']);
R('o_amb_leave', 'open', { amb_leave: true, strain: some }, ['{d:I\'ve been looking at the roads out of {town}.} {.}Just looking.', '{@slow}{d:Some days I think I should just pack up and go.}']);
R('o_amb_office', 'open', { amb_office: true, kid: false }, ['{g:If I were mayor, things would be different round here.}', 'Folk are asking me to stand for mayor. {.}{g:Maybe I will.}']);
R('o_amb_protect', 'open', { amb_protect: true, kid: false }, ['{g:I\'ve been training with the watch.} Never again will I stand by and watch.']);
R('o_amb_revenge', 'open', { amb_revenge: true, ambOnYou: false, anger: some }, ['{r:{ambWho} will get what\'s coming to them.} {.}Mark my words.']);
R('o_amb_provide', 'open', { amb_provide: true, hungry: true }, ['{d:I\'ll do any work you\'ve got.} {.}Any at all. We need to eat.']);
R('o_amb_child', 'open', { amb_child: true, love: { min: 0.1 } }, ['{p:We\'ve been talking about children.} {.}{w:I think we\'re ready.}']);
R('o_grp_strike', 'open', { grpSt: 'strike', kid: false }, ['{r:No work today. Not till they listen.}', '{r:We\'ve downed tools, {name}.} You can tell the hall that.']);
R('o_grp_protest', 'open', { grpSt: 'protest', kid: false }, ['{r:Coming to the square tonight? We\'ll make them hear us.}']);
R('o_grp_militia', 'open', { grpSt: 'militia', kid: false }, ['{g:Drill tonight in the square.} You could join us.']);
R('o_grp_shun', 'open', { grpOnYou: true }, ['{r:You\'re not welcome here, {name}.}', '{r:Everyone knows about you now.}']);
// ---- greet: in passing
R('g_friend', 'greet', { mem_friend: true, joy: { min: 0.05 } }, ['{w:Off to see {friend}!}', 'Can\'t stop, {friend}\'s waiting!']);
R('g_rival', 'greet', { mem_rival: true, anger: { min: 0.05 } }, ['{r:Seen {rival} about?}']);
R('g_grp', 'greet', { grpSt: ['protest', 'strike'] }, ['{r:Hear us, {name}!}', '{r:Are you with us?}']);
R('g_amb_wed', 'greet', { amb_wed: true, love: some }, ['{p:Have you seen {ambWho}?}']);
R('g_shun', 'greet', { grpOnYou: true }, ['{r:Keep walking.}', '*looks away*']);
R('g_you_threat', 'greet', { memPk: 'threatened', fear: { min: 0.05 } }, ['{t:*hurries past*}']);
R('g_you_helped', 'greet', { memPk: ['helped', 'fed', 'peace_made'] }, ['{w:There\'s my friend!}', '{w:Good to see you, {name}!}']);
// ---- feel: how they really are
R('f_amb_master', 'feel', { amb_master: true }, ['Tired. {.}{g:But I\'m getting better at it every day. I can feel it.}']);
R('f_amb_trade', 'feel', { amb_trade: true }, ['Restless. {.}{d:I\'m in the wrong life, {name}. I\'m trying to change that.}']);
R('f_amb_wed', 'feel', { amb_wed: true }, ['{p:Lonely, if I\'m honest.} {.}But there\'s someone. Maybe.', '{p:Hopeful.} {.}{d:Don\'t ask me why.}']);
R('f_amb_leave', 'feel', { amb_leave: true }, ['{@slow}{d:Like I don\'t belong here any more.}', '{@slow}{d:Ready to go. Somewhere. Anywhere.}']);
R('f_amb_revenge', 'feel', { amb_revenge: true, ambOnYou: false }, ['{r:Angry. And I\'ve every right to be.}']);
R('f_amb_provide', 'feel', { amb_provide: true }, ['{@slow}{d:Worried sick.} {.}There\'s nothing in the cupboard.']);
R('f_grp', 'feel', { grp: ['tax', 'hunger', 'mayor'] }, ['{r:Fed up. Like half of {town}.}', '{r:Angry. We all are. You\'ve heard about {grpWhat}?}']);
R('f_grp_safety', 'feel', { grp: 'safety' }, ['{t:Frightened, if you must know. We all are, since the raid.}']);
R('f_friend', 'feel', { mem_friend: true, joy: some }, ['{w:Good! I\'ve made a friend. At my age!}']);
R('f_heartbreak', 'feel', { mem_heartbreak: true }, ['{@slow}{c:Heartsore.} {.}{c:It\'ll pass. They say it passes.}']);
R('f_rejected', 'feel', { mem_rejected: true }, ['{d:Foolish. I made a fool of myself.}']);
R('f_dream_lost', 'feel', { mem_dream_lost: true }, ['{@slow}{d:Lost, a bit.} {.}What do you do when the thing you wanted is gone?']);
R('f_dream_done', 'feel', { mem_dream_done: true }, ['{wg:Like I could fly!}', '{g:Proud. Properly proud, for once.}']);
// ---- bark: said aloud
R('b_amb_master', 'bark', { amb_master: true, feel: 'pride' }, ['{g:One more hour. Just one more.}', '{g:Getting there. Getting there.}']);
R('b_amb_wed', 'bark', { amb_wed: true, feel: 'love' }, ['{p:*sighs dreamily*}', '{p:I wonder if {ambWho} is here tonight...}']);
R('b_amb_leave', 'bark', { amb_leave: true }, ['{d:This town. This blasted town.}']);
R('b_rival', 'bark', { mem_rival: true, feel: 'anger' }, ['{r:{rival} thinks they\'re so clever.}']);
R('b_dream_done', 'bark', { mem_dream_done: true, feel: 'joy' }, ['{wg:Drinks on me! I did it!}', '{wg:To dreams! May they all come true!}']);
R('b_heartbreak', 'bark', { mem_heartbreak: true, feel: 'grief' }, ['{@slow}{c:*stares at the door every time it opens*}']);
R('b_friend', 'bark', { mem_friend: true, feel: 'joy' }, ['{w:To {friend}! Best friend a soul could have!}']);
R('b_vigil', 'bark', { mem_vigil: true, feel: 'grief' }, ['{@slow}{c:*lights a candle*}']);
// ---- pair: two of them talking
R('p_friend', 'pair', { mem_friend: true }, ['{w:{friend} and I are off to the river tomorrow. Come along?} || {w:Wouldn\'t miss it!}', 'Have you seen how close I\'ve got with {friend}? || {w:The whole street\'s noticed.}']);
R('p_quarrel', 'pair', { mem_quarrel: true }, ['{r:I\'m not speaking to {friend}. Not ever.} || {d:You said that last time.}', '{r:Did you hear what {friend} said to me?} || {d:Everyone heard. You were both shouting.}']);
R('p_rival', 'pair', { mem_rival: true }, ['{r:{rival} thinks they\'re better than me.} || {d:Are they?}', '{r:One day I\'ll show {rival}.} || {w:I\'d pay to see it.}']);
R('p_heartbreak', 'pair', { mem_heartbreak: true }, ['{@slow}{c:I saw {lostLove} with someone else today.} || {p:Oh, love. Come here.}']);
R('p_amb_trade', 'pair', { amb_trade: true }, ['I\'m going to be a {ambTrade}. || {d:You? Well. Why not.}', 'Teach me what you know about it? || {w:If you buy the ale.}']);
R('p_amb_leave', 'pair', { amb_leave: true }, ['{d:I\'m thinking of leaving.} || {t:Don\'t! What would we do without you?}', '{d:Have you ever thought of just... going?} || {d:Every day. Every single day.}']);
R('p_amb_office', 'pair', { amb_office: true }, ['{g:If I stood for mayor, would you vote for me?} || {w:Twice, if they\'d let me.}', 'I\'d do better than the mayor. || {d:A goat would do better than the mayor.}']);
R('p_amb_wed', 'pair', { amb_wed: true }, ['{p:Do you think {ambWho} likes me?} || {w:Only one way to find out!}', '{p:I can\'t stop thinking about {ambWho}.} || {w:Then tell them, you fool!}']);
R('p_amb_venture', 'pair', { amb_venture: true }, ['{g:I\'m going to open a place of my own.} || {w:I\'ll be your first customer!}']);
R('p_amb_revenge', 'pair', { amb_revenge: true, ambOnYou: false }, ['{r:{ambWho} will be sorry.} || {d:Let it go. It\'s eating you up.}']);
R('p_grp_tax', 'pair', { grp_tax: true }, ['{r:Have you seen what they\'re taking now?} || {r:Daylight robbery, that\'s what it is.}', '{r:Are you signing the petition?} || {r:Signed it twice.}']);
R('p_grp_hunger', 'pair', { grp_hunger: true }, ['{d:Have you anything to spare?} || {d:A crust. Take half.}']);
R('p_grp_safety', 'pair', { grp_safety: true }, ['{t:Did you bar your door last night?} || {t:Bar it? I sat up with the poker.}']);
R('p_grp_strike', 'pair', { grpSt: 'strike' }, ['{r:Are you working today?} || {r:Not a stroke. Not till they listen.}']);
R('p_bad_word', 'pair', { heard_bad_word: true }, ['{d:Did you know {badTeller} has it in for {badWho}?} || {t:Everyone knows. Stay out of it.}']);
R('p_petition_won', 'pair', { mem_petition_won: true }, ['{g:We did it! They listened!} || {wg:Drinks tonight!}']);

export { RULES };
