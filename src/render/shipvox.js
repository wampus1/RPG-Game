// The great ships, drawn (round 68: see world/shipmodels.js for how
// they're built, game/ships3d.js for how they sail). A ship is a box of
// cubes turned to any heading, so she's drawn the way a cube is: every
// face of every cube that can be seen, pixel by pixel, each pixel looked
// up in its block's own picture (the world's planks are her planks), the
// nearest kept (so the far side never shows through the near). That's
// worked out once for each of BUCKETS headings (and again when she's been
// holed or mended, or settles lower in the water) and kept; between, she's
// one picture.
//   What moves on her is drawn fresh every frame the same way, into the
// same depth: her masts and yards and the sails on them (braced round,
// filling with the wind, holed where they've been shot through), the
// rigging, her flags, the wheel turning, the guns training round and
// recoiling, the lanterns. Whoever's aboard is drawn on her deck, in
// front of what's behind them and behind what's in front (the rail, the
// guns, the castles' walls). Under the water she's dim and green; round
// her waterline the sea foams, more at the bow the faster she goes.
import { TILE, LH } from '../config.js';
import { BLOCKS, B } from '../world/blocks.js';
import { faceTexels } from './textures.js';
import { hash4 } from '../util/rng.js';

export const BUCKETS = 192;
const TAU = Math.PI * 2;
const DEPTH_NONE = -1e9;

// ------------------------------------------------------------- colour
const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const R_ = (c) => c & 255;
const G_ = (c) => (c >>> 8) & 255;
const B_ = (c) => (c >>> 16) & 255;
function hexRGB(h) {
  const n = parseInt(String(h || '#808080').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shadeC(c, f) {
  return pack(Math.min(255, R_(c) * f) | 0, Math.min(255, G_(c) * f) | 0, Math.min(255, B_(c) * f) | 0);
}
function mixC(c, rgb, t) {
  return pack((R_(c) + (rgb[0] - R_(c)) * t) | 0, (G_(c) + (rgb[1] - G_(c)) * t) | 0, (B_(c) + (rgb[2] - B_(c)) * t) | 0);
}

// A block's faces as packed pixels.
const TEXC = new Map();
function texOf(id, v) {
  const k = id * 4 + v;
  let t = TEXC.get(k);
  if (t !== undefined) return t;
  const f = faceTexels(id, v);
  t = null;
  if (f) {
    const conv = (px) => {
      const out = new Uint32Array(px.w * px.h);
      for (let i = 0; i < out.length; i++) out[i] = pack(px.d[i * 4], px.d[i * 4 + 1], px.d[i * 4 + 2], 255);
      return out;
    };
    t = { top: conv(f.top), side: conv(f.front) };
  }
  TEXC.set(k, t);
  return t;
}

// Things that stand on her (not cubes): a box of their size and colour.
const PROPS = {
  barrel: { w: 0.64, h: 0.82, top: '#9a6a3a', side: '#7a5230', band: '#3a3a42', bands: [0.18, 0.82] },
  crate: { w: 0.78, h: 0.74, top: '#b08a58', side: '#8a6a40', band: '#5a4024', bands: [0.5], x: true },
  chest: { w: 0.76, h: 0.6, top: '#7a5230', side: '#5a3a20', band: '#3a3a42', bands: [0.45] },
  capstan: { w: 0.56, h: 0.78, top: '#a07a48', side: '#7a5a34', band: '#3a3a42', bands: [0.5] },
  ship_pump: { w: 0.4, h: 0.95, top: '#8a6438', side: '#6a4a2a', band: '#3a3a42', bands: [0.3, 0.7] },
  table: { w: 0.82, h: 0.55, top: '#8a6438', side: '#5a3e22', band: '#4a3220', bands: [0.85] },
  chair: { w: 0.5, h: 0.5, top: '#8a6438', side: '#5a3e22', band: '#4a3220', bands: [] },
  bed: { w: 0.9, h: 0.4, top: '#c83a32', side: '#6a4a2a', band: '#e8e0d0', bands: [0.3] },
  bookshelf: { w: 0.9, h: 0.95, top: '#6a4a2a', side: '#5a3a20', band: '#a03a2a', bands: [0.3, 0.6] },
  furnace: { w: 0.86, h: 0.86, top: '#6a6a72', side: '#4e4e56', band: '#e07a2a', bands: [0.35] },
};
const DYNAMIC = new Set(['ship_cannon', 'helm', 'lantern', 'hammock']);

// ------------------------------------------------------------- the frame
// Where a point of hers is, seen from the camera turned to angle `a`
// (her heading less the camera's turn): across (u) and down (v) the
// screen in paces from her pivot.
function rot(m, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    c, s, px0: m.px, pz0: m.pz,
    u: (lx, lz) => (lx - m.px) * c + (lz - m.pz) * s,
    v: (lx, lz) => -(lx - m.px) * s + (lz - m.pz) * c,
  };
}

// A buffer of pixels with their depth, what each is (for picking and for
// who's in front of whom), drawn over a box of the screen.
function makeBuf(ox, oy, w, h) {
  const n = Math.max(1, w * h);
  return { ox, oy, w, h, col: new Uint32Array(n), z: new Float32Array(n).fill(DEPTH_NONE), key: new Int16Array(n), hgt: new Int8Array(n), pick: new Int32Array(n) };
}

// --------------------------------------------------- her cubes, turned
// Everything that doesn't move on her, at heading bucket q (`sink`: how
// far below her mark she's settled, in pixels).
function rasterStatic(S, q, sink) {
  const m = S.m;
  const vox = S.vox;
  const a = (q / BUCKETS) * TAU;
  const T = rot(m, a);
  const { c, s } = T;
  // The box she fills on screen.
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const lx of [0, m.W]) for (const lz of [0, m.L]) for (const h of [-1, m.H]) {
    const X = T.u(lx, lz) * TILE;
    const Y = T.v(lx, lz) * TILE - h * LH;
    x0 = Math.min(x0, X);
    x1 = Math.max(x1, X);
    y0 = Math.min(y0, Y);
    y1 = Math.max(y1, Y);
  }
  const ox = Math.floor(x0) - 2;
  const oy = Math.floor(y0) - 2;
  const w = Math.ceil(x1) - ox + 3;
  const h = Math.ceil(y1) - oy + 3;
  const R = makeBuf(ox, oy, w, h);
  // Under the water: the surface sits at her waterline mark (less what
  // she's settled), a quarter layer down.
  const waterH = m.wl - 0.25 + sink / LH;
  const sea = [26, 70, 92];
  const paint = hexRGB(S.paint || '#8a2a1e');
  const paint2 = hexRGB(S.paint2 || '#1e1e24');
  const W = m.W;
  const L = m.L;
  const H = m.H;
  const idx = (x, y, zz) => (y * L + zz) * W + x;
  const at = (x, y, zz) => (x < 0 || y < 0 || zz < 0 || x >= W || y >= H || zz >= L ? 0 : vox[idx(x, y, zz)]);
  // (Her masts are drawn as spars above her deck: they don't cover what's
  // under them.)
  const covers = (id) => id !== 0 && id !== B.ship_mast && BLOCKS[id].render === 'cube' && BLOCKS[id].opaque;
  const insideAir = (x, y, zz) => x >= 0 && y >= 0 && zz >= 0 && x < W && y < H && zz < L && m.inside[idx(x, y, zz)] === 1;
  // What of her inside can be seen from out of her at all: through her
  // hatches, her doors, her holes (a few cells in).
  const seen = seenInside(S);
  // (Light from the upper left of the screen, a little toward you.)
  const LU = -0.55;
  const LV = 0.62;
  const rowOf = (lx, lz) => Math.floor(T.v(lx, lz) + 0.5) + 200;
  const mast = B.ship_mast;
  const hullP = B.hull_planks;
  const paintRows = [m.deck - 1, m.deck];
  const bootRow = m.wl + 1;
  for (let y = 0; y < H; y++) {
    for (let zz = 0; zz < L; zz++) {
      for (let x = 0; x < W; x++) {
        const vi = idx(x, y, zz);
        const id = vox[vi];
        if (id === 0) continue;
        const b = BLOCKS[id];
        if (DYNAMIC.has(b.name)) continue;
        if (id === mast && y > m.deckLevel[zz * W + x]) continue;
        const row = rowOf(x + 0.5, zz + 0.5);
        const variant = hash4(x, y, zz + 77) & 3;
        if (b.render !== 'cube') {
          if (seen[vi] === 2) continue;
          rasterProp(R, T, PROPS[b.name] || PROPS.crate, x, y, zz, row, vi, waterH, sea);
          continue;
        }
        const tex = texOf(id, variant);
        if (!tex) continue;
        // The top.
        if (!covers(at(x, y + 1, zz)) && !(y + 1 < H && seen[idx(x, y + 1, zz)] === 2)) {
          let f = 1.02 + ((hash4(x, y, zz) & 7) - 3.5) * 0.012;
          if (insideAir(x, y + 1, zz)) f *= 0.5;
          faceTop(R, T, x, y, zz, tex.top, f, row, vi, waterH, sea);
        }
        // The sides that face the camera.
        for (let k = 0; k < 4; k++) {
          const nx = k === 0 ? -1 : k === 1 ? 1 : 0;
          const nz = k === 2 ? -1 : k === 3 ? 1 : 0;
          const nv = -nx * s + nz * c;
          if (nv <= 0.03) continue;
          const nb = at(x + nx, y, zz + nz);
          if (covers(nb)) continue;
          if (x + nx >= 0 && x + nx < W && zz + nz >= 0 && zz + nz < L && seen[idx(x + nx, y, zz + nz)] === 2) continue;
          const nu = nx * c + nz * s;
          let f = 0.74 + 0.3 * Math.max(0, nu * LU + nv * LV);
          let tint = null;
          const inner = insideAir(x + nx, y, zz + nz);
          if (inner) f *= 0.5;
          // (Her paint: a band of her colour under the rail, a dark band
          // at the waterline.)
          else if (id === hullP && m.hull[idx(x, y, zz)] && !(x + nx >= 0 && x + nx < W && zz + nz >= 0 && zz + nz < L && m.hull[idx(x + nx, y, zz + nz)])) {
            if (paintRows.includes(y)) tint = paint;
            else if (y === bootRow) tint = paint2;
          }
          faceSide(R, T, x, y, zz, nx, nz, tex.side, f, tint, row, vi * 8 + 2 + k, waterH, sea);
        }
      }
    }
  }
  // Into a picture.
  R.canvas = toCanvas(R.col, w, h);
  return R;
}

