// A sculptor's kit for the masters of the old places (see bossrig.js):
// bodies built as a sculptor builds them in clay, out of rounded masses
// (balls, tapering limbs, slabs) pressed together so they flow into one
// another, a fillet of flesh where a limb meets a body and the crease
// between them in shadow; then each part surfaced as what it's made of
// (scales, hide, fur, chitin, cloth, leather, mail, plate, gold, rock,
// black glass, molten crust, bark, bone, glazed clay, coral, fungus, moss,
// slime) and lit as a painter lights it: from the upper left, a cool rim
// from behind, each material its own shine, stepped onto a ramp of its
// colour that shifts in hue as it goes (shadows toward violet, lights
// toward gold), dithered only along the seams between steps. Last, a dark
// line where one part passes in front of another, and the outline round
// it all.
//   Each part's height over the picture (toward you) is worked out pixel by
// pixel; parts of one `group` are blended (smoothly, over `k` pixels),
// groups are stacked by height, nearest in front. The light falls on the
// slope of the blended surface, so the whole reads as one body.
import { Px, hex, mix, shade } from './pixel.js';
import { ramp, hash2 } from './paint.js';
import { outlineSel } from './people.js';

const TAU = Math.PI * 2;
const norm = (x, y, z) => {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
};
const LIGHT = norm(-0.55, -0.68, 0.55);
const HALF = norm(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
const RIM = norm(0.7, -0.35, -0.2);
const BAYER = [0, 0.5, 0.75, 0.25];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - Math.floor(v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Smooth max and min (polynomial), over `k`.
const smax = (a, b, k) => {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const smin = (a, b, k) => -smax(-a, -b, k);

// ------------------------------------------------------------ noise
// Smooth value noise and its octaves, and the cells of a Voronoi pattern
// (cracks, facets, crust).
function vnoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 1, n = 3) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < n; i++) {
    v += vnoise(x * f, y * f, s + i * 17) * amp;
    f *= 2;
    amp *= 0.5;
  }
  return v / (1 - Math.pow(0.5, n));
}
export function cells(x, y, s = 1, jitter = 0.85) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  let cx = 0;
  let cy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = xi + i;
      const gy = yi + j;
      const px = gx + 0.5 + (hash2(gx, gy, s) - 0.5) * jitter;
      const py = gy + 0.5 + (hash2(gx, gy, s + 7) - 0.5) * jitter;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(gx, gy, s + 13);
        cx = px;
        cy = py;
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, edge: d2 - d1, id, cx, cy };
}

