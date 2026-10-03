// A town's laws. Each law has people for and against it (a trapper and a
// barkeep see a curfew differently), and things that happen push the
// council one way or the other: violence brings a weapons ban, night-time
// trouble a curfew, empty coffers a tariff on outsiders. Every morning the
// mayor weighs what the town wants and what's been happening, and may pass
// or repeal one law. You can sway it too: gather signatures for a petition
// and bring it to the mayor.
import { ledger, alive, mayorOf } from './econ.js';
import { hash4, clamp } from '../util/rng.js';

const noise = (rec, id) => ((hash4(rec.idx, id.length, id.charCodeAt(0), 0x1a55) % 1000) / 1000 - 0.5) * 0.5;
const has = (rec, ...jobs) => jobs.includes(rec.job);
const P = (rec) => rec.personality || {};

export const LAWS = {
  armsBan: {
    name: 'Weapons ban', short: 'no weapons', desc: 'Drawn weapons are forbidden within the town.',
    stance: (r) => (has(r, 'guard') ? 0.5 : 0) + (has(r, 'trapper', 'lumberjack') ? -0.4 : 0) + (0.5 - (P(r).bravery ?? 0.5)) * 0.6 + (r.age === 'elder' ? 0.3 : 0),
    pressure: (e) => Math.min(1, (e.recent.violence || 0) * 0.6) - Math.min(0.6, (e.recent.calm || 0) * 0.06),
  },
  curfew: {
    name: 'Curfew', short: 'curfew', desc: 'No one is to be out in the streets between ten at night and five in the morning.',
    stance: (r) => (r.age === 'elder' ? 0.5 : 0) + (has(r, 'guard') ? 0.3 : 0) + (has(r, 'innkeeper', 'barkeep') ? -0.9 : 0) + (0.5 - (P(r).sociability ?? 0.5)) * 0.8,
    pressure: (e) => Math.min(1, (e.recent.night || 0) * 0.4 + (e.recent.raids || 0) * 0.3) - Math.min(0.6, (e.recent.calm || 0) * 0.05),
  },
  tariff: {
    name: 'Outsiders\' tariff', short: 'tariff', desc: 'Traders charge anyone who isn\'t a citizen a tenth more, for the treasury.',
    stance: (r) => (has(r, 'merchant') ? -0.9 : 0) + (has(r, 'mayor', 'noble') ? 0.3 : 0) + (P(r).kindness ?? 0.5) * -0.4 + 0.1,
    pressure: (e, L) => (e.treasury < L.npcs.filter(alive).length * 10 ? 0.6 : 0) - (e.treasury > L.npcs.filter(alive).length * 40 ? 0.5 : 0),
  },
  poaching: {
    name: 'Game law', short: 'no poaching', desc: 'Only licensed trappers may hunt the game around the town.',
    stance: (r) => (has(r, 'trapper') ? 0.7 : 0) + (has(r, 'cook', 'innkeeper') ? -0.3 : 0) + (has(r, 'noble') ? 0.4 : 0),
    pressure: (e) => Math.min(1, (e.recent.poached || 0) * 0.5) - 0.1,
  },
  felling: {
    name: 'Tree law', short: 'no felling', desc: 'No felling of trees within the town.',
    stance: (r) => (has(r, 'lumberjack', 'carpenter', 'builder') ? -0.8 : 0) + (has(r, 'priest', 'herbalist', 'noble') ? 0.5 : 0) + (r.age === 'elder' ? 0.2 : 0),
    pressure: (e) => Math.min(1, (e.recent.felled || 0) * 0.25) - 0.1,
  },
  openMarket: {
    name: 'Open market', short: 'open market', desc: 'Market dues are waived: everything sells a little cheaper.',
    stance: (r) => (has(r, 'merchant', 'blacksmith', 'tailor', 'baker', 'carpenter') ? -0.4 : 0.35) + noise(r, 'om'),
    pressure: (e, L) => (e.treasury > L.npcs.filter(alive).length * 45 ? 0.4 : 0) - (e.treasury < L.npcs.filter(alive).length * 15 ? 0.6 : 0),
  },
  // Each island's own (`styles`: only its peoples ever pass them).
  // Thessa, the horse island: no galloping through the streets.
  horseLaw: {
    name: 'Riding law', short: 'no riding', desc: 'No one may ride in the streets: dismount and lead your horse.',
    styles: ['vale', 'north', 'sun', 'wild', 'high'],
    stance: (r) => (r.age === 'elder' ? 0.4 : 0) + (has(r, 'handler', 'merchant') ? -0.6 : 0) + (r.age === 'child' ? -0.3 : 0) + 0.05,
    pressure: (e) => Math.min(0.6, (e.recent.riding || 0) * 0.3) - 0.15,
  },
  // Kharos: a tithe to the kiln-temple, so the mountain goes easy on them;
  // and only black glass sold for blades.
  fireTithe: {
    name: 'Fire tithe', short: 'fire tithe', desc: 'Every household gives to the kiln-temple: citizens pay ¤2 more a day, and the mountain spares the town some of its wrath.',
    styles: ['ember'],
    stance: (r) => (has(r, 'priest') ? 0.8 : 0) + (r.age === 'elder' ? 0.3 : 0) + (has(r, 'merchant') ? -0.4 : 0) + 0.2,
    pressure: (e) => (e.ashDay !== undefined ? 0.3 : 0) - 0.05,
  },
  blackGlass: {
    name: 'Black-glass law', short: 'obsidian only', desc: 'Only obsidian blades may be sold here: the smith keeps no iron swords, and black glass sells cheap.',
    styles: ['ember'],
    stance: (r) => (has(r, 'blacksmith') ? -0.3 : 0) + (has(r, 'priest', 'mayor') ? 0.4 : 0) + 0.1,
    pressure: () => -0.1,
  },
  // Myrrow's Mirefolk: lights after dark (the fog takes the unlit), and the
  // town's mushrooms belong to everyone.
  lanternLaw: {
    name: 'Lantern law', short: 'carry a light', desc: 'After dark, anyone in the streets must carry a lit torch or lantern.',
    styles: ['mist'],
    stance: (r) => (r.age === 'elder' ? 0.5 : 0) + (has(r, 'guard', 'priest') ? 0.4 : 0) + (0.5 - (P(r).bravery ?? 0.5)) * 0.6,
    pressure: (e) => Math.min(0.6, (e.recent.night || 0) * 0.2) - 0.05,
  },
  sporeLaw: {
    name: 'Spore law', short: 'no picking', desc: 'The mushrooms and glowcaps of the town belong to all: picking them is theft.',
    styles: ['mist'],
    stance: (r) => (has(r, 'herbalist', 'priest') ? 0.6 : 0) + (has(r, 'cook') ? -0.4 : 0) + 0.15,
    pressure: (e) => Math.min(0.5, (e.recent.picked || 0) * 0.25) - 0.05,
  },
  // Myrrow's Stiltfolk: the sea feeds everyone, and the harbour's dues
  // keep the stilts standing.
  catchShare: {
    name: 'Catch-share', short: 'catch-share', desc: 'A fifth of every catch sold here goes to the common store: fish fetch less, and the treasury gains.',
    styles: ['tide'],
    stance: (r) => (has(r, 'fisher') ? -0.5 : 0) + (has(r, 'mayor', 'priest') ? 0.4 : 0) + (P(r).kindness ?? 0.5) * 0.4,
    pressure: (e, L) => (e.treasury < L.npcs.filter(alive).length * 12 ? 0.4 : 0) - 0.1,
  },
  raftDues: {
    name: 'Raft dues', short: 'raft dues', desc: 'Anyone who puts a raft in at the town\'s shore pays ¤2 to the harbour.',
    styles: ['tide'],
    stance: (r) => (has(r, 'fisher', 'merchant') ? -0.5 : 0) + (has(r, 'mayor', 'guard') ? 0.3 : 0) + 0.1,
    pressure: (e, L) => (e.treasury < L.npcs.filter(alive).length * 12 ? 0.3 : 0) - 0.1,
  },
};

