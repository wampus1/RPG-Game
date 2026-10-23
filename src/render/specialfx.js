// (Round 139) How a weapon's special looks (see game/specials.js).
//   Coming: the ground it will cover lit under the one winding it up, in
// its own colour, filling out from them as it winds up, its edges
// marching; ready, the edges flash white. Where they'll end up (a lunge's
// end, a leap's landing, the step behind a foe) marked with a diamond and
// a dotted line to it; and a ring of pips round their feet that fills as
// it winds up. Drawn for every one of you playing (it goes over the wire
// on you as `spec`), so the others can see it coming too.
//   Loosed: each its own, a frame at a time, in whole pixels and a few
// shades of its colour, fading by a stipple, as the abilities are (see
// abilityfx.js): a shoulder's dust and a jolt, smoke where you were and
// where you are, a streak of steel, three cuts, a ring of wind at the
// ankles, a lance of light, a line flung out and drawn in, a blow from on
// high and stars, an axe's whirl, a flail's arc on its chain, a great
// crescent, a leap and a cleft in the ground, a hammer's ground split.
import { PALS } from './abilityfx.js';
import { SPECIALS, specialShapes, shapesAt, shapesReach, heading } from '../game/specials.js';

const TAU = Math.PI * 2;
const R = Math.round;
const FPS = 12;
const frame = (t) => Math.floor(t * FPS);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const shows = (x, y, a) => a >= 1 || (a > 0 && BAYER[((y & 3) << 2) | (x & 3)] < a);
const fadeOut = (k, from = 0.6) => (k < from ? 1 : Math.max(0, 1 - (k - from) / (1 - from)));
const ease = (k) => 1 - (1 - k) * (1 - k);
const palOf = (k, f) => PALS[(f && f.pal) || (SPECIALS[k] && SPECIALS[k].pal)] || PALS.steel;
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------ pixels
function px(ctx, x, y, c, a = 1) {
  x = R(x);
  y = R(y);
  if (!shows(x, y, a)) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
}
// A block of pixels, stippled down to `a` of them.
function stip(ctx, x, y, w, h, c, a) {
  if (a <= 0) return;
  x = R(x);
  y = R(y);
  ctx.fillStyle = c;
  if (a >= 1) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (shows(x + i, y + j, a)) ctx.fillRect(x + i, y + j, 1, 1);
}
// A line, a pixel at a time (thick: a pixel either side of it too).
function line(ctx, x0, y0, x1, y1, c, a = 1, thick = 0) {
  const n = Math.max(1, R(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    px(ctx, x, y, c, a);
    if (thick) {
      px(ctx, x + 1, y, c, a);
      px(ctx, x, y + 1, c, a);
    }
  }
}
// An oval ring of pixels on the ground (from angle `a0` to `a1`).
function ring(ctx, cx, cy, rx, ry, c, a = 1, a0 = 0, a1 = TAU) {
  const n = Math.max(8, R((rx + ry) * 2.4 * ((a1 - a0) / TAU)));
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    px(ctx, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, c, a);
  }
}
// A puff of smoke or dust: a rough round blob, stippled.
function blob(ctx, cx, cy, r, c, a) {
  for (let y = -r; y <= r; y++) {
    const w = R(Math.sqrt(Math.max(0, r * r - y * y)));
    for (let x = -w; x <= w; x++) px(ctx, cx + x, cy + y * 0.7, c, a);
  }
}
// A four-pointed star of light.
function star(ctx, x, y, s, P, a = 1) {
  for (let i = -s; i <= s; i++) {
    const c = Math.abs(i) <= s / 3 ? P[4] : P[3];
    px(ctx, x + i, y, c, a);
    px(ctx, x, y + i, c, a);
  }
  if (s >= 3) {
    px(ctx, x + 1, y + 1, P[4], a);
    px(ctx, x - 1, y - 1, P[4], a);
    px(ctx, x + 1, y - 1, P[4], a);
    px(ctx, x - 1, y + 1, P[4], a);
  }
}
// A stroke of light three pixels wide: a dark rim either side, its own
// colour, and a white-hot core down the middle of it (from `hot` of the
// way along on).
function glow(ctx, x0, y0, x1, y1, P, a = 1, hot = 0.3) {
  const n = Math.max(1, R(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const l = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / l;
  const ny = (x1 - x0) / l;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    px(ctx, x + nx * 1.5, y + ny * 1.5, P[1], a * 0.85);
    px(ctx, x - nx * 1.5, y - ny * 1.5, P[1], a * 0.85);
    px(ctx, x + nx * 0.7, y + ny * 0.7, P[2], a);
    px(ctx, x - nx * 0.7, y - ny * 0.7, P[3], a);
    px(ctx, x, y, t >= hot ? P[4] : P[3], a);
  }
}
// A band on the ground, three rings deep, its leading part white-hot.
function band(ctx, cx, cy, rx, ry, P, a = 1, a0 = 0, a1 = TAU, lead = 0.5) {
  ring(ctx, cx, cy + 1, rx - 1, ry - 0.5, P[1], a * 0.8, a0, a1);
  ring(ctx, cx, cy, rx, ry, P[3], a, a0, a1);
  ring(ctx, cx, cy - 1, rx + 1, ry + 0.5, P[2], a * 0.7, a0, a1);
  if (a1 - a0 < TAU - 0.01) ring(ctx, cx, cy, rx, ry, P[4], a, Math.max(a0, a1 - lead), a1);
}
// A burst of light: eight rays and a hot heart.
function burst(ctx, x, y, s, P, a = 1) {
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * TAU;
    const L = i % 2 ? s * 0.6 : s;
    for (let d = 1; d <= L; d++) px(ctx, x + Math.cos(t) * d, y + Math.sin(t) * d * 0.8, d < L * 0.45 ? P[4] : d < L * 0.8 ? P[3] : P[2], a);
  }
  stip(ctx, x - 1, y - 1, 3, 3, P[4], a);
}

