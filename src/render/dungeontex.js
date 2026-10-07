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
    case 'rift_door': {
      // (Round 72) The rift's heart: void-stone split open on nothing, a
      // white seam round the hole, stars in it.
      speckle(p, ['#3a2a4e', '#2a1e3a', '#4a3660'], rand, 0.3);
      p.ellipse(8, 8, 6.5, 5.5, '#c8a0ff');
      p.ellipse(8, 8, 5.5, 4.5, '#05010a');
      for (let i = 0; i < 6; i++) p.set(4 + rand() * 8, 5 + rand() * 6, i % 2 ? '#ffffff' : '#5ad8f0');
      p.set(3, 6, '#ffffff');
      p.set(12, 10, '#ffffff');
      return p;
    }
    case 'abyss_floor': {
      // (Round 72) The bottom of the rift: next to nothing, a dark with a
      // few stars in it and a vein of violet now and then.
      speckle(p, ['#08040f', '#0e0818', '#120a20'], rand, 0.3);
      if (v % 2 === 0) randomWalk(p, rand, rand() * 16, rand() * 16, 5, '#2a1448');
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, i === 0 ? '#ffffff' : i === 1 ? '#8a60c0' : '#3a60a0');
      return p;
    }
    case 'scorched_earth': {
      // Earth burnt black round the rift, cracked, a glow of the void in
      // the deepest cracks.
      speckle(p, ['#2a2024', '#1e1618', '#3a2e30'], rand, 0.35);
      for (let i = 0; i < 2 + v % 2; i++) randomWalk(p, rand, rand() * 16, rand() * 16, 10, '#120c14');
      if (v !== 1) randomWalk(p, rand, rand() * 16, rand() * 16, 4, v === 3 ? '#8a40c0' : '#5a2a7a');
      for (let i = 0; i < 3; i++) p.set(rand() * 16, rand() * 16, '#4a4044');
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
    case 'kav_pillar': case 'kav_wall': case 'kav_keystone': {
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
    case 'blight_floor': {
      // The ruin's floor gone over to the blight: violet veins through it,
      // a few of them lit.
      p.fill('#261c34');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0) p.set(x, y, '#30243f');
      for (let i = 0; i < 3; i++) randomWalk(p, rand, rand() * 16, rand() * 16, 9, i ? '#5a2a7a' : '#7a3aa0');
      for (let i = 0; i < 2 + v % 2; i++) p.set(rand() * 16, rand() * 16, rand() < 0.5 ? '#c070ff' : '#e0a0ff');
      return p;
    }
    case 'blight_wall': {
      p.fill('#2a2236');
      for (let i = 0; i < 16; i++) {
        p.set(i, 0, '#3e3254');
        p.set(0, i, '#3e3254');
      }
      p.hline(1, 15, 8, '#1e1828');
      randomWalk(p, rand, 4 + rand() * 8, 4 + rand() * 8, 12, '#6a2e8a');
      if (v % 2 === 0) p.set(3 + rand() * 10, 3 + rand() * 10, '#d090ff');
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
    case 'kav_coolant': {
      // Frozen coolant, frost-white at its rim, a cold blue core.
      p.fill('#7ac8e8');
      p.ellipse(8, 8, 6, 6, '#a8e4f8');
      p.ellipse(8, 8, 3.5, 3.5, '#5ab0e0');
      p.ellipse(7, 7, 1.5, 1.5, '#ffffff');
      for (let i = 0; i < 16; i++) {
        p.set(i, 0, '#e0f8ff');
        p.set(0, i, '#e0f8ff');
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
    case 'abyss_floor':
      speckle(p, ['#0a0612', '#06040a', '#140c20'], rand, 0.3);
      p.set(rand() * 16, rand() * LH, '#8a60c0');
      return p;
    case 'scorched_earth':
      speckle(p, ['#241c20', '#1a1216', '#302628'], rand, 0.3);
      randomWalk(p, rand, rand() * 16, 0, 8, '#120c14');
      return frontify(p, 0.85);
    case 'stairs_down': case 'sinkhole': case 'mine_shaft': case 'rubble_seal': case 'rift_door':
      speckle(p, ['#5a4e44', '#463c34', '#6a5e52'], rand, 0.3);
      return frontify(p, 0.8);
    case 'kav_keystone': {
      // The keystone: the spire's face, and a hollow cut in it the shape of
      // a cut stone (table, crown and point), rimmed in faint light.
      p.fill(KAV.plate);
      p.hline(0, 15, 0, KAV.edge);
      p.hline(0, 15, LH - 1, KAV.deep);
      const gem = [[5, 10, 1], [4, 11, 2], [3, 12, 3], [3, 12, 4], [4, 11, 5], [5, 10, 6], [6, 9, 7], [7, 8, 8], [7, 8, 9]];
      for (const [a, b2, y] of gem) {
        p.hline(a, b2, y, '#0c0a16');
        p.set(a - 1, y, '#6e6cb0');
        p.set(b2 + 1, y, '#3a3870');
      }
      p.hline(5, 10, 0, '#8a88d0');
      // (Its facets, cut in the dark.)
      p.line(5, 1, 3, 4, '#2a2848');
      p.line(10, 1, 12, 4, '#2a2848');
      p.hline(3, 12, 3, '#22203e');
      p.line(3, 4, 7, 9, '#22203e');
      p.line(12, 4, 8, 9, '#22203e');
      p.set(6, 2, '#5ad8f0');
      p.set(7, 10, KAV.seam);
      return p;
    }
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
    case 'blight_wall': {
      p.fill('#2a2236');
      p.hline(0, 15, 0, '#3e3254');
      p.hline(0, 15, LH - 1, '#140e1c');
      // Veins running down it, a drop of light at the end of one.
      for (let i = 0; i < 2; i++) {
        let x = Math.floor(rand() * 14) + 1;
        for (let y = 1; y < LH - 1; y++) {
          p.set(x, y, '#6a2e8a');
          if (rand() < 0.3) x += rand() < 0.5 ? 1 : -1;
        }
        if (i === 0 && v % 2 === 0) p.set(x, LH - 2, '#d090ff');
      }
      return p;
    }
    case 'blight_floor':
      p.fill('#221a30');
      p.hline(0, 15, 0, '#3a2a52');
      p.hline(0, 15, LH - 1, '#140e1c');
      return p;
    case 'kav_floor': case 'kav_lift': case 'kav_debris':
      p.fill('#24223a');
      p.hline(0, 15, 0, KAV.edge);
      p.hline(0, 15, LH - 1, KAV.deep);
      if (name === 'kav_lift') p.hline(2, 13, 4, KAV.seam);
      return p;
    case 'kav_coolant':
      // Banded ice over alloy: frost running down it.
      p.fill('#6ab8dc');
      for (let y = 1; y < LH - 1; y += 3) p.hline(0, 15, y, '#a8e4f8');
      for (let i = 0; i < 3; i++) {
        let x = Math.floor(rand() * 14) + 1;
        for (let y = 0; y < LH; y++) {
          p.set(x, y, '#e0f8ff');
          if (rand() < 0.3) x += rand() < 0.5 ? 1 : -1;
        }
      }
      p.hline(0, 15, 0, '#ffffff');
      p.hline(0, 15, LH - 1, '#3a7aa0');
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
  // The way into a holdout: cut into the outcrop's own rock (its top and
  // two courses of its face, the same stone round it), an arch of dark in
  // the lower course, ragged at the rim and blacker the deeper in.
  cave_mouth() {
    const p = spr(TALL);
    let s = 0x2c41;
    const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    p.blit(dungeonTop('cave_rock', 0, rand), 0, 0);
    p.blit(dungeonFront('cave_rock', 0, rand, 0), 0, 16);
    p.blit(dungeonFront('cave_rock', 1, rand, 0), 0, 16 + LH);
    const inside = (x, y) => {
      const dx = (x - 7.5) / 5.6;
      return y >= 39 ? Math.abs(dx) <= 1 : y >= 29 ? Math.abs(dx) <= 1 : dx * dx + ((y - 29) / 9) ** 2 <= 1;
    };
    for (let y = 18; y < 40; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inside(x, y)) {
          // (The rim: lighter where the rock was worn round the way in.)
          if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1)) p.set(x, y, (x + y) % 3 ? '#8a7e6e' : '#a09482');
          continue;
        }
        const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y - 1) || !inside(x + 2, y) || !inside(x - 2, y);
        p.set(x, y, edge ? '#241c16' : y < 26 ? '#120e0a' : '#070504');
      }
    }
    return p;
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
Object.assign(DSPRITES, {
  // Cobwebs strung across a corner.
  cobweb(rot) {
    const p = spr();
    const c = '#dcdce6';
    const ox = rot % 2 ? 15 : 0;
    const sx = rot % 2 ? -1 : 1;
    for (let k = 0; k < 4; k++) p.line(ox, 4 + k * 2, ox + sx * (12 - k * 3), 4, c);
    for (let k = 1; k < 4; k++) p.line(ox + sx * k * 3, 4, ox, 4 + k * 4, c);
    for (let i = 3; i < p.d.length; i += 4) if (p.d[i]) p.d[i] = 140;
    for (let y = 4; y < 20; y += 3) p.set(ox + sx, y, '#ffffff', 170);
    return p;
  },
  // A clay urn of ashes, lidded.
  urn(rot) {
    const p = spr();
    const c = rot % 2 ? ['#8a5a3a', '#6a4028', '#a87048'] : ['#7a6a58', '#5a4a3c', '#9a8a74'];
    p.ellipse(8, 20, 5, 5, c[0]);
    p.rect(5, 12, 6, 4, c[0]);
    p.rect(4, 11, 8, 2, c[2]);
    p.rect(6, 9, 4, 2, c[1]);
    p.hline(4, 12, 19, c[1]);
    p.vline(5, 15, 23, c[2]);
    p.hline(5, 11, 25, c[1]);
    return p.outline(OUT);
  },
  // Stubs of candles, guttering.
  candles(rot, st, f) {
    const p = spr();
    const spots = [[4, 22, 5], [8, 24, 7], [11, 21, 4], [6, 25, 3]];
    for (const [x, y, h] of spots) {
      p.rect(x, y - h, 2, h, '#e8e0c8');
      p.set(x, y - h, '#c8c0a8');
      const fl = (f + x) % 3 === 0 ? -1 : 0;
      p.set(x, y - h - 1 + fl, '#ffe070');
      p.set(x, y - h - 2 + fl, '#ff9030');
    }
    p.rect(3, 25, 11, 1, '#c8c0a8');
    return p;
  },
  // A knight of old, worn by the damp.
  statue() {
    const p = spr(TALL);
    p.rect(3, 34, 10, 6, STONE[1]);
    p.hline(3, 12, 34, STONE[2]);
    p.rect(5, 16, 6, 18, STONE[0]);
    p.rect(4, 17, 8, 6, STONE[0]);
    p.vline(5, 16, 33, STONE[2]);
    p.ellipse(8, 11, 3, 4, STONE[0]);
    p.rect(6, 10, 4, 1, STONE[1]);
    // The sword it holds, point down.
    p.vline(12, 12, 34, STONE[2]);
    p.hline(10, 14, 16, STONE[2]);
    for (let i = 0; i < 6; i++) p.set(4 + ((i * 5) % 8), 18 + i * 3, '#4a6a3a');
    return p.outline(OUT);
  },
  skull_pile() {
    const p = spr();
    const b = ['#d8d0b8', '#a8a088', '#f0ead8'];
    for (const [x, y] of [[2, 21], [6, 22], [10, 21], [4, 17], [8, 17], [6, 13]]) {
      p.rect(x, y, 4, 4, b[0]);
      p.hline(x + 1, x + 2, y + 4, b[1]);
      p.set(x + 1, y + 1, '#2a2622');
      p.set(x + 3, y + 1, '#2a2622');
      p.set(x, y, b[2]);
    }
    return p.outline(OUT);
  },
  // An ore cart, left on its rails with a last load in it.
  mine_cart() {
    const p = spr();
    p.rect(1, 15, 14, 8, '#5a4a3a');
    p.rect(2, 16, 12, 6, '#4a3a2c');
    p.hline(1, 14, 15, '#7a6a58');
    for (const x of [1, 14]) p.vline(x, 15, 22, IRON[0]);
    p.rect(3, 12, 10, 4, '#3a3a40');
    for (const [x, y, c] of [[4, 12, '#c8a040'], [8, 11, '#8a8a90'], [11, 12, '#2a2a2e'], [6, 13, '#c87a3a']]) p.rect(x, y, 2, 2, c);
    p.ellipse(4, 24, 2, 2, IRON[1]);
    p.ellipse(12, 24, 2, 2, IRON[1]);
    p.hline(0, 15, 26, '#6a5a4a');
    return p.outline(OUT);
  },
  stalagmite(rot) {
    const p = spr();
    const c = rot % 2 ? ['#6a5e52', '#4a4038', '#8a7e70'] : ['#5e5a56', '#403c38', '#7e7a74'];
    for (let y = 6; y <= 25; y++) {
      const w = Math.round(1 + (y - 6) * 0.3);
      p.hline(8 - w, 8 + w, y, c[0]);
      p.set(8 - w, y, c[2]);
      p.set(8 + w, y, c[1]);
    }
    p.rect(11, 18, 3, 8, c[1]);
    p.set(12, 17, c[1]);
    return p.outline(OUT);
  },
  // Glowcaps: a clump of pale toadstools that light the dark blue-green.
  glowshroom(rot, st, f) {
    const p = spr();
    const g = f % 2 ? '#a0f8e0' : '#7ae8d0';
    for (const [x, y, r] of [[4, 21, 2], [9, 19, 3], [12, 23, 2]]) {
      p.vline(x, y, 25, '#d8e8e0');
      p.ellipse(x, y - 1, r, r - 1 || 1, g);
      p.set(x - 1, y - 2, '#ffffff');
    }
    return p;
  },
  weapon_rack() {
    const p = spr();
    const w = P.planks_dark;
    p.rect(1, 12, 14, 2, w[1]);
    p.rect(1, 22, 14, 2, w[1]);
    p.vline(1, 12, 25, w[0]);
    p.vline(14, 12, 25, w[0]);
    // Spears and a sword leaning in it.
    for (const x of [4, 7, 10]) {
      p.vline(x, 4, 24, '#6a4a2a');
      p.rect(x - 1, 2, 3, 3, IRON[2]);
    }
    p.vline(12, 8, 24, IRON[2]);
    p.hline(11, 13, 18, '#8a6a30');
    return p.outline(OUT);
  },
  war_banner(rot, st, f) {
    const p = spr(TALL);
    p.vline(3, 2, 39, '#5a3a20');
    p.rect(2, 1, 3, 2, '#c8a040');
    const sway = f % 2;
    for (let y = 4; y < 26; y++) {
      const ragged = y > 22 ? (y + 2) % 3 === 0 : false;
      p.hline(4, 13 + (y > 14 ? sway : 0) - (ragged ? 3 : 0), y, '#8a2a24');
    }
    p.hline(4, 13, 4, '#a83a30');
    // A crude skull daubed on it.
    p.rect(7, 10, 4, 4, '#e8e0c8');
    p.set(8, 11, '#3a1a14');
    p.set(10, 11, '#3a1a14');
    p.hline(8, 9, 14, '#e8e0c8');
    return p.outline(OUT);
  },
  hanging_chains(rot, st, f) {
    const p = spr(TALL);
    const sway = f % 2 ? 1 : 0;
    for (const [x, len] of [[4, 22], [9, 30], [13, 16]]) {
      for (let y = 0; y < len; y++) p.set(x + (y > len / 2 ? sway : 0), y, y % 2 ? IRON[0] : IRON[2]);
      if (len > 20) p.rect(x - 1 + sway, len, 3, 2, IRON[1]);
    }
    return p;
  },
  powder_keg() {
    const p = spr();
    p.rect(3, 12, 10, 14, '#6a4a2c');
    p.rect(2, 15, 12, 8, '#7a5a34');
    for (const y of [13, 18, 24]) p.hline(2, 13, y, IRON[1]);
    p.rect(5, 16, 6, 4, '#2a2620');
    p.set(6, 17, '#e8e0c8');
    p.set(8, 17, '#e8e0c8');
    p.set(7, 18, '#e8e0c8');
    // A fuse.
    p.line(8, 12, 10, 8, '#c8b080');
    p.set(10, 7, '#ff9030');
    return p.outline(OUT);
  },
  roots(rot, st, f) {
    const p = spr(TALL);
    const c = ['#4a3420', '#6a4a2c', '#3a2614'];
    for (const [x, len] of [[3, 18], [7, 26], [11, 14], [13, 22]]) {
      let cx = x;
      for (let y = 0; y < len; y++) {
        if (y % 5 === 4) cx += (x + y + f) % 2 ? 1 : -1;
        p.set(cx, y, c[y % 3 === 0 ? 1 : 0]);
        if (y < len / 2) p.set(cx + 1, y, c[2]);
      }
    }
    return p;
  },
  rubble(rot) {
    const p = spr();
    const c = ['#6a665e', '#4a4640', '#8a867c'];
    const spots = rot % 2 ? [[3, 22, 3], [8, 23, 4], [11, 20, 2], [6, 19, 2]] : [[2, 23, 3], [7, 21, 3], [12, 23, 2], [9, 24, 2]];
    for (const [x, y, r] of spots) {
      p.ellipse(x, y, r, r - 1 || 1, c[0]);
      p.set(x - 1, y - 1, c[2]);
      p.set(x + 1, y + 1, c[1]);
    }
    return p.outline(OUT);
  },
  bone_throne() {
    const p = spr(TALL);
    const b = ['#d8d0b8', '#a8a088', '#f0ead8'];
    p.rect(2, 26, 12, 14, b[1]);
    p.rect(3, 6, 10, 22, b[0]);
    p.rect(1, 22, 14, 5, b[1]);
    // Skulls along its back, and horns at the top.
    for (const x of [4, 8, 12]) {
      p.rect(x - 1, 8, 3, 3, b[2]);
      p.set(x - 1, 9, '#2a2622');
      p.set(x + 1, 9, '#2a2622');
    }
    p.line(3, 6, 1, 1, b[2]);
    p.line(12, 6, 14, 1, b[2]);
    for (let y = 13; y < 22; y += 3) p.hline(4, 11, y, b[1]);
    p.rect(4, 22, 8, 2, '#5a1a1a');
    return p.outline(OUT);
  },
  // The master's gate: heavy iron, a skull boss in the middle of it.
  boss_gate(rot) {
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (!front) {
      p.rect(5, 0, 6, 40, IRON[1]);
      p.vline(7, 0, 39, IRON[2]);
      p.vline(9, 0, 39, IRON[0]);
      return p.outline(OUT);
    }
    p.rect(0, 0, 16, 40, IRON[1]);
    for (let x = 1; x < 16; x += 3) p.vline(x, 1, 39, IRON[0]);
    for (const y of [4, 14, 26, 36]) p.hline(0, 15, y, IRON[2]);
    p.ellipse(8, 20, 4, 4, '#2a2a30');
    p.rect(6, 18, 5, 4, '#d8d0b8');
    p.set(7, 19, '#2a0a0a');
    p.set(9, 19, '#2a0a0a');
    p.hline(7, 9, 22, '#d8d0b8');
    for (let x = 1; x < 16; x += 3) p.set(x, 39, '#a8a8b4');
    return p.outline(OUT);
  },
  boss_gate_open(rot) {
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (front) {
      p.rect(0, 0, 16, 7, IRON[1]);
      for (let x = 1; x < 16; x += 3) {
        p.vline(x, 0, 8, IRON[0]);
        p.set(x, 9, '#a8a8b4');
      }
      p.hline(0, 15, 4, IRON[2]);
    } else p.rect(5, 0, 6, 8, IRON[1]);
    return p.outline(OUT);
  },
  kav_gate(rot, st, f) {
    const p = spr(TALL);
    const front = rot === 0 || rot === 2;
    if (!front) {
      p.rect(5, 0, 6, 40, KAV.plate);
      p.vline(8, 0, 39, f % 2 ? KAV.glow : KAV.seam);
      return p.outline(OUT);
    }
    p.rect(0, 0, 16, 40, KAV.plate);
    p.rect(1, 1, 14, 38, '#24223a');
    p.vline(8, 1, 38, KAV.dark);
    for (let y = 4; y < 38; y += 6) {
      p.hline(2, 6, y, (y / 6 + f) % 2 ? KAV.seam : KAV.edge);
      p.hline(10, 14, y, (y / 6 + f + 1) % 2 ? KAV.seam : KAV.edge);
    }
    p.ellipse(8, 20, 3, 3, f % 2 ? '#ff6050' : '#c83a30');
    return p.outline(OUT);
  },
  gong(rot, st, f) {
    const p = spr();
    const w = P.planks_dark;
    p.vline(2, 6, 25, w[1]);
    p.vline(13, 6, 25, w[1]);
    p.hline(1, 14, 6, w[0]);
    p.hline(1, 14, 7, w[1]);
    p.vline(8, 7, 9, '#5a5a5a');
    p.ellipse(8, 16, 5, 6, st ? '#f0c860' : '#c8a040');
    p.ellipse(8, 16, 3, 4, '#a88030');
    p.set(6, 13, '#fff0a0');
    p.set(8, 16, '#e8c060');
    return p.outline(OUT);
  },
});
// The blight's growths (see sites.js, blight).
Object.assign(DSPRITES, {
  // A voidbloom: a pale stem, a bulb of violet light that opens and shuts.
  void_bloom(rot, st, f) {
    const p = spr();
    const sway = [0, 1, 0, -1][f % 4];
    p.line(8, 26, 8 + sway, 14, '#4a3a5a');
    p.line(8, 22, 5, 19, '#3a2e48');
    p.set(4, 18, '#7a4ea0');
    const open = f % 4 === 1 || f % 4 === 2;
    p.ellipse(8 + sway, 11, open ? 4 : 3, 3, '#7a3aa0');
    p.ellipse(8 + sway, 11, open ? 2 : 1, 2, '#e090ff');
    p.set(8 + sway, 10, '#ffffff');
    if (open) for (const dx of [-4, 4]) p.set(8 + sway + dx, 8, '#c070ff');
    return p.outline(OUT);
  },
  // A cluster of crystals, violet and cold, lit from inside.
  glow_crystal(rot, st, f) {
    const p = spr();
    const c = ['#8a4ee0', '#5a2e9a', '#d0a0ff'];
    for (const [x, h, w] of rot % 2 ? [[4, 12, 2], [8, 16, 3], [12, 9, 2]] : [[3, 9, 2], [7, 14, 3], [11, 11, 2]]) {
      for (let y = 0; y < h; y++) {
        const ww = Math.max(0, Math.round(w * (1 - y / (h + 2))));
        p.hline(x - ww, x + ww, 25 - y, y % 3 ? c[0] : c[1]);
      }
      p.vline(x, 26 - h, 25, c[2]);
      if ((f + x) % 3 === 0) p.set(x, 25 - h, '#ffffff');
    }
    return p.outline(OUT);
  },
  // A tendril: a twisting stalk taller than you, a light at its tip.
  tendril(rot, st, f) {
    const p = spr(TALL);
    let x = 8;
    for (let y = 39; y > 4; y--) {
      x = 8 + Math.round(Math.sin(y / 5 + f * 0.7 + rot) * 2.2);
      p.set(x, y, y % 4 ? '#3a2a4e' : '#5a3e72');
      if (y > 26) p.set(x + 1, y, '#2a1e3a');
    }
    p.ellipse(x, 4, 2, 2, '#c070ff');
    p.set(x, 4, '#ffffff');
    return p.outline(OUT);
  },
  // A watcher stalk: an eye on a stem, that turns to look about.
  eye_stalk(rot, st, f) {
    const p = spr();
    p.line(8, 26, 8, 15, '#4a3a5a');
    p.line(8, 24, 11, 21, '#3a2e48');
    p.ellipse(8, 11, 4, 4, '#e8dce8');
    const look = [-1, 0, 1, 0][f % 4];
    p.ellipse(8 + look, 11, 2, 2, '#8a2ad0');
    p.set(8 + look, 11, '#0a0610');
    p.set(6, 9, '#ffffff');
    return p.outline(OUT);
  },
});
// A Kavorent hall's dressing (its light the floor's own colour: see
// Renderer.kavAtlasFor).
const GLYPH = [0b101010111, 0b111001111, 0b010111010, 0b110011100, 0b100111001, 0b011101110, 0b111100001, 0b001111100];
Object.assign(DSPRITES, {
  // A sentinel: a hooded figure of alloy twice your height on a plinth,
  // hands on the pommel of a blade of light, a visor that smoulders.
  kav_statue(rot, st, f) {
    const p = spr(TALL);
    p.rect(1, 34, 14, 6, KAV.dark);
    p.hline(1, 14, 34, KAV.edge);
    p.hline(2, 13, 37, f % 2 ? KAV.glow : KAV.seam);
    for (let y = 12; y < 34; y++) {
      const w = 3 + Math.floor((y - 12) / 6);
      p.hline(8 - w, 7 + w, y, KAV.plate);
      p.set(8 - w, y, KAV.edge);
      p.set(7 + w, y, KAV.deep);
    }
    p.vline(5, 20, 33, KAV.dark);
    p.vline(11, 22, 33, KAV.dark);
    p.rect(2, 10, 4, 4, KAV.edge);
    p.rect(10, 10, 4, 4, KAV.plate);
    p.hline(2, 5, 10, '#5a5878');
    p.rect(5, 2, 6, 9, KAV.plate);
    p.hline(6, 9, 1, KAV.plate);
    p.vline(5, 2, 10, KAV.edge);
    p.rect(6, 4, 4, 5, KAV.deep);
    p.hline(6, 9, 6, f % 2 ? '#ffffff' : KAV.glow);
    // The blade, point down, and the hands on it.
    p.vline(8, 17, 33, KAV.glow);
    p.vline(7, 18, 32, KAV.seam);
    p.hline(5, 10, 16, KAV.edge);
    p.rect(6, 13, 4, 3, KAV.edge);
    p.hline(6, 9, 13, '#5a5878');
    return p.outline(OUT);
  },
  // A monolith of black glass, glyphs crawling up it.
  kav_monolith(rot, st, f) {
    const p = spr(TALL);
    p.rect(2, 5, 12, 35, KAV.deep);
    p.hline(3, 12, 4, KAV.deep);
    p.hline(5, 10, 3, KAV.deep);
    p.hline(7, 8, 2, KAV.seam);
    p.vline(2, 5, 39, KAV.edge);
    p.vline(3, 4, 39, KAV.dark);
    p.vline(13, 5, 39, '#08060e');
    // (A wave of light climbing through them.)
    for (let k = 0; k < 6; k++) {
      const y = 33 - k * 5;
      const g = GLYPH[(k * 3 + rot) % GLYPH.length];
      const c = k % 4 === f % 4 ? '#ffffff' : (k + 1) % 4 === f % 4 ? KAV.glow : k % 2 ? KAV.rune : KAV.seam;
      for (let i = 0; i < 9; i++) if (g & (1 << i)) p.set(6 + (i % 3), y + Math.floor(i / 3), c);
      if (k % 3 === 0) p.set(10, y + 1, KAV.seam);
    }
    p.hline(2, 13, 39, KAV.plate);
    return p.outline(OUT);
  },
  // A light-screen: a projector throwing a turning glyph into the air.
  kav_holo(rot, st, f) {
    const p = spr(TALL);
    p.rect(3, 34, 10, 6, KAV.plate);
    p.hline(3, 12, 34, KAV.edge);
    p.rect(5, 32, 6, 2, KAV.dark);
    p.hline(6, 9, 32, KAV.glow);
    // The beam, thin as gauze.
    for (let y = 8; y < 32; y++) {
      const w = Math.round((y - 8) / 6);
      for (let x = 7 - w; x <= 8 + w; x++) if ((x + y + f) % 3 === 0) p.set(x, y, KAV.seam);
    }
    // The glyph, turning (it narrows edge-on) and flickering.
    const wid = [5, 3, 1, 3][f % 4];
    p.rect(8 - wid, 3, wid * 2, 10, f === 2 ? KAV.seam : KAV.glow);
    p.rect(9 - wid, 4, Math.max(0, wid * 2 - 2), 8, KAV.rune);
    if (wid > 1) {
      p.hline(9 - wid, 6 + wid, 6, '#ffffff');
      p.hline(9 - wid, 6 + wid, 9, KAV.seam);
    }
    return p.outline(OUT);
  },
  // A bundle of conduits on squat feet, pulses of light running along it.
  kav_conduit(rot, st, f) {
    const p = spr();
    const side = rot % 2 === 1;
    p.rect(2, 22, 3, 6, KAV.dark);
    p.rect(11, 22, 3, 6, KAV.dark);
    for (let i = 0; i < 3; i++) {
      const y = 14 + i * 3;
      p.rect(0, y, 16, 3, i === 1 ? KAV.dark : KAV.plate);
      p.hline(0, 15, y, KAV.edge);
      const x = side ? (f * 5 + i * 6) % 16 : 15 - ((f * 5 + i * 6) % 16);
      p.set(x, y + 1, '#ffffff');
      p.set((x + 15) % 16, y + 1, KAV.glow);
      p.set((x + 14) % 16, y + 1, KAV.seam);
    }
    p.rect(6, 12, 4, 13, KAV.edge);
    p.rect(7, 13, 2, 11, KAV.deep);
    p.set(7, 15 + (f % 4) * 2, KAV.glow);
    return p.outline(OUT);
  },
  // What's left of a construct: a carapace slumped on its side, cables
  // spilling out, and an eye that hasn't quite gone out.
  kav_husk(rot, st, f) {
    const p = spr();
    const fl = rot % 2 ? -1 : 1;
    const X = (x) => (fl > 0 ? x : 15 - x);
    p.ellipse(X(9), 21, 6, 4, KAV.plate);
    p.ellipse(X(9), 20, 5, 2, KAV.edge);
    p.ellipse(X(4), 23, 3, 3, KAV.dark);
    p.set(X(4), 23, f % 4 === 0 ? '#ffffff' : f % 2 ? KAV.glow : KAV.deep);
    p.line(X(13), 24, X(15), 27, KAV.dark);
    p.line(X(11), 25, X(12), 27, KAV.edge);
    p.line(X(6), 18, X(3), 15, KAV.dark);
    p.set(X(3), 15, f === 1 ? KAV.glow : KAV.edge);
    p.line(X(9), 24, X(7), 27, '#5a5878');
    return p.outline(OUT);
  },
  // Your pack, tipped over where you fell, things spilling from it, a
  // glint to find it by in the dark.
  satchel(rot, st, f) {
    const p = spr();
    const L = ['#8a5a34', '#6a4426', '#a8744a'];
    p.ellipse(7, 22, 5, 4, L[0]);
    p.ellipse(7, 21, 4, 2, L[2]);
    p.rect(3, 19, 8, 2, L[1]);
    p.line(4, 18, 9, 17, L[1]);
    p.set(7, 22, '#c8a040');
    p.rect(11, 23, 3, 2, '#e8c860');
    p.set(13, 22, '#c8c8d8');
    p.line(10, 25, 14, 24, '#7a7a84');
    p.set(2, 25, '#e04040');
    p.set(12 + (f % 2), 21, f % 2 ? '#ffffff' : '#ffe8a0');
    return p.outline(OUT);
  },
  // Spikes in the floor: an iron plate full of holes, or (up) a bed of
  // points.
  spikes(rot, st) {
    const p = spr();
    p.rect(1, 15, 14, 11, '#3a3a44');
    p.rect(2, 16, 12, 9, '#4a4a54');
    p.hline(1, 14, 15, '#5a5a66');
    for (const y of [18, 22]) {
      for (const x of [4, 8, 12]) {
        if (st) {
          p.vline(x, y - 7, y, '#c8c8d0');
          p.vline(x - 1, y - 5, y, '#8a8a94');
          p.set(x, y - 8, '#ffffff');
        } else {
          p.set(x, y, '#121216');
          p.set(x - 1, y, '#121216');
        }
      }
    }
    return p;
  },
  // An old idol: a squat figure of stone, hands folded on a stone set in
  // its belly; its eyes burn till someone's had its blessing.
  idol(rot, st, f) {
    const p = spr();
    p.rect(3, 22, 10, 5, STONE[1]);
    p.hline(3, 12, 22, STONE[2]);
    p.rect(5, 11, 6, 11, STONE[0]);
    p.ellipse(8, 9, 4, 4, STONE[0]);
    p.hline(5, 10, 15, STONE[1]);
    p.hline(5, 10, 16, STONE[2]);
    p.vline(5, 11, 21, STONE[2]);
    const eye = st ? (f % 2 ? '#ffe070' : '#ffffff') : '#2a2a30';
    p.set(6, 8, eye);
    p.set(9, 8, eye);
    p.rect(7, 17, 2, 3, st ? (f % 2 ? '#ffc040' : '#ffe8a0') : STONE[1]);
    return p.outline(OUT);
  },
  // A vent in the floor, something glowing under its slats.
  kav_vent(rot, st, f) {
    const p = spr();
    p.rect(2, 16, 12, 9, KAV.dark);
    p.rect(3, 17, 10, 7, f % 2 ? KAV.seam : '#2a8aa8');
    for (let y = 17; y < 24; y += 2) p.hline(2, 13, y, KAV.edge);
    p.hline(2, 13, 16, KAV.plate);
    p.hline(2, 13, 25, KAV.deep);
    return p;
  },
});
export const DANIM = { brazier: 3, kav_door: 2, kav_field: 3, kav_console: 4, kav_node: 2, kav_seal: 4, relic: 4, kav_lamp: 4, kav_pylon: 2, kav_basin: 4, candles: 3, glowshroom: 2, war_banner: 2, hanging_chains: 2, roots: 2, kav_gate: 2, void_bloom: 4, glow_crystal: 3, tendril: 4, eye_stalk: 4, kav_statue: 2, kav_monolith: 4, kav_holo: 4, kav_conduit: 4, kav_husk: 4, kav_vent: 2, satchel: 2, idol: 2 };
