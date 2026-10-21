// (Round 132) The forge's workshops, painted the way the openings are
// (see render/brush.js): 256 by 144 pixels, shown twice the size; colour
// in ramps that cool as they darken and warm as they lighten, everything
// lit from one place (the furnace's mouth, a window, a lamp), texture in
// clusters of a few tones rather than noise, the edge of a lit thing a
// tone lighter. Four of them:
//   the smithy: a stone wall, the brick furnace with its hood and its
//     mouth, the bellows, the anvil on its stump, the quench barrel, tongs
//     and hammers on a pegboard, the coal bucket, a night window;
//   the carpenter's bench: plank walls, a window of daylight, the bench
//     and its vise, tools on a board, shavings, a stack of blanks;
//   the bowyer's: limewashed wattle and timber, the tillering board with
//     its notches, staves leaning, a barrel of arrows, feathers in a pot,
//     a hanging lamp;
//   the cutting table: dark panelling, shelves of hides and spools, hides
//     hung to dry, a lantern, the long table.
// What moves (the fire, the work, the light) is drawn over them each frame
// (see forgewin.js).
import { Bmp, rgb, ramp, mixC, hash2, vnoise } from '../render/brush.js';

export const FW = 256;
export const FH = 144;

const R = (hex, n = 5, spread = 0.4) => ramp(hex, n, { spread });
const pick = (pal, x, y, s, k = 0.5) => pal[Math.max(0, Math.min(pal.length - 1, Math.round((pal.length - 1) * k + (hash2(x, y, s) - 0.5) * 1.2)))];

