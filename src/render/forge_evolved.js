// (Round 71) The evolved masters, forged (see forge.js; and evolvedfx.js
// for what of them reaches out into the world): each a hundred and
// twenty-eight pixels square.
//   The Divine Alchemist: an eye as big as a cart, its iris a vortex of
//   gold and violet turning in on itself, a pupil like a hole in the
//   world; set in a bezel of gold with twelve sockets round it, a gem of
//   each element in each (its arms come out of them); round it all the
//   rings of a great armillary turning in three dimensions; a crown of
//   alembics, glowing; a pendant spire under it, and phials swinging on
//   chains; under it on the floor, a circle of transmutation turning.
//   Its arms (in the world): each jointed and banded in gold, the colour
//   of its element and burning with it down its middle, a hand at the end
//   of it, clawed, holding a light of its element.
import { forge, tone } from './forge.js';
import { WORLD_DRAW, drawLimb, glow, bez, scr, sculpted } from './evolvedfx.js';
import { ELEMS } from '../entities/evolved_alchemist.js';
import { wormRings as wormRingsOf } from '../entities/evolved_worm.js';
import { TILE, LH } from '../config.js';
import { hex, mix, shade } from './pixel.js';
import { hash2 } from './paint.js';
import { seam, crease, rivets, fringe } from './forgekit.js';

const TAU = Math.PI * 2;
const GOLD = '#d8a838';
const GOLD_HI = '#ffe070';
const GOLD_LO = '#8a5a18';
const PEARL = '#ece4d4';

// (Round 72) A painter's finishing passes over them, after the reference
// art: a cold rim of light down the edges of a stuff where the light's
// behind it (`dirs`: which neighbours empty make an edge), and the wear
// on plate: dents, rust at the joints, moss where it's stood so long.
function rimLight(P, mat, col, k = 0.55, dirs = [[1, -1], [1, 0], [0, -1]]) {
  const X = P.X;
  if (!X || !X.owner) return;
  const W = P.w;
  const H = P.h;
  const isMat = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = X.owner[y * W + x];
    return i >= 0 && (mat === '*' || X.prims[i].mat === mat);
  };
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !P.get(x, y)[3];
  const c = hex(col);
  const adds = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isMat(x, y)) continue;
    if (dirs.some(([dx, dy]) => empty(x + dx, y + dy))) adds.push([x, y, mix(P.get(x, y), c, k)]);
  }
  for (const [x, y, c2] of adds) P.set(x, y, c2);
}
function wear(P, mat, o = {}) {
  const X = P.X;
  if (!X || !X.owner) return;
  const W = P.w;
  const H = P.h;
  const sd = o.seed || 1;
  const moss = hex('#4a7a3a');
  const rust = hex('#8a4a22');
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = X.owner[y * W + x];
    if (i < 0 || X.prims[i].mat !== mat) continue;
    const q = P.get(x, y);
    if (!q[3]) continue;
    if (hash2(x, y, sd) < (o.dents || 0)) {
      P.set(x, y, shade(q, 0.55));
      const q2 = P.get(x + 1, y + 1);
      if (q2[3]) P.set(x + 1, y + 1, mix(q2, [255, 255, 255], 0.25));
    } else if (hash2(x >> 2, y >> 2, sd + 1) < (o.moss || 0) && hash2(x, y, sd + 2) < 0.6) P.set(x, y, mix(q, moss, 0.55));
    else if (hash2(x >> 1, y >> 1, sd + 3) < (o.rust || 0)) P.set(x, y, mix(q, rust, 0.5));
  }
}

// ------------------------------------------------------------ the Alchemist
// The eye's middle on its picture, this frame.
const EYE = (J) => ({ x: 64, y: 54 - J.b * 0.8 });
// A ring of the armillary: radius `R`, tilted `tilt` from flat, turned
// `spin` about the upright; its points, each with how near to you.
function ringPts(c, R, tilt, spin, n = 72) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x0 = Math.cos(a) * R;
    const y0 = Math.sin(a) * R * Math.cos(tilt);
    const z0 = Math.sin(a) * R * Math.sin(tilt);
    const x = x0 * Math.cos(spin) - z0 * Math.sin(spin);
    const z = x0 * Math.sin(spin) + z0 * Math.cos(spin);
    out.push({ x: c.x + x, y: c.y + y0, z });
  }
  return out;
}
const RINGS = [
  { R: 46, tilt: 1.32, k: 1, off: 0 },
  { R: 40, tilt: 0.5, k: -1, off: 1.2 },
  { R: 34, tilt: -0.95, k: 1, off: 2.4 },
];
const SOCKET = (c, i) => {
  const a = (i / 12) * TAU - Math.PI / 2 + TAU / 24;
  return { x: c.x + Math.cos(a) * 30, y: c.y + Math.sin(a) * 29, a };
};

