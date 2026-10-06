// What a biome looks like (round 63): a patch of its land made as the game
// makes it (its hills, its ground and patches, its ponds or pools and
// their banks, its trees (the game's, or structures from the Builder), its
// plants and rocks, reeds and lily pads), to see in the Biome tool as the
// game draws blocks; a wider stretch of it from above; and its square on
// the world map.
import { makeNoise2D, fbm, ridged } from '../util/noise.js';
import { hash4, hashf, mulberry32 } from '../util/rng.js';
import { BLOCKS, B } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { drawGlyph } from '../render/font.js';
import { biomeFields } from '../mod/biomes.js';
import { structVox } from './voxview.js';
import { blockArt } from './blockart.js';
import { canvas } from './kit.js';

const nameOf = (id) => (BLOCKS[id] ? BLOCKS[id].name : 'air');

// A biome's settings, whole: its own over those of the game's biome it
// starts from (or changes).
export function biomeWhole(b) {
  const base = biomeFields(b.change || b.base || 'plains');
  const out = { ...base };
  for (const [k, v] of Object.entries(b)) if (v !== undefined && v !== null && k in base) out[k] = v;
  if (b.bank === null) out.bank = null;
  return out;
}

const pickW = (list, r) => {
  let total = 0;
  for (const it of list) total += Math.max(0, it.w || 0);
  if (!total) return null;
  let v = r * total;
  for (const it of list) if ((v -= Math.max(0, it.w || 0)) <= 0) return it;
  return list[list.length - 1];
};

// The land, column by column, over a W x D patch: { h (its top's height
// above the lowest ground), water (its depth, or 0), top (its top block),
// tree (a trunk stands here) }; and the trees, plants, rocks, creatures.
export function biomeLand(mod, b, seed, W, D, o = {}) {
  const f = biomeWhole(b);
  const s = seed >>> 0;
  const nHill = makeNoise2D(hash4(s, 21));
  const nPatch = makeNoise2D(hash4(s, 23));
  const nPool = makeNoise2D(hash4(s, 24));
  const nClump = makeNoise2D(hash4(s, 26));
  const OX = 4000 + (s % 997);
  const OZ = 4000 + ((s >>> 10) % 997);
  const cols = new Array(W * D);
  const hills = Math.max(0, Math.min(3, f.hills | 0));
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const X = x + OX;
    const Z = z + OZ;
    const hn = fbm(nHill, X / 46, Z / 46, 3) * 0.5 + 0.5;
    let h = Math.floor(hn * (Math.min(2, hills) + 0.999));
    // (Rugged: ridges, as the mountains have.)
    if (hills >= 3) h = Math.max(h, Math.floor((0.3 + 0.7 * ridged(nHill, X / 40, Z / 40, 3)) * 5.5));
    let water = 0;
    if (h === 0) {
      if (f.water === 'pools') {
        const pn = nPool(X / 10, Z / 10) + nPool(X / 4, Z / 4) * 0.25;
        if (pn > 0.18) water = pn > 0.5 ? 2 : 1;
      } else if (f.water === 'ponds') {
        const pn = nPool(X / 13 + 400, Z / 13) + nPool(X / 5, Z / 5 + 400) * 0.2;
        if (pn > 0.72) water = pn > 0.82 ? 2 : 1;
      }
    }
    let top = f.surface;
    (f.patches || []).forEach((p, i) => {
      if (top !== f.surface) return;
      const v = nPatch(X / Math.max(2, p.size || 8) + i * 57.3, Z / Math.max(2, p.size || 8) - i * 31.7) * 0.5 + 0.5;
      if (v > 1 - (p.amount ?? 30) / 100) top = p.block;
    });
    // (Snow on the heights, but never where it's hot.)
    if (f.climate !== 'hot' && (h >= 5 || (h >= 3 && f.climate === 'cold' && hashf(X, Z, s, 7) < 0.6))) top = 'snow';
    cols[z * W + x] = { h, water, top, wet: 99, tree: false };
  }
  // How near the water each is (for banks and reeds).
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = cols[z * W + x];
    if (c.water) {
      c.wet = 0;
      continue;
    }
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const q = cols[(z + dz) * W + (x + dx)];
      if (x + dx < 0 || z + dz < 0 || x + dx >= W || z + dz >= D || !q || !q.water) continue;
      c.wet = Math.min(c.wet, Math.hypot(dx, dz));
    }
    if (c.wet <= 1.01 && f.bank) c.top = f.bank;
  }
  // Trees: one now and then on a jittered grid, thicker in clumps.
  const trees = [];
  const S = Math.max(3, f.treeSpacing | 0 || 7);
  const chance = (f.treeChance ?? 10) / 100;
  for (let gz = Math.floor(-4 / S); gz <= Math.ceil((D + 4) / S); gz++) for (let gx = Math.floor(-4 / S); gx <= Math.ceil((W + 4) / S); gx++) {
    const hh = hash4(gx + 977, gz + 977, s, S * 7 + 3);
    const x = gx * S + (hh % S);
    const z = gz * S + ((hh >>> 8) % S);
    if (x < 0 || z < 0 || x >= W || z >= D) continue;
    const c = cols[z * W + x];
    if (c.water && !f.wetTrees) continue;
    const clump = f.clump ? Math.max(0.15, Math.min(2.2, 1 + (f.clump / 100) * 2.2 * nClump((x + OX) / 22, (z + OZ) / 22))) : 1;
    if (hashf(x + OX, z + OZ, s, 5) >= chance * clump) continue;
    const t = pickW(f.trees || [], hashf(x + OX, z + OZ, s, 91));
    if (!t) continue;
    trees.push({ x, z, t, seed: hash4(x + OX, z + OZ, s, 77) });
    c.tree = true;
  }
  // Plants, rocks, reeds, lily pads.
  const plants = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = cols[z * W + x];
    if (c.tree) continue;
    const r = hashf(x + OX, z + OZ, s, 13);
    const r2 = hashf(x + OX, z + OZ, s, 14);
    if (c.water) {
      if (f.lilies && c.water === 1 && r < 0.07) plants.push({ x, z, ref: 'lily_pad', onWater: true });
      continue;
    }
    if (c.wet < 2.2 && f.reeds !== false && r < 0.3) {
      plants.push({ x, z, ref: 'reeds' });
      continue;
    }
    if (f.rocks && r2 < f.rocks / 1000) {
      plants.push({ x, z, ref: 'rock' });
      continue;
    }
    if (r >= (f.plantDensity ?? 20) / 100) continue;
    const p = pickW(f.plants || [], r2);
    if (p && c.top !== 'snow') plants.push({ x, z, ref: p.block });
  }
  // Who's about: `o.beasts` [{ species, w }].
  const list = o.beasts || [];
  const beasts = [];
  if (list.length) {
    const rng = mulberry32(hash4(s, 0xbea57));
    for (let i = 0, tries = 0; i < (o.many ?? 4) && tries < 60; tries++) {
      const x = 2 + Math.floor(rng() * (W - 4));
      const z = 2 + Math.floor(rng() * (D - 4));
      const c = cols[z * W + x];
      if (c.water || c.tree || beasts.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 4)) continue;
      const pick = pickW(list, rng());
      if (pick) {
        beasts.push({ x, z, species: pick.species });
        i++;
      }
    }
  }
  return { f, W, D, cols, trees, plants, beasts };
}

