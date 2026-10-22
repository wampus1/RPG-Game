// (Round 133) The forge's workshops are built and lit, not painted lit.
// Each is a little room seen in one-point perspective (its floor, walls and
// rafters running away to a point at eye height), its furniture solid
// shapes standing in it (boxes, an anvil's profile drawn out, barrels and
// stumps, lumps of coal), each pixel laid down as:
//   - what it's made of (a material: a ramp of tones, cool and dark to warm
//     and light, as brush.js makes them);
//   - its own brightness there (the texture: a stone's tone, a plank's
//     grain, wear, the dark in corners);
//   - which way it faces, and where it is in the room.
// The lights (the forge's fire, a lamp, a window's moon or sun, a bar of hot
// iron) then light it afresh each moment, as a pixel artist would light it:
//   - every tone taken from its material's ramp, never one in between, so
//     surfaces stay in flat clusters of a few tones;
//   - the light's edge on a form crisp (its terminator), dithered two pixels
//     wide only right on the seam between two tones;
//   - metal catching one hard highlight where it faces between the light
//     and the eye;
//   - each solid casting its shadow from each light (worked out once, by
//     looking from every pixel toward the light), softened at its edge;
//   - coloured light warming or cooling what it falls on, in a few steps.
// What burns or glows (flames, coals, white-hot iron, a window's sky) keeps
// its own ramp, unlit.
import { ramp, rgb } from '../render/brush.js';

export const W = 256;
export const H = 144;
export const N = W * H;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
export const bayer = (x, y) => BAYER[(x & 3) + (y & 3) * 4];

// ------------------------------------------------------------ materials
// What a surface is made of: its ramp (darkest first) and how it takes the
// light. `spec`: a hard highlight (sharper the higher `gloss`); `wrap`: how
// far round its form the light creeps; `unlit`: it shines of itself.
export const MATS = [null];
export function mat(base, o = {}) {
  const n = o.n || 8;
  const R = Array.isArray(base) ? base.map((c) => (typeof c === 'string' ? rgb(c) : c)) : ramp(base, n, { spread: o.spread ?? 0.74, shift: o.shift ?? 32 });
  MATS.push({ R, n: R.length, spec: o.spec || 0, gloss: o.gloss || 14, unlit: !!o.unlit, wrap: o.wrap ?? 0.16 });
  return MATS.length - 1;
}

// ------------------------------------------------------------ the camera
// One-point perspective: the eye at the origin looking down the room (+d),
// the vanishing point at (vx, vy) on the scene, `D` the back wall's depth
// (at which a unit of the room is a pixel).
export class Cam {
  constructor(vx, vy, D) {
    this.vx = vx;
    this.vy = vy;
    this.D = D;
  }

  // A point of the room on the scene.
  p(wx, wy, d) {
    return [this.vx + (wx * this.D) / d, this.vy + (wy * this.D) / d];
  }

  // A pixel's ray: the room's (x, y) per unit of depth.
  ax(x) {
    return (x + 0.5 - this.vx) / this.D;
  }

  ay(y) {
    return (y + 0.5 - this.vy) / this.D;
  }
}

// ------------------------------------------------------------ the buffer
export class GBuf {
  constructor(cam) {
    this.cam = cam;
    this.mat = new Uint8Array(N);
    this.val = new Float32Array(N);
    this.nx = new Int8Array(N);
    this.ny = new Int8Array(N);
    this.nz = new Int8Array(N);
    this.z = new Float32Array(N).fill(1e9);
    // (How hidden each pixel is from each of four lights: 0 to 255.)
    this.sh = new Uint8Array(N * 4);
    // (Light given off, added over all.)
    this.er = new Float32Array(N);
    this.eg = new Float32Array(N);
    this.eb = new Float32Array(N);
  }

  copy(o) {
    this.cam = o.cam;
    this.mat.set(o.mat);
    this.val.set(o.val);
    this.nx.set(o.nx);
    this.ny.set(o.ny);
    this.nz.set(o.nz);
    this.z.set(o.z);
    this.sh.set(o.sh);
    this.er.set(o.er);
    this.eg.set(o.eg);
    this.eb.set(o.eb);
    return this;
  }
}

