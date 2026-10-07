// What moves on the masters of the old places by itself, worked out fresh
// every frame rather than painted frame by frame (see bossbody.js): parts
// cut free of the body (wings, jaws, lids, tentacles, a head on a long
// neck) turned smoothly about their hinges; a serpent's body as a train of
// segments, each following the one ahead along the way it went; chains
// that hang and swing and pull taut between a collar and a ring in the
// floor; cloaks and hair that trail and flutter as their wearer moves.
//   Parts are painted once (with the sculptor's kit: see sculpt.js) and
// turned pixel for pixel (no blur) at 64 steps, so they stay crisp
// pixel art at any angle.
import { Px, hex, mix, shade } from './pixel.js';
import { outlineSel } from './people.js';
import { TILE, LH } from '../config.js';

const TAU = Math.PI * 2;
const STEPS = 64;

function toCanvas(p) {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  c.getContext('2d').putImageData(p.toImageData(), 0, 0);
  return c;
}

// ------------------------------------------------------------ turning
// A part's picture put through `m` ([a, b, c, d]: a point dx, dy from
// its pivot (px, py) goes to a dx + b dy, c dx + d dy), nearest pixel
// (crisp), and outlined after (so the line stays one pixel). Returns
// { img, ox, oy } (the pivot's place in the new one).
export function warp(src, px, py, m, outline = true) {
  const [a, b, c, d] = m;
  const det = a * d - b * c || 1e-6;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  // (Its bounds, about the pivot.)
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of [[0, 0], [src.w, 0], [0, src.h], [src.w, src.h]]) {
    const dx = x - px;
    const dy = y - py;
    const rx = a * dx + b * dy;
    const ry = c * dx + d * dy;
    x0 = Math.min(x0, rx);
    x1 = Math.max(x1, rx);
    y0 = Math.min(y0, ry);
    y1 = Math.max(y1, ry);
  }
  const ox = Math.ceil(-x0) + 1;
  const oy = Math.ceil(-y0) + 1;
  const W = Math.ceil(x1 - x0) + 3;
  const H = Math.ceil(y1 - y0) + 3;
  const out = new Px(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const sx = Math.floor(ia * dx + ib * dy + px);
      const sy = Math.floor(ic * dx + id * dy + py);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const v = src.get(sx, sy);
      if (v[3]) out.set(x, y, [v[0], v[1], v[2]], v[3]);
    }
  }
  if (outline) outlineSel(out);
  return { img: typeof document !== 'undefined' ? toCanvas(out) : null, px: out, ox, oy };
}
// Turned by `ang` about its pivot.
export function turn(src, px, py, ang, outline = true) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return warp(src, px, py, [c, -s, s, c], outline);
}

