// The masters of the old places, drawn as they deserve (see
// Renderer.drawEntity): half as big again as anything else down there,
// breathing, their own colour pooled on the floor round them with a ring
// of signs turning in it, motes coming off them (and more, and redder, as
// they're worn down); and three of them, the Brood Mother, the Ossuary
// Horror and the Overseer, walking on legs of their own, each foot planted
// where it falls and stepping on only when the body's gone on too far from
// it, half the legs at a time.
import { Px, hex, shade } from './pixel.js';
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
// (The Hollow Saint's images are drawn just as she is: which is she?)
export function drawnAsMaster(e) {
  return !!(e.S && (e.S.boss || e.species === 'saint_shade') && (e.kind === 'creature' || e.kind === 'monster'));
}
export function bossTint(c) {
  return TINTS[c.species] || ['#ffe070', '#ffffff'];
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
// Drawn facing left (turned for right), bigger and finer than the old
// sheets, four frames of breath.
const bodies = new Map();
function body(kind, f) {
  const k = `${kind}:${f}`;
  let c = bodies.get(k);
  if (!c) bodies.set(k, (c = toCanvas(BODY[kind](f))));
  return c;
}

const BODY = {
  // A bloated, banded abdomen marked with a red hourglass, a head bristling
  // with eyes, fangs working.
  brood_mother(f) {
    const p = new Px(46, 32);
    const body = hex('#4a3a34');
    const hi = hex('#6e5648');
    const dk = hex('#2a201c');
    const br = f === 1 || f === 2 ? 1 : 0;
    p.ellipse(30, 15, 14 + br * 0.5, 11 + br * 0.5, body);
    p.ellipse(30, 11, 11, 6, hi);
    p.ellipse(31, 9, 6, 2, shade(hi, 1.2));
    for (let k = 0; k < 4; k++) for (let y = 6; y < 25; y++) p.set(21 + k * 5 + Math.round(Math.abs(y - 15) * 0.35), y, shade(body, 0.78));
    const red = f % 2 ? '#ff4030' : '#d82a20';
    for (const [x0, x1, y] of [[27, 33, 12], [28, 32, 13], [29, 31, 14], [30, 30, 15], [29, 31, 16], [28, 32, 17], [27, 33, 18]]) p.hline(x0, x1, y, red);
    for (let i = 0; i < 18; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      p.set(30 + Math.cos(a) * 14.5, 15 + Math.sin(a) * 11.5, shade(hi, 1.3));
    }
    p.rect(43, 14, 2, 3, dk);
    // The head.
    p.ellipse(13, 18, 9, 7, shade(body, 1.08));
    p.ellipse(12, 15, 6, 3, hi);
    const eye = f % 2 ? '#ff5040' : '#ff2414';
    for (const [x, y] of [[7, 14], [9, 13], [11, 13], [13, 14], [8, 16], [10, 15], [12, 16]]) p.set(x, y, eye);
    p.rect(5, 15, 2, 2, eye);
    p.set(5, 15, '#ffd8c8');
    p.set(9, 13, '#ffd0c0');
    // Fangs, working.
    const open = f === 1 || f === 2 ? 1 : 0;
    p.line(6, 21, 4 - open, 26, '#e8e0c8');
    p.line(9, 22, 8 + open, 27, '#e8e0c8');
    p.line(4, 20, 2, 23, dk);
    p.line(11, 22, 13, 25, dk);
    return p.outline(OUT);
  },
  // A heap of the dead, ribs over a core of red light, skulls whose eyes
  // come and go.
  horror(f) {
    const p = new Px(46, 36);
    const bone = hex('#d8d0b8');
    const dark = hex('#8a8270');
    const deep = hex('#4a4438');
    const br = f === 1 || f === 2 ? 1 : 0;
    p.ellipse(23, 23 - br, 19, 12, deep);
    p.ellipse(23, 21 - br, 17, 10, dark);
    const core = ['#ff4030', '#ff6040', '#ff8a50', '#ff6040'][f];
    p.ellipse(23, 21 - br, 7, 5, hex('#3a0808'));
    p.ellipse(23, 21 - br, 4 + br, 3, core);
    p.set(22, 20 - br, '#ffd8a8');
    for (let i = 0; i < 52; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 4 + ((i * 7) % 14);
      const x = 23 + Math.cos(a) * r * 1.15;
      const y = 22 - br + Math.sin(a) * r * 0.62;
      if (Math.abs(x - 23) < 7 && Math.abs(y - 21 + br) < 5) continue;
      p.line(x, y, x + (i % 2 ? 2 : -2), y + (i % 3 ? 1 : -1), i % 3 ? bone : shade(bone, 0.8));
    }
    for (let k = -2; k <= 2; k++) {
      for (let y = -5; y <= 5; y++) p.set(23 + k * 3 + Math.round((y * y) / 12) * Math.sign(k || 1), 21 - br + y, k === 0 ? shade(bone, 0.9) : bone);
    }
    for (const [x, y, k] of [[8, 15, 0], [16, 10, 1], [28, 10, 2], [36, 15, 3], [13, 26, 4], [31, 26, 5]]) {
      p.rect(x, y - br, 5, 4, bone);
      p.hline(x + 1, x + 3, y + 4 - br, bone);
      const e = (f + k) % 4 === 0 ? '#ffffff' : '#ff4030';
      p.set(x + 1, y + 1 - br, e);
      p.set(x + 3, y + 1 - br, e);
      p.set(x + 2, y + 3 - br, deep);
    }
    return p.outline(OUT);
  },
  // A great ring of alloy round its eye, seams lit in turn, shards
  // circling it. (The eye itself is drawn over it, looking at you.)
  overseer(f) {
    const p = new Px(46, 46);
    const c = 23;
    p.ellipse(c, c, 17, 17, hex(K.plate));
    p.ellipse(c, c, 15, 15, hex(K.edge));
    p.ellipse(c, c, 14, 14, hex(K.plate));
    p.ellipse(c, c, 10, 10, hex(K.dark));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (let r = 11; r <= 16; r++) p.set(c + Math.cos(a) * r, c + Math.sin(a) * r, i % 4 === f % 4 ? K.glow : K.seam);
    }
    p.ellipse(c, c, 8, 8, hex('#160810'));
    p.ellipse(c, c, 6, 6, hex('#4a0e16'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + f * 0.26;
      const x = c + Math.cos(a) * 20.5;
      const y = c + Math.sin(a) * 20.5;
      p.rect(x - 1, y - 1, 3, 3, hex(K.edge));
      p.set(x, y, hex(K.seam));
    }
    p.hline(c - 3, c + 3, c + 17, hex(K.seam));
    return p.outline(OUT);
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

// A thick pixel line (a square stamped along it), `w0` wide at its start
// tapering to `w1`.
function seg(ctx, x0, y0, x1, y1, w0, w1, col) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const w = Math.max(1, Math.round(w0 + (w1 - w0) * k));
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k - w / 2), Math.round(y0 + (y1 - y0) * k - w / 2), w, w);
  }
}

