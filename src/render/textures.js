// Procedural pixel-art textures for every block: cube faces (with variants
// and rotation-dependent shading), prop sprites, plants and overlays. All
// images are packed into a single atlas canvas.
import { TILE, LH } from '../config.js';
import { BLOCKS, CROPS } from '../world/blocks.js';
import { Px, shade, hex } from './pixel.js';
import { mulberry32, hash4 } from '../util/rng.js';
import { dungeonTop, dungeonFront, dungeonFlat, bonesSprite, DSPRITES, DANIM } from './dungeontex.js';
import { isleTop, isleFront, islePlant, ISLE_SPRITES } from './isleart.js';
import { farTop, farFront, FAR_ROT_TOP } from './farart.js';

export const VARIANTS = 4;
export const SPR_H = TILE + LH; // 28: one-cell prop frame
export const TALL_H = TILE + LH * 2; // 40: two-cell prop frame
export const WATER_FRAMES = 4;

const OUT = '#1c1622';

// --- palettes -------------------------------------------------------------
const P = {
  grass: ['#5a9e3a', '#467e2e', '#74b84a', '#8ccc58'],
  grass_lush: ['#3f8a34', '#2f6c28', '#58a444', '#6cbc50'],
  grass_dry: ['#b0a448', '#8c8236', '#c8bc60', '#d8cc78'],
  grass_jungle: ['#2e9a3a', '#22782c', '#44b850', '#5cd060'],
  grass_taiga: ['#5a7a4a', '#465e3a', '#6e9058', '#8a6a44'],
  grass_void: ['#5a3a7a', '#422a5e', '#7a4ea0', '#b070e0'],
  dirt: ['#7a5436', '#5e3f28', '#946842', '#a8a098'],
  sand: ['#d2b46c', '#b99a58', '#e0c682'],
  snow: ['#b4bcc8', '#98a4b6', '#c4ccd8'],
  snow_void: ['#a898c0', '#8a78aa', '#c0b2d6', '#7a4ea0'],
  rock_void: ['#4e4258', '#3a3044', '#62546e', '#9a5ad0'],
  stone: ['#84848c', '#66666e', '#9e9ea6'],
  cobblestone: ['#7a7a80', '#505056', '#98989e'],
  gravel: ['#8a8680', '#6a665e', '#a8a49c', '#7a6e62'],
  clay: ['#a4a8b0', '#8a8e98', '#bcc0c8'],
  mud: ['#5a4630', '#45351f', '#6e5a40'],
  ice: ['#80b4c8', '#6a9cb4', '#a4ccdc'],
  path: ['#9a7a52', '#7e6242', '#b09066'],
  flagstone: ['#a65e3c', '#6e3c26', '#c07a54'],
  farmland: ['#5e4028', '#4a3020', '#6e4c30'],
  farmland_wet: ['#3e2a1a', '#2e1e12', '#4a3322'],
  planks: ['#b08850', '#8e6a3a', '#c8a064'],
  planks_birch: ['#dcc890', '#c0aa72', '#ecdcaa'],
  planks_dark: ['#6a4a2a', '#50361e', '#7e5a36'],
  planks_cinder: ['#5e3a30', '#442824', '#7a4c3e'],
  planks_bog: ['#6a6250', '#4e483a', '#847a66'],
  planks_drift: ['#c4baa4', '#a49a84', '#dcd4c2'],
  stone_bricks: ['#8e8e96', '#5e5e66', '#a6a6ae'],
  bricks: ['#a84a3a', '#8a3a2e', '#c05a48', '#c8b8a8'],
  adobe: ['#c89a68', '#b08458', '#d8b080'],
  plaster: ['#e8e0cc', '#d4ccb8', '#f4eee0'],
  log_wall: ['#8a6440', '#6a4a2e', '#a47a50'],
  marble: ['#eeeef2', '#d0d0d8', '#b0b0c0'],
  sandstone: ['#c8ae6c', '#ae945a', '#d8c282'],
  thatch: ['#d0b050', '#a88a3a', '#e8cc70'],
  roof_red: ['#b04a36', '#8a3628', '#cc6048'],
  roof_slate: ['#4e5a6e', '#3a4456', '#647088'],
  roof_wood: ['#8a6038', '#6a4828', '#a47a4a'],
  roof_green: ['#4a9a82', '#367a66', '#62b69a'],
  hay_bale: ['#d8b848', '#b89838', '#8a6a28'],
  water: ['#2e6ab0', '#24569a', '#4a8ad0', '#8cc4f0'],
};

// The fittings furniture's made with (see SPRITES: a chest's bands and
// lock, a barrel's staves and hoops, a door's latch, a window's frame, a
// hanging sign's bracket and board). Swapped, with the wood, for each
// island's own craft (see CRAFTS).
const FIT_OAK = {
  iron: '#5a5a62', ironHi: '#8a8a94', lock: '#f0d040', lockShade: '#8a6a10', staves: ['#9a6a3a', '#7a5028', '#b88450'],
  barrelTop: '#5a3a1e', frame: '#8e6a3a', bracket: '#3a3a44', panel: '#c8a86a', studs: false,
};
let FIT = FIT_OAK;
// Round 36: furniture in each island people's own craft, drawn by where
// it stands (see Renderer.craftAt): the Ashborn's in black-red cinderwood
// with bronze fittings and amber clasps, the Mirefolk's in grey-green
// bogwood with dark iron and glowcap-green clasps, the Stiltfolk's in
// sea-bleached driftwood lashed with rope.
export const CRAFTS = { ember: 1, mist: 2, tide: 3 };
export const CRAFT_LOOKS = {
  1: {
    planks: ['#5e3a30', '#442824', '#7a4c3e'], planks_dark: ['#2e1e1c', '#221616', '#402a26'],
    fit: { iron: '#9a6a32', ironHi: '#e0b060', lock: '#ffb040', lockShade: '#a8501a', staves: ['#5e3a30', '#442824', '#7a4c3e'], barrelTop: '#2a1614', frame: '#2e1e1c', bracket: '#9a6a32', panel: '#b07a4a', studs: true },
  },
  2: {
    planks: ['#6a6250', '#4e483a', '#847a66'], planks_dark: ['#3e3a2e', '#2e2a22', '#4e4a3c'],
    fit: { iron: '#3e4a44', ironHi: '#6a7e72', lock: '#b8f080', lockShade: '#4a7a3a', staves: ['#6a6250', '#4e483a', '#847a66'], barrelTop: '#2e2a22', frame: '#3e3a2e', bracket: '#3e4a44', panel: '#9a9278', studs: false },
  },
  3: {
    planks: ['#c4baa4', '#a49a84', '#dcd4c2'], planks_dark: ['#86806c', '#6a6454', '#9c9682'],
    fit: { iron: '#b89a64', ironHi: '#e0cc98', lock: '#f4ece0', lockShade: '#a89c88', staves: ['#c4baa4', '#a49a84', '#dcd4c2'], barrelTop: '#6a6454', frame: '#86806c', bracket: '#7a6a4a', panel: '#e0d8c4', studs: false },
  },
};
// What's made in a craft: furniture, doors, windows, fences.
export const CRAFTED = new Set(['door', 'door_top', 'chest', 'barrel', 'crate', 'table', 'chair', 'bench', 'stool', 'bed', 'sign', 'hanging_sign', 'notice_board', 'bookshelf', 'counter', 'glass']);
const WOOD = {
  oak: { bark: ['#6a4a2e', '#4e361f', '#80603c'], ring: ['#b08a58', '#8e6a40'] },
  birch: { bark: ['#e8e4d8', '#2e2e2e', '#fafaf0'], ring: ['#dcc890', '#c0aa72'] },
  pine: { bark: ['#4e3620', '#3a2816', '#62442a'], ring: ['#a07a50', '#806038'] },
  palm: { bark: ['#a88a5a', '#8a6e44', '#c0a270'], ring: ['#d8c090', '#b09a6a'] },
  jungle: { bark: ['#5e5230', '#48401f', '#746840'], ring: ['#9a7e4e', '#7e643c'] },
  acacia: { bark: ['#8a7a6a', '#6a5a4a', '#a09080'], ring: ['#c08a50', '#a06e3c'] },
  willow: { bark: ['#6e6450', '#50483a', '#847a64'], ring: ['#b09a70', '#907c58'] },
  // (The other islands' trees: see isleart.js.)
  cinder: { bark: ['#2a2222', '#1a1414', '#3a302e'], ring: ['#7a4a2a', '#5a3018'] },
  mangrove: { bark: ['#6a5a44', '#4e4232', '#82705a'], ring: ['#b08a5a', '#8e6a40'] },
};
const LEAF = {
  oak: ['#3e8a2e', '#2e6a22', '#58a840'],
  birch: ['#7ab040', '#5e8e2e', '#98c858'],
  pine: ['#2e5e3e', '#224a30', '#3e7450'],
  palm: ['#4aa83a', '#388a2c', '#6cc450'],
  jungle: ['#28a032', '#1c7a26', '#40c048'],
  acacia: ['#7a9a2e', '#5e7a22', '#98b440'],
  willow: ['#6a9a5a', '#527a46', '#86b474'],
  snowy: ['#2e5e3e', '#224a30', '#c4ccd8'],
  void: ['#5e2e82', '#421e5e', '#9050c0'],
  ember: ['#c8441a', '#962e12', '#f07a2a'],
  mangrove: ['#3e7a4a', '#2e5e38', '#58a064'],
};

// --- atlas ------------------------------------------------------------------
const SLOT_W = 16;
const SLOT_H = 40;
const ATLAS_COLS = 64;
let atlasCanvas = null;
let atlasCtx = null;
let nextSlot = 0;
const pending = [];

function addImage(px) {
  const i = nextSlot++;
  const slot = { x: (i % ATLAS_COLS) * SLOT_W, y: Math.floor(i / ATLAS_COLS) * SLOT_H, w: px.w, h: px.h };
  pending.push({ px, slot });
  return slot;
}

export const TEX = {
  atlas: null,
  top: [], // [id*4+rot] -> slots[variant]
  front: [], // [id*4+rot] -> slots[variant]
  sprite: [], // [id*4+rot] -> slots[state*4 + frame]
  frontTop: [], // doors: upper half front, [id*4+rot] -> slots
  crack: [],
  avg: [], // average top colour per block (minimap)
  misc: {},
};

// --- helpers ------------------------------------------------------------------
function speckle(p, pal, rand, dens = 0.25) {
  p.fill(pal[0]);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const r = rand();
      if (r < dens * 0.5) p.set(x, y, pal[1]);
      else if (r < dens) p.set(x, y, pal[2]);
    }
  }
  return p;
}

function frontify(p, f = 0.8) {
  p.tint(f);
  for (let x = 0; x < p.w; x++) {
    const c = p.get(x, 0);
    if (c[3]) p.set(x, 0, shade(c, 1.22), c[3]);
    const d = p.get(x, p.h - 1);
    if (d[3]) p.set(x, p.h - 1, shade(d, 0.8), d[3]);
  }
  return p;
}

function randomWalk(p, rand, x, y, len, c) {
  for (let i = 0; i < len; i++) {
    p.set(x, y, c);
    const r = rand();
    if (r < 0.4) x += rand() < 0.5 ? 1 : -1;
    else y += rand() < 0.5 ? 1 : -1;
  }
}

function cobble(p, pal, rand, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: rand() * p.w, y: rand() * p.h, f: 0.85 + rand() * 0.25 });
  const near = (x, y) => {
    let best = 0;
    let bd = 1e9;
    for (let i = 0; i < pts.length; i++) {
      for (const ox of [-p.w, 0, p.w]) {
        for (const oy of [-p.h, 0, p.h]) {
          const dx = x - pts[i].x - ox;
          const dy = y - pts[i].y - oy;
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
    }
    return best;
  };
  const id = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) id[y * p.w + x] = near(x, y);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const k = id[y * p.w + x];
      const edge = x + 1 < p.w && id[y * p.w + x + 1] !== k || y + 1 < p.h && id[(y + 1) * p.w + x] !== k;
      const top = y > 0 && id[(y - 1) * p.w + x] !== k || x > 0 && id[y * p.w + x - 1] !== k;
      if (edge) p.set(x, y, pal[1]);
      else if (top) p.set(x, y, shade(pal[2], pts[k].f));
      else p.set(x, y, shade(rand() < 0.15 ? pal[1] : pal[0], pts[k].f));
    }
  }
  return p;
}

function planks(p, pal, rand, rowH = 4) {
  for (let r = 0; r * rowH < p.h; r++) {
    const f = 0.9 + rand() * 0.18;
    const base = shade(pal[0], f);
    const seamX = Math.floor(rand() * p.w);
    for (let y = r * rowH; y < Math.min(p.h, (r + 1) * rowH); y++) {
      for (let x = 0; x < p.w; x++) {
        let c = base;
        if (rand() < 0.12) c = shade(pal[1], f);
        if (y === (r + 1) * rowH - 1) c = pal[1];
        if (x === seamX) c = pal[1];
        p.set(x, y, c);
      }
    }
    if (rand() < 0.5) {
      const gx = Math.floor(rand() * 12);
      p.hline(gx, gx + 3, r * rowH + 1, shade(pal[1], 1.05));
    }
    p.set((seamX + 1) % p.w, r * rowH + 1, pal[2]);
  }
  return p;
}

