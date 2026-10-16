// (Round 96) What the mine's architect set down (see world/deeps/mine.js),
// at work:
//   firedamp: the gas pooled in dead ends and trailed by its drifting
//     kind. Harmless to breathe, but any open flame lights it: a fire, a
//     blast, a blast beetle going up, a lost miner's lamp, a torch in your
//     hand (a lantern's a safety lamp, and only burns tall and blue in it).
//     Lit, the whole connected pocket goes up, a flame running through it
//     from where it was lit.
//   cracked props: a blast near one, a great blow on the floor by it, or
//     an axe taken to it, and the roof comes down round it.
//   the sump pump: worked, it drains the flooded sump (and what's in the
//     water comes up out of it).
//   the cart run: pushed, the cart runs down the rails, through the points
//     as they're thrown, hitting whatever's on the line; sent straight, it
//     smashes the fall that chokes the old drift. Sent down the spur, it
//     has to be hauled back.
//   the shaft bell: rung, every lost miner on the floor comes to it (rung
//     by one of them when it sees you, as much as by you).
//   the crawler's eggs: come near, and they hatch.
//   the shift at the face: still swinging their picks, till you come near.
//   the knockers: the miners' friends; they knock where the rock is hollow
//     and where the roof's bad, and anyone who hurts one has the roof come
//     down on them.
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addHazard, areaTiles, BLAST_HOOKS } from '../entities/monsters.js';
import { findPath } from '../entities/pathfind.js';
import { STYLES, knock } from './combat.js';

const key = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const stateOf = (run) => {
  const D = (run.state.deeps ||= { turned: {}, opened: {}, taken: {}, woke: {} });
  return (D.mine ||= { drained: {}, carts: {}, warned: false });
};
const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// A naked flame in someone's hands: a torch (not a lantern: that's a
// safety lamp, its flame behind glass).
export function nakedFlame(e) {
  if (!e || e.kind !== 'player' || e.snuffT > 0 || e.submerged) return false;
  const keys = [e.heldItem?.(), e.equip && e.equip.shield];
  return keys.some((k) => k === 'torch' || k === 'campfire');
}

// ------------------------------------------------------------- firedamp
// Is there firedamp at (x, y, z)?
export const gasAt = (game, x, y, z) => game.world.getBlock(x, y, z) === B.firedamp;
// Firedamp at the spot or right by it (`r`).
export function gasNear(game, x, y, z, r = 1) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (gasAt(game, x + dx, y, z + dz)) return { x: x + dx, z: z + dz };
  return null;
}

// Light the firedamp at (x, y, z): the whole pocket joined to it goes up,
// the flame running out through it from there, a pace every little while.
// True if there was any to light.
export function igniteGas(game, x, y, z, delay = 0.3, by = null) {
  if (!gasAt(game, x, y, z)) return false;
  const lit = (game.litGas ||= new Set());
  const k0 = `${x},${y},${z}`;
  if (lit.has(k0)) return false;
  const front = [[x, z, 0]];
  lit.add(k0);
  const cells = [];
  while (front.length && cells.length < 80) {
    const [cx, cz, d] = front.shift();
    cells.push({ x: cx, z: cz, d });
    for (const [ox, oz] of N8) {
      const nx = cx + ox;
      const nz = cz + oz;
      const k = `${nx},${y},${nz}`;
      if (lit.has(k) || !gasAt(game, nx, y, nz)) continue;
      lit.add(k);
      front.push([nx, nz, d + 1]);
    }
  }
  game.renderer.floatText(x, y + 2, z, 'FIREDAMP!', '#ffb050');
  game.audio?.play('whoosh', { x, z });
  for (const c of cells) {
    // (A lick of blue flame ahead of it, where it's going.)
    game.renderer.emit(c.x, y + 0.8, c.z, { n: 3, color: ['#80c0ff', '#c0e0ff', '#ffffff'], up: 14, speed: 20, life: 0.3 + c.d * 0.08, glow: true });
    addHazard(game, {
      tiles: areaTiles(c.x, c.z, 1), y, dur: delay + c.d * 0.09, dmg: 6, burn: 2, knock: 1, from: { x: c.x, z: c.z + 0.001 }, center: { x: c.x, z: c.z }, kind: 'blast', color: [255, 150, 60], trap: true, gas: true, by: null,
      onFire: (g) => {
        lit.delete(`${c.x},${y},${c.z}`);
        if (gasAt(g, c.x, y, c.z)) g.world.setBlock(c.x, y, c.z, B.air);
        g.renderer.effect?.({ type: 'blast', wx: c.x, wy: y, wz: c.z, r1: 22, life: 0.5, oy: 0 });
        g.renderer.emit(c.x, y + 1, c.z, { n: 10, color: ['#ff9030', '#ffe070', '#80c0ff', '#ffffff'], up: 40, speed: 50, life: 0.5, glow: true });
        if (c.d === 0) {
          g.audio?.play('boom', c);
          g.shake = Math.min(1.6, (g.shake || 0) + 0.5 + Math.min(0.8, cells.length * 0.05));
        }
        g.lightDirty = true;
      },
    });
  }
  return true;
}

