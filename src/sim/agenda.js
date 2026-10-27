// (Round 121) What comes before a town's council, when it's yours to govern
// (see office.js). Every morning at ten the council sits: what you decided
// since the last sitting is carried out, and the day's matters are tabled.
// They come from what's actually going on in the town, the same things its
// own mayor would have weighed: thin coffers or money to spare, a law the
// town is pressing for (and why: fights in the street, trouble at night,
// poachers), the hungry, a spate of thefts or long calm, a building the
// town lacks, a decree of the realm the town's rate falls short of; and,
// now and then, a crisis that can't wait for the morning (raiders, a fever,
// famine, a crowd at the hall, a scandal, the realm's patience run out).
//   Each matter has its choices, and each choice says what it will do: to
// the treasury, and to each faction's view of you (worked out from the
// factions' own reckoning: see factions.js). What isn't decided by the next
// sitting is left to your steward, who decides by your standing orders.
import { alive, ledger, kitchenOf, hasMaterials, MATERIALS, stockOf, invAdd, invTake, st, DAY } from './econ.js';
import { LAWS, LAW_IDS, lawFits, byDecree, support, stance } from './laws.js';
import { FACTIONS, FACTION_IDS, BUDGET, members, factionOf, preview } from './factions.js';
import { CHARTERS, headTitle } from './charters.js';
import { authority } from './realms.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { groupMatters } from './mind/groups.js';

export const SESSION = 600; // ten in the morning
export const MAX_OPEN = 4; // matters tabled at once (crises aside)
export const WORKS_COST = { tavern: 180, smithy: 150, bakery: 120, workshop: 120, shop: 140, library: 160, temple: 220, guardhouse: 120, stables: 120, warehouse: 100, tailor: 110, herbalist: 100 };
const WORKS_WHY = {
  tavern: 'There\'s nowhere in town to eat out, drink or take a room.',
  smithy: 'There\'s no smith: no tools mended, no blades or armour made here.',
  bakery: 'A city this size has no bakery: bread comes only from passing traders.',
  shop: 'There\'s no market hall: the town\'s traders sell from their doorsteps.',
  library: 'There are no books to be had, and nowhere for scholars to work.',
  temple: 'There\'s no temple: nowhere to pray, marry or bury the dead properly.',
  guardhouse: 'The watch has no guardhouse to keep its arms in.',
  stables: 'There are no stables: no horses to be had or kept.',
  warehouse: 'There\'s no warehouse: the town\'s stores are kept where they can be.',
  tailor: 'There\'s no tailor in town.',
  herbalist: 'There\'s no herbalist: nobody to make salves or tend fevers.',
  workshop: 'There\'s no carpenter\'s workshop.',
};

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const pc = (v) => `${Math.round(v * 100)}%`;
const r2 = (v) => Math.round(v * 100) / 100;
const n = (k, w) => (w === 'townsperson' ? `${k} ${k === 1 ? 'townsperson' : 'townsfolk'}` : `${k} ${w}${k === 1 ? '' : 's'}`);
const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
export const full = (r) => (r && r.name ? (typeof r.name === 'string' ? r.name : `${r.name.first} ${r.name.last}`) : 'someone');

// The next sitting after `abs`.
export function nextSession(abs) {
  const d = Math.floor(abs / DAY);
  return abs % DAY < SESSION ? d * DAY + SESSION : (d + 1) * DAY + SESSION;
}

// Who speaks for the town in its ledger: "Mayor Wren Ashby".
export function whoOf(L, T) {
  return T && T.holder ? `${headTitle(T.charter, L.settlement, T.holder && T.holder.style)} ${T.holder.name}` : 'The council';
}

// What the town's sums look like: people, reserve, the realm's least tax,
// the charter's cap.
export function sums(sim, L, T) {
  const s = L.settlement;
  const living = residents(L);
  const pop = living.length + (sim ? sim.playerCount(s.id) : 0);
  const guards = living.filter((r) => r.job === 'guard').length + (sim ? sim.playerGuard(s.id) : 0);
  return {
    pop,
    guards,
    reserve: pop * 8 + guards * 15,
    floor: sim && sim.realms ? sim.realms.taxFloor(s) : 0,
    cap: (T && CHARTERS[T.charter] && CHARTERS[T.charter].taxCap) || 0.3,
    hungry: living.filter((r) => (r.hungry || 0) >= 1),
    living,
  };
}

