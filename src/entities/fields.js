// The Overseer's way through a wall of force (one of its own, or the
// ruin's): it doesn't go round. Where its way runs into one it turns the
// field off (a thread of light from its eye, a flicker, and it's down), goes
// through, and a few seconds later, once nobody's stood in the gap, the
// field comes back up.
import { BLOCKS, B } from '../world/blocks.js';

// How long a field it's turned off stays down (seconds).
export const FIELD_OFF = 3.5;
// A wall of force just thrown up (its own, round you, or yours) it leaves
// be this long: they're for trapping you in, not for it to walk through.
export const FIELD_FRESH = 2.5;

// Part of a wall that's only just gone up?
function freshWall(game, x, y, z) {
  for (const b of game.bulwarks || []) {
    if ((b.life ?? 9) - b.t > FIELD_FRESH) continue;
    if (b.put.some((q) => q.x === x && q.z === z && (q.y === y || q.y === y + 1))) return true;
  }
  return false;
}

export function walksFields(c) {
  return !!c && c.species === 'overseer' && !c.dead;
}

// A tile it could stand in once the field there is off.
export function fieldSoft(game, x, y, z) {
  const w = game.world;
  const a = w.getBlock(x, y, z);
  const b = w.getBlock(x, y + 1, z);
  if (a !== B.kav_field && b !== B.kav_field) return false;
  if ((a !== B.kav_field && a !== B.air) || (b !== B.kav_field && b !== B.air)) return false;
  if (freshWall(game, x, y, z)) return false;
  return !!BLOCKS[w.getBlock(x, y - 1, z)].solid;
}

// For the pathfinder: through a field, and room for all of it there.
export function fieldWay(game) {
  return (x, y, z) => fieldSoft(game, x, y, z);
}

// Off, every field where all of it would stand at (x, z). True if any.
export function lowerFields(c, x, z) {
  const game = c.game;
  const w = game.world;
  const R = c.foot || 0;
  const off = [];
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      for (const y of [c.y, c.y + 1]) {
        const bx = x + dx;
        const bz = z + dz;
        if (w.getBlock(bx, y, bz) !== B.kav_field || freshWall(game, bx, y, bz)) continue;
        w.setBlock(bx, y, bz, B.air);
        // (One of the walls it threw up: marked, so it isn't put back up
        // by anything else meanwhile.)
        let own = null;
        for (const b of game.bulwarks || []) {
          const q = b.put.find((p) => p.x === bx && p.y === y && p.z === bz);
          if (q) {
            q.down = true;
            own = b;
            break;
          }
        }
        off.push({ x: bx, y, z: bz, own });
      }
    }
  }
  if (!off.length) return false;
  (game.fieldsOff ||= []).push({ t: FIELD_OFF, off });
  const r = game.renderer;
  const mid = off[Math.floor(off.length / 2)];
  r.effect?.({ type: 'beam', wx: c.x, wy: c.y + 2, wz: c.z, tx: mid.x, ty: c.y + 0.8, tz: mid.z, life: 0.35, oy: -8, color: '#ffffff', halo: '#ff4050', width: 1 });
  for (const q of off) if (q.y === c.y) r.emit(q.x, q.y + 0.8, q.z, { n: 6, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 12, speed: 30, life: 0.45, glow: true, shape: 'shard' });
  if (!(c.fieldNote > 0)) {
    c.fieldNote = 2.5;
    r.floatText(c.x, c.y + 3.4, c.z, 'FIELD DISENGAGED', '#c8fbff');
  }
  game.audio?.play('hum', c);
  game.lightDirty = true;
  return true;
}

// All of them back up at once (the floor being left): those of the ruin's
// own, not walls whose time is out.
export function restoreFields(game) {
  for (const g of game.fieldsOff || []) {
    for (const q of g.off) {
      if (q.own) {
        const p = q.own.put.find((o) => o.x === q.x && o.y === q.y && o.z === q.z);
        if (p) p.down = false;
        continue;
      }
      if (game.world.getBlock(q.x, q.y, q.z) === B.air) game.world.setBlock(q.x, q.y, q.z, B.kav_field);
    }
  }
  game.fieldsOff = [];
}

// Each frame: the fields it turned off, back up when their time's out (and
// nobody's stood in the gap; one it threw up itself only if that wall is
// still meant to be standing).
export function tickFieldsOff(game, dt) {
  const list = game.fieldsOff;
  if (!list || !list.length) return;
  const w = game.world;
  let raised = false;
  for (const g of list) {
    g.t -= dt;
    if (g.t > 0) continue;
    const left = [];
    for (const q of g.off) {
      if (q.own && !(game.bulwarks || []).includes(q.own)) continue;
      const by = [game.player, ...game.npcs, ...game.creatures].some((e) => e && !e.dead && Math.abs(e.x - q.x) <= (e.foot || 0) && Math.abs(e.z - q.z) <= (e.foot || 0) && q.y - e.y >= 0 && q.y - e.y <= 1);
      if (by) {
        left.push(q);
        continue;
      }
      if (w.getBlock(q.x, q.y, q.z) === B.air) {
        w.setBlock(q.x, q.y, q.z, B.kav_field);
        raised = true;
        if (q.y === Math.min(...g.off.map((o) => o.y))) game.renderer.emit(q.x, q.y + 0.2, q.z, { n: 4, color: ['#5ad8f0', '#c8fbff'], up: 40, speed: 10, life: 0.5, glow: true });
      }
      if (q.own) {
        const p = q.own.put.find((o) => o.x === q.x && o.y === q.y && o.z === q.z);
        if (p) p.down = false;
      }
    }
    g.off = left;
    if (left.length) g.t = 0.4;
  }
  game.fieldsOff = list.filter((g) => g.off.length > 0);
  if (raised) {
    game.lightDirty = true;
    game.audio?.play('hum');
  }
}
