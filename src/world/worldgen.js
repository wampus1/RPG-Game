// Overworld generation: the world map. Biomes are splotches (stretched,
// rotated ellipses) evaluated with a domain-warped distance field, so they can
// be sampled continuously at tile resolution and on the coarse map alike.
import {
  MAP_W, MAP_H, REGION_W, REGION_D, WORLD_TILES_W, WORLD_TILES_D,
} from '../config.js';
import { RNG, hash4, clamp, smoothstep } from '../util/rng.js';
import { makeNoise2D, fbm } from '../util/noise.js';
import { BIOMES, BIOME_STYLE } from './biomes.js';
import { placeName, CIV_TITLES, CULTURES } from './names.js';

const SPLOTCH_STEP_X = 150;
const SPLOTCH_STEP_Z = 96;

export const CIV_COLORS = [
  { name: 'Crimson', hex: '#c8323c', awning: 'awning_red', rug: 'rug_red' },
  { name: 'Azure', hex: '#2f6fd0', awning: 'awning_blue', rug: 'rug_blue' },
  { name: 'Verdant', hex: '#3c9a48', awning: 'awning_green', rug: 'rug_green' },
  { name: 'Gilded', hex: '#e0b030', awning: 'awning_yellow', rug: 'rug_red' },
  { name: 'Violet', hex: '#8a4ab8', awning: 'awning_blue', rug: 'rug_blue' },
];
const VALUES = ['martial', 'mercantile', 'pious', 'scholarly', 'agrarian', 'seafaring', 'artisan'];

export class Overworld {
  constructor(seed) {
    this.seed = seed >>> 0;
    const s = this.seed;
    this.nWarpX = makeNoise2D(hash4(s, 11));
    this.nWarpZ = makeNoise2D(hash4(s, 12));
    this.nFine = makeNoise2D(hash4(s, 13));
    this.nCont = makeNoise2D(hash4(s, 14));
    this.nClimate = makeNoise2D(hash4(s, 15));
    this.rng = new RNG(hash4(s, 99));
    this.genSplotches();
    this.genCells();
    this.genRivers();
    this.genLakes();
    this.genCivsAndSettlements();
    this.explored = new Uint8Array(MAP_W * MAP_H);
  }

  // ---------------------------------------------------------------- continent
  continentAt(x, z) {
    const nx = (x / WORLD_TILES_W) * 2 - 1;
    const nz = (z / WORLD_TILES_D) * 2 - 1;
    const d = Math.cbrt(Math.abs(nx) ** 3 + Math.abs(nz) ** 3);
    return (
      0.88 - d +
      fbm(this.nCont, x / 380, z / 380, 4) * 0.42 +
      fbm(this.nCont, x / 55 + 300, z / 55, 2) * 0.05
    );
  }

