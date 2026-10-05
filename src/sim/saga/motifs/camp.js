// An outlaws' camp, made more of as their story goes on (round 52):
//   - an outpost: a palisade of logs about the tents, a banner at the
//     gate, a rack of arms; then a full wall, a brazier, a pen; then a
//     lookout and stakes outside;
//   - a cage of iron bars (two high, the door facing the fire) to hold
//     someone in, and a strongbox by the fire where what's taken off them
//     goes (see captive.js).
// Each piece goes in the camp's own list (so it comes down with the camp
// if they move on), and in through the town's deferred edits where the
// ground isn't loaded.
import { B, BLOCKS, META_STATE } from '../../../world/blocks.js';
import { GROUND } from '../../../config.js';

function yAt(S, x, z) {
  const w = S.game.world;
  if (!w.regionAt(x, z)) return GROUND;
  const y = w.findStandY(x, z, GROUND);
  return y > 0 ? y : GROUND;
}

function put(S, band, ops) {
  const w = S.game.world;
  // (Brush and saplings out of the way first.)
  const clear = ops.filter(([x, y, z]) => w.regionAt(x, z) && w.getBlock(x, y, z) !== B.air && BLOCKS[w.getBlock(x, y, z)] && BLOCKS[w.getBlock(x, y, z)].replaceable).map(([x, y, z]) => [x, y, z, B.air, 0]);
  if (clear.length) S.sim.setBlocks(clear);
  S.sim.setBlocks(ops);
  band.camp.ops.push(...ops);
}

// The camp's ground plan: its tents (west to east), its fire (in front).
export function plan(band) {
  const c = band.camp;
  const tents = c.ops.filter(([, , , id]) => id === B.tent);
  const xs = tents.map(([x]) => x);
  const x0 = xs.length ? Math.min(...xs) : c.x;
  const x1 = xs.length ? Math.max(...xs) : c.x;
  return { x0, x1, z: c.z, fx: c.fire.x, fz: c.fire.z };
}

// Up to `level` (1 to 3): see the top.
export function fortify(S, band, level) {
  const c = band.camp;
  if (!c) return 0;
  const was = band.outpost || 0;
  if (level <= was) return was;
  const P = plan(band);
  const bx0 = P.x0 - 5;
  const bx1 = P.x1 + 5;
  const bz0 = P.z - 3;
  const bz1 = P.fz + 5;
  const gx = Math.round((bx0 + bx1) / 2);
  const ring = [];
  for (let x = bx0; x <= bx1; x++) ring.push([x, bz0], [x, bz1]);
  for (let z = bz0 + 1; z < bz1; z++) ring.push([bx0, z], [bx1, z]);
  const gate = (x, z) => z === bz1 && Math.abs(x - gx) <= 1;
  for (let lv = was + 1; lv <= Math.min(3, level); lv++) {
    const ops = [];
    if (lv === 1) {
      // Stakes along most of it (gaps where it's not done).
      ring.forEach(([x, z], i) => {
        if (gate(x, z) || i % 5 === 3) return;
        ops.push([x, yAt(S, x, z), z, B.log_wall, 0]);
      });
      ops.push([gx - 2, yAt(S, gx - 2, bz1 + 1), bz1 + 1, B.war_banner, 0]);
      ops.push([P.x1 + 2, yAt(S, P.x1 + 2, P.z), P.z, B.weapon_rack, 0]);
      // (And another tent: more of them now.)
      ops.push([P.x1 + 3, yAt(S, P.x1 + 3, P.z + 1), P.z + 1, B.tent, 0]);
    } else if (lv === 2) {
      // The gaps filled; a brazier by the gate; a crate or two of loot.
      ring.forEach(([x, z], i) => {
        if (gate(x, z) || i % 5 !== 3) return;
        ops.push([x, yAt(S, x, z), z, B.log_wall, 0]);
      });
      ops.push([gx + 2, yAt(S, gx + 2, bz1 - 1), bz1 - 1, B.brazier, META_STATE]);
      ops.push([bx0 + 1, yAt(S, bx0 + 1, bz0 + 1), bz0 + 1, B.crate, 0]);
      ops.push([bx0 + 2, yAt(S, bx0 + 2, bz0 + 1), bz0 + 1, B.barrel, 0]);
    } else {
      // Two high, a lookout at the corner, stakes outside the gate.
      ring.forEach(([x, z], i) => {
        if (gate(x, z) || i % 2) return;
        ops.push([x, yAt(S, x, z) + 1, z, B.log_wall, 0]);
      });
      const ly = yAt(S, bx1, bz0);
      ops.push([bx1, ly + 1, bz0, B.log_wall, 0], [bx1, ly + 2, bz0, B.log_wall, 0], [bx1, ly + 3, bz0, B.torch, 0]);
      for (const dx of [-3, 3]) ops.push([gx + dx, yAt(S, gx + dx, bz1 + 2), bz1 + 2, B.spikes, 0]);
      ops.push([gx + 2, yAt(S, gx + 2, bz1 + 1), bz1 + 1, B.war_banner, 0]);
    }
    put(S, band, ops);
  }
  band.outpost = Math.min(3, level);
  c.wall = { x0: bx0, x1: bx1, z0: bz0, z1: bz1, gate: { x: gx, z: bz1 } };
  return band.outpost;
}