forge({
  divine_alchemist: {
    size: 128, ax: 64, ay: 126, breath: 1.6, fps: 10,
    body(X, J, t, st) {
      const c = EYE(J);
      // The armillary's rings, each in its own tilt, turning: the halves
      // behind the eye behind it, the near halves in front.
      X.in(0, 0.6);
      RINGS.forEach((g, gi) => {
        const pts = ringPts(c, g.R, g.tilt, t * TAU * g.k + g.off);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          X.tube(a.x, a.y, b.x, b.y, 1.5, 1.5, gi === 1 ? '#c8902a' : GOLD, 'gold', { z: 14 + a.z * 0.9 });
        }
        // (Its studs, every so often round it.)
        for (let i = 0; i < pts.length; i += 9) X.ball(pts[i].x, pts[i].y, 2, 2, GOLD_HI, 'gold', { z: 15 + pts[i].z * 0.9, rz: 1.6 });
      });
      // The pendant spire under it.
      X.in(1, 1.2);
      X.slab([[c.x - 9, c.y + 26], [c.x + 9, c.y + 26], [c.x + 2, c.y + 50], [c.x, c.y + 56], [c.x - 2, c.y + 50]], GOLD_LO, 'gold', { rz: 4, bevel: 2, z: 6 });
      X.ball(c.x, c.y + 40, 3.4, 3.8, '#c8a0ff', 'glass', { z: 9, rz: 3, glow: '#c8a0ff', glowK: 0.6 });
      // Its crown of alembics: three flasks, their necks bent outward.
      X.in(2, 1.2);
      for (const [dx, h, lean] of [[-15, 28, -1], [0, 36, 0], [15, 28, 1]]) {
        X.tube(c.x + dx * 0.8, c.y - 22, c.x + dx, c.y - h + 4, 3.6, 3, '#a8d0d8', 'glass', { z: 4 });
        X.ball(c.x + dx, c.y - h, 6.5, 7, '#b8e0e8', 'glass', { z: 6, rz: 6 });
        X.tube(c.x + dx, c.y - h - 6, c.x + dx + lean * 6, c.y - h - 14, 1.8, 1.2, '#a8d0d8', 'glass', { z: 6 });
        X.ball(c.x + dx * 0.8, c.y - 21, 4.5, 2.4, GOLD, 'gold', { z: 9, rz: 2 });
      }
      // The bezel: gold, ridged, twelve sockets round it.
      X.in(3, 1.4);
      X.ball(c.x, c.y, 30, 29, GOLD_LO, 'gold', { z: 0, rz: 12 });
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        X.ball(c.x + Math.cos(a) * 27.5, c.y + Math.sin(a) * 26.5, 2.6, 2.6, i % 3 ? GOLD : GOLD_HI, 'gold', { z: 9, rz: 2 });
      }
      for (let i = 0; i < 12; i++) {
        const s = SOCKET(c, i);
        X.ball(s.x, s.y, 4.6, 4.6, GOLD, 'gold', { z: 12, rz: 3.6 });
        X.ball(s.x, s.y, 2.6, 2.6, ELEMS[i] ? ELEMS[(i * 7) % 12].pal[1] : '#ffffff', 'glass', { z: 15, rz: 2 });
      }
      // The eye itself.
      X.in(4, 1);
      X.ball(c.x, c.y, 24, 23.5, st.risen ? '#f0d8d0' : PEARL, 'ceramic', { z: 14, rz: 18 });
    },
    paint(P, J, t, st) {
      const c = EYE(J);
      // The iris: a vortex, its arms of gold and violet turning in.
      const ir = 15.5;
      for (let dy = -ir; dy <= ir; dy++) {
        for (let dx = -ir; dx <= ir; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > ir) continue;
          const a = Math.atan2(dy, dx);
          const s = a * 3 + Math.log(d + 1) * 4.2 - t * TAU * 2;
          const band = Math.sin(s);
          const k = d / ir;
          let col;
          if (st.risen) col = band > 0.55 ? '#ffd0a0' : band > 0 ? '#e83020' : band > -0.5 ? '#8a1020' : '#300810';
          else col = band > 0.55 ? '#fff0b0' : band > 0.1 ? '#e0a030' : band > -0.4 ? '#7a40c0' : '#2a1050';
          if (k > 0.9) col = '#1a0a20';
          else if (k > 0.82) col = tone(col, 0.7);
          P.set(Math.round(c.x + dx), Math.round(c.y + dy), col);
        }
      }
      // Veins of gold in the white, running in to it.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.3;
        for (let k = 0; k < 6; k++) {
          const d = 22 - k * 1.1;
          const w = Math.sin(k * 1.7 + i) * 0.8;
          P.set(Math.round(c.x + Math.cos(a + w * 0.05) * d), Math.round(c.y + Math.sin(a + w * 0.05) * d), k % 2 ? '#d8b070' : '#c89850');
        }
      }
      // Etched signs round the bezel.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        if (i % 2) continue;
        P.set(Math.round(c.x + Math.cos(a) * 24.8), Math.round(c.y + Math.sin(a) * 24.2), '#5a3a10');
      }
      // (Round 72) The white of it shaded under, cool; the gold's edges
      // catching the light.
      for (let dy = 6; dy <= 23; dy++) for (let dx = -23; dx <= 23; dx++) {
        const d = Math.hypot(dx, dy * 1.02);
        if (d > 23.5 || d < 16.5 || (dx + dy) % 2) continue;
        const x = Math.round(c.x + dx);
        const y = Math.round(c.y + dy);
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, mix(q, [120, 110, 170], 0.24 * Math.min(1, (dy - 5) / 10)));
      }
      rimLight(P, 'gold', '#fff0b0', 0.35, [[-1, -1], [0, -1]]);
    },
    glow(P, J, t, st) {
      const c = EYE(J);
      // The gems in their sockets.
      for (let i = 0; i < 12; i++) {
        const s = SOCKET(c, i);
        const E = ELEMS[(i * 7) % 12];
        const on = 0.6 + 0.4 * Math.sin(t * TAU * 2 + i);
        P.fx(s.x, s.y, E.glow, on);
        P.fx(s.x - 1, s.y - 1, '#ffffff', 0.7);
      }
      // What's in the alembics, glowing, and bubbling.
      [[-15, 28, '#80ffb0'], [0, 36, '#ffb040'], [15, 28, '#c8a0ff']].forEach(([dx, h, col], k) => {
        for (let y = -2; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.hypot(x, y * 1.2) < 5) P.fx(c.x + dx + x, c.y - h + y + 1, col, 0.55);
        const by = ((t * 3 + k * 0.37) % 1) * 9;
        P.fx(c.x + dx + ((k * 3) % 5) - 2, c.y - h + 4 - by, '#ffffff', 0.9);
      });
      // The vortex's heart, and light leaking off the iris.
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + t * TAU;
        P.fx(c.x + Math.cos(a) * 13, c.y + Math.sin(a) * 13, st.risen ? '#ff8060' : '#ffe070', 0.35);
      }
      // A funnel of its vortex trailing down to the floor.
      for (let y = c.y + 58; y < 122; y += 2) {
        const k = (y - c.y - 58) / (122 - c.y - 58);
        const w = 3 + k * 10;
        const sp = t * TAU * 3 + y * 0.4;
        for (let s = 0; s < 3; s++) {
          const x = c.x + Math.sin(sp + s * 2.1) * w;
          P.fx(x, y, s ? '#c8a0ff' : '#ffe070', 0.25 + 0.25 * (1 - k));
        }
      }
    },
    parts: Object.fromEntries([[-24, 0.2], [0, 0.9], [22, 1.6]].map(([dx, ph], i) => [`phial${i}`, {
      w: 12, h: 30, px: 6, py: 1, role: 'sway', layer: 'front', z: 2, depth: 0.16, rate: 1.4, phase: ph,
      at: (J) => [64 + dx, 54 - J.b * 0.8 + 24 + Math.abs(dx) * 0.1],
      body(X) {
        X.in(0, 0.4);
        for (let y = 1; y < 18; y += 3) X.ball(6, y, 1.4, 1.6, '#8a6a30', 'gold', { rz: 1 });
        X.in(1, 0.8);
        X.ball(6, 22, 4.6, 5.2, '#a8d0d8', 'glass', { z: 2, rz: 4 });
        X.tube(6, 17, 6, 19, 1.6, 1.6, '#a8d0d8', 'glass', { z: 3 });
        X.ball(6, 16.5, 2, 1.2, GOLD, 'gold', { z: 4, rz: 1 });
      },
      glow(P) {
        const col = ['#80ffb0', '#ff8030', '#c8a0ff'][i];
        for (let y = 21; y <= 26; y++) for (let x = 3; x <= 9; x++) if (Math.hypot(x - 6, y - 22.5) < 4) P.fx(x, y, col, 0.6);
        P.fx(4, 20, '#ffffff', 0.9);
      },
    }])),
    // Under it on the floor: its circle, turning.
    under(R) {
      const { ctx, x, y, t } = R;
      const rr = 44;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rot = t * 0.4;
      for (const [k, col, a] of [[1, '#ffd060', 0.55], [0.72, '#c8a0ff', 0.45], [0.4, '#ffd060', 0.4]]) {
        ctx.fillStyle = col;
        ctx.globalAlpha = a;
        const n = Math.round(110 * k);
        for (let i = 0; i < n; i++) {
          const q = (i / n) * TAU + rot * (k === 0.72 ? -1 : 1);
          if (k === 1 && i % 11 === 0) continue;
          ctx.fillRect(Math.round(x + Math.cos(q) * rr * k), Math.round(y - 2 + Math.sin(q) * rr * k * 0.32), 1, 1);
        }
      }
      // Its signs, round the ring.
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 12; i++) {
        const q = (i / 12) * TAU + rot;
        const sx = Math.round(x + Math.cos(q) * rr * 0.86);
        const sy = Math.round(y - 2 + Math.sin(q) * rr * 0.86 * 0.32);
        ctx.fillStyle = ELEMS[i].glow;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
      // A hexagram across it.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffe070';
      for (const off of [0, Math.PI / 3]) {
        for (let s = 0; s < 3; s++) {
          const a0 = off + (s / 3) * TAU - rot;
          const a1 = off + ((s + 1) / 3) * TAU - rot;
          const x0 = x + Math.cos(a0) * rr * 0.72;
          const y0 = y - 2 + Math.sin(a0) * rr * 0.72 * 0.32;
          const x1 = x + Math.cos(a1) * rr * 0.72;
          const y1 = y - 2 + Math.sin(a1) * rr * 0.72 * 0.32;
          const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
          for (let j = 0; j <= n; j++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * j) / n), Math.round(y0 + ((y1 - y0) * j) / n), 1, 1);
        }
      }
      ctx.restore();
    },
    fx(R, ctx) {
      // Its pupil: a hole in the world, turned on you; a glint on it.
      const { e, x, y, r } = R;
      const p = e.game && e.game.player;
      let ex = 0;
      let ey = 0;
      if (p) {
        const pp = p.renderPos();
        const wp = e.renderPos();
        const [pu, pv] = r.toView(pp.x, pp.z);
        const [eu, ev] = r.toView(wp.x, wp.z);
        const d = Math.hypot(pu - eu, pv - ev) || 1;
        ex = Math.round(((pu - eu) / d) * 4);
        ey = Math.round(((pv - ev) / d) * 3);
      }
      const cy = y - 126 + 54 - Math.round(R.J.b * 0.8) + ey;
      const cx = x + ex;
      const hot = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
      const pr = 4.5 + hot * 2 + Math.sin(r.time * 3) * 0.5;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
        const d = Math.hypot(dx, dy * 1.15);
        if (d > pr + 1.2) continue;
        ctx.fillStyle = d > pr ? (e.enraged ? '#ff4020' : '#ffe070') : '#05010a';
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
      // (Stars in it.)
      for (let i = 0; i < 3; i++) {
        const a = r.time * (1 + i * 0.4) + i * 2;
        ctx.fillStyle = i ? '#c8a0ff' : '#ffffff';
        ctx.fillRect(Math.round(cx + Math.cos(a) * pr * 0.5), Math.round(cy + Math.sin(a) * pr * 0.5), 1, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 8, y - 126 + 54 - Math.round(R.J.b * 0.8) - 9, 3, 2);
      ctx.fillRect(x - 9, y - 126 + 54 - Math.round(R.J.b * 0.8) - 8, 1, 2);
      // Its light, on the air round it.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + hot * 0.3;
      ctx.fillStyle = e.enraged ? '#ff4020' : '#ffd060';
      for (let dy = -30; dy <= 30; dy += 2) for (let dx = -30; dx <= 30; dx += 2) if (Math.hypot(dx, dy) < 30 && Math.hypot(dx, dy) > 24) ctx.fillRect(cx - ex + dx, cy - ey + dy, 1, 1);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  },
});

