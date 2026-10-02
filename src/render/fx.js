// Effects drawn over the world when a set stone does its work, and fire on
// whoever is burning: an arc of flame thrown off a ruby blade, lightning
// between foes, rings of frost and force, flames licking at the burning.
// Positions are in view pixels (like particles), so they sit on the world
// as the camera moves.
import { TILE, LH } from '../config.js';
import { humanoidSheet, frameGlow, CHAR_W, CHAR_H, SHEET_H, SPR_PAD } from './sprites.js';

// ------------------------------------------------------------ flame frames
// A little tongue of flame, four frames of flicker, in two sizes.
const flameCache = new Map();
export function flameFrame(frame, big = false) {
  const key = `${frame}:${big}`;
  let c = flameCache.get(key);
  if (c) return c;
  const w = big ? 9 : 7;
  const h = big ? 14 : 11;
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const cols = ['#c8281a', '#f06a1c', '#ffb030', '#ffe690', '#fff8d8'];
  const sway = [0, 1, 0, -1][frame & 3];
  let seed = frame * 97 + (big ? 13 : 5);
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 at the tip, 1 at the base
    const half = (w / 2) * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.62) * (0.75 + 0.25 * t);
    const cx = (w - 1) / 2 + sway * (1 - t) * 1.2;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx) / Math.max(0.6, half);
      if (d > 1) continue;
      // Hotter at the heart and the base; ragged at the edges and the tip.
      if (d > 0.7 && rnd() < 0.35) continue;
      if (t < 0.2 && rnd() < 0.3) continue;
      const heat = (1 - d) * 0.8 + t * 0.45;
      const i = Math.max(0, Math.min(cols.length - 1, Math.floor(heat * cols.length)));
      ctx.fillStyle = cols[i];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  flameCache.set(key, c);
  return c;
}

// ------------------------------------------------------------ effects
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A new effect, placed at world (wx, y, wz): the centre of that tile.
export function addEffect(r, o) {
  const [u, v] = r.toView(o.wx, o.wz);
  const e = { ...o, t: 0, seed: Math.floor(Math.random() * 1e6) };
  e.cx = u * TILE + 8;
  e.cy = v * TILE - (o.wy ?? 0) * LH + LH + (o.oy ?? -6);
  if (o.dx !== undefined) {
    // A direction in the world, as it looks on screen.
    const [du, dv] = r.toView(o.dx, o.dz);
    e.ang = Math.atan2(dv, du);
  }
  if (o.tx !== undefined) {
    const [tu, tv] = r.toView(o.tx, o.tz);
    e.ex = tu * TILE + 8;
    e.ey = tv * TILE - (o.ty ?? o.wy ?? 0) * LH + LH + (o.oy ?? -6);
  }
  r.fx.push(e);
  if (r.fx.length > 60) r.fx.shift();
  return e;
}

function spark(r, x, y, color, o = {}) {
  r.particles.push({
    x, y, vx: o.vx ?? (Math.random() - 0.5) * 30, vy: o.vy ?? -(10 + Math.random() * 25), g: o.g ?? -20,
    life: o.life ?? 0.4 + Math.random() * 0.3, max: o.life ?? 0.6, color, size: o.size ?? 1, shape: o.shape,
  });
}

export function drawEffects(r, ctx, dt) {
  const list = r.fx;
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.t += dt;
    if (f.t >= f.life) {
      list.splice(i, 1);
      continue;
    }
    const k = f.t / f.life;
    const ox = -r.camX;
    const oy = -r.camY;
    if (f.type === 'arc') drawArc(r, ctx, f, k, ox, oy, dt);
    else if (f.type === 'bolt') drawBolt(r, ctx, f, k, ox, oy);
    else if (f.type === 'ring') drawRing(ctx, f, k, ox, oy);
    else if (f.type === 'blast') drawBlast(r, ctx, f, k, ox, oy, dt);
    else if (f.type === 'siphon') drawSiphon(ctx, f, k, ox, oy);
    else if (f.type === 'beam') drawBeam(ctx, f, k, ox, oy);
    else if (f.type === 'wave') drawWave(r, ctx, f, k, ox, oy, dt);
    else if (f.type === 'ghost') drawGhost(r, ctx, f, k, ox, oy);
    else if (f.type === 'void') drawVoid(r, ctx, f, k, ox, oy, dt);
  }
  ctx.globalAlpha = 1;
}

