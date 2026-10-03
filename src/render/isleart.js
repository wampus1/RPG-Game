// What the other Dagoni Islands are made of, drawn: Kharos's ash and black
// rock, its lava (four frames of it, slowly churning), its cinder trees
// and fire lilies and steam vents; Myrrow's moss and peat and heather, its
// mangroves, and the giant mushrooms of the fungal woods. And the islands'
// own goods, as icons. Hooked into textures.js and sprites.js.
import { Px, hex, shade } from './pixel.js';
import { speckle, frontify, cobble, spr, OUT } from './textures.js';
import { LH } from '../config.js';

export const ISLE_P = {
  ash: ['#7a7474', '#625c5c', '#928c8a', '#4a4444'],
  basalt: ['#3a3638', '#2a2628', '#4a4648', '#5a5456'],
  obsidian: ['#1e1824', '#140e1a', '#2e2638', '#6a5a8a'],
  cinder: ['#4a3a36', '#3a2a28', '#5e4842', '#c8502a'],
  sulfur: ['#d8c040', '#b8a030', '#ecd860', '#8a7a2a'],
  scorched: ['#3a2e28', '#2a201c', '#4a3c34', '#6a2a1a'],
  moss: ['#4a6a3a', '#3a5a2e', '#5e7e48', '#7a9a5a'],
  peat: ['#3e2e22', '#2e2218', '#4e3a2c', '#5a4a3a'],
  mycelium: ['#c8bcc8', '#aa9eb0', '#dcd2dc', '#8a6aa0'],
  lava: ['#e05a1a', '#a82a10', '#ffa030', '#ffe070'],
  roof_mushroom: ['#b83a2a', '#8a2a1e', '#f0e8d8', '#ffffff'],
  roof_moss: ['#4a6a3a', '#3a5a2e', '#5e7e48', '#9ab060'],
  roof_reed: ['#c8b070', '#a89050', '#e0cc90', '#5a4a30'],
};
export const ISLE_WOOD = {
  cinder: { bark: ['#2a2222', '#1a1414', '#3a302e'], ring: ['#7a4a2a', '#5a3018'] },
  mangrove: { bark: ['#6a5a44', '#4e4232', '#82705a'], ring: ['#b08a5a', '#8e6a40'] },
};
export const ISLE_LEAF = {
  ember: ['#c8441a', '#962e12', '#f07a2a'],
  mangrove: ['#3e7a4a', '#2e5e38', '#58a064'],
};

