// Personality-flavoured dialogue for NPCs: passing remarks, and the topics
// of a conversation (who they are, their work, news, life in town, family,
// other townsfolk, directions, small talk with questions back, favours,
// jobs, professions, escorts, citizenship, the law...). Lines refer to
// other people by name, never by gendered pronouns.
import { speak, speakAll } from './voice.js';
import { JOBS, HOBBIES, jobTitle } from '../entities/npcgen.js';
import { MAP_W } from '../config.js';
import { BUILDING_NAMES, TRADE_BENCHES } from '../world/settlement.js';
import { ITEMS } from '../world/items.js';
import { alive, kitchenOf, mayorOf, st, activityFor, DAY, stockOf, ledger, freshRumours } from '../sim/econ.js';
import { TIERS } from '../sim/growth.js';
import { repLevel } from '../sim/sim.js';
import { PROFESSIONS, clock, bare, licensesFor, licenceFee } from '../sim/careers.js';
import { TECHS } from '../sim/tech.js';
import { LAWS, LAW_IDS, lawOn, lawList, lawFits, stance, willSign, needed, decide } from '../sim/laws.js';
import { plural, relationTo } from '../sim/favors.js';
import { deserted } from '../sim/civic.js';
import { hash4, RNG } from '../util/rng.js';
import { authority, rulerTitle } from '../sim/realms.js';
import { listNames, leavingWhen } from '../sim/outings.js';
import { countItem, removeItem } from './inventory.js';
import { rainedRecently } from '../world/weather.js';
import { festivalName, customsTalk, religionOf, cuisineOf } from '../sim/culture.js';
import { smallTalk } from './markov.js';
import { gossipLines } from '../sim/society.js';
import { geoTalk } from './geotalk.js';
import { fortuneOf } from '../sim/prosperity.js';
import { isStar, starGreeting, wingTalk } from './starfall.js';
import { sagaTopics, sagaRespond, isSagaTopic } from '../sim/saga/talk.js';
import { MOTIFS, pidOf as sagaPidOf } from '../sim/saga/core.js';
import { INN_NIGHTS, innFor, innPrice, stayAt, rentRoom, stayLeft } from '../sim/inns.js';

const MOTIFS_OF = (S, th) => MOTIFS[th.m];
const sagaPid = (game) => sagaPidOf(game.player);

function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