// ------------------------------------------------------------ its arms
// A hand of an element (sculpted once): a palm, three long clawed fingers
// and a thumb, a gold cuff, the element's light held in it.
function handPic(el, open) {
  const E = ELEMS[el];
  return sculpted(`ahand${el}${open ? 'o' : 'c'}`, 22, 22, (X) => {
    X.in(0, 1);
    const spread = open ? 1 : 0.45;
    for (const [dx, len] of [[-5, 9], [0, 11], [5, 9]]) {
      const ex = 11 + dx * (1 + spread * 0.6);
      X.limb([[11 + dx * 0.4, 9, 2.2, 3], [ex, 9 + len * 0.6, 1.6, 4], [ex + dx * 0.2, 9 + len, 0.7, 5]], E.pal[1], 'chitin');
    }
    X.limb([[7, 9, 2, 3], [4 - spread * 2, 13, 1.2, 4]], E.pal[1], 'chitin');
    X.ball(11, 9, 5.4, 4.6, E.pal[0], 'chitin', { z: 2, rz: 4 });
    X.in(1, 0.6);
    X.ball(11, 4, 5, 2.6, GOLD, 'gold', { z: 5, rz: 2 });
    X.ball(11, 3, 3.6, 1.4, GOLD_HI, 'gold', { z: 6, rz: 1 });
    X.ball(11, 10, 2.2, 2.2, E.pal[2], 'glass', { z: 7, rz: 2, glow: E.glow, glowK: 0.8 });
  });
}
// Each of its arms, from its socket on the eye out to its hand.
WORLD_DRAW.divine_alchemist = (r, game, c, add, S) => {
  const A = c.arms;
  if (!A) return;
  const wp = c.renderPos();
  const base = S(wp.x, wp.y, wp.z);
  const bob = Math.round(Math.sin(r.time * 1.6) * 1.2);
  const eye = { x: base.x, y: base.y + 11 - 126 + 54 + bob };
  const fade = c.dying !== undefined ? Math.max(0, 1 - c.dying) : 1;
  if (fade <= 0) return;
  for (const a of A) {
    const cut = a.cut && !a.cut.done ? a.cut : null;
    if (!a.on || (!a.alive && !cut)) continue;
    const E = ELEMS[a.el];
    const tip = S(cut ? cut.x : a.x, wp.y + (cut ? Math.max(0, cut.h - cut.t * 3) : a.h), cut ? cut.z : a.z);
    // (Out of the socket with its own element's gem in it.)
    const sk = SOCKET(eye, (a.el * 7) % 12);
    const out = { x: sk.x + Math.cos(sk.a) * 30, y: sk.y + Math.sin(sk.a) * 26 };
    const t1 = { x: tip.x, y: tip.y - 30 + Math.sin(r.time * 2 + a.i) * 4 };
    const N = 14;
    const pts = [];
    const sway = (k) => Math.sin(r.time * 2.4 + a.i * 0.9 + k * 4) * 3 * Math.sin(k * Math.PI);
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      if (cut && k > 0.55) {
        // (Cut: the rest of it hanging, falling away.)
        const q = bez(sk, out, t1, tip, 0.55);
        const dk = (k - 0.55) / 0.45;
        pts.push({ x: q.x + dk * 6, y: q.y + dk * 26 * Math.min(1, cut.t * 2) + dk * 20, r: 4.6 - k * 2.4 });
        continue;
      }
      const q = bez(sk, out, t1, tip, k);
      pts.push({ x: q.x + sway(k), y: q.y, r: 4.6 - k * 2.4 });
    }
    // (In its row: in front of the eye if its hand's nearer you, else
    // behind it.)
    const front = tip.v > base.v;
    const row = front ? tip.row : base.row;
    const lay = Math.max(base.layer, tip.layer);
    add(row, lay, front ? 99 : -1, () => {
      const ctx = r.ctx;
      const al = ctx.globalAlpha;
      ctx.globalAlpha = al * fade * (cut ? Math.max(0, 1 - cut.t / 1.4) : 1);
      // (Round 73: dabbed every two and a half pixels, not one and a half:
      // twelve arms of it was thousands of stamps a frame.)
      drawLimb(ctx, pts, [E.pal[0], E.pal[1], E.pal[2]], {
        t: r.time, vein: E.glow, step: 2.5,
        band: (k) => ((k > 0.08 && k < 0.13) || (k > 0.38 && k < 0.42) || (k > 0.66 && k < 0.7) ? [GOLD_LO, GOLD_HI] : null),
      });
      if (!cut) {
        const hp = handPic(a.el, a.mode === 'reach' || a.mode === 'hold');
        if (hp) ctx.drawImage(hp.cv, Math.round(tip.x - 11), Math.round(tip.y - 8));
        glow(ctx, tip.x, tip.y + 2, 10, E.glow, 0.45);
        // (What it holds: the light of its element, flickering.)
        if (Math.random() < 0.3) r.emit?.(a.x, wp.y + a.h, a.z, { n: 1, color: [E.pal[2], E.glow], up: 10, speed: 6, life: 0.5, glow: true, gravity: -10 });
        // Its hurt, over it.
        const h = a.hand;
        if (h && !h.dead && h.hp < h.maxHp) {
          const w = 16;
          const bx = Math.round(tip.x - w / 2);
          const by = Math.round(tip.y - 14);
          ctx.fillStyle = '#100808';
          ctx.fillRect(bx - 1, by - 1, w + 2, 4);
          ctx.fillStyle = '#5a1810';
          ctx.fillRect(bx, by, w, 2);
          ctx.fillStyle = E.glow;
          ctx.fillRect(bx, by, Math.max(1, Math.round((w * h.hp) / h.maxHp)), 2);
        }
        // (Pointed at, it's what you'll strike.)
        const m = r.mouse;
        if (h && !h.dead && m && Math.abs(m.x - tip.x) <= 9 && m.y >= tip.y - 10 && m.y <= tip.y + 12) r.pickEnt = { e: h, seq: ++r.pickSeq };
      }
      ctx.globalAlpha = al;
    });
  }
};
export { TILE, LH, scr };

