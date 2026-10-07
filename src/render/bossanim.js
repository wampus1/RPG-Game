// (Round 71) How a master of an old place moves as it fights, drawn: its
// texture (see bosstex.js) posed about its feet, every frame, as what it's
// doing calls for, and what its moves throw off drawn about it.
//   Standing: it breathes (its painting does), sways, shifts its weight;
// left alone a while, it stretches, rolls its shoulders, flares.
//   Its moves (told by the master itself as it makes them: see
// entities/cue.js): a blow winds back and trembles, then snaps forward with
// a crescent of light where the blade went; a heavy one comes down from
// over its head; a slam rears up and crashes down, cracks running out over
// the floor; a breath rears back and throws its head forward, its mouth
// alight; a beam gathers light in its chest and kicks it back as it goes;
// a working rises up over a circle of signs turning on the floor; a
// summoning crouches and rises over two rings of them, the dark coming up
// out of the floor; a throw winds and flings; a charge leans in and leaves
// itself behind; a blink folds to a line and opens out again; coming up
// out of the ground, it bursts up.
//   Struck, it flinches. Worn down into a new phase, it crouches, rears up
// roaring and trembling, its light strobing, rings and cracks running out
// from it, the floor's grit lifting about it, and comes down.
//   And at its end: it staggers, reels, falls back, light breaking out of
// it, and comes apart, texel by texel, into motes that rise and are gone.
import { bossTint } from './bossart.js';
import { TEXEL, drawTex, drawRim as texRim, drawScratchRim, drawScratch } from './bosstex.js';
// (A forged master has no mask of its own: its rim's drawn from the scratch
// canvas it's still on. See forge.js.)
const drawRim = (ctx, tex, x, y, color, alpha, pose) => {
  if (!tex.forged) return texRim(ctx, tex, x, y, color, alpha, pose);
  // (Its shape in the light, then itself over it again: only the rim shows.)
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over';
  drawScratchRim(ctx, x, y, pose, tex.big, color, alpha);
  drawScratch(ctx, x, y, pose, tex.big);
  ctx.globalCompositeOperation = op;
};

const TAU = Math.PI * 2;
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = (k) => k * k * (3 - 2 * k);
const out = (k) => 1 - (1 - k) * (1 - k);
const back = (k) => {
  const c = 1.7;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
};
// Rising to 1 over `a`..`b` of k, and falling back over `c`..`d`.
const span = (k, a, b, c, d) => (k < a ? 0 : k < b ? ease((k - a) / (b - a)) : k < c ? 1 : k < d ? 1 - ease((k - c) / (d - c)) : 0);

// How long each takes (seconds).
export const ANIM_DUR = {
  strike: 0.34, smash: 0.52, slam: 0.78, breath: 0.95, beam: 0.9, cast: 0.95, summon: 1.15, throw: 0.5,
  charge: 0.45, blink: 0.45, roar: 1.9, emerge: 0.6, flinch: 0.2, flex: 1.3,
};

function start(A, k) {
  if (!ANIM_DUR[k]) return;
  A.k = k;
  A.t = 0;
  A.dur = ANIM_DUR[k];
  A.fired = null;
}

// Its moving state on this screen (kept on it, never sent).
export function animOf(r, e) {
  let A = e._anim;
  if (!A) A = e._anim = { n: e.animN, k: null, t: 0, dur: 1, flexT: 4 + Math.random() * 5, lastT: r.time, ghosts: [], burrowed: !!e.burrowed };
  const dt = Math.max(0, Math.min(0.1, r.time - A.lastT));
  A.lastT = r.time;
  A.dt = dt;
  if (e.animN !== undefined && e.animN !== A.n) {
    A.n = e.animN;
    start(A, e.animK);
    A.to = e.animTo || null;
  }
  // (Struck: a flinch, if it isn't in the middle of something.)
  if (e.flash > 0) {
    if (!A.struck && (!A.k || A.k === 'flex')) start(A, 'flinch');
    A.struck = true;
  } else A.struck = false;
  // (Up out of the ground.)
  if (A.burrowed && !e.burrowed) start(A, 'emerge');
  A.burrowed = !!e.burrowed;
  // (Left alone a while: a stretch.)
  if (!A.k && !e.moving && !e.windup && !(e.target && !e.target.dead)) {
    A.flexT -= dt;
    if (A.flexT <= 0) {
      A.flexT = 5 + Math.random() * 6;
      start(A, 'flex');
    }
  }
  if (A.k) {
    A.t += dt;
    if (A.t >= A.dur) A.k = null;
  }
  return A;
}
const lasering = (r, e) => {
  const L = e.game && e.game.lasers;
  return !!(L && L.some((q) => q && q.by === e));
};