// Which of her inside cells can be seen from outside her (1), and which
// can't (2): open air inside her within four cells of where the outside
// gets in. (Kept till she's holed or mended.)
function seenInside(S) {
  if (S.seenFor === S.ver && S.seenArr) return S.seenArr;
  const m = S.m;
  const vox = S.vox;
  const { W, H, L } = m;
  const N = W * H * L;
  const out = new Uint8Array(N);
  const dist = new Int8Array(N).fill(-1);
  const idx = (x, y, z) => (y * L + z) * W + x;
  const q = [];
  const open = (i) => vox[i] === 0 || !BLOCKS[vox[i]].opaque || BLOCKS[vox[i]].render !== 'cube';
  for (let y = 0; y < H; y++) for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, y, z);
    if (m.inside[i] !== 1 || !open(i)) continue;
    out[i] = 2;
    // (Next to the outside?)
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const X = x + dx;
      const Y = y + dy;
      const Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= W || Y >= H || Z >= L) continue;
      const j = idx(X, Y, Z);
      if (m.inside[j] !== 1 && open(j)) {
        dist[i] = 0;
        q.push(i);
        break;
      }
    }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    out[i] = 1;
    if (dist[i] >= 4) continue;
    const x = i % W;
    const z = Math.floor(i / W) % L;
    const y = Math.floor(i / (W * L));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const X = x + dx;
      const Y = y + dy;
      const Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= W || Y >= H || Z >= L) continue;
      const j = idx(X, Y, Z);
      if (out[j] !== 2 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      q.push(j);
    }
  }
  S.seenArr = out;
  S.seenFor = S.ver;
  return out;
}

function faceTop(R, T, x, y, zz, tex, f, row, vi, waterH, sea) {
  const { c, s } = T;
  const { ox, oy, w, col, z: zb, key, hgt, pick } = R;
  let X0 = Infinity;
  let X1 = -Infinity;
  let Y0 = Infinity;
  let Y1 = -Infinity;
  for (const [lx, lz] of [[x, zz], [x + 1, zz], [x, zz + 1], [x + 1, zz + 1]]) {
    const X = T.u(lx, lz) * TILE;
    const Y = T.v(lx, lz) * TILE - y * LH;
    if (X < X0) X0 = X;
    if (X > X1) X1 = X;
    if (Y < Y0) Y0 = Y;
    if (Y > Y1) Y1 = Y;
  }
  const bx0 = Math.max(0, Math.floor(X0) - ox);
  const bx1 = Math.min(R.w - 1, Math.ceil(X1) - ox);
  const by0 = Math.max(0, Math.floor(Y0) - oy);
  const by1 = Math.min(R.h - 1, Math.ceil(Y1) - oy);
  const under = y < waterH;
  const pk = vi * 8 + 1;
  for (let by = by0; by <= by1; by++) {
    const dv = (by + oy + 0.5 + y * LH) / TILE;
    const depth = 3 * dv + 4 * y;
    for (let bx = bx0; bx <= bx1; bx++) {
      const du = (bx + ox + 0.5) / TILE;
      const lx = du * c - dv * s;
      const lz = du * s + dv * c;
      const fs = lx + T.px0 - x;
      const ft = lz + T.pz0 - zz;
      if (fs < 0 || fs >= 1 || ft < 0 || ft >= 1) continue;
      const i = by * w + bx;
      if (depth <= zb[i]) continue;
      zb[i] = depth;
      let p = shadeC(tex[((ft * 16) | 0) * 16 + ((fs * 16) | 0)], f);
      if (under) p = mixC(p, sea, 0.62);
      col[i] = under ? (p & 0x00ffffff) | (150 << 24) : p;
      key[i] = row;
      hgt[i] = y;
      pick[i] = pk;
    }
  }
}

function faceSide(R, T, x, y, zz, nx, nz, tex, f, tint, row, pk, waterH, sea) {
  const { ox, oy, w, col, z: zb, key, hgt, pick } = R;
  const cxp = x + 0.5 + nx * 0.5;
  const czp = zz + 0.5 + nz * 0.5;
  const tx = nz;
  const tz = -nx;
  const ax = cxp - tx * 0.5;
  const az = czp - tz * 0.5;
  const bxp = cxp + tx * 0.5;
  const bzp = czp + tz * 0.5;
  const U0 = T.u(ax, az);
  const V0 = T.v(ax, az);
  const U1 = T.u(bxp, bzp);
  const V1 = T.v(bxp, bzp);
  const dU = U1 - U0;
  if (Math.abs(dU) < 1e-4) return;
  const dV = V1 - V0;
  const bx0 = Math.max(0, Math.floor(Math.min(U0, U1) * TILE) - ox);
  const bx1 = Math.min(R.w - 1, Math.ceil(Math.max(U0, U1) * TILE) - ox);
  const by0 = Math.max(0, Math.floor(Math.min(V0, V1) * TILE - y * LH) - oy);
  const by1 = Math.min(R.h - 1, Math.ceil(Math.max(V0, V1) * TILE - (y - 1) * LH) - oy);
  const tr = tint ? tint : null;
  for (let bx = bx0; bx <= bx1; bx++) {
    const sF = ((bx + ox + 0.5) / TILE - U0) / dU;
    if (sF < 0 || sF >= 1) continue;
    const V = V0 + sF * dV;
    const tc = (sF * 16) | 0;
    for (let by = by0; by <= by1; by++) {
      const hh = (V * TILE - (by + oy + 0.5)) / LH;
      if (hh < y - 1 || hh >= y) continue;
      const depth = 3 * V + 4 * hh;
      const i = by * w + bx;
      if (depth <= zb[i]) continue;
      zb[i] = depth;
      const rr = Math.min(LH - 1, ((y - hh) * LH) | 0);
      let p = tex[rr * 16 + tc];
      if (tr) {
        const l = (R_(p) * 0.3 + G_(p) * 0.59 + B_(p) * 0.11) / 255;
        const k = 0.5 + l * 1.1;
        p = pack(Math.min(255, tr[0] * k) | 0, Math.min(255, tr[1] * k) | 0, Math.min(255, tr[2] * k) | 0);
      }
      p = shadeC(p, f);
      const under = hh < waterH;
      if (under) p = mixC(p, [26, 70, 92], 0.62);
      col[i] = under ? (p & 0x00ffffff) | (150 << 24) : p;
      key[i] = row;
      hgt[i] = y;
      pick[i] = pk;
    }
  }
}

// A box standing in cell (x, y, zz): a barrel, a crate, the capstan...
function rasterProp(R, T, P, x, y, zz, row, vi, waterH, sea) {
  const top = hexRGB(P.top);
  const side = hexRGB(P.side);
  const band = hexRGB(P.band);
  const hw = P.w / 2;
  const cx = x + 0.5;
  const cz = zz + 0.5;
  const h0 = y - 1;
  const h1 = y - 1 + P.h;
  box(R, T, cx, cz, hw, hw, 0, h0, h1, (face, fs, ft) => {
    if (face === 0) {
      const edge = fs < 0.1 || fs > 0.9 || ft < 0.1 || ft > 0.9;
      return pack(...(edge ? side : top));
    }
    for (const q of P.bands) if (Math.abs(ft - q) < 0.07) return pack(...band);
    if (P.x && Math.abs(fs - ft) < 0.06) return pack(...band);
    return pack(...side);
  }, row, vi * 8 + 6, waterH, sea);
}

