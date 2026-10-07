// (Round 72) What's in the air over the ancient places' gates (see
// world/ancient.js, ANCIENT_GATE), drawn over the lit world, and seen from
// well off as the camera draws back (see Game.placeNearness):
//   the Athanor: the great alembic's bulb burning gold and blue over the
//     doors, smoking; the sign of the great work turning in the air before
//     them; a glow in the dome; gold dust rising;
//   the Hall of the Last Champion: shafts of pale light down onto the
//     colossus on the summit, his eyes lit; gold dust falling; the
//     candles' glow at his door;
//   the Sundered Reach: the rift itself, the void in it (stars turning in
//     the dark, violet haze), its edges seamed with white fire crawling
//     along them, lightning across it now and then, and at its heart a
//     vortex over the way down;
//   the Gullet of the World: a warm breath rising out of the throat, a
//     green light pulsing in it like a heartbeat, flies.
// Beaten, each dims: the fires out, the rift stilled.
import { TILE } from '../config.js';
import { scr } from './evolvedfx.js';
import { riftShape } from '../world/ancient.js';

const TAU = Math.PI * 2;
const hash = (x, z, k = 0) => {
  let h = (x * 374761393 + z * 668265263 + k * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function glow(ctx, x, y, rad, col, a) {
  if (rad <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.restore();
}
const onScreen = (r, p, m = 80) => p.x > -m && p.x < r.vw + m && p.y > -m && p.y < r.vh + m;

export function drawAncientGates(r, game, dt) {
  if (game.dungeon) return;
  const ctx = r.ctx;
  const p = game.player;
  for (const s of game.world.sites || []) {
    if (!s.ancient || s.x === undefined || Math.abs(s.x - p.x) > 52 || Math.abs(s.z - p.z) > 44) continue;
    const rec = game.sim.dungeons.get(s.id);
    const beaten = !!(rec && rec.cleared);
    const I = beaten ? 0.35 : 1;
    if (s.type === 'athanor') athanor(r, ctx, game, s, I, dt);
    else if (s.type === 'champion') champion(r, ctx, game, s, I, dt);
    else if (s.type === 'rift') rift(r, ctx, game, s, I, dt);
    else if (s.type === 'gullet') gullet(r, ctx, game, s, I, dt);
  }
}

// ------------------------------------------------------------ the Athanor
const ELEM_COLS = ['#ff8030', '#a0e0ff', '#c8ff40', '#fff8a0', '#e0a060', '#60c0ff', '#e0fff8', '#fff0a0', '#8a40ff', '#e0e0f0', '#fff0f8', '#e0a0ff'];
function athanor(r, ctx, game, s, I, dt) {
  const t = r.time;
  const h = s.h;
  // The bulb over the doors, and its smoke.
  const bulb = scr(r, s.x, h + 15, s.z + 3);
  if (onScreen(r, bulb)) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.1);
    glow(ctx, bulb.x, bulb.y - 6, 26 * pulse, '#ffd060', 0.55 * I);
    glow(ctx, bulb.x, bulb.y - 6, 12, '#80e8ff', 0.5 * I * (0.6 + 0.4 * Math.sin(t * 3.7)));
    if (I > 0.5 && Math.random() < dt * 7) r.emit(s.x, h + 17.5, s.z + 3, { n: 1, color: ['#c8d8d8', '#e8f0f0', '#a8b8c0'], up: 9, speed: 5, life: 2.6, shape: 'puff', gravity: -5 });
    if (I > 0.5 && Math.random() < dt * 3) r.emit(s.x, h + 15, s.z + 3, { n: 1, color: ['#ffe070', '#80e8ff'], up: 6, speed: 8, life: 1, glow: true, gravity: -4 });
  }
  // A glow in the dome, through its glass.
  const dome = scr(r, s.x, h + 8, s.z - 4);
  if (onScreen(r, dome, 160)) glow(ctx, dome.x, dome.y, 70, '#ffc850', (0.12 + 0.04 * Math.sin(t * 1.3)) * I);
  // The sign of the great work turning before the doors: a circle of the
  // twelve, a triangle in it, the square round it.
  const sign = scr(r, s.x, h + 7, s.z + 6);
  if (onScreen(r, sign) && I > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cx = sign.x;
    const cy = sign.y - 10 + Math.sin(t * 1.2) * 2;
    const R = 16;
    for (let i = 0; i < 12; i++) {
      const a = t * 0.5 + (i / 12) * TAU;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i);
      ctx.fillStyle = ELEM_COLS[i];
      ctx.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * 0.4), 2, 2);
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffe070';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.72, R * 0.72 * 0.4, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k <= 3; k++) {
      const a = -t * 0.3 + (k / 3) * TAU + Math.PI / 2;
      const x = cx + Math.cos(a) * R * 0.72;
      const y = cy + Math.sin(a) * R * 0.72 * 0.4;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    glow(ctx, cx, cy, 14, '#ffe070', 0.3);
  }
  // Gold dust rising in the precinct.
  if (Math.random() < dt * 9 * I) {
    const a = Math.random() * TAU;
    const d = Math.random() * 13;
    r.emit(s.x + Math.cos(a) * d, h + 1 + Math.random() * 2, s.z - 4 + Math.sin(a) * d * 0.9, { n: 1, color: ['#ffd070', '#ffe8a0', '#c8a0ff'], up: 5, speed: 3, gravity: -4, life: 2.6, glow: true });
  }
}

