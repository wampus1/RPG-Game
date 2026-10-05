// Pieces the painted openings are built from (round 50; see game/intros.js
// and game/starfall.js), drawn pixel by pixel onto their small canvases:
// people (proportioned as people, their arms at their sides and joined at
// the shoulder, seen from in front or from behind, standing, walking,
// pointing, running, knocked flat), houses seen three-quarters on (the
// front wall, the shaded gable end, the roof's slope up to its ridge and
// the eaves over the walls, framed windows and a door, a shadow under
// them), trees lit from one side with their shadow on the ground, and
// clouds heaped up and lit along their tops.
//
// Everything takes `px(x, y, colour)`: one pixel (alpha with the canvas's
// own globalAlpha).

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function shade(h, d) {
  const [r, g, b] = rgb(h);
  return hex([r + d, g + d, b + d]);
}
export function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  const t = Math.max(0, Math.min(1, k));
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

// A filled polygon, scanline by scanline (`col(x, y)` the colour of each
// pixel, or null to leave it), nothing above `minY`.
export function fillPoly(px, pts, col, minY = -1e9) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(Math.ceil(Math.min(...ys) - 0.5), Math.ceil(minY));
  const y1 = Math.floor(Math.max(...ys) - 0.5);
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
        const c = col(x, y);
        if (c) px(x, y, c);
      }
    }
  }
}