function bricks(p, pal, rand, rowH = 4, len = 8, mortar = null) {
  const m = mortar || pal[1];
  for (let y = 0; y < p.h; y++) {
    const row = Math.floor(y / rowH);
    const off = row % 2 ? len / 2 : 0;
    for (let x = 0; x < p.w; x++) {
      const bx = (x + off) % len;
      if (y % rowH === rowH - 1 || bx === len - 1) p.set(x, y, m);
      else {
        const f = 0.92 + ((hash4(Math.floor((x + off) / len), row, 7) % 100) / 100) * 0.16;
        let c = shade(pal[0], f);
        if (y % rowH === 0 || bx === 0) c = shade(pal[2], f);
        if (rand() < 0.1) c = shade(pal[1], 1.1);
        p.set(x, y, c);
      }
    }
  }
  return p;
}

function shingles(p, pal, rand, rot) {
  const f = rot === 0 || rot === 3 ? 1.08 : rot === 2 ? 0.8 : 0.95;
  for (let y = 0; y < p.h; y++) {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 2 : 0;
    for (let x = 0; x < p.w; x++) {
      const tx = (x + off) % 4;
      let c = pal[0];
      if (y % 4 === 3) c = pal[1];
      else if (y % 4 === 0 && tx !== 3) c = pal[2];
      if (tx === 3) c = shade(pal[1], 1.1);
      if (rand() < 0.08) c = shade(c, 0.9);
      p.set(x, y, shade(c, f));
    }
  }
  if (rot === 1) {
    p.rect(0, 6, p.w, 4, shade(pal[1], 0.95));
    p.hline(0, p.w - 1, 6, shade(pal[2], 0.95));
  }
  return p;
}

function straw(p, pal, rand, rot = 0) {
  p.fill(pal[0]);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * p.w);
    const y = Math.floor(rand() * p.h);
    const len = 2 + Math.floor(rand() * 4);
    const c = rand() < 0.5 ? pal[1] : pal[2];
    for (let k = 0; k < len; k++) p.set(x + (k >> 1) * (rand() < 0.3 ? 1 : 0), y + k, c);
  }
  if (rot === 2) p.tint(0.8);
  else if (rot === 1) p.tint(0.92);
  return p;
}

// --- cube faces -------------------------------------------------------------
function cubeTop(name, v, rand, rot) {
  const dt = dungeonTop(name, v, rand, rot);
  if (dt) return dt;
  const it = isleTop(name, v, rand, rot);
  if (it) return it;
  const ft = farTop(name, v, rand, rot);
  if (ft) return ft;
  const p = new Px(16, 16);
  const pal = P[name];
  switch (name) {
    case 'grass': case 'grass_lush': case 'grass_dry': case 'grass_jungle': case 'grass_taiga': case 'grass_void': {
      speckle(p, pal, rand, 0.35);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rand() * 16);
        const y = Math.floor(rand() * 15);
        p.set(x, y, pal[3]);
        p.set(x, y + 1, pal[2]);
      }
      if (name === 'grass_taiga') for (let i = 0; i < 6; i++) p.set(rand() * 16, rand() * 16, pal[3]);
      // (Blighted: a glint of something cold in it.)
      if (name === 'grass_void') for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, '#5ad8f0');
      return p;
    }
    case 'dirt': {
      speckle(p, pal, rand, 0.3);
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, pal[3]);
      return p;
    }
    case 'sand': {
      speckle(p, pal, rand, 0.2);
      if (v < 2) for (let k = 0; k < 2; k++) {
        const y0 = 3 + k * 7 + Math.floor(rand() * 3);
        for (let x = 0; x < 16; x++) p.set(x, y0 + Math.round(Math.sin((x + v * 3) / 2.5)), pal[1]);
      }
      return p;
    }
    case 'snow': {
      speckle(p, pal, rand, 0.18);
      for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * 16, '#8e9cb4');
      return p;
    }
    case 'snow_void': {
      // (Veins of violet through it, and a cold glint or two.)
      speckle(p, pal, rand, 0.2);
      for (let k = 0; k < 2; k++) {
        let x = rand() * 16;
        let y = rand() * 16;
        for (let i = 0; i < 9; i++) {
          p.set(x, y, pal[3]);
          x += rand() < 0.5 ? 1 : -1;
          y += rand() < 0.6 ? 1 : 0;
        }
      }
      for (let i = 0; i < 2; i++) p.set(rand() * 16, rand() * 16, '#5ad8f0');
      return p;
    }
    case 'sail': {
      speckle(p, ['#ece4d0', '#dcd3bc', '#f6f0e2'], rand, 0.16);
      for (let x = 3; x < 16; x += 5) p.vline(x, 0, LH - 1, '#c8bc9c');
      p.hline(0, 15, LH - 1, '#b8ac8c');
      for (let i = 0; i < 2; i++) p.set(rand() * 16, rand() * LH, '#c0b494');
      return p;
    }
    case 'stone': case 'bedrock': {
      const sp = name === 'bedrock' ? ['#3a3a40', '#26262c', '#4e4e56'] : pal;
      speckle(p, sp, rand, 0.22);
      randomWalk(p, rand, rand() * 16, rand() * 16, 8, shade(sp[1], 0.85));
      return p;
    }
    case 'rock_void': {
      // (Grey gone violet-black: veins of violet through it, and a cold
      // glint or two.)
      speckle(p, pal, rand, 0.24);
      for (let k = 0; k < 2; k++) randomWalk(p, rand, rand() * 16, rand() * 16, 8, pal[3]);
      for (let i = 0; i < 2; i++) p.set(rand() * 16, rand() * 16, '#5ad8f0');
      return p;
    }
    case 'cobblestone': return cobble(p, pal, rand, 7);
    case 'gravel': {
      speckle(p, pal, rand, 0.5);
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(rand() * 16);
        const y = Math.floor(rand() * 16);
        const c = [pal[2], pal[3], pal[1]][i % 3];
        p.set(x, y, c);
        p.set(x + 1, y, c);
        p.set(x, y + 1, shade(c, 0.8));
      }
      return p;
    }
    case 'clay': return speckle(p, pal, rand, 0.14);
    case 'mud': {
      speckle(p, pal, rand, 0.3);
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(rand() * 13);
        const y = Math.floor(rand() * 15);
        p.hline(x, x + 2, y, '#7a6a52');
      }
      return p;
    }
    case 'ice': {
      speckle(p, pal, rand, 0.12);
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(rand() * 16);
        const y = Math.floor(rand() * 16);
        for (let k = 0; k < 5; k++) p.set(x + k, y - k, pal[2]);
      }
      return p;
    }
    case 'coal_ore': case 'iron_ore': case 'gold_ore': case 'gem_ore': {
      speckle(p, P.stone, rand, 0.22);
      const oc = { coal_ore: ['#1e1e22', '#3a3a40'], iron_ore: ['#c8906a', '#e8b890'], gold_ore: ['#e8c030', '#fff080'], gem_ore: ['#30d8c8', '#c060f0'] }[name];
      for (let k = 0; k < 4; k++) {
        const x = 2 + Math.floor(rand() * 12);
        const y = 2 + Math.floor(rand() * 12);
        p.set(x, y, oc[0]);
        p.set(x + 1, y, oc[1]);
        p.set(x, y + 1, oc[0]);
        if (rand() < 0.6) p.set(x + 1, y + 1, oc[0]);
      }
      return p;
    }
    case 'flagstone': {
      // Big irregular slabs with dark grout, a little sand blown in.
      cobble(p, pal, rand, 4);
      for (let i = 0; i < 5; i++) p.set(rand() * 16, rand() * 16, '#d2b46c');
      return p;
    }
    case 'path': {
      speckle(p, pal, rand, 0.3);
      for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * 16, '#c4b49a');
      return p;
    }
    case 'farmland_wet': {
      speckle(p, pal, rand, 0.25);
      for (let y = 1; y < 16; y += 4) p.hline(0, 15, y, pal[1]);
      for (let i = 0; i < 5; i++) p.set(rand() * 16, 2 + Math.floor(rand() * 4) * 4, '#6a8aa8');
      return p;
    }
    case 'farmland': {
      speckle(p, pal, rand, 0.25);
      for (let y = 1; y < 16; y += 4) p.hline(0, 15, y, pal[1]);
      return p;
    }
    case 'planks': case 'planks_birch': case 'planks_dark': case 'planks_cinder': case 'planks_bog': case 'planks_drift': return planks(p, pal, rand);
    case 'stone_bricks': return bricks(p, pal, rand);
    case 'mossy_bricks': {
      bricks(p, P.stone_bricks, rand);
      for (let i = 0; i < 26; i++) p.set(rand() * 16, rand() * 16, rand() < 0.5 ? '#4e7a34' : '#628e40');
      return p;
    }
    case 'cracked_bricks': {
      bricks(p, P.stone_bricks, rand);
      randomWalk(p, rand, 4 + rand() * 8, 0, 18, '#3e3e46');
      return p;
    }
    case 'bricks': return bricks(p, pal, rand, 4, 6, pal[3]);
    case 'adobe': {
      speckle(p, pal, rand, 0.16);
      if (rand() < 0.5) randomWalk(p, rand, rand() * 16, rand() * 16, 5, pal[1]);
      return p;
    }
    case 'plaster': return speckle(p, pal, rand, 0.1);
    case 'timber': return planks(p, P.planks_dark, rand);
    case 'log_wall': return planks(p, pal, rand, 4);
    case 'marble': {
      speckle(p, pal, rand, 0.08);
      randomWalk(p, rand, rand() * 16, 0, 20, pal[2]);
      return p;
    }
    case 'sandstone': {
      speckle(p, pal, rand, 0.14);
      return p;
    }
    case 'thatch': return straw(p, pal, rand, rot);
    case 'roof_red': case 'roof_slate': case 'roof_wood': case 'roof_green': return shingles(p, pal, rand, rot);
    case 'roof_snow': {
      shingles(p, P.roof_wood, rand, rot);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y % 4 !== 3 || rand() < 0.6) p.set(x, y, rand() < 0.15 ? '#a4b0c2' : '#c4ccd8');
      return p;
    }
    case 'glass': {
      p.fill(FIT.frame);
      p.rect(1, 1, 14, 14, '#a8d8f0', 150);
      p.line(3, 12, 12, 3, '#f0ffff');
      return p;
    }
    case 'iron_bars': case 'cell_door': case 'cell_door_top': {
      // Seen from above: a heavy rail with the bar tops along it.
      p.rect(0, 6, 16, 4, '#2e2e38');
      p.hline(0, 15, 6, '#8a8a98');
      p.hline(0, 15, 9, '#1e1e26');
      for (let x = 1; x < 16; x += 4) {
        p.rect(x, 5, 2, 6, '#5a5a68');
        p.set(x, 5, '#c0c0cc');
      }
      return p;
    }
    case 'hay_bale': {
      straw(p, pal, rand);
      p.hline(0, 15, 4, pal[2]);
      p.hline(0, 15, 11, pal[2]);
      return p;
    }
    case 'counter': {
      planks(p, P.planks, rand, 4);
      p.tint(1.1);
      return p;
    }
    case 'bookshelf': return planks(p, P.planks_dark, rand);
    case 'awning_red': case 'awning_blue': case 'awning_yellow': case 'awning_green': {
      const col = { awning_red: '#c83a32', awning_blue: '#3264c0', awning_yellow: '#e0b030', awning_green: '#3c9a48' }[name];
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, Math.floor(x / 2) % 2 ? '#f0e8d8' : col);
      for (let x = 0; x < 16; x++) p.set(x, 0, shade(col, 1.2));
      return p;
    }
    case 'sail': {
      // Sailcloth: pale canvas in seamed strips, weathered here and there.
      speckle(p, ['#e8e0cc', '#d8cfb8', '#f2ecdc'], rand, 0.18);
      for (let x = 3; x < 16; x += 5) p.vline(x, 0, 15, '#c4b898');
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, '#b8ac8c');
      return p;
    }
    case 'cactus': case 'counter_top': return speckle(p, ['#4a9a3a', '#387a2c', '#62b44a'], rand, 0.2);
    default: {
      if (name.startsWith('log_')) {
        const w = WOOD[name.slice(4)];
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x - 7.5, y - 7.5);
            let c;
            if (d > 6.6) c = rand() < 0.3 ? w.bark[1] : w.bark[0];
            else c = Math.floor(d * 0.9) % 2 ? w.ring[1] : w.ring[0];
            p.set(x, y, c);
          }
        }
        p.set(7, 7, w.ring[1]);
        // Round-ish log: corners transparent.
        for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1], [0, 15], [1, 15], [0, 14], [15, 15], [14, 15], [15, 14]]) p.clear(x, y);
        return p;
      }
      if (name.startsWith('leaves_')) return leavesTex(p, LEAF[name.slice(7)], rand, name === 'leaves_snowy');
      return speckle(p, ['#ff00ff', '#aa00aa', '#ff66ff'], rand, 0.3);
    }
  }
}

function leavesTex(p, pal, rand, snowy, front = false) {
  // Clustered foliage: dark gaps between rounded leaf clumps that are lit
  // from the top-left, with ragged transparent edges.
  const dark = shade(pal[1], 0.72);
  p.fill(dark);
  const clumps = [];
  for (let i = 0; i < 9; i++) clumps.push([rand() * 16, rand() * p.h, 2.2 + rand() * 2.2]);
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, r] of clumps) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const wx = ((x % 16) + 16) % 16;
        const lit = -(dx + dy) / (r * 1.4);
        let c = pal[0];
        if (lit > 0.35) c = pal[2];
        else if (lit < -0.45) c = pal[1];
        if (d > r - 0.8 && lit < 0) c = pal[1];
        p.set(wx, y, c);
      }
    }
  }
  for (let i = 0; i < 10; i++) p.set(rand() * 16, rand() * p.h, rand() < 0.5 ? shade(pal[2], 1.12) : dark);
  if (snowy && !front) for (let i = 0; i < 50; i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    p.set(x, y, pal[2]);
    if (rand() < 0.5) p.set(x + 1, y, pal[2]);
  }
  if (snowy && front) for (let x = 0; x < 16; x++) if (rand() < 0.7) p.set(x, 0, pal[2]);
  // Ragged, rounded silhouette.
  for (let i = 0; i < 16; i++) {
    if (rand() < 0.45) p.clear(i, 0);
    if (rand() < 0.45) p.clear(0, i);
    if (rand() < 0.45) p.clear(15, i);
    if (rand() < 0.35) p.clear(i, p.h - 1);
  }
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1]]) p.clear(x, y);
  for (let i = 0; i < 4; i++) p.clear(1 + rand() * 14, 1 + rand() * (p.h - 2));
  return p;
}

