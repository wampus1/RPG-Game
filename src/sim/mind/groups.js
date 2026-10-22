// (Round 136) Townsfolk together: what a town feels as one, and what it does
// about it.
//
// When enough of a town share something (too many taxes, empty bellies,
// fear after a raid, no love for the mayor, a grudge against someone
// playing; or a death they all mourn, or a day they're all glad of), and
// one of them is the sort others follow (someone who can lead, or talk, or
// is angry enough), they come together under them. A grievance grows the
// more there are of them and the angrier they are, and cools as things get
// better:
//   grumbling   talk in the tavern and the street;
//   a petition  put to the mayor (to you, at the council, if the town's
//               yours to govern): granted, or refused;
//   a protest   evenings in the square, shouting;
//   a strike    tools down: no work done till they're heard;
//   a riot      windows broken at the hall, the treasury raided;
//   and at last some of them leave, for a town that's better run, or out
//   into the wilds to found a village of their own under the one who led
//   them.
// Fear after a raid makes a militia of the brave (drilling of an evening,
// some of them joining the watch); hunger makes neighbours share, or turn
// thief; a grudge against someone playing has them cold-shouldered, then
// confronted. A shared grief keeps a vigil; a shared gladness a night at
// the tavern.
//
// You can stand with them, talk them down, put coin into the cause, plead
// for them with the mayor (see game/social.js), or, governing, grant or
// refuse what they ask (see agenda.js). A town's groups are kept with the
// town (`econ.groups`).
import { clamp } from '../../util/rng.js';
import { alive, ledger, setOverride, freeSlot } from '../econ.js';
import { feel, stir } from './emotion.js';
import { remember, recall, warm, opinionOf } from './memory.js';
import { skillOf, practise } from './talent.js';
import { P, nk, nameOf, has } from './common.js';
import { feedHungry } from '../agenda.js';
import { retrain } from '../../entities/npcgen.js';
import { RNG, hash4 } from '../../util/rng.js';
import { guardsWanted } from './ambition.js';

const MAX_GROUPS = 3;
const PLAYER_WRONGS = new Set(['hurt', 'wronged', 'insult', 'killed', 'bad_word', 'slander', 'junk_gift', 'tactless', 'cheated']);

// What each cause asks for, and what giving it does.
export const CAUSES = {
  tax: { what: 'the taxes', ask: 'lower taxes', complaint: true },
  hunger: { what: 'hunger', ask: 'bread for the hungry', complaint: true },
  safety: { what: 'safety', ask: 'a stronger watch', complaint: true },
  mayor: { what: 'the mayor', ask: 'a new mayor', complaint: true },
  player: { what: 'a grudge', ask: 'a reckoning', complaint: false },
  vigil: { what: 'a death', ask: 'a vigil', complaint: false },
  joy: { what: 'good news', ask: 'a night out', complaint: false },
};

export const groupsOf = (L) => (L.econ && L.econ.groups) || [];
export const groupOf = (L, r) => groupsOf(L).find((g) => !g.out && g.mem.includes(r.idx)) || null;

// Whether `r` shares this town's grievance of kind `k` (a cause's own
// test, `x` its particular: the player's key, the dead's name).
function shares(c, r, k, x) {
  if (r.age === 'child' || r.visitor) return false;
  switch (k) {
    case 'tax': {
      // (Taxes high, and felt: by the strained, the poor, the unhappy.)
      const t = c.L.econ.tax || 0;
      if (t < 0.14 || r.job === 'mayor') return false;
      const hard = (feel(r, 'strain', c.now) >= 0.25 ? 1 : 0) + ((r.coins || 0) < 6 ? 1 : 0) + ((r.mood ?? 0.5) < 0.4 ? 1 : 0) + (t >= 0.2 ? 1 : 0);
      return hard >= 2;
    }
    case 'hunger': return (r.hungry || 0) >= 1;
    case 'safety': return feel(r, 'fear', c.now) >= 0.2 && recall(r, c.day, (m) => ['raid', 'robbed', 'killed', 'eruption', 'riot'].includes(m.k) && c.day - m.d < 12, 0.12).length > 0;
    case 'mayor': return !!c.mayor && r !== c.mayor && (opinionOf(r, nk(c.mayor)) <= -0.25 || ((r.mood ?? 0.5) < 0.35 && feel(r, 'anger', c.now) >= 0.3));
    case 'player': return opinionOf(r, x) <= -0.15 && recall(r, c.day, (m) => m.w === x && (PLAYER_WRONGS.has(m.k) || m.v <= -0.4), 0.12).length > 0;
    case 'vigil': return feel(r, 'grief', c.now) >= 0.3 && recall(r, c.day, (m) => m.k === 'loss' && m.n === x && c.day - m.d <= 2, 0.1).length > 0;
    case 'joy': return feel(r, 'joy', c.now) >= 0.5;
    default: return false;
  }
}

