// (Round 129) Painting a festival's games (see festwin.js) the way the
// openings are painted (see render/brush.js, render/art_leader.js): a
// scene of 256 by 144 pixels, shown twice the size, its lasting parts
// painted once (the sky at the hour it is, dithered; the land; the
// buildings), what moves drawn over it a whole pixel at a time; the
// townsfolk as they look in the world (their own sprites, never scaled),
// the crowd as the openings' little figures; and over it all, in the
// view's own pixels, the words and the boards, in the game's own letters.
import { drawText, drawGlyph } from '../render/font.js';
import { humanoidSheet, SHEET_H } from '../render/sprites.js';
import { drawPerson } from '../render/scenekit.js';
import { Bmp, sky as skyBands, stars as starField, rgb, hex, mixC, ramp, hash2, rngOf } from '../render/brush.js';

// The scene, and the words over it.
export const SW = 256;
export const SH = 144;
export const UW = 512;
export const UH = 288;

export function makeBuf(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

// ------------------------------------------------------------ colour
export const mixH = (a, b, k) => hex(mixC(rgb(a), rgb(b), k));
export function rand(seed) {
  return rngOf((seed >>> 0) || 1);
}

// Each people's festival colours (their bunting, their cloths).
const FEST_COLOURS = {
  vale: ['#d83a3a', '#f0c030', '#3a6ad8', '#f4f0e0', '#3aa850'],
  north: ['#2a5a9a', '#f4f0e0', '#c83a2a', '#d8b040'],
  sun: ['#e0a020', '#c84a1a', '#2a8a9a', '#f4e0b0', '#8a2a6a'],
  wild: ['#3aa850', '#f0c030', '#d8402a', '#2a8ad8', '#e070c0'],
  high: ['#8a4a1a', '#d8b040', '#2a5a3a', '#e8e0d0'],
  ember: ['#c8301a', '#f0a020', '#3a3a3a', '#f0e0c0'],
  mist: ['#5a8a6a', '#b0a0d8', '#e8e4d0', '#6a4a8a'],
  tide: ['#1a8ab0', '#f0e0b0', '#e05a3a', '#3ac0a0'],
  jade: ['#c8201a', '#f0c030', '#2a2a2a', '#e8e0d0'],
};
export function festColours(style) {
  return FEST_COLOURS[style] || FEST_COLOURS.vale;
}
// The land's green, by people (the south drier, the jungle lusher).
const LAND = { vale: '#5a9a40', north: '#5a8a5a', sun: '#a89a50', wild: '#3a8a3a', high: '#6a8a4a', ember: '#7a7a4a', mist: '#5a7a5a', tide: '#6aa04a', jade: '#5a9a5a' };
export const landOf = (style) => LAND[style] || LAND.vale;

// ------------------------------------------------------------ the sky
// The sky's bands at an hour (top to the hills), and how much light
// there is (0 night .. 1 noon).
const SKY = [
  [0, ['#05070f', '#0b1024', '#161c34'], 0.15],
  [5, ['#141a34', '#3a3050', '#8a5a5a'], 0.3],
  [6.5, ['#3a6aa8', '#e8a070', '#ffd090'], 0.65],
  [9, ['#3a7ad8', '#80b8f0', '#d8ecf8'], 0.95],
  [15.5, ['#3a78d0', '#84b8ec', '#dceaf4'], 1],
  [18, ['#4a5aa0', '#e89060', '#ffc070'], 0.75],
  [19.5, ['#1a1e48', '#6a3a60', '#d8604a'], 0.42],
  [21, ['#070a1a', '#121a38', '#24203a'], 0.18],
  [24, ['#05070f', '#0b1024', '#161c34'], 0.15],
];
export function skyAt(hour, wet) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, a, l0] = SKY[i];
  const [h1, b, l1] = SKY[i + 1];
  const k = (h - h0) / (h1 - h0 || 1);
  let cols = a.map((c, j) => mixH(c, b[j], k));
  let light = l0 + (l1 - l0) * k;
  if (wet) {
    cols = cols.map((c, j) => mixH(c, ['#3a4050', '#5a6070', '#7a808a'][j], 0.6));
    light *= 0.7;
  }
  return { top: cols[0], mid: cols[1], low: cols[2], light, h };
}

