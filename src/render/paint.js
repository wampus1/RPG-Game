// A painter's kit for pixel art drawn in code (see bossbody.js, which
// paints the masters of the old places with it).
//   Shapes are lit, not filled: a round mass is a lit sphere, a limb a lit
// tube, each pixel's brightness from its surface's slope to the light (up
// and to the left, a little toward you), stepped onto a ramp of the
// colour that shifts in hue as it goes (shadows cool toward violet, lights
// warm toward gold, as a painter mixes them), with a two-by-two dither at
// each step so the bands don't sit hard against each other. And over it
// all a tinted outline (see people.outlineSel).
import { Px, hex, mix, shade } from './pixel.js';
import { outlineSel } from './people.js';

// The light: up, left and a little toward you.
const LX = -0.55;
const LY = -0.68;
const LZ = 0.48;
const LN = Math.hypot(LX, LY, LZ);
const L = [LX / LN, LY / LN, LZ / LN];
const BAYER = [0, 0.5, 0.75, 0.25];

// A ramp of `n` steps from deep shadow to highlight, round `base` (which
// sits a little above the middle), hue-shifted.
const ramps = new Map();
export function ramp(base, n = 6) {
  const key = `${base}:${n}`;
  let r = ramps.get(key);
  if (r) return r;
  const b = hex(base);
  r = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    if (k < 0.6) {
      const d = (0.6 - k) / 0.6;
      r.push(mix(shade(b, 1 - 0.62 * d), [38, 24, 72], 0.32 * d));
    } else {
      const u = (k - 0.6) / 0.4;
      r.push(mix(shade(b, 1 + 0.32 * u), [255, 240, 196], 0.3 * u));
    }
  }
  ramps.set(key, r);
  return r;
}