// One pixel laid down (if nothing nearer's there): what it's made of, its
// own brightness, which way it faces (any length), how deep. Whatever hid
// it from the lights is cleared. `force`: over whatever's there.
export function put(gb, x, y, m, v, nx, ny, nz, z, force = false) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const i = y * W + x;
  if (!force && gb.z[i] < z - 0.05) return false;
  const l = Math.hypot(nx, ny, nz) || 1;
  gb.mat[i] = m;
  gb.val[i] = v;
  gb.nx[i] = Math.round((nx / l) * 127);
  gb.ny[i] = Math.round((ny / l) * 127);
  gb.nz[i] = Math.round((nz / l) * 127);
  gb.z[i] = z;
  const j = i * 4;
  gb.sh[j] = gb.sh[j + 1] = gb.sh[j + 2] = gb.sh[j + 3] = 0;
  return true;
}
// Light given off at a pixel (0..255 a channel), added.
export function emit(gb, x, y, c, a = 1) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  gb.er[i] += c[0] * a;
  gb.eg[i] += c[1] * a;
  gb.eb[i] += c[2] * a;
}
// A pixel's own brightness changed (its corners, its wear): ×k.
export function dim(gb, x, y, k) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  gb.val[y * W + x] *= k;
}

// ------------------------------------------------------------ the room
// Floor, ceiling, side walls and back wall, each pixel the nearest of them
// along its ray. `o`: fy (the floor's y below the eye), cy (the ceiling's,
// above: negative), lx, rx (the side walls' x), and what each is like:
// `fn(plane, wx, wy, d, x, y)` → [material, brightness, (nx, ny, nz)].
export function room(gb, o, fn) {
  const c = gb.cam;
  for (let y = 0; y < H; y++) {
    const ay = c.ay(y);
    for (let x = 0; x < W; x++) {
      const ax = c.ax(x);
      let d = c.D;
      let pl = 'back';
      if (ay > 0 && o.fy / ay < d) {
        d = o.fy / ay;
        pl = 'floor';
      }
      if (ay < 0 && o.cy / ay < d) {
        d = o.cy / ay;
        pl = 'ceil';
      }
      if (ax < 0 && o.lx / ax < d) {
        d = o.lx / ax;
        pl = 'left';
      }
      if (ax > 0 && o.rx / ax < d) {
        d = o.rx / ax;
        pl = 'right';
      }
      const r = fn(pl, ax * d, ay * d, d, x, y);
      if (!r) continue;
      const n = r[2] || PLANE_N[pl];
      put(gb, x, y, r[0], r[1], n[0], n[1], n[2], d, true);
    }
  }
}
const PLANE_N = { back: [0, 0, -1], floor: [0, -1, 0], ceil: [0, 1, 0], left: [1, 0, 0], right: [-1, 0, 0] };

// ------------------------------------------------------------ solids
// Each pixel whose middle is inside a polygon of the scene.
export function scan(pts, fn) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.ceil(Math.min(...ys) - 0.5));
  const y1 = Math.min(H - 1, Math.floor(Math.max(...ys) - 0.5));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) fn(x, y);
    }
  }
}