// Why a law is being pressed for, in the town's own terms.
function lawWhy(L, id, on) {
  const r = L.econ.recent;
  const out = [];
  const pop = residents(L).length;
  switch (id) {
    case 'armsBan': if (r.violence) out.push(`${n(r.violence, 'fight')} or brawl${r.violence === 1 ? '' : 's'} lately.`); break;
    case 'curfew': if ((r.night || 0) + (r.raids || 0)) out.push(`${n(r.night || 0, 'night-time trouble')}, ${n(r.raids || 0, 'raid')} lately.`); break;
    case 'lanternLaw': if (r.night) out.push(`${n(r.night, 'night-time trouble')} lately.`); break;
    case 'tariff': case 'catchShare': case 'raftDues': out.push(L.econ.treasury < pop * 10 ? `The treasury is low (¤${Math.floor(L.econ.treasury)}).` : `The treasury is comfortable (¤${Math.floor(L.econ.treasury)}).`); break;
    case 'openMarket': out.push(L.econ.treasury > pop * 45 ? `The treasury has plenty (¤${Math.floor(L.econ.treasury)}): market dues aren't needed.` : `The treasury holds ¤${Math.floor(L.econ.treasury)}.`); break;
    case 'poaching': if (r.poached) out.push(`${n(r.poached, 'beast')} poached near town lately.`); break;
    case 'felling': if (r.felled) out.push(`${n(r.felled, 'tree')} felled in town lately.`); break;
    case 'horseLaw': if (r.riding) out.push(`${n(r.riding, 'rider')} through the streets lately.`); break;
    case 'sporeLaw': if (r.picked) out.push(`${n(r.picked, 'mushroom')} picked in town lately.`); break;
    default: break;
  }
  void on;
  return out;
}

// The share of the town's grown-ups who'd back a change to a law.
export function forChange(L, id, enact) {
  const people = residents(L).filter((r) => r.age !== 'child');
  if (!people.length) return 0;
  return people.filter((r) => stance(r, id) * (enact ? 1 : -1) > 0).length / people.length;
}

// The faction keenest on something (by members' average stance).
function keenest(L, id, enact) {
  const M = members(L);
  let best = null;
  for (const f of FACTION_IDS) {
    if (M[f].length < 2) continue;
    const v = M[f].reduce((a, r) => a + stance(r, id), 0) / M[f].length * (enact ? 1 : -1);
    if (!best || v > best.v) best = { f, v };
  }
  return best && best.v > 0.15 ? best.f : null;
}