// ------------------------------------------------------------ the pose
// { dx, dy, sx, sy, rot, shear } about its feet, in screen pixels. `K`: how
// much bigger than painted it's drawn (its moves as big as it is).
// (`soft`: a master whose parts move of themselves, forge.js: its whole
// body bent and squashed only half as much.)
export function poseOf(r, e, K = 1, soft = false) {
  const A = animOf(r, e);
  const P = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, shear: 0, alpha: 1, m: Math.max(0.8, K) };
  const m = P.m;
  const f = e.faceR ? 1 : -1;
  const tt = r.time + (e.id || 0) * 0.37;
  const jit = (n) => (Math.random() - 0.5) * 2 * n;
  // Standing: a sway, its weight shifting.
  P.sy *= 1 + Math.sin(tt * 2.1) * 0.012;
  P.sx *= 1 - Math.sin(tt * 2.1) * 0.008;
  P.shear += Math.sin(tt * 0.9) * 0.012;
  // Going: a heavy bob, leaning into it.
  if (e.moving && !e.windup) {
    P.dy -= Math.abs(Math.sin(tt * 8.5)) * 1.5 * m;
    P.shear += -f * 0.05;
  }
  // Winding up a blow: back on its heels, gathering, trembling at the last.
  const w = e.windup;
  if (w && !w.dash) {
    const k = clamp01(w.t / Math.max(0.05, w.dur));
    const q = ease(k);
    P.shear += f * 0.15 * q;
    P.sy *= 1 - 0.07 * q;
    P.sx *= 1 + 0.05 * q;
    P.dx += -f * 2 * q * m;
    if (k > 0.72) P.dx += jit(0.8 * m);
  }
  // Charging: leaning right into it.
  if (w && w.dash) {
    P.shear += -f * 0.24;
    P.sy *= 0.94;
    P.sx *= 1.07;
  }
  // Drawing breath for a gout: reared back, swelling.
  if (e.inhale) {
    P.shear += f * 0.1;
    P.sy *= 1.04 + Math.sin(tt * 18) * 0.01;
  }
  // Pouring out a beam: braced against it, shaking.
  if (lasering(r, e)) {
    P.shear += f * 0.06;
    P.dx += jit(0.7 * m);
  }
  const k = A.k ? clamp01(A.t / A.dur) : 0;
  switch (A.k) {
    case 'strike': {
      const u = k < 0.25 ? out(k / 0.25) : 1 - ease((k - 0.25) / 0.75);
      P.dx += f * 6 * m * u;
      P.shear += -f * 0.22 * u;
      P.sx *= 1 + 0.1 * u;
      P.sy *= 1 - 0.06 * u;
      break;
    }
    case 'smash': {
      const up = span(k, 0, 0.3, 0.3, 0.42);
      const dn = span(k, 0.32, 0.42, 0.55, 1);
      P.dy -= 5 * m * up;
      P.sy *= 1 + 0.12 * up - 0.16 * dn;
      P.sx *= 1 - 0.05 * up + 0.16 * dn;
      P.shear += f * 0.12 * up - f * 0.2 * dn;
      P.dx += f * 5 * m * dn;
      break;
    }
    case 'slam': {
      const up = k < 0.4 ? ease(k / 0.4) : k < 0.48 ? 1 - ease((k - 0.4) / 0.08) : 0;
      const sq = k < 0.46 ? 0 : k < 0.56 ? ease((k - 0.46) / 0.1) : Math.max(0, 1 - (k - 0.56) / 0.44) * (1 + Math.sin((k - 0.56) * 30) * 0.25);
      P.dy -= 11 * m * up;
      P.sy *= 1 + 0.13 * up - 0.2 * sq;
      P.sx *= 1 - 0.06 * up + 0.2 * sq;
      if (k > 0.46 && k < 0.6) P.dx += jit(1.5 * m);
      break;
    }
    case 'breath': {
      const rear = span(k, 0, 0.3, 0.3, 0.42);
      const thrust = span(k, 0.32, 0.45, 0.82, 1);
      P.shear += f * 0.16 * rear - f * 0.2 * thrust;
      P.sy *= 1 + 0.06 * rear;
      P.dy -= 2 * m * rear;
      P.dx += f * 3 * m * thrust + (thrust > 0.5 ? jit(0.6 * m) : 0);
      P.sx *= 1 + 0.05 * thrust;
      break;
    }
    case 'beam': {
      const gather = span(k, 0, 0.55, 0.55, 0.6);
      const kick = span(k, 0.55, 0.62, 0.7, 1);
      P.sy *= 1 + 0.05 * gather;
      P.dx += jit(gather * 0.9 * m) - f * 4 * m * kick;
      P.shear += f * 0.12 * kick;
      break;
    }
    case 'cast': {
      const low = span(k, 0, 0.3, 0.3, 0.42);
      const rise = span(k, 0.35, 0.6, 0.8, 1);
      P.sy *= 1 - 0.07 * low + 0.1 * rise;
      P.sx *= 1 + 0.04 * low - 0.05 * rise;
      P.dy -= 5 * m * rise;
      break;
    }
    case 'summon': {
      const low = span(k, 0, 0.35, 0.35, 0.5);
      const rise = span(k, 0.4, 0.62, 0.85, 1);
      P.sy *= 1 - 0.1 * low + 0.12 * rise;
      P.sx *= 1 + 0.06 * low - 0.06 * rise;
      P.dy -= 6 * m * rise;
      if (k > 0.55 && k < 0.65) P.dx += jit(1.2 * m);
      break;
    }
    case 'throw': {
      const wind = span(k, 0, 0.4, 0.4, 0.5);
      const fling = span(k, 0.42, 0.55, 0.6, 1);
      P.shear += f * 0.16 * wind - f * 0.22 * fling;
      P.dx += -f * 2 * m * wind + f * 4 * m * fling;
      break;
    }
    case 'charge': {
      const u = 1 - ease(k);
      P.shear += -f * 0.12 * u;
      P.sx *= 1 + 0.08 * u;
      P.sy *= 1 - 0.06 * u;
      break;
    }
    case 'blink': {
      const o = k < 0.35 ? out(k / 0.35) : 1;
      P.sx *= 0.12 + 0.88 * o;
      P.sy *= 1.4 - 0.4 * o;
      break;
    }
    case 'roar': {
      const ph = e.animPh || 2;
      const crouch = span(k, 0, 0.18, 0.18, 0.28);
      const rear = span(k, 0.22, 0.38, 1.3 / 1.9, 1.45 / 1.9);
      const down = span(k, 1.32 / 1.9, 1.45 / 1.9, 1.55 / 1.9, 1);
      P.sy *= 1 - 0.12 * crouch + 0.17 * rear - 0.15 * down;
      P.sx *= 1 + 0.08 * crouch - 0.07 * rear + 0.13 * down;
      P.dy -= 6 * m * rear;
      P.shear += f * 0.08 * rear;
      if (rear > 0.3) {
        P.dx += jit((1.5 + ph * 0.3) * m * rear);
        P.dy += jit(0.8 * m * rear);
      }
      break;
    }
    case 'emerge': {
      const o = back(clamp01(k / 0.7));
      P.dy += 16 * m * (1 - o);
      P.sy *= 1 + 0.2 * (1 - clamp01(k / 0.5));
      P.sx *= 1 - 0.1 * (1 - clamp01(k / 0.5));
      break;
    }
    case 'flinch': {
      const u = 1 - out(k);
      P.dx += -f * 2.5 * m * u;
      P.sx *= 1 - 0.06 * u;
      P.rot += f * 0.04 * u;
      break;
    }
    case 'flex': {
      const u = Math.sin(Math.PI * k);
      P.sy *= 1 + 0.06 * u;
      P.sx *= 1 - 0.03 * u;
      P.shear += Math.sin(k * TAU) * 0.05;
      break;
    }
    default:
      break;
  }
  // Its end: staggering, reeling, falling back, coming apart.
  if (e.dying !== undefined) {
    const d = e.dying;
    const st = clamp01(d / 0.35);
    P.dx += jit(3 * m * st * (1 - clamp01((d - 0.6) / 0.3)));
    P.rot += Math.sin(r.time * 21) * 0.05 * st * (1 - clamp01((d - 0.35) / 0.2));
    const fall = ease(clamp01((d - 0.35) / 0.35));
    P.rot += -f * 0.32 * fall;
    P.sy *= 1 - 0.18 * fall;
    P.dy += 3 * m * fall;
    P.alpha = 1 - clamp01((d - 0.55) / 0.3);
  }
  if (soft) {
    P.sx = 1 + (P.sx - 1) * 0.5;
    P.sy = 1 + (P.sy - 1) * 0.5;
    P.shear *= 0.5;
  }
  return P;
}