// Can this town's people pass the law at all?
export function lawFits(s, id) {
  const st = LAWS[id].styles;
  return !st || st.includes(s && s.style);
}
export const LAW_IDS = Object.keys(LAWS);

export function lawOn(L, id) {
  return !!(L && L.econ && L.econ.laws && L.econ.laws[id]) || byDecree(L, id);
}

// A law the realm's ruler has decreed for every town (whatever the town
// itself decides).
export function byDecree(L, id) {
  const d = L && L.settlement && L.settlement.civ && L.settlement.civ.decrees;
  return !!(d && id === 'armsBan' && d.armsBan);
}

// One person's view of a law: -1 (dead against) to 1 (all for it).
export function stance(rec, id) {
  return clamp(LAWS[id].stance(rec) + noise(rec, id), -1, 1);
}

// The grown-ups of the town, on balance.
export function support(L, id) {
  const people = L.npcs.filter((r) => alive(r) && !r.away && r.age !== 'child' && !r.visitor);
  if (!people.length) return 0;
  return people.reduce((n, r) => n + stance(r, id), 0) / people.length;
}

// The town's first laws, set when it's founded.
export function foundingLaws(s, rng, values = []) {
  const st = s.style;
  // The Ashborn: hard traders who guard their few trees and tithe to the
  // mountain. The Mirefolk: lights in the dark, hands off the mushrooms,
  // and no blades drawn in the fog. The Stiltfolk: an open quay, shared
  // catches and harbour dues. (The peoples of Thessa: as they always were,
  // and some towns won't have horses ridden through them.)
  if (st === 'ember') {
    return {
      armsBan: values.includes('martial') && rng.chance(0.3),
      curfew: false,
      tariff: s.type !== 'village' ? rng.chance(0.6) : rng.chance(0.2),
      poaching: false,
      felling: rng.chance(0.65),
      openMarket: false,
      fireTithe: rng.chance(0.8),
      blackGlass: rng.chance(0.5),
    };
  }
  if (st === 'mist') {
    return {
      armsBan: values.includes('martial') || rng.chance(0.5),
      curfew: false,
      tariff: s.type !== 'village' && rng.chance(0.2),
      poaching: rng.chance(0.3),
      felling: rng.chance(0.6),
      openMarket: s.condition === 'prosperous' && rng.chance(0.2),
      lanternLaw: rng.chance(0.85),
      sporeLaw: rng.chance(0.6),
    };
  }
  if (st === 'tide') {
    return {
      armsBan: values.includes('martial') || rng.chance(0.15),
      curfew: s.type === 'city' && rng.chance(0.1),
      tariff: false,
      poaching: false,
      felling: s.type === 'city' && rng.chance(0.2),
      openMarket: rng.chance(0.6),
      catchShare: rng.chance(0.8),
      raftDues: s.coast ? rng.chance(0.7) : false,
    };
  }
  return {
    armsBan: values.includes('martial') || rng.chance(0.25),
    curfew: s.type === 'city' && rng.chance(0.35),
    tariff: s.type !== 'village' && rng.chance(0.2),
    poaching: ['forest', 'taiga', 'jungle'].includes(s.biome) && rng.chance(0.4),
    felling: s.type === 'city' && rng.chance(0.3),
    openMarket: s.condition === 'prosperous' && rng.chance(0.3),
    horseLaw: s.type !== 'village' && rng.chance(0.35),
  };
}