// The sky painted (once): its bands dithered, the stars at night, the sun
// or the moon where they'd be at the hour.
export function paintSky(b, horizon, hour, wet, seed) {
  const S = skyAt(hour, wet);
  const sk = new Bmp(b.w, horizon + 2);
  skyBands(sk, [[0, S.top], [Math.round(horizon * 0.55), S.mid], [horizon + 1, S.low]]);
  if (S.light < 0.45 && !wet) starField(sk, Math.round(horizon * 0.8), seed, { band: S.light < 0.25, n: 70 });
  // The sun, or the moon.
  const h = S.h;
  const day = h >= 6 && h < 19.6;
  const f = day ? (h - 6) / 13.6 : ((h + (h < 6 ? 24 : 0)) - 19.6) / 10.4;
  const sx = Math.round(b.w * (0.12 + f * 0.76));
  const sy = Math.round(horizon - Math.sin(f * Math.PI) * horizon * 0.75 + 4);
  if (!wet) {
    const disc = day ? (h > 17 || h < 7.5 ? ['#ffb060', '#ffd890', '#fff0c0'] : ['#ffe8a0', '#fff4d0', '#ffffff']) : ['#a8b0d8', '#d8dcf0', '#ffffff'];
    const R = day ? 6 : 4;
    // (Its glow: rings of dither, not a smear.)
    for (let y = -R * 3; y <= R * 3; y++) {
      for (let x = -R * 3; x <= R * 3; x++) {
        const d = Math.hypot(x, y);
        if (d <= R) sk.set(sx + x, sy + y, rgb(d > R - 1 ? disc[0] : d > R * 0.5 ? disc[1] : disc[2]));
        else if (d <= R * 3 && hash2(sx + x, sy + y, 7) < (1 - d / (R * 3)) * 0.5) sk.set(sx + x, sy + y, rgb(disc[1]), 0.35);
      }
    }
    if (!day) for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (Math.hypot(x - 2, y - 1) <= R - 1) sk.set(sx + x, sy + y, rgb(S.top));
  }
  b.blit(sk, 0, 0);
  return S;
}

// Clouds drifting over it (each a heap of lobes, lit from above), drawn
// per frame as whole pixels from a few cached shapes.
export function cloudShapes(seed, n, wet) {
  const r = rand(seed);
  return Array.from({ length: n }, () => {
    const w = 18 + Math.floor(r() * 30);
    const h = 5 + Math.floor(r() * 5);
    const px = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2);
        const ny = (y - h) / h;
        const bump = Math.sin(x * 0.5 + r() * 0.2) * 0.12;
        if (nx * nx + ny * ny * 1.1 < 1 + bump) px.push([x, y, y < h * 0.4 ? 2 : y < h * 0.75 ? 1 : 0]);
      }
    }
    return { px, w, h, x: r() * 300, y: 6 + Math.floor(r() * 30), v: 1 + r() * 2.5, wet };
  });
}
export function drawClouds(g, clouds, t, S) {
  const pal = S.light < 0.4 ? ['#2a2a40', '#3a3a52', '#4a4a64'] : clouds[0] && clouds[0].wet ? ['#4a4e58', '#5e626c', '#72767e'] : S.h > 17 || S.h < 7.5 ? ['#c88a8a', '#f0b098', '#ffe0c0'] : ['#c8d4e8', '#e8eef8', '#ffffff'];
  for (const c of clouds) {
    const x0 = Math.round(((c.x + t * c.v) % (SW + c.w * 2)) - c.w);
    for (const [x, y, k] of c.px) {
      g.fillStyle = pal[k];
      g.fillRect(x0 + x, c.y + y, 1, 1);
    }
  }
}

// ------------------------------------------------------------ pixels
export function rect(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function dot(g, x, y, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}
// A line, a pixel at a time.
export function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = c;
  for (let n = 0; n < 600; n++) {
    g.fillRect(x0, y0, 1, 1);
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
// A filled disc of pixels.
export function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  const R = r + 0.35;
  for (let y = Math.floor(-R); y <= Math.ceil(R); y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, R * R - y * y)));
    if (R * R - y * y < 0) continue;
    g.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1);
  }
}
// A disc in a Bmp (for what's painted once).
export function bdisc(b, cx, cy, r, c) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if (x * x + y * y <= r * r + r * 0.7) b.set(cx + x, cy + y, rgb(c));
}