// ------------------------------------------------------------ drawing
// A dot the size of a texel.
function dot(ctx, x, y, col, a = 1) {
  const g = ctx.globalAlpha;
  ctx.globalAlpha = g * a;
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x / TEXEL) * TEXEL, Math.round(y / TEXEL) * TEXEL, TEXEL, TEXEL);
  ctx.globalAlpha = g;
}
// A ring of signs on the floor round it (an ellipse, seen from above at a
// slant), turning.
function glyphRing(ctx, cx, cy, R, rot, col, a, n = 14, inner = 0.78) {
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * TAU;
    dot(ctx, cx + Math.cos(t) * R, cy + Math.sin(t) * R * 0.36, col, a * 0.75);
    if (i % 2 === 0) dot(ctx, cx + Math.cos(t) * R * inner, cy + Math.sin(t) * R * inner * 0.36, col, a * 0.45);
  }
  for (let i = 0; i < n; i++) {
    const t = rot + (i / n) * TAU;
    const x = cx + Math.cos(t) * R * 0.89;
    const y = cy + Math.sin(t) * R * 0.89 * 0.36;
    dot(ctx, x, y, '#ffffff', a);
    dot(ctx, x + TEXEL, y, col, a * 0.8);
    if (i % 3 === 0) dot(ctx, x, y - TEXEL, col, a * 0.8);
  }
}
// Its size on the screen (texture's extent) and the front of it.
function boxOf(tex) {
  return { w: tex.w * TEXEL, h: tex.h * TEXEL, top: tex.ty0 * TEXEL, l: tex.tx0 * TEXEL };
}

