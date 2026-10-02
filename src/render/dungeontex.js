// What dungeons are built of, drawn: the stone of barrows, crypts, mines
// and caves (a dark mass seen from above, worked faces on the walls), the
// traps and doors and stairs down there, and the Kavorent's own halls of
// dark alloy, seamed with cold light. Hooked into textures.js.
import { Px, shade } from './pixel.js';
import { speckle, frontify, cobble, bricks, randomWalk, spr, P, OUT } from './textures.js';
import { LH } from '../config.js';

const TALL = 40;
const KAV = { dark: '#1c1a2a', plate: '#2a2840', edge: '#3c3a58', seam: '#5ad8f0', glow: '#a8f4ff', rune: '#7ae0ff', deep: '#0e0c18' };
const EARTH = ['#3e3226', '#2e251c', '#52422f'];

// The top of a wall, where it's cut off: a dark mass (rock, earth, alloy)
// with a little texture, darker than any floor.
function massTop(p, pal, rand, bits = null) {
  speckle(p, pal, rand, 0.35);
  if (bits) for (let i = 0; i < 6; i++) p.set(rand() * 16, rand() * 16, bits[i % bits.length]);
  return p;
}

// --- cube tops ----------------------------------------------------------------
export function dungeonTop(name, v, rand) {
  const p = new Px(16, 16);
  switch (name) {
    case 'barrow_stone':
      massTop(p, EARTH, rand, ['#5a6a34', '#6a5a44', '#7a7a70']);
      // Roots through the turf.
      randomWalk(p, rand, rand() * 16, rand() * 16, 7, '#2a1e14');
      return p;
    case 'barrow_earth': {
      speckle(p, ['#4a3a2a', '#3a2e22', '#5a4834'], rand, 0.3);
      for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * 16, i === 0 && v === 0 ? '#d8d0b8' : '#6a6458');
      return p;
    }
    case 'crypt_brick':
      massTop(p, ['#2e3038', '#22242a', '#3a3c46'], rand, ['#3a5a3a', '#4a4c58']);
      return p;
    case 'crypt_floor':
      cobble(p, ['#4a4e5a', '#2e3038', '#5e6270'], rand, 4);
      if (v === 1) p.set(rand() * 16, rand() * 16, '#3a5a3a');
      return p;
    case 'mine_rock':
      massTop(p, ['#4a4440', '#36322e', '#5a544e'], rand, ['#2a2622']);
      return p;
    case 'mine_beam':
      massTop(p, ['#4a4440', '#36322e', '#5a544e'], rand);
      p.rect(0, 6, 16, 4, '#5a3e24');
      p.hline(0, 15, 6, '#7a5634');
      p.hline(0, 15, 9, '#3a2816');
      return p;
    case 'cave_rock':
      massTop(p, ['#5a4e44', '#463c34', '#6a5e52'], rand, ['#3a322a', '#7a6e60']);
      return p;
    case 'cracked_floor':
      cobble(p, ['#5a5650', '#3a3632', '#6e6a62'], rand, 4);
      randomWalk(p, rand, 3 + rand() * 4, 2, 14, '#1e1a16');
      randomWalk(p, rand, 10, 6 + rand() * 4, 9, '#1e1a16');
      return p;
    case 'weak_wall':
      massTop(p, ['#5a5650', '#46423c', '#6e6a62'], rand);
      randomWalk(p, rand, 8, 0, 14, '#2a2622');
      return p;
    case 'arrow_slit':
      massTop(p, ['#4a4a52', '#36363e', '#5a5a64'], rand);
      return p;
    case 'stairs_down': {
      // Steps going down into the dark, northward.
      for (let y = 0; y < 16; y++) {
        const step = Math.floor(y / 4);
        const f = 0.25 + step * 0.22;
        for (let x = 0; x < 16; x++) p.set(x, y, shade('#7a7468', f * (x === 0 || x === 15 ? 0.7 : 1)));
        if (y % 4 === 3) p.hline(1, 14, y, shade('#9a9488', f * 1.2));
      }
      p.rect(0, 0, 16, 2, '#0a0808');
      return p;
    }
    case 'sinkhole': {
      speckle(p, ['#5a4632', '#463626', '#6a5440'], rand, 0.3);
      p.ellipse(8, 8, 6.5, 6, '#2a1e16');
      p.ellipse(8, 8.5, 5.5, 5, '#120c0a');
      // Broken steps leading down into it.
      for (let i = 0; i < 3; i++) p.hline(5, 10, 10 + i * 2, shade('#6a6458', 0.6 - i * 0.15));
      for (let i = 0; i < 8; i++) p.set(2 + rand() * 12, 2 + rand() * 12, '#3a2c20');
      return p;
    }
    case 'mine_shaft': {
      speckle(p, ['#5a4e44', '#463c34', '#6a5e52'], rand, 0.3);
      p.rect(2, 2, 12, 12, '#5a3e24');
      p.rect(3, 3, 10, 10, '#0c0a08');
      p.hline(2, 13, 2, '#7a5634');
      p.vline(2, 2, 13, '#7a5634');
      // The ladder going down.
      p.vline(6, 3, 12, '#6a4a2a');
      p.vline(9, 3, 12, '#6a4a2a');
      for (let y = 4; y < 13; y += 2) p.hline(6, 9, y, shade('#6a4a2a', 1.1 - (y - 4) * 0.08));
      return p;
    }
    case 'rubble_seal': {
      speckle(p, ['#6a645a', '#4a463e', '#7e786c'], rand, 0.4);
      for (let i = 0; i < 6; i++) {
        const x = 1 + rand() * 12;
        const y = 1 + rand() * 12;
        p.rect(x, y, 3, 2, '#8a8478');
        p.hline(x, x + 2, y + 2, '#3a3630');
      }
      return p;
    }
    case 'kav_pillar': case 'kav_wall': {
      p.fill(KAV.plate);
      // Panels: a fine grid of seams, a dim etched hex here and there.
      for (let i = 0; i < 16; i++) {
        p.set(i, 0, KAV.edge);
        p.set(0, i, KAV.edge);
      }
      p.hline(1, 15, 8, KAV.dark);
      p.vline(8, 1, 15, KAV.dark);
      if (v % 2 === 0) for (const [x, y] of [[3, 3], [4, 3], [5, 4], [4, 5], [3, 5], [2, 4]]) p.set(x + 8 * (v >> 1), y, '#3e3c5e');
      if (name === 'kav_wall' && v === 3) randomWalk(p, rand, 4, 4, 9, KAV.deep);
      return p;
    }
    case 'kav_floor': {
      p.fill('#24223a');
      // Hexagonal tiles, their seams faintly alight.
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const row = Math.floor(y / 4);
        const xx = (x + (row % 2) * 4) % 8;
        if (y % 4 === 0 || xx === 0) p.set(x, y, '#2e2c4c');
      }
      if (v === 0) {
        p.set(4, 4, KAV.seam);
        p.set(12, 8, '#3a8aa0');
      }
      return p;
    }
    case 'kav_glow': {
      p.fill(KAV.plate);
      p.rect(0, 7, 16, 2, KAV.seam);
      p.hline(0, 15, 7, KAV.glow);
      p.hline(0, 15, 6, '#3a6a80');
      p.hline(0, 15, 9, '#3a6a80');
      return p;
    }
    case 'kav_lift': {
      p.fill('#24223a');
      p.ellipse(8, 8, 7, 7, '#3a3858');
      p.ellipse(8, 8, 6, 6, '#2a2840');
      for (let a = 0; a < 24; a++) {
        const t = (a / 24) * Math.PI * 2;
        p.set(8 + Math.cos(t) * 6.5, 8 + Math.sin(t) * 6.5, a % 3 ? KAV.seam : KAV.glow);
      }
      p.rect(7, 7, 2, 2, KAV.seam);
      return p;
    }
    case 'kav_debris': {
      speckle(p, ['#2a2840', '#1c1a2a', '#3a3858'], rand, 0.4);
      for (let i = 0; i < 4; i++) {
        const x = rand() * 12;
        const y = rand() * 12;
        p.line(x, y, x + 3, y + 1, '#4a4868');
        p.set(x + 1, y, '#5ad8f0');
      }
      return p;
    }
    case 'kav_emitter': {
      p.fill(KAV.plate);
      p.ellipse(8, 8, 3, 3, '#3a1018');
      p.ellipse(8, 8, 1.5, 1.5, '#ff4050');
      return p;
    }
  }
  return null;
}

