// (Round 140) Those staying in a town who aren't its own (a family of
// nomads camped outside, an adventurer between roads, a merchant from
// another town, a stranger off the road), and the head of the town making
// them its citizens: a bed where there's one, work the town is short of,
// and their names in its ledger. (Folk out on a day's trip from their own
// town aren't asked: they're going home tonight.)
import { ledger } from './econ.js';
import { visitorRecord } from '../entities/npcgen.js';
import { RNG, hash4 } from '../util/rng.js';

const fullName = (n) => `${n.first} ${n.last}`;

// Who's here that the town could take in: [{ key, kind, name, n, what }].
export function newcomers(sim, L) {
  const sid = L.settlement.id;
  const now = sim.abs;
  const out = [];
  for (const b of sim.nomads.bands) {
    if (b.sid === sid && !b.done && now >= b.arrive) out.push({ key: `n:${b.id}`, kind: 'nomads', name: `The ${b.family} family`, n: b.people.length, what: `nomads, ${b.people.length} of them` });
  }
  for (const a of sim.adventurers.here(sid)) out.push({ key: `a:${a.id}`, kind: 'adventurer', name: fullName(a.name), n: 1, what: a.level >= 3 ? 'adventurer, renowned' : 'adventurer' });
  for (const v of sim.visits.get(sid) || []) {
    if (v.outing !== undefined || now < v.arrive || now >= v.leave) continue;
    out.push({ key: `v:${v.id}`, kind: 'visitor', name: fullName(v.name), n: 1, what: `merchant from ${v.fromName}` });
  }
  return out;
}

// The key of the one an entity is (a nomad, an adventurer, a visitor), or
// null if they're the town's own or nobody it could take in.
export function newcomerKey(npc) {
  if (!npc || npc.dead) return null;
  if (npc.nomad) return `n:${npc.nomad.id}`;
  if (npc.adventurer) return `a:${npc.adventurer.id}`;
  if (npc.visit && npc.visit.outing === undefined) return `v:${npc.visit.id}`;
  return null;
}

// A person record ready for the town (see Nomads.settle): no longer a
// visitor, their purse and their week their own.
function asPerson(r, coins, rng) {
  const { ent, ...data } = r;
  void ent;
  const p = JSON.parse(JSON.stringify(data));
  for (const k of ['visitor', 'visit', 'adventurer', 'advLevel', 'nomadBand', 'nomad']) delete p[k];
  p.equipment = { tool: null, hobbyItem: null, items: [], armor: 0, ...(p.equipment || {}), coins: coins || 0 };
  p.equipment.items ||= [];
  if (!(p.restDay >= 0)) p.restDay = rng.int(0, 6);
  p.hobbies ||= [];
  p.age ||= 'adult';
  return p;
}

// Make them citizens. `by`: the name the ledger gives the one who did it.
// { ok, why, names, recs, kind }.
export function naturalise(sim, L, key, by) {
  const game = sim.game;
  const s = L.settlement;
  const day = game.day;
  const [k, id] = [key.slice(0, 1), key.slice(2)];
  const rng = new RNG(hash4(s.seed, day, key.length, 0x17e));
  const ents = [];
  let recs = [];
  let names = [];
  let kind = null;
  // (One of another town's own, moved here: in the ledger already, see
  // civic.relocate.)
  let moved = false;
  if (k === 'n') {
    const b = sim.nomads.bands.find((q) => String(q.id) === id && q.sid === s.id && !q.done);
    if (!b) return { ok: false, why: 'They\'ve moved on.' };
    kind = 'nomads';
    b.done = true;
    b.stayed = true;
    b.welcomed = true;
    sim.camps.strike(`n:${b.id}`);
    ents.push(...(b.ents || []));
    b.ents = null;
    recs = sim.nomads.settle(L, b, true);
    names = [`the ${b.family} family`];
  } else if (k === 'a') {
    const a = sim.adventurers.list.find((q) => String(q.id) === id);
    if (!a || a.dead || a.state !== 'stay' || a.at !== s.id) return { ok: false, why: 'They\'ve taken to the road again.' };
    kind = 'adventurer';
    const e = sim.adventurers.ents.get(a.id);
    if (e) ents.push(e);
    sim.adventurers.ents.delete(a.id);
    sim.adventurers.list = sim.adventurers.list.filter((q) => q !== a);
    sim.camps.strike(`a:${a.id}`);
    const person = asPerson(sim.adventurers.recordOf(a, L), a.coins, rng);
    person.traits = [...new Set(['well-traveled', ...(person.traits || [])])].slice(0, 4);
    recs = sim.nomads.settle(L, { id: 50000 + a.id, family: a.name.last, people: [person] }, true);
    names = [fullName(a.name)];
  } else if (k === 'v') {
    const list = sim.visits.get(s.id) || [];
    const v = list.find((q) => q.id === id);
    if (!v || v.outing !== undefined) return { ok: false, why: 'They\'ve gone on their way.' };
    kind = 'visitor';
    const e = game.npcs.find((n) => n.visit === v && !n.dead);
    if (e) ents.push(e);
    sim.visits.set(s.id, list.filter((q) => q !== v));
    sim.camps.strike(`v:${v.id}`);
    const OL = v.fromIdx !== undefined ? sim.layoutOf(v.from) : null;
    const home = OL && OL.npcs[v.fromIdx];
    if (home) {
      // One of another town's own: they leave it for this one, there and
      // then (they're here already: no road to walk).
      home.visit = null;
      home.override = null;
      recs = sim.sendPeople(OL, [home], L, `made a citizen by ${by}`);
      moved = true;
      home.away = true;
      home.leaving = false;
      for (const n of recs) {
        n.away = false;
        n.from = OL.settlement.id;
        sim.careers.returning = (sim.careers.returning || []).filter((q) => !(q.sid === s.id && q.idx === n.idx));
      }
    } else {
      const person = asPerson((e && e.rec) || visitorRecord(v, 4000, s.id), v.coins, rng);
      recs = sim.nomads.settle(L, { id: 60000 + (hash4(s.id, v.arrive, 0x7a11) % 10000), family: v.name.last, people: [person] }, true);
    }
    names = [fullName(v.name)];
  } else return { ok: false, why: 'Nobody by that name.' };
  for (const r of recs) {
    r.naturalised = { day, by };
    // (Off the road, not one of the nomads' bands: see Nomads.settle.)
    if (kind !== 'nomads' && r.from === 'nomads') r.from = kind === 'adventurer' ? 'road' : 'travel';
  }
  if (!moved) ledger(L, day, `${by} made ${names.join(', ')} citizen${recs.length > 1 ? 's' : ''} of ${s.name}.`);
  // In view: the one you see is the townsman now (see Game.settleEnts).
  game.settleEnts?.(L, ents, recs, kind);
  return { ok: true, names, recs, kind };
}
