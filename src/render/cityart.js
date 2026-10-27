// (Round 146) What a place is known for, drawn (see world/specialties.js
// and world/quarters/): the arena's raked sand, its gate and its beasts in
// their cages; the library's scroll shelves, lectern, globe and telescope;
// mosaics and stained glass; the pools of the baths; the bazaar's heaps of
// spice and rugs; the great furnace; the stage and its curtain; the
// racecourse's posts; the fair's striker and fortune-teller; the dig; the
// vines and the press; the gardens' clipped shapes; the monks' wooden man;
// the skeps; the carved stones; the mason's work; the way down. Hooked into
// textures.js (cube faces and sprites) and sprites.js (the goods' icons).
import { Px, shade, hex } from './pixel.js';
import { LH } from '../config.js';

const OUT = '#1c1622';
const SPR = 28;
const TALL = 40;
const spr = (h = SPR) => new Px(16, h);
const WOOD = ['#6a4a2c', '#4e3420', '#8a6440', '#2e2014'];
const DARK = ['#4a3020', '#36221a', '#5e3e28', '#20140e'];
const IRON = ['#5a5a66', '#3a3a44', '#8a8a98', '#24242c'];
const BRASS = ['#c89a3a', '#8a6420', '#f0cc70', '#5a3e14'];
const STONE = ['#9a968c', '#77736a', '#bdb9ae', '#55524b'];
const MARBLE = ['#e2ded4', '#c2beb4', '#f8f6f0', '#9e9a90'];
const PARCH = ['#e8dcb8', '#c8b890', '#f4ecd4', '#a8986c'];
const ROPE = '#b8a070';
const FLAME = ['#fff2a0', '#ffc040', '#ff7a20'];

// A little flame (three tall) whose tip leans with frame `f`.
function flame(p, x, y, f = 0) {
  const lean = [0, 1, 0, -1][f % 4];
  p.set(x, y, FLAME[2]);
  p.set(x, y - 1, FLAME[1]);
  p.set(x + (lean > 0 ? 1 : 0), y - 2, FLAME[0]);
  if (lean < 0) p.set(x - 1, y - 2, FLAME[1]);
}
// A candle: wax, wick, flame.
function candle(p, x, y, h, lit, f = 0, wax = '#f0e8d0') {
  p.vline(x, y - h + 1, y, wax);
  p.set(x, y - h + 1, shade(hex(wax), 1.1));
  if (lit) flame(p, x, y - h, f);
  else p.set(x, y - h, '#3a3030');
}
// A post of timber, lit on its left.
function post(p, x, y0, y1, w = 2, col = WOOD) {
  p.rect(x, y0, w, y1 - y0 + 1, col[0]);
  p.vline(x, y0, y1, col[2]);
  if (w > 2) p.vline(x + w - 1, y0, y1, col[1]);
}
// A plank board: grain and the odd knot.
function board(p, x, y, w, h, col = WOOD) {
  p.rect(x, y, w, h, col[0]);
  for (let j = 0; j < h; j++) if (j % 3 === 2) p.hline(x, x + w - 1, y + j, col[1]);
  p.hline(x, x + w - 1, y, col[2]);
  p.set(x + Math.floor(w / 3), y + Math.floor(h / 2), col[3]);
}
// Lines of writing on paper (`ink`), staggered lengths.
function writing(p, x, y, w, rows, ink = '#5a4a3a', gap = 2) {
  for (let r = 0; r < rows; r++) {
    const len = w - ((r * 5 + 3) % 4);
    for (let i = 0; i < len; i++) if ((i + r) % 5 !== 4) p.set(x + i, y + r * gap, ink);
  }
}
// A paper notice: its paper, its pin, its lines.
function notice(p, x, y, w, h, ink = '#5a4a3a', paper = PARCH) {
  p.rect(x, y, w, h, paper[0]);
  p.hline(x, x + w - 1, y + h - 1, paper[1]);
  p.set(x + Math.floor(w / 2), y, '#3a3a40');
  writing(p, x + 1, y + 2, w - 2, Math.floor((h - 2) / 2), ink);
}
// A board on two posts under a little gable: the shape of every notice
// board here (`face` paints what's on it, inside x 2..13, y top..bottom).
function postedBoard(top, bottom, face, col = WOOD) {
  const p = spr(TALL);
  post(p, 2, top - 1, 39, 2, col);
  post(p, 12, top - 1, 39, 2, col);
  // The little roof.
  for (let i = 0; i < 4; i++) p.hline(1 + i - 1, 14 - i + 1, top - 2 - i, i === 0 ? col[3] : col[1]);
  p.hline(0, 15, top - 2, col[2]);
  p.rect(2, top, 12, bottom - top + 1, col[3]);
  p.rect(3, top + 1, 10, bottom - top - 1, col[1]);
  face(p, 3, top + 1, 10, bottom - top - 1);
  return p.outline(OUT);
}

// ---------------------------------------------------------------- cube faces
const SAND = ['#d8c08a', '#c8ae76', '#e6d29c', '#b0965e'];
function speck(p, pal, rand, k = 0.3) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.set(x, y, rand() < k ? pal[1 + Math.floor(rand() * (pal.length - 1))] : pal[0]);
  return p;
}
// Tesserae: two-by-two stones with grout, a pattern by variant.
const TESS = { cream: '#e8dcc0', ochre: '#c89040', red: '#a8402a', blue: '#2a5a8a', black: '#2a2622', green: '#3a7a5a', grout: '#8a8070' };
function mosaicTop(v, rand) {
  const p = new Px(16, 16);
  const T = TESS;
  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      let c = T.cream;
      const ex = Math.min(tx, 7 - tx);
      const ey = Math.min(ty, 7 - ty);
      const e = Math.min(ex, ey);
      if (e === 0) c = T.red;
      else if (e === 1 && (tx + ty) % 2 === 0) c = T.ochre;
      else if (v === 0) {
        // A rosette.
        const d = Math.hypot(tx - 3.5, ty - 3.5);
        c = d < 1 ? T.ochre : d < 2.2 ? (Math.round(Math.atan2(ty - 3.5, tx - 3.5) * 2) % 2 ? T.blue : T.red) : T.cream;
      } else if (v === 1) c = (tx + ty) % 4 === 0 ? T.blue : (tx - ty + 8) % 4 === 0 ? T.green : T.cream;
      else if (v === 2) c = Math.abs(tx - 3.5) + Math.abs(ty - 3.5) < 2.2 ? T.black : Math.abs(tx - 3.5) + Math.abs(ty - 3.5) < 3.1 ? T.ochre : T.cream;
      else if (rand() < 0.12) c = [T.blue, T.green, T.ochre][Math.floor(rand() * 3)];
      const k = 0.92 + rand() * 0.14;
      p.set(tx * 2, ty * 2, shade(hex(c), k * 1.06));
      p.set(tx * 2 + 1, ty * 2, shade(hex(c), k));
      p.set(tx * 2, ty * 2 + 1, shade(hex(c), k));
      p.set(tx * 2 + 1, ty * 2 + 1, T.grout);
    }
  }
  return p;
}

export function cityTop(name, v, rand, rot) {
  switch (name) {
    case 'arena_sand': {
      const p = speck(new Px(16, 16), SAND, rand, 0.28);
      // The rake's grooves, curving a little.
      for (let y = 1 + (v % 2); y < 16; y += 4) {
        for (let x = 0; x < 16; x++) {
          const yy = y + Math.round(Math.sin((x + v * 3) * 0.4) * 0.6);
          p.set(x, yy, SAND[3]);
          p.set(x, yy - 1, SAND[2]);
        }
      }
      // Now and then, a stain the sand hasn't covered, or footprints.
      if (v === 3) {
        const cx = 4 + Math.floor(rand() * 7);
        const cy = 4 + Math.floor(rand() * 7);
        p.ellipse(cx, cy, 2, 1, '#8a4a34');
        p.set(cx + 2, cy + 1, '#7a3a2a');
        p.set(cx - 1, cy, '#9a5a3a');
      } else if (v === 1) for (const [x, y] of [[4, 11], [6, 8], [9, 6], [11, 3]]) p.rect(x, y, 2, 1, SAND[3]);
      return p;
    }
    case 'mosaic':
      return mosaicTop(v, rand);
    case 'stage_floor': {
      const p = new Px(16, 16);
      const B = ['#b07a3a', '#9a6630', '#c8904a', '#7a4e22'];
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        for (let x = 0; x < 16; x++) {
          let c = B[(x * 3 + row * 7 + Math.floor(rand() * 1.4)) % 9 === 0 ? 1 : 0];
          if (y % 4 === 3) c = B[3];
          else if (y % 4 === 0) c = B[2];
          p.set(x, y, c);
        }
        const seam = (row * 5 + v * 3) % 13 + 1;
        if (y % 4 !== 3 && seam < 15) p.set(seam, y, B[3]);
      }
      for (let r = 0; r < 4; r++) p.set((r * 7 + 3) % 15, r * 4 + 1, '#4a3420');
      // (Where an actor stands: a chalk cross.)
      if (v === 2) for (let k = -1; k <= 1; k++) {
        p.set(7 + k, 7 + k, '#f0ece0');
        p.set(7 + k, 7 - k, '#f0ece0');
      }
      return p;
    }
    case 'stained_glass': {
      const p = speck(new Px(16, 16), STONE, rand, 0.25);
      p.rect(2, 5, 12, 6, '#3a3440');
      for (let x = 3; x < 13; x += 2) p.set(x, 7, '#c03a3a');
      return p;
    }
    case 'hedge': {
      const p = new Px(16, 16);
      const G = ['#2e6a2a', '#245422', '#3e8236', '#1a3e18', '#58a048'];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const r = rand();
        p.set(x, y, r < 0.18 ? G[1] : r < 0.34 ? G[2] : r < 0.4 ? G[3] : G[0]);
      }
      // Clipped: the tips of the leaves, catching the light.
      for (let i = 0; i < 14; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), G[4]);
      return p;
    }
    case 'race_track': {
      const T = ['#8a6a44', '#7a5c3a', '#9c7a50', '#6a4c30'];
      const p = speck(new Px(16, 16), T, rand, 0.32);
      // Hoofprints, all one way.
      for (let k = 0; k < 3; k++) {
        const x = 2 + Math.floor(rand() * 11);
        const y = 2 + Math.floor(rand() * 11);
        p.set(x, y, T[3]);
        p.set(x + 1, y, T[3]);
        p.set(x - 1, y + 1, T[3]);
        p.set(x + 2, y + 1, T[3]);
      }
      if (rand() < 0.5) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), '#5a8a3a');
      return p;
    }
    case 'bath_tile': {
      const p = new Px(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const grout = x % 4 === 3 || y % 4 === 3;
        const k = ((Math.floor(x / 4) + Math.floor(y / 4) * 3 + v) % 5) * 0.02;
        p.set(x, y, grout ? '#8aa8b0' : shade(hex('#d8ecf0'), 0.95 + k));
      }
      if (v === 1) for (const [x, y] of [[4, 4], [8, 8], [4, 8], [8, 4]]) p.rect(x, y, 3, 3, '#5a9ab8');
      return p;
    }
    case 'bath_water': {
      const p = new Px(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const w = Math.sin(x * 0.7 + y * 0.35 + v * 1.7) + Math.sin(y * 0.9 - x * 0.3 + v);
        p.set(x, y, w > 1.2 ? '#a8f0f0' : w > 0.4 ? '#58c8d0' : w < -1.2 ? '#2a8aa0' : '#40aebe');
      }
      for (let i = 0; i < 3; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), '#e8ffff');
      return p;
    }
    case 'cut_stone': {
      const p = speck(new Px(16, 16), STONE, rand, 0.3);
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(rand() * 13);
        const y = Math.floor(rand() * 14);
        p.line(x, y, x + 2, y + 1, STONE[3]);
      }
      return p;
    }
    case 'scroll_shelf': {
      const p = new Px(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, y % 5 === 4 ? DARK[3] : DARK[(x + y) % 7 === 0 ? 1 : 0]);
      return p;
    }
  }
  return null;
}