// --- cube tops ------------------------------------------------------------------
export function isleTop(name, v, rand, rot = 0) {
  const p = new Px(16, 16);
  const pal = ISLE_P[name];
  switch (name) {
    case 'roof_mushroom': {
      // (The cap of a giant mushroom: red, with pale spots, ridged.)
      const f = rot === 0 || rot === 3 ? 1.06 : rot === 2 ? 0.82 : 0.95;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, shade(y % 4 === 3 ? pal[1] : pal[0], f * (rand() < 0.06 ? 0.92 : 1)));
      for (let i = 0; i < 5; i++) {
        const sx = Math.floor(rand() * 14) + 1;
        const sy = Math.floor(rand() * 14) + 1;
        p.rect(sx, sy, 2, 2, shade(pal[2], f));
        p.set(sx, sy, shade(pal[3], f));
      }
      return p;
    }
    case 'roof_moss': {
      const f = rot === 0 || rot === 3 ? 1.05 : rot === 2 ? 0.82 : 0.95;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c = pal[(x * 7 + y * 3 + Math.floor(rand() * 3)) % 3];
        if (y % 5 === 4) c = shade(pal[1], 0.85);
        p.set(x, y, shade(c, f));
      }
      for (let i = 0; i < 4; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), shade(pal[3], f));
      return p;
    }
    case 'roof_reed': {
      // (Long reeds laid in courses, bound with a dark cord.)
      const f = rot === 0 || rot === 3 ? 1.06 : rot === 2 ? 0.8 : 0.94;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c = (x + Math.floor(y / 2)) % 3 === 0 ? pal[1] : pal[0];
        if (y % 6 === 5) c = pal[3];
        if (rand() < 0.05) c = pal[2];
        p.set(x, y, shade(c, f));
      }
      return p;
    }
    case 'ash': {
      speckle(p, pal, rand, 0.3);
      // Drifts and a few cinders in it.
      for (let i = 0; i < 2; i++) {
        const y = 2 + Math.floor(rand() * 12);
        for (let x = 0; x < 16; x++) if (Math.sin((x + v * 5) / 3) > 0.4) p.set(x, y, pal[2]);
      }
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, pal[3]);
      return p;
    }
    case 'basalt': {
      // Columns seen end-on: dark hexagonal cells with pale seams.
      p.fill(pal[0]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const cx = Math.floor((x + (Math.floor(y / 5) % 2) * 3) / 6);
        const cy = Math.floor(y / 5);
        const t = ((cx * 7 + cy * 13 + v) % 5) / 5;
        p.set(x, y, t < 0.3 ? pal[1] : t > 0.75 ? pal[2] : pal[0]);
        if ((x + (Math.floor(y / 5) % 2) * 3) % 6 === 0 || y % 5 === 0) p.set(x, y, pal[3]);
      }
      return p;
    }
    case 'obsidian': {
      speckle(p, pal, rand, 0.25);
      // Glassy glints and a purple sheen.
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(rand() * 13);
        const y = Math.floor(rand() * 13);
        p.set(x, y, pal[3]);
        p.set(x + 1, y + 1, shade(pal[3], 1.3));
        p.set(x + 2, y + 2, pal[3]);
      }
      return p;
    }
    case 'cinder': {
      cobble(p, pal, rand, 9);
      // Still glowing here and there.
      if (v < 2) p.set(rand() * 16, rand() * 16, pal[3]);
      return p;
    }
    case 'sulfur_crust': {
      speckle(p, ISLE_P.sulfur, rand, 0.4);
      for (let i = 0; i < 5; i++) p.set(rand() * 16, rand() * 16, ISLE_P.sulfur[3]);
      // Crystals.
      for (let i = 0; i < 2; i++) {
        const x = 2 + Math.floor(rand() * 12);
        const y = 2 + Math.floor(rand() * 12);
        p.set(x, y, '#fff4a0');
        p.set(x - 1, y, ISLE_P.sulfur[2]);
        p.set(x, y - 1, ISLE_P.sulfur[2]);
      }
      return p;
    }
    case 'scorched': {
      speckle(p, pal, rand, 0.35);
      for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * 16, i === 0 ? pal[3] : '#5a5450');
      return p;
    }
    case 'moss': {
      speckle(p, pal, rand, 0.4);
      // Cushions.
      for (let i = 0; i < 4; i++) p.ellipse(rand() * 16, rand() * 16, 1.6, 1.2, pal[3]);
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, pal[1]);
      return p;
    }
    case 'peat': {
      speckle(p, pal, rand, 0.3);
      // Cut lines and roots.
      for (let x = 0; x < 16; x++) if (rand() < 0.8) p.set(x, 7, pal[1]);
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, pal[3]);
      return p;
    }
    case 'mycelium': {
      speckle(p, pal, rand, 0.35);
      // Threads of it, and a purple spore stain.
      for (let k = 0; k < 2; k++) {
        let x = rand() * 16;
        let y = rand() * 16;
        for (let i = 0; i < 8; i++) {
          p.set(x, y, '#f0e8f0');
          x += rand() < 0.5 ? 1 : -1;
          y += rand() < 0.5 ? 1 : 0;
        }
      }
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, pal[3]);
      return p;
    }
    case 'lava': {
      // (Its variants are frames: the crust drifts and splits, the glow
      // pulses under it.)
      const f = v;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const w = Math.sin((x + f * 2) * 0.7 + y * 0.9) + Math.sin((y - f * 2) * 0.5 - x * 0.6) + Math.sin((x - y + f * 3) * 0.35);
        let c = pal[0];
        if (w > 1.6) c = pal[3];
        else if (w > 0.8) c = pal[2];
        else if (w < -1.4) c = '#3a1a14';
        else if (w < -0.6) c = pal[1];
        p.set(x, y, c);
      }
      return p;
    }
    case 'mushroom_stem': {
      // The cut top of a giant stem: rings of pale flesh.
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        p.set(x, y, d > 6.6 ? '#c8b8a8' : Math.floor(d * 0.8) % 2 ? '#e8dccc' : '#f4ece0');
      }
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1], [0, 15], [1, 15], [0, 14], [15, 15], [14, 15], [15, 14]]) p.clear(x, y);
      return p;
    }
    case 'mushroom_cap': case 'glowcap_cap': {
      const glow = name === 'glowcap_cap';
      const cap = glow ? ['#3a8ad0', '#2a6aa8', '#7ad0ff', '#d8f8ff'] : ['#b8402a', '#8a2e1e', '#d8603a', '#f4e8d8'];
      speckle(p, cap, rand, 0.25);
      // Spots (or glowing freckles).
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(rand() * 13);
        const y = 1 + Math.floor(rand() * 13);
        p.set(x, y, cap[3]);
        p.set(x + 1, y, cap[3]);
        if (!glow) p.set(x, y + 1, cap[3]);
      }
      // A soft rounded edge.
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1], [0, 15], [1, 15], [0, 14], [15, 15], [14, 15], [15, 14]]) p.clear(x, y);
      return p;
    }
    default:
      return null;
  }
}