// ------------------------------------------------------------ tabling
// The day's matters, from the town as it stands: specs (see office.table).
export function matters(sim, L, T, day) {
  const e = L.econ;
  const s = L.settlement;
  const out = [];
  const S = sums(sim, L, T);
  const budget = T.budget;
  // --- Taxes.
  const tax = e.tax;
  if (e.treasury < S.reserve && tax < S.cap - 1e-9) {
    const up = (k) => r2(Math.min(S.cap, tax + k));
    // (How badly it's needed: what a sensible councillor weighs.)
    const sense = clamp((S.reserve - e.treasury) / Math.max(1, S.reserve), 0, 1) * 0.8;
    out.push({
      key: 'tax', kind: 'tax', prio: 7, title: 'The coffers are thin: raise taxes?',
      why: [`The treasury holds ¤${Math.floor(e.treasury)}; the town should keep ¤${S.reserve} in hand to pay its wages and feed its hungry.`, `Taxes are ${pc(tax)}. Yesterday they brought in ¤${e.taxY || 0}.`],
      opts: [
        { label: `Raise them to ${pc(up(0.02))}`, fx: { tax: up(0.02) }, sense },
        ...(up(0.04) > up(0.02) ? [{ label: `Raise them to ${pc(up(0.04))}`, fx: { tax: up(0.04) }, sense: sense * 0.8 }] : []),
        { label: 'Leave them as they are', fx: {}, trivial: true },
      ],
      order: { tax: { balance: 0, hold: -1, low: -1 } },
    });
  } else if (e.treasury > S.pop * 35 && tax > 0.04 && tax - 0.02 >= S.floor - 1e-9) {
    const dn = (k) => r2(Math.max(0.02, S.floor, tax - k));
    out.push({
      key: 'tax', kind: 'tax', prio: 5, title: 'Money to spare: lower taxes?',
      why: [`The treasury holds ¤${Math.floor(e.treasury)}, well beyond the ¤${S.reserve} the town needs in hand.`, `Taxes are ${pc(tax)}.${S.floor ? ` (The realm allows no less than ${pc(S.floor)}.)` : ''}`],
      opts: [
        { label: `Lower them to ${pc(dn(0.02))}`, fx: { tax: dn(0.02) } },
        ...(dn(0.04) < dn(0.02) ? [{ label: `Lower them to ${pc(dn(0.04))}`, fx: { tax: dn(0.04) } }] : []),
        { label: 'Leave them as they are', fx: {}, trivial: true },
      ],
      order: { tax: { balance: 0, low: 0, hold: -1 } },
    });
  }
  // --- The realm's least tax, which the town's rate falls short of.
  if (S.floor > tax + 1e-9 && !(T.defy && T.defy.taxFloor !== undefined)) {
    const civ = s.civ;
    out.push({
      key: 'decree:taxFloor', kind: 'decree', prio: 9, by: 'realm', title: `${cap1(authority(civ))} decrees a least tax of ${pc(S.floor)}`,
      why: [`${s.name} taxes at ${pc(tax)}, under what every town of the ${civ.name.replace(/^The /, '')} must raise.`, 'Defy it and the realm will answer: a fine first, and worse if it goes on.'],
      opts: [
        { label: `Comply: taxes to ${pc(S.floor)}`, fx: { tax: S.floor, favour: { elders: 2, merchants: -2 } }, sense: 0.5 },
        { label: 'Defy the decree', fx: { defy: 'taxFloor', favour: { merchants: 3, poor: 2, elders: -3, guards: -1 } } },
      ],
      order: { realm: { comply: 0, defy: 1 } },
    });
  }
  // --- A law the town is pressing for.
  const laws = [];
  for (const id of LAW_IDS) {
    if (!lawFits(s, id) || byDecree(L, id)) continue;
    const law = LAWS[id];
    const on = !!(e.laws || {})[id];
    const want = support(L, id) * 0.6 + law.pressure(e, L);
    const score = on ? -want : want;
    if (score > (on ? 0.3 : 0.4)) laws.push({ id, on, score });
  }
  laws.sort((a, b) => b.score - a.score);
  for (const q of laws.slice(0, laws.length > 1 && laws[1].score > 0.6 ? 2 : 1)) {
    const law = LAWS[q.id];
    const by = keenest(L, q.id, !q.on);
    const share = forChange(L, q.id, !q.on);
    out.push({
      key: `law:${q.id}`, kind: 'law', prio: 5 + q.score * 3, by, title: q.on ? `Throw out the ${law.name.toLowerCase()}?` : `Pass ${an(law.name.toLowerCase())}?`,
      why: [...lawWhy(L, q.id, q.on), q.on ? `It says: ${law.desc}` : law.desc, `${pc(share)} of the town would back it${by ? `; the ${FACTIONS[by].name.toLowerCase()} most of all` : ''}.`],
      opts: [
        { label: q.on ? 'Throw it out' : 'Pass it', fx: { law: { id: q.id, on: !q.on } }, sense: clamp((share - 0.4) * 1.2 + q.score * 0.3, -0.3, 0.6) },
        { label: 'Not now', fx: by ? { favour: { [by]: -3 } } : {}, trivial: true },
      ],
      order: { laws: { people: 0, leave: 1 } },
    });
  }
  // --- The hungry (fed of course, unless relief's been cut).
  if (budget.relief === 0 && (S.hungry.length >= Math.max(2, S.pop * 0.12) || S.hungry.some((r) => r.hungry >= 2)) && e.treasury > 25) {
    out.push({
      key: 'relief', kind: 'relief', prio: 8, by: 'poor', title: `${n(S.hungry.length, 'townsperson')} going hungry`,
      why: [`Relief has been cut, and ${S.hungry.filter((r) => r.hungry >= 2).length || 'some'} of them have gone two days without.`, `Feeding them costs ¤4 each (¤${S.hungry.length * 4}).`],
      opts: [
        { label: `Feed them (¤${S.hungry.length * 4})`, fx: { relief: true, favour: { poor: 4, clergy: 2 } }, sense: 0.4 },
        { label: 'Leave them be', fx: { favour: { poor: -4, clergy: -2 } }, trivial: true },
      ],
      order: { relief: { feed: 0, none: 1 } },
    });
  }
  // --- Fines (unless there's a magistrate to see to them).
  if (!T.offices.magistrate) {
    if ((e.recent.thefts || 0) >= 2 && e.fineScale < 1.6) {
      out.push({
        key: 'fines', kind: 'fines', prio: 4, by: 'merchants', title: 'A spate of thefts: raise the fines?',
        why: [`${n(e.recent.thefts, 'theft')} lately. Fines stand at ×${e.fineScale}.`],
        opts: [
          { label: 'Raise them by a quarter', fx: { fines: r2(Math.min(1.6, e.fineScale * 1.25)), favour: { merchants: 2, poor: -2 } }, sense: 0.25 },
          { label: 'Leave them', fx: {}, trivial: true },
        ],
        order: { justice: { stern: 0, mild: 1 } },
      });
    } else if ((e.recent.calm || 0) >= 6 && e.fineScale > 1) {
      out.push({
        key: 'fines', kind: 'fines', prio: 3, by: 'poor', title: 'The streets are calm: ease the fines?',
        why: [`No trouble for ${e.recent.calm} days. Fines stand at ×${e.fineScale}.`],
        opts: [
          { label: 'Ease them', fx: { fines: r2(Math.max(1, e.fineScale * 0.85)), favour: { poor: 2 } } },
          { label: 'Keep them', fx: {}, trivial: true },
        ],
        order: { justice: { stern: 1, mild: 0 } },
      });
    }
  }
  // --- A feast day (when the budget has them only when the town's flush).
  if (budget.fetes === 1 && e.treasury > S.pop * 50 && day - (e.festival ?? -99) > 5 && !(sim && sim.events.upcoming(L).length)) {
    const spend = Math.round(e.treasury * 0.15);
    out.push({
      key: 'feast', kind: 'feast', prio: 3, title: 'Money to spare: a feast day?',
      why: [`The treasury holds ¤${Math.floor(e.treasury)}. A feast in the square would cost ¤${spend}, and cheer everyone who goes.`],
      opts: [
        { label: `Hold one (¤${spend})`, fx: { feast: spend, favour: { poor: 2, farmers: 1, crafters: 1 } } },
        { label: 'Save the money', fx: {}, trivial: true },
      ],
      order: { feasts: { flush: 0, never: 1 } },
    });
  }
  // --- (Round 147) A grand day at one of the town's great places, on the
  // town's purse (when the budget runs to feasts and there's money).
  const gala = budget.fetes === 1 && sim && sim.cities && e.treasury > S.pop * 40 ? sim.cities.galaFor(L, day) : null;
  if (gala) {
    const spend = Math.round(Math.min(e.treasury * 0.1, 60 + S.pop * 2));
    out.push({
      key: 'gala', kind: 'gala', prio: 3, title: `Pay for ${gala.what} at ${gala.name}?`,
      why: [`${gala.title} is coming up at ${gala.name}. For ¤${spend} the town could make a great day of it: more would come, and go home the happier.`],
      opts: [
        { label: `Pay for it (¤${spend})`, fx: { act: 'quarter_gala', q: gala.i, spend, favour: { poor: 2, merchants: 1 } } },
        { label: 'Leave it be', fx: {}, trivial: true },
      ],
      order: { feasts: { flush: 0, never: 1 } },
    });
  }
  // --- (Round 136) The town's people, come together to ask for something
  // (see mind/groups.js).
  out.push(...groupMatters(L));
  // --- Building what the town lacks.
  if (budget.works >= 1) {
    const w = worksWanted(sim, L, budget.works >= 2);
    if (w) {
      const [wood, stone] = MATERIALS[w] || [15, 10];
      const k = stockOf(L);
      const cost = WORKS_COST[w] || 120;
      const can = e.treasury >= cost && hasMaterials(L, w);
      out.push({
        key: `build:${w}`, kind: 'build', prio: 4, by: 'crafters', title: `Build ${w === 'temple' || w === 'warehouse' ? 'a' : 'a'} ${w === 'shop' ? 'market hall' : w}?`,
        why: [WORKS_WHY[w] || '', `¤${cost} from the treasury, and ${wood} wood and ${stone} stone from the town's stores (it has ${Math.floor(k.wood || 0)} and ${Math.floor(k.stone || 0)}).`, ...(can ? [] : [e.treasury < cost ? 'The treasury can\'t pay for it yet.' : 'The stores are short of materials.'])],
        opts: [
          { label: `Commission it (¤${cost})`, fx: { build: w, cost, favour: { crafters: 3 } }, off: can ? null : 'not yet affordable', sense: 0.3 },
          { label: 'Not yet', fx: {}, trivial: true },
        ],
        order: { works: { needed: can ? 0 : 1, ask: -1 } },
      });
    }
  }
  return out;
}

