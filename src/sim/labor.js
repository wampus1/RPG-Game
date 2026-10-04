// Prison labour (see tech.js). Where a realm has taken it up, its prisoners
// (prisoners of war in the cells, and townsfolk serving time) go out by day
// to quarry stone and cut wood for the town, under the eye of whatever
// guards can be spared from the watch: one for every two prisoners at
// most, and none at all when the watch is thin. Each day worked takes two
// days off a sentence, and a prisoner of war who's worked eight days is let
// go home. Near you, you see the gang go out through the cell doors in the
// morning, at it all day outside the town with picks and axes, the guards
// standing over them, and back to the cells by four.
import { alive, ledger, stockOf, DAY, setOverride } from './econ.js';
import { GROUND } from '../config.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';

export const WORK_FROM = 8 * 60;
export const WORK_TO = 16 * 60;
const FREED_AFTER = 8;
const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

export class Labor {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // Who's in the cells here, serving time or held from the war.
  prisoners(L) {
    const s = L.settlement;
    const war = this.sim.war;
    const now = this.sim.abs;
    const out = [];
    for (const p of war.held(s.id)) {
      const rec = war.recOfPrisoner(p);
      if (rec && alive(rec)) out.push({ kind: 'pow', p, rec });
    }
    for (const r of residents(L)) {
      const lf = r.life;
      if (lf && !lf.held && lf.jailUntil && lf.jailUntil > now) out.push({ kind: 'crook', rec: r });
    }
    return out;
  }

  // How many of the watch can be spared: all but one in twelve of the
  // townsfolk (two at the least).
  spare(L) {
    const people = residents(L);
    const guards = people.filter((r) => r.job === 'guard' && alive(r) && !r.away && r.soldier === undefined && r.captive === undefined && r.ruler === undefined);
    const keep = Math.max(2, Math.ceil(people.length / 12));
    return { guards: guards.slice(keep), keep };
  }

  // Each morning: who goes out, what they bring in, time off their
  // sentences.
  daily(L, day, rng) {
    const s = L.settlement;
    const e = L.econ;
    // (Yesterday's worked off: gone home, if you weren't there to see it.)
    if (e) this.evening(L, day);
    if (!e || s.deserted || !this.sim.tech.has(s, 'prison_labor')) return null;
    const all = this.prisoners(L);
    if (!all.length) {
      e.labor = null;
      return null;
    }
    const { guards } = this.spare(L);
    const n = Math.min(all.length, guards.length * 2);
    if (!n) {
      e.labor = null;
      if (day % 5 === 0) ledger(L, day, `No guards can be spared to watch the prisoners: they stay in the cells.`);
      return { idle: all.length };
    }
    const gang = all.slice(0, n);
    const watch = guards.slice(0, Math.ceil(n / 2));
    let stone = 0;
    let wood = 0;
    gang.forEach((q, i) => {
      if (i % 2) wood += 2 + rng.int(0, 1);
      else stone += 2 + rng.int(0, 1);
    });
    const k = stockOf(L);
    k.stone = (k.stone || 0) + stone;
    k.wood = (k.wood || 0) + wood;
    const freed = [];
    for (const q of gang) {
      if (q.kind === 'crook') q.rec.life.jailUntil -= 2 * DAY;
      else {
        q.p.worked = (q.p.worked || 0) + 1;
        if (q.p.worked >= FREED_AFTER) freed.push(q.p);
      }
    }
    e.labor = { day, gang: gang.map((q) => (q.kind === 'pow' ? { pow: q.p.id } : { idx: q.rec.idx })), guards: watch.map((r) => r.idx), stone, wood };
    ledger(L, day, `${n} prisoner${n > 1 ? 's' : ''} went out to the quarry and the woods under ${watch.length} guard${watch.length > 1 ? 's' : ''}: +${stone} stone, +${wood} timber for the town.`);
    // (Worked off: home they go, once the day's done.)
    for (const p of freed) {
      e.freeAfter ||= [];
      if (!e.freeAfter.includes(p.id)) e.freeAfter.push(p.id);
    }
    return { gang: n, guards: watch.length, stone, wood };
  }

  // Evening: those who've worked off their captivity go home.
  evening(L, day) {
    const e = L.econ;
    if (!e || !e.freeAfter || !e.freeAfter.length) return [];
    const war = this.sim.war;
    const out = [];
    for (const id of e.freeAfter) {
      const p = war.prisoners.find((q) => q.id === id);
      if (p) {
        war.release(p, 'worked', day);
        out.push(p);
      }
    }
    e.freeAfter = [];
    if (out.length) ledger(L, day, `${out.map((p) => p.name).join(', ')} ${out.length > 1 ? 'have' : 'has'} worked off ${out.length > 1 ? 'their' : 'their'} captivity, and gone home.`);
    return out;
  }
}