export function cityFront(name, v, rand, rot) {
  const p = new Px(16, LH);
  switch (name) {
    case 'arena_sand':
      speck(p, SAND, rand, 0.3);
      for (let x = 0; x < 16; x++) p.set(x, LH - 1, SAND[3]);
      for (let y = 4; y < LH; y += 4) for (let x = 0; x < 16; x++) if ((x + y) % 3) p.set(x, y, SAND[1]);
      return p;
    case 'mosaic': case 'bath_tile': {
      speck(p, STONE, rand, 0.2);
      for (let x = 0; x < 16; x++) {
        p.set(x, 0, name === 'mosaic' ? (x % 4 < 2 ? TESS.red : TESS.ochre) : '#d8ecf0');
        p.set(x, 1, name === 'mosaic' ? TESS.cream : '#5a9ab8');
      }
      for (let x = 0; x < 16; x += 4) p.vline(x, 2, LH - 1, STONE[3]);
      return p;
    }
    case 'stage_floor': {
      // The stage's front: boards upright, a painted skirting.
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, x % 4 === 0 ? '#5a3a1c' : '#8a5a2a');
      p.hline(0, 15, 0, '#c8904a');
      p.hline(0, 15, 1, '#7a1e22');
      p.hline(0, 15, 2, '#c8a040');
      return p;
    }
    case 'stained_glass': {
      // Leaded panes in a pointed frame of stone.
      const cols = ['#c0303a', '#3050c0', '#30a050', '#e0b040', '#8040a0', '#3070c8'];
      p.fill('#2a2430');
      for (let y = 1; y < LH - 1; y++) {
        for (let x = 2; x < 14; x++) {
          if (y < 4 && Math.abs(x - 7.5) > (y + 1) * 1.6) continue;
          const pane = (Math.floor(x / 3) + Math.floor(y / 3) * 2 + v) % cols.length;
          const lead = x % 3 === 1 || y % 3 === 0;
          if (lead) continue;
          const c = cols[pane];
          p.set(x, y, (x + y) % 4 === 0 ? shade(hex(c), 1.35) : c);
        }
      }
      for (let y = 0; y < LH; y++) {
        p.set(0, y, STONE[1]);
        p.set(1, y, STONE[2]);
        p.set(14, y, STONE[0]);
        p.set(15, y, STONE[1]);
      }
      p.hline(0, 15, LH - 1, STONE[1]);
      return p;
    }
    case 'hedge': {
      const G = ['#2a6026', '#1e4a1c', '#367a30', '#14301a'];
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) {
        const r = rand();
        p.set(x, y, y > LH - 3 ? G[3] : r < 0.2 ? G[1] : r < 0.35 ? G[2] : G[0]);
      }
      return p;
    }
    case 'race_track':
      speck(p, ['#7a5c3a', '#6a4c30', '#8a6a44'], rand, 0.3);
      for (let x = 0; x < 16; x++) {
        p.set(x, 0, '#5a8a3a');
        if (rand() < 0.5) p.set(x, 1, '#4a7a30');
      }
      return p;
    case 'bath_water':
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, y < 2 ? '#7ad8e0' : shade(hex('#2a8aa0'), 1 - y * 0.03));
      return p;
    case 'cut_stone':
      speck(p, STONE, rand, 0.25);
      for (let y = 3; y < LH; y += 4) for (let x = 0; x < 16; x++) p.set(x, y, STONE[3]);
      for (let x = 2; x < 16; x += 5) p.vline(x, 0, 2, STONE[3]);
      return p;
    case 'scroll_shelf': {
      if (rot !== 0) {
        for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, y % 4 === 3 ? DARK[3] : DARK[0]);
        return p;
      }
      // Pigeonholes, each with a scroll's end showing (its tie).
      p.fill('#20140c');
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) if (x % 4 === 0 || y % 4 === 0) p.set(x, y, DARK[2]);
      const ties = ['#a83232', '#3a62a8', '#c8a032', '#3a7a4a', '#7a3aa0'];
      for (let cy = 0; cy < 3; cy++) {
        for (let cx = 0; cx < 4; cx++) {
          if (rand() < 0.12) continue;
          const x = cx * 4 + 2;
          const y = cy * 4 + 2;
          p.set(x, y, PARCH[0]);
          p.set(x - 1, y, PARCH[1]);
          p.set(x, y + 1, PARCH[1]);
          p.set(x + 1, y + 1, rand() < 0.5 ? PARCH[2] : PARCH[0]);
          if (rand() < 0.6) p.set(x + 1, y, ties[Math.floor(rand() * ties.length)]);
        }
      }
      return p;
    }
  }
  return null;
}

// ---------------------------------------------------------------- sprites
// The beasts kept for the arena (and the gardens): each cage holds one, by
// variant.
const BEASTS = [
  // A lion: tawny, maned.
  (p) => {
    p.rect(4, 19, 8, 4, '#c89040');
    p.ellipse(4, 17, 3, 3, '#7a4a1e');
    p.ellipse(4, 17, 2, 2, '#d8a050');
    p.set(3, 17, '#1a1410');
    p.rect(5, 23, 1, 2, '#a87430');
    p.rect(10, 23, 1, 2, '#a87430');
    p.line(12, 19, 13, 17, '#a87430');
    p.set(13, 16, '#7a4a1e');
  },
  // A bear: heavy, dark.
  (p) => {
    p.ellipse(8, 19, 5, 4, '#5a3a24');
    p.ellipse(4, 16, 2, 2, '#5a3a24');
    p.set(2, 14, '#5a3a24');
    p.set(5, 14, '#5a3a24');
    p.set(3, 16, '#1a1410');
    p.set(2, 17, '#3a2416');
    p.rect(5, 23, 2, 2, '#4a2e1c');
    p.rect(10, 23, 2, 2, '#4a2e1c');
  },
  // A boar: bristled, tusked.
  (p) => {
    p.ellipse(8, 20, 5, 3, '#4a3a30');
    for (let x = 5; x < 12; x += 2) p.set(x, 17, '#2a2018');
    p.rect(2, 19, 3, 3, '#5a4a3e');
    p.set(2, 21, '#e8e0c8');
    p.set(3, 19, '#1a1410');
    p.rect(5, 23, 1, 2, '#3a2a20');
    p.rect(11, 23, 1, 2, '#3a2a20');
  },
  // A grey wolf, pacing.
  (p) => {
    p.rect(5, 19, 7, 3, '#8a8a90');
    p.rect(2, 17, 4, 3, '#9a9aa0');
    p.set(2, 16, '#9a9aa0');
    p.set(4, 16, '#9a9aa0');
    p.set(3, 18, '#1a1410');
    p.rect(5, 22, 1, 3, '#6a6a70');
    p.rect(10, 22, 1, 3, '#6a6a70');
    p.line(12, 19, 14, 21, '#7a7a80');
  },
];

const TOPIARY = [
  (p) => {
    // A spiral cone.
    for (let y = 4; y < 30; y++) {
      const w = Math.floor((y - 4) / 3.4) + 1;
      const twist = (y + Math.floor(y / 4)) % 5 === 0;
      p.hline(8 - w, 7 + w, y, twist ? '#1e4a1c' : y % 2 ? '#2e6a2a' : '#3e8236');
    }
  },
  (p) => {
    // Three balls, stacked.
    p.ellipse(7.5, 25, 5, 4, '#2e6a2a');
    p.ellipse(7.5, 16, 4, 3, '#3a7a32');
    p.ellipse(7.5, 9, 3, 2, '#3e8236');
    p.vline(7, 20, 21, '#4a3020');
    p.vline(7, 12, 13, '#4a3020');
  },
  (p) => {
    // A peacock, its tail fanned.
    p.ellipse(7.5, 20, 7, 8, '#2e6a2a');
    for (let k = 0; k < 7; k++) p.set(2 + k * 2, 14 + (k % 2), '#58a048');
    p.ellipse(7, 22, 2, 4, '#3e8236');
    p.rect(6, 15, 2, 4, '#3e8236');
    p.set(6, 14, '#3e8236');
  },
  (p) => {
    // A cube on a stem, crisp edges.
    p.rect(2, 8, 12, 12, '#2e6a2a');
    p.hline(2, 13, 8, '#58a048');
    p.vline(2, 8, 19, '#3e8236');
    p.vline(13, 8, 19, '#1e4a1c');
    p.vline(7, 20, 26, '#4a3020');
  },
];

const FLATS = [
  // A tree, painted.
  (p) => {
    p.rect(6, 22, 3, 15, '#6a4a2a');
    p.ellipse(7.5, 14, 6, 8, '#3a8a3a');
    p.ellipse(5, 11, 3, 3, '#4aa04a');
    p.ellipse(10, 16, 2, 2, '#2a6a2a');
  },
  // A castle's tower.
  (p) => {
    p.rect(3, 10, 10, 27, '#a8a4b8');
    for (let x = 3; x < 13; x += 3) p.rect(x, 7, 2, 3, '#a8a4b8');
    p.rect(6, 16, 3, 5, '#2a2440');
    p.rect(6, 28, 4, 9, '#5a3a2a');
    for (let y = 12; y < 36; y += 4) p.hline(3, 12, y, '#8a86a0');
  },
  // A ship, on painted waves.
  (p) => {
    p.vline(8, 6, 26, '#5a3a2a');
    p.rect(4, 8, 8, 9, '#f0e8d8');
    p.hline(4, 11, 12, '#d8d0c0');
    p.rect(2, 26, 12, 4, '#7a4a2a');
    for (let x = 0; x < 16; x++) p.set(x, 31 + ((x >> 1) % 2), '#3a7ac8');
    p.rect(0, 33, 16, 4, '#2a5aa8');
  },
  // A cottage front, with its window lit.
  (p) => {
    p.rect(2, 18, 12, 19, '#d8c8a0');
    for (let k = 0; k < 6; k++) p.hline(1 + k, 14 - k, 17 - k, '#a83a2a');
    p.rect(5, 23, 4, 4, '#f0d070');
    p.rect(10, 28, 3, 9, '#6a4a2a');
  },
];

const VINES = (p, v) => {
  // The trellis: two posts, three wires, the vine climbing and spreading
  // along them, leaves and bunches of grapes.
  post(p, 1, 10, 39, 2);
  post(p, 13, 10, 39, 2);
  for (const y of [12, 20, 28]) p.hline(2, 14, y, '#8a8a90');
  for (let x = 1; x < 15; x++) {
    for (const y of [12, 20]) {
      const k = (x * 7 + y + v * 5) % 9;
      p.set(x, y - 1, k < 3 ? '#3a7a2a' : '#4e9a36');
      p.set(x, y + 1, k < 5 ? '#3a7a2a' : '#2e6022');
      if (k === 1) p.set(x, y - 2, '#5aaa3e');
    }
  }
  p.line(7, 39, 8, 13, '#5a3e24');
  p.line(8, 30, 4, 21, '#5a3e24');
  const grape = v % 2 ? ['#5a2a6a', '#7a3a8a', '#9a5aaa'] : ['#8a9a2a', '#a8b83a', '#c8d860'];
  for (const [gx, gy] of [[3, 14], [10, 14], [6, 22], [12, 22]].slice(0, 2 + (v % 3))) {
    for (let j = 0; j < 4; j++) for (let i = -1 + (j >> 1); i <= 1 - (j >> 1); i++) p.set(gx + i, gy + j, grape[(i + j + 3) % 3]);
  }
};