// A box (turned `ang` more than she is), its faces coloured by `paint`
// (face 0 its top; fs, ft across it).
function box(R, T, cx, cz, hx, hz, ang, h0, h1, paint, row, pk, waterH = -99, sea = null, LUV = [-0.55, 0.62]) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // Local corner offsets: along her x and z, turned by ang.
  const pt = (ex, ez) => [cx + ex * ca + ez * sa, cz - ex * sa + ez * ca];
  const corners = [pt(-hx, -hz), pt(hx, -hz), pt(hx, hz), pt(-hx, hz)];
  const { c, s } = T;
  const { ox, oy, w, col, z: zb, key, hgt, pick } = R;
  // Top: a parallelogram on screen.
  {
    let X0 = Infinity;
    let X1 = -Infinity;
    let Y0 = Infinity;
    let Y1 = -Infinity;
    for (const [lx, lz] of corners) {
      const X = T.u(lx, lz) * TILE;
      const Y = T.v(lx, lz) * TILE - h1 * LH;
      X0 = Math.min(X0, X);
      X1 = Math.max(X1, X);
      Y0 = Math.min(Y0, Y);
      Y1 = Math.max(Y1, Y);
    }
    const bx0 = Math.max(0, Math.floor(X0) - ox);
    const bx1 = Math.min(R.w - 1, Math.ceil(X1) - ox);
    const by0 = Math.max(0, Math.floor(Y0) - oy);
    const by1 = Math.min(R.h - 1, Math.ceil(Y1) - oy);
    for (let by = by0; by <= by1; by++) {
      const dv = (by + oy + 0.5 + h1 * LH) / TILE;
      const depth = 3 * dv + 4 * h1;
      for (let bx = bx0; bx <= bx1; bx++) {
        const du = (bx + ox + 0.5) / TILE;
        const lx = du * c - dv * s + T.px0;
        const lz = du * s + dv * c + T.pz0;
        const ex = (lx - cx) * ca - (lz - cz) * sa;
        const ez = (lx - cx) * sa + (lz - cz) * ca;
        if (ex < -hx || ex >= hx || ez < -hz || ez >= hz) continue;
        const i = by * w + bx;
        if (depth <= zb[i]) continue;
        zb[i] = depth;
        let p = paint(0, (ex + hx) / (2 * hx), (ez + hz) / (2 * hz));
        if (h1 < waterH && sea) p = (mixC(p, sea, 0.62) & 0x00ffffff) | (150 << 24);
        col[i] = p;
        key[i] = row;
        hgt[i] = Math.ceil(h1);
        pick[i] = pk;
      }
    }
  }
  // Sides.
  for (let k = 0; k < 4; k++) {
    const A = corners[k];
    const Bc = corners[(k + 1) % 4];
    // Outward normal of edge A->B (corners go round anticlockwise as seen
    // from above in her frame).
    const ex = Bc[0] - A[0];
    const ez = Bc[1] - A[1];
    const len = Math.hypot(ex, ez) || 1;
    let nx = ez / len;
    let nz = -ex / len;
    // (Make sure it points away from the middle.)
    const mx = (A[0] + Bc[0]) / 2 - cx;
    const mz = (A[1] + Bc[1]) / 2 - cz;
    if (nx * mx + nz * mz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const nv = -nx * s + nz * c;
    if (nv <= 0.03) continue;
    const nu = nx * c + nz * s;
    const f = 0.72 + 0.3 * Math.max(0, nu * LUV[0] + nv * LUV[1]);
    // From left to right as seen from outside.
    const tx = nz;
    const tz = -nx;
    const P0 = (A[0] - cx) * tx + (A[1] - cz) * tz < (Bc[0] - cx) * tx + (Bc[1] - cz) * tz ? A : Bc;
    const P1 = P0 === A ? Bc : A;
    const U0 = T.u(P0[0], P0[1]);
    const V0 = T.v(P0[0], P0[1]);
    const U1 = T.u(P1[0], P1[1]);
    const V1 = T.v(P1[0], P1[1]);
    const dU = U1 - U0;
    if (Math.abs(dU) < 1e-4) continue;
    const dV = V1 - V0;
    const bx0 = Math.max(0, Math.floor(Math.min(U0, U1) * TILE) - ox);
    const bx1 = Math.min(R.w - 1, Math.ceil(Math.max(U0, U1) * TILE) - ox);
    const by0 = Math.max(0, Math.floor(Math.min(V0, V1) * TILE - h1 * LH) - oy);
    const by1 = Math.min(R.h - 1, Math.ceil(Math.max(V0, V1) * TILE - h0 * LH) - oy);
    for (let bx = bx0; bx <= bx1; bx++) {
      const sF = ((bx + ox + 0.5) / TILE - U0) / dU;
      if (sF < 0 || sF >= 1) continue;
      const V = V0 + sF * dV;
      for (let by = by0; by <= by1; by++) {
        const hh = (V * TILE - (by + oy + 0.5)) / LH;
        if (hh < h0 || hh >= h1) continue;
        const depth = 3 * V + 4 * hh;
        const i = by * w + bx;
        if (depth <= zb[i]) continue;
        zb[i] = depth;
        let p = shadeC(paint(1 + k, sF, (h1 - hh) / (h1 - h0)), f);
        if (hh < waterH && sea) p = (mixC(p, sea, 0.62) & 0x00ffffff) | (150 << 24);
        col[i] = p;
        key[i] = row;
        hgt[i] = Math.ceil(h1);
        pick[i] = pk;
      }
    }
  }
}

function toCanvas(col, w, h) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  new Uint32Array(img.data.buffer).set(col);
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Her picture at heading bucket q: kept (a few headings' worth, the
// latest), made again once she's been holed or mended or has settled.
export function staticFor(S, q) {
  const sink = Math.round(-(S.yOff || 0) * LH);
  const ver = `${S.ver || 0}|${sink}|${S.paint}`;
  S.rcache ||= new Map();
  if (S.rcacheVer !== ver) {
    S.rcache.clear();
    S.rcacheVer = ver;
  }
  let R = S.rcache.get(q);
  if (!R) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    R = rasterStatic(S, q, sink);
    R.ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
    S.rcache.set(q, R);
    if (S.rcache.size > 10) S.rcache.delete(S.rcache.keys().next().value);
  }
  return R;
}

// The heading bucket of an angle.
export function bucketOf(a) {
  return ((Math.round((a / TAU) * BUCKETS) % BUCKETS) + BUCKETS) % BUCKETS;
}

// ---------------------------------------------------------- what moves
// A buffer for this frame's moving parts (the arrays kept with her and
// used again), over the box they fill; seeded with the depth of her still
// parts under them (so they're hidden behind her castles).
function pooled(S, slot, x0, y0, x1, y1, Rs) {
  const ox = Math.floor(x0);
  const oy = Math.floor(y0);
  const w = Math.max(1, Math.ceil(x1) - ox + 1);
  const h = Math.max(1, Math.ceil(y1) - oy + 1);
  const n = w * h;
  S.pool ||= {};
  let P = S.pool[slot];
  if (!P || P.cap < n) {
    const cap = Math.ceil(n * 1.25);
    P = S.pool[slot] = { cap, col: new Uint32Array(cap), z: new Float32Array(cap), key: new Int16Array(cap), hgt: new Int8Array(cap), pick: new Int32Array(cap) };
  }
  const D = { ox, oy, w, h, col: P.col.subarray(0, n), z: P.z.subarray(0, n), key: P.key.subarray(0, n), hgt: P.hgt.subarray(0, n), pick: P.pick.subarray(0, n) };
  D.col.fill(0);
  D.z.fill(DEPTH_NONE);
  const sx0 = Math.max(ox, Rs.ox);
  const sx1 = Math.min(ox + w, Rs.ox + Rs.w);
  const sy0 = Math.max(oy, Rs.oy);
  const sy1 = Math.min(oy + h, Rs.oy + Rs.h);
  for (let y = sy0; y < sy1; y++) {
    const di = (y - oy) * w - ox;
    const si = (y - Rs.oy) * Rs.w - Rs.ox;
    for (let x = sx0; x < sx1; x++) D.z[di + x] = Rs.z[si + x];
  }
  return D;
}

// The box on screen her masts and sails might fill (at this heading).
function rigBox(S, T) {
  const m = S.m;
  const topH = Math.max(...m.masts.map((mm) => mm.base - 1 + mm.h)) + 1.5;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const spread = m.W * 0.75 + 4;
  for (const lx of [m.px - spread, m.px + spread]) for (const lz of [-m.L * 0.3 - 4, m.L + m.bowsprit.len + 4]) for (const h of [m.deck - 1, topH + 1]) {
    const X = T.u(lx, lz) * TILE;
    const Y = T.v(lx, lz) * TILE - h * LH;
    x0 = Math.min(x0, X);
    x1 = Math.max(x1, X);
    y0 = Math.min(y0, Y);
    y1 = Math.max(y1, Y);
  }
  return [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
}

// A projected point of hers: [X, Y on screen from her pivot, depth].
function proj(T, lx, lz, h) {
  const V = T.v(lx, lz);
  return [T.u(lx, lz) * TILE, V * TILE - h * LH, 3 * V + 4 * h, V];
}

// A filled triangle, each corner [X, Y, depth, u, v]; `shade(u, v)` its
// colour there (0 for a hole).
function tri(D, a, b, c, shade, row, hg) {
  const { ox, oy, w, col, z: zb, key, hgt } = D;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])) - ox);
  const maxX = Math.min(D.w - 1, Math.ceil(Math.max(a[0], b[0], c[0])) - ox);
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])) - oy);
  const maxY = Math.min(D.h - 1, Math.ceil(Math.max(a[1], b[1], c[1])) - oy);
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-6) return;
  const inv = 1 / area;
  for (let by = minY; by <= maxY; by++) {
    const py = by + oy + 0.5;
    for (let bx = minX; bx <= maxX; bx++) {
      const px = bx + ox + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) * inv;
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const i = by * w + bx;
      if (d <= zb[i]) continue;
      const p = shade(w0 * a[3] + w1 * b[3] + w2 * c[3], w0 * a[4] + w1 * b[4] + w2 * c[4]);
      if (!p) continue;
      zb[i] = d;
      col[i] = p;
      key[i] = row;
      hgt[i] = hg;
    }
  }
}