// ------------------------------------------------------------ pieces
// Stone blocks in courses, each block its own tone, mortar between, the
// light falling from (lx, ly).
function stoneWall(b, x0, y0, x1, y1, base, lx, ly, seed) {
  const pal = R(base, 6, 0.46);
  const mortar = mixC(pal[0], rgb('#000000'), 0.35);
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / 8);
    const off = (row % 2) * 7;
    for (let x = x0; x < x1; x++) {
      const bx = Math.floor((x - x0 + off) / 14);
      const inX = (x - x0 + off) % 14;
      const inY = (y - y0) % 8;
      if (inY === 7 || inX === 13) {
        b.set(x, y, mortar);
        continue;
      }
      const lit = 1 - Math.min(1, Math.hypot(x - lx, (y - ly) * 1.3) / 190);
      let k = 0.18 + lit * 0.62 + (hash2(bx, row, seed) - 0.5) * 0.25;
      // (Each block lit along its top edge, shaded along its foot.)
      if (inY === 0) k += 0.14;
      if (inY === 6) k -= 0.12;
      if (hash2(x >> 1, y >> 1, seed + 3) < 0.08) k -= 0.12;
      b.set(x, y, pal[Math.max(0, Math.min(5, Math.round(k * 5)))]);
    }
  }
}
// Planks, running across (`vertical`: up and down), knots and grain.
function planks(b, x0, y0, x1, y1, base, vertical, lx, ly, seed, w = 7) {
  const pal = R(base, 6, 0.44);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = vertical ? x - x0 : y - y0;
      const along = vertical ? y : x;
      const n = Math.floor(a / w);
      if (a % w === w - 1) {
        b.set(x, y, pal[0]);
        continue;
      }
      const lit = 1 - Math.min(1, Math.hypot(x - lx, y - ly) / 230);
      let k = 0.2 + lit * 0.55 + (hash2(n, 7, seed) - 0.5) * 0.22;
      // (The grain: long streaks.)
      if (hash2(n, Math.floor(along / 9), seed + 1) < 0.25 && (a % w) === ((n * 3) % (w - 1))) k -= 0.15;
      if (a % w === 0) k += 0.1;
      // (A knot now and then.)
      const kx = vertical ? x0 + n * w + 3 : x0 + Math.floor(hash2(n, 3, seed) * (x1 - x0));
      const ky = vertical ? y0 + Math.floor(hash2(n, 3, seed) * (y1 - y0)) : y0 + n * w + 3;
      if (Math.hypot(x - kx, y - ky) < 1.6) k -= 0.28;
      b.set(x, y, pal[Math.max(0, Math.min(5, Math.round(k * 5)))]);
    }
  }
}
// Bricks (the furnace), smaller courses, soot darkening them toward `sx`.
function bricks(b, pts, base, lx, ly, seed, soot = null) {
  const pal = R(base, 6, 0.42);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const inside = (px, py) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const row = Math.floor(y / 4);
      const inX = (x + (row % 2) * 4) % 8;
      if (y % 4 === 3 || inX === 7) {
        b.set(x, y, pal[0]);
        continue;
      }
      const lit = 1 - Math.min(1, Math.hypot(x - lx, y - ly) / 120);
      let k = 0.25 + lit * 0.5 + (hash2(Math.floor((x + (row % 2) * 4) / 8), row, seed) - 0.5) * 0.3;
      if (y % 4 === 0) k += 0.1;
      if (soot && Math.hypot(x - soot[0], y - soot[1]) < soot[2]) k -= 0.3 * (1 - Math.hypot(x - soot[0], y - soot[1]) / soot[2]);
      b.set(x, y, pal[Math.max(0, Math.min(5, Math.round(k * 5)))]);
    }
  }
}
// A floor of trodden earth and flags, darker away from the light.
function floor(b, y0, base, lx, seed, flags = true) {
  const pal = R(base, 6, 0.4);
  for (let y = y0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const d = (y - y0) / (FH - y0);
      let k = 0.25 + (1 - Math.min(1, Math.abs(x - lx) / 200)) * 0.35 + d * 0.15 + (hash2(x >> 2, y >> 1, seed) - 0.5) * 0.2;
      if (flags) {
        const fx = (x + Math.floor((y - y0) / 9) * 11) % 22;
        if ((y - y0) % 9 === 0 || fx === 0) k -= 0.16;
      }
      if (y === y0) k -= 0.2;
      b.set(x, y, pal[Math.max(0, Math.min(5, Math.round(k * 5)))]);
    }
  }
}
// A window: its frame, the sky beyond in bands, a moon or the sun's glare.
function windowFrame(b, x0, y0, w, h, sky, frame, { moon = false, sun = false } = {}) {
  const fr = R(frame, 4, 0.36);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y / h;
      b.set(x0 + x, y0 + y, mixC(rgb(sky[0]), rgb(sky[1]), k));
    }
  }
  if (moon) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) b.set(x0 + w - 8 + x, y0 + 7 + y, x * x + y * y <= 4 ? rgb('#f0f0e0') : rgb('#c8c8b8'));
  if (moon) for (let i = 0; i < 9; i++) b.set(x0 + Math.floor(hash2(i, 1, 4) * w), y0 + Math.floor(hash2(i, 2, 4) * h * 0.7), rgb('#e8e8ff'));
  if (sun) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - w * 0.3, y - h * 0.3) < 7) b.set(x0 + x, y0 + y, rgb('#fff8e0'), 0.6);
  // The frame and its bars.
  for (let y = -2; y < h + 2; y++) for (const x of [-2, -1, w, w + 1]) b.set(x0 + x, y0 + y, x === -1 || x === w ? fr[2] : fr[0]);
  for (let x = -2; x < w + 2; x++) for (const y of [-2, -1, h, h + 1]) b.set(x0 + x, y0 + y, y === h ? fr[3] : y === -1 ? fr[2] : fr[0]);
  for (let y = 0; y < h; y++) b.set(x0 + Math.floor(w / 2), y0 + y, fr[1]);
  for (let x = 0; x < w; x++) b.set(x0 + x, y0 + Math.floor(h / 2), fr[1]);
}
// A tool's silhouette on a peg: tongs, a hammer, a saw, a chisel...
function tool(b, kind, x, y, pal) {
  const [d, m, l] = [pal[0], pal[2], pal[4]];
  b.set(x, y - 1, rgb('#2a2018'));
  if (kind === 'tongs') {
    for (let i = 0; i < 22; i++) {
      b.set(x - 1 + Math.floor(i / 11), y + i, i < 18 ? m : d);
      b.set(x + 1 - Math.floor(i / 11), y + i, i < 18 ? l : d);
    }
  } else if (kind === 'hammer') {
    for (let i = 0; i < 16; i++) b.set(x, y + i, rgb(i < 12 ? '#7a5030' : '#5a3a20'));
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) b.set(x + i, y + 13 + j, j === 0 ? l : i === -3 ? d : m);
  } else if (kind === 'saw') {
    for (let i = 0; i < 20; i++) for (let j = 0; j < 5 - Math.floor(i / 6); j++) b.set(x + i - 4, y + 4 + j, j === 0 ? l : m);
    for (let i = 0; i < 20; i += 2) b.set(x + i - 4, y + 9 - Math.floor(i / 6), d);
    for (let j = 0; j < 7; j++) b.set(x - 5, y + 2 + j, rgb('#8a5a30'));
  } else if (kind === 'chisel') {
    for (let i = 0; i < 6; i++) b.set(x, y + i, rgb('#9a6a3a'));
    for (let i = 6; i < 14; i++) b.set(x, y + i, i === 13 ? l : m);
  } else if (kind === 'mallet') {
    for (let i = 0; i < 12; i++) b.set(x, y + i, rgb('#8a5a30'));
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 5; j++) b.set(x + i, y + 10 + j, rgb(j === 0 ? '#c89a60' : '#9a6a3a'));
  } else if (kind === 'awl') {
    for (let i = 0; i < 5; i++) for (let j = -1; j <= 1; j++) b.set(x + j, y + i, rgb('#7a5030'));
    for (let i = 5; i < 12; i++) b.set(x, y + i, l);
  }
}