// ------------------------------------------------------------ materials
// How each stuff takes the light: `spec` its shine and `pow` how tight,
// `wrap` how far light creeps round it (flesh, cloth), `env` how much it
// mirrors the bright above and the dark below (metal, glass), `rim` its
// edge-light; and `tex(c)`, its surface: given where on the part a pixel
// is (c.u along it, c.v across, in pixels; c.x, c.y on the picture) it
// returns { lv: lighter or darker, dn: [x, y] a tilt of the surface, col
// (another colour there) and k (how much), spec, glow: [colour, k] }.
const MATS = {
  skin: {
    spec: 0.12, pow: 10, wrap: 0.35, rim: 0.25,
    tex: (c) => ({ lv: (hash2(c.x, c.y, 3) - 0.5) * 0.05 }),
  },
  flesh: {
    spec: 0.35, pow: 14, wrap: 0.45, rim: 0.3,
    tex: (c) => {
      const n = fbm(c.x * 0.25, c.y * 0.25, c.seed);
      return { lv: (n - 0.5) * 0.14, dn: [(n - 0.5) * 0.3, 0] };
    },
  },
  cloth: {
    spec: 0.03, pow: 6, wrap: 0.3, rim: 0.2,
    tex: (c) => {
      // A weave, and folds hanging down it.
      const w = ((c.x + c.y) & 1 ? 0.025 : -0.025) + ((c.x * 3 + c.y) % 5 === 0 ? -0.03 : 0);
      const f = Math.sin(c.x * 0.75 + fbm(c.x * 0.1, c.y * 0.05, c.seed) * 5);
      return { lv: w, dn: [f * 0.28, 0] };
    },
  },
  velvet: {
    spec: 0.05, pow: 4, wrap: 0.5, rim: 0.6,
    tex: (c) => {
      const f = Math.sin(c.x * 0.6 + fbm(c.x * 0.1, c.y * 0.05, c.seed) * 6);
      return { lv: (hash2(c.x, c.y, 5) - 0.5) * 0.04, dn: [f * 0.3, 0] };
    },
  },
  leather: {
    spec: 0.2, pow: 9, wrap: 0.15, rim: 0.2,
    tex: (c) => {
      const n = fbm(c.x * 0.4, c.y * 0.4, c.seed);
      const crease = Math.abs(fbm(c.u * 0.12, c.v * 1.5, c.seed + 3) - 0.5) < 0.04;
      return { lv: (n - 0.5) * 0.12 - (crease ? 0.1 : 0) + (hash2(c.x, c.y, 9) > 0.96 ? 0.08 : 0) };
    },
  },
  mail: {
    spec: 0.6, pow: 18, env: 0.4, wrap: 0, rim: 0.3,
    tex: (c) => {
      // Rings of iron in rows, each with a glint at its top.
      const rx = ((c.x + (Math.floor(c.y / 2) % 2)) % 2 + 2) % 2;
      const ry = ((c.y % 2) + 2) % 2;
      return { lv: rx === 0 && ry === 0 ? 0.15 : rx === 1 && ry === 1 ? -0.18 : 0, dn: [rx ? 0.3 : -0.3, ry ? 0.3 : -0.3] };
    },
  },
  metal: {
    spec: 0.95, pow: 28, env: 0.75, wrap: 0, rim: 0.4,
    tex: (c) => {
      const scratch = Math.abs(frac(c.x * 0.37 + c.y * 0.13 + hash2(Math.floor(c.y / 3), 1, c.seed)) - 0.5) < 0.02 && hash2(c.x, c.y >> 1, c.seed) > 0.6;
      return { lv: scratch ? 0.12 : (hash2(c.x, c.y, c.seed) - 0.5) * 0.04 };
    },
  },
  gold: {
    spec: 0.9, pow: 22, env: 0.6, wrap: 0, rim: 0.35,
    tex: (c) => ({ lv: (fbm(c.x * 0.5, c.y * 0.5, c.seed) - 0.5) * 0.1 }),
  },
  rock: {
    spec: 0.05, pow: 6, wrap: 0.05, rim: 0.15,
    tex: (c) => {
      // Faces of broken stone, cracks between them.
      const s = c.o.cell || 5;
      const q = cells(c.x / s, c.y / s, c.seed);
      const tilt = [(hash2(Math.floor(q.id * 1e4), 1, c.seed) - 0.5) * 0.9, (hash2(Math.floor(q.id * 1e4), 2, c.seed) - 0.5) * 0.9];
      const crack = q.edge < 0.08;
      return { lv: (q.id - 0.5) * 0.12 + (fbm(c.x * 0.6, c.y * 0.6, c.seed) - 0.5) * 0.08 - (crack ? 0.3 : 0), dn: tilt };
    },
  },
  obsidian: {
    spec: 1.0, pow: 50, env: 0.9, wrap: 0, rim: 0.7,
    tex: (c) => {
      // Black glass in conchoidal facets, each mirroring its own way.
      const s = c.o.cell || 6;
      const q = cells(c.x / s, c.y / s, c.seed);
      const id = Math.floor(q.id * 1e4);
      const ridge = q.edge < 0.06;
      return { dn: [(hash2(id, 1, c.seed) - 0.5) * 1.2, (hash2(id, 2, c.seed) - 0.5) * 1.2], lv: ridge ? 0.25 : 0, glint: ridge && hash2(c.x, c.y, c.seed) > 0.7 };
    },
  },
  glass: {
    spec: 1.0, pow: 40, env: 0.6, wrap: 0.4, rim: 0.9,
    tex: (c) => {
      // Clear, so you see the far side lit through it.
      const q = cells(c.x / 7, c.y / 7, c.seed);
      return { lv: (1 - Math.abs(c.V)) * 0.25 + (q.edge < 0.05 ? 0.2 : 0), dn: [(q.id - 0.5) * 0.6, 0] };
    },
  },
  molten: {
    spec: 0.25, pow: 12, wrap: 0, rim: 0.1,
    tex: (c) => {
      // A crust of cooling slag in plates, the white-hot rock showing
      // between them, and through the thin places.
      const s = c.o.cell || 4.5;
      // (The crust heaving on what's under it, and settling back, so the
      // breath it's drawn in comes round without a jump.)
      const drift = Math.sin(c.t * TAU) * 0.3 * (c.o.flow || 0.6);
      const q = cells(c.x / s, c.y / s + drift, c.seed);
      const seam = smoothstep(0.16, 0.0, q.edge);
      const thin = Math.max(0, fbm(c.x * 0.2, c.y * 0.2 + drift * 2, c.seed + 4) - 0.62) * 2.2;
      const k = Math.max(seam, thin * 0.8) * (0.75 + 0.25 * Math.sin(c.t * TAU * 2 + q.id * 9));
      return { lv: (q.id - 0.5) * 0.15 - seam * 0.2, dn: [(q.cx * s - c.x) * 0.06, (q.cy * s - c.y) * 0.06], glow: k > 0.05 ? [k > 0.7 ? '#fff0a0' : k > 0.4 ? '#ffb040' : '#ff5a10', Math.min(1, k * 1.3)] : null };
    },
  },
  scales: {
    spec: 0.4, pow: 16, wrap: 0.1, rim: 0.4,
    tex: (c) => {
      // Overlapping scales in rows, laid back along the body: each a
      // rounded plate, its free edge toward the tail, lit across its
      // middle and dark in the crescent under its edge.
      const s = c.o.scale || 3.5;
      const row = Math.floor(c.u / (s * 0.8));
      const off = row % 2 ? s / 2 : 0;
      const col = Math.floor((c.vp + off) / s);
      const fu = (c.u - row * s * 0.8) / (s * 0.8);
      const fv = ((c.vp + off) - col * s) / s - 0.5;
      const e = (fu - 0.35) * (fu - 0.35) * 1.6 + fv * fv * 3.2;
      const tint = (hash2(row, col, c.seed) - 0.5) * 0.12;
      if (fu > 0.8) return { lv: -0.24 + tint, dn: [0, 0.5] };
      return { lv: 0.1 - e * 0.35 + tint, dn: [fv * 0.9, (fu - 0.35) * 0.9], spec: e < 0.12 ? 0.6 : undefined };
    },
  },
  chitin: {
    spec: 0.8, pow: 22, env: 0.3, wrap: 0.05, rim: 0.5,
    tex: (c) => {
      const s = c.o.band || 5;
      const b = frac(c.u / s);
      return { lv: b < 0.15 ? -0.3 : (hash2(c.x, c.y, c.seed) - 0.5) * 0.04, dn: [0, b < 0.25 ? -0.5 : 0.1] };
    },
  },
  fur: {
    spec: 0.04, pow: 6, wrap: 0.35, rim: 0.7,
    tex: (c) => {
      // Locks of fur running along it, the tips lighter.
      const n = fbm(c.u * 0.18, c.vp * 1.1, c.seed);
      const strand = Math.sin(c.vp * 2.6 + n * 8);
      return { lv: strand * 0.1 + (n - 0.5) * 0.2, dn: [strand * 0.2, 0] };
    },
  },
  feather: {
    spec: 0.1, pow: 8, wrap: 0.3, rim: 0.5,
    tex: (c) => {
      const s = c.o.scale || 4;
      const row = Math.floor(c.u / s);
      const fu = frac(c.u / s);
      const vane = Math.abs(frac(c.vp / s + row * 0.5) - 0.5);
      return { lv: -fu * 0.18 + (vane < 0.06 ? 0.12 : 0), dn: [0, (fu - 0.5) * 0.4] };
    },
  },
  bark: {
    spec: 0.03, pow: 6, wrap: 0.1, rim: 0.2,
    tex: (c) => {
      // Deep furrows running along it, plated ridges between.
      const n = fbm(c.u * 0.08, c.vp * 0.45, c.seed);
      const r = Math.sin(c.vp * 1.6 + n * 9);
      const knot = cells(c.x / 9, c.y / 9, c.seed + 2).d1 < 0.12;
      return { lv: r * 0.16 - (r < -0.6 ? 0.18 : 0) - (knot ? 0.2 : 0), dn: [Math.cos(c.vp * 1.6 + n * 9) * 0.45, 0] };
    },
  },
  wood: {
    spec: 0.08, pow: 8, wrap: 0.1, rim: 0.2,
    tex: (c) => {
      const g = Math.sin(c.vp * 3 + fbm(c.u * 0.1, c.vp * 0.5, c.seed) * 6);
      return { lv: g * 0.07 };
    },
  },
  bone: {
    spec: 0.25, pow: 12, wrap: 0.2, rim: 0.3,
    tex: (c) => ({ lv: (fbm(c.x * 0.5, c.y * 0.5, c.seed) - 0.5) * 0.14 - (hash2(c.x, c.y, c.seed) > 0.95 ? 0.12 : 0) }),
  },
  ceramic: {
    spec: 0.7, pow: 30, env: 0.25, wrap: 0.1, rim: 0.3,
    tex: (c) => {
      // Glazed, and crazed with hair-fine cracks.
      const q = cells(c.x / 6, c.y / 6, c.seed);
      return { lv: q.edge < 0.03 ? -0.14 : 0 };
    },
  },
  coral: {
    spec: 0.1, pow: 8, wrap: 0.3, rim: 0.3,
    tex: (c) => {
      // Pocked with the cups of the polyps.
      const q = cells(c.x / 2.6, c.y / 2.6, c.seed);
      const cup = q.d1 < 0.28;
      return { lv: cup ? -0.22 : q.d1 < 0.4 ? 0.1 : 0, dn: cup ? [(c.x / 2.6 - q.cx) * 2, (c.y / 2.6 - q.cy) * 2] : [0, 0] };
    },
  },
  fungus: {
    spec: 0.06, pow: 6, wrap: 0.4, rim: 0.4,
    tex: (c) => ({ lv: (fbm(c.x * 0.3, c.y * 0.3, c.seed) - 0.5) * 0.12 }),
  },
  moss: {
    spec: 0.02, pow: 4, wrap: 0.4, rim: 0.5,
    tex: (c) => {
      const n = hash2(c.x, c.y, c.seed);
      return { lv: (n - 0.5) * 0.3, dn: [(hash2(c.x, c.y, c.seed + 1) - 0.5) * 0.8, (n - 0.5) * 0.8] };
    },
  },
  slime: {
    spec: 0.85, pow: 18, wrap: 0.6, rim: 0.6, env: 0.2,
    tex: (c) => ({ lv: (fbm(c.x * 0.2, c.y * 0.2 + Math.sin(c.t * TAU) * 0.5, c.seed) - 0.5) * 0.2 }),
  },
  ash: {
    spec: 0.02, pow: 4, wrap: 0.25, rim: 0.2,
    tex: (c) => ({ lv: (hash2(c.x, c.y, c.seed) - 0.5) * 0.18 + (fbm(c.x * 0.3, c.y * 0.3, c.seed) - 0.5) * 0.1 }),
  },
  hair: {
    spec: 0.35, pow: 14, wrap: 0.2, rim: 0.5,
    tex: (c) => {
      const s = Math.sin(c.vp * 2.2 + fbm(c.u * 0.15, c.vp * 0.6, c.seed) * 7);
      return { lv: s * 0.12, dn: [s * 0.3, 0] };
    },
  },
  shell: {
    spec: 0.5, pow: 20, env: 0.2, wrap: 0.2, rim: 0.4,
    tex: (c) => {
      // Growth ridges in arcs, and the sheen of nacre.
      const r = Math.sin(c.u * 1.3);
      return { lv: r * 0.08, dn: [0, r * 0.3] };
    },
  },
  ink: { spec: 0, pow: 1, wrap: 0, rim: 0, flat: true, tex: () => ({}) },
};
export const MATERIALS = Object.keys(MATS);