// A crescent of flame swept out from the blade, spreading and breaking up
// into embers as it goes.
function drawArc(r, ctx, f, k, ox, oy, dt) {
  const span = f.span ?? 0.95;
  const reach = (f.range ?? 3.4) * TILE;
  const R = 7 + (reach - 7) * (1 - (1 - k) * (1 - k));
  const n = 15;
  const mid = (n - 1) / 2;
  const frame = Math.floor(f.t * 14);
  // The hot inner edge: a thin line of light, dissolving.
  for (let a = -span; a <= span; a += 0.045) {
    if (hash(f.seed + Math.round(a * 100), 3) < k * 1.1) continue;
    const x = Math.round(f.cx + Math.cos(f.ang + a) * (R - 3) + ox);
    const y = Math.round(f.cy + Math.sin(f.ang + a) * (R - 3) + oy);
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.fillStyle = Math.abs(a) < span * 0.5 ? '#fff0a0' : '#ffb040';
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < n; i++) {
    const edge = Math.abs(i - mid) / mid;
    // The ends go first; each tongue winks out at its own moment.
    if (hash(f.seed, i) < k * (0.55 + 0.7 * edge) - 0.1) continue;
    const a = f.ang - span + (2 * span * i) / (n - 1);
    const px = f.cx + Math.cos(a) * R;
    const py = f.cy + Math.sin(a) * R;
    const img = flameFrame(frame + i, edge < 0.7);
    const s = (1.45 - 0.75 * k) * (1 - edge * 0.35);
    const w = Math.max(2, Math.round(img.width * s));
    const h = Math.max(3, Math.round(img.height * s));
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.4);
    ctx.drawImage(img, Math.round(px - w / 2 + ox), Math.round(py - h + 2 + oy), w, h);
    if (i % 2 === 0 && k < 0.7) {
      const back = flameFrame(frame + i + 2, false);
      const bx = f.cx + Math.cos(a) * (R - 6);
      const by = f.cy + Math.sin(a) * (R - 6);
      ctx.globalAlpha = Math.min(1, (0.7 - k) * 1.6);
      ctx.drawImage(back, Math.round(bx - back.width / 2 + ox), Math.round(by - back.height + 2 + oy));
    }
    // Embers thrown off as it goes.
    if (Math.random() < dt * 22) spark(r, px, py - 2, ['#ffe070', '#ff9030', '#ff5020'][i % 3], { vx: Math.cos(a) * 30 + (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 25, g: -15, life: 0.35 + Math.random() * 0.3 });
    if (k > 0.5 && Math.random() < dt * 6) spark(r, px, py - 4, '#5a5058', { vx: (Math.random() - 0.5) * 8, vy: -12, g: -8, life: 0.7, size: 2 });
  }
}

// Lightning between two points, re-forked every few hundredths of a second.
function drawBolt(r, ctx, f, k, ox, oy) {
  if (!f.path || f.t - (f.at || 0) > 0.05) {
    f.at = f.t;
    f.path = [];
    const x0 = f.cx;
    const y0 = f.from === 'sky' ? f.ey - 90 : f.cy;
    const x1 = f.ex;
    const y1 = f.ey;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(3, Math.round(len / 6));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const j = s === 0 || s === steps ? 0 : (Math.random() - 0.5) * 8;
      f.path.push([x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j * 0.5]);
    }
  }
  const flicker = Math.random() < 0.25 ? 0.4 : 1;
  const line = (w, color, a) => {
    ctx.globalAlpha = a * (1 - k) * flicker;
    ctx.fillStyle = color;
    for (let s = 0; s < f.path.length - 1; s++) {
      const [ax, ay] = f.path[s];
      const [bx, by] = f.path[s + 1];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
      for (let q = 0; q <= n; q++) ctx.fillRect(Math.round(ax + ((bx - ax) * q) / n + ox - (w >> 1)), Math.round(ay + ((by - ay) * q) / n + oy - (w >> 1)), w, w);
    }
  };
  line(3, '#ffe040', 0.45);
  line(1, '#ffffff', 1);
  // The flash where it strikes.
  if (k < 0.3) {
    ctx.globalAlpha = 0.5 * (1 - k / 0.3);
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(Math.round(f.ex - 5 + ox), Math.round(f.ey - 5 + oy), 10, 10);
  }
}

