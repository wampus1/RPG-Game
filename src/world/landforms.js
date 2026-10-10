// (Round 79) The lie of the land, over and above its biome (in worlds
// made since: world gen 7, see worldgen.WORLD_GEN):
//   - Landforms, one now and then in a stretch of country, whatever grows
//     there: a mesa, stepped in terraces (banded rock in the hot lands); a
//     canyon cut through raised ground with a stream in its bed, and
//     falls pouring in over its rim; an escarpment, a long cliff with
//     boulders at its foot; sinkholes, some with water in; stone pillars;
//     dunes, in the sandy lands; a glacial valley in the cold ones, flat-
//     floored and steep-sided, with moraine ridges, scattered boulders and
//     meltwater falls; a volcanic cone, far from the mountain on Kharos.
//   - Rivers with character (see riverCharacter): braided stretches of
//     gravel bars and channels, rapids with rocks in the stream, frozen
//     over in the cold, a delta of channels where one meets the sea, and
//     oxbow lakes cut off beside a bend.
//   - Biome edges blended: where two kinds of land meet, a few paces of
//     one dappled into the other (see blendBiome), not a line.
//   - Landmarks: rare, block-built, named on the map (see landmarks.js).
// Everything here is worked out from the world's seed, the same every
// time, a stretch at a time (and kept: see Landforms.near).
import { SURFACE, WATER_Y, WORLD_Y } from '../config.js';
import { hash4, hashf, clamp, smoothstep } from '../util/rng.js';
import { makeNoise2D } from '../util/noise.js';
import { B } from './blocks.js';
import { BIOMES } from './biomes.js';

export const LANDFORM_WG = 7;
const MAX_H = WORLD_Y - 3;
// A landform's stretch of country (tiles), and how likely one is there.
const LF = 176;
const LF_CHANCE = 0.42;
const SANDY = new Set(['desert', 'beach', 'savanna', 'red_mesa', 'salt_flats', 'bone_strand']);
const NO_FORM = new Set(['ocean', 'beach', 'volcano', 'mountain']);

export const LANDFORM_NAMES = { mesa: 'a mesa', canyon: 'a canyon', escarpment: 'an escarpment', sinkholes: 'sinkholes', pillars: 'stone pillars', dunes: 'dunes', glacial: 'a glacial valley', cone: 'a volcanic cone' };

export class Landforms {
  constructor(ow) {
    this.ow = ow;
    const s = ow.seed;
    this.nEdge = makeNoise2D(hash4(s, 0x7a11));
    this.nDune = makeNoise2D(hash4(s, 0x7a12));
    this.nBar = makeNoise2D(hash4(s, 0x7a13));
    this.nDelta = makeNoise2D(hash4(s, 0x7a14));
    this.nBlend = makeNoise2D(hash4(s, 0x7a15));
    this.cells = new Map();
    this._bi = {};
  }

  // The landform of stretch (cx, cz), or null (made once, kept).
  formOf(cx, cz) {
    const k = cx * 100003 + cz;
    if (this.cells.has(k)) return this.cells.get(k);
    const f = this.makeForm(cx, cz);
    this.cells.set(k, f);
    return f;
  }

