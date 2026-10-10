// Builders at work: repairing damaged buildings, putting up buildings the
// town lacks, and growing houses for families (and the player) who pay for
// it. Each project is a list of blocks placed in order as the builders put
// in hours on site (visibly when the town is near, in bulk when it isn't).
import { alive, ledger, setOverride, DAY, hasMaterials, useMaterials } from './econ.js';
import { B, BLOCKS } from '../world/blocks.js';
import { GROUND } from '../config.js';

// How far along a new building is before its frame is up (and the sign
// announcing it comes down).
const FRAME = 0.45;

const MIN_PER_BLOCK = { repair: 3, build: 4, expand: 3.5, wall: 1.2, breach: 1, stage: 6, strike: 3, road: 1.6, path: 1.6, mend: 2.5, dock: 3, portal: 240, plans: 3 };
// Put up for a wedding or a feast, and taken down again after.
const TEMPORARY = new Set(['stage', 'strike']);
// Plain lists of blocks round a patch of ground (not a building).
// (Round 78: 'plans', a blueprint of yours built for you: see game/plans.js.)
const PLAIN = new Set(['stage', 'strike', 'road', 'path', 'mend', 'dock', 'portal', 'plans']);
// Work spread out over the ground (streets, paths, walls, sets): the
// builders walk along it, and blocks only go in within their reach.
const ALONG = new Set(['stage', 'strike', 'road', 'path', 'wall', 'breach', 'mend', 'dock', 'plans']);
const REACH = 4;
// Blocks a repair restores: walls, roofs, floors, windows and doors.
const STRUCTURAL = (id) => {
  const b = BLOCKS[id];
  return b && id !== B.air && (b.render === 'cube' || b.render === 'door') && b.interact !== 'container';
};

const L0 = (works, p) => works.sim.layoutOf(p.sid);

export const EXPAND_COST = { house_s: 120, house_m: 220 };

// Work through a plan's blocks as the builders' hours allow. A block that is
// already in place (clearing empty air, say) costs nothing, so the first
// thing you see is walls going up, not minutes of nothing. Someone standing
// where a block goes is asked to step aside (you get to wait for).
// (`near`, if given, says whether a block is within a builder's reach: the
// work waits at the first one that isn't.)
export function placeSome(game, list, st, per, repair = false, near = null) {
  const w = game.world;
  if (st.spent === undefined) st.spent = st.placed * per;
  if (!st.wait) st.wait = [];
  let avail = st.work - st.spent;
  const out = [];
  const noop = ([x, y, z, id, meta = 0]) => w.regionAt(x, z) && w.getBlock(x, y, z) === id && (w.getMeta(x, y, z) & 0b111) === (meta & 0b111);
  const inWay = ([x, y, z, id]) => {
    if (!BLOCKS[id]?.solid || !w.regionAt(x, z)) return false;
    const e = game.entityAt(x, y, z) || game.entityAt(x, y - 1, z);
    if (!e || e.dead || e.x !== x || e.z !== z) return false;
    // Only you hold up the work: anyone or anything else is shooed aside,
    // to open ground that isn't about to be built on.
    if (e.kind === 'player') return true;
    const spot = clearSpot(x, z, e.y);
    if (!spot) return true;
    // A step aside if it's next door; a builder never hops further (the
    // block waits while they walk off it).
    const step = Math.abs(spot.x - e.x) + Math.abs(spot.z - e.z) === 1 && Math.abs(spot.y - e.y) <= 1;
    if (e.moving) return true;
    if (step && e.startMove) {
      e.startMove(spot.x, spot.y, spot.z, 0.25);
      if (e.path) e.path = null;
      return false;
    }
    if (e.kind === 'npc' && e.rec && e.rec.job === 'builder') {
      e.path = null;
      e.goal = null;
      e.idleT = 0;
      return true;
    }
    e.teleport(spot.x, spot.y, spot.z);
    return false;
  };
  let pending = null;
  const clearSpot = (x, z, hint) => {
    if (!pending) {
      pending = new Set();
      for (let i = st.placed; i < list.length; i++) pending.add(list[i][0] * 65536 + list[i][2]);
      for (const op of st.wait) pending.add(op[0] * 65536 + op[2]);
    }
    for (let r = 1; r <= 8; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || pending.has((x + dx) * 65536 + z + dz)) continue;
          const y = w.findStandY(x + dx, z + dz, hint);
          if (y > 0 && !w.isWaterAt(x + dx, y, z + dz) && !game.entityAt(x + dx, y, z + dz)) return { x: x + dx, y, z: z + dz };
        }
      }
    }
    return null;
  };
  const take = (op) => {
    out.push(op);
    avail -= per;
    st.spent += per;
  };
  st.wait = st.wait.filter((op) => {
    if (noop(op)) return false;
    if (avail < per || (near && !near(op)) || inWay(op)) return true;
    take(op);
    return false;
  });
  while (st.placed < list.length) {
    const op = list[st.placed];
    // Repairs only fill gaps; they never knock down what's there now.
    if (repair && w.regionAt(op[0], op[2]) && w.getBlock(op[0], op[1], op[2]) !== B.air) {
      st.placed++;
      continue;
    }
    if (noop(op)) {
      st.placed++;
      continue;
    }
    if (avail < per) break;
    if (near && !near(op)) break;
    st.placed++;
    if (inWay(op)) st.wait.push(op);
    else take(op);
  }
  return out;
}