// An expanding ring (frost, force, a healing glow), broken up as it fades.
function drawRing(ctx, f, k, ox, oy) {
  const R = (f.r0 ?? 3) + ((f.r1 ?? 14) - (f.r0 ?? 3)) * Math.sqrt(k);
  const n = Math.max(12, Math.round(R * 2.2));
  const colors = Array.isArray(f.color) ? f.color : [f.color];
  for (let i = 0; i < n; i++) {
    if (hash(f.seed + i, Math.floor(k * 6)) < k * 0.8) continue;
    const a = (i / n) * Math.PI * 2;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(Math.round(f.cx + Math.cos(a) * R + ox), Math.round(f.cy + Math.sin(a) * R * (f.flat ?? 0.6) + oy), f.thick ?? 1, f.thick ?? 1);
  }
}

// Something drawn out of one and into another (breath a ghoul steals,
// life a stone drinks): a stream of motes along a wavering line, from
// (cx, cy) to (ex, ey), thickest in the middle of its run.
function drawSiphon(ctx, f, k, ox, oy) {
  const n = f.n ?? 16;
  const colors = Array.isArray(f.color) ? f.color : [f.color || '#a0ffb0'];
  const dx = f.ex - f.cx;
  const dy = f.ey - f.cy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / len;
  const py = dx / len;
  for (let i = 0; i < n; i++) {
    const ph = k * 1.7 - (i / n) * 0.7;
    if (ph < 0 || ph > 1) continue;
    const wob = Math.sin(ph * Math.PI) * (f.amp ?? 5) * Math.sin(ph * 9 + i * 1.7 + f.seed);
    const x = f.cx + dx * ph + px * wob;
    const y = f.cy + dy * ph + py * wob - Math.sin(ph * Math.PI) * 6;
    ctx.globalAlpha = Math.min(1, (1 - Math.abs(ph - 0.5) * 1.6)) * 0.95;
    ctx.fillStyle = colors[i % colors.length];
    const sz = i % 3 === 0 ? 2 : 1;
    ctx.fillRect(Math.round(x + ox), Math.round(y + oy), sz, sz);
  }
}

// A straight beam of light from (cx, cy) to (ex, ey): a hot core and a
// soft halo, flickering, narrowing as it fades.
function drawBeam(ctx, f, k, ox, oy) {
  const dx = f.ex - f.cx;
  const dy = f.ey - f.cy;
  const len = Math.max(1, Math.round(Math.hypot(dx, dy)));
  const w = Math.max(1, Math.round((f.width ?? 3) * (1 - k * 0.7)));
  const flick = 0.75 + Math.random() * 0.25;
  for (const [ww, col, a] of [[w + 2, f.halo || '#ff4040', 0.35], [w, f.color || '#ffd0d0', 0.9], [1, '#ffffff', 1]]) {
    ctx.globalAlpha = a * (1 - k) * flick;
    ctx.fillStyle = col;
    for (let q = 0; q <= len; q += 1) ctx.fillRect(Math.round(f.cx + (dx * q) / len + ox - (ww >> 1)), Math.round(f.cy + (dy * q) / len + oy - (ww >> 1)), ww, ww);
  }
}

// A crescent of light thrown along the ground (a moonstone's cut), or any
// travelling wave: from (cx, cy) toward angle `ang`, `range` pixels.
function drawWave(r, ctx, f, k, ox, oy, dt) {
  const d = (f.range ?? 64) * k;
  const x = f.cx + Math.cos(f.ang) * d;
  const y = f.cy + Math.sin(f.ang) * d * 0.75;
  const colors = Array.isArray(f.color) ? f.color : [f.color || '#e8f0ff'];
  const R = 9;
  for (let a = -1.2; a <= 1.2; a += 0.06) {
    const t = Math.abs(a) / 1.2;
    const rr = R * (1 - t * 0.25);
    ctx.globalAlpha = (1 - k * 0.8) * (1 - t * 0.7);
    ctx.fillStyle = colors[Math.floor((a + 1.2) * 5) % colors.length];
    const th = t < 0.5 ? 2 : 1;
    ctx.fillRect(Math.round(x + Math.cos(f.ang + a) * rr + ox), Math.round(y + Math.sin(f.ang + a) * rr * 0.75 + oy), th, th);
  }
  if (Math.random() < dt * 30) spark(r, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6, colors[0], { vx: 0, vy: -6, g: 0, life: 0.4, shape: 'star' });
}

