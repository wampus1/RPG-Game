// Streets and lots. A town lays new streets out from its roads as it grows
// (two tiles wide, a stretch at a time, by its builders), and marks out
// lots along them with a sign on each. Every new building, your workshop
// and your house included, goes up on one of those lots with a street at
// its door; with none free, it waits its turn until there is one. The
// town's ground grows with its streets.
import { ledger } from './econ.js';
import { M } from '../world/settlement.js';
import { B } from '../world/blocks.js';
import { GROUND, REGION_W, REGION_D } from '../config.js';
import { hash4 } from '../util/rng.js';
import { SOFT } from './diplomacy.js';

const SEG = 16; // tiles in a new stretch of street
const GAP = 2; // lots stand a doorstep back from the street
// How far beyond its first edge a town will lay streets.
const REACH = { village: 16, town: 22, city: 28 };
// Lots kept open (more when buildings are waiting for one).
const OPEN = { village: 2, town: 3, city: 4 };
const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];

export class Roads {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // A lot with a street at its door, nobody building on it.
  roadside(L, p) {
    if (!p || !p.outside) return false;
    const o = p.outside;
    return L.isRoadTile(o.x, o.z) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => L.isRoadTile(o.x + dx, o.z + dz));
  }

  openLots(L) {
    return L.plots.filter((p) => p && !p.taken && this.roadside(L, p));
  }

  queue(L) {
    return (L.econ.buildQueue ||= []);
  }

  // Something to build as soon as there's a lot for it (once per kind).
  enqueue(L, entry) {
    const q = this.queue(L);
    const same = q.find((o) => o.kind === entry.kind && o.type === entry.type && o.job === entry.job);
    if (same) return same;
    q.push({ ...entry, day: this.sim.today() });
    return q[q.length - 1];
  }

  waiting(L, kind, extra = {}) {
    return this.queue(L).find((o) => o.kind === kind && Object.entries(extra).every(([k, v]) => o[k] === v)) || null;
  }

  // Your workshop and your house here, while they wait for a lot or go up:
  // what the mayor and the builders can tell you about them.
  yours(L) {
    const sim = this.sim;
    const works = sim.works;
    const sid = L.settlement.id;
    const q = this.queue(L);
    const street = works.projects.find((p) => !p.done && p.sid === sid && p.kind === 'road') || null;
    const crew = sim.builders(L).length;
    const out = [];
    q.forEach((o, i) => {
      if (o.kind === 'workshop' || o.kind === 'home') out.push({ what: o.kind, state: 'queued', ahead: i, street: street ? Math.round(works.frameProgress(street) * 100) : null, since: o.day });
    });
    for (const p of works.projects) {
      if (p.done || p.sid !== sid || !p.shop) continue;
      const pct = Math.round(works.frameProgress(p) * 100);
      out.push({ what: 'workshop', state: 'building', pct, road: !!p.roadOps && pct === 0 && p.placed < p.roadOps, crew });
    }
    const c = sim.construction;
    if (c && c.sid === sid && !c.done && !c.cancelled) {
      const road = c.road && c.road.length ? L.roadOps(c.road).length : 0;
      out.push({ what: 'home', state: 'building', pct: Math.round((sim.constructionProgress() || 0) * 100), road: road > 0 && c.placed < road, crew });
    }
    return out;
  }

  // Once a day: start what's been waiting for a lot, and lay a new street
  // if the town is short of open lots.
  daily(L, day) {
    const s = L.settlement;
    if (s.deserted || s.condition === 'abandoned' || !L.econ) return;
    this.connect(L);
    this.startWaiting(L);
    const e = L.econ;
    const q = this.queue(L);
    const want = (OPEN[s.type] || 2) + q.length;
    // What's waiting might need a bigger lot than any that's open.
    const big = q.map((o) => o.type || 'house_s').sort((a, b) => L.lotSize(b)[0] * L.lotSize(b)[1] - L.lotSize(a)[0] * L.lotSize(a)[1])[0] || 'house_m';
    const roomy = !q.length || this.openLots(L).some((p) => L.fits(p, big));
    if (this.openLots(L).length >= want && roomy) return;
    if (this.sim.works.projects.some((p) => !p.done && p.sid === s.id && p.kind === 'road')) return;
    if (e.streetDay !== undefined && day - e.streetDay < (q.length ? 1 : 3)) return;
    e.streetDay = day;
    const plan = this.planStreet(L, L.lotSize(big));
    if (plan) {
      this.startStreet(L, plan);
      return;
    }
    // No room for a street anywhere: a lot beside a road, or on the edge
    // with a path to it, the old way.
    const plot = L.openPlot(big);
    if (plot && this.addLot(L, plot, true)) return;
    if (plot) L.plots[plot.id] = null;
    // Nowhere big enough at all: it'll have to make do with a smaller lot.
    (e.cramped ||= {})[big] = day;
    if (big !== 'house_s' && !this.openLots(L).length) {
      const small = L.openPlot('house_s');
      if (small && !this.addLot(L, small, true)) L.plots[small.id] = null;
    }
    this.startWaiting(L);
  }

  // Start what's waiting, in turn, while there are lots for it.
  startWaiting(L) {
    const q = this.queue(L);
    const works = this.sim.works;
    while (q.length) {
      const o = q[0];
      if (!works.freePlot(L, o.type || 'house_s')) break;
      if (o.kind === 'build' && L.econ.treasury < (o.cost || 0)) break;
      q.shift();
      if (o.kind === 'workshop') works.startWorkshop(L, o.job, o.title, true);
      else if (o.kind === 'home') this.sim.startHome(L);
      else if (works.startBuilding(L, o.type, o.reason || '', true)) L.econ.treasury -= o.cost || 0;
    }
  }

  // ------------------------------------------------------------ streets
  // Can a street go here: open ground (inside the town, not built on or
  // farmed; beyond it, flat dry land that's nobody else's).
  streetOk(L, x, z) {
    const b = L.bounds;
    if (L.inside(x, z)) {
      const m = L.maskAt(x, z);
      if (m !== M.FREE && m !== M.YARD) return false;
    } else {
      const reach = REACH[L.settlement.type] || 16;
      if (Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1) > reach) return false;
      const other = this.game.world.ow.settlementAt(x, z);
      if (other && other !== L.settlement) return false;
      if (L.builtNear(x, z, null) || L.isRoadTile(x, z)) return false;
    }
    const c = L.col(x, z);
    if (!c || c.water >= 0 || c.h !== GROUND - 1 || (c.flat !== undefined && c.flat < 0.02)) return false;
    // (Plants and brush are cleared off the way; anything else stops it.)
    const w = this.game.world;
    if (!w.regionAt(x, z)) return true;
    const id = w.getBlock(x, GROUND, z);
    return id === B.air || SOFT.has(id);
  }

  // Room for a lot here (and a tile clear round it, two from any house)?
  lotOk(L, r) {
    for (const q of L.buildings) if (q.x0 <= r.x1 + 2 && q.x1 >= r.x0 - 2 && q.z0 <= r.z1 + 2 && q.z1 >= r.z0 - 2) return false;
    // (Its own sign, put up with the street, doesn't count against it.)
    const sx = r.door ? r.door.x - DX[r.door.rot] : null;
    const sz = r.door ? r.door.z - DZ[r.door.rot] : null;
    for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (x === sx && z === sz) continue;
        const ring = x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1;
        if (L.inside(x, z)) {
          const m = L.maskAt(x, z);
          if (!ring && m !== M.FREE && m !== M.YARD) return false;
          if (ring && (m === M.BUILD || m === M.WALL || m === M.FIELD || m === M.WATER)) return false;
        } else if (!ring && !this.streetOk(L, x, z)) return false;
        else if (ring && L.builtNear(x, z, null)) return false;
      }
    }
    return L.gateClear(r);
  }

  // The best place for a new stretch of street: carrying on from the end of
  // one, into open ground with room for lots either side, near the middle.
  planStreet(L, size = [7, 6]) {
    const tiles = [];
    const b = L.bounds;
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (L.maskAt(x, z) === M.ROAD) tiles.push([x, z]);
    for (const k of L.outRoads || []) tiles.push([Math.floor(k / 65536), k % 65536]);
    const p = L.plaza;
    let best = null;
    for (const [x, z] of tiles) {
      for (let d = 0; d < 4; d++) {
        const dx = DX[d];
        const dz = DZ[d];
        // The end of a street, running this way.
        if (!L.isRoadTile(x - dx, z - dz) || L.isRoadTile(x + dx, z + dz)) continue;
        // Its other lane beside it (or, off a narrow lane, open ground to
        // make the new street two wide).
        const side = [[dz, dx], [-dz, -dx]].find(([px, pz]) => L.isRoadTile(x + px, z + pz) && !L.isRoadTile(x + px + dx, z + pz + dz))
          || [[dz, dx], [-dz, -dx]].find(([px, pz]) => !L.isRoadTile(x + px, z + pz) && this.streetOk(L, x + px + dx, z + pz + dz));
        if (!side) continue;
        const [px, pz] = side;
        const road = [];
        let ok = true;
        for (let i = 1; i <= SEG && ok; i++) {
          for (const [ax, az] of [[x + dx * i, z + dz * i], [x + px + dx * i, z + pz + dz * i]]) {
            if (!this.streetOk(L, ax, az)) ok = false;
            else road.push([ax, az]);
          }
        }
        if (!ok) continue;
        const lots = this.lotsAlong(L, { x, z, dx, dz, px, pz }, size);
        if (!lots.length) continue;
        const ex = x + dx * SEG;
        const ez = z + dz * SEG;
        const outside = road.filter(([ax, az]) => !L.inside(ax, az)).length;
        const score = Math.hypot(ex - p.cx, ez - p.cz) + outside * 0.3 - lots.length * 4 + (hash4(x, z, d, L.settlement.seed) % 7);
        if (!best || score < best.score) best = { score, road, lots, from: { x, z }, dir: [dx, dz] };
      }
    }
    return best;
  }

  // Lots either side of a planned stretch, doors facing it.
  lotsAlong(L, st, [LW, LD] = [7, 6]) {
    const { x, z, dx, dz, px, pz } = st;
    const out = [];
    // The two edges of the street: beyond the far lane (+p) and the near one (-p).
    for (const [sx, sz, base] of [[px, pz, 1], [-px, -pz, 0]]) {
      for (let i = 1; i + LW - 1 <= SEG; i += LW + 2) {
        // Tiles along the street for this lot, and its depth away from it.
        const along = [];
        for (let k = 0; k < LW; k++) along.push([x + dx * (i + k), z + dz * (i + k)]);
        const edge = base ? 1 : 0; // the far lane sits one tile over
        const d0 = edge + GAP; // doorstep then lot
        const cells = [];
        for (const [ax, az] of along) for (let dd = d0; dd < d0 + LD; dd++) cells.push([ax + sx * dd, az + sz * dd]);
        const xs = cells.map((c) => c[0]);
        const zs = cells.map((c) => c[1]);
        const r = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
        if (out.some((q) => !(r.x1 < q.x0 - 1 || r.x0 > q.x1 + 1 || r.z1 < q.z0 - 1 || r.z0 > q.z1 + 1))) continue;
        if (!this.lotOk(L, r)) continue;
        // The door in the middle of the side facing the street.
        const [mx, mz] = along[Math.floor(LW / 2)];
        const door = { x: mx + sx * d0, z: mz + sz * d0, rot: 0 };
        const outward = [sx, sz];
        door.rot = [0, 1, 2, 3].find((q) => DX[q] === -outward[0] && DZ[q] === -outward[1]);
        const outside = { x: door.x + DX[door.rot], z: door.z + DZ[door.rot] };
        // The doorstep between the lot and the street.
        const step = [];
        for (let dd = edge + 1; dd < d0; dd++) step.push([mx + sx * dd, mz + sz * dd]);
        out.push({ ...r, door, outside, step });
      }
    }
    return out;
  }

  // The builders lay the stretch; the lots are marked out once it's done.
  startStreet(L, plan) {
    const s = L.settlement;
    // The street, then each lot's doorstep and its sign, all by the builders.
    const ops = L.roadOps(plan.road);
    for (const lot of plan.lots) {
      ops.push(...L.roadOps(lot.step));
      ops.push([lot.door.x - DX[lot.door.rot], GROUND, lot.door.z - DZ[lot.door.rot], B.sign, lot.door.rot]);
    }
    const xs = plan.road.map((t) => t[0]);
    const zs = plan.road.map((t) => t[1]);
    const bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    const where = this.side(L, bounds);
    for (const [x, z] of plan.road) L.markRoad(x, z);
    return this.sim.works.add({ sid: s.id, kind: 'road', blocks: ops, bounds, road: plan.road, lots: plan.lots, label: `a new street on the ${where} side of ${s.name}` });
  }

  side(L, r) {
    const p = L.plaza;
    const dx = (r.x0 + r.x1) / 2 - p.cx;
    const dz = (r.z0 + r.z1) / 2 - p.cz;
    return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
  }

  // The street is down: remember it, and mark out its lots.
  streetDone(L, p) {
    const e = L.econ;
    (e.streets ||= []).push(p.road);
    L.addSuburb(p.bounds);
    reachWith(L.settlement, p.road);
    let n = 0;
    for (const lot of p.lots || []) {
      if (!this.lotOk(L, lot)) {
        // (Its sign comes down again.)
        const [sx, sz] = [lot.door.x - DX[lot.door.rot], lot.door.z - DZ[lot.door.rot]];
        const w = this.game.world;
        if (!w.regionAt(sx, sz) || w.getBlock(sx, GROUND, sz) === B.sign) this.sim.setBlocks([[sx, GROUND, sz, B.air, 0]]);
        continue;
      }
      const plot = { id: L.plots.length, type: 'house_s', x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: lot.z1, door: lot.door, outside: lot.outside, fringe: !L.inside(lot.x0, lot.z0) || !L.inside(lot.x1, lot.z1) };
      L.plots.push(plot);
      for (const [x, z] of lot.step) L.markRoad(x, z);
      plot.step = lot.step;
      this.addLot(L, plot, false);
      n++;
    }
    if (n) ledger(L, this.sim.today(), `${n} new building lot${n > 1 ? 's were' : ' was'} marked out along the new street.`);
    return n;
  }

  // A lot is claimed for the town: its footprint reserved, a sign put up
  // on it, and remembered for next time.
  addLot(L, plot, connect) {
    const inX = plot.door.x - DX[plot.door.rot];
    const inZ = plot.door.z - DZ[plot.door.rot];
    const sign = [inX, GROUND, inZ, B.sign, plot.door.rot];
    // A lot marked out off the streets gets a path to its door first (no
    // way to it, no lot), which the builders lay (and its sign) before
    // anything goes up on it.
    let path = null;
    if (connect && !this.roadside(L, plot)) {
      path = L.roadTo(plot);
      if (!path.length) return null;
      plot.step = path;
    }
    for (let z = plot.z0; z <= plot.z1; z++) for (let x = plot.x0; x <= plot.x1; x++) if (L.inside(x, z)) L.setMask(x, z, M.BUILD);
    L.addSuburb(plot);
    if (path) this.pave(L, plot, [...L.roadOps(path), sign]);
    else if (connect) this.sim.setBlocks([sign]);
    plot.signAt = { x: inX, y: GROUND, z: inZ };
    L.signs.push({ x: inX, y: GROUND, z: inZ, kind: 'plot', plot: plot.id });
    this.sim.works.registerPlot(L, plot, true);
    this.game.refreshSigns?.();
    return plot;
  }

  // Lots marked out with no way to them yet (beyond a wall that's since
  // come down, say): a path to the door, and a sign.
  connect(L) {
    for (const plot of L.plots) {
      if (!plot || plot.taken || plot.paving || this.roadside(L, plot)) continue;
      const path = L.roadTo(plot);
      if (!path.length) continue;
      plot.step = path;
      const rec = (L.econ.openPlots || []).find((q) => q.id === plot.id);
      if (rec) rec.step = path;
      const ops = L.roadOps(path);
      if (!plot.signAt) {
        const inX = plot.door.x - DX[plot.door.rot];
        const inZ = plot.door.z - DZ[plot.door.rot];
        ops.push([inX, GROUND, inZ, B.sign, plot.door.rot]);
        plot.signAt = { x: inX, y: GROUND, z: inZ };
        if (rec) rec.signAt = plot.signAt;
        L.signs.push({ x: inX, y: GROUND, z: inZ, kind: 'plot', plot: plot.id });
      }
      this.pave(L, plot, ops);
    }
  }

  // The builders lay a path (and put up the sign) to a lot: until it's
  // done, nothing is built there.
  pave(L, plot, ops) {
    const xs = ops.map((o) => o[0]);
    const zs = ops.map((o) => o[2]);
    const p = this.sim.works.add({ sid: L.settlement.id, kind: 'path', blocks: ops, bounds: { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }, plot: plot.id, quiet: true, label: 'a path to a new lot' });
    plot.paving = p.id;
    const rec = (L.econ.openPlots || []).find((q) => q.id === plot.id);
    if (rec) rec.paving = p.id;
    return p;
  }

  // The path's down: the lot is ready.
  paved(L, p) {
    const plot = L.plots[p.plot];
    if (plot) delete plot.paving;
    const rec = (L.econ.openPlots || []).find((q) => q.id === p.plot);
    if (rec) delete rec.paving;
  }

  // Laid out again after a reload: the streets back on the town's map.
  restore(L) {
    for (const road of L.econ.streets || []) {
      for (const [x, z] of road) L.markRoad(x, z);
      reachWith(L.settlement, road);
    }
  }
}

// The squares of the world map a town's streets have reached (its own
// squares from the start, and any a new street runs into).
export function reachWith(s, road) {
  const set = new Set(s.reach || []);
  const n = set.size;
  for (const [x, z] of road) set.add(Math.floor(z / REGION_D) * 10000 + Math.floor(x / REGION_W));
  if (set.size !== n) s.reach = [...set];
}
