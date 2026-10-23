// (Round 143) How the town's map (the world map's Civilization tab) draws
// each tile: the colour of what's on top of it there (a block's own colour,
// as the minimap has it), and, as the world map draws its squares, a mark
// for what it is: a tree a ♣, water ≈, a crop ", a flower *, a lantern ¤,
// a roof's tiles ▒, the paving's setts ·. Far out a pixel a tile; closer,
// a little stamp of it; closest, a glyph on its ground, the world map's way.
import { BLOCKS, B } from '../world/blocks.js';
import { TEX } from '../render/textures.js';
import { glyphBitmap } from '../render/font.js';
import { CHAR_W, CHAR_H } from '../config.js';

// What a block is, seen from above, by the words of its name ("roof_red":
// roof, red), so that flagstone isn't a flag nor gravel a grave.
const W = (...w) => new Set(w);
const KINDS = [
  ['water', (t, n) => t.has('water') || n === 'ice'],
  ['lava', (t) => t.has('lava') || t.has('magma')],
  ['awning', (t) => t.has('awning') || t.has('canopy')],
  ['roof', (t, n, w) => w[0] === 'roof' || t.has('thatch') || t.has('shingle') || t.has('shingles')],
  ['tree', (t, n, w) => w[0] === 'leaves' || t.has('hedge') || t.has('bush')],
  ['trunk', (t, n, w) => w[0] === 'log' || t.has('trunk') || t.has('stump') || t.has('timber')],
  ['crop', (t, n, w) => w[w.length - 1] === 'crop' || hasAny(t, W('wheat', 'hay', 'pumpkin', 'melon', 'cane', 'cotton', 'rice', 'vine', 'cabbage', 'carrot', 'potato', 'beet'))],
  ['field', (t) => t.has('farmland')],
  ['flower', (t, n, w) => w[0] === 'flower' || hasAny(t, W('herb', 'fern', 'bloom', 'mushroom', 'reed', 'lily')) || n === 'tall_grass' || n === 'grass_tall'],
  ['fence', (t) => hasAny(t, W('fence', 'rail', 'railing')) || (t.has('gate') && !t.has('top'))],
  ['light', (t) => hasAny(t, W('lantern', 'lamp', 'torch', 'brazier', 'candle', 'beacon'))],
  ['sign', (t) => hasAny(t, W('sign', 'notice', 'banner', 'flag'))],
  ['grave', (t) => hasAny(t, W('gravestone', 'grave', 'tomb', 'crypt'))],
  ['statue', (t) => hasAny(t, W('statue', 'monument', 'obelisk', 'pedestal'))],
  ['well', (t) => t.has('well') || t.has('fountain')],
  ['bell', (t) => t.has('bell')],
  ['prop', (t) => hasAny(t, PROPS)],
  ['ground', (t, n) => hasAny(t, W('grass', 'dirt', 'snow', 'mud', 'clay', 'moss', 'podzol', 'soil', 'turf', 'scree', 'loam')) || ['sand', 'red_sand', 'ash', 'salt'].includes(n)],
  ['pave', (t) => hasAny(t, PAVES)],
  ['wall', (t) => t.has('gate') || t.has('wall')],
];
const PROPS = W('bench', 'counter', 'crate', 'barrel', 'chest', 'table', 'stall', 'cart', 'dummy', 'anvil', 'bed', 'rug', 'pot', 'basket', 'sack', 'stool', 'chair', 'shelf', 'rack', 'trough', 'cauldron', 'mill', 'hub', 'target', 'scarecrow', 'door');
const PAVES = W('cobblestone', 'cobble', 'path', 'gravel', 'bricks', 'brick', 'stone', 'planks', 'plank', 'plaster', 'adobe', 'slab', 'tile', 'tiles', 'marble', 'sandstone', 'granite', 'basalt', 'road', 'flagstone', 'paving', 'floor', 'terracotta', 'concrete', 'wood', 'cracked', 'mossy');
function hasAny(t, set) {
  for (const w of t) if (set.has(w)) return true;
  return false;
}
// Its mark, close in (and how often a tile of it shows one).
const MARK = {
  water: ['≈', 1], lava: ['≈', 1], awning: ['=', 1], roof: ['▒', 1], tree: ['♣', 1], trunk: ['o', 1], crop: ['"', 1], field: ['=', 1],
  flower: ['*', 1], fence: ['+', 1], light: ['¤', 1], sign: ['!', 1], grave: ['†', 1], statue: ['Ω', 1], well: ['o', 1], bell: ['♪', 1],
  prop: ['▪', 1], ground: ['"', 0.35], pave: ['·', 0.5], wall: ['#', 1], solid: ['■', 1],
};
// Colours where a block has none of its own (the textures not made: tests).
const PLAIN = {
  water: [52, 96, 170], lava: [220, 90, 30], awning: [180, 70, 60], roof: [150, 70, 50], tree: [50, 110, 50], trunk: [110, 80, 50], crop: [180, 170, 60],
  field: [110, 80, 50], flower: [200, 120, 160], fence: [120, 90, 60], light: [255, 220, 120], sign: [150, 120, 80], grave: [140, 140, 140], statue: [180, 180, 180],
  well: [120, 120, 130], bell: [200, 170, 60], prop: [130, 100, 70], ground: [70, 110, 50], pave: [140, 130, 110], wall: [130, 125, 115], solid: [120, 110, 100],
};