// ------------------------------------------------------------ the Rift Crawler
// A body of black chitin, long, cracked through to the void (light in its
// cracks), its abdomen a bulb with a rift down it; four long legs (planted,
// each foot where it falls: see bossart.js, the 'rift' style); a stalk of a
// neck rising out of its front; its head (cut free: it sways, it lunges, it
// roars) a wedge crowned with eyes, a slit of a mouth burning; and out of
// its head two long arms ending in blades of void-glass.
const CHI = '#2c2240';
const CHI_HI = '#5a4a7c';
const CHI_LO = '#120c1c';
const CHI_TOP = '#8a78b0';
const VGLOW = '#c8a0ff';
const VCYAN = '#5ad8f0';
// The head's hinge on its picture.
const RC_NECK = (J) => [36, 34 - J.b * 0.6];
function crackLine(P, x0, y0, n, seed, col) {
  let x = x0;
  let y = y0;
  for (let i = 0; i < n; i++) {
    P.fx(Math.round(x), Math.round(y), i % 4 === 0 ? '#ffffff' : col, 0.95);
    x += 1;
    y += Math.sin(seed * 3.1 + i * 1.7) > 0.3 ? 1 : Math.sin(seed + i) < -0.4 ? -1 : 0;
  }
}
forge({
  rift_crawler: {
    size: 128, ax: 64, ay: 126, walk: true, breath: 1, fps: 10, walkFps: 14,
    body(X, J) {
      const b = J.b * 0.6;
      // Its neck: a stalk of ringed chitin, up out of its front.
      X.in(0, 1.4);
      const neck = [[56, 66], [48, 58], [42, 48], [38, 40], [36, 34]];
      neck.forEach(([x, y], i) => X.ball(x, y - b, 6.2 - i * 0.5, 5.6 - i * 0.4, i % 2 ? CHI : CHI_HI, 'chitin', { z: 6, rz: 5 }));
      // Its abdomen: a bulb out behind, the rift down it.
      X.in(1, 2);
      X.ball(98, 66 - b, 17, 13, CHI, 'chitin', { z: 4, rz: 12 });
      X.ball(110, 70 - b, 9, 7, CHI_LO, 'chitin', { z: 3, rz: 6 });
      // Its thorax: long, plated, ridged along its back.
      X.in(2, 2.2);
      X.ball(70, 68 - b, 22, 12, CHI_HI, 'chitin', { z: 8, rz: 12 });
      for (let i = 0; i < 5; i++) X.ball(54 + i * 8, 58 - b - Math.sin(i * 0.8) * 2, 5, 4, i % 2 ? CHI : CHI_HI, 'chitin', { z: 14, rz: 4 });
      // Spines along its back.
      X.in(3, 0.6);
      for (let i = 0; i < 6; i++) X.slab([[52 + i * 9, 55 - b], [56 + i * 9, 55 - b], [55 + i * 9 + 3, 44 - b - (i % 2) * 4]], CHI_LO, 'obsidian', { rz: 2, bevel: 1, z: 12 });
      // Its hip-joints, where the legs go in.
      X.in(4, 0.6);
      for (const x of [58, 86]) X.ball(x, 74 - b, 5, 4, CHI, 'chitin', { z: 12, rz: 4 });
      // (Round 72) Its armour: plates along its back, each lapped over the
      // next, bevelled, their lips catching the light; shards of void-glass
      // grown up out of its abdomen.
      X.in(5, 0.5);
      for (let i = 0; i < 5; i++) {
        const x = 52 + i * 8;
        X.slab([[x - 4, 61 - b], [x + 5, 60 - b], [x + 6, 71 - b], [x - 3, 73 - b]], i % 2 ? CHI_HI : CHI_TOP, 'chitin', { rz: 2.5, bevel: 2, z: 20 });
      }
      X.in(6, 0.4);
      for (const [x, y, ex, ey] of [[94, 56, 90, 44], [102, 54, 104, 42], [108, 60, 116, 50]]) X.slab([[x - 2.5, y - b], [x + 2.5, y - b], [ex, ey - b]], '#3a2460', 'obsidian', { rz: 2, bevel: 1, z: 14 });
    },
    paint(P, J) {
      const b = J.b * 0.6;
      // The edges of its plates: a dark crease, a lit lip beside it; specks
      // of the void in the black of it; a cold rim of light down its back.
      for (let i = 0; i < 5; i++) {
        const x = 55 + i * 8;
        crease(P, x, 60 - b, x + 1, 72 - b, 0.42);
        seam(P, x + 1, 61 - b, x + 2, 71 - b, 1.35);
      }
      for (let i = 0; i < 14; i++) P.set(50 + ((i * 7) % 60), Math.round(58 - b + ((i * 5) % 16)), i % 3 ? '#7a68a8' : '#ffffff');
      rimLight(P, 'chitin', '#b0a0e0', 0.5);
      rimLight(P, 'obsidian', '#c8a0ff', 0.6);
    },
    glow(P, J, t) {
      const b = J.b * 0.6;
      // The void in its cracks, pulsing.
      const k = 0.6 + 0.4 * Math.sin(t * TAU * 2);
      crackLine(P, 56, 66 - b, 26, 1, k > 0.8 ? VCYAN : VGLOW);
      crackLine(P, 62, 72 - b, 18, 2, VGLOW);
      crackLine(P, 72, 62 - b, 16, 3, VGLOW);
      crackLine(P, 88, 72 - b, 14, 4, k > 0.5 ? VCYAN : VGLOW);
      // (The void's light on the air round it.)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * TAU * 0.5;
        P.fx(76 + Math.cos(a) * 34, 64 - b + Math.sin(a) * 18, VGLOW, 0.22);
      }
      // The rift down its abdomen: a seam of light, open a little.
      for (let y = -10; y <= 10; y++) {
        const w = Math.max(0, Math.round((1 - Math.abs(y) / 10) * 2.4 * (0.7 + 0.3 * Math.sin(t * TAU * 3 + y))));
        for (let x = -w; x <= w; x++) P.fx(98 + x + Math.round(y * 0.3), 66 - b + y, Math.abs(x) === w ? VGLOW : '#ffffff', 0.9);
      }
      // Its neck's joints lit.
      for (const [x, y] of [[48, 58], [38, 40]]) P.fx(x, y - b, VCYAN, 0.7);
    },
    parts: {
      // Its head: a wedge, crowned with eyes; a slit of a mouth.
      head: {
        w: 34, h: 30, px: 22, py: 18, role: 'head', layer: 'front', z: 6, amp: 1.4,
        at: (J) => RC_NECK(J),
        body(X) {
          X.in(0, 1.4);
          X.slab([[2, 18], [14, 8], [28, 6], [33, 14], [30, 22], [18, 26], [6, 24]], CHI_HI, 'chitin', { rz: 7, bevel: 3 });
          X.ball(22, 16, 9, 8, CHI, 'chitin', { z: 4, rz: 6 });
          // Its crown of horns.
          X.in(1, 0.5);
          for (const [x, y, ex, ey] of [[20, 9, 22, 1], [26, 9, 31, 2], [14, 10, 12, 3], [23, 8, 26, -1], [17, 9, 16, 0]]) X.tube(x, y, ex, ey, 2.2, 0.5, CHI_LO, 'obsidian', { z: 6 });
          // Mandibles.
          X.in(2, 0.6);
          X.limb([[6, 22, 1.8, 5], [3, 27, 1.2, 5], [6, 29, 0.6, 5]], '#2a2236', 'chitin');
          X.limb([[12, 24, 1.6, 6], [11, 28, 1, 6]], '#2a2236', 'chitin');
        },
        paint(P) {
          crease(P, 10, 12, 30, 9, 0.5);
          seam(P, 10, 13, 30, 10, 1.3);
          rimLight(P, 'chitin', '#b0a0e0', 0.5);
          rimLight(P, 'obsidian', '#c8a0ff', 0.5);
        },
        glow(P) {
          // Its eyes, six of them, in two arcs.
          for (const [x, y, big] of [[10, 13, 1], [15, 11, 1], [20, 10, 0], [13, 16, 0], [18, 14, 0], [24, 12, 0]]) {
            P.fx(x, y, big ? '#ffffff' : VGLOW, 1);
            if (big) {
              P.fx(x + 1, y, VGLOW, 0.9);
              P.fx(x, y + 1, VGLOW, 0.7);
            }
          }
          // The slit of its mouth.
          for (let i = 0; i < 9; i++) P.fx(4 + i, 21 + Math.round(i * 0.25), i % 3 ? VCYAN : '#ffffff', 0.9);
        },
      },
      // Its arms, out of its head: chitin, jointed, and a long blade.
      ...Object.fromEntries([['armF', 'front', 'weapon', 1], ['armB', 'back', 'offhand', -1]].map(([name, layer, role, s]) => [name, {
        w: 22, h: 52, px: 6, py: 4, role, layer, z: layer === 'front' ? 8 : -2, parent: 'head', at: [s > 0 ? 18 : 24, 20], a0: s > 0 ? 0.25 : -0.15, amp: 1.2,
        show: (R) => !(R.e.reach && R.e.reach.side === (s > 0 ? 0 : 1)),
        body(X) {
          X.in(0, 1);
          X.limb([[6, 4, 3, 2], [8, 18, 2.6, 3], [7, 22, 2.2, 3]], s > 0 ? CHI_HI : CHI, 'chitin');
          X.limb([[7, 22, 2.2, 3], [10, 32, 1.8, 4]], s > 0 ? CHI_HI : CHI, 'chitin');
          X.ball(7.5, 21, 2.8, 2.6, CHI_LO, 'chitin', { z: 5, rz: 2 });
          // The blade: void-glass, curved.
          X.in(1, 0.4);
          X.slab([[9, 31], [12, 31], [17, 40], [19, 50], [14, 44], [9, 36]], '#2a1a4a', 'obsidian', { rz: 2, bevel: 1, z: 6 });
        },
        glow(P) {
          for (let i = 0; i < 16; i++) P.fx(12 + Math.round(i * 0.42), 32 + Math.round(i * 1.1), i % 5 === 0 ? '#ffffff' : VGLOW, 0.85);
        },
      }])),
    },
    legs: {
      style: 'rift', L1: 50, L2: 58, stepT: 0.2, reach: 0.9, arc: 16, thud: true,
      legs: [[2.4], [-2.2]], vFar: -1.2, vNear: 1.1,
      hips: [[[60, 74], [56, 78]], [[84, 74], [88, 78]]],
    },
    fx(R, ctx) {
      // Specks of the void about it, and a shimmer where the air's thin.
      const { x, y, r } = R;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = r.time * (0.6 + i * 0.07) + i * 0.63;
        const px = x + Math.cos(a) * (30 + (i % 3) * 8);
        const py = y - 66 + Math.sin(a * 1.3) * 18;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(r.time * 4 + i);
        ctx.fillStyle = i % 3 ? VGLOW : VCYAN;
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  },
});

// A head-arm out in the world: from its head out to where it's reaching,
// its blade at the end.
WORLD_DRAW.rift_crawler = (r, game, c, add, S) => {
  const R = c.reach;
  if (!R) return;
  const wp = c.renderPos();
  const base = S(wp.x, wp.y, wp.z);
  const flip = c.faceR ? -1 : 1;
  const head = { x: base.x + 11 - 64 + 36 + (flip < 0 ? 2 * (64 - 36) : 0) - 11, y: base.y + 11 - 126 + 34 };
  head.x = base.x + (flip > 0 ? -28 : 28);
  const k = R.back ? Math.max(0, 1 - R.back / 0.35) : Math.min(1, R.t / Math.max(0.05, R.dur));
  const tx = R.x0 + (R.x - R.x0) * 1;
  const tz = R.z0 + (R.z - R.z0) * 1;
  const end = S(tx, wp.y + 0.8, tz);
  const tip = { x: head.x + (end.x - head.x) * k, y: head.y + (end.y - 6 - head.y) * k };
  const mid = { x: (head.x + tip.x) / 2, y: Math.min(head.y, tip.y) - 22 * k };
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const q = bez(head, { x: head.x, y: mid.y }, { x: tip.x, y: mid.y }, tip, i / 10);
    pts.push({ x: q.x, y: q.y, r: 3.2 - (i / 10) * 1.6 });
  }
  const front = end.v > base.v;
  add(front ? end.row : base.row, Math.max(base.layer, end.layer), front ? 99 : -1, () => {
    const ctx = r.ctx;
    drawLimb(ctx, pts, [CHI_LO, CHI_HI, '#6a5a8a'], { t: r.time, vein: VGLOW, band: (q) => (Math.abs(q - 0.5) < 0.04 ? ['#0c0812', VGLOW] : null) });
    // Its blade, hooked down at the end.
    const ang = Math.atan2(tip.y - pts[8].y, tip.x - pts[8].x);
    ctx.fillStyle = '#05010a';
    for (let i = 0; i < 12; i++) {
      const bx = tip.x + Math.cos(ang + 0.9) * i * 0.9;
      const by = tip.y + Math.sin(ang + 0.9) * i * 0.9 + i * 0.4;
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
    }
    ctx.fillStyle = VGLOW;
    for (let i = 0; i < 12; i++) {
      const bx = tip.x + Math.cos(ang + 0.9) * i * 0.9;
      const by = tip.y + Math.sin(ang + 0.9) * i * 0.9 + i * 0.4;
      ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
    }
    glow(ctx, tip.x, tip.y, 10, VGLOW, 0.4);
  });
};

