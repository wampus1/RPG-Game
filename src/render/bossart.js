// The masters of the old places, drawn as they deserve (see
// Renderer.drawEntity): half as big again as anything else down there,
// breathing, their own colour pooled on the floor round them with a ring
// of signs turning in it, motes coming off them (and more, and redder, as
// they're worn down); and three of them, the Brood Mother, the Ossuary
// Horror and the Overseer, walking on legs of their own, each foot planted
// where it falls and stepping on only when the body's gone on too far from
// it, half the legs at a time.
import { hex, mix, shade, toHex } from './pixel.js';
import { Paint, hash2 } from './paint.js';
import { Sculpt } from './sculpt.js';
import { Part, bodyOf, drawBody } from './bossrig.js';
import { TILE, LH } from '../config.js';
import { frameGlow } from './sprites.js';

export const BOSS_SCALE = 1.5;
const OUT = '#1c1622';
const K = { dark: '#1c1a2a', plate: '#2a2840', edge: '#4a4870', seam: '#5ad8f0', glow: '#c8fbff' };

// The colours a master shines in (its aura, its motes, its end).
const TINTS = {
  barrow_king: ['#a0e8ff', '#e0f8ff'], mound_witch: ['#a0ff70', '#3a5a2a'], huntsman: ['#80e8ff', '#c8fbff'],
  worm: ['#c8a070', '#8a6a4a'], foreman: ['#ffb040', '#ff7020'], brood_mother: ['#c83a30', '#8ac040'],
  priest: ['#80c8e0', '#c8e8f8'], horror: ['#ff4030', '#e8e0c8'], hollow_saint: ['#c8a0ff', '#ffffff'], saint_shade: ['#c8a0ff', '#ffffff'],
  warlord: ['#ff6040', '#ffb080'], twins: ['#ff5040', '#c8c0b8'], twin_b: ['#c8c0b8', '#ff5040'], poisoner: ['#a8e040', '#e8ff90'],
  overseer: ['#5ad8f0', '#ffffff'], prime: ['#ff9050', '#5ad8f0'],
};
// (The Hollow Saint's images are drawn just as she is: which is she? And
// the Hollow King's echoes just as he is, but that they don't breathe.)
export function drawnAsMaster(e) {
  return !!(e.S && (e.S.boss || e.species === 'saint_shade' || e.species === 'hollow_echo') && (e.kind === 'creature' || e.kind === 'monster'));
}
export function bossTint(c) {
  if (c.species === 'hollow_echo' && c.echoOf) return bossTint(c.echoOf);
  return TINTS[c.species] || (c.S && c.S.tint) || ['#ffe070', '#ffffff'];
}

const ease = (k) => k * k * (3 - 2 * k);
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;

function toCanvas(px) {
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  c.getContext('2d').putImageData(px.toImageData(), 0, 0);
  return c;
}

// How big a master's drawn, and its breath (a slow swell, quicker when it's
// hurt badly).
export function bossScale(e, time) {
  const rage = e.hp < e.maxHp * 0.35;
  const b = Math.sin(time * (rage ? 4.2 : 2.2) + (e.id || 0)) * 0.025;
  return { x: BOSS_SCALE * (1 - b * 0.5), y: BOSS_SCALE * (1 + b) };
}