function cubeFront(name, v, rand, rot) {
  const df = dungeonFront(name, v, rand, rot);
  if (df) return df;
  const iff = isleFront(name, v, rand);
  if (iff) return iff;
  const ff = farFront(name, v, rand);
  if (ff) return ff;
  const p = new Px(16, LH);
  const pal = P[name];
  switch (name) {
    case 'grass': case 'grass_lush': case 'grass_dry': case 'grass_jungle': case 'grass_taiga': case 'grass_void': {
      speckle(p, P.dirt, rand, 0.3);
      for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() < 0.4 ? 1 : 0) + (rand() < 0.15 ? 2 : 0);
        for (let y = 0; y < d; y++) p.set(x, y, y === d - 1 ? pal[1] : pal[0]);
      }
      return frontify(p);
    }
    case 'snow': case 'snow_void': {
      const sp = name === 'snow_void' ? P.snow_void : P.snow;
      speckle(p, P.dirt, rand, 0.3);
      for (let x = 0; x < 16; x++) {
        const d = 3 + (rand() < 0.4 ? 1 : 0);
        for (let y = 0; y < d; y++) p.set(x, y, y === d - 1 ? sp[1] : sp[0]);
      }
      return frontify(p, 0.9);
    }
    case 'stone': case 'bedrock': {
      const sp = name === 'bedrock' ? ['#3a3a40', '#26262c', '#4e4e56'] : pal;
      speckle(p, sp, rand, 0.22);
      for (let k = 0; k < 2; k++) {
        const y = 3 + k * 5 + Math.floor(rand() * 2);
        for (let x = 0; x < 16; x++) if (rand() < 0.7) p.set(x, y, sp[1]);
      }
      return frontify(p);
    }
    case 'rock_void': {
      speckle(p, pal, rand, 0.22);
      for (let k = 0; k < 2; k++) {
        const y = 3 + k * 5 + Math.floor(rand() * 2);
        for (let x = 0; x < 16; x++) if (rand() < 0.7) p.set(x, y, pal[1]);
      }
      randomWalk(p, rand, rand() * 16, rand() * 4, 10, pal[3]);
      return frontify(p);
    }
    case 'sandstone': {
      speckle(p, pal, rand, 0.14);
      for (let y = 3; y < LH; y += 4) for (let x = 0; x < 16; x++) p.set(x, y + (rand() < 0.2 ? 1 : 0), pal[1]);
      return frontify(p);
    }
    case 'planks': case 'planks_birch': case 'planks_dark': case 'planks_cinder': case 'planks_bog': case 'planks_drift': return frontify(planks(p, pal, rand));
    case 'stone_bricks': return frontify(bricks(p, pal, rand));
    case 'bricks': return frontify(bricks(p, pal, rand, 4, 6, pal[3]));
    case 'log_wall': {
      for (let y = 0; y < LH; y++) {
        const k = y % 4;
        const c = k === 0 ? pal[2] : k === 3 ? '#3a2818' : k === 2 ? pal[1] : pal[0];
        for (let x = 0; x < 16; x++) p.set(x, y, rand() < 0.1 ? shade(c, 0.85) : c);
      }
      p.vline(0, 0, LH - 1, pal[1]);
      return frontify(p, 0.92);
    }
    case 'timber': {
      speckle(p, P.plaster, rand, 0.1);
      const beam = '#5a3e26';
      p.vline(0, 0, LH - 1, beam);
      p.vline(15, 0, LH - 1, beam);
      p.hline(0, 15, 0, beam);
      p.hline(0, 15, LH - 1, beam);
      if (v % 3 === 0) p.line(0, LH - 1, 15, 0, beam);
      else if (v % 3 === 1) {
        p.line(0, 0, 15, LH - 1, beam);
      } else p.vline(7, 0, LH - 1, beam);
      return frontify(p, 0.86);
    }
    case 'iron_bars': case 'cell_door': case 'cell_door_top': {
      for (let x = 1; x < 16; x += 4) {
        p.rect(x, 0, 2, LH, '#4a4a58');
        p.vline(x, 0, LH - 1, '#a8a8b8');
        p.set(x + 2, 2, '#1c1622');
      }
      p.rect(0, 0, 16, 2, '#3a3a46');
      p.hline(0, 15, 0, '#9a9aa8');
      p.rect(0, LH - 2, 16, 2, '#3a3a46');
      if (name === 'cell_door') {
        p.rect(9, 4, 5, 4, '#2a2a34');
        p.hline(9, 13, 4, '#8a8a98');
        p.set(11, 5, '#e0c040');
        p.set(11, 6, '#1a1420');
      }
      return p;
    }
    case 'glass': {
      p.fill(FIT.frame);
      p.rect(1, 1, 14, LH - 2, '#a8d8f0', 150);
      p.vline(7, 1, LH - 2, FIT.frame);
      p.hline(1, 14, 5, FIT.frame);
      p.line(2, LH - 3, 5, 2, '#f0ffff');
      p.line(9, LH - 3, 12, 2, '#f0ffff');
      return p;
    }
    case 'hay_bale': {
      straw(p, pal, rand);
      p.vline(3, 0, LH - 1, pal[2]);
      p.vline(12, 0, LH - 1, pal[2]);
      return frontify(p, 0.85);
    }
    case 'counter': {
      p.fill(P.planks_dark[0]);
      p.rect(0, 0, 16, 2, P.planks[2]);
      p.rect(2, 3, 5, LH - 5, P.planks_dark[1]);
      p.rect(9, 3, 5, LH - 5, P.planks_dark[1]);
      return frontify(p, 0.95);
    }
    case 'bookshelf': {
      if (rot !== 0) return frontify(planks(p, P.planks_dark, rand));
      p.fill('#3a2616');
      p.rect(0, 0, 16, 1, P.planks_dark[2]);
      p.rect(0, 5, 16, 1, P.planks_dark[0]);
      p.rect(0, LH - 1, 16, 1, P.planks_dark[0]);
      p.vline(0, 0, LH - 1, P.planks_dark[0]);
      p.vline(15, 0, LH - 1, P.planks_dark[0]);
      const colors = ['#a83232', '#3a62a8', '#3a8a4a', '#c8a032', '#7a3aa0', '#d8d0c0', '#8a5a2a'];
      for (const [y0, y1] of [[1, 4], [6, LH - 2]]) {
        let x = 1;
        while (x < 15) {
          const w = rand() < 0.7 ? 1 : 2;
          const h = y1 - y0 + 1 - (rand() < 0.4 ? 1 : 0);
          const c = colors[Math.floor(rand() * colors.length)];
          p.rect(x, y1 - h + 1, w, h, c);
          x += w;
          if (rand() < 0.15) x++;
        }
      }
      return p;
    }
    case 'awning_red': case 'awning_blue': case 'awning_yellow': case 'awning_green': {
      const t = cubeTop(name, v, rand, rot);
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, t.get(x, y));
      for (let x = 0; x < 16; x++) {
        const k = x % 4;
        const cut = k === 0 || k === 3 ? 3 : 1;
        for (let y = LH - cut; y < LH; y++) p.clear(x, y);
      }
      return frontify(p, 0.85);
    }
    case 'thatch': {
      straw(p, pal, rand);
      p.rect(0, LH - 3, 16, 3, shade(pal[1], 0.7));
      for (let x = 0; x < 16; x += 2) p.set(x, LH - 1, pal[2]);
      return frontify(p, 0.85);
    }
    case 'roof_red': case 'roof_slate': case 'roof_wood': case 'roof_green': case 'roof_snow': {
      const pp = name === 'roof_snow' ? P.roof_wood : pal;
      shingles(p, pp, rand, 0);
      p.rect(0, LH - 3, 16, 3, '#2e2018');
      p.hline(0, 15, LH - 3, shade(pp[1], 0.8));
      if (name === 'roof_snow') for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() < 0.4 ? 1 : 0);
        for (let y = 0; y < d; y++) p.set(x, y, '#c4ccd8');
      }
      return frontify(p, 0.8);
    }
    default: {
      if (name.startsWith('log_')) {
        const w = WOOD[name.slice(4)];
        speckle(p, w.bark, rand, 0.2);
        if (name === 'log_birch') {
          for (let i = 0; i < 5; i++) {
            const x = Math.floor(rand() * 13);
            const y = Math.floor(rand() * LH);
            p.hline(x, x + 1 + Math.floor(rand() * 2), y, '#2e2e2e');
          }
        } else {
          for (let x = 1; x < 16; x += 3 + Math.floor(rand() * 2)) for (let y = 0; y < LH; y++) if (rand() < 0.8) p.set(x, y, w.bark[1]);
        }
        p.vline(0, 0, LH - 1, shade(w.bark[1], 0.8));
        p.vline(15, 0, LH - 1, shade(w.bark[1], 0.8));
        return frontify(p, 0.9);
      }
      if (name.startsWith('leaves_')) return frontify(leavesTex(p, LEAF[name.slice(7)], rand, name === 'leaves_snowy', true), 0.78);
      // Generic: reuse the top pattern, darkened.
      const t = cubeTop(name, v, rand, rot);
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, t.get(x, y), t.get(x, y)[3]);
      return frontify(p);
    }
  }
}

// --- door textures -------------------------------------------------------------
function doorFront(upper, rot, rand) {
  const p = new Px(16, LH);
  const wood = P.planks;
  if (rot === 1 || rot === 3) {
    // Seen edge-on inside a north-south wall.
    p.fill(P.planks_dark[0]);
    p.rect(5, 0, 6, LH, wood[1]);
    return frontify(p, 0.9);
  }
  p.fill(P.planks_dark[1]);
  p.rect(2, 0, 12, LH, wood[0]);
  for (let x = 4; x < 14; x += 3) p.vline(x, 0, LH - 1, wood[1]);
  p.vline(2, 0, LH - 1, P.planks_dark[0]);
  p.vline(13, 0, LH - 1, P.planks_dark[0]);
  if (upper) {
    p.hline(2, 13, 0, P.planks_dark[0]);
    p.rect(6, 3, 4, 4, '#2a3848');
    p.set(6, 3, '#6a90b0');
  } else {
    p.hline(2, 13, 2, wood[1]);
    // (Studs down a stout door, in some woods.)
    if (FIT.studs) for (const y of [5, 9]) for (const x of [4, 7, 10]) p.set(x, y, FIT.ironHi);
    p.set(11, 3, FIT.lock);
    p.set(11, 4, FIT.lockShade);
  }
  return p;
}
function doorTop(rot) {
  const p = new Px(16, 16);
  p.fill(P.planks_dark[0]);
  if (rot === 1 || rot === 3) {
    p.rect(5, 0, 6, 16, P.planks[0]);
    p.vline(5, 0, 15, P.planks[1]);
  } else {
    p.rect(0, 5, 16, 6, P.planks[0]);
    p.hline(0, 15, 5, P.planks[2]);
  }
  return p;
}
function doorOpenSprite(rot, upper) {
  // Thin panel swung against the hinge side.
  const p = new Px(16, SPR_H);
  const wood = P.planks;
  if (rot === 0 || rot === 2) {
    p.rect(0, 0, 3, 16, wood[1]);
    p.rect(0, 16, 3, LH, wood[0]);
    p.vline(0, 0, SPR_H - 1, P.planks_dark[0]);
    if (!upper) p.set(1, 20, FIT.lock);
  } else {
    p.rect(0, 0, 16, 3, wood[1]);
    p.rect(0, 3, 16, 3, wood[0]);
  }
  return p;
}

// --- sprites (16 x SPR_H, or TALL_H) --------------------------------------------
function portalArch(lit) {
  const p = spr(TALL_H);
  const s = ['#a8a4b4', '#7a7688', '#c8c4d4'];
  // The field between the pillars.
  for (let y = 7; y <= 37; y++) {
    for (let x = 3; x <= 12; x++) {
      if (!lit) {
        p.set(x, y, (x * 7 + y * 3) % 11 === 0 ? '#3a3448' : '#1c1826');
        continue;
      }
      // A spiral about the middle: bands of violet and blue, a white heart.
      const dx = x - 7.5;
      const dy = (y - 22) * 0.45;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const band = Math.floor((a / (Math.PI * 2)) * 6 + r * 0.9 + 12) % 3;
      p.set(x, y, r < 1.2 ? '#ffffff' : ['#9a60e8', '#6a80f0', '#c890ff'][band]);
    }
  }
  // The pillars, block by block.
  for (const x0 of [0, 13]) {
    p.rect(x0, 6, 3, 32, s[0]);
    p.vline(x0, 6, 37, s[2]);
    for (let y = 10; y < 38; y += 6) p.hline(x0, x0 + 2, y, s[1]);
  }
  // The arch, and its keystone.
  p.rect(0, 3, 16, 4, s[0]);
  p.hline(0, 15, 3, s[2]);
  p.hline(1, 14, 6, s[1]);
  p.rect(6, 1, 4, 4, lit ? '#e0c8ff' : s[1]);
  p.hline(6, 9, 1, s[2]);
  // A step at its foot.
  p.rect(0, 37, 16, 1, s[1]);
  return p.outline(OUT);
}

