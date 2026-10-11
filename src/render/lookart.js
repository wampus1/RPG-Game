// (Round 84) Each people's own look for what they put up about town: their
// signs and hanging signs, notice boards, posters, lanterns, banners, the
// arch a wedding's held under, the awnings over their doors (and, in
// steeds.js, their wagons). Eight looks, one for each sort of people (see
// LOOK_OF): drawn here, picked by where a thing stands (see
// Renderer.lookAt); the Valeborn's (look 0) is the old one, drawn in
// textures.js.
import { hex, shade, mix } from './pixel.js';
import { spr, OUT, TALL_H, frontify, DECOR_PALETTES } from './textures.js';
import { CANOPY_STYLES } from '../world/blocks.js';
import { LH } from '../config.js';

// Which look each people's things are in (a canopy's style, and the
// highlanders with the north).
export const LOOK_OF = { ...CANOPY_STYLES, high: 5 };
export const LOOKS = 8;
// What's drawn in a people's own look.
export const LOOKED = new Set(['sign', 'hanging_sign', 'notice_board', 'poster', 'lantern', 'festival_banner', 'flower_arch', 'awning_red', 'awning_blue', 'awning_yellow', 'awning_green']);

// Each look's colours: `board` (light, dark, highlight), `trim`, `post`,
// `paper`, `head` (a poster's band, a note's pin), `metal`, `glass` (lit,
// and its heart), `cloth`, `accent`.
export const LOOK_PAL = [
  { key: 'vale', board: ['#a87a48', '#7a5430', '#c8985c'], trim: '#5a3c22', post: ['#5a3e26', '#3e2a18', '#74522e'], paper: '#f2ead6', head: ['#c83a32', '#e86a5a'], metal: '#3a3a44', glass: ['#ffd860', '#fff8e0'], cloth: '#c8bc9c', accent: '#3c8a3c', wood: '#7a5430' },
  { key: 'mist', board: ['#5e5c3e', '#44422c', '#76744e'], trim: '#2e3222', post: ['#3e3a28', '#2a2818', '#524c34'], paper: '#d6dcc0', head: ['#6a8a3a', '#8aaa52'], metal: '#3e4a44', glass: ['#9adf70', '#d8ffb0'], cloth: '#8a9a6a', accent: '#8ab84a', wood: '#4a4632' },
  { key: 'tide', board: ['#c4b89c', '#a49880', '#dcd2bc'], trim: '#e8dcc0', post: ['#9a907a', '#7a7262', '#b4ac96'], paper: '#d8e2ea', head: ['#3a7ab0', '#5a9ad0'], metal: '#5a7a8a', glass: ['#70d8c8', '#c8fff4'], cloth: '#dcdccc', accent: '#e8a8a0', wood: '#a89c84' },
  { key: 'jade', board: ['#a82a24', '#7e1e1a', '#c84a3a'], trim: '#e8c050', post: ['#7a1e1a', '#561410', '#9a2a24'], paper: '#f2dcb4', head: ['#c83a32', '#e86a4a'], metal: '#2a2426', glass: ['#ff8a50', '#ffd8a0'], cloth: '#c83a32', accent: '#3c9a68', wood: '#8a2a22' },
  { key: 'sun', board: ['#dcbc7c', '#c09a5a', '#eed49a'], trim: '#2a8a8a', post: ['#b89058', '#967040', '#d0aa70'], paper: '#f2e2b2', head: ['#c86a3a', '#e88a5a'], metal: '#b88a40', glass: ['#ffd070', '#fff4c0'], cloth: '#ecd6a4', accent: '#2a9a9a', wood: '#9a6a3a' },
  { key: 'north', board: ['#5a4630', '#403222', '#705a3e'], trim: '#8a8a96', post: ['#3e3020', '#2a2016', '#524028'], paper: '#ebe6dc', head: ['#3a5a9a', '#5a7aba'], metal: '#55555e', glass: ['#f0f0d0', '#ffffff'], cloth: '#9a7a5a', accent: '#c8d8f0', wood: '#4a3a2a' },
  { key: 'velmarch', board: ['#ece4d4', '#c8c0b0', '#faf6ee'], trim: '#6a3a8a', post: ['#d8d0c0', '#b0a898', '#ece6da'], paper: '#f6eedc', head: ['#6a3a8a', '#8a5aaa'], metal: '#c8a040', glass: ['#fff0c0', '#ffffff'], cloth: '#f0ece0', accent: '#5a8a3a', wood: '#8a6a4a' },
  { key: 'ember', board: ['#3e383c', '#2a2428', '#544c52'], trim: '#c88a30', post: ['#302a2e', '#1e1a1c', '#443e42'], paper: '#dcbca4', head: ['#b84a2a', '#d86a3a'], metal: '#c88a30', glass: ['#ff7a20', '#ffc070'], cloth: '#5a3a30', accent: '#ff6a20', wood: '#3a3034' },
];

