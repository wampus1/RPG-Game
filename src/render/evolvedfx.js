// (Round 71) What the evolved masters reach out into the world with, drawn
// where it is in it (each piece in its own row, in front of what's behind
// it and behind what's in front: see Renderer.drawWorld's buckets):
//   the Divine Alchemist's arms, each of its own element, jointed and
//   banded in gold, a hand at the end of each (see entities/
//   evolved_alchemist.js, which moves them);
//   the Rift Crawler's head-arms when they reach further than its body
//   (evolved_rift.js);
//   the Alinelidan's body, ring after ring of it, following its head over
//   the floor (evolved_worm.js);
//   and the rifts the Crawler (and its Reach) cuts in the air, and the
//   things bouncing about their halls (see evolved.js).
// All of it painted as the masters are: in clean pixels, each a disc
// stamped along its line, outlined, lit from the upper left.
import { TILE, LH } from '../config.js';
import { Sculpt } from './sculpt.js';

const TAU = Math.PI * 2;
// Each master's own (species → fn(r, game, c, add, scr)).
export const WORLD_DRAW = {};

// A world point on the screen: where, and which row and layer it's in.
export function scr(r, x, y, z) {
  const [u, v] = r.toView(x, z);
  return { x: u * TILE - r.camX + 8, y: v * TILE - y * LH + LH - r.camY, v, row: Math.ceil(v - 0.001), layer: Math.ceil(y - 0.001) + 1 };
}

// ------------------------------------------------------------ stamps
// A disc of `col`, radius `rad`, in clean pixels (kept).
const STAMPS = new Map();
export function stamp(col, rad) {
  const k = `${col}|${rad}`;
  let s = STAMPS.get(k);
  if (s) return s;
  const R = Math.ceil(rad);
  const n = R * 2 + 1;
  const make = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!make) return null;
  make.width = n;
  make.height = n;
  const g = make.getContext('2d');
  g.fillStyle = col;
  for (let y = -R; y <= R; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, rad * rad - y * y)) + 0.35);
    if (w >= 0 && rad * rad - y * y >= -0.1) g.fillRect(R - w, R + y, w * 2 + 1, 1);
  }
  s = { cv: make, R };
  STAMPS.set(k, s);
  return s;
}
function dab(ctx, col, rad, x, y) {
  const s = stamp(col, rad);
  if (s) ctx.drawImage(s.cv, Math.round(x) - s.R, Math.round(y) - s.R);
}

// A limb along `pts` (screen points with `r` each): its outline, its body
// in `pal` (dark, mid, light), lit from the upper left, banded where
// `band(k)` says (a colour, or null), and `vein` glowing down its middle.
export function drawLimb(ctx, pts, pal, o = {}) {
  if (pts.length < 2) return;
  const out = o.out || '#0c0810';
  const step = o.step || 1.5;
  const path = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = 0; s < n; s++) {
      const k = s / n;
      path.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: a.r + (b.r - a.r) * k, k: (i + k) / (pts.length - 1) });
    }
  }
  path.push({ ...pts[pts.length - 1], k: 1 });
  for (const p of path) dab(ctx, out, p.r + 1, p.x, p.y);
  for (const p of path) dab(ctx, pal[0], p.r, p.x, p.y);
  for (const p of path) if (p.r > 1.4) dab(ctx, pal[1], p.r - 0.9, p.x - 0.4, p.y - 0.6);
  for (const p of path) if (p.r > 2.2) dab(ctx, pal[2], Math.max(0.8, p.r * 0.38), p.x - p.r * 0.38, p.y - p.r * 0.42);
  if (o.band) {
    for (const p of path) {
      const c = o.band(p.k);
      if (!c) continue;
      dab(ctx, c[0], p.r + 0.6, p.x, p.y);
      dab(ctx, c[1], Math.max(0.6, p.r * 0.45), p.x - p.r * 0.3, p.y - p.r * 0.4);
    }
  }
  if (o.vein) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < path.length; i += 2) {
      const p = path[i];
      const pulse = 0.5 + 0.5 * Math.sin((o.t || 0) * 6 - p.k * 14);
      ctx.globalAlpha = 0.35 + 0.5 * pulse;
      ctx.fillStyle = pulse > 0.8 ? '#ffffff' : o.vein;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.restore();
  }
}

