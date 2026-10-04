// Trade ships (see tech.js). A town by the sea or on a river, in a realm
// that has learned to build them, runs a plank pier out into the water and
// launches a great ship. Every few days it sails with the town's merchants
// aboard (up to five) for a port abroad: three times as fast as the road,
// three times the goods in its hold, and a profit for the town when it
// comes home. Near you, you see it all (game/shipping.js): the ship at the
// pier, the merchants walking out along it to go aboard, the ship putting
// out and sailing off, and coming home again.
import { alive, ledger, DAY, packGoods, notableNews } from './econ.js';
import { deserted } from './civic.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { SURFACE, GROUND } from '../config.js';
import { B, planksOf } from '../world/blocks.js';
import { M } from '../world/settlement.js';

// What a town calls its ship, after its people.
const NAMES = {
  high: ['Iron Gull', 'Stonewake', 'Mountain Maid', 'Granite Swan', 'Highland Star'],
  north: ['Sea Wolf', 'Frostwake', 'Raven', 'Storm Bride', 'Long Serpent'],
  sun: ['Golden Dawn', 'Sand Lark', 'Saffron Queen', 'Desert Rose', 'Sun Barge'],
  wild: ['Green Heron', 'Mossback', 'Willow Song', 'Fern Runner', 'Otter'],
  vale: ['Good Harvest', 'Meadowlark', 'Fair Wind', 'Miller\'s Daughter', 'Bountiful'],
  ember: ['Ashwake', 'Black Glass', 'Ember Tongue', 'Kiln Daughter', 'Smoke Runner'],
  mist: ['Grey Lantern', 'Fog Moth', 'Heather Maid', 'Owl\'s Wing', 'Quiet Mere'],
  tide: ['Pearl Diver', 'Turtle Back', 'Swift Gull', 'Reef Dancer', 'Tide Bride'],
};
const DOCK_COST = 150;
const CREW = 5;

