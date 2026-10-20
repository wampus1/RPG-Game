// (Round 130) A pirates' haven, drawn (see world/havenkit.js): sailcloth
// roofs patched and tarred, the guilds' black flags snapping on their
// masts (four frames), the realms' bills on a post, a gun run out, the
// plunder heaped by the store, the Articles nailed up, the stocks, the
// gallows, a sea chest. Hooked into textures.js.
import { Px, shade, hex } from './pixel.js';
import { LH } from '../config.js';
import { SHIP_SPRITES } from './shipart.js';

const OUT = '#1c1622';
const SPR = 28;
const TALL = 40;
const spr = (h = SPR) => new Px(16, h);
const WOOD = ['#6a4a2c', '#4e3420', '#8a6440', '#2e2014'];
const ROPE = '#b8a070';

// Sailcloth: old canvas laid in broad strips, a stitched seam between
// them; now and then (one tile in five or so) a patch of a darker cloth,
// and rarer still a smear of tar. (Round 131: calmer, as a roof reads from
// a distance: it was a patchwork on every tile.)
const SAIL = ['#d4c8ac', '#c8bb9c', '#ddd2b8', '#a89878'];
const PATCH = ['#9a8a6a', '#8a7a64', '#b0a07c'];
function sailFace(p, rand, h, f) {
  for (let y = 0; y < h; y++) {
    const strip = (y >> 3) % 2;
    for (let x = 0; x < 16; x++) {
      let c = SAIL[strip];
      // (The seam: a stitch every other pace.)
      if (y % 8 === 7) c = x % 2 ? SAIL[3] : SAIL[strip];
      // (The weave, faint.)
      else if ((x + y) % 7 === 0) c = SAIL[2];
      p.set(x, y, shade(hex(c), f));
    }
  }
  // A patch, stitched round.
  if (rand() < 0.2) {
    const px = 2 + Math.floor(rand() * 9);
    const py = 1 + Math.floor(rand() * Math.max(1, h - 6));
    const pc = PATCH[Math.floor(rand() * PATCH.length)];
    p.rect(px, py, 4, 3, shade(hex(pc), f));
    for (let i = 0; i < 4; i += 2) p.set(px + i, py, shade(hex('#6a5a44'), f));
  }
  // Tar.
  if (rand() < 0.12) {
    const tx = Math.floor(rand() * 14);
    const ty = Math.floor(rand() * Math.max(1, h - 2));
    p.rect(tx, ty, 2, 1, shade(hex('#4a4038'), f));
  }
}

export function havenTop(name, v, rand, rot) {
  if (name !== 'sail_roof') return null;
  const p = new Px(16, 16);
  sailFace(p, rand, 16, rot === 0 || rot === 3 ? 1.04 : rot === 2 ? 0.8 : 0.94);
  return p;
}

export function havenFront(name, v, rand) {
  if (name !== 'sail_roof') return null;
  const p = new Px(16, LH);
  sailFace(p, rand, LH, 0.86);
  // The hem, roped, hanging over the eave.
  p.rect(0, LH - 2, 16, 2, '#3a2e22');
  for (let x = 0; x < 16; x += 3) p.set(x, LH - 1, ROPE);
  return p;
}

// Each guild's colours and mark (as game/pirates.js GUILDS).
const FLAGS = {
  jolly_gull: { cloth: '#141414', mark: '#f0f0e8', kind: 'skull' },
  jolly_hand: { cloth: '#6a1010', mark: '#f0f0e8', kind: 'swords', edge: '#121212' },
  jolly_tide: { cloth: '#1a2440', mark: '#e8e0d0', kind: 'wave', moon: '#e0c040' },
};