// ------------------------------------------------------------ the kit
export class Sculpt {
  constructor(w, h, o = {}) {
    this.w = w;
    this.h = h;
    this.prims = [];
    this.t = o.t || 0;
    this.seed = o.seed || 1;
    this.group = 0;
    this.k = 2.5;
    // (Round 71: `pix`, drawn as a pixel artist would: the light in clean
    // bands of its ramp, no checker between them, the grain of what it's
    // made of softened, its shine in solid pops. See render/forge.js.)
    this.pix = !!o.pix;
    this.texK = o.texK ?? (this.pix ? 0.55 : 1);
    this.steps = o.steps ?? (this.pix ? 6 : 7);
  }
  // From here on, parts go in group `g`, blended over `k` pixels.
  in(g, k = this.k) {
    this.group = g;
    this.k = k;
    return this;
  }
  add(p, col, mat, o) {
    p.col = col;
    p.mat = MATS[mat] ? mat : 'skin';
    p.o = o;
    p.group = o.group ?? this.group;
    p.k = o.k ?? this.k;
    p.seed = o.seed ?? (this.seed + this.prims.length * 7);
    this.prims.push(p);
    return p;
  }
  // A ball (rx by ry on the picture, `rz` deep, its middle `z` toward
  // you), turned by `ang`.
  ball(cx, cy, rx, ry, col, mat = 'skin', o = {}) {
    const ang = o.ang || 0;
    const R = Math.max(rx, ry) + 1;
    return this.add({ kind: 'ball', cx, cy, rx, ry, rz: o.rz ?? Math.min(rx, ry), z: o.z || 0, ca: Math.cos(ang), sa: Math.sin(ang), x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R }, col, mat, o);
  }
  // A tapering limb from (x0, y0) to (x1, y1), r0 thick at its root and
  // r1 at its end, `z0`/`z1` toward you at each end.
  tube(x0, y0, x1, y1, r0, r1, col, mat = 'skin', o = {}) {
    const R = Math.max(r0, r1) + 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    return this.add({ kind: 'tube', ax: x0, ay: y0, dx, dy, len2: dx * dx + dy * dy || 1, len: Math.hypot(dx, dy) || 1, r0, r1, z0: o.z0 ?? o.z ?? 0, z1: o.z1 ?? o.z ?? 0, flat: o.flat ?? 1, x0: Math.min(x0, x1) - R, x1: Math.max(x0, x1) + R, y0: Math.min(y0, y1) - R, y1: Math.max(y0, y1) + R }, col, mat, o);
  }
  // A limb through points [x, y, r, z?].
  limb(pts, col, mat = 'skin', o = {}) {
    let u = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      this.tube(a[0], a[1], b[0], b[1], a[2], b[2], col, mat, { ...o, z0: a[3] ?? o.z ?? 0, z1: b[3] ?? o.z ?? 0, u0: u });
      u += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  // A slab: a flat shape (the polygon `pts`) `rz` thick, its edges
  // rounded over `bevel` pixels (a blade, a plate, a wing, a leaf).
  slab(pts, col, mat = 'cloth', o = {}) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return this.add({ kind: 'slab', pts, rz: o.rz ?? 2, bevel: o.bevel ?? 2, z: o.z || 0, x0: x0 - 1, x1: x1 + 1, y0: y0 - 1, y1: y1 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }, col, mat, o);
  }

