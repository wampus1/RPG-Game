// Personality-flavoured dialogue for NPCs: passing remarks, and the topics
// of a conversation (who they are, news, life in town, family, directions,
// compliments, gifts, citizenship, the law...). Lines refer to other people
// by name, never by gendered pronouns.
import { JOBS, HOBBIES, jobTitle } from '../entities/npcgen.js';
import { MAP_W } from '../config.js';
import { BUILDING_NAMES } from '../world/settlement.js';
import { ITEMS } from '../world/items.js';
import { alive, kitchenOf, st, DAY } from '../sim/econ.js';
import { repLevel } from '../sim/sim.js';
import { countItem, removeItem } from './inventory.js';

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

function griefOf(rec) {
  return (rec.grief || []).filter((g) => g.rel !== 'acquaintance').sort((a, b) => (a.rel === 'family' ? -1 : 1) - (b.rel === 'family' ? -1 : 1))[0] || null;
}

// A short remark as the player walks past.
export function greetLine(npc, game, rep, citizen) {
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
  const rec = npc.rec;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const tw = timeWord(game.minute);
  const sim = game.sim;
  const rep = sim.opinion(npc);
  const entry = sim.repEntry(s.id, rec.idx);
  const name = game.playerName;
  if (game.isWanted(s.id) && rec.job !== 'guard') return pick(rng, ['I have nothing to say to the likes of you.', 'Guards! Someone help!', 'Please... just go.']);
  if (rec.job === 'guard' && game.isWanted(s.id)) return 'You\'re wanted in this town. Come quietly, or else.';
  if (sim.justice.exiled.has(s.id)) return 'You were banished! Get out before the guards see you!';
  if (rep <= -60) return pick(rng, ['Leave me alone.', 'I don\'t want to talk to you.', 'Go away.']);
  const g = griefOf(rec);
  if (g) return g.byPlayer ? `You... you're the one who killed ${g.first}. Get away from me.` : pick(rng, [`Sorry, I'm not myself today. We just lost ${g.first}.`, `Hello... forgive me. I can't stop thinking about ${g.first}.`]);
  if (rec.visitor) return pick(rng, [`Greetings, friend! ${rec.name.first} ${rec.name.last}, merchant of ${rec.visit.fromName}.`, `Ah, a customer! Just in from ${rec.visit.fromName}.`]);
  if (rep <= -25) return pick(rng, ['What do you want?', 'Make it quick.', 'Oh. It\'s you.']);
  if (!entry.met) {
    entry.met = true;
    if (p.kindness < 0.3) return pick(rng, ['What do you want?', 'Hmph. Another wanderer.']);
    return p.sociability > 0.65
      ? pick(rng, [`Good ${tw}, traveler! Welcome to ${s.name}!`, `Oh, a new face! Welcome to ${s.name}. And you are...? ${name}? Lovely.`])
      : pick(rng, [`Good ${tw}.`, `Hello. You're not from ${s.name}, are you?`, 'Oh. Hello there.']);
  }
  if (sim.isCitizen(s.id) && rep >= 10) return pick(rng, [`Hello again, ${name}! How's life treating our newest citizen?`, `Good ${tw}, neighbour!`, `${name}! What can I do for you?`]);
  if (rep >= 35) return pick(rng, [`${name}! Good to see you.`, `Ah, ${name}, my friend!`, `Always a pleasure, ${name}.`]);
  return pick(rng, [`Good ${tw}.`, 'Hello again.', `Yes, ${name}?`, 'Hm? What is it?']);
}

