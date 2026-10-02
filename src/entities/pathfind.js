// A* over the voxel grid: 4-directional steps with the same climb/drop rules
// the player uses. Doors count as passable (NPCs open them).
import { MinHeap } from '../util/heap.js';
import { BLOCKS, ROAD_BLOCKS } from '../world/blocks.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function findPath(world, sx, sy, sz, tx, ty, tz, opts = {}) {
  const maxNodes = opts.maxNodes || 6000;
  const box = opts.box; // {x0,z0,x1,z1}
  const blocked = opts.blocked; // (x,z) => bool
  const near = opts.near || 0; // accept any node within this Chebyshev distance
  // Water: wading costs this much more a step (`dry`: not at all, for
  // horses and wagons).
  const wet = opts.wet ?? 4;
  const dry = !!opts.dry;
  const key = (x, y, z) => ((x & 0xfff) << 16) | ((z & 0xfff) << 4) | y;
  const h = (x, z) => (Math.abs(x - tx) + Math.abs(z - tz)) * 0.62;
  const open = new MinHeap();
  const g = new Map();
  const parent = new Map();
  const startK = key(sx, sy, sz);
  g.set(startK, 0);
  open.push([sx, sy, sz, startK], h(sx, sz));
  let expanded = 0;
  let best = null;
  let bestH = Infinity;
  while (open.size) {
    const [x, y, z, k] = open.pop();
    const gc = g.get(k);
    const dist = Math.max(Math.abs(x - tx), Math.abs(z - tz));
    if ((x === tx && z === tz && Math.abs(y - ty) <= 1) || (near && dist <= near && Math.abs(y - ty) <= 2)) {
      return rebuild(parent, k, [x, y, z]);
    }
    const hh = h(x, z);
    if (hh < bestH) {
      bestH = hh;
      best = [x, y, z, k];
    }
    if (++expanded > maxNodes) break;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (box && (nx < box.x0 || nx > box.x1 || nz < box.z0 || nz > box.z1)) continue;
      if (blocked && blocked(nx, nz) && !(nx === tx && nz === tz)) continue;
      let ny = world.stepTarget(x, y, z, nx, nz, true);
      // (A master's way goes through what you've built: see opts.through.)
      const breach = ny < 0 && opts.through && opts.through(nx, y, nz);
      if (breach) ny = y;
      if (ny < 0) continue;
      // (Room for the whole of something big: see entities/footprint.js.)
      if (opts.clear && !opts.clear(nx, ny, nz)) continue;
      const nk = key(nx, ny, nz);
      const floor = world.getBlock(nx, ny - 1, nz);
      const feet = BLOCKS[world.getBlock(nx, ny, nz)];
      let cost = ROAD_BLOCKS.has(floor) ? 0.65 : 1;
      if (feet.liquid) {
        if (dry) continue;
        cost += wet;
      }
      if (feet.interact === 'door') cost += 0.4;
      if (ny !== y) cost += 0.3;
      if (breach) cost += 1.5;
      const ng = gc + cost;
      if (g.has(nk) && g.get(nk) <= ng) continue;
      g.set(nk, ng);
      parent.set(nk, [x, y, z, k]);
      open.push([nx, ny, nz, nk], ng + h(nx, nz));
    }
  }
  if (opts.partial && best) return rebuild(parent, best[3], best.slice(0, 3));
  return null;
}

function rebuild(parent, k, last) {
  const path = [last];
  let cur = parent.get(k);
  while (cur) {
    path.push([cur[0], cur[1], cur[2]]);
    cur = parent.get(cur[3]);
  }
  path.reverse();
  path.shift(); // drop the start cell
  return path;
}