// ------------------------------------------------------------ the Hero
// Twice a man's height in battered plate, gold-trimmed; a red cloak in
// tatters; and what the curse has made of him this moment (see
// entities/evolved_hero.js): each part of him cut free and painted as he
// is or as it's turned (`variant`), his legs and his chest in the body
// itself (one painting for each way they can be).
const STEEL = '#8a909e';
const STEEL_HI = '#c8cedc';
const STEEL_LO = '#4a4e5e';
const TRIM = '#c8a040';
const CLOAK = '#8a1a20';
const FLESH = '#6a7a42';
const FLESH_LO = '#3a4a2a';
const RAW = '#9a3040';
const BONE = '#e8dcc0';
const STEEL_SPEC = '#e8ecf8';
const formOfE = (e) => e.form || {};
forge({
  the_hero: {
    size: 128, ax: 64, ay: 125, walk: true, fps: 8, walkFps: 12, breath: 1,
    body(X, J, t, st) {
      const b = J.b;
      const w = st.walk ? Math.sin(t * TAU) : 0;
      if (!st.legs) {
        // His legs: greaves and sabatons, striding as he goes.
        // (Round 72: heavier, as a man twice a man's height in full plate
        // is: cuisses over the thighs, knee-cops of gold, broad sabatons.)
        X.in(0, 1.6);
        X.limb([[72, 86, 7.4, 1], [72 - w * 5, 104, 6.2, 2], [72 - w * 9, 119, 5.4, 2]], STEEL_LO, 'metal');
        X.ball(72 - w * 2.5, 95, 6.6, 7.5, STEEL_LO, 'metal', { z: 4, rz: 4 });
        X.ball(69 - w * 9, 121, 8, 3.6, STEEL_LO, 'metal', { z: 3, rz: 3 });
        X.ball(72 - w * 5, 104, 4.4, 3.8, '#a07a28', 'gold', { z: 5, rz: 2.5 });
        X.in(1, 1.6);
        X.limb([[55, 86, 8.2, 4], [55 + w * 5, 104, 6.8, 5], [55 + w * 9, 119, 5.8, 5]], STEEL, 'metal');
        X.ball(55 + w * 2.5, 95, 7.6, 8.2, STEEL_HI, 'metal', { z: 8, rz: 5 });
        X.ball(52 + w * 9, 121, 8.4, 3.8, STEEL, 'metal', { z: 6, rz: 3 });
        X.ball(55 + w * 5, 104, 5.4, 4.6, TRIM, 'gold', { z: 10, rz: 3 });
      } else {
        // His legs come apart: a mass of tentacles, writhing.
        X.in(0, 1.2);
        for (let i = 0; i < 8; i++) {
          const ph = t * TAU * 1.5 + i * 1.3;
          const x0 = 50 + i * 3.6;
          const ex = x0 + (i - 3.5) * 5 + Math.sin(ph) * 6;
          X.limb([[x0, 84, 4.6, i % 2 ? 2 : 5], [x0 + (i - 3.5) * 2 + Math.sin(ph + 1) * 4, 102, 3.4, 4], [ex, 120, 1.4, 4], [ex + Math.sin(ph + 2) * 4, 124, 0.6, 4]], i % 2 ? FLESH_LO : FLESH, 'flesh');
        }
      }
      // His mail skirt, and the plates over his hips.
      X.in(2, 1.8);
      X.slab([[46, 78 - b * 0.3], [78, 78 - b * 0.3], [80, 94], [44, 94]], '#5a5e6a', 'mail', { rz: 6, bevel: 3, z: 6 });
      X.ball(62, 81 - b * 0.4, 17, 5, STEEL_LO, 'metal', { z: 10, rz: 4 });
      // (Round 72) Tassets over the skirt, lapped.
      X.slab([[44, 82 - b * 0.3], [57, 82 - b * 0.3], [56, 96], [43, 94]], STEEL, 'metal', { rz: 2.5, bevel: 2, z: 13 });
      X.slab([[67, 82 - b * 0.3], [80, 82 - b * 0.3], [81, 94], [68, 96]], STEEL_LO, 'metal', { rz: 2.5, bevel: 2, z: 12 });
      // His breastplate (or what's become of it), his gorget, his
      // pauldrons (Round 72: broader, in lames, rimmed in gold).
      X.in(3, 2.2);
      X.ball(62, 63 - b, 19, 20, STEEL, 'metal', { z: 10, rz: 14 });
      if (!st.maw) X.ball(62, 62 - b, 4, 15, STEEL_HI, 'metal', { z: 22, rz: 3 });
      if (st.maw) {
        // The mouth in his chest: the plate split, lips of raw flesh.
        X.ball(62, 64 - b, 8.5, 13, RAW, 'flesh', { z: 19, rz: 5 });
        X.ball(62, 64 - b, 5.5, 10.5, '#2a0408', 'flesh', { z: 21, rz: 2 });
      }
      X.ball(62, 46 - b, 11, 5.2, STEEL_HI, 'metal', { z: 14, rz: 4 });
      X.in(4, 1);
      X.ball(80, 56 - b, 8.5, 3.6, STEEL_LO, 'metal', { z: 4, rz: 3 });
      X.ball(78, 50 - b, 10, 8, STEEL_LO, 'metal', { z: 6, rz: 6 });
      X.ball(43, 60 - b, 9.5, 3.6, STEEL_LO, 'metal', { z: 15, rz: 3 });
      X.ball(44, 56 - b, 11, 4.2, STEEL, 'metal', { z: 16, rz: 3 });
      X.ball(46, 49 - b, 13, 9.5, STEEL_HI, 'metal', { z: 18, rz: 9 });
      X.ball(46, 48 - b, 7.5, 5.2, TRIM, 'gold', { z: 25, rz: 3 });
      // His belt and its buckle.
      X.ball(62, 80 - b * 0.4, 14, 2.6, '#3a2418', 'leather', { z: 16, rz: 2 });
      X.ball(62, 80 - b * 0.4, 3, 2.6, TRIM, 'gold', { z: 19, rz: 2 });
    },
    paint(P, J, t, st) {
      const b = J.b;
      if (st.maw) {
        // Its teeth, both lips; a tongue.
        for (let i = -10; i <= 10; i += 2) {
          const wdt = Math.round(Math.sqrt(Math.max(0, 1 - (i / 11) ** 2)) * 5.5);
          P.set(62 - wdt, Math.round(64 - b + i), BONE);
          P.set(62 + wdt, Math.round(64 - b + i), BONE);
          P.set(62 - wdt + 1, Math.round(64 - b + i), '#b8a888');
          P.set(62 + wdt - 1, Math.round(64 - b + i), '#b8a888');
        }
        for (let y = 2; y < 9; y++) P.set(62 + (y % 2), Math.round(64 - b + y), '#c84050');
        // (The plate torn back round it, ragged.)
        for (let i = 0; i < 14; i++) P.set(Math.round(53 + Math.random() * 0 + (i % 2) * 2), Math.round(52 - b + i * 1.7), '#2a2e38');
      } else {
        // The sun of his order, on his breast, worn and scratched.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          for (let k = 3; k < 7; k++) P.set(Math.round(62 + Math.cos(a) * k), Math.round(62 - b + Math.sin(a) * k), k < 5 ? TRIM : '#a07a28');
        }
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) P.set(62 + x, Math.round(62 - b + y), '#ffe070');
        // Scratches across the plate, and a crack.
        for (let i = 0; i < 9; i++) P.set(52 + i, Math.round(56 - b + i * 0.4), '#5a5e6a');
        for (let i = 0; i < 7; i++) P.set(70 - (i % 2), Math.round(68 - b + i), '#3a3e4a');
      }
      // (Round 72) Plate as plate is: a streak of light down the left of
      // each piece, a dark crease at its edge; dents in it, rust at the
      // joints, moss where he's stood so long in the dark; rivets along
      // the rims; and a cold rim of light down his right side.
      for (const [x0, y0, x1, y1] of [[50, 50, 47, 72], [36, 46, 34, 54], [50, 90, 48, 118], [66, 92, 64, 118], [46, 84, 45, 94]]) seam(P, x0, y0 - b, x1, y1 - b, 1.4);
      for (const [x0, y0, x1, y1] of [[45, 58, 44, 80], [79, 58, 80, 80], [57, 82, 56, 96], [67, 82, 68, 96]]) crease(P, x0, y0 - b, x1, y1 - b, 0.5);
      wear(P, 'metal', { dents: 0.025, moss: 0.06, rust: 0.03, seed: 11 });
      rivets(P, [[38, 52], [42, 55], [47, 57], [52, 57], [73, 54], [77, 56], [82, 57], [50, 82], [62, 83], [74, 82]].map(([x, y]) => [x, Math.round(y - b * 0.5)]), '#e8e8f0');
      rimLight(P, 'metal', '#c8d8f0', 0.45);
      rimLight(P, 'gold', '#fff0b0', 0.4);
    },
    glow(P, J, t, st) {
      const b = J.b;
      if (st.maw) for (let y = -8; y <= 8; y++) for (let x = -3; x <= 3; x++) if ((x * x) / 9 + (y * y) / 64 < 1 && (x + y + Math.floor(t * 24)) % 3 === 0) P.fx(62 + x, 64 - b + y, '#ff4030', 0.5);
      if (st.legs) for (let i = 0; i < 8; i++) P.fx(50 + i * 3.6, 92 + (i % 3) * 6, '#c8ff60', 0.6);
    },
    parts: {
      // His cloak, red and in tatters, behind him.
      cape: {
        w: 44, h: 72, px: 22, py: 4, role: 'cape', layer: 'back', z: -4, at: (J) => [66, 46 - J.b],
        body(X) {
          X.in(0, 1.4);
          X.slab([[10, 2], [34, 2], [42, 56], [36, 62], [30, 58], [24, 70], [18, 60], [10, 66], [4, 58]], CLOAK, 'velvet', { rz: 8, bevel: 4 });
          X.ball(22, 6, 11, 5, '#6a1218', 'velvet', { z: 4, rz: 4 });
        },
        paint(P) {
          for (let y = 14; y < 60; y += 7) for (let x = 8; x < 38; x += 9) P.set(x + (y % 2), y, '#5a0a10');
          // (Round 72) Its folds, hanging; holes worn through it; its hem
          // in tatters.
          for (let x = 9; x < 38; x += 5) crease(P, x, 8, x + (x % 2 ? 2 : -1), 60, 0.7);
          for (const [x, y] of [[14, 40], [30, 30], [22, 52], [34, 50]]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) P.set(x + dx, y + dy, '#000000', 0);
          fringe(P, 'velvet', { density: 0.5, len: 3, lean: 0.3 });
          rimLight(P, 'velvet', '#d08090', 0.35);
        },
      },
      // His wings, when the curse gives him them: a dragon's, torn out of
      // his back.
      ...Object.fromEntries([['wingB', 'back', -6, 1], ['wingF', 'front', 3, -1]].map(([name, layer, z, s]) => [name, {
        w: 64, h: 56, px: 6, py: 50, role: 'wing', layer, z, depth: 0.32, rate: 1.4, squash: 0.3, lift: 0.4, a0: s > 0 ? -0.2 : 0.15, sign: s > 0 ? -1 : 1,
        at: (J) => [s > 0 ? 74 : 60, 52 - J.b],
        show: (R) => formOfE(R.e).back === 'wings',
        body(X) {
          X.in(0, 1);
          // Its arm-bone along the top, and its fingers.
          X.limb([[6, 50, 3, 4], [26, 22, 2.6, 5], [44, 6, 2, 5], [60, 2, 1, 5]], '#4a2a2a', 'scales');
          for (const [ex, ey] of [[30, 50], [44, 40], [56, 26]]) X.limb([[26 + (ex - 30) * 0.4, 20 + (ey - 50) * 0.1, 1.6, 5], [ex, ey, 0.8, 5]], '#4a2a2a', 'scales');
          X.in(1, 0.4);
          X.slab([[8, 50], [26, 22], [44, 6], [60, 2], [56, 26], [44, 40], [30, 50], [18, 54]], s > 0 ? '#6a2030' : '#8a2a38', 'flesh', { rz: 3, bevel: 2, z: 1 });
        },
        paint(P) {
          for (let i = 0; i < 30; i++) P.set(10 + i * 1.4, 48 - i * 0.6, '#4a1018');
        },
      }])),
      // His shield-arm: the shield (as himself), or a tentacle.
      armB: {
        w: 44, h: 70, px: 22, py: 6, role: 'offhand', layer: 'back', z: -1, amp: 1, at: (J) => [76, 50 - J.b],
        variant: (R) => formOfE(R.e).off || 'shield',
        body(X, v) {
          if (v === 'tentacle') {
            X.in(0, 1);
            X.limb([[22, 6, 5, 2], [26, 24, 4.2, 3], [18, 42, 3.4, 3], [24, 56, 2.2, 3], [30, 66, 1, 3]], FLESH, 'flesh');
            for (let i = 0; i < 6; i++) X.ball(20 + Math.sin(i) * 4, 14 + i * 9, 1.6, 1.4, '#c8b8a0', 'flesh', { z: 6, rz: 1 });
            return;
          }
          X.in(0, 1);
          X.limb([[22, 6, 4.6, 2], [22, 22, 3.8, 3], [18, 34, 3.4, 3]], STEEL_LO, 'metal');
          // The shield: kite-shaped, his order's sun on it.
          X.in(1, 1.4);
          X.slab([[6, 24], [36, 24], [38, 44], [22, 68], [4, 44]], '#3a4a8a', 'metal', { rz: 6, bevel: 3, z: 6 });
          X.slab([[9, 27], [33, 27], [35, 43], [22, 63], [7, 43]], '#2a3a6a', 'metal', { rz: 3, bevel: 1, z: 9 });
        },
        paint(P, v) {
          if (v === 'tentacle') {
            rimLight(P, 'flesh', '#d8e0a0', 0.35);
            return;
          }
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            for (let k = 2; k < 7; k++) P.set(Math.round(21 + Math.cos(a) * k), Math.round(40 + Math.sin(a) * k), TRIM);
          }
          for (let x = 6; x < 37; x++) P.set(x, 24, TRIM);
          // (Round 72) Its rim of gold, its boss, the rivets round it, the
          // paint of it chipped and the plate under showing through.
          for (let i = 0; i <= 20; i++) {
            const k = i / 20;
            P.set(Math.round(6 + 16 * k), Math.round(24 + 44 * k), TRIM);
            P.set(Math.round(36 + 2 * k - 16 * Math.max(0, k - 0.45) * 1.8), Math.round(24 + 44 * k), TRIM);
          }
          for (let y = 28; y <= 30; y++) for (let x = 19; x <= 23; x++) P.set(x, y, y === 28 ? '#ffe070' : TRIM);
          rivets(P, [[9, 27], [15, 26], [27, 26], [33, 27], [10, 42], [32, 42]], '#ffe8a0');
          wear(P, 'metal', { dents: 0.03, rust: 0.02, seed: 19 });
          rimLight(P, 'metal', '#c8d8f0', 0.45);
        },
      },
      // His sword-arm: the greatsword (as himself), a claw, or a blade of
      // bone.
      armF: {
        w: 44, h: 84, px: 14, py: 6, role: 'weapon', layer: 'front', z: 4, amp: 1.1, at: (J) => [48, 52 - J.b],
        variant: (R) => formOfE(R.e).arm || 'sword',
        body(X, v) {
          if (v === 'claw') {
            X.in(0, 1.4);
            X.limb([[14, 6, 7, 3], [12, 24, 7.5, 4], [10, 38, 8, 4]], FLESH, 'flesh');
            X.ball(10, 42, 10, 8, FLESH_LO, 'flesh', { z: 4, rz: 6 });
            for (const [dx, len] of [[-8, 18], [-2, 22], [5, 20], [11, 14]]) X.limb([[10 + dx * 0.6, 46, 2.4, 6], [10 + dx, 46 + len * 0.6, 1.8, 7], [10 + dx * 1.3, 46 + len, 0.5, 7]], BONE, 'bone');
            return;
          }
          if (v === 'blade') {
            X.in(0, 1);
            X.limb([[14, 6, 6, 3], [12, 22, 5.4, 4], [12, 32, 4.4, 4]], FLESH, 'flesh');
            X.in(1, 0.6);
            X.slab([[8, 30], [17, 30], [22, 52], [18, 80], [13, 70], [8, 48]], BONE, 'bone', { rz: 4, bevel: 2, z: 6 });
            return;
          }
          // His arm in plate, his gauntlet, and his greatsword.
          X.in(0, 1.4);
          X.limb([[14, 6, 5.6, 3], [13, 20, 4.8, 4], [12, 32, 4.4, 4]], STEEL, 'metal');
          X.ball(13, 19, 4.6, 3.6, TRIM, 'gold', { z: 8, rz: 3 });
          X.ball(12, 34, 5.4, 4.6, STEEL_HI, 'metal', { z: 8, rz: 4 });
          X.in(1, 0.5);
          X.tube(2, 33, 24, 35, 2.2, 2.2, TRIM, 'gold', { z: 10 });
          X.tube(13, 36, 15, 84, 3.6, 1.4, STEEL_HI, 'metal', { z: 9 });
          X.tube(11, 26, 12, 33, 1.3, 1.3, '#3a2418', 'leather', { z: 10 });
          X.ball(11, 25, 2, 2, TRIM, 'gold', { z: 11, rz: 2 });
        },
        paint(P, v) {
          if (v === 'sword') {
            for (let y = 40; y < 80; y++) P.set(14, y, STEEL_SPEC);
            crease(P, 11, 38, 13, 82, 0.6);
            wear(P, 'metal', { dents: 0.02, rust: 0.02, seed: 13 });
          }
          rimLight(P, 'metal', '#c8d8f0', 0.45);
          rimLight(P, 'bone', '#fff8e8', 0.4);
        },
        glow(P, v) {
          if (v === 'sword') for (let y = 42; y < 78; y += 6) P.fx(14, y, '#ffe8a0', 0.4);
        },
      },
      // His head: his great helm (a crest, a cracked visor, eyes in the
      // dark of it), or the stalks of the curse's eyes burst out of it.
      head: {
        w: 40, h: 44, px: 20, py: 36, role: 'head', layer: 'front', z: 6, at: (J) => [62, 44 - J.b],
        variant: (R) => formOfE(R.e).head || 'helm',
        body(X, v) {
          X.in(0, 1.6);
          X.ball(20, 24, 11.5, 12.5, STEEL, 'metal', { z: 6, rz: 10 });
          X.ball(17, 27, 8, 7, STEEL_HI, 'metal', { z: 12, rz: 5 });
          // (Round 72) Horns of gold off the helm.
          X.tube(12, 17, 5, 8, 1.8, 0.6, TRIM, 'gold', { z: 8 });
          X.tube(29, 17, 36, 9, 1.8, 0.6, TRIM, 'gold', { z: 8 });
          if (v === 'stalks') {
            X.in(1, 0.8);
            for (const [ex, ey, k] of [[6, 2, 0], [14, 0, 1], [24, 1, 2], [32, 6, 3], [2, 12, 4]]) {
              X.limb([[16 + k * 2, 16, 2, 7], [(16 + k * 2 + ex) / 2, (16 + ey) / 2 - 2, 1.4, 8], [ex, ey + 3, 1.2, 8]], FLESH, 'flesh');
              X.ball(ex, ey + 2, 2.6, 2.6, '#e8e0c8', 'flesh', { z: 10, rz: 2 });
            }
            return;
          }
          // His crest.
          X.in(1, 0.6);
          X.slab([[17, 12], [24, 12], [37, 0], [31, 9], [26, 16]], '#a01818', 'velvet', { rz: 2, bevel: 1, z: 8 });
          X.tube(20, 14, 20, 34, 1.4, 1.4, TRIM, 'gold', { z: 14 });
        },
        paint(P, v) {
          // The visor's slit.
          for (let x = 9; x < 22; x++) P.set(x, 25, '#0a0810');
          for (let x = 11; x < 18; x++) P.set(x, 26, '#1a1820');
          if (v !== 'stalks') for (let i = 0; i < 5; i++) P.set(24 + (i % 2), 20 + i * 2, '#3a3e4a');
          seam(P, 12, 16, 11, 30, 1.4);
          wear(P, 'metal', { dents: 0.02, rust: 0.03, seed: 17 });
          rimLight(P, 'metal', '#c8d8f0', 0.45);
        },
        glow(P, v) {
          if (v === 'stalks') {
            for (const [ex, ey] of [[6, 2], [14, 0], [24, 1], [32, 6], [2, 12]]) {
              P.fx(ex, ey + 2, '#c8ff40', 1);
              P.fx(ex - 1, ey + 2, '#203010', 0.8);
            }
          } else {
            P.fx(12, 25, '#ffe8a0', 0.9);
            P.fx(16, 25, '#ffe8a0', 0.9);
          }
        },
      },
    },
    fx(R, ctx) {
      // The curse in him: a sickly light breaking out of his joints now
      // and then, more of it the more of him it has.
      const { e, x, y, r } = R;
      const F = formOfE(e);
      const n = Object.entries(F).filter(([k, v]) => v !== { chest: 'plate', arm: 'sword', off: 'shield', legs: 'legs', head: 'helm', back: 'none' }[k]).length;
      if (!n) return;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n * 3; i++) {
        const a = r.time * 1.3 + i * 2.1;
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(r.time * 5 + i);
        ctx.fillStyle = i % 2 ? '#c8ff60' : '#8ac040';
        ctx.fillRect(Math.round(x - 8 + Math.cos(a) * 14), Math.round(y - 70 + Math.sin(a * 0.7) * 26), 1, 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  },
});

