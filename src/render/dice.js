// Dice: small cubes thrown onto a table (or the floor), with a little
// physics. Each has a position, a speed and a real 3D orientation; it flies,
// bounces, tumbles and rolls, tips over onto its nearest face and comes to
// rest showing the number the thrower rolled. They're drawn as shaded cubes
// (the faces you can see from the camera, with their pips), pixel by pixel,
// in depth order with the world like anyone standing there (see
// Renderer.diceDecos), so a wall or a person in front hides them.
import { TILE, LH } from '../config.js';

const SIZE = 0.24; // edge, in tiles (about 4 pixels)
const HALF = SIZE / 2;
const GRAVITY = 14; // layers per second per second
const K = LH / TILE; // how much of a vertical step shows on screen, per tile of depth
// Which number is on which side (opposite sides add up to seven): +x, -x, +y, -y, +z, -z.
const LABELS = [[3, 4], [1, 6], [2, 5]];
// Pips on a face, on a 3x3 grid.
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

const col = (R, i) => [R[0][i], R[1][i], R[2][i]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Turn R by `ang` about the (unit) world axis `ax`.
function rotate(R, ax, ang) {
  if (!ang) return R;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const t = 1 - c;
  const [x, y, z] = ax;
  const M = [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
  const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i][j] = M[i][0] * R[0][j] + M[i][1] * R[1][j] + M[i][2] * R[2][j];
  return orthonormal(out);
}

// (Keep it a proper rotation as the small errors add up.)
function orthonormal(R) {
  let a = col(R, 0);
  let b = col(R, 1);
  const la = len(a);
  a = a.map((v) => v / la);
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  b = b.map((v, i) => v - d * a[i]);
  const lb = len(b);
  b = b.map((v) => v / lb);
  const c = cross(a, b);
  return [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]];
}

// How far the cube reaches below its centre, as it's turned.
const support = (R) => HALF * (Math.abs(R[1][0]) + Math.abs(R[1][1]) + Math.abs(R[1][2]));

// The side facing most nearly down: [axis, sign, how far down it points].
function lowest(R) {
  let best = null;
  for (let i = 0; i < 3; i++) for (const sg of [1, -1]) {
    const ny = sg * R[1][i];
    if (!best || ny < best[2]) best = [i, sg, ny];
  }
  return best;
}

function randomTurn() {
  let R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < 3; i++) {
    const ax = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    const l = len(ax) || 1;
    R = rotate(R, ax.map((v) => v / l), Math.random() * Math.PI * 2);
  }
  return R;
}

// A throw: dice from the thrower's hand onto the spot.
export function throwDice(from, to, faces) {
  const out = [];
  const n = faces.length;
  // Each lands a little apart, near the middle of the table.
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  const ux = dx / d;
  const uz = dz / d;
  faces.forEach((face, i) => {
    const side = (i - (n - 1) / 2) * 0.16;
    const sx = from.x + ux * 0.35 - uz * side;
    const sz = from.z + uz * 0.35 + ux * side;
    // From hand height (a touch above the table top), up and over.
    // (The hand is about where the feet are, less ten pixels.)
    const h0 = Math.max(0.3, ((from.y - to.y) * LH + (to.oy || 0)) / LH + 0.1);
    const vh = 3 + Math.random() * 1.2;
    // Time to come down onto the table, and the speed to get there (a bit
    // short of the far edge: they roll the rest of the way).
    const T = (vh + Math.sqrt(vh * vh + 2 * GRAVITY * Math.max(0, h0 - HALF))) / GRAVITY;
    const tx = to.x - ux * 0.12 - uz * side * 1.4 + (Math.random() - 0.5) * 0.12;
    const tz = to.z - uz * 0.12 + ux * side * 1.4 + (Math.random() - 0.5) * 0.12;
    const spin = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    const sl = len(spin) || 1;
    out.push({
      x: sx, z: sz, h: h0, vx: (tx - sx) / T, vz: (tz - sz) / T, vh,
      R: randomTurn(), w: spin.map((v) => (v / sl) * (14 + Math.random() * 10)),
      face, to, base: to.y, oy: to.oy || 0, cx: to.x, cz: to.z, onTable: false, grounded: false, still: false, t: 0, restT: 0, fade: 1,
    });
  });
  return out;
}