// A round spar from A to B (each [X, Y, depth]) `r` pixels thick, lit
// from the left; `c0` its colour.
function spar(D, A, Bp, r, c0, row, hg, cap = null) {
  const { ox, oy, w, col, z: zb, key, hgt } = D;
  const dx = Bp[0] - A[0];
  const dy = Bp[1] - A[1];
  const L2 = dx * dx + dy * dy;
  const len = Math.sqrt(L2) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const minX = Math.max(0, Math.floor(Math.min(A[0], Bp[0]) - r - 1) - ox);
  const maxX = Math.min(D.w - 1, Math.ceil(Math.max(A[0], Bp[0]) + r + 1) - ox);
  const minY = Math.max(0, Math.floor(Math.min(A[1], Bp[1]) - r - 1) - oy);
  const maxY = Math.min(D.h - 1, Math.ceil(Math.max(A[1], Bp[1]) + r + 1) - oy);
  const base = hexRGB(c0);
  const capC = cap ? hexRGB(cap) : null;
  // (Lit side: whichever side of it faces up and left.)
  const litSign = nx * -0.7 + ny * -0.7 >= 0 ? 1 : -1;
  for (let by = minY; by <= maxY; by++) {
    const py = by + oy + 0.5;
    for (let bx = minX; bx <= maxX; bx++) {
      const px = bx + ox + 0.5;
      const t = L2 > 0 ? ((px - A[0]) * dx + (py - A[1]) * dy) / L2 : 0;
      if (t < 0 || t > 1) continue;
      const qx = A[0] + dx * t;
      const qy = A[1] + dy * t;
      const across = (px - qx) * nx + (py - qy) * ny;
      if (Math.abs(across) > r) continue;
      const d = A[2] + (Bp[2] - A[2]) * t + 0.05 * (r - Math.abs(across));
      const i = by * w + bx;
      if (d <= zb[i]) continue;
      zb[i] = d;
      const k = across * litSign / Math.max(0.5, r);
      const f = 0.95 + k * 0.32 - (Math.abs(across) > r - 0.8 ? 0.22 : 0);
      const cc = capC && t > 0.97 ? capC : base;
      col[i] = pack(Math.min(255, cc[0] * f) | 0, Math.min(255, cc[1] * f) | 0, Math.min(255, cc[2] * f) | 0);
      key[i] = row;
      hgt[i] = hg;
    }
  }
}

// A rope: a one-pixel line, A to B.
function rope(D, A, Bp, c0, row) {
  const { ox, oy, w, col, z: zb, key, hgt } = D;
  const n = Math.ceil(Math.max(Math.abs(Bp[0] - A[0]), Math.abs(Bp[1] - A[1]))) + 1;
  const cc = hexRGB(c0);
  const p = pack(cc[0], cc[1], cc[2]);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const bx = Math.round(A[0] + (Bp[0] - A[0]) * t - 0.5) - ox;
    const by = Math.round(A[1] + (Bp[1] - A[1]) * t - 0.5) - oy;
    if (bx < 0 || by < 0 || bx >= D.w || by >= D.h) continue;
    const d = A[2] + (Bp[2] - A[2]) * t + 0.02;
    const i = by * w + bx;
    if (d <= zb[i]) continue;
    zb[i] = d;
    col[i] = p;
    key[i] = row;
    hgt[i] = 99;
  }
}

// --------------------------------------------------------- sails and spars
// How each kind of mast is rigged: square sails hung from yards (height
// of the yard and of the sail's foot, as parts of the mast above the
// deck; half its spread, in parts of her beam), fore-and-aft sails (boom,
// gaff, how far aft), a lateen's long slanting yard; the tops.
const RIGS = {
  square3: { sq: [[0.4, 0.13, 0.68], [0.64, 0.42, 0.54], [0.84, 0.66, 0.4]], tops: [0.38, 0.62] },
  square2: { sq: [[0.42, 0.14, 0.7], [0.72, 0.45, 0.55]], tops: [0.4] },
  gaff: { gaff: { boom: 0.1, gaff: 0.62, peak: 0.72, len: 0.32 }, sq: [], tops: [0.66] },
  sloop: { gaff: { boom: 0.1, gaff: 0.66, peak: 0.8, len: 0.5 }, sq: [], tops: [] },
  lateen: { lateen: { lo: 0.18, hi: 0.95, fwd: 0.25, aft: 0.35 }, sq: [], tops: [] },
  mizzen: { gaff: { boom: 0.12, gaff: 0.55, peak: 0.62, len: 0.24 }, sq: [[0.8, 0.6, 0.42]], tops: [0.58] },
};
export const RIG_INFO = RIGS;

const CLOTH = [240, 234, 216];
const ROPE = '#2e241a';
const SPAR = '#6a4a2a';
const MAST = '#8a6438';

// A sail cloth's colour at (u across, v down) of it: panels, seams, reef
// bands, the bolt rope round it; her mark on the great sails; holes where
// it's been shot through (`hp` how much of it is whole).
function clothShade(f, emblem, hp, seed, fade = 1) {
  return (u, v) => {
    if (hp < 1) {
      const cell = hash4(Math.floor(u * 9), Math.floor(v * 7), seed) / 4294967296;
      if (cell < (1 - hp) * 0.55 && ((u * 37 + v * 23) % 1) < 0.85) return 0;
    }
    let k = f;
    const seam = (u * 12) % 1 < 0.09;
    const reef = Math.abs(v - 0.22) < 0.012 || Math.abs(v - 0.4) < 0.012;
    const edge = u < 0.025 || u > 0.975 || v < 0.03 || v > 0.97;
    let r = CLOTH[0];
    let g = CLOTH[1];
    let b = CLOTH[2];
    if (emblem) {
      const em = emblem.kind;
      const inMark = em === 'cross' ? Math.abs(u - 0.5) < 0.08 || Math.abs(v - 0.45) < 0.08
        : em === 'stripe' ? Math.abs(v - 0.5) < 0.12
          : em === 'disc' ? (u - 0.5) * (u - 0.5) + (v - 0.48) * (v - 0.48) < 0.04 : false;
      if (inMark) {
        r = emblem.rgb[0];
        g = emblem.rgb[1];
        b = emblem.rgb[2];
      }
    }
    if (seam) k *= 0.9;
    if (reef) k *= 0.82;
    if (edge) k *= 0.72;
    // (Billowed: lighter in the belly of it, darker at its edges.)
    k *= 0.86 + 0.2 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
    k *= fade;
    return pack(Math.min(255, r * k) | 0, Math.min(255, g * k) | 0, Math.min(255, b * k) | 0);
  };
}

// A sail as a grid of little quads (so it can belly out): `P(u, v)` gives
// the point of it in her frame [lx, lz, h]; lit by how it faces.
function sailSurface(D, T, P, shadeFor, row, nu = 6, nv = 5) {
  const pts = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const [lx, lz, h] = P(u, v);
      const pr = proj(T, lx, lz, h);
      pts.push([pr[0], pr[1], pr[2], u, v, lx, lz, h]);
    }
  }
  const at = (i, j) => pts[j * (nu + 1) + i];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i + 1, j + 1);
      const d = at(i, j + 1);
      // Its facing: the normal of the little quad, in view terms.
      const e1 = [b[5] - a[5], b[7] - a[7], b[6] - a[6]];
      const e2 = [d[5] - a[5], d[7] - a[7], d[6] - a[6]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      // (In her frame: x across, up, z along. Toward the light: up and to
      // the left of the screen.)
      const nlx = n[0] / nl;
      const nly = n[1] / nl;
      const nlz = n[2] / nl;
      const vu = nlx * T.c + nlz * T.s;
      const vv = -nlx * T.s + nlz * T.c;
      const lit = Math.abs(vu * -0.5 + vv * 0.45 + nly * 0.6);
      const f = 0.72 + 0.34 * lit;
      const sh = shadeFor(f);
      tri(D, a, b, c, sh, row, 99);
      tri(D, a, c, d, sh, row, 99);
    }
  }
}