  // One part at a pixel: { d: how far outside it (negative in), h: its
  // height there (carried on down past its edge, so neighbours blend),
  // u, v: where on it }.
  probe(p, px, py) {
    if (p.kind === 'ball') {
      const dx = px - p.cx;
      const dy = py - p.cy;
      const lx = dx * p.ca + dy * p.sa;
      const ly = -dx * p.sa + dy * p.ca;
      const q = Math.hypot(lx / p.rx, ly / p.ry);
      const d = (q - 1) * Math.min(p.rx, p.ry);
      const h = q < 1 ? p.z + p.rz * Math.sqrt(1 - q * q) : p.z - d;
      // (Its texture runs down it, or, `along: x`, across it: a body seen
      // side on, its scales laid back toward the tail.)
      if (p.o.along === 'x') return { d, h, u: (p.o.flipU ? -lx : lx) + p.rx, v: ly / p.ry, vp: ly };
      return { d, h, u: ly + p.ry, v: lx / p.rx, vp: lx };
    }
    if (p.kind === 'tube') {
      const qx = px - p.ax;
      const qy = py - p.ay;
      let t = (qx * p.dx + qy * p.dy) / p.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const r = p.r0 + (p.r1 - p.r0) * t;
      const ex = qx - p.dx * t;
      const ey = qy - p.dy * t;
      const dist = Math.hypot(ex, ey);
      const d = dist - r;
      const zc = p.z0 + (p.z1 - p.z0) * t;
      const side = (ex * -p.dy + ey * p.dx) / p.len;
      const h = d < 0 ? zc + Math.sqrt(Math.max(0, r * r - dist * dist)) * p.flat : zc - d;
      return { d, h, u: (p.o.u0 || 0) + t * p.len, v: r > 0 ? side / r : 0, vp: side };
    }
    // (A slab.)
    const pts = p.pts;
    let inside = false;
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j];
      const [bx, by] = pts[i];
      if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
      const ex = bx - ax;
      const ey = by - ay;
      const l2 = ex * ex + ey * ey || 1;
      const t = clamp(((px - ax) * ex + (py - ay) * ey) / l2, 0, 1);
      best = Math.min(best, Math.hypot(px - ax - ex * t, py - ay - ey * t));
    }
    const d = inside ? -best : best;
    const h = d < 0 ? p.z + p.rz * smoothstep(0, p.bevel, -d) : p.z - d;
    return { d, h, u: py - p.y0, v: (px - p.cx) / Math.max(1, (p.x1 - p.x0) / 2), vp: px - p.cx };
  }

  // Paint it: the Px of it, outlined.
  render(o = {}) {
    const W = this.w;
    const H = this.h;
    const N = W * H;
    const height = new Float32Array(N).fill(-1e9);
    const owner = new Int32Array(N).fill(-1);
    const gid = new Int32Array(N).fill(-1);
    const U = new Float32Array(N);
    const V = new Float32Array(N);
    const VP = new Float32Array(N);
    // Each group's blended surface, then the nearest group in front.
    const groups = [...new Set(this.prims.map((p) => p.group))];
    for (const g of groups) {
      const ps = this.prims.filter((p) => p.group === g);
      let gx0 = Infinity;
      let gx1 = -Infinity;
      let gy0 = Infinity;
      let gy1 = -Infinity;
      for (const p of ps) {
        gx0 = Math.min(gx0, p.x0 - p.k);
        gx1 = Math.max(gx1, p.x1 + p.k);
        gy0 = Math.min(gy0, p.y0 - p.k);
        gy1 = Math.max(gy1, p.y1 + p.k);
      }
      gx0 = Math.max(0, Math.floor(gx0));
      gy0 = Math.max(0, Math.floor(gy0));
      gx1 = Math.min(W - 1, Math.ceil(gx1));
      gy1 = Math.min(H - 1, Math.ceil(gy1));
      for (let y = gy0; y <= gy1; y++) {
        for (let x = gx0; x <= gx1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          let D = 1e9;
          let Hh = -1e9;
          let best = -1;
          let bestH = -1e9;
          let bu = 0;
          let bv = 0;
          let bvp = 0;
          for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            if (px < p.x0 - p.k || px > p.x1 + p.k || py < p.y0 - p.k || py > p.y1 + p.k) continue;
            const r = this.probe(p, px, py);
            const kk = p.k;
            D = D === 1e9 ? r.d : smin(D, r.d, kk * 0.7);
            Hh = Hh === -1e9 ? r.h : smax(Hh, r.h, kk);
            // (Whose surface it is: the nearest part, of those it's in.)
            const own = r.d < 0.5 ? r.h + 1000 : r.h - r.d * 2;
            if (own > bestH) {
              bestH = own;
              best = i;
              bu = r.u;
              bv = r.v;
              bvp = r.vp;
            }
          }
          if (D >= 0 || best < 0) continue;
          const idx = y * W + x;
          if (Hh <= height[idx]) continue;
          height[idx] = Hh;
          owner[idx] = this.prims.indexOf(ps[best]);
          gid[idx] = g;
          U[idx] = bu;
          V[idx] = bv;
          VP[idx] = bvp;
        }
      }
    }
    // Light it.
    const out = new Px(W, H);
    const hAt = (x, y, h0) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return h0 - 1.5;
      const v = height[y * W + x];
      return v < -1e8 ? h0 - 1.5 : v;
    };
    const t = this.t;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const oi = owner[idx];
        if (oi < 0) continue;
        const p = this.prims[oi];
        const M = MATS[p.mat];
        const h0 = height[idx];
        // The slope of the surface (of its own group: a step to another
        // part in front or behind isn't a slope).
        const same = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && gid[yy * W + xx] === gid[idx];
        const hl = same(x - 1, y) ? hAt(x - 1, y, h0) : h0 - (same(x + 1, y) ? hAt(x + 1, y, h0) - h0 : 1.2);
        const hr = same(x + 1, y) ? hAt(x + 1, y, h0) : h0 - (same(x - 1, y) ? hAt(x - 1, y, h0) - h0 : 1.2);
        const hu = same(x, y - 1) ? hAt(x, y - 1, h0) : h0 - (same(x, y + 1) ? hAt(x, y + 1, h0) - h0 : 1.2);
        const hd = same(x, y + 1) ? hAt(x, y + 1, h0) : h0 - (same(x, y - 1) ? hAt(x, y - 1, h0) - h0 : 1.2);
        let gxv = (hr - hl) * 0.5;
        let gyv = (hd - hu) * 0.5;
        // The surface's own texture.
        const c = { x, y, u: U[idx], v: V[idx], V: V[idx], vp: VP[idx], t, seed: p.seed, o: p.o };
        const tx = M.tex(c) || {};
        if (tx.dn) {
          gxv -= tx.dn[0];
          gyv -= tx.dn[1];
        }
        const [nx, ny, nz] = norm(-gxv, -gyv, 1);
        // Light: wrapped round soft stuff; mirrored bright above and dark
        // below in metal and glass; shine; a cool rim from behind.
        const ndl = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const wrap = M.wrap || 0;
        let diff = clamp((ndl + wrap) / (1 + wrap), 0, 1);
        if (M.env) diff = diff * (1 - M.env) + M.env * clamp(0.5 - ny * 0.75 + nx * -0.15, 0, 1);
        // (Shadow in the creases: the surface around higher than here.)
        let occ = 0;
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-3, -3], [3, -3], [-3, 3], [3, 3]]) {
          const hh = hAt(x + ox, y + oy, h0);
          if (hh > h0) occ += Math.min(1, (hh - h0) / (Math.hypot(ox, oy) * 1.6));
        }
        const ao = 1 - clamp(occ / 8, 0, 0.55);
        let lv = (0.16 + 0.84 * diff) * ao + (tx.lv || 0) * this.texK;
        // (More between its lights and its shadows, drawn as a pixel artist
        // draws.)
        if (this.pix) lv = 0.52 + (lv - 0.52) * 1.28;
        if (p.o.lift) lv += p.o.lift;
        const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), tx.pow || M.pow) * (tx.spec ?? M.spec) * ao;
        const rim = Math.pow(Math.max(0, nx * RIM[0] + ny * RIM[1] + (1 - nz) * 0.6), 2) * (M.rim || 0);
        // Onto its colour's ramp.
        const R = ramp(p.col, this.steps);
        const f = clamp(lv, 0, 0.999) * (R.length - 1);
        let i = Math.floor(f);
        const fr = f - i;
        if (this.pix) {
          if (fr > 0.55) i++;
        } else if (fr > 0.72 || (fr > 0.45 && BAYER[(x & 1) + (y & 1) * 2] < 0.5)) i++;
        let col = R[Math.min(R.length - 1, i)];
        if (tx.col) col = mix(col, hex(tx.col), tx.k ?? 0.5);
        if (this.pix) {
          // (Its shine in pops: the lightest of its ramp, then near white.)
          if (spec > 0.5) col = mix(R[R.length - 1], [255, 252, 240], 0.7);
          else if (spec > 0.22) col = mix(R[R.length - 1], [255, 250, 236], 0.25);
        } else if (spec > 0.08) col = mix(col, [255, 250, 236], clamp(spec, 0, 0.85));
        if (rim > 0.05) col = mix(col, hex(o.rim || '#b8d0ff'), clamp(rim * 0.5, 0, 0.45));
        if (tx.glint) col = mix(col, [255, 255, 255], 0.8);
        if (tx.glow) col = mix(col, hex(tx.glow[0]), tx.glow[1]);
        if (p.o.glow) col = mix(col, hex(p.o.glow), p.o.glowK ?? 0.5);
        out.set(x, y, col);
      }
    }
    // A dark line where one part passes in front of another.
    const line = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (owner[idx] < 0) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (owner[j] < 0 || gid[j] === gid[idx]) continue;
          // (The farther of the two takes the line.)
          if (height[j] - height[idx] > 1.5) line[idx] = 1;
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (!line[i]) continue;
      const x = i % W;
      const y = (i / W) | 0;
      out.set(x, y, mix(shade(out.get(x, y), 0.45), [24, 16, 36], 0.4));
    }
    this.height = height;
    this.owner = owner;
    this.U = U;
    this.V = V;
    this.gid = gid;
    if (o.outline !== false) outlineSel(out);
    return out;
  }
}

// A sculpt's picture with things laid over it afterwards (glows, eyes).
export { MATS };