const FLOOR = LH; // y where the cell floor begins inside a prop frame

function spr(h = SPR_H) {
  return new Px(16, h);
}

// A city gate: shut, heavy planks banded with iron, filling the gateway;
// open, the leaves folded back against the posts. Seen side-on (rot 1, 3),
// a board edge down the middle, or nothing but the posts.
function gateSprite(rot, open, upper) {
  const p = spr();
  const wood = '#6e4c2c';
  const dark = '#4a3018';
  const iron = '#3e3e46';
  const front = rot === 0 || rot === 2;
  if (!open) {
    if (front) {
      for (let y = upper ? 8 : 12; y <= 27; y++) for (let x = 0; x < 16; x++) p.set(x, y, x % 4 === 3 ? dark : wood);
      if (upper) for (let x = 0; x < 16; x++) p.set(x, 8, shade(hex(wood), 1.25));
      p.hline(0, 15, upper ? 14 : 16, iron);
      p.hline(0, 15, 24, iron);
      if (!upper) {
        p.set(7, 20, '#c8a040');
        p.set(8, 20, '#c8a040');
      }
    } else {
      // Edge on: the thickness of the leaves, planked and banded.
      const top = upper ? 4 : 2;
      p.rect(4, top, 8, 28 - top, wood);
      p.vline(6, top, 27, dark);
      p.vline(9, top, 27, dark);
      p.hline(4, 11, upper ? 10 : 12, iron);
      p.hline(4, 11, upper ? 22 : 22, iron);
      if (upper) for (let x = 4; x <= 11; x += 2) p.set(x, top - 1, wood);
    }
  } else if (front) {
    p.rect(0, upper ? 8 : 10, 2, upper ? 20 : 18, dark);
    p.rect(14, upper ? 8 : 10, 2, upper ? 20 : 18, dark);
    p.vline(1, upper ? 8 : 10, 27, wood);
    p.vline(14, upper ? 8 : 10, 27, wood);
  } else {
    p.rect(7, upper ? 4 : 2, 2, 3, dark);
    p.rect(7, 24, 2, 3, dark);
  }
  return p.outline(OUT);
}

// Colours for what's put up round town for a do: the flags on the bunting,
// and the cloth, trim and mark of the banners. By the people's culture
// (0 Valeborn, 1 Nordvolk, 2 Sunreach, 3 Verdani, 4 Kharduum), and 5 for a
// wedding. (Kept in a block's colour bits and state bit.)
export const DECOR_PALETTES = [
  { flags: ['#c83a32', '#e0b030', '#3264c0', '#3c9a48'], cloth: '#b83028', trim: '#e0b030', mark: 'star' },
  { flags: ['#2e5eb8', '#f0ece0', '#b8322e', '#7a8a9a'], cloth: '#2a4a8a', trim: '#f0ece0', mark: 'cross' },
  { flags: ['#e0b030', '#a82a4a', '#2aa8a0', '#4a3a9a'], cloth: '#a82a4a', trim: '#e0b030', mark: 'crescent' },
  { flags: ['#e05a20', '#3cb848', '#d03aa0', '#f0d040'], cloth: '#2e8a3a', trim: '#f0d040', mark: 'zigzag' },
  { flags: ['#8a2020', '#c89a28', '#5a5e66', '#2a2a30'], cloth: '#6a1a1a', trim: '#c89a28', mark: 'hammer' },
  { flags: ['#ffffff', '#ff9ad0', '#f8e0e8', '#e8b0c8'], cloth: '#f4f0ec', trim: '#ff9ad0', mark: 'heart' },
  { flags: ['#c83a32', '#e0b030', '#3264c0', '#3c9a48'], cloth: '#b83028', trim: '#e0b030', mark: 'star' },
  { flags: ['#c83a32', '#e0b030', '#3264c0', '#3c9a48'], cloth: '#b83028', trim: '#e0b030', mark: 'star' },
];