// A flat face of the room (its corners `pts`, [wx, wy, d] each), each pixel
// on it placed exactly (where its ray meets the face's plane), and given
// `fn(P, x, y)` → [material, brightness, (nx, ny, nz)].
export function face(gb, pts, fn) {
  const c = gb.cam;
  const [a, b, q] = pts;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = q[0] - a[0];
  const vy = q[1] - a[1];
  const vz = q[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  // (Turned toward the eye; a face turned away isn't seen.)
  const k = nx * a[0] + ny * a[1] + nz * a[2];
  if (k > 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const kk = nx * a[0] + ny * a[1] + nz * a[2];
  if (Math.abs(kk) < 1e-6) return;
  const proj = pts.map((p) => c.p(p[0], p[1], Math.max(0.5, p[2])));
  scan(proj, (x, y) => {
    const ax = c.ax(x);
    const ay = c.ay(y);
    const den = nx * ax + ny * ay + nz;
    if (Math.abs(den) < 1e-6) return;
    const d = kk / den;
    if (d <= 0.5) return;
    const P = [ax * d, ay * d, d];
    const r = fn(P, x, y);
    if (!r) return;
    const n = r[2] || [nx, ny, nz];
    put(gb, x, y, r[0], r[1], n[0], n[1], n[2], d);
  });
}

// A box, its sides along the room's: from (x0, y0, d0) to (x1, y1, d1).
// `fn(side, P, u, v)` (side: front, back, top, bottom, left, right; u, v
// across it 0..1) → [material, brightness, (normal)]. Kept as a solid that
// casts shadows, unless `ghost`.
export function box(gb, x0, x1, y0, y1, d0, d1, fn, sh = null) {
  const F = {
    front: [[x0, y0, d0], [x1, y0, d0], [x1, y1, d0], [x0, y1, d0]],
    top: [[x0, y0, d0], [x1, y0, d0], [x1, y0, d1], [x0, y0, d1]],
    bottom: [[x0, y1, d0], [x1, y1, d0], [x1, y1, d1], [x0, y1, d1]],
    left: [[x0, y0, d0], [x0, y0, d1], [x0, y1, d1], [x0, y1, d0]],
    right: [[x1, y0, d0], [x1, y0, d1], [x1, y1, d1], [x1, y1, d0]],
  };
  const UV = {
    front: (P) => [(P[0] - x0) / (x1 - x0), (P[1] - y0) / (y1 - y0)],
    top: (P) => [(P[0] - x0) / (x1 - x0), (P[2] - d0) / (d1 - d0)],
    bottom: (P) => [(P[0] - x0) / (x1 - x0), (P[2] - d0) / (d1 - d0)],
    left: (P) => [(P[2] - d0) / (d1 - d0), (P[1] - y0) / (y1 - y0)],
    right: (P) => [(P[2] - d0) / (d1 - d0), (P[1] - y0) / (y1 - y0)],
  };
  const N3 = { front: [0, 0, -1], top: [0, -1, 0], bottom: [0, 1, 0], left: [-1, 0, 0], right: [1, 0, 0] };
  // (Only the sides the eye can see.)
  const show = { front: d0 > 0, top: y0 > 0, bottom: y1 < 0, left: x0 > 0, right: x1 < 0 };
  for (const s of ['top', 'bottom', 'left', 'right', 'front']) {
    if (!show[s]) continue;
    face(gb, F[s], (P, x, y) => {
      const [u, v] = UV[s](P);
      const r = fn(s, P, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)), x, y);
      return r && [r[0], r[1], r[2] || N3[s]];
    });
  }
  if (sh) sh.push({ t: 'box', x0, x1, y0, y1, d0, d1 });
}