// A soft glow (additive), round (x, y).
export function glow(ctx, x, y, rad, col, a) {
  if (rad <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.restore();
}

// A point on a cubic curve.
export function bez(a, b, c, d, k) {
  const m = 1 - k;
  return { x: m * m * m * a.x + 3 * m * m * k * b.x + 3 * m * k * k * c.x + k * k * k * d.x, y: m * m * m * a.y + 3 * m * m * k * b.y + 3 * m * k * k * c.y + k * k * k * d.y };
}

// ------------------------------------------------------------ the rifts
const VOID = ['#05010a', '#1a0a30', '#3a1a6a'];
function drawRift(ctx, R, at, p, time) {
  const open = R.open * Math.min(1, (R.life - R.t) / 0.5);
  if (open <= 0) return;
  const h = 26 * open;
  const w = 7 * open;
  const x = Math.round(p.x);
  const y = Math.round(p.y - 14);
  glow(ctx, x, y, 22 * open, '#8a40ff', 0.45);
  glow(ctx, x, y, 10 * open, '#5ad8f0', 0.35);
  // The tear: jagged, its edges burning white.
  ctx.fillStyle = VOID[0];
  for (let dy = -h / 2; dy <= h / 2; dy++) {
    const k = 1 - Math.abs(dy) / (h / 2);
    const jag = Math.sin(dy * 1.7 + time * 9 + at.x) * 1.2 * k;
    const ww = Math.max(0, Math.round(w * Math.sqrt(k) + jag));
    if (ww <= 0) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - ww - 1, y + dy, 1, 1);
    ctx.fillRect(x + ww + 1, y + dy, 1, 1);
    ctx.fillStyle = Math.floor(time * 10 + dy) % 3 ? '#c8a0ff' : '#5ad8f0';
    ctx.fillRect(x - ww, y + dy, 1, 1);
    ctx.fillRect(x + ww, y + dy, 1, 1);
    ctx.fillStyle = VOID[0];
    ctx.fillRect(x - ww + 1, y + dy, ww * 2 - 1, 1);
  }
  // Stars of the far side in it, turning.
  for (let i = 0; i < 6; i++) {
    const a = time * 1.5 + i * 1.05;
    const sx = x + Math.cos(a) * w * 0.5 * open;
    const sy = y + Math.sin(a * 1.3) * h * 0.35;
    ctx.fillStyle = i % 2 ? '#ffffff' : '#a080ff';
    ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
  }
  // Motes drawn in to it.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const k = (time * 0.8 + i / 8) % 1;
    const a = i * 2.4 + Math.floor(time * 0.8 + i / 8) * 1.7;
    const d = (1 - k) * 18;
    ctx.globalAlpha = k;
    ctx.fillStyle = i % 2 ? '#c8a0ff' : '#5ad8f0';
    ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6), 1, 1);
  }
  ctx.restore();
  // Its shadow of light on the floor.
  ctx.save();
  ctx.globalAlpha = 0.35 * open;
  ctx.fillStyle = '#8a40ff';
  ctx.fillRect(x - Math.round(w + 3), Math.round(p.y) - 1, Math.round(w * 2 + 7), 2);
  ctx.restore();
}

// ------------------------------------------------------------ bouncers
const BALL = {
  void: ['#1a0a30', '#8a40ff', '#e0c8ff', '#5ad8f0'],
  toxin: ['#2a3a10', '#8ac030', '#e8ff90', '#c8ff40'],
  acid: ['#3a3a10', '#c8c040', '#ffffa0', '#e0e060'],
};
function drawBall(ctx, b, p, time) {
  const C = BALL[b.kind] || BALL.void;
  const trail = (b.trail ||= []);
  trail.push({ x: p.x, y: p.y });
  if (trail.length > 7) trail.shift();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  trail.forEach((q, i) => {
    ctx.globalAlpha = (i / trail.length) * 0.4;
    ctx.fillStyle = C[1];
    const rr = 1 + i * 0.4;
    ctx.fillRect(Math.round(q.x - rr), Math.round(q.y - 10 - rr), Math.round(rr * 2), Math.round(rr * 2));
  });
  ctx.restore();
  const x = p.x;
  const y = p.y - 10 + Math.sin(time * 9 + b.x) * 1;
  glow(ctx, x, y, 12, C[3], 0.5);
  dab(ctx, '#05010a', 4.5, x, y);
  dab(ctx, C[0], 3.6, x, y);
  dab(ctx, C[1], 2.6, x - 0.5, y - 0.5);
  dab(ctx, C[2], 1.1, x - 1.2, y - 1.3);
  if (Math.floor(time * 12) % 2) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 2), 1, 1);
  }
  // Its shadow.
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(x - 3), Math.round(p.y), 6, 1);
  ctx.restore();
}

// ------------------------------------------------------------ into the rows
export function evolvedDecos(r, game, buckets, zMin, zMax) {
  const ctx = r.ctx;
  const add = (row, layer, order, deco) => {
    if (row < zMin || row > zMax) return;
    let arr = buckets.get(row);
    if (!arr) buckets.set(row, (arr = []));
    arr.push({ deco, layer, rp: { y: order } });
  };
  const S = (x, y, z) => scr(r, x, y, z);
  for (const R of game.rifts || []) {
    for (const at of [R.a, R.b]) {
      const p = S(at.x, R.y, at.z);
      add(p.row, p.layer + 1, 50, () => drawRift(ctx, R, at, p, r.time));
    }
  }
  for (const b of game.bouncers || []) {
    const p = S(b.x, b.y ?? 0, b.z);
    add(p.row, p.layer + 1, 60, () => drawBall(ctx, b, p, r.time));
  }
  for (const c of game.creatures) {
    if (c.dead && !(c.dying !== undefined)) continue;
    const fn = WORLD_DRAW[c.species];
    if (fn) fn(r, game, c, add, S);
  }
}

// ------------------------------------------------------------ pictures
// A sprite sculpted once (for what's stamped about the world many times
// over: a ring of the worm, a hand).
const SPRITES = new Map();
export function sculpted(key, w, h, fn) {
  let s = SPRITES.get(key);
  if (s) return s;
  if (typeof document === 'undefined') return null;
  const X = new Sculpt(w, h, { seed: key.length * 31 + 7, pix: true });
  fn(X);
  const px = X.render({ outline: true });
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').putImageData(px.toImageData(), 0, 0);
  s = { cv, w, h };
  SPRITES.set(key, s);
  return s;
}
export { TAU };