// How much others would follow `r`.
function leadScore(c, r) {
  const p = P(r);
  return skillOf(r, 'leadership') * 0.5 + skillOf(r, 'charm') * 0.2 + p.sociability * 0.2 + p.bravery * 0.15 + Math.max(feel(r, 'anger', c.now), feel(r, 'pride', c.now)) * 0.2 + (has(r, 'proud') ? 0.05 : 0);
}

// What each cause could be about today (with its particular, if any).
function prospects(c) {
  const out = [['tax', null], ['hunger', null], ['safety', null], ['mayor', null], ['joy', null]];
  // (A grudge against someone playing: whoever's spoken of worst.)
  const pks = new Map();
  for (const r of c.adults) for (const [k, v] of Object.entries(r.op || {})) if (k.startsWith('p:') && v <= -0.15) pks.set(k, (pks.get(k) || 0) + 1);
  for (const [k, n] of pks) if (n >= 3) out.push(['player', k]);
  // (A death mourned by many.)
  const dead = new Map();
  for (const r of c.adults) for (const m of r.mem || []) if (m.k === 'loss' && m.n && c.day - m.d <= 2) dead.set(m.n, (dead.get(m.n) || 0) + 1);
  for (const [n, k] of dead) if (k >= 3) out.push(['vigil', n]);
  return out;
}

// ------------------------------------------------------------ each day
export function groupsDay(c) {
  const e = c.L.econ;
  const live = (e.groups ||= []).filter((g) => !g.out);
  for (const g of live) step(c, g);
  // (The finished ones kept a little while, for talk.)
  e.groups = e.groups.filter((g) => !g.out || c.day - g.out.day < 12).slice(-8);
  if (live.filter((g) => !g.out).length >= MAX_GROUPS || c.adults.length < 4) return;
  const need = Math.max(4, Math.ceil(c.adults.length * 0.22));
  // (One complaint at a time: a town's angry about one thing before the next.)
  const complaining = e.groups.some((g) => !g.out && CAUSES[g.k].complaint);
  for (const [k, x] of prospects(c)) {
    if (CAUSES[k].complaint && complaining) continue;
    if (e.groups.some((g) => !g.out && g.k === k && (g.x ?? null) === x)) continue;
    if (e.groups.some((g) => g.k === k && g.out && c.day - g.out.day < (CAUSES[k].complaint ? 12 : 4) && (g.x ?? null) === x)) continue;
    const mem = c.adults.filter((r) => shares(c, r, k, x));
    if (mem.length < (k === 'vigil' ? 3 : need)) continue;
    // Somebody has to lead it.
    let lead = null;
    let best = -1;
    for (const r of mem) {
      const v = leadScore(c, r);
      if (v > best) {
        best = v;
        lead = r;
      }
    }
    if (!lead || (CAUSES[k].complaint && best < 0.4)) continue;
    form(c, k, x, lead, mem);
    if (e.groups.filter((g) => !g.out).length >= MAX_GROUPS) break;
  }
}

function form(c, k, x, lead, mem) {
  const e = c.L.econ;
  e.groupSeq = (e.groupSeq || 0) + 1;
  // (A night out is for a few friends, not the whole town.)
  if (k === 'joy') mem = [lead, ...mem.filter((r) => r !== lead).sort((a, b) => feel(b, 'joy', c.now) - feel(a, 'joy', c.now)).slice(0, 9)];
  const g = { id: e.groupSeq, k, x: x ?? null, lead: lead.idx, ln: nameOf(lead), mem: mem.map((r) => r.idx), heat: 0.3, st: k === 'vigil' ? 'vigil' : k === 'joy' ? 'gathering' : k === 'player' ? 'shun' : 'grumble', d: c.day, sd: c.day, sup: [] };
  e.groups.push(g);
  if (CAUSES[k].complaint || k === 'player') for (const r of mem) remember(r, { k: 'joined', x: k, w: nk(lead), n: lead.name.first, v: 0.2, s: 0.25 }, c.day);
  if (k === 'vigil' || k === 'joy') gatherTonight(c, g, mem);
  return g;
}

