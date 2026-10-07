// What the islands' masters do to their halls, and the little things they
// all need for it (see bosses_kharos.js, bosses_myrrow.js and
// bosses_grove.js):
//   works: blocks set down in the hall for a while (lava let in across the
//     floor, walls of glass, briars, a flood, coral grown up, the braziers
//     put out), each put back as it was in its time, or all of a master's
//     at once when it falls (see dungeon.js); dropped before a floor's
//     saved and set again after, like a Kavorent field;
//   and its hall's ground, the tiles of it free to stand on, rings and
//     lines and spirals across it, its braziers.
import { B, BLOCKS, META_STATE } from '../world/blocks.js';
import { FY } from '../world/dungeongen.js';
import { cue } from './cue.js';

export { FY };
// (Paces between them, edge to edge: a great master's three paces across
// count, as in footprint.apart.)
export const dist = (a, b) => Math.max(0, Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) - ((a && a.foot) || 0) - ((b && b.foot) || 0));
export const sees = (game, a, b) => !game.sim || !game.sim.lineOfSight || game.sim.lineOfSight(a.x, a.z, b.x, b.z, a.y + 1);
export const mult = (c) => c.dmgMult || 1;
export const dmgOf = (c, n) => Math.max(1, Math.round(n * mult(c)));

// ------------------------------------------------------------ works
// Liquids and the like a work may be laid over (and air).
const SOFT = new Set([B.air, B.water, B.lava]);

// Set `id` at (x, y, z) for `life` seconds (0: till the fight's done), by
// `by`. Only over air (or water, or lava, or another of its works), never
// on anyone if it's solid; `floor`: the floor block itself (y = FY - 1),
// whatever it is. True if it was set.
export function work(game, x, y, z, id, life = 0, by = null, opts = {}) {
  const w = game.world;
  if (!w.regionAt(x, z)) return false;
  const works = (game.works ||= []);
  const old = works.find((q) => q.x === x && q.y === y && q.z === z);
  const cur = w.getBlock(x, y, z);
  // (`dig`: through a wall, as a burrower does: any plain block.)
  if (!old && !opts.floor && !SOFT.has(cur) && !(opts.dig && BLOCKS[cur].solid && !BLOCKS[cur].interact && BLOCKS[cur].hardness !== Infinity && cur !== B.bedrock)) return false;
  if (opts.floor && (cur === B.air || BLOCKS[cur].interact)) return false;
  const solid = BLOCKS[id].solid;
  // (The floor itself changed under whoever's on it: that's no matter.)
  if (solid && !opts.floor && (game.entityAt?.(x, y, z) || (game.player && game.player.x === x && game.player.z === z && Math.abs(game.player.y - y) <= 1))) return false;
  if (solid && !opts.floor && game.creatures.some((c) => !c.dead && c.foot && Math.abs(c.x - x) <= c.foot && Math.abs(c.z - z) <= c.foot)) return false;
  if (old) {
    old.id = id;
    old.t = 0;
    old.life = life;
    old.by = by;
  } else works.push({ x, y, z, id, meta: opts.meta || 0, was: cur, wasMeta: w.getMeta(x, y, z), t: 0, life, by, keep: !!opts.keep });
  w.setBlock(x, y, z, id, opts.meta || 0);
  if (BLOCKS[id].light || BLOCKS[cur].light) game.lightDirty = true;
  return true;
}

// Put one back as it was (if it's still what was set: a briar you cut
// down stays cut).
function undo(game, q) {
  const w = game.world;
  const cur = w.getBlock(q.x, q.y, q.z);
  if (cur === q.id || (q.id !== B.air && cur === B.air && !BLOCKS[q.id].solid)) w.setBlock(q.x, q.y, q.z, q.was, q.wasMeta);
  if (BLOCKS[q.id].light || BLOCKS[q.was].light) game.lightDirty = true;
}

