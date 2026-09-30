// Trading companies: a few bands of traders who never settle anywhere.
// They go from town to town by wagon (pulled by horses) with riders
// alongside, their banners on the wagons' canvas and the horses' saddle
// cloths. They travel by day and camp by the road at night; reaching a
// town they make camp outside it (tents, wagons, the horses tied to a
// hitching post) and stay a day or two to trade before moving on.
import { alive, ledger, DAY, st, price, kitchenOf, glutFactor, invAdd } from './econ.js';
import { deserted } from './civic.js';
import { makeTraveller } from '../entities/npcgen.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4 } from '../util/rng.js';
import { CULTURES, familyName, placeName } from '../world/names.js';

const GROUPS = 3;
const BANNERS = ['#b8322e', '#2e5eb8', '#2e8a4a', '#c89a28', '#7a3ea8', '#1e8a8a'];
// Day travel: they're on the move between these hours.
const DAWN = 6 * 60;
const DUSK = 20 * 60;
// What they carry from afar, and what they take on in towns.
const WARES = ['cloth', 'glass', 'lantern', 'book', 'iron_ingot', 'leather', 'string', 'rug_red', 'rug_blue', 'gem', 'healing_salve', 'fishing_rod', 'bow', 'arrow', 'spear', 'linen_shirt', 'fine_coat'];
const BUYS = ['bread', 'wheat', 'fish', 'cooked_fish', 'apple', 'carrot', 'planks', 'iron_ore', 'coal', 'herb'];

const onRoad = (m) => {
  const hm = ((m % DAY) + DAY) % DAY;
  return hm >= DAWN && hm < DUSK;
};

// `t`, or the next dawn if that's in the night.
function inDaylight(t) {
  const hm = ((t % DAY) + DAY) % DAY;
  if (hm < DAWN) return t + DAWN - hm;
  if (hm >= DUSK) return t + DAY - hm + DAWN;
  return t;
}

// Travel `hours` of daylight from `t`: when they get there (nights spent
// camped by the road).
export function afterDaylight(t, hours) {
  let left = hours * 60;
  let now = t;
  for (let guard = 0; left > 0 && guard < 400; guard++) {
    const hm = ((now % DAY) + DAY) % DAY;
    if (hm < DAWN) {
      now += DAWN - hm;
      continue;
    }
    if (hm >= DUSK) {
      now += DAY - hm + DAWN;
      continue;
    }
    const step = Math.min(left, DUSK - hm);
    now += step;
    left -= step;
  }
  return now;
}

// How much of the way they've come by `now` (daylight hours only).
function progress(g, now) {
  let done = 0;
  let total = 0;
  const step = 30;
  for (let t = g.departAt; t < g.arrive; t += step) {
    const d = onRoad(t) ? step : 0;
    total += d;
    if (t < now) done += d;
  }
  return total ? Math.min(1, done / total) : 1;
}