// ------------------------------------------------------------ the Champion's hall
function champion(r, ctx, game, s, I, dt) {
  const t = r.time;
  const h = s.h;
  const top = scr(r, s.x, h + 9, s.z - 7);
  if (onScreen(r, top, 200)) {
    // Shafts of light down onto the colossus.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(t * 0.4 + i * 2) * 6;
      const w = 10 + i * 6;
      const x = top.x + (i - 1) * 12 + sway;
      const g = ctx.createLinearGradient(0, -20, 0, top.y);
      g.addColorStop(0, `rgba(255,240,200,0)`);
      g.addColorStop(1, `rgba(255,240,200,${0.16 * I})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, -20);
      ctx.lineTo(x + w * 0.3, -20);
      ctx.lineTo(x + w, top.y);
      ctx.lineTo(x - w, top.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // His eyes.
    const ey = top.y - 30;
    const blink = Math.floor(t * 0.5 + 0.3) % 9 === 0;
    if (!blink && I > 0.5) {
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(top.x - 3, ey, 2, 1);
      ctx.fillRect(top.x + 2, ey, 2, 1);
      glow(ctx, top.x, ey, 10, '#ffe070', 0.4);
    }
    glow(ctx, top.x, top.y - 14, 34, '#fff0c0', 0.12 * I);
  }
  // The candles at his door.
  const door = scr(r, s.x, h + 1, s.z);
  if (onScreen(r, door)) glow(ctx, door.x, door.y - 8, 24, '#ffb860', (0.22 + 0.06 * Math.sin(t * 7)) * I);
  // Gold dust, falling slow.
  if (Math.random() < dt * 6 * I) {
    const a = Math.random() * TAU;
    const d = Math.random() * 12;
    r.emit(s.x + Math.cos(a) * d, h + 6 + Math.random() * 4, s.z - 5 + Math.sin(a) * d * 0.8, { n: 1, color: ['#ffe8a0', '#f0d080', '#ffffff'], up: -2, speed: 2, gravity: 4, life: 3.2, glow: Math.random() < 0.5 });
  }
}

// ------------------------------------------------------------ the Reach
// The rift's seams: each side of each sunk tile that meets higher ground,
// worked out once a shape.
const SEAMS = new Map();
function seamsOf(S, seed) {
  let L = SEAMS.get(seed);
  if (L) return L;
  L = [];
  for (const q of S.sunk) {
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = S.tiles.get(`${q.dx + ox},${q.dz + oz}`);
      const nd = n ? n.depth : 0;
      if (nd < q.depth) L.push({ dx: q.dx, dz: q.dz, depth: q.depth, ox, oz, step: q.depth - nd });
    }
  }
  SEAMS.set(seed, L);
  return L;
}
const VOID = ['#c8a0ff', '#5ad8f0', '#ffffff', '#8a40ff'];
function rift(r, ctx, game, s, I, dt) {
  const t = r.time;
  const h = s.h;
  const S = riftShape(s.seed);
  const seams = seamsOf(S, s.seed);
  // Which way each side of a tile faces on the screen, as the camera's
  // turned.
  const side = (ox, oz) => {
    const [u0, v0] = r.toView(0, 0);
    const [u1, v1] = r.toView(ox, oz);
    return [u1 - u0, v1 - v0];
  };
  const sides = { '1,0': side(1, 0), '-1,0': side(-1, 0), '0,1': side(0, 1), '0,-1': side(0, -1) };
  // The dark in it first (the void's deeper than any floor), then what
  // moves in it: stars turning slow, a haze of violet breathing.
  ctx.save();
  for (const q of S.sunk) {
    const P = scr(r, s.x + q.dx, h - q.depth + 1, s.z + q.dz);
    if (!onScreen(r, P, 24)) continue;
    ctx.globalAlpha = (q.depth === 2 ? 0.55 : 0.4) * I;
    ctx.fillStyle = '#04010a';
    ctx.fillRect(P.x - 8, P.y, TILE, TILE);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const q of S.sunk) {
    const P = scr(r, s.x + q.dx, h - q.depth + 1, s.z + q.dz);
    if (!onScreen(r, P, 24)) continue;
    const x0 = P.x - 8;
    const y0 = P.y;
    const breath = 0.5 + 0.5 * Math.sin(t * 1.1 + q.dx * 0.35 - q.dz * 0.25);
    ctx.globalAlpha = (q.depth === 2 ? 0.14 : 0.08) * I * breath;
    ctx.fillStyle = '#5a20b0';
    ctx.fillRect(x0, y0, TILE, TILE);
    const n = q.depth === 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = t * (0.15 + 0.1 * hash(q.dx, q.dz, i)) + hash(q.dx, q.dz, i + 7) * TAU;
      const rr = 3 + hash(q.dx, q.dz, i + 3) * 5;
      const sx = Math.round(P.x + Math.cos(a) * rr);
      const sy = Math.round(y0 + 8 + Math.sin(a) * rr * 0.7);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + hash(q.dx, q.dz, i + 11) * 9));
      ctx.globalAlpha = tw * I;
      ctx.fillStyle = VOID[(i + q.dx + q.dz + 400) % 3];
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  // Its seams: white fire crawling along the edges, violet under it.
  for (const q of seams) {
    const P = scr(r, s.x + q.dx, h - q.depth + 1, s.z + q.dz);
    if (!onScreen(r, P, 24)) continue;
    const [du, dv] = sides[`${q.ox},${q.oz}`];
    const x0 = P.x - 8;
    const y0 = P.y;
    const crawl = 0.5 + 0.5 * Math.sin(t * 4 - (q.dx * 0.7 + q.dz * 0.5) + hash(q.dx, q.dz, 5) * 3);
    const flick = hash(Math.floor(t * 12) + q.dx * 7, q.dz, 9) > 0.15;
    const a = (q.step === 2 ? 0.9 : 0.6) * I;
    const col = flick && crawl > 0.75 ? '#ffffff' : crawl > 0.4 ? '#c8a0ff' : '#5ad8f0';
    ctx.fillStyle = col;
    ctx.globalAlpha = a * (0.5 + 0.5 * crawl);
    if (du === 1) ctx.fillRect(x0 + TILE - 1, y0, 1, TILE);
    else if (du === -1) ctx.fillRect(x0, y0, 1, TILE);
    else if (dv === 1) ctx.fillRect(x0, y0 + TILE - 1, TILE, 1);
    else ctx.fillRect(x0, y0, TILE, 1);
    // (The lip of the rift above it, lit from below.)
    ctx.globalAlpha = a * 0.35 * crawl;
    ctx.fillStyle = '#8a40ff';
    if (du === 1) ctx.fillRect(x0 + TILE - 3, y0, 3, TILE);
    else if (du === -1) ctx.fillRect(x0, y0, 3, TILE);
    else if (dv === 1) ctx.fillRect(x0, y0 + TILE - 3, TILE, 3);
    else ctx.fillRect(x0, y0, TILE, 3);
  }
  ctx.restore();
  // The cracks in the ground round it, running out from the seam: dark
  // lines, and the void's light pulsing out along them from the rift.
  const G = scr(r, s.x, h + 1, s.z);
  if (onScreen(r, G, 420)) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of S.fissures) {
      const pts = f.pts.map((q) => {
        const P = scr(r, s.x + q.x, h + 1, s.z + q.z);
        return [P.x, P.y + 8];
      });
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#06030c';
      ctx.lineWidth = f.w;
      ctx.stroke();
      // The light down the crack: brightest nearest the rift, a pulse
      // travelling out along it.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 - k * 7 + f.phase);
        ctx.globalAlpha = (0.14 + 0.5 * (1 - k) * pulse) * I;
        ctx.strokeStyle = pulse > 0.85 && k < 0.5 ? '#ffffff' : k < 0.4 ? '#c8a0ff' : '#8a40ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
        ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
    // (Embers of the void off the cracks.)
    if (Math.random() < dt * 5 * I) {
      const f = S.fissures[Math.floor(Math.random() * S.fissures.length)];
      const q = f.pts[Math.floor(Math.random() * f.pts.length)];
      r.emit(s.x + q.x, h + 1, s.z + q.z, { n: 1, color: ['#c8a0ff', '#8a40ff', '#ffffff'], up: 5, speed: 2, gravity: -3, life: 1.4, glow: true });
    }
  }
  // The vortex over the way down.
  const C = scr(r, s.x, h - 1, s.z);
  if (onScreen(r, C, 60)) {
    glow(ctx, C.x, C.y + 8, 34, '#8a40ff', 0.5 * I);
    glow(ctx, C.x, C.y + 8, 14, '#5ad8f0', 0.4 * I);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const a0 = t * (1.2 + k * 0.35) + k * 2.1;
      const rr = 8 + k * 7;
      ctx.strokeStyle = k % 2 ? '#c8a0ff' : '#5ad8f0';
      ctx.globalAlpha = (0.55 - k * 0.1) * I;
      ctx.lineWidth = 2 - k * 0.35;
      ctx.beginPath();
      ctx.ellipse(C.x, C.y + 8, rr, rr * 0.45, 0, a0, a0 + 2.2);
      ctx.stroke();
    }
    ctx.restore();
    // Its dark core.
    ctx.save();
    ctx.globalAlpha = 0.7 * I;
    ctx.fillStyle = '#05010a';
    ctx.beginPath();
    ctx.ellipse(C.x, C.y + 8, 6 + Math.sin(t * 5), 2.8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // Lightning across it, now and then; motes rising out of it.
  r.riftBoltT = (r.riftBoltT || 0) - dt;
  if (r.riftBoltT <= 0 && I > 0.5 && seams.length > 8) {
    r.riftBoltT = 1.4 + Math.random() * 2.6;
    const a = seams[Math.floor(Math.random() * seams.length)];
    const b = seams[Math.floor(Math.random() * seams.length)];
    if (Math.hypot(a.dx - b.dx, a.dz - b.dz) > 4 && r.effect) {
      r.effect({ type: 'bolt', wx: s.x + a.dx, wy: h, wz: s.z + a.dz, tx: s.x + b.dx, ty: h, tz: s.z + b.dz, life: 0.3, oy: -4 });
      game.audio?.play('void', { x: s.x + a.dx, z: s.z + a.dz });
    }
  }
  if (Math.random() < dt * 14 * I) {
    const q = S.sunk[Math.floor(Math.random() * S.sunk.length)];
    r.emit(s.x + q.dx, h - q.depth + 1, s.z + q.dz, { n: 1, color: VOID, up: 12, speed: 4, gravity: -10, life: 1.6, glow: true });
  }
  // (Down in it: the dark on everything.)
  const p = game.player;
  const inIt = S.tiles.get(`${p.x - s.x},${p.z - s.z}`);
  if (inIt && inIt.depth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.08 * I;
    ctx.fillStyle = '#4a10a0';
    ctx.fillRect(0, 0, r.vw, r.vh);
    ctx.restore();
  }
}

// ------------------------------------------------------------ the Gullet
function gullet(r, ctx, game, s, I, dt) {
  const t = r.time;
  const h = s.h;
  const mouth = scr(r, s.x, h - 2, s.z - 5);
  // A heartbeat of green light in the throat.
  const beat = Math.max(0, Math.sin(t * 2.2)) ** 6 + 0.5 * Math.max(0, Math.sin(t * 2.2 + 0.9)) ** 8;
  if (onScreen(r, mouth, 120)) {
    glow(ctx, mouth.x, mouth.y - 6, 40 + beat * 20, '#9ad050', (0.18 + 0.25 * beat) * I);
    glow(ctx, mouth.x, mouth.y - 4, 12, '#e0ff90', (0.3 + 0.4 * beat) * I);
  }
  // Its breath, up out of the throat; flies over the bones.
  if (Math.random() < dt * 10 * I) {
    const a = Math.random() * TAU;
    const d = Math.random() * 4;
    r.emit(s.x + Math.cos(a) * d, h - 2, s.z - 3 + Math.sin(a) * d * 0.8, { n: 1, color: ['#8a7a5a', '#a89878', '#c8d890'], up: 7, speed: 3, gravity: -3, life: 2.8, shape: 'puff' });
  }
  if (Math.random() < dt * 5 * I) {
    const a = Math.random() * TAU;
    const d = 4 + Math.random() * 9;
    r.emit(s.x + Math.cos(a) * d, h + Math.random() * 2, s.z - 3 + Math.sin(a) * d * 0.8, { n: 1, color: ['#2a2a20', '#4a4a30'], up: 2, speed: 14, gravity: 0, life: 1.2 });
  }
}