const lum = (c) => {
  const v = hex(c);
  return (0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2]) / 255;
};
const inkOn = (c) => (lum(c) > 0.5 ? '#3a2a1a' : '#ead8b0');

// A board with its people's finish round it: `x0, y0, w, h` its edges.
function board(p, L, x0, y0, w, h, writing = true) {
  const k = L.key;
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;
  p.rect(x0, y0, w, h, L.board[0]);
  p.hline(x0, x1, y0, L.board[2]);
  p.hline(x0, x1, y1, L.board[1]);
  if (k === 'mist') {
    // Rough bog-plank, moss along its top.
    for (let x = x0; x <= x1; x++) if (x % 3 !== 1) p.set(x, y0, L.accent);
    p.set(x0 + 2, y0 + 1, L.accent);
    p.clear(x1, y1);
  } else if (k === 'tide') {
    // Driftwood, worn round at the corners, a shell nailed to it.
    p.clear(x0, y0);
    p.clear(x1, y1);
    p.set(x1 - 1, y0 + 1, L.accent);
    p.set(x1 - 2, y0 + 1, shade(hex(L.accent), 0.85));
  } else if (k === 'jade') {
    // Red lacquer in a gold frame.
    p.hline(x0, x1, y0, L.trim);
    p.hline(x0, x1, y1, L.trim);
    p.vline(x0, y0, y1, L.trim);
    p.vline(x1, y0, y1, L.trim);
  } else if (k === 'sun') {
    // A sandstone tablet, its top rounded, a band of turquoise across it.
    p.clear(x0, y0);
    p.clear(x1, y0);
    p.hline(x0 + 1, x1 - 1, y0 + 2, L.trim);
  } else if (k === 'north') {
    // Dark boards, iron at the corners, nail heads.
    for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      p.set(cx, cy, L.trim);
      p.set(cx + dx, cy, L.trim);
      p.set(cx, cy + dy, L.trim);
    }
    p.set(x0 + 2, y0 + 1, '#c8c8d0');
    p.set(x1 - 2, y0 + 1, '#c8c8d0');
  } else if (k === 'velmarch') {
    // A marble plaque edged in purple, a sprig of olive either side.
    p.hline(x0 + 1, x1 - 1, y0 + 1, L.trim);
    p.hline(x0 + 1, x1 - 1, y1 - 1, L.trim);
    for (let y = y0 + 2; y < y1 - 1; y += 2) {
      p.set(x0 - 1, y, L.accent);
      p.set(x1 + 1, y + 1, L.accent);
    }
  } else if (k === 'ember') {
    // Basalt, rimmed in brass, a glowing sign burned into it.
    p.hline(x0, x1, y0, L.trim);
    p.hline(x0, x1, y1, shade(hex(L.trim), 0.7));
    p.set(x0, y0 + 1, L.trim);
    p.set(x1, y0 + 1, L.trim);
  }
  if (!writing) return;
  const ink = k === 'jade' ? L.trim : k === 'ember' ? L.glass[0] : inkOn(L.board[0]);
  if (k === 'jade') {
    // (Written top to bottom.)
    for (let x = x0 + 2; x < x1 - 1; x += 2) for (let y = y0 + 2; y < y1 - 1; y += 2) if ((x + y) % 3) p.set(x, y, ink);
    return;
  }
  const top = k === 'sun' ? y0 + 4 : y0 + 2;
  for (let y = top; y < y1 - 1; y += 2) p.hline(x0 + 2, x1 - 2 - (y % 4 ? 1 : 3), y, ink);
}

function sign(L) {
  const p = spr();
  p.rect(7, 18, 2, 8, L.post[0]);
  p.vline(8, 18, 25, L.post[2]);
  if (L.key === 'jade') {
    // Tall and narrow, under a little upturned roof, a tassel below.
    board(p, L, 4, 7, 8, 11);
    p.hline(2, 13, 5, '#2a2224');
    p.hline(3, 12, 6, '#3e3236');
    p.set(1, 4, '#2a2224');
    p.set(14, 4, '#2a2224');
    p.vline(8, 18, 20, L.trim);
    p.set(8, 21, L.head[0]);
  } else if (L.key === 'tide') {
    board(p, L, 2, 9, 12, 9);
    p.hline(6, 9, 20, L.trim);
    p.hline(6, 9, 23, L.trim);
  } else if (L.key === 'sun') {
    board(p, L, 2, 8, 12, 10);
    p.rect(6, 24, 4, 2, L.post[1]);
  } else if (L.key === 'north') {
    board(p, L, 1, 9, 14, 9);
    p.set(7, 9, L.trim);
    p.set(8, 9, L.trim);
  } else if (L.key === 'velmarch') {
    board(p, L, 2, 9, 12, 9);
    p.rect(5, 24, 6, 2, L.post[1]);
  } else board(p, L, 2, 9, 12, 9);
  return p.outline(OUT);
}