export class Caravans {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.next = 1;
    this.ents = new Map(); // "id:i" -> NPC entity in a town you're in
    this.recs = new Map(); // "id:i:sid" -> their record there
    this.started = false;
  }

  get(id) {
    return this.list.find((g) => g.id === id) || null;
  }

  places() {
    return this.game.world.ow.settlements.filter((s) => !deserted(s) && s.condition !== 'abandoned');
  }

  create(rng) {
    const styles = Object.keys(CULTURES);
    const style = rng.pick(styles);
    const fam = familyName(rng, style);
    const name = rng.chance(0.5) ? `the ${fam} Trading Company` : `the ${placeName(rng, style)} Traders`;
    const nWagons = rng.int(1, 2);
    const members = [];
    members.push({ ...makeTraveller(rng, style, 'trader', fam), mount: 'wagon', wagon: 0 });
    if (nWagons > 1) members.push({ ...makeTraveller(rng, style, 'driver', fam), mount: 'wagon', wagon: 1 });
    members.push({ ...makeTraveller(rng, style, 'guard'), mount: 'horse' });
    if (rng.chance(0.6)) members.push({ ...makeTraveller(rng, style, 'trader'), mount: 'horse' });
    const banner = BANNERS[(this.next + rng.int(0, 5)) % BANNERS.length];
    for (const m of members) m.coat = rng.int(0, 5);
    const g = {
      id: this.next++, name, style, banner, members, wagons: nWagons,
      goods: {}, coins: 150 + rng.int(0, 150), state: 'road', at: null, from: null, dest: null,
      departAt: 0, arrive: 0, leave: 0, seen: [], stays: 0,
    };
    for (const k of rng.shuffle(WARES.slice()).slice(0, 7)) if (ITEMS[k]) st.add(g.goods, k, rng.int(2, 5));
    return g;
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (this.list.length) return;
    const rng = new RNG(hash4(this.game.seed, 0xca7a));
    const places = this.places();
    if (places.length < 2) return;
    const now = this.sim.abs;
    for (let i = 0; i < GROUPS; i++) {
      const g = this.create(rng);
      const from = places[rng.int(0, places.length - 1)];
      g.from = from.id;
      g.dest = this.nextStop(g, rng, from).id;
      g.departAt = now - rng.int(0, 10) * 60;
      g.arrive = afterDaylight(g.departAt, Math.max(4, this.sim.diplomacy.travelHours(from, this.game.world.ow.settlements[g.dest])));
      this.list.push(g);
    }
  }

  nextStop(g, rng, here) {
    const cands = this.places().filter((s) => s !== here && Math.hypot(s.cx - here.cx, s.cz - here.cz) < 22);
    if (!cands.length) return this.places().find((s) => s !== here) || here;
    const score = (s) => (g.seen.includes(s.id) ? -5 : 0) + (s.type === 'city' ? 2 : s.type === 'town' ? 1 : 0) - Math.hypot(s.cx - here.cx, s.cz - here.cz) * 0.1 + rng.float(0, 3);
    return cands.reduce((m, s) => (score(s) > score(m) ? s : m));
  }

  update() {
    this.start();
    const now = this.sim.abs;
    for (const g of this.list) {
      const rng = new RNG(hash4(g.id, Math.floor(now / 60), 0xca));
      if (g.state === 'road' && now >= g.arrive) this.arriveAt(g, rng);
      else if (g.state === 'stay' && now >= g.leave && onRoad(now)) this.depart(g, rng);
    }
    this.roadCamps();
  }

  arriveAt(g, rng) {
    const s = this.game.world.ow.settlements[g.dest];
    if (!s || deserted(s)) {
      this.depart(g, rng);
      return;
    }
    const L = this.sim.layoutOf(s.id);
    g.state = 'stay';
    g.at = s.id;
    g.stays++;
    g.seen = [...g.seen.filter((q) => q !== s.id), s.id].slice(-5);
    // A day or two, and they set off in the morning.
    g.leave = inDaylight(this.sim.abs + rng.int(24, 44) * 60);
    const mounts = g.members.filter((m) => m.mount === 'horse' || m.wagon !== undefined).map((m) => ({ kind: m.wagon !== undefined ? 'wagon' : 'horse', coat: m.coat, banner: g.banner }));
    this.sim.camps.pitch(L, `c:${g.id}`, 'caravan', 2, g.leave + 60, hash4(g.id, s.id, 0xcc), { mounts });
    const day = Math.floor(this.sim.abs / DAY);
    ledger(L, day, `A caravan of ${g.name} (${g.wagons} wagon${g.wagons > 1 ? 's' : ''}, ${g.members.length} people) made camp outside town to trade.`);
    this.trade(g, L, rng);
  }

  depart(g, rng) {
    this.sim.camps.strike(`c:${g.id}`);
    const ow = this.game.world.ow;
    const here = ow.settlements[g.at ?? g.dest] || this.places()[0];
    const next = this.nextStop(g, rng, here);
    g.state = 'road';
    g.from = here.id;
    g.dest = next.id;
    g.at = null;
    g.departAt = this.sim.abs;
    g.arrive = afterDaylight(g.departAt, Math.max(4, Math.round(this.sim.diplomacy.travelHours(here, next) * 0.8)));
    // A little of the road's own trade.
    g.coins += rng.int(0, 30);
    for (const k of rng.shuffle(WARES.slice()).slice(0, 2)) if (ITEMS[k]) st.add(g.goods, k, rng.int(1, 3));
  }

  // With the town's shops (each thing to whoever deals in it), its
  // townsfolk (a few coins each on something from far away) and its
  // tavern: their wares for the town's goods and coin.
  trade(g, L, rng) {
    const e = L.econ;
    const bizOf = (type) => {
      const b = L.buildings.find((q) => q.type === type && e.biz[q.id]);
      return b ? e.biz[b.id] : null;
    };
    const buyerFor = (k) => {
      if (['gem', 'iron_ingot', 'spear', 'bow', 'arrow'].includes(k)) return [bizOf('smithy') || bizOf('shop'), bizOf('smithy') ? 'smith' : 'general'];
      if (['cloth', 'leather', 'string', 'linen_shirt', 'fine_coat', 'rug_red', 'rug_blue'].includes(k)) return [bizOf('tailor') || bizOf('shop'), bizOf('tailor') ? 'tailor' : 'general'];
      if (k === 'healing_salve') return [bizOf('herbalist') || bizOf('shop'), bizOf('herbalist') ? 'herbalist' : 'general'];
      return [bizOf('shop'), 'general'];
    };
    let sold = 0;
    let bought = 0;
    for (const [item, n] of Object.entries(g.goods)) {
      if (BUYS.includes(item)) continue;
      const [b, kind] = buyerFor(item);
      if (!b) continue;
      for (let i = 0; i < n; i++) {
        const pr = Math.floor(price(item) * 0.7 * glutFactor(kind, item, st.count(b.store, item)));
        if (pr <= 0 || b.till < pr + 5) break;
        b.till -= pr;
        st.add(b.store, item, 1);
        st.take(g.goods, item, 1);
        g.coins += pr;
        sold += pr;
      }
    }
    // Townsfolk with a little put by come out to the wagons.
    const folk = L.npcs.filter((r) => alive(r) && r.age === 'adult' && !r.visitor && !r.away && (r.coins || 0) > 12);
    for (const r of rng.shuffle(folk).slice(0, 6)) {
      const have = Object.keys(g.goods).filter((k) => !BUYS.includes(k) && st.count(g.goods, k) > 0 && price(k) <= r.coins * 0.7);
      if (!have.length || !rng.chance(0.5)) continue;
      const k = rng.pick(have);
      const pr = Math.round(price(k) * 1.1);
      r.coins -= pr;
      g.coins += pr;
      st.take(g.goods, k, 1);
      invAdd(r.inv, k, 1);
      sold += pr;
    }
    // What the town has plenty of, for the road.
    const sb = bizOf('shop');
    if (sb) {
      for (const item of BUYS) {
        if (!st.count(sb.store, item) || g.coins < 30) continue;
        const n = Math.min(3, st.count(sb.store, item));
        const pr = Math.round(price(item) * 1.05) * n;
        st.take(sb.store, item, n);
        sb.till += pr;
        g.coins -= pr;
        st.add(g.goods, item, n);
        bought += pr;
      }
    }
    // Hungry travellers: meals from the tavern.
    const k = kitchenOf(L);
    if (k) {
      const pr = g.members.length * 3;
      if (g.coins > pr) {
        g.coins -= pr;
        k.till += pr;
      }
    }
    // Word gets round the town: new things in from far away.
    if (sold > 30) ledger(L, Math.floor(this.sim.abs / DAY), `${g.name[0].toUpperCase()}${g.name.slice(1)} sold ¤${sold} of goods from far away in town.`);
    g.lastTrade = { sid: L.settlement.id, sold, bought };
    return g.lastTrade;
  }

  // Their pack, for trading with you.
  shop(g) {
    return { store: g.goods, purse: { get: () => g.coins, add: (n) => { g.coins += n; } }, kind: 'general', wants: null };
  }

  // Where each member is on the road right now (for meeting them), or
  // null in town. At night they're camped (not moving).
  onTheRoad() {
    const out = [];
    const now = this.sim.abs;
    const ow = this.game.world.ow;
    for (const g of this.list) {
      if (g.state !== 'road' || g.from === null || now < g.departAt || now >= g.arrive) continue;
      const from = ow.settlements[g.from];
      const to = ow.settlements[g.dest];
      if (!from || !to) continue;
      const f = progress(g, now);
      out.push({ g, from, to, f, camped: !onRoad(now) });
    }
    return out;
  }

  // Night camps by the road near you: a tent and a fire (put up while
  // you're about), the wagons standing, the horses tied up.
  roadCamps() {
    const want = new Set();
    for (const r of this.roadSpots()) {
      if (!r.camped) continue;
      const p = this.game.player;
      if (Math.max(Math.abs(r.pos.x - p.x), Math.abs(r.pos.z - p.z)) > 40) continue;
      const key = `rc:${r.g.id}:${r.g.departAt}`;
      want.add(key);
      if (this.game.roadCamp && !this.game.roadCamp.has(key)) this.game.pitchRoadCamp?.(key, r.pos, r.g);
    }
    if (this.game.roadCamp) for (const k of [...this.game.roadCamp.keys()]) if (k.startsWith('rc:') && !want.has(k)) this.game.strikeRoadCamp?.(k);
  }

  // A group's spot along the road (with the road itself when it's built).
  roadSpots() {
    const out = [];
    const centre = (s) => ({ x: Math.floor((s.cx + s.cw / 2) * 64), z: Math.floor((s.cz + s.cd / 2) * 36) });
    for (const r of this.onTheRoad()) {
      const road = this.sim.diplomacy.roads.find((q) => q.done && ((q.a === r.from.id && q.b === r.to.id) || (q.a === r.to.id && q.b === r.from.id)));
      let pos;
      if (road && road.tiles && road.tiles.length) {
        const i = Math.floor((road.a === r.from.id ? r.f : 1 - r.f) * (road.tiles.length - 1));
        const t = road.tiles[Math.max(0, Math.min(road.tiles.length - 1, i))];
        pos = { x: t[0], z: t[2] };
      } else {
        const a = centre(r.from);
        const b = centre(r.to);
        pos = { x: Math.round(a.x + (b.x - a.x) * r.f), z: Math.round(a.z + (b.z - a.z) * r.f) };
      }
      out.push({ ...r, pos, target: centre(r.to) });
    }
    return out;
  }

  // Their wagons and horses at a road camp (see game.syncStanding).
  roadStanding() {
    const out = [];
    for (const [key, c] of this.game.roadCamp || []) {
      if (!key.startsWith('rc:')) continue;
      for (const h of c.horses) out.push({ ...h, type: 'horse' });
      for (const w of c.wagons) out.push({ ...w, type: 'wagon' });
    }
    return out;
  }

  // A record for one of them, in a town or on the road (the same one each
  // time, so whoever you met is the one you meet again).
  recordOf(g, i, L) {
    const key = `${g.id}:${i}:${L.settlement.id}`;
    const had = this.recs.get(key);
    if (had) return had;
    const m = g.members[i];
    const guard = m.role === 'guard';
    const day = m.role === 'trader' ? 'market' : guard ? 'patrol' : 'camp';
    const sched = [{ s: 0, e: 420, act: 'adventure', place: 'camp' }, { s: 420, e: 1140, act: 'adventure', place: day }, { s: 1140, e: 1260, act: 'adventure', place: 'tavern' }, { s: 1260, e: 1440, act: 'adventure', place: 'camp' }];
    const rec = {
      id: `${L.settlement.id}:c${g.id}:${i}`, idx: 6000 + g.id * 10 + i, sid: L.settlement.id, visitor: true, caravanTrader: g.id, role: m.role,
      name: m.name, age: 'adult', job: 'caravanner', home: null, bed: 0, household: null,
      partner: null, children: [], parents: [], friends: [], personality: m.personality, traits: m.traits, hobbies: [], look: m.look,
      alive: true, shift: 'day', restDay: -1,
      equipment: { tool: guard ? 'spear' : null, hobbyItem: null, items: guard ? [{ item: 'spear', count: 1 }] : [], coins: 0, armor: guard ? 0.2 : 0 },
      maxHp: guard ? 22 : 12, hp: guard ? 22 : 12, work: { kind: 'none' }, schedule: { work: sched, rest: sched },
      coins: 0, inv: [], skills: { trading: 0.8, cooking: 0.2, hunting: 0.4, fishing: 0.2, farming: 0.1, building: 0.2, crafting: 0.3 },
      fed: 1, hungry: 0, mood: 0.75, grief: [], override: null, away: false, doneKey: null,
    };
    this.recs.set(key, rec);
    return rec;
  }

  // Out on the road: each of them, a pace or two apart along the way,
  // riding or up on the wagon (at night, camped and on foot).
  roadTravellers() {
    const out = [];
    for (const r of this.roadSpots()) {
      const L = this.game.world.layouts.get(r.to.id) || this.sim.layoutOf(r.to.id);
      if (!L || !L.econ) continue;
      const dx = Math.sign(r.target.x - r.pos.x);
      const dz = Math.sign(r.target.z - r.pos.z);
      r.g.members.forEach((m, i) => {
        const back = i * 2;
        const pos = r.camped ? { x: r.pos.x + (i % 2 ? 2 : -2), z: r.pos.z + (i >> 1) * 2 - 1 } : { x: r.pos.x - dx * back, z: r.pos.z - dz * back };
        const mount = r.camped ? null : { kind: m.wagon !== undefined ? 'wagon' : 'horse', coat: m.coat || 0, banner: r.g.banner };
        out.push({ key: `car:${r.g.id}:${i}:${r.g.departAt}`, rec: this.recordOf(r.g, i, L), L, from: r.from, to: r.to, pos, target: r.target, mount, company: r.g, camped: r.camped, camp: r.camped ? r.pos : null });
      });
    }
    return out;
  }

  // In a town you're in: the company, about their camp and the market.
  syncEnts() {
    const g0 = this.game;
    if (!g0.spawnCaravanner) return;
    const now = this.sim.abs;
    for (const g of this.list) {
      const here = g.state === 'stay' && g0.active.has(g.at) && now < g.leave;
      g.members.forEach((m, i) => {
        const k = `${g.id}:${i}`;
        const ent = this.ents.get(k);
        if (here && (!ent || ent.dead)) {
          const L = this.sim.layoutOf(g.at);
          const n = g0.spawnCaravanner(L, g, i, this.recordOf(g, i, L));
          if (n) this.ents.set(k, n);
        } else if (!here && ent && !ent.dead && !ent.caravan) {
          g0.despawnNpc(ent);
          this.ents.delete(k);
        }
      });
    }
  }

  serialize() {
    return { list: this.list, next: this.next, started: this.started };
  }

  load(d) {
    this.list = (d && d.list) || [];
    this.next = (d && d.next) || 1;
    this.started = !!(d && d.started);
    this.ents = new Map();
    this.recs = new Map();
  }
}