// Tonight, together: at the temple (a vigil) or the tavern (good news).
function gatherTonight(c, g, mem) {
  const temple = c.L.buildings.find((b) => b.type === 'temple' && !b.underConstruction);
  const tavern = c.L.buildings.find((b) => b.type === 'tavern' && !b.underConstruction);
  for (const r of mem) {
    if (r.override || r.trip || r.hired) continue;
    const slot = freeSlot(r, c.day, 18 * 60, 120);
    if (!slot) continue;
    if (g.k === 'vigil' && temple) setOverride(r, slot.s, slot.e, 'pray', { place: 'temple', target: temple.inside, feel: 'grief', grp: g.id });
    else if (g.k === 'vigil') setOverride(r, slot.s, slot.e, 'rally', { place: 'plaza', grp: g.id, feel: 'grief' });
    else if (tavern) setOverride(r, slot.s, slot.e, 'social', { place: 'tavern', feel: 'joy', grp: g.id });
  }
}

// Evenings in the square.
function rallyTonight(c, g, mem) {
  for (const r of mem) {
    if (r.override || r.trip || r.hired || r.job === 'guard') continue;
    const slot = freeSlot(r, c.day, 17 * 60, 120);
    if (slot) setOverride(r, slot.s, slot.e, 'rally', { place: 'plaza', grp: g.id, feel: 'anger' });
  }
}

function step(c, g) {
  const L = c.L;
  const lead = L.npcs[g.lead];
  // Who's still of a mind with them (and who's come round to it).
  const was = new Set(g.mem);
  const mem = g.k === 'joy' || g.k === 'vigil' ? c.adults.filter((r) => was.has(r.idx)) : c.adults.filter((r) => shares(c, r, g.k, g.x) || (was.has(r.idx) && feel(r, 'anger', c.now) >= 0.35));
  g.mem = mem.map((r) => r.idx);
  if (g.k === 'vigil' || g.k === 'joy') return finishGathering(c, g, mem);
  if (!lead || !alive(lead) || lead.away || lead.migrated || !g.mem.includes(lead.idx)) {
    // (Someone else takes it up, or it falls apart.)
    const next = mem.slice().sort((a, b) => leadScore(c, b) - leadScore(c, a))[0];
    if (!next || mem.length < 3) return close(c, g, 'faded');
    g.lead = next.idx;
    g.ln = nameOf(next);
  }
  if (mem.length < 2) return close(c, g, 'faded');
  let anger = 0;
  for (const r of mem) anger += feel(r, 'anger', c.now);
  anger /= mem.length;
  const share = mem.length / Math.max(1, c.adults.length);
  g.heat = clamp(g.heat * 0.8 + share * 0.7 + anger * 0.35 + g.sup.length * 0.05, 0, 1.6);
  if (g.heat < 0.2 && c.day - g.d > 3) return close(c, g, 'faded');
  // A grudge against someone playing.
  if (g.k === 'player') return grudgeStep(c, g, mem);
  const days = c.day - g.sd;
  const go = (st) => {
    g.st = st;
    g.sd = c.day;
  };
  switch (g.st) {
    case 'grumble':
      if (days >= 3 && g.heat >= 0.6) {
        go('petition');
        ledger(L, c.day, `${g.ln} and ${mem.length - 1} others have put a petition to ${c.governed ? 'the council' : c.mayor ? `${nameOf(c.mayor)}` : 'the council'}: ${CAUSES[g.k].ask}.`);
      }
      return null;
    case 'petition':
      if (c.governed) {
        // (Before the council: see agenda.js. Left too long, it's taken as
        // a no.)
        if (days >= 4) return refused(c, g, mem);
        return null;
      }
      if (days >= 1) return decide(c, g, mem, 0);
      return null;
    case 'protest':
      rallyTonight(c, g, mem);
      for (const r of mem) stir(r, 'anger', 0.05, c.now);
      if (days >= 2) return c.governed ? (days >= 4 ? refused(c, g, mem) : null) : decide(c, g, mem, 0.15);
      return null;
    case 'militia':
      // Drilling of an evening; the able join the watch.
      for (const r of mem) if (r.job !== 'guard') practise(L, r, 'combat', 0.008);
      rallyTonight(c, g, mem.filter((r) => P(r).bravery > 0.5));
      if (days >= 5) {
        const volunteer = mem.filter((r) => r.job !== 'guard' && r.job !== 'mayor' && P(r).bravery > 0.55).sort((a, b) => skillOf(b, 'combat') - skillOf(a, 'combat'))[0];
        if (volunteer && c.guards < guardsWanted(L, c.ppl.length) + 1) {
          retrain(L, volunteer, 'guard', new RNG(hash4(volunteer.idx, c.day, 0x3111)));
          ledger(L, c.day, `${nameOf(volunteer)}, who drilled with the others after the raid, has joined the watch.`);
        }
        return close(c, g, 'drilled');
      }
      return null;
    case 'share':
      // Neighbours sharing what they have.
      shareOut(c, g, mem);
      if (days >= 2) return decide(c, g, mem, 0.2);
      return null;
    case 'strike':
      // (Tools down: see Mind.canWork.)
      for (const r of mem) r.strike = c.day + 1;
      if (days >= 2) return c.governed ? (days >= 3 ? refused(c, g, mem) : null) : decide(c, g, mem, 0.3);
      return null;
    case 'riot':
      return exodus(c, g, mem);
    default:
      return null;
  }
}

