// Keeping a settlement going: a town left without guards asks someone able
// to take up the spear, and if nobody can, its people pack up and move to
// another settlement (their own civilization's if possible).
import { alive, ledger, setOverride, DAY } from './econ.js';
import { retrain, availOf, makeSchedules } from '../entities/npcgen.js';
import { RNG, hash4 } from '../util/rng.js';

export function deserted(s) {
  return s.condition === 'abandoned' || !!s.deserted;
}

function residents(L) {
  return L.npcs.filter((r) => alive(r) && !r.migrated && !r.visitor);
}

// Daily: make sure someone guards the town.
export function checkWatch(sim, L, day, rng) {
  const s = L.settlement;
  if (deserted(s)) return null;
  const people = residents(L);
  if (!people.length) return null;
  if (people.some((r) => r.job === 'guard')) return null;
  let able = people.filter((r) => r.age === 'adult' && !r.away && r.job !== 'mayor');
  // The mayor serves only if there's truly no one else.
  if (!able.length) able = people.filter((r) => r.age === 'adult' && !r.away);
  if (able.length) {
    able.sort((a, b) => b.personality.bravery - a.personality.bravery);
    const pick = able[Math.floor(rng.next() * Math.min(3, able.length))];
    const old = pick.job;
    retrain(L, pick, 'guard', new RNG(hash4(pick.idx, day, 0x6a4d)));
    const e = pick.ent;
    if (e && !e.dead) {
      e.look = pick.look;
      e.maxHp = pick.maxHp;
      e.hp = Math.max(e.hp, pick.hp);
      e.activity = null;
    }
    ledger(L, day, `With no one left to keep the peace, ${pick.name.first} ${pick.name.last} (${old === 'retired' ? 'retired' : `once a ${old}`}) joined the watch.`);
    if (sim.game.active.has(s.id)) sim.game.ui.msg(`${pick.name.first} of ${s.name} has become the town's guard.`, '#e8e0a0');
    return { guard: pick };
  }
  return migrate(sim, L, day);
}

// Nobody can defend the place: everyone leaves for another settlement.
export function migrate(sim, L, day) {
  const s = L.settlement;
  const ow = sim.game.world.ow;
  const others = ow.settlements.filter((o) => o.id !== s.id && !deserted(o));
  if (!others.length) return null;
  const dist = (o) => Math.hypot(o.cx - s.cx, o.cz - s.cz);
  others.sort((a, b) => (a.civ === s.civ ? 0 : 20) + dist(a) - ((b.civ === s.civ ? 0 : 20) + dist(b)));
  const to = others[0];
  const T = sim.game.world.getLayout(to);
  const people = residents(L);
  const rng = new RNG(hash4(s.seed, day, 0x3176));
  const moved = adoptAll(T, people, rng, s);
  const now = day * DAY + (sim.game.minute || 0);
  // They arrive after the journey.
  for (const n of moved) {
    n.away = true;
    sim.careers.returning.push({ sid: to.id, idx: n.idx, at: now + Math.round(dist(to) * 25) + 60 });
  }
  for (const r of people) {
    r.migrated = to.id;
    if (r.ent && !r.ent.dead) {
      // Walk out of town with their belongings.
      r.leaving = true;
      setOverride(r, now, now + 600, 'travel', { place: 'road' });
      r.ent.activity = null;
    } else r.away = true;
  }
  s.deserted = true;
  L.econ.deserted = day;
  ledger(L, day, `With no guards and no one fit to serve, the people of ${s.name} left for ${to.name}.`);
  ledger(T, day, `${moved.length} people arrived from ${s.name}, which has been deserted.`);
  sim.game.ui.msg(`The people of ${s.name} are abandoning their home for ${to.name}.`, '#ffb080');
  sim.deserted.add(s.id);
  return { to, moved };
}

// New arrivals get records in their new town: families stay together in a
// house with room for them, and everyone finds work they can do there.
function adoptAll(T, people, rng, from) {
  const map = new Map();
  const out = [];
  const byHouse = new Map();
  for (const r of people) {
    const k = r.home ?? `x${r.idx}`;
    if (!byHouse.has(k)) byHouse.set(k, []);
    byHouse.get(k).push(r);
  }
  const avail = availOf(T);
  for (const fam of byHouse.values()) {
    const used = (b) => T.npcs.filter((o) => o.home === b.id && alive(o) && !o.migrated).length;
    const famHouse = T.buildings.find((b) => b.residential && b.beds.length - used(b) >= fam.length);
    for (const r of fam) {
      // Families stay together where there's room, or squeeze in wherever a bed is free.
      const house = famHouse || T.buildings.find((b) => b.residential && b.beds.length > used(b));
      const bed = house ? used(house) : 0;
      const { ent, ...data } = r;
      void ent;
      const n = JSON.parse(JSON.stringify(data));
      n.idx = T.npcs.length;
      n.home = house ? house.id : null;
      n.bed = bed;
      n.household = `m${from.id}:${r.household}`;
      n.friends = [];
      n.away = false;
      n.leaving = false;
      n.override = null;
      n.trip = null;
      n.visit = null;
      n.snares = [];
      n.grief = [];
      n.from = from.id;
      n.arrived = true;
      if (n.job !== 'child' && n.job !== 'retired' && !T.hasWorkplaceFor(n.job)) {
        n.job = ['laborer', 'farmer', 'fisher', 'trapper'].find((j) => T.hasWorkplaceFor(j)) || 'retired';
      }
      n.work = T.assignWork(n, rng);
      n.schedule = makeSchedules(n, rng.fork(n.idx + 7), avail);
      map.set(r.idx, n.idx);
      T.npcs.push(n);
      out.push(n);
    }
  }
  // Family ties carry over to the new records.
  for (const n of out) {
    n.partner = n.partner !== null && n.partner !== undefined && map.has(n.partner) ? map.get(n.partner) : null;
    n.children = (n.children || []).filter((i) => map.has(i)).map((i) => map.get(i));
    n.parents = (n.parents || []).filter((i) => map.has(i)).map((i) => map.get(i));
  }
  return out;
}