// ---------------------------------------------------------- drawing her
// The ship's parts that move, gathered for this frame: in her frame, with
// what's needed to draw each (see drawShip).
function rigFor(S, T, D, low, time) {
  const m = S.m;
  const beam = m.W;
  const set = S.sailSet ?? 0;
  const fill = S.fill ?? 0;
  const bulgeK = 0.12 + Math.abs(fill) * 0.55;
  const bsign = fill >= 0 ? 1 : -1;
  const flutter = (1 - Math.min(1, Math.abs(fill) * 1.6)) * 0.12;
  const brace = S.brace || 0;
  const boom = S.boom || 0;
  const emblemRGB = hexRGB(S.flag || '#a02020');
  const rowAt = (lx, lz) => Math.floor(T.v(lx, lz) + 0.5) + 200;
  const deckH = (mm) => mm.base - 1;
  const fwdIdx = m.masts.reduce((bi, mm, i) => (mm.z > m.masts[bi].z ? i : bi), 0);
  m.masts.forEach((mm, mi) => {
    const R = RIGS[mm.rig] || RIGS.square2;
    const mx = mm.x + 0.5;
    const mz = mm.z + 0.5;
    const h0 = deckH(mm);
    const top = h0 + mm.h;
    const row = rowAt(mx, mz);
    const hp = S.sailHp ? S.sailHp[mi] ?? 1 : 1;
    if (low) {
      // The foot of the mast, to above head height (drawn among those on
      // deck).
      spar(D, proj(T, mx, mz, h0), proj(T, mx, mz, h0 + 2.6), 3.6, MAST, row, Math.ceil(h0 + 2.6));
      return;
    }
    // The mast, tapering, banded where the topmast's fished on.
    spar(D, proj(T, mx, mz, h0 + 2.5), proj(T, mx, mz, h0 + mm.h * 0.62), 3.3, MAST, row, 99);
    spar(D, proj(T, mx, mz, h0 + mm.h * 0.6), proj(T, mx, mz, top), 2.2, MAST, row, 99, '#3e3e46');
    // The tops: a little platform.
    for (const tf of R.tops) {
      const th = h0 + mm.h * tf;
      box(D, T, mx, mz, 0.62, 0.5, 0, th - 0.18, th, () => pack(90, 62, 36), row, 0);
    }
    const yardY = (f) => h0 + mm.h * f;
    // Square sails.
    for (const [yf, ff, wf] of R.sq) {
      const yh = yardY(yf);
      const fh = yardY(ff);
      const half = (beam / 2) * wf * 1.7;
      const ca = Math.cos(brace);
      const sa = Math.sin(brace);
      // The yard: across her, braced round by `brace`.
      const ax = (d) => [mx + d * ca, mz - d * sa];
      const [lx0, lz0] = ax(-half);
      const [lx1, lz1] = ax(half);
      spar(D, proj(T, lx0, lz0, yh), proj(T, lx1, lz1, yh), 1.5, SPAR, row, 99);
      if (set < 0.08) {
        // Furled: a bundle along the yard.
        spar(D, proj(T, lx0 * 0.92 + mx * 0.08, lz0 * 0.92 + mz * 0.08, yh - 0.1), proj(T, lx1 * 0.92 + mx * 0.08, lz1 * 0.92 + mz * 0.08, yh - 0.1), 2.2, '#d8cdb4', row, 99);
        continue;
      }
      const drop = (yh - fh) * Math.max(0.15, set);
      // Normal to the sail (forward of her, braced round), and the belly.
      const nx = sa;
      const nz = ca;
      const P = (u, v) => {
        const d = (u - 0.5) * 2 * half * (1 + v * 0.08);
        const bel = (bulgeK * Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.95) + flutter * Math.sin(time * 9 + u * 7 + mi)) * bsign * 1.4;
        return [mx + d * ca + nx * bel, mz - d * sa + nz * bel, yh - 0.1 - v * drop];
      };
      const em = mi === (m.masts.length > 1 ? 1 : 0) && yf === R.sq[0][0] && S.emblem ? { kind: S.emblem, rgb: emblemRGB } : null;
      sailSurface(D, T, P, (f) => clothShade(f, em, hp, mi * 31 + Math.round(yf * 10), S.night ? 0.62 : 1), row);
    }
    // A gaff sail: from the mast aft, swung out to `boom`.
    if (R.gaff) {
      const g = R.gaff;
      const len = m.L * g.len;
      const dirx = -Math.sin(boom);
      const dirz = -Math.cos(boom);
      const bh = yardY(g.boom);
      const gh = yardY(g.gaff);
      const ph = yardY(g.peak);
      const end = (k) => [mx + dirx * len * k, mz + dirz * len * k];
      const [ex, ez] = end(1);
      spar(D, proj(T, mx, mz, bh), proj(T, ex, ez, bh), 1.6, SPAR, row, 99);
      spar(D, proj(T, mx, mz, gh), proj(T, ex * 0.85 + mx * 0.15, ez * 0.85 + mz * 0.15, ph), 1.4, SPAR, row, 99);
      if (set >= 0.08) {
        const sx = -dirz;
        const sz = dirx;
        const st = Math.max(0.2, set);
        const P = (u, v) => {
          const [px, pz] = end(u * (0.86 + v * 0.14));
          const hTop = bh + (gh + (ph - gh) * u - bh) * st;
          const hh = hTop + (bh - hTop) * v;
          const bel = (bulgeK * 1.1 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI) + flutter * Math.sin(time * 9 + u * 6)) * (S.lee || 1);
          return [px + sx * bel, pz + sz * bel, hh];
        };
        sailSurface(D, T, P, (f) => clothShade(f, null, hp, mi * 17 + 5, S.night ? 0.62 : 1), row);
      }
    }
    // A lateen: a long yard slanting across the mast, a triangle under it.
    if (R.lateen) {
      const g = R.lateen;
      const dirx = -Math.sin(boom);
      const dirz = -Math.cos(boom);
      const fx = mx - dirx * m.L * g.fwd;
      const fz = mz - dirz * m.L * g.fwd;
      const ax = mx + dirx * m.L * g.aft;
      const az = mz + dirz * m.L * g.aft;
      const lo = yardY(g.lo);
      const hi = yardY(g.hi);
      spar(D, proj(T, fx, fz, lo), proj(T, ax, az, hi), 1.4, SPAR, row, 99);
      if (set >= 0.08) {
        const sx = -dirz;
        const sz = dirx;
        const tack = [fx, fz, lo];
        const peak = [ax, az, hi];
        const clew = [ax * 0.9 + mx * 0.1, az * 0.9 + mz * 0.1, h0 + 1.6 + (1 - set) * (hi - h0) * 0.5];
        const P = (u, v) => {
          // (u along the yard, v down to the clew.)
          const yx = tack[0] + (peak[0] - tack[0]) * u;
          const yz = tack[1] + (peak[1] - tack[1]) * u;
          const yh = tack[2] + (peak[2] - tack[2]) * u;
          const px = yx + (clew[0] - yx) * v * u;
          const pz = yz + (clew[1] - yz) * v * u;
          const ph = yh + (clew[2] - yh) * v * u;
          const bel = bulgeK * Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (S.lee || 1);
          return [px + sx * bel, pz + sz * bel, ph];
        };
        sailSurface(D, T, P, (f) => clothShade(f, null, hp, mi * 13 + 3, S.night ? 0.62 : 1), row);
      }
    }
    // Shrouds: from below the top down to the rail either side; a stay
    // forward to the next mast or the bowsprit.
    const sh = h0 + mm.h * (R.tops[0] || 0.55);
    for (const side of [-1, 1]) {
      const ex = side < 0 ? 0.1 : m.W - 0.1;
      for (const dz of [-1.2, 0, 1.2]) rope(D, proj(T, mx, mz, sh), proj(T, ex, mz + dz, h0 + 1), ROPE, row);
    }
    const next = m.masts.filter((q) => q.z > mm.z).sort((p, q) => p.z - q.z)[0];
    if (next) rope(D, proj(T, mx, mz, top - 0.3), proj(T, next.x + 0.5, next.z + 0.5, next.base - 1 + next.h * 0.4), ROPE, row);
    else {
      const bs = m.bowsprit;
      const tip = [bs.x, bs.z + bs.len * 0.92, bs.y + bs.len * 0.35];
      rope(D, proj(T, mx, mz, top - 0.3), proj(T, tip[0], tip[1], tip[2]), ROPE, row);
    }
    // A backstay aft, to her quarters.
    if (mi !== fwdIdx || m.masts.length === 1) for (const side of [-1, 1]) rope(D, proj(T, mx, mz, top - 0.2), proj(T, m.W / 2 + side * (m.W / 2 - 0.6), Math.max(0.4, mz - m.L * 0.32), h0 + 1.2), ROPE, row);
    // Her colours at the masthead: a long pennant streaming downwind.
    const wl = S.windLocal || { x: 0, z: -1 };
    const pl = 3.2;
    const wave = (k) => Math.sin(time * 7 + k * 5 + mi) * 0.35 * k;
    const F = (u, v) => {
      const k = u;
      const px = mx + wl.x * pl * k - wl.z * wave(k);
      const pz = mz + wl.z * pl * k + wl.x * wave(k);
      return [px, pz, top + 0.2 - v * 0.55 * (1 - k * 0.8)];
    };
    const fc = hexRGB(S.flag || '#a02020');
    sailSurface(D, T, F, (f) => () => pack(Math.min(255, fc[0] * f) | 0, Math.min(255, fc[1] * f) | 0, Math.min(255, fc[2] * f) | 0), row, 5, 1);
  });
  if (low) return;
  // The bowsprit, and her jibs.
  const bs = m.bowsprit;
  const bRow = rowAt(bs.x, bs.z);
  const tipZ = bs.z + bs.len;
  const tipH = bs.y + bs.len * 0.35;
  spar(D, proj(T, bs.x, bs.z - 1, bs.y - 0.3), proj(T, bs.x, tipZ, tipH), 2.2, MAST, bRow, 99);
  const fore = m.masts[fwdIdx];
  if (fore && set >= 0.08) {
    const head = [fore.x + 0.5, fore.z + 0.5, fore.base - 1 + fore.h * 0.66];
    const jibs = m.T.W >= 9 ? 2 : 1;
    for (let j = 0; j < jibs; j++) {
      const k = j === 0 ? 0.92 : 0.6;
      const tack = [bs.x, bs.z + bs.len * k, bs.y + bs.len * k * 0.35];
      const clew = [bs.x + Math.sin(boom) * 1.6, fore.z + 0.5 + (bs.z + bs.len * k - fore.z) * 0.35, bs.y + 0.8 + j * 0.3];
      const hh = [head[0], head[1], head[2] - j * fore.h * 0.15];
      const P = (u, v) => {
        // u from the stay (tack to head), v toward the clew.
        const sx = tack[0] + (hh[0] - tack[0]) * u;
        const sz = tack[1] + (hh[1] - tack[1]) * u;
        const sh2 = tack[2] + (hh[2] - tack[2]) * u;
        const w = v * (1 - u);
        const bel = bulgeK * 0.8 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (S.lee || 1);
        return [sx + (clew[0] - tack[0]) * w + bel, sz + (clew[1] - tack[1]) * w, sh2 + (clew[2] - tack[2]) * w * (1 - u)];
      };
      sailSurface(D, T, P, (f) => clothShade(f, null, S.sailHp ? S.sailHp[fwdIdx] ?? 1 : 1, 991 + j, S.night ? 0.62 : 1), bRow, 5, 4);
      rope(D, proj(T, tack[0], tack[1], tack[2]), proj(T, hh[0], hh[1], hh[2]), ROPE, bRow);
    }
  }
  // Her ensign on its staff at the stern.
  {
    const st = m.sternLights.length ? m.sternLights[m.sternLights.length - 1] : { x: m.W / 2, y: m.deck + 2, z: 0 };
    const sx = m.W / 2;
    const sz = 0.3;
    const sh0 = st.y - 1;
    const sRow = rowAt(sx, sz);
    spar(D, proj(T, sx, sz, sh0), proj(T, sx, sz - 0.5, sh0 + 3.2), 1, SPAR, sRow, 99);
    const wl = S.windLocal || { x: 0, z: -1 };
    const fc = hexRGB(S.flag || '#a02020');
    const tc = hexRGB(S.paint || '#e0c060');
    const F = (u, v) => [sx + wl.x * 1.6 * u - wl.z * Math.sin(time * 6 + u * 4) * 0.2 * u, sz - 0.5 + wl.z * 1.6 * u + wl.x * Math.sin(time * 6 + u * 4) * 0.2 * u, sh0 + 3.1 - v * 1.1];
    sailSurface(D, T, F, (f) => (u, v) => {
      const cc = Math.abs(v - 0.5) < 0.17 ? tc : fc;
      return pack(Math.min(255, cc[0] * f) | 0, Math.min(255, cc[1] * f) | 0, Math.min(255, cc[2] * f) | 0);
    }, sRow, 4, 2);
  }
}