const LOOKS = new Map();
const clampB = (v) => Math.max(0, Math.min(255, Math.round(v)));
export const shade = (c, f) => [clampB(c[0] * f), clampB(c[1] * f), clampB(c[2] * f)];
const mix = (a, b, t) => [clampB(a[0] * (1 - t) + b[0] * t), clampB(a[1] * (1 - t) + b[1] * t), clampB(a[2] * (1 - t) + b[2] * t)];

// A block's look: { kind, c (its colour), ch (its mark), every (how often) }.
// `raised`: it stands above the ground (masonry that high is a wall);
// `roofed`: over a building (anything up there is its roof: a flat one of
// stone or clay, a chimney).
export function lookOf(id, raised = false, roofed = false) {
  const key = id * 4 + (raised ? 1 : 0) + (roofed ? 2 : 0);
  let L = LOOKS.get(key);
  if (L) return L;
  const d = BLOCKS[id];
  const name = d ? d.name : 'air';
  let kind = 'solid';
  const words = name.split('_');
  const t = new Set(words);
  if (id === B.water) kind = 'water';
  else for (const [k, test] of KINDS) if (test(t, name, words)) {
    kind = k;
    break;
  }
  if ((kind === 'pave' || kind === 'ground' || kind === 'solid') && raised) kind = 'wall';
  if (roofed && raised && (kind === 'wall' || kind === 'prop' || kind === 'trunk')) kind = 'roof';
  const avg = TEX.avg && TEX.avg[id];
  let c = avg && avg[0] + avg[1] + avg[2] > 0 ? avg.slice(0, 3) : PLAIN[kind];
  // (Some marks in their own colours.)
  if (kind === 'light') c = mix(c, [255, 220, 120], 0.5);
  let [ch, every] = MARK[kind] || MARK.solid;
  if (kind === 'tree' && /pine|spruce|fir|snow/.test(name)) ch = '♠';
  // (The bare ground marked as the world map marks its lands: grass
  // tufts, a scatter of earth, sand, snow.)
  if (kind === 'ground') [ch, every] = t.has('snow') ? ['*', 0.2] : hasAny(t, W('sand', 'salt')) ? ['·', 0.3] : hasAny(t, W('dirt', 'mud', 'clay', 'soil', 'loam', 'podzol')) ? [',', 0.25] : hasAny(t, W('ash', 'scree')) ? ['.', 0.25] : ['"', 0.35];
  L = { kind, c, ch, every };
  LOOKS.set(key, L);
  return L;
}

// A look for a kind of thing, in a colour (`c`, [r, g, b]).
export function kindLook(kind, c) {
  const [ch, every] = MARK[kind] || MARK.solid;
  return { kind, c, ch, every };
}

// A tile's own throw of the dice (the same each time it's drawn).
export const tileHash = (x, z) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The glyphs' pictures, once each.
const GLYPHS = new Map();
function glyph(ch) {
  let g = GLYPHS.get(ch);
  if (!g) GLYPHS.set(ch, (g = glyphBitmap(ch)));
  return g;
}