// A line of pixels.
export function line(px, x0, y0, x1, y1, col) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 600; n++) {
    px(x0, y0, typeof col === 'function' ? col(x0, y0) : col);
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

// ------------------------------------------------------------ people
// A person standing at (x, yb) (their feet on yb), `o`:
//   size: 'tiny' (5 tall), 'small' (8), 'normal' (11);
//   face: 'front' or 'back' (from behind: all hair, no face);
//   pose: 'stand', 'walk', 'point' (an arm up, toward `dir`), 'wave',
//     'run', 'down' (flat on the ground), 'cower' (crouched, arms up);
//   dir: -1 or 1 (which way they're turned, a little), frame: for a walk;
//   turn: from behind, the side their head's turned to (-1, 0, 1);
//   shirt, pants, skin, hair, and lit (-1, 0, 1: the side the light's on).
export function drawPerson(px, x, yb, o) {
  x = Math.round(x);
  yb = Math.round(yb);
  const skin = o.skin || '#e0b090';
  const hair = o.hair || '#3a2418';
  const shirt = o.shirt || '#7a5a3a';
  const pants = o.pants || shade(shirt, -50);
  const boot = '#241a14';
  const lit = o.lit || 0;
  const sh = (c, side) => (lit && side === lit ? shade(c, 26) : lit && side === -lit ? shade(c, -22) : c);
  const size = o.size || 'small';
  const pose = o.pose || 'stand';
  const step = pose === 'walk' || pose === 'run' ? (o.frame || 0) % 2 : 0;
  const dir = o.dir || 1;
  const back = o.face === 'back';
  if (pose === 'down') {
    // Flat on the ground, head toward `dir`.
    const L = size === 'normal' ? 9 : size === 'small' ? 7 : 5;
    for (let i = 0; i < L; i++) {
      const k = dir > 0 ? i : L - 1 - i;
      const c = k >= L - 2 ? (k === L - 1 ? hair : skin) : k >= L - 5 ? shirt : k >= 1 ? pants : boot;
      px(x - Math.floor(L / 2) + i, yb - 1, c);
      if (k < L - 2 && size !== 'tiny') px(x - Math.floor(L / 2) + i, yb - 2, shade(c, 18));
    }
    return;
  }
  if (size === 'tiny') {
    // Two wide: legs, body, a head.
    px(x, yb - 1, step ? boot : pants);
    px(x + 1, yb - 1, step ? pants : boot);
    px(x, yb - 2, sh(shirt, -1));
    px(x + 1, yb - 2, sh(shirt, 1));
    px(x, yb - 3, sh(shirt, -1));
    px(x + 1, yb - 3, sh(shirt, 1));
    px(x, yb - 4, back ? hair : skin);
    px(x + 1, yb - 4, back ? hair : skin);
    px(x, yb - 5, hair);
    px(x + 1, yb - 5, hair);
    return;
  }
  const big = size === 'normal';
  // Rows, from the feet up: boots, legs, body (with arms at its sides),
  // neck and head.
  const legH = big ? 3 : 2;
  const bodyH = big ? 4 : 3;
  const headH = big ? 3 : 2;
  const crouch = pose === 'cower' ? 1 : 0;
  // Boots and legs (two of them, a gap between; a step lifts one).
  for (let i = 0; i < legH; i++) {
    const y = yb - 1 - i;
    const c = i === 0 ? boot : pants;
    if (!(step === 1 && i === 0)) px(x - 1, y, c);
    if (!(step === 0 && pose !== 'stand' && pose !== 'point' && pose !== 'wave' && i === 0)) px(x + 1, y, c);
    if (big && i > 0) px(x, y, i === legH - 1 ? pants : null);
  }
  if (step === 1) px(x - 1 - (pose === 'run' ? 1 : 0), yb - 1, boot);
  if (step === 0 && (pose === 'walk' || pose === 'run')) px(x + 1 + (pose === 'run' ? 1 : 0), yb - 1, boot);
  // The body, three wide (a belt under it, big).
  const by = yb - legH + crouch;
  for (let i = 0; i < bodyH; i++) {
    const y = by - 1 - i;
    for (let k = -1; k <= 1; k++) px(x + k, y, i === 0 && big ? shade(pants, -10) : sh(shirt, k));
  }
  // Arms, joined at the shoulder, hanging at the sides to the hand; or
  // one up (pointing, waving), or both up over the head (cowering).
  const shoulder = by - bodyH;
  const armLen = big ? 3 : 2;
  const arm = (side, up) => {
    const ax = x + side * 2;
    if (!up) {
      for (let i = 0; i < armLen; i++) px(ax, shoulder + i, sh(shirt, side));
      px(ax, shoulder + armLen, skin);
      return;
    }
    // Raised: up and a little out (its hand above the head, not far off).
    px(ax, shoulder, sh(shirt, side));
    px(ax, shoulder - 1, sh(shirt, side));
    if (big) px(ax + (up === 2 ? 0 : side), shoulder - 2, sh(shirt, side));
    px(ax + (up === 2 ? 0 : side), shoulder - (big ? 3 : 2), skin);
  };
  const t = o.t || 0;
  if (pose === 'point') {
    arm(-dir, 0);
    arm(dir, 1);
  } else if (pose === 'wave') {
    arm(-dir, 0);
    arm(dir, Math.floor(t * 4) % 2 ? 1 : 2);
  } else if (pose === 'cower') {
    arm(-1, 2);
    arm(1, 2);
  } else if (pose === 'run') {
    // (Swinging, opposite to the legs.)
    px(x - 2, shoulder + (step ? 0 : 1), sh(shirt, -1));
    px(x - 2, shoulder + (step ? 1 : 2), skin);
    px(x + 2, shoulder + (step ? 1 : 0), sh(shirt, 1));
    px(x + 2, shoulder + (step ? 2 : 1), skin);
  } else {
    arm(-1, 0);
    arm(1, 0);
  }
  // The head: hair over it (all of it, from behind), the face in front,
  // turned a little toward `dir`.
  const hy = shoulder - 1;
  if (big) px(x, hy, back ? hair : skin);
  const top = hy - (big ? 0 : 0) - headH + 1;
  for (let r = 0; r < headH; r++) {
    const y = big ? hy - 1 - r : hy - r;
    for (let k = -1; k <= 1; k++) {
      let c;
      if (back) c = hair;
      else if (r === headH - 1) c = hair;
      else c = k === -dir && r === headH - 2 ? hair : skin;
      px(x + k, y, c);
    }
  }
  if (!back && big) px(x + dir, hy - 2, '#2a1a14');
  // (From behind, turned: a cheek showing on that side.)
  if (back && o.turn) px(x + o.turn, big ? hy - 1 : hy, skin);
  void top;
}

// ------------------------------------------------------------ houses
// A house seen three-quarters on: its front wall `w` wide and `h` high
// with its feet on `yb` at x0, going back `d` (up and to the right), its
// roof (`shape`: 'gable', 'steep', 'flat', 'hut') rising `rh` to a ridge
// that runs along it. `o`: wall, side (the gable end's colour), roof,
// timber (frames, or null), door, windows (how many), lit (their light at
// night, 0-1), glow (the colour of it), up (0-1: how far it's up, the
// walls rising, the roof last), chimney, smoke (t), mine (a light at the
// door). Returns the ridge ({ x0, x1, y, top }: for a tower on it); its
// windows left in `o.wins`.
export function drawHouse(g, px, x0, yb, w, h, o) {
  x0 = Math.round(x0);
  yb = Math.round(yb);
  const d = o.depth ?? Math.max(3, Math.round(w * 0.28));
  const dh = Math.max(1, Math.round(d * 0.5));
  const shape = o.shape || 'gable';
  const up = o.up ?? 1;
  const wall = o.wall || '#d8c8a0';
  const side = o.side || shade(wall, -34);
  const roof = o.roof || '#8a3a2a';
  const timber = o.timber || null;
  const rh = shape === 'flat' ? 0 : o.rh ?? Math.round(w * (shape === 'steep' ? 0.55 : 0.36));
  const wallUp = Math.min(1, up / 0.8);
  const minY = yb - Math.round((h + dh) * wallUp) - 1;
  // Its shadow on the ground, behind and to the right.
  g.globalAlpha *= 0.35;
  fillPoly(px, [[x0 - 1, yb + 1], [x0 + w + 1, yb + 1], [x0 + w + d + 2, yb - dh + 1], [x0 + w + d + 2, yb - dh + 3], [x0 + w + 2, yb + 3], [x0 - 1, yb + 3]], () => '#000000');
  g.globalAlpha /= 0.35;
  if (shape === 'hut') return drawHut(g, px, x0, yb, w, h, { ...o, d, dh, wallUp, minY, rh });
  // The frame first, standing ahead of the walls.
  if (up < 0.8 && timber) {
    for (let y = yb - h; y < yb; y++) {
      px(x0, y, timber);
      px(x0 + w - 1, y, timber);
      px(x0 + w + d - 1, y - dh, timber);
    }
    line(px, x0, yb - h, x0 + w - 1, yb - h, timber);
    line(px, x0 + w - 1, yb - h, x0 + w + d - 1, yb - h - dh, timber);
  }
  // The gable end (right), in shade, and the front wall.
  const sideCol = (x, y) => {
    const rel = (x - x0 - w) / Math.max(1, d);
    if (timber && (x === x0 + w || x === x0 + w + d - 1)) return shade(timber, -14);
    return (x + y) % 5 === 0 ? shade(side, -10) : rel > 0.7 ? shade(side, -6) : side;
  };
  fillPoly(px, [[x0 + w, yb], [x0 + w + d, yb - dh], [x0 + w + d, yb - dh - h], [x0 + w, yb - h]], sideCol, minY);
  const frontCol = (x, y) => {
    const fx = x - x0;
    if (timber && (fx === 0 || fx === w - 1 || (w > 14 && fx === Math.floor(w / 2) - (Math.floor(w / 2) % 2)))) return timber;
    if (timber && y === yb - h + Math.round(h * 0.45) && w > 10) return timber;
    if (fx === 0) return shade(wall, 10);
    return (x * 7 + y * 3) % 11 === 0 ? shade(wall, -8) : wall;
  };
  fillPoly(px, [[x0, yb], [x0 + w, yb], [x0 + w, yb - h], [x0, yb - h]], frontCol, minY);
  // (The bottom course: darker, where it meets the ground.)
  if (wallUp > 0.2) for (let x = x0; x < x0 + w; x++) px(x, yb - 1, shade(wall, -26));
  if (up < 0.8) return;
  const k = Math.min(1, (up - 0.8) / 0.2);
  // Windows (framed, a sill under each; lit at night) and the door.
  const win = windowsFor(x0, yb, w, h, o.windows ?? Math.max(1, Math.floor((w - 5) / 6)));
  o.wins = win;
  const night = o.night || 0;
  for (const q of win) {
    for (let y = q.y - 1; y <= q.y + q.h; y++) for (let x = q.x - 1; x <= q.x + q.w; x++) px(x, y, timber || shade(wall, -46));
    for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) px(x, y, night > 0.3 && o.lit ? mix('#2a2026', o.glow || '#ffcc6a', Math.min(1, night * 1.4)) : y === q.y ? '#5a6878' : '#2a2a36');
    for (let x = q.x - 1; x <= q.x + q.w; x++) px(x, q.y + q.h + 1, shade(wall, 22));
  }
  const dw = w >= 16 ? 3 : 2;
  const dhh = Math.max(2, Math.min(h - 3, w >= 16 ? 6 : Math.round(h * 0.5)));
  const dx0 = x0 + Math.floor(w / 2 - dw / 2);
  for (let y = yb - dhh - 1; y < yb; y++) for (let x = dx0 - 1; x <= dx0 + dw; x++) px(x, y, timber || shade(wall, -46));
  for (let y = yb - dhh; y < yb; y++) for (let x = dx0; x < dx0 + dw; x++) px(x, y, o.mine ? (y < yb - dhh + 1 ? '#ffe8a0' : '#ffcc6a') : o.door || '#4a2e1a');
  if (!o.mine) px(dx0 + dw - 1, yb - Math.ceil(dhh / 2), '#c8a050');
  // The roof.
  const ov = 1;
  const top = yb - h;
  if (shape === 'flat') {
    // A flat top, a parapet round it.
    fillPoly(px, [[x0 - ov, top + 1], [x0 + w + ov, top + 1], [x0 + w + d + ov, top - dh + 1], [x0 + d - ov, top - dh + 1]], (x, y) => (y === top ? shade(roof, 12) : roof));
    line(px, x0 - ov, top, x0 + w + ov, top, shade(roof, -20));
    line(px, x0 + w + ov, top, x0 + w + d + ov, top - dh, shade(roof, -26));
    if (k >= 1) for (let x = x0 - ov; x <= x0 + w + ov; x += 3) px(x, top - 1, shade(roof, -6));
  } else {
    const rH = Math.round(rh * k);
    // The ridge: halfway back, `rh` up; the slope toward you from the
    // eaves up to it (tiled in rows, lit toward the top), the gable end's
    // triangle under the roof's edge.
    const rx0 = x0 - ov + Math.round(d / 2);
    const rx1 = x0 + w + ov + Math.round(d / 2);
    const ry = top - Math.round(dh / 2) - rH;
    const apex = [x0 + w + Math.round(d / 2), ry];
    fillPoly(px, [[x0 + w, top + 1], [x0 + w + d, top - dh + 1], apex], (x, y) => ((x + y) % 4 === 0 ? shade(side, -12) : shade(side, 6)));
    if (timber && rH > 4) line(px, apex[0], apex[1] + 1, apex[0], top - Math.round(dh / 2), timber);
    const slopeRows = Math.max(1, top - ry);
    const roofCol = (x, y) => {
      const r = (top - y) / slopeRows;
      if ((top - y) % 2 === 0 && r < 0.95) return shade(roof, -16);
      return r > 0.75 ? shade(roof, 18) : (x + y * 2) % 7 === 0 ? shade(roof, -8) : roof;
    };
    fillPoly(px, [[x0 - ov, top + 1], [x0 + w + ov, top + 1], [rx1, ry], [rx0, ry]], roofCol);
    // Its edges: the eave, the verge up the gable, the ridge.
    line(px, x0 - ov, top + 1, x0 + w + ov, top + 1, shade(roof, -34));
    line(px, x0 + w + ov, top + 1, rx1, ry, shade(roof, -28));
    line(px, rx1, ry, x0 + w + d + ov, top - dh + 1, shade(roof, -40));
    line(px, x0 - ov, top + 1, rx0, ry, shade(roof, -20));
    line(px, rx0, ry, rx1, ry, shade(roof, 34));
    o.ridge = { x0: rx0, x1: rx1, y: ry, top };
    // A chimney through it, and its smoke.
    if (o.chimney && k >= 1) {
      const cx = Math.round(x0 + w * 0.7 + d * 0.3);
      const cy = ry + Math.round(slopeRows * 0.35);
      for (let y = cy - 4; y <= cy; y++) {
        px(cx, y, '#4a4242');
        px(cx + 1, y, '#363030');
      }
      px(cx, cy - 4, '#5e5656');
      px(cx + 1, cy - 4, '#5e5656');
      if (o.smoke !== undefined) {
        for (let i = 0; i < 4; i++) {
          const s = (o.smoke * 0.6 + i / 4 + x0 * 0.01) % 1;
          const a = g.globalAlpha;
          g.globalAlpha = a * 0.5 * (1 - s);
          px(cx + Math.round(Math.sin(s * 6 + x0) * 2 + s * 4), cy - 6 - s * 10, night > 0.5 ? '#5a5a6a' : '#d0d0d0');
          px(cx + 1 + Math.round(Math.sin(s * 6 + x0) * 2 + s * 4), cy - 6 - s * 10, night > 0.5 ? '#4a4a5a' : '#bcbcbc');
          g.globalAlpha = a;
        }
      }
    }
  }
  return o.ridge || { x0, x1: x0 + w, y: top, top };
}