// What the town would most like built (and has room in its plans for).
export function worksWanted(sim, L, ambitious) {
  const s = L.settlement;
  const people = residents(L);
  const want = [];
  if (people.length >= 12) want.push('tavern');
  if (s.type !== 'village' && (!sim || !sim.tech || sim.tech.allows(s, 'building', 'smithy'))) want.push('smithy');
  if (s.type === 'city') want.push('bakery');
  if (ambitious) {
    if (s.type !== 'village') want.push('shop');
    if (people.length >= 16) want.push('temple');
    if (people.filter((r) => r.job === 'guard').length >= 2) want.push('guardhouse');
    if (s.type !== 'village') want.push('library', 'warehouse');
    want.push('stables');
  }
  if (sim && sim.works.projects.some((p) => !p.done && p.sid === s.id && p.kind === 'build')) return null;
  for (const type of want) {
    if (L.buildings.some((b) => b.type === type)) continue;
    if (sim && sim.roads.waiting(L, 'build', { type })) continue;
    return type;
  }
  return null;
}

// ------------------------------------------------------------ crises
// Something that won't wait for tomorrow's sitting: once a sitting at most,
// and one at a time. A spec, or null.
// (`force`: a kind of crisis to bring on, whatever the odds: see the
// console's "office crisis".)
export function crisisFor(sim, L, T, day, force = null) {
  const e = L.econ;
  const s = L.settlement;
  const S = sums(sim, L, T);
  if (T.agenda.some((q) => q.crisis && q.state === 'open') || day - (T.crisisDay ?? -99) < 3 || S.pop < 6) return null;
  const rng = new RNG(hash4(s.id, day, 0xc215));
  if (force === 'raid') {
    const bands = sim && sim.bandits ? sim.bandits.nearBands(L, 8) : [];
    return raid(sim, L, S, bands[0]);
  }
  if (force === 'fever') return fever(L, S);
  const recent = (kind, d) => (T.crises || {})[kind] !== undefined && day - T.crises[kind] < d;
  // A famine (see hardship.js) comes first.
  if ((e.famineDays || 0) >= 4 && !recent('famine', 8)) return famine(L, S);
  // A crowd at the hall: a riot today, or a protectorate the town has had
  // enough of.
  // (The town's riots come later in its day than the sitting: yesterday's.)
  if (((e.riotDay !== undefined && day - e.riotDay <= 1) || (T.charter === 'autocracy' && (T.unrest || 0) >= 2)) && !recent('unrest', 6)) return unrest(L, T);
  // Raiders: bandits camped near (or no watch at all).
  const bands = sim && sim.bandits ? sim.bandits.nearBands(L, 8) : [];
  if (!recent('raid', 10) && rng.chance(0.02 + (bands.length ? 0.06 : 0) + (S.guards ? 0 : 0.04))) return raid(sim, L, S, bands[0]);
  // A fever.
  if (!recent('fever', 14) && S.pop >= 8 && rng.chance(0.015 + (['swamp', 'jungle'].includes(s.biome) ? 0.015 : 0))) return fever(L, S);
  return null;
}