// Firedamp left in the air (by its drifting kind, or one of them burst):
// on bare floor only.
export function leaveGas(game, x, y, z) {
  const w = game.world;
  if (w.getBlock(x, y, z) !== B.air) return false;
  const below = BLOCKS[w.getBlock(x, y - 1, z)];
  if (!below || !below.solid) return false;
  w.setBlock(x, y, z, B.firedamp);
  return true;
}

// -------------------------------------------------------------- the props
// A cracked prop giving way: it creaks, dust comes down, and then the roof
// round it; the prop's place left heaped with fall.
export function propFall(game, x, y, z, delay = 0.9, gone = false) {
  const falling = (game.fallingProps ||= new Set());
  const k = `${x},${y},${z}`;
  if (falling.has(k)) return false;
  if (!gone && game.world.getBlock(x, y, z) !== B.cracked_prop) return false;
  falling.add(k);
  game.audio?.play('creak', { x, z });
  game.renderer.floatText(x, y + 2.4, z, 'the prop cracks!', '#e0c080');
  for (let i = 0; i < 6; i++) game.renderer.emit(x + (Math.random() - 0.5) * 2, y + 2.6, z + (Math.random() - 0.5) * 2, { n: 2, color: ['#8a7a60', '#5a4a38'], up: -10, speed: 6, gravity: 200, life: 0.6 });
  addHazard(game, {
    tiles: areaTiles(x, z, 1), y, dur: delay, dmg: 7, stun: 0.8, kind: 'rocks', trap: true, center: { x, z },
    onFire: (g) => {
      falling.delete(k);
      const w = g.world;
      const id = w.getBlock(x, y, z);
      if ((id === B.cracked_prop || id === B.air) && !g.entityAt(x, y, z)) w.setBlock(x, y, z, B.mine_fall);
      g.renderer.emit(x, y + 1, z, { n: 24, color: ['#6a5a48', '#8a7a60', '#3a3028'], up: 30, speed: 50, life: 1, shape: 'puff', grow: 2 });
      g.audio?.play('rumble', { x, z });
      g.shake = Math.min(1.5, (g.shake || 0) + 0.7);
    },
  });
  return true;
}