// ------------------------------------------------------------ under it
// A broad shadow, its colour pooled on the floor, a ring of signs turning
// in the pool; and the motes coming off it (thicker, and embers among them,
// when it's badly hurt; brighter while it winds up a blow).
export function drawBossUnder(r, ctx, e, sx, feetY) {
  const t = r.time;
  const tint = bossTint(e);
  const cx = sx + 8;
  const cy = feetY - 1;
  const big = !!(e.S.big || e.species === 'overseer');
  const R = big ? 34 : 22;
  const rage = e.hp < e.maxHp * 0.35;
  const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const fade = e.dying !== undefined ? 1 - e.dying : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * (rage ? 6 : 2.4) + (e.id || 0));
  ctx.save();
  ctx.globalAlpha = 0.5 * fade;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.62, R * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fade;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, rgba(tint[0], 0.22 + 0.14 * pulse + 0.3 * wind));
  g.addColorStop(0.6, rgba(tint[0], 0.08 + 0.06 * pulse));
  g.addColorStop(1, rgba(tint[0], 0));
  ctx.fillStyle = g;
  ctx.translate(cx, cy);
  ctx.scale(1, 0.36);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The ring of signs, turning (the faster the angrier).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = big ? 18 : 12;
  const rot = t * (rage ? 1.5 : 0.45) + (e.id || 0);
  ctx.fillStyle = rage && Math.floor(t * 6) % 2 ? '#ff4030' : tint[0];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * R * 0.8;
    const y = cy + Math.sin(a) * R * 0.8 * 0.36;
    ctx.globalAlpha = fade * (0.3 + 0.35 * pulse + 0.3 * wind) * (0.55 + 0.45 * Math.sin(a * 3 + t * 2));
    ctx.fillRect(Math.round(x) - (i % 3 === 0 ? 1 : 0), Math.round(y), i % 3 === 0 ? 3 : 2, 1);
  }
  ctx.restore();
  // Motes.
  if (r.spin || e.dying !== undefined) return;
  e.moteT = (e.moteT || 0) - (r.frameDt || 0.016);
  if (e.moteT <= 0) {
    e.moteT = rage ? 0.05 : 0.11;
    const wp = e.renderPos();
    const h = big ? 2.4 : 2;
    r.emit(wp.x + (Math.random() - 0.5) * (big ? 1.6 : 0.9), wp.y + 0.3 + Math.random() * h, wp.z + (Math.random() - 0.5) * 0.6, { n: 1, color: rage && Math.random() < 0.5 ? ['#ff4030', '#ffb040'] : tint, up: 12, speed: 6, gravity: -16, life: 1.1, glow: true });
  }
}

// ------------------------------------------------------------ bodies
// Drawn facing left (turned for right), sculpted as the masters of the
// islands are (see sculpt.js: chitin, fur, bone, rotten flesh, alloy, each
// surfaced as what it is), in twenty-four frames of breath; painted as
// they're first wanted, a couple a frame (the nearest one painted shown
// till then), so meeting one never stalls the game.
export const BODY_FRAMES = 24;
const TAU = Math.PI * 2;
const bodies = new Map();
let budgetT = -1;
let budget = 0;
function body(kind, f, now) {
  const k = `${kind}:${f}`;
  let c = bodies.get(k);
  if (c) return c;
  if (now !== budgetT) {
    budgetT = now;
    budget = 2;
  }
  if (budget <= 0) {
    for (let d = 1; d < BODY_FRAMES; d++) {
      for (const g of [f - d, f + d]) {
        const w = bodies.get(`${kind}:${(g + BODY_FRAMES) % BODY_FRAMES}`);
        if (w) return w;
      }
    }
  }
  budget--;
  bodies.set(k, (c = toCanvas(BODY[kind](f))));
  return c;
}
function painted(X, w, h) {
  const P = new Paint(w, h);
  P.p = X.render();
  return P;
}

