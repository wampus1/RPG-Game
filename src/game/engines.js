// Siege engines in a battle you're near (see war.js): catapults behind a
// side's line, lobbing stones into the enemy's ranks, and a ram rolled up
// to the wall of the town the attackers mean to take, to knock a breach in
// it. Each has a crew from its side's soldiers (see warrior.js): with
// nobody at it, a catapult can't shoot and a ram doesn't roll. They're
// props, drawn big and in nobody's way; when it's all over, they stay on
// the field until you're out of sight of them.
import { GROUND } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { M } from '../world/settlement.js';

let N = 0;

export class Engine {
  constructor(game, type, x, y, z, o = {}) {
    this.game = game;
    this.kind = 'prop';
    this.type = type; // 'catapult' | 'ram'
    this.id = 96000 + N++;
    this.x = x;
    this.y = y;
    this.z = z;
    this.fx = x;
    this.fy = y;
    this.fz = z;
    this.moveT = 1;
    this.moveDur = 0.8;
    this.dir = o.dir ?? 1;
    this.side = o.side || null;
    this.banner = o.banner || null;
    this.hp = o.hp ?? 40;
    this.maxHp = this.hp;
    this.dead = false;
    this.broken = false;
    this.flash = 0;
    // (The arm or the log in motion, for the renderer.)
    this.fireT = 0;
    this.cd = o.cd ?? 4;
    this.crew = [];
    this.phase = o.phase || 'ready';
  }

  get moving() {
    return this.moveT < 1;
  }

  renderPos() {
    const t = this.moveT;
    if (t >= 1) return { x: this.x, y: this.y, z: this.z };
    return { x: this.fx + (this.x - this.fx) * t, y: this.fy + (this.y - this.fy) * t, z: this.fz + (this.z - this.fz) * t };
  }

  moveTo(x, y, z, dur) {
    this.fx = this.x;
    this.fy = this.y;
    this.fz = this.z;
    this.x = x;
    this.y = y;
    this.z = z;
    this.moveT = 0;
    this.moveDur = dur;
    const dx = x - this.fx;
    const dz = z - this.fz;
    if (Math.abs(dx) > Math.abs(dz)) this.dir = dx < 0 ? 1 : 3;
    else if (dz) this.dir = dz < 0 ? 2 : 0;
  }

  update(dt) {
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt / this.moveDur);
    if (this.fireT > 0) this.fireT = Math.max(0, this.fireT - dt);
    if (this.flash > 0) this.flash -= dt;
  }

  // Someone of its crew close enough to work it.
  manned() {
    return this.crew.some((n) => !n.dead && !n.down && n.warband && n.warband.phase !== 'flee' && Math.max(Math.abs(n.x - this.x), Math.abs(n.z - this.z)) <= 2);
  }
}

// Each frame: things in motion, and done engines cleared away once you're
// well out of sight of them.
export function updateEngines(game, dt) {
  if (!game.engines || !game.engines.length) return;
  for (const e of game.engines) e.update(dt);
  game.engines = game.engines.filter((e) => !(e.done && !game.inSight(e.x, e.z, 6)));
}

// A blow struck at an engine (by you): wood splinters; enough of them and
// it's wrecked.
export function hitEngine(game, e, amount) {
  if (e.broken) return false;
  e.hp -= amount;
  e.flash = 0.12;
  game.renderer.emit(e.x + 0.5, e.y + 1, e.z + 0.5, { n: 6, color: ['#7a5430', '#a07a4a', '#5a3a20'], up: 24, speed: 30, life: 0.5, gravity: 40 });
  game.audio?.play('break', e);
  if (e.hp <= 0) {
    e.broken = true;
    e.hp = 0;
    game.renderer.emit(e.x + 0.5, e.y + 1, e.z + 0.5, { n: 22, color: ['#7a5430', '#a07a4a', '#5a3a20', '#8a8a8a'], up: 40, speed: 50, life: 0.9, gravity: 40 });
    game.ui.msg(e.type === 'ram' ? 'The ram\'s shed collapses on its log: it won\'t be battering anything now.' : 'The catapult\'s arm snaps: it won\'t throw again.', '#ffe070');
  }
  return true;
}

// Where an engine can stand: on dry ground, not up a wall.
function standAt(game, x, z, hint = GROUND) {
  const w = game.world;
  if (!w.regionAt(x, z)) return -1;
  const y = w.findStandY(x, z, hint);
  if (y <= 0 || Math.abs(y - hint) > 2 || w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z)) return -1;
  return y;
}

// The stretch of a town's wall nearest a point.
export function wallNear(L, at) {
  const b = L.bounds;
  let best = null;
  for (let z = b.z0 - 12; z <= b.z1 + 12; z++) {
    for (let x = b.x0 - 12; x <= b.x1 + 12; x++) {
      if (L.maskAt(x, z) !== M.WALL) continue;
      const d = Math.hypot(x - at.x, z - at.z);
      if (!best || d < best.d) best = { x, z, d };
    }
  }
  return best;
}