// A part kept turned at every step (made as it's first wanted).
export class Part {
  constructor(paint, px, py, o = {}) {
    this.paint = paint;
    this.pivot = [px, py];
    this.cache = new Map();
    this.outline = o.outline !== false;
    this.src = null;
  }
  at(ang) {
    const k = ((Math.round((ang / TAU) * STEPS) % STEPS) + STEPS) % STEPS;
    let v = this.cache.get(k);
    if (v) return v;
    if (!this.src) this.src = this.paint();
    v = turn(this.src, this.pivot[0], this.pivot[1], (k / STEPS) * TAU, this.outline);
    this.cache.set(k, v);
    return v;
  }
  // Draw it with its pivot at (x, y), turned `ang` (and, `flip`, the way
  // the master faces: mirrored).
  draw(ctx, x, y, ang, flip = false, alpha = 1) {
    const v = this.at(flip ? -ang : ang);
    if (!v.img) return;
    const a = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = a * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v.img, -v.ox, Math.round(y) - v.oy);
      ctx.restore();
    } else ctx.drawImage(v.img, Math.round(x) - v.ox, Math.round(y) - v.oy);
    ctx.globalAlpha = a;
  }
  // Turned `ang` and squeezed (`sx` across, `sy` up and down: a wing
  // seen edge on as it beats), each kept at 64 turns and 24 squeezes a
  // way (each warped pixel for pixel and outlined: no blur).
  squeezed(ang, sx, sy) {
    const q = (s) => {
      const v = Math.round(Math.max(-1, Math.min(1, s)) * 12);
      return v === 0 ? (s < 0 ? -1 : 1) : v;
    };
    const k = ((Math.round((ang / TAU) * STEPS) % STEPS) + STEPS) % STEPS;
    const kx = q(sx);
    const ky = q(sy);
    const key = `${k}|${kx}|${ky}`;
    let v = this.cache.get(key);
    if (v) return v;
    if (!this.src) this.src = this.paint();
    const a = (k / STEPS) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const fx = kx / 12;
    const fy = ky / 12;
    v = warp(this.src, this.pivot[0], this.pivot[1], [c * fx, -s * fy, s * fx, c * fy], this.outline);
    this.cache.set(key, v);
    return v;
  }
  // Drawn squeezed across (a wing beating, seen edge on as it comes up):
  // `sx` its width (1 flat out, 0 edge on, negative over the top), turned
  // `ang` first.
  flap(ctx, x, y, ang, sx, flip = false, alpha = 1) {
    const v = this.squeezed(flip ? -ang : ang, flip ? -sx : sx, 1);
    if (!v.img) return;
    const a = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = a * alpha;
    ctx.drawImage(v.img, Math.round(x) - v.ox, Math.round(y) - v.oy);
    ctx.globalAlpha = a;
  }
  // Drawn squeezed up and down about its hinge (a wing seen from the side
  // as it beats: full out at the top of the stroke, edge on, then under).
  flapY(ctx, x, y, ang, sy, alpha = 1) {
    const v = this.squeezed(ang, 1, sy);
    if (!v.img) return;
    const a = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = a * alpha;
    ctx.drawImage(v.img, Math.round(x) - v.ox, Math.round(y) - v.oy);
    ctx.globalAlpha = a;
  }
}

// ------------------------------------------------------------ the world
// Where a point of the world (x, z in paces, y in layers, fractions and
// all) is on screen, as an entity's feet would be drawn there.
// (Round 71: while a master's drawn bigger or smaller than it was painted
// (see bosstex.js), what of it lies in the world, a serpent's coils, a
// chain to its stake, is drawn in toward its feet to match, so that
// scaled up with the rest of it it lies where it is.)
let worldMap = null;
export function mapWorld(ax, ay, k) {
  worldMap = k && Math.abs(k - 1) > 1e-3 ? { ax, ay, k } : null;
}
export function onScreen(r, x, y, z) {
  const [u, v] = r.toView(x, z);
  const sx = u * TILE - r.camX + 8;
  const sy = v * TILE - y * LH + LH + 10 - r.camY;
  if (!worldMap) return { x: sx, y: sy };
  const m = worldMap;
  return { x: m.ax + (sx - m.ax) / m.k, y: m.ay + (sy - m.ay) / m.k };
}