// What's low on her deck and moves: the guns, the wheel.
function deckWorks(S, T, D, time) {
  const m = S.m;
  const rowAt = (lx, lz) => Math.floor(T.v(lx, lz) + 0.5) + 200;
  // The wheel, turning as she's steered.
  {
    const hl = m.helm;
    if (S.vox[(hl.y * m.L + hl.z) * m.W + hl.x] === B.helm) {
      const cx = hl.x + 0.5;
      const cz = hl.z + 0.5;
      const hy = hl.y - 1;
      const row = rowAt(cx, cz);
      spar(D, proj(T, cx, cz + 0.12, hy), proj(T, cx, cz + 0.12, hy + 0.85), 1.6, '#5a3c22', row, hl.y + 1);
      const hub = [cx, cz - 0.05, hy + 1.05];
      const rad = 0.46;
      const ang = S.wheel || 0;
      const pt = (a, r = rad) => [hub[0] + Math.cos(a) * r, hub[1], hub[2] + Math.sin(a) * r * (TILE / LH)];
      for (let k = 0; k < 8; k++) {
        const a = ang + (k / 8) * TAU;
        const p1 = pt(a, rad * 1.28);
        spar(D, proj(T, hub[0], hub[1], hub[2]), proj(T, ...p1), 0.7, '#7a5432', row, hl.y + 1);
      }
      const N = 20;
      for (let k = 0; k < N; k++) {
        const a0 = ang + (k / N) * TAU;
        const a1 = ang + ((k + 1) / N) * TAU;
        spar(D, proj(T, ...pt(a0)), proj(T, ...pt(a1)), 1, '#5a3a1e', row, hl.y + 1);
      }
      spar(D, proj(T, hub[0], hub[1], hub[2]), proj(T, hub[0], hub[1] - 0.05, hub[2]), 1.4, '#d8a840', row, hl.y + 1);
    }
  }
  // The guns: carriage, and barrel trained to its aim, recoiling.
  m.guns.forEach((g, gi) => {
    const st = (S.guns && S.guns[gi]) || {};
    if (S.vox[(g.y * m.L + g.z) * m.W + g.x] !== B.ship_cannon) return;
    const out = g.side;
    const cx = g.x + 0.5;
    const cz = g.z + 0.5;
    const aim = st.aim || 0;
    const elev = st.elev || 0;
    const rec = st.recoil || 0;
    if (g.deck) {
      const row = rowAt(cx, cz);
      const hy = g.y - 1;
      box(D, T, cx - out * 0.1 * (1 + rec), cz, 0.36, 0.3, 0, hy, hy + 0.36, (face) => (face === 0 ? pack(122, 82, 46) : pack(96, 62, 34)), row, 0);
      const dir = [out * Math.cos(aim), -out * Math.sin(aim)];
      const br = [cx - dir[0] * (0.4 + rec * 0.35), cz - dir[1] * (0.4 + rec * 0.35), hy + 0.55];
      const mu = [cx + dir[0] * (0.95 - rec * 0.35), cz + dir[1] * (0.95 - rec * 0.35), hy + 0.55 + elev * 0.6];
      spar(D, proj(T, ...br), proj(T, ...mu), 2.3, '#2e2e34', row, g.y + 1, '#18181c');
    } else if (S.runOut) {
      // (Run out through her open ports.)
      const p = g.port;
      const px = p.x + 0.5 + out * 0.5;
      const row = rowAt(px, cz);
      const hy = p.y - 0.45;
      const dir = [out * Math.cos(aim), -out * Math.sin(aim)];
      box(D, T, px - out * 0.02, cz, 0.04, 0.34, 0, hy - 0.4, hy + 0.32, () => pack(18, 12, 10), row, 0);
      spar(D, proj(T, px, cz, hy), proj(T, px + dir[0] * (0.7 - rec * 0.5), cz + dir[1] * (0.7 - rec * 0.5), hy + elev * 0.4), 2, '#2e2e34', row, p.y + 1, '#18181c');
    }
  });
  // Her stern lanterns.
  for (const L of m.sternLights) {
    const row = rowAt(L.x + 0.5, L.z + 0.3);
    const lit = S.night;
    box(D, T, L.x + 0.5, L.z + 0.25, 0.18, 0.18, 0, L.y - 1, L.y - 0.4, (face) => (lit ? (face === 0 ? pack(255, 240, 180) : pack(255, 200, 90)) : pack(70, 70, 80)), row, 0);
  }
}

// ------------------------------------------------------------- per frame
// Where her pivot is on screen (the cell-middle convention the world's
// drawn in), snapped to a pixel, bobbing on the swell.
export function shipOrigin(r, S) {
  const [u, v] = r.toView(S.x, S.z);
  const bob = Math.round(Math.sin(r.time * 1.25 + (S.id || 0)) * 1.2 * (S.sunk ? 0 : 1));
  return { X: Math.round(u * TILE + 8 - r.camX), Y: Math.round(v * TILE + 8 - r.camY - (S.m.yBase + (S.yOff || 0)) * LH) + bob };
}

// The angle she's drawn at (her heading less the camera's turn), and its
// bucket.
export function viewBucket(r, S) {
  return bucketOf((S.yaw || 0) - r.view * Math.PI / 2);
}

// Her rows in the world's view (where she goes among what's drawn): the
// frontmost row of her.
export function frontRow(r, S) {
  const m = S.m;
  const a = (S.yaw || 0) - r.view * Math.PI / 2;
  const T = rot(m, a);
  const [, v0] = r.toView(S.x, S.z);
  let mx = -Infinity;
  let mn = Infinity;
  for (const lx of [0, m.W]) for (const lz of [0, m.L + m.bowsprit.len]) {
    const v = T.v(lx, lz);
    mx = Math.max(mx, v);
    mn = Math.min(mn, v);
  }
  return { front: Math.ceil(v0 + mx), back: Math.floor(v0 + mn) };
}