// Where the windows go on a front `w` wide.
function windowsFor(x0, yb, w, h, n) {
  const out = [];
  const ww = 2;
  const wh = h >= 12 ? 3 : 2;
  const y = yb - h + Math.max(2, Math.round(h * 0.25));
  const door = [x0 + Math.floor(w / 2) - 2, x0 + Math.floor(w / 2) + 2];
  const slots = [];
  for (let x = x0 + 2; x + ww <= x0 + w - 2; x += 4) if (x + ww < door[0] || x > door[1]) slots.push(x);
  const pick = slots.length <= n ? slots : slots.filter((_, i) => i % Math.ceil(slots.length / n) === 0);
  for (const x of pick) out.push({ x, y, w: ww, h: wh });
  return out;
}

// A round hut, thatched to a point.
function drawHut(g, px, x0, yb, w, h, o) {
  const wall = o.wall || '#7a5a3a';
  const roof = o.roof || '#7a6a32';
  const cx = x0 + w / 2;
  const up = o.up ?? 1;
  fillPoly(px, [[x0, yb], [x0 + w, yb], [x0 + w - 1, yb - h], [x0 + 1, yb - h]], (x, y) => {
    const r = (x - cx) / (w / 2);
    return r > 0.45 ? shade(wall, -28) : r < -0.6 ? shade(wall, 12) : (x + y) % 4 === 0 ? shade(wall, -12) : wall;
  }, o.minY);
  if (up < 0.8) return null;
  const dx0 = Math.round(cx - 1);
  for (let y = yb - 5; y < yb; y++) for (let x = dx0; x < dx0 + 2; x++) px(x, y, o.mine ? '#ffcc6a' : '#2a1c12');
  const k = Math.min(1, (up - 0.8) / 0.2);
  const rh = Math.round((o.rh || Math.round(w * 0.6)) * k);
  const top = yb - h;
  fillPoly(px, [[x0 - 2, top + 1], [x0 + w + 2, top + 1], [cx, top - rh]], (x, y) => {
    const r = (x - cx) / (w / 2 + 2);
    return (top - y) % 2 === 0 ? shade(roof, -14) : r > 0.3 ? shade(roof, -20) : r < -0.4 ? shade(roof, 14) : roof;
  });
  line(px, x0 - 2, top + 1, x0 + w + 2, top + 1, shade(roof, -36));
  return { x0, x1: x0 + w, y: top - rh, top };
}