// ------------------------------------------------------------ chains
// A chain (or a rope, a tendril, a strand of kelp): links that hang and
// swing (Verlet), held at one end or both. In the world: x and z in
// paces, y in paces up from the floor (a layer is three quarters of one).
export class Rope {
  constructor(n, len, from, to = null) {
    this.n = n;
    this.len = len;
    this.p = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const b = to || { x: from.x + n * len * 0.7, y: 0, z: from.z };
      const x = from.x + (b.x - from.x) * k;
      const y = from.y + (b.y - from.y) * k;
      const z = from.z + (b.z - from.z) * k;
      this.p.push({ x, y, z, px: x, py: y, pz: z });
    }
  }
  // A step of `dt`: gravity, a little drag, the floor; then the links
  // held to their length (and the ends to where they're held).
  step(dt, a, b = null, o = {}) {
    const g = o.gravity ?? 22;
    const drag = o.drag ?? 0.985;
    const floor = o.floor ?? 0;
    const dt2 = Math.min(dt, 1 / 30) ** 2;
    const P = this.p;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      const vx = (q.x - q.px) * drag;
      const vy = (q.y - q.py) * drag;
      const vz = (q.z - q.pz) * drag;
      q.px = q.x;
      q.py = q.y;
      q.pz = q.z;
      q.x += vx + (o.wind ? o.wind.x * dt2 : 0);
      q.y += vy - g * dt2;
      q.z += vz + (o.wind ? o.wind.z * dt2 : 0);
      if (q.y < floor) {
        q.y = floor;
        // (Dragging on the floor: it doesn't slide far.)
        q.px = q.x - vx * 0.5;
        q.pz = q.z - vz * 0.5;
      }
    }
    for (let it = 0; it < (o.iters ?? 10); it++) {
      Object.assign(P[0], a);
      if (b) Object.assign(P[P.length - 1], b);
      for (let i = 0; i + 1 < P.length; i++) {
        const p = P[i];
        const q = P[i + 1];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const dz = q.z - p.z;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const f = (d - this.len) / d;
        // (Held ends don't give.)
        const wp = i === 0 ? 0 : b && i + 1 === P.length - 1 ? 1 : 0.5;
        const wq = b && i + 1 === P.length - 1 ? 0 : i === 0 ? 1 : 0.5;
        p.x += dx * f * wp;
        p.y += dy * f * wp;
        p.z += dz * f * wp;
        q.x -= dx * f * wq;
        q.y -= dy * f * wq;
        q.z -= dz * f * wq;
      }
    }
    // (Nothing pulled down through the floor.)
    for (const q of P) if (q.y < floor) q.y = floor;
    Object.assign(P[0], a);
    if (b) Object.assign(P[P.length - 1], b);
  }
  // Carried bodily, not swung: the held end moved by (dx, dy, dz) and the
  // rest along with it (less toward a far end that's held fast), keeping
  // its sway as it was. (So a camera turn that moves where it's held
  // doesn't set it whipping about.)
  carry(dx, dy, dz, heldFar = false) {
    const n = this.p.length - 1;
    this.p.forEach((q, i) => {
      const k = heldFar ? 1 - i / n : 1;
      q.x += dx * k;
      q.y += dy * k;
      q.z += dz * k;
      q.px += dx * k;
      q.py += dy * k;
      q.pz += dz * k;
    });
  }
  // How hard it's pulled (1: taut).
  taut() {
    let s = 0;
    for (let i = 0; i + 1 < this.p.length; i++) s += Math.hypot(this.p[i + 1].x - this.p[i].x, this.p[i + 1].y - this.p[i].y, this.p[i + 1].z - this.p[i].z);
    const P = this.p;
    const span = Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y, P[P.length - 1].z - P[0].z);
    return span / Math.max(1e-6, s);
  }
  // Its links on screen (in order), each with the way it runs; `base` the
  // layer its floor is on.
  screen(r, base) {
    return this.p.map((q) => onScreen(r, q.x, base + q.y / 0.75, q.z));
  }
}

// Iron links, each an oval seen face on or edge on by turns, along the
// chain's screen points; `col` the iron's colour.
const LINKS = new Map();
function linkPart(col, face) {
  const key = `${col}|${face}`;
  let p = LINKS.get(key);
  if (p) return p;
  p = new Part(() => {
    const px = new Px(7, 5);
    const c = hex(col);
    if (face) {
      // An oval ring seen face on: lit top, dark under.
      for (const [x, y, k] of [[1, 1, 1.2], [2, 0, 1.35], [3, 0, 1.35], [4, 0, 1.3], [5, 1, 1.1], [5, 2, 0.9], [5, 3, 0.75], [4, 4, 0.6], [3, 4, 0.6], [2, 4, 0.65], [1, 3, 0.8], [1, 2, 1.0]]) px.set(x, y, shade(c, k));
    } else {
      // Edge on: a bar.
      for (let x = 1; x < 6; x++) {
        px.set(x, 2, shade(c, x < 3 ? 1.3 : 1));
        px.set(x, 3, shade(c, 0.7));
      }
    }
    return px;
  }, 3.5, 2.5);
  LINKS.set(key, p);
  return p;
}
export function drawChain(ctx, pts, col = '#7a7680', o = {}) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      linkPart(col, (i * 7 + k) % 2 === 0).draw(ctx, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, ang, false, o.alpha ?? 1);
    }
  }
}
// A soft strand (a tendril, kelp, a rope of ash): a line `w` thick,
// tapering, lit along one side.
export function drawStrand(ctx, pts, col, w0 = 2, w1 = 1, o = {}) {
  const c = hex(col);
  const hi = `rgb(${shade(c, 1.3).join(',')})`;
  const lo = `rgb(${shade(c, 0.65).join(',')})`;
  const mid = `rgb(${c.join(',')})`;
  const a0 = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = a0 * o.alpha;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const t = (i + f) / (pts.length - 1);
      const w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
      const x = Math.round(a.x + (b.x - a.x) * f);
      const y = Math.round(a.y + (b.y - a.y) * f);
      ctx.fillStyle = lo;
      ctx.fillRect(x - (w >> 1), y, w, 1 + (w > 2 ? 1 : 0));
      ctx.fillStyle = mid;
      ctx.fillRect(x - (w >> 1), y, Math.max(1, w - 1), 1);
      ctx.fillStyle = hi;
      ctx.fillRect(x - (w >> 1), y, 1, 1);
    }
  }
  ctx.globalAlpha = a0;
}