function raid(sim, L, S, band) {
  const pay = 30 + S.pop;
  const advs = sim && sim.adventurers ? sim.adventurers.here(L.settlement.id) : [];
  const who = band ? (band.name || 'Bandits') : 'Raiders';
  return {
    key: 'crisis:raid', kind: 'crisis', crisis: 'raid', prio: 10, hours: 8, title: `${who} threaten ${L.settlement.name}`,
    why: [band ? `${who} camped near town have sent word: pay ¤${pay}, or they come for it tonight.` : `A band of raiders has been seen on the road, and means to hit the town tonight.`, `The town has ${n(S.guards, 'guard')}.`],
    opts: [
      { label: `Pay them off (¤${pay})`, fx: { spend: pay, act: 'raid_pay', favour: { guards: -3, merchants: -1 } } },
      { label: 'Call out the watch', fx: { act: 'raid_fight' }, note: `chance of seeing them off: ${pc(raidOdds(L, S, false))}` },
      ...(advs.length || L.econ.treasury >= 60 ? [{ label: 'Hire adventurers (¤60)', fx: { spend: 60, act: 'raid_hire' }, note: 'chance: 90%' }] : []),
      { label: 'Bar the doors and wait', fx: { act: 'raid_none' }, trivial: true },
    ],
    order: { crises: { cautious: 0, bold: 1 } },
  };
}