// ------------------------------------------------------------ trees
// A tree at (x, yb), `k` its size, of a kind (`P.tree`: round, pine,
// palm, flat, cactus), lit from the left, its shadow to the right.
export function drawTree(g, px, x, yb, k, P) {
  x = Math.round(x);
  yb = Math.round(yb);
  const leaf = P.leaf;
  const dark = P.leafDark;
  const light = shade(leaf, 26);
  // Its shadow.
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.3;
  for (let i = 0; i < Math.round(6 * k); i++) px(x + i, yb, '#000000');
  for (let i = 1; i < Math.round(4 * k); i++) px(x + i, yb + 1, '#000000');
  g.globalAlpha = a;
  if (P.tree === 'cactus') {
    const hh = Math.round(9 * k);
    for (let i = 0; i < hh; i++) {
      px(x, yb - i, leaf);
      px(x + 1, yb - i, dark);
    }
    for (let i = 0; i < 3; i++) {
      px(x - 2, yb - 4 - i, leaf);
      px(x + 3, yb - 5 - i, dark);
    }
    px(x - 1, yb - 4, leaf);
    px(x + 2, yb - 5, dark);
    return;
  }
  const trunkH = Math.max(2, Math.round(3 * k));
  for (let i = 0; i < trunkH; i++) {
    px(x, yb - 1 - i, P.trunk);
    if (k > 0.9) px(x + 1, yb - 1 - i, shade(P.trunk, -20));
  }
  if (P.tree === 'pine') {
    const hh = Math.round(10 * k);
    for (let i = 0; i < hh; i++) {
      const w = Math.round(((hh - i) / hh) * 4 * k + (i % 3 === 0 ? 1 : 0));
      for (let d2 = -w; d2 <= w; d2++) px(x + d2, yb - trunkH - i, d2 > w * 0.3 ? dark : d2 < -w * 0.5 ? light : leaf);
      if (P.snow && i % 3 === 0) {
        px(x - w, yb - trunkH - i, '#eef2f6');
        px(x - w + 1, yb - trunkH - i - 1, '#dfe6ee');
      }
    }
    px(x, yb - trunkH - hh, dark);
    return;
  }
  if (P.tree === 'palm') {
    const hh = Math.round(11 * k);
    for (let i = 0; i < hh; i++) px(x + Math.round(i * i * 0.012), yb - i, i % 2 ? P.trunk : shade(P.trunk, -14));
    const tx = x + Math.round(hh * hh * 0.012);
    const ty = yb - hh;
    for (const [dx, dy] of [[-1, 0], [1, 0]]) for (let i = 1; i <= 5; i++) px(tx + dx * i, ty + Math.round(i * i * 0.12) + dy, i > 3 ? dark : leaf);
    for (let i = 1; i <= 3; i++) {
      px(tx - i, ty - 1 + Math.round(i * 0.5), light);
      px(tx + i, ty - 1 + Math.round(i * 0.5), leaf);
    }
    return;
  }
  if (P.tree === 'flat') {
    const hh = Math.round(9 * k);
    for (let i = trunkH; i < hh - 2; i++) px(x, yb - 1 - i, P.trunk);
    for (let d2 = -6; d2 <= 6; d2++) {
      px(x + d2, yb - hh + 1, d2 > 2 ? dark : leaf);
      if (Math.abs(d2) < 5) px(x + d2, yb - hh, d2 < -1 ? light : leaf);
    }
    return;
  }
  // Round: a crown of leaves, lit on the left, darker beneath and right,
  // its edge a shade darker still.
  const r = Math.max(2, Math.round(4 * k));
  const cy = yb - trunkH - r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r + 1; dx++) {
      const e = (dx - 0.5) * (dx - 0.5) + dy * dy;
      if (e > r * r + 1) continue;
      const lit = -(dx - 0.5) * 0.7 - dy * 0.7;
      const edge = e > (r - 1) * (r - 1) + 1;
      let c = lit > r * 0.45 ? light : lit < -r * 0.35 ? dark : leaf;
      if (edge && lit < 0) c = shade(dark, -14);
      if ((x + dx + (cy + dy) * 3) % 5 === 0 && !edge) c = lit > 0 ? leaf : dark;
      px(x + dx, cy + dy, c);
    }
  }
}