// A profile `pts` ([wx, wy] each, as seen from the front) drawn out from
// depth d0 to d1: an anvil, a hood, a bench end. `fn(side, P, i, u, x, y)`
// (side: 'front' or 'edge', i the edge, u 0..1 along it) → [material,
// brightness, (normal)].
export function extrude(gb, pts, d0, d1, fn, sh = null) {
  let A = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ex = (A > 0 ? -dy : dy) / len;
    const ey = (A > 0 ? dx : -dx) / len;
    // (A side's seen if it faces the eye.)
    if (-(ex * a[0] + ey * a[1]) <= 0) continue;
    face(gb, [[a[0], a[1], d0], [b[0], b[1], d0], [b[0], b[1], d1], [a[0], a[1], d1]], (P, x, y) => {
      const u = Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / (len * len)));
      const r = fn('edge', P, i, u, x, y, (P[2] - d0) / (d1 - d0));
      return r && [r[0], r[1], r[2] || [ex, ey, 0]];
    });
  }
  // The front: its outline, at its depth.
  const c = gb.cam;
  scan(pts.map(([x, y]) => c.p(x, y, d0)), (x, y) => {
    const P = [c.ax(x) * d0, c.ay(y) * d0, d0];
    const r = fn('front', P, -1, 0, x, y, 0);
    if (r) {
      const n = r[2] || [0, 0, -1];
      put(gb, x, y, r[0], r[1], n[0], n[1], n[2], d0);
    }
  });
  if (sh) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    sh.push({ t: 'poly', pts, d0, d1, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
}

// An upright cylinder (a barrel, a stump, a bucket): its axis at (cx, cz),
// `r` across, from y0 (its top) to y1 (its foot). `fn(part, P, a, f, x, y)`
// (part: 'side' or 'top'; a: its angle round, -1 at the left, 0 facing you,
// 1 at the right; f: 0 top to 1 foot; for its top, a and f are where on it,
// -1..1) → [material, brightness, (normal)].
export function cyl(gb, cx, cz, r, y0, y1, fn, sh = null, top = true) {
  const c = gb.cam;
  const pts = [c.p(cx - r, y0, cz - r), c.p(cx + r, y0, cz - r), c.p(cx + r, y1, cz - r), c.p(cx - r, y1, cz - r), c.p(cx - r, y0, cz + r), c.p(cx + r, y0, cz + r), c.p(cx + r, y1, cz + r), c.p(cx - r, y1, cz + r)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) {
    const ay = c.ay(y);
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
      const ax = c.ax(x);
      // Its side: where the ray first meets it.
      const A = ax * ax + 1;
      const B = -2 * (ax * cx + cz);
      const C = cx * cx + cz * cz - r * r;
      const disc = B * B - 4 * A * C;
      let hit = false;
      if (disc >= 0) {
        const d = (-B - Math.sqrt(disc)) / (2 * A);
        const wy = ay * d;
        if (d > 0.5 && wy >= y0 && wy <= y1) {
          const P = [ax * d, wy, d];
          const nx = (P[0] - cx) / r;
          const nz = (d - cz) / r;
          const res = fn('side', P, Math.max(-1, Math.min(1, nx)), (wy - y0) / (y1 - y0), x, y);
          if (res) put(gb, x, y, res[0], res[1], ...(res[2] || [nx, 0, nz]), d);
          hit = true;
        }
      }
      // Its top, seen from above.
      if (!hit && top && ay > 0 && y0 > 0) {
        const d = y0 / ay;
        const wx = ax * d;
        if ((wx - cx) ** 2 + (d - cz) ** 2 <= r * r) {
          const P = [wx, y0, d];
          const res = fn('top', P, (wx - cx) / r, (d - cz) / r, x, y);
          if (res) put(gb, x, y, res[0], res[1], ...(res[2] || [0, -1, 0]), d);
        }
      }
    }
  }
  if (sh) sh.push({ t: 'cyl', cx, cz, r, y0, y1 });
}

// A rounded lump (coal, a sack, a rolled hide): an ellipsoid at C, radii R.
// `fn(P, n, x, y)` → [material, brightness].
export function lump(gb, C, R, fn, sh = null) {
  const c = gb.cam;
  const [x0, y0] = c.p(C[0] - R[0] * 1.2, C[1] - R[1] * 1.2, C[2] - R[2]);
  const [x1, y1] = c.p(C[0] + R[0] * 1.2, C[1] + R[1] * 1.2, C[2] - R[2]);
  for (let y = Math.max(0, Math.floor(Math.min(y0, y1))); y <= Math.min(H - 1, Math.ceil(Math.max(y0, y1))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(x0, x1))); x <= Math.min(W - 1, Math.ceil(Math.max(x0, x1))); x++) {
      const dx = c.ax(x) / R[0];
      const dy = c.ay(y) / R[1];
      const dz = 1 / R[2];
      const ox = -C[0] / R[0];
      const oy = -C[1] / R[1];
      const oz = -C[2] / R[2];
      const A = dx * dx + dy * dy + dz * dz;
      const B = 2 * (ox * dx + oy * dy + oz * dz);
      const Cq = ox * ox + oy * oy + oz * oz - 1;
      const disc = B * B - 4 * A * Cq;
      if (disc < 0) continue;
      const d = (-B - Math.sqrt(disc)) / (2 * A);
      if (d <= 0.5) continue;
      const P = [c.ax(x) * d, c.ay(y) * d, d];
      const n = [(P[0] - C[0]) / (R[0] * R[0]), (P[1] - C[1]) / (R[1] * R[1]), (P[2] - C[2]) / (R[2] * R[2])];
      const res = fn(P, n, x, y);
      if (res) put(gb, x, y, res[0], res[1], n[0], n[1], n[2], d);
    }
  }
  if (sh) sh.push({ t: 'box', x0: C[0] - R[0] * 0.8, x1: C[0] + R[0] * 0.8, y0: C[1] - R[1] * 0.8, y1: C[1] + R[1] * 0.8, d0: C[2] - R[2] * 0.8, d1: C[2] + R[2] * 0.8 });
}