// ------------------------------------------------------------ bunting
// A line of little flags from one post to another, sagging, fluttering:
// each flag three pixels deep, its tip flicking a pixel.
export function bunting(g, x0, y0, x1, y1, sag, cols, t, wind = 0.3, rope = '#3a2a20') {
  const n = Math.max(3, Math.floor(Math.abs(x1 - x0) / 5));
  const at = (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag];
  let prev = null;
  for (let i = 0; i <= n * 2; i++) {
    const [x, y] = at(i / (n * 2));
    if (prev) line(g, prev[0], prev[1], x, y, rope);
    prev = [x, y];
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = at((i + 0.5) / n);
    const flick = Math.sin(t * (5 + wind * 6) + i * 1.7) > 0.3 ? 1 : 0;
    const c = cols[i % cols.length];
    const X = Math.round(x);
    const Y = Math.round(y) + 1;
    rect(g, X - 1, Y, 3, 1, c);
    rect(g, X - 1 + (wind > 0.5 ? flick : 0), Y + 1, 2, 1, c);
    dot(g, X + flick, Y + 2, c);
    dot(g, X + 1, Y, mixH(c, '#000000', 0.25));
  }
}

// A post (for bunting, a banner): a pole with its knob.
export function post(g, x, top, base, light = 1) {
  rect(g, x, top, 2, base - top, mixH('#6a4a2a', '#100a06', 1 - light));
  rect(g, x, top, 1, base - top, mixH('#8a6a3a', '#140e08', 1 - light));
  rect(g, x, top - 1, 2, 1, mixH('#d8b040', '#2a2008', 1 - light));
}

// ------------------------------------------------------------ lights
// A paper lantern: three by four, a band at top and bottom, its glow a
// dither round it (and brighter in the dark).
export function lantern(g, x, y, t, col = '#ff9a3a', glow = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const fl = Math.sin(t * 9 + x) > -0.7;
  if (glow > 0) {
    g.fillStyle = `rgba(255,190,110,${(0.18 * glow).toFixed(3)})`;
    for (let dy = -4; dy <= 5; dy++) for (let dx = -4; dx <= 5; dx++) if (Math.hypot(dx - 0.5, dy - 0.5) < 4.6 && (dx + dy + x) % 2 === 0) g.fillRect(x + dx, y + dy, 1, 1);
  }
  rect(g, x - 1, y - 2, 3, 1, '#2a1a10');
  rect(g, x - 1, y - 1, 3, 3, col);
  dot(g, x, y, fl ? '#fff0b0' : '#ffd070');
  dot(g, x - 1, y - 1, mixH(col, '#ffffff', 0.3));
  rect(g, x - 1, y + 2, 3, 1, '#2a1a10');
}
// A string of them, sagging between two points.
export function lanternString(g, x0, y0, x1, y1, sag, n, t, cols, glow = 1) {
  let prev = null;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const p = [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag];
    if (prev) line(g, prev[0], prev[1], p[0], p[1], '#1a1410');
    prev = p;
  }
  for (let i = 1; i < n; i++) {
    const u = i / n;
    lantern(g, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag + 3, t + i, cols[i % cols.length], glow);
  }
}

// The dark of night over the scene (lights are drawn after it).
export function night(g, light) {
  const k = Math.max(0, 0.62 - light * 0.75);
  if (k <= 0) return;
  g.fillStyle = `rgba(8,10,34,${k.toFixed(3)})`;
  g.fillRect(0, 0, SW, SH);
}

// ------------------------------------------------------------ people
const SKINS = ['#f0c8a0', '#e0b090', '#c89068', '#a06a44', '#7a4a2a', '#5a3420'];
const HAIRS = ['#2a1a10', '#5a3a1a', '#8a6a3a', '#c8a060', '#1a1a1a', '#a0a0a0', '#8a3a1a'];
const SHIRTS = ['#6a3a2a', '#2a4a6a', '#5a5a2a', '#7a2a3a', '#3a5a3a', '#4a3a5a', '#8a6a3a', '#5a4a3a'];

// Some of the town (the openings' little figures), for a crowd.
export function folk(seed, n, cols = []) {
  const r = rand(seed);
  return Array.from({ length: n }, () => ({
    skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)],
    shirt: r() < 0.3 && cols.length ? cols[Math.floor(r() * cols.length)] : SHIRTS[Math.floor(r() * SHIRTS.length)],
    ph: r() * 10, dx: (r() - 0.5) * 2, hat: r() < 0.25,
  }));
}