// ------------------------------------------------------------ clouds
// A cloud heaped up at (x, y), `w` wide: puffs side by side, lit along the
// top (`lit`), shaded under (`dark`), its belly flat.
export function drawCloud(px, x, y, w, lit, body, dark) {
  const puffs = Math.max(2, Math.round(w / 10));
  const r0 = Math.max(2, Math.round(w / (puffs * 1.3)));
  const centers = [];
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0.5 : i / (puffs - 1);
    // (Heaped highest a little left of the middle; a smaller puff or two
    // on top.)
    const r = Math.round(r0 * (0.6 + 0.55 * Math.sin(Math.min(1, t * 1.15) * Math.PI)));
    centers.push([x + t * (w - r0 * 2) + r0, y - r * 0.55, r]);
  }
  const mid = centers[Math.floor(puffs / 2) - (puffs > 3 ? 1 : 0)];
  if (mid && puffs > 2) centers.push([mid[0] + mid[2] * 0.4, mid[1] - mid[2] * 0.6, Math.max(2, Math.round(mid[2] * 0.7))]);
  const base = y + 1;
  const x0 = Math.floor(x);
  const x1 = Math.ceil(x + w);
  for (let yy = Math.floor(y - r0 * 3); yy <= base; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      let inside = false;
      let top = false;
      for (const [cx, cy, r] of centers) {
        const d = (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy);
        if (d <= r * r) {
          inside = true;
          if (yy - cy < -r * 0.35) top = true;
        }
      }
      if (!inside) continue;
      px(xx, yy, yy >= base - 1 ? dark : top ? lit : body);
    }
  }
}