// ------------------------------------------------------------ trains
// A body that follows its head (a serpent, a worm, an eel): the way the
// head has come, kept as a trail on the ground, the segments strung out
// along it `gap` paces apart; where the trail's too short (it's only just
// come, or stood still), it lies back the way the head faces, in a curve
// that sways as it breathes.
export class Train {
  constructor(n, gap) {
    this.n = n;
    this.gap = gap;
    this.trail = [];
  }
  // Mark where the head is (in paces); the trail kept as long as needed.
  mark(x, z) {
    const T = this.trail;
    const last = T[0];
    if (!last || Math.hypot(x - last.x, z - last.z) > 0.08) T.unshift({ x, z });
    let len = 0;
    for (let i = 1; i < T.length; i++) {
      len += Math.hypot(T[i].x - T[i - 1].x, T[i].z - T[i - 1].z);
      if (len > this.gap * (this.n + 2)) {
        T.length = i + 1;
        break;
      }
    }
  }
  // Each segment's place (x, z in paces) and the way it lies (in paces,
  // the direction toward the one ahead); `back` the way to lie when the
  // trail runs out; `sway(i, t)` how far each strays to the side.
  points(back, sway) {
    const T = this.trail;
    const out = [];
    let seg = 0;
    let want = 0;
    let acc = 0;
    let prev = T[0] || { x: 0, z: 0 };
    let dir = back;
    for (let i = 1; i < T.length && out.length < this.n; i++) {
      const q = T[i];
      const d = Math.hypot(q.x - prev.x, q.z - prev.z);
      while (d > 0 && acc + d >= want && out.length < this.n) {
        const f = (want - acc) / d;
        dir = { x: (q.x - prev.x) / d, z: (q.z - prev.z) / d };
        out.push({ x: prev.x + (q.x - prev.x) * f, z: prev.z + (q.z - prev.z) * f, dx: dir.x, dz: dir.z });
        seg++;
        want = seg * this.gap;
      }
      acc += d;
      prev = q;
    }
    // (Run out: lie on back the way it was going, curling.)
    let last = out.length ? out[out.length - 1] : { x: prev.x, z: prev.z, dx: back.x, dz: back.z };
    if (!out.length) out.push({ ...last, dx: back.x, dz: back.z });
    while (out.length < this.n) {
      const i = out.length;
      const a = Math.atan2(last.dz, last.dx) + 0.18;
      const nd = { x: Math.cos(a), z: Math.sin(a) };
      last = { x: last.x + nd.x * this.gap, z: last.z + nd.z * this.gap, dx: nd.x, dz: nd.z };
      out.push(last);
      void i;
    }
    if (sway) {
      for (let i = 0; i < out.length; i++) {
        const s = sway(i);
        out[i] = { ...out[i], x: out[i].x - out[i].dz * s, z: out[i].z + out[i].dx * s };
      }
    }
    return out;
  }
}