// The patch as blocks to draw (see voxview): its lowest ground two layers
// up, its water level there.
export function biomeVox(app, mod, land) {
  const { W, D, cols, trees, plants } = land;
  const f = land.f;
  const G = 2;
  let top = 0;
  for (const c of cols) top = Math.max(top, c.h);
  const H = G + top + 14;
  const grid = new Map();
  const key = (x, y, z) => (y * D + z) * W + x;
  const put = (x, y, z, ref) => {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H || !ref) return;
    grid.set(key(x, y, z), ref);
  };
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = cols[z * W + x];
    if (c.water) {
      for (let y = 0; y < G - c.water; y++) put(x, y, z, f.sub);
      put(x, G - c.water, z, f.bed === 'mud' ? 'mud' : f.climate === 'hot' ? 'basalt' : 'sand');
      for (let y = G - c.water + 1; y <= G; y++) put(x, y, z, 'water');
      continue;
    }
    for (let y = 0; y < G + c.h; y++) put(x, y, z, f.sub);
    put(x, G + c.h, z, c.top);
  }
  const rand = (sd) => mulberry32(sd);
  for (const t of trees) {
    const c = cols[t.z * W + t.x];
    const y0 = G + c.h + 1 - (c.water ? c.water : 0);
    for (const [dx, dy, dz, ref] of treeCells(app, mod, t.t, rand(t.seed))) {
      const k = key(t.x + dx, y0 + dy, t.z + dz);
      if (dy >= 0 && (!grid.has(k) || grid.get(k) === 'water' || String(ref).startsWith('log') || String(ref).includes('stem'))) put(t.x + dx, y0 + dy, t.z + dz, ref);
    }
  }
  for (const p of plants) {
    const c = cols[p.z * W + p.x];
    const y = p.onWater ? G + 1 : G + c.h + 1;
    if (!grid.has(key(p.x, y, p.z))) put(p.x, y, p.z, p.ref);
  }
  return {
    w: W, d: D, h: H, ground: G,
    get: (x, y, z) => {
      if (x < 0 || z < 0 || y < 0 || x >= W || z >= D || y >= H) return null;
      const r = grid.get(key(x, y, z));
      return r ? [r, 0] : null;
    },
  };
}