const BODY = {
  // A spider the size of a cart: a great bristled bag of an abdomen,
  // banded, an hourglass of red on it that glows as she breathes; the
  // glossy head-and-body crowded with eyes, two great and many little;
  // fangs working, feelers twitching.
  brood_mother(f) {
    const t = f / BODY_FRAMES;
    const br = Math.sin(t * TAU) * 0.6;
    const fang = Math.max(0, Math.sin(t * TAU * 2));
    const X = new Sculpt(46, 32, { seed: 13, t });
    X.in(0, 2.5);
    X.ball(30, 15, 14 + br, 11 + br, '#5a443a', 'fur', { rz: 11, along: 'x' });
    X.ball(43.5, 15.5, 2.2, 2.6, '#3a2a24', 'chitin', { z: 2, rz: 1.5 });
    X.in(1, 1.5);
    X.ball(19.5, 17, 4, 3.6, '#3a2a24', 'chitin', { rz: 3, z: 2 });
    X.ball(12.5, 18, 8.5, 6.8, '#4a3630', 'chitin', { rz: 6, z: 3 });
    X.limb([[7, 20, 1.3, 6], [3.5 - fang * 0.6, 22, 1.1, 7], [2.6, 25, 0.8, 7]], '#4a3630', 'chitin');
    X.limb([[8, 21, 2.2, 7], [6.5, 24.5, 1.6, 8]], '#3a2a24', 'chitin');
    X.limb([[6.5, 24.5, 1, 8], [5 - fang, 27.5, 0.4, 8]], '#e8e0c8', 'bone');
    X.limb([[11, 22, 2.2, 6], [10, 25.5, 1.6, 7]], '#3a2a24', 'chitin');
    X.limb([[10, 25.5, 1, 7], [10 + fang, 28.5, 0.4, 7]], '#e8e0c8', 'bone');
    X.in(2, 0.4);
    for (const [x, y, r] of [[6.5, 15.5, 1.9], [10, 14, 1.7], [13, 13.6, 1.1], [8, 17.6, 1], [11.5, 16.6, 0.9], [14.2, 16, 0.8], [5, 18, 0.8]]) X.ball(x, y, r, r, '#2a0808', 'glass', { z: 9, rz: r * 0.8 });
    const P = painted(X, 46, 32);
    // The bands round her abdomen, and the bristles standing off it.
    P.over((x, y, c) => {
      if (x < 19) return null;
      const k = (x - Math.round(Math.abs(y - 15) * 0.35)) % 6;
      return k === 0 ? shade(c, 0.6) : k === 1 ? shade(c, 1.15) : null;
    });
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + 0.3 + (i / 13) * (Math.PI - 0.5);
      P.spike(30 + Math.cos(a) * (13.5 + br), 15 + Math.sin(a) * (10.5 + br), a + Math.sin(t * TAU + i) * 0.08, 2.5, 0.5, '#8a6a58');
    }
    // The hourglass, glowing as she breathes.
    const glow = 0.5 + 0.5 * Math.sin(t * TAU);
    const red = toHex(mix(hex('#c82a20'), hex('#ff6a40'), glow));
    P.poly([[26.5, 9.5], [34, 9.5], [30.5, 14.6]], red, { lv: 0.75, contrast: 0.5 });
    P.poly([[30.5, 15.4], [34, 20.5], [26.5, 20.5]], red, { lv: 0.65, contrast: 0.5 });
    // Her eyes, red in their gloss.
    for (const [x, y] of [[6, 15], [9.5, 13.5]]) P.set(x + 1, y + 1, hex(glow > 0.5 ? '#ff5040' : '#d82a1a'));
    for (const [x, y] of [[13, 13.6], [8, 17.6], [11.5, 16.6], [14.2, 16], [5, 18]]) P.set(x, y, hex('#ff3a20'));
    P.done();
    P.glint(6, 15, '#ffd8c8');
    P.glint(9, 13, '#ffd8c8');
    return P.p;
  },
  // A heap of the dead grown into one thing: rotten flesh knotted with
  // bones, ribs arched over a heart of red light that throbs, skulls set
  // in it whose eyes come and go.
  horror(f) {
    const t = f / BODY_FRAMES;
    const br = Math.sin(t * TAU) * 0.8;
    const beat = Math.max(0, Math.sin(t * TAU * 2)) ** 2;
    const X = new Sculpt(46, 36, { seed: 17, t });
    X.in(0, 3);
    X.ball(23, 23 - br, 19, 12, '#5a4a40', 'flesh', { rz: 10 });
    X.ball(12, 27 - br * 0.5, 8, 5.5, '#4a3a32', 'flesh', { z: 3, rz: 4 });
    X.ball(34, 27 - br * 0.5, 8, 5.5, '#4a3a32', 'flesh', { z: 3, rz: 4 });
    X.in(1, 0.8);
    for (let i = 0; i < 14; i++) {
      const a = (i * 2.399) % TAU;
      const r = 6 + ((i * 7) % 10);
      const x = 23 + Math.cos(a) * r * 1.1;
      const y = 23 - br + Math.sin(a) * r * 0.6;
      if (Math.abs(x - 23) < 8 && Math.abs(y - 21 + br) < 6) continue;
      X.tube(x, y, x + Math.cos(a + 1.3) * 4.5, y + Math.sin(a + 1.3) * 2.8, 1, 0.8, i % 3 ? '#d8d0b8' : '#b8b098', 'bone', { z: 8 });
    }
    X.ball(23, 21 - br, 7.5, 5.5, '#1a0606', 'flesh', { z: 7, rz: 1 });
    X.ball(23, 21 - br, 3.5 + beat * 1.2, 2.6 + beat * 0.8, '#ff4030', 'molten', { z: 9, rz: 2, glow: '#ff9060', glowK: 0.4 + beat * 0.4 });
    X.in(2, 0.6);
    for (let k = -2; k <= 2; k++) {
      const pts = [];
      for (let y = -6; y <= 6; y += 3) pts.push([23 + k * 3.2 + ((y * y) / 14) * Math.sign(k || 1), 21 - br + y, 0.95, 12 - Math.abs(y) * 0.3]);
      X.limb(pts, k === 0 ? '#c8c0a8' : '#d8d0b8', 'bone');
    }
    const skulls = [[10, 16, 0], [18, 11, 1], [29, 11, 2], [37, 16, 3], [14, 27, 4], [32, 27, 5]];
    for (const [x, y] of skulls) {
      X.ball(x, y - br, 3.2, 2.9, '#e0d8c0', 'bone', { z: 10, rz: 2.6 });
      X.ball(x, y + 2 - br, 2, 1.2, '#c8c0a8', 'bone', { z: 10, rz: 1 });
    }
    const P = painted(X, 46, 36);
    // Their eye-holes, and the light in them coming and going.
    for (const [x, y, k] of skulls) {
      const lit = Math.floor(t * 8 + k) % 4 !== 0;
      for (const dx of [-1, 1]) P.set(x + dx, Math.round(y - br), hex(lit ? '#ff4030' : '#1a0a0a'));
      P.set(x, Math.round(y + 1 - br), hex('#3a2a20'));
    }
    P.over((x, y, c) => (hash2(x, y, 4) < 0.1 ? shade(c, 0.85) : null));
    P.done();
    return P.p;
  },
  // A great ring of alloy round its eye: plates riveted on it, its eight
  // seams lit in turn, shards wheeling round it. (The eye itself is drawn
  // over it, looking at you.)
  overseer(f) {
    const t = f / BODY_FRAMES;
    const c = 23;
    const X = new Sculpt(46, 46, { seed: 19, t });
    const shard = (i, z) => {
      const a = ((i + t) / 6) * TAU;
      const pt = (r, da) => [c + Math.cos(a + da) * r, c + Math.sin(a + da) * r];
      X.slab([pt(18.5, 0), pt(21, 0.13), pt(23, 0), pt(21, -0.13)], K.edge, 'metal', { rz: 1.4, bevel: 0.8, z });
    };
    X.in(0, 1.5);
    for (let i = 0; i < 6; i++) if (Math.sin(((i + t) / 6) * TAU) < 0) shard(i, -4);
    X.in(1, 1.2);
    X.ball(c, c, 17, 17, K.edge, 'metal', { rz: 6 });
    X.ball(c, c, 13.5, 13.5, K.plate, 'metal', { z: 3, rz: 2 });
    X.ball(c, c, 10, 10, K.dark, 'metal', { z: 4.5, rz: 1 });
    X.in(2, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      X.ball(c + Math.cos(a) * 15.2, c + Math.sin(a) * 15.2, 1, 1, '#8a88b0', 'metal', { z: 6.5, rz: 0.8 });
    }
    X.in(3, 1.5);
    for (let i = 0; i < 6; i++) if (Math.sin(((i + t) / 6) * TAU) >= 0) shard(i, 8);
    const P = painted(X, 46, 46);
    // The seams: eight, lit in turn.
    const on = Math.floor(t * 8) % 8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (let r = 11; r <= 16; r++) P.set(c + Math.cos(a) * r, c + Math.sin(a) * r, hex(i % 4 === on % 4 ? K.glow : K.seam));
    }
    P.blob(c, c, 8, 8, '#160810', { amb: 0 });
    P.blob(c, c, 6, 6, '#4a0e16', { amb: 0.2 });
    P.done();
    P.glint(c - 11, c - 11, '#e0f8ff');
    return P.p;
  },
};

