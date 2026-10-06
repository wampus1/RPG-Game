// Blocks seen as the game sees them (round 62): for the Builder, and for
// pictures of structures and layouts in lists. The game's own slant (a
// block's top 16 across and 16 deep, its front 12 high), rows drawn from
// the back to the front and each row from the ground up, so what's in
// front covers what's behind just as in play; turned any of four ways.
//
// A voxel source: { w, d, h, ground, get(x, y, z) -> [ref, meta] | null }.
// Its cell (x, y, z) seen turned `rot` quarter turns is at (u, v) across
// and down the screen, with layer y lifted 12 pixels a layer from the
// ground layer.
import { blockArt } from './blockart.js';
import { bpDecode, bpAt } from '../mod/build.js';
import { SPR_H } from '../render/textures.js';
import { LH } from '../config.js';
import { canvas } from './kit.js';

export const T = 16;

export function viewSize(vox, rot) {
  return rot & 1 ? { W: vox.d, D: vox.w } : { W: vox.w, D: vox.d };
}
// (x, z) to (u, v), seen from the side `rot` turns round.
export function toView(x, z, w, d, rot) {
  switch (rot & 3) {
    case 1: return [d - 1 - z, x];
    case 2: return [w - 1 - x, d - 1 - z];
    case 3: return [z, w - 1 - x];
    default: return [x, z];
  }
}
export function fromView(u, v, w, d, rot) {
  switch (rot & 3) {
    case 1: return [v, d - 1 - u];
    case 2: return [w - 1 - u, d - 1 - v];
    case 3: return [w - 1 - v, u];
    default: return [u, v];
  }
}

// How big the picture is, and where its layer `ground`, row 0 is.
export function frameOf(vox, rot) {
  const { W, D } = viewSize(vox, rot);
  const g = vox.ground ?? 0;
  const oy = (vox.h - g) * LH + 4;
  return { W, D, pw: W * T, ph: oy + D * T + g * LH + LH + 6, oy };
}
// The top of cell (u, v)'s top face in layer y.
export const cellY = (F, vox, v, y) => F.oy + v * T - (y - (vox.ground ?? 0)) * LH;

// A structure as a voxel source (its cells decoded, or given).
export function structVox(st, dec = null) {
  const { idx, meta } = dec || bpDecode(st);
  const pal = st.pal || [];
  return {
    w: st.w, d: st.d, h: st.h, ground: st.ground ?? 1,
    get(x, y, z) {
      if (x < 0 || z < 0 || y < 0 || x >= st.w || z >= st.d || y >= st.h) return null;
      const i = bpAt(st, x, y, z);
      const v = idx[i];
      return v ? [pal[v], meta[i]] : null;
    },
  };
}

// A layout's pieces together as one voxel source (each turned and set
// in place, their ground layers level), with its paths on the ground.
export function layoutVox(mod, L) {
  const S = Math.max(16, Math.min(96, L.size || 48));
  const pieces = [];
  let G = 1;
  for (const p of L.pieces || []) {
    const st = mod.structures[p.structure];
    if (!st) continue;
    G = Math.max(G, st.ground ?? 1);
    pieces.push({ p, st, vox: structVox(st), rot: p.rot | 0 });
  }
  let H = G + 1;
  for (const q of pieces) H = Math.max(H, G + q.st.h - (q.st.ground ?? 1));
  const grid = new Map();
  for (const q of pieces) {
    const { st } = q;
    const fw = q.rot & 1 ? st.d : st.w;
    const fd = q.rot & 1 ? st.w : st.d;
    for (let zz = 0; zz < fd; zz++) for (let xx = 0; xx < fw; xx++) {
      const X = (q.p.x | 0) + xx;
      const Z = (q.p.z | 0) + zz;
      if (X < 0 || Z < 0 || X >= S || Z >= S) continue;
      // (Which of the piece's own cells lands here.)
      const [lx, lz] = untrn(xx, zz, st.w, st.d, q.rot);
      grid.set(Z * 4096 + X, { q, lx, lz });
    }
  }
  const paths = new Map();
  for (const p of L.paths || []) for (const [x, z] of p.cells || []) paths.set(z * 4096 + x, p.block || 'path');
  return {
    w: S, d: S, h: H, ground: G, pieces, grid,
    get(x, y, z) {
      const c = grid.get(z * 4096 + x);
      if (c) {
        const ly = y - G + (c.q.st.ground ?? 1);
        const r = c.q.vox.get(c.lx, ly, c.lz);
        if (r) return r[1] && c.q.rot ? [r[0], turnMeta(r[0], r[1], c.q.rot)] : r;
      }
      if (y === G && paths.has(z * 4096 + x)) return [paths.get(z * 4096 + x), 0];
      return null;
    },
  };
}
// (A piece turned `rot` times: its footprint cell back to its own.)
function untrn(x, z, w, d, rot) {
  switch (rot & 3) {
    case 1: return [z, d - 1 - x];
    case 2: return [w - 1 - x, d - 1 - z];
    case 3: return [w - 1 - z, x];
    default: return [x, z];
  }
}
// (As build.js turns a piece's cells: the same way here, so what's seen
// is what's built.)
function turnMeta(ref, meta, rot) {
  return (meta & ~3) | (((meta & 3) + rot) & 3);
}