// The morning review: at most one law passed or repealed a day.
export function reviewLaws(L, day, who) {
  const e = L.econ;
  e.laws ||= {};
  let best = null;
  for (const id of LAW_IDS) {
    const law = LAWS[id];
    if (!lawFits(L.settlement, id)) continue;
    const want = support(L, id) * 0.6 + law.pressure(e, L);
    const on = !!e.laws[id];
    const score = on ? -want : want;
    if (score > (on ? 0.3 : 0.4) && (!best || score > best.score)) best = { id, on, score };
  }
  if (!best) return null;
  if (L.settlement.civ && L.settlement.civ.values && L.settlement.civ.values.includes('martial') && best.id === 'armsBan' && best.on) return null;
  e.laws[best.id] = !best.on;
  const law = LAWS[best.id];
  ledger(L, day, best.on ? `${who} repealed the ${law.name.toLowerCase()}.` : `${who} passed a new law: ${law.desc}`);
  // What prompted it is now dealt with.
  if (best.id === 'armsBan') e.recent.violence = 0;
  if (best.id === 'curfew') e.recent.night = 0;
  if (best.id === 'poaching') e.recent.poached = 0;
  if (best.id === 'felling') e.recent.felled = 0;
  if (best.id === 'horseLaw') e.recent.riding = 0;
  if (best.id === 'sporeLaw') e.recent.picked = 0;
  return { id: best.id, on: !best.on };
}

// ------------------------------------------------------------ petitions
// You can ask the mayor to pass or repeal a law, if enough of the town
// has put their name to it.
export function needed(L) {
  const adults = L.npcs.filter((r) => alive(r) && !r.away && r.age !== 'child' && !r.visitor).length;
  return Math.max(3, Math.ceil(adults * 0.25));
}

// Will they sign? Depends on what they think of the law, and of you.
export function willSign(rec, id, enact, opinion) {
  const s = stance(rec, id) * (enact ? 1 : -1);
  return s + opinion / 150 > 0.05;
}

// The mayor's answer to a petition with its signatures.
export function decide(L, pet, mayorOpinion) {
  const need = needed(L);
  if (pet.signers.length < need) return { ok: false, reason: 'few', need };
  const m = mayorOf(L);
  const mine = m ? stance(m, pet.law) * (pet.enact ? 1 : -1) : 0;
  if (mine < -0.5 && mayorOpinion < 40) return { ok: false, reason: 'mayor' };
  return { ok: true };
}

export function lawList(L) {
  return LAW_IDS.filter((id) => lawOn(L, id));
}
