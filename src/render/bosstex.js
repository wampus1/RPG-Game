// (Round 71) The masters of the old places drawn from textures of a size:
// thirty-two texels square for a master of an ordinary old place, sixty-four
// for the Kavorent's spire-masters and the evolved ones of the ancient
// places (twice the size of the rest), every texel two pixels on the
// screen. Each is sculpted and rigged as before (see bossbody.js, bossart.js:
// the body, and what moves on it of itself), all of it drawn together onto a
// scratch canvas, and then made a texture of: brought down to its texels
// (each the colour most of its patch is, or the glowing thing in it, an eye,
// a seam of fire, if there's one there), put onto its own palette (the
// colours it's made of, drawn out of it once), stray texels set to the
// colour round them, and its edge drawn in, darker on the side away from the
// light. So every master's drawn in the same way, crisp, at one size of
// pixel, however it was made.
//   And as it's drawn: posed (see bossanim.js: crouched for a blow,
// stretched into it, reared up roaring, coming apart at its end).

export const TEX_NORMAL = 64;
export const TEX_BIG = 128;
// Screen pixels to a texel: one, every pixel of a master the size of every
// other pixel in the world.
export const TEXEL = 1;
// The Kavorent's masters (the evolved masters say so themselves: S.evolved).
const BIG = new Set(['overseer', 'crucible', 'condenser', 'prime']);
export const bigTex = (e) => !!(e && (BIG.has(e.species) || (e.S && (e.S.evolved || e.S.texBig))));
export const texOf = (e) => (bigTex(e) ? TEX_BIG : TEX_NORMAL);
// Design pixels to texels, for a master painted `w` by `h`: the whole of it
// filling its texture.
// (Never drawn bigger than painted: what isn't painted at its size yet is
// drawn as it is.)
export function texScale(e, w, h) {
  return Math.min(1, texOf(e) / Math.max(1, w, h));
}
// How much bigger on screen than it was painted (texels are two pixels).
export const screenScale = (e, w, h) => texScale(e, w, h) * TEXEL;

// ------------------------------------------------------------ scratch
// Drawn on here as it would be on the screen (its feet at AX, AY), then
// made a texture of.
const SW = 720;
const SH = 600;
const AX = 360;
const AY = 440;
let scratch = null;
function scratchCanvas() {
  if (!scratch) {
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    scratch = c.getContext('2d', { willReadFrequently: true });
    scratch.imageSmoothingEnabled = false;
  }
  return scratch;
}
// The part of it a master's drawn in (about its feet): bigger for the big.
function reachOf(big) {
  return big ? { l: 340, r: 340, u: 430, d: 150 } : { l: 170, r: 170, u: 200, d: 90 };
}

// Start drawing a master whose feet are at (x, y) on the screen: a context
// to draw it on exactly as it would be drawn on the screen.
export function beginTex(x, y, big = false) {
  const c = scratchCanvas();
  const R = reachOf(big);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  c.clearRect(AX - R.l, AY - R.u, R.l + R.r, R.u + R.d);
  c.setTransform(1, 0, 0, 1, AX - x, AY - y);
  return c;
}

// ------------------------------------------------------------ palettes
// Each master's own colours, drawn out of what it's made of (median cut).
const PALETTES = new Map();
function medianCut(cols, n) {
  let boxes = [cols];
  while (boxes.length < n) {
    let bi = -1;
    let bestR = -1;
    let ch = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const q of b) {
          if (q[c] < lo) lo = q[c];
          if (q[c] > hi) hi = q[c];
        }
        const r = (hi - lo) * (c === 1 ? 1.2 : 1);
        if (r > bestR) {
          bestR = r;
          bi = i;
          ch = c;
        }
      }
    });
    if (bi < 0 || bestR < 6) break;
    const b = boxes[bi].sort((p, q) => p[ch] - q[ch]);
    const m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.filter((b) => b.length).map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const q of b) {
      r += q[0];
      g += q[1];
      bl += q[2];
    }
    return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)];
  });
}
// Its palette (made from the first of it seen, once there's enough).
function paletteOf(key, cols) {
  let P = PALETTES.get(key);
  if (P && P.done) return P.cols;
  if (!P) PALETTES.set(key, (P = { pool: [], done: false, cols: null }));
  if (cols) for (let i = 0; i < cols.length; i += 2) P.pool.push(cols[i]);
  if (P.pool.length > 1400) {
    P.cols = medianCut(P.pool, 22);
    P.done = true;
    P.pool = null;
  }
  return P.cols;
}
export function paletteFor(key) {
  const P = PALETTES.get(key);
  return P && P.done ? P.cols : null;
}