// A flag on its mast, the cloth rippling across (frame `f` of four).
function jolly(name, f) {
  const F = FLAGS[name];
  const p = spr(TALL);
  // The mast, its cap and its stays.
  p.vline(3, 2, 39, WOOD[1]);
  p.vline(2, 4, 39, WOOD[0]);
  p.rect(1, 0, 4, 2, '#c8a040');
  p.line(2, 38, 0, 39, ROPE);
  p.line(4, 38, 6, 39, ROPE);
  // The cloth: each column lifted by the wave running along it.
  const lift = (x) => Math.round(Math.sin(x * 0.75 - f * (Math.PI / 2)) * 1.3 * Math.min(1, x / 5));
  const top = 3;
  const H = 11;
  for (let x = 0; x < 12; x++) {
    const dy = lift(x);
    for (let y = 0; y < H; y++) {
      // (The fly end frays.)
      if (x === 11 && (y + f) % 3 === 0) continue;
      const lit = Math.sin(x * 0.75 - f * (Math.PI / 2) + 0.8) > 0.3;
      p.set(4 + x, top + y + dy, shade(hex(F.cloth), lit ? 1.35 : 1));
    }
    if (F.edge) {
      p.set(4 + x, top + dy, F.edge);
      p.set(4 + x, top + H - 1 + dy, F.edge);
    }
  }
  const at = (x, y, c) => p.set(4 + x, top + y + lift(x), c);
  if (F.kind === 'skull') {
    for (const [x, y] of [[5, 2], [6, 2], [7, 2], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [4, 4], [6, 4], [8, 4], [5, 5], [6, 5], [7, 5], [5, 6], [7, 6]]) at(x, y, F.mark);
    // Crossed bones under it.
    for (const [x, y] of [[3, 7], [4, 8], [8, 8], [9, 7], [9, 9], [3, 9]]) at(x, y, F.mark);
  } else if (F.kind === 'swords') {
    for (let k = 0; k < 7; k++) {
      at(3 + k, 2 + k, F.mark);
      at(9 - k, 2 + k, F.mark);
    }
    at(2, 8, '#c8a040');
    at(10, 8, '#c8a040');
  } else {
    for (let x = 1; x < 11; x++) at(x, 7 + Math.round(Math.sin(x * 1.1) * 1), F.mark);
    for (const [x, y] of [[6, 2], [7, 2], [5, 3], [5, 4], [6, 5], [7, 5]]) at(x, y, F.moon);
  }
  return p.outline(OUT);
}