const TERRAIN = { grass: 'grass', dirt: 'dirt' };

// Draw blocks into `ctx` (at 1:1, offset ox, oy). `o`:
//   rot      the side seen from
//   layer    the layer being worked on (null: none)
//   above    'show' | 'ghost' | 'hide': layers over `layer`
//   over     Map 'x,y,z' -> [ref, meta] | null: cells as they'd be (a
//            drag not yet let go), drawn as if they were
//   ground   draw the ground the thing sits in (grass at its ground
//            layer, where nothing's built)
//   air      show cells cleared to air
//   only     Set of 'x,y,z' to draw (none: all)
//   tint     a function (x, y, z) -> alpha for a cell (or 1)
export function renderVox(ctx, app, vox, o = {}) {
  const rot = o.rot | 0;
  const F = frameOf(vox, rot);
  const ox = o.ox | 0;
  const oy = o.oy | 0;
  const g = vox.ground ?? 0;
  const L = o.layer ?? null;
  const above = o.above || 'show';
  const over = o.over || null;
  const get = over && over.size ? (x, y, z) => {
    const k = `${x},${y},${z}`;
    return over.has(k) ? over.get(k) : vox.get(x, y, z);
  } : (x, y, z) => vox.get(x, y, z);
  const shown = (y) => !(L !== null && y > L && above === 'hide');
  const opaque = (x, y, z) => {
    if (x < 0 || z < 0 || x >= vox.w || z >= vox.d || y < 0 || y >= vox.h || !shown(y)) return false;
    if (L !== null && y > L && above === 'ghost') return false;
    const c = get(x, y, z);
    if (!c) return false;
    const a = blockArt(app, c[0], c[1]);
    return !!a && a.render === 'cube' && !a.see;
  };
  ctx.imageSmoothingEnabled = false;
  const grassA = blockArt(app, TERRAIN.grass);
  const dirtA = blockArt(app, TERRAIN.dirt);
  for (let v = 0; v < F.D; v++) {
    for (let y = 0; y < vox.h; y++) {
      if (!shown(y)) continue;
      const ghost = L !== null && y > L && above === 'ghost';
      const sy = oy + cellY(F, vox, v, y);
      for (let u = 0; u < F.W; u++) {
        const [x, z] = fromView(u, v, vox.w, vox.d, rot);
        const sx = ox + u * T;
        let c = get(x, y, z);
        let terrain = false;
        if (!c && o.ground && y === g && (L === null || L >= g)) {
          c = ['grass', 0];
          terrain = true;
        }
        if (!c) continue;
        const art = terrain ? grassA : blockArt(app, c[0], rot ? (c[1] & ~3) | (((c[1] & 3) + rot) & 3) : c[1]);
        if (!art) continue;
        let a = ghost ? 0.13 : terrain ? 0.42 : 1;
        if (o.tint && !terrain) a *= o.tint(x, y, z);
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        if (art.render === 'air') {
          if (o.air) {
            ctx.strokeStyle = 'rgba(160,200,255,0.5)';
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(sx + 2.5, sy + 2.5, T - 5, T - 5);
            ctx.setLineDash([]);
          }
          continue;
        }
        if (art.render === 'cube') {
          // (Faces hidden by what's over and in front aren't drawn.)
          const [ax, az] = fromView(u, v, vox.w, vox.d, rot);
          const [fx, fz] = fromView(u, v + 1, vox.w, vox.d, rot);
          if (!opaque(ax, y + 1, az) || ghost) ctx.drawImage(art.top, sx, sy);
          if (v + 1 >= F.D || !opaque(fx, y, fz) || ghost) {
            if (terrain && dirtA) ctx.drawImage(dirtA.front, sx, sy + T);
            else ctx.drawImage(art.front, sx, sy + T + (art.liquid ? 3 : 0), T, art.liquid ? LH - 3 : LH);
          }
        } else if (art.render === 'flat') ctx.drawImage(art.top, sx, sy + LH);
        else if (art.sprite) ctx.drawImage(art.sprite, sx + Math.floor((T - art.sprite.width) / 2), sy + SPR_H - art.sprite.height);
      }
    }
  }
  ctx.globalAlpha = 1;
  return F;
}