// A crowd: rows of them, the back rows higher; they bob, and on a cheer
// (`excite` 0..1) they wave and jump. `face`: 'back' (seen from behind:
// the game's in front of them) or 'front'.
export function crowd(g, x0, x1, yb, rows, people, t, excite = 0, { face = 'back', size = 'small', light = 1, gap = 5 } = {}) {
  const pen = (x, y, c) => {
    if (!c) return;
    g.fillStyle = light < 0.9 ? mixH(c, '#06080c', (1 - light) * 0.7) : c;
    g.fillRect(x, y, 1, 1);
  };
  let k = 0;
  for (let row = rows - 1; row >= 0; row--) {
    const y = yb - row * (size === 'small' ? 4 : 5);
    const off = row % 2 ? gap / 2 : 0;
    for (let x = x0 + off; x < x1; x += gap) {
      const p = people[k++ % people.length];
      const jump = excite > 0.2 && Math.sin(t * 10 + p.ph) > 0.4 ? Math.round(excite * 2) : 0;
      const bob = Math.sin(t * 2 + p.ph) > 0.8 ? 1 : 0;
      const pose = excite > 0.4 && Math.sin(p.ph * 3) > -0.2 ? 'wave' : 'stand';
      drawPerson(pen, x + p.dx, y - jump - bob, { ...p, size, pose, face, t: t + p.ph, dir: p.ph > 5 ? 1 : -1 });
      if (p.hat) {
        pen(Math.round(x + p.dx) - 1, Math.round(y - jump - bob) - (size === 'small' ? 8 : 11), '#5a3a1a');
        pen(Math.round(x + p.dx), Math.round(y - jump - bob) - (size === 'small' ? 8 : 11), '#5a3a1a');
        pen(Math.round(x + p.dx) + 1, Math.round(y - jump - bob) - (size === 'small' ? 8 : 11), '#5a3a1a');
      }
    }
  }
}

// Someone as they look in the world: their own sprite, a whole pixel to
// a pixel (`dir` 0 front, 1 side, 2 back, 3 the other side; `frame` 0
// standing, 1 and 2 walking, 3 doing, 4 sitting), feet at (x, yb).
export function sprite(g, look, x, yb, dir = 0, frame = 0, { tint = null, alpha = 1 } = {}) {
  if (!look) return;
  let sheet;
  try {
    sheet = humanoidSheet(look);
  } catch {
    return;
  }
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  g.drawImage(sheet, frame * 16, dir * SHEET_H, 16, SHEET_H, Math.round(x - 8), Math.round(yb - SHEET_H), 16, SHEET_H);
  g.restore();
  if (tint) {
    // (Flushed, or in the dark: the same shape, coloured over.)
    const c = spriteTint(sheet, frame, dir, tint);
    if (c) g.drawImage(c, Math.round(x - 8), Math.round(yb - SHEET_H));
  }
}
const TINTS = new Map();
function spriteTint(sheet, frame, dir, tint) {
  const k = `${frame}|${dir}|${tint}`;
  let m = TINTS.get(sheet);
  if (!m) TINTS.set(sheet, (m = new Map()));
  if (m.has(k)) return m.get(k);
  const c = makeBuf(16, SHEET_H);
  if (!c) return null;
  const g = c.getContext('2d');
  g.drawImage(sheet, frame * 16, dir * SHEET_H, 16, SHEET_H, 0, 0, 16, SHEET_H);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = tint;
  g.fillRect(0, 0, 16, SHEET_H);
  m.set(k, c);
  return c;
}

// ------------------------------------------------------------ words
// The game's own letters, in the view's pixels (`scale` whole times).
export function text(g, str, x, y, col, { scale = 1, shadow = '#000000', align = 'left' } = {}) {
  const s = String(str);
  const w = s.length * 6 * scale;
  const sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const sy = Math.round(y);
  if (scale === 1) {
    drawText(g, s, sx, sy, col, shadow);
    return w;
  }
  for (let i = 0; i < s.length; i++) {
    if (shadow) drawGlyph(g, s[i], sx + i * 6 * scale + scale, sy + scale, shadow, scale);
    drawGlyph(g, s[i], sx + i * 6 * scale, sy, col, scale);
  }
  return w;
}
// Words set to a width (in letters).
export function wrap(str, n) {
  const out = [];
  let line0 = '';
  for (const w of String(str).split(/\s+/)) {
    if ((line0 ? `${line0} ${w}` : w).length > n && line0) {
      out.push(line0);
      line0 = w;
    } else line0 = line0 ? `${line0} ${w}` : w;
  }
  if (line0) out.push(line0);
  return out;
}

