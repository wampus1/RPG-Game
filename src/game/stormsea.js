// The storm round the Dagoni Islands, from a raft. No raft lives in it, but
// you can try: coming up to it the sky darkens and black cloud gathers
// overhead; in under it, the dark closes in till it's pitch black, only a
// torch holding a little of it off, and every flash of lightning shows the
// wrecks of the ships that tried before you (a hull's ribs out of the
// water, a mast, barrels bobbing, planks). Further in, the dark turns red;
// the sea goes red and boils; the lightning comes down all round you,
// nearer and nearer, till it finds the raft. White, then black; and you
// come to on a beach, the raft gone. (See render/stormfx.js for how it
// looks, render/lighting.js for the dark, and music.js for the sound.)
import { STORM } from '../world/geography.js';
import { REGION_W, REGION_D, GROUND } from '../config.js';
import { teleportTo } from './commands.js';

// How deep in (the storm's strength where you are, 0 at its edge to 1 in
// the thick of it) each part of it starts.
export const STORM_STAGES = { dark: 0.32, red: 0.62, strike: 0.86 };

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function stormState(game) {
  return game.stormSea || (game.stormSea = { depth: 0, near: 0, dark: 0, red: 0, cloud: 0, flash: 0, boltT: 3, redT: 0, phase: null, t: 0 });
}

// Each frame.
export function updateStormSea(game, dt) {
  const S = stormState(game);
  S.flash = Math.max(0, S.flash - dt * 3.2);
  if (S.phase) return runEnding(game, S, dt);
  const p = game.player;
  const ow = game.world && game.world.ow;
  if (!p || !ow || !ow.stormAt || game.dungeon || game.cutscene) {
    S.depth = S.near = S.dark = S.red = S.cloud = 0;
    return;
  }
  const raw = ow.stormAt(p.x, p.z);
  const near = ow.stormNear ? ow.stormNear(p.x, p.z) : 0;
  // (Eased, so it closes in rather than snapping.)
  S.depth += (raw - S.depth) * Math.min(1, dt * 1.5);
  S.near += (near - S.near) * Math.min(1, dt * 1.5);
  S.dark = smooth(0.04, STORM_STAGES.dark, S.depth);
  S.red = smooth(STORM_STAGES.red - 0.04, STORM_STAGES.red + 0.14, S.depth);
  S.cloud = Math.max(smooth(0.05, 0.9, S.near), S.dark);
  if (S.depth < 0.02 && S.near < 0.05) {
    S.redT = 0;
    return;
  }
  // Lightning: now and then far off; deep in, often; in the red, all
  // round you and closer each time.
  if (S.depth > 0.1) {
    S.boltT -= dt;
    if (S.boltT <= 0) {
      S.boltT = S.red > 0.2 ? 0.7 + Math.random() * 1.1 : 2.2 + Math.random() * 4;
      flashOf(game, S, S.red > 0.2);
    }
  }
  // The sea boiling red round you.
  if (S.red > 0.05) boil(game, S, dt);
  // In the red too long, or too deep: it finds the raft.
  if (S.red > 0.5) S.redT += dt;
  else S.redT = Math.max(0, S.redT - dt);
  if (p.raft && (S.depth >= STORM_STAGES.strike || S.redT > 9)) startEnding(game, S);
}

// A flash of lightning (and, in the red, a bolt into the sea near you).
function flashOf(game, S, strike) {
  const p = game.player;
  const r = game.renderer;
  S.flash = 1;
  game.audio?.play('thunder');
  if (!strike) return;
  // (Nearer each time.)
  const d = Math.max(2, 9 - S.redT * 0.8 - Math.random() * 3);
  const a = Math.random() * Math.PI * 2;
  const x = Math.round(p.x + Math.cos(a) * d);
  const z = Math.round(p.z + Math.sin(a) * d);
  r.effect?.({ type: 'bolt', from: 'sky', wx: x, wy: GROUND, wz: z, tx: x, ty: GROUND, tz: z, life: 0.45, oy: -4 });
  r.emit(x, GROUND + 0.2, z, { n: 22, color: ['#ffffff', '#ffd0c0', '#ff6040'], up: 60, speed: 70, gravity: 160, life: 0.7, glow: true });
  r.emit(x, GROUND + 0.2, z, { n: 10, color: ['#c8c0c0', '#8a8080'], up: 20, speed: 20, gravity: -20, life: 1.4 });
  game.shake = Math.min(1.2, (game.shake || 0) + 0.45 + (9 - d) * 0.06);
  game.audio?.play('boom');
}