// --- cube fronts (the wall faces you see) --------------------------------------
export function dungeonFront(name, v, rand, rot) {
  const p = new Px(16, LH);
  switch (name) {
    case 'barrow_stone': {
      // Big fieldstones stacked dry, earth between, moss on the tops.
      cobble(p, ['#6a6458', '#3a3228', '#827c70'], rand, 5);
      for (let i = 0; i < 4; i++) p.set(rand() * 16, rand() * 3, '#4a6a2e');
      return frontify(p, 0.85);
    }
    case 'barrow_earth':
      speckle(p, ['#4a3a2a', '#3a2e22', '#5a4834'], rand, 0.3);
      return frontify(p, 0.8);
    case 'crypt_brick': {
      bricks(p, ['#4a4c58', '#22242a', '#5a5c6a'], rand, 4, 8);
      // Damp running down it.
      for (let i = 0; i < 2; i++) {
        const x = Math.floor(rand() * 16);
        for (let y = 0; y < LH; y++) if (rand() < 0.7) p.set(x, y, shade(p.get(x, y), 0.7));
      }
      if (v === 2) p.set(rand() * 16, 1, '#3a6a3a');
      return frontify(p, 0.85);
    }
    case 'crypt_floor':
      cobble(p, ['#4a4e5a', '#2e3038', '#5e6270'], rand, 3);
      return frontify(p, 0.8);
    case 'mine_rock': case 'cave_rock': {
      const pal = name === 'mine_rock' ? ['#5a544e', '#3a3632', '#6e6860'] : ['#6a5e52', '#4a4038', '#7e7264'];
      speckle(p, pal, rand, 0.3);
      // Strata, and pick marks in a mine.
      for (let k = 0; k < 2; k++) {
        const y0 = 2 + Math.floor(rand() * (LH - 4));
        for (let x = 0; x < 16; x++) p.set(x, y0 + Math.round(Math.sin(x / 3 + k) * 0.6), shade(pal[1], 0.9));
      }
      if (name === 'mine_rock') for (let i = 0; i < 3; i++) {
        const x = 2 + rand() * 11;
        const y = 2 + rand() * 7;
        p.line(x, y, x + 2, y + 2, '#2a2622');
      }
      return frontify(p, 0.85);
    }
    case 'mine_beam': {
      speckle(p, ['#5a544e', '#3a3632', '#6e6860'], rand, 0.3);
      const w = ['#6a4a2a', '#4a321c', '#7e5a36'];
      p.rect(1, 0, 3, LH, w[0]);
      p.rect(12, 0, 3, LH, w[0]);
      p.vline(1, 0, LH - 1, w[2]);
      p.vline(12, 0, LH - 1, w[2]);
      p.rect(0, 0, 16, 3, w[0]);
      p.hline(0, 15, 0, w[2]);
      p.hline(0, 15, 2, w[1]);
      return frontify(p, 0.9);
    }
    case 'cracked_floor':
      cobble(p, ['#5a5650', '#3a3632', '#6e6a62'], rand, 3);
      return frontify(p, 0.8);
    case 'weak_wall': {
      bricks(p, ['#6a665e', '#3a3630', '#7e7a70'], rand, 4, 8, '#8a8678');
      randomWalk(p, rand, 4 + rand() * 8, 0, 16, '#1e1a16');
      for (let i = 0; i < 4; i++) p.set(rand() * 16, LH - 1 - rand() * 2, '#9a968a');
      return frontify(p, 0.85);
    }
    case 'arrow_slit': {
      bricks(p, ['#5a5a64', '#2e2e36', '#6a6a76'], rand, 4, 8);
      if (rot === 0) {
        p.rect(7, 2, 2, 8, '#0a0a0e');
        p.vline(6, 2, 9, '#3a3a42');
      }
      return frontify(p, 0.85);
    }
    case 'stairs_down': case 'sinkhole': case 'mine_shaft': case 'rubble_seal':
      speckle(p, ['#5a4e44', '#463c34', '#6a5e52'], rand, 0.3);
      return frontify(p, 0.8);
    case 'kav_pillar': case 'kav_wall': {
      p.fill(KAV.plate);
      // Tall panels with a thin seam of cold light between them.
      const sx = v % 2 ? 7 : 11;
      p.vline(sx, 0, LH - 1, KAV.dark);
      p.vline(sx + 1, 1, LH - 2, v === 0 ? KAV.seam : '#2e5a6a');
      p.hline(0, 15, 0, KAV.edge);
      p.hline(0, 15, LH - 1, KAV.deep);
      p.set(2, 2, '#4a4870');
      p.set(14, 2, '#4a4870');
      if (name === 'kav_wall' && v === 3) randomWalk(p, rand, 3, 2, 8, KAV.deep);
      return p;
    }
    case 'kav_floor': case 'kav_lift': case 'kav_debris':
      p.fill('#24223a');
      p.hline(0, 15, 0, KAV.edge);
      p.hline(0, 15, LH - 1, KAV.deep);
      if (name === 'kav_lift') p.hline(2, 13, 4, KAV.seam);
      return p;
    case 'kav_glow':
      p.fill(KAV.plate);
      p.rect(0, 4, 16, 3, KAV.seam);
      p.hline(0, 15, 5, KAV.glow);
      p.hline(0, 15, 0, KAV.edge);
      return p;
    case 'kav_emitter':
      p.fill(KAV.plate);
      if (rot === 0) {
        p.ellipse(8, 6, 3, 3, '#3a1018');
        p.ellipse(8, 6, 1.5, 1.5, '#ff4050');
        p.set(8, 5, '#ffd0d0');
      }
      p.hline(0, 15, 0, KAV.edge);
      return p;
  }
  return null;
}

