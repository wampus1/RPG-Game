// Villagers talk among themselves: when two of them idle close together
// near the player, one opens a short exchange about food, taxes, the
// weather, the news, the dead, each other, or you.
import { kitchenOf, st } from '../sim/econ.js';
import { affinity, griefOf } from './dialogue.js';
import { relationTo } from '../sim/favors.js';
import { HOBBIES } from '../entities/npcgen.js';
import { LAWS, lawList, stance } from '../sim/laws.js';
import { speak } from './voice.js';

const CHATTY = new Set(['social', 'hobby', 'wander', 'eat', 'home', 'play', 'work', 'visit']);

function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

// Lines for `a` talking to `b`: [opener, reply] or [opener, reply, closer].
export function exchangeFor(a, b, game) {
  const ra = a.rec;
  const rb = b.rec;
  const L = a.layout;
  const e = L.econ;
  const sim = game.sim;
  const rng = a.rng;
  const B = rb.name.first;
  const Aname = ra.name.first;
  const rel = relationTo(ra, rb);
  const af = affinity(ra, rb);
  const opts = [];
  const h = game.minute / 60;
  const tw = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  if (ra.age === 'child' && rb.age === 'child') {
    opts.push([`Tag! You're it, ${B}!`, 'No fair! I wasn\'t ready!'], [`${B}, wanna play hide and seek?`, 'Okay! You count!'],
      [`Race you to the well, ${B}!`, 'Ready, steady... hey, you cheated!'], ['I found a frog by the water!', 'Show me! Show me!'],
      [`My ${pick(rng, ['mum', 'dad'])} says I can stay up late tonight.`, 'No way! Mine never lets me.'], ['What do you want to be when you grow up?', pick(rng, ['A guard! With a real sword!', 'A merchant, and see every town.', 'Mayor. Then no bedtimes.']), 'Cool.'],
      ['Let\'s build a fort behind the houses.', 'Only if I can be the captain.'], ['Do you think there are monsters in the ruins?', 'My brother says there are skeletons!', 'Ooh...']);
    return pick(rng, opts);
  }
  // Work talk between people in the same line of work, or about the job.
  const jobTalk = {
    farmer: [['The wheat\'s coming on nicely.', 'Could do with a drop more rain, mind.'], ['Crows at my cabbages again.', 'Put up another scarecrow.']],
    fisher: [['Fish are biting well at dawn.', 'Save some for the rest of us!'], ['Lost a big one this morning.', 'They always are, the ones that get away.']],
    guard: [['Quiet watch last night.', 'Long may it stay that way.'], ['Keep an eye on the east road tonight.', 'Always do.']],
    cook: [['I need more meat for the pot.', 'The trappers will be back by evening.'], ['Tried a new stew today.', 'Was that what that smell was?', 'Cheek!']],
    blacksmith: [['Ore\'s been scarce this week.', 'The miners say the seams are thin.'], ['My hammer arm is killing me.', 'All that clanging! We hear it across town.']],
    trapper: [['Plenty of tracks out in the woods.', 'Good. The tavern needs meat.'], ['Wolves took one of my snares.', 'Better a snare than a leg.']],
    builder: [['That new house is nearly up.', 'You lot work fast.'], ['We\'re short of timber again.', 'Talk to the woodcutters.']],
    miner: [['Found a good seam today.', 'Iron or coal?', 'Both, if I\'m lucky.'], ['My back aches from the pick.', 'Honest work, though.']],
    lumberjack: [['Felled a big oak today.', 'That\'ll make a fine beam or two.']],
    priest: [['Will I see you at the temple?', 'I\'ll try, I promise.'], ['Remember the dead in your prayers.', 'Always.']],
    mayor: [['The council meets again tomorrow.', 'Anything I should know about?', 'Only the usual: money.'], ['How is the town treating you?', 'Well enough, mayor.']],
    merchant: [['The roads were long this time.', 'Any trouble on the way?', 'Nothing a good cart can\'t outrun.']],
    herbalist: [['Found some good mushrooms by the stream.', 'The safe kind, I hope!']],
    tailor: [['Everyone wants new clothes before the feast.', 'Busy times, then.']],
    baker: [['Fresh bread this morning!', 'I could smell it from my bed.']],
  }[ra.job];
  if (jobTalk) opts.push(...jobTalk);
  // The laws: they may well not agree.
  const laws = lawList(L);
  if (laws.length && ra.age !== 'child') {
    const id = laws[(ra.idx + game.day) % laws.length];
    const nm = LAWS[id].name.toLowerCase();
    const sa = stance(ra, id);
    const sb = stance(rb, id);
    const open = sa >= 0 ? `This ${nm} is doing us good, ${B}.` : `This ${nm} is a nuisance, ${B}.`;
    opts.push(sa * sb >= 0 ? [open, 'I couldn\'t agree more.'] : [open, sa >= 0 ? 'You think so? I\'d scrap it tomorrow.' : 'Nonsense. We need it.', 'Well, we\'ll have to disagree.']);
  }
  // Funerals to go to, weddings, births and other goings-on.
  const fun = (e.funerals || []).find((f) => f.s > sim.abs && f.s - sim.abs < 1440);
  if (fun) opts.push([`Are you going to ${fun.first}'s funeral tomorrow?`, 'Of course. We all should.']);
  const ev = [...e.ledger].reverse().find((it) => it.day >= game.day - 2 && /married|born to|came of age|was chosen|has grown|feast/.test(it.text));
  if (ev) {
    if (/married/.test(ev.text)) opts.push(['What a lovely wedding that was.', 'I cried the whole way through.']);
    else if (/born to/.test(ev.text)) opts.push(['Have you seen the new baby?', 'Tiny thing. Loud, though!']);
    else if (/came of age/.test(ev.text)) opts.push(['They grow up so fast, don\'t they?', 'Makes you feel old.']);
    else if (/was chosen/.test(ev.text)) opts.push(['What do you make of the new mayor?', 'Give them time.']);
    else if (/has grown/.test(ev.text)) opts.push([`${L.settlement.name}'s getting to be quite a place.`, 'I remember when it was a few huts.']);
    else if (/feast/.test(ev.text)) opts.push(['That feast! I\'m still full.', 'Me too. I regret nothing.']);
  }
  if (e.bellAt !== undefined && sim.abs - e.bellAt < 720) opts.push(['Did you hear the bell ring last night?', 'Nearly jumped out of my skin.', 'The watch saw them off, I heard.']);
  const rum = (e.rumours || [])[(e.rumours || []).length - 1];
  if (rum) opts.push([`A merchant from ${rum.from} was saying there's news over there.`, 'Oh? What sort of news?', `${rum.text.slice(0, 70)}${rum.text.length > 70 ? '...' : ''}`]);
  // A hobby they share.
  const both = (ra.hobbies || []).find((hk) => (rb.hobbies || []).includes(hk) && HOBBIES[hk]);
  if (both) opts.push([`Fancy some ${HOBBIES[both].label} later, ${B}?`, 'Wouldn\'t miss it.']);
  // Old folk remember.
  if (ra.age === 'elder') opts.push([`In my day, ${B}, we didn't have half of this.`, 'So you keep telling us.'], ['My knees say rain is coming.', 'Your knees are never wrong.']);
  if (ra.age === 'adult' && ra.children && ra.children.length) opts.push(['The children are running me ragged.', 'Wait till they\'re older.']);
  if (e.treasury < L.npcs.length * 6) opts.push(['They say the town coffers are nearly empty.', 'Then who pays the guards?']);
  const night = game.minute >= 1200 || game.minute < 300;
  if (night) opts.push(['Clear night. Look at those stars.', 'Makes you feel small, doesn\'t it?'], ['Getting late.', 'One more drink, then home.']);
  if (rel === 'partner') opts.push([`Home for supper, ${B}?`, 'Wouldn\'t miss it.'], [`There you are, ${B}.`, 'Here I am. Miss me?', 'Always.']);
  if (rel === 'parent' && ra.age === 'child') opts.push([`${B}, can I have a sweet?`, 'After supper.', 'Awww...']);
  if (rel === 'child' && rb.age === 'child') opts.push([`Stay where I can see you, ${B}.`, 'Yes, yes...']);
  if (rel === 'friend') opts.push([`${B}! Fancy a drink later?`, 'You\'re buying.'], [`Good to see you, ${B}.`, 'You too, old friend.']);
  if (af < -0.35 && !rel) opts.push([`Oh. It's you, ${B}.`, `Charmed as always, ${Aname}.`], [`You still owe me, ${B}.`, 'I paid you back!', 'Did not.']);
  const g = griefOf(ra);
  if (g) {
    opts.push([`I keep thinking about ${g.first}.`, `We all do, ${Aname}. We all do.`]);
    return pick(rng, opts);
  }
  const k = kitchenOf(L);
  if (k) {
    if (st.count(k.store, 'feast')) opts.push(['Have you had the feast at the tavern?', 'Twice! Don\'t tell anyone.']);
    else if (st.count(k.store, 'gruel') && !st.count(k.store, 'stew')) opts.push(['Did you try the gruel today?', 'Don\'t remind me.']);
    else if (!st.count(k.store, 'stew')) opts.push(['The tavern\'s out of food again.', 'Those trappers need to pull their weight.']);
    else opts.push(['Stew again at the tavern.', 'Could be worse.']);
  }
  if (ra.hungry >= 1) opts.push([`${B}, have you any bread to spare?`, rb.personality.kindness > 0.55 ? 'Here, take some. Don\'t mention it.' : 'Sorry, we barely have enough ourselves.']);
  if (e.tax >= 0.16) opts.push([`${Math.round(e.tax * 100)}% tax! Can you believe it?`, 'Robbery, that\'s what it is.']);
  else if (e.tax <= 0.05) opts.push(['Taxes are low this season.', 'Long may it last.']);
  const w = game.weatherIn ? game.weatherIn(a.settlement) : game.weather && game.weather.kind;
  if (w === 'rain') opts.push(['Wet enough for you?', 'My boots are soaked through.']);
  else if (w === 'snow') opts.push(['Snow again...', 'I can\'t feel my toes.']);
  else if (w === 'fog') opts.push(['Can\'t see a thing in this fog.', 'Mind you don\'t walk into the well.']);
  const news = [...e.ledger].reverse().find((it) => it.day >= game.day - 1 && it.day > 0);
  if (news) opts.push([`Did you hear? ${news.text}`, pick(rng, ['No! Really?', 'I heard. Can you believe it?', 'Everyone\'s talking about it.'])]);
  const visits = (sim.visits.get(L.settlement.id) || []).filter((v) => sim.abs >= v.arrive && sim.abs < v.leave);
  if (visits.length) opts.push([`There's a merchant from ${visits[0].fromName} on the square.`, 'I might have a look later.']);
  if (ra.job === rb.job && ra.job !== 'retired') opts.push(['Busy day?', 'Never ends.'], ['Think we\'ll finish early today?', 'Ha! Dream on.']);
  // Gossip about the player, when they're within earshot.
  const p = game.player;
  if (Math.max(Math.abs(p.x - a.x), Math.abs(p.z - a.z)) <= 7) {
    const sid = a.settlement.id;
    const name = game.playerName;
    const op = sim.opinion(a);
    const met = sim.repEntry(sid, ra.idx).met;
    if (sim.justice.pendingIn(sid).length || sim.justice.recordOf(sid).convictions) opts.push([`That's ${name}. I heard they're trouble.`, 'Shh! Keep your voice down!']);
    else if (sim.careers.isGuard(sid)) opts.push([`${name} joined the watch, you know.`, 'About time we had more guards.']);
    else if (sim.isCitizen(sid)) opts.push([`${name} has settled in nicely.`, 'Seems a decent sort.']);
    else if (op >= 35) opts.push([`${name} is a good sort.`, 'Agreed.']);
    else if (op <= -25) opts.push([`Watch that one, ${B}.`, '*nods*']);
    else if (!met) opts.push(['Who\'s the stranger?', 'No idea. A traveler, I think.']);
  }
  opts.push([`${tw}, ${B}!`, `${tw}, ${Aname}.`], ['How\'s the family?', 'Can\'t complain. You?', 'Same old.'], ['Nice day for it.', 'It is, isn\'t it?']);
  return pick(rng, opts);
}

