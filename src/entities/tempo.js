// How a master of an old place keeps up a fight (see creature.js, which
// runs this for every one of them):
//   its phases: whole, worn (two thirds gone... a third gone: see MARKS)
//     and desperate, each turned with a roar and a shockwave, each
//     bringing out an attack or two it held back till then (each brain
//     asks phaseOf), and quickening it (shorter breaths between attacks;
//     the music climbs with it: see music.js);
//   a breath between its attacks (ready/used), so they come one after
//     another and never all at once, however many are ready;
//   and never standing about: if it's done nothing and gone nowhere for a
//     moment, it moves (round you, to where it likes to fight from).
import { findPath } from './pathfind.js';
import { fits, apart } from './footprint.js';
import { knock } from '../game/combat.js';
import { bossTint } from '../render/bossart.js';
import { walksFields, fieldWay, lowerFields } from './fields.js';

// The hp left (as a share) at which it turns: worn, then desperate.
export const MARKS = [0.66, 0.33];
// Seconds between its attacks, by phase (quicker as it's worn down).
export const GAP = [0, 1.7, 1.35, 1.0];
// The longest it stands about before it moves (seconds).
export const STILL = 1.4;
// The longest it goes without starting an attack, by phase (seconds):
// past that, whatever it has is made ready at once (one at a time still,
// as ever); and a moment more with nothing, it comes straight at you.
export const PRESS = [0, 3.2, 2.6, 2.0];
// (Calling help isn't an attack: those keep their own time.)
const NOT_ATTACKS = new Set(['attackCd', 'callCd', 'sentCd', 'rallyCd']);

// Where each likes to fight from (paces from you; none: up close).
const RANGE = {
  priest: 5, mound_witch: 5, hollow_saint: 5, saint_shade: 5, huntsman: 6, poisoner: 3, twin_b: 3, overseer: 5,
};

// What it shouts as it turns.
const PHASE_LINES = {
  barrow_king: ['', '', 'The cold takes you all!', 'I. WILL. NOT. LIE. DOWN.'],
  mound_witch: ['', '', 'My husbands hunger, sweet...', 'Seven kings! Seven graves! Yours makes eight!'],
  huntsman: ['', '', 'The hunt quickens!', 'Run! RUN!'],
  foreman: ['', '', 'Overtime, lads!', 'Bring the whole mountain down!'],
  priest: ['', '', 'The tide rises...', 'Drown with me!'],
  hollow_saint: ['', '', 'Pray. No one is listening.', 'Burn in my light!'],
  warlord: ['', '', 'Is that all you\'ve got?', 'Burn it! Burn it all!'],
  twins: ['', '', 'Wren! Now!', 'Rrraaagh!'],
  twin_b: ['', '', 'Now it gets fun.', 'You\'ll pay for that!'],
  poisoner: ['', '', 'Time for the strong stuff.', 'Breathe deep, dear!'],
  overseer: ['', '', 'ANOMALY PERSISTS. ESCALATING.', 'CONTAINMENT FAILING. PURGE.'],
  prime: ['', '', 'OVERCLOCKING.', 'CORE CRITICAL.'],
};

export function phaseOf(c) {
  const f = c.hp / Math.max(1, c.maxHp);
  return f <= MARKS[1] ? 3 : f <= MARKS[0] ? 2 : 1;
}

// Free to start an attack (its breath since the last one is taken)?
export function ready(c) {
  return !(c.gapT > 0);
}

// An attack begun: a breath before the next (`extra` seconds more for a
// long one).
export function used(c, extra = 0) {
  c.gapT = GAP[phaseOf(c)] + extra;
  c.casts = (c.casts || 0) + 1;
  c.stillT = 0;
  c.repo = null;
  c.sinceAtk = 0;
  c.pressed = false;
}

// Gone too long without an attack (see PRESS): its cooldowns cut short
// (once), and then, if that brings nothing, 'close': at you, to strike
// with what it has to hand. Null if it isn't pressed yet.
export function press(c) {
  const ph = phaseOf(c);
  if (!c.target || c.target.dead || !((c.sinceAtk || 0) > PRESS[ph])) return null;
  if (!c.pressed) {
    c.pressed = true;
    for (const k of Object.keys(c)) if (k.endsWith('Cd') && !NOT_ATTACKS.has(k) && typeof c[k] === 'number' && c[k] > 0) c[k] = 0;
    c.gapT = Math.min(c.gapT || 0, 0.2);
    return 'ready';
  }
  if (c.sinceAtk > PRESS[ph] + 1.4 && !(c.burrowed || c.vanished || c.ceiling || c.tether || c.solid === false || c.act)) return 'close';
  return 'ready';
}