// A rod in the room (a haft, a bow's limb, tongs, a rafter's peg): from A
// to B (room points), `w` thick in the room, round across. `fn(s, a, P, x,
// y)` (s: -1..1 across, a: 0..1 along) → [material, brightness].
export function rod(gb, A, B, w, fn) {
  const c = gb.cam;
  const [x0, y0] = c.p(...A);
  const [x1, y1] = c.p(...B);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const k0 = (w * c.D) / A[2] / 2;
  const k1 = (w * c.D) / B[2] / 2;
  const pad = 0.35;
  const pts = [[x0 + px * (k0 + pad), y0 + py * (k0 + pad)], [x1 + px * (k1 + pad), y1 + py * (k1 + pad)], [x1 - px * (k1 + pad), y1 - py * (k1 + pad)], [x0 - px * (k0 + pad), y0 - py * (k0 + pad)]];
  scan(pts, (x, y) => {
    const rx = x + 0.5 - x0;
    const ry = y + 0.5 - y0;
    const a = Math.max(0, Math.min(1, (rx * dx + ry * dy) / (len * len)));
    const hw = Math.max(0.5, k0 + (k1 - k0) * a);
    const s = Math.max(-1, Math.min(1, (rx * px + ry * py) / hw));
    const d = A[2] + (B[2] - A[2]) * a;
    const P = [A[0] + (B[0] - A[0]) * a, A[1] + (B[1] - A[1]) * a, d];
    const r = fn(s, a, P, x, y);
    if (r) put(gb, x, y, r[0], r[1], px * s, py * s, -Math.sqrt(Math.max(0.06, 1 - s * s)), d - 0.3);
  });
}

