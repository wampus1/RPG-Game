// (Round 78) A save's health, looked over as it's loaded: each part of
// the world (each region) brought back from the save is gone over as it
// comes in, and whatever's plainly out of place put right, in place of a
// one-off fix in each new version for each new kind of mistake. What's
// looked for:
//   - Things hung on a wall (paintings, ladders) with no wall left to hang
//     on: taken down. A painting hung in the middle of a wall's run (where
//     a wall block should be), over a door, or in a building that hangs
//     none (a temple, a jail, a barn): taken down (the wall put back).
//   - A door with no top half (or a top half with no door): mended, or
//     the stray half taken away.
//   - A chest (barrel, crate) with nothing to hold things in: given its
//     slots back.
//   - A two-storey house's old plank steps: made over into stairs of its
//     own floor, as houses are built now.
// Whatever's put right is counted, and said once (see Game: `health`).
// Only what came from the save is looked over: ground made fresh is as
// it should be. A thing at the edge of a region whose neighbour isn't in
// yet is left till it can be judged.
import { REGION_W, REGION_D, WORLD_Y, SURFACE } from '../config.js';
import { BLOCKS, B, stairFor } from '../world/blocks.js';
import { CONTAINER_SIZE } from '../world/loot.js';
import { makeSlots } from './inventory.js';
import { NO_PAINTINGS } from '../world/settlement.js';
import { WALL_DIRS } from './displays.js';

const wallAt = (w, x, y, z) => {
  const b = BLOCKS[w.getBlock(x, y, z)];
  return !!(b && b.solid && (b.render === 'cube' || b.render === 'wall' || b.render === 'door'));
};

// Can (x, z) be judged yet (its region in)?
const known = (w, x, z) => !!w.regionAt(x, z);

// The town building (x, z) is in, if any.
function buildingAt(w, x, z) {
  for (const L of w.layouts.values()) {
    const bd = L.bounds;
    if (bd && (x < bd.x0 - 2 || x > bd.x1 + 2 || z < bd.z0 - 2 || z > bd.z1 + 2)) continue;
    for (const b of L.buildings || []) if (b.x0 !== undefined && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b;
  }
  return null;
}

function tally(game, kind, n = 1) {
  const H = (game.health ||= { fixed: 0, kinds: {}, told: 0 });
  H.fixed += n;
  H.kinds[kind] = (H.kinds[kind] || 0) + n;
}

// Region `r`, just loaded from the save: gone over. How many put right.
export function checkRegion(game, r) {
  const w = game.world;
  let n = 0;
  const set = (x, y, z, id, meta = 0) => {
    w.setBlock(x, y, z, id, meta);
    n++;
  };
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const x = r.x0 + lx;
      const z = r.z0 + lz;
      const edge = lx === 0 || lz === 0 || lx === REGION_W - 1 || lz === REGION_D - 1;
      const col = (lz * REGION_W + lx) * WORLD_Y;
      for (let y = 1; y < WORLD_Y - 1; y++) {
        const id = r.blocks[col + y];
        if (!id) continue;
        const b = BLOCKS[id];
        if (!b) continue;
        // Hung on a wall, with no wall.
        if (b.onWall) {
          if (edge && WALL_DIRS.some(([dx, dz]) => !known(w, x + dx, z + dz))) continue;
          const d = [r.meta[col + y] & 3, 0, 1, 2, 3].find((q) => wallAt(w, x + WALL_DIRS[q][0], y, z + WALL_DIRS[q][1]));
          if (d === undefined) {
            set(x, y, z, B.air);
            tally(game, b.painting ? 'painting' : 'hung');
            continue;
          }
          if (b.painting) {
            const bl = buildingAt(w, x, z);
            const wallMat = bl && bl.mats && bl.mats.wall;
            const inWall = wallMat !== undefined && wallMat !== null && r.blocks[col + y - 1] === wallMat && r.blocks[col + y + 1] === wallMat;
            const behind = BLOCKS[w.getBlock(x + WALL_DIRS[d][0], y, z + WALL_DIRS[d][1])];
            const overDoor = !!(behind && (behind.interact === 'door' || behind.name === 'door_top'));
            if ((bl && NO_PAINTINGS.has(bl.type)) || inWall || overDoor) {
              set(x, y, z, inWall ? wallMat : B.air);
              tally(game, 'painting');
              continue;
            }
          }
        }
        // A door's two halves.
        if (id === B.door) {
          const up = r.blocks[col + y + 1];
          if (up !== B.door_top) {
            if (!up) {
              set(x, y + 1, z, B.door_top, r.meta[col + y]);
              tally(game, 'door');
            }
          }
        } else if (id === B.door_top && r.blocks[col + y - 1] !== B.door) {
          set(x, y, z, B.air);
          tally(game, 'door');
          continue;
        }
        // A chest with nothing in it to hold things.
        if (b.interact === 'container' && !r.containers.has(col + y)) {
          r.containers.set(col + y, makeSlots(CONTAINER_SIZE[b.name] || b.modSlots || 9));
          r.modified = true;
          n++;
          tally(game, 'chest');
        }
      }
    }
  }
  n += oldSteps(game, r);
  return n;
}

// Two-storey houses in `r` still on their old plank steps: stairs now.
function oldSteps(game, r) {
  const w = game.world;
  const Y0 = SURFACE + 1;
  let n = 0;
  const inR = (p) => p.x >= r.x0 && p.x < r.x0 + REGION_W && p.z >= r.z0 && p.z < r.z0 + REGION_D;
  for (const L of w.layouts.values()) {
    for (const b of L.buildings || []) {
      const st = b.stair;
      if (b.storeys !== 2 || !st || !inR(st.low)) continue;
      if (![st.low, st.mid, st.top].every((p) => known(w, p.x, p.z))) continue;
      if (w.getBlock(st.low.x, Y0, st.low.z) !== B.planks_dark) continue;
      const floor = b.mats && b.mats.floor ? b.mats.floor : B.planks;
      const stair = stairFor(floor);
      const up = b.stairUp ?? (st.mid.z > st.low.z ? 0 : st.mid.x < st.low.x ? 1 : st.mid.z < st.low.z ? 2 : 3);
      w.setBlock(st.low.x, Y0, st.low.z, stair, up);
      w.setBlock(st.low.x, Y0 + 1, st.low.z, B.air);
      w.setBlock(st.low.x, Y0 + 2, st.low.z, floor);
      w.setBlock(st.mid.x, Y0, st.mid.z, floor);
      w.setBlock(st.mid.x, Y0 + 1, st.mid.z, stair, up);
      w.setBlock(st.top.x, Y0, st.top.z, floor);
      w.setBlock(st.top.x, Y0 + 1, st.top.z, floor);
      w.setBlock(st.top.x, Y0 + 2, st.top.z, stair, up);
      n++;
      tally(game, 'stairs');
    }
  }
  return n;
}

// What was put right since last said, said (once things have settled:
// see Game.update).
const WORDS = { painting: ['painting', 'paintings'], hung: ['thing hung on nothing', 'things hung on nothing'], door: ['door', 'doors'], chest: ['chest', 'chests'], stairs: ['old stair', 'old stairs'] };
export function healthNote(game) {
  const H = game.health;
  if (!H || H.fixed <= H.told) return null;
  H.told = H.fixed;
  const parts = Object.entries(H.kinds).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${WORDS[k] ? WORDS[k][v === 1 ? 0 : 1] : k}`);
  H.kinds = {};
  return `Save check: put right ${parts.join(', ')} that ${H.fixed === 1 ? 'was' : 'were'} out of place.`;
}