const SPRITES = {
  chest(rot, st, f, rand) {
    const p = spr();
    const wood = P.planks;
    p.rect(2, 12, 12, 5, wood[2]);
    p.hline(2, 13, 12, shade(wood[2], 1.15));
    p.rect(2, 17, 12, 9, wood[0]);
    p.hline(2, 13, 17, P.planks_dark[1]);
    p.vline(4, 12, 25, FIT.iron);
    p.vline(11, 12, 25, FIT.iron);
    p.set(4, 12, FIT.ironHi);
    p.set(11, 12, FIT.ironHi);
    p.hline(2, 13, 25, wood[1]);
    if (rot === 0) {
      p.rect(7, 16, 2, 3, FIT.lock);
      p.set(7, 18, FIT.lockShade);
    }
    return p.outline(OUT);
  },
  barrel() {
    const p = spr();
    const c = FIT.staves;
    p.rect(3, 13, 10, 13, c[0]);
    p.ellipse(7.5, 12, 5, 2, c[2]);
    p.ellipse(7.5, 12, 3, 1, FIT.barrelTop);
    for (let x = 4; x < 13; x += 3) p.vline(x, 14, 25, c[1]);
    p.hline(3, 12, 16, FIT.iron);
    p.hline(3, 12, 22, FIT.iron);
    p.set(3, 16, FIT.ironHi);
    p.set(3, 22, FIT.ironHi);
    p.vline(3, 14, 25, shade(c[0], 1.15));
    return p.outline(OUT);
  },
  crate(rot, st, f, rand) {
    const p = spr();
    const w = P.planks;
    p.rect(2, 11, 12, 6, w[2]);
    p.rect(2, 17, 12, 9, w[0]);
    p.line(2, 17, 13, 25, w[1]);
    p.line(13, 17, 2, 25, w[1]);
    p.hline(2, 13, 17, P.planks_dark[1]);
    p.vline(2, 11, 25, P.planks_dark[0]);
    p.vline(13, 11, 25, P.planks_dark[0]);
    p.line(3, 12, 12, 15, w[1]);
    return p.outline(OUT);
  },
  workbench() {
    const p = spr();
    p.rect(1, 12, 14, 5, P.planks[2]);
    p.hline(1, 14, 12, shade(P.planks[2], 1.15));
    p.rect(1, 17, 14, 2, P.planks[1]);
    p.rect(2, 19, 2, 7, P.planks_dark[0]);
    p.rect(12, 19, 2, 7, P.planks_dark[0]);
    p.rect(4, 21, 8, 1, P.planks_dark[1]);
    // Tools on top: saw and hammer.
    p.hline(3, 7, 13, '#c0c0c8');
    p.set(8, 13, '#6a4a2e');
    p.hline(10, 12, 14, '#6a4a2e');
    p.rect(12, 13, 2, 2, '#5a5a62');
    return p.outline(OUT);
  },
  furnace(rot, st, f) {
    const p = spr();
    const s = P.stone;
    p.rect(1, 6, 14, 20, s[0]);
    p.rect(1, 6, 14, 5, s[2]);
    for (let y = 12; y < 26; y += 4) p.hline(1, 14, y, s[1]);
    p.rect(4, 15, 8, 9, '#1e1a1a');
    p.hline(5, 10, 14, '#1e1a1a');
    const fl = [['#e04a18', '#f8a030', '#fff0a0'], ['#d83a10', '#f8b840', '#ffe070']][f % 2];
    p.rect(5, 20, 6, 4, fl[0]);
    p.rect(6, 19 + (f % 2), 4, 3, fl[1]);
    p.set(7 + (f % 2), 21, fl[2]);
    p.rect(6, 7, 4, 2, '#3a3a40');
    return p.outline(OUT);
  },
  anvil() {
    const p = spr();
    const m = ['#4a4a56', '#32323c', '#6a6a78'];
    p.rect(2, 15, 12, 3, m[0]);
    p.hline(2, 13, 15, m[2]);
    p.rect(0, 16, 3, 1, m[0]);
    p.rect(5, 18, 6, 4, m[1]);
    p.rect(3, 22, 10, 4, m[0]);
    p.hline(3, 12, 22, m[2]);
    return p.outline(OUT);
  },
  // --- trade benches ---
  loom() {
    const p = spr();
    const w = P.planks;
    const d = P.planks_dark;
    p.rect(1, 8, 2, 18, d[0]);
    p.rect(13, 8, 2, 18, d[0]);
    p.hline(1, 14, 8, d[1]);
    p.rect(3, 9, 10, 1, w[1]);
    for (let x = 4; x <= 11; x++) p.vline(x, 10, 16, x % 2 ? '#e8e0d0' : '#c8c0b0');
    p.rect(3, 16, 10, 4, '#c83a32');
    p.hline(3, 12, 17, '#e8a030');
    p.hline(3, 12, 19, '#8a2a22');
    p.rect(2, 20, 12, 2, w[2]);
    p.rect(3, 24, 10, 1, d[1]);
    return p.outline(OUT);
  },
  alembic() {
    const p = spr();
    p.rect(2, 20, 12, 6, '#6a6a72');
    p.hline(2, 13, 20, '#8a8a94');
    p.rect(5, 22, 3, 2, '#2a1a14');
    p.set(6, 22, '#f8a030');
    p.ellipse(6, 16, 4, 4, '#c87a3a');
    p.set(4, 14, '#e8a060');
    p.set(5, 13, '#e8a060');
    p.rect(5, 9, 2, 4, '#b86a2a');
    p.line(7, 9, 11, 12, '#b86a2a');
    p.ellipse(12, 16, 2, 3, '#a8d8e8');
    p.rect(11, 17, 3, 2, '#50c070');
    p.set(12, 13, '#e8f4f8');
    return p.outline(OUT);
  },
  writing_desk() {
    const p = spr();
    const d = P.planks_dark;
    p.rect(1, 13, 14, 5, d[0]);
    p.hline(1, 14, 13, shade(d[0], 1.25));
    p.rect(1, 18, 14, 2, d[1]);
    p.rect(2, 20, 2, 6, d[1]);
    p.rect(12, 20, 2, 6, d[1]);
    p.rect(2, 11, 7, 3, '#f0e8d0');
    p.hline(3, 7, 12, '#8a7a6a');
    p.rect(10, 11, 2, 2, '#1a1a2a');
    p.line(11, 10, 14, 5, '#f4f4f4');
    p.set(14, 5, '#d8d8e0');
    return p.outline(OUT);
  },
  jeweler_bench() {
    const p = spr();
    const w = P.planks;
    p.rect(1, 14, 14, 4, w[2]);
    p.hline(1, 14, 14, shade(w[2], 1.15));
    p.rect(1, 18, 14, 2, w[1]);
    p.rect(2, 20, 2, 6, P.planks_dark[0]);
    p.rect(12, 20, 2, 6, P.planks_dark[0]);
    p.rect(2, 12, 3, 2, '#3a3a44');
    p.set(7, 13, '#50c0e0');
    p.set(9, 13, '#e05080');
    p.set(11, 13, '#60e080');
    p.vline(5, 6, 11, '#8a8a94');
    p.hline(5, 9, 6, '#8a8a94');
    p.rect(8, 7, 3, 2, '#f0d070');
    return p.outline(OUT);
  },
  oven(rot, st, f) {
    const p = spr();
    const br = ['#a8503a', '#8a3e2e', '#c8684a'];
    p.ellipse(8, 13, 7, 5, br[0]);
    p.rect(1, 13, 14, 13, br[0]);
    p.hline(3, 12, 9, br[2]);
    for (let y = 15; y < 26; y += 3) p.hline(1, 14, y, br[1]);
    p.rect(4, 17, 8, 6, '#2a1a14');
    const fl = f % 2 ? ['#f8a030', '#e85a18'] : ['#e85a18', '#f8a030'];
    p.rect(5, 20, 6, 3, fl[0]);
    p.rect(6, 19, 4, 2, fl[1]);
    p.rect(6, 5, 3, 4, '#6a6a72');
    return p.outline(OUT);
  },
  grindstone() {
    const p = spr();
    p.rect(2, 22, 12, 4, P.planks_dark[0]);
    p.rect(3, 18, 2, 5, P.planks_dark[1]);
    p.rect(11, 18, 2, 5, P.planks_dark[1]);
    p.ellipse(8, 15, 5, 5, '#9a9aa4');
    p.ellipse(8, 15, 2, 2, '#6a6a72');
    p.hline(3, 13, 15, '#b8b8c4');
    p.line(13, 15, 15, 11, '#6a4a2e');
    return p.outline(OUT);
  },
  tanning_rack() {
    const p = spr();
    const d = P.planks_dark;
    p.rect(2, 6, 2, 20, d[0]);
    p.rect(12, 6, 2, 20, d[0]);
    p.hline(2, 13, 6, d[1]);
    p.hline(2, 13, 22, d[1]);
    p.ellipse(8, 14, 4, 6, '#a87850');
    p.ellipse(8, 14, 2, 4, '#c89868');
    for (const [x, y] of [[4, 8], [11, 8], [4, 20], [11, 20]]) p.set(x, y, '#d8c890');
    return p.outline(OUT);
  },
  tackle_bench() {
    const p = spr();
    p.rect(1, 15, 14, 3, P.planks[1]);
    p.hline(1, 14, 15, shade(P.planks[1], 1.2));
    p.rect(2, 18, 2, 8, P.planks_dark[0]);
    p.rect(12, 18, 2, 8, P.planks_dark[0]);
    p.line(2, 14, 12, 4, '#7a5430');
    p.vline(12, 4, 9, '#e8e8f0');
    for (let x = 4; x < 9; x++) for (let y = 11; y < 15; y++) if ((x + y) % 2 === 0) p.set(x, y, '#c8c0a0');
    p.rect(9, 12, 4, 3, '#6a8aa8');
    p.set(10, 13, '#b8d0e8');
    return p.outline(OUT);
  },
  sawbench() {
    const p = spr();
    const d = P.planks_dark[0];
    p.line(2, 25, 6, 17, d);
    p.line(6, 25, 2, 17, d);
    p.line(10, 25, 14, 17, d);
    p.line(14, 25, 10, 17, d);
    p.rect(0, 14, 16, 3, '#8a6038');
    p.hline(0, 15, 14, '#a8784a');
    p.rect(0, 14, 1, 3, '#d8b078');
    p.rect(15, 14, 1, 3, '#d8b078');
    p.rect(5, 10, 7, 2, '#c0c0c8');
    p.rect(11, 9, 3, 3, '#6a4a2e');
    return p.outline(OUT);
  },
  potting_bench() {
    const p = spr();
    p.rect(1, 16, 14, 3, P.planks[2]);
    p.hline(1, 14, 16, shade(P.planks[2], 1.15));
    p.rect(2, 19, 2, 7, P.planks_dark[0]);
    p.rect(12, 19, 2, 7, P.planks_dark[0]);
    p.rect(2, 23, 12, 1, P.planks[1]);
    for (const x of [2, 6, 10]) {
      p.rect(x, 13, 3, 3, '#b8603a');
      p.set(x + 1, 11, '#58a040');
      p.set(x, 12, '#58a040');
      p.set(x + 2, 12, '#78c050');
    }
    return p.outline(OUT);
  },
  rock_crusher() {
    const p = spr();
    const st = P.stone;
    p.rect(2, 17, 12, 9, st[0]);
    p.hline(2, 13, 17, st[2]);
    for (let y = 20; y < 26; y += 3) p.hline(2, 13, y, st[1]);
    p.rect(4, 18, 8, 2, '#3a3a40');
    p.set(5, 18, '#8a8a94');
    p.set(9, 18, '#b88a50');
    p.rect(7, 7, 2, 11, '#6a4a2e');
    p.rect(5, 5, 6, 3, '#5a5a62');
    p.hline(5, 10, 5, '#7a7a84');
    return p.outline(OUT);
  },
  poster(rot, st) {
    // A notice pinned to a post: a heart for a wedding, a sun for a feast.
    const p = spr();
    p.rect(7, 17, 2, 9, P.planks_dark[0]);
    p.vline(7, 17, 25, P.planks_dark[2]);
    p.rect(2, 3, 12, 15, '#f2ead6');
    p.rect(2, 3, 12, 3, st ? '#d89a28' : '#d8487a');
    p.hline(2, 13, 3, st ? '#f0c050' : '#f07aa0');
    if (st) {
      const sun = '#f0b820';
      p.ellipse(7.5, 10, 2, 2, sun);
      for (const [x, y] of [[7, 6], [8, 6], [4, 10], [11, 10], [5, 7], [10, 7], [5, 13], [10, 13]]) p.set(x, y, sun);
    } else {
      const red = '#e04868';
      p.rect(5, 8, 2, 1, red);
      p.rect(9, 8, 2, 1, red);
      p.rect(5, 9, 6, 2, red);
      p.rect(6, 11, 4, 1, red);
      p.rect(7, 12, 2, 1, red);
      p.set(6, 9, '#f8a0b8');
    }
    p.hline(4, 11, 14, '#8a8070');
    p.hline(4, 9, 16, '#8a8070');
    p.set(2, 17, '#d8ceb8');
    p.set(13, 17, '#d8ceb8');
    return p.outline(OUT);
  },
  flower_arch() {
    // Two posts wound with greenery under an arch of leaves and flowers.
    const p = spr(TALL_H);
    const post = P.planks_dark;
    p.rect(1, 12, 2, 27, post[0]);
    p.rect(13, 12, 2, 27, post[0]);
    p.vline(1, 12, 38, post[2]);
    p.vline(13, 12, 38, post[2]);
    const leaf = ['#3c8a3c', '#58a848', '#2e6e30'];
    const top = (x) => 3 + Math.round(((x - 7.5) / 6.5) ** 2 * 9);
    for (let x = 0; x < 16; x++) {
      const y = top(Math.min(15, Math.max(0, x)));
      for (let k = 0; k < 3; k++) p.set(x, y + k, leaf[(x + k) % 3]);
    }
    for (let y = 14; y < 37; y += 3) {
      p.set(y % 2 ? 0 : 3, y, leaf[0]);
      p.set(y % 2 ? 3 : 0, y + 1, leaf[1]);
      p.set(y % 2 ? 12 : 15, y, leaf[0]);
      p.set(y % 2 ? 15 : 12, y + 1, leaf[1]);
    }
    const flowers = ['#ff9ad0', '#ffffff', '#e04848', '#f0d040'];
    for (let x = 1; x < 15; x += 2) p.set(x, top(x) + (x % 4 === 1 ? 0 : 1), flowers[(x >> 1) % 4]);
    for (let y = 16; y < 36; y += 5) {
      p.set(2, y, flowers[(y >> 2) % 4]);
      p.set(14, y + 2, flowers[((y >> 2) + 1) % 4]);
    }
    p.rect(0, 36, 4, 3, '#b8603a');
    p.rect(12, 36, 4, 3, '#b8603a');
    return p.outline(OUT);
  },
  maypole(rot, st, f) {
    // A tall striped pole with a crown of flowers and ribbons streaming
    // down to the dancers.
    const p = spr(TALL_H);
    for (let y = 4; y < 38; y++) {
      p.set(7, y, (y + 0) % 6 < 2 ? '#c83a32' : '#f0ece0');
      p.set(8, y, (y + 1) % 6 < 2 ? '#a82a24' : '#d8d4c8');
    }
    const sway = f % 2;
    const ribbons = [['#c83a32', 1, 30], ['#3264c0', 14, 30], ['#e0b030', 3, 36], ['#3c9a48', 12, 36]];
    for (const [c, x, y] of ribbons) p.line(x < 8 ? 7 : 8, 5, x + (x < 8 ? -sway : sway), y, c);
    p.ellipse(7.5, 4, 4, 1.5, '#3c8a3c');
    for (const [x, c] of [[4, '#ff9ad0'], [7, '#ffffff'], [10, '#f0d040'], [12, '#e04848']]) p.set(x, 4, c);
    p.rect(7, 1, 2, 2, '#f0d040');
    p.rect(5, 37, 6, 2, P.planks_dark[0]);
    return p.outline(OUT);
  },
  bunting(rot, st, f, rand, colour = 0) {
    // A string of little flags hung between posts at head height (or right
    // across a street), in the town's colours.
    const p = spr();
    const cols = DECOR_PALETTES[(st ? 4 : 0) + (colour & 3)].flags;
    const line = '#e8e0cc';
    if (rot === 0 || rot === 2) {
      const sag = (x) => 12 + Math.round(Math.sin((Math.PI * x) / 15) * 2);
      for (let x = 0; x < 16; x++) p.set(x, sag(x), line);
      for (let i = 0; i < 3; i++) {
        const x0 = 1 + i * 5;
        const y0 = sag(x0 + 1) + 1;
        const c = cols[i % cols.length];
        for (let k = 0; k < 4; k++) p.hline(x0 + (k >> 1), x0 + 3 - (k >> 1), y0 + k, c);
      }
    } else {
      p.vline(7, 12, 27, line);
      for (let i = 0; i < 3; i++) {
        const y0 = 13 + i * 5;
        const c = cols[(i + 1) % cols.length];
        p.rect(8, y0, 2, 3, c);
        p.set(8, y0 + 3, c);
      }
    }
    return p;
  },
  feast_table() {
    // A trestle table under a white cloth, laid with a roast, bread and ale.
    const p = spr();
    p.rect(1, 12, 14, 6, '#f0ece0');
    p.hline(1, 14, 12, '#ffffff');
    p.rect(1, 18, 14, 2, '#e0dccf');
    p.hline(1, 14, 19, '#c83a32');
    p.rect(2, 20, 2, 6, P.planks_dark[0]);
    p.rect(12, 20, 2, 6, P.planks_dark[0]);
    p.ellipse(4.5, 14, 3, 1.5, '#c8c8d0');
    p.ellipse(4.5, 13, 2, 1.5, '#9a5a2a');
    p.set(3, 12, '#c07a3a');
    p.rect(8, 12, 3, 2, '#d8a050');
    p.hline(8, 10, 12, '#e8c070');
    p.rect(12, 10, 2, 4, '#8a6a4a');
    p.hline(12, 13, 10, '#f8f4e8');
    p.set(9, 16, '#c83a32');
    p.set(10, 16, '#d84a3a');
    p.set(6, 16, '#58a040');
    return p.outline(OUT);
  },
  torch(rot, st, f) {
    const p = spr();
    p.rect(7, 14, 2, 12, '#7a5430');
    p.vline(7, 14, 25, '#8e6840');
    p.rect(6, 12, 4, 3, '#3a2a1a');
    if (st) {
      const fl = [[0, 0], [1, -1], [-1, 0]][f % 3];
      p.rect(6 + fl[0], 7 + fl[1], 4, 5, '#e85a18');
      p.rect(7 + fl[0], 5 + fl[1], 2, 6, '#f8a830');
      p.set(7 + fl[0], 9 + fl[1], '#fff4c0');
      p.set(8, 4 + fl[1], '#f8a830');
    }
    return p.outline(OUT);
  },
  canopy(rot, st, f, rand, colour = 0) {
    // A thin striped cloth over the back of a stall, low in its cell so it
    // rests on the posts below, its scalloped edge hanging toward the
    // customers. `rot` is the way the stall's front faces on screen (0 down,
    // 1 left, 2 up, 3 right); the colour is kept separately.
    const col = ['#c83a32', '#3264c0', '#e0b030', '#3c9a48'][colour & 3];
    const light = '#f0ece0';
    const p = spr();
    const top = LH;
    if (rot === 0 || rot === 2) {
      // Stripes across; the edge along the front (near or far side).
      const y0 = rot === 0 ? top : top + 9;
      const edge = rot === 0 ? y0 + 7 : y0 - 1;
      for (let x = 0; x < 16; x++) {
        const c = (x >> 2) % 2 ? light : col;
        p.vline(x, y0, y0 + 6, c);
        p.set(x, edge, shade(hex(c), 0.8));
        if (x % 4 < 2) p.set(x, rot === 0 ? edge + 1 : edge - 1, shade(hex(c), 0.8));
      }
      p.hline(0, 15, rot === 0 ? y0 : y0 + 6, '#ffffff');
    } else {
      // Seen end on: the cloth runs down the screen with the stall, stripes
      // across it, the edge down the side the customers stand on.
      const x0 = rot === 1 ? 7 : 0;
      const edge = rot === 1 ? x0 - 1 : x0 + 9;
      for (let y = top; y < top + 16; y++) {
        const c = ((y - top) >> 2) % 2 ? light : col;
        p.hline(x0, x0 + 8, y, c);
        p.set(edge, y, shade(hex(c), 0.8));
        if ((y - top) % 4 < 2) p.set(rot === 1 ? edge - 1 : edge + 1, y, shade(hex(c), 0.8));
      }
      p.vline(rot === 1 ? x0 + 8 : x0, top, top + 15, '#ffffff');
    }
    return p;
  },
  tent(rot, st, f, rand, colour = 0) {
    // A small A-frame tent of canvas on two poles. `rot` is the way its
    // opening faces on screen (0 down, 1 left, 2 up, 3 right); a merchant's
    // (the state bit) is striped, a nomad family's plain and weathered.
    const col = hex(['#c8b890', '#a0503a', '#3a6a9a', '#8a6a48'][colour & 3]);
    const stripe = '#f0ece0';
    const p = spr();
    const apex = 7;
    const base = 27;
    const half = (y) => ((y - apex) / (base - apex)) * 7.5;
    for (let y = apex; y <= base; y++) {
      const w = half(y);
      for (let x = Math.ceil(7.5 - w); x <= Math.floor(7.5 + w); x++) {
        // The side facing the light is paler; stripes run down a merchant's.
        let c = x < 8 ? shade(col, 1.12) : shade(col, 0.88);
        if (st && ((x + 1) >> 1) % 3 === 0) c = x < 8 ? stripe : shade(hex(stripe), 0.85);
        if (!st && ((x * 7 + y * 3) % 11 === 0)) c = shade(col, 0.8);
        p.set(x, y, c);
      }
    }
    // Seams down the middle and along the hem.
    p.vline(7, apex + 1, base, shade(col, 0.7));
    p.hline(0, 15, base, shade(col, 0.6));
    // The opening: facing you, a dark doorway with a flap tied back; to
    // one side, a sliver of it on that edge.
    const dark = '#1c1622';
    if (rot === 0) {
      for (let y = 17; y <= base - 1; y++) {
        const w = ((y - 17) / (base - 17)) * 3.5;
        for (let x = Math.ceil(7.5 - w); x <= Math.floor(7.5 + w); x++) p.set(x, y, dark);
      }
      p.line(9, 18, 12, 26, shade(col, 1.3));
    } else if (rot === 1 || rot === 3) {
      const x0 = rot === 1 ? 1 : 12;
      for (let y = 20; y <= base - 1; y++) p.hline(x0, x0 + 2, y, dark);
    }
    // Ridge pole tips and guy ropes.
    p.vline(7, apex - 3, apex, '#6a4a2a');
    p.vline(8, apex - 3, apex, '#6a4a2a');
    p.set(0, base + 0, '#6a4a2a');
    p.set(15, base + 0, '#6a4a2a');
    return p.outline(OUT);
  },
  festival_banner(rot, st, f, rand, colour = 0) {
    // A tall pole with a banner hung from a crossbar, swallow-tailed, with
    // the mark and colours of the town's people (a wedding's white and pink
    // with a heart).
    const pal = DECOR_PALETTES[(st ? 4 : 0) + (colour & 3)];
    const p = spr();
    const wood = P.planks_dark;
    p.vline(3, 2, 27, wood[0]);
    p.vline(4, 2, 27, wood[2]);
    p.rect(3, 0, 2, 2, pal.trim);
    p.hline(2, 13, 3, wood[1]);
    const cloth = hex(pal.cloth);
    const x0 = 5;
    const x1 = 13;
    for (let y = 4; y <= 22; y++) {
      for (let x = x0; x <= x1; x++) {
        // Swallow-tailed at the bottom.
        if (y > 18 && Math.abs(x - 9) < y - 18) continue;
        const edge = x === x0 || x === x1 || y === 4;
        p.set(x, y, edge ? pal.trim : x > 10 ? shade(cloth, 0.85) : pal.cloth);
      }
    }
    const m = pal.trim;
    if (pal.mark === 'cross') {
      p.rect(8, 5, 2, 14, pal.flags[1]);
      p.rect(6, 10, 7, 2, pal.flags[1]);
    } else if (pal.mark === 'crescent') {
      p.ellipse(9, 11, 3, 3, m);
      p.ellipse(10, 10, 2.4, 2.4, pal.cloth);
      p.set(12, 8, m);
      for (let x = x0; x <= x1; x += 2) p.set(x, 23, m);
    } else if (pal.mark === 'zigzag') {
      for (let x = x0 + 1; x < x1; x++) {
        p.set(x, 8 + (x % 2), pal.flags[0]);
        p.set(x, 12 + (x % 2), pal.flags[2]);
        p.set(x, 16 + (x % 2), pal.flags[3]);
      }
    } else if (pal.mark === 'hammer') {
      p.rect(7, 8, 5, 2, m);
      p.rect(9, 10, 1, 6, m);
      p.rect(7, 16, 5, 1, shade(hex(m), 0.8));
    } else if (pal.mark === 'heart') {
      p.rect(7, 9, 2, 2, m);
      p.rect(10, 9, 2, 2, m);
      p.rect(7, 11, 5, 2, m);
      p.rect(8, 13, 3, 1, m);
      p.set(9, 14, m);
    } else {
      // A star.
      p.rect(8, 8, 3, 7, m);
      p.rect(6, 10, 7, 3, m);
      p.set(9, 7, m);
    }
    return p.outline(OUT);
  },
  city_gate(rot, st) {
    return gateSprite(rot, st, false);
  },
  city_gate_top(rot, st) {
    return gateSprite(rot, st, true);
  },
  bell(rot, st, f) {
    // A bronze bell under a little roof on two posts; it swings when rung.
    const p = spr();
    const wood = P.planks_dark[0];
    p.rect(2, 7, 2, 21, wood);
    p.rect(12, 7, 2, 21, wood);
    p.hline(1, 14, 6, P.planks_dark[1]);
    p.hline(1, 14, 7, wood);
    p.hline(3, 12, 4, '#8a3a2a');
    p.hline(2, 13, 5, '#a84a32');
    const sw = st ? [-1, 0, 1, 0][f % 4] : 0;
    const bx = 8 + sw;
    p.vline(bx, 8, 9, '#3a3a44');
    p.rect(bx - 2, 10, 4, 2, '#c89030');
    p.rect(bx - 3, 12, 6, 4, '#c89030');
    p.hline(bx - 4, bx + 3, 16, '#a87020');
    p.vline(bx - 2, 10, 15, '#f0c860');
    p.set(bx, 17 + (st ? f % 2 : 0), '#5a4a30');
    p.hline(1, 4, 27, '#6a6a72');
    p.hline(11, 14, 27, '#6a6a72');
    return p.outline(OUT);
  },
  helm() {
    // A ship's wheel on its post: a rim of dark wood, eight spokes with
    // handles through it, a brass boss in the middle.
    const p = spr();
    const wood = P.planks_dark;
    p.rect(7, 20, 2, 8, wood[0]);
    p.hline(5, 10, 27, wood[1]);
    const cx = 7.5;
    const cy = 15;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      for (let r = 1; r <= 7; r++) p.set(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), r > 5 ? wood[2] : wood[1]);
    }
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      p.set(Math.round(cx + Math.cos(ang) * 5), Math.round(cy + Math.sin(ang) * 5), wood[0]);
    }
    p.rect(7, 14, 2, 2, '#d8a840');
    return p.outline(OUT);
  },
  lantern(rot, st, f) {
    const p = spr();
    const m = '#3a3a44';
    p.rect(5, 15, 6, 10, m);
    p.rect(6, 16, 4, 8, st ? (f % 2 ? '#ffd860' : '#ffe890') : '#4a5058');
    if (st) p.set(7, 18, '#fff8e0');
    p.hline(4, 11, 25, m);
    p.hline(5, 10, 14, m);
    p.set(7, 12, m);
    p.set(8, 12, m);
    p.set(6, 13, m);
    p.set(9, 13, m);
    return p.outline(OUT);
  },
  campfire(rot, st, f) {
    const p = spr();
    for (let i = 0; i < 7; i++) p.set(2 + i * 2, 25 - (i % 2), '#7a7a82');
    p.line(3, 24, 12, 21, '#6a4a2e');
    p.line(3, 21, 12, 24, '#5a3e26');
    if (st) {
      const o = f % 3;
      p.rect(5, 15 + (o === 1 ? 1 : 0), 6, 6, '#e04a18');
      p.rect(6, 12 + o, 4, 7, '#f8a030');
      p.rect(7, 16, 2, 3, '#fff0a0');
      p.set(8 - (o === 2 ? 1 : 0), 10 + o, '#f8a030');
    }
    return p.outline(OUT);
  },
  bed(rot, st, f, rand, variant = 0) {
    const p = spr();
    const blanket = ['#b03a3a', '#3a5ab0', '#3a8a4a', '#8a5aa8'][variant % 4];
    const frame = P.planks_dark;
    // Mattress top area (floor plane raised by 3px) and a front board.
    p.rect(1, FLOOR - 1, 14, 14, blanket);
    p.rect(1, FLOOR + 13, 14, 3, frame[0]);
    p.hline(1, 14, FLOOR + 13, frame[2]);
    const pillow = '#f0ece0';
    if (rot === 0) {
      p.rect(1, FLOOR - 3, 14, 3, frame[0]);
      p.rect(3, FLOOR, 10, 3, pillow);
    } else if (rot === 2) {
      p.rect(3, FLOOR + 9, 10, 3, pillow);
    } else if (rot === 1) {
      p.rect(2, FLOOR + 1, 3, 10, pillow);
    } else {
      p.rect(11, FLOOR + 1, 3, 10, pillow);
    }
    for (let x = 1; x < 15; x += 3) p.set(x, FLOOR + 6, shade(blanket, 1.2));
    return p.outline(OUT);
  },
  table() {
    const p = spr();
    p.rect(1, 12, 14, 6, P.planks[2]);
    p.hline(1, 14, 12, shade(P.planks[2], 1.15));
    p.rect(1, 18, 14, 2, P.planks[1]);
    p.rect(2, 20, 2, 6, P.planks_dark[0]);
    p.rect(12, 20, 2, 6, P.planks_dark[0]);
    return p.outline(OUT);
  },
  chair(rot) {
    const p = spr();
    const w = P.planks;
    p.rect(4, 16, 8, 4, w[2]);
    p.rect(4, 20, 8, 1, w[1]);
    p.vline(4, 21, 26, P.planks_dark[0]);
    p.vline(11, 21, 26, P.planks_dark[0]);
    if (rot === 0) p.rect(4, 9, 8, 7, w[0]);
    else if (rot === 2) p.rect(4, 19, 8, 6, w[0]);
    else if (rot === 1) p.rect(11, 9, 2, 12, w[0]);
    else p.rect(3, 9, 2, 12, w[0]);
    return p.outline(OUT);
  },
  bench(rot) {
    const p = spr();
    const w = P.planks;
    if (rot === 0 || rot === 2) {
      p.rect(0, 16, 16, 4, w[2]);
      p.rect(0, 20, 16, 1, w[1]);
      p.vline(2, 21, 26, P.planks_dark[0]);
      p.vline(13, 21, 26, P.planks_dark[0]);
      if (rot === 0) p.rect(0, 11, 16, 4, w[0]);
      else p.rect(0, 21, 16, 3, w[0]);
    } else {
      p.rect(5, 10, 6, 16, w[2]);
      p.vline(5, 10, 25, w[1]);
      p.rect(rot === 1 ? 10 : 4, 6, 2, 16, w[0]);
    }
    return p.outline(OUT);
  },
  well() {
    const p = spr(TALL_H);
    const s = P.cobblestone;
    p.rect(1, 24, 14, 14, s[0]);
    for (let y = 26; y < 38; y += 3) for (let x = 1 + ((y / 3) % 2) * 2; x < 15; x += 4) p.set(x, y, s[1]);
    p.ellipse(7.5, 25, 6, 3, s[2]);
    p.ellipse(7.5, 25, 4, 2, '#1e3a6a');
    p.set(6, 25, '#4a7ab0');
    p.rect(1, 8, 2, 18, P.planks_dark[0]);
    p.rect(13, 8, 2, 18, P.planks_dark[0]);
    p.hline(1, 14, 10, P.planks[1]);
    for (let y = 0; y < 8; y++) p.hline(7 - y, 8 + y, y + 1, y % 2 ? P.roof_red[0] : P.roof_red[1]);
    p.vline(8, 11, 20, '#c8b890');
    p.rect(7, 20, 3, 3, '#7a7a82');
    return p.outline(OUT);
  },
  // A portal: two dressed-stone pillars and a keystone arch, a swirl of
  // violet light between them (or, cut off, a dull dark glass).
  portal() {
    return portalArch(true);
  },
  portal_dark() {
    return portalArch(false);
  },
  altar() {
    const p = spr();
    const m = P.marble;
    p.rect(1, 12, 14, 5, m[0]);
    p.rect(1, 17, 14, 9, m[1]);
    p.rect(1, 15, 14, 4, '#c8a030');
    p.hline(1, 14, 15, '#f0d060');
    p.rect(3, 8, 1, 4, '#f0ece0');
    p.rect(12, 8, 1, 4, '#f0ece0');
    p.set(3, 7, '#ffc040');
    p.set(12, 7, '#ffc040');
    p.rect(6, 19, 4, 5, '#c8a030');
    return p.outline(OUT);
  },
  sign(rot) {
    const p = spr();
    p.rect(7, 18, 2, 8, P.planks_dark[0]);
    p.rect(2, 9, 12, 9, P.planks[0]);
    p.hline(2, 13, 9, P.planks[2]);
    for (let y = 11; y < 17; y += 2) p.hline(4, 11 - (y % 4), y, '#4a3420');
    return p.outline(OUT);
  },
  notice_board() {
    const p = spr(TALL_H);
    p.rect(2, 14, 2, 24, P.planks_dark[0]);
    p.rect(12, 14, 2, 24, P.planks_dark[0]);
    p.rect(1, 12, 14, 16, P.planks[1]);
    p.hline(1, 14, 12, P.planks[2]);
    p.rect(0, 10, 16, 2, P.roof_wood[1]);
    const notes = [[3, 14, 4, 5], [9, 15, 4, 4], [4, 21, 5, 4], [10, 21, 3, 5]];
    for (const [x, y, w, h] of notes) {
      p.rect(x, y, w, h, '#f0e8d0');
      p.hline(x + 1, x + w - 2, y + 2, '#8a8070');
      p.set(x + 1, y, '#c83a32');
    }
    return p.outline(OUT);
  },
  cell_door_open() {
    // The barred door swung against the wall.
    const p = spr();
    for (let y = 2; y < 26; y += 1) if (y % 3 !== 0) p.set(1, y, '#7a7a86');
    p.rect(0, 2, 2, 24, '#5e5e6a');
    for (let y = 4; y < 26; y += 4) p.hline(0, 3, y, '#9a9aa8');
    return p.outline(OUT);
  },
  stool() {
    const p = spr();
    const w = P.planks;
    p.ellipse(7.5, 17, 4, 2, w[2]);
    p.hline(4, 11, 18, w[1]);
    p.vline(5, 19, 26, P.planks_dark[0]);
    p.vline(10, 19, 26, P.planks_dark[0]);
    p.hline(5, 10, 23, P.planks_dark[1]);
    return p.outline(OUT);
  },
  hanging_sign(rot) {
    // A board hung from an iron bracket; the renderer paints the trade icon.
    const p = spr();
    const iron = FIT.bracket;
    if (rot === 1) p.hline(6, 15, 1, iron);
    else if (rot === 3) p.hline(0, 9, 1, iron);
    else p.hline(2, 13, 1, iron);
    p.vline(3, 1, 4, iron);
    p.vline(12, 1, 4, iron);
    p.rect(2, 4, 12, 11, P.planks[1]);
    p.hline(2, 13, 4, P.planks[2]);
    p.hline(2, 13, 14, P.planks_dark[0]);
    p.rect(3, 5, 10, 9, FIT.panel);
    return p.outline(OUT);
  },
  snare(rot, st) {
    const p = spr();
    p.line(4, 25, 7, 17, '#7a5430');
    p.line(11, 25, 8, 17, '#7a5430');
    if (st) {
      // Sprung: a small catch hangs in the loop.
      p.ellipse(8, 21, 3, 2, '#b89878');
      p.set(6, 20, '#8a6a4a');
    } else {
      for (let a = 0; a < 12; a++) p.set(7.5 + Math.cos(a / 1.9) * 3, 23 + Math.sin(a / 1.9) * 1.5, '#e8e4d8');
    }
    return p.outline(OUT);
  },
  gravestone() {
    const p = spr();
    const s = ['#9a9aa4', '#72727c', '#b4b4be'];
    p.rect(4, 13, 8, 12, s[0]);
    p.hline(5, 10, 12, s[0]);
    p.hline(6, 9, 11, s[0]);
    p.vline(4, 13, 24, s[2]);
    p.vline(7, 14, 20, s[1]);
    p.hline(5, 9, 16, s[1]);
    p.rect(3, 25, 10, 1, '#5e3f28');
    return p.outline(OUT);
  },
  statue() {
    const p = spr(TALL_H);
    const m = P.marble;
    p.rect(1, 28, 14, 10, m[1]);
    p.rect(1, 28, 14, 3, m[0]);
    p.hline(1, 14, 28, '#ffffff');
    const g = ['#b8b8c4', '#9a9aa8', '#d0d0dc'];
    p.rect(6, 6, 4, 4, g[0]);
    p.rect(5, 10, 6, 9, g[0]);
    p.vline(5, 10, 18, g[2]);
    p.rect(5, 19, 2, 8, g[1]);
    p.rect(9, 19, 2, 8, g[1]);
    p.rect(11, 4, 1, 8, g[0]);
    p.rect(3, 11, 2, 6, g[1]);
    p.rect(10, 1, 3, 3, '#e0c040');
    return p.outline(OUT);
  },
  training_dummy() {
    const p = spr(TALL_H);
    p.rect(7, 10, 2, 28, P.planks_dark[0]);
    p.rect(1, 16, 14, 2, P.planks[1]);
    p.rect(4, 13, 8, 14, P.hay_bale[0]);
    for (let i = 0; i < 12; i++) p.set(4 + (i * 5) % 8, 13 + (i * 3) % 14, P.hay_bale[1]);
    p.ellipse(7.5, 19, 2, 2, '#f0ece0');
    p.ellipse(7.5, 19, 1, 1, '#c83a32');
    p.ellipse(7.5, 9, 3, 3, P.hay_bale[0]);
    return p.outline(OUT);
  },
  scarecrow() {
    const p = spr(TALL_H);
    p.rect(7, 12, 2, 26, P.planks_dark[0]);
    p.rect(1, 15, 14, 2, P.planks[1]);
    p.rect(4, 14, 8, 10, '#8a4a3a');
    p.vline(4, 14, 23, '#a45a48');
    p.set(1, 17, P.hay_bale[0]);
    p.set(14, 17, P.hay_bale[0]);
    p.ellipse(7.5, 9, 3, 3, '#e8d098');
    p.set(6, 9, '#2a1a10');
    p.set(9, 9, '#2a1a10');
    p.rect(3, 5, 10, 2, P.hay_bale[1]);
    p.rect(5, 2, 6, 3, P.hay_bale[0]);
    return p.outline(OUT);
  },
  pumpkin() {
    const p = spr();
    const o = ['#e07a20', '#b85a14', '#f09a40'];
    p.ellipse(7.5, 21, 6, 4, o[0]);
    p.vline(5, 18, 24, o[1]);
    p.vline(10, 18, 24, o[1]);
    p.hline(4, 8, 18, o[2]);
    p.rect(7, 15, 2, 3, '#4a7a2a');
    return p.outline(OUT);
  },
  cobweb() {
    const p = spr();
    const c = '#e8e8f0';
    p.line(0, 0, 15, 27, c);
    p.line(15, 0, 0, 27, c);
    p.line(8, 0, 8, 27, c);
    p.line(0, 13, 15, 13, c);
    for (let r = 3; r <= 7; r += 4) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        p.set(8 + Math.cos(ang) * r, 13 + Math.sin(ang) * r * 1.4, c);
      }
    }
    for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) p.d[i + 3] = 170;
    return p;
  },
  rock(rot, st, f, rand, v = 0) {
    const p = spr();
    const s = ['#8a8a92', '#68686f', '#a8a8b0'];
    p.ellipse(7 + (v % 2), 21, 5 + (v % 2), 4, s[0]);
    p.ellipse(6, 19, 2, 1, s[2]);
    p.hline(3, 11, 24, s[1]);
    return p.outline(OUT);
  },
  cactus(rot, st, f, rand) {
    const p = spr();
    const g = ['#4a9a3a', '#387a2c', '#62b44a'];
    p.rect(4, 0, 8, 26, g[0]);
    p.vline(4, 0, 25, g[2]);
    p.vline(11, 0, 25, g[1]);
    p.vline(7, 0, 25, g[1]);
    for (let y = 2; y < 25; y += 4) {
      p.set(3, y, '#f0e8c0');
      p.set(12, y + 2, '#f0e8c0');
    }
    return p.outline(OUT);
  },
};