// (Round 69) Where on the screen the middle of her cell (x, y, z) is, as
// she's drawn now (null if she isn't).
export function cellScreen(r, S, x, y, z) {
  const D = S.drawn;
  if (!D) return null;
  const T = rot(S.m, (D.q / BUCKETS) * TAU);
  const du = T.u(x + 0.5, z + 0.5);
  const dv = T.v(x + 0.5, z + 0.5);
  return { x: D.O.X + du * TILE, y: D.O.Y + dv * TILE - y * LH + LH / 2, near: 3 * dv + 4 * y };
}

// (Round 69) The hole of hers nearest the pointer (`mx`, `my`) on the
// screen, within `px` pixels: the nearest the eye of any as near. -1 if
// none. (From outside, through a hole, the pointer's on what's beyond it:
// this finds the hole itself.)
export function holeAt(r, S, mx, my, px = 9) {
  const m = S.m;
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < m.N; i++) {
    if (S.vox[i] || !m.vox[i] || !m.struct[i]) continue;
    const x = i % m.W;
    const z = Math.floor(i / m.W) % m.L;
    const y = Math.floor(i / (m.W * m.L));
    const s = cellScreen(r, S, x, y, z);
    if (!s) return -1;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d > px) continue;
    const score = d - s.near * 0.5;
    if (score < bd) {
      bd = score;
      best = i;
    }
  }
  return best;
}

// Where someone aboard her is drawn (the view position drawEntity wants),
// standing in cell-middle (lx, lz) with their feet at layer fy of hers.
export function deckView(r, S, lx, lz, fy, O = shipOrigin(r, S)) {
  const m = S.m;
  const q = viewBucket(r, S);
  const T = rot(m, (q / BUCKETS) * TAU);
  const du = T.u(lx, lz);
  const dv = T.v(lx, lz);
  // The deck under them, on screen.
  const ys = O.Y + dv * TILE - (fy - 1) * LH;
  const xs = O.X + du * TILE;
  const ry = m.yBase + (S.yOff || 0) + fy;
  return { x: (xs - 8 + r.camX) / TILE, y: ry, z: (ys - 8 - LH + r.camY + ry * LH) / TILE, row: Math.floor(dv + 0.5) + 200, sx: xs, sy: ys };
}

// Draw her, and everyone aboard (the deco of her frontmost row: see
// Renderer.drawWorld).
export function drawShip(r, game, S, aboard) {
  const ctx = r.ctx;
  const q = viewBucket(r, S);
  const Rs = staticFor(S, q);
  const O = shipOrigin(r, S);
  if (O.X + Rs.ox + Rs.w < -400 || O.X + Rs.ox > r.vw + 400 || O.Y + Rs.oy - 500 > r.vh || O.Y + Rs.oy + Rs.h < -60) {
    S.drawn = null;
    return;
  }
  const T = rot(S.m, (q / BUCKETS) * TAU);
  // (What moves on her moves ten times a second: drawn again only then,
  // or when she's turned, trimmed, steered or shot at.)
  const tq = Math.floor(r.time * 10) / 10;
  S.night = !!(game && game.minute !== undefined && (game.minute < 6 * 60 + 30 || game.minute > 19 * 60 + 30));
  const gk = (S.guns || []).map((g) => `${Math.round((g.aim || 0) * 20)}:${Math.round((g.elev || 0) * 20)}:${Math.round((g.recoil || 0) * 10)}`).join(';');
  const key = [q, S.noRig ? 1 : 0, Rs.ms !== undefined ? S.rcacheVer : 0, Math.round((S.sailSet || 0) * 20), Math.round((S.brace || 0) * 40), Math.round((S.boom || 0) * 40), Math.round((S.fill || 0) * 10), S.lee || 0,
    Math.round((S.wheel || 0) * 12), gk, S.runOut ? 1 : 0, (S.sailHp || []).map((h) => Math.round(h * 20)).join(':'), S.night ? 1 : 0, tq,
    Math.round(((S.windLocal || {}).x || 0) * 10), Math.round(((S.windLocal || {}).z || 0) * 10)].join(',');
  if (!S.dyn || S.dyn.k !== key) {
    const low = pooled(S, 'low', Rs.ox - 24, Rs.oy - 24, Rs.ox + Rs.w + 24, Rs.oy + Rs.h + 8, Rs);
    deckWorks(S, T, low, tq);
    // (Still building: no masts yet.)
    if (!S.noRig) rigFor(S, T, low, true, tq);
    const hb = rigBox(S, T);
    const high = pooled(S, 'high', hb[0], hb[1], hb[2], hb[3], Rs);
    mergeDepth(high, low);
    if (!S.noRig) rigFor(S, T, high, false, tq);
    S.dyn = { k: key, low, lowCv: shipCanvas(S, 'low', low), hiCv: shipCanvas(S, 'high', high), high };
  }
  const { low, lowCv, hiCv, high } = S.dyn;
  // The water round her: foam at the waterline.
  drawFoam(r, S, T, O);
  // Her still self, and the low moving parts (the guns, the wheel, the
  // masts' feet).
  if (Rs.canvas) ctx.drawImage(Rs.canvas, O.X + Rs.ox, O.Y + Rs.oy);
  if (lowCv) ctx.drawImage(lowCv, O.X + low.ox, O.Y + low.oy);
  // (What of her's under the pointer.)
  const mo = r.mouse;
  if (mo) {
    const px = Math.round(mo.x) - O.X - Rs.ox;
    const py = Math.round(mo.y) - O.Y - Rs.oy;
    if (px >= 0 && py >= 0 && px < Rs.w && py < Rs.h) {
      const v = Rs.pick[py * Rs.w + px];
      if (v) r.shipPick = { s: S.id, vi: Math.floor((v - 1) / 8), face: (v - 1) % 8, seq: ++r.pickSeq };
    }
  }
  // Who's aboard, in order, each with whatever of her is in front of them
  // drawn back over them.
  const list = [];
  for (const e of aboard) {
    const d = e.deck;
    if (!d || d.s !== S.id) continue;
    list.push({ e, dv: deckView(r, S, d.x, d.z, d.y, O) });
  }
  list.sort((a, b) => a.dv.row - b.dv.row || a.dv.y - b.dv.y);
  for (const { e, dv } of list) {
    r.drawEntity(ctx, e, { x: dv.x, y: dv.y, z: dv.z }, game);
    overlay(ctx, Rs, low, O, dv, e.deck.y);
  }
  // Masts, sails, rigging, flags: over everyone. (Seen through, a little,
  // from her own deck: so you can see what you're doing under them.)
  if (hiCv) {
    const me = game && game.player && game.player.deck && game.player.deck.s === S.id;
    const a0 = ctx.globalAlpha;
    if (me) ctx.globalAlpha = a0 * 0.62;
    ctx.drawImage(hiCv, O.X + high.ox, O.Y + high.oy);
    ctx.globalAlpha = a0;
  }
  S.drawn = { O, Rs, q };
  // (Round 69) A plank of hers being knocked out: cracking as it goes.
  const M = game && game.shipMining;
  if (M && M.s === S.id && M.k > 0.05) drawCracks(r, S, M.vi, M.k);
}