// Red bubbles breaking and steam coming off the sea round you.
function boil(game, S, dt) {
  const p = game.player;
  const r = game.renderer;
  const n = S.red * dt * 40;
  for (let i = 0; i < n || Math.random() < n - i; i++) {
    const x = p.x + Math.round((Math.random() - 0.5) * 22);
    const z = p.z + Math.round((Math.random() - 0.5) * 16);
    r.emit(x + Math.random(), GROUND + 0.1, z + Math.random(), { n: 1, color: ['#ff5a3a', '#c82010', '#ffb090'], up: 14, speed: 6, gravity: 30, life: 0.5, shape: 'drop' });
    if (Math.random() < 0.3) r.emit(x + Math.random(), GROUND + 0.3, z + Math.random(), { n: 1, color: ['#a08880', '#c8b0a8'], up: 16, speed: 4, gravity: -12, life: 1.2 });
  }
}

// It finds the raft.
function startEnding(game, S) {
  const p = game.player;
  const r = game.renderer;
  S.phase = 'strike';
  S.t = 0;
  S.flash = 1;
  r.effect?.({ type: 'bolt', from: 'sky', wx: p.x, wy: GROUND, wz: p.z, tx: p.x, ty: GROUND, tz: p.z, life: 0.6, oy: -8 });
  // The raft in pieces.
  r.emit(p.x, GROUND + 0.4, p.z, { n: 30, color: ['#8a6038', '#5a4028', '#c09060'], up: 90, speed: 90, gravity: 200, life: 1.2 });
  r.emit(p.x, GROUND + 0.4, p.z, { n: 40, color: ['#ffffff', '#fff0c0', '#ff8060'], up: 80, speed: 120, gravity: 60, life: 0.5, glow: true });
  game.shake = 1.6;
  game.audio?.play('thunder');
  game.audio?.play('boom');
  p.raft = null;
}

// White; black; the beach.
function runEnding(game, S, dt) {
  const p = game.player;
  S.t += dt;
  if (S.phase === 'strike' && S.t >= 0.7) {
    S.phase = 'black';
    S.t = 0;
  } else if (S.phase === 'black') {
    if (!S.ashore && S.t >= 1) {
      S.ashore = true;
      washAshore(game);
      // (Out of it now: when you open your eyes, it's daylight, or night.)
      S.depth = S.near = S.dark = S.red = S.cloud = S.flash = 0;
      S.redT = 0;
    }
    if (S.t >= 3) {
      S.phase = 'wake';
      S.t = 0;
      game.ui.msg('You come to on a beach, coughing up seawater, every bone aching. Of the raft there\'s no sign: the storm has taken it.', '#a0c8ff');
      game.audio?.play('splash');
    }
  } else if (S.phase === 'wake' && S.t >= 2.4) {
    S.phase = null;
    S.ashore = false;
    S.depth = S.near = S.dark = S.red = S.cloud = 0;
    S.redT = 0;
    p.stunT = 0;
  }
}

// The nearest shore back inside the storm (where the sea's thrown you up),
// and you on it.
export function washAshore(game) {
  const p = game.player;
  const ow = game.world.ow;
  // (Which side of it you'd come from: in from the islands' sea, or out.)
  const cx = STORM.cx * REGION_W;
  const cz = STORM.cz * REGION_D;
  const ex = (p.x / REGION_W - STORM.cx) / STORM.rx;
  const ez = (p.z / REGION_D - STORM.cz) / STORM.rz;
  const inner = Math.hypot(ex, ez) < 1 + STORM.band / STORM.rx / 2;
  const sameSide = (x, z) => ow.stormAt(x, z) === 0 && (ow.insideStorm ? ow.insideStorm(x, z) === inner : true);
  const land = (x, z) => (inner ? !!ow.islandAt(x, z) : ow.continentAt(x, z) > 0);
  let spot = null;
  // Out and out in rings from where you went down, the first coast.
  for (let R = 8; R < 3000 && !spot; R += 6) {
    const n = Math.max(16, Math.round(R / 3));
    let best = null;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = Math.round(p.x + Math.cos(a) * R);
      const z = Math.round(p.z + Math.sin(a) * R);
      if (!sameSide(x, z) || !land(x, z)) continue;
      // (Of the coast that far off, the bit nearest the islands' heart.)
      const d = Math.hypot(x - cx, z - cz);
      if (!best || d < best.d) best = { x, z, d };
    }
    if (best) spot = best;
  }
  p.raft = null;
  if (spot) teleportTo(game, spot.x, spot.z);
  p.hp = Math.max(1, Math.min(p.hp, Math.ceil(p.maxHp * 0.35)));
  p.inWater = false;
}

// Locked out of the controls while it's happening.
export function stormLocked(game) {
  return !!(game.stormSea && game.stormSea.phase);
}
