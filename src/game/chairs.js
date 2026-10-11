// (Round 83) Chairs at tables: pushed in under the table (out of the way,
// as a tidy house keeps them), pulled out to be sat on. A chair at a table
// is pushed in unless it's marked out (its META_STATE); one with no table
// beside it is just a chair.
//   You pull one out as you sit on it (and Shift with a right-click pushes
// it in, or pulls it out, without sitting). Townsfolk pull theirs out as
// they come to sit, and push it back in when they get up and go.
import { B, META_STATE } from '../world/blocks.js';

const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];

// The way (dx, dz) to the table a chair at (x, y, z) is drawn up to: the
// one it faces if there is one, else any beside it; null if none.
export function chairTable(world, x, y, z) {
  if (world.getBlock(x, y, z) !== B.chair) return null;
  const f = world.getMeta(x, y, z) & 3;
  const order = [f, (f + 1) & 3, (f + 3) & 3, (f + 2) & 3];
  for (const d of order) {
    const [dx, dz] = DIRS[d];
    if (world.getBlock(x + dx, y, z + dz) === B.table) return { dx, dz };
  }
  return null;
}

// Pushed in under its table (true), or out (or no table at all: false).
export function tucked(world, x, y, z) {
  return !!chairTable(world, x, y, z) && !(world.getMeta(x, y, z) & META_STATE);
}

// Pulled out (`out`) or pushed in. True if it moved.
export function moveChair(game, x, y, z, out, quiet = false) {
  const w = game.world;
  if (!chairTable(w, x, y, z)) return false;
  const m = w.getMeta(x, y, z);
  const was = !!(m & META_STATE);
  if (was === !!out) return false;
  w.setMeta(x, y, z, out ? m | META_STATE : m & ~META_STATE);
  if (!quiet && game.player && Math.abs(game.player.x - x) + Math.abs(game.player.z - z) < 14) game.audio?.play('step_wood', { x, y, z }, null, { vol: 0.5 });
  return true;
}

// A townsperson and the chair they're making for: pulled out as they come
// up to it, pushed back in once they've got up and gone. (Looked at a few
// times a second, from NPC.update.)
export function npcChair(n, dt) {
  n.chairT = (n.chairT ?? 0) - dt;
  if (n.chairT > 0) return;
  n.chairT = 0.25;
  const g = n.game;
  const w = g && g.world;
  if (!w) return;
  // (One of a story's own, sent to a chair: a student at the Academy.)
  const sp = n.state === 'saga' ? (n.saga && n.saga.sitHome && n.saga.home ? { x: n.saga.home.x, z: n.saga.home.z, seat: true } : null) : n.spot;
  const want = (n.state === 'routine' || n.state === 'saga') && !n.sleeping && sp && sp.seat && Math.max(Math.abs(n.x - sp.x), Math.abs(n.z - sp.z)) <= 1 ? sp : null;
  const mine = n.chairAt;
  if (mine && (!want || want.x !== mine.x || want.z !== mine.z)) {
    // (Up and away: pushed back in, if nobody else has sat down on it.)
    if (Math.max(Math.abs(n.x - mine.x), Math.abs(n.z - mine.z)) >= 1 || !n.sitting) {
      const other = g.entityAt ? g.entityAt(mine.x, mine.y, mine.z) : null;
      if (!other || other === n) moveChair(g, mine.x, mine.y, mine.z, false);
      n.chairAt = null;
    }
  }
  if (want && !n.chairAt) {
    const y = w.getBlock(want.x, n.y, want.z) === B.chair ? n.y : w.getBlock(want.x, n.y - 1, want.z) === B.chair ? n.y - 1 : null;
    if (y === null) return;
    moveChair(g, want.x, y, want.z, true);
    n.chairAt = { x: want.x, y, z: want.z };
  }
}