function hangingSign(L, rot) {
  // A board under its bracket, the trade's mark painted on its panel by
  // the renderer (so the panel's kept where it always was).
  const p = spr();
  const hang = L.key === 'tide' ? L.trim : L.metal;
  if (rot === 1) p.hline(6, 15, 1, hang);
  else if (rot === 3) p.hline(0, 9, 1, hang);
  else p.hline(2, 13, 1, hang);
  p.vline(3, 1, 4, hang);
  p.vline(12, 1, 4, hang);
  board(p, L, 2, 4, 12, 11, false);
  const panel = L.key === 'ember' || L.key === 'north' || L.key === 'mist' ? mix(hex(L.paper), hex(L.board[0]), 0.25) : L.key === 'jade' ? '#e8c890' : L.paper;
  p.rect(3, 5, 10, 9, panel);
  if (L.key === 'jade') {
    p.vline(2, 15, 17, L.trim);
    p.vline(13, 15, 17, L.trim);
    p.set(2, 18, L.head[0]);
    p.set(13, 18, L.head[0]);
  } else if (L.key === 'sun' || L.key === 'velmarch') {
    p.hline(3, 12, 13, L.trim);
  } else if (L.key === 'ember') {
    for (const [x, y] of [[2, 4], [13, 4], [2, 14], [13, 14]]) p.set(x, y, L.trim);
  }
  return p.outline(OUT);
}

function noticeBoard(L) {
  const p = spr(TALL_H);
  const k = L.key;
  p.rect(2, 14, 2, 24, L.post[0]);
  p.rect(12, 14, 2, 24, L.post[0]);
  p.vline(3, 14, 37, L.post[2]);
  p.vline(13, 14, 37, L.post[2]);
  board(p, L, 1, 12, 14, 16, false);
  // Its roof (or cap), its people's way.
  if (k === 'mist') {
    for (let y = 8; y <= 11; y++) for (let x = 11 - y; x <= 4 + y; x++) p.set(x, y, (x + y) % 3 ? '#8a8a4a' : '#6a6a36');
    for (let x = 0; x < 16; x += 2) p.set(x, 12, '#6a6a36');
  } else if (k === 'tide') {
    p.rect(0, 9, 16, 3, L.cloth);
    p.hline(0, 15, 11, shade(hex(L.cloth), 0.8));
    for (let x = 1; x < 16; x += 3) p.set(x, 12, shade(hex(L.cloth), 0.8));
    p.set(1, 8, L.trim);
    p.set(14, 8, L.trim);
  } else if (k === 'jade') {
    p.hline(0, 15, 10, '#2a2224');
    p.hline(1, 14, 11, '#3e3236');
    p.hline(2, 13, 9, '#3e3236');
    p.set(0, 9, '#2a2224');
    p.set(15, 9, '#2a2224');
    p.set(0, 8, L.trim);
    p.set(15, 8, L.trim);
  } else if (k === 'sun') {
    p.rect(0, 10, 16, 2, L.trim);
    p.hline(0, 15, 10, shade(hex(L.trim), 1.25));
    p.ellipse(7.5, 8, 2, 1.5, L.metal);
  } else if (k === 'north') {
    for (let y = 4; y <= 11; y++) {
      const half = y - 4;
      p.hline(Math.max(0, 7 - half), Math.min(15, 8 + half), y, y === 11 ? L.post[1] : L.board[1]);
    }
    p.vline(7, 3, 4, L.trim);
  } else if (k === 'velmarch') {
    for (let y = 6; y <= 11; y++) {
      const half = Math.round((y - 6) * 1.5);
      p.hline(Math.max(0, 7 - half), Math.min(15, 8 + half), y, y >= 10 ? L.board[1] : L.board[0]);
    }
    p.hline(5, 10, 9, L.trim);
  } else if (k === 'ember') {
    p.rect(0, 10, 16, 2, L.board[1]);
    p.hline(0, 15, 10, L.board[2]);
    p.set(0, 10, L.trim);
    p.set(15, 10, L.trim);
  } else {
    p.rect(0, 10, 16, 2, L.post[1]);
  }
  // The notices pinned up.
  const notes = [[3, 14, 4, 5], [9, 15, 4, 4], [4, 21, 5, 4], [10, 21, 3, 5]];
  for (const [x, y, w, h] of notes) {
    p.rect(x, y, w, h, L.paper);
    p.hline(x + 1, x + w - 2, y + 2, '#8a8070');
    p.set(x + 1, y, L.head[0]);
  }
  return p.outline(OUT);
}