// A blast, a fire or a great blow on the floor: firedamp in it lit, props
// by it giving way, eggs in it burst, the drifting firedamp caught in it
// going up (see BLAST_HOOKS in entities/monsters.js).
const FLAME = new Set(['fire', 'burst', 'blast']);
const SHAKE = new Set(['burst', 'blast', 'slam', 'erupt']);
export function onBlast(game, h) {
  if (!h.tiles || !h.tiles.length) return;
  const y = h.y ?? FY;
  const w = game.world;
  if (FLAME.has(h.kind)) {
    for (const t of h.tiles) {
      if (gasAt(game, t.x, y, t.z)) igniteGas(game, t.x, y, t.z, 0.12);
      if (w.getBlock(t.x, y, t.z) === B.egg_sac) burstEgg(game, t.x, y, t.z);
    }
    for (const c of game.creatures) {
      if (c.dead || c.species !== 'firedamp' || c.flaring || Math.abs(c.y - y) > 1) continue;
      if (h.tiles.some((t) => t.x === c.x && t.z === c.z)) flare(game, c, 0.15);
    }
  }
  if (SHAKE.has(h.kind)) {
    const seen = new Set();
    for (const t of h.tiles) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = t.x + dx;
        const z = t.z + dz;
        const k = key(x, z);
        if (seen.has(k)) continue;
        seen.add(k);
        if (w.getBlock(x, y, z) === B.cracked_prop) propFall(game, x, y, z, h.kind === 'slam' ? 1.1 : 0.7);
      }
    }
  }
}
BLAST_HOOKS.push(onBlast);

// ------------------------------------------------------- firedamp, drifting
// One of the drifting firedamp, flaring: it goes up where it hangs, and
// lights whatever gas is round it.
export function flare(game, c, delay = 0.5) {
  if (c.flaring || c.dead) return;
  c.flaring = true;
  c.stunT = delay + 0.3;
  game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it flares!', '#ffb050');
  game.audio?.play('fuse', c);
  addHazard(game, {
    tiles: areaTiles(c.x, c.z, 1), y: c.y, dur: delay, dmg: Math.round(7 * (c.dmgMult || 1)), burn: 2, knock: 1, from: { x: c.x, z: c.z + 0.001 }, center: { x: c.x, z: c.z }, kind: 'blast', color: [255, 150, 60], trap: true, keep: true,
    onFire: (g) => {
      g.renderer.effect?.({ type: 'blast', wx: c.x, wy: c.y, wz: c.z, r1: 30, life: 0.6, oy: 0 });
      g.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: ['#ff9030', '#ffe070', '#80c0ff'], up: 50, speed: 70, life: 0.6, glow: true });
      g.audio?.play('boom', c);
      g.shake = Math.min(1.5, (g.shake || 0) + 0.6);
      c.burnt = true;
      if (!c.dead) g.kill(c, null);
    },
  });
}

// --------------------------------------------------------------- the eggs
function burstEgg(game, x, y, z) {
  game.world.setBlock(x, y, z, B.air);
  game.renderer.emit(x, y + 0.6, z, { n: 14, color: ['#c8d080', '#8a9a40', '#e8e8b0'], up: 30, speed: 40, gravity: 160, life: 0.6 });
  game.audio?.play('splash', { x, z });
}
function hatch(run, e) {
  const game = run.game;
  game.world.setBlock(e.x, FY, e.z, B.air);
  game.renderer.emit(e.x, FY + 0.6, e.z, { n: 16, color: ['#c8d080', '#8a9a40', '#e8e8b0'], up: 30, speed: 40, gravity: 160, life: 0.7 });
  game.renderer.floatText(e.x, FY + 2, e.z, 'it hatches!', '#c8d080');
  game.audio?.play('skitter', e);
  const c = run.spawn('crawler', e.x, FY, e.z);
  if (c) {
    c.maxHp = c.hp = Math.max(4, Math.round(c.maxHp * 0.45));
    c.dmgMult *= 0.6;
    c.hatchling = true;
  }
}

// --------------------------------------------------------------- restore
// (Its blocks are kept with the floor; only what's going on is ours.)
export function restore(run) {
  run.mineT = { hatching: new Map(), pump: null, cart: null, warned: new Set() };
  stateOf(run);
}

// ------------------------------------------------------------- clicked
export function interact(run, x, y, z, b) {
  switch (b.interact) {
    case 'pump':
      pump(run, x, z);
      return true;
    case 'cart':
      pushCart(run, x, z);
      return true;
    case 'rail_switch': {
      const game = run.game;
      const on = !game.world.getState(x, y, z);
      game.world.setState(x, y, z, on);
      game.audio?.play('lever', { x, z });
      game.renderer.floatText(x, y + 1.8, z, on ? 'points: over' : 'points: back', '#e0d0a0');
      return true;
    }
    case 'shaft_bell':
      ringBell(run, { x, z }, run.game.player);
      return true;
  }
  return false;
}

