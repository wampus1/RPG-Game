// A fallen star's wing (see game/starfall.js): one, from the left shoulder,
// white feathers edged in gold, with a glow about it. Spent (it carried
// you through a second roll), it goes thin and grey and fills back in.
//
// Drawn pixel by pixel to little canvases, once each: spread out to the
// side (seen from in front or behind) or swept back (side on), and a
// second, lifted pose for a slow beat of it.

// (Round 49: smaller than it was, 16 across, not 22.)
const W = 16;
const H = 16;
export const WING_SIZE = W;
// The shoulder's place on the little canvas.
const SHX = W - 3;
const shY = (swept) => (swept ? 6 : 5);
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// The wing spread out from its shoulder at (ax, ay), reaching to the left
// and up (mirrored for the other side as it's drawn). `lift`: 0 or 1, the
// tip raised a little more. `swept`: side on, folded back and lower.
function paint(lift, swept, dull) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const pal = dull
    ? { edge: '#a8a49a', top: '#b8b4ac', body: '#9a968e', shade: '#7a766e', tip: '#6a665e' }
    : { edge: '#ffe7a0', top: '#fffaf0', body: '#f4efe2', shade: '#d8d0bc', tip: '#c4b896' };
  const ax = SHX;
  const ay = shY(swept);
  // The tip, out and up (swept: out and level, the feathers hanging).
  const tx = 1;
  const ty = swept ? 4 - lift : 1 - lift;
  // Along the arm of it, from the shoulder to the tip: the leading edge.
  const N = 13;
  const edge = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    // (Bowed up in the middle.)
    const x = ax + (tx - ax) * k;
    const y = ay + (ty - ay) * k - Math.sin(k * Math.PI) * (swept ? 1 : 1.8);
    edge.push([x, y]);
  }
  // The long flight feathers, hanging from the edge: longest toward the
  // tip, each a stroke two wide, shaded at its end.
  const n = 6;
  for (let j = 0; j < n; j++) {
    const k = 0.25 + (j / (n - 1)) * 0.75;
    const [x0, y0] = edge[Math.round(k * N)];
    const len = (swept ? 4 : 5) + k * (swept ? 3 : 5);
    const slant = (swept ? 0.3 : 0.15) + k * 0.2;
    for (let s = 0; s < len; s++) {
      const x = x0 + s * slant;
      const y = y0 + 1 + s;
      if (y >= H - 1) break;
      const f = s / len;
      const col = f > 0.8 ? pal.tip : f > 0.55 ? pal.shade : pal.body;
      px(x, y, col);
      px(x - 1, y, j % 2 ? pal.shade : col);
    }
  }
  // The coverts over their roots: shorter, overlapping, a brighter white.
  for (let j = 0; j < 7; j++) {
    const k = j / 6;
    const [x0, y0] = edge[Math.round(k * N)];
    const len = 2 + Math.round(k);
    for (let s = 0; s < len; s++) {
      px(x0 + s * 0.2, y0 + 1 + s, s === len - 1 ? pal.shade : pal.top);
      px(x0 + 1 + s * 0.2, y0 + 1 + s, pal.top);
    }
  }
  // The leading edge itself, in gold.
  for (const [x, y] of edge) {
    px(x, y, pal.edge);
    px(x, y + 1, pal.top);
  }
  // Where it meets the shoulder.
  px(ax, ay, pal.edge);
  px(ax + 1, ay, pal.edge);
  px(ax, ay + 1, pal.body);
  return c;
}

// The picture of it, made once.
export function wingSprite(lift, swept, dull) {
  const k = `${lift}|${swept ? 1 : 0}|${dull ? 1 : 0}`;
  let c = cache.get(k);
  if (!c) {
    c = paint(lift, swept, dull);
    cache.set(k, c);
  }
  return c;
}

// Drawn on someone at (sx, top) (the sprite's place: see Renderer.
// drawEntity), facing `dir` on screen (0 toward you, 1 left, 2 away, 3
// right). `k`: how much of it is there (1 whole, 0 just spent). `t`: the
// time, for its slow beat and the glow's breathing.
export function drawWing(ctx, dir, sx, top, k, t) {
  const whole = k >= 0.999;
  const lift = Math.floor(t * 1.6) % 4 === 0 ? 1 : 0;
  const swept = dir === 1 || dir === 3;
  const img = wingSprite(whole ? lift : 0, swept, !whole);
  // The left shoulder: on your right as they face you, on your left as
  // they face away; side on, swept back behind them.
  const shoulderY = top + 7;
  // (Which way it reaches: false, out to the left of its shoulder.)
  let flip;
  let ax;
  if (dir === 0) {
    flip = true;
    ax = sx + 11;
  } else if (dir === 2) {
    flip = false;
    ax = sx + 5;
  } else if (dir === 1) {
    // Facing left: its back is to the right.
    flip = true;
    ax = sx + 9;
  } else {
    flip = false;
    ax = sx + 7;
  }
  const a0 = ctx.globalAlpha;
  ctx.save();
  // Spent: thin and faint, filling back in as it comes back.
  const alpha = whole ? 1 : 0.22 + 0.5 * k;
  // The glow about it (whole, it shines).
  if (whole) {
    const cx = ax + (flip ? 6 : -6);
    const cy = shoulderY + 2;
    const pulse = 0.55 + 0.25 * Math.sin(t * 2.4);
    const gl = ctx.createRadialGradient(cx, cy, 1, cx, cy, 11);
    gl.addColorStop(0, `rgba(255,240,190,${(0.4 * pulse).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.globalAlpha = a0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gl;
    ctx.fillRect(cx - 11, cy - 11, 22, 22);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = a0 * alpha;
  // (The sprite's shoulder is at (SHX, shY): put it on theirs.)
  const ox = SHX;
  const oy = shY(swept);
  if (flip) {
    ctx.translate(ax + ox, shoulderY - oy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else ctx.drawImage(img, ax - ox, shoulderY - oy);
  ctx.restore();
  ctx.globalAlpha = a0;
}

// Whether the wing is drawn in front of them (seen from behind it is: it
// grows from their back) or behind.
export function wingInFront(dir) {
  return dir === 2;
}