// --- cube fronts ------------------------------------------------------------------
export function isleFront(name, v, rand) {
  const p = new Px(16, LH);
  switch (name) {
    case 'roof_mushroom': case 'roof_moss': case 'roof_reed': {
      // The roof's edge: its surface, and a dark eave under it.
      const top = isleTop(name, v, rand, 0);
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) {
        const c = top.get(x, y % 16);
        p.set(x, y, shade([c[0], c[1], c[2]], 0.85));
      }
      p.rect(0, LH - 3, 16, 3, name === 'roof_mushroom' ? '#e8dcc8' : '#2e2418');
      if (name === 'roof_mushroom') for (let x = 1; x < 16; x += 3) p.vline(x, LH - 3, LH - 1, '#c8b8a0');
      else for (let x = 0; x < 16; x += 2) p.set(x, LH - 1, ISLE_P[name][2]);
      return p;
    }
    case 'ash': case 'scorched': case 'moss': case 'mycelium': {
      // A skin of it over the dark earth beneath.
      const pal = ISLE_P[name];
      speckle(p, name === 'ash' ? ISLE_P.basalt : ISLE_P.peat, rand, 0.3);
      for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() < 0.4 ? 1 : 0);
        for (let y = 0; y < d; y++) p.set(x, y, y === d - 1 ? pal[1] : pal[0]);
        if (name === 'moss' && rand() < 0.2) p.set(x, d, pal[1]);
      }
      return frontify(p);
    }
    case 'basalt': {
      // The columns from the side: tall dark prisms.
      const pal = ISLE_P.basalt;
      for (let x = 0; x < 16; x++) {
        const col = Math.floor(x / 4);
        const c = [pal[0], pal[2], pal[1], pal[0]][(col + v) % 4];
        for (let y = 0; y < LH; y++) p.set(x, y, x % 4 === 0 ? pal[3] : c);
      }
      for (let i = 0; i < 2; i++) p.hline(Math.floor(rand() * 12), 15, Math.floor(rand() * LH), pal[1]);
      return frontify(p, 0.9);
    }
    case 'lava': {
      const pal = ISLE_P.lava;
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) {
        const w = Math.sin((x + v * 3) * 0.8 + y * 0.6);
        p.set(x, y, y === 0 ? pal[3] : w > 0.6 ? pal[2] : w < -0.6 ? pal[1] : pal[0]);
      }
      return p;
    }
    case 'mushroom_stem': {
      // Pale, fibrous, with the gills' shadow at the top.
      speckle(p, ['#e8dccc', '#d0c0ae', '#f4ece0'], rand, 0.2);
      for (let x = 1; x < 16; x += 3) for (let y = 0; y < LH; y++) if (rand() < 0.7) p.set(x, y, '#cab8a4');
      p.vline(0, 0, LH - 1, '#b8a894');
      p.vline(15, 0, LH - 1, '#b8a894');
      return frontify(p, 0.95);
    }
    case 'mushroom_cap': case 'glowcap_cap': {
      const glow = name === 'glowcap_cap';
      const cap = glow ? ['#3a8ad0', '#2a6aa8', '#7ad0ff'] : ['#b8402a', '#8a2e1e', '#d8603a'];
      speckle(p, cap, rand, 0.25);
      // The gills underneath, at the bottom edge.
      for (let x = 0; x < 16; x++) {
        p.set(x, LH - 1, x % 2 ? '#e8dccc' : '#c8b8a8');
        p.set(x, LH - 2, x % 2 ? '#d8ccbc' : cap[1]);
      }
      if (glow) for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * (LH - 3), '#d8f8ff');
      return frontify(p, 0.9);
    }
    default: {
      const t = isleTop(name, v, rand);
      if (!t) return null;
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, t.get(x, y), t.get(x, y)[3]);
      return frontify(p);
    }
  }
}