// The cage (made once): { cell (inside), door, stash (the strongbox) }.
export function cage(S, band) {
  const c = band.camp;
  if (!c) return null;
  if (c.cage) return c.cage;
  const P = plan(band);
  const cx = P.x0 - 3;
  const cz = P.z + 1;
  const y = yAt(S, cx, cz);
  // (Whatever grows there cut back first: a tree, a bush.)
  const cut = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 4; dy++) cut.push([cx + dx, y + dy, cz + dz, B.air, 0]);
  S.sim.setBlocks(cut);
  const ops = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const door = dx === 1 && dz === 0;
      ops.push([cx + dx, y, cz + dz, door ? B.cell_door : B.iron_bars, 0]);
      ops.push([cx + dx, y + 1, cz + dz, door ? B.cell_door_top : B.iron_bars, 0]);
    }
  }
  // (A roof of planks, so nobody climbs out.)
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ops.push([cx + dx, y + 2, cz + dz, B.planks, 0]);
  // (Nothing left inside the cell to stand in the way.)
  ops.push([cx, y, cz, B.air, 0], [cx, y + 1, cz, B.air, 0]);
  const sx = P.fx + 3;
  const sz = P.fz;
  ops.push([sx, yAt(S, sx, sz), sz, B.chest, 0]);
  put(S, band, ops);
  c.cage = { cell: { x: cx, y, z: cz }, door: { x: cx + 1, y, z: cz }, stash: { x: sx, y: yAt(S, sx, sz), z: sz } };
  return c.cage;
}

// Things put in the camp's strongbox: kept on the band's books (whose
// they were, too), and handed over whole to whoever opens the box when it's
// not watched (see captive.js).
export function stash(S, band, items, owner = null) {
  if (!items.length) return;
  band.stash ||= [];
  for (const it of items) band.stash.push({ item: it.item, count: it.count, owner });
}

// What's in the box, and whose.
export function stashOf(band) {
  return (band && band.stash) || [];
}

export function stashAt(S, x, z) {
  for (const b of S.sim.bandits.live()) {
    const cg = b.camp && b.camp.cage;
    if (cg && cg.stash.x === x && cg.stash.z === z) return b;
  }
  return null;
}

export function setDoor(S, band, open) {
  const cg = band.camp && band.camp.cage;
  if (!cg) return;
  S.sim.setBlocks([[cg.door.x, cg.door.y, cg.door.z, open ? B.cell_door_open : B.cell_door, 0]]);
}

export function inCage(band, x, z) {
  const cg = band && band.camp && band.camp.cage;
  return !!cg && Math.round(x) === cg.cell.x && Math.round(z) === cg.cell.z;
}

// The band a cage door belongs to.
export function cageAt(S, x, z) {
  for (const b of S.sim.bandits.live()) {
    const cg = b.camp && b.camp.cage;
    if (cg && cg.door.x === x && cg.door.z === z) return b;
  }
  return null;
}