// Called every frame: now and then, start a conversation between two
// idle villagers the player can see, and play queued lines in turn.
export function ambientChatter(game, dt) {
  const c = game.chatter || (game.chatter = { t: 5, clock: 0, queue: [] });
  c.clock += dt;
  for (const q of c.queue) {
    if (q.done || c.clock < q.at) continue;
    q.done = true;
    const n = q.n;
    if (n.dead || n.state !== 'routine' || n.sleeping || n.distTo(q.to) > 3) {
      c.queue.forEach((o) => { if (o.id === q.id) o.done = true; });
      continue;
    }
    n.face(q.to.x, q.to.z);
    // In their own voice (their greeting habits for the first line).
    n.say(speak(n.rec, q.text, { first: q.first }), 3.2);
  }
  c.queue = c.queue.filter((q) => !q.done);
  c.t -= dt;
  if (c.t > 0) return;
  c.t = 4 + Math.random() * 6;
  const p = game.player;
  const idle = (n) => !n.dead && n.state === 'routine' && !n.sleeping && !n.moving && !n.bubble && n.atGoal && CHATTY.has(n.act)
    && (n.chatUntil || 0) < c.clock && Math.abs(n.x - p.x) < 18 && Math.abs(n.z - p.z) < 14;
  const near = game.npcs.filter(idle);
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [near[i], near[j]] = [near[j], near[i]];
  }
  for (const a of near) {
    const b = near.find((o) => o !== a && o.layout === a.layout && Math.max(Math.abs(o.x - a.x), Math.abs(o.z - a.z)) <= 2);
    if (!b) continue;
    const lines = exchangeFor(a, b, game);
    const id = c.clock;
    lines.forEach((text, i) => {
      const [n, to] = i % 2 === 0 ? [a, b] : [b, a];
      c.queue.push({ id, n, to, text, at: c.clock + i * 2.6, first: i < 2 });
    });
    a.chatUntil = b.chatUntil = c.clock + 40 + Math.random() * 40;
    return;
  }
}