// Cracks over her cell vi, more of them the nearer it is to giving way
// (`k`: 0 to 1), and the cell outlined.
function drawCracks(r, S, vi, k) {
  const m = S.m;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  const p = cellScreen(r, S, x, y, z);
  if (!p) return;
  const ctx = r.ctx;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  ctx.save();
  ctx.globalAlpha = 0.35 + k * 0.4;
  ctx.fillStyle = '#ffe8b0';
  ctx.fillRect(cx - 8, cy - 7, 16, 1);
  ctx.fillRect(cx - 8, cy + 6, 16, 1);
  ctx.fillRect(cx - 8, cy - 7, 1, 14);
  ctx.fillRect(cx + 7, cy - 7, 1, 14);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#1a1008';
  const n = 1 + Math.floor(k * 6);
  let h = hash4(vi, S.id, 31, 7);
  for (let i = 0; i < n; i++) {
    h = hash4(h, i, 5, 9);
    const a = ((h & 255) / 255) * TAU;
    const len = 3 + ((h >> 8) & 7) * k;
    let px = cx;
    let py = cy;
    for (let t = 0; t < len; t++) {
      px += Math.round(Math.cos(a + Math.sin(t + i) * 0.5));
      py += Math.round(Math.sin(a + Math.sin(t + i) * 0.5) * 0.8);
      if (Math.abs(px - cx) > 7 || Math.abs(py - cy) > 6) break;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.restore();
}

function mergeDepth(D, E) {
  for (let y = 0; y < E.h; y++) {
    const dy = y + E.oy - D.oy;
    if (dy < 0 || dy >= D.h) continue;
    for (let x = 0; x < E.w; x++) {
      const ei = y * E.w + x;
      if (!E.col[ei]) continue;
      const dx = x + E.ox - D.ox;
      if (dx < 0 || dx >= D.w) continue;
      const di = dy * D.w + dx;
      if (E.z[ei] > D.z[di]) D.z[di] = E.z[ei];
    }
  }
}

// Her moving parts' picture (a canvas kept with her for each).
function shipCanvas(S, slot, D) {
  if (typeof document === 'undefined') return null;
  let any = false;
  for (let i = 0; i < D.col.length; i++) if (D.col[i]) {
    any = true;
    break;
  }
  if (!any) return null;
  S.cvs ||= {};
  let C = S.cvs[slot];
  if (!C) C = S.cvs[slot] = { cv: document.createElement('canvas'), img: null };
  if (C.cv.width !== D.w || C.cv.height !== D.h) {
    C.cv.width = D.w;
    C.cv.height = D.h;
    C.img = null;
  }
  const cx = C.cv.getContext('2d');
  if (!C.img) C.img = cx.createImageData(D.w, D.h);
  new Uint32Array(C.img.data.buffer).set(D.col);
  cx.putImageData(C.img, 0, 0);
  return C.cv;
}

// Over someone aboard: what of her is in front of them, drawn again.
let OV = null;
function overlay(ctx, Rs, low, O, dv, fy) {
  const x0 = Math.round(dv.sx) - 10;
  const y0 = Math.round(dv.sy) - 36;
  const w = 36;
  const h = 42;
  if (typeof document === 'undefined') return;
  OV ||= { cv: document.createElement('canvas'), buf: null };
  if (OV.cv.width !== w || OV.cv.height !== h) {
    OV.cv.width = w;
    OV.cv.height = h;
    OV.img = OV.cv.getContext('2d').createImageData(w, h);
    OV.buf = new Uint32Array(OV.img.data.buffer);
  }
  const buf = OV.buf;
  buf.fill(0);
  let any = false;
  const floor = fy - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = x0 + x - O.X;
      const Y = y0 + y - O.Y;
      // (The nearer of her still parts and her low moving ones.)
      let p = 0;
      let k = -1;
      let hg = 0;
      let zz = DEPTH_NONE;
      const sx = X - Rs.ox;
      const sy = Y - Rs.oy;
      if (sx >= 0 && sy >= 0 && sx < Rs.w && sy < Rs.h) {
        const i = sy * Rs.w + sx;
        if (Rs.col[i]) {
          p = Rs.col[i];
          k = Rs.key[i];
          hg = Rs.hgt[i];
          zz = Rs.z[i];
        }
      }
      const lx = X - low.ox;
      const ly = Y - low.oy;
      if (lx >= 0 && ly >= 0 && lx < low.w && ly < low.h) {
        const i = ly * low.w + lx;
        if (low.col[i] && low.z[i] >= zz) {
          p = low.col[i];
          k = low.key[i];
          hg = low.hgt[i];
        }
      }
      if (!p || k <= dv.row || hg <= floor) continue;
      buf[y * w + x] = p;
      any = true;
    }
  }
  if (!any) return;
  OV.cv.getContext('2d').putImageData(OV.img, 0, 0);
  ctx.drawImage(OV.cv, x0, y0);
}

// The sea round her: a ring of foam at her waterline, heavier at the bow
// and spreading aft as she makes way.
function drawFoam(r, S, T, O) {
  const ctx = r.ctx;
  const m = S.m;
  const sp = Math.min(1, Math.abs(S.v || 0) / 10);
  const wh = m.wl - 0.25 - (S.yOff || 0);
  const t = r.time;
  ctx.fillStyle = 'rgba(236,246,255,0.75)';
  for (let i = 0; i < m.perim.length; i++) {
    const p = m.perim[i];
    // (Out from her side a little, more at the bow.)
    const bow = p.z / m.L;
    const off = 0.15 + bow * bow * sp * 0.7 + Math.sin(t * 3 + i) * 0.05;
    const nx = p.x - m.px;
    const nz = (p.z - m.pz) * 0.35;
    const nl = Math.hypot(nx, nz) || 1;
    const lx = p.x + (nx / nl) * off;
    const lz = p.z + (nz / nl) * off;
    const X = O.X + T.u(lx, lz) * TILE;
    const Y = O.Y + T.v(lx, lz) * TILE - wh * LH;
    if ((i + Math.floor(t * 6)) % 3 === 0) ctx.fillRect(Math.round(X), Math.round(Y), 2, 1);
    else ctx.fillRect(Math.round(X), Math.round(Y), 1, 1);
  }
}

// What of her's under the mouse (her cell and its face), from the last
// time she was drawn; null if nothing.
export function pickShip(S, mx, my) {
  const D = S.drawn;
  if (!D) return null;
  const { O, Rs } = D;
  const x = Math.round(mx) - O.X - Rs.ox;
  const y = Math.round(my) - O.Y - Rs.oy;
  if (x < 0 || y < 0 || x >= Rs.w || y >= Rs.h) return null;
  const v = Rs.pick[y * Rs.w + x];
  if (!v) return null;
  const face = (v - 1) % 8;
  const vi = Math.floor((v - 1) / 8);
  return { vi, face };
}

// Headless: her picture at a heading, as pixels (for checking she draws).
export function rasterForTest(S, q) {
  return rasterStatic(S, q, 0);
}

// The ships among what the world draws: each with the frontmost row of
// her (so what's in front of her is drawn over her, what's behind under).
export function shipDecos(r, game, buckets, zMin, zMax) {
  const ships = game.ships3d;
  if (!ships || !ships.length) return;
  const aboard = (game.visibleEntities || []).filter((e) => e.deck);
  const wakeRows = new Map();
  for (const S of ships) {
    if (S.sunk) continue;
    wakeOf(r, S, wakeRows);
    const [u, v] = r.toView(S.x, S.z);
    const reach = S.m.L + S.m.bowsprit.len + 30;
    if (u * TILE < r.camX - reach * TILE || u * TILE > r.camX + r.vw + reach * TILE || v * TILE < r.camY - reach * TILE || v * TILE > r.camY + r.vh + reach * TILE) {
      S.drawn = null;
      continue;
    }
    const { front } = frontRow(r, S);
    const row = Math.max(zMin, Math.min(zMax, front));
    let arr = buckets.get(row);
    if (!arr) buckets.set(row, (arr = []));
    arr.push({ deco: () => drawShip(r, game, S, aboard), layer: 99, rp: { y: 99 } });
  }
  // Her wake, row by row on the water (so what's in front of it covers it).
  for (const [row, pts] of wakeRows) {
    if (row < zMin || row > zMax) continue;
    let arr = buckets.get(row);
    if (!arr) buckets.set(row, (arr = []));
    arr.push({ deco: () => drawWake(r, pts), layer: 6, rp: { y: 6 } });
  }
}

// The white water she leaves: from her bow, spreading out either side,
// and from under her stern, trailing astern and fading.
function wakeOf(r, S, rows) {
  const dt = Math.min(0.1, r.frameDt || 0.016);
  const W = (S.wakePts ||= []);
  const last = S.wakeLast;
  const sp = last ? Math.hypot(S.x - last.x, S.z - last.z) / Math.max(1e-3, dt) : 0;
  S.wakeLast = { x: S.x, z: S.z };
  const m = S.m;
  if (sp > 1.2 && sp < 60) {
    S.wakeAcc = (S.wakeAcc || 0) + dt * Math.min(30, sp * 1.6);
    while (S.wakeAcc >= 1) {
      S.wakeAcc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      const bow = Math.random() < 0.45;
      const lx = m.px + side * (bow ? 0.8 : m.W * 0.3);
      const lz = bow ? m.L - 2.5 : 0.3;
      const [wx, wz] = S.toWorld(lx, lz);
      const [ox, oz] = S.dirWorld(side, bow ? -0.4 : -1.2);
      W.push({ x: wx, z: wz, vx: ox * (bow ? 2.2 : 1), vz: oz * (bow ? 2.2 : 1), t: 0, life: bow ? 2.2 : 3.2, big: bow ? 1 : 2 });
    }
  }
  for (const w of W) {
    w.t += dt;
    w.x += w.vx * dt;
    w.z += w.vz * dt;
    w.vx *= 1 - dt * 0.6;
    w.vz *= 1 - dt * 0.6;
  }
  S.wakePts = W.filter((w) => w.t < w.life).slice(-220);
  for (const w of S.wakePts) {
    const [, v] = r.toView(w.x, w.z);
    const row = Math.ceil(v - 0.001);
    let a = rows.get(row);
    if (!a) rows.set(row, (a = []));
    a.push(w);
  }
}

function drawWake(r, pts) {
  const ctx = r.ctx;
  for (const w of pts) {
    const [u, v] = r.toView(w.x, w.z);
    const x = Math.round(u * TILE + 8 - r.camX);
    const y = Math.round(v * TILE + 8 - 4.75 * LH - r.camY + 3);
    const k = 1 - w.t / w.life;
    ctx.fillStyle = `rgba(236,246,255,${(0.75 * k).toFixed(3)})`;
    const n = w.big === 2 ? 3 : 2;
    ctx.fillRect(x, y, n, 1);
    if (k > 0.5) ctx.fillRect(x + 1, y - 1, 1, 1);
  }
}