export const CITY_SPRITES = {
  // ------------------------------------------------------------ arena
  // The fighters' gate: a round arch of dressed stone, the iron grille
  // down in it, the dark of the tunnel behind, a torch on its bracket.
  arena_gate(rot) {
    const p = spr(TALL);
    if (rot === 1 || rot === 3) {
      p.rect(5, 6, 6, 34, STONE[0]);
      p.vline(5, 6, 39, STONE[2]);
      p.vline(10, 6, 39, STONE[1]);
      for (let y = 8; y < 40; y += 4) p.hline(5, 10, y, STONE[3]);
      p.vline(rot === 1 ? 6 : 9, 10, 38, IRON[1]);
      return p.outline(OUT);
    }
    const back = rot === 2;
    p.rect(0, 4, 16, 36, STONE[0]);
    for (let y = 4; y < 40; y++) {
      for (let x = 0; x < 16; x++) {
        const row = Math.floor((y - 4) / 4);
        if ((y - 4) % 4 === 3 || (x + (row % 2) * 3) % 6 === 0) p.set(x, y, STONE[1]);
      }
    }
    p.hline(0, 15, 4, STONE[2]);
    // The opening.
    for (let y = 9; y < 40; y++) for (let x = 3; x < 13; x++) {
      if (y < 13 && Math.hypot(x - 7.5, y - 13) > 5) continue;
      p.set(x, y, back ? '#2a2228' : '#141018');
    }
    // The voussoirs round it.
    for (let a = 0; a <= 8; a++) {
      const t = Math.PI - (a / 8) * Math.PI;
      p.set(Math.round(7.5 + Math.cos(t) * 6), Math.round(13 - Math.sin(t) * 6), STONE[2]);
    }
    // The grille: bars down, bars across, spiked at the foot.
    for (let x = 4; x < 12; x += 2) for (let y = 9; y < 39; y++) if (!(y < 13 && Math.hypot(x - 7.5, y - 13) > 5)) p.set(x, y, IRON[2]);
    for (let y = 15; y < 38; y += 6) p.hline(3, 12, y, IRON[0]);
    for (let x = 4; x < 12; x += 2) p.set(x, 39, IRON[3]);
    if (!back) {
      // A torch on its bracket, and a keystone carved with a lion.
      p.rect(14, 16, 1, 4, IRON[1]);
      p.rect(13, 13, 2, 3, WOOD[0]);
      flame(p, 14, 12);
      p.rect(6, 4, 4, 4, STONE[2]);
      p.set(7, 5, '#a87430');
      p.set(8, 5, '#a87430');
    }
    return p.outline(OUT);
  },
  // A beast's cage on a wheeled bed: bars, the beast inside, straw.
  beast_cage(rot, st, f, rand, v = 0) {
    const p = spr();
    p.rect(1, 25, 14, 2, WOOD[1]);
    p.rect(1, 9, 14, 2, IRON[1]);
    p.hline(1, 14, 9, IRON[2]);
    p.rect(1, 11, 14, 14, '#2a2420');
    for (let x = 2; x < 14; x++) if ((x * 3) % 5 === 0) p.set(x, 24, '#c8a860');
    BEASTS[v % BEASTS.length](p);
    if (rot === 3 || rot === 1) {
      const q = p.copy();
      p.d.fill(0);
      p.blit(q, 0, 0, rot === 3);
    }
    for (let x = 1; x < 15; x += 2) p.vline(x, 11, 24, IRON[0]);
    p.vline(1, 9, 26, IRON[2]);
    p.vline(14, 9, 26, IRON[1]);
    p.ellipse(3, 26, 1.5, 1.5, WOOD[3]);
    p.ellipse(12, 26, 1.5, 1.5, WOOD[3]);
    return p.outline(OUT);
  },
  // The board of the day's bouts: two fighters painted crossing swords
  // over it, the names chalked up below with their odds.
  bout_board() {
    return postedBoard(10, 30, (p, x, y, w, h) => {
      p.rect(x, y, w, h, '#2a2a2e');
      // The painted pair.
      p.rect(x + 1, y + 1, 2, 4, '#c8a070');
      p.rect(x + 7, y + 1, 2, 4, '#c8a070');
      p.set(x + 1, y, '#a82a2a');
      p.set(x + 8, y, '#2a5aa8');
      p.line(x + 3, y + 1, x + 6, y + 4, '#e0e0e8');
      p.line(x + 6, y + 1, x + 3, y + 4, '#e0e0e8');
      // The bouts, in chalk; the odds after each.
      for (let r = 0; r < 4; r++) {
        const yy = y + 7 + r * 3;
        p.hline(x + 1, x + 4 + (r % 2), yy, '#e8e4d8');
        p.set(x + 6, yy, '#c8c4b8');
        p.hline(x + 8, x + 9, yy, r === 0 ? '#f0c040' : '#e8e4d8');
      }
      p.set(x + w - 2, y + h - 2, '#a82a2a');
    });
  },
  // A champion in marble, helmed and crested, shield up and blade raised,
  // on a pedestal with a wreath carved on it.
  gladiator_statue(rot) {
    const p = spr(TALL);
    const m = MARBLE;
    p.rect(2, 30, 12, 10, m[1]);
    p.rect(2, 30, 12, 2, m[2]);
    p.hline(2, 13, 39, m[3]);
    p.ellipse(7.5, 35, 2.5, 2, '#7a9a5a');
    p.ellipse(7.5, 35, 1.5, 1, m[1]);
    const flip = rot === 3;
    const g = (x, y, w, h, c) => p.rect(flip ? 16 - x - w : x, y, w, h, c);
    // Legs, a stride.
    g(5, 22, 2, 8, m[1]);
    g(9, 23, 2, 7, m[3]);
    // Body, the belt, the shoulders.
    g(5, 13, 6, 9, m[0]);
    g(5, 19, 6, 1, m[3]);
    g(4, 13, 8, 2, m[2]);
    // The helm and its crest.
    g(6, 8, 4, 5, m[0]);
    g(6, 10, 4, 1, m[3]);
    g(5, 5, 6, 2, m[2]);
    g(4, 6, 2, 1, m[2]);
    // The shield arm, the shield.
    g(1, 13, 4, 9, m[1]);
    g(1, 13, 1, 9, m[2]);
    // The sword arm raised, the blade.
    g(11, 9, 2, 5, m[0]);
    g(12, 1, 1, 9, m[2]);
    g(11, 9, 3, 1, m[3]);
    return p.outline(OUT);
  },
  // A ring-post of the north: knotwork carved down it, a dragon's head
  // at the top, an iron ring for the rope.
  holmgang_post() {
    const p = spr(TALL);
    p.rect(5, 8, 6, 32, WOOD[0]);
    p.vline(5, 8, 39, WOOD[2]);
    p.vline(10, 8, 39, WOOD[1]);
    for (let y = 12; y < 38; y += 4) {
      p.line(6, y, 9, y + 2, WOOD[3]);
      p.line(9, y, 6, y + 2, WOOD[3]);
    }
    // The beast's head.
    p.rect(4, 3, 7, 5, WOOD[0]);
    p.rect(9, 5, 4, 3, WOOD[0]);
    p.set(7, 4, '#c8a040');
    p.set(12, 7, WOOD[3]);
    p.line(4, 3, 3, 1, WOOD[2]);
    p.line(6, 3, 6, 0, WOOD[2]);
    p.ellipse(8, 20, 2.5, 2.5, IRON[2]);
    p.ellipse(8, 20, 1.5, 1.5, WOOD[0]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ library
  // A lectern: the great book open on its slope, a candle burning by it.
  reading_lectern(rot, st, f) {
    const p = spr();
    if (rot === 2) {
      post(p, 7, 14, 26, 2, DARK);
      p.rect(3, 10, 10, 5, DARK[1]);
      p.hline(3, 12, 10, DARK[2]);
      p.rect(5, 26, 6, 1, DARK[3]);
      return p.outline(OUT);
    }
    post(p, 7, 16, 26, 2, DARK);
    p.rect(4, 26, 8, 1, DARK[3]);
    p.rect(3, 12, 11, 4, DARK[0]);
    p.hline(3, 13, 15, DARK[1]);
    // The book: two pages, the gutter, the lines.
    p.rect(2, 9, 6, 4, PARCH[0]);
    p.rect(8, 9, 6, 4, PARCH[2]);
    p.vline(8, 9, 12, PARCH[3]);
    writing(p, 3, 10, 4, 2, '#6a5a44');
    writing(p, 9, 10, 4, 2, '#6a5a44');
    p.set(4, 12, '#a83232');
    p.hline(2, 13, 13, '#7a1e1e');
    candle(p, 13, 9, 3, true, f);
    return p.outline(OUT);
  },
  // The map table: a chart of the coast unrolled, weighted at its
  // corners, a pair of dividers on it, the compass rose.
  map_table(rot) {
    const p = spr();
    p.rect(1, 15, 14, 3, WOOD[0]);
    p.hline(1, 14, 15, WOOD[2]);
    post(p, 2, 18, 26, 1);
    post(p, 13, 18, 26, 1);
    p.rect(1, 9, 14, 6, PARCH[0]);
    // The coast and the sea.
    for (let x = 1; x < 15; x++) {
      const c = 11 + Math.round(Math.sin(x * 0.9) * 1.5);
      for (let y = 9; y < 15; y++) if (y > c) p.set(x, y, '#9ab8c0');
      p.set(x, c, '#6a5a44');
    }
    p.set(4, 10, '#a83232');
    p.set(10, 12, '#3a6a3a');
    p.line(9, 10, 12, 11, '#c8a040');
    p.line(9, 10, 11, 9, '#c8a040');
    p.set(13, 13, '#5a4a3a');
    p.set(12, 13, '#e8e0d0');
    for (const [x, y] of [[1, 9], [14, 9], [1, 14], [14, 14]]) p.set(x, y, IRON[1]);
    if (rot === 1 || rot === 3) p.tint(0.94);
    return p.outline(OUT);
  },
  // A globe on its stand in its brass meridian, turning (four frames).
  globe(rot, st, f) {
    const p = spr();
    p.rect(5, 25, 6, 2, DARK[0]);
    p.vline(7, 19, 25, DARK[2]);
    p.vline(8, 19, 25, DARK[1]);
    p.ellipse(7.5, 13, 5, 5, '#3a6aa8');
    // The lands, turning.
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        if (x * x + y * y > 26) continue;
        const lon = Math.asin(Math.max(-1, Math.min(1, x / Math.sqrt(Math.max(1, 26 - y * y))))) + f * (Math.PI / 2);
        const land = Math.sin(lon * 2 + y * 0.4) + Math.cos(y * 0.9 + lon) > 0.9;
        if (land) p.set(7.5 + x, 13 + y, (x + y) % 3 ? '#c8b070' : '#5a8a3a');
      }
    }
    p.set(5, 10, '#9ac0e8');
    p.set(6, 10, '#9ac0e8');
    // The meridian ring.
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2;
      p.set(Math.round(7.5 + Math.cos(t) * 6.4), Math.round(13 + Math.sin(t) * 6.4), BRASS[a % 5 === 0 ? 2 : 0]);
    }
    return p.outline(OUT);
  },
  // A telescope on its mount, aimed up at the sky; brass and wood.
  telescope(rot) {
    const p = spr(TALL);
    p.line(4, 39, 8, 26, WOOD[1]);
    p.line(12, 39, 8, 26, WOOD[1]);
    p.line(8, 39, 8, 26, WOOD[0]);
    p.rect(6, 24, 4, 3, BRASS[1]);
    // The tube, its bands, the eyepiece and the great end.
    for (let k = 0; k < 18; k++) {
      const x = 3 + Math.round(k * 0.62);
      const y = 30 - k - 3;
      p.rect(x, y, 3, 2, k % 6 === 0 ? BRASS[2] : BRASS[0]);
      p.set(x, y + 1, BRASS[1]);
    }
    p.rect(13, 6, 3, 3, BRASS[2]);
    p.set(14, 6, '#c8e0f0');
    p.rect(2, 28, 2, 2, BRASS[3]);
    if (rot === 3) {
      const q = p.copy();
      p.d.fill(0);
      p.blit(q, 0, 0, true);
    }
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ holy
  // A font of holy water: a carved basin on its stem, the water still, a
  // glimmer on it.
  holy_font() {
    const p = spr();
    p.rect(4, 24, 8, 3, MARBLE[1]);
    p.rect(6, 17, 4, 7, MARBLE[0]);
    p.vline(6, 17, 23, MARBLE[2]);
    p.ellipse(7.5, 14, 6, 3, MARBLE[0]);
    p.ellipse(7.5, 13, 5, 2, MARBLE[2]);
    p.ellipse(7.5, 13, 4, 1.5, '#5ab0d0');
    p.set(6, 13, '#d8f8ff');
    p.set(9, 12, '#a8e8f8');
    p.hline(3, 12, 16, MARBLE[3]);
    return p.outline(OUT);
  },
  // An iron rack of votive candles, tier on tier; alight when lit.
  candle_rack(rot, st, f) {
    const p = spr();
    p.rect(2, 25, 12, 2, IRON[1]);
    p.vline(2, 14, 25, IRON[0]);
    p.vline(13, 14, 25, IRON[0]);
    for (const [y, x0, x1] of [[23, 3, 12], [19, 4, 11], [15, 5, 10]]) {
      p.hline(x0, x1, y, IRON[2]);
      for (let x = x0; x <= x1; x += 2) candle(p, x, y - 1, 2 + ((x + y) % 2), st && (x * 7 + y) % 5 !== 0, f + x);
    }
    return p.outline(OUT);
  },
  // A pew: a long seat with a high back, its ends carved.
  pew(rot) {
    const p = spr();
    const w = DARK;
    if (rot === 0 || rot === 2) {
      p.rect(0, 17, 16, 3, w[2]);
      p.hline(0, 15, 17, shade(hex(w[2]), 1.2));
      p.rect(0, 20, 16, 1, w[1]);
      p.rect(0, 20, 2, 7, w[0]);
      p.rect(14, 20, 2, 7, w[0]);
      if (rot === 0) {
        p.rect(0, 9, 16, 7, w[0]);
        p.hline(0, 15, 9, w[2]);
        for (let x = 3; x < 16; x += 4) p.vline(x, 10, 15, w[3]);
      } else {
        p.rect(0, 21, 16, 4, w[0]);
        p.hline(0, 15, 21, w[2]);
      }
      p.ellipse(1, 10, 1, 1.5, w[2]);
      p.ellipse(14, 10, 1, 1.5, w[2]);
    } else {
      p.rect(5, 11, 6, 15, w[2]);
      p.vline(5, 11, 25, w[1]);
      p.rect(rot === 1 ? 10 : 4, 6, 2, 19, w[0]);
    }
    return p.outline(OUT);
  },
  // The shrine of the relic: a gilded house of glass on a draped stand,
  // the relic glowing inside, candles either side.
  relic_shrine(rot, st, f) {
    const p = spr(TALL);
    p.rect(2, 26, 12, 14, '#5a1a2a');
    p.hline(2, 13, 26, '#c8a040');
    for (let x = 3; x < 13; x += 3) p.vline(x, 27, 39, '#4a1222');
    p.hline(2, 13, 39, '#3a0e18');
    // The reliquary: a little gilded house, its roof, its windows.
    p.rect(4, 14, 8, 12, BRASS[0]);
    p.vline(4, 14, 25, BRASS[2]);
    p.vline(11, 14, 25, BRASS[1]);
    for (let k = 0; k < 4; k++) p.hline(4 + k, 11 - k, 13 - k, k === 0 ? BRASS[2] : BRASS[0]);
    p.set(7, 8, BRASS[2]);
    p.set(8, 8, BRASS[2]);
    p.vline(7, 6, 8, BRASS[2]);
    p.hline(6, 8, 7, BRASS[2]);
    p.rect(6, 16, 4, 7, '#2a1a10');
    p.ellipse(7.5, 19, 1.5, 2, '#fff0c0');
    p.set(7, 18, '#ffffff');
    candle(p, 1, 25, 4, true, f);
    candle(p, 14, 25, 4, true, f + 1);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ bazaar
  // Sacks of spice, rolled down: saffron, paprika, green herbs, a scoop.
  spice_sacks() {
    const p = spr();
    const sack = (x, w, col) => {
      p.rect(x, 18, w, 9, '#c8b088');
      p.vline(x, 18, 26, '#e0cca4');
      p.hline(x, x + w - 1, 18, '#a89068');
      p.ellipse(x + (w - 1) / 2, 17, (w - 1) / 2, 2, col);
      p.set(x + 1, 16, shade(hex(col), 1.3));
    };
    sack(0, 6, '#e0a020');
    sack(10, 6, '#c03a1a');
    sack(5, 6, '#5a8a2a');
    p.ellipse(7.5, 25, 1.5, 1, '#c8a040');
    p.line(9, 24, 11, 22, '#8a6a3a');
    return p.outline(OUT);
  },
  // Rugs: a stack of them folded, one thrown over a rail.
  rug_stack() {
    const p = spr();
    const rugs = [['#a8262a', '#e0b040'], ['#2a4a8a', '#e8dcc0'], ['#5a2a6a', '#c8a040'], ['#2a6a4a', '#d8c8a0']];
    rugs.forEach(([a, b], i) => {
      const y = 23 - i * 3;
      p.rect(1, y, 14, 3, a);
      for (let x = 2; x < 14; x += 3) p.set(x, y + 1, b);
      p.hline(1, 14, y, shade(hex(a), 1.25));
    });
    // The rail and a rug hung over it, tasselled.
    p.hline(0, 15, 6, WOOD[2]);
    p.vline(0, 6, 26, WOOD[0]);
    p.vline(15, 6, 26, WOOD[0]);
    p.rect(3, 7, 10, 7, '#8a2a3a');
    p.rect(4, 8, 8, 5, '#c8a040');
    p.rect(5, 9, 6, 3, '#2a3a6a');
    for (let x = 3; x < 13; x += 2) p.set(x, 14, '#e8dcc0');
    return p.outline(OUT);
  },
  // Pots and jars: a tall amphora, a glazed jar, a pitcher, a bowl.
  pottery() {
    const p = spr();
    p.ellipse(3.5, 18, 3, 6, '#b8603a');
    p.rect(2, 10, 3, 3, '#b8603a');
    p.set(1, 11, '#8a4a2a');
    p.set(5, 11, '#8a4a2a');
    p.hline(1, 6, 18, '#2a1a10');
    p.ellipse(10, 21, 4, 4, '#2a6a8a');
    p.hline(6, 14, 20, '#e8dcc0');
    p.rect(9, 16, 3, 2, '#2a6a8a');
    p.ellipse(13, 25, 2.5, 1.5, '#c8a060');
    p.ellipse(5.5, 25, 2, 1.5, '#a87a4a');
    return p.outline(OUT);
  },
  // Songbirds in hanging cages, on a stand: yellow, red, blue.
  birdcages(rot, st, f) {
    const p = spr(TALL);
    post(p, 7, 6, 39, 2);
    p.hline(1, 14, 6, WOOD[2]);
    p.rect(5, 38, 6, 2, WOOD[1]);
    const cage = (cx, top, col) => {
      p.vline(cx, top - 2, top, ROPE);
      for (let y = 0; y < 8; y++) {
        const w = y < 2 ? 1 + y : 3;
        p.set(cx - w, top + y, BRASS[0]);
        p.set(cx + w, top + y, BRASS[1]);
      }
      p.hline(cx - 3, cx + 3, top + 8, BRASS[1]);
      p.vline(cx, top + 1, top + 7, BRASS[3]);
      const hop = (f + cx) % 2;
      p.set(cx - 1, top + 5 - hop, col);
      p.set(cx - 2, top + 5 - hop, col);
      p.set(cx - 1, top + 4 - hop, shade(hex(col), 1.2));
      p.set(cx - 2, top + 4 - hop, '#1a1410');
    };
    cage(3, 9, '#f0d030');
    cage(12, 9, '#d03a2a');
    cage(7, 22, '#3a7ad8');
    return p.outline(OUT);
  },
  // A rack of silks, hung in folds: crimson, saffron, jade, sky.
  silk_rack() {
    const p = spr(TALL);
    post(p, 0, 6, 39, 2);
    post(p, 14, 6, 39, 2);
    p.hline(0, 15, 6, WOOD[2]);
    const cols = ['#c0203a', '#e8a820', '#2a9a6a', '#4a8ad8'];
    cols.forEach((c, i) => {
      const x = 2 + i * 3;
      const len = 22 + ((i * 5) % 9);
      for (let y = 7; y < 7 + len; y++) {
        p.set(x, y, c);
        p.set(x + 1, y, (y + i) % 4 === 0 ? shade(hex(c), 1.35) : shade(hex(c), 0.85));
        p.set(x + 2, y, shade(hex(c), 0.7));
      }
      p.hline(x, x + 2, 7 + len, shade(hex(c), 0.6));
    });
    return p.outline(OUT);
  },
  // The board of prices: the region's goods down it, what each fetches
  // here and which way it's going.
  price_board() {
    return postedBoard(8, 32, (p, x, y, w, h) => {
      p.rect(x, y, w, h, '#26302a');
      const goods = ['#e0c040', '#a83232', '#5a8a3a', '#8a6a3a', '#c8c8d0', '#3a6aa8', '#e0a020'];
      for (let r = 0; r < 7; r++) {
        const yy = y + 1 + r * 3;
        p.set(x + 1, yy, goods[r]);
        p.set(x + 1, yy + 1, shade(hex(goods[r]), 0.7));
        p.hline(x + 3, x + 6, yy, '#e8e4d8');
        const up = (r * 5) % 3;
        p.set(x + 8, yy, up === 0 ? '#5ad86a' : up === 1 ? '#e85a4a' : '#c8c4b8');
        p.set(x + 8, yy + 1, up === 0 ? '#3a8a4a' : up === 1 ? '#a83a2a' : '#c8c4b8');
      }
    });
  },
  // The auction block: a stepped podium, the auctioneer's stand on it, a
  // gavel, a little bell.
  auction_block(rot) {
    const p = spr();
    p.rect(0, 22, 16, 5, WOOD[0]);
    p.hline(0, 15, 22, WOOD[2]);
    p.rect(2, 18, 12, 4, WOOD[0]);
    p.hline(2, 13, 18, WOOD[2]);
    p.rect(rot === 3 ? 3 : 7, 9, 6, 9, DARK[0]);
    p.hline(rot === 3 ? 3 : 7, rot === 3 ? 8 : 12, 9, DARK[2]);
    p.rect(rot === 3 ? 4 : 8, 12, 4, 3, '#a8262a');
    p.set(rot === 3 ? 10 : 4, 16, BRASS[2]);
    p.ellipse(rot === 3 ? 11 : 3, 17, 1.5, 1, BRASS[0]);
    p.line(rot === 3 ? 4 : 9, 8, rot === 3 ? 6 : 11, 6, WOOD[2]);
    p.rect(rot === 3 ? 5 : 10, 5, 2, 2, WOOD[1]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ forge
  // The great furnace: a tower of firebrick tapering up, banded in iron,
  // the mouth at its foot glowing and the iron running out of it into the
  // mould; smoke from the top (three frames).
  blast_furnace(rot, st, f) {
    const p = spr(TALL);
    const BR = ['#8a3a2a', '#6a2a1e', '#a84a34', '#4a1a12'];
    for (let y = 6; y < 40; y++) {
      const w = 4 + Math.floor((y - 6) / 6);
      for (let x = 8 - w; x < 8 + w; x++) {
        const row = Math.floor(y / 3);
        const joint = y % 3 === 2 || (x + (row % 2) * 2) % 4 === 0;
        p.set(x, y, joint ? BR[3] : x < 8 - w + 2 ? BR[2] : x > 8 + w - 3 ? BR[1] : BR[0]);
      }
    }
    for (const y of [12, 22, 32]) {
      const w = 4 + Math.floor((y - 6) / 6);
      p.hline(8 - w, 7 + w, y, IRON[0]);
    }
    // The mouth, white-hot at its heart.
    p.rect(5, 31, 6, 6, '#1a0e0a');
    p.rect(6, 32, 4, 5, ['#ff7a20', '#ff9a30', '#ff8a28'][f % 3]);
    p.rect(7, 33, 2, 3, '#fff0a0');
    // The run of iron down to the mould.
    p.hline(10, 15, 38, '#ffb040');
    p.set(15, 39, '#ff7a20');
    // Smoke from the top.
    for (let k = 0; k < 4; k++) p.set(6 + ((k + f) % 3), 5 - k, k < 2 ? '#5a5458' : '#7a7478');
    p.set(9, 3 - (f % 2), '#6a6468');
    return p.outline(OUT);
  },
  // The quenching trough: stone, the water dark and still, tongs across it.
  quench_trough(rot) {
    const p = spr();
    const side = rot === 1 || rot === 3;
    const x0 = side ? 4 : 0;
    const w = side ? 8 : 16;
    p.rect(x0, 18, w, 9, STONE[0]);
    p.hline(x0, x0 + w - 1, 18, STONE[2]);
    p.rect(x0 + 1, 18, w - 2, 3, '#2a3a4a');
    p.hline(x0 + 2, x0 + w - 4, 19, '#4a6a8a');
    for (let x = x0; x < x0 + w; x += 4) p.vline(x, 21, 26, STONE[1]);
    p.line(x0 + 2, 17, x0 + w - 3, 15, IRON[1]);
    p.line(x0 + 2, 16, x0 + w - 3, 14, IRON[2]);
    return p.outline(OUT);
  },
  // A water wheel turning (four frames): its rim, spokes and paddles, the
  // water spilling off them.
  water_wheel(rot, st, f) {
    const p = spr(TALL);
    const cx = 7.5;
    const cy = 24;
    if (rot === 1 || rot === 3) {
      p.rect(6, 10, 4, 28, WOOD[0]);
      for (let y = 10 + (f % 2) * 2; y < 38; y += 4) p.hline(5, 10, y, WOOD[2]);
      p.vline(8, 30, 39, '#5aa8d8');
      return p.outline(OUT);
    }
    for (let a = 0; a < 48; a++) {
      const t = (a / 48) * Math.PI * 2;
      p.set(Math.round(cx + Math.cos(t) * 7), Math.round(cy + Math.sin(t) * 7), WOOD[1]);
      p.set(Math.round(cx + Math.cos(t) * 6), Math.round(cy + Math.sin(t) * 6), WOOD[0]);
    }
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + f * (Math.PI / 16);
      p.line(Math.round(cx), cy, Math.round(cx + Math.cos(t) * 6), Math.round(cy + Math.sin(t) * 6), WOOD[2]);
      const px = Math.round(cx + Math.cos(t) * 8);
      const py = Math.round(cy + Math.sin(t) * 8);
      p.rect(px - 1, py - 1, 2, 2, WOOD[0]);
    }
    p.rect(6, 22, 3, 3, IRON[1]);
    for (let y = 31; y < 40; y++) p.set(2 + ((y + f) % 3), y, '#7ac8f0');
    p.hline(0, 15, 39, '#3a7ab8');
    return p.outline(OUT);
  },
  // The smiths' guild board: hammer and anvil, the commissions pinned up.
  guild_board() {
    return postedBoard(10, 30, (p, x, y, w, h) => {
      p.rect(x + 2, y + 1, 6, 3, IRON[1]);
      p.rect(x + 3, y + 4, 4, 2, IRON[1]);
      p.hline(x + 1, x + 8, y + 1, IRON[2]);
      p.line(x + 6, y, x + 9, y + 3, WOOD[2]);
      notice(p, x, y + 7, 5, 7);
      notice(p, x + 5, y + 8, 5, 6, '#3a3a6a');
      notice(p, x + 2, y + 15, 6, 4);
    });
  },
  // ------------------------------------------------------------ citadel
  // The sellswords' board: crossed blades over a purse, their names and
  // prices pinned under.
  merc_board() {
    return postedBoard(10, 30, (p, x, y, w, h) => {
      p.line(x + 1, y, x + 8, y + 5, IRON[2]);
      p.line(x + 8, y, x + 1, y + 5, IRON[2]);
      p.ellipse(x + 4.5, y + 4, 1.5, 1.5, '#8a6a3a');
      p.set(x + 4, y + 3, '#e0c040');
      for (let k = 0; k < 3; k++) {
        const nx = x + k * 3 + (k ? 0 : 0);
        p.rect(nx, y + 8, 3, 4, PARCH[0]);
        p.ellipse(nx + 1, y + 9, 0.6, 0.6, '#6a5040');
        p.set(nx + 1, y + 11, '#c8a040');
      }
      notice(p, x + 1, y + 14, 8, 6, '#6a2a2a');
    });
  },
  // A butt on its tripod: rings of red, white and gold on straw.
  target_butt(rot) {
    const p = spr(TALL);
    if (rot === 1 || rot === 3) {
      p.rect(6, 14, 4, 18, '#c8a860');
      p.line(8, 32, 4, 39, WOOD[1]);
      p.line(8, 32, 12, 39, WOOD[1]);
      return p.outline(OUT);
    }
    p.line(4, 39, 6, 28, WOOD[1]);
    p.line(12, 39, 10, 28, WOOD[1]);
    p.line(8, 39, 8, 30, WOOD[0]);
    p.ellipse(7.5, 21, 7, 8, '#c8a860');
    p.ellipse(7.5, 21, 6, 7, '#f0ece0');
    p.ellipse(7.5, 21, 4.5, 5, '#a82a2a');
    p.ellipse(7.5, 21, 3, 3, '#f0ece0');
    p.ellipse(7.5, 21, 1.5, 1.5, '#e0b030');
    p.line(10, 18, 13, 15, WOOD[2]);
    p.set(13, 14, '#e8e0d0');
    return p.outline(OUT);
  },
  // A catapult: its frame, the arm drawn back, the sling with a stone.
  catapult(rot) {
    const p = spr(TALL);
    p.rect(1, 33, 14, 3, WOOD[0]);
    p.hline(1, 14, 33, WOOD[2]);
    p.ellipse(3, 37, 2, 2, WOOD[1]);
    p.ellipse(12, 37, 2, 2, WOOD[1]);
    p.line(4, 33, 8, 22, WOOD[0]);
    p.line(12, 33, 8, 22, WOOD[0]);
    p.rect(7, 21, 3, 2, IRON[1]);
    p.line(8, 22, 2, 9, WOOD[2]);
    p.line(9, 22, 3, 9, WOOD[1]);
    p.ellipse(2, 8, 2, 1.5, '#7a7066');
    p.vline(8, 23, 31, ROPE);
    if (rot === 3) {
      const q = p.copy();
      p.d.fill(0);
      p.blit(q, 0, 0, true);
    }
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ baths
  // The rubbing table: padded, its linen white, the oils beside it.
  massage_table(rot) {
    const p = spr();
    const side = rot === 1 || rot === 3;
    if (side) {
      p.rect(5, 12, 6, 12, '#f0ece4');
      p.vline(5, 12, 23, '#ffffff');
      p.rect(5, 24, 6, 2, WOOD[1]);
    } else {
      p.rect(0, 16, 16, 4, '#f0ece4');
      p.hline(0, 15, 16, '#ffffff');
      p.hline(0, 15, 19, '#c8c0b4');
      p.rect(1, 20, 2, 7, WOOD[0]);
      p.rect(13, 20, 2, 7, WOOD[0]);
      p.rect(2, 14, 4, 2, '#e8e0d0');
    }
    p.rect(12, 11, 2, 4, '#5a9a5a');
    p.set(12, 10, '#e8dcc0');
    p.rect(9, 12, 2, 3, '#c8a040');
    return p.outline(OUT);
  },
  // A statue of a water-bearer, pouring from her urn into the pool.
  bath_statue() {
    const p = spr(TALL);
    const m = MARBLE;
    p.rect(3, 32, 10, 8, m[1]);
    p.hline(3, 12, 32, m[2]);
    p.rect(6, 22, 4, 10, m[0]);
    p.vline(6, 22, 31, m[2]);
    p.rect(5, 14, 6, 8, m[0]);
    p.rect(6, 9, 4, 5, m[0]);
    p.set(6, 9, m[2]);
    p.rect(6, 7, 4, 2, m[3]);
    // The urn on her shoulder, tipped, the water falling.
    p.ellipse(11, 13, 2.5, 2, m[1]);
    p.rect(12, 11, 2, 2, m[1]);
    for (let y = 14; y < 32; y++) p.set(13 + (y % 3 === 0 ? 1 : 0), y, y % 2 ? '#8ad8f0' : '#c8f0ff');
    p.rect(4, 15, 2, 5, m[1]);
    return p.outline(OUT);
  },
  // Towels folded on a shelf, striped; soap; a sponge.
  towel_shelf() {
    const p = spr();
    p.rect(1, 25, 14, 2, WOOD[1]);
    p.rect(1, 17, 14, 1, WOOD[2]);
    p.vline(1, 9, 26, WOOD[0]);
    p.vline(14, 9, 26, WOOD[0]);
    p.rect(1, 9, 14, 1, WOOD[2]);
    for (const [x, y, c] of [[2, 21, '#f0ece4'], [7, 21, '#c8e0f0'], [2, 13, '#f0d8d0'], [8, 13, '#f0ece4']]) {
      p.rect(x, y, 5, 4, c);
      p.hline(x, x + 4, y + 1, shade(hex(c), 0.85));
      p.hline(x, x + 4, y, '#ffffff');
    }
    p.rect(12, 22, 2, 3, '#e0c060');
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ theatre
  // The curtain: heavy red velvet in folds, a gold fringe; drawn open (the
  // state) it's gathered up to one side, tied with a cord.
  stage_curtain(rot, st) {
    const p = spr(TALL);
    const side = rot === 1 || rot === 3;
    const cols = ['#8a1a24', '#a8262e', '#6a1018', '#c8404a'];
    if (st) {
      // Gathered.
      for (let y = 0; y < 40; y++) {
        const w = y < 22 ? 4 - Math.floor(y / 11) : 2 + Math.floor((y - 22) / 6);
        for (let x = 0; x < w + 1; x++) p.set(x, y, cols[(x + (y >> 2)) % 3]);
      }
      p.hline(0, 5, 20, '#e0b040');
      p.set(5, 21, '#e0b040');
      p.hline(0, 15, 0, '#c89a3a');
      return p.outline(OUT);
    }
    for (let y = 0; y < 40; y++) {
      for (let x = side ? 5 : 0; x < (side ? 11 : 16); x++) {
        const fold = (x % 4);
        p.set(x, y, fold === 0 ? cols[2] : fold === 1 ? cols[1] : fold === 2 ? cols[3] : cols[0]);
      }
    }
    for (let x = side ? 5 : 0; x < (side ? 11 : 16); x++) {
      p.set(x, 0, '#c89a3a');
      p.set(x, 39, '#e0b040');
      if (x % 2) p.set(x, 38, '#e0b040');
    }
    return p.outline(OUT);
  },
  // A footlight: a little lamp in its hood, the reflector behind.
  footlight(rot, st, f) {
    const p = spr();
    p.rect(4, 22, 8, 5, IRON[1]);
    p.hline(4, 11, 22, IRON[2]);
    p.rect(5, 18, 6, 4, BRASS[0]);
    p.hline(5, 10, 18, BRASS[2]);
    if (st) {
      p.rect(6, 19, 4, 3, '#fff0a0');
      flame(p, 8, 20, f);
    } else p.rect(6, 19, 4, 3, '#4a3a2a');
    return p.outline(OUT);
  },
  // Painted scenery on its frame: a tree, a tower, a ship, a cottage.
  stage_flat(rot, st, f, rand, v = 0) {
    const p = spr(TALL);
    if (rot === 1 || rot === 3) {
      p.rect(7, 4, 2, 34, WOOD[1]);
      p.line(8, 38, rot === 1 ? 13 : 3, 26, WOOD[0]);
      return p.outline(OUT);
    }
    FLATS[v % FLATS.length](p);
    if (rot === 2) {
      p.d.fill(0);
      p.rect(1, 4, 14, 34, '#c8b890');
      p.vline(1, 4, 37, WOOD[1]);
      p.vline(14, 4, 37, WOOD[1]);
      p.hline(1, 14, 20, WOOD[1]);
      p.line(8, 38, 8, 26, WOOD[0]);
    }
    return p.outline(OUT);
  },
  // The playbill: a pillar plastered with bills, the masks of comedy and
  // tragedy at its head.
  playbill() {
    const p = spr(TALL);
    p.rect(3, 8, 10, 32, '#a89a84');
    p.vline(3, 8, 39, '#c8bca4');
    p.vline(12, 8, 39, '#8a7e6a');
    p.rect(2, 6, 12, 2, '#6a5e4c');
    p.rect(1, 3, 14, 3, '#2a5a3a');
    p.hline(1, 14, 3, '#3a7a4a');
    // The masks.
    p.ellipse(5, 13, 2, 2.5, '#f0e8d8');
    p.set(4, 12, '#1a1410');
    p.set(6, 12, '#1a1410');
    p.line(4, 15, 6, 14, '#a82a2a');
    p.ellipse(10.5, 13, 2, 2.5, '#e0c860');
    p.set(9, 12, '#1a1410');
    p.set(11, 12, '#1a1410');
    p.line(9, 14, 11, 15, '#1a1410');
    // The bills.
    p.rect(4, 18, 8, 9, '#f0e0b0');
    p.hline(5, 10, 19, '#a82a2a');
    writing(p, 5, 21, 6, 3, '#3a2a1a');
    p.rect(4, 29, 8, 7, '#e8d8f0');
    p.hline(5, 10, 30, '#3a3a8a');
    writing(p, 5, 32, 6, 2, '#3a2a1a');
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ racecourse
  // The starting gate: a stall's frame, its bar down, a number on it.
  start_gate(rot) {
    const p = spr(TALL);
    const side = rot === 1 || rot === 3;
    post(p, side ? 7 : 1, 12, 39, 2, ['#e8e0d0', '#b8b0a0', '#ffffff', '#8a8278']);
    if (!side) post(p, 13, 12, 39, 2, ['#e8e0d0', '#b8b0a0', '#ffffff', '#8a8278']);
    p.hline(side ? 6 : 1, side ? 9 : 14, 12, '#a82a2a');
    p.hline(side ? 6 : 1, side ? 9 : 14, 13, '#e8e0d0');
    if (!side) {
      p.hline(3, 12, 27, '#a82a2a');
      p.hline(3, 12, 28, '#e8e0d0');
      p.rect(6, 15, 4, 4, '#f0ece0');
      p.set(7, 16, '#1a1410');
      p.set(7, 17, '#1a1410');
      p.set(8, 16, '#1a1410');
    }
    return p.outline(OUT);
  },
  // The winning post: white, a red disc on top, the judge's flag.
  finish_post() {
    const p = spr(TALL);
    post(p, 7, 8, 39, 2, ['#e8e0d0', '#b8b0a0', '#ffffff', '#8a8278']);
    for (let y = 12; y < 38; y += 6) p.hline(7, 8, y, '#a82a2a');
    p.ellipse(7.5, 5, 4, 4, '#a82a2a');
    p.ellipse(7.5, 5, 2, 2, '#f0ece0');
    p.vline(10, 8, 22, WOOD[2]);
    p.rect(11, 8, 4, 3, '#f0ece0');
    p.set(11, 8, '#1a1410');
    p.set(13, 8, '#1a1410');
    p.set(12, 9, '#1a1410');
    p.set(14, 9, '#1a1410');
    p.set(11, 10, '#1a1410');
    p.set(13, 10, '#1a1410');
    return p.outline(OUT);
  },
  // The bookmaker's board: each runner's silks, a name, the price.
  odds_board() {
    return postedBoard(8, 30, (p, x, y, w, h) => {
      p.rect(x, y, w, h, '#f0ece0');
      const silks = [['#a82a2a', '#f0e0a0'], ['#2a5aa8', '#ffffff'], ['#2a8a4a', '#f0c040'], ['#6a2a8a', '#f0e0f0'], ['#e0a020', '#2a2a2a']];
      silks.forEach(([a, b], i) => {
        const yy = y + 1 + i * 4;
        p.rect(x + 1, yy, 2, 3, a);
        p.set(x + 2, yy + 1, b);
        p.hline(x + 4, x + 6, yy + 1, '#3a3a3a');
        p.set(x + 8, yy, '#a82a2a');
        p.set(x + 8, yy + 2, '#a82a2a');
      });
    }, ['#2a5a3a', '#1e4a2e', '#3a7a4a', '#123020']);
  },
  // An obelisk down the course's spine, glyphs cut in it.
  spina_obelisk() {
    const p = spr(TALL);
    p.rect(2, 34, 12, 6, STONE[1]);
    p.hline(2, 13, 34, STONE[2]);
    for (let y = 3; y < 34; y++) {
      const w = 2 + Math.floor((y - 3) / 10);
      for (let x = 8 - w; x < 8 + w; x++) p.set(x, y, x < 8 - w + 1 ? STONE[2] : x > 8 + w - 2 ? STONE[1] : STONE[0]);
    }
    p.set(7, 1, BRASS[2]);
    p.rect(7, 2, 2, 1, BRASS[0]);
    for (let y = 8; y < 32; y += 3) p.set(7 + (y % 2), y, STONE[3]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ fair
  // The high striker: the tall board with its scale, the bell at the top,
  // the puck, the pad at the foot and the mallet leant on it.
  high_striker(rot, st, f) {
    const p = spr(TALL);
    p.rect(6, 4, 4, 32, '#e8e0d0');
    p.vline(6, 4, 35, '#ffffff');
    for (let y = 6; y < 34; y += 3) p.hline(7, 9, y, y < 12 ? '#a82a2a' : y < 22 ? '#e0a020' : '#3a8a4a');
    p.ellipse(7.5, 3, 2.5, 2, BRASS[0]);
    p.set(6, 2, BRASS[2]);
    p.rect(7, 30 - (f % 2) * 3, 2, 2, '#2a2a3a');
    p.rect(3, 36, 10, 3, '#a82a2a');
    p.hline(3, 12, 36, '#d04040');
    p.line(12, 37, 14, 26, WOOD[2]);
    p.rect(13, 24, 3, 3, WOOD[1]);
    return p.outline(OUT);
  },
  // The fortune-teller's tent: purple and gold, stars on it, the flap
  // open on the glow of the crystal ball inside.
  fortune_tent(rot) {
    const p = spr(TALL);
    for (let y = 8; y < 39; y++) {
      const w = Math.min(7, Math.floor((y - 6) / 3.2) + 1);
      for (let x = 8 - w; x < 8 + w; x++) p.set(x, y, Math.floor((x - 8 + w) / 2) % 2 ? '#5a2a7a' : '#3a1a5a');
    }
    p.vline(8, 2, 8, WOOD[2]);
    p.set(8, 1, '#e0c040');
    p.set(9, 2, '#e0c040');
    p.rect(9, 3, 3, 2, '#a82a2a');
    for (const [x, y] of [[4, 22], [11, 18], [6, 15], [12, 30]]) p.set(x, y, '#f0d050');
    if (rot !== 2) {
      p.rect(5, 26, 6, 13, '#1a0e24');
      p.ellipse(8, 33, 2, 2, '#a8c8f0');
      p.set(7, 32, '#ffffff');
      p.rect(7, 35, 2, 1, BRASS[0]);
      p.line(4, 26, 2, 38, '#e0b040');
      p.line(11, 26, 13, 38, '#e0b040');
    }
    return p.outline(OUT);
  },
  // Hoop-la: a striped awning over pegs and bottles, the hoops hung up.
  ring_toss(rot) {
    const p = spr(TALL);
    post(p, 0, 8, 39, 2);
    post(p, 14, 8, 39, 2);
    for (let x = 0; x < 16; x++) for (let y = 6; y < 11; y++) p.set(x, y, Math.floor(x / 2) % 2 ? '#f0ece0' : '#2a7ab8');
    for (let x = 0; x < 16; x += 2) p.set(x, 11, '#2a7ab8');
    p.rect(2, 30, 12, 3, WOOD[0]);
    p.hline(2, 13, 30, WOOD[2]);
    p.rect(2, 33, 12, 6, '#a82a2a');
    for (let x = 3; x < 13; x += 3) {
      p.vline(x, 25, 29, '#3a7a3a');
      p.set(x, 24, '#5aaa5a');
    }
    for (let x = 4; x < 13; x += 3) p.vline(x, 27, 29, '#8a5a2a');
    for (const [x, c] of [[4, '#e0b040'], [8, '#d04040'], [12, '#3a8ad8']]) {
      p.ellipse(x, 15, 1.5, 1.5, c);
      p.clear(x, 15);
    }
    return p.outline(OUT);
  },
  // Prizes on a shelf: a stuffed bear, a ribbon, a jar of sweets, a doll.
  prize_shelf() {
    const p = spr();
    p.rect(0, 25, 16, 2, WOOD[1]);
    p.rect(0, 17, 16, 1, WOOD[2]);
    p.ellipse(3, 22, 2, 2.5, '#a8784a');
    p.ellipse(3, 19, 1.5, 1.5, '#a8784a');
    p.set(2, 18, '#a8784a');
    p.set(4, 18, '#a8784a');
    p.set(3, 19, '#1a1410');
    p.rect(8, 20, 3, 5, '#d8f0f8');
    for (const [x, y, c] of [[8, 22, '#d04040'], [9, 21, '#e0b040'], [10, 23, '#3a8ad8']]) p.set(x, y, c);
    p.ellipse(13, 14, 1.5, 1.5, '#e0b040');
    p.vline(13, 15, 16, '#a82a2a');
    p.vline(12, 15, 16, '#a82a2a');
    p.ellipse(6, 14, 1.5, 2, '#f0c8c0');
    p.rect(5, 15, 3, 2, '#7a3aa0');
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ ruins
  // The dig: a trench, its sides staked and strung, a half-dug urn, the
  // spade and the brush.
  dig_site() {
    const p = spr();
    p.rect(1, 19, 14, 8, '#5a4430');
    p.rect(2, 20, 12, 6, '#3a2a1c');
    p.hline(1, 14, 19, '#7a5e40');
    for (const x of [1, 14]) p.vline(x, 15, 20, WOOD[2]);
    p.hline(1, 14, 16, '#e8e0d0');
    p.vline(7, 16, 19, '#e8e0d0');
    p.ellipse(6, 23, 2.5, 2, '#a8603a');
    p.hline(4, 8, 22, '#7a3a20');
    p.line(11, 26, 13, 19, WOOD[2]);
    p.rect(12, 17, 3, 2, IRON[2]);
    p.rect(3, 25, 2, 1, '#e0c890');
    return p.outline(OUT);
  },
  // A stele with the old writing cut in it, worn and lichened.
  glyph_stone() {
    const p = spr(TALL);
    p.rect(3, 6, 10, 34, '#8a8478');
    p.vline(3, 6, 39, '#a8a296');
    p.vline(12, 6, 39, '#6a6458');
    p.ellipse(7.5, 6, 5, 3, '#8a8478');
    p.ellipse(7, 5, 3, 1.5, '#a8a296');
    for (let r = 0; r < 8; r++) {
      const y = 10 + r * 3;
      for (let x = 5; x < 11; x++) if ((x * 13 + r * 7) % 5 < 3) p.set(x, y, '#4a4438');
    }
    for (const [x, y] of [[4, 30], [5, 31], [11, 14], [10, 15], [4, 22]]) p.set(x, y, '#7a9a5a');
    return p.outline(OUT);
  },
  // The finds table: shards, a skull, coins gone green, a magnifier.
  finds_table() {
    const p = spr();
    p.rect(0, 16, 16, 3, WOOD[0]);
    p.hline(0, 15, 16, WOOD[2]);
    p.line(2, 19, 1, 26, WOOD[1]);
    p.line(13, 19, 14, 26, WOOD[1]);
    p.rect(1, 14, 3, 2, '#a8603a');
    p.rect(2, 13, 2, 1, '#8a4a2a');
    p.ellipse(7, 13, 2, 2, '#e8e0c8');
    p.set(6, 13, '#2a2420');
    p.set(8, 13, '#2a2420');
    p.set(10, 15, '#5a9a6a');
    p.set(11, 15, '#c8a040');
    p.ellipse(13.5, 13, 1.5, 1.5, BRASS[0]);
    p.set(13, 13, '#c8e0f0');
    p.line(12, 15, 11, 16, WOOD[1]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ winery
  vine_row(rot, st, f, rand, v = 0) {
    const p = spr(TALL);
    VINES(p, v);
    return p.outline(OUT);
  },
  // A basket press: its staves bound round the grapes, the great screw and
  // its beam, the juice running into the tub.
  wine_press() {
    const p = spr();
    p.rect(3, 15, 10, 9, WOOD[0]);
    for (let x = 3; x < 13; x += 2) p.vline(x, 15, 23, WOOD[2]);
    p.hline(3, 12, 17, IRON[1]);
    p.hline(3, 12, 22, IRON[1]);
    p.vline(7, 6, 15, IRON[2]);
    p.vline(8, 6, 15, IRON[1]);
    p.hline(1, 14, 8, WOOD[1]);
    p.hline(1, 14, 9, WOOD[3]);
    p.rect(1, 24, 14, 3, '#6a2a4a');
    p.hline(2, 13, 24, '#8a3a6a');
    p.set(13, 23, '#7a2a5a');
    return p.outline(OUT);
  },
  // The great vat: a barrel taller than a man, hooped, a ladder up it, the
  // spigot.
  wine_vat() {
    const p = spr(TALL);
    for (let y = 6; y < 40; y++) {
      const bulge = Math.round(Math.sin(((y - 6) / 34) * Math.PI) * 1.5);
      for (let x = 1 - bulge; x < 15 + bulge; x++) p.set(x, y, x % 3 === 0 ? WOOD[1] : x < 4 ? WOOD[2] : WOOD[0]);
    }
    for (const y of [8, 18, 28, 37]) {
      const bulge = Math.round(Math.sin(((y - 6) / 34) * Math.PI) * 1.5);
      p.hline(1 - bulge, 14 + bulge, y, IRON[1]);
    }
    p.ellipse(7.5, 6, 7, 2, WOOD[3]);
    for (let y = 8; y < 40; y += 3) p.hline(11, 14, y, WOOD[2]);
    p.vline(11, 6, 39, WOOD[1]);
    p.vline(14, 6, 39, WOOD[1]);
    p.rect(5, 33, 2, 2, BRASS[0]);
    return p.outline(OUT);
  },
  // A cask on its cradle, its end chalked with the year, a tap in it.
  wine_cask(rot) {
    const p = spr();
    if (rot === 1 || rot === 3) {
      p.ellipse(7.5, 18, 6, 6, WOOD[0]);
      p.ellipse(7.5, 18, 5, 5, WOOD[2]);
      for (let a = 0; a < 6; a++) p.line(7, 18, 7 + Math.round(Math.cos(a) * 5), 18 + Math.round(Math.sin(a) * 5), WOOD[1]);
      p.hline(4, 10, 17, '#f0ece0');
      p.rect(7, 19, 2, 2, BRASS[0]);
      p.rect(2, 24, 12, 3, WOOD[1]);
      return p.outline(OUT);
    }
    for (let y = 12; y < 24; y++) {
      const bulge = Math.round(Math.sin(((y - 12) / 12) * Math.PI) * 1);
      p.hline(1 - bulge, 14 + bulge, y, (y % 3 === 0) ? WOOD[1] : WOOD[0]);
    }
    p.vline(4, 12, 23, IRON[1]);
    p.vline(11, 12, 23, IRON[1]);
    p.hline(1, 14, 12, WOOD[2]);
    p.rect(2, 24, 3, 3, WOOD[1]);
    p.rect(11, 24, 3, 3, WOOD[1]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ shipyard
  // A crane of timbers: its mast, the jib out over the slip, block and
  // tackle, the hook.
  yard_crane(rot) {
    const p = spr(TALL);
    post(p, 2, 4, 39, 3);
    p.line(4, 4, 15, 8, WOOD[0]);
    p.line(4, 5, 15, 9, WOOD[1]);
    p.line(4, 18, 12, 9, WOOD[1]);
    p.rect(0, 36, 8, 4, WOOD[1]);
    p.vline(14, 9, 26, ROPE);
    p.rect(13, 26, 3, 2, IRON[1]);
    p.set(14, 28, IRON[2]);
    p.set(15, 29, IRON[2]);
    p.ellipse(4, 30, 3, 3, WOOD[0]);
    p.ellipse(4, 30, 2, 2, WOOD[3]);
    if (rot === 3) {
      const q = p.copy();
      p.d.fill(0);
      p.blit(q, 0, 0, true);
    }
    return p.outline(OUT);
  },
  // A coil of hawser on its spool.
  rope_coil() {
    const p = spr();
    for (let k = 0; k < 4; k++) p.ellipse(7.5, 24 - k * 2, 6 - (k % 2), 2.5, k % 2 ? '#a89060' : ROPE);
    p.ellipse(7.5, 17, 3, 1, '#5a4a30');
    p.line(12, 23, 15, 26, ROPE);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ gardens
  topiary(rot, st, f, rand, v = 0) {
    const p = spr(TALL);
    p.rect(4, 33, 8, 7, '#a8603a');
    p.hline(3, 12, 33, '#c8784a');
    p.hline(4, 11, 36, '#8a4a2a');
    const q = spr(TALL);
    TOPIARY[v % TOPIARY.length](q);
    p.blit(q, 0, 0);
    return p.outline(OUT);
  },
  // An aviary: a dome of wire on a stone foot, birds within (two frames).
  aviary(rot, st, f) {
    const p = spr(TALL);
    p.rect(1, 34, 14, 6, STONE[0]);
    p.hline(1, 14, 34, STONE[2]);
    for (let y = 6; y < 34; y++) {
      const w = y < 14 ? Math.round(Math.sqrt(Math.max(0, 64 - (14 - y) ** 2))) : 7;
      for (let x = 8 - w; x < 8 + w; x++) {
        const edge = x === 8 - w || x === 7 + w;
        if (edge || (x - 8 + w) % 3 === 0 || y % 4 === 0) p.set(x, y, edge ? BRASS[1] : '#a8a8b0');
      }
    }
    p.vline(7, 2, 6, BRASS[0]);
    p.set(7, 1, BRASS[2]);
    const birds = [[4, 18, '#f0d030'], [10, 24, '#3a7ad8'], [7, 14, '#d03a2a'], [11, 29, '#f0f0f0']];
    birds.forEach(([x, y, c], i) => {
      const dy = (f + i) % 2;
      p.set(x, y - dy, c);
      p.set(x + 1, y - dy, c);
      p.set(x + (dy ? -1 : 2), y - 1 - dy, shade(hex(c), 0.8));
    });
    p.hline(2, 13, 30, WOOD[1]);
    return p.outline(OUT);
  },
  // A stone urn spilling flowers.
  garden_urn() {
    const p = spr();
    p.rect(5, 24, 6, 3, STONE[1]);
    p.rect(6, 21, 4, 3, STONE[0]);
    p.ellipse(7.5, 17, 5, 4, STONE[0]);
    p.vline(3, 15, 19, STONE[2]);
    p.hline(2, 13, 14, STONE[2]);
    for (let k = 0; k < 14; k++) {
      const x = 2 + ((k * 5) % 12);
      const y = 9 + ((k * 3) % 6);
      p.set(x, y, k % 3 === 0 ? '#e85a8a' : k % 3 === 1 ? '#f0d050' : '#3a8a3a');
    }
    p.set(1, 15, '#3a8a3a');
    p.set(14, 16, '#e85a8a');
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ monastery
  // A rush mat, a cushion, a bowl and its striker.
  meditation_mat() {
    const p = spr();
    p.rect(1, 21, 14, 6, '#c8b070');
    for (let x = 1; x < 15; x += 2) p.vline(x, 21, 26, '#a89050');
    p.hline(1, 14, 21, '#e0cc90');
    p.ellipse(7.5, 21, 3, 1.5, '#8a2a2a');
    p.ellipse(7.5, 20, 2, 1, '#a83a3a');
    p.ellipse(12.5, 24, 1.5, 1, BRASS[0]);
    p.set(12, 23, BRASS[2]);
    return p.outline(OUT);
  },
  // The wooden man: a post with three arms and a leg, for the forms.
  wooden_dummy(rot) {
    const p = spr(TALL);
    p.rect(6, 6, 4, 26, WOOD[0]);
    p.vline(6, 6, 31, WOOD[2]);
    p.ellipse(7.5, 6, 2, 1, WOOD[2]);
    const flip = rot === 3;
    const arm = (x0, y0, x1, y1) => p.line(flip ? 15 - x0 : x0, y0, flip ? 15 - x1 : x1, y1, WOOD[1]);
    arm(9, 12, 13, 10);
    arm(6, 12, 2, 10);
    arm(9, 17, 13, 18);
    arm(9, 24, 12, 29);
    p.rect(3, 32, 10, 2, WOOD[1]);
    p.vline(3, 32, 39, WOOD[1]);
    p.vline(12, 32, 39, WOOD[1]);
    return p.outline(OUT);
  },
  // A low tea table: the pot, two bowls, steam rising.
  tea_table(rot, st, f) {
    const p = spr();
    p.rect(1, 21, 14, 2, DARK[0]);
    p.hline(1, 14, 21, '#8a2a2a');
    p.rect(2, 23, 2, 4, DARK[1]);
    p.rect(12, 23, 2, 4, DARK[1]);
    p.ellipse(6.5, 18, 2.5, 2, '#3a6a5a');
    p.set(9, 17, '#3a6a5a');
    p.set(5, 15, '#2a4a40');
    p.ellipse(11, 20, 1.5, 0.8, '#e8e0d0');
    p.ellipse(3, 20, 1.5, 0.8, '#e8e0d0');
    for (let k = 0; k < 3; k++) p.set(6 + ((k + f) % 2), 13 - k, '#e8e8f0');
    return p.outline(OUT);
  },
  // A burner of incense, the smoke curling up (four frames).
  incense(rot, st, f) {
    const p = spr();
    p.ellipse(7.5, 24, 3, 2, BRASS[0]);
    p.rect(5, 25, 6, 2, BRASS[1]);
    p.set(6, 22, BRASS[2]);
    for (let k = 0; k < 9; k++) {
      const x = 7.5 + Math.sin((k + f * 2) * 0.7) * (1 + k * 0.25);
      p.set(x, 21 - k * 1.4, k < 4 ? '#d8d0e0' : '#b8b0c8', 220 - k * 18);
    }
    return p;
  },
  // ------------------------------------------------------------ apiary
  // A straw skep on its stand, the bees about it (two frames).
  bee_skep(rot, st, f) {
    const p = spr();
    p.rect(3, 23, 10, 2, WOOD[1]);
    p.rect(4, 25, 2, 2, WOOD[1]);
    p.rect(10, 25, 2, 2, WOOD[1]);
    for (let y = 10; y < 23; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, 1 - ((22 - y) / 13) ** 2)) * 6);
      for (let x = 8 - w; x < 8 + w; x++) p.set(x, y, (y % 2) ? '#c8a050' : '#a88038');
    }
    p.rect(6, 20, 4, 3, '#2a1a0a');
    for (const [x, y] of [[2, 12], [13, 15], [11, 8], [4, 18], [14, 21]]) {
      const dx = (f + x) % 2;
      p.set(x + dx, y - dx, '#f0d030');
      p.set(x + dx + 1, y - dx, '#1a1410');
    }
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ circle
  // A carved stone: runes down it in a band, a ring cut at its head.
  rune_stone() {
    const p = spr(TALL);
    for (let y = 5; y < 40; y++) {
      const w = y < 9 ? 3 + (y - 5) : 7;
      for (let x = 8 - w; x < 8 + w - 1; x++) p.set(x, y, x < 8 - w + 2 ? '#8a8a84' : x > 8 + w - 4 ? '#5a5a54' : '#72726c');
    }
    p.ellipse(7, 10, 2, 2, '#3a3a36');
    p.ellipse(7, 10, 1, 1, '#72726c');
    for (let y = 15; y < 37; y += 3) {
      p.set(5, y, '#2a2a28');
      p.set(6, y + 1, '#2a2a28');
      p.set(8, y, '#2a2a28');
      p.set(9, y + 1, '#2a2a28');
    }
    for (const [x, y] of [[2, 30], [3, 31], [11, 20]]) p.set(x, y, '#7a9a5a');
    return p.outline(OUT);
  },
  // The altar stone: a slab on two uprights, offerings on it.
  altar_stone() {
    const p = spr();
    p.rect(2, 19, 3, 8, '#72726c');
    p.rect(11, 19, 3, 8, '#5a5a54');
    p.rect(0, 15, 16, 4, '#8a8a84');
    p.hline(0, 15, 15, '#a8a8a0');
    p.ellipse(5, 14, 2, 1, '#8a5a3a');
    p.set(5, 13, '#c83a32');
    p.set(10, 13, '#f0d050');
    p.set(11, 14, '#3a8a3a');
    p.set(12, 13, '#e85a8a');
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ quarry
  // Dressed blocks, stacked, the mason's marks on them.
  stone_blocks() {
    const p = spr();
    const block = (x, y, w, h) => {
      p.rect(x, y, w, h, STONE[0]);
      p.hline(x, x + w - 1, y, STONE[2]);
      p.vline(x + w - 1, y, y + h - 1, STONE[1]);
      p.set(x + 2, y + 2, STONE[3]);
      p.set(x + 3, y + 3, STONE[3]);
    };
    block(0, 20, 8, 7);
    block(8, 20, 8, 7);
    block(3, 13, 9, 7);
    return p.outline(OUT);
  },
  // The mason's bench: a capital half-carved on it, mallet and chisels.
  mason_bench() {
    const p = spr();
    p.rect(0, 20, 16, 3, WOOD[0]);
    p.hline(0, 15, 20, WOOD[2]);
    p.rect(1, 23, 2, 4, WOOD[1]);
    p.rect(13, 23, 2, 4, WOOD[1]);
    p.rect(3, 13, 8, 7, MARBLE[0]);
    p.hline(2, 11, 13, MARBLE[2]);
    for (let x = 3; x < 11; x += 2) p.set(x, 14, MARBLE[3]);
    p.ellipse(4, 15, 1, 1, MARBLE[3]);
    p.ellipse(10, 15, 1, 1, MARBLE[3]);
    p.rect(12, 17, 3, 2, WOOD[1]);
    p.line(13, 19, 14, 20, WOOD[2]);
    p.line(1, 19, 3, 17, IRON[2]);
    return p.outline(OUT);
  },
  // A statue coming out of its block: the head and shoulders done, the
  // rest still stone, chips at its foot.
  rough_statue() {
    const p = spr(TALL);
    p.rect(2, 20, 12, 20, STONE[0]);
    p.hline(2, 13, 20, STONE[2]);
    for (let k = 0; k < 10; k++) p.set(3 + ((k * 7) % 10), 22 + ((k * 5) % 16), STONE[1]);
    p.rect(4, 14, 8, 6, MARBLE[0]);
    p.vline(4, 14, 19, MARBLE[2]);
    p.rect(6, 7, 4, 7, MARBLE[0]);
    p.set(7, 9, MARBLE[3]);
    p.set(8, 9, MARBLE[3]);
    p.hline(6, 9, 7, MARBLE[2]);
    for (const x of [0, 1, 14, 15]) p.set(x, 39, MARBLE[1]);
    return p.outline(OUT);
  },
  // ------------------------------------------------------------ delve
  // The way down: a ring of dressed stone round the shaft's dark, the
  // windlass over it on its posts, the rope and the bucket, a lantern.
  delve_mouth() {
    const p = spr(TALL);
    const cy = 30;
    for (let y = cy; y <= 38; y++) for (let x = 0; x < 16; x++) {
      const joint = (y - cy) % 3 === 2 || (x + ((Math.floor((y - cy) / 3) % 2) * 2)) % 4 === 0;
      p.set(x, y, joint ? STONE[3] : x < 3 ? STONE[2] : STONE[0]);
    }
    p.ellipse(7.5, cy, 7.5, 3.6, STONE[2]);
    p.ellipse(7.5, cy, 6, 2.5, '#0a0608');
    p.hline(3, 12, cy - 2, STONE[1]);
    // A ladder going down into it.
    p.vline(5, cy - 1, cy + 1, WOOD[2]);
    p.vline(8, cy - 1, cy + 1, WOOD[2]);
    p.hline(5, 8, cy, WOOD[0]);
    // The windlass.
    post(p, 0, 8, cy, 2);
    post(p, 14, 8, cy, 2);
    p.rect(0, 9, 16, 3, WOOD[1]);
    p.hline(0, 15, 9, WOOD[2]);
    p.ellipse(7.5, 10, 2, 2, ROPE);
    p.vline(10, 12, cy - 3, ROPE);
    p.rect(9, cy - 4, 3, 2, WOOD[0]);
    p.rect(14, 5, 2, 3, BRASS[0]);
    p.set(14, 6, '#ffe070');
    return p.outline(OUT);
  },
  // The contracts board: what's wanted from below, the tokens pinned to
  // each (a fang, a claw, a skull).
  delve_board() {
    return postedBoard(10, 30, (p, x, y, w, h) => {
      notice(p, x, y, 5, 8, '#6a2a2a');
      notice(p, x + 5, y + 1, 5, 7);
      notice(p, x + 1, y + 10, 8, 8);
      p.set(x + 2, y + 9, '#e8e0c8');
      p.set(x + 7, y + 9, '#e8e0c8');
      p.ellipse(x + 8, y + 15, 1, 1, '#e8e0c8');
      p.set(x + 3, y + 18, '#c8a040');
    }, DARK);
  },
  // The memorial to those who went down and didn't come up: their names
  // on a slab, candles and flowers at its foot.
  delve_memorial(rot, st, f) {
    const p = spr(TALL);
    p.rect(2, 8, 12, 28, '#6a6a70');
    p.vline(2, 8, 35, '#8a8a90');
    p.vline(13, 8, 35, '#4a4a50');
    for (let k = 0; k < 5; k++) p.hline(3 + k, 12 - k, 7 - k, '#6a6a70');
    p.rect(3, 36, 10, 4, '#5a5a60');
    for (let r = 0; r < 9; r++) for (let x = 4; x < 12; x++) if ((x * 5 + r * 3) % 7 < 5) p.set(x, 11 + r * 3, '#c8c8d0');
    candle(p, 3, 38, 3, true, f);
    candle(p, 12, 38, 2, true, f + 1);
    p.set(6, 38, '#e85a8a');
    p.set(7, 37, '#f0f0f0');
    p.set(9, 38, '#e8d050');
    return p.outline(OUT);
  },
};

export const CITY_ANIM = { globe: 4, blast_furnace: 3, water_wheel: 4, incense: 4, bee_skep: 2, aviary: 2, birdcages: 2, high_striker: 2, reading_lectern: 3, tea_table: 2, candle_rack: 3, relic_shrine: 3, footlight: 3, delve_memorial: 3 };
// (Each painted in one of four ways, chosen by where it stands.)
export const CITY_VARIANTS = new Set(['beast_cage', 'stage_flat', 'vine_row', 'topiary']);
export const CITY_ROT_FRONT = new Set(['scroll_shelf']);

// ---------------------------------------------------------------- icons
// The goods these places are known for (see world/items.js).
export function cityIcon(key) {
  const p = new Px(16, 16);
  switch (key) {
    case 'wine':
      // A bottle, dark green, its cork and label.
      p.rect(6, 6, 4, 9, '#2a5a2a');
      p.vline(6, 6, 14, '#4a8a4a');
      p.rect(7, 2, 2, 4, '#2a5a2a');
      p.rect(7, 1, 2, 1, '#a87a4a');
      p.rect(6, 9, 4, 3, '#e8dcb8');
      p.set(7, 10, '#a82a2a');
      break;
    case 'mead':
      // A drinking horn, its rim bound in silver, the mead gold in it.
      p.line(3, 4, 12, 13, '#e8d8b0');
      p.line(4, 3, 13, 12, '#c8b890');
      p.line(3, 5, 11, 13, '#d8c8a0');
      p.rect(2, 3, 4, 2, '#c8c8d0');
      p.set(3, 3, '#e0b040');
      p.set(4, 3, '#f0c850');
      p.set(13, 13, '#8a7a5a');
      break;
    case 'holy_water':
      // A little flask of glass, the water in it glowing faintly, a seal.
      p.ellipse(7.5, 10, 4, 4, '#a8d8f0');
      p.ellipse(7.5, 11, 3, 2.5, '#5ab0d8');
      p.set(6, 9, '#ffffff');
      p.rect(7, 3, 2, 3, '#a8d8f0');
      p.rect(6, 2, 4, 1, '#c8a040');
      p.set(7, 1, '#e0c050');
      break;
    case 'beeswax_candle':
      p.rect(6, 5, 4, 10, '#e8c860');
      p.vline(6, 5, 14, '#f8e090');
      p.hline(6, 9, 14, '#c8a040');
      p.set(7, 4, '#3a3030');
      p.set(7, 3, '#ffc040');
      p.set(7, 2, '#fff2a0');
      break;
    case 'laurel_wreath':
      // A wreath of laurel, gold-tipped, tied with red.
      for (let a = 0; a < 18; a++) {
        const t = (a / 18) * Math.PI * 2;
        if (t > 1.2 && t < 1.95) continue;
        const x = 7.5 + Math.cos(t) * 5;
        const y = 7.5 + Math.sin(t) * 5;
        p.set(x, y, a % 2 ? '#3a8a3a' : '#5aaa4a');
        p.set(x + Math.cos(t + 1), y + Math.sin(t + 1), a % 3 ? '#2a6a2a' : '#e0c040');
      }
      p.rect(7, 12, 2, 2, '#c03030');
      p.set(6, 14, '#c03030');
      p.set(9, 14, '#c03030');
      break;
    case 'star_chart':
      // A chart of the night sky, rolled at its ends.
      p.rect(2, 4, 12, 9, '#1a2448');
      p.vline(2, 4, 12, '#c8b890');
      p.vline(13, 4, 12, '#c8b890');
      for (const [x, y] of [[4, 6], [7, 5], [10, 7], [5, 10], [11, 11], [8, 9]]) p.set(x, y, '#f0e8a0');
      p.line(4, 6, 7, 5, '#5a6aa8');
      p.line(7, 5, 10, 7, '#5a6aa8');
      p.line(8, 9, 11, 11, '#5a6aa8');
      break;
    case 'marble_bust':
      p.rect(4, 12, 8, 3, '#c2beb4');
      p.rect(5, 9, 6, 3, '#e2ded4');
      p.ellipse(7.5, 6, 2.5, 3, '#e2ded4');
      p.set(6, 6, '#9e9a90');
      p.set(9, 6, '#9e9a90');
      p.hline(5, 10, 3, '#c2beb4');
      p.vline(5, 9, 11, '#f8f6f0');
      break;
    case 'spices':
      p.ellipse(7.5, 10, 5, 4, '#c8b088');
      p.ellipse(7.5, 7, 4, 2, '#e0a020');
      p.set(6, 6, '#f0c040');
      p.set(9, 7, '#c03a1a');
      p.hline(4, 11, 9, '#a89068');
      break;
    case 'silk':
      // A bolt of silk, its sheen.
      p.rect(3, 4, 10, 8, '#c0203a');
      p.hline(3, 12, 6, '#e8506a');
      p.hline(3, 12, 9, '#8a1028');
      p.ellipse(3, 8, 1.5, 4, '#e0c040');
      p.line(12, 12, 14, 14, '#c0203a');
      break;
    default:
      return null;
  }
  return p.outline(OUT);
}