// What goes on the floor and behind it (before it's drawn): the signs of a
// working, the shapes it leaves behind as it charges.
export function drawPoseBehind(r, ctx, e, tex, x, y, pose) {
  const A = e._anim;
  if (!A) return;
  const tint = bossTint(e);
  const b = boxOf(tex);
  const m = pose ? pose.m : 1;
  const k = A.k ? clamp01(A.t / A.dur) : 0;
  const ga = ctx.globalAlpha;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (A.k === 'cast' || A.k === 'summon') {
    const big = A.k === 'summon';
    const a = span(k, 0, 0.2, 0.75, 1);
    const R = Math.max(b.w * 0.5, 20 * m) * (big ? 1.25 : 1) * (0.7 + 0.3 * ease(clamp01(k / 0.3)));
    glyphRing(ctx, x, y - 1, R, r.time * (big ? -1.6 : 1.2), tint[0], a, big ? 18 : 12);
    if (big) glyphRing(ctx, x, y - 1, R * 0.62, r.time * 2.1, tint[1] || '#ffffff', a * 0.8, 9, 0.7);
    // (The dark coming up out of the floor for a summoning; sparks for a
    // working.)
    for (let i = 0; i < (big ? 10 : 6); i++) {
      const s = (i * 0.618 + r.time * (big ? 0.5 : 0.8)) % 1;
      const t = i * 2.39996;
      const px = x + Math.cos(t) * R * 0.8 * ((i % 3) / 3 + 0.3);
      const py = y - 1 + Math.sin(t) * R * 0.25 - s * 30 * m;
      dot(ctx, px, py, big ? '#2a1838' : tint[1] || '#ffffff', a * (1 - s));
      if (!big) dot(ctx, px, py + TEXEL, tint[0], a * (1 - s) * 0.6);
    }
  }
  if (A.k === 'roar') {
    // Rings of it going out over the floor, again and again.
    const a = span(k, 0.2, 0.3, 0.75, 1);
    for (let j = 0; j < 3; j++) {
      const s = (r.time * 1.6 + j / 3) % 1;
      const R = 12 * m + s * 70 * m;
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * TAU;
        dot(ctx, x + Math.cos(t) * R, y + Math.sin(t) * R * 0.36, j % 2 ? '#ffffff' : tint[0], a * (1 - s) * 0.8);
      }
    }
  }
  ctx.restore();
  // The shapes it leaves behind as it charges (or blinks out).
  const charging = e.windup && e.windup.dash;
  if (charging || A.k === 'charge') {
    A.ghosts.unshift({ x, y, t: r.time });
    if (A.ghosts.length > 5) A.ghosts.length = 5;
  } else if (A.ghosts.length && r.time - A.ghosts[0].t > 0.12) A.ghosts.length = 0;
  A.ghosts.forEach((g, i) => {
    if (i === 0) return;
    ctx.globalAlpha = ga * (0.32 - i * 0.06);
    if (tex.forged) drawScratch(ctx, g.x, g.y, pose, tex.big);
    else drawTex(ctx, tex, g.x, g.y, pose);
    drawRim(ctx, tex, g.x, g.y, tint[0], 0.6, pose);
  });
  ctx.globalAlpha = ga;
}

