// Rafts: a few logs lashed together, launched from the shore onto open
// water. Tank controls: A and D turn it, W paddles forward (it picks up speed
// gradually and drifts to a stop), S back-paddles. The raft moves smoothly
// rather than tile by tile; the rider sits on top.
import { SURFACE, GROUND } from '../config.js';
import { B, BLOCKS } from '../world/blocks.js';
import { has as heroHas } from '../game/hero.js';

// How deep into the storm round the islands a raft (or a swimmer) gets
// before it's thrown back (see geography.js stormAt).
export const STORM_WALL = 0.2;

export const RAFT = {
  accel: 2.1, // tiles/s² while paddling
  max: 5, // tiles/s
  back: 1.1, // top speed backwards
  turn: 1.9, // rad/s
  drag: 0.7, // speed lost per second when not paddling (fraction)
};

// Open water a raft can float on (not under a bridge or a boat).
export function floatable(world, x, z) {
  // (Lily pads and the like just get pushed aside.)
  const above = world.getBlock(x, GROUND, z);
  return world.isWaterAt(x, SURFACE, z) && (above === B.air || !BLOCKS[above].solid);
}

// Unit vector the raft points along (angle 0 = down the screen, +z).
export function heading(ang) {
  return { x: Math.sin(ang), z: Math.cos(ang) };
}

// Facing (0 down, 1 left, 2 up, 3 right) nearest a heading.
export function dirOf(ang) {
  const f = heading(ang);
  if (Math.abs(f.x) > Math.abs(f.z)) return f.x < 0 ? 1 : 3;
  return f.z < 0 ? 2 : 0;
}

// Put the player on a raft on the water tile (x, z).
export function launch(game, x, z) {
  const p = game.player;
  if (!floatable(game.world, x, z)) return false;
  const dx = x - p.x;
  const dz = z - p.z;
  const ang = dx || dz ? Math.atan2(dx, dz) : 0;
  p.raft = { x, z, ang, v: 0 };
  p.sitting = null;
  // You sit on top of the water, not in it.
  p.teleport(x, GROUND, z);
  p.inWater = false;
  p.dir = dirOf(ang);
  return true;
}

// Paddle about for a frame.
export function steer(p, dt, input) {
  const r = p.raft;
  const w = p.game.world;
  const down = (...ks) => ks.some((k) => input.isDown(k));
  const fwd = down('KeyW', 'ArrowUp');
  const backK = down('KeyS', 'ArrowDown');
  const left = down('KeyA', 'ArrowLeft');
  const right = down('KeyD', 'ArrowRight');
  // Turning: a little slower at full tilt.
  // (A sailor gets more out of each stroke.)
  const sail = p.kind === 'player' && heroHas(p.game.hero, 'sailor') ? 1.35 : 1;
  const turn = RAFT.turn * sail * (1 - Math.min(0.4, Math.abs(r.v) / (RAFT.max * sail) * 0.4));
  if (left) r.ang += turn * dt;
  if (right) r.ang -= turn * dt;
  r.ang = ((r.ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // (The storm's seas: slow, heavy going, the deeper in the worse.)
  const S = p.game.stormSea;
  const heavy = S && S.depth > 0 ? 1 - Math.min(0.45, S.depth * 0.55) : 1;
  if (fwd) r.v = Math.min(RAFT.max * sail * heavy, r.v + RAFT.accel * sail * heavy * dt);
  else if (backK) r.v = Math.max(-RAFT.back, r.v - RAFT.accel * 1.3 * dt);
  else r.v *= Math.max(0, 1 - RAFT.drag * dt);
  if (Math.abs(r.v) < 0.02 && !fwd && !backK) r.v = 0;
  r.paddle = fwd || backK || left || right ? (r.paddle || 0) + dt : 0;
  const f = heading(r.ang);
  const ok = (x, z) => floatable(w, Math.round(x), Math.round(z)) && !p.game.occupiedBySolid(Math.round(x), GROUND, Math.round(z), p);
  // Each axis on its own, so it slides along a bank instead of sticking.
  const nx = r.x + f.x * r.v * dt;
  const nz = r.z + f.z * r.v * dt;
  // The storm round the Dagoni Islands: no raft lives in that. It throws
  // anyone else back the way they came.
  // (You can try it yourself, though: see game/stormsea.js.)
  if (p.kind !== 'player' && w.ow && w.ow.stormAt(nx, nz) > STORM_WALL && w.ow.stormAt(nx, nz) >= w.ow.stormAt(r.x, r.z)) {
    r.v = r.v > 0 ? -1.6 : 1.6;
    if (p.game.stormTurnsBack) p.game.stormTurnsBack(true);
    return;
  }
  let hit = false;
  if (ok(nx, r.z)) r.x = nx;
  else hit = true;
  if (ok(r.x, nz)) r.z = nz;
  else hit = true;
  if (hit) {
    if (Math.abs(r.v) > 1.5) p.game.audio?.play('splash');
    r.v *= 0.4;
  }
  p.dir = dirOf(r.ang);
  const tx = Math.round(r.x);
  const tz = Math.round(r.z);
  if (tx !== p.x || tz !== p.z) {
    p.game.moveEntity(p, tx, GROUND, tz);
    p.fx = tx;
    p.fz = tz;
  }
  p.inWater = false;
}

// Step off onto the nearest bank (the way you're facing first). The raft
// is carried ashore with you.
export function landing(p) {
  const r = p.raft;
  const w = p.game.world;
  const f = heading(r.ang);
  const cands = [];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = Math.round(r.x) + dx;
      const z = Math.round(r.z) + dz;
      const d = Math.hypot(x - r.x, z - r.z);
      if (d > 1.8 || d < 0.5) continue;
      if (floatable(w, x, z) || w.isWaterAt(x, SURFACE, z)) continue;
      const y = w.findStandY(x, z, GROUND);
      if (y < 0 || Math.abs(y - GROUND) > 1 || w.isWaterAt(x, y, z) || !BLOCKS[w.getBlock(x, y - 1, z)].solid) continue;
      if (p.game.occupiedBySolid(x, y, z, p)) continue;
      const along = (x - r.x) * f.x + (z - r.z) * f.z;
      cands.push({ x, y, z, s: d - along * 0.6 });
    }
  }
  cands.sort((a, b) => a.s - b.s);
  return cands[0] || null;
}

