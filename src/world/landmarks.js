// (Round 79) Landmarks: rare things out in the wilds, built of blocks,
// each with a name of its own on the map once seen (worlds made since
// world gen 7):
//   - a giant fallen tree, moss on its back, its roots in the air;
//   - the bones of something enormous, long dead;
//   - a crater, a star's fall, with the star-stone still in it;
//   - a stone arch the wind and rain have left standing;
//   - a hot spring, steaming, ringed in yellow crust.
// Folk in the towns about know the tales of them (see
// sim/saga/motifs/landmarks.js), and some few hide something: a cache
// buried by the foot of it, that only a tale (or luck) will lead you to.
import { SURFACE, WATER_Y, WORLD_Y } from '../config.js';
import { hash4, hashf, mulberry32 } from '../util/rng.js';
import { B } from './blocks.js';
import { BIOMES } from './biomes.js';
import { RNG } from '../util/rng.js';
import { placeName } from './names.js';

const LM = 320;
const LM_CHANCE = 0.3;
export const LANDMARK_KINDS = {
  tree: { word: 'a giant fallen tree', names: ['The Fallen Giant', 'Old Felled', 'The Long Log', '{place} Fall'] },
  bones: { word: 'the bones of something huge', names: ['The Old Bones', '{place} Bones', 'The Ribcage', 'The Giant\'s Rest'] },
  crater: { word: 'a crater, where a star fell', names: ['Starfall', 'The {place} Crater', 'The Burnt Bowl', 'Skyfall Hollow'] },
  arch: { word: 'a stone arch', names: ['The Grey Arch', '{place} Arch', 'The Eye of Stone', 'The Window'] },
  spring: { word: 'a hot spring', names: ['The Steaming Pool', '{place} Springs', 'The Warm Waters', 'The Kettle'] },
};
const FITS = {
  tree: (b) => ['forest', 'jungle', 'taiga', 'plains', 'swamp', 'rimewood', 'mangrove', 'moor'].includes(b),
  bones: (b) => ['desert', 'savanna', 'tundra', 'bone_strand', 'red_mesa', 'salt_flats', 'plains'].includes(b),
  crater: (b) => b !== 'mountain',
  arch: (b) => ['desert', 'savanna', 'plains', 'red_mesa', 'tundra', 'moor', 'olive_hills', 'taiga'].includes(b),
  spring: (b) => !['desert', 'beach', 'swamp', 'mountain', 'salt_flats'].includes(b),
};

// The landmark of stretch (cx, cz) of world `ow`, or null.
function landmarkOf(ow, cx, cz) {
  const cache = (ow._landmarks ||= new Map());
  const k = cx * 100003 + cz;
  if (cache.has(k)) return cache.get(k);
  let lm = null;
  const s = ow.seed;
  if (hashf(cx, cz, s, 0x3a0) < LM_CHANCE) {
    const x = Math.round((cx + 0.2 + hashf(cx, cz, s, 0x3a1) * 0.6) * LM);
    const z = Math.round((cz + 0.2 + hashf(cx, cz, s, 0x3a2) * 0.6) * LM);
    const bi = ow.continentAt(x, z) >= 0.12 ? ow.biomeAt(x, z, {}) : null;
    const b = bi && bi.biome;
    const near = (pad) => ow.settlements.some((st) => st.bounds && x > st.bounds.x0 - pad && x < st.bounds.x1 + pad && z > st.bounds.z0 - pad && z < st.bounds.z1 + pad);
    const V = ow.volcano;
    if (b && b !== 'ocean' && b !== 'volcano' && BIOMES[b] && !near(48) && !(V && Math.hypot(x - V.x, z - V.z) < V.r * 1.6)) {
      const kinds = Object.keys(LANDMARK_KINDS).filter((q) => FITS[q](b) && !(q === 'spring' && BIOMES[b].climate === 'hot' && hashf(cx, cz, s, 0x3a3) < 0.5));
      if (kinds.length) {
        // (Some likelier than others: a hot spring's the rarest.)
        const W = { tree: 3, bones: 2, crater: 1.2, arch: 2.2, spring: 1 };
        let r = hashf(cx, cz, s, 0x3a4) * kinds.reduce((a, q) => a + W[q], 0);
        let kind = kinds[kinds.length - 1];
        for (const q of kinds) if ((r -= W[q]) <= 0) {
          kind = q;
          break;
        }
        const rng = new RNG(hash4(s, cx, cz, 0x3a5));
        const K = LANDMARK_KINDS[kind];
        const place = placeName(rng, 'vale');
        const name = rng.pick(K.names).replace('{place}', place);
        const ang = rng.int(0, 3);
        lm = {
          id: `lm${cx}_${cz}`, kind, x, z, name, ang, seed: hash4(s, cx, cz, 0x3a6), biome: b,
          r: { tree: 14, bones: 10, crater: 13, arch: 8, spring: 6 }[kind],
          // (One in three hides a cache, by its foot.)
          secret: rng.chance(0.34) ? { dx: rng.int(-4, 4) || 2, dz: rng.int(-4, 4) || -2 } : null,
        };
      }
    }
  }
  cache.set(k, lm);
  return lm;
}