// What's drawn over it: a blow's crescent, the light gathering for it, the
// glow in its mouth, the light in its chest for a beam, the cracks a slam
// leaves, its light strobing as it roars, the motes it comes apart into.
export function drawPoseFx(r, ctx, e, tex, x, y, pose) {
  const A = e._anim;
  if (!A) return;
  const tint = bossTint(e);
  const b = boxOf(tex);
  const m = pose ? pose.m : 1;
  const f = e.faceR ? 1 : -1;
  const k = A.k ? clamp01(A.t / A.dur) : 0;
  const frontX = x + f * b.w * 0.32 + (pose ? pose.dx : 0);
  const chestY = y + b.top * 0.5 * (pose ? pose.sy : 1) + (pose ? pose.dy : 0);
  const headY = y + b.top * 0.78 * (pose ? pose.sy : 1) + (pose ? pose.dy : 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Gathering for a blow: light drawn in to the front of it, a glint at the
  // last.
  const w = e.windup;
  if (w && !w.dash) {
    const kw = clamp01(w.t / Math.max(0.05, w.dur));
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + r.time * 3;
      const d = (1 - ((kw * 2 + i / 6) % 1)) * 18 * m;
      dot(ctx, frontX + Math.cos(a) * d, chestY + Math.sin(a) * d * 0.7, tint[0], kw * 0.9);
    }
    if (kw > 0.7) {
      const s = Math.round(2 + kw * 3);
      for (let j = -s; j <= s; j++) {
        dot(ctx, frontX + j * TEXEL, chestY, '#ffffff', (1 - Math.abs(j) / (s + 1)) * kw);
        dot(ctx, frontX, chestY + j * TEXEL, '#ffffff', (1 - Math.abs(j) / (s + 1)) * kw);
      }
    }
  }
  // A blow: the crescent where it went.
  if ((A.k === 'strike' || A.k === 'smash' || A.k === 'throw') && k < 0.65) {
    const heavy = A.k === 'smash';
    const a0 = heavy ? -2.2 : -1.4;
    const a1 = heavy ? 0.9 : 0.7;
    const prog = clamp01(k / (heavy ? 0.45 : 0.3));
    const fade = 1 - clamp01((k - 0.25) / 0.4);
    const R = (heavy ? 24 : 21) * m;
    const cx = x + f * b.w * 0.18;
    const cy = chestY;
    for (let i = 0; i <= 28; i++) {
      const s = i / 28;
      if (s > prog) break;
      const t = a0 + (a1 - a0) * s;
      const ca = f > 0 ? t : Math.PI - t;
      const thick = Math.sin(Math.PI * s) * (heavy ? 3 : 2);
      for (let j = 0; j <= thick; j++) {
        const rr = R - j * TEXEL;
        dot(ctx, cx + Math.cos(ca) * rr, cy + Math.sin(ca) * rr, j === 0 ? '#ffffff' : tint[0], fade * (j === 0 ? 0.95 : 0.7));
      }
    }
  }
  // A breath: its mouth alight, and what pours from it.
  if (A.k === 'breath' || e.inhale) {
    const a = e.inhale ? 0.8 : span(k, 0.15, 0.35, 0.8, 1);
    const R = (3 + Math.sin(r.time * 30) * 0.8) * m;
    for (let dy = -R; dy <= R; dy += TEXEL) for (let dx = -R; dx <= R; dx += TEXEL) {
      const d = Math.hypot(dx, dy) / R;
      if (d <= 1) dot(ctx, frontX + f * 4 * m + dx, headY + dy, d < 0.45 ? '#ffffff' : tint[0], a * (1 - d * 0.6));
    }
    if (A.k === 'breath' && k > 0.35 && k < 0.85) {
      for (let i = 0; i < 10; i++) {
        const s = (r.time * 2.5 + i * 0.1) % 1;
        dot(ctx, frontX + f * (6 + s * 40) * m, headY + Math.sin(i * 7 + r.time * 9) * s * 10 * m, i % 3 ? tint[0] : '#ffffff', (1 - s) * 0.8);
      }
    }
  }
  // A beam: the light gathered in its chest, and the flash as it goes.
  if (A.k === 'beam' && k < 0.75) {
    const g = ease(clamp01(k / 0.55));
    const R = (2 + g * 5) * m;
    for (let dy = -R; dy <= R; dy += TEXEL) for (let dx = -R; dx <= R; dx += TEXEL) {
      const d = Math.hypot(dx, dy) / R;
      if (d <= 1) dot(ctx, frontX + dx, chestY + dy, d < 0.5 ? '#ffffff' : tint[0], (k < 0.55 ? 0.9 : 1 - (k - 0.55) / 0.2) * (1 - d * 0.5));
    }
    if (k < 0.55) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + r.time;
        const d = (1 - ((k * 3 + i / 8) % 1)) * 26 * m;
        dot(ctx, frontX + Math.cos(a) * d, chestY + Math.sin(a) * d, tint[0], 0.8);
      }
    }
  }
  // A slam: cracks out over the floor from where it came down, glowing,
  // dimming.
  if ((A.k === 'slam' || (A.k === 'roar' && k > 1.4 / 1.9)) && k > 0.45) {
    const a = 1 - clamp01((k - (A.k === 'slam' ? 0.5 : 0.78)) / 0.35);
    if (!A.fired) {
      A.fired = true;
      const wp = e.renderPos ? e.renderPos() : e;
      r.emit?.(wp.x, wp.y + 0.2, wp.z, { n: 18, color: ['#8a8478', '#c8b8a0', tint[0]], up: 30, speed: 70, life: 0.6, shape: 'puff' });
    }
    const n = 7;
    for (let i = 0; i < n; i++) {
      let px = x;
      let py = y;
      let ang = (i / n) * TAU + (e.id || 0);
      for (let s = 0; s < 9; s++) {
        ang += Math.sin(i * 13.1 + s * 7.7) * 0.5;
        px += Math.cos(ang) * 4 * m;
        py += Math.sin(ang) * 4 * m * 0.36;
        dot(ctx, px, py, s < 3 ? '#ffffff' : tint[0], a * (1 - s / 10));
      }
    }
  }
  // Roaring: its light strobing, the grit of the floor lifting about it.
  if (A.k === 'roar') {
    const a = span(k, 0.22, 0.32, 0.7, 0.85);
    if (a > 0) drawRim(ctx, tex, x, y, Math.floor(r.time * 14) % 2 ? '#ffffff' : tint[0], a, pose);
    for (let i = 0; i < 14; i++) {
      const s = (r.time * 0.9 + i * 0.137) % 1;
      const t = i * 2.39996;
      dot(ctx, x + Math.cos(t) * (14 + (i % 4) * 9) * m, y - s * 46 * m + Math.sin(t) * 6 * m, i % 4 ? '#8a7a68' : tint[0], a * (1 - s));
    }
  }
  // Blinking: a line of light where it folds.
  if (A.k === 'blink' && k < 0.5) {
    const a = 1 - k / 0.5;
    for (let j = 0; j < 20; j++) dot(ctx, x, y - j * 3 * m, '#ffffff', a * (1 - j / 22));
    for (let j = -6; j <= 6; j++) dot(ctx, x + j * 3 * m, y + b.top * 0.5, tint[0], a * (1 - Math.abs(j) / 7));
  }
  // A stretch: a flare of its light.
  if (A.k === 'flex') {
    const a = Math.sin(Math.PI * k) * 0.5;
    if (a > 0.05) drawRim(ctx, tex, x, y, tint[0], a, pose);
  }
  ctx.restore();
  // Its end: light breaking out of it, then the motes it comes apart into.
  if (e.dying !== undefined) dying(r, ctx, e, tex, x, y, pose, tint);
}

