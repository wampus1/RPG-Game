// (Round 137) How a forged piece's abilities look (see game/abilities.js).
// Effects placed in the world:
//   - a sigil flaring under you as one is cast, a shockwave, ice bursting
//     up, a meteor's fall, a crack through the ground, roots, a lance of
//     sunlight, wisps, a cloud of rot, a ring of slowed time, falling
//     stars, a whirlwind, a shell of light;
//   - (Round 138) a wall of fire, a geyser, a chain flung out, a lance of
//     ice, a swarm, a well of night, flowers, smoke, a spirit wolf, a gust
//     of wind.
// And what stays on you a while, drawn on you as you move (a healing
// ring, blades circling, a shell, a red rage, thorns, after-images, iron
// plates, a pact in blood, smoke).
//   (Round 138) All of it drawn the way the rest of the world is: whole
// pixels on the world's own grid, each thing in a few shades of its own
// colour, dark at the edges; fading by a stipple of pixels rather than a
// blur; moving a frame at a time, as the people and beasts do.
//   All of it plain data going in (it goes over the wire to the others
// playing as it is: see net/host.js), worked out each frame here.
import { humanoidSheet, CHAR_W, CHAR_H, SHEET_H, SPR_PAD } from './sprites.js';
import { flameFrame } from './fx.js';

const TAU = Math.PI * 2;
const R = Math.round;
const ease = (k) => 1 - (1 - k) * (1 - k);
// (Frames a second: the world's own beat, as its creatures move.)
const FPS = 12;