// What block is under a point (in the picture's own pixels): the front-
// most face there, as drawn. { x, y, z, face: 'top' | 'front' } or null.
export function pickBlock(app, vox, px, py, o = {}) {
  const rot = o.rot | 0;
  const F = frameOf(vox, rot);
  const L = o.layer ?? null;
  const u = Math.floor(px / T);
  if (u < 0 || u >= F.W) return null;
  let best = null;
  for (let y = 0; y < vox.h; y++) {
    if (L !== null && y > L && o.above !== 'show') continue;
    const base = py - F.oy + (y - (vox.ground ?? 0)) * LH;
    const vt = Math.floor(base / T);
    const vf = Math.floor((base - T) / T);
    const ff = base - T - vf * T < LH;
    for (const [v, face] of [[vt, 'top'], [ff ? vf : -1, 'front']]) {
      if (v < 0 || v >= F.D) continue;
      const [x, z] = fromView(u, v, vox.w, vox.d, rot);
      const c = vox.get(x, y, z);
      if (!c) continue;
      const a = blockArt(app, c[0], c[1]);
      if (!a || a.render === 'air') continue;
      if (!best || v > best.v || (v === best.v && y >= best.y)) best = { x, y, z, v, face };
    }
  }
  return best;
}

// The cell of layer y under a point (on that layer's top), or null.
export function pickCell(vox, px, py, y, rot = 0, clamp = false) {
  const F = frameOf(vox, rot);
  let u = Math.floor(px / T);
  let v = Math.floor((py - F.oy + (y - (vox.ground ?? 0)) * LH) / T);
  if (clamp) {
    u = Math.max(0, Math.min(F.W - 1, u));
    v = Math.max(0, Math.min(F.D - 1, v));
  } else if (u < 0 || v < 0 || u >= F.W || v >= F.D) return null;
  const [x, z] = fromView(u, v, vox.w, vox.d, rot);
  return { x, z, u, v };
}

// A small picture of a voxel source (`max` across at most).
export function voxPicture(app, vox, max = 48, rot = 0) {
  const F = frameOf(vox, rot);
  const full = canvas(F.pw, F.ph);
  renderVox(full.getContext('2d'), app, vox, { rot, ground: false });
  // (Cropped to what's drawn.)
  const d = full.getContext('2d').getImageData(0, 0, F.pw, F.ph).data;
  let x0 = F.pw;
  let y0 = F.ph;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < F.ph; y++) for (let x = 0; x < F.pw; x++) if (d[(y * F.pw + x) * 4 + 3]) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const k = Math.min(1, max / Math.max(w, h));
  const out = canvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  const x = out.getContext('2d');
  x.imageSmoothingEnabled = k < 1;
  x.imageSmoothingQuality = 'high';
  x.drawImage(full, x0, y0, w, h, 0, 0, out.width, out.height);
  return out;
}
