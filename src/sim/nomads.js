// Nomads: now and then a family on the road stops at a settlement, looks
// it over (room to live, food on the table, safety, taxes, how welcome
// they're made) and either settles there for good or moves on. A deserted
// town can come back to life this way.
import { alive, ledger, initRec, DAY, kitchenOf, st, MEAL_ITEMS } from './econ.js';
import { makeNomadBand, makeSchedules, availOf, JOBS, GUARD_HP } from '../entities/npcgen.js';
import { RNG, hash4 } from '../util/rng.js';

const STAY_HOURS = 6;
const ISLE_NOMADS = { kharos: ['ember'], myrrow: ['mist', 'tide'] };

export class Nomads {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.bands = [];
    this.next = 1;
  }

  // Daily: a band may turn up at a settlement.
  arrive(L, day, rng) {
    const s = L.settlement;
    if (s.condition === 'abandoned' || this.bands.some((b) => b.sid === s.id && !b.done)) return null;
    if (!rng.chance(s.deserted ? 0.1 : 0.12)) return null;
    const r = new RNG(hash4(s.seed, day, 0x40ad));
    // (Wanderers of the island's own peoples.)
    const band = makeNomadBand(r, r.int(2, 5), ISLE_NOMADS[s.island]);
    const now = day * DAY + 540 + r.int(0, 300);
    const b = { id: this.next++, sid: s.id, arrive: now, decide: now + STAY_HOURS * 60, family: band.family, style: band.style, people: band.people, done: false, vouched: 0 };
    // Some bands travel with a plain wagon and a horse or two (no banners:
    // they're nobody's traders).
    if (r.chance(0.4)) {
      b.mounts = [{ kind: 'wagon', coat: r.int(0, 5), banner: null }];
      if (band.people.length > 3) b.mounts.push({ kind: 'horse', coat: r.int(0, 5), banner: null });
    }
    this.bands.push(b);
    return b;
  }

  here(sid) {
    const now = this.sim.abs;
    return this.bands.find((b) => b.sid === sid && !b.done && now >= b.arrive);
  }

  // What they make of the place: { ok, score, reasons: [...] }.
  judge(L, b) {
    const s = L.settlement;
    const e = L.econ;
    const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.away);
    const reasons = [];
    const houses = L.buildings.filter((h) => h.residential && !h.playerHome && !h.underConstruction);
    const free = (h) => Math.max(0, h.beds.length - people.filter((r) => r.home === h.id).length);
    const room = houses.reduce((n, h) => Math.max(n, free(h)), 0);
    // A family wants a roof of its own (or enough spare beds under one).
    const housed = room >= Math.min(b.people.length, 4) || (b.houseBid !== undefined && L.buildings[b.houseBid] && !L.buildings[b.houseBid].underConstruction);
    if (!housed) reasons.push('no room');
    let score = housed ? 2 : 0;
    const k = kitchenOf(L);
    const meals = k ? MEAL_ITEMS.reduce((n, m) => n + st.count(k.store, m), 0) : 0;
    const hungry = people.filter((r) => r.hungry >= 1).length;
    if (!people.length || hungry / people.length < 0.2 || meals > 4) score++;
    else reasons.push('hunger');
    const guards = people.filter((r) => r.job === 'guard').length + this.sim.playerGuard(s.id);
    if (s.deserted || (guards >= 1 && e.recent.violence <= 2)) score++;
    else reasons.push('danger');
    if (e.tax <= 0.16) score++;
    else reasons.push('taxes');
    score += Math.min(2, b.vouched);
    return { ok: housed && score >= 4, score, reasons, room };
  }

  // They settle: records, homes (families together where there's room),
  // and work the town is short of.
  settle(L, b) {
    const own = b.houseBid !== undefined ? L.buildings[b.houseBid] : null;
    const s = L.settlement;
    const day = this.game.day;
    const rng = new RNG(hash4(s.seed, b.id, 0x5e77));
    const avail = availOf(L);
    const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.away);
    const used = (h) => L.npcs.filter((r) => r.home === h.id && alive(r) && !r.migrated).length;
    const houses = L.buildings.filter((h) => h.residential && !h.playerHome && !h.underConstruction);
    const famHouse = own && !own.underConstruction ? own : houses.find((h) => h.beds.length - used(h) >= b.people.length);
    const base = L.npcs.length;
    const need = [...(L.econ.hands ? [L.econ.hands] : []), 'guard', 'builder', 'farmer', 'trapper', 'fisher', 'miner', 'lumberjack', 'laborer'].filter((j) => L.hasWorkplaceFor(j));
    const recs = b.people.map((p, i) => {
      const house = famHouse || houses.find((h) => h.beds.length > used(h));
      const r = JSON.parse(JSON.stringify(p));
      Object.assign(r, { id: `${s.id}:${base + i}`, idx: base + i, sid: s.id, home: house ? house.id : null, household: `n${b.id}`, bed: house ? used(house) : 0, from: 'nomads', arrived: true });
      if (house && !house.family) this.sim.works.nameHouse(L, house, b.family, b.people.map((q) => ({ age: q.age })));
      if (r.age === 'adult') {
        // Guards first if the town has none, then what the town lacks.
        const has = (j) => people.some((q) => q.job === j) || L.npcs.slice(base).some((q) => q.job === j);
        r.job = need.find((j) => !has(j)) || need.find((j) => j === 'farmer' || j === 'laborer') || 'laborer';
        if (r.job === 'guard') {
          r.maxHp = GUARD_HP;
          r.hp = GUARD_HP;
          r.look = { ...r.look, outfit: 'guard', hat: 'helmet' };
        } else r.look = { ...r.look, outfit: JOBS[r.job]?.outfit || r.look.outfit };
      }
      L.npcs.push(r);
      r.work = L.assignWork(r, rng);
      r.schedule = makeSchedules(r, rng.fork(r.idx), avail);
      initRec(r, rng.fork(r.idx + 3));
      return r;
    });
    // Family ties point at the new records.
    for (const r of recs) {
      if (r.partner !== null && r.partner !== undefined) r.partner = base + r.partner;
      r.children = (r.children || []).map((i) => base + i);
      r.parents = (r.parents || []).map((i) => base + i);
    }
    if (s.deserted) {
      s.deserted = false;
      delete L.econ.deserted;
      this.sim.deserted.delete(s.id);
      ledger(L, day, `The ${b.family} family, nomads, made a home in the empty town. ${s.name} lives again.`);
    } else ledger(L, day, `A band of nomads, the ${b.family} family, decided to settle in ${s.name}.`);
    return recs;
  }

  // The band is here: entities walk in when the town is near; after a few
  // hours they decide.
  update() {
    const now = this.sim.abs;
    const g = this.game;
    for (const b of this.bands) {
      if (b.done) continue;
      const L = this.sim.layoutOf(b.sid);
      if (!L) continue;
      if (now >= b.arrive && !b.announced) {
        b.announced = true;
        // Tents outside town for the stay: one for every two of them.
        this.sim.camps.pitch(L, `n:${b.id}`, 'nomad', Math.min(3, Math.ceil(b.people.length / 2)), b.decide + 7 * DAY, b.id, { mounts: b.mounts || [] });
        ledger(L, this.sim.today(), `A band of nomads, the ${b.family} family, has camped outside town.`);
      }
      if (now >= b.arrive && now < b.decide && g.active.has(b.sid) && (!b.ents || b.ents.every((e) => e.dead))) b.ents = g.spawnNomads ? g.spawnNomads(L, b) : null;
      if (b.houseProject !== undefined) {
        // Waiting on the house the town is building for them.
        const p = this.sim.works.projects.find((q) => q.id === b.houseProject);
        const built = L.buildings[b.houseBid] && !L.buildings[b.houseBid].underConstruction;
        if (!built && p && !p.done && now < b.decide) continue;
      } else if (now < b.decide) continue;
      const v = this.judge(L, b);
      // Only short of room: the council may build them a home, and they wait.
      if (!v.ok && v.reasons.length === 1 && v.reasons[0] === 'no room' && b.houseProject === undefined && L.econ.treasury >= 150 && this.sim.works.freePlot(L)) {
        const p = this.sim.works.startBuilding(L, b.people.length <= 2 ? 'house_s' : 'house_m', ` for the ${b.family} family`);
        if (p) {
          L.econ.treasury -= 120;
          b.houseProject = p.id;
          b.houseBid = p.bid;
          b.decide = now + 6 * DAY;
          ledger(L, this.sim.today(), `The council is building a cottage for the ${b.family} nomads, who will wait for it.`);
          continue;
        }
      }
      b.done = true;
      // The tents come down, whichever way they decide.
      this.sim.camps.strike(`n:${b.id}`);
      const ents = b.ents || [];
      b.ents = null;
      if (v.ok) {
        const recs = this.settle(L, b);
        b.stayed = true;
        g.nomadsSettle?.(L, ents, recs);
        if (b.vouchedBy) this.sim.addRenown(b.sid, 1, 'welcoming newcomers');
      } else {
        b.stayed = false;
        const why = { 'no room': 'there was no room for them', hunger: 'too many were going hungry', danger: 'it didn\'t feel safe', taxes: 'the taxes were too high' }[v.reasons[0]] || 'it wasn\'t for them';
        ledger(L, this.sim.today(), `The ${b.family} nomads moved on: ${why}.`);
        g.nomadsLeave?.(ents);
      }
    }
    if (this.bands.length > 30) this.bands = this.bands.filter((b) => !b.done || now - b.decide < 3 * DAY);
  }

  serialize() {
    return { bands: this.bands.map(({ ents, ...b }) => (void ents, b)), next: this.next };
  }

  load(d) {
    if (!d) return;
    this.bands = d.bands || [];
    this.next = d.next || 1;
  }
}