// ------------------------------------------------------------ the smithy
// Where things are, for forgewin.js to draw over.
export const SMITHY = { mouth: { x: 42, y: 86, rx: 17, ry: 15 }, bellows: { x: 98, y: 101 }, anvil: { x: 146, y: 92 }, barrel: { x: 213, y: 90 }, chimney: { x: 43, y: 4 }, window: { x: 202, y: 16, w: 26, h: 20 } };
export function paintSmithy(seed = 1) {
  const b = new Bmp(FW, FH);
  const M = SMITHY.mouth;
  stoneWall(b, 0, 0, FW, 114, '#6a5a4e', M.x, M.y, seed);
  // Beams across the top, and a post.
  planks(b, 0, 0, FW, 8, '#4a3220', false, M.x, M.y, seed + 2, 4);
  for (let y = 8; y < 114; y++) for (let x = 176; x < 182; x++) b.set(x, y, R('#4a3220', 4)[x === 176 ? 0 : x === 181 ? 1 : 2]);
  windowFrame(b, SMITHY.window.x, SMITHY.window.y, SMITHY.window.w, SMITHY.window.h, ['#0e1430', '#2a3a6a'], '#3a2818', { moon: true });
  // The pegboard and the tools on it.
  planks(b, 112, 24, 172, 64, '#5a3e26', true, M.x, M.y, seed + 5, 6);
  const iron = R('#5a5a64', 5, 0.5);
  tool(b, 'tongs', 120, 28, iron);
  tool(b, 'tongs', 128, 30, iron);
  tool(b, 'hammer', 140, 28, iron);
  tool(b, 'hammer', 152, 30, iron);
  tool(b, 'hammer', 163, 29, iron);
  // The furnace: a brick body, its hood narrowing up into the chimney,
  // sooted round its mouth.
  bricks(b, [[6, 112], [6, 50], [16, 40], [70, 40], [80, 50], [80, 112]], '#9a4a32', M.x + 10, M.y, seed, [M.x, M.y - 6, 30]);
  bricks(b, [[18, 41], [30, 18], [32, 0], [54, 0], [56, 18], [68, 41]], '#8a4430', M.x, M.y, seed + 1, [M.x, 40, 26]);
  // Its mouth: an arch of darker brick round a black hollow (the fire's
  // drawn in it).
  for (let y = M.y - M.ry - 3; y <= M.y + M.ry; y++) {
    for (let x = M.x - M.rx - 3; x <= M.x + M.rx + 3; x++) {
      const dx = (x - M.x) / (M.rx + 3);
      const dy = (y - M.y) / (M.ry + 3);
      const inner = (x - M.x) ** 2 / M.rx ** 2 + Math.min(0, y - M.y) ** 2 / M.ry ** 2 <= 1 && y <= M.y + M.ry;
      const ring = dx * dx + Math.min(0, dy) ** 2 <= 1;
      if (inner) b.set(x, y, rgb('#140a08'));
      else if (ring) b.set(x, y, R('#6a3020', 4)[(x + y) % 3 === 0 ? 1 : 2]);
    }
  }
  // Its hearth sill.
  for (let x = M.x - M.rx - 4; x <= M.x + M.rx + 4; x++) for (let y = M.y + M.ry; y < M.y + M.ry + 3; y++) b.set(x, y, R('#7a7068', 4)[y === M.y + M.ry ? 3 : 1]);
  // The coal bucket.
  for (let y = 114; y < 128; y++) for (let x = 86 + (y - 114) / 6; x < 104 - (y - 114) / 6; x++) b.set(x, y, R('#4a4a50', 4)[x < 90 ? 0 : x > 100 ? 1 : 2]);
  for (let x = 87; x < 103; x++) b.set(x, 114, rgb('#7a7a82'));
  for (let x = 88; x < 102; x++) for (let y = 111; y < 114; y++) if (hash2(x, y, 9) < 0.7) b.set(x, y, R('#2a2a30', 3)[Math.floor(hash2(x, y, 2) * 3)]);
  // The floor.
  floor(b, 114, '#4e4038', M.x, seed + 7);
  // The anvil's stump, and the anvil on it: horn, face, waist, feet.
  const A = SMITHY.anvil;
  const wood = R('#6a4428', 5, 0.4);
  for (let y = A.y + 14; y < A.y + 34; y++) for (let x = A.x - 11; x < A.x + 11; x++) b.set(x, y, wood[x < A.x - 8 ? 0 : x > A.x + 7 ? 1 : (x + (y >> 2)) % 5 === 0 ? 1 : 3]);
  for (let x = A.x - 11; x < A.x + 11; x++) b.set(x, A.y + 14, wood[4]);
  const anv = R('#3a3a46', 6, 0.5);
  for (let y = 0; y < 14; y++) {
    const half = y < 4 ? 22 : y < 7 ? 14 - (y - 4) : y < 10 ? 9 : 13;
    const left = y < 4 ? A.x - 22 - (y < 2 ? 6 - y * 3 : 0) : A.x - half;
    for (let x = left; x < A.x + half; x++) b.set(x, A.y + y, anv[y === 0 ? 5 : y < 4 ? (x < A.x - 16 ? 2 : 3) : x < A.x - half + 2 ? 0 : 2]);
  }
  // The quench barrel: staves, hoops, the water's lid of dark.
  const B0 = SMITHY.barrel;
  const stave = R('#6a4428', 5, 0.38);
  for (let y = B0.y; y < B0.y + 32; y++) {
    const bulge = Math.round(Math.sin(((y - B0.y) / 32) * Math.PI) * 2);
    for (let x = B0.x - 16 - bulge; x < B0.x + 16 + bulge; x++) {
      const s = Math.floor((x - B0.x + 20) / 5);
      let k = 2 + (x < B0.x - 10 ? -1 : x > B0.x + 10 ? -1 : 0) + ((x - B0.x + 20) % 5 === 0 ? -1 : 0) + (hash2(s, 2, 8) < 0.4 ? 1 : 0);
      if ([B0.y + 6, B0.y + 24].includes(y)) k = -1;
      b.set(x, y, k < 0 ? R('#3a3a42', 3)[1] : stave[Math.max(0, Math.min(4, k))]);
    }
  }
  for (let x = B0.x - 16; x < B0.x + 16; x++) for (let y = B0.y - 3; y < B0.y + 1; y++) {
    const e = ((x - B0.x) / 16) ** 2 + ((y - B0.y + 1) / 3) ** 2;
    if (e <= 1) b.set(x, y, e > 0.7 ? stave[3] : rgb('#1a2a36'));
  }
  return b;
}