  makeForm(cx, cz) {
    const ow = this.ow;
    const s = ow.seed;
    if (hashf(cx, cz, s, 0x1f0) >= LF_CHANCE) return null;
    const x = Math.round((cx + 0.25 + hashf(cx, cz, s, 0x1f1) * 0.5) * LF);
    const z = Math.round((cz + 0.25 + hashf(cx, cz, s, 0x1f2) * 0.5) * LF);
    if (ow.continentAt(x, z) < 0.12) return null;
    const bi = ow.biomeAt(x, z, this._bi);
    if (NO_FORM.has(bi.biome)) return null;
    const B0 = BIOMES[bi.biome];
    if (!B0) return null;
    const climate = B0.climate;
    // (Not on the mountain of fire's island, near the mountain itself.)
    const V = ow.volcano;
    const nearV = V && Math.hypot(x - V.x, z - V.z) < V.r * 3;
    const pool = [];
    const add = (t, w) => pool.push([t, w]);
    if (SANDY.has(bi.biome)) {
      add('dunes', 5);
      add('mesa', 3);
      add('pillars', 2);
      add('canyon', 2);
    } else if (climate === 'cold') {
      add('glacial', 5);
      add('escarpment', 2);
      add('pillars', 1);
      add('sinkholes', 1);
    } else if (climate === 'hot') {
      add('escarpment', 2);
      add('pillars', 2);
      add('sinkholes', 1);
    } else {
      add('mesa', 2);
      add('canyon', 3);
      add('escarpment', 3);
      add('sinkholes', 2);
      add('pillars', 2);
    }
    if (!nearV && climate !== 'cold') add('cone', 1);
    let tot = 0;
    for (const [, w] of pool) tot += w;
    let r = hashf(cx, cz, s, 0x1f3) * tot;
    let type = pool[0][0];
    for (const [t, w] of pool) if ((r -= w) <= 0) {
      type = t;
      break;
    }
    const size = { mesa: [26, 46], canyon: [60, 84], escarpment: [56, 80], sinkholes: [20, 32], pillars: [18, 30], dunes: [48, 70], glacial: [58, 82], cone: [16, 26] }[type];
    const rad = size[0] + hashf(cx, cz, s, 0x1f4) * (size[1] - size[0]);
    // (Kept off the towns: they want flat ground.)
    for (const st of ow.settlements) {
      const b = st.bounds;
      if (!b) continue;
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dz = Math.max(b.z0 - z, 0, z - b.z1);
      if (Math.hypot(dx, dz) < rad + 30) return null;
    }
    const ang = hashf(cx, cz, s, 0x1f5) * Math.PI;
    return { type, x, z, r: rad, ang, ca: Math.cos(ang), sa: Math.sin(ang), seed: hash4(s, cx, cz, 0x1f6), hot: climate === 'hot' || climate === 'warm', cold: climate === 'cold', lava: hashf(cx, cz, s, 0x1f7) < 0.3 };
  }

  // The landforms that may reach (x, z).
  near(x, z) {
    const cx = Math.floor(x / LF);
    const cz = Math.floor(z / LF);
    const out = [];
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const f = this.formOf(cx + ox, cz + oz);
      if (f && Math.abs(f.x - x) < f.r * 1.9 + 24 && Math.abs(f.z - z) < f.r * 1.9 + 24) out.push(f);
    }
    return out;
  }

  // The land at (x, z) as the landforms shape it: `out` (a terrain
  // column: see terrain.js) changed in place; `h` the height so far.
  // Returns the new height.
  shape(x, z, out, h) {
    for (const f of this.near(x, z)) h = FORMS[f.type](this, f, x, z, out, h);
    return clamp(h, 1, MAX_H);
  }

  // (Round 79) Where two kinds of land meet: a few paces of the one
  // dappled into the other. The biome to use at (x, z).
  blendBiome(x, z, bi) {
    if (bi.edge >= 7 || bi.biome2 === bi.biome) return bi.biome;
    if (NO_FORM.has(bi.biome) || NO_FORM.has(bi.biome2) || !BIOMES[bi.biome2]) return bi.biome;
    const k = (1 - bi.edge / 7) * 0.5;
    const n = this.nBlend(x / 3.2, z / 3.2) * 0.35 + (hashf(x, z, this.ow.seed, 0x1e8) - 0.5) * 0.5;
    return n + 0.5 < k ? bi.biome2 : bi.biome;
  }
}

// ------------------------------------------------------------ each landform
// Along and across a landform's line: s (along), p (across).
function axes(f, x, z) {
  const dx = x - f.x;
  const dz = z - f.z;
  return { s: dx * f.ca + dz * f.sa, p: -dx * f.sa + dz * f.ca, d: Math.hypot(dx, dz) };
}
const banded = (out, f) => {
  if (f.hot) out.band = true;
};