// The engines for a battle about to begin, each with its crew: where a
// side's realm builds catapults, one behind its line (two for a big army);
// where the attackers have rams and the town they're marching on is
// walled, a ram behind theirs, to make for the wall once it starts. In
// view of you, they're rolled up from behind their lines, out of sight.
export function fieldEngines(war, live) {
  const g = war.game;
  const { plan, centre: c, axis: ax, perp } = live;
  live.engines = [];
  g.engines ||= [];
  const rng = new RNG(hash4(plan.at, live.w.id, 0xe9e));
  for (const side of ['a', 'b']) {
    const S = live.sides[side];
    if (!S || !S.ents.length) continue;
    const kit = war.engines(plan, side);
    const s = S.sign;
    const banner = S.civ ? S.civ.color.hex : null;
    // (Crew from the levies first: the trained guards stay in the line.)
    const crew = S.ents.filter((n) => !n.mount && n.warband && !n.warband.merc).sort((p, q) => (q.warband.levy ? 1 : 0) - (p.warband.levy ? 1 : 0));
    const put = (type, back, off, hands) => {
      const gx = Math.round(c.x + ax.x * back * s + perp.x * off);
      const gz = Math.round(c.z + ax.z * back * s + perp.z * off);
      let x = gx;
      let z = gz;
      for (let k = 0; k < 40 && g.inSight(x, z, 2); k += 2) {
        x = Math.round(x + ax.x * 2 * s);
        z = Math.round(z + ax.z * 2 * s);
      }
      const y = standAt(g, x, z);
      if (y < 0 || g.inSight(x, z, 2)) return null;
      const gy = standAt(g, gx, gz, y);
      const e = new Engine(g, type, x, y, z, { side, banner, phase: x === gx && z === gz ? 'ready' : 'roll', hp: type === 'ram' ? 60 : 40, cd: 3 + rng.next() * 3 });
      e.goal = gy > 0 ? { x: gx, y: gy, z: gz } : { x, y, z };
      e.face = { x: c.x - ax.x * 30 * s, z: c.z - ax.z * 30 * s };
      for (const n of crew.splice(0, hands)) {
        n.warband.role = 'crew';
        n.warband.engine = e.id;
        e.crew.push(n);
      }
      if (!e.crew.length) return null;
      e.dir = Math.abs(ax.x) > Math.abs(ax.z) ? (ax.x * s > 0 ? 1 : 3) : (ax.z * s > 0 ? 2 : 0);
      live.engines.push(e);
      g.engines.push(e);
      return e;
    };
    const big = S.ents.length >= 10;
    for (let i = 0; i < (kit.catapults ? (big ? 2 : 1) : 0); i++) put('catapult', 20, i ? -5 : 5, 1);
    if (kit.ram) {
      const def = war.ow.settlements[plan.def];
      const DL = def && g.world.layouts.get(def.id);
      const wall = DL && wallNear(DL, c);
      if (wall) {
        const e = put('ram', 17, 0, 2);
        if (e) {
          e.wall = { x: wall.x, z: wall.z };
          e.town = def.id;
          e.phase = e.phase === 'roll' ? 'roll' : 'wait';
        }
      }
    }
  }
  if (live.engines.length) {
    const cats = live.engines.filter((e) => e.type === 'catapult').length;
    const rams = live.engines.filter((e) => e.type === 'ram').length;
    g.ui.msg(`${[cats ? `${cats} catapult${cats > 1 ? 's' : ''}` : '', rams ? 'a battering ram' : ''].filter(Boolean).join(' and ')} brought up to the field!`, '#ffb080');
  }
}