// ------------------------------------------------------------ the bench
export const BENCH = { top: 92, x0: 30, x1: 226, vise: 206, window: { x: 20, y: 16, w: 40, h: 34 } };
export function paintBench(seed = 2) {
  const b = new Bmp(FW, FH);
  const W = BENCH.window;
  planks(b, 0, 0, FW, 116, '#8a6a46', false, W.x + 20, W.y + 20, seed, 8);
  windowFrame(b, W.x, W.y, W.w, W.h, ['#a8d0f0', '#e8f0f8'], '#5a3e22', { sun: true });
  // A shelf and the tools on their board.
  planks(b, 140, 14, 236, 54, '#6a4a2c', true, W.x, W.y, seed + 3, 6);
  const iron = R('#6a6a74', 5, 0.5);
  tool(b, 'saw', 150, 18, iron);
  tool(b, 'chisel', 176, 18, iron);
  tool(b, 'chisel', 182, 19, iron);
  tool(b, 'chisel', 188, 18, iron);
  tool(b, 'mallet', 202, 18, iron);
  tool(b, 'hammer', 218, 19, iron);
  // A stack of blanks, end-on, by the window.
  for (const [cx, cy] of [[78, 82], [88, 82], [83, 74], [98, 82], [93, 74]]) {
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const r = Math.hypot(x, y);
      if (r <= 4) b.set(cx + x, cy + y, R('#a87a48', 5)[r > 3.3 ? 0 : Math.floor(r) % 2 ? 2 : 3]);
    }
  }
  floor(b, 116, '#6a5238', W.x + 30, seed + 5, false);
  // Shavings curled on the floor.
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(hash2(i, 5, seed) * FW);
    const y = 120 + Math.floor(hash2(i, 6, seed) * 22);
    b.set(x, y, rgb('#d8b070'));
    b.set(x + 1, y, rgb('#b88a50'));
  }
  // The bench: its thick top, apron and legs, the vise at its end.
  const top = R('#a0743e', 6, 0.42);
  for (let y = BENCH.top; y < BENCH.top + 8; y++) for (let x = BENCH.x0; x < BENCH.x1; x++) b.set(x, y, top[y === BENCH.top ? 5 : y === BENCH.top + 7 ? 1 : (x >> 3) % 2 ? 3 : 4]);
  for (const lx of [BENCH.x0 + 6, BENCH.x1 - 14]) for (let y = BENCH.top + 8; y < FH; y++) for (let x = lx; x < lx + 8; x++) b.set(x, y, top[x === lx ? 1 : 2]);
  for (let y = BENCH.top + 8; y < BENCH.top + 14; y++) for (let x = BENCH.x0; x < BENCH.x1; x++) b.set(x, y, top[1]);
  const vise = R('#4a4a52', 5, 0.5);
  for (let y = BENCH.top - 10; y < BENCH.top + 14; y++) for (let x = BENCH.vise; x < BENCH.vise + 8; x++) b.set(x, y, vise[x === BENCH.vise ? 4 : 2]);
  for (let x = BENCH.vise + 8; x < BENCH.vise + 18; x++) b.set(x, BENCH.top + 4, vise[3]);
  return b;
}