// A board as the game's windows are: dark, a rule of gold round it, its
// corners cut.
export function panel(g, x, y, w, h, { fill = 'rgba(12,10,18,0.94)', edge = '#c8a060', inner = '#5a4a30' } = {}) {
  x = Math.round(x);
  y = Math.round(y);
  rect(g, x + 1, y, w - 2, h, fill);
  rect(g, x, y + 1, w, h - 2, fill);
  rect(g, x + 2, y, w - 4, 1, edge);
  rect(g, x + 2, y + h - 1, w - 4, 1, edge);
  rect(g, x, y + 2, 1, h - 4, edge);
  rect(g, x + w - 1, y + 2, 1, h - 4, edge);
  dot(g, x + 1, y + 1, edge);
  dot(g, x + w - 2, y + 1, edge);
  dot(g, x + 1, y + h - 2, edge);
  dot(g, x + w - 2, y + h - 2, edge);
  if (inner) {
    rect(g, x + 3, y + 2, w - 6, 1, inner);
    rect(g, x + 3, y + h - 3, w - 6, 1, inner);
  }
}
// Parchment (for the riddles, the cards): its edges darker, a little
// mottled.
export function parchment(g, x, y, w, h, seed = 1) {
  const pal = ramp('#e0cc9a', 4, { spread: 0.26 }).map(hex);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
      const n = hash2(i >> 1, j >> 1, seed);
      const k = edge === 0 ? 0 : edge < 3 ? (n < 0.5 ? 1 : 2) : n < 0.12 ? 2 : 3;
      g.fillStyle = pal[k];
      g.fillRect(x + i, y + j, 1, 1);
    }
  }
}
// A bar that fills, in steps (as the game's own bars).
export function meter(g, x, y, w, h, f, col, label = null) {
  rect(g, x, y, w, h, '#000000');
  rect(g, x + 1, y + 1, w - 2, h - 2, '#1a1620');
  const fw = Math.round(Math.max(0, Math.min(1, f)) * (w - 2));
  if (fw > 0) {
    rect(g, x + 1, y + 1, fw, h - 2, col);
    rect(g, x + 1, y + 1, fw, 1, mixH(col, '#ffffff', 0.4));
    for (let i = x + 6; i < x + 1 + fw; i += 6) rect(g, i, y + 1, 1, h - 2, mixH(col, '#000000', 0.35));
  }
  if (label) text(g, label, x, y - 9, '#d8c8a0');
}

// ------------------------------------------------------------ bits
// Sparks: a pixel each, flung out, falling, fading (in the scene).
export class Sparks {
  constructor() {
    this.list = [];
  }

  burst(x, y, n, cols, speed = 50, life = 0.7, gravity = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, t: 0, life: life * (0.6 + Math.random() * 0.6), c: cols[i % cols.length], g: gravity });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }

  draw(g) {
    for (const p of this.list) {
      if (p.t > p.life * 0.7 && Math.floor(p.t * 20) % 2) continue;
      dot(g, p.x, p.y, p.c);
    }
  }
}

// Words that pop up and float off (a score, "PERFECT"), in the view's
// pixels; `x, y` in the scene's.
export class Pops {
  constructor() {
    this.list = [];
  }

  add(str, x, y, col, scale = 2, life = 1.1) {
    this.list.push({ str, x, y, col, scale, life, t: 0 });
  }

  update(dt) {
    for (const p of this.list) p.t += dt;
    this.list = this.list.filter((p) => p.t < p.life);
  }

  draw(g) {
    for (const p of this.list) {
      const k = p.t / p.life;
      if (k > 0.75 && Math.floor(p.t * 16) % 2) continue;
      text(g, p.str, p.x * 2, p.y * 2 - Math.round(k * 16) * 2, p.col, { scale: p.scale, align: 'center' });
    }
  }
}