// A quarter-second of a battle, for its engines.
export function workEngines(war, live, dt) {
  const g = war.game;
  for (const e of live.engines || []) {
    if (e.broken || e.done) continue;
    const S = live.sides[e.side];
    const other = live.sides[e.side === 'a' ? 'b' : 'a'];
    // (Over, unless it's a ram going on to the wall of a town its side has
    // just taken.)
    const over = (live.done && !e.after) || S.broken;
    e.crew = e.crew.filter((n) => !n.dead && g.npcs.includes(n));
    // Rolled up from behind the lines to where it's to stand.
    if (e.phase === 'roll') {
      if (e.moving || !e.manned()) continue;
      if (step(g, e, e.goal)) continue;
      e.phase = e.type === 'ram' ? 'wait' : 'ready';
      continue;
    }
    if (over) continue;
    if (e.type === 'catapult') {
      if (!live.go || !e.manned()) continue;
      e.cd -= dt;
      if (e.cd > 0) continue;
      const t = target(g, e, S, other);
      if (!t) {
        e.cd = 1;
        continue;
      }
      e.cd = 6 + Math.random() * 2.5;
      e.fireT = 0.7;
      // (A little off, as often as not: they move, and stones fly wide.)
      const tx = t.x + Math.round((Math.random() - 0.5) * 2.4);
      const tz = t.z + Math.round((Math.random() - 0.5) * 2.4);
      g.lob(e, tx, t.y, tz, 8);
      for (const n of e.crew) if (!n.moving) n.doAction(0.3);
      continue;
    }
    // The ram: for the wall, once it's begun; battering when it's there.
    if (e.type === 'ram') {
      if ((!live.go && !e.after) || !e.wall) continue;
      const at = Math.max(Math.abs(e.x - e.wall.x), Math.abs(e.z - e.wall.z));
      if (e.phase === 'wait') e.phase = 'go';
      if (e.phase === 'go') {
        if (at <= 1) {
          e.phase = 'batter';
          e.hits = 0;
          e.cd = 1;
          continue;
        }
        if (e.moving || !e.manned()) continue;
        // (At a run: a log on wheels, a crew heaving at it.)
        if (!step(g, e, { x: e.wall.x, y: e.y, z: e.wall.z }, 0.6)) {
          e.stuck = (e.stuck || 0) + dt;
          if (e.stuck > 10) e.phase = 'stuck';
        } else e.stuck = 0;
        continue;
      }
      if (e.phase === 'batter') {
        if (!e.manned()) continue;
        e.cd -= dt;
        if (e.cd > 0) continue;
        e.cd = 1.3;
        e.fireT = 0.5;
        e.hits++;
        for (const n of e.crew) if (!n.moving) n.doAction(0.3);
        g.renderer.emit(e.wall.x + 0.5, GROUND + 1, e.wall.z + 0.5, { n: 8, color: ['#8a8a8a', '#6a625a', '#b8b0a0'], up: 20, speed: 24, life: 0.6, gravity: 40 });
        g.audio?.play('impact', { x: e.wall.x, y: GROUND, z: e.wall.z });
        if (g.inSight(e.wall.x, e.wall.z, 2)) g.shake = Math.min(1.3, (g.shake || 0) + 0.18);
        if (e.hits >= 5) {
          const DL = g.world.layouts.get(e.town);
          if (DL && DL.econ) {
            war.breach(DL, live.plan, e.wall);
            const s = war.ow.settlements[e.town];
            g.ui.msg(`The ram has broken through the wall of ${s ? s.name : 'the town'}!`, '#ff9060');
          }
          e.phase = 'breached';
          if (e.after) e.done = true;
        }
      }
    }
  }
}

// Over: they stay where they stand (and go once you're out of sight). A
// ram whose side has taken the town (`taker`) goes on to its wall and
// breaks in, its crew with it.
export function endEngines(live, taker = null) {
  for (const e of live.engines || []) {
    if (taker && e.type === 'ram' && e.side === taker && e.wall && !e.broken && e.phase !== 'stuck' && e.phase !== 'breached') {
      e.after = true;
      if (e.phase !== 'batter') e.phase = 'go';
      continue;
    }
    e.done = true;
    for (const n of e.crew) if (n.warband && n.warband.role === 'crew') n.warband.role = 'centre';
  }
}

// A ram still under way: on its way to the wall, or at it.
export const ramming = (live) => (live.engines || []).some((e) => e.after && !e.done && !e.broken && e.phase !== 'stuck');

// One tile toward a spot (round what's in the way): false when it's there,
// or can't get any nearer.
function step(g, e, goal, dur = 0.8) {
  const dx = Math.sign(goal.x - e.x);
  const dz = Math.sign(goal.z - e.z);
  if (!dx && !dz) return false;
  const tries = Math.abs(goal.x - e.x) >= Math.abs(goal.z - e.z) ? [[dx, 0], [0, dz || 1], [0, -(dz || 1)]] : [[0, dz], [dx || 1, 0], [-(dx || 1), 0]];
  for (const [ox, oz] of tries) {
    if (!ox && !oz) continue;
    const nx = e.x + ox;
    const nz = e.z + oz;
    const y = standAt(g, nx, nz, e.y);
    if (y < 0 || Math.abs(y - e.y) > 1) continue;
    e.moveTo(nx, y, nz, dur);
    return true;
  }
  return false;
}

// Who a catapult throws at: one of the enemy, in range, with none of its
// own side close by (and you, if they count you among the enemy).
function target(g, e, S, other) {
  const foes = other.ents.filter((n) => !n.dead && !n.down && g.npcs.includes(n) && n.warband && n.warband.phase !== 'flee');
  if (S.hates && !g.player.dead && !g.player.down) foes.push(g.player);
  const mine = S.ents.filter((n) => !n.dead && !n.down && g.npcs.includes(n));
  const ok = foes.filter((t) => {
    const d = Math.max(Math.abs(t.x - e.x), Math.abs(t.z - e.z));
    if (d < 8 || d > 34) return false;
    return !mine.some((n) => Math.max(Math.abs(n.x - t.x), Math.abs(n.z - t.z)) <= 2);
  });
  if (!ok.length) return null;
  return ok[Math.floor(Math.random() * ok.length)];
}