// His tentacle-arm, lashed out into the world as it takes you.
WORLD_DRAW.the_hero = (r, game, c, add, S) => {
  const L = c.lashTo;
  if (!L) return;
  const wp = c.renderPos();
  const base = S(wp.x, wp.y, wp.z);
  const sh = { x: base.x + (c.faceR ? -12 : 12), y: base.y + 11 - 125 + 50 };
  const k = Math.min(1, L.t / 0.3) * Math.min(1, (1.1 - L.t) / 0.3);
  const end = S(L.x, wp.y + 1, L.z);
  const tip = { x: sh.x + (end.x - sh.x) * k, y: sh.y + (end.y - sh.y) * k };
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const q = bez(sh, { x: sh.x, y: sh.y - 20 }, { x: tip.x, y: tip.y - 16 }, tip, i / 10);
    pts.push({ x: q.x + Math.sin(r.time * 9 + i) * 1.5, y: q.y, r: 4 - (i / 10) * 2.6 });
  }
  add(Math.max(base.row, end.row), base.layer, 99, () => drawLimb(r.ctx, pts, [FLESH_LO, FLESH, '#a8b880'], { t: r.time, vein: '#c8ff60' }));
};

// ------------------------------------------------------------ the Alinelidan
// Its head: a great blunt mass of grey-pink flesh, ridged and wrinkled,
// bristling, blind spots where eyes were once; its maw, round, ringed with
// teeth going back and back, splitting four ways as it opens (its jaws:
// drawn over it, opening as it bites, screams, spits) and its tentacles
// writhing out. Behind it in the world, ring after ring of its body (see
// WORLD_DRAW below).
const WFL = '#9a6058';
const WFL_HI = '#d8a898';
const WFL_LO = '#4a2830';
const WDARK = '#2a1014';
const WBONE = '#e0d4b8';
const WBONE_LO = '#9a8a70';
const WMAW = { x: 46, y: 68 };
forge({
  alinelidan: {
    // (Round 73: anchored lower, its head down level with the rings of its
    // body behind it, not floating over them.)
    size: 128, ax: 64, ay: 100, breath: 1.4, fps: 9, walk: true, walkFps: 14,
    body(X, J, t, st) {
      const b = J.b;
      // (Round 77: no stub of neck behind it: its body's rings follow it
      // in the world, see WORLD_DRAW below.)
      // The head itself.
      X.in(1, 3);
      X.ball(62, 66 - b, 36, 34, WFL, 'flesh', { z: 10, rz: 26 });
      X.ball(70, 50 - b, 22, 14, WFL_HI, 'flesh', { z: 16, rz: 10 });
      // Its maw's rim, thick, puckered.
      X.in(2, 1.4);
      X.ball(WMAW.x, WMAW.y - b, 24, 23, WFL_LO, 'flesh', { z: 22, rz: 10 });
      X.ball(WMAW.x, WMAW.y - b, 19, 18, '#4a1a20', 'flesh', { z: 26, rz: 6 });
      X.ball(WMAW.x, WMAW.y - b, 13, 12, WDARK, 'flesh', { z: 24, rz: 3 });
      // Ridges round its head, ring on ring, each a fold of hide.
      X.in(3, 1.2);
      for (let r = 0; r < 4; r++) for (let i = -10; i <= 10; i++) {
        const a = (i / 10) * 1.35;
        X.ball(72 + r * 8 + Math.cos(a) * 5, 66 - b + Math.sin(a) * (33 - r * 3), 3.4, 2.8, r % 2 ? WFL_LO : '#8a5e58', 'flesh', { z: 20 - r * 3, rz: 2.4 });
      }
      // Its lips, folded round the maw.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        X.ball(WMAW.x + Math.cos(a) * 21, WMAW.y - b + Math.sin(a) * 20, 4, 3.4, i % 2 ? WFL : WFL_HI, 'flesh', { z: 28, rz: 3 });
      }
      // (Round 72) The bone of it: a crest of plates up over its head and
      // back, horns out of them, and a pale brow of it over the maw.
      X.in(4, 0.8);
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 9;
        const y = 36 - b + i * 2.2;
        X.slab([[x - 5, y + 6], [x + 5, y + 5], [x + 7, y - 4 - (i % 2) * 3], [x - 2, y - 7 - (i % 2) * 2]], i % 2 ? WBONE_LO : WBONE, 'bone', { rz: 3, bevel: 2, z: 26 - i * 2 });
      }
      for (const [x, y, ex, ey] of [[64, 34, 56, 20], [82, 36, 84, 18], [98, 44, 110, 34]]) X.tube(x, y - b, ex, ey - b, 3, 0.8, WBONE_LO, 'bone', { z: 24 });
      X.ball(50, 44 - b, 14, 5, WBONE, 'bone', { z: 33, rz: 3 });
    },
    paint(P, J, t) {
      const b = J.b;
      // Its rings of teeth, going back into the dark.
      for (const [rr, n, col] of [[17, 22, '#f0e8d0'], [12.5, 16, '#d8ccb0'], [8, 11, '#a89880']]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rr * 0.3 + t * TAU * (rr === 12.5 ? -0.25 : 0.25);
          const x = WMAW.x + Math.cos(a) * rr;
          const y = WMAW.y - b + Math.sin(a) * rr * 0.95;
          const ix = WMAW.x + Math.cos(a) * (rr - 3);
          const iy = WMAW.y - b + Math.sin(a) * (rr - 3) * 0.95;
          P.set(Math.round(x), Math.round(y), col);
          P.set(Math.round((x + ix) / 2), Math.round((y + iy) / 2), col);
          P.set(Math.round(ix), Math.round(iy), '#ffffff');
        }
      }
      // Wrinkles, and bristles.
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39;
        const x = 70 + Math.cos(a) * (14 + (i % 5) * 4);
        const y = 62 - b + Math.sin(a) * (14 + (i % 4) * 5);
        P.set(Math.round(x), Math.round(y), WFL_LO);
        P.set(Math.round(x + 1), Math.round(y - 1), '#4a2a26');
      }
      // Blind spots where its eyes were.
      for (const [x, y] of [[78, 48], [86, 56], [72, 52]]) {
        P.set(x, y - Math.round(b), '#e8d8c8');
        P.set(x + 1, y - Math.round(b), '#c8b8a8');
        P.set(x, y + 1 - Math.round(b), '#6a3a3a');
      }
      // (Round 72) Its hide: creases out from the maw, puckered, a lit
      // fold beside each; pale scars across it; a cold rim of light on its
      // back, and bristles standing off its edge.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        crease(P, WMAW.x + Math.cos(a) * 25, WMAW.y - b + Math.sin(a) * 24, WMAW.x + Math.cos(a) * 34, WMAW.y - b + Math.sin(a) * 32, 0.55);
        seam(P, WMAW.x + Math.cos(a + 0.12) * 26, WMAW.y - b + Math.sin(a + 0.12) * 25, WMAW.x + Math.cos(a + 0.12) * 33, WMAW.y - b + Math.sin(a + 0.12) * 31, 1.3);
      }
      for (const [x, y, n] of [[84, 70, 7], [76, 84, 5], [94, 60, 6]]) for (let k = 0; k < n; k++) P.set(x + k, Math.round(y - b + (k % 2)), '#d8b8b0');
      rimLight(P, 'flesh', '#f0d8d0', 0.4);
      rimLight(P, 'bone', '#fff8e8', 0.5);
      fringe(P, 'flesh', { density: 0.25, len: 2.2, lean: 0.3, up: true });
    },
    glow(P, J, t) {
      const b = J.b;
      // Bile in its throat, glowing.
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + t * TAU;
        P.fx(WMAW.x + Math.cos(a) * 4, WMAW.y - b + Math.sin(a) * 4, '#c8e070', 0.4 + 0.3 * Math.sin(t * TAU * 3 + i));
      }
      P.fx(WMAW.x, WMAW.y - b, '#e8ff90', 0.8);
    },
    // Its jaws over the maw (opening as it bites, screams, spits, calls
    // its leeches), and its tentacles writhing out between them.
    front(R) {
      const { ctx, e, ox, oy, t, A } = R;
      const b = R.J.b;
      const cx = ox + WMAW.x;
      const cy = oy + WMAW.y - b;
      const k0 = A && A.k ? Math.min(1, A.t / Math.max(0.05, A.dur)) : 0;
      const busy = A && ['strike', 'roar', 'breath', 'throw', 'cast', 'summon', 'charge'].includes(A.k) ? Math.sin(Math.PI * k0) : 0;
      const open = Math.max(e.jawT > 0 ? 0.85 : 0.3 + 0.08 * Math.sin(t * 2), busy, e.windup ? 0.6 : 0);
      // Tentacles first, out of the maw.
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + 0.4;
        const len = 10 + open * 22;
        let x = cx;
        let y = cy;
        for (let s = 0; s <= 12; s++) {
          const q = s / 12;
          const a = a0 + Math.sin(t * 3 + i + q * 4) * 0.5 * q;
          const nx = cx + Math.cos(a) * len * q - q * q * 6;
          const ny = cy + Math.sin(a) * len * q * 0.9 + q * q * 4;
          const r = Math.max(0.6, 3 - q * 2.4);
          ctx.fillStyle = '#2a0c10';
          ctx.fillRect(Math.round(nx - r - 1), Math.round(ny - r), Math.round(r * 2 + 2), Math.round(r * 2));
          ctx.fillStyle = q > 0.8 ? '#e8a0a0' : '#a84a54';
          ctx.fillRect(Math.round(nx - r), Math.round(ny - r + 0.5), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2 - 1)));
          if (s % 3 === 1) {
            ctx.fillStyle = '#f0d0c8';
            ctx.fillRect(Math.round(nx), Math.round(ny + r - 1), 1, 1);
          }
          x = nx;
          y = ny;
        }
        void x;
        void y;
      }
      // Its four jaws: toothed flaps round the maw, folding open.
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU + Math.PI / 4;
        const hx = cx + Math.cos(a) * 16;
        const hy = cy + Math.sin(a) * 15;
        // (Closed, it lies over the maw, its point in the middle; open, it
        // peels back toward the rim, the maw opening behind it.)
        const dir = a + Math.PI + Math.sin(t * 2 + j) * 0.05;
        const L = 18 * (1 - 0.72 * open);
        const W = 8 + open * 5;
        const tipx = hx + Math.cos(dir) * L;
        const tipy = hy + Math.sin(dir) * L * 0.9;
        const px = -Math.sin(dir);
        const py = Math.cos(dir);
        const poly = [[hx + px * W, hy + py * W], [tipx, tipy], [hx - px * W, hy - py * W]];
        // Fill it, a pixel at a time, edge darkened, teeth along it.
        const minx = Math.floor(Math.min(...poly.map((p) => p[0])));
        const maxx = Math.ceil(Math.max(...poly.map((p) => p[0])));
        const miny = Math.floor(Math.min(...poly.map((p) => p[1])));
        const maxy = Math.ceil(Math.max(...poly.map((p) => p[1])));
        const inside = (x, y) => {
          let s = 0;
          for (let i = 0; i < 3; i++) {
            const [ax, ay] = poly[i];
            const [bx, by] = poly[(i + 1) % 3];
            const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
            s += cr > 0 ? 1 : cr < 0 ? -1 : 0;
          }
          return Math.abs(s) === 3;
        };
        for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
          if (!inside(x + 0.5, y + 0.5)) continue;
          const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
          const lit = (x - hx) * -0.6 + (y - hy) * -0.8 > 0;
          ctx.fillStyle = edge ? '#2a1014' : lit ? WFL_HI : WFL;
          ctx.fillRect(x, y, 1, 1);
        }
        // Teeth along its inner edge.
        for (let s = 2; s < 10; s += 2) {
          const q = s / 10;
          const ex = hx + (tipx - hx) * q - px * W * (1 - q) * 0.9;
          const ey = hy + (tipy - hy) * q - py * W * (1 - q) * 0.9;
          ctx.fillStyle = '#f0e8d0';
          ctx.fillRect(Math.round(ex), Math.round(ey), 1, 2);
        }
      }
    },
  },
});