// --- plants -------------------------------------------------------------------------
export function islePlant(name, v, rand) {
  const p = spr();
  const base = 25;
  const blade = (x, h, c, lean = 0) => {
    for (let k = 0; k < h; k++) p.set(x + Math.round((k / h) * lean), base - k, c);
  };
  switch (name) {
    case 'heather': {
      // Low woody tufts covered in tiny purple bells.
      const n = 3 + (v % 2);
      for (let i = 0; i < n; i++) {
        const x = 2 + Math.floor(rand() * 12);
        const h = 3 + Math.floor(rand() * 4);
        blade(x, h, '#5a4a3a', Math.floor(rand() * 3) - 1);
        for (let k = 1; k < h + 1; k++) {
          if (rand() < 0.7) p.set(x + (rand() < 0.5 ? -1 : 1), base - k, rand() < 0.5 ? '#b070d0' : '#d8a0f0');
        }
        p.set(x, base - h - 1, '#c888e8');
      }
      return p;
    }
    case 'fire_lily': {
      // A tall stem and a flame-shaped flower, faintly glowing.
      const n = 1 + (v % 2);
      for (let i = 0; i < n; i++) {
        const x = 4 + Math.floor(rand() * 8);
        const h = 7 + Math.floor(rand() * 4);
        blade(x, h, '#4a5a2a');
        p.set(x - 1, base - 3, '#5a6a32');
        p.set(x + 1, base - 5, '#5a6a32');
        const y = base - h;
        p.set(x, y - 2, '#ffe070');
        p.set(x - 1, y - 1, '#ff7a2a');
        p.set(x, y - 1, '#ffb040');
        p.set(x + 1, y - 1, '#ff7a2a');
        p.set(x - 1, y, '#d8401a');
        p.set(x, y, '#ff7a2a');
        p.set(x + 1, y, '#d8401a');
      }
      return p;
    }
    default:
      return null;
  }
}

// --- sprites: the steam vent (a crusted mouth in the ground, puffing) ----------------
export const ISLE_SPRITES = {
  steam_vent(rot, st, f) {
    const p = spr();
    p.ellipse(8, 24, 5, 2, '#5a5040');
    p.ellipse(8, 24, 3, 1, '#2a2420');
    p.set(4, 23, '#d8c040');
    p.set(12, 24, '#d8c040');
    p.set(6, 25, '#ecd860');
    // The steam rising, a different curl each frame.
    for (let k = 0; k < 6; k++) {
      const y = 21 - k * 3 - (f % 2);
      const x = 8 + Math.round(Math.sin((k + f) * 1.3) * (1 + k * 0.4));
      const a = 200 - k * 30;
      p.set(x, y, '#f0f0f0', a);
      p.set(x + 1, y, '#e0e0e8', a - 20);
      if (k > 1) p.set(x - 1, y + 1, '#d8d8e0', a - 40);
    }
    return p;
  },
};
ISLE_SPRITES.ash_brazier = (rot, st, f) => {
  // A bowl of iron on a basalt foot, coals heaped in it, burning.
  const p = spr();
  p.rect(6, 18, 4, 8, '#3a3638');
  p.hline(6, 9, 18, '#5a5456');
  p.rect(5, 25, 6, 1, '#2a2628');
  p.rect(3, 15, 10, 3, '#4a4448');
  p.hline(3, 12, 15, '#6a6468');
  p.hline(4, 11, 17, '#2a2628');
  if (st) {
    const o = f % 3;
    p.rect(4, 14, 8, 1, '#c84a1a');
    p.rect(5, 9 + (o === 1 ? 1 : 0), 6, 5, '#e05a18');
    p.rect(6, 6 + o, 4, 6, '#f8a030');
    p.rect(7, 10, 2, 3, '#fff0a0');
    p.set(7 + (o === 2 ? 1 : 0), 4 + o, '#f8a030');
  } else p.rect(4, 14, 8, 1, '#3a2a24');
  return p.outline(OUT);
};
export const ISLE_ANIM = { steam_vent: 4 };