// ------------------------------------------------------------ the bowyer
export const BOWYER = { tiller: { x: 128, y0: 12, y1: 118 }, lamp: { x: 46, y: 26 }, bench: 116 };
export function paintBowyer(seed = 3) {
  const b = new Bmp(FW, FH);
  const L = BOWYER.lamp;
  // Limewashed wattle between dark timbers.
  const lime = R('#d8ccb0', 6, 0.36);
  for (let y = 0; y < 118; y++) {
    for (let x = 0; x < FW; x++) {
      const lit = 1 - Math.min(1, Math.hypot(x - L.x, y - L.y) / 210);
      // (Limewash: broad soft patches, a fleck now and then where it's
      // worn through to the wattle.)
      let k = 0.24 + lit * 0.58 + (vnoise(x / 16, y / 12, seed) - 0.5) * 0.14 + (vnoise(x / 5, y / 5, seed + 1) - 0.5) * 0.05;
      if (hash2(x, y, seed + 2) < 0.012) k -= 0.16;
      b.set(x, y, lime[Math.max(0, Math.min(5, Math.round(k * 5)))]);
    }
  }
  const tim = R('#3a2a1c', 4, 0.4);
  for (const tx of [0, 84, 172, 250]) for (let y = 0; y < 118; y++) for (let x = tx; x < tx + 6; x++) b.set(x, y, tim[x === tx ? 0 : x === tx + 5 ? 1 : 2]);
  for (let x = 0; x < FW; x++) for (let y = 0; y < 6; y++) b.set(x, y, tim[y === 5 ? 1 : 2]);
  // The tillering board: an upright plank, its notches.
  const T = BOWYER.tiller;
  planks(b, T.x - 7, T.y0, T.x + 8, T.y1, '#7a5432', true, L.x, L.y, seed + 4, 15);
  for (let y = T.y0 + 40; y < T.y1 - 6; y += 6) for (let x = T.x - 6; x < T.x - 2; x++) b.set(x, y, rgb('#2a1a10'));
  // Staves leaning in the corner, and a barrel of arrows.
  for (let i = 0; i < 5; i++) {
    const x0 = 196 + i * 6;
    for (let y = 30 + i * 3; y < 118; y++) b.set(x0 + Math.round((y - 30) * 0.12), y, R('#9a6a3a', 4)[i % 2 ? 2 : 3]);
  }
  const stave = R('#6a4428', 5, 0.38);
  for (let y = 92; y < 118; y++) for (let x = 216; x < 240; x++) b.set(x, y, stave[(x - 216) % 5 === 0 ? 1 : x < 219 || x > 236 ? 1 : 3]);
  for (let i = 0; i < 10; i++) {
    const ax = 218 + i * 2;
    for (let y = 80 + (i % 3); y < 92; y++) b.set(ax, y, rgb('#c8a070'));
    b.set(ax, 79 + (i % 3), rgb(['#e8e8e8', '#c83a2a', '#3a6aa8'][i % 3]));
  }
  // Feathers in a pot on the bench end.
  for (let y = 104; y < 116; y++) for (let x = 24; x < 36; x++) b.set(x, y, R('#8a5a3a', 4)[x < 27 ? 1 : 2]);
  for (let i = 0; i < 6; i++) for (let y = 92 + i; y < 104; y++) b.set(25 + i * 2, y, rgb(['#f0f0e8', '#c8c0b0', '#a83a2a'][i % 3]));
  floor(b, 118, '#6a5640', L.x, seed + 6, false);
  // The low bench.
  const top = R('#8a6438', 5, 0.4);
  for (let y = 116; y < 122; y++) for (let x = 12; x < 120; x++) b.set(x, y, top[y === 116 ? 4 : 2]);
  return b;
}