// ------------------------------------------------------------ shadows
// Each surface's shadow from a light (in `slot`, 0..3): looked for along
// the way from the pixel to the light, through the solids in `sh`, the
// light taken as a small disc (`soft` across) so shadows' edges soften.
export function castShadows(gb, solids, L, slot, soft = 3, only = null) {
  const c = gb.cam;
  const taps = [[0, 0, 0], [soft, 0, 0], [-soft, 0, 0], [0, soft, 0], [0, -soft, 0]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!gb.mat[i] || (only && !only(x, y))) continue;
      const d = gb.z[i];
      const P = [c.ax(x) * d, c.ay(y) * d, d];
      // (Off the surface a touch, toward its face.)
      P[0] += (gb.nx[i] / 127) * 0.9;
      P[1] += (gb.ny[i] / 127) * 0.9;
      P[2] += (gb.nz[i] / 127) * 0.9;
      let hidden = 0;
      for (const t of taps) {
        const Lx = L.x + t[0];
        const Ly = L.y + t[1];
        const Lz = L.z + t[2];
        if (blocked(solids, P, [Lx - P[0], Ly - P[1], Lz - P[2]])) hidden++;
      }
      if (hidden) gb.sh[i * 4 + slot] = Math.max(gb.sh[i * 4 + slot], Math.round((hidden / taps.length) * 255));
    }
  }
}
function blocked(solids, P, v) {
  for (const s of solids) {
    if (s.t === 'box' || s.t === 'poly') {
      if (slab(P, v, s)) {
        if (s.t === 'box' || polyHit(P, v, s)) return true;
      }
    } else if (s.t === 'cyl' && cylHit(P, v, s)) return true;
  }
  return false;
}
function slab(P, v, b) {
  let t0 = 0.002;
  let t1 = 0.998;
  for (const [o, dv, lo, hi] of [[P[0], v[0], b.x0, b.x1], [P[1], v[1], b.y0, b.y1], [P[2], v[2], b.d0, b.d1]]) {
    if (Math.abs(dv) < 1e-9) {
      if (o < lo || o > hi) return false;
    } else {
      let a = (lo - o) / dv;
      let c = (hi - o) / dv;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
  }
  b.tEnter = t0;
  b.tExit = t1;
  return true;
}
// (A drawn-out profile: the way through its depth checked against the
// outline, a few steps.)
function polyHit(P, v, s) {
  for (let k = 0; k <= 6; k++) {
    const t = s.tEnter + ((s.tExit - s.tEnter) * k) / 6;
    if (inside(s.pts, P[0] + v[0] * t, P[1] + v[1] * t)) return true;
  }
  return false;
}
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function cylHit(P, v, s) {
  const ox = P[0] - s.cx;
  const oz = P[2] - s.cz;
  const A = v[0] * v[0] + v[2] * v[2];
  if (A < 1e-9) return false;
  const B = 2 * (ox * v[0] + oz * v[2]);
  const C = ox * ox + oz * oz - s.r * s.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const q = Math.sqrt(disc);
  for (const t of [(-B - q) / (2 * A), (-B + q) / (2 * A)]) {
    if (t <= 0.002 || t >= 0.998) continue;
    const y = P[1] + v[1] * t;
    if (y >= s.y0 && y <= s.y1) return true;
  }
  // (Through its top or its foot.)
  for (const yy of [s.y0, s.y1]) {
    if (Math.abs(v[1]) < 1e-9) continue;
    const t = (yy - P[1]) / v[1];
    if (t <= 0.002 || t >= 0.998) continue;
    if ((ox + v[0] * t) ** 2 + (oz + v[2] * t) ** 2 <= s.r * s.r) return true;
  }
  return false;
}

// ------------------------------------------------------------ lights
// A light in the room: where it is, how far it reaches, how strong, its
// colour, and which of the four shadow masks hides it (or none).
export function light(x, y, z, r, p, col, slot = -1) {
  const c = typeof col === 'string' ? rgb(col) : col;
  const m = Math.max(c[0], c[1], c[2]) || 1;
  return { x, y, z, r, p, cr: c[0] / m, cg: c[1] / m, cb: c[2] / m, slot };
}

const VX = 0;
const VY = -0.3;
const VZ = -0.95;
// (Round 134) What a light that's stayed where it is does for each pixel,
// kept from frame to frame: how near it is (its fall-off before its
// strength), how square on the pixel faces it, and how much it shines
// there; worked out again only where the pixel itself has changed (some
// moving thing over it) or the light's moved. A flame's flicker is only
// its strength, so the lantern on the table, the lamp behind you, the
// day through the window are lit in a few multiplications a pixel, not a
// square root and a dozen more. The very same sums, in the same order, so
// the very same picture.
const SLOTS = 6;
function lightCache(gb, lights) {
  let C = gb.lc;
  if (!C || C.cam !== gb.cam) {
    C = gb.lc = {
      cam: gb.cam, slots: new Map(), seen: new Set(),
      // (What each pixel was when last looked at, and how often it's changed.)
      m: new Uint8Array(N), z: new Float32Array(N), nx: new Int8Array(N), ny: new Int8Array(N), nz: new Int8Array(N), ver: new Uint32Array(N),
    };
  }
  const now = new Set();
  const use = new Array(lights.length).fill(null);
  for (let li = 0; li < lights.length; li++) {
    const L = lights[li];
    const k = `${L.x},${L.y},${L.z},${L.r}`;
    now.add(k);
    let S = C.slots.get(k);
    // (Only a light that was just here last frame too: not the fire, that
    // moves every frame.)
    if (!S && C.seen.has(k) && C.slots.size < SLOTS) {
      // (For each pixel: when it was worked out, and its fall-off, facing
      // and shine side by side; a fall-off of -1, out of the light's reach
      // or facing away.)
      S = { at: new Uint32Array(N), v: new Float64Array(N * 3) };
      C.slots.set(k, S);
    }
    if (S) S.used = true;
    use[li] = S || null;
  }
  for (const [k, S] of C.slots) {
    if (!S.used) C.slots.delete(k);
    S.used = false;
  }
  C.seen = now;
  return { C, use };
}

// (Round 134) e^-x read off a table (between its entries, a straight line
// across): within a millionth of it, which settles which tone a pixel
// takes but where it's on the very edge of the next one; there it's
// worked out exactly (see shade), so the picture's the very same.
const EXP_N = 8192;
const EXP_MAX = 16;
const EXP_TAB = new Float64Array(EXP_N + 2);
for (let j = 0; j <= EXP_N + 1; j++) EXP_TAB[j] = Math.exp((-j * EXP_MAX) / EXP_N);
const EXP_EPS = 1e-4;
function expNeg(x) {
  if (!(x >= 0) || x >= EXP_MAX) return Math.exp(-x);
  const u = x * (EXP_N / EXP_MAX);
  const j = u | 0;
  return EXP_TAB[j] + (EXP_TAB[j + 1] - EXP_TAB[j]) * (u - j);
}

// How much a light from (lx, ly, lz) shines off a pixel facing (nx, ny,
// nz) of material M, toward you (before its strength).
function specOf(lx, ly, lz, nx, ny, nz, M) {
  let hx = lx + VX;
  let hy = ly + VY;
  let hz = lz + VZ;
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl;
  hy /= hl;
  hz /= hl;
  const sd = nx * hx + ny * hy + nz * hz;
  return sd > 0 ? sd ** M.gloss * M.spec : 0;
}

// The scene lit: into `out` (an ImageData's data).
export function shade(gb, lights, amb, out) {
  const c = gb.cam;
  const ak = amb.k;
  const ar = amb.c[0] / 255;
  const ag = amb.c[1] / 255;
  const ab = amb.c[2] / 255;
  const nl = lights.length;
  const { C, use } = lightCache(gb, lights);
  for (let y = 0; y < H; y++) {
    const ay = c.ay(y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 4;
      const m = gb.mat[i];
      let r = 6;
      let g = 5;
      let b = 9;
      if (m) {
        const M = MATS[m];
        const th = 0.5 + (BAYER[(x & 3) + (y & 3) * 4] - 0.5) * 0.15;
        if (M.unlit) {
          const f = Math.max(0, Math.min(1, gb.val[i])) * (M.n - 1);
          let k = Math.floor(f);
          if (f - k > th) k++;
          const cc = M.R[Math.min(M.n - 1, k)];
          r = cc[0];
          g = cc[1];
          b = cc[2];
        } else {
          const nx = gb.nx[i] / 127;
          const ny = gb.ny[i] / 127;
          const nz = gb.nz[i] / 127;
          const pz = gb.z[i];
          const px = c.ax(x) * pz;
          const py = ay * pz;
          // (Is the pixel what it was? If not, what's kept for it is stale.)
          if (C.m[i] !== m || C.z[i] !== pz || C.nx[i] !== gb.nx[i] || C.ny[i] !== gb.ny[i] || C.nz[i] !== gb.nz[i]) {
            C.m[i] = m;
            C.z[i] = pz;
            C.nx[i] = gb.nx[i];
            C.ny[i] = gb.ny[i];
            C.nz[i] = gb.nz[i];
            C.ver[i]++;
          }
          const ver = C.ver[i] + 1;
          let I = ak;
          let cr = ar * ak;
          let cg = ag * ak;
          let cb = ab * ak;
          let S = 0;
          for (let li = 0; li < nl; li++) {
            const L = lights[li];
            const K = use[li];
            let aa;
            let lam;
            let q;
            if (K && K.at[i] === ver) {
              aa = K.v[i * 3];
              if (aa < 0) continue;
              lam = K.v[i * 3 + 1];
              q = K.v[i * 3 + 2];
            } else {
              const dx = L.x - px;
              const dy = L.y - py;
              const dz = L.z - pz;
              const d2 = dx * dx + dy * dy + dz * dz;
              aa = -1;
              if (d2 < L.r * L.r) {
                const d = Math.sqrt(d2) || 1;
                const a = 1 - d / L.r;
                const lx = dx / d;
                const ly = dy / d;
                const lz = dz / d;
                lam = nx * lx + ny * ly + nz * lz;
                lam = (lam + M.wrap) / (1 + M.wrap);
                if (lam > 0) {
                  aa = a * a;
                  q = M.spec ? specOf(lx, ly, lz, nx, ny, nz, M) : 0;
                }
              }
              if (K) {
                K.at[i] = ver;
                K.v[i * 3] = aa;
                K.v[i * 3 + 1] = lam;
                K.v[i * 3 + 2] = q;
              }
              if (aa < 0) continue;
            }
            let att = aa * L.p;
            if (L.slot >= 0) att *= 1 - gb.sh[o + L.slot] / 255;
            if (att < 0.002) continue;
            const cl = att * lam;
            I += cl;
            cr += L.cr * cl;
            cg += L.cg * cl;
            cb += L.cb * cl;
            if (q > 0) S += q * att * 2.4;
          }
          const bri = gb.val[i] * I + S;
          let f = (1 - expNeg(bri * 1.4)) * (M.n - 1);
          let k = Math.floor(f);
          // (Read off the table; worked out exactly only where that could
          // tip it to the next tone: see expNeg.)
          const fr = f - k;
          if (fr < EXP_EPS || fr > 1 - EXP_EPS || Math.abs(fr - th) < EXP_EPS) {
            f = (1 - Math.exp(-bri * 1.4)) * (M.n - 1);
            k = Math.floor(f);
          }
          if (f - k > th) k++;
          const cc = M.R[Math.max(0, Math.min(M.n - 1, k))];
          // The light's own colour on it, in a few steps.
          const tm = Math.max(cr, cg, cb) || 1;
          let t = Math.min(0.55, (I - ak) * 0.3 + 0.14);
          t = Math.round(t * 5) / 5;
          if (t < 0) t = 0;
          r = cc[0] * (1 - t + t * (cr / tm) * 1.16);
          g = cc[1] * (1 - t + t * (cg / tm) * 1.16);
          b = cc[2] * (1 - t + t * (cb / tm) * 1.16);
        }
      }
      out[o] = r + gb.er[i];
      out[o + 1] = g + gb.eg[i];
      out[o + 2] = b + gb.eb[i];
      out[o + 3] = 255;
    }
  }
}

// A halo of light given off round a point of the scene (a flame,
// white-hot iron): in a few dithered rings, falling off.
export function halo(gb, cx, cy, r, col, k = 1) {
  const cc = typeof col === 'string' ? rgb(col) : col;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const f = (1 - d) * 4;
      let s = Math.floor(f);
      if (f - s > 0.5 + (bayer(x, y) - 0.5) * 0.6) s++;
      if (s > 0) emit(gb, x, y, cc, (s / 4) ** 1.7 * 0.4 * k);
    }
  }
}
// Something drawn flat on the scene in the room's light (sparks, steam,
// a mark): an unlit pixel, nearest only.
export function glowPx(gb, x, y, m, v, z = 0.6) {
  put(gb, Math.round(x), Math.round(y), m, v, 0, 0, -1, z, true);
}