// Something a master sets going that plays out over time (a flood
// spreading, a ring closing in, a rain of embers): `fn(k)` every `every`
// seconds, `times` times (k = 0, 1, ...), stopped if it falls.
export function proc(game, by, every, times, fn, delay = 0) {
  (game.procs ||= []).push({ by, every, times, fn, k: 0, t: -delay });
}
function updateProcs(game, dt) {
  if (!game.procs || !game.procs.length) return;
  for (const q of game.procs) {
    if (q.by && q.by.dead) {
      q.done = true;
      continue;
    }
    q.t += dt;
    while (q.t >= 0 && !q.done) {
      q.fn(q.k);
      q.k++;
      q.t -= q.every;
      if (q.k >= q.times) q.done = true;
    }
  }
  game.procs = game.procs.filter((q) => !q.done);
}

// Each frame: works whose time is up, put back (and all of a fallen
// master's, unless they're meant to stay).
export function updateWorks(game, dt) {
  updateProcs(game, dt);
  if (!game.works || !game.works.length) return;
  for (const q of game.works) {
    q.t += dt;
    if ((q.life && q.t >= q.life) || (q.by && q.by.dead && !q.keep)) {
      undo(game, q);
      q.done = true;
    }
  }
  game.works = game.works.filter((q) => !q.done);
}

// All of them (or all of one master's) put back now.
// (`only(q)`: just those it says, and their procs: one old place's, with
// others open. See DungeonRun.clearFloor.)
export function clearWorks(game, by = null, only = null) {
  if (only) game.procs = (game.procs || []).filter((q) => !(q.by && only({ x: q.by.x, by: q.by })));
  else if (!by) game.procs = [];
  if (!game.works) return;
  for (const q of game.works) {
    if (by && q.by !== by) continue;
    if (only && !only(q)) continue;
    undo(game, q);
    q.done = true;
  }
  game.works = game.works.filter((q) => !q.done);
}

// Before a floor's saved: every work put back (and kept, to set again
// after: see raiseWorks).
export function dropWorks(game) {
  for (const q of game.works || []) game.world.setBlock(q.x, q.y, q.z, q.was, q.wasMeta);
}
export function raiseWorks(game) {
  for (const q of game.works || []) game.world.setBlock(q.x, q.y, q.z, q.id, q.meta || 0);
}

// ------------------------------------------------------------ its hall
// The bounds it's held to (its hall), or round it.
export function hallOf(c) {
  return c.leash || { x0: c.x - 8, z0: c.z - 6, x1: c.x + 8, z1: c.z + 6 };
}
export function inHall(c, q) {
  const L = hallOf(c);
  return q.x >= L.x0 && q.x <= L.x1 && q.z >= L.z0 && q.z <= L.z1;
}

// Floor of its hall you could stand on (air at FY and FY + 1, floor
// under), or that's under its liquid.
export function openFloor(game, x, z, wet = false) {
  const w = game.world;
  const a = w.getBlock(x, FY, z);
  const b = w.getBlock(x, FY + 1, z);
  const under = w.getBlock(x, FY - 1, z);
  if (!BLOCKS[under].solid) return false;
  if (BLOCKS[b].solid) return false;
  return a === B.air || (wet && (a === B.water || a === B.lava));
}

// Every free tile of its hall.
export function hallTiles(c, wet = false) {
  const L = hallOf(c);
  const out = [];
  for (let z = L.z0; z <= L.z1; z++) for (let x = L.x0; x <= L.x1; x++) if (openFloor(c.game, x, z, wet)) out.push({ x, z });
  return out;
}

// A ring of tiles `r` paces out from a spot (square: what a pace is here).
export function ringTiles(cx, cz, r) {
  if (r <= 0) return [{ x: cx, z: cz }];
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r) out.push({ x: cx + dx, z: cz + dz });
  return out;
}

// A round ring (a circle drawn on the floor), `r` out, `w` thick.
export function circleTiles(cx, cz, r, w = 0.8) {
  const out = [];
  const R = Math.ceil(r + w);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dz);
    if (Math.abs(d - r) <= w / 2 + 0.25) out.push({ x: cx + dx, z: cz + dz });
  }
  return out;
}