const FORMS = {
  mesa(L, f, x, z, out, h) {
    const { d } = axes(f, x, z);
    const a = Math.atan2(z - f.z, x - f.x);
    const v = (d / f.r) * (1 + 0.16 * L.nEdge(Math.cos(a) * 2 + f.seed % 97, Math.sin(a) * 2) + 0.06 * L.nEdge(x / 7, z / 7));
    if (v >= 1) return h;
    const top = SURFACE + 7;
    const lift = v < 0.56 ? top : v < 0.7 ? top - 2 : v < 0.83 ? top - 4 : SURFACE + 1;
    banded(out, f);
    out.fsub = B.stone;
    out.form = 'mesa';
    return Math.max(h, lift);
  },
  canyon(L, f, x, z, out, h) {
    const { s, p } = axes(f, x, z);
    const half = f.r * 1.3;
    if (Math.abs(s) > half + 10 || Math.abs(p) > 44) return h;
    const end = smoothstep(0, 22, half + 10 - Math.abs(s));
    const off = Math.sin(s / 23 + (f.seed % 13)) * 6 + Math.sin(s / 9) * 2;
    const q = Math.abs(p - off);
    const w = 3 + 1.4 * Math.sin(s / 17 + 1);
    const plateau = SURFACE + Math.round(4 * end * (1 - smoothstep(24, 40, q)));
    if (plateau <= SURFACE) return h;
    banded(out, f);
    out.fsub = B.stone;
    out.form = 'canyon';
    // (Falls, here and there: a stream on the rim pours over into the bed.)
    const fallAt = [half * 0.42, -half * 0.36];
    for (const sf of fallAt) {
      if (Math.abs(s - sf) > 1.1 || end < 0.6) continue;
      const side = p - off > 0 ? 1 : -1;
      if (side !== (f.seed & 1 ? 1 : -1)) continue;
      if (q >= w && q < w + 2.2) {
        out.fall = plateau;
        return WATER_Y - 1;
      }
      if (q >= w + 2.2 && q < w + 12) {
        out.stream = plateau;
        return plateau - 1;
      }
    }
    if (q < w && end > 0.35) {
      out.canyonWater = true;
      return WATER_Y - 1;
    }
    if (q < w + 1.6) return Math.max(h, SURFACE + 1);
    return Math.max(h, plateau);
  },
  escarpment(L, f, x, z, out, h) {
    const { s, p } = axes(f, x, z);
    const half = f.r * 1.5;
    if (Math.abs(s) > half || Math.abs(p) > 30) return h;
    const end = smoothstep(0, 26, half - Math.abs(s));
    const wob = L.nEdge(s / 24 + (f.seed % 31), 3.3) * 4;
    const pp = p - wob;
    if (pp < -3) {
      // (Boulders fallen at its foot.)
      if (pp > -9 && end > 0.4 && hashf(x, z, f.seed, 7) < 0.05) out.boulder = true;
      return h;
    }
    const rise = Math.round(4 * end * (pp < 0 ? 0 : 1) * (1 - smoothstep(18, 30, pp)));
    if (rise <= 0) return h;
    out.fsub = B.stone;
    out.form = 'escarpment';
    return Math.max(h, SURFACE + rise);
  },
  sinkholes(L, f, x, z, out, h) {
    const n = 3 + (f.seed % 4);
    for (let i = 0; i < n; i++) {
      const a = hashf(i, 1, f.seed, 3) * Math.PI * 2;
      const rr = hashf(i, 2, f.seed, 3) * f.r * 0.85;
      const px = f.x + Math.cos(a) * rr;
      const pz = f.z + Math.sin(a) * rr;
      const pr = 2 + hashf(i, 3, f.seed, 3) * 2.5;
      const d = Math.hypot(x - px, z - pz);
      if (d < pr) {
        out.form = 'sinkhole';
        out.fsub = B.stone;
        if (hashf(i, 4, f.seed, 3) < 0.5) out.pool = SURFACE - 1;
        out.fsurf = B.gravel;
        return 2;
      }
      if (d < pr + 1.2) out.fsurf = B.gravel;
    }
    return h;
  },
  pillars(L, f, x, z, out, h) {
    const n = 5 + (f.seed % 6);
    for (let i = 0; i < n; i++) {
      const a = hashf(i, 1, f.seed, 5) * Math.PI * 2;
      const rr = Math.sqrt(hashf(i, 2, f.seed, 5)) * f.r;
      const px = Math.round(f.x + Math.cos(a) * rr);
      const pz = Math.round(f.z + Math.sin(a) * rr);
      const pr = hashf(i, 3, f.seed, 5) < 0.4 ? 1.6 : 1.1;
      if (Math.hypot(x - px, z - pz) <= pr) {
        out.form = 'pillar';
        out.fsub = B.stone;
        out.fsurf = hashf(i, 5, f.seed, 5) < 0.5 ? B.moss : B.stone;
        if (f.hot) {
          out.band = true;
          out.fsurf = B.sandstone;
        }
        return Math.max(h, SURFACE + 4 + Math.floor(hashf(i, 4, f.seed, 5) * 5));
      }
    }
    return h;
  },
  dunes(L, f, x, z, out, h) {
    const { s, d } = axes(f, x, z);
    if (d > f.r * 1.2) return h;
    const fade = 1 - smoothstep(f.r * 0.7, f.r * 1.2, d);
    const u = s / 9 + L.nDune(x / 30, z / 30) * 2.2;
    const lift = Math.round(Math.max(0, Math.sin(u)) * 2.6 * fade);
    if (lift <= 0) return h;
    out.fsurf = B.sand;
    out.form = 'dunes';
    return Math.max(h, SURFACE + lift);
  },
  glacial(L, f, x, z, out, h) {
    const { s, p } = axes(f, x, z);
    const half = f.r * 1.4;
    if (Math.abs(s) > half + 8 || Math.abs(p) > 44) return h;
    const end = smoothstep(0, 24, half + 8 - Math.abs(s));
    const off = Math.sin(s / 41 + (f.seed % 7)) * 7;
    const q = Math.abs(p - off);
    const W = 11 + 2 * Math.sin(s / 29);
    out.form = 'glacial';
    out.fsub = B.stone;
    if (q < W) {
      // The floor: flat, gravel here and there, boulders strewn, a stream
      // of meltwater down the middle; moraine ridges along its sides.
      if (q < 1.1 && end > 0.4) {
        out.canyonWater = true;
        return WATER_Y - 1;
      }
      if (q > W - 2 && q < W - 0.6) {
        out.fsurf = B.gravel;
        return SURFACE + 1;
      }
      if (L.nEdge(x / 6, z / 6) > 0.35) out.fsurf = B.gravel;
      if (hashf(x, z, f.seed, 11) < 0.022) out.boulder = true;
      return SURFACE;
    }
    const wall = SURFACE + Math.round(5 * end * smoothstep(W, W + 5, q) * (1 - smoothstep(W + 22, W + 36, q)));
    // (Meltwater falls down the walls, here and there.)
    for (const sf of [half * 0.3, -half * 0.5]) {
      if (Math.abs(s - sf) > 1.1 || end < 0.6 || wall <= SURFACE + 2) continue;
      if (q >= W && q < W + 5) {
        out.fall = wall;
        return WATER_Y - 1;
      }
      if (q >= W + 5 && q < W + 12) {
        out.stream = wall;
        return wall - 1;
      }
    }
    return Math.max(h, wall);
  },
  cone(L, f, x, z, out, h) {
    const { d } = axes(f, x, z);
    const v = d / f.r;
    if (v >= 1.15) return h;
    out.form = 'cone';
    out.fsub = B.stone;
    const top = SURFACE + 7;
    if (v < 0.22) {
      out.fsurf = B.basalt;
      if (f.lava && v < 0.15) out.coneLava = top - 1;
      else if (v < 0.15) out.fsurf = B.obsidian;
      return top - 2;
    }
    const cone = Math.pow(clamp((1 - v) / 0.78, 0, 1), 0.9);
    out.fsurf = v < 0.7 ? B.basalt : hashf(x, z, f.seed, 3) < 0.6 ? B.ash : out.fsurf;
    return Math.max(h, SURFACE + Math.round(cone * 7));
  },
};

