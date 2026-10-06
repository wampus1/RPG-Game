// Terrain column sampling: turns the continuous overworld fields into a
// concrete column (surface height, water, surface/sub blocks) at any tile.
import { SURFACE, WATER_Y, WORLD_Y } from '../config.js';
import { hash4, clamp, smoothstep, lerp } from '../util/rng.js';
import { makeNoise2D, fbm, ridged } from '../util/noise.js';
import { B } from './blocks.js';
import { BIOMES } from './biomes.js';

// (What each biome's banks, beds and snow are: its own climate, bank and
// bed, see biomes.js. Kharos's fire biomes are 'hot': no snow on them,
// black sand on their banks.)
const MAX_H = WORLD_Y - 3;

export class Terrain {
  constructor(ow) {
    this.ow = ow;
    const s = ow.seed;
    this.nHill = makeNoise2D(hash4(s, 21));
    this.nMount = makeNoise2D(hash4(s, 22));
    this.nPatch = makeNoise2D(hash4(s, 23));
    this.nPool = makeNoise2D(hash4(s, 24));
    this.nBed = makeNoise2D(hash4(s, 25));
    this.nClump = makeNoise2D(hash4(s, 26));
    this._bi = {};
  }

  context(x0, z0, x1, z1) {
    const wf = this.ow.waterFeaturesIn(x0, z0, x1, z1, 12);
    const setts = [];
    for (const s of this.ow.settlements) {
      const b = s.bounds;
      if (b.x1 + 12 < x0 || b.x0 - 12 > x1 || b.z1 + 12 < z0 || b.z0 - 12 > z1) continue;
      setts.push(s);
    }
    return { segs: wf.segs, lakes: wf.lakes, setts };
  }