// Each kind of light or matter, darkest to brightest.
export const PALS = {
  fire: ['#4a1408', '#b8301a', '#f07020', '#ffc040', '#fff4c0'],
  ice: ['#14305a', '#3a74b8', '#78b4ec', '#c8ecff', '#ffffff'],
  gold: ['#4a3008', '#a07018', '#e8b830', '#ffe488', '#fffbe0'],
  violet: ['#20123a', '#503088', '#8a64d8', '#cab4ff', '#ffffff'],
  green: ['#142810', '#2e5a1a', '#5a9a30', '#a0d860', '#e8ffd0'],
  blood: ['#2a060c', '#7a1020', '#c82830', '#ff6858', '#ffd0c0'],
  earth: ['#24160c', '#523620', '#86643c', '#c4a070', '#f0dcb0'],
  wind: ['#3a5856', '#6c9890', '#a8ccc4', '#e0f4ee', '#ffffff'],
  steel: ['#22262e', '#4c5462', '#8490a2', '#c4ccd8', '#ffffff'],
  poison: ['#1a2a0c', '#3e6214', '#78a028', '#b8e058', '#f0ffc0'],
  water: ['#0c2850', '#20609e', '#4c98dc', '#a0d4ff', '#ffffff'],
  storm: ['#1a2050', '#3a4ca8', '#7c90f0', '#d0dcff', '#ffffff'],
  spirit: ['#0c3a34', '#1a7a6a', '#40c8a8', '#a0ffe4', '#ffffff'],
  rose: ['#3a0a2a', '#80205e', '#d0489e', '#ff9ad8', '#ffe0f4'],
  star: ['#2a2a50', '#7a78c0', '#c8c8f8', '#fff8c8', '#ffffff'],
  smoke: ['#1c1c22', '#3c3c44', '#66666e', '#9c9ca4', '#d0d0d4'],
};
// (An effect given only a colour: the nearest of these.)
const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0);
const NEAR = new Map();
function nearestPal(c) {
  if (!NEAR.has(c)) {
    const [r0, g0, b0] = rgb(c);
    let best = null;
    let bd = Infinity;
    for (const [k, P] of Object.entries(PALS)) {
      for (const q of [P[2], P[3]]) {
        const [r1, g1, b1] = rgb(q);
        const d = (r1 - r0) ** 2 + (g1 - g0) ** 2 + (b1 - b0) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
    }
    NEAR.set(c, best);
  }
  return NEAR.get(c);
}
const palOf = (f, d = 'gold') => PALS[f.pal] || (f.color ? PALS[nearestPal(Array.isArray(f.color) ? f.color[0] : f.color)] : null) || PALS[d];

// ------------------------------------------------------------ pixels
// A 4x4 ordered stipple: a pixel's there if its place in the pattern is
// under `a` (how much of it shows).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const shows = (x, y, a) => a >= 1 || (a > 0 && BAYER[((y & 3) << 2) | (x & 3)] < a);

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// One pixel (or a block of them), stippled by `a`.
function px(ctx, x, y, c, a = 1, w = 1, h = 1) {
  x = R(x);
  y = R(y);
  if (!shows(x, y, a)) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

// A ring on the ground, a pixel wide, each pixel once; `gap` (0 to 1): how
// much of it's broken away (where, by `seed`); `from`/`to`: an arc of it.
function ring(ctx, cx, cy, rx, ry, c, a = 1, o = {}) {
  if (rx < 0.5 || a <= 0) return;
  cx = R(cx);
  cy = R(cy);
  const n = Math.max(8, Math.ceil(TAU * Math.max(rx, ry) * 1.2));
  const from = o.from ?? 0;
  const to = o.to ?? TAU;
  let lx = null;
  let ly = null;
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    const q = from + ((to - from) * i) / n;
    const x = cx + R(Math.cos(q) * rx);
    const y = cy + R(Math.sin(q) * ry);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    if (o.gap && hash((o.seed || 0) + i, 7) < o.gap) continue;
    if (!shows(x, y, a)) continue;
    ctx.fillRect(x, y, o.w || 1, o.w || 1);
  }
}

// A filled oval, stippled by `a`.
function disc(ctx, cx, cy, rx, ry, c, a = 1) {
  if (rx < 0.5 || ry < 0.5 || a <= 0) return;
  cx = R(cx);
  cy = R(cy);
  ctx.fillStyle = c;
  const H = Math.ceil(ry);
  for (let dy = -H; dy <= H; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const half = R(rx * Math.sqrt(t));
    if (a >= 1) {
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
      continue;
    }
    for (let dx = -half; dx <= half; dx++) if (shows(cx + dx, cy + dy, a)) ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

// A glow, as the world draws one: stippled bands of its colour, thinning
// outward.
function glow(ctx, cx, cy, r, c, a = 1, flat = 1) {
  disc(ctx, cx, cy, r, r * flat, c, 0.18 * a);
  disc(ctx, cx, cy, r * 0.62, r * 0.62 * flat, c, 0.36 * a);
  disc(ctx, cx, cy, r * 0.3, r * 0.3 * flat, c, 0.6 * a);
}

// A line, pixel by pixel.
function line(ctx, x0, y0, x1, y1, c, a = 1, w = 1) {
  x0 = R(x0);
  y0 = R(y0);
  x1 = R(x1);
  y1 = R(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = c;
  for (let i = 0; i < 400; i++) {
    if (shows(x0, y0, a)) ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// A little cross of light (a mote, a glint): `n` its arm.
function glint(ctx, x, y, c, core = '#ffffff', n = 1, a = 1) {
  px(ctx, x, y, core, a);
  for (let i = 1; i <= n; i++) {
    const cc = i === n ? c : core;
    px(ctx, x - i, y, cc, a);
    px(ctx, x + i, y, cc, a);
    px(ctx, x, y - i, cc, a);
    px(ctx, x, y + i, cc, a);
  }
}

// Small runes, 3 by 3 (a ring of them turns on a sigil).
const RUNES = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [1, 0, 0, 1, 1, 0, 1, 0, 0], [0, 1, 1, 0, 1, 0, 1, 1, 0], [1, 1, 1, 0, 0, 1, 0, 1, 0]];
function rune(ctx, x, y, i, c, a = 1) {
  const g = RUNES[i % RUNES.length];
  for (let k = 0; k < 9; k++) if (g[k]) px(ctx, x - 1 + (k % 3), y - 1 + Math.floor(k / 3), c, a);
}

// (Where the camera is, for a spark thrown off an effect: sparks live in
// view pixels, as the effects' own centres do.)
let CAM = { x: 0, y: 0 };
export function setCam(r) {
  CAM = { x: r.camX || 0, y: r.camY || 0 };
}
function spark(r, x, y, color, o = {}) {
  if (r.room && !r.room(1)) return;
  r.particles.push({
    x: x + CAM.x, y: y + CAM.y, vx: o.vx ?? (Math.random() - 0.5) * 30, vy: o.vy ?? -(10 + Math.random() * 25), g: o.g ?? -20,
    life: o.life ?? 0.4 + Math.random() * 0.3, max: o.life ?? 0.6, color, size: o.size ?? 1, shape: o.shape,
  });
}

// ------------------------------------------------------------ the effects
// Each: (r, ctx, f, k (0 to 1 through its life), x, y (its place on
// screen), dt, ox, oy). True if it was one of these.
export function drawAbilityFx(r, ctx, f, k, ox, oy, dt) {
  const fn = FX[f.type];
  if (!fn) return false;
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    fn(r, ctx, f, k, R(f.cx + ox), R(f.cy + oy), dt, ox, oy);
  } finally {
    ctx.restore();
  }
  return true;
}

const frame = (f) => Math.floor(f.t * FPS);
// How much of it's still there: whole, then stippling away at the end.
const fadeOut = (k, from = 0.7) => (k < from ? 1 : 1 - (k - from) / (1 - from));

const FX = {
  // A circle of runes flaring under you as an ability's cast: two rings,
  // runes turning a step at a time between them, a star drawn through, and
  // a column of motes going up off it.
  sigil(r, ctx, f, k, x, y) {
    const P = palOf(f);
    const fr = frame(f);
    const open = ease(Math.min(1, k * 3));
    const a = fadeOut(k, 0.6);
    const rx = R(5 + 11 * open);
    const ry = R(rx * 0.45);
    disc(ctx, x, y, rx, ry, P[1], 0.25 * a);
    ring(ctx, x, y + 1, rx, ry, P[0], a);
    ring(ctx, x, y, rx, ry, P[3], a);
    ring(ctx, x, y, rx - 3, ry - 1, P[2], a);
    const spin = (fr % 16) / 16 * TAU;
    for (let i = 0; i < 6; i++) {
      const q = spin + (i / 6) * TAU;
      rune(ctx, x + R(Math.cos(q) * (rx - 1.5)), y + R(Math.sin(q) * (ry - 0.5)), i + (f.seed || 0), i % 2 ? P[4] : P[3], a);
    }
    for (let i = 0; i < 5; i++) {
      const q0 = -spin / 2 + ((i * 2) % 5) * (TAU / 5);
      const q1 = -spin / 2 + (((i + 1) * 2) % 5) * (TAU / 5);
      line(ctx, x + Math.cos(q0) * (rx - 4), y + Math.sin(q0) * (ry - 1.5), x + Math.cos(q1) * (rx - 4), y + Math.sin(q1) * (ry - 1.5), P[2], a);
    }
    // Motes going up off it.
    if (k < 0.55) {
      for (let i = 0; i < 9; i++) {
        const h = hash(f.seed || 1, i);
        const life = (k * 2.2 + h) % 1;
        const mx = x + R((hash(i, f.seed || 1) - 0.5) * rx * 1.6);
        const my = y - R(life * 34);
        px(ctx, mx, my, i % 3 ? P[3] : P[4], (1 - life) * (1 - k / 0.55));
        px(ctx, mx, my + 1, P[2], (1 - life) * 0.6 * (1 - k / 0.55));
      }
    }
  },

  // A shockwave: a ring three pixels deep, bright at the front, dark
  // behind, rushing out and breaking up; a flash at the heart.
  shock(r, ctx, f, k, x, y) {
    const P = palOf(f, 'fire');
    const R1 = (f.r1 ?? 40) * ease(k);
    const flat = f.flat ?? 0.45;
    const a = fadeOut(k, 0.4);
    const gap = Math.max(0, k - 0.35) * 1.4;
    if (k < 0.2) {
      disc(ctx, x, y, 7 * (1 - k * 3), 4 * (1 - k * 3), P[4], 1);
      glow(ctx, x, y, 14, P[3], 1 - k * 5, 0.6);
    }
    ring(ctx, x, y, R1 - 2, (R1 - 2) * flat, P[1], a * 0.8, { gap, seed: f.seed + 1 });
    ring(ctx, x, y, R1 - 1, (R1 - 1) * flat, P[2], a, { gap, seed: f.seed + 2 });
    ring(ctx, x, y, R1, R1 * flat, P[3], a, { gap, seed: f.seed });
    ring(ctx, x, y, R1 + 1, (R1 + 1) * flat, P[4], a * 0.7, { gap: gap + 0.3, seed: f.seed + 3 });
    ring(ctx, x, y, R1 * 0.6, R1 * 0.6 * flat, P[2], a * 0.35, { gap: 0.4, seed: f.seed + 4 });
  },

  // Spikes of ice bursting up out of the ground: each a shard of three
  // shades, dark-edged, a white glint up its lit side; then shattering.
  spikes(r, ctx, f, k, x, y) {
    const P = PALS.ice;
    const n = f.n ?? 9;
    const RR = f.r1 ?? 22;
    const up = k < 0.18 ? ease(k / 0.18) : 1;
    const gone = k > 0.78;
    // (Back ones first.)
    const list = [];
    for (let i = 0; i < n; i++) {
      const q = (i / n) * TAU + (f.seed % 7);
      const rr = RR * (0.5 + 0.5 * hash(f.seed, i));
      list.push({ i, x: x + R(Math.cos(q) * rr), y: y + R(Math.sin(q) * rr * 0.42), h: R((7 + 9 * hash(i, f.seed)) * up), w: 2 + R(2 * hash(f.seed + 3, i)) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const s of list) {
      if (gone) {
        if (hash(s.i, frame(f)) < 0.3) spark(r, s.x, s.y - s.h / 2, P[3], { vx: (Math.random() - 0.5) * 50, vy: -30, g: 140, shape: 'shard', life: 0.45 });
        continue;
      }
      drawShard(ctx, s.x, s.y, s.w, s.h, P);
    }
    if (!gone) disc(ctx, x, y, RR * 0.9, RR * 0.38, P[3], 0.2);
  },

  // A burning stone out of the sky: a lump of rock, black-edged, its
  // cracks glowing; tongues of flame streaming off behind it; its shadow
  // on the ground growing, and the ground where it'll strike marked.
  meteor(r, ctx, f, k, x, y, dt) {
    const fr = frame(f);
    const p = Math.min(1, k * 1.05);
    const sx = x + R(70 * (1 - p));
    const sy = y - R(150 * (1 - p));
    // Where it'll land: a ring blinking.
    if (fr % 2 === 0) ring(ctx, x, y, 12, 5, PALS.fire[2], 0.9, { gap: 0.3, seed: fr });
    disc(ctx, x, y, 2 + 9 * p, (2 + 9 * p) * 0.4, '#000000', 0.25 + 0.3 * p);
    // Its trail: a streak of fire, banded hot to cool, tongues of flame
    // licking off it.
    const F = PALS.fire;
    const tx = sx + 26;
    const ty = sy - 56;
    line(ctx, sx, sy, tx, ty, F[1], 0.5, 7);
    line(ctx, sx, sy, sx + 20, sy - 43, F[2], 1, 5);
    line(ctx, sx, sy, sx + 13, sy - 28, F[3], 1, 3);
    line(ctx, sx, sy, sx + 6, sy - 13, F[4], 1, 1);
    for (let i = 1; i <= 3; i++) {
      const img = flameFrame(fr + i, false);
      ctx.drawImage(img, R(sx + i * 6 - img.width / 2 + (i % 2 ? 2 : -2)), R(sy - i * 13 - img.height + 3));
    }
    glow(ctx, sx, sy, 10, F[3], 0.9);
    // The stone: black-edged, its cracks aglow.
    disc(ctx, sx, sy, 6, 6, '#140a08');
    disc(ctx, sx, sy, 5, 5, '#4a3430');
    disc(ctx, sx - 1, sy - 1, 3, 3, '#6a4a40');
    px(ctx, sx - 2, sy - 3, '#8a6a5a', 1, 2, 1);
    line(ctx, sx - 3, sy + 1, sx + 1, sy - 1, F[2]);
    line(ctx, sx, sy + 3, sx + 3, sy, F[3]);
    px(ctx, sx + 1, sy - 1, F[4]);
    if (Math.random() < dt * 50) spark(r, sx + 4, sy - 6, PALS.fire[Math.floor(Math.random() * 3) + 2], { vx: 10 + Math.random() * 20, vy: -10 - Math.random() * 20, g: 40, life: 0.45 });
    if (Math.random() < dt * 20) spark(r, sx + 6, sy - 10, '#3a3434', { vx: 12, vy: -8, g: -10, life: 0.8, size: 2 });
  },

  // The ground split open from here toward (ex, ey): a jagged crack, black
  // at its lips, molten in its depths, flames licking up along it, rubble
  // thrown up where it runs.
  fissure(r, ctx, f, k, x, y, dt, ox, oy) {
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    if (!f.path) {
      f.path = [];
      const n = 12;
      for (let i = 0; i <= n; i++) f.path.push([i / n, i === 0 || i === n ? 0 : (hash(f.seed, i) - 0.5) * 7]);
    }
    const run = Math.min(1, k * 3.5);
    const a = fadeOut(k, 0.6);
    const dx = ex - x;
    const dy = ey - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const pts = f.path.filter(([t]) => t <= run).map(([t, j]) => [R(x + dx * t + nx * j), R(y + dy * t + ny * j * 0.5)]);
    const P = PALS.fire;
    const E = PALS.earth;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      line(ctx, x0, y0 + 1, x1, y1 + 1, E[0], a, 2);
      line(ctx, x0, y0, x1, y1, '#140a06', a, 2);
      line(ctx, x0, y0, x1, y1, i % 2 ? P[2] : P[3], a);
    }
    const fr = frame(f);
    pts.forEach(([px0, py0], i) => {
      if (i % 3 !== 1 || k > 0.75) return;
      const img = flameFrame(fr + i, false);
      ctx.globalAlpha = a;
      ctx.drawImage(img, px0 - (img.width >> 1), py0 - img.height + 1);
      ctx.globalAlpha = 1;
    });
    if (run < 1 && pts.length) {
      const [hx, hy] = pts[pts.length - 1];
      for (let i = 0; i < 2; i++) spark(r, hx, hy, [E[2], E[3], P[3]][Math.floor(Math.random() * 3)], { vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, g: 160, life: 0.6, size: 2 });
    }
  },

  // Roots bursting up round where someone stands: thick and bark-dark at
  // the foot, green at the tips, curling over, then sinking back.
  roots(r, ctx, f, k, x, y) {
    const G = PALS.green;
    const E = PALS.earth;
    const fr = frame(f);
    const grow = k < 0.2 ? ease(k / 0.2) : k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
    // Torn earth at their feet.
    disc(ctx, x, y, 8, 3, E[1], 0.9 * grow);
    ring(ctx, x, y, 8, 3, E[0], grow);
    for (let i = 0; i < 5; i++) {
      const q = (i / 5) * TAU + (f.seed % 5);
      const bx = x + Math.cos(q) * 8;
      const by = y + Math.sin(q) * 3;
      const h = (12 + 8 * hash(f.seed, i)) * grow;
      const sway = (fr + i) % 4 < 2 ? 0 : 1;
      const n = Math.max(2, R(h));
      const curl = i % 2 ? 1 : -1;
      let last = null;
      for (let st = 0; st <= n; st++) {
        const t = st / n;
        // (Up, leaning in toward them, and curling over at the tip.)
        const cx = R(bx + (x - bx) * t * 0.85 + curl * Math.sin(t * Math.PI) * 3 + sway * t);
        const cy = R(by - h * t);
        const thick = t < 0.45;
        px(ctx, cx - 1, cy, E[0], 1, thick ? 4 : 3, 1);
        px(ctx, cx, cy, t < 0.7 ? (thick ? E[2] : E[3]) : G[2], 1, thick ? 2 : 1, 1);
        last = [cx, cy];
      }
      // A curl and a leaf at the tip, a thorn on the way up.
      const [lx, ly] = last;
      px(ctx, lx + curl, ly - 1, G[2]);
      px(ctx, lx + curl * 2, ly, G[3]);
      px(ctx, lx - curl, ly + 1, G[4]);
      const [mx, my] = [R(bx + (x - bx) * 0.3), R(by - h * 0.35)];
      px(ctx, mx - curl * 2, my, E[4]);
    }
  },

  // A lance of sunlight out of the sky: a white core in bands of gold,
  // stippling away up into the sky; rays at its foot, stepping round.
  pillar(r, ctx, f, k, x, y) {
    const P = palOf(f);
    const fr = frame(f);
    const wide = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * (f.w ?? 7);
    const top = y - 150;
    const W = Math.max(1, R(wide));
    for (let yy = top; yy <= y; yy++) {
      const up = (y - yy) / (y - top);
      const a = up > 0.6 ? 1 - (up - 0.6) / 0.4 : 1;
      // (Bands of brighter light running down it, a frame at a time.)
      const band = ((yy - top + fr * 4) % 14) < 3;
      px(ctx, x - W - 1, yy, P[1], a * 0.6, 1, 1);
      px(ctx, x + W + 1, yy, P[1], a * 0.6, 1, 1);
      px(ctx, x - W, yy, band ? P[3] : P[2], a, W * 2 + 1, 1);
      px(ctx, x - (W >> 1), yy, band ? P[4] : P[3], a, (W >> 1) * 2 + 1, 1);
      px(ctx, x, yy, P[4], a, 1, 1);
    }
    const ra = 1 - k;
    ring(ctx, x, y, 10 + 6 * k, 4 + 2 * k, P[3], ra);
    ring(ctx, x, y + 1, 10 + 6 * k, 4 + 2 * k, P[1], ra);
    for (let i = 0; i < 8; i++) {
      const q = (i / 8) * TAU + (fr % 4) * (TAU / 32);
      const L = 9 + 7 * (1 - k);
      line(ctx, x + Math.cos(q) * 4, y + Math.sin(q) * 2, x + Math.cos(q) * L, y + Math.sin(q) * L * 0.45, i % 2 ? P[3] : P[4], ra);
    }
    if (fr % 2 === 0) glint(ctx, x + R((hash(fr, f.seed) - 0.5) * 10), y - R(hash(f.seed, fr) * 50), P[3], P[4], 1, ra);
  },

  // A wisp: a bright mote, a ring of light round it, flying a curved way
  // to its mark, a tail of dimming pixels behind.
  wisp(r, ctx, f, k, x, y, dt, ox, oy) {
    const P = palOf(f, 'spirit');
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const bend = (f.bend ?? 1) * 36;
    const at = (t) => {
      const mx = (x + ex) / 2 + Math.cos(f.seed) * bend;
      const my = (y + ey) / 2 - Math.abs(Math.sin(f.seed)) * bend - 20;
      const u = 1 - t;
      return [R(u * u * x + 2 * u * t * mx + t * t * ex), R(u * u * y + 2 * u * t * my + t * t * ey)];
    };
    const p = ease(k);
    for (let i = 10; i >= 1; i--) {
      const [tx, ty] = at(Math.max(0, p - i * 0.022));
      px(ctx, tx, ty, i < 4 ? P[3] : i < 7 ? P[2] : P[1], 1 - i / 11);
    }
    const [hx, hy] = at(p);
    glow(ctx, hx, hy, 5, P[2], 0.9);
    glint(ctx, hx, hy, P[3], P[4], 1);
    if (frame(f) % 3 === 0) px(ctx, hx + R((Math.random() - 0.5) * 6), hy + R((Math.random() - 0.5) * 6), P[4]);
  },

  // A cloud of rot hanging where it was called: puffs a few shades of
  // sick green, each lit from above, churning a step at a time; bubbles
  // swelling and popping in it.
  cloud(r, ctx, f, k, x, y) {
    const P = palOf(f, 'poison');
    const fr = frame(f);
    const a = k < 0.08 ? k / 0.08 : fadeOut(k, 0.85);
    const RR = f.r1 ?? 26;
    disc(ctx, x, y, RR, RR * 0.38, P[0], 0.4 * a);
    for (let i = 0; i < 8; i++) {
      const q = (i / 8) * TAU + ((fr >> 1) % 16) / 16 * (i % 2 ? 1 : -1) * 1.2;
      const rr = RR * (0.25 + 0.5 * hash(f.seed, i));
      const cx = x + R(Math.cos(q) * rr);
      const cy = y - 6 + R(Math.sin(q) * rr * 0.38) + ((fr + i) % 6 < 3 ? 0 : -1);
      const s = 5 + R(3 * hash(i, f.seed));
      disc(ctx, cx, cy + 1, s, s * 0.8, P[1], 0.85 * a);
      disc(ctx, cx - 1, cy, s - 1, (s - 1) * 0.75, P[2], 0.85 * a);
      disc(ctx, cx - 2, cy - 2, s * 0.45, s * 0.35, P[3], 0.7 * a);
    }
    // Bubbles: a ring that swells, then pops to a glint.
    for (let i = 0; i < 4; i++) {
      const life = ((fr + i * 5) % 12) / 12;
      const bx = x + R((hash(i, f.seed + (((fr + i * 5) / 12) | 0)) - 0.5) * RR * 1.4);
      const by = y - 4 - R(life * 6);
      if (life < 0.8) ring(ctx, bx, by, 1 + life * 2, 1 + life * 2, P[3], a);
      else glint(ctx, bx, by, P[3], P[4], 1, a);
    }
  },

  // A ring of slowed time laid on the ground: a great clock-face, double
  // rimmed, its hours marked, a hand sweeping back a step at a time; a
  // violet stipple over it all.
  clock(r, ctx, f, k, x, y) {
    const P = palOf(f, 'violet');
    const fr = frame(f);
    const a = k < 0.1 ? 1 : fadeOut(k, 0.85);
    const RR = (f.r1 ?? 50) * (k < 0.1 ? ease(k / 0.1) : 1);
    const ry = RR * 0.42;
    disc(ctx, x, y, RR, ry, P[1], 0.07 * a);
    ring(ctx, x, y + 1, RR, ry, P[0], a);
    ring(ctx, x, y, RR, ry, P[3], a, { w: 1 });
    ring(ctx, x, y, RR - 4, ry - 2, P[2], a);
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * TAU;
      const hx = x + R(Math.cos(q) * (RR - 8));
      const hy = y + R(Math.sin(q) * (ry - 3.5));
      if (i % 3 === 0) rune(ctx, hx, hy, i / 3, P[4], a);
      else px(ctx, hx, hy, P[3], a, 2, 1);
    }
    // The hands: the long one stepping backward, the short one slower.
    const long = -(fr % 24) / 24 * TAU;
    const short = -((fr >> 2) % 24) / 24 * TAU;
    line(ctx, x, y, x + Math.cos(long) * (RR - 10), y + Math.sin(long) * (ry - 4), P[4], a);
    line(ctx, x, y, x + Math.cos(short) * (RR * 0.45), y + Math.sin(short) * (ry * 0.45), P[3], a, 2);
    px(ctx, x - 1, y - 1, P[4], a, 3, 3);
  },

  // A star falling on someone: a white cross of light at its head, a
  // streak behind; where it lands, a four-pointed flash, shrinking.
  star(r, ctx, f, k, x, y) {
    const P = palOf(f, 'star');
    const land = 0.55;
    if (k < land) {
      const p = ease(k / land);
      const sx = x - R(48 * (1 - p));
      const sy = y - R(128 * (1 - p));
      line(ctx, sx, sy, sx - 18, sy - 48, P[2], 0.6);
      line(ctx, sx, sy, sx - 10, sy - 26, P[3], 1);
      glint(ctx, sx, sy, P[3], P[4], 2);
    } else {
      const q = (k - land) / (1 - land);
      const L = R(9 * (1 - q)) + 1;
      line(ctx, x - L, y - 4, x + L, y - 4, P[3], 1 - q);
      line(ctx, x, y - 4 - L, x, y - 4 + L, P[3], 1 - q);
      line(ctx, x - (L >> 1), y - 4 - (L >> 1), x + (L >> 1), y - 4 + (L >> 1), P[2], 1 - q);
      line(ctx, x - (L >> 1), y - 4 + (L >> 1), x + (L >> 1), y - 4 - (L >> 1), P[2], 1 - q);
      px(ctx, x - 1, y - 5, P[4], 1 - q, 3, 3);
      ring(ctx, x, y, 3 + 14 * ease(q), (3 + 14 * ease(q)) * 0.42, P[3], 1 - q, { gap: q * 0.6, seed: f.seed });
    }
  },

  // A whirlwind: arcs of wind three shades deep, spiralling in a step at a
  // time, rising as they go; dust and leaves caught up in it.
  vortex(r, ctx, f, k, x, y) {
    const P = PALS.wind;
    const fr = frame(f);
    const a = k < 0.12 ? k / 0.12 : fadeOut(k, 0.8);
    const RR = f.r1 ?? 40;
    for (let i = 0; i < 12; i++) {
      const base = (i / 12) * TAU + (fr % 12) / 12 * TAU;
      const life = ((fr / 12) + i / 12) % 1;
      const rr = RR * (1 - life * 0.8);
      const lift = R(life * 14);
      ring(ctx, x, y - lift, rr, rr * 0.4, i % 3 === 0 ? P[4] : i % 3 === 1 ? P[3] : P[2], a, { from: base, to: base + 0.8 });
    }
    for (let i = 0; i < 6; i++) {
      const q = (fr / 6) + i;
      const rr = RR * (0.3 + 0.6 * hash(i, f.seed));
      px(ctx, x + R(Math.cos(q) * rr), y - 4 - R((fr + i * 3) % 14), i % 2 ? PALS.earth[3] : PALS.green[3], a, i % 3 ? 1 : 2, 1);
    }
  },

  // A shell of light snapping up round someone.
  dome(r, ctx, f, k, x, y) {
    const P = palOf(f, 'water');
    const RR = 14 * (k < 0.25 ? ease(k / 0.25) : 1) * (f.big ?? 1);
    drawShell(ctx, x, y, RR, P, fadeOut(k, 0.3), frame(f));
  },

  // A ghost of you striking: a crescent cut through a foe, thick in the
  // middle and fine at its ends, a white edge on violet.
  slash(r, ctx, f, k, x, y) {
    const P = palOf(f, 'violet');
    const ang = f.ang ?? -0.6;
    const p = ease(Math.min(1, k * 2.5));
    const a = fadeOut(k, 0.35);
    const RR = 11;
    const n = 18;
    for (let i = 0; i <= n * p; i++) {
      const t = i / n;
      const q = ang - 1.3 + 2.4 * t;
      const th = R(Math.sin(t * Math.PI) * 3);
      for (let d = -th; d <= th; d++) {
        const rr = RR + d * 0.8;
        px(ctx, x + Math.cos(q) * rr, y - 8 + Math.sin(q) * rr * 0.8, Math.abs(d) === th ? P[2] : d === 0 ? P[4] : P[3], a);
      }
    }
  },

  // (Round 138) A wall of fire along the ground, (cx, cy) to (ex, ey):
  // tongues of flame side by side, each flickering its own way, a glowing
  // bed of embers under them.
  firewall(r, ctx, f, k, x, y, dt, ox, oy) {
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const fr = frame(f);
    const rise = k < 0.1 ? ease(k / 0.1) : 1;
    const a = fadeOut(k, 0.85);
    const n = Math.max(2, R(Math.hypot(ex - x, ey - y) / 8));
    const across = Math.abs(ex - x) >= Math.abs(ey - y);
    line(ctx, x, y + 1, ex, ey + 1, PALS.fire[0], a, 3);
    line(ctx, x, y, ex, ey, PALS.fire[2], a, 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // (Run up the screen, the flames stagger side to side: a wall, not a
      // column.)
      const fx0 = R(x + (ex - x) * t + (across ? 0 : (i % 2 ? 4 : -4)));
      const fy0 = R(y + (ey - y) * t);
      disc(ctx, fx0, fy0, 5, 2, PALS.fire[1], a);
      disc(ctx, fx0, fy0, 3, 1, PALS.fire[3], a);
      const img = flameFrame(fr + i * 3, i % 2 === 0);
      const s = (0.8 + 0.3 * hash(i, f.seed)) * rise;
      const w = R(img.width * s);
      const h = R(img.height * s * (across ? 1.3 : 1));
      ctx.globalAlpha = 1;
      if (shows(fx0, fy0, a)) ctx.drawImage(img, fx0 - (w >> 1), fy0 - h + 1, w, h);
      if (Math.random() < dt * 4) spark(r, fx0, fy0 - h, PALS.fire[3], { vx: (Math.random() - 0.5) * 10, vy: -30, g: -10, life: 0.5 });
    }
  },

  // A geyser out of the ground: a column of water rising in a few hard
  // blue bands, white foam at its head, drops falling off it; then
  // falling back.
  geyser(r, ctx, f, k, x, y, dt) {
    const P = PALS.water;
    const fr = frame(f);
    const h = R(46 * (k < 0.2 ? ease(k / 0.2) : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1));
    const wob = fr % 2;
    ring(ctx, x, y, 9, 4, P[3], 1 - k);
    disc(ctx, x, y, 7, 3, P[1], 0.8);
    for (let yy = 0; yy < h; yy++) {
      const w = 3 + (yy % 6 < 3 ? wob : 1 - wob) + R(2 * (1 - yy / Math.max(1, h)));
      px(ctx, x - w, y - yy, P[0], 1, 1, 1);
      px(ctx, x - w + 1, y - yy, P[2], 1, w * 2 - 1, 1);
      px(ctx, x - 1 + ((yy >> 2) % 2), y - yy, P[3], 1, 2, 1);
      px(ctx, x + w, y - yy, P[1], 1, 1, 1);
    }
    if (h > 3) {
      disc(ctx, x, y - h, 5, 3, P[3]);
      disc(ctx, x - 1, y - h - 1, 3, 2, P[4]);
      if (Math.random() < dt * 40) spark(r, x + (Math.random() - 0.5) * 8, y - h, Math.random() < 0.5 ? P[3] : P[4], { vx: (Math.random() - 0.5) * 50, vy: -30, g: 200, shape: 'drop', life: 0.7 });
    }
  },

  // A chain flung out to someone: links of dark iron, alternately face-on
  // and edge-on, a glint running down them; a hook at its head.
  chain(r, ctx, f, k, x, y, dt, ox, oy) {
    const P = PALS.steel;
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const out = Math.min(1, k * 3);
    const back = k > 0.5 ? (k - 0.5) / 0.5 : 0;
    const tx = R(x + (ex - x) * out * (1 - back));
    const ty = R(y + (ey - y) * out * (1 - back));
    const len = Math.hypot(tx - x, ty - y);
    const n = Math.max(1, Math.floor(len / 3));
    for (let i = 0; i <= n; i++) {
      const lx = R(x + ((tx - x) * i) / n);
      const ly = R(y + ((ty - y) * i) / n);
      if (i % 2) {
        px(ctx, lx - 1, ly - 1, P[0], 1, 3, 3);
        px(ctx, lx, ly, P[3]);
      } else {
        px(ctx, lx - 1, ly, P[0], 1, 3, 1);
        px(ctx, lx, ly, P[2]);
      }
    }
    const g = Math.floor(frame(f) % Math.max(1, n));
    px(ctx, R(x + ((tx - x) * g) / Math.max(1, n)), R(y + ((ty - y) * g) / Math.max(1, n)), P[4]);
    // The hook.
    px(ctx, tx - 2, ty - 2, P[0], 1, 5, 5);
    px(ctx, tx - 1, ty - 1, P[3], 1, 3, 1);
    px(ctx, tx + 1, ty, P[3], 1, 1, 2);
    px(ctx, tx - 1, ty + 1, P[2], 1, 2, 1);
  },

  // A lance of ice thrown at someone: a long shard, faceted and
  // dark-edged, flying point-first, a trail of rime behind it.
  lance(r, ctx, f, k, x, y, dt, ox, oy) {
    const P = PALS.ice;
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const p = Math.min(1, k * 1.1);
    const hx = R(x + (ex - x) * p);
    const hy = R(y + (ey - y) * p);
    const ang = Math.atan2(ey - y, ex - x);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let i = 1; i <= 10; i++) px(ctx, hx - ux * (i + 6), hy - uy * (i + 6), i < 4 ? P[3] : P[2], 1 - i / 11);
    for (let i = 0; i < 8; i++) {
      const w = i < 2 ? 0 : i < 6 ? 1 : 0;
      const cx = hx - ux * i;
      const cy = hy - uy * i;
      for (let d = -w - 1; d <= w + 1; d++) px(ctx, cx - uy * d, cy + ux * d, Math.abs(d) === w + 1 ? P[0] : d < 0 ? P[3] : P[2]);
    }
    px(ctx, hx, hy, P[4]);
    if (Math.random() < dt * 30) spark(r, hx, hy, P[3], { vx: 0, vy: 6, g: 0, life: 0.4, shape: 'star' });
  },

  // A swarm about someone: bees, gold and black, buzzing about a point a
  // pixel at a time.
  swarm(r, ctx, f, k, x, y) {
    const fr = frame(f);
    const a = fadeOut(k, 0.7);
    for (let i = 0; i < 9; i++) {
      const q = (fr * (i % 2 ? 0.9 : -0.7)) + i * 2.1;
      const bx = x + R(Math.cos(q) * (4 + (i % 4) * 2) + (hash(i, fr) - 0.5) * 2);
      const by = y - 12 + R(Math.sin(q * 1.3) * (3 + (i % 3)) + (hash(fr, i) - 0.5) * 2);
      px(ctx, bx - 1, by - 1, '#1a1408', a, 4, 3);
      px(ctx, bx, by, '#ffd030', a, 2, 1);
      px(ctx, bx + 1, by, '#3a2a08', a);
      px(ctx, bx, by - 2, '#e0f0ff', a * ((fr + i) % 2), 2, 1);
    }
  },

  // A well of night opened in the ground: black at the heart, rings of
  // violet drawn down into it a step at a time, motes spiralling in.
  well(r, ctx, f, k, x, y) {
    const P = PALS.violet;
    const fr = frame(f);
    const open = k < 0.15 ? ease(k / 0.15) : k > 0.88 ? 1 - (k - 0.88) / 0.12 : 1;
    const RR = 18 * open;
    disc(ctx, x, y, RR, RR * 0.42, P[1], 0.5);
    disc(ctx, x, y, RR * 0.7, RR * 0.3, P[0]);
    disc(ctx, x, y, RR * 0.4, RR * 0.17, '#000000');
    for (let i = 0; i < 3; i++) {
      const life = ((fr / 8) + i / 3) % 1;
      const rr = RR * (1.6 - life * 1.4);
      ring(ctx, x, y, rr, rr * 0.42, i === 0 ? P[3] : P[2], open * life);
    }
    for (let i = 0; i < 10; i++) {
      const life = ((fr / 10) + i / 10) % 1;
      const q = i * 2.4 + life * 4;
      const rr = RR * 1.8 * (1 - life);
      px(ctx, x + R(Math.cos(q) * rr), y + R(Math.sin(q) * rr * 0.42) - R((1 - life) * 4), i % 3 ? P[3] : P[4], open);
    }
  },

  // Flowers coming up in a ring: stems first, then each flower opening,
  // petals of their own colours round a gold eye, a moment of green light.
  bloom(r, ctx, f, k, x, y) {
    const G = PALS.green;
    const grow = k < 0.35 ? k / 0.35 : 1;
    const a = fadeOut(k, 0.75);
    const PET = ['#ff7090', '#a0c8ff', '#ffffff', '#c890ff', '#ffb050'];
    glow(ctx, x, y - 6, 16, G[3], 0.6 * a);
    for (let i = 0; i < 9; i++) {
      const q = (i / 9) * TAU + (f.seed % 5);
      const rr = 6 + 6 * hash(f.seed, i);
      const bx = x + R(Math.cos(q) * rr);
      const by = y + R(Math.sin(q) * rr * 0.42);
      const h = R(Math.min(1, grow * 1.5) * (3 + 3 * hash(i, f.seed)));
      px(ctx, bx, by - h, G[2], a, 1, h + 1);
      px(ctx, bx + 1, by - 1, G[3], a);
      if (grow > 0.5) {
        const c = PET[i % PET.length];
        const fy = by - h - 1;
        px(ctx, bx, fy, '#ffe070', a);
        if (grow > 0.7) {
          px(ctx, bx - 1, fy, c, a);
          px(ctx, bx + 1, fy, c, a);
          px(ctx, bx, fy - 1, c, a);
          px(ctx, bx, fy + 1, c, a);
        }
      }
    }
  },

  // Smoke welling up and hanging: grey puffs in three shades, lit from
  // above, rolling slowly, thinning to a stipple as it clears.
  smoke(r, ctx, f, k, x, y) {
    const P = PALS.smoke;
    const fr = frame(f);
    const a = k < 0.1 ? k / 0.1 : fadeOut(k, 0.7);
    const RR = f.r1 ?? 34;
    // Each puff wells up, rises and thins away, and wells up again.
    for (let i = 0; i < 12; i++) {
      const life = ((fr / 18) + hash(f.seed, i)) % 1;
      const q = (i / 12) * TAU + (f.seed % 7);
      const rr = RR * (0.15 + 0.6 * hash(i, f.seed));
      const cx = x + R(Math.cos(q) * rr + life * 3);
      const cy = y - 4 + R(Math.sin(q) * rr * 0.42) - R(life * 14);
      const s0 = 3 + R(4 * hash(i, f.seed + 1) + life * 3);
      const pa = a * Math.min(1, (1 - life) * 1.6);
      disc(ctx, cx, cy + 1, s0, s0 * 0.7, P[1], 0.5 * pa);
      disc(ctx, cx, cy, s0, s0 * 0.7, P[2], 0.75 * pa);
      disc(ctx, cx - 1, cy - 1, s0 * 0.6, s0 * 0.4, P[3], 0.85 * pa);
      px(ctx, cx - 2, cy - 2, P[4], 0.6 * pa);
    }
    disc(ctx, x, y, RR * 0.7, RR * 0.28, P[1], 0.45 * a);
  },

  // A wolf of spirit-light running from you to a foe: a pale pixel wolf,
  // dark-edged, two frames of its stride, a trail of light behind it.
  spirit(r, ctx, f, k, x, y, dt, ox, oy) {
    const P = PALS.spirit;
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const p = Math.min(1, ease(k * 1.15));
    const wx = R(x + (ex - x) * p);
    const wy = R(y + (ey - y) * p);
    const dir = ex >= x ? 1 : -1;
    const a = fadeOut(k, 0.85);
    for (let i = 1; i <= 6; i++) px(ctx, wx - dir * (i * 2 + 5), wy - 4 + (i % 2), i < 3 ? P[3] : P[2], a * (1 - i / 7));
    drawWolf(ctx, wx, wy, dir, frame(f) % 2, P, a);
  },

  // A wolf's bite: two rows of fangs snapping shut on someone.
  bite(r, ctx, f, k, x, y) {
    const P = palOf(f, 'spirit');
    const shut = R(5 * (1 - Math.min(1, k * 3)));
    const a = fadeOut(k, 0.5);
    for (let i = -2; i <= 2; i++) {
      px(ctx, x + i * 2, y - 12 - shut, P[4], a, 1, 2);
      px(ctx, x + i * 2, y - 9 + shut, P[4], a, 1, 2);
    }
    line(ctx, x - 5, y - 13 - shut, x + 5, y - 13 - shut, P[2], a);
    line(ctx, x - 5, y - 7 + shut, x + 5, y - 7 + shut, P[2], a);
  },

  // A gust of wind along where someone dashed: streaks of air, a few
  // shades of it, each curling over at its end.
  gust(r, ctx, f, k, x, y, dt, ox, oy) {
    const P = PALS.wind;
    const ex = R(f.ex + ox);
    const ey = R(f.ey + oy);
    const a = fadeOut(k, 0.3);
    const len = Math.max(1, Math.hypot(ex - x, ey - y));
    const nx = -(ey - y) / len;
    const ny = (ex - x) / len;
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * 3;
      const s = Math.min(1, k * 2 + i * 0.1);
      const x0 = x + nx * off;
      const y0 = y - 6 + ny * off * 0.5;
      const x1 = x0 + (ex - x) * s;
      const y1 = y0 + (ey - y) * s;
      line(ctx, x0, y0, x1, y1, i % 2 ? P[3] : P[2], a * (i === 2 ? 1 : 0.7));
      ring(ctx, x1, y1 - 2, 2, 2, P[4], a, { from: Math.PI / 2, to: Math.PI * 2 });
    }
  },
};

// An ice shard rising out of the ground at (x, y): `w` wide at its foot,
// `h` high; dark-edged, its lit side pale, a glint up its edge.
function drawShard(ctx, x, y, w, h, P) {
  if (h < 1) return;
  for (let row = 0; row <= h; row++) {
    const half = R((w * row) / h);
    const yy = y - h + row;
    px(ctx, x - half - 1, yy, P[0], 1, half * 2 + 3, 1);
    if (half > 0) {
      px(ctx, x - half, yy, P[3], 1, half, 1);
      px(ctx, x, yy, P[1], 1, half + 1, 1);
    } else px(ctx, x, yy, P[3]);
  }
  px(ctx, x - 1, y - h + 2, P[4], 1, 1, Math.max(1, R(h * 0.4)));
  px(ctx, x, y - h - 1, P[0]);
}

// A pixel wolf, 11 by 7, facing `dir` (1 right, -1 left), `step` its stride.
const WOLF = [
  ['.........##', '........###', '#######.##.', '########...', '.#######...', '.#.....#...', '.#.....#...'],
  ['.........##', '........###', '#######.##.', '########...', '.#######...', '#.......#..', '#........#.'],
];
function drawWolf(ctx, x, y, dir, step, P, a) {
  const rows = WOLF[step];
  const H = rows.length;
  const at = (c, rr) => [x + (dir > 0 ? c - 5 : 5 - c), y - H - 2 + rr];
  // (Its outline first, a pixel round every part of it.)
  for (let rr = 0; rr < H; rr++) {
    for (let c = 0; c < rows[rr].length; c++) {
      if (rows[rr][c] !== '#') continue;
      const [qx, qy] = at(c, rr);
      px(ctx, qx - 1, qy - 1, P[0], a, 3, 3);
    }
  }
  for (let rr = 0; rr < H; rr++) {
    for (let c = 0; c < rows[rr].length; c++) {
      if (rows[rr][c] !== '#') continue;
      const [qx, qy] = at(c, rr);
      px(ctx, qx, qy, rr === 0 || rr === 2 ? P[4] : rr < 4 ? P[3] : P[2], a);
    }
  }
  const [ex, ey] = at(9, 1);
  px(ctx, ex, ey, P[0], a);
}

// A shell of light (an aegis): a dome over them, dark-rimmed and bright
// along its top, hexes stippled on it; a glint going round a step at a
// time; its foot ringed on the ground.
function drawShell(ctx, x, y, RR, P, a, fr) {
  if (RR < 1 || a <= 0) return;
  const ry = RR * 1.15;
  const cy = y - R(RR * 0.4);
  disc(ctx, x, cy, RR, ry, P[2], 0.16 * a);
  ring(ctx, x, cy + 1, RR, ry, P[0], a * 0.8, { from: Math.PI, to: TAU });
  ring(ctx, x, cy, RR, ry, P[3], a, { from: Math.PI, to: TAU });
  ring(ctx, x, cy, RR, ry, P[2], a * 0.7, { from: 0, to: Math.PI });
  ring(ctx, x, y, RR, RR * 0.4, P[3], a);
  // Hexes.
  for (let i = 0; i < 7; i++) {
    const q = Math.PI + 0.35 + i * 0.4;
    const hx = x + R(Math.cos(q) * RR * 0.65);
    const hy = cy + R(Math.sin(q) * ry * 0.6);
    if ((fr + i) % 4 === 0) {
      px(ctx, hx - 1, hy, P[4], a, 3, 1);
      px(ctx, hx, hy - 1, P[4], a, 1, 3);
    } else px(ctx, hx, hy, P[3], a * 0.6);
  }
  const g = Math.PI + ((fr % 12) / 12) * Math.PI;
  for (let i = 0; i < 3; i++) px(ctx, x + R(Math.cos(g + i * 0.1) * RR), cy + R(Math.sin(g + i * 0.1) * ry), P[4], a);
}

// ------------------------------------------------------------ on someone
// What's working on someone a while (their `abOn`: "halo,blades"), drawn
// with them as they move: `sx` the left of their sprite, `feetY` their
// feet, on screen.
export function drawAuras(r, ctx, e, sx, feetY, tall, dt) {
  const on = String(e.abOn || '');
  if (!on) return;
  const fr = Math.floor((r.time || 0) * FPS);
  const x = R(sx + 8);
  const y = R(feetY);
  const h = tall ? 24 : 14;
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    if (on.includes('halo')) {
      // A ring of gold light at their feet, a bright pixel running round it;
      // crosses of light rising off it a pixel at a time.
      const P = PALS.gold;
      const pulse = fr % 8 < 4 ? 0 : 1;
      ring(ctx, x, y + 1, 11 + pulse, 4 + pulse, P[1]);
      ring(ctx, x, y, 11 + pulse, 4 + pulse, P[3]);
      ring(ctx, x, y, 7, 2.5, P[2], 0.6);
      for (let i = 0; i < 2; i++) {
        const q = ((fr + i * 8) % 16) / 16 * TAU;
        px(ctx, x + R(Math.cos(q) * (11 + pulse)), y + R(Math.sin(q) * (4 + pulse)), P[4], 1, 2, 1);
      }
      for (let i = 0; i < 4; i++) {
        const life = ((fr + i * 6) % 24) / 24;
        const mx = x + R((hash(i, ((fr + i * 6) / 24) | 0) - 0.5) * 18);
        const my = y - R(life * h * 1.2);
        if (i % 2) glint(ctx, mx, my, P[3], P[4], 1, 1 - life);
        else px(ctx, mx, my, '#a0f0a0', 1 - life);
      }
    }
    if (on.includes('bramble')) {
      // Thorny vines round their feet, bark-dark, thorns pale, writhing a
      // step at a time.
      const E = PALS.earth;
      const G = PALS.green;
      ring(ctx, x, y + 1, 10, 4, E[0]);
      ring(ctx, x, y, 10, 4, G[1]);
      for (let i = 0; i < 9; i++) {
        const q = (i / 9) * TAU;
        const vx = x + R(Math.cos(q) * 10);
        const vy = y + R(Math.sin(q) * 4);
        const up = 2 + ((fr + i) % 3);
        px(ctx, vx, vy - up, G[2], 1, 1, up);
        px(ctx, vx + (i % 2 ? 1 : -1), vy - up + 1, E[4]);
      }
    }
    if (on.includes('rage')) {
      // A red glare round them, flickering; embers going up.
      const P = PALS.blood;
      const fl = fr % 3 === 0 ? 0.6 : 1;
      ring(ctx, x, y + 1, 10, 4, P[0]);
      ring(ctx, x, y, 10, 4, P[2]);
      ring(ctx, x, y, 8, 3, P[3], fl);
      // Small flames at their feet, either side, flickering their own way.
      for (const side of [-1, 1]) {
        const img = flameFrame(fr + (side > 0 ? 2 : 0), false);
        ctx.drawImage(img, x + side * 8 - (img.width >> 1), y - img.height + 2);
      }
      for (let i = 0; i < 5; i++) {
        const life = ((fr + i * 5) % 15) / 15;
        px(ctx, x + R((hash(i, ((fr + i * 5) / 15) | 0) - 0.5) * 14), y - R(life * h * 1.3), life < 0.5 ? PALS.fire[3] : P[2], 1 - life);
      }
    }
    if (on.includes('pact')) {
      // Drops of blood circling them, a dark red ring at their feet.
      const P = PALS.blood;
      ring(ctx, x, y + 1, 9, 3.5, P[0]);
      ring(ctx, x, y, 9, 3.5, P[2], 0.8);
      for (let i = 0; i < 3; i++) {
        const q = ((fr + i * 5) % 15) / 15 * TAU;
        const dx = x + R(Math.cos(q) * 11);
        const dy = y - R(h * 0.5) + R(Math.sin(q) * 4);
        px(ctx, dx, dy - 1, P[3]);
        px(ctx, dx - 1, dy, P[2], 1, 3, 1);
        px(ctx, dx, dy + 1, P[1]);
      }
    }
    if (on.includes('ironskin')) {
      // Iron plates at their feet and sides, a glint running up them.
      const P = PALS.steel;
      ring(ctx, x, y + 1, 9, 3.5, P[0]);
      ring(ctx, x, y, 9, 3.5, P[2]);
      const g = fr % 10;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const yy = y - 3 - i * 5;
          px(ctx, x + side * 9 - 1, yy - 2, P[0], 1, 3, 4);
          px(ctx, x + side * 9, yy - 1, i === g % 4 ? P[4] : P[2], 1, 1, 2);
        }
      }
    }
    if (on.includes('veil')) {
      // Smoke curling round them.
      const P = PALS.smoke;
      for (let i = 0; i < 5; i++) {
        const q = ((fr + i * 4) % 20) / 20 * TAU;
        const cx = x + R(Math.cos(q) * 10);
        const cy = y - 4 - R(((fr + i * 3) % 12) / 12 * h);
        disc(ctx, cx, cy, 3, 2, P[2], 0.6);
        disc(ctx, cx - 1, cy - 1, 1.5, 1, P[3], 0.6);
      }
    }
    if (on.includes('quicken')) {
      // After-images behind them, gold, a step and two back; streaks of speed.
      if (e.look && tall) {
        const sheet = humanoidSheet(e.look);
        const dir = r.viewDir ? r.viewDir(e.dir ?? 0) : e.dir ?? 0;
        const back = [[0, 1], [-1, 0], [0, -1], [1, 0]][dir] || [0, 1];
        for (let i = 2; i >= 1; i--) {
          ctx.globalAlpha = i === 1 ? 0.35 : 0.18;
          ctx.filter = 'brightness(1.5) sepia(1) saturate(3) hue-rotate(5deg)';
          ctx.drawImage(sheet, 0, dir * SHEET_H, CHAR_W, SHEET_H, R(sx - back[0] * 3 * i), R(feetY - CHAR_H + 1 - SPR_PAD - back[1] * 2 * i), CHAR_W, SHEET_H);
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 3; i++) {
        const yy = y - 4 - ((fr * 3 + i * 7) % h);
        px(ctx, x - 9 - (i % 2) * 2, yy, PALS.gold[3], 1, 3 + (i % 2) * 2, 1);
      }
    }
    if (on.includes('blades')) {
      // Three small blades of light circling at the waist, a step at a
      // time, each with a stipple of its wake.
      const P = PALS.steel;
      const cy = y - R(h * 0.4);
      // (A faint track they run in.)
      ring(ctx, x, cy, 13, 5.5, PALS.storm[2], 0.3);
      for (let i = 0; i < 3; i++) {
        const q = ((fr % 16) / 16) * TAU + (i / 3) * TAU;
        // Their wake: a short arc of light behind each.
        ring(ctx, x, cy, 13, 5.5, PALS.storm[3], 0.7, { from: q - 0.9, to: q - 0.1 });
        const bx = x + R(Math.cos(q) * 13);
        const by = cy + R(Math.sin(q) * 5.5);
        // The blade itself, along its path: a dark edge, a bright face, a
        // hilt at the back.
        const tx = -Math.sin(q);
        const ty = Math.cos(q) * 0.42;
        const len = Math.hypot(tx, ty) || 1;
        const ux = tx / len;
        const uy = ty / len;
        for (let d = -3; d <= 3; d++) px(ctx, bx + ux * d - 1, by + uy * d - 1, P[0], 1, 3, 3);
        for (let d = -3; d <= 3; d++) px(ctx, bx + ux * d, by + uy * d, d > 1 ? P[4] : P[3]);
        px(ctx, bx - ux * 3, by - uy * 3, PALS.gold[2]);
      }
    }
    if (on.includes('aegis')) drawShell(ctx, x, y, tall ? 12 : 8, PALS.water, 0.85, fr);
    if (on.includes('stasis')) {
      const P = PALS.violet;
      ring(ctx, x, y, 11, 4.5, P[3], fr % 4 < 2 ? 0.9 : 0.5);
      const q = -(fr % 12) / 12 * TAU;
      line(ctx, x, y, x + Math.cos(q) * 9, y + Math.sin(q) * 3.5, P[4]);
    }
  } finally {
    ctx.restore();
  }
}
