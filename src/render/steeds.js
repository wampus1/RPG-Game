// (Round 82) Horses and wagons in the round. Each is a little model of
// boxes (a horse's barrel, legs, neck and head; a wagon's bed, bench,
// shafts, hooped canvas and spoked wheels), drawn turned to whatever way
// it's heading, the way the world's own cubes are drawn: every face that
// can be seen, pixel by pixel, the nearest kept, lit from the upper left
// so its sides darken and brighten as it comes round. Worked out once for
// each of TURNS headings (and each step of its legs or turn of its
// wheels) and kept; between, it's one picture.
//   Model space: f forward (toward the head, or the horse in the shafts),
// r to its right, h up; in tiles (16 pixels across, 12 up). A heading `a`
// is the view's (see Renderer.toView): forward on screen is (sin a,
// cos a), as a raft's is.
import { TILE, LH } from '../config.js';
import { HORSE_COATS } from './sprites.js';

export const TURNS = 48;
const TAU = Math.PI * 2;

// ------------------------------------------------------------- colour
const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
function rgb(hex) {
  const n = parseInt(String(hex || '#808080').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const col = (hex) => {
  const [r, g, b] = rgb(hex);
  return pack(r, g, b);
};
function shade(c, f) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return pack(cl(c & 255), cl((c >>> 8) & 255), cl((c >>> 16) & 255));
}
const OUTLINE = pack(28, 22, 34);
const SHADOW = pack(10, 8, 16, 80);
// Light: from up and to the left, a little toward you.
const LIGHT = (() => {
  const v = [-0.5, 0.42, 0.76];
  const n = Math.hypot(...v);
  return v.map((q) => q / n);
})();

// ------------------------------------------------------------- the models
// A box: [f0, f1] x [r0, r1] x [h0, h1], and how each pixel of it looks:
// `paint(p, face)` (p its point in model space, face 'top', 'f', 'r')
// gives a colour, or 0 for none (a gap: the wheel's round, say).
const box = (f0, f1, r0, r1, h0, h1, paint) => ({ f0, f1, r0, r1, h0, h1, paint: typeof paint === 'function' ? paint : () => paint });

function horseParts(o, df = 0) {
  const coat = col(HORSE_COATS[(o.coat || 0) % HORSE_COATS.length]);
  const dark = shade(coat, 0.72);
  const light = shade(coat, 1.15);
  const mane = (o.coat || 0) === 4 ? col('#c8c0b0') : (o.coat || 0) === 3 ? col('#e8e8e8') : col('#2a2024');
  const hoof = col('#1a1420');
  const blaze = (o.coat || 0) % 3 === 1;
  const parts = [];
  const F = (v) => v + df;
  // Legs (walking: each pair swings in turn, the lifted one off the
  // ground), dark at the hoof.
  const sw = o.frame === 1 ? 0.11 : o.frame === 2 ? -0.11 : 0;
  const leg = (f, r, s, far) => {
    const lift = s > 0 ? 0.06 : 0;
    const c = far ? dark : coat;
    parts.push(box(F(f + s - 0.05), F(f + s + 0.05), r - 0.05, r + 0.05, lift, 0.62, (p) => (p.h < lift + 0.08 ? hoof : c)));
  };
  leg(0.42, -0.15, sw, false);
  leg(0.42, 0.15, -sw, true);
  leg(-0.42, -0.15, -sw, false);
  leg(-0.42, 0.15, sw, true);
  // The barrel of a body, a deeper chest and a rounded rump, light along
  // the back.
  const body = (p, face) => (face === 'top' ? light : p.h < 0.66 ? dark : coat);
  parts.push(box(F(-0.5), F(0.5), -0.23, 0.23, 0.58, 0.98, body));
  parts.push(box(F(0.48), F(0.68), -0.2, 0.2, 0.62, 1.02, body));
  parts.push(box(F(-0.7), F(-0.48), -0.21, 0.21, 0.62, 1.0, body));
  // The neck, rising forward to the head; the mane along its crest.
  parts.push(box(F(0.56), F(0.78), -0.11, 0.11, 0.95, 1.2, coat));
  parts.push(box(F(0.64), F(0.86), -0.1, 0.1, 1.18, 1.42, coat));
  parts.push(box(F(0.6), F(0.66), -0.035, 0.035, 1.02, 1.46, mane));
  // The head (a long face, darker at the muzzle), its ears pricked.
  parts.push(box(F(0.74), F(1.12), -0.1, 0.1, 1.3, 1.54, (p, face) => {
    if (blaze && face === 'f') return col('#f0ece0');
    if (blaze && face === 'top' && Math.abs(p.r) < 0.03) return col('#f0ece0');
    return p.f > F(1.02) ? shade(coat, 0.8) : coat;
  }));
  parts.push(box(F(0.74), F(0.8), -0.09, -0.04, 1.54, 1.65, dark));
  parts.push(box(F(0.74), F(0.8), 0.04, 0.09, 1.54, 1.65, dark));
  // A full tail.
  parts.push(box(F(-0.86), F(-0.7), -0.04, 0.04, 0.45, 0.96, mane));
  // Its saddle (and a trader's cloth in their colours under it, a gold
  // coin sewn on).
  if (o.banner) {
    const b = col(o.banner);
    parts.push(box(F(-0.26), F(0.22), -0.25, 0.25, 0.72, 0.99, (p, face) => (face === 'r' && Math.abs(p.f - F(-0.02)) < 0.05 && Math.abs(p.h - 0.85) < 0.05 ? col('#f0d040') : b)));
  }
  if (o.saddle) {
    parts.push(box(F(-0.2), F(0.2), -0.24, 0.24, 0.98, 1.04, col('#5a3a20')));
    parts.push(box(F(-0.22), F(-0.14), -0.12, 0.12, 1.04, 1.1, col('#4a2e18')));
  }
  return parts;
}

// A spoked wheel: thin slabs stacked into its round (`turn` how far
// round it's rolled).
function wheel(parts, f, r0, r1, R, turn) {
  const wood = col('#7a5430');
  const woodD = shade(wood, 0.62);
  const woodL = shade(wood, 1.25);
  const N = 8;
  for (let i = 0; i < N; i++) {
    const h0 = (i / N) * 2 * R;
    const h1 = ((i + 1) / N) * 2 * R;
    const hm = (h0 + h1) / 2 - R;
    const w = Math.sqrt(Math.max(0, R * R - hm * hm));
    if (w < 0.03) continue;
    parts.push(box(f - w, f + w, r0, r1, h0, h1, (p, face) => {
      if (face !== 'r') return woodD;
      const dx = p.f - f;
      const dy = p.h - R;
      const d = Math.hypot(dx, dy);
      if (d > R) return 0;
      if (d > R * 0.78) return woodD;
      if (d < R * 0.22) return d < R * 0.1 ? col('#2a2024') : woodD;
      // Four spokes, turning.
      const a = Math.atan2(dy, dx) - turn;
      const k = Math.abs(Math.sin(a * 2));
      return k < 0.32 ? woodL : 0;
    }));
  }
}

// (Round 84) A wagon in its people's look (see lookart.js): its wood, its
// canvas, and how the canvas is worked.
const WAGON_LOOKS = [
  { wood: '#7a5430', cloth: '#c8bc9c' },
  { wood: '#4e4a34', cloth: '#9aa278', band: '#6a7a42' },
  { wood: '#a89c84', cloth: '#dcdccc', patch: '#b8c4cc' },
  { wood: '#8a2a22', cloth: '#d8b860', band: '#a82a24', rim: '#e8c050' },
  { wood: '#9a6a3a', cloth: '#ecd6a4', stripe: '#c86a3a' },
  { wood: '#4a3a2a', cloth: '#9a7a5a', band: '#5a4632' },
  { wood: '#8a6a4a', cloth: '#f0ece0', band: '#6a3a8a', rim: '#c8a040' },
  { wood: '#3a3034', cloth: '#5a3a30', band: '#b84a2a', rim: '#c88a30' },
];

function wagonParts(o) {
  const W = WAGON_LOOKS[o.look || 0] || WAGON_LOOKS[0];
  const wood = col(W.wood);
  const woodD = shade(wood, 0.7);
  const woodL = shade(wood, 1.2);
  const cloth = o.banner && !o.look ? col('#ece4cc') : col(W.cloth);
  const rim = W.rim ? col(W.rim) : null;
  const parts = [];
  // The bed: a floor of planks, low sides (a rail, open), boards fore and
  // aft.
  const planks = (p, face) => (face === 'top' ? ((Math.floor((p.r + 0.6) * 10) % 2) ? wood : woodL) : woodD);
  parts.push(box(-2.1, 0.02, -0.56, 0.56, 0.42, 0.55, planks));
  const rail = (p, face) => (face === 'top' ? woodL : Math.floor((p.f + 3) * 5) % 3 === 0 ? woodD : wood);
  if (o.hood !== true) {
    parts.push(box(-2.1, 0.02, 0.5, 0.56, 0.55, 0.82, rail));
    parts.push(box(-2.1, 0.02, -0.56, -0.5, 0.55, 0.82, rail));
  }
  parts.push(box(-2.1, -2.04, -0.56, 0.56, 0.55, 0.82, rail));
  // The bench, its back rest, the shafts out front.
  parts.push(box(-0.14, 0.3, -0.5, 0.5, 0.55, 0.75, (p, face) => (face === 'top' ? woodL : wood)));
  parts.push(box(-0.2, -0.12, -0.5, 0.5, 0.55, 1.0, (p, face) => (face === 'top' ? woodL : woodD)));
  parts.push(box(0.3, 1.75, -0.33, -0.27, 0.5, 0.56, woodD));
  parts.push(box(0.3, 1.75, 0.27, 0.33, 0.5, 0.56, woodD));
  // The canvas on its hoops over the bed: a trader's with their colours
  // and the scales on its sides; or, with people in the back, rolled up to
  // a bundle at the tail, the bare hoops arching over them.
  const arch = (r) => 0.86 + 0.72 * Math.sqrt(Math.max(0, 1 - (r / 0.62) ** 2));
  const S = 7;
  if (o.hood === true) {
    const b = o.banner ? col(o.banner) : 0;
    for (let i = 0; i < S; i++) {
      const r0 = -0.58 + (i * 1.16) / S;
      const r1 = r0 + 1.16 / S;
      const h1 = arch((r0 + r1) / 2);
      parts.push(box(-2.02, -0.24, r0, r1, 0.82, h1, (p, face) => {
        // (A seam between each strip of the canvas.)
        let seam = Math.floor((p.f + 3) * 3.4) % 2 === 0 && face === 'top' ? shade(cloth, 0.9) : cloth;
        // (Its people's way with it: stripes, a band, patches, a gilt hem.)
        if (W.stripe && Math.floor((p.f + 3) * 2.5) % 2 === 0) seam = col(W.stripe);
        if (W.band && p.h > 1.05 && p.h < 1.2 && face !== 'top') seam = col(W.band);
        if (W.patch && Math.floor((p.f + 3) * 4) % 5 === 2 && Math.floor(p.h * 9) % 3 === 1) seam = col(W.patch);
        if (rim && p.h < 0.9) seam = rim;
        if (b && face === 'r' && p.f > -1.75 && p.f < -0.5 && p.h > 0.92 && p.h < 1.3) {
          if (Math.abs(p.h - 1.2) < 0.03 && p.f > -1.4 && p.f < -0.85) return col('#f0d040');
          if (Math.abs(p.f - -1.12) < 0.03 && p.h > 1.0 && p.h < 1.22) return col('#f0d040');
          return p.h < 0.97 ? shade(b, 0.7) : b;
        }
        if (face === 'f') return shade(cloth, 0.88);
        return seam;
      }));
    }
  } else if (o.hood === 'open') {
    for (const f of [-0.45, -1.1, -1.75]) {
      for (let i = 0; i < S; i++) {
        const r0 = -0.58 + (i * 1.16) / S;
        const r1 = r0 + 1.16 / S;
        const h1 = arch((r0 + r1) / 2);
        parts.push(box(f - 0.03, f + 0.03, r0, r1, h1 - 0.1, h1, woodD));
      }
    }
    parts.push(box(-2.04, -1.86, -0.56, 0.56, 0.82, 1.08, (p, face) => (face === 'top' ? cloth : shade(cloth, 0.82))));
    if (o.banner) parts.push(box(-2.0, -1.9, -0.58, -0.56, 0.86, 1.04, col(o.banner)));
  }
  // The wheels, outside the bed: two under the bench, two at the tail.
  const turn = ((o.frame || 0) % 4) * (Math.PI / 8);
  for (const f of [-0.3, -1.72]) {
    wheel(parts, f, 0.57, 0.64, 0.42, turn);
    wheel(parts, f, -0.64, -0.57, 0.42, turn);
  }
  // The horse in the shafts.
  if (o.horse) parts.push(...horseParts({ ...o.horse, frame: o.legs || 0 }, 1.25));
  return parts;
}

// ------------------------------------------------------------- drawing
// Every seen face of every box, into a buffer of pixels with how near each
// is kept (nearer is higher up, along the line you look down: see h).
function raster(parts, a) {
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  // Model (f, r, h) to the screen, in pixels from the origin.
  const sx = (f, r) => (f * sa - r * ca) * TILE;
  const sy = (f, r, h) => (f * ca + r * sa) * TILE - h * LH;
  // Faces: a corner, two edges (model), and its normal (model).
  const faces = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const toward = (nf, nr, nh) => {
    const nu = nf * sa - nr * ca;
    const nv = nf * ca + nr * sa;
    return { nu, nv, nh, see: nv * 0.6 + nh * 0.8 };
  };
  for (const b of parts) {
    const df = b.f1 - b.f0;
    const dr = b.r1 - b.r0;
    const dh = b.h1 - b.h0;
    const cand = [
      ['top', [b.f0, b.r0, b.h1], [df, 0, 0], [0, dr, 0], [0, 0, 1]],
      ['f', [b.f1, b.r0, b.h0], [0, dr, 0], [0, 0, dh], [1, 0, 0]],
      ['f', [b.f0, b.r0, b.h0], [0, dr, 0], [0, 0, dh], [-1, 0, 0]],
      ['r', [b.f0, b.r1, b.h0], [df, 0, 0], [0, 0, dh], [0, 1, 0]],
      ['r', [b.f0, b.r0, b.h0], [df, 0, 0], [0, 0, dh], [0, -1, 0]],
    ];
    for (const [kind, o, e1, e2, n] of cand) {
      const t = toward(n[0], n[1], n[2]);
      if (t.see <= 0.001) continue;
      const lit = 0.56 + 0.44 * Math.max(0, t.nu * LIGHT[0] + t.nv * LIGHT[1] + t.nh * LIGHT[2]);
      const P = [sx(o[0], o[1]), sy(o[0], o[1], o[2])];
      const E1 = [sx(o[0] + e1[0], o[1] + e1[1]) - P[0], sy(o[0] + e1[0], o[1] + e1[1], o[2] + e1[2]) - P[1]];
      const E2 = [sx(o[0] + e2[0], o[1] + e2[1]) - P[0], sy(o[0] + e2[0], o[1] + e2[1], o[2] + e2[2]) - P[1]];
      const det = E1[0] * E2[1] - E1[1] * E2[0];
      if (Math.abs(det) < 0.05) continue;
      faces.push({ b, kind, o, e1, e2, P, E1, E2, det, lit });
      for (const [qx, qy] of [P, [P[0] + E1[0], P[1] + E1[1]], [P[0] + E2[0], P[1] + E2[1]], [P[0] + E1[0] + E2[0], P[1] + E1[1] + E2[1]]]) {
        x0 = Math.min(x0, qx);
        y0 = Math.min(y0, qy);
        x1 = Math.max(x1, qx);
        y1 = Math.max(y1, qy);
      }
    }
  }
  // (A pixel's margin round it, for the outline; the shadow's room below.)
  const ox = Math.ceil(-x0) + 2;
  const oy = Math.ceil(-y0) + 2;
  const w = Math.ceil(x1 - x0) + 5;
  const h = Math.ceil(y1 - y0) + 6;
  const px = new Uint32Array(w * h);
  const depth = new Float32Array(w * h).fill(-1e9);
  for (const F of faces) {
    const { P, E1, E2, det, o, e1, e2, b, kind, lit } = F;
    const qx0 = Math.max(0, Math.floor(Math.min(P[0], P[0] + E1[0], P[0] + E2[0], P[0] + E1[0] + E2[0]) + ox));
    const qx1 = Math.min(w - 1, Math.ceil(Math.max(P[0], P[0] + E1[0], P[0] + E2[0], P[0] + E1[0] + E2[0]) + ox));
    const qy0 = Math.max(0, Math.floor(Math.min(P[1], P[1] + E1[1], P[1] + E2[1], P[1] + E1[1] + E2[1]) + oy));
    const qy1 = Math.min(h - 1, Math.ceil(Math.max(P[1], P[1] + E1[1], P[1] + E2[1], P[1] + E1[1] + E2[1]) + oy));
    for (let y = qy0; y <= qy1; y++) {
      for (let x = qx0; x <= qx1; x++) {
        const dx = x + 0.5 - ox - P[0];
        const dy = y + 0.5 - oy - P[1];
        const s = (dx * E2[1] - dy * E2[0]) / det;
        const t = (E1[0] * dy - E1[1] * dx) / det;
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
        const p = { f: o[0] + s * e1[0] + t * e2[0], r: o[1] + s * e1[1] + t * e2[1], h: o[2] + s * e1[2] + t * e2[2] };
        const i = y * w + x;
        if (p.h <= depth[i]) continue;
        const c = b.paint(p, kind);
        if (!c) continue;
        depth[i] = p.h;
        px[i] = shade(c, lit);
      }
    }
  }
  return { px, w, h, ox, oy, sx, sy };
}

// A dark line round it, as the world's sprites have; and its shadow on
// the ground under it (a soft patch the shape of its footprint).
function finish(R, foot) {
  const { px, w, h } = R;
  const out = px.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (px[i]) continue;
      if ((x > 0 && px[i - 1]) || (x < w - 1 && px[i + 1]) || (y > 0 && px[i - w]) || (y < h - 1 && px[i + w])) out[i] = OUTLINE;
    }
  }
  if (foot) {
    const [f0, f1, r0, r1] = foot;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (out[i]) continue;
        // (The ground point under this pixel, h = 0.)
        const u = (x + 0.5 - R.ox) / TILE;
        const v = (y + 0.5 - R.oy) / TILE;
        const sa = R.sa;
        const ca = R.ca;
        const f = u * sa + v * ca;
        const r = -u * ca + v * sa;
        if (f >= f0 && f <= f1 && r >= r0 && r <= r1) out[i] = SHADOW;
      }
    }
  }
  return out;
}