export const HAVEN_SPRITES = {
  jolly_gull: (rot, st, f) => jolly('jolly_gull', f),
  jolly_hand: (rot, st, f) => jolly('jolly_hand', f),
  jolly_tide: (rot, st, f) => jolly('jolly_tide', f),
  // The bills on their post: three notices, faces sketched, a price under
  // each in red; one torn half away.
  haven_wanted() {
    const p = spr(TALL);
    p.rect(7, 8, 2, 32, WOOD[1]);
    p.vline(7, 8, 39, WOOD[0]);
    p.rect(1, 6, 14, 2, WOOD[2]);
    for (const [x, y, torn] of [[1, 9, false], [8, 11, true], [3, 20, false]]) {
      const h = torn ? 6 : 9;
      p.rect(x, y, 7, h, '#e8dcb8');
      p.hline(x, x + 6, y, '#c8b890');
      p.ellipse(x + 3, y + 3, 1.5, 1.5, '#5a4a3a');
      p.set(x + 2, y + 3, '#e8dcb8');
      p.set(x + 4, y + 3, '#e8dcb8');
      if (!torn) {
        p.hline(x + 1, x + 5, y + 6, '#a82a20');
        p.hline(x + 2, x + 4, y + 7, '#5a4a3a');
      } else for (let k = 0; k < 7; k += 2) p.clear(x + k, y + h - 1);
      p.set(x + 3, y, '#3a3a40');
    }
    return p.outline(OUT);
  },
  shore_gun: (rot) => SHIP_SPRITES.ship_cannon(rot),
  // The plunder, heaped: a chest with its lid up and coin spilling, a
  // sack, a candlestick, a bolt of silk.
  plunder_heap() {
    const p = spr();
    p.rect(1, 18, 9, 8, WOOD[0]);
    p.hline(1, 9, 18, WOOD[2]);
    p.rect(1, 14, 9, 3, WOOD[1]);
    p.hline(1, 9, 21, '#c8a040');
    p.set(5, 22, '#e0c050');
    for (const [x, y] of [[2, 17], [4, 16], [6, 17], [8, 16], [3, 15], [7, 15]]) p.set(x, y, '#f0d050');
    for (const [x, y] of [[10, 25], [11, 24], [12, 25], [3, 26]]) p.set(x, y, '#f0d050');
    p.ellipse(12, 21, 3, 4, '#a89060');
    p.set(12, 17, '#7a6440');
    p.rect(9, 12, 1, 6, '#e0c050');
    p.rect(8, 11, 3, 1, '#e0c050');
    p.rect(13, 23, 3, 3, '#8a3a7a');
    p.hline(13, 15, 23, '#b85aa0');
    return p.outline(OUT);
  },
  // The Articles: a board under a little roof of its own, the parchment
  // nailed to it, a dagger driven through the foot of it.
  articles_board() {
    const p = spr(TALL);
    p.rect(2, 14, 2, 26, WOOD[1]);
    p.rect(12, 14, 2, 26, WOOD[1]);
    p.rect(1, 10, 14, 3, WOOD[0]);
    p.hline(0, 15, 10, WOOD[2]);
    p.rect(2, 13, 12, 15, WOOD[3]);
    p.rect(3, 14, 10, 13, '#e8dcb8');
    p.hline(3, 12, 14, '#c8b890');
    p.hline(5, 10, 15, '#3a2a1a');
    for (const y of [17, 19, 21, 23]) p.hline(4, 4 + ((y * 3) % 5) + 4, y, '#6a5a44');
    for (const [x, y] of [[3, 14], [12, 14], [3, 26], [12, 26]]) p.set(x, y, '#3a3a40');
    p.vline(8, 24, 28, '#c8c8d0');
    p.rect(7, 23, 3, 1, '#6a4a2c');
    p.set(8, 22, '#c8a040');
    return p.outline(OUT);
  },
  // The stocks: a heavy beam on two posts, three holes in it.
  stocks() {
    const p = spr();
    p.rect(2, 16, 2, 10, WOOD[1]);
    p.rect(12, 16, 2, 10, WOOD[1]);
    p.rect(1, 15, 14, 5, WOOD[0]);
    p.hline(1, 14, 15, WOOD[2]);
    p.hline(1, 14, 17, WOOD[3]);
    for (const x of [3, 7, 11]) p.ellipse(x + 0.5, 17, 1, 1, '#1a1410');
    p.rect(6, 15, 4, 1, '#5a5a66');
    return p.outline(OUT);
  },
  // The gallows: two posts and a beam, a brace, the rope hanging with its
  // noose, swaying (the state's frame is still).
  gallows() {
    const p = spr(TALL);
    p.rect(1, 6, 2, 34, WOOD[1]);
    p.vline(1, 6, 39, WOOD[0]);
    p.rect(1, 5, 14, 2, WOOD[0]);
    p.hline(1, 14, 5, WOOD[2]);
    p.line(3, 13, 9, 7, WOOD[1]);
    p.vline(12, 7, 19, ROPE);
    p.ellipse(12, 21, 1.5, 2, ROPE);
    p.clear(12, 21);
    p.rect(0, 37, 6, 3, '#4a4038');
    return p.outline(OUT);
  },
  // A sea chest: iron-bound, its lock, a little sand still on its lid.
  sea_chest() {
    const p = spr();
    p.rect(1, 17, 14, 9, WOOD[0]);
    p.rect(1, 14, 14, 4, WOOD[2]);
    p.hline(1, 14, 14, shade(hex(WOOD[2]), 1.2));
    for (const x of [3, 12]) p.vline(x, 14, 25, '#3a3a44');
    p.hline(1, 14, 18, '#3a3a44');
    p.rect(7, 18, 2, 3, '#c8a040');
    p.set(7, 20, '#1a1410');
    for (const [x, y] of [[5, 14], [10, 14], [11, 15]]) p.set(x, y, '#e0d0a0');
    return p.outline(OUT);
  },
};

export const HAVEN_ANIM = { jolly_gull: 4, jolly_hand: 4, jolly_tide: 4 };