function poster(L, st) {
  const p = spr();
  p.rect(7, 17, 2, 9, L.post[0]);
  p.vline(8, 17, 25, L.post[2]);
  p.rect(2, 3, 12, 15, L.paper);
  const band = st ? ['#d89a28', '#f0c050'] : L.head;
  p.rect(2, 3, 12, 3, band[0]);
  p.hline(2, 13, 3, band[1]);
  if (st) {
    const sun = '#f0b820';
    p.ellipse(7.5, 10, 2, 2, sun);
    for (const [x, y] of [[7, 6], [8, 6], [4, 10], [11, 10], [5, 7], [10, 7], [5, 13], [10, 13]]) p.set(x, y, sun);
  } else {
    const red = L.key === 'jade' ? '#c8a020' : '#e04868';
    p.rect(5, 8, 2, 1, red);
    p.rect(9, 8, 2, 1, red);
    p.rect(5, 9, 6, 2, red);
    p.rect(6, 11, 4, 1, red);
    p.rect(7, 12, 2, 1, red);
  }
  p.hline(4, 11, 14, '#8a8070');
  p.hline(4, 9, 16, '#8a8070');
  // Its people's finish: a gold border, a wax seal, brass corners, a rope.
  const k = L.key;
  if (k === 'jade' || k === 'sun') {
    p.vline(2, 6, 17, L.trim);
    p.vline(13, 6, 17, L.trim);
  } else if (k === 'velmarch' || k === 'north') {
    p.ellipse(11, 16, 1.5, 1.5, k === 'velmarch' ? L.trim : '#b83a32');
  } else if (k === 'ember') {
    for (const [x, y] of [[2, 6], [13, 6], [2, 17], [13, 17]]) p.set(x, y, L.trim);
  } else if (k === 'tide') {
    for (let y = 6; y < 18; y += 2) {
      p.set(2, y, L.trim);
      p.set(13, y + 1, L.trim);
    }
  } else if (k === 'mist') {
    p.set(3, 16, L.accent);
    p.set(12, 7, L.accent);
  }
  return p.outline(OUT);
}

