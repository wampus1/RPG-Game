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
import { TILE, LH } from '../config.js';

const TAU = Math.PI * 2;
const GOLD = '#d8a838';
const GOLD_HI = '#ffe070';
const GOLD_LO = '#8a5a18';
const PEARL = '#ece4d4';

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
      drawLimb(ctx, pts, [E.pal[0], E.pal[1], E.pal[2]], {
        t: r.time, vein: E.glow,
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