// What's written on something of the mine's with nothing set down for it.
export const MINE_SAY = {
  miner_bunk: 'A straw tick, flattened to the shape of whoever slept in it. A boot under it, one only.',
  tally_board: 'Brass tags on nails, green with the damp. Nobody\'s come to take them back.',
  headframe: 'The wheel at the top of it hasn\'t turned in years. The rope still runs down into the dark.',
  survey_table: 'Rolled plans gone to pulp in the damp, and a broken rule.',
  lamp_tin: 'A miner\'s lamp-tin, its glass cracked, its wick long burned down.',
};

// ------------------------------------------------------------- the pump
function pump(run, x, z) {
  const game = run.game;
  const p = (run.data.pumps || []).find((q) => q.x === x && q.z === z);
  const S = stateOf(run);
  const T = (run.mineT ||= { hatching: new Map(), warned: new Set() });
  if (!p || S.drained[key(x, z)]) {
    game.ui.msg('The handle swings loose. The sump\'s as dry as it\'ll get.', '#c8c8b8');
    return;
  }
  if (T.pump) return;
  T.pump = { p, t: 0, i: 0, woke: false };
  game.audio?.play('clank', { x, z });
  game.ui.msg('You throw your weight on the pump handle. It groans, and the water in the sump begins to drop.', '#a8c8e0', true);
}
function pumpTick(run, dt) {
  const T = run.mineT;
  const P = T && T.pump;
  if (!P) return;
  const game = run.game;
  P.t += dt;
  if (Math.random() < dt * 4) game.audio?.play('drain', P.p);
  // (A tile of it gone every little while, from the edges in.)
  while (P.t > 0.25 * (P.i + 1) && P.i < P.p.water.length) {
    const q = P.p.water[P.i++];
    if (game.world.isWaterAt?.(q.x, q.y, q.z) || BLOCKS[game.world.getBlock(q.x, q.y, q.z)]?.liquid) game.world.setBlock(q.x, q.y, q.z, B.air);
    game.renderer.emit(q.x, q.y + 0.6, q.z, { n: 3, color: ['#4a7aa0', '#8ab8d8'], up: 10, speed: 10, life: 0.4 });
  }
  if (!P.woke && P.t > 1.2) {
    P.woke = true;
    run.wakeGroup(P.p.group);
    game.ui.msg('Something in the sinking water stirs.', '#a8c8e0');
  }
  if (P.i >= P.p.water.length && P.t > 1.4) {
    stateOf(run).drained[key(P.p.x, P.p.z)] = true;
    T.pump = null;
    game.ui.msg('The sump\'s drained. Something glints in the mud at the bottom.', '#a8c8e0');
  }
}