// Its body, ring after ring behind its head, each where its head has
// been; sinking into the floor as it dives.
function wormRing(size) {
  return sculpted(`wring${size}`, size + 4, size + 4, (X) => {
    const c = (size + 4) / 2;
    X.in(0, 2);
    X.ball(c, c, size / 2, size / 2 - 1, WFL, 'flesh', { rz: size * 0.4 });
    X.in(1, 0.6);
    X.ball(c, c - size * 0.08, size / 2 - 1.5, size / 2 - 4, WFL_HI, 'flesh', { z: size * 0.18, rz: size * 0.2 });
    for (let i = -3; i <= 3; i++) X.ball(c + i * (size / 9), c - size * 0.42 + Math.abs(i) * 0.8, 1.6, 2.2, WFL_LO, 'flesh', { z: size * 0.4, rz: 1.5 });
    // (Round 72) A ridge of bone plates along the top of each ring.
    X.in(2, 0.5);
    for (let i = -2; i <= 2; i++) X.slab([[c + i * (size / 6) - 2, c - size * 0.3], [c + i * (size / 6) + 2, c - size * 0.3], [c + i * (size / 6) + 1, c - size * 0.48 - (i % 2 ? 2 : 0)]], i % 2 ? WBONE_LO : WBONE, 'bone', { rz: 2, bevel: 1, z: size * 0.42 });
    X.in(3, 0.4);
    X.ball(c, c + size * 0.3, size / 2 - 3, 2, WFL_LO, 'flesh', { z: size * 0.25, rz: 2 });
  });
}
WORLD_DRAW.alinelidan = (r, game, c, add, S) => {
  if (c.burrowed || !c.trail || !c.trail.length) return;
  const rings = wormRingsOf(c);
  const sink = c.diving ? Math.min(1, c.diving.t / c.diving.dur) : 0;
  const wp = c.renderPos();
  const hurt = c.flash > 0;
  rings.forEach((q, i) => {
    const size = Math.round(44 - q.k * 26);
    const pic = wormRing(size - (size % 2));
    if (!pic) return;
    const p = S(q.x, wp.y, q.z);
    const down = sink * (1.4 + (1 - q.k)) * 36;
    const bob = Math.sin(r.time * 4 - i * 0.6) * 1.5;
    add(p.row, p.layer, 40 - i * 0.01, () => {
      const ctx = r.ctx;
      const h = pic.h;
      const y = Math.round(p.y + 10 - h * 0.85 + bob + down);
      if (down >= h) return;
      ctx.save();
      // (Sinking: only what's still above the floor.)
      ctx.beginPath();
      ctx.rect(p.x - pic.w, p.y + 10 - 200, pic.w * 2, 200);
      ctx.clip();
      ctx.drawImage(pic.cv, Math.round(p.x - pic.w / 2), y);
      if (hurt) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4;
        ctx.drawImage(pic.cv, Math.round(p.x - pic.w / 2), y);
      }
      ctx.restore();
      // Its shadow.
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(p.x - size / 2 + 2), Math.round(p.y + 9), size - 4, 2);
      ctx.restore();
    });
  });
};