// ------------------------------------------------------------ the table
export const TABLE = { top: 74, x0: 18, x1: 238, lantern: { x: 214, y: 22 } };
export function paintTable(seed = 4) {
  const b = new Bmp(FW, FH);
  const L = TABLE.lantern;
  planks(b, 0, 0, FW, 76, '#4a3426', true, L.x, L.y, seed, 10);
  // Shelves: hides rolled, spools of thread.
  const shelf = R('#6a4a30', 4, 0.4);
  for (const sy of [26, 50]) {
    for (let x = 70; x < 190; x++) for (let y = sy; y < sy + 3; y++) b.set(x, y, shelf[y === sy ? 3 : 1]);
    for (let i = 0; i < 7; i++) {
      const cx = 78 + i * 16;
      const hide = R(['#8a5a34', '#a87444', '#6a4428', '#c89a64'][(i + sy) % 4], 4, 0.4);
      if ((i + sy) % 3 === 0) {
        for (let y = sy - 8; y < sy; y++) for (let x = cx - 2; x < cx + 3; x++) b.set(x, y, R(['#c83a3a', '#3a6aa8', '#e8d8a8'][i % 3], 3)[x === cx - 2 ? 0 : 2]);
        for (let x = cx - 3; x < cx + 4; x++) for (const y of [sy - 9, sy - 1]) b.set(x, y, rgb('#6a4428'));
      } else {
        for (let y = sy - 9; y < sy; y++) for (let x = cx - 6; x < cx + 6; x++) {
          const e = ((y - sy + 4.5) / 4.5) ** 2;
          if (e <= 1) b.set(x, y, hide[e > 0.6 ? 0 : x === cx - 6 + ((y * 3) % 12) ? 1 : 2]);
        }
      }
    }
  }
  // Hides hung to dry on the left wall.
  for (const [hx, hy, c] of [[22, 12, '#a87444'], [46, 16, '#8a5a34']]) {
    const hide = R(c, 5, 0.42);
    for (let y = 0; y < 40; y++) {
      const w = 9 + Math.round(Math.sin((y / 40) * Math.PI) * 5) + (hash2(y, 1, hx) < 0.3 ? 1 : 0);
      for (let x = -w; x <= w; x++) b.set(hx + x, hy + y, hide[Math.abs(x) > w - 2 ? 0 : (x + y) % 7 === 0 ? 1 : 3]);
    }
    for (let x = -4; x <= 4; x++) b.set(hx + x, hy - 1, rgb('#2a1a10'));
  }
  // The long table, its top grained, its edge lit.
  const top = R('#7a5434', 6, 0.42);
  for (let y = TABLE.top; y < FH; y++) for (let x = 0; x < FW; x++) {
    const lit = 1 - Math.min(1, Math.hypot(x - L.x, (y - L.y) * 0.8) / 260);
    let k = 0.25 + lit * 0.5 + ((x + Math.floor(y / 3) * 7) % 23 === 0 ? -0.15 : 0) + (hash2(x >> 3, y >> 1, seed) - 0.5) * 0.12;
    if (y === TABLE.top) k = 0.95;
    if (y === TABLE.top + 1) k = 0.1;
    b.set(x, y, top[Math.max(0, Math.min(5, Math.round(k * 5)))]);
  }
  // An awl and a spool by the work.
  tool(b, 'awl', 232, 80, R('#8a8a92', 5, 0.5));
  for (let y = 84; y < 92; y++) for (let x = 10; x < 18; x++) b.set(x, y, R('#e0d0a0', 3)[x === 10 ? 0 : 2]);
  return b;
}

// What a scene's lasting part is, by work.
export function paintWork(kind, seed = 1) {
  if (kind === 'carve') return paintBench(seed);
  if (kind === 'bow') return paintBowyer(seed);
  if (kind === 'stitch') return paintTable(seed);
  return paintSmithy(seed);
}

// ------------------------------------------------------------ heat
// The colour of hot iron, `k` from cold (0) to white (1): black, dull red,
// cherry, orange, yellow, white.
const HEAT = ['#2a2426', '#4a1a14', '#8a1a10', '#c8300c', '#e8601a', '#f8a030', '#fde070', '#fffbe8'];
export function heatColour(k) {
  const f = Math.max(0, Math.min(1, k)) * (HEAT.length - 1);
  const i = Math.floor(f);
  return mixC(rgb(HEAT[i]), rgb(HEAT[Math.min(HEAT.length - 1, i + 1)]), f - i);
}
export const HEAT_RAMP = HEAT;
export { pick };