// A step of the world for every die: flight, bounces, rolling, tipping
// over onto a face, coming to rest (showing the number thrown).
export function stepDice(list, dt) {
  dt = Math.min(dt, 0.05);
  for (const d of list) {
    d.t += dt;
    if (d.still) {
      d.restT += dt;
      if (d.restT > 3.2) d.fade = Math.max(0, 1 - (d.restT - 3.2) / 0.4);
      continue;
    }
    // Moving.
    d.x += d.vx * dt;
    d.z += d.vz * dt;
    // The table's edges keep them on it (once they're over it).
    const lim = 0.5 - HALF;
    const inX = Math.abs(d.x - d.cx) <= lim;
    const inZ = Math.abs(d.z - d.cz) <= lim;
    if (inX && inZ) d.onTable = true;
    if (d.onTable) {
      if (!inX) {
        d.x = d.cx + Math.sign(d.x - d.cx) * lim;
        d.vx *= -0.4;
      }
      if (!inZ) {
        d.z = d.cz + Math.sign(d.z - d.cz) * lim;
        d.vz *= -0.4;
      }
    }
    const sup = support(d.R);
    if (!d.grounded) {
      d.vh -= GRAVITY * dt;
      d.h += d.vh * dt;
      d.R = rotate(d.R, d.w.map((v) => v / (len(d.w) || 1)), len(d.w) * dt);
      if (d.h - sup <= 0 && d.vh < 0 && d.onTable) {
        // A bounce (and a clatter of spin from it).
        d.h = sup;
        d.vh = -d.vh * 0.35;
        d.vx *= 0.7;
        d.vz *= 0.7;
        d.w = d.w.map((v) => v * 0.6);
        d.bounced = (d.bounced || 0) + 1;
        if (d.vh < 0.9) {
          d.vh = 0;
          d.grounded = true;
        }
      }
      continue;
    }
    // On the table: rolling, slowing, tipping onto the face it's nearest.
    const f = Math.exp(-3.2 * dt);
    d.vx *= f;
    d.vz *= f;
    const sp = Math.hypot(d.vx, d.vz);
    if (sp > 0.02) {
      const ax = [d.vz / sp, 0, -d.vx / sp];
      d.R = rotate(d.R, ax, (sp / HALF) * dt * 0.8);
    }
    const [i, sg, ny] = lowest(d.R);
    const n = col(d.R, i).map((v) => v * sg);
    const tip = Math.acos(Math.max(-1, Math.min(1, -ny)));
    if (tip > 0.002) {
      const ax = cross(n, [0, -1, 0]);
      const l = len(ax);
      if (l > 1e-6) d.R = rotate(d.R, ax.map((v) => v / l), Math.min(tip, (3 + tip * 10) * dt));
    }
    d.h = support(d.R);
    if (sp < 0.06 && tip < 0.01) settle(d);
  }
}

// Flat on a face: square it up, and the number thrown on top.
function settle(d) {
  const R = d.R.map((r) => r.map((v) => (Math.abs(v) > 0.5 ? Math.sign(v) : 0)));
  d.R = R;
  d.h = HALF;
  d.vx = 0;
  d.vz = 0;
  d.still = true;
  // Which side is up, and the numbers moved round so it's the one thrown.
  let up = null;
  for (let i = 0; i < 3; i++) if (R[1][i]) up = [i, R[1][i] > 0 ? 0 : 1];
  const labels = LABELS.map((p) => p.slice());
  const top = labels[up[0]][up[1]];
  if (top !== d.face) {
    // Swap the thrown number (and its opposite) into place.
    for (const p of labels) for (let k = 0; k < 2; k++) {
      if (p[k] === d.face) p[k] = top;
      else if (p[k] === top) p[k] = d.face;
      else if (p[k] === 7 - d.face) p[k] = 7 - top;
      else if (p[k] === 7 - top) p[k] = 7 - d.face;
    }
  }
  d.labels = labels;
}