// Where a tile's floor is on screen (top left), and its middle.
function floorOf(r, x, y, z) {
  const s = r.worldToScreen(x, y - 1, z);
  return { x: s.x, y: s.y, cx: s.x + 8, cy: s.y + 8 };
}
// A way in the world, as a unit step on screen.
function screenDir(r, dx, dz) {
  const [u, v] = r.toView(dx, dz);
  const l = Math.hypot(u, v) || 1;
  return [u / l, v / l];
}

// ------------------------------------------------------------ coming
// (Round 142) The ground it will cover, as its shapes (see specials.js: a
// circle, a slice of one, a long strip, at the angle it's aimed), not
// squares. In whole pixels as before: cells two pixels across, lit where
// their middles fall within it, stippled denser as it winds up and filling
// out from the one winding it; its outline marching while it winds and
// flashing white once it's ready; a line within it where it lands harder
// (a hammer's shock, its heart and its edge).
const CELL = 2;
function drawShapes(r, ctx, shapes, x0, z0, y, a, fr, P) {
  const me = floorOf(r, x0, y, z0);
  const far = shapesReach(shapes, x0, z0);
  const ready = a >= 1;
  // Where on the screen it could be: round each shape, a square's margin.
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  for (const sh of shapes) {
    if (sh.t === 'go' || !sh.w) continue;
    const reach = (sh.t === 'box' ? sh.len + sh.hw : sh.r) + 0.5;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const c = floorOf(r, sh.x + ox * reach, y, sh.z + oz * reach);
      sx0 = Math.min(sx0, c.cx);
      sx1 = Math.max(sx1, c.cx);
      sy0 = Math.min(sy0, c.cy);
      sy1 = Math.max(sy1, c.cy);
    }
  }
  if (sx0 === Infinity) return;
  sx0 = Math.floor(sx0 / CELL) * CELL;
  sy0 = Math.floor(sy0 / CELL) * CELL;
  const cols = Math.ceil((sx1 - sx0) / CELL) + 2;
  const rows = Math.ceil((sy1 - sy0) / CELL) + 2;
  if (cols * rows > 40000) return;
  const W = new Float32Array(cols * rows);
  const D = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const sx = sx0 + i * CELL + CELL / 2;
      const sy = sy0 + j * CELL + CELL / 2;
      const [dx, dz] = r.toWorld((sx - me.cx) / 16, (sy - me.cy) / 16);
      const k = j * cols + i;
      W[k] = shapesAt(shapes, x0 + dx, z0 + dz);
      D[k] = Math.hypot(dx, dz);
    }
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? 0 : W[j * cols + i]);
  const edge = ready ? (fr % 2 ? P[4] : P[3]) : P[3];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const w = W[k];
      if (!w) continue;
      const x = sx0 + i * CELL;
      const yy = sy0 + j * CELL;
      // (Filling out from them as it winds up.)
      const lit = Math.max(0, Math.min(1, a * (far + 0.6) - (D[k] - 1)));
      stip(ctx, x, yy, CELL, CELL, P[0], 0.12);
      stip(ctx, x, yy, CELL, CELL, P[1], (0.2 + 0.34 * lit) * (0.6 + 0.4 * w));
      if (lit > 0.4) stip(ctx, x, yy, CELL, CELL, P[2], (lit - 0.4) * 0.75 * w);
      // Its edge (and the line where it lands harder within it).
      const rim = at(i - 1, j) < w || at(i + 1, j) < w || at(i, j - 1) < w || at(i, j + 1) < w;
      if (!rim) continue;
      const outer = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      if (!ready && (i + j + fr) % 4 >= 2) continue;
      stip(ctx, x, yy, CELL, CELL, outer ? edge : P[2], outer ? (ready ? 1 : 0.35 + 0.65 * lit) : 0.5 + 0.5 * lit);
    }
  }
}

