// Multi-block tree shapes. Each builder returns [dx, dy, dz, blockId] cells
// relative to the trunk base (dy = 0 is the first cell above the ground).
import { B } from './blocks.js';

function disc(out, cx, dy, cz, r, id, rand, trim = 0, drop = 0) {
  // trim 0: square with clipped corners, trim 1: rounder / diamond-ish.
  const maxM = 2 * r - (r > 1 ? 1 : 0) - trim;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const m = Math.abs(dx) + Math.abs(dz);
      if (m > maxM) continue;
      if (drop && m >= r && rand() < drop) continue;
      out.push([cx + dx, dy, cz + dz, id]);
    }
  }
}

function trunk(out, h, id, x = 0, z = 0, from = 0) {
  for (let y = from; y < h; y++) out.push([x, y, z, id]);
}

export const TREE_BUILDERS = {
  oak(rand) {
    const out = [];
    const h = 2 + (rand() < 0.45 ? 1 : 0);
    disc(out, 0, h - 1, 0, 2, B.leaves_oak, rand, 0, 0.25);
    disc(out, 0, h, 0, 2, B.leaves_oak, rand, 1, 0.35);
    disc(out, 0, h + 1, 0, 1, B.leaves_oak, rand, 1);
    trunk(out, h + 1, B.log_oak);
    return out;
  },
  birch(rand) {
    const out = [];
    const h = 3 + (rand() < 0.5 ? 1 : 0);
    disc(out, 0, h - 1, 0, 1, B.leaves_birch, rand, 0, 0.1);
    disc(out, 0, h, 0, 1, B.leaves_birch, rand, 1);
    out.push([0, h + 1, 0, B.leaves_birch]);
    trunk(out, h, B.log_birch);
    return out;
  },
  pine(rand, snowy = false) {
    const out = [];
    const L = B.leaves_pine;
    const S = snowy ? B.leaves_snowy : L;
    disc(out, 0, 1, 0, 2, L, rand, 0, 0.2);
    disc(out, 0, 2, 0, 1, L, rand, 0);
    disc(out, 0, 3, 0, 1, S, rand, 1);
    out.push([0, 4, 0, S]);
    if (rand() < 0.5) out.push([0, 5, 0, S]);
    trunk(out, 4, B.log_pine);
    return out;
  },
  snowpine(rand) {
    return TREE_BUILDERS.pine(rand, true);
  },
  palm(rand) {
    const out = [];
    const h = 4 + (rand() < 0.4 ? 1 : 0);
    trunk(out, h, B.log_palm);
    const L = B.leaves_palm;
    out.push([0, h, 0, L]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      out.push([dx, h, dz, L]);
      out.push([dx * 2, h, dz * 2, L]);
      out.push([dx * 3, h - 1, dz * 3, L]);
    }
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out.push([dx, h, dz, L]);
    return out;
  },
  jungle(rand) {
    const out = [];
    const h = 5 + (rand() < 0.5 ? 1 : 0);
    const L = B.leaves_jungle;
    disc(out, 0, h - 1, 0, 3, L, rand, 1, 0.3);
    disc(out, 0, h, 0, 2, L, rand, 0, 0.2);
    disc(out, 0, h + 1, 0, 1, L, rand, 1);
    if (rand() < 0.6) disc(out, rand() < 0.5 ? 2 : -2, 2, 0, 1, L, rand, 1);
    trunk(out, h, B.log_jungle);
    return out;
  },
  acacia(rand) {
    const out = [];
    const dir = rand() < 0.5 ? 1 : -1;
    trunk(out, 3, B.log_acacia);
    out.push([dir, 3, 0, B.log_acacia]);
    disc(out, dir, 4, 0, 2, B.leaves_acacia, rand, 0, 0.15);
    disc(out, dir, 5, 0, 1, B.leaves_acacia, rand, 1);
    return out;
  },
  willow(rand) {
    const out = [];
    const h = 3;
    const L = B.leaves_willow;
    disc(out, 0, h, 0, 2, L, rand, 0, 0.1);
    disc(out, 0, h + 1, 0, 1, L, rand, 0);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2 || Math.abs(dx) + Math.abs(dz) > 3) continue;
        if (rand() < 0.55) out.push([dx, h - 1, dz, L]);
        if (rand() < 0.3) out.push([dx, h - 2, dz, L]);
      }
    }
    trunk(out, h + 1, B.log_willow);
    return out;
  },
  dead(rand) {
    const out = [];
    const h = 2 + Math.floor(rand() * 3);
    trunk(out, h, B.log_oak);
    const dx = rand() < 0.5 ? 1 : -1;
    out.push([dx, h - 1, 0, B.log_oak]);
    return out;
  },
  cactus(rand) {
    const out = [];
    const h = 1 + Math.floor(rand() * 3);
    for (let y = 0; y < h; y++) out.push([0, y, 0, B.cactus]);
    return out;
  },
  stump() {
    return [[0, 0, 0, B.log_oak]];
  },
  bushtree(rand) {
    const out = [];
    disc(out, 0, 1, 0, 1, B.leaves_jungle, rand, 1);
    out.push([0, 2, 0, B.leaves_jungle]);
    trunk(out, 2, B.log_jungle);
    return out;
  },
};

// Trees that need their trunk to be on non-water land and how far their
// canopy may reach (used as generation margin).
export const TREE_MARGIN = 4;