// --- plants -------------------------------------------------------------------
function plantSprite(name, v, rand) {
  if (name === 'bones') return bonesSprite(v, rand);
  const ip = islePlant(name, v, rand);
  if (ip) return ip;
  const p = spr();
  const base = 25;
  const blade = (x, h, c, lean = 0) => {
    for (let k = 0; k < h; k++) p.set(x + Math.round((k / h) * lean), base - k, c);
  };
  switch (name) {
    case 'tall_grass': {
      const g = ['#5aa83a', '#76c04a', '#468a2e'];
      for (let i = 0; i < 9; i++) blade(2 + Math.floor(rand() * 12), 5 + Math.floor(rand() * 8), g[i % 3], Math.floor(rand() * 5) - 2);
      break;
    }
    case 'fern': {
      const g = ['#3e8a3a', '#58a84a'];
      for (let s = -1; s <= 1; s += 2) {
        for (let k = 0; k < 7; k++) {
          const x = 8 + s * k;
          const y = base - 8 + Math.round((k * k) / 6);
          p.set(x, y, g[0]);
          p.set(x, y - 1, g[1]);
          if (k % 2) p.set(x, y + 1, g[0]);
        }
      }
      blade(8, 10, g[0]);
      break;
    }
    case 'flower_red': case 'flower_yellow': case 'flower_blue': case 'flower_white': case 'flower_purple': {
      const col = { flower_red: ['#e03a3a', '#ff7a6a'], flower_yellow: ['#f0c830', '#fff080'], flower_blue: ['#3a7ae0', '#80b0ff'], flower_white: ['#f0f0f0', '#ffffc0'], flower_purple: ['#9a4ad0', '#c890ff'] }[name];
      const n = 2 + (v % 2);
      for (let i = 0; i < n; i++) {
        const x = 3 + Math.floor(rand() * 10);
        const h = 6 + Math.floor(rand() * 5);
        blade(x, h, '#4a8a2e');
        p.set(x - 1, base - 3, '#5aa83a');
        const y = base - h;
        p.set(x, y - 1, col[0]);
        p.set(x - 1, y, col[0]);
        p.set(x + 1, y, col[0]);
        p.set(x, y + 1, col[0]);
        p.set(x, y, col[1]);
      }
      break;
    }
    case 'bush': case 'berry_bush': {
      // Round shrub: dark body, lit from the top-left, leafy speckles.
      const g = name === 'berry_bush' ? ['#2a6428', '#1a4418', '#4a9a3a', '#6cc450'] : ['#347a2a', '#1e4e1a', '#5aae44', '#86d060'];
      p.ellipse(7.5, 19, 6, 5, g[0]);
      p.ellipse(8.5, 21, 5, 3, g[1]);
      p.ellipse(6, 17, 3, 2, g[2]);
      for (let i = 0; i < 16; i++) {
        const x = 3 + rand() * 10;
        const y = 15 + rand() * 9;
        if (p.alpha(x | 0, y | 0)) p.set(x, y, rand() < 0.4 ? g[3] : rand() < 0.5 ? g[1] : g[2]);
      }
      p.set(5, 16, g[3]);
      p.set(6, 15, g[3]);
      if (name === 'berry_bush') for (let i = 0; i < 7; i++) {
        const x = 3 + rand() * 10;
        const y = 16 + rand() * 7;
        if (p.alpha(x | 0, y | 0)) p.set(x, y, i % 2 ? '#e0304a' : '#ff6a80');
      }
      p.outline(OUT);
      break;
    }
    case 'dead_bush': {
      const c = '#8a6a44';
      p.line(8, base, 4, base - 7, c);
      p.line(8, base, 12, base - 8, c);
      p.line(8, base, 8, base - 9, c);
      p.line(5, base - 5, 3, base - 8, c);
      p.line(11, base - 5, 13, base - 6, c);
      break;
    }
    case 'reeds': {
      for (let i = 0; i < 4; i++) {
        const x = 3 + i * 3 + Math.floor(rand() * 2);
        const h = 12 + Math.floor(rand() * 8);
        blade(x, h, '#6a9a3a');
        p.rect(x, base - h - 3, 2, 4, '#7a4a28');
      }
      break;
    }
    case 'mushroom_red': case 'mushroom_brown': {
      const cap = name === 'mushroom_red' ? ['#d03a3a', '#f0f0f0'] : ['#9a6a40', '#c8a078'];
      const x = 5 + (v % 3) * 2;
      p.rect(x, base - 4, 2, 5, '#f0e8d8');
      p.ellipse(x + 0.5, base - 5, 3, 2, cap[0]);
      p.set(x - 1, base - 6, cap[1]);
      p.set(x + 2, base - 5, cap[1]);
      if (v % 2) {
        p.rect(11, base - 2, 1, 3, '#f0e8d8');
        p.ellipse(11, base - 3, 2, 1, cap[0]);
      }
      p.outline(OUT);
      break;
    }
    case 'herb': {
      for (let i = 0; i < 5; i++) {
        const x = 4 + Math.floor(rand() * 8);
        blade(x, 5 + Math.floor(rand() * 3), '#4aa84a');
        p.set(x - 1, base - 3, '#7ad07a');
        p.set(x + 1, base - 4, '#7ad07a');
      }
      p.set(6, base - 7, '#ffffff');
      p.set(10, base - 6, '#ffffff');
      break;
    }
    case 'sapling': {
      blade(8, 7, '#6a4a2e');
      p.ellipse(8, base - 8, 2, 2, '#4aa83a');
      p.set(6, base - 5, '#58b848');
      p.set(10, base - 4, '#58b848');
      break;
    }
    case 'wheat_crop': {
      for (let x = 1; x < 16; x += 2) {
        const h = 9 + Math.floor(rand() * 4);
        blade(x, h, '#b8a040');
        p.rect(x, base - h - 2, 1, 3, '#e8c850');
      }
      break;
    }
    case 'carrot_crop': {
      for (let x = 2; x < 15; x += 4) {
        p.set(x, base, '#f07a20');
        p.set(x + 1, base, '#f07a20');
        blade(x, 5, '#4aa83a', -1);
        blade(x + 1, 6, '#58b848', 1);
      }
      break;
    }
    case 'cabbage_crop': {
      for (const x of [4, 11]) {
        p.ellipse(x, base - 2, 3, 2, '#6ab84a');
        p.ellipse(x, base - 2, 1, 1, '#9ad870');
      }
      p.outline('#2e4a1e');
      break;
    }
    default:
      p.rect(6, 18, 4, 8, '#ff00ff');
  }
  return p;
}

