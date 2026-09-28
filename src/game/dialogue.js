// Personality-flavoured dialogue for NPCs. Lines refer to other people by
// name (never by gendered pronouns).
import { JOBS, HOBBIES } from '../entities/npcgen.js';
import { MAP_W } from '../config.js';
import { BUILDING_NAMES } from '../world/settlement.js';

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

export function dialogueLine(npc, game, kind) {
  const rng = npc.rng;
  const p = npc.rec.personality;
  const tw = timeWord(game.minute);
  const wanted = game.isWanted(npc.settlement.id);
  if (wanted) return pick(rng, ['Stay away from me!', 'Murderer...', 'The guards are after you!', '...']);
  if (kind === 'greet') {
    if (p.kindness < 0.3) return pick(rng, ['Hmph.', 'What?', 'Move along.', 'Busy.']);
    if (p.sociability > 0.7) return pick(rng, [`Good ${tw}!`, 'Hello there!', 'Lovely day!', 'Hi, stranger!', 'Welcome!']);
    return pick(rng, [`${tw === 'night' ? 'Evening' : 'Hello'}.`, 'Hm? Oh, hi.', `Good ${tw}.`, 'Safe travels.']);
  }
  return '';
}

// Full conversation content for the dialogue window.
export function conversation(npc, game) {
  const rec = npc.rec;
  const L = npc.layout;
  const s = npc.settlement;
  const rng = npc.rng;
  const p = rec.personality;
  const tw = timeWord(game.minute);
  const job = JOBS[rec.job]?.title || 'Villager';
  const home = L.buildings[rec.home];
  const lines = [];
  if (game.isWanted(s.id)) {
    lines.push(pick(rng, ['I have nothing to say to the likes of you.', 'Guards! Someone help!', 'Please... just go.']));
    return lines;
  }
  const greet = p.kindness < 0.3
    ? pick(rng, ['What do you want?', 'Make it quick.', 'Hmph. Another wanderer.'])
    : p.sociability > 0.65
      ? pick(rng, [`Good ${tw}, traveler! Welcome to ${s.name}!`, `Oh, a new face! Welcome to ${s.name}.`, `Well met! Lovely ${tw}, isn't it?`])
      : pick(rng, [`Good ${tw}.`, `Hello. You're not from ${s.name}, are you?`, `Oh. Hello there.`]);
  lines.push(greet);
  // Who they are.
  if (rec.age === 'child') {
    lines.push(pick(rng, [`I'm ${rec.name.first}! I'm ${rng.int(6, 12)}!`, `I'm ${rec.name.first}. Wanna play tag?`, `My name's ${rec.name.first}!`]));
  } else if (rec.job === 'retired') {
    lines.push(`I'm ${rec.name.first} ${rec.name.last}. I've lived in ${s.name} all my life.`);
  } else {
    const wp = rec.work && rec.work.building != null && L.buildings[rec.work.building] ? L.buildings[rec.work.building] : null;
    const where = wp ? ` at the ${wp.name}` : rec.job === 'farmer' ? ' in the fields' : rec.job === 'fisher' ? ' down by the water' : rec.job === 'guard' ? ' keeping these streets safe' : '';
    lines.push(`I'm ${rec.name.first} ${rec.name.last}, ${aOrAn(job.toLowerCase())} ${job.toLowerCase()}${where}.`);
  }
  // Current activity.
  const act = npc.activity?.entry;
  if (act) {
    if (act.act === 'hobby' && HOBBIES[act.hobby]) lines.push(pick(rng, [`Nothing beats ${HOBBIES[act.hobby].label} after a long day.`, `I'm fond of ${HOBBIES[act.hobby].label}.`]));
    else if (act.act === 'work' && p.diligence < 0.3) lines.push(pick(rng, ['Don\'t tell anyone I\'m slacking off.', 'Is it quitting time yet?']));
    else if (act.act === 'work') lines.push(pick(rng, ['Work never ends around here.', 'Honest work, honest pay.', 'Can\'t chat long, lots to do.']));
    else if (act.act === 'eat') lines.push(pick(rng, ['Care for a bite? No? More for me.', 'Mealtime is the best time.']));
  }
  // Family.
  if (rec.partner !== null && rec.partner !== undefined) {
    const pr = L.npcs[rec.partner];
    if (pr) lines.push(pick(rng, [`My partner ${pr.name.first} is ${pr.job === 'retired' ? 'enjoying retirement' : 'the ' + (JOBS[pr.job]?.title || 'worker').toLowerCase()} here.`, `Have you met ${pr.name.first}? We share the ${home ? home.name.toLowerCase() : 'house'} by the ${rng.chance(0.5) ? 'road' : 'square'}.`]));
  }
  if (rec.children.length) {
    const names = rec.children.map((i) => L.npcs[i]?.name.first).filter(Boolean);
    if (names.length) lines.push(`${names.length > 1 ? 'The little ones, ' + names.join(' and ') + ', keep me' : names[0] + ' keeps me'} busy.`);
  }
  if (rec.parents.length && rec.age === 'child') {
    const par = L.npcs[rec.parents[0]];
    if (par) lines.push(`${par.name.first} says I shouldn't talk to strangers...`);
  }
  // Traits flavour.
  if (rec.traits.includes('night owl')) lines.push('I do my best thinking after dark.');
  else if (rec.traits.includes('early riser')) lines.push('Up with the sun, that\'s me.');
  if (rec.traits.includes('hot-headed') && rng.chance(0.5)) lines.push('Don\'t get on my bad side.');
  // Rumours about the world.
  const others = game.world.ow.settlements.filter((o) => o.id !== s.id && o.condition !== 'abandoned');
  if (others.length && rng.chance(0.8)) {
    const o = others.sort((a, b) => Math.hypot(a.cx - s.cx, a.cz - s.cz) - Math.hypot(b.cx - s.cx, b.cz - s.cz))[rng.int(0, Math.min(2, others.length - 1))];
    const dx = o.cx - s.cx;
    const dz = o.cz - s.cz;
    const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
    const what = o.type === 'city' ? 'the great city of' : o.type === 'town' ? 'the town of' : 'a village called';
    lines.push(`There's ${what} ${o.name} to the ${dir}.${o.condition === 'prosperous' ? ' Rich folk there.' : o.condition === 'poor' ? ' Hard times there, I hear.' : ''}`);
    // Rumours mark the place on the world map.
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
  if (ruins && rng.chance(0.35)) lines.push(`Folk say ${ruins.name} was abandoned. Might be treasure left behind...`);
  if (s.civ && rng.chance(0.5)) lines.push(`We're proud members of the ${s.civ.name}.`);
  return lines;
}

function aOrAn(w) {
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

export { BUILDING_NAMES };