export function raidOdds(L, S, hired) {
  if (hired) return 0.9;
  const militia = !!(L.econ.laws || {}).militia;
  const strength = S.guards + (militia ? S.living.filter((r) => r.age === 'adult').length * 0.2 : 0) + (L.econ.captain !== null && L.econ.captain !== undefined ? L.econ.captainBonus ?? 1 : 0);
  return clamp(0.2 + strength * 0.13, 0.1, 0.95);
}

function famine(L, S) {
  const cost = S.pop * 3;
  return {
    key: 'crisis:famine', kind: 'crisis', crisis: 'famine', prio: 10, hours: 12, by: 'poor', title: `Famine in ${L.settlement.name}`,
    why: [`The stores are bare: ${n(S.hungry.length, 'townsperson')} went to bed hungry last night.`, `Grain bought from the neighbours would cost ¤${cost}.`],
    opts: [
      { label: `Buy grain from the neighbours (¤${cost})`, fx: { spend: cost, act: 'famine_buy', favour: { poor: 6, farmers: 2, clergy: 2 } }, off: L.econ.treasury >= cost ? null : 'the treasury can\'t pay' },
      { label: 'Ration what\'s left', fx: { act: 'famine_ration', favour: { poor: 2, merchants: -2 } } },
      { label: 'Pray for a better harvest', fx: { act: 'famine_pray', favour: { clergy: 3, poor: -3 } } },
      { label: 'Let it run its course', fx: { favour: { poor: -8, clergy: -3, farmers: -2 } }, trivial: true },
    ],
    order: { crises: { cautious: 1, bold: 0 } },
  };
}

function fever(L, S) {
  const herb = S.living.some((r) => r.job === 'herbalist');
  const cost = herb ? 40 : 60;
  return {
    key: 'crisis:fever', kind: 'crisis', crisis: 'fever', prio: 10, hours: 12, title: `A fever in ${L.settlement.name}`,
    why: ['A fever is going round the houses. The old and the young are most at risk.', herb ? 'The herbalist can make enough draughts for everyone, if the treasury pays.' : 'There\'s no herbalist in town: a healer would have to be sent for.'],
    opts: [
      { label: `${herb ? 'Pay the herbalist' : 'Send for a healer'} (¤${cost})`, fx: { spend: cost, act: 'fever_heal', favour: { elders: 3, poor: 2 } }, note: 'no deaths', off: L.econ.treasury >= cost ? null : 'the treasury can\'t pay' },
      { label: 'Shut the sick away', fx: { act: 'fever_quarantine', favour: { merchants: -4 } }, note: 'a 25% chance of a death' },
      { label: 'Pray for them', fx: { act: 'fever_pray', favour: { clergy: 4 } }, note: 'a 50% chance of a death' },
      { label: 'Do nothing', fx: { act: 'fever_none' }, trivial: true, note: 'a 70% chance of deaths' },
    ],
    order: { crises: { cautious: 0, bold: 1 } },
  };
}