// Light hanging in the air (a shaft of sun or moon through a window, the
// dust in it lit): along each pixel's ray, how much of the way lies in the
// light that comes through `win` (a hole in the plane at depth win.d, its
// crossbars `bars` casting their streaks), from the light L. Added, in a
// few dithered steps, as light given off.
export function shafts(gb, win, L, col, k = 1, bars = []) {
  const c = gb.cam;
  const cc = typeof col === 'string' ? rgb(col) : col;
  const steps = 14;
  for (let y = 0; y < H; y++) {
    const ay = c.ay(y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ax = c.ax(x);
      const far = Math.min(gb.z[i], win.d);
      let lit = 0;
      for (let s = 0; s < steps; s++) {
        const d = 12 + ((far - 12) * (s + 0.5)) / steps;
        const Q0 = ax * d;
        const Q1 = ay * d;
        const t = (win.d - d) / (L[2] - d);
        if (t <= 0 || t >= 1) continue;
        const X = Q0 + (L[0] - Q0) * t;
        const Y = Q1 + (L[1] - Q1) * t;
        if (X < win.x0 || X > win.x1 || Y < win.y0 || Y > win.y1) continue;
        if (bars.some((b) => (b.x !== undefined && Math.abs(X - b.x) < b.w) || (b.y !== undefined && Math.abs(Y - b.y) < b.w))) continue;
        lit++;
      }
      if (!lit) continue;
      const f = (lit / steps) * Math.min(1, (far - 12) / 60) * 3;
      let st = Math.floor(f);
      if (f - st > 0.5 + (bayer(x, y) - 0.5) * 0.3) st++;
      if (st > 0) emit(gb, x, y, cc, (st / 3) * 0.3 * k);
    }
  }
}
