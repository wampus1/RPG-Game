// Builders at work: repairing damaged buildings, putting up buildings the
// town lacks, and growing houses for families (and the player) who pay for
// it. Each project is a list of blocks placed in order as the builders put
// in hours on site (visibly when the town is near, in bulk when it isn't).
import { alive, ledger, setOverride, DAY } from './econ.js';
import { B, BLOCKS } from '../world/blocks.js';

const MIN_PER_BLOCK = { repair: 3, build: 4, expand: 3.5 };
// Blocks a repair restores: walls, roofs, floors, windows and doors.
const STRUCTURAL = (id) => {
  const b = BLOCKS[id];
  return b && id !== B.air && (b.render === 'cube' || b.render === 'door') && b.interact !== 'container';
};

export const EXPAND_COST = { house_s: 120, house_m: 220 };

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
    if (p.kind === 'build') plan = L.typedBlueprint(L.plots[p.plot], p.type, p.bid);
    else if (p.kind === 'expand') plan = L.rebuildPlan(L.buildings[p.bid], p.bounds, p.rev);
    else if (p.kind === 'repair') plan = { list: p.blocks };
    if (plan) this.plans.set(p.id, plan);
    return plan;
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
    p.last = this.sim.abs;
    p.start = this.sim.abs;
    const plan = this.planOf(p);
    p.total = plan.list.length;
    p.need = Math.max(60, Math.round(p.total * MIN_PER_BLOCK[p.kind]));
    this.projects.push(p);
    const L = this.sim.layoutOf(p.sid);
    ledger(L, this.game.day, `Builders started ${p.label}.`);
    if (this.game.active.has(p.sid)) this.assignSite(L, p, this.game.day, this.sim.abs);
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

  // A new work building on an empty lot, paid from the treasury.
  startBuilding(L, type, reason = '') {
    const plot = L.plots.find((q) => !q.taken);
    if (!plot) return null;
    plot.taken = true;
    const bid = L.buildings.length;
    const plan = L.typedBlueprint(plot, type, bid);
    plan.bld.underConstruction = true;
    L.buildings.push(plan.bld);
    L.claimFootprint(plan.bld);
    const p = { sid: L.settlement.id, kind: 'build', bid, plot: plot.id, type, label: `a new ${plan.bld.name.replace(/^The /, '').toLowerCase()}${reason}` };
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
    return this.add({ sid: L.settlement.id, kind: 'expand', bid: b.id, bounds, rev, owner: who, label: `enlarging ${b.playerHome ? `${this.game.playerName}'s home` : b.family ? `the ${b.family} home` : 'a house'}` });
  }

  // ------------------------------------------------------------ builders
  sites(p, L) {
    const b = p.kind === 'build' ? L.plots[p.plot] : p.kind === 'expand' ? p.bounds : L.buildings[p.bid];
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
      setOverride(r, s, e, 'build', { target: sites[(i * 5) % sites.length], sites, place: 'site', allowMeals: true, project: p.id, label: p.label });
      if (r.ent && !r.ent.dead) r.ent.activity = null;
    });
  }

  daily(L, day) {
    for (const p of this.active(L.settlement.id)) this.assignSite(L, p, day, day * DAY + 420);
  }

  // ------------------------------------------------------------ time
  update() {
    const now = this.sim.abs;
    for (const p of this.projects) {
      if (p.done) continue;
      const L = this.sim.layoutOf(p.sid);
      if (!L) continue;
      const crew = this.sim.builders(L).length;
      const rate = crew ? Math.min(1.6, Math.max(0.5, crew / 2)) : 0.25;
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
      p.work += work * rate;
      const plan = this.planOf(p);
      if (!plan) {
        p.done = true;
        continue;
      }
      const target = Math.min(plan.list.length, Math.floor((plan.list.length * p.work) / p.need));
      if (target > p.placed) {
        let batch = plan.list.slice(p.placed, target);
        const w = this.game.world;
        const g0 = this.game;
        // Nobody gets walled in: wait for whoever is standing there to move.
        const stop = batch.findIndex(([x, y, z, id]) => BLOCKS[id]?.solid && w.regionAt(x, z) && (g0.entityAt(x, y, z) || g0.entityAt(x, y - 1, z)));
        if (stop >= 0) batch = batch.slice(0, stop);
        if (!batch.length) continue;
        // Repairs only fill gaps; they never knock down what's there now.
        this.sim.setBlocks(p.kind === 'repair' ? batch.filter(([x, y, z]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === B.air) : batch);
        p.placed += batch.length;
        const g = g0;
        const e = batch[batch.length - 1];
        if (g.active.has(p.sid) && Math.abs(g.player.x - e[0]) < 24 && Math.abs(g.player.z - e[2]) < 20) {
          g.renderer.emit(e[0], e[1], e[2], { n: 4, color: ['#c8a064', '#8e6a3a', '#e8e0d0'], up: 30, life: 0.5, oy: -6 });
          if (Math.random() < 0.3) g.audio?.play('place');
        }
      }
      if (p.placed >= plan.list.length) this.finish(L, p, plan);
    }
    if (this.projects.length > 40) this.projects = this.projects.filter((p) => !p.done);
  }

  finish(L, p, plan, silent = false) {
    p.done = true;
    const sim = this.sim;
    for (const r of L.npcs) if (r.override && r.override.project === p.id) r.override = null;
    if (p.kind === 'repair') {
      if (!silent) ledger(L, this.game.day, `The builders finished ${p.label}.`);
      // More damage done in the meantime? Back to work.
      this.noteDamage(L, L.buildings[p.bid]);
      return;
    }
    const b = L.buildings[p.bid];
    const nb = plan.bld;
    if (p.kind === 'build') {
      b.underConstruction = false;
      b.planRef = { kind: 'build', plot: p.plot, type: p.type };
      if (!L.econ.biz[b.id] && !b.residential) L.econ.biz[b.id] = { till: 25, store: {}, earned: 0, earnedY: 0 };
    } else {
      const from = { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, type: b.type };
      // Old seats and spots of the smaller house go; the new ones come in.
      L.spots = L.spots.filter((s) => !(s.building === b.id || (s.x >= b.x0 && s.x <= b.x1 && s.z >= b.z0 && s.z <= b.z1)));
      Object.assign(b, {
        type: nb.type, x0: nb.x0, z0: nb.z0, x1: nb.x1, z1: nb.z1, beds: nb.beds, seats: nb.seats, work: nb.work, free: nb.free,
        homeSpots: nb.homeSpots, roofTop: nb.roofTop, roofBase: nb.roofBase, chestPos: nb.chestPos, name: nb.name,
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
    if (!this.built.some((q) => q.id === p.id)) this.built.push({ id: p.id, sid: p.sid, kind: p.kind, bid: p.bid, plot: p.plot, type: p.type, bounds: p.bounds, rev: p.rev, from: b.planRef.from });
    if (!silent) {
      ledger(L, this.game.day, `The builders finished ${p.label}.`);
      if (p.owner === 'player') {
        this.game.ui.msg(`Your house in ${L.settlement.name} has been enlarged!`, '#ffe070');
        this.game.audio?.play('coin');
      }
      if (p.kind === 'build') sim.onBuilt?.(L, b);
    }
    this.game.refreshSigns?.();
  }

  // Re-create finished and unfinished buildings when a town is laid out
  // again after loading (in the order they were first built).
  restore(L) {
    const sid = L.settlement.id;
    const steps = [
      ...this.built.filter((q) => q.sid === sid).map((q) => ({ bid: q.bid, q, done: true })),
      ...this.projects.filter((p) => p.sid === sid && !p.done && p.kind !== 'repair').map((p) => ({ bid: p.bid, q: p, done: false })),
    ].sort((a, b) => a.bid - b.bid || (a.done === b.done ? 0 : a.done ? -1 : 1));
    return steps;
  }

  applyRestore(L, step) {
    const q = step.q;
    if (q.kind === 'build') {
      if (L.buildings[q.bid]) return;
      const plot = L.plots[q.plot];
      if (!plot) return;
      plot.taken = true;
      const plan = L.typedBlueprint(plot, q.type, L.buildings.length);
      L.buildings.push(plan.bld);
      L.claimFootprint(plan.bld);
      if (step.done) {
        const b = plan.bld;
        b.planRef = { kind: 'build', plot: q.plot, type: q.type };
        for (const sp of plan.spots) L.spots.push(sp);
        for (const ch of plan.chimneys) L.chimneys.push(ch);
        for (const sg of plan.signs) L.signs.push(sg);
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