function unrest(L, T) {
  const A = T.lastApproval || {};
  let worst = 'poor';
  for (const f of FACTION_IDS) if (A[f] !== undefined && (A[worst] === undefined || A[f] < A[worst])) worst = f;
  return {
    key: 'crisis:unrest', kind: 'crisis', crisis: 'unrest', prio: 10, hours: 6, by: worst, title: 'A crowd at the town hall',
    why: [`An angry crowd has gathered at the hall, the ${FACTIONS[worst].name.toLowerCase()} at its front.`, 'They want to be heard, and they won\'t go home till they are.'],
    opts: [
      { label: 'Hear them out, and promise relief', fx: { act: 'unrest_hear', favour: { [worst]: 6 }, promise: { f: worst, kind: 'relief', days: 7 } }, note: 'a promise: relief kept on for a week' },
      { label: 'Send the watch to break it up', fx: { act: 'unrest_disperse', favour: { guards: 3, poor: -8, farmers: -3 } } },
      { label: 'Buy the ringleaders off (¤40)', fx: { spend: 40, act: 'unrest_buy', favour: { [worst]: 3 } }, note: 'it may get out', off: L.econ.treasury >= 40 ? null : 'the treasury can\'t pay' },
    ],
    order: { crises: { cautious: 0, bold: 1 } },
  };
}

// A scandal: a bribe come to light, a treasurer's books that don't add
// up, a promise broken.
export function scandal(L, T, what, who = null) {
  return {
    key: 'crisis:scandal', kind: 'crisis', crisis: 'scandal', prio: 10, hours: 24, title: 'Scandal',
    why: [what, 'The whole town is talking of it.'],
    opts: [
      { label: 'Own up to it', fx: { act: 'scandal_confess', favour: Object.fromEntries(FACTION_IDS.map((f) => [f, -3])) } },
      { label: 'Deny everything', fx: { act: 'scandal_deny' }, note: 'it may be believed; if not, far worse' },
      ...(who !== null ? [{ label: 'Blame and dismiss them', fx: { act: 'scandal_blame', who } }] : []),
    ],
    order: { crises: { cautious: 0, bold: 1 } },
  };
}

// The realm's patience run out with a town that defies it.
export function ultimatum(L, T, civ) {
  return {
    key: 'crisis:crown', kind: 'crisis', crisis: 'crown', prio: 11, hours: 24, by: 'realm', title: `${cap1(authority(civ))} demands obedience`,
    why: [`A rider has come from the capital: ${L.settlement.name} is to obey the realm's decrees, or its ${headTitle(T.charter, L.settlement, T.holder && T.holder.style).toLowerCase()} will be removed.`, 'Defy it, and only the town itself can keep you: if it stands behind you, it breaks away from the realm.'],
    opts: [
      { label: 'Submit to the realm', fx: { act: 'crown_submit', favour: { elders: 3, merchants: -2 } } },
      { label: 'Pay the realm off (¤100)', fx: { spend: 100, act: 'crown_pay' }, off: L.econ.treasury >= 100 ? null : 'the treasury can\'t pay' },
      { label: 'Defy the realm', fx: { act: 'crown_defy' }, note: 'the town must stand behind you (approval 55 or more)' },
    ],
    order: { crises: { cautious: 0, bold: 0 } },
  };
}

// A protectorate the town has turned against.
export function uprising(L, T) {
  return {
    key: 'crisis:uprising', kind: 'crisis', crisis: 'uprising', prio: 12, hours: 12, title: 'The town rises against you',
    why: [`${L.settlement.name} has had enough of being ruled by decree. The streets are full, and the watch is uneasy.`],
    opts: [
      { label: 'Grant the town a charter (mayor and council)', fx: { act: 'uprising_charter', favour: Object.fromEntries(FACTION_IDS.map((f) => [f, 6])) } },
      { label: 'Crush it', fx: { act: 'uprising_crush', favour: { poor: -10, farmers: -6, crafters: -4 } }, note: 'only if the watch stands with you' },
      { label: 'Step down', fx: { act: 'uprising_yield' } },
    ],
    order: { crises: { cautious: 0, bold: 1 } },
  };
}

