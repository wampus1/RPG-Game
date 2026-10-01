// Towns write to each other. A mayor with a problem (an empty treasury, too
// few guards or people) or something to offer (a gift, better trade, a road)
// writes a letter, which goes out with the next merchant heading that way
// (or a courier, or you). The other mayor answers according to how the
// towns get on and what they can spare, and the reply comes back the same
// way. Warnings about a dangerous traveller travel the same roads.
import { alive, ledger, DAY, setOverride } from './econ.js';
import { deserted } from './civic.js';
import { B } from '../world/blocks.js';
import { REGION_W, REGION_D } from '../config.js';
// Builder-minutes to lay one tile of road between towns (from each end).
const ROAD_MIN_PER_TILE = 20;

// What a road may clear out of its way: plants and tree trunks.
export const SOFT = new Set(['tall_grass', 'fern', 'bush', 'berry_bush', 'dead_bush', 'flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_purple',
  'mushroom_red', 'mushroom_brown', 'herb', 'rock', 'log_oak', 'log_birch', 'log_pine', 'log_palm', 'log_jungle', 'log_acacia', 'log_willow', 'cactus', 'sapling'].map((k) => B[k]).filter((v) => v !== undefined));

const KINDS = {
  aid: 'asking for money for the treasury',
  aid_sent: 'sending money for the treasury',
  guards: 'asking for a guard to be sent',
  settlers: 'asking for settlers',
  gift: 'with a gift of coin',
  trade: 'proposing closer trade',
  road: 'proposing a road between the towns',
  warn: 'warning of a dangerous traveller',
  reply: 'with an answer',
};