// ------------------------------------------------------------ on the ground
// Twice a second: out through the cell doors in the morning, back by four.
export function updateLabor(game, dt) {
  game.laborT = (game.laborT || 0) - dt;
  if (game.laborT > 0 || game.skipping) return;
  game.laborT = 0.5;
  const sim = game.sim;
  const m = game.minute;
  for (const a of game.active.values()) {
    const L = a.layout;
    const lb = L.econ && L.econ.labor;
    if (!lb || lb.day !== game.day) continue;
    // The evening release (worked off), once they're back in.
    if (m >= WORK_TO + 60 && L.econ.freeAfter && L.econ.freeAfter.length) sim.labor.evening(L, game.day);
    if (m < WORK_FROM || m >= WORK_TO) continue;
    const site = (lb.site ||= workSite(game, L));
    if (!site) continue;
    let opened = false;
    lb.gang.forEach((q, i) => {
      const n = q.pow !== undefined ? sim.war.captiveEnts.get(q.pow) : L.npcs[q.idx] && L.npcs[q.idx].ent;
      if (!n || n.dead || n.labor || (n.state !== 'captive' && n.state !== 'jailed')) return;
      const cell = n.state === 'captive' ? n.captive : L.jail ? { stand: L.jail.stand, door: L.jail.door, y: L.jail.y } : null;
      if (!cell) return;
      const slot = { x: site.x + ((i % 3) - 1) * 2, z: site.z + Math.floor(i / 3) * 2 };
      // (One at a time through the cell door.)
      n.labor = { prev: n.state, cell, slot, site, tool: i % 2 ? 'stone_axe' : 'stone_pickaxe', phase: 'out', t: 0, L, wait: i * 2.5 };
      n.state = 'labor';
      n.sleeping = false;
      n.path = null;
      opened = true;
    });
    if (opened) doors(game, L, true);
    // The guards who can be spared, standing over them.
    for (const idx of lb.guards) {
      const r = L.npcs[idx];
      if (!r || !alive(r) || (r.override && r.override.act === 'watch' && r.override.labor)) continue;
      setOverride(r, sim.abs, game.day * DAY + WORK_TO + 30, 'watch', { target: { x: site.x, z: site.z - 2 }, labor: true });
      if (r.ent && !r.ent.dead) r.ent.activity = null;
    }
  }
}

// Somewhere outside the town to work: open ground a few paces beyond its
// edge, on the side nearest the cells.
function workSite(game, L) {
  const w = game.world;
  const b = L.bounds;
  const from = L.jail ? L.jail.stand : { x: L.plaza.cx, z: L.plaza.cz };
  const sides = [
    { x: b.x0 - 6, z: from.z }, { x: b.x1 + 6, z: from.z }, { x: from.x, z: b.z0 - 6 }, { x: from.x, z: b.z1 + 6 },
  ].sort((p, q) => Math.hypot(p.x - from.x, p.z - from.z) - Math.hypot(q.x - from.x, q.z - from.z));
  for (const s of sides) {
    for (let r = 0; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = s.x + dx;
          const z = s.z + dz;
          if (!w.regionAt(x, z) || (L.maskAt(x, z) !== M.FREE && L.maskAt(x, z) !== undefined)) continue;
          const y = w.findStandY(x, z, GROUND);
          if (y !== GROUND || w.isWaterAt(x, y - 1, z)) continue;
          return { x, z };
        }
      }
    }
  }
  return null;
}

// The cell doors: open for the gang going out, shut behind them.
function doors(game, L, open) {
  const w = game.world;
  const set = (d) => {
    if (!d || !w.regionAt(d.x, d.z)) return;
    const y = d.y ?? GROUND;
    const id = w.getBlock(d.x, y, d.z);
    if (open && id === B.cell_door) w.setBlock(d.x, y, d.z, B.cell_door_open, 0);
    else if (!open && id === B.cell_door_open) w.setBlock(d.x, y, d.z, B.cell_door, 0);
  };
  if (L.jail && !game.sim.justice.jailedIn(L.settlement.id)) game.sim.justice.setCellDoor(L, open);
  for (const c of L.prisonCells || []) set(c.door);
}