const cap1 = (t) => t[0].toUpperCase() + t.slice(1);

// ------------------------------------------------------------ effects
// What a choice would do, said plainly: treasury and taxes, then each
// faction's view. { lines: [{ text, color }], by: { faction: delta } }.
export function stated(sim, L, T, opt, charters, day) {
  const fx = opt.fx || {};
  const e = L.econ;
  const lines = [];
  const over = overOf(L, T, fx);
  const money = [];
  const spend = (fx.spend || 0) + (fx.cost || 0) + (fx.feast || 0);
  if (spend) money.push(`treasury -¤${spend}`);
  if (fx.tax !== undefined && fx.tax !== e.tax) {
    const base = e.tax > 0 ? (e.taxY || 0) / e.tax : 0;
    const d = Math.round(base * (fx.tax - e.tax));
    money.push(`taxes ${pc(fx.tax)}${base ? ` (≈${d >= 0 ? '+' : '-'}¤${Math.abs(d)} a day)` : ''}`);
  }
  if (fx.budget) for (const [k, v] of Object.entries(fx.budget)) money.push(`${BUDGET[k].name.toLowerCase()}: ${BUDGET[k].levels[v].toLowerCase()}`);
  if (fx.wage !== undefined) money.push(`the watch paid ¤${fx.wage} a day`);
  if (fx.law) money.push(`${fx.law.on ? 'passes' : 'throws out'} the ${LAWS[fx.law.id].name.toLowerCase()}`);
  if (fx.fines) money.push(`fines ×${fx.fines}`);
  if (fx.relief) money.push(`¤4 for each of the hungry`);
  if (fx.charter) money.push(`the charter becomes ${charters[fx.charter].name.toLowerCase()}`);
  if (fx.defy) money.push('the realm will not like it');
  if (opt.note) money.push(opt.note);
  if (money.length) lines.push({ text: money.join(' · '), color: '#e8d8a0' });
  const pv = preview(L, T, over, charters, day);
  return { lines, by: pv.by, overall: pv.overall };
}

// A choice as a change to the town's state (for the factions' reckoning).
export function overOf(L, T, fx) {
  const over = {};
  if (fx.tax !== undefined) over.tax = fx.tax;
  if (fx.law) over.laws = { [fx.law.id]: fx.law.on };
  if (fx.budget) over.budget = fx.budget;
  // (Round 125: the watch's pay to the coin, as the factions reckon it.)
  if (fx.wage !== undefined) over.budget = { ...(over.budget || {}), watch: fx.wage < 5 ? 0 : fx.wage < 7 ? 1 : 2 };
  if (fx.charter) over.charter = fx.charter;
  if (fx.favour) over.favour = fx.favour;
  return over;
}

// Feeding the town's hungry from the treasury (as its own mayor does): a
// hot meal from the tavern if it has one, bread if not, ¤4 each.
export function feedHungry(L, day, who, quiet = false) {
  const e = L.econ;
  const hungry = L.npcs.filter((r) => alive(r) && !r.away && (r.hungry || 0) >= 1);
  let spent = 0;
  let fed = 0;
  const k = kitchenOf(L);
  for (const r of hungry) {
    if (e.treasury < 4) break;
    const meal = (k && ['stew', 'gruel', 'cooked_fish', 'cooked_meat'].find((m) => st.take(k.store, m, 1))) || 'bread';
    r.inv ||= [];
    invAdd(r.inv, meal, 1);
    if (r.hungry >= 2) {
      invTake(r.inv, meal, 1);
      r.fed = Math.max(r.fed || 0, 1);
      r.hungry = 1;
    }
    e.treasury -= 4;
    if (k && meal !== 'bread') k.till += 4;
    spent += 4;
    fed++;
  }
  e.feeding = { day, fed, spent };
  if (spent && !quiet) ledger(L, day, `${who} paid ¤${spent} to feed ${fed} hungry ${fed === 1 ? 'person' : 'folk'}.`);
  return { fed, spent };
}

export { FACTIONS, FACTION_IDS, factionOf, DAY };