// The raft's pixels, seen from above with its bow pointing down the screen:
// six logs side by side, lashed with rope, the ends a little ragged.
const W = 18;
const H = 24;
let base = null;
function basePixels() {
  if (base) return base;
  const px = new Array(W * H).fill(null);
  const logs = ['#9a6a38', '#8a5c30', '#a8743e', '#8e602f', '#9c6c3a', '#946634'];
  for (let i = 0; i < 6; i++) {
    const x0 = i * 3;
    // Uneven log ends.
    const top = [1, 0, 2, 0, 1, 2][i];
    const bot = H - 1 - [0, 2, 1, 0, 2, 1][i];
    for (let y = top; y <= bot; y++) {
      for (let dx = 0; dx < 3; dx++) {
        let c = logs[i];
        if (dx === 0) c = shade(c, 16); // lit side of the log
        if (dx === 2) c = shade(c, -26); // round of the log, in shadow
        if (y === top || y === bot) c = dx === 2 ? '#a88050' : '#c8a068'; // cut ends
        else if ((y * 7 + i * 5) % 13 === 0 && dx === 1) c = shade(logs[i], -40); // knots
        px[y * W + x0 + dx] = c;
      }
    }
  }
  // Rope lashings across, two bands.
  for (const y of [5, 18]) for (let x = 0; x < W; x++) if (px[y * W + x]) px[y * W + x] = x % 3 === 2 ? '#a89860' : '#d8c890';
  base = px;
  return px;
}

function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// The raft turned to an angle: every pixel of the result looks up the
// pixel it came from (nearest sample), so it stays crisp at any angle.
// Cached at 64 headings.
export const RAFT_STEPS = 64;
const cache = new Map();
export const RAFT_BOX = 32;
export function raftSprite(ang, makeCanvas) {
  const k = ((Math.round((ang / (Math.PI * 2)) * RAFT_STEPS) % RAFT_STEPS) + RAFT_STEPS) % RAFT_STEPS;
  if (cache.has(k)) return cache.get(k);
  const a = (k / RAFT_STEPS) * Math.PI * 2;
  const px = basePixels();
  const c = makeCanvas(RAFT_BOX, RAFT_BOX);
  const ctx = c.getContext('2d');
  const f = heading(a);
  const rgt = { x: f.z, z: -f.x };
  const half = RAFT_BOX / 2;
  for (let py = 0; py < RAFT_BOX; py++) {
    for (let pxx = 0; pxx < RAFT_BOX; pxx++) {
      const sx = pxx + 0.5 - half;
      const sz = py + 0.5 - half;
      // Where this pixel falls on the unturned raft (u across, v along).
      const u = sx * rgt.x + sz * rgt.z;
      const v = sx * f.x + sz * f.z;
      const bx = Math.floor(u + W / 2);
      const by = Math.floor(v + H / 2);
      if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
      const col = px[by * W + bx];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(pxx, py, 1, 1);
    }
  }
  cache.set(k, c);
  return c;
}
