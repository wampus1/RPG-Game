// (Round 71) What the forged masters give off, drawn pixel by pixel round
// them every frame (see forge.js inPose): flames licking up, embers rising
// and dying, smoke rolling off, drops falling, sparks, a glow.
const TAU = Math.PI * 2;
const px = (ctx, x, y, c, a = 1, w = 1, h = 1) => {
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};
// A tongue of flame standing on (x, y), `h` tall, flickering: white at its
// root, yellow, orange, red at its tip, swaying as it goes up.
export function flame(ctx, x, y, h, t, o = {}) {
  const cols = o.cols || ['#fff8d0', '#ffe070', '#ffa030', '#ff5a10', '#a02008'];
  const w0 = o.w ?? Math.max(1.5, h * 0.32);
  const ph = o.ph ?? x * 0.37;
  const hh = h * (0.82 + 0.18 * Math.sin(t * 13 + ph) + 0.1 * Math.sin(t * 29 + ph * 2));
  for (let i = 0; i < hh; i++) {
    const k = i / hh;
    const w = Math.max(1, Math.round(w0 * Math.pow(1 - k, 0.7) * (1 + 0.15 * Math.sin(t * 17 + i))));
    const cx = x + Math.sin(t * 9 + ph - i * 0.45) * k * (o.sway ?? 1.4);
    const ci = Math.min(cols.length - 1, Math.floor(k * (cols.length - 0.6)));
    px(ctx, cx - w / 2, y - i, cols[Math.min(cols.length - 1, ci + 1)], o.a ?? 0.95, w, 1);
    if (w > 2) px(ctx, cx - w / 2 + 1, y - i, cols[ci], o.a ?? 1, w - 2, 1);
    else if (k < 0.4) px(ctx, cx - 0.5, y - i, cols[ci], o.a ?? 1);
  }
  // (A lick of it torn off the top now and then.)
  const f = (t * 3 + ph) % 1;
  if (f < 0.5) px(ctx, x + Math.sin(t * 7 + ph) * 1.5, y - hh - 1 - f * 6, cols[3], (o.a ?? 1) * (1 - f * 2));
  ctx.globalAlpha = 1;
}
// Embers rising from a span (x0..x0+w at y), drifting, cooling as they go.
export function embers(ctx, x0, y, w, t, o = {}) {
  const n = o.n ?? 6;
  const rise = o.rise ?? 24;
  const cols = o.cols || ['#fff0a0', '#ffb040', '#ff6020', '#8a2010'];
  for (let i = 0; i < n; i++) {
    const k = (t * (o.speed ?? 0.5) + i / n + (i * 0.618) % 1) % 1;
    const sx = x0 + ((i * 0.618 * 7) % 1) * w + Math.sin(t * 2 + i * 1.7) * 2 * k;
    const c = cols[Math.min(cols.length - 1, Math.floor(k * cols.length))];
    px(ctx, sx, y - k * rise, c, (o.a ?? 1) * (1 - k * 0.6));
  }
  ctx.globalAlpha = 1;
}
// Smoke rolling up off (x, y): puffs growing and thinning, drifting.
export function smoke(ctx, x, y, t, o = {}) {
  const n = o.n ?? 5;
  const rise = o.rise ?? 20;
  const col = o.col || '#7a7270';
  const dark = o.dark || '#4a4442';
  for (let i = 0; i < n; i++) {
    const k = (t * (o.speed ?? 0.4) + i / n) % 1;
    const r = (o.r0 ?? 1.5) + k * (o.grow ?? 3);
    const cx = x + Math.sin(k * 4 + i * 2.1) * (o.spread ?? 3) * k + (o.drift ?? 0) * k;
    const cy = y - k * rise;
    const a = (o.a ?? 0.5) * (1 - k);
    puff(ctx, cx, cy, r, i % 2 ? col : dark, a);
  }
  ctx.globalAlpha = 1;
}
// A round puff of something (a disc of pixels, its edge thinner).
export function puff(ctx, cx, cy, r, c, a) {
  ctx.fillStyle = c;
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      ctx.globalAlpha = a * (d > 0.7 ? 0.55 : 1);
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// Drops falling off it now and then from each of `xs` (along y).
export function drops(ctx, x, y, t, xs, o = {}) {
  const len = o.len ?? 12;
  xs.forEach((dx, i) => {
    const k = (t * (o.speed ?? 0.9) + i * 0.37) % 1;
    px(ctx, x + dx, y + k * k * len, o.col || '#c8ff60', (o.a ?? 0.9) * (1 - k * 0.7), 1, k < 0.2 ? 1 : 2);
  });
  ctx.globalAlpha = 1;
}
// A soft glow (rings of fading pixels, added).
export function glowAt(ctx, x, y, r, c, k = 0.5) {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = c;
  const R = Math.ceil(r);
  for (let yy = -R; yy <= R; yy++) {
    for (let xx = -R; xx <= R; xx++) {
      const d = Math.hypot(xx, yy) / r;
      if (d > 1) continue;
      ctx.globalAlpha = k * (1 - d) * (1 - d);
      ctx.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}
// Sparks thrown off (x, y): bright lines arcing out and falling.
export function sparks(ctx, x, y, t, o = {}) {
  const n = o.n ?? 6;
  for (let i = 0; i < n; i++) {
    const k = (t * (o.speed ?? 1.5) + i / n) % 1;
    const a = (o.a0 ?? -Math.PI / 2) + Math.sin(i * 2.4) * (o.spread ?? 1.2);
    const v = (o.v ?? 12) * (0.6 + ((i * 0.618) % 1) * 0.6);
    const sx = x + Math.cos(a) * v * k;
    const sy = y + Math.sin(a) * v * k + k * k * (o.fall ?? 10);
    px(ctx, sx, sy, k < 0.3 ? '#ffffff' : o.col || '#ffd060', 1 - k);
  }
  ctx.globalAlpha = 1;
}
// Motes going round (x, y) in an ellipse, trailing.
export function motes(ctx, x, y, t, o = {}) {
  const n = o.n ?? 5;
  for (let i = 0; i < n; i++) {
    const a = t * (o.speed ?? 1) + (i / n) * TAU;
    for (let k = 0; k < (o.trail ?? 3); k++) {
      const b = a - k * 0.14;
      const behind = Math.sin(b) < 0;
      if (o.side !== undefined && behind !== (o.side === 'back')) continue;
      px(ctx, x + Math.cos(b) * (o.rx ?? 16), y + Math.sin(b) * (o.ry ?? 5), k ? o.col || '#ffd060' : '#ffffff', (1 - k * 0.3) * (behind ? 0.55 : 1));
    }
  }
  ctx.globalAlpha = 1;
}
// A crackle of lightning from a to b (jagged, white in its heart).
export function bolt(ctx, x0, y0, x1, y1, t, o = {}) {
  const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
  let lx = x0;
  let ly = y0;
  const seed = Math.floor(t * (o.rate ?? 14));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const j = i === n ? 0 : (Math.sin(seed * 12.9 + i * 78.2) * 43758.5) % 1;
    const nx = x0 + (x1 - x0) * k - (y1 - y0) / n * j * (o.jag ?? 1.5);
    const ny = y0 + (y1 - y0) * k + (x1 - x0) / n * j * (o.jag ?? 1.5);
    const m = Math.max(1, Math.ceil(Math.hypot(nx - lx, ny - ly)));
    for (let s = 0; s <= m; s++) px(ctx, lx + ((nx - lx) * s) / m, ly + ((ny - ly) * s) / m, s % 2 ? o.col || '#a0e8ff' : '#ffffff', o.a ?? 1);
    lx = nx;
    ly = ny;
  }
  ctx.globalAlpha = 1;
}
export { px as dot };