// A shade of someone (onyx): their shape in dusk-violet, half there, a
// rim of violet light round it, fading (lunging in, for an echoed blow).
function drawGhost(r, ctx, f, k, ox, oy) {
  if (!f.look) return;
  const sheet = humanoidSheet(f.look);
  const dir = r.viewDir ? r.viewDir(f.dir ?? 0) : f.dir ?? 0;
  const frame = f.strike ? 3 : 0;
  const x = Math.round(f.cx - 8 + ox);
  const y = Math.round(f.cy + 10 - CHAR_H + 1 + oy);
  const a = ctx.globalAlpha;
  ctx.globalAlpha = (f.strike ? 0.65 : 0.5) * (1 - k);
  // (Shadow-purple by default; a blink's after-image is cold blue.)
  ctx.filter = f.filter || 'brightness(0.35) sepia(1) hue-rotate(220deg) saturate(2.5)';
  ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, x, y - SPR_PAD, CHAR_W, SHEET_H);
  ctx.filter = 'none';
  ctx.globalAlpha = (1 - k) * 0.8;
  ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, f.glow || '#9a6ad8'), x - 1, y - SPR_PAD - 1);
  ctx.globalAlpha = a;
}

// A void (onyx): a black well in the ground with a violet rim, motes
// spiralling down into it; it swells open, holds, and snaps shut.
function drawVoid(r, ctx, f, k, ox, oy, dt) {
  const open = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
  const R = 4 + 14 * open;
  const cx = f.cx + ox;
  const cy = f.cy + oy;
  for (let i = 3; i >= 0; i--) {
    const rr = R * (1 - i * 0.2);
    ctx.globalAlpha = 0.25 + i * 0.18;
    ctx.fillStyle = ['#000000', '#0e0818', '#1e1030', '#3a2060'][i];
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr, rr * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The rim, and motes spinning in.
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + f.t * 3.5;
    const rr = R * (1.05 - ((f.t * 1.5 + i / n) % 1) * 0.8);
    ctx.globalAlpha = 0.85 * open;
    ctx.fillStyle = i % 3 ? '#9a6ad8' : '#e0d0ff';
    ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.45), 1, 1);
  }
  if (Math.random() < dt * 12) spark(r, cx - ox + (Math.random() - 0.5) * R * 2, cy - oy - 6, '#5a3a88', { vx: 0, vy: 8, g: 0, life: 0.4, size: 1 });
}

// A burst of flame where a ruby arrow lands: a ring of tongues thrown out.
function drawBlast(r, ctx, f, k, ox, oy, dt) {
  const R = 4 + (f.r1 ?? 18) * Math.sqrt(k);
  const n = 10;
  const frame = Math.floor(f.t * 14);
  for (let i = 0; i < n; i++) {
    if (hash(f.seed, i) < k * 1.1 - 0.2) continue;
    const a = (i / n) * Math.PI * 2 + f.seed;
    const px = f.cx + Math.cos(a) * R;
    const py = f.cy + Math.sin(a) * R * 0.6;
    const img = flameFrame(frame + i, i % 2 === 0);
    const s = 1.1 - 0.6 * k;
    const w = Math.round(img.width * s);
    const h = Math.round(img.height * s);
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.5);
    ctx.drawImage(img, Math.round(px - w / 2 + ox), Math.round(py - h + 2 + oy), w, h);
    if (Math.random() < dt * 12) spark(r, px, py - 2, ['#ffe070', '#ff9030'][i % 2], { vx: Math.cos(a) * 25, vy: -20, g: -10 });
  }
  if (k < 0.25) {
    ctx.globalAlpha = 0.45 * (1 - k / 0.25);
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(Math.round(f.cx - 6 + ox), Math.round(f.cy - 4 + oy), 12, 8);
  }
}

// ------------------------------------------------------------ on someone
// Flames licking up someone who's burning, embers and smoke rising off them.
export function drawBurning(r, ctx, e, sx, feetY, tall, dt) {
  const f = Math.floor(r.time * 12 + e.id);
  const spots = tall ? [[3, 2, false], [11, 1, false], [7, 9, true], [4, 14, false], [10, 16, false]] : [[4, 1, false], [11, 2, false], [8, 6, true]];
  for (const [dx, up, big] of spots) {
    const img = flameFrame(f + dx, big);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, sx + dx - (img.width >> 1), feetY - up - img.height + 2);
  }
  ctx.globalAlpha = 1;
  const [u, v] = r.toView(e.renderPos().x, e.renderPos().z);
  const bx = u * TILE + 8;
  const by = v * TILE - e.renderPos().y * LH + LH;
  if (Math.random() < dt * 14) spark(r, bx + (Math.random() - 0.5) * 10, by - 4 - Math.random() * (tall ? 20 : 10), ['#ffe070', '#ff9030', '#ff5020'][Math.floor(Math.random() * 3)], { vx: (Math.random() - 0.5) * 14, vy: -20 - Math.random() * 20, g: -10 });
  if (Math.random() < dt * 5) spark(r, bx + (Math.random() - 0.5) * 8, by - (tall ? 24 : 14), '#4a4450', { vx: (Math.random() - 0.5) * 6, vy: -14, g: -6, life: 0.9, size: 2 });
}