// The mayor's answer (one of the town's own: see agenda.js for yours).
function decide(c, g, mem, more) {
  const m = c.mayor;
  const share = mem.length / Math.max(1, c.adults.length);
  const kind = m ? P(m).kindness : 0.5;
  const mood = m ? (m.mood ?? 0.5) : 0.5;
  let p = 0.15 + kind * 0.35 + share * 0.6 + more + g.sup.length * 0.12 + (mood - 0.5) * 0.2;
  if (g.k === 'tax' && (c.L.econ.treasury || 0) < 60) p -= 0.2;
  if (g.k === 'hunger' && (c.L.econ.treasury || 0) < 20) p -= 0.3;
  if (g.k === 'mayor') p -= 0.25;
  if (c.rng.chance(clamp(p, 0.05, 0.9))) return granted(c, g, mem, m ? nameOf(m) : 'The council');
  return refused(c, g, mem);
}

// What they asked for, given.
export function granted(c, g, mem, who) {
  const L = c.L;
  const e = L.econ;
  let did = '';
  if (g.k === 'tax') {
    e.tax = Math.max(0.02, Math.round(((e.tax || 0) - 0.02) * 100) / 100);
    did = `taxes lowered to ${Math.round(e.tax * 100)}%`;
  } else if (g.k === 'hunger') {
    const r = feedHungry(L, c.day, who, true);
    did = r.fed ? `¤${r.spent} spent feeding ${r.fed} hungry` : 'bread promised';
  } else if (g.k === 'safety') {
    const v = mem.filter((r) => r.job !== 'guard' && r.job !== 'mayor' && P(r).bravery > 0.45).sort((a, b) => skillOf(b, 'combat') - skillOf(a, 'combat'))[0];
    if (v) {
      retrain(L, v, 'guard', new RNG(hash4(v.idx, c.day, 0x5a7e)));
      did = `${nameOf(v)} taken on as a guard`;
    } else did = 'the watch doubled at night';
  } else if (g.k === 'mayor') {
    // (The mayor won't step down: but there'll be an election.)
    const lead = L.npcs[g.lead];
    if (lead && !lead.amb) lead.amb = { k: 'office', d: c.day, p: 0.7, st: 0 };
    did = 'an election called';
  }
  for (const r of mem) {
    stir(r, 'joy', 0.3, c.now);
    stir(r, 'anger', -0.4, c.now);
    stir(r, 'strain', -0.15, c.now);
    remember(r, { k: 'petition_won', x: g.k, v: 0.7, s: 0.5 }, c.day);
    if (c.mayor) warm(r, nk(c.mayor), 0.12);
  }
  const lead = L.npcs[g.lead];
  if (lead) stir(lead, 'pride', 0.4, c.now);
  ledger(L, c.day, `${who} heard ${g.ln} and the others out: ${did}.`);
  return close(c, g, 'won');
}