// Growing crops: a sprite per stage, from sprouts to harvest.
function cropSprite(name, stage, stages, rand) {
  if (stage >= stages - 1) return plantSprite(name, 0, rand);
  const p = spr();
  const base = 25;
  const blade = (x, h, c, lean = 0) => {
    for (let k = 0; k < h; k++) p.set(x + Math.round((k / h) * lean), base - k, c);
  };
  const soilDots = () => {
    for (let x = 2; x < 15; x += 3) p.set(x, base, '#4a3020');
  };
  switch (name) {
    case 'wheat_crop':
      if (stage === 0) {
        soilDots();
        for (let x = 2; x < 15; x += 3) blade(x, 2 + Math.floor(rand() * 2), '#6ac84a');
      } else if (stage === 1) {
        for (let x = 1; x < 16; x += 2) blade(x, 4 + Math.floor(rand() * 3), '#58b040', Math.floor(rand() * 3) - 1);
      } else {
        for (let x = 1; x < 16; x += 2) {
          const h = 8 + Math.floor(rand() * 3);
          blade(x, h, '#6aa840');
          p.rect(x, base - h - 1, 1, 2, '#b8c860');
        }
      }
      break;
    case 'carrot_crop':
      if (stage === 0) {
        soilDots();
        for (let x = 2; x < 15; x += 4) {
          p.set(x, base - 1, '#6ac84a');
          p.set(x + 1, base - 2, '#58b848');
        }
      } else {
        for (let x = 2; x < 15; x += 4) {
          blade(x, 4, '#4aa83a', -1);
          blade(x + 1, 5, '#58b848', 1);
        }
      }
      break;
    case 'cabbage_crop': {
      const r = [1, 1.5, 2.2][stage] || 2;
      for (const x of [4, 11]) {
        p.ellipse(x, base - Math.ceil(r / 2), r + 0.5, Math.max(1, r - 0.5), stage === 0 ? '#7ac85a' : '#6ab84a');
        if (stage >= 2) p.set(x, base - 2, '#9ad870');
      }
      if (stage === 0) soilDots();
      p.outline('#2e4a1e');
      break;
    }
    default:
      return plantSprite(name, 0, rand);
  }
  return p;
}