// The landmarks within a tile rectangle.
export function landmarksIn(ow, x0, z0, x1, z1) {
  const out = [];
  for (let cz = Math.floor((z0 - 40) / LM); cz <= Math.floor((z1 + 40) / LM); cz++) {
    for (let cx = Math.floor((x0 - 40) / LM); cx <= Math.floor((x1 + 40) / LM); cx++) {
      const lm = landmarkOf(ow, cx, cz);
      if (lm && lm.x + lm.r + 8 >= x0 && lm.x - lm.r - 8 <= x1 && lm.z + lm.r + 8 >= z0 && lm.z - lm.r - 8 <= z1) out.push(lm);
    }
  }
  return out;
}

// The land under a landmark: a crater's bowl, a spring's pool. (`out` a
// terrain column; returns its new height, or null to leave it be.)
export function landmarkGround(lm, x, z, out, h) {
  const d = Math.hypot(x - lm.x, z - lm.z);
  if (lm.kind === 'crater') {
    const v = d / lm.r;
    if (v > 1.3) return null;
    out.landmark = lm;
    if (v < 1) {
      out.fsurf = v < 0.25 ? B.obsidian : v < 0.6 ? B.basalt : hashf(x, z, lm.seed, 1) < 0.5 ? B.gravel : B.scorched;
      out.fsub = B.stone;
      return Math.max(1, SURFACE - Math.round(3 * (1 - v * v)));
    }
    out.fsurf = B.gravel;
    return Math.max(h, SURFACE + 1);
  }
  if (lm.kind !== 'spring') {
    // (Under it, or by it: kept clear of trees.)
    if (d < lm.r + 2) out.landmark = lm;
    return null;
  }
  if (lm.kind === 'spring') {
    if (d < lm.r * 0.7) {
      out.landmark = lm;
      out.springWater = true;
      return WATER_Y - (d < lm.r * 0.35 ? 2 : 1);
    }
    if (d < lm.r) {
      out.fsurf = hashf(x, z, lm.seed, 2) < 0.6 ? B.sulfur_crust : B.clay;
      return Math.min(h, SURFACE);
    }
  }
  return null;
}