// ------------------------------------------------------------ bodies
// A body drawn whole along a curve, not stamped bead by bead (a serpent's
// length, an arm): round in section, lit as the paintings are (from up,
// left and toward you; from the right, `flip`), each pixel coloured by
// where on it it is, and outlined. `pts` its spine on screen, head first;
// `o.rad(k)` its radius (k: 0 at the head to 1 at the tail); `o.skin(k, u,
// v, ny)` its colour where it's `u` pixels along, `v` across (-1..1) and
// its surface facing `ny` down (-1 up, 1 down: its belly); `o.gloss` how
// it shines; `o.fin(k)` a fin standing up along its back there ({ h, col }
// or nothing); `o.front(x, y)` which of it is nearer you than its head.
// Returns { back, front } (each { img, x, y }, the back drawn before its
// head, the front after), worked out once a frame and kept in `cache`.
const LGT = (() => {
  const v = [-0.55, -0.68, 0.48];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
function spline(pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}
export function bodyOf(pts, o, cache = {}) {
  if (pts.length < 2) return { back: null, front: null };
  const S = spline(pts);
  // (How far along each point is, and the way it runs.)
  let len = 0;
  S[0].s = 0;
  for (let i = 1; i < S.length; i++) {
    len += Math.hypot(S[i].x - S[i - 1].x, S[i].y - S[i - 1].y);
    S[i].s = len;
  }
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 2)];
    const b = S[Math.min(S.length - 1, i + 2)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    S[i].tx = (b.x - a.x) / d;
    S[i].ty = (b.y - a.y) / d;
  }
  let maxR = 0;
  for (const q of S) {
    q.r = o.rad(len ? q.s / len : 0);
    maxR = Math.max(maxR, q.r);
  }
  const x0 = Math.floor(Math.min(...S.map((q) => q.x)) - maxR - 2);
  const y0 = Math.floor(Math.min(...S.map((q) => q.y)) - maxR - 2 - (o.fin ? 5 : 0));
  const W = Math.ceil(Math.max(...S.map((q) => q.x)) + maxR + 3) - x0;
  const H = Math.ceil(Math.max(...S.map((q) => q.y)) + maxR + 3) - y0;
  const px = new Px(W, H);
  const depth = new Float32Array(W * H).fill(-1e9);
  const side = new Uint8Array(W * H);
  const lx = o.flip ? -LGT[0] : LGT[0];
  const gloss = o.gloss ?? 0.25;
  for (let i = S.length - 1; i >= 0; i--) {
    const q = S[i];
    const k = len ? q.s / len : 0;
    const r = q.r;
    const nx = -q.ty;
    const ny = q.tx;
    const fr = o.front ? (o.front(q.x, q.y) ? 2 : 1) : 1;
    for (let j = -r; j <= r + 0.01; j += 0.5) {
      const v = Math.max(-1, Math.min(1, j / r));
      const nz = Math.sqrt(Math.max(0, 1 - v * v));
      const sx = nx * v;
      const sy = ny * v;
      const X = Math.round(q.x + nx * j - x0);
      const Y = Math.round(q.y + ny * j - y0);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      // (Nearer you: lower on the screen, and the near side of its round.)
      const dz = q.y + nz * r * 0.5;
      const at = Y * W + X;
      if (dz < depth[at]) continue;
      depth[at] = dz;
      side[at] = fr;
      const d = Math.max(0, sx * lx + sy * LGT[1] + nz * LGT[2]);
      const lum = 0.32 + 0.78 * d;
      // (A gleam where the light glances back to you.)
      const hz = 2 * d * nz - LGT[2];
      const sp = gloss * Math.pow(Math.max(0, hz), 10);
      const c = o.skin(k, q.s, v, sy);
      px.set(X, Y, [
        Math.min(255, c[0] * lum + 255 * sp),
        Math.min(255, c[1] * lum + 255 * sp),
        Math.min(255, c[2] * lum + 255 * sp),
      ]);
    }
    // (A fin along its back: thin, its rays showing.)
    const f = o.fin && o.fin(k);
    if (f && f.h >= 0.5) {
      const top = q.y - r * Math.max(0.6, Math.abs(ny));
      const c = hex(f.col);
      const ray = Math.floor(q.s / 2) % 2 ? 0.8 : 1;
      for (let j = 0; j < f.h; j++) {
        const X = Math.round(q.x - x0);
        const Y = Math.round(top - j - y0);
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const at = Y * W + X;
        if (q.y < depth[at]) continue;
        depth[at] = q.y;
        side[at] = fr;
        px.set(X, Y, shade(c, ray * (0.75 + 0.35 * (j / f.h))));
      }
    }
  }
  // (Outlined all round, each outline pixel going with what it's beside.)
  const was = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) was[i] = px.d[i * 4 + 3] ? 1 : 0;
  outlineSel(px);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const at = y * W + x;
      if (was[at] || !px.d[at * 4 + 3]) continue;
      for (const [u, w] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
        if (u >= 0 && w >= 0 && u < W && w < H && was[w * W + u]) {
          side[at] = side[w * W + u];
          break;
        }
      }
    }
  }
  const out = {};
  for (const [name, want] of [['back', 1], ['front', 2]]) {
    const part = new Px(W, H);
    let any = false;
    for (let at = 0; at < W * H; at++) {
      if (side[at] !== want || !px.d[at * 4 + 3]) continue;
      part.d.set(px.d.subarray(at * 4, at * 4 + 4), at * 4);
      any = true;
    }
    if (!any) {
      out[name] = null;
      continue;
    }
    let img = null;
    if (typeof document !== 'undefined') {
      const c = cache[name] && cache[name].width >= W && cache[name].height >= H ? cache[name] : (cache[name] = document.createElement('canvas'));
      if (c.width < W || c.height < H) {
        c.width = W + 16;
        c.height = H + 16;
      }
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.putImageData(part.toImageData(), 0, 0);
      img = c;
    }
    out[name] = { img, px: part, x: x0, y: y0, spine: S, len };
  }
  return out;
}
// Draw one side of a body (see bodyOf).
export function drawBody(ctx, b, alpha = 1) {
  if (!b || !b.img) return;
  const a = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = a * alpha;
  ctx.drawImage(b.img, b.x, b.y);
  ctx.globalAlpha = a;
}