// ------------------------------------------------------------ legs
// Where each foot belongs, round the body (in view tiles: `u` toward the
// way it faces, `v` toward you), where its hip is on the body (pixels from
// the anchor), its two lengths, and how it's drawn.
const RIGS = {
  brood_mother: {
    w: 46, h: 32, ax: 13, ay: 18, lift: 13, fwd: 6, L1: 21, L2: 24, stepT: 0.13, reach: 0.55, arc: 7, style: 'spider',
    legs: [[1.55, 3], [0.65, 1], [-0.35, -1], [-1.25, -3]], vFar: -0.95, vNear: 0.8, hipFar: -2, hipNear: 3,
  },
  horror: {
    w: 46, h: 36, ax: 23, ay: 22, lift: 8, fwd: 0, L1: 16, L2: 19, stepT: 0.2, reach: 0.5, arc: 5, style: 'bone', thud: true,
    legs: [[1.15, 9], [0, 0], [-1.15, -9]], vFar: -0.8, vNear: 0.65, hipFar: -3, hipNear: 6,
  },
  overseer: {
    w: 46, h: 46, ax: 23, ay: 23, lift: 36, fwd: 0, L1: 25, L2: 29, stepT: 0.22, reach: 0.6, arc: 8, style: 'mech', thud: true,
    legs: [[1.3, 11], [-1.3, -11]], vFar: -0.9, vNear: 0.8, hipFar: 2, hipNear: 12,
  },
};
export const LEGGED = new Set(Object.keys(RIGS));

