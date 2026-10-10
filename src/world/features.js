// (Round 79) Small things out in the country, here and there (worlds
// made since world gen 7):
//   - a cave mouth in a hillside, a short way in to a chamber (bones, a
//     barrel someone left);
//   - burrows, a little cluster of them, earth heaped by each hole;
//   - an animal trail, a line of worn earth winding through the grass;
//   - an abandoned farm: a broken fence round furrows gone to weeds, a
//     bale or two, the corner of a shed fallen in;
//   - an old road, its stones half gone, running straight across the land
//     to nowhere now.
import { SURFACE } from '../config.js';
import { hashf, mulberry32, hash4 } from '../util/rng.js';
import { B } from './blocks.js';
import { BIOMES } from './biomes.js';

const FC = 56;
const KINDS = [['cave', 0.022], ['burrows', 0.03], ['trail', 0.04], ['farm', 0.014], ['road', 0.02]];
const GRASSY = new Set([B.grass, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga]);

// The small features whose cells touch a tile rectangle.
export function featuresIn(ow, x0, z0, x1, z1) {
  const out = [];
  for (let cz = Math.floor((z0 - 70) / FC); cz <= Math.floor((z1 + 70) / FC); cz++) {
    for (let cx = Math.floor((x0 - 70) / FC); cx <= Math.floor((x1 + 70) / FC); cx++) {
      let r = hashf(cx, cz, ow.seed, 0x4f0);
      for (const [kind, p] of KINDS) {
        if (r < p) {
          out.push({ kind, x: Math.round((cx + 0.15 + hashf(cx, cz, ow.seed, 0x4f1) * 0.7) * FC), z: Math.round((cz + 0.15 + hashf(cx, cz, ow.seed, 0x4f2) * 0.7) * FC), seed: hash4(ow.seed, cx, cz, 0x4f3) });
          break;
        }
        r -= p;
      }
    }
  }
  return out;
}