// A colour as one pixel's four bytes, at once (red first in memory).
const pack = (c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;

// A tile into the picture (`px32`: its pixels, four bytes each; `IW` its
// width), at pixel (px, py), `k` pixels across, as the mode has it. `f`:
// how lit (its height, its shadow); `fog`: not yet seen.
export function paintTile(px32, IW, px, py, k, mode, L, f, x, z, fog) {
  const put = (u, v, col) => {
    px32[(py + v) * IW + px + u] = pack(col);
  };
  const fill = (col) => {
    const c = pack(col);
    for (let v = 0; v < k; v++) {
      const i = (py + v) * IW + px;
      px32.fill(c, i, i + k);
    }
  };
  if (fog) {
    // (As the world map shows what's not been seen: dark, and a faint
    // shading of ░ close in.)
    fill([22, 20, 30]);
    if (mode === 'glyphs') stamp(put, '░', k, [42, 38, 50]);
    else if (mode === 'tiles' && (x + z) % 2 === 0) put(k >> 1, k >> 1, [32, 29, 42]);
    return;
  }
  const base = shade(L.c, f);
  if (mode === 'dots') {
    fill(base);
    return;
  }
  const h = tileHash(x, z);
  if (mode === 'glyphs') {
    // A glyph on its ground (the ground darker, as the world map's are).
    const flat = L.kind === 'roof' || L.kind === 'wall';
    fill(shade(base, flat ? 0.72 : 0.55));
    if (h < L.every) stamp(put, L.ch, k, flat ? shade(base, 0.95) : shade(base, 1.35));
    return;
  }
  // Close-ish: a little stamp of it.
  const dk = shade(base, 0.7);
  const lt = shade(base, 1.25);
  fill(base);
  const m = k >> 1;
  switch (L.kind) {
    case 'roof':
      for (let v = 1; v < k; v += 2) for (let u = 0; u < k; u++) put(u, v, dk);
      break;
    case 'awning':
      for (let u = 0; u < k; u += 2) for (let v = 0; v < k; v++) put(u, v, lt);
      break;
    case 'tree': {
      fill(shade(base, 0.6));
      const r = k / 2 - 0.3;
      for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) if (Math.hypot(u + 0.5 - k / 2, v + 0.5 - k / 2) <= r) put(u, v, base);
      put(Math.max(0, m - 1), Math.max(0, m - 1), lt);
      break;
    }
    case 'water':
      for (let u = 0; u < k; u++) if ((u + x * k + z) % 3 === 0) put(u, (m + (u >> 1)) % k, lt);
      break;
    case 'crop':
    case 'field':
      for (let u = 0; u < k; u += 2) for (let v = 0; v < k; v++) put(u, v, L.kind === 'crop' ? lt : dk);
      break;
    case 'flower':
      put(m, m, lt);
      if (k > 3) put(m - 1, m, shade(base, 1.5));
      break;
    case 'fence':
      for (let u = 0; u < k; u++) put(u, m, dk);
      for (let v = 0; v < k; v++) put(m, v, dk);
      break;
    case 'light':
      put(m, m, [255, 240, 170]);
      break;
    case 'pave':
      if (h < 0.5) put(Math.floor(h * 2 * k) % k, (x + z) % k, dk);
      if (k > 3 && h > 0.7) put((x * 3) % k, (z * 5) % k, lt);
      break;
    case 'ground':
      if (h < 0.4) put(Math.floor(h * 2.5 * k) % k, Math.floor(h * 7 * k) % k, lt);
      break;
    case 'wall':
      for (let u = 0; u < k; u++) put(u, 0, lt);
      put(0, m, dk);
      break;
    default:
      put(m, m, dk);
  }
}

// A glyph centred in a tile `k` across (twice the size from 16 on).
function stamp(put, ch, k, col) {
  const g = glyph(ch);
  if (!g) return;
  const s = k >= 16 ? 2 : 1;
  const gw = CHAR_W * s;
  const gh = CHAR_H * s;
  const ox = Math.floor((k - gw) / 2);
  const oy = Math.floor((k - gh) / 2);
  for (let v = 0; v < gh; v++) {
    const yy = oy + v;
    if (yy < 0 || yy >= k) continue;
    for (let u = 0; u < gw; u++) {
      const xx = ox + u;
      if (xx < 0 || xx >= k) continue;
      if (g[Math.floor(v / s) * CHAR_W + Math.floor(u / s)]) put(xx, yy, col);
    }
  }
}