// ------------------------------------------------------------- the cart
// Pushed: down the rails toward the choke (through the points as thrown,
// or off down the spur), a pace at a time, quicker as it goes.
function pushCart(run, x, z) {
  const game = run.game;
  const T = run.mineT;
  if (T.cart) return;
  const S = stateOf(run);
  const runs = run.data.cartRuns || [];
  for (let i = 0; i < runs.length; i++) {
    const cr = runs[i];
    const at = S.carts[i] || { x: cr.cart.x, z: cr.cart.z, done: false, spur: false };
    if (at.x !== x || at.z !== z) continue;
    if (at.done) {
      game.ui.msg('The cart\'s done its work. It isn\'t going anywhere now.', '#c8c8b8');
      return;
    }
    // (Down the spur: hauled back up to where it started.)
    if (at.spur) {
      moveCart(game, at, cr.cart);
      S.carts[i] = { x: cr.cart.x, z: cr.cart.z, done: false, spur: false };
      game.audio?.play('clank', cr.cart);
      game.ui.msg('You haul the cart back up the line to where it started.', '#c8c8b8');
      return;
    }
    const dx = Math.sign(cr.choke.x - cr.cart.x);
    const dz = Math.sign(cr.choke.z - cr.cart.z);
    T.cart = { i, cr, at: { x, z }, dx, dz, t: 0, v: 2, spur: false, hit: new Set() };
    game.audio?.play('clank', { x, z });
    game.ui.msg('You put your shoulder to the cart. It creaks, and rolls.', '#e0d0a0');
    return;
  }
}
function moveCart(game, from, to) {
  const w = game.world;
  if (w.getBlock(from.x, FY, from.z) === B.runaway_cart) w.setBlock(from.x, FY, from.z, B.mine_rail);
  w.setBlock(to.x, FY, to.z, B.runaway_cart);
}
function cartTick(run, dt) {
  const T = run.mineT;
  const C = T && T.cart;
  if (!C) return;
  const game = run.game;
  const w = game.world;
  C.t += dt;
  C.v = Math.min(9, C.v + dt * 6);
  if (Math.random() < dt * 10) game.renderer.emit(C.at.x, FY + 0.2, C.at.z, { n: 1, color: ['#ffe070', '#ffffff'], up: 10, speed: 30, life: 0.2, glow: true });
  if (C.t < 1 / C.v) return;
  C.t = 0;
  game.audio?.play('clank', C.at);
  const cr = C.cr;
  // (At the points: thrown wrong, off down the spur.)
  if (!C.spur && cr.junction && C.at.x === cr.junction.x && C.at.z === cr.junction.z && cr.switch) {
    const st = w.getState(cr.switch.x, FY, cr.switch.z) ? 1 : 0;
    if (st !== cr.want) {
      C.spur = true;
      C.dx = cr.spur.x;
      C.dz = cr.spur.z;
    }
  }
  const nx = C.at.x + C.dx;
  const nz = C.at.z + C.dz;
  const S = stateOf(run);
  // The fall that chokes the drift, smashed.
  if (!C.spur && w.getBlock(nx, FY, nz) === B.cart_choke) {
    for (const y of [FY, FY + 1]) if (w.getBlock(nx, y, nz) === B.cart_choke) w.setBlock(nx, y, nz, B.air);
    game.renderer.emit(nx, FY + 1, nz, { n: 40, color: ['#6a5a48', '#8a7a60', '#3a3028', '#68441f'], up: 50, speed: 70, gravity: 120, life: 1.1 });
    game.renderer.emit(nx, FY + 1, nz, { n: 12, color: ['#5a5048', '#8a8070'], up: 20, speed: 20, life: 1.4, shape: 'puff', grow: 2 });
    game.audio?.play('crash', { x: nx, z: nz });
    game.audio?.play('rumble', { x: nx, z: nz });
    game.shake = Math.min(1.5, (game.shake || 0) + 0.9);
    game.ui.msg('The cart slams into the fall and bursts it open. Beyond: the old drift.', '#e0d0a0', true);
    game.lightDirty = true;
    S.carts[C.i] = { x: C.at.x, z: C.at.z, done: true };
    T.cart = null;
    return;
  }
  // Off the end of the spur (or anything else in its way): it stops.
  if (w.getBlock(nx, FY, nz) !== B.mine_rail) {
    S.carts[C.i] = { x: C.at.x, z: C.at.z, done: false, spur: C.spur };
    if (C.spur) game.ui.msg('The cart clatters off down the spur and stops dead against the buffer. Wrong way.', '#c8b0a0', true);
    else game.renderer.floatText(C.at.x, FY + 1.6, C.at.z, 'it stops', '#c8c8b8');
    game.audio?.play('thud', C.at);
    T.cart = null;
    return;
  }
  // Whoever's on the line: hit, and thrown aside.
  const e = [...game.everyone(), ...game.creatures].find((q) => q && !q.dead && q.x === nx && q.z === nz && Math.abs(q.y - FY) <= 1);
  if (e && !C.hit.has(e)) {
    C.hit.add(e);
    game.damage(e, Math.round(4 + C.v), null);
    game.renderer.floatText(nx, FY + 2, nz, 'CRUNCH', '#ff9070');
    game.audio?.play('crash', e);
    knock(game, { x: nx - C.dz, z: nz + C.dx }, e, 1);
  }
  if (game.occupiedBySolid?.(nx, FY, nz, null)) {
    S.carts[C.i] = { x: C.at.x, z: C.at.z, done: false, spur: C.spur };
    T.cart = null;
    return;
  }
  moveCart(game, C.at, { x: nx, z: nz });
  C.at = { x: nx, z: nz };
}