// ------------------------------------------------------------ cloth
// A cloak (or a mane, a beard, a veil) that trails and flutters: its
// picture drawn a row at a time, each row pushed aside by a spring that
// follows how its wearer moves, more the further from where it hangs.
export class Cloth {
  constructor(rows) {
    this.rows = rows;
    this.off = new Float32Array(rows);
    this.vel = new Float32Array(rows);
  }
  // `drift`: how far its wearer's moved sideways on screen this step
  // (pixels); `t`: the time, for the breeze in it.
  step(dt, drift, t, o = {}) {
    const k = o.stiff ?? 60;
    const damp = o.damp ?? 7;
    for (let i = 0; i < this.rows; i++) {
      const f = i / Math.max(1, this.rows - 1);
      const goal = -drift * (o.trail ?? 6) * f + Math.sin(t * (o.speed ?? 2.4) - f * 3.2) * (o.breeze ?? 0.9) * f * f;
      this.vel[i] += ((goal - this.off[i]) * k - this.vel[i] * damp) * Math.min(dt, 1 / 30);
      this.off[i] += this.vel[i] * Math.min(dt, 1 / 30);
    }
  }
  // Draw it: `img` hung with its top row at (x, y).
  draw(ctx, img, x, y, flip = false) {
    const h = img.height;
    for (let row = 0; row < h; row++) {
      const i = Math.min(this.rows - 1, Math.floor((row / h) * this.rows));
      const dx = Math.round(this.off[i] * (flip ? -1 : 1));
      ctx.drawImage(img, 0, row, img.width, 1, Math.round(x) + dx, Math.round(y) + row, img.width, 1);
    }
  }
}

// ------------------------------------------------------------ painting
// Paint a part with a function of a Px (for parts painted by hand).
export function partOf(w, h, fn, px, py, o) {
  return new Part(() => {
    const p = new Px(w, h);
    fn(p);
    return p;
  }, px, py, o);
}
export { toCanvas, mix };
