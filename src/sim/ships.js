// Trade ships (see tech.js). A town by the sea or on a river, in a realm
// that has learned to build them, runs a plank pier out into the water and
// launches a great ship. Every few days it sails with the town's merchants
// aboard (up to five) for a port abroad: three times as fast as the road,
// three times the goods in its hold, and a profit for the town when it
// comes home. Near you, you see it all (game/shipping.js): the ship at the
// pier, the merchants walking out along it to go aboard, the ship putting
// out and sailing off, and coming home again.
import { alive, ledger, DAY, packGoods, notableNews, setOverride } from './econ.js';
import { deserted } from './civic.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { SURFACE, GROUND } from '../config.js';
import { B, planksOf } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { farTable } from '../world/farlands.js';

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
Object.assign(NAMES, farTable('ships'));
const CREW = 5;
// (Round 73) Every town on the coast has a dock, as big as the town: a
// little plank jetty for a village, a broad pier with posts for a town, a
// long pier with a T-head and lamps for a city. It grows with the town.
export const DOCKS = {
  small: { len: 4, wide: 2, cost: 40, rank: 0, label: 'a jetty' },
  medium: { len: 6, wide: 3, cost: 90, rank: 1, label: 'a pier' },
  large: { len: 8, wide: 3, head: 2, cost: 150, rank: 2, label: 'a harbour pier' },
};
export const dockSizeFor = (s) => (s && (s.empire || s.type === 'city') ? 'large' : s && s.type === 'town' ? 'medium' : 'small');

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
  dockSite(L, size = 'small') {
    const D = DOCKS[size] || DOCKS.small;
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
    const len = D.len;
    const head = D.head || 0;
    let best = null;
    for (let z = b.z0 - 14; z <= b.z1 + 14; z++) {
      for (let x = b.x0 - 14; x <= b.x1 + 14; x++) {
        if (!dry(x, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const [px, pz] = [-dz, dx];
          let fit = true;
          for (let k = 1; k <= len + 3 && fit; k++) {
            if (!wet(x + dx * k, z + dz * k)) fit = false;
            else if (k <= len) for (let w = 1; w < D.wide && fit; w++) if (!wet(x + dx * k + px * w, z + dz * k + pz * w)) fit = false;
          }
          // (A city's T-head: the end of the pier runs out to either side.)
          for (let k = len - 1; k <= len && fit && head; k++) {
            for (let w = -head; w < D.wide + head && fit; w++) if (!wet(x + dx * k + px * w, z + dz * k + pz * w)) fit = false;
          }
          if (!fit) continue;
          const score = Math.hypot(x - P.cx, z - P.cz);
          if (best && score >= best.score) continue;
          if (room(x + dx * (len + 2), z + dz * (len + 2)) < 22) continue;
          best = { x, z, dx, dz, px, pz, score };
        }
      }
    }
    if (!best) return null;
    const { x, z, dx, dz, px, pz } = best;
    const tiles = [];
    const seen = new Set();
    const put = (tx, tz) => {
      const k = `${tx},${tz}`;
      if (seen.has(k)) return;
      seen.add(k);
      tiles.push([tx, tz]);
    };
    for (let k = 1; k <= len; k++) for (let w = 0; w < D.wide; w++) put(x + dx * k + px * w, z + dz * k + pz * w);
    if (head) for (let k = len - 1; k <= len; k++) for (let w = -head; w < D.wide + head; w++) put(x + dx * k + px * w, z + dz * k + pz * w);
    // Posts along its outer edges every few planks (a medium pier and up),
    // lamps at the head of a city's.
    const posts = [];
    const lamps = [];
    if (D.rank >= 1) {
      for (let k = 2; k <= len; k += 3) {
        posts.push([x + dx * k + px * (D.wide - 1), z + dz * k + pz * (D.wide - 1)]);
        if (k < len - 1 || !head) posts.push([x + dx * k, z + dz * k]);
      }
    }
    if (head) {
      lamps.push([x + dx * len - px * head, z + dz * len - pz * head], [x + dx * len + px * (D.wide - 1 + head), z + dz * len + pz * (D.wide - 1 + head)]);
    }
    return {
      size,
      root: { x, z },
      dir: { x: dx, z: dz },
      // Where you step off at the far end, and where the ship lies.
      end: { x: x + dx * len, z: z + dz * len },
      moor: { x: x + dx * (len + 2), z: z + dz * (len + 2) },
      tiles,
      posts,
      lamps,
      side: { x: px, z: pz },
    };
  }

  pierBlocks(site, style = 'vale') {
    // (In the people's own wood: see blocks.planksOf.)
    const ops = site.tiles.map(([x, z]) => [x, SURFACE, z, planksOf(style), 0]);
    const used = new Set();
    // A bollard to tie up to, at the end on the side plank; barrels at the
    // landward end.
    const D = DOCKS[site.size] || DOCKS.small;
    const [ex, ez] = [site.end.x + site.side.x * (D.wide - 1), site.end.z + site.side.z * (D.wide - 1)];
    ops.push([ex, GROUND, ez, B.fence, 0]);
    used.add(`${ex},${ez}`);
    for (const [x, z] of site.posts || []) {
      if (used.has(`${x},${z}`)) continue;
      used.add(`${x},${z}`);
      ops.push([x, GROUND, z, B.fence, 0]);
    }
    for (const [x, z] of site.lamps || []) {
      if (used.has(`${x},${z}`)) continue;
      used.add(`${x},${z}`);
      ops.push([x, GROUND, z, B.fence, 0], [x, GROUND + 1, z, B.lantern, 0]);
    }
    const [rx, rz] = site.tiles[1];
    if (!used.has(`${rx},${rz}`)) ops.push([rx, GROUND, rz, B.barrel, 0]);
    // (A crate or two on a bigger pier.)
    if (site.size && site.size !== 'small' && site.tiles[3]) {
      const [cx, cz] = site.tiles[site.tiles.length > 8 ? 5 : 3];
      if (!used.has(`${cx},${cz}`)) ops.push([cx, GROUND, cz, B.crate, 0]);
    }
    return ops;
  }

  // ------------------------------------------------------------ daily
  daily(L, day, rng) {
    const s = L.settlement;
    if (deserted(s) || s.condition === 'abandoned' || !this.wet(s)) return null;
    const knows = this.sim.tech.has(s, 'trade_ships');
    let P = this.ports[s.id];
    // (Round 73) A town on the coast always has a dock; on a river, only
    // once it knows how to build ships.
    const first = L.econ.dockChecked === undefined;
    L.econ.dockChecked = day;
    if (!s.coast && !knows && (!P || P.state === 'planned')) return null;
    const want = dockSizeFor(s);
    if (!P) {
      // (Nowhere for a pier: looked for again now and then, as the town
      // changes, not every day.)
      if (L.econ.noDock !== undefined && day - L.econ.noDock < 7) return null;
      let site = null;
      for (const size of ['large', 'medium', 'small'].slice(2 - DOCKS[want].rank)) if ((site = this.dockSite(L, size))) break;
      if (!site) {
        L.econ.noDock = day;
        return null;
      }
      delete L.econ.noDock;
      const names = NAMES[s.style] || NAMES.vale;
      P = this.ports[s.id] = { sid: s.id, site, size: site.size, ship: knows, state: 'planned', name: names[hash4(s.id, s.seed >>> 0, 0x5b1) % names.length], voyage: null, next: day, voyages: 0, earned: 0 };
      // (There from the first: a town that's always been on the coast has
      // always had its dock.)
      if (first) {
        const xs = site.tiles.map((t) => t[0]);
        const zs = site.tiles.map((t) => t[1]);
        const p = this.sim.works.add({ sid: s.id, kind: 'dock', blocks: this.pierBlocks(site, s.style || 'vale'), bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, bid: L.buildings.length - 0.2, label: 'the dock', quiet: true });
        this.sim.works.finishNow(L, p);
        P.state = 'docked';
        P.next = day + 1;
        return null;
      }
    }
    P.size ||= 'small';
    P.site.size ||= P.size;
    // The pier first, when the town can pay for it.
    if (P.state === 'planned') {
      const cost = (DOCKS[P.size] || DOCKS.small).cost;
      if (L.econ.treasury < cost + 30 || this.sim.works.active(s.id).some((q) => q.kind === 'dock')) return null;
      const xs = P.site.tiles.map((t) => t[0]);
      const zs = P.site.tiles.map((t) => t[1]);
      const p = this.sim.works.add({ sid: s.id, kind: 'dock', blocks: this.pierBlocks(P.site, s.style || 'vale'), bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, bid: L.buildings.length - 0.2, label: `building ${(DOCKS[P.size] || DOCKS.small).label}` });
      L.econ.treasury -= cost;
      P.state = 'building';
      P.project = p.id;
      ledger(L, day, P.ship === false ? `${s.name} has paid ¤${cost} for ${(DOCKS[P.size] || DOCKS.small).label} on the shore, for the fishing boats.` : `${s.name} has paid ¤${cost} for a harbour: a pier for the great ship the shipwrights are building.`);
      return { building: p };
    }
    if (P.state === 'building') {
      if (P.hullFrom !== undefined) {
        if (this.sim.abs - P.hullFrom < 3 * DAY) return null;
        delete P.hullFrom;
      } else {
        const p = this.sim.works.projects.find((q) => q.id === P.project);
        if (p && !p.done) return null;
      }
      P.state = 'docked';
      P.next = day + 1;
      if (P.ship !== false) ledger(L, day, `The ${P.name} was launched at ${s.name}'s pier: a great ship, for trade with ports abroad.`);
      return P.ship !== false ? { launched: P } : null;
    }
    // (Round 73) Learned to build ships since: the shipwrights lay down a
    // great ship's keel beside the pier.
    if (P.state === 'docked' && P.ship === false && knows) {
      P.ship = true;
      P.state = 'building';
      P.hullFrom = this.sim.abs;
      P.project = null;
      ledger(L, day, `${s.name}'s shipwrights have laid down the keel of a great ship, the ${P.name}, beside the pier.`);
      return null;
    }
    // ...and the town grown since: the dock grows with it.
    if (P.state === 'docked' && DOCKS[want].rank > (DOCKS[P.size] || DOCKS.small).rank && !P.grow && L.econ.treasury >= DOCKS[want].cost + 40 && !this.sim.works.active(s.id).some((q) => q.kind === 'dock')
      && (L.econ.noGrowDock === undefined || day - L.econ.noGrowDock >= 7)) {
      const site = this.dockSite(L, want);
      if (!site) L.econ.noGrowDock = day;
      else {
        const xs = site.tiles.map((t) => t[0]);
        const zs = site.tiles.map((t) => t[1]);
        const p = this.sim.works.add({ sid: s.id, kind: 'dock', blocks: this.pierBlocks(site, s.style || 'vale'), bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, bid: L.buildings.length - 0.2, label: `building ${DOCKS[want].label}` });
        L.econ.treasury -= DOCKS[want].cost;
        P.grow = { site, project: p.id };
        ledger(L, day, `${s.name} has outgrown its ${P.size === 'small' ? 'jetty' : 'pier'}: ¤${DOCKS[want].cost} for ${DOCKS[want].label}.`);
      }
    }
    if (P.grow) {
      const p = this.sim.works.projects.find((q) => q.id === P.grow.project);
      if (!p || p.done) {
        // (The ship moves round to the new pier when she's next in.)
        if (!P.voyage) {
          P.site = P.grow.site;
          P.size = P.grow.site.size;
          delete P.grow;
        }
      }
    }
    // The shipwright, down at the pier of a day, selling ships (see
    // Sim.shopOf).
    if (P.state === 'docked' && knows) this.shipwrightDay(L, P, day);
    // (Taken by a realm that doesn't know how to sail her: she stays tied up.)
    if (P.state === 'docked' && knows && P.ship !== false && day >= P.next && !P.voyage) return { voyage: this.voyage(L, P, day, rng) };
    return null;
  }

  // The town's carpenter keeps the shipwright's trade at the pier from mid
  // morning to late afternoon: that's where you buy a ship.
  shipwrightDay(L, P, day) {
    const rec = this.shipwright(L);
    if (!rec || rec.override || rec.away || rec.trip?.phase?.startsWith('away')) return;
    const at = P.site.root;
    setOverride(rec, day * DAY + 9 * 60 + 30, day * DAY + 16 * 60 + 30, 'harbour', { place: 'harbour', target: { x: at.x, z: at.z } });
  }

  shipwright(L) {
    return L.npcs.find((r) => alive(r) && r.job === 'carpenter' && r.age === 'adult' && !r.visitor && r.captive === undefined) || null;
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