// The blocks of a landmark, as [dx, dy, dz, id] from its foot (dy 0: the
// first layer above the ground there).
export function landmarkCells(lm) {
  const rand = mulberry32(lm.seed);
  const out = [];
  const put = (dx, dy, dz, id) => out.push([dx, dy, dz, id]);
  const rot = (a, b) => (lm.ang & 1 ? [b, a] : [a, b]);
  const sgn = lm.ang & 2 ? -1 : 1;
  if (lm.kind === 'tree') {
    // A trunk two thick, lying along the ground, roots up at one end,
    // a crown of branches and leaves at the other; moss along its back.
    const L = 18 + Math.floor(rand() * 6);
    for (let i = -2; i < L; i++) {
      for (let t = 0; t < 2; t++) for (let up = 0; up < 2; up++) {
        const [dx, dz] = rot(i * sgn, t);
        put(dx, up, dz, B.log_oak);
      }
      if (rand() < 0.45) {
        const [dx, dz] = rot(i * sgn, rand() < 0.5 ? 0 : 1);
        put(dx, 2, dz, B.moss);
      }
    }
    // The root plate.
    for (let a = -3; a <= 4; a++) for (let up = 0; up < 5; up++) {
      if (Math.abs(a - 0.5) + Math.abs(up - 2) > 4 || rand() < 0.2) continue;
      const [dx, dz] = rot(-3 * sgn, a);
      put(dx, up, dz, rand() < 0.6 ? B.dirt : B.log_oak);
    }
    // The crown.
    for (let i = L; i < L + 7; i++) for (let a = -4; a <= 5; a++) for (let up = 0; up < 3; up++) {
      if (Math.abs(a - 0.5) + up * 1.3 + (i - L) * 0.4 > 5.2 || rand() < 0.3) continue;
      const [dx, dz] = rot(i * sgn, a);
      put(dx, up, dz, rand() < 0.15 ? B.log_oak : B.leaves_oak);
    }
  } else if (lm.kind === 'bones') {
    // A spine along the ground, ribs arching up either side, the skull.
    const L = 14 + Math.floor(rand() * 5);
    for (let i = 0; i < L; i++) {
      const [sx, sz] = rot(i * sgn, 0);
      put(sx, 0, sz, B.whale_rib);
      if (i % 2 === 0 && i > 1 && i < L - 2) {
        const tall = i > 3 && i < L - 4 ? 3 : 2;
        for (const side of [-1, 1]) for (let up = 0; up < tall; up++) {
          const [dx, dz] = rot(i * sgn, side * (up < tall - 1 ? 2 : 1));
          put(dx, up, dz, B.whale_rib);
        }
      }
    }
    const [hx, hz] = rot((L + 1) * sgn, 0);
    put(hx, 0, hz, B.skull_pile);
    const [h2x, h2z] = rot((L + 1) * sgn, 1);
    put(h2x, 0, h2z, B.whale_rib);
  } else if (lm.kind === 'crater') {
    // The star-stone, half sunk at the bottom.
    put(0, 0, 0, B.obsidian);
    put(1, 0, 0, B.obsidian);
    put(0, 0, 1, B.obsidian);
    put(0, 1, 0, B.obsidian);
  } else if (lm.kind === 'arch') {
    // Two legs and a span over the top, weathered (a block gone here and
    // there, moss in the cracks).
    const span = 5 + Math.floor(rand() * 3);
    const H = 5;
    for (const leg of [-span, span]) for (let up = 0; up < H; up++) for (let t = 0; t < 2; t++) {
      const [dx, dz] = rot(leg + (leg < 0 ? -1 : 1) * (t === 1 && up < 2 ? 1 : 0), t);
      put(dx, up, dz, up === 0 || rand() < 0.75 ? B.stone : B.cobblestone);
    }
    for (let a = -span; a <= span; a++) for (let t = 0; t < 2; t++) {
      const dip = Math.abs(a) < span - 1 ? 0 : -1;
      if (rand() < 0.06) continue;
      const [dx, dz] = rot(a, t);
      put(dx, H + dip, dz, rand() < 0.12 ? B.moss : B.stone);
      if (Math.abs(a) < span - 2 && rand() < 0.5) put(dx, H + 1, dz, B.stone);
    }
  } else if (lm.kind === 'spring') {
    // Steam vents round its edge.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand();
      put(Math.round(Math.cos(a) * (lm.r - 0.6)), 0, Math.round(Math.sin(a) * (lm.r - 0.6)), B.steam_vent);
    }
  }
  return out;
}

// A landmark's cache (its secret), where it's buried: { x, y, z } (y the
// ground's own layer there), or null.
export function cacheSpot(lm, groundY) {
  if (!lm.secret) return null;
  return { x: lm.x + lm.secret.dx * 2, y: Math.max(1, Math.min(WORLD_Y - 2, groundY)), z: lm.z + lm.secret.dz * 2 };
}