export class Diplomacy {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.letters = [];
    this.roads = []; // { a, b, tiles: [[x, y, z, id]], built, done }
    this.warnings = new Map(); // sid -> [{ from, day }]
    this.next = 1;
    this.day = null;
  }

  town(sid) {
    return this.game.world.ow.settlements[sid];
  }

  rel(L, sid) {
    const e = L.econ;
    if (!e.relations) e.relations = {};
    if (!e.relations[sid]) e.relations[sid] = { trust: 0, trade: 0, road: false };
    return e.relations[sid];
  }

  dist(a, b) {
    return Math.hypot(a.cx - b.cx, a.cz - b.cz);
  }

  // Hours for a letter (or merchant) to go from one town to another.
  travelHours(a, b) {
    const road = this.roads.some((r) => r.done && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)));
    return Math.round((3 + this.dist(a, b) * 1.5) * (road ? 0.5 : 1));
  }

  neighbours(s, max = 14) {
    return this.game.world.ow.settlements
      .filter((o) => o.id !== s.id && !deserted(o) && o.condition !== 'abandoned' && this.dist(o, s) < max)
      .sort((a, b) => (a.civ === s.civ ? 0 : 6) + this.dist(a, s) - ((b.civ === s.civ ? 0 : 6) + this.dist(b, s)));
  }

  // ------------------------------------------------------------ writing
  write(from, to, kind, payload = {}) {
    const L = this.sim.layoutOf(from.id);
    const letter = { id: this.next++, from: from.id, to: to.id, kind, payload, day: this.sim.today(), status: 'waiting', written: this.sim.now() };
    this.letters.push(letter);
    const m = L.npcs.find((r) => r.job === 'mayor' && alive(r));
    ledger(L, this.sim.today(), `${m ? `${m.name.first} ${m.name.last}` : 'The council'} wrote to ${to.name}, ${KINDS[kind] || 'on town business'}.`);
    return letter;
  }

  // Once a day or so, a mayor looks at the town's needs and neighbours.
  consider(L, day, rng) {
    const s = L.settlement;
    const e = L.econ;
    if (deserted(s) || !L.npcs.some((r) => r.job === 'mayor' && alive(r))) return null;
    if (e.lastLetter !== undefined && day - e.lastLetter < 3) return null;
    if (!rng.chance(0.5)) return null;
    const near = this.neighbours(s);
    if (!near.length) return null;
    const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.away);
    const pop = people.length + this.sim.playerCount(s.id);
    const guards = people.filter((r) => r.job === 'guard').length + this.sim.playerGuard(s.id);
    const pick = (list) => list[Math.floor(rng.next() * Math.min(2, list.length))];
    let letter = null;
    const rec = this.sim.justice.recordOf(s.id);
    const warned = e.warnedFor || 0;
    if ((rec.convictions > warned || (this.sim.justice.exiled.has(s.id) && warned < 99)) && near.length) {
      e.warnedFor = this.sim.justice.exiled.has(s.id) ? 99 : rec.convictions;
      for (const o of near.slice(0, 3)) letter = this.write(s, o, 'warn', { name: this.game.playerName, crimes: rec.convictions, exiled: this.sim.justice.exiled.has(s.id) });
    } else if (e.treasury < pop * 6 || e.wants) {
      const rich = near.filter((o) => o.condition !== 'poor');
      if (rich.length) letter = this.write(s, pick(rich), 'aid', { amount: Math.max(60, pop * 8), for: e.wants || null });
    } else if (guards < Math.max(1, Math.round(pop / 14))) {
      letter = this.write(s, pick(near), 'guards');
    } else if (pop < 10 || e.hands) {
      letter = this.write(s, pick(near), 'settlers');
    } else if (e.treasury > pop * 40) {
      const cold = near.filter((o) => this.rel(L, o.id).trust < 30);
      if (cold.length) {
        const amount = Math.round(Math.min(e.treasury * 0.1, 120));
        e.treasury -= amount;
        letter = this.write(s, pick(cold), 'gift', { amount });
      }
    }
    if (!letter) {
      const friends = near.filter((o) => this.rel(L, o.id).trust >= 15);
      const o = friends.length ? pick(friends) : null;
      if (o && this.rel(L, o.id).trade < 3 && rng.chance(0.5)) letter = this.write(s, o, 'trade');
      else if (o && this.rel(L, o.id).trade >= 2 && !this.rel(L, o.id).road && e.treasury >= 200 && this.dist(o, s) < 9) letter = this.write(s, o, 'road');
    }
    if (letter) e.lastLetter = day;
    return letter;
  }

  // ------------------------------------------------------------ carrying
  // A merchant setting out takes the town's waiting letters for that place.
  preferredDest(sid, dests) {
    const w = this.letters.find((q) => q.from === sid && q.status === 'waiting' && dests.some((d) => d.o.id === q.to));
    return w ? dests.find((d) => d.o.id === w.to) : null;
  }

  carry(sid, dest, rec, arrive) {
    for (const q of this.letters) {
      if (q.from !== sid || q.to !== dest || q.status !== 'waiting') continue;
      q.status = 'carried';
      q.arrive = arrive;
      q.carrier = `${rec.name.first} ${rec.name.last}`;
      q.carrierIdx = rec.idx;
    }
  }

  // Letters with no merchant going their way soon go by courier: the mayor
  // hires someone from town, who walks there, waits for any answer, and
  // comes back to be paid. (A town with nobody spare or no money sends it
  // with a passing stranger after two days.)
  courier(now) {
    for (const q of this.letters) {
      if (q.status !== 'waiting' || now - q.written < 10 * 60) continue;
      if (q.kind !== 'reply' && this.hireCourier(q, now)) continue;
      if (now - q.written < 2 * DAY) continue;
      q.status = 'carried';
      q.carrier = 'a courier';
      q.arrive = now + this.travelHours(this.town(q.from), this.town(q.to)) * 60;
    }
  }

  hireCourier(q, now) {
    const L = this.sim.layoutOf(q.from);
    const hod = Math.floor((now % DAY) / 60);
    if (!L || !L.econ || hod < 7 || hod >= 16) return false;
    const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.away);
    if (!mayor) return false;
    const from = this.town(q.from);
    const to = this.town(q.to);
    const hours = this.travelHours(from, to);
    const pay = 6 + Math.round(hours * 1.5);
    if (L.econ.treasury < pay + 10) return false;
    const busy = new Set(['mayor', 'guard', 'priest', 'merchant', 'cook', 'builder', 'blacksmith']);
    const who = L.npcs
      .filter((r) => alive(r) && r.age === 'adult' && !r.away && !r.leaving && !r.traveler && !r.errand && !r.visitor && !r.migrated && !busy.has(r.job) && !r.sick && (r.hp ?? 1) > (r.maxHp || 10) * 0.6)
      .sort((a, b) => (a.job ? 1 : 0) - (b.job ? 1 : 0) || (a.coins || 0) - (b.coins || 0))[0];
    if (!who) return false;
    L.econ.treasury -= pay;
    const arrive = now + hours * 60;
    q.status = 'carried';
    q.arrive = arrive;
    q.carrier = `${who.name.first} ${who.name.last}`;
    q.carrierIdx = who.idx;
    q.courier = true;
    // There and back, with a few hours' rest (and the answer) in between.
    who.errand = { letter: q.id, dest: q.to, arrive, ret: arrive + (4 + hours) * 60, pay };
    ledger(L, this.sim.today(), `${mayor.name.first} ${mayor.name.last} paid ${who.name.first} ${who.name.last} ¤${pay} to carry a letter to ${to.name}.`);
    if (who.ent && !who.ent.dead) {
      setOverride(who, now, now + 180, 'travel', { place: 'road', errand: true });
      who.leaving = true;
      who.ent.say(`A letter for ${to.name}? I'll see it gets there.`, 3);
    } else who.away = true;
    return true;
  }

  // A courier back from the road collects the pay.
  courierHome(L, rec, day) {
    const t = rec.errand;
    rec.errand = null;
    rec.away = false;
    rec.leaving = false;
    rec.coins = (rec.coins || 0) + t.pay;
    const dest = this.town(t.dest);
    ledger(L, day, `${rec.name.first} ${rec.name.last} came back from ${dest ? dest.name : 'the road'}, the mayor's letter delivered.`);
  }

  // The player offers to carry a waiting letter.
  playerTakes(q) {
    q.status = 'player';
    q.carrier = this.game.playerName;
  }

  forPlayer(to) {
    return this.letters.filter((q) => q.status === 'player' && q.to === to);
  }

  waitingFrom(sid) {
    return this.letters.filter((q) => q.from === sid && q.status === 'waiting' && q.kind !== 'reply');
  }

  // ------------------------------------------------------------ answering
  deliver(q) {
    q.status = 'delivered';
    const from = this.town(q.from);
    const to = this.town(q.to);
    const A = this.sim.layoutOf(q.from);
    const T = this.sim.layoutOf(q.to);
    const toRel = this.rel(T, q.from);
    const fromRel = this.rel(A, q.to);
    const day = this.game.day;
    const people = T.npcs.filter((r) => alive(r) && !r.migrated && !r.away);
    const reply = (kind, payload, text) => {
      ledger(T, day, text);
      const r = this.write(to, from, 'reply', { re: q.kind, answer: kind, ...payload });
      // Replies go straight back with whoever brought the letter.
      r.status = 'carried';
      r.carrier = q.carrier;
      r.arrive = this.sim.abs + this.travelHours(to, from) * 60;
      return r;
    };
    // A town of a hostile realm won't help (or trade closer, or build a road).
    const realms = this.sim.realms;
    const hostile = realms && from.civ && to.civ && from.civ !== to.civ && realms.standing(from.civ, to.civ) === 'hostile';
    if (hostile && ['aid', 'guards', 'settlers', 'trade', 'road'].includes(q.kind)) return reply('no', {}, `${to.name} refused ${from.name}'s letter: the ${from.civ.name} are no friends of ours.`);
    switch (q.kind) {
      case 'aid': {
        const can = T.econ.treasury > Math.max(150, people.length * 12) && toRel.trust >= -10;
        if (can) {
          const amount = Math.round(Math.min(q.payload.amount, T.econ.treasury * 0.2));
          T.econ.treasury -= amount;
          toRel.trust += 5;
          return reply('yes', { amount }, `${to.name} sent ¤${amount} to help ${from.name}.`);
        }
        return reply('no', {}, `${to.name} could not spare money for ${from.name}.`);
      }
      case 'guards': {
        const guards = people.filter((r) => r.job === 'guard');
        if (guards.length > 3 && toRel.trust >= 0) {
          const g = guards.sort((a, b) => (b.personality.sociability) - (a.personality.sociability))[0];
          this.sim.sendPeople(T, [g], A, 'answered a call for guards');
          return reply('yes', { name: `${g.name.first} ${g.name.last}` }, `${g.name.first} ${g.name.last} of the watch left to serve in ${from.name}.`);
        }
        return reply('no', {}, `${to.name} could not spare a guard for ${from.name}.`);
      }
      case 'settlers': {
        const houses = T.buildings.filter((b) => b.residential && b.household);
        const fam = houses.map((b) => people.filter((r) => r.home === b.id)).find((list) => list.length >= 2 && list.length <= 4 && list.every((r) => r.job !== 'mayor' && r.job !== 'guard'));
        if (people.length > 20 && fam && toRel.trust >= 0) {
          this.sim.sendPeople(T, fam, A, 'went to settle');
          return reply('yes', { name: fam[0].name.last }, `The ${fam[0].name.last} family left to settle in ${from.name}.`);
        }
        return reply('no', {}, `Nobody in ${to.name} wanted to move to ${from.name}.`);
      }
      case 'gift':
        T.econ.treasury += q.payload.amount;
        toRel.trust += 15;
        // (A gift across a border warms the realms a little too.)
        if (realms && from.civ && to.civ && from.civ !== to.civ) realms.shift(from.civ, to.civ, 3, day);
        ledger(T, day, `${from.name} sent a gift of ¤${q.payload.amount}. Relations are warm.`);
        return null;
      case 'trade':
        if (toRel.trust >= 5) {
          toRel.trade = Math.min(3, toRel.trade + 1);
          toRel.trust += 5;
          return reply('yes', {}, `${to.name} agreed to closer trade with ${from.name}.`);
        }
        return reply('no', {}, `${to.name} turned down closer trade with ${from.name}.`);
      case 'road':
        if (toRel.trust >= 15 && T.econ.treasury >= 150) {
          T.econ.treasury -= 100;
          toRel.road = true;
          this.startRoad(from, to);
          return reply('yes', {}, `${to.name} agreed to build a road to ${from.name}.`);
        }
        return reply('no', {}, `${to.name} said it can't afford a road to ${from.name} yet.`);
      case 'warn': {
        const list = this.warnings.get(q.to) || [];
        if (!list.some((w) => w.from === q.from && w.crimes >= q.payload.crimes)) list.push({ from: q.from, fromName: from.name, day, crimes: q.payload.crimes, exiled: q.payload.exiled });
        this.warnings.set(q.to, list);
        this.sim.areaCache.delete(q.to);
        ledger(T, day, `${from.name} warned us about ${q.payload.name}: ${q.payload.exiled ? 'banished for their crimes' : `convicted ${q.payload.crimes} time${q.payload.crimes > 1 ? 's' : ''}`}.`);
        return null;
      }
      case 'reply': {
        const p = q.payload;
        if (p.answer === 'yes') {
          fromRel.trust += 10;
          if (p.re === 'aid') {
            T.econ.treasury += p.amount;
            ledger(T, day, `¤${p.amount} arrived from ${from.name} for the treasury.`);
            if (T.econ.wants && T.econ.treasury >= 180) T.econ.supplyDay = -99;
          } else if (p.re === 'trade') {
            toRel.trade = Math.min(3, toRel.trade + 1);
            ledger(T, day, `${from.name} agreed to closer trade. Merchants will come more often.`);
          } else if (p.re === 'road') {
            toRel.road = true;
            T.econ.treasury -= Math.min(100, T.econ.treasury);
            ledger(T, day, `${from.name} agreed to a road. Work starts from both ends.`);
          } else ledger(T, day, `${from.name} answered our letter: yes.`);
        } else {
          fromRel.trust -= 3;
          ledger(T, day, `${from.name} answered our letter: they can't help.`);
        }
        return null;
      }
      default:
        return null;
    }
  }

  // ------------------------------------------------------------ roads
  // A path laid tile by tile between two towns' nearest entrances, with
  // plank bridges over water. The builders lay a stretch every day.
  startRoad(a, b) {
    if (this.roads.some((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) return null;
    const LA = this.sim.layoutOf(a.id);
    const LB = this.sim.layoutOf(b.id);
    // From the end of a main street (a city's gateway), whichever faces the
    // other town best.
    const ends = (L, other) => {
      const ox = (other.bounds.x0 + other.bounds.x1) / 2;
      const oz = (other.bounds.z0 + other.bounds.z1) / 2;
      return L.roadEnds().reduce((m, q) => (Math.hypot(q.x + q.dx * 8 - ox, q.z + q.dz * 8 - oz) < Math.hypot(m.x + m.dx * 8 - ox, m.z + m.dz * 8 - oz) ? q : m));
    };
    const e0 = ends(LA, b);
    const e1 = ends(LB, a);
    const t = this.game.world.terrain;
    const tiles = [];
    const inTown = (x, z) => [a, b].some((s) => x >= s.bounds.x0 && x <= s.bounds.x1 && z >= s.bounds.z0 && z <= s.bounds.z1);
    const seen = new Set();
    const lay = (cx, cz, across) => {
      for (const [x, z] of [[cx, cz], [cx + across[0], cz + across[1]]]) {
        const k = x * 65536 + z;
        if (seen.has(k) || inTown(x, z)) continue;
        seen.add(k);
        const col = t.column(x, z, t.context(x, z, x, z), {});
        if (col.water >= 0) tiles.push([x, col.water, z, B.planks]);
        else tiles.push([x, col.h, z, B.path]);
      }
    };
    // Two tiles wide: beside each tile along the way, another (below it on
    // a road running east-west, beside it on one running north-south).
    const walk = (p0, p1) => {
      const steps = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.z - p0.z));
      const across = Math.abs(p1.x - p0.x) >= Math.abs(p1.z - p0.z) ? [0, 1] : [1, 0];
      let px = p0.x;
      let pz = p0.z;
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(p0.x + ((p1.x - p0.x) * i) / Math.max(1, steps));
        const z = Math.round(p0.z + ((p1.z - p0.z) * i) / Math.max(1, steps));
        // Keep the path 4-connected so it can be walked.
        for (const [cx, cz] of x !== px && z !== pz ? [[x, pz], [x, z]] : [[x, z]]) lay(cx, cz, across);
        px = x;
        pz = z;
      }
    };
    // Straight out of the gate for a stretch, then across the country, and
    // straight in at the other end.
    const out = (e, B0) => {
      const n = Math.max(0, e.dx < 0 ? e.x - B0.x0 : e.dx > 0 ? B0.x1 - e.x : e.dz < 0 ? e.z - B0.z0 : B0.z1 - e.z) + 6;
      return { x: e.x + e.dx * n, z: e.z + e.dz * n };
    };
    const q0 = out(e0, a.bounds);
    const q1 = out(e1, b.bounds);
    walk(e0, q0);
    walk(q0, q1);
    walk(q1, e1);
    const road = { a: a.id, b: b.id, tiles, built: 0, done: false, start: this.game.day };
    this.roads.push(road);
    return road;
  }

  // The builders of both towns work toward each other from their own
  // ends, a tile at a time through the working day (no stretch appears at
  // once), and it's done when they meet.
  buildRoads(now = this.sim.abs) {
    for (const r of this.roads) {
      if (r.done) continue;
      if (r.fromA === undefined) {
        r.fromA = r.built || 0;
        r.fromB = 0;
      }
      if (r.last === undefined) r.last = now;
      let work = 0;
      for (let t = r.last; t < now;) {
        const d0 = Math.floor(t / DAY) * DAY;
        const a = Math.max(t, d0 + 420);
        const b = Math.min(now, d0 + 1140);
        if (b > a) work += b - a;
        t = d0 + DAY;
      }
      r.last = now;
      r.work = (r.work || 0) + work;
      const ops = [];
      const clear = (x, y, z, id) => {
        ops.push([x, y, z, id, 0]);
        // Clear brush and trunks off the way (only those, whenever it loads).
        for (let yy = y + 1; yy <= y + 6; yy++) ops.push([x, yy, z, B.air, 0, 'soft']);
      };
      while (r.work >= ROAD_MIN_PER_TILE && r.fromA + r.fromB < r.tiles.length) {
        r.work -= ROAD_MIN_PER_TILE;
        // Both ends at once, one tile each.
        for (const end of ['A', 'B']) {
          if (r.fromA + r.fromB >= r.tiles.length) break;
          const i = end === 'A' ? r.fromA++ : r.tiles.length - 1 - r.fromB++;
          clear(...r.tiles[i]);
        }
      }
      r.built = r.fromA + r.fromB;
      if (ops.length) this.sim.setBlocks(ops.filter((op) => !this.game.world.regionAt(op[0], op[2]) || this.clearable(op)));
      if (r.built >= r.tiles.length) {
        r.done = true;
        for (const [sa, sb] of [[r.a, r.b], [r.b, r.a]]) {
          const L = this.sim.layoutOf(sa);
          this.rel(L, sb).road = true;
          ledger(L, this.game.day, `The road to ${this.town(sb).name} is finished. Travel there is twice as quick.`);
        }
      }
    }
  }

  // Only the ground itself, plants and tree trunks give way to a road.
  clearable([x, y, z, id]) {
    const cur = this.game.world.getBlock(x, y, z);
    if (id !== B.air) return cur !== B.planks && cur !== B.path;
    return SOFT.has(cur);
  }

  // Road tiles for the world map (map squares).
  roadCells() {
    const out = new Set();
    for (const r of this.roads) {
      const done = [...r.tiles.slice(0, r.fromA ?? r.built), ...(r.fromB ? r.tiles.slice(-r.fromB) : [])];
      for (const [x, , z] of done) out.add(Math.floor(z / REGION_D) * 10000 + Math.floor(x / REGION_W));
    }
    return out;
  }

  // ------------------------------------------------------------ warnings
  // Towns that were warned about you think less of you.
  penalty(sid) {
    const list = this.warnings.get(sid);
    if (!list || !list.length) return 0;
    return Math.min(25, list.reduce((n, w) => n + (w.exiled ? 12 : 4 + w.crimes * 2), 0));
  }

  warnedBy(sid) {
    return this.warnings.get(sid) || [];
  }

  // ------------------------------------------------------------ time
  update() {
    const now = this.sim.abs;
    for (const q of this.letters) if (q.status === 'carried' && now >= q.arrive) this.deliver(q);
    this.courier(now);
    this.buildRoads(now);
    if (this.letters.length > 60) this.letters = this.letters.filter((q) => q.status !== 'delivered' || now - q.arrive < 3 * DAY);
  }

  serialize() {
    return { letters: this.letters, roads: this.roads, warnings: [...this.warnings], next: this.next };
  }

  load(d) {
    if (!d) return;
    this.letters = d.letters || [];
    this.roads = d.roads || [];
    this.warnings = new Map(d.warnings || []);
    this.next = d.next || 1;
  }
}
