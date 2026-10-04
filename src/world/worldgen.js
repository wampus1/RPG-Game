// Overworld generation: the world map. Biomes are splotches (stretched,
// rotated ellipses) evaluated with a domain-warped distance field, so they can
// be sampled continuously at tile resolution and on the coarse map alike.
import {
  MAP_W, MAP_H, REGION_W, REGION_D, WORLD_TILES_W, WORLD_TILES_D,
} from '../config.js';
import { RNG, hash4, clamp, smoothstep } from '../util/rng.js';
import { makeNoise2D } from '../util/noise.js';
import { BIOMES, BIOME_STYLE } from './biomes.js';
import { placeName, civName, CULTURES } from './names.js';
import { genSites } from './sites.js';
import { buildLandmasses, landValue, landmassAt, stormAt, stormNear, insideStorm, DETAIL, DAGONI_KEYS } from './geography.js';

const SPLOTCH_STEP_X = 150;
const SPLOTCH_STEP_Z = 96;

export const CIV_COLORS = [
  { name: 'Crimson', hex: '#c8323c', awning: 'awning_red', rug: 'rug_red' },
  { name: 'Azure', hex: '#2f6fd0', awning: 'awning_blue', rug: 'rug_blue' },
  { name: 'Verdant', hex: '#3c9a48', awning: 'awning_green', rug: 'rug_green' },
  { name: 'Gilded', hex: '#e0b030', awning: 'awning_yellow', rug: 'rug_red' },
  { name: 'Violet', hex: '#8a4ab8', awning: 'awning_blue', rug: 'rug_blue' },
  { name: 'Ember', hex: '#e0702a', awning: 'awning_red', rug: 'rug_red' },
  { name: 'Teal', hex: '#2a9e98', awning: 'awning_green', rug: 'rug_blue' },
];
const VALUES = ['martial', 'mercantile', 'pious', 'scholarly', 'agrarian', 'seafaring', 'artisan'];
// The new islands' peoples, in the order their realms are founded.
const ISLAND_STYLES = { kharos: ['ember'], myrrow: ['mist', 'tide'] };
// What each people leans to (two of these each).
const ISLAND_VALUES = {
  ember: ['martial', 'artisan', 'pious', 'artisan'],
  mist: ['scholarly', 'pious', 'agrarian'],
  tide: ['seafaring', 'mercantile', 'seafaring', 'martial'],
};
// How good each kind of land is to build a town on.
const BIOME_SETTLE = {
  plains: 0.45, forest: 0.3, savanna: 0.15, taiga: 0.1, jungle: 0.05, desert: -0.1, tundra: -0.2, swamp: -0.2, mountain: -1,
  ashland: 0.2, cinderwood: 0.15, geyser: 0.35, volcano: -1, moor: 0.35, fungal: 0.2, mangrove: 0.15,
};

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
    // The lie of the land: the Dagoni Islands, the continents, the far
    // isles (see geography.js).
    this.lands = buildLandmasses();
    this.islands = this.lands.filter((L) => L.kind === 'dagoni');
    // The mountain on Kharos (its moods: see sim/volcano.js).
    this.setupVolcano();
    // (Today, as far as the land knows: a fresh lava flow is lava for a few
    // days, then black rock. Kept up to date by the game.)
    this.today = 1;
    this.genSplotches();
    this.genCells();
    this.genRivers();
    this.genLakes();
    this.genCivsAndSettlements();
    // The old places: dungeons, and the Kavorent's spires.
    this.sites = genSites(this);
    this.explored = new Uint8Array(MAP_W * MAP_H);
    // Places someone has told you of (a lake, the high ground...): marks
    // on your map even where you've never been.
    this.pins = [];
  }

  // Put a told-of place on the map (once per square and name).
  pin(x, z, label, glyph = '•') {
    const cx = Math.floor(x / REGION_W);
    const cz = Math.floor(z / REGION_D);
    if (this.pins.some((q) => Math.floor(q.x / REGION_W) === cx && Math.floor(q.z / REGION_D) === cz && q.label === label)) return false;
    this.pins.push({ x: Math.round(x), z: Math.round(z), label, glyph });
    if (this.pins.length > 60) this.pins.shift();
    return true;
  }

  // ---------------------------------------------------------------- land
  // How far onto land (x, z) is: above 0 it's land, below the sea (deep
  // out away from any coast). The best of every landmass's.
  continentAt(x, z) {
    let best = -1;
    for (const L of this.lands) {
      if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) continue;
      const v = landValue(L, x, z, this.nCont);
      if (v > best) best = v;
    }
    return best;
  }

  // The landmass (x, z) is on, or nearest (null far out at sea).
  landAt(x, z) {
    return landmassAt(this.lands, x, z, this.nCont);
  }

  // Which of the Dagoni Islands (x, z) is on: its key, or null.
  islandAt(x, z) {
    const L = this.landAt(x, z);
    return L && L.kind === 'dagoni' && landValue(L, x, z, this.nCont) > 0 ? L.key : null;
  }

  island(key) {
    return this.lands.find((L) => L.key === key) || null;
  }

  // The storm round the islands (0 outside it, to 1 in the thick of it).
  stormAt(x, z) {
    return stormAt(x, z);
  }

  insideStorm(x, z) {
    return insideStorm(x, z);
  }

  stormNear(x, z) {
    return stormNear(x, z);
  }

  // ---------------------------------------------------------------- volcano
  // The mountain at the heart of Kharos: where its cone stands, how big its
  // crater is, and the flows down its sides (a few old ones cooled to black
  // rock and glass, one thin trickle that never stops; each eruption adds
  // more: see sim/volcano.js).
  setupVolcano() {
    const K = this.lands.find((L) => L.volcano);
    this.volcano = null;
    if (!K) return;
    const rng = this.rng.fork('volcano');
    const V = {
      island: K.key,
      x: Math.round(K.x + rng.float(-0.08, 0.08) * K.trx),
      z: Math.round(K.z + rng.float(-0.08, 0.08) * K.trz),
      r: 150, squash: 1.2, crater: 0.13, flows: [],
    };
    V.cx = Math.floor(V.x / REGION_W);
    V.cz = Math.floor(V.z / REGION_D);
    for (let i = 0; i < 5; i++) {
      V.flows.push({ a: rng.float(-Math.PI, Math.PI), len: rng.float(0.6, 1.25), w: rng.float(1.2, 2.6), rock: rng.chance(0.3) ? 'glass' : 'rock', until: i === 0 ? Infinity : -1, seed: rng.int(0, 999) });
    }
    this.volcano = V;
  }

  // Lava (or the black rock an old flow cooled to) at (x, z), `d` out from
  // the crater (in the mountain's radii): 'lava', 'rock', 'glass' or null.
  lavaAt(x, z, d) {
    const V = this.volcano;
    if (!V || !V.flows.length) return null;
    const ang = Math.atan2((z - V.z) * V.squash, x - V.x);
    let best = null;
    for (const f of V.flows) {
      if (d > f.len) continue;
      // (Each winds its own way down.)
      const a = f.a + this.nFine(d * 3.2 + f.seed, f.seed * 0.37) * 0.32;
      let da = Math.abs(ang - a);
      if (da > Math.PI) da = 2 * Math.PI - da;
      const w = f.w * (1.15 - d * 0.35) * (d > f.len - 0.08 ? (f.len - d) / 0.08 : 1);
      if (da * d * V.r > w) continue;
      if (f.until > this.today) return 'lava';
      best = f.rock;
    }
    return best;
  }

  // What's in the storm-bound seas round the islands: lived in, simulated.
  dagoniCell(c) {
    return !!c && (c.island ? DAGONI_KEYS.has(c.island) : c.inside);
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
        // (Each landmass its own climate: Thessa cold in the north and hot
        // in the south, the far lands by how far north they lie.)
        const L = landmassAt(this.lands, x, z, this.nCont);
        const lat = L && L.kind === 'dagoni' ? (z - (L.z - L.trz)) / (2 * L.trz) : z / WORLD_TILES_D;
        const temp = clamp(lat + this.nClimate(x / 500, z / 500) * 0.18 + rng.float(-0.08, 0.08), 0, 1);
        const moist = clamp(rng.float(0, 1) * 0.7 + (this.nClimate(x / 300 + 50, z / 300) * 0.5 + 0.5) * 0.3, 0, 1);
        const biome = this.pickBiome(L, temp, moist, L ? landValue(L, x, z, this.nCont) : -1, rng);
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

  // A splotch's biome, by the landmass it's on: Thessa's (and the far
  // lands') from cold to hot and dry to wet; Kharos's ash and fire;
  // Myrrow's mist and mangroves. (`inland`: how far onto the land it is.)
  pickBiome(L, temp, moist, inland, rng) {
    const key = L ? L.key : null;
    if (key === 'kharos') {
      if (rng.chance(0.1)) return 'mountain';
      if (inland < 0.22 && moist > 0.45) return 'jungle';
      if (moist > 0.62) return 'geyser';
      if (moist > 0.36) return 'cinderwood';
      return 'ashland';
    }
    if (key === 'myrrow') {
      if (rng.chance(0.06)) return 'mountain';
      if (inland < 0.26 && moist > 0.4) return 'mangrove';
      if (moist > 0.66) return 'fungal';
      if (moist > 0.34) return 'moor';
      return temp > 0.55 ? 'swamp' : 'forest';
    }
    if (rng.chance(0.16)) return 'mountain';
    if (temp < 0.2) return moist < 0.45 ? 'tundra' : 'taiga';
    if (temp < 0.36) return moist > 0.48 ? 'taiga' : moist < 0.24 ? 'plains' : 'forest';
    if (temp < 0.64) {
      if (moist < 0.46) return 'plains';
      if (moist > 0.8) return 'swamp';
      return 'forest';
    }
    if (moist < 0.42) return 'desert';
    if (moist < 0.64) return 'savanna';
    if (moist > 0.88) return 'swamp';
    return 'jungle';
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
    // (The mountain on Kharos stands over whatever's round it.)
    const V = this.volcano;
    if (V && Math.abs(x - V.x) < V.r * 1.3 && Math.abs(z - V.z) < V.r * 1.3) {
      const d = Math.hypot(x - V.x, (z - V.z) * V.squash) / (V.r * (1 + this.nFine(x / 40 + 7, z / 40) * 0.08));
      if (d < 1) {
        out.biome2 = out.biome === 'volcano' ? 'ashland' : out.biome;
        out.biome = 'volcano';
        out.edge = (1 - d) * V.r * 0.6;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- map cells
  // The map's squares. Those in and round the Dagoni Islands (inside the
  // storm and the storm itself) are worked out now; the rest of the world
  // (the open sea, the continents, the far isles) as they're wanted (the
  // map looked at, a region made), so a world this size costs nothing it
  // doesn't need. (Unmade squares are holes in `cells`, which filter and
  // forEach pass over.)
  genCells() {
    this.cells = new Array(MAP_W * MAP_H);
    // (Those, in a list of their own: what the realms and the sim go over.)
    this.liveCells = [];
    for (let cz = DETAIL.cz0; cz <= DETAIL.cz1; cz++) {
      for (let cx = DETAIL.cx0; cx <= DETAIL.cx1; cx++) {
        const c = this.makeCell(cx, cz);
        this.cells[cz * MAP_W + cx] = c;
        this.liveCells.push(c);
      }
    }
  }

  makeCell(cx, cz) {
    const tmp = this._tmp || (this._tmp = {});
    const x = (cx + 0.5) * REGION_W;
    const z = (cz + 0.5) * REGION_D;
    const c = this.continentAt(x, z);
    // (Well out at sea: nothing more to work out.)
    if (c < -0.12) {
      return {
        cx, cz, biome: 'ocean', halves: ['ocean', 'ocean'], cont: c, mountainness: 0, elev: -1,
        river: false, lake: false, settlement: null, civ: null, near: [], island: null, inside: insideStorm(x, z), storm: stormAt(x, z),
      };
    }
    const halves = [];
    for (const fx of [0.25, 0.75]) {
      const hx = (cx + fx) * REGION_W;
      const hc = this.continentAt(hx, z);
      if (hc < 0) halves.push('ocean');
      else if (hc < 0.03) halves.push('beach');
      else {
        this.biomeAt(hx, z, tmp);
        halves.push(tmp.biome);
      }
    }
    this.biomeAt(x, z, tmp);
    const biome = c < 0 ? 'ocean' : c < 0.03 ? 'beach' : tmp.biome;
    const mountainness = tmp.biome === 'mountain' ? smoothstep(0, 45, tmp.edge) : 0;
    const L = c >= 0 ? this.landAt(x, z) : null;
    return {
      cx, cz, biome, halves, cont: c, mountainness,
      elev: c < 0 ? -1 : c + mountainness * 1.5 + (hash4(this.seed, cx, cz, 0xe1e) % 1000) / 20000,
      river: false, lake: false, settlement: null, civ: null, near: [],
      island: L ? L.key : null, inside: insideStorm(x, z), storm: stormAt(x, z),
    };
  }

  cell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H) return null;
    const i = cz * MAP_W + cx;
    return this.cells[i] || (this.cells[i] = this.makeCell(cx, cz));
  }

  // The biome a map square shows, without making the square ('lake' for
  // a lake): for drawing the whole world on the map.
  mapBiome(cx, cz) {
    const c0 = this.cells[cz * MAP_W + cx];
    if (c0) return c0.lake ? 'lake' : c0.biome;
    const x = (cx + 0.5) * REGION_W;
    const z = (cz + 0.5) * REGION_D;
    const c = this.continentAt(x, z);
    if (c < 0) return 'ocean';
    if (c < 0.03) return 'beach';
    return this.biomeAt(x, z, this._tmp2 || (this._tmp2 = {})).biome;
  }

  // The squares of one of the Dagoni Islands.
  islandCells(key) {
    return this.liveCells.filter((c) => c.island === key && c.biome !== 'ocean');
  }

  // ---------------------------------------------------------------- rivers
  genRivers() {
    const rng = this.rng.fork('rivers');
    this.rivers = [];
    this.lakes = [];
    const riverCells = new Map(); // cell index -> river id
    const picked = [];
    // (Each of the Dagoni Islands its own few: see geography.js.)
    const sources = [];
    for (const I of this.islands) {
      const land = this.liveCells.filter((c) => c.island === I.key && c.biome !== 'ocean' && c.biome !== 'beach');
      for (const c of rng.shuffle(land.filter((q) => (q.elev > 0.45 || q.mountainness > 0.25) && q.biome !== 'volcano')).slice(0, 40)) sources.push({ c, I });
    }
    const per = new Map();
    for (const { c: src, I } of sources) {
      if ((per.get(I.key) || 0) >= I.rivers) continue;
      if (picked.some((p) => Math.abs(p.cx - src.cx) + Math.abs(p.cz - src.cz) < 6)) continue;
      const path = [src];
      const seen = new Set([src.cz * MAP_W + src.cx]);
      let cur = src;
      let end = 'stuck';
      for (let steps = 0; steps < 60; steps++) {
        const opts = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.cell(cur.cx + dx, cur.cz + dz);
          if (!n || n.biome === 'volcano') continue;
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
      per.set(I.key, (per.get(I.key) || 0) + 1);
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
    // (Each of the Dagoni Islands its own few.)
    for (const I of this.islands) {
      const cand = rng.shuffle(
        this.liveCells.filter((c) => c.island === I.key && c.biome !== 'ocean' && c.biome !== 'beach' && c.mountainness < 0.2 && c.cont > 0.12),
      );
      let n = 0;
      for (const c of cand) {
        if (n >= I.lakes) break;
        const x = (c.cx + rng.float(0.3, 0.7)) * REGION_W;
        const z = (c.cz + rng.float(0.3, 0.7)) * REGION_D;
        if (this.lakes.some((l) => Math.hypot(l.x - x, (l.z - z) * 1.6) < 220)) continue;
        const big = c.biome === 'swamp' || c.biome === 'mangrove' || rng.chance(0.3);
        this.lakes.push({ x, z, r: big ? rng.float(12, 17) : rng.float(6, 11), seed: rng.int(0, 1e9) });
        n++;
      }
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
    const colorOrder = rng.shuffle([...CIV_COLORS.keys()]);
    // Each of the Dagoni Islands its own peoples and places (see
    // geography.js for how many): Thessa's as the old island's were;
    // Kharos's fire-folk; Myrrow's mist-folk and tide-folk.
    for (const I of this.islands) this.settleIsland(I, rng, colorOrder);
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
    // Civ territory for the map: nearest capital within range (on the same
    // island: a realm's land doesn't run over the sea).
    for (const c of this.liveCells) {
      if (c.biome === 'ocean' || !c.island) continue;
      const near = this.nearestCiv(c.cx, c.cz, c.island);
      if (near.civ && near.dist < 9) c.civ = near.civ.id;
    }
    this.pickSpawn();
  }

  // The nearest capital to a square (of an island's, if given).
  nearestCiv(cx, cz, island = null) {
    let best = null;
    let bd = Infinity;
    for (const civ of this.civs) {
      if (island && civ.island !== island) continue;
      const cap = this.settlements[civ.capital];
      const d = Math.hypot(cap.cx - cx, (cap.cz - cz) * 1.5);
      if (d < bd) {
        bd = d;
        best = civ;
      }
    }
    return { civ: best, dist: bd };
  }

  // One island's realms and settlements: cities found the realms, then the
  // towns (two squares across) and villages.
  settleIsland(I, rng, colorOrder) {
    const mine = (c) => c && c.island === I.key;
    const score = (c) => {
      if (!mine(c) || c.biome === 'ocean' || c.biome === 'beach' || c.mountainness > 0.12 || c.cont < 0.06) return -1;
      if (c.lake && !c.river) return -1;
      if (c.biome === 'volcano') return -1;
      let s = rng.float(0, 1);
      if (c.river) s += 0.6;
      if (this.nearOcean(c)) s += 0.25;
      if (this.cell(c.cx + 1, c.cz)?.lake || this.cell(c.cx - 1, c.cz)?.lake) s += 0.35;
      s += BIOME_SETTLE[c.biome] ?? 0;
      return s;
    };
    const taken = this.settlements.map((t) => ({ cx: t.cx + (t.cw - 1) / 2, cz: t.cz + (t.cd - 1) / 2 }));
    const tooClose = (cx, cz, d) => taken.some((t) => Math.hypot((t.cx - cx) * 1.0, (t.cz - cz) * 1.5) < d);
    const place = (type, cx, cz, cw, cd, civ) => {
      const s = this.makeSettlement(type, cx, cz, cw, cd, civ, rng);
      s.island = I.key;
      taken.push({ cx: cx + (cw - 1) / 2, cz: cz + (cd - 1) / 2 });
      return s;
    };
    const cells = this.liveCells.filter(mine);
    // Cities (2x2 cells) found civilizations.
    const cityCand = [];
    for (const c of cells) {
      if (c.cx >= MAP_W - 1 || c.cz >= MAP_H - 1) continue;
      const quad = [c, this.cell(c.cx + 1, c.cz), this.cell(c.cx, c.cz + 1), this.cell(c.cx + 1, c.cz + 1)];
      const ss = quad.map(score);
      if (ss.some((v) => v < 0)) continue;
      cityCand.push({ c, s: ss.reduce((a, b) => a + b, 0) / 4 + rng.float(0, 0.5) });
    }
    cityCand.sort((a, b) => b.s - a.s);
    const styleOf = (c) => {
      // (Kharos's people are all of one fire-folk; Myrrow's of the mist and
      // the tide; Thessa's by the land their capital sits in.)
      const own = ISLAND_STYLES[I.key];
      if (own) return own[this.civs.filter((q) => q.island === I.key).length % own.length];
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
    let founded = 0;
    for (const { c } of ordered) {
      if (founded >= I.civs) break;
      if (tooClose(c.cx + 0.5, c.cz + 0.5, I.civs > 1 ? Math.min(12, I.rx * 0.75) : 12)) continue;
      const style = styleOf(c);
      const vals = rng.shuffle([...(ISLAND_VALUES[style] || VALUES)]).slice(0, 2);
      const civ = {
        id: this.civs.length,
        style,
        values: vals,
        color: CIV_COLORS[colorOrder[this.civs.length % CIV_COLORS.length]],
        prosperity: rng.float(0.3, 0.9),
        island: I.key,
      };
      civ.name = civName(rng, style);
      civ.people = CULTURES[style].label;
      this.civs.push(civ);
      const city = place('city', c.cx, c.cz, 2, 2, civ);
      civ.capital = city.id;
      founded++;
    }
    const civWithin = (cx, cz) => {
      const { civ, dist } = this.nearestCiv(cx, cz, I.key);
      return dist < 10 ? civ : null;
    };
    const singles = cells
      .map((c) => ({ c, s: score(c) }))
      .filter((o) => o.s >= 0)
      .sort((a, b) => b.s - a.s);
    let towns = 0;
    // Towns span two map squares side by side.
    for (const { c } of singles) {
      if (towns >= I.towns) break;
      const east = this.cell(c.cx + 1, c.cz);
      if (score(east) < 0 || tooClose(c.cx + 0.5, c.cz, 7.5)) continue;
      place('town', c.cx, c.cz, 2, 1, civWithin(c.cx, c.cz));
      towns++;
    }
    let villages = 0;
    for (const { c } of rng.shuffle(singles.slice(0, Math.floor(singles.length * 0.8)))) {
      if (villages >= I.villages) break;
      if (tooClose(c.cx, c.cz, 4.6)) continue;
      place('village', c.cx, c.cz, 1, 1, civWithin(c.cx, c.cz));
      villages++;
    }
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
    // (Without a realm, the people of the land it's on: on Kharos the
    // Ashborn, on Myrrow the Mirefolk inland and the Stiltfolk by the water.)
    const own = ISLAND_STYLES[center.island];
    const style = civ ? civ.style : own ? (own.length > 1 && BIOME_STYLE[center.biome] !== own[0] ? own[1] : own[0]) : BIOME_STYLE[center.biome] || 'vale';
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
      island: center.island,
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
    // (On Thessa, the player's island: near its middle.)
    const home = this.islands[0];
    const mid = { cx: home.cx, cz: home.cz };
    const good = this.settlements
      .filter((s) => s.type !== 'city' && s.condition !== 'abandoned' && s.island === home.key)
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
      // Lots and houses the town has spread onto beyond its first bounds.
      if (s.suburbs) for (const r of s.suburbs) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return s;
    }
    return null;
  }

  // What's been explored, for a save: runs of explored squares ([start,
  // length], in map-square order), the map being far too big to keep whole.
  packExplored() {
    const out = [];
    const e = this.explored;
    for (let i = 0; i < e.length; i++) {
      if (!e[i]) continue;
      let j = i;
      while (j + 1 < e.length && e[j + 1]) j++;
      out.push([i, j - i + 1]);
      i = j;
    }
    return out;
  }

  unpackExplored(runs) {
    for (const [i, n] of runs || []) this.explored.fill(1, i, Math.min(this.explored.length, i + n));
  }

  markExplored(x, z, radius = 1) {
    const cx = Math.floor(x / REGION_W);
    const cz = Math.floor(z / REGION_D);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const X = cx + dx;
        const Z = cz + dz;
        if (X >= 0 && Z >= 0 && X < MAP_W && Z < MAP_H && !this.explored[Z * MAP_W + X]) {
          this.explored[Z * MAP_W + X] = 1;
          // (So the map knows to draw its fog again.)
          this.exploredN = (this.exploredN || 0) + 1;
        }
      }
    }
  }
}

export function biomeInfo(key) {
  return BIOMES[key];
}