// --- icons ------------------------------------------------------------------------------
export function isleIcon(key) {
  const p = new Px(16, 16);
  switch (key) {
    case 'sulfur':
      p.ellipse(8, 9, 5, 4, '#d8c040');
      p.ellipse(7, 8, 2, 1, '#fff4a0');
      p.set(11, 11, '#8a7a2a');
      p.set(5, 11, '#b8a030');
      break;
    case 'peat_turf':
      p.rect(3, 6, 10, 6, '#3e2e22');
      p.rect(3, 6, 10, 2, '#4a6a3a');
      p.set(5, 9, '#5a4a3a');
      p.set(9, 10, '#2e2218');
      break;
    case 'moth_dust':
      p.ellipse(8, 10, 4, 3, '#4a3a5a');
      p.ellipse(8, 9, 3, 2, '#e8d8a0');
      p.set(6, 8, '#fff8d0');
      p.set(10, 9, '#fff8d0');
      p.set(5, 5, '#f0e0a0');
      p.set(11, 4, '#f0e0a0');
      p.set(8, 3, '#fff8d0');
      break;
    case 'obsidian_shard':
      p.line(5, 13, 10, 3, '#2e2638');
      p.line(6, 13, 11, 4, '#1e1824');
      p.line(7, 13, 12, 5, '#140e1a');
      p.set(9, 5, '#8a7aaa');
      p.set(8, 7, '#6a5a8a');
      break;
    case 'ember_pod':
      p.ellipse(8, 9, 3, 4, '#c8441a');
      p.ellipse(7, 8, 1, 2, '#f07a2a');
      p.vline(8, 3, 5, '#4a3a2a');
      p.set(9, 12, '#ffe070');
      break;
    case 'mangrove_pod':
      p.line(6, 3, 10, 13, '#5a7a3a');
      p.line(7, 3, 11, 13, '#3e5a2a');
      p.set(6, 3, '#8a6a40');
      break;
    case 'glowcap':
      p.vline(8, 9, 13, '#e8dccc');
      p.ellipse(8, 8, 5, 3, '#3a8ad0');
      p.ellipse(7, 7, 2, 1, '#7ad0ff');
      p.set(10, 8, '#d8f8ff');
      p.set(5, 8, '#d8f8ff');
      break;
    case 'crab_meat': case 'cooked_crab': {
      const c = key === 'cooked_crab' ? ['#e05a2a', '#ff8a4a'] : ['#c87a6a', '#e8a090'];
      p.ellipse(8, 9, 4, 3, c[0]);
      p.ellipse(7, 8, 2, 1, c[1]);
      p.line(3, 7, 1, 5, c[0]);
      p.line(13, 7, 15, 5, c[0]);
      p.set(1, 4, c[1]);
      p.set(15, 4, c[1]);
      for (const x of [5, 8, 11]) p.set(x, 12, c[0]);
      break;
    }
    case 'pepper_stew': case 'mushroom_broth': case 'crab_boil': {
      const top = { pepper_stew: '#c8341a', mushroom_broth: '#8a6a4a', crab_boil: '#e07a3a' }[key];
      p.ellipse(8, 10, 5, 3, '#6a4a3a');
      p.hline(4, 12, 11, '#4a3020');
      p.ellipse(8, 9, 4, 1, top);
      p.set(6, 9, key === 'mushroom_broth' ? '#e8dccc' : '#ffb040');
      p.set(10, 9, key === 'crab_boil' ? '#ff8a4a' : '#5a7a2a');
      break;
    }
    case 'ash_bread':
      p.ellipse(8, 9, 5, 3, '#8a6a48');
      p.ellipse(8, 8, 4, 2, '#a8865a');
      for (let i = 0; i < 4; i++) p.set(5 + i * 2, 8 + (i % 2), '#4a4444');
      break;
    case 'glowcap_tea':
      p.rect(5, 7, 6, 7, '#e8e0d0');
      p.rect(5, 7, 6, 1, '#3a8ad0');
      p.rect(11, 9, 2, 3, '#c8c0b0');
      p.set(7, 5, '#a8e8ff');
      p.set(9, 4, '#a8e8ff');
      break;
    case 'kelp_cakes':
      p.ellipse(7, 10, 4, 2, '#4a6a3a');
      p.ellipse(9, 8, 4, 2, '#5a7a48');
      p.set(8, 8, '#2e4a2a');
      p.set(10, 7, '#7a9a5a');
      break;
    case 'obsidian_blade':
      // Knapped black glass bound to a dark haft.
      for (let i = 0; i < 8; i++) {
        p.set(6 + i, 9 - i, '#2e2638');
        p.set(7 + i, 9 - i, '#1e1824');
        if (i % 2) p.set(6 + i, 8 - i, '#8a7aaa');
      }
      p.line(3, 13, 6, 10, '#2a2222');
      p.line(4, 13, 7, 10, '#3a302e');
      p.set(6, 11, '#c8441a');
      break;
    case 'harpoon':
      p.line(2, 14, 12, 4, '#6a5a44');
      p.line(3, 14, 13, 4, '#82705a');
      p.line(12, 4, 14, 2, '#c8c8d4');
      p.set(14, 2, '#f4f4ff');
      p.set(11, 3, '#9a9aa8');
      p.set(13, 5, '#9a9aa8');
      p.line(5, 12, 4, 15, '#d8d0b8');
      break;
    default:
      return null;
  }
  return p.outline(OUT);
}