// Stars round the head of someone dazed; frost on someone chilled.
export function drawStatus(r, ctx, e, sx, feetY, tall, dt) {
  // Frozen solid: a block of ice round them, glinting.
  if (e.frozenT > 0) {
    const h = tall ? 26 : 15;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#a8dcff';
    ctx.fillRect(sx + 1, feetY - h, 14, h + 1);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e8f8ff';
    ctx.fillRect(sx + 1, feetY - h, 14, 1);
    ctx.fillRect(sx + 1, feetY - h, 1, h + 1);
    ctx.fillRect(sx + 3, feetY - h + 3, 1, 4);
    ctx.fillStyle = '#5a9ad0';
    ctx.fillRect(sx + 14, feetY - h + 1, 1, h);
    ctx.fillRect(sx + 2, feetY, 13, 1);
    ctx.globalAlpha = a;
  }
  // Bleeding: drops falling off them, more the more wounds.
  if (e.bleedT > 0 && Math.random() < dt * 5 * (e.bleedN || 1)) {
    const [u, v] = r.toView(e.renderPos().x, e.renderPos().z);
    spark(r, u * TILE + 4 + Math.random() * 8, v * TILE - e.renderPos().y * LH + LH - 4 - Math.random() * (tall ? 14 : 6), Math.random() < 0.5 ? '#c82030' : '#e84050', { vx: 0, vy: 10, g: 180, life: 0.45, size: 1 });
  }
  // Marked by moonlight: a crescent over their head.
  if (e.markT > 0) {
    const top = feetY - (tall ? 34 : 22) + Math.round(Math.sin(r.time * 3) * 1);
    ctx.fillStyle = '#e8f0ff';
    for (const [x, y] of [[6, 0], [7, 0], [5, 1], [5, 2], [5, 3], [6, 4], [7, 4]]) ctx.fillRect(sx + x + 1, top + y, 1, 1);
    ctx.fillStyle = '#bcd8ff';
    ctx.fillRect(sx + 7, top + 1, 1, 1);
    ctx.fillRect(sx + 7, top + 3, 1, 1);
  }
  if (e.stunT > 0 && !(e.frozenT > 0)) {
    const top = feetY - (tall ? 27 : 16);
    for (let i = 0; i < 3; i++) {
      const a = r.time * 5 + (i * Math.PI * 2) / 3;
      const x = Math.round(sx + 8 + Math.cos(a) * 5);
      const y = Math.round(top + Math.sin(a) * 1.5);
      ctx.fillStyle = i === 0 ? '#ffffff' : '#ffe070';
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillRect(x - 1, y, 3, 1);
    }
  }
  if (e.slowT > 0) {
    // Rime at their feet, and the odd glint.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#c8ecff';
    for (let i = 0; i < 6; i++) ctx.fillRect(sx + 2 + i * 2, feetY - 1 - (i % 2), 1, 1);
    ctx.globalAlpha = 1;
    if (Math.random() < dt * 5) {
      const [u, v] = r.toView(e.renderPos().x, e.renderPos().z);
      spark(r, u * TILE + 8 + (Math.random() - 0.5) * 10, v * TILE - e.renderPos().y * LH + LH - Math.random() * (tall ? 20 : 10), Math.random() < 0.5 ? '#ffffff' : '#a0d8ff', { vx: 0, vy: -4, g: 0, life: 0.5, shape: 'star' });
    }
  }
}