function flatSprite(name, v, rand) {
  const dfl = dungeonFlat(name, v, rand);
  if (dfl) return dfl;
  const p = new Px(16, 16);
  if (name === 'lily_pad') {
    p.ellipse(7 + (v % 2), 8, 5, 4, '#3e8a2e');
    p.ellipse(6 + (v % 2), 7, 2, 1, '#58a840');
    p.line(7 + (v % 2), 8, 12, 6, '#2e6a22');
    if (v === 0) {
      p.set(9, 9, '#f090c0');
      p.set(10, 9, '#ffd0e8');
    }
    return p;
  }
  const col = { rug_red: ['#a83232', '#d8a040'], rug_blue: ['#32509a', '#d8c070'], rug_green: ['#32804a', '#e0d090'] }[name] || ['#888', '#aaa'];
  p.rect(1, 2, 14, 12, col[0]);
  p.rect(2, 3, 12, 10, col[1]);
  p.rect(3, 4, 10, 8, col[0]);
  p.rect(6, 6, 4, 4, col[1]);
  for (let x = 1; x < 15; x += 2) {
    p.set(x, 1, col[1]);
    p.set(x, 14, col[1]);
  }
  return p;
}

// Fence parts: post, east/west rail, north rail, south rail.
function fenceParts() {
  const w = P.planks;
  const post = spr();
  post.rect(6, 8, 4, 18, w[0]);
  post.vline(6, 8, 25, w[2]);
  post.hline(6, 9, 8, w[2]);
  post.outline(OUT);
  const east = spr();
  east.rect(9, 12, 7, 2, w[1]);
  east.rect(9, 18, 7, 2, w[1]);
  east.hline(9, 15, 12, w[2]);
  east.hline(9, 15, 18, w[2]);
  const west = new Px(16, SPR_H);
  west.blit(east, 0, 0, true);
  const north = spr();
  north.rect(7, 3, 2, 9, w[1]);
  north.vline(7, 3, 11, w[2]);
  const south = spr();
  south.rect(7, 14, 2, 10, w[1]);
  south.vline(7, 14, 23, w[2]);
  return { post, east, west, north, south };
}

function crackOverlay(stage) {
  const p = new Px(16, SPR_H);
  const rand = mulberry32(99 + stage);
  const n = 3 + stage * 5;
  for (let i = 0; i < n; i++) {
    let x = 8 + Math.floor(rand() * 5) - 2;
    let y = 14 + Math.floor(rand() * 5) - 2;
    const len = 3 + stage * 3;
    for (let k = 0; k < len; k++) {
      p.set(x, y, '#000000', 170);
      const r = rand();
      x += r < 0.33 ? -1 : r < 0.66 ? 1 : 0;
      y += rand() < 0.5 ? -1 : 1;
    }
  }
  return p;
}

// --- build --------------------------------------------------------------------
const CUBE_ROT_TOP = new Set(['thatch', 'roof_red', 'roof_slate', 'roof_wood', 'roof_green', 'roof_snow', 'roof_mushroom', 'roof_moss', 'roof_reed', ...FAR_ROT_TOP]);
const CUBE_ROT_FRONT = new Set(['bookshelf', 'arrow_slit', 'kav_emitter']);
const ANIM = { furnace: 2, torch: 3, lantern: 2, campfire: 3, bell: 4, oven: 2, maypole: 2, steam_vent: 4, ash_brazier: 3, glass_kiln: 3, spore_bed: 2, glass_lamp: 3, fog_lantern: 2, ...DANIM };
Object.assign(SPRITES, DSPRITES);
export { speckle, frontify, cobble, bricks, planks, randomWalk, spr, P, OUT };

export function buildTextures() {
  if (TEX.atlas) return TEX;
  Object.assign(SPRITES, ISLE_SPRITES);
  for (const b of BLOCKS) buildBlock(b, TEX);
  // Round 36: the islands' crafts (see CRAFTS): the same furniture made
  // again in each people's own wood and fittings.
  TEX.craft = [null];
  const oak = { planks: P.planks, planks_dark: P.planks_dark };
  for (const k of [1, 2, 3]) {
    const L = CRAFT_LOOKS[k];
    P.planks = L.planks;
    P.planks_dark = L.planks_dark;
    FIT = { ...FIT_OAK, ...L.fit };
    const T = { top: [], front: [], sprite: [] };
    for (const b of BLOCKS) if (CRAFTED.has(b.name)) buildBlock(b, T);
    const fp = fenceParts();
    T.fence = { post: addImage(fp.post), east: addImage(fp.east), west: addImage(fp.west), north: addImage(fp.north), south: addImage(fp.south) };
    TEX.craft.push(T);
  }
  P.planks = oak.planks;
  P.planks_dark = oak.planks_dark;
  FIT = FIT_OAK;
  finishTextures();
  return TEX;
}

// One block's faces and sprites, into `TEX` (or a craft's set of them).
function buildBlock(b, TEX) {
  {
    const id = b.id;
    const name = b.name;
    const seed = (k) => mulberry32(hash4(id, k, 0x7e57));
    if (b.render === 'cube' || b.render === 'liquid') {
      for (let rot = 0; rot < 4; rot++) {
        const needTopRot = CUBE_ROT_TOP.has(name);
        const needFrontRot = CUBE_ROT_FRONT.has(name);
        if (rot > 0 && !needTopRot) TEX.top[id * 4 + rot] = TEX.top[id * 4];
        else {
          const arr = [];
          const n = name === 'water' ? WATER_FRAMES : VARIANTS;
          for (let v = 0; v < n; v++) arr.push(addImage(name === 'water' ? waterTop(v) : cubeTop(name, v, seed(v * 10 + rot), rot)));
          TEX.top[id * 4 + rot] = arr;
        }
        if (rot > 0 && !needFrontRot) TEX.front[id * 4 + rot] = TEX.front[id * 4];
        else {
          const arr = [];
          const n = name === 'water' ? WATER_FRAMES : VARIANTS;
          for (let v = 0; v < n; v++) arr.push(addImage(name === 'water' ? waterFront(v) : cubeFront(name, v, seed(v * 10 + 5 + rot), rot)));
          TEX.front[id * 4 + rot] = arr;
        }
      }
    } else if (b.render === 'door') {
      const upper = name === 'door_top';
      for (let rot = 0; rot < 4; rot++) {
        TEX.top[id * 4 + rot] = [addImage(doorTop(rot))];
        TEX.front[id * 4 + rot] = [addImage(doorFront(upper, rot, seed(rot)))];
        TEX.sprite[id * 4 + rot] = [addImage(doorOpenSprite(rot, upper))];
      }
    } else if (b.render === 'sprite' || b.render === 'plant' || b.render === 'flat') {
      for (let rot = 0; rot < 4; rot++) {
        if (rot > 0 && !b.rotatable) {
          TEX.sprite[id * 4 + rot] = TEX.sprite[id * 4];
          continue;
        }
        const arr = [];
        if (b.render === 'plant' && CROPS[id]) for (let st = 0; st < CROPS[id].stages; st++) arr.push(addImage(cropSprite(name, st, CROPS[id].stages, seed(st))));
        else if (b.render === 'plant') for (let v = 0; v < VARIANTS; v++) arr.push(addImage(plantSprite(name, v, seed(v))));
        else if (b.render === 'flat') for (let v = 0; v < VARIANTS; v++) arr.push(addImage(flatSprite(name, v, seed(v))));
        else if (SPRITES[name]) {
          const frames = ANIM[name] || 1;
          const variants = name === 'rock' || name === 'bed' || name === 'canopy' || name === 'tent' || name === 'bunting' || name === 'festival_banner' ? VARIANTS : 1;
          // Layout: [state * 4 + frame] for animated props, or variants.
          for (let st = 0; st < 2; st++) {
            for (let f = 0; f < 4; f++) {
              if (variants > 1) arr.push(addImage(SPRITES[name](rot, st, 0, seed(f), f)));
              else arr.push(f < frames ? addImage(SPRITES[name](rot, st, f, seed(f))) : arr[st * 4]);
            }
          }
        } else arr.push(addImage(plantSprite(name, 0, seed(0))));
        TEX.sprite[id * 4 + rot] = arr;
      }
    }
  }
}

function finishTextures() {
  const fp = fenceParts();
  TEX.misc.fence = { post: addImage(fp.post), east: addImage(fp.east), west: addImage(fp.west), north: addImage(fp.north), south: addImage(fp.south) };
  for (let s = 0; s < 4; s++) TEX.crack.push(addImage(crackOverlay(s)));
  // Shadow blob for entities.
  const sh = new Px(16, 8);
  sh.ellipse(7.5, 3.5, 6, 2, '#000000');
  for (let i = 0; i < sh.d.length; i += 4) if (sh.d[i + 3]) sh.d[i + 3] = 90;
  TEX.misc.shadow = addImage(sh);

  // Pack into the atlas.
  const rows = Math.ceil(nextSlot / ATLAS_COLS);
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * SLOT_W;
  atlasCanvas.height = rows * SLOT_H;
  atlasCtx = atlasCanvas.getContext('2d');
  // Which atlas pixels are solid, for picking whatever is drawn under the
  // mouse pointer.
  const alpha = new Uint8Array(atlasCanvas.width * atlasCanvas.height);
  for (const { px, slot } of pending) {
    atlasCtx.putImageData(px.toImageData(), slot.x, slot.y);
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) alpha[(slot.y + y) * atlasCanvas.width + slot.x + x] = px.d[(y * px.w + x) * 4 + 3];
  }
  TEX.alpha = { w: atlasCanvas.width, data: alpha };
  // Average colours for the minimap.
  for (const b of BLOCKS) {
    const t = TEX.top[b.id * 4] || TEX.sprite[b.id * 4];
    if (!t || !t[0]) continue;
    const s = t[0];
    const data = atlasCtx.getImageData(s.x, s.y, s.w, Math.min(s.h, 16)).data;
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 100) continue;
      r += data[i];
      g += data[i + 1];
      bl += data[i + 2];
      n++;
    }
    TEX.avg[b.id] = n ? [r / n, g / n, bl / n] : [0, 0, 0];
  }
  pending.length = 0;
  TEX.atlas = atlasCanvas;
}

// (Round 62) Images put in after the atlas is made (a mod's blocks): added
// at its end, the atlas grown to fit (and its solid pixels with it). The
// slots they went in, in order. `resetLate` takes them all out again.
let base = null;
export function addLate(list) {
  if (!atlasCanvas) return list.map(() => null);
  if (!base) base = { slots: nextSlot, h: atlasCanvas.height };
  const slots = list.map((px) => addImage(px));
  const rows = Math.ceil(nextSlot / ATLAS_COLS);
  const H = rows * SLOT_H;
  if (H > atlasCanvas.height) {
    const c = document.createElement('canvas');
    c.width = atlasCanvas.width;
    c.height = H;
    const x = c.getContext('2d');
    x.drawImage(atlasCanvas, 0, 0);
    const alpha = new Uint8Array(c.width * H);
    alpha.set(TEX.alpha.data.subarray(0, Math.min(TEX.alpha.data.length, alpha.length)));
    atlasCanvas = c;
    atlasCtx = x;
    TEX.alpha = { w: c.width, data: alpha };
  }
  for (const { px, slot } of pending) {
    atlasCtx.clearRect(slot.x, slot.y, SLOT_W, SLOT_H);
    atlasCtx.putImageData(px.toImageData(), slot.x, slot.y);
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) TEX.alpha.data[(slot.y + y) * atlasCanvas.width + slot.x + x] = px.d[(y * px.w + x) * 4 + 3];
  }
  pending.length = 0;
  TEX.atlas = atlasCanvas;
  TEX.version = (TEX.version || 0) + 1;
  return slots;
}
export function resetLate() {
  if (!base || !atlasCanvas) return;
  nextSlot = base.slots;
  if (atlasCanvas.height > base.h) {
    const c = document.createElement('canvas');
    c.width = atlasCanvas.width;
    c.height = base.h;
    const x = c.getContext('2d');
    x.drawImage(atlasCanvas, 0, 0);
    atlasCanvas = c;
    atlasCtx = x;
    TEX.alpha = { w: c.width, data: TEX.alpha.data.slice(0, c.width * base.h) };
  }
  TEX.atlas = atlasCanvas;
  TEX.version = (TEX.version || 0) + 1;
}
// Average colour of some RGBA (for the minimap).
export function avgOf(d) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 100) continue;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n++;
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

function waterTop(frame) {
  const p = new Px(16, 16);
  const pal = P.water;
  const rand = mulberry32(4242);
  p.fill(pal[0], 215);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const w = Math.sin((x + frame * 4) * 0.8 + y * 1.3) + Math.sin((y - frame * 4) * 0.6 - x * 0.4);
      if (w > 1.5) p.set(x, y, pal[3], 225);
      else if (w > 1.0) p.set(x, y, pal[2], 220);
      else if (w < -1.5) p.set(x, y, pal[1], 215);
    }
  }
  if (rand() < 2) p.set((frame * 5) % 16, (frame * 7 + 3) % 16, '#e0f4ff', 240);
  return p;
}
function waterFront(frame) {
  const p = new Px(16, LH);
  p.fill(P.water[1], 225);
  for (let x = 0; x < 16; x++) if ((x + frame) % 5 === 0) p.set(x, 0, P.water[3], 230);
  p.hline(0, 15, LH - 1, shade(P.water[1], 0.7));
  return p;
}

export function atlas() {
  return atlasCanvas;
}