// ------------------------------------------------------------- the bell
// Rung (by you, or one of the lost miners): every lost miner on the floor
// up and coming to it.
export function ringBell(run, bell, by = null) {
  const game = run.game;
  const T = run.mineT;
  if (T && T.bellT > 0) return false;
  if (T) T.bellT = 3;
  game.audio?.play('ship_bell', bell);
  game.audio?.play('bell', bell);
  game.renderer.effect?.({ type: 'ring', wx: bell.x, wy: FY + 1, wz: bell.z, r0: 4, r1: 60, color: ['#ffe8a0', '#c8a040'], life: 0.8, oy: -10, flat: 0.5, thick: 2 });
  game.renderer.floatText(bell.x, FY + 2.8, bell.z, 'CLANG', '#ffe8a0');
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'lost_miner' || c.waiting || c.isBoss || dist(c, bell) > 28) continue;
    if (c.dormant) run.wake(c);
    c.lure = { x: bell.x, z: bell.z };
    c.lurePath = null;
    n++;
  }
  if (by && by.kind === 'player') game.ui.msg(n ? 'The bell\'s clang goes down every drift. Below, lamps begin to move.' : 'The bell\'s clang goes down every drift, and nothing answers.', '#ffe8a0', true);
  else if (by) game.ui.msg('Somewhere a bell is ringing: one of them, ringing for the shift.', '#ffb070', true);
  return true;
}
// The nearest bell to `c` within `r` (or null).
export function bellNear(run, c, r) {
  let best = null;
  for (const b of run.data.bells || []) {
    const d = dist(b, c);
    if (d <= r && (!best || d < dist(best, c))) best = b;
  }
  return best;
}

// Walk `c` toward a spot, a pace at a time, by a path (true while it's
// still going).
export function walkTo(c, goal, near = 1) {
  if (dist(c, goal) <= near) return false;
  if (c.moving) return true;
  if (!c.lurePath || c.lureI >= c.lurePath.length || c.lureGoal !== key(goal.x, goal.z)) {
    // (Round 115: no way there, found a moment ago: not looked for again
    // every frame (a search of thousands of squares each time), but in a
    // little while, when something may have moved.)
    const frame = c.game.frameNo;
    if (frame !== undefined && c.lureNone === key(goal.x, goal.z) && frame < c.lureRetry) return false;
    c.lurePath = findPath(c.game.world, c.x, c.y, c.z, goal.x, FY, goal.z, { maxNodes: 2500, near, partial: true });
    c.lureI = 0;
    c.lureGoal = key(goal.x, goal.z);
    if (!c.lurePath || !c.lurePath.length) {
      c.lureNone = c.lureGoal;
      c.lureRetry = (frame ?? 0) + 20;
      return false;
    }
    c.lureNone = null;
  }
  const [nx, , nz] = c.lurePath[c.lureI];
  if (c.tryStep(nx, nz, c.S.step)) c.lureI++;
  else c.lurePath = null;
  return true;
}