function lantern(L, st, f) {
  const p = spr();
  const k = L.key;
  const lit = st ? (f % 2 ? L.glass[0] : mix(hex(L.glass[0]), hex(L.glass[1]), 0.5)) : '#4a5058';
  if (k === 'jade') {
    // A round paper lantern, gold-capped, a tassel under it.
    p.vline(8, 10, 12, '#2a2224');
    p.ellipse(7.5, 18, 4.5, 4.5, st ? (f % 2 ? '#ff7a40' : '#ff9a58') : '#a82a24');
    for (const y of [15, 18, 21]) p.hline(4, 11, y, st ? '#d8502a' : '#7a1e1a');
    if (st) p.ellipse(7.5, 18, 2, 2, L.glass[1]);
    p.rect(5, 13, 6, 1, L.trim);
    p.rect(5, 23, 6, 1, L.trim);
    p.vline(8, 24, 26, L.trim);
  } else if (k === 'sun') {
    // Pierced brass under an onion dome: its light out through the holes.
    p.ellipse(7.5, 14, 3.5, 2.5, L.metal);
    p.set(7, 10, L.metal);
    p.set(8, 10, L.metal);
    p.rect(5, 16, 6, 8, shade(hex(L.metal), 0.8));
    for (let y = 17; y < 23; y += 2) for (let x = 6 + (y % 4 ? 1 : 0); x < 10; x += 2) p.set(x, y, st ? lit : '#3a2a1a');
    p.hline(4, 11, 24, L.metal);
  } else if (k === 'north') {
    // An iron cage, barred across, a pale flame in it.
    p.rect(5, 15, 6, 10, '#2e2e34');
    p.rect(6, 16, 4, 8, st ? '#fff4c8' : '#3a3e46');
    if (st) p.rect(7, 18, 2, 4, '#ffd860');
    p.hline(5, 10, 19, L.metal);
    p.vline(7, 15, 24, L.metal);
    p.hline(4, 11, 25, L.metal);
    p.ellipse(7.5, 13, 1.5, 1.5, L.metal);
  } else if (k === 'velmarch') {
    // White glass in a gilt frame, a spike on top.
    p.rect(5, 15, 6, 10, L.metal);
    p.rect(6, 16, 4, 8, st ? lit : '#d8d8e0');
    if (st) p.set(7, 18, L.glass[1]);
    p.hline(4, 11, 25, L.metal);
    p.hline(5, 10, 14, L.metal);
    p.vline(7, 10, 13, L.metal);
    p.vline(8, 11, 13, L.metal);
  } else if (k === 'ember') {
    // A brass fire-bowl on three short legs.
    p.ellipse(7.5, 20, 5, 2.5, L.metal);
    p.hline(3, 12, 19, shade(hex(L.metal), 1.3));
    p.line(4, 21, 3, 25, L.post[0]);
    p.line(11, 21, 12, 25, L.post[0]);
    p.vline(8, 22, 25, L.post[0]);
    if (st) {
      const o = f % 2;
      p.rect(5, 15 + o, 6, 4 - o, '#e04a18');
      p.rect(6, 13 + o, 4, 5, '#f8a030');
      p.rect(7, 15, 2, 3, '#fff0a0');
    } else p.hline(5, 10, 18, '#3a2a24');
  } else if (k === 'tide') {
    // A ship's lantern: brass top and foot, sea-green glass.
    p.rect(5, 13, 6, 2, L.metal);
    p.rect(5, 15, 6, 8, st ? lit : '#3a5a62');
    p.vline(5, 15, 22, L.metal);
    p.vline(10, 15, 22, L.metal);
    if (st) p.set(7, 17, L.glass[1]);
    p.rect(4, 23, 8, 2, L.metal);
    p.set(7, 11, L.metal);
    p.set(8, 11, L.metal);
    p.set(7, 12, L.metal);
  } else {
    // Mist: a glass jar, its cork tied up with string, a green glow in it.
    p.vline(8, 10, 13, '#c8b890');
    p.rect(6, 14, 4, 2, '#8a6a40');
    p.rect(5, 16, 6, 9, st ? lit : '#5a6a58');
    p.hline(5, 10, 16, shade(hex(st ? lit : '#5a6a58'), 1.2));
    if (st) {
      p.set(6, 19, L.glass[1]);
      p.set(9, 22, L.glass[1]);
      p.set(7, 21, '#ffffff');
    }
  }
  return p.outline(OUT);
}

// The mark on a banner (as textures.js draws it on the Valeborn's).
function mark(p, pal, x0, x1, y0, y1) {
  const m = pal.trim;
  const cx = Math.round((x0 + x1) / 2);
  const cy = Math.round((y0 + y1) / 2);
  if (pal.mark === 'cross') {
    p.rect(cx - 1, y0 + 1, 2, y1 - y0 - 1, pal.flags[1]);
    p.rect(x0 + 1, cy - 1, x1 - x0 - 1, 2, pal.flags[1]);
  } else if (pal.mark === 'crescent') {
    p.ellipse(cx, cy, 2.5, 2.5, m);
    p.ellipse(cx + 1, cy - 1, 2, 2, pal.cloth);
  } else if (pal.mark === 'zigzag') {
    for (let x = x0 + 1; x < x1; x++) {
      p.set(x, cy - 2 + (x % 2), pal.flags[0]);
      p.set(x, cy + 2 + (x % 2), pal.flags[2]);
    }
  } else if (pal.mark === 'hammer') {
    p.rect(cx - 2, cy - 3, 5, 2, m);
    p.rect(cx, cy - 1, 1, 5, m);
  } else if (pal.mark === 'heart') {
    p.rect(cx - 2, cy - 2, 2, 2, m);
    p.rect(cx + 1, cy - 2, 2, 2, m);
    p.rect(cx - 2, cy, 5, 2, m);
    p.set(cx, cy + 2, m);
  } else {
    p.rect(cx - 1, cy - 3, 3, 7, m);
    p.rect(cx - 3, cy - 1, 7, 3, m);
  }
}