export class Ships {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.ports = {}; // town id -> { sid, site, state, name, voyage, next, voyages, earned }
  }

  port(sid) {
    return this.ports[sid] || null;
  }

  wet(s) {
    return !!(s && (s.coast || s.river));
  }

  // Where a pier can go: from a bit of open shore near the square, two
  // planks wide and four long, straight out over the water, with open water
  // beyond its end for the ship to lie in.
  dockSite(L) {
    const b = L.bounds;
    const P = L.plaza;
    const ok = (m) => m === M.FREE || m === M.ROAD || m === M.YARD || m === M.PLAZA || m === undefined;
    // (Open water: nothing of the town's on it, no bridge, no street.)
    const wet = (x, z) => {
      const c = L.col(x, z);
      const m = L.maskAt(x, z);
      return !!c && c.water >= 0 && (m === M.FREE || m === undefined);
    };
    // How far a ship could sail from a spot (out of sight of the town, it
    // must be able to get).
    const room = (x0, z0) => {
      const seen = new Set([x0 * 65536 + z0]);
      const q = [[x0, z0]];
      let far = 0;
      for (let i = 0; i < q.length && q.length < 1500 && far < 30; i++) {
        const [x, z] = q[i];
        far = Math.max(far, Math.hypot(x - x0, z - z0));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (x + dx) * 65536 + z + dz;
          if (seen.has(k) || !wet(x + dx, z + dz)) continue;
          seen.add(k);
          q.push([x + dx, z + dz]);
        }
      }
      return far;
    };
    const dry = (x, z) => {
      const c = L.col(x, z);
      return !!c && c.water < 0 && c.h === SURFACE && ok(L.maskAt(x, z));
    };
    let best = null;
    for (let z = b.z0 - 14; z <= b.z1 + 14; z++) {
      for (let x = b.x0 - 14; x <= b.x1 + 14; x++) {
        if (!dry(x, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const [px, pz] = [-dz, dx];
          let fit = true;
          for (let k = 1; k <= 7 && fit; k++) {
            if (!wet(x + dx * k, z + dz * k)) fit = false;
            else if (k <= 4 && !wet(x + dx * k + px, z + dz * k + pz)) fit = false;
          }
          if (!fit) continue;
          const score = Math.hypot(x - P.cx, z - P.cz);
          if (best && score >= best.score) continue;
          if (room(x + dx * 6, z + dz * 6) < 22) continue;
          best = { x, z, dx, dz, px, pz, score };
        }
      }
    }
    if (!best) return null;
    const { x, z, dx, dz, px, pz } = best;
    return {
      root: { x, z },
      dir: { x: dx, z: dz },
      // Where you step off at the far end, and where the ship lies.
      end: { x: x + dx * 4, z: z + dz * 4 },
      moor: { x: x + dx * 6, z: z + dz * 6 },
      tiles: [1, 2, 3, 4].flatMap((k) => [[x + dx * k, z + dz * k], [x + dx * k + px, z + dz * k + pz]]),
      side: { x: px, z: pz },
    };
  }

  pierBlocks(site, style = 'vale') {
    // (In the people's own wood: see blocks.planksOf.)
    const ops = site.tiles.map(([x, z]) => [x, SURFACE, z, planksOf(style), 0]);
    // A bollard to tie up to, at the end on the side plank; barrels at the
    // landward end.
    const [ex, ez] = site.tiles[site.tiles.length - 1];
    ops.push([ex, GROUND, ez, B.fence, 0]);
    const [rx, rz] = site.tiles[1];
    ops.push([rx, GROUND, rz, B.barrel, 0]);
    return ops;
  }

  // ------------------------------------------------------------ daily
  daily(L, day, rng) {
    const s = L.settlement;
    if (deserted(s) || s.condition === 'abandoned' || !this.wet(s)) return null;
    const knows = this.sim.tech.has(s, 'trade_ships');
    let P = this.ports[s.id];
    if (!knows && (!P || P.state === 'planned')) return null;
    if (!P) {
      // (Nowhere for a pier: looked for again now and then, as the town
      // changes, not every day.)
      if (L.econ.noDock !== undefined && day - L.econ.noDock < 7) return null;
      const site = this.dockSite(L);
      if (!site) {
        L.econ.noDock = day;
        return null;
      }
      delete L.econ.noDock;
      const names = NAMES[s.style] || NAMES.vale;
      P = this.ports[s.id] = { sid: s.id, site, state: 'planned', name: names[hash4(s.id, s.seed >>> 0, 0x5b1) % names.length], voyage: null, next: day, voyages: 0, earned: 0 };
    }
    // The pier first, when the town can pay for it.
    if (P.state === 'planned') {
      if (L.econ.treasury < DOCK_COST + 30 || this.sim.works.active(s.id).some((q) => q.kind === 'dock')) return null;
      const xs = P.site.tiles.map((t) => t[0]);
      const zs = P.site.tiles.map((t) => t[1]);
      const p = this.sim.works.add({ sid: s.id, kind: 'dock', blocks: this.pierBlocks(P.site, s.style || 'vale'), bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, bid: L.buildings.length - 0.2, label: 'building a harbour pier' });
      L.econ.treasury -= DOCK_COST;
      P.state = 'building';
      P.project = p.id;
      ledger(L, day, `${s.name} has paid ¤${DOCK_COST} for a harbour: a pier for the great ship the shipwrights are building.`);
      return { building: p };
    }
    if (P.state === 'building') {
      const p = this.sim.works.projects.find((q) => q.id === P.project);
      if (p && !p.done) return null;
      P.state = 'docked';
      P.next = day + 1;
      ledger(L, day, `The ${P.name} was launched at ${s.name}'s new pier: a great ship, for trade with ports abroad.`);
      return { launched: P };
    }
    // (Taken by a realm that doesn't know how to sail her: she stays tied up.)
    if (P.state === 'docked' && knows && day >= P.next && !P.voyage) return { voyage: this.voyage(L, P, day, rng) };
    return null;
  }

  // Off on a voyage: a port abroad, the merchants aboard with their wares.
  voyage(L, P, day, rng) {
    const s = L.settlement;
    const sim = this.sim;
    if (sim.war.unsafe(s)) {
      P.next = day + 1;
      return null;
    }
    const ow = this.game.world.ow;
    const feel = (o) => (s.civ && o.civ && s.civ !== o.civ ? sim.realms.standing(s.civ, o.civ) : null);
    const ports = ow.settlements.filter((o) => o.id !== s.id && !deserted(o) && o.condition !== 'abandoned' && this.wet(o) && feel(o) !== 'hostile' && !sim.war.unsafe(o)
      && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 30);
    if (!ports.length) {
      P.next = day + 3;
      return null;
    }
    // (Further is worth more; a friendly port most of all.)
    const dest = rng.weighted(ports.map((o) => [o, (1 + Math.hypot(o.cx - s.cx, o.cz - s.cz) / 6) * (feel(o) === 'friendly' ? 1.6 : 1)]));
    const now = sim.abs;
    const depart = Math.max(Math.round(now) + 60, day * DAY + 9 * 60 + rng.int(0, 60));
    const travel = Math.max(2, Math.round(sim.diplomacy.travelHours(s, dest) / 3));
    const arrive = depart + travel * 60;
    const leave = arrive + rng.int(4, 6) * 60;
    const back = leave + travel * 60;
    const crew = L.npcs.filter((r) => alive(r) && r.job === 'merchant' && r.age === 'adult' && !r.away && !r.migrated && !r.visitor
      && (!r.trip || r.trip.phase === 'home') && r.ruler === undefined && r.captive === undefined && r.soldier === undefined).slice(0, CREW);
    const v = { dest: dest.id, destName: dest.name, depart, arrive, leave, back, crew: crew.map((r) => r.idx), dist: Math.hypot(dest.cx - s.cx, dest.cz - s.cz) };
    P.voyage = v;
    // Each merchant aboard: their wares (three times what they'd carry by
    // road) to sell at the other end, where they're seen at the market.
    for (const rec of crew) {
      const goods = packGoods(L, rec, new RNG(hash4(rec.idx, day, 0x5b2)));
      for (const k of Object.keys(goods)) goods[k] *= 3;
      // (Home a little after she ties up, so they can walk off the pier.)
      const t = (rec.trip = { phase: 'away', dest: dest.id, depart, arrive, ret: back + 20, goods, earned: 0, since: day, ship: s.id });
      const visit = {
        id: `m${s.id}:${rec.idx}:${depart}`, from: s.id, fromName: s.name, fromIdx: rec.idx, name: rec.name, style: s.style, look: rec.look, tier: rec.tier,
        goods, arrive, leave, coins: Math.max(10, rec.coins), traded: false, earned: 0, mount: null, ship: P.name,
        news: notableNews(L, day - 5, 3),
      };
      if (!sim.visits.has(dest.id)) sim.visits.set(dest.id, []);
      sim.visits.get(dest.id).push(visit);
      t.visit = visit.id;
      // (About town still: down to the pier when it's time, see
      // game/shipping.js; gone, if they're out of sight before then.)
      if (!rec.ent || rec.ent.dead) rec.away = true;
      else rec.leaving = true;
    }
    ledger(L, day, `The ${P.name} sails for ${dest.name} this morning${crew.length ? `, ${crew.length} of the town's merchants aboard` : ' with a hold full of the town\'s goods'}.`);
    return v;
  }

  // Every tick: a ship home from her voyage, and what she earned; her
  // merchants ashore again a little after.
  update() {
    const now = this.sim.abs;
    for (const P of Object.values(this.ports)) {
      if (P.aboard && P.aboard.length) this.ashore(P, now);
      const v = P.voyage;
      if (!v || now < v.back) continue;
      const L = this.sim.layoutOf(P.sid);
      P.voyage = null;
      P.aboard = v.crew.slice();
      if (!L || !L.econ) continue;
      const s = L.settlement;
      const day = Math.floor(now / DAY);
      const rng = new RNG(hash4(P.sid, v.depart, 0x5b3));
      // The town's share: more for a longer voyage and more merchants aboard.
      const gain = clamp(Math.round(40 + v.crew.length * 18 + v.dist * 3 + rng.int(-10, 20)), 60, 200);
      L.econ.treasury += gain;
      P.earned += gain;
      P.voyages++;
      P.next = day + 2 + rng.int(0, 2);
      P.home = now;
      const dest = this.game.world.ow.settlements[v.dest];
      if (dest) this.sim.realms.noteTrade(dest, s, gain);
      ledger(L, day, `The ${P.name} is home from ${v.destName}: ¤${gain} into the treasury from the voyage.`);
    }
  }

  // The merchants off the ship and home (with what they made abroad).
  ashore(P, now) {
    const L = this.sim.layoutOf(P.sid);
    // (Still coming in to the pier, in front of you: not till she's tied up.)
    const e = this.game.shipProps && this.game.shipProps.get(P.sid);
    const coming = e && e.phase === 'in';
    P.aboard = P.aboard.filter((idx) => {
      const rec = L && L.npcs[idx];
      const t = rec && rec.trip;
      if (!rec || !alive(rec) || !t || t.ship !== P.sid || t.phase !== 'away') return false;
      if (now < t.ret || (coming && now < t.ret + 90)) return true;
      this.sim.returnMerchant(L, rec, Math.floor(now / DAY));
      return false;
    });
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { ports: this.ports };
  }

  load(d) {
    this.ports = (d && d.ports) || {};
  }
}
