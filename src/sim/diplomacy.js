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
import { MinHeap } from '../util/heap.js';
import { hash4 } from '../util/rng.js';
// Builder-minutes to lay one tile of road between towns (from each end).
const ROAD_MIN_PER_TILE = 20;

// What a road may clear out of its way: plants and tree trunks.
export const SOFT = new Set(['tall_grass', 'fern', 'bush', 'berry_bush', 'dead_bush', 'flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_purple',
  'mushroom_red', 'mushroom_brown', 'herb', 'rock', 'log_oak', 'log_birch', 'log_pine', 'log_palm', 'log_jungle', 'log_acacia', 'log_willow', 'cactus', 'sapling',
  // (and the leaves over it: a road through a wood is a cut through the trees)
  'leaves_oak', 'leaves_birch', 'leaves_pine', 'leaves_palm', 'leaves_jungle', 'leaves_acacia', 'leaves_willow', 'leaves_snowy'].map((k) => B[k]).filter((v) => v !== undefined));

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
    // (Caravan law: protected roads, quicker going.)
    const law = this.sim.tech && (this.sim.tech.has(a, 'caravan_law') || this.sim.tech.has(b, 'caravan_law'));
    return Math.round((3 + this.dist(a, b) * 1.5) * (road ? 0.5 : 1) * (law ? 0.8 : 1));
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
      // (A town on good terms with a neighbour, and with the coin, asks
      // for a road to it; a realm's towns get theirs from the capital too.)
      else if (o && !this.rel(L, o.id).road && e.treasury >= 160 && this.dist(o, s) < 9 && !this.roads.some((r) => (r.a === s.id && r.b === o.id) || (r.a === o.id && r.b === s.id))) letter = this.write(s, o, 'road');
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
    if (hostile && ['aid', 'guards', 'settlers', 'trade', 'road'].includes(q.kind)) return reply('no', {}, `${to.name} refused ${from.name}'s letter: the ${from.civ.name.replace(/^The /, '')} are no friends of ours.`);
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
        if (toRel.trust >= 10 && T.econ.treasury >= 120) {
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
    // Across country it winds: round lakes and hills, along the easier
    // ground, with a turn here and there (a stretch at a time).
    const pts = this.route(q0, q1, [a, b]);
    for (let i = 1; i < pts.length; i++) walk(pts[i - 1], pts[i]);
    walk(q1, e1);
    const road = { a: a.id, b: b.id, tiles, built: 0, done: false, start: this.game.day };
    this.roads.push(road);
    return road;
  }

  // The way across country between two points: a search over the land in
  // steps of a few paces, where water, steep ground and other towns cost
  // more, the lie of the land (a gentle noise) bends it, and every turn
  // costs a little (so it runs straight a while, then turns). Returns the
  // corners of the way, start and end included.
  route(p0, p1, towns = [], wet = 7) {
    const G = 4;
    const t = this.game.world.terrain;
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const dist = Math.max(Math.abs(dx), Math.abs(dz));
    if (dist < G * 2) return [p0, p1];
    const m = Math.max(3, Math.ceil((dist * 0.3) / G));
    const gx1 = Math.round(dx / G);
    const gz1 = Math.round(dz / G);
    const x0 = Math.min(0, gx1) - m;
    const x1 = Math.max(0, gx1) + m;
    const z0 = Math.min(0, gz1) - m;
    const z1 = Math.max(0, gz1) + m;
    const W = x1 - x0 + 1;
    const ctx = t.context(p0.x + x0 * G, p0.z + z0 * G, p0.x + x1 * G, p0.z + z1 * G);
    const seed = this.game.seed;
    const others = this.game.world.ow.settlements.filter((o) => !towns.includes(o));
    const cache = new Map();
    const land = (i, j) => {
      const k = (j - z0) * W + (i - x0);
      let v = cache.get(k);
      if (v) return v;
      const x = p0.x + i * G;
      const z = p0.z + j * G;
      const col = t.column(x, z, ctx, {});
      const town = others.some((o) => x >= o.bounds.x0 - 2 && x <= o.bounds.x1 + 2 && z >= o.bounds.z0 - 2 && z <= o.bounds.z1 + 2);
      // A smooth bend to the land (a few steps across), so the way meanders.
      const fx = (i + 1000) / 5;
      const fz = (j + 1000) / 5;
      const ix = Math.floor(fx);
      const iz = Math.floor(fz);
      const h = (a, b) => (hash4(seed, a, b, 0x40ad) % 1000) / 1000;
      const sx = fx - ix;
      const sz = fz - iz;
      const top = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * sx;
      const bot = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * sx;
      v = { h: col.h, water: col.water >= 0, town, bend: top + (bot - top) * sz };
      cache.set(k, v);
      return v;
    };
    // (A traveller's way also looks between the steps, for a stream there.)
    const edges = new Map();
    const between = (i, j, ni, nj) => {
      if (wet <= 7) return false;
      const k = ((j + nj - z0 * 2) * (W * 2 + 1) + (i + ni - x0 * 2)) | 0;
      let v = edges.get(k);
      if (v === undefined) {
        const x = Math.round(p0.x + ((i + ni) * G) / 2);
        const z = Math.round(p0.z + ((j + nj) * G) / 2);
        v = t.column(x, z, ctx, {}).water >= 0;
        edges.set(k, v);
      }
      return v;
    };
    const key = (i, j, d) => ((j - z0) * W + (i - x0)) * 5 + d;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const heap = new MinHeap();
    const best = new Map();
    const from = new Map();
    const start = key(0, 0, 4);
    best.set(start, 0);
    heap.push([0, 0, 4], Math.abs(gx1) + Math.abs(gz1));
    let end = null;
    let n = 0;
    while (heap.size && n++ < 40000) {
      const [i, j, d] = heap.pop();
      const k = key(i, j, d);
      if (i === gx1 && j === gz1) {
        end = k;
        break;
      }
      const g = best.get(k);
      const here = land(i, j);
      for (let q = 0; q < 4; q++) {
        const ni = i + DIRS[q][0];
        const nj = j + DIRS[q][1];
        if (ni < x0 || ni > x1 || nj < z0 || nj > z1) continue;
        const L = land(ni, nj);
        if (L.town) continue;
        let c = 1 + L.bend * 1.6 + Math.min(6, Math.abs(L.h - here.h) * 0.9) + (L.water ? wet : 0) + (between(i, j, ni, nj) ? wet / 2 : 0);
        if (d !== 4 && d !== q) c += 1.4;
        const nk = key(ni, nj, q);
        const ng = g + c;
        if (ng < (best.get(nk) ?? Infinity)) {
          best.set(nk, ng);
          from.set(nk, k);
          heap.push([ni, nj, q], ng + Math.abs(gx1 - ni) + Math.abs(gz1 - nj));
        }
      }
    }
    if (end === null) return [p0, p1];
    // Back from the end, keeping only the corners.
    const cells = [];
    for (let k = end; k !== undefined; k = from.get(k)) {
      const c = Math.floor(k / 5);
      cells.push([(c % W) + x0, Math.floor(c / W) + z0]);
    }
    cells.reverse();
    const out = [p0];
    for (let i = 1; i < cells.length - 1; i++) {
      const [a0, b0] = cells[i - 1];
      const [a1, b1] = cells[i];
      const [a2, b2] = cells[i + 1];
      if (a1 - a0 !== a2 - a1 || b1 - b0 !== b2 - b1) out.push({ x: p0.x + a1 * G, z: p0.z + b1 * G });
    }
    // (The search ends on the step nearest the far point: a short last leg.)
    out.push({ x: p0.x + gx1 * G, z: p0.z + gz1 * G });
    if (out[out.length - 1].x !== p1.x || out[out.length - 1].z !== p1.z) out.push({ x: out[out.length - 1].x, z: p1.z }, p1);
    return out;
  }

  // ------------------------------------------------------------ the way
  // How a traveller goes from town a to town b: down the road if one's
  // finished, else across country by land, round lakes and rivers (only a
  // crossing there's no way round goes over water). A list of points from
  // a's middle to b's, with the distance along it at each.
  way(a, b) {
    const road = this.roads.find((r) => r.done && r.tiles && r.tiles.length && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)));
    const k = `${a.id}>${b.id}${road ? 'r' : ''}`;
    if (!this.ways) this.ways = new Map();
    let w = this.ways.get(k);
    if (w) return w;
    const centre = (s) => ({ x: Math.floor((s.bounds.x0 + s.bounds.x1) / 2), z: Math.floor((s.bounds.z0 + s.bounds.z1) / 2) });
    const c0 = centre(a);
    const c1 = centre(b);
    // (Working a way out across country takes a moment: one at a time, and
    // until it's ready, the straight line will do.)
    const busy = !road && (this.wayBudget ?? 1) <= 0;
    if (busy) return { pts: [c0, c1], at: [0, Math.hypot(c1.x - c0.x, c1.z - c0.z) || 1], len: Math.hypot(c1.x - c0.x, c1.z - c0.z) || 1, road: false, rough: true };
    if (!road) this.wayBudget = (this.wayBudget ?? 1) - 1;
    let pts;
    if (road) {
      // (A road's tiles go two abreast: one of each pair is enough.)
      const tl = road.a === a.id ? road.tiles : road.tiles.slice().reverse();
      pts = [c0];
      for (const t of tl) {
        const q = pts[pts.length - 1];
        if (Math.abs(t[0] - q.x) + Math.abs(t[2] - q.z) >= 2) pts.push({ x: t[0], z: t[2] });
      }
      pts.push(c1);
    } else pts = this.route(c0, c1, [a, b], 40);
    const at = [0];
    for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    w = { pts, at, len: at[at.length - 1] || 1, road: !!road };
    this.ways.set(k, w);
    if (this.ways.size > 200) this.ways.delete(this.ways.keys().next().value);
    return w;
  }

  // The point a distance s along a way.
  wayAt(w, s) {
    const { pts, at } = w;
    s = Math.max(0, Math.min(w.len, s));
    let i = 1;
    while (i < pts.length - 1 && at[i] < s) i++;
    const seg = at[i] - at[i - 1] || 1;
    const f = Math.max(0, Math.min(1, (s - at[i - 1]) / seg));
    return { x: Math.round(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f), z: Math.round(pts[i - 1].z + (pts[i].z - pts[i - 1].z) * f) };
  }

  // How far along a way the point nearest (x, z) is.
  wayNear(w, x, z) {
    const { pts, at } = w;
    let best = 0;
    let bd = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x;
      const az = pts[i - 1].z;
      const dx = pts[i].x - ax;
      const dz = pts[i].z - az;
      const L2 = dx * dx + dz * dz || 1;
      const f = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(ax + dx * f - x, az + dz * f - z);
      if (d < bd) {
        bd = d;
        best = at[i - 1] + (at[i] - at[i - 1]) * f;
      }
    }
    return best;
  }

  // The builders of both towns work toward each other from their own
  // ends, a tile at a time through the working day (no stretch appears at
  // once), and it's done when they meet. Each end goes at the pace of its
  // own town's builders (none, and that end waits).
  buildRoads(now = this.sim.abs) {
    for (const r of this.roads) {
      if (r.done) continue;
      if (r.fromA === undefined) {
        r.fromA = r.built || 0;
        r.fromB = 0;
      }
      if (r.workA === undefined) {
        r.workA = (r.work || 0) / 2;
        r.workB = (r.work || 0) / 2;
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
      const ops = [];
      const clear = (x, y, z, id) => {
        ops.push([x, y, z, id, 0]);
        // Clear brush and trunks off the way (only those, whenever it loads).
        for (let yy = y + 1; yy <= y + 9; yy++) ops.push([x, yy, z, B.air, 0, 'soft']);
      };
      for (const end of ['A', 'B']) {
        const sid = end === 'A' ? r.a : r.b;
        const n = this.crewSize(sid);
        if (!n) continue;
        const k = `work${end}`;
        r[k] += work * (n > 1 ? 1.4 : 1) * this.roadPace(sid);
        while (r[k] >= ROAD_MIN_PER_TILE && r.fromA + r.fromB < r.tiles.length) {
          r[k] -= ROAD_MIN_PER_TILE;
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

  // The town's builders (two at most go out on a road).
  roadCrew(sid) {
    const L = this.sim.layoutOf(sid);
    if (!L || deserted(L.settlement)) return [];
    return L.npcs.filter((r) => alive(r) && r.job === 'builder' && r.age === 'adult' && !r.migrated).slice(0, 2);
  }

  crewSize(sid) {
    return this.roadCrew(sid).length;
  }

  // Surveyors (a realm that has learned to) lay a road quicker.
  roadPace(sid) {
    const s = this.town(sid);
    return this.sim.tech && this.sim.tech.has(s, 'surveying') ? 1.5 : 1;
  }

  // Where a road's end is being built now: the next tile from that end.
  frontier(r, end) {
    // (A road just begun hasn't had its first stretch reckoned yet.)
    const fa = r.fromA ?? r.built ?? 0;
    const fb = r.fromB ?? 0;
    if (r.done || fa + fb >= r.tiles.length) return null;
    const i = end === 'A' ? fa : r.tiles.length - 1 - fb;
    const t = r.tiles[i];
    return t ? { x: t[0], y: t[1], z: t[2], i } : null;
  }

  // Through the working day, the builders on a road go out to it (and are
  // off the town's streets), and come home of an evening.
  crews(now = this.sim.abs) {
    const m = now % DAY;
    const out = m >= 450 && m < 1050;
    const wanted = new Map();
    if (out) {
      for (const r of this.roads) {
        if (r.done) continue;
        const k = `${r.a}:${r.b}`;
        for (const end of ['A', 'B']) for (const rec of this.roadCrew(end === 'A' ? r.a : r.b)) if (!wanted.has(rec)) wanted.set(rec, { k, end });
      }
    }
    for (const [rec, job] of wanted) {
      if (rec.roadwork) continue;
      if (rec.away || rec.leaving || rec.trip || rec.errand || rec.sick || rec.walkHome) continue;
      const sid = Number(job.end === 'A' ? job.k.split(':')[0] : job.k.split(':')[1]);
      const L = this.sim.layoutOf(sid);
      const road = this.roads.find((r) => `${r.a}:${r.b}` === job.k);
      rec.roadwork = job;
      rec.away = true;
      const a = L && this.game.active.get(L.settlement.id);
      const n = rec.ent;
      if (n && !n.dead && a && road) {
        // Off out of town with their shovels, and on down the road to
        // the end of it (walking every step).
        const slot = this.roadCrew(sid).indexOf(rec);
        n.state = 'roadwork';
        n.crew = { road, end: job.end, slot: Math.max(0, slot) };
        n.activity = null;
        n.goal = null;
        n.path = null;
        n.sleeping = false;
        n.releaseSpot?.();
        const at = a.npcs.indexOf(n);
        if (at >= 0) a.npcs.splice(at, 1);
      }
    }
    // Home again (or the road's done): walking back, if you can see them.
    for (const L of this.game.world.layouts.values()) {
      if (!L.econ) continue;
      for (const rec of L.npcs) {
        const n = rec.ent && !rec.ent.dead ? rec.ent : null;
        // (Home by now, wherever they were walking.)
        if (rec.walkHome && !n) {
          rec.walkHome = false;
          rec.away = false;
        }
        if (!rec.roadwork || wanted.has(rec)) continue;
        rec.roadwork = null;
        rec.leaving = false;
        if (rec.override && rec.override.act === 'travel') rec.override = null;
        if (n && n.state === 'roadwork') {
          n.state = 'roadhome';
          rec.walkHome = true;
        } else rec.away = false;
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
    this.wayBudget = 1;
    for (const q of this.letters) if (q.status === 'carried' && now >= q.arrive) this.deliver(q);
    this.courier(now);
    this.buildRoads(now);
    this.crews(now);
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