function banner(L, st, colour) {
  const pal = DECOR_PALETTES[(st ? 4 : 0) + (colour & 3)];
  const p = spr();
  const k = L.key;
  const cloth = hex(pal.cloth);
  const pole = (x, y0, c = L.post) => {
    p.vline(x, y0, 27, c[0]);
    p.vline(x + 1, y0, 27, c[2]);
  };
  if (k === 'tide') {
    // A pennant off the top of a mast, its line run down.
    pole(3, 1);
    for (let y = 2; y <= 12; y++) {
      const len = Math.round(11 * (1 - Math.abs(y - 7) / 6));
      if (len > 0) p.hline(5, 4 + len, y, y === 7 ? pal.trim : pal.cloth);
    }
    p.line(5, 13, 12, 26, L.trim);
    p.set(3, 0, L.metal);
  } else if (k === 'jade') {
    // A tall narrow banner from a curved bar, gold tassels at its ends.
    pole(7, 0);
    p.hline(2, 13, 3, '#2a2224');
    p.set(1, 2, '#2a2224');
    p.set(14, 2, '#2a2224');
    p.vline(1, 3, 6, L.trim);
    p.vline(14, 3, 6, L.trim);
    p.rect(4, 4, 8, 19, pal.cloth);
    p.vline(4, 4, 22, pal.trim);
    p.vline(11, 4, 22, pal.trim);
    p.hline(4, 11, 22, pal.trim);
    mark(p, pal, 4, 11, 6, 18);
  } else if (k === 'sun') {
    // A square cloth with a fringe, bordered in turquoise.
    pole(3, 2);
    p.hline(2, 13, 3, L.metal);
    p.rect(5, 4, 9, 13, pal.cloth);
    p.vline(5, 4, 16, L.trim);
    p.vline(13, 4, 16, L.trim);
    p.hline(5, 13, 4, L.trim);
    for (let x = 5; x <= 13; x++) p.set(x, 17 + (x % 2), x % 2 ? pal.trim : L.trim);
    mark(p, pal, 5, 13, 5, 16);
  } else if (k === 'north') {
    // A long pennon running out to a point: a dragon's tail.
    pole(3, 2);
    p.set(3, 1, L.trim);
    for (let y = 3; y <= 19; y++) {
      const w = Math.max(1, Math.round(8 * (1 - (y - 3) / 18)));
      p.hline(5, 4 + w, y, y % 5 === 0 ? pal.trim : pal.cloth);
    }
    p.set(6, 20, pal.trim);
  } else if (k === 'velmarch') {
    // A gonfalon: hung square from its rod, pointed below, a spear-tip on top.
    pole(7, 3);
    p.set(7, 1, L.metal);
    p.set(8, 1, L.metal);
    p.rect(7, 0, 2, 1, L.metal);
    p.hline(2, 13, 4, L.metal);
    for (let y = 5; y <= 22; y++) {
      const cut = y > 17 ? y - 17 : 0;
      for (let x = 3 + cut; x <= 12 - cut; x++) if (x < 7 || x > 8) p.set(x, y, x === 3 + cut || x === 12 - cut ? pal.trim : pal.cloth);
    }
    mark(p, pal, 3, 12, 6, 16);
  } else if (k === 'ember') {
    // A square banner with a flame-cut foot, a brass cap on its pole.
    pole(3, 2);
    p.rect(3, 0, 2, 2, L.metal);
    p.hline(2, 13, 3, L.post[1]);
    for (let y = 4; y <= 21; y++) {
      for (let x = 5; x <= 13; x++) {
        if (y > 17 && (x + y) % 3 === 0) continue;
        if (y > 19 && x % 3 !== 1) continue;
        p.set(x, y, x === 5 || x === 13 ? pal.trim : x > 10 ? shade(cloth, 0.85) : pal.cloth);
      }
    }
    mark(p, pal, 5, 13, 5, 16);
  } else {
    // Mist: a ragged cloth on a reed pole, tied with cord.
    pole(3, 3);
    p.hline(3, 13, 4, '#8a7a50');
    for (let y = 5; y <= 21; y++) {
      for (let x = 5; x <= 13; x++) {
        if (y > 17 && (x * 7 + y * 3) % 5 < y - 16) continue;
        p.set(x, y, x === 5 ? pal.trim : pal.cloth);
      }
    }
    mark(p, pal, 5, 13, 6, 16);
  }
  return p.outline(OUT);
}