// ------------------------------------------------------------- each frame
export function tick(run, dt, party) {
  const game = run.game;
  const data = run.data;
  if (!run.mineT) restore(run);
  const T = run.mineT;
  if (T.bellT > 0) T.bellT -= dt;
  pumpTick(run, dt);
  cartTick(run, dt);
  // A torch carried into firedamp lights it (a warning first, from the
  // smell of it); a lantern only burns tall and blue in it.
  for (const p of party) {
    if (p.dead) continue;
    const near3 = gasNear(game, p.x, p.y, p.z, 3);
    if (!near3) continue;
    const kind = nakedFlame(p) ? 'fire' : null;
    const pk = p.id ?? p.name ?? 'p';
    if (!T.warned.has(pk)) {
      T.warned.add(pk);
      game.asPlayer?.(p, () => game.ui.msg(kind === 'fire' ? 'The air smells sweet and wrong. Firedamp, and you\'re carrying a naked flame into it. (A lantern won\'t light it.)' : 'The air smells sweet and wrong: firedamp. Keep flame away from it.', '#ffb050', true));
    }
    const here = gasNear(game, p.x, p.y, p.z, 1);
    if (!here) continue;
    if (nakedFlame(p)) igniteGas(game, here.x, p.y, here.z, 0.35, p);
    else if (p.equip && p.equip.shield === 'lantern' && Math.random() < dt * 6) game.renderer.emit(p.x, p.y + 1.4, p.z, { n: 1, color: ['#80c0ff', '#c0e0ff'], up: 20, speed: 4, life: 0.4, glow: true });
  }
  // Fire on the floor where the firedamp is.
  if (game.fireTiles && game.fireTiles.size) {
    for (const zn of game.fireTiles.values()) {
      if (zn.done) continue;
      const t = zn.tiles[0];
      const g = gasNear(game, t.x, zn.y, t.z, 1);
      if (g) igniteGas(game, g.x, zn.y, g.z, 0.2);
    }
  }
  // The crawler's eggs: come near, and they hatch.
  for (const e of data.eggs || []) {
    const k = key(e.x, e.z);
    if (T.hatching.has(k)) continue;
    if (game.world.getBlock(e.x, FY, e.z) !== B.egg_sac) continue;
    if (party.some((p) => !p.dead && dist(p, e) <= 2)) {
      T.hatching.set(k, { e, t: 1.4 + Math.random() * 0.8 });
      game.audio?.play('skitter', e);
    }
  }
  for (const [k, h] of T.hatching) {
    h.t -= dt;
    if (Math.random() < dt * 8) game.renderer.emit(h.e.x, FY + 0.6, h.e.z, { n: 1, color: ['#c8d080', '#e8e8b0'], up: 10, speed: 14, life: 0.3 });
    if (h.t > 0) continue;
    T.hatching.delete(k);
    if (game.world.getBlock(h.e.x, FY, h.e.z) === B.egg_sac) hatch(run, h.e);
  }
  // The shift at the face, still at it (you hear them before you see
  // them); and the knockers.
  for (const c of run.creatures()) {
    if (c.dead) continue;
    if (c.species === 'lost_miner' && c.dormant && c.role === 'work') {
      c.workT = (c.workT ?? Math.random()) - dt;
      if (c.workT <= 0) {
        c.workT = 1.1 + Math.random() * 0.4;
        c.strike = { t: 0, dur: 0.5, st: STYLES.axe };
        if (party.some((p) => dist(p, c) <= 14)) {
          game.audio?.play('pick_tick', c);
          game.renderer.emit(c.x + (c.dir === 3 ? 1 : c.dir === 1 ? -1 : 0), c.y + 1, c.z + (c.dir === 0 ? 1 : c.dir === 2 ? -1 : 0), { n: 3, color: ['#8a7a60', '#d8c090'], up: 20, speed: 30, life: 0.3 });
        }
      }
    }
    if (c.species === 'knocker') knocker(run, c, dt, party);
  }
}