export class Paint {
  constructor(w, h) {
    this.p = new Px(w, h);
    this.w = w;
    this.h = h;
  }
  // A colour onto the ramp by a light level (0..1), dithered at (x, y).
  tone(col, lv, x, y, n = 6) {
    const R = Array.isArray(col) && Array.isArray(col[0]) ? col : ramp(col, n);
    const f = Math.max(0, Math.min(0.999, lv)) * (R.length - 1);
    let i = Math.floor(f);
    // (Solid bands; a checker only along the seam between two of them.)
    const fr = f - i;
    if (fr > 0.72 || (fr > 0.5 && BAYER[(x & 1) + (y & 1) * 2] < 0.5)) i++;
    return R[Math.min(R.length - 1, i)];
  }
  // How lit a surface is with this normal (0..1): a little ambient, the
  // light, and a cold rim where it turns away from you.
  static lum(nx, ny, nz, amb = 0.22) {
    const d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    return amb + (1 - amb) * d;
  }
  set(x, y, c, a = 255) {
    this.p.set(Math.round(x), Math.round(y), c, a);
  }
  get(x, y) {
    return this.p.get(x, y);
  }
  // A lit round mass (rx by ry), its colour or ramp; `flat` squashes its
  // depth (a disc rather than a ball); `amb` lifts its shadows.
  blob(cx, cy, rx, ry, col, o = {}) {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    const depth = o.flat ?? 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / (rx + 0.25);
        const ny = (y + 0.5 - cy) / (ry + 0.25);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        if (o.clip && !o.clip(x, y)) continue;
        const nz = Math.sqrt(1 - r2) * depth;
        const n = Math.hypot(nx, ny, nz) || 1;
        this.set(x, y, this.tone(col, Paint.lum(nx / n, ny / n, nz / n, o.amb) + (o.lift || 0), x, y));
      }
    }
  }
  // A lit tube from (x0, y0) to (x1, y1), r0 thick at its start, r1 at its
  // end (a limb, a tentacle, a horn).
  tube(x0, y0, x1, y1, r0, r1, col, o = {}) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1;
    const R = Math.max(r0, r1) + 1;
    const bx0 = Math.floor(Math.min(x0, x1) - R);
    const bx1 = Math.ceil(Math.max(x0, x1) + R);
    const by0 = Math.floor(Math.min(y0, y1) - R);
    const by1 = Math.ceil(Math.max(y0, y1) + R);
    const len = Math.sqrt(L2);
    const px = -dy / len;
    const py = dx / len;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const qx = x + 0.5 - x0;
        const qy = y + 0.5 - y0;
        let t = (qx * dx + qy * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        const r = r0 + (r1 - r0) * t + 0.25;
        const ex = qx - dx * t;
        const ey = qy - dy * t;
        const d = Math.hypot(ex, ey);
        if (d > r) continue;
        // (Its normal: across it, and out toward you.)
        const s = (ex * px + ey * py) / r;
        const nz = Math.sqrt(Math.max(0, 1 - s * s));
        const lv = Paint.lum(px * s, py * s, nz, o.amb);
        this.set(x, y, this.tone(col, lv + (o.lift || 0), x, y));
      }
    }
  }
  // A chain of tubes through `pts` ([x, y, r] each): a tentacle, a tail.
  limb(pts, col, o = {}) {
    for (let i = 0; i + 1 < pts.length; i++) this.tube(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2], col, o);
  }
  // A filled polygon, lit by a slope across it (`grad`: [gx, gy], the
  // way it gets lighter), so a plane catches the light evenly.
  poly(pts, col, o = {}) {
    let y0 = Infinity;
    let y1 = -Infinity;
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const [x, y] of pts) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    const [gx, gy] = o.grad || [-0.4, -0.6];
    const base = o.lv ?? 0.55;
    const span = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        const yy = y + 0.5;
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          const t = ((x - (x0 + x1) / 2) * -gx + (y - (y0 + y1) / 2) * -gy) / span;
          this.set(x, y, this.tone(col, base - t * (o.contrast ?? 0.9), x, y));
        }
      }
    }
  }
  // A spike or claw: a narrow lit triangle from its base out along `ang`.
  spike(x, y, ang, len, w, col, o = {}) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    this.poly([[x - uy * w, y + ux * w], [x + uy * w, y - ux * w], [x + ux * len, y + uy * len]], col, { grad: [-uy - ux * 0.3, ux - uy * 0.3], ...o });
  }
  // A ring of something round a centre (`fn(x, y, i)` at each of `n`).
  around(cx, cy, rx, ry, n, a0, fn) {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      fn(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i, a);
    }
  }
  line(x0, y0, x1, y1, c) {
    this.p.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), hex(c));
  }
  rect(x, y, w, h, c) {
    this.p.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), hex(c));
  }
  // Something seen through (smoke, a wisp, a glow): `c` laid over what's
  // there by `k` (0..1), or alone, as faint, where nothing is.
  fx(x, y, c, k) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || k <= 0) return;
    const was = this.p.get(x, y);
    const n = hex(c);
    if (!was[3]) this.p.set(x, y, n, Math.round(255 * Math.min(1, k)));
    else this.p.set(x, y, mix(was, n, Math.min(1, k)), Math.max(was[3], Math.round(255 * Math.min(1, k))));
  }
  // A soft round puff of it, fading to its edge.
  puff(cx, cy, r, c, k) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (r + 0.3);
        if (d < 1) this.fx(x, y, c, k * (d < 0.6 ? 1 : (1 - d) / 0.4));
      }
    }
  }
  // Specks of light (a glint on metal, a wet eye), unlit: as they are.
  glint(x, y, c = '#ffffff') {
    this.set(x, y, hex(c));
  }
  // An eye that glows: a bright core, a softer surround.
  eye(x, y, c, big = false) {
    const k = hex(c);
    this.set(x, y, mix(k, [255, 255, 255], 0.55));
    if (big) {
      this.set(x + 1, y, k);
      this.set(x, y + 1, shade(k, 0.75));
      this.set(x + 1, y + 1, shade(k, 0.6));
    }
  }
  // Texture over what's already painted: `fn(x, y, col)` returns a new
  // colour or null (cracks, scales, mottling).
  over(fn) {
    const p = this.p;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        if (!c[3]) continue;
        const n = fn(x, y, c);
        if (n) p.set(x, y, n);
      }
    }
  }
  done(outline = true) {
    if (outline) outlineSel(this.p);
    return this.p;
  }
}

// A small hash, for the steady speckle of a texture.
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