function arch(L) {
  // The arch a wedding's held under, its people's way.
  const p = spr(TALL_H);
  const k = L.key;
  const flowers = ['#ff9ad0', '#ffffff', '#e04848', '#f0d040'];
  if (k === 'jade') {
    // A red gate: two pillars, a black upswept lintel over a red one, a
    // gold board between, lanterns hung either side.
    p.rect(2, 10, 2, 29, L.board[0]);
    p.rect(12, 10, 2, 29, L.board[0]);
    p.vline(3, 10, 38, L.board[2]);
    p.vline(13, 10, 38, L.board[2]);
    p.hline(0, 15, 6, '#2a2224');
    p.hline(0, 15, 7, '#2a2224');
    p.set(0, 5, '#2a2224');
    p.set(15, 5, '#2a2224');
    p.rect(1, 10, 14, 2, L.board[0]);
    p.rect(6, 8, 4, 2, L.trim);
    for (const x of [5, 10]) {
      p.vline(x, 12, 13, '#2a2224');
      p.ellipse(x + 0.5, 16, 1.5, 2, '#e84a2a');
      p.set(x, 18, L.trim);
    }
    p.rect(1, 37, 4, 2, '#3a3236');
    p.rect(11, 37, 4, 2, '#3a3236');
  } else if (k === 'sun') {
    // Sandstone posts under a roof of palm fronds, turquoise ribbons.
    p.rect(1, 12, 3, 27, L.board[0]);
    p.rect(12, 12, 3, 27, L.board[0]);
    p.vline(1, 12, 38, L.board[2]);
    p.vline(12, 12, 38, L.board[2]);
    const frond = ['#5a9a3a', '#3e7a2a', '#7ab84a'];
    for (let x = 0; x < 16; x++) {
      const y = 8 + Math.round(Math.abs(x - 7.5) * 0.4);
      for (let kk = 0; kk < 3; kk++) p.set(x, y + kk, frond[(x + kk) % 3]);
      if (x % 3 === 0) p.set(x, y + 3, frond[1]);
    }
    for (let y = 14; y < 34; y += 4) {
      p.set(4, y, L.trim);
      p.set(11, y + 2, L.trim);
    }
  } else if (k === 'north') {
    // Evergreen boughs bent over two posts, antlers at the top, red ribbon.
    p.rect(1, 12, 2, 27, L.post[0]);
    p.rect(13, 12, 2, 27, L.post[0]);
    const pine = ['#2e5a3a', '#3e7a4a', '#24482e'];
    const top = (x) => 6 + Math.round(((x - 7.5) / 6.5) ** 2 * 8);
    for (let x = 0; x < 16; x++) for (let kk = 0; kk < 3; kk++) p.set(x, top(x) + kk, pine[(x + kk) % 3]);
    for (let y = 14; y < 37; y += 3) {
      p.set(0, y, pine[0]);
      p.set(3, y + 1, pine[1]);
      p.set(12, y, pine[0]);
      p.set(15, y + 1, pine[1]);
    }
    const bone = '#e8dcc0';
    p.line(7, 5, 4, 1, bone);
    p.line(8, 5, 11, 1, bone);
    p.set(5, 3, bone);
    p.set(10, 3, bone);
    p.rect(6, 9, 4, 2, '#c83a32');
    p.vline(6, 11, 13, '#c83a32');
    p.vline(9, 11, 14, '#c83a32');
  } else if (k === 'velmarch') {
    // Two marble columns with their capitals, a garland of vine and violets.
    for (const x of [1, 12]) {
      p.rect(x, 12, 3, 26, L.board[0]);
      p.vline(x, 12, 37, L.board[2]);
      p.vline(x + 2, 12, 37, L.board[1]);
      p.rect(x - 1, 10, 5, 2, L.board[0]);
      p.rect(x - 1, 37, 5, 2, L.board[1]);
    }
    const vine = ['#4a7a32', '#5a8a3a', '#3a6a2a'];
    for (let x = 1; x < 15; x++) {
      const y = 9 + Math.round(Math.sin((Math.PI * (x - 1)) / 13) * 4);
      p.set(x, y, vine[x % 3]);
      p.set(x, y + 1, vine[(x + 1) % 3]);
      if (x % 3 === 1) p.set(x, y + 2, L.head[1]);
    }
  } else if (k === 'ember') {
    // Two basalt pillars, braziers burning on top, red cloth slung between.
    for (const x of [1, 12]) {
      p.rect(x, 12, 3, 27, L.board[0]);
      p.vline(x, 12, 38, L.board[2]);
      p.ellipse(x + 1.5, 10, 2.5, 1.2, L.metal);
      p.rect(x, 6, 3, 3, '#e04a18');
      p.rect(x + 1, 4, 1, 4, '#f8a030');
    }
    for (let x = 4; x < 12; x++) {
      const y = 13 + Math.round(Math.sin((Math.PI * (x - 3)) / 9) * 3);
      p.set(x, y, '#b84a2a');
      p.set(x, y + 1, '#8a2a1a');
    }
  } else if (k === 'tide') {
    // A driftwood arch hung with a net, shells and floats.
    p.rect(1, 12, 2, 27, L.board[1]);
    p.rect(13, 12, 2, 27, L.board[1]);
    const top = (x) => 5 + Math.round(((x - 7.5) / 6.5) ** 2 * 7);
    for (let x = 0; x < 16; x++) {
      p.set(x, top(x), L.board[0]);
      p.set(x, top(x) + 1, L.board[1]);
    }
    for (let y = 12; y < 26; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 13; x += 2) p.set(x, y, L.trim);
    for (const [x, y] of [[4, 26], [8, 27], [11, 25]]) p.ellipse(x, y, 1, 1, L.accent);
    p.set(2, 18, '#e8b040');
    p.set(13, 22, '#e8b040');
  } else {
    // Mist: a willow arch, its strands hanging, reeds about its feet.
    p.rect(1, 12, 2, 27, L.post[0]);
    p.rect(13, 12, 2, 27, L.post[0]);
    const top = (x) => 4 + Math.round(((x - 7.5) / 6.5) ** 2 * 7);
    const leaf = ['#7a9a4a', '#5a7a3a', '#9ab85a'];
    for (let x = 0; x < 16; x++) {
      for (let kk = 0; kk < 2; kk++) p.set(x, top(x) + kk, leaf[(x + kk) % 3]);
      if (x % 2 === 0) for (let y = top(x) + 2; y < top(x) + 6 + (x % 4); y++) p.set(x, y, leaf[y % 3]);
    }
    for (let x = 0; x < 16; x += 3) p.vline(x, 34, 38, '#8a8a4a');
    for (let x = 2; x < 14; x += 4) p.set(x, top(x) + 1, flowers[(x >> 2) % 4]);
  }
  return p.outline(OUT);
}