// Topics available right now, most relevant first.
export function topicsFor(npc, game) {
  const rec = npc.rec;
  const s = npc.settlement;
  const sim = game.sim;
  const rep = sim.opinion(npc);
  const wanted = game.isWanted(s.id);
  const out = [];
  const add = (id, label) => out.push({ id, label });
  const trader = rec.visitor || JOBS[rec.job]?.trader || rec.job === 'cook';
  if (rec.job === 'guard' && (wanted || sim.justice.pendingIn(s.id).length)) add('surrender', 'I surrender.');
  if (wanted || sim.justice.exiled.has(s.id)) {
    add('bye', 'Goodbye.');
    return out;
  }
  if (rep <= -60) {
    add('gift', 'Please, accept this as an apology...');
    add('bye', 'Goodbye.');
    return out;
  }
  if (trader && rep > -40) add('trade', rec.job === 'cook' || rec.job === 'innkeeper' || rec.job === 'barkeep' ? 'Something to eat, please.' : 'Let\'s trade.');
  if (rec.job === 'mayor') {
    const inHall = game.buildingAtPlayer()?.type === 'townhall';
    if (sim.isCitizen(s.id)) add('renounce', 'I renounce my citizenship.');
    else add('citizen', inHall ? `Make me a citizen of ${s.name}.` : 'How do I become a citizen?');
    add('laws', 'What are the laws and taxes?');
  }
  const c = sim.construction;
  if (c && c.sid === s.id && !c.done && !c.cancelled && (rec.job === 'mayor' || (rec.override && rec.override.act === 'build'))) add('house', 'How is my house coming?');
  if (sim.citizen && sim.citizen.sid === s.id && sim.citizen.host === rec.home && rec.home !== null) add('host', 'Thanks for putting me up.');
  if (rec.job === 'priest') add('bless', 'A blessing, please. (¤5)');
  if (rec.job === 'guard') add('laws', 'Any trouble around here?');
  add('who', 'Who are you?');
  add('doing', 'What are you up to?');
  add('news', 'Any news?');
  add('life', `How is life in ${s.name}?`);
  if (!rec.visitor) add('family', 'Tell me about your family.');
  add('directions', 'Where can I find...?');
  add('kind', ['(Compliment them)', '(Chat about the weather)', '(Ask how they\'re doing)'][(rec.idx + game.day) % 3]);
  add('gift', 'I have a gift for you.');
  add('rude', '(Insult them)');
  add('bye', 'Goodbye.');
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

// The NPC's answer to a topic: { lines, close, open, refresh }.
export function respond(npc, game, id, arg) {
  const rec = npc.rec;
  const L = npc.layout;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const sim = game.sim;
  const e = L.econ;
  const job = jobTitle(rec, s);
  const name = game.playerName;
  sim.meet(npc);
  switch (id) {
    case 'who': {
      if (rec.visitor) return { lines: [`${rec.name.first} ${rec.name.last}, traveling merchant. I carry goods between ${rec.visit.fromName} and the towns around it.`] };
      if (rec.age === 'child') return { lines: [pick(rng, [`I'm ${rec.name.first}! I'm ${6 + (rec.idx % 7)}!`, `I'm ${rec.name.first}. Wanna play tag?`, `My name's ${rec.name.first}!`])] };
      if (rec.job === 'retired') return { lines: [`I'm ${rec.name.first} ${rec.name.last}. I've lived in ${s.name} all my life.`] };
      const wp = rec.work && rec.work.building != null && L.buildings[rec.work.building] ? L.buildings[rec.work.building] : null;
      const where = wp ? ` at the ${wp.name}` : rec.job === 'farmer' ? ' in the fields' : rec.job === 'fisher' ? ' down by the water' : rec.job === 'guard' ? ' keeping these streets safe' : rec.job === 'trapper' ? ' out in the wilds' : '';
      const lines = [`I'm ${rec.name.first} ${rec.name.last}, ${aOrAn(job.toLowerCase())} ${job.toLowerCase()}${where}.`];
      const sk = rec.skills || {};
      if (rec.job === 'cook') lines.push(sk.cooking > 0.75 ? 'Folk come from miles around for my feasts.' : sk.cooking < 0.45 ? 'I\'m... still learning. Don\'t ask about the gruel.' : 'I cook a decent stew, if I say so myself.');
      else if (rec.job === 'trapper') lines.push(sk.hunting > 0.7 ? 'Bow, blade or snare, I always bring something home.' : 'Some days the woods are generous. Some days not.');
      else if (rec.traits.length) lines.push(`People say I'm ${rec.traits.slice(0, 2).join(' and ')}.`);
      return { lines };
    }
    case 'doing': {
      const act = npc.activity?.entry;
      const lines = [];
      if (!act) lines.push('Just taking a breather.');
      else if (act.act === 'mourn' || act.act === 'funeral') lines.push(`I'm paying my respects to ${act.who || 'an old friend'}.`);
      else if (act.act === 'build') lines.push(sim.citizen ? `Building a house for our newest citizen: you, ${name}!` : 'Building. Mind the planks.');
      else if (act.act === 'forage') lines.push(rec.age === 'child' ? 'Looking for berries. We\'ve got nothing to eat at home...' : 'Out looking for food. Times are lean.');
      else if (act.act === 'trial') lines.push('There\'s to be a hearing at the jail.');
      else if (act.act === 'travel') lines.push('Off on the road with my goods!');
      else if (act.act === 'visit') lines.push(`Selling wares from ${rec.visit.fromName}. Have a look!`);
      else if (act.act === 'hobby' && HOBBIES[act.hobby]) lines.push(pick(rng, [`Nothing beats ${HOBBIES[act.hobby].label} after a long day.`, `I'm fond of ${HOBBIES[act.hobby].label}.`]));
      else if (act.act === 'work' && p.diligence < 0.3) lines.push(pick(rng, ['Don\'t tell anyone I\'m slacking off.', 'Is it quitting time yet?']));
      else if (act.act === 'work' && rec.job === 'cook') lines.push(pick(rng, ['Keeping the pot bubbling.', 'Cooking for half the town, as usual.']));
      else if (act.act === 'work' && rec.job === 'trapper') lines.push(pick(rng, ['Checking my snares. Rabbits are clever this season.', 'Hunting. Keep your voice down.']));
      else if (act.act === 'work') lines.push(pick(rng, ['Work never ends around here.', 'Honest work, honest pay.', 'Can\'t chat long, lots to do.']));
      else if (act.act === 'eat') {
        const m = rec.lastMeal;
        if (m && m.item) lines.push(m.q === 'terrible' ? `Eating... well, "eating". This ${ITEMS[m.item].name.toLowerCase()} is awful.` : m.q === 'delightful' ? `Having the most delightful ${ITEMS[m.item].name.toLowerCase()}!` : `Having some ${ITEMS[m.item].name.toLowerCase()}.`);
        else lines.push('Supposed to be eating, but there\'s nothing to eat.');
      } else if (act.act === 'sleep') lines.push('I should really be asleep...');
      else lines.push(pick(rng, ['Just passing the time.', 'Not much. You?']));
      if (rec.hungry >= 1 && act?.act !== 'eat') lines.push(rec.hungry >= 2 ? 'I haven\'t eaten properly in days.' : 'I didn\'t get to eat yesterday.');
      return { lines };
    }
    case 'news': return { lines: news(npc, game) };
    case 'life': return { lines: lifeIn(npc, game) };
    case 'family': return { lines: family(npc, game) };
    case 'kind': {
      const d = sim.chat(npc, 'kind');
      const lvl = repLevel(sim.opinion(npc));
      if (!d) return { lines: [pick(rng, ['Ha, you already said that today.', 'You\'re sweet, but we just chatted.', 'Yes, yes. Thank you.'])] };
      if (p.kindness < 0.3) return { lines: [pick(rng, ['...Fine. Thanks, I suppose.', 'Hmph. You\'re not so bad.']), `(${lvl.label})`] };
      return { lines: [pick(rng, ['Oh, that\'s kind of you to say!', 'Ha! You\'re a charmer.', 'What a lovely thing to say.', 'Well, aren\'t you pleasant company!']), `(${lvl.label})`] };
    }
    case 'rude': {
      sim.chat(npc, 'rude');
      const angry = p.temper > 0.6;
      return { lines: [angry ? pick(rng, ['What did you just say to me?!', 'Say that again, I dare you!', 'Get out of my sight!']) : pick(rng, ['...That was uncalled for.', 'How rude!', 'I don\'t have to listen to this.'])], close: angry };
    }
    case 'gift': return { open: 'gift' };
    case 'trade': return { open: 'trade' };
    case 'directions':
      if (arg) {
        const pl = placesFor(npc, game).find((q) => q.key === arg);
        if (!pl) return { lines: ['I don\'t know that place.'] };
        return { lines: [`The ${pl.label.replace(/^The /, '')} is ${direction(npc.x, npc.z, pl.x, pl.z)}.`] };
      }
      return { open: 'directions' };
    case 'surrender': {
      const sid = s.id;
      return { lines: ['A wise choice. Come along.'], close: true, after: () => sim.justice.surrender(sid) };
    }
    case 'citizen': return citizenTalk(npc, game, arg);
    case 'renounce':
      if (arg === 'yes') {
        sim.revoke('renounced');
        return { lines: [`So be it. You are no longer a citizen of ${s.name}.`], refresh: true };
      }
      return { lines: ['Are you certain? Your home and standing here would be forfeit.'], confirm: { id: 'renounce', label: 'Yes, I renounce it.' } };
    case 'laws': {
      const lines = [];
      lines.push(`Taxes here are ${Math.round(e.tax * 100)}% of earnings${sim.isCitizen(s.id) ? `, and citizens pay about ¤${Math.max(1, Math.round(12 * e.tax))} a day` : ''}.`);
      lines.push(e.fineScale > 1.1 ? 'Fines are steep lately: we\'ve had trouble.' : e.fineScale < 0.95 ? 'Fines are lenient. We believe in second chances.' : 'Break the law and you\'ll pay a fair fine, or sit in a cell.');
      if (e.laws.armsBan) lines.push('Drawn weapons are forbidden within the town. Keep your blade sheathed.');
      const r = sim.justice.recordOf(s.id);
      if (r.convictions) lines.push(`And you... you have ${r.convictions} conviction${r.convictions > 1 ? 's' : ''} here. Repeat offenders get exile, or worse.`);
      else if (rec.job === 'guard') lines.push(e.recent.thefts + e.recent.violence > 0 ? 'There\'s been some trouble lately. Keep your eyes open.' : 'Quiet as a graveyard. Just how I like it.');
      return { lines };
    }
    case 'house': {
      const pr = sim.constructionProgress() || 0;
      const pct = Math.round(pr * 100);
      return { lines: [pct < 15 ? 'We\'ve only just laid the foundations.' : pct < 60 ? `The walls are going up: about ${pct}% done.` : pct < 100 ? `Nearly there! Maybe ${pct}% done. The roof's next.` : 'It\'s finished! Go and have a look.', 'We work from seven till seven.'] };
    }
    case 'host': {
      const r = sim.repEntry(s.id, rec.idx);
      if (r.chat !== game.day) sim.chat(npc, 'kind');
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
      return { lines: [pick(rng, sim.opinion(npc) >= 35 ? [`Take care, ${name}!`, 'Come back soon!'] : ['Farewell.', 'Safe travels.', 'Bye now.'])], close: true };
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
    return { lines, confirm: { id: 'citizen', label: `Agreed. ${t.fee ? `(Pay ¤${t.fee})` : '(Free)'}` } };
  }
  const r = sim.join(npc);
  if (!r.ok) return { lines: [r.reason === 'money' ? `You'll need ¤${r.fee}. Come back when you have it.` : 'Something went wrong with the paperwork.'] };
  const lines = [`Welcome, citizen ${game.playerName} of ${s.name}!`];
  if (r.host) lines.push(`You'll stay with the ${r.host.family} family for now. Their spare bed is yours.`);
  if (r.plot) lines.push('The builders will start on your cottage right away.');
  game.ui.msg(`You are now a citizen of ${s.name}!`, '#ffe070');
  game.audio?.play('coin');
  return { lines, refresh: true };
}

function news(npc, game) {
  const L = npc.layout;
  const s = npc.settlement;
  const rng = npc.rng;
  const e = L.econ;
  const items = [];
  for (const it of [...e.ledger].reverse()) {
    if (it.day < game.day - 3 || it.day <= 0) continue;
    items.push(it.day === game.day ? `Today: ${it.text}` : `On day ${it.day}, ${it.text.charAt(0).toLowerCase()}${it.text.slice(1)}`);
    if (items.length >= 4) break;
  }
  const visits = (game.sim.visits.get(s.id) || []).filter((v) => game.sim.abs >= v.arrive && game.sim.abs < v.leave);
  if (visits.length) items.push(`A merchant from ${visits[0].fromName} is in town, selling on the square.`);
  // Rumours about the wider world mark the place on your map.
  const others = game.world.ow.settlements.filter((o) => o.id !== s.id && o.condition !== 'abandoned');
  if (others.length) {
    const o = others.sort((a, b) => Math.hypot(a.cx - s.cx, a.cz - s.cz) - Math.hypot(b.cx - s.cx, b.cz - s.cz))[(npc.newsI || 0) % Math.min(3, others.length)];
    const dx = o.cx - s.cx;
    const dz = o.cz - s.cz;
    const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
    const what = o.type === 'city' ? 'the great city of' : o.type === 'town' ? 'the town of' : 'a village called';
    items.push(`There's ${what} ${o.name} to the ${dir}.${o.condition === 'prosperous' ? ' Rich folk there.' : o.condition === 'poor' ? ' Hard times there, I hear.' : ''}`);
    const ow = game.world.ow;
    let fresh = false;
    for (let z = o.cz; z < o.cz + o.cd; z++) for (let x = o.cx; x < o.cx + o.cw; x++) {
      const k = z * MAP_W + x;
      if (!ow.explored[k]) fresh = true;
      ow.explored[k] = 1;
    }
    if (fresh) game.ui.msg(`Map updated: ${o.name}`, '#a0c8ff');
  }
  const ruins = game.world.ow.settlements.find((o) => o.condition === 'abandoned');
  if (ruins && rng.chance(0.3)) items.push(`Folk say ${ruins.name} was abandoned. Might be treasure left behind...`);
  if (!items.length) items.push('Nothing much happens around here.');
  const i = (npc.newsI || 0) % items.length;
  npc.newsI = (npc.newsI || 0) + 1;
  return [items[i], ...(items.length > 1 && i + 1 < items.length && rng.chance(0.5) ? [items[i + 1]] : [])];
}

function lifeIn(npc, game) {
  const L = npc.layout;
  const rec = npc.rec;
  const e = L.econ;
  const rng = npc.rng;
  const lines = [];
  const living = L.npcs.filter(alive);
  const hungry = living.filter((r) => r.hungry >= 1).length;
  if (rec.visitor) return ['Every town has its troubles. This one\'s kitchen could use better meat, if you ask me.'];
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
  const L = npc.layout;
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