// What a feature is made of: [{ x, y, z, id, surface }] (surface: the
// ground's own top block changed, not something set on it). `col(x, z)`:
// the terrain column there; null for none here.
export function featureOps(f, col) {
  const rand = mulberry32(f.seed);
  const c0 = col(f.x, f.z);
  if (!c0 || c0.water >= 0 || c0.flat > 0 || c0.form || c0.landmark || c0.bridge) return null;
  const bd = BIOMES[c0.biome] || {};
  const ops = [];
  const set = (x, y, z, id) => ops.push({ x, y, z, id });
  const surf = (x, z, id, onlyGreen = false) => {
    const c = col(x, z);
    if (!c || c.water >= 0 || c.flat > 0 || c.form || c.landmark) return null;
    if (onlyGreen && !GRASSY.has(c.surf)) return null;
    ops.push({ x, y: c.h, z, id, surface: true });
    return c;
  };
  switch (f.kind) {
    case 'cave': {
      if (c0.h < SURFACE + 3) return null;
      // Into the hill from its lowest side.
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let best = null;
      for (const [dx, dz] of dirs) {
        const c = col(f.x + dx * 6, f.z + dz * 6);
        if (c && c.water < 0 && (!best || c.h < best.h)) best = { dx, dz, h: c.h };
      }
      if (!best || best.h > c0.h - 2) return null;
      const [dx, dz] = [-best.dx, -best.dz];
      const L = 8 + Math.floor(rand() * 5);
      const y0 = Math.max(SURFACE + 1, best.h + 1);
      for (let k = -5; k <= L; k++) {
        for (let w = -1; w <= 1; w++) {
          const x = f.x + dx * k + dz * w;
          const z = f.z + dz * k + dx * w;
          const c = col(x, z);
          if (!c) continue;
          for (let y = y0; y <= y0 + 1; y++) if (y <= c.h) set(x, y, z, B.air);
          if (y0 - 1 <= c.h && k >= 0) set(x, y0 - 1, z, B.gravel);
        }
      }
      // The chamber at its end.
      const ex = f.x + dx * L;
      const ez = f.z + dz * L;
      for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) {
        if (ox * ox + oz * oz > 5) continue;
        const c = col(ex + ox, ez + oz);
        if (!c) continue;
        for (let y = y0; y <= y0 + 2; y++) if (y < c.h) set(ex + ox, y, ez + oz, B.air);
      }
      if (rand() < 0.5) set(ex, y0, ez, B.skull_pile);
      if (rand() < 0.4) set(ex + dz, y0, ez + dx, B.barrel);
      else set(ex - dz, y0, ez - dx, B.rubble);
      return ops;
    }
    case 'burrows': {
      if (!GRASSY.has(c0.surf)) return null;
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const x = f.x + Math.floor((rand() - 0.5) * 8);
        const z = f.z + Math.floor((rand() - 0.5) * 8);
        const c = surf(x, z, B.air, true);
        if (!c) continue;
        set(x, c.h - 1, z, B.air);
        for (const [ox, oz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (rand() < 0.7) surf(x + ox, z + oz, B.dirt, true);
      }
      return ops;
    }
    case 'trail': {
      if (!GRASSY.has(c0.surf)) return null;
      let a = rand() * Math.PI * 2;
      let x = f.x;
      let z = f.z;
      const L = 30 + Math.floor(rand() * 26);
      for (let i = 0; i < L; i++) {
        a += (rand() - 0.5) * 0.5;
        x += Math.cos(a);
        z += Math.sin(a);
        surf(Math.round(x), Math.round(z), rand() < 0.75 ? B.dirt : B.grass_dry, true);
      }
      return ops;
    }
    case 'farm': {
      if (!GRASSY.has(c0.surf) || bd.climate === 'cold' || bd.climate === 'hot' || c0.h > SURFACE + 1) return null;
      const W = 9;
      const D = 7;
      const x0 = f.x - 4;
      const z0 = f.z - 3;
      for (let ox = 0; ox < W; ox++) for (let oz = 0; oz < D; oz++) {
        const x = x0 + ox;
        const z = z0 + oz;
        const c = col(x, z);
        if (!c || c.water >= 0 || c.flat > 0 || Math.abs(c.h - c0.h) > 1) continue;
        const edge = ox === 0 || oz === 0 || ox === W - 1 || oz === D - 1;
        if (edge) {
          if (rand() < 0.55) set(x, c.h + 1, z, B.fence);
          continue;
        }
        // Furrows gone to weeds.
        ops.push({ x, y: c.h, z, id: oz % 2 ? B.dirt : B.grass_dry, surface: true });
        if (rand() < 0.25) set(x, c.h + 1, z, B.dead_bush);
      }
      set(x0 + 2, c0.h + 1, z0 + 2, B.hay_bale);
      if (rand() < 0.5) set(x0 + 6, c0.h + 1, z0 + 4, B.hay_bale);
      // The shed's corner, fallen in.
      for (let i = 0; i < 3; i++) {
        set(x0 + W + i, c0.h + 1, z0, B.planks_dark);
        if (i < 2) set(x0 + W, c0.h + 1, z0 + i, B.planks_dark);
        if (rand() < 0.5) set(x0 + W + 1, c0.h + 1, z0 + 1, B.rubble);
      }
      set(x0 + W, c0.h + 2, z0, B.planks_dark);
      return ops;
    }
    case 'road': {
      const a = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() < 0.5 ? Math.PI / 4 : 0);
      const L = 40 + Math.floor(rand() * 30);
      const ux = Math.round(Math.cos(a));
      const uz = Math.round(Math.sin(a));
      for (let i = -Math.floor(L / 2); i < L / 2; i++) {
        for (let w = -1; w <= 1; w++) {
          const x = f.x + ux * i + (uz !== 0 && ux === 0 ? w : -uz * w);
          const z = f.z + uz * i + (ux !== 0 && uz === 0 ? w : ux * w);
          const r = rand();
          if (r < 0.5) surf(x, z, B.cobblestone);
          else if (r < 0.72) surf(x, z, B.gravel);
        }
        if (rand() < 0.04) {
          const c = col(f.x + ux * i, f.z + uz * i);
          if (c && c.water < 0) set(f.x + ux * i + uz * 2, c.h + 1, f.z + uz * i - ux * 2, B.rubble);
        }
      }
      // A milestone, fallen at one end.
      const c = col(f.x - ux * Math.floor(L / 2), f.z - uz * Math.floor(L / 2));
      if (c && c.water < 0) set(f.x - ux * Math.floor(L / 2) + uz * 2, c.h + 1, f.z - uz * Math.floor(L / 2) - ux * 2, B.stone);
      return ops;
    }
    default:
      return null;
  }
}