// A colour given a little more bite (contrast and colour), as a pixel
// artist's would be.
function punch(r, g, b) {
  const l = r * 0.3 + g * 0.55 + b * 0.15;
  const k = 1.14;
  r = l + (r - l) * k;
  g = l + (g - l) * k;
  b = l + (b - l) * k;
  r = (r - 118) * 1.06 + 118;
  g = (g - 118) * 1.06 + 118;
  b = (b - 118) * 1.06 + 118;
  return [r < 0 ? 0 : r > 255 ? 255 : r, g < 0 ? 0 : g > 255 ? 255 : g, b < 0 ? 0 : b > 255 ? 255 : b];
}
const lumOf = (r, g, b) => r * 0.3 + g * 0.55 + b * 0.15;
const satOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

// ------------------------------------------------------------ texels
// The texture of what's on the scratch canvas: `s` texels to a pixel drawn
// (the texel grid lined up on its feet). Returns { img (a canvas), tx0, ty0
// (its top left, in texels from its feet), w, h, mask (solid texels) } or
// null if nothing's there.
export function makeTex(key, s, big = false, o = {}) {
  const c = scratchCanvas();
  const R = reachOf(big);
  const X0 = AX - R.l;
  const Y0 = AY - R.u;
  const W = R.l + R.r;
  const H = R.u + R.d;
  const src = c.getImageData(X0, Y0, W, H).data;
  // Where anything is.
  let bx0 = W;
  let by0 = H;
  let bx1 = -1;
  let by1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (src[row + x * 4 + 3] > 24) {
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
    }
  }
  if (bx1 < 0) return null;
  // In texels from its feet.
  const fx = AX - X0;
  const fy = AY - Y0;
  const tx0 = Math.floor((bx0 - fx) * s) - 1;
  const ty0 = Math.floor((by0 - fy) * s) - 1;
  const tx1 = Math.floor((bx1 - fx) * s) + 2;
  const ty1 = Math.floor((by1 - fy) * s) + 2;
  const tw = tx1 - tx0;
  const th = ty1 - ty0;
  const n = tw * th;
  const col = new Float32Array(n * 3);
  const al = new Uint8Array(n);
  const acc = new Uint8Array(n);
  const pool = [];
  const inv = 1 / s;
  for (let ty = 0; ty < th; ty++) {
    const sy0 = Math.max(0, Math.floor(fy + (ty0 + ty) * inv + 1e-6));
    const sy1 = Math.min(H, Math.max(sy0 + 1, Math.floor(fy + (ty0 + ty + 1) * inv + 1e-6)));
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = Math.max(0, Math.floor(fx + (tx0 + tx) * inv + 1e-6));
      const sx1 = Math.min(W, Math.max(sx0 + 1, Math.floor(fx + (tx0 + tx + 1) * inv + 1e-6)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let cnt = 0;
      let on = 0;
      let best = -1;
      let br = 0;
      let bg = 0;
      let bb = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const i = (y * W + x) * 4;
          cnt++;
          const pa = src[i + 3];
          if (pa <= 24) continue;
          on++;
          const pr = src[i];
          const pg = src[i + 1];
          const pb = src[i + 2];
          r += pr * pa;
          g += pg * pa;
          b += pb * pa;
          a += pa;
          // (The brightest, most coloured thing in it: an eye, a glow.)
          const sc = lumOf(pr, pg, pb) + satOf(pr, pg, pb) * 0.8;
          if (sc > best) {
            best = sc;
            br = pr;
            bg = pg;
            bb = pb;
          }
        }
      }
      const k = ty * tw + tx;
      if (!cnt || on / cnt < 0.34 || !a) continue;
      r /= a;
      g /= a;
      b /= a;
      const avgA = a / on;
      // (A glowing thing in it that the rest would drown: kept.)
      const avgSc = lumOf(r, g, b) + satOf(r, g, b) * 0.8;
      if (best - avgSc > 70 && (satOf(br, bg, bb) > 70 || lumOf(br, bg, bb) > 215)) {
        r = br;
        g = bg;
        b = bb;
        acc[k] = 1;
      } else {
        const q = punch(r, g, b);
        r = q[0];
        g = q[1];
        b = q[2];
      }
      col[k * 3] = r;
      col[k * 3 + 1] = g;
      col[k * 3 + 2] = b;
      al[k] = avgA > 200 ? 255 : Math.round(avgA);
      if (al[k] === 255 && !acc[k]) pool.push([r | 0, g | 0, b | 0]);
    }
  }
  // Its surface smoothed a little before it's put onto its palette: each
  // texel toward those round it that are near its colour (so the grain of
  // what it's made of doesn't come out as speckle, and its shading comes
  // out in bands, as a pixel artist would lay it).
  {
    const sm = new Float32Array(col);
    for (let ty = 1; ty < th - 1; ty++) {
      for (let tx = 1; tx < tw - 1; tx++) {
        const k = ty * tw + tx;
        if (al[k] !== 255 || acc[k]) continue;
        const r0 = col[k * 3];
        const g0 = col[k * 3 + 1];
        const b0 = col[k * 3 + 2];
        let r = r0 * 2;
        let g = g0 * 2;
        let b = b0 * 2;
        let wt = 2;
        for (const j of [k - 1, k + 1, k - tw, k + tw]) {
          if (al[j] !== 255 || acc[j]) continue;
          const dr = col[j * 3] - r0;
          const dg = col[j * 3 + 1] - g0;
          const db = col[j * 3 + 2] - b0;
          if (dr * dr + dg * dg + db * db > 44 * 44) continue;
          r += col[j * 3];
          g += col[j * 3 + 1];
          b += col[j * 3 + 2];
          wt++;
        }
        sm[k * 3] = r / wt;
        sm[k * 3 + 1] = g / wt;
        sm[k * 3 + 2] = b / wt;
      }
    }
    col.set(sm);
  }
  // Onto its palette (or, a colour far from any of it, as it is, a little
  // posterised).
  const pal = o.palette === false ? null : paletteOf(key, pool);
  const idx = new Int16Array(n).fill(-1);
  if (pal) {
    for (let k = 0; k < n; k++) {
      if (!al[k] || acc[k]) continue;
      const r = col[k * 3];
      const g = col[k * 3 + 1];
      const b = col[k * 3 + 2];
      let bi = -1;
      let bd = 1e9;
      for (let j = 0; j < pal.length; j++) {
        const q = pal[j];
        const dr = r - q[0];
        const dg = g - q[1];
        const db = b - q[2];
        const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) {
          bd = d;
          bi = j;
        }
      }
      if (bd < 9 * 34 * 34) {
        idx[k] = bi;
        col[k * 3] = pal[bi][0];
        col[k * 3 + 1] = pal[bi][1];
        col[k * 3 + 2] = pal[bi][2];
      }
    }
    // Stray texels (one alone of its colour, three or four of the four
    // round it all of another near it) set to the colour round them: the
    // colours come in clusters, not in grain.
    const lumP = pal.map((q) => lumOf(q[0], q[1], q[2]));
    for (let pass = 0; pass < 2; pass++) {
      for (let ty = 1; ty < th - 1; ty++) {
        for (let tx = 1; tx < tw - 1; tx++) {
          const k = ty * tw + tx;
          const me = idx[k];
          if (me < 0 || acc[k]) continue;
          const nb = [idx[k - tw], idx[k + tw], idx[k - 1], idx[k + 1]];
          if (nb.includes(me)) continue;
          let u = -1;
          let n = 0;
          for (const a of nb) {
            if (a < 0) continue;
            const c = nb.filter((q) => q === a).length;
            if (c > n) {
              n = c;
              u = a;
            }
          }
          if (u < 0 || n < 3 - pass || Math.abs(lumP[u] - lumP[me]) > 60) continue;
          idx[k] = u;
          col[k * 3] = pal[u][0];
          col[k * 3 + 1] = pal[u][1];
          col[k * 3 + 2] = pal[u][2];
        }
      }
    }
  }
  for (let k = 0; k < n; k++) {
    if (!al[k] || idx[k] >= 0 || acc[k]) continue;
    col[k * 3] = Math.round(col[k * 3] / 8) * 8;
    col[k * 3 + 1] = Math.round(col[k * 3 + 1] / 8) * 8;
    col[k * 3 + 2] = Math.round(col[k * 3 + 2] / 8) * 8;
  }
  // Its edge drawn in: darker away from the light (below, to the right),
  // softer toward it; a thread of it (one texel across) only a little.
  const solid = (tx, ty) => tx >= 0 && ty >= 0 && tx < tw && ty < th && al[ty * tw + tx] === 255;
  const out = new ImageData(tw, th);
  const D = out.data;
  const mask = new Uint8Array(n);
  // (Just inside its edge on the side toward the light, a touch lighter: the
  // light catching it.)
  const edge = (tx, ty) => solid(tx, ty) && (!solid(tx - 1, ty) || !solid(tx + 1, ty) || !solid(tx, ty - 1) || !solid(tx, ty + 1));
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const k = ty * tw + tx;
      if (!al[k]) continue;
      let r = col[k * 3];
      let g = col[k * 3 + 1];
      let b = col[k * 3 + 2];
      if (al[k] === 255) {
        mask[k] = 1;
        if (!acc[k]) {
          const L = !solid(tx - 1, ty);
          const Rr = !solid(tx + 1, ty);
          const U = !solid(tx, ty - 1);
          const Dd = !solid(tx, ty + 1);
          if (L || Rr || U || Dd) {
            const thin = (L && Rr) || (U && Dd);
            const lit = (L || U) && !(Rr || Dd);
            const f = thin ? 0.78 : lit ? 0.62 : 0.4;
            const ink = thin ? 0.1 : 0.32;
            r = r * f * (1 - ink) + 26 * ink;
            g = g * f * (1 - ink) + 16 * ink;
            b = b * f * (1 - ink) + 38 * ink;
          } else if ((edge(tx, ty - 1) && !solid(tx, ty - 2)) || (edge(tx - 1, ty) && !solid(tx - 2, ty))) {
            r = Math.min(255, r * 1.16 + 8);
            g = Math.min(255, g * 1.16 + 8);
            b = Math.min(255, b * 1.12 + 10);
          }
        }
      }
      const i = k * 4;
      D[i] = r;
      D[i + 1] = g;
      D[i + 2] = b;
      D[i + 3] = al[k];
    }
  }
  const img = document.createElement('canvas');
  img.width = tw;
  img.height = th;
  img.getContext('2d').putImageData(out, 0, 0);
  return { img, tx0, ty0, w: tw, h: th, mask };
}

