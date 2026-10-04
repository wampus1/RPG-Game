// Fire: a thatched roof or a plank wall set alight (by a raider's torch,
// mostly). A burning block throws off flames and smoke for a while, may
// catch whatever burns beside it, then burns away; rain puts it out
// sooner. What's lost is mended by the town's builders like any damage.
import { B } from '../world/blocks.js';

export const FLAMMABLE = new Set(['thatch', 'roof_wood', 'planks', 'planks_birch', 'planks_dark', 'planks_bog', 'planks_drift', 'hay_bale', 'log_wall', 'timber', 'fence', 'crate', 'barrel',
  'bookshelf', 'wheat_crop', 'awning_red', 'awning_blue', 'awning_yellow', 'awning_green', 'canopy', 'sail'].map((k) => B[k]).filter((v) => v !== undefined));

// (No more than this many burning at once, however dry it is.)
const MAX = 14;
const AROUND = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];

export function burnable(game, x, y, z) {
  return !!game.world.regionAt(x, z) && FLAMMABLE.has(game.world.getBlock(x, y, z));
}

// Set it alight. Returns true if it caught.
export function ignite(game, x, y, z, cause = null) {
  game.fires ||= [];
  // (Under an ember ward, the mountain's fire and a raider's torch won't
  // take: see game.wardAt.)
  if ((cause === 'volcano' || cause === 'bandits') && game.wardAt && game.wardAt(x, z)) return false;
  if (game.fires.length >= MAX || !burnable(game, x, y, z)) return false;
  if (game.fires.some((f) => f.x === x && f.y === y && f.z === z)) return false;
  game.fires.push({ x, y, z, t: 0, life: 7 + Math.random() * 7, cause, spread: 0 });
  return true;
}

// Each frame: flames, smoke, a neighbour caught now and then, and the block
// gone once it's burned through.
export function tickFires(game, dt) {
  const fires = game.fires;
  if (!fires || !fires.length) return;
  const wet = game.weather && game.weather.kind === 'rain' ? 2.2 : 1;
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i];
    // (Already gone: pulled down, or burned out from under it.)
    if (!burnable(game, f.x, f.y, f.z)) {
      fires.splice(i, 1);
      continue;
    }
    f.t += dt * wet;
    f.fx = (f.fx || 0) - dt;
    if (f.fx <= 0) {
      f.fx = 0.08;
      game.renderer.emit(f.x, f.y + 0.6, f.z, { n: 2, color: ['#ffb040', '#ff7020', '#ffe080', '#ff4010'], up: 26, speed: 10, life: 0.45, gravity: -40, glow: true, spreadX: 6 });
      if (Math.random() < 0.4) game.renderer.emit(f.x, f.y + 1.2, f.z, { n: 1, color: ['#5a5450', '#3a3634', '#7a7470'], up: 18, speed: 6, life: 1.4, gravity: -12, shape: 'puff', grow: 1.5 });
    }
    // Catching the next board or bundle of thatch (twice at most).
    if (f.spread < 2 && wet === 1 && Math.random() < dt * 0.18) {
      const [dx, dy, dz] = AROUND[Math.floor(Math.random() * AROUND.length)];
      if (ignite(game, f.x + dx, f.y + dy, f.z + dz, f.cause)) f.spread++;
    }
    if (f.t >= f.life) {
      fires.splice(i, 1);
      game.sim.setBlocks([[f.x, f.y, f.z, B.air, 0]]);
      // (The town's builders will see to it.)
      const s = game.world.ow.settlementAt(f.x, f.z);
      const L = s && game.world.layouts.get(s.id);
      const b = L && L.buildings.find((q) => q.x0 !== undefined && f.x >= q.x0 && f.x <= q.x1 && f.z >= q.z0 && f.z <= q.z1);
      if (b && game.sim.works) game.sim.works.noteDamage(L, b);
      game.renderer.emit(f.x, f.y + 0.5, f.z, { n: 6, color: ['#3a3634', '#5a5450', '#ff7020'], up: 20, speed: 18, life: 0.8, gravity: 30 });
      game.audio?.play('break', { x: f.x, y: f.y, z: f.z });
    }
  }
  // Anyone standing in it gets singed.
  for (const f of fires) {
    for (const e of [game.player, ...game.npcs]) {
      if (!e || e.dead || e.down || Math.abs(e.x - f.x) > 0 || Math.abs(e.z - f.z) > 0 || Math.abs(e.y - f.y) > 1) continue;
      e.singeT = (e.singeT || 0) - dt;
      if (e.singeT <= 0) {
        e.singeT = 1;
        game.damage(e, 1, null);
      }
    }
  }
}

// The roof (or a wall) of a building on the side facing (fromX, fromZ):
// where a torch thrown from there would land.
export function roofTarget(game, b, fromX, fromZ) {
  const w = game.world;
  const xs = [];
  for (let x = b.x0; x <= b.x1; x++) xs.push(x);
  const zs = [];
  for (let z = b.z0; z <= b.z1; z++) zs.push(z);
  const cx = Math.max(b.x0, Math.min(b.x1, Math.round(fromX)));
  const cz = Math.max(b.z0, Math.min(b.z1, Math.round(fromZ)));
  const cand = [];
  for (const x of xs) {
    for (const z of zs) {
      if (Math.abs(x - cx) + Math.abs(z - cz) > 3) continue;
      for (let y = 14; y >= 1; y--) {
        const id = w.regionAt(x, z) ? w.getBlock(x, y, z) : B.air;
        if (id === B.air) continue;
        if (FLAMMABLE.has(id)) cand.push({ x, y, z, d: Math.abs(x - cx) + Math.abs(z - cz) });
        break;
      }
    }
  }
  cand.sort((a, c) => a.d - c.d);
  return cand[0] || null;
}

// Anything nearby that would burn (a haystack, a fence, crates by a door,
// a thatched roof): the nearest, within reach of a thrown torch.
export function nearestBurnable(game, x0, y0, z0, r = 8) {
  const w = game.world;
  let best = null;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx;
      const z = z0 + dz;
      if (!w.regionAt(x, z)) continue;
      for (let y = y0 - 1; y <= y0 + 6; y++) {
        if (!FLAMMABLE.has(w.getBlock(x, y, z))) continue;
        const d = Math.abs(dx) + Math.abs(dz) + Math.max(0, y - y0) * 0.3;
        if (!best || d < best.d) best = { x, y, z, d };
      }
    }
  }
  return best;
}