// --- creatures ------------------------------------------------------------------
// Side on, facing left (the renderer flips them), 16 by 16, two frames.

// An ash lizard: long and low, grey as the ash with darker bands, a ridge
// of spines, a tail curling behind; its legs paddle as it goes.
function ashLizard(f, v) {
  const p = new Px(16, 16);
  const body = hex(['#8a8480', '#7a706a', '#9a8a7a'][v % 3]);
  const dark = shade(body, 0.66);
  const belly = shade(body, 1.2);
  p.rect(3, 10, 8, 3, body);
  p.hline(3, 10, 13, belly);
  p.rect(0, 10, 3, 2, body);
  p.set(0, 12, dark);
  p.set(1, 10, '#ffb040');
  for (let x = 4; x <= 10; x += 2) p.set(x, 9, dark);
  for (let x = 4; x <= 9; x += 3) p.vline(x + 1, 10, 12, dark);
  p.line(11, 11, 14, 12 - f, body);
  p.line(14, 12 - f, 15, 10 - f, dark);
  for (const [x, o] of [[4, f], [9, -f]]) {
    p.set(x + o, 13, dark);
    p.set(x + o - 1, 14, dark);
  }
  return p.outline(OUT);
}

// A magma crab: a rounded back of black rock, cracked and glowing orange
// in the cracks; claws up; legs scuttling.
function magmaCrab(f) {
  const p = new Px(16, 16);
  const rock = hex('#3a3236');
  p.ellipse(8, 10, 5, 3, rock);
  p.hline(4, 12, 8, shade(rock, 1.3));
  for (const [x, y] of [[6, 9], [7, 10], [9, 9], [10, 10], [8, 11]]) p.set(x, y, '#ff8030');
  p.set(8, 10, '#ffd060');
  for (let k = 0; k < 3; k++) {
    p.set(4 + k * 2 + f, 13, '#5a4a46');
    p.set(9 + k * 2 - f, 13, '#5a4a46');
  }
  p.rect(1, 6 - f, 3, 2, '#5a4246');
  p.set(1, 5 - f, '#ff8030');
  p.rect(12, 6 + f, 3, 2, '#5a4246');
  p.vline(5, 6, 7, '#5a4a46');
  p.vline(10, 6, 7, '#5a4a46');
  p.set(5, 5, '#1a1420');
  p.set(10, 5, '#1a1420');
  return p.outline(OUT);
}