// The warning, for each of you winding one up.
export function drawSpecialTele(r, ctx, game) {
  const list = game.netPlayers || (game.everyone ? game.everyone() : [game.player]);
  const fr = frame(r.time || 0);
  for (const p of list) {
    const s = p && p.spec;
    if (!s || p.dead || !SPECIALS[s.k]) continue;
    const P = palOf(s.k);
    const y = s.y ?? p.y;
    const px0 = R(p.x);
    const pz0 = R(p.z);
    const at = s.tx !== undefined && s.tx !== null ? { x: s.tx, z: s.tz } : null;
    const ang = typeof s.ang === 'number' ? s.ang : Math.atan2(s.dz ?? 1, s.dx ?? 0);
    const shapes = specialShapes(s.k, px0, pz0, ang, at);
    const a = s.a || 0;
    const ready = a >= 1;
    const me = floorOf(r, px0, y, pz0);
    // (Only a way, hurting no one: a step through the shadows with no one
    // to step behind. Shown all the same, a little fainter.)
    drawShapes(r, ctx, shapes.map((sh) => (sh.t === 'box' && !sh.w ? { ...sh, w: 0.5 } : sh)), px0, pz0, y, a, fr, P);
    for (const sh of shapes) {
      if (sh.t !== 'go') continue;
      // Where they'll be: a dotted line there and a diamond, pulsing.
      const g = floorOf(r, sh.x, y, sh.z);
      const lit = Math.max(0, Math.min(1, a * 1.6));
      for (let i = 2; i < 30; i += 3) {
        const k = i / 30;
        px(ctx, me.cx + (g.cx - me.cx) * k, me.cy + (g.cy - me.cy) * k, P[3], 0.4 + 0.6 * lit);
      }
      const sz = 3 + (fr % 4 < 2 ? 1 : 0) + (ready ? 1 : 0);
      for (let i = -sz; i <= sz; i++) {
        const w = sz - Math.abs(i);
        line(ctx, g.cx - w, g.cy + i, g.cx + w, g.cy + i, Math.abs(i) === sz || w === 0 ? P[4] : P[2], ready ? 1 : 0.5 + 0.5 * lit);
      }
    }
    // A ring of pips round their feet, lit one by one as it winds up.
    const rp = p.renderPos ? p.renderPos() : p;
    const f = r.worldToScreen(rp.x, rp.y - 1, rp.z);
    const n = Math.floor(a * 8 + 0.001);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * TAU - Math.PI / 2;
      const on = i < n;
      const c = ready ? (fr % 2 ? P[4] : P[3]) : on ? P[3] : P[0];
      px(ctx, f.x + 8 + Math.cos(t) * 8, f.y + 9 + Math.sin(t) * 3.5, c, on || ready ? 1 : 0.5);
      if (on) px(ctx, f.x + 8 + Math.cos(t) * 8, f.y + 8 + Math.sin(t) * 3.5, P[2]);
    }
  }
}