  riverDist(x, z, segs) {
    let best = Infinity;
    let bestD = Infinity;
    let bestHw = 0;
    for (const pts of segs) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const l2 = vx * vx + vz * vz || 1;
        let t = ((x - a.x) * vx + (z - a.z) * vz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = a.x + vx * t - x;
        const pz = a.z + vz * t - z;
        const d = Math.sqrt(px * px + pz * pz);
        const hw = a.hw + (b.hw - a.hw) * t;
        if (d - hw < best) {
          best = d - hw;
          bestD = d;
          bestHw = hw;
        }
      }
    }
    return { d: bestD, hw: bestHw, rel: best };
  }

  lakeValue(x, z, lakes) {
    let best = Infinity;
    for (const l of lakes) {
      const dx = x - l.x;
      const dz = z - l.z;
      const r = l.r * (1 + 0.32 * l.noise(x / 9, z / 9) + 0.15 * l.noise(x / 3.5, z / 3.5));
      const v = Math.sqrt(dx * dx + dz * dz) / r;
      if (v < best) best = v;
    }
    return best;
  }

  column(x, z, ctx, out = {}) {
    const ow = this.ow;
    const c = ow.continentAt(x, z);
    out.x = x;
    out.z = z;
    out.water = -1;
    out.sett = null;
    out.flat = 0;
    out.wet = 99;
    out.deep = false;
    out.lava = false;
    out.hot = false;
    out.cooled = null;

    // --- settlement flattening weight
    for (const s of ctx.setts) {
      const b = s.bounds;
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dz = Math.max(b.z0 - z, 0, z - b.z1);
      const d = Math.sqrt(dx * dx + dz * dz);
      const w = 1 - smoothstep(0, 8, d);
      if (w > out.flat) {
        out.flat = w;
        if (d === 0) out.sett = s;
      }
    }

    if (c < 0) {
      out.biome = 'ocean';
      const depth = clamp(1 + Math.floor(-c * 28), 1, 3);
      out.h = WATER_Y - depth;
      out.water = WATER_Y;
      out.deep = depth > 1;
      out.surf = this.nBed(x / 8, z / 8) > 0.4 ? B.gravel : B.sand;
      out.sub = B.sand;
      out.wet = 0;
      return out;
    }

    const bi = ow.biomeAt(x, z, this._bi);
    let biome = bi.biome;
    const bdef = BIOMES[biome];
    const b2 = BIOMES[bi.biome2];
    const t = smoothstep(0, 14, bi.edge);
    const amp = lerp((bdef.hills + b2.hills) / 2, bdef.hills, t);
    const hn = fbm(this.nHill, x / 46, z / 46, 3) * 0.5 + 0.5;
    let h = SURFACE + Math.floor(hn * (amp + 0.999));
    let mountainH = 0;
    // The mountain on Kharos: a cone up to a crater full of lava, with old
    // flows down its sides (fresh ones after it's erupted: see volcano.js).
    let lava = false;
    let lavaTop = -1;
    const V = ow.volcano;
    const vd = V ? Math.hypot(x - V.x, (z - V.z) * V.squash) / V.r : 9;
    if (biome === 'volcano' && vd < 1) {
      if (vd < V.crater) {
        h = SURFACE + 4 + (vd > V.crater * 0.8 ? 2 : 0);
        if (vd < V.crater * 0.8) {
          lava = true;
          lavaTop = SURFACE + 5;
        }
      } else {
        const cone = Math.pow(clamp((1 - vd) / (1 - V.crater * 1.3), 0, 1), 0.85);
        h = Math.max(h, SURFACE + Math.floor(cone * 8.4 + hn * 0.8));
      }
    }
    // (Its flows run on down onto the ashlands round its foot.)
    if (V && vd >= V.crater && vd < 1.7 && !lava && out.flat === 0) {
      const flow = ow.lavaAt(x, z, vd);
      if (flow === 'lava') {
        lava = true;
        lavaTop = h;
        h -= 1;
      } else if (flow) out.cooled = flow;
    }
    if (biome === 'mountain') {
      const m = smoothstep(0, 42, bi.edge);
      const rn = ridged(this.nMount, x / 64, z / 64, 4);
      mountainH = Math.floor(m * (0.3 + 0.7 * rn) * 9.5);
      h = Math.max(h, SURFACE + mountainH);
    }
    // Coasts slope down to sea level.
    if (c < 0.1) h = Math.min(h, SURFACE + Math.floor(Math.max(0, c - 0.03) / 0.07 * 2));
    const beach = c < 0.035;
    if (beach && biome !== 'mountain') biome = 'beach';

    // --- rivers & lakes
    let water = false;
    let depth = 0;
    let bank = false;
    if (ctx.segs.length) {
      const r = this.riverDist(x, z, ctx.segs);
      if (r.rel < 0) {
        water = true;
        depth = r.d < r.hw * 0.55 && r.hw > 1.3 ? 2 : 1;
      } else {
        out.wet = Math.min(out.wet, r.rel);
        if (r.rel < 5) h = Math.min(h, SURFACE + Math.floor(r.rel / 2));
        if (r.rel < 0.9) bank = true;
      }
    }
    if (!water && ctx.lakes.length) {
      const lv = this.lakeValue(x, z, ctx.lakes);
      if (lv < 1) {
        water = true;
        depth = Math.max(depth, lv < 0.45 ? 3 : lv < 0.75 ? 2 : 1);
      } else {
        out.wet = Math.min(out.wet, (lv - 1) * 8);
        if (lv < 1.5) h = Math.min(h, SURFACE + Math.floor((lv - 1) * 6));
        if (lv < 1.09) bank = true;
      }
    }
    if (lava && !water) {
      h = clamp(h, 1, MAX_H);
      out.biome = biome;
      out.h = h;
      out.water = Math.min(lavaTop, MAX_H);
      out.lava = true;
      out.wet = 99;
      out.surf = B.basalt;
      out.sub = B.basalt;
      return out;
    }
    const lowFlat = out.flat < 0.4;
    if (!water && lowFlat && h === SURFACE) {
      if (bdef.pools) {
        const pn = this.nPool(x / 10, z / 10) + this.nPool(x / 4, z / 4) * 0.25;
        if (pn > 0.18) {
          water = true;
          depth = pn > 0.5 ? 2 : 1;
        } else out.wet = Math.min(out.wet, (0.18 - pn) * 10);
      } else if (bdef.ponds) {
        const pn = this.nPool(x / 13 + 400, z / 13) + this.nPool(x / 5, z / 5 + 400) * 0.2;
        if (pn > 0.78) {
          water = true;
          depth = pn > 0.86 ? 2 : 1;
        } else if (pn > 0.7) out.wet = Math.min(out.wet, (0.78 - pn) * 20);
      }
    }

    // --- settlement flattening (water features inside towns are kept)
    if (out.flat > 0 && !water) h = Math.round(lerp(h, SURFACE, out.flat));
    h = clamp(h, 1, MAX_H);

    out.biome = biome;
    if (water) {
      out.h = WATER_Y - depth;
      out.water = WATER_Y;
      out.deep = depth > 1;
      out.wet = 0;
      const bn = this.nBed(x / 6, z / 6);
      const bw = BIOMES[biome];
      out.surf = bw.bed === 'mud' ? B.mud : bw.climate === 'hot' ? (bn > 0 ? B.basalt : B.cinder) : bn > 0.45 ? B.gravel : bn < -0.5 ? B.clay : B.sand;
      out.sub = B.dirt;
      // (A hot spring: it steams.)
      if (bdef.hot) out.hot = true;
      return out;
    }

    out.h = h;
    let surf = bdef.surface;
    let sub = bdef.sub;
    if (bdef.patches) {
      for (let i = 0; i < bdef.patches.length; i++) {
        const [blk, scale, thr] = bdef.patches[i];
        const v = this.nPatch(x / scale + i * 57.3, z / scale - i * 31.7) * 0.5 + 0.5;
        if (v > thr) {
          surf = blk;
          break;
        }
      }
    }
    if (biome === 'mountain') {
      if (mountainH <= 1 && h <= SURFACE + 1) surf = BIOMES[bi.biome2].surface === B.sand ? B.sand : B.grass_taiga;
      sub = B.stone;
    }
    const bh = BIOMES[biome];
    if (bank && bh.bank !== undefined) surf = bh.bank;
    // A flow that's cooled: black rock, glassy where it cooled fastest.
    if (out.cooled) surf = out.cooled === 'glass' ? B.obsidian : B.basalt;
    // Snow caps: patchy on the upper slopes, solid on the peaks (but never
    // on the fire island's hot ground).
    const snowN = this.nPatch(x / 9 + 700, z / 9) * 0.5 + 0.5;
    if (bh.climate !== 'hot' && (h >= SURFACE + 8 || (h >= SURFACE + 6 && snowN > 0.35) || (h >= SURFACE + 4 && bh.climate === 'cold' && snowN > 0.3))) surf = B.snow;
    if (surf === B.ice) sub = B.dirt;
    out.surf = surf;
    out.sub = sub;
    return out;
  }

  // Forest clumping factor used for tree density.
  clump(x, z, amount) {
    if (!amount) return 1;
    return clamp(1 + amount * 2.2 * this.nClump(x / 22, z / 22), 0.15, 2.2);
  }
}