// ------------------------------------------------------------ the great beam
// Each great beam (see game/laser.js): while it gathers, a thin line of
// aim and a swelling light at its source; then the beam itself, a red
// sheath round a white core, pulses running down it, a flare where it
// leaves and a burning splash where it ends.
export function drawLasers(r, ctx, game) {
  if (!game.lasers || !game.lasers.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of game.lasers) {
    if (!L.end) continue;
    const o = L.by;
    const rp = o.renderPos ? o.renderPos() : o;
    const [u, v] = r.toView(rp.x, rp.z);
    const sx = u * TILE - r.camX + 8;
    const sy = v * TILE - rp.y * LH + LH - r.camY - (o.species === 'overseer' ? 30 : o.kind === 'player' ? 14 : 10);
    const [eu, ev] = r.toView(L.end.x, L.end.z);
    const ex = eu * TILE - r.camX + 8;
    const ey = ev * TILE - L.y * LH + LH - r.camY - 2;
    const W = L.width >= 1 ? 1 : 0.6;
    const line = (w, col, a) => {
      ctx.globalAlpha = a;
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    };
    const glow = (x, y, rad, col, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    if (L.t < L.charge) {
      const k = L.t / L.charge;
      ctx.setLineDash([3, 3]);
      line(1, '#ff4030', (0.25 + 0.5 * k) * (0.7 + 0.3 * Math.sin(r.time * 30)));
      ctx.setLineDash([]);
      glow(sx, sy, (4 + 12 * k) * W * 1.4, '#ff6040', 0.5 + 0.4 * k);
      glow(sx, sy, (2 + 5 * k) * W, '#ffffff', 0.8);
      continue;
    }
    const flick = 0.85 + Math.random() * 0.15;
    line(16 * W, '#ff1808', 0.16 * flick);
    line(10 * W, '#ff4020', 0.35 * flick);
    line(6 * W, '#ff9060', 0.7 * flick);
    line(3 * W, '#ffe0c8', 0.95);
    line(1.4 * W, '#ffffff', 1);
    // Pulses running down it.
    const len = Math.hypot(ex - sx, ey - sy);
    for (let i = 0; i < 6; i++) {
      const k = (r.time * 2.6 + i / 6) % 1;
      const px = sx + (ex - sx) * k;
      const py = sy + (ey - sy) * k;
      glow(px, py, 6 * W, '#ffffff', 0.5);
    }
    if (len > 4) {
      glow(sx, sy, 14 * W, '#ff8060', 0.9);
      glow(ex, ey, (12 + Math.random() * 4) * W, '#ffb060', 0.9);
      glow(ex, ey, 5 * W, '#ffffff', 1);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// The Overseer's spikes: shards of alloy flying out, standing in the floor,
// crackling as its pull takes them, swung round it on threads of light.
export function drawKavSpikes(r, ctx, game) {
  const list = game.kavSpikes;
  if (!list || !list.length) return;
  for (const s of list) {
    if (s.gone) continue;
    const o = s.by;
    const [u, v] = r.toView(s.x, s.z);
    const y0 = o ? o.y : 0;
    const x = u * TILE - r.camX + 8;
    const y = v * TILE - y0 * LH + LH - r.camY + 4 - s.h * LH;
    const [ou, ov] = r.toView(o.x, o.z);
    const cx = ou * TILE - r.camX + 8;
    const cy = ov * TILE - y0 * LH + LH - r.camY - 30;
    const ang = s.state === 'orbit' ? Math.atan2(y - cy, x - cx) + Math.PI / 2 : s.state === 'stuck' || s.state === 'charged' ? -Math.PI / 2 : Math.atan2(y - cy, x - cx);
    // Threads of its pull, jagged and flickering.
    if (s.state === 'charged' || s.state === 'orbit' || s.state === 'return') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.random() * 0.4;
      ctx.strokeStyle = Math.random() < 0.5 ? '#5ad8f0' : '#c8fbff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const n = 6;
      for (let i = 1; i < n; i++) ctx.lineTo(cx + ((x - cx) * i) / n + (Math.random() - 0.5) * 6, cy + ((y - cy) * i) / n + (Math.random() - 0.5) * 6);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    // A shadow of it, when it's up.
    ctx.fillStyle = '#1c1622';
    ctx.fillRect(-2, -7, 4, 13);
    ctx.fillStyle = '#4a4870';
    ctx.fillRect(-1, -6, 2, 11);
    ctx.fillStyle = s.state === 'stuck' ? '#8a88a8' : '#c8fbff';
    ctx.fillRect(-1, -6, 1, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -7, 1, 2);
    if (s.state !== 'stuck') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#5ad8f0';
      ctx.fillRect(-3, -8, 6, 15);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