// The legs' feet: planted, or partway through a step (an arc from where it
// was to where it's going). Kept on the entity, in world tiles.
function rigUpdate(r, e, rig, wp, front, dt, game) {
  const homes = [];
  rig.legs.forEach(([u], j) => {
    for (const side of [0, 1]) {
      const [dx, dz] = r.toWorld(u * front, side ? rig.vNear : rig.vFar);
      homes.push({ x: wp.x + dx, z: wp.z + dz, side, j, grp: (j + side) % 2 });
    }
  });
  let R = e.legRig;
  if (!R || R.n !== homes.length || Math.hypot(wp.x - R.x, wp.z - R.z) > 3) {
    R = e.legRig = { n: homes.length, x: wp.x, z: wp.z, still: 0, feet: homes.map((h) => ({ x: h.x, z: h.z, fx: h.x, fz: h.z, tx: h.x, tz: h.z, t: 1 })) };
  }
  const moved = Math.hypot(wp.x - R.x, wp.z - R.z);
  R.still = moved < 0.0005 ? R.still + dt : 0;
  R.x = wp.x;
  R.z = wp.z;
  const busy = [false, false];
  R.feet.forEach((f, i) => {
    if (f.t >= 1) return;
    f.t = Math.min(1, f.t + dt / rig.stepT);
    const k = ease(f.t);
    f.x = f.fx + (f.tx - f.fx) * k;
    f.z = f.fz + (f.tz - f.fz) * k;
    if (f.t >= 1 && rig.thud && !r.spin) {
      r.emit(f.x, wp.y, f.z, { n: 3, color: ['#8a8478', '#5a5650'], up: 6, speed: 12, life: 0.4, shape: 'puff' });
      if (game && (R.thudT || 0) <= 0) {
        R.thudT = 0.3;
        game.audio?.play(rig.style === 'mech' ? 'clank' : 'thud', { x: f.x, z: f.z });
      }
    }
    busy[homes[i].grp] = true;
  });
  R.thudT = (R.thudT || 0) - dt;
  R.feet.forEach((f, i) => {
    if (f.t < 1) return;
    const h = homes[i];
    if (busy[1 - h.grp]) return;
    const d = Math.hypot(f.x - h.x, f.z - h.z);
    if (d < (R.still > 0.25 ? 0.12 : rig.reach)) return;
    const over = Math.min(0.35, d * 0.45);
    f.fx = f.x;
    f.fz = f.z;
    f.tx = h.x + ((h.x - f.x) / d) * over;
    f.tz = h.z + ((h.z - f.z) / d) * over;
    f.t = 0;
    busy[h.grp] = true;
  });
  return homes;
}