// The tiles of a cone toward `t` (`len` long, `spread` radians either
// side), from `c`.
export function coneTiles(c, t, len, spread) {
  const ang = Math.atan2(t.z - c.z, t.x - c.x);
  const out = [];
  const seen = new Set();
  for (let dz = -len; dz <= len; dz++) for (let dx = -len; dx <= len; dx++) {
    const d = Math.hypot(dx, dz);
    if (d < 1 || d > len) continue;
    let a = Math.atan2(dz, dx) - ang;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) > spread) continue;
    const k = `${c.x + dx},${c.z + dz}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ x: c.x + dx, z: c.z + dz });
  }
  return out;
}

// A wall of tiles across the hall: a row (or a column) through `at`,
// `len` long, its middle left open if `gap`.
export function wallTiles(at, across, len, gap = 0) {
  const out = [];
  const h = Math.floor(len / 2);
  for (let k = -h; k <= h; k++) {
    if (gap && Math.abs(k) < gap) continue;
    out.push(across ? { x: at.x + k, z: at.z } : { x: at.x, z: at.z + k });
  }
  return out;
}

// The braziers (and lamps) of its hall, lit or not.
export function hallLights(c) {
  const L = hallOf(c);
  const w = c.game.world;
  const out = [];
  for (let z = L.z0 - 1; z <= L.z1 + 1; z++) {
    for (let x = L.x0 - 1; x <= L.x1 + 1; x++) {
      const id = w.getBlock(x, FY, z);
      if (id === B.brazier || id === B.ash_brazier || id === B.candles || id === B.crucible) out.push({ x, z, id, lit: w.getState(x, FY, z) || id === B.candles || id === B.crucible });
    }
  }
  return out;
}

// A brazier put out (or lit again).
export function setLit(game, q, on) {
  if (q.id !== B.brazier && q.id !== B.ash_brazier) return;
  const m = game.world.getMeta(q.x, FY, q.z);
  game.world.setMeta(q.x, FY, q.z, on ? m | META_STATE : m & ~META_STATE);
  game.lightDirty = true;
  q.lit = on;
}

// A free spot in the hall `lo`-`hi` paces from `near` (null if none).
export function spotIn(c, near, lo, hi, wet = false) {
  const game = c.game;
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = lo + Math.random() * (hi - lo);
    const x = Math.round(near.x + Math.cos(a) * r);
    const z = Math.round(near.z + Math.sin(a) * r);
    if (!inHall(c, { x, z }) || !openFloor(game, x, z, wet)) continue;
    if (game.entityAt?.(x, FY, z)) continue;
    return { x, y: FY, z };
  }
  return null;
}

// Gone from here and there again, in a puff of `color`.
export function blinkTo(c, to, color) {
  const game = c.game;
  cue(c, 'blink');
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color, up: 30, speed: 40, life: 0.6, glow: true });
  c.teleport(to.x, to.y, to.z);
  game.moveEntity(c, to.x, to.y, to.z);
  c.path = null;
  game.renderer.emit(to.x, to.y + 1, to.z, { n: 16, color, up: 30, speed: 40, life: 0.6, glow: true });
}

// A pace away from `t`, if it can (true if it moved).
export function backOff(c, t) {
  if (c.moving) return false;
  const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
  const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
  return c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
}

// A cooldown run down (true when it's ready). `first`: how long before the
// first time.
// (A far island's master: its works come round quicker, and the first of
// them sooner; see ISLE_BOSS_TEMPO.)
export function cd(c, key, dt, first) {
  const k = c.tempo || 1;
  c[key] = (c[key] ?? first / (k * k)) - dt * k;
  return c[key] <= 0;
}

// Its words (and a puff of its colour over its head).
export function shout(c, line, color, t = 2.2) {
  c.say?.(line, t, color);
}

// Pull `e` a pace (or `n`) toward `to`.
export function drag(game, e, to, n = 1) {
  if (!e || e.dead || e.moving || (e.kind === 'player' && e.rollT > 0)) return;
  let x = e.x;
  let z = e.z;
  let y = e.y;
  for (let i = 0; i < n; i++) {
    const dx = Math.sign(to.x - x);
    const dz = Math.sign(to.z - z);
    if (!dx && !dz) break;
    const sx = Math.abs(to.x - x) >= Math.abs(to.z - z) ? dx : 0;
    const sz = sx ? 0 : dz;
    const ny = game.world.stepTarget(x, y, z, x + sx, z + sz, false);
    if (ny < 0 || game.occupiedBySolid(x + sx, ny, z + sz, e)) break;
    x += sx;
    z += sz;
    y = ny;
  }
  if (x !== e.x || z !== e.z) e.startMove(x, y, z, 0.14 * n);
}