// A cinderling: a hanging coal with a flame for a crown, two white-hot
// eyes, sparks trailing below (no outline: it's fire).
function cinderling(f) {
  const p = new Px(16, 16);
  const cy = 6 + (f % 2);
  p.ellipse(8, cy + 1, 4.5, 4.5, hex('#ff6020'), 80);
  p.ellipse(8, cy + 1, 3.2, 3.2, hex('#c8441a'), 230);
  p.ellipse(8, cy + 2, 2.2, 1.6, hex('#ffa030'), 255);
  for (let k = 0; k < 4; k++) p.set(7 + (k % 2) + (f ? 1 : 0), cy - 3 - k, hex(k < 2 ? '#ffd060' : '#ff8030'), 220 - k * 40);
  p.set(6, cy, '#fff8e0');
  p.set(10, cy, '#fff8e0');
  for (let k = 0; k < 3; k++) p.set(8 + (k % 2 ? 1 : -1) * (f ? 1 : 0), cy + 5 + k, hex('#ff8030'), 170 - k * 45);
  return p;
}

// A mire toad: squat and warty, olive and brown, a pale throat that puffs
// out (frame 1).
function mireToad(f, v) {
  const p = new Px(16, 16);
  const skin = hex(['#6a7a3a', '#5a6a40', '#7a6a3a'][v % 3]);
  const dark = shade(skin, 0.68);
  p.ellipse(8.5, 11, 5, 3.4, skin);
  p.ellipse(4.5, 10, 2.6, 2.2, skin);
  p.set(3, 8, '#e8d040');
  p.set(3, 9, '#1a1420');
  for (const [x, y] of [[7, 9], [10, 10], [12, 11], [9, 12]]) p.set(x, y, dark);
  if (f) p.ellipse(3.5, 12, 2, 1.5, hex('#e8e0b0'));
  p.rect(5, 13, 2, 2, dark);
  p.rect(11, 13, 3, 2, dark);
  return p.outline(OUT);
}

// A shroom crawler: a beetle-backed thing grown over with a red-capped
// mushroom and a pale glowcap or two; many small legs.
function shroomCrawler(f, v) {
  const p = new Px(16, 16);
  const shell = hex('#5a4a5a');
  p.ellipse(8, 11, 6, 2.6, shell);
  p.ellipse(8, 7, 4.5, 2.5, hex(['#b83a2a', '#a85a8a', '#c8862a'][v % 3]));
  p.vline(8, 8, 10, '#e8dcc8');
  for (const [x, y] of [[6, 6], [10, 7], [8, 5]]) p.set(x, y, '#f0ece0');
  p.ellipse(12.5, 8.5, 1.5, 1, hex('#9ae0e0'));
  p.vline(12, 9, 10, '#d8e8e0');
  p.rect(1, 10, 2, 2, shell);
  p.set(1, 10, '#c8f0a0');
  for (let k = 0; k < 4; k++) p.set(3 + k * 3 + ((k + f) % 2), 13 + ((k + f) % 2), '#3a2e3a');
  return p.outline(OUT);
}

// A gloam moth: broad soft wings, beating (frame 1 folds them), and a
// lit body like a little lamp (no outline: it's mostly light).
function gloamMoth(f) {
  const p = new Px(16, 16);
  const cy = 6 + (f % 2);
  const wing = hex('#c8b890');
  if (f) {
    p.ellipse(5, cy, 3.5, 2, wing, 220);
    p.ellipse(11, cy, 3.5, 2, wing, 220);
  } else {
    p.ellipse(4.5, cy - 1, 3.5, 3.5, wing, 220);
    p.ellipse(11.5, cy - 1, 3.5, 3.5, wing, 220);
    p.set(4, cy - 1, '#6a5a8a');
    p.set(12, cy - 1, '#6a5a8a');
  }
  p.vline(8, cy - 2, cy + 3, hex('#fff0a0'));
  p.set(8, cy - 1, '#ffffff');
  p.set(7, cy - 3, '#8a7a5a');
  p.set(9, cy - 3, '#8a7a5a');
  return p;
}

export const ISLE_CREATURES = {
  ash_lizard: { frames: 2, draw: (f, v) => ashLizard(f, v) },
  magma_crab: { frames: 2, draw: (f) => magmaCrab(f) },
  cinderling: { frames: 2, draw: (f) => cinderling(f) },
  mire_toad: { frames: 2, draw: (f, v) => mireToad(f, v) },
  shroom_crawler: { frames: 2, draw: (f, v) => shroomCrawler(f, v) },
  gloam_moth: { frames: 2, draw: (f) => gloamMoth(f) },
};