// Cloth of an awning, in a people's look: `col` its colour.
export function awningTop(look, col) {
  const L = LOOK_PAL[look];
  const p = spr(16);
  const c = hex(col);
  const light = hex('#f0e8d8');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let v;
      if (L.key === 'mist') v = (x + y) % 4 < 2 ? mix(c, hex('#8a8a5a'), 0.5) : mix(c, hex('#6a6a42'), 0.55);
      else if (L.key === 'tide') v = y < 3 ? c : (x * 5 + y * 3) % 23 === 0 ? shade(light, 0.85) : light;
      else if (L.key === 'jade') v = y < 2 ? hex(L.trim) : c;
      else if (L.key === 'sun') v = Math.floor(x / 4) % 2 ? light : c;
      else if (L.key === 'north') v = (y % 5 === 2 && x % 2) ? shade(c, 0.6) : shade(c, 0.78);
      else if (L.key === 'velmarch') v = y < 2 || y > 13 ? hex(L.metal) : c;
      else if (L.key === 'ember') v = (x + y) % 6 === 0 ? c : mix(c, hex('#2a2024'), 0.6);
      else v = Math.floor(x / 2) % 2 ? light : c;
      p.set(x, y, v);
    }
  }
  return p;
}

export function awningFront(look, col) {
  const L = LOOK_PAL[look];
  const t = awningTop(look, col);
  const p = spr(LH);
  for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, t.get(x, y));
  const c = hex(col);
  for (let x = 0; x < 16; x++) {
    let cut;
    if (L.key === 'jade') cut = [3, 1, 1, 3][x % 4];
    else if (L.key === 'sun') cut = x % 2 ? 3 : 1;
    else if (L.key === 'ember') cut = [4, 2, 1, 2][x % 4];
    else if (L.key === 'north' || L.key === 'mist') cut = (x * 7) % 3;
    else if (L.key === 'tide') cut = x % 5 === 0 ? 2 : 1;
    else cut = x % 4 === 0 || x % 4 === 3 ? 3 : 1;
    for (let y = LH - cut; y < LH; y++) p.clear(x, y);
    if (L.key === 'sun' && x % 2) p.set(x, LH - cut - 1, c);
    if (L.key === 'jade') p.set(x, LH - cut - 1, hex(L.trim));
  }
  return frontify(p, 0.85);
}

// A prop in look `look` (1 to 7): its picture, or null if it's not one of
// the LOOKED.
export function lookSprite(name, look, rot, st, f, colour = 0) {
  const L = LOOK_PAL[look];
  switch (name) {
    case 'sign': return sign(L);
    case 'hanging_sign': return hangingSign(L, rot);
    case 'notice_board': return noticeBoard(L);
    case 'poster': return poster(L, st);
    case 'lantern': return lantern(L, st, f);
    case 'festival_banner': return banner(L, st, colour);
    case 'flower_arch': return arch(L);
    default: return null;
  }
}