// Doing something that isn't standing about.
function busy(c) {
  return !!(c.moving || c.windup || c.act || c.burrowed || c.stunT > 0 || c.tether || c.ceiling || c.vanished || c.aiming || c.bolts > 0 || c.solid === false || c.dormant || c.waiting);
}

// Every update, whatever it's doing: its breath between attacks, and its
// phase (turned with a roar when it crosses a mark).
export function bossClock(c, dt) {
  if (c.gapT > 0) c.gapT -= dt;
  // (How long since it last went for you: a blow wound up, or one of its
  // works under way, counts.)
  if (c.windup || c.act || c.aiming || !c.target || c.target.dead || (c.game.lasers || []).some((L) => L.by === c)) {
    c.sinceAtk = 0;
    c.pressed = false;
  } else c.sinceAtk = (c.sinceAtk || 0) + dt;
  // (The Overseer's shield, down a while once its sentinels are gone, and
  // growing back up round it once they're called: see monsters.js.)
  if (c.shieldDownT > 0) c.shieldDownT -= dt;
  c.shieldUpT = (c.shieldUpT || 0) + dt;
  if (c.shieldNote > 0) c.shieldNote -= dt;
  if (c.fieldNote > 0) c.fieldNote -= dt;
  if (c.shieldHit) {
    c.shieldHit.t += dt;
    if (c.shieldHit.t > 0.5) c.shieldHit = null;
  }
  const ph = phaseOf(c);
  c.phaseSeen ??= 1;
  if (ph > c.phaseSeen && !c.dead && !c.waiting) {
    c.phaseSeen = ph;
    phaseUp(c, ph);
  }
}

// Into a new phase: it roars, the ground jolts out from it (you're thrown
// back), its colour flares, and the fight quickens.
function phaseUp(c, ph) {
  const game = c.game;
  const r = game.renderer;
  const tint = bossTint(c);
  const R = (c.foot || 0) + 3;
  r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 6, r1: 90, color: [tint[0], '#ffffff'], life: 0.8, oy: 4, flat: 0.5, thick: 3 });
  r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 56, color: ['#ffffff', tint[0]], life: 0.55, oy: 4, flat: 0.5, thick: 2 });
  r.emit(c.x, c.y + 1.4, c.z, { n: 40, color: [tint[0], tint[1] || '#ffffff', '#ffffff'], up: 50, speed: 110, life: 0.8, glow: true, gravity: 40 });
  r.flashScreen?.(ph >= 3 ? '#ff2010' : '#ffb060', ph >= 3 ? 0.3 : 0.2);
  game.shake = Math.min(1.6, (game.shake || 0) + (ph >= 3 ? 1.1 : 0.8));
  game.hitStop = Math.max(game.hitStop || 0, 0.12);
  game.audio?.play('roar', c);
  game.audio?.play('boom', c);
  r.floatText(c.x, c.y + 3.6, c.z, ph >= 3 ? 'DESPERATE!' : 'ENRAGED!', ph >= 3 ? '#ff4030' : '#ffb040');
  const line = (PHASE_LINES[c.species] || [])[ph];
  if (line) c.say?.(line, 2.6, '#ff9080');
  // (Anyone close by is thrown back from it.)
  for (const e of [game.player, ...game.npcs]) {
    if (!e || e.dead || apart(c, e) > R - (c.foot || 0) || Math.abs(e.y - c.y) > 1) continue;
    knock(game, c, e, 2);
  }
  c.windup = null;
  c.stunT = 0;
  c.gapT = 1.1;
  c.stillT = 0;
  c.phaseT = 2;
  if (game.dungeon && game.dungeon.fight) game.dungeon.fight.phaseT = 0;
}