function drawLeg(ctx, style, hx, hy, fx, fy, rig, time, i, tint) {
  const { kx, ky, fx: ex, fy: ey } = knee(hx, hy, fx, fy, rig.L1, rig.L2);
  if (style === 'spider') {
    seg(ctx, hx, hy, kx, ky, 5, 4, OUT);
    seg(ctx, kx, ky, ex, ey, 4, 2, OUT);
    seg(ctx, hx, hy, kx, ky, 3, 2, '#3e302a');
    seg(ctx, kx, ky, ex, ey, 2, 1, '#2a201c');
    seg(ctx, hx, hy - 1, kx, ky - 1, 1, 1, '#6e5648');
    ctx.fillStyle = '#6e5648';
    ctx.fillRect(Math.round(kx) - 1, Math.round(ky) - 1, 2, 2);
    // Bristles along the shin.
    ctx.fillStyle = '#5a4840';
    for (let k = 0.2; k < 0.9; k += 0.18) ctx.fillRect(Math.round(kx + (ex - kx) * k) + 1, Math.round(ky + (ey - ky) * k), 1, 1);
    ctx.fillStyle = '#120c0a';
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  } else if (style === 'bone') {
    seg(ctx, hx, hy, kx, ky, 4, 4, OUT);
    seg(ctx, kx, ky, ex, ey, 4, 3, OUT);
    seg(ctx, hx, hy, kx, ky, 2, 2, '#d8d0b8');
    seg(ctx, kx, ky, ex, ey, 2, 1, '#c8c0a8');
    // A skull at the knee, and fingers of bone at the foot.
    ctx.fillStyle = OUT;
    ctx.fillRect(Math.round(kx) - 3, Math.round(ky) - 3, 6, 6);
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(Math.round(kx) - 2, Math.round(ky) - 2, 4, 4);
    ctx.fillStyle = (Math.floor(time * 3) + i) % 5 === 0 ? '#ffffff' : '#ff4030';
    ctx.fillRect(Math.round(kx) - 1, Math.round(ky) - 1, 1, 1);
    ctx.fillRect(Math.round(kx) + 1, Math.round(ky) - 1, 1, 1);
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(Math.round(ex) - 2, Math.round(ey), 1, 1);
    ctx.fillRect(Math.round(ex) + 2, Math.round(ey), 1, 1);
  } else {
    seg(ctx, hx, hy, kx, ky, 6, 5, OUT);
    seg(ctx, kx, ky, ex, ey, 5, 2, OUT);
    seg(ctx, hx, hy, kx, ky, 4, 3, K.plate);
    seg(ctx, hx, hy - 1, kx, ky - 1, 1, 1, K.edge);
    seg(ctx, kx, ky, ex, ey, 3, 1, '#22203a');
    seg(ctx, kx, ky, ex, ey, 1, 1, K.edge);
    // Joints lit, in pulses running down the leg.
    const on = 0.5 + 0.5 * Math.sin(time * 6 - i);
    ctx.fillStyle = OUT;
    ctx.fillRect(Math.round(kx) - 2, Math.round(ky) - 2, 5, 5);
    ctx.fillStyle = on > 0.6 ? K.glow : tint;
    ctx.fillRect(Math.round(kx) - 1, Math.round(ky) - 1, 3, 3);
    ctx.fillStyle = tint;
    ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
}

// ------------------------------------------------------------ the body
// A creature master's body and legs. Returns false when it isn't one drawn
// here (it's left to the ordinary way).
export function drawBossBody(r, ctx, e, sx, feetY, game, sheetOf) {
  if (e.burrowed) return true;
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
  const wp = e.renderPos();
  const homes = rigUpdate(r, e, rig, wp, front, dt, game);
  const fb = Math.floor(r.time * (e.hp < e.maxHp * 0.35 ? 9 : 5) + (e.id || 0)) % 4;
  const img = body(e.species, fb);
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
      drawLeg(ctx, rig.style, a.x, a.y, b.x, b.y, rig, r.time, i, tint[0]);
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
  return true;
}

// Its edge lit in its colour (brighter as a blow comes, and white-hot
// as it's struck).
function rim(ctx, e, src, fx, fy, w, h, x, y, dw, dh, tint, time, flash) {
  const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * Math.min(1, 0.35 + 0.2 * Math.sin(time * 3 + (e.id || 0)) + wind * 0.5 + (flash ? 0.4 : 0));
  const g = frameGlow(src, fx, fy, w, h, wind > 0.6 && Math.floor(time * 12) % 2 ? '#ffffff' : tint[0]);
  const kx = dw / w;
  const ky = dh / h;
  ctx.drawImage(g, x - kx, y - ky, (w + 2) * kx, (h + 2) * ky);
  ctx.globalAlpha = a;
}