function timeWord(minute) {
  const h = minute / 60;
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function aOrAn(w) {
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

export function griefOf(rec) {
  return (rec.grief || []).filter((g) => g.rel !== 'acquaintance').sort((a, b) => (a.rel === 'family' ? -1 : 1) - (b.rel === 'family' ? -1 : 1))[0] || null;
}

// A short remark as the player walks past.
export function greetLine(npc, game, rep, citizen) {
  return speak(npc.rec, greetRaw(npc, game, rep, citizen), { first: true, warm: rep >= 35, cold: rep <= -25 });
}

function greetRaw(npc, game, rep, citizen) {
  const rng = npc.rng;
  const p = npc.rec.personality;
  const tw = timeWord(game.minute);
  const name = game.playerName;
  if (game.isWanted(npc.settlement.id)) return pick(rng, ['Stay away from me!', 'Criminal...', 'The guards are after you!', '...']);
  const g = griefOf(npc.rec);
  if (g) return pick(rng, ['...', `*sigh*`, `I keep thinking about ${g.first}...`]);
  if (rep <= -60) return pick(rng, ['Get lost.', 'You again...', '*glares*', 'Leave us be.']);
  if (rep <= -25) return pick(rng, ['Hmph.', 'Watch yourself.', 'Keep walking.', '*mutters*']);
  if (npc.rec.hungry >= 2 && rng.chance(0.5)) return pick(rng, ['So hungry...', 'Got any bread to spare?']);
  const car = game.sim.careers;
  if (npc.rec.job === 'guard' && car.isGuard(npc.settlement.id) && rng.chance(0.6)) return pick(rng, [`Good ${tw}, colleague.`, `All quiet, ${name}?`, 'Keep your eyes sharp out there.']);
  if (car.employs(npc)) return pick(rng, [`Morning, ${name}!`, 'Don\'t be late for your shift!', `Good ${tw}! See you at work.`]);
  if (car.isGuard(npc.settlement.id) && rng.chance(0.3)) return pick(rng, [`Good ${tw}, officer.`, 'Thank you for keeping us safe!']);
  if (rep >= 35) return pick(rng, [`${name}! Good ${tw}!`, `Hello, ${name}!`, `Always good to see you, ${name}.`, `Lovely ${tw}, isn't it, ${name}?`]);
  if (citizen) return pick(rng, [`Morning, neighbour!`, `Good ${tw}, neighbour.`, `Settling in well, ${name}?`, 'Hello there, neighbour!']);
  if (p.kindness < 0.3) return pick(rng, ['Hmph.', 'What?', 'Move along.', 'Busy.']);
  if (p.sociability > 0.7) return pick(rng, [`Good ${tw}!`, 'Hello there!', 'Lovely day!', 'Hi, stranger!', 'Welcome!']);
  return pick(rng, [`${tw === 'night' ? 'Evening' : 'Hello'}.`, 'Hm? Oh, hi.', `Good ${tw}.`, 'Safe travels.']);
}

// Legacy one-liners.
export function dialogueLine(npc, game, kind) {
  if (kind === 'greet') return greetLine(npc, game, game.sim ? game.sim.opinion(npc) : 0, false);
  return '';
}

// First thing they say when you start talking.
export function openingLine(npc, game) {
  const op = game.sim ? game.sim.opinion(npc) : 0;
  return speak(npc.rec, openingRaw(npc, game), { first: true, warm: op >= 35, cold: op <= -25 });
}

function openingRaw(npc, game) {
  // (A story's own: what their story has them say first.)
  if (npc.saga) {
    const S = game.sim.saga;
    const th = S && S.thread(npc.saga.th);
    const M = th && MOTIFS_OF(S, th);
    const a = th && S.actorSpec(th, npc.saga.key);
    if (M && M.hello && a) return M.hello(th, a, npc, sagaPid(game), S) || '...';
    return npc.saga.hello || '...';
  }
  const rec = npc.rec;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const tw = timeWord(game.minute);
  const sim = game.sim;
  const rep = sim.opinion(npc);
  const entry = sim.repEntry(s.id, rec.idx);
  const name = game.playerName;
  if (npc.adventurer) {
    if (game.duel && game.duel.npc === npc) return 'Talk later. Fight now!';
    // A citizen is a local to them; someone who belongs nowhere, one of their own.
    return sim.citizen
      ? pick(rng, [`A local! Maybe you can tell me: is ${s.name}'s tavern any good?`, `Well met. ${s.name} treating you well?`, 'Hail. Don\'t mind me, just passing through.'])
      : pick(rng, ['Another wanderer! Well met, friend.', 'Hail, traveller. Long road?', 'Ha, I know that look: you\'ve slept under the stars too.']);
  }
  if (npc.company) {
    const g = npc.company;
    const where = npc.caravan ? (npc.caravan.camp ? 'Pull up a log by the fire, friend.' : `On our way to ${npc.caravan.to}.`) : `We're camped outside ${s.name} for a day or so.`;
    if (rec.role === 'guard') return pick(rng, [`Easy, now. You're near ${g.name}'s wagons.`, `Hold there. ...Ah, just a traveller. Go on, then.`, `Keep your hands where I can see them, friend. Nothing personal.`]);
    return pick(rng, [`Well met! ${rec.name.first} ${rec.name.last}, of ${g.name}. ${where}`, `Customers! Come, come: goods from every corner of the land. ${where}`, `Ah, hello there. ${where}`]);
  }
  if (npc.nomad) return pick(rng, [`Greetings. We're the ${rec.name.last}s, travellers. Is this a good place to live?`, 'Hello there. We\'re just passing through... or maybe not.', `The road's been long. What's ${s.name} like?`]);
  const cf = sim.confront;
  if (cf && cf.arrived && cf.idx === rec.idx && cf.sid === s.id) {
    return cf.stage === 'expel'
      ? `I warned you, ${name}. Nothing has changed, and the council has voted: you are no longer welcome as a citizen of ${s.name}.`
      : `${name}, we need to talk. People keep coming to me about you: stealing, fighting, rudeness. As mayor I can't let it go on. Change your ways, or lose your citizenship.`;
  }
  if (game.isWanted(s.id) && rec.job !== 'guard') return pick(rng, ['I have nothing to say to the likes of you.', 'Guards! Someone help!', 'Please... just go.']);
  // A fallen star: the first time, and now and then after, it's your wing
  // they talk about (some of them warily: see starfall.js).
  if (isStar(game.hero) && (!entry.met || rng.next() < 0.2)) return starGreeting(rec, s.id, () => rng.next());
  // Your own family (if you were born here).
  const kin = sim.familyOf(rec);
  const first = name.split(' ')[0];
  if (kin === 'parent' && rep > -20) return pick(rng, [`There you are, ${first}! Have you eaten?`, `Hello, love. Staying out of trouble?`, `${first}! Come here, let me look at you.`, `Home for supper tonight, ${first}? I'll set a place.`, 'My child! What do you need?']);
  if (kin === 'sibling' && rep > -20) return rec.age === 'child' ? pick(rng, [`${first}! Will you play with me?`, 'Mum says you have to take me with you!', 'Guess what I found today!']) : pick(rng, [`Oh, it's you, ${first}.`, `Hey, ${first}! Mum was asking after you.`, 'Borrowed my things again, have you?']);
  if (rec.job === 'guard' && game.isWanted(s.id)) return 'You\'re wanted in this town. Come quietly, or else.';
  if (sim.justice.exiled.has(s.id)) return 'You were banished! Get out before the guards see you!';
  if (rep <= -60) return pick(rng, ['Leave me alone.', 'I don\'t want to talk to you.', 'Go away.']);
  const g = griefOf(rec);
  if (g) return g.byPlayer ? `You... you're the one who killed ${g.first}. Get away from me.` : pick(rng, [`Sorry, I'm not myself today. We just lost ${g.first}.`, `Hello... forgive me. I can't stop thinking about ${g.first}.`]);
  // Townsfolk on an outing: on the road, or there.
  const o = rec.trip && rec.trip.outing ? sim.outings.get(rec.trip.outing) : null;
  if (npc.caravan && rec.trip && rec.trip.outing) {
    if (o && o.withPlayer) return pick(rng, [`Not far now, ${name.split(' ')[0]}!`, 'My feet are killing me. Worth it, though.', `Glad you came along, ${name.split(' ')[0]}.`]);
    return pick(rng, [`Hello! We're off to ${npc.caravan.to}${o && o.ev ? ` for ${o.ev.title}` : ''}.`, `On our way to ${npc.caravan.to}, from ${s.name}. Lovely day for it.`]);
  }
  if (npc.visit && npc.visit.guest) {
    const ev = npc.visit.ev;
    return pick(rng, ev ? [`We came all the way from ${npc.visit.fromName} for ${ev.title}!`, `Hello! Just visiting from ${npc.visit.fromName}, for ${ev.title}.`] : [`Hello! Just visiting from ${npc.visit.fromName}.`, `${s.name}'s bigger than I thought. We're from ${npc.visit.fromName}, just looking around.`, 'Visiting! Is the tavern here any good?']);
  }
  if (npc.caravan) return pick(rng, [`Well met on the road! ${rec.name.first} ${rec.name.last}, merchant of ${s.name}, on my way to ${npc.caravan.to}.`, `Hello there! Heading to ${npc.caravan.to} with a pack of goods. Care to trade?`]);
  // Just back from a trip, and full of it.
  const tm = rec.tripMem;
  if (tm && game.day - tm.day <= 2 && rep > -25 && rng.chance(0.4)) {
    if (tm.player) return pick(rng, [`${name.split(' ')[0]}! Wasn't ${tm.dest} something?`, `That trip to ${tm.dest}, eh? We should go again.`]);
    return pick(rng, [`Oh, hello! I've just got back from ${tm.dest}.`, `Back from ${tm.dest}, and my own bed never felt so good.`]);
  }
  if (npc.visit) return pick(rng, [`Greetings, traveller! ${rec.name.first} ${rec.name.last}, merchant of ${npc.visit.fromName}.`, `Ah, a customer! Just in from ${npc.visit.fromName}.`]);
  if (npc.hired) return npc.hired.companion ? pick(rng, [`What is it, ${name}?`, 'Yes, friend?', 'Need something?']) : pick(rng, ['Yes, boss?', 'Something the matter?', 'I\'m listening.']);
  const car = sim.careers;
  if (car.employs(npc)) {
    const j = car.job;
    const late = game.minute >= j.shift[0] && game.minute < j.shift[1] && game.buildingAtPlayer()?.id !== j.building;
    return late ? 'There you are! Your shift has started.' : pick(rng, [`Ah, my ${j.role.toLowerCase()}! What is it?`, `${name}! Good to see you.`]);
  }
  if (rec.job === 'guard' && car.isGuard(s.id)) return pick(rng, [`Good ${tw}, colleague. Anything to report?`, `${name}. All quiet on your beat?`]);
  const fv = sim.favors.given(npc);
  if (fv && fv.kind !== 'deliver') {
    const pr = sim.favors.progress(fv);
    if (pr.have >= pr.need) return pick(rng, ['Oh! Did you manage it?', `${name}! Any luck with that favour?`]);
  }
  if (rep <= -25) return pick(rng, ['What do you want?', 'Make it quick.', 'Oh. It\'s you.']);
  const warns = sim.diplomacy.warnedBy(s.id);
  if (!entry.met && warns.length && rep < 10 && rec.age !== 'child') {
    entry.met = true;
    return pick(rng, [`We've heard about you from ${warns[0].fromName}. Behave yourself here.`, `${name}... ${warns[0].fromName} wrote to us about you. I'm watching you.`]);
  }
  // A town's Friend or Hero is known on sight (by its own people: someone
  // from elsewhere owes you nothing yet).
  const homeSid = sim.repSidOf(npc);
  const renown = homeSid === s.id ? sim.renownTitle(s.id) : null;
  if (renown && rep > -25) {
    const hero = renown === 'Hero';
    if (!entry.met) {
      entry.met = true;
      return pick(rng, [`You must be ${name}, the ${renown} of ${s.name}! ${hero ? 'It\'s an honour.' : 'Welcome!'}`, `${name}! Everyone's talking about what you did for us.`]);
    }
    if (rng.chance(hero ? 0.45 : 0.3)) return pick(rng, hero ? [`Our hero! Good ${tw}, ${name}.`, `The ${renown} of ${s.name}, in person! Hello!`, `${name}! The whole town owes you.`] : [`Good ${tw}, friend of ${s.name}!`, `Ah, ${name}. Always welcome here.`]);
  }
  if (!entry.met) {
    entry.met = true;
    if (p.kindness < 0.3) return pick(rng, ['What do you want?', 'Hmph. Another wanderer.']);
    return p.sociability > 0.65
      ? pick(rng, [`Good ${tw}, traveler! Welcome to ${s.name}!`, `Oh, a new face! Welcome to ${s.name}. And you are...? ${name}? Lovely.`])
      : pick(rng, [`Good ${tw}.`, `Hello. You're not from ${s.name}, are you?`, 'Oh. Hello there.']);
  }
  // Bad weather gets a mention now and then.
  const sky = game.weatherIn ? game.weatherIn(s) : 'clear';
  if (sky !== 'clear' && rep > -25 && rng.chance(0.3)) {
    return sky === 'rain' ? pick(rng, [`Filthy weather, ${name}. Come in out of the rain!`, 'You look half drowned!', 'Wet day, isn\'t it?'])
      : sky === 'snow' ? pick(rng, ['Brr! Cold enough for you?', `${name}! Shake the snow off, come in.`])
        : pick(rng, ['Oh! You gave me a start, coming out of the fog like that.', 'Strange weather, this fog.']);
  }
  // (Born and raised here, you're no newcomer.)
  if (sim.isCitizen(s.id) && rep >= 10 && sim.citizen.native) return pick(rng, [`Morning, ${first}! How's the family?`, `Good ${tw}, ${first}. I remember when you were this high.`, `${first}! Tell your folks I said hello.`, `Good ${tw}, neighbour!`]);
  if (sim.isCitizen(s.id) && rep >= 10) return pick(rng, [`Hello again, ${name}! How's life treating our newest citizen?`, `Good ${tw}, neighbour!`, `${name}! What can I do for you?`]);
  if (rep >= 35) return pick(rng, [`${name}! Good to see you.`, `Ah, ${name}, my friend!`, `Always a pleasure, ${name}.`]);
  return pick(rng, [`Good ${tw}.`, 'Hello again.', `Yes, ${name}?`, 'Hm? What is it?']);
}

// Topics available right now, most relevant first. Questions about the
// person and the town sit in an "ask about..." submenu.
export function topicsFor(npc, game) {
  const rec = npc.rec;
  const s = npc.settlement;
  const sim = game.sim;
  const car = sim.careers;
  const fav = sim.favors;
  const rep = sim.opinion(npc);
  const wanted = game.isWanted(s.id);
  const out = [];
  const add = (id, label) => out.push({ id, label });
  // One of the stories' own (a messenger, an outlaw chief, a captive): only
  // what their story gives them to say (see sim/saga).
  if (npc.saga) {
    out.push(...sagaTopics(npc, game));
    add('bye', 'Goodbye.');
    return out;
  }
  if (npc.adventurer) {
    const adv = npc.adventurer;
    if (game.duel && game.duel.npc === npc) {
      add('bye', '(Step back)');
      return out;
    }
    if (rep > -40) add('trade', 'Let\'s trade.');
    add('adv_road', 'Any tales from the road?');
    if (sim.citizen) {
      add('adv_why', `What brings you to ${s.name}?`);
      if (sim.citizen.sid === s.id && adv.guard !== s.id) add('adv_guard', `Would you stand watch over ${s.name} tonight? (¤30)`);
    } else {
      if (!adv.swapped) add('adv_swap', 'Swap stories, one traveller to another.');
      add('adv_duel', 'Fancy a friendly bout?');
      add('adv_tip', 'Know anywhere worth a look?');
    }
    add('who', 'Who are you?');
    add('gift', 'I have a gift for you.');
    add('bye', 'Goodbye.');
    return out;
  }
  if (npc.company) {
    if (rep > -40) add('trade', rec.role === 'guard' ? 'Can I see your wares?' : 'Let\'s trade.');
    add('co_route', 'Where are you headed?');
    add('co_company', 'Tell me about your company.');
    add('co_road', 'Any news from the road?');
    add('who', 'Who are you?');
    add('gift', 'I have a gift for you.');
    add('bye', 'Goodbye.');
    return out;
  }
  if (npc.nomad) {
    add('nomad', 'Are you thinking of settling here?');
    add('who', 'Where do you come from?');
    add('kind', '(Chat about the road)');
    add('gift', 'I have a gift for you.');
    add('bye', 'Goodbye.');
    return out;
  }
  const trader = npc.visit ? !npc.visit.guest : JOBS[rec.job]?.trader || rec.job === 'cook';
  // A trip they're planning, and asking you on.
  const trip = rec.visitor ? null : sim.outings.tripOf(rec, s.id);
  if (trip && trip.phase === 'planned' && trip.lead === rec.idx && (trip.player === 'ask' || trip.asked) && trip.player !== 'joined' && trip.player !== 'declined') {
    const to = game.world.ow.settlements[trip.dest];
    out.push({ id: 'trip', arg: 'yes', label: `I'd love to come to ${to.name}!` });
    out.push({ id: 'trip', arg: 'no', label: 'Not this time, thanks.' });
  } else if (trip && trip.phase === 'planned' && trip.player === 'joined') add('trip_when', 'When do we leave?');
  if (rec.tripMem && game.day - rec.tripMem.day <= 6 && rec.age !== 'child') add('trip_tell', `How was ${rec.tripMem.dest}?`);
  const cf = sim.confront;
  if (cf && cf.arrived && cf.idx === rec.idx && cf.sid === s.id) {
    if (cf.stage === 'expel') add('conduct', '...I understand.');
    else {
      out.push({ id: 'conduct', arg: 'promise', label: 'You\'re right. I\'ll change my ways.' });
      out.push({ id: 'conduct', arg: 'defy', label: 'Mind your own business.' });
    }
    return out;
  }
  if (rec.job === 'guard' && !npc.hired && (wanted || sim.justice.pendingIn(s.id).length)) add('surrender', 'I surrender.');
  if (wanted || sim.justice.exiled.has(s.id)) {
    add('bye', 'Goodbye.');
    return out;
  }
  if (rep <= -60) {
    add('gift', 'Please, accept this as an apology...');
    add('bye', 'Goodbye.');
    return out;
  }
  if (car.isCustomer(npc)) {
    const c = car.customer;
    const what = plural(c.item, c.count);
    add('serve', c.kind === 'shop' ? `Here you are: ${what}. (¤${c.price})` : c.kind === 'offer' ? `I'll buy ${what} for ¤${c.price}.` : `Sell ${what} for ¤${c.price}.`);
    add('turn_away', 'Sorry, not today.');
  }
  if (npc.hired) {
    add('escort', npc.hired.companion ? 'How are you holding up?' : 'How long are you with me?');
    add('dismiss', 'You can head home now.');
  }
  const letter = fav.letterFor(npc);
  if (letter) add('deliver', `I have a letter for you from ${letter.giverName}.`);
  // Handing out the paper.
  const ed = sim.press.latest();
  if (ed && countItem(game.player.inv, 'newspaper') > 0 && rec.readEdition !== ed.id && !npc.hired) add('paper', `Care for a copy of ${ed.title}?`);
  const mine = fav.given(npc);
  if (mine) add('favor_check', mine.kind === 'deliver' ? `About your letter for ${mine.toName}...` : 'About your request...');
  // What the stories have them ask of you, or want to hear (see sim/saga).
  out.push(...sagaTopics(npc, game));
  if (trader && rep > -40 && !npc.hired) add('trade', rec.job === 'cook' || rec.job === 'innkeeper' || rec.job === 'barkeep' ? 'Something to eat, please.' : 'Let\'s trade.');
  // (Round 54) The tavern's room to let: see sim/inns.js.
  if (rep > -40 && !npc.hired && innFor(npc)) {
    const stay = stayAt(npc.layout, innFor(npc), sim.abs);
    add('inn_room', stay && stay.pid === sagaPidOf(game.player) ? 'About my room...' : 'Have you a room for the night?');
  }
  if (rec.job === 'mayor') {
    const dip = sim.diplomacy;
    const mine = dip.forPlayer(s.id);
    if (mine.length && countItem(game.player.inv, 'dispatch')) add('dispatch', `I bring a letter from ${dip.town(mine[0].from).name}.`);
    if (dip.waitingFrom(s.id).length) add('mail', 'Any letters I could carry for you?');
    add('towns', 'Tell me about the neighbouring towns.');
    add('research', 'What are our scholars studying?');
    // Treasures from below: a Kavorent core for the realm's scholars, old
    // plans for its builders.
    if (countItem(game.player.inv, 'kav_core')) add('give_core', 'I\'ve brought something from a Kavorent ruin.');
    if (countItem(game.player.inv, 'old_blueprint')) add('give_plans', 'I found some old plans you might want.');
    if (sim.bandits.claimable(npc.layout).total) add('bounty', 'I\'ve come for the bounty.');
    add('donate', `I'd like to help ${s.name} grow.`);
    const inHall = game.buildingAtPlayer()?.type === 'townhall';
    if (sim.isCitizen(s.id) && (sim.citizen.home === null || sim.citizen.home === undefined) && sim.citizen.host !== null) add('ownhome', 'I\'d like a place of my own.');
    if (sim.isCitizen(s.id)) add('renounce', 'I renounce my citizenship.');
    else add('citizen', inHall ? `Make me a citizen of ${s.name}.` : 'How do I become a citizen?');
    add('profession', car.job && car.job.kind === 'profession' && car.job.sid === s.id ? 'About my post...' : 'I\'d like an official profession.');
    const pet = sim.petition;
    add('petition', pet && pet.sid === s.id ? `About my petition (${pet.signers.length} signature${pet.signers.length === 1 ? '' : 's'})...` : 'I\'d like to petition about a law.');
  }
  // A researcher or a scholar: what they're working on, and the tree of
  // learning it's part of.
  if ((rec.job === 'researcher' || rec.job === 'scholar') && !npc.hired && s) add('research', rec.job === 'researcher' ? 'What are you working on? (the tree of learning)' : 'What are the scholars studying? (the tree of learning)');
  // Out gathering signatures: anyone grown up in the town can sign.
  const pet = sim.petition;
  if (pet && pet.sid === s.id && rec.job !== 'mayor' && rec.age !== 'child' && !npc.visit && !rec.visitor && !pet.signers.includes(rec.idx) && !(pet.refused || []).includes(rec.idx)) add('sign', 'Would you sign my petition?');
  const home = sim.citizen && sim.citizen.sid === s.id && sim.citizen.home !== null && sim.citizen.home !== undefined ? npc.layout.buildings[sim.citizen.home] : null;
  if (home && !home.underConstruction && (rec.job === 'mayor' || rec.job === 'builder' || rec.job === 'carpenter')) add('expand', rec.job === 'mayor' ? 'I\'d like to enlarge my house.' : 'Could you enlarge my house?');
  if (car.employs(npc)) add('job', 'About my job here...');
  else if (car.canEmploy(npc) && rep >= -10) add('job', `Could you use a hand at the ${bare(npc.layout.buildings[rec.work.building].name)}?`);
  if (rec.job === 'guard' && !npc.hired && !npc.visit) add('hire', 'I\'d like to hire you as an escort.');
  else if (!npc.hired && !npc.visit && rec.age === 'adult' && rep >= 60 && !car.escort) add('companion', 'Come travel with me for a while?');
  // Your workshop and your house, waiting for a lot or going up.
  if (rec.job === 'mayor' || rec.job === 'builder' || rec.job === 'carpenter' || (rec.override && rec.override.act === 'build')) {
    const yours = sim.roads.yours(npc.layout);
    const shop = yours.some((o) => o.what === 'workshop');
    const house = yours.some((o) => o.what === 'home');
    if (shop || house) add('myworks', shop && house ? 'How are my workshop and house coming along?' : shop ? 'How\'s my workshop coming along?' : 'How is my house coming?');
  }
  if (sim.citizen && sim.citizen.sid === s.id && sim.citizen.host === rec.home && rec.home !== null) add('host', 'Thanks for putting me up.');
  if (rec.job === 'priest') add('bless', 'A blessing, please. (¤5)');
  if (isStar(game.hero)) add('wing', 'About my wing...');
  add('ask', 'Can I ask you about...');
  add('chat', rec.age === 'child' ? 'What are you up to?' : 'How are things?');
  if (!mine && !npc.hired && !npc.visit) add('favor', rec.age === 'child' ? 'Want some help with anything?' : 'Need a hand with anything?');
  const sky = game.weatherIn ? game.weatherIn(s) : 'clear';
  add('kind', (rec.idx + game.day) % 2 ? '(Compliment them)' : '(Ask how they\'re doing)');
  if (sky !== 'clear' || (rec.idx + game.day) % 3 === 1) add('weathertalk', '(Chat about the weather)');
  add('gift', 'I have a gift for you.');
  add('rude', '(Insult them)');
  add('bye', 'Goodbye.');
  return out;
}

// The realm: who rules it, what they've decreed, what the town pays and
// gets back, and what folk make of the other realms (and of you, if you're
// a citizen of one of them).
function realmTalk(npc, game) {
  const rec = npc.rec;
  const s = npc.settlement;
  const civ = s.civ;
  const sim = game.sim;
  const rng = npc.rng;
  const R = sim.realms.realm(civ);
  const realmName = civ.name.replace(/^The /, '');
  const capS = game.world.ow.settlements[R.capital];
  const ruler = sim.realms.ruler(civ);
  const who = authority(civ);
  const lines = [];
  const p = rec.personality || {};
  if (rec.ruler === civ.id) {
    lines.push(`I am ${rulerTitle(civ)} of the ${realmName}, since day ${Math.max(1, R.since ?? 1)}.`);
    lines.push(R.decrees.taxFloor ? `Every town pays at least ${Math.round(R.decrees.taxFloor * 100)}% in taxes, and a share comes here. It all goes back out, to the towns that need it.` : 'The towns send a share of their taxes here, and it goes back out to those that need it.');
  } else if (rec.councillor === civ.id) {
    lines.push(`I sit on the council of the ${realmName}. ${ruler ? `Speaker ${ruler.name.first} ${ruler.name.last} leads us.` : 'We are choosing a new speaker.'}`);
  } else if (ruler) {
    const here = capS && capS.id === s.id;
    lines.push(`We're the ${realmName}. ${sim.realms.rulerName(civ)} ${here ? 'rules from right here' : `rules from ${capS ? capS.name : 'the capital'}`}.`);
    // What they make of the ruler: generous or grasping, by how much goes
    // to the capital and what comes back.
    const aid = (npc.layout.econ.royalAid || []).slice(-1)[0];
    if (aid && game.day - aid.day < 20) lines.push(pick(rng, [`${who[0].toUpperCase() + who.slice(1)} paid for ${aid.kind === 'road' ? 'our road' : aid.kind === 'wall' ? 'our wall' : aid.kind === 'guard' ? 'a guard for us' : 'a good deal here'} lately. Can't complain.`, `Say what you like about ${who}, they didn't forget us when we needed it.`]));
    else if (!here && R.share >= 0.12) lines.push(p.kindness < 0.4 ? `A ${Math.round(R.share * 100)}% share of our taxes goes to ${capS ? capS.name : 'the capital'}. Robbery, I call it.` : `A fair bit of our taxes goes to ${capS ? capS.name : 'the capital'}. I hope they spend it well.`);
    else lines.push(pick(rng, [`A steady hand, ${who}.`, `We could do worse than ${ruler.name.first} ${ruler.name.last}.`, `I don't think about the capital much. It's a long way off.`]));
  } else lines.push(`The ${realmName} has no ruler just now. Everyone's waiting to hear who's next.`);
  // A war (how it's going, and what it's costing), an alliance, a lord.
  const war = sim.war.warOf(civ);
  if (war) {
    const side = sim.war.sideOf(war, civ);
    const foe = (game.world.ow.civs[war.lead[side === 'a' ? 'b' : 'a']]?.name || 'the enemy').replace(/^The /, '');
    const sc = side === 'a' ? war.score : -war.score;
    const tired = (war.weary[civ.id] || 0) > 0.5;
    const last = war.battles[war.battles.length - 1];
    lines.push(sc >= 30 ? pick(rng, [`We're winning the war with the ${foe}. ${last ? `You heard about ${last.name}?` : ''}`.trim(), `The ${foe} will be suing for peace soon, mark my words.`])
      : sc <= -30 ? pick(rng, [`The war with the ${foe} is going badly. ${tired ? 'Everyone\'s sick of it.' : 'We need every arm we can get.'}`, `I pray the ${foe} don't come this far.`])
        : pick(rng, [`We're at war with the ${foe}, over ${war.why}. ${tired ? 'It\'s dragged on too long.' : 'Neither side has the upper hand yet.'}`, `War with the ${foe}. ${war.plan ? `They say the armies meet outside ${game.world.ow.settlements[war.plan.def]?.name || 'the border'} tomorrow.` : 'Every few days, another battle.'}`]));
    if (R.decrees.draft === 'all' && rng.chance(0.6)) lines.push('They\'ve even put spears in the children\'s hands. It isn\'t right.');
  } else {
    const lord = sim.politics.lordOf(civ);
    const allies = sim.politics.allies(civ);
    if (lord) lines.push(pick(rng, [`Since the war, we pay tribute to the ${lord.name.replace(/^The /, '')}. Every week, like clockwork.`, `We serve the ${lord.name.replace(/^The /, '')} now. ${p.bravery > 0.6 ? 'Not forever, though.' : 'Better than more fighting.'}`]));
    else if (allies.length && rng.chance(0.7)) lines.push(`We're sworn allies with the ${allies[0].name.replace(/^The /, '')}. ${pick(rng, ['Good friends to have.', 'Trade\'s never been better.', 'Let anyone try us now.'])}`);
  }
  // Talk of breaking away (or of when they did).
  const ind = npc.layout.econ.independence ?? -1;
  if (civ.freed && civ.capital === s.id) lines.push(pick(rng, [`We answer to nobody now: free of the ${(game.world.ow.civs[civ.freed.from]?.name || 'old realm').replace(/^The /, '')} since day ${Math.max(1, civ.freed.day)}.`, 'Free! And we mean to stay that way.']));
  else if (R.capital !== s.id && ind > 0.1) lines.push(ind > 0.3 ? pick(rng, ['Between us: half the town wants to go it alone. Maybe more.', `We pay ${capS ? capS.name : 'the capital'} and get nothing back. People are talking.`]) : 'Some say we\'d do better on our own. Talk, mostly.');
  if (R.decrees.armsBan && !npc.layout.econ.laws.armsBan) lines.push(`${who[0].toUpperCase() + who.slice(1)} forbids drawn weapons in every town of the realm, mind.`);
  // The neighbours.
  const others = (game.world.ow.civs || []).filter((o) => o !== civ);
  const o = others.sort((a, b) => Math.abs(sim.realms.relation(civ, b).score) - Math.abs(sim.realms.relation(civ, a).score))[0];
  if (o) {
    const st = sim.realms.standing(civ, o);
    const on = o.name.replace(/^The /, '');
    const tariff = R.decrees.tariffOn.includes(o.id);
    lines.push(st === 'hostile' ? pick(rng, [`And the ${on}? Don't get me started. ${tariff ? 'Their merchants pay a tariff here now, and good.' : 'Nothing but trouble.'}`, `We don't deal with the ${on} if we can help it.`])
      : st === 'friendly' ? pick(rng, [`The ${on} are good neighbours. Their merchants are always welcome.`, `We get on well with the ${on}.`])
        : pick(rng, [`The ${on}... we keep an eye on them, and they on us.`, `Can't say I trust the ${on}, but trade is trade.`]));
  }
  const home = sim.citizen ? game.world.ow.settlements[sim.citizen.sid] : null;
  if (home && home.civ && home.civ !== civ && sim.realms.standing(civ, home.civ) === 'hostile') lines.push(`You're of the ${home.civ.name.replace(/^The /, '')}, aren't you? Hm.`);
  return { lines: lines.slice(0, 4) };
}

// A trip to another town: being asked along, when you're leaving, and
// how it went (the do, the place, and who they went with).
function tripTalk(npc, game, id, arg) {
  const rec = npc.rec;
  const s = npc.settlement;
  const sim = game.sim;
  const rng = npc.rng;
  const first = game.playerName.split(' ')[0];
  if (id === 'trip' || id === 'trip_when') {
    const t = sim.outings.tripOf(rec, s.id);
    if (!t || t.phase !== 'planned') return { lines: ['We\'ve already gone! Well... you know what I mean.'] };
    const to = game.world.ow.settlements[t.dest];
    const when = leavingWhen(t, game.day);
    if (id === 'trip' && arg === 'no') {
      sim.outings.answer(t, false);
      return { lines: [pick(rng, ['Oh, that\'s a shame. Another time, then!', 'Fair enough. I\'ll bring you back something.', 'Next time, then. I\'ll hold you to it!'])] };
    }
    if (id === 'trip') {
      sim.outings.answer(t, true);
      sim.changeRep(npc, 3);
      return { lines: [`Wonderful! We leave ${when}, from the road out of town.`, `Don't be late, ${first}. We'll wait a little, but not all day!`] };
    }
    return { lines: [`${when[0].toUpperCase()}${when.slice(1)}, from the road out of town. ${to.name}, here we come!`] };
  }
  const tm = rec.tripMem;
  if (!tm) return { lines: ['Hm?'] };
  const L = npc.layout;
  const others = (tm.with || []).map((i) => L.npcs[i]).filter(Boolean).map((r) => r.name.first);
  const TL = game.world.layouts.get(tm.sid);
  const sights = TL ? ['temple', 'library', 'smithy', 'tavern', 'jeweler', 'townhall'].filter((k) => TL.buildings.some((b) => b.type === k)) : [];
  const sight = sights.length ? rng.pick(sights) : null;
  const lines = [];
  if (tm.ev === 'wedding') lines.push(pick(rng, [`Beautiful! ${cap(tm.title)}: I cried, I don't mind saying.`, `${cap(tm.title)} was lovely. And the dancing after!`]));
  else if (tm.ev === 'feast') lines.push(pick(rng, [`The feast! I've never eaten so much in my life.`, `${tm.dest} knows how to throw a feast, I'll give them that.`]));
  else if (tm.ev === 'fete') lines.push(pick(rng, [`What a party! The whole of ${tm.dest} was out celebrating.`, `They're so proud of their town. And they should be.`]));
  else lines.push(pick(rng, [`${tm.dest}? Busier than here. Nice enough, though.`, `Lovely. Quite different from ${s.name}.`, `I liked it. I'd go again.`]));
  if (sight) lines.push(pick(rng, [`You should see their ${sight}. We've nothing like it.`, `Their ${sight}'s a fine one. Made me a bit jealous.`]));
  if (tm.player) lines.push(pick(rng, [`But you know, you were there! Wasn't it grand, ${first}?`, `Good to have you along, ${first}.`]));
  else if (others.length) lines.push(`${listNames(others)} came too. ${pick(rng, ['We laughed the whole way back.', 'Never again on the same wagon, though!', 'Good company makes the road shorter.'])}`);
  return { lines: lines.slice(0, 3) };
}

// Talk with one of a trading company: where they're bound, the company
// itself (how long on the road, how many wagons) and what they've heard.
function companyTalk(npc, game, id) {
  const g = npc.company;
  const rec = npc.rec;
  const s = npc.settlement;
  const rng = npc.rng;
  const ow = game.world.ow;
  const next = ow.settlements[g.dest];
  const prev = ow.settlements[g.seen[g.seen.length - (g.state === 'stay' ? 2 : 1)]];
  const boss = g.members.find((m) => m.role === 'trader');
  switch (id) {
    case 'who':
      return { lines: [rec.role === 'guard' ? `${rec.name.first} ${rec.name.last}. I keep ${g.name} and its wagons safe on the road.` : rec.role === 'driver' ? `${rec.name.first} ${rec.name.last}. I drive the second wagon, and mind the horses.` : `${rec.name.first} ${rec.name.last}, trader. ${boss && boss.name.first === rec.name.first ? 'This is my company.' : `I ride with ${boss ? boss.name.first : 'the company'}.`}`,
        pick(rng, ['We don\'t stop anywhere for long. That\'s the trade.', 'Home? The wagon\'s home.', 'Every town wants something the last one had.'])] };
    case 'co_route': {
      if (g.state === 'stay' && next) {
        const here = g.at === s.id;
        return { lines: [here ? `We'll stay a day or two, and then on to wherever the road takes us.` : `${next.name}, and then who knows.`, pick(rng, ['Go where the coin is, that\'s the rule.', 'We follow the market, not a map.'])] };
      }
      return { lines: [next ? `To ${next.name}${next.civ && next.civ !== s.civ ? `, in the ${next.civ.name.replace(/^The /, '')}` : ''}. ${npc.caravan && npc.caravan.camp ? 'We\'ll be off at first light.' : 'We should make it by nightfall, or the next.'}` : 'Onward. There\'s always another town.'] };
    }
    case 'co_company':
      return { lines: [`${g.name[0].toUpperCase()}${g.name.slice(1)}: ${g.wagons} wagon${g.wagons > 1 ? 's' : ''}, ${g.members.length} of us, and horses to pull it all.`,
        g.stays > 3 ? `We've traded in ${g.stays} towns since I've been keeping count.` : 'We\'re not long on this stretch of road.',
        pick(rng, ['Look for the banner on the wagons: that\'s us.', 'We don\'t settle. Never have.', 'We camp by the road at night: cheaper than any inn.'])] };
    case 'co_road': {
      const lines = [];
      if (prev && prev.id !== s.id) {
        const PL = game.world.layouts.get(prev.id);
        const news = PL && PL.econ ? PL.econ.ledger.slice(-12).filter((l) => !/^Law:|keeps ¤|Taxes stand/.test(l.text)) : [];
        lines.push(`We came from ${prev.name}.`);
        if (news.length) lines.push(`Last we heard there: ${news[news.length - 1].text}`);
      }
      lines.push(pick(rng, ['Wolves took one of our horses last winter. We ride closer together now.', 'Roads are better than they were. Towns build them for trade, and trade is us.', 'Bandits? Not with our guard along.']));
      return { lines: lines.slice(0, 3) };
    }
  }
  return { lines: ['Hm?'] };
}

// Talk with an adventurer. A citizen is a local to them (they'll ask about
// the place, and take pay to stand watch over it); someone who belongs
// nowhere is a fellow traveller (stories swapped, places worth a look, a
// friendly bout for a wager).
function adventurerTalk(npc, game, id, arg) {
  const adv = npc.adventurer;
  const rec = npc.rec;
  const s = npc.settlement;
  const sim = game.sim;
  const rng = npc.rng;
  const ow = game.world.ow;
  const p = game.player;
  const home = adv.home !== null && adv.home !== undefined ? ow.civs[adv.home] : null;
  const next = ow.settlements[adv.dest] && adv.dest !== s.id ? ow.settlements[adv.dest] : null;
  const prev = ow.settlements[adv.seen[adv.seen.length - 2]];
  switch (id) {
    case 'who':
      return { lines: [`${rec.name.first} ${rec.name.last}. ${home ? `Born in the ${home.name.replace(/^The /, '')}, but the road's my home now.` : 'No realm to call my own: the road is home.'}`,
        adv.level >= 3 ? `You may have heard of me. ${adv.stays} towns, and more beasts than I care to count.` : adv.level === 2 ? 'A few years on the road. I can handle myself.' : 'Still new to this life, if I\'m honest. It suits me.'] };
    case 'adv_road': {
      const lines = [];
      if (prev) {
        const PL = game.world.layouts.get(prev.id);
        const news = PL && PL.econ ? PL.econ.ledger.slice(-12).filter((l) => !/^Law:|keeps ¤|Taxes stand/.test(l.text)) : [];
        lines.push(`I came here from ${prev.name}${prev.civ && prev.civ !== s.civ ? `, over in the ${prev.civ.name.replace(/^The /, '')}` : ''}.`);
        if (news.length) lines.push(`When I left: ${news[news.length - 1 - (rng.int(0, Math.min(2, news.length - 1)))].text}`);
      }
      const civs = ow.civs || [];
      if (civs.length >= 2) {
        const [a, b] = rng.shuffle(civs.slice()).slice(0, 2);
        const st = sim.realms.standing(a, b);
        lines.push(st === 'hostile' ? `Mind yourself between the ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')}: no love lost there.` : st === 'friendly' ? `The ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} are thick as thieves these days.` : `The ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} eye each other like cats.`);
      }
      lines.push(pick(rng, ['Beasts are bolder on the roads than they were.', 'Found a gem in a wolf\'s den once. Don\'t ask.', 'Every town\'s tavern swears its stew is the best. They\'re all wrong.']));
      return { lines: lines.slice(0, 3) };
    }
    case 'adv_why':
      return { lines: [`Trade, rest, and a bed that isn't rocks. ${next ? `I'm for ${next.name} next.` : 'Then on to wherever the road goes.'}`,
        pick(rng, [`${s.name} seems a decent sort of place. Your watch could use more steel, mind.`, `What's the best thing to eat around here? I've had enough dried meat for a lifetime.`, `Is it true what they say about your ${s.type === 'village' ? 'elder' : 'mayor'}?`])] };
    case 'adv_guard': {
      if (countItem(p.inv, 'coin') < 30) return { lines: ['Thirty coin, friend. I don\'t stand in the cold for less.'] };
      removeItem(p.inv, 'coin', 30);
      npc.rec.coins = (npc.rec.coins || 0) + 30;
      adv.coins = npc.rec.coins;
      adv.guard = s.id;
      adv.leave = Math.max(adv.leave, sim.abs + 18 * 60);
      sim.changeRep(npc, 5);
      ledger(npc.layout, game.day, `${rec.name.first} ${rec.name.last}, an adventurer, is standing watch over ${s.name}, paid by ${game.playerName}.`);
      return { lines: ['Done. Nothing with claws gets past me tonight.', 'I\'ll stay on an extra night for it, too.'] };
    }
    case 'adv_swap': {
      if (adv.swapped) return { lines: ['We\'ve swapped our best already!'] };
      adv.swapped = true;
      sim.changeRep(npc, 8);
      // A place they've been, now on your map.
      const far = ow.settlements.filter((o) => o.id !== s.id && !ow.explored[o.cz * MAP_W + o.cx]);
      const o = far.length ? far[rng.int(0, far.length - 1)] : null;
      if (o) ow.markExplored(Math.floor((o.cx + 0.5) * 64), Math.floor((o.cz + 0.5) * 36), 1);
      return { lines: [pick(rng, ['Ha! You got lost in a fog on a bridge? That\'s nothing...', 'Your turn. Mine starts with a bear and ends with a very angry miller.']),
        o ? `If you're ever out that way, ${o.name} is worth the walk: ${o.type === 'city' ? 'a proper city' : o.type === 'town' ? 'a fair-sized town' : 'a quiet village'}${o.civ ? ` of the ${o.civ.name.replace(/^The /, '')}` : ''}. (${o.name} is now on your map.)` : 'You\'ve been everywhere I have, I think!'] };
    }
    case 'adv_tip': {
      // Somewhere beasts are troubling people: work for a blade.
      const troubled = [...game.world.layouts.values()].filter((L) => L.econ && L.settlement.id !== s.id && (L.econ.recent.raids || 0) > 0 && !deserted(L.settlement));
      const t = troubled.length ? troubled[rng.int(0, troubled.length - 1)].settlement : null;
      if (t) {
        ow.markExplored(Math.floor((t.cx + 0.5) * 64), Math.floor((t.cz + 0.5) * 36), 1);
        return { lines: [`Beasts have been raiding ${t.name}. They'd be glad of a blade, and they pay.`, `(${t.name} is marked on your map.)`] };
      }
      return { lines: [pick(rng, ['Deep stone under the mountains: iron, gold, gems. And things that live in the dark.', 'The forests are full of game this season. And wolves that think the same.', 'Quiet everywhere, lately. Too quiet for my purse.'])] };
    }
    case 'adv_duel': {
      if (arg) {
        const w = Number(arg);
        if (countItem(p.inv, 'coin') < w) return { lines: ['You\'ll need the coin to back it, friend.'] };
        game.startDuel(npc, w);
        return { lines: ['Ha! Ready yourself.'], close: true };
      }
      if (npc.hp < npc.maxHp * 0.6) return { lines: ['Not today. I\'m still nursing the last one.'] };
      const coins = countItem(p.inv, 'coin');
      const choices = [10, 25, 50].filter((w) => w <= coins).map((w) => ({ id: 'adv_duel', arg: String(w), label: `For ¤${w}.` }));
      choices.push({ id: 'bye', label: 'Maybe another time.' });
      return { lines: [adv.level >= 3 ? 'A bout? With me? Bold. I don\'t go easy.' : 'A friendly bout? I\'m game. First to a quarter of their strength yields.', 'What\'s the purse?'], choices };
    }
    default:
      return { lines: ['...'] };
  }
}

// The "ask about..." submenu.
export function askMenu(npc, game) {
  const rec = npc.rec;
  const s = npc.settlement;
  const out = [
    { id: 'who', label: 'Yourself' },
    { id: 'doing', label: 'What you\'re up to' },
    { id: 'work', label: 'Your work' },
    { id: 'news', label: 'Any news' },
    { id: 'life', label: `Life in ${npc.visit ? npc.visit.fromName : s.name}` },
  ];
  if (!rec.visitor) out.push({ id: 'family', label: 'Your family' });
  out.push({ id: 'people', label: 'Someone you know...' });
  out.push({ id: 'directions', label: 'Where to find a place...' });
  if (!npc.visit && rec.age !== 'child') out.push({ id: 'laws', label: rec.job === 'guard' ? 'Any trouble lately' : 'The laws and taxes' });
  if (rec.age !== 'child') out.push({ id: 'customs', label: 'Your faith and customs' });
  if (!npc.visit && !rec.visitor) out.push({ id: 'history', label: `The history of ${s.name}` });
  if (rec.age !== 'child') out.push({ id: 'oldplaces', label: 'Old places round here' });
  out.push({ id: 'geo', label: 'The islands and the world' });
  if (rec.age !== 'child' && game.sim.bandits && (game.sim.bandits.bountiesIn(npc.layout).length || game.sim.bandits.nearBands(npc.layout).length)) out.push({ id: 'bandits', label: 'Bandits about?' });
  if (!npc.visit && rec.age !== 'child' && s.civ) out.push({ id: 'realm', label: rec.ruler === s.civ.id ? 'Your reign' : `The ${s.civ.name.replace(/^The /, '')} and its ruler` });
  return out;
}

// Places you can ask the way to.
export function placesFor(npc, game) {
  const L = npc.layout;
  const out = [];
  const seen = new Set();
  for (const b of L.buildings) {
    if (b.residential || seen.has(b.type)) continue;
    seen.add(b.type);
    out.push({ key: `b${b.id}`, label: b.name, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
  }
  if (L.graveyard) out.push({ key: 'grave', label: 'Graveyard', x: L.graveyard.x + 3, z: L.graveyard.z + 3 });
  const c = game.sim.citizen;
  if (c && c.sid === npc.settlement.id) {
    if (c.host !== null && L.buildings[c.host]) {
      const b = L.buildings[c.host];
      out.push({ key: 'host', label: `The ${b.family} home (where I stay)`, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    }
    if (c.home !== null && L.buildings[c.home]) {
      const b = L.buildings[c.home];
      out.push({ key: 'home', label: 'My new house', x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    }
  }
  return out.slice(0, 12);
}

function direction(fromX, fromZ, x, z) {
  const dx = x - fromX;
  const dz = z - fromZ;
  const d = Math.round(Math.hypot(dx, dz));
  if (d < 4) return 'right here';
  const ang = Math.atan2(dz, dx);
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const i = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return `${d < 12 ? 'just' : 'about ' + d + ' paces'} ${dirs[i]} of here`;
}

// How warmly they talk to you.
function tone(npc, game) {
  const op = game.sim.opinion(npc);
  return op >= 35 ? 'warm' : op <= -25 ? 'cold' : 'neutral';
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// How two townsfolk get on: family and friends are close, the rest is
// chemistry (stable for any pair) and how kind they both are.
export function affinity(a, b) {
  const rel = relationTo(a, b);
  if (rel) return rel === 'friend' ? 0.8 : 0.9;
  const h = hash4(Math.min(a.idx, b.idx), Math.max(a.idx, b.idx), 0xaf1, 7) / 4294967296;
  return (h - 0.5) * 1.6 + (b.personality.kindness - 0.5) * 0.6 + (a.personality.kindness - 0.5) * 0.3;
}

// Where someone is likely to be right now, in words.
export function whereIs(L, other, game) {
  if (!alive(other)) return null;
  if (other.ent && !other.ent.dead && other.ent.hired) return 'off escorting a traveler';
  if (other.away) {
    const o = other.trip && other.trip.dest !== undefined ? game.world.ow.settlements[other.trip.dest] : null;
    return o ? `away trading in ${o.name}` : 'away on the road';
  }
  const act = activityFor(other, game.day, game.minute).entry;
  const wid = other.work && other.work.building;
  const wb = wid !== null && wid !== undefined ? L.buildings[wid] : null;
  switch (act.act) {
    case 'sleep': return 'asleep at home, I\'d think';
    case 'work':
      if (wb) return `working at the ${bare(wb.name)}`;
      return { farmer: 'out in the fields', fisher: 'fishing down by the water', guard: 'on patrol', trapper: 'out hunting in the woods', lumberjack: 'chopping wood outside town', miner: 'down in the mine', beggar: 'begging on the square' }[other.job] || 'at work';
    case 'eat': return act.place === 'tavern' ? 'eating at the tavern' : 'having a meal at home';
    case 'social': return 'chatting with folk, at the tavern or on the square';
    case 'hobby': {
      const h = HOBBIES[act.hobby];
      return h ? `off ${h.label}` : 'enjoying some time off';
    }
    case 'home': return 'at home';
    case 'mourn': case 'funeral': return 'at the graveyard';
    case 'event': return act.kind === 'wedding' ? 'at the wedding, by the square' : 'at the feast, by the square';
    case 'poster': return 'going round town with posters';
    case 'build': return act.event ? 'by the square, with the builders' : 'at the building site';
    case 'trial': return 'at the jail, for the hearing';
    case 'forage': return 'out looking for food';
    case 'travel': return 'setting off on the road';
    case 'play': return 'playing around the square';
    case 'study': return 'at their studies';
    case 'shop': {
      const b = act.seller !== undefined ? null : L.buildings[act.building];
      if (act.seller !== undefined) return 'at the market stalls, buying something';
      return b ? `gone to the ${bare(b.name)} for a ${String(act.item || 'few things').replace(/_/g, ' ')}` : 'out shopping';
    }
    default: return 'around town somewhere';
  }
}

// People they can tell you about: family, friends, notable folk and anyone
// you've met in their town.
export function peopleFor(npc, game) {
  const L = npc.homeLayout || npc.layout;
  const rec = npc.rec;
  const sid = L.settlement.id;
  const out = [];
  const seen = new Set([rec.idx]);
  const add = (i) => {
    if (i === null || i === undefined || i < 0 || seen.has(i)) return;
    const o = L.npcs[i];
    if (!o) return;
    seen.add(i);
    out.push({ id: 'people', arg: String(i), label: `${o.name.first} ${o.name.last}${alive(o) ? ` (${jobTitle(o, L.settlement)})` : ' (†)'}` });
  };
  add(rec.partner);
  rec.children.forEach(add);
  rec.parents.forEach(add);
  (rec.friends || []).forEach(add);
  for (const job of ['mayor', 'priest', 'cook', 'guard', 'blacksmith', 'merchant']) add(L.npcs.findIndex((o) => o.job === job && alive(o)));
  for (const [k, r] of game.sim.rep) if (r.met && k.startsWith(`${sid}:`)) add(+k.slice(k.indexOf(':') + 1));
  return out.slice(0, 9);
}

function aboutPerson(npc, idx, game) {
  const L = npc.homeLayout || npc.layout;
  const rec = npc.rec;
  const o = L.npcs[idx];
  const rng = npc.rng;
  const sim = game.sim;
  if (!o) return { lines: ['Who?'] };
  if (tone(npc, game) === 'cold' && sim.opinion(npc) <= -40) return { lines: [pick(rng, ['Why should I tell you anything about my neighbours?', 'Leave them out of this.'])] };
  const first = o.name.first;
  const rel = relationTo(rec, o);
  if (!alive(o)) {
    const when = o.deathDay !== undefined ? ` on day ${o.deathDay}` : '';
    return { lines: [rel ? `We lost ${first}${when}${o.cause ? ` (${o.cause})` : ''}. I miss them every day.` : `${first} passed away${when}${o.cause ? ` (${o.cause})` : ''}. May they rest easy.`] };
  }
  const job = jobTitle(o, L.settlement).toLowerCase();
  const lines = [];
  const relWord = { partner: 'My partner', child: 'My child', parent: 'My parent', family: 'Family of mine', friend: 'A dear friend' }[rel];
  if (relWord) lines.push(`${first}? ${relWord}! ${o.age === 'child' ? `${first} is ${6 + (o.idx % 7)}, and a handful.` : `${first} is the ${job} here.`}`);
  else {
    const a = affinity(rec, o);
    const view = a > 0.35 ? pick(rng, [`${first}? A good sort. One of the best.`, `Oh, I like ${first}.`]) : a < -0.35 ? pick(rng, [`${first}? Don't get me started.`, `Can't stand ${first}, honestly.`]) : pick(rng, [`${first}? I don't know them that well.`, `${first}... we say hello.`]);
    lines.push(`${view} ${o.age === 'child' ? `${first} is one of the children.` : `${first} is the ${job}.`}`);
  }
  let where = whereIs(L, o, game);
  const e = o.ent;
  if (e && !e.dead && e.layout === npc.layout && !o.away) where += `: ${direction(npc.x, npc.z, e.x, e.z)}`;
  lines.push(`Right now? ${cap(where)}.`);
  const g = griefOf(o);
  const theirs = sim.repEntry(L.settlement.id, o.idx);
  if (g) lines.push(`${first} is still grieving for ${g.first}.`);
  else if (o.hungry >= 1) lines.push(`I worry about ${first}. ${first} hasn't been eating.`);
  else if (theirs.met && theirs.v >= 30) lines.push(`${first} speaks well of you.`);
  else if (theirs.met && theirs.v <= -25) lines.push(`${first} doesn't think much of you, mind.`);
  else if ((rec.personality.sociability > 0.55 || rec.traits.includes('gossipy')) && o.traits.length) lines.push(`They say ${first} is ${o.traits[o.traits.length - 1]}.`);
  return { lines };
}

function workTalk(npc, game) {
  const rec = npc.rec;
  const L = npc.layout;
  const e = L.econ;
  const car = game.sim.careers;
  const rng = npc.rng;
  const p = rec.personality;
  const s = npc.settlement;
  const J = JOBS[rec.job];
  if (npc.hired) return { lines: [`Right now my work is keeping you alive, ${game.playerName}.`] };
  if (npc.visit && npc.visit.guest) return { lines: [`Back in ${npc.visit.fromName} I'm a ${jobTitle(rec, npc.homeLayout.settlement).toLowerCase()}. Today I'm on holiday!`] };
  if (npc.visit) return { lines: [`I buy cheap in ${npc.visit.fromName} and sell dear wherever I go. Mostly.`, 'The road is long, but the coin is good.'] };
  if (rec.age === 'child') return { lines: [pick(rng, ['Work? I\'m a kid! I play!', 'When I grow up I want to be a guard!', 'I help at home, sometimes.'])] };
  if (rec.job === 'retired') return { lines: ['I\'ve done my share of work, thank you very much.', 'Now I tend to my own business, and everyone else\'s.'] };
  const hours = J && J.start !== undefined ? ` I start at ${clock(J.start)} and finish at ${clock(J.end)}.` : '';
  const lines = [];
  const choices = [];
  if (car.canEmploy(npc)) {
    const biz = e.biz[rec.work.building];
    lines.push(`Business is ${biz.till > 90 ? 'booming' : biz.till > 35 ? 'steady' : 'slow'}.${hours}`);
    lines.push(biz.till < 20 ? 'I can barely pay myself, let alone anyone else.' : p.diligence > 0.6 ? 'There\'s always more to do than hands to do it.' : 'Keeps me busy enough.');
    choices.push({ id: 'job', label: car.employs(npc) ? 'About my job here...' : 'Could you use a hand?' });
  } else if (rec.job === 'guard') {
    lines.push(`Long shifts, but somebody has to keep the peace.${hours}`);
    lines.push(e.recent.thefts + e.recent.violence ? 'There\'s been trouble lately; we\'re stretched thin.' : 'Quiet lately. Just how I like it.');
    if (!car.isGuard(s.id)) lines.push('We could use more hands on the watch, if you\'re a citizen. See the mayor.');
    choices.push({ id: 'hire', label: 'Could I hire you as an escort?' });
  } else if (rec.job === 'mayor') {
    lines.push(`Balancing the books, mostly. The treasury holds ¤${Math.floor(e.treasury)}.`);
    lines.push('We license guards, trappers, fishers and farmers, if you want honest work.');
    choices.push({ id: 'profession', label: 'Tell me about those professions.' });
  } else if (['farmer', 'fisher', 'trapper'].includes(rec.job)) {
    const what = { farmer: 'crops', fisher: 'catch', trapper: 'meat and hides' }[rec.job];
    lines.push(`I sell my ${what} to the tavern kitchen and the traders.${hours}`);
    lines.push((rec.earnedY || 0) > 20 ? 'It\'s been a good season, thank the stars.' : 'Pays little, but it\'s honest.');
    if (!car.licensed(rec.job, s.id)) lines.push(`Fancy the ${rec.job}'s life? The mayor hands out licences.`);
  } else if (rec.job === 'priest') {
    // Each faith its own: what its clergy are called, what it prizes, how
    // it sees off the dead, and its sacred beast.
    const f = religionOf(s);
    if (f) lines.push(`I'm the ${f.clergy} here. ${f.faith[0].toUpperCase()}${f.faith.slice(1)} prizes ${f.virtue} above all else.${hours}`, `Our dead are given ${f.rite}, and ${f.beast} is sacred to ${f.god}. A blessing costs a small donation.`);
    else lines.push(`The temple is open to all.${hours}`, 'A blessing costs a small donation.');
  }
  else if (rec.job === 'beggar') lines.push('Work? Nobody will have me. Spare a coin?');
  else {
    lines.push(`${p.diligence > 0.65 ? 'I love my work.' : p.diligence < 0.3 ? 'Work is work. I\'d rather be doing anything else.' : 'It pays the bills.'}${hours}`);
    if (p.sociability > 0.6) lines.push((rec.coins || 0) > 60 ? 'Can\'t complain about the money.' : (rec.coins || 0) < 10 ? 'Money\'s tight, though.' : 'Could be worse.');
  }
  return { lines: lines.slice(0, 3), choices: choices.length ? choices : null };
}

// The mayor on what the realm's scholars are at (and the tree of it all).
function researchTalk(npc, game) {
  const s = npc.settlement;
  const T = game.sim.tech;
  const st = T.stateOf(s);
  const who = T.leaderOf(s);
  const boss = s.civ ? (who && who.ruler !== undefined && who !== npc.rec ? `${who.name.first} ${who.name.last}` : 'the court') : 'I';
  const cur = st.current ? T.def(st, st.current) : null;
  // (One of the scholars themself: in their own words.)
  if (npc.rec.job !== 'mayor') {
    const pct = cur ? Math.floor((st.progress / cur.cost) * 100) : 0;
    const mine = [cur
      ? `${npc.rec.job === 'researcher' ? 'I\'m' : 'We\'re'} working on ${cur.name.toLowerCase()}: ${cur.desc.charAt(0).toLowerCase()}${cur.desc.slice(1)} We're ${pct}% of the way there.`
      : 'Nothing just now: we\'re waiting on the mayor to choose what we study next.',
    `${s.name} knows ${st.done.length} of the ${T.treeFor(st).ids.length} arts so far. Here, have a look at the whole tree.`];
    return { lines: mine, open: 'tech' };
  }
  const lines = [cur
    ? `${boss === 'I' ? 'I have' : `${boss[0].toUpperCase()}${boss.slice(1)} has`} set the scholars to ${cur.name.toLowerCase()}: ${cur.desc.charAt(0).toLowerCase()}${cur.desc.slice(1)} They're ${Math.floor((st.progress / cur.cost) * 100)}% of the way there.`
    : 'Our scholars have nothing to study just now.',
  `We know ${st.done.length} of the ${T.treeFor(st).ids.length} arts so far. Here, see for yourself.`];
  return { lines, open: 'tech' };
}

// A Kavorent core handed to a mayor: a fortune for you, renown, and the
// realm's scholars set to the Kavorent's arts (the Ancient Technology Tree).
// Before handing over something you can't get back (a Kavorent core, old
// plans): who it'll go to, what you'll get, and are you sure?
function confirmGift(npc, game, item) {
  const s = npc.settlement;
  const n = countItem(game.player.inv, item);
  if (!n) return { lines: [item === 'kav_core' ? 'Brought what? I don\'t see anything.' : 'Plans? Where?'] };
  const civ = s.civ !== null && s.civ !== undefined ? game.world.ow.civs[s.civ] : null;
  const realm = civ ? civ.name : s.name;
  const core = item === 'kav_core';
  const what = core ? (n === 1 ? 'the Kavorent core' : `all ${n} Kavorent cores`) : n === 1 ? 'the old blueprint' : `all ${n} old blueprints`;
  const gain = core
    ? `${realm} will study ${n === 1 ? 'it' : 'them'} (its Ancient Technology Tree); you'll be paid what the treasury can spare.`
    : `${s.name}'s scholars will put ${n === 1 ? 'it' : 'them'} to their research; you'll be paid ¤${35 * n}.`;
  return {
    lines: [
      core ? 'A Kavorent core? Here? ...Are you certain you want to part with it?' : 'Old plans? Let me see... you\'d give these to us?',
      `── HAND OVER ${what.toUpperCase()} TO ${realm.toUpperCase()}? ──`,
      gain,
      'Once given, there\'s no taking it back.',
    ],
    choices: [{ id: core ? 'give_core' : 'give_plans', arg: 'yes', label: `Yes: give ${what} to ${realm}.` }],
    back: 'No, I\'ll keep it for now.',
  };
}

function coreTalk(npc, game) {
  const s = npc.settlement;
  const L = npc.layout;
  const sim = game.sim;
  const p = game.player;
  const n = countItem(p.inv, 'kav_core');
  if (!n) return { lines: ['Brought what? I don\'t see anything.'] };
  removeItem(p.inv, 'kav_core', n);
  const pay = Math.min(Math.max(0, Math.floor(L.econ.treasury * 0.5)), 220 * n) + 60 * n;
  L.econ.treasury = Math.max(0, L.econ.treasury - (pay - 60 * n));
  p.give('coin', pay);
  sim.ancient.addCores(L, n, 'you');
  sim.addRenown(s.id, 8 * n, 'bringing a Kavorent core');
  sim.changeRep(npc, 20);
  game.audio?.play('fanfare');
  game.renderer.emit(npc.x, npc.y + 1.4, npc.z, { n: 24, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 40, speed: 40, life: 0.9, glow: true });
  const st = sim.ancient.stateOf(s);
  return {
    lines: [
      `Is that... gods. ${n === 1 ? 'A core' : `${n} cores`} from the old ones, and still alight.`,
      `Take ¤${pay}: it's not what ${n === 1 ? 'it\'s' : 'they\'re'} worth, but it's what we can spare. Our scholars will want to see this at once.`,
      `(The realm has ${st.cores} core${st.cores === 1 ? '' : 's'} to study now.)`,
    ],
    choices: [{ id: 'ancient_view', label: 'Show me what the realm could learn from it.' }],
  };
}

// Old plans for the town's builders and thinkers: coin, renown, and a push
// to whatever the scholars are studying.
function plansTalk(npc, game) {
  const s = npc.settlement;
  const L = npc.layout;
  const sim = game.sim;
  const p = game.player;
  const n = countItem(p.inv, 'old_blueprint');
  if (!n) return { lines: ['Plans? Where?'] };
  removeItem(p.inv, 'old_blueprint', n);
  const pay = 35 * n;
  L.econ.treasury = Math.max(0, L.econ.treasury - Math.min(L.econ.treasury, pay / 2));
  p.give('coin', pay);
  sim.addRenown(s.id, 2 * n, 'bringing old plans to the scholars');
  sim.changeRep(npc, 6 * n);
  const T = sim.tech;
  const st = T.stateOf(s);
  const cur = st && st.current ? T.def(st, st.current) : null;
  if (cur) st.progress = Math.min(cur.cost - 1, st.progress + cur.cost * 0.12 * n);
  ledger(L, game.day, `${game.playerName} brought the council old plans from below; the scholars are poring over them.`);
  return {
    lines: [
      `Plans for works nobody's built in a hundred years! Here: ¤${pay}, and the town's thanks.`,
      cur ? `Our scholars are on ${cur.name.toLowerCase()}; these will speed them on.` : 'Our scholars will make something of them, mark my words.',
    ],
  };
}

// Asked about old places near by: one they know of (marked on your map).
function oldPlacesTalk(npc, game) {
  const rec = npc.rec;
  const sim = game.sim;
  const told = (sim.toldOld ||= new Map());
  const k = `${npc.settlement.id}:${rec.idx}`;
  if (told.get(k) === game.day) return { lines: [pick(npc.rng, ['That\'s all I know of, I\'m afraid.', 'I\'ve told you all I know.', 'Ask someone else; I\'ve no more tales.'])] };
  told.set(k, game.day);
  const q = sim.dungeons.rumour(npc.layout, npc.rng);
  if (!q) return { lines: [pick(npc.rng, ['Old places? None round here that I know of.', 'Nothing like that near here, thank the gods.', 'I keep to the roads. Couldn\'t tell you.'])] };
  sim.dungeons.mark(q.d, `${q.d.name.charAt(0).toUpperCase()}${q.d.name.slice(1)} is marked on your map.`);
  const warn = q.d.cleared ? ' Someone beat it, they say.' : q.d.type === 'kavorent' ? ' Don\'t go near it.' : '';
  return { lines: [q.line + warn] };
}

// Talking to the mayor about the professions the town licenses.
function professionTalk(npc, game, arg) {
  const s = npc.settlement;
  const car = game.sim.careers;
  const j = car.job;
  const name = game.playerName;
  if (!arg && j && j.kind === 'profession' && j.sid === s.id) {
    const P = PROFESSIONS[j.job];
    return {
      lines: [`You serve ${s.name} as our ${P.title.toLowerCase()}, since day ${j.since}.${j.earned ? ` You've earned ¤${j.earned} so far.` : ''}`],
      choices: [{ id: 'profession', arg: 'resign', label: 'I wish to resign my post.' }],
    };
  }
  if (arg === 'resign') return { lines: ['Are you certain? You\'d have to reapply.'], choices: [{ id: 'profession', arg: 'resign:yes', label: 'Yes, I resign.' }], back: 'No, I\'ll stay on.' };
  if (arg === 'resign:yes') {
    car.resign(null);
    return { lines: ['Very well. We\'ll strike your name from the rolls. Thank you for your service.'] };
  }
  if (!arg) {
    return {
      lines: [`${s.name} licenses ${s.type === 'city' ? 'all manner of' : s.type === 'town' ? 'a good few' : 'a few'} trades. Which interests you?`],
      // A bigger place has call for more trades.
      choices: licensesFor(s.type, s.style).map((k) => {
        const f = licenceFee(k, s, game.sim.isCitizen(s.id), !!car.workshopIn(npc.layout, k));
        return { id: 'profession', arg: `ask:${k}`, label: `${PROFESSIONS[k].title}${PROFESSIONS[k].citizen ? ' (citizens)' : ''}${f.total ? ` · ¤${f.total}` : ' · free'}` };
      }),
    };
  }
  const [what, key] = arg.split(':');
  const P = PROFESSIONS[key];
  if (!P) return { lines: ['...'] };
  const t = car.professionTerms(npc, key);
  if (what === 'ask') {
    if (!t.ok) {
      const why = {
        exiled: 'You were banished. Never.', crimes: 'Not while you have crimes to answer for.', citizen: `Only citizens of ${s.name} may serve on the watch.`,
        record: 'Not with a conviction on your record. The watch must be above reproach.', distrust: 'Frankly, I don\'t trust you with it. Earn some goodwill first.',
        already: `You already are our ${P.title.toLowerCase()}!`,
        tech: `Nobody in the realm knows the craft yet: our scholars would have to master ${TECHS[t.tech]?.name.toLowerCase() || 'it'} first.`,
        nowhere: 'We have nowhere for you to do it: no research hall, not even a library.',
        tier: `A ${s.type} like ours has no call for a licensed ${P.title.toLowerCase()}. Try a ${t.tier === 'city' ? 'city' : 'town'}.`,
      }[t.reason] || 'I can\'t do that.';
      return { lines: [P.pitch, why] };
    }
    const lines = [P.pitch];
    const kitItems = [...(car.kitFor ? car.kitFor(key, npc.layout.settlement) : P.kit), ...(P.bench ? [[P.bench, 1]] : [])];
    const kit = t.kit && kitItems.length ? ` We'll give you ${kitItems.map(([it, n]) => plural(it, n)).join(', ')} to start.` : '';
    const fees = t.fee ? `The licence costs ¤${t.licenceFee}${t.workshopFee ? `, and ¤${t.workshopFee} more: the builders will put up a workshop for you, with your own ${ITEMS[TRADE_BENCHES[key]?.[0]]?.name?.toLowerCase() || 'bench'}` : ''}${t.shop ? ' (you already have your workshop here)' : ''}.` : 'There\'s no fee: it\'s sworn service.';
    lines.push(`${fees}${kit}`);
    if (j) lines.push(`You'd have to give up being ${car.title()}.`);
    return { lines, choices: [{ id: 'profession', arg: `take:${key}`, label: `I'll take it.${t.fee ? ` (Pay ¤${t.fee})` : ''}` }], back: 'Let me think about it.' };
  }
  const r = car.takeProfession(npc, key);
  if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee} for the licence.` : 'Something went wrong with the paperwork.'] };
  game.ui.msg(`You are now ${P.title === 'Town Guard' ? 'a Town Guard' : `a licensed ${P.title.toLowerCase()}`} of ${s.name}!`, '#ffe070');
  game.audio?.play('coin');
  const got = r.given.length ? `Here: ${r.given.map((g) => plural(g.item, g.count)).join(', ')}.` : '';
  if (r.building && r.building.queued) {
    game.ui.msg(`Your workshop in ${s.name} will go up on the next free lot.`, '#ffe070');
    return { lines: [`It's in the ledger. Welcome, ${P.title.toLowerCase()} ${name}!`, got, 'There\'s no free lot for your workshop just now: the builders are laying out a new street, and yours goes up on the first lot that\'s ready. Ask me or a builder how it\'s coming along.'].filter(Boolean) };
  }
  if (r.building) return { lines: [`It's in the ledger. Welcome, ${P.title.toLowerCase()} ${name}!`, got, 'The builders will start on your workshop today: look for the sign on the site.'].filter(Boolean) };
  if (key === 'guard') return { lines: [`Raise your right hand... Welcome to the watch, ${name}!`, `${got} Wear the colours with pride.`.trim(), 'Patrol the streets from six to eight. The treasury pays for every hour.'] };
  return { lines: [`It's in the ledger. Welcome, ${P.title.toLowerCase()} ${name}!`, got || 'Good luck out there.'].filter(Boolean) };
}

// Petitioning the mayor to pass or repeal a law: pick one, go round the
// town for signatures, then bring it back.
function petitionTalk(npc, game, arg) {
  const sim = game.sim;
  const L = npc.layout;
  const s = npc.settlement;
  const pet = sim.petition;
  if (pet && pet.sid === s.id && !arg) {
    const law = LAWS[pet.law];
    const need = needed(L);
    if (pet.signers.length < need) return { lines: [`To ${pet.enact ? 'pass' : 'repeal'} the ${law.name.toLowerCase()}? You have ${pet.signers.length} signature${pet.signers.length === 1 ? '' : 's'}; I'd want at least ${need} before the council considers it.`], choices: [{ id: 'petition', arg: 'drop', label: 'Forget the petition.' }], back: 'I\'ll gather more.' };
    const d = decide(L, pet, sim.opinion(npc));
    sim.petition = null;
    if (!d.ok) {
      ledger(L, game.day, `The council turned down ${game.playerName}'s petition to ${pet.enact ? 'pass' : 'repeal'} the ${law.name.toLowerCase()}.`);
      return { lines: ['I\'ve read it, and I\'m sorry: I can\'t agree to this. Not while I\'m in office.'] };
    }
    L.econ.laws[pet.law] = pet.enact;
    ledger(L, game.day, `At the petition of ${game.playerName} and ${pet.signers.length} townsfolk, the ${law.name.toLowerCase()} was ${pet.enact ? 'passed' : 'repealed'}.`);
    sim.addRenown(s.id, 2, 'speaking for the town');
    game.ui.msg(`${s.name}: the ${law.name.toLowerCase()} is ${pet.enact ? 'now law' : 'repealed'}.`, '#ffe070');
    game.audio?.play('fanfare');
    return { lines: [`${pet.signers.length} names... the town has spoken. So be it: the ${law.name.toLowerCase()} is ${pet.enact ? 'law from today' : 'no more'}.`] };
  }
  if (arg === 'drop') {
    sim.petition = null;
    return { lines: ['As you wish.'] };
  }
  if (arg && arg.startsWith('law:')) {
    const [, id, dir] = arg.split(':');
    const enact = dir === 'on';
    if (sim.petition && sim.petition.sid !== s.id) sim.petition = null;
    sim.petition = { sid: s.id, law: id, enact, signers: [], refused: [], day: game.day };
    return { lines: [`Very well. Bring me a petition to ${enact ? 'pass' : 'repeal'} the ${LAWS[id].name.toLowerCase()} with at least ${needed(L)} names on it, and the council will consider it.`, '(Ask townsfolk to sign it.)'] };
  }
  if (!sim.isCitizen(s.id) && sim.opinion(npc) < 20) return { lines: ['The laws of this town are a matter for its people. Become a citizen, or earn our trust, first.'] };
  return {
    lines: ['Which law do you have in mind?'],
    choices: LAW_IDS.filter((id) => lawFits(L.settlement, id)).map((id) => ({ id: 'petition', arg: `law:${id}:${lawOn(L, id) ? 'off' : 'on'}`, label: `${lawOn(L, id) ? 'Repeal' : 'Pass'} the ${LAWS[id].name.toLowerCase()}` })),
    back: 'Never mind.',
  };
}

// How your workshop and house are coming along: waiting for a lot (and the
// street being laid for one), or going up.
function myWorksTalk(npc, game) {
  const sim = game.sim;
  const L = npc.layout;
  const list = sim.roads.yours(L);
  if (!list.length) return { lines: ['Nothing of yours on the books just now. If it\'s finished, go and have a look!'] };
  const mayor = npc.rec.job === 'mayor';
  const lines = [];
  for (const o of list) {
    const thing = o.what === 'workshop' ? 'your workshop' : 'your house';
    const Thing = o.what === 'workshop' ? 'Your workshop' : 'Your house';
    if (o.state === 'line') {
      lines.push(`${Thing} is paid for and in line for the builders${o.after ? `, after ${o.after}'s` : ''}${o.ahead ? ` (${o.ahead === 1 ? 'one more' : `${o.ahead} more`} ahead of it)` : ''}. They start on it as soon as they're free.`);
      continue;
    }
    if (o.state === 'queued') {
      const waited = Math.max(0, game.day - (o.since ?? game.day));
      lines.push(`${Thing} is paid for and waiting on a lot${o.ahead ? ` (${o.ahead === 1 ? 'one thing is' : `${o.ahead} things are`} ahead of it)` : ', next in line'}${waited ? `: ${waited} day${waited === 1 ? '' : 's'} so far` : ''}.`);
      lines.push(o.street !== null ? `A new street is being laid out, with lots along it${o.street ? `: about ${o.street}% of the way` : ' (work has just started)'}. Work on ${thing} starts once it's done.` : 'There\'s no lot free yet. More ground gets marked out any day now.');
      continue;
    }
    const pct = o.pct;
    lines.push(o.road ? `The path to ${thing} goes in first; then the walls go up.` : pct < 15 ? `The foundations of ${thing} ${pct ? `are going in (${pct}%)` : 'have only just begun'}.` : pct < 60 ? `The walls of ${thing} are going up: about ${pct}% done.` : pct < 100 ? `${Thing} is nearly there! Maybe ${pct}% done. The roof's next.` : `${Thing} is finished! Go and have a look.`);
    if (pct < 100) lines.push(o.crew ? `${o.crew} ${mayor ? `builder${o.crew === 1 ? '' : 's'}` : 'of us'} on it, from seven till seven. A day or two yet, I'd say.` : 'There\'s nobody free to work on it just now, I\'m afraid.');
  }
  return { lines };
}

// Asking the mayor (who may knock something off the price for a hard
// worker) or a builder directly to grow your house.
function expandTalk(npc, game, arg) {
  const sim = game.sim;
  const L = npc.layout;
  const s = npc.settlement;
  const b = L.buildings[sim.citizen.home];
  const t = sim.works.expansionTerms(L, b);
  const mayor = npc.rec.job === 'mayor';
  if (!t.ok) {
    return { lines: [{ busy: 'We\'re already working on it!', max: 'Your house is as big as we build them here.', room: 'There\'s no room around your house to build out, I\'m afraid.' }[t.reason] || 'I can\'t help with that.'] };
  }
  const good = mayor && sim.goodStanding(s.id);
  // A builder who thinks well of you knocks something off their own price.
  const op = mayor ? 0 : sim.opinion(npc);
  const friend = mayor ? 0 : op >= 75 ? 0.3 : op >= 50 ? 0.2 : op >= 30 ? 0.1 : 0;
  const cost = good ? Math.round(t.cost * 0.75) : Math.round(t.cost * (1 - friend));
  const size = { house_m: 'a proper house with a third bed', house_l: 'a family house with room for six' }[t.next] || 'something bigger';
  if (arg !== 'yes') {
    const lines = [`We could make it ${size}. That's ¤${cost} for timber, stone and the builders' wages.`];
    if (good) lines.push(`That's a quarter off the usual ¤${t.cost}: you've been working hard for ${s.name}.`);
    else if (mayor) lines.push('Folk who do good work for the town get a better price, you know.');
    else if (friend) lines.push(`${friend >= 0.3 ? 'For an old friend' : friend >= 0.2 ? 'For a friend' : 'For you'}, ${Math.round(friend * 100)}% off: it's usually ¤${t.cost}.`);
    else lines.push('I do a better price for folk I know well, mind.');
    lines.push('It takes a few days, and you\'ll have builders underfoot.');
    return { lines, choices: [{ id: 'expand', arg: 'yes', label: `Do it. (Pay ¤${cost})` }], back: 'Maybe later.' };
  }
  const p = game.player;
  if (countItem(p.inv, 'coin') < cost) return { lines: [`That'll be ¤${cost}. Come back when you have it.`] };
  removeItem(p.inv, 'coin', cost);
  if (mayor) L.econ.treasury += cost;
  else npc.rec.coins = (npc.rec.coins || 0) + cost;
  sim.works.startExpansion(L, b, t.bounds, 'player');
  game.ui.msg(`The builders will enlarge your house in ${s.name}.`, '#ffe070');
  game.audio?.play('coin');
  return { lines: [mayor ? 'Wonderful. I\'ll send the builders round in the morning.' : 'Right! I\'ll get the lads on it first thing.'] };
}

// Timber and stone the player can give the council's building stores.
const WOOD_GIFTS = ['planks', 'planks_birch', 'planks_dark', 'log_oak', 'log_birch', 'log_pine', 'log_palm', 'log_jungle', 'log_acacia', 'log_willow'];
const STONE_GIFTS = ['cobblestone', 'stone', 'stone_bricks', 'bricks'];

// Helping a town grow: timber, stone or coin for the council.
function donateTalk(npc, game, arg) {
  const sim = game.sim;
  const L = npc.layout;
  const s = npc.settlement;
  const e = L.econ;
  const k = stockOf(L);
  const inv = game.player.inv;
  const count = (list) => list.reduce((n, it) => n + countItem(inv, it), 0);
  const take = (list) => {
    let n = 0;
    for (const it of list) {
      const c = countItem(inv, it);
      if (c) removeItem(inv, it, c);
      n += c;
    }
    return n;
  };
  const thanks = (n, what) => {
    sim.changeRep(npc, Math.min(10, 2 + Math.floor(n / 10)));
    sim.addRenown(s.id, Math.max(1, Math.floor(n / 16)), 'your gifts to the town');
    ledger(L, game.day, `${game.playerName} gave the council ${what}.`);
    game.audio?.play('coin');
  };
  if (arg === 'wood') {
    const n = take(WOOD_GIFTS);
    if (!n) return { lines: ['You don\'t seem to have any timber on you.'] };
    k.wood += n * 2;
    thanks(n, `${n} lengths of timber`);
    return { lines: [`${n} lengths of good timber! The builders will be glad of it. Thank you, ${game.playerName}.`] };
  }
  if (arg === 'stone') {
    const n = take(STONE_GIFTS);
    if (!n) return { lines: ['You don\'t seem to have any stone on you.'] };
    k.stone += n * 2;
    thanks(n, `${n} blocks of stone`);
    return { lines: [`${n} blocks of stone. That's a wall's worth, nearly. Thank you!`] };
  }
  if (arg === 'coin') {
    if (countItem(inv, 'coin') < 50) return { lines: ['That\'s kind, but you\'re a little short yourself.'] };
    removeItem(inv, 'coin', 50);
    e.treasury += 50;
    thanks(50, '¤50 for the building fund');
    return { lines: ['Fifty for the building fund! You\'re a friend to this town.'] };
  }
  const t = TIERS[s.type];
  const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.away).length;
  const lines = [`Our stores hold ${k.wood} timber and ${k.stone} stone.${e.short ? ` We're short for the ${(BUILDING_NAMES[e.short] || e.short).toLowerCase()} we want to build.` : ''}`];
  lines.push(t ? `With ${t.pop} folk and a healthy purse, ${s.name} could become a ${t.next}. We're ${people} now.` : `${s.name} is as grand as towns get. Now we keep it that way.`);
  const choices = [];
  const w = count(WOOD_GIFTS);
  const st0 = count(STONE_GIFTS);
  if (w) choices.push({ id: 'donate', arg: 'wood', label: `Give all my timber (${w}).` });
  if (st0) choices.push({ id: 'donate', arg: 'stone', label: `Give all my stone (${st0}).` });
  if (countItem(inv, 'coin') >= 50) choices.push({ id: 'donate', arg: 'coin', label: 'Give ¤50 to the building fund.' });
  if (!choices.length) lines.push('Timber, stone or coin would all help, if you come by any.');
  return { lines, choices: choices.length ? choices : null, back: 'Maybe another time.' };
}

const KIND_TALK = {
  aid: 'asking for help with our treasury', guards: 'asking for a guard or two', settlers: 'asking for settlers', gift: 'with a small gift',
  trade: 'about closer trade', road: 'about building a road between us', warn: 'warning them about a troublemaker', reply: 'answering theirs',
};

const TASKS = {
  smithy: 'work the bellows and sort the stock', tavern: 'serve tables and wash up', shop: 'mind the counter', bakery: 'knead dough and sell loaves',
  library: 'sort the shelves', tailor: 'cut cloth and take orders', workshop: 'sand and plane the timber', herbalist: 'grind herbs and bottle tinctures',
  windmill: 'haul the sacks and sweep up the flour', glassworks: 'feed the kiln and sort the glass', sporehouse: 'turn the peat and pick the caps', pearlhouse: 'shuck oysters and sort the pearls',
};

// Asking a shopkeeper for work, and quitting.
function jobTalk(npc, game, arg) {
  const car = game.sim.careers;
  const L = npc.layout;
  if (car.employs(npc)) {
    const j = car.job;
    if (arg === 'quit') {
      car.resign(null);
      return { lines: [pick(npc.rng, ['Sorry to see you go. The door\'s always open.', 'Suit yourself. Good luck.'])] };
    }
    const late = game.minute >= j.shift[0] && game.minute < j.shift[1] && game.buildingAtPlayer()?.id !== j.building;
    const todo = (j.chores || []).filter((q) => !q.done).map((q) => q.label.toLowerCase());
    return {
      lines: [
        `You work ${clock(j.shift[0])} to ${clock(j.shift[1])} in the ${j.bname}. I pay ¤${j.wage} for every job done: chores, and customers served.`,
        late ? 'And your shift has started, you know. Get in here!' : todo.length ? `Still to do today: ${todo.join('; ')}.` : j.choreDay === game.day ? 'Chores are done. Keep an eye out for customers.' : 'Come in during your shift and I\'ll tell you what needs doing.',
      ],
      choices: [{ id: 'job', arg: 'quit', label: 'I\'d like to quit.' }],
    };
  }
  const t = car.employTerms(npc);
  if (!t.ok) {
    const why = {
      distrust: 'I don\'t know you well enough to put you behind my counter.', poor: 'Business is too slow to pay anyone, I\'m afraid.',
      crimes: 'Not with the guards looking for you.', already: 'You already work here!',
    }[t.reason] || 'I don\'t need anyone.';
    return { lines: [why] };
  }
  if (arg !== 'yes') {
    const b = L.buildings[t.bid];
    const lines = [`I could use someone to ${TASKS[b.type] || 'help out'}. ${clock(t.shift[0])} to ${clock(t.shift[1])}, here in the ${t.bname}: chores, and serving customers. ¤${t.wage} a job, paid at closing.`];
    if (car.job) lines.push(`You'd have to give up being ${car.title()}, mind.`);
    return { lines, choices: [{ id: 'job', arg: 'yes', label: 'You\'ve got yourself a worker.' }], back: 'Not right now.' };
  }
  const r = car.employ(npc);
  if (!r.ok) return { lines: ['Hm. Something came up. Ask me later.'] };
  game.ui.msg(`New job: ${r.role} at the ${r.bname}. (J: journal)`, '#ffe070');
  return { lines: [`Wonderful! Be here at ${clock(r.shift[0])} sharp.`, 'I pay for work done, not for standing around, mind. You can use the shop\'s chests while you\'re on shift.'] };
}

function hireTalk(npc, game, arg) {
  const car = game.sim.careers;
  const s = npc.settlement;
  const t = car.hireTerms(npc);
  if (!t.ok) {
    const why = {
      busy: 'You\'ve already got someone watching your back.', already: 'I\'m already with you!', alone: `I'm the only guard left in ${s.name}. I can't leave my post.`,
      distrust: 'I wouldn\'t guard you if you paid me double.', crimes: 'Guard YOU? You\'re the one we\'re after.',
    }[t.reason] || 'I can\'t.';
    return { lines: [why] };
  }
  if (!arg) {
    const label = { 4: 'A few hours', 12: 'Half a day', 24: 'A whole day', 72: 'Three days' };
    return {
      lines: ['I can walk with you for a while. The fee goes to me and the town\'s coffers.', 'I\'ll see off any beasts, but I won\'t cross the law for you.'],
      choices: t.options.map((o) => ({ id: 'hire', arg: String(o.hours), label: `${label[o.hours] || `${o.hours} hours`} (¤${o.fee})` })),
      back: 'Never mind.',
    };
  }
  const r = car.hire(npc, +arg);
  if (!r.ok) return { lines: [r.reason === 'money' ? `That'd be ¤${r.fee}. Come back when you have it.` : 'Can\'t do it right now.'] };
  game.ui.msg(`${npc.rec.name.first} will escort you for ${r.hours} hours.`, '#80e0ff');
  return { lines: ['Right. Lead the way; I\'ll be right behind you.'], close: true };
}

function favorTalk(npc, game) {
  const fav = game.sim.favors;
  const rng = npc.rng;
  const o = fav.offer(npc);
  if (o.none) {
    const line = {
      asked: 'You already asked today. Maybe tomorrow.', distrust: 'From you? No thank you.', busy: 'You look like you\'ve got your hands full already.',
      recent: 'You\'ve done plenty for me already! Ask me again in a day or two.',
      traveling: 'I\'m only passing through. Thanks, though.',
    }[o.none] || pick(rng, npc.rec.personality.kindness > 0.6 ? ['No, I\'m fine. Kind of you to ask, though!', 'That\'s sweet of you. I\'m all right for now.'] : ['No.', 'I can manage.', 'Not today.']);
    return { lines: [line] };
  }
  return {
    lines: [o.text],
    choices: [{ id: 'favor_accept', label: 'I\'ll do it.' }, { id: 'favor_decline', label: 'Sorry, I can\'t.' }],
    back: null,
  };
}

function favorCheck(npc, game) {
  const fav = game.sim.favors;
  const r = fav.turnIn(npc);
  if (!r) return { lines: ['Hm?'] };
  const f = r.f;
  if (r.done) {
    const lines = [f.kind === 'slay' ? 'You did it? The nights will be quieter now. Thank you!' : f.item === 'food' ? 'Oh, bless you. I was so hungry.' : pick(npc.rng, ['Just what I needed! Thank you!', 'You found it! Wonderful!'])];
    lines.push(r.paid ? `Here, ¤${r.paid} as promised.` : 'I\'ve nothing to give you, but I won\'t forget this.');
    return { lines: [...lines, `(${repLevel(game.sim.opinion(npc)).label})`] };
  }
  if (f.kind === 'deliver') {
    const L = npc.layout;
    const to = L.npcs[f.to];
    const where = to ? whereIs(L, to, game) : null;
    return { lines: [`Did you give it to ${f.toName} yet?${where ? ` ${f.toName} should be ${where}.` : ''}`] };
  }
  if (f.kind === 'slay') return { lines: [`${r.pr.need - r.pr.have} more to go. The beasts come out after dark.`] };
  return { lines: [`Still waiting on ${plural(f.item, r.pr.need - r.pr.have)}.${r.pr.have ? ` (You have ${r.pr.have}.)` : ''}`] };
}

// ------------------------------------------------------------ small talk
// Questions they ask you back. Answers please or annoy them depending on
// who they are.
function questions(npc, game) {
  const rec = npc.rec;
  const p = rec.personality;
  const s = npc.settlement;
  const sim = game.sim;
  const qs = [];
  const citizen = sim.isCitizen(s.id);
  const title = sim.careers.title();
  qs.push({
    id: 'stay', q: citizen ? `How are you finding life in ${s.name}, neighbour?` : `So, are you planning to stay in ${s.name} long?`,
    answers: citizen ? [
      ['I love it here.', () => [3, 'That warms my heart!']],
      ['It\'s... fine.', () => [0, 'Give it time.']],
      ['Honestly? I miss the road.', () => (p.bravery > 0.6 ? [1, 'I know the feeling. The road calls to some of us.'] : [-1, 'Hm. Well, nobody\'s stopping you.'])],
    ] : [
      ['I might settle down here.', () => (p.sociability > 0.4 ? [3, 'We\'d be glad to have you! Talk to the mayor.'] : [1, 'Hm. The mayor handles that sort of thing.'])],
      ['Just passing through.', () => [0, 'Well, enjoy your stay.']],
      ['Depends how friendly people are.', () => (p.temper > 0.6 ? [-2, 'Hmph. Friendlier than you, I\'d wager.'] : [1, 'Ha! We\'re a friendly bunch, mostly.'])],
    ],
  });
  qs.push({
    id: 'living', q: 'What do you do for a living, anyway?',
    answers: [
      ...(title ? [[`I'm ${/^[AEIOU]/.test(title) ? 'an' : 'a'} ${title.split(',')[0]}.`, () => [2, sim.careers.isGuard(s.id) ? 'Glad to have you on the watch!' : 'Good, honest work.']]] : []),
      ['I\'m an adventurer.', () => (p.bravery > 0.55 ? [2, 'How exciting! I\'d love to hear your stories.'] : [0, 'Sounds dangerous... rather you than me.'])],
      ['A bit of this, a bit of that.', () => (p.diligence > 0.65 ? [-2, 'Hm. Idle hands, as they say.'] : [1, 'Ha! Me too, honestly.'])],
    ],
  });
  const k = kitchenOf(npc.layout);
  if (k) {
    const q = st.count(k.store, 'feast') ? 'delightful' : st.count(k.store, 'stew') ? 'decent' : st.count(k.store, 'gruel') ? 'awful' : 'empty';
    const cook = rec.job === 'cook';
    qs.push({
      id: 'food', q: cook ? 'Have you tried my cooking yet?' : 'Have you eaten at the tavern? What did you think?',
      answers: [
        ['Delicious!', () => (cook ? [4, 'Ha! You have excellent taste.'] : q === 'awful' ? [-1, 'Really? Were you starving?'] : [1, 'Isn\'t it? Best around.'])],
        ['It was awful.', () => (cook ? [-5, 'Well! Nobody asked you!'] : q === 'awful' ? [2, 'Ha! Isn\'t it just? The cook tries, bless them.'] : [-1, 'Oh? I quite like it.'])],
        ['I haven\'t yet.', () => [0, cook ? 'Well, come by! The pot\'s always on.' : 'You should, sometime.']],
      ],
    });
  }
  const h = rec.hobbies && rec.hobbies[0] && HOBBIES[rec.hobbies[0]];
  if (h) {
    qs.push({
      id: 'hobby', q: `Do you ever go in for ${h.label}?`,
      answers: [
        ['I love it!', () => [3, 'A kindred spirit! We should sometime.']],
        ['Never tried it.', () => [1, 'You should! It\'s wonderful.']],
        ['Sounds dull.', () => [p.temper > 0.5 ? -4 : -2, '...Well, suit yourself.']],
      ],
    });
  }
  const m = mayorOf(npc.layout);
  if (m && m !== rec && !npc.visit) {
    const likes = affinity(rec, m) >= 0;
    qs.push({
      id: 'mayor', q: `What do you make of our ${s.type === 'village' ? 'elder' : 'mayor'}, ${m.name.first}?`,
      answers: [
        ['A fine leader.', () => (likes ? [2, 'I think so too.'] : [-1, 'If you say so...'])],
        ['Not impressed.', () => (likes ? [-2, 'Careful. People here like them.'] : [2, 'Ha! Between you and me, neither am I.'])],
        ['I haven\'t met them.', () => [0, `You should. ${m.name.first} is at the hall most days.`]],
      ],
    });
  }
  const sky = game.weatherIn ? game.weatherIn(npc.settlement) : game.weather?.kind;
  const w = sky && sky !== 'clear' ? sky : null;
  qs.push({
    id: 'weather', q: w === 'rain' ? 'Miserable rain, eh?' : w === 'snow' ? 'Cold enough for you?' : w === 'fog' ? 'Can\'t see a thing in this fog, can you?' : 'Lovely weather, isn\'t it?',
    answers: [
      ['Couldn\'t agree more.', () => [1, 'Ha, glad it\'s not just me.']],
      ['I\'ve seen worse.', () => [0, 'Well, you\'re tougher than me.']],
    ],
  });
  const e = npc.layout.econ;
  if (e.recent.thefts + e.recent.violence > 0) {
    qs.push({
      id: 'trouble', q: 'Did you hear about the trouble in town lately?',
      answers: [
        ['Terrible business.', () => [1, 'It is. I lock my door now.']],
        ['I had nothing to do with it!', () => (sim.justice.pendingIn(s.id).length || sim.justice.recordOf(s.id).convictions ? [-3, '...Nobody said you did.'] : [0, 'Ha! Relax, nobody said you did.'])],
        ['Who cares?', () => [-3, 'We do. It\'s our home.']],
      ],
    });
  }
  return qs;
}

function askQuestion(npc, game) {
  const qs = questions(npc, game);
  const r = game.sim.repEntry(game.sim.repSidOf(npc), npc.rec.idx);
  r.qn = (r.qn || 0) + 1;
  const q = qs[(npc.rec.idx + r.qn) % qs.length];
  npc.pendingQ = q.id;
  return { q: q.q, choices: q.answers.map(([label], i) => ({ id: 'answer', arg: `${q.id}:${i}`, label })) };
}

function answer(npc, game, arg) {
  const [qid, i] = arg.split(':');
  const q = questions(npc, game).find((x) => x.id === qid);
  if (!q || !q.answers[+i]) return { lines: ['Hm.'] };
  const [delta, line] = q.answers[+i][1]();
  if (npc.pendingQ === qid && delta) game.sim.changeRep(npc, delta);
  npc.pendingQ = null;
  return { lines: [line] };
}

// The NPC's answer to a topic: { lines, choices, back, close, open, after }.
// Everything a person says to you comes out in their own voice.
export function respond(npc, game, id, arg) {
  const r = respondRaw(npc, game, id, arg);
  if (r && Array.isArray(r.lines) && game.sim) {
    const op = game.sim.opinion(npc);
    r.lines = speakAll(npc.rec, r.lines, { warm: op >= 35, cold: op <= -25 });
  }
  return r;
}

function respondRaw(npc, game, id, arg) {
  if (isSagaTopic(id)) return sagaRespond(npc, game, id, arg);
  const rec = npc.rec;
  const L = npc.layout;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const sim = game.sim;
  const e = L.econ;
  const job = jobTitle(rec, s);
  const name = game.playerName;
  const tn = tone(npc, game);
  const mem = sim.repEntry(sim.repSidOf(npc), rec.idx);
  sim.meet(npc);
  switch (id) {
    case 'ask':
      return { lines: [tn === 'warm' ? 'Ask away!' : tn === 'cold' ? 'What now?' : pick(rng, ['Hm? What about?', 'Sure, what is it?'])], choices: askMenu(npc, game) };
    case 'adv_road':
    case 'adv_why':
    case 'adv_guard':
    case 'adv_swap':
    case 'adv_duel':
    case 'adv_tip':
      return adventurerTalk(npc, game, id, arg);
    case 'co_route':
    case 'co_company':
    case 'co_road':
      return companyTalk(npc, game, id);
    case 'trip':
    case 'trip_when':
    case 'trip_tell':
      return tripTalk(npc, game, id, arg);
    case 'who': {
      if (npc.adventurer) return adventurerTalk(npc, game, 'who');
      if (npc.company) return companyTalk(npc, game, 'who');
      if (npc.visit && npc.visit.guest) return { lines: [`${rec.name.first} ${rec.name.last}, from ${npc.visit.fromName}. ${jobTitle(rec, npc.homeLayout.settlement)} there, when I'm at home.`, npc.visit.ev ? `We came for ${npc.visit.ev.title}.` : 'Just visiting, seeing how the other half live.'] };
      if (npc.visit) return { lines: [`${rec.name.first} ${rec.name.last}, traveling merchant from ${npc.visit.fromName}. I carry goods between there and the towns around it.`] };
      if (npc.nomad) return { lines: [`${rec.name.first} ${rec.name.last}. We come from everywhere and nowhere: the ${rec.name.last}s have been on the road for years.`, rec.age === 'child' ? 'I was born in a wagon!' : 'We\'re looking for somewhere to put down roots.'] };
      if (rec.age === 'child') return { lines: [pick(rng, [`I'm ${rec.name.first}! I'm ${6 + (rec.idx % 7)}!`, `I'm ${rec.name.first}. Wanna play tag?`, `My name's ${rec.name.first}!`])] };
      const pre = tn === 'cold' ? 'Why do you care? ' : '';
      // They remember telling you already, and share something new.
      if (mem.who) {
        mem.who++;
        const facts = [];
        const hb = (rec.hobbies || []).map((hk) => HOBBIES[hk]).filter(Boolean);
        if (hb.length) facts.push(`When I'm not working, I'm usually ${hb[0].label}.`);
        const home = npc.homeBuilding();
        if (home && home.homeName) facts.push(`I live at ${home.homeName}.`);
        if (rec.traits.length) facts.push(`People say I'm ${traitWords([rec.traits[rec.traits.length - 1]])}. Can't think why.`);
        if (rec.skills) {
          const best = Object.entries(rec.skills).sort((a, b) => b[1] - a[1])[0];
          if (best && best[1] > 0.6) facts.push(`I'm good at ${best[0]}, if I say so myself.`);
        }
        const f = facts.length ? facts[mem.who % facts.length] : 'Not much else to say.';
        return { lines: [tn === 'cold' ? `You know who I am. ${f}` : `Still ${rec.name.first}, still the ${job.toLowerCase()}! ${f}`] };
      }
      mem.who = 1;
      if (rec.job === 'retired') return { lines: [`${pre}I'm ${rec.name.first} ${rec.name.last}. I've lived in ${s.name} all my life.`] };
      const wp = rec.work && rec.work.building != null && L.buildings[rec.work.building] ? L.buildings[rec.work.building] : null;
      const where = wp ? ` at the ${bare(wp.name)}` : rec.job === 'farmer' ? ' in the fields' : rec.job === 'fisher' ? ' down by the water' : rec.job === 'guard' ? ' keeping these streets safe' : rec.job === 'trapper' ? ' out in the wilds' : '';
      const lines = [`${pre}I'm ${rec.name.first} ${rec.name.last}, ${aOrAn(job.toLowerCase())} ${job.toLowerCase()}${where}.`];
      const sk = rec.skills || {};
      if (rec.job === 'cook') lines.push(sk.cooking > 0.75 ? 'Folk come from miles around for my feasts.' : sk.cooking < 0.45 ? 'I\'m... still learning. Don\'t ask about the gruel.' : 'I cook a decent stew, if I say so myself.');
      else if (rec.job === 'trapper') lines.push(sk.hunting > 0.7 ? 'Bow, blade or snare, I always bring something home.' : 'Some days the woods are generous. Some days not.');
      else if (rec.traits.length && tn !== 'cold') lines.push(`People say I'm ${traitWords(rec.traits.slice(0, 2))}.`);
      return { lines, choices: [{ id: 'work', label: 'What\'s your work like?' }, { id: 'family', label: 'Do you have family here?' }] };
    }
    case 'doing': {
      const act = npc.activity?.entry;
      const lines = [];
      if (npc.hired) lines.push('Watching your back. What else?');
      else if (!act) lines.push('Just taking a breather.');
      else if (act.act === 'mourn' || act.act === 'funeral') lines.push(`I'm paying my respects to ${act.who || 'an old friend'}.`);
      else if (act.act === 'event') lines.push(eventLine(npc, game, act));
      else if (act.act === 'poster') lines.push(act.mode === 'down' ? 'Taking the posters down. It was a grand day.' : 'Putting up posters, so nobody misses it. Here, have a look at one!');
      else if (act.act === 'build') lines.push(act.label ? `Working on ${act.label}. Mind the planks.` : sim.citizen ? (sim.citizen.native ? `Building your own place, ${name.split(' ')[0]}! Leaving the nest at last, eh?` : `Building a house for our newest citizen: you, ${name}!`) : 'Building. Mind the planks.');
      else if (act.act === 'repair') lines.push('Patching up the jail. Someone made a right mess of it.');
      else if (act.act === 'home' && act.weather) lines.push(pick(rng, [`No sense working out in the ${act.weather === 'snow' ? 'snow' : act.weather === 'fog' ? 'fog' : 'rain'}. I'll catch up tomorrow.`, 'Staying dry. The work will keep.']));
      else if (act.act === 'forage') lines.push(rec.age === 'child' ? 'Looking for berries. We\'ve got nothing to eat at home...' : 'Out looking for food. Times are lean.');
      else if (act.act === 'trial') lines.push('There\'s to be a hearing at the jail.');
      else if (act.act === 'travel') {
        const q = sim.diplomacy.letters.find((m) => m.carrierIdx === rec.idx && m.from === s.id && m.status === 'carried');
        if (rec.errand && q) lines.push(`The mayor's paying me to take a letter to ${sim.diplomacy.town(q.to).name}. Can't stop long!`);
        else if (rec.trip && rec.trip.raft) lines.push(`Taking my raft to ${sim.diplomacy.town(rec.trip.dest).name}. Beats walking, and the goods stay dry. Mostly.`);
        else lines.push(q ? `Off to ${sim.diplomacy.town(q.to).name} with my goods, and a letter from the mayor.` : 'Off on the road with my goods!');
      }
      else if (act.act === 'visit' && npc.visit && npc.visit.guest) lines.push(`Just visiting from ${npc.visit.fromName}. Seeing the sights.`);
      else if (act.act === 'visit') lines.push(`Selling wares from ${npc.visit ? npc.visit.fromName : 'afar'}. Have a look!`);
      else if (act.act === 'help') {
        const par = npc.workingParent && npc.workingParent();
        const who = par ? ((rec.parents || []).indexOf(par.rec.idx) === 1 ? 'Dad' : 'Mum') : null;
        lines.push(par ? pick(rng, [`Helping ${who}! I'm really good at it.`, `${who} says I'm a big help. Mostly.`]) : pick(rng, ['Just walking about. Nobody needs my help.', 'Looking for something to do.']));
      } else if (act.act === 'wander' && rec.age === 'child') lines.push(pick(rng, ['Exploring! There\'s a cat round the back of the tavern.', 'Just walking. Seeing what\'s what.']));
      else if (act.act === 'hobby' && HOBBIES[act.hobby]) lines.push(pick(rng, [`Nothing beats ${HOBBIES[act.hobby].label} after a long day.`, `I'm fond of ${HOBBIES[act.hobby].label}.`]));
      else if (act.act === 'work' && p.diligence < 0.3) lines.push(pick(rng, ['Don\'t tell anyone I\'m slacking off.', 'Is it quitting time yet?']));
      else if (act.act === 'work' && rec.job === 'cook') lines.push(pick(rng, ['Keeping the pot bubbling.', 'Cooking for half the town, as usual.']));
      else if (act.act === 'work' && rec.job === 'trapper') lines.push(pick(rng, ['Checking my snares. Rabbits are clever this season.', 'Hunting. Keep your voice down.']));
      else if (act.act === 'work') lines.push(tn === 'cold' ? 'Working. Unlike some.' : pick(rng, ['Work never ends around here.', 'Honest work, honest pay.', 'Can\'t chat long, lots to do.']));
      else if (act.act === 'eat') {
        const m = rec.lastMeal;
        if (m && m.item) lines.push(m.q === 'terrible' ? `Eating... well, "eating". This ${ITEMS[m.item].name.toLowerCase()} is awful.` : m.q === 'delightful' ? `Having the most delightful ${ITEMS[m.item].name.toLowerCase()}!` : `Having some ${ITEMS[m.item].name.toLowerCase()}.`);
        else lines.push('Supposed to be eating, but there\'s nothing to eat.');
      } else if (act.act === 'sleep') lines.push('I should really be asleep...');
      else lines.push(pick(rng, ['Just passing the time.', 'Not much. You?']));
      if (rec.hungry >= 1 && act?.act !== 'eat') lines.push(rec.hungry >= 2 ? 'I haven\'t eaten properly in days.' : 'I didn\'t get to eat yesterday.');
      return { lines };
    }
    case 'work': return workTalk(npc, game);
    case 'news': return { lines: news(npc, game), choices: [{ id: 'news', label: 'Anything else?' }], back: 'Thanks.' };
    case 'customs': {
      // (A visitor tells of home.)
      const home = npc.visit ? game.world.ow.settlements[npc.visit.from] || s : s;
      return { lines: customsTalk(home), back: 'Thanks.' };
    }
    case 'history': return { lines: rec.age === 'child' ? [`Gran says ${game.sim.history.legend(npc.layout)}`, 'Spooky, right?'] : game.sim.history.talk(npc.layout, rng), back: 'Fascinating.' };
    case 'life': return { lines: rec.age === 'child' ? kidLife(npc, game) : lifeIn(npc, game) };
    case 'chat': {
      // Whatever's on their mind, in their own way of putting it.
      const r2 = new RNG(hash4(rec.idx, Math.floor(game.sim.abs / 7), (npc.chatN = (npc.chatN || 0) + 1)));
      const ctx = talkContext(game, npc.visit ? game.world.ow.settlements[npc.visit.from] || s : s);
      const lines = [smallTalk(rec, r2, ctx)];
      if (r2.chance(0.55)) lines.push(smallTalk(rec, r2, ctx));
      return { lines, choices: [{ id: 'chat', label: 'Go on.' }], back: 'Well, take care.' };
    }
    case 'family': {
      const lines = family(npc, game);
      const g = griefOf(rec);
      const choices = [];
      if (g && !g.byPlayer) {
        if (!g.condoled) choices.push({ id: 'condole', label: 'I\'m so sorry for your loss.' });
        choices.push({ id: 'howdied', label: `What happened to ${g.first}?` });
      }
      const Lh = npc.homeLayout || L;
      const close = [rec.partner, ...rec.children].filter((i) => i !== null && i !== undefined && Lh.npcs[i] && alive(Lh.npcs[i]));
      for (const i of close.slice(0, 2)) choices.push({ id: 'people', arg: String(i), label: `Tell me about ${Lh.npcs[i].name.first}.` });
      return { lines, choices: choices.length ? choices : null };
    }
    case 'condole': {
      const g = griefOf(rec);
      if (!g) return { lines: ['Thank you.'] };
      if (!g.condoled) {
        g.condoled = true;
        sim.changeRep(npc, p.kindness > 0.5 ? 4 : 2);
      }
      return { lines: [pick(rng, ['Thank you. That means more than you know.', `Thank you. ${g.first} would have liked you.`, '...Thank you.'])] };
    }
    case 'howdied': {
      const g = griefOf(rec);
      if (!g) return { lines: ['...'] };
      if (g.byPlayer) return { lines: ['You KNOW what happened. Get out of my sight.'], close: true };
      const Lh = npc.homeLayout || L;
      const dead = Lh.npcs[g.idx];
      const when = dead && dead.deathDay !== undefined ? ` on day ${dead.deathDay}` : '';
      const c = g.cause || 'misadventure';
      const unsolved = c === 'slain' && sim.justice.unsolved.some((u) => u.sid === Lh.settlement.id && u.victim === g.name);
      const line = c === 'slain' ? `Someone killed ${g.first}${when}. ${unsolved ? 'Nobody knows who. The guards keep asking who was seen nearby.' : 'I hope they rot for it.'}`
        : c.startsWith('killed by') ? `${g.first} was ${c}${when}. Out there, where the beasts roam.`
          : c === 'old age' ? `${g.first} went peacefully${when}. It was their time, I suppose.`
            : `${g.first} died${when}: ${c}. It happened so fast.`;
      return { lines: [line, g.slot ? 'We buried them in the graveyard. I visit when I can.' : ''].filter(Boolean) };
    }
    case 'people':
      if (arg !== undefined && arg !== null) return aboutPerson(npc, +arg, game);
      {
        const list = peopleFor(npc, game);
        if (!list.length) return { lines: ['I don\'t really know anyone to speak of.'] };
        return { lines: [tn === 'cold' ? 'Who?' : 'Who do you mean?'], choices: list };
      }
    case 'kind': {
      const d = sim.chat(npc, 'kind');
      const lvl = repLevel(sim.opinion(npc));
      if (!d) return { lines: [pick(rng, ['Ha, you already said that today.', 'You\'re sweet, but we just chatted.', 'Yes, yes. Thank you.'])] };
      const first = p.kindness < 0.3 ? pick(rng, ['...Fine. Thanks, I suppose.', 'Hmph. You\'re not so bad.']) : pick(rng, ['Oh, that\'s kind of you to say!', 'Ha! You\'re a charmer.', 'What a lovely thing to say.', 'Well, aren\'t you pleasant company!']);
      // Chatty folk ask you something back.
      if (rec.age !== 'child' && rng.chance(0.35 + p.sociability * 0.5)) {
        const q = askQuestion(npc, game);
        return { lines: [first, q.q], choices: q.choices, back: '(Say nothing)' };
      }
      return { lines: [first, `(${lvl.label})`] };
    }
    case 'weathertalk': {
      const d = sim.chat(npc, 'kind');
      const lines = weatherTalk(npc, game);
      if (!d) lines.push('(You\'ve already chatted today.)');
      return { lines };
    }
    case 'answer': return answer(npc, game, arg);
    case 'rude': {
      sim.chat(npc, 'rude');
      const angry = p.temper > 0.6;
      if (npc.hired) {
        const friend = npc.hired.companion;
        sim.careers.endEscort(null);
        return { lines: [friend ? 'I thought we were friends. I\'m going home.' : 'Protect yourself, then. I\'m done.'], close: true };
      }
      // Insulting your boss costs you the job; insulting the mayor may cost a guard the post.
      if (sim.careers.employs(npc)) {
        sim.careers.fire(npc.layout, sim.careers.job, 'Talk to me like that? You\'re fired!');
        return { lines: ['How DARE you. Don\'t bother coming back to work!'], close: true };
      }
      if (rec.job === 'mayor' && sim.careers.isGuard(s.id) && rng.chance(0.4 + p.temper * 0.5)) {
        sim.careers.stripGuard('insulted the mayor');
        return { lines: ['You insult ME? Hand over that badge. You\'re off the watch!'], close: true };
      }
      return { lines: [angry ? pick(rng, ['What did you just say to me?!', 'Say that again, I dare you!', 'Get out of my sight!']) : pick(rng, ['...That was uncalled for.', 'How rude!', 'I don\'t have to listen to this.'])], close: angry };
    }
    case 'gift': return { open: 'gift' };
    case 'trade': return { open: 'trade' };
    // (Round 54) The room to let.
    case 'inn_room':
    case 'inn_rent':
      return innTalk(npc, game, id, arg);
    case 'directions':
      if (arg) {
        const pl = placesFor(npc, game).find((q) => q.key === arg);
        if (!pl) return { lines: ['I don\'t know that place.'] };
        const dir = direction(npc.x, npc.z, pl.x, pl.z);
        return { lines: [tn === 'cold' ? `Figure it out yourself. ...Fine. It's ${dir}.` : `The ${pl.label.replace(/^The /, '')} is ${dir}.`] };
      }
      return { lines: ['Where to?'], choices: placesFor(npc, game).map((pl) => ({ id: 'directions', arg: pl.key, label: pl.label })) };
    case 'wing': return { lines: wingTalk(rec, s.id) };
    case 'surrender': {
      const sid = s.id;
      return { lines: ['A wise choice. Come along.'], close: true, after: () => sim.justice.surrender(sid, npc) };
    }
    case 'citizen': return citizenTalk(npc, game, arg);
    case 'ownhome': {
      const t = sim.ownHomeTerms(npc);
      if (!t.ok) return { lines: [{ have: 'You have a house already!', building: 'The builders are already at work on it.', inline: 'It\'s paid for: yours is in line for the builders, after the house they\'re on now.', queued: 'It\'s paid for: your house goes up on the next free lot. The builders are laying out a new street for it.', citizen: 'Only citizens may build here.' }[t.reason] || 'Not just now.'] };
      if (arg !== 'yes') {
        const kin = sim.citizen.native ? 'Leaving the family home at last? Good for you.' : 'A place of your own? Of course.';
        const where = t.after ? `as soon as they've finished ${t.after}'s${t.ahead ? ` (and ${t.ahead === 1 ? 'one more' : `${t.ahead} more`} waiting before yours)` : ''}` : t.plot ? 'on the free lot' : 'on the next lot we mark out (there\'s none free this minute; a new street is on its way)';
        return { lines: [kin, `The builders can put up a cottage ${where} for ¤${t.fee}. It takes a day or two once they start.`], choices: [{ id: 'ownhome', arg: 'yes', label: `Please do. (Pay ¤${t.fee})` }], back: 'I\'ll stay where I am for now.' };
      }
      const r = sim.ownHome(npc);
      if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee} for the builders.` : 'Something went wrong with the paperwork.'] };
      game.ui.msg(r.after ? `Your cottage is in line for the builders, after ${r.after}'s.` : r.queued ? 'Your cottage will go up on the next free lot.' : 'The builders will start on your cottage today.', '#ffe070');
      return { lines: [r.after ? `It's paid for. The builders are on ${r.after}'s house; yours is next in line once it's up. You can stay where you are until then.` : r.queued ? 'It\'s paid for. As soon as there\'s a lot free, the builders start on it. You can stay with your family until then.' : 'It\'s done: the builders start today. You can stay with your family until it\'s ready.'] };
    }
    case 'renounce':
      if (arg === 'yes') {
        sim.revoke('renounced');
        return { lines: [`So be it. You are no longer a citizen of ${s.name}.`] };
      }
      return { lines: ['Are you certain? Your home and standing here would be forfeit.'], choices: [{ id: 'renounce', arg: 'yes', label: 'Yes, I renounce it.' }], back: 'On second thought, no.' };
    case 'profession': return professionTalk(npc, game, arg);
    case 'research': return researchTalk(npc, game);
    case 'give_core': return arg === 'yes' ? coreTalk(npc, game) : confirmGift(npc, game, 'kav_core');
    case 'ancient_view': return { lines: ['Come, see. The scholars have drawn it out already.'], open: 'ancient' };
    case 'give_plans': return arg === 'yes' ? plansTalk(npc, game) : confirmGift(npc, game, 'old_blueprint');
    case 'oldplaces': return oldPlacesTalk(npc, game);
    case 'geo': return geoTalk(npc, game, arg);
    case 'bandits': return { lines: game.sim.bandits.talk(npc.layout, rng), back: 'I\'ll keep my eyes open.' };
    case 'bounty': {
      const r = game.sim.bandits.claim(npc.layout);
      if (!r) return { lines: ['Bounty? I\'ve no record of you bringing anyone in.'] };
      game.audio?.play('coin');
      return { lines: [`Here: ¤${r.pay}, as promised. The roads are safer for it.`].concat(r.owed > 0 ? [`(The town owes you ¤${r.owed} more, but the strongbox is empty.)`] : []) };
    }
    case 'paper': {
      const r = sim.press.handOut(npc);
      if (!r.ok) return { lines: [r.reason === 'read' ? 'I\'ve read that one already, thanks.' : 'A newspaper? You\'ve none left.'] };
      const h = r.story.text.replace(/\.$/, '');
      const react = rec.age === 'child'
        ? pick(rng, ['Ooh, a newspaper! Are there pictures?', `"${h}"! I'm going to tell everyone!`])
        : r.fresh
          ? pick(rng, [`"${h}"... well I never! Thank you.`, `Let's see... "${h}". So that's what happened.`, `The ${r.ed.title}? Don't mind if I do.`])
          : pick(rng, ['Bit old, this news, isn\'t it? Still, thank you.', 'I heard most of this already. Thanks all the same.']);
      return { lines: [react, ...(r.paid ? [`(${rec.name.first} pays you ¤${r.paid} for it.)`] : [])] };
    }
    case 'job': return jobTalk(npc, game, arg);
    case 'hire': return hireTalk(npc, game, arg);
    case 'escort': {
      if (npc.hired && npc.hired.companion) return { lines: [pick(rng, ['Never better! It\'s good to see the world.', 'My feet hurt, but I wouldn\'t miss this.', `I do miss ${s.name} a little. But lead on!`])] };
      const h = Math.ceil(sim.careers.hoursLeft());
      return { lines: [`Another ${h} hour${h === 1 ? '' : 's'}, then I head back to ${s.name}.`] };
    }
    case 'companion': {
      const t = sim.careers.companionTerms(npc);
      if (!t.ok) {
        const why = {
          busy: 'You\'ve already got company on the road.', crimes: 'Not with the guards after you.', child: 'I\'m not allowed!', elder: 'My old bones wouldn\'t last a day on the road, dear.',
          duty: 'I can\'t leave my post, much as I\'d like to.', grief: 'Not now. I need to be here for my family.', distrust: 'We\'re not that close, are we?',
        }[t.reason] || 'I can\'t.';
        return { lines: [why] };
      }
      if (arg !== 'yes') return { lines: [`Travel with you? ${p.bravery > 0.55 ? 'I\'ve always wanted an adventure!' : 'It sounds a little frightening... but with you, why not?'}`], choices: [{ id: 'companion', arg: 'yes', label: 'Pack your things, then!' }], back: 'On second thought, stay here.' };
      sim.careers.recruit(npc);
      game.ui.msg(`${rec.name.first} is travelling with you. Talk to them to send them home.`, '#80e0ff');
      return { lines: ['Lead the way!'], close: true };
    }
    case 'serve': {
      const r = sim.careers.serveCustomer(npc);
      if (!r.ok) return { lines: [r.reason === 'missing' ? 'You don\'t have that. Never mind, then.' : r.reason === 'stock' ? 'Out of stock? Pity. Another time.' : r.reason === 'money' ? 'Short of coin? Another time, then.' : 'Hm?'], close: true };
      return { lines: [r.kind === 'shop' ? pick(rng, ['Thank you kindly!', 'Just what I needed.']) : r.kind === 'offer' ? `A fair price. It's all yours.` : `Pleasure doing business! Here's ¤${r.paid}.`], close: true };
    }
    case 'conduct': {
      const r = sim.settleConfront(npc, arg || 'expel');
      if (r === 'warned') return { lines: ['See that you do. If things haven\'t improved in a few days, you\'ll hand back your citizenship.'] };
      if (r === 'last') return { lines: ['...I\'ll pretend I didn\'t hear that. This is your last warning.'] };
      if (r === 'expelled') {
        return { lines: [arg === 'defy' ? 'Then you leave me no choice. Your citizenship is revoked.' : 'Your name has been struck from the ledger. I\'m sorry it came to this.'], close: true };
      }
      return { lines: ['...'] };
    }
    case 'expand': return expandTalk(npc, game, arg);
    case 'nomad': {
      const b = npc.nomad;
      if (!b) return { lines: ['...'] };
      if (arg === 'vouch') {
        if (!sim.isCitizen(s.id)) return { lines: ['You don\'t live here, do you? No offence, but we\'ll ask someone who does.'] };
        const good = sim.areaMod(s.id) >= 0;
        if (!b.vouchedBy) {
          b.vouchedBy = true;
          b.vouched += good ? 2 : 1;
        }
        return { lines: [good ? 'A citizen speaks well of it... that counts for a lot. Thank you.' : 'Kind of you to say. We\'ll see.'] };
      }
      const v = sim.nomads.judge(npc.layout, b);
      const bits = [];
      bits.push(v.room >= b.people.length ? 'There\'s room for us here' : 'But there\'s nowhere for us to live');
      if (v.reasons.includes('hunger')) bits.push('and people look hungry');
      if (v.reasons.includes('danger')) bits.push('and it doesn\'t feel safe');
      if (v.reasons.includes('taxes')) bits.push('and the taxes are steep');
      const hours = Math.max(0, Math.round((b.decide - sim.abs) / 60));
      return {
        lines: [`${bits.join(', ')}.`, v.ok ? `We're leaning towards staying. We'll decide within ${hours || 1} hours.` : `We'll move on in ${hours || 1} hours unless something changes our minds.`],
        // Only someone who lives here can vouch for the place.
        choices: b.vouchedBy || !sim.isCitizen(s.id) ? null : [{ id: 'nomad', arg: 'vouch', label: `You should stay! ${s.name} is a good place.` }],
        back: 'Good luck, whatever you choose.',
      };
    }
    case 'donate': return donateTalk(npc, game, arg);
    case 'towns': {
      const near = sim.diplomacy.neighbours(s, 18).slice(0, 4);
      if (!near.length) return { lines: ['We\'re out here on our own. Nobody lives within a week\'s walk.'] };
      if (arg !== undefined && arg !== null) {
        const o = near.find((q) => String(q.id) === String(arg));
        if (o) return { lines: townReport(game, npc.layout, o), choices: near.filter((q) => q !== o).map((q) => ({ id: 'towns', arg: String(q.id), label: `And ${q.name}?` })), back: 'Thank you.' };
      }
      return {
        lines: [`Our neighbours? ${near.map((o) => o.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`, 'Which would you like to hear about?'],
        choices: near.map((o) => ({ id: 'towns', arg: String(o.id), label: `Tell me about ${o.name}.` })),
        back: 'Never mind.',
      };
    }
    case 'mail': {
      const dip = sim.diplomacy;
      const q = dip.waitingFrom(s.id)[0];
      if (!q) return { lines: ['Not today, thank you.'] };
      const to = dip.town(q.to);
      const pay = 10 + Math.round(dip.dist(s, to) * 3);
      if (arg !== 'yes') {
        return {
          lines: [`As it happens, yes: a letter to the mayor of ${to.name}, ${KIND_TALK[q.kind] || 'on town business'}.`, `${to.name}'s council will pay you ¤${pay} when it arrives. It's ${townDirections(game, s, to)}.`],
          choices: [{ id: 'mail', arg: 'yes', label: 'I\'ll take it.' }], back: 'Not now.',
        };
      }
      dip.playerTakes(q);
      q.pay = pay;
      const pl = game.player;
      const left = pl.give('dispatch', 1);
      if (left) game.spawnDrop('dispatch', left, pl.x, pl.y, pl.z, true);
      sim.changeRep(npc, 2);
      q.where = townDirections(game, s, to);
      revealTown(game, to);
      return { lines: [`Here it is, sealed. Hand it to the mayor of ${to.name} and nobody else.`, `${to.name} is ${q.where}. I've marked it on your map.`, '(Noted in your journal: J)'] };
    }
    case 'dispatch': {
      const dip = sim.diplomacy;
      const q = dip.forPlayer(s.id)[0];
      if (!q || !countItem(game.player.inv, 'dispatch')) return { lines: ['A letter? Where?'] };
      removeItem(game.player.inv, 'dispatch', 1);
      const from = dip.town(q.from);
      dip.deliver(q);
      const pay = Math.min(q.pay || 10, Math.max(0, Math.floor(e.treasury)));
      e.treasury -= pay;
      if (pay) {
        const pl = game.player;
        const left = pl.give('coin', pay);
        if (left) game.spawnDrop('coin', left, pl.x, pl.y, pl.z, true);
        game.audio?.play('coin');
      }
      sim.changeRep(npc, 4);
      sim.addRenown(s.id, 2, 'carrying word between the towns');
      sim.addRenown(q.from, 1, 'carrying word between the towns');
      return { lines: [`From ${from.name}? Let me see... ${q.kind === 'gift' ? 'A gift! How generous.' : q.kind === 'warn' ? 'Hm. A warning. We\'ll keep our eyes open.' : 'I\'ll send an answer back directly.'}`, pay ? `Here's ¤${pay} for your trouble.` : 'I\'m afraid the treasury can\'t pay you right now.'] };
    }
    case 'turn_away':
      sim.careers.dismissCustomer(null);
      return { lines: [pick(rng, ['Oh. Another time, then.', 'Suit yourself.'])], close: true };
    case 'dismiss':
      sim.careers.endEscort(null);
      return { lines: [pick(rng, ['Right you are. Safe travels!', 'Suits me. Mind how you go.'])], close: true };
    case 'favor': return favorTalk(npc, game);
    case 'favor_accept': {
      const f = sim.favors.accept(npc);
      if (!f) return { lines: ['Oh, never mind. It\'s sorted.'] };
      return { lines: [f.kind === 'deliver' ? `Thank you! Here's the letter. ${f.toName} will be so pleased.` : rec.age === 'child' ? 'Yay! You\'re the best!' : 'Thank you! I\'ll be waiting.', '(Noted in your journal: J)'] };
    }
    case 'favor_decline':
      sim.favors.decline(npc);
      return { lines: [p.kindness > 0.5 ? 'Oh, that\'s all right. Never mind.' : 'Hmph. Fine.'] };
    case 'favor_check': return favorCheck(npc, game);
    case 'deliver': {
      const r = sim.favors.deliver(npc);
      if (!r) return { lines: ['A letter? For me?'] };
      if (r.missing) return { lines: ['A letter? Well, where is it?'] };
      return { lines: [pick(rng, [`From ${r.f.giverName}? How lovely!`, `${r.f.giverName} wrote to me? Let me see...`]), rec.personality.kindness > 0.5 ? 'Thank you for bringing it all this way.' : 'Thanks.', ...(r.paid ? [`(${r.f.giverName} left ¤${r.paid} for you.)`] : [])] };
    }
    case 'laws': {
      if (rec.age === 'child') return { lines: ['Laws? That\'s grown-up stuff. Ask my mum.'] };
      const lines = [];
      lines.push(`Taxes here are ${Math.round(e.tax * 100)}% of earnings${sim.isCitizen(s.id) ? `, and citizens pay about ¤${sim.playerTax(npc.layout, 0).tax} a day, plus a share of what they earn here` : ''}.`);
      lines.push(e.fineScale > 1.1 ? 'Fines are steep lately: we\'ve had trouble.' : e.fineScale < 0.95 ? 'Fines are lenient. We believe in second chances.' : 'Break the law and you\'ll pay a fair fine, or sit in a cell.');
      const on = lawList(npc.layout);
      if (on.length) lines.push(on.map((id) => LAWS[id].desc).join(' '));
      else lines.push('Beyond that there are no special laws here.');
      // And what they make of one of them.
      const fits = LAW_IDS.filter((id) => lawFits(s, id));
      const topic = on.length ? on[(game.day + rec.idx) % on.length] : fits[(game.day + rec.idx) % fits.length];
      const view = stance(rec, topic);
      const nm = LAWS[topic].name.toLowerCase();
      if (rec.job !== 'mayor') {
        if (lawOn(npc.layout, topic)) lines.push(view > 0.3 ? pick(rng, [`The ${nm}? Best thing the council ever did.`, `I'm all for the ${nm}.`]) : view < -0.3 ? pick(rng, [`Between you and me, the ${nm} is a nuisance.`, `I'd see the ${nm} gone tomorrow.`]) : `The ${nm}... I can take it or leave it.`);
        else if (Math.abs(view) > 0.4) lines.push(view > 0 ? `If you ask me, we could do with a ${nm} here.` : `At least we've no ${nm}. I'd hate that.`);
      }
      const r = sim.justice.recordOf(s.id);
      if (r.convictions) lines.push(`And you... you have ${r.convictions} conviction${r.convictions > 1 ? 's' : ''} here. Repeat offenders get exile, or worse.`);
      else if (rec.job === 'guard') lines.push(e.recent.thefts + e.recent.violence > 0 ? 'There\'s been some trouble lately. Keep your eyes open.' : 'Quiet as a graveyard. Just how I like it.');
      return { lines: lines.slice(0, 4) };
    }
    case 'realm': return realmTalk(npc, game);
    case 'petition': return petitionTalk(npc, game, arg);
    case 'sign': {
      const p2 = sim.petition;
      if (!p2 || p2.sid !== s.id) return { lines: ['A petition? Never heard of it.'] };
      const law = LAWS[p2.law];
      const what = `${p2.enact ? 'bring in' : 'do away with'} the ${law.name.toLowerCase()}`;
      if (willSign(rec, p2.law, p2.enact, sim.opinion(npc))) {
        p2.signers.push(rec.idx);
        sim.changeRep(npc, 1);
        const need = needed(npc.layout);
        return { lines: [pick(rng, [`To ${what}? Gladly. Where do I sign?`, `Yes! It's about time someone did something.`, 'Give it here. There.']), p2.signers.length >= need ? '(You have enough signatures now. Take it to the mayor.)' : `(${p2.signers.length} of ${need} signatures.)`] };
      }
      (p2.refused ||= []).push(rec.idx);
      return { lines: [stance(rec, p2.law) * (p2.enact ? 1 : -1) < 0 ? pick(rng, [`${what[0].toUpperCase()}${what.slice(1)}? Not on your life.`, 'I won\'t put my name to that.']) : pick(rng, ['I don\'t know you well enough to sign things for you.', 'Ask me again when I know you better.'])] };
    }
    case 'house': case 'myworks': return myWorksTalk(npc, game);
    case 'host': {
      if (mem.chat !== game.day) sim.chat(npc, 'kind');
      return { lines: [pick(rng, ['Nonsense, you\'re family now. The spare bed is yours.', 'Happy to have you. Just don\'t snore.', 'Stay as long as you need.'])] };
    }
    case 'bless': {
      const pl = game.player;
      if (countItem(pl.inv, 'coin') < 5) return { lines: ['A small donation keeps the lamps lit, friend. Come back when you can spare it.'] };
      removeItem(pl.inv, 'coin', 5);
      e.treasury += 2;
      rec.coins += 3;
      pl.hp = pl.maxHp;
      sim.changeRep(npc, 3);
      game.renderer.emit(pl.x, pl.y + 1, pl.z, { n: 16, color: ['#fff4c0', '#ffe070'], up: 40, life: 1, gravity: -20 });
      return { lines: ['May the light watch over you. (Fully healed)'] };
    }
    case 'bye':
      return { lines: [pick(rng, tn === 'warm' ? [`Take care, ${name}!`, 'Come back soon!'] : tn === 'cold' ? ['Finally.', 'Good riddance.', '...'] : ['Farewell.', 'Safe travels.', 'Bye now.'])], close: true };
    default:
      return { lines: ['...'] };
  }
}

function citizenTalk(npc, game, arg) {
  const s = npc.settlement;
  const sim = game.sim;
  const L = npc.layout;
  const inHall = game.buildingAtPlayer()?.type === 'townhall';
  if (!inHall) return { lines: [`Come and see me at the ${s.type === 'village' ? 'Village Hall' : 'Town Hall'} during working hours. We'll do it properly, with the ledger.`] };
  const t = sim.joinTerms(npc);
  if (!t.ok) {
    const why = { exiled: 'You were banished. Never.', crimes: 'Not while you have crimes to answer for.', distrust: 'Frankly, people here don\'t trust you. Earn some goodwill first.', already: 'You\'re already one of us!' }[t.reason];
    return { lines: [why] };
  }
  if (arg !== 'yes') {
    const lines = [`Citizenship of ${s.name} costs ${t.fee ? '¤' + t.fee : 'nothing, for a friend like you'}. Citizens pay a little tax each day.`];
    lines.push(t.plot ? 'Our builders will raise a cottage for you on the empty lot. It takes a day or two.' : 'There\'s no lot free just now, but the builders are laying out a new street: your cottage goes up on the first lot that\'s ready.');
    const host = sim.pickHost(L);
    if (host) lines.push(`Until then you'd stay with the ${host.family} family.`);
    return { lines, choices: [{ id: 'citizen', arg: 'yes', label: `Agreed. ${t.fee ? `(Pay ¤${t.fee})` : '(Free)'}` }], back: 'Let me think about it.' };
  }
  const r = sim.join(npc);
  if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee}. Come back when you have it.` : 'Something went wrong with the paperwork.'] };
  const lines = [`Welcome, citizen ${game.playerName} of ${s.name}!`];
  if (r.host) lines.push(`You'll stay with the ${r.host.family} family for now. Their spare bed is yours.`);
  if (r.plot) lines.push('The builders will start on your cottage right away.');
  else if (r.after) lines.push(`Your cottage is in line for the builders, after ${r.after}'s.`);
  else if (r.queued) lines.push('Your cottage goes up on the next free lot; the builders are laying out a new street.');
  game.ui.msg(`You are now a citizen of ${s.name}!`, '#ffe070');
  game.audio?.play('coin');
  return { lines };
}

// Put a settlement on the player's map.
export function revealTown(game, o) {
  const ow = game.world.ow;
  let fresh = false;
  for (let z = o.cz; z < o.cz + o.cd; z++) for (let x = o.cx; x < o.cx + o.cw; x++) {
    const k = z * MAP_W + x;
    if (!ow.explored[k]) {
      fresh = true;
      ow.exploredN = (ow.exploredN || 0) + 1;
    }
    ow.explored[k] = 1;
  }
  if (fresh) game.ui.msg(`Map updated: ${o.name}`, '#a0c8ff');
  return fresh;
}

const COMPASS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];

// "about 6 hours' walk to the northeast (by the road)"
export function townDirections(game, from, o) {
  const dx = o.cx + o.cw / 2 - (from.cx + from.cw / 2);
  const dz = o.cz + o.cd / 2 - (from.cz + from.cd / 2);
  const dir = COMPASS[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const dip = game.sim.diplomacy;
  const h = dip.travelHours(from, o);
  const road = dip.roads.some((r) => r.done && ((r.a === from.id && r.b === o.id) || (r.a === o.id && r.b === from.id)));
  return `about ${h} hours' walk to the ${dir}${road ? ', along the new road' : ''}`;
}

// What a mayor knows about a neighbouring town.
function townReport(game, L, o) {
  const dip = game.sim.diplomacy;
  const rel = dip.rel(L, o.id);
  const what = o.type === 'city' ? 'a city' : o.type === 'town' ? 'a town' : 'a village';
  const lines = [`${o.name} is ${what}, ${townDirections(game, L.settlement, o)}.`];
  if (o.deserted) lines.push('Nobody lives there any more. The people packed up and left.');
  else {
    const mood = rel.trust >= 30 ? 'They\'re good friends of ours.' : rel.trust >= 10 ? 'We\'re on good terms.' : rel.trust < 0 ? 'Between us, we don\'t get on.' : 'We don\'t have much to do with them.';
    const trade = rel.trade >= 2 ? ' Our merchants go back and forth all the time.' : rel.trade >= 1 ? ' We trade a little.' : '';
    lines.push(mood + trade + (o.condition === 'prosperous' ? ' Rich place.' : o.condition === 'poor' ? ' Hard times there.' : ''));
    const OL = game.sim.layoutOf(o.id);
    const m = OL && OL.npcs.find((r) => r.job === 'mayor' && alive(r));
    if (m) lines.push(`${m.name.first} ${m.name.last} is ${o.type === 'village' ? 'elder' : 'mayor'} there.`);
  }
  if (revealTown(game, o)) lines.push('(Marked on your map.)');
  return lines;
}

// Small talk about the sky, coloured by who's talking.
export function weatherTalk(npc, game) {
  const rec = npc.rec;
  const tr = rec.traits || [];
  const rng = npc.rng;
  const job = rec.job;
  const kind = game.weatherIn ? game.weatherIn(npc.settlement) : 'clear';
  const quit = rec.override && rec.override.weather;
  if (quit) return [pick(rng, ['Too wet to work today. I\'ll make it up tomorrow... probably.', 'I packed it in early. Can you blame me?'])];
  if (kind === 'rain') {
    if (job === 'farmer') return [pick(rng, ['A good soaking rain. The fields drink it up: the crops grow twice as fast when the soil\'s wet.', 'Rain! Saves me hauling buckets from the well.'])];
    if (job === 'fisher') return ['Fish bite better in the rain, you know.'];
    if (tr.includes('gloomy') || tr.includes('lazy')) return [pick(rng, ['Rain, rain, rain. I\'m not setting foot outside more than I have to.', 'Miserable. Just miserable.'])];
    if (tr.includes('cheerful') || tr.includes('romantic')) return ['I love the sound of rain on the roof. Makes the tavern cosy.'];
    if (rec.age === 'child') return ['Mum says I can\'t splash in the puddles. I\'m going to anyway.'];
    return [pick(rng, ['Wet enough for you? My boots are soaked through.', 'Rain again. Good for the fields, I suppose.'])];
  }
  if (kind === 'snow') {
    if (rec.age === 'child') return ['Snow! Want to help me build a snowman?'];
    if (job === 'farmer') return ['Nothing grows in this. The fields just sleep.'];
    if (tr.includes('hardworking')) return ['A bit of snow never stopped honest work.'];
    return [pick(rng, ['Cold enough to freeze your ears off.', 'I can\'t feel my toes. Is there a fire going at the tavern?'])];
  }
  if (kind === 'fog') {
    if (tr.includes('superstitious')) return ['Fog like this... that\'s when the dead walk, my gran used to say.'];
    if (job === 'guard') return ['Keep close in this fog. Anything could be out there.'];
    return [pick(rng, ['Can\'t see a thing in this fog.', 'Mind you don\'t walk into the well.'])];
  }
  const night = game.minute >= 1200 || game.minute < 330;
  if (night) return [pick(rng, ['Clear night. Look at all those stars.', 'Cold and clear tonight.'])];
  if (job === 'farmer' && !rainedRecently(game.seed, npc.settlement, game.day * 1440 + game.minute, 36)) return ['Dry spell, this. I\'ve been hauling water to the fields all week.'];
  return [pick(rng, ['Lovely day, isn\'t it?', 'Not a cloud in the sky.', 'Fine weather for it, whatever it is you\'re doing.'])];
}

function lcNews(t) {
  return /^(A|An|The|Taxes|Law|Builders)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function news(npc, game) {
  const L = npc.layout;
  const s = npc.settlement;
  const rng = npc.rng;
  const e = L.econ;
  const items = [];
  // Which town each line tells you about (only those get marked on your map).
  const about = new Map();
  const byName = (name) => game.world.ow.settlements.find((o) => o.name === name) || null;
  for (const it of [...e.ledger].reverse()) {
    if (it.day < game.day - 3 || it.day <= 0) continue;
    items.push(it.day === game.day ? `Today: ${it.text}` : `On day ${it.day}, ${/^(A|An|The|Taxes|Law|Builders)\b/.test(it.text) ? it.text.charAt(0).toLowerCase() + it.text.slice(1) : it.text}`);
    if (items.length >= 4) break;
  }
  const visits = (game.sim.visits.get(s.id) || []).filter((v) => !v.guest && game.sim.abs >= v.arrive && game.sim.abs < v.leave);
  if (visits.length) items.push(`A merchant from ${visits[0].fromName} is in town, selling on the square.`);
  // What's cheap and what's dear on the market.
  const mk = game.sim.market && game.sim.market.talk(L, rng);
  if (mk) items.push(mk);
  // The gossips have more to tell (about anyone but themselves).
  const me = npc.rec;
  if (!npc.visit && (me.personality.sociability > 0.5 || (me.traits || []).includes('gossipy'))) {
    const gl = gossipLines(L).filter((t) => !t.includes(me.name.first) && !t.includes(me.name.last));
    if (gl.length) items.push(`Between you and me: ${pick(rng, gl)}`);
  }
  // News from other towns, as the merchants tell it.
  if (npc.visit && npc.visit.news && npc.visit.news.length) {
    return [`Back home in ${npc.visit.fromName}? ${lcNews(npc.visit.news[(npc.newsI = (npc.newsI || 0) + 1) % npc.visit.news.length])}`];
  }
  for (const r of freshRumours(e, game.sim.now()).slice(-3).reverse()) {
    const line = pick(rng, [`Word from ${r.from}, by way of the merchants: ${lcNews(r.text)}`, `A merchant said that in ${r.from}, ${lcNews(r.text)}`]);
    items.push(line);
    if (byName(r.from)) about.set(line, byName(r.from));
  }
  // Rumours about the wider world mark the place on your map.
  const others = game.world.ow.settlements.filter((o) => o.id !== s.id && !deserted(o));
  if (others.length) {
    const o = others.sort((a, b) => Math.hypot(a.cx - s.cx, a.cz - s.cz) - Math.hypot(b.cx - s.cx, b.cz - s.cz))[(npc.newsI || 0) % Math.min(3, others.length)];
    const dx = o.cx - s.cx;
    const dz = o.cz - s.cz;
    const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
    const what = o.type === 'city' ? 'the great city of' : o.type === 'town' ? 'the town of' : 'a village called';
    const line = `There's ${what} ${o.name} to the ${dir}.${o.condition === 'prosperous' ? ' Rich folk there.' : o.condition === 'poor' ? ' Hard times there, I hear.' : ''}`;
    items.push(line);
    about.set(line, o);
  }
  const gone = game.world.ow.settlements.find((o) => o.deserted && o.id !== s.id);
  if (gone && rng.chance(0.6)) {
    const line = `Did you hear? The people of ${gone.name} gave up and left. No guards, no one to protect them.`;
    items.push(line);
    about.set(line, gone);
  }
  const ruins = game.world.ow.settlements.find((o) => o.condition === 'abandoned');
  if (ruins && rng.chance(0.3)) {
    const line = `Folk say ${ruins.name} was abandoned. Might be treasure left behind...`;
    items.push(line);
    about.set(line, ruins);
  }
  if (!items.length) items.push('Nothing much happens around here.');
  const i = (npc.newsI || 0) % items.length;
  npc.newsI = (npc.newsI || 0) + 1;
  const said = [items[i], ...(items.length > 1 && i + 1 < items.length && rng.chance(0.5) ? [items[i + 1]] : [])];
  // Only a place actually named goes on your map.
  for (const line of said) if (about.has(line)) revealTown(game, about.get(line));
  return said;
}

// Traits in a sentence: "brave and a night owl".
function traitWords(list) {
  return list.map((t) => (t.includes(' ') ? `${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t}` : t)).join(' and ');
}

// Children see a town their own way.
function kidLife(npc, game) {
  const rng = npc.rng;
  const L = npc.layout;
  const kids = L.npcs.filter((r) => alive(r) && r.age === 'child' && r !== npc.rec).length;
  return [pick(rng, [
    kids ? `There's ${kids} of us kids here. We play tag and hide and seek behind the houses!` : 'There\'s nobody my age to play with. It\'s boring.',
    'The best hiding place is behind the barrels. Don\'t tell anyone!',
    'The tavern smells nice when they\'re cooking.',
    'The guards let me hold a sword once. Well, nearly.',
    'Lessons are boring. I\'d rather be fishing.',
  ])];
}

function lifeIn(npc, game) {
  const L = npc.layout;
  const rec = npc.rec;
  const e = L.econ;
  const rng = npc.rng;
  const lines = [];
  const living = L.npcs.filter(alive);
  const hungry = living.filter((r) => r.hungry >= 1).length;
  if (npc.visit) return [`Every town has its troubles. Back in ${npc.visit.fromName} we'd say this kitchen needs better meat.`];
  if (e.tax >= 0.18) lines.push(`Taxes are ${Math.round(e.tax * 100)}% now. The coffers are thin, the mayor says.`);
  else if (e.tax <= 0.05) lines.push(`Taxes are only ${Math.round(e.tax * 100)}%. Can't complain!`);
  const k = kitchenOf(L);
  if (k) {
    const q = st.count(k.store, 'feast') ? 'delightful' : st.count(k.store, 'stew') ? 'decent' : st.count(k.store, 'gruel') ? 'awful' : null;
    const cook = L.npcs.find((r) => r.job === 'cook' && alive(r));
    if (!q) lines.push('The tavern kitchen is empty. The trappers haven\'t brought much in.');
    else lines.push(`The food at the tavern is ${q} these days${cook ? `; ${cook.name.first} does the cooking` : ''}.`);
  } else lines.push('We have no tavern. Folk feed themselves, or go hungry.');
  if (hungry > living.length * 0.2) lines.push(`Too many people are going hungry: ${hungry} of us, at least.`);
  if (rec.mood < 0.35) lines.push(pick(rng, ['Honestly? It\'s been a hard season.', 'Could be better. Much better.']));
  else if (rec.mood > 0.75) lines.push(pick(rng, ['I couldn\'t be happier here!', 'Life is good.']));
  const plans = game.sim.events.plansOf(L, rec);
  if (plans) lines.unshift(plansLine(npc, game, plans));
  else if (e.lastFeast !== undefined && game.day - e.lastFeast <= 2) lines.push('Did you catch the feast day? Wonderful time.');
  if (e.recent.deaths > 0) lines.push('We\'ve buried people lately. The whole town feels it.');
  return lines.slice(0, 3);
}

// A wedding or a feast coming up: are they going (and if not, why not)?
function plansLine(npc, game, { ev, going, when }) {
  const L = npc.layout;
  const rec = npc.rec;
  const rng = npc.rng;
  const sim = game.sim;
  const what = ev.kind === 'wedding' ? `${sim.events.title(L, ev).replace(/^the /, '')}` : ev.kind === 'fete' ? 'the celebration' : festivalName(L.settlement);
  if (ev.couple && ev.couple.includes(rec.idx)) {
    const other = L.npcs[ev.couple.find((i) => i !== rec.idx)];
    return pick(rng, [`I'm getting married ${when}! To ${other.name.first}! You'll come, won't you?`, `${when[0].toUpperCase()}${when.slice(1)} I marry ${other.name.first}. I can hardly sleep for thinking of it.`]);
  }
  if (rec.idx === ev.host) return ev.kind === 'wedding' ? `I'm to marry ${ev.couple.map((i) => L.npcs[i].name.first).join(' and ')} ${when}. Do come.` : `The feast is ${when}, by the square. I hope you'll come!`;
  if (going) return pick(rng, [`Are you going to ${what} ${when}? I wouldn't miss it.`, `${what[0].toUpperCase()}${what.slice(1)} is ${when}! I've been looking forward to it all week.`]);
  const tr = rec.traits || [];
  const why = (rec.grief || []).some((g) => g.rel !== 'acquaintance') ? 'I\'m in no mood for merrymaking. Not after this week.'
    : rec.job === 'guard' ? 'Somebody has to keep watch while everyone\'s dancing.'
      : tr.includes('reserved') || tr.includes('timid') ? 'Crowds aren\'t really for me. I\'ll hear all about it after.'
        : tr.includes('hardworking') ? 'Too much work to do, I\'m afraid.'
          : tr.includes('gruff') || tr.includes('gloomy') ? 'Noise and nonsense. I\'ll be staying home.'
            : (rec.mood ?? 0.5) < 0.35 ? 'I don\'t feel much like celebrating.' : 'I don\'t think I\'ll go, honestly.';
  return `${what[0].toUpperCase()}${what.slice(1)} is ${when}. ${why}`;
}

// What someone at a wedding or a feast says they're doing.
function eventLine(npc, game, act) {
  const L = npc.layout;
  const ev = game.sim.events.get(L, act.ev);
  const town = L.settlement.name;
  if (!ev) return 'Just enjoying the day.';
  if (ev.kind === 'wedding') {
    const [a, b] = ev.couple.map((i) => L.npcs[i].name.first);
    if (act.role === 'couple') return 'I\'m getting married! Can you believe it?';
    if (act.role === 'lead') return `I'm here to marry ${a} and ${b}.`;
    return pick(npc.rng, [`We're here for ${a} and ${b}'s wedding. Isn't it lovely?`, `${a} and ${b}'s wedding! Grab a spot, it's filling up.`]);
  }
  if (act.role === 'dance') return 'Dancing! Come on, join in!';
  if (act.role === 'serve') return 'Serving at the feast. Hungry?';
  if (act.role === 'lead') return ev.kind === 'fete' ? `Celebrating! ${town} is a ${ev.tier} now.` : `It's ${festivalName(npc.settlement)}! I hope you're hungry.`;
  return ev.kind === 'fete' ? `We're celebrating: ${town} is a ${ev.tier} now!` : `It's ${festivalName(npc.settlement)}! Grab a plate.`;
}

function family(npc, game) {
  const rec = npc.rec;
  const L = npc.homeLayout || npc.layout;
  const rng = npc.rng;
  const home = rec.home !== null ? L.buildings[rec.home] : null;
  const lines = [];
  const kin = game.sim.familyOf(rec);
  const you = game.playerName.split(' ')[0];
  if (kin === 'parent') lines.push(pick(rng, [`And you, ${you}: you'll always be my child, however big you get.`, `You know we're proud of you, ${you}. Don't let it go to your head.`]));
  if (kin === 'sibling') lines.push(rec.age === 'child' ? `You're my big ${pick(rng, ['sibling', 'hero'])}, ${you}!` : pick(rng, [`You and me, ${you}: we'll always be family, like it or not.`, `Mum still likes you best, ${you}.`]));
  const g = griefOf(rec);
  if (g) lines.push(g.rel === 'family' ? `We lost ${g.first} ${g.cause ? `(${g.cause})` : ''}. The house is so quiet now.` : `My friend ${g.first} passed. I still can't believe it.`);
  if (rec.partner !== null && rec.partner !== undefined) {
    const pr = L.npcs[rec.partner];
    if (pr && alive(pr)) lines.push(pick(rng, [`My partner ${pr.name.first} is ${pr.job === 'retired' ? 'enjoying retirement' : 'the ' + jobTitle(pr, npc.settlement).toLowerCase()} here.`, `Have you met ${pr.name.first}? We share ${home ? (home.homeName || 'the house') : 'a house'}.`]));
  }
  const kids = rec.children.map((i) => L.npcs[i]).filter((r) => r && alive(r));
  if (kids.length) {
    const names = kids.map((r) => r.name.first);
    lines.push(`${names.length > 1 ? 'The little ones, ' + names.join(' and ') + ', keep me' : names[0] + ' keeps me'} busy.`);
    if (kids.some((k) => k.hungry >= 1)) lines.push('I worry about feeding them, some days.');
  }
  if (rec.parents.length && rec.age === 'child') {
    const par = L.npcs[rec.parents[0]];
    if (par) lines.push(alive(par) ? `${par.name.first} says I shouldn't talk to strangers...` : `I miss ${par.name.first}...`);
  }
  const fr = (rec.friends || []).map((i) => L.npcs[i]).filter((r) => r && alive(r));
  if (fr.length) lines.push(`${fr[0].name.first} is my closest friend${fr.length > 1 ? `, and ${fr[1].name.first} too` : ''}.`);
  if (!lines.length) lines.push(pick(rng, ['It\'s just me. I like the quiet.', 'No family to speak of. The town is my family.']));
  return lines;
}

// Full conversation (legacy): opening line plus a few topics.
export function conversation(npc, game) {
  return [openingLine(npc, game), ...respond(npc, game, 'who').lines];
}

export { BUILDING_NAMES, DAY };

// What a place gives someone to talk about (for small talk: see markov.js).
export function talkContext(game, s) {
  const r = s ? religionOf(s) : null;
  const c = s ? cuisineOf(s) : null;
  const w = game.weatherIn ? game.weatherIn(s) : 'clear';
  const L = s && game.world ? game.world.layouts.get(s.id) : null;
  const sim = game.sim;
  // What's dear and what's cheap on the market just now.
  const notes = L && L.econ && sim && sim.market ? sim.market.notes(L, 4) : [];
  const short = notes.find((q) => q.v < 0);
  const lots = notes.find((q) => q.v > 0);
  // The nearest other town (for talk of cousins and roads).
  const ow = game.world && game.world.ow;
  let other = null;
  if (s && ow) {
    let bd = Infinity;
    for (const q of ow.settlements) {
      if (q === s || q.deserted || q.condition === 'abandoned') continue;
      const d = Math.hypot(q.cx - s.cx, q.cz - s.cz);
      if (d < bd) {
        bd = d;
        other = q.name;
      }
    }
  }
  const m = game.minute ?? 720;
  // What's new: what the realm's scholars are at and what they've lately
  // mastered, the town's ship, where its portal goes, the prisoners out at
  // work today.
  const day = game.day ?? 0;
  const tech = s && sim && sim.tech ? sim.tech.stateOf(s) : null;
  const lately = tech ? [...tech.log].reverse().find((q) => day - q.day <= 10 && TECHS[q.id]) : null;
  const port = s && sim && sim.ships ? sim.ships.ports[s.id] : null;
  const gate = s && sim && sim.portals ? sim.portals.network(s.id)[0] : null;
  return {
    culture: (s && (s.civ ? s.civ.style : s.style)) || 'vale',
    town: s ? s.name : 'this town',
    god: r ? r.god : 'the gods',
    feast: s ? festivalName(s) : 'the feast',
    dish: c ? c.word.split(' and ')[0] : 'stew',
    drink: c ? c.drink : 'ale',
    realm: s && s.civ ? `the ${s.civ.name.replace(/^The /, '')}` : 'the council',
    weather: { rain: 'rain', snow: 'snow', fog: 'fog', storm: 'storm' }[w] || 'fine weather',
    wkind: { rain: 'rain', snow: 'snow', fog: 'fog', storm: 'storm' }[w] || 'fine',
    time: m < 300 || m >= 1320 ? 'night' : m < 660 ? 'morning' : m >= 1050 ? 'evening' : null,
    L,
    other,
    scarce: short ? short.name : null,
    plenty: lots ? lots.name : null,
    fortune: L && sim && sim.prosperity ? fortuneOf(L) : null,
    famine: !!(L && L.econ && (L.econ.famineDays || 0) >= 4),
    war: !!(s && s.civ && sim && sim.war && sim.war.atWar && sim.war.atWar(s.civ)),
    study: tech && tech.current && TECHS[tech.current] ? TECHS[tech.current].name.toLowerCase() : null,
    learned: lately ? TECHS[lately.id].name.toLowerCase() : null,
    ship: port && port.state === 'docked' ? port.name : null,
    portalto: gate && ow ? ow.settlements[gate.sid].name : null,
    prisoners: !!(L && L.econ && L.econ.labor && L.econ.labor.day === day),
  };
}

// (Round 54) A tavern's room to let (see sim/inns.js): what it is and what
// it costs, a stay taken (or lengthened), and how long's left on one.
function innTalk(npc, game, id, arg) {
  const L = npc.layout;
  const b = innFor(npc);
  const sim = game.sim;
  const rng = npc.rng;
  if (!b) return { lines: ['We\'ve no rooms here.'] };
  const pid = sagaPidOf(game.player);
  const stay = stayAt(L, b, sim.abs);
  const offer = () => INN_NIGHTS.map((n) => ({ id: 'inn_rent', arg: String(n), label: `${n === 1 ? 'One night' : n === 7 ? 'A week' : `${n} nights`} (¤${innPrice(L, n)})` }));
  if (id === 'inn_room') {
    if (stay && stay.pid !== pid) return { lines: [pick(rng, ['The room\'s taken, I\'m afraid.', 'Sorry: it\'s let already.', `${stay.who || 'Someone'} has it just now.`]), 'Try again in a day or two.'] };
    if (stay) return { lines: [`Your room's the one in the corner. You've ${stayLeft(stay, sim.abs)}, out by mid-morning after.`, 'Want it longer?'], choices: offer(), back: 'No, that\'s fine.' };
    const lines = [pick(rng, [
      'There\'s a room upstairs... well, in the back. Two beds, clean sheets, a door that shuts.',
      'We\'ve a room for travellers: two beds, a lamp, and a door with a latch on it.',
      'Room in the corner, two beds. Quieter than it looks, once the singing stops.',
    ]), `It's yours (and a friend's) till mid-morning after your last night. ¤${innPrice(L, 1)} a night, less for longer.`];
    return { lines, choices: offer(), back: 'Maybe later.' };
  }
  const n = INN_NIGHTS.includes(+arg) ? +arg : 1;
  const price = innPrice(L, n);
  if (stay && stay.pid !== pid) return { lines: ['Someone\'s beaten you to it, sorry.'] };
  if (countItem(game.player.inv, 'coin') < price) return { lines: [`That's ¤${price}. You haven't got it.`] };
  removeItem(game.player.inv, 'coin', price);
  const biz = L.econ.biz && L.econ.biz[b.id];
  if (biz) biz.till = (biz.till || 0) + price;
  else L.econ.treasury += Math.round(price * 0.3);
  const now = rentRoom(L, b, pid, game.playerName, n, sim.abs);
  game.audio?.play('coin');
  sim.changeRep(npc, 1);
  return { lines: [pick(rng, ['Here\'s the key. Breakfast isn\'t included, but I won\'t tell if you take a roll.', 'There you are. The door sticks: lift it as you push.', 'It\'s yours. Sleep well.']), `(The room in the corner is yours: ${stayLeft(now, sim.abs)}.)`] };
}