// Its rim of light: a texel round its edge, in `color`.
export function rimOf(tex, color) {
  const key = color;
  tex.rims ||= new Map();
  let g = tex.rims.get(key);
  if (g) return g;
  const { w, h, mask } = tex;
  const out = new ImageData(w, h);
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x, y)) continue;
      if (!(on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) continue;
      const i = (y * w + x) * 4;
      out.data[i] = r;
      out.data[i + 1] = gg;
      out.data[i + 2] = b;
      out.data[i + 3] = 210;
    }
  }
  g = document.createElement('canvas');
  g.width = w;
  g.height = h;
  g.getContext('2d').putImageData(out, 0, 0);
  tex.rims.set(key, g);
  return g;
}

// Draw a texture with its feet at (x, y): each texel two pixels, posed
// (`pose`: { sx, sy, rot, dx, dy, shear } about its feet; see bossanim.js).
export function drawTex(ctx, tex, x, y, pose = null) {
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(Math.round(x + (pose ? pose.dx || 0 : 0)), Math.round(y + (pose ? pose.dy || 0 : 0)));
  if (pose) {
    if (pose.rot) ctx.rotate(pose.rot);
    if (pose.shear) ctx.transform(1, 0, pose.shear, 1, 0, 0);
    if (pose.sx !== undefined || pose.sy !== undefined) ctx.scale(pose.sx ?? 1, pose.sy ?? 1);
  }
  ctx.drawImage(tex.img, tex.tx0 * TEXEL, tex.ty0 * TEXEL, tex.w * TEXEL, tex.h * TEXEL);
  ctx.restore();
  ctx.imageSmoothingEnabled = sm;
}
// Its rim drawn as it's posed.
export function drawRim(ctx, tex, x, y, color, alpha, pose = null) {
  const g = rimOf(tex, color);
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * alpha;
  drawTex(ctx, { img: g, tx0: tex.tx0, ty0: tex.ty0, w: tex.w, h: tex.h }, x, y, pose);
  ctx.globalAlpha = a;
}