// ------------------------------------------------------------ rivers with character
// What a river's like in each stretch (a chunk of its points): calm,
// braided, rapids; frozen in the cold; and where it meets the sea, a
// delta; an oxbow lake beside some bends.
export function chunkCharacter(seed, rid, ci, n) {
  const r = hashf(rid, ci, seed, 0x2c0);
  const middle = ci > 0 && ci < n - 1;
  return { braided: middle && r < 0.18, rapids: middle && r >= 0.18 && r < 0.34, oxbow: hashf(rid, ci, seed, 0x2c1) < 0.3 && ci < n - 1 };
}

// An oxbow lake by chunk `ch`: a crescent off to one side of its middle.
export function oxbowOf(seed, rid, ci, pts) {
  const i = Math.floor(pts.length / 2);
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  let tx = b.x - a.x;
  let tz = b.z - a.z;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  const side = hashf(rid, ci, seed, 0x2c2) < 0.5 ? 1 : -1;
  const R = 6 + hashf(rid, ci, seed, 0x2c3) * 3;
  const off = (pts[i].hw || 2) + R + 4;
  return { x: pts[i].x - tz * off * side, z: pts[i].z + tx * off * side, R, nx: tz * side, nz: -tx * side };
}

// Is (x, z) in oxbow `o` (a half ring, the side away from the river)?
export function inOxbow(o, x, z) {
  const dx = x - o.x;
  const dz = z - o.z;
  const d = Math.hypot(dx, dz);
  if (Math.abs(d - o.R) > 1.3) return false;
  return dx * o.nx + dz * o.nz < o.R * 0.35;
}

export { LF as LANDFORM_SIZE };