// After its own way of fighting has had its turn: if it's been stood
// about too long, off to somewhere new to fight from (and on its way
// there till it gets there). True if it's moving.
export function drift(c, dt) {
  const t = c.target;
  if (!t || t.dead || busy(c)) {
    c.stillT = 0;
    return false;
  }
  if (c.x !== c.lastX || c.z !== c.lastZ) {
    c.lastX = c.x;
    c.lastZ = c.z;
    c.stillT = 0;
  } else c.stillT = (c.stillT || 0) + dt;
  if (!c.repo && c.stillT < STILL * (c.phaseSeen >= 3 ? 0.7 : 1)) return false;
  if (!c.repo) {
    const goal = pickSpot(c, t);
    if (!goal) {
      c.stillT = 0;
      return false;
    }
    c.repo = { goal, t: 0, path: null, i: 0 };
  }
  const R = c.repo;
  R.t += dt;
  if (R.t > 4 || (c.x === R.goal.x && c.z === R.goal.z)) {
    c.repo = null;
    c.stillT = 0;
    return false;
  }
  if (!R.path) {
    const box = c.leash ? { x0: c.leash.x0, z0: c.leash.z0, x1: c.leash.x1, z1: c.leash.z1 } : null;
    const clear = c.foot ? (x, y, z) => fits(c.game, c, x, y, z, true) : null;
    // (The Overseer, with no way round a wall of force, goes through it:
    // see fields.js.)
    const soft = walksFields(c) ? fieldWay(c.game) : null;
    R.path = soft ? findPath(c.game.world, c.x, c.y, c.z, R.goal.x, R.goal.y, R.goal.z, { maxNodes: 500, clear, box }) : null;
    if (soft && !(R.path && R.path.length)) R.path = findPath(c.game.world, c.x, c.y, c.z, R.goal.x, R.goal.y, R.goal.z, { maxNodes: 500, partial: true, clear: c.foot ? (x, y, z) => fits(c.game, c, x, y, z, true, soft) : null, through: soft, box });
    if (!(R.path && R.path.length)) R.path = findPath(c.game.world, c.x, c.y, c.z, R.goal.x, R.goal.y, R.goal.z, { maxNodes: 500, partial: true, clear, box });
    R.i = 0;
    if (!R.path || !R.path.length) {
      c.repo = null;
      c.stillT = 0;
      return false;
    }
  }
  const [nx, , nz] = R.path[R.i];
  if (walksFields(c)) lowerFields(c, nx, nz);
  if (c.tryStep(nx, nz, c.stepTime())) {
    R.i++;
    if (R.i >= R.path.length) c.repo = null;
    c.stillT = 0;
    return true;
  }
  // (Something in the way: somewhere else, then.)
  c.repo = null;
  return false;
}

// Somewhere to fight from: round you from where it stands now (never
// straight through you), at the range it likes, in its hall, where all of
// it fits.
function pickSpot(c, t) {
  const game = c.game;
  const want = RANGE[c.species] ?? 1;
  const rad = want + (c.foot || 0) + (want > 1 ? 0 : 1);
  const now = Math.atan2(c.z - t.z, c.x - t.x);
  const side = c.sideTurn || (c.sideTurn = Math.random() < 0.5 ? 1 : -1);
  if (Math.random() < 0.25) c.sideTurn = -side;
  let best = null;
  let bestS = -Infinity;
  for (let k = 0; k < 14; k++) {
    const a = now + side * (0.5 + k * 0.22) * (k % 2 ? -1 : 1) * (k % 2 ? 0.6 : 1);
    const rr = rad + (Math.random() - 0.5) * 1.5;
    const x = Math.round(t.x + Math.cos(a) * rr);
    const z = Math.round(t.z + Math.sin(a) * rr);
    if (c.leash && (x < c.leash.x0 || x > c.leash.x1 || z < c.leash.z0 || z > c.leash.z1)) continue;
    const y = game.world.findStandY(x, z, c.y);
    if (y !== c.y || !game.world.canStand(x, y, z) || game.occupiedBySolid(x, y, z, c)) continue;
    if (c.foot && !fits(game, c, x, y, z)) continue;
    const moved = Math.max(Math.abs(x - c.x), Math.abs(z - c.z));
    if (moved < 2) continue;
    const s = -Math.abs(moved - 4) - Math.abs(Math.max(Math.abs(x - t.x), Math.abs(z - t.z)) - rad) * 0.5 + Math.random();
    if (s > bestS) {
      bestS = s;
      best = { x, y, z };
    }
  }
  if (best) return best;
  // (Nowhere it'd like, near you, that all of it fits: it shifts about
  // where it is, rather than stand there.)
  for (let k = 0; k < 16; k++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 2 + Math.random() * 2.5;
    const x = Math.round(c.x + Math.cos(a) * rr);
    const z = Math.round(c.z + Math.sin(a) * rr);
    if (c.leash && (x < c.leash.x0 || x > c.leash.x1 || z < c.leash.z0 || z > c.leash.z1)) continue;
    const y = game.world.findStandY(x, z, c.y);
    if (y !== c.y || !game.world.canStand(x, y, z) || game.occupiedBySolid(x, y, z, c)) continue;
    if (c.foot && !fits(game, c, x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

// The music's step up for the fight as it stands (1 to 3).
export function fightPhase(fight) {
  if (!fight) return 1;
  return fight.frac <= MARKS[1] ? 3 : fight.frac <= MARKS[0] ? 2 : 1;
}
