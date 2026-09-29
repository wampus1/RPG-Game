// Personality-flavoured dialogue for NPCs: passing remarks, and the topics
// of a conversation (who they are, their work, news, life in town, family,
// other townsfolk, directions, small talk with questions back, favours,
// jobs, professions, escorts, citizenship, the law...). Lines refer to
// other people by name, never by gendered pronouns.
import { speak, speakAll } from './voice.js';
import { JOBS, HOBBIES, jobTitle } from '../entities/npcgen.js';
import { MAP_W } from '../config.js';
import { BUILDING_NAMES } from '../world/settlement.js';
import { ITEMS } from '../world/items.js';
import { alive, kitchenOf, mayorOf, st, activityFor, DAY, stockOf, ledger } from '../sim/econ.js';
import { TIERS } from '../sim/growth.js';
import { repLevel } from '../sim/sim.js';
import { PROFESSIONS, clock, bare, licensesFor } from '../sim/careers.js';
import { LAWS, LAW_IDS, lawOn, lawList, stance, willSign, needed, decide } from '../sim/laws.js';
import { plural, relationTo } from '../sim/favors.js';
import { deserted } from '../sim/civic.js';
import { hash4 } from '../util/rng.js';
import { countItem, removeItem } from './inventory.js';
import { rainedRecently } from '../world/weather.js';

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
  const rec = npc.rec;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const tw = timeWord(game.minute);
  const sim = game.sim;
  const rep = sim.opinion(npc);
  const entry = sim.repEntry(s.id, rec.idx);
  const name = game.playerName;
  if (npc.nomad) return pick(rng, [`Greetings. We're the ${rec.name.last}s, travellers. Is this a good place to live?`, 'Hello, friend. We\'re just passing through... or maybe not.', `The road's been long. What's ${s.name} like?`]);
  const cf = sim.confront;
  if (cf && cf.arrived && cf.idx === rec.idx && cf.sid === s.id) {
    return cf.stage === 'expel'
      ? `I warned you, ${name}. Nothing has changed, and the council has voted: you are no longer welcome as a citizen of ${s.name}.`
      : `${name}, we need to talk. People keep coming to me about you: stealing, fighting, rudeness. As mayor I can't let it go on. Change your ways, or lose your citizenship.`;
  }
  if (game.isWanted(s.id) && rec.job !== 'guard') return pick(rng, ['I have nothing to say to the likes of you.', 'Guards! Someone help!', 'Please... just go.']);
  if (rec.job === 'guard' && game.isWanted(s.id)) return 'You\'re wanted in this town. Come quietly, or else.';
  if (sim.justice.exiled.has(s.id)) return 'You were banished! Get out before the guards see you!';
  if (rep <= -60) return pick(rng, ['Leave me alone.', 'I don\'t want to talk to you.', 'Go away.']);
  const g = griefOf(rec);
  if (g) return g.byPlayer ? `You... you're the one who killed ${g.first}. Get away from me.` : pick(rng, [`Sorry, I'm not myself today. We just lost ${g.first}.`, `Hello... forgive me. I can't stop thinking about ${g.first}.`]);
  if (npc.caravan) return pick(rng, [`Well met on the road! ${rec.name.first} ${rec.name.last}, merchant of ${s.name}, on my way to ${npc.caravan.to}.`, `Hello there! Heading to ${npc.caravan.to} with a pack of goods. Care to trade?`]);
  if (npc.visit) return pick(rng, [`Greetings, friend! ${rec.name.first} ${rec.name.last}, merchant of ${npc.visit.fromName}.`, `Ah, a customer! Just in from ${npc.visit.fromName}.`]);
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
  if (!entry.met && warns.length && rep < 10) {
    entry.met = true;
    return pick(rng, [`We've heard about you from ${warns[0].fromName}. Behave yourself here.`, `${name}... ${warns[0].fromName} wrote to us about you. I'm watching you.`]);
  }
  // A town's Friend or Hero is known on sight.
  const renown = sim.renownTitle(s.id);
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
  if (npc.nomad) {
    add('nomad', 'Are you thinking of settling here?');
    add('who', 'Where do you come from?');
    add('kind', '(Chat about the road)');
    add('gift', 'I have a gift for you.');
    add('bye', 'Goodbye.');
    return out;
  }
  const trader = npc.visit || JOBS[rec.job]?.trader || rec.job === 'cook';
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
    add('serve', c.kind === 'shop' ? `Here you are: ${what}. (¤${c.price})` : `Sell ${what} for ¤${c.price}.`);
    add('turn_away', 'Sorry, not today.');
  }
  if (npc.hired) {
    add('escort', npc.hired.companion ? 'How are you holding up?' : 'How long are you with me?');
    add('dismiss', 'You can head home now.');
  }
  const letter = fav.letterFor(npc);
  if (letter) add('deliver', `I have a letter for you from ${letter.giverName}.`);
  const mine = fav.given(npc);
  if (mine) add('favor_check', mine.kind === 'deliver' ? `About your letter for ${mine.toName}...` : 'About your request...');
  if (trader && rep > -40 && !npc.hired) add('trade', rec.job === 'cook' || rec.job === 'innkeeper' || rec.job === 'barkeep' ? 'Something to eat, please.' : 'Let\'s trade.');
  if (rec.job === 'mayor') {
    const dip = sim.diplomacy;
    const mine = dip.forPlayer(s.id);
    if (mine.length && countItem(game.player.inv, 'dispatch')) add('dispatch', `I bring a letter from ${dip.town(mine[0].from).name}.`);
    if (dip.waitingFrom(s.id).length) add('mail', 'Any letters I could carry for you?');
    add('towns', 'Tell me about the neighbouring towns.');
    add('donate', `I'd like to help ${s.name} grow.`);
    const inHall = game.buildingAtPlayer()?.type === 'townhall';
    if (sim.isCitizen(s.id)) add('renounce', 'I renounce my citizenship.');
    else add('citizen', inHall ? `Make me a citizen of ${s.name}.` : 'How do I become a citizen?');
    add('profession', car.job && car.job.kind === 'profession' && car.job.sid === s.id ? 'About my post...' : 'I\'d like an official profession.');
    const pet = sim.petition;
    add('petition', pet && pet.sid === s.id ? `About my petition (${pet.signers.length} signature${pet.signers.length === 1 ? '' : 's'})...` : 'I\'d like to petition about a law.');
  }
  // Out gathering signatures: anyone grown up in the town can sign.
  const pet = sim.petition;
  if (pet && pet.sid === s.id && rec.job !== 'mayor' && rec.age !== 'child' && !npc.visit && !rec.visitor && !pet.signers.includes(rec.idx) && !(pet.refused || []).includes(rec.idx)) add('sign', 'Would you sign my petition?');
  const home = sim.citizen && sim.citizen.sid === s.id && sim.citizen.home !== null && sim.citizen.home !== undefined ? npc.layout.buildings[sim.citizen.home] : null;
  if (home && !home.underConstruction && (rec.job === 'mayor' || rec.job === 'builder' || rec.job === 'carpenter')) add('expand', rec.job === 'mayor' ? 'I\'d like to enlarge my house.' : 'Could you enlarge my house?');
  if (car.employs(npc)) add('job', 'About my job here...');
  else if (car.canEmploy(npc) && rep >= -10) add('job', `Could you use a hand at the ${bare(npc.layout.buildings[rec.work.building].name)}?`);
  if (rec.job === 'guard' && !npc.hired && !npc.visit) add('hire', 'I\'d like to hire you as an escort.');
  else if (!npc.hired && !npc.visit && rec.age === 'adult' && rep >= 60 && !car.escort) add('companion', 'Come travel with me for a while?');
  const c = sim.construction;
  if (c && c.sid === s.id && !c.done && !c.cancelled && (rec.job === 'mayor' || (rec.override && rec.override.act === 'build'))) add('house', 'How is my house coming?');
  if (sim.citizen && sim.citizen.sid === s.id && sim.citizen.host === rec.home && rec.home !== null) add('host', 'Thanks for putting me up.');
  if (rec.job === 'priest') add('bless', 'A blessing, please. (¤5)');
  add('ask', 'Can I ask you about...');
  if (!mine && !npc.hired && !npc.visit) add('favor', rec.age === 'child' ? 'Want some help with anything?' : 'Need a hand with anything?');
  const sky = game.weatherIn ? game.weatherIn(s) : 'clear';
  add('kind', (rec.idx + game.day) % 2 ? '(Compliment them)' : '(Ask how they\'re doing)');
  if (sky !== 'clear' || (rec.idx + game.day) % 3 === 1) add('weathertalk', '(Chat about the weather)');
  add('gift', 'I have a gift for you.');
  add('rude', '(Insult them)');
  add('bye', 'Goodbye.');
  return out;
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
    case 'build': return 'at the building site';
    case 'trial': return 'at the jail, for the hearing';
    case 'forage': return 'out looking for food';
    case 'travel': return 'setting off on the road';
    case 'play': return 'playing around the square';
    case 'study': return 'at their studies';
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
  } else if (rec.job === 'priest') lines.push(`The temple is open to all.${hours}`, 'A blessing costs a small donation.');
  else if (rec.job === 'beggar') lines.push('Work? Nobody will have me. Spare a coin?');
  else {
    lines.push(`${p.diligence > 0.65 ? 'I love my work.' : p.diligence < 0.3 ? 'Work is work. I\'d rather be doing anything else.' : 'It pays the bills.'}${hours}`);
    if (p.sociability > 0.6) lines.push((rec.coins || 0) > 60 ? 'Can\'t complain about the money.' : (rec.coins || 0) < 10 ? 'Money\'s tight, though.' : 'Could be worse.');
  }
  return { lines: lines.slice(0, 3), choices: choices.length ? choices : null };
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
      choices: licensesFor(s.type).map((k) => ({ id: 'profession', arg: `ask:${k}`, label: `${PROFESSIONS[k].title}${PROFESSIONS[k].citizen ? ' (citizens)' : ''}` })),
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
        tier: `A ${s.type} like ours has no call for a licensed ${P.title.toLowerCase()}. Try a ${t.tier === 'city' ? 'city' : 'town'}.`,
      }[t.reason] || 'I can\'t do that.';
      return { lines: [P.pitch, why] };
    }
    const lines = [P.pitch];
    const kit = t.kit ? ` We'll give you ${P.kit.map(([it, n]) => plural(it, n)).join(', ')} to start.` : '';
    lines.push(`${t.fee ? `The licence costs ¤${t.fee}.` : 'There\'s no fee.'}${kit}`);
    if (j) lines.push(`You'd have to give up being ${car.title()}.`);
    return { lines, choices: [{ id: 'profession', arg: `take:${key}`, label: `I'll take it.${t.fee ? ` (Pay ¤${t.fee})` : ''}` }], back: 'Let me think about it.' };
  }
  const r = car.takeProfession(npc, key);
  if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee} for the licence.` : 'Something went wrong with the paperwork.'] };
  game.ui.msg(`You are now ${P.title === 'Town Guard' ? 'a Town Guard' : `a licensed ${P.title.toLowerCase()}`} of ${s.name}!`, '#ffe070');
  game.audio?.play('coin');
  const got = r.given.length ? `Here: ${r.given.map((g) => plural(g.item, g.count)).join(', ')}.` : '';
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
    choices: LAW_IDS.map((id) => ({ id: 'petition', arg: `law:${id}:${lawOn(L, id) ? 'off' : 'on'}`, label: `${lawOn(L, id) ? 'Repeal' : 'Pass'} the ${LAWS[id].name.toLowerCase()}` })),
    back: 'Never mind.',
  };
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
    case 'who': {
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
      else if (act.act === 'build') lines.push(act.label ? `Working on ${act.label}. Mind the planks.` : sim.citizen ? `Building a house for our newest citizen: you, ${name}!` : 'Building. Mind the planks.');
      else if (act.act === 'repair') lines.push('Patching up the jail. Someone made a right mess of it.');
      else if (act.act === 'home' && act.weather) lines.push(pick(rng, [`No sense working out in the ${act.weather === 'snow' ? 'snow' : act.weather === 'fog' ? 'fog' : 'rain'}. I'll catch up tomorrow.`, 'Staying dry. The work will keep.']));
      else if (act.act === 'forage') lines.push(rec.age === 'child' ? 'Looking for berries. We\'ve got nothing to eat at home...' : 'Out looking for food. Times are lean.');
      else if (act.act === 'trial') lines.push('There\'s to be a hearing at the jail.');
      else if (act.act === 'travel') {
        const q = sim.diplomacy.letters.find((m) => m.carrierIdx === rec.idx && m.from === s.id && m.status === 'carried');
        if (rec.errand && q) lines.push(`The mayor's paying me to take a letter to ${sim.diplomacy.town(q.to).name}. Can't stop long!`);
        else lines.push(q ? `Off to ${sim.diplomacy.town(q.to).name} with my goods, and a letter from the mayor.` : 'Off on the road with my goods!');
      }
      else if (act.act === 'visit') lines.push(`Selling wares from ${npc.visit ? npc.visit.fromName : 'afar'}. Have a look!`);
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
    case 'life': return { lines: rec.age === 'child' ? kidLife(npc, game) : lifeIn(npc, game) };
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
    case 'directions':
      if (arg) {
        const pl = placesFor(npc, game).find((q) => q.key === arg);
        if (!pl) return { lines: ['I don\'t know that place.'] };
        const dir = direction(npc.x, npc.z, pl.x, pl.z);
        return { lines: [tn === 'cold' ? `Figure it out yourself. ...Fine. It's ${dir}.` : `The ${pl.label.replace(/^The /, '')} is ${dir}.`] };
      }
      return { lines: ['Where to?'], choices: placesFor(npc, game).map((pl) => ({ id: 'directions', arg: pl.key, label: pl.label })) };
    case 'surrender': {
      const sid = s.id;
      return { lines: ['A wise choice. Come along.'], close: true, after: () => sim.justice.surrender(sid, npc) };
    }
    case 'citizen': return citizenTalk(npc, game, arg);
    case 'renounce':
      if (arg === 'yes') {
        sim.revoke('renounced');
        return { lines: [`So be it. You are no longer a citizen of ${s.name}.`] };
      }
      return { lines: ['Are you certain? Your home and standing here would be forfeit.'], choices: [{ id: 'renounce', arg: 'yes', label: 'Yes, I renounce it.' }], back: 'On second thought, no.' };
    case 'profession': return professionTalk(npc, game, arg);
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
      if (!r.ok) return { lines: [r.reason === 'missing' ? 'You don\'t have that. Never mind, then.' : r.reason === 'stock' ? 'Out of stock? Pity. Another time.' : 'Hm?'], close: true };
      return { lines: [r.kind === 'shop' ? pick(rng, ['Thank you kindly!', 'Just what I needed.']) : `Pleasure doing business! Here's ¤${r.paid}.`], close: true };
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
      const topic = on.length ? on[(game.day + rec.idx) % on.length] : LAW_IDS[(game.day + rec.idx) % LAW_IDS.length];
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
    case 'house': {
      const pr = sim.constructionProgress() || 0;
      const pct = Math.round(pr * 100);
      return { lines: [pct < 15 ? 'We\'ve only just laid the foundations.' : pct < 60 ? `The walls are going up: about ${pct}% done.` : pct < 100 ? `Nearly there! Maybe ${pct}% done. The roof's next.` : 'It\'s finished! Go and have a look.', 'We work from seven till seven.'] };
    }
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
    lines.push(t.plot ? 'Our builders will raise a cottage for you on the empty lot. It takes a day or two.' : 'I\'m afraid we have no free land to build on, but you\'ll have a bed with one of our families.');
    const host = sim.pickHost(L);
    if (host) lines.push(`Until then you'd stay with the ${host.family} family.`);
    return { lines, choices: [{ id: 'citizen', arg: 'yes', label: `Agreed. ${t.fee ? `(Pay ¤${t.fee})` : '(Free)'}` }], back: 'Let me think about it.' };
  }
  const r = sim.join(npc);
  if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee}. Come back when you have it.` : 'Something went wrong with the paperwork.'] };
  const lines = [`Welcome, citizen ${game.playerName} of ${s.name}!`];
  if (r.host) lines.push(`You'll stay with the ${r.host.family} family for now. Their spare bed is yours.`);
  if (r.plot) lines.push('The builders will start on your cottage right away.');
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
    if (!ow.explored[k]) fresh = true;
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
  const visits = (game.sim.visits.get(s.id) || []).filter((v) => game.sim.abs >= v.arrive && game.sim.abs < v.leave);
  if (visits.length) items.push(`A merchant from ${visits[0].fromName} is in town, selling on the square.`);
  // News from other towns, as the merchants tell it.
  if (npc.visit && npc.visit.news && npc.visit.news.length) {
    return [`Back home in ${npc.visit.fromName}? ${lcNews(npc.visit.news[(npc.newsI = (npc.newsI || 0) + 1) % npc.visit.news.length])}`];
  }
  for (const r of (e.rumours || []).slice(-3).reverse()) {
    if (r.day < game.day - 8) continue;
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
  if (game.day - e.festival <= 2) lines.push('Did you catch the feast day? Wonderful time.');
  if (e.recent.deaths > 0) lines.push('We\'ve buried people lately. The whole town feels it.');
  return lines.slice(0, 3);
}

function family(npc, game) {
  const rec = npc.rec;
  const L = npc.homeLayout || npc.layout;
  const rng = npc.rng;
  const home = rec.home !== null ? L.buildings[rec.home] : null;
  const lines = [];
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