// ------------------------------------------------------------- knockers
// Where the rock is hollow (the chalk cross), or the roof's bad (a cracked
// prop), or the air's wrong (firedamp): a knocker goes and knocks there,
// for whoever comes by.
function knockerGoal(run, c) {
  const w = run.game.world;
  const marks = [];
  for (const q of run.data.chalk || []) if (w.getBlock(q.x, FY, q.z) === B.chalk_mark) marks.push({ ...q, what: 'hollow' });
  for (const q of run.data.props || []) if (w.getBlock(q.x, FY, q.z) === B.cracked_prop) marks.push({ ...q, what: 'roof' });
  for (const q of run.data.gas || []) if (w.getBlock(q.x, FY, q.z) === B.firedamp) marks.push({ ...q, what: 'gas' });
  const rank = { hollow: 0, roof: 1, gas: 2 };
  marks.sort((a, b) => rank[a.what] - rank[b.what] || dist(a, c) - dist(b, c));
  return marks.find((m) => dist(m, c) <= 24) || null;
}
function knocker(run, c, dt, party) {
  const game = run.game;
  c.thinkT = 9;
  const p = party.filter((q) => !q.dead).sort((a, b) => dist(a, c) - dist(b, c))[0];
  if (!p || dist(p, c) > 12) return;
  if (!c.goal || (c.goalCheck = (c.goalCheck || 0) - dt) <= 0) {
    c.goalCheck = 2;
    const was = c.goal;
    c.goal = knockerGoal(run, c);
    // (The hollow it knocked at opened: pleased, and gone.)
    if (was && was.what === 'hollow' && (!c.goal || c.goal.what !== 'hollow') && game.world.getBlock(was.x, FY, was.z) !== B.chalk_mark) {
      game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 14, color: ['#e8d8a0', '#ffffff'], up: 30, speed: 20, life: 0.8, glow: true });
      game.ui.msg('The knocker claps its hands together, grinning, and is gone into the rock.', '#e8d8a0');
      c.dead = true;
      c.hp = 0;
      return;
    }
  }
  if (!c.goal) return;
  if (walkTo(c, c.goal, 1)) return;
  c.face(c.goal.x, c.goal.z);
  c.knockT = (c.knockT ?? 0.5) - dt;
  if (c.knockT > 0) return;
  c.knockT = 3.5 + Math.random() * 1.5;
  c.strike = { t: 0, dur: 0.35, st: STYLES.snap };
  game.audio?.play('knock', c.goal);
  if (dist(p, c) <= 8) game.renderer.floatText(c.goal.x, FY + 1.8, c.goal.z, 'knock, knock', '#d8c8a0');
  if (!run.mineT.toldKnock && dist(p, c) <= 6) {
    run.mineT.toldKnock = true;
    const say = { hollow: 'A little grey figure knocks on the rock, and puts its ear to it, and looks at you. It sounds hollow.', roof: 'A little grey figure knocks on the prop, and points up at the roof, and shakes its head.', gas: 'A little grey figure knocks on the rock by the bad air, and holds its nose.' };
    game.ui.msg(say[c.goal.what], '#d8c8a0', true);
  }
}

// Something of the mine's clicked that has nothing written on it.
export function sayOf(b) {
  return MINE_SAY[b.name] || null;
}

// A knocker hurt: the roof comes down on whoever did it, and it's gone.
export function knockerHurt(game, c, src) {
  if (!src || c.dead) return 0;
  const at = { x: src.x, z: src.z };
  addHazard(game, { tiles: areaTiles(at.x, at.z, 1), y: src.y, dur: 0.8, dmg: 8, stun: 1, kind: 'rocks', trap: true, center: at });
  for (let i = 0; i < 6; i++) game.renderer.emit(at.x + (Math.random() - 0.5) * 2, src.y + 2.6, at.z + (Math.random() - 0.5) * 2, { n: 2, color: ['#8a7a60', '#5a4a38'], up: -10, speed: 6, gravity: 200, life: 0.6 });
  game.audio?.play('creak', at);
  game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 12, color: ['#8a8070', '#5a5048'], up: 20, speed: 30, life: 0.6, shape: 'puff' });
  if (src.kind === 'player') game.ui.msg('The knocker\'s gone. Over your head, the rock groans.', '#e0a080', true);
  c.dead = true;
  c.hp = 0;
  return 0;
}

// A prop taken down with an axe: the roof comes in round it (see
// Game.breakBlock).
export function propBroken(game, x, y, z) {
  if (!runOf(game, x)) return;
  propFall(game, x, y, z, 0.9, true);
}

