// A fallen star's wing (see game/starfall.js): one, from the left shoulder,
// a dragon's: a frame of blue bone, and between its fingers a skin the
// light comes through, glowing faintly at its edge. Spent (it carried you
// through a second roll), it goes thin and grey and fills back in.
//
// Drawn pixel by pixel to little canvases, once each: spread out to the
// side (seen from in front or behind) or swept back (side on), and a
// second, lifted pose for a slow beat of it.

// (Round 50: a dragon's, and a little smaller again: 14 across, not 16.)
const W = 14;
const H = 14;
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

// The wing's frame: the shoulder, the wrist (where the arm bends and the
// fingers spread from), the fingers' tips round from the leading one, and
// where its skin meets the flank again. Reaching to the left and up
// (mirrored for the other side as it's drawn). `lift`: 0 or 1, the tips
// raised a little more. `swept`: side on, folded back and lower.
export function wingFrame(lift, swept) {
  const l = lift ? 1 : 0;
  if (swept) {
    return {
      shoulder: [SHX, shY(true)],
      wrist: [9, 2 - l],
      tips: [[2, 5 - l], [2, 9 - l], [5, 12], [8, 13]],
      root: [10, 11],
    };
  }
  return {
    shoulder: [SHX, shY(false)],
    wrist: [8, 1 - l],
    tips: [[0, 4 - l], [1, 8 - l], [3, 11], [7, 12]],
    root: [10, 10],
  };
}

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Which pixels the skin covers: out from the arm to the fingers' tips, its
// trailing edge hung between each finger and the next in a curve pulled
// back toward the wrist (a dragon's wing hangs in scallops between its
// bones).
function membrane(F) {
  const poly = [F.shoulder, F.wrist, F.tips[0]];
  const trail = [...F.tips, F.root];
  for (let i = 0; i < trail.length - 1; i++) {
    const [ax, ay] = trail[i];
    const [bx, by] = trail[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const wl = Math.hypot(F.wrist[0] - mx, F.wrist[1] - my);
    const depth = len * 0.38;
    const cx = mx + ((F.wrist[0] - mx) / wl) * depth * 2;
    const cy = my + ((F.wrist[1] - my) / wl) * depth * 2;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      poly.push([(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by]);
    }
    poly.push(trail[i + 1]);
  }
  const on = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(poly, x + 0.5, y + 0.5)) on[y * W + x] = 1;
  return on;
}

// A line of pixels from a to b.
function line(a, b, fn) {
  let [x0, y0] = a.map(Math.round);
  const [x1, y1] = b.map(Math.round);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 64; n++) {
    fn(x0, y0);
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

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

// The wing as pixels: [r, g, b, a] for each, row by row (a = 0: bare).
export function wingPixels(lift, swept, dull) {
  const F = wingFrame(lift, swept);
  const pal = dull
    ? { skin: ['#a4acba', '#8e98a8', '#7a8494'], skinA: 0.32, rim: '#b8c0cc', rimA: 0.5, bone: '#5a6474', boneHi: '#9aa2b0', claw: '#c8ccd4' }
    : { skin: ['#8ccaff', '#5fa2f2', '#4382de'], skinA: 0.6, rim: '#d0f0ff', rimA: 0.85, bone: '#163a8a', boneHi: '#a6dcff', claw: '#f0faff' };
  const out = new Uint8ClampedArray(W * H * 4);
  const set = (x, y, hex, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = rgb(hex);
    const o = (y * W + x) * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = Math.round(a * 255);
  };
  const on = membrane(F);
  const lead = [F.shoulder, F.wrist, F.tips[0]];
  // How far a pixel is from the leading edge (the skin's lighter by its
  // bones, deeper toward the edge it trails).
  const fromLead = (x, y) => {
    let best = 99;
    for (let i = 0; i < lead.length - 1; i++) {
      const [ax, ay] = lead[i];
      const [bx, by] = lead[i + 1];
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
      best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
    }
    return best;
  };
  // How far a pixel is from the nearest finger (the skin's lit along
  // them, where it's stretched thinnest).
  const fingers = F.tips.slice(1).map((t) => [F.wrist, t]);
  const fromBone = (x, y) => {
    let best = fromLead(x, y);
    for (const [[ax, ay], [bx, by]] of fingers) {
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
      best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
    }
    return best;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on[y * W + x]) continue;
      const bare = (q, r) => q < 0 || r < 0 || q >= W || r >= H || !on[r * W + q];
      // Its trailing edge (not the leading one, where the bone is): skin
      // with bare air below or beside it, away from the arm. It glows.
      if (fromLead(x, y) > 1.4 && (bare(x, y + 1) || bare(x - 1, y) || bare(x + 1, y) || bare(x - 1, y + 1) || bare(x + 1, y + 1))) {
        set(x, y, pal.rim, pal.rimA);
        continue;
      }
      const d = fromBone(x, y);
      set(x, y, pal.skin[d < 1.3 ? 0 : d < 2.6 ? 1 : 2], pal.skinA);
    }
  }
  // The fingers, from the wrist out to each tip: thin, dark bone.
  for (const tip of F.tips.slice(1)) line(F.wrist, tip, (x, y) => set(x, y, pal.bone, 0.92));
  // The arm and its leading finger: bone, the arm lit along its top.
  line(F.shoulder, F.wrist, (x, y) => set(x, y - 1, pal.boneHi, 0.95));
  for (let i = 0; i < lead.length - 1; i++) line(lead[i], lead[i + 1], (x, y) => set(x, y, pal.bone, 1));
  // The claw at its wrist, and the joint at the shoulder.
  set(F.wrist[0], F.wrist[1] - 1, pal.claw, 1);
  set(F.wrist[0] + 1, F.wrist[1] - 2, pal.claw, 0.8);
  // (And a hooked claw at the end of the outer fingers.)
  for (const t of F.tips.slice(1, 3)) set(t[0] - 1, t[1] + 1, pal.claw, 0.75);
  set(F.shoulder[0], F.shoulder[1], pal.bone, 1);
  set(F.shoulder[0] + 1, F.shoulder[1], pal.bone, 1);
  return out;
}

function paint(lift, swept, dull) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  img.data.set(wingPixels(lift, swept, dull));
  g.putImageData(img, 0, 0);
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
    const cx = ax + (flip ? 5 : -5);
    const cy = shoulderY + 2;
    const pulse = 0.55 + 0.25 * Math.sin(t * 2.4);
    const gl = ctx.createRadialGradient(cx, cy, 1, cx, cy, 10);
    gl.addColorStop(0, `rgba(120,190,255,${(0.42 * pulse).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.globalAlpha = a0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gl;
    ctx.fillRect(cx - 10, cy - 10, 20, 20);
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

// Both wings flung wide from a point (x, y) on the screen, lit: a roll on
// the wing (see Renderer.drawTumble and the 'wingbeat' effect in fx.js).
// `a`: how bright; `sc`: how big.
export function drawWingBurst(ctx, x, y, a, sc = 1.5) {
  if (a <= 0.01) return;
  const img = wingSprite(1, false, false);
  const oy = shY(false);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= Math.min(1, a);
  for (const side of [1, -1]) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(side * sc, sc);
    ctx.drawImage(img, -SHX - 1, -oy);
    ctx.restore();
  }
  ctx.restore();
}