// --- flat things on the floor ---------------------------------------------------
export function dungeonFlat(name, v, rand) {
  if (name === 'pressure_plate') {
    // A flagstone that sits a hair proud of the rest: hard to see, if you
    // aren't looking.
    const p = new Px(16, 16);
    p.rect(3, 3, 10, 10, '#6a665e');
    p.hline(3, 12, 3, '#8a8678');
    p.vline(3, 3, 12, '#8a8678');
    p.hline(3, 12, 12, '#2e2a26');
    p.vline(12, 3, 12, '#2e2a26');
    for (let i = 0; i < 3; i++) p.set(4 + rand() * 8, 4 + rand() * 8, '#5a564e');
    return p;
  }
  if (name === 'kav_plate') {
    const p = new Px(16, 16);
    p.rect(2, 2, 12, 12, '#2a2840');
    p.hline(2, 13, 2, KAV.edge);
    p.vline(2, 2, 13, KAV.edge);
    // Its glyph.
    const g = [[5, 5], [6, 5], [7, 5], [10, 5], [5, 6], [8, 6], [10, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [7, 8], [7, 9], [6, 10], [8, 10], [5, 10], [9, 10]];
    for (const [x, y] of g) p.set(x, y, v % 2 ? KAV.seam : KAV.rune);
    return p;
  }
  return null;
}

// Old bones on the floor: a skull, a thighbone or two.
export function bonesSprite(v, rand) {
  const p = spr();
  const b = ['#d8d0b8', '#a8a088', '#f0ead8'];
  const n = 2 + (v % 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(rand() * 10);
    const y = 17 + Math.floor(rand() * 8);
    p.line(x, y, x + 3, y + (rand() < 0.5 ? 1 : -1), b[1]);
    p.set(x, y, b[0]);
    p.set(x + 3, y, b[0]);
  }
  if (v !== 3) {
    const x = 4 + Math.floor(rand() * 7);
    p.rect(x, 18, 4, 3, b[0]);
    p.hline(x + 1, x + 2, 21, b[0]);
    p.set(x + 1, 19, '#2a2622');
    p.set(x + 3, 19, '#2a2622');
    p.set(x, 18, b[2]);
  }
  return p.outline(OUT);
}

// --- props ---------------------------------------------------------------------
const STONE = ['#7a7a84', '#55555e', '#9a9aa4'];
const IRON = ['#4a4a54', '#2e2e36', '#6a6a76'];

export const DSPRITES = {
  coffin(rot, st) {
    const p = spr();
    const w = P.planks_dark;
    const side = rot === 1 || rot === 3;
    if (side) {
      p.rect(3, 13, 10, 13, w[1]);
      p.rect(4, 14, 8, 11, st ? '#120c0a' : w[0]);
      if (!st) p.vline(8, 14, 24, w[2]);
    } else {
      p.rect(1, 16, 14, 9, w[1]);
      p.rect(2, 17, 12, 7, st ? '#120c0a' : w[0]);
      if (!st) {
        p.hline(2, 13, 20, w[2]);
        p.rect(6, 18, 1, 5, '#a8a088');
        p.rect(4, 19, 5, 1, '#a8a088');
      }
    }
    // An open one: the lid shoved half off, askew.
    if (st) {
      p.rect(side ? 9 : 8, side ? 12 : 13, side ? 5 : 8, side ? 9 : 4, w[0]);
      p.hline(side ? 9 : 8, side ? 13 : 15, side ? 12 : 13, w[2]);
    }
    return p.outline(OUT);
  },
  sarcophagus(rot, st) {
    const p = spr();
    const side = rot === 1 || rot === 3;
    const w = side ? 10 : 14;
    const x = side ? 3 : 1;
    p.rect(x, 15, w, 11, STONE[1]);
    p.rect(x, 13, w, 4, st ? '#120c0a' : STONE[0]);
    p.hline(x, x + w - 1, 13, STONE[2]);
    if (!st) {
      // A carved figure on the lid.
      p.rect(x + (side ? 3 : 5), 14, 4, 2, STONE[2]);
      p.set(x + (side ? 4 : 6), 13, '#e8e0c0');
    } else {
      p.rect(x + w - 6, 11, 7, 4, STONE[0]);
      p.hline(x + w - 6, x + w, 11, STONE[2]);
    }
    for (let i = 0; i < w; i += 3) p.set(x + i, 20, STONE[2]);
    return p.outline(OUT);
  },
  lever(rot, st) {
    const p = spr();
    p.rect(5, 22, 6, 4, IRON[0]);
    p.hline(5, 10, 22, IRON[2]);
    const tip = st ? [12, 12] : [4, 12];
    p.line(8, 22, tip[0], tip[1], '#6a4a2a');
    p.line(8, 21, tip[0], tip[1] - 1, '#8a6a40');
    p.rect(tip[0] - 1, tip[1] - 2, 3, 3, st ? '#3ab048' : '#c83a32');
    return p.outline(OUT);
  },
  portcullis(rot) {
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (front) {
      for (let x = 1; x < 16; x += 3) p.vline(x, 4, 39, IRON[0]);
      for (let y = 8; y < 40; y += 6) p.hline(0, 15, y, IRON[1]);
      for (let x = 1; x < 16; x += 3) p.set(x, 39, IRON[2]);
    } else {
      p.rect(6, 4, 3, 36, IRON[0]);
      p.vline(7, 4, 39, IRON[2]);
    }
    return p.outline(OUT);
  },
  portcullis_up(rot) {
    // Raised: only its spiked foot shows, high up under the lintel.
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (front) {
      for (let x = 1; x < 16; x += 3) {
        p.vline(x, 0, 6, IRON[0]);
        p.set(x, 7, IRON[2]);
      }
      p.hline(0, 15, 3, IRON[1]);
    } else p.rect(6, 0, 3, 7, IRON[0]);
    return p.outline(OUT);
  },
  sealed_door(rot) {
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (!front) {
      p.rect(5, 2, 6, 38, STONE[1]);
      p.vline(7, 2, 39, STONE[2]);
      return p.outline(OUT);
    }
    p.rect(0, 2, 16, 38, STONE[1]);
    p.rect(1, 3, 14, 36, STONE[0]);
    p.vline(8, 3, 38, STONE[1]);
    // The sigil cut in it, faintly glowing.
    p.ellipse(8, 18, 4, 4, '#3a3a44');
    p.ellipse(8, 18, 3, 3, '#5a4a2a');
    for (const [x, y] of [[8, 15], [8, 21], [5, 18], [11, 18], [8, 18]]) p.set(x, y, '#e8c060');
    p.hline(0, 15, 2, STONE[2]);
    return p.outline(OUT);
  },
  stairs_up(rot) {
    const p = spr();
    for (let i = 0; i < 4; i++) {
      const y = 24 - i * 4;
      const c = shade('#8a8478', 1 - i * 0.1);
      p.rect(1, y - 3, 14, 4, c);
      p.hline(1, 14, y - 3, shade(c, 1.2));
    }
    p.rect(0, 9, 1, 17, '#3a3632');
    p.rect(15, 9, 1, 17, '#3a3632');
    return p.outline(OUT);
  },
  brazier(rot, st, f) {
    const p = spr();
    p.line(4, 26, 7, 18, IRON[0]);
    p.line(12, 26, 9, 18, IRON[0]);
    p.vline(8, 18, 26, IRON[1]);
    p.rect(3, 14, 10, 4, IRON[0]);
    p.hline(3, 12, 14, IRON[2]);
    p.rect(4, 13, 8, 1, '#2a2622');
    if (st) {
      const fl = [[0, 0], [1, -1], [-1, 0]][f % 3];
      p.rect(4 + fl[0], 8 + fl[1], 8, 5, '#e85a18');
      p.rect(5 + fl[0], 5 + fl[1], 6, 6, '#f8a830');
      p.rect(7, 3 + fl[1], 2, 5, '#fff0a0');
      p.set(6 + fl[0], 2, '#f8a830');
    } else {
      p.rect(5, 12, 6, 1, '#3a3632');
      p.set(7, 11, '#5a5650');
    }
    return p.outline(OUT);
  },
  barrow_door() {
    const p = spr(TALL);
    // Two standing stones and a lintel, a slab of old wood between.
    p.rect(0, 6, 4, 34, STONE[1]);
    p.rect(12, 6, 4, 34, STONE[1]);
    p.vline(0, 6, 39, STONE[2]);
    p.vline(12, 6, 39, STONE[2]);
    p.rect(0, 2, 16, 5, STONE[0]);
    p.hline(0, 15, 2, STONE[2]);
    p.rect(4, 7, 8, 33, '#3a2a1a');
    for (let x = 5; x < 12; x += 2) p.vline(x, 8, 39, '#2a1e12');
    p.rect(9, 22, 2, 2, IRON[2]);
    // Runes on the lintel.
    for (const x of [3, 6, 9, 12]) p.set(x, 4, '#c8b890');
    return p.outline(OUT);
  },
  cave_mouth() {
    const p = spr(TALL);
    const rock = ['#6a5e52', '#4a4038', '#7e7264'];
    for (let y = 2; y < 40; y++) for (let x = 0; x < 16; x++) p.set(x, y, rock[(x * 7 + y * 3) % 5 === 0 ? 1 : 0]);
    p.ellipse(8, 30, 6, 12, '#0a0806');
    p.rect(2, 30, 12, 10, '#0a0806');
    p.hline(0, 15, 2, rock[2]);
    return p.outline(OUT);
  },
  kav_door(rot, st, f) {
    const p = spr(TALL);
    p.rect(0, 0, 3, 40, KAV.plate);
    p.rect(13, 0, 3, 40, KAV.plate);
    p.rect(0, 0, 16, 4, KAV.plate);
    p.vline(2, 4, 39, f % 2 ? KAV.glow : KAV.seam);
    p.vline(13, 4, 39, f % 2 ? KAV.glow : KAV.seam);
    p.hline(2, 13, 3, KAV.seam);
    // The light inside.
    for (let y = 4; y < 40; y++) for (let x = 3; x < 13; x++) p.set(x, y, shade('#5ad8f0', 0.25 + (y / 40) * 0.25), 140);
    return p;
  },
  kav_field(rot, st, f) {
    const p = spr(TALL);
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 16; x++) {
        const line = (y + f * 2) % 6 === 0 || (x + Math.floor(y / 6)) % 8 === 0;
        p.set(x, y, line ? KAV.glow : KAV.seam, line ? 190 : 70);
      }
    }
    return p;
  },
  kav_console(rot, st, f) {
    const p = spr();
    p.rect(5, 16, 6, 10, KAV.plate);
    p.vline(5, 16, 25, KAV.edge);
    p.rect(2, 10, 12, 7, KAV.dark);
    p.rect(3, 11, 10, 5, st ? '#1a4a3a' : '#0e2a38');
    // The glyphs on its face, scrolling.
    for (let i = 0; i < 6; i++) p.set(4 + ((i * 3 + f) % 9), 12 + (i % 3), st ? '#7affb0' : KAV.rune);
    return p.outline(OUT);
  },
  kav_node(rot, st, f) {
    const p = spr();
    p.rect(4, 22, 8, 4, KAV.plate);
    p.hline(4, 11, 22, KAV.edge);
    const c = st ? ['#c8fff0', '#5af0c8', '#2a8a7a'] : ['#5a7a88', '#3a5060', '#2a3440'];
    const h = f % 2 ? 0 : 1;
    p.rect(6, 10 + h, 4, 12 - h, c[1]);
    p.rect(7, 8 + h, 2, 3, c[0]);
    p.vline(6, 10 + h, 21, c[2]);
    if (st) p.set(8, 7 + h, '#ffffff');
    return p.outline(OUT);
  },
  kav_seal(rot, st, f) {
    const p = spr(TALL);
    p.rect(0, 2, 16, 38, KAV.plate);
    p.rect(1, 3, 14, 36, '#24223a');
    p.vline(8, 3, 38, KAV.dark);
    p.ellipse(8, 20, 5, 5, KAV.dark);
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2 + f * 0.4;
      p.set(8 + Math.cos(t) * 4.5, 20 + Math.sin(t) * 4.5, a % 2 ? KAV.seam : KAV.glow);
    }
    p.rect(7, 19, 3, 3, KAV.rune);
    return p.outline(OUT);
  },
  kav_cache(rot, st) {
    const p = spr();
    p.rect(2, 14, 12, 12, KAV.plate);
    p.rect(2, 12, 12, 3, st ? KAV.dark : '#3a3858');
    p.hline(2, 13, 12, KAV.edge);
    p.hline(2, 13, 18, KAV.seam);
    p.rect(7, 16, 2, 4, KAV.glow);
    return p.outline(OUT);
  },
  // A realm's coldfire lamp: a slim alloy post, a lens of cold light on top
  // that breathes slowly.
  kav_lamp(rot, st, f) {
    const p = spr(TALL);
    p.rect(7, 12, 2, 28, KAV.plate);
    p.vline(7, 12, 39, KAV.edge);
    p.rect(5, 36, 6, 4, KAV.dark);
    p.hline(5, 10, 36, KAV.edge);
    const g = [KAV.glow, '#c8fbff', KAV.glow, KAV.seam][f % 4];
    p.rect(5, 4, 6, 8, KAV.dark);
    p.rect(6, 5, 4, 6, g);
    p.set(7, 6, '#ffffff');
    p.hline(4, 11, 3, KAV.plate);
    p.hline(4, 11, 12, KAV.plate);
    return p.outline(OUT);
  },
  // A ward pylon: three tapering alloy blades round a core that crackles.
  kav_pylon(rot, st, f) {
    const p = spr(TALL);
    for (let y = 8; y < 40; y++) {
      const w = Math.round(1 + (y - 8) / 10);
      p.hline(3, 3 + w, y, KAV.plate);
      p.hline(12 - w, 12, y, KAV.plate);
    }
    p.rect(6, 4, 4, 34, KAV.dark);
    p.vline(8, 6, 36, f % 2 ? KAV.glow : KAV.seam);
    p.rect(6, 2, 4, 4, f % 2 ? '#ffffff' : KAV.glow);
    for (let i = 0; i < 3; i++) p.set(5 + ((f + i * 3) % 6), 10 + i * 9, KAV.rune);
    return p.outline(OUT);
  },
  // The mending spring: a low basin of alloy brimming with light.
  kav_basin(rot, st, f) {
    const p = spr();
    p.rect(1, 18, 14, 8, KAV.plate);
    p.hline(1, 14, 18, KAV.edge);
    p.rect(2, 16, 12, 3, KAV.dark);
    for (let x = 3; x < 13; x++) p.set(x, 17, (x + f) % 3 ? KAV.glow : '#ffffff');
    for (let i = 0; i < 3; i++) p.set(4 + ((i * 4 + f * 2) % 9), 12 - ((f + i) % 4), '#c8fbff');
    return p.outline(OUT);
  },
  relic(rot, st, f) {
    const p = spr();
    // A short plinth of old stone, the relic floating over it.
    p.rect(4, 19, 8, 7, STONE[1]);
    p.rect(3, 18, 10, 2, STONE[0]);
    p.hline(3, 12, 18, STONE[2]);
    const h = [0, -1, -1, 0][f % 4];
    p.ellipse(8, 12 + h, 3, 3, '#f0ecd8');
    p.ellipse(8, 12 + h, 2, 2, '#ffffff');
    p.set(7, 11 + h, '#ffffff');
    return p.outline(OUT);
  },
};
export const DANIM = { brazier: 3, kav_door: 2, kav_field: 3, kav_console: 4, kav_node: 2, kav_seal: 4, relic: 4, kav_lamp: 4, kav_pylon: 2, kav_basin: 4 };