// A tree's blocks (by name, or a mod's '@block'), from its trunk's base.
export function treeCells(app, mod, t, rand) {
  if (t.structure) {
    const st = mod && mod.structures && mod.structures[t.structure];
    if (!st) return [];
    const v = structVox(st);
    const g = st.ground ?? 1;
    const cx = Math.floor(st.w / 2);
    const cz = Math.floor(st.d / 2);
    const out = [];
    const r = Math.floor(rand() * 4);
    for (let y = g + 1; y < st.h; y++) for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
      const c = v.get(x, y, z);
      if (!c || c[0] === 'keep' || c[0] === 'air') continue;
      let dx = x - cx;
      let dz = z - cz;
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      [dx, dz] = r === 1 ? [-dz, dx] : r === 2 ? [-dx, -dz] : r === 3 ? [dz, -dx] : [dx, dz];
      out.push([dx, y - g - 1, dz, c[0]]);
    }
    return out;
  }
  const fn = TREE_BUILDERS[t.tree];
  if (!fn) return [];
  return fn(rand).map(([dx, dy, dz, id]) => [dx, dy, dz, nameOf(id)]);
}

// ------------------------------------------------------------ colours
const avgCache = new Map();
// A block's colour from above (its top's average), for the view from
// above and the like.
export function blockColor(app, ref) {
  const k = `${app.mod ? app.mod.id : ''}:${ref}`;
  if (avgCache.has(k)) return avgCache.get(k);
  let col = '#808080';
  try {
    const a = blockArt(app, ref, 0);
    const img = a && (a.top || a.sprite);
    if (img) {
      const c = canvas(img.width, img.height);
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data;
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        r += d[i];
        g += d[i + 1];
        bl += d[i + 2];
        n++;
      }
      if (n) col = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)})`;
    }
  } catch {
    // (A colour of its own: grey.)
  }
  avgCache.set(k, col);
  return col;
}
export const forgetColors = () => avgCache.clear();

// A wide stretch of it from above: each column its top's colour (trees
// darker spots, water blue), `px` pixels to a column.
export function biomeAbove(app, mod, land, px = 3) {
  const { W, D, cols, trees, plants } = land;
  const c = canvas(W * px, D * px);
  const x = c.getContext('2d');
  for (let z = 0; z < D; z++) for (let xx = 0; xx < W; xx++) {
    const q = cols[z * W + xx];
    x.fillStyle = q.water ? (q.water > 1 ? '#1e4a8a' : '#2f6fb0') : blockColor(app, q.top);
    x.fillRect(xx * px, z * px, px, px);
    // (Higher ground lighter.)
    if (!q.water && q.h) {
      x.fillStyle = `rgba(255,255,255,${Math.min(0.24, q.h * 0.06)})`;
      x.fillRect(xx * px, z * px, px, px);
    }
  }
  for (const p of plants) {
    if (p.ref === 'reeds' || p.ref === 'lily_pad' || p.ref === 'rock') {
      x.fillStyle = p.ref === 'rock' ? '#9a9aa4' : p.ref === 'lily_pad' ? '#4aa040' : '#8a9a40';
      x.fillRect(p.x * px + 1, p.z * px + 1, Math.max(1, px - 2), Math.max(1, px - 2));
    }
  }
  for (const t of trees) {
    const cells = treeCells(app, mod, t.t, mulberry32(t.seed));
    const leaf = cells.find((q) => !String(q[3]).startsWith('log')) || cells[0];
    x.fillStyle = leaf ? blockColor(app, leaf[3]) : '#2a5a2a';
    x.fillRect(t.x * px - px, t.z * px - px, px * 3, px * 3);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(t.x * px - px, t.z * px + px * 2 - 1, px * 3, 1);
  }
  return c;
}

// Its square on the world map: its letter in its colours, `k` times as
// big as the game's font.
export function biomeGlyph(ch, fg, bg, k = 2) {
  const c = canvas(6 * k, 8 * k);
  const x = c.getContext('2d');
  x.fillStyle = bg || '#000';
  x.fillRect(0, 0, c.width, c.height);
  drawGlyph(x, ch || '?', 0, 0, fg || '#fff', k);
  return c;
}

// The game's biome `k`, or a mod's ('@id' of this mod's): what it shows as.
export function biomeLook(mod, k) {
  if (typeof k === 'string' && k[0] === '@') {
    const b = mod && mod.biomes && mod.biomes[k.slice(1)];
    if (b) {
      const w = biomeWhole(b);
      return { name: b.title || b.name, char: w.char, fg: w.fg, bg: w.bg };
    }
    return { name: `${k} (deleted)`, char: '?', fg: '#ff6a5a', bg: '#3a1010' };
  }
  const g = BIOMES[k];
  return g ? { name: g.name, char: g.char, fg: g.fg, bg: g.bg } : { name: k, char: '?', fg: '#fff', bg: '#333' };
}

void B;