  // ---------------------------------------------------------------- biomes
  genSplotches() {
    const rng = this.rng.fork('splotch');
    const gw = Math.ceil(WORLD_TILES_W / SPLOTCH_STEP_X) + 1;
    const gd = Math.ceil(WORLD_TILES_D / SPLOTCH_STEP_Z) + 1;
    this.sgW = gw;
    this.sgD = gd;
    this.splotchGrid = new Array(gw * gd);
    this.splotches = [];
    for (let gz = 0; gz < gd; gz++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = (gx + 0.5 + rng.float(-0.42, 0.42)) * SPLOTCH_STEP_X - SPLOTCH_STEP_X / 2;
        const z = (gz + 0.5 + rng.float(-0.42, 0.42)) * SPLOTCH_STEP_Z - SPLOTCH_STEP_Z / 2;
        const temp = clamp(z / WORLD_TILES_D + this.nClimate(x / 500, z / 500) * 0.18 + rng.float(-0.08, 0.08), 0, 1);
        const moist = clamp(rng.float(0, 1) * 0.7 + (this.nClimate(x / 300 + 50, z / 300) * 0.5 + 0.5) * 0.3, 0, 1);
        let biome;
        if (rng.chance(0.16)) biome = 'mountain';
        else if (temp < 0.2) biome = moist < 0.45 ? 'tundra' : 'taiga';
        else if (temp < 0.36) biome = moist > 0.48 ? 'taiga' : moist < 0.24 ? 'plains' : 'forest';
        else if (temp < 0.64) {
          if (moist < 0.46) biome = 'plains';
          else if (moist > 0.8) biome = 'swamp';
          else biome = 'forest';
        } else if (moist < 0.42) biome = 'desert';
        else if (moist < 0.64) biome = 'savanna';
        else if (moist > 0.88) biome = 'swamp';
        else biome = 'jungle';
        // Stretch while keeping area roughly constant; mountains form long ranges.
        const s = biome === 'mountain' ? rng.float(1.6, 2.6) : rng.float(0.6, 1.7);
        const sp = {
          i: this.splotches.length,
          x, z, biome,
          sx: s,
          sz: 1 / s,
          ang: rng.float(0, Math.PI),
          w: biome === 'mountain' ? rng.float(0.75, 0.95) : rng.float(0.85, 1.2),
        };
        sp.cos = Math.cos(sp.ang);
        sp.sin = Math.sin(sp.ang);
        this.splotches.push(sp);
        this.splotchGrid[gz * gw + gx] = sp;
      }
    }
  }

  // Returns the nearest splotch biome, the second nearest, and "edge": how far
  // (in approx. tiles) the point is from the border between them.
  biomeAt(x, z, out = {}) {
    const wx = x + this.nWarpX(x / 240, z / 240) * 70 + this.nFine(x / 26, z / 26) * 7;
    const wz = z + this.nWarpZ(x / 240, z / 240) * 55 + this.nFine(x / 26 + 90, z / 26) * 6;
    const gx = Math.floor((wx + SPLOTCH_STEP_X / 2) / SPLOTCH_STEP_X);
    const gz = Math.floor((wz + SPLOTCH_STEP_Z / 2) / SPLOTCH_STEP_Z);
    let d1 = Infinity;
    let d2 = Infinity;
    let s1 = null;
    let s2 = null;
    for (let oz = -2; oz <= 2; oz++) {
      const zz = gz + oz;
      if (zz < 0 || zz >= this.sgD) continue;
      for (let ox = -2; ox <= 2; ox++) {
        const xx = gx + ox;
        if (xx < 0 || xx >= this.sgW) continue;
        const sp = this.splotchGrid[zz * this.sgW + xx];
        const dx = wx - sp.x;
        const dz = wz - sp.z;
        const u = (dx * sp.cos + dz * sp.sin) / sp.sx;
        const v = (-dx * sp.sin + dz * sp.cos) / sp.sz;
        const d = Math.sqrt(u * u + v * v) / sp.w;
        if (d < d1) {
          d2 = d1;
          s2 = s1;
          d1 = d;
          s1 = sp;
        } else if (d < d2) {
          d2 = d;
          s2 = sp;
        }
      }
    }
    // Merge adjacent splotches of the same biome so their shared border
    // doesn't create an artificial edge.
    out.biome = s1.biome;
    out.biome2 = s2 ? s2.biome : s1.biome;
    out.edge = s2 && s2.biome !== s1.biome ? (d2 - d1) * 0.5 : 60;
    out.splotch = s1.i;
    return out;
  }

  // ---------------------------------------------------------------- map cells
  genCells() {
    this.cells = new Array(MAP_W * MAP_H);
    const tmp = {};
    for (let cz = 0; cz < MAP_H; cz++) {
      for (let cx = 0; cx < MAP_W; cx++) {
        const halves = [];
        for (const fx of [0.25, 0.75]) {
          const x = (cx + fx) * REGION_W;
          const z = (cz + 0.5) * REGION_D;
          const c = this.continentAt(x, z);
          if (c < 0) halves.push('ocean');
          else if (c < 0.03) halves.push('beach');
          else {
            this.biomeAt(x, z, tmp);
            halves.push(tmp.biome);
          }
        }
        const x = (cx + 0.5) * REGION_W;
        const z = (cz + 0.5) * REGION_D;
        const c = this.continentAt(x, z);
        this.biomeAt(x, z, tmp);
        const biome = c < 0 ? 'ocean' : c < 0.03 ? 'beach' : tmp.biome;
        const mountainness = tmp.biome === 'mountain' ? smoothstep(0, 45, tmp.edge) : 0;
        this.cells[cz * MAP_W + cx] = {
          cx, cz, biome, halves, cont: c, mountainness,
          elev: c < 0 ? -1 : c + mountainness * 1.5 + this.rng.float(0, 0.05),
          river: false, lake: false, settlement: null, civ: null, near: [],
        };
      }
    }
  }

  cell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H) return null;
    return this.cells[cz * MAP_W + cx];
  }

  // ---------------------------------------------------------------- rivers
  genRivers() {
    const rng = this.rng.fork('rivers');
    this.rivers = [];
    this.lakes = [];
    const land = this.cells.filter((c) => c.biome !== 'ocean' && c.biome !== 'beach');
    const sources = rng
      .shuffle(land.filter((c) => c.elev > 0.45 || c.mountainness > 0.25))
      .slice(0, 40);
    const riverCells = new Map(); // cell index -> river id
    const picked = [];
    for (const src of sources) {
      if (picked.length >= 11) break;
      if (picked.some((p) => Math.abs(p.cx - src.cx) + Math.abs(p.cz - src.cz) < 6)) continue;
      const path = [src];
      const seen = new Set([src.cz * MAP_W + src.cx]);
      let cur = src;
      let end = 'stuck';
      for (let steps = 0; steps < 60; steps++) {
        const opts = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.cell(cur.cx + dx, cur.cz + dz);
          if (!n) continue;
          const k = n.cz * MAP_W + n.cx;
          if (seen.has(k)) continue;
          opts.push({ n, k, e: n.elev + rng.float(0, 0.12) });
        }
        if (!opts.length) break;
        opts.sort((a, b) => a.e - b.e);
        const best = opts[0];
        if (best.n.elev > cur.elev + 0.1 && path.length > 3) break; // local minimum
        path.push(best.n);
        seen.add(best.k);
        cur = best.n;
        if (cur.biome === 'ocean') {
          end = 'ocean';
          break;
        }
        if (riverCells.has(best.k)) {
          end = 'merge';
          break;
        }
      }
      if (path.length < 5) continue;
      picked.push(src);
      const id = this.rivers.length;
      for (const c of path) {
        const k = c.cz * MAP_W + c.cx;
        if (!riverCells.has(k)) riverCells.set(k, id);
      }
      this.rivers.push(this.buildRiver(id, path, end, rng));
      if (end === 'stuck') {
        const last = path[path.length - 1];
        this.lakes.push({
          x: (last.cx + 0.5) * REGION_W,
          z: (last.cz + 0.5) * REGION_D,
          r: rng.float(9, 14),
          seed: rng.int(0, 1e9),
        });
      }
    }
  }

  buildRiver(id, path, end, rng) {
    const ctrl = path.map((c, i) => {
      const jx = i === 0 ? 0 : rng.float(-0.28, 0.28) * REGION_W;
      const jz = i === 0 ? 0 : rng.float(-0.28, 0.28) * REGION_D;
      return [(c.cx + 0.5) * REGION_W + jx, (c.cz + 0.5) * REGION_D + jz];
    });
    // Catmull-Rom through control points, then meander perpendicular.
    const pts = [];
    const meander = makeNoise2D(hash4(this.seed, 700 + id));
    let arc = 0;
    let prev = null;
    const total = ctrl.length - 1;
    for (let i = 0; i < total; i++) {
      const p0 = ctrl[Math.max(0, i - 1)];
      const p1 = ctrl[i];
      const p2 = ctrl[i + 1];
      const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const steps = Math.max(4, Math.ceil(segLen / 2.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const cr = (a, b, c, d) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = cr(p0[0], p1[0], p2[0], p3[0]);
        const z = cr(p0[1], p1[1], p2[1], p3[1]);
        if (prev) arc += Math.hypot(x - prev[0], z - prev[1]);
        prev = [x, z];
        const progress = (i + t) / total;
        pts.push({ x, z, arc, hw: 0.9 + progress * 2.1 });
      }
    }
    const last = ctrl[ctrl.length - 1];
    pts.push({ x: last[0], z: last[1], arc: arc + 1, hw: 3 });
    // Perpendicular meander.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const fade = Math.min(1, i / 6, (pts.length - 1 - i) / 6);
      const m = meander(pts[i].arc / 40, 0.5) * 9 * fade;
      pts[i].x += -tz * m;
      pts[i].z += tx * m;
    }
    // Chunk into bounding boxes for fast spatial queries.
    const chunks = [];
    for (let i = 0; i < pts.length - 1; i += 12) {
      const seg = pts.slice(i, Math.min(pts.length, i + 13));
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of seg) {
        x0 = Math.min(x0, p.x - p.hw);
        z0 = Math.min(z0, p.z - p.hw);
        x1 = Math.max(x1, p.x + p.hw);
        z1 = Math.max(z1, p.z + p.hw);
      }
      chunks.push({ pts: seg, x0, z0, x1, z1 });
    }
    // Mark map cells the river passes through.
    for (const p of pts) {
      const c = this.cell(Math.floor(p.x / REGION_W), Math.floor(p.z / REGION_D));
      if (c && c.biome !== 'ocean') c.river = true;
    }
    return { id, pts, chunks, end, name: null };
  }

  // Segments and lakes relevant to a tile rectangle (with margin).
  waterFeaturesIn(x0, z0, x1, z1, margin = 8) {
    const segs = [];
    for (const r of this.rivers) {
      for (const ch of r.chunks) {
        if (ch.x1 + margin < x0 || ch.x0 - margin > x1 || ch.z1 + margin < z0 || ch.z0 - margin > z1) continue;
        segs.push(ch.pts);
      }
    }
    const lakes = this.lakes.filter(
      (l) => l.x + l.r * 1.6 + margin >= x0 && l.x - l.r * 1.6 - margin <= x1 && l.z + l.r * 1.6 + margin >= z0 && l.z - l.r * 1.6 - margin <= z1,
    );
    return { segs, lakes };
  }

  // ---------------------------------------------------------------- lakes
  genLakes() {
    const rng = this.rng.fork('lakes');
    const cand = rng.shuffle(
      this.cells.filter((c) => c.biome !== 'ocean' && c.biome !== 'beach' && c.mountainness < 0.2 && c.cont > 0.12),
    );
    let n = 0;
    for (const c of cand) {
      if (n >= 9) break;
      const x = (c.cx + rng.float(0.3, 0.7)) * REGION_W;
      const z = (c.cz + rng.float(0.3, 0.7)) * REGION_D;
      if (this.lakes.some((l) => Math.hypot(l.x - x, (l.z - z) * 1.6) < 220)) continue;
      const big = c.biome === 'swamp' || rng.chance(0.3);
      this.lakes.push({ x, z, r: big ? rng.float(12, 17) : rng.float(6, 11), seed: rng.int(0, 1e9) });
      n++;
    }
    for (const l of this.lakes) {
      const c = this.cell(Math.floor(l.x / REGION_W), Math.floor(l.z / REGION_D));
      if (c) c.lake = true;
      l.noise = makeNoise2D(l.seed);
    }
  }

  // ---------------------------------------------------------------- civs
  genCivsAndSettlements() {
    const rng = this.rng.fork('civ');
    this.civs = [];
    this.settlements = [];
    const score = (c) => {
      if (!c || c.biome === 'ocean' || c.biome === 'beach' || c.mountainness > 0.12 || c.cont < 0.06) return -1;
      if (c.lake && !c.river) return -1;
      let s = rng.float(0, 1);
      if (c.river) s += 0.6;
      if (this.nearOcean(c)) s += 0.25;
      if (this.cell(c.cx + 1, c.cz)?.lake || this.cell(c.cx - 1, c.cz)?.lake) s += 0.35;
      s += { plains: 0.45, forest: 0.3, savanna: 0.15, taiga: 0.1, jungle: 0.05, desert: -0.1, tundra: -0.2, swamp: -0.2, mountain: -1 }[c.biome] ?? 0;
      return s;
    };
    const taken = [];
    const tooClose = (cx, cz, d) => taken.some((t) => Math.hypot((t.cx - cx) * 1.0, (t.cz - cz) * 1.5) < d);
    const place = (type, cx, cz, cw, cd, civ) => {
      const s = this.makeSettlement(type, cx, cz, cw, cd, civ, rng);
      taken.push({ cx: cx + (cw - 1) / 2, cz: cz + (cd - 1) / 2 });
      return s;
    };

    // Cities (2x2 cells) found civilizations.
    const cityCand = [];
    for (const c of this.cells) {
      if (c.cx >= MAP_W - 1 || c.cz >= MAP_H - 1) continue;
      const quad = [c, this.cell(c.cx + 1, c.cz), this.cell(c.cx, c.cz + 1), this.cell(c.cx + 1, c.cz + 1)];
      const ss = quad.map(score);
      if (ss.some((v) => v < 0)) continue;
      cityCand.push({ c, s: ss.reduce((a, b) => a + b, 0) / 4 + rng.float(0, 0.5) });
    }
    cityCand.sort((a, b) => b.s - a.s);
    const colorOrder = rng.shuffle([...CIV_COLORS.keys()]);
    const styleOf = (c) => {
      for (let dz = -2; dz <= 3; dz++) {
        for (let dx = -2; dx <= 3; dx++) {
          if ((this.cell(c.cx + dx, c.cz + dz)?.mountainness || 0) > 0.3 && hash4(c.cx, c.cz, this.seed) % 2) return 'high';
        }
      }
      return BIOME_STYLE[c.biome] || 'vale';
    };
    // Prefer one capital per cultural style so civilizations feel distinct.
    const ordered = [];
    const seenStyles = new Set();
    for (const cand of cityCand) {
      const st = styleOf(cand.c);
      if (!seenStyles.has(st)) {
        seenStyles.add(st);
        ordered.push(cand);
      }
    }
    for (const cand of cityCand) if (!ordered.includes(cand)) ordered.push(cand);
    for (const { c } of ordered) {
      if (this.civs.length >= 3) break;
      if (tooClose(c.cx + 0.5, c.cz + 0.5, 12)) continue;
      const style = styleOf(c);
      const vals = rng.shuffle([...VALUES]).slice(0, 2);
      const civ = {
        id: this.civs.length,
        style,
        values: vals,
        color: CIV_COLORS[colorOrder[this.civs.length % CIV_COLORS.length]],
        prosperity: rng.float(0.3, 0.9),
      };
      civ.name = `${rng.pick(CIV_TITLES)} of ${placeName(rng, style)}`;
      civ.people = CULTURES[style].label;
      this.civs.push(civ);
      const city = place('city', c.cx, c.cz, 2, 2, civ);
      civ.capital = city.id;
    }

    const nearestCiv = (cx, cz) => {
      let best = null;
      let bd = Infinity;
      for (const civ of this.civs) {
        const cap = this.settlements[civ.capital];
        const d = Math.hypot(cap.cx - cx, (cap.cz - cz) * 1.5);
        if (d < bd) {
          bd = d;
          best = civ;
        }
      }
      return { civ: best, dist: bd };
    };

    const civWithin = (cx, cz) => {
      const { civ, dist } = nearestCiv(cx, cz);
      return dist < 10 ? civ : null;
    };
    const singles = this.cells
      .map((c) => ({ c, s: score(c) }))
      .filter((o) => o.s >= 0)
      .sort((a, b) => b.s - a.s);
    let towns = 0;
    // Towns span two map squares side by side.
    for (const { c } of singles) {
      if (towns >= 5) break;
      const east = this.cell(c.cx + 1, c.cz);
      if (score(east) < 0 || tooClose(c.cx + 0.5, c.cz, 7.5)) continue;
      place('town', c.cx, c.cz, 2, 1, civWithin(c.cx, c.cz));
      towns++;
    }
    let villages = 0;
    for (const { c } of rng.shuffle(singles.slice(0, Math.floor(singles.length * 0.8)))) {
      if (villages >= 11) break;
      if (tooClose(c.cx, c.cz, 4.6)) continue;
      place('village', c.cx, c.cz, 1, 1, civWithin(c.cx, c.cz));
      villages++;
    }

    // Link settlement footprints to map cells for fast lookups.
    for (const s of this.settlements) {
      const b = s.bounds;
      const m = 14;
      for (let cz = Math.floor((b.z0 - m) / REGION_D); cz <= Math.floor((b.z1 + m) / REGION_D); cz++) {
        for (let cx = Math.floor((b.x0 - m) / REGION_W); cx <= Math.floor((b.x1 + m) / REGION_W); cx++) {
          const cell = this.cell(cx, cz);
          if (cell) cell.near.push(s.id);
        }
      }
      for (let cz = s.cz; cz < s.cz + s.cd; cz++) {
        for (let cx = s.cx; cx < s.cx + s.cw; cx++) {
          const cell = this.cell(cx, cz);
          if (cell) {
            cell.settlement = s.id;
            cell.civ = s.civ ? s.civ.id : null;
          }
        }
      }
    }
    // Civ territory for the map: nearest capital within range.
    for (const c of this.cells) {
      if (c.biome === 'ocean' || !this.civs.length) continue;
      const { civ, dist } = nearestCiv(c.cx, c.cz);
      if (dist < 9) c.civ = civ.id;
    }
    this.pickSpawn();
  }

  nearOcean(c) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.cell(c.cx + dx, c.cz + dz);
      if (n && n.biome === 'ocean') return true;
    }
    return false;
  }

  makeSettlement(type, cx, cz, cw, cd, civ, rng) {
    const id = this.settlements.length;
    const center = this.cell(cx, cz);
    const style = civ ? civ.style : BIOME_STYLE[center.biome] || 'vale';
    let condition = rng.weighted([
      ['prosperous', 0.2 + (civ ? civ.prosperity * 0.2 : 0)],
      ['normal', 0.45],
      ['poor', 0.25],
      ['abandoned', type === 'village' ? 0.1 : 0],
    ]);
    if (type === 'city' && condition === 'poor' && rng.chance(0.5)) condition = 'normal';
    let w;
    let d;
    if (type === 'village') {
      w = rng.int(48, 56);
      d = rng.int(28, 32);
    } else if (type === 'town') {
      w = REGION_W * 2 - rng.int(14, 22);
      d = rng.int(30, 33);
    } else {
      w = REGION_W * 2 - 16;
      d = REGION_D * 2 - 10;
    }
    const jx = type === 'village' ? rng.int(-(REGION_W - w) / 2 + 2, (REGION_W - w) / 2 - 2) : 0;
    const jz = type === 'city' ? 0 : rng.int(-(REGION_D * cd - d) / 2 + 1, (REGION_D * cd - d) / 2 - 1);
    const mx = Math.round((cx + cw / 2) * REGION_W + jx);
    const mz = Math.round((cz + cd / 2) * REGION_D + jz);
    const bounds = { x0: mx - Math.floor(w / 2), z0: mz - Math.floor(d / 2), x1: mx - Math.floor(w / 2) + w - 1, z1: mz - Math.floor(d / 2) + d - 1 };
    let river = false;
    for (let z = cz; z < cz + cd; z++) for (let x = cx; x < cx + cw; x++) if (this.cell(x, z)?.river) river = true;
    let name = placeName(rng, style);
    for (let i = 0; i < 12 && this.settlements.some((o) => o.name === name); i++) name = placeName(rng, style);
    const s = {
      id,
      type,
      name,
      civ,
      style,
      cx, cz, cw, cd,
      biome: center.biome,
      condition,
      bounds,
      river,
      coast: this.nearOcean(center),
      lake: this.lakes.some((l) => l.x > bounds.x0 - 20 && l.x < bounds.x1 + 20 && l.z > bounds.z0 - 20 && l.z < bounds.z1 + 20),
      seed: rng.int(0, 2 ** 31),
      layout: null,
    };
    this.settlements.push(s);
    return s;
  }

  pickSpawn() {
    const mid = { cx: MAP_W / 2, cz: MAP_H / 2 };
    const good = this.settlements
      .filter((s) => s.type !== 'city' && s.condition !== 'abandoned')
      .map((s) => ({
        s,
        d:
          Math.hypot(s.cx - mid.cx, (s.cz - mid.cz) * 1.4) +
          (s.type === 'village' ? 0 : 3) +
          (['plains', 'forest'].includes(s.biome) ? 0 : 6),
      }))
      .sort((a, b) => a.d - b.d);
    this.spawnSettlement = good.length ? good[0].s : this.settlements[0] || null;
  }

  settlementsNear(x, z) {
    const c = this.cell(Math.floor(x / REGION_W), Math.floor(z / REGION_D));
    return c ? c.near.map((i) => this.settlements[i]) : [];
  }

  settlementAt(x, z) {
    for (const s of this.settlementsNear(x, z)) {
      const b = s.bounds;
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return s;
    }
    return null;
  }

  markExplored(x, z, radius = 1) {
    const cx = Math.floor(x / REGION_W);
    const cz = Math.floor(z / REGION_D);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const X = cx + dx;
        const Z = cz + dz;
        if (X >= 0 && Z >= 0 && X < MAP_W && Z < MAP_H) this.explored[Z * MAP_W + X] = 1;
      }
    }
  }
}

export function biomeInfo(key) {
  return BIOMES[key];
}