// A prisoner on the work gang: out to their place, at it with pick or axe
// till four, then back to the cell.
export function laborTick(n, dt) {
  const lb = n.labor;
  const g = n.game;
  if (!lb) {
    n.state = 'routine';
    return;
  }
  lb.t += dt;
  const m = g.minute;
  // (Their time served while they were out: free.)
  if (lb.prev === 'jailed') {
    const lf = n.rec.life || {};
    if (!lf.held && !(lf.jailUntil && lf.jailUntil > g.sim.abs)) {
      n.labor = null;
      n.state = 'routine';
      n.activity = null;
      n.say(n.rng.pick(['Free! And I\'ve earned it.', 'That\'s my time done.', 'No more rocks for me.']), 3);
      return;
    }
  }
  if (lb.phase !== 'back' && (m >= WORK_TO || m < WORK_FROM)) {
    lb.phase = 'back';
    lb.t = 0;
    n.path = null;
  }
  if (lb.phase === 'out') {
    if (lb.t < (lb.wait || 0)) return;
    const there = n.followPath({ x: lb.slot.x, y: GROUND, z: lb.slot.z }, 0);
    if (there || (lb.t > 60 && Math.max(Math.abs(n.x - lb.slot.x), Math.abs(n.z - lb.slot.z)) <= 2)) {
      lb.phase = 'work';
      lb.t = 0;
      return;
    }
    // Stuck (hemmed in, or shoved into a corner): put right where you
    // can't see it, or left in the cell for today.
    const at = `${n.x},${n.z}`;
    if (at !== lb.at || n.moving) {
      lb.at = at;
      lb.still = 0;
    } else lb.still = (lb.still || 0) + dt;
    if (lb.still > 6 && !g.inSight(n.x, n.z, 2) && !g.inSight(lb.slot.x, lb.slot.z, 2)) {
      n.teleport(lb.slot.x, GROUND, lb.slot.z);
      lb.phase = 'work';
      lb.t = 0;
    } else if (lb.still > 20) {
      lb.phase = 'back';
      lb.t = 0;
    }
    return;
  }
  if (lb.phase === 'work') {
    if (!n.moving) n.face(lb.site.x, lb.site.z + 3);
    lb.cd = (lb.cd ?? 1) - dt;
    if (lb.cd <= 0) {
      lb.cd = 1.2 + n.rng.next() * 0.8;
      n.doAction(0.35);
      const wood = lb.tool === 'stone_axe';
      if (g.inSight(n.x, n.z, 1)) {
        g.renderer.emit(n.x + 0.5, GROUND + 0.3, n.z + 0.5, { n: 3, color: wood ? ['#a07a4a', '#7a5430'] : ['#8a8a92', '#a8a8b0'], up: 14, speed: 16, life: 0.4, gravity: 30 });
        if (n.rng.chance(0.4)) g.audio?.play(wood ? 'chop' : 'stone', n);
      }
      if (n.rng.chance(0.015)) n.say(n.rng.pick(['My back...', 'Two days off for this. Two days.', 'Another stone. Another.', 'Water, please?', 'At least it\'s air.']), 2.5);
    }
    return;
  }
  // Back to the cell: to its door, then in (a step past it, and to their
  // own place, by the cot or at the bars).
  const c = lb.cell;
  const y = GROUND;
  const door = c.door || c.stand;
  if (!lb.inside) {
    if ((n.x === door.x && n.z === door.z) || n.followPath({ x: door.x, y, z: door.z }, 0)) lb.inside = 1;
    else if (lb.t > 90 && !g.inSight(n.x, n.z, 2)) {
      n.teleport(c.stand.x, y, c.stand.z);
      lb.inside = 3;
    }
    if (lb.inside !== 3) return;
  }
  if (n.moving) return;
  const adj = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1;
  const first = [c.stand, c.bed].filter(Boolean).find((t) => adj(t, door)) || c.stand;
  if (lb.inside === 1) {
    if (n.x !== first.x || n.z !== first.z) n.startMove(first.x, y, first.z, 0.5);
    lb.inside = 2;
    return;
  }
  if (lb.inside === 2) {
    lb.inside = 3;
    if (n.x !== c.stand.x || n.z !== c.stand.z) {
      n.startMove(c.stand.x, y, c.stand.z, 0.5);
      return;
    }
  }
  n.state = lb.prev;
  n.labor = null;
  n.path = null;
  n.activity = null;
  // (The last one in: the doors shut behind them.)
  const L = lb.L;
  const still = g.npcs.some((q) => q !== n && !q.dead && q.state === 'labor' && q.labor && q.labor.L === L);
  if (!still && L) doors(g, L, false);
}