// ------------------------------------------------------------ loosed
// Each special's look (`f`: the effect: its kind, where from (wx, wz),
// which way (dx, dz), where to (tx, tz), its colour).
export function drawSpecialFx(r, ctx, f, k) {
  const kind = String(f.type).slice(3);
  const fn = FX[kind];
  if (!fn) return false;
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    fn(r, ctx, f, k, palOf(kind, f));
  } finally {
    ctx.restore();
  }
  return true;
}

const fromOf = (r, f) => floorOf(r, f.wx, f.wy ?? 0, f.wz);
const toOf = (r, f) => floorOf(r, f.tx ?? f.wx, f.wy ?? 0, f.tz ?? f.wz);
const aheadOf = (r, f, n = 1) => floorOf(r, f.wx + (f.dx || 0) * n, f.wy ?? 0, f.wz + (f.dz || 0) * n);

const FX = {
  // Wound up: a ring of pips flung out round you, and a flash.
  ready(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const e = ease(k);
    const a = fadeOut(k, 0.35);
    band(ctx, c.cx, c.cy + 2, 5 + 13 * e, (5 + 13 * e) * 0.45, P, a * 0.8);
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * TAU + frame(f.t) * 0.2;
      const rx = 6 + 14 * e;
      px(ctx, c.cx + Math.cos(t) * rx, c.cy - 8 + Math.sin(t) * rx * 0.5, i % 3 ? P[3] : P[4], a);
    }
    if (k < 0.4) burst(ctx, c.cx, c.cy - 16, R(3 + 4 * (1 - k / 0.4)), P);
  },
  // The shoulder: a jolt of dust and speed lines, and a burst where it lands.
  shove(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const h = aheadOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    const a = fadeOut(k, 0.4);
    for (let i = -1; i <= 1; i++) {
      const ox = -uy * i * 5;
      const oy = ux * i * 4;
      line(ctx, c.cx - ux * 14 + ox, c.cy - 6 - uy * 14 + oy, c.cx - ux * (4 + 10 * k) + ox, c.cy - 6 - uy * (4 + 10 * k) + oy, i ? P[2] : P[3], a);
    }
    const g = ease(Math.min(1, k * 2.4));
    burst(ctx, h.cx - ux * 4, h.cy - 8, R(3 + 6 * g), P, a);
    band(ctx, h.cx, h.cy + 1, 3 + 10 * g, (3 + 10 * g) * 0.45, P, fadeOut(k, 0.25));
    for (let i = 0; i < 4; i++) blob(ctx, h.cx + ux * 8 * k + (i - 1.5) * 5, h.cy + 2 + uy * 8 * k - 4 * k, 2 + R(k * 4), i % 2 ? P[1] : P[2], 0.6 * a);
  },
  // Smoke where you were and where you are; a cut from the shadows.
  shadow(r, ctx, f, k, P) {
    const a0 = fromOf(r, f);
    const b = toOf(r, f);
    const a = fadeOut(k, 0.35);
    const n = 18;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      if (t > k * 2.5) break;
      const wv = Math.sin(t * 9 + frame(f.t)) * 3;
      px(ctx, a0.cx + (b.cx - a0.cx) * t, a0.cy - 8 + (b.cy - a0.cy) * t + wv, P[i % 2 ? 1 : 3], a);
      px(ctx, a0.cx + (b.cx - a0.cx) * t, a0.cy - 7 + (b.cy - a0.cy) * t + wv, P[0], a * 0.6);
    }
    for (const [c, s] of [[a0, 1], [b, 0.8]]) {
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU + f.seed;
        blob(ctx, c.cx + Math.cos(t) * (4 + 8 * k), c.cy - 8 + Math.sin(t) * 4 - 8 * k, R(3 + 2 * s * (1 - k)), i % 2 ? P[0] : P[1], 0.75 * a * s);
      }
    }
    // (The blade: a cross cut on whoever was between.)
    const [hx, hz] = heading((f.wx ?? 0) - (f.tx ?? 0), (f.wz ?? 0) - (f.tz ?? 0));
    const t = floorOf(r, (f.tx ?? f.wx) + hx, f.wy ?? 0, (f.tz ?? f.wz) + hz);
    if (k > 0.08) {
      const kk = ease(Math.min(1, (k - 0.08) * 5));
      const fa = fadeOut(k, 0.5);
      glow(ctx, t.cx - 9, t.cy - 20, t.cx - 9 + 18 * kk, t.cy - 20 + 16 * kk, P, fa);
      if (k > 0.16) glow(ctx, t.cx + 9, t.cy - 20, t.cx + 9 - 18 * kk, t.cy - 20 + 16 * kk, P, fa);
      if (k > 0.2 && k < 0.5) burst(ctx, t.cx, t.cy - 12, 5, P, fa);
    }
  },
  // A streak of steel, point first, and a spark off the end.
  lunge(r, ctx, f, k, P) {
    const a0 = fromOf(r, f);
    const b = toOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    const tail = Math.min(1, k * 2.2);
    const a = fadeOut(k, 0.5);
    const sx = a0.cx + (b.cx - a0.cx) * tail * 0.6;
    const sy = a0.cy + (b.cy - a0.cy) * tail * 0.6;
    glow(ctx, sx - ux * 6, sy - 8 - uy * 6, b.cx + ux * 22, b.cy - 8 + uy * 22, P, a, 0.4);
    for (const o of [-4, 4]) line(ctx, sx - uy * o, sy - 8 + ux * o, b.cx - uy * o + ux * 6, b.cy - 8 + ux * o + uy * 6, P[2], a * 0.6);
    // (After-images of you along the way.)
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      stip(ctx, a0.cx + (b.cx - a0.cx) * t - 3, a0.cy + (b.cy - a0.cy) * t - 20, 6, 16, P[i % 2 ? 2 : 1], 0.4 * (1 - k) * (i / 3));
    }
    burst(ctx, b.cx + ux * 24, b.cy - 8 + uy * 24, R(3 + 5 * fadeOut(k, 0.15)), P, a);
  },
  // Three cuts across the front of you, one after the other.
  flurry(r, ctx, f, k, P) {
    const h = aheadOf(r, f);
    const cuts = [[-1, -1, 1, 1], [1, -1, -1, 1], [-1, 0.1, 1, -0.1]];
    for (let i = 0; i < 3; i++) {
      const t0 = i * 0.13;
      const kk = (f.t - t0) / 0.26;
      if (kk < 0 || kk > 1) continue;
      const [x0, y0, x1, y1] = cuts[i];
      const g = ease(Math.min(1, kk * 2.5));
      const a = fadeOut(kk, 0.4);
      const L = 12;
      const ax = h.cx + x0 * L;
      const ay = h.cy - 10 + y0 * L * 0.7;
      glow(ctx, ax, ay, ax + (x1 - x0) * L * g, ay + (y1 - y0) * L * 0.7 * g, P, a, 0.5);
      if (kk > 0.35) burst(ctx, h.cx + x1 * L * 0.6, h.cy - 10 + y1 * L * 0.4, 3, P, a);
    }
  },
  // Round at ankle height: a ring of wind going out, and dust.
  sweep(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const e = ease(k);
    const a = fadeOut(k, 0.45);
    const rx = 6 + 20 * e;
    band(ctx, c.cx, c.cy + 3, rx, rx * 0.42, P, a);
    const sp = frame(f.t) * 0.8;
    for (let i = 0; i < 3; i++) band(ctx, c.cx, c.cy + 1, rx * 0.75, rx * 0.32, P, a, sp + i * 2.1, sp + i * 2.1 + 1.1);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * TAU + f.seed;
      blob(ctx, c.cx + Math.cos(t) * rx, c.cy + 4 + Math.sin(t) * rx * 0.42 - 3 * k, 2 + R(2 * k), i % 2 ? P[1] : P[2], 0.55 * a);
    }
  },
  // A lance of light three paces out, and a ring at its tip.
  skewer(r, ctx, f, k, P) {
    const a0 = fromOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    const reach = 16 * 3.3 * ease(Math.min(1, k * 3.5));
    const a = fadeOut(k, 0.5);
    glow(ctx, a0.cx + ux * 6, a0.cy - 8 + uy * 6, a0.cx + ux * reach, a0.cy - 8 + uy * reach, P, a, 0.5);
    // (Its head: a spearpoint of light.)
    const tx = a0.cx + ux * reach;
    const ty = a0.cy - 8 + uy * reach;
    for (let d = 0; d < 5; d++) {
      px(ctx, tx + ux * d - uy * (4 - d) * 0.6, ty + uy * d + ux * (4 - d) * 0.6, P[3], a);
      px(ctx, tx + ux * d + uy * (4 - d) * 0.6, ty + uy * d - ux * (4 - d) * 0.6, P[3], a);
    }
    if (k > 0.25) band(ctx, tx, ty + 8, 3 + 12 * (k - 0.25), (3 + 12 * (k - 0.25)) * 0.45, P, fadeOut(k, 0.3));
    burst(ctx, tx + ux * 4, ty + uy * 4, 3, P, a);
  },
  // A line flung out to them, and drawn in.
  haul(r, ctx, f, k, P) {
    const a0 = fromOf(r, f);
    const b = toOf(r, f);
    const out = k < 0.35 ? ease(k / 0.35) : 1 - ease((k - 0.35) / 0.65) * 0.85;
    const hx = a0.cx + (b.cx - a0.cx) * out;
    const hy = a0.cy + (b.cy - a0.cy) * out;
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * 4 * (1 - out);
      const x = a0.cx + (hx - a0.cx) * t;
      const y = a0.cy - 9 + (hy - a0.cy) * t + sag;
      px(ctx, x, y, i % 3 === 0 ? P[4] : P[2]);
      px(ctx, x, y + 1, P[0], 0.7);
    }
    // (The hook: a barbed head on the end of it.)
    stip(ctx, hx - 1, hy - 11, 3, 3, P[4], 1);
    for (const [ox, oy, c] of [[2, -8, 3], [2, -7, 3], [1, -6, 3], [0, -6, 2], [-1, -7, 2], [-2, -8, 3], [-2, -9, 3], [3, -9, 4]]) px(ctx, hx + ox, hy + oy, P[c]);
    if (k > 0.3 && k < 0.6) burst(ctx, b.cx, b.cy - 10, 5, P);
  },
  // From on high on the crown of the head: stars, and cracks underfoot.
  crack(r, ctx, f, k, P) {
    const h = aheadOf(r, f);
    if (k < 0.22) {
      const kk = ease(k / 0.22);
      glow(ctx, h.cx - 3, h.cy - 44, h.cx, h.cy - 44 + 32 * kk, P, 1, 0.2);
      return;
    }
    const kk = (k - 0.22) / 0.78;
    const a = fadeOut(kk, 0.4);
    burst(ctx, h.cx, h.cy - 12, R(5 + 10 * ease(Math.min(1, kk * 2))), P, fadeOut(kk, 0.25));
    band(ctx, h.cx, h.cy + 2, 4 + 16 * ease(kk), (4 + 16 * ease(kk)) * 0.45, P, a);
    // (Stars round their head.)
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TAU + frame(f.t) * 0.5;
      star(ctx, h.cx + Math.cos(t) * 8, h.cy - 26 + Math.sin(t) * 3, 2, PALS.gold, fadeOut(kk, 0.75));
    }
    for (let j = 0; j < 5; j++) {
      let x = h.cx;
      let y = h.cy + 2;
      const t0 = (j / 5) * TAU + f.seed;
      for (let s = 0; s < 9 * Math.min(1, kk * 3); s++) {
        x += Math.cos(t0 + (hash(f.seed + j, s) - 0.5)) * 2;
        y += Math.sin(t0 + (hash(f.seed + j, s) - 0.5)) * 1;
        px(ctx, x, y, P[0], a);
        px(ctx, x + 1, y, s % 3 ? P[0] : P[3], a);
      }
    }
  },
  // The axe round and round: blurred rings turning, sparks flung off them.
  whirl(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const a = fadeOut(k, 0.6);
    const fr = frame(f.t);
    for (let i = 0; i < 2; i++) {
      const rx = 15 + i * 6;
      const s0 = fr * 0.9 + i * Math.PI;
      ring(ctx, c.cx, c.cy - 4, rx, rx * 0.45, P[1], a * 0.5);
      band(ctx, c.cx, c.cy - 4, rx, rx * 0.45, P, a, s0, s0 + 2.4, 0.7);
    }
    for (let i = 0; i < 9; i++) {
      const t = hash(f.seed, i) * TAU + fr * 0.3;
      const d = 18 + 16 * k + hash(i, f.seed) * 6;
      px(ctx, c.cx + Math.cos(t) * d, c.cy - 4 + Math.sin(t) * d * 0.45, P[4], a);
      px(ctx, c.cx + Math.cos(t) * (d - 2), c.cy - 4 + Math.sin(t) * (d - 2) * 0.45, P[2], a);
    }
  },
  // The flail's head round on its chain in an arc two paces deep.
  reap(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    const base = Math.atan2(uy, ux);
    const sw = -1.2 + 2.4 * ease(Math.min(1, k * 1.8));
    const a = fadeOut(k, 0.55);
    const rad = 28;
    band(ctx, c.cx, c.cy - 6, rad, rad * 0.55, P, a, base - 1.2, base + sw, 0.6);
    const hx = c.cx + Math.cos(base + sw) * rad;
    const hy = c.cy - 6 + Math.sin(base + sw) * rad * 0.55;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      px(ctx, c.cx + (hx - c.cx) * t, c.cy - 12 + (hy + 6 - c.cy) * t, i % 2 ? P[3] : P[1], a);
    }
    // (The head: a spiked iron ball.)
    stip(ctx, hx - 3, hy - 3, 7, 7, P[1], a);
    stip(ctx, hx - 2, hy - 2, 5, 5, P[2], a);
    stip(ctx, hx - 1, hy - 2, 2, 2, P[4], a);
    for (const [ox, oy] of [[0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, 4], [4, -4], [-4, 4]]) px(ctx, hx + ox, hy + oy * 0.8, P[3], a);
  },
  // A great hewing crescent, five paces wide, at full reach.
  hew(r, ctx, f, k, P) {
    const c = fromOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    const base = Math.atan2(uy, ux);
    const span = 1.5;
    const sw = -span + 2 * span * ease(Math.min(1, k * 2));
    const a = fadeOut(k, 0.5);
    for (let i = 0; i < 3; i++) band(ctx, c.cx, c.cy - 6, 22 + i * 6, (22 + i * 6) * 0.55, P, a * (1 - i * 0.15), base - span, base + sw, 0.5);
    if (k > 0.2) for (let i = 0; i < 6; i++) {
      const tt = base - span + hash(f.seed, i) * (sw + span);
      star(ctx, c.cx + Math.cos(tt) * 34, c.cy - 6 + Math.sin(tt) * 19, 2, P, fadeOut(k, 0.5));
    }
  },
  // A leap (a dotted arc), and where you land the blade comes down and the
  // ground rings.
  cleave(r, ctx, f, k, P) {
    const a0 = fromOf(r, f);
    const b = toOf(r, f);
    const [ux, uy] = screenDir(r, f.dx, f.dz);
    if (k < 0.33) {
      const kk = k / 0.33;
      for (let i = 0; i <= 16; i++) {
        const t = (i / 16) * kk;
        const hy = Math.sin(t * Math.PI) * 20;
        px(ctx, a0.cx + (b.cx - a0.cx) * t, a0.cy - 10 + (b.cy - a0.cy) * t - hy, i % 2 ? P[2] : P[4]);
      }
      return;
    }
    const kk = (k - 0.33) / 0.67;
    const a = fadeOut(kk, 0.45);
    const fx = b.cx + ux * 12;
    const fy = b.cy + uy * 12;
    if (kk < 0.35) glow(ctx, fx, fy - 48, fx, fy - 48 + 42 * ease(kk / 0.35), P, 1, 0.15);
    burst(ctx, fx, fy - 6, R(4 + 10 * ease(Math.min(1, kk * 2))), P, fadeOut(kk, 0.3));
    const rx = 4 + 30 * ease(kk);
    band(ctx, b.cx + ux * 6, b.cy + uy * 6, rx, rx * 0.45, P, a);
    for (let i = 0; i < 12; i++) {
      const t = hash(f.seed, i) * TAU;
      const d = rx * (0.4 + hash(i, f.seed) * 0.6);
      px(ctx, fx + Math.cos(t) * d, fy - 4 + Math.sin(t) * d * 0.45 - 14 * kk, P[i % 2 ? 2 : 4], a);
    }
    for (let j = 0; j < 3; j++) {
      let x = fx;
      let y = fy;
      const t0 = Math.atan2(uy, ux) + (j - 1) * 0.5;
      for (let s = 0; s < 10 * Math.min(1, kk * 3); s++) {
        x += Math.cos(t0 + (hash(f.seed + j, s) - 0.5) * 0.8) * 2;
        y += Math.sin(t0 + (hash(f.seed + j, s) - 0.5) * 0.8) * 1;
        px(ctx, x, y, P[0], a);
        px(ctx, x, y - 1, s % 2 ? P[2] : P[3], a);
      }
    }
  },
  // The hammer down: the ground split all round, the shock going out.
  quake(r, ctx, f, k, P) {
    const c = aheadOf(r, f);
    const a = fadeOut(k, 0.55);
    const g = ease(Math.min(1, k * 2.2));
    // (Cracks running out from it, a glow deep in them.)
    for (let j = 0; j < 10; j++) {
      let x = c.cx;
      let y = c.cy;
      const t0 = (j / 10) * TAU + hash(f.seed, j);
      const len = R((14 + hash(j, f.seed) * 14) * g);
      for (let s = 0; s < len; s++) {
        const w = (hash(f.seed + j * 7, s) - 0.5) * 1.2;
        x += Math.cos(t0 + w) * 1.8;
        y += Math.sin(t0 + w) * 0.9;
        px(ctx, x, y, P[0], a);
        px(ctx, x + 1, y, P[0], a * 0.8);
        if (s % 2 === 0) px(ctx, x, y - 1, s < len * 0.6 ? PALS.fire[3] : P[3], a * (1 - s / len));
      }
    }
    for (let i = 0; i < 3; i++) {
      const kk = Math.max(0, k * 1.6 - i * 0.22);
      if (kk <= 0 || kk >= 1) continue;
      const rx = 6 + 40 * ease(kk);
      band(ctx, c.cx, c.cy, rx, rx * 0.45, P, fadeOut(kk, 0.4));
    }
    if (k < 0.35) burst(ctx, c.cx, c.cy - 6, R(5 + 9 * (1 - k / 0.35)), P);
    for (let i = 0; i < 14; i++) {
      const t = hash(f.seed, i + 20) * TAU;
      const d = 6 + 28 * g * (0.5 + hash(i, 3));
      const up = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (8 + 14 * hash(i, 9));
      stip(ctx, c.cx + Math.cos(t) * d, c.cy + Math.sin(t) * d * 0.45 - up, 3, 3, P[1], a);
      stip(ctx, c.cx + Math.cos(t) * d, c.cy + Math.sin(t) * d * 0.45 - up, 2, 2, i % 2 ? P[2] : P[3], a);
    }
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TAU + f.seed;
      blob(ctx, c.cx + Math.cos(t) * 20 * g, c.cy + Math.sin(t) * 9 * g - 6 * k, 3 + R(3 * k), i % 2 ? P[1] : P[2], 0.45 * a);
    }
  },
};
export const SPECIAL_FX = Object.keys(FX);