// Draw one die at its place on screen. `toView` turns world offsets into
// the camera's; (u, v) is its square in view coordinates.
export function drawDie(ctx, d, u, v, camX, camY, toView) {
  const labels = d.labels || LABELS;
  const sy0 = v * TILE - d.base * LH + LH + d.oy - camY;
  const sx0 = u * TILE + 8 - camX;
  const proj = (p) => {
    const [du, dv] = toView(p[0], p[2]);
    return [sx0 + du * TILE, sy0 + dv * TILE - (d.h + p[1]) * LH];
  };
  ctx.globalAlpha = d.fade;
  // A shadow on the table under it.
  const lift = Math.max(0, d.h - HALF);
  const sw = Math.max(2, Math.round(5 - lift * 4));
  ctx.fillStyle = `rgba(20,12,8,${Math.max(0.12, 0.4 - lift * 0.5)})`;
  ctx.fillRect(Math.round(sx0 - sw / 2), Math.round(sy0 - 1), sw, 2);
  // The sides you can see from here.
  const faces = [];
  for (let i = 0; i < 3; i++) for (const sg of [1, -1]) {
    const n = col(d.R, i).map((x) => x * sg);
    const [nu, nv] = toView(n[0], n[2]);
    void nu;
    const facing = n[1] + nv * K;
    if (facing <= 0.02) continue;
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    const c = n.map((x) => x * HALF);
    const a = col(d.R, j).map((x) => x * HALF);
    const b = col(d.R, k).map((x) => x * HALF);
    const pts = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([p, q]) => proj([c[0] + a[0] * p + b[0] * q, c[1] + a[1] * p + b[1] * q, c[2] + a[2] * p + b[2] * q]));
    faces.push({ pts, facing, ny: n[1], label: labels[i][sg > 0 ? 0 : 1], c, a, b });
  }
  // Dark edges first (each side a touch bigger), then the sides.
  for (const f of faces) fillQuad(ctx, f.pts, '#2a1e14', 0.55);
  for (const f of faces) {
    const lit = Math.round(200 + 44 * Math.max(0, f.ny) + 10 * f.facing);
    ctx.fillStyle = `rgb(${Math.min(250, lit + 6)},${Math.min(244, lit)},${Math.min(228, lit - 16)})`;
    fillQuad(ctx, f.pts, null, 0);
    // The pips (on sides turned well toward you).
    if (f.facing < 0.4) continue;
    ctx.fillStyle = f.label === 1 ? '#b02a2a' : '#2a1e14';
    for (const [p, q] of PIPS[f.label]) {
      const w = [f.c[0] + (f.a[0] * p + f.b[0] * q) * 0.55, f.c[1] + (f.a[1] * p + f.b[1] * q) * 0.55, f.c[2] + (f.a[2] * p + f.b[2] * q) * 0.55];
      const [px, py] = proj(w);
      ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// Fill the pixels inside a convex four-sided shape (crisp, no blur), grown
// by `grow` pixels for an outline.
function fillQuad(ctx, pts, color, grow) {
  if (color) ctx.fillStyle = color;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - grow);
  const x1 = Math.ceil(Math.max(...xs) + grow);
  const y0 = Math.floor(Math.min(...ys) - grow);
  const y1 = Math.ceil(Math.max(...ys) + grow);
  // (Which way round the corners go.)
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 4];
    area += ax * by - bx * ay;
  }
  const s = area >= 0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let ok = true;
      for (let i = 0; i < 4 && ok; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % 4];
        const ex = bx - ax;
        const ey = by - ay;
        const l = Math.hypot(ex, ey) || 1;
        // Signed distance from the edge (inside positive).
        if ((s * (ex * (py - ay) - ey * (px - ax))) / l < -grow - 0.0001) ok = false;
      }
      if (ok) ctx.fillRect(x, y, 1, 1);
    }
  }
}

export { SIZE as DIE_SIZE };