const cache = new Map();
const CACHE_MAX = 700;

// The picture of a horse (`o`: coat, banner, saddle, frame) or a wagon
// (`o`: banner, hood, frame, horse: { coat, saddle } | null, legs), turned
// to the view's heading `a`: { img, ox, oy } (where its origin, the
// rider's seat on the ground, falls in it), and `at(f, r, h)` for where a
// point of it falls from there.
export function steedSprite(kind, o, a, makeCanvas) {
  const k = ((Math.round((a / TAU) * TURNS) % TURNS) + TURNS) % TURNS;
  const key = `${kind}|${k}|${o.coat || 0}|${o.banner || ''}|${o.saddle ? 1 : 0}|${o.hood === true ? 1 : o.hood === 'open' ? 2 : 0}|${o.frame || 0}|${o.legs || 0}|${o.horse ? `${o.horse.coat || 0}${o.horse.saddle ? 's' : ''}` : '-'}|${o.look || 0}`;
  let got = cache.get(key);
  if (got) {
    // (Kept as the most recently wanted.)
    cache.delete(key);
    cache.set(key, got);
    return got;
  }
  const ang = (k / TURNS) * TAU;
  const parts = kind === 'horse' ? horseParts(o) : wagonParts(o);
  const R = raster(parts, ang);
  R.sa = Math.sin(ang);
  R.ca = Math.cos(ang);
  const foot = kind === 'horse' ? [-0.75, 0.95, -0.28, 0.28] : [-2.15, o.horse ? 2.2 : 0.35, -0.66, 0.66];
  const out = finish(R, foot);
  const img = makeCanvas(R.w, R.h);
  const ctx = img.getContext('2d');
  const id = ctx.createImageData(R.w, R.h);
  new Uint32Array(id.data.buffer).set(out);
  ctx.putImageData(id, 0, 0);
  got = { img, ox: R.ox, oy: R.oy, at: (f, r, h) => ({ x: R.sx(f, r), y: R.sy(f, r, h) }), ang };
  cache.set(key, got);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return got;
}

// (For the tests: the pixels of one, without a canvas.)
export function steedPixels(kind, o, a) {
  const parts = kind === 'horse' ? horseParts(o) : wagonParts(o);
  const R = raster(parts, a);
  R.sa = Math.sin(a);
  R.ca = Math.cos(a);
  return { ...R, px: finish(R, null) };
}

// A world heading from a facing (0 down the world's z, 1 toward -x, 2
// toward -z, 3 toward +x), as a raft's is (see entities/raft.js).
export function dirAngle(d) {
  return [0, -Math.PI / 2, Math.PI, Math.PI / 2][d & 3];
}

// An angle eased toward another the short way round, at most `rate` a
// second.
export function easeAngle(from, to, rate, dt) {
  let d = ((to - from) % TAU + TAU * 1.5) % TAU - Math.PI;
  const step = rate * dt;
  if (Math.abs(d) <= step) return to;
  return from + Math.sign(d) * step;
}