function dying(r, ctx, e, tex, x, y, pose, tint) {
  const A = e._anim || (e._anim = { ghosts: [] });
  const d = e.dying;
  const m = pose ? pose.m : 1;
  const b = boxOf(tex);
  const cy = y + b.top * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Shafts of light out of it.
  if (d > 0.25 && d < 0.8) {
    const a = span(d, 0.25, 0.45, 0.6, 0.8);
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + (e.id || 0) * 0.7 + Math.sin(r.time * 3 + i) * 0.1;
      const L = (20 + (i % 3) * 14) * m * (0.5 + a);
      for (let s = 0; s < L; s += TEXEL) dot(ctx, x + Math.cos(ang) * s, cy + Math.sin(ang) * s, s < L * 0.4 ? '#ffffff' : tint[0], a * (1 - s / L));
    }
  }
  ctx.restore();
  // Coming apart: every texel of it a mote, rising and spreading, gone.
  if (d >= 0.55 && !A.dust && tex.img) {
    const W = tex.w;
    const H = tex.h;
    const data = tex.img.getContext('2d').getImageData(0, 0, W, H).data;
    const step = W * H > 2500 ? 2 : 1;
    A.dust = [];
    for (let ty = 0; ty < H; ty += step) {
      for (let tx = 0; tx < W; tx += step) {
        const i = (ty * W + tx) * 4;
        if (data[i + 3] < 120) continue;
        const ox = (tex.tx0 + tx) * TEXEL * (pose ? pose.sx : 1);
        const oy = (tex.ty0 + ty) * TEXEL * (pose ? pose.sy : 1);
        const dir = Math.atan2(oy + b.h * 0.4, ox);
        const sp = 10 + Math.random() * 40;
        A.dust.push({
          x: ox, y: oy, vx: Math.cos(dir) * sp * 0.6 + (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 50,
          c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`, life: 0.8 + Math.random() * 1.2, t: -Math.max(0, (oy - tex.ty0 * TEXEL) / (b.h || 1)) * 0.4,
        });
      }
    }
  }
  if (A.dust) {
    const dt = A.dt || 0.016;
    for (const q of A.dust) {
      q.t += dt;
      if (q.t < 0) {
        dot(ctx, x + q.x, y + q.y, q.c, 1);
        continue;
      }
      q.vy -= 18 * dt;
      q.vx *= 0.985;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const a = 1 - q.t / q.life;
      if (a <= 0) continue;
      dot(ctx, x + q.x, y + q.y, q.t < 0.1 ? '#ffffff' : q.c, a);
      if (a > 0.5 && Math.random() < 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        dot(ctx, x + q.x, y + q.y, tint[0], 0.6);
        ctx.restore();
      }
    }
  }
}

// (Its state's changes seen even while it's out of sight: dust where it
// went into the ground.)
export function watchBoss(r, e) {
  const was = e._was || (e._was = { burrowed: !!e.burrowed });
  if (e.burrowed && !was.burrowed) {
    const wp = e.renderPos ? e.renderPos() : e;
    r.emit?.(wp.x, wp.y + 0.3, wp.z, { n: 22, color: ['#7a5a3a', '#a8885a', '#5a4430'], up: 40, speed: 60, life: 0.7, shape: 'puff' });
  }
  if (!e.burrowed && was.burrowed) {
    const wp = e.renderPos ? e.renderPos() : e;
    r.emit?.(wp.x, wp.y + 0.4, wp.z, { n: 30, color: ['#7a5a3a', '#a8885a', '#5a4430', '#3a2a20'], up: 70, speed: 70, life: 0.9, shape: 'puff' });
  }
  was.burrowed = !!e.burrowed;
}
