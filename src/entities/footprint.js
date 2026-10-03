// The great masters (the Overseer, the Ossuary Horror, the Brood Mother,
// the Deep Worm, a Prime Golem) are drawn three paces across, and they fill
// three paces across: nothing walks into them, they never stand where a
// wall would cut into them, and a blow (or an arrow, or a beam) on any of
// that ground lands on them. `e.foot` is how many paces out from its own
// tile it fills (0 for everyone else).

// Does `e` fill the tile (x, z)?
export function covers(e, x, z) {
  const r = (e && e.foot) || 0;
  return Math.abs(x - e.x) <= r && Math.abs(z - e.z) <= r;
}

// Does `e` fill any of those tiles?
export function onTiles(e, tiles) {
  const r = (e && e.foot) || 0;
  if (!r) return tiles.some((t) => t.x === e.x && t.z === e.z);
  return tiles.some((t) => Math.abs(t.x - e.x) <= r && Math.abs(t.z - e.z) <= r);
}

// A master drawn half as big again as you (not one of the great ones that
// fill three paces): a blow or a shot that comes this close to its middle
// finds it, a little more than its one pace.
export const MASTER_PAD = 0.85;
export function padded(e) {
  return !!(e && e.isBoss && !e.foot && e.S && e.S.humanoid);
}

// Paces between two (edge to edge: 0 when they touch, or overlap).
export function apart(a, b) {
  const r = ((a && a.foot) || 0) + ((b && b.foot) || 0);
  return Math.max(0, Math.abs(a.x - b.x) - r, Math.abs(a.z - b.z) - r);
}

// The nearest tile of `e` to `from` (where a blow at it lands).
export function nearestOf(e, from) {
  const r = (e && e.foot) || 0;
  return { x: e.x + Math.max(-r, Math.min(r, from.x - e.x)), z: e.z + Math.max(-r, Math.min(r, from.z - e.z)) };
}

// Would `e` fit with its own tile at (x, y, z): every tile it fills open
// floor it could stand on, and nobody else in it? (`walls`: only the
// walls count, not who's standing about.)
export function fits(game, e, x, y, z, walls = false) {
  const r = (e && e.foot) || 0;
  const w = game.world;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dz) continue;
      if (!w.canStand(x + dx, y, z + dz)) return false;
      if (!walls && game.occupiedBySolid(x + dx, y, z + dz, e)) return false;
    }
  }
  return true;
}

// The tiles it fills.
export function footTiles(e, x = e.x, z = e.z) {
  const r = (e && e.foot) || 0;
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push({ x: x + dx, z: z + dz });
  return out;
}

// The nearest spot to (x, z) it fits (searching out a few paces), or null.
export function fitNear(game, e, x, z, y, far = 6) {
  for (let r = 0; r <= far; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const tx = x + dx;
        const tz = z + dz;
        if (e.leash && (tx < e.leash.x0 || tx > e.leash.x1 || tz < e.leash.z0 || tz > e.leash.z1)) continue;
        const ty = game.world.findStandY(tx, tz, y);
        if (ty !== y || !game.world.canStand(tx, ty, tz)) continue;
        if (game.occupiedBySolid(tx, ty, tz, e) || !fits(game, e, tx, ty, tz)) continue;
        return { x: tx, y: ty, z: tz };
      }
    }
  }
  return null;
}
