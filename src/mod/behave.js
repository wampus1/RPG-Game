// What a mod's creature has been told to do (round 64): walk somewhere,
// follow someone, run from them, wander, patrol, keep its distance, stand
// still, guard a place, go after someone. Set by the Behaviour nodes (see
// nodes.js), carried out on the creature's turn (see hooks.modBrain)
// before its kind's own ways, which it goes back to when the order's done.
import { findPath } from '../entities/pathfind.js';
import { sameSide } from '../entities/monsters.js';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const gone = (e) => !e || e.dead || e.limbo || e.down;
const placeOf = (v) => (v && typeof v.x === 'number' && typeof v.z === 'number' ? v : null);

// An order given (null: back to its own ways). `o.kind` and what that
// kind wants; `o.done(port)`: the rest of the flow, when it's over.
export function setOrder(c, o) {
  const was = c.modOrder;
  c.modOrder = o ? { ...o, t: 0, left: o.secs > 0 ? o.secs : Infinity } : null;
  c.path = null;
  c.modPath = null;
  if (was && was !== o && was.kind === 'guard' && c.target === was.foe) c.target = null;
}

// A step toward a place, by the way round anything in it (looked for now
// and then). True if it's on its way.
export function walkTo(c, at, mul = 1) {
  const game = c.game;
  const d = flat(c, at);
  if (d < 0.5) return false;
  const goal = { x: Math.round(at.x), z: Math.round(at.z) };
  const stale = !c.modPath || c.modPathI >= c.modPath.length || !c.modGoal || c.modGoal.x !== goal.x || c.modGoal.z !== goal.z;
  c.modPathT = (c.modPathT || 0) - 0.1;
  if (stale && c.modPathT <= 0) {
    c.modPathT = d <= 8 ? 0.4 : 1;
    c.modGoal = goal;
    c.modPath = game.requestPathBudget?.(d <= 8) !== false ? findPath(game.world, c.x, c.y, c.z, goal.x, at.y ?? c.y, goal.z, { maxNodes: 500, near: 1, partial: true }) : null;
    c.modPathI = 0;
  }
  const dur = c.stepTime() * mul;
  if (c.modPath && c.modPathI < c.modPath.length) {
    const [nx, , nz] = c.modPath[c.modPathI];
    if (c.tryStep(nx, nz, dur)) {
      c.modPathI++;
      return true;
    }
    c.modPath = null;
  }
  // (No way found: straight at it, as well as it can.)
  const sx = Math.sign(goal.x - c.x);
  const sz = Math.sign(goal.z - c.z);
  const tries = Math.abs(goal.x - c.x) >= Math.abs(goal.z - c.z) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
  for (const [dx, dz] of tries) if ((dx || dz) && c.tryStep(c.x + dx, c.z + dz, dur)) return true;
  return false;
}

// A step away from someone (or somewhere).
export function stepAway(c, from, mul = 1) {
  const dx = Math.sign(c.x - from.x) || (Math.random() < 0.5 ? 1 : -1);
  const dz = Math.sign(c.z - from.z) || (Math.random() < 0.5 ? 1 : -1);
  const opts = Math.random() < 0.5 ? [[dx, 0], [0, dz], [dz, dx], [-dz, -dx]] : [[0, dz], [dx, 0], [-dz, -dx], [dz, dx]];
  for (const [ox, oz] of opts) {
    if (flat({ x: c.x + ox, z: c.z + oz }, from) < flat(c, from)) continue;
    if (c.tryStep(c.x + ox, c.z + oz, c.stepTime() * mul)) return true;
  }
  return false;
}