// Where the knee goes: the two lengths meeting, bent upward.
function knee(hx, hy, fx, fy, L1, L2) {
  const dx = fx - hx;
  const dy = fy - hy;
  const d0 = Math.hypot(dx, dy) || 1;
  const d = Math.min(d0, L1 + L2 - 0.01);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / d0;
  const uy = dy / d0;
  const mx = hx + ux * a;
  const my = hy + uy * a;
  const k1 = [mx - uy * h, my + ux * h];
  const k2 = [mx + uy * h, my - ux * h];
  const k = k1[1] < k2[1] ? k1 : k2;
  return { kx: k[0], ky: k[1], fx: hx + ux * Math.min(d0, L1 + L2), fy: hy + uy * Math.min(d0, L1 + L2) };
}

// Its legs, each drawn whole along hip, knee and foot (see bossrig.bodyOf):
// round, lit as its body is, and each surfaced as what it is. A spider's:
// glossy chitin, banded pale at the joints, bristled. Bone: knobbed at the
// joints, cracked, a skull at each knee whose eyes come and go. The
// Overseer's: plated alloy in bands, its joints lit in pulses running down
// the leg.
const SPIDER = hex('#3e302a');
const BONE = hex('#d8d0b8');
const PLATE = hex(K.plate);
const EDGE = hex(K.edge);
const LEG = {
  spider: {
    rad: (k) => (k < 0.47 ? 2.3 - k * 1.2 : Math.max(0.7, 1.8 - (k - 0.47) * 2.1)),
    skin: (L1) => (k, u, v, ny) => {
      if (Math.abs(u - L1) < 1.4 || u < 1.5) return mix(SPIDER, [140, 110, 90], 0.45);
      if (hash2(Math.floor(u), Math.floor((v + 1) * 2), 9) > 0.86) return mix(SPIDER, [120, 96, 80], 0.6);
      return ny > 0.5 ? shade(SPIDER, 0.8) : SPIDER;
    },
    gloss: 0.6,
  },
  bone: {
    rad: (k, L1, len) => {
      const knob = (u) => Math.max(0, 1 - Math.abs(k * len - u) / 2);
      return 1.3 + 1.1 * Math.max(knob(0), knob(L1)) - k * 0.4;
    },
    skin: () => (k, u, v) => (hash2(Math.floor(u / 2), Math.floor((v + 1) * 3), 5) > 0.9 ? shade(BONE, 0.7) : BONE),
    gloss: 0.15,
  },
  mech: {
    rad: (k) => (k < 0.47 ? 3 - k : Math.max(1, 2.4 - (k - 0.47) * 2.6)),
    skin: () => (k, u) => {
      const m = u % 5;
      return m < 0.8 ? shade(PLATE, 0.6) : m < 1.6 ? EDGE : PLATE;
    },
    gloss: 0.7,
  },
};
const SKULL = new Part(() => {
  const X = new Sculpt(9, 9, { seed: 5 });
  X.ball(4.5, 4, 3.4, 3.1, '#e8e0c8', 'bone', { rz: 2.8 });
  X.ball(4.5, 6.4, 2.2, 1.4, '#d8d0b8', 'bone', { z: 1.4, rz: 1 });
  return X.render({ outline: false });
}, 4.5, 4.5);
function drawLeg(ctx, style, hx, hy, fx, fy, rig, time, i, tint, cache, faceR) {
  const { kx, ky, fx: ex, fy: ey } = knee(hx, hy, fx, fy, rig.L1, rig.L2);
  const L = LEG[style === 'spider' ? 'spider' : style === 'bone' ? 'bone' : 'mech'];
  const len = rig.L1 + rig.L2;
  const b = bodyOf([{ x: hx, y: hy }, { x: kx, y: ky }, { x: ex, y: ey }], { rad: (k) => L.rad(k, rig.L1, len), skin: L.skin(rig.L1), gloss: L.gloss, flip: faceR }, cache);
  drawBody(ctx, b.back);
  if (style === 'bone') {
    // A skull at the knee, its eyes coming and going; fingers of bone.
    SKULL.draw(ctx, kx, ky, 0);
    ctx.fillStyle = (Math.floor(time * 3) + i) % 5 === 0 ? '#ffffff' : '#ff4030';
    ctx.fillRect(Math.round(kx) - 2, Math.round(ky) - 1, 1, 1);
    ctx.fillRect(Math.round(kx) + 1, Math.round(ky) - 1, 1, 1);
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(Math.round(ex) - 2, Math.round(ey), 1, 1);
    ctx.fillRect(Math.round(ex) + 2, Math.round(ey), 1, 1);
  } else if (style === 'mech') {
    // Its joints lit, in pulses running down the leg.
    const on = 0.5 + 0.5 * Math.sin(time * 6 - i);
    for (const [x, y, r] of [[kx, ky, 2], [hx, hy, 1]]) {
      ctx.fillStyle = OUT;
      ctx.fillRect(Math.round(x) - r - 1, Math.round(y) - r, r * 2 + 3, r * 2 + 1);
      ctx.fillRect(Math.round(x) - r, Math.round(y) - r - 1, r * 2 + 1, r * 2 + 3);
      ctx.fillStyle = on > 0.6 && r > 1 ? K.glow : tint;
      ctx.fillRect(Math.round(x) - r, Math.round(y) - r + 1, r * 2 + 1, r * 2 - 1);
      ctx.fillRect(Math.round(x) - r + 1, Math.round(y) - r, r * 2 - 1, r * 2 + 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  } else {
    ctx.fillStyle = '#120c0a';
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
}

// ------------------------------------------------------------ the body
// A creature master's body and legs. Returns false when it isn't one drawn
// here (it's left to the ordinary way).
// A scratch layer for a legged master drawn under a filter (struck white,
// or coming apart): the hundreds of little strokes its legs are drawn in
// would each pay for the filter (enough to stall the game every time you
// hit the Overseer); drawn plain on here instead, and this drawn filtered,
// once.
const LAYER_W = 240;
const LAYER_H = 240;
let layer = null;
function scratch() {
  if (!layer) {
    const c = document.createElement('canvas');
    c.width = LAYER_W;
    c.height = LAYER_H;
    layer = c.getContext('2d');
    layer.imageSmoothingEnabled = false;
  }
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.globalAlpha = 1;
  layer.filter = 'none';
  layer.clearRect(0, 0, LAYER_W, LAYER_H);
  return layer;
}

export function drawBossBody(r, dest, e, sx, feetY, game, sheetOf) {
  if (e.burrowed) return true;
  let ctx = dest;
  const tint = bossTint(e);
  const dt = r.frameDt || 0.016;
  const vd = r.viewDir(e.dir);
  if (vd === 1) e.faceR = false;
  else if (vd === 3) e.faceR = true;
  const front = e.faceR ? 1 : -1;
  const lu = r.bodyLunge(e, vd);
  const rig = RIGS[e.species];
  const cx = sx + 8 + lu.x;
  const flash = e.flash > 0;
  if (!rig) {
    // The rest (the Worm, a prime golem): their sheet, half as big again,
    // breathing, rimmed in their light.
    const sheet = sheetOf(e);
    const sz = sheet.height;
    const frames = sheet.width / (sz * 2);
    const f = e.moving || e.S.floats || e.S.anim ? Math.floor(r.time * 6) % frames : 0;
    const flip = e.faceR ? frames : 0;
    const s = bossScale(e, r.time);
    const w = Math.round(sz * s.x);
    const h = Math.round(sz * s.y);
    const x = Math.round(cx - w / 2);
    const y = Math.round(feetY + 1 - h + lu.y + (e.rise || 0));
    ctx.drawImage(sheet, (f + flip) * sz, 0, sz, sz, x, y, w, h);
    rim(ctx, e, sheet, (f + flip) * sz, 0, sz, sz, x, y, w, h, tint, r.time, flash);
    return true;
  }
  const filt = typeof dest.filter === 'string' && dest.filter !== 'none' ? dest.filter : null;
  const lx = Math.round(cx - LAYER_W / 2);
  const ly = Math.round(feetY - LAYER_H + 60);
  if (filt) {
    ctx = scratch();
    ctx.setTransform(1, 0, 0, 1, -lx, -ly);
  }
  const wp = e.renderPos();
  const homes = rigUpdate(r, e, rig, wp, front, dt, game);
  // (Twenty-four frames of breath at twelve a second: quicker, the worse
  // it's hurt.)
  const fb = Math.floor(r.time * (e.hp < e.maxHp * 0.35 ? 18 : 12) + (e.id || 0) * 5) % BODY_FRAMES;
  const img = body(e.species, fb, r.time);
  const bob = e.species === 'overseer' ? Math.sin(r.time * 2.2 + (e.id || 0)) * 2 : Math.sin(r.time * 3 + (e.id || 0)) * 0.6;
  const ax = Math.round(cx + front * rig.fwd);
  const ay = Math.round(feetY - rig.lift + bob + lu.y + (e.rise || 0));
  const hip = (j, side) => ({ x: ax + front * rig.legs[j][1], y: ay + (side ? rig.hipNear : rig.hipFar) });
  const foot = (i) => {
    const f = e.legRig.feet[i];
    const [u, v] = r.toView(f.x, f.z);
    const lift = f.t < 1 ? Math.sin(Math.PI * f.t) * rig.arc : 0;
    return { x: u * TILE - r.camX + 8, y: v * TILE - wp.y * LH + LH - r.camY + 10 - lift };
  };
  const legs = (side) => {
    homes.forEach((h, i) => {
      if (h.side !== side) return;
      const a = hip(h.j, side);
      const b = foot(i);
      drawLeg(ctx, rig.style, a.x, a.y, b.x, b.y, rig, r.time, i, tint[0], ((e.legCv ||= [])[i] ||= {}), front > 0);
    });
  };
  // The far legs, the body, the near legs.
  legs(0);
  const bx = ax - (front < 0 ? rig.ax : rig.w - rig.ax);
  const by = ay - rig.ay;
  if (front > 0) {
    ctx.save();
    ctx.translate(bx + rig.w, by);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    rim(ctx, e, img, 0, 0, rig.w, rig.h, 0, 0, rig.w, rig.h, tint, r.time, flash);
    ctx.restore();
  } else {
    ctx.drawImage(img, bx, by);
    rim(ctx, e, img, 0, 0, rig.w, rig.h, bx, by, rig.w, rig.h, tint, r.time, flash);
  }
  // The Overseer's eye, turned on you.
  if (e.species === 'overseer') {
    const p = game && game.player;
    let ox = 0;
    let oy = 0;
    if (p) {
      const pp = p.renderPos();
      const [pu, pv] = r.toView(pp.x, pp.z);
      const [eu, ev] = r.toView(wp.x, wp.z);
      const d = Math.hypot(pu - eu, pv - ev) || 1;
      ox = Math.round(((pu - eu) / d) * 2);
      oy = Math.round(((pv - ev) / d) * 2);
    }
    const ex = ax + ox;
    const ey = ay + oy;
    const hot = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
    ctx.fillStyle = '#c81a28';
    ctx.fillRect(ex - 2, ey - 3, 5, 7);
    ctx.fillRect(ex - 3, ey - 2, 7, 5);
    ctx.fillStyle = hot > 0.6 && Math.floor(r.time * 14) % 2 ? '#ffffff' : '#ff4050';
    ctx.fillRect(ex - 1, ey - 2, 3, 5);
    ctx.fillRect(ex - 2, ey - 1, 5, 3);
    ctx.fillStyle = '#ffe0e0';
    ctx.fillRect(ex - 1, ey - 1, 1, 1);
  }
  legs(1);
  if (filt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    dest.drawImage(ctx.canvas, lx, ly);
  }
  return true;
}

// Its edge lit in its colour (brighter as a blow comes, and white-hot
// as it's struck).
export function rim(ctx, e, src, fx, fy, w, h, x, y, dw, dh, tint, time, flash) {
  const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * Math.min(1, 0.35 + 0.2 * Math.sin(time * 3 + (e.id || 0)) + wind * 0.5 + (flash ? 0.4 : 0));
  const g = frameGlow(src, fx, fy, w, h, wind > 0.6 && Math.floor(time * 12) % 2 ? '#ffffff' : tint[0]);
  const kx = dw / w;
  const ky = dh / h;
  ctx.drawImage(g, x - kx, y - ky, (w + 2) * kx, (h + 2) * ky);
  ctx.globalAlpha = a;
}
// (One frame of a legged master's body, unrigged: for the tests.)
export const rigBody = (kind, f) => BODY[kind](f);
export const LEG_STYLES = LEG;
