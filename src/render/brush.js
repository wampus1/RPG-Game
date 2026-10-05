// Painting the openings and the great scenes (round 51; see game/intros.js,
// game/starfall.js, game/eruption.js, game/wallfall.js): pictures made a
// pixel at a time the way a pixel artist would, into an RGBA bitmap, and
// turned into a canvas to be layered and moved about.
//
// The ways of it:
//   - colour ramps that shift hue as they go (shadows cooler and a little
//     richer, lights warmer and paler), never a colour simply darkened;
//   - what's far off fading into the air (paler, bluer, flatter);
//   - everything lit from one side (the upper left, unless told), its
//     shadow on the other;
//   - leaves, clouds and rock in clusters, not noise: lobes of a few tones
//     each, lit along their tops;
//   - a line of a lighter tone round what stands against the sky.
//
// Colours are [r, g, b] arrays (0-255) here; hex where it says so.

// ------------------------------------------------------------ colour
export function rgb(h) {
  if (Array.isArray(h)) return h;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hex(c) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(c[0])}${f(c[1])}${f(c[2])}`;
}
export function mixC(a, b, k) {
  a = rgb(a);
  b = rgb(b);
  const t = Math.max(0, Math.min(1, k));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function toHsl(c) {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
export function fromHsl([h, s, l]) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
// Turn hue `h` toward `to` by up to `by` degrees (the short way round).
function hueToward(h, to, by) {
  let d = ((to - h + 540) % 360) - 180;
  if (Math.abs(d) < by) return to;
  return h + Math.sign(d) * by;
}
// A ramp of `n` tones about `base` (hex or rgb), darkest first: the dark
// ones turned toward blue-violet and a little richer, the light ones toward
// yellow and paler. `spread`: how far apart in lightness the ends are.
export function ramp(base, n = 5, { spread = 0.42, shift = 22, cool = 245, warm = 52 } = {}) {
  const [h, s, l] = toHsl(base);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const ll = Math.max(0.03, Math.min(0.97, l + t * spread));
    const hh = t < 0 ? hueToward(h, cool, -t * 2 * shift) : hueToward(h, warm, t * 2 * shift);
    const ss = Math.max(0, Math.min(1, s * (1 - Math.abs(t) * 0.3) + (t < 0 ? 0.06 : -0.02)));
    out.push(fromHsl([hh, ss, ll]));
  }
  return out;
}
// A colour seen through `k` of air (0 near, 1 lost in it).
export const fog = (c, air, k) => mixC(c, air, k);

// ------------------------------------------------------------ noise
export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483587)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s);
  const b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s);
  const d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) {
  let t = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    t += vnoise(x, y, s + i * 97) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return t / norm;
}
// A seeded random (for placing things).
export function rngOf(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------ the bitmap
export class Bmp {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const o = (y * this.w + x) * 4;
    const d = this.d;
    if (a >= 1) {
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const ea = d[o + 3] / 255;
    const na = a + ea * (1 - a);
    for (let i = 0; i < 3; i++) d[o + i] = (c[i] * a + d[o + i] * ea * (1 - a)) / na;
    d[o + 3] = na * 255;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const o = (y * this.w + x) * 4;
    return this.d[o + 3] ? [this.d[o], this.d[o + 1], this.d[o + 2]] : null;
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  rect(x, y, w, h, c, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  // Another bitmap laid over this one (its own alpha), at (dx, dy).
  blit(src, dx = 0, dy = 0) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const o = (y * src.w + x) * 4;
        const a = src.d[o + 3];
        if (a) this.set(x + dx, y + dy, [src.d[o], src.d[o + 1], src.d[o + 2]], a / 255);
      }
    }
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    const im = g.createImageData(this.w, this.h);
    im.data.set(this.d);
    g.putImageData(im, 0, 0);
    return c;
  }
  // A pen for the shape-drawers in scenekit.js: px(x, y, hex).
  pen(alpha = () => 1) {
    return (x, y, col) => this.set(x, y, rgb(col), alpha());
  }
}

// A filled polygon (pixel centres), `col(x, y)` the colour of each pixel.
export function poly(b, pts, col, a = 1) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.ceil(Math.min(...ys) - 0.5);
  const y1 = Math.floor(Math.max(...ys) - 0.5);
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
        const c = typeof col === 'function' ? col(x, y) : col;
        if (c) b.set(x, y, c, a);
      }
    }
  }
}
export function seg(b, x0, y0, x1, y1, col, a = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    b.set(x0, y0, typeof col === 'function' ? col(x0, y0) : col, a);
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
// An outline of `col` round whatever's drawn in `b` (where an empty pixel
// touches a full one), on the sides given (default all four).
export function outline(b, col, { a = 1, sides = [[1, 0], [-1, 0], [0, 1], [0, -1]], only = null } = {}) {
  const add = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.alpha(x, y)) continue;
      if (sides.some(([dx, dy]) => b.alpha(x + dx, y + dy) > 200)) add.push([x, y]);
    }
  }
  for (const [x, y] of add) if (!only || only(x, y)) b.set(x, y, typeof col === 'function' ? col(x, y) : col, a);
}

// ------------------------------------------------------------ sky
// A sky in bands, from `stops` ([[y, colour], ...] top to bottom), the
// edges between them dithered a row or two (as a pixel artist would, not
// smoothly).
export function sky(b, stops, x0 = 0, x1 = b.w) {
  for (let y = 0; y < b.h; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [ya, ca] = stops[i];
    const [yb, cb] = stops[Math.min(stops.length - 1, i + 1)];
    const k = yb === ya ? 0 : Math.max(0, Math.min(1, (y - ya) / (yb - ya)));
    // (Quantised to steps, each step dithered into the next.)
    const steps = 6;
    const q = k * steps;
    const lo = Math.floor(q);
    const fr = q - lo;
    for (let x = x0; x < x1; x++) {
      const up = fr > 0.66 || (fr > 0.33 && (x + y) % 2 === 0);
      b.set(x, y, mixC(ca, cb, (lo + (up ? 1 : 0)) / steps));
    }
  }
}

// Stars: a few bright with a cross, most a single pixel; a band of dimmer
// ones (the river of the sky) dithered across.
export function stars(b, yMax, seed, { band = true, n = 140 } = {}) {
  const r = rngOf(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * b.w);
    const y = Math.floor(r() * yMax);
    const k = r();
    const c = k > 0.92 ? [255, 250, 230] : k > 0.6 ? [220, 228, 255] : [170, 180, 220];
    b.set(x, y, c, 0.5 + k * 0.5);
    if (k > 0.97) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + dy, c, 0.35);
    }
  }
  if (band) {
    for (let x = 0; x < b.w; x++) {
      const yc = yMax * 0.15 + x * 0.32;
      for (let dy = -16; dy <= 16; dy++) {
        const y = Math.round(yc + dy);
        if (y < 0 || y >= yMax) continue;
        const n = fbm(x * 0.07, y * 0.07, seed + 5) * (1 - Math.abs(dy) / 16);
        if (n > 0.3 && hash2(x, y, seed) < n * 0.5) b.set(x, y, [150, 150, 210], 0.12 + n * 0.25);
      }
    }
  }
}

// ------------------------------------------------------------ clouds
// A heaped cloud, `w` by `h` with its flat base at (cx, by): lobes, the
// ones behind and above painted first, each lit along its top and shaded
// under; a rim of `rim` round the whole. `pal`: [dark, shade, mid, light,
// lit] (rgb).
export function cloud(seed, w, h, pal, { rim = null, flat = 0.35 } = {}) {
  const b = new Bmp(Math.ceil(w) + 4, Math.ceil(h) + 4);
  const r = rngOf(seed);
  const lobes = [];
  // A row along the base, then heaped up toward the middle.
  const nBase = Math.max(2, Math.round(w / 11));
  for (let i = 0; i < nBase; i++) {
    const t = nBase === 1 ? 0.5 : i / (nBase - 1);
    const rx = w / (nBase * 1.4) + r() * 2;
    lobes.push({ x: 2 + rx + t * (w - rx * 2), y: h + 2 - rx * flat * 1.4 - 1, rx, ry: rx * 0.72 });
  }
  const nUp = Math.max(1, Math.round(w / 16));
  for (let i = 0; i < nUp; i++) {
    const t = (i + 0.5) / nUp;
    const hump = Math.sin(t * Math.PI);
    const rx = (w / (nUp * 1.6)) * (0.8 + hump * 0.5) + r() * 2;
    lobes.push({ x: 2 + w * (0.15 + t * 0.7) + (r() - 0.5) * 4, y: h + 2 - h * (0.45 + hump * 0.32) + rx * 0.3, rx, ry: rx * 0.8 });
  }
  lobes.sort((p, q) => p.y - q.y);
  const [dark, shade, mid, light, lit] = pal;
  for (const L of lobes) {
    for (let y = Math.floor(L.y - L.ry - 1); y <= Math.ceil(L.y + L.ry + 1); y++) {
      if (y > h + 2) continue;
      for (let x = Math.floor(L.x - L.rx - 1); x <= Math.ceil(L.x + L.rx + 1); x++) {
        const nx = (x - L.x) / L.rx;
        const ny = (y - L.y) / L.ry;
        const e = nx * nx + ny * ny + (hash2(x, y, seed) - 0.5) * 0.12;
        if (e > 1) continue;
        // (Lit from above and the left.)
        const k = -ny * 0.85 - nx * 0.35 + (e > 0.75 ? 0.05 : 0);
        const c = k > 0.62 ? lit : k > 0.25 ? light : k > -0.15 ? mid : k > -0.5 ? shade : dark;
        b.set(x, y, c);
      }
    }
  }
  // (Its belly: flat, the darkest.)
  for (let x = 0; x < b.w; x++) {
    for (let y = b.h - 1; y >= 0; y--) {
      if (!b.alpha(x, y)) continue;
      b.set(x, y, dark);
      break;
    }
  }
  if (rim) outline(b, rim, { a: 0.55 });
  return b;
}

// ------------------------------------------------------------ land
// A range of mountains along `base` (the line their feet are lost in),
// peaks up to `top`. Their faces are worked out from a ridged relief
// (spurs running down from the peaks, gullies between) lit from the upper
// left: five tones of `pal` by how much each bit faces the light; snow on
// the heights (its line ragged, deeper in the gullies); the air thickening
// toward their feet. Returns the skyline (for what stands in front).
export function ridged(x, y, s, oct = 4) {
  let t = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x, y, s + i * 31) * 2 - 1);
    t += n * n * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.1;
    y *= 2.1;
  }
  return t / norm;
}
export function mountains(b, { seed, base, top, peaks = 4, pal, snow = null, air = null, airK = 0.4, x0 = 0, x1 = b.w, rough = 1, light = 1 }) {
  const r = rngOf(seed);
  const P = [];
  for (let i = 0; i < peaks; i++) {
    const t = (i + 0.2 + r() * 0.6) / peaks;
    P.push({ x: x0 + t * (x1 - x0), h: (base - top) * (0.55 + r() * 0.45), w: ((x1 - x0) / peaks) * (0.75 + r() * 0.7) });
  }
  const sky = new Float32Array(b.w);
  // The relief: rising to each peak, ridged; its height at (x, y) is how
  // far it stands out toward you there.
  const relief = (x, y) => {
    let m = 0;
    for (const p of P) {
      const dx = (x - p.x) / p.w;
      const dy = (y - (base - p.h)) / (p.h + 1);
      m = Math.max(m, 1 - Math.abs(dx) * 1.1 - Math.max(0, dy) * 0.25);
    }
    // (Spurs slanting down and out from the crest, either side of a peak.)
    let near = P[0];
    for (const p of P) if (Math.abs(x - p.x) < Math.abs(x - near.x)) near = p;
    const side = x < near.x ? -1 : 1;
    const u = (x - near.x) * 0.055 + side * (y - base) * 0.03;
    return m * 0.8 + ridged(u, y * 0.05 + (x - near.x) * side * 0.012, seed) * 0.55 * rough;
  };
  for (let x = 0; x < b.w; x++) {
    let hh = 0;
    for (const p of P) {
      const d = Math.abs(x - p.x) / p.w;
      if (d < 1) hh = Math.max(hh, p.h * Math.pow(1 - d, 1.1));
    }
    hh += (fbm(x * 0.07, 0.5, seed) - 0.5) * 8 * rough + (ridged(x * 0.09, 2.1, seed + 5) - 0.5) * 5 * rough;
    sky[x] = base - Math.max(2, hh);
  }
  for (let x = Math.max(0, x0); x < Math.min(b.w, x1); x++) {
    const yTop = Math.round(sky[x]);
    for (let y = yTop; y <= base; y++) {
      const depth = (y - yTop) / Math.max(1, base - yTop);
      const ex = relief(x - 1, y) - relief(x + 1, y);
      const ey = relief(x, y - 1) - relief(x, y + 1);
      // (The light from the upper left: facing it, lighter.)
      const f = (ex * 1.0 + ey * 0.6) * 9 * light - depth * 0.35 + (hash2(x, y, seed) - 0.5) * 0.12;
      let c = f > 0.5 ? pal[4] : f > 0.12 ? pal[3] : f > -0.2 ? pal[2] : f > -0.55 ? pal[1] : pal[0];
      if (snow) {
        const line = snow.y + (fbm(x * 0.12, 1.7, seed + 3) - 0.5) * 10 + (f < 0 ? 4 : -2);
        if (y < line) c = f > 0.3 ? snow.pal[3] || snow.pal[2] : f > -0.05 ? snow.pal[2] : f > -0.4 ? snow.pal[1] : snow.pal[0];
      }
      if (air) c = mixC(c, air, Math.min(1, airK * (0.35 + depth * 0.9)));
      b.set(x, y, c);
    }
    // (The skyline a shade lighter, where it catches the light.)
    const sl = sky[Math.max(0, x - 1)] - sky[Math.min(b.w - 1, x + 1)];
    if (sl > 0.2) b.set(x, yTop, snow && yTop < snow.y ? snow.pal[3] || snow.pal[2] : air ? mixC(pal[4], air, airK * 0.3) : pal[4]);
  }
  return sky;
}

// A line of rolling hills: `y(x)` their crest; shaded by slope, lighter
// along the top, `pal` [dark, mid, light, lit].
export function hills(b, crest, bottom, pal, { seed = 1, air = null, airK = 0, texture = 0.5 } = {}) {
  for (let x = 0; x < b.w; x++) {
    const top = Math.round(crest(x));
    const sl = crest(x - 2) - crest(x + 2);
    for (let y = top; y < bottom; y++) {
      const depth = (y - top) / Math.max(1, bottom - top);
      const n = fbm(x * 0.08, y * 0.12, seed) - 0.5;
      const k = sl * 0.25 + n * texture - depth * 0.3 + (y - top < 2 ? 0.5 : 0);
      let c = k > 0.35 ? pal[3] : k > 0.05 ? pal[2] : k > -0.3 ? pal[1] : pal[0];
      if (air) c = mixC(c, air, airK * (1 - depth * 0.5));
      b.set(x, y, c);
    }
  }
}

// ------------------------------------------------------------ trees
// A broad-leaved tree (an oak, an autumn maple): a trunk forking up into a
// crown of leaf clumps, each lit from the upper left, darker underneath,
// a rim of the darkest round its shadowed side. `pal`: five leaf tones
// (dark to lit); `bark`: three. Drawn into `b` with its foot at (x, yb).
export function broadTree(b, x, yb, s, pal, bark, seed, { lean = 0, squash = 1, sway = 0 } = {}) {
  const r = rngOf(seed);
  const trunkH = Math.round(s * 0.3);
  const tw = Math.max(1, Math.round(s * 0.09));
  // The trunk, lit on the left; a root flare; two branches up into it.
  for (let i = 0; i < trunkH + Math.round(s * 0.25); i++) {
    const y = yb - i;
    const off = Math.round(lean * i * 0.1);
    const w = tw + (i < 2 ? 1 : 0);
    for (let k = -w; k <= w; k++) b.set(x + k + off, y, k < 0 ? bark[2] : k > 0 ? bark[0] : bark[1]);
  }
  for (const sd of [-1, 1]) seg(b, x + Math.round(lean * trunkH * 0.1), yb - trunkH, x + sd * s * 0.22, yb - trunkH - s * 0.25, bark[0]);
  // The crown: clumps round a centre above the trunk.
  const cx = x + Math.round(lean * trunkH * 0.12);
  const cy = yb - trunkH - s * 0.42 * squash;
  const R = s * 0.56;
  const clumps = [];
  const n = 5 + Math.round(s / 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * 0.6;
    clumps.push({ x: cx + Math.cos(a) * d * (1.15 + (1 - squash) * 0.8), y: cy + Math.sin(a) * d * 0.85 * squash, r: R * (0.32 + r() * 0.22) * (squash < 1 ? 0.85 : 1) });
  }
  clumps.push({ x: cx, y: cy - R * 0.25 * squash, r: R * 0.45 });
  // (In the wind, the crown leans: the higher, the further.)
  if (sway) for (const C of clumps) C.x += sway * Math.max(0, (yb - C.y) / s);
  clumps.sort((p, q) => q.y - p.y);
  // (Lower and back ones first; each clump over the ones behind it.)
  clumps.reverse();
  for (const C of clumps) {
    for (let y = Math.floor(C.y - C.r - 1); y <= Math.ceil(C.y + C.r + 1); y++) {
      for (let xx = Math.floor(C.x - C.r - 1); xx <= Math.ceil(C.x + C.r + 1); xx++) {
        const nx = (xx - C.x) / C.r;
        const ny = (y - C.y) / C.r;
        const e = nx * nx + ny * ny + (hash2(xx, y, seed) - 0.5) * 0.35;
        if (e > 1) continue;
        // (Each clump lit from the upper left, a shadow under it where it
        // sits on the next; the whole crown darker below and to the right;
        // leaves in little clusters.)
        const gx = (xx - cx) / R;
        const gy = (y - cy) / R;
        const k = (-nx * 0.5 - ny * 0.78) * 0.85 + (-gx * 0.35 - gy * 0.5) * 0.5 + (hash2(xx >> 1, y >> 1, seed + 3) - 0.5) * 0.38;
        let c = k > 0.55 ? pal[4] : k > 0.2 ? pal[3] : k > -0.15 ? pal[2] : k > -0.5 ? pal[1] : pal[0];
        if (e > 0.7 && ny > 0.2) c = gy > 0.1 || k < 0 ? pal[0] : pal[1];
        b.set(xx, y, c);
      }
    }
  }
}

// A fir: tiers of drooping boughs from the tip down, each tier's top lit
// on the left, its underside in shadow, the trunk showing under the last.
export function pine(b, x, yb, h, pal, bark, seed, { snow = null, narrow = 1, bare = true } = {}) {
  const r = rngOf(seed);
  const trunk = Math.max(2, Math.round(h * 0.12));
  for (let i = 0; i < (bare ? trunk + 2 : 0); i++) {
    b.set(x, yb - i, bark[1]);
    if (h > 14) b.set(x + 1, yb - i, bark[0]);
  }
  const top = yb - h;
  const tiers = Math.max(2, Math.round(h / 4.5));
  for (let t = 0; t < tiers; t++) {
    const k0 = t / tiers;
    const k1 = (t + 1) / tiers;
    const y0 = Math.round(top + k0 * (h - trunk) * 0.95);
    const y1 = Math.round(top + k1 * (h - trunk));
    const wTop = Math.max(0, (k0 * h * 0.36 + 0.5) * narrow);
    const wBot = (k1 * h * 0.36 + 1.5) * narrow;
    for (let y = y0; y <= y1; y++) {
      const f = (y - y0) / Math.max(1, y1 - y0);
      const w = wTop + (wBot - wTop) * f;
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        // (Ragged ends to each bough; the tips droop.)
        const edge = Math.abs(dx) / Math.max(1, w);
        if (edge > 1 || (edge > 0.7 && hash2(x + dx, y, seed) < (edge - 0.7) * 2.2)) continue;
        const side = dx / Math.max(1, w);
        const shade = f > 0.75 ? -0.6 : 0;
        const k = -side * 0.8 + (0.5 - f) * 0.8 + shade + (hash2(x + dx, y, seed + 1) - 0.5) * 0.4;
        let c = k > 0.55 ? pal[4] : k > 0.15 ? pal[3] : k > -0.25 ? pal[2] : k > -0.65 ? pal[1] : pal[0];
        if (snow && f < 0.35 && side < 0.4 && hash2(x + dx, y, seed + 2) < 0.75) c = side < -0.2 ? snow[1] : snow[0];
        b.set(x + dx, y, c);
      }
    }
  }
  b.set(x, top - 1, pal[3]);
  void r;
}

// A palm: a curved trunk in rings, a crown of arched fronds.
export function palm(b, x, yb, h, pal, bark, seed) {
  const r = rngOf(seed);
  const bend = (r() - 0.5) * 0.5;
  let tx = x;
  for (let i = 0; i < h; i++) {
    tx = x + bend * i * i * 0.04;
    b.set(tx, yb - i, i % 3 === 0 ? bark[0] : bark[2]);
    b.set(tx + 1, yb - i, bark[1]);
  }
  const ty = yb - h;
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI + (f / 6) * Math.PI + (r() - 0.5) * 0.3;
    const len = h * (0.45 + r() * 0.2);
    for (let i = 0; i < len; i++) {
      const k = i / len;
      const px = tx + Math.cos(a) * i;
      const py = ty + Math.sin(a) * i * 0.5 + k * k * len * 0.55;
      const c = k < 0.3 ? pal[3] : f % 2 ? pal[2] : pal[1];
      b.set(px, py, c);
      if (k > 0.2 && k < 0.85) b.set(px, py + 1, pal[0]);
    }
  }
  b.set(tx, ty, pal[4]);
}

// A bush: a low heap of leaf clumps.
export function bush(b, x, yb, w, h, pal, seed, { berries = null } = {}) {
  const r = rngOf(seed);
  const n = Math.max(2, Math.round(w / 4));
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + ((i + 0.5) / n) * w + (r() - 0.5) * 2;
    const rr = Math.min(h, w / n + 1) * (0.7 + r() * 0.4);
    const cy = yb - rr * 0.8;
    for (let y = Math.floor(cy - rr); y <= yb; y++) {
      for (let xx = Math.floor(cx - rr); xx <= Math.ceil(cx + rr); xx++) {
        const nx = (xx - cx) / rr;
        const ny = (y - cy) / rr;
        if (nx * nx + ny * ny + (hash2(xx, y, seed) - 0.5) * 0.3 > 1) continue;
        const k = -nx * 0.4 - ny * 0.75 + (hash2(xx >> 1, y, seed + 1) - 0.5) * 0.4;
        b.set(xx, y, k > 0.5 ? pal[4] : k > 0.15 ? pal[3] : k > -0.25 ? pal[2] : k > -0.6 ? pal[1] : pal[0]);
        if (berries && hash2(xx, y, seed + 9) < 0.06 && k > -0.3) b.set(xx, y, berries);
      }
    }
  }
}

// Grass over ground: patches of its tones, tufts of blades (taller and
// more of them nearer), flowers here and there. `pal`: [dark, mid, light,
// lit]; `flowers`: rgb colours.
export function meadow(b, x0, y0, x1, y1, pal, seed, { flowers = [], tufts = 1, flowerK = 0.012 } = {}) {
  for (let y = y0; y < y1; y++) {
    const near = (y - y0) / Math.max(1, y1 - y0);
    for (let x = x0; x < x1; x++) {
      const n = fbm(x * 0.05, y * 0.11, seed) - 0.5 + (hash2(x, y, seed) - 0.5) * 0.25;
      b.set(x, y, n > 0.16 ? pal[2] : n > -0.12 ? pal[1] : pal[0]);
    }
    // Tufts.
    const per = (0.05 + near * 0.12) * tufts;
    for (let x = x0; x < x1; x++) {
      if (hash2(x, y, seed + 5) > per) continue;
      const hgt = 1 + Math.round(near * 3 * hash2(x, y, seed + 6));
      for (let i = 0; i < hgt; i++) {
        b.set(x, y - i, i === hgt - 1 ? pal[3] : pal[2]);
        if (hgt > 2 && i === hgt - 2) {
          b.set(x - 1, y - i, pal[2]);
          b.set(x + 1, y - i - 1, pal[3]);
        }
      }
      b.set(x, y + 1, pal[0]);
    }
    if (flowers.length) {
      for (let x = x0; x < x1; x++) {
        if (hash2(x, y, seed + 11) > flowerK * (0.4 + near)) continue;
        const c = flowers[Math.floor(hash2(x, y, seed + 12) * flowers.length)];
        b.set(x, y - 1, c);
        if (near > 0.5) {
          b.set(x + 1, y - 1, mixC(c, [255, 255, 255], 0.3));
          b.set(x, y, pal[0]);
        }
      }
    }
  }
}

// ------------------------------------------------------------ houses
// A house seen three-quarters on (round 51: the roof's end is the gable
// wall's own triangle, so nothing of it hangs off on its own): its front
// wall `w` wide and `h` high, its feet on `yb` at x0, going back `d` (up
// and to the right, half as far up as along). `o`:
//   wall, side (shaded end wall), roof (rgb ramps of four: dark to lit),
//   timber (frames, or null), shape ('gable', 'steep', 'flat', 'hut'),
//   windows (count), lit (0-1, warm light in them), glow (its colour),
//   door, chimney (true), up (0-1: built so far), mine (your family's:
//   its door open and lit).
// Returns { ridge: { x0, x1, y }, wins: [{x, y, w, h}], door: {x, y, w, h},
// chimney: {x, y} } for what goes on and about it.
export function house(b, x0, yb, w, h, o) {
  x0 = Math.round(x0);
  yb = Math.round(yb);
  const d = o.depth ?? Math.max(4, Math.round(w * 0.4));
  const dh = Math.round(d / 2);
  const shape = o.shape || 'gable';
  const up = o.up ?? 1;
  const W = o.wall;
  const S = o.side || W.map((c) => mixC(c, [40, 40, 80], 0.32));
  const R = o.roof;
  const T = o.timber;
  const top = yb - h;
  const out = { wins: [], ridge: null, door: null, chimney: null };
  // Its shadow on the ground, behind and to the right.
  poly(b, [[x0, yb + 1], [x0 + w + 2, yb + 1], [x0 + w + d + 3, yb - dh + 1], [x0 + d + 1, yb - dh + 1]], [20, 22, 30], 0.28);
  if (shape === 'hut') return hut(b, x0, yb, w, h, o, out);
  const wallUp = Math.min(1, up / 0.75);
  const cut = yb - Math.round((h + dh) * wallUp) - 1;
  const clip = (c) => (x, y) => (y >= cut ? (typeof c === 'function' ? c(x, y) : c) : null);
  // The frame, while it's going up.
  if (up < 0.75 && T) {
    for (let y = top; y < yb; y++) {
      b.set(x0, y, T[1]);
      b.set(x0 + w - 1, y, T[1]);
      b.set(x0 + w + d - 1, y - dh, T[0]);
      if (w > 12) b.set(x0 + Math.floor(w / 2), y, T[1]);
    }
    seg(b, x0, top, x0 + w - 1, top, T[1]);
    seg(b, x0 + w - 1, top, x0 + w + d - 1, top - dh, T[0]);
  }
  // The end wall (shaded), then the front (lit), its courses and corners.
  poly(b, [[x0 + w, yb], [x0 + w + d, yb - dh], [x0 + w + d, top - dh], [x0 + w, top]], clip((x, y) => {
    if (T && (x === x0 + w || x === x0 + w + d - 1)) return T[0];
    const n = hash2(x, y, 3);
    return n < 0.1 ? S[0] : y > yb - (x - x0 - w) / 2 - 2 ? S[0] : S[1];
  }));
  const beams = T ? [x0, x0 + w - 1, ...(w > 13 ? [x0 + Math.floor(w / 2)] : [])] : [];
  const midY = top + Math.round(h * 0.45);
  poly(b, [[x0, yb], [x0 + w, yb], [x0 + w, top], [x0, top]], clip((x, y) => {
    if (beams.includes(x)) return T[1];
    if (T && y === midY) return T[1];
    if (T && w > 13) {
      // (Braces across the panels.)
      const bx = x - x0;
      if (y > midY && Math.abs((y - midY) - (bx % Math.floor(w / 2))) < 1 && bx % Math.floor(w / 2) > 1) return T[0];
    }
    if (x === x0 + 1) return W[3];
    const n = hash2(x, y, 5);
    if (!T && (y - top) % 3 === 0 && n < 0.6) return W[1];
    return n < 0.08 ? W[1] : n > 0.94 ? W[3] : W[2];
  }));
  // (Where it meets the ground: darker, a course of stone.)
  if (wallUp > 0.2) for (let x = x0; x < x0 + w; x++) b.set(x, yb - 1, W[0]);
  if (up < 0.75) return out;
  const k = Math.min(1, (up - 0.75) / 0.25);
  // Windows (framed, a sill under each; lit at night) and the door.
  const nWin = o.windows ?? Math.max(1, Math.floor((w - 5) / 6));
  const wh = h >= 12 ? 3 : 2;
  const wy = top + Math.max(2, Math.round(h * 0.28));
  const dw = w >= 16 ? 3 : 2;
  const dhh = Math.max(3, Math.min(h - 3, Math.round(h * 0.55)));
  const dx = x0 + Math.floor((w - dw) / 2);
  const slots = [];
  for (let x = x0 + 2; x + 2 <= x0 + w - 2; x += 4) if (x + 2 < dx - 1 || x > dx + dw) slots.push(x);
  const pick = slots.length <= nWin ? slots : slots.filter((_, i) => i % Math.ceil(slots.length / nWin) === 0);
  const frame = T ? T[0] : W[0];
  const lit = o.lit || 0;
  const glow = rgb(o.glow || '#ffc860');
  for (const x of pick) {
    for (let y = wy - 1; y <= wy + wh; y++) for (let xx = x - 1; xx <= x + 2; xx++) b.set(xx, y, frame);
    for (let y = wy; y < wy + wh; y++) {
      for (let xx = x; xx < x + 2; xx++) {
        const glass = y === wy ? [96, 112, 140] : [44, 48, 66];
        b.set(xx, y, lit > 0 ? mixC(glass, glow, Math.min(1, lit * (y === wy ? 1 : 1.2))) : glass);
      }
    }
    for (let xx = x - 1; xx <= x + 2; xx++) b.set(xx, wy + wh + 1, W[3]);
    out.wins.push({ x, y: wy, w: 2, h: wh });
  }
  for (let y = yb - dhh - 1; y < yb; y++) for (let x = dx - 1; x <= dx + dw; x++) b.set(x, y, frame);
  for (let y = yb - dhh; y < yb; y++) {
    for (let x = dx; x < dx + dw; x++) {
      if (o.mine) b.set(x, y, y < yb - dhh + 1 ? [255, 236, 170] : [255, 204, 106]);
      else b.set(x, y, (x - dx) % 2 ? [74, 46, 26] : [90, 58, 32]);
    }
  }
  if (!o.mine) b.set(dx + dw - 1, yb - Math.ceil(dhh / 2), [200, 160, 80]);
  out.door = { x: dx, y: yb - dhh, w: dw, h: dhh };
  // The roof.
  if (shape === 'flat') {
    // A flat top behind a parapet.
    poly(b, [[x0 - 1, top + 1], [x0 + w + 1, top + 1], [x0 + w + d + 1, top - dh + 1], [x0 + d - 1, top - dh + 1]], (x, y) => (y >= top ? R[1] : (x + y) % 5 === 0 ? R[1] : R[2]));
    seg(b, x0 - 1, top, x0 + w + 1, top, R[3]);
    seg(b, x0 + w + 1, top, x0 + w + d + 1, top - dh, R[0]);
    if (k >= 1) for (let x = x0; x <= x0 + w; x += 3) b.set(x, top - 1, R[3]);
    out.ridge = { x0, x1: x0 + w, y: top - dh };
    return out;
  }
  const rh = Math.round((o.rh ?? Math.round(w * (shape === 'steep' ? 0.55 : 0.38))) * k);
  // Corners: the eave in front (a pixel proud of the wall), the gable's
  // triangle on the end wall (its apex over the middle of it), the ridge
  // from that apex back along to the left.
  const GA = [x0 + w, top];
  const GB = [x0 + w + d, top - dh];
  const AP = [x0 + w + d / 2, top - dh / 2 - rh];
  const RL = [x0 - 1 + d / 2, top - dh / 2 - rh];
  // The gable end: the wall's colour in shade, its boards.
  poly(b, [GA, GB, AP], (x, y) => ((x + (T ? 0 : y)) % 3 === 0 ? S[0] : S[1]));
  if (T && rh > 4) seg(b, AP[0], AP[1] + 1, AP[0], top - dh / 2, T[0]);
  // The roof's slope toward you: courses of tiles (or thatch), lit higher
  // up, a shadow along the eave.
  const rows = Math.max(1, top + 1 - AP[1]);
  const thatch = o.thatch;
  poly(b, [[x0 - 1, top + 1], [GA[0] + 0.5, top + 1], [AP[0] + 0.5, AP[1]], RL], (x, y) => {
    const f = (top + 1 - y) / rows;
    if (y >= top) return R[0];
    if (thatch) {
      const n = hash2(x, y, 9);
      return f > 0.82 ? R[3] : n < 0.25 ? R[1] : n > 0.85 ? R[3] : R[2];
    }
    const row = top + 1 - y;
    if (row % 2 === 0) return (x + Math.floor(row / 2) * 2) % 4 === 0 ? R[0] : R[1];
    return f > 0.78 ? R[3] : (x + row) % 7 === 0 ? R[1] : R[2];
  });
  // Its edges: the verge up the gable (over the shared edge, so they meet),
  // the back verge down to the far eave, the ridge.
  seg(b, GA[0], GA[1], AP[0], AP[1], R[0]);
  seg(b, AP[0], AP[1], GB[0], GB[1], R[1]);
  seg(b, RL[0], RL[1], AP[0], AP[1], R[3]);
  seg(b, x0 - 1, top + 1, RL[0], RL[1], R[1]);
  out.ridge = { x0: Math.round(RL[0]), x1: Math.round(AP[0]), y: Math.round(AP[1]) };
  // A chimney up through the ridge, a cap on it.
  if (o.chimney && k >= 1) {
    const cx = Math.round(RL[0] + (AP[0] - RL[0]) * 0.72);
    const cy = Math.round(AP[1]);
    const ch = Math.max(3, Math.round(h * 0.3));
    for (let y = cy - ch; y <= cy + 1; y++) {
      b.set(cx, y, [120, 100, 96]);
      b.set(cx + 1, y, [92, 76, 76]);
      b.set(cx + 2, y, [64, 54, 58]);
    }
    for (let x = cx - 1; x <= cx + 3; x++) b.set(x, cy - ch - 1, [70, 62, 64]);
    out.chimney = { x: cx + 1, y: cy - ch - 2 };
  }
  return out;
}

// A round hut, thatched up to a point.
function hut(b, x0, yb, w, h, o, out) {
  const W = o.wall;
  const R = o.roof;
  const cx = x0 + w / 2;
  const up = o.up ?? 1;
  const hh = Math.round(h * Math.min(1, up / 0.75));
  poly(b, [[x0, yb], [x0 + w, yb], [x0 + w - 1, yb - hh], [x0 + 1, yb - hh]], (x, y) => {
    const r = (x - cx) / (w / 2);
    const n = hash2(x, y, 4);
    return r > 0.45 ? W[0] : r < -0.55 ? W[3] : n < 0.15 ? W[1] : W[2];
  });
  if (up < 0.75) return out;
  const dx = Math.round(cx - 1);
  for (let y = yb - 5; y < yb; y++) for (let x = dx; x < dx + 2; x++) b.set(x, y, o.mine ? [255, 204, 106] : [42, 28, 18]);
  out.door = { x: dx, y: yb - 5, w: 2, h: 5 };
  const k = Math.min(1, (up - 0.75) / 0.25);
  const rh = Math.round(w * 0.7 * k);
  const top = yb - h;
  poly(b, [[x0 - 2, top + 1], [x0 + w + 2, top + 1], [cx, top - rh]], (x, y) => {
    const r = (x - cx) / (w / 2 + 2);
    const n = hash2(x, y, 6);
    return (top - y) % 3 === 0 && n < 0.7 ? R[0] : r > 0.35 ? R[1] : r < -0.45 ? R[3] : n < 0.2 ? R[1] : R[2];
  });
  seg(b, x0 - 2, top + 1, x0 + w + 2, top + 1, R[0]);
  out.ridge = { x0: Math.round(cx) - 1, x1: Math.round(cx) + 1, y: top - rh };
  return out;
}

// A saguaro: a ribbed column, an arm or two turned up.
export function cactus(b, x, yb, h, pal, seed) {
  const r = rngOf(seed);
  const col = (cx, y0, y1, w) => {
    for (let y = y0; y <= y1; y++) {
      for (let dx = -w; dx <= w; dx++) b.set(cx + dx, y, dx < 0 ? pal[3] : dx > 0 ? pal[1] : (y % 3 ? pal[2] : pal[3]));
    }
    b.set(cx, y0 - 1, pal[3]);
  };
  col(x, yb - h, yb, 1);
  const arms = 1 + Math.floor(r() * 2);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? 1 : -1;
    const ay = yb - Math.round(h * (0.35 + r() * 0.25));
    for (let k = 2; k <= 3; k++) b.set(x + side * k, ay, pal[2]);
    col(x + side * 4, ay - Math.round(h * 0.3), ay, 0);
  }
}

// A rock, lit on its top and left, a darker foot.
export function rock(b, x, yb, w, h, pal, seed) {
  for (let y = yb - h; y <= yb; y++) {
    for (let dx = -w; dx <= w; dx++) {
      const nx = dx / w;
      const ny = (y - (yb - h * 0.4)) / (h * 0.75);
      if (nx * nx + ny * ny + (hash2(x + dx, y, seed) - 0.5) * 0.4 > 1 || y > yb) continue;
      const k = -nx * 0.5 - ny * 0.7 + (hash2((x + dx) >> 1, y, seed + 1) - 0.5) * 0.3;
      b.set(x + dx, y, k > 0.45 ? pal[3] : k > 0 ? pal[2] : k > -0.45 ? pal[1] : pal[0]);
    }
  }
}