// Refused: and what comes next.
export function refused(c, g, mem) {
  for (const r of mem) {
    stir(r, 'anger', 0.2 + P(r).temper * 0.15, c.now);
    if (c.mayor) warm(r, nk(c.mayor), -0.1);
  }
  g.heat = Math.min(1.6, g.heat + 0.2);
  const lead = c.L.npcs[g.lead];
  const hot = lead && (P(lead).temper > 0.6 || has(lead, 'hot-headed'));
  const next = {
    petition: g.k === 'safety' ? 'militia' : g.k === 'hunger' ? 'share' : 'protest',
    protest: g.heat >= 0.85 && g.k !== 'safety' ? 'strike' : 'leave',
    share: 'strike',
    strike: hot && g.heat >= 1.05 ? 'riot' : 'leave',
  }[g.st] || 'leave';
  if (next === 'leave') return exodus(c, g, mem);
  g.st = next;
  g.sd = c.day;
  const L = c.L;
  if (next === 'protest') ledger(L, c.day, `The petition was refused. ${g.ln} and the others have taken to the square of an evening, shouting for ${CAUSES[g.k].ask}.`);
  else if (next === 'strike') {
    for (const r of mem) r.strike = c.day + 1;
    ledger(L, c.day, `${g.ln} and ${mem.length - 1} others have downed tools: no work till they're heard.`);
  }
  else if (next === 'militia') ledger(L, c.day, `Refused more guards, ${g.ln} has the brave of ${L.settlement.name} drilling in the square of an evening.`);
  else if (next === 'share') ledger(L, c.day, `With no help from the hall, ${g.ln} has neighbours sharing what bread they have.`);
  else if (next === 'riot') riot(c, g, mem);
  return next;
}

function riot(c, g, mem) {
  const L = c.L;
  const e = L.econ;
  const loss = Math.min(Math.round((e.treasury || 0) * 0.15), 40);
  e.treasury = Math.max(0, (e.treasury || 0) - loss);
  e.riotDay = c.day;
  for (const r of c.ppl) {
    r.mood = clamp((r.mood ?? 0.5) - 0.05, 0, 1);
    if (!mem.includes(r)) stir(r, 'fear', 0.2 * (1.1 - P(r).bravery), c.now);
  }
  ledger(L, c.day, `A crowd led by ${g.ln} broke windows at the hall in ${L.settlement.name}; the council paid out ¤${loss} to calm them.`);
  c.M.sim.saga?.emit('riot', { sid: L.settlement.id });
}

// Some of them go: to a town run better, or (led by one able enough, and
// enough of them) out to found a village of their own.
function exodus(c, g, mem) {
  const L = c.L;
  const lead = L.npcs[g.lead];
  const leaving = mem.filter((r) => r.job !== 'mayor' && r.job !== 'guard' && r.ruler === undefined && r.councillor === undefined && r.soldier === undefined && r.captive === undefined && feel(r, 'anger', c.now) + feel(r, 'strain', c.now) >= 0.35);
  if (leaving.length < 2) return close(c, g, 'gave up');
  const F = c.M.sim.founding;
  const homes = new Set(leaving.map((r) => r.household));
  const fams = c.ppl.filter((r) => homes.has(r.household) && r.job !== 'mayor' && r.job !== 'guard' && r.ruler === undefined && r.captive === undefined && r.soldier === undefined && r.councillor === undefined);
  if (lead && skillOf(lead, 'leadership') >= 0.45 && fams.filter((r) => r.age === 'adult').length >= 3 && F && !F.parties.some((p) => !p.done) && F.made.filter((m) => !m.haven).length < 4 && c.ppl.length - fams.length >= 8) {
    const why = `${nameOf(lead)} leads them: "We'll make a place where ${CAUSES[g.k].ask} isn't too much to ask."`;
    const party = F.found(L, c.day, new RNG(hash4(L.settlement.seed | 0, c.day, 0xf0e)), { head: nameOf(lead), name: nameOf(lead), why }, fams.slice(0, 8));
    if (party) return close(c, g, 'founded');
  }
  const T = c.M.betterTown(L);
  if (!T) return close(c, g, 'gave up');
  const fam = fams.slice(0, 6);
  c.M.move(L, fam, T, `tired of ${CAUSES[g.k].what} in ${L.settlement.name}`);
  ledger(L, c.day, `${fam.length} of those who stood with ${g.ln} have left ${L.settlement.name} for ${T.settlement.name}, tired of ${CAUSES[g.k].what}.`);
  return close(c, g, 'left');
}