// Whoever's about to fight, round a place (for a guard).
function foeNear(c, at, r, o) {
  const game = c.game;
  const close = (e) => e !== c && !gone(e) && flat(e, at) <= r && Math.abs((e.y ?? 0) - (c.y ?? 0)) <= 3;
  const which = o.which || 'its foes';
  let list;
  if (which === 'players') list = game.everyone().filter(close);
  else if (which === 'creatures') list = game.creatures.filter((q) => close(q) && (!o.species || q.species === o.species) && q.species !== c.species && !q.petOf);
  else if (which === 'everyone not of its kind') list = [...game.everyone(), ...game.creatures].filter((q) => close(q) && q.species !== c.species && !q.petOf);
  else list = [...game.everyone(), ...game.creatures.filter((q) => q.hostileNow && q.species !== c.species)].filter((q) => close(q) && !sameSide(c, q));
  let best = null;
  let bd = Infinity;
  for (const e of list) {
    const d = flat(e, c);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

const finish = (c, o, port = 'done') => {
  if (c.modOrder === o) c.modOrder = null;
  c.modPath = null;
  if (o.done) o.done(port);
};

// The creature's turn at its order. True if that's what it's doing (its
// kind's own ways wait).
export function orderTick(c, dt) {
  const o = c.modOrder;
  if (!o) return false;
  o.t += dt;
  o.left -= dt;
  if (o.left <= 0) {
    finish(c, o, o.kind === 'goto' ? 'failed' : 'done');
    return false;
  }
  // (Something at it, and it's one to fight: it fights, then gets on.)
  if (o.fights && c.hostileNow && c.target && !gone(c.target) && flat(c, c.target) <= (c.S.aggro || 6)) return false;
  const mul = o.pace || 1;
  switch (o.kind) {
    case 'goto': {
      const at = placeOf(o.at);
      if (!at) {
        finish(c, o, 'failed');
        return false;
      }
      if (flat(c, at) <= (o.near ?? 1) + 0.01) {
        finish(c, o, 'arrived');
        return true;
      }
      if (!walkTo(c, at, mul)) {
        o.stuck = (o.stuck || 0) + dt;
        if (o.stuck > 4) finish(c, o, 'failed');
      } else o.stuck = 0;
      return true;
    }
    case 'follow': {
      const w = o.who;
      if (gone(w)) {
        finish(c, o);
        return false;
      }
      if (flat(c, w) > (o.dist ?? 2)) walkTo(c, w, mul);
      else c.face?.(w.x, w.z);
      return true;
    }
    case 'flee': {
      const f = placeOf(o.from);
      if (!f || (o.from.dead)) {
        finish(c, o);
        return false;
      }
      if (flat(c, f) >= (o.far ?? 10)) {
        if (!o.safe) {
          o.safe = true;
          if (o.done) o.done('safe');
        }
        if (o.secs > 0) return true;
        c.modOrder = null;
        return false;
      }
      o.safe = false;
      stepAway(c, f, 0.7 * mul);
      return true;
    }
    case 'wander': {
      const at = placeOf(o.at) || c.home || c;
      o.rest = (o.rest ?? 0) - dt;
      if (flat(c, at) > (o.r ?? 6) + 1) {
        walkTo(c, at, mul);
        return true;
      }
      if (o.rest <= 0) {
        o.rest = (o.every ?? 2) * (0.5 + Math.random());
        const [dx, dz] = STEPS[Math.floor(Math.random() * 4)];
        if (flat({ x: c.x + dx, z: c.z + dz }, at) <= (o.r ?? 6)) c.tryStep(c.x + dx, c.z + dz, c.stepTime() * 1.3 * mul);
      }
      return true;
    }
    case 'patrol': {
      const pts = (o.points || []).filter(placeOf);
      if (!pts.length) {
        finish(c, o);
        return false;
      }
      o.i = Math.min(o.i ?? 0, pts.length - 1);
      const at = pts[o.i];
      if (o.wait > 0) {
        o.wait -= dt;
        return true;
      }
      if (flat(c, at) <= 1.01) {
        o.wait = o.pause ?? 1;
        if (o.each) o.each(at);
        if (o.back) {
          o.dir = o.dir || 1;
          if (o.i + o.dir < 0 || o.i + o.dir >= pts.length) o.dir = -o.dir;
          o.i = Math.max(0, Math.min(pts.length - 1, o.i + o.dir));
        } else o.i = (o.i + 1) % pts.length;
        return true;
      }
      walkTo(c, at, mul);
      return true;
    }
    case 'keep': {
      const w = o.who;
      if (gone(w)) {
        finish(c, o);
        return false;
      }
      const d = flat(c, w);
      if (d < (o.min ?? 3)) stepAway(c, w, 0.8 * mul);
      else if (d > (o.max ?? 6)) walkTo(c, w, mul);
      else {
        c.face?.(w.x, w.z);
        // (Circling a little, as a wary thing does.)
        o.rest = (o.rest ?? 0) - dt;
        if (o.rest <= 0) {
          o.rest = 1 + Math.random() * 1.5;
          const sx = Math.sign(c.z - w.z) || 1;
          const sz = -Math.sign(c.x - w.x) || 1;
          c.tryStep(c.x + (Math.random() < 0.5 ? sx : 0), c.z + (Math.random() < 0.5 ? sz : 0), c.stepTime() * 1.2 * mul);
          c.face?.(w.x, w.z);
        }
      }
      return true;
    }
    case 'hold': {
      const f = placeOf(o.face);
      if (f) c.face?.(f.x, f.z);
      return true;
    }
    case 'guard': {
      const at = placeOf(o.at) || c.home || c;
      const r = o.r ?? 6;
      if (o.foe && (gone(o.foe) || flat(o.foe, at) > r * 1.6)) {
        if (c.target === o.foe) c.target = null;
        o.foe = null;
      }
      if (!o.foe) {
        o.look = (o.look ?? 0) - dt;
        if (o.look <= 0) {
          o.look = 0.4;
          o.foe = foeNear(c, at, r, o);
        }
      }
      if (o.foe) {
        c.target = o.foe;
        c.chase(dt);
        return true;
      }
      if (flat(c, at) > 1.5) walkTo(c, at, mul);
      return true;
    }
    case 'hunt': {
      const w = o.who;
      if (gone(w)) {
        if (c.target === w) c.target = null;
        finish(c, o);
        return false;
      }
      c.target = w;
      c.chase(dt);
      return true;
    }
    default:
      c.modOrder = null;
      return false;
  }
}

// What it's at, in a word (for the What it's doing node).
export function doingOf(c) {
  const o = c && c.modOrder;
  if (!c) return 'nothing';
  if (c.dead) return 'dead';
  if (o) return { goto: 'walking', follow: 'following', flee: 'fleeing', wander: 'wandering', patrol: 'patrolling', keep: 'keeping away', hold: 'standing', guard: o.foe ? 'fighting' : 'guarding', hunt: 'hunting' }[o.kind] || o.kind;
  if (c.petOf) return 'following';
  if (c.hostileNow && c.target) return 'fighting';
  return 'its own ways';
}

// A leap (through the air to a place): carried along each frame.
export function leapTick(c, dt) {
  const L = c.modLeap;
  if (!L) return;
  L.t += dt;
  const k = Math.min(1, L.t / L.dur);
  c.hop = Math.sin(k * Math.PI) * L.h;
  if (k >= 1) {
    c.hop = 0;
    c.modLeap = null;
  }
}