export class Works {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.projects = [];
    this.built = []; // finished builds and expansions, re-applied on load
    this.next = 1;
    this.plans = new Map();
  }

  // ------------------------------------------------------------ plans
  planOf(p) {
    if (this.plans.has(p.id)) return this.plans.get(p.id);
    const L = this.sim.layoutOf(p.sid);
    let plan = null;
    if (p.kind === 'build') plan = this.withRoad(L, p, L.typedBlueprint(L.plots[p.plot], p.type, p.bid, this.shopExtra(p)));
    else if (p.kind === 'expand') plan = L.rebuildPlan(L.buildings[p.bid], p.bounds, p.rev);
    else if (p.kind === 'repair' || PLAIN.has(p.kind)) plan = { list: p.blocks };
    else if (p.kind === 'wall') plan = p.rect ? L.outerWallPlan(p.rect) : L.wallPlan();
    else if (p.kind === 'breach') plan = L.breachPlan(p.at);
    if (plan) this.plans.set(p.id, plan);
    return plan;
  }

  // A workshop built for the player's trade: theirs, named for them, never
  // staffed by the town.
  shopExtra(p) {
    if (!p.shop) return {};
    return { trade: p.shop, playerShop: p.shop, name: p.shopName || `${this.game.playerName}'s Workshop` };
  }

  // The town builds you a workshop for your trade (paid for by your licence)
  // on a lot with a street at its door; with none free, it waits for one.
  startWorkshop(L, job, title, fromQueue = false) {
    const type = 'player_workshop';
    const plot = this.freePlot(L, type);
    if (!plot) {
      if (fromQueue) return null;
      this.sim.roads.enqueue(L, { kind: 'workshop', type, job, title });
      return { queued: true };
    }
    plot.taken = true;
    const bid = L.buildings.length;
    const road = L.roadTo(plot);
    const shopName = `${this.game.playerName}'s ${title} Workshop`;
    const p = { sid: L.settlement.id, kind: 'build', bid, plot: plot.id, type, road, shop: job, shopName, owner: 'player', label: `${this.game.playerName}'s ${title.toLowerCase()} workshop` };
    const plan0 = L.typedBlueprint(plot, type, bid, this.shopExtra(p));
    plan0.bld.underConstruction = true;
    L.buildings.push(plan0.bld);
    L.claimFootprint(plan0.bld);
    const plan = this.withRoad(L, p, plan0);
    p.id = this.next;
    this.plans.set(p.id, plan);
    return this.add(p);
  }

  // The road out to the street goes down first, then the building.
  withRoad(L, p, plan) {
    if (!plan || !p.road || !p.road.length) return plan;
    const ops = L.roadOps(p.road);
    p.roadOps = ops.length;
    return { ...plan, list: [...ops, ...plan.list] };
  }

  // A sign on the site saying what's going up, whose it is and how far
  // along; it comes down once the frame is up.
  putSign(L, p) {
    const plot = L.plots[p.plot];
    if (!plot || p.sign) return;
    const w = this.game.world;
    const road = new Set((p.road || []).map(([x, z]) => x * 65536 + z));
    const o = plot.outside || { x: plot.x0, z: plot.z0 };
    let best = null;
    for (let z = plot.z0 - 2; z <= plot.z1 + 2; z++) {
      for (let x = plot.x0 - 2; x <= plot.x1 + 2; x++) {
        if (x >= plot.x0 && x <= plot.x1 && z >= plot.z0 && z <= plot.z1) continue;
        if (road.has(x * 65536 + z) || L.isRoadTile(x, z)) continue;
        if (L.inside(x, z) && L.maskAt(x, z) !== 0 && L.maskAt(x, z) !== 6) continue;
        const c = L.col(x, z);
        if (!c || c.water >= 0) continue;
        if (w.regionAt(x, z) && (w.getBlock(x, GROUND, z) !== B.air || !BLOCKS[w.getBlock(x, GROUND - 1, z)].solid)) continue;
        const d = Math.abs(x - o.x) + Math.abs(z - o.z);
        if (d >= 1 && (!best || d < best.d)) best = { x, z, d };
      }
    }
    if (!best) return;
    const rot = plot.door ? plot.door.rot : 0;
    p.sign = { x: best.x, z: best.z, rot };
    this.sim.setBlocks([[best.x, GROUND, best.z, B.sign, rot]]);
    this.showSign(L, p);
  }

  showSign(L, p) {
    if (!p.sign || p.signDown) return;
    if (!L.signs.some((q) => q.kind === 'works' && q.project === p.id)) L.signs.push({ x: p.sign.x, y: GROUND, z: p.sign.z, kind: 'works', project: p.id });
    this.game.refreshSigns?.();
  }

  takeSignDown(L, p) {
    if (!p.sign || p.signDown) return;
    p.signDown = true;
    const w = this.game.world;
    if (!w.regionAt(p.sign.x, p.sign.z) || w.getBlock(p.sign.x, GROUND, p.sign.z) === B.sign) this.sim.setBlocks([[p.sign.x, GROUND, p.sign.z, B.air, 0]]);
    L.signs = L.signs.filter((q) => !(q.kind === 'works' && q.project === p.id));
    this.game.refreshSigns?.();
  }

  // How far the building itself (not its road) has got.
  // (By the work actually done: clearing air that's already clear is free.)
  frameProgress(p) {
    if (p.done) return 1;
    const per = p.need / Math.max(1, p.total || 1);
    const road = (p.roadOps || 0) * per;
    return Math.max(0, Math.min(1, ((p.spent ?? p.placed * per) - road) / Math.max(1, p.need - road)));
  }

  // What a building should look like: its generated blocks, or the plan it
  // was last built or grown to.
  referencePlan(L, b) {
    const key = `${L.settlement.id}:${b.id}:${b.rev || 0}`;
    if (this.plans.has(key)) return this.plans.get(key);
    let list;
    if (b.planRef) {
      const r = b.planRef;
      const plan = r.kind === 'build' ? L.typedBlueprint(L.plots[r.plot], r.type, b.id) : L.rebuildPlan({ ...b, ...r.from }, r.bounds, r.rev);
      list = plan.list;
    } else {
      const last = new Map();
      for (const arr of L.placements.values()) {
        for (let i = 0; i < arr.length; i += 5) {
          const x = arr[i];
          const z = arr[i + 2];
          if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
          last.set(`${x},${arr[i + 1]},${z}`, [x, arr[i + 1], z, arr[i + 3], arr[i + 4]]);
        }
      }
      list = [...last.values()];
    }
    list = list.filter((e) => STRUCTURAL(e[3]));
    this.plans.set(key, list);
    return list;
  }

  // Structural blocks of a building that are missing right now.
  damageOf(L, b) {
    const w = this.game.world;
    return this.referencePlan(L, b).filter(([x, y, z, id]) => w.regionAt(x, z) && w.getBlock(x, y, z) === B.air && id !== B.air);
  }

  // ------------------------------------------------------------ projects
  active(sid) {
    return this.projects.filter((p) => p.sid === sid && !p.done);
  }

  add(p) {
    p.id = this.next++;
    p.work = 0;
    p.placed = 0;
    p.last = this.sim.now();
    p.start = p.last;
    const plan = this.planOf(p);
    p.total = plan.list.length;
    if (p.kind === 'build') this.putSign(L0(this, p), p);
    p.need = Math.max(60, Math.round(p.total * MIN_PER_BLOCK[p.kind]));
    this.projects.push(p);
    const L = this.sim.layoutOf(p.sid);
    if (!p.quiet) ledger(L, this.sim.today(), `Builders started ${p.label}.`);
    if (this.game.active.has(p.sid)) this.staff(L, this.game.day, this.sim.abs);
    return p;
  }

  // A building was damaged: schedule its repair.
  noteDamage(L, b) {
    if (!b || b.playerHome || b.underConstruction || L.settlement.deserted) return null;
    if (this.projects.some((p) => !p.done && p.sid === L.settlement.id && p.bid === b.id)) return null;
    const missing = this.damageOf(L, b);
    if (!missing.length) return null;
    return this.add({ sid: L.settlement.id, kind: 'repair', bid: b.id, blocks: missing, label: `repairs to the ${b.name.replace(/^The /, '')}` });
  }

  // An open lot with a street at its door (the streets module lays new
  // streets and lots as they're needed).
  freePlot(L, type = 'house_s', insideOnly = false) {
    const open = L.plots.filter((q) => q && !q.taken && !q.paving && (!insideOnly || !q.fringe) && this.sim.roads.roadside(L, q));
    const area = (q) => (q.x1 - q.x0 + 1) * (q.z1 - q.z0 + 1);
    // The smallest lot that will do...
    const ok = open.filter((q) => !L.fits || L.fits(q, type)).sort((a, b) => area(a) - area(b));
    if (ok.length) return ok[0];
    // ...or, in a town with no room for a bigger one anywhere, the biggest
    // there is (the building makes do).
    if (L.econ.cramped && L.econ.cramped[type]) return open.sort((a, b) => area(b) - area(a))[0] || null;
    return null;
  }

  // A lot marked out after founding: remembered so it's there after a reload.
  registerPlot(L, plot, quiet = false) {
    const { id, type, x0, z0, x1, z1, door, outside, fringe, signAt, step, paving } = plot;
    (L.econ.openPlots ||= []).push({ id, type, x0, z0, x1, z1, door, outside, fringe, signAt, step, paving });
    if (!quiet) ledger(L, this.sim.today(), 'The council marked out a new building lot.');
  }

  // A new building, if the town has the timber and stone for it (coin is
  // the caller's business).
  // No lot free: it waits its turn (with what it'll cost the town), and goes
  // up on the first lot there is.
  startBuilding(L, type, reason = '', fromQueue = false, cost = 0) {
    if (!hasMaterials(L, type)) {
      L.econ.short = type;
      return null;
    }
    const plot = this.freePlot(L, type);
    if (!plot) {
      if (!fromQueue) this.sim.roads.enqueue(L, { kind: 'build', type, reason, cost });
      return null;
    }
    // (One waiting for this very kind of building needn't wait any more.)
    const q = L.econ.buildQueue || [];
    const w = q.findIndex((o) => o.kind === 'build' && o.type === type);
    if (w >= 0 && !fromQueue) q.splice(w, 1);
    useMaterials(L, type);
    L.econ.short = null;
    plot.taken = true;
    const bid = L.buildings.length;
    // The street reaches the lot before anything else.
    const road = L.roadTo(plot);
    const plan0 = L.typedBlueprint(plot, type, bid);
    plan0.bld.underConstruction = true;
    L.buildings.push(plan0.bld);
    L.claimFootprint(plan0.bld);
    const p = { sid: L.settlement.id, kind: 'build', bid, plot: plot.id, type, road, label: `a new ${plan0.bld.name.replace(/^The /, '').toLowerCase()}${reason}` };
    const plan = this.withRoad(L, p, plan0);
    p.id = this.next;
    this.plans.set(p.id, plan);
    return this.add(p);
  }

  // Grow a house to the next size. Returns the project or a reason.
  expansionTerms(L, b) {
    if (!b || !b.residential) return { ok: false, reason: 'none' };
    if (this.projects.some((p) => !p.done && p.sid === L.settlement.id && p.bid === b.id)) return { ok: false, reason: 'busy' };
    if (!EXPAND_COST[b.type]) return { ok: false, reason: 'max' };
    const bounds = L.expansionBounds(b);
    if (!bounds) return { ok: false, reason: 'room' };
    const scale = { village: 0.7, town: 1, city: 1.3 }[L.settlement.type] || 1;
    return { ok: true, bounds, cost: Math.round(EXPAND_COST[b.type] * scale), next: bounds.type };
  }

  startExpansion(L, b, bounds, who) {
    const rev = (b.rev || 0) + 1;
    return this.add({ sid: L.settlement.id, kind: 'expand', bid: b.id, bounds, rev, owner: who, label: `enlarging ${b.playerHome ? `${b.homeOwner || this.game.playerName}'s home` : b.family ? `the ${b.family} home` : 'a house'}` });
  }

  // ------------------------------------------------------------ builders
  sites(p, L) {
    if (p.kind === 'wall' || p.kind === 'breach') {
      // Along the inside of the wall, a few paces apart.
      const plan = this.planOf(p);
      const b = L.bounds;
      const inward = ([x, z]) => ({ x: x === b.x0 ? x + 1 : x === b.x1 ? x - 1 : x, z: z === b.z0 ? z + 1 : z === b.z1 ? z - 1 : z });
      const out = (plan ? plan.tiles : []).filter((t, i) => p.kind === 'breach' || i % 7 === 0).map(inward);
      return out.length ? out : [{ x: L.plaza.cx, z: L.plaza.cz }];
    }
    const b = p.kind === 'build' ? L.plots[p.plot] : p.kind === 'expand' || PLAIN.has(p.kind) ? p.bounds : L.buildings[p.bid];
    const out = [];
    for (let z = b.z0 - 1; z <= b.z1 + 1; z++) {
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
        const ring = x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1;
        if (ring && (x + z) % 2 === 0) out.push({ x, z });
      }
    }
    return out;
  }

  assignSite(L, p, day, fromAbs) {
    const sites = this.sites(p, L);
    const c = this.sim.construction;
    const busy = c && !c.done && !c.cancelled && c.sid === L.settlement.id;
    const crew = this.sim.builders(L).filter((r) => !(busy && r.override && r.override.act === 'build' && !r.override.project));
    crew.forEach((r, i) => {
      if (r.override && r.override.project === p.id) return;
      const s = Math.max(day * DAY + 420, fromAbs);
      const e = day * DAY + 1140;
      if (e - s < 30) return;
      setOverride(r, s, e, 'build', { target: sites[(i * 5) % sites.length], sites, place: 'site', allowMeals: true, project: p.id, label: p.label, ...(TEMPORARY.has(p.kind) ? { event: p.kind } : {}) });
      if (r.ent && !r.ent.dead) r.ent.activity = null;
    });
  }

  // How fast work goes. In a town you're in, it's the builders actually on
  // site who count (none there yet: barely anything happens); elsewhere the
  // town's crew is assumed to put in its hours.
  crewRate(L, onJob, cap, away = false) {
    const crew = this.sim.builders(L);
    if (this.game.active.has(L.settlement.id) && !away) {
      const near = (r) => {
        const o = r.override;
        const sites = (o && (o.sites || (o.target ? [o.target] : null))) || [];
        return sites.some((q) => Math.max(Math.abs(q.x - r.ent.x), Math.abs(q.z - r.ent.z)) <= 3);
      };
      const here = crew.filter((r) => r.ent && !r.ent.dead && onJob(r) && r.ent.act === 'build' && near(r)).length;
      return here ? Math.min(cap, Math.max(0.5, here / 2)) : 0.1;
    }
    return crew.length ? Math.min(cap, Math.max(0.5, crew.length / 2)) : 0.25;
  }

  daily(L, day) {
    this.staff(L, day, day * DAY + 420);
  }

  // One job at a time for the town's crew: a do's set first (it has a
  // day to be ready by), then whatever was begun first.
  nextJob(L) {
    const list = this.active(L.settlement.id).filter((p) => p.kind !== 'repair' || !this.active(L.settlement.id).some((q) => q.kind !== 'repair'));
    list.sort((a, b) => TEMPORARY.has(b.kind) - TEMPORARY.has(a.kind) || a.id - b.id);
    return list[0] || null;
  }

  staff(L, day, fromAbs) {
    const p = this.nextJob(L);
    if (p) this.assignSite(L, p, day, fromAbs);
  }

  // ------------------------------------------------------------ time
  update() {
    for (const p of this.projects) {
      if (p.done) continue;
      const L = this.sim.layoutOf(p.sid);
      if (!L) continue;
      this.advance(L, p, this.sim.abs);
    }
    if (this.projects.length > 40) this.projects = this.projects.filter((p) => !p.done);
  }

  // A town's projects moved on to a moment in its (caught-up) day, so a
  // place you've been away from has really been building meanwhile.
  catchUp(L, upTo) {
    for (const p of this.projects) if (!p.done && p.sid === L.settlement.id && p.last < upTo) this.advance(L, p, upTo);
  }

  advance(L, p, now) {
    {
      // (Time jumping ahead, asleep or waiting, the builders have been at it
      // wherever it needed doing.)
      const jump = now - p.last > 20;
      const rate = this.crewRate(L, (r) => r.override && r.override.project === p.id, 1.6, jump);
      let t = p.last;
      let work = 0;
      while (t < now) {
        const d0 = Math.floor(t / DAY) * DAY;
        const a = Math.max(t, d0 + 420);
        const b = Math.min(now, d0 + 1140);
        if (b > a) work += b - a;
        t = d0 + DAY;
      }
      p.last = now;
      // (Masons who know their trade build a quarter faster.)
      p.work += work * rate * (this.sim.tech && this.sim.tech.has(L.settlement, 'masonry') ? 1.35 : 1) * (this.sim.tech && this.sim.tech.has(L.settlement, 'cranes') ? 1.3 : 1) * (this.sim.tech ? 1 + this.sim.tech.fxOf(L.settlement, 'build') : 1);
      const plan = this.planOf(p);
      if (!plan) {
        p.done = true;
        return;
      }
      // Repairs and stages only fill gaps: they never knock down what's there.
      const per = p.need / Math.max(1, plan.list.length);
      const near = ALONG.has(p.kind) && this.game.active.has(p.sid) && !jump ? this.reachOf(L, p, plan, per) : null;
      const batch = placeSome(this.game, plan.list, p, per, p.kind === 'repair' || p.kind === 'stage', near);
      if (batch.length) {
        this.sim.setBlocks(batch);
        const g = this.game;
        const e = batch[batch.length - 1];
        if (g.active.has(p.sid) && Math.abs(g.player.x - e[0]) < 24 && Math.abs(g.player.z - e[2]) < 20) {
          g.renderer.emit(e[0], e[1], e[2], { n: 4, color: ['#c8a064', '#8e6a3a', '#e8e0d0'], up: 30, life: 0.5, oy: -6 });
          if (Math.random() < 0.3) g.audio?.play('place');
        }
      }
      if (p.kind === 'build' && p.sign && !p.signDown && this.frameProgress(p) >= FRAME) this.takeSignDown(L, p);
      if (p.placed >= plan.list.length && !p.wait.length) this.finish(L, p, plan);
    }
  }

  // In a town you're in, the builders on a spread-out job walk along it to
  // where the work is, and a block only goes in beside one of them. (Out
  // past the edge of town, or if they can't get to it for long, the work
  // goes on regardless.)
  reachOf(L, p, plan, per) {
    const crew = L.npcs.filter((r) => r.override && r.override.project === p.id && r.ent && !r.ent.dead);
    this.steer(L, p, plan, crew);
    const b = L.bounds;
    // (Stuck: a block at a time, not the lot at once.)
    let spare = crew.length && p.work - (p.spent ?? p.placed * per) > per * 40 ? 1 : 0;
    return ([x, , z]) => {
      if (x < b.x0 - 24 || x > b.x1 + 24 || z < b.z0 - 24 || z > b.z1 + 24) return true;
      if (crew.some((r) => Math.max(Math.abs(r.ent.x - x), Math.abs(r.ent.z - z)) <= REACH)) return true;
      return spare-- > 0;
    };
  }

  // Each builder goes to the next few blocks still to do, a little apart.
  steer(L, p, plan, crew) {
    if (!crew.length) return;
    const now = this.sim.abs;
    if (p.steerAt !== undefined && now - p.steerAt < 3) return;
    p.steerAt = now;
    const w = this.game.world;
    const todo = [];
    const pending = new Set();
    for (let i = p.placed; i < plan.list.length && todo.length < 24; i++) {
      const [x, y, z, id] = plan.list[i];
      pending.add(x * 65536 + z);
      if (w.regionAt(x, z) && w.getBlock(x, y, z) === id) continue;
      if (!todo.some((q) => Math.max(Math.abs(q[0] - x), Math.abs(q[2] - z)) < 3)) todo.push(plan.list[i]);
    }
    for (const op of p.wait || []) if (!todo.length) todo.push(op);
    if (!todo.length) return;
    crew.forEach((r, i) => {
      const [x, , z] = todo[i % todo.length];
      const o = r.override;
      const at = o.target;
      if (at && Math.max(Math.abs(at.x - x), Math.abs(at.z - z)) <= 2) return;
      // Somewhere to stand beside it that isn't about to be built on.
      let spot = null;
      for (let d = 1; d <= 3 && !spot; d++) {
        for (const [dx, dz] of [[0, d], [0, -d], [d, 0], [-d, 0], [d, d], [-d, d], [d, -d], [-d, -d]]) {
          const sx = x + dx;
          const sz = z + dz;
          if (pending.has(sx * 65536 + sz) && d < 3) continue;
          if (!w.regionAt(sx, sz) || w.findStandY(sx, sz, GROUND) !== GROUND) continue;
          spot = { x: sx, z: sz };
          break;
        }
      }
      if (!spot) return;
      o.target = spot;
      o.sites = [spot];
      if (r.ent.act === 'build' || r.ent.activity) r.ent.activity = null;
    });
  }

  finish(L, p, plan, silent = false) {
    p.done = true;
    this.takeSignDown(L, p);
    const sim = this.sim;
    for (const r of L.npcs) if (r.override && r.override.project === p.id) r.override = null;
    // On to the next job.
    if (this.game.active.has(p.sid) && !silent) this.staff(L, this.game.day, this.sim.abs);
    if (PLAIN.has(p.kind)) {
      if (!silent && !p.quiet) ledger(L, this.sim.today(), `The builders finished ${p.label}.`);
      if (p.kind === 'road') sim.roads.streetDone(L, p);
      if (p.kind === 'path') sim.roads.paved(L, p);
      // (Round 78) Yours, built: word sent.
      if (p.kind === 'plans' && !silent) this.game.ui?.msg?.(`The builders of ${L.settlement.name} have finished ${p.label}.`, '#a0e8a0');
      if (p.kind === 'plans') this.sim.saga?.emit('plan_built', { sid: L.settlement.id, label: p.label });
      return;
    }
    if (p.kind === 'wall' || p.kind === 'breach') {
      L.applyWall(plan.tiles, p.kind === 'breach');
      // (Round 73) A street through the gap, joined up to the town's own.
      if (p.kind === 'breach' && plan.tiles.length) {
        const link = L.breachLink(plan.tiles);
        const road = [...plan.tiles, ...link];
        this.sim.setBlocks(L.roadOps(road));
        for (const [x, z] of road) L.markRoad(x, z);
        (L.econ.streets ||= []).push(road);
      }
      if (p.kind === 'wall') {
        L.econ.walled = true;
        if (p.rect) L.econ.wallRect = p.rect;
        for (const g of plan.gates) if (!L.gates.some((q) => q.x === g.x && q.z === g.z)) L.gates.push(g);
        // The gates hung in the gateways.
        this.sim.setBlocks(L.gateBlocks(plan.gates));
      }
      if (!this.built.some((q) => q.id === p.id)) this.built.push({ id: p.id, sid: p.sid, kind: p.kind, bid: p.bid, tiles: plan.tiles });
      if (!silent) ledger(L, this.sim.today(), p.kind === 'wall' ? (p.rect ? `The builders finished the new outer wall round ${L.settlement.name}'s outer streets.` : `The builders finished the new city wall round ${L.settlement.name}.`) : `A stretch of the city wall was pulled down so ${L.settlement.name} can grow beyond it.`);
      return;
    }
    if (p.kind === 'repair') {
      if (!silent) ledger(L, this.sim.today(), `The builders finished ${p.label}.`);
      // More damage done in the meantime? Back to work.
      this.noteDamage(L, L.buildings[p.bid]);
      return;
    }
    const b = L.buildings[p.bid];
    const nb = plan.bld;
    if (p.kind === 'build') {
      b.underConstruction = false;
      b.planRef = { kind: 'build', plot: p.plot, type: p.type };
      if (!L.econ.biz[b.id] && !b.residential && !b.playerShop) L.econ.biz[b.id] = { till: 25, store: {}, earned: 0, earnedY: 0 };
    } else {
      const from = { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, type: b.type };
      // Old seats and spots of the smaller house go; the new ones come in.
      L.spots = L.spots.filter((s) => !(s.building === b.id || (s.x >= nb.x0 && s.x <= nb.x1 && s.z >= nb.z0 && s.z <= nb.z1)));
      Object.assign(b, {
        type: nb.type, x0: nb.x0, z0: nb.z0, x1: nb.x1, z1: nb.z1, beds: nb.beds, seats: nb.seats, work: nb.work, free: nb.free,
        homeSpots: nb.homeSpots, roofLine: nb.roofLine, roofBase: nb.roofBase, chestPos: nb.chestPos, name: nb.name,
      });
      b.rev = p.rev;
      b.planRef = { kind: 'expand', bounds: p.bounds, rev: p.rev, from };
      L.claimFootprint(b);
      const c = sim.citizen;
      if (c && c.sid === p.sid && c.home === b.id && b.beds[0]) c.homeBed = { x: b.beds[0].x, y: 6, z: b.beds[0].z };
      // Everyone in the household keeps a bed.
      L.npcs.filter((r) => r.home === b.id && alive(r)).forEach((r, i) => {
        r.bed = i % Math.max(1, b.beds.length);
      });
    }
    for (const sp of plan.spots || []) if (!L.spots.includes(sp)) L.spots.push(sp);
    for (const ch of plan.chimneys || []) if (!L.chimneys.includes(ch)) L.chimneys.push(ch);
    for (const sg of plan.signs || []) if (!L.signs.includes(sg)) L.signs.push(sg);
    this.plans.delete(`${L.settlement.id}:${b.id}:${b.rev || 0}`);
    if (!this.built.some((q) => q.id === p.id)) this.built.push({ id: p.id, sid: p.sid, kind: p.kind, bid: p.bid, plot: p.plot, type: p.type, bounds: p.bounds, rev: p.rev, from: b.planRef.from, road: p.road, shop: p.shop, shopName: p.shopName });
    if (!silent) {
      ledger(L, this.sim.today(), `The builders finished ${p.label}.`);
      if (p.owner === 'player') {
        this.game.ui.msg(p.shop ? `${p.shopName} in ${L.settlement.name} is finished: your bench is waiting.` : `Your house in ${L.settlement.name} has been enlarged!`, '#ffe070');
        this.game.audio?.play('coin');
      }
      if (p.kind === 'build' && !b.playerShop) sim.onBuilt?.(L, b);
    }
    this.game.refreshSigns?.();
  }

  // Everything left goes in at once (everyone pitches in).
  finishNow(L, p) {
    if (p.done) return;
    const plan = this.planOf(p);
    if (!plan) {
      p.done = true;
      return;
    }
    const w = this.game.world;
    const keep = p.kind === 'repair' || p.kind === 'stage';
    const rest = [...(p.wait || []), ...plan.list.slice(p.placed)].filter(([x, y, z]) => !keep || !w.regionAt(x, z) || w.getBlock(x, y, z) === B.air);
    if (rest.length) this.sim.setBlocks(rest);
    p.placed = plan.list.length;
    p.wait = [];
    this.finish(L, p, plan);
  }

  // Work stops for good (whatever's up stays up).
  abandon(L, p) {
    p.done = true;
    for (const r of L.npcs) if (r.override && r.override.project === p.id) r.override = null;
  }

  // A family moved into a newly built house: the house takes their name,
  // remembered for when the town is laid out again.
  nameHouse(L, b, family, members) {
    b.family = family;
    b.homeName = `The ${family} House`;
    b.household = { members };
    const q = this.built.find((w) => w.sid === L.settlement.id && w.bid === b.id);
    if (q) q.family = { name: family, members };
  }

  // Re-create finished and unfinished buildings when a town is laid out
  // again after loading (in the order they were first built).
  restore(L) {
    const sid = L.settlement.id;
    const steps = [
      ...this.built.filter((q) => q.sid === sid).map((q) => ({ bid: q.bid, q, done: true })),
      ...this.projects.filter((p) => p.sid === sid && !p.done && p.kind !== 'repair' && !PLAIN.has(p.kind)).map((p) => ({ bid: p.bid, q: p, done: false })),
    ].sort((a, b) => a.bid - b.bid || (a.done === b.done ? 0 : a.done ? -1 : 1));
    return steps;
  }

  applyRestore(L, step) {
    const q = step.q;
    if ((q.kind === 'wall' || q.kind === 'breach') && step.done) {
      L.applyWall(q.tiles || [], q.kind === 'breach');
      if (q.kind === 'wall') L.econ.walled = true;
      return;
    }
    if (q.kind === 'build') {
      for (const [x, z] of q.road || []) L.markRoad(x, z);
      if (!step.done) this.showSign(L, q);
      if (L.buildings[q.bid]) return;
      const plot = L.plots[q.plot];
      if (!plot) return;
      plot.taken = true;
      const plan = L.typedBlueprint(plot, q.type, L.buildings.length, this.shopExtra(q));
      L.buildings.push(plan.bld);
      L.claimFootprint(plan.bld);
      if (step.done) {
        const b = plan.bld;
        b.planRef = { kind: 'build', plot: q.plot, type: q.type };
        for (const sp of plan.spots) L.spots.push(sp);
        for (const ch of plan.chimneys) L.chimneys.push(ch);
        for (const sg of plan.signs) L.signs.push(sg);
        if (q.family) {
          b.family = q.family.name;
          b.homeName = `The ${b.family} House`;
          b.household = { members: q.family.members };
        }
      } else plan.bld.underConstruction = true;
    } else if (q.kind === 'expand' && step.done) {
      const b = L.buildings[q.bid];
      if (!b || (b.rev || 0) >= q.rev) return;
      const plan = L.rebuildPlan(b, q.bounds, q.rev);
      this.finish(L, { ...q, done: false }, plan, true);
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    return {
      next: this.next,
      projects: this.projects.filter((p) => !p.done).map((p) => ({ ...p })),
      built: this.built,
    };
  }

  load(d) {
    if (!d) return;
    this.next = d.next || 1;
    this.projects = d.projects || [];
    this.built = d.built || [];
    this.plans.clear();
  }
}