// Neighbours sharing: the better-off and the kind give to the hungriest.
function shareOut(c, g, mem) {
  const givers = c.adults.filter((r) => (r.coins || 0) > 30 && P(r).kindness > 0.5 && !mem.includes(r));
  for (const r of mem) {
    if ((r.hungry || 0) < 1 || !givers.length) continue;
    const q = givers[c.rng.int(0, givers.length - 1)];
    const n = Math.min(6, Math.floor((q.coins || 0) / 8));
    if (n <= 0) continue;
    q.coins -= n;
    r.coins = (r.coins || 0) + n;
    warm(r, nk(q), 0.2);
    remember(r, { k: 'helped', w: nk(q), n: q.name.first, v: 0.7, s: 0.45 }, c.day);
  }
}

// A grudge against someone playing: cold shoulders, then the one who leads
// it will have it out with them.
function grudgeStep(c, g, mem) {
  const days = c.day - g.sd;
  if (g.st === 'shun' && days >= 2) {
    g.st = 'confront';
    g.sd = c.day;
    const lead = c.L.npcs[g.lead];
    if (lead && !lead.seek) lead.seek = { pk: g.x, k: 'group', g: g.id, d: c.day };
  }
  if (c.day - g.d > 18) return close(c, g, 'faded');
  return null;
}

function finishGathering(c, g, mem) {
  if (c.day - g.d < 1) return null;
  for (const r of mem) {
    if (g.k === 'vigil') {
      stir(r, 'grief', -0.1, c.now);
      stir(r, 'love', 0.1, c.now);
      remember(r, { k: 'vigil', n: g.x, v: 0.4, s: 0.4 }, c.day);
    } else {
      stir(r, 'joy', 0.1, c.now);
      stir(r, 'strain', -0.2, c.now);
    }
  }
  // (Together, they think the better of each other.)
  for (let i = 0; i + 1 < mem.length && i < 8; i++) {
    warm(mem[i], nk(mem[i + 1]), 0.05);
    warm(mem[i + 1], nk(mem[i]), 0.05);
  }
  return close(c, g, g.k === 'vigil' ? 'mourned' : 'celebrated');
}

export function close(c, g, how) {
  g.out = { how, day: c.day };
  if (g.k === 'player') {
    const lead = c.L.npcs[g.lead];
    if (lead && lead.seek && lead.seek.g === g.id) lead.seek = null;
  }
  return how;
}

// Settled, by someone playing (see game/social.js): they've made it right.
export function settleGrudge(L, g, day, how) {
  g.out = { how, day };
  const lead = L.npcs[g.lead];
  if (lead && lead.seek && lead.seek.g === g.id) lead.seek = null;
}

// The matters before a council a player governs (see agenda.matters).
export function groupMatters(L) {
  const out = [];
  for (const g of groupsOf(L)) {
    if (g.out || !CAUSES[g.k].complaint || !['petition', 'protest', 'strike'].includes(g.st)) continue;
    const n = g.mem.length;
    const fx = g.k === 'tax' ? { tax: Math.max(0.02, Math.round(((L.econ.tax || 0) - 0.02) * 100) / 100) } : g.k === 'hunger' ? { relief: true } : {};
    out.push({
      key: `group:${g.id}`, kind: 'group', prio: g.st === 'strike' ? 9 : g.st === 'protest' ? 7 : 6, title: g.st === 'strike' ? `${g.ln} and the others have downed tools` : `${g.ln} and ${n - 1} others petition the council`,
      why: [`They ask for ${CAUSES[g.k].ask}.`, g.st === 'protest' ? 'They\'ve been in the square every evening.' : g.st === 'strike' ? 'No work will be done until they\'re heard.' : 'Refuse them, and it may grow.'],
      opts: [
        { label: `Grant it (${CAUSES[g.k].ask})`, fx: { ...fx, act: 'mind_group', group: g.id, yes: true }, sense: 0.4 },
        { label: 'Refuse', fx: { act: 'mind_group', group: g.id, yes: false }, trivial: true },
      ],
    });
  }
  return out;
}
